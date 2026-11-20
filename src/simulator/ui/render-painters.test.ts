/**
 * A game's own drawings on the stage (render.ts, StagePainters): Fire Cadet draws its mTiny, its
 * rescue items, its obstacles and the Fire marker itself; the four older games hand over nothing
 * and the stage draws what it always drew.
 *
 * The stage is drawn into a recording 2-D context (a Proxy that writes down every call and every
 * setting, in order), so whole drawings can be compared call for call. The stand-in mat and the
 * painters write their own entries ("mat", "painter:...") into the same log. (The fixed walls are
 * drawn into a canvas of their own first: a stand-in document gives one.)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEngineSimulation } from '../core/engine';
import { forever, makeBody, scripted } from '../core/test-helpers';
import type { Body, FixedWall, Game, MatVector, RefereeCall, Simulation } from '../core/types';
import { FIRE_KIND, drawStage, fitView, type MatPainter, type StagePainters } from './render';

const MAT: MatVector = { width: 1000, height: 1000, background: { r: 255, g: 255, b: 255 }, outside: { r: 120, g: 120, b: 120 }, layers: [] };

/** Two elements (one of them the fire, which the stage draws in its own way) and one fixed wall; the standard robot. */
const BODIES: Body[] = [
  makeBody({ id: 'cube', x: 300, y: 300, w: 40, l: 40, h: 40 }),
  makeBody({ id: 'fire', kind: FIRE_KIND, x: 700, y: 300, w: 60, l: 60, h: 30 }),
];
const WALLS: FixedWall[] = [{ id: 'wall:w', label: 'w', x: 500, y: 150, angle: 0, w: 300, l: 20, h: 100, fill: '#999' }];

function makeSim(call: RefereeCall | null = null): Simulation<unknown> {
  const game: Game<null> = {
    id: 'painters-test',
    title: 'Painters test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 60,
    startZone: { x: 0, y: 0, w: 1000, h: 1000 },
    defaultStartPose: { x: 500, y: 800, heading: 0 },
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: () => BODIES.map((b) => ({ ...b, home: { ...b.home } })),
    createWalls: () => WALLS.map((w) => ({ ...w })),
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
    createReferee: () => ({ observe: () => call, restart() {}, score: () => ({ total: 0, max: 0, lines: [], complete: false }) }),
  };
  return createEngineSimulation({ game, scenario: null, program: {} }, scripted(forever).factory) as Simulation<unknown>;
}

/** One entry per call or setting: its name and its arguments (an object is written as its kind). */
type Entry = Array<string | number | boolean | null>;
const flat = (value: unknown): string | number | boolean | null =>
  value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : `<${typeof value}>`;

/** A 2-D context that writes down every call and every setting into `log`. */
function recordingContext(log: Entry[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { canvas: { width: 800, height: 800 } };
  const gradient = { addColorStop: (...args: unknown[]) => log.push(['addColorStop', ...args.map(flat)]) };
  return new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push([key, ...args.map(flat)]);
        if (key === 'measureText') return { width: String(args[0]).length * 5 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient;
        if (key === 'getImageData') return { data: new Uint8ClampedArray(4) };
        return undefined;
      };
    },
    set(target, key: string, value) {
      log.push([`=${key}`, flat(value)]);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/**
 * Draw the stage once and return the log. `painters`: built on the log of this very drawing;
 * 'left out' = the scene has no `painters` field at all (as the four older screens hand it over).
 */
function drawLogged(sim: Simulation<unknown>, painters: 'left out' | ((log: Entry[]) => StagePainters | undefined)): Entry[] {
  const log: Entry[] = [];
  const ctx = recordingContext(log);
  const view = fitView(800, 800, sim.game.mat.width, sim.game.mat.height, 1, 45);
  const mat = { paint: () => log.push(['mat']) } as unknown as MatPainter;
  const scene = { sim, view, options: { overlays: true, sensors: false, trail: false }, mat, trail: { points: [] } as never, overlays: [], placing: false, ghost: null, ruler: null };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const standIn = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext([]) }) };
  Object.defineProperty(globalThis, 'document', { value: standIn, configurable: true, writable: true });
  try {
    drawStage(ctx, painters === 'left out' ? scene : { ...scene, painters: painters(log) });
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had);
    else delete (globalThis as { document?: unknown }).document;
  }
  return log;
}

const isPainter = (e: Entry): boolean => String(e[0]).startsWith('painter:');

test('painters: none, or an empty set, draw the stage call for call as before', () => {
  const sim = makeSim();
  const before = drawLogged(sim, 'left out');
  assert.deepEqual(drawLogged(sim, () => undefined), before);
  assert.deepEqual(drawLogged(sim, () => ({})), before);
  assert.ok(before.length > 100, `the stage drew something: ${before.length} entries`);
  assert.equal(before.filter((e) => e[0] === 'mat').length, 1);
});

