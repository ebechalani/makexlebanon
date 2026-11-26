/**
 * Robot en fête 2027 - « Logistique intelligente » (the regular mission of MakeX Inspire 2024
 * "Smart Logistics", mBot2): the field.
 *
 * Every measure of the mat and of the things on it is in this one file. Each number says where it
 * comes from:
 *   MEASURED  on the vectors of the organiser's print file "map_inspire.pdf" (Adobe InDesign,
 *             one page of 3613.65 pt with crop marks; its trim box is 1250.000 mm square; 1 pt =
 *             25.4 / 72 mm; numbers to 0.001 mm). The print is at 1:1: every designed size comes
 *             out as a round number of mm (lines 25.000, storage squares 50.000, warehouses
 *             40.000). field.test.ts holds the measured numbers and checks every shape here
 *             against them.
 *   PICTURE   traced on the two pictures the print file embeds (the starting-area logo and the
 *             MAKEX letters), from their transparency masks, to 0.07 mm.
 *   RULE      the rules: "MakeX Robotics Competition - Rules Guide - MakeX Inspire", V2.0
 *             (2024.01), theme "Smart Logistics", quoted with its page ("p. 10/6" = PDF page 10,
 *             printed page 6).
 *   ASSUMPTION  nothing says it; the comment says why the simulator chose this number.
 *   DECISION  the simulator's own choice where nothing needs to be measured.
 *
 * THE ORIGIN IS THE ARENA, NOT THE PRINTED MAT. RULE p. 10/6: "The MakeX Inspire arena consists of
 * a map and frame. The internal side of the frame is 1200 mm*1200 mm." The print is 1250 mm square
 * and does not draw the frame: a grey band 30 mm wide runs round a black field of 1190 mm.
 * ASSUMPTION: the frame is centred on the print (the print is symmetric to 0.001 pt), so 5 mm of
 * the grey band show inside the frame on every side. Everything here is in millimetres, origin at
 * the top-left INNER corner of the frame, +x to the right, +y DOWN (as in the other games; Warehouse
 * Sort puts its origin at the corner of the whole print). The printed mat runs from -25 to 1225 mm.
 *
 *   +--[blue strip]-------------------------[red strip]--+   grey band 5 mm inside the frame
 *   |<E1>    [E2]          M A K E X          [E3]    <E4>|   <E1> <E4>  diamonds (turned 45°)
 *   |  \       ===                     ===          /     |   === lone bars
 *   |   \                                          /      |
 *   |    =====[yellow]=====+=====[yellow]=========        |   the top line, two yellow patches
 *   |  [E5]                |                   [E6]       |
 *   |   T             +----+----+               T         |   the square loop round the storage
 *   |   |           --|  (cross) |--            |         |   cross (five 50 mm squares, a
 *   |   |             +----+----+               |         |   dashed magenta circle round it)
 *   |   +-------------+----|-----------------------+      |   the bottom line
 *   | [E7] |-------        |              -------| [E8]  |
 *   |[blue block]     [ start: blue|red ]    [red block]  |   the start area, the stem 43 mm into it
 *   +-------------------------------------------------------+
 *
 * The warehouses E1 - E8 are the eight 40 mm squares of the mat in reading order (top row from left
 * to right, then down). The rules give them no names; « E » for « entrepôt », as in Tri d'entrepôt.
 *
 * Plain TypeScript, no DOM.
 */
import type { OBB, Rect, Vec2 } from '../core/geometry';
import type { MatLayer, MatVector, RGB } from '../core/types';

// =============================================================================================
// The arena and the frame
// =============================================================================================

/** RULE p. 10/6: "The internal side of the frame is 1200 mm*1200 mm." */
export const ARENA_SIZE = 1200;
/** The field the simulator knows (the stage, the vector mat, the pictures): the arena, 1200 mm square. */
export const MAT_SIZE = ARENA_SIZE;
/** The arena: it ends at the inner side of the frame (ASSUMPTION, the design's Q15). */
export const ARENA: Rect = { x: 0, y: 0, w: ARENA_SIZE, h: ARENA_SIZE };

/** ASSUMPTION (the frame centred on the print): the width of the grey band that shows inside the frame on every side. */
export const GREY_BAND = 5;

