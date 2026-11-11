/**
 * Member codes and the server's side of the Examples window.
 *
 *   - how a typed code is tidied up (code-format.mjs)
 *   - the fingerprint of a code (code-fingerprint.mjs), against a value worked out independently
 *   - what the server answers (unlock.ts): no code, a right code, a wrong one, a broken request,
 *     a request that is too large, a cancelled code, examples that are open to everyone
 *   - the courtesy limit on wrong codes
 *   - the owner's file (content/simulator-codes.ts) and the list of examples
 *   - the script that makes new codes (scripts/generate-simulator-codes.mjs): its fingerprints
 *     are the server's, it never writes a code into the repository, and it leaves
 *     "examplesOpenToEveryone" alone
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { examplesOpenToEveryone, nextSimulatorCodeNumber, simulatorCodes } from '../../../content/simulator-codes';
import { addToListFile, emptyListFile, freshListFile, main as generateCodes, readListFile } from '../../../scripts/generate-simulator-codes.mjs';
import { SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';
import { FULL_MISSION_SAMPLE, SAMPLE_PROGRAMS } from '../fire-rescue/samples';
import { ALL_EXAMPLES } from './all-examples';
import { FINGERPRINT_BYTES, FINGERPRINT_PATTERN, FINGERPRINT_ROUNDS, FINGERPRINT_SALT, fingerprintOf } from './code-fingerprint.mjs';
import { CODE_ALPHABET, CODE_EXAMPLE, CODE_LENGTH, CODE_PREFIX, formatCode, maskCode, normalizeCode } from './code-format.mjs';
import { AttemptLimiter, handleUnlockRequest, isMemberCode, MAX_BODY_BYTES, type CodeEntry, type UnlockRequest, type UnlockResponse, type UnlockSetup } from './unlock';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MENU_ORDER = ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person', 'smart-bucket', 'full-mission'];

// =============================================================================================
// What a code looks like
// =============================================================================================

describe('member codes: format', () => {
  test('the alphabet has no look-alikes', () => {
    assert.equal(CODE_ALPHABET.length, 31);
    assert.equal(new Set(CODE_ALPHABET).size, 31, 'no character twice');
    for (const lookAlike of '0O1IL') assert.ok(!CODE_ALPHABET.includes(lookAlike), `no "${lookAlike}"`);
    assert.match(CODE_ALPHABET, /^[2-9A-Z]+$/);
    assert.equal(CODE_LENGTH, 8);
    assert.equal(CODE_PREFIX, 'FIRE');
  });

  test('a typed code is tidied up: trimmed, capitals, no spaces or dashes, the word FIRE optional', () => {
    const same = [
      'FIRE-7K2M-9QXD',
      'fire-7k2m-9qxd',
      '  FIRE-7K2M-9QXD  ',
      '\tFIRE-7K2M-9QXD\n',
      'FIRE 7K2M 9QXD',
      'fire7k2m9qxd',
      '7K2M9QXD',
      '7k2m-9qxd',
      ' 7K2M 9QXD ',
      'F I R E - 7 K 2 M - 9 Q X D',
      'FIRE–7K2M—9QXD', // an en dash and an em dash, as a phone keyboard or a text program writes them
      'FIRE 7K2M 9QXD', // no-break spaces, as copied from a web page
      'FIRE-7K2M-9QXD​', // an invisible character a chat app added
    ];
    for (const typed of same) assert.equal(normalizeCode(typed), '7K2M9QXD', JSON.stringify(typed));
  });

  test('what cannot be a code gives null', () => {
    const notCodes: unknown[] = [
      '',
      '   ',
      'FIRE',
      'FIRE-7K2M',
      'FIRE-7K2M-9QX', // one short
      'FIRE-7K2M-9QXDD', // one long
      'FIRE-7K2M-9QX0', // a zero
      'FIRE-7K2M-9QXO', // the letter O
      'FIRE-1K2M-9QXD', // a one
      'FIRE-IK2M-9QXD', // the letter I
      'FIRE-LK2M-9QXD', // the letter L
      'FIRE-7K2M-9QX!',
      'FIRE-7K2M-9QXÉ',
      'WATER-7K2M-9QXD',
      'FIREFIRE7K2M9QXD',
      'x'.repeat(65),
      `FIRE-7K2M-9QXD${' '.repeat(60)}`, // longer than anything that is looked at
      null,
      undefined,
      12345678,
      ['FIRE-7K2M-9QXD'],
      { code: 'FIRE-7K2M-9QXD' },
    ];
    for (const typed of notCodes) assert.equal(normalizeCode(typed), null, JSON.stringify(typed));
  });

  test('a code is written FIRE-XXXX-XXXX, and shown with its second half hidden', () => {
    assert.equal(formatCode('7K2M9QXD'), 'FIRE-7K2M-9QXD');
    assert.equal(normalizeCode(formatCode('7K2M9QXD')), '7K2M9QXD');
    assert.equal(maskCode('7K2M9QXD'), 'FIRE-7K2M-••••');
    assert.ok(!maskCode('7K2M9QXD').includes('9QXD'));
    assert.equal(formatCode(normalizeCode(CODE_EXAMPLE) ?? ''), CODE_EXAMPLE, 'the example in the texts has the shape of a code');
  });
});

// =============================================================================================
// The fingerprint
// =============================================================================================

describe('member codes: fingerprint', () => {
  test('known answers (PBKDF2-HMAC-SHA256, worked out separately with Python hashlib)', async () => {
    // hashlib.pbkdf2_hmac('sha256', b'7K2M9QXD', b'makexlebanon.com/simulator/member-code/v1', 200000, 32).hex()
    assert.equal(await fingerprintOf('7K2M9QXD'), '706124f397b70655ede618cd5f4a62d8f4c4279a037fcb05a2693fd934e2b65b');
    assert.equal(await fingerprintOf('ABCDEFGH'), 'ec75359bdb85f7821089f6d1e3964dde082c2ec772b9f7ca683452b3d043ff68');
  });

  test('the salt, the rounds and the length are the ones every handed-out code was made with', () => {
    // Changing one of these makes every member code stop working. If that is really meant,
    // make new codes with the script (--replace), hand them out again, and change this test.
    assert.equal(FINGERPRINT_SALT, 'makexlebanon.com/simulator/member-code/v1');
    assert.equal(FINGERPRINT_ROUNDS, 200_000);
    assert.ok(FINGERPRINT_ROUNDS >= 100_000);
    assert.equal(FINGERPRINT_BYTES, 32);
  });

  test('a fingerprint is 64 hex digits, the same every time, and different for every code', async () => {
    const one = await fingerprintOf('7K2M9QXD');
    assert.match(one, FINGERPRINT_PATTERN);
    assert.match(one, /^[0-9a-f]{64}$/);
    assert.equal(await fingerprintOf('7K2M9QXD'), one);
    assert.notEqual(await fingerprintOf('7K2M9QXE'), one);
    assert.ok(!one.toUpperCase().includes('7K2M9QXD'));
  });

  test('only the 8 tidied-up characters are accepted: what was typed must go through normalizeCode first', async () => {
    for (const bad of ['FIRE-7K2M-9QXD', '7k2m9qxd', '7K2M9QX', '7K2M9QX0', '', 42, null]) {
      await assert.rejects(fingerprintOf(bad as string), TypeError, JSON.stringify(bad));
    }
  });
});

// =============================================================================================
// The list of examples
// =============================================================================================

describe('the list of examples', () => {
  test('the catalog lists the seven examples in the order of the Examples window, with id, title and level only', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => card.id),
      MENU_ORDER,
    );
    for (const card of SAMPLE_CATALOG) {
      assert.deepEqual(Object.keys(card).sort(), ['id', 'level', 'title'], `${card.id}: nothing but id, title and level`);
      assert.ok(card.title.length > 3);
      assert.ok(['starter', 'intermediate', 'advanced'].includes(card.level));
    }
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => card.level),
      ['starter', 'starter', 'starter', 'intermediate', 'intermediate', 'advanced', 'advanced'],
    );
    assert.equal(new Set(SAMPLE_CATALOG.map((card) => card.title)).size, 7, 'no title twice');
  });

  test('every example of the catalog has its program and description on the server, and the titles agree', () => {
    assert.deepEqual(
      ALL_EXAMPLES.map((example) => example.id),
      MENU_ORDER,
    );
    assert.deepEqual(new Set(ALL_EXAMPLES), new Set([...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE]), 'the six samples and the full mission, nothing else');
    ALL_EXAMPLES.forEach((example, i) => {
      assert.equal(example.title, SAMPLE_CATALOG[i].title);
      assert.equal(example.level, SAMPLE_CATALOG[i].level);
      assert.ok(example.description.length > 40, example.id);
      assert.ok((example.program.blocks?.blocks ?? []).length > 0, example.id);
    });
  });

  test('the full mission says honestly what it is', () => {
    assert.match(FULL_MISSION_SAMPLE.title, /^Full mission/);
    assert.match(FULL_MISSION_SAMPLE.title, /default combination/);
    assert.match(FULL_MISSION_SAMPLE.description, /complete solution/i);
    assert.match(FULL_MISSION_SAMPLE.description, /180 ONLY on the default combination/);
  });
});

// =============================================================================================
// The server's answers
// =============================================================================================

/** Three made-up codes; only the first two are on the list. */
const CODE_A = 'FIRE-AAAA-2222';
const CODE_B = 'FIRE-BBBB-3333';
const CODE_NOT_LISTED = 'FIRE-CCCC-4444';

