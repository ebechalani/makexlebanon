/**
 * The rules window of Logistique intelligente (./rules.ts) against the game and its referee:
 *   - every number in its sentences is a number the code has - compared one by one with the
 *     constant that holds it (the referee's, the field's, the robot's, or a rules constant of
 *     ./rules.ts with its page), with a decimal comma (« 23,7 »); a number on no list here fails;
 *   - every count written in letters (« dix cubes », « huit entrepôts ») is its constant too;
 *   - the numbers the window works out (17,1 degrees, 5 mm of margin, 63,58 % and 63,57 %, the
 *     robot's size) are what the referee and the engine do - tried out on the game itself;
 *   - what the simulator only assumes is in the second part, and the rules part does not say it;
 *   - French for children: « tu », short sentences, French typography, « dessous / dessus » for
 *     the layers, no English left.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lightOf } from '../../core/engine-sensors';
import { createSimulation } from '../../core/simulation';
import type { Body, Simulation } from '../../core/types';
import {
  ARENA_SIZE,
  BLACK,
  CUBE_SIZE,
  FRAME_HEIGHT,
  GREY_BAND,
  ORANGE,
  START_AREA,
  STORAGE_SQUARE_COLORS,
  STORAGE_SQUARE_IDS,
  STORAGE_SQUARE_SIZE,
  WAREHOUSE_IDS,
  WAREHOUSE_SIZE,
  WAREHOUSES,
  WHITE,
  YELLOW,
  YELLOW_LINE_PATCHES,
  type WarehouseId,
} from '../../logistique-intelligente/field';
import {
  CUBE_COUNT,
  LINE_FAULTS,
  MATCH_DURATION,
  MAX_PER_WAREHOUSE,
  MAX_SCORE,
  POINTS_PER_CUBE,
  TOUCH_MM,
  VIOLATION_POINTS,
  coveredWarehouse,
  cubeId,
  logistiqueGame,
} from '../../logistique-intelligente/game';
import { LOGISTIQUE_ROBOT, START_POSE } from '../../logistique-intelligente/robot';
import { RULES_SETUP, type LogistiqueScenario } from '../../logistique-intelligente/scenario';
import { armHeight, gripper, moveCm, print, probeDetects, program, script, wait, whenStart } from '../../vm/builder';
import { LIGHT_LINE_THRESHOLD, WAREHOUSE_SORT_ROBOT, robotReach } from '../../warehouse-sort/robot';
import type { RulesSection } from '../SimulatorApp';
import { FR_TEXT } from '../text/fr';
import { frSensorValue } from '../text/fr-common';
import {
  ARM_LIMIT_PERCENT,
  ARM_PAIR_PERCENT,
  ARM_TOP_CUBE_PERCENT,
  COVER_MARGIN_MM,
  COVER_TURN_DEG,
  DIAMONDS,
  LAYERS,
  LOGISTIQUE_ASSUMPTIONS,
  LOGISTIQUE_RULES,
  LOGISTIQUE_RULES_NOTE,
  ROBOT_HEIGHT,
  ROBOT_LENGTH,
  ROBOT_WIDTH,
  RULES_COUNTDOWN_S,
  RULES_CUBE_TOLERANCE_MM,
  RULES_ROBOT_MAX_KG,
  RULES_ROBOT_MAX_MM,
  RULES_SEASON,
  RULES_START_AREA_MM,
  RULES_VERSION,
  RULES_WAREHOUSE_MM,
  RULES_WHEEL_MAX_MM,
  STACKS_NEEDED,
} from './rules';
import { WAREHOUSE_COUNT } from './words';

const NB = ' ';
const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(LOGISTIQUE_RULES);
const ASSUMED = sentences(LOGISTIQUE_ASSUMPTIONS.sections);
/** (the texts with their no-break spaces made plain spaces, to read what they say; the typography is checked on the texts themselves) */
const plain = (text: string): string => text.replace(/ /g, ' ');
const RULES_TEXT = plain(RULES.join('\n'));
const ASSUMED_TEXT = plain(ASSUMED.join('\n'));
const EVERY_TEXT = [LOGISTIQUE_RULES_NOTE, LOGISTIQUE_ASSUMPTIONS.title, LOGISTIQUE_ASSUMPTIONS.note ?? '', ...RULES, ...ASSUMED];

const cm = (mm: number): number => Math.round(mm) / 10;
const G = LOGISTIQUE_ROBOT.gripper;
const HALF = CUBE_COUNT / LAYERS;

/**
 * The numbers the window may say, and what each one is. A number in a sentence that is not one
 * of these values fails the test - so a new number needs its constant here.
 */
