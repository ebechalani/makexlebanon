/**
 * The Locker Room field: its numbers against the print file (the InDesign file of the mat), what
 * the floor sensors see on it (the vector mat against the sensor picture), the marks and the one
 * table of their roles, the cube of the published STL, and the robot in the Locker Room.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLE_MARGIN } from '../core/engine';
import { classifyColor, lightOf, makeProbeReading } from '../core/engine-sensors';
import { obbCorners, rectContainsOBB, type OBB, type Rect } from '../core/geometry';
import { VectorMatSampler } from '../core/mat';
import { robotFitsInRect, robotShapesAt, robotSize } from '../core/robot';
import type { RGB } from '../core/types';
import { WAREHOUSE_SORT_ROBOT } from '../warehouse-sort/robot';
import { CUBE_SIZE as WAREHOUSE_CUBE } from '../warehouse-sort/field';
import {
  BAND_BOTTOM_RIGHT,
  BIG_CIRCLES,
  BOTTOM_LINE_Y,
  CARD,
  COACH_BADGE,
  CUBE_HEIGHT,
  CUBE_MASS,
  CUBE_SIZE,
  CYAN,
  FRAME_WIDTH,
  GATE_DASH,
  GATE_HEIGHT,
  GATE_LINE_WIDTH,
  GATE_MARK,
  GREEN,
  GROUND,
  HIDDEN_ORANGE_SQUARES,
  LINE_WIDTH,
  LOCKER_ART,
  LOCKER_ROOM,
  LOCKER_ROOM_FRAME,
  LOGOS,
  LOGO_BOXES,
  MAKEX_LOGO,
  MARKS,
  MARK_ROLES,
  MAT_SIZE,
  MAT_VECTOR,
  MM_PER_PT,
  PAGE_PT,
  PICTURE_COLORS,
  RED,
  RED_LOGO_CLIP_X,
  SCAN_GLOW,
  SCAN_STATION,
  SCAN_STATION_FRAME,
  TABLE_STRIP,
  TEAM_BOX,
  TURNED_LINES,
  WHITE_LINES,
  YELLOW,
  YELLOW_BANDS,
  YELLOW_PIECES,
  ZONES,
  ZONE_IDS,
  frameSides,
  gateDashes,
  MARK_IDS,
  ROLE_WORD,
  marksWithoutRole,
  pickupZone,
  targetOf,
  type MarkId,
} from './field';
import { LIGHT_LINE_THRESHOLD, LOCKER_ROOM_ROBOT, START_HEADING, START_POSE, robotReach, startPoseFor } from './robot';

const near = (actual: number, expected: number, eps: number, what = 'value') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: ${actual} is not within ${eps} of ${expected}`);

const mat = new VectorMatSampler(MAT_VECTOR);
const T = LIGHT_LINE_THRESHOLD;
const pt = (v: number) => v * MM_PER_PT;

// =============================================================================================
// The numbers against the print file
// =============================================================================================

/**
 * The boxes of the shapes of the print file "Capelli-Starter_1235mm.idml" (Spreads/Spread_u4f9.xml),
 * in points on the page (x0, y0, x1, y1; y down), from the anchors of their paths after every
 * transform, by the id the print file gives them. field.ts holds them in mm, rounded to 0.01 mm.
 * (For the picture frames: the frame; for the strokes: the middle of the stroke.)
 */
// prettier-ignore
const PRINT_FILE: Record<string, [number, number, number, number]> = {
  u518: [1264.810, 1262.645, 2226.971, 1336.887], // mazeTop
  u519: [1264.810, 1285.965, 1339.053, 2193.188], // mazeLeft
  u51a: [2152.729, 1262.645, 2226.971, 2224.806], // mazeRight
  u51b: [1264.810, 2151.612, 2226.971, 2225.854], // mazeBottom
  u51c: [2048.794, 1706.604, 2330.909, 1780.846], // mazeStubRight
  u51d: [1160.875, 1706.604, 1442.988, 1780.846], // mazeStubLeft
  u51e: [728.813, 2152.049, 1336.518, 2226.291], // linkBottom
  u51f: [669.240, 2049.160, 741.898, 2331.275], // longBottom
  u520: [729.862, 1706.604, 1337.567, 1782.099], // linkMiddle
  u521: [669.240, 1603.922, 741.898, 1886.037], // longMiddle
  u522: [729.862, 1262.622, 1337.567, 1336.861], // linkTop
  u524: [668.038, 1158.684, 742.277, 1440.799], // longTop
  u526: [1615.711, 640.066, 1897.826, 714.305], // treeTopT
  u527: [895.643, 863.478, 1760.805, 937.718], // crossLeft
  u528: [1724.805, 863.478, 2589.968, 937.718], // crossRight
  u551: [1719.567, 703.176, 1793.809, 1123.651], // treeUpper
  u553: [1718.546, 899.915, 1792.786, 1326.246], // treeLower
  u53c: [645.471, 3104.070, 2844.655, 3178.312], // bottom
  u54e: [2281.975, 1706.604, 2697.724, 1781.912], // rightLink
  u552: [3111.126, 2200.090, 3186.632, 2861.291], // rightDown
  u52e: [668.271, 1438.900, 742.510, 1605.200], // yellow piece, upper
  u52f: [668.271, 1885.187, 742.510, 2051.487], // yellow piece, lower
  u530: [10.397, 0.000, 1373.460, 56.693], // band, top left
  u531: [2152.466, 0.000, 3515.525, 56.693], // band, top right (runs off the page)
  u532: [-23.751, -25.095, 56.693, 3516.188], // band, left
  u533: [3444.094, -26.952, 3500.787, 3515.287], // band, right
  u577: [8.257, 3444.489, 1371.317, 3500.787], // band, bottom left
  u534: [-3.300, 2798.824, 699.710, 3501.831], // Locker Room (picture frame, 34 pt stroke)
  u537: [2801.418, 2803.331, 3504.427, 3506.338], // Scan Station (34 pt stroke)
  u538: [1517.808, 66.813, 2016.706, 207.065], // MakeX Lebanon logo
  u53d: [2878.954, 2877.293, 3417.537, 3414.991], // coach-approval picture
  u540: [283.504, 2117.832, 450.207, 2282.352], // zone A picture frame
  u545: [283.504, 1649.265, 450.207, 1813.785], // zone B picture frame
  u54a: [291.444, 1215.201, 458.144, 1379.721], // zone C picture frame
  u558: [1612.324, 246.917, 1909.287, 425.095], // light-blue rectangle
  u55a: [1559.917, 1550.599, 1946.137, 1936.820], // the round picture in the maze (blue disc)
  u560: [1703.407, 1376.169, 1822.192, 1494.955], // red square in the maze
  u563: [1703.407, 1990.769, 1822.192, 2109.552], // green square in the maze
  u566: [2846.656, 1139.100, 3433.263, 1725.707], // big red circle (its four anchors)
  u567: [1472.165, 2349.850, 2063.089, 2940.775], // big green circle (3 pt outline)
  u568: [1220.162, 2349.941, 1383.701, 2595.317], // the gate's dotted rectangle (8 pt dashed stroke)
  u586: [2875.601, 1331.152, 3374.498, 1533.654], // the frame of the red circle's logo
  u52c: [83.475, 2824.492, 202.260, 2943.275], // hidden: yellow square, Locker Room
  u52d: [86.445, 2827.460, 199.290, 2940.307], // hidden: orange square, Locker Room
  u529: [3297.523, 2823.491, 3416.306, 2942.277], // hidden: yellow square, Scan Station
  u52a: [3300.491, 2826.459, 3413.339, 2939.306], // hidden: orange square, Scan Station
};

