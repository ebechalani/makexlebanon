/**
 * The Fire Fighter referee (design section 6): every sentence of the score sheet and the console,
 * word for word, in its running and its closed form; the letter rule at its edges; the yellow rule
 * in every order of design 6.3; the towers off their picture squares; the end of a match.
 *
 * Most tests put the field together by hand - a cube here, a tower slid there, the robot touching
 * a cube or far away - and ask the referee directly, tick by tick: that way each edge is exact. The
 * tests at the end run the real engine with a scripted robot: a cube pushed into a tower off its
 * middle, turned, from the back, the claw closed too soon, a tower pushed off its picture square.
 *
 * The expected sentences are written out here from the design (6.2), never taken from the code.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createEngineSimulation } from '../core/engine';
import { robotShapesAt } from '../core/robot';
import { drive, forever, scripted, turn as turnBy, waitUntil, type Script } from '../core/test-helpers';
import type { Body, Game, Pose, RefereeCall, RefereeProp, ScoreContext, ScoreLine, ScoreReport, Simulation } from '../core/types';
import type { RobotIO } from '../core/io';
import {
  CUBE_HOMES,
  CUBE_SIZE,
  CUBE_SQUARES,
  FIRE_STATION,
  LETTER_AREA,
  MAT_VECTOR,
  OPENING,
  PICTURE_SQUARES,
  ROOM_ALONG_OPENING,
  SQUARE_MIDDLES,
  SUPPORT_WIDTH,
  TILES,
  TOWER_DEPTH,
  TOWER_GAP,
  TOWER_HEIGHT,
  TOWER_IDS,
  TOWER_MIDDLES,
  TOWER_WIDTH,
  YELLOW_SQUARE,
  supportMiddle,
  type TowerId,
} from './field';
import {
  CUBE_FILL,
  CUBE_IDS,
  DELIVERY_POINTS,
  FLAP_LETTER_MM,
  FLAP_SHOWN_FILL,
  KIND_CUBE,
  KIND_SUPPORT,
  LINE_TOWERS_MOVED,
  MATCH_DURATION,
  MAX_SCORE,
  MOVED_TOWER_PENALTY,
  PLYWOOD_FILL,
  YELLOW_CUBE_ID,
  clock,
  createFireFighterReferee,
  cubeId,
  fireFighterGame,
  flapId,
  supportId,
  towerGroup,
  towerLineId,
  towerShift,
  type FireFighterReferee,
} from './game';
import { FIRE_FIGHTER_ROBOT, START_POSE } from './robot';
import { RULES_SETUP, type FireFighterScenario } from './scenario';

const ROBOT = FIRE_FIGHTER_ROBOT;
type Ctx = ScoreContext<FireFighterScenario>;
const RED = cubeId('red-left-upper');
const RED_2 = cubeId('red-left-lower');
const RED_3 = cubeId('red-right-upper');
const YELLOW = YELLOW_CUBE_ID;
const DOWN = Math.PI;

// =============================================================================================
// The sentences of design 6.2, written out
// =============================================================================================

const SIDE: Record<TowerId, string> = { M: 'the top', A: 'the top', K: 'the bottom', E: 'the bottom', X: 'the top' };
const say = {
  collected: 'The robot took the yellow cube. Now tower X must be its next delivery.',
  redUnder: (t: TowerId): string => `A red cube is under tower ${t}: the letter ${t} shows.`,
  yellowUnderX: 'The yellow cube is under tower X: the letter X shows.',
  yellowUnderWrong: (t: TowerId): string => `The yellow cube is under tower ${t}: the letter ${t} shows, but ${t} needs a red cube.`,
  redUnderX: 'A red cube is under tower X: the letter X shows, but X needs the yellow cube.',
  notDirect: 'That was not the yellow cube at X: the yellow cube can no longer score.',
  fromTheBack: (t: TowerId): string => `A cube went in from the back of tower ${t}. Tower ${t} opens to ${SIDE[t]}: a cube counts only when it goes in from there.`,
  offPicture: (t: TowerId): string => `Tower ${t} is off its picture square: 0 for ${t}, and 4 points off.`,
};
const sheet = {
  pushedOff: (t: TowerId): string => `Tower ${t} was pushed off its picture square: 0 for ${t}, and 4 points off.`,
  touches: (t: TowerId): string => `The robot still touches the cube under tower ${t}. It counts once the robot has moved clear.`,
  touched: (t: TowerId): string => `The robot still touched the cube under tower ${t} when the match ended: it does not count.`,
  yellowAtRed: (t: TowerId): string => `The yellow cube is under tower ${t}. Tower ${t} needs a red cube; the yellow one belongs under X.`,
  redAtX: 'A red cube is under tower X. Tower X needs the yellow cube.',
  notNext: (first: string, t: TowerId, time: string): string =>
    `The yellow cube is under X, but X was not the robot's next delivery after it took the yellow cube: first ${first} went under tower ${t} (${time}).`,
  scores: (t: TowerId): string => `A red cube is under tower ${t} and the letter ${t} shows.`,
  scoresX: "The yellow cube is under X, the letter X shows, and X was the robot's next delivery after it took the yellow cube.",
  holds: (t: TowerId): string => `The robot still holds a cube at tower ${t}: let go and move clear.`,
  held: (t: TowerId): string => `The robot still held a cube at tower ${t} when the match ended: it does not count.`,
  fromTheBack: (t: TowerId): string => `A cube went in from the back of tower ${t}. Tower ${t} opens to ${SIDE[t]}: a cube counts only when it goes in from there.`,
  entrance: (t: TowerId): string => `A cube is at the entrance of tower ${t}: push it farther in, inside the white dashed square.`,
  entranceClosed: (t: TowerId): string => `A cube is at the entrance of tower ${t}: it is not far enough in.`,
  tooFar: (t: TowerId): string => `A cube is too far in tower ${t}: it is past the white dashed square, towards the back.`,
  none: (t: TowerId): string => `No cube under tower ${t}.`,
  allOn: 'Every tower still touches its picture square.',
};
const NOW = 'The robot took the yellow cube: X must be its next delivery.';

// =============================================================================================
// A field put together by hand
// =============================================================================================

/** Where a cube stands `along` mm from the middle of a tower's square towards its opening (negative: towards its back), `across` mm to the right. */
function at(tower: TowerId, along: number, across = 0): { x: number; y: number } {
  const m = SQUARE_MIDDLES[tower];
  return { x: m.x + across, y: m.y + (OPENING[tower] === 'top' ? -along : along) };
}

