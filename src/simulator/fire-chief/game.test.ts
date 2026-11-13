/**
 * The Fire Chief referee, sentence by sentence of the rules (§6 - §11), including the ways NOT
 * to score. Every test runs the real engine; a tiny fake VM runs a script that drives the robot
 * through RobotIO (the blocks for the flame sensor and the fan come later).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from '../core/engine';
import { DEG, obbCorners, obbOverlap } from '../core/geometry';
import type { RobotIO } from '../core/io';
import { robotFitsInRect } from '../core/robot';
import { drive, forever, near, scripted, sleep, turn, waitUntil, type Script } from '../core/test-helpers';
import type { Body, Pose, RobotConfig, ScoreContext, ScoreLine, SimEvent, Simulation } from '../core/types';
import { wallFootprint } from '../core/walls';
import {
  FIRE_SPOTS,
  ROOM_IDS,
  START_RECT,
  TARGET_DEPTH,
  TARGET_HEIGHT,
  TARGET_WIDTH,
  WALL_POSITIONS,
  roomRect,
  targetPose,
  wallIndexBetween,
} from './field';
import {
  ACHIEVEMENT_IDS,
  FAN_ACTION_SECONDS,
  MATCH_DURATION,
  MAX_RESTARTS,
  MAX_SCORE,
  TARGET_BODY_ID,
  TARGET_DISPLACED_MM,
  clock,
  fanProblem,
  fireChiefGame,
  hasLeftStart,
  lookAtFan,
  roomAround,
  targetOf,
  targetShift,
} from './game';
import { FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import {
  NAMED_MAZES,
  defaultScenario,
  encodeScenario,
  openField,
  randomScenario,
  wallCount,
  withWall,
  type FireChiefScenario,
} from './scenario';
import { makeRng } from '../core/geometry';

type Sim = Simulation<FireChiefScenario>;

// =============================================================================================
// Helpers
// =============================================================================================

const FRONT = FIRE_CHIEF_ROBOT.chassisFront;
const REAR = FIRE_CHIEF_ROBOT.chassisRear;

interface PlayOptions {
  scenario?: FireChiefScenario;
  startPose?: Pose;
  robotConfig?: RobotConfig;
}

function play(script: Script, o: PlayOptions = {}) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    {
      game: fireChiefGame,
      scenario: o.scenario ?? openField('living', 'back'),
      robotConfig: o.robotConfig,
      program: {},
      startPose: o.startPose,
    },
    harness.factory,
  );
  const target = targetOf(sim.world);
  assert.ok(target, 'the fire target is on the field');
  return { sim, harness, robot: sim.world.robot, target };
}

const lineOf = (sim: Sim, id: string): ScoreLine => {
  const line = sim.score().lines.find((l) => l.id === id);
  assert.ok(line, `score line ${id} exists`);
  return line;
};

const earned = (sim: Sim): string[] => sim.score().lines.filter((l) => l.ok && l.max > 0).map((l) => l.id);

/** Run tick by tick until `stop` says so (or `maxTicks` are over); returns every event. */
function runUntil(sim: Sim, stop: () => boolean, maxTicks = 20000): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.status === 'ready') sim.start();
  for (let i = 0; i < maxTicks && sim.status === 'running' && !stop(); i++) {
    sim.step(1);
    events.push(...sim.drainEvents());
  }
  events.push(...sim.drainEvents());
  return events;
}

const logOf = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'log' && e.level === 'info' ? [e.text] : []));

/**
 * A pose that puts the fan of the robot `distance` mm from the middle of the target, on the
 * side the target looks at, with the target `off` degrees away from "straight ahead".
 */
function aimedAt(target: Body, distance: number, off = 0): Pose {
  const fanX = target.x + distance * Math.sin(target.angle);
  const fanY = target.y - distance * Math.cos(target.angle);
  // straight at the target = the opposite of the direction the target faces
  const heading = target.angle + Math.PI - off * DEG;
  return { x: fanX - FRONT * Math.sin(heading), y: fanY + FRONT * Math.cos(heading), heading };
}

/** The target of the open field with the fire at the back of the living room: at (150, 10), facing down. */
const BACK_TARGET = { x: 150, y: 10, angle: Math.PI } as Body;

/**
 * Completely inside the living room, facing that target, the fan 100 mm from it (the front of
 * the robot is then 90 mm from the target, its rear 15 mm inside the room).
 */
const IN_ROOM = aimedAt(BACK_TARGET, 100);

/** Stand for a moment, then switch the fan on and keep it on. */
const fanOn = (power = 100, port: 'M1' | 'M2' = 'M1'): Script =>
  function* (io: RobotIO) {
    yield* sleep(10);
    io.setDcMotor(port, power);
    yield* forever();
  };

// =============================================================================================
// The game
// =============================================================================================

test('game: Fire Chief - 180 s, 100 points, one restart that clears the points, its own robot', () => {
  assert.equal(fireChiefGame.id, 'fire-chief');
  assert.equal(fireChiefGame.matchDuration, 180);
  assert.equal(MATCH_DURATION, 180);
  assert.equal(MAX_SCORE, 100);
  assert.equal(FAN_ACTION_SECONDS, 3);
  assert.equal(MAX_RESTARTS, 1);
  assert.deepEqual(fireChiefGame.restartRules, { maxRestarts: 1, clearsPoints: true, resetsBodies: true });
  assert.equal(fireChiefGame.restartPenalty, 0);
  assert.equal(fireChiefGame.robotConfig, FIRE_CHIEF_ROBOT);
  assert.deepEqual(fireChiefGame.startZone, START_RECT);
  assert.deepEqual(fireChiefGame.defaultStartPose, START_POSE);
  assert.deepEqual(fireChiefGame.mat, {
    width: 1500,
    height: 1500,
    imageUrl: '/simulator/fire-chief/mat.webp',
    sensorImageUrl: '/simulator/fire-chief/mat-sensor.webp',
    vector: fireChiefGame.mat.vector,
  });
  assert.deepEqual(fireChiefGame.defaultScenario(), defaultScenario());
  assert.equal(fireChiefGame.scenarioCount(), 671934664458);
  assert.equal(fireChiefGame.encodeScenario(defaultScenario()), 'LC-4406-N0E0');
  assert.deepEqual(fireChiefGame.decodeScenario('LC-4406-N0E0'), defaultScenario());
  assert.equal(fireChiefGame.decodeScenario('nonsense'), null);
  assert.match(fireChiefGame.describeScenario(defaultScenario()), /living room/);
  assert.deepEqual(fireChiefGame.randomScenario(makeRng(3)), randomScenario(makeRng(3)));
  // for the maze editor: what is wrong with a combination
  assert.deepEqual(fireChiefGame.scenarioProblems?.(defaultScenario()), []);
  const closed = withWall(withWall(openField(), wallIndexBetween({ col: 0, row: 0 }, { col: 1, row: 0 }), true), wallIndexBetween({ col: 0, row: 0 }, { col: 0, row: 1 }), true);
  assert.deepEqual(fireChiefGame.scenarioProblems?.(closed), ['There is no way from START to the living room: take a wall away.']);
});

