/**
 * What the Examples window says about member codes (examples-words.ts): every sentence a
 * student can read there, in every state the window can be in.
 *
 * These tests do not check taste; they check the promises at the top of that file: plain
 * words, no technical terms, "not reached" never mixed up with "wrong code", nothing that
 * sends a visitor without a code to examples they cannot open, every sentence true whichever
 * cards are on the screen - and not a word that lets a visitor or a member guess that there
 * are examples they are not shown, or a second kind of code.
 *
 * The last part, "the window as each kind of visitor sees it", draws the whole window from the
 * real answers of the website's server (../members/unlock.ts) for a visitor, for a member code
 * and for an advanced code, and reads what stands there: so the promises are checked on the
 * window itself, with every word it adds, and not only on the sentences of examples-words.ts.
 */
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ALL_GAMES } from '../members/all-examples';
import { fingerprintOf } from '../members/code-fingerprint.mjs';
import { normalizeCode } from '../members/code-format.mjs';
import { handleUnlockRequest, type UnlockSetup } from '../members/unlock';
import { ExamplesDialog } from './ExamplesDialog';
import { codeMessage, examplesIntro, EXAMPLES_WORDS, type CodeMessage, type ExamplesView } from './examples-words';
import { blankProgram } from './program-file';
import { CODE_LOOKS_LIKE, hiddenCode, PATIENCE_SECONDS, PATIENT_TRIES, readUnlockAnswer, requestUnlock, requestUnlockPatiently, type ExamplesSource } from './member-unlock';
import { shelfOf, type CodePhase, type CodeStatus, type MemberExamples, type Shelf } from './useMemberExamples';

const ORG = 'MakeX Lebanon';

/** Where the simulator asks for its examples in these tests: a made-up address, and the game Fire Rescue. */
const SOURCE: ExamplesSource = { unlockUrl: '/u', game: 'fire-rescue' };

/** Words a 12-year-old with a code on a piece of paper should never have to read. */
const TECHNICAL = /\b(server|hash|fingerprint|api|endpoint|localstorage|storage|cookie|request|response|http|json|database|cache|token|fetch|status code|error code|403|429|invalid|authenticat\w*|authori[sz]\w*|credential\w*|session)\b/i;

const PHASES: CodePhase[] = ['none', 'checking', 'unlocked', 'rejected', 'busy', 'unreachable'];
const ABOUT: CodeStatus['about'][] = ['typed', 'saved'];
const EVERY_STATUS: CodeStatus[] = PHASES.flatMap((phase) => ABOUT.map((about) => ({ phase, about })));

const textOf = (message: CodeMessage): string => [message.lead ?? '', ...message.rest].join(' ').trim();
const say = (phase: CodePhase, about: CodeStatus['about'], waitSeconds?: number): string => textOf(codeMessage({ phase, about, waitSeconds }, ORG));
/** The same for somebody whose examples are open and who is typing a different code. */
const sayWhileOpen = (phase: CodePhase, waitSeconds?: number): string => textOf(codeMessage({ phase, about: 'typed', waitSeconds }, ORG, true));

const VIEWS: ExamplesView[] = ['unlocked', 'all-open', 'some-open', 'checking-some-open', 'checking-saved', 'locked', 'not-known'];

/** What can be said while a different code is typed in the place of the one in use. */
const WHILE_OPEN: CodePhase[] = ['none', 'checking', 'rejected', 'busy', 'unreachable'];

/** Everything the window can say, as plain texts. */
function everySentence(): string[] {
  return [
    ...EVERY_STATUS.map((status) => textOf(codeMessage(status, ORG))),
    ...EVERY_STATUS.map((status) => textOf(codeMessage(status, ORG, true))),
    say('busy', 'typed', 1),
    say('busy', 'typed', 60),
    say('busy', 'saved', 420),
    sayWhileOpen('busy', 60),
    textOf(codeMessage({ phase: 'unlocked', about: 'typed', replaced: true }, ORG, true)),
    ...VIEWS.map((view) => examplesIntro(view, ORG)),
    ...Object.values(EXAMPLES_WORDS),
  ];
}

/**
 * Words that would let a visitor, or a member with an ordinary code, guess that there is more
 * than they are shown: examples they do not see, or a second kind of code. The window speaks
 * of "a code" and of "the examples" - the ones on the screen - and of nothing else.
 */
const HINTS_AT_MORE =
  /\b(advanced|expert|pro|premium|vip|upgrade\w*|hidden|hide|secret\w*|special|extra|bonus|exclusive|restricted|tier\w*|level\w*|rank\w*|higher|stronger|better|full access|all access|more examples|other examples|further examples|additional|the rest|not shown|kinds? of code|types? of code|another kind|second kind|other kind|two kinds|both kinds|every kind|ordinary|normal code|regular|basic|standard|seven|five|all \d+|\d+ examples)\b/i;