/** A field with the real bodies and the real robot state (the engine does not run), and a referee of its own asked tick by tick. */
function bench() {
  const sim = createEngineSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: {} }, scripted(forever).factory);
  const world = sim.world;
  const referee = createFireFighterReferee(RULES_SETUP);
  const ctx = (): Ctx => ({ scenario: RULES_SETUP, world, robotConfig: ROBOT, restarts: 0, robotShapes: robotShapesAt(ROBOT, world.robot.pose, world.robot.gripper.gap) });
  const body = (id: string): Body => {
    const found = world.bodies.find((b) => b.id === id);
    assert.ok(found, id);
    return found;
  };
  const b = {
    world,
    referee: referee as FireFighterReferee,
    body,
    /** what the referee said on the last tick, and everything it said so far */
    said: [] as string[],
    log: [] as string[],
    call: null as RefereeCall | null,
    robotAt(pose: Pose) {
      Object.assign(world.robot.pose, pose);
    },
    /** put a cube down on the mat with its middle at (x, y) */
    place(id: string, p: { x: number; y: number }, angle = 0) {
      Object.assign(body(id), { x: p.x, y: p.y, angle, z: 0, held: false, restingOn: null });
      if (world.robot.gripper.holding === id) world.robot.gripper.holding = null;
    },
    /** the gripper holds a cube where it stands, its base `z` mm above the mat */
    hold(id: string, z = 0) {
      Object.assign(body(id), { z, held: true, restingOn: null });
      world.robot.gripper.holding = id;
    },
    /** let go of what the gripper holds (on the mat where it is) */
    letGo() {
      const id = world.robot.gripper.holding;
      if (id) Object.assign(body(id), { z: 0, held: false });
      world.robot.gripper.holding = null;
    },
    /** slide a tower (both supports) to `dx`, `dy` mm from where it started */
    slide(tower: TowerId, dx: number, dy: number) {
      for (const side of ['left', 'right'] as const) {
        const s = body(supportId(tower, side));
        s.x = s.home.x + dx;
        s.y = s.home.y + dy;
      }
    },
    /** the referee looks at one tick (the next 1/100 s) */
    tick() {
      world.tick++;
      world.time = world.tick / 100;
      b.call = referee.observe(ctx());
      b.said = b.call?.say ?? [];
      b.log.push(...b.said);
    },
    ticks(n: number) {
      for (let i = 0; i < n; i++) b.tick();
    },
    /** a cube goes into a tower through its opening and stands in the middle of its square (two ticks) */
    pushIn(id: string, tower: TowerId, along = 0, across = 0) {
      b.place(id, at(tower, 44, across));
      b.tick();
      b.place(id, at(tower, along, across));
      b.tick();
    },
    /** a cube taken out of every tower, onto the white mat left of the Fire Station */
    takeOut(id: string) {
      b.place(id, { x: 450, y: 950 + 55 * CUBE_IDS.indexOf(id) });
      b.tick();
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
    tower(t: TowerId): ScoreLine {
      return b.line(towerLineId(t));
    },
    props: (): readonly RefereeProp[] => referee.props?.() ?? [],
    flap: (t: TowerId): RefereeProp => {
      const flap = (referee.props?.() ?? []).find((p) => p.id === flapId(t));
      assert.ok(flap, `flap ${t}`);
      return flap;
    },
  };
  // the robot far from every tower and cube: in the Fire Station
  b.robotAt(START_POSE);
  return b;
}

/** The pose of the robot facing down onto a cube that stands at (x, y), its closed claw's tips `gap` mm above the cube's top face. */
function clawAbove(p: { x: number; y: number }, gap = 0): Pose {
  return { x: p.x, y: p.y - CUBE_SIZE / 2 - gap - (ROBOT.gripper.gripForward + ROBOT.gripper.fingerLength / 2), heading: DOWN };
}

/** Close the claw (in the bench: the fingers' gap only). */
function closeClaw(b: ReturnType<typeof bench>): void {
  b.world.robot.gripper.gap = ROBOT.gripper.clawClosedGap;
}

// =============================================================================================
// The game: its elements, zones, sheet at the start
// =============================================================================================

test('the game: one setup, 180 s, the Fire Station, the mBot2 of Fire Rescue, no walls and no restarts', () => {
  const g: Game<FireFighterScenario> = fireFighterGame;
  assert.equal(g.id, 'fire-fighter');
  assert.equal(g.title, 'MakeX Lebanon 2027 - Fire Fighter');
  assert.deepEqual(g.mat, { width: 1250, height: 1250, imageUrl: '/simulator/fire-fighter/mat.webp', sensorImageUrl: '/simulator/fire-fighter/mat-sensor.webp', vector: MAT_VECTOR });
  assert.equal(g.matchDuration, 180);
  assert.equal(MATCH_DURATION, 180);
  assert.equal(g.startZone, FIRE_STATION);
  assert.deepEqual(g.defaultStartPose, START_POSE);
  assert.equal(g.robotConfig, FIRE_FIGHTER_ROBOT);
  assert.equal(g.restartPenalty, 0);
  assert.deepEqual(g.restartRules, { maxRestarts: 0 });
  assert.equal(g.createWalls, undefined);
  assert.equal(g.scenarioProblems, undefined);
  assert.equal(g.scenarioCount(), 1);
  assert.equal(g.encodeScenario(g.defaultScenario()), 'MAKEX');
  assert.equal(DELIVERY_POINTS, 20);
  assert.equal(MOVED_TOWER_PENALTY, 4);
  assert.equal(MAX_SCORE, 100);
});

test('the game elements: ten supports of 22.5 x 40 x 100 mm in five groups, five cubes of 50 x 50 x 70 mm on their squares', () => {
  const bodies = fireFighterGame.createBodies(RULES_SETUP);
  assert.deepEqual(
    bodies.map((b) => b.id),
    [...TOWER_IDS.flatMap((t) => [`tower:${t}:left`, `tower:${t}:right`]), 'cube:red-left-upper', 'cube:red-left-lower', 'cube:red-right-upper', 'cube:red-right-lower', 'cube:yellow'],
  );
  for (const t of TOWER_IDS) {
    for (const side of ['left', 'right'] as const) {
      const s = bodies.find((b) => b.id === supportId(t, side)) as Body;
      const m = supportMiddle(t, side);
      assert.deepEqual(
        { kind: s.kind, label: s.label, fill: s.fill, x: s.x, y: s.y, angle: s.angle, w: s.w, l: s.l, h: s.h, z: s.z, grippable: s.grippable, platform: s.platform, mass: s.mass, group: s.group, colorName: s.colorName },
        { kind: KIND_SUPPORT, label: '', fill: PLYWOOD_FILL, x: m.x, y: m.y, angle: 0, w: SUPPORT_WIDTH, l: TOWER_DEPTH, h: TOWER_HEIGHT, z: 0, grippable: false, platform: false, mass: 1, group: towerGroup(t), colorName: undefined },
      );
      assert.deepEqual(s.home, { x: m.x, y: m.y, angle: 0, z: 0, restingOn: null });
    }
    // the two supports: inner faces 60 mm apart, outer faces 105 mm
    const left = bodies.find((b) => b.id === supportId(t, 'left')) as Body;
    const right = bodies.find((b) => b.id === supportId(t, 'right')) as Body;
    assert.ok(Math.abs(right.x - left.x - (TOWER_GAP + SUPPORT_WIDTH)) < 1e-9);
    assert.ok(Math.abs(right.x + SUPPORT_WIDTH / 2 - (left.x - SUPPORT_WIDTH / 2) - TOWER_WIDTH) < 1e-9);
    assert.equal(towerGroup(t), `tower:${t}`);
  }
  for (const id of CUBE_IDS) {
    const c = bodies.find((b) => b.id === id) as Body;
    const place = id.slice('cube:'.length) as keyof typeof CUBE_HOMES;
    const color = id === YELLOW ? 'yellow' : 'red';
    assert.deepEqual(
      { kind: c.kind, label: c.label, fill: c.fill, colorName: c.colorName, x: c.x, y: c.y, angle: c.angle, w: c.w, l: c.l, h: c.h, z: c.z, grippable: c.grippable, platform: c.platform, mass: c.mass, group: c.group },
      { kind: KIND_CUBE, label: '', fill: CUBE_FILL[color], colorName: color, x: CUBE_HOMES[place].x, y: CUBE_HOMES[place].y, angle: 0, w: 50, l: 50, h: 70, z: 0, grippable: true, platform: false, mass: 1, group: undefined },
    );
  }
  assert.deepEqual(CUBE_FILL, { red: '#e8382f', yellow: '#ffd21f' });
  // a fresh list every time (the engine changes the bodies it is given)
  assert.notEqual(fireFighterGame.createBodies(RULES_SETUP)[0], fireFighterGame.createBodies(RULES_SETUP)[0]);
});

