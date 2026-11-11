/**
 * The browser's side of the members' examples: ask the website's server whether a member code
 * is on the list, and read its answer.
 *
 * The programs of the members' examples are not part of the simulator the browser downloads.
 * They arrive here, in the server's answer, and only for a code that is on the list (the
 * server's side is ../members/unlock.ts).
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node with a pretend server.
 */
import type { ProgramJson } from '../core/types';
import { CODE_EXAMPLE, formatCode, maskCode, normalizeCode } from '../members/code-format.mjs';
import { isProgramJson } from './program-file';
import { isRecord } from './storage';

/** How long an answer may take before the check is given up, in milliseconds. */
export const UNLOCK_TIMEOUT_MS = 15_000;

/**
 * What came of asking the server:
 *
 *   unlocked      the code is on the list; `programs` holds the members' programs by example id
 *   rejected      the server says no: the code is not (or no longer) on the list
 *   busy          too many wrong codes came from this network; the server asks to wait
 *   unreachable   no answer, or an answer that makes no sense - nothing is known about the code
 */
export type UnlockOutcome =
  | { kind: 'unlocked'; programs: Record<string, ProgramJson> }
  | { kind: 'rejected' }
  | { kind: 'busy' }
  | { kind: 'unreachable' };

/** The reasons with which the server refuses a code as such (see UnlockRefusal in ../members/unlock.ts). */
const REFUSED_CODE = new Set(['invalid-code', 'bad-request', 'too-large']);

/** Read the server's answer. Anything that is not clearly "yes" or "no" counts as "unreachable". */
export function readUnlockAnswer(status: number, answer: unknown): UnlockOutcome {
  if (!isRecord(answer)) return { kind: 'unreachable' };
  if (status === 200 && answer.ok === true && Array.isArray(answer.examples)) {
    const programs: Record<string, ProgramJson> = {};
    for (const example of answer.examples) {
      if (isRecord(example) && typeof example.id === 'string' && isRecord(example.program) && isProgramJson(example.program)) {
        programs[example.id] = example.program;
      }
    }
    return Object.keys(programs).length > 0 ? { kind: 'unlocked', programs } : { kind: 'unreachable' };
  }
  if (answer.ok !== false) return { kind: 'unreachable' };
  if (status === 429 || answer.reason === 'too-many-attempts') return { kind: 'busy' };
  if (status >= 400 && status < 500 && typeof answer.reason === 'string' && REFUSED_CODE.has(answer.reason)) return { kind: 'rejected' };
  return { kind: 'unreachable' };
}

/**
 * Ask the server to check a code. Never throws: a broken connection, a timeout and a server
 * error all come back as "unreachable".
 */
export async function requestUnlock(
  url: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = UNLOCK_TIMEOUT_MS,
): Promise<UnlockOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
      signal: controller.signal,
    });
    let answer: unknown = null;
    try {
      answer = await response.json();
    } catch {
      // not JSON: an error page of the server or of something in between
    }
    return readUnlockAnswer(response.status, answer);
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
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
