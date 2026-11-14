/**
 * How hard a Fire Chief maze is, in words a student understands - for the maze editor.
 *
 * The simulator cannot know how hard a maze is for one particular program. What it can count:
 *   - the inner walls,
 *   - the shortest way from START into the room of the fire: its cells and its turns,
 *   - the dead ends,
 *   - whether there is only one way.
 * The level (1 to 5) is made from the number of walls, in the same bands as the game's own
 * named mazes (../../fire-chief/scenario.ts: NAMED_MAZES, 0 / 4 / 10 / 13 / 16 walls are its
 * levels 1 to 5), and goes up by one when the shortest way to the fire is long. The sentence
 * names what was counted, so nobody has to believe the level without seeing why.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { CELL_COUNT, CELL_SIZE, GRID_CELLS, ROOMS, ROOM_IDS, START_CELL, cellFromNumber, cellNumber, type Cell } from '../../fire-chief/field';
import { PERFECT_MAZE_WALLS, stepsFrom, wallBetweenCells, wallCount, type FireChiefScenario } from '../../fire-chief/scenario';

export interface MazeFacts {
  /** inner walls that stand */
  walls: number;
  /** cells to drive on the shortest way from START into the room of the fire; -1 = there is no way */
  way: number;
  /**
   * quarter turns on that way - the fewest of all shortest ways - counted from the direction
   * the robot faces at the default start (up the mat). 0 when there is no way.
   */
  turns: number;
  /** cells with one open side that the robot can drive into (START and the two rooms are not counted) */
  deadEnds: number;
  /** cells that cannot be reached from START at all */
  closedCells: number;
  /** from START there is exactly one way to every cell that can be reached (no ring to drive round) */
  oneWayOnly: boolean;
  /** both rooms can be reached from START */
  bothRooms: boolean;
}

/** The four directions a robot can leave a cell in: up, right, down, left (as cell steps). */
const STEPS: ReadonlyArray<{ col: number; row: number }> = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

const onField = (cell: Cell): boolean => cell.col >= 0 && cell.col < GRID_CELLS && cell.row >= 0 && cell.row < GRID_CELLS;

/**
 * The fewest quarter turns of a shortest way from START (facing up the mat) to `goal`, or 0
 * when there is no way. Every "cell and the direction the robot faces in it" gets the cost
 * (cells driven, turns made) of the best way to it; cells count first, turns second.
 */
function fewestTurns(walls: readonly boolean[], goal: Cell): number {
  const TURN = 1;
  const CELL = 1000; // (one cell more always costs more than any number of turns)
  const cost = new Array<number>(CELL_COUNT * 4).fill(Infinity);
  const start = cellNumber(START_CELL) * 4; // direction 0 = up
  cost[start] = 0;
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    const here = cellFromNumber(Math.floor(state / 4));
    const facing = state % 4;
    for (let dir = 0; dir < 4; dir++) {
      const next: Cell = { col: here.col + STEPS[dir].col, row: here.row + STEPS[dir].row };
      if (!onField(next) || wallBetweenCells(walls, here, next)) continue;
      const turned = Math.min((dir - facing + 4) % 4, (facing - dir + 4) % 4);
      const to = cellNumber(next) * 4 + dir;
      const value = cost[state] + CELL + turned * TURN;
      if (value < cost[to]) {
        cost[to] = value;
        queue.push(to);
      }
    }
  }
  const at = cellNumber(goal) * 4;
  const best = Math.min(cost[at], cost[at + 1], cost[at + 2], cost[at + 3]);
  return Number.isFinite(best) ? best % CELL : 0;
}

