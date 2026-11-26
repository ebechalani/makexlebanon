/**
 * The French word table of the shared simulator screen (./types.ts): the screen of Robot en fête
 * 2027, the French version of Warehouse Sort. Only that page sets it (`<SimulatorApp locale="fr">`
 * and the loader of its page).
 *
 * The French speaks to the student with "tu" and uses the infinitive for buttons and commands
 * (design D5). It has a no-break space (U+00A0) before : ; ! ? % » and after «, and a decimal
 * comma on the screen - 18,9 cm, 1:23,4, 0,5× (D10). The texts are those of the design's table
 * (fr-strings.json); where that table says a text never reaches this page (another game's
 * sensor, the random lists this page does not offer), the English member is used, and
 * ./text.test.ts lists each such member with its reason.
 *
 * The table is put together from its parts, one per part of the screen:
 *   ./fr-common.tsx   numbers, times, the names of the cubes, the colours, the end of a match
 *   ./fr-screen.tsx   title row, the screen, the strip above the blocks, Examples, the arrangement
 *   ./fr-match.tsx    the match controls, status line, score sheet, the test window
 *   ./fr-panels.tsx   the Sensors and CyberPi panels, the console
 *   ./fr-console.tsx  the sentences of the engine and the interpreter
 *   ./fr-stage.tsx    the ruler, the stage, program files
 */
import { FR_GRIPPER_TEXT } from './gripper';
import { frMoment, frNumber, frRefereeTime, frTimeTextOf, NB, withComma } from './fr-common';
import { FR_BATCH_TEXT, FR_MATCH_TEXT } from './fr-match';
import { FR_CONSOLE_TEXT, FR_CYBERPI_TEXT, FR_SENSOR_TEXT } from './fr-panels';
import { FR_APP_TEXT, FR_COMBINATION_TEXT, FR_PROGRAM_TEXT, FR_TITLE_TEXT } from './fr-screen';
import { FR_FILE_TEXT, FR_STAGE_TEXT } from './fr-stage';
import { formatClock } from '../format';
import type { NumberText, ScreenText } from './types';

const FR_NUMBER_TEXT: NumberText = {
  locale: 'fr',
  number: frNumber,
  clock: formatClock,
  moment: frMoment,
  refereeTime: frRefereeTime,
  timeTextOf: frTimeTextOf,
  percent: (share) => `${Math.round(share * 100)}${NB}%`,
  averageScore: (value) => withComma(value.toFixed(1)),
};

export const FR_TEXT: ScreenText = {
  ...FR_NUMBER_TEXT,
  ...FR_TITLE_TEXT,
  ...FR_APP_TEXT,
  ...FR_PROGRAM_TEXT,
  ...FR_MATCH_TEXT,
  ...FR_COMBINATION_TEXT,
  ...FR_BATCH_TEXT,
  ...FR_SENSOR_TEXT,
  ...FR_CYBERPI_TEXT,
  ...FR_CONSOLE_TEXT,
  ...FR_STAGE_TEXT,
  ...FR_FILE_TEXT,
  gripper: FR_GRIPPER_TEXT,
};
