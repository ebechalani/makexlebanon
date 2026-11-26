/**
 * Robot en fête 2027 (./game.ts): the Warehouse Sort game in French (design 5, test T7).
 *
 *   - it IS Warehouse Sort: the same mat, numbers, robot and arrangements; every example on
 *     every arrangement gives the same points, times, end and score lines (ids, points, ok,
 *     times) as in Warehouse Sort - only the words differ;
 *   - its words are French, case by case (the cases of ../warehouse-sort/game.test.ts): the
 *     zones, the console lines of the referee and every line of the score sheet, with a decimal
 *     comma, the warehouses E1 - E4 and French typography;
 *   - its codes: "VR-BR" is the default arrangement, a Warehouse Sort code ("GR-BR") is read too,
 *     a code that cannot be played gets French sentences; the English encodeScenario and
 *     decodeScenario still take one argument;
 *   - a French match never names W1 - W4: not in a console line (the screen's own lines from the
 *     French word table included) and not in a score line.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { robotShapesAt } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { Body, Pose, ScoreContext, ScoreLine, ScoreReport, SimEvent } from '../core/types';
import { FR_TEXT } from '../ui/text/fr';
import { restartFacts } from '../ui/format';
import { ROBOT_EN_FETE_WORDS } from '../ui/robot-en-fete/words';
import { BAYS, FINISH_PADS, WAREHOUSE_IDS, type WarehouseId } from '../warehouse-sort/field';
import {
  BLUE_PENALTY,
  CUBE_LETTER,
  LINE_BLUE,
  LINE_CLEAN,
  LINE_LAST_DELIVERY,
  LINE_LEAVE_START,
  LINE_PARK,
  LINE_RESTARTS,
  LINE_START_POSITION,
  LINE_WRONG_BAY,
  RESTART_PENALTY,
  blueMove,
  blueMoveIn,
  cubeBodyId,
  cubeHome,
  deliverLineId,
  pickLineId,
  warehouseSortGame,
} from '../warehouse-sort/game';
import { EN_REFEREE_WORDS, clock, type RefereeWords } from '../warehouse-sort/referee-words';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from '../warehouse-sort/robot';
import { SAMPLE_PROGRAMS } from '../warehouse-sort/samples';
import {
  allScenarios,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  scenarioCodec,
  scenarioOfCode,
  scenarioProblems,
  type CubeColor,
  type WarehouseSortScenario,
} from '../warehouse-sort/scenario';
import { ROBOT_EN_FETE_ID, robotEnFeteGame } from './game';
import { FR_REFEREE_WORDS } from './referee-words';
import { FR_CODEC, FR_LETTERS, FR_SCENARIO_TEXT, FR_SCENARIO_WORDS, frWarehouse } from './scenario-words';

/** The no-break space of French typography. */
const NB = '\u00a0';
const GAMES = { en: warehouseSortGame, fr: robotEnFeteGame };

// =============================================================================================
// What a French text may not contain
// =============================================================================================

/** English words that are no French words: one of them in a French text is a text left in English. */
const ENGLISH = /(?<![\p{L}\p{N}])(the|of|and|is|at|it|its|not|yet|bay|pad|picked|gripped|done|since|wrong|field|none|restarts?|held|holding|still|was|moved|alone|leave|left|right|red|green|blue|cubes? W\d)(?![\p{L}\p{N}])/iu;

