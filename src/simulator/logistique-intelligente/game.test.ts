/**
 * The Logistique intelligente referee (the design's section 6): every line of the score sheet and
 * every sentence of the console, word for word; the cases a - l of the table 6.3 (h1 - h6 each)
 * and their edges (covering to the hundredth of a millimetre, the turn, the diamonds, touching the
 * robot, cubes that touch side to side, face to face, or only along an edge); R18 and R19; the
 * total, its floor, its maximum; the end of a match.
 *
 * The field is put together by hand - a cube here, a pair there, the robot touching a cube or far
 * away - and the referee is asked directly, tick by tick: that way each edge is exact. The game's
 * elements, walls and zones are checked first. (The whole chain with the engine moving the robot
 * is in ./integration.test.ts.)
 *
 * The expected sentences are written out here from the design (6.3 - 6.5), never taken from the
 * code.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createEngineSimulation } from '../core/engine';
import { robotShapesAt } from '../core/robot';
import { forever, scripted } from '../core/test-helpers';
import type { Body, FinishReason, Pose, RefereeCall, RGB, ScoreContext, ScoreLine, ScoreReport } from '../core/types';
import { BAND_BLUE, BAND_RED, CUBE_SIZE, FRAME_HEIGHT, GREY, MAT_VECTOR, START_BLUE, START_RED, START_AREA, STORAGE_BOX, STORAGE_OUTLINE, WAREHOUSES, warehouseCorners, warehouseFrame, type WarehouseId } from './field';
import {
  CUBE_COUNT,
  CUBE_FILL,
  CUBE_IDS,
  FRAME_FILL,
  FRAME_IDS,
  KIND_CUBE,
  LEAVE_MM,
  LINE_FAULTS,
  LOGISTIQUE_GAME_TITLE,
  LOGISTIQUE_ID,
  MATCH_DURATION,
  MAX_PER_WAREHOUSE,
  MAX_SCORE,
  ON_MAT_MM,
  POINTS_PER_CUBE,
  TOUCH_MM,
  VIOLATION_POINTS,
  clock,
  createLogistiqueReferee,
  cubeId,
  cubeNumber,
  cubeStart,
  cubesTouch,
  judgeCubes,
  logistiqueGame,
  type LogistiqueReferee,
} from './game';
import { LOGISTIQUE_ROBOT, START_POSE } from './robot';
import { RULES_SETUP, type LogistiqueScenario } from './scenario';

const ROBOT = LOGISTIQUE_ROBOT;
const G = ROBOT.gripper;
type Ctx = ScoreContext<LogistiqueScenario>;
const NB = ' ';
const UP = 0;
const DOWN = Math.PI;
const DEG = Math.PI / 180;

// =============================================================================================
// The sentences of the design (6.3 - 6.5), written out
// =============================================================================================

const sheet = {
  a: 'Dans la pince du robot.',
  b: (w: string): string => `Couvre l’entrepôt ${w}, mais touche le robot.`,
  c: (w: string): string => `Couvre tout l’entrepôt ${w} et touche le tapis.`,
  d: (w: string): string => `Couvre seulement une partie de l’entrepôt ${w}.`,
  e: 'Dans la zone de stockage.',
  f: 'Ne couvre aucun entrepôt.',
  g: (m: number): string => `Posé sur le cube ${m}, mais touche le robot.`,
  h1: (m: number): string => `Posé sur le cube ${m}, que la pince tient.`,
  h2: (m: number): string => `Dans la zone de stockage, sur le cube ${m}.`,
  h3: (w: string): string => `Troisième cube de la pile de l’entrepôt ${w}${NB}: un entrepôt compte au plus deux cubes valides.`,
  h4: (m: number): string => `Posé sur le cube ${m}, qui touche le robot.`,
  h5: (m: number): string => `Posé sur le cube ${m}, qui ne couvre pas tout un entrepôt.`,
  h6: (m: number): string => `Posé sur le cube ${m}, qui ne compte pas.`,
  i: (m: number, p: number): string => `Posé sur le cube ${m}, mais touche aussi le cube ${p}.`,
  j: (w: string): string => `Déjà deux cubes valides dans l’entrepôt ${w}.`,
  k: (m: number, w: string): string => `Posé sur le cube ${m}, qui couvre tout l’entrepôt ${w}.`,
  l: 'Ne touche pas le tapis.',
  removed: (time: string): string => `Sorti du terrain à ${time}${NB}: l’arbitre l’a enlevé.`,
};
const faults = {
  label: 'Robot sorti du terrain',
  none: 'Le robot est resté sur le terrain.',
  once: (time: string): string => `Une fois, à ${time}${NB}: -20${NB}points.`,
  many: (n: number, times: string[]): string => `${n} fois (${times.join(`${NB}; `)})${NB}: -20${NB}points chacune.`,
};
const say = {
  cubeOut: (n: number, time: string): string => `Le cube ${n} sort du terrain à ${time}${NB}: vu de dessus, il passe au-dessus du cadre. L’arbitre l’enlève${NB}: il ne rapporte plus rien.`,
  robotOut: (time: string): string => `Faute à ${time}${NB}: le robot sort du terrain (vu de dessus, il passe au-dessus du cadre). -20${NB}points.`,
  fell: (n: number, m: number): string => `Le cube ${n} est tombé du cube ${m}.`,
};

// =============================================================================================
// A field put together by hand
// =============================================================================================

const E = (w: WarehouseId): { x: number; y: number } => WAREHOUSES[w].centre;

/** A field with the real bodies and the real robot state (the engine does not run), and a referee of its own asked tick by tick. */
function bench() {
  const sim = createEngineSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: {} }, scripted(forever).factory);
  const world = sim.world;
  const referee = createLogistiqueReferee(RULES_SETUP) as LogistiqueReferee;
  const ctx = (): Ctx => ({ scenario: RULES_SETUP, world, robotConfig: ROBOT, restarts: 0, robotShapes: robotShapesAt(ROBOT, world.robot.pose, world.robot.gripper.gap) });
  const body = (n: number): Body => {
    const found = world.bodies.find((b) => b.id === cubeId(n));
    assert.ok(found, `cube ${n}`);
    return found;
  };
  const b = {
    world,
    referee,
    body,
    ctx,
    /** what the referee said on the last tick, and everything it said so far */
    said: [] as string[],
    log: [] as string[],
    call: null as RefereeCall | null,
    /** what the referee answered on the last tick (a function: the tests' narrowing of `call` does not see the ticks) */
    lastCall: (): RefereeCall | null => b.call,
    robotAt(pose: Pose) {
      Object.assign(world.robot.pose, pose);
    },
    /** the claw's underside `height` mm above the mat, its fingers `gap` mm apart */
    claw(height: number, gap: number = G.clawOpenGap) {
      world.robot.gripper.height = height;
      world.robot.gripper.gap = gap;
    },
    /** put cube n down on the mat with its middle at (x, y) */
    place(n: number, p: { x: number; y: number }, angle = 0) {
      Object.assign(body(n), { x: p.x, y: p.y, angle, z: 0, held: false, restingOn: null });
      if (world.robot.gripper.holding === cubeId(n)) world.robot.gripper.holding = null;
    },
    /** put cube n on cube m, `dx`, `dy` mm off its middle */
    stack(n: number, m: number, dx = 0, dy = 0) {
      const under = body(m);
      Object.assign(body(n), { x: under.x + dx, y: under.y + dy, angle: under.angle, z: under.z + under.h, held: false, restingOn: cubeId(m) });
    },
    /** cube n and cube n + 5 as a pair, the lower one on the mat at (x, y) */
    pair(n: number, p: { x: number; y: number }, angle = 0) {
      b.place(n, p, angle);
      b.stack(n + 5, n);
    },
    /** the gripper holds cube n where it stands, its base `z` mm above the mat */
    hold(n: number, z = 0) {
      Object.assign(body(n), { z, held: true, restingOn: null });
      world.robot.gripper.holding = cubeId(n);
    },
    /** cube n lies far away, out of every warehouse and of the cross, on the mat */
    away(n: number) {
      b.place(n, { x: 300 + 60 * ((n - 1) % 5), y: 700 + 60 * Math.floor((n - 1) / 5) });
    },
    /** the cube is taken off the field (as the engine does after R18) */
    takeOff(n: number) {
      const i = world.bodies.findIndex((x) => x.id === cubeId(n));
      world.bodies.splice(i, 1);
      for (const x of world.bodies) if (x.restingOn === cubeId(n)) Object.assign(x, { restingOn: null, z: 0 });
    },
    /** the referee looks at one tick (the next 1/100 s) */
    tick() {
      world.tick++;
      world.time = world.tick / 100;
      b.call = referee.observe(ctx());
      b.said = b.call?.say ?? [];
      b.log.push(...b.said);
    },
    /** jump to `seconds` of the match (the referee looks at that tick) */
    at(seconds: number) {
      world.tick = Math.round(seconds * 100) - 1;
      b.tick();
    },
    end(reason: FinishReason = 'time') {
      referee.finished?.(ctx(), reason);
    },
    score(): ScoreReport {
      return referee.score(ctx());
    },
    line(n: number): ScoreLine {
      const line = referee.score(ctx()).lines.find((l) => l.id === cubeId(n));
      assert.ok(line, `line of cube ${n}`);
      return line;
    },
    detail: (n: number): string => b.line(n).detail,
    faultsLine(): ScoreLine {
      const line = referee.score(ctx()).lines.find((l) => l.id === LINE_FAULTS);
      assert.ok(line, 'the faults line');
      return line;
    },
  };
  // the robot far from every cube: in the start area
  b.robotAt(START_POSE);
  b.claw(G.liftDownHeight);
  referee.begin?.(ctx());
  return b;
}
type Bench = ReturnType<typeof bench>;

