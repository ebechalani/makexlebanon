/**
 * Fire Cadet - Rescue City (MakeX Lebanon Season 2027, ages 4-7, played with a Makeblock mTiny):
 * the ONE table of numbers.
 *
 * Every other file of the game and of its screen reads its numbers from FIRE_CADET. No number of
 * this table is written a second time anywhere - not in a sentence either: the texts are built
 * from it.
 *
 * Each value says where it comes from:
 *   RULE        the organiser's rules file (line number given as "l.48")
 *   ORGANISER   what the organiser answered on 19 November (answer number given)
 *   MEASURED    measured from the organiser's print file of the map ("map report")
 *   SPEC        the mTiny specification, with how sure it is
 *   ASSUMPTION  a choice of this simulator (A1 to A18 of the brief, N1 to N24 of the design). The
 *               README lists them all, with the question to the organiser that would settle each.
 *
 * Plain TypeScript, no DOM: it runs under Node too.
 */
import { RESTORE_CLEARANCE, SIM_DT, TABLE_MARGIN } from '../core/engine';
import type { Rect } from '../core/geometry';

/** The independent values. FIRE_CADET below adds the few that are worked out from them. */
const TABLE = {
  // ---- the map
  /** MEASURED: map report 1.1 - the print file is 1250.000 x 1250.000 mm */
  MAT: 1250,
  /** RULE l.33: the map has 7 x 7 squares */
  GRID_COUNT: 7,
  /** MEASURED: map report 1.2 - the black lines are 178.000 mm apart */
  GRID_PITCH: 178,
  /** MEASURED: map report 1.2 - the middle of the first line is 179.764 mm from the edge */
  GRID_FIRST_LINE: 179.764,
  /** MEASURED: map report 1.2 - the lines are 20 pt = 7.0556 mm wide (for drawing only) */
  GRID_LINE_WIDTH: 7.0556,

  // ---- the moves
  /** ASSUMPTION A1: one Forward or Backward card moves the robot exactly one square (= GRID_PITCH) */
  STEP: 178,
  /**
   * SPEC verified: one Forward card moves a real mTiny 186 mm on the maker's own map. Used in one
   * sentence of the Rules window only, never in the game.
   */
  REAL_STEP: 186,
  /** SPEC verified, ASSUMPTION A1: one Turn card turns the robot by 90 degrees on the spot */
  TURN: 90,
  /** ASSUMPTION A2: a move takes 1.6 s, speeding up and braking included (unknown for the real robot) */
  MOVE_SECONDS: 1.6,
  /** ASSUMPTION A2: a turn takes 1.3 s */
  TURN_SECONDS: 1.3,
  /** ASSUMPTION A2, N5: the robot rests 0.4 s between two moves (not after the last one) */
  REST_SECONDS: 0.4,
  /** ASSUMPTION N5: speeding up and braking take 0.2 s each (an unofficial note says about 200 ms; SPEC low) */
  RAMP_SECONDS: 0.2,

  // ---- the match
  /** RULE l.14, l.210: a match lasts 120 s */
  MATCH_SECONDS: 120,
  /** RULE l.150: Junior has 120 s to lay the cards before the match */
  PLANNING_SECONDS: 120,

  // ---- the items and the obstacles
  /** ORGANISER 5 ("use a 4 cm base for now"): every rescue item stands on a 40 x 40 mm base */
  ITEM_BASE: 40,
  /** ASSUMPTION N4: the items are 50 mm high */
  ITEM_HEIGHT: 50,
  /** ASSUMPTION A5: every obstacle stands on a 40 x 40 mm base */
  OBSTACLE_BASE: 40,
  /** ASSUMPTION N4: the obstacles are 50 mm high */
  OBSTACLE_HEIGHT: 50,

  // ---- the robot
  /** SPEC likely (114 x 106.5 x 98 mm): the length of the body */
  BODY_LENGTH: 114,
  /** SPEC likely: the width of the body */
  BODY_WIDTH: 106.5,
  /** SPEC likely: the height of the body */
  BODY_HEIGHT: 98,
  /** ASSUMPTION N2: the robot turns around the middle of its body (half of BODY_LENGTH) */
  TURNING_POINT_TO_FRONT: 57,
  /** ASSUMPTION A5: each stick reaches 30 mm beyond the front of the body (works from 21 to 32 mm) */
  STICK_LENGTH: 30,
  /** ASSUMPTION A5: each stick is 8 mm thick */
  STICK_THICKNESS: 8,
  /** ASSUMPTION N4: the sticks are 5 mm above the mat ... */
  STICK_BOTTOM: 5,
  /** ASSUMPTION N4: ... and 20 mm high */
  STICK_HEIGHT: 20,
  /** ASSUMPTION N4: the wheels are 40 mm across (a card is turned into wheel degrees with it) */
  WHEEL_DIAMETER: 40,
  /** SPEC likely-low (about 74 mm, one hobby measurement): the distance between the two wheels */
  TRACK_WIDTH: 74,

  // ---- the points
  /** RULE l.224-232: each item in its place */
  POINTS_ITEM: 5,
  /** RULE l.237-239: the robot fully inside the Fire Station at the end */
  POINTS_RETURN: 5,
  /** RULE l.243-245: each obstacle the robot touched (once for each obstacle: ASSUMPTION A7) */
  POINTS_OBSTACLE: 1,
  /** RULE l.254: the most points of a match (a test checks 4 x POINTS_ITEM + POINTS_RETURN) */
  MAX_POINTS: 25,

  // ---- the referee and the screen
  /** ASSUMPTION: "touching" = nearer than this (mm), the value the other games use */
  TOUCH_MM: 0.5,
  /** ASSUMPTION N22: the referee's newest sentence stays in the banner for 3 s */
  MESSAGE_SECONDS: 3,
  /** ASSUMPTION N16: on a small screen an item or obstacle is drawn at least 22 px across */
  TOKEN_MIN_PIXELS: 22,
};

