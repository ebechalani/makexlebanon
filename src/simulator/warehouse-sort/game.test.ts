/**
 * The Warehouse Sort referee, line by line of the rules (§5 - §8), with the edges of every line,
 * on the turned field (the robot starts at the bottom, facing up) with its one blue cube that must
 * be left alone (Q15).
 *
 * Most tests put the field together by hand - a cube here, the robot there - and ask the
 * referee directly, tick by tick: that way each edge (a cube 0.01 mm out of its bay ...) is
 * exact. The tests at the end run the real engine (restart, the colour sensor at the claw, the
 * table around the mat).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from '../core/engine';
import { DEG, rectCenter, type OBB } from '../core/geometry';
import { robotShapesAt } from '../core/robot';
import { drive, forever, near, scripted, turn, waitUntil, type Script } from '../core/test-helpers';
import type { Body, Pose, ScoreContext, ScoreLine, ScoreReport } from '../core/types';
import { classifyColor } from '../core/engine-sensors';
import { BAYS, CUBE_SIZE, FINISH_PADS, MAT_SIZE, START_ZONE, WAREHOUSES, WAREHOUSE_IDS, type WarehouseId } from './field';
import {
  BLUE_MOVED_MM,
  BLUE_PENALTY,
  CARRY_MM,
  CUBES_TO_SORT,
  CUBE_FILL,
  KIND_CUBE,
  LIFT_MM,
  LINE_BLUE,
  LINE_CLEAN,
  LINE_LAST_DELIVERY,
  LINE_LEAVE_START,
  LINE_PARK,
  LINE_RESTARTS,
  LINE_START_POSITION,
  LINE_WRONG_BAY,
  MATCH_DURATION,
  MAX_SCORE,
  RESTART_PENALTY,
  bayAround,
  blueShift,
  clock,
  cubeBodyId,
  cubeHome,
  deliverLineId,
  isLyingOffMat,
  isOffMat,
  obbTouchesEllipse,
  parkedOn,
  pickLineId,
  warehouseSortGame,
} from './game';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from './robot';
import { decodeScenario, defaultScenario, type WarehouseSortScenario } from './scenario';

const ROBOT = WAREHOUSE_SORT_ROBOT;
type Ctx = ScoreContext<WarehouseSortScenario>;

// =============================================================================================
// A field put together by hand
// =============================================================================================

/**
 * A field with the real bodies and the real robot state (from the engine, which does not run
 * here), and a referee of its own that is asked tick by tick.
 */
function bench(scenario: WarehouseSortScenario = defaultScenario()) {
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario, program: {} }, scripted(forever).factory);
  const world = sim.world;
  const referee = warehouseSortGame.createReferee!(scenario);
  let restarts = 0;
  const ctx = (): Ctx => ({
    scenario,
    world,
    robotConfig: ROBOT,
    restarts,
    robotShapes: robotShapesAt(ROBOT, world.robot.pose, world.robot.gripper.gap),
  });
  const cube = (w: WarehouseId): Body => {
    const found = world.bodies.find((b) => b.id === cubeBodyId(w));
    assert.ok(found, w);
    return found;
  };
  const b = {
    world,
    referee,
    cube,
    /** what the referee said on the last tick */
    said: [] as string[],
    robotAt(pose: Pose) {
      Object.assign(world.robot.pose, pose);
    },
    /** the robot far away from every cube, bay and pad (in the start zone, where it started) */
    robotHome() {
      Object.assign(world.robot.pose, START_POSE);
    },
    /** put a cube down on the mat with its middle at (x, y) */
    place(w: WarehouseId, x: number, y: number, angle = 0) {
      Object.assign(cube(w), { x, y, angle, z: 0, held: false, restingOn: null });
      if (world.robot.gripper.holding === cube(w).id) world.robot.gripper.holding = null;
    },
    /** the gripper holds a cube, its base `z` mm above the mat */
    hold(w: WarehouseId, z = 0) {
      Object.assign(cube(w), { z, held: true, restingOn: null });
      world.robot.gripper.holding = cube(w).id;
    },
    begin() {
      referee.begin?.(ctx());
    },
    /** the referee looks at one tick, at match time `time` (default: the next 1/100 s) */
    tick(time?: number) {
      world.tick++;
      world.time = time ?? world.tick / 100;
      b.said = referee.observe(ctx())?.say ?? [];
    },
    restart() {
      restarts++;
      referee.restart(ctx());
    },
    end() {
      referee.finished?.(ctx(), 'time');
    },
    score(): ScoreReport {
      return referee.score(ctx());
    },
    line(id: string): ScoreLine {
      const line = referee.score(ctx()).lines.find((l) => l.id === id);
      assert.ok(line, `line ${id}`);
      return line;
    },
  };
  return b;
}


const bayMiddle = (color: 'red' | 'green') => rectCenter(BAYS[color]);

/** An arrangement by its code (throws for a code that cannot be played). */
const arrangementOf = (code: string): WarehouseSortScenario => {
  const s = decodeScenario(code);
  assert.ok(s, code);
  return s;
};

/**
 * The robot facing up with a cube (middle at `cube`) between its open fingers, `gap` mm from the
 * inner face of its left finger. (The inner faces are half the open gap, 32 mm, from the middle.)
 */
function besideLeftFinger(cube: { x: number; y: number }, gap: number): Pose {
  const half = ROBOT.gripper.clawOpenGap / 2;
  return { x: cube.x + half - CUBE_SIZE / 2 - gap, y: cube.y + ROBOT.gripper.gripForward, heading: 0 };
}
/** Three places one above the other in a bay (the bays are tall on the turned field), for up to three cubes. */
const bayPlaces = (color: 'red' | 'green') => {
  const c = bayMiddle(color);
  return [
    { x: c.x, y: c.y - 50 },
    { x: c.x, y: c.y },
    { x: c.x, y: c.y + 50 },
  ];
};

// The default arrangement, "GR-BR": W1 green (top left), W2 red (top right), W3 blue (bottom
// left), W4 red (bottom right). Most tests below use it.

// =============================================================================================
// The game
// =============================================================================================