test('game: the walls of a combination - four around the field plus the inner walls that stand', () => {
  for (const { scenario, id } of NAMED_MAZES) {
    const walls = fireChiefGame.createWalls?.(scenario) ?? [];
    assert.equal(walls.length, 4 + wallCount(scenario), id);
    assert.equal(new Set(walls.map((w) => w.id)).size, walls.length, 'every wall has its own id');
    for (const wall of walls) assert.equal(wall.h, 150);
    const inner = walls.slice(4).map((w) => w.label);
    assert.deepEqual(inner, WALL_POSITIONS.filter((p) => scenario.walls[p.index]).map((p) => p.label), id);
  }
  // a maze with all 40 walls would have 44
  const all: FireChiefScenario = { walls: new Array(40).fill(true), fireRoom: 'living', fireSpot: 'corner' };
  assert.equal(fireChiefGame.createWalls?.(all).length, 44);
  const { sim } = play(function* () {}, { scenario: defaultScenario() });
  assert.equal(sim.world.walls?.length, 14);
});

test('game: one fire target with an infrared emitter, at its spot, clear of the walls', () => {
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      for (const base of [openField(), defaultScenario(), NAMED_MAZES[4].scenario]) {
        const scenario = { ...base, fireRoom: room, fireSpot: spot };
        const bodies = fireChiefGame.createBodies(scenario);
        assert.equal(bodies.length, 1);
        const target = bodies[0];
        const at = targetPose(room, spot);
        assert.equal(target.id, TARGET_BODY_ID);
        assert.deepEqual([target.x, target.y, target.angle], [at.x, at.y, at.angle]);
        assert.deepEqual([target.w, target.l, target.h], [TARGET_WIDTH, TARGET_DEPTH, TARGET_HEIGHT]);
        assert.deepEqual(target.home, { x: at.x, y: at.y, angle: at.angle, z: 0, restingOn: null });
        assert.equal(target.grippable, false);
        // the emitter is in the middle of its front face
        assert.deepEqual(target.infrared, { forward: 10, height: 60, halfAngleDeg: 70 });
        // it does not stand in a wall, and the engine leaves it exactly where the game put it
        const { sim } = play(function* () { yield* sleep(50); }, { scenario });
        sim.start();
        sim.step(100);
        const now = targetOf(sim.world);
        assert.ok(now);
        assert.deepEqual([now.x, now.y, now.angle], [at.x, at.y, at.angle], `${room} ${spot}: it has not moved`);
        for (const wall of sim.world.walls ?? []) {
          const hit = obbOverlap(wallFootprint(wall), { x: now.x, y: now.y, w: now.w, l: now.l, angle: now.angle });
          assert.ok(!hit || hit.depth < 1e-6, `${room} ${spot}: inside ${wall.id}`);
        }
      }
    }
  }
});

test('game: the overlays show START and the two rooms, and which room burns', () => {
  const zones = fireChiefGame.overlays(openField('bedroom', 'side'));
  assert.deepEqual(zones.map((z) => [z.id, z.label, z.kind]), [
    ['start', 'START', 'start'],
    ['room:living', 'Living room', 'info'],
    ['room:bedroom', 'Bedroom (fire)', 'info'],
  ]);
  assert.deepEqual(zones[0].rect, START_RECT);
  assert.deepEqual(zones[1].rect, roomRect('living'));
  assert.deepEqual(zones[2].rect, roomRect('bedroom'));
  assert.notEqual(zones[1].color, zones[2].color);
  assert.equal(fireChiefGame.overlays(openField('living', 'back'))[1].label, 'Living room (fire)');
});

test('score sheet: four achievements worth 10 + 20 + 30 + 40 and a restart line, nothing earned at the start', () => {
  const { sim } = play(function* () { yield* forever(); });
  const report = sim.score();
  assert.equal(report.total, 0);
  assert.equal(report.max, 100);
  assert.equal(report.complete, false);
  assert.equal(report.time, undefined);
  assert.deepEqual(report.lines.map((l) => [l.id, l.points, l.max, l.ok]), [
    ['leave-start', 0, 10, false],
    ['enter-room', 0, 20, false],
    ['fan-start', 0, 30, false],
    ['fan-complete', 0, 40, false],
    ['restart', 0, 0, true],
  ]);
  assert.deepEqual(ACHIEVEMENT_IDS, ['leave-start', 'enter-room', 'fan-start', 'fan-complete']);
  assert.deepEqual(report.lines.map((l) => l.label), [
    'Leave START completely',
    'Drive completely into the living room or the bedroom',
    'Stand still, face the fire and start the fan',
    'Keep the fan on the fire for 3 seconds',
    'Restart',
  ]);
  assert.deepEqual(report.lines.map((l) => l.detail), [
    'not yet - the whole robot must be outside the START cell',
    'not yet - the whole robot must be inside the living room or the bedroom',
    'not yet - the fan is off',
    'not yet - the fan must blow at the fire for 3 seconds without a break',
    'no restart used (one is allowed; it clears the points, the clock keeps running)',
  ]);
  for (const line of report.lines) assert.equal(line.time, undefined);
  // Game.score() without a match: the same empty sheet
  const ctx: ScoreContext<FireChiefScenario> = {
    scenario: sim.scenario,
    world: sim.world,
    robotConfig: sim.robotConfig,
    restarts: 0,
    robotShapes: sim.robotShapes(),
  };
  assert.deepEqual(fireChiefGame.score(ctx), report);
});

