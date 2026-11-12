/**
 * The add-ons of the maze robot: the flame sensor, the DC motor ports M1 / M2 with the fan, and
 * the robot without a gripper.
 *
 * Like engine-walls.test.ts: a plain white 1000 x 1000 mm mat, a tiny fake VM that runs a script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireRescueGame } from '../fire-rescue/game';
import { FIRE_STATION } from '../fire-rescue/field';
import { defaultScenario } from '../fire-rescue/scenario';
import { createEngineSimulation } from './engine';
import { flameSignal } from './engine-sensors';
import { DEG, obbOverlap, rectContainsOBB, wrapAngle } from './geometry';
import { DEFAULT_ROBOT_CONFIG, robotFitsInRect, robotShapesAt, robotSize } from './robot';
import { drive, forever, makeBody, near, scripted, sleep, turn, waitUntil, type Script } from './test-helpers';
import type { Body, FixedWall, FlameSensorConfig, Game, MatVector, Pose, RobotConfig } from './types';

// =============================================================================================
// Helpers
// =============================================================================================

const FLAME: FlameSensorConfig = { enabled: true, forward: 105, height: 60, halfAngleDeg: 30, rangeMm: 1000, threshold: 10 };

/** A robot without gripper, with a flame sensor and a fan on M1. */
const MAZE_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
  flameSensor: FLAME,
  fan: { enabled: true, port: 'M1', forward: 105, minPower: 20, coneHalfAngleDeg: 20, reachMm: 300 },
};

const MAT: MatVector = {
  width: 1000,
  height: 1000,
  background: { r: 255, g: 255, b: 255 },
  outside: { r: 120, g: 120, b: 120 },
  layers: [],
};

/**
 * A "flame": a 60 x 20 x 120 mm board with an infrared emitter in the middle of its front face,
 * 60 mm above the mat. `facing` is the direction it looks (degrees, 0 = up, clockwise).
 */
function flame(x: number, y: number, facing: number, id = 'flame', emitterHeight = 60): Body {
  return makeBody({
    id,
    x,
    y,
    w: 60,
    l: 20,
    h: 120,
    angle: facing * DEG,
    infrared: { forward: 10, height: emitterHeight, halfAngleDeg: 70 },
  });
}

/** The standard flame of these tests: against the top of the mat, looking down. Its emitter is at (500, 110). */
const FLAME_BODY = flame(500, 100, 180);
const EMITTER = { x: 500, y: 110 };

const wallAcross = (y: number, height: number, x = 500, length = 400): FixedWall => ({
  id: 'wall:w',
  label: 'w',
  x,
  y,
  angle: 0,
  w: length,
  l: 3,
  h: height,
  fill: '#999',
});

function makeGame(bodies: Body[], walls: FixedWall[], duration = 180): Game<null> {
  return {
    id: 'flame-test',
    title: 'Flame test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: duration,
    startZone: { x: 0, y: 0, w: 1000, h: 1000 },
    defaultStartPose: { x: 500, y: 500, heading: 0 },
    restartPenalty: 0,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: () => bodies.map((b) => ({ ...b, home: { ...b.home } })),
    createWalls: () => walls,
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
}

interface SetupOptions {
  bodies?: Body[];
  walls?: FixedWall[];
  startPose?: Pose;
  config?: RobotConfig;
  seed?: number;
  duration?: number;
}

function setup(script: Script, o: SetupOptions = {}) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    {
      game: makeGame(o.bodies ?? [], o.walls ?? [], o.duration),
      scenario: null,
      robotConfig: o.config ?? MAZE_ROBOT,
      program: {},
      startPose: o.startPose,
      seed: o.seed,
    },
    harness.factory,
  );
  return { sim, harness, robot: sim.world.robot };
}

/** The pose that puts the flame sensor of the robot at (x, y), looking in direction `degrees`. */
function sensorAt(x: number, y: number, degrees: number): Pose {
  const heading = degrees * DEG;
  return { x: x - FLAME.forward * Math.sin(heading), y: y + FLAME.forward * Math.cos(heading), heading };
}

