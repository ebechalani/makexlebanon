/**
 * Reading a draw code that a student typed or pasted into the Locker Room screen (or that the
 * screen saved for the next visit).
 *
 * A code is the two cards as the referee draws them: the first letter of the team colour and the
 * number of the zone card - "G5" = team GREEN, option 5. Letter case, spaces and dashes do not
 * matter, and the colour may be written out ("green 5"). Everything else gets one plain sentence
 * that says what is wrong: a team colour that is not RED or GREEN, a zone card that is not 1 to 6,
 * a number alone, or no code at all. (A number alone is no code: the test window numbers its rows
 * 1 to 12 - see decodeScenario.)
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { compactCode, decodeScenario, normaliseCode, ZONE_OPTION_NUMBERS, type LockerRoomScenario } from '../../locker-room/scenario';
import type { CodeReading } from '../scenario-code';
import { DEFAULT_DRAW_CODE } from './words';

const LOOKS_LIKE = `A code is the team colour, R (RED) or G (GREEN), and the zone card, 1 to ${ZONE_OPTION_NUMBERS.length}: like ${DEFAULT_DRAW_CODE}.`;

/** Why a text is no code of a draw. Only called for a text the game could not read. */
function whyNoCode(text: string): string {
  // (only an empty field, or one with nothing but spaces, asks for a code: anything typed is answered)
  if (text.trim().length === 0) return `Type a code into the field. ${LOOKS_LIKE}`;
  const compact = text.length <= 100 ? compactCode(text) : '';
  // (a number alone: digits, and nothing but blanks and dashes around them - a word in letters
  // that are not A - Z, like "أحمر 2", is a word, not nothing)
  if (/^\d+$/.test(compact) && !/\p{L}/u.test(normaliseCode(text))) return `A number alone is not a code. ${LOOKS_LIKE}`;
  const parts = /^([A-Z]+)(\d+)$/.exec(compact);
  if (parts) {
    const team = /^(R|RED|G|GREEN)$/.test(parts[1]);
    const option = /^[1-6]$/.test(parts[2]);
    if (team && !option) return `There are ${ZONE_OPTION_NUMBERS.length} zone cards: the number is 1 to ${ZONE_OPTION_NUMBERS.length}. ${LOOKS_LIKE}`;
    if (!team && option) return `The team colour is RED or GREEN. ${LOOKS_LIKE}`;
  }
  return `This is not a code of the cards. ${LOOKS_LIKE}`;
}

/** Read what was typed into the code field of the Locker Room screen. Never throws. */
export function readCardsCode(text: string): CodeReading<LockerRoomScenario> {
  const typed = typeof text === 'string' ? text : '';
  const scenario = decodeScenario(typed);
  if (scenario) return { ok: true, scenario };
  return { ok: false, problem: whyNoCode(typed) };
}
