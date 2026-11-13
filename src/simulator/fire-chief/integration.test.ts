/**
 * Fire Chief in real runs - the whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine (walls, sensors)  ->  Fire Chief referee
 *
 * In these tests the robot really drives from START through the maze; nothing is put into a room
 * by hand. Everything that has blocks today is a block program run by the real interpreter:
 * driving and turning, the ultrasonic sensor (walls), the Quad RGB sensor (the printed grid
 * lines), variables, loops.
 *
 * The flame sensor and the fan have no blocks yet (they come in the next round). Until then that
 * part of a mission is written against RobotIO - the seam the engine tests use: a small
 * "co-pilot" script runs the block program with the real interpreter first, and then reads the
 * flame sensor and switches the fan itself (runBlocks, lookAround and blowAt below).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { batchRuns, runMatch, type BatchResult } from '../core/batch';
import { createEngineSimulation } from '../core/engine';
import { makeProbeReading } from '../core/engine-sensors';
import { DEG, makeRng, wrapAngle, type Rect } from '../core/geometry';
import type { RobotIO } from '../core/io';
import { RasterMatSampler } from '../core/mat';
import { wheelDegreesForTurn } from '../core/robot';
import { createSimulation } from '../core/simulation';
import { scripted, sleep, turn as turnBy, type Script } from '../core/test-helpers';
import type { MatSampler, Pose, ProgramJson, RobotConfig, ScoreLine, SimEvent, Simulation, VM } from '../core/types';
import { createVM } from '../vm';
import {
  add,
  and,
  changeVar,
  eq,
  forever,
  ifThen,
  lt,
  mod,
  move,
  moveCm,
  not,
  or,
  probeDetects,
  program,
  repeat,
  script,
  setVar,
  stop,
  stopMotors,
  turn,
  ultrasonic,
  v,
  waitUntil,
  whenStart,
} from '../vm/builder';
import {
  BEDROOM_CELL,
  FIELD_SIZE,
  FIRE_SPOTS,
  GRID_LINE_COLOR,
  GRID_LINE_STARTS,
  GRID_LINE_WIDTH,
  LIVING_ROOM_CELL,
  MAT_VECTOR,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  START_RECT,
  cellCenter,
  cellFromNumber,
  cellName,
  cellRect,
  roomRect,
  sameCell,
  wallIndexBetween,
  type Cell,
  type RoomId,
} from './field';
import { TARGET_BODY_ID, fireChiefGame, roomAround, targetOf } from './game';
import { FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import {
  NAMED_MAZES,
  defaultScenario,
  encodeScenario,
  openField,
  randomScenario,
  wallBetweenCells,
  withFire,
  withWall,
  type FireChiefScenario,
} from './scenario';

type Sim = Simulation<FireChiefScenario>;

// =============================================================================================
// Helpers
// =============================================================================================

/** Run a match to its end, 5 ticks at a time; `watch` is called after every slice. Returns all events. */
function runToEnd(sim: Sim, watch?: (sim: Sim) => void): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.status === 'ready') sim.start();
  while (sim.status === 'running') {
    sim.step(5);
    events.push(...sim.drainEvents());
    watch?.(sim);
  }
  events.push(...sim.drainEvents());
  return events;
}

/** Warnings and errors (a failed check inside a script ends up here too: the engine catches it). */
const problems = (events: SimEvent[]): string[] =>
  events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));

const bumps = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'bump' ? [e.bodyId] : []));

/** What the referee said during the match. */
const said = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'log' && e.level === 'info' ? [e.text] : []));

const lineOf = (lines: ScoreLine[], id: string): ScoreLine => {
  const line = lines.find((l) => l.id === id);
  assert.ok(line, `score line ${id} exists`);
  return line;
};

/** Points and time of the four achievements, e.g. "10@2.51 20@29.02 30@31.73 40@34.73". */
const sheet = (lines: ScoreLine[]): string =>
  lines
    .filter((l) => l.max > 0)
    .map((l) => `${l.points}@${l.time === undefined ? '-' : l.time.toFixed(2)}`)
    .join(' ');

/** Degrees between the robot's heading and the direction from its turning point to the fire target. */
function aimErrorDeg(sim: Sim): number {
  const target = targetOf(sim.world);
  assert.ok(target, 'the fire target is on the field');
  const pose = sim.world.robot.pose;
  const wanted = Math.atan2(target.x - pose.x, pose.y - target.y);
  return Math.abs(wrapAngle(wanted - pose.heading)) / DEG;
}

// ---- block programs

/** The way through the default maze ("Crossroads") from START to the living room, cell by cell. */
const ROUTE_CELLS = ['C5', 'C4', 'B4', 'A4', 'A3', 'A2', 'B2', 'B1', 'A1'];

/** The same way as a block program that knows it by heart (no sensor). It ends in the middle of the living room. */
const ROUTE_TO_LIVING_ROOM: ProgramJson = program([
  script(whenStart(), [
    moveCm('forward', 30), // C5 -> C4
    turn('left', 90),
    moveCm('forward', 60), // -> A4
    turn('right', 90),
    moveCm('forward', 60), // -> A2
    turn('right', 90),
    moveCm('forward', 30), // -> B2
    turn('left', 90),
    moveCm('forward', 30), // -> B1
    turn('left', 90),
    moveCm('forward', 30), // -> A1, the living room
  ]),
]);

