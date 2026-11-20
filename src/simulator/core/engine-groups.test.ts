/**
 * Rigid groups (Body.group, core/types.ts): game elements that are ONE piece made of several boxes -
 * Fire Fighter's letter towers, two side supports each (Fire Fighter design 5.2 and 5.3, test plan
 * 12.1). Whatever pushes one member moves the whole piece, what stops one stops all, the piece never
 * turns, and a contact with a member is pushed apart across the side the two met on, so that it
 * does not depend on how fast the robot drives.
 *
 * The field is Fire Fighter's as the design measured it in the print file of the mat (design 3.4,
 * 3.5, 5.2): towers of two side supports 22.5 x 40 x 100 mm whose inner faces are 60 mm apart, and
 * the cubes of the rules, 50 x 50 x 70 mm; the robot is the Fire Rescue mBot2 (DEFAULT_ROBOT_CONFIG).
 * The game's own files hold those numbers (fire-fighter/field.ts); they are written out here so that
 * the engine is tested on its own. The results come from the design's probes on the engine
 * prototype of its round 2 (P = the design's review/out folder: round2-key-numbers.out,
 * held-entry-round2.out, a1-speed-offset-angle-round2.out, a3-gripper-supports-round2.out,
 * p3-referee-round2.out; and its probes/p2-offsets.out and p2-offsets-group-round2.out): this engine
 * gives every one of them to the last digit those files print. Numbers given here with more digits
 * were measured on this engine, on the same scenes.
 *
 * A game without groups is not changed at all: the other games play byte for byte as before
 * (design 12.1 item 8: the four baseline hashes, checked outside this suite).
 */
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineSimulation, TABLE_MARGIN } from './engine';
import { DEG, makeRng, obbTouches, type Vec2 } from './geometry';
import type { RobotIO } from './io';
import { DEFAULT_ROBOT_CONFIG, robotShapesAt } from './robot';
import { drive, makeBody, near, scripted, sleep, turn, waitUntil, type Script } from './test-helpers';
import type { Body, Game, MatVector, Pose, RefereeProp, RobotConfig, ServoPort, Simulation } from './types';
import { cardProp, teamBoxProp } from '../locker-room/game';
import { drawStage, fitView, type MatPainter, type StageScene } from '../ui/render';

// =============================================================================================
// The field (Fire Fighter design 3.4, 3.5 and 5.2)
// =============================================================================================

/** A side support: 22.5 mm across = (the organiser's 105 mm tower - the 60 mm gap) / 2, 40 mm deep (the organiser), 100 mm high (design ASSUMPTION). */
const SUPPORT_WIDTH = 22.5;
const TOWER_DEPTH = 40;
const TOWER_HEIGHT = 100;
/** Between the two supports' inner faces: the white dashed square of the map (MEASURED), "about 6 cm" (the organiser). */
const TOWER_GAP = 60;
/** From a tower's middle to the middle of each support. */
const SUPPORT_OFFSET = TOWER_GAP / 2 + SUPPORT_WIDTH / 2;
/** A cube: 50 x 50 x 70 mm (the rules, 2.2). */
const CUBE_SIZE = 50;
const CUBE_HEIGHT = 70;

type TowerName = 'M' | 'A' | 'K' | 'E' | 'X';
const TOWER_NAMES: TowerName[] = ['M', 'A', 'K', 'E', 'X'];
/** The middles of the towers' dashed outlines (MEASURED in the print file; design 3.4). */
const TOWERS: Record<TowerName, Vec2> = {
  M: { x: 128.301, y: 1114.9645 },
  A: { x: 1104.762, y: 1114.9645 },
  K: { x: 1102.645, y: 138.1935 },
  E: { x: 129.856, y: 138.1935 },
  X: { x: 633.833, y: 624.29 },
};
/** The middle of tower X's dashed square (MEASURED): 0.02 mm below the middle of its outline. */
const X_SQUARE: Vec2 = { x: 633.833, y: 624.31 };
/** Tower X opens towards the top of the mat, to the hydrant line (the organiser's answer); this is its face there. */
const X_FACE = TOWERS.X.y - TOWER_DEPTH / 2;
/** Where the five cubes start: the middles of their printed corner brackets (MEASURED; design 3.5). */
const CUBES: Record<string, Vec2> = {
  'red-L1': { x: 64.203, y: 573.689 },
  'red-L2': { x: 64.338, y: 697.204 },
  'red-R1': { x: 1175.498, y: 561.227 },
  'red-R2': { x: 1175.428, y: 693.132 },
  yellow: { x: 633.713, y: 827.638 },
};

// =============================================================================================
// The robot (the Fire Rescue mBot2, core/robot.ts)
// =============================================================================================

