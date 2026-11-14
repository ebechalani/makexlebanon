/**
 * The colour sensor that is fixed to the front of the robot (RobotConfig.frontColorSensor.mount):
 * it looks straight ahead along one line and names the colour of the nearest thing on that line
 * - a game element or a fixed wall - when that thing is close enough.
 *
 * The tests use a plain white 1000 x 1000 mm mat with only the walls and bodies a test asks
 * for, and a robot without gripper. The robot is put where a test wants it and the sensor is
 * read at once (nothing drives), except in the last tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { DEG } from './geometry';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { forever, makeBody, scripted, waitUntil } from './test-helpers';
import type { Body, FixedWall, Game, MatVector, Pose, RobotConfig, SensorColor, Simulation } from './types';

// =============================================================================================
// Helpers
// =============================================================================================

/** The sensor of these tests: on the front face of the chassis, 60 mm above the mat, seeing 15 mm far. */
const RANGE = 15;
const SENSOR_HEIGHT = 60;
const FRONT = DEFAULT_ROBOT_CONFIG.chassisFront;

/** A robot without gripper, with the colour sensor fixed to the middle of its front face. */
const ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { enabled: true, rangeMm: RANGE, mount: { forward: FRONT, height: SENSOR_HEIGHT } },
};

const MAT: MatVector = {
  width: 1000,
  height: 1000,
  background: { r: 255, g: 255, b: 255 },
  outside: { r: 120, g: 120, b: 120 },
  layers: [],
};

/** A wall along x (left-right) with its middle at (x, y), 3 mm thick. */
const levelWall = (x: number, y: number, length: number, part: Partial<FixedWall> = {}): FixedWall => ({
  id: 'wall:test',
  label: 'test',
  x,
  y,
  angle: 0,
  w: length,
  l: 3,
  h: 150,
  fill: '#c9a26b',
  colorName: 'yellow',
  ...part,
});

/** A red board like a fire target: 60 wide, 20 deep, 120 high, with its middle at (x, y). */
const board = (x: number, y: number, part: Partial<Body> = {}): Body => makeBody({ id: 'board', x, y, w: 60, l: 20, h: 120, colorName: 'red', ...part });

function makeGame(walls: FixedWall[], bodies: Body[]): Game<null> {
  return {
    id: 'front-colour-test',
    title: 'Front colour sensor test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 180,
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
    createWalls: () => walls.map((w) => ({ ...w })),
  };
}

interface Scene {
  walls?: FixedWall[];
  bodies?: Body[];
  config?: RobotConfig;
}

/** What the sensor reads when the robot stands at `pose` in this scene. */
function read(scene: Scene, pose: Pose): SensorColor | 'none' {
  const sim: Simulation<null> = createEngineSimulation(
    { game: makeGame(scene.walls ?? [], scene.bodies ?? []), scenario: null, robotConfig: scene.config ?? ROBOT, program: {}, startPose: pose },
    scripted(function* () {
      yield* forever();
    }).factory,
  );
  return sim.readSensors().frontColor;
}

/** The pose of a robot that faces up the mat with the face of its sensor at (x, y). */
const noseAt = (x: number, y: number): Pose => ({ x, y: y + FRONT, heading: 0 });

// =============================================================================================
// How far it sees
// =============================================================================================

test('front colour sensor: a thing is seen at 15 mm and nearer, not at 16 mm', () => {
  // the board stands at y = 290 .. 310; the robot looks up the mat at its lower face (y = 310)
  const scene: Scene = { bodies: [board(500, 300)] };
  for (const gap of [0, 0.5, 5, 14, 14.99, 15]) assert.equal(read(scene, noseAt(500, 310 + gap)), 'red', `${gap} mm`);
  for (const gap of [15.01, 15.5, 16, 30, 200]) assert.equal(read(scene, noseAt(500, 310 + gap)), 'none', `${gap} mm`);
});

test('front colour sensor: a wall is seen at 15 mm and nearer, not at 16 mm - and reads the colour name the wall carries', () => {
  // the wall covers y = 298.5 .. 301.5
  const scene: Scene = { walls: [levelWall(500, 300, 400)] };
  for (const gap of [0, 1, 10, 15]) assert.equal(read(scene, noseAt(500, 301.5 + gap)), 'yellow', `${gap} mm`);
  for (const gap of [15.01, 16, 100]) assert.equal(read(scene, noseAt(500, 301.5 + gap)), 'none', `${gap} mm`);
  // another wall, another name: the sensor says what the game wrote on the wall
  assert.equal(read({ walls: [levelWall(500, 300, 400, { colorName: 'blue' })] }, noseAt(500, 310)), 'blue');
});