/** One flame reading with the robot standing at `pose`. */
function flameAt(pose: Pose, o: Omit<SetupOptions, 'startPose'> = {}): number {
  const { sim } = setup(function* () {}, { bodies: [FLAME_BODY], ...o, startPose: pose });
  return sim.readSensors().flame;
}

// =============================================================================================
// The flame value (pure maths)
// =============================================================================================

/** flameSignal() with the sensor at the origin looking up, and an emitter that looks straight back at it. */
const straight = (distance: number, off = 0, side = 0): number => {
  // the emitter is `distance` away, `off` degrees to the right of straight ahead ...
  const ex = distance * Math.sin(off * DEG);
  const ey = -distance * Math.cos(off * DEG);
  // ... and looks back at the sensor, turned away by `side` degrees
  const back = Math.atan2(-ex, ey) + side * DEG;
  return flameSignal(0, 0, 0, 30, 1000, ex, ey, back, 70);
};

test('flame value: 100 at the sensor, falling to 0 at the end of the range', () => {
  near(straight(0), 100, 1e-9);
  near(straight(100), 81, 1e-9);
  near(straight(300), 49, 1e-9);
  near(straight(500), 25, 1e-9);
  near(straight(900), 1, 1e-9);
  assert.equal(straight(1000), 0);
  assert.equal(straight(1500), 0);
  let last = Infinity;
  for (let d = 0; d <= 1000; d += 25) {
    const value = straight(d);
    assert.ok(value < last || (value === 0 && last === 0), `falls with the distance (at ${d} mm)`);
    last = value;
  }
});

test('flame value: strongest straight ahead, half at 15 degrees, nothing from 30 degrees on', () => {
  near(straight(300, 15), 24.5, 1e-9);
  near(straight(300, -15), 24.5, 1e-9);
  near(straight(300, 30), 0, 1e-9);
  assert.equal(straight(300, 31), 0);
  assert.equal(straight(300, -45), 0);
  assert.equal(straight(300, 180), 0, 'behind the sensor');
  let last = straight(300, 0);
  for (let off = 1; off <= 30; off++) {
    const value = straight(300, off);
    assert.ok(value < last, `falls with the angle (at ${off} degrees)`);
    near(straight(300, -off), value, 1e-9, 'the same to the left and to the right');
    last = value;
  }
});

test('flame value: the emitter shines forward - full in front of it, fading out towards 70 degrees', () => {
  near(straight(300, 0, 0), 49, 1e-9);
  near(straight(300, 0, 30), 49, 1e-9);
  near(straight(300, 0, 52.5), 49, 1e-9);
  assert.ok(straight(300, 0, 60) < 49 && straight(300, 0, 60) > 0);
  assert.ok(straight(300, 0, 65) < straight(300, 0, 60));
  near(straight(300, 0, 70), 0, 1e-9);
  assert.equal(straight(300, 0, 71), 0);
  assert.equal(straight(300, 0, 90), 0, 'beside the emitter');
  assert.equal(straight(300, 0, 180), 0, 'behind the emitter');
  near(straight(300, 0, -60), straight(300, 0, 60), 1e-9);
});

test('flame value: a sensor without range or field of view reads nothing', () => {
  assert.equal(flameSignal(0, 0, 0, 30, 0, 0, -100, Math.PI, 70), 0);
  assert.equal(flameSignal(0, 0, 0, 0, 1000, 0, -100, Math.PI, 70), 0);
  assert.equal(flameSignal(0, 0, 0, 30, 1000, 0, -100, Math.PI, 0), 0);
  // sensor and emitter at the same point: full value, no division by zero
  assert.equal(flameSignal(5, 5, 1, 30, 1000, 5, 5, 2, 70), 100);
});

// =============================================================================================
// The flame sensor on the robot
// =============================================================================================