/**
 * ASSUMPTION (the design's Q2): the frame is 50 mm high. The rules give no height (Fig 4.1 shows low
 * dark walls). With 50 mm the robot's chassis (90 mm) and a cube on the mat (50 mm) cannot pass;
 * the raised claw (its underside 75 mm, arm up) reaches 62 mm over it - the robot leaves the arena.
 */
export const FRAME_HEIGHT = 50;
/** DECISION: how thick the four walls of the frame are drawn and collide (they stand outside 0 .. 1200). */
export const FRAME_THICKNESS = 20;

export const MAT_IMAGE_URL = '/simulator/logistique-intelligente/mat.webp';
export const MAT_SENSOR_IMAGE_URL = '/simulator/logistique-intelligente/mat-sensor.webp';

// =============================================================================================
// Colours (the screen colours the print file's CMYK gives in poppler, read on a 5 px/mm render
// in flat patches; black, white, yellow and orange are the same numbers as Warehouse Sort's)
// =============================================================================================

/** MEASURED: the grey band round the black field (CMYK 0/0/0/50). */
export const GREY: RGB = { r: 145, g: 143, b: 143 };
/** MEASURED: the black field, InDesign's "black" (CMYK 0/0/0/100). */
export const BLACK: RGB = { r: 35, g: 31, b: 32 };
/** MEASURED: the white lines. */
export const WHITE: RGB = { r: 255, g: 255, b: 255 };
/** MEASURED: the yellow (CMYK 0/0/100/0): the two patches on the top line, the warehouses' 1 mm border, the centre square of the cross. */
export const YELLOW: RGB = { r: 255, g: 242, b: 0 };
/** MEASURED: the orange (CMYK 0/42/100/0): the warehouses' 38 mm squares, the four outer squares of the cross. */
export const ORANGE: RGB = { r: 247, g: 152, b: 15 };
/** MEASURED: the two halves of the start area (CMYK 75/35/0/0 and 0/90/75/0). */
export const START_BLUE: RGB = { r: 74, g: 139, b: 209 };
export const START_RED: RGB = { r: 239, g: 43, b: 62 };
/** MEASURED: the side bands (CMYK 75/53/0/0 and 38/90/75/0). */
export const BAND_BLUE: RGB = { r: 80, g: 110, b: 191 };
export const BAND_RED: RGB = { r: 166, g: 51, b: 70 };
/** MEASURED: the dashed circle round the cross (CMYK 0/100/0/0), read in the middle of a dash at 20 px/mm. */
export const MAGENTA: RGB = { r: 236, g: 0, b: 140 };
/** PICTURE: the MAKEX letters and the start logo's left chevron (an RGB picture: 255, 51, 51). */
export const LOGO_RED: RGB = { r: 255, g: 51, b: 51 };
/** PICTURE: the start logo's right chevron (0, 153, 255). */
export const LOGO_BLUE: RGB = { r: 0, g: 153, b: 255 };
/** Off the mat: the table (the same grey as in the other games). */
const TABLE: RGB = { r: 120, g: 120, b: 120 };

const box = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const p = (x: number, y: number): Vec2 => ({ x, y });

// =============================================================================================
// The black field and the side bands
// =============================================================================================

/** MEASURED: the black field inside the grey band, 1190 mm square (the band's inner edge). */
export const BLACK_FIELD: Rect = box(GREY_BAND, GREY_BAND, ARENA_SIZE - 2 * GREY_BAND, ARENA_SIZE - 2 * GREY_BAND);

export type SideBandId = 'bottomRightRed' | 'bottomLeftBlue' | 'topLeftBlue' | 'topRightRed' | 'leftBlue' | 'rightRed';
/** The side bands in the order the print file paints them. */
export const SIDE_BAND_IDS: readonly SideBandId[] = ['bottomRightRed', 'bottomLeftBlue', 'topLeftBlue', 'topRightRed', 'leftBlue', 'rightRed'];
/**
 * MEASURED: the blue and red bands along the edges (decoration). The left and right bands reach
 * 0.914 mm over the black field's edge into the grey; the top red strip is not the mirror of the
 * blue one (it starts 11.5 mm further right and runs under the right band); the two bottom blocks
 * stop 1.41 mm before the start area.
 */
