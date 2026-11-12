/**
 * A Fire Chief "combination": the maze of one round and where the fire is.
 *
 *  - which of the 40 inner walls stand (field.ts: WALL_POSITIONS)
 *  - the room of the fire target: living room or bedroom
 *  - the spot of the target in that room: corner, back or side
 *
 * A combination can be played ("is valid") when there is a way from START to the living room
 * AND to the bedroom (rules §3: "every competition layout must provide a navigable route from
 * START to both rooms"). Other cells may be closed off.
 *
 * Mazes are written in this file as small drawings, so that they can be read and changed:
 *
 *     +---+---+---+---+---+      + is a corner post, always there
 *     | L         |     B |      | between two cells = a wall; a space = no wall
 *     +---+   +---+   +---+      --- under a cell   = a wall; spaces  = no wall
 *     ...                        letters inside a cell are only there for the reader
 */
import {
  CELL_COUNT,
  FIRE_SPOTS,
  GRID_CELLS,
  INNER_WALL_COUNT,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  WALL_POSITIONS,
  cellFromNumber,
  cellNumber,
  neighbours,
  wallIndexBetween,
  type Cell,
  type FireSpot,
  type RoomId,
} from './field';

export interface FireChiefScenario {
  /** one entry per place of WALL_POSITIONS (40): true = a wall stands there */
  walls: boolean[];
  /** the room with the fire target */
  fireRoom: RoomId;
  /** where in that room the target stands */
  fireSpot: FireSpot;
}

// =============================================================================================
// Ways through the maze
// =============================================================================================

const noWalls = (): boolean[] => new Array<boolean>(INNER_WALL_COUNT).fill(false);

const isRoomId = (v: unknown): v is RoomId => v === 'living' || v === 'bedroom';
const isFireSpot = (v: unknown): v is FireSpot => v === 'corner' || v === 'back' || v === 'side';

/** True when the list has exactly one true / false entry per wall place. */
function isWallList(walls: unknown): walls is boolean[] {
  return Array.isArray(walls) && walls.length === INNER_WALL_COUNT && walls.every((w) => typeof w === 'boolean');
}

/** Is there a wall between these two neighbouring cells? (Cells that are not neighbours: true.) */
export function wallBetweenCells(walls: readonly boolean[], a: Cell, b: Cell): boolean {
  const index = wallIndexBetween(a, b);
  return index < 0 || walls[index] === true;
}

/**
 * How many cell-to-cell steps the shortest way from `from` needs to reach every cell
 * (entry = cellNumber); -1 for a cell that cannot be reached.
 */
export function stepsFrom(walls: readonly boolean[], from: Cell): number[] {
  const steps = new Array<number>(CELL_COUNT).fill(-1);
  const queue: number[] = [cellNumber(from)];
  steps[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const here = cellFromNumber(queue[head]);
    for (const next of neighbours(here)) {
      const n = cellNumber(next);
      if (steps[n] >= 0 || wallBetweenCells(walls, here, next)) continue;
      steps[n] = steps[queue[head]] + 1;
      queue.push(n);
    }
  }
  return steps;
}

/** Steps of the shortest way from START to a room, or -1 when there is no way. */
export function stepsToRoom(s: FireChiefScenario, room: RoomId): number {
  return stepsFrom(s.walls, START_CELL)[cellNumber(ROOMS[room].cell)];
}

/**
 * The cells of the shortest way from one cell to another (both included), or null when there is
 * no way. Of several shortest ways it takes the first in the order up, right, down, left.
 */
export function shortestWay(walls: readonly boolean[], from: Cell, to: Cell): Cell[] | null {
  // walk back from the goal along falling step counts
  const steps = stepsFrom(walls, from);
  let at = cellNumber(to);
  if (steps[at] < 0) return null;
  const way: Cell[] = [cellFromNumber(at)];
  while (steps[at] > 0) {
    const here = cellFromNumber(at);
    const back = neighbours(here).find(
      (n) => steps[cellNumber(n)] === steps[at] - 1 && !wallBetweenCells(walls, here, n),
    );
    if (!back) return null; // (cannot happen: every reached cell was reached from a neighbour)
    at = cellNumber(back);
    way.unshift(back);
  }
  return way;
}