const KNOWN_NUMBERS: ReadonlyArray<[number, string]> = [
  [MATCH_DURATION, 'MATCH_DURATION'],
  [Math.floor(MATCH_DURATION / 60), 'the minutes of a match'],
  [MATCH_DURATION % 60, 'the seconds after them'],
  [POINTS_PER_CUBE, 'POINTS_PER_CUBE'],
  [MAX_SCORE, 'MAX_SCORE'],
  [CUBE_COUNT, 'CUBE_COUNT'],
  [VIOLATION_POINTS, 'VIOLATION_POINTS'],
  [cm(ARENA_SIZE), 'ARENA_SIZE in cm'],
  [cm(RULES_START_AREA_MM), 'the start area of the rules in cm'],
  [cm(START_AREA.w), 'the width of the start area on the mat in cm'],
  [cm(STORAGE_SQUARE_SIZE), 'a square of the cross in cm'],
  [cm(CUBE_SIZE), 'CUBE_SIZE in cm'],
  [cm(WAREHOUSE_SIZE), 'WAREHOUSE_SIZE in cm'],
  [cm(RULES_WAREHOUSE_MM), 'the warehouse of the rules in cm'],
  [GREY_BAND, 'GREY_BAND (mm)'],
  [cm(FRAME_HEIGHT), 'FRAME_HEIGHT in cm'],
  [RULES_CUBE_TOLERANCE_MM, 'the cube tolerance of the rules (mm)'],
  [cm(RULES_ROBOT_MAX_MM.length), 'the longest robot of the rules in cm'],
  [cm(RULES_ROBOT_MAX_MM.width), 'the widest robot of the rules in cm'],
  [cm(RULES_ROBOT_MAX_MM.height), 'the highest robot of the rules in cm'],
  [cm(RULES_WHEEL_MAX_MM), 'the largest wheel of the rules in cm'],
  [RULES_ROBOT_MAX_KG, 'the heaviest robot of the rules (kg)'],
  [RULES_SEASON, 'the season of the rules'],
  [1, 'the number of the first cube'],
  [HALF, 'the last bottom cube'],
  [HALF + 1, 'the first top cube'],
  [COVER_MARGIN_MM, 'COVER_MARGIN_MM'],
  [COVER_TURN_DEG, 'COVER_TURN_DEG'],
  [WAREHOUSES.E1.turnedDeg, 'the turn of a diamond'],
  [TOUCH_MM, 'TOUCH_MM'],
  [ARM_TOP_CUBE_PERCENT, 'ARM_TOP_CUBE_PERCENT'],
  [ARM_PAIR_PERCENT, 'ARM_PAIR_PERCENT'],
  [cm(ROBOT_LENGTH), 'the length of the robot in cm'],
  [cm(ROBOT_WIDTH), 'the width of the robot in cm'],
  [cm(LOGISTIQUE_ROBOT.wheelDiameter), 'the wheels of the robot in cm'],
  [cm(ROBOT_HEIGHT), 'the height of the robot, arm up, in cm'],
  [0, 'the lowest total; the points of a cube taken off'],
];

/** The numbers of a French text (« 23,7 » is 23.7; « mBot2 », « E1 », « S1 » and « V2.0 » are names, not numbers). */
const frenchNumbers = (text: string): number[] => [...text.matchAll(/(?<![\p{L}\p{N},.])-?\d+(?:,\d+)?/gu)].map((match) => Math.abs(Number(match[0].replace(',', '.'))));

test('every number in the rules window is a number of the game, or a number of the rules with its constant', () => {
  const unknown: string[] = [];
  let found = 0;
  for (const text of EVERY_TEXT) {
    for (const value of frenchNumbers(text)) {
      found++;
      if (!KNOWN_NUMBERS.some(([known]) => Math.abs(known - value) < 1e-9)) unknown.push(`${value} in "${text}"`);
    }
  }
  assert.deepEqual(unknown, [], 'a number that is not a constant');
  assert.ok(found >= 50, `${found} numbers checked`);
});

/**
 * The counts the window writes in letters: each phrase, from the word on, and the number it
 * must be. A count in letters that is on no list here fails the test. (null: plain language, no
 * count of the game - « deux choses différentes ».)
 */
const KNOWN_COUNTS: ReadonlyArray<[RegExp, number | null, number, string]> = [
  [/^dix cubes/, CUBE_COUNT, 10, 'CUBE_COUNT'],
  [/^huit (petits carrés|entrepôts)/, WAREHOUSE_COUNT, 8, 'the warehouses'],
  [/^cinq carrés/, STORAGE_SQUARE_IDS.length, 5, 'the squares of the cross'],
  [/^deux étages/, LAYERS, 2, 'the layers'],
  [/^cinq cubes/, HALF, 5, 'the cubes of a layer'],
  [/^deux cubes : un dessous, un dessus/, LAYERS, 2, 'a stack at the start'],
  [/^deux entrepôts des coins du haut/, DIAMONDS.length, 2, 'the diamonds'],
  [/^cinq secondes, puis le match commence/, RULES_COUNTDOWN_S, 5, 'the countdown of the rules'],
  [/^deux cubes valides/, MAX_PER_WAREHOUSE, 2, 'MAX_PER_WAREHOUSE'],
  [/^deux piles de deux cubes/, STACKS_NEEDED, 2, 'the stacks a score of 500 needs'],
  [/^deux cubes\.$/, MAX_PER_WAREHOUSE, 2, 'the cubes of such a stack'],
  [/^deux cubes ne peuvent pas couvrir le même entrepôt/i, MAX_PER_WAREHOUSE, 2, 'two cubes on the mat'],
  [/^deux cubes sur un troisième/, LAYERS, 2, 'a stack put on a cube'],
  [/^deux du dessous peuvent compter/, MAX_PER_WAREHOUSE, 2, 'the two lower cubes of a stack of three'],
  [/^deux bandes jaunes/, Object.keys(YELLOW_LINE_PATCHES).length, 2, 'the yellow patches of the top line'],
  [/^deux fautes/, null, 2, 'out, in, out again: the example of two exits'],
  [/^deux cubes qui se rencontrent seulement par une arête/i, null, 2, 'two cubes that meet (Q18)'],
  [/^deux choses différentes/, null, 2, 'plain language'],
];

