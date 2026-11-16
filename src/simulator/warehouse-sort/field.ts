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
 * THE FIELD IS TURNED. The owner of the site decided that the robot starts facing UP: the whole
 * print file is turned 90 degrees to the right (clockwise), so the start zone is in the middle of
 * the bottom edge. Every number here is the print file TURNED that way (a PDF viewer's "turn
 * right", /Rotate 90), measured as before; the pictures of the mat are the same pictures,
 * turned. The rules ("RED rectangle (upper middle)", "start zone on the right" ...) describe the
 * print file as it was printed; on this field the red bay is right of the middle, the green bay
 * left of it, and the finish pads are on the left and on the right.
 * (How the turn was checked: a point x, y of the print file as it was is now at
 * 1234.93 - y, x - pdftocairo draws the page at 3500.58 pt, 0.006 % smaller than its 3500.79 pt,
 * and every number of this file has always been measured on that drawing. field.test.ts holds
 * the numbers of the TURNED print file.)
 *
 * The rules ("Beginner - Warehouse Sort (MakeX Lebanon, Local)") give no sizes at all. Where a
 * number is not on the mat, its comment says ASSUMPTION.
 *
 * Everything is in millimetres, origin at the top-left corner of the mat, +x to the right, +y
 * DOWN, like the other games.
 *
 *     +==================================+    === the yellow band (with a gap in the middle of
 *     |  W1  |--------------------|  W2  |        the left and of the right edge)
 *     |              |                   |    W1..W4  the warehouses, a cube on each orange square
 *     |       +--|---+-----|---+         |    ( )  the two round finish pads
 *     |       |      |         |         |    |-   a white line with a T-end
 *     ( )-----+ [green][logo][red] +-----( )  [red], [green]  the two delivery bays
 *     |       |      |         |         |    START  the start zone, in the middle of the
 *     |       +--|---+-----|---+         |           bottom edge: the robot starts facing UP
 *     |              |                   |
 *     |  W3  |-----[START]----------|  W4  |
 *     +=========[       ]================+
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
 * table. This is the engine's own table strip (core/engine.ts), the same 100 mm in every game -
 * and on every side, so it is the same on the turned field.
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
 * differ from the browser; a line follower hardly does. (Turning the field changes none of this:
 * the pictures are turned with it.)
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
 * The yellow band, about 18 to 20 mm wide, with a gap in the middle of the left edge and of the
 * right edge (y 483 to 761 mm on the left, 483 to 763 mm on the right). The bottom band stops at
 * y 1233.35 mm: a 1.6 mm black strip is left at the very edge. In the start zone the start-zone
 * art is printed over it.
 */
export const YELLOW_BANDS: readonly Rect[] = [
  { x: 0, y: 0, w: MAT_SIZE, h: 20.0 }, // top
  { x: 1217.66, y: 1.18, w: 17.26, h: 482.11 }, // right, above the gap
  { x: 1217.3, y: 763.42, w: 17.62, h: 471.51 }, // right, below the gap
  { x: 0, y: 1213.7, w: MAT_SIZE, h: 19.65 }, // bottom
  { x: 0, y: 1.34, w: 19.71, h: 482.11 }, // left, above the gap
  { x: 0, y: 761.11, w: 19.71, h: 473.82 }, // left, below the gap
];

// =============================================================================================
// The white lines
// =============================================================================================

/** Most white lines are 26.2 mm wide (74.24 and 74.43 pt); a few short ones 25.0 to 27.3 mm. */
export const LINE_WIDTH = 26.2;

/**
 * Every white line of the mat, as the print file has it: one filled rectangle each. Where two
 * of them meet they overlap; some are printed in more than one piece (the top line in three,
 * the middle line in two).
 */
export const WHITE_LINES = {
  // ---- the square loop in the middle
  loopTop: { x: 308.38, y: 385.05, w: 643.34, h: 26.26 },
  loopBottom: { x: 308.38, y: 828.06, w: 643.34, h: 26.26 },
  loopLeft: { x: 308.38, y: 385.91, w: 26.19, h: 468.41 },
  loopRight: { x: 933.8, y: 385.05, w: 26.19, h: 469.27 },
  // ---- the four short bars across the top and the bottom side of the loop
  barTopLeft: { x: 458.92, y: 349.98, w: 26.19, h: 99.78 },
  barTopRight: { x: 774.67, y: 349.98, w: 26.19, h: 99.78 },
  barBottomLeft: { x: 458.92, y: 791.3, w: 26.19, h: 99.78 },
  barBottomRight: { x: 774.67, y: 791.3, w: 26.19, h: 99.78 },
  // ---- the middle line across the mat: from the right pad, under the red bay, the logo and the
  // green bay, to the left pad (it runs on under the two pads and the two bays)
  middleRight: { x: 352.49, y: 606.42, w: 717.79, h: 26.26 },
  middleLeft: { x: 178.79, y: 605.43, w: 240.11, h: 27.25 },
  // ---- the long line up the middle: from the top line down into the start zone
  long: { x: 616.96, y: 134.14, w: 26.19, h: 870.33 },
  // ---- the line along the top, with a T-end at each end
  topRight: { x: 696.09, y: 121.18, w: 316.36, h: 26.26 },
  topMiddle: { x: 321.47, y: 121.01, w: 389.91, h: 26.26 },
  topLeft: { x: 250.37, y: 121.21, w: 316.36, h: 26.26 },
  topRightT: { x: 1011.9, y: 84.42, w: 26.19, h: 99.78 },
  topLeftT: { x: 224.74, y: 84.45, w: 26.19, h: 99.78 },
  // ---- the two lines along the bottom, left and right of the start zone, each with a T-end
  // (they reach 25 mm into the start zone and are printed over its frame)
  bottomLeft: { x: 219.25, y: 1092.2, w: 301.39, h: 26.26 },
  bottomLeftT: { x: 208.94, y: 1055.44, w: 24.95, h: 99.79 },
  bottomRight: { x: 729.73, y: 1092.2, w: 306.38, h: 26.26 },
  bottomRightT: { x: 1017.23, y: 1055.44, w: 25.36, h: 99.79 },
} satisfies Record<string, Rect>;

export type WhiteLineId = keyof typeof WHITE_LINES;

/** The middle of the long line up the mat (x, mm): the start pose looks along it. */
export const LONG_LINE_X = WHITE_LINES.long.x + WHITE_LINES.long.w / 2;
/** The middle of the middle line across the mat (y, mm). */
export const MIDDLE_LINE_Y = WHITE_LINES.middleRight.y + WHITE_LINES.middleRight.h / 2;

// =============================================================================================
// The sponsor's logo (decoration - but the floor sensors see it)
// =============================================================================================

/**
 * A white rectangle behind the sponsor's logo, between the two bays. The red bay covers its
 * right 20 mm, so it shows from x 524.96 to 734.85 mm. It is wider than a line (70 mm): a robot
 * that follows a line through it sees white under all four probes.
 */
export const SPONSOR_RECT: Rect = { x: 524.96, y: 582.35, w: 229.99, h: 70.0 };
/** A second white rectangle the print file puts right under the letters (on top of the lines). */
export const SPONSOR_INNER_RECT: Rect = { x: 546.27, y: 589.41, w: 167.56, h: 56.44 };

/** The black letters of the logo, printed over both white lines (./sponsor-logo.ts). */
export const LOGO_LETTERS: readonly Vec2[][][] = LOGO_LETTER_OUTLINES.map((shape) =>
  shape.map((flat) => {
    const points: Vec2[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
    return points;
  }),
);

/*
 * Not in the vector mat: the "MakeX Lebanon" logo at the top (x 539 to 730 mm, y 49 to 106 mm,
 * red and blue letters on the black ground, above the top line). It is a picture in the print
 * file; the vector mat shows black ground there. A robot that follows the top line does not see
 * it with its probes (they reach 23 mm beside the line, to y 112 mm).
 */

// =============================================================================================
// The warehouses (rules §2: "4 yellow-framed pads, one near each corner")
// =============================================================================================

/**
 * The rules do not name the warehouses. The simulator numbers them like a page is read, on the
 * field as the screen shows it (turned): W1 top left, W2 top right, W3 bottom left, W4 bottom
 * right. (Before the turn the same four had other numbers: the W1 of the print file as printed
 * is W2 here, W2 is W4, W3 is W1 and W4 is W3.)
 */
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
    frame: { x: 82.06, y: 56.67, w: 110.05, h: 154.95 },
    square: { x: 117.36, y: 114.38, w: 39.81, h: 39.91 },
  },
  W2: {
    id: 'W2',
    place: 'top right',
    frame: { x: 1070.7, y: 57.04, w: 110.05, h: 154.95 },
    square: { x: 1105.65, y: 114.36, w: 39.81, h: 39.91 },
  },
  W3: {
    id: 'W3',
    place: 'bottom left',
    frame: { x: 70.77, y: 1028.06, w: 110.05, h: 154.95 },
    square: { x: 106.65, y: 1085.38, w: 37.92, h: 39.91 },
  },
  W4: {
    id: 'W4',
    place: 'bottom right',
    // (this frame is 3.5 mm narrower than the other three in the print file)
    frame: { x: 1074.19, y: 1028.06, w: 106.57, h: 154.95 },
    square: { x: 1108.03, y: 1085.38, w: 38.55, h: 39.91 },
  },
};

