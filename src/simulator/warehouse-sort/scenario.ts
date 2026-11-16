/**
 * A Warehouse Sort "arrangement": which colour of cube stands in each of the four warehouses
 * (rules §3 and §5: "Place 4 cubes (mix of red/green) on the yellow warehouses", "at least one
 * of each color must be present").
 *
 * Each warehouse holds a red or a green cube: 2 x 2 x 2 x 2 = 16 ways, minus "all red" and
 * "all green" = 14 arrangements.
 *
 * The short code is the four colours as they lie on the mat, top row then bottom row:
 * "RG-GR" = W1 red, W2 green (top), W3 green, W4 red (bottom).
 */
import { WAREHOUSE_IDS, type BayColor, type WarehouseId } from './field';

export type CubeColor = BayColor;
export const CUBE_COLORS: CubeColor[] = ['red', 'green'];

export interface WarehouseSortScenario {
  /** the colour of the cube in each warehouse */
  cubes: Record<WarehouseId, CubeColor>;
}

const LETTER: Record<CubeColor, string> = { red: 'R', green: 'G' };
const FROM_LETTER: Record<string, CubeColor> = { R: 'red', G: 'green' };

/** How many arrangements there are. */
export const SCENARIO_COUNT = 14;

const isCubeColor = (v: unknown): v is CubeColor => v === 'red' || v === 'green';

/**
 * What is wrong with an arrangement, one plain sentence per problem; an empty list means it can
 * be played.
 */
export function scenarioProblems(s: WarehouseSortScenario): string[] {
  if (!s || typeof s !== 'object' || !s.cubes || typeof s.cubes !== 'object') {
    return ['Every warehouse needs a red or a green cube.'];
  }
  const colors = WAREHOUSE_IDS.map((w) => s.cubes[w]);
  if (!colors.every(isCubeColor)) return ['Every warehouse needs a red or a green cube.'];
  const out: string[] = [];
  if (!colors.includes('red')) out.push('At least one cube must be red.');
  if (!colors.includes('green')) out.push('At least one cube must be green.');
  return out;
}

export function isValidScenario(s: WarehouseSortScenario): boolean {
  return scenarioProblems(s).length === 0;
}

/**
 * Number 0..13 of an arrangement: W1 W2 W3 W4 read as a binary number (red = 0, green = 1, W1
 * first), minus one - "all red" (0) and "all green" (15) are not arrangements. -1 for an
 * arrangement that is not valid. (Only for the order of "all 14 arrangements" and the random
 * draw: a student never sees this number, and a code is never a number - see decodeScenario.)
 */
export function scenarioIndex(s: WarehouseSortScenario): number {
  if (!isValidScenario(s)) return -1;
  let value = 0;
  for (const w of WAREHOUSE_IDS) value = value * 2 + (s.cubes[w] === 'green' ? 1 : 0);
  return value - 1;
}

/** The arrangement with this number (0..13; other whole numbers wrap round). */
export function scenarioFromIndex(index: number): WarehouseSortScenario {
  const n = ((Math.floor(index) % SCENARIO_COUNT) + SCENARIO_COUNT) % SCENARIO_COUNT;
  const value = n + 1;
  const cubes = {} as Record<WarehouseId, CubeColor>;
  WAREHOUSE_IDS.forEach((w, i) => {
    cubes[w] = (value >> (WAREHOUSE_IDS.length - 1 - i)) & 1 ? 'green' : 'red';
  });
  return { cubes };
}

/** All 14 arrangements, in number order (for "test on every arrangement"). */
export function allScenarios(): WarehouseSortScenario[] {
  return Array.from({ length: SCENARIO_COUNT }, (_, i) => scenarioFromIndex(i));
}

/**
 * The arrangement a new visitor sees first: a mix with two cubes of each colour, one of each in
 * every row and in every column - "RG-GR". (The rules give no default arrangement.)
 */
export function defaultScenario(): WarehouseSortScenario {
  return { cubes: { W1: 'red', W2: 'green', W3: 'green', W4: 'red' } };
}

/** Each of the 14 arrangements is equally likely. The same `rng` sequence gives the same arrangement. */
export function randomScenario(rng: () => number): WarehouseSortScenario {
  return scenarioFromIndex(Math.floor(rng() * SCENARIO_COUNT) % SCENARIO_COUNT);
}

/** Short code of an arrangement: "RG-GR" (W1 W2, then W3 W4 - as the cubes lie on the mat). */
export function encodeScenario(s: WarehouseSortScenario): string {
  const letters = WAREHOUSE_IDS.map((w) => LETTER[s.cubes[w]] ?? '?').join('');
  return `${letters.slice(0, 2)}-${letters.slice(2)}`;
}

/**
 * The letters and digits of a typed code, in capitals: "rg-gr" -> "RGGR". Wide letters, as a
 * keyboard for Chinese or Japanese types them ("ＲＧ－ＧＲ"), are read as the usual ones (NFKC).
 */
export function compactCode(code: string): string {
  return code.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * What a code says, also when the arrangement cannot be played ("RR-RR"): letter case, spaces
 * and dashes do not matter. Null for a text that is no code at all - it never throws.
 * (For an editor that is being changed. A match is played with decodeScenario() below.)
 */
export function scenarioOfCode(code: string): WarehouseSortScenario | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  const compact = compactCode(code);
  if (!/^[RG]{4}$/.test(compact)) return null;
  const cubes = {} as Record<WarehouseId, CubeColor>;
  WAREHOUSE_IDS.forEach((w, i) => {
    cubes[w] = FROM_LETTER[compact[i]];
  });
  return { cubes };
}

/**
 * Read a code back: "RG-GR", "rggr", "R G G R". Null for anything else, and for "RR-RR" and
 * "GG-GG" (the rules want both colours). Never throws.
 *
 * Unlike Fire Rescue, a number is no code here: the test window numbers its rows 1, 2, 3 ...,
 * and a student who typed a row number would get another arrangement than that row's.
 */
export function decodeScenario(code: string): WarehouseSortScenario | null {
  if (typeof code !== 'string') return null;
  const s = scenarioOfCode(code.trim());
  return s !== null && isValidScenario(s) ? s : null;
}

/** One line for people: "Red: W1, W4. Green: W2, W3." */
export function describeScenario(s: WarehouseSortScenario): string {
  const problems = scenarioProblems(s);
  if (problems.length > 0) return `This arrangement cannot be played. ${problems.join(' ')}`;
  const where = (color: CubeColor) => WAREHOUSE_IDS.filter((w) => s.cubes[w] === color).join(', ');
  return `Red: ${where('red')}. Green: ${where('green')}.`;
}

/** The same arrangement with one cube changed (for an editor; the result may be invalid). */
export function withCube(s: WarehouseSortScenario, warehouse: WarehouseId, color: CubeColor): WarehouseSortScenario {
  return { cubes: { ...s.cubes, [warehouse]: color } };
}
