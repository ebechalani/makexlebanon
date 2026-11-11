/**
 * What a member code looks like, and how a typed code is tidied up before it is checked.
 *
 *   FIRE-7K2M-9QXD      the word FIRE, then 8 characters in two groups of four
 *
 * The 8 characters come from an alphabet without look-alikes: no 0 and O, no 1, I and L. So a
 * code read out over the phone or copied from paper cannot be mistyped into another valid one
 * by confusing those.
 *
 * A typed code is forgiving: capitals or not, with or without the dashes, with spaces, with or
 * without the word FIRE - "fire 7k2m 9qxd", "7K2M9QXD" and "FIRE-7K2M-9QXD" are the same code.
 *
 * This file is plain JavaScript on purpose (not TypeScript): the website's server, the simulator
 * screen and the script that makes new codes (scripts/generate-simulator-codes.mjs, run with
 * plain Node) all read these same lines, so they can never disagree about what a code is.
 * Nothing secret is in here.
 */

/** The word every code starts with. It carries no information; it only makes a code recognisable. */
export const CODE_PREFIX = 'FIRE';

/** The 31 characters a code is made of: digits and capitals without 0, O, 1, I and L. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** How many of those characters a code has (after the word FIRE). */
export const CODE_LENGTH = 8;

/** A made-up code, for texts that show what one looks like. It is not on any list. */
export const CODE_EXAMPLE = 'FIRE-7K2M-9QXD';

/** Longest text that is looked at at all (a real code with spaces and dashes is far shorter). */
const MAX_TYPED_LENGTH = 64;

const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Blanks of every kind (also the invisible ones chat apps add) and every kind of dash. */
const SEPARATORS = /[\s\u200B-\u200D\u2060\uFEFF\-\u2010-\u2015\u2212]/g;

/**
 * Tidy up a typed code: blanks and dashes out, capitals, the word FIRE off. Gives back the 8
 * characters, or null when what is left cannot be a code.
 *
 * (The word FIRE can safely be cut off the front: there is no "I" in the alphabet, so the 8
 * characters themselves never start with it.)
 *
 * @param {unknown} typed
 * @returns {string | null}
 */
export function normalizeCode(typed) {
  if (typeof typed !== 'string' || typed.length > MAX_TYPED_LENGTH) return null;
  let text = typed.replace(SEPARATORS, '').toUpperCase();
  if (text.startsWith(CODE_PREFIX)) text = text.slice(CODE_PREFIX.length);
  return CODE_PATTERN.test(text) ? text : null;
}

/**
 * The 8 characters written the way a code is handed out: FIRE-7K2M-9QXD.
 *
 * @param {string} characters the 8 characters, as normalizeCode() gives them
 * @returns {string}
 */
export function formatCode(characters) {
  const half = CODE_LENGTH / 2;
  return `${CODE_PREFIX}-${characters.slice(0, half)}-${characters.slice(half)}`;
}

/**
 * The same, with the second group hidden: FIRE-7K2M-••••. Enough to recognise a code on the
 * screen without showing all of it to the neighbour.
 *
 * @param {string} characters the 8 characters, as normalizeCode() gives them
 * @returns {string}
 */
export function maskCode(characters) {
  const half = CODE_LENGTH / 2;
  return `${CODE_PREFIX}-${characters.slice(0, half)}-${'•'.repeat(CODE_LENGTH - half)}`;
}