/** The four corners of the turned shapes (points). */
// prettier-ignore
const PRINT_FILE_TURNED: Record<string, Array<[number, number]>> = {
  u525: [[472.107, 657.434], [524.605, 709.931], [724.090, 510.446], [671.593, 457.948]], // treeLeftT
  u550: [[645.548, 584.802], [593.050, 637.296], [894.515, 938.758], [947.010, 886.263]], // treeLeftDiagonal
  u569: [[3011.457, 656.393], [2958.959, 708.891], [2759.474, 509.406], [2811.971, 456.908]], // treeRightT
  u56a: [[2838.016, 583.761], [2890.514, 636.256], [2589.052, 937.718], [2536.554, 885.223]], // treeRightDiagonal
  u54f: [[2699.152, 1709.929], [2646.655, 1762.427], [3134.137, 2249.906], [3186.632, 2197.412]], // rightDiagonal
  u556: [[328.827, 503.994], [538.812, 294.009], [412.821, 168.018], [202.836, 378.003]], // red rectangle, top left
  u557: [[2957.063, 295.055], [3167.048, 505.040], [3293.036, 379.049], [3083.054, 169.067]], // green rectangle, top right
  u578: [[2128.258, 3503.180], [3491.317, 3503.180], [3488.318, 3444.094], [2125.259, 3444.094]], // band, bottom right
};

/** The pictures placed in the frames (points): zone pictures sit 8 pt to the right in their frames; the logos' boxes. */
// prettier-ignore
const PICTURES: Record<string, [number, number, number, number]> = {
  u540: [291.504, 2118.830, 458.206, 2283.352],
  u545: [291.504, 1650.266, 458.206, 1814.786],
  u54a: [299.443, 1216.202, 466.143, 1380.722],
  u567: [1526.808, 2569.317, 2025.706, 2721.314], // the logo in the green circle
  u586: [2896.603, 1376.169, 3395.500, 1533.654], // the logo in the red circle
};

const rectOf = ([x0, y0, x1, y1]: [number, number, number, number]): Rect => ({ x: pt(x0), y: pt(y0), w: pt(x1 - x0), h: pt(y1 - y0) });
const clipToMat = (r: Rect): Rect => {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  return { x: x0, y: y0, w: Math.min(MAT_SIZE, r.x + r.w) - x0, h: Math.min(MAT_SIZE, r.y + r.h) - y0 };
};
function sameRect(actual: Rect, expected: Rect, what: string, eps = 0.006) {
  near(actual.x, expected.x, eps, `${what} x`);
  near(actual.y, expected.y, eps, `${what} y`);
  near(actual.w, expected.w, 2 * eps, `${what} w`);
  near(actual.h, expected.h, 2 * eps, `${what} h`);
}

test('field: the mat is 1235 mm square, 3500.787 points in the print file', () => {
  assert.equal(MAT_SIZE, 1235);
  near(PAGE_PT, (1235 / 25.4) * 72, 1e-9, 'the page');
  near(MM_PER_PT, 25.4 / 72, 1e-12, '1 pt');
  assert.deepEqual([MAT_VECTOR.width, MAT_VECTOR.height], [1235, 1235]);
  assert.deepEqual(MAT_VECTOR.background, GROUND);
  // the colours of the organiser's render (rules v2.3, page 2)
  assert.deepEqual(GROUND, { r: 35, g: 31, b: 32 });
  assert.deepEqual(YELLOW, { r: 255, g: 241, b: 0 });
  assert.deepEqual(RED, { r: 240, g: 63, b: 69 });
  assert.deepEqual(GREEN, { r: 61, g: 174, b: 72 });
  assert.deepEqual(CYAN, { r: 0, g: 173, b: 238 });
  // the table around the mat: the engine's strip, 100 mm on every side
  assert.equal(TABLE_STRIP, TABLE_MARGIN);
  assert.equal(TABLE_STRIP, 100);
});

