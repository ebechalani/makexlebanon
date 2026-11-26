/**
 * Robot en fête 2027: reading an arrangement code that a student typed or pasted (or that the
 * screen saved for the next visit) - the French twin of ../warehouse-sort/arrangement-code.ts.
 *
 * A code is the four cube colours as they lie on the mat, top row then bottom row, with R
 * (rouge), V (vert) and B (bleu): "VR-BR" = E1 vert, E2 rouge, E3 bleu, E4 rouge. The G of a
 * Warehouse Sort code is read as vert too ("GR-BR" is the same arrangement). Letter case, spaces
 * and dashes do not matter. Everything else gets one plain French sentence that says what is
 * wrong, in the game's own words (../../robot-en-fete/scenario-words.ts).
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { FR_CODEC, FR_SCENARIO_TEXT } from '../../robot-en-fete/scenario-words';
import type { WarehouseSortScenario } from '../../warehouse-sort/scenario';
import type { CodeReading } from '../scenario-code';
import { ROBOT_EN_FETE_DEFAULT_CODE } from './words';

const LOOKS_LIKE = `Un code a quatre lettres, R (rouge), V (vert) ou B (bleu), comme ${ROBOT_EN_FETE_DEFAULT_CODE}.`;

/** Why a text is no code of an arrangement that can be played. Only called for a text the game could not read. */
function whyNoCode(text: string): string {
  // (only an empty field, or one with nothing but spaces, asks for a code: anything typed is answered)
  if (text.trim().length === 0) return `Tape un code dans la case. ${LOOKS_LIKE}`;
  // the code of an arrangement that cannot be played: say what is missing, in the game's own words
  const asTyped = text.length <= 100 ? FR_CODEC.ofCode(text) : null;
  if (asTyped) return `Cette disposition ne peut pas être jouée. ${FR_SCENARIO_TEXT.scenarioProblems(asTyped).join(' ')}`;
  return `Ce n’est pas un code de disposition. ${LOOKS_LIKE}`;
}

/** Read what was typed into the code field of the Robot en fête screen. Never throws. */
export function readRobotEnFeteCode(text: string): CodeReading<WarehouseSortScenario> {
  const typed = typeof text === 'string' ? text : '';
  const scenario = FR_CODEC.decode(typed);
  if (scenario) return { ok: true, scenario };
  return { ok: false, problem: whyNoCode(typed) };
}
