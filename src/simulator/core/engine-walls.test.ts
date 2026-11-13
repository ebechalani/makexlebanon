/**
 * Fixed walls (a maze): the robot and what it pushes are stopped by them, also by a wall that is
 * only 3 mm thick and also at full speed; the robot slides along them; the ultrasonic sensor
 * sees them.
 *
 * The tests use a plain white 1000 x 1000 mm mat with only the walls and bodies a test asks
 * for, and a robot without gripper. A tiny fake VM runs a script (see ./test-helpers.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { DEG, makeRng, obbCorners, obbOverlap, rayOBB, type OBB } from './geometry';
import type { RobotIO } from './io';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { drive, forever, makeBody, near, scripted, sleep, turn, waitUntil, type Script } from './test-helpers';
import type { Body, FixedWall, Game, MatVector, Pose, RobotConfig, SimEvent, Simulation } from './types';
import { wallBetween, wallFootprint } from './walls';

// =============================================================================================
// Helpers
// =============================================================================================

/** The standard robot without its gripper and front colour sensor: one box of 175 x 130 mm. */
const BARE: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
};
const FRONT = BARE.chassisFront;
const REAR = BARE.chassisRear;
const HALF_WIDTH = BARE.chassisWidth / 2;
/** How far a part of the robot may be inside a wall between two ticks (the engine settles to 0.02 mm). */
const SKIN = 0.05;

const MAT: MatVector = {
  width: 1000,
  height: 1000,
  background: { r: 255, g: 255, b: 255 },
  outside: { r: 120, g: 120, b: 120 },
  layers: [],
};

/** A wall along x (left-right) with its middle at (x, y). */
const levelWall = (id: string, x: number, y: number, length: number, thickness = 3, height = 150): FixedWall => ({
  id: `wall:${id}`,
  label: id,
  x,
  y,
  angle: 0,
  w: length,
  l: thickness,
  h: height,
  fill: '#999',
});

/** A wall along y (up-down) with its middle at (x, y). */
const uprightWall = (id: string, x: number, y: number, length: number, thickness = 3, height = 150): FixedWall => ({
  id: `wall:${id}`,
  label: id,
  x,
  y,
  angle: 0,
  w: thickness,
  l: length,
  h: height,
  fill: '#999',
});

/** Four walls around a square room whose free inside is `size` mm wide, centred on (cx, cy). */
function room(cx: number, cy: number, size: number, thickness = 3): FixedWall[] {
  const half = size / 2 + thickness / 2;
  const long = size + 2 * thickness;
  return [
    levelWall('top', cx, cy - half, long, thickness),
    levelWall('bottom', cx, cy + half, long, thickness),
    uprightWall('left', cx - half, cy, long, thickness),
    uprightWall('right', cx + half, cy, long, thickness),
  ];
}

function makeGame(walls: FixedWall[] | null, bodies: Body[] = [], duration = 180): Game<null> {
  const game: Game<null> = {
    id: 'walls-test',
    title: 'Walls test',
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
  if (walls) game.createWalls = () => walls.map((w) => ({ ...w }));
  return game;
}

interface SetupOptions {
  walls?: FixedWall[] | null;
  bodies?: Body[];
  startPose?: Pose;
  config?: RobotConfig;
  duration?: number;
}

function setup(script: Script, o: SetupOptions = {}) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    {
      game: makeGame(o.walls === undefined ? [] : o.walls, o.bodies, o.duration),
      scenario: null,
      robotConfig: o.config ?? BARE,
      program: {},
      startPose: o.startPose,
    },
    harness.factory,
  );
  const body = (id: string): Body => {
    const b = sim.world.bodies.find((x) => x.id === id);
    assert.ok(b, `body ${id} exists`);
    return b;
  };
  return { sim, harness, body, robot: sim.world.robot };
}

/** The deepest overlap (mm) of any part of the robot, or of any body, with any wall right now. */
function deepestInWall(sim: Simulation<null>): number {
  const boxes: OBB[] = [...sim.robotShapes()];
  for (const b of sim.world.bodies) boxes.push({ x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle });
  let deepest = 0;
  for (const wall of sim.world.walls ?? []) {
    for (const box of boxes) {
      const hit = obbOverlap(wallFootprint(wall), box);
      if (hit && hit.depth > deepest) deepest = hit.depth;
    }
  }
  return deepest;
}

/** Run tick by tick; `check` sees the world after every tick. Returns all events. */
function runWatching(sim: Simulation<null>, ticks: number, check: (tick: number) => void): SimEvent[] {
  const events: SimEvent[] = [];
  sim.start();
  for (let i = 0; i < ticks && sim.status === 'running'; i++) {
    sim.step(1);
    check(sim.world.tick);
    events.push(...sim.drainEvents());
  }
  events.push(...sim.drainEvents());
  return events;
}

const fullSpeed = (direction: 1 | -1 = 1): Script =>
  function* (io: RobotIO) {
    io.setWheelRpm('left', direction * io.config.maxRpm);
    io.setWheelRpm('right', direction * io.config.maxRpm);
    yield* forever();
  };

