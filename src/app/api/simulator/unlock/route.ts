/**
 * POST /api/simulator/unlock - the one door through which the example programs of the mBot2
 * simulator, their titles and the texts that explain them leave the server. One door for every
 * game of the simulator: a request says which game it is about.
 *
 *   request    { "game": "fire-chief" }                          no code
 *   200        { "ok": true, "member": false, "levels": [ ... ], "cards": [ ... ], "examples": [ ... ] }
 *              cards: the examples of that game a visitor may see; examples: the ones that are open to everyone (often none)
 *
 *   request    { "game": "fire-chief", "code": "FIRE-7K2M-9QXD" }   a code
 *   200        { "ok": true, "member": true, "levels": [ ... ], "cards": [ ... ], "examples": [ ... ] }
 *              a member code of the list: the same cards, every one of them as an example
 *              an advanced code of its list: every example of that game
 *   403        { "ok": false, "reason": "invalid-code" }              the code is on neither list
 *
 *   400        { "ok": false, "reason": "unknown-game" }              "game" is not "fire-rescue" or "fire-chief", letter for letter
 *   400        { "ok": false, "reason": "bad-request" }               not such a request
 *   415        { "ok": false, "reason": "bad-request" }               a request with a text that does not say "Content-Type: application/json"
 *   405        { "ok": false, "reason": "method-not-allowed" }        anything but POST
 *   413        { "ok": false, "reason": "too-large" }
 *   429        { "ok": false, "reason": "too-many-attempts" }         too many wrong codes just now: wait a moment (Retry-After) and try again
 *
 * "game" is "fire-rescue" or "fire-chief". A request without "game" - `{}` or
 * `{ "code": "..." }` - is about Fire Rescue: that is how its page asked while it was the only
 * game, and a page that was loaded then is still open in somebody's browser.
 *
 * A level is { id, title, about }, a card { id, title, level }, an example
 * { id, title, level, description, program }. A refusal never carries one, and an answer never
 * holds anything of another game than the one that was asked about. The examples kept for
 * advanced codes only are in the answer to an advanced code and in no other - not even as a
 * card.
 *
 * The codes are the same for every game: a member code opens the members' examples of both
 * games, an advanced code every example of both. Wrong codes are counted per address, not per
 * game.
 *
 * Everything that decides is in src/simulator/members/unlock.ts, where it is tested; this file
 * only reads the request and sends the answer. No database, no cookies; every answer is marked
 * "Cache-Control: no-store".
 *
 * The two lists of codes, the list of examples that are open to everyone and the list of
 * examples for advanced codes only are in content/simulator-codes.ts. All four are built into
 * the site when it is deployed: cancelling a code or moving an example means changing that file
 * and pushing it.
 */
import { advancedSimulatorCodes, examplesForAdvancedCodesOnly, examplesOpenToEveryone, simulatorCodes } from '@content/simulator-codes';
import { ALL_GAMES } from '@/simulator/members/all-examples';
import { AttemptLimiter, handleUnlockRequest, MAX_BODY_BYTES, mistakesInSetup, type UnlockResponse, type UnlockSetup } from '@/simulator/members/unlock';

/** It hashes with "node:crypto", so it runs on the Node.js runtime ... */
export const runtime = 'nodejs';
/** ... and it is worked out anew for every request: never prepared ahead, never kept. */
export const dynamic = 'force-dynamic';

/**
 * The courtesy limit on wrong codes (see AttemptLimiter). It lives in the memory of this copy
 * of the server only - on Vercel there can be several copies, and each one starts empty - so it
 * is a best effort, not a guarantee. It slows an address down; it never locks one out for a time.
 * There is one count per address for all games: asking about another game gives no new tries.
 */
const limiter = new AttemptLimiter();

/**
 * Where the request came from, or null when that is not known.
 *
 * Vercel writes the visitor's address into "x-forwarded-for" itself and overwrites whatever a
 * visitor sent under that name, so there it can be trusted. (Next.js on a server of its own
 * fills in the address of the connection when the header is missing.) Where there is no
 * address at all, such requests are not limited: one count for every visitor would let a
 * single script slow down everybody.
 *
 * Anywhere else it is only as good as what stands in front of the server: behind a proxy that
 * passes a visitor's own "x-forwarded-for" on, a script can pretend to be many addresses and
 * so get around the limit, and behind one that hides the visitors' addresses they all share
 * the proxy's count. Either way the limit only ever slows down - it is a courtesy, not a wall.
 */
function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || request.headers.get('x-real-ip')?.trim() || '';
  // (an address is short: whatever else was sent under that name is not kept at full length)
  return address === '' ? null : address.slice(0, 64);
}

/** The text of the request, or null when it is larger than allowed (reading stops right there). */
async function readBody(request: Request): Promise<string | null> {
  const announced = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(announced) && announced > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(answer: UnlockResponse): Response {
  return Response.json(answer.body, { status: answer.status, headers: answer.headers });
}

/** For the answers that never look at a code or an example. */
const EMPTY_SETUP: UnlockSetup = { codes: [], advancedCodes: [], games: [], openToEveryone: [], advancedOnly: [] };

/** What the owner decided (content/simulator-codes.ts), and the examples themselves, of every game. */
const SETUP: UnlockSetup = {
  codes: simulatorCodes,
  advancedCodes: advancedSimulatorCodes,
  games: ALL_GAMES,
  openToEveryone: examplesOpenToEveryone,
  advancedOnly: examplesForAdvancedCodesOnly,
  limiter,
};

/**
 * A slip in the list of examples for advanced codes only must never go live: a misspelt id
 * there hides nothing, and the example it was meant for would be shown to every visitor. This
 * line runs when the site is built (and whenever the server starts): with such a slip the
 * build fails, Vercel reports it with the text below, and the website stays as it was.
 * An id is looked for among the examples of every game. (The same check stops the build when
 * two games have an example with the same id: one line of the owner's lists would then decide
 * about both.)
 */
const mistakes = mistakesInSetup(SETUP);
if (mistakes.length > 0) throw new Error(`The website cannot be built until this is put right. ${mistakes.join(' ')}`);

export async function POST(request: Request): Promise<Response> {
  let body: string;
  try {
    const read = await readBody(request);
    if (read === null) return send(await handleUnlockRequest({ method: 'POST', body: null, contentType: null, client: null }, EMPTY_SETUP));
    body = read;
  } catch {
    // the connection broke while the request was read: there is nothing to answer to
    return send({ status: 400, headers: { 'Cache-Control': 'no-store' }, body: { ok: false, reason: 'bad-request' } });
  }
  return send(await handleUnlockRequest({ method: 'POST', body, contentType: request.headers.get('content-type'), client: clientAddress(request) }, SETUP));
}

/** Every other method gets a plain "405 Method Not Allowed"; the request is not even read. */
async function notAllowed(request: Request): Promise<Response> {
  return send(await handleUnlockRequest({ method: request.method, body: '', contentType: null, client: null }, EMPTY_SETUP));
}

export const GET = notAllowed;
export const HEAD = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = notAllowed;
