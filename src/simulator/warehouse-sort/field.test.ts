/**
 * The Warehouse Sort field: its numbers against the print file, what the floor sensors see on
 * it (the vector mat against the sensor picture), the cubes and the robot in the start zone.
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
  LONG_LINE_Y,
  MAT_SIZE,
  MAT_VECTOR,
  MIDDLE_LINE_X,
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
 * The boxes of the vector shapes of the print file "Capelli_Inspire_1235mm.pdf", in points, as
 * pdftocairo -svg gives them (x0, y0, x1, y1; y down; the frames are the middle of their
 * stroke). field.ts holds them in mm: 1 pt = 1235 / 3500.79 mm, rounded to 0.01 mm.
 */
// prettier-ignore
const PRINT_FILE: Record<string, [number, number, number, number]> = {
  'line:loopTop': [1091.484, 779.363, 2421.691, 853.602],
  'line:loopBottom': [1093.910, 2552.195, 2421.691, 2626.434],
  'line:loopLeft': [1091.484, 802.777, 1165.922, 2626.434],
  'line:loopRight': [2347.258, 802.777, 2421.691, 2626.434],
  'line:barLeftUpper': [992.074, 1230.414, 1274.926, 1304.648],
  'line:barRightUpper': [2243.047, 1230.414, 2525.898, 1304.648],
  'line:barLeftLower': [992.074, 2125.469, 1274.926, 2199.703],
  'line:barRightLower': [2243.047, 2125.469, 2525.898, 2199.703],
  'line:middleUpper': [1718.996, 466.699, 1793.430, 2501.398],
  'line:middleLower': [1716.184, 2313.152, 1793.430, 2993.781],
  'line:long': [380.246, 1677.488, 2847.324, 1751.723],
  'line:leftUpper': [343.516, 630.645, 417.949, 1527.418],
  'line:leftMiddle': [343.027, 1484.051, 417.465, 2589.316],
  'line:leftLower': [343.590, 1894.086, 418.023, 2790.859],
  'line:leftTopT': [239.309, 557.977, 522.160, 632.215],
  'line:leftBottomT': [239.383, 2789.289, 522.234, 2863.523],
  'line:rightUpper': [3096.012, 563.578, 3170.445, 1432.051],
  'line:rightTopT': [2991.801, 545.199, 3274.656, 617.094],
  'line:rightLower': [3096.012, 2024.730, 3170.445, 2879.074],
  'line:rightBottomT': [2991.801, 2837.578, 3274.656, 2908.305],
  'band:0': [3.352, 0.004, 1369.973, 48.934],
  'band:1': [2164.016, 0.004, 3500.578, 49.953],
  'band:2': [0.000, 0.004, 56.691, 3500.578],
  'band:3': [3440.398, 0.004, 3496.086, 3500.578],
  'band:4': [3.801, 3444.703, 1370.422, 3500.578],
  'band:5': [2157.465, 3444.703, 3500.578, 3500.578],
  'frame:W1': [161.687, 153.547, 600.902, 465.512],
  'square:W1': [324.164, 253.613, 437.305, 366.449],
  'frame:W2': [2914.184, 153.547, 3353.398, 455.633],
  'square:W2': [3076.660, 250.438, 3189.797, 359.715],
  'frame:W3': [160.637, 2955.992, 599.852, 3267.957],
  'square:W3': [324.238, 3055.051, 437.379, 3167.891],
  'frame:W4': [2914.191, 2987.996, 3353.406, 3299.961],
  'square:W4': [3076.660, 3090.770, 3189.797, 3198.270],
  'bay:red': [1505.906, 1120.602, 2000.895, 1417.547],
  'bay:green': [1513.266, 2014.113, 2008.254, 2311.059],
  'sponsor': [1650.766, 1360.582, 1849.180, 2012.512],
  'sponsorInner': [1670.766, 1477.121, 1830.758, 1952.090],
  // the middle of the start zone's frame; its right side lies off the page (clipped)
  'startFrame': [2758.078, 1368.090, 3509.500, 2098.906],
};

/** The ellipses of the print file: the pads (yellow, 4 curves each) and the clip of the green bay's picture. */
const PRINT_ELLIPSES = {
  top: { x0: 1528.871, y0: 186.730, x1: 1982.922, y1: 632.148 },
  bottom: { x0: 1530.773, y0: 2791.961, x1: 1984.824, y1: 3237.379 },
  greenBayPicture: { x0: 1617.211, y0: 2020.113, x1: 1890.281, y1: 2300.512 },
};

function fieldRects(): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const [name, rect] of Object.entries(WHITE_LINES)) out[`line:${name}`] = rect;
  YELLOW_BANDS.forEach((rect, i) => (out[`band:${i}`] = rect));
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

