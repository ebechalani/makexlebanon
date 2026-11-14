/**
 * Fire Chief in real runs - the whole chain in one place:
 *
 *   block program (builder)  ->  interpreter  ->  engine (walls, sensors)  ->  Fire Chief referee
 *
 * In these tests the robot really drives from START through the maze; nothing is put into a room
 * by hand. The way through the maze is a block program run by the real interpreter: driving and
 * turning, the ultrasonic sensor (walls), the Quad RGB sensor (the printed grid lines),
 * variables, loops.
 *
 * The end of a mission - finding the place of the fire in a room, reading its colour, the fan -
 * is written against RobotIO, the seam the engine tests use: a small "co-pilot" script runs the
 * block program with the real interpreter first, and then reads the ultrasonic sensor and the
 * colour sensor and switches the fan itself (runBlocks, lookForTheFire and goCloseAndBlow
 * below). It does what the example programs do with blocks (samples.ts; samples.test.ts plays
 * those): so the same mission is checked here a second time, without the examples.
 *
 * No flame sensor is used in this game: the fire target is red, and the colour sensor at
 * the front of the robot reads "red" on it from 1.5 cm or less.
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
  TARGET_DEPTH,
  TARGET_WIDTH,
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
  type Cell,
  type FireSpot,
  type RoomId,
} from './field';
import { TARGET_BODY_ID, fireChiefGame, roomAround, targetOf } from './game';
import { COLOR_SENSOR_RANGE_MM, FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import {
  NAMED_MAZES,
  defaultScenario,
  encodeScenario,
  openField,
  randomScenario,
  wallBetweenCells,
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

// ---- the co-pilot: the end of a mission, written against RobotIO

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

/**
 * From the middle of a room: "something stands in front of this wall" when the ultrasonic
 * sensor reads less than this (cm). The bare wall reads 4.5 cm, the target (2 cm deep) 3 cm.
 */
const WALL_PLACE_CM = 4;
/** The same for the look into the outer corner: the empty corner reads 9 cm, the target in it 5.7 cm. */
const CORNER_PLACE_CM = 7.5;
/** The slow drive at the target (RPM), and how long it lasts at most (ticks). */
const APPROACH_RPM = 20;
const APPROACH_TICKS = 300;

/** What the co-pilot found in a room it looked into. */
interface Visit {
  room: RoomId;
  /** what the ultrasonic sensor read (cm) at each look it took: straight ahead, into the corner, at the other wall */
  looks: number[];
  /** something stands at one of the three places */
  found: boolean;
  /** the robot went close and the colour sensor read red */
  red: boolean;
}

/**
 * In the middle of a room, look at the three places where the fire can stand. The robot has
 * come in facing the back wall or the side wall: a place is straight ahead, the outer corner is
 * half a quarter turn further, the other wall a quarter turn. It stops at the first place where
 * something stands; when there is nothing it turns back to the way it came in.
 */
function* lookForTheFire(io: RobotIO, at: Place, looks: number[]): Generator<void, boolean, void> {
  // the corner is to the left of a robot that faces up in the living room or right in the bedroom
  const swing = (at.col === LIVING_ROOM_CELL.col && at.dir === 0) || (at.col === BEDROOM_CELL.col && at.dir === 1) ? -1 : 1;
  const limits = [WALL_PLACE_CM, CORNER_PLACE_CM, WALL_PLACE_CM];
  for (let look = 0; look < limits.length; look++) {
    if (look > 0) yield* turnBy(io, swing * 45, 40);
    yield* sleep(5);
    looks.push(io.ultrasonicCm());
    if (looks[look] < limits[look]) return true;
  }
  yield* turnBy(io, -swing * 90, 40);
  return false;
}

/**
 * Drive slowly at the thing ahead until the colour sensor reads red, stand still, and blow at
 * it for longer than 3 seconds. Without red (after 3 seconds of driving) the fan stays off.
 * (`visit.red` is written down before the fan starts: the referee ends the attempt while it blows.)
 */
function* goCloseAndBlow(io: RobotIO, visit: Visit): Generator<void, void, void> {
  io.setWheelRpm('left', APPROACH_RPM);
  io.setWheelRpm('right', APPROACH_RPM);
  for (let tick = 0; tick < APPROACH_TICKS && io.frontColor() !== 'red'; tick++) yield;
  io.stopWheel('all');
  yield* sleep(30);
  visit.red = io.frontColor() === 'red';
  if (!visit.red) return;
  io.setDcMotor('M1', 100);
  yield* sleep(350); // (the referee ends the attempt after 300 ticks)
  io.stopDcMotor('M1');
}