describe('the words of the Examples window', () => {
  test('there is something to say in every state, and it is a whole sentence', () => {
    for (const status of EVERY_STATUS) {
      const message = codeMessage(status, ORG);
      const text = textOf(message);
      assert.ok(text.length >= 15, `${status.phase}/${status.about}: "${text}"`);
      for (const sentence of [message.lead, ...message.rest]) {
        if (sentence === undefined) continue;
        assert.match(sentence, /^[A-Z]/, `starts with a capital: "${sentence}"`);
        assert.match(sentence, /[.…]$/, `ends like a sentence: "${sentence}"`);
        assert.equal(sentence, sentence.trim());
      }
    }
    for (const view of VIEWS) assert.match(examplesIntro(view, ORG), /^[A-Z].*\.$/);
    // also while a different code is typed in the place of the one in use
    for (const phase of WHILE_OPEN) {
      const message = codeMessage({ phase, about: 'typed' }, ORG, true);
      assert.ok(textOf(message).length >= 15, `${phase} while open: "${textOf(message)}"`);
      for (const sentence of [message.lead, ...message.rest]) {
        if (sentence === undefined) continue;
        assert.match(sentence, /^[A-Z]/, `starts with a capital: "${sentence}"`);
        assert.match(sentence, /[.…]$/, `ends like a sentence: "${sentence}"`);
      }
    }
  });

  test('not a word hints at examples that are not shown, or at a second kind of code', () => {
    for (const sentence of everySentence()) {
      assert.doesNotMatch(sentence, HINTS_AT_MORE, `"${sentence}"`);
    }
    // the check itself: it catches what it is there for ...
    for (const telling of [
      'Type an advanced code to see more.',
      'Unlocked: 5 examples. There are more examples for other codes.',
      'This code does not open the hidden examples.',
      'Upgrade your code.',
      'There are two kinds of code.',
      'Unlocked: all seven examples.',
      'Your code opens the basic examples.',
      'The rest is for members of a higher level.',
    ]) {
      assert.match(telling, HINTS_AT_MORE, `"${telling}"`);
    }
    // ... and lets through what the window really has to say
    for (const harmless of ['Use a different code', 'Your current code is still in use.', 'Unlocked: every example below is ready to load.', 'Members only']) {
      assert.doesNotMatch(harmless, HINTS_AT_MORE, `"${harmless}"`);
    }
  });

  test('with an accepted code the window says "every example below" - never how many, never "all"', () => {
    const unlocked = say('unlocked', 'typed');
    assert.equal(unlocked, 'Unlocked: every example below is ready to load.');
    assert.equal(say('unlocked', 'saved'), unlocked, 'the same whichever code it was');
    assert.doesNotMatch(unlocked, /\d|\ball\b/i);
    // the same sentence whatever else is passed in: there is one "unlocked", not one per kind of code
    assert.equal(textOf(codeMessage({ phase: 'unlocked', about: 'typed' }, ORG, true)), unlocked);
  });

  test('a different code that was accepted is said to be accepted - the examples may look the same as before', () => {
    const replaced = textOf(codeMessage({ phase: 'unlocked', about: 'typed', replaced: true }, ORG, true));
    assert.equal(replaced, 'Your new code was accepted: every example below is ready to load.');
    assert.notEqual(replaced, say('unlocked', 'typed'), 'somebody who typed a different code can tell that it worked');
    assert.equal(codeMessage({ phase: 'unlocked', about: 'typed', replaced: true }, ORG, true).tone, 'good');
    // it says what the field said ("Nothing changes until it is accepted") - and nothing about what the code opened
    assert.match(EXAMPLES_WORDS.currentCodeStays, /accepted/);
    assert.doesNotMatch(replaced, /\d|\ball\b|\bnew examples\b|\bnow\b|\bmore\b/i);
  });

  test('true whichever cards are on the screen: what a code does is said of "the examples it opened"', () => {
    // Some examples may be open without a code. So a sentence about locking must not say that
    // "the examples" are locked - that would be untrue for the cards that stay open.
    const aboutLocking = [say('rejected', 'saved'), say('unreachable', 'saved'), EXAMPLES_WORDS.forgetQuestion];
    for (const sentence of aboutLocking) {
      assert.match(sentence, /\block/i, `"${sentence}" is about locking`);
      assert.match(sentence, /the examples it (opened|opens)\b/i, `"${sentence}"`);
      assert.doesNotMatch(sentence, /\b(the|all|every|your) examples? (are|is|stay|stays|will be|were) locked/i, `"${sentence}"`);
    }
    assert.equal(say('rejected', 'saved').split('.')[0], 'The member code saved on this device no longer works, so the examples it opened are locked again');
    assert.equal(EXAMPLES_WORDS.forgetQuestion, 'Forget this code? The examples it opened will be locked until you type it again.');
    // and nothing else the window can say speaks of locking at all - but for the line over a window in which every card is locked
    for (const sentence of everySentence()) {
      if (aboutLocking.includes(sentence) || sentence === EXAMPLES_WORDS.buttonHintLocked) continue;
      assert.doesNotMatch(sentence, /\block(ed|s)?\b/i, `"${sentence}"`);
    }
    // what is said once a code is accepted is said of the cards "below": true for any number of them
    for (const status of [{ phase: 'unlocked', about: 'typed' }, { phase: 'unlocked', about: 'saved' }, { phase: 'unlocked', about: 'typed', replaced: true }] as CodeStatus[]) {
      assert.match(textOf(codeMessage(status, ORG, true)), /every example below is ready to load\.$/);
    }
  });

  test('no technical words anywhere', () => {
    for (const sentence of everySentence()) {
      assert.doesNotMatch(sentence, TECHNICAL, `"${sentence}"`);
      assert.doesNotMatch(sentence, /undefined|null|NaN|\[object/, `"${sentence}"`);
    }
  });

  test('the tone fits: only an open window is "good", only a problem is "bad"', () => {
    const tone = (phase: CodePhase) => ABOUT.map((about) => codeMessage({ phase, about }, ORG).tone);
    assert.deepEqual(tone('none'), ['hint', 'hint']);
    assert.deepEqual(tone('checking'), ['info', 'info']);
    assert.deepEqual(tone('unlocked'), ['good', 'good']);
    for (const phase of ['rejected', 'busy', 'unreachable'] as const) assert.deepEqual(tone(phase), ['bad', 'bad']);
  });

  test('before anything is typed: what a code looks like, and where members get one', () => {
    const hint = codeMessage({ phase: 'none', about: 'saved' }, ORG);
    assert.equal(hint.lead, undefined);
    assert.deepEqual(hint.rest, [`A code looks like ${CODE_LOOKS_LIKE}.`, `Members get theirs from ${ORG}.`]);
  });

  test('a wrong code: kind, about a typing mistake, shows what a code looks like, says whom to ask', () => {
    const text = say('rejected', 'typed');
    assert.match(text, /did not open the examples/);
    assert.match(text, /typing mistake/);
    assert.ok(text.includes(CODE_LOOKS_LIKE));
    assert.ok(text.includes(`ask ${ORG}`));
    assert.doesNotMatch(text, /\b(wrong|bad|error|failed|denied|you (typed|made|entered))\b/i, 'no blame');
  });

  test('a saved code that was cancelled: locked again, ask for a new code - not "check your typing"', () => {
    const text = say('rejected', 'saved');
    assert.match(text, /saved on this device/);
    assert.match(text, /no longer works/);
    assert.match(text, /locked again/);
    assert.ok(text.includes(`ask ${ORG} for a new code`));
    assert.doesNotMatch(text, /typing mistake/);
  });

  test('"the website could not be reached" never says or hints that the code is wrong', () => {
    for (const about of ABOUT) {
      const text = say('unreachable', about);
      assert.match(text, /website could not be reached/);
      assert.match(text, /could not be checked/);
      assert.match(text, /internet connection/);
      assert.doesNotMatch(text, /did not open|no longer works|typing mistake|new code/);
    }
    // the saved code: honest that the examples stay locked meanwhile, and how to try again
    assert.match(say('unreachable', 'saved'), /stay locked until it has been checked/);
    assert.ok(say('unreachable', 'saved').includes(`“${EXAMPLES_WORDS.tryAgain}”`));
    assert.doesNotMatch(EXAMPLES_WORDS.websiteNotReached, /code|member/i, 'said to a visitor who has no code');
  });

  test('too many wrong codes: says for how long to wait, as far as that is known', () => {
    assert.match(say('busy', 'typed'), /Please wait a little, then try again\.$/);
    assert.match(say('busy', 'typed', 0), /Please wait a little, then try again\.$/);
    assert.match(say('busy', 'typed', 1), /Please wait a moment, then try again\.$/);
    assert.match(say('busy', 'typed', 15), /Please wait a moment, then try again\.$/);
    assert.match(say('busy', 'typed', 45), /Please wait a minute, then try again\.$/);
    assert.match(say('busy', 'saved', 91), /Please wait 2 minutes, then try again\.$/);
    assert.match(say('busy', 'saved', 600), /Please wait 10 minutes, then try again\.$/);
    assert.doesNotMatch(say('busy', 'typed', 600), /did not open|no longer works/, 'nothing is known about this code');
  });

  test('a different code, typed while the examples are open: neutral words, and the code in use stays in use', () => {
    assert.equal(EXAMPLES_WORDS.useDifferentCode, 'Use a different code');
    assert.doesNotMatch(EXAMPLES_WORDS.differentCodeLabel, /member/i, 'the field is for any code');
    for (const word of [EXAMPLES_WORDS.useDifferentCode, EXAMPLES_WORDS.differentCodeLabel, EXAMPLES_WORDS.useThisCode, EXAMPLES_WORDS.keepCurrentCode]) {
      assert.ok(word.length > 3 && !/[.!?]$/.test(word), `a label, not a sentence: "${word}"`);
    }

    // before anything is typed: what a code looks like, and that nothing changes until one is accepted
    const hint = codeMessage({ phase: 'none', about: 'typed' }, ORG, true);
    assert.equal(hint.tone, 'hint');
    assert.deepEqual(hint.rest, [`A code looks like ${CODE_LOOKS_LIKE}.`, EXAMPLES_WORDS.currentCodeStays]);
    assert.equal(EXAMPLES_WORDS.currentCodeStays, 'Nothing changes until it is accepted.');
    // (each of the two lines fits on one line of a phone, so that nothing moves when "Checking your code…" takes their place)
    for (const line of hint.rest) assert.ok(line.length <= 40, `"${line}" is short`);

    // refused: kind, about a typing mistake - and plainly: nothing has changed
    const refused = sayWhileOpen('rejected');
    assert.match(refused, /was not accepted, so nothing has changed/);
    assert.match(refused, /typing mistake/);
    assert.ok(refused.includes(CODE_LOOKS_LIKE));
    assert.ok(refused.endsWith(EXAMPLES_WORDS.currentCodeStillInUse));
    assert.doesNotMatch(refused, /\b(wrong|bad|error|failed|denied|you (typed|made|entered))\b/i, 'no blame');
    assert.doesNotMatch(refused, /locked|did not open|no longer works|new code/, 'the examples are still open');

    // not reached, or asked to wait: said as such, and the code in use is still in use
    for (const phase of ['unreachable', 'busy'] as const) {
      const text = sayWhileOpen(phase, 30);
      assert.ok(text.endsWith(EXAMPLES_WORDS.currentCodeStillInUse), phase);
      assert.doesNotMatch(text, /stay locked|locked again|not accepted|typing mistake/, phase);
    }
    assert.match(sayWhileOpen('unreachable'), /website could not be reached/);
    assert.match(sayWhileOpen('unreachable'), /could not be checked/);
    assert.match(sayWhileOpen('busy', 30), /Please wait a minute, then try again\./);
    assert.equal(sayWhileOpen('checking'), 'Checking your code…');
    for (const phase of WHILE_OPEN) assert.equal(codeMessage({ phase, about: 'typed' }, ORG, true).tone, codeMessage({ phase, about: 'typed' }, ORG).tone, phase);
  });

  test('checking: a typed code and the saved code are told apart', () => {
    assert.equal(say('checking', 'typed'), 'Checking your code…');
    assert.equal(say('checking', 'saved'), 'Checking the member code saved on this device…');
  });

  test('the line at the top: members only is said plainly, and a visitor without a code is not sent to the examples', () => {
    const locked = examplesIntro('locked', ORG);
    assert.ok(locked.includes(`for registered ${ORG} members`));
    assert.match(locked, /type your member code below/);
    assert.match(locked, /Everything else in the simulator works without a code\.$/);
    assert.doesNotMatch(locked, /\b(load|run|read|open) (one|them|an example|the examples)\b/i);
    assert.ok(locked.split(/(?<=[.!?])\s+/).length <= 2, 'one or two sentences');

    // a member who is back is not asked to type a code while the saved one is being checked
    const checking = examplesIntro('checking-saved', ORG);
    assert.ok(checking.includes(`for registered ${ORG} members`));
    assert.doesNotMatch(checking, /type/i);

    // some examples are open to everyone: the rest is still marked
    const some = examplesIntro('some-open', ORG);
    assert.ok(some.includes(`“${EXAMPLES_WORDS.membersOnly}” are for registered ${ORG} members`));
    assert.match(some, /Loading one replaces the blocks/);

    // unlocked: nothing about members or codes is left to say
    assert.doesNotMatch(examplesIntro('unlocked', ORG), /member|code/i);

    // every card is open without a code: nothing is marked "Members only", so nothing is said about it
    assert.equal(examplesIntro('all-open', ORG), examplesIntro('unlocked', ORG));

    // a member is back, and some cards can be loaded while the saved code is checked: the very
    // words of "unlocked", so that no card moves under a finger when the code is accepted
    assert.equal(examplesIntro('checking-some-open', ORG), examplesIntro('unlocked', ORG));

    // no cards (the website has not answered, or could not be reached): only what the examples are -
    // nothing about members, nothing about loading one
    const notKnown = examplesIntro('not-known', ORG);
    assert.equal(notKnown, 'Ready-made programs to run, read and change.');
    assert.doesNotMatch(notKnown, /member|code|loading/i);
  });

  test('no cards to show: loading is said as such, and "not reached" comes with a way to try again', () => {
    assert.match(EXAMPLES_WORDS.loadingExamples, /^Loading the examples…$/);
    assert.match(EXAMPLES_WORDS.websiteNotReached, /^The examples cannot be shown: the website could not be reached just now\./);
    assert.match(EXAMPLES_WORDS.websiteNotReached, /internet connection/);
    assert.match(EXAMPLES_WORDS.websiteNotReached, /try again\.$/);
    assert.equal(EXAMPLES_WORDS.tryAgain, 'Try again');
    assert.match(EXAMPLES_WORDS.noExamples, /^No examples/);
  });

  test('the organisation is never written into the words themselves', () => {
    for (const status of EVERY_STATUS) assert.ok(!textOf(codeMessage(status, 'the Robot Club')).includes('MakeX'));
    for (const status of EVERY_STATUS) assert.ok(!textOf(codeMessage(status, 'the Robot Club', true)).includes('MakeX'));
    for (const view of VIEWS) assert.ok(!examplesIntro(view, 'the Robot Club').includes('MakeX'));
    for (const text of Object.values(EXAMPLES_WORDS)) assert.ok(!text.includes('MakeX'));
  });

  test('forgetting the code is a question with a harmless and a clear answer', () => {
    assert.match(EXAMPLES_WORDS.forgetQuestion, /\?/);
    assert.match(EXAMPLES_WORDS.forgetQuestion, /type it again/);
    assert.equal(EXAMPLES_WORDS.forgetNo, 'Keep it');
    assert.match(EXAMPLES_WORDS.forgetYes, /^Yes, /);
    assert.match(EXAMPLES_WORDS.forget, /on this device$/);
  });
});

describe('how long to wait', () => {
  /** A pretend server that says "too many wrong codes", with or without saying for how long. */
  const busyServer = (retryAfter?: string) =>
    (async () => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter } })) as unknown as typeof fetch;

  test('the server says for how long (Retry-After, in seconds): the browser passes it on', async () => {
    assert.deepEqual(await requestUnlock(SOURCE, 'FIRE-AAAA-2222', busyServer('600')), { kind: 'busy', waitSeconds: 600 });
    assert.deepEqual(await requestUnlock(SOURCE, 'FIRE-AAAA-2222', busyServer('42')), { kind: 'busy', waitSeconds: 42 });
  });

  test('it does not say, or says nonsense: "busy" all the same, without a time', async () => {
    for (const header of [undefined, '', '0', '-5', 'soon', 'Wed, 21 Oct 2015 07:28:00 GMT']) {
      assert.deepEqual(await requestUnlock(SOURCE, 'FIRE-AAAA-2222', busyServer(header)), { kind: 'busy' }, `Retry-After: ${header}`);
    }
  });
});

