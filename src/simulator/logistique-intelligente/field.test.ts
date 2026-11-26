/**
 * The Logistique intelligente field: its numbers against the measurement of the print file
 * (map/field-data.json of the design's measurement, held below), the vector mat painted in the
 * print file's order, what the floor sensors read on each colour of the mat (the design's table
 * 2.3), how well the vector mat and the sensor picture agree, the robot in the start area.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classifyColor, lightOf, makeProbeReading } from '../core/engine-sensors';
import { obbCorners, rectContainsOBB, type Rect, type Vec2 } from '../core/geometry';
import { RasterMatSampler, VectorMatSampler } from '../core/mat';
import { robotFitsInRect, robotShapesAt } from '../core/robot';
import type { MatLayer, MatSampler, RGB } from '../core/types';
import { WAREHOUSE_SORT_ROBOT, robotReach } from '../warehouse-sort/robot';
import {
  ARENA,
  ARENA_SIZE,
  BAND_BLUE,
  BAND_RED,
  BLACK,
  BLACK_FIELD,
  CIRCLE_CENTRE,
  CIRCLE_PIECES,
  CIRCLE_RADIUS,
  CIRCLE_STROKE,
  CUBE_MASS,
  CUBE_SIZE,
  DIAGONALS,
  FRAME_HEIGHT,
  FRAME_THICKNESS,
  GREY,
  GREY_BAND,
  LINE_WIDTH,
  LOGO_BLUE,
  LOGO_RED,
  MAGENTA,
  MAKEX_OUTLINE_IDS,
  MAKEX_OUTLINES,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  ORANGE,
  SIDE_BAND_IDS,
  SIDE_BANDS,
  START_AREA,
  START_BLUE,
  START_CHEVRONS,
  START_HALVES,
  START_LINE_X,
  START_RED,
  STORAGE_BOX,
  STORAGE_CENTRE,
  STORAGE_OUTLINE,
  STORAGE_SQUARE_COLORS,
  STORAGE_SQUARE_IDS,
  STORAGE_SQUARE_SIZE,
  STORAGE_SQUARES,
  WAREHOUSE_BORDER,
  WAREHOUSE_IDS,
  WAREHOUSE_ORANGE_SIZE,
  WAREHOUSE_SIZE,
  WAREHOUSES,
  WHITE,
  WHITE_LINES,
  YELLOW,
  YELLOW_LINE_PATCHES,
  inStorage,
  storageSquareCentre,
  warehouseBox,
  warehouseCorners,
  warehouseFrame,
  type StorageSquare,
  type WarehouseId,
  type WhiteLineId,
} from './field';
import { LOGISTIQUE_ROBOT, START_HEADING, START_POSE, startPoseFor } from './robot';

const near = (actual: number, expected: number, tolerance: number, what: string): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not ${expected} (within ${tolerance})`);
};

// =============================================================================================
// The measurement of the print file (the design's map/field-data.json), as it was measured
// =============================================================================================

/*
 * The numbers of map/field-data.json the field is checked against, copied out of it by a script
 * (mm; origin at the arena's top-left inner corner, +y down; rects as x, y, w, h; points as [x, y];
 * angles in degrees from +x towards +y). field.ts writes them out by hand, with their sources; this
 * copy is the measurement itself.
 */
