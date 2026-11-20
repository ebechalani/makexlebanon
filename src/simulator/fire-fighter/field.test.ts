/**
 * The Fire Fighter field: its numbers against the print file (the organiser's PDF of the mat, its
 * drawing operations in points, in the order it paints them), what the floor sensors see on it
 * (the vector mat against the sensor picture), the towers, the cubes, the robot in the Fire
 * Station, and the measured facts the screen, the examples and the README quote.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lightOf, makeProbeReading } from '../core/engine-sensors';
import { rectContainsOBB, type Rect, type Vec2 } from '../core/geometry';
import { RasterMatSampler, VectorMatSampler } from '../core/mat';
import { robotFitsInRect, robotShapesAt } from '../core/robot';
import type { MatLayer, MatSampler, RGB } from '../core/types';
import {
  BOTTOM_LINE_Y,
  CUBE_HEIGHT,
  CUBE_HOMES,
  CUBE_MASS,
  CUBE_PLACES,
  CUBE_SIZE,
  CUBE_SQUARES,
  DASH_CORNER,
  DASH_WIDTH,
  DASHED_SQUARES,
  DASHES,
  FIRE_STATION,
  FIRE_STATION_STEM_X,
  FLAP_BOTTOM,
  HYDRANT_STEM_X,
  LEFT_LINE_X,
  LETTER_AREA,
  LINE_COLOR,
  LINE_WIDTH,
  LINES,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  MM_PER_PT,
  OPENING,
  PICTURE_SQUARES,
  PRINT_ORDER,
  RIGHT_LINE_X,
  ROOM_ACROSS,
  ROOM_ALONG_OPENING,
  SIDE_MARKS,
  SQUARE_MIDDLES,
  SUPPORT_WIDTH,
  TILE_COLORS,
  TILE_IDS,
  TILES,
  TOP_LINE_Y,
  TOWER_DEPTH,
  TOWER_GAP,
  TOWER_HEIGHT,
  TOWER_IDS,
  TOWER_MASS,
  TOWER_MIDDLES,
  TOWER_NAMES,
  TOWER_PLACES,
  TOWER_STEMS,
  TOWER_WIDTH,
  YELLOW_SQUARE,
  supportMiddle,
  towerBase,
  towerGap,
  type CubePlace,
  type TowerId,
} from './field';
import { FIRE_FIGHTER_ROBOT, START_POSE, clawAheadOfLineSensor, robotReach, startPoseFor } from './robot';

const near = (actual: number, expected: number, tolerance: number, what: string): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not ${expected} (within ${tolerance})`);
};

// =============================================================================================
// The print file, operation by operation
// =============================================================================================

/** MEASURED: the page of the print file (its MediaBox, the same as its trim and bleed boxes), in points. */
const PAGE_PT = 3543.31;

/**
 * The print file's own drawing, in the order it paints it, as its decoded page stream gives it
 * (points, origin at the BOTTOM left): 'S' a stroke - its width, its dash (on,off) or '-', its path
 * (m = move to, l = line to); 'I' a picture - its name and the box it is clipped to.
 */