test('clock: match times are written as minutes:seconds.tenths, cut off', () => {
  assert.equal(clock(0), '0:00.0');
  assert.equal(clock(3.14), '0:03.1');
  assert.equal(clock(9.99), '0:09.9');
  assert.equal(clock(59.96), '0:59.9');
  assert.equal(clock(60), '1:00.0');
  assert.equal(clock(83.42), '1:23.4');
  assert.equal(clock(180), '3:00.0');
  assert.equal(clock(0.3), '0:00.3'); // (0.1 + 0.2 in a computer is not exactly 0.3)
});

// =============================================================================================
// §6.1 The start, and 10 points: completely out of START
// =============================================================================================

test('start: the robot stands completely inside START and earns nothing by standing there', () => {
  const { sim, robot } = play(function* () { yield* forever(); });
  assert.ok(robotFitsInRect(sim.robotConfig, robot.pose, START_RECT));
  assert.equal(hasLeftStart(sim.robotShapes()), false);
  sim.start();
  sim.step(500);
  assert.equal(sim.score().total, 0);
  assert.equal(sim.status, 'running');
  // no warning about the start position
  assert.deepEqual(sim.drainEvents().filter((e) => e.type === 'log'), []);
});

test('10 points: earned on the tick the whole robot is outside START - not while its rear is still over it', () => {
  const { sim, robot } = play(function* (io) {
    yield* drive(io, 400, 60);
    yield* forever();
  });
  let rearBefore = 0;
  const events = runUntil(sim, () => {
    if (sim.score().total > 0) return true;
    rearBefore = robot.pose.y + REAR;
    return false;
  });
  // one tick earlier the rear of the robot was still over the START cell (which begins at y = 1200)
  assert.ok(rearBefore >= 1200, `rear at ${rearBefore} one tick before`);
  assert.ok(robot.pose.y + REAR < 1200, `rear at ${robot.pose.y + REAR} now`);
  assert.ok(rearBefore - (robot.pose.y + REAR) < 2.2, 'no more than one tick of driving between the two');
  assert.deepEqual(earned(sim), ['leave-start']);
  assert.equal(sim.score().total, 10);
  // the time is written down
  const line = lineOf(sim, 'leave-start');
  assert.equal(line.time, sim.world.time);
  assert.equal(line.detail, `done at ${clock(sim.world.time)}`);
  assert.equal(sim.score().time, sim.world.time);
  assert.deepEqual(logOf(events), [`+10 points at ${clock(sim.world.time)}: the robot has left START completely.`]);
});

test('10 points: not for a robot that is only partly out, however long it waits', () => {
  const { sim, robot } = play(function* (io) {
    yield* drive(io, 219, 60); // the rear is still 1 mm inside START
    yield* forever();
  });
  sim.start();
  sim.step(1500);
  near(robot.pose.y + REAR, 1201, 1e-6);
  assert.equal(sim.score().total, 0);
  assert.equal(lineOf(sim, 'leave-start').ok, false);
});

test('10 points: earned once - coming back into START and leaving again changes nothing', () => {
  const { sim } = play(function* (io) {
    yield* drive(io, 300, 90);
    yield* drive(io, -300, 90);
    yield* drive(io, 300, 90);
    yield* forever();
  });
  runUntil(sim, () => sim.score().total > 0);
  const first = lineOf(sim, 'leave-start').time;
  sim.step(1500);
  assert.equal(sim.score().total, 10);
  assert.equal(lineOf(sim, 'leave-start').time, first);
  assert.equal(sim.score().time, first);
});

test('10 points: leaving START sideways counts just the same', () => {
  const { sim, robot } = play(function* (io) {
    yield* turn(io, 90);
    yield* drive(io, 300, 90);
    yield* forever();
  });
  sim.start();
  sim.step(1000);
  near(robot.pose.x, 1050, 1e-6);
  assert.deepEqual(earned(sim), ['leave-start']);
});

// =============================================================================================
// 20 points: completely inside the living room or the bedroom
// =============================================================================================

test('20 points: earned on the tick the whole robot is inside the room - not while its rear sticks out', () => {
  for (const room of ROOM_IDS) {
    const x = room === 'living' ? 150 : 1350;
    // just below the room, facing up; the fire is in the other room
    const { sim, robot } = play(
      function* (io) {
        yield* drive(io, 300, 60);
        yield* forever();
      },
      { scenario: openField(room === 'living' ? 'bedroom' : 'living', 'back'), startPose: { x, y: 500, heading: 0 } },
    );
    let rearBefore = 0;
    runUntil(sim, () => {
      if (lineOf(sim, 'enter-room').ok) return true;
      rearBefore = robot.pose.y + REAR;
      return false;
    });
    assert.ok(rearBefore > 300, `${room}: rear at ${rearBefore} one tick before`);
    assert.ok(robot.pose.y + REAR <= 300, `${room}: rear at ${robot.pose.y + REAR} now`);
    assert.equal(roomAround(sim.robotShapes()), room);
    const line = lineOf(sim, 'enter-room');
    assert.equal(line.points, 20);
    assert.equal(line.time, sim.world.time);
    assert.equal(line.detail, `done at ${clock(sim.world.time)} (${room === 'living' ? 'living room' : 'bedroom'})`);
    // (this robot started outside START, so it also has the 10 points)
    assert.equal(sim.score().total, 30);
    assert.equal(sim.score().time, sim.world.time);
  }
});

test('20 points: not for a robot that is only partly inside the room, and not for any other cell', () => {
  // 1 mm of its rear is still outside the living room
  const partly = play(function* () { yield* forever(); }, { startPose: { x: 150, y: 231, heading: 0 }, scenario: openField('bedroom', 'back') });
  partly.sim.start();
  partly.sim.step(300);
  assert.equal(lineOf(partly.sim, 'enter-room').ok, false);
  assert.equal(roomAround(partly.sim.robotShapes()), null);
  // completely inside the cell next to the living room, and the cell below the bedroom
  for (const pose of [{ x: 450, y: 150, heading: 0 }, { x: 1350, y: 450, heading: 90 * DEG }]) {
    const other = play(function* () { yield* forever(); }, { startPose: pose, scenario: openField('bedroom', 'back') });
    other.sim.start();
    other.sim.step(300);
    assert.equal(lineOf(other.sim, 'enter-room').ok, false);
  }
  // exactly inside: its rear on the boundary line of the room
  const exact = play(function* () { yield* forever(); }, { startPose: { x: 150, y: 230, heading: 0 }, scenario: openField('bedroom', 'back') });
  exact.sim.start();
  exact.sim.step(2);
  assert.equal(lineOf(exact.sim, 'enter-room').ok, true);
});

