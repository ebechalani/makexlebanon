/**
 * The words of Locker Room on the simulator screen, where they differ from the words of the first
 * game (../screen-words.ts). Locker Room plays a "match", as the rules call it; what the referee
 * draws before it are two cards - the Team Colour card and the Zone Assignment card - so one
 * starting arrangement is a "draw", and the panel that sets it is "Cards".
 *
 * The category is for ages 13 to 15, and many students read English as a second language: every
 * sentence here is short and plain, and says no more than the simulator knows.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { GATE_TOUCH_PENALTY } from '../../locker-room/game';
import { defaultScenario, describeScenario, encodeScenario, SCENARIO_COUNT, ZONE_OPTION_NUMBERS } from '../../locker-room/scenario';
import { TEAM_COLORS } from '../../locker-room/field';
import type { ScreenWords } from '../screen-words';

/** The draw a new visitor sees first: "G5". */
export const DEFAULT_DRAW_CODE = encodeScenario(defaultScenario());

/** What the start zone of this game is called in the sentences about placing the robot. */
export const LOCKER_ROOM_START_ZONE = 'Locker Room';

export const LOCKER_ROOM_WORDS: Partial<ScreenWords> = {
  // (the rules say "match" too: "Duration 150 seconds", "When the Match Ends")
  goal: 'goal',
  goals: 'goals',
  // (on the closed Score sheet: "0 / 85 points · 0 of 8 done" fits a phone that is 360 wide)
  goalsShort: 'done',
  zonesHint: 'Colour the zones: Locker Room, Scan Station, pickup zones, big circles, zones A, B, C, the maze targets and the gate',
  // (the rules: "The match ends when the referee says STOP")
  finishedHint: 'The referee says "STOP": the robot stops and the field is scored as it is',
  resetHint: 'Put the cubes, the tokens, the gate and the Team Box back, and the robot into the Locker Room, ready for a new start.',
  sheetNotesHeading: 'Penalties and notes',
  sheetNote:
    'Steps 1, 2, 3, 5 and 6 count once, at the moment they are done. The tokens count at the end. ' +
    `Touching the closed gate costs ${GATE_TOUCH_PENALTY} points, once. The total is never below 0.`,
  randomLabel: 'Random draw',
  randomHint: `Draw the two cards at random: one of the ${SCENARIO_COUNT} draws`,
  defaultLabel: 'Default draw',
  // (the rules give no draw of their own: say whose choice this one is)
  defaultHint: `The simulator's first draw, ${DEFAULT_DRAW_CODE}. ${describeScenario(defaultScenario())}`,
  scenario: 'draw',
  scenarios: 'draws',
  scenarioTitle: 'Cards',
  scenarioNote: `${SCENARIO_COUNT} draws are possible: ${TEAM_COLORS.length} team colours x ${ZONE_OPTION_NUMBERS.length} zone cards. Changing a card puts the field back to the start.`,
  batchHint: 'Run your program on many draws at once',
  batchIntro:
    'A good program works with every draw of the cards. Run your blocks on many draws at once and see where they fail. ' +
    'Click a result to watch it on the stage.',
  // (this mission has no walls: the robot stops where the table ends)
  tableEdge: 'the edge of the table',
};
