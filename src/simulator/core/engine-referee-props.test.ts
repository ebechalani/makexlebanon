/**
 * Two things a referee can do since Locker Room (core/types.ts):
 *
 *   - RefereeCall.removeWalls: take fixed walls off the field (the stadium gate opens). From the
 *     next tick on nothing collides with them and no sensor sees them; World.walls is a new list.
 *   - Referee.props(): things the referee holds or has put on the robot (the colour card, the
 *     Team Box). They are not bodies: nothing collides with them, the ultrasonic sensor does not
 *     see them; the front colour sensor (both kinds) sees one that has a colour name.
 *
 * And what must not change: a game whose referee does neither gets no World.props at all, and its
 * walls stay the same list. (That the three live games play byte for byte as before is proved by
 * comparing whole matches before and after, outside this file; their own tests run unchanged.)
 *
 * A plain white 1000 x 1000 mm mat, a small test game, and a tiny fake VM (./test-helpers.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { drive, forever, makeBody, scripted, sleep, type Script } from './test-helpers';
import type { Body, FixedWall, Game, MatVector, Pose, Referee, RefereeCall, RefereeProp, RobotConfig, ScoreContext, SensorColor } from './types';
import { fireRescueGame } from '../fire-rescue/game';
import { fireChiefGame } from '../fire-chief/game';
import { warehouseSortGame } from '../warehouse-sort/game';
import { createSimulation } from './simulation';

const MAT: MatVector = { width: 1000, height: 1000, background: { r: 255, g: 255, b: 255 }, outside: { r: 120, g: 120, b: 120 }, layers: [] };

/** The standard robot: gripper, and the colour sensor at the claw (it sees up to 177 mm ahead of the axle). */
const CLAW: RobotConfig = DEFAULT_ROBOT_CONFIG;
/** A robot with Fire Chief's kind of colour sensor: fixed to the front, 110 mm ahead, 60 mm high, 15 mm range. */
const FIXED: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { enabled: true, rangeMm: 15, mount: { forward: 110, height: 60 } },
};

/** A wall along x (left-right) with its middle at (x, y), 20 mm thick. */
const wall = (id: string, x: number, y: number, length = 300, height = 150): FixedWall => ({ id, label: id, x, y, angle: 0, w: length, l: 20, h: height, fill: '#999' });

/** A referee that, on the tick `at` (or never), says what `call` says, and holds `props`. */
interface TestReferee {
  /** a call to make on one tick */
  plan: Array<{ tick: number; call: RefereeCall }>;
  props: readonly RefereeProp[] | null;
  observed: number;
}

function makeGame(o: { walls?: FixedWall[]; bodies?: Body[]; referee?: TestReferee }): Game<null> {
  const game: Game<null> = {
    id: 'props-test',
    title: 'Props test',
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
    createBodies: () => (o.bodies ?? []).map((b) => ({ ...b, home: { ...b.home } })),
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
  if (o.walls) game.createWalls = () => o.walls!.map((w) => ({ ...w }));
  const plan = o.referee;
  if (plan) {
    game.createReferee = (): Referee<null> => {
      const referee: Referee<null> = {
        observe(ctx: ScoreContext<null>) {
          plan.observed++;
          return plan.plan.find((p) => p.tick === ctx.world.tick)?.call ?? null;
        },
        restart() {},
        score: () => ({ total: 0, max: 0, lines: [], complete: false }),
      };
      if (plan.props !== null) referee.props = () => plan.props as readonly RefereeProp[];
      return referee;
    };
  }
  return game;
}

function setup(script: Script, o: { walls?: FixedWall[]; bodies?: Body[]; referee?: TestReferee; config?: RobotConfig; start?: Pose } = {}) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    { game: makeGame(o), scenario: null, robotConfig: o.config ?? CLAW, program: {}, startPose: o.start ?? { x: 500, y: 800, heading: 0 } },
    harness.factory,
  );
  return { sim, io: () => harness.io() };
}

/** A card of a colour, held upright `ahead` mm in front of the axle (frame 'robot'), 60 mm wide, 2 mm thick, from the mat up to 100 mm. */
const card = (colorName: SensorColor | undefined, ahead: number, z = 0, h = 100): RefereeProp => ({
  id: 'card',
  label: 'card',
  fill: '#f00',
  frame: 'robot',
  x: ahead + 1,
  y: 0,
  angle: 0,
  w: 60,
  l: 2,
  z,
  h,
  ...(colorName ? { colorName } : {}),
});

const refereeWith = (props: readonly RefereeProp[] | null, plan: TestReferee['plan'] = []): TestReferee => ({ plan, props, observed: 0 });

// =============================================================================================
// Props: where they are kept, and who sees them
// =============================================================================================

