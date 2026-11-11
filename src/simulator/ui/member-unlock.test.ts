/**
 * The browser's side of the Examples window (member-unlock.ts): reading the server's answer and
 * handling a code as it is typed, shown and remembered. The server is a pretend one here; its
 * real answers come from ../members/unlock.ts, so the two are also checked against each other.
 */
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { ALL_EXAMPLES } from '../members/all-examples';
import { fingerprintOf } from '../members/code-fingerprint.mjs';
import { normalizeCode } from '../members/code-format.mjs';
import { handleUnlockRequest, type UnlockSetup } from '../members/unlock';
import { blankProgram } from './program-file';
import { hiddenCode, isSavedCode, readUnlockAnswer, requestUnlock, tidyCode, CODE_LOOKS_LIKE, CODE_PLACEHOLDER } from './member-unlock';

const CODE = 'FIRE-AAAA-2222';

const example = (id: string) => ({ id, title: `Title of ${id}`, level: 'starter', description: `What ${id} does.`, program: blankProgram() });

describe('reading the server\'s answer', () => {
  test('a member: every example that was sent, with description and program', () => {
    const outcome = readUnlockAnswer(200, { ok: true, member: true, examples: [example('a'), example('b')] });
    assert.equal(outcome.kind, 'examples');
    assert.ok(outcome.kind === 'examples');
    assert.equal(outcome.member, true);
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ['a', 'b'],
    );
    assert.equal(outcome.examples[0].description, 'What a does.');
    assert.deepEqual(outcome.examples[0].program, blankProgram());
  });

  test('no code: the examples that are open to everyone - often none', () => {
    assert.deepEqual(readUnlockAnswer(200, { ok: true, member: false, examples: [] }), { kind: 'examples', member: false, examples: [] });
    const some = readUnlockAnswer(200, { ok: true, member: false, examples: [example('hello')] });
    assert.ok(some.kind === 'examples' && !some.member && some.examples.length === 1);
  });

  test('examples that are damaged are left out; a member answer without any example is not a "yes"', () => {
    const damaged = [
      null,
      'text',
      { ...example('no-program'), program: undefined },
      { ...example('bad-program'), program: 'blocks' },
      { ...example('bad-blocks'), program: { blocks: { blocks: 'none' } } },
      { ...example('no-description'), description: undefined },
      { ...example('bad-level'), level: 'expert' },
      { ...example('x'), id: 7 },
      example('fine'),
      example('fine'), // the same id twice counts once
    ];
    const outcome = readUnlockAnswer(200, { ok: true, member: true, examples: damaged });
    assert.ok(outcome.kind === 'examples');
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ['fine'],
    );
    assert.deepEqual(readUnlockAnswer(200, { ok: true, member: true, examples: [] }), { kind: 'unreachable' });
    assert.deepEqual(readUnlockAnswer(200, { ok: true, member: true, examples: [null] }), { kind: 'unreachable' });
  });

  test('"no" is a refusal of the code; "wait" is busy', () => {
    assert.deepEqual(readUnlockAnswer(403, { ok: false, reason: 'invalid-code' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(400, { ok: false, reason: 'bad-request' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(413, { ok: false, reason: 'too-large' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(429, { ok: false, reason: 'too-many-attempts' }), { kind: 'busy' });
  });

  test('everything else means "nothing is known": the examples stay locked, but the code is not called wrong', () => {
    const unclear: Array<[number, unknown]> = [
      [200, null],
      [200, 'ok'],
      [200, []],
      [200, {}],
      [200, { ok: true }],
      [200, { ok: true, examples: [example('a')] }], // does not say whether this is a member
      [200, { ok: true, member: 'yes', examples: [example('a')] }],
      [200, { ok: true, member: true, examples: 'all' }],
      [201, { ok: true, member: true, examples: [example('a')] }],
      [403, { ok: true, member: true, examples: [example('a')] }],
      [200, { ok: false, reason: 'invalid-code' }],
      [403, { ok: false }],
      [403, { ok: false, reason: 'something-new' }],
      [405, { ok: false, reason: 'method-not-allowed' }],
      [404, { error: 'not found' }],
      [500, { ok: false, reason: 'invalid-code' }],
      [502, null],
    ];
    for (const [status, answer] of unclear) {
      assert.deepEqual(readUnlockAnswer(status, answer), { kind: 'unreachable' }, `${status} ${JSON.stringify(answer)}`);
    }
  });
});

describe('asking the server', () => {
  /** A pretend fetch that answers like the website's server, and notes what it was asked. */
  function pretendServer(setup: UnlockSetup): { fetch: typeof fetch; asked: Array<{ url: string; body: unknown; method: string | undefined }> } {
    const asked: Array<{ url: string; body: unknown; method: string | undefined }> = [];
    const pretend = async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
      const body = typeof init?.body === 'string' ? init.body : '';
      asked.push({ url: String(input), body: JSON.parse(body), method: init?.method });
      // (the content type is the one the simulator really sends: the server refuses a text that does not say it is JSON)
      const contentType = new Headers(init?.headers).get('content-type');
      const answer = await handleUnlockRequest({ method: init?.method ?? 'GET', body, contentType, client: 'test' }, setup);
      return Response.json(answer.body, { status: answer.status, headers: answer.headers });
    };
    return { fetch: pretend as typeof fetch, asked };
  }

  let setup: UnlockSetup;
  before(async () => {
    setup = {
      codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(CODE) as string) }],
      examples: ALL_EXAMPLES,
      openToEveryone: [],
    };
  });

  test('with a code of the list: all seven examples arrive, each with its program', async () => {
    const server = pretendServer(setup);
    const outcome = await requestUnlock('/api/simulator/unlock', CODE, server.fetch);
    assert.ok(outcome.kind === 'examples' && outcome.member);
    assert.equal(outcome.examples.length, 7);
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ALL_EXAMPLES.map((e) => e.id),
    );
    for (const [i, e] of outcome.examples.entries()) {
      assert.equal(e.description, ALL_EXAMPLES[i].description);
      assert.deepEqual(e.program, ALL_EXAMPLES[i].program);
    }
    assert.deepEqual(server.asked, [{ url: '/api/simulator/unlock', body: { code: CODE }, method: 'POST' }]);
  });

  test('without a code: nothing while no example is open to everyone, then exactly the open ones', async () => {
    const closed = await requestUnlock('/u', null, pretendServer(setup).fetch);
    assert.deepEqual(closed, { kind: 'examples', member: false, examples: [] });

    const server = pretendServer({ ...setup, openToEveryone: ['hello'] });
    const open = await requestUnlock('/u', null, server.fetch);
    assert.ok(open.kind === 'examples' && !open.member);
    assert.deepEqual(
      open.examples.map((e) => e.id),
      ['hello'],
    );
    assert.deepEqual(server.asked[0].body, {}, 'no code is sent');
  });

  test('a wrong code is rejected; too many wrong codes is "busy"', async () => {
    assert.deepEqual(await requestUnlock('/u', 'FIRE-CCCC-4444', pretendServer(setup).fetch), { kind: 'rejected' });
    const busy = (async () => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429 })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', CODE, busy), { kind: 'busy' });
  });

  test('an answer that does not fit the question is not trusted', async () => {
    const notAMember = (async () => Response.json({ ok: true, member: false, examples: [] })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', CODE, notAMember), { kind: 'unreachable' }, 'a code was sent, "not a member" came back');
    const member = (async () => Response.json({ ok: true, member: true, examples: [example('a')] })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', null, member), { kind: 'unreachable' }, 'no code was sent, "member" came back');
  });

  test('no connection, an error page, a timeout: "unreachable", and never an exception', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', CODE, offline), { kind: 'unreachable' });

    const errorPage = (async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', CODE, errorPage), { kind: 'unreachable' });

    const never = ((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const started = Date.now();
    assert.deepEqual(await requestUnlock('/u', CODE, never, 30), { kind: 'unreachable' });
    assert.ok(Date.now() - started < 2000, 'given up after the timeout');
  });
});

describe('the code as it is typed, shown and remembered', () => {
  test('a typed code is brought into its handed-out form, or is no code', () => {
    assert.equal(tidyCode('  fire 7k2m 9qxd '), 'FIRE-7K2M-9QXD');
    assert.equal(tidyCode('7K2M9QXD'), 'FIRE-7K2M-9QXD');
    assert.equal(tidyCode('FIRE-7K2M-9QX'), null);
    assert.equal(tidyCode('hello'), null);
    assert.equal(tidyCode(''), null);
  });

  test('the saved code is shown with its second half hidden', () => {
    assert.equal(hiddenCode('FIRE-7K2M-9QXD'), 'FIRE-7K2M-••••');
    assert.equal(hiddenCode('nonsense'), '');
  });

  test('only a real code is read back from the browser', () => {
    assert.ok(isSavedCode({ code: 'FIRE-7K2M-9QXD' }));
    for (const value of [null, 'FIRE-7K2M-9QXD', {}, { code: 7 }, { code: 'FIRE-7K2M' }, { code: '<script>' }, []]) {
      assert.ok(!isSavedCode(value), JSON.stringify(value));
    }
  });

  test('the texts that show what a code looks like have the shape of a code', () => {
    assert.equal(CODE_PLACEHOLDER, 'FIRE-XXXX-XXXX');
    assert.equal(tidyCode(CODE_LOOKS_LIKE), CODE_LOOKS_LIKE);
  });
});
