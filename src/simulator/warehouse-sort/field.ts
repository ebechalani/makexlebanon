/**
 * MakeX Lebanon - Inspire (beginner), mission "Warehouse Sort": the field.
 *
 * Every measure of the mat and of the cubes is in this one file. The mat is measured from the
 * vectors of the print file "Capelli_Inspire_1235mm.pdf" (one page of 3500.79 pt, exactly
 * 1235 mm square; read with pdftocairo -svg, 1 pt = 1235 / 3500.79 mm, numbers rounded to
 * 0.01 mm). The lines, the coloured areas, the yellow band and frames and the sponsor's letters
 * are vector shapes there; the two round pads, the start-zone art, the pictures in the two bays
 * and the MakeX Lebanon logo are embedded pictures - for those the simulator takes their average
 * colour from a 4 px/mm render (pdftoppm).
 * field.test.ts holds the print file's own numbers (in points) and checks every rectangle here
 * against them.
 *
 * The rules ("Beginner - Warehouse Sort (MakeX Lebanon, Local)") give no sizes at all. Where a
 * number is not on the mat, its comment says ASSUMPTION.
 *
 * Everything is in millimetres, origin at the top-left corner of the mat, +x to the right, +y
 * DOWN, like the other games. "Top" is the top of the print file's page (the round picture
 * there reads upright); the start zone is on the right edge.
 *
 *     +=============     =============+     === the yellow band (with a gap at the top and the bottom)
 *     |  W1           ( )          W2  |     W1..W4  the warehouses, a cube on each orange square
 *     |  T             |           T   |     ( )     the two round finish pads
 *     |  |       +-----+-----+     |   |     T       a white line with a T-end
 *     |  |      -|   [red]   |-    |   |     [red], [green]  the two delivery bays
 *     |  +-------+---[logo]--+----[START    START   the start zone, on the right edge
 *     |  |      -|  [green]  |-    |   |
 *     |  |       +-----+-----+     |   |
 *     |  T             |           T   |
 *     |  W3           ( )          W4  |
 *     +=============     =============+
 */
import { TABLE_MARGIN } from '../core/engine';
import type { Rect, Vec2 } from '../core/geometry';
import type { ColorName, MatLayer, MatVector, RGB } from '../core/types';
import { LOGO_LETTER_OUTLINES } from './sponsor-logo';

// =============================================================================================
// The mat
// =============================================================================================

/** The mat is 1235 x 1235 mm (the print file: 3500.79 pt). */
export const MAT_SIZE = 1235;
/** One point of the print file in mm. */
export const MM_PER_PT = MAT_SIZE / 3500.79;

export const MAT_IMAGE_URL = '/simulator/warehouse-sort/mat.webp';
export const MAT_SENSOR_IMAGE_URL = '/simulator/warehouse-sort/mat-sensor.webp';

/**
 * ASSUMPTION: the mat lies on a table that goes on this far (mm) on every side; at its edge the
 * robot and the cubes stop. The rules have no walls ("teams may navigate freely as long as they
 * stay on the mat", "cube off the mat"), so the robot and the cubes can leave the mat - onto the
 * table. This is the engine's own table strip (core/engine.ts), the same 100 mm in every game.
 */
export const TABLE_STRIP = TABLE_MARGIN;

/** The whole mat as a rectangle. */
export const MAT_RECT: Rect = { x: 0, y: 0, w: MAT_SIZE, h: MAT_SIZE };

// =============================================================================================
// Colours as printed (the fill colours of the print file, 0..255)
// =============================================================================================

/** The ground: InDesign's "black" (not pure black). */
export const GROUND: RGB = { r: 35, g: 31, b: 32 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };
export const YELLOW: RGB = { r: 255, g: 242, b: 0 };
/** The squares a cube stands on. */
export const ORANGE: RGB = { r: 247, g: 152, b: 15 };
export const RED_BAY_COLOR: RGB = { r: 169, g: 30, b: 41 };
export const GREEN_BAY_COLOR: RGB = { r: 66, g: 178, b: 60 };
/** The black of the sponsor's letters. */
const LOGO_BLACK: RGB = { r: 0, g: 0, b: 0 };
/** Off the mat: the table (the same grey as in the other games). */
const TABLE: RGB = { r: 120, g: 120, b: 120 };

