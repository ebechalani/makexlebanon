/**
 * The colour sensor of the Fire Chief robot and the red fire target.
 *
 * The sensor is fixed to the middle of the front face of the robot, 60 mm above the mat, and
 * looks straight ahead. It names the nearest thing that is 15 mm or less in front of it: the
 * target reads "red" from every side, a wall reads "yellow" - never "red" - and nothing in
 * range reads "none". (How the engine works it out is tested in core/engine-front-color.test.ts;
 * here it is the real field, the real walls and the real target. The two blocks of the sensor
 * are tested in vm/color-sensor.test.ts.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyColor } from '../core/engine-sensors';
import { DEG, makeRng, obbCorners } from '../core/geometry';
import { DEFAULT_ROBOT_CONFIG, robotShapesAt } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { Game, Pose, RGB, RobotConfig, SensorColor } from '../core/types';
import {
  FIELD_SIZE,
  FIRE_SPOTS,
  INNER_WALL_COUNT,
  ROOM_IDS,
  SENSOR_MAX_HEIGHT,
  TARGET_COLOR,
  TARGET_DEPTH,
  TARGET_HEIGHT,
  TARGET_WIDTH,
  WALL_COLOR_NAME,
  WALL_HEIGHT,
  WALL_POSITIONS,
  WALL_THICKNESS,
  WALL_WOOD,
  innerWall,
  outerWalls,
  targetPose,
} from './field';
import { TARGET_FILL, fireChiefGame, targetOf } from './game';
import { COLOR_SENSOR, COLOR_SENSOR_RANGE_MM, FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import { NAMED_MAZES, defaultScenario, openField, randomScenario, withWall, type FireChiefScenario } from './scenario';

// =============================================================================================
// Helpers
// =============================================================================================

const FRONT = FIRE_CHIEF_ROBOT.chassisFront;
const RANGE = COLOR_SENSOR_RANGE_MM;

/** '#rrggbb' -> the colour as numbers. */
function rgbOf(hex: string): RGB {
  assert.match(hex, /^#[0-9a-f]{6}$/i, hex);
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

/** What the colour sensor reads when the robot stands at `pose` (nothing drives). */
function read(scenario: FireChiefScenario, pose: Pose, game: Game<FireChiefScenario> = fireChiefGame, robotConfig?: RobotConfig): SensorColor | 'none' {
  const sim = createSimulation({ game, scenario, program: {}, startPose: pose, ...(robotConfig ? { robotConfig } : {}) });
  return sim.readSensors().frontColor;
}

/**
 * The pose of a robot whose sensor is `gap` mm from the point (x, y) and looks at it along
 * `heading` (so the robot stands on the other side of the point than it looks to).
 */
function lookingAt(x: number, y: number, heading: number, gap: number): Pose {
  const far = gap + FRONT;
  return { x: x - Math.sin(heading) * far, y: y + Math.cos(heading) * far, heading };
}

/** The game with the target put somewhere else, turned by `angle` - to look at it from all sides. */
function targetAt(x: number, y: number, angle: number): Game<FireChiefScenario> {
  return {
    ...fireChiefGame,
    createBodies: (s) => fireChiefGame.createBodies(s).map((body) => ({ ...body, x, y, angle, home: { ...body.home, x, y, angle } })),
  };
}

/** The middle of the front face of the target at one of its six places, and the heading of a robot that looks squarely at it. */
function frontFace(room: (typeof ROOM_IDS)[number], spot: (typeof FIRE_SPOTS)[number]): { x: number; y: number; heading: number } {
  const at = targetPose(room, spot);
  return { x: at.x + (TARGET_DEPTH / 2) * Math.sin(at.angle), y: at.y - (TARGET_DEPTH / 2) * Math.cos(at.angle), heading: at.angle + Math.PI };
}

// =============================================================================================
// The sensor and the target
// =============================================================================================

test('colour sensor: it sits in the middle of the front face of the robot, 60 mm above the mat, and sees 15 mm far', () => {
  assert.equal(FIRE_CHIEF_ROBOT.frontColorSensor, COLOR_SENSOR);
  assert.equal(COLOR_SENSOR.enabled, true);
  assert.equal(COLOR_SENSOR.rangeMm, 15);
  assert.equal(COLOR_SENSOR_RANGE_MM, 15);
  // on the front face of the chassis (a mount has no place to the side: it is always in the middle of the robot)
  assert.deepEqual(COLOR_SENSOR.mount, { forward: FIRE_CHIEF_ROBOT.chassisFront, height: 60 });
  // half the height of the target, under the 150 mm no sensor may be above, and under the top of the walls
  assert.equal(COLOR_SENSOR.mount!.height, TARGET_HEIGHT / 2);
  assert.ok(COLOR_SENSOR.mount!.height <= SENSOR_MAX_HEIGHT);
  assert.ok(COLOR_SENSOR.mount!.height <= WALL_HEIGHT);
  // the robot of Fire Rescue is what it was: its colour sensor is at the claw (no mount)
  assert.deepEqual(DEFAULT_ROBOT_CONFIG.frontColorSensor, { enabled: true, rangeMm: 35 });
  // the fan of the Fire Chief robot is where it was
  assert.equal(FIRE_CHIEF_ROBOT.fan!.port, 'M1');
});

test('target: it is red - to the sensor and on the screen - and the walls are not', () => {
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const [target] = fireChiefGame.createBodies(openField(room, spot));
      assert.equal(target.colorName, 'red');
      assert.equal(target.colorName, TARGET_COLOR);
      assert.equal(target.fill, TARGET_FILL);
      assert.equal(target.grippable, false);
    }
  }
  // what is drawn is what the sensor says: the simulator's own colour naming calls the drawn colour "red" ...
  assert.equal(classifyColor(rgbOf(TARGET_FILL)), 'red');
  // ... and it cannot be taken for the wood of the walls or for the blue robot
  assert.equal(classifyColor(WALL_WOOD), 'yellow');
  const wall = innerWall(WALL_POSITIONS[0]);
  assert.equal(wall.fill, '#c9a26b', 'the walls are drawn as they were');
  assert.deepEqual(rgbOf(wall.fill), WALL_WOOD);
  assert.notEqual(wall.fill, TARGET_FILL);
  const red = rgbOf(TARGET_FILL);
  assert.ok(red.r - red.g > 150 && red.r - red.b > 150, 'a clear red');
});

