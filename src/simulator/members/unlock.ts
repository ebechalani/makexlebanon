/**
 * The server's side of the Examples window: decide what a visitor may see and what they may open.
 *
 * A visitor's browser holds no example at all - no program, no text that explains one, not even
 * a title. It gets all of that only from here, and how much depends on what the request carries:
 *
 *   - no code: the cards of the examples a visitor may SEE, and - to open - the examples the
 *     owner has opened to everyone ("examplesOpenToEveryone" in content/simulator-codes.ts);
 *   - a member code that is on the list ("simulatorCodes"): the same cards, all of them open;
 *   - an advanced code that is on its list ("advancedSimulatorCodes"): every example.
 *
 * An example the owner keeps for advanced codes only ("examplesForAdvancedCodesOnly") is left
 * out of the first two answers altogether: not its card, not its title, not the heading of its
 * level when no other card stands under it. Nothing in those answers says that anything was
 * left out, or that a second kind of code exists: the answer to a member code and the answer to
 * an advanced code are made of the very same fields.
 *
 * It is written as one plain function, handleUnlockRequest(), that gets everything it needs as
 * arguments (the lists of fingerprints, the examples, the clock), so the tests can try every
 * case without a web server. The address of the website that calls it is
 * src/app/api/simulator/unlock/route.ts.
 *
 * What it promises:
 *  - a code that is on neither list gets "no" and nothing else - never an example, never a title;
 *  - that "no" is the same few words whatever was wrong with the code: nobody can learn from
 *    the answers whether a code was close, or which numbers exist;
 *  - the codes themselves are never kept, only their fingerprints (./code-fingerprint.mjs);
 *  - no database, no cookies, nothing is remembered about a visitor.
 *
 * Server only: it uses "node:crypto". Nothing of the simulator screen may import it.
 */
import { timingSafeEqual } from 'node:crypto';
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
 * What a typed text is:
 *
 *   'advanced'   a code of the list of advanced codes
 *   'member'     a code of the list of member codes
 *   null         neither (not on a list, cancelled, or not a code at all)
 */
export type CodeKind = 'advanced' | 'member' | null;

/**
 * Look a typed code up in the two lists.
 *
 * The fingerprint of the typed code is worked out once and then compared with EVERY fingerprint
 * of BOTH lists, each time with a comparison that takes the same time whether the two agree or
 * not: how long the answer takes says nothing about the lists, nor about which list a code is on.
 * A code that is (by a slip while editing) on both lists counts as an advanced code.
 */
export async function kindOfCode(typed: unknown, memberCodes: readonly CodeEntry[], advancedCodes: readonly CodeEntry[]): Promise<CodeKind> {
  const characters = normalizeCode(typed);
  if (characters === null) return null;
  const mine = Buffer.from(await fingerprintOf(characters), 'hex');
  let member = false;
  let advanced = false;
  for (const theirs of fingerprintBytes(memberCodes)) {
    if (timingSafeEqual(mine, theirs)) member = true;
  }
  for (const theirs of fingerprintBytes(advancedCodes)) {
    if (timingSafeEqual(mine, theirs)) advanced = true;
  }
  return advanced ? 'advanced' : member ? 'member' : null;
}

/** No code at all: for the answers that look at one list only. */
const NO_CODES: readonly CodeEntry[] = [];

/** True when the typed text is a code of this one list (see kindOfCode). */
export async function isMemberCode(typed: unknown, codes: readonly CodeEntry[]): Promise<boolean> {
  return (await kindOfCode(typed, codes, NO_CODES)) === 'member';
}

// =============================================================================================
// A courtesy limit on wrong codes
// =============================================================================================

/** What the limiter answers to "may a code from this address be checked now?". */
export interface Turn {
  /** 0: yes, check it now. Otherwise: the seconds after which this address may ask again */
  wait: number;
  /** to be called when the code turned out to be RIGHT: a right code does not count */
  giveBack: () => void;
}

const NOTHING_TO_GIVE_BACK = (): void => {};

/** For a request the limiter does not look at. */
const FREE_TURN: Turn = { wait: 0, giveBack: NOTHING_TO_GIVE_BACK };