test('the zones: the Fire Station, the five cube squares, the five letter areas, the five picture squares', () => {
  const zones = fireFighterGame.overlays(RULES_SETUP);
  assert.deepEqual(
    zones.map((z) => [z.id, z.label, z.kind]),
    [
      ['start', 'Fire Station', 'start'],
      ['pickup:red-left-upper', 'red cube', 'pickup'],
      ['pickup:red-left-lower', 'red cube', 'pickup'],
      ['pickup:red-right-upper', 'red cube', 'pickup'],
      ['pickup:red-right-lower', 'red cube', 'pickup'],
      ['pickup:yellow', 'yellow cube', 'pickup'],
      ['delivery:M', 'M', 'delivery'],
      ['delivery:A', 'A', 'delivery'],
      ['delivery:K', 'K', 'delivery'],
      ['delivery:E', 'E', 'delivery'],
      ['delivery:X', 'X', 'delivery'],
      ['picture:M', 'M · school', 'tower-area'],
      ['picture:A', 'A · hospital', 'tower-area'],
      ['picture:K', 'K · bakery', 'tower-area'],
      ['picture:E', 'E · park', 'tower-area'],
      ['picture:X', 'X · hydrant', 'tower-area'],
    ],
  );
  assert.equal(zones[0].rect, FIRE_STATION);
  assert.equal(zones.find((z) => z.id === 'pickup:yellow')?.rect, CUBE_SQUARES.yellow);
  for (const t of TOWER_IDS) {
    assert.equal(zones.find((z) => z.id === `delivery:${t}`)?.rect, LETTER_AREA[t]);
    assert.equal(zones.find((z) => z.id === `picture:${t}`)?.rect, PICTURE_SQUARES[t]);
  }
  for (const z of zones) assert.match(z.color, /^#[0-9a-f]{6}$/);
});

test('the sheet at the start: six lines in the order of the rules\' sheet, nothing earned, every tower on its square', () => {
  const report = fireFighterGame.score({ scenario: RULES_SETUP, world: bench().world, robotConfig: ROBOT, restarts: 0, robotShapes: robotShapesAt(ROBOT, START_POSE) });
  assert.deepEqual(
    report.lines.map((l) => [l.id, l.label, l.points, l.max, l.ok, l.detail]),
    [
      ['tower-M', 'M · school: a red cube', 0, 20, false, 'No cube under tower M.'],
      ['tower-A', 'A · hospital: a red cube', 0, 20, false, 'No cube under tower A.'],
      ['tower-K', 'K · bakery: a red cube', 0, 20, false, 'No cube under tower K.'],
      ['tower-E', 'E · park: a red cube', 0, 20, false, 'No cube under tower E.'],
      ['tower-X', 'X · hydrant: the yellow cube, as the next delivery', 0, 20, false, 'No cube under tower X.'],
      ['towers-moved', 'Towers on their picture squares', 0, 0, true, 'Every tower still touches its picture square.'],
    ],
  );
  assert.equal(report.total, 0);
  assert.equal(report.max, 100);
  assert.equal(report.complete, false);
  assert.equal(report.now, undefined);
  for (const line of report.lines) assert.equal(line.time, undefined);
  assert.ok(Object.is(report.lines[5].points, 0), '0, not -0');
});

test('the flaps: one on each tower, between its supports from 7 to 10 cm high, the letter hidden at the start', () => {
  const b = bench();
  assert.deepEqual(
    b.props().map((p) => p.id),
    ['letter:M', 'letter:A', 'letter:K', 'letter:E', 'letter:X'],
  );
  for (const t of TOWER_IDS) {
    assert.deepEqual(b.flap(t), {
      id: `letter:${t}`,
      label: '',
      fill: PLYWOOD_FILL,
      frame: 'mat',
      x: TOWER_MIDDLES[t].x,
      y: TOWER_MIDDLES[t].y,
      angle: 0,
      w: TOWER_GAP,
      l: TOWER_DEPTH,
      z: 70,
      h: 30,
      labelMm: FLAP_LETTER_MM,
    });
  }
  assert.equal(FLAP_LETTER_MM, 30);
  // the same list while nothing changes
  const before = b.props();
  b.ticks(3);
  assert.equal(b.props(), before);
});

// =============================================================================================
// The letter rule (design 5.4) and a delivery
// =============================================================================================

describe('the letter rule', () => {
  test('a red cube through the opening into the middle of M: the letter shows, and it is delivered once the robot is clear', () => {
    const b = bench();
    b.place(RED, at('M', 44));
    b.tick();
    assert.equal(b.referee.stayOf(RED)?.throughOpening, true);
    assert.deepEqual(b.said, []);
    b.place(RED, at('M', 0));
    b.tick();
    assert.deepEqual(b.said, [say.redUnder('M')]);
    assert.equal(b.flap('M').label, 'M');
    assert.equal(b.flap('M').fill, FLAP_SHOWN_FILL);
    const line = b.tower('M');
    assert.equal(line.points, 20);
    assert.equal(line.ok, true);
    assert.equal(line.detail, sheet.scores('M'));
    assert.equal(line.time, 0.02);
    assert.equal(b.score().total, 20);
    assert.deepEqual(b.referee.deliveries(), [{ cube: RED, tower: 'M', time: 0.02 }]);
    // said once: the cube stays, nothing more is said
    b.ticks(5);
    assert.deepEqual(b.log, [say.redUnder('M')]);
  });

  test('along the opening: 7.8 mm off the middle towards the opening or the back shows the letter; 7.9 mm does not', () => {
    for (const t of ['M', 'K'] as const) {
      for (const [along, shows, detail] of [
        [7.8, true, sheet.scores(t)],
        [ROOM_ALONG_OPENING, true, sheet.scores(t)],
        [-7.8, true, sheet.scores(t)],
        [-ROOM_ALONG_OPENING, true, sheet.scores(t)],
        [7.9, false, sheet.entrance(t)],
        [-7.9, false, sheet.tooFar(t)],
      ] as const) {
        const b = bench();
        b.pushIn(RED, t, along);
        assert.equal(b.flap(t).label, shows ? t : '', `${t} ${along}`);
        assert.equal(b.tower(t).points, shows ? 20 : 0, `${t} ${along}`);
        assert.equal(b.tower(t).detail, detail, `${t} ${along}`);
        b.end();
        if (!shows && along > 0) assert.equal(b.tower(t).detail, sheet.entranceClosed(t), `${t} ${along}: closed`);
      }
    }
  });

  test('a cube turned up to 13 degrees in the middle shows the letter (its base stays inside the dashed square)', () => {
    const b = bench();
    b.place(RED, at('A', 44));
    b.tick();
    b.place(RED, at('A', 0), (13 * Math.PI) / 180);
    b.tick();
    assert.equal(b.tower('A').points, 20);
  });

  test('a cube must stand on the mat: held, or lifted, it shows no letter', () => {
    const b = bench();
    b.place(RED, at('K', 44));
    b.tick();
    b.place(RED, at('K', 0));
    b.hold(RED);
    b.tick();
    assert.equal(b.flap('K').label, '');
    assert.equal(b.tower('K').detail, sheet.holds('K'));
    assert.deepEqual(b.log, []);
    // lifted by the arm (its base 70 mm up): still held, still no letter
    b.hold(RED, 70);
    b.tick();
    assert.equal(b.tower('K').detail, sheet.holds('K'));
    // let go: on the mat, the letter shows and it is delivered
    b.letGo();
    b.tick();
    assert.deepEqual(b.said, [say.redUnder('K')]);
    assert.equal(b.tower('K').points, 20);
  });

  test('the robot still holding a cube in a tower when the match ends: the closed sentence', () => {
    const b = bench();
    b.place(YELLOW, at('X', 30));
    b.hold(YELLOW);
    b.tick();
    assert.equal(b.tower('X').detail, sheet.holds('X'));
    b.end();
    assert.equal(b.tower('X').detail, sheet.held('X'));
    assert.equal(b.tower('X').points, 0);
  });

  test('a cube that goes in from the back: said once; no letter, even pushed on to the middle of the square', () => {
    for (const t of TOWER_IDS) {
      const b = bench();
      // behind the tower, its base 2.8 mm into the dashed square's strip behind the supports: that does not count
      b.place(RED, at(t, -55));
      b.tick();
      assert.equal(b.tower(t).detail, sheet.none(t), `${t}: behind the tower`);
      b.place(RED, at(t, -44));
      b.tick();
      assert.deepEqual(b.said, [say.fromTheBack(t)], t);
      assert.equal(b.referee.stayOf(RED)?.throughOpening, false);
      b.place(RED, at(t, 0));
      b.ticks(3);
      assert.deepEqual(b.log, [say.fromTheBack(t)], t);
      assert.equal(b.flap(t).label, '', t);
      assert.equal(b.tower(t).points, 0, t);
      assert.equal(b.tower(t).detail, sheet.fromTheBack(t), t);
      b.end();
      assert.equal(b.tower(t).detail, sheet.fromTheBack(t), `${t} closed`);
    }
  });

  test('a cube taken fully out of the space between the supports and pushed in again through the opening: a new stay, a new delivery', () => {
    const b = bench();
    b.place(RED, at('E', -44));
    b.tick();
    assert.deepEqual(b.said, [say.fromTheBack('E')]);
    // out (its base 0.1 mm clear of the gap), then in again through the opening
    b.place(RED, at('E', -45.1));
    b.tick();
    assert.equal(b.referee.stayOf(RED), undefined);
    b.pushIn(RED, 'E');
    assert.deepEqual(b.log, [say.fromTheBack('E'), say.redUnder('E')]);
    assert.equal(b.tower('E').points, 20);
  });

  test('touching is not overlapping: a cube whose base touches the space between the supports is not in the tower', () => {
    const b = bench();
    // M opens to the top: the cube's bottom face on the top face of the gap (the supports' fronts)
    const touching = TOWER_MIDDLES.M.y - TOWER_DEPTH / 2 - CUBE_SIZE / 2;
    b.place(RED, { x: TOWER_MIDDLES.M.x, y: touching });
    b.tick();
    assert.equal(b.referee.stayOf(RED), undefined);
    b.place(RED, { x: TOWER_MIDDLES.M.x, y: touching + 0.01 });
    b.tick();
    assert.equal(b.referee.stayOf(RED)?.tower, 'M');
    assert.equal(b.referee.stayOf(RED)?.throughOpening, true);
  });

  test('the entrance: a cube that only reaches into the dashed square in front of the supports needs to go farther in', () => {
    const b = bench();
    // its base 2 mm inside the dashed square's outer edge, not between the supports
    b.place(RED, at('A', 25 + LETTER_AREA.A.h / 2 - 2));
    b.tick();
    assert.equal(b.referee.stayOf(RED), undefined);
    assert.equal(b.tower('A').detail, sheet.entrance('A'));
    b.end();
    assert.equal(b.tower('A').detail, sheet.entranceClosed('A'));
  });

  test('the robot touching the cube: no delivery yet; it counts once the robot has moved clear (0.5 mm)', () => {
    const b = bench();
    b.place(RED, at('M', 44));
    b.tick();
    b.robotAt(clawAbove(at('M', 0)));
    closeClaw(b);
    b.place(RED, at('M', 0));
    b.tick();
    assert.equal(b.flap('M').label, 'M', 'the letter shows');
    assert.deepEqual(b.said, []);
    assert.equal(b.tower('M').detail, sheet.touches('M'));
    assert.equal(b.tower('M').points, 0);
    // 0.4 mm away: still touching
    b.robotAt(clawAbove(at('M', 0), 0.4));
    b.tick();
    assert.equal(b.tower('M').detail, sheet.touches('M'));
    // 0.6 mm away: clear - the delivery is now
    b.robotAt(clawAbove(at('M', 0), 0.6));
    b.tick();
    assert.deepEqual(b.said, [say.redUnder('M')]);
    assert.equal(b.tower('M').time, 0.04);
    // back against it, and away again: the same stay, no new delivery, still 20 (judged at the end)
    b.robotAt(clawAbove(at('M', 0)));
    b.tick();
    assert.equal(b.tower('M').detail, sheet.touches('M'));
    b.robotAt(START_POSE);
    b.tick();
    assert.deepEqual(b.log, [say.redUnder('M')]);
    assert.equal(b.tower('M').points, 20);
    assert.equal(b.tower('M').time, 0.04);
  });

  test('the robot still touching the cube when the match ends: it does not count', () => {
    const b = bench();
    b.place(RED, at('K', 44));
    b.tick();
    b.robotAt({ ...clawAbove(at('K', 0)), y: at('K', 0).y + CUBE_SIZE / 2 + 167, heading: 0 });
    closeClaw(b);
    b.place(RED, at('K', 0));
    b.tick();
    assert.equal(b.tower('K').detail, sheet.touches('K'));
    b.end();
    assert.equal(b.tower('K').detail, sheet.touched('K'));
    assert.equal(b.tower('K').points, 0);
    assert.deepEqual(b.referee.deliveries(), []);
  });

  test('a cube of the wrong colour makes the letter show, but scores nothing: yellow under M, red under X', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'M');
    b.pushIn(RED, 'X');
    assert.deepEqual(b.log, [say.collected, say.yellowUnderWrong('M'), say.notDirect, say.redUnderX]);
    assert.equal(b.flap('M').label, 'M');
    assert.equal(b.flap('X').label, 'X');
    assert.equal(b.tower('M').detail, sheet.yellowAtRed('M'));
    assert.equal(b.tower('X').detail, sheet.redAtX);
    assert.equal(b.score().total, 0);
    // the same words on the closed sheet: they describe the field
    b.end();
    assert.equal(b.tower('M').detail, sheet.yellowAtRed('M'));
    assert.equal(b.tower('X').detail, sheet.redAtX);
  });

  test('two cubes at one tower: only one fits the dashed square; without a letter the sheet speaks of the one nearest the middle', () => {
    const b = bench();
    // one cube 8 mm too far in (no letter), a second one at the entrance
    b.pushIn(RED, 'X', -8);
    b.place(RED_2, at('X', 25 + LETTER_AREA.X.h / 2 - 1));
    b.tick();
    assert.equal(b.flap('X').label, '');
    assert.equal(b.tower('X').detail, sheet.tooFar('X'));
    // the first one 30 mm too far in, the second one in, 25 mm short (55 mm apart): about the second one
    b.place(RED, at('X', -30));
    b.place(RED_2, at('X', 25));
    b.tick();
    assert.equal(b.referee.stayOf(RED_2)?.tower, 'X');
    assert.equal(b.tower('X').detail, sheet.entrance('X'));
  });

  test('the flap follows a tower that slides, and the letter goes when the cube is pulled out', () => {
    const b = bench();
    b.pushIn(RED, 'E');
    assert.equal(b.flap('E').label, 'E');
    // the tower slid 3 mm to the right and 4 mm down, with the cube
    b.slide('E', 3, 4);
    b.place(RED, { x: at('E', 0).x + 3, y: at('E', 0).y + 4 });
    b.tick();
    assert.equal(b.flap('E').x, TOWER_MIDDLES.E.x + 3);
    assert.equal(b.flap('E').y, TOWER_MIDDLES.E.y + 4);
    assert.equal(b.flap('E').label, 'E');
    assert.equal(b.tower('E').points, 20);
    // the cube pulled 9 mm back out towards the opening: the letter is hidden again
    b.place(RED, { x: at('E', 0).x + 3, y: at('E', 9).y + 4 });
    b.tick();
    assert.equal(b.flap('E').label, '');
    assert.equal(b.flap('E').fill, PLYWOOD_FILL);
    assert.equal(b.tower('E').detail, sheet.entrance('E'));
  });

  test('a cube on the table strip outside the mat is judged like any other place: tower E slid half off the mat still takes one', () => {
    const b = bench();
    // E slid 120 mm to the left: its base reaches 42.6 mm over the mat's edge and still touches the park picture
    b.slide('E', -120, 0);
    b.tick();
    assert.equal(b.line(LINE_TOWERS_MOVED).detail, sheet.allOn);
    const middle = at('E', 0);
    b.place(RED, { x: middle.x - 120, y: middle.y + 44 });
    b.tick();
    b.place(RED, { x: middle.x - 120, y: middle.y });
    b.tick();
    assert.ok(b.body(RED).x - CUBE_SIZE / 2 < 0, 'the cube stands partly on the table');
    assert.deepEqual(b.said, [say.redUnder('E')]);
    assert.equal(b.tower('E').points, 20);
    // a cube alone on the table strip is no cube under any tower
    b.place(RED_2, { x: -40, y: 600 });
    b.tick();
    for (const t of ['M', 'A', 'K', 'X'] as const) assert.equal(b.tower(t).detail, sheet.none(t));
  });

  test('a tower pushed from behind slides over its cube: the cube is too far in', () => {
    const b = bench();
    b.pushIn(RED, 'A');
    assert.equal(b.tower('A').points, 20);
    // A opens to the top: pushed from behind, it slides 8 mm up over the cube, which stays
    b.slide('A', 0, -8);
    b.tick();
    assert.equal(b.tower('A').detail, sheet.tooFar('A'));
    assert.equal(b.tower('A').points, 0);
  });
});