test('painters: ground - once, right after the mat picture, with the stage and its view', () => {
  const sim = makeSim();
  const before = drawLogged(sim, 'left out');
  const matAt = before.findIndex((e) => e[0] === 'mat');
  const log = drawLogged(sim, (l) => ({ ground: (_c, s, v) => void l.push(['painter:ground', s === sim, v.scale > 0]) }));
  assert.deepEqual(log, [...before.slice(0, matAt + 1), ['painter:ground', true, true], ...before.slice(matAt + 1)]);
});

test('painters: walls - once, with World.walls, in place of the grey boxes', () => {
  const sim = makeSim();
  const before = drawLogged(sim, 'left out');
  // the stage draws its walls as one picture: save, setTransform, drawImage, restore
  const picture = before.findIndex((e) => e[0] === 'drawImage');
  assert.deepEqual(before.slice(picture - 2, picture + 2).map((e) => e[0]), ['save', 'setTransform', 'drawImage', 'restore']);
  const log = drawLogged(sim, (l) => ({ walls: (_c, walls) => void l.push(['painter:walls', walls === sim.world.walls, walls.length]) }));
  assert.deepEqual(log, [...before.slice(0, picture - 2), ['painter:walls', true, 1], ...before.slice(picture + 2)]);
});

test('painters: robot - once, in place of the mBot2', () => {
  const sim = makeSim();
  const before = drawLogged(sim, 'left out');
  const log = drawLogged(sim, (l) => ({ robot: (_c, s) => void l.push(['painter:robot', s === sim]) }));
  // (the robot is the last thing drawn here: no sensors, props, fan, ghost or ruler)
  assert.deepEqual(log[log.length - 1], ['painter:robot', true]);
  assert.deepEqual(log.slice(0, -1), before.slice(0, log.length - 1), 'everything before the robot as before');
  assert.ok(before.length - (log.length - 1) > 20, `the mBot2 drawing (${before.length - (log.length - 1)} entries) is not drawn`);
});

test('painters: body - asked once for every standing element, lowest first; true = drawn, false = the stage draws it as always', () => {
  const sim = makeSim();
  const before = drawLogged(sim, 'left out');

  const drawsAll = drawLogged(sim, (l) => ({ body: (_c, b) => (l.push(['painter:body', b.id]), true) }));
  // (both stand on the mat: in the order of the list)
  assert.deepEqual(drawsAll.filter(isPainter), [
    ['painter:body', 'cube'],
    ['painter:body', 'fire'],
  ]);
  const first = drawsAll.findIndex(isPainter);
  const last = first + 1;
  assert.ok(isPainter(drawsAll[last]), 'nothing drawn between the two: neither element by the stage');
  assert.deepEqual(drawsAll.slice(0, first), before.slice(0, first), 'before the elements: as before');
  const tail = drawsAll.length - 1 - last;
  assert.deepEqual(drawsAll.slice(last + 1), before.slice(before.length - tail), 'after them (the robot): as before');

  const drawsNone = drawLogged(sim, (l) => ({ body: (_c, b) => (l.push(['painter:body', b.id]), false) }));
  assert.equal(drawsNone.filter(isPainter).length, 2);
  assert.deepEqual(drawsNone.filter((e) => !isPainter(e)), before);

  // one that draws the cube itself and leaves the fire, with its flame, to the stage
  const some = drawLogged(sim, () => ({ body: (_c, b) => b.id === 'cube' }));
  assert.ok(some.length < before.length);
  const gradients = (log: Entry[]) => log.filter((e) => e[0] === 'createLinearGradient').length;
  assert.ok(gradients(before) > 0);
  assert.equal(gradients(some), gradients(before), 'the fire is still drawn with its flame');
});

test('painters: all four at once - the stage draws the table, the mat and the zones, the game the rest', () => {
  const sim = makeSim();
  const log = drawLogged(sim, (l) => ({
    ground: () => void l.push(['painter:ground']),
    walls: () => void l.push(['painter:walls']),
    body: (_c, b) => (l.push(['painter:body', b.id]), true),
    robot: () => void l.push(['painter:robot']),
  }));
  assert.deepEqual(log.filter(isPainter).map((e) => e[0]), ['painter:ground', 'painter:walls', 'painter:body', 'painter:body', 'painter:robot']);
  assert.ok(isPainter(log[log.length - 1]), 'nothing of the stage after the robot');
});

test('painters: an element the referee took off the field (removeBodies) is not drawn any more', () => {
  const sim = makeSim({ removeBodies: ['cube'] });
  const asked = (): string[] =>
    drawLogged(sim, (l) => ({ body: (_c, b) => (l.push(['painter:body', b.id]), true) }))
      .filter(isPainter)
      .map((e) => String(e[1]));
  assert.deepEqual(asked(), ['cube', 'fire']);
  sim.start();
  sim.step(1);
  assert.deepEqual(asked(), ['fire']);
  // and without painters the stage draws one element less
  const sim2 = makeSim({ removeBodies: ['cube'] });
  const both = drawLogged(sim2, 'left out').length;
  sim2.start();
  sim2.step(1);
  assert.ok(drawLogged(sim2, 'left out').length < both);
});