test('game: 90 s, 80 points at most, 4 cubes on the orange squares (one blue), -10 per restart, no limit', () => {
  const g = warehouseSortGame;
  assert.equal(g.id, 'warehouse-sort');
  assert.equal(g.matchDuration, 90);
  assert.equal(MATCH_DURATION, 90);
  assert.equal(CUBES_TO_SORT, 3);
  assert.equal(MAX_SCORE, 80);
  assert.equal(5 + 3 * 5 + 3 * 15 + 10 + 5, MAX_SCORE);
  assert.equal(g.restartPenalty, 10);
  assert.equal(RESTART_PENALTY, 10);
  assert.equal(BLUE_PENALTY, 5);
  assert.equal(BLUE_MOVED_MM, 5);
  assert.equal(g.restartRules, undefined, 'no limit; only the cube in the gripper goes back');
  assert.equal(g.createWalls, undefined, 'no walls: the table around the mat stops things');
  assert.deepEqual(g.startZone, START_ZONE);
  assert.deepEqual(g.defaultStartPose, START_POSE);
  assert.equal(g.robotConfig, ROBOT);
  const bodies = g.createBodies(defaultScenario());
  assert.equal(bodies.length, 4);
  for (const body of bodies) {
    const w = body.id.slice('cube:'.length) as WarehouseId;
    assert.equal(body.kind, KIND_CUBE);
    assert.deepEqual({ x: body.x, y: body.y }, cubeHome(w));
    assert.deepEqual(cubeHome(w), rectCenter(WAREHOUSES[w].square));
    assert.equal(body.colorName, defaultScenario().cubes[w]);
    assert.equal(body.label, { red: 'R', green: 'G', blue: 'B' }[body.colorName as 'red' | 'green' | 'blue']);
    assert.equal(body.fill, CUBE_FILL[body.colorName as 'red' | 'green' | 'blue']);
    assert.ok(body.grippable && !body.platform);
    assert.deepEqual([body.w, body.l, body.h, body.z], [CUBE_SIZE, CUBE_SIZE, 40, 0]);
    assert.deepEqual(body.home, { x: body.x, y: body.y, angle: 0, z: 0, restingOn: null });
  }
  assert.deepEqual(bodies.map((b) => b.label), ['G', 'R', 'B', 'R']);
  // the colours they are drawn in: what the colour naming of the sensors calls them too
  for (const color of ['red', 'green', 'blue'] as const) {
    const hex = CUBE_FILL[color];
    const rgb = { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
    assert.equal(classifyColor(rgb), color, hex);
  }
  const zones = g.overlays(defaultScenario());
  assert.deepEqual(
    zones.map((z) => z.id),
    ['start', 'warehouse:W1', 'warehouse:W2', 'warehouse:W3', 'warehouse:W4', 'bay:red', 'bay:green', 'pad:left', 'pad:right'],
  );
  assert.equal(zones.find((z) => z.id === 'warehouse:W3')?.label, 'W3 blue');
});

test('sheet before anything happened: only the clean-run bonus; a line for each red and green cube, one for the blue cube', () => {
  const b = bench();
  const sheet = b.score();
  assert.equal(sheet.total, 5);
  assert.equal(sheet.max, 80);
  assert.equal(sheet.complete, false);
  assert.equal(sheet.time, undefined, 'the sheet has no "time of this score": the rules rank equal points by deliveries first');
  // (W3 holds the blue cube: no pick-up line and no bay line for it)
  const sorted = ['W1', 'W2', 'W4'] as const;
  assert.deepEqual(
    sheet.lines.map((l) => l.id),
    [LINE_LEAVE_START, ...sorted.map(pickLineId), ...sorted.map(deliverLineId), LINE_PARK, LINE_CLEAN, LINE_RESTARTS, LINE_WRONG_BAY, LINE_BLUE],
    'the line with the time of the last correct delivery comes with the first one',
  );
  assert.equal(sheet.lines.filter((l) => l.max > 0).length, 9, 'leave, 3 picks, 3 deliveries, park, clean run');
  assert.equal(b.line(LINE_LEAVE_START).detail, 'not yet - drive out of the start zone');
  assert.equal(b.line(pickLineId('W1')).label, 'Pick up cube W1 (green)');
  assert.equal(b.line(deliverLineId('W2')).label, 'Cube W2 (red) in the red bay');
  assert.equal(b.line(LINE_CLEAN).detail, 'no restart so far');
  const blue = b.line(LINE_BLUE);
  assert.deepEqual([blue.label, blue.points, blue.max, blue.ok, blue.detail], ['Blue cube (W3)', 0, 0, true, 'left alone']);
  assert.equal(b.score().lines.some((l) => l.id === pickLineId('W3') || l.id === deliverLineId('W3')), false);
  // the game's own score() is the sheet of a match in which nothing happened
  assert.equal(warehouseSortGame.score({ scenario: defaultScenario(), world: b.world, robotConfig: ROBOT, restarts: 0, robotShapes: [] }).total, 5);
});

// =============================================================================================
// +5 Leave the start zone
// =============================================================================================

test('leave the start zone: the first moment a part of the robot is beyond the yellow frame; kept', () => {
  const b = bench();
  b.begin();
  b.tick();
  assert.equal(b.line(LINE_LEAVE_START).ok, false);
  // facing up, the claw is 13.915 mm from the frame's outer edge: 13.9 mm forward is still inside ...
  b.robotAt({ ...START_POSE, y: START_POSE.y - 13.9 });
  b.tick(1);
  assert.equal(b.line(LINE_LEAVE_START).ok, false);
  // ... 0.03 mm more and the tips of the fingers are out
  b.robotAt({ ...START_POSE, y: START_POSE.y - 13.93 });
  b.tick(1.01);
  const line = b.line(LINE_LEAVE_START);
  assert.deepEqual([line.points, line.ok, line.time, line.detail], [5, true, 1.01, 'done at 0:01.0']);
  assert.deepEqual(b.said, ['+5 points at 0:01.0: the robot left the start zone.']);
  // back inside: the points stay, and nothing is said again
  b.robotHome();
  b.tick(2);
  assert.equal(b.line(LINE_LEAVE_START).time, 1.01);
  assert.deepEqual(b.said, []);
  assert.equal(b.score().lines.some((l) => l.id === LINE_START_POSITION), false);
});

test('leave the start zone on the very first tick: a robot that starts partly outside (only a test can put it there)', () => {
  const b = bench();
  b.robotAt({ ...START_POSE, y: START_POSE.y - 20 });
  b.begin();
  b.tick();
  assert.equal(b.line(LINE_LEAVE_START).time, 0.01);
  const note = b.line(LINE_START_POSITION);
  assert.deepEqual([note.points, note.max, note.ok], [0, 0, false]);
  // also before the start signal the sheet says so
  const fresh = bench();
  fresh.robotAt({ ...START_POSE, x: START_ZONE.x });
  assert.ok(fresh.score().lines.some((l) => l.id === LINE_START_POSITION));
});

test('leave the start zone: a robot that never leaves', () => {
  const b = bench();
  b.begin();
  for (let i = 0; i < 10; i++) b.tick();
  b.end();
  assert.equal(b.line(LINE_LEAVE_START).detail, 'the robot never left the start zone');
});

test('leave the start zone: the zone runs to the bottom edge of the mat - backing over that edge counts too (Q11)', () => {
  // (the rules do not say; the Rules window and the README say that this counts, and ask the organiser)
  const b = bench();
  b.begin();
  b.tick();
  // the back of the chassis 13.915 mm from the edge of the mat: 13.9 mm back is still inside ...
  b.robotAt({ ...START_POSE, y: START_POSE.y + 13.9 });
  b.tick(1);
  assert.equal(b.line(LINE_LEAVE_START).ok, false);
  // ... 1 mm over the edge of the mat, onto the table: out of the zone, without entering the field
  // (facing up, the back of the chassis is chassisRear below the middle of the axle)
  b.robotAt({ ...START_POSE, y: MAT_SIZE + 1 - ROBOT.chassisRear });
  b.tick(2);
  assert.deepEqual([b.line(LINE_LEAVE_START).points, b.line(LINE_LEAVE_START).time], [5, 2]);
});

// =============================================================================================
// +5 each red or green cube picked
// =============================================================================================

test('picked: held and lifted 1 cm - 9.9 mm is not enough', () => {
  const b = bench();
  b.hold('W1', 0);
  b.tick(3);
  b.hold('W1', LIFT_MM - 0.1);
  b.tick(3.01);
  assert.equal(b.line(pickLineId('W1')).ok, false);
  b.hold('W1', LIFT_MM);
  b.tick(3.02);
  const line = b.line(pickLineId('W1'));
  assert.deepEqual([line.points, line.max, line.time, line.detail], [5, 5, 3.02, 'done at 0:03.0']);
  assert.deepEqual(b.said, ['+5 points at 0:03.0: cube W1 (green) picked up.']);
});

test('picked: lifted without the gripper does not count, nor does a cube that is only pushed', () => {
  const b = bench();
  Object.assign(b.cube('W2'), { z: 30 });
  b.tick();
  b.place('W2', 900, 300);
  b.tick();
  b.place('W2', 1000, 300);
  b.tick();
  assert.equal(b.line(pickLineId('W2')).ok, false);
  b.end();
  assert.equal(b.line(pickLineId('W2')).detail, 'not picked up');
});

test('picked: "visibly carried" - held on the mat and moved one cube length (40 mm)', () => {
  assert.equal(CARRY_MM, 40);
  const b = bench();
  const home = cubeHome('W4');
  b.hold('W4', 0);
  b.tick(5);
  Object.assign(b.cube('W4'), { y: home.y - 39.9 });
  b.tick(5.5);
  assert.equal(b.line(pickLineId('W4')).ok, false);
  Object.assign(b.cube('W4'), { y: home.y - 40 });
  b.tick(6);
  assert.equal(b.line(pickLineId('W4')).time, 6);
  // let go and take it again: the carry counts from where it was taken
  const c = bench();
  c.hold('W1', 0);
  c.tick(1);
  Object.assign(c.cube('W1'), { x: cubeHome('W1').x + 30 });
  c.tick(2);
  c.place('W1', cubeHome('W1').x + 30, cubeHome('W1').y);
  c.tick(3);
  c.hold('W1', 0);
  c.tick(4);
  Object.assign(c.cube('W1'), { x: cubeHome('W1').x + 60 });
  c.tick(5);
  assert.equal(c.line(pickLineId('W1')).ok, false, '30 + 30 mm in two goes is not one carry of 40');
});

test('picked: after the match a cube that was gripped but neither lifted 1 cm nor carried 4 cm says why', () => {
  const b = bench();
  b.tick(1);
  assert.equal(b.line(pickLineId('W2')).detail, 'not yet - grip it, then lift it 1 cm or carry it 4 cm');
  // gripped and dragged 30 mm on the mat: not picked
  b.hold('W2', 0);
  b.tick(2);
  Object.assign(b.cube('W2'), { x: cubeHome('W2').x - 30 });
  b.tick(3);
  b.end();
  const line = b.line(pickLineId('W2'));
  assert.deepEqual([line.points, line.detail], [0, 'gripped, but not lifted 1 cm or carried 4 cm']);
  // a cube the gripper never held
  assert.equal(b.line(pickLineId('W1')).detail, 'not picked up');
});

test('picked twice: counted once, at the first time', () => {
  const b = bench();
  b.hold('W2', 20);
  b.tick(4);
  b.place('W2', 900, 900);
  b.tick(5);
  b.hold('W2', 50);
  b.tick(6);
  assert.deepEqual(b.said, []);
  const sheet = b.score();
  assert.equal(sheet.lines.find((l) => l.id === pickLineId('W2'))!.time, 4);
  assert.equal(sheet.lines.filter((l) => l.id.startsWith('pick:')).reduce((n, l) => n + l.points, 0), 5);
});

// =============================================================================================
// +15 delivered, -5 wrong bay
// =============================================================================================

test('delivered: completely inside the bay of its colour, on the mat, not touching the robot', () => {
  const b = bench();
  const red = BAYS.red;
  // W2 is red: right in the middle of the red bay
  b.place('W2', bayMiddle('red').x, bayMiddle('red').y);
  b.tick(10);
  assert.deepEqual(b.said, ['0:10.0: Cube W2 (red) is in the red bay.']);
  let line = b.line(deliverLineId('W2'));
  assert.deepEqual([line.points, line.max, line.ok, line.time, line.detail], [15, 15, true, 10, 'in the red bay since 0:10.0']);
  // exactly on the edge of the bay still counts (the boundary is part of the bay) ...
  b.place('W2', red.x + CUBE_SIZE / 2, red.y + CUBE_SIZE / 2);
  b.tick(11);
  assert.equal(b.line(deliverLineId('W2')).ok, true);
  assert.equal(b.line(deliverLineId('W2')).time, 10, 'it never left the bay: still the first time');
  // ... 0.01 mm over the edge does not: only partly inside
  b.place('W2', red.x + CUBE_SIZE / 2 - 0.01, red.y + CUBE_SIZE / 2);
  b.tick(12);
  line = b.line(deliverLineId('W2'));
  assert.deepEqual([line.points, line.ok, line.detail], [0, false, 'only partly in the red bay - the whole cube must be inside']);
  assert.equal(b.line(LINE_WRONG_BAY).points, 0, 'partly in a bay: nothing either way');
  // a cube turned by 45 degrees needs more room
  b.place('W2', red.x + CUBE_SIZE / 2 + 1, bayMiddle('red').y, 45 * DEG);
  assert.equal(bayAround({ x: b.cube('W2').x, y: b.cube('W2').y, w: 40, l: 40, angle: 45 * DEG }), null);
  b.place('W2', red.x + CUBE_SIZE * Math.SQRT1_2 + 0.01, bayMiddle('red').y, 45 * DEG);
  b.tick(13);
  assert.equal(b.line(deliverLineId('W2')).ok, true);
  assert.equal(b.line(deliverLineId('W2')).time, 13, 'it came back into the bay: a new time');
});

test('delivered: not while the robot holds it, not lifted, not while it touches the robot', () => {
  const b = bench();
  const m = bayMiddle('red');
  // held by the gripper, standing on the mat in the bay
  b.place('W4', m.x, m.y);
  b.hold('W4', 0);
  b.tick(20);
  b.end();
  let line = b.line(deliverLineId('W4'));
  assert.deepEqual([line.points, line.detail], [0, 'the robot still held it - put it down in the red bay']);
  // lifted, not held (cannot happen in the engine, but the referee does not count it)
  const lifted = bench();
  lifted.place('W4', m.x, m.y);
  Object.assign(lifted.cube('W4'), { z: 5 });
  lifted.tick(1);
  assert.equal(lifted.line(deliverLineId('W4')).detail, 'not standing on the mat - put it down in the red bay');
  // standing in the bay between the open fingers, the left finger 0.4 mm from it: touching (< 0.5 mm)
  const t = bench();
  t.place('W4', m.x, m.y);
  t.robotAt(besideLeftFinger(m, 0.4));
  t.tick(30);
  line = t.line(deliverLineId('W4'));
  assert.deepEqual([line.points, line.detail], [0, 'in the red bay, but touching the robot - move away']);
  // 0.6 mm away: not touching
  t.robotAt(besideLeftFinger(m, 0.6));
  t.tick(31);
  assert.equal(t.line(deliverLineId('W4')).ok, true);
  // the time of the delivery is when it was put there, not when the robot moved away
  assert.equal(t.line(deliverLineId('W4')).time, 30);
});

test('wrong bay: -5 and no points for that cube; touching the robot it is not a delivery either way', () => {
  const b = bench();
  // W1 is green, W2 red: each in the other colour's bay
  const [r1] = bayPlaces('red');
  const [g1] = bayPlaces('green');
  b.place('W1', r1.x, r1.y);
  b.place('W2', g1.x, g1.y);
  b.tick(40);
  assert.deepEqual(b.said, ['0:40.0: Cube W1 (green) is in the red bay - the wrong bay.', '0:40.0: Cube W2 (red) is in the green bay - the wrong bay.']);
  const sheet = b.score();
  const wrong = sheet.lines.find((l) => l.id === LINE_WRONG_BAY)!;
  assert.deepEqual([wrong.points, wrong.max, wrong.ok], [-10, 0, false]);
  assert.equal(wrong.detail, 'cube W1 (green), cube W2 (red), -5 each');
  assert.equal(sheet.lines.find((l) => l.id === deliverLineId('W1'))!.detail, 'in the red bay - wrong bay, -5');
  assert.equal(sheet.lines.find((l) => l.id === deliverLineId('W1'))!.points, 0);
  assert.equal(sheet.total, 0, '5 for the clean run - 10: never below 0');
  assert.equal(sheet.lines.find((l) => l.id === LINE_LAST_DELIVERY), undefined, 'a wrong delivery is no delivery');
  // in the wrong bay but touching the robot: no penalty
  const t = bench();
  const m = bayMiddle('red');
  t.place('W1', m.x, m.y);
  t.robotAt(besideLeftFinger(m, 0.4));
  t.tick(1);
  assert.equal(t.line(LINE_WRONG_BAY).points, 0);
  assert.equal(t.line(deliverLineId('W1')).detail, 'in the red bay, but touching the robot - move away');
});

test('wrong bay: "no points for that cube" - it also loses its 5 for picking, as a cube off the mat does (Q9, Q10)', () => {
  const b = bench();
  // W2 is red: picked (lifted 15 mm), then put down in the green bay
  b.hold('W2', 15);
  b.tick(1);
  assert.equal(b.line(pickLineId('W2')).points, 5);
  b.place('W2', bayMiddle('green').x, bayMiddle('green').y);
  b.tick(2);
  b.end();
  const pick = b.line(pickLineId('W2'));
  assert.deepEqual([pick.points, pick.ok, pick.detail], [0, false, 'picked at 0:01.0, but the cube is in the wrong bay: no points']);
  assert.equal(pick.time, undefined);
  assert.equal(b.line(LINE_WRONG_BAY).points, -5);
  // only partly inside the other bay: no -5, and the cube keeps its 5 for picking
  const p = bench();
  p.hold('W2', 15);
  p.tick(1);
  p.place('W2', BAYS.green.x + CUBE_SIZE / 2 - 1, bayMiddle('green').y);
  p.tick(2);
  p.end();
  assert.deepEqual([p.line(pickLineId('W2')).points, p.line(LINE_WRONG_BAY).points], [5, 0]);
  // taken out of the wrong bay again before the end: the 5 count again
  const t = bench();
  t.hold('W2', 15);
  t.tick(1);
  t.place('W2', bayMiddle('green').x, bayMiddle('green').y);
  t.tick(2);
  assert.equal(t.line(pickLineId('W2')).points, 0);
  t.place('W2', 900, 300);
  t.tick(3);
  assert.equal(t.line(pickLineId('W2')).points, 5);
  // the sheet adds up: leave 0 + pick 0 + wrong -5 + clean 5 = 0 for the first case
  assert.equal(b.score().total, 0);
});

test('touching the robot: seen from above AND in height - a raised claw above a cube does not touch it', () => {
  const m = bayMiddle('red');
  // W4 (red) in the middle of the red bay; the robot facing up with its LEFT finger right above
  // the cube (the finger 8 mm thick, its middle 36 mm left of the robot's middle line)
  const fingerMiddle = ROBOT.gripper.clawOpenGap / 2 + ROBOT.gripper.fingerThickness / 2;
  const pose: Pose = { x: m.x + fingerMiddle, y: m.y + ROBOT.gripper.gripForward, heading: 0 };
  const judged = (clawHeight: number) => {
    const b = bench();
    b.place('W4', m.x, m.y);
    b.robotAt(pose);
    b.world.robot.gripper.height = clawHeight;
    b.tick(5);
    b.end();
    const line = b.line(deliverLineId('W4'));
    return [line.points, line.detail];
  };
  // the arm up: the underside of the claw 75 mm above the mat, the cube 40 mm high
  assert.deepEqual(judged(ROBOT.gripper.liftUpHeight), [15, 'in the red bay since 0:05.0']);
  // the underside of the claw 0.6 mm above the top of the cube: not touching ...
  assert.deepEqual(judged(CUBE_SIZE + 0.6), [15, 'in the red bay since 0:05.0']);
  // ... 0.4 mm above it, or lower: touching (closer than 0.5 mm)
  assert.deepEqual(judged(CUBE_SIZE + 0.4), [0, 'in the red bay, but touching the robot']);
  assert.deepEqual(judged(ROBOT.gripper.liftDownHeight), [0, 'in the red bay, but touching the robot']);
  // the chassis reaches down to the mat: beside the cube it touches, whatever the claw does
  const c = bench();
  c.place('W4', m.x, m.y);
  c.robotAt({ x: m.x, y: m.y + CUBE_SIZE / 2 + ROBOT.chassisRear + 0.4, heading: Math.PI });
  c.world.robot.gripper.height = ROBOT.gripper.liftUpHeight;
  c.tick(5);
  assert.equal(c.line(deliverLineId('W4')).detail, 'in the red bay, but touching the robot - move away');
});

// =============================================================================================
// Off the mat
// =============================================================================================

test('off the mat: no part of the cube on the mat - it scores nothing, not even the 5 for picking it', () => {
  const b = bench();
  b.hold('W1', 20);
  b.tick(2);
  assert.equal(b.line(pickLineId('W1')).points, 5);
  // half over the edge: still on the mat
  b.place('W1', -CUBE_SIZE / 2 + 0.5, 300);
  b.tick(3);
  assert.equal(isOffMat(b.cube('W1')), false);
  assert.equal(b.line(pickLineId('W1')).points, 5);
  // completely beyond the edge (on the table): off the mat
  b.place('W1', -CUBE_SIZE / 2 - 0.01, 300);
  b.tick(4);
  assert.equal(isOffMat(b.cube('W1')), true);
  assert.deepEqual(b.said, ['0:04.0: Cube W1 (green) is off the mat. It scores nothing now.']);
  let pick = b.line(pickLineId('W1'));
  assert.deepEqual([pick.points, pick.ok, pick.detail], [0, false, 'picked at 0:02.0, but the cube is off the mat: no points']);
  assert.equal(b.line(deliverLineId('W1')).detail, 'off the mat: no points');
  // the simulator does not put it back (the rules let the referee do that for -5)
  b.tick(5);
  assert.deepEqual([b.cube('W1').x, b.cube('W1').y], [-CUBE_SIZE / 2 - 0.01, 300]);
  // over the other edges too
  for (const [x, y] of [
    [MAT_SIZE + 20.01, 600],
    [600, -20.01],
    [600, MAT_SIZE + 20.01],
  ]) {
    b.place('W1', x, y);
    assert.equal(isOffMat(b.cube('W1')), true, `${x}, ${y}`);
  }
  // back on the mat: its pick points count again
  b.place('W1', 600, 300);
  b.tick(6);
  pick = b.line(pickLineId('W1'));
  assert.equal(pick.points, 5);
});

test('off the mat: a cube the gripper still holds out over the table is held, not off the mat', () => {
  const b = bench();
  b.hold('W1', 70);
  b.tick(1);
  assert.equal(b.line(pickLineId('W1')).points, 5);
  // held 70 mm up, completely beyond the left edge of the mat
  Object.assign(b.cube('W1'), { x: -CUBE_SIZE });
  b.tick(2);
  assert.equal(isOffMat(b.cube('W1')), true, 'seen from above it is beyond the mat');
  assert.equal(isLyingOffMat(b.cube('W1'), b.world.robot.gripper.holding), false);
  assert.deepEqual(b.said, [], 'no "off the mat" sentence while it is held');
  b.end();
  assert.deepEqual([b.line(pickLineId('W1')).points, b.line(deliverLineId('W1')).detail], [5, 'the robot still held it - put it down in the green bay']);
  // let go there: now it lies off the mat
  const t = bench();
  t.hold('W1', 70);
  t.tick(1);
  Object.assign(t.cube('W1'), { x: -CUBE_SIZE });
  t.tick(2);
  t.place('W1', -CUBE_SIZE, t.cube('W1').y);
  t.tick(3);
  assert.deepEqual(t.said, ['0:03.0: Cube W1 (green) is off the mat. It scores nothing now.']);
  assert.equal(t.line(pickLineId('W1')).points, 0);
});

// =============================================================================================
// The blue cube: leave it alone (Q15: -5 when it is not where it was put)
// =============================================================================================

test('blue cube left alone: 0 points, "left alone" - and it never scores', () => {
  const b = bench();
  b.begin();
  b.robotAt({ ...START_POSE, y: 700 });
  b.tick(1);
  b.end();
  const blue = b.line(LINE_BLUE);
  assert.deepEqual([blue.label, blue.points, blue.max, blue.ok, blue.detail], ['Blue cube (W3)', 0, 0, true, 'left alone']);
  assert.equal(b.score().total, 10, 'left the start zone + clean run: the blue line adds nothing');
});

test('blue cube touched but not moved: 0 - a push of up to 5 mm costs nothing; 6 mm costs 5', () => {
  const home = cubeHome('W3');
  // the left finger 0.4 mm from the blue cube (touching, closer than 0.5 mm), the cube where it was put
  const t = bench();
  t.robotAt(besideLeftFinger(home, 0.4));
  t.tick(1);
  t.end();
  assert.deepEqual([t.line(LINE_BLUE).points, t.line(LINE_BLUE).detail], [0, 'left alone']);
  // pushed 4.9 mm (every corner 4.9 mm from where it stood): left alone ...
  const b = bench();
  b.place('W3', home.x + 4.9, home.y);
  b.tick(2);
  near(blueShift(b.cube('W3')), 4.9, 1e-9);
  assert.deepEqual([b.line(LINE_BLUE).points, b.line(LINE_BLUE).ok], [0, true]);
  assert.deepEqual(b.said, []);
  // ... exactly 5 mm too (more than 5 mm is moved) ...
  b.place('W3', home.x + BLUE_MOVED_MM, home.y);
  b.tick(3);
  assert.equal(b.line(LINE_BLUE).points, 0);
  // ... 6 mm: moved, -5, and the referee says so once
  b.place('W3', home.x, home.y - 6);
  b.tick(4);
  const blue = b.line(LINE_BLUE);
  assert.deepEqual([blue.points, blue.ok, blue.detail], [-5, false, 'moved: 6 mm from its place, -5']);
  assert.deepEqual(b.said, ['0:04.0: Cube W3 (blue) was moved out of its place. The blue cube must stay where it is.']);
  b.place('W3', home.x, home.y - 30);
  b.tick(5);
  assert.deepEqual(b.said, [], 'said once');
  assert.equal(b.line(LINE_BLUE).detail, 'moved: 30 mm from its place, -5');
  // a turn in place moves its corners: turned by 10 degrees a corner is 4.9 mm away, by 11 degrees 5.4 mm
  const turned = bench();
  turned.place('W3', home.x, home.y, 10 * DEG);
  turned.tick(1);
  assert.equal(turned.line(LINE_BLUE).points, 0);
  turned.place('W3', home.x, home.y, 11 * DEG);
  turned.tick(2);
  assert.equal(turned.line(LINE_BLUE).points, -5);
  // pushed back to its place before the end (and never lifted): left alone again - and the
  // referee says so, so that the console does not end on "moved" while the sheet says "left alone"
  b.place('W3', home.x + 1, home.y);
  b.tick(6);
  assert.deepEqual(b.said, ['0:06.0: Cube W3 (blue) is back in its place.']);
  b.tick(7);
  assert.deepEqual(b.said, [], 'said once');
  // moved again: said again
  b.place('W3', home.x + 8, home.y);
  b.tick(8);
  assert.deepEqual(b.said, ['0:08.0: Cube W3 (blue) was moved out of its place. The blue cube must stay where it is.']);
  b.place('W3', home.x, home.y);
  b.tick(9);
  assert.deepEqual(b.said, ['0:09.0: Cube W3 (blue) is back in its place.']);
  b.end();
  assert.deepEqual([b.line(LINE_BLUE).points, b.line(LINE_BLUE).detail], [0, 'left alone']);
});

test('blue cube moved just over 5 mm: the sheet never writes a distance that reads like the 5 mm limit', () => {
  const home = cubeHome('W3');
  const detail = (dx: number, angle = 0): string => {
    const b = bench();
    b.place('W3', home.x + dx, home.y, angle);
    b.tick(1);
    b.end();
    return b.line(LINE_BLUE).detail;
  };
  assert.equal(detail(BLUE_MOVED_MM), 'left alone', 'exactly 5 mm is not more than 5 mm');
  // (written the way Fire Chief writes a measure over its limit: up to the next tenth while the
  // whole number would read like the limit, the whole number above it)
  assert.equal(detail(5.0000001), 'moved: 5.1 mm from its place, -5');
  assert.equal(detail(5.01), 'moved: 5.1 mm from its place, -5');
  assert.equal(detail(5.049), 'moved: 5.1 mm from its place, -5');
  assert.equal(detail(5.44), 'moved: 5.4 mm from its place, -5');
  assert.equal(detail(5.46), 'moved: 5.5 mm from its place, -5');
  assert.equal(detail(5.5), 'moved: 6 mm from its place, -5');
  assert.equal(detail(9.96), 'moved: 10 mm from its place, -5');
  assert.equal(detail(10.4), 'moved: 10 mm from its place, -5');
  // turned in place by 10.2 degrees: a corner is 5.03 mm from where it stood
  near(blueShift({ ...bench().cube('W3'), angle: 10.2 * DEG }), 5.03, 0.005);
  assert.equal(detail(0, 10.2 * DEG), 'moved: 5.1 mm from its place, -5');
});

test('blue cube picked up and put back: -5 all the same; gripping it without lifting it costs nothing', () => {
  const home = cubeHome('W3');
  const b = bench();
  b.hold('W3', 15);
  b.tick(1);
  assert.deepEqual(b.said, ['0:01.0: Cube W3 (blue) was picked up: -5. The blue cube must stay where it is.']);
  b.place('W3', home.x, home.y);
  b.tick(2);
  b.end();
  const blue = b.line(LINE_BLUE);
  assert.deepEqual([blue.points, blue.ok, blue.detail], [-5, false, 'moved: picked up at 0:01.0, -5']);
  // no points for picking the blue cube: it has no pick-up line at all
  assert.equal(b.score().lines.some((l) => l.id === pickLineId('W3')), false);
  assert.equal(b.score().total, 0, 'clean run 5 - blue 5');
  // lifted 1 mm is lifted (the rules' 1 cm is for picking a red or green cube)
  const one = bench();
  one.hold('W3', 1);
  one.tick(1);
  one.place('W3', home.x, home.y);
  one.tick(2);
  assert.equal(one.line(LINE_BLUE).points, -5);
  // carried 40 mm on the mat is picked, even when it is carried back
  const carried = bench();
  carried.hold('W3', 0);
  carried.tick(1);
  Object.assign(carried.cube('W3'), { x: home.x + CARRY_MM });
  carried.tick(2);
  carried.place('W3', home.x, home.y);
  carried.tick(3);
  assert.equal(carried.line(LINE_BLUE).detail, 'moved: picked up at 0:02.0, -5');
  // gripped on its square, not lifted, not moved, let go: left alone
  const gripped = bench();
  gripped.hold('W3', 0);
  gripped.tick(1);
  assert.equal(gripped.line(LINE_BLUE).detail, 'moved: the robot is holding it, -5', 'while it is held, it is not left alone');
  gripped.place('W3', home.x, home.y);
  gripped.tick(2);
  gripped.end();
  assert.deepEqual([gripped.line(LINE_BLUE).points, gripped.line(LINE_BLUE).detail], [0, 'left alone']);
  assert.deepEqual(gripped.said, []);
});

test('blue cube held at the end: -5', () => {
  const b = bench();
  b.hold('W3', 0);
  b.tick(1);
  b.end();
  assert.deepEqual([b.line(LINE_BLUE).points, b.line(LINE_BLUE).detail], [-5, 'moved: the robot still held it, -5']);
});

test('blue cube in a bay: -5 once - no bay points and no "wrong bay" for it, nothing said about a bay', () => {
  for (const color of ['red', 'green'] as const) {
    const b = bench();
    b.hold('W3', 70);
    b.tick(1);
    b.place('W3', bayMiddle(color).x, bayMiddle(color).y);
    b.tick(2);
    assert.deepEqual(b.said, [], `${color}: the referee said "picked up" before; nothing about the bay`);
    b.end();
    const sheet = b.score();
    assert.equal(sheet.lines.find((l) => l.id === LINE_BLUE)!.points, -5, color);
    assert.equal(sheet.lines.find((l) => l.id === LINE_WRONG_BAY)!.points, 0, color);
    assert.equal(sheet.lines.find((l) => l.id === LINE_LAST_DELIVERY), undefined, color);
    assert.equal(sheet.lines.reduce((n, l) => n + l.points, 0), 5 - 5, `${color}: clean run 5, blue -5, nothing else`);
  }
  // pushed into a bay without being lifted: the same -5, once
  const pushed = bench();
  pushed.place('W3', bayMiddle('green').x, bayMiddle('green').y);
  pushed.tick(1);
  assert.deepEqual(pushed.said, ['0:01.0: Cube W3 (blue) was moved out of its place. The blue cube must stay where it is.']);
  assert.deepEqual([pushed.line(LINE_BLUE).points, pushed.line(LINE_WRONG_BAY).points], [-5, 0]);
});

test('blue cube off the mat: -5 once, and no "off the mat" sentence of its own', () => {
  const b = bench();
  b.place('W3', -CUBE_SIZE, 1100);
  b.tick(1);
  assert.deepEqual(b.said, ['0:01.0: Cube W3 (blue) was moved out of its place. The blue cube must stay where it is.']);
  b.tick(2);
  b.end();
  const sheet = b.score();
  assert.deepEqual([sheet.lines.find((l) => l.id === LINE_BLUE)!.points, sheet.lines.find((l) => l.id === LINE_BLUE)!.detail], [-5, 'moved: it is off the mat, -5']);
  assert.equal(sheet.lines.filter((l) => l.points < 0).length, 1, 'one penalty line');
  assert.equal(sheet.total, 0);
});

test('blue cube and a restart: lifted before the restart, back on its square after it - still -5', () => {
  const b = bench();
  b.hold('W3', 70);
  b.tick(1);
  b.restart();
  // (the engine puts a held cube back onto its own orange square at a restart: see the engine test below)
  b.place('W3', cubeHome('W3').x, cubeHome('W3').y);
  b.tick(2);
  b.end();
  assert.deepEqual([b.line(LINE_BLUE).points, b.line(LINE_BLUE).detail], [-5, 'moved: picked up at 0:01.0, -5']);
});

// =============================================================================================
// +10 finish park
// =============================================================================================

test('finish park: the robot touches a round pad at the end - not "entirely inside" (no robot fits)', () => {
  const b = bench();
  const pad = FINISH_PADS.left;
  const right = pad.cx + pad.rx;
  // facing right, its back 0.01 mm over the right edge of the left pad: touching
  b.robotAt({ x: right + ROBOT.chassisRear - 0.01, y: pad.cy, heading: Math.PI / 2 });
  b.tick(50);
  let line = b.line(LINE_PARK);
  assert.deepEqual([line.points, line.max, line.detail], [10, 10, 'the robot touches the left pad']);
  // 0.01 mm short: not touching
  b.robotAt({ x: right + ROBOT.chassisRear + 0.01, y: pad.cy, heading: Math.PI / 2 });
  b.tick(51);
  b.end();
  line = b.line(LINE_PARK);
  assert.deepEqual([line.points, line.detail], [0, 'the robot did not touch a finish pad at the end']);
  // the fingers count too: facing right, left of the right pad, the tips of the fingers reach into
  // it first. The pad is round: at the inner edge of a finger (32 mm beside the middle) its left
  // edge is 6.5 mm further right than in the middle.
  const t = bench();
  const other = FINISH_PADS.right;
  const tipReach = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  const inner = ROBOT.gripper.clawOpenGap / 2;
  const edgeX = other.cx - other.rx * Math.sqrt(1 - (inner / other.ry) ** 2);
  near(edgeX - (other.cx - other.rx), 6.54, 0.01);
  t.robotAt({ x: edgeX - tipReach + 0.01, y: other.cy, heading: Math.PI / 2 });
  t.tick(1);
  assert.equal(t.line(LINE_PARK).detail, 'the robot touches the right pad');
  t.robotAt({ x: edgeX - tipReach - 0.01, y: other.cy, heading: Math.PI / 2 });
  t.tick(2);
  assert.equal(t.line(LINE_PARK).ok, false);
});

test('finish park: the pads are round - a corner beside the pad is not touching it', () => {
  const pad = FINISH_PADS.right;
  // a 10 mm square below and right of the pad, its corner pointing at the middle of the pad (45
  // degrees): the edge of the pad is `edge` mm away from the middle in that direction
  const edge = 1 / Math.sqrt(0.5 / pad.rx ** 2 + 0.5 / pad.ry ** 2);
  const reach = (d: number): OBB => {
    const corner = (edge + d) * Math.SQRT1_2;
    return { x: pad.cx + corner + 5, y: pad.cy + corner + 5, w: 10, l: 10, angle: 0 };
  };
  assert.equal(obbTouchesEllipse(reach(-0.01), pad), true);
  assert.equal(obbTouchesEllipse(reach(0.01), pad), false);
  // the corner of the box around the pad is not the pad
  const corner: OBB = { x: pad.cx + pad.rx + 4, y: pad.cy + pad.ry + 4, w: 10, l: 10, angle: 0 };
  assert.equal(obbTouchesEllipse(corner, pad), false);
  // a box that holds the whole pad, and a box inside the pad, both touch it
  assert.equal(obbTouchesEllipse({ x: pad.cx, y: pad.cy, w: 400, l: 400, angle: 0.3 }, pad), true);
  assert.equal(obbTouchesEllipse({ x: pad.cx, y: pad.cy, w: 10, l: 10, angle: 0 }, pad), true);
  // on the turned field the ellipse is higher (80.09) than wide (78.57)
  assert.equal(obbTouchesEllipse({ x: pad.cx, y: pad.cy + 80.09 + 5 - 0.01, w: 10, l: 10, angle: 0 }, pad), true);
  assert.equal(obbTouchesEllipse({ x: pad.cx + 78.57 + 5 + 0.01, y: pad.cy, w: 10, l: 10, angle: 0 }, pad), false);
  assert.equal(parkedOn(robotShapesAt(ROBOT, START_POSE)), null);
});

// =============================================================================================
// Clean run, restarts, the floor at 0, 80 points
// =============================================================================================

test('clean run and restarts: +5 without a restart; each restart -10 and no bonus; never below 0', () => {
  const b = bench();
  b.robotAt({ ...START_POSE, y: 700 });
  b.tick(1);
  assert.equal(b.score().total, 10, 'left the start zone + clean run');
  b.restart();
  b.robotHome();
  b.tick(2);
  let sheet = b.score();
  assert.equal(sheet.lines.find((l) => l.id === LINE_CLEAN)!.points, 0);
  assert.deepEqual(
    [sheet.lines.find((l) => l.id === LINE_RESTARTS)!.points, sheet.lines.find((l) => l.id === LINE_RESTARTS)!.detail],
    [-10, '1 restart (0:01.0), -10 each'],
  );
  assert.equal(sheet.lines.find((l) => l.id === LINE_LEAVE_START)!.ok, true, 'points earned before a restart stay');
  assert.equal(sheet.total, 0, '5 - 10 = -5: the total is never below 0');
  b.restart();
  b.restart();
  b.end();
  sheet = b.score();
  assert.equal(sheet.lines.find((l) => l.id === LINE_RESTARTS)!.points, -30);
  assert.equal(sheet.total, 0);
  assert.equal(sheet.lines.find((l) => l.id === LINE_CLEAN)!.detail, 'a restart was used');
});

test('80 points: every red and green cube picked and in its bay, the blue one left alone, the robot left the start zone and touches a pad, no restart', () => {
  const s = arrangementOf('GR-RB');
  const b = bench(s);
  b.begin();
  let t = 1;
  for (const w of ['W1', 'W2', 'W3'] as const) {
    b.hold(w, 70);
    b.tick(t++);
  }
  const red = bayPlaces('red');
  const green = bayPlaces('green');
  b.place('W2', red[0].x, red[0].y);
  b.tick(t++);
  b.place('W3', red[2].x, red[2].y);
  b.tick(t++);
  b.place('W1', green[1].x, green[1].y);
  b.tick(t++);
  const pad = FINISH_PADS.right;
  b.robotAt({ x: pad.cx, y: pad.cy, heading: 0 });
  b.tick(t++);
  b.end();
  const sheet = b.score();
  assert.equal(sheet.total, 80);
  assert.equal(sheet.max, 80);
  assert.equal(sheet.complete, true);
  assert.ok(sheet.lines.every((l) => l.max === 0 || l.ok));
  assert.deepEqual([sheet.lines.find((l) => l.id === LINE_BLUE)!.points, sheet.lines.find((l) => l.id === LINE_BLUE)!.detail], [0, 'left alone']);
  // tie-breaker 3: the time of the last correct delivery - W1, put in the green bay at 6 s
  const last = sheet.lines.find((l) => l.id === LINE_LAST_DELIVERY)!;
  assert.deepEqual([last.points, last.max, last.ok, last.time], [0, 0, true, 6]);
  assert.equal(last.detail, 'for a tie: 3 cubes in the right bay, the last one put there at 0:06.0');
  // ... and the blue cube moved as well: 75, and not "every goal complete" - leaving the blue cube
  // where it is is part of the mission, though its line brings no points (the end of the match
  // and the test window read `complete`)
  b.place('W4', 1000, 1000);
  const moved = b.score();
  assert.equal(moved.total, 75);
  assert.equal(moved.lines.find((l) => l.id === LINE_BLUE)!.ok, false);
  assert.equal(moved.complete, false);
  // pushed only 6 mm: the same
  b.place('W4', cubeHome('W4').x - 6, cubeHome('W4').y);
  assert.deepEqual([b.score().total, b.score().complete], [75, false]);
  // back on its square (never lifted): complete again
  b.place('W4', cubeHome('W4').x, cubeHome('W4').y);
  assert.deepEqual([b.score().total, b.score().complete], [80, true]);
});

test('time of the last correct delivery: the latest of the cubes that count at the end', () => {
  const b = bench();
  // W2 and W4 are red, W1 green (W3 is the blue cube)
  b.place('W2', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(10);
  b.place('W4', bayPlaces('red')[1].x, bayPlaces('red')[1].y);
  b.tick(20);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 20);
  // W4 taken out again: then W2 is the last one that counts
  b.place('W4', 900, 900);
  b.tick(25);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 10);
  // no cube in the right bay: no such line
  b.place('W2', 300, 900);
  b.tick(26);
  assert.equal(b.score().lines.find((l) => l.id === LINE_LAST_DELIVERY), undefined);
  b.place('W2', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(27);
  b.place('W2', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(28);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 27);
  // a cube in the wrong bay does not count; a cube held in its bay does not either
  b.place('W4', bayPlaces('green')[0].x, bayPlaces('green')[0].y);
  b.tick(30);
  b.place('W1', bayPlaces('green')[2].x, bayPlaces('green')[2].y);
  b.hold('W1', 0);
  b.tick(31);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 27);
  // put down: from now on it counts, with the time it was let go
  b.place('W1', bayPlaces('green')[2].x, bayPlaces('green')[2].y);
  b.tick(32);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 32);
  assert.equal(b.line(LINE_LAST_DELIVERY).detail, 'for a tie: 2 cubes in the right bay, the last one put there at 0:32.0');
  assert.equal(clock(83.47), '1:23.4');
  assert.equal(clock(5), '0:05.0');
});

