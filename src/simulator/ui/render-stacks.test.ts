/**
 * The stage and stacks of cubes (render.ts; Logistique intelligente design 5.2): its two opt-ins,
 * which no game before Logistique intelligente reaches.
 *
 * 1. A cube that others can stand on (kind 'cube' and Body.platform: a cube of a stack of two) is
 *    drawn as a cube, its number written dark on the yellow - not as a tower, as every other
 *    platform is (Fire Rescue's towers).
 * 2. What stands on the body the claw holds (Body.keepsRiders: a stack taken by its bottom cube)
 *    rises with it, so it is drawn after the robot, over the fingers, lowest first.
 *
 * The games before have neither: none of their bodies is a cube and a platform, and without
 * keepsRiders the claw takes nothing along (core/engine.ts grab()), so the list of riders is
 * always empty. Their pictures are the same call for call (the draw-call baseline of the design,
 * 5.2: every example of the eight games drawn at 0, 30 and 60 s, the same sha256 before and after;
 * checked outside this suite).
 *
 * As in render-painters.test.ts, the stage is drawn into a recording 2-D context (a Proxy that
 * writes down every call and every setting, in order), so drawings are compared call for call.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createEngineSimulation } from '../core/engine';
import { DEFAULT_ROBOT_CONFIG, liftAngleForHeight } from '../core/robot';
import { forever, makeBody, scripted, waitUntil } from '../core/test-helpers';
import type { Body, Game, MatVector, Simulation } from '../core/types';
import { CUBE_KIND, drawBody, drawStage, fitView, ridersOfHeld, type MatPainter, type StagePainters } from './render';

/** One entry per call or setting: its name and its arguments (an object is written as its kind). */
type Entry = Array<string | number | boolean | null>;
const flat = (value: unknown): string | number | boolean | null =>
  value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : `<${typeof value}>`;

/** A 2-D context that writes down every call and every setting into `log` (render-painters.test.ts). */
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

const sha256 = (log: Entry[]): string => createHash('sha256').update(JSON.stringify(log)).digest('hex');

// =============================================================================================
// 1. A cube that is a platform is drawn as a cube
// =============================================================================================

/** Logistique intelligente's cube 3 (design 3.1), with what the test changes. */
const yellowCube = (part: Partial<Body> = {}): Body =>
  makeBody({ id: 'cube:3', kind: CUBE_KIND, label: '3', fill: '#ffd21f', colorName: 'yellow', x: 600, y: 602, w: 50, l: 50, h: 50, grippable: true, ...part });

function drawnBody(body: Body): Entry[] {
  const log: Entry[] = [];
  drawBody(recordingContext(log), body, 2);
  return log;
}

/**
 * The sha256 of drawBody's call list for the two kinds the games before draw, measured on main
 * c523689, before this opt-in (there a cube that is a platform was drawn as a tower: the same
 * call list as the tower's).
 */
const BEFORE = {
  /** a cube that is not a platform (Warehouse Sort's cargo, here yellow): 47 entries */
  cube: 'b57650451637283a1261ac665c9dfb81aaed9701ecfaf7e0d7060716d7801bbc',
  /** a platform of another kind: a tower (Fire Rescue), 50 entries */
  tower: '64ed8a15808c06d1aa41becd78a9941733f4cea16f21f7c2a0071edc7f108f91',
};

test('stage: a yellow cube that others can stand on is drawn as a cube - call for call as a cube that is not a platform, only its number written dark', () => {
  const platform = drawnBody(yellowCube({ platform: true, keepsRiders: true }));
  const plain = drawnBody(yellowCube());
  assert.equal(platform.length, plain.length);
  const differ = platform.map((e, k) => k).filter((k) => JSON.stringify(platform[k]) !== JSON.stringify(plain[k]));
  assert.deepEqual(differ.map((k) => [platform[k], plain[k]]), [[['=fillStyle', '#111827'], ['=fillStyle', '#ffffff']]], 'only the ink of the number');
  // a cube's corners (6 mm) and its number's size (0.44 of its side: 22 mm), not a tower's (5 mm, 17 mm)
  assert.ok(platform.some((e) => e[0] === 'arcTo' && e[5] === 6));
  assert.ok(!platform.some((e) => e[0] === 'arcTo' && e[5] === 5));
  assert.ok(platform.some((e) => e[0] === '=font' && String(e[1]).startsWith('700 22px ')));
  // and the number right after its ink
  const ink = platform.findIndex((e) => e[0] === '=fillStyle' && e[1] === '#111827');
  assert.deepEqual(platform[ink + 1], ['fillText', '3', 0, platform[ink + 1][3]]);
});

