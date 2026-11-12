/**
 * Member codes, advanced codes and the server's side of the Examples window.
 *
 *   - how a typed code is tidied up (code-format.mjs)
 *   - the fingerprint of a code (code-fingerprint.mjs), against a value worked out independently
 *   - what the server answers (unlock.ts): no code, a right code, a wrong one, a broken request,
 *     a request that is too large, a cancelled code, examples that are open to everyone
 *   - who sees what: a visitor, a member code and an advanced code - and that an example kept
 *     for advanced codes only is in no answer but the one to an advanced code
 *   - the courtesy limit on wrong codes
 *   - the owner's file (content/simulator-codes.ts) and the list of examples
 *   - the address of the website itself (src/app/api/simulator/unlock/route.ts), with the owner's lists
 *   - the script that makes new codes (scripts/generate-simulator-codes.mjs): its fingerprints
 *     are the server's, it never writes a code into the repository, it changes one list of
 *     codes at a time and leaves everything else in the file alone
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  advancedSimulatorCodes,
  examplesForAdvancedCodesOnly,
  examplesOpenToEveryone,
  nextAdvancedSimulatorCodeNumber,
  nextSimulatorCodeNumber,
  simulatorCodes,
} from '../../../content/simulator-codes';
import { addToListFile, emptyListFile, freshListFile, main as generateCodes, makeCodes, readListFile } from '../../../scripts/generate-simulator-codes.mjs';
import { GET as routeGet, POST as routePost } from '../../app/api/simulator/unlock/route';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';
import { FULL_MISSION_SAMPLE, SAMPLE_PROGRAMS } from '../fire-rescue/samples';
import { ALL_EXAMPLES, ALL_LEVELS } from './all-examples';
import { FINGERPRINT_BYTES, FINGERPRINT_PATTERN, FINGERPRINT_ROUNDS, FINGERPRINT_SALT, fingerprintOf } from './code-fingerprint.mjs';
import { CODE_ALPHABET, CODE_EXAMPLE, CODE_LENGTH, CODE_PREFIX, formatCode, maskCode, normalizeCode } from './code-format.mjs';
import { AttemptLimiter, handleUnlockRequest, isMemberCode, kindOfCode, MAX_BODY_BYTES, mistakesInSetup, type CodeEntry, type UnlockRequest, type UnlockResponse, type UnlockSetup } from './unlock';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const MENU_ORDER = ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person', 'smart-bucket', 'full-mission'];

/** Every card and every heading, as the server sends them when nothing is hidden. */
const ALL_CARDS = SAMPLE_CATALOG.map(({ id, title, level }) => ({ id, title, level }));
const ALL_HEADINGS = EXAMPLE_LEVELS.map(({ id, title, about }) => ({ id, title, about }));

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

  test('every level has a heading, in the order of the Examples window', () => {
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => level.id),
      ['starter', 'intermediate', 'advanced'],
    );
    for (const level of EXAMPLE_LEVELS) {
      assert.deepEqual(Object.keys(level).sort(), ['about', 'id', 'title'], `${level.id}: nothing but id, title and about`);
      assert.ok(level.title.length > 3 && level.about.length > 3, level.id);
    }
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => level.title),
      ['Starter', 'Intermediate', 'Advanced'],
    );
    for (const card of SAMPLE_CATALOG) assert.ok(EXAMPLE_LEVELS.some((level) => level.id === card.level), `${card.id} stands under a heading`);
    assert.equal(ALL_LEVELS, EXAMPLE_LEVELS, 'the server hands out these headings');
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

/** Made-up codes: the first two are on the list of member codes, the third is on no list, the last two are advanced codes where a test says so. */
const CODE_A = 'FIRE-AAAA-2222';
const CODE_B = 'FIRE-BBBB-3333';
const CODE_NOT_LISTED = 'FIRE-CCCC-4444';
const CODE_ADVANCED = 'FIRE-DDDD-5555';
const CODE_ADVANCED_2 = 'FIRE-EEEE-6666';