// =============================================================================================
// With the real engine
// =============================================================================================

/**
 * From the start: 45.75 mm forward, a quarter turn left (now facing left), 362.43 mm: the claw
 * around the W3 cube (bottom left). (The same moves took the robot to the cube that was "W4"
 * before the field was turned: it is the same cube, turned with the field.)
 */
const toW3: Script = function* (io) {
  yield* drive(io, 45.75);
  yield* turn(io, -90);
  yield* drive(io, 362.43);
};
/** W1 green, W2 blue, W3 red, W4 red. */
const RED_W3 = 'GB-RR';

test('engine: the gripper takes a cube, lifts it 70 mm and the referee counts it; the colour sensor names it', () => {
  let colourBeforeGrip = '';
  let lifted = false;
  const steps = scripted(function* (io) {
    // the arm is down, the claw open: drive the claw around the cube
    yield* toW3(io);
    colourBeforeGrip = io.frontColor();
    io.setServo('S2', 60); // close the claw (it stops on the cube)
    yield* waitUntil(() => io.servoDone('S2'));
    io.setServo('S1', 90); // arm up
    yield* waitUntil(() => io.servoDone('S1'));
    lifted = true;
    for (;;) yield;
  });
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: arrangementOf(RED_W3), program: {} }, steps.factory);
  sim.start();
  for (let i = 0; i < 2000 && !lifted; i++) sim.step(1);
  assert.ok(lifted, 'the arm went up');
  sim.step(2);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W3'))!;
  assert.equal(sim.world.robot.gripper.holding, cube.id);
  near(cube.z, 70, 1e-6, 'the cube is 70 mm above the mat (arm up: 75 mm, gripped 5 mm above its base)');
  near(sim.world.robot.gripper.gap, CUBE_SIZE, 0.5, 'the claw closed on the 40 mm cube');
  assert.equal(colourBeforeGrip, 'red', 'the colour sensor at the claw names the cube before it is gripped');
  assert.equal(sim.readSensors().frontColor, 'red', 'and while it is held');
  const sheet = sim.score();
  assert.equal(sheet.lines.find((l) => l.id === pickLineId('W3'))!.ok, true);
  assert.equal(sheet.lines.find((l) => l.id === LINE_LEAVE_START)!.ok, true);
});

