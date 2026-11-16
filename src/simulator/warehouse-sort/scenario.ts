/**
 * A Warehouse Sort "arrangement": which colour of cube stands in each of the four warehouses.
 *
 * The rules (§3 and §5: "Place 4 cubes (mix of red/green) on the yellow warehouses", "at least
 * one of each color must be present") have red and green cubes only. The owner of the site
 * decided that the simulator's field always has ONE BLUE cube as well: the robot must look at
 * a cube before it takes it, and leave the blue one where it is ("Blue shouldn't be touched: the
 * robot checks it; if it is blue, it leaves it"). So:
 *
 *   - exactly one cube is blue,
 *   - the other three are red or green, with at least one red and at least one green.
 *
 * 4 places for the blue cube x 6 ways to colour the other three (2 x 2 x 2 = 8, minus "all red"
 * and "all green") = 24 arrangements.
 *
 * The short code is the four colours as they lie on the mat (as the screen shows it), top row
 * then bottom row: "GR-BR" = W1 green, W2 red (top), W3 blue, W4 red (bottom).
 */
import { WAREHOUSE_IDS, type BayColor, type WarehouseId } from './field';

/** The colour of a cube: red or green (to be sorted into the bay of that colour), or blue (to be left alone). */
export type CubeColor = BayColor | 'blue';
export const CUBE_COLORS: CubeColor[] = ['red', 'green', 'blue'];
/** The colours that go to a bay. */
export const SORTED_COLORS: BayColor[] = ['red', 'green'];
/** The colour of the cube that must be left alone. */
export const LEAVE_ALONE_COLOR = 'blue' as const satisfies CubeColor;

export interface WarehouseSortScenario {
  /** the colour of the cube in each warehouse */
  cubes: Record<WarehouseId, CubeColor>;
}

const LETTER: Record<CubeColor, string> = { red: 'R', green: 'G', blue: 'B' };
const FROM_LETTER: Record<string, CubeColor> = { R: 'red', G: 'green', B: 'blue' };

/** How many ways there are to colour the three cubes that are not blue (2 x 2 x 2, minus all red and all green). */
const SORTED_WAYS = 6;
/** How many arrangements there are: 4 places for the blue cube x 6. */
export const SCENARIO_COUNT = WAREHOUSE_IDS.length * SORTED_WAYS;

const isCubeColor = (v: unknown): v is CubeColor => v === 'red' || v === 'green' || v === 'blue';

/**
 * What is wrong with an arrangement, one plain sentence per problem; an empty list means it can
 * be played.
 */
export function scenarioProblems(s: WarehouseSortScenario): string[] {
  if (!s || typeof s !== 'object' || !s.cubes || typeof s.cubes !== 'object') {
    return ['Every warehouse needs a red, a green or a blue cube.'];
  }
  const colors = WAREHOUSE_IDS.map((w) => s.cubes[w]);
  if (!colors.every(isCubeColor)) return ['Every warehouse needs a red, a green or a blue cube.'];
  const out: string[] = [];
  const blue = colors.filter((c) => c === 'blue').length;
  if (blue === 0) out.push('One cube must be blue.');
  if (blue > 1) out.push(`There are ${blue} blue cubes. Only one cube may be blue.`);
  if (!colors.includes('red')) out.push('At least one cube must be red.');
  if (!colors.includes('green')) out.push('At least one cube must be green.');
  return out;
}

export function isValidScenario(s: WarehouseSortScenario): boolean {
  return scenarioProblems(s).length === 0;
}

/** The warehouse of the blue cube (of a valid arrangement: the only one). */
export function blueWarehouse(s: WarehouseSortScenario): WarehouseId | null {
  return WAREHOUSE_IDS.find((w) => s.cubes[w] === 'blue') ?? null;
}

/** The warehouses whose cube goes to a bay (red or green), in the order W1 .. W4. */
export function sortedWarehouses(s: WarehouseSortScenario): WarehouseId[] {
  return WAREHOUSE_IDS.filter((w) => s.cubes[w] === 'red' || s.cubes[w] === 'green');
}

/**
 * Number 0..23 of an arrangement: 6 x (the place of the blue cube: W1 = 0 .. W4 = 3), plus the
 * other three warehouses, W1 first, read as a binary number (red = 0, green = 1) minus one -
 * "all red" (0) and "all green" (7) are not arrangements. -1 for an arrangement that is not
 * valid. (Only for the order of "all 24 arrangements" and the random draw: a student never sees
 * this number, and a code is never a number - see decodeScenario.)
 */
export function scenarioIndex(s: WarehouseSortScenario): number {
  if (!isValidScenario(s)) return -1;
  const blue = WAREHOUSE_IDS.indexOf(blueWarehouse(s) as WarehouseId);
  let value = 0;
  for (const w of WAREHOUSE_IDS) if (s.cubes[w] !== 'blue') value = value * 2 + (s.cubes[w] === 'green' ? 1 : 0);
  return blue * SORTED_WAYS + value - 1;
}

