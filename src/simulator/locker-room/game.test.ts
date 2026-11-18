/**
 * The Locker Room referee, step by step of the rules (§5 - §8), with the edges of every line.
 *
 * Most tests put the field together by hand - a cube here, the robot there, its wheels turning or
 * not - and ask the referee directly, tick by tick: that way each edge (1 mm short of the line ...)
 * is exact. The tests at the end run the real engine: the card read by the colour sensor at the
 * claw, the gate the robot runs into, the gate that opens.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from '../core/engine';
import { obbCorners, type OBB } from '../core/geometry';
import { robotShapesAt } from '../core/robot';
import { drive, forever, scripted, sleep, type Script } from '../core/test-helpers';
import type { Body, Pose, RefereeCall, ScoreContext, ScoreLine, ScoreReport } from '../core/types';
import { BIG_CIRCLES, CARD, GATE_MARK, LOCKER_ROOM, MARKS, MARK_ROLES, SCAN_STATION, TEAM_BOX, ZONES, type MarkId, type TeamColor, type ZoneId } from './field';
import {
  BOX_LIFT_S,
  CARD_AWAY_S,
  CARD_SHOW_S,
  CUBE_FILL,
  GATE_ID,
  GATE_TOUCH_PENALTY,
  GATE_WALL,
  KIND_CUBE,
  LINE_APPROVAL,
  LINE_DELIVERY,
  LINE_GATE,
  LINE_GATE_TOUCH,
  LINE_LEAVE,
  LINE_SCAN_STATION,
  LINE_START_POSITION,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_APPROVAL,
  POINTS_DELIVERY,
  POINTS_GATE,
  POINTS_LEAVE,
  POINTS_SCAN_STATION,
  POINTS_TOKEN,
  POINTS_TOKEN_PARTLY,
  PROP_CARD,
  PROP_TEAM_BOX,
  WRONG_DELIVERY_PENALTY,
  WRONG_TOKEN_PENALTY,
  cardProp,
  clock,
  isInsideScanStation,
  isOutsideLockerRoom,
  lockerRoomGame,
  onMark,
  teamCubeHome,
  teamCubeId,
  tokenHome,
  tokenId,
  tokenLineId,
} from './game';
import { LOCKER_ROOM_ROBOT, START_POSE } from './robot';
import { decodeScenario, defaultScenario, type LockerRoomScenario } from './scenario';

const ROBOT = LOCKER_ROOM_ROBOT;
type Ctx = ScoreContext<LockerRoomScenario>;
const RIGHT = Math.PI / 2;

const arrangement = (code: string): LockerRoomScenario => {
  const s = decodeScenario(code);
  assert.ok(s, code);
  return s;
};

// =============================================================================================
// A field put together by hand
// =============================================================================================

/** A field with the real bodies and the real robot state (the engine does not run), and a referee of its own asked tick by tick. */
function bench(scenario: LockerRoomScenario = defaultScenario()) {
  const sim = createEngineSimulation({ game: lockerRoomGame, scenario, program: {} }, scripted(forever).factory);
  const world = sim.world;
  const referee = lockerRoomGame.createReferee!(scenario);
  const ctx = (): Ctx => ({ scenario, world, robotConfig: ROBOT, restarts: 0, robotShapes: robotShapesAt(ROBOT, world.robot.pose, world.robot.gripper.gap) });
  const body = (id: string): Body => {
    const found = world.bodies.find((b) => b.id === id);
    assert.ok(found, id);
    return found;
  };
  const b = {
    world,
    referee,
    body,
    /** what the referee said, and its whole call, on the last tick */
    said: [] as string[],
    call: null as RefereeCall | null,
    robotAt(pose: Pose) {
      Object.assign(world.robot.pose, pose);
    },
    /** the wheels turn (the robot moves) or stand still */
    wheels(rpm: number) {
      world.robot.left.rpm = rpm;
      world.robot.right.rpm = rpm;
    },
    /** put a body down on the mat with its middle at (x, y) */
    place(id: string, x: number, y: number, angle = 0) {
      Object.assign(body(id), { x, y, angle, z: 0, held: false, restingOn: null });
      if (world.robot.gripper.holding === id) world.robot.gripper.holding = null;
    },
    /** the gripper holds a body, its base `z` mm above the mat */
    hold(id: string, z = 0) {
      Object.assign(body(id), { z, held: true, restingOn: null });
      world.robot.gripper.holding = id;
    },
    begin() {
      referee.begin?.(ctx());
    },
    /** the referee looks at one tick (the next 1/100 s) */
    tick() {
      world.tick++;
      world.time = world.tick / 100;
      b.call = referee.observe(ctx());
      b.said = b.call?.say ?? [];
    },
    /** `n` ticks (the last one's words in `said`) */
    ticks(n: number) {
      for (let i = 0; i < n; i++) b.tick();
    },
    /** ticks until the match clock shows `seconds` */
    until(seconds: number) {
      while (world.tick < Math.round(seconds * 100)) b.tick();
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
    props: () => referee.props?.() ?? [],
  };
  return b;
}

/** The robot facing right with the back of its chassis at x = `rear` (mm), on the middle of the bottom line. */
const facingRightWithRearAt = (rear: number): Pose => ({ x: rear + ROBOT.chassisRear, y: START_POSE.y, heading: RIGHT });
/** Facing right in the middle of the Scan Station: completely inside it (15.7 mm of play front to back). */
const IN_STATION: Pose = { x: 1060, y: START_POSE.y, heading: RIGHT };
/** Far from everything that counts: in the open ground between the maze and the Scan Station. */
const AWAY: Pose = { x: 850, y: 900, heading: 0 };

/** Robot at rest in the Scan Station from the next tick on, until the box is lifted (returns the time of the lift). */
function approve(b: ReturnType<typeof bench>): number {
  b.robotAt(IN_STATION);
  b.wheels(0);
  while (b.props().some((p) => p.id === PROP_TEAM_BOX)) b.tick();
  return b.world.time;
}

// =============================================================================================
// Step 1: leave the Locker Room (+5)
// =============================================================================================

test('Step 1: +5 the first moment the WHOLE robot is outside the Locker Room - 1 mm short is not out', () => {
  const b = bench();
  b.robotAt(START_POSE);
  b.begin();
  b.tick();
  assert.equal(b.line(LINE_LEAVE).points, 0);
  const edge = LOCKER_ROOM.x + LOCKER_ROOM.w;
  b.robotAt(facingRightWithRearAt(edge - 1));
  b.ticks(5);
  assert.equal(isOutsideLockerRoom(robotShapesAt(ROBOT, b.world.robot.pose)), false);
  assert.equal(b.line(LINE_LEAVE).points, 0, '1 mm of the robot still over the frame');
  assert.match(b.line(LINE_LEAVE).detail, /^not yet/);
  b.robotAt(facingRightWithRearAt(edge));
  b.tick();
  assert.deepEqual(b.said, [`+${POINTS_LEAVE} points at 0:00.0: the robot left the Locker Room with the Team Box.`]);
  const line = b.line(LINE_LEAVE);
  assert.equal(line.points, POINTS_LEAVE);
  assert.equal(line.time, 0.07);
  assert.equal(line.detail, 'done at 0:00.0');
  // kept: back in the Locker Room changes nothing, and it is said once
  b.robotAt(START_POSE);
  b.ticks(3);
  b.robotAt(facingRightWithRearAt(edge + 50));
  b.tick();
  assert.deepEqual(b.said, []);
  assert.equal(b.line(LINE_LEAVE).points, POINTS_LEAVE);
  assert.equal(b.line(LINE_LEAVE).time, 0.07);
});

test('Step 1 "with the Team Box": the box can only be lifted in the Scan Station, which is outside the Locker Room - so Step 1 always comes first', () => {
  // A robot cannot be outside the Locker Room without its box before Step 1: the referee lifts the
  // box only in the Scan Station, and a robot there is completely outside the Locker Room. Even a
  // robot that starts in the Scan Station (a start pose handed to a test) earns Step 1 on the
  // first tick, with the box, before the box is lifted - and coming back afterwards changes nothing.
  const b = bench();
  b.robotAt(IN_STATION);
  b.tick();
  assert.deepEqual([b.line(LINE_LEAVE).points, b.line(LINE_LEAVE).time], [POINTS_LEAVE, 0.01]);
  assert.deepEqual([b.line(LINE_SCAN_STATION).points, b.line(LINE_SCAN_STATION).time], [POINTS_SCAN_STATION, 0.01]);
  approve(b);
  b.robotAt(START_POSE);
  b.ticks(3);
  b.robotAt(facingRightWithRearAt(LOCKER_ROOM.x + LOCKER_ROOM.w + 10));
  b.tick();
  assert.deepEqual(b.said, []);
  assert.equal(b.line(LINE_LEAVE).time, 0.01);
  // a robot that never left: the sheet says so at the end
  const c = bench();
  c.robotAt(START_POSE);
  c.ticks(10);
  c.end();
  assert.deepEqual([c.line(LINE_LEAVE).points, c.line(LINE_LEAVE).detail], [0, 'the whole robot never got out of the Locker Room with the Team Box']);
});

// =============================================================================================
// Step 2: reach the Scan Station (+10)
// =============================================================================================

test('Step 2: +10 the first moment the WHOLE robot is inside the Scan Station with the box - 1 mm short is not in', () => {
  const b = bench();
  b.wheels(100);
  b.robotAt(facingRightWithRearAt(SCAN_STATION.x - 1));
  b.ticks(3);
  assert.equal(isInsideScanStation(robotShapesAt(ROBOT, b.world.robot.pose)), false);
  assert.equal(b.line(LINE_SCAN_STATION).points, 0);
  b.robotAt(facingRightWithRearAt(SCAN_STATION.x));
  b.tick();
  assert.deepEqual(b.said, [`+${POINTS_SCAN_STATION} points at 0:00.0: the robot reached the Scan Station with the Team Box.`]);
  assert.equal(b.line(LINE_SCAN_STATION).points, POINTS_SCAN_STATION);
  assert.equal(b.line(LINE_SCAN_STATION).time, 0.04);
  // the front edge counts too: the claw 1 mm over the mat's edge (beyond the station) is not inside
  const front = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  assert.equal(isInsideScanStation(robotShapesAt(ROBOT, { ...IN_STATION, x: SCAN_STATION.x + SCAN_STATION.w - front + 1 })), false);
  assert.equal(isInsideScanStation(robotShapesAt(ROBOT, { ...IN_STATION, x: SCAN_STATION.x + SCAN_STATION.w - front })), true);
  // kept, and the referee does not say it again
  b.robotAt(AWAY);
  b.tick();
  b.robotAt(IN_STATION);
  b.tick();
  assert.deepEqual(b.said, []);
  assert.equal(b.line(LINE_SCAN_STATION).time, 0.04);
});

test('Step 2 "with the Team Box": the box is lifted only after the robot was completely inside - so Step 2 always comes first', () => {
  // the referee lifts the box only from a robot at rest completely inside the Scan Station, which
  // has earned Step 2 by then (on the same tick at the latest)
  const b = bench();
  b.robotAt(IN_STATION);
  const lifted = approve(b);
  assert.equal(b.line(LINE_SCAN_STATION).time, 0.01);
  assert.ok(lifted > 0.01 + BOX_LIFT_S - 1e-9);
  // leaving and coming back without the box: nothing new, nothing said
  b.robotAt(AWAY);
  b.tick();
  b.robotAt(IN_STATION);
  b.ticks(500);
  assert.deepEqual(b.said, []);
  assert.deepEqual(b.props(), []);
  assert.equal(b.line(LINE_SCAN_STATION).time, 0.01);
  assert.equal(b.line(LINE_APPROVAL).time, lifted);
});

// =============================================================================================
// Step 3: the card, the box (+15)
// =============================================================================================

test('Step 3: at rest in the Scan Station - the card is shown after 0.5 s and taken away after 2.5 s, the box lifted after 4.0 s', () => {
  assert.deepEqual([CARD_SHOW_S, CARD_AWAY_S, BOX_LIFT_S], [0.5, 2.5, 4.0]);
  const b = bench(arrangement('R3'));
  b.robotAt(START_POSE);
  b.begin();
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX], 'the box rides on the robot from the start');
  b.wheels(80);
  b.robotAt(IN_STATION);
  b.until(1);
  b.wheels(0);
  b.tick(); // 1.01 s: at rest from here
  const rest = b.world.time;
  b.until(rest + CARD_SHOW_S - 0.01);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX], 'not yet');
  assert.equal(b.line(LINE_APPROVAL).detail, `stopped - the referee shows the card after ${CARD_SHOW_S} s and lifts the Team Box after ${BOX_LIFT_S} s`);
  // (the status line above the stage says why the robot stands there: ScoreReport.now)
  assert.equal(b.score().now, 'The robot stopped in the Scan Station. The referee comes with the card.');
  b.tick();
  assert.equal(b.score().now, 'The referee shows the RED card in front of the robot.');
  assert.deepEqual(b.said, ['0:01.5: the referee shows the RED card in front of the robot.']);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX, PROP_CARD]);
  const card = b.props()[1];
  assert.equal(card.colorName, 'red');
  assert.equal(card.frame, 'robot');
  const tips = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  assert.equal(card.x - card.l / 2, tips + CARD.gapToClaw, 'its face 5 mm beyond the tips of the claw');
  assert.match(b.line(LINE_APPROVAL).detail, /holds up the RED card/);
  b.until(rest + CARD_AWAY_S - 0.01);
  assert.ok(b.props().some((p) => p.id === PROP_CARD));
  b.tick();
  assert.deepEqual(b.said, ['0:03.5: the referee takes the card away.']);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX]);
  // (the sheet says what the referee does now: the card is gone, the box is still to be lifted)
  assert.equal(b.line(LINE_APPROVAL).detail, `the referee took the card away - wait: the Team Box is lifted ${BOX_LIFT_S} s after the robot stopped`);
  assert.equal(b.score().now, 'The referee took the card away. Next the referee lifts the Team Box.');
  b.until(rest + BOX_LIFT_S - 0.01);
  assert.equal(b.line(LINE_APPROVAL).points, 0);
  b.tick();
  assert.deepEqual(b.said, ['+15 points at 0:05.0: the referee lifted the Team Box. The coach approves the team.']);
  assert.deepEqual(b.props(), [], 'the box is gone for the rest of the match');
  assert.equal(b.score().now, undefined, 'nothing to wait for any more');
  const line = b.line(LINE_APPROVAL);
  assert.equal(line.points, POINTS_APPROVAL);
  assert.equal(line.time, 5.01);
  assert.equal(line.detail, 'the referee showed the RED card at 0:01.5 and lifted the Team Box at 0:05.0');
  // nothing more happens at the station
  b.ticks(600);
  assert.deepEqual(b.props(), []);
  assert.equal(b.line(LINE_APPROVAL).time, 5.01);
});