// sha256 of map/field-data.json: 424f3c3b86c57b10c90b8120fa4cba1d417b1590ee6a5f5a8da7f02df84abde4
// prettier-ignore
const FIELD_DATA = {
  ARENA_SIZE: 1200,
  BLACK_FIELD: { x: 5, y: 5, w: 1190, h: 1190 },
  FRAME_BAND_VISIBLE: 5,
  COLORS: {
    grey: [145, 143, 143],
    black: [35, 31, 32],
    white: [255, 255, 255],
    yellow: [255, 242, 0],
    orange: [247, 152, 15],
    startBlue: [74, 139, 209],
    startRed: [239, 43, 62],
    bandBlue: [80, 110, 191],
    bandRed: [166, 51, 70],
    circleMagenta: [236, 0, 140],
    logoRed: [255, 51, 51],
    logoBlue: [0, 153, 255],
  },
  SIDE_BANDS: {
    leftBlue: { x: 4.086, y: 5, w: 11.5, h: 1190 },
    topLeftBlue: { x: 15.586, y: 5, w: 459, h: 14 },
    bottomLeftBlue: { x: 15.586, y: 1108, w: 459, h: 87 },
    rightRed: { x: 1184.411, y: 5, w: 11.5, h: 1190 },
    topRightRed: { x: 736.911, y: 5, w: 459, h: 14 },
    bottomRightRed: { x: 725.411, y: 1108, w: 459, h: 87 },
  },
  LINE_WIDTH: 25,
  WHITE_LINES: {
    topLine: { x: 297.5, y: 292.5, w: 605, h: 25 },
    stemTop: { x: 587.5, y: 317.5, w: 25, h: 122.5 },
    loopTop: { x: 438, y: 440, w: 324, h: 25 },
    loopLeft: { x: 438, y: 440, w: 25, h: 324 },
    loopRight: { x: 737, y: 440, w: 25, h: 324 },
    loopBottom: { x: 438, y: 739, w: 324, h: 25 },
    crossbarLeft: { x: 403, y: 589.5, w: 95, h: 25 },
    crossbarRight: { x: 702, y: 589.5, w: 95, h: 25 },
    stemBottom: { x: 587.5, y: 762, w: 25, h: 231 },
    bottomLine: { x: 108.5, y: 823, w: 983, h: 25 },
    leftPost: { x: 208, y: 515.5, w: 25, h: 307.5 },
    leftPostT: { x: 173, y: 490.5, w: 95, h: 25 },
    rightPost: { x: 967, y: 515.5, w: 25, h: 307.5 },
    rightPostT: { x: 932, y: 490.5, w: 95, h: 25 },
    bottomLeftArm: { x: 182, y: 972.75, w: 169.5, h: 25 },
    bottomLeftT: { x: 157, y: 938, w: 25, h: 94.5 },
    bottomRightArm: { x: 848.5, y: 972.75, w: 169.5, h: 25 },
    bottomRightT: { x: 1018, y: 938, w: 25, h: 94.5 },
    topLeftBar: { x: 337.5, y: 150.623, w: 94.5, h: 25 },
    topRightBar: { x: 766.25, y: 150.35, w: 94.5, h: 25 },
  },
  WHITE_DIAGONALS: {
    diagLeft: [[297.499, 317.5], [315.177, 299.822], [165.978, 150.623], [148.3, 168.3]],
    diagLeftT: [[106.077, 175.099], [123.755, 192.776], [190.576, 125.955], [172.899, 108.277]],
    diagRight: [[902.478, 317.5], [884.8, 299.822], [1033.999, 150.623], [1051.677, 168.3]],
    diagRightT: [[1094.123, 175.099], [1076.445, 192.776], [1009.624, 125.955], [1027.301, 108.277]],
  },
  YELLOW_LINE_PATCHES: { left: { x: 341.75, y: 292.5, w: 86, h: 25 }, right: { x: 770.5, y: 292.5, w: 86, h: 25 } },
  WAREHOUSE_SIZE: 40, WAREHOUSE_ORANGE_SIZE: 38, WAREHOUSE_BORDER: 1,
  WAREHOUSES: {
    W1: { centre: [69.484, 71.684], rotation: 45, yellow: [[69.484, 99.969], [97.769, 71.684], [69.484, 43.4], [41.2, 71.684]], orange: [[69.484, 98.554], [96.354, 71.684], [69.484, 44.814], [42.614, 71.684]] },
    W2: { centre: [384.66, 51.1], rotation: 0, yellow: [[364.66, 71.1], [404.66, 71.1], [404.66, 31.1], [364.66, 31.1]], orange: [[365.66, 70.1], [403.66, 70.1], [403.66, 32.1], [365.66, 32.1]] },
    W3: { centre: [813.41, 51.1], rotation: 0, yellow: [[793.41, 71.1], [833.41, 71.1], [833.41, 31.1], [793.41, 31.1]], orange: [[794.41, 70.1], [832.41, 70.1], [832.41, 32.1], [794.41, 32.1]] },
    W4: { centre: [1130.716, 71.684], rotation: 45, yellow: [[1130.716, 99.969], [1102.431, 71.684], [1130.716, 43.4], [1159, 71.684]], orange: [[1130.716, 98.554], [1103.846, 71.684], [1130.716, 44.814], [1157.586, 71.684]] },
    W5: { centre: [220.5, 391], rotation: 0, yellow: [[200.5, 411], [240.5, 411], [240.5, 371], [200.5, 371]], orange: [[201.5, 410], [239.5, 410], [239.5, 372], [201.5, 372]] },
    W6: { centre: [979.5, 391], rotation: 0, yellow: [[959.5, 411], [999.5, 411], [999.5, 371], [959.5, 371]], orange: [[960.5, 410], [998.5, 410], [998.5, 372], [960.5, 372]] },
    W7: { centre: [57.5, 985.25], rotation: 0, yellow: [[37.5, 1005.25], [77.5, 1005.25], [77.5, 965.25], [37.5, 965.25]], orange: [[38.5, 1004.25], [76.5, 1004.25], [76.5, 966.25], [38.5, 966.25]] },
    W8: { centre: [1142.5, 985.25], rotation: 0, yellow: [[1122.5, 1005.25], [1162.5, 1005.25], [1162.5, 965.25], [1122.5, 965.25]], orange: [[1123.5, 1004.25], [1161.5, 1004.25], [1161.5, 966.25], [1123.5, 966.25]] },
  },
  STORAGE: { centre: [600, 602], size: 50, bbox: { x: 525, y: 527, w: 150, h: 150 },
    squares: { centre: { x: 575, y: 577, w: 50, h: 50 }, left: { x: 525, y: 577, w: 50, h: 50 }, bottom: { x: 575, y: 627, w: 50, h: 50 }, right: { x: 625, y: 577, w: 50, h: 50 }, top: { x: 575, y: 527, w: 50, h: 50 } },
    colors: { centre: 'yellow', left: 'orange', right: 'orange', top: 'orange', bottom: 'orange' } },
  CIRCLE: { centre: [600, 602], radius: 90.505, stroke: 1, dash: [4.182, 4.182],
    painted: [
      [3.968, 6.615, 4.182], [9.263, 11.91, 4.182], [14.557, 17.203, 4.182], [19.85, 22.497, 4.182], [25.144, 27.791, 4.182], [30.438, 33.085, 4.182], [35.732, 38.38, 4.182], [41.027, 43.675, 4.182],
      [46.322, 48.97, 4.182], [51.617, 54.265, 4.182], [56.912, 59.559, 4.182], [62.206, 64.853, 4.182], [67.5, 70.147, 4.182], [72.794, 75.44, 4.182], [78.087, 80.734, 4.182], [83.382, 86.029, 4.182],
      [88.676, 91.324, 4.182], [93.968, 96.615, 4.182], [99.263, 101.91, 4.182], [104.557, 107.203, 4.182], [109.85, 112.497, 4.182], [115.144, 117.791, 4.182], [120.438, 123.085, 4.182], [125.732, 128.38, 4.182],
      [131.027, 133.675, 4.182], [136.322, 138.97, 4.182], [141.617, 144.265, 4.182], [146.912, 149.559, 4.182], [152.206, 154.853, 4.182], [157.5, 160.147, 4.182], [162.794, 165.44, 4.182], [168.087, 170.734, 4.182],
      [173.382, 176.029, 4.182], [178.676, 181.324, 4.182], [183.968, 186.615, 4.182], [189.263, 191.91, 4.182], [194.557, 197.204, 4.182], [199.85, 202.497, 4.182], [205.144, 207.791, 4.182], [210.438, 213.085, 4.182],
      [215.732, 218.38, 4.182], [221.027, 223.675, 4.182], [226.322, 228.97, 4.182], [231.617, 234.265, 4.182], [236.912, 239.559, 4.182], [242.206, 244.853, 4.182], [247.5, 250.147, 4.182], [252.794, 255.44, 4.182],
      [258.087, 260.734, 4.182], [263.382, 266.029, 4.182], [268.676, 271.324, 4.182], [273.968, 276.615, 4.182], [279.263, 281.91, 4.182], [284.557, 287.203, 4.182], [289.85, 292.497, 4.182], [295.144, 297.791, 4.182],
      [300.438, 303.085, 4.182], [305.732, 308.38, 4.182], [311.027, 313.675, 4.182], [316.322, 318.97, 4.182], [321.617, 324.265, 4.182], [326.912, 329.559, 4.182], [332.206, 334.853, 4.182], [337.5, 340.147, 4.182],
      [342.794, 345.44, 4.182], [348.087, 350.734, 4.182], [353.382, 356.029, 4.182], [358.676, 361.324, 4.182],
    ] },
  START_AREA: { blue: { x: 476, y: 950, w: 124, h: 245 }, red: { x: 600, y: 950, w: 124, h: 245 }, toFrame: { x: 476, y: 950, w: 248, h: 250 }, redChevron: [[499.247, 1014.927], [564.017, 1014.927], [592.804, 1043.714], [592.804, 1101.287], [564.017, 1130.074], [499.247, 1130.074], [556.82, 1072.5]], blueChevron: [[700.754, 1014.927], [635.984, 1014.927], [607.197, 1043.714], [607.197, 1101.287], [635.984, 1130.074], [700.754, 1130.074], [643.181, 1072.5]] },
  MAKEX: {
    M: { hole: false, outline: [[442.044, 75.407], [442.328, 75.305], [463.774, 75.314], [463.936, 75.549], [471.727, 97.559], [472.663, 100.899], [473.021, 99.252], [480.935, 75.972], [481.27, 75.302], [503.421, 75.313], [503.526, 75.407], [503.526, 115.76], [503.28, 115.837], [490.159, 115.837], [490.074, 115.76], [490.088, 92.056], [490.387, 88.388], [490.885, 85.143], [490.723, 85.044], [490.554, 85.284], [489.608, 88.388], [488.079, 92.621], [479.012, 115.821], [465.467, 115.837], [465.317, 115.76], [456.954, 93.044], [455.394, 88.388], [454.485, 85.143], [454.321, 85.061], [454.255, 85.143], [454.648, 87.824], [454.809, 91.069], [454.81, 115.76], [454.603, 115.837], [442.328, 115.837], [442.046, 115.762]] },
    A: { hole: false, outline: [[526.351, 75.407], [526.561, 75.3], [545.326, 75.302], [545.561, 75.407], [564.433, 115.76], [564.233, 115.837], [548.712, 115.813], [545.608, 108.318], [545.326, 108.121], [526.561, 108.115], [526.334, 108.423], [523.316, 115.795], [507.654, 115.837], [507.506, 115.76]] },
    A_hole: { hole: true, outline: [[536.014, 83.62], [535.835, 83.873], [534.764, 87.259], [533.066, 91.915], [530.09, 99.252], [530.229, 99.324], [541.899, 99.252], [538.332, 90.363]] },
    K: { hole: false, outline: [[568.404, 75.407], [568.607, 75.301], [582.998, 75.298], [583.139, 75.388], [583.145, 91.351], [583.28, 91.426], [600.635, 75.327], [618.13, 75.338], [617.989, 75.585], [600.811, 91.351], [618.796, 115.76], [618.695, 115.836], [602.046, 115.818], [590.228, 99.958], [589.771, 99.478], [583.169, 105.743], [583.139, 115.775], [568.466, 115.815]] },
    E: { hole: false, outline: [[624.717, 75.407], [624.903, 75.3], [667.231, 75.313], [667.314, 75.407], [667.316, 84.861], [667.231, 85.134], [639.577, 85.131], [639.408, 85.284], [639.408, 90.646], [639.577, 90.877], [666.243, 90.853], [666.343, 91.069], [666.342, 99.817], [666.243, 99.919], [639.577, 99.901], [639.408, 100.099], [639.408, 105.884], [639.577, 105.985], [667.654, 105.988], [667.743, 106.166], [667.737, 115.76], [667.513, 115.837], [624.762, 115.806]] },
    X_left: { hole: false, outline: [[679.038, 73.15], [679.224, 73.052], [704.339, 73.057], [715.657, 84.296], [715.698, 106.73], [704.339, 118.087], [679.02, 118.018], [701.464, 95.584]] },
    X_right: { hole: false, outline: [[732.455, 73.15], [732.698, 73.054], [757.672, 73.054], [757.891, 73.15], [735.464, 95.584], [757.918, 118.018], [732.557, 118.074], [721.328, 106.871], [721.312, 84.296]] },
  },
  LAYERS: [
    'grey frame band (MAT_BLEED)',
    'black field (BLACK_FIELD)',
    'white lines in this print order: loopTop, loopLeft, loopRight, loopBottom, crossbarRight, crossbarLeft, stemTop, rightPost, rightPostT, leftPost, leftPostT, bottomLeftArm, bottomLeftT, topLeftBar, topRightBar, bottomLine, topLine, diagLeft',
    'W8 yellow, bottomRightArm, bottomRightT, W8 orange, W7, W5, yellow line patches (over topLine), W6, W2, W3, diagLeftT, W1',
    'dashed circle',
    'storage squares (centre, left, bottom, right, top)',
    'diagRight',
    'start area halves (blue, red)',
    'side bands (bottomRightRed, bottomLeftBlue, topLeftBlue, topRightRed, leftBlue, rightRed)',
    'diagRightT',
    'W4',
    'stemBottom (over the start area halves)',
    'starting-area logo picture',
    'MAKEX logo picture',
  ],
} as const;