test('walls: every wall carries the colour name the simulator gives its wood - "yellow", never "red"', () => {
  assert.equal(WALL_COLOR_NAME, classifyColor(WALL_WOOD));
  assert.equal(WALL_COLOR_NAME, 'yellow');
  assert.notEqual(WALL_COLOR_NAME, 'red');
  for (const wall of outerWalls()) assert.equal(wall.colorName, 'yellow', wall.id);
  for (const position of WALL_POSITIONS) assert.equal(innerWall(position).colorName, 'yellow', position.label);
  // in every maze: the walls of the default maze, of the named mazes and of 300 random mazes
  const scenarios = [defaultScenario(), ...NAMED_MAZES.map((maze) => maze.scenario)];
  for (let seed = 1; seed <= 300; seed++) scenarios.push(randomScenario(makeRng(seed)));
  let walls = 0;
  for (const scenario of scenarios) {
    for (const wall of fireChiefGame.createWalls!(scenario)) {
      assert.notEqual(wall.colorName, 'red', wall.id);
      assert.equal(wall.colorName, WALL_COLOR_NAME, wall.id);
      walls++;
    }
    // the only red thing on the field is the target
    assert.deepEqual(
      fireChiefGame.createBodies(scenario).map((body) => body.colorName),
      ['red'],
    );
  }
  assert.ok(walls > 3000, `${walls} walls looked at`);
});

// =============================================================================================
// What it reads on the field
// =============================================================================================

