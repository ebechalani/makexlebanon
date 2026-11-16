/**
 * The Warehouse Sort referee, line by line of the rules (§5 - §8), with the edges of every line.
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
import { BAYS, CUBE_SIZE, FINISH_PADS, MAT_SIZE, START_ZONE, WAREHOUSES, WAREHOUSE_IDS, type WarehouseId } from './field';
import {
  CARRY_MM,
  KIND_CUBE,
  LIFT_MM,
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
import { defaultScenario, type WarehouseSortScenario } from './scenario';

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

/**
 * The robot facing up with a cube (middle at `cube`) between its open fingers, `gap` mm from the
 * inner face of its left finger. (The inner faces are half the open gap, 32 mm, from the middle.)
 */
function besideLeftFinger(cube: { x: number; y: number }, gap: number): Pose {
  const half = ROBOT.gripper.clawOpenGap / 2;
  return { x: cube.x + half - CUBE_SIZE / 2 - gap, y: cube.y + ROBOT.gripper.gripForward, heading: 0 };
}
/** Two places side by side in a bay, for two cubes. */
const bayPlaces = (color: 'red' | 'green') => {
  const c = bayMiddle(color);
  return [
    { x: c.x - 30, y: c.y },
    { x: c.x + 30, y: c.y },
  ];
};

// =============================================================================================
// The game
// =============================================================================================

test('game: 90 s, 100 points at most, 4 cubes on the orange squares, -10 per restart, no limit', () => {
  const g = warehouseSortGame;
  assert.equal(g.id, 'warehouse-sort');
  assert.equal(g.matchDuration, 90);
  assert.equal(MATCH_DURATION, 90);
  assert.equal(MAX_SCORE, 100);
  assert.equal(5 + 4 * 5 + 4 * 15 + 10 + 5, MAX_SCORE);
  assert.equal(g.restartPenalty, 10);
  assert.equal(RESTART_PENALTY, 10);
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
    assert.equal(body.label, body.colorName === 'red' ? 'R' : 'G');
    assert.ok(body.grippable && !body.platform);
    assert.deepEqual([body.w, body.l, body.h, body.z], [CUBE_SIZE, CUBE_SIZE, 40, 0]);
    assert.deepEqual(body.home, { x: body.x, y: body.y, angle: 0, z: 0, restingOn: null });
  }
  const zones = g.overlays(defaultScenario());
  assert.deepEqual(
    zones.map((z) => z.id),
    ['start', 'warehouse:W1', 'warehouse:W2', 'warehouse:W3', 'warehouse:W4', 'bay:red', 'bay:green', 'pad:top', 'pad:bottom'],
  );
});

test('sheet before anything happened: only the clean-run bonus, every line says "not yet"', () => {
  const b = bench();
  const sheet = b.score();
  assert.equal(sheet.total, 5);
  assert.equal(sheet.max, 100);
  assert.equal(sheet.complete, false);
  assert.equal(sheet.time, undefined, 'the sheet has no "time of this score": the rules rank equal points by deliveries first');
  assert.deepEqual(
    sheet.lines.map((l) => l.id),
    [
      LINE_LEAVE_START,
      ...WAREHOUSE_IDS.map(pickLineId),
      ...WAREHOUSE_IDS.map(deliverLineId),
      LINE_PARK,
      LINE_CLEAN,
      LINE_RESTARTS,
      LINE_WRONG_BAY,
    ],
    'the line with the time of the last correct delivery comes with the first one',
  );
  assert.equal(b.line(LINE_LEAVE_START).detail, 'not yet - drive out of the start zone');
  assert.equal(b.line(pickLineId('W1')).label, 'Pick up cube W1 (red)');
  assert.equal(b.line(deliverLineId('W2')).label, 'Cube W2 (green) in the green bay');
  assert.equal(b.line(LINE_CLEAN).detail, 'no restart so far');
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
  // the claw is 13.915 mm from the frame's outer edge: 13.9 mm forward is still inside ...
  b.robotAt({ ...START_POSE, x: START_POSE.x - 13.9 });
  b.tick(1);
  assert.equal(b.line(LINE_LEAVE_START).ok, false);
  // ... 0.03 mm more and the tips of the fingers are out
  b.robotAt({ ...START_POSE, x: START_POSE.x - 13.93 });
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
  b.robotAt({ ...START_POSE, x: START_POSE.x - 20 });
  b.begin();
  b.tick();
  assert.equal(b.line(LINE_LEAVE_START).time, 0.01);
  const note = b.line(LINE_START_POSITION);
  assert.deepEqual([note.points, note.max, note.ok], [0, 0, false]);
  // also before the start signal the sheet says so
  const fresh = bench();
  fresh.robotAt({ ...START_POSE, y: START_ZONE.y });
  assert.ok(fresh.score().lines.some((l) => l.id === LINE_START_POSITION));
});