/** Everything the editor counts about a maze. */
export function mazeFacts(s: FireChiefScenario): MazeFacts {
  const steps = stepsFrom(s.walls, START_CELL);
  const special = new Set<number>([cellNumber(START_CELL), ...ROOM_IDS.map((id) => cellNumber(ROOMS[id].cell))]);
  let cells = 0;
  let openSides = 0;
  let deadEnds = 0;
  for (let n = 0; n < CELL_COUNT; n++) {
    if (steps[n] < 0) continue;
    cells++;
    const here = cellFromNumber(n);
    let open = 0;
    for (const step of STEPS) {
      const next: Cell = { col: here.col + step.col, row: here.row + step.row };
      if (onField(next) && !wallBetweenCells(s.walls, here, next)) open++;
    }
    openSides += open;
    if (open === 1 && !special.has(n)) deadEnds++;
  }
  const fireCell = ROOMS[s.fireRoom]?.cell;
  const way = fireCell ? steps[cellNumber(fireCell)] : -1;
  return {
    walls: wallCount(s),
    way,
    turns: fireCell && way >= 0 ? fewestTurns(s.walls, fireCell) : 0,
    deadEnds,
    closedCells: CELL_COUNT - cells,
    // (every open side was counted from both of its cells; a maze without a ring has one open side less than cells)
    oneWayOnly: openSides / 2 === cells - 1,
    bothRooms: ROOM_IDS.every((id) => steps[cellNumber(ROOMS[id].cell)] >= 0),
  };
}

export type MazeLevel = 1 | 2 | 3 | 4 | 5;
export const HARDEST_LEVEL: MazeLevel = 5;

/** The most walls a maze of level 1, 2, 3 and 4 has; with more it is level 5. */
export const LEVEL_WALLS: readonly [number, number, number, number] = [0, 6, 11, PERFECT_MAZE_WALLS - 1];
/** A shortest way of this many cells or more makes the maze one level harder (the nearest a room can be is 6 cells). */
export const LONG_WAY_CELLS = 10;

export const LEVEL_WORD: Record<MazeLevel, string> = {
  1: 'very easy',
  2: 'easy',
  3: 'medium',
  4: 'hard',
  5: 'very hard',
};

/** The level of a maze, or null when the fire cannot be reached at all (then there is nothing to rate). */
export function mazeLevel(facts: MazeFacts): MazeLevel | null {
  if (facts.way < 0) return null;
  let level = 1 + LEVEL_WALLS.filter((most) => facts.walls > most).length;
  if (facts.way >= LONG_WAY_CELLS) level++;
  return Math.min(HARDEST_LEVEL, level) as MazeLevel;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "Level 3 of 5: medium", or what to say when there is no level. */
export function levelTitle(facts: MazeFacts): string {
  const level = mazeLevel(facts);
  return level === null ? 'No level' : `Level ${level} of ${HARDEST_LEVEL}: ${LEVEL_WORD[level]}`;
}

/**
 * What was counted, as short sentences: the walls, the shortest way to the fire, the dead ends.
 * (A cell is 30 cm, so the way is given in cells and in metres.)
 */
export function levelFacts(facts: MazeFacts): string {
  const parts: string[] = [facts.walls === 0 ? 'No inner walls.' : `${count(facts.walls, 'inner wall', 'inner walls')}.`];
  if (facts.way < 0) {
    parts.push('There is no way from START into the room of the fire.');
  } else {
    const metres = ((facts.way * CELL_SIZE) / 1000).toFixed(1);
    parts.push(
      `The shortest way from START into the room of the fire is ${count(facts.way, 'cell', 'cells')} long (${metres} m) ` +
        `with ${count(facts.turns, 'turn', 'turns')}.`,
    );
  }
  if (facts.deadEnds > 0) parts.push(`${count(facts.deadEnds, 'dead end', 'dead ends')}.`);
  if (facts.closedCells > 0) parts.push(`${count(facts.closedCells, 'cell is', 'cells are')} closed off.`);
  if (facts.walls > 0 && facts.oneWayOnly && facts.bothRooms) parts.push('There is only one way to each room.');
  return parts.join(' ');
}

/** What the level is, and is not: it is counted, not measured with a program. */
export const LEVEL_NOTE =
  'The level is counted from the number of walls and the length of the way. For your program another maze can be harder.';
