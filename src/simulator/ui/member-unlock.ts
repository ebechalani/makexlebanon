/**
 * The browser's side of the Examples window: ask the website's server which examples this
 * visitor may see and open, and read its answer.
 *
 * Nothing about the examples is part of the simulator the browser downloads: no program, no
 * description, no title, no list. All of it arrives here, in the server's answer - the cards
 * this visitor may see, the headings they stand under, and the examples this visitor may open
 * (the server's side is ../members/unlock.ts). The window draws exactly what the answer holds.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node with a pretend server.
 */
import type { ProgramJson } from '../core/types';
import { CODE_EXAMPLE, formatCode, maskCode, normalizeCode } from '../members/code-format.mjs';
import { isProgramJson } from './program-file';
import { isRecord, storageKey } from './storage';

// =============================================================================================
// Examples
// =============================================================================================

/** A heading of the Examples window, with the cards of one level below it. */
export interface ExampleLevel {
  /** the name the cards refer to */
  id: string;
  /** the word on the coloured label */
  title: string;
  /** the few words after it */
  about: string;
}

/** An example this visitor may see: enough to draw its card. */
export interface ExampleCard {
  id: string;
  title: string;
  /** the id of the level it stands under */
  level: string;
}

/** An example the server has handed out: it can be read and loaded. */
export interface ExampleProgram extends ExampleCard {
  /** what the program does and when it works, in a few plain sentences */
  description: string;
  program: ProgramJson;
}

/** What one answer of the server puts into the Examples window. */
export interface ExampleShelf {
  /** the headings, in the order of the window */
  levels: ExampleLevel[];
  /** every example this visitor may see, in the order of the window */
  cards: ExampleCard[];
  /** the ones of them this visitor may open */
  examples: ExampleProgram[];
}

/** A text that says something (not empty, not absurdly long). */
function isWords(value: unknown, longest: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= longest;
}

function readLevel(value: unknown): ExampleLevel | null {
  if (!isRecord(value)) return null;
  const { id, title, about } = value;
  if (!isWords(id, 40) || !isWords(title, 60) || typeof about !== 'string' || about.length > 200) return null;
  return { id, title, about };
}

function readCard(value: unknown): ExampleCard | null {
  if (!isRecord(value)) return null;
  const { id, title, level } = value;
  if (!isWords(id, 80) || !isWords(title, 200) || !isWords(level, 40)) return null;
  return { id, title, level };
}

function readExample(value: unknown): ExampleProgram | null {
  const card = readCard(value);
  if (!card || !isRecord(value)) return null;
  const { description, program } = value;
  if (typeof description !== 'string') return null;
  if (!isRecord(program) || !isProgramJson(program)) return null;
  return { ...card, description, program };
}

/** The readable items of a list, each id once (the first one counts). */
function readList<T extends { id: string }>(items: unknown[], read: (value: unknown) => T | null, keep: (item: T) => boolean = () => true): T[] {
  const list: T[] = [];
  for (const value of items) {
    const item = read(value);
    if (item && keep(item) && !list.some((other) => other.id === item.id)) list.push(item);
  }
  return list;
}

// =============================================================================================
// Asking the server
// =============================================================================================

/**
 * The games the server has examples for, by the names a request gives them. (They are the ids
 * of the games - `Game.id` - but a page says which examples it wants by itself: see
 * ExamplesSource.)
 */
export const EXAMPLES_GAMES = ['fire-rescue', 'fire-chief'] as const;
export type ExamplesGame = (typeof EXAMPLES_GAMES)[number];

/** Where to ask for examples, and for which game's. */
export interface ExamplesSource {
  /** address on this website that hands out the examples (see src/app/api/simulator/unlock/route.ts) */
  unlockUrl: string;
  /**
   * The game whose examples are wanted. The examples of every game are behind the one address,
   * and each request must say which game it is about: a request that does not say gets the
   * examples of Fire Rescue (that is how its page asked while it was the only game).
   */
  game: ExamplesGame;
}

/** How long an answer may take before the question is given up, in milliseconds. */
export const UNLOCK_TIMEOUT_MS = 15_000;

/**
 * What came of asking the server:
 *
 *   examples      the server answered: `member` says whether a code was accepted, `cards` and
 *                 `levels` hold what this visitor may see, and `examples` what they may open
 *                 (with an accepted code: every card)
 *   rejected      the server says no: the code is not (or no longer) accepted
 *   busy          too many wrong codes came from this network; the server asks to wait
 *                 (`waitSeconds`: for how long, when the server said so)
 *   unreachable   no answer, or an answer that makes no sense - nothing is known
 */
export type UnlockOutcome =
  | ({ kind: 'examples'; member: boolean } & ExampleShelf)
  | { kind: 'rejected' }
  | { kind: 'busy'; waitSeconds?: number }
  | { kind: 'unreachable' };

/**
 * The reasons with which the server refuses a code as such (see UnlockRefusal in ../members/unlock.ts).
 *
 * "unknown-game" is not one of them, on purpose: the server then did not look at the code at
 * all, so nothing is known about it. It is read like every answer that makes no sense
 * ("unreachable"), and a code that may well be right is not called wrong.
 */
const REFUSED_CODE = new Set(['invalid-code', 'bad-request', 'too-large']);