test('leave the start zone: a robot that never leaves', () => {
  const b = bench();
  b.begin();
  for (let i = 0; i < 10; i++) b.tick();
  b.end();
  assert.equal(b.line(LINE_LEAVE_START).detail, 'the robot never left the start zone');
});

test('leave the start zone: the zone runs to the right edge of the mat - backing over that edge counts too (Q11)', () => {
  // (the rules do not say; the Rules window and the README say that this counts, and ask the organiser)
  const b = bench();
  b.begin();
  b.tick();
  // the back of the chassis 13.915 mm from the edge of the mat: 13.9 mm back is still inside ...
  b.robotAt({ ...START_POSE, x: START_POSE.x + 13.9 });
  b.tick(1);
  assert.equal(b.line(LINE_LEAVE_START).ok, false);
  // ... 1 mm over the edge of the mat, onto the table: out of the zone, without entering the field
  // (facing left, the back of the chassis is chassisRear to the right of the middle of the axle)
  b.robotAt({ ...START_POSE, x: MAT_SIZE + 1 - ROBOT.chassisRear });
  b.tick(2);
  assert.deepEqual([b.line(LINE_LEAVE_START).points, b.line(LINE_LEAVE_START).time], [5, 2]);
});

// =============================================================================================
// +5 each cube picked
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
  assert.deepEqual(b.said, ['+5 points at 0:03.0: cube W1 (red) picked up.']);
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
  Object.assign(b.cube('W4'), { x: home.x - 39.9 });
  b.tick(5.5);
  assert.equal(b.line(pickLineId('W4')).ok, false);
  Object.assign(b.cube('W4'), { x: home.x - 40 });
  b.tick(6);
  assert.equal(b.line(pickLineId('W4')).time, 6);
  // let go and take it again: the carry counts from where it was taken
  const c = bench();
  c.hold('W3', 0);
  c.tick(1);
  Object.assign(c.cube('W3'), { x: cubeHome('W3').x + 30 });
  c.tick(2);
  c.place('W3', cubeHome('W3').x + 30, cubeHome('W3').y);
  c.tick(3);
  c.hold('W3', 0);
  c.tick(4);
  Object.assign(c.cube('W3'), { x: cubeHome('W3').x + 60 });
  c.tick(5);
  assert.equal(c.line(pickLineId('W3')).ok, false, '30 + 30 mm in two goes is not one carry of 40');
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
  // W1 is red: right in the middle of the red bay
  b.place('W1', bayMiddle('red').x, bayMiddle('red').y);
  b.tick(10);
  assert.deepEqual(b.said, ['0:10.0: Cube W1 (red) is in the red bay.']);
  let line = b.line(deliverLineId('W1'));
  assert.deepEqual([line.points, line.max, line.ok, line.time, line.detail], [15, 15, true, 10, 'in the red bay since 0:10.0']);
  // exactly on the edge of the bay still counts (the boundary is part of the bay) ...
  b.place('W1', red.x + CUBE_SIZE / 2, red.y + CUBE_SIZE / 2);
  b.tick(11);
  assert.equal(b.line(deliverLineId('W1')).ok, true);
  assert.equal(b.line(deliverLineId('W1')).time, 10, 'it never left the bay: still the first time');
  // ... 0.01 mm over the edge does not: only partly inside
  b.place('W1', red.x + CUBE_SIZE / 2 - 0.01, red.y + CUBE_SIZE / 2);
  b.tick(12);
  line = b.line(deliverLineId('W1'));
  assert.deepEqual([line.points, line.ok, line.detail], [0, false, 'only partly in the red bay - the whole cube must be inside']);
  assert.equal(b.line(LINE_WRONG_BAY).points, 0, 'partly in a bay: nothing either way');
  // a cube turned by 45 degrees needs more room
  b.place('W1', red.x + CUBE_SIZE / 2 + 1, bayMiddle('red').y, 45 * DEG);
  assert.equal(bayAround({ x: b.cube('W1').x, y: b.cube('W1').y, w: 40, l: 40, angle: 45 * DEG }), null);
  b.place('W1', red.x + CUBE_SIZE * Math.SQRT1_2 + 0.01, bayMiddle('red').y, 45 * DEG);
  b.tick(13);
  assert.equal(b.line(deliverLineId('W1')).ok, true);
  assert.equal(b.line(deliverLineId('W1')).time, 13, 'it came back into the bay: a new time');
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
  // W1 is red, W2 green: each in the other colour's bay
  const [g1] = bayPlaces('green');
  const [r1] = bayPlaces('red');
  b.place('W1', g1.x, g1.y);
  b.place('W2', r1.x, r1.y);
  b.tick(40);
  assert.deepEqual(b.said, ['0:40.0: Cube W1 (red) is in the green bay - the wrong bay.', '0:40.0: Cube W2 (green) is in the red bay - the wrong bay.']);
  const sheet = b.score();
  const wrong = sheet.lines.find((l) => l.id === LINE_WRONG_BAY)!;
  assert.deepEqual([wrong.points, wrong.max, wrong.ok], [-10, 0, false]);
  assert.equal(wrong.detail, 'cube W1 (red), cube W2 (green), -5 each');
  assert.equal(sheet.lines.find((l) => l.id === deliverLineId('W1'))!.detail, 'in the green bay - wrong bay, -5');
  assert.equal(sheet.lines.find((l) => l.id === deliverLineId('W1'))!.points, 0);
  assert.equal(sheet.total, 0, '5 for the clean run - 10: never below 0');
  assert.equal(sheet.lines.find((l) => l.id === LINE_LAST_DELIVERY), undefined, 'a wrong delivery is no delivery');
  // in the wrong bay but touching the robot: no penalty
  const t = bench();
  const m = bayMiddle('green');
  t.place('W1', m.x, m.y);
  t.robotAt(besideLeftFinger(m, 0.4));
  t.tick(1);
  assert.equal(t.line(LINE_WRONG_BAY).points, 0);
  assert.equal(t.line(deliverLineId('W1')).detail, 'in the green bay, but touching the robot - move away');
});