// =============================================================================================
// Stopped by a wall
// =============================================================================================

test('walls: a game without createWalls has no walls, a game with walls shows them in the world', () => {
  const none = setup(function* () {}, { walls: null });
  assert.deepEqual(none.sim.world.walls, []);
  const wall = levelWall('a', 500, 300, 800);
  const some = setup(function* () {}, { walls: [wall] });
  assert.deepEqual(some.sim.world.walls, [wall]);
});

test('walls: at full speed the robot moves 6 mm per tick - more than a 3 mm wall is thick', () => {
  const { sim, robot } = setup(fullSpeed(), { walls: [], startPose: { x: 500, y: 900, heading: 0 } });
  sim.start();
  sim.step(60);
  const before = robot.pose.y;
  sim.step(1);
  near(before - robot.pose.y, 6.03, 0.01, 'mm per tick at 180 RPM');
});

for (const thickness of [12, 3, 1]) {
  test(`walls: driving into a ${thickness} mm wall at full speed stops the robot at the wall`, () => {
    const wall = levelWall('ahead', 500, 300, 800, thickness);
    const face = 300 + thickness / 2;
    const { sim, robot } = setup(fullSpeed(), { walls: [wall], startPose: { x: 500, y: 700, heading: 0 } });
    let touchingTicks = 0;
    const events = runWatching(sim, 300, () => {
      assert.ok(robot.pose.y - FRONT >= face - SKIN, `front at ${robot.pose.y - FRONT}, wall face at ${face}`);
      if (robot.touching) touchingTicks++;
    });
    near(robot.pose.y - FRONT, face, SKIN, 'the front of the robot is at the wall');
    assert.equal(robot.pose.x, 500);
    assert.ok(touchingTicks > 200, `touching for ${touchingTicks} ticks while it pushes against the wall`);
    assert.equal(robot.touching, true);
    // the wheels keep turning (they slip): the encoders count on, the gyro does not turn
    assert.ok(robot.left.angleDeg > 2000);
    assert.equal(robot.yawDeg, 0);
    // one bump is reported, with the id of the wall, however long the robot pushes
    const bumps = events.filter((e) => e.type === 'bump');
    assert.deepEqual(
      bumps.map((e) => (e.type === 'bump' ? e.bodyId : '')),
      ['wall:ahead'],
    );
  });
}

test('walls: reversing into a wall at full speed stops the robot at the wall', () => {
  const wall = levelWall('behind', 500, 800, 800);
  const { sim, robot } = setup(fullSpeed(-1), { walls: [wall], startPose: { x: 500, y: 400, heading: 0 } });
  runWatching(sim, 300, () => {
    assert.ok(robot.pose.y + REAR <= 798.5 + SKIN, `rear at ${robot.pose.y + REAR}`);
  });
  near(robot.pose.y + REAR, 798.5, SKIN, 'the rear of the robot is at the wall');
  assert.equal(robot.touching, true);
});

test('walls: a robot three times as fast as the mBot2 does not get through a 3 mm or a 1 mm wall either', () => {
  const fast: RobotConfig = { ...BARE, maxRpm: 540, rpmPerSecond: 5400 };
  for (const thickness of [3, 1]) {
    for (const direction of [1, -1] as const) {
      const walls = room(500, 500, 600, thickness);
      const { sim, robot } = setup(fullSpeed(direction), { walls, config: fast });
      runWatching(sim, 200, () => {
        for (const c of obbCorners(sim.robotShapes()[0])) {
          assert.ok(c.y >= 200 - SKIN && c.y <= 800 + SKIN, `corner at y ${c.y} (wall ${thickness} mm)`);
        }
      });
      assert.equal(robot.touching, true);
    }
  }
});

test('walls: from the middle of a walled room no direction leads out, at full speed', () => {
  const walls = room(500, 500, 600);
  for (let degrees = 0; degrees < 360; degrees += 10) {
    const { sim, robot } = setup(fullSpeed(), { walls, startPose: { x: 500, y: 500, heading: degrees * DEG } });
    runWatching(sim, 250, () => {
      for (const c of obbCorners(sim.robotShapes()[0])) {
        assert.ok(
          c.x >= 200 - SKIN && c.x <= 800 + SKIN && c.y >= 200 - SKIN && c.y <= 800 + SKIN,
          `heading ${degrees}: corner at ${c.x}, ${c.y}`,
        );
      }
    });
    assert.ok(Math.hypot(robot.pose.x - 500, robot.pose.y - 500) > 150, `heading ${degrees}: it did drive to a wall`);
    assert.ok(deepestInWall(sim) <= SKIN);
  }
});