test('field: every white line, the yellow pieces and the bands are the ones of the print file, to 0.01 mm', () => {
  const lines: Record<string, string> = {
    mazeTop: 'u518', mazeLeft: 'u519', mazeRight: 'u51a', mazeBottom: 'u51b', mazeStubRight: 'u51c', mazeStubLeft: 'u51d',
    linkBottom: 'u51e', longBottom: 'u51f', linkMiddle: 'u520', longMiddle: 'u521', linkTop: 'u522', longTop: 'u524',
    treeTopT: 'u526', crossLeft: 'u527', crossRight: 'u528', treeUpper: 'u551', treeLower: 'u553', bottom: 'u53c',
    rightLink: 'u54e', rightDown: 'u552',
  };
  assert.deepEqual(Object.keys(lines).sort(), Object.keys(WHITE_LINES).sort());
  for (const [name, id] of Object.entries(lines)) sameRect(WHITE_LINES[name as keyof typeof WHITE_LINES], rectOf(PRINT_FILE[id]), name);
  sameRect(YELLOW_PIECES.upper, rectOf(PRINT_FILE.u52e), 'yellow piece, upper');
  sameRect(YELLOW_PIECES.lower, rectOf(PRINT_FILE.u52f), 'yellow piece, lower');
  const turned: Record<string, string> = { treeLeftT: 'u525', treeLeftDiagonal: 'u550', treeRightT: 'u569', treeRightDiagonal: 'u56a', rightDiagonal: 'u54f' };
  assert.deepEqual(Object.keys(turned).sort(), Object.keys(TURNED_LINES).sort());
  for (const [name, id] of Object.entries(turned)) {
    const points = TURNED_LINES[name as keyof typeof TURNED_LINES];
    PRINT_FILE_TURNED[id].forEach(([x, y], i) => {
      near(points[i].x, pt(x), 0.006, `${name} corner ${i} x`);
      near(points[i].y, pt(y), 0.006, `${name} corner ${i} y`);
    });
  }
  // the bands, cut at the edges of the mat
  sameRect(YELLOW_BANDS.topLeft, clipToMat(rectOf(PRINT_FILE.u530)), 'band top left');
  sameRect(YELLOW_BANDS.topRight, clipToMat(rectOf(PRINT_FILE.u531)), 'band top right');
  sameRect(YELLOW_BANDS.left, clipToMat(rectOf(PRINT_FILE.u532)), 'band left');
  sameRect(YELLOW_BANDS.right, clipToMat(rectOf(PRINT_FILE.u533)), 'band right');
  sameRect(YELLOW_BANDS.bottomLeft, clipToMat(rectOf(PRINT_FILE.u577)), 'band bottom left');
  const br = PRINT_FILE_TURNED.u578.map(([x, y]) => ({ x: pt(x), y: pt(y) }));
  near(BAND_BOTTOM_RIGHT[0].x, br[3].x, 0.006);
  near(BAND_BOTTOM_RIGHT[1].x, br[2].x, 0.006);
  // (cut at the bottom edge: the slanted ends, followed down to y 1235)
  const at = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x + ((MAT_SIZE - a.y) / (b.y - a.y)) * (b.x - a.x);
  near(BAND_BOTTOM_RIGHT[2].x, at(br[2], br[1]), 0.006);
  near(BAND_BOTTOM_RIGHT[3].x, at(br[3], br[0]), 0.006);
  // the gaps of the band: top x 484.53 .. 759.34, bottom x 483.77 .. 749.74
  near(YELLOW_BANDS.topLeft.x + YELLOW_BANDS.topLeft.w, 484.53, 0.005);
  near(YELLOW_BANDS.topRight.x, 759.34, 0.005);
  near(YELLOW_BANDS.bottomLeft.x + YELLOW_BANDS.bottomLeft.w, 483.77, 0.005);
  near(BAND_BOTTOM_RIGHT[0].x, 749.74, 0.005);
  // most lines are 26.19 mm wide (74.24 pt); three pieces 25.63, 26.57 and 26.63
  near(LINE_WIDTH, pt(74.24), 0.005);
  for (const [name, r] of Object.entries(WHITE_LINES)) {
    const width = Math.min(r.w, r.h);
    assert.ok(width >= 25.6 && width <= 26.65, `${name}: ${width}`);
  }
  near(BOTTOM_LINE_Y, 1108.145, 0.001);
});