test('wrong bay: "no points for that cube" - it also loses its 5 for picking, as a cube off the mat does (Q9, Q10)', () => {
  const b = bench();
  // W2 is green: picked (lifted 15 mm), then put down in the red bay
  b.hold('W2', 15);
  b.tick(1);
  assert.equal(b.line(pickLineId('W2')).points, 5);
  b.place('W2', bayMiddle('red').x, bayMiddle('red').y);
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
  p.place('W2', BAYS.red.x + CUBE_SIZE / 2 - 1, bayMiddle('red').y);
  p.tick(2);
  p.end();
  assert.deepEqual([p.line(pickLineId('W2')).points, p.line(LINE_WRONG_BAY).points], [5, 0]);
  // taken out of the wrong bay again before the end: the 5 count again
  const t = bench();
  t.hold('W2', 15);
  t.tick(1);
  t.place('W2', bayMiddle('red').x, bayMiddle('red').y);
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
  b.hold('W3', 20);
  b.tick(2);
  assert.equal(b.line(pickLineId('W3')).points, 5);
  // half over the edge: still on the mat
  b.place('W3', -CUBE_SIZE / 2 + 0.5, 1000);
  b.tick(3);
  assert.equal(isOffMat(b.cube('W3')), false);
  assert.equal(b.line(pickLineId('W3')).points, 5);
  // completely beyond the edge (on the table): off the mat
  b.place('W3', -CUBE_SIZE / 2 - 0.01, 1000);
  b.tick(4);
  assert.equal(isOffMat(b.cube('W3')), true);
  assert.deepEqual(b.said, ['0:04.0: Cube W3 (green) is off the mat. It scores nothing now.']);
  let pick = b.line(pickLineId('W3'));
  assert.deepEqual([pick.points, pick.ok, pick.detail], [0, false, 'picked at 0:02.0, but the cube is off the mat: no points']);
  assert.equal(b.line(deliverLineId('W3')).detail, 'off the mat: no points');
  // the simulator does not put it back (the rules let the referee do that for -5)
  b.tick(5);
  assert.deepEqual([b.cube('W3').x, b.cube('W3').y], [-CUBE_SIZE / 2 - 0.01, 1000]);
  // over the other edges too
  for (const [x, y] of [
    [MAT_SIZE + 20.01, 600],
    [600, -20.01],
    [600, MAT_SIZE + 20.01],
  ]) {
    b.place('W3', x, y);
    assert.equal(isOffMat(b.cube('W3')), true, `${x}, ${y}`);
  }
  // back on the mat: its pick points count again
  b.place('W3', 600, 1100);
  b.tick(6);
  pick = b.line(pickLineId('W3'));
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
  assert.deepEqual([b.line(pickLineId('W1')).points, b.line(deliverLineId('W1')).detail], [5, 'the robot still held it - put it down in the red bay']);
  // let go there: now it lies off the mat
  const t = bench();
  t.hold('W1', 70);
  t.tick(1);
  Object.assign(t.cube('W1'), { x: -CUBE_SIZE });
  t.tick(2);
  t.place('W1', -CUBE_SIZE, t.cube('W1').y);
  t.tick(3);
  assert.deepEqual(t.said, ['0:03.0: Cube W1 (red) is off the mat. It scores nothing now.']);
  assert.equal(t.line(pickLineId('W1')).points, 0);
});