/** Where the wall follower is: its cell and the way it faces (0 = up, 1 = right, 2 = down, 3 = left). */
interface Place {
  col: number;
  row: number;
  dir: number;
}

const AT_START: Place = { col: START_CELL.col, row: START_CELL.row, dir: 0 };

/**
 * A maze solver made of blocks that exist today: "keep your left hand on the wall".
 *
 * In every cell it looks left first (ultrasonic sensor: a wall is nearer than 20 cm), then
 * straight ahead, then right, then back, and drives one cell (30 cm) the first free way. It
 * counts the cell it is in with three variables and stops as soon as it stands in one of the
 * rooms it was sent to (`roomCols`: the columns of those rooms; both rooms are in the top row).
 *
 * START lies on the outer wall, so the left hand is on the outer wall (or on a wall joined to
 * it) from the first step on: this way round passes every cell on the edge of the field, and so
 * both rooms, in every maze that can be played.
 */
function wallFollower(from: Place, roomCols: number[]): ProgramJson {
  const wallAhead = () => lt(ultrasonic(), 20);
  const turnRight = () => [turn('right', 90), setVar('dir', mod(add(v('dir'), 1), 4))];
  const inARoom = and(
    eq(v('row'), 0),
    roomCols.map((col) => eq(v('col'), col)).reduce((either, one) => or(either, one)),
  );
  return program([
    script(whenStart(), [
      setVar('col', from.col),
      setVar('row', from.row),
      setVar('dir', from.dir),
      forever([
        turn('left', 90),
        setVar('dir', mod(add(v('dir'), 3), 4)),
        ifThen(wallAhead(), [...turnRight(), ifThen(wallAhead(), [...turnRight(), ifThen(wallAhead(), turnRight())])]),
        moveCm('forward', 30),
        ifThen(eq(v('dir'), 0), [changeVar('row', -1)]),
        ifThen(eq(v('dir'), 1), [changeVar('col', 1)]),
        ifThen(eq(v('dir'), 2), [changeVar('row', 1)]),
        ifThen(eq(v('dir'), 3), [changeVar('col', -1)]),
        ifThen(inARoom, [stop('all')]),
      ]),
    ]),
  ]);
}

/** Drive forward until the Quad RGB probe L1 has crossed `lines` printed grid lines, then stop. */
const crossLines = (lines: number) => [
  move('forward', 50),
  repeat(lines, [waitUntil(probeDetects('L1', 'line')), waitUntil(not(probeDetects('L1', 'line')))]),
  stopMotors(),
];

/**
 * Finding the living room of the open field by counting the printed grid lines.
 *
 * The robot first leaves START without looking down (15 cm: its probes are then past the line
 * at the top of START) - the START picture has dark parts that would count as lines. Three more
 * lines up is the top row; then two lines to the left is column A. After a line the probes
 * (85 mm ahead of the turning point) are just past the boundary of two cells, so 23.5 cm more
 * puts the turning point in the middle of the next cell.
 */
const LINE_COUNTER: ProgramJson = program([
  script(whenStart(), [
    moveCm('forward', 15),
    ...crossLines(3),
    moveCm('forward', 23.5),
    turn('left', 90),
    ...crossLines(2),
    moveCm('forward', 23.5),
  ]),
]);

// ---- the co-pilot: what has no blocks yet, written against RobotIO

/** Run a block program with the real interpreter, one step per tick, until it has ended. */
function* runBlocks(io: RobotIO, blocks: ProgramJson): Generator<void, VM, void> {
  const vm = createVM(blocks, io);
  vm.start();
  for (;;) {
    vm.step();
    if (vm.idle) break;
    yield;
  }
  assert.deepEqual(vm.errors(), [], 'the interpreter found no problem in the block program');
  return vm;
}

/** Where the flame sensor read its highest value during a turn (yaw: degrees turned since the turn began). */
interface Sighting {
  value: number;
  yawDeg: number;
}

/** Turn once round on the spot and remember where the flame sensor read the highest value. */
function* lookAround(io: RobotIO, rpm = 30): Generator<void, Sighting, void> {
  const best: Sighting = { value: 0, yawDeg: 0 };
  io.resetYaw();
  const wheel = wheelDegreesForTurn(io.config, 360);
  io.startMotion(wheel, -wheel, rpm);
  while (!io.motionDone()) {
    yield;
    const value = io.flameValue();
    if (value > best.value) {
      best.value = value;
      best.yawDeg = io.yawDeg();
    }
  }
  return best;
}

/** Turn back to where the flame was strongest, stand still, and blow at it for longer than 3 seconds. */
function* blowAt(io: RobotIO, seen: Sighting): Generator<void, void, void> {
  yield* turnBy(io, seen.yawDeg > 180 ? seen.yawDeg - 360 : seen.yawDeg, 40);
  yield* sleep(5);
  io.setDcMotor('M1', 100);
  yield* sleep(350); // (the referee ends the attempt after 300 ticks)
  io.stopDcMotor('M1');
}