test('colour sensor: the target at each of its six places reads "red" from 15 mm in front of its face, "none" from 16 mm', () => {
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const face = frontFace(room, spot);
      const scenario = openField(room, spot);
      for (const gap of [15, 10, 3]) assert.equal(read(scenario, lookingAt(face.x, face.y, face.heading, gap)), 'red', `${room} ${spot}, ${gap} mm`);
      for (const gap of [15.01, 16, 40]) assert.equal(read(scenario, lookingAt(face.x, face.y, face.heading, gap)), 'none', `${room} ${spot}, ${gap} mm`);
      // 20 mm to the side of the middle of the face it is still the face (it is 60 mm wide); 35 mm to the side it is not
      const along = { x: Math.cos(face.heading), y: Math.sin(face.heading) };
      assert.equal(read(scenario, lookingAt(face.x + along.x * 20, face.y + along.y * 20, face.heading, 10)), 'red', `${room} ${spot}, 20 mm to the side`);
      assert.notEqual(read(scenario, lookingAt(face.x + along.x * 35, face.y + along.y * 35, face.heading, 10)), 'red', `${room} ${spot}, 35 mm to the side`);
    }
  }
});

test('colour sensor: the target is red on every face - front, back and both ends read "red" at 15 mm and "none" at 16 mm', () => {
  // the target in the middle of the open field, facing up the mat and turned by 30 degrees
  for (const turned of [0, 30 * DEG]) {
    const game = targetAt(750, 750, turned);
    const scenario = openField();
    const faces: Array<[string, number, number]> = [
      // name, direction from the middle of the target to the face (as an angle), distance of the face from the middle
      ['front', turned, TARGET_DEPTH / 2],
      ['back', turned + Math.PI, TARGET_DEPTH / 2],
      ['right end', turned + Math.PI / 2, TARGET_WIDTH / 2],
      ['left end', turned - Math.PI / 2, TARGET_WIDTH / 2],
    ];
    for (const [name, direction, distance] of faces) {
      const x = 750 + Math.sin(direction) * distance;
      const y = 750 - Math.cos(direction) * distance;
      // the robot looks squarely at the face: against the direction the face looks to
      const heading = direction + Math.PI;
      assert.equal(read(scenario, lookingAt(x, y, heading, 15), game), 'red', `${name}, 15 mm`);
      assert.equal(read(scenario, lookingAt(x, y, heading, 1), game), 'red', `${name}, 1 mm`);
      assert.equal(read(scenario, lookingAt(x, y, heading, 16), game), 'none', `${name}, 16 mm`);
    }
  }
});

test('colour sensor: a wall reads "yellow" from 15 mm and "none" from 16 mm - every inner wall from both sides, and the four outer walls', () => {
  // every one of the 40 inner walls stands (not a maze to play in: only to look at each wall)
  const all: FireChiefScenario = { walls: new Array<boolean>(INNER_WALL_COUNT).fill(true), fireRoom: 'living', fireSpot: 'corner' };
  const half = WALL_THICKNESS / 2;
  for (const position of WALL_POSITIONS) {
    // an upright wall is looked at from its left and its right, a level wall from above and from below
    const headings = position.direction === 'upright' ? [90 * DEG, 270 * DEG] : [0, 180 * DEG];
    for (const heading of headings) {
      // the point of the face the robot looks at: the middle of the wall, half a thickness towards the robot
      const x = position.x - Math.sin(heading) * half;
      const y = position.y + Math.cos(heading) * half;
      assert.equal(read(all, lookingAt(x, y, heading, 15)), 'yellow', `${position.label} from ${Math.round(heading / DEG)} degrees, 15 mm`);
      assert.equal(read(all, lookingAt(x, y, heading, 0)), 'yellow', `${position.label}, nose at the wall`);
      assert.equal(read(all, lookingAt(x, y, heading, 16)), 'none', `${position.label} from ${Math.round(heading / DEG)} degrees, 16 mm`);
    }
  }
  // the outer walls: their inner face is the edge of the mat
  const open = openField('living', 'corner');
  const edges: Array<[string, number, number, number]> = [
    ['top', 750, 0, 0],
    ['right', FIELD_SIZE, 750, 90 * DEG],
    ['bottom', 750, FIELD_SIZE, 180 * DEG],
    ['left', 0, 750, 270 * DEG],
  ];
  for (const [name, x, y, heading] of edges) {
    assert.equal(read(open, lookingAt(x, y, heading, 15)), 'yellow', `${name} wall, 15 mm`);
    assert.equal(read(open, lookingAt(x, y, heading, 16)), 'none', `${name} wall, 16 mm`);
  }
});

