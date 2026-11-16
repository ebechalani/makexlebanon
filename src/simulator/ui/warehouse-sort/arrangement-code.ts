/**
 * Reading an arrangement code that a student typed or pasted into the Warehouse Sort screen
 * (or that the screen saved for the next visit).
 *
 * A code is the four cube colours as they lie on the mat, top row then bottom row: "GR-BR" =
 * W1 green, W2 red, W3 blue, W4 red. Letter case, spaces and dashes do not matter. Everything
 * else gets plain sentences - short, for beginners - that say what is wrong: no blue cube, two
 * blue cubes, no red or no green cube, or no code at all. (A number is no code: see
 * decodeScenario.)
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { decodeScenario, scenarioOfCode, scenarioProblems, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import type { CodeReading } from '../scenario-code';
import { DEFAULT_ARRANGEMENT_CODE } from './words';

const LOOKS_LIKE = `A code has four letters, R (red), G (green) or B (blue), like ${DEFAULT_ARRANGEMENT_CODE}.`;

/** Why a text is no code of an arrangement that can be played. Only called for a text the game could not read. */
function whyNoCode(text: string): string {
  // (only an empty field, or one with nothing but spaces, asks for a code: anything typed is answered)
  if (text.trim().length === 0) return `Type a code into the field. ${LOOKS_LIKE}`;
  // the code of an arrangement that cannot be played: say what is missing, in the game's own words
  const asTyped = text.length <= 100 ? scenarioOfCode(text) : null;
  if (asTyped) return `This arrangement cannot be played. ${scenarioProblems(asTyped).join(' ')}`;
  return `This is not an arrangement code. ${LOOKS_LIKE}`;
}

/** Read what was typed into the code field of the Warehouse Sort screen. Never throws. */
export function readArrangementCode(text: string): CodeReading<WarehouseSortScenario> {
  const typed = typeof text === 'string' ? text : '';
  const scenario = decodeScenario(typed);
  if (scenario) return { ok: true, scenario };
  return { ok: false, problem: whyNoCode(typed) };
}