test('engine: the blue cube - the colour sensor says "blue"; lifting it costs 5 and brings nothing; a restart puts it back, the 5 stay lost', () => {
  let colourBeforeGrip = '';
  let lifted = false;
  const steps = scripted(function* (io) {
    yield* toW3(io);
    colourBeforeGrip = io.frontColor();
    io.setServo('S2', 60);
    yield* waitUntil(() => io.servoDone('S2'));
    io.setServo('S1', 90);
    yield* waitUntil(() => io.servoDone('S1'));
    lifted = true;
    for (;;) yield;
  });
  // the default arrangement: W3 holds the blue cube
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {} }, steps.factory);
  sim.start();
  for (let i = 0; i < 2000 && !lifted; i++) sim.step(1);
  sim.step(2);
  assert.equal(colourBeforeGrip, 'blue');
  assert.equal(sim.readSensors().frontColor, 'blue');
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W3'))!;
  assert.equal(sim.world.robot.gripper.holding, cube.id);
  let sheet = sim.score();
  assert.equal(sheet.lines.find((l) => l.id === LINE_BLUE)!.points, -5);
  assert.equal(sheet.lines.some((l) => l.id === pickLineId('W3')), false, 'no points for picking the blue cube');
  assert.equal(sheet.total, 5 + 5 - 5, 'left the zone, clean run so far, blue moved');
  sim.restart();
  assert.deepEqual({ x: cube.x, y: cube.y, z: cube.z, held: cube.held }, { ...cubeHome('W3'), z: 0, held: false }, 'back on its orange square');
  sim.step(1);
  sheet = sim.score();
  assert.deepEqual([sheet.lines.find((l) => l.id === LINE_BLUE)!.points, sheet.lines.find((l) => l.id === LINE_BLUE)!.detail.startsWith('moved: picked up at 0:0')], [-5, true]);
});