test('20 points: a robot standing askew in the room is inside too', () => {
  const { sim } = play(function* () { yield* forever(); }, { startPose: { x: 150, y: 150, heading: 45 * DEG }, scenario: openField('bedroom', 'back') });
  sim.start();
  sim.step(2);
  for (const c of obbCorners(sim.robotShapes()[0])) assert.ok(c.x >= 0 && c.x <= 300 && c.y >= 0 && c.y <= 300);
  assert.equal(lineOf(sim, 'enter-room').ok, true);
});

test('20 points: only once - the second room adds nothing', () => {
  const { sim, robot } = play(
    function* (io) {
      yield* sleep(20);
      yield* turn(io, 90, 60);
      yield* drive(io, 1200, 150); // from the living room along the top of the field into the bedroom
      yield* forever();
    },
    { startPose: { x: 150, y: 150, heading: 0 }, scenario: openField('bedroom', 'side') },
  );
  runUntil(sim, () => lineOf(sim, 'enter-room').ok);
  const first = lineOf(sim, 'enter-room').time;
  assert.equal(lineOf(sim, 'enter-room').detail, `done at ${clock(first ?? 0)} (living room)`);
  sim.step(1500);
  near(robot.pose.x, 1350, 1e-6);
  assert.equal(roomAround(sim.robotShapes()), 'bedroom');
  assert.equal(sim.score().total, 30, '10 + 20, not 10 + 20 + 20');
  assert.equal(lineOf(sim, 'enter-room').time, first);
  assert.equal(lineOf(sim, 'enter-room').detail, `done at ${clock(first ?? 0)} (living room)`);
});

// =============================================================================================
// 30 points: stand still, face the fire, start the fan
// =============================================================================================

test('30 points: standing still, facing the target, fan on - earned at the moment the fan starts', () => {
  let switchedOnAt = -1;
  const { sim, robot } = play(
    function* (io) {
      yield* sleep(10);
      switchedOnAt = io.time; // what the timer of the program shows when it switches the fan on
      io.setDcMotor('M1', 100);
      yield* forever();
    },
    { startPose: aimedAt(BACK_TARGET, 150) },
  );
  let fanTime = -1;
  let ticksWithFan = 0;
  const events = runUntil(sim, () => {
    if (robot.fanOn) ticksWithFan++;
    // (the referee looks at the end of a tick: the fan came on at the beginning of that tick)
    if (robot.fanOn && fanTime < 0) fanTime = sim.world.time - sim.dt;
    return lineOf(sim, 'fan-start').ok;
  });
  near(fanTime, 0.1, 1e-9);
  assert.equal(fanTime, switchedOnAt);
  assert.equal(ticksWithFan, 1, 'the referee needs no second look: the points come on the first tick with the fan on');
  const line = lineOf(sim, 'fan-start');
  assert.equal(line.points, 30);
  assert.equal(line.time, fanTime, 'the time written down is the moment the fan was switched on');
  assert.equal(line.detail, `done at ${clock(fanTime)}`);
  assert.ok(logOf(events).includes(`+30 points at ${clock(fanTime)}: the robot stands still, faces the fire and the fan is on.`));
  // the 40 points take 3 seconds more
  assert.equal(lineOf(sim, 'fan-complete').ok, false);
  assert.match(lineOf(sim, 'fan-complete').detail, /^the fan is on the fire: 0\.0 of 3 seconds - keep still$/);
  const view = lookAtFan({ scenario: sim.scenario, world: sim.world, robotConfig: sim.robotConfig, restarts: 0, robotShapes: sim.robotShapes() });
  assert.ok(view);
  assert.equal(view.fanOn, true);
  near(view.distance, 150, 1e-6);
  near(view.offDeg, 0, 1e-6);
  assert.equal(view.wall, null);
  assert.equal(view.touching, false);
});

test('30 points: at every spot of both rooms the action counts from the middle of the room', () => {
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const at = targetPose(room, spot);
      const centre = { x: roomRect(room).x + 150, y: 150 };
      // in the middle of the room, turned towards the target
      const heading = Math.atan2(at.x - centre.x, centre.y - at.y);
      const { sim } = play(fanOn(), { scenario: openField(room, spot), startPose: { ...centre, heading } });
      runUntil(sim, () => sim.status !== 'running');
      assert.equal(sim.finishReason, 'mission-complete', `${room} ${spot}`);
      assert.equal(sim.score().total, 100, `${room} ${spot}`);
    }
  }
});

test('not 30 points: the fan in the empty room', () => {
  // the fire is in the bedroom; the robot does everything right - in the living room
  const { sim } = play(fanOn(), { scenario: openField('bedroom', 'back'), startPose: IN_ROOM });
  sim.start();
  sim.step(1000);
  assert.equal(sim.status, 'running');
  assert.equal(lineOf(sim, 'fan-start').ok, false);
  assert.equal(lineOf(sim, 'fan-complete').ok, false);
  assert.match(lineOf(sim, 'fan-start').detail, /^not yet - the fire is too far from the fan \(12\d\d mm, at most 300 mm\)$/);
  assert.equal(sim.score().total, 10 + 20, 'only for leaving START and for being in a room');
});

test('not 30 points: the fan through a wall', () => {
  // the robot stands in the cell below the living room and looks up at the target, 295 mm away
  const pose = aimedAt(BACK_TARGET, 295);
  assert.ok(pose.y - FRONT > 301.5, 'its front is below the boundary of the room');
  const wallBelowRoom = wallIndexBetween({ col: 0, row: 0 }, { col: 0, row: 1 });
  const walled = play(fanOn(), { scenario: withWall(openField('living', 'back'), wallBelowRoom, true), startPose: pose });
  walled.sim.start();
  walled.sim.step(1000);
  assert.equal(walled.sim.status, 'running');
  assert.equal(lineOf(walled.sim, 'fan-start').ok, false);
  assert.equal(lineOf(walled.sim, 'fan-start').detail, 'not yet - there is a wall between the fan and the fire');
  assert.equal(walled.sim.score().total, 10);
  // the same robot at the same place without that wall scores: the wall was the only reason
  const open = play(fanOn(), { startPose: pose });
  open.sim.start();
  open.sim.step(1000);
  assert.equal(open.sim.finishReason, 'mission-complete');
});

