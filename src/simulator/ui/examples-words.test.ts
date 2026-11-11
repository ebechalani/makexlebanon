/**
 * What the Examples window says about member codes (examples-words.ts): every sentence a
 * student can read there, in every state the window can be in.
 *
 * These tests do not check taste; they check the promises at the top of that file: plain
 * words, no technical terms, "not reached" never mixed up with "wrong code", and nothing that
 * sends a visitor without a code to examples they cannot open.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { codeMessage, examplesIntro, EXAMPLES_WORDS, type CodeMessage, type ExamplesView } from './examples-words';
import { blankProgram } from './program-file';
import { CODE_LOOKS_LIKE, PATIENCE_SECONDS, PATIENT_TRIES, requestUnlock, requestUnlockPatiently } from './member-unlock';
import type { CodePhase, CodeStatus } from './useMemberExamples';

const ORG = 'MakeX Lebanon';

/** Words a 12-year-old with a code on a piece of paper should never have to read. */
const TECHNICAL = /\b(server|hash|fingerprint|api|endpoint|localstorage|storage|cookie|request|response|http|json|database|cache|token|fetch|status code|error code|403|429|invalid|authenticat\w*|authori[sz]\w*|credential\w*|session)\b/i;

const PHASES: CodePhase[] = ['none', 'checking', 'unlocked', 'rejected', 'busy', 'unreachable'];
const ABOUT: CodeStatus['about'][] = ['typed', 'saved'];
const EVERY_STATUS: CodeStatus[] = PHASES.flatMap((phase) => ABOUT.map((about) => ({ phase, about })));

const textOf = (message: CodeMessage): string => [message.lead ?? '', ...message.rest].join(' ').trim();
const say = (phase: CodePhase, about: CodeStatus['about'], waitSeconds?: number): string => textOf(codeMessage({ phase, about, waitSeconds }, ORG));

const VIEWS: ExamplesView[] = ['unlocked', 'some-open', 'checking-saved', 'locked'];

/** Everything the window can say, as plain texts. */
function everySentence(): string[] {
  return [
    ...EVERY_STATUS.map((status) => textOf(codeMessage(status, ORG))),
    say('busy', 'typed', 1),
    say('busy', 'typed', 60),
    say('busy', 'saved', 420),
    ...VIEWS.map((view) => examplesIntro(view, ORG)),
    ...Object.values(EXAMPLES_WORDS),
  ];
}

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
  });

  test('the organisation is never written into the words themselves', () => {
    for (const status of EVERY_STATUS) assert.ok(!textOf(codeMessage(status, 'the Robot Club')).includes('MakeX'));
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
    assert.deepEqual(await requestUnlock('/u', 'FIRE-AAAA-2222', busyServer('600')), { kind: 'busy', waitSeconds: 600 });
    assert.deepEqual(await requestUnlock('/u', 'FIRE-AAAA-2222', busyServer('42')), { kind: 'busy', waitSeconds: 42 });
  });

  test('it does not say, or says nonsense: "busy" all the same, without a time', async () => {
    for (const header of [undefined, '', '0', '-5', 'soon', 'Wed, 21 Oct 2015 07:28:00 GMT']) {
      assert.deepEqual(await requestUnlock('/u', 'FIRE-AAAA-2222', busyServer(header)), { kind: 'busy' }, `Retry-After: ${header}`);
    }
  });
});

describe('a short "wait" is waited out', () => {
  const CODE = 'FIRE-AAAA-2222';
  const yes = () => Response.json({ ok: true, member: true, examples: [{ id: 'hello', title: 'Hello', level: 'starter', description: 'What it does.', program: blankProgram() }] });
  const wait = (seconds?: number) => Response.json({ ok: false, reason: 'too-many-attempts' }, { status: 429, headers: seconds === undefined ? {} : { 'Retry-After': String(seconds) } });
  const no = () => Response.json({ ok: false, reason: 'invalid-code' }, { status: 403 });

  /** A pretend server that gives these answers one after the other, and a pretend clock. */
  function setup(answers: Array<() => Response>) {
    let asked = 0;
    const slept: number[] = [];
    const fetchImpl = (async () => answers[Math.min(asked++, answers.length - 1)]()) as unknown as typeof fetch;
    const sleep = async (ms: number) => void slept.push(ms);
    return { ask: () => requestUnlockPatiently('/u', CODE, fetchImpl, sleep), asked: () => asked, slept };
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