/**
 * Average colours of the embedded pictures, measured on a 4 px/mm render of the print file.
 * A floor sensor over one of these pictures sees more than one colour on the real mat (and in
 * the picture the browser reads); the vector mat shows each picture as one flat colour.
 *
 * What the colour blocks say there differs: the simulator's colour naming calls the flat colours
 * of the pads, the HOME hexagon and the green-bay picture "white" everywhere (they are greyish:
 * little colour, so they are named by brightness), while over the picture only part of each
 * reads white (pads: 41 % white, 36 % black, 21 % blue; green-bay picture: 57 % white, 22 %
 * green, 20 % black - measured with the probe spot every 1.5 mm). "White" is the name most of
 * each picture gets. Line or background - what a line follower uses - agrees with the picture on
 * 88 to 96 % of each picture. So a test that uses the colour-name blocks over a picture can
 * differ from the browser; a line follower hardly does.
 */
export const PICTURE_COLORS = {
  /**
   * The two round finish pads (the same picture, turned): (83.9, 107.1, 119.1). Under the
   * pixels of the picture: 38 % read white, 34 % black, 23 % blue. Brightness 40.
   */
  pad: { r: 84, g: 107, b: 119 } as RGB,
  /**
   * The start-zone art: (40.5, 60.1, 69.5), brightness 22. That average lies exactly on the
   * border between "black" and "blue" of the simulator's colour naming; written as 40, 60, 69 it
   * reads "black", like three quarters of the picture does (17 % read blue).
   */
  startArt: { r: 40, g: 60, b: 69 } as RGB,
  /** The "HOME" hexagon in the red bay: (179, 124, 131). 59 % of it reads white, 36 % red. */
  homeHexagon: { r: 179, g: 124, b: 131 } as RGB,
  /** The round picture in the green bay: (120, 147, 112). 42 % reads white, 34 % green, 24 % black. */
  greenBayPicture: { r: 120, g: 147, b: 112 } as RGB,
};

// =============================================================================================
// The yellow band along the edge (printed only)
// =============================================================================================

/**
 * The yellow band, about 18 to 20 mm wide, with a gap in the middle of the top edge and of the
 * bottom edge (x 483 to 763 mm at the top, 483 to 761 mm at the bottom). The right band stops at
 * 1233.34 mm: a 1.6 mm black strip is left at the very edge. In the start zone the start-zone
 * art is printed over it.
 */
export const YELLOW_BANDS: readonly Rect[] = [
  { x: 1.18, y: 0, w: 482.11, h: 17.26 }, // top, left of the gap
  { x: 763.42, y: 0, w: 471.51, h: 17.62 }, // top, right of the gap
  { x: 0, y: 0, w: 20.0, h: MAT_SIZE }, // left
  { x: 1213.7, y: 0, w: 19.65, h: MAT_SIZE }, // right
  { x: 1.34, y: 1215.21, w: 482.11, h: 19.71 }, // bottom, left of the gap
  { x: 761.11, y: 1215.21, w: 473.82, h: 19.71 }, // bottom, right of the gap
];

// =============================================================================================
// The white lines
// =============================================================================================

/** Most white lines are 26.2 mm wide (74.24 and 74.43 pt); a few short ones 25.0 to 27.3 mm. */
export const LINE_WIDTH = 26.2;

/**
 * Every white line of the mat, as the print file has it: one filled rectangle each. Where two
 * of them meet they overlap; some are printed in more than one piece (the left vertical line in
 * three, the middle vertical line in two).
 */