export function wallCount(s: FireChiefScenario): number {
  let n = 0;
  for (const w of s.walls) if (w) n++;
  return n;
}

/**
 * What is wrong with a combination, one sentence per problem; an empty list means it can be
 * played. (A maze that is being built in the editor may be wrong for a while.)
 */
export function scenarioProblems(s: FireChiefScenario): string[] {
  const out: string[] = [];
  if (!s || !isWallList(s.walls)) {
    return [`A maze needs exactly ${INNER_WALL_COUNT} wall places (wall or no wall).`];
  }
  if (!isRoomId(s.fireRoom)) out.push('The fire must be in the living room or in the bedroom.');
  if (!isFireSpot(s.fireSpot)) out.push('The fire must stand at one of the three spots: corner, back or side.');
  const steps = stepsFrom(s.walls, START_CELL);
  for (const id of ROOM_IDS) {
    if (steps[cellNumber(ROOMS[id].cell)] < 0) {
      out.push(`There is no way from START to the ${ROOMS[id].name}: take a wall away.`);
    }
  }
  return out;
}

export function isValidScenario(s: FireChiefScenario): boolean {
  return scenarioProblems(s).length === 0;
}

// =============================================================================================
// Drawings
// =============================================================================================

const DRAWING_ROWS = 2 * GRID_CELLS + 1;
const DRAWING_WIDTH = 4 * GRID_CELLS + 1;

/**
 * Read the walls from a drawing (see the top of this file): 11 lines of 21 characters.
 * Shorter lines count as filled up with spaces. The outer frame is not looked at.
 */
export function wallsFromDrawing(drawing: readonly string[]): boolean[] {
  if (drawing.length !== DRAWING_ROWS) {
    throw new Error(`a maze drawing has ${DRAWING_ROWS} lines, this one has ${drawing.length}`);
  }
  const walls = noWalls();
  for (const position of WALL_POSITIONS) {
    const [a] = position.between;
    if (position.direction === 'upright') {
      // the character between cell a and the cell on its right
      walls[position.index] = drawing[2 * a.row + 1].charAt(4 * (a.col + 1)) === '|';
    } else {
      // the three characters under cell a
      walls[position.index] = drawing[2 * a.row + 2].slice(4 * a.col + 1, 4 * a.col + 4) === '---';
    }
  }
  return walls;
}

/** Draw a combination: its walls, S for START, L and B for the two rooms, * for the fire. */
export function drawScenario(s: FireChiefScenario): string[] {
  const lines: string[] = [];
  const frame = `+${'---+'.repeat(GRID_CELLS)}`;
  lines.push(frame);
  for (let row = 0; row < GRID_CELLS; row++) {
    let cells = '|';
    let under = '+';
    for (let col = 0; col < GRID_CELLS; col++) {
      const cell: Cell = { col, row };
      let mark = ' ';
      if (cellNumber(cell) === cellNumber(START_CELL)) mark = 'S';
      for (const id of ROOM_IDS) {
        if (cellNumber(cell) === cellNumber(ROOMS[id].cell)) mark = s.fireRoom === id ? '*' : id === 'living' ? 'L' : 'B';
      }
      const right = col === GRID_CELLS - 1 || wallBetweenCells(s.walls, cell, { col: col + 1, row });
      const below = row === GRID_CELLS - 1 || wallBetweenCells(s.walls, cell, { col, row: row + 1 });
      cells += ` ${mark} ${right ? '|' : ' '}`;
      under += `${below ? '---' : '   '}+`;
    }
    lines.push(cells, under);
  }
  return lines;
}

// =============================================================================================
// Named mazes
// =============================================================================================

/** The open field: no inner wall at all. */
export function openField(fireRoom: RoomId = 'living', fireSpot: FireSpot = 'back'): FireChiefScenario {
  return { walls: noWalls(), fireRoom, fireSpot };
}