// =============================================================================================
// +10 finish park
// =============================================================================================

test('finish park: the robot touches a round pad at the end - not "entirely inside" (no robot fits)', () => {
  const b = bench();
  const pad = FINISH_PADS.bottom;
  const top = pad.cy - pad.ry;
  // facing up, its back 0.01 mm over the top of the bottom pad: touching
  b.robotAt({ x: pad.cx, y: top - ROBOT.chassisRear + 0.01, heading: 0 });
  b.tick(50);
  let line = b.line(LINE_PARK);
  assert.deepEqual([line.points, line.max, line.detail], [10, 10, 'the robot touches the bottom pad']);
  // 0.01 mm short: not touching
  b.robotAt({ x: pad.cx, y: top - ROBOT.chassisRear - 0.01, heading: 0 });
  b.tick(51);
  b.end();
  line = b.line(LINE_PARK);
  assert.deepEqual([line.points, line.detail], [0, 'the robot did not touch a finish pad at the end']);
  // the fingers count too: facing up, below the top pad, the tips of the fingers reach into it
  // first. The pad is round: at the inner edge of a finger (32 mm beside the middle) its lower
  // edge is 6.5 mm higher than in the middle.
  const t = bench();
  const up = FINISH_PADS.top;
  const tipReach = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  const inner = ROBOT.gripper.clawOpenGap / 2;
  const edgeY = up.cy + up.ry * Math.sqrt(1 - (inner / up.rx) ** 2);
  near(up.cy + up.ry - edgeY, 6.54, 0.01);
  t.robotAt({ x: up.cx, y: edgeY + tipReach - 0.01, heading: 0 });
  t.tick(1);
  assert.equal(t.line(LINE_PARK).detail, 'the robot touches the top pad');
  t.robotAt({ x: up.cx, y: edgeY + tipReach + 0.01, heading: 0 });
  t.tick(2);
  assert.equal(t.line(LINE_PARK).ok, false);
});

test('finish park: the pads are round - a corner beside the pad is not touching it', () => {
  const pad = FINISH_PADS.top;
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
  // the ellipse is wider (80.09) than high (78.57)
  assert.equal(obbTouchesEllipse({ x: pad.cx + 80.09 + 5 - 0.01, y: pad.cy, w: 10, l: 10, angle: 0 }, pad), true);
  assert.equal(obbTouchesEllipse({ x: pad.cx, y: pad.cy + 78.57 + 5 + 0.01, w: 10, l: 10, angle: 0 }, pad), false);
  assert.equal(parkedOn(robotShapesAt(ROBOT, START_POSE)), null);
});