export const SIDE_BANDS: Readonly<Record<SideBandId, Rect>> = {
  bottomRightRed: box(725.411, 1108, 459, 87),
  bottomLeftBlue: box(15.586, 1108, 459, 87),
  topLeftBlue: box(15.586, 5, 459, 14),
  topRightRed: box(736.911, 5, 459, 14),
  leftBlue: box(4.086, 5, 11.5, 1190),
  rightRed: box(1184.411, 5, 11.5, 1190),
};
const SIDE_BAND_COLORS: Readonly<Record<SideBandId, RGB>> = {
  bottomRightRed: BAND_RED,
  bottomLeftBlue: BAND_BLUE,
  topLeftBlue: BAND_BLUE,
  topRightRed: BAND_RED,
  leftBlue: BAND_BLUE,
  rightRed: BAND_RED,
};

// =============================================================================================
// The white lines
// =============================================================================================

/** MEASURED: every white line is 25.000 mm wide. */
export const LINE_WIDTH = 25;

export type WhiteLineId =
  | 'topLine'
  | 'stemTop'
  | 'loopTop'
  | 'loopLeft'
  | 'loopRight'
  | 'loopBottom'
  | 'crossbarLeft'
  | 'crossbarRight'
  | 'stemBottom'
  | 'bottomLine'
  | 'leftPost'
  | 'leftPostT'
  | 'rightPost'
  | 'rightPostT'
  | 'bottomLeftArm'
  | 'bottomLeftT'
  | 'bottomRightArm'
  | 'bottomRightT'
  | 'topLeftBar'
  | 'topRightBar';

/**
 * MEASURED: the straight white lines as rectangles. The top line with the stem down to the square
 * loop round the storage cross; the loop (324 mm outside, its centre (600, 602)) with a crossbar
 * across each side; the stem from the loop down through the bottom line 43 mm into the start area;
 * the bottom line with a post and T up towards E5 and E6; the two bottom arms with their T towards
 * E7 and E8; the two lone bars under E2 and E3.
 */
export const WHITE_LINES: Readonly<Record<WhiteLineId, Rect>> = {
  topLine: box(297.5, 292.5, 605, 25),
  stemTop: box(587.5, 317.5, 25, 122.5),
  loopTop: box(438, 440, 324, 25),
  loopLeft: box(438, 440, 25, 324),
  loopRight: box(737, 440, 25, 324),
  loopBottom: box(438, 739, 324, 25),
  crossbarLeft: box(403, 589.5, 95, 25),
  crossbarRight: box(702, 589.5, 95, 25),
  stemBottom: box(587.5, 762, 25, 231),
  bottomLine: box(108.5, 823, 983, 25),
  leftPost: box(208, 515.5, 25, 307.5),
  leftPostT: box(173, 490.5, 95, 25),
  rightPost: box(967, 515.5, 25, 307.5),
  rightPostT: box(932, 490.5, 95, 25),
  bottomLeftArm: box(182, 972.75, 169.5, 25),
  bottomLeftT: box(157, 938, 25, 94.5),
  bottomRightArm: box(848.5, 972.75, 169.5, 25),
  bottomRightT: box(1018, 938, 25, 94.5),
  topLeftBar: box(337.5, 150.623, 94.5, 25),
  topRightBar: box(766.25, 150.35, 94.5, 25),
};

export type DiagonalId = 'diagLeft' | 'diagLeftT' | 'diagRight' | 'diagRightT';
/**
 * MEASURED: the two 45° arms from the ends of the top line towards E1 and E4 (25 mm wide, 211 mm
 * long) and the T bar at the end of each (94.5 x 25 mm, square to its arm), as the print file's
 * four-cornered shapes. A black hairline of 0.049 mm (left) and 0.207 mm (right) separates each arm
 * from its bar: no sensor can see it.
 */
export const DIAGONALS: Readonly<Record<DiagonalId, readonly Vec2[]>> = {
  diagLeft: [p(297.499, 317.5), p(315.177, 299.822), p(165.978, 150.623), p(148.3, 168.3)],
  diagLeftT: [p(106.077, 175.099), p(123.755, 192.776), p(190.576, 125.955), p(172.899, 108.277)],
  diagRight: [p(902.478, 317.5), p(884.8, 299.822), p(1033.999, 150.623), p(1051.677, 168.3)],
  diagRightT: [p(1094.123, 175.099), p(1076.445, 192.776), p(1009.624, 125.955), p(1027.301, 108.277)],
};