/** What the co-pilot found in a room it looked around in. */
interface Visit {
  room: RoomId;
  /** highest flame value during the turn */
  flame: number;
  detected: boolean;
}

const threshold = (io: RobotIO): number => io.config.flameSensor?.threshold ?? 0;

/**
 * A whole mission: blocks drive to a room; there the co-pilot looks around with the flame
 * sensor. A flame: turn to it and blow. No flame: the blocks go on to the other room.
 */
function explorer(visits: Visit[]): Script {
  return function* (io: RobotIO) {
    let at = AT_START;
    let rooms = [LIVING_ROOM_CELL.col, BEDROOM_CELL.col];
    while (rooms.length > 0) {
      const vm = yield* runBlocks(io, wallFollower(at, rooms));
      const now = vm.variables();
      at = { col: Number(now.col), row: Number(now.row), dir: Number(now.dir) };
      const seen = yield* lookAround(io);
      const detected = seen.value > threshold(io);
      visits.push({ room: at.col === LIVING_ROOM_CELL.col ? 'living' : 'bedroom', flame: seen.value, detected });
      if (detected) {
        yield* blowAt(io, seen);
        return;
      }
      rooms = rooms.filter((col) => col !== at.col);
    }
  };
}

function explore(scenario: FireChiefScenario, o: { robotConfig?: RobotConfig; seed?: number } = {}) {
  const visits: Visit[] = [];
  const harness = scripted(explorer(visits));
  const sim = createEngineSimulation(
    { game: fireChiefGame, scenario, program: {}, robotConfig: o.robotConfig, seed: o.seed },
    harness.factory,
  );
  return { sim, visits, harness };
}

// =============================================================================================
// Blocks only: driving through the maze
// =============================================================================================

test('real run, blocks only: a route learned by heart through the default maze earns 10 + 20 points', () => {
  const scenario = defaultScenario();
  // the route really is a way through this maze: no wall between two cells that follow each other
  const cells: Cell[] = ROUTE_CELLS.map((name) => ({ col: 'ABCDE'.indexOf(name[0]), row: Number(name[1]) - 1 }));
  assert.deepEqual(cells.map(cellName), ROUTE_CELLS);
  for (let i = 1; i < cells.length; i++) {
    assert.equal(wallBetweenCells(scenario.walls, cells[i - 1], cells[i]), false, `${ROUTE_CELLS[i - 1]} -> ${ROUTE_CELLS[i]}`);
  }

  const sim = createSimulation({ game: fireChiefGame, scenario, program: ROUTE_TO_LIVING_ROOM });
  assert.equal(sim.robotConfig, FIRE_CHIEF_ROBOT, 'the robot of the game is used when none is named');
  assert.deepEqual(sim.world.robot.pose, START_POSE);
  let touched = false;
  const events = runToEnd(sim, () => {
    if (sim.world.robot.touching) touched = true;
  });

  // the program has ended, the robot stands in the middle of the living room, facing left
  assert.equal(sim.finishReason, 'program-ended');
  assert.equal(sim.finishDetail, null);
  assert.deepEqual(sim.vm.errors(), []);
  const pose = sim.world.robot.pose;
  const middle = cellCenter(LIVING_ROOM_CELL);
  assert.ok(Math.hypot(pose.x - middle.x, pose.y - middle.y) < 0.5, `robot at ${pose.x}, ${pose.y}`);
  assert.ok(Math.abs(wrapAngle(pose.heading + Math.PI / 2)) < 0.01 * DEG, 'facing left');
  assert.equal(roomAround(sim.robotShapes()), 'living');

  // 10 + 20 points, each with its time; nothing for a fan that never ran
  const report = sim.score();
  assert.equal(report.total, 30);
  assert.equal(report.complete, false);
  const left = lineOf(report.lines, 'leave-start');
  const room = lineOf(report.lines, 'enter-room');
  assert.deepEqual([left.points, room.points], [10, 20]);
  assert.ok(left.time !== undefined && room.time !== undefined && left.time > 1 && left.time < room.time);
  assert.ok(room.time < sim.world.time);
  assert.equal(report.time, room.time, 'the score was reached when the robot was inside the room');
  assert.equal(lineOf(report.lines, 'fan-start').detail, 'not yet - the fan is off');
  assert.equal(said(events).length, 2);
  assert.match(said(events)[0], /^\+10 points at 0:0\d\.\d: the robot has left START completely\.$/);
  assert.match(said(events)[1], /^\+20 points at 0:\d\d\.\d: the robot is completely inside the living room\.$/);

  // it never touched a wall or the target on the way
  assert.equal(touched, false);
  assert.deepEqual(bumps(events), []);
  assert.deepEqual(problems(events), []);
  const target = targetOf(sim.world);
  assert.ok(target);
  assert.deepEqual([target.x, target.y, target.angle], [target.home.x, target.home.y, target.home.angle]);
});