/** Sentences and texts that exist only inside descriptions and programs: no refusal may carry them. */
const SECRETS = ['Hello MakeX!', 'Person here - other square', 'Mission complete!', 'A first program', 'reads its colour with the colour sensor', 'A complete solution'];

/** A request as the simulator's page sends it: POST, JSON, from one address. */
function post(body: unknown, client: string | null = '10.0.0.1', contentType: string | null = 'application/json'): UnlockRequest {
  return { method: 'POST', body: typeof body === 'string' || body === null ? body : JSON.stringify(body), contentType, client };
}

function assertNoExampleData(response: UnlockResponse, why: string): void {
  assert.equal(response.body.ok, false, why);
  assert.deepEqual(Object.keys(response.body).sort(), ['ok', 'reason'], `${why}: nothing but ok and reason`);
  const text = JSON.stringify(response);
  for (const word of ['examples', 'description', 'program', 'blocks', ...SECRETS, ...SAMPLE_CATALOG.map((card) => card.title)]) {
    assert.ok(!text.includes(word), `${why}: the answer does not contain "${word}"`);
  }
  assert.equal(response.headers['Cache-Control'], 'no-store', why);
}

describe('POST /api/simulator/unlock (handleUnlockRequest)', () => {
  let codes: CodeEntry[];
  let setup: UnlockSetup;

  before(async () => {
    codes = [
      { no: 1, fingerprint: await fingerprintOf(normalizeCode(CODE_A) as string) },
      { no: 2, fingerprint: await fingerprintOf(normalizeCode(CODE_B) as string) },
    ];
    setup = { codes, examples: ALL_EXAMPLES, openToEveryone: [] };
  });

  test('no code: 200, not a member, and no example at all while nothing is open to everyone', async () => {
    for (const body of [{}, { code: '' }, { code: '   ' }, { code: null }, { other: 'field' }, '', '  \n']) {
      const response = await handleUnlockRequest(post(body), setup);
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.deepEqual(response.body, { ok: true, member: false, examples: [] }, JSON.stringify(body));
      assert.equal(response.headers['Cache-Control'], 'no-store');
      for (const secret of SECRETS) assert.ok(!JSON.stringify(response).includes(secret));
    }
  });

  test('a code of the list: 200, member, all seven examples with description and program, in menu order', async () => {
    const response = await handleUnlockRequest(post({ code: CODE_A }), setup);
    assert.equal(response.status, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.ok(response.body.ok);
    assert.equal(response.body.member, true);
    assert.deepEqual(
      response.body.examples.map((example) => example.id),
      MENU_ORDER,
    );
    response.body.examples.forEach((example, i) => {
      assert.deepEqual(Object.keys(example).sort(), ['description', 'id', 'level', 'program', 'title']);
      assert.equal(example.title, SAMPLE_CATALOG[i].title);
      assert.equal(example.level, SAMPLE_CATALOG[i].level);
      assert.equal(example.description, ALL_EXAMPLES[i].description);
      assert.deepEqual(example.program, ALL_EXAMPLES[i].program);
    });
    // it is what a browser can read: plain JSON
    assert.deepEqual(JSON.parse(JSON.stringify(response.body)), response.body);
  });

  test('a code is accepted however it is typed', async () => {
    for (const typed of ['fire-aaaa-2222', '  FIRE AAAA 2222 ', 'AAAA2222', 'aaaa-2222', CODE_B]) {
      const response = await handleUnlockRequest(post({ code: typed }), setup);
      assert.equal(response.status, 200, typed);
      assert.ok(response.body.ok && response.body.member && response.body.examples.length === 7, typed);
    }
  });

  test('a code that is not on the list: 403 "invalid-code" and nothing else', async () => {
    const response = await handleUnlockRequest(post({ code: CODE_NOT_LISTED }), setup);
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { ok: false, reason: 'invalid-code' });
    assertNoExampleData(response, 'a wrong code');
  });

  test('the answer is the same whatever is wrong with the code: close to a real one, or not a code at all', async () => {
    const wrong = [
      CODE_NOT_LISTED,
      'FIRE-AAAA-2223', // one character off a real code
      'FIRE-AAAA-222', // too short
      'FIRE-AAAA-22222', // too long
      'FIRE-AAAA-2220', // a character that is in no code
      'hello',
      '1',
      'FIRE',
      'x'.repeat(100),
    ];
    const answers = new Set<string>();
    for (const typed of wrong) {
      const response = await handleUnlockRequest(post({ code: typed }), setup);
      assert.equal(response.status, 403, typed);
      assertNoExampleData(response, typed);
      answers.add(JSON.stringify(response));
    }
    assert.equal(answers.size, 1, 'one and the same answer');
  });

  test('a request that is not { "code": "..." }: 400 "bad-request"', async () => {
    for (const body of ['garbage', '{', '[]', '"FIRE-AAAA-2222"', '123', 'null', 'true', '{"code":123}', '{"code":["FIRE-AAAA-2222"]}', '{"code":{"a":1}}', '{"code":true}']) {
      const response = await handleUnlockRequest(post(body), setup);
      assert.equal(response.status, 400, body);
      assert.deepEqual(response.body, { ok: false, reason: 'bad-request' }, body);
      assertNoExampleData(response, body);
    }
  });

  test('a request with a text must say that it is JSON - so that no other website can make its visitors\' browsers try codes', async () => {
    // what a page on another website can send without the browser asking this server first
    for (const contentType of [null, '', 'text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonp', 'text/json', 'application/xml']) {
      for (const body of [{ code: CODE_A }, { code: CODE_NOT_LISTED }, {}, 'garbage']) {
        const response = await handleUnlockRequest(post(body, '10.0.0.1', contentType), setup);
        assert.equal(response.status, 415, `${contentType} ${JSON.stringify(body)}`);
        assert.deepEqual(response.body, { ok: false, reason: 'bad-request' });
        assertNoExampleData(response, `content type ${contentType}`);
      }
    }
    // such a request is turned away before the code is looked at: it does not use up a try either
    const limiter = new AttemptLimiter(2, 60_000);
    for (let i = 0; i < 10; i++) await handleUnlockRequest(post({ code: CODE_NOT_LISTED }, 'school', 'text/plain'), { ...setup, limiter, now: () => 1_000 });
    assert.equal((await handleUnlockRequest(post({ code: CODE_NOT_LISTED }, 'school'), { ...setup, limiter, now: () => 1_000 })).status, 403, 'still at full speed');

    // JSON is JSON however it is spelt
    for (const contentType of ['application/json', 'Application/JSON', 'application/json; charset=utf-8', 'application/json;charset=UTF-8', '  application/json  ']) {
      const response = await handleUnlockRequest(post({ code: CODE_A }, '10.0.0.1', contentType), setup);
      assert.equal(response.status, 200, contentType);
    }
    // a request without any text is "no code" and has nothing to describe
    for (const contentType of [null, 'text/plain']) {
      const response = await handleUnlockRequest(post('', '10.0.0.1', contentType), setup);
      assert.deepEqual(response.body, { ok: true, member: false, examples: [] });
    }
  });

  test('a request that is too large: 413 "too-large", also when it holds a right code', async () => {
    const padded = JSON.stringify({ code: CODE_A, padding: 'x'.repeat(MAX_BODY_BYTES) });
    for (const body of [padded, 'x'.repeat(MAX_BODY_BYTES + 1), 'é'.repeat(MAX_BODY_BYTES / 2 + 1), null]) {
      const response = await handleUnlockRequest(post(body), setup);
      assert.equal(response.status, 413);
      assert.deepEqual(response.body, { ok: false, reason: 'too-large' });
      assertNoExampleData(response, 'too large');
    }
    // right at the limit it is still read
    const atLimit = JSON.stringify({ code: CODE_A, p: '' });
    const fits = `${atLimit.slice(0, -2)}${'x'.repeat(MAX_BODY_BYTES - atLimit.length)}"}`;
    assert.equal(Buffer.byteLength(fits), MAX_BODY_BYTES);
    assert.equal((await handleUnlockRequest(post(fits), setup)).status, 200);
  });

  test('any method but POST: 405 with "Allow: POST", whatever the request holds', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'post']) {
      const response = await handleUnlockRequest({ ...post({ code: CODE_A }), method }, setup);
      assert.equal(response.status, 405, method);
      assert.equal(response.headers.Allow, 'POST');
      assert.deepEqual(response.body, { ok: false, reason: 'method-not-allowed' });
      assertNoExampleData(response, method);
    }
  });

  test('a cancelled code - its line removed from the list - opens nothing any more; the others still work', async () => {
    assert.equal((await handleUnlockRequest(post({ code: CODE_A }), setup)).status, 200);
    const afterCancelling: UnlockSetup = { ...setup, codes: codes.filter((entry) => entry.no !== 1) };
    const cancelled = await handleUnlockRequest(post({ code: CODE_A }), afterCancelling);
    assert.equal(cancelled.status, 403);
    assertNoExampleData(cancelled, 'a cancelled code');
    assert.equal((await handleUnlockRequest(post({ code: CODE_B }), afterCancelling)).status, 200);
    // an empty list: no code works
    assert.equal((await handleUnlockRequest(post({ code: CODE_B }), { ...setup, codes: [] })).status, 403);
  });

  test('lines that are not a fingerprint (a slip while editing) are ignored, and never match', async () => {
    const sloppy = [{ no: 1, fingerprint: '' }, { no: 2, fingerprint: 'not hex' }, { no: 3 }, null, ...codes] as CodeEntry[];
    assert.equal(await isMemberCode(CODE_A, sloppy), true);
    assert.equal(await isMemberCode(CODE_NOT_LISTED, sloppy), false);
    assert.equal(await isMemberCode('', sloppy), false);
  });

  test('examplesOpenToEveryone: without a code, exactly the listed examples - with description and program', async () => {
    const open = await handleUnlockRequest(post({}), { ...setup, openToEveryone: ['hello'] });
    assert.equal(open.status, 200);
    assert.ok(open.body.ok);
    assert.equal(open.body.member, false);
    assert.equal(open.body.examples.length, 1);
    assert.deepEqual(open.body.examples[0], {
      id: 'hello',
      title: 'Hello, mBot2',
      level: 'starter',
      description: ALL_EXAMPLES[0].description,
      program: ALL_EXAMPLES[0].program,
    });
    const text = JSON.stringify(open);
    assert.ok(text.includes('Hello MakeX!'));
    for (const secret of ['Person here - other square', 'Mission complete!', 'A complete solution', 'Line follower', 'Got it!']) {
      assert.ok(!text.includes(secret), `the other examples stay on the server ("${secret}")`);
    }

    // in menu order whatever the order in the file; ids that do not exist, and doubles, open nothing more
    const several = await handleUnlockRequest(post({}), { ...setup, openToEveryone: ['gripper-demo', 'no-such-example', 'hello', 'hello', 'HELLO', ''] });
    assert.ok(several.body.ok);
    assert.deepEqual(
      several.body.examples.map((example) => example.id),
      ['hello', 'gripper-demo'],
    );
    assert.equal(several.body.member, false);

    // a member gets all seven all the same, and a wrong code still gets nothing
    const member = await handleUnlockRequest(post({ code: CODE_A }), { ...setup, openToEveryone: ['hello'] });
    assert.ok(member.body.ok && member.body.member && member.body.examples.length === 7);
    const wrong = await handleUnlockRequest(post({ code: CODE_NOT_LISTED }), { ...setup, openToEveryone: ['hello'] });
    assert.equal(wrong.status, 403);
    assertNoExampleData(wrong, 'a wrong code, with an example open to everyone');
  });
});