// prettier-ignore
const PRINT: readonly string[] = [
  'S 72 - m 3155.8071 2510.874 l 2509.6221 2510.874',
  'S 72 - m 2509.6226 2512.3276 l 2509.6226 1001.7886',
  'S 72 - m 1078.9592 2538.939 l 1078.9592 1064.4',
  'I /Im0 1443.923 1418.339 2152.585 2127.001',
  'S 72 - m 1078.9592 2869.1985 l 1078.9592 2474.8745',
  'I /Im1 2797.13 28.392 3505.792 737.053',
  'I /Im2 2793.13 2797.192 3501.791 3505.854',
  'S 72 - m 3131.8452 2994.7715 l 3131.8452 2475.8745',
  'I /Im3 36 2797.192 744.662 3505.854',
  'I /Im4 38 36.392 746.662 745.053',
  'S 72 - m 2509.6223 2838.1985 l 1042.9593 2838.1985',
  'S 72 - m 2509.6226 2875.6519 l 2509.6226 2481.3279',
  'S 72 - m 1091.3762 2511.3276 l 346.7152 2511.3276',
  'S 72 - m 368.3308 2994.7715 l 368.3308 2475.8745',
  'S 72 - m 3155.0464 1036.335 l 2473.6224 1036.335',
  'S 72 - m 1078.9592 361.1394 l 1078.9592 1073.7884',
  'S 72 - m 3131.0845 552.4371 l 3131.0845 1071.3351',
  'S 72 - m 2509.6223 395.686 l 1090.4613 395.686',
  'S 72 - m 2509.6226 361.1393 l 2509.6226 1073.7883',
  'S 72 - m 367.5698 552.4371 l 367.5698 1071.3351',
  'S 72 - m 1938.4253 2163 l 1654.9613 2163',
  'S 72 - m 1938.4253 982.7354 l 1654.9613 982.7354',
  'I /Im5 3161.845 1425.512 3502.002 2105.827',
  'I /Im6 1510.142 3505.854 2050.426 3344.437',
  'I /Im7 1610.205 2934.365 1950.363 3274.523',
  'I /Im8 1425.954 41.355 2134.615 750.017',
  'S 72 - m 1807.6538 2199 l 1807.6538 2802.198',
  'S 72 - m 2509.6223 1945.4016 l 3089.8453 1945.4016',
  'S 72 - m 3125.845 1858.3623 l 3125.845 2028.4413',
  'S 72 - m 2509.6223 1586.8142 l 3125.8453 1586.8142',
  'S 72 - m 3131.845 1501.7749 l 3131.845 1671.8539',
  'I /Im9 38.176 1401.696 378.333 2082.011',
  'S 72 - m 1059.7577 1564.1213 l 450.3337 1564.1213',
  'S 72 - m 414.3335 1649.1606 l 414.3335 1479.0816',
  'S 72 - m 1114.9594 1920.709 l 414.3334 1920.709',
  'S 72 - m 414.3335 2005.7483 l 414.3335 1835.6693',
  'I /Im10 1654.96 1071.335 1938.425 1354.8',
  'S 72 - m 1796.6934 606.578 l 1796.6934 946.736',
  'S 14 12.006,12.006 m 1862.7263 1859.6437 l 1724.6563 1859.6437',
  'S 14 12.159,12.159 m 1711.6536 1840.485 l 1711.6536 1700.659',
  'S 14 12.006,12.006 m 1730.6597 1687.58 l 1868.7297 1687.58',
  'S 14 12.159,12.159 m 1881.7324 1706.7389 l 1881.7324 1846.5639',
  'S 14 - m 1718.6536 1859.6437 l 1711.6536 1859.6437 l 1711.6536 1852.6437 m 1711.6536 1694.5797 l 1711.6536 1687.5797 l 1718.6536 1687.5797 m 1874.7326 1687.5797 l 1881.7326 1687.5797 l 1881.7326 1694.5797 m 1881.7326 1852.6437 l 1881.7326 1859.6437 l 1874.7326 1859.6437',
  'S 14 9.915,9.915 m 1694.9194 1823.3622 l 1660.2174 1823.3622',
  'S 14 12.198,12.198 m 1648.2598 1804.1644 l 1648.2598 1737.0754',
  'S 14 9.915,9.915 m 1665.1746 1723.9764 l 1699.8766 1723.9764',
  'S 14 12.198,12.198 m 1711.8342 1743.1744 l 1711.8342 1810.2634',
  'S 14 - m 1655.2598 1823.3622 l 1648.2598 1823.3622 l 1648.2598 1816.3622 m 1648.2598 1730.9762 l 1648.2598 1723.9762 l 1655.2598 1723.9762 m 1704.8338 1723.9762 l 1711.8338 1723.9762 l 1711.8338 1730.9762 m 1711.8338 1816.3622 l 1711.8338 1823.3622 l 1704.8338 1823.3622',
  'S 14 9.915,9.915 m 1928.6836 1823.3622 l 1893.9816 1823.3622',
  'S 14 12.198,12.198 m 1882.0239 1804.1644 l 1882.0239 1737.0754',
  'S 14 9.915,9.915 m 1898.939 1723.9764 l 1933.641 1723.9764',
  'S 14 12.198,12.198 m 1945.5986 1743.1744 l 1945.5986 1810.2634',
  'S 14 - m 1889.0239 1823.3622 l 1882.0239 1823.3622 l 1882.0239 1816.3622 m 1882.0239 1730.9762 l 1882.0239 1723.9762 l 1889.0239 1723.9762 m 1938.5989 1723.9762 l 1945.5989 1723.9762 l 1945.5989 1730.9762 m 1945.5989 1816.3622 l 1945.5989 1823.3622 l 1938.5989 1823.3622',
  'S 14 12.006,12.006 m 3197.6423 468.7546 l 3059.5723 468.7546',
  'S 14 12.159,12.159 m 3046.5696 449.5959 l 3046.5696 309.7699',
  'S 14 12.006,12.006 m 3065.5757 296.6909 l 3203.6457 296.6909',
  'S 14 12.159,12.159 m 3216.6484 315.8499 l 3216.6484 455.6749',
  'S 14 - m 3053.5696 468.7546 l 3046.5696 468.7546 l 3046.5696 461.7546 m 3046.5696 303.6906 l 3046.5696 296.6906 l 3053.5696 296.6906 m 3209.6486 296.6906 l 3216.6486 296.6906 l 3216.6486 303.6906 m 3216.6486 461.7546 l 3216.6486 468.7546 l 3209.6486 468.7546',
  'S 14 9.915,9.915 m 3029.8354 432.4731 l 2995.1334 432.4731',
  'S 14 12.198,12.198 m 2983.1758 413.2754 l 2983.1758 346.1864',
  'S 14 9.915,9.915 m 3000.0906 333.0874 l 3034.7926 333.0874',
  'S 14 12.198,12.198 m 3046.7502 352.2854 l 3046.7502 419.3744',
  'S 14 - m 2990.1758 432.4731 l 2983.1758 432.4731 l 2983.1758 425.4731 m 2983.1758 340.0871 l 2983.1758 333.0871 l 2990.1758 333.0871 m 3039.7498 333.0871 l 3046.7498 333.0871 l 3046.7498 340.0871 m 3046.7498 425.4731 l 3046.7498 432.4731 l 3039.7498 432.4731',
  'S 14 9.915,9.915 m 3263.5996 432.4731 l 3228.8976 432.4731',
  'S 14 12.198,12.198 m 3216.9399 413.2754 l 3216.9399 346.1864',
  'S 14 9.915,9.915 m 3233.855 333.0874 l 3268.557 333.0874',
  'S 14 12.198,12.198 m 3280.5146 352.2854 l 3280.5146 419.3744',
  'S 14 - m 3223.9399 432.4731 l 3216.9399 432.4731 l 3216.9399 425.4731 m 3216.9399 340.0871 l 3216.9399 333.0871 l 3223.9399 333.0871 m 3273.5149 333.0871 l 3280.5149 333.0871 l 3280.5149 340.0871 m 3280.5149 425.4731 l 3280.5149 432.4731 l 3273.5149 432.4731',
  'S 14 12.006,12.006 m 429.7214 468.7546 l 291.6514 468.7546',
  'S 14 12.159,12.159 m 278.6487 449.5959 l 278.6487 309.7699',
  'S 14 12.006,12.006 m 297.6548 296.6909 l 435.7248 296.6909',
  'S 14 12.159,12.159 m 448.7275 315.8499 l 448.7275 455.6749',
  'S 14 - m 285.6487 468.7546 l 278.6487 468.7546 l 278.6487 461.7546 m 278.6487 303.6906 l 278.6487 296.6906 l 285.6487 296.6906 m 441.7277 296.6906 l 448.7277 296.6906 l 448.7277 303.6906 m 448.7277 461.7546 l 448.7277 468.7546 l 441.7277 468.7546',
  'S 14 9.915,9.915 m 261.9146 432.4731 l 227.2126 432.4731',
  'S 14 12.198,12.198 m 215.2549 413.2754 l 215.2549 346.1864',
  'S 14 9.915,9.915 m 232.1697 333.0874 l 266.8717 333.0874',
  'S 14 12.198,12.198 m 278.8293 352.2854 l 278.8293 419.3744',
  'S 14 - m 222.2549 432.4731 l 215.2549 432.4731 l 215.2549 425.4731 m 215.2549 340.0871 l 215.2549 333.0871 l 222.2549 333.0871 m 271.8289 333.0871 l 278.8289 333.0871 l 278.8289 340.0871 m 278.8289 425.4731 l 278.8289 432.4731 l 271.8289 432.4731',
  'S 14 9.915,9.915 m 495.6787 432.4731 l 460.9767 432.4731',
  'S 14 12.198,12.198 m 449.019 413.2754 l 449.019 346.1864',
  'S 14 9.915,9.915 m 465.9341 333.0874 l 500.6361 333.0874',
  'S 14 12.198,12.198 m 512.5937 352.2854 l 512.5937 419.3744',
  'S 14 - m 456.019 432.4731 l 449.019 432.4731 l 449.019 425.4731 m 449.019 340.0871 l 449.019 333.0871 l 456.019 333.0871 m 505.594 333.0871 l 512.594 333.0871 l 512.594 340.0871 m 512.594 425.4731 l 512.594 432.4731 l 505.594 432.4731',
  'S 14 12.006,12.006 m 434.1279 3237.5547 l 296.0579 3237.5547',
  'S 14 12.159,12.159 m 283.0552 3218.396 l 283.0552 3078.57',
  'S 14 12.006,12.006 m 302.0613 3065.491 l 440.1313 3065.491',
  'S 14 12.159,12.159 m 453.134 3084.6499 l 453.134 3224.4749',
  'S 14 - m 290.0552 3237.5547 l 283.0552 3237.5547 l 283.0552 3230.5547 m 283.0552 3072.4907 l 283.0552 3065.4907 l 290.0552 3065.4907 m 446.1342 3065.4907 l 453.1342 3065.4907 l 453.1342 3072.4907 m 453.1342 3230.5547 l 453.1342 3237.5547 l 446.1342 3237.5547',
  'S 14 9.915,9.915 m 266.321 3201.2732 l 231.619 3201.2732',
  'S 14 12.198,12.198 m 219.6614 3182.0754 l 219.6614 3114.9864',
  'S 14 9.915,9.915 m 236.5762 3101.8875 l 271.2782 3101.8875',
  'S 14 12.198,12.198 m 283.2358 3121.0854 l 283.2358 3188.1744',
  'S 14 - m 226.6614 3201.2732 l 219.6614 3201.2732 l 219.6614 3194.2732 m 219.6614 3108.8872 l 219.6614 3101.8872 l 226.6614 3101.8872 m 276.2354 3101.8872 l 283.2354 3101.8872 l 283.2354 3108.8872 m 283.2354 3194.2732 l 283.2354 3201.2732 l 276.2354 3201.2732',
  'S 14 9.915,9.915 m 500.085 3201.2732 l 465.383 3201.2732',
  'S 14 12.198,12.198 m 453.4253 3182.0754 l 453.4253 3114.9864',
  'S 14 9.915,9.915 m 470.3403 3101.8875 l 505.0423 3101.8875',
  'S 14 12.198,12.198 m 517 3121.0854 l 517 3188.1744',
  'S 14 - m 460.4253 3201.2732 l 453.4253 3201.2732 l 453.4253 3194.2732 m 453.4253 3108.8872 l 453.4253 3101.8872 l 460.4253 3101.8872 m 510.0003 3101.8872 l 517.0003 3101.8872 l 517.0003 3108.8872 m 517.0003 3194.2732 l 517.0003 3201.2732 l 510.0003 3201.2732',
  'S 72 - m 510.063 570.5779 l 226.598 570.5779',
  'S 72 - m 3259.6401 570.5779 l 2976.1761 570.5779',
  'S 72 - m 510.063 2959.7717 l 226.598 2959.7717',
  'S 72 - m 3267.5774 2970.3652 l 2984.1124 2970.3652',
  'S 14 12.006,12.006 m 3191.6423 3237.5547 l 3053.5723 3237.5547',
  'S 14 12.159,12.159 m 3040.5696 3218.396 l 3040.5696 3078.57',
  'S 14 12.006,12.006 m 3059.5757 3065.491 l 3197.6457 3065.491',
  'S 14 12.159,12.159 m 3210.6484 3084.6499 l 3210.6484 3224.4749',
  'S 14 - m 3047.5696 3237.5547 l 3040.5696 3237.5547 l 3040.5696 3230.5547 m 3040.5696 3072.4907 l 3040.5696 3065.4907 l 3047.5696 3065.4907 m 3203.6486 3065.4907 l 3210.6486 3065.4907 l 3210.6486 3072.4907 m 3210.6486 3230.5547 l 3210.6486 3237.5547 l 3203.6486 3237.5547',
  'S 14 9.915,9.915 m 3023.8354 3201.2732 l 2989.1334 3201.2732',
  'S 14 12.198,12.198 m 2977.1758 3182.0754 l 2977.1758 3114.9864',
  'S 14 9.915,9.915 m 2994.0906 3101.8875 l 3028.7926 3101.8875',
  'S 14 12.198,12.198 m 3040.7502 3121.0854 l 3040.7502 3188.1744',
  'S 14 - m 2984.1758 3201.2732 l 2977.1758 3201.2732 l 2977.1758 3194.2732 m 2977.1758 3108.8872 l 2977.1758 3101.8872 l 2984.1758 3101.8872 m 3033.7498 3101.8872 l 3040.7498 3101.8872 l 3040.7498 3108.8872 m 3040.7498 3194.2732 l 3040.7498 3201.2732 l 3033.7498 3201.2732',
  'S 14 9.915,9.915 m 3257.5996 3201.2732 l 3222.8976 3201.2732',
  'S 14 12.198,12.198 m 3210.9399 3182.0754 l 3210.9399 3114.9864',
  'S 14 9.915,9.915 m 3227.855 3101.8875 l 3262.557 3101.8875',
  'S 14 12.198,12.198 m 3274.5146 3121.0854 l 3274.5146 3188.1744',
  'S 14 - m 3217.9399 3201.2732 l 3210.9399 3201.2732 l 3210.9399 3194.2732 m 3210.9399 3108.8872 l 3210.9399 3101.8872 l 3217.9399 3101.8872 m 3267.5149 3101.8872 l 3274.5149 3101.8872 l 3274.5149 3108.8872 m 3274.5149 3194.2732 l 3274.5149 3201.2732 l 3267.5149 3201.2732',
  'S 72 - m 1059.7576 1033.3999 l 378.3336 1033.3999',
];