test('Step 3: the robot moves at 3.9 s - the box stays; at the next rest it all starts again, and the box is lifted 4.0 s after it', () => {
  const b = bench();
  b.robotAt(IN_STATION);
  b.tick(); // at rest from 0.01 s
  const rest = b.world.time;
  b.until(rest + 3.9);
  b.wheels(5);
  b.tick();
  assert.deepEqual(b.said, ['0:03.9: the robot moved before the referee could lift the Team Box. Stop again in the Scan Station.']);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX]);
  b.ticks(30);
  assert.equal(b.line(LINE_APPROVAL).points, 0);
  b.wheels(0);
  b.tick();
  const again = b.world.time;
  b.until(again + CARD_SHOW_S);
  assert.deepEqual(b.said, ['0:04.7: the referee shows the GREEN card in front of the robot.']);
  b.until(again + BOX_LIFT_S - 0.01);
  assert.equal(b.line(LINE_APPROVAL).points, 0);
  b.tick();
  assert.equal(b.line(LINE_APPROVAL).points, POINTS_APPROVAL);
  near(b.line(LINE_APPROVAL).time!, again + BOX_LIFT_S, 1e-9);
});

test('Step 3: moving while the card is shown - the referee takes it away at once; leaving the station counts as moving', () => {
  const b = bench();
  b.robotAt(IN_STATION);
  b.tick();
  b.until(1);
  assert.ok(b.props().some((p) => p.id === PROP_CARD));
  b.wheels(-3);
  b.tick();
  assert.deepEqual(b.said, ['0:01.0: the robot moved, so the referee takes the card away. The Team Box stays on. Stop again in the Scan Station.']);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX]);
  // standing still but not completely inside: no card, no box
  b.wheels(0);
  b.robotAt(facingRightWithRearAt(SCAN_STATION.x - 1));
  b.ticks(600);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX]);
  assert.equal(b.line(LINE_APPROVAL).points, 0);
  b.end();
  assert.equal(b.line(LINE_APPROVAL).detail, `the robot did not stop in the Scan Station for ${BOX_LIFT_S} s with the Team Box`);
});

