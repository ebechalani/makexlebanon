/**
 * The vector mat sampler (./mat.ts): filled polygons. (Rectangles and strokes are tested with
 * the mats of the games that use them.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fastVectorSampler } from './engine-sensors';
import { VectorMatSampler } from './mat';
import type { MatVector, RGB } from './types';

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const RED: RGB = { r: 200, g: 0, b: 0 };
const GREY: RGB = { r: 120, g: 120, b: 120 };

/** A 100 x 100 mm white mat with one shape on it. */
function matWith(layers: MatVector['layers']): MatVector {
  return { width: 100, height: 100, background: WHITE, outside: GREY, layers };
}

test('polygon: a triangle is filled inside its edges and nowhere else', () => {
  const mat = matWith([
    {
      kind: 'polygon',
      contours: [
        [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 10, y: 90 },
        ],
      ],
      color: BLACK,
    },
  ]);
  const s = new VectorMatSampler(mat);
  assert.deepEqual(s.sample(20, 20), BLACK);
  assert.deepEqual(s.sample(49, 49), BLACK, 'just inside the slanted edge');
  assert.deepEqual(s.sample(51, 51), WHITE, 'just outside the slanted edge');
  assert.deepEqual(s.sample(5, 50), WHITE, 'left of it');
  assert.deepEqual(s.sample(50, 95), WHITE, 'below it');
  assert.deepEqual(s.sample(-1, 20), GREY, 'off the mat');
});

test('polygon: an outline inside another one is a hole (even-odd), whichever way it runs', () => {
  const outer = [
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ];
  const inner = [
    { x: 30, y: 30 },
    { x: 70, y: 30 },
    { x: 70, y: 70 },
    { x: 30, y: 70 },
  ];
  for (const hole of [inner, [...inner].reverse()]) {
    const s = new VectorMatSampler(matWith([{ kind: 'polygon', contours: [outer, hole], color: RED }]));
    assert.deepEqual(s.sample(20, 50), RED, 'in the ring');
    assert.deepEqual(s.sample(50, 50), WHITE, 'in the hole');
    assert.deepEqual(s.sample(95, 50), WHITE, 'outside');
  }
});

test('polygon: layers keep their order, outlines with fewer than three points are ignored', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
    { x: 60, y: 60 },
    { x: 0, y: 60 },
  ];
  const mat = matWith([
    { kind: 'rect', rect: { x: 40, y: 40, w: 40, h: 40 }, color: BLACK },
    {
      kind: 'polygon',
      contours: [
        square,
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      ],
      color: RED,
    },
  ]);
  const s = new VectorMatSampler(mat);
  assert.deepEqual(s.sample(50, 50), RED, 'the polygon is painted after the rectangle');
  assert.deepEqual(s.sample(70, 70), BLACK);
  assert.deepEqual(s.sample(1.5, 1.2), RED, 'the two-point outline cuts no hole');
  // the fast sampler of the engine gives the same answers
  const fast = fastVectorSampler(mat);
  for (const [x, y] of [
    [50.5, 50.5],
    [70.5, 70.5],
    [90.5, 10.5],
  ]) {
    assert.deepEqual(fast.sample(x, y), s.sample(x, y), `${x}, ${y}`);
  }
});