/** MEASURED: the two yellow patches printed over the top line, under E2 and E3 (86 x 25 mm). */
export const YELLOW_LINE_PATCHES: Readonly<Record<'left' | 'right', Rect>> = {
  left: box(341.75, 292.5, 86, 25),
  right: box(770.5, 292.5, 86, 25),
};

/** The middle of the stem that runs from the loop into the start area (x, mm): the robot starts on it. */
export const START_LINE_X = WHITE_LINES.stemBottom.x + WHITE_LINES.stemBottom.w / 2;

// =============================================================================================
// The warehouses (rules p. 11/7, Fig 4.2-4 p. 12/8)
// =============================================================================================

/**
 * MEASURED: a warehouse is a yellow 40.000 mm square with an orange 38.000 mm square on it, so the
 * yellow shows as a 1 mm border. RULE p. 11/7 says "The warehouse area is 50mm*50mm square"; its
 * figure (Fig 4.2-4) and the mat say 40 mm. The simulator uses the mat (the design's Q1): a 50 mm
 * cube covers it with 5 mm to spare on each side when centred.
 */
export const WAREHOUSE_SIZE = 40;
export const WAREHOUSE_ORANGE_SIZE = 38;
export const WAREHOUSE_BORDER = (WAREHOUSE_SIZE - WAREHOUSE_ORANGE_SIZE) / 2;

export type WarehouseId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8';
/** The eight warehouses in reading order: the top row from left to right, then down. */
export const WAREHOUSE_IDS: readonly WarehouseId[] = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'];

export interface Warehouse {
  /** the middle of the square */
  readonly centre: Vec2;
  /** how far the square is turned (degrees): E1 and E4 are diamonds */
  readonly turnedDeg: 0 | 45;
}

/** MEASURED: where each warehouse is (W1 - W8 of the measurement = E1 - E8). Each lies on the axis of a line or a bar that points at it, 99 - 99.5 mm beyond its end. */
export const WAREHOUSES: Readonly<Record<WarehouseId, Warehouse>> = {
  E1: { centre: p(69.484, 71.684), turnedDeg: 45 },
  E2: { centre: p(384.66, 51.1), turnedDeg: 0 },
  E3: { centre: p(813.41, 51.1), turnedDeg: 0 },
  E4: { centre: p(1130.716, 71.684), turnedDeg: 45 },
  E5: { centre: p(220.5, 391), turnedDeg: 0 },
  E6: { centre: p(979.5, 391), turnedDeg: 0 },
  E7: { centre: p(57.5, 985.25), turnedDeg: 0 },
  E8: { centre: p(1142.5, 985.25), turnedDeg: 0 },
};

/** A warehouse's square (40 mm, or `size`) as an oriented box. */
export function warehouseBox(id: WarehouseId, size: number = WAREHOUSE_SIZE): OBB {
  const w = WAREHOUSES[id];
  return { x: w.centre.x, y: w.centre.y, w: size, l: size, angle: (w.turnedDeg * Math.PI) / 180 };
}

/** The four corners of a warehouse's square (40 mm, or `size`): for a diamond, its bottom, right, top and left points. */
export function warehouseCorners(id: WarehouseId, size: number = WAREHOUSE_SIZE): Vec2[] {
  const w = WAREHOUSES[id];
  const h = size / 2;
  if (w.turnedDeg === 0) {
    return [p(w.centre.x - h, w.centre.y + h), p(w.centre.x + h, w.centre.y + h), p(w.centre.x + h, w.centre.y - h), p(w.centre.x - h, w.centre.y - h)];
  }
  const d = h * Math.SQRT2;
  return [p(w.centre.x, w.centre.y + d), p(w.centre.x + d, w.centre.y), p(w.centre.x, w.centre.y - d), p(w.centre.x - d, w.centre.y)];
}