test('walls: a wall may stand at any angle - no direction leads out of a room with three or six slanted walls', () => {
  for (const sides of [3, 6]) {
    // a room whose walls are all 250 mm from its middle (500, 500); wall k is turned by `facing`
    const inside = 250;
    const walls: FixedWall[] = [];
    for (let k = 0; k < sides; k++) {
      const facing = 20 * DEG + (k * 2 * Math.PI) / sides; // the direction from the middle to the wall
      const away = inside + 1.5;
      walls.push({
        id: `wall:s${k}`,
        label: `s${k}`,
        x: 500 + away * Math.sin(facing),
        y: 500 - away * Math.cos(facing),
        angle: facing,
        // (turned by `facing`, the wall is thin along that direction and long across it)
        w: 2 * inside * Math.tan(Math.PI / sides) + 12,
        l: 3,
        h: 150,
        fill: '#999',
      });
    }
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const { sim, robot } = setup(fullSpeed(), { walls, startPose: { x: 500, y: 500, heading: degrees * DEG } });
      runWatching(sim, 250, () => {
        for (const c of obbCorners(sim.robotShapes()[0])) {
          for (const wall of walls) {
            // how far the corner is from the middle, measured towards this wall
            const towards = (c.x - 500) * Math.sin(wall.angle) - (c.y - 500) * Math.cos(wall.angle);
            assert.ok(towards <= inside + SKIN, `${sides} walls, heading ${degrees}: corner ${towards - inside} mm behind ${wall.id}`);
          }
        }
      });
      assert.equal(robot.touching, true, `${sides} walls, heading ${degrees}: it drove to a wall`);
      assert.ok(deepestInWall(sim) <= SKIN);
    }
  }
});

test('walls: turning and driving wildly inside one 297 mm cell never puts a corner through a wall', () => {
  // the free inside of a maze cell: 300 mm minus two half walls
  const walls = room(500, 500, 297);
  for (const seed of [1, 2, 3, 4, 5]) {
    const rng = makeRng(seed);
    const { sim, robot } = setup(
      function* (io) {
        for (;;) {
          const spin = rng() < 0.5;
          const left = (rng() * 2 - 1) * io.config.maxRpm;
          io.setWheelRpm('left', spin ? io.config.maxRpm : left);
          io.setWheelRpm('right', spin ? -io.config.maxRpm : (rng() * 2 - 1) * io.config.maxRpm);
          yield* sleep(10 + Math.floor(rng() * 80));
        }
      },
      { walls },
    );
    let turned = 0;
    let lastYaw = 0;
    runWatching(sim, 3000, () => {
      for (const c of obbCorners(sim.robotShapes()[0])) {
        assert.ok(
          Math.abs(c.x - 500) <= 148.5 + SKIN && Math.abs(c.y - 500) <= 148.5 + SKIN,
          `seed ${seed}: corner at ${c.x}, ${c.y}`,
        );
      }
      turned += Math.abs(robot.yawDeg - lastYaw);
      lastYaw = robot.yawDeg;
    });
    // ... and it was not simply stuck: it kept turning
    assert.ok(turned > 1500, `seed ${seed}: turned ${turned} degrees in 30 s`);
  }
});

test('walls: turning on the spot in the middle of a 297 mm cell touches nothing', () => {
  const { sim, robot } = setup(
    function* (io) {
      yield* turn(io, 360, 120);
      yield* turn(io, -360, 120);
    },
    { walls: room(500, 500, 297) },
  );
  let touched = false;
  const events = runWatching(sim, 2000, () => {
    if (robot.touching) touched = true;
  });
  assert.equal(sim.finishReason, 'program-ended');
  assert.equal(touched, false);
  assert.equal(events.filter((e) => e.type === 'bump').length, 0);
  near(robot.pose.x, 500, 1e-6);
  near(robot.pose.y, 500, 1e-6);
});

// =============================================================================================
// Sliding, corners, wall ends
// =============================================================================================

test('walls: a robot that hits a wall at an angle slides along it', () => {
  // the wall is above the robot; the robot drives up and to the right, 60 degrees from "up"
  const wall = levelWall('long', 500, 200, 1000);
  const { sim, robot } = setup(fullSpeed(), { walls: [wall], startPose: { x: 200, y: 400, heading: 60 * DEG } });
  const xs: number[] = [];
  const events = runWatching(sim, 150, () => {
    xs.push(robot.pose.x);
    for (const c of obbCorners(sim.robotShapes()[0])) assert.ok(c.y >= 201.5 - SKIN, `corner at y ${c.y}`);
  });
  // the front left corner is on the wall and the robot keeps moving to the right along it
  const top = Math.min(...obbCorners(sim.robotShapes()[0]).map((c) => c.y));
  near(top, 201.5, SKIN, 'a corner of the robot is on the wall');
  assert.ok(xs[149] - xs[100] > 200, `it moved ${xs[149] - xs[100]} mm along the wall in half a second`);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1] - 1e-9, 'never backwards');
  // nothing turns the robot: it keeps its heading, and the gyro agrees
  near(robot.pose.heading, 60 * DEG, 1e-9);
  assert.equal(robot.yawDeg, 0);
  assert.equal(robot.touching, true);
  // sliding along one wall is one bump
  assert.equal(events.filter((e) => e.type === 'bump').length, 1);
});

