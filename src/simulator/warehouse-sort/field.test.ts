/**
 * The Warehouse Sort field: its numbers against the print file turned 90 degrees to the right
 * (the owner's decision: the robot starts facing up), the turn itself, what the floor sensors
 * see on it (the vector mat against the sensor picture), the cubes and the robot in the start
 * zone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_MARGIN } from '../core/engine';
import { classifyColor, lightOf, makeProbeReading } from '../core/engine-sensors';
import { DEG, obbCorners, rectContainsOBB, type Rect } from '../core/geometry';
import { VectorMatSampler } from '../core/mat';
import { DEFAULT_ROBOT_CONFIG, robotFitsInRect, robotShapesAt, robotSize } from '../core/robot';
import type { RGB } from '../core/types';
import {
  BAYS,
  CUBE_HEIGHT,
  CUBE_MASS,
  CUBE_SIZE,
  FINISH_PADS,
  GREEN_BAY_PICTURE,
  GROUND,
  HOME_HEXAGON,
  LINE_WIDTH,
  LOGO_LETTERS,
  LONG_LINE_X,
  MAT_SIZE,
  MAT_VECTOR,
  MIDDLE_LINE_Y,
  MM_PER_PT,
  PAD_IDS,
  PICTURE_COLORS,
  SPONSOR_INNER_RECT,
  SPONSOR_RECT,
  START_ART,
  START_FRAME,
  START_FRAME_WIDTH,
  START_ZONE,
  TABLE_STRIP,
  WAREHOUSES,
  WAREHOUSE_FRAME_WIDTH,
  WAREHOUSE_IDS,
  WHITE_LINES,
  YELLOW_BANDS,
  ellipseOutline,
} from './field';
import { LIGHT_LINE_THRESHOLD, START_HEADING, START_POSE, WAREHOUSE_SORT_ROBOT, robotReach, startPoseFor } from './robot';

const near = (actual: number, expected: number, eps: number, what = 'value') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: ${actual} is not within ${eps} of ${expected}`);

const mat = new VectorMatSampler(MAT_VECTOR);
const T = LIGHT_LINE_THRESHOLD;

// =============================================================================================
// The numbers against the print file
// =============================================================================================

/**
 * The boxes of the vector shapes of the print file "Capelli_Inspire_1235mm.pdf" TURNED 90 degrees
 * to the right (the page's /Rotate 90, as a PDF viewer turns it), in points, as pdftocairo -svg
 * gives them (x0, y0, x1, y1; y down; the frames are the middle of their stroke). field.ts holds
 * them in mm: 1 pt = 1235 / 3500.79 mm, rounded to 0.01 mm.
 */
// prettier-ignore
const TURNED_PRINT_FILE: Record<string, [number, number, number, number]> = {
  'line:loopTop': [874.148, 1091.484, 2697.805, 1165.922],
  'line:loopBottom': [874.148, 2347.258, 2697.805, 2421.691],
  'line:loopLeft': [874.148, 1093.910, 948.383, 2421.691],
  'line:loopRight': [2646.980, 1091.484, 2721.215, 2421.691],
  'line:barTopLeft': [1300.875, 992.074, 1375.113, 1274.926],
  'line:barTopRight': [2195.930, 992.074, 2270.168, 1274.926],
  'line:barBottomLeft': [1300.875, 2243.047, 1375.113, 2525.898],
  'line:barBottomRight': [2195.930, 2243.047, 2270.168, 2525.898],
  'line:middleRight': [999.184, 1718.996, 3033.879, 1793.430],
  'line:middleLeft': [506.797, 1716.184, 1187.426, 1793.430],
  'line:long': [1748.855, 380.246, 1823.094, 2847.324],
  'line:topRight': [1973.164, 343.516, 2869.938, 417.949],
  'line:topMiddle': [911.266, 343.027, 2016.531, 417.465],
  'line:topLeft': [709.723, 343.590, 1606.496, 418.023],
  'line:topRightT': [2868.367, 239.309, 2942.602, 522.160],
  'line:topLeftT': [637.055, 239.383, 711.293, 522.234],
  'line:bottomLeft': [621.508, 3096.012, 1475.852, 3170.445],
  'line:bottomLeftT': [592.277, 2991.801, 663.000, 3274.656],
  'line:bottomRight': [2068.527, 3096.012, 2937.004, 3170.445],
  'line:bottomRightT': [2883.488, 2991.801, 2955.379, 3274.656],
  'band:top': [0.000, 0.000, 3500.578, 56.691],
  'band:rightUpper': [3451.645, 3.352, 3500.578, 1369.973],
  'band:rightLower': [3450.625, 2164.016, 3500.578, 3500.578],
  'band:bottom': [0.000, 3440.398, 3500.578, 3496.086],
  'band:leftUpper': [0.000, 3.801, 55.875, 1370.422],
  'band:leftLower': [0.000, 2157.465, 55.875, 3500.578],
  'frame:W1': [232.625, 160.637, 544.586, 599.852],
  'square:W1': [332.688, 324.238, 445.527, 437.379],
  'frame:W2': [3035.070, 161.687, 3347.035, 600.902],
  'square:W2': [3134.129, 324.164, 3246.969, 437.305],
  'frame:W3': [200.621, 2914.191, 512.582, 3353.406],
  'square:W3': [302.309, 3076.660, 409.809, 3189.797],
  'frame:W4': [3044.945, 2914.184, 3347.035, 3353.398],
  'square:W4': [3140.863, 3076.660, 3250.141, 3189.797],
  'bay:red': [2083.031, 1505.906, 2379.977, 2000.895],
  'bay:green': [1189.523, 1513.266, 1486.469, 2008.254],
  'sponsor': [1488.066, 1650.766, 2139.996, 1849.180],
  'sponsorInner': [1548.488, 1670.766, 2023.461, 1830.758],
  // the middle of the start zone's frame; its bottom side lies off the page (clipped)
  'startFrame': [1401.676, 2758.078, 2132.492, 3509.500],
};