/** The box round a warehouse's square (for a diamond: 56.57 mm). */
export function warehouseFrame(id: WarehouseId): Rect {
  const corners = warehouseCorners(id);
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// =============================================================================================
// The storage centre (rules p. 11/7: "a cross shape area consisting of five 50mm* 50mm squares")
// =============================================================================================

/** MEASURED: the middle of the cross (2 mm below the middle of the arena; the loop round it is centred there too). */
export const STORAGE_CENTRE: Vec2 = p(600, 602);
/** MEASURED: each square of the cross is 50.000 mm. */
export const STORAGE_SQUARE_SIZE = 50;

/** The five squares of the cross, in the order of the cube numbers (the bottom cube on « haut » is cube 1, ... on « bas » cube 5). */
export type StorageSquare = 'haut' | 'gauche' | 'centre' | 'droite' | 'bas';
export const STORAGE_SQUARE_IDS: readonly StorageSquare[] = ['haut', 'gauche', 'centre', 'droite', 'bas'];

/** MEASURED: the five squares (top-left corners): the centre one yellow, the four round it orange. */
export const STORAGE_SQUARES: Readonly<Record<StorageSquare, Rect>> = {
  haut: box(575, 527, 50, 50),
  gauche: box(525, 577, 50, 50),
  centre: box(575, 577, 50, 50),
  droite: box(625, 577, 50, 50),
  bas: box(575, 627, 50, 50),
};
export const STORAGE_SQUARE_COLORS: Readonly<Record<StorageSquare, RGB>> = { haut: ORANGE, gauche: ORANGE, centre: YELLOW, droite: ORANGE, bas: ORANGE };
/** The order in which the print file paints the five squares. */
const STORAGE_PRINT_ORDER: readonly StorageSquare[] = ['centre', 'gauche', 'bas', 'droite', 'haut'];

/** The box round the cross: x 525 .. 675, y 527 .. 677. */
export const STORAGE_BOX: Rect = box(525, 527, 150, 150);
/** The outline of the cross: its twelve corners, clockwise from the top-left corner of the top square. */
export const STORAGE_OUTLINE: readonly Vec2[] = [
  p(575, 527),
  p(625, 527),
  p(625, 577),
  p(675, 577),
  p(675, 627),
  p(625, 627),
  p(625, 677),
  p(575, 677),
  p(575, 627),
  p(525, 627),
  p(525, 577),
  p(575, 577),
];

/** The middle of a square of the cross: where its two cubes stand at the start. */
export function storageSquareCentre(square: StorageSquare): Vec2 {
  const r = STORAGE_SQUARES[square];
  return p(r.x + r.w / 2, r.y + r.h / 2);
}

/** A point is inside the cross (on one of its five squares; the edge counts). */
export function inStorage(point: Vec2): boolean {
  return STORAGE_SQUARE_IDS.some((square) => {
    const r = STORAGE_SQUARES[square];
    return point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
  });
}

// =============================================================================================
// The dashed circle round the cross (Fig 4.2-3: orange dashes; the mat: magenta)
// =============================================================================================

/** MEASURED: the circle's centre, the radius of the middle of its 1 mm stroke (the Bézier arcs run from 90.500 to 90.525). */
export const CIRCLE_CENTRE: Vec2 = p(600, 602);
export const CIRCLE_RADIUS = 90.505;
export const CIRCLE_STROKE = 1;

/**
 * MEASURED: the 68 painted pieces of the circle, from and to (degrees from +x towards +y, clockwise
 * on the screen): 64 dashes of 4.182 mm on four quarter arcs and four solid pieces of 4.182 mm on
 * the axes (0, 90, 180 and 270 degrees). Written out, as the print file paints them.
 */
// prettier-ignore
export const CIRCLE_PIECES: readonly (readonly [number, number])[] = [
  [3.968, 6.615], [9.263, 11.91], [14.557, 17.203], [19.85, 22.497], [25.144, 27.791], [30.438, 33.085],
  [35.732, 38.38], [41.027, 43.675], [46.322, 48.97], [51.617, 54.265], [56.912, 59.559], [62.206, 64.853],
  [67.5, 70.147], [72.794, 75.44], [78.087, 80.734], [83.382, 86.029], [88.676, 91.324], [93.968, 96.615],
  [99.263, 101.91], [104.557, 107.203], [109.85, 112.497], [115.144, 117.791], [120.438, 123.085], [125.732, 128.38],
  [131.027, 133.675], [136.322, 138.97], [141.617, 144.265], [146.912, 149.559], [152.206, 154.853], [157.5, 160.147],
  [162.794, 165.44], [168.087, 170.734], [173.382, 176.029], [178.676, 181.324], [183.968, 186.615], [189.263, 191.91],
  [194.557, 197.204], [199.85, 202.497], [205.144, 207.791], [210.438, 213.085], [215.732, 218.38], [221.027, 223.675],
  [226.322, 228.97], [231.617, 234.265], [236.912, 239.559], [242.206, 244.853], [247.5, 250.147], [252.794, 255.44],
  [258.087, 260.734], [263.382, 266.029], [268.676, 271.324], [273.968, 276.615], [279.263, 281.91], [284.557, 287.203],
  [289.85, 292.497], [295.144, 297.791], [300.438, 303.085], [305.732, 308.38], [311.027, 313.675], [316.322, 318.97],
  [321.617, 324.265], [326.912, 329.559], [332.206, 334.853], [337.5, 340.147], [342.794, 345.44], [348.087, 350.734],
  [353.382, 356.029], [358.676, 361.324],
];

/** How many straight pieces each painted piece of the circle is drawn with (an arc of 2.65 degrees: 0.002 mm off the true arc). */
const ARC_STEPS = 4;

function arcPoints(from: number, to: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = ((from + ((to - from) * i) / ARC_STEPS) * Math.PI) / 180;
    out.push(p(CIRCLE_CENTRE.x + CIRCLE_RADIUS * Math.cos(a), CIRCLE_CENTRE.y + CIRCLE_RADIUS * Math.sin(a)));
  }
  return out;
}