// =============================================================================================
// The courtesy limit
// =============================================================================================

describe('the courtesy limit on wrong codes', () => {
  let setup: UnlockSetup;
  let clock = 0;

  before(async () => {
    setup = {
      codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(CODE_A) as string) }],
      examples: ALL_EXAMPLES,
      openToEveryone: [],
      now: () => clock,
    };
  });

  /** Wrong codes that all have the shape of a code (so that each one is really checked). */
  const wrongCode = (i: number): string => formatCode(`WWWW${[...String(i).padStart(4, '2')].map((d) => CODE_ALPHABET[Number(d)]).join('')}`);

  /** What the limiter remembers (looked at from outside, for the tests only). */
  const remembered = (limiter: AttemptLimiter): Map<string, unknown> => (limiter as unknown as { clients: Map<string, unknown> }).clients;

  test('a right code typed after a few typing mistakes is accepted', async () => {
    const limiter = new AttemptLimiter();
    clock = 1_000;
    // five mistakes, the sixth try is right
    for (let i = 0; i < 5; i++) {
      assert.equal((await handleUnlockRequest(post({ code: wrongCode(i) }), { ...setup, limiter })).status, 403);
    }
    const sixth = await handleUnlockRequest(post({ code: CODE_A }), { ...setup, limiter });
    assert.equal(sixth.status, 200);
    assert.ok(sixth.body.ok && sixth.body.member);
    // and after a few more
    for (let i = 5; i < 13; i++) {
      assert.equal((await handleUnlockRequest(post({ code: wrongCode(i) }), { ...setup, limiter })).status, 403);
    }
    assert.equal((await handleUnlockRequest(post({ code: CODE_A }), { ...setup, limiter })).status, 200);
  });

  test('the default limit is far above a few typing mistakes, and the slow lane is a matter of a second', () => {
    const limiter = new AttemptLimiter();
    assert.ok(limiter.limit >= 50);
    assert.ok(limiter.windowMs <= 15 * 60 * 1000);
    assert.ok(limiter.slowEveryMs <= 2_000);
  });

  test('right codes and requests without a code never count, however many', async () => {
    const limiter = new AttemptLimiter(3, 60_000);
    clock = 5_000;
    for (let i = 0; i < 12; i++) {
      assert.equal((await handleUnlockRequest(post({ code: CODE_A }), { ...setup, limiter })).status, 200);
      assert.equal((await handleUnlockRequest(post({}), { ...setup, limiter })).status, 200);
    }
    assert.equal(remembered(limiter).size, 0, 'nothing is remembered about this address');
    // two mistakes, then right codes again: still two tries used, not more
    for (let i = 0; i < 2; i++) await handleUnlockRequest(post({ code: wrongCode(i) }), { ...setup, limiter });
    for (let i = 0; i < 12; i++) assert.equal((await handleUnlockRequest(post({ code: CODE_A }), { ...setup, limiter })).status, 200);
    assert.equal((await handleUnlockRequest(post({ code: wrongCode(2) }), { ...setup, limiter })).status, 403, 'the third wrong code is still checked at full speed');
  });

  test('after too many wrong codes an address is slowed down, never locked out: a right code waits a second, not ten minutes', async () => {
    const limiter = new AttemptLimiter(3, 60_000, 5000, 1_000);
    const withLimiter = { ...setup, limiter };
    const from = (code: string | null, client = 'school') => handleUnlockRequest(post(code === null ? {} : { code }, client), withLimiter);

    // (a script, or a room full of browsers that still send a cancelled code on every visit)
    clock = 10_000;
    for (let i = 0; i < 3; i++) assert.equal((await from(wrongCode(i))).status, 403);

    // over the limit: one code per second is still checked ...
    assert.equal((await from(wrongCode(3))).status, 403, 'the first one in the slow lane is checked');
    // ... and until the second is over, nothing is: not a wrong code, not a right one
    const waiting = await from(wrongCode(4));
    assert.equal(waiting.status, 429);
    assert.deepEqual(waiting.body, { ok: false, reason: 'too-many-attempts' });
    assert.equal(waiting.headers['Retry-After'], '1');
    assertNoExampleData(waiting, 'too many attempts');
    const tooSoon = await from(CODE_A);
    assert.equal(tooSoon.status, 429);
    assertNoExampleData(tooSoon, 'a right code that was not looked at');
    clock = 10_400;
    assert.equal((await from(CODE_A)).headers['Retry-After'], '1');

    // a request without a code is always answered, and another address is not affected
    assert.equal((await from(null)).status, 200);
    assert.equal((await from(CODE_A, 'somewhere else')).status, 200);

    // one second later the member is in - and a right code does not use the turn up
    clock = 11_000;
    for (let i = 0; i < 5; i++) {
      const response = await from(CODE_A);
      assert.equal(response.status, 200, `right code number ${i + 1} in the same moment`);
      assert.ok(response.body.ok && response.body.member && response.body.examples.length === 7);
    }
    // a wrong one does
    assert.equal((await from(wrongCode(5))).status, 403);
    assert.equal((await from(CODE_A)).status, 429);
    clock = 12_000;
    assert.equal((await from(CODE_A)).status, 200);

    // there is no penalty time: however many wrong codes came, the wait never grows
    for (let i = 0; i < 200; i++) await from(wrongCode(100 + i));
    assert.equal((await from(wrongCode(6))).headers['Retry-After'], '1');
    clock = 13_000;
    assert.equal((await from(CODE_A)).status, 200);

    // when the time is over, the address is back at full speed
    clock = 10_000 + 60_000;
    for (let i = 0; i < 3; i++) assert.equal((await from(wrongCode(i))).status, 403);
    assert.equal((await from(CODE_A)).status, 200);
  });

  test('wrong codes sent all in the same instant are counted before they are checked: no burst gets past the limit', async () => {
    const limiter = new AttemptLimiter(5, 60_000, 5000, 1_000);
    clock = 30_000;
    // one right code and 49 wrong ones, all at once from one address
    const all = await Promise.all([
      handleUnlockRequest(post({ code: CODE_A }, 'burst'), { ...setup, limiter }),
      ...Array.from({ length: 49 }, (_, i) => handleUnlockRequest(post({ code: wrongCode(i) }, 'burst'), { ...setup, limiter })),
    ]);
    const statuses = all.map((response) => response.status);
    assert.equal(statuses[0], 200, 'the right code');
    // checked: four at full speed (the right code held the fifth place while it was checked) and one in the slow lane
    assert.equal(statuses.filter((status) => status === 403).length, 5);
    assert.equal(statuses.filter((status) => status === 429).length, 44, 'the others were turned away without being checked');
    for (const response of all.slice(1)) assertNoExampleData(response, 'a wrong code of the burst');
  });

  test('a request whose address is not known is not limited (never one count for all visitors)', async () => {
    const limiter = new AttemptLimiter(2, 60_000);
    clock = 40_000;
    for (let i = 0; i < 10; i++) {
      assert.equal((await handleUnlockRequest(post({ code: wrongCode(i) }, null), { ...setup, limiter })).status, 403);
    }
    assert.equal((await handleUnlockRequest(post({ code: CODE_A }, null), { ...setup, limiter })).status, 200);
    assert.equal(remembered(limiter).size, 0);
  });

  test('a flood of addresses does not make it grow without end, and it keeps working afterwards', () => {
    const limiter = new AttemptLimiter(3, 60_000, 10, 1_000);
    for (let i = 0; i < 500; i++) limiter.admit(`address-${i}`, 1_000 + i);
    assert.ok(remembered(limiter).size <= 10, `${remembered(limiter).size} addresses remembered`);
    for (let i = 0; i < 3; i++) assert.equal(limiter.admit('again', 3_000).wait, 0);
    assert.equal(limiter.admit('again', 3_000).wait, 0, 'the first turn in the slow lane');
    assert.equal(limiter.admit('again', 3_000).wait, 1);
    assert.equal(limiter.admit('again', 3_999).wait, 1);
    assert.equal(limiter.admit('again', 4_000).wait, 0);
    assert.equal(limiter.admit('somebody else', 3_000).wait, 0);
  });

  test('giving a turn back twice, or after the count started again, changes nothing', () => {
    const limiter = new AttemptLimiter(2, 60_000, 5000, 1_000);
    const first = limiter.admit('a', 1_000);
    limiter.admit('a', 1_000);
    first.giveBack();
    first.giveBack();
    assert.equal(limiter.admit('a', 1_000).wait, 0, 'one place was given back, once');
    assert.equal(limiter.admit('a', 1_000).wait, 0, 'the slow lane');
    assert.equal(limiter.admit('a', 1_000).wait, 1);
    // a turn of the old count, given back after the count started again
    const old = limiter.admit('b', 1_000);
    limiter.admit('b', 70_000);
    old.giveBack();
    limiter.admit('b', 70_000);
    assert.equal(limiter.admit('b', 70_000).wait, 0, 'the slow lane: both places of the new count are still taken');
    assert.equal(limiter.admit('b', 70_000).wait, 1);
  });
});