describe('a short "wait" is waited out', () => {
  const CODE = 'FIRE-AAAA-2222';
  const yes = () =>
    Response.json({
      ok: true,
      member: true,
      levels: [{ id: 'starter', title: 'Starter', about: 'first steps' }],
      cards: [{ id: 'hello', title: 'Hello', level: 'starter' }],
      examples: [{ id: 'hello', title: 'Hello', level: 'starter', description: 'What it does.', program: blankProgram() }],
    });
  const wait = (seconds?: number) => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429, headers: seconds === undefined ? {} : { 'Retry-After': String(seconds) } });
  const no = () => Response.json({ ok: false, reason: 'invalid-code' }, { status: 403 });

  /** A pretend server that gives these answers one after the other, and a pretend clock. */
  function setup(answers: Array<() => Response>) {
    let asked = 0;
    const slept: number[] = [];
    const fetchImpl = (async () => answers[Math.min(asked++, answers.length - 1)]()) as unknown as typeof fetch;
    const sleep = async (ms: number) => void slept.push(ms);
    return { ask: () => requestUnlockPatiently(SOURCE, CODE, fetchImpl, sleep), asked: () => asked, slept };
  }

  test('"wait a second", then "yes": the member never hears about it', async () => {
    const server = setup([() => wait(1), yes]);
    const outcome = await server.ask();
    assert.equal(outcome.kind, 'examples');
    assert.equal(server.asked(), 2);
    assert.equal(server.slept.length, 1);
    assert.ok(server.slept[0] >= 1000 && server.slept[0] < 1500, `waited ${server.slept[0]} ms: what the server asked for, and a little more`);
  });

  test('"wait", then "no": the code is refused as usual', async () => {
    const server = setup([() => wait(2), no]);
    assert.deepEqual(await server.ask(), { kind: 'rejected' });
    assert.equal(server.asked(), 2);
  });

  test(`it asks ${PATIENT_TRIES} times at most, then says "wait"`, async () => {
    const server = setup([() => wait(1)]);
    assert.deepEqual(await server.ask(), { kind: 'busy', waitSeconds: 1 });
    assert.equal(server.asked(), PATIENT_TRIES);
    assert.equal(server.slept.length, PATIENT_TRIES - 1);
  });

  test('a long wait, or one without a time, is passed on at once', async () => {
    const long = setup([() => wait(PATIENCE_SECONDS + 1), yes]);
    assert.deepEqual(await long.ask(), { kind: 'busy', waitSeconds: PATIENCE_SECONDS + 1 });
    assert.equal(long.asked(), 1);
    const unknown = setup([() => wait(), yes]);
    assert.deepEqual(await unknown.ask(), { kind: 'busy' });
    assert.equal(unknown.asked(), 1);
    assert.deepEqual([...long.slept, ...unknown.slept], []);
  });

  test('every other answer comes back from the first question', async () => {
    for (const [answer, kind] of [[yes, 'examples'], [no, 'rejected'], [() => new Response('<html>', { status: 502 }), 'unreachable']] as const) {
      const server = setup([answer]);
      assert.equal((await server.ask()).kind, kind);
      assert.equal(server.asked(), 1);
    }
  });
});