/** The arrangement with this number (0..23; other whole numbers wrap round). */
export function scenarioFromIndex(index: number): WarehouseSortScenario {
  const n = ((Math.floor(index) % SCENARIO_COUNT) + SCENARIO_COUNT) % SCENARIO_COUNT;
  const blue = WAREHOUSE_IDS[Math.floor(n / SORTED_WAYS)];
  const value = (n % SORTED_WAYS) + 1;
  const others = WAREHOUSE_IDS.filter((w) => w !== blue);
  const cubes = { [blue]: 'blue' } as Record<WarehouseId, CubeColor>;
  others.forEach((w, i) => {
    cubes[w] = (value >> (others.length - 1 - i)) & 1 ? 'green' : 'red';
  });
  return { cubes: { W1: cubes.W1, W2: cubes.W2, W3: cubes.W3, W4: cubes.W4 } };
}

/** All 24 arrangements, in number order (for "test on every arrangement"). */
export function allScenarios(): WarehouseSortScenario[] {
  return Array.from({ length: SCENARIO_COUNT }, (_, i) => scenarioFromIndex(i));
}

/**
 * The arrangement a new visitor sees first: "GR-BR". Each cube that goes to a bay stands on the
 * side of its bay - the green one at the top left (the green bay is left of the middle), the two
 * red ones on the right (the red bay is right of the middle) - and the blue cube, which stays
 * where it is, at the bottom left. One look at the field says what to do. (The rules give no
 * arrangement of their own, and they have no blue cube.)
 */
export function defaultScenario(): WarehouseSortScenario {
  return { cubes: { W1: 'green', W2: 'red', W3: 'blue', W4: 'red' } };
}

/** Each of the 24 arrangements is equally likely. The same `rng` sequence gives the same arrangement. */
export function randomScenario(rng: () => number): WarehouseSortScenario {
  return scenarioFromIndex(Math.floor(rng() * SCENARIO_COUNT) % SCENARIO_COUNT);
}

/** Short code of an arrangement: "GR-BR" (W1 W2, then W3 W4 - as the cubes lie on the mat). */
export function encodeScenario(s: WarehouseSortScenario): string {
  const letters = WAREHOUSE_IDS.map((w) => LETTER[s.cubes[w]] ?? '?').join('');
  return `${letters.slice(0, 2)}-${letters.slice(2)}`;
}

/**
 * The letters and digits of a typed code, in capitals: "gr-br" -> "GRBR". Wide letters, as a
 * keyboard for Chinese or Japanese types them ("ＧＲ－ＢＲ"), are read as the usual ones (NFKC).
 */
export function compactCode(code: string): string {
  return code.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * What a code says, also when the arrangement cannot be played ("RR-GG", "BB-RG"): letter case,
 * spaces and dashes do not matter. Null for a text that is no code at all - it never throws.
 * (For an editor that is being changed. A match is played with decodeScenario() below.)
 */
export function scenarioOfCode(code: string): WarehouseSortScenario | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  const compact = compactCode(code);
  if (!/^[RGB]{4}$/.test(compact)) return null;
  const cubes = {} as Record<WarehouseId, CubeColor>;
  WAREHOUSE_IDS.forEach((w, i) => {
    cubes[w] = FROM_LETTER[compact[i]];
  });
  return { cubes };
}

/**
 * Read a code back: "GR-BR", "grbr", "G R B R". Null for anything else, and for a code whose
 * arrangement cannot be played (no blue cube, two blue cubes, no red or no green). Never throws.
 *
 * Unlike Fire Rescue, a number is no code here: the test window numbers its rows 1, 2, 3 ...,
 * and a student who typed a row number would get another arrangement than that row's.
 */
export function decodeScenario(code: string): WarehouseSortScenario | null {
  if (typeof code !== 'string') return null;
  const s = scenarioOfCode(code.trim());
  return s !== null && isValidScenario(s) ? s : null;
}

/** One line for people: "Red: W2, W4. Green: W1. Blue: W3 (leave it)." */
export function describeScenario(s: WarehouseSortScenario): string {
  const problems = scenarioProblems(s);
  if (problems.length > 0) return `This arrangement cannot be played. ${problems.join(' ')}`;
  const where = (color: CubeColor) => WAREHOUSE_IDS.filter((w) => s.cubes[w] === color).join(', ');
  return `Red: ${where('red')}. Green: ${where('green')}. Blue: ${where('blue')} (leave it).`;
}

/** The same arrangement with one cube changed (for an editor; the result may be invalid). */
export function withCube(s: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): WarehouseSortScenario {
  return { cubes: { ...s.cubes, [warehouse]: color } };
}