// =============================================================================================
// The start area (rules p. 11/7: "The arena has one starting area with a size of 250mm*250mm")
// =============================================================================================

/**
 * MEASURED: the start area, from the printed area to the frame: 248 mm wide (two halves of 124 mm;
 * the rules say 250) and 250 mm from y 950 to the frame (245 mm printed, then the 5 mm of grey band).
 * The robot must start completely inside it (RULE p. 15/11: "place it completely in the starting area").
 */
export const START_AREA: Rect = box(476, 950, 248, 250);
/** MEASURED: the two printed halves (to the black field's edge, y 1195): blue on the left, red on the right. */
export const START_HALVES: Readonly<Record<'blue' | 'red', Rect>> = {
  blue: box(476, 950, 124, 245),
  red: box(600, 950, 124, 245),
};
/**
 * PICTURE: the two chevrons of the logo printed in the start area (a picture of 201.5 x 115.1 mm
 * centred on x 600): red on the blue half, blue on the red half.
 */
export const START_CHEVRONS: Readonly<Record<'red' | 'blue', readonly Vec2[]>> = {
  red: [p(499.247, 1014.927), p(564.017, 1014.927), p(592.804, 1043.714), p(592.804, 1101.287), p(564.017, 1130.074), p(499.247, 1130.074), p(556.82, 1072.5)],
  blue: [p(700.754, 1014.927), p(635.984, 1014.927), p(607.197, 1043.714), p(607.197, 1101.287), p(635.984, 1130.074), p(700.754, 1130.074), p(643.181, 1072.5)],
};

// =============================================================================================
// The MAKEX letters (a picture at the top, 316 x 45 mm)
// =============================================================================================

export type MakexOutlineId = 'M' | 'A' | 'A_hole' | 'K' | 'E' | 'X_left' | 'X_right';
/** The outlines in the order they are listed: the five letters (the X in two halves) and the hole of the A. */
export const MAKEX_OUTLINE_IDS: readonly MakexOutlineId[] = ['M', 'A', 'A_hole', 'K', 'E', 'X_left', 'X_right'];