/**
 * The blue cube in the claw (arm down) dragged `drag` mm, then a restart: what the console says
 * about the blue cube, and its line before the restart and at the end. `blockHome`: another cube
 * is put over a part of the blue cube's orange square before the restart.
 */
function dragBlueThenRestart(drag: number, blockHome = false) {
  let dragged = false;
  const steps = scripted(function* (io) {
    yield* toW3(io);
    io.setServo('S2', 60); // the claw closes on the blue cube; the arm stays down
    yield* waitUntil(() => io.servoDone('S2'));
    yield* drive(io, -drag);
    dragged = true;
    for (;;) yield;
  });
  // the default arrangement: W3 holds the blue cube
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {} }, steps.factory);
  const said: string[] = [];
  const listen = (): void => {
    for (const e of sim.drainEvents()) if (e.type === 'log' && /blue/.test(e.text)) said.push(e.text);
  };
  sim.start();
  for (let i = 0; i < 3000 && !dragged; i++) {
    sim.step(1);
    listen();
  }
  assert.ok(dragged, 'the robot dragged the cube');
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W3'))!;
  assert.equal(sim.world.robot.gripper.holding, cube.id);
  const shift = blueShift(cube);
  const before = sim.score().lines.find((l) => l.id === LINE_BLUE)!;
  if (blockHome) {
    // (the robot, say, pushed the red cube of W4 there): the robot faces left and dragged the
    // blue cube to the right, so the red one now covers the left 15 mm of the blue cube's square
    const other = sim.world.bodies.find((b) => b.id === cubeBodyId('W4'))!;
    Object.assign(other, { x: cubeHome('W3').x - 25, y: cubeHome('W3').y });
  }
  sim.restart();
  sim.step(1);
  listen();
  sim.declareFinished();
  listen();
  const after = sim.score().lines.find((l) => l.id === LINE_BLUE)!;
  return { shift, before, after, said, cube };
}

