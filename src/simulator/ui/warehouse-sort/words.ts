/**
 * The words of Warehouse Sort on the simulator screen, where they differ from the words of the
 * first game (../screen-words.ts). Warehouse Sort plays a "match" like Fire Rescue, but what the
 * referee draws is an "arrangement": the colour of the cube in each of the four warehouses.
 *
 * This is the beginner category, and many students read English as a second language: every
 * sentence here is short and plain, and says no more than the simulator knows.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { BLUE_PENALTY } from '../../warehouse-sort/game';
import { defaultScenario, encodeScenario, SCENARIO_COUNT } from '../../warehouse-sort/scenario';
import type { ScreenWords } from '../screen-words';

/** The arrangement a new visitor sees first: "GR-BR". */
export const DEFAULT_ARRANGEMENT_CODE = encodeScenario(defaultScenario());

/** What the start zone of this game is called in the sentences about placing the robot. */
export const WAREHOUSE_SORT_START_ZONE = 'start zone';

export const WAREHOUSE_SORT_WORDS: Partial<ScreenWords> = {
  // (the rules say "match" too: "Match Flow (one round)")
  goal: 'goal',
  goals: 'goals',
  // (on the closed Score sheet: "5 / 80 points · 1 of 9 done" fits a phone that is 360 wide)
  goalsShort: 'done',
  zonesHint: 'Colour the zones: start zone, warehouses, the two bays and the two finish pads',
  resetHint: 'Put the four cubes back in their warehouses and the robot into the start zone, ready for a new start.',
  sheetNotesHeading: 'Penalties and notes',
  sheetNote:
    'Leaving the start zone and picking up a cube count once. Cubes in the bays and parking count at the end. ' +
    `Here, moving the blue cube costs ${BLUE_PENALTY} points. The total is never below 0.`,
  randomLabel: 'Random arrangement',
  // (the rules have no draw: the referee only places the cubes, at least one of each colour)
  randomHint: `Draw one of the ${SCENARIO_COUNT} arrangements at random`,
  defaultLabel: 'Default arrangement',
  // (the rules give no arrangement of their own: say whose choice this one is)
  defaultHint: `The simulator's first arrangement, ${DEFAULT_ARRANGEMENT_CODE}: green at the top left, red on the right, blue at the bottom left`,
  scenario: 'arrangement',
  scenarios: 'arrangements',
  scenarioTitle: 'Cube colours',
  scenarioNote: `${SCENARIO_COUNT} arrangements are possible: one cube is blue, the others red or green, at least one of each. Changing a colour puts the field back to the start.`,
  batchHint: 'Run your program on many arrangements at once',
  batchIntro:
    'A good program works with every arrangement of the cubes. Run your blocks on many arrangements at once and see where they fail. ' +
    'Click a result to watch it on the stage.',
  // (the referee counts "picked up" only when the cube is lifted 1 cm or carried: closing the claw is not enough)
  grabbed: 'Gripped',
  // (this mission has no walls: the robot stops where the table ends)
  tableEdge: 'the edge of the table',
};