const rgb = (c: readonly [number, number, number]): RGB => ({ r: c[0], g: c[1], b: c[2] });
const asPoints = (lst: readonly (readonly [number, number])[]): Vec2[] => lst.map(([x, y]) => ({ x, y }));
/** W1 - W8 of the measurement are E1 - E8 here. */
const W_OF: Record<WarehouseId, keyof typeof FIELD_DATA.WAREHOUSES> = { E1: 'W1', E2: 'W2', E3: 'W3', E4: 'W4', E5: 'W5', E6: 'W6', E7: 'W7', E8: 'W8' };
/** The squares of the cross as the measurement names them. */
const SQUARE_OF: Record<StorageSquare, keyof typeof FIELD_DATA.STORAGE.squares> = { haut: 'top', gauche: 'left', centre: 'centre', droite: 'right', bas: 'bottom' };

/** The same corners, in any order and starting anywhere, to `tolerance` mm. */
function samePolygon(actual: readonly Vec2[], expected: readonly Vec2[], tolerance: number, what: string): void {
  assert.equal(actual.length, expected.length, `${what}: corners`);
  for (const e of expected) assert.ok(actual.some((a) => Math.abs(a.x - e.x) <= tolerance && Math.abs(a.y - e.y) <= tolerance), `${what}: no corner at ${e.x}, ${e.y}`);
}

// =============================================================================================
// The arena, the frame, the colours
// =============================================================================================

test('field: the arena is 1200 mm square, inside the frame; 5 mm of the grey band show inside it; the black field is 1190 mm', () => {
  assert.equal(ARENA_SIZE, FIELD_DATA.ARENA_SIZE);
  assert.equal(MAT_SIZE, 1200);
  assert.deepEqual(ARENA, { x: 0, y: 0, w: 1200, h: 1200 });
  assert.equal(GREY_BAND, FIELD_DATA.FRAME_BAND_VISIBLE);
  assert.deepEqual(BLACK_FIELD, FIELD_DATA.BLACK_FIELD);
  assert.deepEqual(BLACK_FIELD, { x: GREY_BAND, y: GREY_BAND, w: ARENA_SIZE - 2 * GREY_BAND, h: ARENA_SIZE - 2 * GREY_BAND });
  // the frame (an assumption: 50 mm high) and how thick it is drawn
  assert.equal(FRAME_HEIGHT, 50);
  assert.equal(FRAME_THICKNESS, 20);
  assert.equal(MAT_IMAGE_URL, '/simulator/logistique-intelligente/mat.webp');
  assert.equal(MAT_SENSOR_IMAGE_URL, '/simulator/logistique-intelligente/mat-sensor.webp');
});

