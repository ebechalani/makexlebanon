/**
 * POST /api/simulator/unlock - checks a member code and, when it is on the list, answers with
 * the members' examples of the Fire Rescue simulator.
 *
 *   request    { "code": "FIRE-7K2M-9QXD" }
 *   200        { "ok": true, "examples": [ { id, title, level, description, program }, ... ] }
 *   400        { "ok": false, "reason": "bad-request" }         not `{ "code": "..." }`
 *   403        { "ok": false, "reason": "invalid-code" }        the code is not on the list
 *   405        { "ok": false, "reason": "method-not-allowed" }  anything but POST
 *   413        { "ok": false, "reason": "too-large" }
 *   429        { "ok": false, "reason": "too-many-attempts" }   too many wrong codes; see Retry-After
 *
 * This is the only door through which the members' programs (samples-locked.ts) leave the
 * server. Everything that decides is in src/simulator/members/unlock.ts, where it is tested;
 * this file only reads the request and sends the answer. No database, no cookies.
 *
 * The list of codes is content/simulator-codes.ts. It is built into the site when it is
 * deployed: cancelling a code means changing that file and pushing it.
 */
import { simulatorCodes } from '@content/simulator-codes';
import { LOCKED_SAMPLE_PROGRAMS } from '@/simulator/fire-rescue/samples-locked';
import { AttemptLimiter, handleUnlockRequest, MAX_BODY_BYTES, type UnlockResponse } from '@/simulator/members/unlock';

/** It hashes with "node:crypto", so it runs on the Node.js runtime ... */
export const runtime = 'nodejs';
/** ... and it is worked out anew for every request: never prepared ahead, never kept. */
export const dynamic = 'force-dynamic';

/**
 * The courtesy limit on wrong codes (see AttemptLimiter). It lives in the memory of this copy
 * of the server only - on Vercel there can be several copies, and each one starts empty - so it
 * is a best effort, not a guarantee.
 */
const limiter = new AttemptLimiter();

/**
 * Where the request came from. Vercel writes the visitor's address into "x-forwarded-for"; on
 * a server that does not, all visitors share one count - still only a courtesy limit.
 */
function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
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

export async function POST(request: Request): Promise<Response> {
  let body: string | null;
  try {
    body = await readBody(request);
  } catch {
    // the connection broke while the request was read: treat it as a request without a code
    body = '';
  }
  return send(
    await handleUnlockRequest(
      { method: 'POST', body, client: clientAddress(request) },
      { codes: simulatorCodes, examples: LOCKED_SAMPLE_PROGRAMS, limiter },
    ),
  );
}

/** Every other method gets a plain "405 Method Not Allowed"; the request is not even read. */
async function notAllowed(request: Request): Promise<Response> {
  return send(await handleUnlockRequest({ method: request.method, body: '', client: 'unknown' }, { codes: [], examples: [] }));
}

export const GET = notAllowed;
export const HEAD = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = notAllowed;
