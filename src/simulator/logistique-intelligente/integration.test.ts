/**
 * The whole chain, engine and referee together: the robot (scripted: servo angles and encoder
 * moves, one step per tick, as in core/engine-stacks.test.ts) plays on the real game - the
 * measured field, the frame, the ten cubes that keep their riders - and the real referee scores
 * it (the design's T7, its part with the referee):
 *   - the five stacks of the cross, each taken by its bottom cube, into five warehouses: 500 points
 *     in 60.65 s (the design's probe a1, through the referee);
 *   - the raised claw over the frame: the robot leaves the arena, one fault (-20) per exit;
 *   - a pair carried over the frame: the referee takes both cubes off as they cross, while the
 *     claw still holds the lower one, and it costs no points;
 *   - a pair put on a single cube in E5: three high, 100 points, the third cube's line;
 *   - the upper cube of a pair pushed off: « Le cube 10 est tombé du cube 5. ».
 * The examples (block programs) are measured in ./samples.test.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEngineSimulation } from '../core/engine';
import { liftAngleForHeight } from '../core/robot';
import { drive, scripted, turn, waitUntil, type Script } from '../core/test-helpers';
import type { Body, Pose, ScoreReport, Simulation } from '../core/types';
import { CUBE_SIZE, WAREHOUSES, storageSquareCentre, type StorageSquare, type WarehouseId } from './field';
import { LINE_FAULTS, MAX_SCORE, logistiqueGame } from './game';
import { LOGISTIQUE_ROBOT, START_POSE } from './robot';
import { RULES_SETUP, type LogistiqueScenario } from './scenario';

const G = LOGISTIQUE_ROBOT.gripper;
const NB = ' ';
const UP = 0;
const RIGHT = Math.PI / 2;
const DOWN = Math.PI;
const LEFT = -Math.PI / 2;

// =============================================================================================
// Running a match with a scripted robot
// =============================================================================================

/** The simulation being run: the scripts read the robot's pose from it to steer. */
let live: Simulation<LogistiqueScenario> | null = null;
const pose = (): Pose => {
  assert.ok(live, 'a match is running');
  return live.world.robot.pose;
};

type IO = Parameters<Script>[0];
/** The arm to a claw underside of h mm (5 .. 75). */
function* lift(io: IO, h: number): Generator<void, void, void> {
  io.setServo(G.liftServo, liftAngleForHeight(G, h));
  yield* waitUntil(() => io.servoDone(G.liftServo));
}
function* claw(io: IO, closed: boolean): Generator<void, void, void> {
  io.setServo(G.clawServo, closed ? G.clawClosedAngle : G.clawOpenAngle);
  yield* waitUntil(() => io.servoDone(G.clawServo));
}
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** Turn on the spot to face `heading` (30 RPM). */
function* face(io: IO, heading: number): Generator<void, void, void> {
  const degrees = (wrap(heading - pose().heading) * 180) / Math.PI;
  if (Math.abs(degrees) > 1e-9) yield* turn(io, degrees, 30);
}
/** Turn towards (x, y) and drive the axle there. */
function* goTo(io: IO, x: number, y: number, rpm: number): Generator<void, void, void> {
  const p = pose();
  yield* face(io, Math.atan2(x - p.x, -(y - p.y)));
  const d = Math.hypot(x - pose().x, y - pose().y);
  if (d > 1e-9) yield* drive(io, d, rpm);
}
/** Bring the claw's middle over (x, y), the robot facing `heading`: to 100 mm behind, turn, then straight in (as the design's probes). */
function* clawOver(io: IO, x: number, y: number, heading: number, rpm = 50): Generator<void, void, void> {
  const reach = G.gripForward + 100;
  yield* goTo(io, x - reach * Math.sin(heading), y + reach * Math.cos(heading), rpm);
  yield* face(io, heading);
  yield* drive(io, 100, Math.min(rpm, 40));
}

interface Played {
  sim: Simulation<LogistiqueScenario>;
  report: ScoreReport;
  /** what the referee said, « time text » */
  said: string[];
  /** grabs and releases, « time grab|release id » */
  claws: string[];
}

