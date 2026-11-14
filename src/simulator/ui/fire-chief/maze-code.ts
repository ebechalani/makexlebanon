/**
 * Reading a maze code that a student typed or pasted into the Fire Chief screen.
 *
 * The game's own decodeScenario() answers "yes" only for a maze that can be played, and plain
 * "no" for everything else. The screen needs to tell three things apart:
 *   - the code of a maze that can be played                     -> the maze
 *   - the code of a maze in which a room cannot be reached      -> the maze as well: the editor
 *     shows it and says what is wrong (MazeEditor.tsx), and its code can be shared like any other
 *   - a text that is no code                                    -> one plain sentence that says
 *     what a maze code looks like and, where that can be seen, what is different in this text
 *
 * Nothing about the form of a code is written down here a second time: the letters and the
 * length are read off codes the game itself makes (encodeScenario).
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { FIRE_SPOTS, ROOM_IDS } from '../../fire-chief/field';
import { defaultScenario, encodeScenario, openField, scenarioOfCode, type FireChiefScenario } from '../../fire-chief/scenario';
import type { CodeReading } from '../scenario-code';
import { ROOM_LABEL, SPOT_LABEL } from './maze-choices';

/** A code to show as an example: the code of the default maze. */
export const EXAMPLE_MAZE_CODE = encodeScenario(defaultScenario());

/** Only letters and digits count in a code; spaces, dashes and the case of the letters do not. */
const lettersAndDigits = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

const CODE_LENGTH = lettersAndDigits(EXAMPLE_MAZE_CODE).length;

/** The first letter of a code says the room of the fire, the second its place: as the game writes them. */
const ROOM_LETTERS = ROOM_IDS.map((room) => ({ letter: encodeScenario(openField(room, FIRE_SPOTS[0])).charAt(0), means: ROOM_LABEL[room].toLowerCase() }));
const SPOT_LETTERS = FIRE_SPOTS.map((spot) => ({ letter: encodeScenario(openField(ROOM_IDS[0], spot)).charAt(1), means: SPOT_LABEL[spot].label.toLowerCase() }));

/** "L (living room) or B (bedroom)", "C (corner), B (back wall) or S (side wall)" */
function choices(list: ReadonlyArray<{ letter: string; means: string }>): string {
  const said = list.map((entry) => `${entry.letter} (${entry.means})`);
  return said.length <= 1 ? said.join('') : `${said.slice(0, -1).join(', ')} or ${said[said.length - 1]}`;
}

const LOOKS_LIKE = `A maze code looks like ${EXAMPLE_MAZE_CODE}.`;

/**
 * Why a text is no maze code, as one plain sentence (or two short ones). It is only called for
 * a text the game could not read.
 */
function whyNoCode(text: string): string {
  const compact = lettersAndDigits(text);
  if (compact.length === 0) return `Type a maze code into the field. ${LOOKS_LIKE}`;
  if (text.length > 200) return `This text is too long for a maze code. ${LOOKS_LIKE}`;
  if (compact.length !== CODE_LENGTH) {
    return `This is not a maze code: a maze code has ${CODE_LENGTH} letters and digits, and this text has ${compact.length}. ${LOOKS_LIKE}`;
  }
  if (!ROOM_LETTERS.some((entry) => entry.letter === compact[0])) {
    return `This is not a maze code: the first letter says where the fire is, ${choices(ROOM_LETTERS)}. This text begins with ${compact[0]}. ${LOOKS_LIKE}`;
  }
  if (!SPOT_LETTERS.some((entry) => entry.letter === compact[1])) {
    return `This is not a maze code: the second letter says where the fire stands in its room, ${choices(SPOT_LETTERS)}. This text has ${compact[1]} there. ${LOOKS_LIKE}`;
  }
  // The eight characters of the walls: find the one the game does not use. (A character is fine
  // when the code reads with a harmless "0" in every other place of the walls.)
  for (let i = 2; i < compact.length; i++) {
    const alone = compact.slice(0, 2) + '0'.repeat(i - 2) + compact[i] + '0'.repeat(compact.length - i - 1);
    if (scenarioOfCode(alone) === null) {
      return `This is not a maze code: ${compact[i]} is never used in a maze code. Please check the code. ${LOOKS_LIKE}`;
    }
  }
  return `This is not a maze code. ${LOOKS_LIKE}`;
}

/**
 * Read what was typed into the code field of the Fire Chief screen (or saved by it). The maze
 * of a code is handed back whether or not it can be played; a text that is no code gets a plain
 * sentence. Never throws.
 */
export function readMazeCode(text: string): CodeReading<FireChiefScenario> {
  const typed = typeof text === 'string' ? text : '';
  const scenario = scenarioOfCode(typed);
  if (scenario) return { ok: true, scenario };
  return { ok: false, problem: whyNoCode(typed) };
}