test('engine: the blue cube dragged 30 mm in the claw (not lifted, less than 40 mm), then a restart - back on its square: "left alone", and the console says it is back', () => {
  const r = dragBlueThenRestart(30);
  near(r.shift, 30, 0.5, 'dragged 30 mm');
  assert.deepEqual([r.before.points, r.before.detail], [-5, 'moved: the robot is holding it, -5'], 'before the restart');
  assert.deepEqual([r.after.points, r.after.detail], [0, 'left alone'], 'the restart put it back on its square (the owner: a held cube goes back, like the others)');
  assert.equal(r.said.length, 2, r.said.join(' / '));
  assert.match(r.said[0], /^0:\d\d\.\d: Cube W3 \(blue\) was moved out of its place\. The blue cube must stay where it is\.$/);
  assert.match(r.said[1], /^0:\d\d\.\d: Cube W3 \(blue\) is back in its place\.$/, 'the console does not end on "moved"');
});

test('engine: the blue cube in the claw at a restart while another cube covers its square - put as close as the engine can, and judged from its square: moved, -5 (Q15)', () => {
  const r = dragBlueThenRestart(30, true);
  // (the engine's restart rule for a carried cube: its own square, or the nearest free place)
  assert.ok(blueShift(r.cube) > BLUE_MOVED_MM, `${blueShift(r.cube)}`);
  assert.equal(r.after.points, -BLUE_PENALTY);
  assert.match(r.after.detail, /^moved: \d+ mm from its place, -5$/);
  assert.deepEqual(r.said.filter((t) => /back in its place/.test(t)), [], 'it is not back: nothing says so');
});