test('front colour sensor: the 15 mm are measured from the face of the sensor, whichever way robot and thing are turned', () => {
  for (const degrees of [0, 37, 90, 135, 180, 222.5, 270, 301]) {
    const heading = degrees * DEG;
    const ahead = { x: Math.sin(heading), y: -Math.cos(heading) };
    // the robot stands in the middle; the board is turned like the robot, `gap` mm in front of the sensor
    const boardAt = (gap: number): Body => {
      const far = FRONT + gap + 10; // (10 = half the depth of the board)
      return board(500 + ahead.x * far, 500 + ahead.y * far, { angle: heading });
    };
    const pose: Pose = { x: 500, y: 500, heading };
    assert.equal(read({ bodies: [boardAt(15)] }, pose), 'red', `${degrees} degrees, 15 mm`);
    assert.equal(read({ bodies: [boardAt(15.01)] }, pose), 'none', `${degrees} degrees, 15.01 mm`);
    assert.equal(read({ bodies: [boardAt(16)] }, pose), 'none', `${degrees} degrees, 16 mm`);
  }
});

test('front colour sensor: nothing in range reads "none"; a sensor that is switched off reads "none"', () => {
  assert.equal(read({}, { x: 500, y: 500, heading: 0 }), 'none');
  assert.equal(read({ bodies: [board(500, 300)] }, { x: 500, y: 500, heading: 0 }), 'none', 'the board is 85 mm away');
  // looking away from a board that touches the rear of the robot
  assert.equal(read({ bodies: [board(500, 300)] }, { x: 500, y: 310 - DEFAULT_ROBOT_CONFIG.chassisRear - 10, heading: 180 * DEG }), 'none');
  const off: RobotConfig = { ...ROBOT, frontColorSensor: { ...ROBOT.frontColorSensor, enabled: false } };
  assert.equal(read({ bodies: [board(500, 300)], config: off }, noseAt(500, 315)), 'none');
});

// =============================================================================================
// One line straight ahead; the nearest thing wins
// =============================================================================================

test('front colour sensor: it looks along one line - a thing right beside that line is not seen', () => {
  // the board covers x = 470 .. 530
  const scene: Scene = { bodies: [board(500, 300)] };
  assert.equal(read(scene, noseAt(471, 315)), 'red');
  assert.equal(read(scene, noseAt(529, 315)), 'red');
  assert.equal(read(scene, noseAt(469, 315)), 'none', 'the line passes 1 mm beside the board');
  assert.equal(read(scene, noseAt(531, 315)), 'none');
  // seen from its narrow end: 20 mm wide
  const fromTheRight = (y: number): Pose => ({ x: 530 + 10 + FRONT, y, heading: 270 * DEG });
  assert.equal(read(scene, fromTheRight(300)), 'red');
  assert.equal(read(scene, fromTheRight(291)), 'red');
  assert.equal(read(scene, fromTheRight(289)), 'none');
});

test('front colour sensor: the nearest thing wins - nothing is seen through a wall', () => {
  // a board right behind a 3 mm wall (wall y = 298.5 .. 301.5, board y = 278.5 .. 298.5), the robot's nose at the wall
  const wall = levelWall(500, 300, 400);
  const behind = board(500, 288.5);
  assert.equal(read({ walls: [wall], bodies: [behind] }, noseAt(500, 301.5)), 'yellow', 'nose at the wall');
  assert.equal(read({ walls: [wall], bodies: [behind] }, noseAt(500, 310)), 'yellow');
  // without the wall the same robot reads the board (3 mm and 11.5 mm away)
  assert.equal(read({ bodies: [behind] }, noseAt(500, 301.5)), 'red');
  assert.equal(read({ bodies: [behind] }, noseAt(500, 310)), 'red');
  // the board in front of the wall: the board is nearer
  assert.equal(read({ walls: [wall], bodies: [board(500, 311.5)] }, noseAt(500, 330)), 'red');
  // a thin red plate 3 mm in front of the wall, both within the 15 mm: the plate is nearer and wins,
  // seen from in front - and from behind the wall it is the wall that is seen
  const plate = board(500, 306.5, { l: 4 }); // y = 304.5 .. 308.5
  assert.equal(read({ walls: [wall], bodies: [plate] }, noseAt(500, 312)), 'red');
  assert.equal(read({ walls: [wall], bodies: [plate] }, { x: 500, y: 298.5 - 5 - FRONT, heading: 180 * DEG }), 'yellow');
  // a plate that leans against the wall, seen from in front: still the plate
  assert.equal(read({ walls: [wall], bodies: [board(500, 303.5, { l: 4 })] }, noseAt(500, 312)), 'red');
});