/** Every cube away from the cross and the warehouses, but those the test places. */
function clear(b: Bench, ...keep: number[]): void {
  for (let n = 1; n <= CUBE_COUNT; n++) if (!keep.includes(n)) b.away(n);
  b.referee.begin?.(b.ctx());
}

/** The robot facing up below a cube at (x, y): its chassis's front `gap` mm from the cube's near face (the open fingers round the cube, 7 mm clear of it). */
function chassisBelow(p: { x: number; y: number }, gap: number): Pose {
  return { x: p.x, y: p.y + CUBE_SIZE / 2 + ROBOT.chassisFront + gap, heading: UP };
}
/** The robot facing up below a cube at (x, y): its fingers' tips `gap` mm from the cube's near face. */
function fingersBelow(p: { x: number; y: number }, gap: number): Pose {
  return { x: p.x, y: p.y + CUBE_SIZE / 2 + G.gripForward + G.fingerLength / 2 + gap, heading: UP };
}

// =============================================================================================
// The game: its elements, walls and zones; the constants
// =============================================================================================

test('the game: one setup, 150 s, the start area, Tri d\'entrepôt\'s mBot2, the frame, no restarts; 50 per cube, at most 500, -20 per fault', () => {
  const g = logistiqueGame;
  assert.equal(g.id, 'logistique-intelligente');
  assert.equal(LOGISTIQUE_ID, g.id);
  assert.equal(g.title, `MakeX Lebanon - Inspire${NB}: Logistique intelligente (Robot en fête 2027)`);
  assert.equal(LOGISTIQUE_GAME_TITLE, g.title);
  assert.deepEqual(g.mat, { width: 1200, height: 1200, imageUrl: '/simulator/logistique-intelligente/mat.webp', sensorImageUrl: '/simulator/logistique-intelligente/mat-sensor.webp', vector: MAT_VECTOR });
  assert.equal(g.matchDuration, 150);
  assert.equal(MATCH_DURATION, 150);
  assert.equal(g.startZone, START_AREA);
  assert.deepEqual(g.defaultStartPose, START_POSE);
  assert.equal(g.robotConfig, LOGISTIQUE_ROBOT);
  assert.equal(g.restartPenalty, 0);
  assert.deepEqual(g.restartRules, { maxRestarts: 0 });
  assert.equal(g.scenarioProblems, undefined);
  assert.equal(g.createVM, undefined);
  assert.equal(typeof g.createWalls, 'function');
  assert.equal(typeof g.createReferee, 'function');
  assert.deepEqual([POINTS_PER_CUBE, CUBE_COUNT, MAX_PER_WAREHOUSE, MAX_SCORE, VIOLATION_POINTS], [50, 10, 2, 500, 20]);
  assert.deepEqual([TOUCH_MM, ON_MAT_MM, LEAVE_MM], [0.5, 0.5, 0.5]);
});