function maze(fireRoom: RoomId, fireSpot: FireSpot, drawing: string[]): FireChiefScenario {
  const s: FireChiefScenario = { walls: wallsFromDrawing(drawing), fireRoom, fireSpot };
  const problems = scenarioProblems(s);
  if (problems.length > 0) throw new Error(`a maze of scenario.ts cannot be played: ${problems.join(' ')}`);
  return s;
}

export interface NamedMaze {
  id: string;
  name: string;
  /** 1 (easiest) .. 5 (hardest) */
  level: number;
  /** one sentence for the person who picks it */
  about: string;
  scenario: FireChiefScenario;
}

/** A few hand-made mazes, from easy to hard. Every one of them can be played. */
export const NAMED_MAZES: NamedMaze[] = [
  {
    id: 'open',
    name: 'Open field',
    level: 1,
    about: 'No inner walls. Good for a first drive and for testing the flame sensor and the fan.',
    scenario: openField('living', 'back'),
  },
  {
    id: 'two-doors',
    name: 'Two doors',
    level: 2,
    about: 'Four walls. START opens only upwards and each room has one door.',
    scenario: maze('bedroom', 'back', [
      '+---+---+---+---+---+',
      '| L |           | B |',
      '+   +   +   +   +   +',
      '|                   |',
      '+   +   +   +   +   +',
      '|                   |',
      '+   +   +   +   +   +',
      '|                   |',
      '+   +   +   +   +   +',
      '|       | S |       |',
      '+---+---+---+---+---+',
    ]),
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    level: 3,
    about: 'Ten walls. A bar in the middle: go round it on the left or on the right. Two dead ends.',
    scenario: maze('living', 'corner', [
      '+---+---+---+---+---+',
      '| L         |     B |',
      '+---+   +---+   +---+',
      '|               |   |',
      '+   +   +   +   +   +',
      '|                   |',
      '+   +---+---+---+   +',
      '|                   |',
      '+   +   +   +   +   +',
      '|       | S |       |',
      '+---+---+---+---+---+',
    ]),
  },
  {
    id: 'detour',
    name: 'Detour',
    level: 4,
    about: 'Thirteen walls. Narrow corridors, two ways to the bedroom and a big dead end.',
    scenario: maze('bedroom', 'side', [
      '+---+---+---+---+---+',
      '| L |             B |',
      '+   +   +---+---+   +',
      '|   |       |       |',
      '+   +---+   +   +---+',
      '|           |       |',
      '+---+---+   +---+   +',
      '|                   |',
      '+   +   +   +   +   +',
      '|       | S |       |',
      '+---+---+---+---+---+',
    ]),
  },
  {
    id: 'one-way',
    name: 'One way only',
    level: 5,
    about: 'Sixteen walls: a perfect maze. There is exactly one way to each room.',
    scenario: maze('bedroom', 'corner', [
      '+---+---+---+---+---+',
      '| L     |         B |',
      '+   +---+   +---+   +',
      '|       |   |   |   |',
      '+---+   +   +   +---+',
      '|       |       |   |',
      '+   +---+---+   +   +',
      '|                   |',
      '+   +---+   +---+   +',
      '|       | S |       |',
      '+---+---+---+---+---+',
    ]),
  },
];

const copyOf = (s: FireChiefScenario): FireChiefScenario => ({
  walls: [...s.walls],
  fireRoom: s.fireRoom,
  fireSpot: s.fireSpot,
});

/** A fresh copy of a named maze (so that an editor can change it), or null for an unknown id. */
export function namedMaze(id: string): FireChiefScenario | null {
  const found = NAMED_MAZES.find((m) => m.id === id);
  return found ? copyOf(found.scenario) : null;
}

/** The maze a new visitor sees first: "Crossroads" (medium), fire in the corner of the living room. */
export function defaultScenario(): FireChiefScenario {
  return namedMaze('crossroads') ?? openField('living', 'corner');
}