/**
 * A whole mission: blocks drive to a room; there the co-pilot looks for the fire with the
 * ultrasonic sensor. Something stands there: go close, read red, blow. Nothing: the blocks go
 * on to the other room.
 */
function explorer(visits: Visit[]): Script {
  return function* (io: RobotIO) {
    let at = AT_START;
    let rooms = [LIVING_ROOM_CELL.col, BEDROOM_CELL.col];
    while (rooms.length > 0) {
      const vm = yield* runBlocks(io, wallFollower(at, rooms));
      const now = vm.variables();
      at = { col: Number(now.col), row: Number(now.row), dir: Number(now.dir) };
      const visit: Visit = { room: at.col === LIVING_ROOM_CELL.col ? 'living' : 'bedroom', looks: [], found: false, red: false };
      visits.push(visit);
      visit.found = yield* lookForTheFire(io, at, visit.looks);
      if (visit.found) {
        yield* goCloseAndBlow(io, visit);
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

/**
 * How far (mm) the middle of the robot's front face - where the colour sensor sits - is from the
 * front face of the fire target, on paper: the face of a target at the back or at the side wall
 * lies one target depth in front of that wall, the face of a target in the corner lies across
 * the corner, (width + depth) / 2 + depth / 2 from it.
 */
function noseToTarget(sim: Sim): number {
  const { fireRoom, fireSpot } = sim.scenario;
  const pose = sim.world.robot.pose;
  const front = sim.robotConfig.chassisFront;
  const nose = { x: pose.x + front * Math.sin(pose.heading), y: pose.y - front * Math.cos(pose.heading) };
  const fromSide = fireRoom === 'living' ? nose.x : FIELD_SIZE - nose.x;
  if (fireSpot === 'back') return nose.y - TARGET_DEPTH;
  if (fireSpot === 'side') return fromSide - TARGET_DEPTH;
  return (fromSide + nose.y) / Math.SQRT2 - ((TARGET_WIDTH + TARGET_DEPTH) / 2 + TARGET_DEPTH / 2);
}

/** The two walls of the outer corner of a room: a robot that reads red on a target in that corner touches them. */
const cornerWalls = (room: RoomId): string[] => ['wall:top', room === 'living' ? 'wall:left' : 'wall:right'];

/**
 * What a run that found the fire must show at its end: the colour sensor reads red, the robot
 * stands 1.4 cm in front of a target at a wall and has touched nothing - or, for a target in
 * the corner, exactly the 1.5 cm of the sensor from it, held by the two walls of that corner
 * (one bump; it never touches the target). The target stands where it stood.
 */
function assertStandsAtTheFire(sim: Sim, events: SimEvent[], touched: boolean, what: string): void {
  assert.equal(sim.readSensors().frontColor, 'red', what);
  const gap = noseToTarget(sim);
  if (sim.scenario.fireSpot === 'corner') {
    assert.ok(Math.abs(gap - COLOR_SENSOR_RANGE_MM) < 0.01, `${what}: the nose is ${gap} mm from the target in the corner`);
    assert.equal(touched, true, `${what}: the walls of the corner stopped the robot`);
    assert.equal(bumps(events).length, 1, `${what}: bumps ${bumps(events).join(', ')}`);
    assert.ok(cornerWalls(sim.scenario.fireRoom).includes(bumps(events)[0]), `${what}: bumped into ${bumps(events)[0]}`);
  } else {
    assert.ok(gap > 13.5 && gap < COLOR_SENSOR_RANGE_MM, `${what}: the nose is ${gap} mm from the target`);
    assert.equal(touched, false, `${what}: the robot touched nothing`);
    assert.deepEqual(bumps(events), [], what);
  }
  assert.ok(!said(events).some((text) => text.startsWith('The robot touches the fire target')), `${what}: the robot never touched the target`);
  const target = targetOf(sim.world);
  assert.ok(target);
  assert.deepEqual([target.x, target.y, target.angle], [target.home.x, target.home.y, target.home.angle], what);
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
  // (the attempt is over: the sheet says what was not earned, not what to do next)
  assert.equal(lineOf(report.lines, 'fan-start').detail, 'not earned - the fan never blew');
  assert.equal(lineOf(report.lines, 'fan-complete').detail, 'not earned - the fan never blew at the fire for 3 seconds without a break');
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

test('real run: blocks drive to the living room, the ultrasonic sensor finds the fire in its corner, the colour sensor reads red, the fan blows 3 s - 100 points', () => {
  const looks: number[] = [];
  let found = false;
  let redBeforeFan = false;
  let fanSwitchedOnAt = -1;
  let programSwitchedFanOff = false;
  const harness = scripted(function* (io) {
    yield* runBlocks(io, ROUTE_TO_LIVING_ROOM);
    // (the route ends in the living room, facing left: the side wall is straight ahead)
    found = yield* lookForTheFire(io, { col: LIVING_ROOM_CELL.col, row: LIVING_ROOM_CELL.row, dir: 3 }, looks);
    io.setWheelRpm('left', APPROACH_RPM);
    io.setWheelRpm('right', APPROACH_RPM);
    for (let tick = 0; tick < APPROACH_TICKS && io.frontColor() !== 'red'; tick++) yield;
    io.stopWheel('all');
    yield* sleep(30);
    redBeforeFan = io.frontColor() === 'red';
    fanSwitchedOnAt = io.time;
    io.setDcMotor('M1', 100);
    yield* sleep(350);
    programSwitchedFanOff = true;
    io.stopDcMotor('M1');
  });
  const sim: Sim = createEngineSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: {} }, harness.factory);
  let fanTicks = 0;
  let touchTicks = 0;
  let sawRedBeforeTheCorner = false;
  sim.start();
  const events: SimEvent[] = [];
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    if (sim.world.robot.fanOn) fanTicks++;
    if (sim.world.robot.touching) touchTicks++;
    // (the colour sensor is asked only near the target: the robot's turning point is inside the living room then)
    if (touchTicks === 0 && roomAround(sim.robotShapes()) === 'living' && sim.readSensors().frontColor === 'red') sawRedBeforeTheCorner = true;
  }
  events.push(...sim.drainEvents());
  assert.deepEqual(problems(events), []);

  // the ultrasonic sensor found the place: a bare wall straight ahead (4.5 cm), then the target in the corner (5.7 cm)
  assert.equal(defaultScenario().fireSpot, 'corner');
  assert.equal(found, true);
  assert.deepEqual(looks, [4.5, 5.7]);
  // the colour sensor read red when the robot had gone close, and the robot faces the target
  assert.equal(redBeforeFan, true);
  assert.ok(aimErrorDeg(sim) < 0.1, `the robot points ${aimErrorDeg(sim)} degrees beside the target`);
  // In the corner the two walls stop the robot when its nose is exactly 1.5 cm from the target:
  // only there is the colour sensor close enough. It pressed on them for 3 hundredths of a second.
  assert.equal(sawRedBeforeTheCorner, false, 'no red before the walls of the corner stopped the robot');
  assert.equal(touchTicks, 3);
  assertStandsAtTheFire(sim, events, touchTicks > 0, 'default maze');

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
});

/**
 * Play a whole mission of the co-pilot to its end, tick by tick. `touched`: the robot pressed
 * against something at some moment (the walls of a corner hold it for 3 ticks only: a look
 * every few ticks would miss that).
 */
function playMission(scenario: FireChiefScenario): { sim: Sim; visits: Visit[]; events: SimEvent[]; touched: boolean } {
  const { sim, visits } = explore(scenario);
  const events: SimEvent[] = [];
  let touched = false;
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    if (sim.world.robot.touching) touched = true;
    events.push(...sim.drainEvents());
  }
  events.push(...sim.drainEvents());
  return { sim, visits, events, touched };
}

test('real run: a wall follower made of blocks plus the ultrasonic sensor, the colour sensor and the fan solves every named maze', () => {
  for (const { id, scenario } of NAMED_MAZES) {
    const { sim, visits, events, touched } = playMission(scenario);
    assert.deepEqual(problems(events), [], id);
    assert.equal(sim.finishReason, 'mission-complete', id);
    const report = sim.score();
    assert.equal(report.total, 100, `${id}: ${sheet(report.lines)}`);
    assert.ok(sim.world.time < 120, `${id}: done after ${sim.world.time} s`);
    assert.equal(report.time, sim.world.time, id);
    // it looked into one room or into both; the last one is the room with the fire
    assert.ok(visits.length === 1 || visits.length === 2, id);
    const last = visits[visits.length - 1];
    assert.equal(last.room, scenario.fireRoom, id);
    assert.deepEqual([last.found, last.red], [true, true], id);
    assert.ok(aimErrorDeg(sim) < 0.1, `${id}: aimed ${aimErrorDeg(sim)} degrees beside the target`);
    if (visits.length === 2) {
      // in the room without the fire the ultrasonic sensor read the bare walls at all three places
      assert.notEqual(visits[0].room, scenario.fireRoom, id);
      assert.deepEqual(visits[0], { room: visits[0].room, looks: [4.5, 9, 4.5], found: false, red: false }, id);
      // the 20 points came from that first room, long before the fan
      const room = lineOf(report.lines, 'enter-room');
      assert.equal(room.detail.endsWith(`(${ROOMS[visits[0].room].name})`), true, id);
    }
    // a robot that keeps to the middle of the cells touches nothing - but the two walls of the corner, for a fire in the corner
    assertStandsAtTheFire(sim, events, touched, id);
  }
  // the named mazes cover both cases: the fire in the first room the follower comes to, and in the second
  const firstRoom = NAMED_MAZES.map(({ scenario }) => playMission(scenario).visits.length);
  assert.ok(firstRoom.includes(1) && firstRoom.includes(2), `rooms looked into: ${firstRoom.join(', ')}`);
  // ... and a fire at a wall as well as a fire in a corner
  assert.deepEqual([...new Set(NAMED_MAZES.map(({ scenario }) => scenario.fireSpot))].sort(), ['back', 'corner', 'side']);
});

test('real run: the same robot solves 40 random mazes, with the fire at every place', () => {
  const seenPlaces = new Set<string>();
  let slowest = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const scenario = randomScenario(makeRng(seed));
    const code = encodeScenario(scenario);
    seenPlaces.add(`${scenario.fireRoom} ${scenario.fireSpot}`);
    const { sim, visits, events, touched } = playMission(scenario);
    assert.deepEqual(problems(events), [], code);
    assert.equal(sim.finishReason, 'mission-complete', code);
    assert.equal(sim.score().total, 100, `${code}: ${sheet(sim.score().lines)}`);
    assert.equal(visits[visits.length - 1].room, scenario.fireRoom, code);
    assert.equal(visits[visits.length - 1].red, true, code);
    assertStandsAtTheFire(sim, events, touched, code);
    slowest = Math.max(slowest, sim.world.time);
  }
  assert.equal(seenPlaces.size, ROOM_IDS.length * FIRE_SPOTS.length, 'the 40 mazes have the fire at all six places');
  assert.ok(slowest < 180, `the slowest run took ${slowest} s`);
});