/** A point of the print file in mat mm (origin top left, +y down). */
const fromPt = (x: number, y: number): Vec2 => ({ x: x * MM_PER_PT, y: (PAGE_PT - y) * MM_PER_PT });

type PrintedLayer =
  | { kind: 'rect'; name: string; rect: Rect }
  | { kind: 'stroke'; width: number; dash: number | null; points: Vec2[] };

/** The print file as layers of the vector mat: a picture is one rectangle, every piece of a path one stroke. */
function printedLayers(): PrintedLayer[] {
  const out: PrintedLayer[] = [];
  for (const op of PRINT) {
    const t = op.split(' ');
    if (t[0] === 'I') {
      const [a, b] = [fromPt(Number(t[2]), Number(t[3])), fromPt(Number(t[4]), Number(t[5]))];
      out.push({ kind: 'rect', name: t[1], rect: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) } });
      continue;
    }
    const width = Number(t[1]) * MM_PER_PT;
    const dash = t[2] === '-' ? null : Number(t[2].split(',')[0]) * MM_PER_PT;
    if (dash !== null) assert.equal(t[2].split(',')[0], t[2].split(',')[1], 'every dash is as long on as off');
    let points: Vec2[] = [];
    for (let i = 3; i < t.length; i += 3) {
      if (t[i] === 'm' && points.length > 0) {
        out.push({ kind: 'stroke', width, dash, points });
        points = [];
      }
      points.push(fromPt(Number(t[i + 1]), Number(t[i + 2])));
    }
    out.push({ kind: 'stroke', width, dash, points });
  }
  return out;
}

