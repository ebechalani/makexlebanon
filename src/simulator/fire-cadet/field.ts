/**
 * Fire Cadet - Rescue City: the map, as measured from the organiser's print file (the map report,
 * written 19 November from "Robo-Ville mTiny National 2027, 1250 mm"; every number below is from
 * its sections 1 and 3 or from its machine-readable twin, grid.json).
 *
 *   - the fixed places: the eight squares with a white dashed frame ("marked places") and the four
 *     squares of the Water / Equipment Area                                  PLACES, WATER_SQUARES
 *   - the squares where a drawn road passes under the middle or within 30 mm of it, where the
 *     practice maps put their obstacles                                                ROAD_SQUARES
 *   - the drawn stand-in of the mat, shown until the picture has loaded and used under Node
 *                                                                                       MAT_VECTOR
 *
 * Millimetres, origin at the top left corner of the mat, x to the right, y DOWN (core/geometry.ts).
 * A square is (column, row), both 0 to 6, (0,0) at the top left (numbers.ts: Square).
 *
 * Plain TypeScript, no DOM: it runs under Node too.
 */
import type { Rect } from '../core/geometry';
import type { MatLayer, MatVector, RGB } from '../core/types';
import { FIRE_CADET, gridBound, type Square } from './numbers';

/** The picture of the mat the stage shows: the whole page as printed, 2500 x 2500 px (2 px per mm). */
export const MAT_IMAGE_URL = '/simulator/fire-cadet/mat.webp';
/**
 * The picture the floor sensors would read: none. The mTiny of this game has no floor sensor, so no
 * second picture is loaded (core/types.ts: Game.mat.sensorImageUrl).
 */
export const MAT_SENSOR_IMAGE_URL = '';

/** The whole mat. */
export const MAT_RECT: Rect = { x: 0, y: 0, w: FIRE_CADET.MAT, h: FIRE_CADET.MAT };

// =============================================================================================
// The fixed places
// =============================================================================================

/** The eight squares with a white dashed frame (map report 1.4), and what each is. */
export type PlaceName = 'school' | 'stationTop' | 'factory' | 'house' | 'safeZone' | 'hospital' | 'bakery' | 'station';

/**
 * MEASURED, map report 1.4: the eight marked places. The robot starts in the Fire Station at the
 * bottom, D7, and that is where the Equipment goes back to and where the return bonus is earned;
 * the Fire Station at the top has no job (ORGANISER 1).
 */
export const PLACES: Readonly<Record<PlaceName, Square>> = {
  school: { col: 0, row: 0 },
  stationTop: { col: 3, row: 0 },
  factory: { col: 6, row: 0 },
  house: { col: 6, row: 2 },
  safeZone: { col: 3, row: 3 },
  hospital: { col: 0, row: 4 },
  bakery: { col: 6, row: 4 },
  station: { col: 3, row: 6 },
};

/** The marked places in the order of the map report (top left to bottom). */
export const PLACE_NAMES: readonly PlaceName[] = ['school', 'stationTop', 'factory', 'house', 'safeZone', 'hospital', 'bakery', 'station'];

/**
 * The name of each marked place in a sentence. The Fire Station at the bottom is "the Fire
 * Station"; where a sentence tells where an item belongs it says "the Fire Station at the bottom"
 * (game.ts), so it cannot be taken for the top one.
 */
export const PLACE_WORDS: Readonly<Record<PlaceName, string>> = {
  school: 'the School',
  stationTop: 'the top Fire Station',
  factory: 'the Factory',
  house: 'the House',
  safeZone: 'the Safe Zone',
  hospital: 'the Hospital',
  bakery: 'the Bakery',
  station: 'the Fire Station',
};

/** The square where the robot starts: the Fire Station at the bottom, D7 (ORGANISER 1). */
export const START_SQUARE: Square = PLACES.station;

/**
 * MEASURED, map report 3.4: the Water / Equipment Area has no dashed frame. Its label lies across
 * A6 and B6, and the drawing that goes with it (the pond, the pump, the hoses) covers A6, B6, A7 and
 * B7. The Water starts on one of these four (ASSUMPTION A13).
 */
export const WATER_SQUARES: readonly Square[] = [
  { col: 0, row: 5 },
  { col: 1, row: 5 },
  { col: 0, row: 6 },
  { col: 1, row: 6 },
];

/**
 * MEASURED, map report 3.2: the thirteen squares where a drawn road passes under the middle of
 * the square (class A: C3, D3, E3, B4, D5, F7) or within 30 mm of it (class B: C2, E2, C4, B5, F5,
 * G4, E7). The rules put the obstacles "on the roads" (l.90) and here an obstacle stands in the
 * middle of its square, so the practice maps put their obstacles only here. (The own setup allows
 * any square without a dashed frame: the official combinations are not known.)
 */
