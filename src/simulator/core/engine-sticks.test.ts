/**
 * Fixed sticks (GripperConfig.fixedSticks, core/types.ts): the two fingers are two sticks that
 * never move (Fire Cadet: the mTiny with its two pushing sticks). An element that stands between
 * them goes round with the robot when it turns; Forward pushes it, Backward leaves it.
 *
 * The robot here is the mTiny of the Fire Cadet design (section 3.1): a box 114 x 106.5 mm that
 * turns around its middle, sticks 30 mm long and 8 mm thick on the two front corners (90.5 mm
 * apart), wheels 40 mm, track 74 mm. Its moves are the cards of the design: one square of 178 mm
 * in 1.6 s, a quarter turn in 1.3 s, with 0.2 s to speed up and to brake. (The game's own files
 * hold those numbers once it exists; the measured results below come from the design's probes,
 * P = design/probes: p1-push.out.)
 *
 * What a robot WITHOUT fixed sticks does is unchanged: the four older games are proved byte for
 * byte the same outside this file (the baseline of design 9.8).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation } from './engine';
import { wrapAngle } from './geometry';
import { DEFAULT_ROBOT_CONFIG, wheelDegreesForDistance, wheelDegreesForTurn } from './robot';
import { forever, makeBody, near, scripted, sleep, waitUntil } from './test-helpers';
import type { RobotIO } from './io';
import type { Body, FixedWall, Game, MatVector, Pose, RobotConfig, Simulation } from './types';

// =============================================================================================
// The robot, the field, the cards
// =============================================================================================

/** One Forward card: one square of the Fire City map (mm). */
const STEP = 178;
/** The times of one card (s): a move, a quarter turn, and the speeding up / braking inside them. */
const MOVE_SECONDS = 1.6;
const TURN_SECONDS = 1.3;
const RAMP_SECONDS = 0.2;
const WHEEL = 40;
/** top speed of a move: speed up, cruise, brake - 178 mm in 1.6 s */
const MAX_RPM = (STEP / (MOVE_SECONDS - RAMP_SECONDS) / (Math.PI * WHEEL)) * 60;

const MTINY: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  chassisFront: 57,
  chassisRear: 57,
  chassisWidth: 106.5,
  chassisHeight: 98,
  wheelDiameter: WHEEL,
  trackWidth: 74,
  maxRpm: MAX_RPM,
  rpmPerSecond: MAX_RPM / RAMP_SECONDS,
  frontColorSensor: { enabled: false, rangeMm: 0 },
  gripper: {
    ...DEFAULT_ROBOT_CONFIG.gripper,
    enabled: true,
    fixedSticks: true,
    liftDownHeight: 5,
    liftUpHeight: 5,
    clawOpenGap: 90.5,
    clawClosedGap: 90.5,
    gripForward: 57 + 30 / 2,
    fingerLength: 30,
    fingerThickness: 8,
    fingerHeight: 20,
  },
  noise: { wheelSlip: 0, sensor: 0, ultrasonicCm: 0 },
};

/** The same robot with the field left out, as every robot before the mTiny. */
const withoutFlag = (cfg: RobotConfig): RobotConfig => {
  const { fixedSticks: _left, ...gripper } = cfg.gripper;
  void _left;
  return { ...cfg, gripper };
};

/** How far ahead of the turning point an element between the sticks rests: the front of the body + half an element. */
const HELD_AHEAD = 57 + 40 / 2;

const MAT: MatVector = { width: 1250, height: 1250, background: { r: 255, g: 255, b: 255 }, outside: { r: 40, g: 40, b: 40 }, layers: [] };

/** The middle of square (column, row) of the Fire City map, on the 178 mm lattice of the design (N1). */
const spot = (column: number, row: number) => ({ x: 90.764 + STEP * column, y: 90.764 + STEP * row });
/** The bottom Fire Station, D7, looking up the map. */
const START: Pose = { ...spot(3, 6), heading: 0 };