function play(script: Script, start: Pose = START_POSE): Played {
  const sim = createEngineSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: {}, startPose: start }, scripted(script).factory);
  live = sim;
  sim.start();
  const said: string[] = [];
  const claws: string[] = [];
  for (let n = 0; sim.status === 'running' && n < 15100; n++) {
    sim.step(1);
    for (const e of sim.drainEvents()) {
      if (e.type === 'log' && e.level === 'info') said.push(`${e.time.toFixed(2)} ${e.text}`);
      if (e.type === 'grab' || e.type === 'release') claws.push(`${e.time.toFixed(2)} ${e.type} ${e.bodyId}`);
    }
  }
  live = null;
  return { sim, report: sim.score(), said, claws };
}

const line = (report: ScoreReport, id: string) => {
  const found = report.lines.find((l) => l.id === id);
  assert.ok(found, id);
  return found;
};
const body = (sim: Simulation<LogistiqueScenario>, n: number): Body | undefined => sim.world.bodies.find((b) => b.id === `cube:${n}`);
const centre = (w: WarehouseId) => WAREHOUSES[w].centre;

// =============================================================================================
// 500 points
// =============================================================================================

test('the five stacks of the cross, each taken by its bottom cube, into E7, E8, E5, E6 and E3: 500 points, complete, in 60.65 s (probe a1, through the referee)', () => {
  const PLAN: Array<[StorageSquare, number, WarehouseId, number]> = [
    ['bas', UP, 'E7', LEFT],
    ['droite', LEFT, 'E8', RIGHT],
    ['gauche', RIGHT, 'E5', UP],
    ['haut', DOWN, 'E6', UP],
    ['centre', UP, 'E3', UP],
  ];
  const SHORT = 5; // the claw's middle stops 5 mm before the cube's middle; at the warehouse, 5 mm before its middle
  const { sim, report, said, claws } = play(function* (io) {
    for (const [square, h, w, there] of PLAN) {
      const c = storageSquareCentre(square);
      yield* clawOver(io, c.x - SHORT * Math.sin(h), c.y + SHORT * Math.cos(h), h);
      yield* claw(io, true);
      yield* drive(io, -100, 50);
      const m = centre(w);
      yield* clawOver(io, m.x - SHORT * Math.sin(there), m.y + SHORT * Math.cos(there), there);
      yield* claw(io, false);
      yield* drive(io, -100, 50);
    }
  });
  assert.equal(sim.finishReason, 'program-ended');
  assert.equal(sim.world.time.toFixed(2), '60.65');
  assert.deepEqual([report.total, report.max, report.complete, report.time], [500, MAX_SCORE, true, sim.world.time]);
  assert.deepEqual(report.lines.map((l) => `${l.label}${NB}: ${l.points} - ${l.detail}`), [
    `Cube 1${NB}: 50 - Couvre tout l’entrepôt E6 et touche le tapis.`,
    `Cube 2${NB}: 50 - Couvre tout l’entrepôt E5 et touche le tapis.`,
    `Cube 3${NB}: 50 - Couvre tout l’entrepôt E3 et touche le tapis.`,
    `Cube 4${NB}: 50 - Couvre tout l’entrepôt E8 et touche le tapis.`,
    `Cube 5${NB}: 50 - Couvre tout l’entrepôt E7 et touche le tapis.`,
    `Cube 6${NB}: 50 - Posé sur le cube 1, qui couvre tout l’entrepôt E6.`,
    `Cube 7${NB}: 50 - Posé sur le cube 2, qui couvre tout l’entrepôt E5.`,
    `Cube 8${NB}: 50 - Posé sur le cube 3, qui couvre tout l’entrepôt E3.`,
    `Cube 9${NB}: 50 - Posé sur le cube 4, qui couvre tout l’entrepôt E8.`,
    `Cube 10${NB}: 50 - Posé sur le cube 5, qui couvre tout l’entrepôt E7.`,
    `Robot sorti du terrain${NB}: 0 - Le robot est resté dans le terrain.`,
  ]);
  // the referee said nothing: no cube fell, nothing left the arena
  assert.deepEqual(said, []);
  assert.deepEqual(claws, [
    '2.28 grab cube:5',
    '6.87 release cube:5',
    '15.71 grab cube:4',
    '21.31 release cube:4',
    '30.15 grab cube:2',
    '34.87 release cube:2',
    '41.39 grab cube:1',
    '47.71 release cube:1',
    '54.39 grab cube:3',
    '59.88 release cube:3',
  ]);
});

