/**
 * The browser's side of the Examples window (member-unlock.ts): reading the server's answer and
 * handling a code as it is typed, shown and remembered. The server is a pretend one here; its
 * real answers come from ../members/unlock.ts, so the two are also checked against each other.
 */
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { ALL_EXAMPLES, ALL_LEVELS } from '../members/all-examples';
import { fingerprintOf } from '../members/code-fingerprint.mjs';
import { normalizeCode } from '../members/code-format.mjs';
import { handleUnlockRequest, type UnlockSetup } from '../members/unlock';
import { blankProgram } from './program-file';
import { hiddenCode, isSavedCode, readUnlockAnswer, requestUnlock, tidyCode, CODE_LOOKS_LIKE, CODE_PLACEHOLDER } from './member-unlock';

const CODE = 'FIRE-AAAA-2222';

const STARTER = { id: 'starter', title: 'Starter', about: 'first steps' };
const HARDER = { id: 'harder', title: 'Harder', about: 'one whole mission' };

const card = (id: string, level = 'starter') => ({ id, title: `Title of ${id}`, level });
const example = (id: string, level = 'starter') => ({ ...card(id, level), description: `What ${id} does.`, program: blankProgram() });

/** An answer of the server: the headings, the cards to see, the examples to open. */
const answer = (member: boolean, cards: unknown[], examples: unknown[], levels: unknown[] = [STARTER, HARDER]) => ({ ok: true, member, levels, cards, examples });