export const WHITE_LINES = {
  // ---- the square loop in the middle
  loopTop: { x: 385.05, y: 274.94, w: 469.27, h: 26.19 },
  loopBottom: { x: 385.91, y: 900.36, w: 468.41, h: 26.19 },
  loopLeft: { x: 385.05, y: 283.2, w: 26.26, h: 643.34 },
  loopRight: { x: 828.06, y: 283.2, w: 26.26, h: 643.34 },
  // ---- the four short bars across the left and right sides of the loop
  barLeftUpper: { x: 349.98, y: 434.06, w: 99.78, h: 26.19 },
  barRightUpper: { x: 791.3, y: 434.06, w: 99.78, h: 26.19 },
  barLeftLower: { x: 349.98, y: 749.82, w: 99.78, h: 26.19 },
  barRightLower: { x: 791.3, y: 749.82, w: 99.78, h: 26.19 },
  // ---- the middle vertical line: from the top pad, under the red bay, the logo and the green
  // bay, to the bottom pad (it runs on under the two pads and the two bays)
  middleUpper: { x: 606.42, y: 164.64, w: 26.26, h: 717.8 },
  middleLower: { x: 605.43, y: 816.03, w: 27.25, h: 240.11 },
  // ---- the long line across the middle: from the left vertical line into the start zone
  long: { x: 134.14, y: 591.78, w: 870.33, h: 26.19 },
  // ---- the vertical line on the left, with a T-end at each end
  leftUpper: { x: 121.18, y: 222.48, w: 26.26, h: 316.36 },
  leftMiddle: { x: 121.01, y: 523.54, w: 26.26, h: 389.91 },
  leftLower: { x: 121.21, y: 668.19, w: 26.26, h: 316.36 },
  leftTopT: { x: 84.42, y: 196.84, w: 99.78, h: 26.19 },
  leftBottomT: { x: 84.45, y: 984.0, w: 99.78, h: 26.19 },
  // ---- the two vertical lines on the right, above and below the start zone, each with a T-end
  // (they reach 25 mm into the start zone and are printed over its frame)
  rightUpper: { x: 1092.2, y: 198.82, w: 26.26, h: 306.38 },
  rightTopT: { x: 1055.44, y: 192.33, w: 99.79, h: 25.36 },
  rightLower: { x: 1092.2, y: 714.28, w: 26.26, h: 301.39 },
  rightBottomT: { x: 1055.44, y: 1001.03, w: 99.79, h: 24.95 },
} satisfies Record<string, Rect>;

export type WhiteLineId = keyof typeof WHITE_LINES;

/** The middle of the long line across the mat (y, mm): the start pose looks along it. */
export const LONG_LINE_Y = WHITE_LINES.long.y + WHITE_LINES.long.h / 2;
/** The middle of the middle vertical line (x, mm). */
export const MIDDLE_LINE_X = WHITE_LINES.middleUpper.x + WHITE_LINES.middleUpper.w / 2;

// =============================================================================================
// The sponsor's logo (decoration - but the floor sensors see it)
// =============================================================================================

/**
 * A white rectangle behind the sponsor's logo, between the two bays. The red bay covers its top
 * 20 mm, so it shows from y 500.08 to 709.97 mm. It is wider than a line (70 mm): a robot that
 * follows a line through it sees white under all four probes.
 */
export const SPONSOR_RECT: Rect = { x: 582.35, y: 479.98, w: 70.0, h: 229.99 };
/** A second white rectangle the print file puts right under the letters (on top of the lines). */
export const SPONSOR_INNER_RECT: Rect = { x: 589.41, y: 521.1, w: 56.44, h: 167.56 };