test('flame sensor: reads the value for its distance to the emitter, rounded to 0.1', () => {
  // the sensor is 300 mm below the emitter, looking straight at it
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 300, 0)), 49);
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 100, 0)), 81);
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 450, 0)), 30.3); // 100 x 0.55^2 = 30.25
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 720, 0)), 7.8);
  // (the sensor sits at the front of the chassis: with the robot's origin at y = 515 it is at y = 410)
  assert.equal(flameAt({ x: 500, y: EMITTER.y + 300 + FLAME.forward, heading: 0 }), 49);
});

test('flame sensor: the value falls when the flame is further away and when it is more to the side', () => {
  let last = Infinity;
  for (let d = 50; d <= 850; d += 100) {
    const value = flameAt(sensorAt(500, EMITTER.y + d, 0));
    assert.ok(value < last, `${value} at ${d} mm is lower than ${last}`);
    last = value;
  }
  last = Infinity;
  for (const off of [0, 5, 10, 15, 20, 25, 29]) {
    const value = flameAt(sensorAt(500, EMITTER.y + 300, off));
    assert.ok(value < last && value > 0, `${value} at ${off} degrees is lower than ${last}`);
    near(flameAt(sensorAt(500, EMITTER.y + 300, -off)), value, 0.11, 'left and right alike');
    last = value;
  }
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 300, 30)), 0);
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 300, 90)), 0);
  assert.equal(flameAt(sensorAt(500, EMITTER.y + 300, 180)), 0, 'looking away');
});

test('flame sensor: it must be in front of the flame - beside it or behind it it reads nothing', () => {
  const upright = flame(500, 500, 0); // in the middle of the mat, looking up; its emitter is at (500, 490)
  const see = (x: number, y: number): number => {
    // look straight at the emitter from (x, y)
    const facing = Math.atan2(500 - x, y - 490) / DEG;
    return flameAt(sensorAt(x, y, facing), { bodies: [upright] });
  };
  assert.equal(see(500, 290), 64, 'straight in front of it, 200 mm away');
  assert.equal(see(500 + 200 * Math.sin(40 * DEG), 490 - 200 * Math.cos(40 * DEG)), 64, '40 degrees to its side: still full');
  const at60 = see(500 + 200 * Math.sin(60 * DEG), 490 - 200 * Math.cos(60 * DEG));
  assert.ok(at60 > 0 && at60 < 64, `60 degrees to its side: weaker (${at60})`);
  assert.equal(see(500 + 200 * Math.sin(75 * DEG), 490 - 200 * Math.cos(75 * DEG)), 0, '75 degrees to its side');
  assert.equal(see(700, 490), 0, 'beside it');
  assert.equal(see(500, 700), 0, 'behind it');
});

test('flame sensor: a wall between the sensor and the flame blocks the light', () => {
  const pose = sensorAt(500, EMITTER.y + 400, 0);
  assert.equal(flameAt(pose), 36);
  assert.equal(flameAt(pose, { walls: [wallAcross(300, 150)] }), 0, 'a 150 mm wall');
  assert.equal(flameAt(pose, { walls: [wallAcross(300, 60)] }), 0, 'a wall just as high as the light');
  assert.equal(flameAt(pose, { walls: [wallAcross(300, 50)] }), 36, 'the light passes over a 50 mm wall');
  assert.equal(flameAt(pose, { walls: [wallAcross(300, 150, 150, 200)] }), 36, 'a wall beside the line of sight');
  assert.equal(flameAt(pose, { walls: [wallAcross(50, 150)] }), 36, 'a wall behind the flame');
  assert.equal(flameAt(pose, { walls: [wallAcross(700, 150)] }), 36, 'a wall behind the sensor');
});

test('flame sensor: the line of sight is a straight line in height too', () => {
  // an emitter 100 mm up, the sensor 60 mm up, 400 mm apart: the light climbs 1 mm every 10 mm
  const high = flame(500, 100, 180, 'flame', 100);
  const pose = sensorAt(500, EMITTER.y + 400, 0);
  assert.equal(flameAt(pose, { bodies: [high] }), 36);
  // a 70 mm wall near the sensor (the light is 62 mm up there) blocks it ...
  assert.equal(flameAt(pose, { bodies: [high], walls: [wallAcross(490, 70)] }), 0);
  // ... the same wall near the flame (the light is 98 mm up there) does not
  assert.equal(flameAt(pose, { bodies: [high], walls: [wallAcross(130, 70)] }), 36);
});