// =============================================================================================
// The two sensors that find the fire
// =============================================================================================

/** What the two sensors read while the robot stands at `pose`: the ultrasonic sensor (cm) and the colour sensor. */
function readingsAt(scenario: FireChiefScenario, pose: Pose): { cm: number; colour: string } {
  const sim: Sim = createSimulation({ game: fireChiefGame, scenario, program: {}, startPose: pose });
  const sensors = sim.readSensors();
  return { cm: sensors.ultrasonicCm, colour: sensors.frontColor };
}

/** The middle of a room, looking at one of its three places (straight at a wall, or into the outer corner). */
function lookingAt(room: RoomId, place: FireSpot): Pose {
  const rect = roomRect(room);
  const outwards = room === 'living' ? -1 : 1;
  const degrees = place === 'back' ? 0 : place === 'side' ? outwards * 90 : outwards * 45;
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, heading: degrees * DEG };
}

test('the two sensors from the middle of a room: the ultrasonic sensor tells the place of the fire, the colour sensor is too far away to read it', () => {
  for (const fireRoom of ROOM_IDS) {
    const otherRoom: RoomId = fireRoom === 'living' ? 'bedroom' : 'living';
    for (const fireSpot of FIRE_SPOTS) {
      // the open field is the hardest case: no inner wall stands between the rooms
      const scenario = openField(fireRoom, fireSpot);
      for (const place of FIRE_SPOTS) {
        const here = readingsAt(scenario, lookingAt(fireRoom, place));
        const bare = place === 'corner' ? 9 : 4.5;
        const withTarget = place === 'corner' ? 5.7 : 3;
        // only the look at the place where the target stands reads less than the bare wall
        assert.equal(here.cm, place === fireSpot ? withTarget : bare, `fire ${fireRoom} ${fireSpot}, looking at ${place}`);
        assert.equal(here.cm < (place === 'corner' ? CORNER_PLACE_CM : WALL_PLACE_CM), place === fireSpot, `fire ${fireRoom} ${fireSpot}, looking at ${place}`);
        // from the middle of the room the target is 2.5 cm (at a wall) or 5.7 cm (corner) ahead: more than the colour sensor sees
        assert.equal(here.colour, 'none', `fire ${fireRoom} ${fireSpot}, looking at ${place}`);
        // in the room without the fire every look reads the bare wall
        const there = readingsAt(scenario, lookingAt(otherRoom, place));
        assert.deepEqual(there, { cm: bare, colour: 'none' }, `fire ${fireRoom} ${fireSpot}, looking at ${place} of the ${otherRoom}`);
      }
    }
  }
});