test('stage: a cube that is not a platform, and a tower, are drawn call for call as before', () => {
  assert.equal(sha256(drawnBody(yellowCube())), BEFORE.cube);
  const tower = drawnBody(yellowCube({ kind: 'rescue-tower', platform: true, grippable: false }));
  assert.equal(sha256(tower), BEFORE.tower);
  // (a tower: corners of 5 mm, a lighter top plate with its own rim, a number of 0.34 of its side)
  assert.ok(tower.some((e) => e[0] === 'arcTo' && e[5] === 5));
  assert.ok(tower.some((e) => e[0] === '=font' && String(e[1]).startsWith('700 17px ')));
});

// =============================================================================================
// 2. What stands on the held body is drawn over the robot
// =============================================================================================

test('stage: ridersOfHeld - what stands on the held body, and on that, lowest first; nothing when the claw is empty', () => {
  const a = yellowCube({ id: 'a', platform: true, keepsRiders: true, held: true });
  const b = yellowCube({ id: 'b', platform: true, keepsRiders: true, z: 50, restingOn: 'a' });
  const c = yellowCube({ id: 'c', platform: true, keepsRiders: true, z: 100, restingOn: 'b' });
  const d = yellowCube({ id: 'd', platform: true, keepsRiders: true, z: 150, restingOn: 'c' });
  const e = yellowCube({ id: 'e', platform: true, keepsRiders: true, x: 300 });
  const f = yellowCube({ id: 'f', platform: true, keepsRiders: true, x: 300, z: 50, restingOn: 'e' });
  // listed highest first: found all the same, and handed back lowest first
  assert.deepEqual(ridersOfHeld([d, f, c, e, b, a], 'a').map((x) => x.id), ['b', 'c', 'd']);
  assert.deepEqual(ridersOfHeld([d, f, c, e, b, a], 'c').map((x) => x.id), ['d']);
  assert.deepEqual(ridersOfHeld([d, f, c, e, b, a], null), []);
  assert.deepEqual(ridersOfHeld([a, e, f], 'a'), [], 'nothing stands on it');
});

const MAT: MatVector = { width: 1000, height: 1000, background: { r: 35, g: 31, b: 32 }, outside: { r: 145, g: 143, b: 143 }, layers: [] };
const G = DEFAULT_ROBOT_CONFIG.gripper;

/**
 * A stack of two yellow cubes ('cube:1', 'cube:6' on it) right in the claw of the standard robot,
 * and one more cube ('cube:2') on the mat. The claw closes and the arm goes up: with keepsRiders
 * the robot holds cube 1 and cube 6 rides on it; without, cube 6 has come down to the mat.
 */
