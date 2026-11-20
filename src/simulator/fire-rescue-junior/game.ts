/**
 * MakeX Lebanon 2027 - Fire Rescue Junior (ages 10-12): the game definition.
 *
 * Fire Rescue Junior is played on the Fire Rescue field, with the Fire Rescue robot, by the
 * Fire Rescue referee, with the Fire Rescue examples (../fire-rescue). Only the draw before a
 * match is different: the referee draws the buckets on W1..W4 and nothing else (./scenario.ts).
 * So this game is the Fire Rescue game with its own id and its own combinations, and nothing
 * of ../fire-rescue changes for it. Fire Rescue Senior (ages 13-15) is ../fire-rescue/game.ts
 * itself, under its old id 'fire-rescue'.
 *
 * Its id, 'fire-rescue-junior', keeps what the browser saves for it (blocks, settings) apart
 * from Senior's. It shows the block palette of Fire Rescue (../blocks/palettes.ts: GAME_VERSIONS),
 * and a program file of one opens in the other without a word about another game
 * (../ui/program-file.ts).
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 */
import type { Game } from '../core/types';
import { fireRescueGame } from '../fire-rescue/game';
import type { FireRescueScenario } from '../fire-rescue/scenario';
import {
  JUNIOR_SCENARIO_COUNT,
  decodeJuniorScenario,
  describeJuniorScenario,
  encodeJuniorScenario,
  juniorScenarioProblems,
  randomJuniorScenario,
} from './scenario';

/** The id of this game: the name of its saved work and of its program files. */
export const FIRE_RESCUE_JUNIOR_ID = 'fire-rescue-junior';

export const fireRescueJuniorGame: Game<FireRescueScenario> = {
  // the field, the robot, the start zone, the clock, the restart penalty and the referee of Fire Rescue ...
  ...fireRescueGame,
  // ... under a name of its own ...
  id: FIRE_RESCUE_JUNIOR_ID,
  title: 'MakeX Lebanon 2027 - Fire Rescue Junior',
  // ... with the rule book's arrangement as its first combination (the same as Fire Rescue's) ...
  defaultScenario: fireRescueGame.defaultScenario,
  // ... and only the 24 bucket draws
  randomScenario: randomJuniorScenario,
  scenarioCount: () => JUNIOR_SCENARIO_COUNT,
  encodeScenario: encodeJuniorScenario,
  decodeScenario: decodeJuniorScenario,
  describeScenario: describeJuniorScenario,
  scenarioProblems: juniorScenarioProblems,
};