test('the ten cubes: 50 mm, yellow, numbered 1 - 10, grippable, platforms, keeping their riders; the five bottom ones first, each top one on the bottom one of its square', () => {
  const bodies = logistiqueGame.createBodies(RULES_SETUP);
  assert.deepEqual(bodies.map((b) => b.id), ['cube:1', 'cube:2', 'cube:3', 'cube:4', 'cube:5', 'cube:6', 'cube:7', 'cube:8', 'cube:9', 'cube:10']);
  assert.deepEqual(CUBE_IDS, bodies.map((b) => b.id));
  const where = bodies.map((b) => `${b.label}: (${b.x}, ${b.y}) z ${b.z} on ${b.restingOn}`);
  assert.deepEqual(where, [
    '1: (600, 552) z 0 on null',
    '2: (550, 602) z 0 on null',
    '3: (600, 602) z 0 on null',
    '4: (650, 602) z 0 on null',
    '5: (600, 652) z 0 on null',
    '6: (600, 552) z 50 on cube:1',
    '7: (550, 602) z 50 on cube:2',
    '8: (600, 602) z 50 on cube:3',
    '9: (650, 602) z 50 on cube:4',
    '10: (600, 652) z 50 on cube:5',
  ]);
  for (const b of bodies) {
    assert.equal(b.kind, KIND_CUBE);
    assert.equal(b.fill, CUBE_FILL);
    assert.equal(b.fill, '#ffd21f');
    assert.equal(b.colorName, 'yellow');
    assert.deepEqual([b.w, b.l, b.h, b.angle, b.mass], [50, 50, 50, 0, 1]);
    assert.equal(b.held, false);
    assert.equal(b.grippable, true);
    assert.equal(b.platform, true);
    assert.equal(b.keepsRiders, true);
    assert.equal(b.group, undefined);
    assert.deepEqual(b.home, { x: b.x, y: b.y, angle: 0, z: b.z, restingOn: b.restingOn });
  }
  assert.deepEqual(cubeStart(1), { square: 'haut', layer: 'dessous' });
  assert.deepEqual(cubeStart(5), { square: 'bas', layer: 'dessous' });
  assert.deepEqual(cubeStart(8), { square: 'centre', layer: 'dessus' });
  assert.equal(cubeNumber('cube:10'), 10);
  assert.equal(cubeNumber('cadre:haut'), null);
  assert.equal(cubeNumber(null), null);
  // a new list each time
  assert.notEqual(logistiqueGame.createBodies(RULES_SETUP)[0], bodies[0]);
});

test('the frame: four walls 50 mm high and 20 mm thick, just outside the arena', () => {
  const walls = logistiqueGame.createWalls?.(RULES_SETUP) ?? [];
  assert.deepEqual(FRAME_IDS, ['cadre:haut', 'cadre:bas', 'cadre:gauche', 'cadre:droit']);
  assert.deepEqual(
    walls.map((w) => `${w.id} ${w.label} (${w.x}, ${w.y}) ${w.w} x ${w.l} x ${w.h} ${w.angle}`),
    ['cadre:haut cadre (600, -10) 1240 x 20 x 50 0', 'cadre:bas cadre (600, 1210) 1240 x 20 x 50 0', 'cadre:gauche cadre (-10, 600) 20 x 1200 x 50 0', 'cadre:droit cadre (1210, 600) 20 x 1200 x 50 0'],
  );
  for (const w of walls) {
    assert.equal(w.h, FRAME_HEIGHT);
    assert.equal(w.fill, FRAME_FILL);
    assert.equal(w.colorName, undefined);
  }
});