const TOLERANCE = 0.001;

test('field: the mat is 1250 mm square: 3543.31 points in the print file', () => {
  near(PAGE_PT * MM_PER_PT, 1250.001, 0.0005, 'the page');
  assert.equal(MAT_SIZE, 1250);
  assert.equal(MAT_VECTOR.width, MAT_SIZE);
  assert.equal(MAT_VECTOR.height, MAT_SIZE);
  assert.equal(MM_PER_PT, 25.4 / 72);
  assert.equal(MAT_IMAGE_URL, '/simulator/fire-fighter/mat.webp');
  assert.equal(MAT_SENSOR_IMAGE_URL, '/simulator/fire-fighter/mat-sensor.webp');
});

test('field: the vector mat is the print file, layer for layer, in its order, to 0.001 mm (32 lines, 11 pictures, 120 dashed strokes)', () => {
  const printed = printedLayers();
  const layers = MAT_VECTOR.layers;
  assert.equal(layers.length, printed.length);
  assert.equal(layers.length, 163);
  assert.equal(printed.filter((l) => l.kind === 'rect').length, 11);
  assert.equal(printed.filter((l) => l.kind === 'stroke' && l.width > 20).length, 32);
  assert.equal(printed.filter((l) => l.kind === 'stroke' && l.width < 20).length, 120);
  printed.forEach((want, i) => {
    const got = layers[i] as MatLayer;
    assert.equal(got.kind, want.kind, `layer ${i}`);
    if (want.kind === 'rect' && got.kind === 'rect') {
      for (const key of ['x', 'y', 'w', 'h'] as const) near(got.rect[key], want.rect[key], TOLERANCE, `layer ${i} (${want.name}) ${key}`);
      return;
    }
    if (want.kind !== 'stroke' || got.kind !== 'stroke') return;
    near(got.width, want.width, 1e-9, `layer ${i}: width`);
    assert.deepEqual(got.color, want.width > 20 ? LINE_COLOR : { r: 255, g: 255, b: 255 }, `layer ${i}: colour`);
    assert.equal(got.points.length, want.points.length, `layer ${i}: points`);
    want.points.forEach((p, k) => {
      near(got.points[k].x, p.x, TOLERANCE, `layer ${i} point ${k} x`);
      near(got.points[k].y, p.y, TOLERANCE, `layer ${i} point ${k} y`);
    });
    if (want.dash === null) assert.equal(got.dash, undefined, `layer ${i}: solid`);
    else {
      assert.ok(got.dash, `layer ${i}: dashed`);
      near(got.dash.on, want.dash, 1e-9, `layer ${i}: dash on`);
      near(got.dash.off, want.dash, 1e-9, `layer ${i}: dash off`);
    }
    assert.equal(got.closed, undefined, `layer ${i}: open`);
  });
  // the picture names, in the print file's order, are TILE_IDS
  assert.deepEqual(
    printed.flatMap((l) => (l.kind === 'rect' ? [l.name] : [])),
    TILE_IDS.map((_, i) => `/Im${i}`),
  );
  assert.deepEqual(MAT_VECTOR.background, { r: 255, g: 255, b: 255 });
  assert.deepEqual(MAT_VECTOR.outside, { r: 120, g: 120, b: 120 });
});

test('field: every black line is 72 pt = 25.4 mm wide, CMYK black, printed as the design table lists it', () => {
  assert.equal(LINE_WIDTH, 25.4);
  near(LINE_WIDTH, 72 * MM_PER_PT, 1e-12, 'line width');
  assert.deepEqual(LINE_COLOR, { r: 35, g: 31, b: 32 });
  near(lightOf(LINE_COLOR), 12.7, 0.05, 'brightness of the lines');
  assert.equal(Object.keys(LINES).length, 32);
  assert.deepEqual(Object.keys(LINES), Array.from({ length: 32 }, (_, i) => `B${String(i).padStart(2, '0')}`));
  // the black lines are in PRINT_ORDER once each, in the print's order
  assert.deepEqual(
    PRINT_ORDER.flatMap((item) => ('line' in item ? [item.line] : [])),
    Object.keys(LINES),
  );
  // the lines of the track as the design names them
  assert.equal(LEFT_LINE_X, 380.633);
  assert.equal(RIGHT_LINE_X, 885.339);
  assert.equal(TOP_LINE_Y, 248.748);
  assert.equal(BOTTOM_LINE_Y, 1110.412);
  assert.equal(FIRE_STATION_STEM_X, 633.834);
  assert.equal(HYDRANT_STEM_X, 637.7);
  // the bottom line runs under the Fire Station picture (printed before it), from x 384.691 to 885.339
  const order = PRINT_ORDER.map((item) => ('line' in item ? item.line : 'tile' in item ? item.tile : `outline ${item.outline}`));
  assert.ok(order.indexOf('B12') < order.indexOf('fireStation'));
  assert.ok(order.indexOf('fireStation') < order.indexOf('B26'), 'the Fire Station stem is printed over the picture');
  for (const stem of ['B04', 'B08', 'B11', 'B14', 'B27', 'B28', 'B29', 'B30'] as const) {
    const tile = stem === 'B04' || stem === 'B30' ? 'bakery' : stem === 'B08' || stem === 'B29' ? 'park' : stem === 'B11' || stem === 'B28' ? 'hospital' : 'school';
    assert.ok(order.indexOf(tile) < order.indexOf(stem), `${stem} is printed over the ${tile}`);
  }
  // the right bay's lower T bar lies 2.116 mm over the bay picture
  near(LINES.B21[0].x + LINE_WIDTH / 2 - TILES.rightBay.x, 2.116, 0.001, 'B21 over the right bay');
});

test('field: the pictures are where the print file clips them; what each average colour reads', () => {
  for (const id of TILE_IDS) assert.ok(MAT_VECTOR.layers.some((l) => l.kind === 'rect' && l.rect === TILES[id] && l.color === TILE_COLORS[id]), id);
  for (const id of ['hydrant', 'hospital', 'bakery', 'park', 'school', 'fireStation'] as const) {
    near(TILES[id].w, 250, 0.002, `${id} width`);
    near(TILES[id].h, 250, 0.002, `${id} height`);
  }
  for (const id of ['leftBay', 'rightBay'] as const) {
    near(TILES[id].w, 120, 0.002, `${id} width`);
    near(TILES[id].h, 240, 0.002, `${id} height`);
  }
  assert.deepEqual(YELLOW_SQUARE, { x: 583.833, y: 772.058, w: 100, h: 100 });
  assert.equal(FIRE_STATION, TILES.fireStation);
  // the brightness of each average, as field.ts writes it: every one reads "background" for this robot (border 35)
  const brightness: Record<string, number> = {
    park: 52.7, bakery: 54.4, school: 59.8, hospital: 59.0, hydrant: 58.0, fireStation: 52.2,
    leftBay: 73.0, rightBay: 73.4, yellowSquare: 74.2, logo: 79.5, robotPicture: 71.3,
  };
  for (const id of TILE_IDS) {
    near(lightOf(TILE_COLORS[id]), brightness[id], 0.05, `${id}: brightness`);
    assert.equal(makeProbeReading(TILE_COLORS[id], FIRE_FIGHTER_ROBOT.quadRgb.lineThreshold).onLine, false, `${id} reads background`);
  }
});

