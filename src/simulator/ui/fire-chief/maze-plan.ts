/**
 * The plan of the Fire Chief maze editor (MazeEditor.tsx), as numbers and words: where each of
 * the 40 wall places lies on the plan, which part of the plan answers to a click or a finger for
 * it, what a screen reader calls it, where the arrow keys go from it, and where the fire is
 * drawn.
 *
 * Nothing here knows a wall place by itself: every one comes from the game's own list
 * (../../fire-chief/field.ts: WALL_POSITIONS), with the game's index and the game's label. So
 * the wall a student switches on the plan is the wall the engine puts on the stage.
 *
 * The plan is drawn in "plan units": one cell is 100 units, the field is 500 x 500 units, with
 * its top left corner at (0, 0) - the mat seen from above, like the stage.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import {
  CELL_SIZE,
  FIELD_SIZE,
  GRID_CELLS,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  TARGET_DEPTH,
  TARGET_WIDTH,
  WALL_POSITIONS,
  cellFromNumber,
  cellName,
  cellNumber,
  targetPose,
  type Cell,
  type FireSpot,
  type RoomId,
  type WallPosition,
} from '../../fire-chief/field';
import { stepsFrom } from '../../fire-chief/scenario';

// =============================================================================================
// The size of the plan
// =============================================================================================

/** One cell of the plan, in plan units. */
export const PLAN_CELL = 100;
/** The field on the plan: 500 x 500 units. */
export const PLAN_SIZE = GRID_CELLS * PLAN_CELL;
const UNITS_PER_MM = PLAN_SIZE / FIELD_SIZE;

/**
 * The whole drawing: the field, with room on the left and at the top for the names of the
 * columns (A to E) and of the rows (1 to 5), and a little room on the right and at the bottom
 * for the wall around the field. It is a square, like the box it is drawn in.
 */
export const PLAN_BOX = { x: -34, y: -34, w: PLAN_SIZE + 42, h: PLAN_SIZE + 42 } as const;

/** A length of the mat (mm) in plan units. */
export const planUnits = (mm: number): number => mm * UNITS_PER_MM;

/** Where a point of the plan lies in its box, in percent from the left / from the top (for CSS). */
export const percentAcross = (x: number): number => ((x - PLAN_BOX.x) / PLAN_BOX.w) * 100;
export const percentDown = (y: number): number => ((y - PLAN_BOX.y) / PLAN_BOX.h) * 100;

// =============================================================================================
// The wall places
// =============================================================================================

/**
 * How far to each side of a wall place a click or a finger still means that place, as a share
 * of a cell. The area is the band of this half-width along the place, cut off where a
 * neighbouring place is nearer (see hitContains). 0.36 leaves a small square in the middle of
 * every cell that belongs to no wall - a tap on "START" or on a room switches nothing - and
 * makes the area 72 units wide: 38 px on a phone that is 360 px wide.
 */
export const WALL_HIT_HALF = 0.36;

export interface PlanWall {
  /** the game's number of this wall place (0..39): the entry of FireChiefScenario.walls */
  index: number;
  /** the game's short name, e.g. 'A1-B1' */
  label: string;
  /** what a screen reader says: "Wall between A1 and B1" */
  name: string;
  direction: WallPosition['direction'];
  /** the middle of the place, in plan units */
  x: number;
  y: number;
  /** its two ends (the corner posts), in plan units */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** the box of its button, in percent of the plan's box (the button is cut to shape by HIT_SHAPE) */
  box: { left: number; top: number; width: number; height: number };
}

/** What a screen reader calls a wall place: the two cells it stands between. */
export function wallName(position: Pick<WallPosition, 'between'>): string {
  return `Wall between ${cellName(position.between[0])} and ${cellName(position.between[1])}`;
}