function makeGame(bodies: Body[], walls: FixedWall[] = []): Game<null> {
  const game: Game<null> = {
    id: 'sticks-test',
    title: 'Sticks test',
    mat: { width: 1250, height: 1250, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 120,
    startZone: { x: 0, y: 0, w: 1250, h: 1250 },
    defaultStartPose: START,
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
  if (walls.length > 0) game.createWalls = () => walls.map((w) => ({ ...w }));
  return game;
}

/** The wheel speed of a quarter turn that speeds up, turns and brakes in TURN_SECONDS (T = s / v + v / a). */
function turnRpm(cfg: RobotConfig): number {
  const arc = (Math.PI / 2) * (cfg.trackWidth / 2);
  const accel = (cfg.rpmPerSecond / 60) * Math.PI * cfg.wheelDiameter;
  const speed = (accel * TURN_SECONDS - Math.sqrt(accel * accel * TURN_SECONDS * TURN_SECONDS - 4 * accel * arc)) / 2;
  return (speed / (Math.PI * cfg.wheelDiameter)) * 60;
}

/** A row of cards: F (one square forward), B (one back), L / R (a quarter turn), with a rest between them. */
function* cards(io: RobotIO, row: string): Generator<void, void, void> {
  for (const card of row) {
    const cfg = io.config;
    if (card === 'F' || card === 'B') {
      const deg = wheelDegreesForDistance(cfg, card === 'F' ? STEP : -STEP);
      io.startMotion(deg, deg, cfg.maxRpm);
    } else {
      const deg = wheelDegreesForTurn(cfg, card === 'R' ? 90 : -90);
      io.startMotion(deg, -deg, turnRpm(cfg));
    }
    yield* waitUntil(() => io.motionDone());
    yield* sleep(40);
  }
}

function play(row: string, bodies: Body[], o: { cfg?: RobotConfig; walls?: FixedWall[] } = {}): Simulation<null> {
  const harness = scripted(function* (io) {
    yield* cards(io, row);
    yield* forever();
  });
  const sim = createEngineSimulation({ game: makeGame(bodies, o.walls), scenario: null, program: {}, robotConfig: o.cfg ?? MTINY, startPose: START }, harness.factory);
  sim.start();
  sim.step(row.length * 200 + 100);
  return sim;
}

/** Where an element stands as the robot sees it: [ahead of the turning point, to the right, its own angle against the robot's in degrees]. */
function inRobotFrame(sim: Simulation<null>, id: string): [number, number, number] {
  const b = sim.world.bodies.find((x) => x.id === id);
  assert.ok(b, id);
  const p = sim.world.robot.pose;
  const dx = b.x - p.x;
  const dy = b.y - p.y;
  const s = Math.sin(p.heading);
  const c = Math.cos(p.heading);
  const turned = (wrapAngle(b.angle - p.heading) * 180) / Math.PI;
  return [dx * s - dy * c, dx * c + dy * s, turned];
}

/** Where the cards should take the robot (each card is exact: no slip, no noise). */
function expectedPose(row: string): Pose {
  let { x, y, heading } = START;
  for (const card of row) {
    if (card === 'R') heading += Math.PI / 2;
    else if (card === 'L') heading -= Math.PI / 2;
    else {
      const d = card === 'F' ? STEP : -STEP;
      x += d * Math.sin(heading);
      y -= d * Math.cos(heading);
    }
  }
  return { x, y, heading };
}

const cat = (): Body => makeBody({ id: 'cat', kind: 'cat', ...spot(3, 4), w: 40, l: 40, h: 50 });

// =============================================================================================
// The swing
// =============================================================================================

test('swing: an element between the sticks stays 77 mm ahead in the middle after every turn, and turns with the robot (P/p1-push.out 2, 3)', () => {
  // FF brings the cat (two squares ahead) between the sticks; then turns, U-turns, four turns, turn-forward-turn-forward
  const rows = ['FFR', 'FFRF', 'FFRFF', 'FFL', 'FFLF', 'FFLFF', 'FFRR', 'FFLL', 'FFRL', 'FFLR', 'FFRRRR', 'FFRRF', 'FFLLF', 'FFRLF', 'FFLRF', 'FFRFLF', 'FFRFRF', 'FFLFRFLF'];
  assert.equal(rows.length, 18);
  for (const row of rows) {
    const sim = play(row, [cat()]);
    const [ahead, right, turned] = inRobotFrame(sim, 'cat');
    near(ahead, HELD_AHEAD, 0.01, `${row}: ahead`);
    near(right, 0, 0.01, `${row}: to the side`);
    near(turned, 0, 1e-6, `${row}: the cat turned with the robot`);
    const want = expectedPose(row);
    const p = sim.world.robot.pose;
    near(p.x, want.x, 0.01, `${row}: robot x`);
    near(p.y, want.y, 0.01, `${row}: robot y`);
    near(Math.cos(p.heading - want.heading), 1, 1e-9, `${row}: robot heading`);
  }
});

test('no swing without the field: the same robot loses the element in one turn, 86.8 mm beside it (P/p1-push.out, FC_NO_SWING=1)', () => {
  const sim = play('FFR', [cat()], { cfg: withoutFlag(MTINY) });
  const [ahead, right, turned] = inRobotFrame(sim, 'cat');
  near(ahead, 96.455, 0.01, 'ahead');
  near(right, -86.754, 0.01, 'to the left of the robot');
  near(turned, -90, 1e-6, 'the cat did not turn');
  // and with the sticks, the very same row keeps it
  near(inRobotFrame(play('FFR', [cat()]), 'cat')[1], 0, 0.01);
});

test('what is not swung: an element only partly between the sticks, above or below them, ahead of their tips, behind the front of the body', () => {
  // The robot turns by 2 degrees on the spot. An element that is swung turns by exactly the robot's
  // angle; one that is not keeps its own angle (a push never turns an element). Each pair is the
  // last place that is swung and the first that is not.
  const ROBOT: Pose = { x: 500, y: 600, heading: 0 };
  const LOW = { ...MTINY, chassisHeight: 4 }; // a body lower than the element: it can stand over the front of the body
  const turnOf = (cfg: RobotConfig, ahead: number, right: number, part: Partial<Body> = {}): number => {
    const element = makeBody({ id: 'e', x: ROBOT.x + right, y: ROBOT.y - ahead, w: 40, l: 40, h: 50, ...part });
    const harness = scripted(function* (io) {
      const deg = wheelDegreesForTurn(io.config, 2);
      io.startMotion(deg, -deg, 10);
      yield* waitUntil(() => io.motionDone());
      yield* forever();
    });
    const sim = createEngineSimulation({ game: makeGame([element]), scenario: null, program: {}, robotConfig: cfg, startPose: ROBOT }, harness.factory);
    sim.start();
    sim.step(200);
    near((sim.world.robot.pose.heading * 180) / Math.PI, 2, 1e-9, 'the robot turned 2 degrees');
    return (sim.world.bodies[0].angle * 180) / Math.PI;
  };
  const swung = (angle: number, what: string) => near(angle, 2, 1e-9, `${what}: swung`);
  const kept = (angle: number, what: string) => assert.equal(angle, 0, `${what}: not swung`);

  swung(turnOf(MTINY, HELD_AHEAD, 0), 'in the middle');
  // between the inner faces (45.25 mm from the middle), with the engine's 1 mm of play
  swung(turnOf(MTINY, HELD_AHEAD, 26), 'its side 0.75 mm into a stick');
  kept(turnOf(MTINY, HELD_AHEAD, 60), 'across a stick, most of it outside');
  kept(turnOf(MTINY, HELD_AHEAD, -60), 'the same on the left');
  // the sticks are 5 to 25 mm above the mat
  swung(turnOf(MTINY, HELD_AHEAD, 0, { z: 24 }), 'its base 1 mm below the top of the sticks');
  kept(turnOf(MTINY, HELD_AHEAD, 0, { z: 24.5 }), 'above the sticks');
  swung(turnOf(MTINY, HELD_AHEAD, 0, { h: 6 }), 'its top 1 mm above the bottom of the sticks');
  kept(turnOf(MTINY, HELD_AHEAD, 0, { h: 5.5 }), 'below the sticks');
  // the tips are 57 + 30 = 87 mm ahead of the turning point
  swung(turnOf(MTINY, 86, 0), 'its middle 1 mm behind the tips');
  kept(turnOf(MTINY, 87.5, 0), 'its middle ahead of the tips');
  // the front of the body is 57 mm ahead
  swung(turnOf(LOW, 57.5, 0, { z: 4.5, h: 30 }), 'its middle just ahead of the front of the body');
  kept(turnOf(LOW, 57, 0, { z: 4.5, h: 30 }), 'its middle at the front of the body');
  kept(turnOf(LOW, 50, 0, { z: 4.5, h: 30 }), 'its middle over the body');
  // the field does nothing without it, or on a robot without fingers
  kept(turnOf(withoutFlag(MTINY), HELD_AHEAD, 0), 'no fixedSticks');
  kept(turnOf({ ...MTINY, gripper: { ...MTINY.gripper, enabled: false } }, HELD_AHEAD, 0), 'fixedSticks on a robot without a gripper');
});

test('Backward leaves the element where it is (P/p1-push.out 4: 255 mm ahead after one Backward)', () => {
  const pushed = play('FF', [cat()]).world.bodies[0];
  const sim = play('FFB', [cat()]);
  const [ahead, right] = inRobotFrame(sim, 'cat');
  near(ahead, HELD_AHEAD + STEP, 0.01, 'ahead');
  near(right, 0, 0.01, 'to the side');
  const left = sim.world.bodies[0];
  assert.deepEqual([left.x, left.y, left.angle], [pushed.x, pushed.y, pushed.angle], 'not moved by the Backward card');
});

// =============================================================================================
// Fixed things: the edge of the table and fixed walls
// =============================================================================================

test('an element between the sticks pressed against the edge of the table: a turn swings it along the edge, nothing goes past the edge, the robot gives way', () => {
  const element = makeBody({ id: 'item', x: START.x, y: START.y - HELD_AHEAD, w: 40, l: 40, h: 50 });
  let beforeTurn: Pose | null = null;
  let worstPastEdge = -Infinity;
  const harness = scripted(function* (io) {
    // straight up the map until the element stands against the edge of the table, 100 mm outside the mat
    const deg = wheelDegreesForDistance(io.config, 2000);
    io.startMotion(deg, deg, io.config.maxRpm);
    yield* waitUntil(() => io.motionDone());
    const p = sim.world.robot.pose;
    beforeTurn = { x: p.x, y: p.y, heading: p.heading };
    const quarter = wheelDegreesForTurn(io.config, 90);
    io.startMotion(quarter, -quarter, turnRpm(io.config));
    yield* waitUntil(() => io.motionDone());
    yield* forever();
  });
  const sim = createEngineSimulation({ game: makeGame([element]), scenario: null, program: {}, robotConfig: MTINY, startPose: START }, harness.factory);
  sim.start();
  for (let k = 0; k < 2000; k++) {
    sim.step(1);
    const b = sim.world.bodies[0];
    const halfY = (Math.abs(b.w * Math.sin(b.angle)) + Math.abs(b.l * Math.cos(b.angle))) / 2;
    worstPastEdge = Math.max(worstPastEdge, -100 - (b.y - halfY));
  }
  assert.ok(beforeTurn, 'the robot got to the edge');
  const before = beforeTurn as Pose;
  near(before.y, -100 + 20 + HELD_AHEAD, 0.05, 'stopped by the element against the edge: its middle 77 mm behind it');
  assert.ok(worstPastEdge <= 1e-9, `nothing went past the edge of the table (worst ${worstPastEdge} mm)`);
  const [ahead, right, turned] = inRobotFrame(sim, 'item');
  near(turned, 0, 1e-6, 'the element turned with the robot');
  assert.ok(ahead > 57 && ahead <= 87 && Math.abs(right) + 20 <= 45.25 + 1, `still between the sticks: [${ahead}, ${right}]`);
  const p = sim.world.robot.pose;
  near((p.heading * 180) / Math.PI, 90, 1e-6, 'the turn was done');
  // the edge pushed the robot back down the map (measured with this set-up: 5.0 mm)
  near(p.y - before.y, 5.003, 0.01, 'the robot gave way');
});

test('a fixed wall: the sticks add nothing - a robot pressed against one that turns slides along it as every robot does (no stuck-turn rule, lead decision D1)', () => {
  // A 40 mm block two squares ahead (where the design's first draft had fixed obstacles). Nothing
  // stands between the sticks, so the field must not change a single number.
  const block: FixedWall = { id: 'wall:block', label: 'block', ...spot(3, 4), angle: 0, w: 40, l: 40, h: 50, fill: '#999' };
  for (const row of ['FF', 'FFL', 'FFR', 'FFLL', 'FFB', 'FFBL']) {
    const withSticks = play(row, [], { walls: [block] });
    const without = play(row, [], { walls: [block], cfg: withoutFlag(MTINY) });
    const a = withSticks.world.robot.pose;
    const b = without.world.robot.pose;
    assert.deepEqual([a.x, a.y, a.heading], [b.x, b.y, b.heading], row);
  }
  // head-on it stops 77 mm short of the block's middle; a quarter turn then slides it round the block (P/c2-edge, "T")
  const stuck = play('FF', [], { walls: [block] }).world.robot.pose;
  near(stuck.y, spot(3, 4).y + 20 + 57, 1e-6, 'stopped by the block');
  const turned = play('FFL', [], { walls: [block] }).world.robot.pose;
  near(turned.x - stuck.x, 96.573, 0.01, 'slid sideways');
  near(turned.y - stuck.y, 9.732, 0.01, 'and back');
});
