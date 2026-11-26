/**
 * Robot en fête 2027: the Warehouse Sort mission in French, a category of its own (outside every
 * season of the site).
 *
 * It is the very same game as ../warehouse-sort/game.ts - the same mat, cubes, 24
 * arrangements, points, constants, robot and referee - made by the same function
 * (createWarehouseSortGame) with French words (./referee-words.ts), French codes and French
 * sentences about an arrangement (./scenario-words.ts: E1 - E4, "VR-BR"), and an id and a title
 * of its own. A match played here gives the same points, the same times and the same score lines
 * (ids, points, ok, times) as the same match in Warehouse Sort; ./game.test.ts checks it on
 * every example and arrangement.
 *
 * The id "robot-en-fete" names the work a student saves here (mbot2-sim:robot-en-fete:*) and the
 * program files; the blocks are those of Warehouse Sort (../blocks/palettes.ts).
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 */
import { createWarehouseSortGame } from '../warehouse-sort/game';
import type { Game } from '../core/types';
import type { WarehouseSortScenario } from '../warehouse-sort/scenario';
import { FR_REFEREE_WORDS } from './referee-words';
import { FR_CODEC, FR_SCENARIO_TEXT, NB } from './scenario-words';

export const ROBOT_EN_FETE_ID = 'robot-en-fete';

export const robotEnFeteGame: Game<WarehouseSortScenario> = createWarehouseSortGame(FR_REFEREE_WORDS, {
  id: ROBOT_EN_FETE_ID,
  // (its simulator is « Tri d’entrepôt », of the category Robot en fête 2027)
  title: `MakeX Lebanon - Inspire${NB}: Tri d’entrepôt (Robot en fête 2027)`,
  codec: FR_CODEC,
  scenarioText: FR_SCENARIO_TEXT,
});