test('flame sensor: a tall box in the way blocks the light, a low one does not', () => {
  const pose = sensorAt(500, EMITTER.y + 400, 0);
  const tall = makeBody({ id: 'tall', x: 500, y: 300, w: 80, l: 20, h: 100 });
  const low = makeBody({ id: 'low', x: 500, y: 300, w: 80, l: 20, h: 40 });
  const aside = makeBody({ id: 'aside', x: 300, y: 300, w: 80, l: 20, h: 100 });
  assert.equal(flameAt(pose, { bodies: [FLAME_BODY, tall] }), 0);
  assert.equal(flameAt(pose, { bodies: [FLAME_BODY, low] }), 36);
  assert.equal(flameAt(pose, { bodies: [FLAME_BODY, aside] }), 36);
});

test('flame sensor: only a body with an infrared emitter is seen, and the strongest one counts', () => {
  const dark = makeBody({ id: 'dark', x: 500, y: 100, w: 60, l: 20, h: 120, angle: 180 * DEG });
  const pose = sensorAt(500, EMITTER.y + 300, 0);
  assert.equal(flameAt(pose, { bodies: [dark] }), 0, 'a board without emitter');
  assert.equal(flameAt(pose, { bodies: [] }), 0, 'an empty mat');
  // a second flame, nearer but 20 degrees to the side: 100 x 0.8^2 x 0.25 = 16
  const second = flame(500 + 200 * Math.sin(20 * DEG), EMITTER.y + 300 - 200 * Math.cos(20 * DEG) - 10, 180, 'second');
  const alone = flameAt(pose, { bodies: [second] });
  assert.ok(alone > 10 && alone < 49, `the second flame alone reads ${alone}`);
  assert.equal(flameAt(pose, { bodies: [FLAME_BODY, second] }), 49, 'the stronger one');
  assert.equal(flameAt(pose, { bodies: [second, FLAME_BODY] }), 49, 'in any order');
});

test('flame sensor: turning on the spot until the value is highest points the robot at the flame', () => {
  // robot origins that see the flame from different sides and distances
  const places: Array<[number, number]> = [
    [500, 500],
    [350, 400],
    [700, 450],
    [420, 300],
    [600, 700],
  ];
  for (const [x, y] of places) {
    const readings: Array<{ heading: number; value: number }> = [];
    const { sim, robot } = setup(
      function* (io) {
        // one full turn, slowly: about 0.4 degrees per tick
        const run = turn(io, 360, 12);
        for (;;) {
          readings.push({ heading: robot.pose.heading, value: io.flameValue() });
          if (run.next().done) break;
          yield;
        }
      },
      { bodies: [FLAME_BODY], startPose: { x, y, heading: 90 * DEG } },
    );
    sim.start();
    sim.step(20000);
    assert.equal(sim.finishReason, 'program-ended');
    const best = readings.reduce((a, b) => (b.value > a.value ? b : a));
    // the direction from the robot's turning point to the emitter
    const bearing = Math.atan2(EMITTER.x - x, y - EMITTER.y);
    const error = Math.abs(wrapAngle(best.heading - bearing)) / DEG;
    assert.ok(best.value > 10, `from ${x}, ${y}: the highest value is ${best.value}`);
    assert.ok(error <= 1.5, `from ${x}, ${y}: highest value ${best.value} at ${error.toFixed(2)} degrees from the flame`);
    // one single hill: up to the best heading, then down - no second peak to be fooled by
    const seen = readings.filter((r) => r.value > 0);
    const top = seen.indexOf(best);
    for (let i = 1; i <= top; i++) assert.ok(seen[i].value >= seen[i - 1].value - 0.11, 'rising before the peak');
    for (let i = top + 1; i < seen.length; i++) assert.ok(seen[i].value <= seen[i - 1].value + 0.11, 'falling after the peak');
  }
});

