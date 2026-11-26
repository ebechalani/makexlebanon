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
 * The words the panel shows are a game word list (ArrangementWords): English when a page gives
 * none (EN_ARRANGEMENT_WORDS, and the functions exported below), French on the page of Robot en
 * fête 2027 (../robot-en-fete/arrangement-words.ts), with the same panel (arrangementPanel).
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { WAREHOUSES, WAREHOUSE_IDS, type BayColor, type WarehouseId } from '../../warehouse-sort/field';
import { CUBE_COLORS, EN_LETTERS, blueWarehouse, scenarioProblems, withCube, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';

/** The words of the Cube colours panel (./ArrangementEditor.tsx) and of its sentences. */
export interface ArrangementWords {
  /** a warehouse as the panel names it: "W1" */
  warehouse(warehouse: WarehouseId): string;
  /** where it is on the mat: "top left" */
  place(warehouse: WarehouseId): string;
  /** the colour of a cube: "red" */
  color(color: CubeColor): string;
  /** the letter on the button of a colour (the letter of the codes): "R" */
  letter(color: CubeColor): string;
  /** the heading of the panel */
  legend: string;
  /** what a screen reader hears for the three buttons of a warehouse (`name`: warehouseName) */
  chipsLabel(name: string): string;
  /** a colour that is no cube colour (never from a button) */
  notAColour: string;
  /** a blue cube moved there would break the arrangement; `problems`: what is wrong then */
  notPossible(problems: string[]): string;
  /** the blue cube moved: the warehouse it came from (`from`) has this colour now */
  blueMoved(from: string, now: string): string;
  /** red or green for the warehouse of the blue cube */
  blueStays: string;
  /** a change that would leave no cube of the colour `missing` */
  lastOfColour(missing: string): string;
  /** what is wrong with an arrangement, in these words (../../warehouse-sort/scenario.ts scenarioProblems) */
  problems(s: WarehouseSortScenario): string[];
}

/** The words of Warehouse Sort. */
export const EN_ARRANGEMENT_WORDS: ArrangementWords = {
  warehouse: (w) => w,
  place: (w) => WAREHOUSES[w].place,
  color: (color) => color,
  // (the letters drawn on the cubes: ../../warehouse-sort/game.ts CUBE_LETTER)
  letter: (color) => EN_LETTERS[color],
  legend: 'The cubes in the warehouses',
  chipsLabel: (name) => `Cube in ${name}`,
  notAColour: 'A cube is red, green or blue.',
  notPossible: (problems) => `Not possible. ${problems.join(' ')}`,
  blueMoved: (from, now) => `Only one cube can be blue: ${from} is ${now} now.`,
  blueStays: 'One cube must be blue. To move it, choose blue for another warehouse.',
  lastOfColour: (missing) => `Not possible: then no cube is ${missing}. At least one cube must be ${missing}.`,
  problems: scenarioProblems,
};

/** The four warehouses as they lie on the mat: the top row, then the bottom row. */
export const WAREHOUSE_ROWS: ReadonlyArray<readonly [WarehouseId, WarehouseId]> = [
  ['W1', 'W2'],
  ['W3', 'W4'],
];

/** The other bay colour: red for green, green for red. */
export const otherColor = (color: BayColor): BayColor => (color === 'red' ? 'green' : 'red');

/**
 * What a change of one cube gives: the new arrangement (with a sentence when another cube changed
 * too), or the sentence that says why not.
 */
export type CubeChange = { ok: true; scenario: WarehouseSortScenario; note?: string } | { ok: false; problem: string };

/** The panel's logic in one set of words (the functions below are the English ones). */
export interface ArrangementPanel {
  /** "W1, top left": a warehouse and where it is on the mat */
  warehouseName(warehouse: WarehouseId): string;
  /**
   * The arrangement with the cube of `warehouse` in `color`. Blue moves the one blue cube (a swap);
   * a change that would leave no blue, no red or no green cube is refused with a plain sentence.
   */
  changeCube(scenario: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): CubeChange;
  /** the arrangement in words, warehouse by warehouse: "W1 green, W2 red, W3 blue, W4 red" */
  arrangementInWords(scenario: WarehouseSortScenario): string;
}

/** The Cube colours panel in these words. (What is allowed does not depend on the words.) */
export function arrangementPanel(words: ArrangementWords): ArrangementPanel {
  function warehouseName(warehouse: WarehouseId): string {
    return `${words.warehouse(warehouse)}, ${words.place(warehouse)}`;
  }
  function changeCube(scenario: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): CubeChange {
    if (!CUBE_COLORS.includes(color)) return { ok: false, problem: words.notAColour };
    const now = scenario.cubes[warehouse];
    if (now === color) return { ok: true, scenario };
    if (color === 'blue') {
      const from = blueWarehouse(scenario);
      let next = withCube(scenario, warehouse, 'blue');
      // (the cube that was blue takes the colour this warehouse had: still one blue, the same reds and greens)
      if (from !== null && from !== warehouse) next = withCube(next, from, now);
      const problems = words.problems(next);
      if (problems.length > 0) return { ok: false, problem: words.notPossible(problems) };
      return from !== null ? { ok: true, scenario: next, note: words.blueMoved(words.warehouse(from), words.color(now)) } : { ok: true, scenario: next };
    }
    if (now === 'blue') return { ok: false, problem: words.blueStays };
    const next = withCube(scenario, warehouse, color);
    if (words.problems(next).length === 0) return { ok: true, scenario: next };
    const missing = otherColor(color);
    return { ok: false, problem: words.lastOfColour(words.color(missing)) };
  }
  function arrangementInWords(scenario: WarehouseSortScenario): string {
    return WAREHOUSE_IDS.map((w) => `${words.warehouse(w)} ${words.color(scenario.cubes[w])}`).join(', ');
  }
  return { warehouseName, changeCube, arrangementInWords };
}

/** The panel of Warehouse Sort, in English. */
export const EN_ARRANGEMENT_PANEL: ArrangementPanel = arrangementPanel(EN_ARRANGEMENT_WORDS);

/** "W1, top left": a warehouse and where it is on the mat. */
export function warehouseName(warehouse: WarehouseId): string {
  return EN_ARRANGEMENT_PANEL.warehouseName(warehouse);
}

/**
 * The arrangement with the cube of `warehouse` in `color`. Blue moves the one blue cube (a swap);
 * a change that would leave no blue, no red or no green cube is refused with a plain sentence.
 */
export function changeCube(scenario: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): CubeChange {
  return EN_ARRANGEMENT_PANEL.changeCube(scenario, warehouse, color);
}

/** The arrangement in words, warehouse by warehouse: "W1 green, W2 red, W3 blue, W4 red". */
export function arrangementInWords(scenario: WarehouseSortScenario): string {
  return EN_ARRANGEMENT_PANEL.arrangementInWords(scenario);
}