test('real run, blocks only: the Quad RGB sensor counts the printed grid lines to find the living room', () => {
  const sim = createSimulation({ game: fireChiefGame, scenario: openField('bedroom', 'back'), program: LINE_COUNTER });
  let linesSeen = 0;
  let onLine = false;
  sim.start();
  const events: SimEvent[] = [];
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    const now = sim.readSensors().probes.L1.onLine;
    if (now && !onLine) linesSeen++;
    onLine = now;
  }
  assert.equal(sim.finishReason, 'program-ended');
  assert.deepEqual(sim.vm.errors(), []);
  assert.equal(linesSeen, 6, 'probe L1 crossed six grid lines on the way (the first one while leaving START)');
  const pose = sim.world.robot.pose;
  const middle = cellCenter(LIVING_ROOM_CELL);
  assert.ok(Math.hypot(pose.x - middle.x, pose.y - middle.y) < 8, `robot at ${pose.x}, ${pose.y}`);
  assert.equal(roomAround(sim.robotShapes()), 'living');
  assert.equal(sim.score().total, 30);
  assert.deepEqual(bumps(events), []);
  assert.deepEqual(problems(events), []);
});

test('real run, blocks only: the wall follower reaches a room in every named maze (batch runner)', () => {
  const blocks = wallFollower(AT_START, [LIVING_ROOM_CELL.col, BEDROOM_CELL.col]);
  const scenarios = NAMED_MAZES.map((m) => m.scenario);
  const results = [...batchRuns({ game: fireChiefGame, program: blocks, scenarios })];
  assert.deepEqual(results.map((r) => r.scenarioCode), scenarios.map(encodeScenario));
  for (const result of results) {
    const code = result.scenarioCode;
    // "stop all" in the room ends the program, and with it the attempt
    assert.equal(result.finishReason, 'program-ended', code);
    assert.equal(result.finishDetail, undefined, code);
    assert.equal(result.errors, undefined, code);
    assert.equal(result.total, 30, code);
    assert.equal(result.max, 100, code);
    assert.equal(result.complete, false, code);
    assert.equal(result.restarts, 0, code);
    assert.equal(sheet(result.lines).replace(/@[\d.]+/g, ''), '10 20 0@- 0@-', code);
    // the time of the score is the time of the room points; the match went on for a moment after it
    assert.equal(result.scoreTime, lineOf(result.lines, 'enter-room').time, code);
    assert.ok(result.scoreTime !== undefined && result.scoreTime < result.time && result.time < 60, `${code}: ${result.time} s`);
  }
  // one match alone gives the same result
  assert.deepEqual(runMatch({ game: fireChiefGame, program: blocks, scenario: scenarios[2] }), results[2]);
});

// =============================================================================================
// Blocks + co-pilot: the whole mission
// =============================================================================================

test('real run: blocks drive to the living room, the flame sensor finds the fire, the fan blows 3 s - 100 points', () => {
  const seenInRoom: Sighting = { value: 0, yawDeg: 0 };
  let detectedBeforeFan = false;
  let fanSwitchedOnAt = -1;
  let programSwitchedFanOff = false;
  const harness = scripted(function* (io) {
    yield* runBlocks(io, ROUTE_TO_LIVING_ROOM);
    Object.assign(seenInRoom, yield* lookAround(io));
    yield* turnBy(io, seenInRoom.yawDeg > 180 ? seenInRoom.yawDeg - 360 : seenInRoom.yawDeg, 40);
    yield* sleep(5);
    detectedBeforeFan = io.flameDetected();
    fanSwitchedOnAt = io.time;
    io.setDcMotor('M1', 100);
    yield* sleep(350);
    programSwitchedFanOff = true;
    io.stopDcMotor('M1');
  });
  const sim = createEngineSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: {} }, harness.factory);
  let fanTicks = 0;
  let touched = false;
  sim.start();
  const events: SimEvent[] = [];
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    if (sim.world.robot.fanOn) fanTicks++;
    if (sim.world.robot.touching) touched = true;
  }
  events.push(...sim.drainEvents());
  assert.deepEqual(problems(events), []);

  // the sensor found the fire: strongest where the robot looks straight at it
  assert.ok(seenInRoom.value > 60, `highest flame value in the room: ${seenInRoom.value}`);
  assert.equal(detectedBeforeFan, true);
  assert.ok(aimErrorDeg(sim) < 2, `the robot points ${aimErrorDeg(sim)} degrees beside the target`);
  assert.equal(sim.readSensors().flameDetected, true);

  // the referee: mission complete, 3 seconds after the fan came on
  assert.equal(sim.finishReason, 'mission-complete');
  assert.match(sim.finishDetail ?? '', /^Mission complete at 0:\d\d\.\d: the fan blew at the fire for 3 seconds\.$/);
  const report = sim.score();
  assert.equal(report.total, 100);
  assert.equal(report.complete, true);
  const times = report.lines.filter((l) => l.max > 0).map((l) => l.time ?? -1);
  assert.equal(times.length, 4);
  for (let i = 1; i < 4; i++) assert.ok(times[i] > times[i - 1], `the times rise: ${times.join(', ')}`);
  assert.equal(times[2], fanSwitchedOnAt, 'the 30 points carry the time the fan was switched on');
  assert.ok(Math.abs(times[3] - times[2] - 3) < 1e-9, 'the 40 points come exactly 3 seconds later');
  assert.equal(times[3], sim.world.time);
  assert.equal(report.time, times[3], 'the ranking time is the time of the last achievement');
  assert.deepEqual(
    said(events).map((text) => text.slice(0, 10)),
    ['+10 points', '+20 points', '+30 points', '+40 points'],
  );
  assert.equal(events.filter((e) => e.type === 'finish').length, 1);

  // The attempt ended before the program switched the fan off; the engine stopped it.
  // (The fan blew during 300 ticks. Seen from outside, after each tick, it was on 299 times:
  // when the 300th tick was over, the attempt had ended and the motor was already stopped.)
  assert.equal(fanTicks, 299);
  assert.equal(programSwitchedFanOff, false);
  assert.equal(sim.world.robot.fanOn, false);
  assert.equal(sim.readSensors().dcMotorPower.M1, 0);

  // nothing was touched: no wall, and not the target
  assert.equal(touched, false);
  assert.deepEqual(bumps(events), []);
  const target = targetOf(sim.world);
  assert.ok(target);
  assert.deepEqual([target.x, target.y], [target.home.x, target.home.y]);
});