test('not 30 points: the fan while the robot is moving', () => {
  // it creeps towards the target with the fan on, then stops
  const { sim, robot } = play(
    function* (io) {
      io.setDcMotor('M1', 100);
      io.setWheelRpm('left', 10);
      io.setWheelRpm('right', 10);
      yield* sleep(200);
      io.stopWheel('all');
      yield* forever();
    },
    { startPose: aimedAt(BACK_TARGET, 250) },
  );
  let stoppedAt = -1;
  let wasMoving = false;
  runUntil(sim, () => {
    const moving = robot.left.rpm !== 0 || robot.right.rpm !== 0;
    if (moving) {
      wasMoving = true;
      assert.equal(lineOf(sim, 'fan-start').ok, false, `moving at ${sim.world.time} s: no points`);
      assert.equal(lineOf(sim, 'fan-start').detail, 'not yet - the robot is moving - it must stand still');
    } else if (wasMoving && stoppedAt < 0) stoppedAt = sim.world.time;
    return lineOf(sim, 'fan-start').ok;
  });
  assert.ok(wasMoving && stoppedAt > 2);
  // earned once it stands: one tick after the wheels stopped (the referee wants to see it stand)
  const at = lineOf(sim, 'fan-start').time ?? 0;
  assert.ok(at >= stoppedAt && at <= stoppedAt + 0.02 + 1e-9, `stopped at ${stoppedAt}, earned at ${at}`);
});

test('not 30 points: the fan while the robot turns on the spot, even when it points at the fire', () => {
  const { sim } = play(
    function* (io) {
      io.setDcMotor('M1', 100);
      // sweep slowly from 10 degrees left of the target to 10 degrees right of it, again and again
      for (;;) {
        yield* turn(io, 20, 5);
        yield* turn(io, -20, 5);
      }
    },
    { startPose: aimedAt(BACK_TARGET, 150, 10) },
  );
  sim.start();
  sim.step(1500);
  assert.equal(lineOf(sim, 'fan-start').ok, false);
});

test('not 30 points: the target further than 300 mm from the fan', () => {
  const far = play(fanOn(), { startPose: aimedAt(BACK_TARGET, 301) });
  far.sim.start();
  far.sim.step(600);
  assert.equal(lineOf(far.sim, 'fan-start').ok, false);
  assert.equal(lineOf(far.sim, 'fan-start').detail, 'not yet - the fire is too far from the fan (301 mm, at most 300 mm)');
  const nearEnough = play(fanOn(), { startPose: aimedAt(BACK_TARGET, 299) });
  nearEnough.sim.start();
  nearEnough.sim.step(600);
  assert.equal(nearEnough.sim.finishReason, 'mission-complete');
});

test('not 30 points: the target more than 20 degrees away from straight ahead', () => {
  for (const off of [21, -21, 45, 90, 180]) {
    const { sim } = play(fanOn(), { startPose: aimedAt(BACK_TARGET, 200, off) });
    sim.start();
    sim.step(600);
    assert.equal(lineOf(sim, 'fan-start').ok, false, `${off} degrees off`);
    assert.equal(
      lineOf(sim, 'fan-start').detail,
      `not yet - the fan does not point at the fire (${Math.abs(off)} degrees off, at most 20)`,
    );
  }
  for (const off of [19, -19, 0]) {
    const { sim } = play(fanOn(), { startPose: aimedAt(BACK_TARGET, 200, off) });
    sim.start();
    sim.step(600);
    assert.equal(sim.finishReason, 'mission-complete', `${off} degrees off`);
  }
});

test('not 30 points: a fan that is too weak, or a motor on the other port', () => {
  const run = (power: number, port: 'M1' | 'M2' = 'M1'): Sim => {
    const { sim } = play(fanOn(power, port), { startPose: aimedAt(BACK_TARGET, 150) });
    sim.start();
    sim.step(600);
    return sim;
  };
  assert.equal(lineOf(run(19), 'fan-start').ok, false);
  assert.equal(lineOf(run(19), 'fan-start').detail, 'not yet - the fan is off');
  assert.equal(lineOf(run(100, 'M2'), 'fan-start').ok, false);
  assert.equal(run(20).finishReason, 'mission-complete');
  assert.equal(run(-60).finishReason, 'mission-complete', 'the fan may turn either way');
});

test('not 30 points: a robot without a fan', () => {
  const noFan: RobotConfig = { ...FIRE_CHIEF_ROBOT, fan: undefined };
  const { sim } = play(fanOn(), { startPose: aimedAt(BACK_TARGET, 150), robotConfig: noFan });
  sim.start();
  sim.step(600);
  assert.equal(lineOf(sim, 'fan-start').ok, false);
  assert.equal(lineOf(sim, 'fan-start').detail, 'not yet - this robot has no fan');
});

test('not 30 points: the robot touches the target', () => {
  // it drives gently up to the target (which stands against the wall and cannot give way) ...
  const { sim, robot, target } = play(
    function* (io) {
      io.setWheelRpm('left', 20);
      io.setWheelRpm('right', 20);
      yield* waitUntil(() => io.ultrasonicCm() <= 3);
      yield* sleep(60);
      io.stopWheel('all');
      yield* sleep(20);
      io.setDcMotor('M1', 100);
      yield* sleep(200);
      // ... and then moves back by 5 mm
      yield* drive(io, -5, 20);
      yield* forever();
    },
    { startPose: aimedAt(BACK_TARGET, 100) },
  );
  let touchedWithFan = 0;
  const events = runUntil(sim, () => {
    if (robot.fanOn && robot.pose.y - FRONT < 20.4) {
      touchedWithFan++;
      assert.equal(lineOf(sim, 'fan-start').ok, false);
      if (robot.left.rpm === 0) {
        assert.equal(lineOf(sim, 'fan-start').detail, 'not yet - the robot touches the fire target - move back a little');
      }
    }
    return sim.status !== 'running';
  });
  assert.ok(touchedWithFan > 150, `the fan ran for ${touchedWithFan} ticks while the robot touched the target`);
  // the target was squeezed against the wall, not displaced: the attempt went on
  assert.ok(targetShift(target) <= TARGET_DISPLACED_MM);
  assert.equal(sim.finishReason, 'mission-complete', 'after it moved back, the action counted');
  near(robot.pose.y - FRONT, 25, 0.1, 'it stands 5 mm in front of the target');
  assert.equal(logOf(events).filter((t) => t.startsWith('+30')).length, 1);
});