test('every count written in letters is its constant: « dix cubes », « huit entrepôts », « deux étages de cinq cubes » …', () => {
  const words: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };
  const unknown: string[] = [];
  let found = 0;
  for (const text of EVERY_TEXT.map(plain)) {
    for (const match of text.matchAll(/(?<![\p{L}])(deux|trois|quatre|cinq|six|sept|huit|neuf|dix)(?![\p{L}])/giu)) {
      found++;
      const rest = text.slice(match.index);
      const known = KNOWN_COUNTS.find(([phrase]) => phrase.test(rest));
      if (!known) {
        unknown.push(rest.slice(0, 40));
        continue;
      }
      const [, value, written, what] = known;
      assert.equal(words[match[1].toLowerCase()], written, `${what}: ${rest.slice(0, 40)}`);
      if (value !== null) assert.equal(value, written, `${what}: the game says ${value}`);
    }
  }
  assert.deepEqual(unknown, [], 'a count in letters that is on no list');
  assert.ok(found >= 20, `${found} counts checked`);
  // the same counts from the other side: the game's numbers
  assert.deepEqual([CUBE_COUNT, WAREHOUSE_COUNT, STORAGE_SQUARE_IDS.length, LAYERS, MAX_PER_WAREHOUSE, STACKS_NEEDED], [10, 8, 5, 2, 2, 2]);
});

test("the numbers are the referee's and the field's - the points, the time, the sizes - with a decimal comma", () => {
  assert.equal(POINTS_PER_CUBE * CUBE_COUNT, MAX_SCORE);
  assert.ok(RULES_TEXT.includes(`Les points (${MAX_SCORE} au plus)`));
  assert.ok(RULES_TEXT.includes('En tout : 10 × 50 = 500 points au plus.'));
  assert.ok(RULES_TEXT.includes(`+${POINTS_PER_CUBE} pour chaque cube valide à la fin du match.`));
  assert.ok(RULES_TEXT.includes(`Les fautes (-${VIOLATION_POINTS} points chacune)`));
  assert.ok(RULES_TEXT.includes(`Un match dure ${logistiqueGame.matchDuration} secondes, c’est-à-dire 2 minutes et 30 secondes.`));
  assert.ok(RULES_TEXT.includes('Le terrain est un carré de 120 cm sur 120 cm, entouré d’un cadre.'));
  assert.ok(RULES_TEXT.includes('Elle mesure 25 cm sur 25 cm : une moitié bleue, une moitié rouge.'));
  assert.ok(RULES_TEXT.includes('une croix de cinq carrés de 5 cm'));
  assert.ok(RULES_TEXT.includes('Un cube mesure 5 cm de chaque côté.'));
  assert.ok(RULES_TEXT.includes('le robot ne dépasse pas 25 cm de long, 20 cm de large et 20 cm de haut'));
  assert.ok(RULES_TEXT.includes('mesurent au plus 7 cm de diamètre'));
  assert.ok(RULES_TEXT.includes('Il pèse au plus 2 kg, batterie comprise.'));
  assert.ok(ASSUMED_TEXT.includes('Leur dessin et le tapis disent 4 cm. Le simulateur utilise 4 cm.'));
  assert.ok(ASSUMED_TEXT.includes('la zone de départ mesure 24,8 cm de large (25 cm dans les règles)'));
  assert.ok(ASSUMED_TEXT.includes('une bande grise de 5 mm tout autour'));
  assert.ok(ASSUMED_TEXT.includes('Ici, il mesure 5 cm.'));
  assert.ok(ASSUMED_TEXT.includes('Les règles permettent 2 mm de plus ou de moins.'));
  assert.ok(ASSUMED_TEXT.includes('« Toucher » veut dire : à moins de 0,5 mm, vu de dessus comme de côté.'));
  assert.ok(ASSUMED_TEXT.includes('23,7 cm de long, 13 cm de large, des roues de 6,4 cm, 9,5 cm de haut bras levé'));
  assert.ok(ASSUMED_TEXT.includes('Si le temps est écoulé, c’est 150 secondes.'));
  assert.ok(ASSUMED_TEXT.includes('Chaque sortie du robot coûte 20 points tout de suite'));
  for (const text of EVERY_TEXT) assert.doesNotMatch(text.replace(RULES_VERSION, ''), /\d\.\d/, `a decimal point: ${text}`);
  for (const text of EVERY_TEXT) assert.doesNotMatch(text, /\d x \d/, `"x" for "times": ${text}`);
  // the constants of the rules, with their pages (./rules.ts)
  assert.deepEqual(
    [RULES_START_AREA_MM, RULES_WAREHOUSE_MM, RULES_CUBE_TOLERANCE_MM, RULES_ROBOT_MAX_MM, RULES_WHEEL_MAX_MM, RULES_ROBOT_MAX_KG, RULES_COUNTDOWN_S, RULES_SEASON, RULES_VERSION],
    [250, 50, 2, { length: 250, width: 200, height: 200 }, 70, 2, 5, 2024, 'V2.0'],
  );
  // the game's: the field measured on the mat, the referee
  assert.deepEqual([ARENA_SIZE, START_AREA.w, START_AREA.h, STORAGE_SQUARE_SIZE, CUBE_SIZE, WAREHOUSE_SIZE, GREY_BAND, FRAME_HEIGHT, TOUCH_MM], [1200, 248, 250, 50, 50, 40, 5, 50, 0.5]);
  // the sheet of the referee: ten lines of 50 and the faults' line, 500 in all
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) });
  const sheet = sim.score();
  assert.equal(sheet.max, MAX_SCORE);
  assert.deepEqual(
    sheet.lines.map((line) => [line.id, line.max]),
    [...Array.from({ length: CUBE_COUNT }, (_, i) => [cubeId(i + 1), POINTS_PER_CUBE]), [LINE_FAULTS, 0]],
  );
});