test('field: the two zones, the frames, the pictures, the marks, the circles and the gate are the ones of the print file', () => {
  // the frames are 34 pt wide, centred on the frame's rectangle
  near(FRAME_WIDTH, pt(34), 0.005, 'frame width');
  sameRect(LOCKER_ROOM_FRAME, rectOf(PRINT_FILE.u534), 'Locker Room frame');
  sameRect(SCAN_STATION_FRAME, rectOf(PRINT_FILE.u537), 'Scan Station frame');
  // the zones: inside the outer edge of the frame, to the edges of the mat
  sameRect(LOCKER_ROOM, clipToMat({ x: pt(-3.3 - 17), y: pt(2798.824 - 17), w: pt(699.71 - -3.3 + 34), h: pt(3501.831 - 2798.824 + 34) }), 'Locker Room', 0.01);
  sameRect(SCAN_STATION, clipToMat({ x: pt(2801.418 - 17), y: pt(2803.331 - 17), w: pt(3504.427 - 2801.418 + 34), h: pt(3506.338 - 2803.331 + 34) }), 'Scan Station', 0.01);
  near(LOCKER_ROOM.w, 252.84, 0.01);
  near(LOCKER_ROOM.h, 253.64, 0.01);
  near(SCAN_STATION.w, 252.72, 0.01);
  near(SCAN_STATION.h, 252.05, 0.01);
  assert.equal(LOCKER_ROOM.x, 0);
  assert.equal(LOCKER_ROOM.y + LOCKER_ROOM.h, MAT_SIZE);
  assert.equal(SCAN_STATION.x + SCAN_STATION.w, MAT_SIZE);
  assert.equal(SCAN_STATION.y + SCAN_STATION.h, MAT_SIZE);
  // the pictures fill their frames (cut by them and by the mat)
  sameRect(LOCKER_ART, clipToMat(rectOf(PRINT_FILE.u534)), 'Locker Room art');
  sameRect(SCAN_GLOW, clipToMat(rectOf(PRINT_FILE.u537)), 'Scan Station glow');
  sameRect(MAKEX_LOGO, rectOf(PRINT_FILE.u538), 'MakeX logo');
  const badge = rectOf(PRINT_FILE.u53d);
  near(COACH_BADGE.cx, badge.x + badge.w / 2, 0.006);
  near(COACH_BADGE.cy, badge.y + badge.h / 2, 0.006);
  near(COACH_BADGE.r, badge.h / 2, 0.006, 'the circle inside the frame');
  // the zone pictures: what shows of each picture in its frame
  for (const [zone, id] of [['A', 'u540'], ['B', 'u545'], ['C', 'u54a']] as const) {
    const frame = rectOf(PRINT_FILE[id]);
    const picture = rectOf(PICTURES[id]);
    const x0 = Math.max(frame.x, picture.x);
    const y0 = Math.max(frame.y, picture.y);
    const x1 = Math.min(frame.x + frame.w, picture.x + picture.w);
    const y1 = Math.min(frame.y + frame.h, picture.y + picture.h);
    sameRect(ZONES[zone], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, `zone ${zone}`);
  }
  // A is the lowest, C the top one, all three on the left of the long line
  assert.ok(ZONES.A.y > ZONES.B.y && ZONES.B.y > ZONES.C.y);
  for (const zone of ZONE_IDS) assert.ok(ZONES[zone].x + ZONES[zone].w < WHITE_LINES.longTop.x);
  // the marks
  const corners = (id: MarkId) => obbCorners(MARKS[id].box as OBB);
  for (const [id, source] of [['redDiamond', 'u556'], ['greenDiamond', 'u557']] as const) {
    const expected = PRINT_FILE_TURNED[source].map(([x, y]) => ({ x: pt(x), y: pt(y) }));
    for (const c of corners(id)) {
      assert.ok(expected.some((e) => Math.hypot(e.x - c.x, e.y - c.y) < 0.01), `${id}: corner ${c.x}, ${c.y}`);
    }
  }
  for (const [id, source] of [['cyanRect', 'u558'], ['redSquare', 'u560'], ['greenSquare', 'u563']] as const) {
    const r = rectOf(PRINT_FILE[source]);
    const box = MARKS[id].box as OBB;
    near(box.x, r.x + r.w / 2, 0.006, `${id} x`);
    near(box.y, r.y + r.h / 2, 0.006, `${id} y`);
    near(box.w, r.w, 0.006, `${id} w`);
    near(box.l, r.h, 0.006, `${id} l`);
    assert.equal(box.angle, 0);
  }
  // the three rectangles at the top are of one size: 104.76 x 62.86 mm
  for (const id of ['redDiamond', 'greenDiamond', 'cyanRect'] as const) {
    const box = MARKS[id].box as OBB;
    assert.deepEqual([Math.max(box.w, box.l), Math.min(box.w, box.l)], [104.76, 62.86], id);
  }
  near(Math.abs((MARKS.redDiamond.box as OBB).angle), Math.PI / 4, 1e-12);
  // the blue disc: the circle inside its picture frame
  const disc = rectOf(PRINT_FILE.u55a);
  const c = MARKS.blueDisc.circle!;
  near(c.cx, disc.x + disc.w / 2, 0.006);
  near(c.cy, disc.y + disc.h / 2, 0.006);
  near(c.r, disc.w / 2, 0.006);
  // the big circles; the green one has a 3 pt outline of the same green
  const red = rectOf(PRINT_FILE.u566);
  near(BIG_CIRCLES.red.cx, red.x + red.w / 2, 0.006);
  near(BIG_CIRCLES.red.cy, red.y + red.h / 2, 0.006);
  near(BIG_CIRCLES.red.r, red.w / 2, 0.006);
  const green = rectOf(PRINT_FILE.u567);
  near(BIG_CIRCLES.green.cx, green.x + green.w / 2, 0.006);
  near(BIG_CIRCLES.green.cy, green.y + green.h / 2, 0.006);
  near(BIG_CIRCLES.green.r, green.w / 2 + pt(1.5), 0.006);
  // the gate's dotted rectangle: 8 pt line, dashes of 12 pt
  sameRect(GATE_MARK, rectOf(PRINT_FILE.u568), 'gate');
  near(GATE_LINE_WIDTH, pt(8), 0.005);
  near(GATE_DASH, pt(12), 0.005);
  // the logos' boxes, and the frame that cuts the red one
  sameRect(LOGO_BOXES.red, rectOf(PICTURES.u586), 'red logo');
  sameRect(LOGO_BOXES.green, rectOf(PICTURES.u567), 'green logo');
  near(RED_LOGO_CLIP_X, pt(PRINT_FILE.u586[2]), 0.006);
  // the hidden orange squares: their numbers, and they lie under the pictures painted over them
  sameRect(HIDDEN_ORANGE_SQUARES.lockerRoom.outline, rectOf(PRINT_FILE.u52c), 'hidden outline, Locker Room');
  sameRect(HIDDEN_ORANGE_SQUARES.lockerRoom.square, rectOf(PRINT_FILE.u52d), 'hidden square, Locker Room');
  sameRect(HIDDEN_ORANGE_SQUARES.scanStation.outline, rectOf(PRINT_FILE.u529), 'hidden outline, Scan Station');
  sameRect(HIDDEN_ORANGE_SQUARES.scanStation.square, rectOf(PRINT_FILE.u52a), 'hidden square, Scan Station');
  const inside = (outer: Rect, r: Rect) => r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
  assert.ok(inside(LOCKER_ART, HIDDEN_ORANGE_SQUARES.lockerRoom.outline));
  assert.ok(inside(SCAN_GLOW, HIDDEN_ORANGE_SQUARES.scanStation.outline));
});