test('field: the colours are those of the print', () => {
  const c = FIELD_DATA.COLORS;
  assert.deepEqual(GREY, rgb(c.grey));
  assert.deepEqual(BLACK, rgb(c.black));
  assert.deepEqual(WHITE, rgb(c.white));
  assert.deepEqual(YELLOW, rgb(c.yellow));
  assert.deepEqual(ORANGE, rgb(c.orange));
  assert.deepEqual(START_BLUE, rgb(c.startBlue));
  assert.deepEqual(START_RED, rgb(c.startRed));
  assert.deepEqual(BAND_BLUE, rgb(c.bandBlue));
  assert.deepEqual(BAND_RED, rgb(c.bandRed));
  assert.deepEqual(MAGENTA, rgb(c.circleMagenta));
  assert.deepEqual(LOGO_RED, rgb(c.logoRed));
  assert.deepEqual(LOGO_BLUE, rgb(c.logoBlue));
  // the same black, white, yellow and orange as Warehouse Sort's mat
  assert.deepEqual([BLACK, WHITE, YELLOW, ORANGE], [{ r: 35, g: 31, b: 32 }, { r: 255, g: 255, b: 255 }, { r: 255, g: 242, b: 0 }, { r: 247, g: 152, b: 15 }]);
});

// =============================================================================================
// The lines, the bands, the warehouses, the cross, the circle, the start area, the letters
// =============================================================================================

test('field: the white lines, the diagonals, the yellow patches and the side bands are where the print has them', () => {
  assert.equal(LINE_WIDTH, FIELD_DATA.LINE_WIDTH);
  assert.deepEqual(Object.keys(WHITE_LINES).sort(), Object.keys(FIELD_DATA.WHITE_LINES).sort());
  for (const id of Object.keys(WHITE_LINES) as WhiteLineId[]) {
    assert.deepEqual(WHITE_LINES[id], FIELD_DATA.WHITE_LINES[id], id);
    // every straight line is 25 mm wide
    assert.equal(Math.min(WHITE_LINES[id].w, WHITE_LINES[id].h), LINE_WIDTH, id);
  }
  for (const id of ['diagLeft', 'diagLeftT', 'diagRight', 'diagRightT'] as const) assert.deepEqual(DIAGONALS[id], asPoints(FIELD_DATA.WHITE_DIAGONALS[id]), id);
  assert.deepEqual(YELLOW_LINE_PATCHES, FIELD_DATA.YELLOW_LINE_PATCHES);
  // the patches lie on the top line, as wide as it
  for (const side of ['left', 'right'] as const) {
    assert.equal(YELLOW_LINE_PATCHES[side].y, WHITE_LINES.topLine.y);
    assert.equal(YELLOW_LINE_PATCHES[side].h, WHITE_LINES.topLine.h);
  }
  assert.deepEqual(SIDE_BAND_IDS.slice().sort(), Object.keys(FIELD_DATA.SIDE_BANDS).sort());
  for (const id of SIDE_BAND_IDS) assert.deepEqual(SIDE_BANDS[id], FIELD_DATA.SIDE_BANDS[id], id);
  // the stem into the start area: its middle is x 600, it ends 43 mm inside the start area
  assert.equal(START_LINE_X, 600);
  assert.equal(WHITE_LINES.stemBottom.y + WHITE_LINES.stemBottom.h - START_AREA.y, 43);
});

test('warehouses: E1 - E8 are the eight 40 mm squares of the mat in reading order (W1 - W8), a 38 mm orange square on a yellow one; E1 and E4 are diamonds', () => {
  assert.deepEqual(WAREHOUSE_IDS, ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']);
  assert.equal(WAREHOUSE_SIZE, FIELD_DATA.WAREHOUSE_SIZE);
  assert.equal(WAREHOUSE_ORANGE_SIZE, FIELD_DATA.WAREHOUSE_ORANGE_SIZE);
  assert.equal(WAREHOUSE_BORDER, FIELD_DATA.WAREHOUSE_BORDER);
  for (const id of WAREHOUSE_IDS) {
    const measured = FIELD_DATA.WAREHOUSES[W_OF[id]];
    assert.deepEqual(WAREHOUSES[id].centre, { x: measured.centre[0], y: measured.centre[1] }, id);
    assert.equal(WAREHOUSES[id].turnedDeg, measured.rotation, id);
    // the corners, worked out from the middle and the turn: the measured ones to 0.001 mm (the measurement rounds to 0.001)
    samePolygon(warehouseCorners(id), asPoints(measured.yellow), 0.0011, `${id} yellow`);
    samePolygon(warehouseCorners(id, WAREHOUSE_ORANGE_SIZE), asPoints(measured.orange), 0.0011, `${id} orange`);
    const b = warehouseBox(id);
    assert.deepEqual([b.x, b.y, b.w, b.l], [measured.centre[0], measured.centre[1], 40, 40], id);
    near(b.angle, (measured.rotation * Math.PI) / 180, 1e-12, `${id} angle`);
    samePolygon(obbCorners(b), warehouseCorners(id), 1e-9, `${id} box`);
  }
  // reading order: the top row from left to right (E1 - E4), then E5 / E6, then E7 / E8
  const ys = WAREHOUSE_IDS.map((id) => WAREHOUSES[id].centre.y);
  assert.ok(ys[0] > ys[1] && ys[3] > ys[2] && Math.max(...ys.slice(0, 4)) < ys[4] && ys[4] === ys[5] && ys[5] < ys[6] && ys[6] === ys[7]);
  // a diamond is 56.57 mm across: wider than a cube
  near(warehouseFrame('E1').w, 40 * Math.SQRT2, 1e-9, 'E1 across');
  near(warehouseFrame('E4').h, 40 * Math.SQRT2, 1e-9, 'E4 high');
  assert.ok(warehouseFrame('E1').w > CUBE_SIZE);
  assert.deepEqual(warehouseFrame('E5'), { x: 200.5, y: 371, w: 40, h: 40 });
  // every warehouse lies wholly inside the black field
  for (const id of WAREHOUSE_IDS) assert.ok(rectContainsOBB(BLACK_FIELD, warehouseBox(id)), id);
});

test('storage: five 50 mm squares in a cross round (600, 602) - the centre one yellow, the four round it orange; its outline has twelve corners', () => {
  const s = FIELD_DATA.STORAGE;
  assert.deepEqual(STORAGE_CENTRE, { x: s.centre[0], y: s.centre[1] });
  assert.equal(STORAGE_SQUARE_SIZE, s.size);
  assert.deepEqual(STORAGE_BOX, s.bbox);
  assert.deepEqual(STORAGE_SQUARE_IDS, ['haut', 'gauche', 'centre', 'droite', 'bas']);
  for (const square of STORAGE_SQUARE_IDS) {
    assert.deepEqual(STORAGE_SQUARES[square], s.squares[SQUARE_OF[square]], square);
    assert.deepEqual(STORAGE_SQUARE_COLORS[square], s.colors[SQUARE_OF[square]] === 'yellow' ? YELLOW : ORANGE, square);
  }
  assert.deepEqual(storageSquareCentre('haut'), { x: 600, y: 552 });
  assert.deepEqual(storageSquareCentre('gauche'), { x: 550, y: 602 });
  assert.deepEqual(storageSquareCentre('centre'), { x: 600, y: 602 });
  assert.deepEqual(storageSquareCentre('droite'), { x: 650, y: 602 });
  assert.deepEqual(storageSquareCentre('bas'), { x: 600, y: 652 });
  // the outline: twelve corners, each a corner of a square, each side 50 mm, square turns only
  assert.equal(STORAGE_OUTLINE.length, 12);
  for (let i = 0; i < 12; i++) {
    const a = STORAGE_OUTLINE[i];
    const b = STORAGE_OUTLINE[(i + 1) % 12];
    assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 50, `side ${i}`);
    assert.ok(STORAGE_SQUARE_IDS.some((q) => { const r = STORAGE_SQUARES[q]; return [r.x, r.x + r.w].includes(a.x) && [r.y, r.y + r.h].includes(a.y); }), `corner ${i}`);
  }
  // inside the cross: on a square (its edge too); the corners between the arms are not
  for (const [x, y, inside] of [[600, 602, true], [526, 602, true], [600, 528, true], [675, 627, true], [530, 532, false], [670, 672, false], [600, 690, false]] as const) assert.equal(inStorage({ x, y }), inside, `${x}, ${y}`);
});

