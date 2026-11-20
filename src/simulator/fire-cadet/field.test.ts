/**
 * Fire Cadet: the map as measured (field.ts) - the lattice of N1 against the true middles of the
 * squares, the marked places and the Water squares of the map report, the drawn stand-in of the
 * mat (design 8.2) and the mat picture (design 8.1).
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Rect } from '../core/geometry';
import {
  DASHED_FRAMES,
  LABEL_BOXES,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_VECTOR,
  PLACES,
  PLACE_NAMES,
  ROAD_SQUARES,
  START_SQUARE,
  WATER_SQUARES,
  dashedFrameRects,
  gridLineRects,
  isRoadSquare,
  placeAt,
} from './field';
import { FIRE_CADET, spot, squareRect } from './numbers';
import { squareName } from './scenario';

const near = (a: number, b: number, eps: number): boolean => Math.abs(a - b) <= eps;
const rectNear = (a: Rect, b: readonly number[], eps: number): boolean =>
  near(a.x, b[0], eps) && near(a.y, b[1], eps) && near(a.w, b[2], eps) && near(a.h, b[3], eps);

test('N1: the lattice is at most 1.12 mm from the true middle of a square, and exact on the 25 inner squares', () => {
  let worst = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 7; row++) {
      const r = squareRect({ col, row });
      const p = spot({ col, row });
      const off = Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2));
      worst = Math.max(worst, off);
      if (col >= 1 && col <= 5 && row >= 1 && row <= 5) assert.ok(off < 1e-9, `${squareName({ col, row })} is ${off} mm off`);
    }
  }
  // the edge squares are 179.764 and 180.236 mm wide: the spot of an edge square is 0.882 mm off
  // its middle along one side, of a corner square on both sides (1.12 at most along one side, map report)
  assert.ok(worst <= 1.12 * Math.SQRT2 + 1e-9);
  const g = spot({ col: 6, row: 3 });
  const gr = squareRect({ col: 6, row: 3 });
  assert.ok(near(Math.abs(g.x - (gr.x + gr.w / 2)), 1.118, 0.001));
});

test('the eight marked places and the four Water squares are those of the map report (1.4, 3.4)', () => {
  const names = Object.fromEntries(PLACE_NAMES.map((p) => [p, squareName(PLACES[p])]));
  assert.deepEqual(names, {
    school: 'A1',
    stationTop: 'D1',
    factory: 'G1',
    house: 'G3',
    safeZone: 'D4',
    hospital: 'A5',
    bakery: 'G5',
    station: 'D7',
  });
  assert.equal(squareName(START_SQUARE), 'D7');
  assert.deepEqual(WATER_SQUARES.map(squareName), ['A6', 'B6', 'A7', 'B7']);
  for (const w of WATER_SQUARES) assert.equal(placeAt(w), null, 'the Water / Equipment Area has no dashed frame');
});

test('every dashed frame sits on its square within 3.4 mm (map report 1.4)', () => {
  for (const name of PLACE_NAMES) {
    const [left, top, right, bottom] = DASHED_FRAMES[name];
    const r = squareRect(PLACES[name]);
    const offsets = [left - r.x, right - (r.x + r.w), top - r.y, bottom - (r.y + r.h)];
    assert.ok(offsets.every((o) => Math.abs(o) <= 3.42), `${name}: ${offsets.join(', ')}`);
    assert.ok(near(right - left, 178.472, 0.002) && near(bottom - top, 182.143, 0.002), `${name}: every frame is 178.472 x 182.143 mm`);
  }
});

test('the 20 white rectangles of a dashed frame reproduce the print file (grid.json, the School)', () => {
  // grid.json dashedSquares.squares[school].rectsMm, [x, y, w, h], already cut at the edge of the page
  const PRINT: number[][] = [
    [174.564, 104.839, 7.056, 30.357],
    [174.564, 44.124, 7.056, 30.358],
    [103.728, 0.0, 29.746, 2.117],
    [44.237, 0.0, 29.746, 2.117],
    [0.0, 44.125, 3.148, 30.357],
    [0.0, 104.839, 3.148, 30.357],
    [44.238, 177.204, 29.745, 7.056],
    [103.729, 177.204, 29.745, 7.056],
    [174.564, 0.0, 7.056, 13.767],
    [163.219, 0.0, 14.873, 2.117],
    [0.0, 0.0, 14.492, 2.117],
    [0.0, 0.0, 3.148, 13.767],
    [0.0, 165.553, 3.148, 15.179],
    [0.0, 177.204, 14.492, 7.056],
    [163.219, 177.204, 14.873, 7.056],
    [174.564, 165.553, 7.056, 15.179],
    [0.0, 0.0, 3.147, 2.117],
    [174.564, 0.0, 7.056, 2.117],
    [0.0, 177.204, 3.147, 7.056],
    [174.564, 177.204, 7.056, 7.056],
  ];
  const mine = dashedFrameRects(DASHED_FRAMES.school);
  assert.equal(mine.length, 20);
  for (const want of PRINT) assert.ok(mine.some((r) => rectNear(r, want, 0.002)), `no rectangle like ${want.join(', ')}`);
  for (const r of mine) assert.ok(PRINT.some((want) => rectNear(r, want, 0.002)), `a rectangle that is not in the print: ${JSON.stringify(r)}`);
});

test('the 12 black lines: 7.056 mm wide, on the line middles, edge to edge (map report 1.2)', () => {
  const lines = gridLineRects();
  assert.equal(lines.length, 12);
  const PRINT: number[][] = [
    [176.236, 0.0, 7.056, 1250.0],
    [354.236, 0.0, 7.056, 1250.0],
    [532.236, 0.0, 7.056, 1250.0],
    [710.236, 0.0, 7.056, 1250.0],
    [888.236, 0.0, 7.056, 1250.0],
    [1066.236, 0.0, 7.056, 1250.0],
    [0.0, 176.236, 1250.0, 7.056],
    // (in the print this one stops 2.3 mm before the right edge, under the white corner of the
    // House frame: the map report says a redraw may run it to the edge)
    [0.0, 354.236, 1250.0, 7.056],
    [0.0, 532.236, 1250.0, 7.056],
    [0.0, 710.236, 1250.0, 7.056],
    [0.0, 888.236, 1250.0, 7.056],
    [0.0, 1066.236, 1250.0, 7.056],
  ];
  PRINT.forEach((want, k) => assert.ok(rectNear(lines[k], want, 0.001), `line ${k}: ${JSON.stringify(lines[k])}`));
});

test('the drawn stand-in: 49 squares, 8 label boxes, 12 lines, 160 dash rectangles and the logo box (design 8.2)', () => {
  assert.equal(MAT_VECTOR.width, FIRE_CADET.MAT);
  assert.equal(MAT_VECTOR.height, FIRE_CADET.MAT);
  assert.deepEqual(MAT_VECTOR.background, { r: 146, g: 150, b: 111 });
  assert.equal(MAT_VECTOR.layers.length, 49 + 8 + 12 + 160 + 1);
  assert.ok(MAT_VECTOR.layers.every((l) => l.kind === 'rect'));
  assert.equal(LABEL_BOXES.length, 8);
  const white = MAT_VECTOR.layers.filter((l) => l.kind === 'rect' && l.color.r === 255 && l.color.g === 255 && l.color.b === 255);
  assert.equal(white.length, 8 + 160 + 1);
  // every layer lies on the mat
  for (const l of MAT_VECTOR.layers) {
    if (l.kind !== 'rect') continue;
    const r = l.rect;
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= FIRE_CADET.MAT + 1e-9 && r.y + r.h <= FIRE_CADET.MAT + 1e-9, JSON.stringify(r));
  }
  // the 49 squares cover the mat exactly
  const area = MAT_VECTOR.layers.slice(0, 49).reduce((sum, l) => sum + (l.kind === 'rect' ? l.rect.w * l.rect.h : 0), 0);
  assert.ok(near(area, FIRE_CADET.MAT * FIRE_CADET.MAT, 1e-6));
});

test('the thirteen road squares (map report 3.2, class A and B): none is a marked place or a Water square', () => {
  assert.deepEqual(ROAD_SQUARES.map(squareName), ['C3', 'D3', 'E3', 'B4', 'D5', 'F7', 'C2', 'E2', 'C4', 'B5', 'F5', 'G4', 'E7']);
  for (const r of ROAD_SQUARES) {
    assert.equal(placeAt(r), null);
    assert.ok(isRoadSquare(r));
  }
});

test('the mat picture (design 8.1): at its address, 2500 x 2500 px lossy WebP, one picture chunk, no metadata, about 0.56 MB', () => {
  assert.equal(MAT_IMAGE_URL, '/simulator/fire-cadet/mat.webp');
  assert.equal(MAT_SENSOR_IMAGE_URL, '', 'no floor sensor, no second picture');
  const file = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), 'public', MAT_IMAGE_URL);
  const bytes = readFileSync(file);
  assert.ok(statSync(file).size < 600_000, `${statSync(file).size} bytes`);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  // the chunks: exactly one, the lossy picture ('VP8 '): no EXIF, no XMP, no ICC profile
  const chunks: string[] = [];
  for (let at = 12; at + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(at + 4);
    chunks.push(bytes.toString('ascii', at, at + 4));
    at += 8 + size + (size & 1);
  }
  assert.deepEqual(chunks, ['VP8 ']);
  // the size of the picture, from the VP8 frame header (after the start code 9d 01 2a)
  assert.deepEqual([...bytes.subarray(23, 26)], [0x9d, 0x01, 0x2a]);
  assert.equal(bytes.readUInt16LE(26) & 0x3fff, 2500);
  assert.equal(bytes.readUInt16LE(28) & 0x3fff, 2500);
});