// =============================================================================================
// The window as each kind of visitor sees it
// =============================================================================================

describe('the window as each kind of visitor sees it', () => {
  // made-up codes of the right shape, put on the two lists of a pretend server
  const MEMBER_CODE = 'FIRE-AAAA-2222';
  const ADVANCED_CODE = 'FIRE-DDDD-5555';
  const KEPT_FOR_ADVANCED = ['smart-bucket', 'full-mission'];
  /** Everything about the examples kept for advanced codes that must not stand in the window of anybody else. */
  const TELLING = [...KEPT_FOR_ADVANCED, 'Smart bucket', 'Full mission', 'dvanced', 'whole match', 'adapting to the combination'];

  let visitor: Shelf;
  let member: Shelf;
  let advanced: Shelf;

  /** A pretend server with the examples of every game: the starters open to everyone, the advanced ones for advanced codes only. */
  let setup: UnlockSetup;
  /** What the browser makes of the server's answer about one game to this code (null: no code). */
  const ask = async (code: string | null, game: ExamplesSource['game'] = SOURCE.game): Promise<Shelf> => {
    const answer = await handleUnlockRequest({ method: 'POST', body: JSON.stringify(code === null ? { game } : { game, code }), contentType: 'application/json', client: 'test' }, setup);
    const outcome = readUnlockAnswer(answer.status, JSON.parse(JSON.stringify(answer.body)));
    assert.ok(outcome.kind === 'examples', `the server answers ${code === null ? 'a visitor' : 'a code'}`);
    return shelfOf(outcome);
  };

  before(async () => {
    setup = {
      codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(MEMBER_CODE) as string) }],
      advancedCodes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(ADVANCED_CODE) as string) }],
      games: ALL_GAMES,
      openToEveryone: ['hello', 'line-follow', 'gripper-demo', 'chief-first-wall', 'chief-count-lines', 'chief-flame-fan'],
      advancedOnly: [...KEPT_FOR_ADVANCED, 'chief-full-mission'],
    };
    visitor = await ask(null);
    member = await ask(MEMBER_CODE);
    advanced = await ask(ADVANCED_CODE);
  });

  const nothing = (): void => {};

  /** The state of the window: what the server answered, and where things stand with the code. */
  function windowWith(shelf: Shelf | null, over: Partial<MemberExamples> = {}): MemberExamples {
    return {
      config: { ...SOURCE, organisation: ORG },
      levels: shelf?.levels ?? [],
      cards: shelf?.cards ?? [],
      available: shelf?.available ?? {},
      unlocked: false,
      changing: false,
      status: { phase: 'none', about: 'saved' },
      openList: 'ready',
      savedCode: null,
      remembered: true,
      draft: '',
      setDraft: nothing,
      submit: nothing,
      retry: nothing,
      forget: nothing,
      startChange: nothing,
      cancelChange: nothing,
      refreshOpenList: nothing,
      askAgainIfNotReached: nothing,
      ...over,
    };
  }
  /** The window of somebody whose code was accepted (the code that is shown as saved is the same for every kind). */
  const unlockedWith = (shelf: Shelf, over: Partial<MemberExamples> = {}): MemberExamples =>
    windowWith(shelf, { unlocked: true, status: { phase: 'unlocked', about: 'typed' }, savedCode: MEMBER_CODE, ...over });
  /** ... and while a different code is typed in the place of the one in use. */
  const changingWith = (shelf: Shelf, status: CodeStatus): MemberExamples => unlockedWith(shelf, { changing: true, status, draft: 'FIRE-BBBB-3333' });

  /** The window, drawn. */
  const draw = (examples: MemberExamples): string => renderToStaticMarkup(createElement(ExamplesDialog, { examples, onLoad: nothing, onClose: nothing }));

  const decode = (text: string): string =>
    text
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  /** Every word a drawn window shows or says aloud: its texts, and what its controls are called. */
  function wordsOf(html: string): string {
    const said = [...html.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((match) => match[1]);
    const shown = html.replace(/<[^>]*>/g, ' ');
    return decode([...said, shown].join(' ')).replace(/\s+/g, ' ').trim();
  }
  /** The window without the cards and their headings: only what the window itself adds to the server's answer. */
  const withoutCards = (html: string): string => html.replace(/<section[^>]*\sdata-example-level="[^"]*"[^>]*>[\s\S]*?<\/section>/g, '');
  const ownWords = (html: string): string => wordsOf(withoutCards(html));

  const cardsIn = (html: string): string[] => [...html.matchAll(/<li data-example="([^"]*)" data-locked="(true|false)"/g)].map((match) => `${match[1]}${match[2] === 'true' ? ' (locked)' : ''}`);
  const headingsIn = (html: string): string[] => [...html.matchAll(/<section[^>]*\sdata-example-level="([^"]*)"/g)].map((match) => match[1]);

  /** Every way the code panel can stand while no code is accepted. */
  const NOT_UNLOCKED: Array<Partial<MemberExamples>> = [
    { status: { phase: 'none', about: 'saved' } },
    { status: { phase: 'checking', about: 'typed' }, draft: 'FIRE-BBBB-3333' },
    { status: { phase: 'rejected', about: 'typed' }, draft: 'FIRE-BBBB-3333' },
    { status: { phase: 'busy', about: 'typed', waitSeconds: 300 }, draft: 'FIRE-BBBB-3333' },
    { status: { phase: 'unreachable', about: 'typed' }, draft: 'FIRE-BBBB-3333' },
    { status: { phase: 'checking', about: 'saved' }, savedCode: MEMBER_CODE },
    { status: { phase: 'rejected', about: 'saved' }, savedCode: MEMBER_CODE },
    { status: { phase: 'busy', about: 'saved', waitSeconds: 300 }, savedCode: MEMBER_CODE },
    { status: { phase: 'unreachable', about: 'saved' }, savedCode: MEMBER_CODE },
  ];
  /** Every way it can stand while a different code is typed. */
  const WHILE_CHANGING: CodeStatus[] = [
    { phase: 'none', about: 'typed' },
    { phase: 'checking', about: 'typed' },
    { phase: 'rejected', about: 'typed' },
    { phase: 'busy', about: 'typed', waitSeconds: 300 },
    { phase: 'unreachable', about: 'typed' },
  ];
  /** Every way it can stand once a code is accepted. */
  const ACCEPTED: Array<Partial<MemberExamples>> = [
    { status: { phase: 'unlocked', about: 'typed' } },
    { status: { phase: 'unlocked', about: 'saved' } },
    { status: { phase: 'unlocked', about: 'typed', replaced: true } },
    { status: { phase: 'unlocked', about: 'typed' }, remembered: false },
  ];

  test('a visitor: the starter cards open, the intermediate ones "Members only" - and nothing else', () => {
    for (const state of NOT_UNLOCKED) {
      const html = draw(windowWith(visitor, state));
      const where = `${state.status?.phase}/${state.status?.about}`;
      assert.deepEqual(cardsIn(html), ['hello', 'line-follow', 'gripper-demo', 'one-bucket (locked)', 'one-person (locked)'], where);
      assert.deepEqual(headingsIn(html), ['starter', 'intermediate'], where);
      assert.equal(html.split(EXAMPLES_WORDS.membersOnly).length - 1, 2 + (/“Members only”/.test(wordsOf(html)) ? 1 : 0), `${where}: "Members only" on the two locked cards (and in the line at the top)`);
      assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 3, where);
      for (const telling of TELLING) assert.ok(!html.includes(telling), `${where}: "${telling}" is nowhere in the window`);
      assert.doesNotMatch(ownWords(html), HINTS_AT_MORE, where);
    }
  });

  test('a member code: five open cards, nothing locked, nothing that looks like a gap', () => {
    for (const state of ACCEPTED) {
      const html = draw(unlockedWith(member, state));
      const where = JSON.stringify(state);
      assert.deepEqual(cardsIn(html), ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person'], where);
      assert.deepEqual(headingsIn(html), ['starter', 'intermediate'], where);
      assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 5, where);
      for (const telling of TELLING) assert.ok(!html.includes(telling), `${where}: "${telling}" is nowhere in the window`);
      const words = wordsOf(html);
      assert.doesNotMatch(words, /members only|\block(ed|s)?\b|\bmissing\b|\bnot available\b|\bcoming soon\b/i, `${where}: nothing is said to be locked or missing`);
      assert.doesNotMatch(ownWords(html), HINTS_AT_MORE, where);
      // no empty heading, no empty list: every heading has its cards
      assert.equal(html.split('<ul').length - 1, 2, where);
      assert.doesNotMatch(html, /<ul[^>]*>\s*<\/ul>/, where);
    }
    // the same while this member types a different code - whatever comes of it
    for (const status of WHILE_CHANGING) {
      const html = draw(changingWith(member, status));
      assert.deepEqual(cardsIn(html), ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person'], status.phase);
      for (const telling of TELLING) assert.ok(!html.includes(telling), `${status.phase}: "${telling}" is nowhere in the window`);
      assert.doesNotMatch(wordsOf(html), /members only|\block(ed|s)?\b/i, status.phase);
      assert.doesNotMatch(ownWords(html), HINTS_AT_MORE, status.phase);
    }
  });

  test('an advanced code: all seven cards, under three headings', () => {
    const html = draw(unlockedWith(advanced));
    assert.deepEqual(cardsIn(html), ['hello', 'line-follow', 'gripper-demo', 'one-bucket', 'one-person', 'smart-bucket', 'full-mission']);
    assert.deepEqual(headingsIn(html), ['starter', 'intermediate', 'advanced']);
    assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 7);
    assert.ok(html.includes('Smart bucket') && html.includes('Full mission'));
    assert.doesNotMatch(wordsOf(html), /members only/i);
  });

  test('the window adds the very same words for a member code and for an advanced code: only the cards differ', () => {
    for (const state of ACCEPTED) {
      assert.equal(withoutCards(draw(unlockedWith(member, state))), withoutCards(draw(unlockedWith(advanced, state))), JSON.stringify(state));
    }
    for (const status of WHILE_CHANGING) {
      assert.equal(withoutCards(draw(changingWith(member, status))), withoutCards(draw(changingWith(advanced, status))), status.phase);
    }
    // (the check itself: the cards do differ, and what is cut away is the cards and nothing else)
    assert.notEqual(draw(unlockedWith(member)), draw(unlockedWith(advanced)));
    assert.ok(withoutCards(draw(unlockedWith(advanced))).includes('Unlocked: every example below is ready to load.'));
    assert.ok(!withoutCards(draw(unlockedWith(advanced))).includes('data-example='));
  });

  test('the headings and the cards are the ones of the answer, and no others', () => {
    // an answer that names other levels and other examples: the window shows those
    const other = shelfOf({
      levels: [{ id: 'z', title: 'Last season', about: 'kept for reference' }],
      cards: [{ id: 'old', title: 'An old program', level: 'z' }],
      examples: [],
    });
    const html = draw(windowWith(other));
    assert.deepEqual(headingsIn(html), ['z']);
    assert.deepEqual(cardsIn(html), ['old (locked)']);
    assert.ok(wordsOf(html).includes('Last season') && wordsOf(html).includes('kept for reference') && wordsOf(html).includes('An old program'));
    for (const word of ['Starter', 'Intermediate', 'Advanced', 'first steps']) assert.ok(!html.includes(word), `"${word}" is not a word of the window itself`);
  });

  test('no answer yet, or the website not reached: no cards, no headings - and an honest line', () => {
    const loading = draw(windowWith(null, { openList: 'loading' }));
    assert.deepEqual([cardsIn(loading), headingsIn(loading)], [[], []]);
    assert.ok(wordsOf(loading).includes(EXAMPLES_WORDS.loadingExamples));
    assert.ok(!wordsOf(loading).includes(EXAMPLES_WORDS.tryAgain));

    const notReached = draw(windowWith(null, { openList: 'unreachable' }));
    assert.deepEqual([cardsIn(notReached), headingsIn(notReached)], [[], []]);
    assert.ok(wordsOf(notReached).includes(EXAMPLES_WORDS.websiteNotReached));
    assert.equal(notReached.split(`>${EXAMPLES_WORDS.tryAgain}<`).length - 1, 1, 'one "Try again"');
    assert.ok(!wordsOf(notReached).includes(EXAMPLES_WORDS.loadingExamples));

    // the saved code could not be checked either: the panel says so, with the one "Try again"
    const savedNotReached = draw(windowWith(null, { openList: 'unreachable', savedCode: MEMBER_CODE, status: { phase: 'unreachable', about: 'saved' } }));
    assert.deepEqual([cardsIn(savedNotReached), headingsIn(savedNotReached)], [[], []]);
    assert.equal(savedNotReached.split(`>${EXAMPLES_WORDS.tryAgain}<`).length - 1, 1, 'one "Try again"');
    assert.ok(wordsOf(savedNotReached).includes('could not be checked'));
    assert.ok(wordsOf(savedNotReached).includes(hiddenCode(MEMBER_CODE)), 'which code is saved is shown, half hidden');
    assert.ok(!savedNotReached.includes(MEMBER_CODE), 'the saved code is never shown in full');

    for (const html of [loading, notReached, savedNotReached]) {
      assert.doesNotMatch(wordsOf(html), HINTS_AT_MORE);
      assert.doesNotMatch(wordsOf(html), /members only/i, 'no card, so nothing is marked');
    }
  });

  test('the same window in Fire Chief: it draws the answer about that game for each kind of visitor - and not a word of Fire Rescue', async () => {
    const STARTERS = ['chief-first-wall', 'chief-count-lines', 'chief-flame-fan'];
    const FOR_MEMBERS = [...STARTERS, 'chief-wall-follow', 'chief-face-flame'];
    const chief = ALL_GAMES.find((game) => game.game === 'fire-chief');
    const rescue = ALL_GAMES.find((game) => game.game === 'fire-rescue');
    assert.ok(chief && rescue);
    /** What must not stand in the window of anybody without an advanced code, and what must stand in nobody's: the other game. */
    const KEPT = ['chief-full-mission', 'The whole mission on any maze', 'dvanced', chief.levels[2].about];
    const OTHER_GAME = [...rescue.examples.flatMap((example) => [`"${example.id}"`, example.title]), ...rescue.levels.map((level) => level.about)];
    const inChief = (window: MemberExamples): MemberExamples => ({ ...window, config: { unlockUrl: '/u', game: 'fire-chief', organisation: ORG } });

    for (const state of NOT_UNLOCKED) {
      const html = draw(inChief(windowWith(await ask(null, 'fire-chief'), state)));
      const where = `a visitor, ${state.status?.phase}/${state.status?.about}`;
      assert.deepEqual(cardsIn(html), [...STARTERS, 'chief-wall-follow (locked)', 'chief-face-flame (locked)'], where);
      assert.deepEqual(headingsIn(html), ['starter', 'intermediate'], where);
      assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 3, where);
      for (const telling of [...KEPT, ...OTHER_GAME]) assert.ok(!html.includes(telling), `${where}: "${telling}" is nowhere in the window`);
      assert.doesNotMatch(ownWords(html), HINTS_AT_MORE, where);
    }
    for (const state of ACCEPTED) {
      const html = draw(inChief(unlockedWith(await ask(MEMBER_CODE, 'fire-chief'), state)));
      const where = `a member, ${JSON.stringify(state)}`;
      assert.deepEqual(cardsIn(html), FOR_MEMBERS, where);
      assert.deepEqual(headingsIn(html), ['starter', 'intermediate'], where);
      assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 5, where);
      for (const telling of [...KEPT, ...OTHER_GAME]) assert.ok(!html.includes(telling), `${where}: "${telling}" is nowhere in the window`);
      assert.doesNotMatch(wordsOf(html), /members only|\block(ed|s)?\b|\bmissing\b|\bnot available\b|\bcoming soon\b/i, `${where}: nothing is said to be locked or missing`);
      assert.doesNotMatch(ownWords(html), HINTS_AT_MORE, where);
    }
    for (const state of ACCEPTED) {
      const html = draw(inChief(unlockedWith(await ask(ADVANCED_CODE, 'fire-chief'), state)));
      const where = `an advanced code, ${JSON.stringify(state)}`;
      assert.deepEqual(cardsIn(html), [...FOR_MEMBERS, 'chief-full-mission'], where);
      assert.deepEqual(headingsIn(html), ['starter', 'intermediate', 'advanced'], where);
      assert.equal(html.split(EXAMPLES_WORDS.loadExample).length - 1, 6, where);
      for (const telling of OTHER_GAME) assert.ok(!html.includes(telling), `${where}: "${telling}" is nowhere in the window`);
      for (const level of chief.levels) assert.ok(wordsOf(html).includes(level.about), `${where}: the heading of Fire Chief, "${level.about}"`);
    }
    // what the window itself adds to the answer is the same in both games, word for word
    assert.equal(ownWords(draw(inChief(windowWith(await ask(null, 'fire-chief'))))), ownWords(draw(windowWith(visitor))));
    assert.equal(ownWords(draw(inChief(unlockedWith(await ask(MEMBER_CODE, 'fire-chief'))))), ownWords(draw(unlockedWith(member))));
  });

  test('a member is back: while the saved code is checked the line at the top is the one that stays', () => {
    const intro = (html: string): string => decode((html.match(/<p[^>]*data-examples-intro[^>]*>([\s\S]*?)<\/p>/) ?? ['', ''])[1]);
    const checking = draw(windowWith(visitor, { status: { phase: 'checking', about: 'saved' }, savedCode: MEMBER_CODE }));
    assert.equal(intro(checking), examplesIntro('checking-some-open', ORG));
    assert.equal(intro(checking), intro(draw(unlockedWith(member, { status: { phase: 'unlocked', about: 'saved' } }))), 'nothing above the cards changes when the code is accepted');
    assert.ok(wordsOf(checking).includes('Checking the member code saved on this device…'));
    assert.ok(!checking.includes('name="member-code"'), 'nothing to type while the saved code is checked');
    // a visitor without a code reads what "Members only" means
    assert.equal(intro(draw(windowWith(visitor))), examplesIntro('some-open', ORG));
  });
});