// =============================================================================================
// Clean run, restarts, the floor at 0, 100 points
// =============================================================================================

test('clean run and restarts: +5 without a restart; each restart -10 and no bonus; never below 0', () => {
  const b = bench();
  b.robotAt({ ...START_POSE, x: 700 });
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

test('100 points: every cube picked and in its bay, the robot left the start zone and touches a pad, no restart', () => {
  const s: WarehouseSortScenario = { cubes: { W1: 'green', W2: 'red', W3: 'red', W4: 'green' } };
  const b = bench(s);
  b.begin();
  let t = 1;
  for (const w of WAREHOUSE_IDS) {
    b.hold(w, 70);
    b.tick(t++);
  }
  const red = bayPlaces('red');
  const green = bayPlaces('green');
  b.place('W2', red[0].x, red[0].y);
  b.tick(t++);
  b.place('W3', red[1].x, red[1].y);
  b.tick(t++);
  b.place('W1', green[0].x, green[0].y);
  b.tick(t++);
  b.place('W4', green[1].x, green[1].y);
  b.tick(t++);
  const pad = FINISH_PADS.top;
  b.robotAt({ x: pad.cx, y: pad.cy, heading: 0 });
  b.tick(t++);
  b.end();
  const sheet = b.score();
  assert.equal(sheet.total, 100);
  assert.equal(sheet.complete, true);
  assert.ok(sheet.lines.every((l) => l.max === 0 || l.ok));
  // tie-breaker 3: the time of the last correct delivery - W4, put in the green bay at 8 s
  const last = sheet.lines.find((l) => l.id === LINE_LAST_DELIVERY)!;
  assert.deepEqual([last.points, last.max, last.ok, last.time], [0, 0, true, 8]);
  assert.equal(last.detail, 'for a tie: 4 cubes in the right bay, the last one put there at 0:08.0');
});

test('time of the last correct delivery: the latest of the cubes that count at the end', () => {
  const b = bench();
  b.place('W1', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(10);
  b.place('W4', bayPlaces('red')[1].x, bayPlaces('red')[1].y);
  b.tick(20);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 20);
  // W4 taken out again: then W1 is the last one that counts
  b.place('W4', 900, 900);
  b.tick(25);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 10);
  // no cube in the right bay: no such line
  b.place('W1', 300, 900);
  b.tick(26);
  assert.equal(b.score().lines.find((l) => l.id === LINE_LAST_DELIVERY), undefined);
  b.place('W1', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(27);
  b.place('W1', bayPlaces('red')[0].x, bayPlaces('red')[0].y);
  b.tick(28);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 27);
  // a cube in the wrong bay does not count; a cube held in its bay does not either
  b.place('W2', bayPlaces('red')[1].x, bayPlaces('red')[1].y);
  b.tick(30);
  b.place('W3', bayMiddle('green').x, bayMiddle('green').y);
  b.hold('W3', 0);
  b.tick(31);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 27);
  // put down: from now on it counts, with the time it was let go
  b.place('W3', bayMiddle('green').x, bayMiddle('green').y);
  b.tick(32);
  assert.equal(b.line(LINE_LAST_DELIVERY).time, 32);
  assert.equal(b.line(LINE_LAST_DELIVERY).detail, 'for a tie: 2 cubes in the right bay, the last one put there at 0:32.0');
  assert.equal(clock(83.47), '1:23.4');
  assert.equal(clock(5), '0:05.0');
});

// =============================================================================================
// With the real engine
// =============================================================================================

/** From the start: 45.75 mm forward, a quarter turn left (now facing down), 362.43 mm: the claw around the W4 cube. */
const toW4: Script = function* (io) {
  yield* drive(io, 45.75);
  yield* turn(io, -90);
  yield* drive(io, 362.43);
};