/** The ellipses of the turned print file: the pads (yellow, 4 curves each) and the clip of the green bay's picture. */
const TURNED_PRINT_ELLIPSES = {
  left: { x0: 263.203, y0: 1530.773, x1: 708.617, y1: 1984.824 },
  right: { x0: 2868.434, y0: 1528.871, x1: 3313.852, y1: 1982.922 },
  greenBayPicture: { x0: 1200.070, y0: 1617.211, x1: 1480.469, y1: 1890.281 },
};

/**
 * The same shapes in the print file AS PRINTED (before the turn), by the name they had then, and
 * the name the shape has on the turned field. (These are the numbers this test held before the
 * field was turned.)
 */
// prettier-ignore
const AS_PRINTED: Array<[string, string, [number, number, number, number]]> = [
  ['line:loopTop', 'line:loopRight', [1091.484, 779.363, 2421.691, 853.602]],
  ['line:loopBottom', 'line:loopLeft', [1093.910, 2552.195, 2421.691, 2626.434]],
  ['line:loopLeft', 'line:loopTop', [1091.484, 802.777, 1165.922, 2626.434]],
  ['line:loopRight', 'line:loopBottom', [2347.258, 802.777, 2421.691, 2626.434]],
  ['line:barLeftUpper', 'line:barTopRight', [992.074, 1230.414, 1274.926, 1304.648]],
  ['line:barRightUpper', 'line:barBottomRight', [2243.047, 1230.414, 2525.898, 1304.648]],
  ['line:barLeftLower', 'line:barTopLeft', [992.074, 2125.469, 1274.926, 2199.703]],
  ['line:barRightLower', 'line:barBottomLeft', [2243.047, 2125.469, 2525.898, 2199.703]],
  ['line:middleUpper', 'line:middleRight', [1718.996, 466.699, 1793.430, 2501.398]],
  ['line:middleLower', 'line:middleLeft', [1716.184, 2313.152, 1793.430, 2993.781]],
  ['line:long', 'line:long', [380.246, 1677.488, 2847.324, 1751.723]],
  ['line:leftUpper', 'line:topRight', [343.516, 630.645, 417.949, 1527.418]],
  ['line:leftMiddle', 'line:topMiddle', [343.027, 1484.051, 417.465, 2589.316]],
  ['line:leftLower', 'line:topLeft', [343.590, 1894.086, 418.023, 2790.859]],
  ['line:leftTopT', 'line:topRightT', [239.309, 557.977, 522.160, 632.215]],
  ['line:leftBottomT', 'line:topLeftT', [239.383, 2789.289, 522.234, 2863.523]],
  ['line:rightUpper', 'line:bottomRight', [3096.012, 563.578, 3170.445, 1432.051]],
  ['line:rightTopT', 'line:bottomRightT', [2991.801, 545.199, 3274.656, 617.094]],
  ['line:rightLower', 'line:bottomLeft', [3096.012, 2024.730, 3170.445, 2879.074]],
  ['line:rightBottomT', 'line:bottomLeftT', [2991.801, 2837.578, 3274.656, 2908.305]],
  ['band:0 (top, left of the gap)', 'band:rightUpper', [3.352, 0.004, 1369.973, 48.934]],
  ['band:1 (top, right of the gap)', 'band:rightLower', [2164.016, 0.004, 3500.578, 49.953]],
  ['band:2 (left)', 'band:top', [0.000, 0.004, 56.691, 3500.578]],
  ['band:3 (right)', 'band:bottom', [3440.398, 0.004, 3496.086, 3500.578]],
  ['band:4 (bottom, left of the gap)', 'band:leftUpper', [3.801, 3444.703, 1370.422, 3500.578]],
  ['band:5 (bottom, right of the gap)', 'band:leftLower', [2157.465, 3444.703, 3500.578, 3500.578]],
  ['frame:W1', 'frame:W2', [161.687, 153.547, 600.902, 465.512]],
  ['square:W1', 'square:W2', [324.164, 253.613, 437.305, 366.449]],
  ['frame:W2', 'frame:W4', [2914.184, 153.547, 3353.398, 455.633]],
  ['square:W2', 'square:W4', [3076.660, 250.438, 3189.797, 359.715]],
  ['frame:W3', 'frame:W1', [160.637, 2955.992, 599.852, 3267.957]],
  ['square:W3', 'square:W1', [324.238, 3055.051, 437.379, 3167.891]],
  ['frame:W4', 'frame:W3', [2914.191, 2987.996, 3353.406, 3299.961]],
  ['square:W4', 'square:W3', [3076.660, 3090.770, 3189.797, 3198.270]],
  ['bay:red', 'bay:red', [1505.906, 1120.602, 2000.895, 1417.547]],
  ['bay:green', 'bay:green', [1513.266, 2014.113, 2008.254, 2311.059]],
  ['sponsor', 'sponsor', [1650.766, 1360.582, 1849.180, 2012.512]],
  ['sponsorInner', 'sponsorInner', [1670.766, 1477.121, 1830.758, 1952.090]],
  ['startFrame', 'startFrame', [2758.078, 1368.090, 3509.500, 2098.906]],
  ['pad:top', 'pad:right', [1528.871, 186.730, 1982.922, 632.148]],
  ['pad:bottom', 'pad:left', [1530.773, 2791.961, 1984.824, 3237.379]],
  ['greenBayPicture', 'greenBayPicture', [1617.211, 2020.113, 1890.281, 2300.512]],
];