// =============================================================================================
// What the window works out, against the referee and the engine
// =============================================================================================

/** A cube of the game, put somewhere by hand (only its footprint matters to « covers »). */
function cubeAt(w: WarehouseId, dx: number, dy: number, deg: number): Body {
  const [first] = logistiqueGame.createBodies(RULES_SETUP);
  const { x, y } = WAREHOUSES[w].centre;
  return { ...first, x: x + dx, y: y + dy, angle: (deg * Math.PI) / 180, z: 0, restingOn: null };
}
const covers = (w: WarehouseId, dx: number, dy: number, deg: number): boolean => coveredWarehouse(cubeAt(w, dx, dy, deg)) === w;

test('« 5 mm de marge de chaque côté », « tourné jusqu’à 17,1 degrés », E1 and E4 « à 45 degrés »: what the referee counts as covering', () => {
  assert.equal(COVER_MARGIN_MM, 5);
  assert.equal(COVER_TURN_DEG, 17.1);
  for (const w of ['E2', 'E5', 'E8'] as const) {
    for (const [dx, dy] of [
      [COVER_MARGIN_MM, 0],
      [-COVER_MARGIN_MM, 0],
      [0, COVER_MARGIN_MM],
      [COVER_MARGIN_MM, -COVER_MARGIN_MM],
    ]) {
      assert.ok(covers(w, dx, dy, 0), `${w} ${dx} ${dy}`);
      assert.ok(!covers(w, dx * 1.002, dy * 1.002, 0), `${w} ${dx} ${dy} and a little more`);
    }
    // the largest turn (to a tenth) that still covers is the window's number, either way
    let largest = 0;
    for (let tenths = 0; tenths <= 450; tenths++) if (covers(w, 0, 0, tenths / 10)) largest = tenths / 10;
    assert.equal(largest, COVER_TURN_DEG, w);
    assert.ok(covers(w, 0, 0, -COVER_TURN_DEG) && !covers(w, 0, 0, -(COVER_TURN_DEG + 0.1)), w);
  }
  // the diamonds: never straight, always turned 45° (± the same 17,1)
  assert.deepEqual(DIAMONDS, ['E1', 'E4']);
  for (const w of DIAMONDS) {
    assert.ok(!covers(w, 0, 0, 0), `${w} straight`);
    assert.ok(covers(w, 0, 0, WAREHOUSES[w].turnedDeg), `${w} at 45°`);
    assert.ok(covers(w, 0, 0, WAREHOUSES[w].turnedDeg - COVER_TURN_DEG) && covers(w, 0, 0, WAREHOUSES[w].turnedDeg + COVER_TURN_DEG), `${w} 45 ± 17,1`);
    assert.ok(!covers(w, 0, 0, WAREHOUSES[w].turnedDeg + COVER_TURN_DEG + 0.1), `${w} 45 + 17,2`);
    // « dans les coins du haut »
    assert.ok(WAREHOUSES[w].centre.y < 100 && (WAREHOUSES[w].centre.x < 100 || WAREHOUSES[w].centre.x > ARENA_SIZE - 100), w);
  }
  // « plus larges qu’un cube droit »: the diamond is 56,6 mm across
  assert.ok(WAREHOUSE_SIZE * Math.SQRT2 > CUBE_SIZE);
  // « il faut au moins deux piles de deux cubes »: with one stack fewer, 500 cannot be reached
  assert.ok((WAREHOUSE_COUNT + STACKS_NEEDED - 1) * POINTS_PER_CUBE < MAX_SCORE);
  assert.ok((WAREHOUSE_COUNT + STACKS_NEEDED) * POINTS_PER_CUBE >= MAX_SCORE);
  assert.equal(MAX_PER_WAREHOUSE * WAREHOUSE_COUNT * POINTS_PER_CUBE >= MAX_SCORE, true);
});

/** Play blocks on the game (the one setup of the rules) until the program ends, at most `seconds`. */
function play(blocks: Parameters<typeof script>[1], seconds = 20): Simulation<LogistiqueScenario> {
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: program([script(whenStart(), blocks)]) });
  sim.start();
  while (sim.status === 'running' && sim.world.time < seconds) sim.step(1);
  return sim;
}
/** The arm to p %, straight to the stack of the square « bas » (cubes 5 and 10), the claw closed, back 15 cm. */
const takeTheNearestStack = (percent: number) => play([armHeight(percent), moveCm('forward', 32.95), gripper('close'), moveCm('backward', 15)]);
const where = (sim: Simulation<LogistiqueScenario>, n: number) => {
  const body = sim.world.bodies.find((b) => b.id === cubeId(n));
  assert.ok(body, `cube ${n}`);
  return { x: Math.round(body.x * 10) / 10, y: Math.round(body.y * 10) / 10, z: body.z, on: body.restingOn };
};