test('engine: restart with a cube in the gripper - the cube back on its orange square, the others stay, -10', () => {
  let carried = false;
  const s = scripted(function* (io) {
    yield* toW3(io);
    io.setServo('S2', 60);
    yield* waitUntil(() => io.servoDone('S2'));
    io.setServo('S1', 90);
    yield* waitUntil(() => io.servoDone('S1'));
    yield* drive(io, -150);
    carried = true;
    for (;;) yield;
  });
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: arrangementOf(RED_W3), program: {} }, s.factory);
  // W1's cube was moved somewhere else before (by the robot, say)
  const w1 = sim.world.bodies.find((b) => b.id === cubeBodyId('W1'))!;
  sim.start();
  w1.x = 300;
  w1.y = 300;
  for (let i = 0; i < 3000 && !carried; i++) sim.step(1);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W3'))!;
  assert.equal(cube.held, true);
  assert.ok(Math.abs(cube.x - cubeHome('W3').x) > 100, 'carried away from its warehouse');
  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.equal(cube.held, false);
  assert.deepEqual({ x: cube.x, y: cube.y, z: cube.z }, { ...cubeHome('W3'), z: 0 });
  assert.deepEqual({ x: w1.x, y: w1.y }, { x: 300, y: 300 }, 'every other cube stays where it lies');
  assert.deepEqual(sim.world.robot.pose, START_POSE);
  sim.step(1);
  const sheet = sim.score();
  assert.equal(sheet.lines.find((l) => l.id === LINE_RESTARTS)!.points, -10);
  assert.equal(sheet.lines.find((l) => l.id === LINE_CLEAN)!.points, 0);
  assert.equal(sheet.lines.find((l) => l.id === pickLineId('W3'))!.points, 5, 'picked before the restart: it stays');
  assert.equal(sheet.lines.find((l) => l.id === LINE_LEAVE_START)!.points, 5);
  // as many restarts as the team wants
  sim.restart();
  sim.restart();
  assert.equal(sim.restarts, 3);
  assert.equal(sim.restartsLeft, Infinity);
});