test('real run: a wall follower made of blocks plus the flame sensor and the fan solves every named maze', () => {
  for (const { id, scenario } of NAMED_MAZES) {
    const { sim, visits } = explore(scenario);
    let touched = false;
    const events = runToEnd(sim, () => {
      if (sim.world.robot.touching) touched = true;
    });
    assert.deepEqual(problems(events), [], id);
    assert.equal(sim.finishReason, 'mission-complete', id);
    const report = sim.score();
    assert.equal(report.total, 100, `${id}: ${sheet(report.lines)}`);
    assert.ok(sim.world.time < 120, `${id}: done after ${sim.world.time} s`);
    assert.equal(report.time, sim.world.time, id);
    // it looked around in one room or in both; the last one is the room with the fire
    assert.ok(visits.length === 1 || visits.length === 2, id);
    const last = visits[visits.length - 1];
    assert.equal(last.room, scenario.fireRoom, id);
    assert.equal(last.detected, true, id);
    assert.ok(aimErrorDeg(sim) < 2.5, `${id}: aimed ${aimErrorDeg(sim)} degrees beside the target`);
    if (visits.length === 2) {
      // in the room without the fire the flame sensor read nothing at all, all the way round
      assert.notEqual(visits[0].room, scenario.fireRoom, id);
      assert.equal(visits[0].flame, 0, id);
      // the 20 points came from that first room, long before the fan
      const room = lineOf(report.lines, 'enter-room');
      assert.equal(room.detail.endsWith(`(${ROOMS[visits[0].room].name})`), true, id);
    }
    // a robot that keeps to the middle of the cells touches nothing
    assert.equal(touched, false, id);
    assert.deepEqual(bumps(events), [], id);
  }
  // the named mazes cover both cases: the fire in the first room the follower comes to, and in the second
  const firstRoom = NAMED_MAZES.map(({ scenario }) => {
    const { sim, visits } = explore(scenario);
    runToEnd(sim);
    return visits.length;
  });
  assert.ok(firstRoom.includes(1) && firstRoom.includes(2), `rooms looked at: ${firstRoom.join(', ')}`);
});

test('real run: the same robot solves 40 random mazes, with the fire at every place', () => {
  const seenPlaces = new Set<string>();
  let slowest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const scenario = randomScenario(makeRng(seed));
    const code = encodeScenario(scenario);
    seenPlaces.add(`${scenario.fireRoom} ${scenario.fireSpot}`);
    const { sim, visits } = explore(scenario);
    const events = runToEnd(sim);
    assert.deepEqual(problems(events), [], code);
    assert.equal(sim.finishReason, 'mission-complete', code);
    assert.equal(sim.score().total, 100, `${code}: ${sheet(sim.score().lines)}`);
    assert.equal(visits[visits.length - 1].room, scenario.fireRoom, code);
    assert.deepEqual(bumps(events), [], code);
    slowest = Math.max(slowest, sim.world.time);
  }
  assert.equal(seenPlaces.size, ROOM_IDS.length * FIRE_SPOTS.length, 'the 40 mazes have the fire at all six places');
  assert.ok(slowest < 180, `the slowest run took ${slowest} s`);
});

// =============================================================================================
// The flame sensor in the maze
// =============================================================================================