test('Step 3: the match ends before the box is lifted - no points', () => {
  const b = bench();
  b.robotAt(IN_STATION);
  b.tick();
  b.until(3);
  b.end();
  const line = b.line(LINE_APPROVAL);
  assert.equal(line.points, 0);
  assert.equal(line.detail, 'the robot stopped in the Scan Station, but the match ended before the referee lifted the Team Box');
});

test('Step 3: the time runs out while the card is shown - the sheet says the match ended (not "the robot did not wait"), and the card goes away', () => {
  const b = bench(arrangement('R4'));
  b.robotAt(IN_STATION);
  b.tick();
  b.until(1);
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX, PROP_CARD], 'the card is out');
  b.end();
  const line = b.line(LINE_APPROVAL);
  assert.equal(line.points, 0);
  assert.equal(line.detail, 'the robot stopped in the Scan Station, but the match ended before the referee lifted the Team Box');
  assert.deepEqual(b.props().map((p) => p.id), [PROP_TEAM_BOX], 'after STOP the referee no longer holds the card; the box is still on');
  assert.equal(b.score().now, undefined, 'the match is over: the status line says that');
});

test('Step 3: the sheet names the card of the rest that led to the lift - not the card of an earlier rest that the robot broke off', () => {
  const b = bench(arrangement('G2'));
  b.robotAt(IN_STATION);
  b.tick(); // at rest from 0.01 s: the card at 0.51 s
  b.until(3.9);
  b.wheels(5);
  b.tick(); // moved at 3.91 s
  b.ticks(30);
  b.wheels(0);
  b.tick();
  const again = b.world.time;
  b.until(again + CARD_SHOW_S);
  assert.deepEqual(b.said, [`${clock(again + CARD_SHOW_S)}: the referee shows the GREEN card in front of the robot.`]);
  b.until(again + BOX_LIFT_S);
  const line = b.line(LINE_APPROVAL);
  assert.equal(line.points, POINTS_APPROVAL);
  assert.equal(line.detail, `the referee showed the GREEN card at ${clock(again + CARD_SHOW_S)} and lifted the Team Box at ${clock(again + BOX_LIFT_S)}`);
  assert.notEqual(clock(again + CARD_SHOW_S), clock(0.51));
});