// =============================================================================================
// The towers
// =============================================================================================

/** The outlines of the towers as the print paints them: 3 outlines of 8 strokes each (4 dashed sides, 4 corners). */
function printedOutlines(): Map<TowerId, Rect[]> {
  const strokes = printedLayers().filter((l): l is Extract<PrintedLayer, { kind: 'stroke' }> => l.kind === 'stroke' && l.width < 20);
  const out = new Map<TowerId, Rect[]>();
  const order: TowerId[] = ['X', 'A', 'M', 'E', 'K'];
  for (let k = 0; k < 15; k++) {
    const group = strokes.slice(8 * k, 8 * k + 8);
    const xs = group.flatMap((s) => s.points.map((p) => p.x));
    const ys = group.flatMap((s) => s.points.map((p) => p.y));
    const rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    const tower = order[Math.floor(k / 3)];
    out.set(tower, [...(out.get(tower) ?? []), rect]);
  }
  return out;
}

test('towers: the dashed squares and side marks are the printed outlines (centre lines of the 14 pt dashes)', () => {
  const outlines = printedOutlines();
  for (const tower of TOWER_IDS) {
    const [square, left, right] = outlines.get(tower) as Rect[];
    for (const [ours, printed, what] of [
      [DASHED_SQUARES[tower], square, 'square'],
      [SIDE_MARKS[tower].left, left, 'left side mark'],
      [SIDE_MARKS[tower].right, right, 'right side mark'],
    ] as const) {
      for (const key of ['x', 'y', 'w', 'h'] as const) near(ours[key], printed[key], 0.0015, `${tower} ${what} ${key}`);
    }
    near(DASHED_SQUARES[tower].w, 60, 0.001, `${tower} square width`);
    near(DASHED_SQUARES[tower].h, 60.7, 0.001, `${tower} square depth`);
    near(SIDE_MARKS[tower].left.w, 22.428, 0.0015, `${tower} side mark width`);
    near(SIDE_MARKS[tower].right.w, 22.428, 0.0015, `${tower} side mark width`);
    near(SIDE_MARKS[tower].left.h + DASH_WIDTH, 40, 0.002, `${tower} side mark depth to its outer edge`);
    // the whole outline: 104.894 mm between the centre lines, 109.833 to the outer edges
    const across = SIDE_MARKS[tower].right.x + SIDE_MARKS[tower].right.w - SIDE_MARKS[tower].left.x;
    near(across, 104.895, 0.002, `${tower} outline across`);
    near(across + DASH_WIDTH, 109.833, 0.002, `${tower} outline to its outer edges`);
  }
  near(DASH_WIDTH, 4.939, 0.0005, 'dash width');
  near(DASH_CORNER, 2.469, 0.0005, 'the solid corner of an outline');
  near(DASHES.squareAlongX, 4.235, 0.0005, 'dash');
  near(DASHES.squareAlongY, 4.289, 0.0005, 'dash');
  near(DASHES.sideAlongX, 3.498, 0.0005, 'dash');
  near(DASHES.sideAlongY, 4.303, 0.0005, 'dash');
});

test('towers: 105 x 40 mm (the organiser), the two supports 22.5 mm thick and 60 mm apart, on the side marks', () => {
  assert.equal(TOWER_WIDTH, 105);
  assert.equal(TOWER_DEPTH, 40);
  assert.equal(TOWER_GAP, 60);
  assert.equal(SUPPORT_WIDTH, 22.5);
  assert.equal(TOWER_HEIGHT, 100);
  assert.equal(TOWER_MASS, 1);
  assert.equal(FLAP_BOTTOM, CUBE_HEIGHT);
  for (const tower of TOWER_IDS) {
    const square = DASHED_SQUARES[tower];
    // the base's middle: across, the square's middle; along, the side marks' middle - 0.020 mm from the square's middle
    near(TOWER_MIDDLES[tower].x, SQUARE_MIDDLES[tower].x, 1e-9, `${tower} middle across`);
    near(SQUARE_MIDDLES[tower].y - TOWER_MIDDLES[tower].y, 0.02, 0.0011, `${tower} middle along`);
    const base = towerBase(tower);
    near(base.w, 105, 1e-9, 'base');
    near(base.h, 40, 1e-9, 'base');
    for (const side of ['left', 'right'] as const) {
      const m = supportMiddle(tower, side);
      const inner = side === 'left' ? m.x + SUPPORT_WIDTH / 2 : m.x - SUPPORT_WIDTH / 2;
      const outer = side === 'left' ? m.x - SUPPORT_WIDTH / 2 : m.x + SUPPORT_WIDTH / 2;
      // the inner face on the edge of the square's centre line (+-0.1 mm), the outer face on the base's edge
      near(inner, side === 'left' ? square.x : square.x + square.w, 0.1, `${tower} ${side} inner face`);
      near(outer, side === 'left' ? base.x : base.x + base.w, 1e-9, `${tower} ${side} outer face`);
      // the support stands on its side mark (inside its outer edge)
      const mark = SIDE_MARKS[tower][side];
      const outerEdge = { x: mark.x - DASH_WIDTH / 2, y: mark.y - DASH_WIDTH / 2, w: mark.w + DASH_WIDTH, h: mark.h + DASH_WIDTH };
      assert.ok(rectContainsOBB(outerEdge, { x: m.x, y: m.y, w: SUPPORT_WIDTH, l: TOWER_DEPTH, angle: 0 }, 0.002), `${tower} ${side} on its mark`);
    }
    const gap = towerGap(tower);
    near(gap.w, TOWER_GAP, 1e-9, 'gap');
    near(gap.h, TOWER_DEPTH, 1e-9, 'gap');
  }
});