/** WCAG's contrast ratio of two colours (1 - 21). */
function contrast(a: RGB, b: RGB): number {
  const luminance = ({ r, g, b: blue }: RGB): number => {
    const channel = (v: number): number => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(blue);
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
const hex = (css: string): RGB => ({ r: parseInt(css.slice(1, 3), 16), g: parseInt(css.slice(3, 5), 16), b: parseInt(css.slice(5, 7), 16) });

test('the frame stands out at 3:1 or more (WCAG 1.4.11) from every colour of the mat along it - the arena ends at its inner side - and from a cube pushed against it', () => {
  for (const [what, colour] of [
    ['the grey band', GREY],
    ['the blue band', BAND_BLUE],
    ['the red band', BAND_RED],
    ['the blue half of the start area', START_BLUE],
    ['the red half of the start area', START_RED],
    ['a cube', hex(CUBE_FILL)],
  ] as const) {
    const ratio = contrast(hex(FRAME_FILL), colour);
    assert.ok(ratio >= 3, `against ${what}: ${ratio.toFixed(2)}`);
  }
});

test('the zones: the start area, the storage cross (its twelve corners), the eight warehouses (E1 and E4 as diamonds)', () => {
  const zones = logistiqueGame.overlays(RULES_SETUP);
  assert.deepEqual(zones.map((z) => `${z.id} « ${z.label} » ${z.kind}`), [
    'start « Zone de départ » start',
    'stockage « Zone de stockage » pickup',
    'entrepot:E1 « E1 » delivery',
    'entrepot:E2 « E2 » delivery',
    'entrepot:E3 « E3 » delivery',
    'entrepot:E4 « E4 » delivery',
    'entrepot:E5 « E5 » delivery',
    'entrepot:E6 « E6 » delivery',
    'entrepot:E7 « E7 » delivery',
    'entrepot:E8 « E8 » delivery',
  ]);
  assert.deepEqual(zones[0].rect, START_AREA);
  assert.deepEqual(zones[1].rect, STORAGE_BOX);
  assert.deepEqual(zones[1].outline, STORAGE_OUTLINE);
  for (const z of zones.slice(2)) {
    const w = z.label as WarehouseId;
    assert.deepEqual(z.rect, warehouseFrame(w));
    if (w === 'E1' || w === 'E4') assert.deepEqual(z.outline, warehouseCorners(w));
    else assert.equal(z.outline, undefined);
  }
});

// =============================================================================================
// The sheet at the start (0:00)
// =============================================================================================

test('the sheet at 0:00: five « Dans la zone de stockage. », five « Dans la zone de stockage, sur le cube m. », no fault; 0 / 500', () => {
  const b = bench();
  const expected = [sheet.e, sheet.e, sheet.e, sheet.e, sheet.e, sheet.h2(1), sheet.h2(2), sheet.h2(3), sheet.h2(4), sheet.h2(5)];
  for (const report of [b.score(), logistiqueGame.score(b.ctx())]) {
    assert.deepEqual(report.lines.map((l) => l.id), [...CUBE_IDS, 'fautes']);
    assert.deepEqual(report.lines.slice(0, 10).map((l) => l.detail), expected);
    assert.deepEqual(report.lines.slice(0, 10).map((l) => l.label), ['Cube 1', 'Cube 2', 'Cube 3', 'Cube 4', 'Cube 5', 'Cube 6', 'Cube 7', 'Cube 8', 'Cube 9', 'Cube 10']);
    for (const line of report.lines.slice(0, 10)) assert.deepEqual([line.points, line.max, line.ok, line.time], [0, 50, false, undefined]);
    assert.deepEqual(report.lines[10], { id: 'fautes', label: 'Robot sorti du terrain', points: 0, max: 0, ok: true, detail: faults.none });
    assert.equal(Object.is(report.lines[10].points, -0), false);
    assert.deepEqual([report.total, report.max, report.complete, report.time], [0, 500, false, undefined]);
  }
  // the referee says nothing while nothing happens
  for (let i = 0; i < 5; i++) b.tick();
  assert.deepEqual(b.log, []);
});

// =============================================================================================
// The cases of the table 6.3
// =============================================================================================

describe('a cube on the mat (cases a - f)', () => {
  test('a: in the claw - « Dans la pince du robot. », even over a warehouse', () => {
    const b = bench();
    clear(b, 1);
    b.place(1, E('E5'));
    b.hold(1);
    assert.equal(b.detail(1), sheet.a);
    b.hold(1, 30);
    assert.equal(b.detail(1), sheet.a);
    assert.equal(b.line(1).points, 0);
  });

  test('c: covers the whole warehouse and does not touch the robot - valid by (1), 50 points', () => {
    const b = bench();
    clear(b, 1);
    for (const w of ['E2', 'E3', 'E5', 'E6', 'E7', 'E8'] as const) {
      b.place(1, E(w));
      assert.deepEqual([b.line(1).points, b.line(1).ok, b.detail(1)], [50, true, sheet.c(w)], w);
      assert.equal(b.score().total, 50);
    }
  });

  test('c / d: covered 5.0 mm off the middle - yes; 5.5 mm - only part of it (either way, either axis)', () => {
    const b = bench();
    clear(b, 1);
    const m = E('E5');
    for (const [dx, dy] of [[5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [-5, -5]]) {
      b.place(1, { x: m.x + dx, y: m.y + dy });
      assert.equal(b.detail(1), sheet.c('E5'), `${dx}, ${dy}`);
    }
    for (const [dx, dy] of [[5.5, 0], [-5.5, 0], [0, 5.5], [0, -5.5], [5.01, 0]]) {
      b.place(1, { x: m.x + dx, y: m.y + dy });
      assert.equal(b.detail(1), sheet.d('E5'), `${dx}, ${dy}`);
      assert.equal(b.line(1).points, 0);
    }
  });

  test('c / d: a centred cube turned 17.0 degrees still covers; 17.2 degrees no longer (the corners of the square stick out)', () => {
    const b = bench();
    clear(b, 1);
    for (const deg of [17, -17, 90 + 17, 10]) {
      b.place(1, E('E6'), deg * DEG);
      assert.equal(b.detail(1), sheet.c('E6'), `${deg}`);
    }
    for (const deg of [17.2, -17.2, 45]) {
      b.place(1, E('E6'), deg * DEG);
      assert.equal(b.detail(1), sheet.d('E6'), `${deg}`);
    }
  });

  test('c / d: E1 and E4 are diamonds - covered by a cube turned 45 degrees (± 17.1), never by a cube square to the arena', () => {
    const b = bench();
    clear(b, 1);
    for (const w of ['E1', 'E4'] as const) {
      for (const deg of [45, 45 + 17, 45 - 17, -45]) {
        b.place(1, E(w), deg * DEG);
        assert.equal(b.detail(1), sheet.c(w), `${w} at ${deg}`);
      }
      for (const deg of [0, 90, 45 + 17.2, 45 - 17.2]) {
        b.place(1, E(w), deg * DEG);
        assert.equal(b.detail(1), sheet.d(w), `${w} at ${deg}`);
      }
    }
  });

  test('b / c: the robot\'s chassis 0.4 mm from the cube touches it - « mais touche le robot. »; 0.6 mm does not - valid', () => {
    const b = bench();
    clear(b, 1);
    b.place(1, E('E5'));
    b.robotAt(chassisBelow(E('E5'), 0.4));
    assert.deepEqual([b.detail(1), b.line(1).points], [sheet.b('E5'), 0]);
    b.robotAt(chassisBelow(E('E5'), 0.6));
    assert.deepEqual([b.detail(1), b.line(1).points], [sheet.c('E5'), 50]);
    // the closed fingers' tips touch it too; a claw raised above it does not
    b.robotAt(fingersBelow(E('E5'), 0.2));
    b.claw(5, G.clawClosedGap);
    assert.equal(b.detail(1), sheet.b('E5'));
    b.claw(CUBE_SIZE + 1, G.clawClosedGap);
    assert.equal(b.detail(1), sheet.c('E5'));
  });

  test('d: covers only part of a warehouse; e: in the storage cross; f: anywhere else, touching the robot or not', () => {
    const b = bench();
    clear(b, 1, 2, 3);
    b.place(1, { x: E('E7').x + 30, y: E('E7').y });
    b.place(2, { x: 610, y: 560 });
    b.place(3, { x: 300, y: 900 });
    assert.deepEqual([b.detail(1), b.detail(2), b.detail(3)], [sheet.d('E7'), sheet.e, sheet.f]);
    // a cube whose middle is on the edge of the cross is in it; one whose middle is just outside is not
    b.place(2, { x: 525, y: 602 });
    assert.equal(b.detail(2), sheet.e);
    b.place(2, { x: 524.9, y: 602 });
    assert.equal(b.detail(2), sheet.f);
    // a cube touching the robot, away from every warehouse: still f
    b.robotAt(chassisBelow({ x: 300, y: 900 }, 0));
    assert.equal(b.detail(3), sheet.f);
  });

  test('l: lifted, not held and resting on nothing (never at the end of a tick: a guard) - « Ne touche pas le tapis. »', () => {
    const b = bench();
    clear(b, 1);
    Object.assign(b.body(1), { ...E('E5'), z: ON_MAT_MM + 0.1, restingOn: null, held: false });
    assert.equal(b.detail(1), sheet.l);
    Object.assign(b.body(1), { z: ON_MAT_MM });
    assert.equal(b.detail(1), sheet.c('E5'));
  });
});

describe('a cube on a cube (cases g - k)', () => {
  test('k: on a cube that covers a warehouse, touching nothing else - valid by (2); with it, 100 points in one warehouse', () => {
    const b = bench();
    clear(b, 1, 6);
    b.pair(1, E('E5'));
    assert.deepEqual([b.detail(1), b.detail(6)], [sheet.c('E5'), sheet.k(1, 'E5')]);
    assert.equal(b.score().total, 100);
    // the cube on it need not cover the warehouse itself (Fig 4.4-4): 20 mm off, it still counts
    b.stack(6, 1, 20, -20);
    assert.deepEqual([b.detail(6), b.line(6).points], [sheet.k(1, 'E5'), 50]);
  });

  test('g: on a cube, touching the robot - the raised closed claw\'s tips against the upper cube only', () => {
    const b = bench();
    clear(b, 1, 6);
    b.pair(1, E('E5'));
    b.robotAt(fingersBelow(E('E5'), 0.2));
    b.claw(60, G.clawClosedGap);
    assert.deepEqual([b.detail(1), b.detail(6)], [sheet.c('E5'), sheet.g(1)]);
    assert.equal(b.score().total, 50);
  });

  test('h1: on a cube the claw holds - « que la pince tient » (rule (2) needs the cube under it to count: Q3)', () => {
    const b = bench();
    clear(b, 1, 6);
    b.pair(1, E('E5'));
    b.hold(1);
    // (the robot is far away: the upper cube does not touch it)
    assert.deepEqual([b.detail(1), b.detail(6)], [sheet.a, sheet.h1(1)]);
    assert.equal(b.score().total, 0);
  });

  test('h2: on a cube in the storage cross - the start, or a stack brought back', () => {
    const b = bench();
    clear(b, 3, 8);
    b.pair(3, { x: 600, y: 602 });
    assert.deepEqual([b.detail(3), b.detail(8)], [sheet.e, sheet.h2(3)]);
  });

  test('h3: a third cube on a stack that counts twice - « Troisième cube de la pile de l’entrepôt E5 : … »; the stack scores 100 (Q17)', () => {
    const b = bench();
    clear(b, 1, 6, 2);
    b.pair(1, E('E5'));
    b.stack(2, 6);
    assert.deepEqual([b.detail(1), b.detail(6), b.detail(2)], [sheet.c('E5'), sheet.k(1, 'E5'), sheet.h3('E5')]);
    assert.deepEqual([b.line(1).points, b.line(6).points, b.line(2).points], [50, 50, 0]);
    assert.equal(b.score().total, 100);
    // and four high: the fourth cube rests on a cube that does not count
    b.stack(7, 2);
    assert.equal(b.detail(7), sheet.h6(2));
    assert.equal(b.score().total, 100);
  });

  test('h4: on a cube that touches the robot (b) - the closed fingers low against the lower cube only', () => {
    const b = bench();
    clear(b, 1, 6);
    b.pair(1, E('E5'));
    b.robotAt(fingersBelow(E('E5'), 0.2));
    b.claw(5, G.clawClosedGap);
    assert.deepEqual([b.detail(1), b.detail(6)], [sheet.b('E5'), sheet.h4(1)]);
    // and on a cube that is itself g
    clear(b, 1, 6, 2);
    b.robotAt(START_POSE);
    b.pair(1, E('E6'));
    b.stack(2, 6);
    b.robotAt(fingersBelow(E('E6'), 0.2));
    b.claw(60, G.clawClosedGap);
    assert.deepEqual([b.detail(1), b.detail(6), b.detail(2)], [sheet.c('E6'), sheet.g(1), sheet.h4(6)]);
  });

  test('h5: on a cube that covers only part of a warehouse (d), or none (f)', () => {
    const b = bench();
    clear(b, 1, 6, 2, 7);
    b.pair(1, { x: E('E5').x + 6, y: E('E5').y });
    b.pair(2, { x: 300, y: 900 });
    assert.deepEqual([b.detail(1), b.detail(6), b.detail(2), b.detail(7)], [sheet.d('E5'), sheet.h5(1), sheet.f, sheet.h5(2)]);
  });

  test('h6: on a cube that does not count for another reason (h…, i, l) - « qui ne compte pas », only under a line of 0', () => {
    const b = bench();
    // on a cube that is h5
    clear(b, 1, 6, 2);
    b.pair(1, { x: 300, y: 900 });
    b.stack(2, 6);
    assert.deepEqual([b.detail(6), b.detail(2)], [sheet.h5(1), sheet.h6(6)]);
    // on a cube that is i
    clear(b, 1, 6, 2, 7, 3);
    b.pair(1, E('E5'));
    b.pair(2, { x: E('E5').x + 50, y: E('E5').y });
    b.stack(3, 6);
    assert.deepEqual([b.detail(6), b.detail(3)], [sheet.i(1, 7), sheet.h6(6)]);
    // on a cube that is l
    clear(b, 4, 9);
    Object.assign(b.body(4), { ...E('E2'), z: 20, restingOn: null, held: false });
    b.stack(9, 4);
    assert.deepEqual([b.detail(4), b.detail(9)], [sheet.l, sheet.h6(4)]);
  });

  test('i: lying partly on a neighbour\'s top (face contact) - « mais touche aussi le cube p. »; meeting it only along an edge does not count (Q18)', () => {
    const b = bench();
    clear(b, 1, 6, 2);
    b.pair(1, E('E5'));
    // cube 2 on the mat, flush beside cube 1 (gap 0)
    b.place(2, { x: E('E5').x + CUBE_SIZE, y: E('E5').y });
    assert.deepEqual([b.detail(6), b.line(6).points], [sheet.k(1, 'E5'), 50], 'the upper cube right on cube 1: one edge on cube 2 - no contact');
    b.stack(6, 1, 20, 0);
    assert.deepEqual([b.detail(6), b.line(6).points], [sheet.i(1, 2), 0], '20 mm towards cube 2: it lies on cube 2 over a 20 x 50 mm strip');
    b.stack(6, 1, 0.4, 0);
    assert.equal(b.detail(6), sheet.k(1, 'E5'), '0.4 mm: an overlap of 0.4 mm is not a contact');
    b.stack(6, 1, 0.6, 0);
    assert.equal(b.detail(6), sheet.i(1, 2), '0.6 mm');
    // away from cube 2 it is free again; cube 2 itself counts for nothing either way
    b.stack(6, 1, -20, 0);
    assert.equal(b.detail(6), sheet.k(1, 'E5'));
    assert.equal(b.detail(2), sheet.f);
  });

  test('i: an upper cube beside another upper cube (side to side, 0 to 0.4 mm apart) touches it; 0.6 mm apart it does not', () => {
    const b = bench();
    clear(b, 1, 6, 2, 7);
    b.pair(1, E('E5'));
    b.pair(2, { x: E('E5').x + CUBE_SIZE, y: E('E5').y });
    assert.deepEqual([b.detail(6), b.detail(7)], [sheet.i(1, 7), sheet.h5(2)]);
    b.place(2, { x: E('E5').x + CUBE_SIZE + 0.4, y: E('E5').y });
    b.stack(7, 2);
    assert.equal(b.detail(6), sheet.i(1, 7));
    b.place(2, { x: E('E5').x + CUBE_SIZE + 0.6, y: E('E5').y });
    b.stack(7, 2);
    assert.equal(b.detail(6), sheet.k(1, 'E5'));
    // a held cube touching it is a cube too
    clear(b, 1, 6, 3);
    b.pair(1, E('E5'));
    b.place(3, { x: E('E5').x, y: E('E5').y - CUBE_SIZE });
    b.hold(3, CUBE_SIZE);
    assert.equal(b.detail(6), sheet.i(1, 3));
  });

  test('cubesTouch: side to side within 0.5 mm with heights overlapping by more than 0.5; face to face overlapping by more than 0.5; an edge is no contact', () => {
    const cube = (x: number, y: number, z: number, angle = 0): Body => ({ ...logistiqueGame.createBodies(RULES_SETUP)[0], x, y, z, angle });
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50, 0, 0)), true, 'side to side, flush');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50.4, 0, 0)), true, '0.4 mm apart');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50.6, 0, 0)), false, '0.6 mm apart');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50, 0, 49.4)), true, 'heights overlap by 0.6');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50, 0, 49.6)), false, 'heights overlap by 0.4');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50, 0, 50)), false, 'an edge only (Q18)');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(30, 0, 50)), true, 'lying on it over 20 mm');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(30, 0, 50.6)), false, '0.6 mm above it');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(0, 0, 50)), true, 'right on it (a cube resting on a cube: the referee leaves this pair out)');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(50, 50, 0)), true, 'corner to corner on the mat');
    assert.equal(cubesTouch(cube(0, 0, 0), cube(200, 0, 0)), false);
    assert.equal(cubesTouch(cube(0, 0, 0), cube(60, 0, 0, 45 * DEG)), true, 'a turned cube whose corner reaches it');
  });

  test('j: a warehouse that already has two valid cubes (a guard: no two cubes can rest on one cube without touching each other in this engine)', () => {
    const base = logistiqueGame.createBodies(RULES_SETUP);
    const m = E('E5');
    // (a field no engine makes: two cubes "resting" on cube 1, 50.6 mm apart, the second one's middle off cube 1)
    const at = (n: number, x: number, y: number, z: number, on: string | null): Body => ({ ...base[n - 1], x, y, z, restingOn: on });
    const cubes = [at(1, m.x, m.y, 0, null), at(6, m.x - 25, m.y, 50, 'cube:1'), at(7, m.x + 25.6, m.y, 50, 'cube:1')];
    const judged = judgeCubes({ cubes, holding: null, touchesRobot: () => false, removed: new Map() });
    assert.deepEqual(judged.filter((j) => j.n === 1 || j.n === 6 || j.n === 7).map((j) => [j.n, j.case, j.detail]), [
      [1, 'c', sheet.c('E5')],
      [6, 'k', sheet.k(1, 'E5')],
      [7, 'j', sheet.j('E5')],
    ]);
  });
});