test('circle: the dashed magenta circle round the cross is its 68 painted pieces of 4.18 mm, as printed', () => {
  const c = FIELD_DATA.CIRCLE;
  assert.deepEqual(CIRCLE_CENTRE, { x: c.centre[0], y: c.centre[1] });
  assert.equal(CIRCLE_RADIUS, c.radius);
  assert.equal(CIRCLE_STROKE, c.stroke);
  assert.deepEqual(CIRCLE_PIECES, c.painted.map(([from, to]) => [from, to]));
  assert.equal(CIRCLE_PIECES.length, 68);
  for (const [from, to] of CIRCLE_PIECES) near(((to - from) * Math.PI * CIRCLE_RADIUS) / 180, 4.182, 0.003, `piece ${from}`);
  // it does not touch the cross: the cross's corners are 79.06 mm from its middle, its inner edge 90.0
  near(Math.hypot(25, 75), 79.06, 0.005, 'the farthest corner of the cross');
  assert.ok(Math.hypot(25, 75) < CIRCLE_RADIUS - CIRCLE_STROKE / 2);
});

test('start area: 248 x 250 mm from the print to the frame, a blue half and a red half, the two chevrons of the logo', () => {
  const s = FIELD_DATA.START_AREA;
  assert.deepEqual(START_AREA, s.toFrame);
  assert.deepEqual(START_AREA, { x: 476, y: 950, w: 248, h: 250 });
  assert.equal(START_AREA.y + START_AREA.h, ARENA_SIZE);
  assert.deepEqual(START_HALVES.blue, s.blue);
  assert.deepEqual(START_HALVES.red, s.red);
  assert.deepEqual(START_CHEVRONS.red, asPoints(s.redChevron));
  assert.deepEqual(START_CHEVRONS.blue, asPoints(s.blueChevron));
});

test('MAKEX: the five red letters (the X in two halves) and the hole of the A, as traced from the picture', () => {
  assert.deepEqual(MAKEX_OUTLINE_IDS, Object.keys(FIELD_DATA.MAKEX));
  for (const id of MAKEX_OUTLINE_IDS) {
    assert.deepEqual(MAKEX_OUTLINES[id], asPoints(FIELD_DATA.MAKEX[id].outline), id);
    assert.equal(FIELD_DATA.MAKEX[id].hole, id === 'A_hole', id);
  }
});

// =============================================================================================
// The vector mat, layer by layer, in the order of the print file
// =============================================================================================

/** A layer in a few words: its kind, its colour and the box round it (to 0.001 mm). */
function describeLayer(layer: MatLayer): string {
  const r3 = (v: number): number => Math.round(v * 1000) / 1000 + 0;
  const colour = `${layer.color.r},${layer.color.g},${layer.color.b}`;
  if (layer.kind === 'rect') return `rect ${colour} ${r3(layer.rect.x)},${r3(layer.rect.y)},${r3(layer.rect.w)},${r3(layer.rect.h)}`;
  const points = layer.kind === 'stroke' ? layer.points : layer.contours.flat();
  const xs = points.map((q) => q.x);
  const ys = points.map((q) => q.y);
  const extra = layer.kind === 'stroke' ? ` w${layer.width}${layer.dash ? ' dashed' : ''}` : ` ${layer.contours.length}`;
  return `${layer.kind} ${colour} ${r3(Math.min(...xs))},${r3(Math.min(...ys))},${r3(Math.max(...xs))},${r3(Math.max(...ys))}${extra}`;
}