test('Step 3: the referee does not check that the program read the card (L3) - a program that never reads a sensor gets the +15 too', () => {
  // (it stands still in the Scan Station and never asks the colour sensor at the claw anything)
  const { sim } = play(forever, arrangement('R1'), IN_STATION);
  sim.start();
  while (sim.world.time < 5) sim.step(1);
  const line = sim.score().lines.find((l) => l.id === LINE_APPROVAL)!;
  assert.equal(line.points, POINTS_APPROVAL);
});

test('engine: the program ends while the referee shows the card - the stage no longer shows the card after the end', () => {
  const { sim } = play(
    function* () {
      yield* sleep(100);
    },
    arrangement('R4'),
    IN_STATION,
  );
  sim.start();
  while (sim.status !== 'finished' && sim.world.time < 10) sim.step(1);
  assert.equal(sim.finishReason, 'program-ended');
  assert.ok(sim.world.time > CARD_SHOW_S && sim.world.time < CARD_AWAY_S, `ended at ${sim.world.time} s, while the card was out`);
  assert.deepEqual((sim.world.props ?? []).map((p) => p.id), [PROP_TEAM_BOX]);
  assert.equal(sim.score().lines.find((l) => l.id === LINE_APPROVAL)!.detail, 'the robot stopped in the Scan Station, but the match ended before the referee lifted the Team Box');
});

// =============================================================================================
// Steps 5 and 6: the first delivery decides; the gate
// =============================================================================================

const circleMiddle = (color: TeamColor) => ({ x: BIG_CIRCLES[color].cx, y: BIG_CIRCLES[color].cy });

test('Step 5 and 6: the team cube completely in the circle of the team colour: +20, +5, and the gate opens', () => {
  const b = bench(arrangement('R4'));
  b.robotAt(AWAY);
  b.tick();
  const { x, y } = circleMiddle('red');
  // only partly inside: no delivery yet (its corner 1 mm over the edge of the circle)
  const r = BIG_CIRCLES.red.r;
  const half = 25 * Math.SQRT2;
  b.place(teamCubeId('red'), x + r - half + 1, y, Math.PI / 4);
  b.tick();
  assert.equal(b.line(LINE_DELIVERY).points, 0);
  b.place(teamCubeId('red'), x + r - half, y, Math.PI / 4);
  b.tick();
  assert.deepEqual(b.said, ['+20 points at 0:00.0: the RED team cube is in the RED circle.', '+5 points: the stadium gate opens.']);
  assert.deepEqual(b.call?.removeWalls, [GATE_ID]);
  assert.equal(b.line(LINE_DELIVERY).points, POINTS_DELIVERY);
  assert.equal(b.line(LINE_GATE).points, POINTS_GATE);
  assert.equal(b.line(LINE_GATE).detail, 'the gate opened at 0:00.0');
  // decided once: taking the cube out again or a wrong cube later changes nothing
  b.place(teamCubeId('red'), 900, 900);
  b.place(teamCubeId('green'), circleMiddle('green').x, circleMiddle('green').y);
  b.ticks(3);
  assert.deepEqual(b.said, []);
  assert.equal(b.line(LINE_DELIVERY).points, POINTS_DELIVERY);
  assert.equal(b.line(LINE_GATE).points, POINTS_GATE);
});

test('Step 5: a wrong first delivery: -10, the gate stays closed for good - the team cube in the other circle, or the other cube', () => {
  for (const [code, cube, circle] of [
    ['R1', 'red', 'green'],
    ['R1', 'green', 'red'],
    ['G2', 'red', 'red'],
    ['G2', 'red', 'green'],
  ] as const) {
    const b = bench(arrangement(code));
    b.robotAt(AWAY);
    b.tick(); // (+5: the robot is out of the Locker Room)
    b.place(teamCubeId(cube), circleMiddle(circle).x, circleMiddle(circle).y);
    b.tick();
    assert.equal(b.said.length, 1, `${code} ${cube} in ${circle}`);
    assert.match(b.said[0], new RegExp(`^-10 points at 0:00.0: the ${cube.toUpperCase()} team cube is in the ${circle.toUpperCase()} circle - wrong`));
    assert.equal(b.call?.removeWalls, undefined);
    assert.equal(b.line(LINE_DELIVERY).points, -WRONG_DELIVERY_PENALTY);
    assert.equal(b.line(LINE_GATE).points, 0);
    assert.equal(b.line(LINE_GATE).detail, 'the first delivery was wrong: the gate stays closed');
    // the right delivery after it changes nothing
    const team = code[0] === 'R' ? 'red' : 'green';
    b.place(teamCubeId(cube), 900, 900);
    b.place(teamCubeId(team), circleMiddle(team).x, circleMiddle(team).y);
    b.ticks(2);
    assert.equal(b.line(LINE_DELIVERY).points, -WRONG_DELIVERY_PENALTY);
    assert.equal(b.line(LINE_GATE).points, 0);
  }
});

test('Step 5: both team cubes delivered on the same tick - the cube of the team colour is looked at first, so the correct one counts', () => {
  for (const code of ['G5', 'R5']) {
    const b = bench(arrangement(code));
    b.robotAt(AWAY);
    b.tick();
    b.place(teamCubeId('red'), circleMiddle('red').x, circleMiddle('red').y);
    b.place(teamCubeId('green'), circleMiddle('green').x, circleMiddle('green').y);
    b.tick();
    assert.equal(b.line(LINE_DELIVERY).points, POINTS_DELIVERY, code);
    assert.equal(b.line(LINE_GATE).points, POINTS_GATE, code);
  }
});

