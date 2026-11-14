/**
 * MakeX Lebanon 2027 - Fire Chief (Dynamic Maze Challenge, ages 14-17): the field.
 *
 * Every measure of the field, of its walls and of the fire target is in this one file. (The
 * measures of the robot's flame sensor and fan are in ./robot.ts, the limits of the referee in
 * ./game.ts.) Some of them come from the print file of the map ("Maze 14-17yo makex 2027",
 * page 2) and from the draft rules. Some are DECISIONS of the organiser, given since the draft
 * (the thickness of the walls, the wall around the field, the width and the height of the fire
 * target). The others are ASSUMPTIONS, because the organiser has not published them yet. Each
 * decision and each assumption says so in its comment, and changing it here changes it
 * everywhere. The ONE list of all assumptions and decisions of this game - the ones of this
 * file, of the robot, of the referee and of the engine - is at the top of ./game.ts.
 *
 * Everything is in millimetres, origin at the top-left corner of the mat (the two rooms are at
 * the top, START is at the bottom), +x to the right, +y DOWN. A direction ("angle", "heading")
 * is in radians, 0 = up the mat, clockwise positive - like everywhere in the simulator.
 *
 *        A        B        C        D        E          columns (col 0..4)
 *    +--------+--------+--------+--------+--------+
 *  1 | living |        |        |        |  bed   |     row 0
 *    |  room  |        |        |        |  room  |
 *    +--------+--------+--------+--------+--------+
 *  2 |        |        |        |        |        |     row 1
 *    ...
 *  5 |        |        | START  |        |        |     row 4
 *    +--------+--------+--------+--------+--------+
 */
import type { Rect, Vec2 } from '../core/geometry';
import type { FixedWall, MatVector, RGB } from '../core/types';

// =============================================================================================
// The mat (measured from the print file)
// =============================================================================================

/** The mat is a square of 1500 x 1500 mm ... */
export const FIELD_SIZE = 1500;
/** ... divided into 5 x 5 cells ... */
export const GRID_CELLS = 5;
/** ... of 300 mm. */
export const CELL_SIZE = FIELD_SIZE / GRID_CELLS;

export const MAT_IMAGE_URL = '/simulator/fire-chief/mat.webp';
export const MAT_SENSOR_IMAGE_URL = '/simulator/fire-chief/mat-sensor.webp';

/** The black grid lines printed between the cells are 6.5 mm wide. */
export const GRID_LINE_WIDTH = 6.5;
/**
 * Where each printed grid line begins (its left edge for the four lines that run up-down, its
 * top edge for the four lines that run left-right). A line covers start .. start + 6.5 mm, so
 * it lies just right of / below the boundary between two cells. The outer edge has no line.
 */
export const GRID_LINE_STARTS = [299.9, 599.8, 899.7, 1199.6];

/** Colours as printed: plain cells are white, the two rooms are pictures (their average colour). */
const WHITE: RGB = { r: 255, g: 255, b: 255 };
/** The black of the grid lines, as it is in the print file (not quite pure black). */
export const GRID_LINE_COLOR: RGB = { r: 35, g: 31, b: 32 };
const OFF_THE_MAT: RGB = { r: 120, g: 120, b: 120 };
export const LIVING_ROOM_COLOR: RGB = { r: 177, g: 125, b: 89 };
export const BEDROOM_COLOR: RGB = { r: 153, g: 123, b: 105 };

// =============================================================================================
// Cells
// =============================================================================================

/** One cell of the grid: col 0..4 from the left, row 0..4 from the top. */
export interface Cell {
  col: number;
  row: number;
}

export const CELL_COUNT = GRID_CELLS * GRID_CELLS;

/** The robot starts here: bottom centre. */
export const START_CELL: Cell = { col: 2, row: 4 };
/** The living room: top left. */
export const LIVING_ROOM_CELL: Cell = { col: 0, row: 0 };
/** The bedroom: top right. */
export const BEDROOM_CELL: Cell = { col: 4, row: 0 };

export type RoomId = 'living' | 'bedroom';
export const ROOM_IDS: RoomId[] = ['living', 'bedroom'];

export interface RoomDef {
  id: RoomId;
  /** as written in texts: "the living room" */
  name: string;
  cell: Cell;
  /** on which side of the room the outer edge of the field is */
  outerSide: 'left' | 'right';
  /** average printed colour of its picture */
  color: RGB;
}

