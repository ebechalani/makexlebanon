/**
 * The server's side of the members' examples: decide whether a typed code is on the list and,
 * only then, hand out the members' programs.
 *
 * It is written as one plain function, handleUnlockRequest(), that gets everything it needs as
 * arguments (the list of fingerprints, the programs, the clock), so the tests can try every
 * case without a web server. The address of the website that calls it is
 * src/app/api/simulator/unlock/route.ts.
 *
 * What it promises:
 *  - the programs leave the server only in the answer to a code that is on the list;
 *  - every other answer says "no" in the same few words, whatever was wrong with the code:
 *    nobody can learn from the answers whether a code was close, or which numbers exist;
 *  - the codes themselves are never kept, only their fingerprints (./code-fingerprint.mjs);
 *  - no database, no cookies, nothing is remembered about a visitor.
 *
 * Server only: it uses "node:crypto". Nothing of the simulator screen may import it.
 */
import { timingSafeEqual } from 'node:crypto';
import type { SampleProgram } from '../fire-rescue/sample-catalog';
import { FINGERPRINT_PATTERN, fingerprintOf } from './code-fingerprint.mjs';
import { normalizeCode } from './code-format.mjs';

// =============================================================================================
// The list of codes
// =============================================================================================

/** One line of content/simulator-codes.ts. */
export interface CodeEntry {
  /** the number of the code, as in the owner's list (1, 2, 3 ...) */
  no: number;
  /** the fingerprint of the code: 64 hex digits */
  fingerprint: string;
}

/** The fingerprints of a list as bytes; lines that are not a fingerprint (a slip while editing) are left out. */
const parsedLists = new WeakMap<readonly CodeEntry[], Buffer[]>();

function fingerprintBytes(codes: readonly CodeEntry[]): Buffer[] {
  let list = parsedLists.get(codes);
  if (!list) {
    list = codes
      .filter((entry) => typeof entry?.fingerprint === 'string' && FINGERPRINT_PATTERN.test(entry.fingerprint))
      .map((entry) => Buffer.from(entry.fingerprint, 'hex'));
    parsedLists.set(codes, list);
  }
  return list;
}

/**
 * True when the typed text is a code of the list.
 *
 * The fingerprint of the typed code is compared with EVERY fingerprint of the list, each time
 * with a comparison that takes the same time whether the two agree or not: how long the answer
 * takes says nothing about the list.
 */
export async function isMemberCode(typed: unknown, codes: readonly CodeEntry[]): Promise<boolean> {
  const characters = normalizeCode(typed);
  if (characters === null) return false;
  const mine = Buffer.from(await fingerprintOf(characters), 'hex');
  let found = false;
  for (const theirs of fingerprintBytes(codes)) {
    if (timingSafeEqual(mine, theirs)) found = true;
  }
  return found;
}

// =============================================================================================
// A courtesy limit on wrong codes
// =============================================================================================

/**
 * Counts the wrong codes that come from one address and says "wait" after too many.
 *
 * This is a courtesy, not a wall. The count lives in the memory of one running copy of the
 * server; on Vercel there can be several copies, they come and go, and each one counts for
 * itself - so the real limit is "about this many, per copy". That is enough for what it is for:
 * a script that tries codes in a loop gets slowed down and stops costing computing time.
 * Guessing a code is hopeless without it as well (31^8 possibilities).
 *
 * It must never stand in the way of a member. Only WRONG codes count, never right ones, and the
 * limit is far above "a few typing mistakes" - a whole classroom behind one school address can
 * type its codes, mistakes included, without reaching it.
 */
export class AttemptLimiter {
  private readonly clients = new Map<string, { count: number; since: number }>();

  constructor(
    /** wrong codes allowed from one address ... */
    readonly limit = 100,
    /** ... within this many milliseconds */
    readonly windowMs = 10 * 60 * 1000,
    /** addresses remembered at most (when there are more, the oldest counts are dropped) */
    readonly maxClients = 5000,
  ) {}

  /** Seconds this address has to wait before its next try; 0 when it may try now. */
  waitSeconds(client: string, now: number): number {
    const entry = this.clients.get(client);
    if (!entry) return 0;
    if (now - entry.since >= this.windowMs) {
      this.clients.delete(client);
      return 0;
    }
    return entry.count >= this.limit ? Math.max(1, Math.ceil((entry.since + this.windowMs - now) / 1000)) : 0;
  }