export const ROAD_SQUARES: readonly Square[] = [
  // class A: the middle is on a road
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 1, row: 3 },
  { col: 3, row: 4 },
  { col: 5, row: 6 },
  // class B: a wide road passes within 30 mm of the middle
  { col: 2, row: 1 },
  { col: 4, row: 1 },
  { col: 2, row: 3 },
  { col: 1, row: 4 },
  { col: 5, row: 4 },
  { col: 6, row: 3 },
  { col: 4, row: 6 },
];

export const sameSquare = (a: Square, b: Square): boolean => a.col === b.col && a.row === b.row;

/** Is the square on the map (column and row 0 to 6, whole numbers)? */
export function onMap(sq: Square): boolean {
  const n = FIRE_CADET.GRID_COUNT;
  return (
    sq !== null &&
    typeof sq === 'object' &&
    Number.isInteger(sq.col) &&
    Number.isInteger(sq.row) &&
    sq.col >= 0 &&
    sq.col < n &&
    sq.row >= 0 &&
    sq.row < n
  );
}

/** The marked place on this square, or null. */
export function placeAt(sq: Square): PlaceName | null {
  return PLACE_NAMES.find((name) => sameSquare(PLACES[name], sq)) ?? null;
}

/** Is this one of the four squares of the Water / Equipment Area? */
export const isWaterSquare = (sq: Square): boolean => WATER_SQUARES.some((w) => sameSquare(w, sq));

/** Is a drawn road under the middle of this square, or near it (ROAD_SQUARES)? */
export const isRoadSquare = (sq: Square): boolean => ROAD_SQUARES.some((r) => sameSquare(r, sq));

// =============================================================================================
// The drawn stand-in of the mat
// =============================================================================================

/** MEASURED, grid.json pictureMeanRgb: the mean colour of the whole picture. */
const PICTURE_MEAN: RGB = { r: 146, g: 150, b: 111 };
/** The table around the mat (the colour the other games use). */
const TABLE: RGB = { r: 120, g: 120, b: 120 };
/** MEASURED, map report 1.2: the print black of the lines as rendered (the other mats use it too). */
const PRINT_BLACK: RGB = { r: 35, g: 31, b: 32 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/**
 * MEASURED, grid.json cells[].meanRgb: the mean colour of each of the 49 squares of the picture,
 * row by row from the top, column by column from the left.
 */
const SQUARE_COLORS: readonly (readonly [number, number, number])[][] = [
  [[162, 166, 110], [166, 171, 128], [149, 169, 142], [175, 118, 121], [152, 167, 143], [157, 164, 139], [145, 155, 126]],
  [[168, 168, 100], [169, 164, 107], [153, 137, 115], [169, 131, 118], [153, 143, 120], [148, 144, 136], [159, 138, 118]],
  [[135, 167, 97], [128, 164, 109], [146, 136, 102], [157, 143, 118], [142, 133, 93], [139, 150, 106], [136, 148, 116]],
  [[156, 166, 87], [140, 142, 103], [146, 131, 108], [141, 162, 102], [144, 134, 113], [129, 146, 111], [135, 145, 89]],
  [[172, 181, 173], [147, 149, 128], [138, 145, 90], [137, 151, 89], [139, 146, 94], [136, 144, 114], [178, 139, 118]],
  [[147, 159, 124], [145, 153, 125], [122, 155, 99], [147, 141, 93], [130, 158, 107], [135, 152, 91], [124, 158, 91]],
  [[118, 171, 153], [132, 161, 110], [150, 127, 91], [174, 93, 92], [149, 136, 101], [128, 154, 80], [115, 154, 72]],
];

/**
 * MEASURED, map report 1.4 (exact, from the PDF vectors): the middle line of each white dashed
 * frame, [left, top, right, bottom] in mm. Every frame is 178.472 mm wide and 182.143 mm high (a
 * little higher than a square) and sits on its square within 3.4 mm.
 */
export const DASHED_FRAMES: Readonly<Record<PlaceName, readonly [number, number, number, number]>> = {
  school: [-0.38, -1.411, 178.092, 180.732],
  stationTop: [535.842, -1.192, 714.314, 180.951],
  factory: [1068.705, -1.192, 1247.178, 180.951],
  house: [1069.058, 356.764, 1247.531, 538.907],
  safeZone: [535.842, 535.031, 714.314, 717.174],
  hospital: [-0.38, 710.361, 178.092, 892.504],
  bakery: [1070.068, 710.714, 1248.541, 892.857],
  station: [535.486, 1068.569, 713.958, 1250.712],
};

/**
 * MEASURED, map report 1.5 (+-1 mm, on the picture): the eight white label boxes, [left, top,
 * right, bottom] in mm. Three of them are not in the square of their place (the art is drawn "from
 * above at a slant": a building's front and label are one row lower).
 */
export const LABEL_BOXES: readonly (readonly [number, number, number, number])[] = [
  [539.3, 283.6, 693.1, 312.2], // FIRE STATION (in D2)
  [913.7, 310.0, 1024.2, 339.1], // FACTORY (in F2)
  [122.1, 310.0, 224.3, 339.1], // SCHOOL (across A2 and B2)
  [1125.5, 503.2, 1213.2, 531.8], // HOUSE
  [552.6, 649.4, 680.0, 677.8], // SAFE ZONE
  [48.3, 836.5, 172.4, 866.5], // HOSPITAL
  [1127.4, 854.8, 1223.7, 883.4], // BAKERY
  [19.2, 941.2, 306.2, 971.1], // WATER / EQUIPMENT AREA (across A6 and B6)
];

/** MEASURED, map report 1.6 (exact): the white rectangle under the organiser's logo, in G7. */
export const LOGO_BOX: readonly [number, number, number, number] = [1082.72, 1192.675, 1235.183, 1237.653];

const box = ([x0, y0, x1, y1]: readonly [number, number, number, number]): Rect => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });

/** The part of a rectangle that lies on the mat, or null when none does. */
function onTheMat(r: Rect): Rect | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(FIRE_CADET.MAT, r.x + r.w);
  const y1 = Math.min(FIRE_CADET.MAT, r.y + r.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * The 20 white rectangles of one dashed frame, cut at the edge of the mat. MEASURED, map report
 * 1.4 (exact): every side is drawn "corner arm, gap, dash, gap, dash, gap, corner arm", the arms
 * 1/12 of the side long and the gaps and dashes 1/6; the stroke is GRID_LINE_WIDTH wide with plain
 * ends and square corners. So each side gives two arms and two dashes, and each corner one small
 * square: 4 x 4 + 4 = 20 rectangles. (Painted white, they reproduce the print file; the test
 * compares those of the School with grid.json's rectsMm.)
 */
export function dashedFrameRects(frame: readonly [number, number, number, number]): Rect[] {
  const [left, top, right, bottom] = frame;
  const s = FIRE_CADET.GRID_LINE_WIDTH;
  const w = right - left;
  const h = bottom - top;
  const out: Rect[] = [];
  // the pieces along a side, as fractions of its length: two corner arms and two dashes
  const pieces: [number, number][] = [
    [0, 1 / 12],
    [3 / 12, 5 / 12],
    [7 / 12, 9 / 12],
    [11 / 12, 1],
  ];
  for (const [a, b] of pieces) {
    out.push({ x: left + a * w, y: top - s / 2, w: (b - a) * w, h: s }); // top side
    out.push({ x: left + a * w, y: bottom - s / 2, w: (b - a) * w, h: s }); // bottom side
    out.push({ x: left - s / 2, y: top + a * h, w: s, h: (b - a) * h }); // left side
    out.push({ x: right - s / 2, y: top + a * h, w: s, h: (b - a) * h }); // right side
  }
  for (const x of [left, right]) for (const y of [top, bottom]) out.push({ x: x - s / 2, y: y - s / 2, w: s, h: s });
  return out.map(onTheMat).filter((r): r is Rect => r !== null);
}

/** The 12 black lines of the grid (6 down, 6 across), each GRID_LINE_WIDTH wide, edge to edge. */
export function gridLineRects(): Rect[] {
  const s = FIRE_CADET.GRID_LINE_WIDTH;
  const out: Rect[] = [];
  for (let k = 1; k < FIRE_CADET.GRID_COUNT; k++) out.push({ x: gridBound(k) - s / 2, y: 0, w: s, h: FIRE_CADET.MAT });
  for (let k = 1; k < FIRE_CADET.GRID_COUNT; k++) out.push({ x: 0, y: gridBound(k) - s / 2, w: FIRE_CADET.MAT, h: s });
  return out;
}

const rgb = ([r, g, b]: readonly [number, number, number]): RGB => ({ r, g, b });
const rectLayer = (rect: Rect, color: RGB): MatLayer => ({ kind: 'rect', rect, color });

/**
 * The drawn stand-in of the mat (8.2 of the design): it is shown until the picture has loaded, and
 * it is the mat under Node. Nothing reads its colours (the mTiny has no floor sensor here), so it is
 * only as exact as a picture of a picture needs to be: 49 flat squares in their mean colours, the
 * 8 white label boxes, the 12 black lines, the 8 dashed frames (160 white rectangles) and the white
 * box of the logo - 230 rectangles.
 */
export const MAT_VECTOR: MatVector = {
  width: FIRE_CADET.MAT,
  height: FIRE_CADET.MAT,
  background: PICTURE_MEAN,
  outside: TABLE,
  layers: [
    ...SQUARE_COLORS.flatMap((line, row) =>
      line.map((color, col) => {
        const x = gridBound(col);
        const y = gridBound(row);
        return rectLayer({ x, y, w: gridBound(col + 1) - x, h: gridBound(row + 1) - y }, rgb(color));
      }),
    ),
    ...LABEL_BOXES.map((b) => rectLayer(box(b), WHITE)),
    ...gridLineRects().map((r) => rectLayer(r, PRINT_BLACK)),
    ...PLACE_NAMES.flatMap((name) => dashedFrameRects(DASHED_FRAMES[name]).map((r) => rectLayer(r, WHITE))),
    rectLayer(box(LOGO_BOX), WHITE),
  ],
};