test('« Bras à 63,58 % ou plus » takes the top cube alone, « 63,57 % ou moins » the bottom cube with the top cube on it: on the game, with the blocks', () => {
  // the limit, from the gripper: the claw's underside at 5 + 0,7 p mm stops reaching the bottom cube (0 - 50 mm) at 49,5 mm
  assert.equal(G.liftDownHeight + ((G.liftUpHeight - G.liftDownHeight) * ARM_LIMIT_PERCENT) / 100, CUBE_SIZE - 0.5);
  assert.ok(ARM_PAIR_PERCENT < ARM_LIMIT_PERCENT && ARM_LIMIT_PERCENT < ARM_TOP_CUBE_PERCENT);
  assert.deepEqual([ARM_TOP_CUBE_PERCENT, ARM_PAIR_PERCENT], [63.58, 63.57]);
  assert.ok(ASSUMED_TEXT.includes('Bras à 63,58 % ou plus : la pince prend le cube du dessus d’une pile, tout seul.'));
  assert.ok(ASSUMED_TEXT.includes('Bras à 63,57 % ou moins : la pince prend le cube du dessous, et le cube posé dessus vient avec lui.'));

  for (const percent of [ARM_TOP_CUBE_PERCENT, 100]) {
    const sim = takeTheNearestStack(percent);
    assert.equal(sim.world.robot.gripper.holding, cubeId(10), `${percent} %`);
    assert.deepEqual(where(sim, 5), { x: 600, y: 652, z: 0, on: null }, `${percent} %: the bottom cube stays`);
    assert.deepEqual(where(sim, 10), { x: 600, y: 802, z: 50, on: null }, `${percent} %: the top cube, alone in the claw`);
  }
  for (const percent of [ARM_PAIR_PERCENT, 0]) {
    const sim = takeTheNearestStack(percent);
    assert.equal(sim.world.robot.gripper.holding, cubeId(5), `${percent} %`);
    assert.deepEqual(where(sim, 5), { x: 600, y: 802, z: 0, on: null }, `${percent} %: the bottom cube in the claw`);
    assert.deepEqual(where(sim, 10), { x: 600, y: 802, z: 50, on: cubeId(5) }, `${percent} %: the top cube comes with it`);
  }
  // nothing else moved, and holding a cube scores nothing
  const sim = takeTheNearestStack(ARM_PAIR_PERCENT);
  const start = new Map(logistiqueGame.createBodies(RULES_SETUP).map((b) => [b.id, `${b.x} ${b.y} ${b.z}`]));
  const moved = sim.world.bodies.filter((b) => start.get(b.id) !== `${b.x} ${b.y} ${b.z}`).map((b) => b.id);
  assert.deepEqual(moved, [cubeId(5), cubeId(10)]);
  assert.equal(sim.score().total, 0);
});

test('the robot of the window: its size within the rules, its start, its servos, what its sensors see', () => {
  // « 23,7 cm de long, 13 cm de large, des roues de 6,4 cm, 9,5 cm de haut bras levé. Il respecte les tailles des règles. »
  assert.equal(LOGISTIQUE_ROBOT, WAREHOUSE_SORT_ROBOT, 'the mBot2 of Tri d’entrepôt');
  assert.deepEqual([ROBOT_LENGTH, ROBOT_WIDTH, LOGISTIQUE_ROBOT.wheelDiameter, ROBOT_HEIGHT], [237, 130, 64, 95]);
  assert.equal(ROBOT_LENGTH, robotReach(LOGISTIQUE_ROBOT).front + robotReach(LOGISTIQUE_ROBOT).rear);
  assert.equal(ROBOT_HEIGHT, G.liftUpHeight + G.fingerHeight);
  assert.ok(LOGISTIQUE_ROBOT.chassisHeight < ROBOT_HEIGHT);
  assert.ok(ROBOT_LENGTH <= RULES_ROBOT_MAX_MM.length && ROBOT_WIDTH <= RULES_ROBOT_MAX_MM.width && ROBOT_HEIGHT <= RULES_ROBOT_MAX_MM.height);
  assert.ok(LOGISTIQUE_ROBOT.wheelDiameter <= RULES_WHEEL_MAX_MM);
  // « Le servo S1 lève le bras, le servo S2 ouvre et ferme la pince. »
  assert.deepEqual([G.liftServo, G.clawServo], ['S1', 'S2']);
  assert.ok(ASSUMED_TEXT.includes('Le servo S1 lève le bras, le servo S2 ouvre et ferme la pince.'));
  // « Au départ, il regarde vers le haut, au milieu de la zone de départ. »
  const { front, rear } = robotReach(LOGISTIQUE_ROBOT);
  assert.equal(START_POSE.heading, 0);
  assert.equal(START_POSE.x, START_AREA.x + START_AREA.w / 2);
  assert.equal(START_POSE.y - (front - rear) / 2, START_AREA.y + START_AREA.h / 2);
  assert.ok(START_POSE.y - front >= START_AREA.y && START_POSE.y + rear <= START_AREA.y + START_AREA.h, 'tout entier dans la zone de départ');
  // « La zone de départ est au milieu du bord du bas. »
  assert.equal(START_AREA.x + START_AREA.w / 2, ARENA_SIZE / 2);
  assert.equal(START_AREA.y + START_AREA.h, ARENA_SIZE);
  // « Le capteur quad RGB voit les lignes blanches. Il prend aussi pour une ligne le jaune clair » - not the orange, not the black
  assert.ok(LOGISTIQUE_ROBOT.quadRgb.lightLine);
  assert.equal(LOGISTIQUE_ROBOT.quadRgb.lineThreshold, LIGHT_LINE_THRESHOLD);
  for (const [rgb, line] of [
    [WHITE, true],
    [YELLOW, true],
    [ORANGE, false],
    [BLACK, false],
  ] as const) {
    assert.equal(lightOf(rgb) >= LIGHT_LINE_THRESHOLD, line, JSON.stringify(rgb));
  }
  // (« le carré du centre de la croix »: the one light-yellow square of the five)
  assert.deepEqual(
    STORAGE_SQUARE_IDS.filter((square) => STORAGE_SQUARE_COLORS[square] === YELLOW),
    ['centre'],
  );
  // « Quand la pince tient un cube, son capteur de couleur voit yellow (jaune). »
  assert.ok(logistiqueGame.createBodies(RULES_SETUP).every((body) => body.colorName === 'yellow'));
  assert.equal(frSensorValue('yellow'), 'yellow (jaune)');
});