/** PICTURE: the outlines of the red letters, x and y one after the other (mm), traced at 50 % of the mask and simplified to 0.07 mm. */
// prettier-ignore
const MAKEX_XY: Readonly<Record<MakexOutlineId, readonly number[]>> = {
  M: [
    442.044, 75.407, 442.328, 75.305, 463.774, 75.314, 463.936, 75.549, 471.727, 97.559, 472.663, 100.899,
    473.021, 99.252, 480.935, 75.972, 481.27, 75.302, 503.421, 75.313, 503.526, 75.407, 503.526, 115.76,
    503.28, 115.837, 490.159, 115.837, 490.074, 115.76, 490.088, 92.056, 490.387, 88.388, 490.885, 85.143,
    490.723, 85.044, 490.554, 85.284, 489.608, 88.388, 488.079, 92.621, 479.012, 115.821, 465.467, 115.837,
    465.317, 115.76, 456.954, 93.044, 455.394, 88.388, 454.485, 85.143, 454.321, 85.061, 454.255, 85.143,
    454.648, 87.824, 454.809, 91.069, 454.81, 115.76, 454.603, 115.837, 442.328, 115.837, 442.046, 115.762,
  ],
  A: [
    526.351, 75.407, 526.561, 75.3, 545.326, 75.302, 545.561, 75.407, 564.433, 115.76, 564.233, 115.837,
    548.712, 115.813, 545.608, 108.318, 545.326, 108.121, 526.561, 108.115, 526.334, 108.423, 523.316, 115.795,
    507.654, 115.837, 507.506, 115.76,
  ],
  A_hole: [
    536.014, 83.62, 535.835, 83.873, 534.764, 87.259, 533.066, 91.915, 530.09, 99.252, 530.229, 99.324,
    541.899, 99.252, 538.332, 90.363,
  ],
  K: [
    568.404, 75.407, 568.607, 75.301, 582.998, 75.298, 583.139, 75.388, 583.145, 91.351, 583.28, 91.426,
    600.635, 75.327, 618.13, 75.338, 617.989, 75.585, 600.811, 91.351, 618.796, 115.76, 618.695, 115.836,
    602.046, 115.818, 590.228, 99.958, 589.771, 99.478, 583.169, 105.743, 583.139, 115.775, 568.466, 115.815,
  ],
  E: [
    624.717, 75.407, 624.903, 75.3, 667.231, 75.313, 667.314, 75.407, 667.316, 84.861, 667.231, 85.134,
    639.577, 85.131, 639.408, 85.284, 639.408, 90.646, 639.577, 90.877, 666.243, 90.853, 666.343, 91.069,
    666.342, 99.817, 666.243, 99.919, 639.577, 99.901, 639.408, 100.099, 639.408, 105.884, 639.577, 105.985,
    667.654, 105.988, 667.743, 106.166, 667.737, 115.76, 667.513, 115.837, 624.762, 115.806,
  ],
  X_left: [
    679.038, 73.15, 679.224, 73.052, 704.339, 73.057, 715.657, 84.296, 715.698, 106.73, 704.339, 118.087,
    679.02, 118.018, 701.464, 95.584,
  ],
  X_right: [
    732.455, 73.15, 732.698, 73.054, 757.672, 73.054, 757.891, 73.15, 735.464, 95.584, 757.918, 118.018,
    732.557, 118.074, 721.328, 106.871, 721.312, 84.296,
  ],
};

const outlineOf = (xy: readonly number[]): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push(p(xy[i], xy[i + 1]));
  return out;
};

/** The outlines of the MAKEX letters (mm). The A's hole is an outline inside the A: the even-odd fill leaves it black. */
export const MAKEX_OUTLINES: Readonly<Record<MakexOutlineId, readonly Vec2[]>> = {
  M: outlineOf(MAKEX_XY.M),
  A: outlineOf(MAKEX_XY.A),
  A_hole: outlineOf(MAKEX_XY.A_hole),
  K: outlineOf(MAKEX_XY.K),
  E: outlineOf(MAKEX_XY.E),
  X_left: outlineOf(MAKEX_XY.X_left),
  X_right: outlineOf(MAKEX_XY.X_right),
};

// =============================================================================================
// The cubes (rules p. 12/8)
// =============================================================================================

/** RULE p. 12/8: "Square with length of 50mm (±2mm)". ASSUMPTION (the design's Q11): exactly 50 mm. */
export const CUBE_SIZE = 50;
/** ASSUMPTION: a light cube (EVA foam), as Fire Fighter's: the robot can always push it. */
export const CUBE_MASS = 1;

// =============================================================================================
// What the floor sensors see: the vector drawing of the mat
// =============================================================================================

const rect = (r: Rect, color: RGB): MatLayer => ({ kind: 'rect', rect: r, color });
const polygon = (outlines: readonly (readonly Vec2[])[], color: RGB): MatLayer => ({ kind: 'polygon', contours: outlines.map((o) => [...o]), color });
const line = (id: WhiteLineId): MatLayer => rect(WHITE_LINES[id], WHITE);
const diagonal = (id: DiagonalId): MatLayer => polygon([DIAGONALS[id]], WHITE);

