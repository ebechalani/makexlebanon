/**
 * The browser's side of the Examples window: ask the website's server which examples this
 * visitor may have, and read its answer.
 *
 * No example program and no description is part of the simulator the browser downloads. They
 * arrive here, in the server's answer: all of them for a member code that is on the list, and
 * without a code only the ones the owner has opened to everyone (the server's side is
 * ../members/unlock.ts).
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node with a pretend server.
 */
import type { ProgramJson } from '../core/types';
import { CODE_EXAMPLE, formatCode, maskCode, normalizeCode } from '../members/code-format.mjs';
import { isProgramJson } from './program-file';
import { isRecord } from './storage';

// =============================================================================================
// Examples
// =============================================================================================

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

const EXAMPLE_LEVELS: readonly string[] = ['starter', 'intermediate', 'advanced'];

/** What the browser knows about every example from the start: enough for a locked card. */
export interface ExampleCard {
  id: string;
  title: string;
  level: ExampleLevel;
}

/** An example the server has handed out: it can be read and loaded. */
export interface ExampleProgram extends ExampleCard {
  /** what the program does and when it works, in a few plain sentences */
  description: string;
  program: ProgramJson;
}

function readExample(value: unknown): ExampleProgram | null {
  if (!isRecord(value)) return null;
  const { id, title, level, description, program } = value;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof description !== 'string') return null;
  if (typeof level !== 'string' || !EXAMPLE_LEVELS.includes(level)) return null;
  if (!isRecord(program) || !isProgramJson(program)) return null;
  return { id, title, level: level as ExampleLevel, description, program };
}

// =============================================================================================
// Asking the server
// =============================================================================================

/** How long an answer may take before the question is given up, in milliseconds. */
export const UNLOCK_TIMEOUT_MS = 15_000;

/**
 * What came of asking the server:
 *
 *   examples      the server answered: `member` says whether the code is on the list, and
 *                 `examples` holds what this visitor may load (for a member: every example)
 *   rejected      the server says no: the code is not (or no longer) on the list
 *   busy          too many wrong codes came from this network; the server asks to wait
 *                 (`waitSeconds`: for how long, when the server said so)
 *   unreachable   no answer, or an answer that makes no sense - nothing is known
 */
export type UnlockOutcome =
  | { kind: 'examples'; member: boolean; examples: ExampleProgram[] }
  | { kind: 'rejected' }
  | { kind: 'busy'; waitSeconds?: number }
  | { kind: 'unreachable' };

/** The reasons with which the server refuses a code as such (see UnlockRefusal in ../members/unlock.ts). */
const REFUSED_CODE = new Set(['invalid-code', 'bad-request', 'too-large']);

/** Read the server's answer. Anything that is not clearly "yes" or "no" counts as "unreachable". */
export function readUnlockAnswer(status: number, answer: unknown): UnlockOutcome {
  if (!isRecord(answer)) return { kind: 'unreachable' };
  if (status === 200 && answer.ok === true && typeof answer.member === 'boolean' && Array.isArray(answer.examples)) {
    const examples: ExampleProgram[] = [];
    for (const item of answer.examples) {
      const example = readExample(item);
      if (example && !examples.some((e) => e.id === example.id)) examples.push(example);
    }
    // a member's answer always holds examples: one without any is a broken answer, not a "yes"
    if (answer.member && examples.length === 0) return { kind: 'unreachable' };
    return { kind: 'examples', member: answer.member, examples };
  }
  if (answer.ok !== false) return { kind: 'unreachable' };
  if (status === 429 || answer.reason === 'too-many-attempts') return { kind: 'busy' };
  if (status >= 400 && status < 500 && typeof answer.reason === 'string' && REFUSED_CODE.has(answer.reason)) return { kind: 'rejected' };
  return { kind: 'unreachable' };
}

/**
 * Ask the server what this visitor may have: with a member code, or with `null` for the
 * examples that are open to everyone. Never throws: a broken connection, a timeout and a server
 * error all come back as "unreachable".
 */
export async function requestUnlock(
  url: string,
  code: string | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = UNLOCK_TIMEOUT_MS,
): Promise<UnlockOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(code === null ? {} : { code }),
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
 * Ask the server about a member code, and wait out a short "wait".
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
  url: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = realSleep,
  timeoutMs: number = UNLOCK_TIMEOUT_MS,
): Promise<UnlockOutcome> {
  for (let attempt = 1; ; attempt++) {
    const outcome = await requestUnlock(url, code, fetchImpl, timeoutMs);
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

/** What is kept in the browser: `{ "code": "FIRE-7K2M-9QXD" }`. */
export function isSavedCode(value: unknown): value is { code: string } {
  return isRecord(value) && typeof value.code === 'string' && normalizeCode(value.code) !== null;
}