test('Step 5: a cube the robot holds, a lifted cube, or a cube that touches the robot is no delivery - until it is let go and left', () => {
  const b = bench(arrangement('G1'));
  const { x, y } = circleMiddle('green');
  const id = teamCubeId('green');
  // the robot holds it in the circle, at the mat or lifted
  b.robotAt({ x, y: y + ROBOT.gripper.gripForward, heading: 0 });
  b.place(id, x, y);
  b.hold(id);
  b.tick();
  b.hold(id, 30);
  b.tick();
  assert.equal(b.line(LINE_DELIVERY).points, 0);
  // let go, the open claw still around it, 0.4 mm from a finger: touching
  b.place(id, x, y);
  b.world.robot.gripper.gap = ROBOT.gripper.clawOpenGap;
  const fingerInside = x + ROBOT.gripper.clawOpenGap / 2;
  b.place(id, fingerInside - 25 - 0.4, y);
  b.tick();
  assert.equal(b.line(LINE_DELIVERY).points, 0, 'touching a finger');
  // 0.6 mm from it: not touching any more - delivered
  b.place(id, fingerInside - 25 - 0.6, y);
  b.tick();
  assert.equal(b.line(LINE_DELIVERY).points, POINTS_DELIVERY);
});

test('Step 5: a token in a big circle counts for nothing (L6)', () => {
  const b = bench(arrangement('R5'));
  b.robotAt(AWAY);
  for (const zone of ['A', 'B', 'C'] as const) b.place(tokenId(zone), circleMiddle('red').x + (zone === 'A' ? -60 : zone === 'B' ? 0 : 60), circleMiddle('red').y);
  b.ticks(2);
  assert.equal(b.line(LINE_DELIVERY).points, 0);
  assert.equal(b.line(LINE_GATE).points, 0);
});

// =============================================================================================
// The gate penalty
// =============================================================================================

test('Gate: -10 the first time the robot touches the closed gate - once, however often; a cube pushed against it is not the robot', () => {
  const b = bench();
  const front = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  const touching = { x: GATE_MARK.x - front, y: GATE_WALL.y, heading: RIGHT };
  // the robot pushes a cube against the gate with its chassis (the claw raised over the gate):
  // the cube touches the gate, the robot touches the cube, not the gate
  b.place(tokenId('A'), GATE_MARK.x - 25, GATE_WALL.y);
  b.robotAt({ x: GATE_MARK.x - 50 - 0.2 - ROBOT.chassisFront, y: GATE_WALL.y, heading: RIGHT });
  b.world.robot.gripper.height = ROBOT.gripper.liftUpHeight;
  b.tick();
  assert.equal(b.line(LINE_GATE_TOUCH).points, 0);
  b.world.robot.gripper.height = ROBOT.gripper.liftDownHeight;
  // 0.6 mm away: not touching
  b.robotAt({ ...touching, x: touching.x - 0.6 });
  b.place(tokenId('A'), ZONES.A.x + 28, ZONES.A.y + 28);
  b.tick();
  assert.equal(b.line(LINE_GATE_TOUCH).points, 0);
  b.robotAt({ ...touching, x: touching.x - 0.4 });
  b.tick();
  assert.deepEqual(b.said, ['-10 points at 0:00.0: the robot touched the stadium gate.']);
  assert.equal(b.line(LINE_GATE_TOUCH).points, -GATE_TOUCH_PENALTY);
  b.robotAt(AWAY);
  b.ticks(5);
  b.robotAt(touching);
  b.tick();
  assert.deepEqual(b.said, [], 'the second touch: nothing more');
  assert.equal(b.line(LINE_GATE_TOUCH).points, -GATE_TOUCH_PENALTY);
  assert.equal(b.line(LINE_GATE_TOUCH).detail, 'the robot touched the closed gate at 0:00.0, -10');
  assert.equal(b.line(LINE_GATE_TOUCH).ok, false);
  // a raised claw passes over it (60 mm): only its fingers would reach, and they are above it
  const c = bench();
  c.robotAt({ ...touching, x: touching.x });
  c.world.robot.gripper.height = ROBOT.gripper.liftUpHeight;
  c.tick();
  assert.equal(c.line(LINE_GATE_TOUCH).points, 0, 'the fingers 75 mm up pass over the 60 mm gate; the chassis is 62 mm away');
});

// =============================================================================================
// Step 7: the tokens
// =============================================================================================

test('Step 7: the blue token completely inside the blue disc +10; partly inside +5; held or touching the robot at the end: 0', () => {
  const b = bench(arrangement('G5')); // BLUE in A, RED in B, GREEN in C
  b.robotAt(AWAY);
  const disc = MARKS.blueDisc.circle!;
  const blue = tokenId('A');
  // fully: its corners up to 68.13 mm from the middle: the cube's middle up to 32.77 mm away
  const reach = disc.r - 25 * Math.SQRT2;
  b.place(blue, disc.cx + reach / Math.SQRT2, disc.cy + reach / Math.SQRT2);
  b.tick();
  let line = b.line(tokenLineId('blue'));
  assert.deepEqual([line.points, line.ok, line.detail], [POINTS_TOKEN, true, 'completely inside the blue disc in the maze']);
  // 1 mm further: partly
  b.place(blue, disc.cx + (reach + 1) / Math.SQRT2, disc.cy + (reach + 1) / Math.SQRT2);
  b.tick();
  line = b.line(tokenLineId('blue'));
  assert.deepEqual([line.points, line.ok, line.detail], [POINTS_TOKEN_PARTLY, false, 'only partly inside the blue disc in the maze: half points']);
  // its edge only touching the disc: nothing
  b.place(blue, disc.cx + disc.r + 25, disc.cy);
  b.tick();
  assert.equal(b.line(tokenLineId('blue')).points, 0);
  // held over the disc at the end
  b.place(blue, disc.cx, disc.cy);
  b.robotAt({ x: disc.cx, y: disc.cy + ROBOT.gripper.gripForward, heading: 0 });
  b.hold(blue, 10);
  b.end();
  line = b.line(tokenLineId('blue'));
  assert.deepEqual([line.points, line.detail], [0, 'the robot still held it - put it down in the blue disc in the maze']);
  // let go, but the claw still touches it at the end
  const c = bench(arrangement('G5'));
  c.place(blue, disc.cx, disc.cy);
  c.robotAt({ x: disc.cx, y: disc.cy + ROBOT.gripper.gripForward, heading: 0 });
  c.world.robot.gripper.gap = 50;
  c.end();
  line = c.line(tokenLineId('blue'));
  assert.deepEqual([line.points, line.detail], [0, 'touching the robot']);
});