test('walls are perfectly smooth: a turn right beside a wall always completes, and pushes the robot away from the wall', () => {
  // (A decision of the engine, written down in its header: a real robot would catch on the
  // wall here. The examples tell students to keep away from the walls when they turn.)
  const wall = uprightWall('beside', 300, 500, 800); // its right face is at x = 301.5
  for (const rpm of [30, 90, 180]) {
    const start: Pose = { x: 301.5 + 1 + HALF_WIDTH, y: 500, heading: 0 }; // its left side 1 mm from the wall
    const { sim, robot } = setup(
      function* (io) {
        yield* turn(io, -90, rpm);
      },
      { walls: [wall], startPose: start },
    );
    let touched = false;
    runWatching(sim, 2000, (tick) => {
      if (robot.touching) touched = true;
      if (tick > 1) assert.ok(deepestInWall(sim) <= SKIN, `tick ${tick}`);
    });
    assert.equal(sim.finishReason, 'program-ended');
    assert.ok(touched, `${rpm} RPM: its corner met the wall`);
    near(robot.yawDeg, -90, 0.01, `${rpm} RPM: the gyro has seen the whole quarter turn`);
    near(robot.pose.heading, -90 * DEG, 0.001);
    // its front corner is 123.5 mm from the point it turns around: while that corner swept past
    // the wall, the wall pushed the robot away until the corner had room (123.5 - 65 - 1 = 57.5 mm)
    near(robot.pose.x - start.x, Math.hypot(FRONT, HALF_WIDTH) - HALF_WIDTH - 1, 0.1, `${rpm} RPM: pushed away from the wall`);
    near(robot.pose.y, start.y, 0.1, `${rpm} RPM: not along it`);
  }
});

test('walls: sliding along a wall made of several panels does not catch on the joints', () => {
  // ten 100 mm panels in a row, like the panels of a maze
  const panels: FixedWall[] = [];
  for (let k = 0; k < 10; k++) panels.push(levelWall(`p${k}`, 50 + 100 * k, 200, 103));
  const one = setup(fullSpeed(), { walls: [levelWall('long', 500, 200, 1000)], startPose: { x: 200, y: 400, heading: 60 * DEG } });
  const many = setup(fullSpeed(), { walls: panels, startPose: { x: 200, y: 400, heading: 60 * DEG } });
  one.sim.start();
  many.sim.start();
  one.sim.step(150);
  many.sim.step(150);
  near(many.robot.pose.x, one.robot.pose.x, 1e-6, 'same place as along one long wall');
  near(many.robot.pose.y, one.robot.pose.y, 1e-6);
});

test('walls: driving into a corner of two walls ends in the corner, and the robot can back out again', () => {
  const walls = [levelWall('top', 500, 200, 1000), uprightWall('side', 800, 500, 1000)];
  const { sim, robot } = setup(
    function* (io) {
      io.setWheelRpm('left', io.config.maxRpm);
      io.setWheelRpm('right', io.config.maxRpm);
      yield* sleep(300);
      io.stopWheel('all');
      yield* sleep(30);
      yield* drive(io, -100, 90);
    },
    { walls, startPose: { x: 500, y: 500, heading: 45 * DEG } },
  );
  const inCorner = { x: 0, y: 0, top: 0, right: 0 };
  runWatching(sim, 1000, (tick) => {
    const corners = obbCorners(sim.robotShapes()[0]);
    for (const c of corners) {
      assert.ok(c.y >= 201.5 - SKIN && c.x <= 798.5 + SKIN, `corner at ${c.x}, ${c.y}`);
    }
    if (tick === 300) {
      inCorner.x = robot.pose.x;
      inCorner.y = robot.pose.y;
      inCorner.top = Math.min(...corners.map((c) => c.y));
      inCorner.right = Math.max(...corners.map((c) => c.x));
    }
  });
  assert.equal(sim.finishReason, 'program-ended');
  // in the corner: the robot touches both walls
  near(inCorner.top, 201.5, SKIN, 'touches the top wall');
  near(inCorner.right, 798.5, SKIN, 'touches the side wall');
  // ... and it backed out by 100 mm along its own heading
  near(Math.hypot(robot.pose.x - inCorner.x, robot.pose.y - inCorner.y), 100, 0.01, 'backed out');
  assert.equal(robot.touching, false);
});

test('walls: the free end of a wall stops a robot that drives straight at it', () => {
  // an upright wall whose lower end is at y = 400; the robot comes from below, centred on it
  const wall = uprightWall('post', 500, 250, 300);
  const { sim, robot } = setup(fullSpeed(), { walls: [wall], startPose: { x: 500, y: 700, heading: 0 } });
  runWatching(sim, 200, () => assert.ok(deepestInWall(sim) <= SKIN));
  near(robot.pose.y - FRONT, 400, SKIN, 'the front is at the end of the wall');
  near(robot.pose.x, 500, 1e-9);
});