/**
 * Slows down wrong codes that come from one address - without ever shutting an address out for a time.
 *
 * This is a courtesy, not a wall, and it is best effort only. The count lives in the memory of
 * one running copy of the server; on Vercel (serverless) there can be several copies, they come
 * and go, and each one counts for itself - so the real limit is "about this many, per copy".
 * That is enough for what it is for: checking a code costs computing time on purpose (see
 * ./code-fingerprint.mjs), and a script that tries codes in a loop must not be able to use up
 * the server with it. Guessing a code is hopeless without it as well (31^8 possibilities).
 *
 * How it works:
 *  - an address may have `limit` wrong codes checked at full speed within `windowMs`. A try is
 *    counted the moment its check begins - so a thousand requests sent in the same instant
 *    cannot all slip through before the first one is counted - and it is given back when the
 *    code turns out to be right;
 *  - an address that has used up its tries is NOT locked out. It goes into a slow lane: one
 *    code is checked every `slowEveryMs`, and in between the answer is "wait a moment" (429),
 *    which costs no computing time. A right code that gets its turn opens the examples like
 *    any other, and does not use the turn up.
 *
 * So it cannot stand in the way of a member for long, and it cannot be turned against others:
 *  - only WRONG codes count. A right code never counts, and a request without a code is never
 *    even looked at by the limiter;
 *  - the limit is far above "a few typing mistakes": a whole classroom behind one school address
 *    can type its codes, mistakes included, without reaching it;
 *  - when an address did reach it - a script, or a room full of browsers that still send a
 *    cancelled code on every visit - a member there waits a second, not ten minutes: there is
 *    no penalty time that somebody could keep going with a handful of wrong codes. (Only while
 *    a script at the very same address goes on sending wrong codes, faster than one a second,
 *    does it take most of the turns; a second after it stops, the member is in.)
 *  - the count of an address starts again after `windowMs`;
 *  - a request whose address is not known is not limited at all (see handleUnlockRequest),
 *    rather than letting all such visitors share one count.
 */
export class AttemptLimiter {
  private readonly clients = new Map<string, { tries: number; since: number; nextSlowTurn: number }>();

  constructor(
    /** wrong codes from one address that are checked at full speed ... */
    readonly limit = 100,
    /** ... within this many milliseconds */
    readonly windowMs = 10 * 60 * 1000,
    /** addresses remembered at most (when there are more, the oldest counts are dropped) */
    readonly maxClients = 5000,
    /** an address over its limit gets one code checked every so many milliseconds */
    readonly slowEveryMs = 1000,
  ) {}