// =============================================================================================
// Random mazes
// =============================================================================================

/** A "perfect" maze of 25 cells has exactly this many walls: every cell can be reached, in one way only. */
export const PERFECT_MAZE_WALLS = INNER_WALL_COUNT - (CELL_COUNT - 1);
/** The random generator never leaves fewer walls than this: below that it is hardly a maze. */
export const RANDOM_MIN_WALLS = 4;

/**
 * A random perfect maze: all 40 walls are put up, then a walk through the field knocks one down
 * every time it steps into a cell it has not visited yet ("depth-first"). That leaves long,
 * winding corridors with exactly one way between any two cells.
 */
export function perfectMazeWalls(rng: () => number): boolean[] {
  const walls = new Array<boolean>(INNER_WALL_COUNT).fill(true);
  const visited = new Array<boolean>(CELL_COUNT).fill(false);
  const first = cellFromNumber(Math.floor(rng() * CELL_COUNT) % CELL_COUNT);
  const trail: Cell[] = [first];
  visited[cellNumber(first)] = true;
  while (trail.length > 0) {
    const here = trail[trail.length - 1];
    const fresh = neighbours(here).filter((n) => !visited[cellNumber(n)]);
    if (fresh.length === 0) {
      trail.pop(); // dead end: walk back
      continue;
    }
    const next = fresh[Math.floor(rng() * fresh.length) % fresh.length];
    walls[wallIndexBetween(here, next)] = false;
    visited[cellNumber(next)] = true;
    trail.push(next);
  }
  return walls;
}

/**
 * A random combination that can always be played, of mixed difficulty: a perfect maze (16
 * walls, one way only) from which a random number of walls is taken away again - down to
 * RANDOM_MIN_WALLS. Every number of walls from 4 to 16 is equally likely. The same `rng`
 * sequence always gives the same combination.
 */
export function randomScenario(rng: () => number): FireChiefScenario {
  const walls = perfectMazeWalls(rng);
  const span = PERFECT_MAZE_WALLS - RANDOM_MIN_WALLS + 1;
  const keep = RANDOM_MIN_WALLS + (Math.floor(rng() * span) % span);
  const standing: number[] = [];
  walls.forEach((w, i) => {
    if (w) standing.push(i);
  });
  // (taking walls away can only open more ways: the maze stays playable)
  while (standing.length > keep) {
    const pick = Math.floor(rng() * standing.length) % standing.length;
    walls[standing[pick]] = false;
    standing.splice(pick, 1);
  }
  const fireRoom = ROOM_IDS[Math.floor(rng() * ROOM_IDS.length) % ROOM_IDS.length];
  const fireSpot = FIRE_SPOTS[Math.floor(rng() * FIRE_SPOTS.length) % FIRE_SPOTS.length];
  return { walls, fireRoom, fireSpot };
}

/**
 * How many mazes can be played. Each of the 40 walls can stand or not: 2^40 (about 1100
 * billion) arrangements, and about one in ten of them leaves a way from START to both rooms.
 * The exact number was counted once by a program (cell by cell, remembering which cells are
 * connected); scenario.test.ts checks it against a random sample.
 */
export const PLAYABLE_MAZE_COUNT = 111_989_110_743;
/** How many different combinations there are: every playable maze with the fire at each of its 6 places. */
export const SCENARIO_COUNT = PLAYABLE_MAZE_COUNT * ROOM_IDS.length * FIRE_SPOTS.length;

// =============================================================================================
// The short code
// =============================================================================================
// "LC-4406-N0E0": the room of the fire (L = living room, B = bedroom), its spot (C = corner,
// B = back, S = side), then eight characters for the 40 walls. Every character stands for five
// walls (16 + 8 + 4 + 2 + 1); the first four characters are the walls between cells side by
// side, the last four the walls between a cell and the cell below it.