/** What the probe L1 of the quad RGB sensor reports (« line » or not) with its spot's middle at (x, y), the robot facing up. */
function probeSeesLine(x: number, y: number): boolean {
  // (L1 is 85 mm ahead of the axle and 7.5 mm to its left)
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: program([script(whenStart(), [print(probeDetects('L1', 'line')), wait(1)])]), startPose: { x: x + 7.5, y: y + 85, heading: 0 } });
  sim.start();
  for (let i = 0; i < 5; i++) sim.step(1);
  const said = String(sim.world.robot.screen?.lines?.[0] ?? '');
  assert.match(said, /^(true|false)$/, `the probe at (${x}, ${y})`);
  return said === 'true';
}

test('« le jaune clair » the window names is a line for the quad RGB sensor; the 1 mm yellow border of a warehouse is not: wherever the probe stands across it, its spot takes in orange or black too', () => {
  // a yellow patch of the top line: a line; the orange of a warehouse and the black field: not
  const patch = YELLOW_LINE_PATCHES.left;
  assert.equal(probeSeesLine(patch.x + patch.w / 2, patch.y + patch.h / 2), true, 'a yellow patch of the top line');
  const cross = WAREHOUSES.E5.centre;
  assert.equal(probeSeesLine(cross.x, cross.y), false, 'the orange of E5');
  assert.equal(probeSeesLine(cross.x - 40, cross.y), false, 'the black field beside E5');
  // across the left and right borders of E5, every 0.2 mm from 3 mm outside to 3 mm inside: never a line
  const seen: string[] = [];
  for (const edge of [cross.x - WAREHOUSE_SIZE / 2, cross.x + WAREHOUSE_SIZE / 2]) {
    for (let d = -3; d <= 3 + 1e-9; d += 0.2) if (probeSeesLine(edge + d, cross.y)) seen.push(`x ${(edge + d).toFixed(1)}`);
  }
  assert.deepEqual(seen, []);
  assert.doesNotMatch(ASSUMED_TEXT, /bord fin/);
});

test('the match of the window: no restart, the buttons are the screen’s, one fault only', () => {
  // « Il n’y a pas de relance. Pour recommencer, appuie sur Démarrer »; « Le bouton « Terminé » »
  assert.deepEqual(logistiqueGame.restartRules, { maxRestarts: 0 });
  assert.equal(logistiqueGame.restartPenalty, 0);
  assert.equal(FR_TEXT.start, 'Démarrer');
  assert.equal(FR_TEXT.finishedWord, 'Terminé');
  assert.ok(ASSUMED_TEXT.includes('appuie sur Démarrer : le terrain est remis en place.'));
  assert.ok(ASSUMED_TEXT.includes('Le bouton « Terminé », c’est l’équipe qui demande d’arrêter.'));
  // « Le simulateur ne compte qu’une faute : le robot qui sort du terrain. »: one line of faults, no other line takes points
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) });
  const lines = sim.score().lines;
  assert.deepEqual(
    lines.filter((line) => line.max <= 0).map((line) => line.id),
    [LINE_FAULTS],
  );
  assert.equal(logistiqueGame.matchDuration, MATCH_DURATION);
});

// =============================================================================================
// The two parts
// =============================================================================================