test('flame sensor: "flame detected" means the value is above the threshold', () => {
  const detected = (pose: Pose, config: RobotConfig = MAZE_ROBOT): boolean => {
    const { sim, harness } = setup(function* () {}, { bodies: [FLAME_BODY], startPose: pose, config });
    assert.equal(sim.readSensors().flameDetected, harness.io().flameDetected());
    return harness.io().flameDetected();
  };
  assert.equal(detected(sensorAt(500, EMITTER.y + 300, 0)), true); // 49
  assert.equal(detected(sensorAt(500, EMITTER.y + 680, 0)), true); // 10.2
  assert.equal(detected(sensorAt(500, EMITTER.y + 690, 0)), false); // 9.6
  assert.equal(detected(sensorAt(500, EMITTER.y + 300, 180)), false);
  // the threshold is a setting of the sensor
  const picky: RobotConfig = { ...MAZE_ROBOT, flameSensor: { ...FLAME, threshold: 60 } };
  assert.equal(detected(sensorAt(500, EMITTER.y + 300, 0), picky), false);
  assert.equal(detected(sensorAt(500, EMITTER.y + 100, 0), picky), true);
});

test('flame sensor: a robot without one (or with it switched off) reads 0 and detects nothing', () => {
  const pose = sensorAt(500, EMITTER.y + 300, 0);
  for (const config of [DEFAULT_ROBOT_CONFIG, { ...MAZE_ROBOT, flameSensor: { ...FLAME, enabled: false } }]) {
    const { sim, harness } = setup(function* () {}, { bodies: [FLAME_BODY], startPose: pose, config });
    assert.equal(harness.io().flameValue(), 0);
    assert.equal(harness.io().flameDetected(), false);
    const snapshot = sim.readSensors();
    assert.equal(snapshot.flame, 0);
    assert.equal(snapshot.flameDetected, false);
  }
});

test('flame sensor: the dashboard sees what the program sees, and the value follows the robot', () => {
  const seen: number[] = [];
  const { sim, robot } = setup(
    function* (io) {
      io.setWheelRpm('left', 60);
      io.setWheelRpm('right', 60);
      yield* waitUntil(() => {
        seen.push(io.flameValue());
        return io.flameValue() >= 60;
      });
      io.stopWheel('all');
    },
    { bodies: [FLAME_BODY], startPose: { x: 500, y: 900, heading: 0 } },
  );
  sim.start();
  assert.equal(sim.readSensors().flame, 9.9, 'before the first tick: 685 mm away');
  sim.step(3000);
  assert.equal(sim.finishReason, 'program-ended');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'the value only grows on the way to the flame');
  assert.ok(seen[seen.length - 1] >= 60);
  assert.equal(sim.readSensors().flame, robot.lastFlame);
  assert.ok((robot.lastFlame ?? 0) > 60);
});

test('flame sensor: noise is small, repeatable, and never invents a flame', () => {
  const noisy: RobotConfig = { ...MAZE_ROBOT, noise: { ...MAZE_ROBOT.noise, flame: 3 } };
  const record = (seed: number, pose: Pose): number[] => {
    const values: number[] = [];
    const { sim } = setup(
      function* (io) {
        for (let i = 0; i < 200; i++) {
          values.push(io.flameValue());
          assert.equal(io.flameValue(), values[values.length - 1], 'the same value all through one tick');
          yield;
        }
      },
      { bodies: [FLAME_BODY], startPose: pose, config: noisy, seed },
    );
    sim.start();
    sim.step(300);
    return values;
  };
  const pose = sensorAt(500, EMITTER.y + 300, 0);
  const a = record(7, pose);
  assert.deepEqual(record(7, pose), a, 'same seed, same readings');
  assert.notDeepEqual(record(8, pose), a, 'another seed, other readings');
  assert.ok(Math.min(...a) >= 46 && Math.max(...a) <= 52, `within 3 of 49: ${Math.min(...a)} .. ${Math.max(...a)}`);
  assert.ok(new Set(a).size > 20, 'it really varies');
  // where there is no light there is no noise either: 0 stays 0
  assert.deepEqual(new Set(record(7, sensorAt(500, EMITTER.y + 300, 180))), new Set([0]));
});