export const ROOMS: Record<RoomId, RoomDef> = {
  living: { id: 'living', name: 'living room', cell: LIVING_ROOM_CELL, outerSide: 'left', color: LIVING_ROOM_COLOR },
  bedroom: { id: 'bedroom', name: 'bedroom', cell: BEDROOM_CELL, outerSide: 'right', color: BEDROOM_COLOR },
};

export const sameCell = (a: Cell, b: Cell): boolean => a.col === b.col && a.row === b.row;

export function isCell(cell: Cell): boolean {
  return (
    Number.isInteger(cell.col) &&
    Number.isInteger(cell.row) &&
    cell.col >= 0 &&
    cell.col < GRID_CELLS &&
    cell.row >= 0 &&
    cell.row < GRID_CELLS
  );
}

/** Number 0..24 of a cell, row by row from the top left. */
export const cellNumber = (cell: Cell): number => cell.row * GRID_CELLS + cell.col;
export const cellFromNumber = (n: number): Cell => ({ col: n % GRID_CELLS, row: Math.floor(n / GRID_CELLS) });

/** The square of the mat that belongs to a cell (boundary to boundary). */
export function cellRect(cell: Cell): Rect {
  return { x: cell.col * CELL_SIZE, y: cell.row * CELL_SIZE, w: CELL_SIZE, h: CELL_SIZE };
}

export function cellCenter(cell: Cell): Vec2 {
  return { x: (cell.col + 0.5) * CELL_SIZE, y: (cell.row + 0.5) * CELL_SIZE };
}

/** The cell that contains the point (x, y), or null when the point is off the mat. */
export function cellAt(x: number, y: number): Cell | null {
  if (!(x >= 0 && y >= 0 && x < FIELD_SIZE && y < FIELD_SIZE)) return null;
  return { col: Math.floor(x / CELL_SIZE), row: Math.floor(y / CELL_SIZE) };
}

const COLUMN_LETTERS = 'ABCDE';

/** Name of a cell like on a chess board: column letter A..E, row number 1..5 from the top. "C5" is START. */
export function cellName(cell: Cell): string {
  return `${COLUMN_LETTERS[cell.col]}${cell.row + 1}`;
}

export const START_RECT: Rect = cellRect(START_CELL);
const ROOM_RECTS: Record<RoomId, Rect> = { living: cellRect(LIVING_ROOM_CELL), bedroom: cellRect(BEDROOM_CELL) };
/** The square of a room (always the same object: do not change it). */
export const roomRect = (room: RoomId): Rect => ROOM_RECTS[room];

// =============================================================================================
// Walls
// =============================================================================================

/** Rules: the walls are 150 mm high. */
export const WALL_HEIGHT = 150;
/** DECISION of the organiser: a wall panel is 3 mm thick. */
export const WALL_THICKNESS = 3;
/**
 * DECISION of the organiser: the outer edge of the field is walled, so the robot cannot leave
 * the mat. (Set to false to play on an open table.)
 */
export const OUTER_WALLS = true;
/**
 * ASSUMPTION: a wall panel is as long as a cell, plus one thickness: so two panels that meet at
 * a corner close the corner completely (no gap for the robot's sensors to look through).
 */
export const WALL_LENGTH = CELL_SIZE + WALL_THICKNESS;

/** CSS colour used to draw a wall. */
const WALL_FILL = '#c9a26b';

/** There are 40 places where an inner wall can stand: one on every boundary between two cells. */
export const INNER_WALL_COUNT = 2 * GRID_CELLS * (GRID_CELLS - 1);

/** One of the 40 places where an inner wall can stand. */
export interface WallPosition {
  /**
   * 0..39. First the 20 places between two cells side by side (row by row, left to right),
   * then the 20 places between a cell and the cell below it (row by row, left to right).
   */
  index: number;
  /** the two cells it separates: [left, right] or [upper, lower] */
  between: [Cell, Cell];
  /** 'upright': it runs up-down, between two cells side by side; 'level': it runs left-right */
  direction: 'upright' | 'level';
  /** e.g. 'A1-B1' */
  label: string;
  /** the middle of the wall */
  x: number;
  y: number;
}

/** How many of the 40 places are between two cells side by side (they come first). */
const UPRIGHT_COUNT = GRID_CELLS * (GRID_CELLS - 1);