test('front colour sensor: a thing without a colour name reads "none" and still hides what is behind it', () => {
  const plainWall = levelWall(500, 300, 400, { colorName: undefined });
  assert.equal(read({ walls: [plainWall] }, noseAt(500, 310)), 'none');
  assert.equal(read({ walls: [plainWall], bodies: [board(500, 288.5)] }, noseAt(500, 301.5)), 'none', 'the red board behind the wall is not seen');
  // a grey box in front of the red board
  const box = makeBody({ id: 'box', x: 500, y: 315, w: 40, l: 10, h: 100 });
  assert.equal(read({ bodies: [board(500, 300), box] }, noseAt(500, 322)), 'none');
  assert.equal(read({ bodies: [box, board(500, 300)] }, noseAt(500, 322)), 'none', 'in whichever order the game lists them');
  // beside the box the board is seen
  assert.equal(read({ bodies: [board(500, 300), box] }, noseAt(525, 322)), 'red');
});

test('front colour sensor: past the end of a wall it sees what stands behind', () => {
  // the wall ends at x = 500; the board stands behind it and reaches 40 mm past its end
  const wall = levelWall(300, 300, 400);
  const scene: Scene = { walls: [wall], bodies: [board(510, 288.5)] };
  assert.equal(read(scene, noseAt(499, 305)), 'yellow', 'the line of sight meets the wall, 1 mm before its end');
  assert.equal(read(scene, noseAt(501, 305)), 'red', 'the line of sight passes 1 mm beside the end of the wall');
  assert.equal(read(scene, noseAt(539, 305)), 'red');
  assert.equal(read(scene, noseAt(541, 305)), 'none', 'past the board as well');
});

test('front colour sensor: a slanted wall is met where the line of sight meets it', () => {
  // a wall from bottom-left to top-right through (500, 300): straight above x = 500 it is at y = 300
  const slanted = levelWall(500, 300, 400, { angle: -45 * DEG });
  // (its near face is 1.5 mm x sqrt(2) = 2.1 mm below its middle line, measured along the line of sight)
  assert.equal(read({ walls: [slanted] }, noseAt(500, 302.2 + 14.9)), 'yellow');
  assert.equal(read({ walls: [slanted] }, noseAt(500, 302.2 + 15.1)), 'none');
  // 100 mm to the right the wall is 100 mm further up
  assert.equal(read({ walls: [slanted] }, noseAt(600, 202.2 + 14.9)), 'yellow');
  assert.equal(read({ walls: [slanted] }, noseAt(600, 302.2)), 'none');
});

// =============================================================================================
// Height
// =============================================================================================

test('front colour sensor: a thing that does not reach the height of the sensor is not seen', () => {
  const at = noseAt(500, 315);
  assert.equal(read({ bodies: [board(500, 300, { h: 60 })] }, at), 'red', 'exactly as high as the sensor');
  assert.equal(read({ bodies: [board(500, 300, { h: 59 })] }, at), 'none', 'the sensor looks over it');
  assert.equal(read({ bodies: [board(500, 300, { z: 61, h: 60 })] }, at), 'none', 'it stands on something: the sensor looks under it');
  assert.equal(read({ bodies: [board(500, 300, { z: 60, h: 60 })] }, at), 'red');
  // a low wall is looked over: the board behind it is seen
  const low = levelWall(500, 300, 400, { h: 59 });
  assert.equal(read({ walls: [low] }, noseAt(500, 310)), 'none');
  assert.equal(read({ walls: [low], bodies: [board(500, 288.5)] }, noseAt(500, 301.5)), 'red');
  assert.equal(read({ walls: [levelWall(500, 300, 400, { h: 60 })] }, noseAt(500, 310)), 'yellow');
  // a sensor that is mounted higher than the board sees the wall behind it instead
  const high: RobotConfig = { ...ROBOT, frontColorSensor: { ...ROBOT.frontColorSensor, mount: { forward: FRONT, height: 130 } } };
  assert.equal(read({ walls: [levelWall(500, 300, 400)], bodies: [board(500, 311.5)], config: high }, noseAt(500, 325)), 'none', 'the wall is 23.5 mm away');
  assert.equal(read({ walls: [levelWall(500, 300, 400)], bodies: [board(500, 311.5)], config: high }, noseAt(500, 316)), 'yellow');
});