// =============================================================================================
// DC motors and the fan
// =============================================================================================

test('DC motors: M1 and M2 take a power of -100..100 and keep it until it is changed', () => {
  const { sim, harness, robot } = setup(function* () {
    yield* forever();
  });
  const io = harness.io();
  sim.start();
  assert.equal(io.dcMotorPower('M1'), 0);
  assert.equal(io.dcMotorPower('M2'), 0);
  io.setDcMotor('M1', 60);
  io.setDcMotor('M2', -35);
  sim.step(50);
  assert.equal(io.dcMotorPower('M1'), 60);
  assert.equal(io.dcMotorPower('M2'), -35);
  assert.deepEqual(robot.dcMotors, { M1: { power: 60 }, M2: { power: -35 } });
  assert.deepEqual(sim.readSensors().dcMotorPower, { M1: 60, M2: -35 });
  // limits, and numbers that are not numbers
  io.setDcMotor('M1', 250);
  assert.equal(io.dcMotorPower('M1'), 100);
  io.setDcMotor('M1', -250);
  assert.equal(io.dcMotorPower('M1'), -100);
  io.setDcMotor('M1', Number.NaN);
  assert.equal(io.dcMotorPower('M1'), 0);
  io.setDcMotor('M1', Infinity);
  assert.equal(io.dcMotorPower('M1'), 0);
  // stopping one port, then all
  io.setDcMotor('M1', 40);
  io.stopDcMotor('M2');
  assert.equal(io.dcMotorPower('M1'), 40);
  assert.equal(io.dcMotorPower('M2'), 0);
  io.setDcMotor('M2', 40);
  io.stopDcMotor('all');
  assert.equal(io.dcMotorPower('M1'), 0);
  assert.equal(io.dcMotorPower('M2'), 0);
  // a port that does not exist is ignored
  io.setDcMotor('M3' as 'M1', 50);
  assert.equal(io.dcMotorPower('M3' as 'M1'), 0);
  // the DC motors do not move the robot
  assert.equal(robot.pose.x, 500);
  assert.equal(robot.pose.y, 500);
});

test('fan: it blows while the motor of its port runs with at least 20 % power, in either direction', () => {
  const { sim, harness, robot } = setup(function* () {
    yield* forever();
  });
  const io = harness.io();
  sim.start();
  const fanAt = (power: number): boolean => {
    io.setDcMotor('M1', power);
    sim.step(1);
    assert.equal(sim.readSensors().fanOn, robot.fanOn);
    return robot.fanOn === true;
  };
  assert.equal(robot.fanOn, false);
  assert.equal(fanAt(100), true);
  assert.equal(fanAt(20), true);
  assert.equal(fanAt(19.9), false);
  assert.equal(fanAt(0), false);
  assert.equal(fanAt(-19.9), false);
  assert.equal(fanAt(-20), true);
  assert.equal(fanAt(-100), true);
  io.stopDcMotor('M1');
  assert.equal(robot.fanOn, false);
  // the fan is on M1: M2 does not drive it
  io.setDcMotor('M2', 100);
  sim.step(1);
  assert.equal(robot.fanOn, false);
  io.stopDcMotor('all');
  io.setDcMotor('M1', 50);
  assert.equal(robot.fanOn, true, 'on at once, not only after the next tick');
  io.stopDcMotor('all');
  assert.equal(robot.fanOn, false);
});