export const WALL_POSITIONS: WallPosition[] = (() => {
  const out: WallPosition[] = [];
  // between two cells side by side
  for (let row = 0; row < GRID_CELLS; row++) {
    for (let col = 0; col < GRID_CELLS - 1; col++) {
      const a: Cell = { col, row };
      const b: Cell = { col: col + 1, row };
      out.push({
        index: out.length,
        between: [a, b],
        direction: 'upright',
        label: `${cellName(a)}-${cellName(b)}`,
        x: (col + 1) * CELL_SIZE,
        y: (row + 0.5) * CELL_SIZE,
      });
    }
  }
  // between a cell and the cell below it
  for (let row = 0; row < GRID_CELLS - 1; row++) {
    for (let col = 0; col < GRID_CELLS; col++) {
      const a: Cell = { col, row };
      const b: Cell = { col, row: row + 1 };
      out.push({
        index: out.length,
        between: [a, b],
        direction: 'level',
        label: `${cellName(a)}-${cellName(b)}`,
        x: (col + 0.5) * CELL_SIZE,
        y: (row + 1) * CELL_SIZE,
      });
    }
  }
  return out;
})();

/** Index (0..39) of the wall place between two neighbouring cells, or -1 when they are not neighbours. */
export function wallIndexBetween(a: Cell, b: Cell): number {
  if (!isCell(a) || !isCell(b)) return -1;
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
    return a.row * (GRID_CELLS - 1) + Math.min(a.col, b.col);
  }
  if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
    return UPRIGHT_COUNT + Math.min(a.row, b.row) * GRID_CELLS + a.col;
  }
  return -1;
}

/** The four neighbours of a cell that are on the field. */
export function neighbours(cell: Cell): Cell[] {
  const out: Cell[] = [];
  if (cell.row > 0) out.push({ col: cell.col, row: cell.row - 1 });
  if (cell.col < GRID_CELLS - 1) out.push({ col: cell.col + 1, row: cell.row });
  if (cell.row < GRID_CELLS - 1) out.push({ col: cell.col, row: cell.row + 1 });
  if (cell.col > 0) out.push({ col: cell.col - 1, row: cell.row });
  return out;
}

/** The wall panel that stands at one of the 40 inner places. */
export function innerWall(position: WallPosition): FixedWall {
  const upright = position.direction === 'upright';
  return {
    id: `wall:${position.label}`,
    label: position.label,
    x: position.x,
    y: position.y,
    angle: 0,
    // (angle 0: `w` is the size from left to right, `l` the size from top to bottom)
    w: upright ? WALL_THICKNESS : WALL_LENGTH,
    l: upright ? WALL_LENGTH : WALL_THICKNESS,
    h: WALL_HEIGHT,
    fill: WALL_FILL,
  };
}

/**
 * The four walls around the field. They stand just OUTSIDE the mat (their inner face is the
 * edge of the mat), so the whole 1500 x 1500 mm stays free.
 */
export function outerWalls(): FixedWall[] {
  if (!OUTER_WALLS) return [];
  const t = WALL_THICKNESS;
  const long = FIELD_SIZE + 2 * t;
  const mid = FIELD_SIZE / 2;
  const make = (name: string, x: number, y: number, w: number, l: number): FixedWall => ({
    id: `wall:${name}`,
    label: name,
    x,
    y,
    angle: 0,
    w,
    l,
    h: WALL_HEIGHT,
    fill: WALL_FILL,
  });
  return [
    make('top', mid, -t / 2, long, t),
    make('right', FIELD_SIZE + t / 2, mid, t, long),
    make('bottom', mid, FIELD_SIZE + t / 2, long, t),
    make('left', -t / 2, mid, t, long),
  ];
}

// =============================================================================================
// The fire target
// =============================================================================================
// Rules: "a wooden flame-shaped piece with an embedded infrared emitter". The organiser has
// decided its width and its height. Its depth, its weight, its emitter and the places where it
// may stand are not published yet: those are assumptions.

/** DECISION of the organiser: the target is 60 mm wide ... */
export const TARGET_WIDTH = 60;
/** ASSUMPTION: it is 20 mm deep (front to back). */
export const TARGET_DEPTH = 20;
/** DECISION of the organiser: ... and 120 mm high. */
export const TARGET_HEIGHT = 120;
/**
 * ASSUMPTION: it is light (as light as a bucket of Fire Rescue): the robot can push it away.
 * It cannot fall over in the simulator: where it stands flat against its wall, a robot that
 * drives squarely into it does not move it at all (the wall holds it).
 */