// =============================================================================================
// 40 points: three seconds without a break
// =============================================================================================

test('40 points: earned exactly 3 seconds after the action began; the attempt ends at once', () => {
  const { sim, robot, harness } = play(fanOn(), { startPose: IN_ROOM });
  const events = runUntil(sim, () => sim.status !== 'running');
  const start = lineOf(sim, 'fan-start').time ?? 0;
  const done = lineOf(sim, 'fan-complete').time ?? 0;
  near(done - start, 3, 1e-9, 'three seconds');
  assert.equal(sim.world.time, done, 'the attempt ended on that tick');
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'mission-complete');
  assert.equal(sim.finishDetail, `Mission complete at ${clock(done)}: the fan blew at the fire for 3 seconds.`);
  // the score: all four, 100 points, and the time of the score is the time of the last achievement
  const report = sim.score();
  assert.equal(report.total, 100);
  assert.equal(report.max, 100);
  assert.equal(report.complete, true);
  assert.equal(report.time, done);
  assert.deepEqual(earned(sim), ACHIEVEMENT_IDS);
  assert.equal(lineOf(sim, 'fan-complete').detail, `done at ${clock(done)}: mission complete`);
  // times in the order they were earned
  const times = ACHIEVEMENT_IDS.map((id) => lineOf(sim, id).time ?? -1);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] >= times[i - 1]);
  // the log: the last points, then the end
  const finish = events.filter((e) => e.type === 'finish');
  assert.deepEqual(finish, [{ type: 'finish', reason: 'mission-complete', time: done, detail: sim.finishDetail }]);
  assert.ok(logOf(events).includes(`+40 points at ${clock(done)}: the fan blew at the fire for 3 seconds.`));
  // everything is switched off
  assert.equal(robot.fanOn, false);
  assert.equal(harness.io().dcMotorPower('M1'), 0);
});

test('40 points: "fan on, wait 3 seconds, fan off" is exactly enough', () => {
  let switchedOnAt = -1;
  let switchedOff = false;
  const { sim } = play(
    function* (io) {
      yield* sleep(10);
      switchedOnAt = io.time;
      io.setDcMotor('M1', 100);
      // what the "wait (3) seconds" block does: the program goes on once 3 s have passed
      const until = io.time + 3;
      yield;
      while (io.time < until - 1e-9) yield;
      switchedOff = true;
      io.stopDcMotor('M1');
      yield* forever();
    },
    { startPose: IN_ROOM },
  );
  runUntil(sim, () => sim.status !== 'running');
  assert.equal(sim.finishReason, 'mission-complete');
  assert.equal(sim.score().total, 100);
  // the fan blew for 300 ticks of 1/100 s: the mission is complete at the very moment the wait is over
  assert.equal(sim.world.tick, 10 + 300);
  near(sim.world.time, switchedOnAt + 3, 1e-9);
  assert.equal(switchedOff, false, 'the referee called "complete" before the program switched the fan off');
  assert.equal(lineOf(sim, 'fan-start').time, switchedOnAt);
  near((lineOf(sim, 'fan-complete').time ?? 0) - switchedOnAt, 3, 1e-9);
});

test('40 points: one tick short of 3 seconds is not enough', () => {
  const { sim } = play(
    function* (io) {
      yield* sleep(10);
      io.setDcMotor('M1', 100);
      yield* sleep(299); // the fan runs for 299 ticks: the action lasts 2.99 s
      io.stopDcMotor('M1');
      yield* forever();
    },
    { startPose: IN_ROOM },
  );
  const events = runUntil(sim, () => sim.world.time > 6);
  assert.equal(sim.status, 'running');
  assert.equal(lineOf(sim, 'fan-start').ok, true);
  assert.equal(lineOf(sim, 'fan-complete').ok, false);
  assert.equal(sim.score().total, 10 + 20 + 30);
  assert.ok(logOf(events).includes('The fan action stopped after 2.9 s: the fan is off. The 3 seconds start again.'));
  assert.equal(
    lineOf(sim, 'fan-complete').detail,
    'the fan action stopped too early (the fan is off) - hold it for 3 seconds without a break',
  );
});

test('40 points: a break keeps the 30 points; the 3 seconds start again with the next action', () => {
  const { sim } = play(
    function* (io) {
      yield* sleep(10);
      io.setDcMotor('M1', 100);
      yield* sleep(250); // 2.5 s ...
      io.stopDcMotor('M1'); // ... a break of a quarter of a second ...
      yield* sleep(25);
      io.setDcMotor('M1', 100); // ... and a new action
      yield* forever();
    },
    { startPose: IN_ROOM },
  );
  let second = -1;
  let wasOff = false;
  const robot = sim.world.robot;
  const events = runUntil(sim, () => {
    if (lineOf(sim, 'fan-start').ok && !robot.fanOn) wasOff = true;
    // (seen at the end of a tick: the fan came on again at the beginning of that tick)
    if (wasOff && robot.fanOn && second < 0) second = sim.world.time - sim.dt;
    return sim.status !== 'running';
  });
  const first = lineOf(sim, 'fan-start').time ?? 0;
  const done = lineOf(sim, 'fan-complete').time ?? 0;
  assert.ok(second > first + 2.7, `first action at ${first}, second at ${second}`);
  near(done - second, 3, 1e-9, 'three seconds after the SECOND action began');
  assert.ok(done - first > 5.7);
  assert.equal(sim.score().total, 100);
  assert.equal(logOf(events).filter((t) => t.startsWith('+30')).length, 1, 'the 30 points are given once');
  assert.deepEqual(
    logOf(events).filter((t) => t.startsWith('The fan action stopped')),
    ['The fan action stopped after 2.5 s: the fan is off. The 3 seconds start again.'],
  );
});

test('40 points: moving during the action breaks it, too', () => {
  const { sim } = play(
    function* (io) {
      yield* sleep(10);
      io.setDcMotor('M1', 100);
      yield* sleep(200);
      yield* drive(io, 10, 20); // a little nearer, with the fan still on
      yield* forever();
    },
    { startPose: IN_ROOM },
  );
  const events = runUntil(sim, () => sim.status !== 'running');
  const first = lineOf(sim, 'fan-start').time ?? 0;
  const done = lineOf(sim, 'fan-complete').time ?? 0;
  assert.ok(done - first > 5, `the action began at ${first} but was only complete at ${done}`);
  assert.equal(logOf(events).filter((t) => t.includes('the robot is moving - it must stand still')).length, 1);
  assert.equal(sim.score().total, 100);
});