/**
 * The turn: a point x, y of the print file as printed is at H - y, x in the turned one (points).
 * H is the size at which pdftocairo draws the page: 3500.58 pt, 0.006 % less than the page's
 * 3500.79 - every number of field.ts was measured on that drawing, before the turn as after it.
 */
const H = 3500.580013;
/** ... the same in mm: a point x, y of the field before the turn is at TURN_W - y, x now. */
const TURN_W = H * MM_PER_PT;

const BAND_NAMES = ['top', 'rightUpper', 'rightLower', 'bottom', 'leftUpper', 'leftLower'];

function fieldRects(): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const [name, rect] of Object.entries(WHITE_LINES)) out[`line:${name}`] = rect;
  YELLOW_BANDS.forEach((rect, i) => (out[`band:${BAND_NAMES[i]}`] = rect));
  for (const w of WAREHOUSE_IDS) {
    out[`frame:${w}`] = WAREHOUSES[w].frame;
    out[`square:${w}`] = WAREHOUSES[w].square;
  }
  out['bay:red'] = BAYS.red;
  out['bay:green'] = BAYS.green;
  out.sponsor = SPONSOR_RECT;
  out.sponsorInner = SPONSOR_INNER_RECT;
  out.startFrame = START_FRAME;
  return out;
}

test('field: the mat is 1235 mm square, 3500.79 points in the print file', () => {
  assert.equal(MAT_SIZE, 1235);
  near(MM_PER_PT, 25.4 / 72, 1e-5, '1 pt');
  assert.deepEqual([MAT_VECTOR.width, MAT_VECTOR.height], [1235, 1235]);
  assert.deepEqual(MAT_VECTOR.background, GROUND);
  assert.deepEqual(GROUND, { r: 35, g: 31, b: 32 });
});

test('the turn: the turned print file is the print file as printed, turned 90 degrees to the right', () => {
  const turnedBoxes: Record<string, [number, number, number, number]> = { ...TURNED_PRINT_FILE };
  for (const [name, e] of Object.entries(TURNED_PRINT_ELLIPSES)) turnedBoxes[name === 'greenBayPicture' ? name : `pad:${name}`] = [e.x0, e.y0, e.x1, e.y1];
  // every shape: its box as printed, turned, is its box in the turned print file (to 0.02 pt = 0.007 mm)
  assert.equal(AS_PRINTED.length, Object.keys(turnedBoxes).length);
  assert.deepEqual(AS_PRINTED.map(([, name]) => name).sort(), Object.keys(turnedBoxes).sort());
  for (const [before, after, [x0, y0, x1, y1]] of AS_PRINTED) {
    const turned = [H - y1, x0, H - y0, x1];
    const box = turnedBoxes[after];
    // (the left and right bands of the page ran 0.004 pt short of its top: turned, they end 0.004 pt short of its right side)
    for (let i = 0; i < 4; i++) near(box[i], turned[i], 0.02, `${before} -> ${after} [${i}]`);
  }
  near(TURN_W, 1234.926, 0.001, 'the turn in mm');
  // the robot turned with the field: before the turn it stood at x 1151.085, y 604.875 mm, facing left
  near(START_POSE.x, TURN_W - 604.875, 0.01, 'start x');
  near(START_POSE.y, 1151.085, 1e-9, 'start y');
  assert.equal(START_POSE.heading, -90 * DEG + 90 * DEG, 'facing left before, facing up now');
});