test('props: a referee without props() leaves World.props out - in every live game too', () => {
  const { sim } = setup(forever, { referee: refereeWith(null) });
  assert.equal('props' in sim.world, false);
  sim.start();
  sim.step(5);
  assert.equal('props' in sim.world, false);
  for (const game of [fireRescueGame, fireChiefGame, warehouseSortGame] as Game<unknown>[]) {
    const live = createSimulation({ game, scenario: game.defaultScenario(), program: {} });
    live.start();
    live.step(3);
    assert.equal('props' in live.world, false, game.id);
  }
});

test('props: World.props is the referee\'s list from the creation of the match on, and after every look', () => {
  const box: RefereeProp = { id: 'box', label: 'box', fill: '#f90', frame: 'robot', x: 17.5, y: 0, angle: 0, w: 90, l: 110, z: 90, h: 80 };
  const plan = refereeWith([box]);
  const { sim } = setup(forever, { referee: plan });
  assert.deepEqual(sim.world.props, [box], 'before the start (a screen draws the box on the robot it places)');
  sim.start();
  sim.step(1);
  plan.props = [];
  sim.step(1);
  assert.deepEqual(sim.world.props, [], 'the referee lifted it: the next look takes the new list');
  assert.equal(plan.observed, 2);
});

test('props: the colour sensor at the claw reads a card held in front of it, arm down and arm up, up to its range', () => {
  const g = CLAW.gripper;
  const tips = g.gripForward + g.fingerLength / 2; // 167 mm ahead of the axle
  const reach = g.gripForward + CLAW.frontColorSensor.rangeMm; // it sees up to 177 mm ahead
  for (const [ahead, expected] of [
    [tips + 5, 'red'],
    [reach - 0.01, 'red'],
    [reach + 0.5, 'none'],
  ] as const) {
    const { sim, io } = setup(forever, { referee: refereeWith([card('red', ahead)]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), expected, `card face ${ahead} mm ahead`);
    assert.equal(sim.readSensors().frontColor, expected);
  }
  // with the arm up the sensor is 85 mm high: the card (0 .. 100 mm) is still in its sight, a low card is not
  for (const [prop, expected] of [
    [card('green', tips + 5), 'green'],
    [card('green', tips + 5, 0, 40), 'none'],
  ] as const) {
    const { sim, io } = setup(
      function* (rio) {
        rio.setServo(g.liftServo, g.liftUpAngle);
        yield* forever();
      },
      { referee: refereeWith([prop]) },
    );
    sim.start();
    sim.step(100);
    assert.equal(sim.world.robot.gripper.height, g.liftUpHeight);
    assert.equal(io().frontColor(), expected, `card of ${prop.h} mm, arm up`);
  }
  // a prop without a colour name is not seen at all (the Team Box on top of the robot)
  const { sim, io } = setup(forever, { referee: refereeWith([card(undefined, tips + 5)]) });
  sim.start();
  sim.step(1);
  assert.equal(io().frontColor(), 'none');
});

test('props: the nearest thing wins - a cube in the claw before the card, a card before a cube behind it', () => {
  const g = CLAW.gripper;
  const tips = g.gripForward + g.fingerLength / 2;
  // a cube between the open fingers, its middle at the gripping centre (142 mm ahead)
  const cube = makeBody({ id: 'cube', x: 500, y: 800 - g.gripForward, w: 40, l: 40, h: 40, grippable: true, colorName: 'blue' });
  {
    const { sim, io } = setup(forever, { bodies: [cube], referee: refereeWith([card('red', tips + 5)]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), 'blue', 'the cube is nearer');
  }
  // a cube beyond the card: the card is nearer
  const far = makeBody({ id: 'far', x: 500, y: 800 - (tips + 25), w: 40, l: 40, h: 40, grippable: true, colorName: 'blue' });
  {
    const { sim, io } = setup(forever, { bodies: [far], referee: refereeWith([card('red', tips + 2)]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), 'red', 'the card is nearer');
  }
  // a cube exactly as near as the card wins over it
  {
    const face = tips - 10;
    const same = makeBody({ id: 'same', x: 500, y: 800 - face - 20, w: 40, l: 40, h: 40, grippable: true, colorName: 'blue' });
    const { sim, io } = setup(forever, { bodies: [same], referee: refereeWith([card('red', face)]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), 'blue');
  }
});

test('props: the colour sensor fixed to the front reads a card on its line of sight; a wall in front hides it', () => {
  const face = 110 + 10; // 10 mm in front of the sensor (its range is 15 mm)
  const mat: RefereeProp = { ...card('green', face), frame: 'mat', x: 500, y: 800 - face - 1, angle: 0 };
  {
    const { sim, io } = setup(forever, { config: FIXED, referee: refereeWith([mat]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), 'green');
  }
  {
    // a wall between the sensor and the card
    const { sim, io } = setup(forever, { config: FIXED, walls: [{ ...wall('wall:in-front', 500, 800 - 110 - 5, 100), l: 4 }], referee: refereeWith([mat]) });
    sim.start();
    sim.step(1);
    assert.equal(io().frontColor(), 'none', 'the wall has no colour name, and it hides the card');
  }
});

test('props: nothing collides with a prop, and the ultrasonic sensor does not see it', () => {
  // a big "prop" right in front of the robot, on the mat
  const block: RefereeProp = { id: 'block', label: 'block', fill: '#888', frame: 'mat', x: 500, y: 600, angle: 0, w: 200, l: 50, z: 0, h: 150, colorName: 'red' };
  const { sim, io } = setup(function* (rio) {
    yield* sleep(1);
    yield* drive(rio, 400, 100);
    yield* forever();
  }, { referee: refereeWith([block]) });
  sim.start();
  sim.step(1);
  assert.equal(io().ultrasonicCm(), DEFAULT_ROBOT_CONFIG.ultrasonic.maxRangeCm, 'the ultrasonic sees nothing');
  sim.step(1000);
  assert.ok(Math.abs(sim.world.robot.pose.y - 400) < 0.5, `the robot drove 400 mm through it: y ${sim.world.robot.pose.y}`);
  assert.equal(sim.world.robot.touching, false);
});

// =============================================================================================
// removeWalls
// =============================================================================================

test('removeWalls: the wall is gone from the next tick on - the robot drives through, the sensors do not see it', () => {
  const gate = wall('wall:gate', 500, 500, 300);
  const other = wall('wall:other', 150, 300, 100);
  const plan = refereeWith(null, [{ tick: 5, call: { removeWalls: ['wall:gate'] } }]);
  let seenBefore = -1;
  let seenAfter = -1;
  const { sim } = setup(function* (rio) {
    yield* sleep(2);
    seenBefore = rio.ultrasonicCm();
    yield* sleep(5);
    seenAfter = rio.ultrasonicCm();
    yield* drive(rio, 500, 100);
    yield* forever();
  }, { walls: [gate, other], referee: plan });
  const walls = sim.world.walls;
  assert.equal(walls?.length, 2);
  sim.start();
  sim.step(4);
  assert.equal(sim.world.walls, walls, 'until the call: the same list');
  sim.step(1);
  assert.notEqual(sim.world.walls, walls, 'a new list (a screen that keeps a picture of the walls draws again)');
  assert.deepEqual(sim.world.walls?.map((w) => w.id), ['wall:other']);
  assert.equal(walls?.length, 2, 'the old list is not changed');
  sim.step(1000);
  // the wall's near face was 800 - 105 - 510 = 185 mm ahead of the ultrasonic sensor
  assert.ok(Math.abs(seenBefore - 18.5) < 0.2, `before: ${seenBefore} cm`);
  assert.equal(seenAfter, DEFAULT_ROBOT_CONFIG.ultrasonic.maxRangeCm, 'after: nothing in sight');
  assert.ok(Math.abs(sim.world.robot.pose.y - 300) < 0.5, `the robot drove through where the wall stood: y ${sim.world.robot.pose.y}`);
  const bumps = sim.drainEvents().filter((e) => e.type === 'bump');
  assert.deepEqual(bumps, []);
});

test('removeWalls: a cube pushed against the wall goes through once it is gone; an unknown id or a second call changes nothing', () => {
  const gate = wall('wall:gate', 500, 500, 300);
  const cube = makeBody({ id: 'cube', x: 500, y: 560, w: 40, l: 40, h: 40 });
  const plan = refereeWith(null, [
    { tick: 3, call: { removeWalls: ['wall:nothing'] } },
    { tick: 200, call: { removeWalls: ['wall:gate'] } },
    { tick: 201, call: { removeWalls: ['wall:gate'] } },
  ]);
  const { sim } = setup(function* (rio) {
    rio.setServo('S1', 90); // the arm up: the fingers pass over the cube (40 mm)
    yield* drive(rio, 600, 60);
    yield* forever();
  }, { walls: [gate], bodies: [cube], referee: plan });
  const walls = sim.world.walls;
  sim.start();
  sim.step(150);
  assert.equal(sim.world.walls, walls, 'an id that is no wall here: the same list');
  const pressed = sim.world.bodies[0].y;
  assert.ok(pressed >= 510 + 20 - 0.1, `the cube is held up by the wall: y ${pressed}`);
  sim.step(51);
  const after = sim.world.walls;
  assert.deepEqual(after, []);
  sim.step(1);
  assert.equal(sim.world.walls, after, 'a second call for the same wall: nothing new');
  sim.step(800);
  assert.ok(sim.world.bodies[0].y < 480, `the cube was pushed on through the place of the wall: y ${sim.world.bodies[0].y}`);
});
