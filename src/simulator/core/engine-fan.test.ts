/**
 * The add-ons of the maze robot: the DC motor ports M1 / M2 with the fan, and the robot without
 * a gripper. (Its colour sensor that looks forward has a file of its own:
 * engine-front-color.test.ts.)
 *
 * Like engine-walls.test.ts: a plain white 1000 x 1000 mm mat, a tiny fake VM that runs a script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireRescueGame } from '../fire-rescue/game';
import { FIRE_STATION } from '../fire-rescue/field';
import { defaultScenario } from '../fire-rescue/scenario';
import { createEngineSimulation } from './engine';
import { obbOverlap, rectContainsOBB } from './geometry';
import { DEFAULT_ROBOT_CONFIG, robotFitsInRect, robotShapesAt, robotSize } from './robot';
import { drive, forever, makeBody, near, scripted, sleep, turn, waitUntil, type Script } from './test-helpers';
import type { Body, Game, MatVector, Pose, RobotConfig } from './types';

// =============================================================================================
// Helpers
// =============================================================================================

/** A robot without gripper, with a fan on M1. */
const MAZE_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
  fan: { enabled: true, port: 'M1', forward: 105, minPower: 20, coneHalfAngleDeg: 20, reachMm: 300 },
};

const MAT: MatVector = {
  width: 1000,
  height: 1000,
  background: { r: 255, g: 255, b: 255 },
  outside: { r: 120, g: 120, b: 120 },
  layers: [],
};

function makeGame(bodies: Body[], duration = 180): Game<null> {
  return {
    id: 'fan-test',
    title: 'Fan test',
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
    overlays: () => [],
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  };
}

interface SetupOptions {
  bodies?: Body[];
  config?: RobotConfig;
  duration?: number;
}

function setup(script: Script, o: SetupOptions = {}) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    {
      game: makeGame(o.bodies ?? [], o.duration),
      scenario: null,
      robotConfig: o.config ?? MAZE_ROBOT,
      program: {},
    },
    harness.factory,
  );
  return { sim, harness, robot: sim.world.robot };
}

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