// =============================================================================================
// The owner's file
// =============================================================================================

describe('content/simulator-codes.ts', () => {
  const file = path.join(REPO_ROOT, 'content', 'simulator-codes.ts');
  const text = readFileSync(file, 'utf8');

  test('every line of the list is a number and a fingerprint; no number and no fingerprint twice', () => {
    assert.ok(Array.isArray(simulatorCodes));
    for (const entry of simulatorCodes) {
      assert.ok(Number.isInteger(entry.no) && entry.no >= 1, `number ${entry.no}`);
      assert.match(entry.fingerprint, FINGERPRINT_PATTERN, `the fingerprint of number ${entry.no}`);
    }
    assert.equal(new Set(simulatorCodes.map((entry) => entry.no)).size, simulatorCodes.length, 'no number twice');
    assert.equal(new Set(simulatorCodes.map((entry) => entry.fingerprint)).size, simulatorCodes.length, 'no fingerprint twice');
    const highest = Math.max(0, ...simulatorCodes.map((entry) => entry.no));
    assert.ok(nextSimulatorCodeNumber > highest, 'the next number is above every number on the list');
  });

  test('the script can read the file, and sees the same list', () => {
    const info = readListFile(text);
    assert.ok(info, 'the file has the shape the script writes');
    assert.equal(info.active, simulatorCodes.length);
    assert.equal(info.nextNumber, nextSimulatorCodeNumber);
    for (const entry of simulatorCodes) assert.ok(info.fingerprints.has(entry.fingerprint));
  });

  test('examplesOpenToEveryone names only examples that exist', () => {
    assert.ok(Array.isArray(examplesOpenToEveryone));
    const ids = SAMPLE_CATALOG.map((card) => card.id);
    for (const id of examplesOpenToEveryone) {
      assert.ok(ids.includes(id), `"${id}" is not an example. The ids are: ${ids.join(', ')}`);
    }
  });

  test('there is no member code in the file - only the made-up one that shows what a code looks like', () => {
    const found = text.match(/FIRE[- ]?[2-9A-Z]{4}[- ]?[2-9A-Z]{4}/g) ?? [];
    assert.deepEqual([...new Set(found)], [CODE_EXAMPLE]);
  });

  test('the made-up code of the texts is not a member code', async () => {
    assert.equal(await isMemberCode(CODE_EXAMPLE, simulatorCodes), false);
  });
});