test('field: the gate\'s dotted line has a dash on every corner: 8 on the short sides, 11 on the long ones, as printed', () => {
  const dashes = gateDashes();
  assert.equal(dashes.length, 2 * 8 + 2 * 11);
  for (const d of dashes) assert.ok(Math.min(d.w, d.h) === GATE_LINE_WIDTH && Math.max(d.w, d.h) <= GATE_DASH + GATE_LINE_WIDTH / 2 + 1e-9);
  // the four corners are covered
  for (const [x, y] of [[GATE_MARK.x, GATE_MARK.y], [GATE_MARK.x + GATE_MARK.w, GATE_MARK.y + GATE_MARK.h]]) {
    assert.equal(classifyColor(mat.sample(x, y)), 'yellow');
  }
  assert.equal(classifyColor(mat.sample(GATE_MARK.x + GATE_MARK.w / 2, GATE_MARK.y + GATE_MARK.h / 2)), 'black', 'inside the dotted line: the ground');
  // the frame of a zone has square corners, as InDesign prints a 34 pt stroke on a rectangle
  const sides = frameSides({ x: 0, y: 0, w: 100, h: 100 }, 10);
  assert.deepEqual(sides[0], { x: -5, y: -5, w: 110, h: 10 });
});

// =============================================================================================
// The one table of the roles of the marks (decided by the organiser)
// =============================================================================================

test('the marks (decided by the organiser): the team cubes start on the squares in the maze, the tokens go to the warehouses at the top', () => {
  assert.deepEqual(MARK_ROLES, {
    pickup: { red: 'redSquare', green: 'greenSquare' },
    target: { red: 'redDiamond', green: 'greenDiamond', blue: 'cyanRect' },
  });
  assert.deepEqual(ROLE_WORD, { pickup: 'pickup zone', target: 'warehouse' });
  // every role is a mark of its own colour, no mark has two roles, and the blue disc has none
  for (const color of ['red', 'green'] as const) assert.equal(pickupZone(color).color, color);
  for (const color of ['red', 'green', 'blue'] as const) assert.equal(targetOf(color).color, color);
  const used = [...Object.values(MARK_ROLES.pickup), ...Object.values(MARK_ROLES.target)];
  assert.equal(new Set(used).size, used.length);
  assert.deepEqual(marksWithoutRole().map((mark) => mark.id), ['blueDisc']);
  assert.deepEqual([...MARK_IDS].sort(), Object.keys(MARKS).sort());
  // the pickup zones are "the squares in center": inside the maze, the red one above its middle, the green one below
  const maze = { x: WHITE_LINES.mazeLeft.x, y: WHITE_LINES.mazeTop.y, w: WHITE_LINES.mazeRight.x + WHITE_LINES.mazeRight.w - WHITE_LINES.mazeLeft.x, h: WHITE_LINES.mazeBottom.y + WHITE_LINES.mazeBottom.h - WHITE_LINES.mazeTop.y };
  for (const color of ['red', 'green'] as const) assert.ok(rectContainsOBB(maze, pickupZone(color).box as OBB), color);
  const middle = maze.y + maze.h / 2;
  assert.ok((pickupZone('red').box as OBB).y < middle && (pickupZone('green').box as OBB).y > middle);
  // "the warehouses are on the top of the map": red at the top left, blue in the middle, green at the top right
  for (const color of ['red', 'green', 'blue'] as const) assert.ok((targetOf(color).box as OBB).y < WHITE_LINES.treeTopT.y, color);
  assert.ok((targetOf('red').box as OBB).x < (targetOf('blue').box as OBB).x && (targetOf('blue').box as OBB).x < (targetOf('green').box as OBB).x);
  near((targetOf('blue').box as OBB).x, MAT_SIZE / 2, 5, 'the BLUE one in the middle (3.7 mm right of it)');
  assert.deepEqual(['red', 'green', 'blue'].map((color) => targetOf(color as 'red').place), ['at the top left', 'at the top right', 'at the top in the middle']);
});

// =============================================================================================
// The cubes
// =============================================================================================