// =============================================================================================
// The frame: the robot and the cubes that leave the arena
// =============================================================================================

test('R19: the raised claw passes over the frame, 62 mm out - one fault, -20; backed off and out again - a second one', () => {
  const seen: string[] = [];
  const { report, said } = play(function* (io) {
    yield* lift(io, G.liftUpHeight);
    yield* drive(io, 400, 50); // the chassis stops against the frame
    seen.push(`fingers' tips at y ${(pose().y - G.gripForward - G.fingerLength / 2).toFixed(2)}`);
    yield* drive(io, -100, 50);
    yield* drive(io, 150, 50);
    yield* drive(io, -200, 50);
  }, { x: 600, y: 400, heading: UP });
  assert.deepEqual(seen, ['fingers\' tips at y -62.00']);
  const out = (t: string): string => `Faute à ${t}${NB}: le robot sort du terrain (vu de dessus, il passe au-dessus du cadre). -20 points.`;
  assert.deepEqual(said, [`1.94 ${out('0:01,9')}`, `3.86 ${out('0:03,8')}`]);
  const faults = line(report, LINE_FAULTS);
  assert.deepEqual([faults.points, faults.ok], [-40, false]);
  assert.equal(faults.detail, `2 fois (0:01,9${NB}; 0:03,8)${NB}: -20 points chacune.`);
  assert.equal(report.total, 0);
});

test('R18: a pair carried over the frame (the claw holds the lower cube) - both cubes are taken off as they cross, before the claw itself is out; the cubes cost nothing, the claw -20', () => {
  const { sim, report, said, claws } = play(function* (io) {
    // the stack of the square « bas » (cubes 5 and 10), taken by its bottom cube, raised, carried to the left side
    const c = storageSquareCentre('bas');
    yield* clawOver(io, c.x, c.y + 5, UP);
    yield* claw(io, true);
    yield* lift(io, G.liftUpHeight);
    yield* drive(io, -100, 50);
    yield* face(io, LEFT);
    yield* drive(io, 700, 50); // the chassis stops against the frame
    yield* drive(io, -100, 50);
  });
  assert.deepEqual(claws, ['2.28 grab cube:5'], 'no release: the cube left the claw only when it left the field');
  // the pair is 5 mm ahead of the claw's middle: its edge crosses (6.94 s) three ticks before the fingers' tips (6.97 s)
  assert.deepEqual(said, [
    `6.94 Le cube 5 sort du terrain à 0:06,9${NB}: vu de dessus, il passe au-dessus du cadre. L’arbitre l’enlève${NB}: il ne rapporte plus rien.`,
    `6.94 Le cube 10 sort du terrain à 0:06,9${NB}: vu de dessus, il passe au-dessus du cadre. L’arbitre l’enlève${NB}: il ne rapporte plus rien.`,
    `6.97 Faute à 0:06,9${NB}: le robot sort du terrain (vu de dessus, il passe au-dessus du cadre). -20 points.`,
  ]);
  assert.equal(body(sim, 5), undefined);
  assert.equal(body(sim, 10), undefined);
  assert.equal(sim.world.robot.gripper.holding, null);
  const removed = `Sorti du terrain à 0:06,9${NB}: l’arbitre l’a enlevé.`;
  assert.deepEqual([line(report, 'cube:5').detail, line(report, 'cube:10').detail], [removed, removed]);
  // one fault, the robot's; the two cubes add nothing to it
  assert.deepEqual([line(report, LINE_FAULTS).points, line(report, LINE_FAULTS).detail], [-20, `Une fois, à 0:06,9${NB}: -20 points.`]);
  assert.equal(report.total, 0);
  // the eight others are still on the cross
  for (const n of [1, 2, 3, 4]) assert.equal(line(report, `cube:${n}`).detail, 'Dans la zone de stockage.');
  for (const n of [6, 7, 8, 9]) assert.equal(line(report, `cube:${n}`).detail, `Dans la zone de stockage, sur le cube ${n - 5}.`);
});