test('walls: a robot that clips the end of a wall with a corner is pushed aside, not through', () => {
  const wall = uprightWall('post', 500, 250, 300);
  // its left side is 1 mm left of the right face of the wall: it clips the wall by 1 mm
  const { sim, robot } = setup(fullSpeed(), { walls: [wall], startPose: { x: 501.5 + HALF_WIDTH - 1, y: 700, heading: 0 } });
  runWatching(sim, 150, () => assert.ok(deepestInWall(sim) <= SKIN));
  // it went on, beside the wall
  assert.ok(robot.pose.y < 300, `it passed the end of the wall (y ${robot.pose.y})`);
  assert.ok(robot.pose.x - HALF_WIDTH >= 501.5 - SKIN, 'its left side is beside the wall');
});

test('walls: a low wall stops the robot too (the chassis starts at the mat)', () => {
  const wall = levelWall('kerb', 500, 300, 800, 3, 10);
  const { sim, robot } = setup(fullSpeed(), { walls: [wall], startPose: { x: 500, y: 700, heading: 0 } });
  sim.start();
  sim.step(300);
  near(robot.pose.y - FRONT, 301.5, SKIN);
});

// =============================================================================================
// Bodies and walls
// =============================================================================================

test('walls: a box pushed against a wall stops there, and stops the robot behind it', () => {
  const wall = levelWall('ahead', 500, 200, 800);
  const box = makeBody({ id: 'box', x: 500, y: 400, w: 60, l: 20, h: 120 });
  const { sim, robot, body } = setup(fullSpeed(), { walls: [wall], bodies: [box], startPose: { x: 500, y: 700, heading: 0 } });
  runWatching(sim, 300, () => {
    assert.ok(body('box').y - 10 >= 201.5 - SKIN, `box at ${body('box').y}`);
    assert.ok(deepestInWall(sim) <= SKIN);
  });
  near(body('box').y, 201.5 + 10, SKIN, 'the box stands against the wall');
  near(robot.pose.y - FRONT, 201.5 + 20, SKIN, 'the robot stands against the box');
  assert.equal(robot.touching, true);
});

test('walls: a box pushed into a corner of two walls cannot be pushed through either of them', () => {
  const walls = [levelWall('top', 500, 200, 1000), uprightWall('side', 800, 500, 1000)];
  const box = makeBody({ id: 'box', x: 700, y: 300, w: 40, l: 40, h: 60 });
  const { sim, body } = setup(fullSpeed(), { walls, bodies: [box], startPose: { x: 500, y: 500, heading: 45 * DEG } });
  runWatching(sim, 300, () => assert.ok(deepestInWall(sim) <= SKIN, `in a wall by ${deepestInWall(sim)}`));
  const b = body('box');
  assert.ok(b.x + 20 <= 798.5 + SKIN && b.y - 20 >= 201.5 - SKIN, `box at ${b.x}, ${b.y}`);
  // the robot does not overlap the box either
  const hit = obbOverlap(sim.robotShapes()[0], { x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle });
  assert.ok(!hit || hit.depth <= SKIN);
});

test('walls: a body that starts inside a wall is moved out of it before anything else happens', () => {
  const wall = levelWall('ahead', 500, 200, 800);
  const box = makeBody({ id: 'box', x: 500, y: 209, w: 60, l: 20, h: 120 }); // 2.5 mm inside the wall
  const { sim, body } = setup(function* () {
    yield* sleep(5);
  }, { walls: [wall], bodies: [box] });
  sim.start();
  sim.step(2);
  near(body('box').y, 211.5, 1e-6);
});

test('walls: a robot that starts a little inside a wall is moved out of it on the first tick, also when it stands still', () => {
  const wall = levelWall('ahead', 500, 300, 800); // lower face at y = 301.5
  const inWall: Pose = { x: 500, y: 301.5 + FRONT - 1, heading: 0 }; // its front is 1 mm inside the wall
  // a game with walls and no bodies, a robot that never drives
  const standing = setup(function* () {
    yield* forever();
  }, { walls: [wall], startPose: inWall });
  near(deepestInWall(standing.sim), 1, 1e-9);
  standing.sim.start();
  standing.sim.step(1);
  assert.ok(deepestInWall(standing.sim) <= SKIN);
  near(standing.robot.pose.y - FRONT, 301.5, SKIN);
  // the same when the team puts the robot there before the start ...
  const placed = setup(function* () {
    yield* forever();
  }, { walls: [wall] });
  assert.equal(placed.sim.setStartPose(inWall), true);
  placed.sim.start();
  placed.sim.step(1);
  assert.ok(deepestInWall(placed.sim) <= SKIN);
  // ... and after a restart, which puts the robot back on that start position
  placed.sim.step(50);
  placed.sim.restart();
  assert.ok(deepestInWall(placed.sim) <= SKIN);
  // a robot that drives off at once comes out of the wall just the same
  const driving = setup(fullSpeed(-1), { walls: [wall], startPose: inWall });
  runWatching(driving.sim, 100, (tick) => {
    if (tick > 1) assert.ok(deepestInWall(driving.sim) <= SKIN, `tick ${tick}: ${deepestInWall(driving.sim)} mm inside the wall`);
  });
  assert.ok(driving.robot.pose.y > inWall.y + 300, 'it drove away backwards');
});

