/**
 * What the Cube colours panel of Warehouse Sort does when a student changes the colour of one
 * cube (./ArrangementEditor.tsx), and the words it shows.
 *
 * The rules want both colours on the field ("at least one of each color must be present"). A
 * change that would leave only one colour is refused with one plain sentence, and the field
 * stays as it was: an arrangement that cannot be played never reaches the stage.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { WAREHOUSES, WAREHOUSE_IDS, type WarehouseId } from '../../warehouse-sort/field';
import { CUBE_COLORS, scenarioProblems, withCube, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';

/** The four warehouses as they lie on the mat: the top row, then the bottom row. */
export const WAREHOUSE_ROWS: ReadonlyArray<readonly [WarehouseId, WarehouseId]> = [
  ['W1', 'W2'],
  ['W3', 'W4'],
];

/** "W1, top left": a warehouse and where it is on the mat. */
export function warehouseName(warehouse: WarehouseId): string {
  return `${warehouse}, ${WAREHOUSES[warehouse].place}`;
}

/** The other colour: red for green, green for red. */
export const otherColor = (color: CubeColor): CubeColor => (color === 'red' ? 'green' : 'red');

/** What a change of one cube gives: the new arrangement, or the sentence that says why not. */
export type CubeChange = { ok: true; scenario: WarehouseSortScenario } | { ok: false; problem: string };

/**
 * The arrangement with the cube of `warehouse` in `color`. Refused - with a plain sentence - when
 * the field would then hold only one colour.
 */
export function changeCube(scenario: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): CubeChange {
  if (!CUBE_COLORS.includes(color)) return { ok: false, problem: 'A cube is red or green.' };
  const next = withCube(scenario, warehouse, color);
  if (scenarioProblems(next).length === 0) return { ok: true, scenario: next };
  return { ok: false, problem: `Not possible: then all four cubes are ${color}. At least one cube must be ${otherColor(color)}.` };
}

/** The arrangement in words, warehouse by warehouse: "W1 red, W2 green, W3 green, W4 red". */
export function arrangementInWords(scenario: WarehouseSortScenario): string {
  return WAREHOUSE_IDS.map((w) => `${w} ${scenario.cubes[w]}`).join(', ');
}