// =============================================================================================
// The yellow rule (design 6.1, 6.3)
// =============================================================================================

describe('the yellow rule: X must be the next delivery once the robot has taken the yellow cube', () => {
  test('collected by the claw: said once; the status line says X must come next until it is decided', () => {
    const b = bench();
    b.tick();
    assert.equal(b.score().now, undefined);
    b.hold(YELLOW);
    b.tick();
    assert.deepEqual(b.said, [say.collected]);
    assert.equal(b.referee.yellowRule().collectedAt, 0.02);
    assert.equal(b.score().now, NOW);
    b.letGo();
    b.ticks(3);
    assert.deepEqual(b.log, [say.collected]);
    assert.equal(b.score().now, NOW);
    b.pushIn(YELLOW, 'X');
    assert.deepEqual(b.log, [say.collected, say.yellowUnderX]);
    assert.equal(b.score().now, undefined);
    assert.equal(b.referee.yellowRule().direct, 'yes');
    assert.equal(b.tower('X').detail, sheet.scoresX);
    assert.equal(b.tower('X').points, 20);
    // after the end the status line is gone
    b.end();
    assert.equal(b.score().now, undefined);
  });

  test('collected by a push: the moment its middle leaves its red square (the edge of the square counts as inside)', () => {
    const b = bench();
    b.place(YELLOW, { x: CUBE_HOMES.yellow.x, y: YELLOW_SQUARE.y });
    b.tick();
    assert.equal(b.referee.yellowRule().collectedAt, null, 'on the edge: still on its square');
    b.place(YELLOW, { x: CUBE_HOMES.yellow.x, y: YELLOW_SQUARE.y - 0.01 });
    b.tick();
    assert.deepEqual(b.said, [say.collected]);
    assert.equal(b.referee.yellowRule().collectedAt, 0.02);
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('X').points, 20);
  });

  test('yellow put down off its square, then a red cube delivered, then yellow to X: X scores nothing, the sheet names the red cube and the time', () => {
    const b = bench();
    b.place(YELLOW, { x: 430, y: 800 });
    b.tick();
    b.ticks(100);
    b.pushIn(RED, 'M');
    assert.deepEqual(b.said, [say.redUnder('M'), say.notDirect]);
    b.pushIn(YELLOW, 'X');
    assert.deepEqual(b.said, [say.yellowUnderX]);
    assert.equal(b.referee.yellowRule().direct, 'no');
    assert.deepEqual(b.referee.yellowRule().decidedBy, { cube: RED, tower: 'M', time: 1.03 });
    assert.equal(b.tower('X').detail, sheet.notNext('a red cube', 'M', '0:01.0'));
    assert.equal(b.tower('X').points, 0);
    assert.equal(b.tower('M').points, 20);
    assert.equal(b.score().total, 20);
    assert.deepEqual(b.log, [say.collected, say.redUnder('M'), say.notDirect, say.yellowUnderX]);
  });

  test('yellow under K first, then under X: the yellow cube at K was the next delivery - K and X score nothing', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.ticks(4100);
    b.pushIn(YELLOW, 'K');
    b.takeOut(YELLOW);
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('K').detail, sheet.none('K'));
    assert.equal(b.tower('X').detail, sheet.notNext('the yellow cube', 'K', '0:41.0'));
    assert.equal(b.score().total, 0);
    b.end();
    assert.equal(b.tower('X').detail, sheet.notNext('the yellow cube', 'K', '0:41.0'));
    assert.deepEqual(b.log, [say.collected, say.yellowUnderWrong('K'), say.notDirect, say.yellowUnderX]);
  });

  test('red cubes delivered before the yellow cube is taken do not matter: X scores', () => {
    const b = bench();
    b.pushIn(RED, 'M');
    b.pushIn(RED_2, 'E');
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('X').points, 20);
    assert.equal(b.score().total, 60);
    assert.deepEqual(b.log, [say.redUnder('M'), say.redUnder('E'), say.collected, say.yellowUnderX]);
  });

  test('a red cube delivered before the collection, touched by the robot after it (Y8): no new delivery - X still scores', () => {
    const b = bench();
    b.pushIn(RED, 'M');
    b.hold(YELLOW);
    b.tick();
    // the robot touches the red cube under M with its claw, and moves on
    b.robotAt(clawAbove(at('M', 0)));
    closeClaw(b);
    b.tick();
    assert.equal(b.tower('M').detail, sheet.touches('M'));
    b.robotAt(START_POSE);
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('X').points, 20);
    assert.equal(b.tower('M').points, 20);
    assert.deepEqual(b.log, [say.redUnder('M'), say.collected, say.yellowUnderX]);
  });

  test('... or nudged 8 mm out of the dashed square and back, still between the supports (Y7): the same stay - X still scores', () => {
    const b = bench();
    b.pushIn(RED, 'M');
    b.hold(YELLOW);
    b.tick();
    b.place(RED, at('M', 8));
    b.tick();
    assert.equal(b.flap('M').label, '');
    assert.equal(b.referee.stayOf(RED)?.tower, 'M');
    b.place(RED, at('M', 0));
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('X').points, 20);
    assert.deepEqual(b.log, [say.redUnder('M'), say.collected, say.yellowUnderX]);
  });

  test('... but taken fully out of tower M and pushed back in before X: a new delivery - X scores nothing', () => {
    const b = bench();
    b.pushIn(RED, 'M');
    b.hold(YELLOW);
    b.tick();
    b.place(RED, at('M', 60));
    b.tick();
    b.pushIn(RED, 'M');
    b.letGo();
    b.pushIn(YELLOW, 'X');
    assert.equal(b.tower('X').points, 0);
    assert.equal(b.tower('X').detail, sheet.notNext('a red cube', 'M', '0:00.0'));
    assert.deepEqual(b.log, [say.redUnder('M'), say.collected, say.redUnder('M'), say.notDirect, say.yellowUnderX]);
  });

  test('the yellow cube into the back of X: no letter, said once, X scores nothing', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.place(YELLOW, at('X', -44));
    b.tick();
    b.place(YELLOW, at('X', 0));
    b.ticks(2);
    assert.deepEqual(b.log, [say.collected, say.fromTheBack('X')]);
    assert.equal(b.tower('X').detail, sheet.fromTheBack('X'));
    assert.equal(b.referee.yellowRule().direct, 'unknown');
    assert.equal(b.score().now, NOW);
  });

  test('yellow at X as the next delivery, later pushed out of the dashed square and back in: still the next delivery, judged at the end', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'X');
    b.pushIn(RED, 'M');
    b.place(YELLOW, at('X', 10));
    b.tick();
    assert.equal(b.tower('X').detail, sheet.entrance('X'));
    b.place(YELLOW, at('X', 0));
    b.tick();
    b.end();
    assert.equal(b.tower('X').points, 20);
    assert.equal(b.tower('X').detail, sheet.scoresX);
    assert.equal(b.score().total, 40);
  });

  test('yellow at X with the robot still touching it at the end: nothing delivered, the rule stays undecided, X scores nothing', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.place(YELLOW, at('X', 44));
    b.tick();
    b.robotAt(clawAbove(at('X', 0)));
    closeClaw(b);
    b.place(YELLOW, at('X', 0));
    b.tick();
    b.end();
    assert.equal(b.tower('X').detail, sheet.touched('X'));
    assert.equal(b.referee.yellowRule().direct, 'unknown');
    assert.equal(b.score().total, 0);
  });

  test('two deliveries on one tick: the yellow cube at X is looked at first', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.place(YELLOW, at('X', 44));
    b.place(RED, at('M', 44));
    b.tick();
    b.place(YELLOW, at('X', 0));
    b.place(RED, at('M', 0));
    b.tick();
    assert.deepEqual(b.said, [say.yellowUnderX, say.redUnder('M')]);
    assert.equal(b.referee.yellowRule().direct, 'yes');
    assert.equal(b.score().total, 40);
  });

  test('the mission complete: 100 points, every line done', () => {
    const b = bench();
    b.hold(YELLOW);
    b.tick();
    b.letGo();
    b.pushIn(YELLOW, 'X');
    b.pushIn(RED, 'M');
    b.pushIn(RED_2, 'A');
    b.pushIn(RED_3, 'K');
    b.pushIn(cubeId('red-right-lower'), 'E');
    const report = b.score();
    assert.equal(report.total, 100);
    assert.equal(report.complete, true);
    assert.deepEqual(
      report.lines.map((l) => l.detail),
      [sheet.scores('M'), sheet.scores('A'), sheet.scores('K'), sheet.scores('E'), sheet.scoresX, sheet.allOn],
    );
    assert.deepEqual(
      report.lines.map((l) => l.time),
      [0.05, 0.07, 0.09, 0.11, 0.03, undefined],
    );
    // no early end: the referee never ends the match
    assert.equal(b.call?.end, undefined);
    b.end();
    assert.equal(b.score().total, 100);
  });
});