test('walls: a robot that is put deep into a wall is moved out of it at the start signal - and the log says so', () => {
  const wall = levelWall('ahead', 500, 300, 800); // lower face at y = 301.5
  const warnings = (sim: Simulation<null>): string[] =>
    sim.drainEvents().flatMap((e) => (e.type === 'log' && e.level === 'warn' ? [e.text] : []));
  for (const deep of [1, 4.9, 10, 36]) {
    const pose: Pose = { x: 500, y: 301.5 + FRONT - deep, heading: 0 };
    // up to 5 mm (as deep as a driving robot can get into a wall): nothing to say
    const expected =
      deep <= 5 ? [] : [`The robot stands ${deep} mm inside a wall (ahead) at its start position. At the start it is moved out of that wall.`];
    // a robot that drives off at once, one that turns first, one that stands: none stays in the wall
    const driving = setup(fullSpeed(-1), { walls: [wall], startPose: pose });
    assert.deepEqual(warnings(driving.sim), expected, `${deep} mm inside`);
    assert.deepEqual({ ...driving.robot.pose }, pose, 'before the start signal it stands where it was put');
    assert.ok(deepestInWall(driving.sim) > SKIN);
    driving.sim.start();
    assert.ok(deepestInWall(driving.sim) <= SKIN, `${deep} mm inside: out of the wall at the start signal`);
    near(driving.robot.pose.y - FRONT, 301.5, SKIN, `${deep} mm inside: moved back to the face of the wall`);
    driving.sim.step(100);
    assert.ok(driving.robot.pose.y > 600, `${deep} mm inside: it drove away`);

    const turning = setup(
      function* (io) {
        yield* drive(io, -60, 60);
        yield* turn(io, 90, 60);
      },
      { walls: [wall], startPose: pose },
    );
    runWatching(turning.sim, 600, (tick) => {
      assert.ok(deepestInWall(turning.sim) <= SKIN, `${deep} mm inside, tick ${tick}`);
    });
    near(turning.robot.yawDeg, 90, 0.01, `${deep} mm inside: it turned`);

    const standing = setup(function* () { yield* forever(); }, { walls: [wall], startPose: pose });
    standing.sim.start();
    standing.sim.step(5);
    near(standing.robot.pose.y - FRONT, 301.5, SKIN);
    // after a restart it is put back on its start position, and moved out of the wall again
    standing.sim.restart();
    assert.ok(deepestInWall(standing.sim) <= SKIN);
  }
  // a game without walls never says it
  const free = setup(fullSpeed(-1), { walls: null, startPose: { x: 500, y: 300, heading: 0 } });
  assert.deepEqual(warnings(free.sim), []);
});

// =============================================================================================
// Ultrasonic sensor
// =============================================================================================

/** One reading of the ultrasonic sensor with the robot standing at `pose`. */
function sonarAt(pose: Pose, walls: FixedWall[], bodies: Body[] = []): number {
  const { sim } = setup(function* () {}, { walls, bodies, startPose: pose });
  return sim.readSensors().ultrasonicCm;
}

test('walls: the ultrasonic sensor measures the distance to a wall straight ahead', () => {
  const wall = levelWall('ahead', 500, 100, 800); // lower face at y = 101.5
  // the sensor is at the front of the chassis, 105 mm ahead of the robot's origin
  assert.equal(sonarAt({ x: 500, y: 101.5 + 43.5 + FRONT, heading: 0 }, [wall]), 4.4); // 43.5 mm, rounded to 0.1 cm
  assert.equal(sonarAt({ x: 500, y: 101.5 + 250 + FRONT, heading: 0 }, [wall]), 25);
  assert.equal(sonarAt({ x: 500, y: 101.5 + 600 + FRONT, heading: 0 }, [wall]), 60);
  // nearer than the sensor can measure: its shortest reading
  assert.equal(sonarAt({ x: 500, y: 101.5 + 10 + FRONT, heading: 0 }, [wall]), BARE.ultrasonic.minRangeCm);
  // no wall: nothing in range
  assert.equal(sonarAt({ x: 500, y: 500, heading: 0 }, []), BARE.ultrasonic.maxRangeCm);
  // looking the other way: nothing either
  assert.equal(sonarAt({ x: 500, y: 500, heading: 180 * DEG }, [wall]), BARE.ultrasonic.maxRangeCm);
});