describe('reading the server\'s answer', () => {
  test('with an accepted code: the headings, the cards and every example that was sent, with description and program', () => {
    const outcome = readUnlockAnswer(200, answer(true, [card('a'), card('b', 'harder')], [example('a'), example('b', 'harder')]));
    assert.equal(outcome.kind, 'examples');
    assert.ok(outcome.kind === 'examples');
    assert.equal(outcome.member, true);
    assert.deepEqual(outcome.levels, [STARTER, HARDER]);
    assert.deepEqual(outcome.cards, [card('a'), card('b', 'harder')]);
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ['a', 'b'],
    );
    assert.equal(outcome.examples[0].description, 'What a does.');
    assert.deepEqual(outcome.examples[0].program, blankProgram());
  });

  test('no code: the cards a visitor may see, and the examples that are open to everyone - often none', () => {
    assert.deepEqual(readUnlockAnswer(200, answer(false, [card('hello')], [])), { kind: 'examples', member: false, levels: [STARTER], cards: [card('hello')], examples: [] });
    const some = readUnlockAnswer(200, answer(false, [card('hello'), card('locked', 'harder')], [example('hello')]));
    assert.ok(some.kind === 'examples' && !some.member && some.cards.length === 2 && some.examples.length === 1);
    // no card at all is an answer too (the website has nothing to show to this visitor)
    assert.deepEqual(readUnlockAnswer(200, answer(false, [], [], [])), { kind: 'examples', member: false, levels: [], cards: [], examples: [] });
  });

  test('the window is drawn from the answer alone: the levels are whatever the server names, in its order', () => {
    const levels = [
      { id: 'z', title: 'Last year', about: '' },
      { id: 'a', title: 'New', about: 'made this season' },
    ];
    const outcome = readUnlockAnswer(200, answer(true, [card('one', 'a'), card('two', 'z')], [example('one', 'a'), example('two', 'z')], levels));
    assert.ok(outcome.kind === 'examples');
    assert.deepEqual(outcome.levels, levels);
    assert.deepEqual(
      outcome.cards.map((c) => `${c.level}/${c.id}`),
      ['a/one', 'z/two'],
    );
  });

  test('what is damaged is left out: a card without a heading, an example without a card, a heading without a card', () => {
    const outcome = readUnlockAnswer(
      200,
      answer(
        true,
        [card('fine'), card('fine'), card('nowhere', 'no-such-level'), { ...card('x'), id: 7 }, { ...card('no-title'), title: '' }, null, 'text', card('locked')],
        [example('fine'), example('fine'), example('no-card'), example('nowhere', 'no-such-level')],
        [STARTER, STARTER, HARDER, { id: 'broken' }, { id: '', title: 'Empty', about: '' }, null],
      ),
    );
    assert.ok(outcome.kind === 'examples');
    assert.deepEqual(outcome.levels, [STARTER], 'each heading once, and none without a card');
    assert.deepEqual(outcome.cards, [card('fine'), card('locked')], 'the same id twice counts once');
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ['fine'],
    );
  });

  test('examples that are damaged are left out; an answer to a code that names examples of which none can be read is not a "yes"', () => {
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
    const cards = ['no-program', 'bad-program', 'bad-blocks', 'no-description', 'fine'].map((id) => card(id));
    const outcome = readUnlockAnswer(200, answer(true, cards, damaged));
    assert.ok(outcome.kind === 'examples');
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ['fine'],
    );
    assert.equal(outcome.cards.length, 5, 'the cards of the damaged examples are still there, locked');
    assert.deepEqual(readUnlockAnswer(200, answer(true, [card('a')], [])), { kind: 'unreachable' });
    assert.deepEqual(readUnlockAnswer(200, answer(true, [card('a')], [null])), { kind: 'unreachable' });
    assert.deepEqual(readUnlockAnswer(200, answer(true, [], [example('a')])), { kind: 'unreachable' }, 'an example without its card');
    assert.deepEqual(readUnlockAnswer(200, answer(true, [card('a')], [example('a')], [])), { kind: 'unreachable' }, 'cards without a heading');
    // an accepted code for which the website has nothing at all is a "yes" all the same
    assert.deepEqual(readUnlockAnswer(200, answer(true, [], [], [])), { kind: 'examples', member: true, levels: [], cards: [], examples: [] });
  });

  test('"no" is a refusal of the code; "wait" is busy', () => {
    assert.deepEqual(readUnlockAnswer(403, { ok: false, reason: 'invalid-code' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(400, { ok: false, reason: 'bad-request' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(413, { ok: false, reason: 'too-large' }), { kind: 'rejected' });
    assert.deepEqual(readUnlockAnswer(429, { ok: false, reason: 'too-many-attempts' }), { kind: 'busy' });
  });

  test('everything else means "nothing is known": the examples stay locked, but the code is not called wrong', () => {
    const good = answer(true, [card('a')], [example('a')]);
    assert.equal(readUnlockAnswer(200, good).kind, 'examples', 'the answer the others are made from is a good one');
    const unclear: Array<[number, unknown]> = [
      [200, null],
      [200, 'ok'],
      [200, []],
      [200, {}],
      [200, { ok: true }],
      [200, { ...good, member: undefined }], // does not say whether a code was accepted
      [200, { ...good, member: 'yes' }],
      [200, { ...good, examples: 'all' }],
      [200, { ...good, cards: undefined }], // an answer of the old kind: examples, but no cards to draw
      [200, { ...good, cards: 'all' }],
      [200, { ...good, levels: undefined }],
      [201, good],
      [403, good],
      [200, { ok: false, reason: 'invalid-code' }],
      [403, { ok: false }],
      [403, { ok: false, reason: 'something-new' }],
      [405, { ok: false, reason: 'method-not-allowed' }],
      [404, { error: 'not found' }],
      [500, { ok: false, reason: 'invalid-code' }],
      [502, null],
    ];
    for (const [status, body] of unclear) {
      assert.deepEqual(readUnlockAnswer(status, body), { kind: 'unreachable' }, `${status} ${JSON.stringify(body)}`);
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

  const ADVANCED_CODE = 'FIRE-DDDD-5555';
  const HIDDEN = ['smart-bucket', 'full-mission'];
  const FOR_MEMBERS = ALL_EXAMPLES.map((e) => e.id).filter((id) => !HIDDEN.includes(id));

  let setup: UnlockSetup;
  before(async () => {
    setup = {
      codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(CODE) as string) }],
      advancedCodes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(ADVANCED_CODE) as string) }],
      examples: ALL_EXAMPLES,
      levels: ALL_LEVELS,
      openToEveryone: [],
      advancedOnly: [],
    };
  });

  test('with a code of the list: all seven examples arrive, each with its card and its program', async () => {
    const server = pretendServer(setup);
    const outcome = await requestUnlock('/api/simulator/unlock', CODE, server.fetch);
    assert.ok(outcome.kind === 'examples' && outcome.member);
    assert.equal(outcome.examples.length, 7);
    assert.deepEqual(
      outcome.examples.map((e) => e.id),
      ALL_EXAMPLES.map((e) => e.id),
    );
    assert.deepEqual(
      outcome.cards.map((c) => c.id),
      ALL_EXAMPLES.map((e) => e.id),
    );
    assert.deepEqual(
      outcome.levels.map((level) => level.title),
      ['Starter', 'Intermediate', 'Advanced'],
    );
    for (const [i, e] of outcome.examples.entries()) {
      assert.equal(e.description, ALL_EXAMPLES[i].description);
      assert.deepEqual(e.program, ALL_EXAMPLES[i].program);
    }
    assert.deepEqual(server.asked, [{ url: '/api/simulator/unlock', body: { code: CODE }, method: 'POST' }]);
  });

  test('without a code: every card but nothing to open while no example is open to everyone, then exactly the open ones', async () => {
    const closed = await requestUnlock('/u', null, pretendServer(setup).fetch);
    assert.ok(closed.kind === 'examples' && !closed.member);
    assert.equal(closed.cards.length, 7);
    assert.deepEqual(closed.examples, []);

    const server = pretendServer({ ...setup, openToEveryone: ['hello'] });
    const open = await requestUnlock('/u', null, server.fetch);
    assert.ok(open.kind === 'examples' && !open.member);
    assert.deepEqual(
      open.examples.map((e) => e.id),
      ['hello'],
    );
    assert.equal(open.cards.length, 7);
    assert.deepEqual(server.asked[0].body, {}, 'no code is sent');
  });

  test('examples for advanced codes only: the browser of a visitor and of a member never gets a word about them', async () => {
    const server = pretendServer({ ...setup, openToEveryone: ['hello', 'line-follow', 'gripper-demo'], advancedOnly: HIDDEN });
    const titles = (outcome: Awaited<ReturnType<typeof requestUnlock>>): string[] => (outcome.kind === 'examples' ? outcome.levels.map((level) => level.title) : []);

    const visitor = await requestUnlock('/u', null, server.fetch);
    assert.ok(visitor.kind === 'examples' && !visitor.member);
    assert.deepEqual(
      visitor.cards.map((c) => c.id),
      FOR_MEMBERS,
    );
    assert.deepEqual(
      visitor.examples.map((e) => e.id),
      ['hello', 'line-follow', 'gripper-demo'],
    );
    assert.deepEqual(titles(visitor), ['Starter', 'Intermediate']);

    const member = await requestUnlock('/u', CODE, server.fetch);
    assert.ok(member.kind === 'examples' && member.member);
    assert.deepEqual(
      member.cards.map((c) => c.id),
      FOR_MEMBERS,
    );
    assert.deepEqual(
      member.examples.map((e) => e.id),
      FOR_MEMBERS,
    );
    assert.deepEqual(titles(member), ['Starter', 'Intermediate']);

    for (const [who, outcome] of [
      ['a visitor', visitor],
      ['a member', member],
    ] as const) {
      const got = JSON.stringify(outcome);
      for (const secret of [...HIDDEN, 'Smart bucket', 'Full mission', 'dvanced', 'whole match']) assert.ok(!got.includes(secret), `${who} does not get "${secret}"`);
    }

    const advanced = await requestUnlock('/u', ADVANCED_CODE, server.fetch);
    assert.ok(advanced.kind === 'examples' && advanced.member);
    assert.equal(advanced.cards.length, 7);
    assert.equal(advanced.examples.length, 7);
    assert.deepEqual(titles(advanced), ['Starter', 'Intermediate', 'Advanced']);
    // what the browser was told about the two kinds of code is the same: "member", and a list
    assert.deepEqual(Object.keys(member).sort(), Object.keys(advanced).sort());
  });

  test('a wrong code is rejected; too many wrong codes is "busy"', async () => {
    assert.deepEqual(await requestUnlock('/u', 'FIRE-CCCC-4444', pretendServer(setup).fetch), { kind: 'rejected' });
    const busy = (async () => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429 })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock('/u', CODE, busy), { kind: 'busy' });
  });

  test('an answer that does not fit the question is not trusted', async () => {
    const notAMember = (async () => Response.json(answer(false, [card('a')], []))) as unknown as typeof fetch;
    assert.equal((await requestUnlock('/u', null, notAMember)).kind, 'examples', 'the right answer to "no code"');
    assert.deepEqual(await requestUnlock('/u', CODE, notAMember), { kind: 'unreachable' }, 'a code was sent, "not a member" came back');
    const member = (async () => Response.json(answer(true, [card('a')], [example('a')]))) as unknown as typeof fetch;
    assert.equal((await requestUnlock('/u', CODE, member)).kind, 'examples', 'the right answer to a code');
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