// =============================================================================================
// Towers off their picture squares (rules §7.2)
// =============================================================================================

describe('a tower off its picture square: 0 for it and 4 points off, once per tower, judged at the end', () => {
  /** How far K must slide up for its base to only touch the bakery picture (the picture's top edge is at y 13.214). */
  const K_OFF = TOWER_MIDDLES.K.y + TOWER_DEPTH / 2 - TILES.bakery.y;

  test('touching the edge of the square counts; past it the tower is off, and the console says so once', () => {
    const b = bench();
    b.slide('K', 0, -K_OFF);
    b.tick();
    assert.deepEqual(b.said, []);
    assert.equal(b.line(LINE_TOWERS_MOVED).detail, sheet.allOn);
    b.slide('K', 0, -K_OFF - 0.01);
    b.tick();
    assert.deepEqual(b.said, [say.offPicture('K')]);
    assert.equal(b.tower('K').detail, sheet.pushedOff('K'));
    const moved = b.line(LINE_TOWERS_MOVED);
    assert.equal(moved.points, -4);
    assert.equal(moved.ok, false);
    assert.equal(moved.detail, 'Moved off its picture square: K (4 points).');
    assert.equal(b.score().total, 0);
    // back on its square before the end: no penalty (judged at the end); off again: not said again
    b.slide('K', 0, 0);
    b.tick();
    assert.equal(b.line(LINE_TOWERS_MOVED).points, 0);
    b.slide('K', 0, -200);
    b.tick();
    assert.deepEqual(b.log, [say.offPicture('K')]);
  });

  test('two towers off: 8 points off, listed in the order of the sheet', () => {
    const b = bench();
    b.slide('K', 0, -200);
    b.slide('A', 300, 0);
    b.tick();
    assert.deepEqual(b.said, [say.offPicture('A'), say.offPicture('K')]);
    const moved = b.line(LINE_TOWERS_MOVED);
    assert.equal(moved.points, -8);
    assert.equal(moved.detail, 'Moved off their picture squares: A, K (4 points each).');
  });

  test('a tower off its square with a correct cube under it: 0 for it, and 4 off; a moved tower still on its square keeps its 20', () => {
    const b = bench();
    b.pushIn(RED, 'M');
    b.pushIn(RED_2, 'E');
    // M slid 150 mm to the right with its cube: still on the school picture (its base from x 225.8)
    b.slide('M', 150, 0);
    b.place(RED, { x: at('M', 0).x + 150, y: at('M', 0).y });
    // E slid 250 mm to the right with its cube: off the park picture
    b.slide('E', 250, 0);
    b.place(RED_2, { x: at('E', 0).x + 250, y: at('E', 0).y });
    b.tick();
    assert.equal(b.tower('M').points, 20);
    assert.equal(b.tower('M').detail, sheet.scores('M'));
    assert.equal(b.tower('E').points, 0);
    assert.equal(b.tower('E').detail, sheet.pushedOff('E'));
    assert.equal(b.score().total, 20 - 4);
  });

  test('the total is never below 0: five towers off and no cube', () => {
    const b = bench();
    for (const t of TOWER_IDS) b.slide(t, 0, 300);
    b.tick();
    const report = b.score();
    assert.equal(report.lines[5].points, -20);
    assert.equal(report.lines[5].detail, 'Moved off their picture squares: M, A, K, E, X (4 points each).');
    assert.equal(report.total, 0);
  });
});