  /**
   * Ask for a turn: may a code from this address be checked now? Asking takes the turn, so
   * call it once per code, and call `giveBack()` of the answer when the code was right.
   */
  admit(client: string, now: number): Turn {
    let entry = this.clients.get(client);
    if (entry && now - entry.since >= this.windowMs) {
      this.clients.delete(client);
      entry = undefined;
    }
    if (!entry) {
      if (this.clients.size >= this.maxClients) this.forgetOld(now);
      entry = { tries: 0, since: now, nextSlowTurn: 0 };
      this.clients.set(client, entry);
    }
    const count = entry;

    // ---- under the limit: at full speed
    if (count.tries < this.limit) {
      count.tries++;
      let given = false;
      return {
        wait: 0,
        giveBack: () => {
          if (given) return;
          given = true;
          count.tries--;
          // nothing left to remember about this address
          if (count.tries === 0 && this.clients.get(client) === count) this.clients.delete(client);
        },
      };
    }

    // ---- over the limit: the slow lane, one code every `slowEveryMs`
    if (now >= count.nextSlowTurn) {
      const before = count.nextSlowTurn;
      const mine = now + this.slowEveryMs;
      count.nextSlowTurn = mine;
      return {
        wait: 0,
        giveBack: () => {
          // (unless somebody else has taken a turn in the meantime)
          if (count.nextSlowTurn === mine) count.nextSlowTurn = before;
        },
      };
    }
    return { wait: Math.max(1, Math.ceil((count.nextSlowTurn - now) / 1000)), giveBack: NOTHING_TO_GIVE_BACK };
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

/** The heading over the cards of one level, as it is sent to the browser. */
export interface LevelHeading {
  /** the name the cards refer to: "starter" */
  id: string;
  /** the word on the coloured label: "Starter" */
  title: string;
  /** the few words after it: what the examples of this level are about */
  about: string;
}

/** A card as it is sent to the browser: an example this visitor may see. */
export interface VisibleCard {
  id: string;
  title: string;
  /** the id of its level (see LevelHeading) */
  level: string;
}

/** An example as it is sent to the browser: one this visitor may open. */
export interface UnlockedExample extends VisibleCard {
  /** what the program does and when it works */
  description: string;
  /** the blocks (what Blockly.serialization.workspaces.save() writes) */
  program: unknown;
}

/**
 * Why a request was refused. Deliberately few and vague:
 *
 *   invalid-code        the code is on neither list (never typed right, cancelled, or not a code at all)
 *   bad-request         the request is not `{ "code": "..." }` or `{}`, or it does not say that it is JSON
 *   too-large           the request is larger than MAX_BODY_BYTES
 *   too-many-attempts   too many wrong codes from this address: wait a moment (see Retry-After) and try again
 *   method-not-allowed  anything but POST
 */
export type UnlockRefusal = 'invalid-code' | 'bad-request' | 'too-large' | 'too-many-attempts' | 'method-not-allowed';

export type UnlockAnswer =
  | {
      ok: true;
      /** true: the code is on a list. false: there was no code */
      member: boolean;
      /** the headings of the levels that have a card below, in the order of the Examples window */
      levels: LevelHeading[];
      /** every example this visitor may SEE, in the order of the Examples window: enough to draw its card */
      cards: VisibleCard[];
      /** the examples this visitor may OPEN: with a code every card, without one those open to everyone (often none) */
      examples: UnlockedExample[];
    }
  | { ok: false; reason: UnlockRefusal };

export interface UnlockRequest {
  /** the HTTP method */
  method: string;
  /** the text of the request; null when it was larger than MAX_BODY_BYTES and was not read to the end */
  body: string | null;
  /** what the request says its text is (the "Content-Type" header); null when it does not say */
  contentType: string | null;
  /** where the request came from (an address), for the courtesy limit; null when that is not known */
  client: string | null;
}

export interface UnlockResponse {
  status: number;
  headers: Record<string, string>;
  body: UnlockAnswer;
}

export interface UnlockSetup {
  /** the list of member codes ("simulatorCodes" in content/simulator-codes.ts) */
  codes: readonly CodeEntry[];
  /** the list of advanced codes ("advancedSimulatorCodes") */
  advancedCodes: readonly CodeEntry[];
  /** every example with its description and its program, in the order of the Examples window */
  examples: readonly UnlockedExample[];
  /** the headings of the levels, in the order of the Examples window */
  levels: readonly LevelHeading[];
  /** ids of the examples anyone may open without a code ("examplesOpenToEveryone"); ids that do not exist are ignored */
  openToEveryone: readonly string[];
  /**
   * ids of the examples that only an advanced code shows ("examplesForAdvancedCodesOnly"); ids
   * that do not exist are ignored. An id that is also in `openToEveryone` stays hidden: the
   * stricter rule wins.
   */
  advancedOnly: readonly string[];
  limiter?: AttemptLimiter;
  /** the clock, in milliseconds (the tests bring their own) */
  now?: () => number;
}

/**
 * What is wrong with the owner's lists in a way that must not go live: every line of
 * "examplesForAdvancedCodesOnly" that is not the id of an example.
 *
 * Answering a request, such a line simply hides nothing (see handleUnlockRequest). But that is
 * the dangerous direction: 'smart-buckett' instead of 'smart-bucket' - or an example whose id
 * was changed in sample-catalog.ts and not here - and the example the owner believes hidden is
 * shown to every visitor. So the website's address (src/app/api/simulator/unlock/route.ts)
 * asks this function once, when the site is built, and refuses to be built while it names
 * anything: the site then stays as it was until the line is put right.
 *
 * (A misspelt id in "examplesOpenToEveryone" is harmless - the example stays locked - and an id
 * on both lists stays hidden; the tests point both out, the website is built all the same.)
 *
 * Gives the mistakes in plain words, one text each; none when all is well. The texts name only
 * what the owner wrote, never an example.
 */
export function mistakesInSetup(setup: Pick<UnlockSetup, 'examples' | 'advancedOnly'>): string[] {
  const ids = new Set(setup.examples.map((example) => example.id));
  const mistakes: string[] = [];
  if (!Array.isArray(setup.advancedOnly)) return ['"examplesForAdvancedCodesOnly" is not a list any more: it must be [ ... ] with one id per line.'];
  for (const id of setup.advancedOnly) {
    if (typeof id !== 'string' || !ids.has(id)) {
      mistakes.push(
        `"examplesForAdvancedCodesOnly" holds ${typeof id === 'string' ? `'${id}'` : 'a line that is not an id in quotes'}, which is not the id of an example - so the example it was meant for would NOT be hidden. ` +
          'Compare it, letter by letter, with the ids listed at the top of content/simulator-codes.ts.',
      );
    }
  }
  return mistakes;
}

/** Never keep an answer anywhere: not in the browser, not in between. */
const NO_STORE = { 'Cache-Control': 'no-store' };

function refuse(status: number, reason: UnlockRefusal, headers: Record<string, string> = {}): UnlockResponse {
  return { status, headers: { ...NO_STORE, ...headers }, body: { ok: false, reason } };
}

/**
 * The answer "yes": what this visitor may see, and what of it they may open.
 *
 * @param visible  the examples whose cards are shown
 * @param open     the ones of them that can be opened (a part of `visible`)
 */
function hand(member: boolean, visible: readonly UnlockedExample[], open: readonly UnlockedExample[], levels: readonly LevelHeading[]): UnlockResponse {
  return {
    status: 200,
    headers: { ...NO_STORE },
    body: {
      ok: true,
      member,
      // (everything is copied field by field: nothing but these ever leaves the server)
      // a heading goes out only together with a card of its level
      levels: levels.filter((level) => visible.some((example) => example.level === level.id)).map(({ id, title, about }) => ({ id, title, about })),
      cards: visible.map(({ id, title, level }) => ({ id, title, level })),
      examples: open.map(({ id, title, level, description, program }) => ({ id, title, level, description, program })),
    },
  };
}

/**
 * True when the request says that its text is JSON ("application/json", with or without a
 * charset after it).
 *
 * A request that carries a text must say so. This is not fussiness: a web page on ANOTHER
 * website can make a visitor's browser send plain text or a form to this address without
 * asking, but not JSON - for JSON the browser first asks this server for permission, which it
 * does not get. So no other website can use its visitors' browsers to try codes here (and use
 * up their tries, or the server's computing time). The simulator's own page always says JSON.
 */
function saysJson(contentType: string | null): boolean {
  return contentType !== null && /^application\/json\s*(;|$)/i.test(contentType.trim());
}

/**
 * What was sent as the code: the text of the code; '' when there is none (no "code" at all,
 * null, an empty text or only blanks); or 'bad' when the request is not of the expected kind.
 */
function sentCode(body: string): string | 'bad' {
  if (body.trim() === '') return '';
  let sent: unknown;
  try {
    sent = JSON.parse(body);
  } catch {
    return 'bad';
  }
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return 'bad';
  const code: unknown = (sent as Record<string, unknown>).code;
  if (code === undefined || code === null) return '';
  if (typeof code !== 'string') return 'bad';
  return code.trim();
}

/**
 * Answer one request to /api/simulator/unlock.
 *
 *   POST {}                               ->  200  { ok: true, member: false, levels, cards, examples }
 *                                                  cards: what a visitor may see; examples: the ones open to everyone
 *   POST { "code": "FIRE-7K2M-9QXD" }
 *     a member code of the list           ->  200  { ok: true, member: true, levels, cards, examples }
 *                                                  the same cards, and every one of them as an example
 *     an advanced code of its list        ->  200  { ok: true, member: true, levels, cards, examples }
 *                                                  every example there is
 *     a code on neither list              ->  403  { ok: false, reason: "invalid-code" }       never any example
 *     too many wrong codes just now       ->  429  { ok: false, reason: "too-many-attempts" }  the code was not looked at
 *   anything that is not such a request   ->  4xx  { ok: false, reason }                        never any example
 *
 * A level is { id, title, about }, a card { id, title, level }, an example
 * { id, title, level, description, program }.
 *
 * The examples kept for advanced codes only are in the third answer and in no other: the first
 * two do not hold their cards, and do not say that there are any. The second and the third
 * answer have the same shape, so nothing in a member's answer gives away that another kind of
 * code exists.
 */
export async function handleUnlockRequest(request: UnlockRequest, setup: UnlockSetup): Promise<UnlockResponse> {
  if (request.method !== 'POST') return refuse(405, 'method-not-allowed', { Allow: 'POST' });
  if (request.body === null || Buffer.byteLength(request.body, 'utf8') > MAX_BODY_BYTES) return refuse(413, 'too-large');
  // (an empty request - no code - has no text to describe)
  if (request.body.trim() !== '' && !saysJson(request.contentType)) return refuse(415, 'bad-request');

  const code = sentCode(request.body);
  if (code === 'bad') return refuse(400, 'bad-request');

  // what everybody without an advanced code may see: every example that is not kept for advanced codes
  const hidden = new Set(setup.advancedOnly);
  const forMembers = setup.examples.filter((example) => !hidden.has(example.id));

  // ---- no code: the members' cards, and to open only what the owner has opened to everyone
  if (code === '') {
    const open = new Set(setup.openToEveryone);
    return hand(
      false,
      forMembers,
      forMembers.filter((example) => open.has(example.id)),
      setup.levels,
    );
  }

  // ---- a code: the examples of its kind, or nothing
  // (text that cannot be a code needs no working out: the answer is the same "no")
  if (normalizeCode(code) === null) return refuse(403, 'invalid-code');

  // the courtesy limit (an address that is not known is not limited: see AttemptLimiter)
  const turn = setup.limiter && request.client !== null ? setup.limiter.admit(request.client, (setup.now ?? Date.now)()) : FREE_TURN;
  if (turn.wait > 0) return refuse(429, 'too-many-attempts', { 'Retry-After': String(turn.wait) });

  const kind = await kindOfCode(code, setup.codes, setup.advancedCodes);
  if (kind === null) return refuse(403, 'invalid-code');
  // a right code never counts
  turn.giveBack();
  const theirs = kind === 'advanced' ? setup.examples : forMembers;
  return hand(true, theirs, theirs, setup.levels);
}