/** Highest flame value, and whether a flame was ever "detected", while the robot turns once round at `pose`. */
function flameAround(scenario: FireChiefScenario, pose: Pose): { highest: number; detected: boolean; aimError: number } {
  const out = { highest: 0, detected: false, aimError: 0 };
  const harness = scripted(function* (io) {
    const wheel = wheelDegreesForTurn(io.config, 360);
    io.startMotion(wheel, -wheel, 30);
    let bestHeading = 0;
    while (!io.motionDone()) {
      yield;
      const value = io.flameValue();
      if (io.flameDetected()) out.detected = true;
      if (value > out.highest) {
        out.highest = value;
        bestHeading = sim.world.robot.pose.heading;
      }
    }
    const target = targetOf(sim.world);
    if (target) {
      const wanted = Math.atan2(target.x - pose.x, pose.y - target.y);
      out.aimError = Math.abs(wrapAngle(wanted - bestHeading)) / DEG;
    }
  });
  const sim: Sim = createEngineSimulation({ game: fireChiefGame, scenario, program: {}, startPose: pose }, harness.factory);
  const events = runToEnd(sim);
  assert.deepEqual(problems(events).filter((text) => !text.includes('start zone')), []);
  return out;
}

const middleOf = (room: RoomId): Pose => {
  const rect = roomRect(room);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, heading: 0 };
};

test('flame sensor in the maze: in the room with the fire a full turn finds it, in the other room it reads 0', () => {
  for (const fireRoom of ROOM_IDS) {
    const otherRoom: RoomId = fireRoom === 'living' ? 'bedroom' : 'living';
    for (const fireSpot of FIRE_SPOTS) {
      // the open field is the hardest case: no inner wall hides the flame from the other room
      const scenario = openField(fireRoom, fireSpot);
      const here = flameAround(scenario, middleOf(fireRoom));
      assert.ok(here.highest > 50, `${fireRoom} ${fireSpot}: highest value ${here.highest}`);
      assert.equal(here.detected, true, `${fireRoom} ${fireSpot}`);
      assert.ok(here.aimError < 1.5, `${fireRoom} ${fireSpot}: the highest value is ${here.aimError} degrees beside the target`);
      const there = flameAround(scenario, middleOf(otherRoom));
      assert.equal(there.highest, 0, `${fireRoom} ${fireSpot}: seen from the ${otherRoom}`);
      assert.equal(there.detected, false, `${fireRoom} ${fireSpot}`);
    }
  }
});

test('flame sensor in the maze: a wall of the maze hides the flame, the open door shows it', () => {
  // the cell below the living room (A2); the fire stands in the corner of the room and looks this way
  const below: Pose = { ...cellCenter({ col: 0, row: 1 }), heading: 0 };
  const boundary = wallIndexBetween(LIVING_ROOM_CELL, { col: 0, row: 1 });
  const open = withFire(openField(), 'living', 'corner');
  const walled = withWall(open, boundary, true);
  const throughDoor = flameAround(open, below);
  assert.ok(throughDoor.highest > 20, `through the open boundary: ${throughDoor.highest}`);
  assert.equal(throughDoor.detected, true);
  assert.ok(throughDoor.aimError < 3, `aimed ${throughDoor.aimError} degrees beside the target`);
  const behindWall = flameAround(walled, below);
  assert.equal(behindWall.highest, 0);
  assert.equal(behindWall.detected, false);
  // in the default maze that wall stands: from A2 the fire in the living room cannot be seen
  assert.equal(defaultScenario().walls[boundary], true);
  assert.equal(flameAround(defaultScenario(), below).highest, 0);
});

// =============================================================================================
// Restart, and the same run twice
// =============================================================================================

test('real run: a restart on the way - back to START, the points are gone, the program starts again and completes', () => {
  const { sim, visits, harness } = explore(defaultScenario());
  sim.start();
  const events: SimEvent[] = [];
  while (sim.status === 'running' && sim.score().total < 30) {
    sim.step(1);
    events.push(...sim.drainEvents());
  }
  // the robot stands in the living room with 10 + 20 points
  assert.equal(sim.score().total, 30);
  assert.equal(roomAround(sim.robotShapes()), 'living');
  assert.equal(sim.restartsLeft, 1);
  const restartAt = sim.world.time;

  sim.restart();
  assert.deepEqual(sim.world.robot.pose, START_POSE);
  assert.equal(sim.score().total, 0);
  assert.equal(sim.score().time, undefined);
  assert.equal(sim.world.time, restartAt, 'the clock keeps running');
  assert.equal(sim.restarts, 1);
  assert.equal(sim.restartsLeft, 0);
  assert.equal(harness.starts(), 2, 'the program was started again');

  // a second restart is refused
  sim.restart();
  assert.equal(sim.restarts, 1);
  events.push(...sim.drainEvents());
  assert.deepEqual(problems(events), ['No restart left: this game allows 1 restart per attempt.']);

  const rest = runToEnd(sim);
  assert.deepEqual(problems(rest), []);
  assert.equal(sim.finishReason, 'mission-complete');
  const report = sim.score();
  assert.equal(report.total, 100);
  for (const line of report.lines.filter((l) => l.max > 0)) {
    assert.ok(line.time !== undefined && line.time > restartAt, `${line.id} was earned after the restart`);
  }
  assert.equal(lineOf(report.lines, 'restart').ok, false);
  assert.match(lineOf(report.lines, 'restart').detail, /^restart used at 0:\d\d\.\d: the points earned before it were cleared$/);
  // (the first try ended before the robot looked around: only the second try reached that point)
  assert.deepEqual(visits.map((visit) => visit.room), ['living']);
});