// =============================================================================================
// The end of a match
// =============================================================================================

test('the end: the referee keeps the field as it was at the last moment - what touched the robot, what was held, where it stood', () => {
  const b = bench();
  b.pushIn(RED, 'K');
  b.pushIn(RED_2, 'M');
  // on the last tick the robot touches the cube under K (delivered before) and holds the yellow cube in X
  b.robotAt({ x: at('K', 0).x, y: at('K', 0).y + CUBE_SIZE / 2 + 167, heading: 0 });
  closeClaw(b);
  b.place(YELLOW, at('X', 30));
  b.hold(YELLOW);
  b.tick();
  b.end();
  // what the engine does after the end (the motors stop, things settle) changes nothing on the sheet
  b.robotAt(START_POSE);
  b.letGo();
  b.place(YELLOW, at('X', 0));
  b.slide('E', 0, 400);
  assert.equal(b.tower('K').detail, sheet.touched('K'));
  assert.equal(b.tower('M').detail, sheet.scores('M'));
  assert.equal(b.tower('X').detail, sheet.held('X'));
  assert.equal(b.tower('E').detail, sheet.none('E'));
  assert.equal(b.line(LINE_TOWERS_MOVED).detail, sheet.allOn);
  assert.equal(b.score().total, 20);
  // and the flaps stay as they were
  assert.equal(b.flap('K').label, 'K');
  assert.equal(b.flap('X').label, '');
});

test('the end, with the robot touching the cube on its last tick: it was never delivered and does not count', () => {
  const b = bench();
  b.place(RED, at('K', 44));
  b.tick();
  b.place(RED, at('K', 0));
  b.robotAt({ x: at('K', 0).x, y: at('K', 0).y + CUBE_SIZE / 2 + 167, heading: 0 });
  closeClaw(b);
  b.tick();
  b.end();
  b.robotAt(START_POSE);
  assert.equal(b.tower('K').detail, sheet.touched('K'));
  assert.equal(b.score().total, 0);
});

