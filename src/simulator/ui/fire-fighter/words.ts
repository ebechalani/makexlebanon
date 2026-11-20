/**
 * The words of Fire Fighter on the simulator screen, where they differ from the words of the first
 * game (../screen-words.ts). Fire Fighter plays a "match", as the rules call it; what brings points
 * is a "delivery" (a cube under its tower with the letter showing); and the field has ONE setup,
 * which nothing draws (../../fire-fighter/scenario.ts) - so the panel that shows it is "The field",
 * and beside its heading stands "one setup" instead of a code (SimulatorAppProps.fixedSetup).
 *
 * The category is for ages 8 to 10, and their teachers read along: every sentence here is short and
 * plain, and says no more than the simulator knows. The words of the "Test on many ..." window and
 * of the panel's buttons are left out: with one setup the screen has neither.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { MOVED_TOWER_PENALTY } from '../../fire-fighter/game';
import type { ScreenWords } from '../screen-words';

/** What the start zone of this game is called in the sentences about placing the robot (the rules, §2.1). */
export const FIRE_FIGHTER_START_ZONE = 'Fire Station';

export const FIRE_FIGHTER_WORDS: Partial<ScreenWords> = {
  // (a "match", as the rules say: "Before the Match Starts", §3 - so `match` stays the first game's word.
  // What brings points is a delivery: one cube under its tower, "Five successful deliveries earn 100 points", §7.1)
  goal: 'delivery',
  goals: 'deliveries',
  // (the zones as the game draws them: ../../fire-fighter/game.ts overlays)
  zonesHint: `Colour the zones: the ${FIRE_FIGHTER_START_ZONE}, the cube squares, the white dashed squares under the towers and the five picture squares`,
  resetHint: `Put the five cubes and the five towers back and the robot into the ${FIRE_FIGHTER_START_ZONE}, ready for a new start.`,
  sheetNotesHeading: 'Penalties',
  sheetNote:
    "Each tower is checked once, at the end. The yellow cube counts only if X was the robot's next delivery after it took the yellow cube. " +
    `A tower pushed off its picture square: 0 for it and ${MOVED_TOWER_PENALTY} points off. The total is never below 0.`,
  scenario: 'setup',
  scenarios: 'setups',
  scenarioTitle: 'The field',
  scenarioSummary: 'one setup',
  // (this mission has no walls: the robot stops where the table ends)
  tableEdge: 'the edge of the table',
};
