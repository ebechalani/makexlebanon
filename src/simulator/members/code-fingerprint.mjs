/**
 * The fingerprint of a member code.
 *
 * The website never keeps the codes themselves. For every code it keeps a fingerprint: a long
 * row of letters and digits that is worked out from the code, always the same for the same
 * code, and from which the code cannot be read back. The list of fingerprints is in
 * content/simulator-codes.ts. When a member types a code, the server works out its fingerprint
 * in the same way and looks for it in that list.
 *
 * (For developers: PBKDF2-HMAC-SHA256 of the 8 normalised characters, with the fixed salt and
 * the number of rounds below, 32 bytes, written as 64 hex digits. The rounds make every single
 * guess slow, on the server and for anybody trying codes against the public list. The codes are
 * short enough - 31^8 possibilities - that a determined person with a graphics card could still
 * find one from the fingerprints in a few hours; the programs they would unlock are in the
 * same public repository, so there is nothing more to win that way.)
 *
 * =====================================================================================
 *  NEVER CHANGE THE THREE VALUES BELOW ONCE CODES HAVE BEEN HANDED OUT.
 *  Every fingerprint in content/simulator-codes.ts was made with them: change one and not a
 *  single member's code works any more. A test (members.test.ts) fails when they change.
 * =====================================================================================
 *
 * Plain JavaScript on purpose, like ./code-format.mjs: the server and the script that makes
 * new codes (scripts/generate-simulator-codes.mjs) both use this one function. It needs Node
 * ("node:crypto"), so it must never be imported by the simulator screen.
 */
import { pbkdf2 } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from './code-format.mjs';

/** Mixed into every fingerprint, so that they are of no use to anything but this website. */
export const FINGERPRINT_SALT = 'makexlebanon.com/simulator/member-code/v1';

/** How many rounds of hashing one fingerprint takes. */
export const FINGERPRINT_ROUNDS = 200_000;

/** Length of a fingerprint in bytes (it is written as twice as many hex digits). */
export const FINGERPRINT_BYTES = 32;

const NORMALISED = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** What a fingerprint looks like: 64 hex digits, small letters. */
export const FINGERPRINT_PATTERN = new RegExp(`^[0-9a-f]{${FINGERPRINT_BYTES * 2}}$`);

/**
 * Work out the fingerprint of a code.
 *
 * @param {string} characters the 8 characters of the code, as normalizeCode() gives them
 *   (not what was typed: tidy that up first)
 * @returns {Promise<string>} 64 hex digits
 */
export function fingerprintOf(characters) {
  return new Promise((resolve, reject) => {
    if (typeof characters !== 'string' || !NORMALISED.test(characters)) {
      reject(new TypeError('fingerprintOf() needs the 8 normalised characters of a code (see normalizeCode).'));
      return;
    }
    pbkdf2(characters, FINGERPRINT_SALT, FINGERPRINT_ROUNDS, FINGERPRINT_BYTES, 'sha256', (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
}