/** The black letters of the logo, printed over both white lines (./sponsor-logo.ts). */
export const LOGO_LETTERS: readonly Vec2[][][] = LOGO_LETTER_OUTLINES.map((shape) =>
  shape.map((flat) => {
    const points: Vec2[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
    return points;
  }),
);

/*
 * Not in the vector mat: the "MakeX Lebanon" logo on the left (x 49 to 106 mm, y 505 to 696 mm,
 * red and blue letters on the black ground, left of the left vertical line). It is a picture in
 * the print file; the vector mat shows black ground there. A robot that follows the left line
 * does not see it with its probes (they reach 23 mm left of the line, to x 112 mm).
 */

// =============================================================================================
// The warehouses (rules §2: "4 yellow-framed pads, one near each corner")
// =============================================================================================

/** The rules do not name the warehouses. The simulator numbers them like a page is read. */
export type WarehouseId = 'W1' | 'W2' | 'W3' | 'W4';
export const WAREHOUSE_IDS: WarehouseId[] = ['W1', 'W2', 'W3', 'W4'];

export interface WarehouseDef {
  id: WarehouseId;
  /** where it is, in words for the screen */
  place: 'top left' | 'top right' | 'bottom left' | 'bottom right';
  /** the thin yellow frame (the rectangle runs along the middle of its 0.35 mm line) */
  frame: Rect;
  /** the orange square in its middle: the cube stands here at the start */
  square: Rect;
}

/** The yellow frames are 1 pt = 0.35 mm wide. */
export const WAREHOUSE_FRAME_WIDTH = 0.35;

export const WAREHOUSES: Record<WarehouseId, WarehouseDef> = {
  W1: {
    id: 'W1',
    place: 'top left',
    frame: { x: 57.04, y: 54.17, w: 154.95, h: 110.05 },
    square: { x: 114.36, y: 89.47, w: 39.91, h: 39.81 },
  },
  W2: {
    id: 'W2',
    place: 'top right',
    // (this frame is 3.5 mm shorter than the other three in the print file)
    frame: { x: 1028.06, y: 54.17, w: 154.95, h: 106.57 },
    square: { x: 1085.38, y: 88.35, w: 39.91, h: 38.55 },
  },
  W3: {
    id: 'W3',
    place: 'bottom left',
    frame: { x: 56.67, y: 1042.81, w: 154.95, h: 110.05 },
    square: { x: 114.38, y: 1077.75, w: 39.91, h: 39.81 },
  },
  W4: {
    id: 'W4',
    place: 'bottom right',
    frame: { x: 1028.06, y: 1054.1, w: 154.95, h: 110.05 },
    square: { x: 1085.38, y: 1090.35, w: 39.91, h: 37.92 },
  },
};

// =============================================================================================
// The two delivery bays (rules §2: "RED rectangle (upper middle) and GREEN rectangle (lower middle)")
// =============================================================================================

export type BayColor = Extract<ColorName, 'red' | 'green'>;
export const BAY_COLORS: BayColor[] = ['red', 'green'];

/**
 * The two bays: filled rectangles of 174.62 x 104.76 mm, no outline. The green one is printed
 * 2.6 mm further right than the red one. A cube counts when it is completely inside (rules §8).
 */
export const BAYS: Record<BayColor, Rect> = {
  red: { x: 531.25, y: 395.32, w: 174.62, h: 104.76 },
  green: { x: 533.85, y: 710.53, w: 174.62, h: 104.76 },
};

/**
 * The "HOME" picture in the red bay: a hexagon with round corners, traced on the render (the
 * print file has it only as a picture). It lies inside the bay, 13 mm from its top edge.
 */
export const HOME_HEXAGON: readonly Vec2[] = [
  { x: 657.4, y: 445.1 },
  { x: 657.1, y: 449.1 },
  { x: 638.4, y: 481.6 },
  { x: 634.9, y: 484.9 },
  { x: 593.1, y: 484.9 },
  { x: 589.1, y: 480.6 },
  { x: 570.4, y: 448.6 },
  { x: 570.9, y: 444.1 },
  { x: 588.1, y: 414.6 },
  { x: 591.9, y: 409.6 },
  { x: 594.6, y: 408.6 },
  { x: 633.6, y: 408.6 },
  { x: 635.9, y: 409.4 },
  { x: 639.6, y: 414.1 },
];

/** An ellipse: middle and the two half axes (mm). */
export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** The round picture in the green bay (the print file clips the picture to this ellipse). */
export const GREEN_BAY_PICTURE: Ellipse = { cx: 618.68, cy: 762.11, rx: 48.17, ry: 49.46 };

// =============================================================================================
// The two finish pads (rules §2: "two yellow circles with checkerboards (top center & bottom
// center)" - the mat has two round pictures there, with no checkerboard)
// =============================================================================================

export type PadId = 'top' | 'bottom';
export const PAD_IDS: PadId[] = ['top', 'bottom'];

/**
 * The two round pads: not quite circles - 160.18 mm wide and 157.13 mm high (a yellow ellipse in
 * the print file, with the picture clipped to it). The middle vertical line runs into each.
 */
export const FINISH_PADS: Record<PadId, Ellipse> = {
  top: { cx: 619.44, cy: 144.44, rx: 80.09, ry: 78.57 },
  bottom: { cx: 620.11, cy: 1063.51, rx: 80.09, ry: 78.57 },
};

// =============================================================================================
// The start zone (rules §2: "large green area on the right" - on the mat it is the yellow-framed
// area on the right edge, with a blue picture; the green under it is covered by the picture)
// =============================================================================================

/** The yellow frame of the start zone is 16 pt = 5.64 mm wide. */
export const START_FRAME_WIDTH = 5.64;
/** The middle of that frame (its right side runs off the mat: the zone reaches the edge). */
export const START_FRAME: Rect = { x: 972.99, y: 482.63, w: 265.08, h: 257.82 };
/**
 * The start zone as the simulator counts it: everything inside the outer edge of the yellow
 * frame, up to the right edge of the mat - 264.83 x 263.46 mm. (The rules do not say whether
 * the frame belongs to the zone. The simulator counts it in, as Fire Rescue does with its
 * outlines, so a robot has left the zone when a part of it is beyond the yellow frame.)
 */
export const START_ZONE: Rect = {
  x: START_FRAME.x - START_FRAME_WIDTH / 2,
  y: START_FRAME.y - START_FRAME_WIDTH / 2,
  w: MAT_SIZE - (START_FRAME.x - START_FRAME_WIDTH / 2),
  h: START_FRAME.h + START_FRAME_WIDTH,
};
/** The start-zone art (clipped to the middle of the frame; the frame is printed over its edge). */
export const START_ART: Rect = { x: 972.99, y: 482.66, w: MAT_SIZE - 972.99, h: 257.77 };

// =============================================================================================
// The cubes (rules §3: "4 total (mixture of red and green)") - no sizes in the rules
// =============================================================================================

/**
 * ASSUMPTION: a cube is 40 mm on every side. The orange squares it stands on are 39.91 mm wide
 * and 37.92 to 39.81 mm high, so 40 mm fits them. It is also the size of a Fire Rescue bucket,
 * which the gripper is made for (open 64 mm, closed 20 mm).
 */
export const CUBE_SIZE = 40;
/** ASSUMPTION: a cube is as high as it is wide. */
export const CUBE_HEIGHT = CUBE_SIZE;
/** ASSUMPTION: a cube is light (like a Fire Rescue bucket, mass 1): the robot can push it. */
export const CUBE_MASS = 1;

// =============================================================================================
// What the floor sensors see
// =============================================================================================

/** A closed outline of an ellipse with `count` corners (the sensors and the screen fill it). */
export function ellipseOutline(e: Ellipse, count = 72): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    out.push({ x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a) });
  }
  return out;
}