test('colour sensor: the target right behind a 3 mm wall is not seen - with the nose at the wall the robot reads the wall', () => {
  // the wall between C3 and C4 (y = 898.5 .. 901.5, x = 598.5 .. 901.5); the target stands right above it, its back to the wall
  const wallIndex = WALL_POSITIONS.findIndex((position) => position.label === 'C3-C4');
  assert.ok(wallIndex >= 0);
  const withWallStanding = withWall(openField(), wallIndex, true);
  const game = targetAt(750, 900 - WALL_THICKNESS / 2 - TARGET_DEPTH / 2, 0);
  const noseAtWall = lookingAt(750, 900 + WALL_THICKNESS / 2, 0, 0);
  assert.equal(read(withWallStanding, noseAtWall, game), 'yellow');
  assert.equal(read(withWallStanding, lookingAt(750, 900 + WALL_THICKNESS / 2, 0, 10), game), 'yellow');
  // the same robot, the same target, no wall: the target is 3 mm in front of the nose
  assert.equal(read(openField(), noseAtWall, game), 'red');
});

test('colour sensor: past the end of a wall it sees the target that stands behind', () => {
  // the wall between C3 and C4 ends at x = 901.5; the target stands above it and reaches 43.5 mm past its end
  const wallIndex = WALL_POSITIONS.findIndex((position) => position.label === 'C3-C4');
  const scenario = withWall(openField(), wallIndex, true);
  const game = targetAt(915, 900 - WALL_THICKNESS / 2 - TARGET_DEPTH / 2, 0);
  const from = (x: number): Pose => lookingAt(x, 900 + WALL_THICKNESS / 2, 0, 4);
  assert.equal(read(scenario, from(900), game), 'yellow', 'the line of sight meets the wall, 1.5 mm before its end');
  assert.equal(read(scenario, from(903), game), 'red', 'the line of sight passes 1.5 mm beside the end of the wall');
  assert.equal(read(scenario, from(940), game), 'red');
  assert.equal(read(scenario, from(950), game), 'none', 'past the target as well');
});

test('colour sensor: a thing that is lower than the sensor is not seen', () => {
  const face = frontFace('living', 'back');
  const scenario = openField('living', 'back');
  const pose = lookingAt(face.x, face.y, face.heading, 10);
  assert.equal(read(scenario, pose), 'red');
  // the same sensor, mounted just above the top of the 120 mm target: it looks over the target and sees nothing
  // within 15 mm (the wall behind the target is 30 mm away)
  const above: RobotConfig = { ...FIRE_CHIEF_ROBOT, frontColorSensor: { ...COLOR_SENSOR, mount: { ...COLOR_SENSOR.mount!, height: TARGET_HEIGHT + 1 } } };
  assert.equal(read(scenario, pose, fireChiefGame, above), 'none');
  // ... and with the nose at the target it sees the wall behind it, over the target (20 mm away: out of range; from 15 mm: yellow)
  const longer: RobotConfig = { ...above, frontColorSensor: { ...above.frontColorSensor, rangeMm: 25 } };
  assert.equal(read(scenario, lookingAt(face.x, face.y, face.heading, 0), fireChiefGame, longer), 'yellow');
  // mounted above the walls it sees nothing at all
  const overTheWalls: RobotConfig = { ...FIRE_CHIEF_ROBOT, frontColorSensor: { ...COLOR_SENSOR, mount: { ...COLOR_SENSOR.mount!, height: WALL_HEIGHT + 1 } } };
  assert.equal(read(scenario, lookingAt(250, 0, 0, 5), fireChiefGame, overTheWalls), 'none');
  assert.equal(read(scenario, lookingAt(250, 0, 0, 5)), 'yellow');
});