test('field: every rectangle is the one in the turned print file, to 0.01 mm', () => {
  const rects = fieldRects();
  assert.deepEqual(Object.keys(rects).sort(), Object.keys(TURNED_PRINT_FILE).sort());
  for (const [name, [x0, y0, x1, y1]] of Object.entries(TURNED_PRINT_FILE)) {
    const r = rects[name];
    near(r.y, y0 * MM_PER_PT, 0.006, `${name} y`);
    near(r.h, (y1 - y0) * MM_PER_PT, 0.006, `${name} h`);
    // (the top and bottom bands run the whole width: field.ts lets them reach both edges of the mat, 0.07 mm further on the right)
    if (name === 'band:top' || name === 'band:bottom') {
      assert.deepEqual([r.x, r.x + r.w], [0, MAT_SIZE], name);
    } else {
      near(r.x, x0 * MM_PER_PT, 0.006, `${name} x`);
      near(r.w, (x1 - x0) * MM_PER_PT, 0.006, `${name} w`);
    }
  }
  // the frames: 16 pt and 1 pt wide
  near(START_FRAME_WIDTH, 16 * MM_PER_PT, 0.005, 'start frame width');
  near(WAREHOUSE_FRAME_WIDTH, MM_PER_PT, 0.005, 'warehouse frame width');
  // the ellipses
  for (const [name, e] of [
    ['left', FINISH_PADS.left],
    ['right', FINISH_PADS.right],
    ['greenBayPicture', GREEN_BAY_PICTURE],
  ] as const) {
    const p = TURNED_PRINT_ELLIPSES[name];
    near(e.cx, ((p.x0 + p.x1) / 2) * MM_PER_PT, 0.006, `${name} cx`);
    near(e.cy, ((p.y0 + p.y1) / 2) * MM_PER_PT, 0.006, `${name} cy`);
    near(e.rx, ((p.x1 - p.x0) / 2) * MM_PER_PT, 0.006, `${name} rx`);
    near(e.ry, ((p.y1 - p.y0) / 2) * MM_PER_PT, 0.006, `${name} ry`);
  }
});

test('field: the shapes fit together as printed', () => {
  // the white lines are 25 to 27.3 mm wide, most of them 26.2
  for (const [name, r] of Object.entries(WHITE_LINES)) {
    const width = Math.min(r.w, r.h);
    assert.ok(width >= 24.9 && width <= 27.3, `${name}: ${width}`);
  }
  near(LINE_WIDTH, 26.2, 0.07);
  // the long line runs from the top line down into the start zone; the start pose looks along it
  assert.ok(WHITE_LINES.long.y < WHITE_LINES.topMiddle.y + WHITE_LINES.topMiddle.h);
  assert.ok(WHITE_LINES.long.y + WHITE_LINES.long.h > START_ZONE.y + 30);
  near(LONG_LINE_X, 630.055, 0.001);
  near(MIDDLE_LINE_Y, 619.55, 0.001);
  // the orange square sits in the middle of its yellow frame (to 0.3 mm)
  for (const w of WAREHOUSE_IDS) {
    const { frame, square } = WAREHOUSES[w];
    near(square.x + square.w / 2, frame.x + frame.w / 2, 0.3, `${w} x`);
    near(square.y + square.h / 2, frame.y + frame.h / 2, 0.3, `${w} y`);
    near(square.h, 39.91, 0.01, `${w} square height`);
    assert.ok(square.w >= 37.9 && square.w <= 39.82, `${w} square width ${square.w}`);
    near(frame.h, 154.95, 0.01, `${w} frame height`);
  }
  // W1 .. W4 in reading order of the field as the screen shows it
  assert.deepEqual(
    WAREHOUSE_IDS.map((w) => WAREHOUSES[w].place),
    ['top left', 'top right', 'bottom left', 'bottom right'],
  );
  assert.ok(WAREHOUSES.W1.frame.x < WAREHOUSES.W2.frame.x && WAREHOUSES.W3.frame.x < WAREHOUSES.W4.frame.x);
  assert.ok(WAREHOUSES.W1.frame.y < WAREHOUSES.W3.frame.y && WAREHOUSES.W2.frame.y < WAREHOUSES.W4.frame.y);
  // the bays: the same size, green left of the logo, red right of it
  assert.equal(BAYS.red.w, BAYS.green.w);
  assert.equal(BAYS.red.h, BAYS.green.h);
  near(BAYS.red.w, 104.76, 0.001);
  near(BAYS.red.h, 174.62, 0.001);
  assert.ok(BAYS.green.x + BAYS.green.w < BAYS.red.x);
  assert.ok(BAYS.red.x > MAT_SIZE / 2 && BAYS.green.x + BAYS.green.w < MAT_SIZE / 2);
  // the pads: 157.13 x 160.18 mm, at the two ends of the middle line, on the left and on the right
  for (const pad of PAD_IDS) {
    near(2 * FINISH_PADS[pad].rx, 157.13, 0.01);
    near(2 * FINISH_PADS[pad].ry, 160.18, 0.01);
    near(FINISH_PADS[pad].cy, MIDDLE_LINE_Y, 1);
  }
  assert.ok(FINISH_PADS.left.cx < MAT_SIZE / 2 && FINISH_PADS.right.cx > MAT_SIZE / 2);
  // the start zone: the yellow frame (outer edge) down to the bottom edge of the mat, in the middle
  near(START_ZONE.x, 491.66, 0.005);
  near(START_ZONE.y, 970.17, 0.005);
  near(START_ZONE.w, 263.46, 0.005);
  near(START_ZONE.h, 264.83, 0.005);
  assert.equal(START_ZONE.y + START_ZONE.h, MAT_SIZE);
  assert.equal(START_ART.y + START_ART.h, MAT_SIZE);
  // (about the middle of the bottom edge: as printed, 5.9 mm right of it)
  near(START_ZONE.x + START_ZONE.w / 2 - MAT_SIZE / 2, 5.89, 0.01, 'the middle of the bottom edge');
  // the white rectangle of the logo: the red bay covers its right end, the green bay ends 0.56 mm left of it
  assert.ok(SPONSOR_RECT.x + SPONSOR_RECT.w > BAYS.red.x);
  near(SPONSOR_RECT.x - (BAYS.green.x + BAYS.green.w), 0.56, 0.01);
  // the table around the mat: the engine's strip, 100 mm on every side (so the same after the turn)
  assert.equal(TABLE_STRIP, TABLE_MARGIN);
  assert.equal(TABLE_STRIP, 100);
});