test('Step 7: the red and green tokens on their 41.9 mm squares can only be PARTLY inside (the cube is 50 mm): +5', () => {
  const b = bench(arrangement('G5'));
  b.robotAt(AWAY);
  const red = MARKS.redSquare.box as OBB;
  const green = MARKS.greenSquare.box as OBB;
  b.place(tokenId('B'), red.x, red.y); // the red token, centred on its square
  b.place(tokenId('C'), green.x, green.y);
  b.tick();
  for (const color of ['red', 'green'] as const) {
    const line = b.line(tokenLineId(color));
    // (+5 is the most a token can get on these squares: the line counts it as done and says why)
    assert.deepEqual([line.points, line.ok], [POINTS_TOKEN_PARTLY, true], color);
    assert.equal(line.detail, `partly inside the ${color} square in the maze: 5 points, the most here (a cube is bigger than this target)`);
  }
  // on the blue disc a whole cube fits: there partly inside is half points, not done
  b.place(tokenId('A'), MARKS.blueDisc.circle!.cx + MARKS.blueDisc.circle!.r, MARKS.blueDisc.circle!.cy);
  b.tick();
  const blue = b.line(tokenLineId('blue'));
  assert.deepEqual([blue.points, blue.ok, blue.detail], [POINTS_TOKEN_PARTLY, false, 'only partly inside the blue disc in the maze: half points']);
  // onMark itself: a smaller cube would be completely inside
  assert.equal(onMark({ x: red.x, y: red.y, w: 40, l: 40, angle: 0 }, MARKS.redSquare), 'full');
  assert.equal(onMark({ x: red.x, y: red.y, w: 50, l: 50, angle: 0 }, MARKS.redSquare), 'part');
  assert.equal(onMark({ x: red.x + 45.95, y: red.y, w: 50, l: 50, angle: 0 }, MARKS.redSquare), null, 'edges touching only');
  assert.equal(onMark({ x: red.x + 45.9, y: red.y, w: 50, l: 50, angle: 0 }, MARKS.redSquare), 'part');
});

test('Step 7: a token partly inside a target of ANOTHER colour: -10 (wrong); its own target wins when it touches both', () => {
  const b = bench(arrangement('G5'));
  b.robotAt(AWAY);
  const red = MARKS.redSquare.box as OBB;
  // the green token: a corner on the red square
  b.place(tokenId('C'), red.x + 45, red.y + 45);
  b.tick();
  let line = b.line(tokenLineId('green'));
  assert.deepEqual([line.points, line.detail], [-WRONG_TOKEN_PENALTY, 'in the red square in the maze - wrong target, -10']);
  // the blue token completely in the blue disc and the red token on the disc too: red is wrong
  const disc = MARKS.blueDisc.circle!;
  b.place(tokenId('B'), disc.cx, disc.cy);
  b.tick();
  line = b.line(tokenLineId('red'));
  assert.equal(line.points, -WRONG_TOKEN_PENALTY);
  // a token that lies on its own square and on the disc counts for its own (part) - not as wrong
  const between = (MARKS.redSquare.box as OBB).y + 40;
  b.place(tokenId('B'), red.x, between);
  b.tick();
  assert.ok(onMark({ x: red.x, y: between, w: 50, l: 50, angle: 0 }, MARKS.blueDisc) !== null);
  assert.equal(b.line(tokenLineId('red')).points, POINTS_TOKEN_PARTLY);
});

test('Step 7: a team cube on a maze target counts for nothing (L6); tokens where they started: 0', () => {
  const b = bench(arrangement('R1'));
  b.robotAt(AWAY);
  b.place(teamCubeId('red'), (MARKS.redSquare.box as OBB).x, (MARKS.redSquare.box as OBB).y);
  b.place(teamCubeId('green'), MARKS.blueDisc.circle!.cx, MARKS.blueDisc.circle!.cy);
  b.tick();
  for (const color of ['red', 'green', 'blue'] as const) assert.equal(b.line(tokenLineId(color)).points, 0, color);
  assert.equal(b.score().total, POINTS_LEAVE, 'only Step 1 (the robot is out of the Locker Room)');
  b.end();
  assert.equal(b.line(tokenLineId('red')).detail, 'not in a target');
});

// =============================================================================================
// The whole sheet
// =============================================================================================

test('the sheet: 85 at most (5 + 10 + 15 + 20 + 5 + 3 x 10); with this table of marks 75 is the most a robot can get', () => {
  assert.equal(MAX_SCORE, 85);
  assert.equal(MATCH_DURATION, 150);
  const b = bench(arrangement('G5'));
  const report = b.score();
  assert.equal(report.max, 85);
  assert.equal(report.lines.reduce((sum, l) => sum + l.max, 0), 85);
  assert.deepEqual(report.lines.map((l) => l.id), [LINE_LEAVE, LINE_SCAN_STATION, LINE_APPROVAL, LINE_DELIVERY, LINE_GATE, LINE_GATE_TOUCH, tokenLineId('red'), tokenLineId('green'), tokenLineId('blue')]);
  // everything that can be done: out, station, box, the green cube, the tokens on their targets
  b.robotAt(START_POSE);
  b.begin();
  b.robotAt(facingRightWithRearAt(LOCKER_ROOM.x + LOCKER_ROOM.w + 10));
  b.tick();
  approve(b);
  b.robotAt(AWAY);
  b.place(teamCubeId('green'), circleMiddle('green').x, circleMiddle('green').y);
  b.place(tokenId('A'), MARKS.blueDisc.circle!.cx, MARKS.blueDisc.circle!.cy);
  b.place(tokenId('B'), (MARKS.redSquare.box as OBB).x, (MARKS.redSquare.box as OBB).y);
  b.place(tokenId('C'), (MARKS.greenSquare.box as OBB).x, (MARKS.greenSquare.box as OBB).y);
  b.tick();
  b.end();
  const final = b.score();
  assert.equal(final.total, 5 + 10 + 15 + 20 + 5 + 10 + 5 + 5);
  // (75: the most a robot can do with these marks - every line done, so the run is complete)
  assert.equal(final.complete, true, 'the red and the green token can only be partly inside: +5 is done there');
  assert.ok(final.lines.every((l) => l.ok));
});