function planWall(position: WallPosition): PlanWall {
  const x = planUnits(position.x);
  const y = planUnits(position.y);
  const upright = position.direction === 'upright';
  const half = PLAN_CELL / 2;
  // the button: as long as the place, and WALL_HIT_HALF of a cell to each side of it
  const across = 2 * WALL_HIT_HALF * PLAN_CELL;
  const w = upright ? across : PLAN_CELL;
  const h = upright ? PLAN_CELL : across;
  return {
    index: position.index,
    label: position.label,
    name: wallName(position),
    direction: position.direction,
    x,
    y,
    from: upright ? { x, y: y - half } : { x: x - half, y },
    to: upright ? { x, y: y + half } : { x: x + half, y },
    box: {
      left: percentAcross(x - w / 2),
      top: percentDown(y - h / 2),
      width: (w / PLAN_BOX.w) * 100,
      height: (h / PLAN_BOX.h) * 100,
    },
  };
}

/**
 * The lines of the plan, from top to bottom: the four places between the cells of row 1, then
 * the five places under row 1, then the four places of row 2 ... Nine lines, each from left to
 * right. This is the order a screen reader meets the walls in, and the lines the arrow keys
 * move along (movePlanFocus).
 */
export const PLAN_LINES: PlanWall[][] = (() => {
  const byHeight = new Map<number, PlanWall[]>();
  for (const position of WALL_POSITIONS) {
    const wall = planWall(position);
    const line = byHeight.get(wall.y);
    if (line) line.push(wall);
    else byHeight.set(wall.y, [wall]);
  }
  return [...byHeight.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line.sort((a, b) => a.x - b.x));
})();

/** All 40 wall places of the plan, line by line (see PLAN_LINES). */
export const PLAN_WALLS: PlanWall[] = PLAN_LINES.flat();

/** The wall place of the plan with the game's number `index`, or undefined. */
export function planWallOf(index: number): PlanWall | undefined {
  return PLAN_WALLS.find((wall) => wall.index === index);
}

/**
 * The shape of a wall's button inside its box, for CSS `clip-path`: six corners. The two
 * pointed ends are the corner posts; the slanted edges are the lines on which the neighbouring
 * wall place is exactly as near.
 */
export function hitShape(direction: WallPosition['direction']): string {
  const near = WALL_HIT_HALF * 100;
  const far = 100 - near;
  return direction === 'upright'
    ? `polygon(50% 0%, 100% ${near}%, 100% ${far}%, 50% 100%, 0% ${far}%, 0% ${near}%)`
    : `polygon(0% 50%, ${near}% 0%, ${far}% 0%, 100% 50%, ${far}% 100%, ${near}% 100%)`;
}

/** The same shape as six points of the plan (for the drawing of the wall that has the keyboard focus). */
export function hitOutline(wall: PlanWall): string {
  const a = WALL_HIT_HALF * PLAN_CELL;
  const b = PLAN_CELL / 2 - a;
  const corners =
    wall.direction === 'upright'
      ? [
          [0, -PLAN_CELL / 2],
          [a, -b],
          [a, b],
          [0, PLAN_CELL / 2],
          [-a, b],
          [-a, -b],
        ]
      : [
          [-PLAN_CELL / 2, 0],
          [-b, -a],
          [b, -a],
          [PLAN_CELL / 2, 0],
          [b, a],
          [-b, a],
        ];
  return corners.map(([dx, dy]) => `${wall.x + dx},${wall.y + dy}`).join(' ');
}

/**
 * Does a click at (x, y), in plan units, mean this wall place? It does when the point is nearer
 * to this place than to any other (|along| + |across| is at most half a cell) and not further
 * than WALL_HIT_HALF of a cell to the side of it. This is what hitShape() cuts out in CSS; the
 * tests check that no point of the plan means two walls.
 */
export function hitContains(wall: PlanWall, x: number, y: number): boolean {
  const dx = Math.abs(x - wall.x);
  const dy = Math.abs(y - wall.y);
  const across = wall.direction === 'upright' ? dx : dy;
  return dx + dy <= PLAN_CELL / 2 && across <= WALL_HIT_HALF * PLAN_CELL;
}

// =============================================================================================
// The arrow keys
// =============================================================================================

export type PlanKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function isPlanKey(key: string): key is PlanKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End';
}