test('mission complete without the room: the fan action from just outside the room gives 80 points', () => {
  // (the fan reaches 300 mm: far enough to stand in the cell below the living room)
  const pose = aimedAt(BACK_TARGET, 290);
  const { sim } = play(fanOn(), { startPose: pose });
  runUntil(sim, () => sim.status !== 'running');
  assert.equal(sim.finishReason, 'mission-complete');
  assert.deepEqual(earned(sim), ['leave-start', 'fan-start', 'fan-complete']);
  const report = sim.score();
  assert.equal(report.total, 80);
  assert.equal(report.complete, false, 'not every achievement');
});

// =============================================================================================
// The ends of an attempt
// =============================================================================================

test('end: after 180 seconds, with the points earned so far', () => {
  const { sim } = play(function* (io) {
    yield* drive(io, 300, 90);
    yield* forever();
  });
  sim.start();
  sim.step(17999);
  assert.equal(sim.status, 'running');
  near(sim.timeLeft, 0.01, 1e-9);
  sim.step(1);
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'time');
  assert.equal(sim.finishDetail, null);
  assert.equal(sim.world.time, 180);
  assert.equal(sim.score().total, 10);
});

test('end: when the team says "Finished", with the points earned so far', () => {
  const { sim } = play(
    function* (io) {
      yield* sleep(10);
      io.setDcMotor('M1', 100);
      yield* forever();
    },
    { startPose: IN_ROOM },
  );
  runUntil(sim, () => lineOf(sim, 'fan-start').ok);
  sim.step(100);
  sim.declareFinished();
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'declared');
  assert.equal(sim.score().total, 10 + 20 + 30);
  assert.equal(lineOf(sim, 'fan-complete').ok, false);
  sim.step(500);
  assert.equal(sim.score().total, 60, 'nothing more after the end');
});

test('end: when the program has ended and the robot stands still, with the points earned so far', () => {
  const { sim } = play(function* (io) {
    yield* drive(io, 300, 90);
  });
  sim.start();
  sim.step(2000);
  assert.equal(sim.finishReason, 'program-ended');
  assert.equal(sim.score().total, 10);
});

test('end: at once when the robot displaces the target - the points earned before stay', () => {
  // the target stands at the side wall of the living room; the robot comes up along that wall
  // and pushes it away with its left front corner
  const { sim, target } = play(
    function* (io) {
      yield* sleep(20);
      io.setWheelRpm('left', 60);
      io.setWheelRpm('right', 60);
      yield* forever();
    },
    { scenario: openField('living', 'side'), startPose: { x: 75, y: 420, heading: 0 } },
  );
  let shiftBefore = 0;
  const events = runUntil(sim, () => {
    if (sim.status !== 'running') return true;
    shiftBefore = targetShift(target);
    return false;
  });
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'target-displaced');
  // at once: one tick earlier it had not been moved clearly yet
  assert.ok(shiftBefore <= TARGET_DISPLACED_MM, `shift one tick before: ${shiftBefore}`);
  assert.ok(targetShift(target) > TARGET_DISPLACED_MM && targetShift(target) < TARGET_DISPLACED_MM + 3);
  assert.equal(TARGET_DISPLACED_MM, 5);
  assert.equal(
    sim.finishDetail,
    `The robot pushed the fire target out of its place (by ${Math.round(targetShift(target))} mm). The attempt ends here; the points earned before stay.`,
  );
  assert.deepEqual(events.filter((e) => e.type === 'finish'), [
    { type: 'finish', reason: 'target-displaced', time: sim.world.time, detail: sim.finishDetail },
  ]);
  // it had left START (it started outside) - those 10 points stay; it never was inside the room
  assert.equal(sim.score().total, 10);
  assert.deepEqual(earned(sim), ['leave-start']);
  assert.ok(sim.world.time < 3);
});

test('end: nothing is earned on the tick of the displacement, and nothing after it', () => {
  // a robot that would enter the living room completely on the very move that pushes the target away
  const { sim } = play(
    function* (io) {
      io.setDcMotor('M1', 100);
      io.setWheelRpm('left', 100);
      io.setWheelRpm('right', 100);
      yield* forever();
    },
    { scenario: openField('living', 'side'), startPose: { x: 75, y: 420, heading: 0 } },
  );
  runUntil(sim, () => sim.status !== 'running');
  assert.equal(sim.finishReason, 'target-displaced');
  assert.equal(lineOf(sim, 'enter-room').ok, false);
  assert.equal(lineOf(sim, 'fan-start').ok, false);
  const total = sim.score().total;
  sim.step(100);
  assert.equal(sim.score().total, total);
});

test('not an end: a touch that moves the target by a millimetre or two', () => {
  const { sim, target, robot } = play(
    function* (io) {
      yield* sleep(20);
      // up along the side wall until the corner of the robot has pushed the target by about 2 mm
      io.setWheelRpm('left', 6);
      io.setWheelRpm('right', 6);
      yield* waitUntil(() => robot.touching);
      yield* sleep(8);
      io.stopWheel('all');
      yield* sleep(50);
      yield* drive(io, -150, 60);
      yield* forever();
    },
    { scenario: openField('living', 'side'), startPose: { x: 75, y: 420, heading: 0 } },
  );
  sim.start();
  sim.step(4000);
  assert.equal(sim.status, 'running', 'the attempt goes on');
  const shift = targetShift(target);
  assert.ok(shift > 0.5 && shift <= TARGET_DISPLACED_MM, `the target was moved by ${shift} mm`);
  assert.equal(sim.score().total, 10);
});

test('wall contact is allowed: a robot that pushes against a wall for a minute loses nothing', () => {
  const { sim, robot } = play(
    function* (io) {
      io.setWheelRpm('left', 150);
      io.setWheelRpm('right', 150);
      yield* forever();
    },
    { scenario: withWall(openField(), wallIndexBetween({ col: 2, row: 2 }, { col: 2, row: 3 }), true) },
  );
  sim.start();
  sim.step(6000);
  assert.equal(sim.status, 'running');
  assert.equal(robot.touching, true);
  near(robot.pose.y - FRONT, 901.5, 0.05, 'it stands against the wall two cells up');
  assert.equal(sim.score().total, 10);
  const bumps = sim.drainEvents().filter((e) => e.type === 'bump');
  assert.deepEqual(bumps.map((e) => (e.type === 'bump' ? e.bodyId : '')), ['wall:C3-C4']);
});