test('towers: the letter area is the dashed square to the outer edge of its dashes; the room it leaves a 5 cm cube', () => {
  for (const tower of TOWER_IDS) {
    near(LETTER_AREA[tower].w, 64.939, 0.0005, `${tower} letter area width`);
    near(LETTER_AREA[tower].h, 65.639, 0.0005, `${tower} letter area depth`);
    near(LETTER_AREA[tower].x + LETTER_AREA[tower].w / 2, SQUARE_MIDDLES[tower].x, 1e-9, `${tower} letter area middle`);
    near(LETTER_AREA[tower].y + LETTER_AREA[tower].h / 2, SQUARE_MIDDLES[tower].y, 1e-9, `${tower} letter area middle`);
  }
  // along the opening: 7.82 mm each way; across: the supports leave 5 mm (the letter area alone would leave 7.47)
  near(ROOM_ALONG_OPENING, 7.82, 0.001, 'room along the opening');
  assert.equal(ROOM_ACROSS, 5);
  near((LETTER_AREA.M.w - CUBE_SIZE) / 2, 7.47, 0.001, 'room across by the letter area');
  // the area sticks out 12.82 mm in front of and behind the supports
  near((LETTER_AREA.X.h - TOWER_DEPTH) / 2, 12.82, 0.001, 'in front of the supports');
  // a centred cube could stand turned by up to 13.05 degrees between the supports (50 (cos t + sin t) <= 60)
  const t = Math.asin(TOWER_GAP / (CUBE_SIZE * Math.SQRT2)) - Math.PI / 4;
  near((t * 180) / Math.PI, 13.05, 0.01, 'turned room');
});

test('towers: each opening faces the side its stem comes from (M and A the top, K and E the bottom; X the top: the organiser)', () => {
  assert.deepEqual(OPENING, { M: 'top', A: 'top', K: 'bottom', E: 'bottom', X: 'top' });
  for (const tower of TOWER_IDS) {
    const stem = LINES[TOWER_STEMS[tower].stem];
    const stemY = (stem[0].y + stem[1].y) / 2;
    assert.equal(stemY < TOWER_MIDDLES[tower].y ? 'top' : 'bottom', OPENING[tower], `${tower}: its stem`);
    const bar = LINES[TOWER_STEMS[tower].tBar];
    assert.equal(bar[0].y, bar[1].y, `${tower}: the T bar is across the stem`);
    assert.ok(Math.min(bar[0].x, bar[1].x) < stem[0].x && stem[0].x < Math.max(bar[0].x, bar[1].x));
  }
  // nothing joins X from below: the Fire Station stem ends at the yellow T bar, under the yellow square
  assert.ok(LINES.B26[1].y > YELLOW_SQUARE.y + YELLOW_SQUARE.h);
  // how far each stem is off the middle of its tower (mm): the hydrant stem 3.867 mm to the right of X's
  const offsets: Record<TowerId, number> = { M: 1.369, A: -0.185, K: 2.2, E: 0.083, X: 3.867 };
  for (const tower of TOWER_IDS) near(LINES[TOWER_STEMS[tower].stem][0].x - TOWER_MIDDLES[tower].x, offsets[tower], 0.0005, `${tower}: stem - middle`);
  // a cube that follows the hydrant stem into X is 3.87 mm off the middle: 1.13 mm to spare of the 5 mm
  near(ROOM_ACROSS - (HYDRANT_STEM_X - TOWER_MIDDLES.X.x), 1.133, 0.0005, 'to spare along the hydrant stem');
});

test('towers: the T bars of the corner towers are too close for this robot\'s claw; the one of X is not', () => {
  assert.equal(clawAheadOfLineSensor(FIRE_FIGHTER_ROBOT), 82);
  const ahead = clawAheadOfLineSensor(FIRE_FIGHTER_ROBOT);
  // the near edge of each T bar (seen from the stem) to the face of its tower's opening
  const gapOf = (tower: TowerId): number => {
    const bar = LINES[TOWER_STEMS[tower].tBar][0].y;
    const face = TOWER_MIDDLES[tower].y + (OPENING[tower] === 'top' ? -TOWER_DEPTH / 2 : TOWER_DEPTH / 2);
    return OPENING[tower] === 'top' ? face - (bar - LINE_WIDTH / 2) : bar + LINE_WIDTH / 2 - face;
  };
  const expected: Record<TowerId, number> = { M: 58.95, A: 58.95, K: 56.63, E: 60.37, X: 130.05 };
  for (const tower of TOWER_IDS) near(gapOf(tower), expected[tower], 0.005, `${tower}: T bar to tower`);
  // a robot that stops when its line sensor reaches the bar has its claw tips this deep in the tower
  near(ahead - gapOf('M'), 23.05, 0.005, 'M');
  near(ahead - gapOf('A'), 23.05, 0.005, 'A');
  near(ahead - gapOf('K'), 25.37, 0.005, 'K');
  near(ahead - gapOf('E'), 21.63, 0.005, 'E');
  near(gapOf('X') - ahead, 48.05, 0.005, 'X: the claw stops before the tower');
  // the range the Rules window quotes: 56.6 - 60.4 mm, and 8.2 cm
  assert.ok(Math.min(...(['M', 'A', 'K', 'E'] as const).map(gapOf)) > 56.6 && Math.max(...(['M', 'A', 'K', 'E'] as const).map(gapOf)) < 60.4);
});

test('towers: the picture squares are the landmark tiles; every tower stands well inside its own', () => {
  assert.deepEqual(TOWER_NAMES, { M: 'school', A: 'hospital', K: 'bakery', E: 'park', X: 'hydrant' });
  assert.deepEqual(TOWER_PLACES, { M: 'bottom left', A: 'bottom right', K: 'top right', E: 'top left', X: 'middle' });
  assert.deepEqual(PICTURE_SQUARES, { M: TILES.school, A: TILES.hospital, K: TILES.bakery, E: TILES.park, X: TILES.hydrant });
  for (const tower of TOWER_IDS) {
    const b = towerBase(tower);
    assert.ok(rectContainsOBB(PICTURE_SQUARES[tower], { x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, l: b.h, angle: 0 }, 0), tower);
  }
  // counter-clockwise from the bottom left, as the organiser said: M, A, K, E
  const [m, a, k, e] = (['M', 'A', 'K', 'E'] as const).map((t) => TOWER_MIDDLES[t]);
  assert.ok(m.x < 625 && m.y > 625 && a.x > 625 && a.y > 625 && k.x > 625 && k.y < 625 && e.x < 625 && e.y < 625);
});