// =============================================================================================
// The two delivery bays (rules §2: "RED rectangle (upper middle) and GREEN rectangle (lower
// middle)" - on the turned field: the red one right of the middle, the green one left of it)
// =============================================================================================

export type BayColor = Extract<ColorName, 'red' | 'green'>;
export const BAY_COLORS: BayColor[] = ['red', 'green'];

/**
 * The two bays: filled rectangles of 104.76 x 174.62 mm, no outline. The green one is printed
 * 2.6 mm lower than the red one. A cube counts when it is completely inside (rules §8).
 */
export const BAYS: Record<BayColor, Rect> = {
  red: { x: 734.85, y: 531.25, w: 104.76, h: 174.62 },
  green: { x: 419.64, y: 533.85, w: 104.76, h: 174.62 },
};

/**
 * The "HOME" picture in the red bay: a hexagon with round corners, traced on the render (the
 * print file has it only as a picture). It lies inside the bay, 13 mm from its right edge.
 */
export const HOME_HEXAGON: readonly Vec2[] = [
  { x: 789.83, y: 657.4 },
  { x: 785.83, y: 657.1 },
  { x: 753.33, y: 638.4 },
  { x: 750.03, y: 634.9 },
  { x: 750.03, y: 593.1 },
  { x: 754.33, y: 589.1 },
  { x: 786.33, y: 570.4 },
  { x: 790.83, y: 570.9 },
  { x: 820.33, y: 588.1 },
  { x: 825.33, y: 591.9 },
  { x: 826.33, y: 594.6 },
  { x: 826.33, y: 633.6 },
  { x: 825.53, y: 635.9 },
  { x: 820.83, y: 639.6 },
];