test('fan: the port and the lowest power are settings; a robot without a fan never blows', () => {
  const onM2: RobotConfig = { ...MAZE_ROBOT, fan: { ...MAZE_ROBOT.fan!, port: 'M2', minPower: 50 } };
  const a = setup(function* () {}, { config: onM2 });
  a.harness.io().setDcMotor('M1', 100);
  assert.equal(a.robot.fanOn, false);
  a.harness.io().setDcMotor('M2', 49);
  assert.equal(a.robot.fanOn, false);
  a.harness.io().setDcMotor('M2', 50);
  assert.equal(a.robot.fanOn, true);

  for (const config of [DEFAULT_ROBOT_CONFIG, { ...MAZE_ROBOT, fan: { ...MAZE_ROBOT.fan!, enabled: false } }]) {
    const b = setup(function* () {}, { config });
    b.harness.io().setDcMotor('M1', 100);
    b.harness.io().setDcMotor('M2', 100);
    assert.equal(b.robot.fanOn, false);
    assert.equal(b.sim.readSensors().fanOn, false);
    // the motor port itself still works (something else may be plugged in)
    assert.equal(b.harness.io().dcMotorPower('M1'), 100);
  }
});

test('fan: a program that ends with the fan running does not end the match - the fan keeps blowing', () => {
  const { sim, robot } = setup(
    function* (io) {
      io.setDcMotor('M1', 80);
      yield* sleep(10);
    },
    { duration: 5 },
  );
  sim.start();
  sim.step(200);
  assert.equal(sim.status, 'running', 'still running 2 s after the program ended');
  assert.equal(robot.fanOn, true);
  sim.step(1000);
  assert.equal(sim.finishReason, 'time');
  // when the match is over everything stops, the fan too
  assert.equal(robot.fanOn, false);
  assert.deepEqual(robot.dcMotors, { M1: { power: 0 }, M2: { power: 0 } });
});

test('fan: a program that switches the fan off again ends normally', () => {
  const { sim, robot } = setup(function* (io) {
    io.setDcMotor('M1', 80);
    yield* sleep(100);
    io.stopDcMotor('M1');
  });
  sim.start();
  sim.step(1000);
  assert.equal(sim.finishReason, 'program-ended');
  near(sim.world.time, 1.02, 0.011);
  assert.equal(robot.fanOn, false);
});

test('fan: a restart stops the DC motors', () => {
  const { sim, robot, harness } = setup(function* (io) {
    yield* sleep(20);
    io.setDcMotor('M1', 80);
    io.setDcMotor('M2', 30);
    yield* forever();
  });
  sim.start();
  sim.step(50);
  assert.equal(robot.fanOn, true);
  sim.restart();
  assert.equal(robot.fanOn, false);
  assert.deepEqual(robot.dcMotors, { M1: { power: 0 }, M2: { power: 0 } });
  assert.equal(harness.starts(), 2);
  sim.step(50);
  assert.equal(robot.fanOn, true, 'the restarted program switches it on again');
});

// =============================================================================================
// The robot without a gripper
// =============================================================================================

test('robot without gripper: its footprint is the chassis alone', () => {
  const pose: Pose = { x: 500, y: 500, heading: 0 };
  assert.equal(robotShapesAt(DEFAULT_ROBOT_CONFIG, pose).length, 3);
  const shapes = robotShapesAt(MAZE_ROBOT, pose);
  assert.equal(shapes.length, 1);
  assert.deepEqual(robotSize(MAZE_ROBOT), { length: 175, width: 130 });
  // start zone check: a 180 x 135 mm zone holds it; the robot with the gripper does not fit
  const zone = { x: 432.5, y: 392.5, w: 135, h: 180 };
  assert.equal(robotFitsInRect(MAZE_ROBOT, pose, zone), true);
  assert.equal(robotFitsInRect(DEFAULT_ROBOT_CONFIG, pose, zone), false);
  assert.equal(robotFitsInRect(MAZE_ROBOT, { ...pose, y: 490 }, zone), false, 'its front sticks out');
  const { sim } = setup(function* () {});
  assert.deepEqual(sim.robotShapes(), shapes);
});