/** What is wrong with the typography of a French text, or null (design 4.3, D6, D10). */
function frenchProblem(text: string): string | null {
  if (/\bW[1-4]\b/.test(text)) return 'names a warehouse W1 - W4';
  if (ENGLISH.test(text)) return `an English word: "${ENGLISH.exec(text)?.[0]}"`;
  if (/\d\.\d/.test(text)) return 'a number with a decimal point';
  if (/'/.test(text)) return "a straight apostrophe (French writes ’)";
  if (/\.\.\./.test(text)) return '"..." (French writes …)';
  if (/«(?!\u00a0)/.test(text) || /(?<!\u00a0)»/.test(text)) return 'no no-break space inside « »';
  // (a time "0:12,3" has a colon between digits: no space there)
  const bare = text.replace(/\d:\d/g, '');
  if (/(?<!\u00a0)[:;!?]/.test(bare)) return 'no no-break space before : ; ! ?';
  return null;
}

// =============================================================================================
// A field put together by hand, judged by the English AND the French referee at once
// =============================================================================================

type Ctx = ScoreContext<WarehouseSortScenario>;

/** The parts of a score line that are no words: the two referees must agree on them. */
const facts = (line: ScoreLine) => ({ id: line.id, points: line.points, max: line.max, ok: line.ok, time: line.time });
const factsOf = (report: ScoreReport) => ({ total: report.total, max: report.max, complete: report.complete, time: report.time, lines: report.lines.map(facts) });

/**
 * One field (the real bodies and robot state of the French game, from the engine, which does
 * not run here), and an English and a French referee of their own, asked on the same ticks. Every
 * tick and every sheet checks that the two agree on everything but the words.
 */
function bench(scenario: WarehouseSortScenario = defaultScenario()) {
  const sim = createSimulation({ game: robotEnFeteGame, scenario, program: {} });
  const world = sim.world;
  const referees = { en: warehouseSortGame.createReferee!(scenario), fr: robotEnFeteGame.createReferee!(scenario) };
  let restarts = 0;
  const ctx = (): Ctx => ({
    scenario,
    world,
    robotConfig: WAREHOUSE_SORT_ROBOT,
    restarts,
    robotShapes: robotShapesAt(WAREHOUSE_SORT_ROBOT, world.robot.pose, world.robot.gripper.gap),
  });
  const cube = (w: WarehouseId): Body => {
    const found = world.bodies.find((b) => b.id === cubeBodyId(w));
    assert.ok(found, w);
    return found;
  };
  const b = {
    world,
    cube,
    /** what the French referee said on the last tick */
    said: [] as string[],
    /** ... and the English one */
    saidEn: [] as string[],
    /** what the French referee said on the last tick (a call, so that an assertion on it narrows nothing) */
    heard(): string[] {
      return b.said;
    },
    robotAt(pose: Pose) {
      Object.assign(world.robot.pose, pose);
    },
    /** put a cube down on the mat with its middle at (x, y) */
    place(w: WarehouseId, x: number, y: number) {
      Object.assign(cube(w), { x, y, angle: 0, z: 0, held: false, restingOn: null });
      if (world.robot.gripper.holding === cube(w).id) world.robot.gripper.holding = null;
    },
    /** put a cube in the middle of a bay */
    inBay(w: WarehouseId, bay: 'red' | 'green') {
      b.place(w, BAYS[bay].x + BAYS[bay].w / 2, BAYS[bay].y + BAYS[bay].h / 2);
    },
    /** the gripper holds a cube, its base `z` mm above the mat */
    hold(w: WarehouseId, z = 0) {
      Object.assign(cube(w), { z, held: true, restingOn: null });
      world.robot.gripper.holding = cube(w).id;
    },
    remove(w: WarehouseId) {
      world.bodies.splice(world.bodies.indexOf(cube(w)), 1);
    },
    begin() {
      referees.en.begin?.(ctx());
      referees.fr.begin?.(ctx());
    },
    /** both referees look at one tick, at match time `time` */
    tick(time: number) {
      world.tick++;
      world.time = time;
      b.saidEn = referees.en.observe(ctx())?.say ?? [];
      b.said = referees.fr.observe(ctx())?.say ?? [];
      assert.equal(b.said.length, b.saidEn.length, `the two referees say as much at ${time} s`);
    },
    restart() {
      restarts++;
      referees.en.restart(ctx());
      referees.fr.restart(ctx());
    },
    end() {
      referees.en.finished?.(ctx(), 'time');
      referees.fr.finished?.(ctx(), 'time');
    },
    /** the French sheet (after checking that the English one has the same facts) */
    score(): ScoreReport {
      const en = referees.en.score(ctx());
      const fr = referees.fr.score(ctx());
      assert.deepEqual(factsOf(fr), factsOf(en));
      return fr;
    },
    line(id: string): ScoreLine {
      const line = b.score().lines.find((l) => l.id === id);
      assert.ok(line, `line ${id}`);
      return line;
    },
    /** label and detail of a line */
    words(id: string): [string, string] {
      const line = b.line(id);
      return [line.label, line.detail];
    },
  };
  return b;
}

/** A spot outside the start zone, far from every cube, bay and pad. */
const OUT_OF_START: Pose = { x: START_POSE.x, y: START_POSE.y - 300, heading: 0 };

// =============================================================================================
// The same game
// =============================================================================================

test('the same game as Warehouse Sort - mat, numbers, robot, arrangements - with its own id, title and codes', () => {
  const { en, fr } = GAMES;
  assert.equal(fr.id, 'robot-en-fete');
  assert.equal(ROBOT_EN_FETE_ID, fr.id);
  assert.equal(fr.title, `MakeX Lebanon - Inspire${NB}: Tri d’entrepôt (Robot en fête 2027)`);
  assert.deepEqual(Object.keys(fr), Object.keys(en), 'the same parts, in the same order');
  assert.deepEqual(fr.mat, en.mat);
  assert.equal(fr.matchDuration, en.matchDuration);
  assert.deepEqual(fr.startZone, en.startZone);
  assert.deepEqual(fr.defaultStartPose, en.defaultStartPose);
  assert.equal(fr.restartPenalty, en.restartPenalty);
  assert.equal(fr.restartRules, undefined);
  assert.equal(fr.robotConfig, en.robotConfig, 'the very same robot');
  assert.equal(fr.scenarioCount(), 24);
  assert.deepEqual(fr.defaultScenario(), en.defaultScenario());
  for (let k = 0; k < 50; k++) assert.deepEqual(fr.randomScenario(() => k / 50), en.randomScenario(() => k / 50));
  // (Warehouse Sort itself is unchanged)
  assert.equal(en.id, 'warehouse-sort');
  assert.equal(en.title, 'MakeX Lebanon - Inspire: Warehouse Sort');
});

test('the bodies: the same cubes in the same places; the letter on a green cube is V (vert)', () => {
  for (const s of allScenarios()) {
    const en = GAMES.en.createBodies(s);
    const fr = GAMES.fr.createBodies(s);
    assert.deepEqual(
      fr.map(({ label: _label, ...rest }) => rest),
      en.map(({ label: _label, ...rest }) => rest),
    );
    for (const body of fr) assert.equal(body.label, FR_LETTERS[body.colorName as CubeColor]);
    for (const body of en) assert.equal(body.label, CUBE_LETTER[body.colorName as CubeColor], 'English: R, G, B as before');
  }
  assert.deepEqual(FR_LETTERS, { red: 'R', green: 'V', blue: 'B' });
});

test('the zones: the same areas with French names - "Zone de départ", "E1 vert", "Baie rouge", "Baie verte", "Aire d’arrivée"', () => {
  for (const s of allScenarios()) {
    const en = GAMES.en.overlays(s);
    const fr = GAMES.fr.overlays(s);
    assert.deepEqual(
      fr.map(({ label: _label, ...rest }) => rest),
      en.map(({ label: _label, ...rest }) => rest),
    );
  }
  const labels = GAMES.fr.overlays(defaultScenario()).map((zone) => zone.label);
  assert.deepEqual(labels, ['Zone de départ', 'E1 vert', 'E2 rouge', 'E3 bleu', 'E4 rouge', 'Baie rouge', 'Baie verte', 'Aire d’arrivée', 'Aire d’arrivée']);
});

describe('every example on every arrangement: the same match as in Warehouse Sort, in French', () => {
  /** Play a program to its end (`restartsAt`: restarts at these match times; `finishAt`: "Terminé" then). */
  function play(game: typeof robotEnFeteGame, scenario: WarehouseSortScenario, program: unknown, restartsAt: number[] = [], finishAt?: number) {
    const sim = createSimulation({ game, scenario, program: program as never, seed: 1 });
    sim.start();
    const left = [...restartsAt];
    const events: SimEvent[] = [];
    const sheets: ScoreReport[] = [];
    let ticks = 0;
    while (sim.status === 'running') {
      sim.step(10);
      ticks += 10;
      if (left.length > 0 && sim.world.time >= left[0]) {
        left.shift();
        sim.restart();
      }
      if (finishAt !== undefined && sim.world.time >= finishAt) sim.declareFinished();
      events.push(...sim.drainEvents());
      if (ticks % 300 === 0) sheets.push(sim.score());
    }
    events.push(...sim.drainEvents());
    return { sim, events, sheets, end: sim.score() };
  }
  /** an event without its words (the referee's lines are words) */
  const eventFacts = (event: SimEvent) => (event.type === 'log' ? { type: event.type, level: event.level, time: event.time } : event);

  const runs: Array<{ name: string; en: ReturnType<typeof play>; fr: ReturnType<typeof play> }> = [];
  for (const sample of SAMPLE_PROGRAMS) {
    allScenarios().forEach((s, i) => {
      runs.push({ name: `${sample.id} on ${encodeScenario(s)}`, en: play(GAMES.en, s, sample.program), fr: play(GAMES.fr, s, sample.program) });
      if (i % 6 === 0) {
        runs.push({ name: `${sample.id} on ${encodeScenario(s)}, restarts`, en: play(GAMES.en, s, sample.program, [4, 19.5]), fr: play(GAMES.fr, s, sample.program, [4, 19.5]) });
        runs.push({ name: `${sample.id} on ${encodeScenario(s)}, "Finished" at 12 s`, en: play(GAMES.en, s, sample.program, [], 12), fr: play(GAMES.fr, s, sample.program, [], 12) });
      }
    });
  }

  test(`${runs.length} matches: the same total, time, end, restarts and score lines (id, points, ok, time); the same events`, () => {
    assert.equal(runs.length, 6 * 24 + 6 * 4 * 2);
    for (const { name, en, fr } of runs) {
      assert.equal(fr.sim.status, en.sim.status, name);
      assert.equal(fr.sim.world.time, en.sim.world.time, name);
      assert.equal(fr.sim.finishReason, en.sim.finishReason, name);
      assert.equal(fr.sim.restarts, en.sim.restarts, name);
      assert.deepEqual(factsOf(fr.end), factsOf(en.end), name);
      assert.deepEqual(fr.sheets.map(factsOf), en.sheets.map(factsOf), `${name}: during the match too`);
      assert.deepEqual(fr.events.map(eventFacts), en.events.map(eventFacts), `${name}: the same events at the same times`);
      assert.deepEqual(fr.sim.world.robot.pose, en.sim.world.robot.pose, name);
      assert.deepEqual(fr.sim.world.bodies.map(({ label: _l, ...rest }) => rest), en.sim.world.bodies.map(({ label: _l, ...rest }) => rest), name);
    }
    // the examples score what they scored before (10 ... 80 points), here too
    const best = Math.max(...runs.map((run) => run.fr.end.total));
    assert.equal(best, 80);
  });

  test('every word of these matches is French: the score lines and the referee\'s console lines', () => {
    const seen = new Set<string>();
    for (const { name, en, fr } of runs) {
      for (const [frSheet, enSheet] of [...fr.sheets.map((s, i) => [s, en.sheets[i]] as const), [fr.end, en.end] as const]) {
        frSheet.lines.forEach((line, i) => {
          const english = enSheet.lines[i];
          for (const [french, original] of [
            [line.label, english.label],
            [line.detail, english.detail],
          ]) {
            assert.equal(frenchProblem(french), null, `${name}: "${french}"`);
            assert.notEqual(french, original, `${name}: "${french}" is the English`);
            seen.add(french);
          }
        });
      }
      const said = (events: SimEvent[]) => events.flatMap((e) => (e.type === 'log' && e.level === 'info' ? [e.text] : []));
      const [frSaid, enSaid] = [said(fr.events), said(en.events)];
      assert.equal(frSaid.length, enSaid.length, name);
      frSaid.forEach((text, i) => {
        assert.equal(frenchProblem(text), null, `${name}: "${text}"`);
        assert.notEqual(text, enSaid[i], `${name}: "${text}" is the English`);
        seen.add(text);
      });
    }
    assert.ok(seen.size > 150, `${seen.size} different French texts`);
  });
});

// =============================================================================================
// The French words, case by case (the cases of ../warehouse-sort/game.test.ts)
// =============================================================================================

test('the sheet before anything happened, in French', () => {
  const b = bench();
  // the default arrangement: E1 vert, E2 rouge, E3 bleu, E4 rouge
  const lines = b.score().lines.map((line) => [line.id, line.label, line.detail]);
  assert.deepEqual(lines, [
    [LINE_LEAVE_START, 'Sortir de la zone de départ', 'pas encore\u00a0– sors de la zone de départ'],
    [pickLineId('W1'), 'Prendre le cube E1 (vert)', 'pas encore\u00a0– saisis-le, puis soulève-le de 1 cm ou porte-le sur 4 cm'],
    [pickLineId('W2'), 'Prendre le cube E2 (rouge)', 'pas encore\u00a0– saisis-le, puis soulève-le de 1 cm ou porte-le sur 4 cm'],
    [pickLineId('W4'), 'Prendre le cube E4 (rouge)', 'pas encore\u00a0– saisis-le, puis soulève-le de 1 cm ou porte-le sur 4 cm'],
    [deliverLineId('W1'), 'Cube E1 (vert) dans la baie verte', 'pas encore\u00a0– mets-le dans la baie verte'],
    [deliverLineId('W2'), 'Cube E2 (rouge) dans la baie rouge', 'pas encore\u00a0– mets-le dans la baie rouge'],
    [deliverLineId('W4'), 'Cube E4 (rouge) dans la baie rouge', 'pas encore\u00a0– mets-le dans la baie rouge'],
    [LINE_PARK, 'Se garer sur une aire d’arrivée', 'à la fin, le robot doit toucher une aire d’arrivée ronde (à gauche ou à droite)'],
    [LINE_CLEAN, `Parcours propre${NB}: aucune relance`, 'aucune relance pour l’instant'],
    [LINE_RESTARTS, 'Relances', 'aucune relance'],
    [LINE_WRONG_BAY, 'Cubes dans la mauvaise baie', 'aucun'],
    [LINE_BLUE, 'Cube bleu (E3)', 'laissé en place'],
  ]);
  // the same sheet as the game's own (Game.score: a match in which nothing has happened)
  const sim = createSimulation({ game: robotEnFeteGame, scenario: defaultScenario(), program: {} });
  assert.deepEqual(sim.score().lines.map((line) => [line.id, line.label, line.detail]), lines);
  b.end();
  assert.deepEqual(b.words(LINE_LEAVE_START), ['Sortir de la zone de départ', 'le robot n’est jamais sorti de la zone de départ']);
  assert.deepEqual(b.words(pickLineId('W2')), ['Prendre le cube E2 (rouge)', 'pas pris']);
  assert.deepEqual(b.words(deliverLineId('W2')), ['Cube E2 (rouge) dans la baie rouge', 'dans aucune baie']);
  assert.equal(b.line(LINE_PARK).detail, 'à la fin, le robot ne touchait aucune aire d’arrivée');
  assert.equal(b.line(LINE_CLEAN).detail, 'aucune relance');
});

test('leaving the start zone, and picking a cube up: the console and the sheet', () => {
  const b = bench();
  b.begin();
  b.tick(0.5);
  assert.deepEqual(b.heard(), []);
  b.robotAt(OUT_OF_START);
  b.tick(1.23);
  assert.deepEqual(b.heard(), [`+5 points à 0:01,2${NB}: le robot est sorti de la zone de départ.`]);
  assert.deepEqual(b.saidEn, ['+5 points at 0:01.2: the robot left the start zone.'], 'the English referee, unchanged');
  assert.equal(b.line(LINE_LEAVE_START).detail, 'fait à 0:01,2');
  // E2: lifted 1 cm in the gripper
  b.hold('W2', 10);
  b.tick(2.57);
  assert.deepEqual(b.heard(), [`+5 points à 0:02,5${NB}: cube E2 (rouge) pris.`]);
  assert.equal(b.line(pickLineId('W2')).detail, 'fait à 0:02,5');
  // E1: gripped, but neither lifted nor carried - after the match the sheet says why
  b.hold('W1', 0);
  b.tick(3);
  b.place('W1', b.cube('W1').x, b.cube('W1').y);
  b.tick(3.1);
  b.end();
  assert.equal(b.line(pickLineId('W1')).detail, 'saisi, mais pas soulevé de 1 cm ni porté sur 4 cm');
  assert.equal(b.line(pickLineId('W4')).detail, 'pas pris');
});

test('a cube in its bay, held, lifted, touching the robot, partly in: the console and the sheet', () => {
  const b = bench();
  b.begin();
  b.inBay('W1', 'green');
  b.tick(3);
  assert.deepEqual(b.heard(), [`0:03,0${NB}: le cube E1 (vert) est dans la baie verte.`]);
  assert.equal(b.line(deliverLineId('W1')).detail, 'dans la baie verte depuis 0:03,0');
  // the time of the last correct delivery: one cube
  assert.deepEqual(b.words(LINE_LAST_DELIVERY), ['Temps de la dernière livraison correcte', `pour départager${NB}: 1 cube dans la bonne baie, posé à 0:03,0`]);
  b.inBay('W2', 'red');
  b.tick(9.95);
  assert.deepEqual(b.heard(), [`0:09,9${NB}: le cube E2 (rouge) est dans la baie rouge.`]);
  assert.equal(b.line(LINE_LAST_DELIVERY).detail, `pour départager${NB}: 2 cubes dans la bonne baie, le dernier posé à 0:09,9`);
  // held in its bay
  b.hold('W1', 0);
  b.tick(10.5);
  assert.equal(b.line(deliverLineId('W1')).detail, 'le robot le tient\u00a0– pose-le dans la baie verte');
  // lifted, not held
  b.place('W1', b.cube('W1').x, b.cube('W1').y);
  b.cube('W1').z = 20;
  b.tick(11);
  assert.equal(b.line(deliverLineId('W1')).detail, 'pas posé sur le tapis\u00a0– pose-le dans la baie verte');
  // in its bay, touching the robot
  b.inBay('W1', 'green');
  b.robotAt({ x: b.cube('W1').x, y: b.cube('W1').y + 75, heading: 0 });
  b.tick(11.5);
  assert.equal(b.line(deliverLineId('W1')).detail, 'dans la baie verte, mais il touche le robot\u00a0– éloigne-toi');
  // only partly in its bay
  b.place('W4', BAYS.red.x - 5, BAYS.red.y + BAYS.red.h / 2);
  b.tick(12);
  assert.equal(b.line(deliverLineId('W4')).detail, 'seulement en partie dans la baie rouge\u00a0– tout le cube doit être dedans');
  // after the match
  b.hold('W2', 0);
  b.tick(12.5);
  b.end();
  assert.equal(b.line(deliverLineId('W1')).detail, 'dans la baie verte, mais il touche le robot');
  assert.equal(b.line(deliverLineId('W2')).detail, 'le robot le tenait encore\u00a0– pose-le dans la baie rouge');
});

test('a cube in a bay that was never seen standing there: "dans la baie rouge" without a time', () => {
  const b = bench();
  b.begin();
  b.inBay('W2', 'red');
  assert.equal(b.line(deliverLineId('W2')).detail, 'dans la baie rouge');
});

test('the wrong bay: -5 and no points for that cube, one cube or several', () => {
  const b = bench();
  b.begin();
  b.hold('W2', 12);
  b.tick(2.5);
  b.inBay('W2', 'green');
  b.tick(4);
  assert.deepEqual(b.heard(), [`0:04,0${NB}: le cube E2 (rouge) est dans la baie verte\u00a0– la mauvaise baie.`]);
  assert.equal(b.line(deliverLineId('W2')).detail, 'dans la baie verte\u00a0– mauvaise baie, -5');
  assert.equal(b.line(pickLineId('W2')).detail, `pris à 0:02,5, mais le cube est dans la mauvaise baie${NB}: aucun point`);
  assert.equal(b.line(LINE_WRONG_BAY).detail, 'cube E2 (rouge), -5');
  b.inBay('W1', 'red');
  b.tick(5);
  assert.equal(b.line(pickLineId('W1')).detail, `le cube est dans la mauvaise baie${NB}: aucun point`);
  assert.equal(b.line(LINE_WRONG_BAY).detail, 'cube E1 (vert), cube E2 (rouge), -5 chacun');
});

test('off the mat: it scores nothing, the console says it once', () => {
  const b = bench();
  b.begin();
  b.hold('W4', 12);
  b.tick(1);
  b.place('W4', -60, 300);
  b.tick(5);
  assert.deepEqual(b.heard(), [`0:05,0${NB}: le cube E4 (rouge) est hors du tapis. Il ne rapporte plus rien.`]);
  b.tick(5.1);
  assert.deepEqual(b.heard(), [], 'said once');
  assert.equal(b.line(deliverLineId('W4')).detail, `hors du tapis${NB}: aucun point`);
  assert.equal(b.line(pickLineId('W4')).detail, `pris à 0:01,0, mais le cube est hors du tapis${NB}: aucun point`);
  b.place('W2', 1300, 300);
  b.tick(6);
  assert.equal(b.line(pickLineId('W2')).detail, `le cube est hors du tapis${NB}: aucun point`);
});

test('a cube that is not on the field', () => {
  const b = bench();
  b.remove('W2');
  b.remove('W3');
  assert.equal(b.line(pickLineId('W2')).detail, 'ce cube n’est pas sur le terrain');
  assert.equal(b.line(deliverLineId('W2')).detail, 'ce cube n’est pas sur le terrain');
  assert.deepEqual(b.words(LINE_BLUE), ['Cube bleu (E3)', 'ce cube n’est pas sur le terrain']);
});

test('the blue cube: pushed, moved, back in its place, picked up, held, off the mat', () => {
  const b = bench();
  const home = cubeHome('W3');
  b.begin();
  // 3 mm: nothing; just over 5 mm: moved, and the distance never reads like the limit ("5,1")
  b.place('W3', home.x + 3, home.y);
  b.tick(6);
  assert.deepEqual(b.heard(), []);
  b.place('W3', home.x + 5.04, home.y);
  b.tick(6.2);
  assert.deepEqual(b.heard(), [`0:06,2${NB}: le cube E3 (bleu) a été déplacé de sa place. Le cube bleu doit rester à sa place.`]);
  assert.deepEqual(b.words(LINE_BLUE), ['Cube bleu (E3)', `déplacé${NB}: à 5,1 mm de sa place, -5`]);
  b.place('W3', home.x + 7.6, home.y);
  b.tick(6.3);
  assert.equal(b.line(LINE_BLUE).detail, `déplacé${NB}: à 8 mm de sa place, -5`);
  // dragged back: "de retour à sa place"
  b.place('W3', home.x, home.y);
  b.tick(6.5);
  assert.deepEqual(b.heard(), [`0:06,5${NB}: le cube E3 (bleu) est de retour à sa place.`]);
  assert.equal(b.line(LINE_BLUE).detail, 'laissé en place');
  // off the mat (never picked up)
  b.place('W3', -70, 900);
  b.tick(6.8);
  assert.equal(b.line(LINE_BLUE).detail, `déplacé${NB}: il est hors du tapis, -5`);
  assert.ok(!b.heard().some((text) => /hors du tapis/.test(text)), 'no "off the mat" sentence of its own');
  // picked up: -5 for good
  b.hold('W3', 15);
  b.tick(7.04);
  assert.ok(b.heard().includes(`0:07,0${NB}: le cube E3 (bleu) a été pris${NB}: -${BLUE_PENALTY}. Le cube bleu doit rester à sa place.`), b.heard().join(' | '));
  assert.equal(b.line(LINE_BLUE).detail, `déplacé${NB}: le robot le tient, -5`);
  b.place('W3', home.x, home.y);
  b.tick(8);
  assert.equal(b.line(LINE_BLUE).detail, `déplacé${NB}: pris à 0:07,0, -5`);
  b.hold('W3', 15);
  b.tick(9);
  b.end();
  assert.equal(b.line(LINE_BLUE).detail, `déplacé${NB}: le robot le tenait encore, -5`);
});

test('the finish park: the left or the right pad, during and after the match', () => {
  for (const pad of ['left', 'right'] as const) {
    const b = bench();
    b.begin();
    b.robotAt({ x: FINISH_PADS[pad].cx, y: FINISH_PADS[pad].cy, heading: 0 });
    b.tick(20);
    const which = pad === 'left' ? 'de gauche' : 'de droite';
    assert.deepEqual(b.words(LINE_PARK), ['Se garer sur une aire d’arrivée', `le robot touche l’aire d’arrivée ${which}`]);
    b.end();
    assert.equal(b.line(LINE_PARK).detail, `le robot a touché l’aire d’arrivée ${which}`);
  }
});

test('restarts: one, two (the times cut with a semicolon - they have a decimal comma), and the clean run', () => {
  const b = bench();
  b.begin();
  b.tick(12.34);
  b.restart();
  assert.equal(b.line(LINE_RESTARTS).detail, '1 relance (0:12,3), -10');
  assert.equal(b.line(LINE_CLEAN).detail, 'une relance a été utilisée');
  b.tick(40.19);
  b.restart();
  assert.equal(b.line(LINE_RESTARTS).detail, `2 relances (0:12,3${NB}; 0:40,1), -${RESTART_PENALTY} chacune`);
});

test('a robot that does not start inside the start zone', () => {
  const b = bench();
  b.robotAt({ x: 300, y: 1100, heading: 0 });
  b.begin();
  b.tick(0.01);
  assert.deepEqual(b.words(LINE_START_POSITION), [
    'Partir de l’intérieur de la zone de départ',
    'le robot n’est pas parti tout entier dans la zone de départ\u00a0– un arbitre ne lancerait pas ce match',
  ]);
});

test('every word of the hand-made fields is French', () => {
  // the cases above once more, on six arrangements (the blue cube in each warehouse), every sheet checked
  const texts = new Set<string>();
  for (const i of [0, 3, 9, 12, 16, 21]) {
    const s = allScenarios()[i];
    const b = bench(s);
    const [a, c, d] = WAREHOUSE_IDS.filter((w) => s.cubes[w] !== 'blue');
    const blue = WAREHOUSE_IDS.find((w) => s.cubes[w] === 'blue') as WarehouseId;
    const own = (w: WarehouseId) => (s.cubes[w] === 'green' ? 'green' : 'red');
    const other = (w: WarehouseId) => (own(w) === 'red' ? 'green' : 'red');
    const steps: Array<() => void> = [
      () => b.robotAt(OUT_OF_START),
      () => b.hold(a, 12),
      () => b.inBay(a, own(a)),
      () => b.inBay(c, other(c)),
      () => b.place(d, -60, 300),
      () => b.place(blue, cubeHome(blue).x + 6, cubeHome(blue).y),
      () => b.place(blue, cubeHome(blue).x, cubeHome(blue).y),
      () => b.hold(blue, 15),
      () => b.robotAt({ x: FINISH_PADS.right.cx, y: FINISH_PADS.right.cy, heading: 0 }),
      () => b.restart(),
    ];
    b.begin();
    steps.forEach((step, k) => {
      step();
      b.tick(1 + k * 1.37);
      for (const text of b.heard()) texts.add(text);
      for (const line of b.score().lines) texts.add(line.label).add(line.detail);
    });
    b.end();
    for (const line of b.score().lines) texts.add(line.label).add(line.detail);
  }
  for (const text of texts) assert.equal(frenchProblem(text), null, text);
  assert.ok(texts.size > 60, `${texts.size} texts`);
});

test('the English words of Warehouse Sort, moved to ../warehouse-sort/referee-words.ts as they were: every member pinned', () => {
  // (the outputs of the English referee before the move: ../warehouse-sort/game.test.ts and the
  // English page check most of them in place; this list holds every one, so that a word of the
  // English page cannot change by mistake while the French one is worked on)
  const PINS: Array<[keyof RefereeWords, unknown[], string]> = [
  ['clock', [83.42], '1:23.4'],
  ['cm', [1235], '123.5'],
  ['decimal', ['5.1'], '5.1'],
  ['warehouse', ['W2'], 'W2'],
  ['cubeName', ['W2','red'], 'cube W2 (red)'],
  ['bayName', ['green'], 'the green bay'],
  ['startZone', [], 'Start zone'],
  ['warehouseZone', ['W1','green'], 'W1 green'],
  ['bayZone', ['red'], 'Red bay'],
  ['bayZone', ['green'], 'Green bay'],
  ['finishPad', [], 'Finish pad'],
  ['leftStart', [5,'0:01.2'], '+5 points at 0:01.2: the robot left the start zone.'],
  ['pickedUp', [5,'0:02.5','cube W2 (red)'], '+5 points at 0:02.5: cube W2 (red) picked up.'],
  ['inBay', ['0:03.0','cube W1 (green)','the green bay'], '0:03.0: Cube W1 (green) is in the green bay.'],
  ['inWrongBay', ['0:04.0','cube W2 (red)','the green bay'], '0:04.0: Cube W2 (red) is in the green bay - the wrong bay.'],
  ['offMat', ['0:05.0','cube W4 (red)'], '0:05.0: Cube W4 (red) is off the mat. It scores nothing now.'],
  ['bluePickedUp', ['0:07.0','cube W3 (blue)',5], '0:07.0: Cube W3 (blue) was picked up: -5. The blue cube must stay where it is.'],
  ['blueMoved', ['0:06.2','cube W3 (blue)'], '0:06.2: Cube W3 (blue) was moved out of its place. The blue cube must stay where it is.'],
  ['blueBack', ['0:06.5','cube W3 (blue)'], '0:06.5: Cube W3 (blue) is back in its place.'],
  ['leaveStartLabel', [], 'Leave the start zone'],
  ['doneAt', ['0:01.2'], 'done at 0:01.2'],
  ['neverLeft', [], 'the robot never left the start zone'],
  ['notYetLeft', [], 'not yet - drive out of the start zone'],
  ['pickLabel', ['cube W2 (red)'], 'Pick up cube W2 (red)'],
  ['notOnField', [], 'this cube is not on the field'],
  ['offMatPlace', [], 'off the mat'],
  ['wrongBayPlace', [], 'in the wrong bay'],
  ['pickedButLost', ['0:02.5','off the mat'], 'picked at 0:02.5, but the cube is off the mat: no points'],
  ['lostNoPoints', ['in the wrong bay'], 'the cube is in the wrong bay: no points'],
  ['grippedNotPicked', ['1','4'], 'gripped, but not lifted 1 cm or carried 4 cm'],
  ['notPicked', [], 'not picked up'],
  ['notYetPicked', ['1','4'], 'not yet - grip it, then lift it 1 cm or carry it 4 cm'],
  ['deliverLabel', ['cube W2 (red)','the red bay'], 'Cube W2 (red) in the red bay'],
  ['inBaySince', ['the red bay','0:09.9'], 'in the red bay since 0:09.9'],
  ['inBayNow', ['the red bay'], 'in the red bay'],
  ['wrongBayDetail', ['the green bay',5], 'in the green bay - wrong bay, -5'],
  ['offMatNoPoints', [], 'off the mat: no points'],
  ['heldPutDown', [true,'the red bay'], 'the robot still held it - put it down in the red bay'],
  ['heldPutDown', [false,'the red bay'], 'the robot is holding it - put it down in the red bay'],
  ['liftedPutDown', ['the red bay'], 'not standing on the mat - put it down in the red bay'],
  ['touchingRobot', ['the green bay',true], 'in the green bay, but touching the robot'],
  ['touchingRobot', ['the green bay',false], 'in the green bay, but touching the robot - move away'],
  ['partlyInBay', ['the red bay'], 'only partly in the red bay - the whole cube must be inside'],
  ['notInBay', [], 'not in a bay'],
  ['notYetInBay', ['the red bay'], 'not yet - put it in the red bay'],
  ['parkLabel', [], 'Park on a finish pad'],
  ['parkedOn', ['left',true], 'the robot touched the left pad'],
  ['parkedOn', ['right',false], 'the robot touches the right pad'],
  ['noPadAtEnd', [], 'the robot did not touch a finish pad at the end'],
  ['mustTouchPad', [], 'at the end the robot must touch a round pad (left or right)'],
  ['cleanLabel', [], 'Clean run: no restart'],
  ['noRestart', [], 'no restart'],
  ['noRestartSoFar', [], 'no restart so far'],
  ['restartUsed', [], 'a restart was used'],
  ['restartsLabel', [], 'Restarts'],
  ['noRestarts', [], 'no restarts'],
  ['restartsDetail', [1,['0:12.3'],10], '1 restart (0:12.3), -10 each'],
  ['restartsDetail', [2,['0:12.3','0:40.1'],10], '2 restarts (0:12.3, 0:40.1), -10 each'],
  ['wrongLabel', [], 'Cubes in the wrong bay'],
  ['noneWrong', [], 'none'],
  ['wrongDetail', [['cube W2 (red)'],5], 'cube W2 (red), -5 each'],
  ['wrongDetail', [['cube W1 (green)','cube W2 (red)'],5], 'cube W1 (green), cube W2 (red), -5 each'],
  ['blueLabel', ['W3'], 'Blue cube (W3)'],
  ['leftAlone', [], 'left alone'],
  ['blueMovedDetail', ['5.1 mm from its place',5], 'moved: 5.1 mm from its place, -5'],
  ['robotHolds', [true], 'the robot still held it'],
  ['robotHolds', [false], 'the robot is holding it'],
  ['pickedUpAt', ['0:07.0'], 'picked up at 0:07.0'],
  ['itIsOffMat', [], 'it is off the mat'],
  ['fromItsPlace', ['5.1'], '5.1 mm from its place'],
  ['lastDeliveryLabel', [], 'Time of the last correct delivery'],
  ['tieDetail', [1,'0:03.0'], 'for a tie: 1 cube in the right bay, the last one put there at 0:03.0'],
  ['tieDetail', [2,'0:09.9'], 'for a tie: 2 cubes in the right bay, the last one put there at 0:09.9'],
  ['startPositionLabel', [], 'Start inside the start zone'],
  ['startPositionDetail', [], 'the robot did not start completely inside the start zone - a referee would not start this match'],
  ];
  for (const [member, args, english] of PINS) {
    const value = EN_REFEREE_WORDS[member];
    assert.equal(typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value, english, member);
  }
  assert.deepEqual(new Set(PINS.map(([member]) => member)), new Set(Object.keys(EN_REFEREE_WORDS)), 'every member is pinned');
  assert.deepEqual(Object.keys(FR_REFEREE_WORDS).sort(), Object.keys(EN_REFEREE_WORDS).sort(), 'the French words have the same members');
});

// =============================================================================================
// The numbers and names in the words
// =============================================================================================

test('the French referee writes the time as the French screen does: "1:23,4", tenths cut off', () => {
  for (const t of [0, 0.04, 0.05, 1.23, 9.95, 59.99, 60, 83.42, 83.47, 89.999, 90, 125.4, -3]) {
    assert.equal(FR_REFEREE_WORDS.clock(t), clock(t).replace('.', ','), String(t));
    assert.equal(FR_REFEREE_WORDS.clock(t), FR_TEXT.refereeTime(t), `${t}: the referee and the screen agree`);
  }
  assert.equal(FR_REFEREE_WORDS.clock(83.47), '1:23,4');
  assert.equal(FR_REFEREE_WORDS.cm(1235), '123,5');
  assert.equal(FR_REFEREE_WORDS.cm(40), '4');
  assert.equal(FR_REFEREE_WORDS.decimal('5.1'), '5,1');
  assert.equal(FR_REFEREE_WORDS.cubeName('W2', 'red'), 'cube E2 (rouge)');
  assert.equal(FR_REFEREE_WORDS.cubeName('W1', 'green'), 'cube E1 (vert)', 'a cube is "vert"');
  assert.equal(FR_REFEREE_WORDS.bayName('green'), 'la baie verte', 'a bay is "verte"');
  assert.deepEqual(WAREHOUSE_IDS.map(frWarehouse), ['E1', 'E2', 'E3', 'E4']);
});

test('blueMove keeps its English; blueMoveIn says it in the words it is given', () => {
  const sim = createSimulation({ game: robotEnFeteGame, scenario: defaultScenario(), program: {} });
  const cube = sim.world.bodies.find((body) => body.id === cubeBodyId('W3')) as Body;
  assert.equal(blueMove(cube, cube.id, null, false), 'the robot is holding it');
  assert.equal(blueMoveIn(EN_REFEREE_WORDS, cube, cube.id, null, true), 'the robot still held it');
  assert.equal(blueMoveIn(FR_REFEREE_WORDS, cube, cube.id, null, true), 'le robot le tenait encore');
  assert.equal(blueMoveIn(FR_REFEREE_WORDS, cube, null, 4.56, false), 'pris à 0:04,5');
  assert.equal(blueMoveIn(FR_REFEREE_WORDS, cube, null, null, false), null);
});

test('every body of the French game gets a French name from the screen\'s table (FR_TEXT.bodyName): "le cube E1", never W1 - W4', () => {
  for (const s of allScenarios()) {
    const names = robotEnFeteGame.createBodies(s).map((body) => FR_TEXT.bodyName(body.id));
    assert.deepEqual(names, ['le cube E1', 'le cube E2', 'le cube E3', 'le cube E4']);
  }
  assert.equal(FR_TEXT.bodyName('wall', ROBOT_EN_FETE_WORDS.tableEdge), 'le bord de la table');
});

// =============================================================================================
// Codes
// =============================================================================================

test('codes: "VR-BR" is the default arrangement; letter case, spaces, dashes and wide letters do not matter; G is read as vert', () => {
  const s = defaultScenario();
  assert.equal(FR_CODEC.encode(s), 'VR-BR');
  assert.equal(robotEnFeteGame.encodeScenario(s), 'VR-BR');
  for (const code of ['VR-BR', 'vr-br', 'V R B R', ' vrbr ', 'ＶＲ－ＢＲ', 'GR-BR', 'gr br', 'gR-Br']) {
    assert.deepEqual(robotEnFeteGame.decodeScenario(code), s, code);
  }
  for (const one of allScenarios()) {
    const code = robotEnFeteGame.encodeScenario(one);
    assert.match(code, /^[RVB]{2}-[RVB]{2}$/);
    assert.equal(code, encodeScenario(one).replace(/G/g, 'V'), 'the English code with V for G');
    assert.deepEqual(robotEnFeteGame.decodeScenario(code), one);
    assert.deepEqual(robotEnFeteGame.decodeScenario(encodeScenario(one)), one, 'a Warehouse Sort code works here too');
  }
  assert.equal(new Set(allScenarios().map((one) => robotEnFeteGame.encodeScenario(one))).size, 24);
  // what cannot be played, and what is no code
  for (const code of ['RR-VV', 'BB-RV', 'RR-RB', 'VV-VB', '', '   ', 'VRB', 'VR-BRX', '1', '12', 'XR-BR', 'VR-BR' + '-'.repeat(100)]) {
    assert.equal(robotEnFeteGame.decodeScenario(code), null, JSON.stringify(code));
  }
  assert.equal(robotEnFeteGame.decodeScenario(undefined as unknown as string), null);
  assert.deepEqual(FR_CODEC.ofCode('RR-VV'), { cubes: { W1: 'red', W2: 'red', W3: 'green', W4: 'green' } }, 'what it says, though it cannot be played');
  // the English codes are unchanged: no V there
  assert.equal(decodeScenario('VR-BR'), null);
  assert.equal(scenarioOfCode('VR-BR'), null);
  assert.deepEqual(decodeScenario('GR-BR'), s);
});

test('codes: the English encodeScenario, decodeScenario and scenarioOfCode still take one argument (as .map() calls them)', () => {
  assert.equal(encodeScenario.length, 1);
  assert.equal(decodeScenario.length, 1);
  assert.equal(scenarioOfCode.length, 1);
  assert.deepEqual([defaultScenario(), allScenarios()[0]].map(encodeScenario), ['GR-BR', encodeScenario(allScenarios()[0])]);
  assert.deepEqual(['GR-BR', 'x', 'RR-GB'].map(decodeScenario), [defaultScenario(), null, decodeScenario('RR-GB')]);
  assert.deepEqual(['RR-GG'].map(scenarioOfCode), [{ cubes: { W1: 'red', W2: 'red', W3: 'green', W4: 'green' } }]);
});

test('codes: a codec needs one capital letter of its own per colour', () => {
  assert.throws(() => scenarioCodec({ red: 'R', green: 'R', blue: 'B' }));
  assert.throws(() => scenarioCodec({ red: 'r', green: 'G', blue: 'B' }));
  assert.throws(() => scenarioCodec({ red: 'R', green: 'GG', blue: 'B' }));
  assert.throws(() => scenarioCodec({ red: 'R', green: 'V', blue: 'B' }, { R: 'green' }), 'an extra letter that is already one');
  assert.throws(() => scenarioCodec({ red: 'R', green: 'V', blue: 'B' }, { G: 'yellow' as CubeColor }));
});

test('an arrangement that cannot be played, in French: the same problems as in English, one sentence each', () => {
  const p = (s: unknown) => robotEnFeteGame.scenarioProblems!(s as WarehouseSortScenario);
  assert.deepEqual(p(null), ['Chaque entrepôt a besoin d’un cube rouge, vert ou bleu.']);
  assert.deepEqual(p({ cubes: { W1: 'yellow', W2: 'red', W3: 'blue', W4: 'green' } }), ['Chaque entrepôt a besoin d’un cube rouge, vert ou bleu.']);
  assert.deepEqual(p(FR_CODEC.ofCode('RR-RR')), ['Un cube doit être bleu.', 'Au moins un cube doit être vert.']);
  assert.deepEqual(p(FR_CODEC.ofCode('BB-BV')), ['Il y a 3 cubes bleus. Un seul cube peut être bleu.', 'Au moins un cube doit être rouge.']);
  assert.deepEqual(p(FR_CODEC.ofCode('VV-BV')), ['Au moins un cube doit être rouge.']);
  assert.deepEqual(p(FR_CODEC.ofCode('RR-BR')), ['Au moins un cube doit être vert.']);
  assert.equal(robotEnFeteGame.describeScenario(FR_CODEC.ofCode('RR-RR')!), 'Cette disposition ne peut pas être jouée. Un cube doit être bleu. Au moins un cube doit être vert.');
  assert.equal(robotEnFeteGame.describeScenario(defaultScenario()), `Rouge${NB}: E2, E4. Vert${NB}: E1. Bleu${NB}: E3 (à laisser).`);
  // every code of R, V and B: the same problems as the English game finds, as many, in French
  const letters = ['R', 'V', 'B'];
  for (const a of letters) for (const b of letters) for (const c of letters) for (const d of letters) {
    const s = FR_CODEC.ofCode(`${a}${b}${c}${d}`)!;
    const fr = FR_SCENARIO_TEXT.scenarioProblems(s);
    assert.equal(fr.length, scenarioProblems(s).length, `${a}${b}-${c}${d}`);
    for (const sentence of [...fr, FR_SCENARIO_TEXT.describeScenario(s)]) assert.equal(frenchProblem(sentence), null, sentence);
    assert.equal(robotEnFeteGame.decodeScenario(`${a}${b}-${c}${d}`) !== null, fr.length === 0);
  }
  // (the English, unchanged)
  assert.equal(describeScenario(defaultScenario()), 'Red: W2, W4. Green: W1. Blue: W3 (leave it).');
  assert.equal(FR_SCENARIO_WORDS.warehouse('W4'), 'E4');
});

// =============================================================================================
// T7: a French match never names W1 - W4
// =============================================================================================

test('a French match names no W1 - W4: not in a console line (the French screen\'s own lines too) and not in a score line', () => {
  // The six examples of Warehouse Sort: the French examples (fete-*) are built with the same
  // blocks and numbers (../robot-en-fete/samples.ts), so they make the same moves; their printed
  // texts are checked with the examples themselves.
  const consoleOf = (event: SimEvent) =>
    FR_TEXT.describeEvent(event, {
      ...restartFacts(robotEnFeteGame),
      left: Infinity,
      match: ROBOT_EN_FETE_WORDS.match,
      grabbed: ROBOT_EN_FETE_WORDS.grabbed,
      tableEdge: ROBOT_EN_FETE_WORDS.tableEdge,
    });
  let lines = 0;
  const kinds = new Set<string>();
  for (const sample of SAMPLE_PROGRAMS) {
    for (const s of allScenarios()) {
      const sim = createSimulation({ game: robotEnFeteGame, scenario: s, program: sample.program, seed: 1 });
      sim.start();
      let restarted = false;
      while (sim.status === 'running') {
        sim.step(10);
        // (one restart in the one-cube example: the restart line, the cube back in its warehouse)
        if (sample.id === 'sort-one-cube' && !restarted && sim.world.time >= 8) {
          restarted = true;
          sim.restart();
        }
        for (const event of sim.drainEvents()) {
          const line = consoleOf(event);
          if (!line) continue;
          kinds.add(event.type);
          lines++;
          assert.doesNotMatch(line.text, /\bW[1-4]\b/, `${sample.id} on ${encodeScenario(s)}: "${line.text}"`);
        }
      }
      for (const line of sim.score().lines) {
        assert.doesNotMatch(line.label, /\bW[1-4]\b/, line.label);
        assert.doesNotMatch(line.detail, /\bW[1-4]\b/, line.detail);
      }
    }
  }
  assert.ok(lines > 500, `${lines} console lines`);
  for (const kind of ['log', 'grab', 'release', 'restart', 'finish']) assert.ok(kinds.has(kind), `a "${kind}" line was checked`);
});