const GRIPPER = DEFAULT_ROBOT_CONFIG.gripper;
/** What the claw grips sits this far (mm) ahead of the axle: 142. */
const GRIP_FORWARD = GRIPPER.gripForward;
/** The finger tips: 167 mm ahead of the axle. */
const TIPS = GRIPPER.gripForward + GRIPPER.fingerLength / 2;

function* setServo(io: RobotIO, port: ServoPort, angle: number): Generator<void, void, void> {
  io.setServo(port, angle);
  yield;
  yield* waitUntil(() => io.servoDone(port));
}
const closeClaw = (io: RobotIO) => setServo(io, GRIPPER.clawServo, GRIPPER.clawClosedAngle);
const openClaw = (io: RobotIO) => setServo(io, GRIPPER.clawServo, GRIPPER.clawOpenAngle);
const raiseArm = (io: RobotIO) => setServo(io, GRIPPER.liftServo, GRIPPER.liftUpAngle);

// =============================================================================================
// Helpers
// =============================================================================================

const MAT: MatVector = { width: 1250, height: 1250, background: { r: 255, g: 255, b: 255 }, outside: { r: 40, g: 40, b: 40 }, layers: [] };

function makeGame(bodies: Body[], props: readonly RefereeProp[] = []): Game<null> {
  const game: Game<null> = {
    id: 'groups-test',
    title: 'Groups test',
    mat: { width: 1250, height: 1250, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: 180,
    startZone: { x: 0, y: 0, w: 1250, h: 1250 },
    defaultStartPose: { x: 625, y: 1000, heading: 0 },
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
  if (props.length > 0) {
    game.createReferee = () => ({ observe: () => null, restart() {}, score: () => ({ total: 0, max: 0, lines: [], complete: false }), props: () => props });
  }
  return game;
}

/** The two side supports of a tower: ids tower:<name>:left and :right, one group tower:<name> (none with `grouped` false). */
function tower(name: string, middle: Vec2, grouped = true): Body[] {
  return (['left', 'right'] as const).map((side) =>
    makeBody({
      id: `tower:${name}:${side}`,
      kind: 'tower-support',
      x: middle.x + (side === 'left' ? -SUPPORT_OFFSET : SUPPORT_OFFSET),
      y: middle.y,
      w: SUPPORT_WIDTH,
      l: TOWER_DEPTH,
      h: TOWER_HEIGHT,
      ...(grouped ? { group: `tower:${name}` } : {}),
    }),
  );
}

const cube = (id: string, x: number, y: number): Body =>
  makeBody({ id, kind: 'cube', x, y, w: CUBE_SIZE, l: CUBE_SIZE, h: CUBE_HEIGHT, grippable: true });

/** Play `script` from `start` until the program has ended and the robot stands still; `onTick` looks at the field after every tick. */
function play(bodies: Body[], start: Pose, script: Script, onTick?: (sim: Simulation<null>) => void, config?: RobotConfig): Simulation<null> {
  const sim = createEngineSimulation({ game: makeGame(bodies), scenario: null, program: {}, startPose: start, robotConfig: config }, scripted(script).factory);
  sim.start();
  for (let k = 0; k < 6000 && sim.status === 'running'; k++) {
    sim.step(1);
    onTick?.(sim);
  }
  assert.equal(sim.finishReason, 'program-ended', 'the program ran to its end');
  return sim;
}

function bodyOf(sim: Simulation<null>, id: string): Body {
  const b = sim.world.bodies.find((x) => x.id === id);
  assert.ok(b, id);
  return b;
}

/** How far a body has slid from where it started (mm). */
const slid = (b: Body): Vec2 => ({ x: b.x - b.home.x, y: b.y - b.home.y });

/** How far tower `name` has slid: its left support's slide. */
const towerSlid = (sim: Simulation<null>, name: string): Vec2 => slid(bodyOf(sim, `tower:${name}:left`));

/** How far a tower's two supports have come apart (mm): 0 while they have moved by the same vector. */
function apart(sim: Simulation<null>, name: string): number {
  const l = slid(bodyOf(sim, `tower:${name}:left`));
  const r = slid(bodyOf(sim, `tower:${name}:right`));
  return Math.hypot(l.x - r.x, l.y - r.y);
}

/** Looks at towers after every tick: the most their supports ever came apart (mm) and the largest turn of a support (radians). */
function watch(names: string[]) {
  const worst = { apart: 0, turned: 0 };
  const onTick = (sim: Simulation<null>): void => {
    for (const name of names) {
      worst.apart = Math.max(worst.apart, apart(sim, name));
      for (const side of ['left', 'right']) worst.turned = Math.max(worst.turned, Math.abs(bodyOf(sim, `tower:${name}:${side}`).angle));
    }
  };
  return { worst, onTick };
}

/** In one piece and unturned on every tick. */
function assertRigid(worst: { apart: number; turned: number }, what: string): void {
  assert.ok(worst.apart <= 1e-9, `${what}: the supports came ${worst.apart} mm apart`);
  assert.equal(worst.turned, 0, `${what}: a support turned`);
}

// =============================================================================================
// One piece
// =============================================================================================

test('a group pushed by the chassis: both boxes move by the same vector on every tick; without the group only the box in the way moves', () => {
  // Two 40 x 40 x 50 mm boxes 120 mm apart. The robot raises its arm (the fingers, 75 - 95 mm above
  // the mat, pass over the boxes) and drives 250 mm up; its chassis meets box a only, after 75 mm.
  const boxes = (group?: string): Body[] => [
    makeBody({ id: 'a', x: 400, y: 500, w: 40, l: 40, h: 50, group }),
    makeBody({ id: 'b', x: 520, y: 500, w: 40, l: 40, h: 50, group }),
  ];
  const START: Pose = { x: 400, y: 700, heading: 0 };
  const script: Script = function* (io) {
    yield* raiseArm(io);
    yield* drive(io, 250, 50);
  };
  let worst = 0;
  const sim = play(boxes('pair'), START, script, (s) => {
    const a = slid(bodyOf(s, 'a'));
    const b = slid(bodyOf(s, 'b'));
    worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
  });
  assert.ok(worst <= 1e-9, `the two boxes came ${worst} mm apart`);
  for (const id of ['a', 'b']) {
    const moved = slid(bodyOf(sim, id));
    near(moved.x, 0, 1e-9, `${id} across`);
    near(moved.y, -175, 1e-6, `${id}: pushed the last 175 mm of the drive`);
    assert.equal(bodyOf(sim, id).angle, 0, `${id} did not turn`);
  }
  near(sim.world.robot.pose.y, START.y - 250, 1e-6, 'the robot drove the whole 250 mm');

  const free = play(boxes(), START, script);
  near(slid(bodyOf(free, 'a')).y, -175, 1e-6, 'without the group: a is pushed');
  assert.deepEqual(slid(bodyOf(free, 'b')), { x: 0, y: 0 }, 'without the group: b stays');
});

test('a cube pushed into one support moves the whole tower, its supports never apart; two free supports come apart (P: p2-offsets, 7 mm off the middle)', () => {
  // The probe: the cube held at the finger tips, driven until the tips are 2 mm before tower X's face
  // (the cube's front 23 mm in), let go; the robot backs off 40 mm, closes the claw and pushes the
  // cube 77 mm on; its path 7 mm right of X's middle. The cube catches the front of the right support.
  const e = 7;
  const axleY = X_FACE - 300;
  const start: Pose = { x: TOWERS.X.x + e, y: axleY, heading: Math.PI };
  const field = (grouped: boolean): Body[] => [...tower('X', TOWERS.X, grouped), cube('cube', TOWERS.X.x + e, axleY + TIPS)];
  const script: Script = function* (io) {
    yield* closeClaw(io);
    yield* drive(io, 300 - TIPS - 2, 30);
    yield* openClaw(io);
    yield* drive(io, -40, 30);
    yield* closeClaw(io);
    yield* drive(io, 77, 20);
  };
  const { worst, onTick } = watch(['X']);
  const sim = play(field(true), start, script, onTick);
  assertRigid(worst, 'grouped');
  // P: p2-offsets-group-round2.out, e = 7: supports L (0.00, 85.00) R (0.00, 85.00), cube depth 60.00
  for (const side of ['left', 'right']) {
    const moved = slid(bodyOf(sim, `tower:X:${side}`));
    near(moved.x, 0, 1e-9, `${side} across`);
    near(moved.y, 85, 1e-6, `${side}: the tower was pushed 85 mm along`);
  }
  near(bodyOf(sim, 'cube').y - X_FACE, 60, 1e-6, 'the cube ends 60 mm past the face');

  // P: p2-offsets.out, "bodies", e = 7: L (0.00, 0.00) R (0.00, 85.00) - the tower comes apart
  const free = play(field(false), start, script);
  assert.deepEqual(slid(bodyOf(free, 'tower:X:left')), { x: 0, y: 0 }, 'free: the left support stays');
  near(slid(bodyOf(free, 'tower:X:right')).y, 85, 1e-6, 'free: the right support alone is pushed away');
});

test('a group against the edge of the table stops there, and the robot is stopped behind it - also when only the far support meets the edge', () => {
  // Up: the closed claw pushes the LEFT support of a tower near the top of the mat (its middle 150 mm
  // from the mat's edge) straight up. (Centred on the tower, the closed claw - 36 mm across - would
  // pass between the supports.) Both supports meet the edge of the table at once.
  const UP: Vec2 = { x: 600, y: 150 };
  let pastEdge = -Infinity;
  const watchUp = watch(['T']);
  const up = play(tower('T', UP), { x: UP.x - SUPPORT_OFFSET, y: UP.y + TOWER_DEPTH / 2 + TIPS + 30, heading: 0 }, function* (io) {
    yield* closeClaw(io);
    yield* drive(io, 400, 60);
  }, (s) => {
    watchUp.onTick(s);
    for (const side of ['left', 'right']) pastEdge = Math.max(pastEdge, -TABLE_MARGIN - (bodyOf(s, `tower:T:${side}`).y - TOWER_DEPTH / 2));
  });
  assertRigid(watchUp.worst, 'up');
  assert.ok(pastEdge <= 1e-9, `nothing went past the edge (${pastEdge} mm)`);
  const top = bodyOf(up, 'tower:T:left').y - TOWER_DEPTH / 2;
  near(top, -TABLE_MARGIN, 1e-6, 'the tower stands against the edge of the table');
  near(up.world.robot.pose.y - TIPS, top + TOWER_DEPTH, 1e-6, 'the claw tips are at the tower: the robot is stopped behind it');

  // Sideways: the closed claw pushes the RIGHT support of a tower near the left edge of the mat to
  // the left. Only the left support meets the edge; the robot pushes the other one.
  const SIDE: Vec2 = { x: 120, y: 600 };
  const rightFace = SIDE.x + SUPPORT_OFFSET + SUPPORT_WIDTH / 2;
  const watchSide = watch(['T']);
  const side = play(tower('T', SIDE), { x: rightFace + TIPS + 20, y: SIDE.y, heading: -Math.PI / 2 }, function* (io) {
    yield* closeClaw(io);
    yield* drive(io, 400, 60);
  }, watchSide.onTick);
  assertRigid(watchSide.worst, 'sideways');
  near(bodyOf(side, 'tower:T:left').x - SUPPORT_WIDTH / 2, -TABLE_MARGIN, 1e-6, 'the left support stands against the edge of the table');
  near(towerSlid(side, 'T').y, 0, 1e-9, 'it was not pushed along the edge');
  near(side.world.robot.pose.x - TIPS, bodyOf(side, 'tower:T:right').x + SUPPORT_WIDTH / 2, 1e-6, 'the claw tips are at the right support: the robot is stopped behind it');
});

test('a robot turning on the spot beside a tower slides it, never turns it (P: p3-referee-round2.out, "M: the robot turns once on the spot beside tower M": moved (39.8, 61.8))', () => {
  const { worst, onTick } = watch(['M']);
  const sim = play(tower('M', TOWERS.M), { x: TOWERS.M.x + 150, y: TOWERS.M.y - 120, heading: 0 }, function* (io) {
    yield* turn(io, -360, 30);
  }, onTick);
  assertRigid(worst, 'turning beside M');
  const moved = towerSlid(sim, 'M');
  near(moved.x, 39.772, 0.001, 'slid right');
  near(moved.y, 61.826, 0.001, 'slid down');
});

test('members of a group never push each other: two boxes that overlap (an L-shaped piece) stay as the game put them, and move as one', () => {
  // Two 40 x 40 mm boxes overlapping by 10 mm. Without the group they push each other apart at once.
  const piece = (group?: string): Body[] => [
    makeBody({ id: 'long', x: 300, y: 300, w: 40, l: 40, h: 50, group }),
    makeBody({ id: 'foot', x: 330, y: 300, w: 40, l: 40, h: 50, group }),
  ];
  const script: Script = function* (io) {
    yield* raiseArm(io);
    yield* drive(io, 150, 30);
  };
  const START: Pose = { x: 300, y: 500, heading: 0 };
  const sim = play(piece('L'), START, script);
  const long = slid(bodyOf(sim, 'long'));
  const foot = slid(bodyOf(sim, 'foot'));
  near(long.y, -75, 1e-6, 'the chassis met the piece after 75 mm and pushed it the last 75 mm');
  assert.ok(Math.hypot(long.x - foot.x, long.y - foot.y) <= 1e-9, 'the two boxes moved by the same vector');
  near(bodyOf(sim, 'foot').x - bodyOf(sim, 'long').x, 30, 1e-9, 'still overlapping by 10 mm');

  const free = play(piece(), START, script);
  assert.ok(bodyOf(free, 'foot').x - bodyOf(free, 'long').x >= 40 - 1e-6, 'without the group they were pushed apart');

  // And the field still comes to rest around such a piece (were its members pushing each other, the
  // engine would never see everything apart, and would judge every contact by the start of the
  // match): the slide-in of a robot 1 degree crooked, below, nudges tower X just as without it.
  near(towerSlid(slideIntoX(0, 20, 1, piece('L')), 'X').x, -0.2961, 0.0001, 'next to an L-shaped piece');
});

// =============================================================================================
// The guard: the helpers that turn a body leave members alone
// =============================================================================================

test('the guard: 200 random approaches near the five towers never split a tower or turn a support (seeded; as the design\'s split fuzz)', () => {
  // The design's probe (critic-engineering/probes/a3c-fuzz-split.mts, seed 11): a start 240 - 360 mm
  // from a tower, clear of everything, heading towards it +- 35 degrees; a random claw opening, the arm
  // up in one run of five, a drive at 15 - 90 RPM, the claw closed in three runs of ten, a turn of
  // up to +- 120 degrees and a last drive. Without the guard in straightenBetweenFingers about one
  // run in ten splits a tower: 18 of these 200 on a copy of this engine without it (the critic's
  // probe, on the prototype without it: 142 of 1,500 with this seed).
  const field: Body[] = [
    ...TOWER_NAMES.flatMap((name) => tower(name, TOWERS[name])),
    ...Object.entries(CUBES).map(([id, at]) => cube(`cube:${id}`, at.x, at.y)),
  ];
  const rng = makeRng(11);
  const failures: string[] = [];
  let runs = 0;
  while (runs < 200) {
    const name = TOWER_NAMES[Math.floor(rng() * TOWER_NAMES.length)];
    const middle = TOWERS[name];
    const distance = 240 + rng() * 120;
    const direction = rng() * 2 * Math.PI;
    const x = middle.x + distance * Math.sin(direction);
    const y = middle.y - distance * Math.cos(direction);
    if (x < 150 || x > 1100 || y < 150 || y > 1100) continue;
    const toward = Math.atan2(middle.x - x, -(middle.y - y));
    const heading = toward + (rng() - 0.5) * 70 * DEG;
    const clawAngle = [0, 0, 25, 40, 60][Math.floor(rng() * 5)];
    const armUp = rng() < 0.2;
    const first = distance - 120 + rng() * 140;
    const driveRpm = [15, 30, 50, 90][Math.floor(rng() * 4)];
    const angle = (rng() - 0.5) * 240;
    const turnRpm = [15, 30, 50][Math.floor(rng() * 3)];
    const last = (rng() - 0.5) * 200;
    const closeAfter = rng() < 0.3;
    const start: Pose = { x, y, heading };
    const shapes = robotShapesAt(DEFAULT_ROBOT_CONFIG, start, GRIPPER.clawOpenGap);
    if (!field.every((b) => shapes.every((s) => !obbTouches({ x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle }, s, 1)))) continue;
    runs++;
    const harness = scripted(function* (io) {
      io.setServo(GRIPPER.clawServo, clawAngle);
      if (armUp) io.setServo(GRIPPER.liftServo, GRIPPER.liftUpAngle);
      yield* sleep(80);
      yield* drive(io, first, driveRpm);
      if (closeAfter) {
        io.setServo(GRIPPER.clawServo, GRIPPER.clawClosedAngle);
        yield* sleep(60);
      }
      yield* turn(io, angle, turnRpm);
      yield* drive(io, last, driveRpm);
    });
    const sim = createEngineSimulation({ game: makeGame(field), scenario: null, program: {}, startPose: start }, harness.factory);
    const { worst, onTick } = watch(TOWER_NAMES);
    sim.start();
    for (let k = 0; k < 1500 && sim.status === 'running'; k++) {
      sim.step(1);
      onTick(sim);
    }
    if (worst.apart > 1e-6 || worst.turned !== 0) {
      failures.push(`run ${runs} (tower ${name}, start ${x.toFixed(2)}, ${y.toFixed(2)}, ${(heading / DEG).toFixed(1)} deg): apart ${worst.apart} mm, turned ${worst.turned} rad`);
    }
  }
  assert.equal(failures.length, 0, `${failures.length} of ${runs} runs split a tower or turned a support:\n${failures.slice(0, 5).join('\n')}`);
});

test('the guard by hand: a support between the open fingers is neither turned nor moved alone when the robot turns', () => {
  // The open claw (64 mm) comes down over X's left support (22.5 mm across: it fits between the
  // fingers) until the support is 45 mm in, and the robot turns by 45 degrees. Without the guard the
  // fingers straighten that one support: on a copy of this engine without it, the left support was
  // turned by 29.2 degrees and torn 15.75 mm away from the right one.
  const { worst, onTick } = watch(['X']);
  const sim = play(tower('X', TOWERS.X), { x: TOWERS.X.x - SUPPORT_OFFSET, y: TOWERS.X.y - 200, heading: Math.PI }, function* (io) {
    yield* drive(io, 200 - TIPS - TOWER_DEPTH / 2 + 45, 30);
    yield* turn(io, 45, 30);
  }, onTick);
  assertRigid(worst, 'the support between the fingers');
  const moved = towerSlid(sim, 'X');
  near(moved.x, -106.709, 0.001, 'the turning claw pushed the whole tower aside');
  near(moved.y, 14.264, 0.001, 'and a little down');
});

test('fixed sticks swing what stands between them, but not a member of a group: the member stays, unturned', () => {
  // Fire Cadet's fixed sticks (GripperConfig.fixedSticks) on the mBot2's open claw: a support 136 mm
  // ahead, between the sticks (64 mm apart), and the robot turns by 2 degrees. A free support turns
  // with the robot; a member of a group stays where it is (the sticks do not reach it in 2 degrees).
  const STICKS: RobotConfig = { ...DEFAULT_ROBOT_CONFIG, gripper: { ...GRIPPER, fixedSticks: true } };
  const ROBOT: Pose = { x: 600, y: 700, heading: 0 };
  const AHEAD = 136;
  const script: Script = function* (io) {
    yield* turn(io, 2, 10);
  };
  const support = (group?: string): Body[] => [
    makeBody({ id: 'tower:S:left', x: ROBOT.x, y: ROBOT.y - AHEAD, w: SUPPORT_WIDTH, l: TOWER_DEPTH, h: TOWER_HEIGHT, group }),
    makeBody({ id: 'tower:S:right', x: ROBOT.x + 2 * SUPPORT_OFFSET, y: ROBOT.y - AHEAD, w: SUPPORT_WIDTH, l: TOWER_DEPTH, h: TOWER_HEIGHT, group }),
  ];
  const free = play(support(), ROBOT, script, undefined, STICKS);
  near(bodyOf(free, 'tower:S:left').angle / DEG, 2, 1e-9, 'a free support between the sticks turns with the robot');

  const { worst, onTick } = watch(['S']);
  const grouped = play(support('tower:S'), ROBOT, script, onTick, STICKS);
  assertRigid(worst, 'a member between the sticks');
  assert.deepEqual(towerSlid(grouped, 'S'), { x: 0, y: 0 }, 'not swung');
});

// =============================================================================================
// The side that met: contacts with a member do not depend on the speed
// =============================================================================================

/**
 * The slide-in at tower X of the design's probes (round2-key-numbers.mts, a1-speed-offset-angle.mts):
 * the cube, in the claw, is carried to 2 mm before X's face and let go; the robot backs off 55 mm,
 * closes the claw and pushes the cube in at `pushRpm`, to 5 mm past the middle of X's square
 * (measured from the cube's back), and backs off 60 mm. Its path is `e` mm right of X's middle,
 * and it is `crookedDeg` degrees off the straight line. `elsewhere`: more bodies, away from all this.
 */
function slideIntoX(e: number, pushRpm: number, crookedDeg = 0, elsewhere: Body[] = []): Simulation<null> {
  const axleY = X_FACE - 280;
  const start: Pose = { x: TOWERS.X.x + e, y: axleY, heading: Math.PI + crookedDeg * DEG };
  return play([...tower('X', TOWERS.X), cube('cube', TOWERS.X.x + e, axleY + GRIP_FORWARD), ...elsewhere], start, function* (io) {
    yield* closeClaw(io);
    yield* drive(io, X_FACE - 2 - (axleY + TIPS), 40);
    yield* openClaw(io);
    yield* drive(io, -55, 40);
    yield* closeClaw(io);
    yield* drive(io, 5 + (X_SQUARE.y - (X_FACE - 2 - CUBE_SIZE / 2)), pushRpm);
    yield* drive(io, -60, 40);
  });
}

test('speed: a cube let go before tower X and pushed in by the closed claw goes in 5.00 mm off the middle and pushes the tower 5.05 mm off, at 10, 20, 50 and 100 RPM alike (P: round2-key-numbers.out, A)', () => {
  for (const rpm of [10, 20, 50, 100]) {
    const inside = slideIntoX(5, rpm);
    assert.deepEqual(towerSlid(inside, 'X'), { x: 0, y: 0 }, `${rpm} RPM, 5.00 mm: the tower did not move`);
    const c = bodyOf(inside, 'cube');
    near(c.x - X_SQUARE.x, 5, 1e-6, `${rpm} RPM, 5.00 mm: the cube went straight in`);
    near(c.y - X_SQUARE.y, 0, 1e-6, `${rpm} RPM, 5.00 mm: to the middle of the square`);

    const caught = slideIntoX(5.05, rpm);
    const moved = towerSlid(caught, 'X');
    near(moved.x, 0, 1e-9, `${rpm} RPM, 5.05 mm: not sideways`);
    near(moved.y, 45.02, 1e-6, `${rpm} RPM, 5.05 mm: the cube caught the support's front and pushed the tower 45.02 mm`);
    assert.ok(apart(caught, 'X') <= 1e-9, `${rpm} RPM: in one piece`);
  }
});

test('speed: a cube held at the finger tips and driven 23 mm into tower X goes in 5.0 mm off the middle and pushes the tower 5.2 mm off, at 10, 20, 50 and 100 RPM alike (P: held-entry-round2.out)', () => {
  const held = (e: number, rpm: number): Simulation<null> => {
    const axleY = X_FACE - 300;
    // the cube's middle at the finger tips: 25 mm of it stick out ahead of them
    return play([...tower('X', TOWERS.X), cube('cube', TOWERS.X.x + e, axleY + TIPS)], { x: TOWERS.X.x + e, y: axleY, heading: Math.PI }, function* (io) {
      yield* closeClaw(io);
      yield* drive(io, 300 - TIPS - 2, rpm);
    });
  };
  for (const rpm of [10, 20, 50, 100]) {
    for (const [e, pushed] of [
      [5.0, 0],
      [5.2, 23],
    ]) {
      const sim = held(e, rpm);
      const moved = towerSlid(sim, 'X');
      near(moved.x, 0, 1e-9, `${rpm} RPM, ${e} mm: not sideways`);
      near(moved.y, pushed, 1e-6, `${rpm} RPM, ${e} mm: the tower pushed ${pushed} mm`);
      assert.equal(sim.world.robot.gripper.holding, 'cube', 'the cube is still in the claw');
      near(bodyOf(sim, 'cube').y + CUBE_SIZE / 2 - X_FACE, 23, 1e-6, 'the cube is 23 mm in');
    }
  }
});

test('speed: a robot 1 degree crooked pushes the cube against the inside of a support and the cube slides along it - the tower is nudged about 0.3 mm aside, never pushed along (P: a1-speed-offset-angle-round2.out, "robot turned 1 deg")', () => {
  // (the robot looks 1 degree to the left of straight down the mat: the cube drifts to the left support)
  for (const [rpm, aside, cubeAcross, cubeAlong] of [
    [20, -0.2961, -4.9401, -0.0405],
    [50, -0.3038, -4.9324, -0.0404],
  ]) {
    const sim = slideIntoX(0, rpm, 1);
    const moved = towerSlid(sim, 'X');
    near(moved.x, aside, 0.0001, `${rpm} RPM: nudged aside`);
    near(moved.y, 0, 1e-9, `${rpm} RPM: not pushed along`);
    assert.ok(apart(sim, 'X') <= 1e-9, `${rpm} RPM: in one piece`);
    const c = bodyOf(sim, 'cube');
    near(c.x - X_SQUARE.x, cubeAcross, 0.0001, `${rpm} RPM: the cube slid in along the inside of the left support`);
    near(c.y - X_SQUARE.y, cubeAlong, 0.0001, `${rpm} RPM: to the middle of the square`);
  }
});

test('the claw against a support: the closed claw opened 15 mm inside an empty tower pushes it along its opening, in one piece and unturned (P: a3-gripper-supports-round2.out: (0.35, 15.72))', () => {
  const { worst, onTick } = watch(['X']);
  const sim = play(tower('X', TOWERS.X), { x: TOWERS.X.x, y: X_FACE - TIPS - 20, heading: Math.PI }, function* (io) {
    yield* closeClaw(io);
    yield* drive(io, 20 + 15, 20);
    yield* openClaw(io);
    yield* drive(io, -80, 20);
  }, onTick);
  assertRigid(worst, 'the claw opening inside the tower');
  const moved = towerSlid(sim, 'X');
  near(moved.x, 0.346, 0.001, 'a little aside');
  near(moved.y, 15.717, 0.001, 'pushed along its opening');
});

test('a robot put down on a tower (a new start pose) pushes it off across the side of least overlap, as in every game: the last moment everything was apart is from before', () => {
  // The left finger of the open claw pokes 3 mm into the back of X's right support from below. Put
  // there at once, or first somewhere else and then moved there (setStartPose), the tower is pushed
  // 3 mm up. (Judged by the robot's earlier place, far to the left, it would be pushed 15.25 mm
  // sideways: measured on a copy of this engine that keeps using that place.)
  const finger = GRIPPER.clawOpenGap / 2 + GRIPPER.fingerThickness / 2;
  const there: Pose = { x: TOWERS.X.x + SUPPORT_OFFSET + finger, y: TOWERS.X.y + TOWER_DEPTH / 2 - 3 + TIPS, heading: 0 };
  const putDown = (first: Pose): Simulation<null> => {
    const sim = createEngineSimulation({ game: makeGame(tower('X', TOWERS.X)), scenario: null, program: {}, startPose: first }, scripted(function* () {}).factory);
    if (first !== there) assert.ok(sim.setStartPose(there), 'the robot was moved');
    sim.start();
    sim.step(1);
    return sim;
  };
  for (const first of [there, { x: 300, y: there.y, heading: 0 }]) {
    const sim = putDown(first);
    const moved = towerSlid(sim, 'X');
    near(moved.x, 0, 1e-9, `first at x ${first.x}: not sideways`);
    near(moved.y, -3, 1e-9, `first at x ${first.x}: pushed 3 mm up, off the finger`);
    assert.ok(apart(sim, 'X') <= 1e-9, 'in one piece');
  }
});

// =============================================================================================
// RefereeProp.labelMm (core/types.ts): left out, the stage draws a prop as before
// =============================================================================================

/** One entry per call or setting of the 2-D context: its name and its arguments (an object is written as its kind). */
type Entry = Array<string | number | boolean | null>;
const flat = (value: unknown): string | number | boolean | null =>
  value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : `<${typeof value}>`;

/** A 2-D context that writes down every call and every setting into `log` (as ui/render-painters.test.ts does). */
function recordingContext(log: Entry[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { canvas: { width: 800, height: 800 } };
  const gradient = { addColorStop: (...args: unknown[]) => log.push(['addColorStop', ...args.map(flat)]) };
  return new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push([key, ...args.map(flat)]);
        if (key === 'measureText') return { width: String(args[0]).length * 5 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient;
        if (key === 'getImageData') return { data: new Uint8ClampedArray(4) };
        return undefined;
      };
    },
    set(target, key: string, value) {
      log.push([`=${key}`, flat(value)]);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

test('RefereeProp.labelMm left out: the stage draws Locker Room\'s Team Box and colour card exactly as before (design 12.1 item 9)', () => {
  // The drawing of the props alone: the stage drawn with them, less the same stage without them.
  // Its fingerprint was taken with the drawing code of 5bf15e4, before labelMm existed; a prop that
  // leaves labelMm out must keep it (its label 11 px high on the screen, whatever the zoom).
  const props = [teamBoxProp(), cardProp('green')];
  const sim = createEngineSimulation({ game: makeGame([], props), scenario: null, program: {}, startPose: { x: 625, y: 700, heading: 0.3 } }, scripted(function* () {}).factory);
  assert.deepEqual(sim.world.props, props, 'the referee holds the two props');
  const view = fitView(800, 800, sim.game.mat.width, sim.game.mat.height, 1, 45);
  const draw = (): Entry[] => {
    const log: Entry[] = [];
    const scene: StageScene = {
      sim,
      view,
      options: { overlays: true, sensors: false, trail: false },
      mat: { paint: () => log.push(['mat']) } as unknown as MatPainter,
      trail: { points: [] } as never,
      overlays: [],
      placing: false,
      ghost: null,
      ruler: null,
    };
    drawStage(recordingContext(log), scene);
    return log;
  };
  const withProps = draw();
  sim.world.props = undefined;
  const without = draw();
  let head = 0;
  while (head < without.length && JSON.stringify(withProps[head]) === JSON.stringify(without[head])) head++;
  const block = withProps.slice(head, head + withProps.length - without.length);
  assert.deepEqual([...withProps.slice(0, head), ...withProps.slice(head + block.length)], without, 'the props are drawn in one piece');

  const fonts = block.filter((e) => e[0] === '=font');
  assert.equal(fonts.length, props.length, 'one label per prop');
  for (const f of fonts) assert.ok(String(f[1]).startsWith(`700 ${11 / view.scale}px `), `the label is 11 px high on the screen: ${f[1]}`);
  const texts = block.filter((e) => e[0] === 'fillText').map((e) => e[1]);
  assert.deepEqual(texts, ['Team Box', 'GREEN card'], 'the two labels');
  const fingerprint = createHash('sha256').update(JSON.stringify(block)).digest('hex');
  assert.equal(block.length, 81, 'the number of calls and settings of the drawing');
  assert.equal(fingerprint, '70eb56c4344bf2630b39af029f8a0c391baf31652469d3e846f4aefa51b6b5ad', 'the drawing of the two props, call for call');
});
