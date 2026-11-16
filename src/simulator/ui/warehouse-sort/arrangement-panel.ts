/**
 * What the Cube colours panel of Warehouse Sort does when a student changes the colour of one
 * cube (./ArrangementEditor.tsx), and the words it shows.
 *
 * An arrangement has exactly one blue cube, and the other three are red or green with at least
 * one of each (../../warehouse-sort/scenario.ts). The panel keeps it that way, simply:
 *
 *   - blue for another warehouse: the blue cube MOVES there - the two cubes swap their colours
 *     (the warehouse that had the blue cube gets the colour the other one had). One plain
 *     sentence says which cube changed too. Swapping never breaks the arrangement.
 *   - red or green for the warehouse of the blue cube: refused - there must be a blue cube. The
 *     sentence says how to move it.
 *   - red or green that would leave no red (or no green) cube: refused, as before.
 *
 * A refused change leaves the field as it was: an arrangement that cannot be played never
 * reaches the stage.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { WAREHOUSES, WAREHOUSE_IDS, type BayColor, type WarehouseId } from '../../warehouse-sort/field';
import { CUBE_COLORS, blueWarehouse, scenarioProblems, withCube, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';

/** The four warehouses as they lie on the mat: the top row, then the bottom row. */
export const WAREHOUSE_ROWS: ReadonlyArray<readonly [WarehouseId, WarehouseId]> = [
  ['W1', 'W2'],
  ['W3', 'W4'],
];

/** "W1, top left": a warehouse and where it is on the mat. */
export function warehouseName(warehouse: WarehouseId): string {
  return `${warehouse}, ${WAREHOUSES[warehouse].place}`;
}

/** The other bay colour: red for green, green for red. */
export const otherColor = (color: BayColor): BayColor => (color === 'red' ? 'green' : 'red');

/**
 * What a change of one cube gives: the new arrangement (with a sentence when another cube changed
 * too), or the sentence that says why not.
 */
export type CubeChange = { ok: true; scenario: WarehouseSortScenario; note?: string } | { ok: false; problem: string };

/**
 * The arrangement with the cube of `warehouse` in `color`. Blue moves the one blue cube (a swap);
 * a change that would leave no blue, no red or no green cube is refused with a plain sentence.
 */
export function changeCube(scenario: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): CubeChange {
  if (!CUBE_COLORS.includes(color)) return { ok: false, problem: 'A cube is red, green or blue.' };
  const now = scenario.cubes[warehouse];
  if (now === color) return { ok: true, scenario };
  if (color === 'blue') {
    const from = blueWarehouse(scenario);
    let next = withCube(scenario, warehouse, 'blue');
    // (the cube that was blue takes the colour this warehouse had: still one blue, the same reds and greens)
    if (from !== null && from !== warehouse) next = withCube(next, from, now);
    const problems = scenarioProblems(next);
    if (problems.length > 0) return { ok: false, problem: `Not possible. ${problems.join(' ')}` };
    return from !== null ? { ok: true, scenario: next, note: `Only one cube can be blue: ${from} is ${now} now.` } : { ok: true, scenario: next };
  }
  if (now === 'blue') return { ok: false, problem: 'One cube must be blue. To move it, choose blue for another warehouse.' };
  const next = withCube(scenario, warehouse, color);
  if (scenarioProblems(next).length === 0) return { ok: true, scenario: next };
  const missing = otherColor(color);
  return { ok: false, problem: `Not possible: then no cube is ${missing}. At least one cube must be ${missing}.` };
}

/** The arrangement in words, warehouse by warehouse: "W1 green, W2 red, W3 blue, W4 red". */
export function arrangementInWords(scenario: WarehouseSortScenario): string {
  return WAREHOUSE_IDS.map((w) => `${w} ${scenario.cubes[w]}`).join(', ');
}