/** The box around each of the 14 letters of the logo before the turn (mm: x0, y0, x1, y1), in the order of sponsor-logo.ts (stored then to 0.1 mm). */
// prettier-ignore
const LETTER_BOXES_AS_PRINTED: Array<[number, number, number, number]> = [
  [633.3, 599.4, 645.5, 614.3], [633.3, 565.4, 645.5, 580.4], [633.3, 582.2, 645.4, 597.2], [633.3, 531.9, 645.4, 546.8],
  [633.3, 548.2, 645.4, 563.2], [589.7, 522.1, 595.6, 528], [604.1, 572, 630.1, 598.7], [592.7, 558.7, 630.1, 567.9],
  [592.7, 545.2, 630.1, 554.4], [604.6, 532, 630.1, 540.9], [592.2, 531.5, 602, 541.3], [604, 601.5, 641.2, 629.5],
  [604, 663.4, 630, 687.9], [604.1, 632.6, 630.1, 660.3],
];
/**
 * The same boxes measured on the TURNED print file (the PDF turned with /Rotate 90, pdftocairo
 * -svg, the curves cut as in sponsor-logo.ts, not rounded; mm).
 */
// prettier-ignore
const LETTER_BOXES_TURNED: Array<[number, number, number, number]> = [
  [620.588, 633.311, 635.509, 645.517], [654.558, 633.311, 669.479, 645.482], [637.767, 633.311, 652.724, 645.411],
  [688.141, 633.311, 703.026, 645.411], [671.737, 633.311, 686.694, 645.411], [706.907, 589.676, 712.868, 595.637],
  [636.179, 604.068, 662.883, 630.102], [667.01, 592.709, 676.217, 630.136], [680.556, 592.709, 689.763, 630.136],
  [694.032, 604.633, 702.956, 630.102], [693.643, 592.18, 703.449, 601.987], [605.454, 604.032, 633.463, 641.179],
  [547.072, 604.032, 571.519, 629.96], [574.588, 604.068, 602.279, 630.102],
];
/** The HOME hexagon before the turn (mm). */
// prettier-ignore
const HOME_HEXAGON_AS_PRINTED: Array<[number, number]> = [
  [657.4, 445.1], [657.1, 449.1], [638.4, 481.6], [634.9, 484.9], [593.1, 484.9], [589.1, 480.6], [570.4, 448.6],
  [570.9, 444.1], [588.1, 414.6], [591.9, 409.6], [594.6, 408.6], [633.6, 408.6], [635.9, 409.4], [639.6, 414.1],
];