/** An ellipse: middle and the two half axes (mm). */
export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** The round picture in the green bay (the print file clips the picture to this ellipse). */
export const GREEN_BAY_PICTURE: Ellipse = { cx: 472.82, cy: 618.68, rx: 49.46, ry: 48.17 };

// =============================================================================================
// The two finish pads (rules §2: "two yellow circles with checkerboards (top center & bottom
// center)" - the mat has two round pictures there, with no checkerboard; on the turned field
// they are in the middle of the left and of the right side)
// =============================================================================================

export type PadId = 'left' | 'right';
export const PAD_IDS: PadId[] = ['left', 'right'];

/**
 * The two round pads: not quite circles - 157.13 mm wide and 160.18 mm high (a yellow ellipse in
 * the print file, with the picture clipped to it). The middle line runs into each.
 */
export const FINISH_PADS: Record<PadId, Ellipse> = {
  left: { cx: 171.42, cy: 620.11, rx: 78.57, ry: 80.09 },
  right: { cx: 1090.49, cy: 619.44, rx: 78.57, ry: 80.09 },
};

// =============================================================================================
// The start zone (rules §2: "large green area on the right" - on the mat it is the yellow-framed
// area at the edge, with a blue picture; the green under it is covered by the picture. On the
// turned field it is in the middle of the bottom edge.)
// =============================================================================================

/** The yellow frame of the start zone is 16 pt = 5.64 mm wide. */
export const START_FRAME_WIDTH = 5.64;
/** The middle of that frame (its bottom side runs off the mat: the zone reaches the edge). */
export const START_FRAME: Rect = { x: 494.48, y: 972.99, w: 257.82, h: 265.08 };
/**
 * The start zone as the simulator counts it: everything inside the outer edge of the yellow
 * frame, down to the bottom edge of the mat - 263.46 x 264.83 mm. (The rules do not say whether
 * the frame belongs to the zone. The simulator counts it in, as Fire Rescue does with its
 * outlines, so a robot has left the zone when a part of it is beyond the yellow frame.)
 */
export const START_ZONE: Rect = {
  x: START_FRAME.x - START_FRAME_WIDTH / 2,
  y: START_FRAME.y - START_FRAME_WIDTH / 2,
  w: START_FRAME.w + START_FRAME_WIDTH,
  h: MAT_SIZE - (START_FRAME.y - START_FRAME_WIDTH / 2),
};
/** The start-zone art (clipped to the middle of the frame; the frame is printed over its edge). */
export const START_ART: Rect = { x: 494.5, y: 972.99, w: 257.77, h: MAT_SIZE - 972.99 };

// =============================================================================================
// The cubes (rules §3: "4 total (mixture of red and green)"; the owner of the site added one blue
// cube that must be left alone - see ./scenario.ts) - no sizes in the rules
// =============================================================================================

/**
 * ASSUMPTION: a cube is 40 mm on every side. The orange squares it stands on are 39.91 mm high
 * and 37.92 to 39.81 mm wide, so 40 mm fits them. It is also the size of a Fire Rescue bucket,
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