test('walls: the ultrasonic sensor at an angle reads the nearest point inside its 12 degree beam', () => {
  const wall = levelWall('ahead', 500, 100, 2000);
  const sensorY = 500;
  const gap = sensorY - 101.5; // straight distance from the sensor to the wall
  for (const degrees of [0, 5, 12, 20, 30, 45]) {
    const heading = degrees * DEG;
    // put the robot so that its sensor is at (500, 500)
    const pose: Pose = { x: 500 - FRONT * Math.sin(heading), y: sensorY + FRONT * Math.cos(heading), heading };
    // the ray of the beam that is nearest to "straight at the wall"
    // (the beam is 13 rays, 2 degrees apart: inside the beam one of them is at most 1 degree off)
    const best = Math.max(0, degrees - BARE.ultrasonic.halfAngleDeg);
    near(sonarAt(pose, [wall]), gap / Math.cos(best * DEG) / 10, 0.06, `heading ${degrees} degrees`);
  }
});

test('walls: the ultrasonic beam passes over a low wall and beside the end of a wall', () => {
  const low = levelWall('kerb', 500, 100, 800, 3, 30); // lower than the beam (35 mm)
  assert.equal(sonarAt({ x: 500, y: 500, heading: 0 }, [low]), BARE.ultrasonic.maxRangeCm);
  const exact = levelWall('edge', 500, 100, 800, 3, BARE.ultrasonic.height);
  assert.equal(sonarAt({ x: 500, y: 101.5 + 200 + FRONT, heading: 0 }, [exact]), 20);
  // a short wall far to the left: the beam (12 degrees to each side) misses it
  const aside = levelWall('aside', 100, 100, 100);
  assert.equal(sonarAt({ x: 500, y: 500, heading: 0 }, [aside]), BARE.ultrasonic.maxRangeCm);
});

test('walls: the ultrasonic sensor sees what is nearest - a box in front of a wall, not a box behind it', () => {
  const wall = levelWall('ahead', 500, 300, 800);
  const pose: Pose = { x: 500, y: 301.5 + 400 + FRONT, heading: 0 };
  const inFront = makeBody({ id: 'box', x: 500, y: 600, w: 60, l: 20, h: 120 }); // its near face at y = 610
  const behind = makeBody({ id: 'box', x: 500, y: 200, w: 60, l: 20, h: 120 });
  assert.equal(sonarAt(pose, [wall]), 40);
  near(sonarAt(pose, [wall], [inFront]), (701.5 - 610) / 10, 0.051, 'the box');
  assert.equal(sonarAt(pose, [wall], [behind]), 40);
});

test('walls: the ultrasonic value follows the robot as it drives up to a wall', () => {
  const wall = levelWall('ahead', 500, 100, 800);
  const seen: number[] = [];
  const { sim, robot } = setup(
    function* (io) {
      io.setWheelRpm('left', 60);
      io.setWheelRpm('right', 60);
      yield* waitUntil(() => {
        seen.push(io.ultrasonicCm());
        return io.ultrasonicCm() <= 10;
      });
      io.stopWheel('all');
    },
    { walls: [wall], startPose: { x: 500, y: 800, heading: 0 } },
  );
  sim.start();
  sim.step(2000);
  assert.equal(sim.finishReason, 'program-ended');
  near(seen[0], (800 - FRONT - 101.5) / 10, 0.051, 'first reading');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] <= seen[i - 1], 'the distance only shrinks');
  // it stopped about 10 cm before the wall (a little less: it needs a moment to brake)
  const gap = robot.pose.y - FRONT - 101.5;
  assert.ok(gap <= 100 && gap > 90, `stopped ${gap} mm before the wall`);
  assert.equal(robot.touching, false);
});

test('walls: the ultrasonic sensor sees the end of a thin wall that stands between two of its rays', () => {
  // A 3 mm panel seen from its end. The rays of the beam are 2 degrees apart: 343.5 mm away
  // they are 12 mm apart, and the end of the panel fits between the middle ray and the next.
  // (a short piece of a panel, so that no slanted ray meets its long side further up)
  const panel = uprightWall('edge-on', 600, 446.5, 10); // its lower end is at y = 451.5, x = 598.5 .. 601.5
  const far = levelWall('far', 600, 100, 800); // behind it: lower face at y = 101.5
  const sensorY = 451.5 + 343.5;
  const from = (x: number): number => sonarAt({ x, y: sensorY + FRONT, heading: 0 }, [panel, far]);
  assert.equal(from(600), 34.4, 'the middle ray hits the end face');
  // 5 mm beside the middle of the beam (0.8 degrees): no ray hits it, its corners are seen
  near(from(595), 34.4, 0.051, 'the end is 3.5 .. 6.5 mm right of the middle ray');
  near(from(605), 34.4, 0.051, 'and the same on the other side');
  for (let beside = 0; beside <= 70; beside += 1) {
    // inside the beam (12 degrees to each side: up to 73 mm beside at this distance) the end
    // is seen at its distance, at every place - not only where a ray happens to pass
    const expected = Math.hypot(343.5, Math.max(0, beside - 1.5)) / 10;
    near(from(600 - beside), expected, 0.06, `${beside} mm beside the middle`);
  }
  // outside the beam it is not seen: the wall behind it is
  near(from(600 - 80), (sensorY - 101.5) / 10, 0.051, '80 mm beside: 13 degrees');
  // a corner behind a wall that the rays hit changes nothing
  const front = levelWall('front', 600, 600, 800); // lower face at y = 601.5, in front of the panel
  near(sonarAt({ x: 595, y: sensorY + FRONT, heading: 0 }, [panel, far, front]), (sensorY - 601.5) / 10, 0.051, 'hidden');
  // and a panel that is too low for the beam has no corners to see
  const low = uprightWall('low', 600, 446.5, 10, 3, 20);
  near(sonarAt({ x: 595, y: sensorY + FRONT, heading: 0 }, [low, far]), (sensorY - 101.5) / 10, 0.051, 'a low panel');
});