/**
 * Where a key takes the keyboard focus from the wall place `index`, like the cursor in a text
 * of nine lines:
 *   left / right   the next place in the same line (at the end of a line: stay)
 *   up / down      the line above / below, at the place nearest to `column`
 *   Home / End     the first / last place of the line
 * `column` is where the cursor "wants to be" (plan units from the left): left and right set it,
 * up and down keep it, so that down and up again ends on the place it started from. Pass the x
 * of the wall when there is none yet.
 */
export function movePlanFocus(index: number, key: PlanKey, column?: number): { index: number; column: number } {
  const lineNumber = PLAN_LINES.findIndex((line) => line.some((wall) => wall.index === index));
  if (lineNumber < 0) return { index, column: column ?? 0 };
  const line = PLAN_LINES[lineNumber];
  const at = line.findIndex((wall) => wall.index === index);
  const want = column ?? line[at].x;

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const next = PLAN_LINES[lineNumber + (key === 'ArrowUp' ? -1 : 1)];
    if (!next) return { index, column: want };
    // the place of that line nearest to the wanted column (of two equally near ones: the left one)
    let best = next[0];
    for (const wall of next) if (Math.abs(wall.x - want) < Math.abs(best.x - want) - 1e-9) best = wall;
    return { index: best.index, column: want };
  }
  const to = key === 'Home' ? 0 : key === 'End' ? line.length - 1 : Math.max(0, Math.min(line.length - 1, at + (key === 'ArrowLeft' ? -1 : 1)));
  return { index: line[to].index, column: line[to].x };
}

// =============================================================================================
// The cells, and the fire
// =============================================================================================

export interface PlanCell {
  cell: Cell;
  /** 'A1' ... 'E5' */
  name: string;
  kind: 'start' | RoomId | 'plain';
  /** its top left corner, in plan units */
  x: number;
  y: number;
}

/** The 25 cells of the plan, row by row. */
export const PLAN_CELLS: PlanCell[] = Array.from({ length: GRID_CELLS * GRID_CELLS }, (_, n) => {
  const cell = cellFromNumber(n);
  const room = ROOM_IDS.find((id) => cellNumber(ROOMS[id].cell) === n);
  return {
    cell,
    name: cellName(cell),
    kind: n === cellNumber(START_CELL) ? 'start' : (room ?? 'plain'),
    x: cell.col * PLAN_CELL,
    y: cell.row * PLAN_CELL,
  };
});

/** The letters over the columns and the numbers beside the rows: the names of the cells are made of them. */
export const PLAN_COLUMN_NAMES: string[] = Array.from({ length: GRID_CELLS }, (_, col) => cellName({ col, row: 0 }).charAt(0));
export const PLAN_ROW_NAMES: string[] = Array.from({ length: GRID_CELLS }, (_, row) => cellName({ col: 0, row }).slice(1));

/** Which cells can be reached from START with these walls (entry = number of the cell, row by row). */
export function reachableCells(walls: readonly boolean[]): boolean[] {
  return stepsFrom(walls, START_CELL).map((steps) => steps >= 0);
}

/**
 * The fire target on the plan: where the game puts it for this room and spot (targetPose), in
 * plan units, with its true size. `turn` is the angle of its drawing in degrees, clockwise.
 */
export function planFire(room: RoomId, spot: FireSpot): { x: number; y: number; width: number; depth: number; turn: number } {
  const pose = targetPose(room, spot);
  return {
    x: planUnits(pose.x),
    y: planUnits(pose.y),
    width: planUnits(TARGET_WIDTH),
    depth: planUnits(TARGET_DEPTH),
    turn: (pose.angle * 180) / Math.PI,
  };
}

/**
 * Where the flame sign of the plan is drawn: in front of the target, `ahead` plan units into
 * the room (the target itself is too small to be seen on a small plan).
 */
export function planFlame(room: RoomId, spot: FireSpot, ahead = 17): { x: number; y: number } {
  const pose = targetPose(room, spot);
  // (heading 0 = up the mat, clockwise positive: one step ahead is (sin, -cos))
  return { x: planUnits(pose.x) + ahead * Math.sin(pose.angle), y: planUnits(pose.y) - ahead * Math.cos(pose.angle) };
}

/** The side of a cell, in mm (for the words of the editor: "30 cm"). */
export const CELL_MM = CELL_SIZE;