test('the colour sensor in front of the target: red from 1.5 cm, nothing from 1.6 cm, and "yellow" on the bare wall', () => {
  // the robot faces the back wall of the living room, its nose `gap` mm from the front face of the target there
  const facing = (gap: number): Pose => ({ x: roomRect('living').x + 150, y: TARGET_DEPTH + gap + FIRE_CHIEF_ROBOT.chassisFront, heading: 0 });
  const fire = openField('living', 'back');
  assert.equal(readingsAt(fire, facing(COLOR_SENSOR_RANGE_MM)).colour, 'red');
  assert.equal(readingsAt(fire, facing(COLOR_SENSOR_RANGE_MM + 1)).colour, 'none');
  assert.equal(readingsAt(fire, facing(5)).colour, 'red');
  // the ultrasonic sensor cannot tell these distances apart: everything nearer than 3 cm reads 3 cm
  for (const gap of [5, COLOR_SENSOR_RANGE_MM, COLOR_SENSOR_RANGE_MM + 1, 25]) assert.equal(readingsAt(fire, facing(gap)).cm, 3, `${gap} mm`);
  // without the target the same poses look at the wall, 2 cm further away: it never reads red
  const empty = openField('bedroom', 'back');
  assert.equal(readingsAt(empty, facing(COLOR_SENSOR_RANGE_MM)).colour, 'none');
  assert.equal(readingsAt(empty, facing(-5)).colour, 'yellow');
});