test('the turn: the logo letters are where the turned print file has them (to 0.01 mm), the HOME hexagon is the one before the turn, turned', () => {
  assert.equal(
    LOGO_LETTERS.reduce((n, shape) => n + shape.reduce((m, outline) => m + outline.length, 0), 0),
    462,
    'the points of the print file (one more than before the turn, where 0.1 mm had made two points one)',
  );
  LOGO_LETTERS.forEach((shape, i) => {
    const xs = shape.flatMap((outline) => outline.map((p) => p.x));
    const ys = shape.flatMap((outline) => outline.map((p) => p.y));
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    // (stored to 0.01 mm: at most 0.005 mm off, and the box above is given to 0.001 mm)
    box.forEach((v, k) => near(v, LETTER_BOXES_TURNED[i][k], 0.006, `letter ${i} box ${k}`));
    // ... the boxes before the turn, turned (x, y -> TURN_W - y, x): off by no more than their 0.1 mm rounding
    const [x0, y0, x1, y1] = LETTER_BOXES_AS_PRINTED[i];
    [TURN_W - y1, x0, TURN_W - y0, x1].forEach((v, k) => near(box[k], v, 0.075, `letter ${i} box ${k}, before the turn`));
  });
  assert.equal(HOME_HEXAGON.length, HOME_HEXAGON_AS_PRINTED.length);
  // (the hexagon is traced on a picture of the print file, not a vector: it keeps its 0.1 mm points, turned)
  HOME_HEXAGON.forEach((p, i) => {
    near(p.x, TURN_W - HOME_HEXAGON_AS_PRINTED[i][1], 0.006, `hexagon ${i} x`);
    near(p.y, HOME_HEXAGON_AS_PRINTED[i][0], 1e-9, `hexagon ${i} y`);
  });
});

test('field: the logo letters and the HOME hexagon are where the print file has them', () => {
  assert.equal(LOGO_LETTERS.length, 14);
  assert.equal(
    LOGO_LETTERS.reduce((n, shape) => n + shape.length, 0),
    20,
    '20 outlines: 14 letters and 6 holes',
  );
  for (const shape of LOGO_LETTERS) {
    for (const outline of shape) {
      assert.ok(outline.length >= 3);
      for (const p of outline) {
        assert.ok(p.x >= SPONSOR_INNER_RECT.x && p.x <= SPONSOR_INNER_RECT.x + SPONSOR_INNER_RECT.w, `${p.x}`);
        assert.ok(p.y >= SPONSOR_INNER_RECT.y && p.y <= SPONSOR_INNER_RECT.y + SPONSOR_INNER_RECT.h, `${p.y}`);
      }
    }
  }
  for (const p of HOME_HEXAGON) assert.ok(p.x > BAYS.red.x + 10 && p.x < BAYS.red.x + BAYS.red.w - 10 && p.y > BAYS.red.y + 30 && p.y < BAYS.red.y + BAYS.red.h - 30);
  assert.equal(ellipseOutline(FINISH_PADS.left).length, 72);
});

// =============================================================================================
// What the floor sensors see
// =============================================================================================

const named = (x: number, y: number) => classifyColor(mat.sample(x, y));
const lineAt = (x: number, y: number) => makeProbeReading(mat.sample(x, y), T, true).onLine;

/**
 * Points measured on the sensor picture (public/simulator/warehouse-sort/mat-sensor.webp, 1250 px
 * for 1235 mm, decoded and averaged over a probe's spot): the colour name the picture gives
 * there, and whether a probe of this game's robot reads "line". The vector mat must give the
 * same. (The whole comparison - every 2 mm of the mat, region by region - was made with a script
 * when the pictures were made and again when they were turned; its numbers are in the reports of
 * that work. These are the points of before the turn, turned, and read again on the turned
 * picture: all 30 read the same.)
 */
// prettier-ignore
const PICTURE_POINTS: Array<[string, number, number, string, boolean]> = [
  ['loop, right', 946.89, 619.68, 'white', true],
  ['loop, left', 321.47, 620.12, 'white', true],
  ['loop, top', 630.06, 398.18, 'white', true],
  ['loop, bottom', 630.06, 841.19, 'white', true],
  ['bar, top right', 787.77, 399.87, 'white', true],
  ['bar, bottom left', 472.01, 841.19, 'white', true],
  ['middle line, right', 711.39, 619.55, 'white', true],
  ['middle line, left', 298.84, 619.05, 'white', true],
  ['long line', 630.05, 569.31, 'white', true],
  ['top line', 516.43, 134.14, 'white', true],
  ['top line, right T-end', 1024.99, 134.31, 'white', true],
  ['bottom line, right', 882.92, 1105.33, 'white', true],
  ['bottom line, left T-end', 221.43, 1105.34, 'white', true],
  ['ground', 1084.93, 300, 'black', false],
  ['ground', 134.93, 900, 'black', false],
  ['ground', 834.93, 1000, 'black', false],
  ['red bay', 824.93, 550, 'red', false],
  ['red bay', 744.93, 690, 'red', false],
  ['green bay', 434.93, 550, 'green', false],
  ['green bay', 514.93, 700, 'green', false],
  ['orange square W2', 1125.55, 134.31, 'yellow', false],
  ['orange square W3', 125.62, 1105.34, 'yellow', false],
  ['yellow band, top', 634.93, 10, 'yellow', true],
  ['yellow band, right', 1226.93, 200, 'yellow', true],
  ['yellow band, left', 9.93, 1000, 'yellow', true],
  ['start zone art', 704.93, 1180, 'black', false],
  ['logo: white on the long line', 630.03, 590, 'white', true],
  ['logo: a letter on the long line', 639.93, 614, 'black', false],
  ['logo: a letter on the middle line', 590.93, 607, 'black', false],
  ['logo: a letter', 597.93, 621, 'black', false],
];