test('the vector mat is the print file, layer for layer, in its order (127 layers on the grey band)', () => {
  assert.equal(MAT_VECTOR.width, 1200);
  assert.equal(MAT_VECTOR.height, 1200);
  assert.deepEqual(MAT_VECTOR.background, GREY, 'the grey band is under everything');
  assert.deepEqual(MAT_VECTOR.outside, { r: 120, g: 120, b: 120 }, 'the table, as in the other games');
  const C = FIELD_DATA.COLORS;
  const col = (c: readonly [number, number, number]): string => c.join(',');
  const rect = (r: Rect, c: readonly [number, number, number]): string => `rect ${col(c)} ${r.x},${r.y},${r.w},${r.h}`;
  const poly = (lst: readonly (readonly [number, number])[], c: readonly [number, number, number], contours = 1): string => {
    const xs = lst.map((q) => q[0]);
    const ys = lst.map((q) => q[1]);
    return `polygon ${col(c)} ${Math.min(...xs)},${Math.min(...ys)},${Math.max(...xs)},${Math.max(...ys)} ${contours}`;
  };
  type W = keyof typeof FIELD_DATA.WAREHOUSES;
  /** what a layer must be: its description, a diamond warehouse (its corners are worked out: compared to 0.001 mm), a piece of the circle */
  type Expected = string | { diamond: W; size: 40 | 38 } | { circle: number };
  const white = (id: keyof typeof FIELD_DATA.WHITE_LINES): string => rect(FIELD_DATA.WHITE_LINES[id], C.white);
  const diag = (id: keyof typeof FIELD_DATA.WHITE_DIAGONALS): string => poly(FIELD_DATA.WHITE_DIAGONALS[id], C.white);
  const square = (w: W, size: number, c: readonly [number, number, number]): string => {
    const m = FIELD_DATA.WAREHOUSES[w].centre;
    return rect({ x: m[0] - size / 2, y: m[1] - size / 2, w: size, h: size }, c);
  };
  const wh = (w: W): Expected[] => (FIELD_DATA.WAREHOUSES[w].rotation === 0 ? [square(w, 40, C.yellow), square(w, 38, C.orange)] : [{ diamond: w, size: 40 }, { diamond: w, size: 38 }]);
  const S = FIELD_DATA.STORAGE;
  const letters: (readonly [number, number])[] = Object.values(FIELD_DATA.MAKEX).flatMap((l): readonly (readonly [number, number])[] => l.outline);
  const expected: Expected[] = [
    // the grey frame band is the background; the black field
    rect(FIELD_DATA.BLACK_FIELD, C.black),
    // the white lines in the print's order, then diagLeft
    ...(['loopTop', 'loopLeft', 'loopRight', 'loopBottom', 'crossbarRight', 'crossbarLeft', 'stemTop', 'rightPost', 'rightPostT', 'leftPost', 'leftPostT', 'bottomLeftArm', 'bottomLeftT', 'topLeftBar', 'topRightBar', 'bottomLine', 'topLine'] as const).map(white),
    diag('diagLeft'),
    // W8 yellow, bottomRightArm, bottomRightT, W8 orange, W7, W5, the yellow patches (over topLine), W6, W2, W3, diagLeftT, W1
    square('W8', 40, C.yellow),
    white('bottomRightArm'),
    white('bottomRightT'),
    square('W8', 38, C.orange),
    ...wh('W7'),
    ...wh('W5'),
    rect(FIELD_DATA.YELLOW_LINE_PATCHES.left, C.yellow),
    rect(FIELD_DATA.YELLOW_LINE_PATCHES.right, C.yellow),
    ...wh('W6'),
    ...wh('W2'),
    ...wh('W3'),
    diag('diagLeftT'),
    ...wh('W1'),
    // the dashed circle
    ...FIELD_DATA.CIRCLE.painted.map((_, k): Expected => ({ circle: k })),
    // the squares of the cross: centre, left, bottom, right, top
    ...(['centre', 'left', 'bottom', 'right', 'top'] as const).map((q) => rect(S.squares[q], S.colors[q] === 'yellow' ? C.yellow : C.orange)),
    diag('diagRight'),
    // the start area's halves
    rect(FIELD_DATA.START_AREA.blue, C.startBlue),
    rect(FIELD_DATA.START_AREA.red, C.startRed),
    // the side bands
    ...(['bottomRightRed', 'bottomLeftBlue', 'topLeftBlue', 'topRightRed', 'leftBlue', 'rightRed'] as const).map((b) => rect(FIELD_DATA.SIDE_BANDS[b], b.endsWith('Red') ? C.bandRed : C.bandBlue)),
    diag('diagRightT'),
    ...wh('W4'),
    // stemBottom over the start area, the start logo, the MAKEX letters (one shape, seven outlines)
    white('stemBottom'),
    poly(FIELD_DATA.START_AREA.redChevron, C.logoRed),
    poly(FIELD_DATA.START_AREA.blueChevron, C.logoBlue),
    poly(letters, C.logoRed, 7),
  ];
  assert.equal(MAT_VECTOR.layers.length, expected.length);
  assert.equal(expected.length, 127);
  for (const [k, want] of expected.entries()) {
    const layer = MAT_VECTOR.layers[k];
    if (typeof want === 'string') {
      assert.equal(describeLayer(layer), want, `layer ${k}`);
    } else if ('diamond' in want) {
      assert.ok(layer.kind === 'polygon' && layer.contours.length === 1, `layer ${k}`);
      assert.deepEqual(layer.color, want.size === 40 ? YELLOW : ORANGE, `layer ${k}`);
      samePolygon(layer.contours[0], asPoints(FIELD_DATA.WAREHOUSES[want.diamond][want.size === 40 ? 'yellow' : 'orange']), 0.0011, `layer ${k}`);
    } else {
      // a piece of the circle: a 1 mm stroke on the circle, from and to its painted degrees
      assert.ok(layer.kind === 'stroke', `layer ${k}`);
      assert.deepEqual(layer.color, MAGENTA);
      assert.equal(layer.width, FIELD_DATA.CIRCLE.stroke);
      assert.equal(layer.dash, undefined);
      const [from, to] = FIELD_DATA.CIRCLE.painted[want.circle];
      const degrees = (q: Vec2): number => (((Math.atan2(q.y - 602, q.x - 600) * 180) / Math.PI + 360) % 360);
      for (const q of layer.points) near(Math.hypot(q.x - 600, q.y - 602), FIELD_DATA.CIRCLE.radius, 1e-9, `circle piece ${want.circle}`);
      near(degrees(layer.points[0]), from % 360, 1e-9, `circle piece ${want.circle}: from`);
      near(degrees(layer.points[layer.points.length - 1]), to % 360, 1e-9, `circle piece ${want.circle}: to`);
    }
  }
  // the letters are one shape filled even-odd: the hole of the A stays black
  const mat = new VectorMatSampler(MAT_VECTOR);
  assert.deepEqual(mat.sample(536, 95), BLACK, 'the hole of the A');
  assert.deepEqual(mat.sample(515, 110), LOGO_RED, 'the left leg of the A');
});

// =============================================================================================
// What the floor sensors read (the design's table 2.3), through the engine's own functions
// =============================================================================================

const THRESHOLD = LOGISTIQUE_ROBOT.quadRgb.lineThreshold;
const probe = (c: RGB) => makeProbeReading(c, THRESHOLD, LOGISTIQUE_ROBOT.quadRgb.lightLine);