test('the sheet: the total is never below 0 (L9)', () => {
  const b = bench(arrangement('R2')); // RED in A, BLUE in B, GREEN in C
  b.robotAt(AWAY);
  b.place(teamCubeId('green'), circleMiddle('red').x, circleMiddle('red').y); // -10
  b.tick();
  b.place(tokenId('C'), (MARKS.redSquare.box as OBB).x, (MARKS.redSquare.box as OBB).y); // the green token on red: -10
  const front = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  b.robotAt({ x: GATE_MARK.x - front, y: GATE_WALL.y, heading: RIGHT }); // -10
  b.tick();
  const report = b.score();
  assert.equal(report.lines.reduce((sum, l) => sum + l.points, 0), POINTS_LEAVE - 30);
  assert.equal(report.total, 0);
});

test('the sheet: a robot that did not start inside the Locker Room gets a line that says so', () => {
  const b = bench();
  b.robotAt({ ...START_POSE, x: START_POSE.x + 20 });
  b.begin();
  b.tick();
  const line = b.line(LINE_START_POSITION);
  assert.deepEqual([line.points, line.ok], [0, false]);
  const c = bench();
  c.robotAt(START_POSE);
  c.begin();
  c.tick();
  assert.equal(c.score().lines.some((l) => l.id === LINE_START_POSITION), false);
});

test('clock: match time as the referee writes it', () => {
  assert.equal(clock(0), '0:00.0');
  assert.equal(clock(83.42), '1:23.4');
  assert.equal(clock(149.99), '2:29.9');
});

// =============================================================================================
// The game: bodies, walls, zones, no restarts
// =============================================================================================

test('the field at the start: the team cubes on their pickup zones, a token in the middle of each zone picture, the gate closed', () => {
  for (const code of ['R1', 'G5', 'R6']) {
    const s = arrangement(code);
    const bodies = lockerRoomGame.createBodies(s);
    assert.deepEqual(bodies.map((b) => b.id), ['cube:team-red', 'cube:team-green', 'token:A', 'token:B', 'token:C']);
    for (const b of bodies) {
      assert.equal(b.kind, KIND_CUBE);
      assert.deepEqual([b.w, b.l, b.h, b.z], [50, 50, 70, 0]);
      assert.equal(b.grippable, true);
      assert.equal(b.fill, CUBE_FILL[b.colorName as 'red']);
    }
    for (const color of ['red', 'green'] as const) {
      const cube = bodies.find((b) => b.id === teamCubeId(color))!;
      assert.equal(cube.colorName, color);
      const home = teamCubeHome(color);
      assert.deepEqual([cube.x, cube.y, cube.angle], [home.x, home.y, home.angle]);
      // completely inside its turned rectangle, turned with it
      assert.equal(onMark({ x: cube.x, y: cube.y, w: 50, l: 50, angle: cube.angle }, MARKS[color === 'red' ? 'redDiamond' : 'greenDiamond']), 'full');
    }
    for (const zone of ['A', 'B', 'C'] as ZoneId[]) {
      const token = bodies.find((b) => b.id === tokenId(zone))!;
      assert.deepEqual([token.x, token.y], [tokenHome(zone).x, tokenHome(zone).y]);
      const r = ZONES[zone];
      assert.ok(obbCorners({ x: token.x, y: token.y, w: 50, l: 50, angle: 0 }).every((p) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h));
    }
  }
  assert.equal(lockerRoomGame.createBodies(arrangement('G5')).find((b) => b.id === 'token:A')!.colorName, 'blue');
  assert.deepEqual(lockerRoomGame.createWalls!(defaultScenario()), [GATE_WALL]);
  assert.deepEqual([GATE_WALL.w, GATE_WALL.l, GATE_WALL.h], [GATE_MARK.w, GATE_MARK.h, 60]);
  // no restarts; the box rides on top of the chassis
  assert.deepEqual(lockerRoomGame.restartRules, { maxRestarts: 0 });
  assert.equal(lockerRoomGame.restartPenalty, 0);
  assert.equal(lockerRoomGame.startZone, LOCKER_ROOM);
  const box = lockerRoomGame.createReferee!(defaultScenario()).props!()[0];
  assert.deepEqual([box.frame, box.x, box.w, box.l, box.z, box.h, box.colorName], ['robot', TEAM_BOX.forward, 90, 110, ROBOT.chassisHeight, 80, undefined]);
});

test('the zones of the screen: the Locker Room, the Scan Station, the turned pickup zones by their outline, the circles, the zones, the targets, the gate', () => {
  const zones = lockerRoomGame.overlays(arrangement('G5'));
  assert.deepEqual(zones.map((z) => z.id), ['start', 'scan', 'pickup:red', 'circle:red', 'pickup:green', 'circle:green', 'zone:A', 'zone:B', 'zone:C', 'target:red', 'target:green', 'target:blue', 'gate']);
  const of = (id: string) => zones.find((z) => z.id === id)!;
  assert.equal(of('pickup:green').label, 'Green pickup zone (your team)');
  assert.equal(of('pickup:red').label, 'Red pickup zone');
  assert.equal(of('pickup:red').outline?.length, 4);
  assert.equal(of('target:red').outline, undefined, 'a square that is not turned: its rect');
  assert.equal(of('target:blue').shape, 'ellipse');
  assert.equal(of('circle:green').shape, 'ellipse');
  assert.equal(of('zone:A').label, 'Zone A: BLUE');
  assert.equal(of('start').rect, LOCKER_ROOM);
});