function heldStack(keepsRiders: boolean): Simulation<null> {
  const stackX = 500;
  const stackY = 500 - G.gripForward;
  const cube = (id: string, x: number, y: number, z: number, restingOn: string | null): Body =>
    yellowCube({ id, label: id.slice(5), x, y, z, restingOn, platform: true, ...(keepsRiders ? { keepsRiders: true } : {}) });
  const bodies = (): Body[] => [cube('cube:1', stackX, stackY, 0, null), cube('cube:2', 800, 300, 0, null), cube('cube:6', stackX, stackY, 50, 'cube:1')];
  const game: Game<null> = {
    id: 'stacks-stage-test',
    title: 'Stacks stage test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 60,
    startZone: { x: 0, y: 0, w: 1000, h: 1000 },
    defaultStartPose: { x: 500, y: 500, heading: 0 },
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: bodies,
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
  const sim = createEngineSimulation(
    { game, scenario: null, program: {} },
    scripted(function* (io) {
      io.setServo(G.clawServo, G.clawClosedAngle);
      yield* waitUntil(() => io.servoDone(G.clawServo));
      io.setServo(G.liftServo, liftAngleForHeight(G, G.liftUpHeight));
      yield* waitUntil(() => io.servoDone(G.liftServo));
      yield* forever();
    }).factory,
  ) as Simulation<null>;
  sim.start();
  for (let n = 0; n < 1000 && !(sim.world.robot.gripper.holding && sim.world.robot.gripper.height >= G.liftUpHeight); n++) sim.step(1);
  return sim;
}

/** Draw the stage once (no sensors, trail or zones: the robot and what it holds are the last things drawn) and return the log. */
function drawLogged(sim: Simulation<null>, painters?: (log: Entry[]) => StagePainters): Entry[] {
  const log: Entry[] = [];
  const view = fitView(800, 800, sim.game.mat.width, sim.game.mat.height, 1, 45);
  const mat = { paint: () => log.push(['mat']) } as unknown as MatPainter;
  const scene = { sim, view, options: { overlays: true, sensors: false, trail: false }, mat, trail: { points: [] } as never, overlays: [], placing: false, ghost: null, ruler: null };
  drawStage(recordingContext(log), painters ? { ...scene, painters: painters(log) } : scene);
  return log;
}

const byId = (sim: Simulation<null>, id: string): Body => {
  const b = sim.world.bodies.find((x) => x.id === id);
  assert.ok(b, id);
  return b;
};

test('stage: a stack held by its bottom cube - the cube on it is drawn after the robot, over the fingers, exactly as drawBody draws it', () => {
  const sim = heldStack(true);
  assert.equal(sim.world.robot.gripper.holding, 'cube:1');
  const top = byId(sim, 'cube:6');
  assert.equal(top.restingOn, 'cube:1');
  assert.equal(top.z, byId(sim, 'cube:1').z + 50);
  assert.deepEqual(ridersOfHeld(sim.world.bodies, 'cube:1'), [top]);

  const log = drawLogged(sim);
  // the same stage without that cube: everything as before, and the cube's own drawing after it
  const bodies = sim.world.bodies;
  const at = bodies.indexOf(top);
  bodies.splice(at, 1);
  const without = drawLogged(sim);
  bodies.splice(at, 0, top);
  const view = fitView(800, 800, sim.game.mat.width, sim.game.mat.height, 1, 45);
  const own: Entry[] = [];
  drawBody(recordingContext(own), top, view.scale * view.dpr);
  assert.ok(own.length > 20);
  assert.deepEqual(log, [...without, ...own], 'drawn last: after the robot, its fingers and the held cube');
});

test('stage: with painters - the cube on the held body is asked after the robot, the cubes on the mat before it', () => {
  const sim = heldStack(true);
  const log = drawLogged(sim, (l) => ({
    body: (_c, b) => (l.push(['painter:body', b.id]), true),
    robot: () => void l.push(['painter:robot']),
  }));
  assert.deepEqual(log.filter((e) => String(e[0]).startsWith('painter:')), [['painter:body', 'cube:2'], ['painter:robot'], ['painter:body', 'cube:6']]);
  assert.deepEqual(log[log.length - 1], ['painter:body', 'cube:6']);
});

test('stage: without keepsRiders (every game before) the claw takes the bottom cube alone - nothing is drawn after the robot', () => {
  const sim = heldStack(false);
  assert.equal(sim.world.robot.gripper.holding, 'cube:1');
  const fallen = byId(sim, 'cube:6');
  assert.equal(fallen.restingOn, null);
  assert.equal(fallen.z, 0);
  assert.deepEqual(ridersOfHeld(sim.world.bodies, 'cube:1'), []);
  const log = drawLogged(sim, (l) => ({
    body: (_c, b) => (l.push(['painter:body', b.id]), true),
    robot: () => void l.push(['painter:robot']),
  }));
  // the fallen cube stands on the mat: drawn with the others, before the robot, in the order of the list
  assert.deepEqual(log.filter((e) => String(e[0]).startsWith('painter:')), [['painter:body', 'cube:2'], ['painter:body', 'cube:6'], ['painter:robot']]);
});