/** 32 characters that are hard to mix up: no I, L, O and U. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const WALLS_PER_CHARACTER = 5;
const WALL_CHARACTERS = INNER_WALL_COUNT / WALLS_PER_CHARACTER;

const ROOM_LETTER: Record<RoomId, string> = { living: 'L', bedroom: 'B' };
const SPOT_LETTER: Record<FireSpot, string> = { corner: 'C', back: 'B', side: 'S' };

/** Short code of a combination, e.g. "LC-4406-N0E0" (the default maze). */
export function encodeScenario(s: FireChiefScenario): string {
  let code = '';
  for (let k = 0; k < WALL_CHARACTERS; k++) {
    let value = 0;
    for (let bit = 0; bit < WALLS_PER_CHARACTER; bit++) {
      value = value * 2 + (s.walls[k * WALLS_PER_CHARACTER + bit] === true ? 1 : 0);
    }
    code += CODE_ALPHABET[value];
  }
  const half = WALL_CHARACTERS / 2;
  return `${ROOM_LETTER[s.fireRoom] ?? 'L'}${SPOT_LETTER[s.fireSpot] ?? 'C'}-${code.slice(0, half)}-${code.slice(half)}`;
}

/**
 * Read a code back. Letter case, spaces and separators do not matter, and the letters that are
 * easy to mix up are understood (O as 0, I and L as 1). Returns null for anything that is not
 * the code of a combination that can be played - it never throws.
 */
export function decodeScenario(code: string): FireChiefScenario | null {
  if (typeof code !== 'string' || code.length > 200) return null;
  const compact = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length !== 2 + WALL_CHARACTERS) return null;
  const fireRoom = ROOM_IDS.find((id) => ROOM_LETTER[id] === compact[0]);
  const fireSpot = FIRE_SPOTS.find((spot) => SPOT_LETTER[spot] === compact[1]);
  if (!fireRoom || !fireSpot) return null;
  const walls = noWalls();
  for (let k = 0; k < WALL_CHARACTERS; k++) {
    let ch = compact[2 + k];
    if (ch === 'O') ch = '0';
    else if (ch === 'I' || ch === 'L') ch = '1';
    const value = CODE_ALPHABET.indexOf(ch);
    if (value < 0) return null;
    for (let bit = 0; bit < WALLS_PER_CHARACTER; bit++) {
      walls[k * WALLS_PER_CHARACTER + bit] = ((value >> (WALLS_PER_CHARACTER - 1 - bit)) & 1) === 1;
    }
  }
  const s: FireChiefScenario = { walls, fireRoom, fireSpot };
  return isValidScenario(s) ? s : null;
}

/** One line for people: where the fire is, how many walls, how far it is. */
export function describeScenario(s: FireChiefScenario): string {
  const problems = scenarioProblems(s);
  if (problems.length > 0) return `This maze cannot be played. ${problems.join(' ')}`;
  const count = wallCount(s);
  const steps = stepsToRoom(s, s.fireRoom);
  return (
    `Fire in the ${ROOMS[s.fireRoom].name} (${s.fireSpot}). ` +
    `${count === 0 ? 'No inner walls' : `${count} inner wall${count === 1 ? '' : 's'}`}. ` +
    `Shortest way from START to the fire: ${steps} cell${steps === 1 ? '' : 's'}.`
  );
}

// =============================================================================================
// For editors: change one thing, get a new combination
// =============================================================================================

/** Put up (or take away) the wall at place `index` (0..39). */
export function withWall(s: FireChiefScenario, index: number, standing: boolean): FireChiefScenario {
  const next = copyOf(s);
  if (Number.isInteger(index) && index >= 0 && index < INNER_WALL_COUNT) next.walls[index] = standing;
  return next;
}

/** Put the wall at place `index` up if it is not there, take it away if it is. */
export function toggleWall(s: FireChiefScenario, index: number): FireChiefScenario {
  return withWall(s, index, s.walls[index] !== true);
}

/** Move the fire to another room and / or spot. */
export function withFire(s: FireChiefScenario, fireRoom: RoomId, fireSpot: FireSpot = s.fireSpot): FireChiefScenario {
  return { walls: [...s.walls], fireRoom, fireSpot };
}