export const TARGET_MASS = 1;
/** ASSUMPTION: the infrared emitter sits in the middle of the front face, 60 mm above the mat ... */
export const EMITTER_HEIGHT = 60;
/**
 * ... and shines forward into a cone of 70 degrees to each side. (In the outer quarter of the
 * cone the light fades out: EMITTER_FADE in core/engine-sensors.ts.)
 */
export const EMITTER_HALF_ANGLE_DEG = 70;

/**
 * ASSUMPTION: the three places of a room where the target can stand. It always stands against
 * the outer walls and looks into the room:
 *   'corner'  in the outer corner of the field, turned 45 degrees towards the middle of the room
 *   'back'    in the middle of the room's top wall
 *   'side'    in the middle of the room's outer side wall
 */
export type FireSpot = 'corner' | 'back' | 'side';
export const FIRE_SPOTS: FireSpot[] = ['corner', 'back', 'side'];

/** Where the target stands: its centre, and the direction it faces (radians, 0 = up, clockwise positive). */
export function targetPose(room: RoomId, spot: FireSpot): { x: number; y: number; angle: number } {
  const rect = roomRect(room);
  const left = ROOMS[room].outerSide === 'left';
  // "inwards" along x: +1 when the outer wall is on the left of the room, -1 when it is on the right
  const inwards = left ? 1 : -1;
  const outerX = left ? rect.x : rect.x + rect.w;
  const half = TARGET_DEPTH / 2;
  if (spot === 'back') {
    // against the top wall, facing down the mat
    return { x: rect.x + rect.w / 2, y: rect.y + half, angle: Math.PI };
  }
  if (spot === 'side') {
    // against the outer side wall, facing across the room
    return { x: outerX + inwards * half, y: rect.y + rect.h / 2, angle: (inwards * Math.PI) / 2 };
  }
  // In the corner, turned 45 degrees: its two rear corners touch the two walls. That puts its
  // centre (width + depth) / 2 x sin(45 degrees) away from each wall.
  const away = ((TARGET_WIDTH + TARGET_DEPTH) / 2) * Math.SQRT1_2;
  return { x: outerX + inwards * away, y: rect.y + away, angle: (inwards * 3 * Math.PI) / 4 };
}

// =============================================================================================
// The robot (rules §4)
// =============================================================================================

/** The robot may be at most 180 mm long, 130 mm wide and 300 mm high. */
export const ROBOT_MAX_LENGTH = 180;
export const ROBOT_MAX_WIDTH = 130;
export const ROBOT_MAX_HEIGHT = 300;
/** No sensor or motor may be higher than this above the mat (it must not look over the walls). */
export const SENSOR_MAX_HEIGHT = 150;

// =============================================================================================
// What the floor sensors see
// =============================================================================================

/**
 * A purely geometric description of the mat: white ground, the two room pictures as their
 * average colour, and the eight black grid lines on top. The browser normally samples the real
 * mat picture; this model is the fallback and what the headless tests and batch runs use.
 * (The START picture is drawn on white and the fireplace / candle of the rooms are decoration:
 * they are not in this model.)
 */
export const MAT_VECTOR: MatVector = {
  width: FIELD_SIZE,
  height: FIELD_SIZE,
  background: WHITE,
  outside: OFF_THE_MAT,
  layers: [
    ...ROOM_IDS.map((id) => ({ kind: 'rect' as const, rect: roomRect(id), color: ROOMS[id].color })),
    // four lines that run up-down ...
    ...GRID_LINE_STARTS.map((start) => ({
      kind: 'stroke' as const,
      points: [
        { x: start + GRID_LINE_WIDTH / 2, y: 0 },
        { x: start + GRID_LINE_WIDTH / 2, y: FIELD_SIZE },
      ],
      width: GRID_LINE_WIDTH,
      color: GRID_LINE_COLOR,
    })),
    // ... and four that run left-right
    ...GRID_LINE_STARTS.map((start) => ({
      kind: 'stroke' as const,
      points: [
        { x: 0, y: start + GRID_LINE_WIDTH / 2 },
        { x: FIELD_SIZE, y: start + GRID_LINE_WIDTH / 2 },
      ],
      width: GRID_LINE_WIDTH,
      color: GRID_LINE_COLOR,
    })),
  ],
};