/** One line of a list for a made-up code. */
async function entryFor(no: number, code: string): Promise<CodeEntry> {
  return { no, fingerprint: await fingerprintOf(normalizeCode(code) as string) };
}

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
  for (const word of ['examples', 'cards', 'levels', 'description', 'program', 'blocks', ...SECRETS, ...SAMPLE_CATALOG.map((card) => card.title), ...SAMPLE_CATALOG.map((card) => `"${card.id}"`), ...EXAMPLE_LEVELS.map((level) => level.title)]) {
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
    // (nothing is open to everyone and nothing is kept for advanced codes: the simplest case)
    setup = { codes, advancedCodes: [], examples: ALL_EXAMPLES, levels: ALL_LEVELS, openToEveryone: [], advancedOnly: [] };
  });

  test('no code: 200, not a member, every card to see - and no example to open while nothing is open to everyone', async () => {
    for (const body of [{}, { code: '' }, { code: '   ' }, { code: null }, { other: 'field' }, '', '  \n']) {
      const response = await handleUnlockRequest(post(body), setup);
      assert.equal(response.status, 200, JSON.stringify(body));
      assert.deepEqual(response.body, { ok: true, member: false, levels: ALL_HEADINGS, cards: ALL_CARDS, examples: [] }, JSON.stringify(body));
      assert.equal(response.headers['Cache-Control'], 'no-store');
      // a card is an id, a title and a level - never a description or a program
      for (const secret of [...SECRETS, 'description', 'program', 'blocks']) assert.ok(!JSON.stringify(response).includes(secret), secret);
    }
  });

  test('a code of the list: 200, member, all seven examples with description and program, in menu order', async () => {
    const response = await handleUnlockRequest(post({ code: CODE_A }), setup);
    assert.equal(response.status, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.ok(response.body.ok);
    assert.equal(response.body.member, true);
    assert.deepEqual(Object.keys(response.body).sort(), ['cards', 'examples', 'levels', 'member', 'ok']);
    assert.deepEqual(response.body.levels, ALL_HEADINGS);
    assert.deepEqual(response.body.cards, ALL_CARDS);
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
      assert.deepEqual(response.body, { ok: true, member: false, levels: ALL_HEADINGS, cards: ALL_CARDS, examples: [] });
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
    assert.deepEqual(open.body.cards, ALL_CARDS, 'the cards are the same: only what can be opened changes');
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
// Who sees what: a visitor, a member code, an advanced code
// =============================================================================================

describe('who sees what: a visitor, a member code and an advanced code', () => {
  const STARTERS = ['hello', 'line-follow', 'gripper-demo'];
  const FOR_MEMBERS = ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person'];
  const HIDDEN = ['smart-bucket', 'full-mission'];

  /** The owner's choice: the starters are open to everyone, the two advanced examples are for advanced codes only. */
  let setup: UnlockSetup;

  before(async () => {
    setup = {
      codes: [await entryFor(1, CODE_A), await entryFor(2, CODE_B)],
      advancedCodes: [await entryFor(1, CODE_ADVANCED), await entryFor(2, CODE_ADVANCED_2)],
      examples: ALL_EXAMPLES,
      levels: ALL_LEVELS,
      openToEveryone: STARTERS,
      advancedOnly: HIDDEN,
    };
  });

  const ask = (code: string | null, with_: Partial<UnlockSetup> = {}) => handleUnlockRequest(post(code === null ? {} : { code }), { ...setup, ...with_ });

  /** The "yes" of an answer, or a failed test. */
  function yes(response: UnlockResponse) {
    assert.equal(response.status, 200);
    assert.ok(response.body.ok);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(Object.keys(response.body).sort(), ['cards', 'examples', 'levels', 'member', 'ok'], 'the same five fields in every "yes"');
    return response.body;
  }

  const ids = (list: Array<{ id: string }>): string[] => list.map((item) => item.id);

  /** Everything that would give a hidden example away: its id, its title, its texts, its program, and the heading of a level nobody else sees. */
  function assertNothingAbout(hiddenIds: string[], response: UnlockResponse, who: string): void {
    const text = JSON.stringify(response);
    for (const example of ALL_EXAMPLES.filter((e) => hiddenIds.includes(e.id))) {
      assert.ok(!text.includes(`"${example.id}"`), `${who}: the answer does not hold the id "${example.id}"`);
      assert.ok(!text.includes(example.title), `${who}: the answer does not hold the title "${example.title}"`);
      assert.ok(!text.includes(example.description.slice(0, 60)), `${who}: the answer does not hold the description of ${example.id}`);
      assert.ok(!text.includes(JSON.stringify(example.program).slice(0, 200)), `${who}: the answer does not hold the program of ${example.id}`);
    }
    for (const level of EXAMPLE_LEVELS) {
      const shown = ALL_EXAMPLES.some((e) => e.level === level.id && !hiddenIds.includes(e.id));
      if (shown) continue;
      for (const word of [`"${level.id}"`, level.title, level.about]) assert.ok(!text.includes(word), `${who}: the answer does not hold "${word}"`);
    }
  }

  test('no code: the starters to open, the members\' cards to see - and nothing at all about the advanced examples', async () => {
    const response = await ask(null);
    const body = yes(response);
    assert.equal(body.member, false);
    assert.deepEqual(ids(body.cards), FOR_MEMBERS, 'five cards, in menu order');
    assert.deepEqual(ids(body.examples), STARTERS, 'three of them can be opened');
    assert.deepEqual(
      body.levels.map((level) => level.title),
      ['Starter', 'Intermediate'],
      'no "Advanced" heading',
    );
    for (const card of body.cards) assert.deepEqual(Object.keys(card).sort(), ['id', 'level', 'title']);
    for (const example of body.examples) assert.deepEqual(example, ALL_EXAMPLES.find((e) => e.id === example.id));
    assertNothingAbout(HIDDEN, response, 'a visitor');
    // the intermediate examples are cards only: a title, no description, no program
    for (const secret of ['Person here - other square', 'driving by distance only', 'Mission complete!', 'A complete solution', '9216', 'Smart', 'smart', 'Full mission', 'dvanced']) {
      assert.ok(!JSON.stringify(response).includes(secret), `a visitor's answer does not hold "${secret}"`);
    }
  });

  test('a member code: the five examples for members, all open - and nothing at all about the advanced examples', async () => {
    for (const code of [CODE_A, CODE_B, 'fire bbbb 3333']) {
      const response = await ask(code);
      const body = yes(response);
      assert.equal(body.member, true);
      assert.deepEqual(ids(body.cards), FOR_MEMBERS);
      assert.deepEqual(ids(body.examples), FOR_MEMBERS, 'every card can be opened');
      assert.deepEqual(
        body.levels.map((level) => level.title),
        ['Starter', 'Intermediate'],
      );
      for (const example of body.examples) assert.deepEqual(example, ALL_EXAMPLES.find((e) => e.id === example.id));
      assertNothingAbout(HIDDEN, response, 'a member');
      for (const secret of ['Mission complete!', 'A complete solution', '9216', 'Smart', 'smart', 'Full mission', 'dvanced', 'tier', 'kind', 'hidden']) {
        assert.ok(!JSON.stringify(response).includes(secret), `a member's answer does not hold "${secret}"`);
      }
    }
  });

  test('an advanced code: all seven examples, with the "Advanced" heading', async () => {
    for (const code of [CODE_ADVANCED, CODE_ADVANCED_2, ' dddd-5555 ']) {
      const body = yes(await ask(code));
      assert.equal(body.member, true);
      assert.deepEqual(ids(body.cards), MENU_ORDER);
      assert.deepEqual(ids(body.examples), MENU_ORDER);
      assert.deepEqual(body.levels, ALL_HEADINGS);
      assert.deepEqual(body.cards, ALL_CARDS);
      body.examples.forEach((example, i) => assert.deepEqual(example, { ...ALL_CARDS[i], description: ALL_EXAMPLES[i].description, program: ALL_EXAMPLES[i].program }));
    }
  });

  test('nothing in an answer says that examples were left out, or that another kind of code exists', async () => {
    // a website that simply HAS only the five examples answers a visitor and a member in exactly the same way
    const onlyFive: Partial<UnlockSetup> = { examples: ALL_EXAMPLES.filter((e) => !HIDDEN.includes(e.id)), advancedOnly: [], advancedCodes: [] };
    assert.deepEqual(await ask(null), await ask(null, onlyFive), 'a visitor');
    assert.deepEqual(await ask(CODE_A), await ask(CODE_A, onlyFive), 'a member');
    // a member's answer and an advanced answer are made of the same fields, and say "member" alike
    const member = yes(await ask(CODE_A));
    const advanced = yes(await ask(CODE_ADVANCED));
    assert.deepEqual(Object.keys(member), Object.keys(advanced));
    assert.equal(member.member, advanced.member);
    assert.deepEqual(Object.keys(member.cards[0]), Object.keys(advanced.cards[0]));
    assert.deepEqual(Object.keys(member.examples[0]), Object.keys(advanced.examples[0]));
    // and what both may open is the same, example for example
    assert.deepEqual(member.examples, advanced.examples.slice(0, 5));
  });

  test('a code on neither list: 403 and nothing else, also when it is close to an advanced code', async () => {
    const answers = new Set<string>();
    for (const code of [CODE_NOT_LISTED, 'FIRE-DDDD-5556', 'FIRE-DDDD-555', 'advanced', 'ADVANCED-DDDD-5555']) {
      const response = await ask(code);
      assert.equal(response.status, 403, code);
      assert.deepEqual(response.body, { ok: false, reason: 'invalid-code' });
      assertNoExampleData(response, code);
      answers.add(JSON.stringify(response));
    }
    assert.equal(answers.size, 1, 'one and the same answer');
  });

  test('a cancelled advanced code opens nothing any more - not even what a member code opens; the other codes still work', async () => {
    const afterCancelling: Partial<UnlockSetup> = { advancedCodes: setup.advancedCodes.filter((entry) => entry.no !== 1) };
    const cancelled = await ask(CODE_ADVANCED, afterCancelling);
    assert.equal(cancelled.status, 403);
    assertNoExampleData(cancelled, 'a cancelled advanced code');
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED_2, afterCancelling)).examples), MENU_ORDER);
    assert.deepEqual(ids(yes(await ask(CODE_A, afterCancelling)).examples), FOR_MEMBERS);
    // no advanced code at all: the advanced examples are hidden from everybody
    assert.equal((await ask(CODE_ADVANCED, { advancedCodes: [] })).status, 403);
    assertNothingAbout(HIDDEN, await ask(CODE_A, { advancedCodes: [] }), 'a member, with no advanced code on the list');
    // and a cancelled member code does not touch the advanced codes
    assert.equal((await ask(CODE_A, { codes: [] })).status, 403);
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED, { codes: [] })).examples), MENU_ORDER);
  });

  test('the two lists are told apart by the code alone: a hit on the advanced list wins', async () => {
    assert.equal(await kindOfCode(CODE_A, setup.codes, setup.advancedCodes), 'member');
    assert.equal(await kindOfCode(CODE_ADVANCED, setup.codes, setup.advancedCodes), 'advanced');
    assert.equal(await kindOfCode(CODE_NOT_LISTED, setup.codes, setup.advancedCodes), null);
    for (const notACode of ['', 'hello', null, 42, undefined]) assert.equal(await kindOfCode(notACode, setup.codes, setup.advancedCodes), null);
    // a code that is on both lists (a slip while editing) is an advanced code
    const both = [...setup.codes, await entryFor(3, CODE_ADVANCED)];
    assert.equal(await kindOfCode(CODE_ADVANCED, both, setup.advancedCodes), 'advanced');
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED, { codes: both })).examples), MENU_ORDER);
    // lines that are not a fingerprint are ignored in both lists
    const sloppy = [{ no: 1, fingerprint: '' }, { no: 2, fingerprint: 'not hex' }, { no: 3 }, null] as CodeEntry[];
    assert.equal(await kindOfCode(CODE_ADVANCED, [...sloppy, ...setup.codes], [...sloppy, ...setup.advancedCodes]), 'advanced');
    assert.equal(await kindOfCode(CODE_A, [...sloppy, ...setup.codes], [...sloppy, ...setup.advancedCodes]), 'member');
    assert.equal(await kindOfCode(CODE_NOT_LISTED, sloppy, sloppy), null);
    // looked at as ONE list, an advanced code is no member code
    assert.equal(await isMemberCode(CODE_ADVANCED, setup.codes), false);
    assert.equal(await isMemberCode(CODE_ADVANCED, setup.advancedCodes), true);
  });

  test('"examplesForAdvancedCodesOnly" empty: nothing is hidden, and an advanced code opens exactly what a member code opens', async () => {
    const nothingHidden: Partial<UnlockSetup> = { advancedOnly: [] };
    const visitor = yes(await ask(null, nothingHidden));
    assert.deepEqual(ids(visitor.cards), MENU_ORDER, 'a visitor sees all seven cards');
    assert.deepEqual(ids(visitor.examples), STARTERS);
    assert.deepEqual(visitor.levels, ALL_HEADINGS);
    const member = await ask(CODE_A, nothingHidden);
    assert.deepEqual(ids(yes(member).examples), MENU_ORDER);
    assert.deepEqual(await ask(CODE_ADVANCED, nothingHidden), member, 'the very same answer');
  });

  test('an example that is on both lists stays hidden: the stricter rule wins', async () => {
    const both: Partial<UnlockSetup> = { openToEveryone: [...STARTERS, 'full-mission'], advancedOnly: HIDDEN };
    const visitor = await ask(null, both);
    assert.deepEqual(ids(yes(visitor).cards), FOR_MEMBERS);
    assert.deepEqual(ids(yes(visitor).examples), STARTERS, '"full-mission" is not opened to everyone');
    assertNothingAbout(HIDDEN, visitor, 'a visitor');
    assertNothingAbout(HIDDEN, await ask(CODE_A, both), 'a member');
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED, both)).examples), MENU_ORDER);
    // also a starter can be hidden - then it is hidden from visitors too, whatever the other list says
    const starterHidden: Partial<UnlockSetup> = { advancedOnly: ['hello'] };
    const withoutHello = MENU_ORDER.filter((id) => id !== 'hello');
    assert.deepEqual(ids(yes(await ask(null, starterHidden)).cards), withoutHello);
    assert.deepEqual(ids(yes(await ask(null, starterHidden)).examples), ['line-follow', 'gripper-demo']);
    assert.deepEqual(ids(yes(await ask(CODE_A, starterHidden)).examples), withoutHello);
    assertNothingAbout(['hello'], await ask(null, starterHidden), 'a visitor');
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED, starterHidden)).examples), MENU_ORDER);
  });

  test('ids that do not exist, doubles and wrong capitals hide nothing', async () => {
    const sloppy: Partial<UnlockSetup> = { advancedOnly: ['no-such-example', 'FULL-MISSION', 'full mission', '', 'smart-bucket', 'smart-bucket'] };
    const visitor = yes(await ask(null, sloppy));
    assert.deepEqual(
      ids(visitor.cards),
      MENU_ORDER.filter((id) => id !== 'smart-bucket'),
      'only the id that is spelt right is hidden',
    );
    assert.deepEqual(visitor.levels, ALL_HEADINGS, '"Advanced" still has a card: the full mission');
    assert.deepEqual(
      ids(yes(await ask(CODE_A, sloppy)).examples),
      MENU_ORDER.filter((id) => id !== 'smart-bucket'),
    );
  });

  test('a line of "examplesForAdvancedCodesOnly" that is no example is a mistake that must not go live: the website refuses to be built with it', () => {
    // (answering a request, such a line hides nothing - see the test above - which is exactly why the site must not be built with one)
    assert.deepEqual(mistakesInSetup(setup), [], 'the two advanced examples: all is well');
    assert.deepEqual(mistakesInSetup({ ...setup, advancedOnly: [] }), [], 'nothing hidden is a choice, not a mistake');
    assert.deepEqual(mistakesInSetup({ ...setup, advancedOnly: MENU_ORDER }), [], 'everything hidden too');
    assert.deepEqual(mistakesInSetup({ ...setup, advancedOnly: ['full-mission', 'full-mission'] }), [], 'a line written twice hides the same example');
    for (const slip of ['smart-buckett', 'Smart-Bucket', 'smart bucket', 'smartbucket', ' full-mission', 'advanced', '']) {
      const mistakes = mistakesInSetup({ ...setup, advancedOnly: ['full-mission', slip] });
      assert.equal(mistakes.length, 1, JSON.stringify(slip));
      assert.ok(mistakes[0].includes(`'${slip}'`) && mistakes[0].includes('examplesForAdvancedCodesOnly') && mistakes[0].includes('NOT be hidden'), mistakes[0]);
      // the text names what the owner wrote, and no example: it ends up in a build log
      // (what the owner wrote is taken out first: 'smart-buckett' holds the id it was meant to be)
      const besidesTheSlip = mistakes[0].split(`'${slip}'`).join('');
      for (const example of ALL_EXAMPLES) {
        assert.ok(!mistakes[0].includes(example.title), example.title);
        if (example.id.includes('-')) assert.ok(!besidesTheSlip.includes(example.id), example.id);
      }
    }
    assert.equal(mistakesInSetup({ ...setup, advancedOnly: ['a', 'b', 'hello'] }).length, 2, 'every such line is named');
    // an example that was given a new id in the catalog, while the owner's list still has the old one
    const renamed = ALL_EXAMPLES.map((example) => (example.id === 'full-mission' ? { ...example, id: 'whole-match' } : example));
    assert.equal(mistakesInSetup({ examples: renamed, advancedOnly: HIDDEN }).length, 1);
    // a list that is no list any more (a slip that TypeScript does not always see)
    assert.equal(mistakesInSetup({ examples: ALL_EXAMPLES, advancedOnly: 'full-mission' as unknown as string[] }).length, 1);
    assert.equal(mistakesInSetup({ examples: ALL_EXAMPLES, advancedOnly: [null as unknown as string] }).length, 1);
  });

  test('a heading is sent only together with a card of its level', async () => {
    // one advanced example left for members: the heading is there, and the card is locked for a visitor
    const oneLeft = yes(await ask(null, { advancedOnly: ['full-mission'] }));
    assert.deepEqual(oneLeft.levels, ALL_HEADINGS);
    assert.ok(ids(oneLeft.cards).includes('smart-bucket') && !ids(oneLeft.examples).includes('smart-bucket'));
    // a whole level in the middle hidden: its heading is gone, the others stay in order
    const noIntermediate = yes(await ask(CODE_A, { advancedOnly: ['one-bucket', 'one-person'] }));
    assert.deepEqual(
      noIntermediate.levels.map((level) => level.id),
      ['starter', 'advanced'],
    );
    assertNothingAbout(['one-bucket', 'one-person'], await ask(CODE_A, { advancedOnly: ['one-bucket', 'one-person'] }), 'a member');
  });

  test('every example for advanced codes only: a visitor and a member get an honest, empty answer', async () => {
    const all: Partial<UnlockSetup> = { advancedOnly: MENU_ORDER };
    assert.deepEqual((await ask(null, all)).body, { ok: true, member: false, levels: [], cards: [], examples: [] });
    assert.deepEqual((await ask(CODE_A, all)).body, { ok: true, member: true, levels: [], cards: [], examples: [] });
    assert.deepEqual(ids(yes(await ask(CODE_ADVANCED, all)).examples), MENU_ORDER);
    // and with no example at all on the website, everybody does
    assert.deepEqual((await ask(CODE_ADVANCED, { examples: [] })).body, { ok: true, member: true, levels: [], cards: [], examples: [] });
  });

  test('an advanced code is a right code for the courtesy limit: it never counts, and it waits its turn like any other', async () => {
    const limiter = new AttemptLimiter(2, 60_000, 5000, 1_000);
    let clock = 1_000;
    const from = (code: string) => handleUnlockRequest(post({ code }, 'school'), { ...setup, limiter, now: () => clock });
    for (let i = 0; i < 12; i++) assert.equal((await from(CODE_ADVANCED)).status, 200);
    assert.equal((limiter as unknown as { clients: Map<string, unknown> }).clients.size, 0, 'nothing is remembered about this address');
    for (let i = 0; i < 3; i++) assert.equal((await from(CODE_NOT_LISTED)).status, 403);
    // over the limit: nothing is looked at until the second is over - not a member code, not an advanced code
    for (const code of [CODE_ADVANCED, CODE_A]) {
      const waiting = await from(code);
      assert.equal(waiting.status, 429);
      assertNoExampleData(waiting, 'a right code that was not looked at');
    }
    clock = 2_000;
    assert.deepEqual(ids(yes(await from(CODE_ADVANCED)).examples), MENU_ORDER);
    assert.deepEqual(ids(yes(await from(CODE_A)).examples), FOR_MEMBERS, 'the advanced code did not use the turn up');
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
      advancedCodes: [],
      examples: ALL_EXAMPLES,
      levels: ALL_LEVELS,
      openToEveryone: [],
      advancedOnly: [],
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
  const exampleIds = SAMPLE_CATALOG.map((card) => card.id);

  for (const [name, codes, next] of [
    ['simulatorCodes (the member codes)', simulatorCodes, nextSimulatorCodeNumber],
    ['advancedSimulatorCodes (the advanced codes)', advancedSimulatorCodes, nextAdvancedSimulatorCodeNumber],
  ] as const) {
    test(`${name}: every line is a number and a fingerprint; no number and no fingerprint twice`, () => {
      assert.ok(Array.isArray(codes));
      for (const entry of codes) {
        assert.ok(Number.isInteger(entry.no) && entry.no >= 1, `number ${entry.no}`);
        assert.match(entry.fingerprint, FINGERPRINT_PATTERN, `the fingerprint of number ${entry.no}`);
      }
      assert.equal(new Set(codes.map((entry) => entry.no)).size, codes.length, 'no number twice');
      assert.equal(new Set(codes.map((entry) => entry.fingerprint)).size, codes.length, 'no fingerprint twice');
      const highest = Math.max(0, ...codes.map((entry) => entry.no));
      assert.ok(Number.isInteger(next) && next > highest, 'the next number is above every number on the list');
    });
  }

  test('no code is on both lists: a member code is not an advanced code as well', () => {
    const advanced = new Map(advancedSimulatorCodes.map((entry) => [entry.fingerprint, entry.no]));
    const onBoth = simulatorCodes.filter((entry) => advanced.has(entry.fingerprint)).map((entry) => `member code ${entry.no} = advanced code A${advanced.get(entry.fingerprint)}`);
    assert.deepEqual(onBoth, [], 'a line was copied from one list to the other: take it out of one of them');
  });

  test('the script can read the file, and sees the same two lists', () => {
    for (const [kind, codes, next] of [
      ['member', simulatorCodes, nextSimulatorCodeNumber],
      ['advanced', advancedSimulatorCodes, nextAdvancedSimulatorCodeNumber],
    ] as const) {
      const info = readListFile(text, kind);
      assert.ok(info, `the list of ${kind} codes has the shape the script writes`);
      assert.equal(info.active, codes.length, kind);
      assert.equal(info.nextNumber, next, kind);
      for (const entry of codes) assert.ok(info.fingerprints.has(entry.fingerprint));
    }
    // the two lists are two different places in the file
    const member = readListFile(text, 'member');
    const advanced = readListFile(text, 'advanced');
    assert.ok(member && advanced && (member.listTo <= advanced.listFrom || advanced.listTo <= member.listFrom));
  });

  test('every line of the advanced list ends with its number as the CSV file writes it ("// A7"), so that it is not mistaken for a member code', () => {
    const info = readListFile(text, 'advanced');
    assert.ok(info);
    const lines = text
      .slice(info.listFrom, info.listTo)
      .split('\n')
      .filter((line) => line.includes('fingerprint'));
    for (const line of lines) {
      const no = /\{ no: (\d+),/.exec(line)?.[1];
      assert.ok(no && line.trimEnd().endsWith(`// A${no}`), `the line of advanced code A${no} ends with "// A${no}"`);
    }
  });

  test('examplesOpenToEveryone and examplesForAdvancedCodesOnly name only examples that exist', () => {
    for (const [name, list] of [
      ['examplesOpenToEveryone', examplesOpenToEveryone],
      ['examplesForAdvancedCodesOnly', examplesForAdvancedCodesOnly],
    ] as const) {
      assert.ok(Array.isArray(list), name);
      for (const id of list) {
        assert.ok(exampleIds.includes(id), `${name}: "${id}" is not an example, so this line does nothing. The ids are: ${exampleIds.join(', ')}`);
      }
      assert.equal(new Set(list).size, list.length, `${name}: no id twice`);
    }
  });

  test('no example is on both lists: open to everyone AND for advanced codes only', () => {
    const onBoth = examplesOpenToEveryone.filter((id) => examplesForAdvancedCodesOnly.includes(id));
    assert.deepEqual(
      onBoth,
      [],
      `\n\n${onBoth.map((id) => `'${id}'`).join(', ')} ${onBoth.length === 1 ? 'is' : 'are'} on "examplesOpenToEveryone" and on "examplesForAdvancedCodesOnly".\n` +
        'The stricter rule wins - the example is hidden from everybody without an advanced code - but one of the two lines is a mistake.\n' +
        'Take the id out of one of the two lists in content/simulator-codes.ts.\n',
    );
  });

  test('with the owner\'s lists, an example for advanced codes only is in no answer but the one to an advanced code', async () => {
    const setup: UnlockSetup = {
      codes: [await entryFor(1, CODE_A)],
      advancedCodes: [await entryFor(1, CODE_ADVANCED)],
      examples: ALL_EXAMPLES,
      levels: ALL_LEVELS,
      openToEveryone: examplesOpenToEveryone,
      advancedOnly: examplesForAdvancedCodesOnly,
    };
    const hidden = ALL_EXAMPLES.filter((example) => examplesForAdvancedCodesOnly.includes(example.id));
    const shown = ALL_EXAMPLES.filter((example) => !examplesForAdvancedCodesOnly.includes(example.id));
    for (const [who, code] of [
      ['a visitor', null],
      ['a member', CODE_A],
    ] as const) {
      const response = await handleUnlockRequest(post(code === null ? {} : { code }), setup);
      assert.ok(response.body.ok, who);
      assert.deepEqual(
        response.body.cards.map((card) => card.id),
        shown.map((example) => example.id),
        `${who} sees the examples that are not for advanced codes only`,
      );
      const answer = JSON.stringify(response);
      for (const example of hidden) {
        for (const secret of [`"${example.id}"`, example.title, example.description.slice(0, 60)]) {
          assert.ok(!answer.includes(secret), `${who}: the answer does not hold ${secret}`);
        }
      }
      // every card stands under a heading, and no heading stands alone
      assert.deepEqual(
        response.body.levels.map((level) => level.id),
        EXAMPLE_LEVELS.map((level) => level.id).filter((id) => shown.some((example) => example.level === id)),
        who,
      );
      // a visitor can open exactly what is open to everyone, a member every card
      assert.deepEqual(
        response.body.examples.map((example) => example.id),
        shown.filter((example) => code !== null || examplesOpenToEveryone.includes(example.id)).map((example) => example.id),
        who,
      );
    }
    const advanced = await handleUnlockRequest(post({ code: CODE_ADVANCED }), setup);
    assert.ok(advanced.body.ok);
    assert.deepEqual(
      advanced.body.examples.map((example) => example.id),
      MENU_ORDER,
      'an advanced code opens every example',
    );
  });

  test('there is no code in the file - only the made-up one that shows what a code looks like', () => {
    const found = text.match(/FIRE[- ]?[2-9A-Z]{4}[- ]?[2-9A-Z]{4}/g) ?? [];
    assert.deepEqual([...new Set(found)], [CODE_EXAMPLE]);
  });

  test('the made-up code of the texts is neither a member code nor an advanced code', async () => {
    assert.equal(await kindOfCode(CODE_EXAMPLE, simulatorCodes, advancedSimulatorCodes), null);
  });
});

// =============================================================================================
// The address itself
// =============================================================================================

describe('src/app/api/simulator/unlock/route.ts, with the owner\'s lists', () => {
  const ask = (body: string, contentType: string | null = 'application/json'): Promise<Response> =>
    routePost(new Request('http://localhost/api/simulator/unlock', { method: 'POST', headers: contentType === null ? {} : { 'Content-Type': contentType }, body }));

  test('no code: the cards and the examples the owner\'s two lists allow - and not a word about an example for advanced codes only', async () => {
    const response = await ask('{}');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const text = await response.text();
    const body = JSON.parse(text) as { ok: boolean; member: boolean; levels: Array<{ id: string }>; cards: Array<{ id: string }>; examples: Array<{ id: string }> };
    assert.deepEqual(Object.keys(body).sort(), ['cards', 'examples', 'levels', 'member', 'ok']);
    assert.equal(body.ok, true);
    assert.equal(body.member, false);
    const shown = MENU_ORDER.filter((id) => !examplesForAdvancedCodesOnly.includes(id));
    assert.deepEqual(
      body.cards.map((card) => card.id),
      shown,
      'every example that is not on "examplesForAdvancedCodesOnly"',
    );
    assert.deepEqual(
      body.examples.map((example) => example.id),
      shown.filter((id) => examplesOpenToEveryone.includes(id)),
      'to open: the ones on "examplesOpenToEveryone"',
    );
    for (const example of ALL_EXAMPLES.filter((e) => examplesForAdvancedCodesOnly.includes(e.id))) {
      for (const secret of [`"${example.id}"`, example.title, example.description.slice(0, 60)]) assert.ok(!text.includes(secret), `the answer does not hold ${secret}`);
    }
  });

  test('a code that is on no list, and what is not such a request, are refused as before', async () => {
    const wrong = await ask(JSON.stringify({ code: CODE_EXAMPLE }));
    assert.equal(wrong.status, 403);
    assert.equal(wrong.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await wrong.json(), { ok: false, reason: 'invalid-code' });
    assert.equal((await ask('garbage')).status, 400);
    assert.equal((await ask(JSON.stringify({ code: CODE_EXAMPLE }), 'text/plain')).status, 415);
    assert.equal((await ask(JSON.stringify({ code: CODE_EXAMPLE, padding: 'x'.repeat(MAX_BODY_BYTES) }))).status, 413);
    const get = await routeGet(new Request('http://localhost/api/simulator/unlock'));
    assert.equal(get.status, 405);
    assert.equal(get.headers.get('Allow'), 'POST');
    assert.deepEqual(await get.json(), { ok: false, reason: 'method-not-allowed' });
  });

  test('the website is not built while "examplesForAdvancedCodesOnly" names something that is no example', () => {
    // the owner's lists as they are: nothing to complain about (or this very file could not have been loaded)
    assert.deepEqual(mistakesInSetup({ examples: ALL_EXAMPLES, advancedOnly: examplesForAdvancedCodesOnly }), []);
    // the route asks once, where the file is loaded - that is: while the site is built - and stops there
    const source = readFileSync(path.join(REPO_ROOT, 'src/app/api/simulator/unlock/route.ts'), 'utf8');
    const check = source.indexOf('\nconst mistakes = mistakesInSetup(SETUP);\nif (mistakes.length > 0) throw new Error(');
    assert.ok(check > 0, 'route.ts checks the owner\'s lists and throws');
    assert.ok(check > source.indexOf('\nconst SETUP: UnlockSetup = {') && check < source.indexOf('\nexport async function POST('), 'outside every function, so that it runs when the site is built');
  });

  test('each of the owner\'s four lists is handed to the place it belongs to', () => {
    // (the plain codes are not in the repository, so the two lists of codes cannot be tried out here: this reads the file instead)
    const source = readFileSync(path.join(REPO_ROOT, 'src/app/api/simulator/unlock/route.ts'), 'utf8');
    for (const line of [
      'codes: simulatorCodes,',
      'advancedCodes: advancedSimulatorCodes,',
      'examples: ALL_EXAMPLES,',
      'levels: ALL_LEVELS,',
      'openToEveryone: examplesOpenToEveryone,',
      'advancedOnly: examplesForAdvancedCodesOnly,',
    ]) {
      assert.equal(source.split(`\n  ${line}\n`).length, 2, `route.ts says "${line}" once`);
    }
  });
});

// =============================================================================================
// The script that makes new codes
// =============================================================================================

type ListKind = 'member' | 'advanced';

/** The lines of one list of a list file that count (not the cancelled ones). */
function entriesOf(listText: string, kind: ListKind = 'member'): CodeEntry[] {
  const info = readListFile(listText, kind);
  assert.ok(info, `the file has a list of ${kind} codes`);
  const entries: CodeEntry[] = [];
  for (const line of listText.slice(info.listFrom, info.listTo).split('\n')) {
    // (a line of the advanced list ends with its number as the CSV file writes it)
    const match = kind === 'member' ? /^ {2}\{ no: (\d+), fingerprint: '([0-9a-f]{64})' \},$/.exec(line) : /^ {2}\{ no: (\d+), fingerprint: '([0-9a-f]{64})' \}, \/\/ A(\d+)$/.exec(line);
    if (!match) continue;
    if (kind === 'advanced') assert.equal(match[3], match[1], 'the number at the end of the line is the number of the line');
    entries.push({ no: Number(match[1]), fingerprint: match[2] });
  }
  return entries;
}

/** The lines of one list exactly as they stand in the file. */
function linesOf(listText: string, kind: ListKind): string {
  const info = readListFile(listText, kind);
  assert.ok(info);
  return listText.slice(info.listFrom, info.listTo);
}

/** The rows of a CSV file written by the script. `label` is the number as it is written ("12", "A12"), `no` the number in it. */
function rowsOf(csv: string): Array<{ no: number; label: string; code: string; givenTo: string }> {
  const [header, ...lines] = csv.split('\r\n').filter((line) => line !== '');
  assert.equal(header, 'No,Code,Given to');
  return lines.map((line) => {
    const [label, code, givenTo] = line.split(',');
    return { no: Number(label.replace(/^A/, '')), label, code, givenTo };
  });
}

/** Everything in a list file except the lines of the two lists and the two next numbers. */
function restOf(listText: string): string {
  return emptyListFile(emptyListFile(listText, 'member'), 'advanced');
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
    assert.deepEqual(
      rows.map((row) => row.label),
      ['1', '2', '3'],
      'member codes are numbered with plain numbers',
    );
    assert.match(printed.join('\n'), /Making 3 member codes/);
    assert.match(printed.join('\n'), /Done: 3 new member codes, numbers 1 to 3\./);
    assert.doesNotMatch(printed.join('\n'), /new advanced code/);

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
    const setup: UnlockSetup = { codes: entries, advancedCodes: [], examples: ALL_EXAMPLES, levels: ALL_LEVELS, openToEveryone: [], advancedOnly: [] };
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
      "export const examplesOpenToEveryone: string[] = [\n  // (empty: every example needs a code)\n];",
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
    assert.match(fresh, /export const examplesOpenToEveryone: string\[\] = \[\n {2}\/\/ \(empty: every example needs a code\)\n\];/);
    // a new file keeps the advanced examples for advanced codes: starting over never shows them to everybody
    assert.match(fresh, /export const examplesForAdvancedCodesOnly: string\[\] = \[\n {2}\/\/ the two advanced examples\n {2}'smart-bucket',\n {2}'full-mission',\n\];/);
    assert.deepEqual(readListFile(fresh, 'advanced')?.active, 0);
    assert.equal(readListFile(fresh, 'advanced')?.nextNumber, 1);
    for (const id of MENU_ORDER) assert.ok(fresh.includes(`'${id}'`), `the explanation lists '${id}'`);
    const fingerprint = 'ab'.repeat(32);
    const added = addToListFile(fresh, [{ no: 1, fingerprint }]);
    assert.deepEqual(entriesOf(added), [{ no: 1, fingerprint }]);
    assert.deepEqual(entriesOf(added, 'advanced'), [], 'the other list is not touched');
    assert.equal(emptyListFile(added), fresh);
    assert.equal(readListFile('nothing of the kind'), null);
    // the same for the advanced list, whose lines end with "// A<number>"
    const other = 'cd'.repeat(32);
    const both = addToListFile(added, [{ no: 7, fingerprint: other }], 'advanced');
    assert.ok(both.includes(`  { no: 7, fingerprint: '${other}' }, // A7\n`));
    assert.deepEqual(entriesOf(both, 'advanced'), [{ no: 7, fingerprint: other }]);
    assert.deepEqual(entriesOf(both), [{ no: 1, fingerprint }], 'the member list is not touched');
    assert.equal(readListFile(both, 'advanced')?.nextNumber, 8);
    assert.equal(readListFile(both, 'member')?.nextNumber, 2);
    assert.equal(emptyListFile(both, 'advanced'), added);
    assert.equal(emptyListFile(emptyListFile(both, 'member'), 'advanced'), fresh);
    assert.equal(readListFile('nothing of the kind', 'advanced'), null);
  });

  // ------------------------------------------------------------------------------------------
  // Advanced codes (--advanced)
  // ------------------------------------------------------------------------------------------

  test('--advanced: a CSV file numbered A1, A2, A3, lines in the advanced list only - and the server takes the codes as advanced codes', async () => {
    const before = readFileSync(list, 'utf8');
    printed.length = 0;
    const csv = path.join(folder, 'advanced-first.csv');
    await run('--advanced', '--count', '3', '--out', csv);

    const rows = rowsOf(readFileSync(csv, 'utf8'));
    assert.deepEqual(
      rows.map((row) => row.label),
      ['A1', 'A2', 'A3'],
      'advanced codes are numbered with an A in front',
    );
    for (const row of rows) {
      assert.match(row.code, /^FIRE-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/, 'the same shape as a member code');
      assert.equal(row.givenTo, '');
    }

    // the screen says which kind was made, and shows no code
    const screen = printed.join('\n');
    assert.match(screen, /Making 3 advanced codes/);
    assert.match(screen, /Done: 3 new advanced codes, numbers A1 to A3\./);
    assert.match(screen, /3 advanced codes on the list now/);
    assert.doesNotMatch(screen, /new member code/);
    assert.ok(!/FIRE-[2-9A-Z]{4}-[2-9A-Z]{4}/.test(screen), 'nothing that looks like a code');

    // only the advanced list changed
    const listText = readFileSync(list, 'utf8');
    const advanced = entriesOf(listText, 'advanced');
    assert.deepEqual(
      advanced.map((entry) => entry.no),
      [1, 2, 3],
    );
    assert.equal(readListFile(listText, 'advanced')?.nextNumber, 4);
    assert.equal(linesOf(listText, 'member'), linesOf(before, 'member'), 'not one line of the member list changed');
    assert.equal(readListFile(listText, 'member')?.nextNumber, readListFile(before, 'member')?.nextNumber);
    assert.equal(restOf(listText), restOf(before), 'nothing but the advanced list and its next number changed');
    assert.equal(emptyListFile(listText, 'advanced'), emptyListFile(before, 'advanced'));
    for (const row of rows) assert.ok(!listText.includes(row.code) && !listText.includes(normalizeCode(row.code) as string), 'the list holds no code');

    // the fingerprints are the server's, and the server tells the two kinds apart
    const members = entriesOf(listText, 'member');
    assert.ok(members.length > 0);
    for (const row of rows) {
      assert.equal(advanced[row.no - 1].fingerprint, await fingerprintOf(normalizeCode(row.code) as string), row.label);
      assert.equal(await kindOfCode(row.code, members, advanced), 'advanced', row.label);
    }
    const setup: UnlockSetup = { codes: members, advancedCodes: advanced, examples: ALL_EXAMPLES, levels: ALL_LEVELS, openToEveryone: ['hello'], advancedOnly: ['smart-bucket', 'full-mission'] };
    const opened = await handleUnlockRequest(post({ code: rows[0].code }), setup);
    assert.ok(opened.body.ok && opened.body.member && opened.body.examples.length === 7 && opened.body.cards.length === 7);
    // a member code of the same file opens five, and sees five
    const memberCode = rowsOf(readFileSync(path.join(folder, 'loud.csv'), 'utf8'))[0].code;
    assert.equal(await kindOfCode(memberCode, members, advanced), 'member');
    const member = await handleUnlockRequest(post({ code: memberCode }), setup);
    assert.ok(member.body.ok && member.body.member && member.body.examples.length === 5 && member.body.cards.length === 5);
  });

  test('--advanced: more codes are numbered on, also after a line was cancelled; --print-codes shows them with their A', async () => {
    const edited = readFileSync(list, 'utf8').replace(/^  (\{ no: 2, .* \/\/ A2)$/m, '  // $1');
    assert.ok(edited.includes("  // { no: 2, fingerprint: '"));
    writeFileSync(list, edited);
    assert.deepEqual(
      entriesOf(edited, 'advanced').map((entry) => entry.no),
      [1, 3],
    );

    printed.length = 0;
    const csv = path.join(folder, 'advanced-second.csv');
    await run('--advanced', '--count', '1', '--print-codes', '--out', csv);
    const rows = rowsOf(readFileSync(csv, 'utf8'));
    assert.deepEqual(
      rows.map((row) => row.label),
      ['A4'],
    );
    const listText = readFileSync(list, 'utf8');
    assert.deepEqual(
      entriesOf(listText, 'advanced').map((entry) => entry.no),
      [1, 3, 4],
    );
    assert.ok(/^ {2}\/\/ \{ no: 2, fingerprint: '[0-9a-f]{64}' \}, \/\/ A2$/m.test(listText), 'the cancelled line is still there, still cancelled');
    assert.equal(linesOf(listText, 'member'), linesOf(edited, 'member'));
    assert.match(printed.join('\n'), /Done: 1 new advanced code, number A4\./);
    assert.ok(printed.some((line) => /^ {2}A4 +FIRE-/.test(line) && line.includes(rows[0].code)), 'shown with its number A4');
    // the cancelled code is no code any more, the others are advanced codes
    const first = rowsOf(readFileSync(path.join(folder, 'advanced-first.csv'), 'utf8'));
    const advanced = entriesOf(listText, 'advanced');
    assert.equal(await kindOfCode(first[1].code, entriesOf(listText), advanced), null, 'A2 was cancelled');
    assert.equal(await kindOfCode(first[2].code, entriesOf(listText), advanced), 'advanced');
    assert.equal(await kindOfCode(rows[0].code, entriesOf(listText), advanced), 'advanced');
  });

  test('--replace empties ONLY the list it is aimed at: with --advanced the advanced codes, without it the member codes', async () => {
    const before = readFileSync(list, 'utf8');
    const memberLines = linesOf(before, 'member');
    assert.ok(entriesOf(before).length > 0 && entriesOf(before, 'advanced').length > 0);

    // ---- the advanced list
    printed.length = 0;
    await run('--advanced', '--replace', '--count', '2', '--out', path.join(folder, 'advanced-third.csv'));
    const afterAdvanced = readFileSync(list, 'utf8');
    const rows = rowsOf(readFileSync(path.join(folder, 'advanced-third.csv'), 'utf8'));
    assert.deepEqual(
      rows.map((row) => row.label),
      ['A1', 'A2'],
      'the advanced numbers start again at A1',
    );
    assert.deepEqual(
      entriesOf(afterAdvanced, 'advanced').map((entry) => entry.no),
      [1, 2],
    );
    assert.ok(!afterAdvanced.includes('// { no: 2, fingerprint:'), 'the cancelled advanced line is gone too');
    assert.equal(linesOf(afterAdvanced, 'member'), memberLines, 'not one line of the member list changed');
    assert.equal(readListFile(afterAdvanced, 'member')?.nextNumber, readListFile(before, 'member')?.nextNumber);
    assert.equal(restOf(afterAdvanced), restOf(before));
    assert.match(printed.join('\n'), /The list of advanced codes was started again/);
    const oldAdvanced = [...rowsOf(readFileSync(path.join(folder, 'advanced-first.csv'), 'utf8')), ...rowsOf(readFileSync(path.join(folder, 'advanced-second.csv'), 'utf8'))];
    for (const row of oldAdvanced) assert.equal(await kindOfCode(row.code, entriesOf(afterAdvanced), entriesOf(afterAdvanced, 'advanced')), null, `old advanced code ${row.label}`);
    for (const row of rows) assert.equal(await kindOfCode(row.code, entriesOf(afterAdvanced), entriesOf(afterAdvanced, 'advanced')), 'advanced');

    // ---- the member list
    printed.length = 0;
    const advancedLines = linesOf(afterAdvanced, 'advanced');
    await run('--replace', '--count', '2', '--out', path.join(folder, 'member-again.csv'));
    const afterMember = readFileSync(list, 'utf8');
    assert.deepEqual(
      entriesOf(afterMember).map((entry) => entry.no),
      [1, 2],
    );
    assert.equal(linesOf(afterMember, 'advanced'), advancedLines, 'not one line of the advanced list changed');
    assert.equal(readListFile(afterMember, 'advanced')?.nextNumber, 3);
    assert.equal(restOf(afterMember), restOf(before));
    assert.match(printed.join('\n'), /The list of member codes was started again/);
    for (const row of rows) assert.equal(await kindOfCode(row.code, entriesOf(afterMember), entriesOf(afterMember, 'advanced')), 'advanced', 'the advanced codes still work');
  });

  test('a new code is never one that is on either list already: it is thrown away and drawn again', async () => {
    const onMemberList = 'MEMBER22';
    const onAdvancedList = 'ADVANCE2';
    const fresh = ['FRESH222', 'FRESH333'];
    const taken = new Set([await fingerprintOf(onMemberList), await fingerprintOf(onAdvancedList)]);
    // (the 8 characters of the made-up code of the texts are never handed out either)
    const drawn = [onMemberList, onAdvancedList, normalizeCode(CODE_EXAMPLE) as string, fresh[0], fresh[0], onMemberList, fresh[1]];
    let draws = 0;
    const made = await makeCodes(2, 41, taken, undefined, () => drawn[draws++]);
    assert.deepEqual(
      made.map((code: { code: string }) => code.code),
      fresh.map((characters) => formatCode(characters)),
    );
    assert.deepEqual(
      made.map((code: { no: number }) => code.no),
      [41, 42],
      'the numbers have no gaps',
    );
    assert.equal(draws, drawn.length);

    // ---- the script itself looks at BOTH lists, whichever kind it makes
    const aMemberCode = normalizeCode(rowsOf(readFileSync(path.join(folder, 'member-again.csv'), 'utf8'))[0].code) as string;
    const anAdvancedCode = normalizeCode(rowsOf(readFileSync(path.join(folder, 'advanced-third.csv'), 'utf8'))[0].code) as string;
    const drawing = (characters: string[]) => {
      let next = 0;
      return () => characters[next++];
    };
    const onlyCodeOf = (file: string): string => {
      const rows = rowsOf(readFileSync(path.join(folder, file), 'utf8'));
      assert.equal(rows.length, 1);
      return rows[0].code;
    };
    // an advanced code that would be a member code as well is drawn again ...
    await generateCodes(['--list', list, '--advanced', '--count', '1', '--out', path.join(folder, 'no-double-1.csv')], print, drawing([aMemberCode, anAdvancedCode, 'FRESH444']));
    assert.equal(onlyCodeOf('no-double-1.csv'), 'FIRE-FRES-H444');
    // ... and so is a member code that would be an advanced code as well
    await generateCodes(['--list', list, '--count', '1', '--out', path.join(folder, 'no-double-2.csv')], print, drawing([anAdvancedCode, aMemberCode, 'FRESH555']));
    assert.equal(onlyCodeOf('no-double-2.csv'), 'FIRE-FRES-H555');
    // --replace does not hand out again a code of the list it empties
    await generateCodes(['--list', list, '--advanced', '--replace', '--count', '1', '--out', path.join(folder, 'no-double-3.csv')], print, drawing([anAdvancedCode, aMemberCode, 'FRESH666']));
    assert.equal(onlyCodeOf('no-double-3.csv'), 'FIRE-FRES-H666');

    const listText = readFileSync(list, 'utf8');
    const all = [...entriesOf(listText), ...entriesOf(listText, 'advanced')].map((entry) => entry.fingerprint);
    assert.equal(new Set(all).size, all.length, 'no fingerprint is on both lists of the file');
    assert.equal(await kindOfCode('FIRE-FRES-H555', entriesOf(listText), entriesOf(listText, 'advanced')), 'member');
    assert.equal(await kindOfCode('FIRE-FRES-H666', entriesOf(listText), entriesOf(listText, 'advanced')), 'advanced');
    assert.equal(await kindOfCode('FIRE-FRES-H444', entriesOf(listText), entriesOf(listText, 'advanced')), null, 'A3 went with the list that was started again');
  });

  test('--advanced needs a file with a list of advanced codes; without --advanced an older file with one list still works', async () => {
    // a list file from before there were advanced codes: the member list and its next number only
    const older = path.join(folder, 'older.ts');
    const olderText = "export const examplesOpenToEveryone: string[] = [\n];\n\nexport const simulatorCodes: { no: number; fingerprint: string }[] = [\n];\n\nexport const nextSimulatorCodeNumber = 1;\n";
    writeFileSync(older, olderText);
    await assert.rejects(generateCodes(['--list', older, '--advanced', '--count', '1', '--out', path.join(folder, 'z.csv')], print), /list of advanced codes .* is missing or damaged/s);
    await assert.rejects(generateCodes(['--list', older, '--advanced', '--replace', '--count', '1', '--out', path.join(folder, 'z.csv')], print), /list of advanced codes/);
    assert.equal(readFileSync(older, 'utf8'), olderText, 'nothing was changed');
    assert.ok(!existsSync(path.join(folder, 'z.csv')), 'and no CSV file was written');

    await generateCodes(['--list', older, '--count', '1', '--out', path.join(folder, 'older.csv')], print);
    assert.deepEqual(
      entriesOf(readFileSync(older, 'utf8')).map((entry) => entry.no),
      [1],
    );
  });

  test('advanced codes obey the same safety rules: outside the repository only, and never over an existing file', async () => {
    const before = readFileSync(list, 'utf8');
    const inside = path.join(REPO_ROOT, 'content', 'advanced-codes.csv');
    assert.ok(!existsSync(inside));
    await assert.rejects(run('--advanced', '--count', '1', '--out', inside), /inside the website's folder/);
    assert.ok(!existsSync(inside));
    await assert.rejects(run('--advanced', '--count', '1', '--out', path.join(folder, 'advanced-first.csv')), /already exists/);
    await assert.rejects(run('--advanced', '--count', '1', '--out', path.join(folder, 'first.csv')), /already exists/, 'not over a file of member codes either');
    await assert.rejects(run('--advanced', '--count', '0', '--out', path.join(folder, 'w.csv')), /whole number/);
    await assert.rejects(run('--advanced', '--out', path.join(folder, 'w.csv')), /how many codes and where/);
    assert.ok(!existsSync(path.join(folder, 'w.csv')));
    assert.equal(readFileSync(list, 'utf8'), before);
  });

  // ------------------------------------------------------------------------------------------
  // A list file that was damaged by a slip while editing
  // ------------------------------------------------------------------------------------------

  /** A list file with two member codes and two advanced codes (made-up fingerprints). */
  const twoAndTwo = (): string => {
    const members = addToListFile(freshListFile(), [
      { no: 1, fingerprint: '1a'.repeat(32) },
      { no: 2, fingerprint: '2b'.repeat(32) },
    ]);
    return addToListFile(
      members,
      [
        { no: 1, fingerprint: '3c'.repeat(32) },
        { no: 2, fingerprint: '4d'.repeat(32) },
      ],
      'advanced',
    );
  };
  /** The same file with the line that closes the list of member codes ("];") written differently. */
  const withMemberListClosedBy = (closing: string): string => {
    const good = twoAndTwo();
    const info = readListFile(good, 'member');
    assert.ok(info && good.slice(info.listTo, info.listTo + 3) === '\n];');
    return `${good.slice(0, info.listTo)}${closing}${good.slice(info.listTo + 3)}`;
  };

  test('a list is never read on into the next one: with a damaged "];" a member code cannot end up among the advanced codes', async () => {
    const good = twoAndTwo();
    const advancedLines = linesOf(good, 'advanced');

    // ---- slips after which the file still builds: a blank in front of "];", a lost ";", a remark behind it
    let nth = 0;
    for (const closing of ['\n  ];', '\n]', '\n ] ;', '\n]; // end of the member codes']) {
      const damaged = withMemberListClosedBy(closing);
      const file = path.join(folder, `slip-${++nth}.ts`);
      writeFileSync(file, damaged);
      // the two lists are still two places in the file
      const member = readListFile(damaged, 'member');
      const advanced = readListFile(damaged, 'advanced');
      assert.ok(member && advanced && member.listTo < advanced.listFrom, JSON.stringify(closing));
      assert.equal(member.active, 2, 'the member list holds its two codes, not the advanced ones as well');
      assert.equal(member.fingerprints.size, 2);

      // a new member code goes into the member list ...
      const csv = path.join(folder, `slip-${nth}.csv`);
      await generateCodes(['--list', file, '--count', '1', '--out', csv], print);
      const now = readFileSync(file, 'utf8');
      const code = rowsOf(readFileSync(csv, 'utf8'))[0].code;
      assert.equal(linesOf(now, 'advanced'), advancedLines, `${JSON.stringify(closing)}: not one line of the advanced list changed`);
      assert.equal(readListFile(now, 'advanced')?.active, 2);
      assert.equal(readListFile(now, 'member')?.active, 3);
      assert.ok(linesOf(now, 'member').includes(await fingerprintOf(normalizeCode(code) as string)), 'the new line is in the member list');
      assert.ok(!linesOf(now, 'advanced').includes(await fingerprintOf(normalizeCode(code) as string)));
      // ... and --replace empties the member list only
      await generateCodes(['--list', file, '--replace', '--count', '1', '--out', path.join(folder, `slip-${nth}-again.csv`)], print);
      const replaced = readFileSync(file, 'utf8');
      assert.equal(linesOf(replaced, 'advanced'), advancedLines, `${JSON.stringify(closing)}: --replace left the advanced list alone`);
      assert.equal(readListFile(replaced, 'member')?.active, 1);
      assert.equal(readListFile(replaced, 'advanced')?.nextNumber, 3);
    }

    // ---- slips the script cannot make sense of: it refuses, and writes nothing at all
    const unreadable: Array<[string, string]> = [
      ['the closing line is gone', withMemberListClosedBy('')],
      ['the closing line is a wrong bracket', withMemberListClosedBy('\n}')],
      ['a line that is no code stands in the list', good.replace(/^( {2}\{ no: 2, fingerprint: '2b.*)$/m, '$1\n  somebody@example.com')],
      ['a line of the list lost its quotes', good.replace(`'${'2b'.repeat(32)}'`, `"${'2b'.repeat(32)}"`)],
      ['a line of the list lost its end', good.replace(/^( {2}\{ no: 2, fingerprint: '2b[0-9a-f]+)' \},$/m, '$1')],
      ['two lists of member codes', `${good}\nexport const simulatorCodes: { no: number; fingerprint: string }[] = [\n];\n`],
      ['the list was put on one line', good.replace(/(export const simulatorCodes: .* = \[)\n[^]*?\n\];/, '$1];')],
    ];
    for (const [what, damaged] of unreadable) {
      assert.notEqual(damaged, good, what);
      assert.equal(readListFile(damaged, 'member'), null, what);
      const file = path.join(folder, `unreadable-${++nth}.ts`);
      const csv = path.join(folder, `unreadable-${nth}.csv`);
      for (const extra of [[], ['--replace'], ['--advanced'], ['--advanced', '--replace']]) {
        writeFileSync(file, damaged);
        await assert.rejects(generateCodes(['--list', file, '--count', '1', '--out', csv, ...extra], print), /does not look like the list/, `${what} ${extra.join(' ')}`);
        assert.equal(readFileSync(file, 'utf8'), damaged, `${what}: the file was left alone`);
        assert.ok(!existsSync(csv), `${what}: no CSV file was written`);
      }
    }
  });

  test('a damaged list of advanced codes stops the script too - also when member codes are asked for', async () => {
    const good = twoAndTwo();
    const damagedOnes: Array<[string, string]> = [
      ['a line of the advanced list lost its quotes', good.replace(`'${'4d'.repeat(32)}'`, `"${'4d'.repeat(32)}"`)],
      ['the advanced list lost its closing line', good.replace(/(\/\/ A2)\n\];/, '$1')],
      ['the next advanced number is gone', good.replace(/^export const nextAdvancedSimulatorCodeNumber = \d+;\n/m, '')],
    ];
    let nth = 0;
    for (const [what, damaged] of damagedOnes) {
      assert.notEqual(damaged, good, what);
      assert.equal(readListFile(damaged, 'advanced'), null, what);
      const file = path.join(folder, `advanced-damaged-${++nth}.ts`);
      const csv = path.join(folder, `advanced-damaged-${nth}.csv`);
      for (const extra of [[], ['--replace'], ['--advanced'], ['--advanced', '--replace']]) {
        writeFileSync(file, damaged);
        await assert.rejects(generateCodes(['--list', file, '--count', '1', '--out', csv, ...extra], print), /list of advanced codes .* is missing or damaged/s, `${what} ${extra.join(' ')}`);
        assert.equal(readFileSync(file, 'utf8'), damaged, `${what}: the file was left alone`);
        assert.ok(!existsSync(csv), `${what}: no CSV file was written`);
      }
    }
    // a remark and an empty line between the codes are no damage
    const withRemarks = good.replace(/^( {2}\{ no: 2, fingerprint: '4d.*)$/m, '\n  // for the coaches:\n$1');
    assert.equal(readListFile(withRemarks, 'advanced')?.active, 2);
    assert.equal(readListFile(withRemarks, 'member')?.active, 2);
  });

  test('with the owner\'s real file: neither kind of run changes a letter of the other list, of the lists of examples or of the explanations', async () => {
    const real = readFileSync(path.join(REPO_ROOT, 'content/simulator-codes.ts'), 'utf8');
    const copy = path.join(folder, 'copy-of-the-real-file.ts');
    /** The file cut in three: everything before the list of that kind, the list with its next number, everything after. */
    const cut = (textOf: string, kind: ListKind): [string, string, string] => {
      const name = kind === 'member' ? 'simulatorCodes' : 'advancedSimulatorCodes';
      const next = kind === 'member' ? 'nextSimulatorCodeNumber' : 'nextAdvancedSimulatorCodeNumber';
      const from = textOf.indexOf(`export const ${name}:`);
      const nextAt = textOf.indexOf(`export const ${next} = `);
      const to = textOf.indexOf('\n', nextAt) + 1;
      assert.ok(from > 0 && nextAt > from && to > nextAt);
      return [textOf.slice(0, from), textOf.slice(from, to), textOf.slice(to)];
    };
    const memberPart = cut(real, 'member')[1];
    const advancedPart = cut(real, 'advanced')[1];
    assert.equal((memberPart.match(/^ {2}\{ no: \d+, fingerprint: '[0-9a-f]{64}' \},$/gm) ?? []).length, simulatorCodes.length);

    let nth = 0;
    for (const [args, changed] of [
      [['--advanced'], 'advanced'],
      [['--advanced', '--replace'], 'advanced'],
      [[], 'member'],
      [['--replace'], 'member'],
    ] as const) {
      writeFileSync(copy, real);
      await generateCodes(['--list', copy, '--count', '2', '--out', path.join(folder, `real-${++nth}.csv`), ...args], print);
      const now = readFileSync(copy, 'utf8');
      assert.notEqual(now, real);
      const [before, mine, afterwards] = cut(now, changed);
      const [realBefore, realMine, realAfterwards] = cut(real, changed);
      assert.equal(before, realBefore, `${args.join(' ')}: everything in front of the ${changed} list is as it was`);
      assert.equal(afterwards, realAfterwards, `${args.join(' ')}: everything behind the ${changed} list is as it was`);
      assert.notEqual(mine, realMine);
      // the other list, byte for byte
      if (changed === 'advanced') assert.equal(cut(now, 'member')[1], memberPart, `${args.join(' ')}: all ${simulatorCodes.length} member lines are byte for byte the same`);
      else assert.equal(cut(now, 'advanced')[1], advancedPart, `${args.join(' ')}: the advanced lines are byte for byte the same`);
    }
    // (and the real file itself was never written to)
    assert.equal(readFileSync(path.join(REPO_ROOT, 'content/simulator-codes.ts'), 'utf8'), real);
  });
});