test('towers: tower A stands within reach of the right line for this robot; tower M is clear of the left line', () => {
  const reach = robotReach(FIRE_FIGHTER_ROBOT);
  assert.deepEqual(reach, { front: 167, rear: 70, halfWidth: 65 });
  // facing right with its middle on the right line, the claw tips are 0.08 mm inside A's left support
  const aLeftFace = supportMiddle('A', 'left').x - SUPPORT_WIDTH / 2;
  near(aLeftFace, 1052.262, 0.0005, "A's left face");
  near(RIGHT_LINE_X + reach.front - aLeftFace, 0.077, 0.0005, 'claw tips into A');
  // ... so a finger meets A's support when the robot's middle is at y 1055 - 1103 or 1127 - 1175
  const g = FIRE_FIGHTER_ROBOT.gripper;
  const inner = g.clawOpenGap / 2;
  const outer = inner + g.fingerThickness;
  const top = TOWER_MIDDLES.A.y - TOWER_DEPTH / 2;
  const bottom = TOWER_MIDDLES.A.y + TOWER_DEPTH / 2;
  near(top - outer, 1054.96, 0.005, 'from');
  near(bottom - inner, 1102.96, 0.005, 'to');
  near(top + inner, 1126.96, 0.005, 'from');
  near(bottom + outer, 1174.96, 0.005, 'to');
  // a turn on the spot sweeps the open claw 171.7 mm round: 4.8 mm into A
  const sweep = Math.hypot(reach.front, outer);
  near(sweep, 171.72, 0.005, 'sweep');
  near(RIGHT_LINE_X + sweep - aLeftFace, 4.8, 0.05, 'swept into A');
  // on the left line the same clears tower M by 32.8 mm (facing it) and 28.1 mm (turning)
  const mRightFace = supportMiddle('M', 'right').x + SUPPORT_WIDTH / 2;
  near(LEFT_LINE_X - reach.front - mRightFace, 32.83, 0.005, 'M clear, facing');
  near(LEFT_LINE_X - sweep - mRightFace, 28.11, 0.005, 'M clear, turning');
});

// =============================================================================================
// The cubes
// =============================================================================================

test('cubes: 5 x 5 cm, 7 cm high (the rules); on the middles of the marked squares measured on the pictures', () => {
  assert.equal(CUBE_SIZE, 50);
  assert.equal(CUBE_HEIGHT, 70);
  assert.equal(CUBE_MASS, 1);
  // PICTURE: the boxes around the corner brackets, as measured (design 3.5)
  const boxes: Record<CubePlace, [number, number, number, number]> = {
    'red-left-upper': [33.628, 94.778, 541.354, 606.024],
    'red-left-lower': [33.898, 94.778, 664.874, 729.534],
    'red-right-upper': [1140.188, 1210.808, 528.352, 594.102],
    'red-right-lower': [1140.188, 1210.668, 660.392, 725.872],
    yellow: [595.793, 671.633, 792.388, 862.888],
  };
  const middles: Record<CubePlace, [number, number]> = {
    'red-left-upper': [64.203, 573.689],
    'red-left-lower': [64.338, 697.204],
    'red-right-upper': [1175.498, 561.227],
    'red-right-lower': [1175.428, 693.132],
    yellow: [633.713, 827.638],
  };
  const picture: Record<CubePlace, Rect> = {
    'red-left-upper': TILES.leftBay,
    'red-left-lower': TILES.leftBay,
    'red-right-upper': TILES.rightBay,
    'red-right-lower': TILES.rightBay,
    yellow: YELLOW_SQUARE,
  };
  for (const place of CUBE_PLACES) {
    const [x0, x1, y0, y1] = boxes[place];
    const square = CUBE_SQUARES[place];
    near(square.x, x0, 1e-9, place);
    near(square.x + square.w, x1, 1e-9, place);
    near(square.y, y0, 1e-9, place);
    near(square.y + square.h, y1, 1e-9, place);
    near(CUBE_HOMES[place].x, middles[place][0], 0.0005, `${place} middle x`);
    near(CUBE_HOMES[place].y, middles[place][1], 0.0005, `${place} middle y`);
    const footprint = { x: CUBE_HOMES[place].x, y: CUBE_HOMES[place].y, w: CUBE_SIZE, l: CUBE_SIZE, angle: 0 };
    assert.ok(rectContainsOBB(square, footprint, 0), `${place}: the cube stands inside its marked square`);
    assert.ok(rectContainsOBB(picture[place], footprint, 0), `${place}: on its picture`);
  }
  // how far each cube stands off the line that leads to it (mm; + = below)
  near(CUBE_HOMES['red-left-upper'].y - LINES.B24[0].y, 1.27, 0.005, 'left upper');
  near(CUBE_HOMES['red-left-lower'].y - LINES.B22[0].y, -1.01, 0.005, 'left lower');
  near(CUBE_HOMES['red-right-upper'].y - LINES.B18[0].y, -2.48, 0.005, 'right upper');
  near(CUBE_HOMES['red-right-lower'].y - LINES.B20[0].y, 2.92, 0.005, 'right lower');
  near(CUBE_HOMES.yellow.x - FIRE_STATION_STEM_X, -0.121, 0.0005, 'yellow: left of the stem');
  near(CUBE_HOMES.yellow.y - (YELLOW_SQUARE.y + YELLOW_SQUARE.h / 2), 5.58, 0.005, 'yellow: below the middle of its square');
});

// =============================================================================================
// The robot in the Fire Station
// =============================================================================================

test('robot: the mBot2 of Fire Rescue, part for part (a copy), with the dark line of a white mat', async () => {
  const { DEFAULT_ROBOT_CONFIG } = await import('../core/robot');
  assert.deepEqual(FIRE_FIGHTER_ROBOT, DEFAULT_ROBOT_CONFIG);
  assert.notEqual(FIRE_FIGHTER_ROBOT, DEFAULT_ROBOT_CONFIG);
  assert.notEqual(FIRE_FIGHTER_ROBOT.gripper, DEFAULT_ROBOT_CONFIG.gripper);
  assert.notEqual(FIRE_FIGHTER_ROBOT.quadRgb, DEFAULT_ROBOT_CONFIG.quadRgb);
  assert.notEqual(FIRE_FIGHTER_ROBOT.quadRgb.probeOffsets, DEFAULT_ROBOT_CONFIG.quadRgb.probeOffsets);
  assert.equal(FIRE_FIGHTER_ROBOT.quadRgb.lightLine, undefined);
  assert.equal(FIRE_FIGHTER_ROBOT.quadRgb.lineThreshold, 35);
  // the claw: 80 mm wide open, 66 mm on a cube, 36 mm closed; the gap of a tower is 60 mm
  const g = FIRE_FIGHTER_ROBOT.gripper;
  assert.equal(g.clawOpenGap + 2 * g.fingerThickness, 80);
  assert.equal(CUBE_SIZE + 2 * g.fingerThickness, 66);
  assert.equal(g.clawClosedGap + 2 * g.fingerThickness, 36);
  assert.ok(CUBE_SIZE + 2 * g.fingerThickness > TOWER_GAP && g.clawClosedGap + 2 * g.fingerThickness < TOWER_GAP);
  // the claw (5 - 25 mm down, 75 - 95 mm up) meets a support either way; the chassis (130 mm) is wider than a tower
  assert.ok(g.liftUpHeight + g.fingerHeight < TOWER_HEIGHT);
  assert.ok(FIRE_FIGHTER_ROBOT.chassisWidth > TOWER_WIDTH);
});

