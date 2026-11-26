/**
 * Stacks that stay stacks (Body.keepsRiders, core/types.ts): the ten 50 mm cubes of Logistique
 * intelligente, two layers of five on the storage cross (its design 3.1, 3.2 and 5.1). A cube that
 * is grippable, a platform and keepsRiders can be taken by the claw with another cube standing on
 * it: the pair is carried, raised, turned, pushed back and put down together, and only those two
 * cubes move. Without keepsRiders the claw takes the bottom cube alone and the top cube drops
 * through it, as in every game before (grab()).
 *
 * The engine on its own: no referee. The field is Logistique intelligente's as its design measured
 * it on the print file (map/field-data.json; origin = the arena's top-left inner corner): the
 * arena 1200 x 1200 inside the frame, the start area x 476..724, y 950..1200, the storage cross of
 * five 50 mm squares around (600, 602), the 40 mm warehouses, and the frame as four fixed walls
 * 50 mm high and 20 mm thick just outside the arena (design L4, an assumption). The game's own
 * files hold those numbers; they are written out here so that the engine is tested on its own.
 * The cubes are created as the game creates them (design 3.1): the five bottom cubes first (a claw
 * lower than 49.5 mm then grips the bottom cube), the top cube of a square = its bottom cube's
 * number + 5. The robot is Tri d'entrepôt's mBot2 (WAREHOUSE_SORT_ROBOT): its claw's underside
 * goes from 5 mm (arm down) to 75 mm (arm up), the block "arm to (p) %" puts it at 5 + 0.7 p mm.
 *
 * The robot is driven by the scripted VM of test-helpers.ts (servo angles and encoder moves, one
 * step per tick). Every number here is the one the design's probes print, measured on main c523689
 * with the addition (design/revise/results: c1-pairs, c4-shift, c6-tower, a1; design/probe:
 * p1, p2, p6 with keepsRiders), and again on this engine.
 *
 * The games before Logistique intelligente have no body with keepsRiders, so none of this runs for
 * them: their six baseline hashes are the same before and after (design 5.1, checked outside this
 * suite).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { liftAngleForHeight } from './robot';
import { drive, makeBody, scripted, sleep, turn, waitUntil, type Script } from './test-helpers';
import type { Body, FixedWall, Game, MatVector, Pose, SimEvent, Simulation } from './types';
import { WAREHOUSE_SORT_ROBOT } from '../warehouse-sort/robot';

// =============================================================================================
// The field (Logistique intelligente design 0.2, 2.1, 3.1; map/field-data.json)
// =============================================================================================

const ARENA = 1200;
/** The start area: 248 x 250 mm, from the printed area to the frame. */
const START_AREA = { x: 476, y: 950, w: 248, h: 250 };
const CUBE = 50;
/** The five squares of the storage cross (their middles), in the order the game numbers them. */
const SQUARES = {
  haut: { x: 600, y: 552 },
  gauche: { x: 550, y: 602 },
  centre: { x: 600, y: 602 },
  droite: { x: 650, y: 602 },
  bas: { x: 600, y: 652 },
} as const;
type Square = keyof typeof SQUARES;
const SQUARE_NAMES = Object.keys(SQUARES) as Square[];
/** The bottom cube of a square: cube:1 (haut) .. cube:5 (bas); the top cube on it: + 5. */
const bottomOf = (square: Square): string => `cube:${SQUARE_NAMES.indexOf(square) + 1}`;
const topOf = (square: Square): string => `cube:${SQUARE_NAMES.indexOf(square) + 6}`;

/** A warehouse: a 40 mm square (the four used here are square to the arena). */
interface Warehouse {
  x: number;
  y: number;
}
const WAREHOUSES: Record<'E3' | 'E5' | 'E6' | 'E7' | 'E8', Warehouse> = {
  E3: { x: 813.41, y: 51.1 },
  E5: { x: 220.5, y: 391 },
  E6: { x: 979.5, y: 391 },
  E7: { x: 57.5, y: 985.25 },
  E8: { x: 1142.5, y: 985.25 },
};
const WAREHOUSE_SIZE = 40;

/** The frame: four walls standing just outside the arena (design 2.5; 50 mm high is an assumption). */
const FRAME_HEIGHT = 50;
const FRAME_THICKNESS = 20;
function frame(): FixedWall[] {
  const t = FRAME_THICKNESS;
  const wall = (id: string, x: number, y: number, w: number, l: number): FixedWall => ({ id, label: 'cadre', x, y, angle: 0, w, l, h: FRAME_HEIGHT, fill: '#444444' });
  return [
    wall('cadre:haut', ARENA / 2, -t / 2, ARENA + 2 * t, t),
    wall('cadre:bas', ARENA / 2, ARENA + t / 2, ARENA + 2 * t, t),
    wall('cadre:gauche', -t / 2, ARENA / 2, t, ARENA),
    wall('cadre:droite', ARENA + t / 2, ARENA / 2, t, ARENA),
  ];
}

const MAT: MatVector = { width: ARENA, height: ARENA, background: { r: 35, g: 31, b: 32 }, outside: { r: 145, g: 143, b: 143 }, layers: [] };

/** A cube as the game makes it: 50 x 50 x 50, yellow, grippable, a platform, keepsRiders. */
function cube(id: string, x: number, y: number, z = 0, restingOn: string | null = null, keepsRiders = true): Body {
  return makeBody({
    id,
    kind: 'cube',
    label: id.slice('cube:'.length),
    fill: '#ffd21f',
    colorName: 'yellow',
    x,
    y,
    w: CUBE,
    l: CUBE,
    h: CUBE,
    z,
    restingOn,
    grippable: true,
    platform: true,
    ...(keepsRiders ? { keepsRiders: true } : {}),
  });
}

/** A stack of two: the bottom cube `id` on the mat, the cube `id + ':dessus'` on it. */
function pair(id: string, x: number, y: number, keepsRiders = true): Body[] {
  return [cube(id, x, y, 0, null, keepsRiders), cube(`${id}:dessus`, x, y, CUBE, id, keepsRiders)];
}