// =============================================================================================
// Three high, and a cube that falls
// =============================================================================================

test('a pair put on a single cube in E5: three high - the single cube and the lower cube of the pair score, the third does not: 100 (Q17)', () => {
  const { sim, report, said, claws } = play(function* (io) {
    // cube 10 alone (the arm up: the claw's underside 75 mm, over cube 5), into E5
    yield* lift(io, G.liftUpHeight);
    const bas = storageSquareCentre('bas');
    yield* clawOver(io, bas.x, bas.y, UP);
    yield* claw(io, true);
    yield* drive(io, -100, 50);
    const e5 = centre('E5');
    yield* clawOver(io, e5.x, e5.y, UP);
    yield* lift(io, G.liftDownHeight);
    yield* claw(io, false);
    yield* drive(io, -100, 50);
    // the stack of the square « gauche » (cubes 2 and 7) by its bottom cube, from the left, raised, onto cube 10
    const gauche = storageSquareCentre('gauche');
    yield* clawOver(io, gauche.x - 5, gauche.y, RIGHT);
    yield* claw(io, true);
    yield* lift(io, G.liftUpHeight);
    yield* drive(io, -100, 50);
    yield* clawOver(io, e5.x, e5.y + 5, UP);
    yield* lift(io, G.liftDownHeight); // the arm stops when cube 2 stands on cube 10
    yield* claw(io, false);
    yield* drive(io, -100, 50);
  });
  assert.equal(sim.finishReason, 'program-ended');
  assert.deepEqual(said, []);
  assert.deepEqual(claws, ['2.82 grab cube:10', '8.57 release cube:10', '11.73 grab cube:2', '17.11 release cube:2']);
  assert.equal(sim.world.time.toFixed(2), '17.88');
  const where = (n: number): string => {
    const b = body(sim, n);
    assert.ok(b, `cube ${n}`);
    return `z ${Math.round(b.z * 100) / 100} on ${b.restingOn}`;
  };
  assert.deepEqual([where(10), where(2), where(7)], ['z 0 on null', 'z 50 on cube:10', 'z 100 on cube:2']);
  assert.deepEqual([line(report, 'cube:10').detail, line(report, 'cube:2').detail, line(report, 'cube:7').detail], [
    'Couvre tout l’entrepôt E5 et touche le tapis.',
    'Posé sur le cube 10, qui couvre tout l’entrepôt E5.',
    `Troisième cube de la pile de l’entrepôt E5${NB}: un entrepôt compte au plus deux cubes valides.`,
  ]);
  assert.deepEqual([report.total, report.complete], [100, false]);
  // cube 5 stands alone on its square now
  assert.equal(line(report, 'cube:5').detail, 'Dans la zone de stockage.');
});

test('the upper cube of a pair pushed off by the closed claw: « Le cube 10 est tombé du cube 5. »; taking and putting down the pair said nothing', () => {
  const { sim, report, said } = play(function* (io) {
    // the stack of the square « bas », taken by its bottom cube, set down 100 mm lower (out of the cross)
    const c = storageSquareCentre('bas');
    yield* clawOver(io, c.x, c.y + 5, UP);
    yield* claw(io, true);
    yield* drive(io, -100, 50);
    yield* claw(io, false);
    yield* drive(io, -60, 50);
    // the closed claw at 60 mm (over cube 5) pushes cube 10 up by 30 mm: its middle leaves cube 5
    yield* lift(io, 60);
    yield* claw(io, true);
    yield* drive(io, 15 + 30, 20);
    yield* drive(io, -60, 50);
  });
  assert.deepEqual(said, ['4.81 Le cube 10 est tombé du cube 5.']);
  const five = body(sim, 5);
  const ten = body(sim, 10);
  assert.ok(five && ten);
  assert.deepEqual([ten.z, ten.restingOn, Math.round(ten.y), Math.round(five.y)], [0, null, Math.round(five.y) - CUBE_SIZE, Math.round(five.y)]);
  assert.deepEqual([line(report, 'cube:5').detail, line(report, 'cube:10').detail], ['Ne couvre aucun entrepôt.', 'Ne couvre aucun entrepôt.']);
  assert.equal(report.total, 0);
});