/** A thin outline along the middle of a rectangle's edge. */
function frameStroke(rect: Rect, width: number, color: RGB): MatLayer {
  return {
    kind: 'stroke',
    points: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ],
    closed: true,
    width,
    color,
  };
}

const rectLayer = (rect: Rect, color: RGB): MatLayer => ({ kind: 'rect', rect, color });

/**
 * A purely geometric description of the mat: what the floor sensors see in headless runs and
 * tests, and on the screen until the picture has loaded. Layers are painted in this order, the
 * same order as in the print file where two of them overlap:
 *
 *   black ground, the white rectangle behind the logo, the yellow band, the start-zone art and
 *   its frame, every white line (they run over the frame of the start zone), the warehouse
 *   frames and their orange squares, the bays with their pictures (over the middle line), the
 *   pads (over the ends of the middle line), and last the logo's letters (over both lines).
 *
 * Pictures are flat average colours (PICTURE_COLORS); the MakeX Lebanon logo is left out (see
 * above). The warehouse frames are 0.35 mm thin: the sensors' 1 mm grid (fastVectorSampler in
 * core/engine-sensors.ts) mostly misses them, as a probe that averages over a 6 mm spot would.
 */
export const MAT_VECTOR: MatVector = {
  width: MAT_SIZE,
  height: MAT_SIZE,
  background: GROUND,
  outside: TABLE,
  layers: [
    rectLayer(SPONSOR_RECT, WHITE),
    ...YELLOW_BANDS.map((band) => rectLayer(band, YELLOW)),
    rectLayer(START_ART, PICTURE_COLORS.startArt),
    frameStroke(START_FRAME, START_FRAME_WIDTH, YELLOW),
    ...Object.values(WHITE_LINES).map((line) => rectLayer(line, WHITE)),
    ...WAREHOUSE_IDS.map((id) => frameStroke(WAREHOUSES[id].frame, WAREHOUSE_FRAME_WIDTH, YELLOW)),
    ...WAREHOUSE_IDS.map((id) => rectLayer(WAREHOUSES[id].square, ORANGE)),
    rectLayer(BAYS.red, RED_BAY_COLOR),
    { kind: 'polygon', contours: [[...HOME_HEXAGON]], color: PICTURE_COLORS.homeHexagon },
    rectLayer(BAYS.green, GREEN_BAY_COLOR),
    { kind: 'polygon', contours: [ellipseOutline(GREEN_BAY_PICTURE)], color: PICTURE_COLORS.greenBayPicture },
    ...PAD_IDS.map((id): MatLayer => ({ kind: 'polygon', contours: [ellipseOutline(FINISH_PADS[id])], color: PICTURE_COLORS.pad })),
    rectLayer(SPONSOR_INNER_RECT, WHITE),
    ...LOGO_LETTERS.map((contours): MatLayer => ({ kind: 'polygon', contours, color: LOGO_BLACK })),
  ],
};