test('clock: the match time as the sheet writes it, tenths cut off', () => {
  assert.equal(clock(0), '0:00.0');
  assert.equal(clock(41.27), '0:41.2');
  assert.equal(clock(59.99), '0:59.9');
  assert.equal(clock(60), '1:00.0');
  assert.equal(clock(179.99), '2:59.9');
});

// =============================================================================================
// In the real engine, with a scripted robot
// =============================================================================================

const CLAW = 'S2';
function* closeIt(io: RobotIO): Generator<void, void, void> {
  io.setServo(CLAW, 60);
  yield;
  yield* waitUntil(() => io.servoDone(CLAW));
}
function* openIt(io: RobotIO): Generator<void, void, void> {
  io.setServo(CLAW, 0);
  yield;
  yield* waitUntil(() => io.servoDone(CLAW));
}

/** The game with some cubes put somewhere else at the start (x, y; turned by `deg` degrees). */
function gameWith(moves: Record<string, { x: number; y: number; deg?: number }>): Game<FireFighterScenario> {
  return {
    ...fireFighterGame,
    createBodies: (s) =>
      fireFighterGame.createBodies(s).map((body) => {
        const m = moves[body.id];
        if (!m) return body;
        const angle = ((m.deg ?? 0) * Math.PI) / 180;
        return { ...body, x: m.x, y: m.y, angle, home: { ...body.home, x: m.x, y: m.y, angle } };
      }),
  };
}

/** Play a scripted robot to its end (or 30 s); what the referee said. */
function play(game: Game<FireFighterScenario>, start: Pose, script: Script): { sim: Simulation<FireFighterScenario>; said: string[] } {
  const sim = createEngineSimulation({ game, scenario: RULES_SETUP, program: {}, startPose: start }, scripted(script).factory);
  sim.start();
  const said: string[] = [];
  for (let i = 0; i < 3000 && sim.status === 'running'; i++) {
    sim.step(1);
    for (const e of sim.drainEvents()) if (e.type === 'log' && e.level === 'info') said.push(e.text);
  }
  if (sim.status === 'running') sim.declareFinished();
  return { sim, said };
}

const X_MIDDLE = SQUARE_MIDDLES.X;
const X_FACE = TOWER_MIDDLES.X.y - TOWER_DEPTH / 2;

/**
 * The delivery of the examples, at X from the top: the robot faces down with the yellow cube in its
 * claw, its path `off` mm right of X's middle; it lets go 2 mm before the tower, backs off `back`
 * mm, closes the claw and pushes the cube `extra` mm past the middle of the square, then backs off
 * 60 mm (unless `stay`).
 */
function slideIntoX(off: number, rpm: number, options: { back?: number; extra?: number; stay?: boolean } = {}) {
  const back = options.back ?? 55;
  const axleY = X_FACE - 280;
  const game = gameWith({ [YELLOW]: { x: X_MIDDLE.x + off, y: axleY + 142 } });
  return play(game, { x: X_MIDDLE.x + off, y: axleY, heading: DOWN }, function* (io) {
    yield* closeIt(io);
    yield* drive(io, X_FACE - 2 - (axleY + 167), 40);
    yield* openIt(io);
    yield* drive(io, -back, 40);
    yield* closeIt(io);
    yield* drive(io, back - CUBE_SIZE + (X_MIDDLE.y - (X_FACE - 2 - 25)) + (options.extra ?? 0), rpm);
    if (!options.stay) yield* drive(io, -60, 40);
  });
}

const xLine = (sim: Simulation<FireFighterScenario>): ScoreLine => sim.score().lines.find((l) => l.id === 'tower-X') as ScoreLine;
const slid = (sim: Simulation<FireFighterScenario>, t: TowerId = 'X'): number => Math.hypot(towerShift(t, sim.world.bodies).x, towerShift(t, sim.world.bodies).y);