test('the one table of the marks (MARK_ROLES): swapping it moves the team cubes and the targets, nothing else to change', () => {
  // the other reading of the rules v2.3: the team cubes start on the small squares in the maze, the
  // tokens go to the three rectangles at the top (red, light blue, green)
  const roles = MARK_ROLES as { pickup: Record<TeamColor, MarkId>; target: Record<'red' | 'green' | 'blue', MarkId> };
  const before = { pickup: { ...roles.pickup }, target: { ...roles.target } };
  try {
    roles.pickup = { red: 'redSquare', green: 'greenSquare' };
    roles.target = { red: 'redDiamond', green: 'greenDiamond', blue: 'cyanRect' };
    const bodies = lockerRoomGame.createBodies(arrangement('R2'));
    const red = bodies.find((x) => x.id === teamCubeId('red'))!;
    assert.deepEqual([red.x, red.y, red.angle], [(MARKS.redSquare.box as OBB).x, (MARKS.redSquare.box as OBB).y, 0]);
    const zones = lockerRoomGame.overlays(arrangement('R2'));
    near(zones.find((z) => z.id === 'target:blue')!.rect.w, 104.76, 1e-9);
    assert.equal(zones.find((z) => z.id === 'target:red')!.outline?.length, 4);
    // now a token CAN be completely inside its target: the red one turned with its rectangle, the blue one as it is
    const b = bench(arrangement('R2')); // RED in A, BLUE in B, GREEN in C
    b.robotAt(AWAY);
    const diamond = MARKS.redDiamond.box as OBB;
    b.place(tokenId('A'), diamond.x, diamond.y, diamond.angle);
    b.place(tokenId('B'), (MARKS.cyanRect.box as OBB).x, (MARKS.cyanRect.box as OBB).y);
    b.place(tokenId('C'), MARKS.blueDisc.circle!.cx, MARKS.blueDisc.circle!.cy);
    b.tick();
    assert.equal(b.line(tokenLineId('red')).points, POINTS_TOKEN);
    assert.equal(b.line(tokenLineId('blue')).points, POINTS_TOKEN);
    assert.equal(b.line(tokenLineId('green')).points, 0, 'the blue disc is no target any more');
    assert.equal(b.line(tokenLineId('red')).detail, 'completely inside the red rectangle at the top left');
  } finally {
    roles.pickup = before.pickup;
    roles.target = before.target;
  }
  assert.equal(lockerRoomGame.createBodies(arrangement('R2')).find((x) => x.id === teamCubeId('red'))!.x, (MARKS.redDiamond.box as OBB).x);
});

// =============================================================================================
// With the engine
// =============================================================================================

function play(script: Script, scenario: LockerRoomScenario, startPose: Pose) {
  const harness = scripted(script);
  const sim = createEngineSimulation({ game: lockerRoomGame, scenario, program: {}, startPose }, harness.factory);
  return { sim, io: () => harness.io() };
}

test('engine: the colour sensor at the claw reads the card while the referee shows it - arm down and arm up - and "none" before and after', () => {
  for (const up of [false, true]) {
    const reads: Array<[number, string]> = [];
    const { sim } = play(
      function* (io) {
        if (up) io.setServo(ROBOT.gripper.liftServo, ROBOT.gripper.liftUpAngle);
        for (;;) {
          reads.push([sim.world.tick, io.frontColor()]);
          yield;
        }
      },
      arrangement('R6'),
      IN_STATION,
    );
    sim.start();
    sim.step(450);
    // (at rest from the first tick, 0.01 s - also with the arm moving: the wheels stand still)
    const red = reads.filter(([, c]) => c === 'red').map(([t]) => t);
    // (the referee looks after the tick that brings the clock to 0.51 s; the program reads on the next one)
    assert.equal(red[0], 51, `${up}: shown at 0.51 s`);
    assert.equal(red[red.length - 1], 250, `${up}: taken away at 2.51 s`);
    assert.equal(red.length, 200);
    assert.ok(reads.filter(([, c]) => c !== 'red').every(([, c]) => c === 'none'));
    assert.equal(sim.score().lines.find((l) => l.id === LINE_APPROVAL)!.points, POINTS_APPROVAL);
    assert.deepEqual(sim.world.props, []);
  }
});

test('engine: the card prop is in reach of the colour sensor for the robot the referee sees', () => {
  const card = cardProp('green', ROBOT);
  const g = ROBOT.gripper;
  assert.ok(card.x - card.l / 2 - (g.gripForward - g.fingerLength / 2) <= g.fingerLength / 2 + ROBOT.frontColorSensor.rangeMm);
  // a robot without a gripper: in front of its chassis
  const bare = { ...ROBOT, gripper: { ...g, enabled: false } };
  assert.equal(cardProp('green', bare).x - CARD.thickness / 2, bare.chassisFront + CARD.gapToClaw);
});

test('engine: the robot that drives into the closed gate is stopped by it and loses 10, once', () => {
  const front = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  const { sim } = play(
    function* (io) {
      yield* drive(io, 100, 60);
      yield* drive(io, -50, 60);
      yield* drive(io, 100, 60);
      yield* forever();
    },
    defaultScenario(),
    { x: GATE_MARK.x - front - 40, y: GATE_WALL.y, heading: RIGHT },
  );
  sim.start();
  sim.step(800);
  const pose = sim.world.robot.pose;
  near(pose.x + front, GATE_MARK.x, 0.05, 'stopped at the gate');
  assert.equal(sim.score().lines.find((l) => l.id === LINE_GATE_TOUCH)!.points, -GATE_TOUCH_PENALTY);
  const said = sim.drainEvents().filter((e) => e.type === 'log' && /gate/.test(e.text));
  assert.equal(said.length, 1);
  assert.equal(sim.world.walls?.length, 1);
});

test('engine: a correct delivery opens the gate - it is gone from the field, and the robot drives through where it stood', () => {
  const front = ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2;
  const { sim } = play(
    function* (io) {
      yield* sleep(2);
      yield* drive(io, 250, 60);
      yield* forever();
    },
    arrangement('G3'),
    { x: GATE_MARK.x - front - 40, y: GATE_WALL.y, heading: RIGHT },
  );
  // (put by hand: the GREEN team cube in the middle of the green circle)
  const cube = sim.world.bodies.find((b) => b.id === teamCubeId('green'))!;
  Object.assign(cube, { x: BIG_CIRCLES.green.cx, y: BIG_CIRCLES.green.cy, angle: 0 });
  const walls = sim.world.walls;
  sim.start();
  sim.step(1);
  assert.equal(sim.score().lines.find((l) => l.id === LINE_DELIVERY)!.points, POINTS_DELIVERY);
  assert.notEqual(sim.world.walls, walls);
  assert.deepEqual(sim.world.walls, []);
  sim.step(500);
  near(sim.world.robot.pose.x, GATE_MARK.x - front - 40 + 250, 0.5, 'through the place of the gate');
  assert.equal(sim.score().lines.find((l) => l.id === LINE_GATE_TOUCH)!.points, 0);
  assert.equal(sim.score().lines.find((l) => l.id === LINE_GATE)!.points, POINTS_GATE);
});

const near = (actual: number, expected: number, eps: number, what = 'value') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: ${actual} is not within ${eps} of ${expected}`);