test('real run on the open field, the fire at each of its six places: the looks the robot needs, and where it stands when it reads red', () => {
  // The left hand leads up the left side of the open field: the robot comes into the living room
  // facing its back wall. With the fire in the bedroom it goes on along the top wall and comes
  // into the bedroom facing its side wall. What the ultrasonic sensor reads at each look:
  const expected: Record<string, number[][]> = {
    'living back': [[3]],
    'living corner': [[4.5, 5.7]],
    'living side': [[4.5, 9, 3]],
    'bedroom side': [[4.5, 9, 4.5], [3]],
    'bedroom corner': [[4.5, 9, 4.5], [4.5, 5.7]],
    'bedroom back': [[4.5, 9, 4.5], [4.5, 9, 3]],
  };
  for (const fireRoom of ROOM_IDS) {
    for (const fireSpot of FIRE_SPOTS) {
      const what = `${fireRoom} ${fireSpot}`;
      const { sim, visits, events, touched } = playMission(openField(fireRoom, fireSpot));
      assert.deepEqual(problems(events), [], what);
      assert.equal(sim.score().total, 100, `${what}: ${sheet(sim.score().lines)}`);
      assert.deepEqual(visits.map((visit) => visit.looks), expected[what], what);
      assert.deepEqual(visits.map((visit) => visit.room), fireRoom === 'living' ? ['living'] : ['living', 'bedroom'], what);
      assert.equal(visits[visits.length - 1].red, true, what);
      assertStandsAtTheFire(sim, events, touched, what);
    }
  }
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
  // (the first try ended before the robot looked for the fire: only the second try reached that point)
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
    noise: { wheelSlip: 0.02, sensor: 6, ultrasonicCm: 0.3 },
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