test('what the simulator only assumes is in the second part; the rules part does not say it', () => {
  assert.equal(LOGISTIQUE_ASSUMPTIONS.title, 'Ce que ce simulateur suppose');
  assert.equal(LOGISTIQUE_ASSUMPTIONS.note, `Ce ne sont pas des règles. Les règles ne disent pas ces choses, ou disent deux choses différentes${NB}: alors le simulateur a dû choisir.`);
  assert.equal(LOGISTIQUE_RULES_NOTE, `La mission normale du thème «${NB}Smart Logistics${NB}» de MakeX Inspire 2024 (guide des règles V2.0), résumée en français.`);
  const assumed: Array<[string, RegExp]> = [
    ['the warehouse: 4 cm, not 5 (Q1)', /Les règles disent qu’un entrepôt mesure 5 cm\. Leur dessin et le tapis disent 4 cm\. Le simulateur utilise 4 cm\./],
    ['the names E1 - E8 (Q14)', /Ici, ils s’appellent E1 à E8, de gauche à droite et de haut en bas\./],
    ['the start area of the mat', /la zone de départ mesure 24,8 cm de large \(25 cm dans les règles\)\. Le simulateur utilise le tapis, jusqu’au cadre\./],
    ['the frame centred on the print', /Le cadre est posé au milieu du tapis imprimé : à l’intérieur, on voit une bande grise de 5 mm tout autour\./],
    ['the inner side of the frame (Q15)', /Ici, le terrain s’arrête au bord intérieur du cadre\./],
    ['the height of the frame (Q2)', /Les règles ne donnent pas la hauteur du cadre\. Ici, il mesure 5 cm\./],
    ['the raised claw over the frame', /Bras levé, la pince passe au-dessus du cadre : le robot sort alors du terrain, et c’est une faute\./],
    ['a cube over the frame, held or not', /Un cube qui passe au-dessus du cadre, même tenu par la pince, sort du terrain : l’arbitre l’enlève\./],
    ['no -20 for a cube (Q16)', /Les règles appellent cela une « violation », mais ne donnent pas de pénalité\. Ici, le cube est seulement enlevé : il ne rapporte rien et ne coûte rien\./],
    ['but the claw that carries it over the frame: -20', /Mais la pince qui porte un cube passe au-dessus du cadre avec lui : cette faute du robot coûte 20 points\./],
    ['the cube exactly 5 cm (Q11)', /Un cube mesure exactement 5 cm\. Les règles permettent 2 mm de plus ou de moins\./],
    ['the numbers of the cubes (Q14)', /Ici, les cubes portent un numéro, de 1 à 10, pour que tu les reconnaisses : dessous les cubes 1 à 5, dessus les cubes 6 à 10/],
    ['« couvrir »', /« Couvrir tout l’entrepôt » veut dire : vu de dessus, le cube cache tout le carré, bord jaune compris\./],
    ['the margin and the turn', /Un cube bien centré a 5 mm de marge de chaque côté\. Il peut aussi être tourné, jusqu’à 17,1 degrés\./],
    ['the diamonds, and no example', /E1 et E4 sont des losanges, plus larges qu’un cube droit\. .* à 45 degrés\. Aucun exemple ne le fait : à toi d’essayer\./],
    ['« toucher »', /« Toucher » veut dire : à moins de 0,5 mm, vu de dessus comme de côté\. Une pince levée bien au-dessus d’un cube ne le touche pas\./],
    ['a face touches, an edge does not (Q18)', /Un cube du dessus qui repose aussi en partie sur un cube voisin touche ce cube-là\. Deux cubes qui se rencontrent seulement par une arête ne se touchent pas\./],
    ['the cube below must count (Q3)', /Un cube posé sur un autre cube compte seulement si le cube du dessous compte\./],
    ['the fall, and the console', /Poussé, il tombe à côté, sur le tapis ou sur un cube voisin, si son milieu n’est plus au-dessus du cube du dessous : la console le dit\./],
    ['by the frame: over it, and taken off', /Si une pile est à moins de 5 cm du cadre, son cube du dessus qui tombe de ce côté n’a pas la place de se poser : il passe par-dessus le cadre, et l’arbitre l’enlève\. Le cube du dessous ne bouge pas\./],
    ['flat cubes', /Les cubes restent toujours à plat : ils ne roulent pas et ne basculent pas\. Un cube tombé sur le tapis reste en jeu\./],
    ['the third cube (Q17)', /On peut poser une pile de deux cubes sur un troisième cube\. Mais un entrepôt compte au plus deux cubes valides : le cube du troisième étage ne rapporte rien, seuls les deux du dessous peuvent compter\./],
    ['the arm: the top cube alone', /Bras à 63,58 % ou plus/],
    ['the arm: the pair (Q8)', /Bras à 63,57 % ou moins : .* Les règles laissent choisir la méthode\./],
    ['no countdown', /Il n’y a pas de compte à rebours : le chrono part quand le programme démarre\./],
    ['« Terminé », the program ended (Q7)', /Le match finit aussi quand le programme est fini et que le robot ne bouge plus\./],
    ['the end time (Q7)', /Le temps de fin, c’est ce moment-là\. Si le temps est écoulé, c’est 150 secondes\./],
    ['one fault only, and the CyberPi buttons (Q9)', /Le simulateur ne compte qu’une faute : le robot qui sort du terrain\. Les autres ne peuvent pas arriver ici, sauf toucher les boutons du CyberPi \(voir plus bas\)\./],
    ['no warning, one per exit (Q4, Q5)', /Chaque sortie du robot coûte 20 points tout de suite, sans avertissement avant\. S’il sort, revient, puis ressort, cela fait deux fautes\./],
    ['the total never below 0 (Q6)', /Le total n’est jamais en dessous de 0\./],
    ['no restart; « Démarrer »', /Il n’y a pas de relance\. Pour recommencer, appuie sur Démarrer : le terrain est remis en place\./],
    ['nobody moves anything by hand', /Pendant un match, personne ne peut déplacer le robot ou un cube à la main\./],
    ['the CyberPi buttons (Q9)', /Les boutons du CyberPi marchent pendant un match\. En compétition, toucher le robot après le départ est une faute : le simulateur ne la compte pas\./],
    ['the robot of Tri d’entrepôt', /C’est le mBot2 de Tri d’entrepôt, avec la pince à l’avant/],
    ['the light yellow reads as a line (not the 1 mm border of a warehouse: the probe never reads it as a line)', /Il prend aussi pour une ligne le jaune clair : les deux bandes jaunes de la ligne du haut et le carré du centre de la croix\./],
    ['the colour sensor reads yellow (jaune)', /Quand la pince tient un cube, son capteur de couleur voit yellow \(jaune\)\./],
    ['the start pose, movable (Q10)', /Au départ, il regarde vers le haut, au milieu de la zone de départ\. Avant le match, tu peux le déplacer et le tourner dans la zone de départ\./],
    ['a held cube is not the robot’s size (Q13)', /Un cube que le robot tient ne compte pas dans sa taille\./],
    ['a perfect robot', /Le robot est parfait : ses roues ne glissent pas et ses capteurs ne se trompent pas\. Un vrai robot dévie\./],
    ['what is left out', /Les missions mystères, la manette Bluetooth, le contrôle du robot avant le match \(poids, pièces, électronique\) et les règles pour l’équipe\./],
  ];
  for (const [what, sentence] of assumed) {
    assert.match(ASSUMED_TEXT, sentence, what);
    assert.doesNotMatch(RULES_TEXT, sentence, `${what}: not in the rules part`);
  }
  // the rules part says nothing of the simulator, of its names and numbers, or of what the rules leave open
  for (const word of [/simulateur/i, /(?<![\p{L}])Ici(?![\p{L}])/u, /%/, /\bE[1-8]\b/, /Démarrer|Terminé/, /\b4 cm\b/, /0,5/, /24,8/, /mm\b/, /hauteur du cadre/, /numéro/, /entrepôt mesure/, /dessous compte/, /arête/, /CyberPi/]) {
    assert.doesNotMatch(RULES_TEXT, word, String(word));
  }
  // the rules' own words, in the rules part
  for (const sentence of [
    'Un cube posé sur le tapis est valide s’il couvre tout l’entrepôt et s’il ne touche pas le robot.',
    'Un cube posé sur un autre cube est valide aussi s’il ne touche que ce cube-là, si ce cube couvre tout l’entrepôt, et s’il ne touche pas le robot.',
    'Un entrepôt compte au plus deux cubes valides.',
    'Vu de dessus, un cube ne doit jamais sortir du terrain. Sinon, l’arbitre l’enlève et il ne rapporte plus rien.',
    'Pendant le match, personne ne peut relancer le robot ni le modifier.',
    'À points égaux, l’équipe qui a fini son match le plus vite passe devant.',
  ]) {
    assert.ok(RULES_TEXT.includes(sentence), sentence);
  }
  // the order of the window: the mission first, the scoring and the faults, the ranking last; the second part ends with what is left out
  assert.deepEqual(
    LOGISTIQUE_RULES.map((section) => plain(section.title)),
    ['La mission', 'Le terrain', 'Au départ', 'Le robot', 'Le match', 'Les points (500 au plus)', 'Les cubes enlevés', 'Les fautes (-20 points chacune)', 'Le classement'],
  );
  assert.deepEqual(
    LOGISTIQUE_ASSUMPTIONS.sections.map((section) => section.title),
    ['Le tapis et le cadre', 'Les cubes', 'La pince', 'Le match', 'Le robot', 'Pas dans le simulateur'],
  );
});