// =============================================================================================
// §10 Restart
// =============================================================================================

test('restart: the robot goes back to START, the points are cleared, the clock keeps running', () => {
  const { sim, robot, harness } = play(
    function* (io) {
      yield* drive(io, 300, 90);
      yield* turn(io, -90, 60);
      yield* forever();
    },
    { scenario: defaultScenario() },
  );
  const wallsBefore = JSON.stringify(sim.world.walls);
  runUntil(sim, () => sim.world.time >= 4);
  assert.equal(sim.score().total, 10);
  assert.equal(sim.restartsLeft, 1);
  const timeBefore = sim.world.time;

  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.equal(sim.restartsLeft, 0);
  assert.deepEqual(robot.pose, START_POSE, 'back in START as it started');
  assert.equal(sim.world.time, timeBefore, 'the clock keeps running');
  assert.equal(sim.status, 'running');
  assert.equal(harness.starts(), 2, 'the program starts again');
  // the points are cleared, with their times
  const report = sim.score();
  assert.equal(report.total, 0);
  assert.equal(report.time, undefined);
  assert.deepEqual(earned(sim), []);
  assert.equal(lineOf(sim, 'leave-start').time, undefined);
  assert.equal(lineOf(sim, 'restart').ok, false);
  assert.equal(
    lineOf(sim, 'restart').detail,
    `restart used at ${clock(timeBefore)}: the points earned before it were cleared`,
  );
  // the maze stays as it was
  assert.equal(JSON.stringify(sim.world.walls), wallsBefore);
  assert.deepEqual(sim.scenario, defaultScenario());

  // the points can be earned again - at their new, later times
  runUntil(sim, () => lineOf(sim, 'leave-start').ok);
  assert.ok((lineOf(sim, 'leave-start').time ?? 0) > timeBefore);
  assert.equal(sim.score().total, 10);
  // and the attempt still ends 180 s after its start, not after the restart
  sim.step(20000);
  assert.equal(sim.finishReason, 'time');
  assert.equal(sim.world.time, 180);
});

test('restart: once per attempt - a second one is refused and changes nothing', () => {
  const { sim, robot, harness } = play(function* (io) {
    yield* drive(io, 300, 90);
    yield* forever();
  });
  sim.start();
  sim.step(300);
  sim.restart();
  sim.step(300);
  assert.equal(sim.score().total, 10);
  sim.drainEvents();
  const pose = { ...robot.pose };

  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.deepEqual(robot.pose, pose, 'the robot stays where it is');
  assert.equal(sim.score().total, 10, 'the points stay');
  assert.equal(harness.starts(), 2);
  const events = sim.drainEvents();
  assert.equal(events.filter((e) => e.type === 'restart').length, 0);
  assert.deepEqual(
    events.flatMap((e) => (e.type === 'log' ? [`${e.level}: ${e.text}`] : [])),
    ['warn: No restart left: this game allows 1 restart per attempt.'],
  );
});

test('restart: a target that was nudged is put back, and the fan action starts from nothing', () => {
  const { sim, target, robot } = play(
    function* (io) {
      yield* sleep(20);
      io.setWheelRpm('left', 6);
      io.setWheelRpm('right', 6);
      yield* waitUntil(() => robot.touching);
      yield* sleep(8);
      io.stopWheel('all');
      yield* forever();
    },
    { scenario: openField('living', 'side'), startPose: { x: 75, y: 420, heading: 0 } },
  );
  sim.start();
  sim.step(3000);
  assert.ok(targetShift(target) > 0.5, 'nudged');
  sim.restart();
  assert.equal(targetShift(target), 0, 'the referee put the target back');
  assert.deepEqual([target.x, target.y, target.angle], [10, 150, Math.PI / 2]);
  assert.equal(sim.score().total, 0);
});

test('restart: an action that was going on does not count on after the restart', () => {
  const { sim, harness } = play(fanOn(), { startPose: IN_ROOM });
  runUntil(sim, () => lineOf(sim, 'fan-start').ok);
  sim.step(200); // two of the three seconds
  sim.restart();
  assert.deepEqual(earned(sim), []);
  // the restarted program does the same again from the same place: a full 3 seconds are needed
  const restartedAt = sim.world.time;
  runUntil(sim, () => sim.status !== 'running');
  assert.equal(harness.starts(), 2);
  assert.equal(sim.finishReason, 'mission-complete');
  const start = lineOf(sim, 'fan-start').time ?? 0;
  assert.ok(start > restartedAt);
  near((lineOf(sim, 'fan-complete').time ?? 0) - start, 3, 1e-9);
  assert.equal(sim.score().total, 100);
  assert.equal(lineOf(sim, 'restart').ok, false);
});

// =============================================================================================
// The referee's helpers
// =============================================================================================

test('fanProblem: says in student words why the action does not count', () => {
  const { sim, harness } = play(function* () { yield* forever(); }, { startPose: aimedAt(BACK_TARGET, 150) });
  const ctx = (): ScoreContext<FireChiefScenario> => ({
    scenario: sim.scenario,
    world: sim.world,
    robotConfig: sim.robotConfig,
    restarts: 0,
    robotShapes: sim.robotShapes(),
  });
  assert.equal(fanProblem(ctx(), true), 'the fan is off');
  harness.io().setDcMotor('M1', 100);
  assert.equal(fanProblem(ctx(), false), 'the robot is moving - it must stand still');
  assert.equal(fanProblem(ctx(), true), null);
});

test('referee: random mazes - the fire target is never where the robot starts, and START is never the fire room', () => {
  for (let seed = 0; seed < 50; seed++) {
    const scenario = randomScenario(makeRng(seed));
    const { sim, target } = play(function* () {}, { scenario });
    assert.equal(sim.world.walls?.length, 4 + wallCount(scenario), encodeScenario(scenario));
    assert.ok(target.y < 300 && (target.x < 300 || target.x > 1200));
    assert.equal(sim.score().total, 0);
  }
});