test('cubes: the published "Inspire + Starter cube" - 50 x 50 mm, 70 mm high, light; not the 40 mm Warehouse Sort assumes', () => {
  assert.equal(CUBE_SIZE, 50);
  assert.equal(CUBE_HEIGHT, 70);
  assert.equal(CUBE_MASS, 1);
  assert.equal(WAREHOUSE_CUBE, 40, 'Warehouse Sort keeps its own assumption');
  // the gripper takes it: open wider, closed narrower
  const g = LOCKER_ROOM_ROBOT.gripper;
  assert.ok(g.clawOpenGap > CUBE_SIZE && g.clawClosedGap < CUBE_SIZE);
  assert.ok(LOCKER_ROOM_ROBOT.ultrasonic.height < CUBE_HEIGHT, 'the ultrasonic sensor sees a cube');
  assert.ok(g.liftUpHeight > CUBE_HEIGHT, 'the raised claw passes over a cube');
  // a cube fits completely into each warehouse at the top (into a turned one turned with it) ...
  const square = (x: number, y: number, angle = 0): OBB => ({ x, y, w: CUBE_SIZE, l: CUBE_SIZE, angle });
  for (const color of ['red', 'green', 'blue'] as const) {
    const box = targetOf(color).box as OBB;
    assert.ok(Math.min(box.w, box.l) > CUBE_SIZE, color);
    const inside = (p: { x: number; y: number }) => {
      const dx = p.x - box.x;
      const dy = p.y - box.y;
      return Math.abs(dx * Math.sin(box.angle) - dy * Math.cos(box.angle)) <= box.l / 2 && Math.abs(dx * Math.cos(box.angle) + dy * Math.sin(box.angle)) <= box.w / 2;
    };
    assert.ok(obbCorners(square(box.x, box.y, box.angle)).every(inside), `${color}: turned with it`);
    // (standing straight, it fits only the light-blue one, which is not turned)
    assert.equal(obbCorners(square(box.x, box.y, 0)).every(inside), box.angle === 0, `${color}: straight`);
  }
  // ... but a team cube is bigger than its 41.9 mm pickup square (it stands over its edges: the rules do not mind)
  for (const id of ['redSquare', 'greenSquare'] as const) assert.ok((MARKS[id].box as OBB).w < CUBE_SIZE, id);
  const disc = MARKS.blueDisc.circle!;
  assert.ok(obbCorners(square(disc.cx, disc.cy)).every((p) => Math.hypot(p.x - disc.cx, p.y - disc.cy) <= disc.r), 'the disc would hold one too');
  // and it covers a zone picture nearly (56 x 58 mm)
  for (const zone of ZONE_IDS) assert.ok(ZONES[zone].w > CUBE_SIZE && ZONES[zone].h > CUBE_SIZE);
});

test('the Team Box, the card and the gate (assumptions): the box stays over the chassis, the card in reach of the colour sensor', () => {
  const cfg = LOCKER_ROOM_ROBOT;
  assert.ok(TEAM_BOX.forward - TEAM_BOX.l / 2 >= -cfg.chassisRear && TEAM_BOX.forward + TEAM_BOX.l / 2 <= cfg.chassisFront);
  assert.ok(TEAM_BOX.w <= cfg.chassisWidth);
  const g = cfg.gripper;
  const tips = g.gripForward + g.fingerLength / 2;
  assert.ok(tips + CARD.gapToClaw <= g.gripForward + cfg.frontColorSensor.rangeMm, 'the colour sensor at the claw sees 10 mm beyond the tips');
  assert.ok(CARD.h > g.liftUpHeight + g.fingerHeight, 'the card covers the sensor also with the arm up');
  assert.ok(GATE_HEIGHT > cfg.ultrasonic.height && GATE_HEIGHT < g.liftUpHeight);
});

// =============================================================================================
// What the floor sensors see
// =============================================================================================

const named = (x: number, y: number) => classifyColor(mat.sample(x, y));
const lineAt = (x: number, y: number) => makeProbeReading(mat.sample(x, y), T, true).onLine;

/**
 * Points measured on the sensor picture (public/simulator/locker-room/mat-sensor.webp, 1250 px for
 * 1235 mm, decoded and averaged over a probe's spot): the colour name the picture gives there,
 * and whether a probe of this game's robot reads "line". The vector mat must give the same. (The
 * whole comparison - every 2 mm of the mat, region by region - was made with a script when the
 * pictures were made; its numbers are in the report of that work.)
 */