test('floor sensors: the vector mat says what the sensor picture says at measured points', () => {
  for (const [what, x, y, colour, line] of PICTURE_POINTS) {
    assert.equal(named(x, y), colour, `${what} (${x}, ${y}): colour`);
    assert.equal(lineAt(x, y), line, `${what} (${x}, ${y}): line`);
  }
  // the pads are pictures of many colours: the vector has their average, which reads as
  // background like the picture does everywhere the probes were measured (the colour names differ)
  for (const pad of PAD_IDS) {
    const e = FINISH_PADS[pad];
    for (const dx of [-60, 0, 60]) assert.equal(lineAt(e.cx + dx, e.cy), false, `${pad} pad`);
  }
  near(lightOf(PICTURE_COLORS.pad), 40, 0.5);
  assert.equal(classifyColor(PICTURE_COLORS.startArt), 'black');
});

test('floor sensors: white lines on black, sharp edges, everything printed over in the right order', () => {
  const isWhite = (c: RGB) => c.r === 255 && c.g === 255 && c.b === 255;
  const isGround = (c: RGB) => c.r === GROUND.r && c.g === GROUND.g && c.b === GROUND.b;
  // across the long line (x 616.96 .. 643.15)
  assert.ok(isGround(mat.sample(616.8, 300)));
  assert.ok(isWhite(mat.sample(617.1, 300)));
  assert.ok(isWhite(mat.sample(643.0, 300)));
  assert.ok(isGround(mat.sample(643.3, 300)));
  // the middle line runs under the red bay and under the pads
  assert.equal(named(835, MIDDLE_LINE_Y), 'red');
  assert.equal(named(785, MIDDLE_LINE_Y), 'white', 'the HOME picture (its average colour)');
  assert.equal(named(975, MIDDLE_LINE_Y), 'white', 'between the loop and the right pad');
  assert.deepEqual(mat.sample(1035, MIDDLE_LINE_Y), PICTURE_COLORS.pad, 'under the right pad');
  assert.equal(lineAt(1035, MIDDLE_LINE_Y), false, 'under the right pad');
  // the lines at the bottom are printed over the start zone's frame and art
  assert.equal(named(735, 1105), 'white');
  assert.equal(named(630, 990), 'white', 'the long line, 20 mm into the start zone');
  assert.equal(named(630, 1010), 'black', 'the start-zone art beyond its end');
  // the frame of the start zone
  assert.equal(named(685, 971), 'yellow');
  assert.equal(named(754.4, 1050), 'yellow');
  assert.equal(named(754.4, 1100), 'white', 'the bottom line on the right is printed over the frame');
  // the letters of the logo are on top of the white lines, with holes
  assert.equal(named(639.93, 614), 'black');
  // off the mat: the table
  assert.deepEqual(mat.sample(-5, 600), MAT_VECTOR.outside);
  assert.deepEqual(mat.sample(600, 1236), MAT_VECTOR.outside);
  assert.deepEqual(mat.sample(1236, 600), MAT_VECTOR.outside);
  // the layers the brief asked for are all there
  const kinds = MAT_VECTOR.layers.map((l) => l.kind);
  assert.equal(kinds.filter((k) => k === 'polygon').length, 2 + 2 + 14, 'hexagon, bay picture, 2 pads, 14 letters');
});

// =============================================================================================
// The cubes
// =============================================================================================

test('cubes: 40 mm, light, each one covers its orange square', () => {
  assert.equal(CUBE_SIZE, 40);
  assert.equal(CUBE_HEIGHT, 40);
  assert.equal(CUBE_MASS, 1);
  for (const w of WAREHOUSE_IDS) {
    const s = WAREHOUSES[w].square;
    // at most 1.1 mm bigger than the square on each side
    assert.ok(CUBE_SIZE >= Math.max(s.w, s.h) && CUBE_SIZE - s.w <= 2.2 && CUBE_SIZE - s.h <= 2.2, w);
  }
  // the gripper is made for this size (the Fire Rescue bucket is 40 mm too)
  const g = WAREHOUSE_SORT_ROBOT.gripper;
  assert.ok(g.clawOpenGap > CUBE_SIZE * Math.SQRT2, 'the open claw takes even a cube that stands turned');
  assert.ok(g.clawClosedGap < CUBE_SIZE, 'the closed claw clamps it');
  assert.ok(WAREHOUSE_SORT_ROBOT.ultrasonic.height < CUBE_HEIGHT, 'the ultrasonic sensor sees a cube');
});

