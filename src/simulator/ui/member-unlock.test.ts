/**
 * The browser's side of the Examples window (member-unlock.ts): reading the server's answer and
 * handling a code as it is typed, shown and remembered. The server is a pretend one here; its
 * real answers come from ../members/unlock.ts, so the two are also checked against each other.
 *
 * Every request names the game it is about. Most tests ask about Fire Rescue (RESCUE below);
 * "two games behind one address" asks about both.
 */
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import { ALL_GAMES, FIRE_CHIEF, FIRE_RESCUE } from '../members/all-examples';
import { fingerprintOf } from '../members/code-fingerprint.mjs';
import { normalizeCode } from '../members/code-format.mjs';
import { GAME_WHEN_NONE_IS_NAMED, handleUnlockRequest, type UnlockSetup } from '../members/unlock';
import { blankProgram } from './program-file';
import {
  answerIsAbout,
  codeAnswerUse,
  followSavedCode,
  hiddenCode,
  isSavedCode,
  readUnlockAnswer,
  requestUnlock,
  requestUnlockPatiently,
  savedCodeChange,
  savedCodeIn,
  savedCodeNow,
  tidyCode,
  CODE_LOOKS_LIKE,
  CODE_PLACEHOLDER,
  EXAMPLES_GAMES,
  GAME_OF_AN_UNNAMED_ANSWER,
  SAVED_CODE_KEY,
  type CodeAnswerUse,
  type CodeAsked,
  type ExamplesSource,
  type SavedCodeChange,
} from './member-unlock';
import { storageKey } from './storage';

const CODE = 'FIRE-AAAA-2222';

/** The seven examples of Fire Rescue, which most of these tests ask for. */
const ALL_EXAMPLES = FIRE_RESCUE.examples;
/** Where the simulator asks, and for which game: a made-up address, Fire Rescue - and the same address, Fire Chief. */
const RESCUE: ExamplesSource = { unlockUrl: '/u', game: 'fire-rescue' };
const CHIEF: ExamplesSource = { unlockUrl: '/u', game: 'fire-chief' };

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
      [400, { ok: false, reason: 'unknown-game' }], // the server has no examples for the game that was named: the code was not even looked at
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
      games: ALL_GAMES,
      openToEveryone: [],
      advancedOnly: [],
    };
  });

  test('with a code of the list: all seven examples arrive, each with its card and its program', async () => {
    const server = pretendServer(setup);
    const outcome = await requestUnlock({ unlockUrl: '/api/simulator/unlock', game: 'fire-rescue' }, CODE, server.fetch);
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
    assert.deepEqual(server.asked, [{ url: '/api/simulator/unlock', body: { game: 'fire-rescue', code: CODE }, method: 'POST' }]);
  });

  test('without a code: every card but nothing to open while no example is open to everyone, then exactly the open ones', async () => {
    const closed = await requestUnlock(RESCUE, null, pretendServer(setup).fetch);
    assert.ok(closed.kind === 'examples' && !closed.member);
    assert.equal(closed.cards.length, 7);
    assert.deepEqual(closed.examples, []);

    const server = pretendServer({ ...setup, openToEveryone: ['hello'] });
    const open = await requestUnlock(RESCUE, null, server.fetch);
    assert.ok(open.kind === 'examples' && !open.member);
    assert.deepEqual(
      open.examples.map((e) => e.id),
      ['hello'],
    );
    assert.equal(open.cards.length, 7);
    assert.deepEqual(server.asked[0].body, { game: 'fire-rescue' }, 'the game is named, and no code is sent');
  });

  test('examples for advanced codes only: the browser of a visitor and of a member never gets a word about them', async () => {
    const server = pretendServer({ ...setup, openToEveryone: ['hello', 'line-follow', 'gripper-demo'], advancedOnly: HIDDEN });
    const titles = (outcome: Awaited<ReturnType<typeof requestUnlock>>): string[] => (outcome.kind === 'examples' ? outcome.levels.map((level) => level.title) : []);

    const visitor = await requestUnlock(RESCUE, null, server.fetch);
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

    const member = await requestUnlock(RESCUE, CODE, server.fetch);
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

    const advanced = await requestUnlock(RESCUE, ADVANCED_CODE, server.fetch);
    assert.ok(advanced.kind === 'examples' && advanced.member);
    assert.equal(advanced.cards.length, 7);
    assert.equal(advanced.examples.length, 7);
    assert.deepEqual(titles(advanced), ['Starter', 'Intermediate', 'Advanced']);
    // what the browser was told about the two kinds of code is the same: "member", and a list
    assert.deepEqual(Object.keys(member).sort(), Object.keys(advanced).sort());
  });

  test('a wrong code is rejected; too many wrong codes is "busy"', async () => {
    assert.deepEqual(await requestUnlock(RESCUE, 'FIRE-CCCC-4444', pretendServer(setup).fetch), { kind: 'rejected' });
    const busy = (async () => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429 })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock(RESCUE, CODE, busy), { kind: 'busy' });
  });

  test('an answer that does not fit the question is not trusted', async () => {
    const notAMember = (async () => Response.json(answer(false, [card('a')], []))) as unknown as typeof fetch;
    assert.equal((await requestUnlock(RESCUE, null, notAMember)).kind, 'examples', 'the right answer to "no code"');
    assert.deepEqual(await requestUnlock(RESCUE, CODE, notAMember), { kind: 'unreachable' }, 'a code was sent, "not a member" came back');
    const member = (async () => Response.json(answer(true, [card('a')], [example('a')]))) as unknown as typeof fetch;
    assert.equal((await requestUnlock(RESCUE, CODE, member)).kind, 'examples', 'the right answer to a code');
    assert.deepEqual(await requestUnlock(RESCUE, null, member), { kind: 'unreachable' }, 'no code was sent, "member" came back');
  });

  test('no connection, an error page, a timeout: "unreachable", and never an exception', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock(RESCUE, CODE, offline), { kind: 'unreachable' });

    const errorPage = (async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })) as unknown as typeof fetch;
    assert.deepEqual(await requestUnlock(RESCUE, CODE, errorPage), { kind: 'unreachable' });

    const never = ((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const started = Date.now();
    assert.deepEqual(await requestUnlock(RESCUE, CODE, never, 30), { kind: 'unreachable' });
    assert.ok(Date.now() - started < 2000, 'given up after the timeout');
  });
});