// prettier-ignore
const PICTURE_POINTS: Array<[string, number, number, string, boolean]> = [
  ['maze, top', 600, 458.5, 'white', true],
  ['maze, left', 459.3, 680, 'white', true],
  ['maze, right', 772.5, 680, 'white', true],
  ['maze, bottom', 700, 772.1, 'white', true],
  ['maze, right stub inside', 740, 615.1, 'white', true],
  ['maze, left stub inside', 490, 615.1, 'white', true],
  ['line to the maze, top', 360, 458.5, 'white', true],
  ['line to the maze, middle', 360, 615.4, 'white', true],
  ['line to the maze, bottom', 360, 772.3, 'white', true],
  ['long line, top', 248.8, 430, 'white', true],
  ['long line, middle', 248.9, 615, 'white', true],
  ['long line, bottom', 248.9, 800, 'white', true],
  ['long line, upper yellow piece', 248.8, 537, 'yellow', true],
  ['long line, lower yellow piece', 248.8, 694.4, 'yellow', true],
  ['tree, lower', 619.4, 400, 'white', true],
  ['tree, upper', 619.7, 280, 'white', true],
  ['tree, T-end under the light-blue rectangle', 600, 238.9, 'white', true],
  ['cross line, left', 450, 317.7, 'white', true],
  ['cross line, right', 800, 317.7, 'white', true],
  ['turned line, top left', 271.65, 268.74, 'white', true],
  ['T-end, top left', 211, 206, 'white', true],
  ['turned line, top right', 957.3, 268.4, 'white', true],
  ['T-end, top right', 1017.9, 205.6, 'white', true],
  ['line to the right', 880, 615.3, 'white', true],
  ['turned line down to the right', 1028.9, 698.5, 'white', true],
  ['line down into the Scan Station', 1110.9, 900, 'white', true],
  ['line down, 8 mm inside the Scan Station frame', 1110.9, 1002, 'white', true],
  ['bottom line', 600, 1108.1, 'white', true],
  ['bottom line, over the Locker Room frame', 235, 1108.1, 'white', true],
  ['bottom line, over the Scan Station frame', 990, 1108.1, 'white', true],
  ['yellow band, top left', 300, 10, 'yellow', true],
  ['yellow band, top right', 1000, 10, 'yellow', true],
  ['yellow band, left', 10, 500, 'yellow', true],
  ['yellow band, right', 1225, 500, 'yellow', true],
  ['yellow band, bottom left', 300, 1225, 'yellow', true],
  ['yellow band, bottom right', 1000, 1225, 'yellow', true],
  ['Locker Room frame, top', 120, 987.4, 'yellow', true],
  ['Locker Room frame, right', 246.8, 1050, 'yellow', true],
  ['Scan Station frame, top', 1050, 989, 'yellow', true],
  ['Scan Station frame, left', 988.3, 1050, 'yellow', true],
  ['ground', 400, 150, 'black', false],
  ['ground', 850, 450, 'black', false],
  ['ground', 330, 950, 'black', false],
  ['ground', 800, 1000, 'black', false],
  ['ground in the gap of the band', 620, 10, 'black', false],
  ['red rectangle, top left', 130.82, 118.54, 'red', false],
  ['green rectangle, top right', 1102.45, 118.91, 'green', false],
  ['light-blue rectangle', 621.17, 118.54, 'blue', false],
  ['red square in the maze', 621.88, 506.43, 'red', false],
  ['green square in the maze', 621.88, 723.25, 'green', false],
  ['blue disc', 618.43, 560, 'blue', false],
  ['blue disc', 670, 615, 'blue', false],
  ['blue disc', 570, 650, 'blue', false],
  ['red circle', 1107.7, 430, 'red', false],
  ['red circle', 1060, 580, 'red', false],
  ['green circle', 623.6, 1000, 'green', false],
  ['green circle', 560, 880, 'green', false],
  ['red logo letter c', 1024.44, 512.66, 'black', false],
  ['red logo letter a', 1078.58, 512.66, 'black', false],
  ['red logo letter p', 1110.42, 512.66, 'black', false],
  ['red logo letter l', 1168.28, 507.69, 'black', false],
  ['green logo letter c', 542.79, 932.63, 'black', false],
  ['green logo letter a', 595.34, 932.63, 'black', false],
  ['green logo letter p', 627.18, 932.63, 'black', false],
  ['green logo letter l', 685.04, 927.83, 'black', false],
  ['zone B picture', 130.83, 611.02, 'white', false],
  ['zone C picture', 133.63, 457.89, 'white', false],
  ['Locker Room art', 40, 1200, 'black', false],
  ['Locker Room art', 200, 1020, 'black', false],
  ['Scan Station glow', 1010, 1010, 'black', false],
  ['Scan Station glow', 1220, 1020, 'black', false],
  ['gate mark, inside', 459.3, 872.3, 'black', false],
  ['MakeX logo box (the vector shows the ground)', 620, 50, 'black', false],
];

/**
 * Points where the picture shows a colour the flat average of the vector mat does not name - the
 * pictures. Line or background still agrees (all background), which is what a line follower uses.
 */
// prettier-ignore
const PICTURE_ONLY: Array<[string, number, number, string]> = [
  ['zone A picture (dark red: the average reads red)', 130.83, 776.33, 'black'],
  ['Locker Room art: the middle of the lock', 125, 1108, 'white'],
  ['coach badge', 1110, 1110, 'blue'],
  ['coach badge', 1110, 1050, 'white'],
];

test('floor sensors: the vector mat says what the sensor picture says at measured points', () => {
  for (const [what, x, y, colour, line] of PICTURE_POINTS) {
    assert.equal(named(x, y), colour, `${what} (${x}, ${y}): colour`);
    assert.equal(lineAt(x, y), line, `${what} (${x}, ${y}): line`);
  }
  for (const [what, x, y, colour] of PICTURE_ONLY) {
    assert.notEqual(named(x, y), colour, `${what}: the vector's flat colour`);
    assert.equal(lineAt(x, y), false, `${what}: background on both`);
  }
  // every picture's average is darker than the line border of 70: background on the vector mat
  for (const [name, c] of Object.entries(PICTURE_COLORS)) assert.ok(lightOf(c) < T, name);
  assert.equal(classifyColor(PICTURE_COLORS.blueDisc), 'blue');
  assert.equal(classifyColor(PICTURE_COLORS.zoneA), 'red');
});