test('engine: the colour sensor at the claw sees a cube up to 35 mm ahead of the gripping point, arm down - red, green and blue alike', () => {
  const at = (ahead: number, scenario: WarehouseSortScenario) => {
    const home = cubeHome('W4');
    // facing down (the arm down, the claw open), the near face of the cube `ahead` mm beyond the gripping point
    const gripY = home.y - CUBE_SIZE / 2 - ahead;
    const h = scripted(forever);
    const sim = createEngineSimulation(
      { game: warehouseSortGame, scenario, program: {}, startPose: { x: home.x, y: gripY - ROBOT.gripper.gripForward, heading: Math.PI } },
      h.factory,
    );
    return sim.readSensors().frontColor;
  };
  for (const [code, colour] of [
    ['GB-RR', 'red'],
    ['RB-RG', 'green'],
    ['RG-RB', 'blue'],
  ] as const) {
    const s = arrangementOf(code);
    assert.equal(s.cubes.W4, colour);
    assert.equal(at(0, s), colour, code);
    assert.equal(at(35, s), colour, code);
    assert.equal(at(35.1, s), 'none', code);
    assert.equal(at(-15, s), colour, `${code}: the cube between the fingers`);
  }
  // with the arm up the sensor (at the claw) looks over a cube on the mat
  assert.equal(ROBOT.gripper.liftUpHeight + ROBOT.gripper.fingerHeight / 2 > 40, true);
});

test('engine: no walls - the robot drives off the mat and stops at the edge of the table, 100 mm further', () => {
  const h = scripted(function* (io) {
    yield* turn(io, 180);
    yield* drive(io, 400);
  });
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {} }, h.factory);
  sim.start();
  for (let i = 0; i < 1500 && sim.status === 'running'; i++) sim.step(1);
  // facing down: its front (the claw, 167 mm ahead) is stopped at y = 1235 + 100
  const pose = sim.world.robot.pose;
  near(Math.abs(pose.heading), Math.PI, 0.01);
  near(pose.y + 167, MAT_SIZE + 100, 0.6, 'the claw at the edge of the table');
});