test('colour sensor: it reads "none" where nothing is close - at the start of every named maze and in the middle of every cell', () => {
  for (const scenario of [defaultScenario(), ...NAMED_MAZES.map((maze) => maze.scenario)]) {
    assert.equal(read(scenario, START_POSE), 'none');
  }
  // every wall stands: in the middle of a cell the robot is 45 mm from the wall in front of it, whichever way it looks
  const all: FireChiefScenario = { walls: new Array<boolean>(INNER_WALL_COUNT).fill(true), fireRoom: 'bedroom', fireSpot: 'side' };
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      for (const degrees of [0, 90, 180, 270]) {
        assert.equal(read(all, { x: col * 300 + 150, y: row * 300 + 150, heading: degrees * DEG }), 'none', `cell ${col},${row} looking ${degrees}`);
      }
    }
  }
});

// =============================================================================================
// What the places of the target mean for the sensor
// =============================================================================================

test('colour sensor and the corner place: squarely in front of the target the robot can come no nearer than 15 mm - the very edge of what the sensor sees', () => {
  // In a corner the target stands turned by 45 degrees. A robot that drives at it along the
  // diagonal of the room is stopped by the two walls: its two front corners meet them when its
  // nose is 15 mm from the target. (With the target at "back" or "side" the nose can touch it.)
  for (const room of ROOM_IDS) {
    const face = frontFace(room, 'corner');
    const scenario = openField(room, 'corner');
    const fits = (gap: number): boolean =>
      obbCorners(robotShapesAt(FIRE_CHIEF_ROBOT, lookingAt(face.x, face.y, face.heading, gap))[0]).every(
        (corner) => corner.x >= -1e-6 && corner.y >= -1e-6 && corner.x <= FIELD_SIZE + 1e-6 && corner.y <= FIELD_SIZE + 1e-6,
      );
    assert.equal(fits(15), true, `${room}: at 15 mm the robot is just inside the walls`);
    assert.equal(fits(14.9), false, `${room}: at 14.9 mm its front corners would be in the walls`);
    assert.equal(read(scenario, lookingAt(face.x, face.y, face.heading, 15)), 'red');
    // the sensor sees 15 mm far: one millimetre less, and this place could not be read squarely at all
    assert.equal(COLOR_SENSOR_RANGE_MM, 15);
    const shorter: RobotConfig = { ...FIRE_CHIEF_ROBOT, frontColorSensor: { ...COLOR_SENSOR, rangeMm: 14 } };
    assert.equal(read(scenario, lookingAt(face.x, face.y, face.heading, 15), fireChiefGame, shorter), 'none');
  }
  // at the two other places the robot can drive up to the target
  for (const room of ROOM_IDS) {
    for (const spot of ['back', 'side'] as const) {
      const face = frontFace(room, spot);
      const corners = obbCorners(robotShapesAt(FIRE_CHIEF_ROBOT, lookingAt(face.x, face.y, face.heading, 0))[0]);
      assert.ok(corners.every((corner) => corner.x >= 0 && corner.y >= 0 && corner.x <= FIELD_SIZE && corner.y <= FIELD_SIZE), `${room} ${spot}`);
    }
  }
});

test('colour sensor: reading it changes nothing - the target of a match stays where it stands and the referee gives no point for it', () => {
  const face = frontFace('living', 'back');
  const sim = createSimulation({ game: fireChiefGame, scenario: openField('living', 'back'), program: {}, startPose: lookingAt(face.x, face.y, face.heading, 10) });
  sim.start();
  for (let i = 0; i < 50; i++) {
    sim.step(1);
    assert.equal(sim.readSensors().frontColor, 'red');
  }
  const target = targetOf(sim.world)!;
  assert.deepEqual({ x: target.x, y: target.y, angle: target.angle }, targetPose('living', 'back'));
  // (the robot was put into the room by the test; it has not driven, blown or earned anything)
  const report = sim.score();
  assert.equal(report.lines.find((line) => line.id === 'fan-start')!.points, 0);
  assert.equal(report.lines.find((line) => line.id === 'fan-complete')!.points, 0);
});