test('French for children: « tu », short sentences, French typography, « dessous / dessus » for the layers, no English left', () => {
  for (const text of EVERY_TEXT) {
    assert.ok(text.length <= 240, `${text.length}: ${text}`);
    // (the longest sentence is the one about the numbers of the cubes: 174 characters)
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 180, `${sentence.length}: ${sentence}`);
    assert.doesNotMatch(text, /(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/iu, `« tu », not « vous »: ${text}`);
    assert.doesNotMatch(text, /'/, `a straight apostrophe: ${text}`);
    assert.doesNotMatch(text, /"/, `English quotation marks: ${text}`);
    assert.doesNotMatch(text, /\.\.\./, text);
    assert.doesNotMatch(text, /«(?! )|(?<! )»/, `« » with no-break spaces: ${text}`);
    assert.doesNotMatch(text, /(?<! )[:;!?%]/, `a no-break space before : ; ! ? %: ${text}`);
    assert.doesNotMatch(text, / [:;!?%»]|« /, `a plain space at a mark: ${text}`);
    assert.doesNotMatch(text, / - |(?<! )–/, `a dash: « – » after a no-break space: ${text}`);
    assert.doesNotMatch(text, / {2}|^\s|\s$/, `two spaces, or a space at an end: ${text}`);
    assert.doesNotMatch(text, /\bW[1-8]\b/, `the warehouses are E1 - E8: ${text}`);
    // a number on the line of its unit: « 25 cm », « 20 points » with a no-break space
    assert.doesNotMatch(text, /\d (cm|mm|kg|points?|secondes?|minutes|degrés)(?![\p{L}])/u, `a plain space between a number and its unit: ${text}`);
    // a layer is « dessous / dessus »; « de haut en bas » is the reading order of the mat
    assert.doesNotMatch(text.replace(/de haut en bas/g, ''), /(?<![\p{L}])en (haut|bas)(?![\p{L}])/u, `« en haut / en bas »: ${text}`);
    // English words a French line must not have (the names are allowed: Smart Logistics, MakeX Inspire, CyberPi, mBot2, quad RGB, Bluetooth, EVA, and the sensor's value yellow)
    const without = text.replace(/Smart Logistics|MakeX Inspire|CyberPi|mBot2|quad RGB|Bluetooth|EVA|yellow/g, '');
    assert.doesNotMatch(without, /(?<![\p{L}])(the|of|and|is|it|with|for|to|at|in|by|cube is|robot is|warehouse|frame|arena|stack|claw|gripper|score sheet|start zone)(?![\p{L}])/iu, `English: ${text}`);
  }
  // the counted layers: the window says « dessous » and « dessus »
  assert.match(ASSUMED_TEXT, /dessous les cubes 1 à 5, dessus les cubes 6 à 10/);
  assert.match(RULES_TEXT, /un dessous, un dessus/);
  // every section with a heading of its own and at least one line; no heading or line twice in a part
  for (const part of [LOGISTIQUE_RULES, LOGISTIQUE_ASSUMPTIONS.sections]) {
    assert.equal(new Set(part.map((section) => section.title)).size, part.length, 'no heading twice');
    for (const section of part) {
      assert.ok(section.items.length > 0, section.title);
      assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no line twice`);
    }
  }
});