describe('in the engine', () => {
  test('the yellow cube let go before X and pushed in with the closed claw: the letter shows; along the hydrant stem too (3.87 mm off)', () => {
    for (const off of [0, 3.867]) {
      const { sim, said } = slideIntoX(off, 50);
      assert.equal(xLine(sim).detail, sheet.scoresX, `${off}`);
      assert.equal(sim.score().total, 20);
      assert.equal(slid(sim), 0, 'the tower did not move');
      assert.deepEqual(said, [say.collected, say.yellowUnderX]);
      const cube = sim.world.bodies.find((b) => b.id === YELLOW) as Body;
      assert.ok(Math.abs(cube.y - X_MIDDLE.y) < 0.1, `the cube ends on the middle of the square (${cube.y - X_MIDDLE.y})`);
    }
  });

  test('sideways the cube has 5 mm on each side: 5.00 mm off it goes in, 5.05 mm off it catches a support and pushes the tower away - at any speed', () => {
    for (const rpm of [10, 20, 50, 100]) {
      for (const off of [5, -5]) {
        const { sim } = slideIntoX(off, rpm);
        assert.equal(xLine(sim).points, 20, `${off} mm at ${rpm} RPM`);
        assert.equal(slid(sim), 0, `${off} mm at ${rpm} RPM`);
      }
      for (const off of [5.05, -5.05]) {
        const { sim } = slideIntoX(off, rpm);
        assert.equal(xLine(sim).points, 0, `${off} mm at ${rpm} RPM`);
        assert.ok(Math.abs(slid(sim) - 45.02) < 0.05, `${off} mm at ${rpm} RPM: the tower slid ${slid(sim)} mm`);
        assert.ok(Math.abs(towerShift('X', sim.world.bodies).x) < 1e-9, 'pushed straight along, not sideways');
      }
    }
  });

  test('along the opening: pushed 7.5 mm short or too far it scores; 8 mm short "at the entrance", 8 mm too far "too far in"; 40 mm short touches the entrance', () => {
    for (const [extra, points, detail] of [
      [-7.5, 20, sheet.scoresX],
      [7.5, 20, sheet.scoresX],
      [-8, 0, sheet.entranceClosed('X')],
      [8, 0, sheet.tooFar('X')],
      [-40, 0, sheet.entranceClosed('X')],
    ] as const) {
      const { sim } = slideIntoX(0, 20, { extra });
      assert.equal(xLine(sim).points, points, `${extra}`);
      assert.equal(xLine(sim).detail, detail, `${extra}`);
    }
  });

  test('a cube turned at the entrance and pushed straight: 9.5 degrees go in (the tower nudged 3.3 mm sideways), 10 degrees push the tower', () => {
    for (const rpm of [20, 50]) {
      for (const [deg, points] of [
        [9.5, 20],
        [10, 0],
      ] as const) {
        const cubeY = X_FACE - 2 - 25;
        const t = (deg * Math.PI) / 180;
        const reach = 25 * (Math.cos(t) + Math.sin(t));
        const axleY = cubeY - reach - 10 - 167;
        const { sim } = play(gameWith({ [YELLOW]: { x: X_MIDDLE.x, y: cubeY, deg } }), { x: X_MIDDLE.x, y: axleY, heading: DOWN }, function* (io) {
          yield* closeIt(io);
          yield* drive(io, 10 + (X_MIDDLE.y - cubeY) + (reach - 25), rpm);
          yield* drive(io, -60, 40);
        });
        assert.equal(xLine(sim).points, points, `${deg} degrees at ${rpm} RPM`);
        const shift = towerShift('X', sim.world.bodies);
        if (points > 0) {
          assert.ok(Math.abs(shift.x) > 3 && Math.abs(shift.x) < 3.5 && Math.abs(shift.y) < 1e-9, `${deg}: nudged (${shift.x}, ${shift.y})`);
        } else assert.ok(shift.y > 40, `${deg}: pushed (${shift.x}, ${shift.y})`);
        // the two supports stay together and unturned
        const left = sim.world.bodies.find((b) => b.id === supportId('X', 'left')) as Body;
        const right = sim.world.bodies.find((b) => b.id === supportId('X', 'right')) as Body;
        assert.ok(Math.abs(right.x - left.x - (TOWER_GAP + SUPPORT_WIDTH)) < 1e-6 && Math.abs(right.y - left.y) < 1e-6 && left.angle === 0 && right.angle === 0);
      }
    }
  });

  test('let go, back off at least 5 cm, then close: closed sooner, the claw catches the cube again and carries it back out', () => {
    for (const [back, points] of [
      [50, 20],
      [55, 20],
      [49.5, 0],
      [30, 0],
    ] as const) {
      const { sim } = slideIntoX(0, 20, { back });
      assert.equal(xLine(sim).points, points, `back ${back} mm`);
      assert.equal(slid(sim), 0, `back ${back} mm`);
    }
    assert.equal(CUBE_SIZE, 50);
  });

  test('the robot that stays against the cube at the end: it does not count', () => {
    const { sim } = slideIntoX(0, 20, { stay: true });
    assert.equal(xLine(sim).detail, sheet.touched('X'));
    assert.equal(sim.score().total, 0);
  });

  test('the yellow cube pushed straight up from its square into the back of X: no letter, the sentence on the sheet and in the console', () => {
    const start = fireFighterGame.defaultStartPose;
    const back = TOWER_MIDDLES.X.y + TOWER_DEPTH / 2;
    const grab = start.y - 142 - CUBE_HOMES.yellow.y;
    const carry = CUBE_HOMES.yellow.y - 25 - (back + 2);
    const push = 5 + (back + 2 + 25 - X_MIDDLE.y);
    const { sim, said } = play(fireFighterGame, start, function* (io) {
      yield* drive(io, grab, 50);
      yield* closeIt(io);
      yield* drive(io, carry, 50);
      yield* openIt(io);
      yield* drive(io, -55, 50);
      yield* closeIt(io);
      yield* drive(io, push, 30);
      yield* drive(io, -60, 50);
    });
    const cube = sim.world.bodies.find((b) => b.id === YELLOW) as Body;
    assert.ok(Math.abs(cube.y - X_MIDDLE.y) < 0.5, 'the cube stands in the middle of the square');
    assert.equal(xLine(sim).detail, sheet.fromTheBack('X'));
    assert.equal(sim.score().total, 0);
    assert.deepEqual(said, [say.collected, say.fromTheBack('X')]);
    assert.equal(sim.world.props?.find((p) => p.id === 'letter:X')?.label, '');
  });

  test('a red cube pushed under X: the letter shows, but X needs the yellow cube', () => {
    const axleY = X_FACE - 280;
    const { sim, said } = play(gameWith({ [RED]: { x: X_MIDDLE.x, y: axleY + 142 } }), { x: X_MIDDLE.x, y: axleY, heading: DOWN }, function* (io) {
      yield* closeIt(io);
      yield* drive(io, X_FACE - 2 - (axleY + 167), 40);
      yield* openIt(io);
      yield* drive(io, -55, 40);
      yield* closeIt(io);
      yield* drive(io, 5 + (X_MIDDLE.y - (X_FACE - 2 - 25)), 20);
      yield* drive(io, -60, 40);
    });
    assert.equal(xLine(sim).detail, sheet.redAtX);
    assert.deepEqual(said, [say.redUnderX]);
    assert.equal(sim.world.props?.find((p) => p.id === 'letter:X')?.label, 'X');
  });

  test('the robot pushes tower K with its chassis: 100 mm still touches the bakery picture; 160 mm is off it (0 for K, 4 off)', () => {
    for (const [distance, off] of [
      [100, false],
      [160, true],
    ] as const) {
      const K = TOWER_MIDDLES.K;
      const face = K.y + TOWER_DEPTH / 2;
      const { sim, said } = play(fireFighterGame, { x: K.x, y: face + 167 + 30, heading: 0 }, function* (io) {
        yield* closeIt(io);
        yield* drive(io, 30 + 62 + distance, 40);
        yield* drive(io, -40, 40);
      });
      assert.ok(Math.abs(towerShift('K', sim.world.bodies).y + distance) < 0.01, `${distance}: slid ${towerShift('K', sim.world.bodies).y}`);
      const moved = sim.score().lines[5];
      assert.equal(moved.points, off ? -4 : 0, `${distance}`);
      assert.equal(sim.score().lines[2].detail, off ? sheet.pushedOff('K') : sheet.none('K'), `${distance}`);
      assert.deepEqual(said, off ? [say.offPicture('K')] : [], `${distance}`);
      // the flap went with the tower
      const flap = sim.world.props?.find((p) => p.id === 'letter:K') as RefereeProp;
      assert.ok(Math.abs(flap.y - (K.y - distance)) < 0.01);
    }
  });

  test('opening the closed claw 15 mm inside an empty tower pushes the tower 15.7 mm along its opening; its supports stay together and unturned', () => {
    const { sim } = play(fireFighterGame, { x: TOWER_MIDDLES.X.x, y: X_FACE - 167 - 20, heading: DOWN }, function* (io) {
      yield* closeIt(io);
      // the closed claw (36 mm) between the supports, its tips 15 mm past their fronts
      yield* drive(io, 20 + 15, 20);
      yield* openIt(io);
      yield* drive(io, -80, 20);
    });
    const shift = towerShift('X', sim.world.bodies);
    assert.ok(Math.abs(shift.y - 15.72) < 0.01 && Math.abs(shift.x) < 0.5, `the tower was pushed (${shift.x}, ${shift.y})`);
    assert.equal(sim.world.robot.gripper.gap, FIRE_FIGHTER_ROBOT.gripper.clawOpenGap, 'the claw opened all the way');
    const left = sim.world.bodies.find((b) => b.id === supportId('X', 'left')) as Body;
    const right = sim.world.bodies.find((b) => b.id === supportId('X', 'right')) as Body;
    assert.ok(Math.abs(right.x - left.x - (TOWER_GAP + SUPPORT_WIDTH)) < 1e-6 && Math.abs(right.y - left.y) < 1e-6);
    assert.equal(left.angle, 0);
    assert.equal(right.angle, 0);
  });

  test('closing the claw around one support stops against it and moves nothing; a turn with the claw stopped on it drags the tower', () => {
    const left = supportMiddle('X', 'left');
    const start: Pose = { x: left.x, y: X_FACE - 167 - 10, heading: DOWN };
    // the open claw goes round X's left support (22.5 mm between fingers 64 mm apart) and closes
    const closing = play(fireFighterGame, start, function* (io) {
      yield* drive(io, 30, 20);
      io.setServo(CLAW, 60);
      for (let k = 0; k < 80; k++) yield;
    });
    assert.ok(Math.abs(closing.sim.world.robot.gripper.gap - SUPPORT_WIDTH) < 1, `the claw stopped at ${closing.sim.world.robot.gripper.gap} mm`);
    assert.equal(slid(closing.sim), 0);
    // ... then the robot turns 10 degrees: the tower is dragged along, in one piece
    const turning = play(fireFighterGame, start, function* (io) {
      yield* drive(io, 30, 20);
      io.setServo(CLAW, 60);
      for (let k = 0; k < 60; k++) yield;
      yield* turnBy(io, 10, 30);
      yield* drive(io, -60, 20);
    });
    const shift = towerShift('X', turning.sim.world.bodies);
    assert.ok(Math.abs(shift.x + 22.07) < 0.05 && Math.abs(shift.y - 20.66) < 0.05, `dragged (${shift.x}, ${shift.y})`);
  });

  test('the referee looks at the last tick of the match: a cube delivered on it counts; the end is judged before the motors stop', () => {
    // the program ends with the robot clear of the cube: delivered on the tick it moves clear
    const { sim } = slideIntoX(0, 20);
    const line = xLine(sim);
    assert.equal(line.points, 20);
    assert.ok((line.time ?? 0) > 0 && (line.time ?? 0) < sim.world.time);
    assert.equal(sim.finishReason, 'program-ended');
  });
});