describe('two games behind one address', () => {
  /** A pretend fetch that answers like the website's server, and notes the text of every request. */
  function pretendServer(setup: UnlockSetup): { fetch: typeof fetch; sent: string[] } {
    const sent: string[] = [];
    const pretend = async (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
      const body = typeof init?.body === 'string' ? init.body : '';
      sent.push(body);
      const answer = await handleUnlockRequest({ method: init?.method ?? 'GET', body, contentType: new Headers(init?.headers).get('content-type'), client: 'test' }, setup);
      return Response.json(answer.body, { status: answer.status, headers: answer.headers });
    };
    return { fetch: pretend as typeof fetch, sent };
  }

  const ADVANCED_CODE = 'FIRE-DDDD-5555';
  const ids = (list: ReadonlyArray<{ id: string }>): string[] => list.map((item) => item.id);

  /** The rule of both games: the starters open to everyone, the advanced examples for advanced codes only. One list of codes of each kind. */
  let setup: UnlockSetup;
  before(async () => {
    setup = {
      codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(CODE) as string) }],
      advancedCodes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(ADVANCED_CODE) as string) }],
      games: ALL_GAMES,
      openToEveryone: ALL_GAMES.flatMap((game) => game.examples.filter((example) => example.level === 'starter').map((example) => example.id)),
      advancedOnly: ALL_GAMES.flatMap((game) => game.examples.filter((example) => example.level === 'advanced').map((example) => example.id)),
    };
  });

  test('every request names its game, with the code when there is one - and nothing else', async () => {
    const server = pretendServer(setup);
    await requestUnlock(RESCUE, null, server.fetch);
    await requestUnlock(RESCUE, CODE, server.fetch);
    await requestUnlock(CHIEF, null, server.fetch);
    await requestUnlock(CHIEF, CODE, server.fetch);
    await requestUnlockPatiently(CHIEF, CODE, server.fetch);
    assert.deepEqual(server.sent, [
      '{"game":"fire-rescue"}',
      `{"game":"fire-rescue","code":"${CODE}"}`,
      '{"game":"fire-chief"}',
      `{"game":"fire-chief","code":"${CODE}"}`,
      `{"game":"fire-chief","code":"${CODE}"}`,
    ]);
    // the names a page can ask with are the names the server knows
    assert.deepEqual(
      [...EXAMPLES_GAMES],
      ALL_GAMES.map((game) => game.game),
    );
  });

  test('Fire Chief: a visitor gets 5 cards and 3 to open, a member code opens all 5, an advanced code shows 6 - and never a word of Fire Rescue', async () => {
    const server = pretendServer(setup);
    const visitor = await requestUnlock(CHIEF, null, server.fetch);
    const member = await requestUnlock(CHIEF, CODE, server.fetch);
    const advanced = await requestUnlock(CHIEF, ADVANCED_CODE, server.fetch);
    assert.ok(visitor.kind === 'examples' && !visitor.member);
    assert.ok(member.kind === 'examples' && member.member);
    assert.ok(advanced.kind === 'examples' && advanced.member);
    const all = ids(FIRE_CHIEF.examples);
    assert.deepEqual(ids(visitor.cards), all.slice(0, 5));
    assert.deepEqual(ids(visitor.examples), all.slice(0, 3));
    assert.deepEqual(ids(member.cards), all.slice(0, 5));
    assert.deepEqual(ids(member.examples), all.slice(0, 5));
    assert.deepEqual(ids(advanced.cards), all);
    assert.deepEqual(ids(advanced.examples), all);
    assert.deepEqual(advanced.examples, [...FIRE_CHIEF.examples], 'every example arrives whole: its card, its description, its program');
    assert.deepEqual(advanced.levels, [...FIRE_CHIEF.levels]);
    for (const [who, outcome] of [
      ['a visitor', visitor],
      ['a member', member],
    ] as const) {
      assert.deepEqual(
        outcome.levels.map((level) => level.title),
        ['Starter', 'Intermediate'],
        who,
      );
      const got = JSON.stringify(outcome);
      for (const secret of ['chief-full-mission', FIRE_CHIEF.examples[5].title, 'dvanced', FIRE_CHIEF.levels[2].about]) assert.ok(!got.includes(secret), `${who} does not get "${secret}"`);
    }
    for (const outcome of [visitor, member, advanced]) {
      const got = JSON.stringify(outcome);
      for (const example of FIRE_RESCUE.examples) assert.ok(!got.includes(`"${example.id}"`) && !got.includes(example.title), `nothing about ${example.id} of Fire Rescue`);
    }
  });

  test('Fire Rescue is answered as before: 5 cards and 3 to open, 5 and 5, 7 and 7 - and never a word of Fire Chief', async () => {
    const server = pretendServer(setup);
    const counts: string[] = [];
    for (const code of [null, CODE, ADVANCED_CODE]) {
      const outcome = await requestUnlock(RESCUE, code, server.fetch);
      assert.ok(outcome.kind === 'examples');
      counts.push(`${outcome.cards.length} / ${outcome.examples.length}`);
      const got = JSON.stringify(outcome);
      for (const example of FIRE_CHIEF.examples) assert.ok(!got.includes(`"${example.id}"`) && !got.includes(example.title), `nothing about ${example.id} of Fire Chief`);
    }
    assert.deepEqual(counts, ['5 / 3', '5 / 5', '7 / 7']);
  });

  test('a wrong code is rejected in both games; a server that does not know the game says nothing about the code', async () => {
    const server = pretendServer(setup);
    assert.deepEqual(await requestUnlock(CHIEF, 'FIRE-CCCC-4444', server.fetch), { kind: 'rejected' });
    assert.deepEqual(await requestUnlock(RESCUE, 'FIRE-CCCC-4444', server.fetch), { kind: 'rejected' });
    // a server that has the examples of Fire Rescue alone, asked about Fire Chief: "nothing is known",
    // with a right code, a wrong one and none - never "your code is wrong", and never the examples of the other game
    const rescueOnly = pretendServer({ ...setup, games: [FIRE_RESCUE] });
    for (const code of [CODE, 'FIRE-CCCC-4444', null]) assert.deepEqual(await requestUnlock(CHIEF, code, rescueOnly.fetch), { kind: 'unreachable' }, String(code));
    assert.deepEqual(readUnlockAnswer(400, { ok: false, reason: 'unknown-game' }), { kind: 'unreachable' });
  });

  /**
   * A pretend server of BEFORE the second game - what a browser tab talks to when it stayed open
   * while the website was put back to an older state. It does not look at "game": it has the
   * examples of Fire Rescue alone, answers every request with them, and says no game back.
   */
  function serverOfBefore(setup: UnlockSetup): typeof fetch {
    const pretend = async (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
      const sent = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
      delete sent.game;
      const answer = await handleUnlockRequest(
        { method: 'POST', body: JSON.stringify(sent), contentType: 'application/json', client: 'test' },
        { ...setup, games: [FIRE_RESCUE] },
      );
      return Response.json(answer.body, { status: answer.status, headers: answer.headers });
    };
    return pretend as typeof fetch;
  }

  test('the page of Fire Chief does not take the examples of Fire Rescue from a server of before the second game: "nothing is known"', async () => {
    const before = serverOfBefore(setup);
    // without a code, with a member code, with an advanced code: never a card of Fire Rescue on the Fire Chief page
    for (const code of [null, CODE, ADVANCED_CODE]) {
      assert.deepEqual(await requestUnlock(CHIEF, code, before), { kind: 'unreachable' }, `Fire Chief, ${code ?? 'no code'}`);
    }
    // ... also when a short wait is waited out
    assert.deepEqual(await requestUnlockPatiently(CHIEF, CODE, before), { kind: 'unreachable' });
    // a wrong code is still a wrong code: that answer is the same in every game
    assert.deepEqual(await requestUnlock(CHIEF, 'FIRE-CCCC-4444', before), { kind: 'rejected' });
    // the page of Fire Rescue goes on working with that server, exactly as it did: its answer names no game, and is about Fire Rescue
    const counts: string[] = [];
    for (const code of [null, CODE, ADVANCED_CODE]) {
      const outcome = await requestUnlock(RESCUE, code, before);
      assert.ok(outcome.kind === 'examples', `Fire Rescue, ${code ?? 'no code'}`);
      counts.push(`${outcome.cards.length} / ${outcome.examples.length}`);
    }
    assert.deepEqual(counts, ['5 / 3', '5 / 5', '7 / 7']);
  });

  test('an answer about another game than the one that was asked for is not taken, in either direction', async () => {
    const server = pretendServer(setup);
    // a server (or something in between) that answers every question with the answer about the other game
    const crossed = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { game: string };
      const other = sent.game === 'fire-chief' ? 'fire-rescue' : 'fire-chief';
      return server.fetch(input, { ...init, body: JSON.stringify({ ...sent, game: other }) });
    }) as typeof fetch;
    for (const from of [RESCUE, CHIEF]) {
      for (const code of [null, CODE, ADVANCED_CODE]) {
        assert.deepEqual(await requestUnlock(from, code, crossed), { kind: 'unreachable' }, `${from.game}, ${code ?? 'no code'}`);
      }
    }
    // the server of today says the game back, and both pages take its answers
    for (const from of [RESCUE, CHIEF]) assert.equal((await requestUnlock(from, null, server.fetch)).kind, 'examples', from.game);
  });

  test('which game an answer is about: the one it names, or - when it names none - Fire Rescue', () => {
    assert.ok(answerIsAbout({ ok: true, game: 'fire-chief' }, 'fire-chief'));
    assert.ok(answerIsAbout({ ok: true, game: 'fire-rescue' }, 'fire-rescue'));
    assert.ok(!answerIsAbout({ ok: true, game: 'fire-rescue' }, 'fire-chief'));
    assert.ok(!answerIsAbout({ ok: true, game: 'fire-chief' }, 'fire-rescue'));
    // no name: a server of before the second game, which only ever had Fire Rescue
    assert.ok(answerIsAbout({ ok: true }, 'fire-rescue'));
    assert.ok(!answerIsAbout({ ok: true }, 'fire-chief'));
    // a name that is no name is not "no name"
    for (const game of [null, '', 'Fire-Chief', 7, ['fire-chief'], { game: 'fire-chief' }]) {
      for (const page of EXAMPLES_GAMES) assert.ok(!answerIsAbout({ ok: true, game }, page), `${JSON.stringify(game)} for ${page}`);
    }
    for (const nothing of [null, undefined, 'fire-chief', []]) assert.ok(!answerIsAbout(nothing, 'fire-chief'), String(nothing));
    // the browser and the server mean the same game by "no name"
    assert.equal(GAME_OF_AN_UNNAMED_ANSWER, GAME_WHEN_NONE_IS_NAMED);
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

  test('the code is kept in one place for every game: the place where Fire Rescue has always kept it', () => {
    // (a browser that saved a code before there was a second game has it under this very name: changing it would lose every saved code)
    assert.equal(SAVED_CODE_KEY, 'mbot2-sim:fire-rescue:member-code');
    assert.equal(SAVED_CODE_KEY, storageKey('fire-rescue', 'member-code'));
    // it is not the place a game's own things are kept in, for any other game
    assert.notEqual(SAVED_CODE_KEY, storageKey('fire-chief', 'member-code'));
  });

  test('another tab forgot the code, or had another one accepted: this tab is told what to do', () => {
    const mine = 'FIRE-7K2M-9QXD';
    const other = 'FIRE-BBBB-3333';
    const saved = (code: string): string => JSON.stringify({ code });
    // "Forget this code on this device" in another tab: the key is taken out
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, null, mine), { kind: 'forgotten' });
    // the browser's whole memory for this website was cleared (the event then names no key)
    assert.deepEqual(savedCodeChange(null, null, mine), { kind: 'forgotten' });
    // what stands there now is no code any more: the next visit would find none
    for (const damaged of ['', 'not json', '{}', '{"code":7}', '{"code":"FIRE-7K2M"}', '[]', 'null']) {
      assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, damaged, mine), { kind: 'forgotten' }, damaged);
    }
    // a tab that has no code has nothing to lock
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, null, null), { kind: 'none' });
    assert.deepEqual(savedCodeChange(null, null, null), { kind: 'none' });
    // another code was accepted in another tab: ask the server about it - in its handed-out form, however it was written
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, saved(other), mine), { kind: 'code', code: other });
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, saved(other), null), { kind: 'code', code: other });
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, saved('fire bbbb 3333'), null), { kind: 'code', code: other });
    // the code this tab already has: nothing to do (so two tabs never keep asking each other)
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, saved(mine), mine), { kind: 'none' });
    assert.deepEqual(savedCodeChange(SAVED_CODE_KEY, saved('fire-7k2m-9qxd'), mine), { kind: 'none' });
    // other things the simulator keeps in the browser are nobody's code
    for (const key of [storageKey('fire-rescue', 'workspace'), storageKey('fire-chief', 'settings'), storageKey('fire-chief', 'member-code'), 'something-else']) {
      assert.deepEqual(savedCodeChange(key, null, mine), { kind: 'none' }, key);
      assert.deepEqual(savedCodeChange(key, saved(other), mine), { kind: 'none' }, key);
    }
  });

  test('the code in the browser\'s memory is read in its handed-out form, and what is no code is no code', () => {
    assert.equal(savedCodeIn(JSON.stringify({ code: 'FIRE-7K2M-9QXD' })), 'FIRE-7K2M-9QXD');
    assert.equal(savedCodeIn(JSON.stringify({ code: 'fire 7k2m 9qxd' })), 'FIRE-7K2M-9QXD');
    for (const nothing of [null, '', 'not json', '{}', '{"code":7}', '{"code":"FIRE-7K2M"}', '[]', 'null', '"FIRE-7K2M-9QXD"']) assert.equal(savedCodeIn(nothing), null, String(nothing));
    // the memory against a tab: the same code is no news, no code is "forgotten", another code is that code
    assert.deepEqual(savedCodeNow('FIRE-7K2M-9QXD', 'FIRE-7K2M-9QXD'), { kind: 'none' });
    assert.deepEqual(savedCodeNow(null, null), { kind: 'none' });
    assert.deepEqual(savedCodeNow(null, 'FIRE-7K2M-9QXD'), { kind: 'forgotten' });
    assert.deepEqual(savedCodeNow('FIRE-BBBB-3333', 'FIRE-7K2M-9QXD'), { kind: 'code', code: 'FIRE-BBBB-3333' });
    assert.deepEqual(savedCodeNow('FIRE-BBBB-3333', null), { kind: 'code', code: 'FIRE-BBBB-3333' });
  });

  test('the texts that show what a code looks like have the shape of a code', () => {
    assert.equal(CODE_PLACEHOLDER, 'FIRE-XXXX-XXXX');
    assert.equal(tidyCode(CODE_LOOKS_LIKE), CODE_LOOKS_LIKE);
  });
});