test('floor sensors: white lines and yellow pieces read "line", the coloured marks do not; edges are sharp', () => {
  const reads = (c: RGB) => makeProbeReading(c, T, true);
  assert.equal(reads({ r: 255, g: 255, b: 255 }).onLine, true);
  assert.equal(reads(YELLOW).onLine, true, 'yellow is "line" too (brightness 85)');
  assert.equal(reads(YELLOW).color, 'yellow');
  for (const [name, c] of [['ground', GROUND], ['red', RED], ['green', GREEN], ['cyan', CYAN]] as const) assert.equal(reads(c).onLine, false, name);
  // across the long line's middle piece (x 236.09 .. 261.72): ground, white, ground
  const isWhite = (c: RGB) => c.r === 255 && c.g === 255 && c.b === 255;
  assert.deepEqual(mat.sample(235.9, 600), GROUND);
  assert.ok(isWhite(mat.sample(236.2, 600)));
  assert.ok(isWhite(mat.sample(261.6, 600)));
  assert.deepEqual(mat.sample(261.9, 600), GROUND);
  // the yellow pieces are printed over the white long line, with its full width
  assert.deepEqual(mat.sample(236, 540), YELLOW);
  assert.deepEqual(mat.sample(248.8, 507.7), YELLOW);
  assert.ok(isWhite(mat.sample(248.8, 507.5)));
  // the bottom line runs over both frames; the line down to the Scan Station over its frame
  assert.ok(isWhite(mat.sample(232, 1108)));
  assert.ok(isWhite(mat.sample(1000, 1108)));
  assert.ok(isWhite(mat.sample(1110, 990)));
  assert.deepEqual(mat.sample(1110, 1012), PICTURE_COLORS.scanGlow, 'the glow beyond its end');
  // the bottom band is printed over both zones
  assert.deepEqual(mat.sample(100, 1225), YELLOW);
  assert.deepEqual(mat.sample(1100, 1225), YELLOW);
  // the logo letters are printed over the circles; off the mat: the table
  assert.deepEqual(mat.sample(1024.44, 512.66), GROUND);
  assert.deepEqual(mat.sample(-5, 600), MAT_VECTOR.outside);
  assert.deepEqual(mat.sample(600, 1236), MAT_VECTOR.outside);
  // the logos: 14 letters ("capelli", "SPORT", the "(R)") on green, 13 on red (its frame cuts the "(R)" off)
  assert.equal(LOGOS.green.length, 14);
  assert.equal(LOGOS.red.length, 13);
  for (const shape of LOGOS.red) for (const outline of shape) for (const p of outline) assert.ok(p.x < RED_LOGO_CLIP_X);
  for (const shape of LOGOS.green) for (const outline of shape) for (const p of outline) {
    assert.ok(Math.hypot(p.x - BIG_CIRCLES.green.cx, p.y - BIG_CIRCLES.green.cy) < BIG_CIRCLES.green.r);
  }
});

// =============================================================================================
// The robot
// =============================================================================================

test('robot: the mBot2 of Warehouse Sort, part for part (a copy), with the white line learned', () => {
  assert.deepEqual(LOCKER_ROOM_ROBOT, WAREHOUSE_SORT_ROBOT);
  assert.notEqual(LOCKER_ROOM_ROBOT, WAREHOUSE_SORT_ROBOT);
  assert.notEqual(LOCKER_ROOM_ROBOT.gripper, WAREHOUSE_SORT_ROBOT.gripper);
  assert.equal(LOCKER_ROOM_ROBOT.quadRgb.lightLine, true);
  assert.equal(LOCKER_ROOM_ROBOT.frontColorSensor.mount, undefined, 'the colour sensor at the claw');
  assert.equal(LOCKER_ROOM_ROBOT.fan, undefined);
});

test('robot: it starts completely inside the Locker Room (frame included), facing right, on the middle of the bottom line', () => {
  assert.deepEqual(robotSize(LOCKER_ROOM_ROBOT), { length: 237, width: 130 });
  assert.equal(START_HEADING, Math.PI / 2);
  assert.deepEqual(startPoseFor(LOCKER_ROOM_ROBOT), START_POSE);
  assert.equal(START_POSE.y, BOTTOM_LINE_Y);
  near(START_POSE.x, 77.92, 0.005);
  assert.ok(robotFitsInRect(LOCKER_ROOM_ROBOT, START_POSE, LOCKER_ROOM));
  const shapes = robotShapesAt(LOCKER_ROOM_ROBOT, START_POSE);
  const xs = shapes.flatMap((s) => obbCorners(s).map((c) => c.x));
  const ys = shapes.flatMap((s) => obbCorners(s).map((c) => c.y));
  near(Math.min(...xs) - LOCKER_ROOM.x, 7.92, 0.005, 'behind');
  near(LOCKER_ROOM.x + LOCKER_ROOM.w - Math.max(...xs), 7.92, 0.005, 'in front');
  near(Math.min(...ys) - LOCKER_ROOM.y, 61.78, 0.005, 'on its left');
  near(LOCKER_ROOM.y + LOCKER_ROOM.h - Math.max(...ys), 61.86, 0.005, 'on its right');
  assert.deepEqual(robotReach(LOCKER_ROOM_ROBOT), { front: 167, rear: 70, halfWidth: 65 });
  // inside the frame alone (236.01 mm) the robot (237 mm) would not fit facing right or up
  const h = FRAME_WIDTH / 2;
  const inner = { x: LOCKER_ROOM_FRAME.x + h, y: LOCKER_ROOM_FRAME.y + h, w: LOCKER_ROOM_FRAME.w - 2 * h, h: LOCKER_ROOM_FRAME.h - 2 * h };
  near(inner.w, 236.01, 0.01);
  for (const heading of [0, Math.PI / 2]) {
    const pose = { x: inner.x + inner.w / 2 + (heading ? (70 - 167) / 2 : 0), y: inner.y + inner.h / 2 + (heading ? 0 : (167 - 70) / 2), heading };
    assert.equal(robotFitsInRect(LOCKER_ROOM_ROBOT, pose, inner), false);
  }
  // the robot can be completely inside the Scan Station (252.72 x 252.04): facing right, 15.7 mm of play
  assert.ok(robotFitsInRect(LOCKER_ROOM_ROBOT, { x: 1060, y: BOTTOM_LINE_Y, heading: Math.PI / 2 }, SCAN_STATION));
});