test('walls: the ultrasonic sensor agrees with a slow check of every wall - 13 rays and the corners inside the beam (60 walls, also slanted ones)', () => {
  const rng = makeRng(2027);
  for (let round = 0; round < 40; round++) {
    // 60 walls anywhere on the mat, a third of them slanted, some too low to be seen
    const walls: FixedWall[] = [];
    for (let k = 0; k < 60; k++) {
      walls.push({
        id: `wall:${k}`,
        label: `${k}`,
        x: rng() * 1000,
        y: rng() * 1000,
        angle: k % 3 === 0 ? rng() * Math.PI : k % 3 === 1 ? 0 : Math.PI / 2,
        w: 3,
        l: 50 + rng() * 250,
        h: k % 10 === 0 ? 20 : 150,
        fill: '#999',
      });
    }
    for (let look = 0; look < 25; look++) {
      const pose: Pose = { x: 100 + rng() * 800, y: 100 + rng() * 800, heading: rng() * 2 * Math.PI };
      const { sim } = setup(function* () {}, { walls, startPose: pose });
      // the same beam, worked out here the slow way: 13 rays from -12 to +12 degrees against every wall
      const u = BARE.ultrasonic;
      const origin = { x: pose.x + u.forward * Math.sin(pose.heading), y: pose.y - u.forward * Math.cos(pose.heading) };
      let best = u.maxRangeCm * 10;
      for (let k = 0; k < 13; k++) {
        const direction = pose.heading + (-u.halfAngleDeg + (2 * u.halfAngleDeg * k) / 12) * DEG;
        const dir = { x: Math.sin(direction), y: -Math.cos(direction) };
        for (const wall of walls) {
          if (wall.h < u.height) continue;
          const d = rayOBB(origin, dir, wallFootprint(wall));
          if (d !== null && d < best) best = d;
        }
      }
      // ... and every corner of a wall that lies inside the beam (the end of a thin wall can stand between two rays)
      for (const wall of walls) {
        if (wall.h < u.height) continue;
        for (const corner of obbCorners(wallFootprint(wall))) {
          const d = Math.hypot(corner.x - origin.x, corner.y - origin.y);
          const bearing = Math.atan2(corner.x - origin.x, origin.y - corner.y);
          const off = Math.abs(Math.atan2(Math.sin(bearing - pose.heading), Math.cos(bearing - pose.heading)));
          if (off <= u.halfAngleDeg * DEG + 1e-9 && d < best) best = d;
        }
      }
      const expected = Math.min(u.maxRangeCm, Math.max(u.minRangeCm, best / 10));
      near(sim.readSensors().ultrasonicCm, expected, 0.051, `round ${round}, look ${look}`);
    }
  }
});

// =============================================================================================
// wallBetween (for referees)
// =============================================================================================

test('wallBetween: finds the first wall on a straight line, or null when the way is free', () => {
  const near1 = uprightWall('near', 300, 500, 400);
  const far = uprightWall('far', 600, 500, 400);
  const walls = [far, near1];
  assert.equal(wallBetween(walls, { x: 100, y: 500 }, { x: 900, y: 500 })?.id, 'wall:near');
  assert.equal(wallBetween(walls, { x: 900, y: 500 }, { x: 100, y: 500 })?.id, 'wall:far');
  assert.equal(wallBetween(walls, { x: 400, y: 500 }, { x: 500, y: 500 }), null, 'between the two walls');
  assert.equal(wallBetween(walls, { x: 100, y: 100 }, { x: 900, y: 100 }), null, 'above both walls');
  assert.equal(wallBetween(walls, { x: 100, y: 500 }, { x: 290, y: 500 }), null, 'the line ends before the wall');
  assert.equal(wallBetween(walls, { x: 100, y: 500 }, { x: 100, y: 500 }), null, 'no line at all');
  assert.equal(wallBetween([], { x: 0, y: 0 }, { x: 9, y: 9 }), null);
  assert.equal(wallBetween(undefined, { x: 0, y: 0 }, { x: 9, y: 9 }), null);
  // a slanted line that passes just beside the end of a wall
  assert.equal(wallBetween([near1], { x: 100, y: 695 }, { x: 500, y: 715 }), null);
  assert.equal(wallBetween([near1], { x: 100, y: 680 }, { x: 500, y: 700 })?.id, 'wall:near');
});