// =============================================================================================
// R18, R19, the falls: what the referee sees during the match
// =============================================================================================

describe('during the match', () => {
  test('R18: a cube more than 0.5 mm outside the arena is taken off the field, once; its line says when; it costs no points (Q16)', () => {
    const b = bench();
    clear(b, 1, 6, 2);
    b.pair(1, E('E5'));
    b.place(2, { x: 1200 + 0.4 - CUBE_SIZE / 2, y: 600 });
    b.at(61.37);
    assert.equal(b.call, null, '0.4 mm out: still in');
    b.place(2, { x: 1200 + 0.6 - CUBE_SIZE / 2, y: 600 });
    b.at(62.37);
    assert.deepEqual(b.call, { say: [say.cubeOut(2, `1:02,3`)], removeBodies: ['cube:2'] });
    assert.deepEqual(b.referee.removed(), new Map([['cube:2', 62.37]]));
    // the engine takes it off; the referee does not take it twice
    b.takeOff(2);
    b.tick();
    assert.equal(b.call, null);
    assert.deepEqual([b.detail(2), b.line(2).points, b.line(2).ok], [sheet.removed('1:02,3'), 0, false]);
    assert.deepEqual(b.faultsLine(), { id: 'fautes', label: faults.label, points: 0, max: 0, ok: true, detail: faults.none });
    assert.equal(b.score().total, 100);
    // a held cube too, while still held
    b.place(3, { x: 600, y: CUBE_SIZE / 2 - 1 });
    b.hold(3, 70);
    b.at(70);
    assert.deepEqual(b.lastCall()?.removeBodies, ['cube:3']);
    assert.deepEqual(b.said, [say.cubeOut(3, '1:10,0')]);
  });

  test('R18: a turned cube - its corner counts', () => {
    const b = bench();
    clear(b, 1);
    // a cube turned 45 degrees reaches 35.36 mm from its middle
    b.place(1, { x: 35, y: 600 }, 45 * DEG);
    b.tick();
    assert.equal(b.call, null);
    b.place(1, { x: 34.8, y: 600 }, 45 * DEG);
    b.tick();
    assert.deepEqual(b.lastCall()?.removeBodies, ['cube:1']);
  });

  test('R19: the robot out by more than 0.5 mm is a fault, -20 at once; it is back in only when all of it is inside; out, in, out = 2 faults; out for long = 1', () => {
    const b = bench();
    clear(b, 1, 6);
    b.pair(1, E('E5'));
    const tips = G.gripForward + G.fingerLength / 2;
    const tipsAt = (y: number): Pose => ({ x: 600, y: y + tips, heading: UP });
    b.claw(G.liftUpHeight);
    b.robotAt(tipsAt(-0.4));
    b.at(10);
    assert.equal(b.call, null, '0.4 mm out');
    b.robotAt(tipsAt(-0.6));
    b.at(41.5);
    assert.deepEqual(b.call, { say: [say.robotOut('0:41,5')] });
    // out for a long time: one fault
    for (let i = 0; i < 300; i++) b.tick();
    assert.deepEqual(b.referee.faults(), [41.5]);
    // 0.2 mm out is not back in; nor out again
    b.robotAt(tipsAt(-0.2));
    b.tick();
    b.robotAt(tipsAt(-0.6));
    b.tick();
    assert.deepEqual(b.referee.faults(), [41.5]);
    assert.equal(b.referee.robotIsOut(), true);
    assert.deepEqual(b.faultsLine(), { id: 'fautes', label: faults.label, points: -20, max: 0, ok: false, detail: faults.once('0:41,5') });
    assert.equal(b.score().total, 80);
    // back in (the tips on the frame's inner side), and out again: a second fault
    b.robotAt(tipsAt(0));
    b.tick();
    assert.equal(b.referee.robotIsOut(), false);
    b.robotAt(tipsAt(-5));
    b.at(62.3);
    assert.deepEqual(b.said, [say.robotOut('1:02,3')]);
    assert.deepEqual(b.referee.faults(), [41.5, 62.3]);
    assert.deepEqual(b.faultsLine(), { id: 'fautes', label: faults.label, points: -40, max: 0, ok: false, detail: faults.many(2, ['0:41,5', '1:02,3']) });
    assert.equal(b.score().total, 60);
    // the chassis, a finger: any part; any side
    const b2 = bench();
    clear(b2);
    b2.robotAt({ x: 1200 - 65 + 0.6, y: 600, heading: UP });
    b2.tick();
    assert.equal(b2.referee.faults().length, 1, 'the chassis over the right side');
    b2.robotAt({ x: 600, y: 600, heading: UP });
    b2.tick();
    assert.equal(b2.referee.robotIsOut(), false);
    // facing down: the fingers' tips 0.6 mm inside the bottom side, then 0.6 mm over it
    b2.robotAt({ x: 600, y: 1200 - 167 - 0.6, heading: DOWN });
    b2.tick();
    assert.equal(b2.referee.faults().length, 1, 'the tips 0.6 mm inside');
    b2.robotAt({ x: 600, y: 1200 - 167 + 0.6, heading: DOWN });
    b2.tick();
    assert.equal(b2.referee.faults().length, 2, 'the tips 0.6 mm out at the bottom');
  });

  test('the total is never below 0; three faults with one valid cube: 0', () => {
    const b = bench();
    clear(b, 1);
    b.place(1, E('E8'));
    const out = (): void => {
      b.robotAt({ x: 600, y: G.gripForward + G.fingerLength / 2 - 5, heading: UP });
      b.tick();
      b.robotAt(START_POSE);
      b.tick();
    };
    out();
    assert.equal(b.score().total, 30);
    out();
    out();
    assert.equal(b.referee.faults().length, 3);
    assert.equal(b.score().total, 0);
    assert.equal(b.faultsLine().points, -60);
    assert.equal(b.faultsLine().detail, faults.many(3, b.referee.faults().map(clock)));
  });

  test('a cube that comes down from the cube it rested on: « Le cube 10 est tombé du cube 5. »; a grip, a release, a carried pair say nothing', () => {
    const b = bench();
    // pushed off: it now stands on the mat
    b.place(10, { x: 600, y: 652 + CUBE_SIZE });
    b.tick();
    assert.deepEqual(b.said, [say.fell(10, 5)]);
    b.tick();
    assert.deepEqual(b.said, []);
    // the claw takes cube 9 from cube 4: nothing; it carries it and puts it on cube 1's pair... on cube 6: nothing
    b.hold(9, CUBE_SIZE);
    b.tick();
    assert.deepEqual(b.said, []);
    b.stack(9, 6);
    b.tick();
    assert.deepEqual(b.said, []);
    // the claw takes cube 2 with cube 7 on it, and carries the pair: nothing
    b.hold(2, 20);
    b.stack(7, 2);
    b.tick();
    Object.assign(b.body(2), { x: 400, y: 700 });
    b.stack(7, 2);
    b.tick();
    assert.deepEqual(b.said, []);
    // the pair put down: nothing
    b.place(2, { x: 400, y: 700 });
    b.stack(7, 2);
    b.tick();
    assert.deepEqual(b.said, []);
    // the cube under it taken off the field: the cube on it comes down
    b.takeOff(1);
    b.tick();
    assert.deepEqual(b.said, [say.fell(6, 1)]);
    // (6 was resting on 1 and 9 on 6: only 6 came down)
    assert.deepEqual(b.log, [say.fell(10, 5), say.fell(6, 1)]);
  });

  test('the sentences have the no-break spaces of French typography: before : ; ! ? and none is plain', () => {
    const texts = [
      say.cubeOut(3, clock(62.37)),
      say.robotOut(clock(41.5)),
      sheet.h3('E5'),
      sheet.removed(clock(1)),
      faults.once(clock(1)),
      faults.many(2, [clock(1), clock(2)]),
    ];
    for (const text of texts) {
      assert.doesNotMatch(text, / [:;!?»]/, text);
      assert.doesNotMatch(text, /«[^ ]/, text);
      assert.doesNotMatch(text, /\bW[1-8]\b/, text);
      assert.doesNotMatch(text, /\ben (haut|bas)\b/, text);
    }
    assert.equal(clock(62.37), '1:02,3');
    assert.equal(clock(41.5), '0:41,5');
    assert.equal(clock(0), '0:00,0');
    assert.equal(clock(150), '2:30,0');
    assert.equal(clock(9.99), '0:09,9');
  });
});