test('floor sensors: what each colour of the mat reads - the white lines and the light yellow are "line"; orange, grey, magenta, blue and red are not', () => {
  const vector = new VectorMatSampler(MAT_VECTOR);
  const piece = CIRCLE_PIECES[0];
  const onCircle = ((piece[0] + piece[1]) / 2) * (Math.PI / 180);
  // [what, a point of that colour on the vector mat, the colour, its light (0 - 100), line?, colour name]
  // prettier-ignore
  const TABLE: Array<[string, Vec2, RGB, number, boolean, string]> = [
    ['black field', { x: 300, y: 600 }, BLACK, 12.7, false, 'black'],
    ['white line (the stem above the cross)', { x: 600, y: 380 }, WHITE, 100.0, true, 'white'],
    ['yellow patch on the top line', { x: 384.75, y: 305 }, YELLOW, 85.6, true, 'yellow'],
    ['yellow centre square of the cross', { x: 600, y: 602 }, YELLOW, 85.6, true, 'yellow'],
    ['yellow border of a warehouse (E2, 1 mm)', { x: 365.16, y: 51.1 }, YELLOW, 85.6, true, 'yellow'],
    ['orange warehouse (E2)', { x: 384.66, y: 51.1 }, ORANGE, 64.6, false, 'yellow'],
    ['orange square of the cross', { x: 600, y: 552 }, ORANGE, 64.6, false, 'yellow'],
    ['grey band inside the frame', { x: 2, y: 600 }, GREY, 56.3, false, 'white'],
    ['magenta dashed circle', { x: 600 + CIRCLE_RADIUS * Math.cos(onCircle), y: 602 + CIRCLE_RADIUS * Math.sin(onCircle) }, MAGENTA, 33.9, false, 'purple'],
    ['blue side band', { x: 10, y: 600 }, BAND_BLUE, 43.2, false, 'blue'],
    ['blue half of the start area', { x: 520, y: 1000 }, START_BLUE, 50.0, false, 'blue'],
    ['red side band', { x: 1190, y: 600 }, BAND_RED, 34.3, false, 'red'],
    ['red half of the start area', { x: 680, y: 1000 }, START_RED, 40.7, false, 'red'],
    ['red chevron of the start logo', { x: 580, y: 1072.5 }, LOGO_RED, 43.9, false, 'red'],
    ['blue chevron of the start logo', { x: 620, y: 1072.5 }, LOGO_BLUE, 46.6, false, 'blue'],
    ['MAKEX letters', { x: 515, y: 110 }, LOGO_RED, 43.9, false, 'red'],
  ];
  for (const [what, at, colour, light, line, name] of TABLE) {
    assert.deepEqual(vector.sample(at.x, at.y), colour, `${what}: the vector mat`);
    const reading = probe(colour);
    near(lightOf(colour), light, 0.05, `${what}: light`);
    assert.equal(reading.onLine, line, `${what}: line`);
    assert.equal(reading.color, name, `${what}: colour name`);
    assert.equal(classifyColor(colour), name, what);
  }
  // the robot's sensor is set for a light line, border 70
  assert.equal(LOGISTIQUE_ROBOT.quadRgb.lightLine, true);
  assert.equal(THRESHOLD, 70);
});

/** The sensor picture of the mat, decoded with sharp (it comes with Next.js); null where it is missing. */
async function loadMatPicture(): Promise<MatSampler | null> {
  interface Decoded {
    data: Uint8Array;
    info: { width: number; height: number };
  }
  type Sharp = (file: string) => {
    ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<Decoded> } };
  };
  try {
    const sharp = createRequire(import.meta.url)('sharp') as Sharp;
    const file = fileURLToPath(new URL(`../../../public${MAT_SENSOR_IMAGE_URL}`, import.meta.url));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1200);
    assert.equal(info.height, 1200);
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

/** A probe's spot as the engine reads it: its middle and four points 0.6 of its radius around it. */
function spot(sampler: MatSampler, x: number, y: number): RGB {
  const d = LOGISTIQUE_ROBOT.quadRgb.spotRadius * 0.6;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
    const c = sampler.sample(x + dx, y + dy);
    r += c.r;
    g += c.g;
    b += c.b;
  }
  return { r: r / 5, g: g / 5, b: b / 5 };
}

describe('floor sensors: the vector mat and the sensor picture', () => {
  const picture = loadMatPicture();
  const vector = new VectorMatSampler(MAT_VECTOR);

  test('the two pictures are in public/: the screen shows mat.webp (2 px/mm), the sensors read mat-sensor.webp (1 px/mm); both without loss', async (t) => {
    for (const url of [MAT_IMAGE_URL, MAT_SENSOR_IMAGE_URL]) assert.ok(existsSync(fileURLToPath(new URL(`../../../public${url}`, import.meta.url))), url);
    type Sharp = (file: string) => { metadata(): Promise<{ width?: number; height?: number; format?: string }> };
    let sharp: Sharp;
    try {
      sharp = createRequire(import.meta.url)('sharp') as Sharp;
    } catch {
      return t.skip('sharp is not installed');
    }
    for (const [url, size] of [[MAT_IMAGE_URL, 2400], [MAT_SENSOR_IMAGE_URL, 1200]] as const) {
      const file = fileURLToPath(new URL(`../../../public${url}`, import.meta.url));
      const meta = await sharp(file).metadata();
      assert.deepEqual([meta.format, meta.width, meta.height], ['webp', size, size], url);
      // a lossless WebP holds a "VP8L" chunk (a lossy one "VP8 ")
      assert.equal(readFileSync(file).subarray(12, 16).toString('latin1'), 'VP8L', url);
    }
  });

  test('every 2 mm of the arena, a probe spot: they agree on line or background at 99.6 % of the points, on the colour name at 99.2 %', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    let points = 0;
    let same = 0;
    let sameColour = 0;
    for (let y = 1; y < MAT_SIZE; y += 2) {
      for (let x = 1; x < MAT_SIZE; x += 2) {
        points++;
        const a = probe(spot(vector, x, y));
        const b = probe(spot(mat, x, y));
        if (a.onLine === b.onLine) same++;
        if (a.color === b.color) sameColour++;
      }
    }
    assert.equal(points, 360000);
    // (measured: 99.64 % and 99.24 %; where they differ, the spot lies across an edge)
    assert.ok(same / points >= 0.996, `${((100 * same) / points).toFixed(2)} %`);
    assert.ok(sameColour / points >= 0.992, `${((100 * sameColour) / points).toFixed(2)} %`);
  });

  test('the edges of the white lines lie where the vector puts them: 0.27 mm off on average, 0.65 mm at most (94 crossings)', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    let count = 0;
    let sum = 0;
    let largest = 0;
    for (const [id, r] of Object.entries(WHITE_LINES)) {
      const across = r.w > r.h; // a line along x is crossed along y
      for (const f of [0.3, 0.5, 0.7]) {
        const along = across ? r.x + f * r.w : r.y + f * r.h;
        const middle = across ? r.y + r.h / 2 : r.x + r.w / 2;
        const edges = (s: MatSampler): number[] => {
          const out: number[] = [];
          let before: boolean | null = null;
          for (let k = -400; k <= 400; k++) {
            const d = k * 0.05;
            const on = probe(across ? s.sample(along, middle + d) : s.sample(middle + d, along)).onLine;
            if (before !== null && on !== before) out.push(d);
            before = on;
          }
          return out;
        };
        const a = edges(vector);
        const b = edges(mat);
        // (where another line crosses or joins it, there are not two edges to compare)
        if (a.length !== 2 || b.length !== 2) continue;
        for (let i = 0; i < 2; i++) {
          const off = Math.abs(a[i] - b[i]);
          sum += off;
          largest = Math.max(largest, off);
          count++;
        }
        assert.ok(Math.abs(a[1] - a[0] - LINE_WIDTH) < 0.06, `${id}: ${a[1] - a[0]} mm wide on the vector`);
      }
    }
    assert.equal(count, 94);
    // (measured: 0.274 mm on average, 0.65 mm at most - the picture has 1 px per mm)
    assert.ok(sum / count > 0.26 && sum / count < 0.29, `mean ${(sum / count).toFixed(3)} mm`);
    assert.ok(largest < 0.7, `largest ${largest.toFixed(2)} mm`);
  });

  test('the lines, the patches, the cross and a warehouse read the same on both', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const read = (s: MatSampler, x: number, y: number): string => {
      const r = probe(spot(s, x, y));
      return `${r.onLine ? 'line' : 'background'} ${r.color}`;
    };
    for (const [id, r] of Object.entries(WHITE_LINES)) {
      const x = r.x + r.w / 3;
      const y = r.y + r.h / 3;
      if (id === 'topLine' && x >= YELLOW_LINE_PATCHES.left.x && x <= YELLOW_LINE_PATCHES.left.x + 86) continue;
      assert.equal(read(vector, x, y), 'line white', `${id} on the vector`);
      assert.equal(read(mat, x, y), 'line white', `${id} on the picture`);
    }
    for (const [what, x, y, reads] of [
      ['left patch', 384.75, 305, 'line yellow'],
      ['right patch', 813.5, 305, 'line yellow'],
      ['centre of the cross', 600, 602, 'line yellow'],
      ['top square of the cross', 600, 552, 'background yellow'],
      ['E5', 220.5, 391, 'background yellow'],
      ['E1', 69.484, 71.684, 'background yellow'],
      ['black field', 300, 600, 'background black'],
      ['start area, blue half', 520, 1000, 'background blue'],
      ['start area, red half', 680, 1000, 'background red'],
    ] as const) {
      assert.equal(read(vector, x, y), reads, `${what} on the vector`);
      assert.equal(read(mat, x, y), reads, `${what} on the picture`);
    }
  });
});

