/**
 * What a referee can do with the game elements since Fire Cadet (core/types.ts, RefereeCall), and
 * how a game names its own interpreter:
 *
 *   - removeBodies: take elements off the field (a delivered rescue item is collected; a touched
 *     obstacle is lifted). From the next tick on they are not in World.bodies.
 *   - restoreBodies: put elements back that were taken off - on the spot where they started
 *     (Body.home), unturned, standing on the mat, in their old place in the list, and only when
 *     that spot is free: no part of the robot and no other element nearer than RESTORE_CLEARANCE,
 *     no fixed wall in it. (Lead decision D1: the referee puts a touched obstacle back as soon as
 *     its spot is free.)
 *   - Game.createVM: the interpreter of the game's programs (Fire Cadet: the coding cards); left
 *     out, the block interpreter runs as before.
 *
 * None of the four older games uses any of them: that they play byte for byte as before is
 * proved outside this file (the baseline of design 9.8). A plain 1000 x 1000 mm mat, a small test
 * game, and a tiny fake VM (./test-helpers.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMatch } from './batch';
import { createEngineSimulation, RESTORE_CLEARANCE } from './engine';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { createSimulation } from './simulation';
import { drive, forever, makeBody, near, scripted, sleep, waitUntil, type Script } from './test-helpers';
import type { RobotIO } from './io';
import type { Body, FixedWall, Game, MatVector, Pose, ProgramJson, RefereeCall, RobotConfig, ScoreContext, SimEvent, Simulation, VM } from './types';
import { moveCm, program, script, whenStart } from '../vm/builder';

const MAT: MatVector = { width: 1000, height: 1000, background: { r: 255, g: 255, b: 255 }, outside: { r: 120, g: 120, b: 120 }, layers: [] };

/** The standard robot without its gripper: a box whose front is 105 mm ahead of the axle. */
const BARE: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
};
/** The standard robot, gripper and all. */
const CLAW = DEFAULT_ROBOT_CONFIG;
const G = CLAW.gripper;

const START: Pose = { x: 500, y: 800, heading: 0 };

/** What the referee says after a tick (null: nothing). */
type Calls = (ctx: ScoreContext<null>) => RefereeCall | null;
/** The referee says `call` on tick `tick`. */
const onTick =
  (...plan: Array<[number, RefereeCall]>): Calls =>
  (ctx) =>
    plan.find(([tick]) => tick === ctx.world.tick)?.[1] ?? null;