// =============================================================================================
// The end of the match
// =============================================================================================

describe('the end of the match', () => {
  test('the completion time is the end of the match, whatever ended it (time, « Terminé », the program ended); before the end there is none', () => {
    for (const reason of ['time', 'declared', 'program-ended'] as const) {
      const b = bench();
      b.at(60.65);
      assert.equal(b.score().time, undefined);
      b.end(reason);
      assert.equal(b.score().time, 60.65, reason);
    }
  });

  test('the sheet is frozen at the end: what the robot touched and held then, where everything stood then', () => {
    const b = bench();
    clear(b, 1, 6, 2);
    b.pair(1, E('E5'));
    b.place(2, E('E6'));
    b.robotAt(chassisBelow(E('E6'), 0));
    b.at(150);
    b.end('time');
    const final = b.score();
    assert.deepEqual([final.total, final.lines[1].detail], [100, sheet.b('E6')]);
    // after the end the motors stop and things may settle: the sheet does not change
    b.robotAt(START_POSE);
    b.place(1, { x: 300, y: 900 });
    assert.deepEqual(b.score(), final);
  });

  test('500 with five pairs in five warehouses: every line 50, complete; 450 with one upper cube off - not complete', () => {
    const b = bench();
    const pairs: Array<[number, WarehouseId]> = [[1, 'E6'], [2, 'E5'], [3, 'E3'], [4, 'E8'], [5, 'E7']];
    for (const [n, w] of pairs) b.pair(n, E(w));
    const report = b.score();
    assert.deepEqual([report.total, report.max, report.complete], [500, 500, true]);
    assert.deepEqual(report.lines.slice(0, 10).map((l) => l.detail), [
      sheet.c('E6'), sheet.c('E5'), sheet.c('E3'), sheet.c('E8'), sheet.c('E7'),
      sheet.k(1, 'E6'), sheet.k(2, 'E5'), sheet.k(3, 'E3'), sheet.k(4, 'E8'), sheet.k(5, 'E7'),
    ]);
    b.place(10, { x: 300, y: 900 });
    const less = b.score();
    assert.deepEqual([less.total, less.complete], [450, false]);
    // with a fault, 10 valid cubes are still "complete" (every cube counts), but the total is 480
    b.stack(10, 5);
    b.robotAt({ x: 600, y: 100, heading: UP });
    b.tick();
    const withFault = b.score();
    assert.deepEqual([withFault.total, withFault.complete], [480, true]);
  });

  test('a match on the real engine: ten lines and the faults line, the score sheet of the screen', () => {
    const sim = createEngineSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: {} }, scripted(forever).factory);
    sim.start();
    sim.step(100);
    const report = sim.score();
    assert.equal(report.lines.length, 11);
    assert.equal(report.total, 0);
    assert.equal(sim.world.walls?.length, 4);
    sim.declareFinished();
    assert.equal(sim.score().time, 1);
  });
});