test('front colour sensor: where the sensor sits is what the mount says, not the front of the chassis', () => {
  // a sensor 20 mm behind the front face sees 20 mm less far in front of the robot
  const back: RobotConfig = { ...ROBOT, frontColorSensor: { ...ROBOT.frontColorSensor, rangeMm: 30, mount: { forward: FRONT - 20, height: SENSOR_HEIGHT } } };
  const scene = (config: RobotConfig): Scene => ({ bodies: [board(500, 300)], config });
  assert.equal(read(scene(back), noseAt(500, 310 + 10)), 'red', '10 mm in front of the chassis = 30 mm from the sensor');
  assert.equal(read(scene(back), noseAt(500, 310 + 11)), 'none');
});

// =============================================================================================
// The two kinds of front colour sensor
// =============================================================================================

test('front colour sensor: without a mount it is the sensor at the claw, which sees only what the gripper can pick up', () => {
  // the standard robot of Fire Rescue: gripper, sensor at the claw, no mount
  assert.equal(DEFAULT_ROBOT_CONFIG.frontColorSensor.mount, undefined);
  const claw = DEFAULT_ROBOT_CONFIG;
  const reach = claw.gripper.gripForward;
  // a red thing that cannot be gripped, and a wall, right at the claw: the claw sensor sees neither
  const fixedThing = makeBody({ id: 'thing', x: 500, y: 300, w: 40, l: 40, h: 60, colorName: 'red' });
  const atClaw: Pose = { x: 500, y: 300 + reach, heading: 0 };
  assert.equal(read({ bodies: [fixedThing], config: claw }, atClaw), 'none');
  assert.equal(read({ walls: [levelWall(500, 300, 400)], config: claw }, atClaw), 'none');
  // the same thing, grippable: the claw sensor names it
  assert.equal(read({ bodies: [{ ...fixedThing, grippable: true }], config: claw }, atClaw), 'red');
  // and a robot with a mount does not ask whether a thing can be gripped
  assert.equal(read({ bodies: [fixedThing] }, noseAt(500, 325)), 'red');
  assert.equal(read({ bodies: [{ ...fixedThing, grippable: true }] }, noseAt(500, 325)), 'red');
});

// =============================================================================================
// While the robot drives
// =============================================================================================

test('front colour sensor: a program reads the same as the dashboard, and first reads "red" within one tick of the 15 mm', () => {
  const harness = scripted(function* (io) {
    io.setWheelRpm('left', 30);
    io.setWheelRpm('right', 30);
    yield* waitUntil(() => io.frontColor() === 'red');
    io.stopWheel('all');
    yield* forever();
  });
  const sim = createEngineSimulation(
    { game: makeGame([], [board(500, 300, { mass: 1000 })]), scenario: null, robotConfig: ROBOT, program: {}, startPose: noseAt(500, 310 + 60) },
    harness.factory,
  );
  sim.start();
  let firstRed = -1;
  let gapBefore = 60;
  for (let tick = 0; tick < 300 && firstRed < 0; tick++) {
    const before = sim.world.robot.pose.y - FRONT - 310;
    sim.step(1);
    const gap = sim.world.robot.pose.y - FRONT - 310;
    assert.equal(harness.io().frontColor(), sim.readSensors().frontColor, 'program and dashboard read the same');
    assert.equal(sim.readSensors().frontColor, gap <= RANGE + 1e-6 ? 'red' : 'none', `gap ${gap}`);
    if (gap <= RANGE + 1e-6) {
      firstRed = tick;
      gapBefore = before;
    }
  }
  assert.ok(firstRed > 0, 'it came into range');
  assert.ok(gapBefore > RANGE, `one tick earlier the board was still ${gapBefore} mm away`);
  // at 30 RPM the robot rolls about 1 mm per tick
  assert.ok(gapBefore - RANGE < 1.1, `${gapBefore}`);
  // the program stops the wheels in the tick after it read "red": the robot stands a little inside the 15 mm
  sim.step(100);
  const rest = sim.world.robot.pose.y - FRONT - 310;
  assert.ok(rest > 10 && rest <= RANGE, `it stopped ${rest} mm in front of the board`);
  assert.equal(sim.readSensors().frontColor, 'red');
});