test('engine: the gripper takes a cube, lifts it 70 mm and the referee counts it; the colour sensor names it', () => {
  let colourBeforeGrip = '';
  let lifted = false;
  const steps = scripted(function* (io) {
    // the arm is down, the claw open: drive the claw around the cube
    yield* toW4(io);
    colourBeforeGrip = io.frontColor();
    io.setServo('S2', 60); // close the claw (it stops on the cube)
    yield* waitUntil(() => io.servoDone('S2'));
    io.setServo('S1', 90); // arm up
    yield* waitUntil(() => io.servoDone('S1'));
    lifted = true;
    for (;;) yield;
  });
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {} }, steps.factory);
  sim.start();
  for (let i = 0; i < 2000 && !lifted; i++) sim.step(1);
  assert.ok(lifted, 'the arm went up');
  sim.step(2);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W4'))!;
  assert.equal(sim.world.robot.gripper.holding, cube.id);
  near(cube.z, 70, 1e-6, 'the cube is 70 mm above the mat (arm up: 75 mm, gripped 5 mm above its base)');
  near(sim.world.robot.gripper.gap, CUBE_SIZE, 0.5, 'the claw closed on the 40 mm cube');
  assert.equal(colourBeforeGrip, 'red', 'the colour sensor at the claw names the cube before it is gripped');
  assert.equal(sim.readSensors().frontColor, 'red', 'and while it is held');
  const sheet = sim.score();
  assert.equal(sheet.lines.find((l) => l.id === pickLineId('W4'))!.ok, true);
  assert.equal(sheet.lines.find((l) => l.id === LINE_LEAVE_START)!.ok, true);
});

test('engine: restart with a cube in the gripper - the cube back on its orange square, the others stay, -10', () => {
  let carried = false;
  const s = scripted(function* (io) {
    yield* toW4(io);
    io.setServo('S2', 60);
    yield* waitUntil(() => io.servoDone('S2'));
    io.setServo('S1', 90);
    yield* waitUntil(() => io.servoDone('S1'));
    yield* drive(io, -150);
    carried = true;
    for (;;) yield;
  });
  const sim = createEngineSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: {} }, s.factory);
  // W1's cube was moved somewhere else before (by the robot, say)
  const w1 = sim.world.bodies.find((b) => b.id === cubeBodyId('W1'))!;
  sim.start();
  w1.x = 300;
  w1.y = 300;
  for (let i = 0; i < 3000 && !carried; i++) sim.step(1);
  const cube = sim.world.bodies.find((b) => b.id === cubeBodyId('W4'))!;
  assert.equal(cube.held, true);
  assert.ok(Math.abs(cube.y - cubeHome('W4').y) > 100, 'carried away from its warehouse');
  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.equal(cube.held, false);
  assert.deepEqual({ x: cube.x, y: cube.y, z: cube.z }, { ...cubeHome('W4'), z: 0 });
  assert.deepEqual({ x: w1.x, y: w1.y }, { x: 300, y: 300 }, 'every other cube stays where it lies');
  assert.deepEqual(sim.world.robot.pose, START_POSE);
  sim.step(1);
  const sheet = sim.score();
  assert.equal(sheet.lines.find((l) => l.id === LINE_RESTARTS)!.points, -10);
  assert.equal(sheet.lines.find((l) => l.id === LINE_CLEAN)!.points, 0);
  assert.equal(sheet.lines.find((l) => l.id === pickLineId('W4'))!.points, 5, 'picked before the restart: it stays');
  assert.equal(sheet.lines.find((l) => l.id === LINE_LEAVE_START)!.points, 5);
  // as many restarts as the team wants
  sim.restart();
  sim.restart();
  assert.equal(sim.restarts, 3);
  assert.equal(sim.restartsLeft, Infinity);
});

test('engine: the colour sensor at the claw sees a cube up to 35 mm ahead of the gripping point, arm down', () => {
  const at = (ahead: number, scenario = defaultScenario()) => {
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
  assert.equal(at(0), 'red');
  assert.equal(at(35), 'red');
  assert.equal(at(35.1), 'none');
  assert.equal(at(-15), 'red', 'the cube between the fingers');
  const greenW4: WarehouseSortScenario = { cubes: { W1: 'red', W2: 'red', W3: 'red', W4: 'green' } };
  assert.equal(at(0, greenW4), 'green');
  assert.equal(at(35, greenW4), 'green');
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
  // facing right: its front (the claw, 167 mm ahead) is stopped at x = 1235 + 100
  const pose = sim.world.robot.pose;
  near(pose.heading, Math.PI / 2, 0.01);
  near(pose.x + 167, MAT_SIZE + 100, 0.6, 'the claw at the edge of the table');
});