/** Everything that can be told about a finished run. */
function fingerprint(sim: Sim, events: SimEvent[]): string {
  const robot = sim.world.robot;
  return JSON.stringify({
    reason: sim.finishReason,
    detail: sim.finishDetail,
    tick: sim.world.tick,
    pose: robot.pose,
    yaw: robot.yawDeg,
    wheels: [robot.left.angleDeg, robot.right.angleDeg],
    target: sim.world.bodies.filter((b) => b.id === TARGET_BODY_ID).map((b) => [b.x, b.y, b.angle]),
    score: sim.score(),
    sensors: sim.readSensors(),
    events,
  });
}

test('the same run twice: every event, the final field and the score sheet are identical', () => {
  const scenario = NAMED_MAZES[3].scenario; // "Detour": the fire is in the second room the robot comes to
  const play = (o: { robotConfig?: RobotConfig; seed?: number } = {}): string => {
    const { sim } = explore(scenario, o);
    const events = runToEnd(sim);
    return fingerprint(sim, events);
  };
  const first = play();
  assert.equal(play(), first);
  assert.ok(first.includes('"reason":"mission-complete"'));
  // the seed changes nothing for a perfect robot ...
  assert.equal(play({ seed: 99 }), first);

  // ... a robot with slipping wheels and noisy sensors drives differently, but the same seed
  // gives the same run again, tick for tick
  const noisy: RobotConfig = {
    ...FIRE_CHIEF_ROBOT,
    noise: { wheelSlip: 0.02, sensor: 6, ultrasonicCm: 0.3, flame: 1 },
  };
  const noisyFirst = play({ robotConfig: noisy, seed: 7 });
  assert.equal(play({ robotConfig: noisy, seed: 7 }), noisyFirst);
  assert.notEqual(noisyFirst, first);
  assert.notEqual(play({ robotConfig: noisy, seed: 8 }), noisyFirst);
});

// =============================================================================================
// On the real mat picture
// =============================================================================================

/**
 * In the browser the floor sensors look at the real picture of the mat (mat-sensor.webp), not at
 * the simple drawing the other tests use. The picture is decoded here with "sharp", which comes
 * along with Next.js; without it these tests are skipped.
 */