function makeGame(o: { bodies?: Body[]; walls?: FixedWall[]; calls?: Calls; createVM?: Game<null>['createVM'] }): Game<null> {
  const game: Game<null> = {
    id: 'bodies-test',
    title: 'Bodies test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 60,
    startZone: { x: 0, y: 0, w: 1000, h: 1000 },
    defaultStartPose: START,
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: () => (o.bodies ?? []).map((b) => ({ ...b, home: { ...b.home } })),
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
  if (o.walls) game.createWalls = () => o.walls!.map((w) => ({ ...w }));
  const calls = o.calls;
  if (calls) {
    game.createReferee = () => ({
      observe: (ctx) => calls(ctx),
      restart() {},
      score: () => ({ total: 0, max: 0, lines: [], complete: false }),
    });
  }
  if (o.createVM) game.createVM = o.createVM;
  return game;
}

function setup(run: Script, o: { bodies?: Body[]; walls?: FixedWall[]; calls?: Calls; config?: RobotConfig; start?: Pose } = {}): Simulation<null> {
  const harness = scripted(run);
  return createEngineSimulation(
    { game: makeGame(o), scenario: null, robotConfig: o.config ?? BARE, program: {}, startPose: o.start ?? START },
    harness.factory,
  );
}

const ids = (sim: Simulation<null>): string[] => sim.world.bodies.map((b) => b.id);
const find = (sim: Simulation<null>, id: string): Body | undefined => sim.world.bodies.find((b) => b.id === id);
const placeOf = (b: Body | undefined): number[] => (b ? [b.x, b.y, b.angle, b.z] : []);
const cube = (id: string, x: number, y: number, part: Partial<Body> = {}): Body => makeBody({ id, x, y, w: 40, l: 40, h: 40, ...part });

/** The robot's pose, and every element's place, after every tick until `ticks`. */
function trace(sim: Simulation<null>, ticks: number, keep: (b: Body) => boolean = () => true): { poses: number[][]; events: SimEvent[] } {
  const poses: number[][] = [];
  const events: SimEvent[] = [];
  sim.start();
  for (let k = 0; k < ticks; k++) {
    sim.step(1);
    const p = sim.world.robot.pose;
    poses.push([p.x, p.y, p.heading, ...sim.world.bodies.filter(keep).flatMap((b) => [b.x, b.y, b.angle])]);
    events.push(...sim.drainEvents());
  }
  return { poses, events };
}

// =============================================================================================
// removeBodies
// =============================================================================================

test('removeBodies: the element is gone from the next tick on - the robot drives through its place, the sensors do not see it', () => {
  // a cube 200 mm in front of the robot's front, and one beside the way
  const inTheWay = cube('cube:way', 500, 800 - 105 - 200 - 20);
  const beside = cube('cube:beside', 150, 300);
  let seenBefore = -1;
  let seenAfter = -1;
  const sim = setup(
    function* (io) {
      yield* sleep(2);
      seenBefore = io.ultrasonicCm();
      yield* sleep(5);
      seenAfter = io.ultrasonicCm();
      yield* drive(io, 400, 100);
      yield* forever();
    },
    { bodies: [inTheWay, beside], calls: onTick([5, { removeBodies: ['cube:way'] }]) },
  );
  const list = sim.world.bodies;
  sim.start();
  sim.step(4);
  assert.deepEqual(ids(sim), ['cube:way', 'cube:beside']);
  sim.step(1);
  assert.deepEqual(ids(sim), ['cube:beside']);
  assert.equal(sim.world.bodies, list, 'World.bodies is still the same list');
  let touched = false;
  for (let k = 0; k < 800; k++) {
    sim.step(1);
    if (sim.world.robot.touching) touched = true;
  }
  near(seenBefore, 20, 0.2, 'before: the cube 200 mm ahead (cm)');
  assert.equal(seenAfter, DEFAULT_ROBOT_CONFIG.ultrasonic.maxRangeCm, 'after: nothing in sight');
  near(sim.world.robot.pose.y, 400, 0.5, 'the robot drove 400 mm, through where the cube stood');
  assert.equal(touched, false);
  assert.deepEqual(sim.drainEvents().filter((e) => e.type === 'bump'), []);
});

test('removeBodies: the other elements keep their place, their pushes and their bumps - a run where a far-away element goes is the run without it', () => {
  // the robot pushes a cube; a second cube far away, first in the list, is taken off on tick 50,
  // in the middle of the push (every number the engine keeps per element moves up one place)
  const pushed = (): Body => cube('cube:pushed', 520, 800 - 105 - 20);
  const far = cube('cube:far', 100, 100);
  const pushing: Script = function* (io) {
    yield* drive(io, 300, 60);
    yield* forever();
  };
  const withRemoval = trace(setup(pushing, { bodies: [far, pushed()], calls: onTick([50, { removeBodies: ['cube:far'] }]) }), 600, (b) => b.id === 'cube:pushed');
  const without = trace(setup(pushing, { bodies: [pushed()], calls: () => null }), 600);
  assert.deepEqual(withRemoval.poses, without.poses);
  assert.deepEqual(withRemoval.events, without.events);
  assert.ok(without.events.some((e) => e.type === 'bump' && e.bodyId === 'cube:pushed'), 'the cube was pushed');
  near(without.poses[599][4], 800 - 105 - 20 - 300, 0.5, 'and went 300 mm up the mat');
});

test('removeBodies: an element in the claw is taken out of it first; what stood on an element comes down onto the mat', () => {
  // the claw closes on a person; the referee takes the person away while it is held
  const person = makeBody({ id: 'person', x: 500, y: 800 - G.gripForward, w: 40, l: 40, h: 60, grippable: true });
  let taken = false;
  const sim = setup(
    function* (io) {
      io.setServo(G.clawServo, G.clawClosedAngle);
      yield* forever();
    },
    {
      bodies: [person],
      config: CLAW,
      calls: (ctx) => {
        if (taken || ctx.world.robot.gripper.holding !== 'person') return null;
        taken = true;
        return { removeBodies: ['person'] };
      },
    },
  );
  sim.start();
  sim.step(200);
  assert.ok(taken, 'the claw held the person');
  assert.deepEqual(ids(sim), []);
  assert.equal(sim.world.robot.gripper.holding, null);
  near(sim.world.robot.gripper.gap, G.clawClosedGap, 1e-9, 'the empty claw closed all the way');

  // a bucket on a tower: the tower is taken away
  const tower = makeBody({ id: 'tower', x: 200, y: 300, w: 70, l: 70, h: 50, platform: true, mass: 3 });
  const bucket = makeBody({ id: 'bucket', x: 205, y: 300, w: 40, l: 40, h: 40, z: 50, restingOn: 'tower' });
  const towers = setup(forever, { bodies: [tower, bucket], calls: onTick([3, { removeBodies: ['tower'] }]) });
  towers.start();
  towers.step(10);
  assert.deepEqual(ids(towers), ['bucket']);
  const b = towers.world.bodies[0];
  assert.deepEqual([b.x, b.y, b.z, b.restingOn], [205, 300, 0, null], 'on the mat, where it was');
});

test('removeBodies: an id that is no element here, and a second removal of the same element, change nothing', () => {
  const a = cube('a', 200, 200);
  const b = cube('b', 700, 200);
  const sim = setup(forever, {
    bodies: [a, b],
    calls: onTick([3, { removeBodies: ['nothing'] }], [5, { removeBodies: ['a'] }], [6, { removeBodies: ['a', 'nothing'] }]),
  });
  sim.start();
  sim.step(3);
  assert.deepEqual(ids(sim), ['a', 'b']);
  sim.step(2);
  const after = sim.world.bodies.map(placeOf);
  sim.step(5);
  assert.deepEqual(ids(sim), ['b']);
  assert.deepEqual(sim.world.bodies.map(placeOf), after);
});

// =============================================================================================
// restoreBodies
// =============================================================================================

test('restoreBodies: a moved element goes back to its spot, unturned and on the mat, in its old place in the list', () => {
  // three cubes; the robot pushes the middle one 100 mm off its spot, then backs away from the spot
  const a = cube('a', 150, 150);
  const b = makeBody({ id: 'b', x: 500, y: 800 - 105 - 20, w: 40, l: 40, h: 40, angle: 0 });
  const c = cube('c', 850, 150);
  const home = { ...b.home };
  const sim = setup(
    function* (io) {
      yield* drive(io, 100, 40);
      yield* drive(io, -150, 40);
      yield* forever();
    },
    {
      bodies: [a, b, c],
      // both taken off in one call (b named first), put back one at a time: b first, then a
      calls: onTick([700, { removeBodies: ['b', 'a'] }], [701, { restoreBodies: ['b'] }], [702, { restoreBodies: ['a'] }]),
    },
  );
  const list = sim.world.bodies;
  sim.start();
  sim.step(699);
  near(find(sim, 'b')!.y, home.y - 100, 0.5, 'pushed 100 mm');
  sim.step(1);
  assert.deepEqual(ids(sim), ['c']);
  sim.step(1);
  assert.deepEqual(ids(sim), ['b', 'c'], 'b before c, as the game created them');
  sim.step(1);
  assert.deepEqual(ids(sim), ['a', 'b', 'c'], 'a in front again');
  assert.equal(sim.world.bodies, list, 'World.bodies is still the same list');
  const back = find(sim, 'b')!;
  assert.deepEqual([back.x, back.y, back.angle, back.z, back.restingOn, back.held], [home.x, home.y, home.angle, 0, null, false]);
  assert.deepEqual(placeOf(find(sim, 'a')), placeOf(a), 'a on its spot');
});

test('restoreBodies: a turned element comes back unturned, and the robot pushes it like any other element afterwards', () => {
  // it stands turned (as after a swing between fixed sticks), 20 mm off its spot
  const plank: Body = { ...makeBody({ id: 'plank', x: 520, y: 500, w: 40, l: 40, h: 40, angle: 0.4 }), home: { x: 500, y: 500, angle: 0, z: 0, restingOn: null } };
  const sim = setup(
    function* (io) {
      yield* drive(io, 400, 60);
      yield* forever();
    },
    { bodies: [plank], calls: onTick([2, { removeBodies: ['plank'] }], [3, { restoreBodies: ['plank'] }]) },
  );
  sim.start();
  sim.step(3);
  assert.deepEqual(placeOf(find(sim, 'plank')), [500, 500, 0, 0]);
  let bumped = false;
  for (let k = 0; k < 700; k++) {
    sim.step(1);
    for (const e of sim.drainEvents()) if (e.type === 'bump' && e.bodyId === 'plank') bumped = true;
  }
  assert.ok(bumped, 'the robot ran into it');
  near(find(sim, 'plank')!.y, 400 - 105 - 20, 0.5, 'and pushed it ahead');
});

test(`restoreBodies: not while any part of the robot is nearer than RESTORE_CLEARANCE (${RESTORE_CLEARANCE} mm) - and as soon as it is not`, () => {
  // the robot stands still with its front `gap` mm from the cube's spot
  const atGap = (gap: number): Simulation<null> => {
    const c = cube('c', 500, 800 - 105 - 20 - gap);
    const sim = setup(forever, { bodies: [c], calls: (ctx) => (ctx.world.tick === 1 ? { removeBodies: ['c'] } : { restoreBodies: ['c'] }) });
    sim.start();
    sim.step(200);
    return sim;
  };
  assert.deepEqual(ids(atGap(RESTORE_CLEARANCE - 0.1)), [], 'kept off the field');
  assert.deepEqual(ids(atGap(RESTORE_CLEARANCE + 0.1)), ['c'], 'put back');

  // the robot touches a cube, which is lifted; the robot backs away slowly; the cube comes back on
  // the first tick on which the robot's front is RESTORE_CLEARANCE away from its spot
  const c = cube('c', 500, 800 - 105 - 20 - 0.2);
  /** how far the robot's front is from the side of the cube's spot that faces it */
  const gapOf = (sim: Simulation<null>): number => sim.world.robot.pose.y - 105 - (c.y + 20);
  const sim = setup(
    function* (io) {
      yield* drive(io, -50, 5);
      yield* forever();
    },
    { bodies: [c], calls: (ctx) => (ctx.world.tick === 1 ? { removeBodies: ['c'] } : { restoreBodies: ['c'] }) },
  );
  sim.start();
  let backAt = -1;
  let gapBefore = 0;
  for (let k = 0; k < 600 && backAt < 0; k++) {
    gapBefore = gapOf(sim);
    sim.step(1);
    if (find(sim, 'c')) backAt = sim.world.tick;
  }
  assert.ok(backAt > 1, 'it came back');
  assert.ok(gapOf(sim) >= RESTORE_CLEARANCE, `the robot was ${RESTORE_CLEARANCE} mm away when it came back: ${gapOf(sim)} mm`);
  assert.ok(gapBefore < RESTORE_CLEARANCE, `and one tick before it was not yet: ${gapBefore} mm (it came back as soon as it could)`);
  assert.deepEqual(placeOf(find(sim, 'c')), placeOf(c));
});

test(`restoreBodies: not while another element is nearer than RESTORE_CLEARANCE; a fixed wall keeps it off only by standing in its spot`, () => {
  const lifted = (others: Body[], walls: FixedWall[] = []): string[] => {
    const c = cube('c', 300, 300);
    const sim = setup(forever, { bodies: [c, ...others], walls, calls: (ctx) => (ctx.world.tick === 1 ? { removeBodies: ['c'] } : { restoreBodies: ['c'] }) });
    sim.start();
    sim.step(50);
    return ids(sim);
  };
  // a second cube to the right of the spot: its left side is `gap` mm from the spot's right side
  const neighbour = (gap: number): Body => cube('n', 300 + 40 + gap, 300);
  assert.deepEqual(lifted([neighbour(RESTORE_CLEARANCE - 0.1)]), ['n']);
  assert.deepEqual(lifted([neighbour(RESTORE_CLEARANCE + 0.1)]), ['c', 'n']);
  // a fixed wall right against the spot does not keep it off (a wall never comes nearer); one in it does
  const wall = (gap: number): FixedWall => ({ id: 'wall', label: 'wall', x: 300 + 20 + gap + 10, y: 300, angle: 0, w: 20, l: 200, h: 100, fill: '#999' });
  assert.deepEqual(lifted([], [wall(0)]), ['c']);
  assert.deepEqual(lifted([], [wall(-1)]), []);
});

test('restoreBodies: an id that was never taken off, one that is back already, and an unknown id change nothing - also in a game that never took anything off', () => {
  const a = cube('a', 200, 200);
  const b = cube('b', 700, 200);
  const sim = setup(forever, {
    bodies: [a, b],
    calls: onTick(
      [2, { restoreBodies: ['a', 'nothing'] }],
      [5, { removeBodies: ['a'] }],
      [6, { restoreBodies: ['a'] }],
      [7, { restoreBodies: ['a', 'b', 'nothing'] }],
    ),
  });
  sim.start();
  sim.step(2);
  assert.deepEqual(ids(sim), ['a', 'b']);
  sim.step(4);
  assert.deepEqual(ids(sim), ['a', 'b']);
  const places = sim.world.bodies.map(placeOf);
  sim.step(4);
  assert.deepEqual(ids(sim), ['a', 'b']);
  assert.deepEqual(sim.world.bodies.map(placeOf), places);
});

test('restoreBodies: taken off and put back in the same call, a moved element is back on its spot at once', () => {
  const c = cube('c', 500, 800 - 105 - 20);
  const sim = setup(
    function* (io) {
      yield* drive(io, 60, 40);
      yield* drive(io, -100, 40);
      yield* forever();
    },
    { bodies: [c], calls: onTick([500, { removeBodies: ['c'], restoreBodies: ['c'] }]) },
  );
  sim.start();
  sim.step(499);
  near(find(sim, 'c')!.y, c.y - 60, 0.5, 'pushed 60 mm');
  sim.step(1);
  assert.deepEqual(placeOf(find(sim, 'c')), placeOf(c));
});

test('restoreBodies: a far-away element taken off and put back - the robot and what it pushes move as if nothing had happened', () => {
  const pushed = (): Body => cube('cube:pushed', 520, 800 - 105 - 20);
  const far = (): Body => cube('cube:far', 100, 100);
  const pushing: Script = function* (io) {
    yield* drive(io, 300, 60);
    yield* forever();
  };
  const offAndBack = trace(setup(pushing, { bodies: [far(), pushed()], calls: onTick([50, { removeBodies: ['cube:far'] }], [120, { restoreBodies: ['cube:far'] }]) }), 600);
  const untouched = trace(setup(pushing, { bodies: [far(), pushed()], calls: () => null }), 600);
  // (between tick 50 and 120 the far cube is not in the list: compare the robot and the pushed cube)
  const robotAndPushed = (poses: number[][]) => poses.map((row) => [...row.slice(0, 3), ...row.slice(-3)]);
  assert.deepEqual(robotAndPushed(offAndBack.poses), robotAndPushed(untouched.poses));
  assert.deepEqual(offAndBack.events, untouched.events);
  assert.deepEqual(offAndBack.poses[599], untouched.poses[599], 'at the end the far cube is on its spot again, first in the list');
});

test('restoreBodies: an element that comes back in front of the one in the claw - the claw still carries the right one, and lets it go', () => {
  const far = cube('far', 150, 150);
  const person = makeBody({ id: 'person', x: 500, y: 800 - G.gripForward, w: 40, l: 40, h: 60, grippable: true });
  let gripped = false;
  let removedOnce = false;
  const sim = setup(
    function* (io) {
      io.setServo(G.clawServo, G.clawClosedAngle);
      yield* waitUntil(() => io.servoDone(G.clawServo));
      gripped = true;
      yield* sleep(20);
      yield* drive(io, 100, 40);
      io.setServo(G.clawServo, G.clawOpenAngle);
      yield* forever();
    },
    {
      bodies: [far, person],
      config: CLAW,
      calls: (ctx) => {
        if (!gripped) return null;
        if (ctx.world.bodies.some((b) => b.id === 'far') && ctx.world.bodies.length === 2 && !removedOnce) {
          removedOnce = true;
          return { removeBodies: ['far'] };
        }
        return removedOnce ? { restoreBodies: ['far'] } : null;
      },
    },
  );
  sim.start();
  let held = false;
  for (let k = 0; k < 600; k++) {
    sim.step(1);
    if (sim.world.robot.gripper.holding === 'person') held = true;
  }
  assert.ok(held && removedOnce);
  assert.deepEqual(ids(sim), ['far', 'person'], 'the far cube is back, first in the list');
  assert.deepEqual(placeOf(find(sim, 'far')), placeOf(far), 'and it did not ride along with the robot');
  const p = find(sim, 'person')!;
  near(p.y, 800 - G.gripForward - 100, 0.5, 'the person was carried 100 mm');
  assert.equal(p.held, false, 'and let go when the claw opened');
  assert.equal(sim.world.robot.gripper.holding, null);
});

// =============================================================================================
// Game.createVM
// =============================================================================================

test('createVM: createSimulation and runMatch use the interpreter the game names; without one, the block interpreter runs as before', () => {
  const ROW: ProgramJson = { format: 'test-cards', cards: ['forward'] };
  const given: Array<{ program: ProgramJson; io: RobotIO }> = [];
  // a tiny interpreter of "cards": one card = 100 mm forward
  const cardVM = (prog: ProgramJson, io: RobotIO): VM => {
    given.push({ program: prog, io });
    const cards = Array.isArray(prog.cards) ? prog.cards : [];
    let running = false;
    let started = false;
    return {
      start() {
        running = cards.length > 0;
      },
      step() {
        if (!running) return;
        if (!started) {
          started = true;
          const deg = (100 / (Math.PI * io.config.wheelDiameter)) * 360;
          io.startMotion(deg, deg, 60);
        } else if (io.motionDone()) running = false;
      },
      stopAll() {
        running = false;
      },
      get running() {
        return running;
      },
      get idle() {
        return !running;
      },
      activeBlockIds: () => [],
      variables: () => ({}),
      errors: () => [],
    };
  };
  const cardGame = makeGame({ createVM: cardVM });
  const sim = createSimulation({ game: cardGame, scenario: null, program: ROW, robotConfig: BARE });
  assert.equal(given.length, 1);
  assert.equal(given[0].program, ROW, 'the program object as it was handed over');
  sim.start();
  sim.step(600);
  near(sim.world.robot.pose.y, 700, 0.5, 'the card drove the robot 100 mm');
  const match = runMatch({ game: cardGame, scenario: null, program: ROW, robotConfig: BARE });
  assert.equal(given.length, 2, 'runMatch asked the game for its interpreter too');
  assert.equal(match.finishReason, 'program-ended');
  // (100 mm at 60 rpm on 64 mm wheels: 0.5 s, and a little to speed up and brake)
  assert.ok(match.time > 0.5 && match.time < 0.7, `the match lasted as long as the card: ${match.time} s`);

  // the same row in a game without createVM: the block interpreter finds nothing to run (P/p9-panel.out case 1)
  const blockGame = makeGame({});
  const plain = runMatch({ game: blockGame, scenario: null, program: ROW, robotConfig: BARE });
  assert.equal(plain.finishReason, 'program-ended');
  near(plain.time, 0.01, 1e-9, 'ended on the first tick');
  const still = createSimulation({ game: blockGame, scenario: null, program: ROW, robotConfig: BARE });
  still.start();
  still.step(100);
  assert.deepEqual([still.world.robot.pose.x, still.world.robot.pose.y], [START.x, START.y], 'and did not move');
  // ... and a block program still drives the robot there
  const blocks = createSimulation({ game: blockGame, scenario: null, program: program([script(whenStart(), [moveCm('forward', 10)])]), robotConfig: BARE });
  blocks.start();
  blocks.step(300);
  near(blocks.world.robot.pose.y, 700, 0.5, 'a block program moved it 10 cm');
  assert.equal(given.length, 2, 'the card interpreter was not asked');
});