// =============================================================================================
// The robot
// =============================================================================================

test('robot: the Fire Rescue mBot2, with its Quad RGB sensor set to see a white line', () => {
  const { quadRgb, ...rest } = WAREHOUSE_SORT_ROBOT;
  const { quadRgb: standardQuad, ...standardRest } = DEFAULT_ROBOT_CONFIG;
  assert.deepEqual(rest, standardRest, 'everything else is the standard robot of Fire Rescue');
  assert.deepEqual(quadRgb, { ...standardQuad, lightLine: true, lineThreshold: 70 });
  assert.equal(DEFAULT_ROBOT_CONFIG.quadRgb.lightLine, undefined, 'the standard robot was not changed');
  assert.equal(WAREHOUSE_SORT_ROBOT.gripper.enabled, true);
  assert.equal(WAREHOUSE_SORT_ROBOT.frontColorSensor.enabled, true);
  assert.equal(WAREHOUSE_SORT_ROBOT.frontColorSensor.mount, undefined, 'the colour sensor at the claw');
  assert.equal(WAREHOUSE_SORT_ROBOT.fan, undefined);
  // the colours of the mat against the border of 70
  const reads = (c: RGB) => makeProbeReading(c, T, true).onLine;
  assert.equal(reads({ r: 255, g: 255, b: 255 }), true, 'white');
  assert.equal(reads({ r: 255, g: 242, b: 0 }), true, 'yellow');
  assert.equal(reads(GROUND), false, 'black ground');
  for (const [name, c] of [
    ['orange', { r: 247, g: 152, b: 15 }],
    ['green bay', { r: 66, g: 178, b: 60 }],
    ['red bay', { r: 169, g: 30, b: 41 }],
    ['pad', PICTURE_COLORS.pad],
    ['start art', PICTURE_COLORS.startArt],
    ['HOME hexagon', PICTURE_COLORS.homeHexagon],
    ['green bay picture', PICTURE_COLORS.greenBayPicture],
  ] as const) {
    assert.equal(reads(c), false, name);
  }
});

test('robot: it starts facing up, completely inside the start zone, on the middle of the long line', () => {
  assert.deepEqual(robotSize(WAREHOUSE_SORT_ROBOT), { length: 237, width: 130 });
  assert.equal(START_POSE.heading, START_HEADING);
  assert.equal(START_HEADING, 0, 'facing up');
  near(START_POSE.y, 1151.085, 1e-9);
  assert.equal(START_POSE.x, LONG_LINE_X);
  near(START_POSE.x, 630.055, 1e-9);
  assert.deepEqual(startPoseFor(WAREHOUSE_SORT_ROBOT), START_POSE);
  assert.ok(robotFitsInRect(WAREHOUSE_SORT_ROBOT, START_POSE, START_ZONE));
  // the room it has (the same as before the turn): 13.9 mm in front and behind, 73.4 mm on its left, 60.1 mm on its right
  const shapes = robotShapesAt(WAREHOUSE_SORT_ROBOT, START_POSE);
  const xs = shapes.flatMap((s) => obbCorners(s).map((c) => c.x));
  const ys = shapes.flatMap((s) => obbCorners(s).map((c) => c.y));
  near(Math.min(...ys) - START_ZONE.y, 13.915, 0.01, 'in front');
  near(START_ZONE.y + START_ZONE.h - Math.max(...ys), 13.915, 0.01, 'behind');
  near(Math.min(...xs) - START_ZONE.x, 73.395, 0.01, 'left');
  near(START_ZONE.x + START_ZONE.w - Math.max(...xs), 60.065, 0.01, 'right');
  const reach = robotReach(WAREHOUSE_SORT_ROBOT);
  assert.deepEqual(reach, { front: 167, rear: 70, halfWidth: 65 });
  // a pad is smaller than the robot: "entirely inside one circle" (rules §8) cannot happen
  for (const pad of PAD_IDS) {
    assert.ok(2 * FINISH_PADS[pad].rx < reach.front + reach.rear);
    // not even turned: the robot's footprint does not fit into a circle as wide as the pad
    assert.ok(Math.hypot(reach.front + reach.rear, 2 * reach.halfWidth) > 2 * FINISH_PADS[pad].rx);
  }
  // nothing of the robot is outside the start zone when it is placed there
  for (const shape of shapes) assert.ok(rectContainsOBB(START_ZONE, shape));
});