/** The starting condition (design 3.1): ten cubes, two layers of five, as a cross; bottoms first. */
function cross(keepsRiders = true): Body[] {
  return [
    ...SQUARE_NAMES.map((s) => cube(bottomOf(s), SQUARES[s].x, SQUARES[s].y, 0, null, keepsRiders)),
    ...SQUARE_NAMES.map((s) => cube(topOf(s), SQUARES[s].x, SQUARES[s].y, CUBE, bottomOf(s), keepsRiders)),
  ];
}

function makeGame(bodies: () => Body[], walls: boolean): Game<null> {
  return {
    id: 'stacks-test',
    title: 'Stacks test',
    mat: { width: ARENA, height: ARENA, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 150,
    startZone: START_AREA,
    defaultStartPose: START_POSE,
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: bodies,
    ...(walls ? { createWalls: frame } : {}),
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
    robotConfig: ROBOT,
  };
}

// =============================================================================================
// The robot (Tri d'entrepôt's mBot2) and the scripted moves
// =============================================================================================

const ROBOT = WAREHOUSE_SORT_ROBOT;
const G = ROBOT.gripper;
/** Facing up, its middle on x 600, with 6.5 mm free in front and behind in the start area (design 4.2). */
const START_POSE: Pose = { x: 600, y: 1123.5, heading: 0 };
const UP = 0;
const RIGHT = Math.PI / 2;
const DOWN = Math.PI;
const LEFT = -Math.PI / 2;

/** The simulation being run: the scripts read the robot's pose from it to steer. */
let live: Simulation<null> | null = null;
const running = (): Simulation<null> => {
  assert.ok(live, 'a scene is running');
  return live;
};
const pose = (): Pose => running().world.robot.pose;
const bodyIn = (sim: Simulation<null>, id: string): Body => {
  const b = sim.world.bodies.find((x) => x.id === id);
  assert.ok(b, `${id} is on the field`);
  return b;
};
const liveBody = (id: string): Body => bodyIn(running(), id);

/** The arm to a claw underside of h mm (5..75). */
function* lift(io: Parameters<Script>[0], h: number): Generator<void, void, void> {
  io.setServo(G.liftServo, liftAngleForHeight(G, h));
  yield* waitUntil(() => io.servoDone(G.liftServo));
}
/** The block "arm to (p) %": the lift servo to p x 0.9 degrees. */
function* liftPercent(io: Parameters<Script>[0], p: number): Generator<void, void, void> {
  io.setServo(G.liftServo, p * 0.9);
  yield* waitUntil(() => io.servoDone(G.liftServo));
}
function* claw(io: Parameters<Script>[0], closed: boolean): Generator<void, void, void> {
  io.setServo(G.clawServo, closed ? G.clawClosedAngle : G.clawOpenAngle);
  yield* waitUntil(() => io.servoDone(G.clawServo));
}
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Turn on the spot to face `heading` (radians, 0 = up, clockwise +). */
function* face(io: Parameters<Script>[0], heading: number, rpm = 30): Generator<void, void, void> {
  const degrees = (wrap(heading - pose().heading) * 180) / Math.PI;
  if (Math.abs(degrees) > 1e-9) yield* turn(io, degrees, rpm);
}
/** Turn towards (x, y) and drive the axle there. */
function* goTo(io: Parameters<Script>[0], x: number, y: number, rpm: number): Generator<void, void, void> {
  const p = pose();
  yield* face(io, Math.atan2(x - p.x, -(y - p.y)));
  const d = Math.hypot(x - pose().x, y - pose().y);
  if (d > 1e-9) yield* drive(io, d, rpm);
}
/**
 * Bring the claw's middle over (x, y), the robot facing `heading` at the end: the axle to the point
 * `back` mm behind where it must end, a turn there, then straight in (a turn on the spot right next
 * to a cube would sweep the chassis corners, 123.5 mm from the axle, into it).
 */
function* clawOver(io: Parameters<Script>[0], x: number, y: number, heading: number, rpm = 60, back = 100): Generator<void, void, void> {
  const reach = G.gripForward + back;
  yield* goTo(io, x - reach * Math.sin(heading), y + reach * Math.cos(heading), rpm);
  yield* face(io, heading);
  yield* drive(io, back, Math.min(rpm, 40));
}

// =============================================================================================
// Running a scene, and what to look at
// =============================================================================================

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0; // (+ 0: no -0)
const deg = (rad: number): number => r2((rad * 180) / Math.PI);
/** A body as the probes print it: "(x, y) z <z> <angle> deg on <support>[ HELD]". */
const where = (b: Body): string => `(${r2(b.x)}, ${r2(b.y)}) z ${r2(b.z)} ${deg(b.angle)} deg on ${b.restingOn}${b.held ? ' HELD' : ''}`;
type Snapshot = Record<string, string>;
const snapshot = (sim: Simulation<null>): Snapshot => Object.fromEntries(sim.world.bodies.map((b) => [b.id, where(b)]));
/** The ids of the bodies that are not where they were. */
const movedIds = (before: Snapshot, after: Snapshot): string[] => Object.keys(after).filter((id) => before[id] !== after[id]);
const eventText = (e: SimEvent): string | null => {
  if (e.type === 'grab' || e.type === 'bump') return `${r2(e.time)} s ${e.type} ${e.bodyId}`;
  if (e.type === 'release') return `${r2(e.time)} s release ${e.bodyId} onto ${e.onto}`;
  return null;
};

interface Run {
  sim: Simulation<null>;
  before: Snapshot;
  after: Snapshot;
  /** grabs, releases and bumps, as the probes print them */
  events: string[];
}

function run(bodies: () => Body[], start: Pose, script: Script, options: { walls?: boolean; maxTicks?: number } = {}): Run {
  const sim = createEngineSimulation({ game: makeGame(bodies, options.walls ?? false), scenario: null, program: {}, startPose: start }, scripted(script).factory);
  live = sim;
  const before = snapshot(sim);
  sim.start();
  const events: string[] = [];
  const maxTicks = options.maxTicks ?? 20000;
  for (let n = 0; sim.status === 'running' && n < maxTicks; n++) {
    sim.step(1);
    for (const e of sim.drainEvents()) {
      const text = eventText(e);
      if (text) events.push(text);
    }
  }
  live = null;
  return { sim, before, after: snapshot(sim), events };
}

/**
 * How far inside the cube's footprint the warehouse's worst corner is (mm; negative = that corner
 * is outside: the cube does not cover the warehouse). A warehouse square to the arena.
 */
function coverMargin(b: Body, w: Warehouse): number {
  let worst = Infinity;
  const h = WAREHOUSE_SIZE / 2;
  for (const [u, v] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
    const dx = w.x + u - b.x;
    const dy = w.y + v - b.y;
    const along = dx * Math.sin(b.angle) - dy * Math.cos(b.angle);
    const across = dx * Math.cos(b.angle) + dy * Math.sin(b.angle);
    worst = Math.min(worst, b.l / 2 - Math.abs(along), b.w / 2 - Math.abs(across));
  }
  return r2(worst);
}

/** The top cube's offset from the cube it stands on: "dx <dx>, dy <dy>, dangle <deg>". */
const offset = (top: Body, bottom: Body): string => `dx ${r2(top.x - bottom.x)}, dy ${r2(top.y - bottom.y)}, dangle ${deg(top.angle - bottom.angle)}`;

// =============================================================================================
// The cross
// =============================================================================================

test('stacks: the cross as the game creates it - bottoms on the mat, each top cube on its bottom cube', () => {
  const sim = createEngineSimulation({ game: makeGame(() => cross(), true), scenario: null, program: {} }, scripted(function* () {}).factory);
  assert.deepEqual(snapshot(sim), {
    'cube:1': '(600, 552) z 0 0 deg on null',
    'cube:2': '(550, 602) z 0 0 deg on null',
    'cube:3': '(600, 602) z 0 0 deg on null',
    'cube:4': '(650, 602) z 0 0 deg on null',
    'cube:5': '(600, 652) z 0 0 deg on null',
    'cube:6': '(600, 552) z 50 0 deg on cube:1',
    'cube:7': '(550, 602) z 50 0 deg on cube:2',
    'cube:8': '(600, 602) z 50 0 deg on cube:3',
    'cube:9': '(650, 602) z 50 0 deg on cube:4',
    'cube:10': '(600, 652) z 50 0 deg on cube:5',
  });
  assert.equal(sim.world.walls?.length, 4);
});

test('stacks: the cross stands still for a whole match (150 s) while the robot waits in the start area', () => {
  const { sim, before, after, events } = run(() => cross(), START_POSE, function* () {
    yield* sleep(15000);
  }, { walls: true });
  assert.equal(sim.world.tick, 15000);
  assert.equal(r2(sim.world.time), 150);
  assert.deepEqual(movedIds(before, after), []);
  assert.deepEqual(events, []);
});

// =============================================================================================
// The claw at a stack: the top cube alone, or the pair
// =============================================================================================

/**
 * The robot faces up 150 mm south of the bottom stack of the cross (cube 5, cube 10 on it), sets
 * its arm with the block's percentage, drives in, closes the claw, and backs off 150 mm.
 */
function takeFromTheBottomStack(percent: number, keepsRiders = true): Run {
  const { x, y } = SQUARES.bas;
  return run(() => cross(keepsRiders), { x, y: y + G.gripForward + 150, heading: UP }, function* (io) {
    yield* liftPercent(io, percent);
    yield* drive(io, 150, 30);
    yield* claw(io, true);
    yield* drive(io, -150, 30);
  }, { walls: true });
}

test('stacks: arm at 63,58 % (claw underside 49.51 mm) takes the top cube alone; nothing else moves', () => {
  const { sim, before, after, events } = takeFromTheBottomStack(63.58);
  assert.equal(sim.world.robot.gripper.holding, 'cube:10');
  assert.deepEqual(movedIds(before, after), ['cube:10']);
  assert.equal(after['cube:10'], '(600, 802) z 50 0 deg on null HELD');
  assert.equal(after['cube:5'], '(600, 652) z 0 0 deg on null');
  assert.deepEqual(events, ['1.94 s grab cube:10']);
});

test('stacks: arm at 63,57 % (claw underside 49.50 mm) takes the bottom cube, and the top cube comes along on it', () => {
  const { sim, before, after, events } = takeFromTheBottomStack(63.57);
  assert.equal(sim.world.robot.gripper.holding, 'cube:5');
  assert.deepEqual(movedIds(before, after), ['cube:5', 'cube:10']);
  assert.equal(after['cube:5'], '(600, 802) z 0 0 deg on null HELD');
  assert.equal(after['cube:10'], '(600, 802) z 50 0 deg on cube:5');
  assert.deepEqual(events, ['1.94 s grab cube:5']);
});

test('stacks: without keepsRiders the claw takes the bottom cube alone - the top cube drops through it and shoves two stacks 50 mm (as in every game before)', () => {
  const { sim, before, after, events } = takeFromTheBottomStack(0, false);
  assert.equal(sim.world.robot.gripper.holding, 'cube:5');
  assert.deepEqual(movedIds(before, after), ['cube:1', 'cube:3', 'cube:5', 'cube:6', 'cube:8', 'cube:10']);
  assert.equal(after['cube:5'], '(600, 802) z 0 0 deg on null HELD');
  assert.equal(after['cube:10'], '(600, 602) z 0 0 deg on null');
  assert.equal(after['cube:3'], '(600, 552) z 0 0 deg on null');
  assert.equal(after['cube:8'], '(600, 552) z 50 0 deg on cube:3');
  assert.equal(after['cube:1'], '(600, 502) z 0 0 deg on null');
  assert.equal(after['cube:6'], '(600, 502) z 50 0 deg on cube:1');
  assert.deepEqual(events, ['1.62 s grab cube:5']);
});

// =============================================================================================
// A pair carried and put down (critic c1a; probe 6a, 6c)
// =============================================================================================

/** When the claw closed and opened (s), for each claw height of the next test (critic c1a). */
const GRAB_AND_RELEASE: Record<number, [number, number]> = {
  5: [1.62, 5.31],
  15: [1.7, 5.23],
  25: [1.77, 5.16],
  30: [1.8, 5.13],
  35: [1.84, 5.09],
  40: [1.88, 5.07],
  45: [1.91, 5.02],
  49: [1.94, 4.99],
  49.4: [1.94, 4.99],
};

test('stacks: the bottom stack taken by its bottom cube at every claw height from 5 to 49.4 mm - carried, raised, turned at full speed, put down: still a pair, and only those two cubes moved', () => {
  const { x, y } = SQUARES.bas;
  for (const h of [5, 15, 25, 30, 35, 40, 45, 49, 49.4]) {
    const seen: Record<string, string> = {};
    const { sim, before, after, events } = run(() => cross(), { x, y: y + G.gripForward + 150, heading: UP }, function* (io) {
      yield* lift(io, h);
      yield* drive(io, 150, 30);
      yield* claw(io, true);
      seen.held = String(running().world.robot.gripper.holding);
      yield* lift(io, 75);
      seen.lifted = `bottom z ${r2(liveBody('cube:5').z)}, top z ${r2(liveBody('cube:10').z)} on ${liveBody('cube:10').restingOn}`;
      yield* drive(io, -150, 40);
      yield* turn(io, 90, 180);
      yield* turn(io, -45, 180);
      yield* turn(io, 45, 180);
      yield* drive(io, 250, 180);
      seen.carried = offset(liveBody('cube:10'), liveBody('cube:5'));
      yield* lift(io, 5);
      yield* claw(io, false);
      yield* drive(io, -150, 40);
    }, { walls: true });
    const what = `claw underside ${h} mm`;
    assert.equal(seen.held, 'cube:5', what);
    // the cube's base rises by the 70 mm the arm goes up; the top cube sits on it
    const base = r2(75 - h);
    assert.equal(seen.lifted, `bottom z ${base}, top z ${r2(base + CUBE)} on cube:5`, what);
    assert.equal(seen.carried, 'dx 0, dy 0, dangle 0', what);
    assert.equal(after['cube:5'], '(992, 944) z 0 90 deg on null', what);
    assert.equal(after['cube:10'], '(992, 944) z 50 90 deg on cube:5', what);
    assert.deepEqual(movedIds(before, after), ['cube:5', 'cube:10'], what);
    assert.deepEqual(events, [`${GRAB_AND_RELEASE[h][0]} s grab cube:5`, `${GRAB_AND_RELEASE[h][1]} s release cube:5 onto null`], what);
    assert.equal(sim.world.robot.gripper.holding, null, what);
  }
});

test('stacks: the bottom stack carried to E5 and put down there - the bottom cube covers E5 by 5.0 mm, the top cube on it 0 mm off (probe 6a)', () => {
  const { x, y } = SQUARES.bas;
  const seen: Record<string, string> = {};
  const { sim, before, after, events } = run(() => cross(), { x, y: y + G.gripForward + 150, heading: UP }, function* (io) {
    yield* drive(io, 150, 30);
    yield* claw(io, true);
    yield* lift(io, 75);
    seen.lifted = where(liveBody('cube:10'));
    yield* drive(io, -100, 40);
    yield* clawOver(io, WAREHOUSES.E5.x, WAREHOUSES.E5.y, UP);
    seen.overE5 = where(liveBody('cube:10'));
    yield* lift(io, 5);
    yield* claw(io, false);
    yield* drive(io, -100, 40);
  }, { walls: true });
  assert.equal(seen.lifted, '(600, 652) z 120 0 deg on cube:5');
  assert.equal(seen.overE5, '(220.5, 391) z 120 0 deg on cube:5');
  assert.equal(after['cube:5'], '(220.5, 391) z 0 0 deg on null');
  assert.equal(after['cube:10'], '(220.5, 391) z 50 0 deg on cube:5');
  assert.equal(coverMargin(bodyIn(sim, 'cube:5'), WAREHOUSES.E5), 5);
  assert.deepEqual(movedIds(before, after), ['cube:5', 'cube:10']);
  assert.deepEqual(events, ['1.62 s grab cube:5', '7.73 s release cube:5 onto null']);
});

test('stacks: a pair lifted with the arm up (70..120 and 120..170 mm) and turned 90 degrees - the top cube turns with it (probe 6c)', () => {
  const { after } = run(() => pair('cube:p', 600, 800), { x: 600, y: 800 + G.gripForward, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* lift(io, 75);
    yield* turn(io, 90, 20);
  });
  assert.equal(after['cube:p'], '(742, 942) z 70 90 deg on null HELD');
  assert.equal(after['cube:p:dessus'], '(742, 942) z 120 90 deg on cube:p');
});

test('stacks: a pair held with the arm down, driven into another stack - the top cubes meet, both pairs stay pairs (probe 6b)', () => {
  const { after, events } = run(() => [...pair('cube:p', 600, 800), ...pair('cube:q', 600, 600)], { x: 600, y: 800 + G.gripForward, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* drive(io, 160, 30); // the held pair's face reaches the other stack after 150 mm
    yield* drive(io, -100, 30);
  });
  assert.equal(after['cube:p'], '(600, 740) z 0 0 deg on null HELD');
  assert.equal(after['cube:p:dessus'], '(600, 740) z 50 0 deg on cube:p');
  assert.equal(after['cube:q'], '(600, 590) z 0 0 deg on null');
  assert.equal(after['cube:q:dessus'], '(600, 590) z 50 0 deg on cube:q');
  assert.deepEqual(events, ['0.1 s grab cube:p', '1.61 s bump cube:q']);
});

// =============================================================================================
// The two other places where the engine moves a held pair's bottom cube by itself: the claw
// squares it up (squareUpInClaw), and it slides off a cube it is put down on (comeDown)
// =============================================================================================

test('stacks: a stack gripped by its bottom cube with the robot off its axis (turned 8 degrees; shifted 3 mm and turned -6) - the claw squares the bottom cube up, and the top cube turns and moves with it: 0 mm and 0 degrees off, gripped and put down', () => {
  for (const [shift, degrees] of [
    [0, 8],
    [3, -6],
  ] as const) {
    const heading = (degrees * Math.PI) / 180;
    const reach = G.gripForward + 120;
    const seen: string[] = [];
    const { after, events } = run(() => pair('cube:p', 600, 600), { x: 600 + shift - reach * Math.sin(heading), y: 600 + reach * Math.cos(heading), heading }, function* (io) {
      yield* claw(io, false);
      yield* lift(io, 20);
      yield* drive(io, 120, 40);
      yield* claw(io, true);
      seen.push(`gripped: bottom ${deg(liveBody('cube:p').angle)} deg, top ${offset(liveBody('cube:p:dessus'), liveBody('cube:p'))}`);
      yield* lift(io, 40);
      yield* drive(io, -150, 40);
      yield* lift(io, 5);
      yield* claw(io, false);
      seen.push(`put down: top ${offset(liveBody('cube:p:dessus'), liveBody('cube:p'))}`);
      yield* drive(io, -100, 40);
    });
    const what = `shifted ${shift} mm, turned ${degrees} degrees`;
    // (the bottom cube now stands square to the robot: turned as the robot is)
    assert.deepEqual(seen, [`gripped: bottom ${degrees} deg, top dx 0, dy 0, dangle 0`, 'put down: top dx 0, dy 0, dangle 0'], what);
    assert.equal(after['cube:p:dessus'], after['cube:p'].replace('z 0', 'z 50').replace('on null', 'on cube:p'), what);
    assert.equal(events.length, 2, what);
  }
});

test('stacks: a pair let go with its bottom cube half over a cube on the mat - the bottom cube lands on the mat and slides 12 mm off that cube (the single cube then gives way the 8 mm left), and the top cube slides with it: 0 mm off, still on it', () => {
  const seen: string[] = [];
  const { before, after, events } = run(() => [...pair('cube:p', 600, 650), cube('cube:seul', 600, 520)], { x: 600, y: 650 + G.gripForward + 120, heading: UP }, function* (io) {
    yield* claw(io, false);
    yield* lift(io, 20);
    yield* drive(io, 120, 40);
    yield* claw(io, true);
    yield* lift(io, 75);
    yield* drive(io, 100, 40); // the bottom cube's middle 30 mm past the single cube's edge: not over it
    seen.push(`over it: ${where(liveBody('cube:p'))}`);
    yield* claw(io, false);
    seen.push(`let go: ${where(liveBody('cube:p'))}; top ${offset(liveBody('cube:p:dessus'), liveBody('cube:p'))}`);
    yield* drive(io, -150, 40);
  });
  assert.deepEqual(seen, ['over it: (600, 550) z 55 0 deg on null HELD', 'let go: (600, 562) z 0 0 deg on null; top dx 0, dy 0, dangle 0']);
  assert.equal(after['cube:p'], '(600, 562) z 0 0 deg on null');
  assert.equal(after['cube:p:dessus'], '(600, 562) z 50 0 deg on cube:p');
  assert.equal(after['cube:seul'], '(600, 512) z 0 0 deg on null');
  assert.deepEqual(movedIds(before, after), ['cube:p', 'cube:p:dessus', 'cube:seul']);
  assert.equal(events.length, 2);
});

// =============================================================================================
// A held pair pushed back by the engine (critic c4a, c4b: shiftRobot)
// =============================================================================================

/**
 * A pair held with the arm down is driven 400 mm at the top of the frame, 200 mm away: the robot
 * is pushed back out of the frame every tick (shiftRobot). Where the top cube is, every 0.1 s.
 */
function pressIntoTheFrame(bodies: () => Body[]): { trace: string[]; run: Run } {
  const trace: string[] = [];
  const result = run(bodies, { x: 600, y: 300 + G.gripForward + 100, heading: UP }, function* (io) {
    yield* lift(io, 5);
    yield* drive(io, 100, 30);
    yield* claw(io, true);
    const pressing = drive(io, 400, 50);
    for (let t = 0; t <= 300 && !pressing.next().done; t++) {
      const top = liveBody('cube:p:dessus');
      if (t % 10 === 0) trace.push(`${offset(top, liveBody('cube:p'))}; top z ${r2(top.z)} on ${top.restingOn}`);
      yield;
    }
    yield* claw(io, false);
  }, { walls: true });
  return { trace, run: result };
}

test('stacks: a held pair pressed into the frame keeps its top cube on it, 0 mm off, at every moment (c4a)', () => {
  const { trace, run: { after, events } } = pressIntoTheFrame(() => pair('cube:p', 600, 300));
  assert.equal(trace.length, 25);
  for (const line of trace) assert.equal(line, 'dx 0, dy 0, dangle 0; top z 50 on cube:p');
  // the bottom cube against the frame's inner side (y 0), the top cube on it - not outside the arena
  assert.equal(after['cube:p'], '(600, 25) z 0 0 deg on null');
  assert.equal(after['cube:p:dessus'], '(600, 25) z 50 0 deg on cube:p');
  assert.deepEqual(events, ['1.12 s grab cube:p', '2.8 s bump cadre:haut', '3.57 s release cube:p onto null']);
});

test('stacks: a held pair pushing a cube that the frame backs keeps its top cube on it, 0 mm off (c4b)', () => {
  const { trace, run: { after, events } } = pressIntoTheFrame(() => [...pair('cube:p', 600, 300), cube('cube:seul', 600, 25)]);
  for (const line of trace) assert.equal(line, 'dx 0, dy 0, dangle 0; top z 50 on cube:p');
  assert.equal(after['cube:seul'], '(600, 25) z 0 0 deg on null');
  assert.equal(after['cube:p'], '(600, 75) z 0 0 deg on null');
  assert.equal(after['cube:p:dessus'], '(600, 75) z 50 0 deg on cube:p');
  assert.deepEqual(events, ['1.12 s grab cube:p', '2.5 s bump cube:seul', '3.57 s release cube:p onto null']);
});

test('stacks: the frame - a cube on the mat pushed into it stops inside the arena; a cube held with the arm up (base 70 mm) passes over it, and let go there it lands outside (probe 5)', () => {
  const pushed = run(() => [cube('cube:M', 600, 200)], { x: 600, y: 200 + 25 + 167 + 10, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* drive(io, 300, 30);
  }, { walls: true });
  assert.equal(pushed.after['cube:M'], '(600, 25) z 0 0 deg on null');
  assert.deepEqual(pushed.events, ['0.45 s bump cube:M']);
  const carried = run(() => [cube('cube:M', 600, 300)], { x: 600, y: 300 + G.gripForward, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* lift(io, 75);
    yield* drive(io, 400, 40);
    yield* claw(io, false);
    yield* drive(io, -100, 40);
  }, { walls: true });
  assert.equal(carried.after['cube:M'], '(600, -45) z 0 0 deg on null');
  assert.deepEqual(carried.events, ['0.1 s grab cube:M', '3.15 s bump cadre:haut', '3.64 s release cube:M onto null']);
});

test('stacks: the frame - a top cube pushed 26 mm off a pair that stands closer than one cube to the frame (in E3, 26.1 mm from the top frame; 32.5 mm from the right frame) has no room beside the pair: it goes over the frame and lands flush outside, and the bottom cube does not move', () => {
  for (const [what, x, y, start, top] of [
    ['E3, pushed up', WAREHOUSES.E3.x, WAREHOUSES.E3.y, { x: WAREHOUSES.E3.x, y: WAREHOUSES.E3.y + 25 + 167 + 10, heading: UP }, '(813.41, -45) z 0 0 deg on null'],
    ['E8, pushed right', WAREHOUSES.E8.x, WAREHOUSES.E8.y, { x: WAREHOUSES.E8.x - 25 - 167 - 10, y: WAREHOUSES.E8.y, heading: RIGHT }, '(1245, 985.25) z 0 0 deg on null'],
  ] as const) {
    const { before, after } = run(() => pair('cube:p', x, y), start, function* (io) {
      yield* lift(io, 60);
      yield* claw(io, true);
      yield* drive(io, 10 + 26, 20);
      yield* drive(io, -40, 20);
    }, { walls: true });
    assert.equal(after['cube:p:dessus'], top, what);
    assert.equal(after['cube:p'], before['cube:p'], `${what}: the bottom cube stays where it was`);
    assert.deepEqual(movedIds(before, after), ['cube:p:dessus'], what);
  }
});

// =============================================================================================
// Stacks pushed, and a top cube that comes down (probe 1c, 1d, 1e, 2g)
// =============================================================================================

test('stacks: a stack pushed 120 mm by the closed claw, then a 30 degree turn - the top cube rides on the bottom cube (probe 1c)', () => {
  const { before, after, events } = run(() => pair('cube:p', 600, 700), { x: 600, y: 700 + 25 + 167 + 20, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* drive(io, 120, 30);
    yield* turn(io, 30, 20);
  });
  assert.equal(after['cube:p'], '(600, 599.03) z 0 0 deg on null');
  assert.equal(after['cube:p:dessus'], '(600, 599.03) z 50 0 deg on cube:p');
  assert.deepEqual(movedIds(before, after), ['cube:p', 'cube:p:dessus']);
  assert.deepEqual(events, ['0.55 s bump cube:p']);
});

test('stacks: a stack between the open fingers, pushed, turned and pushed - the fingers turn the bottom cube, and the top cube turns with it (probe 2g)', () => {
  const E5 = WAREHOUSES.E5;
  for (const [degrees, bottom] of [
    [30, '(334.88, 546.86) z 0 19.94 deg on null'],
    [90, '(454.6, 748.1) z 0 79.6 deg on null'],
  ] as const) {
    const { after } = run(() => pair('cube:p', E5.x, E5.y + 300), { x: E5.x, y: E5.y + 300 + 25 + 105 + 30, heading: UP }, function* (io) {
      yield* drive(io, 100, 30);
      yield* turn(io, degrees, 20);
      yield* drive(io, 100, 30);
    });
    assert.equal(after['cube:p'], bottom, `turned ${degrees} degrees`);
    assert.equal(after['cube:p:dessus'], bottom.replace('z 0', 'z 50').replace('on null', 'on cube:p'), `turned ${degrees} degrees`);
  }
});

test('stacks: a stack pushed into E5 by the closed claw - the bottom cube covers E5 by 5.0 mm, the top cube stays on it (probe 2g)', () => {
  const E5 = WAREHOUSES.E5;
  const { sim, after } = run(() => pair('cube:p', E5.x, E5.y + 300), { x: E5.x, y: E5.y + 300 + 25 + 167 + 20, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* drive(io, 320, 30);
    yield* drive(io, -100, 30);
  });
  assert.equal(after['cube:p'], '(220.5, 391) z 0 0 deg on null');
  assert.equal(after['cube:p:dessus'], '(220.5, 391) z 50 0 deg on cube:p');
  assert.equal(coverMargin(bodyIn(sim, 'cube:p'), E5), 5);
});

test('stacks: the top cube pushed alone by the closed claw at 60 mm - 20 and 24 mm: it stays on; 26 and 60 mm: it comes down flat, flush beside the bottom cube (probe 1d)', () => {
  for (const [push, top] of [
    [20, '(600, 680) z 50 0 deg on cube:p'],
    [24, '(600, 676) z 50 0 deg on cube:p'],
    [26, '(600, 650) z 0 0 deg on null'],
    [60, '(600, 650) z 0 0 deg on null'],
  ] as const) {
    const { before, after, events } = run(() => pair('cube:p', 600, 700), { x: 600, y: 700 + 25 + 167 + 10, heading: UP }, function* (io) {
      yield* lift(io, 60);
      yield* claw(io, true);
      yield* drive(io, 10 + push, 20);
      yield* drive(io, -40, 20);
    });
    assert.equal(after['cube:p:dessus'], top, `pushed ${push} mm`);
    assert.deepEqual(movedIds(before, after), ['cube:p:dessus'], `pushed ${push} mm: the bottom cube did not move`);
    assert.deepEqual(events, ['0.89 s bump cube:p:dessus'], `pushed ${push} mm`);
  }
});

test('stacks: a cube let go over another, its centre 0 or 24.9 mm off the middle: it stands on it; 25.1 mm: it lands on the mat, flush beside it (probe 1e)', () => {
  for (const [off, carried, onto] of [
    [0, '(600, 500) z 50 0 deg on cube:dessous', 'cube:dessous'],
    [24.9, '(600, 500) z 50 0 deg on cube:dessous', 'cube:dessous'],
    [25.1, '(575.1, 500) z 0 0 deg on null', null],
  ] as const) {
    const { after, events } = run(() => [cube('cube:dessous', 600 + off, 500), cube('cube:tenu', 600, 800)], { x: 600, y: 800 + G.gripForward, heading: UP }, function* (io) {
      yield* claw(io, true); // the arm down: underside 5 mm
      yield* lift(io, 75); // the cube's base at 70 mm
      yield* drive(io, 300, 30);
      yield* lift(io, 5); // stops when it stands on the cube under it
      yield* claw(io, false);
      yield* drive(io, -100, 30);
    });
    assert.equal(after['cube:tenu'], carried, `${off} mm off`);
    assert.equal(after['cube:dessous'], `(${r2(600 + off)}, 500) z 0 0 deg on null`, `${off} mm off`);
    assert.deepEqual(events, ['0.1 s grab cube:tenu', `3.78 s release cube:tenu onto ${onto}`], `${off} mm off`);
  }
});

// =============================================================================================
// Two and more layers in a warehouse (probe 2e; critic c1c, c6)
// =============================================================================================

test('stacks: a second cube put on a cube that stands in E5 - taken from the mat with the arm down, it stands on it; E5 stays covered by 5.0 mm (probe 2e)', () => {
  const E5 = WAREHOUSES.E5;
  const from = { x: E5.x + 500, y: E5.y + 300 };
  const seen: Record<string, number> = {};
  const { sim, before, after, events } = run(() => [cube('cube:A', E5.x, E5.y), cube('cube:B', from.x, from.y)], { x: from.x, y: from.y + G.gripForward + 100, heading: UP }, function* (io) {
    yield* lift(io, 5);
    yield* drive(io, 100, 30);
    yield* claw(io, true);
    yield* lift(io, 75);
    seen.carriedBase = r2(liveBody('cube:B').z);
    yield* drive(io, -100, 30);
    yield* clawOver(io, E5.x, E5.y, UP, 40);
    yield* lift(io, 5); // the arm stops when B stands on A
    seen.clawStoppedAt = r2(running().world.robot.gripper.height);
    seen.baseWhenStopped = r2(liveBody('cube:B').z);
    yield* claw(io, false);
    yield* drive(io, -100, 40);
  });
  assert.deepEqual(seen, { carriedBase: 70, clawStoppedAt: 55, baseWhenStopped: 50 });
  assert.equal(after['cube:A'], '(220.5, 391) z 0 0 deg on null');
  assert.equal(after['cube:B'], '(220.5, 391) z 50 0 deg on cube:A');
  assert.equal(coverMargin(bodyIn(sim, 'cube:A'), E5), 5);
  assert.deepEqual(movedIds(before, after), ['cube:B']);
  assert.deepEqual(events, ['1.12 s grab cube:B', '9.19 s release cube:B onto cube:A']);
});

test('stacks: a single cube cannot be put on a pair - its base reaches 70 mm, it needs 100: brought at the pair, it pushes the top cube off (probe 2e)', () => {
  const E5 = WAREHOUSES.E5;
  const { after, events } = run(() => [...pair('cube:A', E5.x, E5.y), cube('cube:C', E5.x, E5.y + 300)], { x: E5.x, y: E5.y + 300 + G.gripForward, heading: UP }, function* (io) {
    yield* claw(io, true);
    yield* lift(io, 75);
    yield* drive(io, 300, 30);
    yield* lift(io, 5);
    yield* claw(io, false);
    yield* drive(io, -100, 40);
  });
  assert.equal(after['cube:A:dessus'], '(220.5, 341) z 0 0 deg on null');
  assert.equal(after['cube:C'], '(220.5, 391) z 50 0 deg on cube:A');
  assert.equal(after['cube:A'], '(220.5, 391) z 0 0 deg on null');
  assert.deepEqual(events, ['0.1 s grab cube:C', '3.12 s bump cube:A:dessus', '3.78 s release cube:C onto cube:A']);
});

test('stacks: a pair taken by its bottom cube, put on a single cube in E5 - three high: the single covers E5 by 5.0 mm, the pair stands on it at 50 and 100 mm (c1c)', () => {
  const E5 = WAREHOUSES.E5;
  const { sim, after, events } = run(() => [...pair('cube:p', 600, 800), cube('cube:seul', E5.x, E5.y)], { x: 600, y: 800 + G.gripForward + 100, heading: UP }, function* (io) {
    yield* lift(io, 5);
    yield* drive(io, 100, 30);
    yield* claw(io, true);
    yield* lift(io, 75);
    yield* drive(io, -100, 40);
    yield* clawOver(io, E5.x, E5.y, UP);
    yield* lift(io, 5);
    yield* claw(io, false);
    yield* drive(io, -100, 40);
  });
  assert.equal(after['cube:seul'], '(220.5, 391) z 0 0 deg on null');
  assert.equal(coverMargin(bodyIn(sim, 'cube:seul'), E5), 5);
  assert.equal(after['cube:p'], '(220.5, 391) z 50 0 deg on cube:seul');
  assert.equal(after['cube:p:dessus'], '(220.5, 391) z 100 0 deg on cube:p');
  assert.deepEqual(events, ['1.12 s grab cube:p', '7.11 s release cube:p onto cube:seul']);
  assert.equal(r2(sim.world.time), 8.02);
});

test('stacks: three trips, each taking the stack ahead by its bottom cube and putting it on the next single cube - a tower of five, its top at 250 mm (c6)', () => {
  const layers: string[] = [];
  const { sim, events } = run(
    () => [...pair('cube:a', 600, 900), cube('cube:s1', 600, 700), cube('cube:s2', 600, 500), cube('cube:s3', 600, 300)],
    { x: 600, y: 900 + G.gripForward + 100, heading: UP },
    function* (io) {
      for (let k = 0; k < 3; k++) {
        yield* lift(io, 5);
        yield* drive(io, 100, 30); // the claw on the bottom cube of the stack ahead
        yield* claw(io, true);
        yield* lift(io, 75);
        yield* drive(io, 200, 30); // over the next single cube
        yield* lift(io, 5); // it comes down onto it
        yield* claw(io, false);
        yield* drive(io, -100, 30);
        layers.push(running().world.bodies.map((b) => `${b.id} z ${r2(b.z)} on ${b.restingOn}`).join('; '));
      }
    },
    { maxTicks: 30000 },
  );
  assert.deepEqual(layers, [
    'cube:a z 50 on cube:s1; cube:a:dessus z 100 on cube:a; cube:s1 z 0 on null; cube:s2 z 0 on null; cube:s3 z 0 on null',
    'cube:a z 100 on cube:s1; cube:a:dessus z 150 on cube:a; cube:s1 z 50 on cube:s2; cube:s2 z 0 on null; cube:s3 z 0 on null',
    'cube:a z 150 on cube:s1; cube:a:dessus z 200 on cube:a; cube:s1 z 100 on cube:s2; cube:s2 z 50 on cube:s3; cube:s3 z 0 on null',
  ]);
  assert.equal(Math.max(...sim.world.bodies.map((b) => b.z + b.h)), 250);
  // every cube of the tower right over the bottom one
  for (const b of sim.world.bodies) assert.equal(`${r2(b.x)}, ${r2(b.y)}`, '600, 300', b.id);
  assert.deepEqual(events, [
    '1.12 s grab cube:a',
    '3.81 s release cube:a onto cube:s1',
    '6.06 s grab cube:s1',
    '8.75 s release cube:s1 onto cube:s2',
    '11 s grab cube:s2',
    '13.69 s release cube:s2 onto cube:s3',
  ]);
});

// =============================================================================================
// 500 points' worth: the five stacks of the cross in five warehouses (probe a1)
// =============================================================================================

test('stacks: the five stacks of the cross, each taken by its bottom cube and put down in a warehouse - five pairs in place in 60.65 s, only the ten cubes moved (probe a1)', () => {
  /** stack (its square), the side the claw comes from (the robot's heading), the warehouse, the heading there */
  const PLAN: Array<[Square, number, keyof typeof WAREHOUSES, number]> = [
    ['bas', UP, 'E7', LEFT],
    ['droite', LEFT, 'E8', RIGHT],
    ['gauche', RIGHT, 'E5', UP],
    ['haut', DOWN, 'E6', UP],
    ['centre', UP, 'E3', UP],
  ];
  const RPM = 50; // the "avancer de ... cm" block's speed; turns at 30 RPM
  const SHORT = 5; // the claw's middle stops 5 mm before the cube's middle
  const done: string[] = [];
  const { sim, before, after, events } = run(() => cross(), START_POSE, function* (io) {
    for (const [square, h, warehouse, there] of PLAN) {
      const { x, y } = SQUARES[square];
      yield* clawOver(io, x - SHORT * Math.sin(h), y + SHORT * Math.cos(h), h, RPM);
      yield* claw(io, true);
      yield* drive(io, -100, RPM);
      const W = WAREHOUSES[warehouse];
      // the cube sits SHORT mm ahead of the claw's middle: the claw stops SHORT mm before the warehouse's middle
      yield* clawOver(io, W.x - SHORT * Math.sin(there), W.y + SHORT * Math.cos(there), there, RPM);
      yield* claw(io, false);
      yield* drive(io, -100, RPM);
      done.push(`${square} -> ${warehouse} at ${r2(running().world.time)} s`);
    }
  }, { walls: true, maxTicks: 15000 });
  assert.deepEqual(done, ['bas -> E7 at 7.63 s', 'droite -> E8 at 22.07 s', 'gauche -> E5 at 35.63 s', 'haut -> E6 at 48.47 s', 'centre -> E3 at 60.64 s']);
  assert.equal(r2(sim.world.time), 60.65);
  assert.equal(movedIds(before, after).length, 10);
  for (const [square, , warehouse] of PLAN) {
    const bottom = bodyIn(sim, bottomOf(square));
    const top = bodyIn(sim, topOf(square));
    assert.equal(coverMargin(bottom, WAREHOUSES[warehouse]), 5, `${square}: its bottom cube covers ${warehouse} by 5.0 mm`);
    assert.equal(bottom.z, 0);
    assert.equal(top.restingOn, bottom.id);
    assert.equal(top.z, CUBE);
    assert.equal(offset(top, bottom), 'dx 0, dy 0, dangle 0', `${square}: the top cube right on it`);
  }
  assert.deepEqual(after, {
    'cube:1': '(979.5, 391) z 0 180 deg on null',
    'cube:2': '(220.5, 391) z 0 -90 deg on null',
    'cube:3': '(813.41, 51.1) z 0 0 deg on null',
    'cube:4': '(1142.5, 985.25) z 0 180 deg on null',
    'cube:5': '(57.5, 985.25) z 0 -90 deg on null',
    'cube:6': '(979.5, 391) z 50 180 deg on cube:1',
    'cube:7': '(220.5, 391) z 50 -90 deg on cube:2',
    'cube:8': '(813.41, 51.1) z 50 0 deg on cube:3',
    'cube:9': '(1142.5, 985.25) z 50 180 deg on cube:4',
    'cube:10': '(57.5, 985.25) z 50 -90 deg on cube:5',
  });
  assert.deepEqual(events.filter((e) => !e.includes(' bump ')), [
    '2.28 s grab cube:5',
    '6.87 s release cube:5 onto null',
    '15.71 s grab cube:4',
    '21.31 s release cube:4 onto null',
    '30.15 s grab cube:2',
    '34.87 s release cube:2 onto null',
    '41.39 s grab cube:1',
    '47.71 s release cube:1 onto null',
    '54.39 s grab cube:3',
    '59.88 s release cube:3 onto null',
  ]);
});