// =============================================================================================
// The script that makes new codes
// =============================================================================================

/** The lines of a list file that count (not the cancelled ones). */
function entriesOf(listText: string): CodeEntry[] {
  const entries: CodeEntry[] = [];
  for (const line of listText.split('\n')) {
    const match = /^\s*\{ no: (\d+), fingerprint: '([0-9a-f]{64})' \},$/.exec(line);
    if (match) entries.push({ no: Number(match[1]), fingerprint: match[2] });
  }
  return entries;
}

/** The rows of a CSV file written by the script. */
function rowsOf(csv: string): Array<{ no: number; code: string; givenTo: string }> {
  const [header, ...lines] = csv.split('\r\n').filter((line) => line !== '');
  assert.equal(header, 'No,Code,Given to');
  return lines.map((line) => {
    const [no, code, givenTo] = line.split(',');
    return { no: Number(no), code, givenTo };
  });
}

/** Everything in a list file except the lines of the list and the next number. */
function restOf(listText: string): string {
  const info = readListFile(listText);
  assert.ok(info);
  return `${listText.slice(0, info.listFrom)}${listText.slice(info.listTo)}`.replace(/nextSimulatorCodeNumber = \d+/, 'nextSimulatorCodeNumber = N');
}

describe('scripts/generate-simulator-codes.mjs', () => {
  let folder: string;
  let list: string;
  const printed: string[] = [];
  const print = (line: string): void => {
    printed.push(line);
  };
  const run = (...args: string[]): Promise<void> => generateCodes(['--list', list, ...args], print);

  before(() => {
    folder = mkdtempSync(path.join(tmpdir(), 'makex-codes-test-'));
    list = path.join(folder, 'simulator-codes.ts');
  });
  after(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  test('new codes: a CSV file with No, Code, Given to - and fingerprints that are the server\'s', async () => {
    const csv = path.join(folder, 'first.csv');
    await run('--count', '3', '--out', csv);

    const rows = rowsOf(readFileSync(csv, 'utf8'));
    assert.deepEqual(
      rows.map((row) => row.no),
      [1, 2, 3],
    );
    for (const row of rows) {
      assert.match(row.code, /^FIRE-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
      assert.equal(row.givenTo, '');
    }
    assert.equal(new Set(rows.map((row) => row.code)).size, 3);

    const listText = readFileSync(list, 'utf8');
    const entries = entriesOf(listText);
    assert.deepEqual(
      entries.map((entry) => entry.no),
      [1, 2, 3],
    );
    // the fingerprint the script wrote for a code is the one the server works out for it
    for (const row of rows) {
      const characters = normalizeCode(row.code);
      assert.ok(characters);
      assert.equal(entries[row.no - 1].fingerprint, await fingerprintOf(characters), `code number ${row.no}`);
    }
    // ... so the server accepts every new code, and only those
    const setup: UnlockSetup = { codes: entries, examples: ALL_EXAMPLES, openToEveryone: [] };
    for (const row of rows) {
      const response = await handleUnlockRequest(post({ code: row.code }), setup);
      assert.ok(response.status === 200 && response.body.ok && response.body.member, row.code);
    }
    assert.equal((await handleUnlockRequest(post({ code: CODE_NOT_LISTED }), setup)).status, 403);

    // no code in the list file, none on the screen
    for (const row of rows) {
      assert.ok(!listText.includes(row.code) && !listText.includes(normalizeCode(row.code) as string), 'the list holds no code');
      assert.ok(!printed.join('\n').includes(row.code) && !printed.join('\n').includes(row.code.slice(5)), 'no code was printed');
    }
    assert.equal(readListFile(listText)?.nextNumber, 4);
    assert.equal(listText.replace(/^  \{ no: .*\n/gm, '').replace('= 4;', '= 1;'), freshListFile(), 'a new file is the template plus the lines');
  });

  test('more codes are added at the end, numbered on - also after a line was cancelled or deleted', async () => {
    // cancel number 2 with two slashes, delete number 3
    const edited = readFileSync(list, 'utf8')
      .replace(/^  (\{ no: 2, .*)$/m, '  // $1')
      .replace(/^  \{ no: 3, .*\n/m, '');
    writeFileSync(list, edited);
    assert.deepEqual(
      entriesOf(edited).map((entry) => entry.no),
      [1],
    );
    const before = readFileSync(list, 'utf8');

    const csv = path.join(folder, 'second.csv');
    await run('--count', '2', '--out', csv);
    const rows = rowsOf(readFileSync(csv, 'utf8'));
    assert.deepEqual(
      rows.map((row) => row.no),
      [4, 5],
      'number 3 is not given out a second time',
    );
    const listText = readFileSync(list, 'utf8');
    assert.deepEqual(
      entriesOf(listText).map((entry) => entry.no),
      [1, 4, 5],
    );
    assert.ok(listText.includes('  // { no: 2, fingerprint:'), 'the cancelled line is still there, still cancelled');
    assert.equal(readListFile(listText)?.nextNumber, 6);
    assert.equal(restOf(listText), restOf(before), 'nothing but the list and the next number changed');
    // the first CSV file was not touched
    assert.equal(rowsOf(readFileSync(path.join(folder, 'first.csv'), 'utf8')).length, 3);
  });

  test('"examplesOpenToEveryone" is never touched: not when codes are added, not with --replace', async () => {
    const opened = readFileSync(list, 'utf8').replace(
      "export const examplesOpenToEveryone: string[] = [\n  // (empty: every example needs a member code)\n];",
      "export const examplesOpenToEveryone: string[] = [\n  'hello',\n  'line-follow', // for the open day\n];",
    );
    assert.ok(opened.includes("'line-follow', // for the open day"));
    writeFileSync(list, opened);
    const untouched = (textNow: string): void => {
      assert.ok(textNow.includes("export const examplesOpenToEveryone: string[] = [\n  'hello',\n  'line-follow', // for the open day\n];"));
      assert.equal(restOf(textNow), restOf(opened));
    };

    await run('--count', '1', '--out', path.join(folder, 'third.csv'));
    untouched(readFileSync(list, 'utf8'));
    assert.deepEqual(
      entriesOf(readFileSync(list, 'utf8')).map((entry) => entry.no),
      [1, 4, 5, 6],
    );

    const oldCodes = [...rowsOf(readFileSync(path.join(folder, 'first.csv'), 'utf8')), ...rowsOf(readFileSync(path.join(folder, 'second.csv'), 'utf8'))];
    await run('--count', '2', '--replace', '--out', path.join(folder, 'fourth.csv'));
    const replaced = readFileSync(list, 'utf8');
    untouched(replaced);
    const entries = entriesOf(replaced);
    assert.deepEqual(
      entries.map((entry) => entry.no),
      [1, 2],
      '--replace starts again at number 1',
    );
    assert.ok(!replaced.includes('// { no: 2, fingerprint:'), 'the cancelled line is gone too');
    assert.equal(readListFile(replaced)?.nextNumber, 3);
    // the codes handed out before no longer work, the new ones do
    for (const row of oldCodes) assert.equal(await isMemberCode(row.code, entries), false, `old code number ${row.no}`);
    for (const row of rowsOf(readFileSync(path.join(folder, 'fourth.csv'), 'utf8'))) assert.equal(await isMemberCode(row.code, entries), true);
  });

  test('it refuses to write the codes inside the repository, and then changes nothing', async () => {
    const before = readFileSync(list, 'utf8');
    for (const inside of ['codes.csv', 'content/codes.csv', 'public/downloads/codes.csv', 'scripts/../codes.csv']) {
      const target = path.join(REPO_ROOT, inside);
      assert.ok(!existsSync(target), `${inside} must not exist before this test`);
      await assert.rejects(run('--count', '1', '--out', target), /inside the website's folder/, inside);
      assert.ok(!existsSync(target), `${inside} was not written`);
    }
    assert.equal(readFileSync(list, 'utf8'), before);
  });

  test('a link does not get the codes into the repository either: not a linked folder, not a linked file name', async (t) => {
    const before = readFileSync(list, 'utf8');
    // a folder outside the repository that is really a folder of it, and
    // a file name outside it that is really a file (not there yet) inside it
    const linkedFolder = path.join(folder, 'looks-outside');
    const linkedFile = path.join(folder, 'linked.csv');
    try {
      symlinkSync(path.join(REPO_ROOT, 'content'), linkedFolder, 'dir');
      symlinkSync(path.join(REPO_ROOT, 'content', 'linked-codes.csv'), linkedFile, 'file');
    } catch {
      t.skip('this computer does not let a program make links');
      return;
    }
    await assert.rejects(run('--count', '1', '--out', path.join(linkedFolder, 'codes.csv')), /inside the website's folder/);
    assert.ok(!existsSync(path.join(REPO_ROOT, 'content', 'codes.csv')));
    await assert.rejects(run('--count', '1', '--out', linkedFile), /already exists/);
    assert.ok(!existsSync(path.join(REPO_ROOT, 'content', 'linked-codes.csv')));
    assert.equal(readFileSync(list, 'utf8'), before);
  });

  test('it never overwrites a CSV file, needs a count and a place, and says no to nonsense', async () => {
    const before = readFileSync(list, 'utf8');
    const firstCsv = readFileSync(path.join(folder, 'first.csv'), 'utf8');
    await assert.rejects(run('--count', '1', '--out', path.join(folder, 'first.csv')), /already exists/);
    assert.equal(readFileSync(path.join(folder, 'first.csv'), 'utf8'), firstCsv);
    await assert.rejects(run('--count', '1'), /how many codes and where/);
    await assert.rejects(run('--out', path.join(folder, 'x.csv')), /how many codes and where/);
    for (const count of ['0', '-1', '1.5', 'many', '5001']) {
      await assert.rejects(run('--count', count, '--out', path.join(folder, 'x.csv')), /whole number/, count);
    }
    await assert.rejects(run('--count', '1', '--out', path.join(folder, 'no-such-folder', 'x.csv')), /does not exist/);
    await assert.rejects(run('--count', '1', '--out', path.join(folder, 'x.csv'), '--everything'), /not an option/);
    assert.ok(!existsSync(path.join(folder, 'x.csv')));
    assert.equal(readFileSync(list, 'utf8'), before);
  });

  test('a list file it cannot read is left alone', async () => {
    const broken = path.join(folder, 'broken.ts');
    writeFileSync(broken, 'export const simulatorCodes = [];\n');
    for (const extra of [[], ['--replace']]) {
      await assert.rejects(generateCodes(['--list', broken, '--count', '1', '--out', path.join(folder, 'y.csv'), ...extra], print), /does not look like the list/);
    }
    assert.equal(readFileSync(broken, 'utf8'), 'export const simulatorCodes = [];\n');
    assert.ok(!existsSync(path.join(folder, 'y.csv')));
  });

  test('the codes are shown on the screen only when asked with --print-codes', async () => {
    printed.length = 0;
    await run('--count', '2', '--out', path.join(folder, 'quiet.csv'));
    const quiet = rowsOf(readFileSync(path.join(folder, 'quiet.csv'), 'utf8'));
    assert.ok(!/FIRE-[2-9A-Z]{4}-[2-9A-Z]{4}/.test(printed.join('\n')), 'nothing that looks like a code');
    for (const row of quiet) assert.ok(!printed.join('\n').includes(row.code.slice(5)));

    printed.length = 0;
    await run('--count', '2', '--print-codes', '--out', path.join(folder, 'loud.csv'));
    for (const row of rowsOf(readFileSync(path.join(folder, 'loud.csv'), 'utf8'))) assert.ok(printed.join('\n').includes(row.code));
  });

  test('the helpers change the list and nothing else', () => {
    const fresh = freshListFile();
    assert.deepEqual(readListFile(fresh)?.active, 0);
    assert.equal(readListFile(fresh)?.nextNumber, 1);
    assert.match(fresh, /export const examplesOpenToEveryone: string\[\] = \[\n {2}\/\/ \(empty: every example needs a member code\)\n\];/);
    for (const id of MENU_ORDER) assert.ok(fresh.includes(`'${id}'`), `the explanation lists '${id}'`);
    const fingerprint = 'ab'.repeat(32);
    const added = addToListFile(fresh, [{ no: 1, fingerprint }]);
    assert.deepEqual(entriesOf(added), [{ no: 1, fingerprint }]);
    assert.equal(emptyListFile(added), fresh);
    assert.equal(readListFile('nothing of the kind'), null);
  });
});