/** A warehouse as printed: the yellow 40 mm square, then the orange 38 mm square on it. */
function warehouseLayers(id: WarehouseId): MatLayer[] {
  return [polygon([warehouseCorners(id)], YELLOW), polygon([warehouseCorners(id, WAREHOUSE_ORANGE_SIZE)], ORANGE)];
}
/** A square warehouse as rectangles (the print file draws them so). */
function squareWarehouseLayers(id: WarehouseId): MatLayer[] {
  const c = WAREHOUSES[id].centre;
  const square = (size: number): Rect => box(c.x - size / 2, c.y - size / 2, size, size);
  return [rect(square(WAREHOUSE_SIZE), YELLOW), rect(square(WAREHOUSE_ORANGE_SIZE), ORANGE)];
}
const warehouse = (id: WarehouseId): MatLayer[] => (WAREHOUSES[id].turnedDeg === 0 ? squareWarehouseLayers(id) : warehouseLayers(id));

/**
 * The mat as the floor sensors see it in tests and headless runs, painted in the order of the print
 * file (MEASURED: what comes later covers what came before):
 *   the grey band (the background), the black field;
 *   the white lines: loopTop, loopLeft, loopRight, loopBottom, crossbarRight, crossbarLeft, stemTop,
 *     rightPost, rightPostT, leftPost, leftPostT, bottomLeftArm, bottomLeftT, topLeftBar, topRightBar,
 *     bottomLine, topLine, diagLeft;
 *   E8's yellow square, bottomRightArm, bottomRightT, E8's orange square, E7, E5, the yellow patches
 *     (over the top line), E6, E2, E3, diagLeftT, E1;
 *   the dashed circle (its 68 pieces); the five squares of the cross (centre, left, bottom, right,
 *   top); diagRight; the two halves of the start area; the side bands; diagRightT; E4; stemBottom
 *   (over the start area); the start logo's two chevrons; the MAKEX letters.
 * The screen's sensors read the picture instead (MAT_SENSOR_IMAGE_URL), which is the same drawing
 * with soft edges; field.test.ts measures how well the two agree.
 */
export const MAT_VECTOR: MatVector = {
  width: MAT_SIZE,
  height: MAT_SIZE,
  background: GREY,
  outside: TABLE,
  layers: [
    rect(BLACK_FIELD, BLACK),
    ...(['loopTop', 'loopLeft', 'loopRight', 'loopBottom', 'crossbarRight', 'crossbarLeft', 'stemTop', 'rightPost', 'rightPostT', 'leftPost', 'leftPostT', 'bottomLeftArm', 'bottomLeftT', 'topLeftBar', 'topRightBar', 'bottomLine', 'topLine'] as const).map(line),
    diagonal('diagLeft'),
    squareWarehouseLayers('E8')[0],
    line('bottomRightArm'),
    line('bottomRightT'),
    squareWarehouseLayers('E8')[1],
    ...warehouse('E7'),
    ...warehouse('E5'),
    rect(YELLOW_LINE_PATCHES.left, YELLOW),
    rect(YELLOW_LINE_PATCHES.right, YELLOW),
    ...warehouse('E6'),
    ...warehouse('E2'),
    ...warehouse('E3'),
    diagonal('diagLeftT'),
    ...warehouse('E1'),
    ...CIRCLE_PIECES.map(([from, to]): MatLayer => ({ kind: 'stroke', points: arcPoints(from, to), width: CIRCLE_STROKE, color: MAGENTA })),
    ...STORAGE_PRINT_ORDER.map((square) => rect(STORAGE_SQUARES[square], STORAGE_SQUARE_COLORS[square])),
    diagonal('diagRight'),
    rect(START_HALVES.blue, START_BLUE),
    rect(START_HALVES.red, START_RED),
    ...SIDE_BAND_IDS.map((id) => rect(SIDE_BANDS[id], SIDE_BAND_COLORS[id])),
    diagonal('diagRightT'),
    ...warehouse('E4'),
    line('stemBottom'),
    polygon([START_CHEVRONS.red], LOGO_RED),
    polygon([START_CHEVRONS.blue], LOGO_BLUE),
    polygon(MAKEX_OUTLINE_IDS.map((id) => MAKEX_OUTLINES[id]), LOGO_RED),
  ],
};