test('robot: it starts inside the Fire Station, facing up on the Fire Station stem, with 6.5 mm in front and behind', () => {
  assert.deepEqual(START_POSE, { x: 633.834, y: 1158.912, heading: 0 });
  assert.deepEqual(startPoseFor(FIRE_FIGHTER_ROBOT), START_POSE);
  assert.ok(robotFitsInRect(FIRE_FIGHTER_ROBOT, START_POSE, FIRE_STATION));
  const reach = robotReach(FIRE_FIGHTER_ROBOT);
  near(START_POSE.y - reach.front - FIRE_STATION.y, 6.5, 1e-9, 'in front');
  near(FIRE_STATION.y + FIRE_STATION.h - (START_POSE.y + reach.rear), 6.5, 1e-9, 'behind');
  near(START_POSE.x - reach.halfWidth - FIRE_STATION.x, 65.789, 0.0005, 'on its left');
  near(FIRE_STATION.x + FIRE_STATION.w - (START_POSE.x + reach.halfWidth), 54.211, 0.0005, 'on its right');
  // its line sensor is over the Fire Station picture: the stem begins 37.9 mm further up
  near(START_POSE.y - FIRE_FIGHTER_ROBOT.quadRgb.forward, 1073.912, 0.0005, 'line sensor');
  assert.equal(LINES.B26[0].y, 1036.014);
  // the robot's shapes all lie in the Fire Station; one step of the screen (5 mm) up or down still fits
  for (const dy of [-5, 5]) assert.ok(robotFitsInRect(FIRE_FIGHTER_ROBOT, { ...START_POSE, y: START_POSE.y + dy }, FIRE_STATION), `${dy}`);
  assert.equal(robotFitsInRect(FIRE_FIGHTER_ROBOT, { ...START_POSE, y: START_POSE.y - 7 }, FIRE_STATION), false);
  assert.equal(robotShapesAt(FIRE_FIGHTER_ROBOT, START_POSE).length, 3);
  // the yellow cube is 331.3 mm ahead of the axle: 189.3 mm ahead of the middle of the claw
  near(START_POSE.y - CUBE_HOMES.yellow.y - FIRE_FIGHTER_ROBOT.gripper.gripForward, 189.274, 0.0005, 'to the yellow cube');
});

// =============================================================================================
// What the floor sensors see: the vector mat against the picture the browser reads
// =============================================================================================

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
    assert.equal(info.width, 1250);
    assert.equal(info.height, 1250);
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

/** A probe's spot as the engine reads it: its middle and four points 0.6 of its radius around it. */
function spot(sampler: MatSampler, x: number, y: number): RGB {
  const d = FIRE_FIGHTER_ROBOT.quadRgb.spotRadius * 0.6;
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
  const threshold = FIRE_FIGHTER_ROBOT.quadRgb.lineThreshold;
  const inRect = (x: number, y: number, r: Rect): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  test('the two pictures are in public/ (the screen shows mat.webp, the sensors read mat-sensor.webp)', () => {
    for (const url of [MAT_IMAGE_URL, MAT_SENSOR_IMAGE_URL]) assert.ok(existsSync(fileURLToPath(new URL(`../../../public${url}`, import.meta.url))), url);
  });

  test('on the white mat and its lines they agree on line or background at 99.5 % of the points, on the colour name at 99.3 % (every 2 mm, a probe spot)', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    let points = 0;
    let same = 0;
    let sameColour = 0;
    for (let y = 1; y < MAT_SIZE; y += 2) {
      for (let x = 1; x < MAT_SIZE; x += 2) {
        if (TILE_IDS.some((id) => inRect(x, y, TILES[id]))) continue;
        points++;
        const a = makeProbeReading(spot(vector, x, y), threshold);
        const b = makeProbeReading(spot(mat, x, y), threshold);
        if (a.onLine === b.onLine) same++;
        if (a.color === b.color) sameColour++;
      }
    }
    assert.equal(points, 273687);
    // (measured: 99.51 % and 99.35 %)
    assert.ok(same / points >= 0.995, `${((100 * same) / points).toFixed(2)} %`);
    assert.ok(sameColour / points >= 0.993, `${((100 * sameColour) / points).toFixed(2)} %`);
  });

  test('the edges of the black lines lie where the vector puts them: 0.31 mm off on average (132 crossings)', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    let sum = 0;
    let count = 0;
    let largest = 0;
    for (const [p, q] of Object.values(LINES)) {
      const across = p.y === q.y;
      for (const f of [0.3, 0.5, 0.7]) {
        const along = across ? p.x + f * (q.x - p.x) : p.y + f * (q.y - p.y);
        const middle = across ? p.y : p.x;
        const edges = (s: MatSampler): number[] => {
          const out: number[] = [];
          let before: boolean | null = null;
          for (let k = -400; k <= 400; k++) {
            const d = k * 0.05;
            const on = makeProbeReading(across ? s.sample(along, middle + d) : s.sample(middle + d, along), threshold).onLine;
            if (before !== null && on !== before) out.push(d);
            before = on;
          }
          return out;
        };
        const a = edges(vector);
        const b = edges(mat);
        if (a.length !== 2 || b.length !== 2) continue;
        for (let i = 0; i < 2; i++) {
          const off = Math.abs(a[i] - b[i]);
          sum += off;
          count++;
          largest = Math.max(largest, off);
        }
      }
    }
    assert.equal(count, 132);
    // (measured: 0.31 mm on average; the largest, 4.40 mm, where a line meets a picture)
    assert.ok(sum / count > 0.3 && sum / count < 0.32, `mean ${(sum / count).toFixed(3)} mm`);
    assert.ok(largest < 4.45, `largest ${largest.toFixed(2)} mm`);
  });

  test('the lines read "line", the white mat and the pictures\' averages "background", on both', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const line = (s: MatSampler, x: number, y: number): boolean => makeProbeReading(spot(s, x, y), threshold).onLine;
    // the middle of every black line, a third of the way along: line on both
    for (const [id, [p, q]] of Object.entries(LINES)) {
      const x = p.x + (q.x - p.x) / 3;
      const y = p.y + (q.y - p.y) / 3;
      if (id === 'B12' && x > FIRE_STATION.x && x < FIRE_STATION.x + FIRE_STATION.w) continue;
      assert.equal(line(vector, x, y), true, `${id} on the vector`);
      assert.equal(line(mat, x, y), true, `${id} on the picture`);
    }
    // white mat beside the Fire Station stem and the hydrant stem: background on both
    for (const [x, y] of [[600, 960], [680, 960], [600, 360], [680, 360]] as const) {
      assert.equal(line(vector, x, y), false, `${x}, ${y}`);
      assert.equal(line(mat, x, y), false, `${x}, ${y}`);
    }
  });
});