/** Whole ticks of the engine in `seconds` - the interpreter's own rounding (cards.ts counts this way). */
export function ticks(seconds: number, dt: number = SIM_DT): number {
  return Math.round(seconds / dt);
}

/**
 * The table. The values worked out from others, and the three the engine owns, are added here:
 *   STICK_GAP          ASSUMPTION A5: the sticks stand on the left and the right edge of the front,
 *                      so the free width between them is BODY_WIDTH - 2 x STICK_THICKNESS = 90.5 mm
 *   MAX_ROW_CARDS      ASSUMPTION N9: the most cards a row can hold, 70. The shortest card is a
 *                      turn, and a row never has more cards than moves, so the 71st card of any row
 *                      could never be finished inside the match (70 turns end at 118.6 s; a 71st
 *                      would start at 119.0 s and be cut by the clock). Worked out in ticks, as the interpreter
 *                      counts: floor((ticks(MATCH) + ticks(REST)) / (ticks(TURN) + ticks(REST))) =
 *                      floor(12,040 / 170) = 70. It follows the times: change one and it changes.
 *   TABLE_MARGIN       the engine's own: the edge of the table, 100 mm outside the mat
 *   SIM_DT             the engine's own: one tick, 0.01 s
 *   RESTORE_CLEARANCE  the engine's own (lead decision D1): the referee puts a lifted obstacle back
 *                      on its spot only when nothing is nearer to its base than this, 5 mm
 */
export const FIRE_CADET = Object.freeze({
  ...TABLE,
  STICK_GAP: TABLE.BODY_WIDTH - 2 * TABLE.STICK_THICKNESS,
  MAX_ROW_CARDS: Math.floor(
    (ticks(TABLE.MATCH_SECONDS) + ticks(TABLE.REST_SECONDS)) / (ticks(TABLE.TURN_SECONDS) + ticks(TABLE.REST_SECONDS)),
  ),
  TABLE_MARGIN: TABLE_MARGIN as number,
  SIM_DT: SIM_DT as number,
  RESTORE_CLEARANCE: RESTORE_CLEARANCE as number,
});

/**
 * The four times of a card. The game uses FIRE_CADET's; a test can hand the interpreter and the
 * robot other ones (cards.ts, robot.ts) to see that a tuned time never breaks the counting.
 */
export interface CardTimes {
  readonly MOVE_SECONDS: number;
  readonly TURN_SECONDS: number;
  readonly REST_SECONDS: number;
  readonly RAMP_SECONDS: number;
}

// =============================================================================================
// Squares
// =============================================================================================

/**
 * A square of the map: its column and its row, both 0 to 6, (0,0) at the top left - as in the
 * map report. On the screen and in the map codes the same square is a letter A to G for the
 * column and a number 1 to 7 for the row: (0,0) is A1, the School; (3,6) is D7, the Fire Station
 * at the bottom (scenario.ts: squareName).
 */
export interface Square {
  readonly col: number;
  readonly row: number;
}

/** The 8 lines of the grid along one side: the two edges of the map and the middles of the six black lines (mm). */
export function gridBound(k: number): number {
  if (k <= 0) return 0;
  if (k >= TABLE.GRID_COUNT) return TABLE.MAT;
  return TABLE.GRID_FIRST_LINE + (k - 1) * TABLE.GRID_PITCH;
}

/**
 * ASSUMPTION A6: the square as a target area - from the middle of one black line to the middle of
 * the next; at the edge of the map, to the edge. So the first column and row are 179.764 mm, the
 * middle five 178 mm and the last 180.236 mm.
 */
export function squareRect(sq: Square): Rect {
  const x = gridBound(sq.col);
  const y = gridBound(sq.row);
  return { x, y, w: gridBound(sq.col + 1) - x, h: gridBound(sq.row + 1) - y };
}

/**
 * ASSUMPTION N1: where things stand - the robot, the items, the obstacles. Everything stands on a
 * lattice of GRID_PITCH, so that one Forward card (STEP = GRID_PITCH) takes the robot from one spot
 * to the next: x = GRID_FIRST_LINE - GRID_PITCH / 2 + GRID_PITCH x col (90.764 + 178 col), and the
 * same for y. The spot is exactly the middle of the 25 inner squares and at most 1.12 mm from the
 * middle of an edge square (the edge squares are a little wider than the others).
 */
export function spot(sq: Square): { x: number; y: number } {
  const first = TABLE.GRID_FIRST_LINE - TABLE.GRID_PITCH / 2;
  return { x: first + TABLE.GRID_PITCH * sq.col, y: first + TABLE.GRID_PITCH * sq.row };
}

/**
 * How far the robot reaches ahead of its turning point: the front of its body and the sticks,
 * 57 + 30 = 87 mm. It must be at most half a square, or the robot does not fit in one square.
 */
export const frontReach = (): number => TABLE.TURNING_POINT_TO_FRONT + TABLE.STICK_LENGTH;