  /** Note one wrong code from this address. */
  recordFailure(client: string, now: number): void {
    const entry = this.clients.get(client);
    if (entry && now - entry.since < this.windowMs) {
      entry.count++;
      return;
    }
    if (this.clients.size >= this.maxClients) this.forgetOld(now);
    this.clients.set(client, { count: 1, since: now });
  }

  private forgetOld(now: number): void {
    for (const [client, entry] of this.clients) {
      if (now - entry.since >= this.windowMs) this.clients.delete(client);
    }
    // still full of fresh counts: start again rather than grow without end
    if (this.clients.size >= this.maxClients) this.clients.clear();
  }
}

// =============================================================================================
// The request
// =============================================================================================

/** A request may be this large at most (a code in JSON is about 30 bytes). */
export const MAX_BODY_BYTES = 512;

/**
 * Why a request was refused. Deliberately few and vague:
 *
 *   invalid-code        the code is not on the list (never typed right, cancelled, or not a code at all)
 *   bad-request         the request is not `{ "code": "..." }`
 *   too-large           the request is larger than MAX_BODY_BYTES
 *   too-many-attempts   too many wrong codes from this address; try again later
 *   method-not-allowed  anything but POST
 */
export type UnlockRefusal = 'invalid-code' | 'bad-request' | 'too-large' | 'too-many-attempts' | 'method-not-allowed';

export type UnlockAnswer = { ok: true; examples: SampleProgram[] } | { ok: false; reason: UnlockRefusal };

export interface UnlockRequest {
  /** the HTTP method */
  method: string;
  /** the text of the request; null when it was larger than MAX_BODY_BYTES and was not read to the end */
  body: string | null;
  /** where the request came from (an address), for the courtesy limit */
  client: string;
}

export interface UnlockResponse {
  status: number;
  headers: Record<string, string>;
  body: UnlockAnswer;
}

export interface UnlockSetup {
  /** the list of content/simulator-codes.ts */
  codes: readonly CodeEntry[];
  /** what a right code unlocks: the members' examples with their programs */
  examples: readonly SampleProgram[];
  limiter?: AttemptLimiter;
  /** the clock, in milliseconds (the tests bring their own) */
  now?: () => number;
}

/** Never keep an answer anywhere: not in the browser, not in between. */
const NO_STORE = { 'Cache-Control': 'no-store' };

function refuse(status: number, reason: UnlockRefusal, headers: Record<string, string> = {}): UnlockResponse {
  return { status, headers: { ...NO_STORE, ...headers }, body: { ok: false, reason } };
}

/**
 * Answer one request to /api/simulator/unlock.
 *
 *   POST { "code": "FIRE-7K2M-9QXD" }
 *     code on the list  ->  200  { ok: true, examples: [ { id, title, level, description, program } ... ] }
 *     anything else     ->  4xx  { ok: false, reason }      (never any example)
 */
export async function handleUnlockRequest(request: UnlockRequest, setup: UnlockSetup): Promise<UnlockResponse> {
  if (request.method !== 'POST') return refuse(405, 'method-not-allowed', { Allow: 'POST' });
  if (request.body === null || Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) return refuse(413, 'too-large');

  let sent: unknown;
  try {
    sent = JSON.parse(request.body);
  } catch {
    return refuse(400, 'bad-request');
  }
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return refuse(400, 'bad-request');
  const code: unknown = (sent as Record<string, unknown>).code;
  if (typeof code !== 'string') return refuse(400, 'bad-request');

  const now = (setup.now ?? Date.now)();
  const wait = setup.limiter?.waitSeconds(request.client, now) ?? 0;
  if (wait > 0) return refuse(429, 'too-many-attempts', { 'Retry-After': String(wait) });

  if (!(await isMemberCode(code, setup.codes))) {
    setup.limiter?.recordFailure(request.client, now);
    return refuse(403, 'invalid-code');
  }

  return {
    status: 200,
    headers: { ...NO_STORE },
    body: {
      ok: true,
      examples: setup.examples.map(({ id, title, level, description, program }) => ({ id, title, level, description, program })),
    },
  };
}