test('robot without gripper: it stands completely inside the Fire Station where the gripper robot does not', () => {
  // right at the top edge of the station: the chassis is inside, a claw would stick out
  const pose: Pose = { x: 625, y: FIRE_STATION.y + 105, heading: 0 };
  const bare = createEngineSimulation(
    { game: fireRescueGame, scenario: defaultScenario(), robotConfig: MAZE_ROBOT, program: {} },
    scripted(function* () {}).factory,
  );
  assert.equal(bare.setStartPose(pose), true);
  for (const shape of bare.robotShapes()) assert.ok(rectContainsOBB(FIRE_STATION, shape));
  const withClaw = createEngineSimulation(
    { game: fireRescueGame, scenario: defaultScenario(), robotConfig: DEFAULT_ROBOT_CONFIG, program: {} },
    scripted(function* () {}).factory,
  );
  assert.equal(withClaw.setStartPose(pose), false);
});

test('robot without gripper: the servo ports still move, but nothing is ever gripped', () => {
  const box = makeBody({ id: 'box', x: 500, y: 345, w: 40, l: 40, h: 60, grippable: true });
  const { sim, robot, harness } = setup(
    function* (io) {
      // "close the claw" and "raise the arm" on a robot that has neither
      io.setServo('S2', 60);
      io.setServo('S1', 90);
      yield* waitUntil(() => io.servoDone('S1') && io.servoDone('S2'));
      yield* drive(io, 100, 60);
    },
    { bodies: [box] },
  );
  sim.start();
  sim.step(2000);
  assert.equal(sim.finishReason, 'program-ended');
  const io = harness.io();
  assert.equal(io.servoAngle('S1'), 90);
  assert.equal(io.servoAngle('S2'), 60);
  assert.equal(robot.gripper.holding, null);
  assert.equal(io.frontColor(), 'none');
  assert.equal(sim.readSensors().frontColor, 'none');
  // the box was 50 mm ahead of the chassis: it was pushed 50 mm, not carried
  const pushed = sim.world.bodies[0];
  assert.equal(pushed.held, false);
  near(pushed.y, 500 - 100 - 105 - 20, 0.05, 'the box is in front of the chassis');
  near(robot.pose.y, 400, 1e-6);
  assert.equal(sim.drainEvents().filter((e) => e.type === 'grab').length, 0);
});

test('robot without gripper: where the fingers would be, things are not pushed', () => {
  // a box beside the path of the chassis, exactly where the left finger of the gripper robot runs
  const finger = makeBody({ id: 'box', x: 500 - 36, y: 250, w: 8, l: 8, h: 60 });
  const run = (config: RobotConfig): Body => {
    const { sim } = setup(
      function* (io) {
        yield* drive(io, 120, 60);
      },
      { bodies: [finger], config },
    );
    sim.start();
    sim.step(2000);
    return sim.world.bodies[0];
  };
  assert.ok(run(DEFAULT_ROBOT_CONFIG).y < 249, 'the gripper robot pushes it with a finger');
  assert.equal(run(MAZE_ROBOT).y, 250, 'the robot without gripper does not reach it');
});

test('robot without gripper: it plays Fire Rescue without trouble (pushes a tower, the referee still scores)', () => {
  const sim = createEngineSimulation(
    { game: fireRescueGame, scenario: defaultScenario(), robotConfig: MAZE_ROBOT, program: {} },
    scripted(function* (io) {
      yield* turn(io, -45);
      yield* drive(io, 400, 90);
    }).factory,
  );
  sim.start();
  sim.step(3000);
  assert.equal(sim.finishReason, 'program-ended');
  const report = sim.score();
  assert.equal(report.max, 180);
  assert.equal(report.total, 0);
  const moved = sim.world.bodies.filter((b) => Math.hypot(b.x - b.home.x, b.y - b.home.y) > 1);
  assert.ok(moved.length >= 1, 'it pushed something on its way');
  for (const b of sim.world.bodies) {
    const hit = obbOverlap(sim.robotShapes()[0], { x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle });
    assert.ok(!hit || hit.depth < 0.05 || b.z >= MAZE_ROBOT.chassisHeight, `${b.id} is not inside the robot`);
  }
});