test('field: every rectangle is the one in the print file, to 0.01 mm', () => {
  const rects = fieldRects();
  assert.deepEqual(Object.keys(rects).sort(), Object.keys(PRINT_FILE).sort());
  for (const [name, [x0, y0, x1, y1]] of Object.entries(PRINT_FILE)) {
    const r = rects[name];
    near(r.x, x0 * MM_PER_PT, 0.006, `${name} x`);
    near(r.y, y0 * MM_PER_PT, 0.006, `${name} y`);
    near(r.w, (x1 - x0) * MM_PER_PT, 0.006, `${name} w`);
    // (the left and right bands run the whole height: field.ts lets them reach the edge of the mat, 0.07 mm further)
    if (name === 'band:2' || name === 'band:3') assert.equal(r.y + r.h, MAT_SIZE, name);
    else near(r.h, (y1 - y0) * MM_PER_PT, 0.006, `${name} h`);
  }
  // the frames: 16 pt and 1 pt wide
  near(START_FRAME_WIDTH, 16 * MM_PER_PT, 0.005, 'start frame width');
  near(WAREHOUSE_FRAME_WIDTH, MM_PER_PT, 0.005, 'warehouse frame width');
  // the ellipses
  for (const [name, e] of [
    ['top', FINISH_PADS.top],
    ['bottom', FINISH_PADS.bottom],
    ['greenBayPicture', GREEN_BAY_PICTURE],
  ] as const) {
    const p = PRINT_ELLIPSES[name];
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
  // the long line runs from the left vertical line into the start zone; the start pose looks along it
  assert.ok(WHITE_LINES.long.x < WHITE_LINES.leftMiddle.x + WHITE_LINES.leftMiddle.w);
  assert.ok(WHITE_LINES.long.x + WHITE_LINES.long.w > START_ZONE.x + 30);
  near(LONG_LINE_Y, 604.875, 0.001);
  near(MIDDLE_LINE_X, 619.55, 0.001);
  // the orange square sits in the middle of its yellow frame (to 0.3 mm)
  for (const w of WAREHOUSE_IDS) {
    const { frame, square } = WAREHOUSES[w];
    near(square.x + square.w / 2, frame.x + frame.w / 2, 0.3, `${w} x`);
    near(square.y + square.h / 2, frame.y + frame.h / 2, 0.3, `${w} y`);
    near(square.w, 39.91, 0.01, `${w} square width`);
    assert.ok(square.h >= 37.9 && square.h <= 39.82, `${w} square height ${square.h}`);
    near(frame.w, 154.95, 0.01, `${w} frame width`);
  }
  assert.deepEqual(WAREHOUSES.W1.place, 'top left');
  assert.deepEqual(WAREHOUSES.W4.place, 'bottom right');
  // the bays: the same size, red above the logo, green below it
  assert.equal(BAYS.red.w, BAYS.green.w);
  assert.equal(BAYS.red.h, BAYS.green.h);
  near(BAYS.red.w, 174.62, 0.001);
  near(BAYS.red.h, 104.76, 0.001);
  assert.ok(BAYS.red.y + BAYS.red.h < BAYS.green.y);
  // the pads: 160.18 x 157.13 mm, at the two ends of the middle line
  for (const pad of PAD_IDS) {
    near(2 * FINISH_PADS[pad].rx, 160.18, 0.01);
    near(2 * FINISH_PADS[pad].ry, 157.13, 0.01);
    near(FINISH_PADS[pad].cx, MIDDLE_LINE_X, 1);
  }
  // the start zone: the yellow frame (outer edge) to the right edge of the mat
  near(START_ZONE.x, 970.17, 0.005);
  near(START_ZONE.y, 479.81, 0.005);
  near(START_ZONE.w, 264.83, 0.005);
  near(START_ZONE.h, 263.46, 0.005);
  assert.equal(START_ZONE.x + START_ZONE.w, MAT_SIZE);
  assert.equal(START_ART.x + START_ART.w, MAT_SIZE);
  // the white rectangle of the logo: the red bay covers its top, the green bay starts 0.56 mm under it
  assert.ok(SPONSOR_RECT.y < BAYS.red.y + BAYS.red.h);
  near(BAYS.green.y - (SPONSOR_RECT.y + SPONSOR_RECT.h), 0.56, 0.01);
  // the table around the mat: the engine's strip, 100 mm
  assert.equal(TABLE_STRIP, TABLE_MARGIN);
  assert.equal(TABLE_STRIP, 100);
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
  for (const p of HOME_HEXAGON) assert.ok(p.x > BAYS.red.x + 30 && p.x < BAYS.red.x + BAYS.red.w - 30 && p.y > BAYS.red.y + 10 && p.y < BAYS.red.y + BAYS.red.h - 10);
  assert.equal(ellipseOutline(FINISH_PADS.top).length, 72);
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
 * when the pictures were made; its numbers are in the report of that work.)
 */
// prettier-ignore
const PICTURE_POINTS: Array<[string, number, number, string, boolean]> = [
  ['loop, top', 619.68, 288.04, 'white', true],
  ['loop, bottom', 620.12, 913.46, 'white', true],
  ['loop, left', 398.18, 604.87, 'white', true],
  ['loop, right', 841.19, 604.87, 'white', true],
  ['bar, left upper', 399.87, 447.16, 'white', true],
  ['bar, right lower', 841.19, 762.92, 'white', true],
  ['middle line, upper', 619.55, 523.54, 'white', true],
  ['middle line, lower', 619.05, 936.09, 'white', true],
  ['long line', 569.31, 604.88, 'white', true],
  ['left line', 134.14, 718.5, 'white', true],
  ['left T-end, top', 134.31, 209.94, 'white', true],
  ['right line, upper', 1105.33, 352.01, 'white', true],
  ['right T-end, bottom', 1105.34, 1013.5, 'white', true],
  ['ground', 300, 150, 'black', false],
  ['ground', 900, 1100, 'black', false],
  ['ground', 1000, 400, 'black', false],
  ['red bay', 550, 410, 'red', false],
  ['red bay', 690, 490, 'red', false],
  ['green bay', 550, 800, 'green', false],
  ['green bay', 700, 720, 'green', false],
  ['orange square W1', 134.31, 109.38, 'yellow', false],
  ['orange square W4', 1105.34, 1109.31, 'yellow', false],
  ['yellow band, left', 10, 600, 'yellow', true],
  ['yellow band, top', 200, 8, 'yellow', true],
  ['yellow band, bottom', 1000, 1225, 'yellow', true],
  ['start zone art', 1180, 530, 'black', false],
  ['logo: white on the long line', 590, 604.9, 'white', true],
  ['logo: a letter on the long line', 614, 595, 'black', false],
  ['logo: a letter on the middle line', 607, 644, 'black', false],
  ['logo: a letter', 621, 637, 'black', false],
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
  // across the long line (y 591.78 .. 617.97)
  assert.ok(isGround(mat.sample(300, 591.6)));
  assert.ok(isWhite(mat.sample(300, 591.9)));
  assert.ok(isWhite(mat.sample(300, 617.9)));
  assert.ok(isGround(mat.sample(300, 618.1)));
  // the middle line runs under the red bay and under the pads
  assert.equal(named(MIDDLE_LINE_X, 400), 'red');
  assert.equal(named(MIDDLE_LINE_X, 450), 'white', 'the HOME picture (its average colour)');
  assert.equal(named(MIDDLE_LINE_X, 260), 'white', 'between the pad and the loop');
  assert.deepEqual(mat.sample(MIDDLE_LINE_X, 200), PICTURE_COLORS.pad, 'under the top pad');
  assert.equal(lineAt(MIDDLE_LINE_X, 200), false, 'under the top pad');
  // the lines on the right are printed over the start zone's frame and art
  assert.equal(named(1105, 500), 'white');
  assert.equal(named(990, 604.9), 'white', 'the long line, 20 mm into the start zone');
  assert.equal(named(1010, 604.9), 'black', 'the start-zone art beyond its end');
  // the frame of the start zone
  assert.equal(named(971, 550), 'yellow');
  assert.equal(named(1050, 480.5), 'yellow');
  assert.equal(named(1100, 480.5), 'white', 'the right line is printed over the frame');
  // the letters of the logo are on top of the white lines, with holes
  assert.equal(named(614, 595), 'black');
  // off the mat: the table
  assert.deepEqual(mat.sample(-5, 600), MAT_VECTOR.outside);
  assert.deepEqual(mat.sample(600, 1236), MAT_VECTOR.outside);
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
    assert.ok(CUBE_SIZE >= s.w && CUBE_SIZE - s.w <= 2.2 && CUBE_SIZE - s.h <= 2.2, w);
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

test('robot: it starts facing left, completely inside the start zone, on the middle of the long line', () => {
  assert.deepEqual(robotSize(WAREHOUSE_SORT_ROBOT), { length: 237, width: 130 });
  assert.equal(START_POSE.heading, START_HEADING);
  near(START_HEADING, -90 * DEG, 1e-12);
  near(START_POSE.x, 1151.085, 1e-9);
  assert.equal(START_POSE.y, LONG_LINE_Y);
  assert.deepEqual(startPoseFor(WAREHOUSE_SORT_ROBOT), START_POSE);
  assert.ok(robotFitsInRect(WAREHOUSE_SORT_ROBOT, START_POSE, START_ZONE));
  // the room it has: 13.9 mm in front and behind, 60.1 mm above, 73.4 mm below
  const shapes = robotShapesAt(WAREHOUSE_SORT_ROBOT, START_POSE);
  const xs = shapes.flatMap((s) => obbCorners(s).map((c) => c.x));
  const ys = shapes.flatMap((s) => obbCorners(s).map((c) => c.y));
  near(Math.min(...xs) - START_ZONE.x, 13.915, 0.01, 'in front');
  near(START_ZONE.x + START_ZONE.w - Math.max(...xs), 13.915, 0.01, 'behind');
  near(Math.min(...ys) - START_ZONE.y, 60.07, 0.01, 'above');
  near(START_ZONE.y + START_ZONE.h - Math.max(...ys), 73.40, 0.01, 'below');
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