/** Read the server's answer. Anything that is not clearly "yes" or "no" counts as "unreachable". */
export function readUnlockAnswer(status: number, answer: unknown): UnlockOutcome {
  if (!isRecord(answer)) return { kind: 'unreachable' };
  if (status === 200 && answer.ok === true && typeof answer.member === 'boolean' && Array.isArray(answer.levels) && Array.isArray(answer.cards) && Array.isArray(answer.examples)) {
    // a card needs a heading to stand under, and an example needs its card: whatever is damaged is left out
    const levels = readList(answer.levels, readLevel);
    const cards = readList(answer.cards, readCard, (card) => levels.some((level) => level.id === card.level));
    const examples = readList(answer.examples, readExample, (example) => cards.some((card) => card.id === example.id));
    // an accepted code opens examples: an answer that names some, of which not one can be read, is a broken answer and not a "yes"
    if (answer.member && examples.length === 0 && (answer.examples.length > 0 || answer.cards.length > 0)) return { kind: 'unreachable' };
    return { kind: 'examples', member: answer.member, levels: levels.filter((level) => cards.some((card) => card.level === level.id)), cards, examples };
  }
  if (answer.ok !== false) return { kind: 'unreachable' };
  if (status === 429 || answer.reason === 'too-many-attempts') return { kind: 'busy' };
  if (status >= 400 && status < 500 && typeof answer.reason === 'string' && REFUSED_CODE.has(answer.reason)) return { kind: 'rejected' };
  return { kind: 'unreachable' };
}

/**
 * Ask the server what this visitor may see and open in one game: with a code, or with `null`
 * for what a visitor without a code gets. Never throws: a broken connection, a timeout and a
 * server error all come back as "unreachable".
 *
 * The request is `{ "game": "fire-chief" }` or `{ "game": "fire-chief", "code": "FIRE-..." }`:
 * the game is always named, the code only when there is one.
 */
export async function requestUnlock(
  from: ExamplesSource,
  code: string | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = UNLOCK_TIMEOUT_MS,
): Promise<UnlockOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(from.unlockUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(code === null ? { game: from.game } : { game: from.game, code }),
      cache: 'no-store',
      signal: controller.signal,
    });
    let answer: unknown = null;
    try {
      answer = await response.json();
    } catch {
      // not JSON: an error page of the server or of something in between
    }
    const outcome = readUnlockAnswer(response.status, answer);
    // the answer must fit the question: "member" for a code, "not a member" without one
    if (outcome.kind === 'examples' && outcome.member !== (code !== null)) return { kind: 'unreachable' };
    if (outcome.kind === 'busy') {
      // how long to wait is in the "Retry-After" header of the answer, in seconds
      const wait = Number(response.headers?.get('Retry-After'));
      if (Number.isFinite(wait) && wait > 0) return { kind: 'busy', waitSeconds: wait };
    }
    return outcome;
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/** A "wait" of at most this many seconds is simply waited out, without bothering the visitor ... */
export const PATIENCE_SECONDS = 5;
/** ... but the server is asked at most this many times for one code. */
export const PATIENT_TRIES = 3;

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ask the server about a code, and wait out a short "wait".
 *
 * When very many wrong codes came from one network (a classroom whose browsers all still send
 * a cancelled code, say), the server checks the codes from that network one after the other
 * and answers "wait a second" in between - also to a member whose code is right. Rather than
 * telling that member about wrong codes somebody else typed, the question is asked again after
 * the time the server named, up to PATIENT_TRIES times in all. A longer wait, or a "wait" that
 * names no time, is passed on at once.
 *
 * @param sleep  waits so many milliseconds (the tests bring their own)
 */
export async function requestUnlockPatiently(
  from: ExamplesSource,
  code: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = realSleep,
  timeoutMs: number = UNLOCK_TIMEOUT_MS,
): Promise<UnlockOutcome> {
  for (let attempt = 1; ; attempt++) {
    const outcome = await requestUnlock(from, code, fetchImpl, timeoutMs);
    if (outcome.kind !== 'busy' || outcome.waitSeconds === undefined || outcome.waitSeconds > PATIENCE_SECONDS || attempt >= PATIENT_TRIES) return outcome;
    // (a little longer than asked, and not the same for everybody: a room full of browsers must not all come back in the same instant)
    await sleep(outcome.waitSeconds * 1000 + Math.random() * 400);
  }
}

// =============================================================================================
// The code as it is typed, shown and remembered
// =============================================================================================

/** What a code looks like, for the text field. */
export const CODE_PLACEHOLDER = 'FIRE-XXXX-XXXX';
/** A made-up code for messages ("a code looks like ..."). */
export const CODE_LOOKS_LIKE = CODE_EXAMPLE;

/** A typed code in its handed-out form (FIRE-7K2M-9QXD), or null when it cannot be a code. */
export function tidyCode(typed: string): string | null {
  const characters = normalizeCode(typed);
  return characters === null ? null : formatCode(characters);
}

/** A code with its second half hidden (FIRE-7K2M-••••), for showing which code is saved. */
export function hiddenCode(code: string): string {
  const characters = normalizeCode(code);
  return characters === null ? '' : maskCode(characters);
}

/**
 * Where the browser keeps the code a member typed: ONE place for every game of the simulator.
 *
 * A code is not a code "for a game": it opens the examples of every game. So it is typed once
 * per device, whichever game it was typed in, and forgetting it forgets it for every game.
 *
 * The place is the one where Fire Rescue has kept the code since it was the only game - hence
 * the "fire-rescue" in its name - so that nobody who typed a code then has to type it again,
 * in either game. Do not rename it: every code saved in a browser would be lost.
 */
export const SAVED_CODE_KEY = storageKey('fire-rescue', 'member-code');

/** What is kept in the browser: `{ "code": "FIRE-7K2M-9QXD" }`. */
export function isSavedCode(value: unknown): value is { code: string } {
  return isRecord(value) && typeof value.code === 'string' && normalizeCode(value.code) !== null;
}