describe('several tabs of one browser and the one saved code', () => {
  const MEMBER = 'FIRE-AAAA-2222';
  const ADVANCED = 'FIRE-DDDD-5555';

  test('an answer about a code: only a typed code is written into the browser\'s memory, and an answer about the saved code counts only while the memory holds it', () => {
    // typed in this tab: the answer counts, and a "yes" is saved - whatever the memory holds meanwhile
    for (const inMemory of [null, MEMBER, ADVANCED]) assert.deepEqual(codeAnswerUse('typed', MEMBER, inMemory), { kind: 'take', save: true }, String(inMemory));
    // the saved code (start of a visit, "Try again", another tab saved it): it is in the memory already, so it is never written again
    assert.deepEqual(codeAnswerUse('saved', MEMBER, MEMBER), { kind: 'take', save: false });
    // ... it was forgotten while the server was asked: the answer is dropped, and the tab locks
    assert.deepEqual(codeAnswerUse('saved', MEMBER, null), { kind: 'drop', change: { kind: 'forgotten' } });
    // ... another code took its place meanwhile: the answer is dropped, and the tab follows that code
    assert.deepEqual(codeAnswerUse('saved', MEMBER, ADVANCED), { kind: 'drop', change: { kind: 'code', code: ADVANCED } });
  });

  test('a change of the saved code: the tab locks and takes the code in the memory for its saved code at once - before the server has answered', () => {
    assert.equal(followSavedCode({ kind: 'none' }), null);
    // forgotten: locked, and no saved code
    assert.deepEqual(followSavedCode({ kind: 'forgotten' }), { savedCode: null });
    // another tab saved a code: locked, and that code is this tab's saved code from now on (which it asks about)
    assert.deepEqual(followSavedCode({ kind: 'code', code: ADVANCED }), { savedCode: ADVANCED });
    // read from the "storage" event of a tab that had no code, and of one that had another
    for (const mine of [null, MEMBER]) {
      assert.deepEqual(followSavedCode(savedCodeChange(SAVED_CODE_KEY, JSON.stringify({ code: ADVANCED }), mine)), { savedCode: ADVANCED }, String(mine));
    }
    assert.equal(followSavedCode(savedCodeChange(SAVED_CODE_KEY, JSON.stringify({ code: MEMBER }), MEMBER)), null);
    assert.equal(followSavedCode(savedCodeChange('something-else', null, MEMBER)), null);
  });

  // ---------------------------------------------------------------------------------------------
  // A pretend browser: one memory, some tabs, and a server whose answers the test lets through
  // one by one (so that an answer can be held back while something else happens).
  //
  // A tab here does what the simulator screen does with a code (useMemberExamples.ts), step for
  // step, and takes every decision from the functions under test. `Rules` says which ones:
  // TODAY's, or the ones the screen had BEFORE - written out below - with which the three faults
  // of the first version can be played again.
  // ---------------------------------------------------------------------------------------------
  interface Rules {
    /**
     * What a tab does about a change of the saved code: nothing (null); or it locks, takes
     * `savedCode` for its saved code and asks about it (null: no code) - as at the start of a
     * visit; or, as it was before, it only asks about the code (`onlyAsk`).
     */
    follow: (change: SavedCodeChange) => { savedCode: string | null } | { onlyAsk: string } | null;
    answerUse: (about: CodeAsked, code: string, inMemory: string | null) => CodeAnswerUse;
  }
  const TODAY: Rules = { follow: followSavedCode, answerUse: codeAnswerUse };
  /** Before: every tab wrote every accepted code back, no tab looked into the memory again, and a code that was only followed was nobody's saved code. */
  const BEFORE: Rules = {
    follow: (change) => (change.kind === 'none' ? null : change.kind === 'forgotten' ? { savedCode: null } : { onlyAsk: change.code }),
    answerUse: () => ({ kind: 'take', save: true }),
  };

  type Reply = 'yes' | 'no' | 'not reached';
  interface Question {
    tab: Tab;
    number: number;
    code: string;
    about: CodeAsked;
  }

  class Browser {
    /** the text under SAVED_CODE_KEY, or null */
    memory: string | null = null;
    readonly tabs: Tab[] = [];
    /** the questions that are on their way to the server, oldest first */
    readonly onTheWay: Question[] = [];
    /** how many questions were sent in all */
    sent = 0;
    constructor(readonly rules: Rules) {}

    open(): Tab {
      const tab = new Tab(this);
      this.tabs.push(tab);
      return tab;
    }
    /** (the browser tells every OTHER tab, and only when something changed) */
    write(by: Tab, code: string): void {
      const text = JSON.stringify({ code });
      if (text === this.memory) return;
      this.memory = text;
      for (const tab of this.tabs) if (tab !== by) tab.onStorage(SAVED_CODE_KEY, text);
    }
    remove(by: Tab): void {
      if (this.memory === null) return;
      this.memory = null;
      for (const tab of this.tabs) if (tab !== by) tab.onStorage(SAVED_CODE_KEY, null);
    }
    get saved(): string | null {
      return savedCodeIn(this.memory);
    }
    /** The answer to the oldest question of this tab arrives. */
    answer(tab: Tab, reply: Reply = 'yes'): void {
      const at = this.onTheWay.findIndex((question) => question.tab === tab);
      assert.ok(at >= 0, 'a question of this tab is on its way');
      const [question] = this.onTheWay.splice(at, 1);
      tab.onAnswer(question, reply);
    }
    /** Every answer arrives, oldest first, until no question is on its way. Gives up after `most` answers: says how many arrived. */
    settle(most = 300): number {
      let arrived = 0;
      while (this.onTheWay.length > 0 && arrived < most) {
        const question = this.onTheWay.shift() as Question;
        question.tab.onAnswer(question, 'yes');
        arrived++;
      }
      return arrived;
    }
  }

  class Tab {
    /** the code this tab takes for the saved one ("Saved on this device", "Try again") */
    saved: string | null;
    /** the code whose examples are open here */
    open: string | null = null;
    phase: 'none' | 'checking' | 'unlocked' | 'rejected' | 'unreachable' = 'none';
    about: CodeAsked = 'saved';
    private latest = 0;

    constructor(private readonly browser: Browser) {
      // the start of a visit: the saved code is checked again
      this.saved = browser.saved;
      if (this.saved !== null) this.ask(this.saved, 'saved');
    }
    /** a code is typed and sent ("Unlock", or "Use this code") */
    type(code: string): void {
      this.ask(code, 'typed');
    }
    /** "Forget this code on this device" */
    forget(): void {
      this.browser.remove(this);
      this.lock();
    }
    /** "Try again" is on the screen (see ExamplesDialog.tsx) ... */
    get offersTryAgain(): boolean {
      return this.saved !== null && this.open === null && this.about === 'saved' && this.phase === 'unreachable';
    }
    /** ... and is pressed */
    tryAgain(): void {
      assert.ok(this.offersTryAgain, '"Try again" is on the screen');
      this.ask(this.saved as string, 'saved');
    }
    onStorage(key: string | null, newValue: string | null): void {
      this.follow(savedCodeChange(key, newValue, this.saved));
    }
    onAnswer(question: Question, reply: Reply): void {
      // (only the answer to the latest question counts)
      if (question.number !== this.latest) return;
      const use = this.browser.rules.answerUse(question.about, question.code, this.browser.saved);
      if (use.kind === 'drop') {
        this.follow(use.change);
        return;
      }
      this.about = question.about;
      if (reply === 'yes') {
        this.open = question.code;
        this.saved = question.code;
        if (use.save) this.browser.write(this, question.code);
        this.phase = 'unlocked';
      } else {
        this.phase = reply === 'no' ? 'rejected' : 'unreachable';
      }
    }
    private ask(code: string, about: CodeAsked): void {
      this.phase = 'checking';
      this.about = about;
      this.browser.sent++;
      this.browser.onTheWay.push({ tab: this, number: ++this.latest, code, about });
    }
    private lock(): void {
      this.latest++;
      this.open = null;
      this.saved = null;
      this.phase = 'none';
      this.about = 'saved';
    }
    private follow(change: SavedCodeChange): void {
      const follows = this.browser.rules.follow(change);
      if (follows === null) return;
      if ('onlyAsk' in follows) {
        // (before: what was open stayed open, and the code was nobody's saved code while the server was asked)
        this.ask(follows.onlyAsk, 'saved');
        return;
      }
      this.lock();
      if (follows.savedCode !== null) {
        this.saved = follows.savedCode;
        this.ask(follows.savedCode, 'saved');
      }
    }
  }

  /** What the tabs show, and what the memory holds: "open ADVANCED | locked | memory: ADVANCED". */
  const picture = (browser: Browser): string =>
    [...browser.tabs.map((tab) => (tab.open === null ? 'locked' : `open ${tab.open}`)), `memory: ${browser.saved ?? 'nothing'}`].join(' | ');

  /** One code accepted in the first of `count` tabs, and every other tab has followed. */
  function allOpenWith(code: string, count: number, rules: Rules): Browser {
    const browser = new Browser(rules);
    const tabs = Array.from({ length: count }, () => browser.open());
    tabs[0].type(code);
    browser.settle();
    assert.equal(picture(browser), [...tabs.map(() => `open ${code}`), `memory: ${code}`].join(' | '));
    return browser;
  }

  test('"Forget" stays forgotten: a tab that was still asking about the code does not bring it back', () => {
    const play = (rules: Rules): string => {
      const browser = new Browser(rules);
      const [first, second] = [browser.open(), browser.open()];
      // the code is accepted in the first tab; the second tab starts asking about it - and its answer is held back
      first.type(ADVANCED);
      browser.answer(first);
      assert.equal(browser.onTheWay.length, 1, 'the second tab is asking');
      // "Forget this code on this device" in the first tab, right away
      first.forget();
      assert.equal(picture(browser), 'locked | locked | memory: nothing');
      // now the held answer arrives, and whatever follows from it
      browser.settle();
      return picture(browser);
    };
    assert.equal(play(TODAY), 'locked | locked | memory: nothing');
    // (the fault this test is for, played with the rules of before: the code is back in the memory and both tabs are open again)
    assert.equal(play(BEFORE), `open ${ADVANCED} | open ${ADVANCED} | memory: ${ADVANCED}`);
  });

  test('a tab that follows never writes: forgetting in a tab that only followed locks every tab, and nothing comes back', () => {
    const browser = allOpenWith(ADVANCED, 3, TODAY);
    const sent = browser.sent;
    browser.tabs[2].forget();
    assert.equal(picture(browser), 'locked | locked | locked | memory: nothing');
    assert.equal(browser.settle(), 0);
    assert.equal(browser.sent, sent, 'forgetting asks the server nothing');
  });

  test('three tabs and two right codes come to rest: no tab puts an older code over a newer one', () => {
    const play = (rules: Rules): { arrived: number; picture: string } => {
      const browser = allOpenWith(ADVANCED, 3, rules);
      const [first, second, third] = browser.tabs;
      // 1. "Use a different code" in the first tab: the member code. The other two start asking about it
      first.type(MEMBER);
      browser.answer(first);
      // 2. the second tab has followed, and goes back to the advanced code - while the answer to the third tab hangs
      browser.answer(second);
      second.type(ADVANCED);
      browser.answer(second);
      // 3. now the answer to the third tab arrives after all, and every answer after it
      browser.answer(third);
      return { arrived: browser.settle(300), picture: picture(browser) };
    };
    const today = play(TODAY);
    assert.ok(today.arrived <= 3, `${today.arrived} more answers, then nothing is on its way`);
    assert.equal(today.picture, `open ${ADVANCED} | open ${ADVANCED} | open ${ADVANCED} | memory: ${ADVANCED}`);
    // (with the rules of before the tabs never stop asking each other: 300 answers later questions are still on their way)
    assert.equal(play(BEFORE).arrived, 300);
  });

  test('one action, at most one question per other tab - with two, three and four tabs', () => {
    for (const count of [2, 3, 4]) {
      const browser = allOpenWith(MEMBER, count, TODAY);
      // (the first code: one question of the tab it was typed in, one of every other tab)
      assert.equal(browser.sent, count, `${count} tabs: the first code`);
      // "Use a different code" in the last tab
      browser.tabs[count - 1].type(ADVANCED);
      browser.settle();
      assert.equal(browser.sent, 2 * count, `${count} tabs: a different code`);
      assert.equal(picture(browser), [...browser.tabs.map(() => `open ${ADVANCED}`), `memory: ${ADVANCED}`].join(' | '));
      // a wrong code typed in one tab is asked about by that tab alone, and changes nothing anywhere
      browser.tabs[0].type('FIRE-CCCC-4444');
      browser.answer(browser.tabs[0], 'no');
      assert.equal(browser.settle(), 0);
      assert.equal(browser.sent, 2 * count + 1, `${count} tabs: a wrong code`);
      assert.equal(browser.saved, ADVANCED);
      // forgetting: no question at all
      browser.tabs[0].forget();
      assert.equal(browser.settle(), 0);
      assert.equal(browser.sent, 2 * count + 1, `${count} tabs: forgetting`);
      assert.equal(picture(browser), [...browser.tabs.map(() => 'locked'), 'memory: nothing'].join(' | '));
    }
  });

  test('a tab that could not reach the website when another tab\'s code arrived has that code as its saved code: "Try again" is there and works', () => {
    const play = (rules: Rules): { saved: string | null; offersTryAgain: boolean; browser: Browser; second: Tab } => {
      const browser = new Browser(rules);
      const [first, second] = [browser.open(), browser.open()];
      first.type(MEMBER);
      browser.answer(first);
      // the second tab asks about the code, and the website cannot be reached
      browser.answer(second, 'not reached');
      assert.deepEqual([second.phase, second.about, second.open], ['unreachable', 'saved', null]);
      return { saved: second.saved, offersTryAgain: second.offersTryAgain, browser, second };
    };
    const { saved, offersTryAgain, browser, second } = play(TODAY);
    // the state of a tab that was loaded with the code in the memory: the window says "press Try again" and has the button (see examples-words.test.ts)
    assert.equal(saved, MEMBER);
    assert.ok(offersTryAgain);
    second.tryAgain();
    browser.answer(second);
    assert.equal(picture(browser), `open ${MEMBER} | open ${MEMBER} | memory: ${MEMBER}`);
    // (the second tab only followed: it asked twice and wrote nothing, so the first tab was not asked to follow anything)
    assert.equal(browser.sent, 3);
    assert.equal(browser.settle(), 0);
    // while it waits for "Try again", forgetting in the first tab still locks it for good
    const again = play(TODAY);
    again.browser.tabs[0].forget();
    assert.deepEqual([again.second.saved, again.second.offersTryAgain, picture(again.browser)], [null, false, 'locked | locked | memory: nothing']);
    // (the fault, with the rules of before: the tab says "could not be checked" about a saved code it does not have - no button, nothing to ask again)
    const before = play(BEFORE);
    assert.deepEqual([before.saved, before.offersTryAgain], [null, false]);
  });

  test('a tab that follows another code closes what its own code had opened until the website has answered - also when it cannot be reached', () => {
    const browser = allOpenWith(ADVANCED, 2, TODAY);
    const [first, second] = browser.tabs;
    // the advanced code gives way to a member code in the first tab ...
    first.type(MEMBER);
    browser.answer(first);
    // ... and the second tab stands as it would after a load with that code: nothing of the advanced code is open while it asks
    assert.deepEqual([second.open, second.saved, second.phase, second.about], [null, MEMBER, 'checking', 'saved']);
    browser.answer(second, 'not reached');
    assert.deepEqual([second.open, second.saved, second.offersTryAgain], [null, MEMBER, true]);
    second.tryAgain();
    browser.settle();
    assert.equal(picture(browser), `open ${MEMBER} | open ${MEMBER} | memory: ${MEMBER}`);
  });

  test('the saved code was replaced while a tab asked about it at the start of a visit: the tab ends on the code that is saved', () => {
    const browser = new Browser(TODAY);
    const first = browser.open();
    first.type(MEMBER);
    browser.settle();
    // a new tab is loaded and asks about the saved code; meanwhile the first tab changes to the advanced code
    const second = browser.open();
    assert.deepEqual([second.saved, second.phase], [MEMBER, 'checking']);
    first.type(ADVANCED);
    browser.answer(first);
    browser.settle();
    assert.equal(picture(browser), `open ${ADVANCED} | open ${ADVANCED} | memory: ${ADVANCED}`);
    // a tab whose "storage" event got lost finds out when its answer comes: the memory decides
    const third = browser.open();
    browser.memory = null;
    browser.answer(third);
    assert.deepEqual([third.open, third.saved, third.phase], [null, null, 'none']);
  });
});