// =============================================================================================
// The cubes and the robot
// =============================================================================================

test('cubes: 50 mm (the rules: 50 ± 2), light', () => {
  assert.equal(CUBE_SIZE, 50);
  assert.equal(CUBE_MASS, 1);
  // a centred cube covers a 40 mm warehouse with 5 mm to spare on each side, turned up to 17.1 degrees
  assert.equal((CUBE_SIZE - WAREHOUSE_SIZE) / 2, 5);
  const limit = ((Math.asin(CUBE_SIZE / (WAREHOUSE_SIZE * Math.SQRT2)) - Math.PI / 4) * 180) / Math.PI;
  near(limit, 17.11, 0.005, 'the largest turn');
});

test('robot: Tri d\'entrepôt\'s mBot2, the very same object (a light line, border 70; the gripper; the colour sensor at the claw)', () => {
  assert.equal(LOGISTIQUE_ROBOT, WAREHOUSE_SORT_ROBOT);
  assert.equal(LOGISTIQUE_ROBOT.gripper.enabled, true);
  assert.equal(LOGISTIQUE_ROBOT.frontColorSensor.enabled, true);
  assert.equal(LOGISTIQUE_ROBOT.frontColorSensor.mount, undefined);
  // the claw's underside: 5 mm (arm down) to 75 mm (arm up); the fingers are 20 mm high: the finger tops reach 95 mm
  assert.equal(LOGISTIQUE_ROBOT.gripper.liftDownHeight, 5);
  assert.equal(LOGISTIQUE_ROBOT.gripper.liftUpHeight, 75);
  assert.equal(LOGISTIQUE_ROBOT.gripper.liftUpHeight + LOGISTIQUE_ROBOT.gripper.fingerHeight, 95);
  // the chassis is higher than the frame; the raised claw passes over it
  assert.ok(LOGISTIQUE_ROBOT.chassisHeight > FRAME_HEIGHT);
  assert.ok(LOGISTIQUE_ROBOT.gripper.liftUpHeight > FRAME_HEIGHT);
  // 237 mm long with the claw open, 130 mm wide
  assert.deepEqual(robotReach(LOGISTIQUE_ROBOT), { front: 167, rear: 70, halfWidth: 65 });
});

test('robot: it starts facing up on the stem, in the middle of the start area: 6.5 mm in front and behind, 59 mm on each side', () => {
  assert.deepEqual(START_POSE, { x: 600, y: 1123.5, heading: 0 });
  assert.equal(START_HEADING, 0);
  assert.deepEqual(startPoseFor(LOGISTIQUE_ROBOT), START_POSE);
  assert.ok(robotFitsInRect(LOGISTIQUE_ROBOT, START_POSE, START_AREA));
  const reach = robotReach(LOGISTIQUE_ROBOT);
  near(START_POSE.y - reach.front - START_AREA.y, 6.5, 1e-9, 'in front');
  near(START_AREA.y + START_AREA.h - (START_POSE.y + reach.rear), 6.5, 1e-9, 'behind');
  near(START_POSE.x - reach.halfWidth - START_AREA.x, 59, 1e-9, 'on its left');
  near(START_AREA.x + START_AREA.w - (START_POSE.x + reach.halfWidth), 59, 1e-9, 'on its right');
  // the claw's middle at y 981.5; the line sensor at y 1038.5, 45.5 mm below the end of the stem (y 993)
  near(START_POSE.y - LOGISTIQUE_ROBOT.gripper.gripForward, 981.5, 1e-9, 'the claw');
  near(START_POSE.y - LOGISTIQUE_ROBOT.quadRgb.forward, 1038.5, 1e-9, 'the line sensor');
  near(START_POSE.y - LOGISTIQUE_ROBOT.quadRgb.forward - (WHITE_LINES.stemBottom.y + WHITE_LINES.stemBottom.h), 45.5, 1e-9, 'below the stem');
  // the ultrasonic sensor's face at y 1018.5: 341.5 mm from the bottom stack of the cross (its face y 677)
  near(START_POSE.y - LOGISTIQUE_ROBOT.ultrasonic.forward, 1018.5, 1e-9, 'the ultrasonic sensor');
  near(START_POSE.y - LOGISTIQUE_ROBOT.ultrasonic.forward - (STORAGE_SQUARES.bas.y + STORAGE_SQUARES.bas.h), 341.5, 1e-9, 'to the cross');
  // its shapes lie in the start area; 7 mm further up the claw would stick out of it
  assert.equal(robotShapesAt(LOGISTIQUE_ROBOT, START_POSE).length, 3);
  assert.equal(robotFitsInRect(LOGISTIQUE_ROBOT, { ...START_POSE, y: START_POSE.y - 7 }, START_AREA), false);
});