async function loadMatPicture(): Promise<MatSampler | null> {
  interface Decoded {
    data: Uint8Array;
    info: { width: number; height: number };
  }
  type Sharp = (file: string) => {
    ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<Decoded> } };
  };
  try {
    const sharp = createRequire(import.meta.url)('sharp') as Sharp;
    const file = fileURLToPath(new URL(`../../../public${fireChiefGame.mat.sensorImageUrl}`, import.meta.url));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, FIELD_SIZE, FIELD_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

describe('on the real mat picture', () => {
  const picture = loadMatPicture();
  const threshold = FIRE_CHIEF_ROBOT.quadRgb.lineThreshold;

  test('the picture has the grid lines, the white cells and the room colours of the drawing', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const reading = (x: number, y: number) => makeProbeReading(mat.sample(x, y), threshold);
    // every grid line is where the drawing has it, in the black of the drawing (give or take a
    // little: the picture is compressed), with white mat on both sides
    const isLineBlack = (x: number, y: number): boolean => {
      const c = mat.sample(x, y);
      const near = (a: number, b: number): boolean => Math.abs(a - b) <= 6;
      return near(c.r, GRID_LINE_COLOR.r) && near(c.g, GRID_LINE_COLOR.g) && near(c.b, GRID_LINE_COLOR.b);
    };
    for (const start of GRID_LINE_STARTS) {
      const middle = start + GRID_LINE_WIDTH / 2;
      for (const across of [450, 750, 1050]) {
        assert.ok(isLineBlack(middle, across), `line at x = ${middle}, y = ${across}`);
        assert.ok(isLineBlack(across, middle), `line at y = ${middle}, x = ${across}`);
        assert.ok(reading(middle, across).onLine && reading(middle, across).color === 'black');
        assert.ok(reading(across, middle).onLine && reading(across, middle).color === 'black');
        for (const beside of [start - 3, start + GRID_LINE_WIDTH + 3]) {
          assert.ok(reading(beside, across).light > 95, `white beside the line: x = ${beside}, y = ${across}`);
          assert.ok(reading(across, beside).light > 95, `white beside the line: y = ${beside}, x = ${across}`);
        }
      }
    }
    // the plain cells are white all over
    for (let n = 0; n < 25; n++) {
      const cell = cellFromNumber(n);
      if (sameCell(cell, START_CELL) || sameCell(cell, LIVING_ROOM_CELL) || sameCell(cell, BEDROOM_CELL)) continue;
      const rect = cellRect(cell);
      for (let y = rect.y + 12; y < rect.y + rect.h - 4; y += 12) {
        for (let x = rect.x + 12; x < rect.x + rect.w - 4; x += 12) {
          assert.ok(reading(x, y).light > 95, `${cellName(cell)} is white at ${x}, ${y}`);
        }
      }
    }
    // the two rooms: on average the colour the drawing gives them
    for (const id of ROOM_IDS) {
      const mean = meanColour(mat, roomRect(id));
      const flat = ROOMS[id].color;
      for (const channel of ['r', 'g', 'b'] as const) {
        assert.ok(Math.abs(mean[channel] - flat[channel]) <= 6, `${id}: ${channel} ${mean[channel]} / ${flat[channel]}`);
      }
    }
  });

  test('the START picture and the room pictures have dark parts that the Quad RGB sensor takes for a line', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const onLine = (x: number, y: number): boolean => makeProbeReading(mat.sample(x, y), threshold).onLine;
    // how much of an area reads as "line"
    const dark = (rect: Rect): number => {
      let hits = 0;
      let points = 0;
      for (let y = rect.y + 8; y < rect.y + rect.h - 8; y += 4) {
        for (let x = rect.x + 8; x < rect.x + rect.w - 8; x += 4) {
          points++;
          if (onLine(x, y)) hits++;
        }
      }
      return hits / points;
    };
    assert.equal(dark(cellRect({ col: 2, row: 2 })), 0, 'a plain cell: nothing');
    const start = dark(START_RECT);
    assert.ok(start > 0.1 && start < 0.3, `${(100 * start).toFixed(0)} % of START reads as line`);
    for (const id of ROOM_IDS) {
      const room = dark(roomRect(id));
      assert.ok(room > 0.15 && room < 0.35, `${(100 * room).toFixed(0)} % of the ${id} room reads as line`);
    }
    // On its way out of START, probe L1 (7.5 mm left of the middle) passes over the logo before
    // it comes to the grid line: a program that counts lines from the first tick counts too many.
    // That is why LINE_COUNTER first leaves START without looking down.
    const probeX = START_POSE.x - 7.5;
    const probeStart = START_POSE.y - FIRE_CHIEF_ROBOT.quadRgb.forward;
    let darkRuns = 0;
    let was = false;
    for (let y = probeStart; y > START_RECT.y + GRID_LINE_WIDTH + 3; y -= 0.5) {
      const now = onLine(probeX, y);
      if (now && !was) darkRuns++;
      was = now;
    }
    assert.ok(darkRuns >= 1, `dark parts between the probe and the line at the top of START: ${darkRuns}`);
    // the dark frame of a room picture lies right beside the grid line: together they are one
    // wide dark band (about 20 mm instead of 6.5 mm)
    const y = 150;
    let band = 0;
    for (let x = GRID_LINE_STARTS[0] + GRID_LINE_WIDTH; x > 250 && onLine(x - 0.5, y); x -= 0.5) band += 0.5;
    assert.ok(band > 12 && band < 30, `dark band at the edge of the living room: ${band} mm`);
  });

  test('the line counter finds the living room on the picture as on the drawing', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const scenario = openField('bedroom', 'back');
    const onDrawing = createSimulation({ game: fireChiefGame, scenario, program: LINE_COUNTER });
    const onPicture = createSimulation({ game: fireChiefGame, scenario, program: LINE_COUNTER, sampler: mat });
    runToEnd(onDrawing);
    const events = runToEnd(onPicture);
    assert.deepEqual(problems(events), []);
    assert.deepEqual(bumps(events), []);
    assert.equal(onPicture.finishReason, 'program-ended');
    assert.equal(roomAround(onPicture.robotShapes()), 'living');
    assert.equal(onPicture.score().total, 30);
    assert.equal(onDrawing.score().total, 30);
    // The robot ends a little further left on the picture: the dark frame of the room picture
    // makes the last line wider, so the probe leaves it later.
    const a = onPicture.world.robot.pose;
    const b = onDrawing.world.robot.pose;
    assert.ok(Math.abs(a.y - b.y) < 2, `y: ${a.y} on the picture, ${b.y} on the drawing`);
    assert.ok(b.x - a.x > 5 && b.x - a.x < 25, `x: ${a.x} on the picture, ${b.x} on the drawing`);
  });

  test('programs that do not look down play exactly the same match on the picture', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const blocks of [ROUTE_TO_LIVING_ROOM, wallFollower(AT_START, [LIVING_ROOM_CELL.col, BEDROOM_CELL.col])]) {
      const onDrawing: BatchResult = runMatch({ game: fireChiefGame, scenario: defaultScenario(), program: blocks });
      const onPicture: BatchResult = runMatch({ game: fireChiefGame, scenario: defaultScenario(), program: blocks, sampler: mat });
      assert.deepEqual(onPicture, onDrawing);
      assert.equal(onPicture.total, 30);
    }
  });
});

/** Average colour of the picture over an area (a little inside its edges). */
function meanColour(mat: MatSampler, rect: Rect): { r: number; g: number; b: number } {
  const sum = { r: 0, g: 0, b: 0 };
  let points = 0;
  for (let y = rect.y + 8; y < rect.y + rect.h - 8; y += 2) {
    for (let x = rect.x + 8; x < rect.x + rect.w - 8; x += 2) {
      const c = mat.sample(x, y);
      sum.r += c.r;
      sum.g += c.g;
      sum.b += c.b;
      points++;
    }
  }
  return { r: sum.r / points, g: sum.g / points, b: sum.b / points };
}
