/**
 * The rules window of Robot en fête 2027 (./rules.ts) against the game and against the English
 * window of Warehouse Sort (../warehouse-sort/rules.ts):
 *   - every number in its sentences is the number the code has - compared one by one with the
 *     constant that holds it (with a decimal comma: "23,7"); a number that is on no list here
 *     fails the test,
 *   - it is the English window part for part, section for section and line for line, and each
 *     French line says the same numbers as its English line,
 *   - the points add up to the highest score the referee gives,
 *   - what the simulator only assumes is in the second part, and the rules part does not say it,
 *   - French for children: "tu", short sentences, French typography, no English left,
 *   - two sentences that can be tried out are tried out on the French game itself.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TABLE_MARGIN } from '../../core/engine';
import { createSimulation } from '../../core/simulation';
import { robotEnFeteGame } from '../../robot-en-fete/game';
import { moveCm, program, script, wait, whenStart } from '../../vm/builder';
import { CUBE_SIZE, FINISH_PADS, MAT_SIZE } from '../../warehouse-sort/field';
import {
  BLUE_MOVED_MM,
  BLUE_PENALTY,
  CARRY_MM,
  CUBES_TO_SORT,
  CUBE_COUNT,
  LIFT_MM,
  LINE_CLEAN,
  LINE_RESTARTS,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_CLEAN,
  POINTS_DELIVER,
  POINTS_LEAVE_START,
  POINTS_PARK,
  POINTS_PICK,
  RESTART_PENALTY,
  TOUCH_MM,
  WRONG_BAY_PENALTY,
} from '../../warehouse-sort/game';
import { WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import { defaultScenario } from '../../warehouse-sort/scenario';
import type { RulesPart, RulesSection } from '../SimulatorApp';
import { RULES_EXAMPLE_MAX, RULES_FOUR_CUBES_MAX, WAREHOUSE_SORT_ASSUMPTIONS, WAREHOUSE_SORT_RULES, WAREHOUSE_SORT_RULES_NOTE, robotLength, robotWidth } from '../warehouse-sort/rules';
import { ROBOT_EN_FETE_ASSUMPTIONS, ROBOT_EN_FETE_RULES, ROBOT_EN_FETE_RULES_NOTE } from './rules';

const NB = ' ';
const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(ROBOT_EN_FETE_RULES);
const ASSUMED = sentences(ROBOT_EN_FETE_ASSUMPTIONS.sections);
const RULES_TEXT = RULES.join('\n');
const ASSUMED_TEXT = ASSUMED.join('\n');
const EVERY_TEXT = [ROBOT_EN_FETE_RULES_NOTE, ROBOT_EN_FETE_ASSUMPTIONS.title, ROBOT_EN_FETE_ASSUMPTIONS.note ?? '', ...RULES, ...ASSUMED];
/** the English window, in the same order */
const EVERY_ENGLISH = [
  WAREHOUSE_SORT_RULES_NOTE,
  WAREHOUSE_SORT_ASSUMPTIONS.title,
  WAREHOUSE_SORT_ASSUMPTIONS.note ?? '',
  ...sentences(WAREHOUSE_SORT_RULES),
  ...sentences(WAREHOUSE_SORT_ASSUMPTIONS.sections),
];

const cm = (mm: number): number => Math.round(mm) / 10;

/**
 * The numbers the window may say, and what each one is. A number in a sentence that is not one
 * of these values fails the test - so a new number needs its constant here.
 */
const KNOWN_NUMBERS: ReadonlyArray<[number, string]> = [
  [POINTS_LEAVE_START, 'POINTS_LEAVE_START'],
  [POINTS_PICK, 'POINTS_PICK'],
  [POINTS_DELIVER, 'POINTS_DELIVER'],
  [WRONG_BAY_PENALTY, 'WRONG_BAY_PENALTY'],
  [POINTS_PARK, 'POINTS_PARK'],
  [POINTS_CLEAN, 'POINTS_CLEAN'],
  [RESTART_PENALTY, 'RESTART_PENALTY'],
  [MAX_SCORE, 'MAX_SCORE'],
  [RULES_EXAMPLE_MAX, "the rules' example maximum"],
  [RULES_FOUR_CUBES_MAX, "the rules' line items for four red and green cubes"],
  [CUBE_COUNT, 'CUBE_COUNT (four warehouses, four cubes)'],
  [CUBES_TO_SORT, 'CUBES_TO_SORT (three red or green cubes, one blue)'],
  [BLUE_PENALTY, 'BLUE_PENALTY'],
  [BLUE_MOVED_MM, 'BLUE_MOVED_MM'],
  [MATCH_DURATION, 'MATCH_DURATION'],
  [cm(MAT_SIZE), 'MAT_SIZE in cm'],
  [cm(LIFT_MM), 'LIFT_MM in cm'],
  [cm(CARRY_MM), 'CARRY_MM in cm'],
  [cm(CUBE_SIZE), 'CUBE_SIZE in cm'],
  [TOUCH_MM, 'TOUCH_MM'],
  [cm(TABLE_MARGIN), 'TABLE_MARGIN in cm'],
  [cm(2 * Math.max(FINISH_PADS.left.rx, FINISH_PADS.left.ry)), 'the size of a finish pad in cm'],
  [cm(robotLength(WAREHOUSE_SORT_ROBOT)), 'the length of the robot in cm'],
  [cm(robotWidth(WAREHOUSE_SORT_ROBOT)), 'the width of the robot in cm'],
  [cm(WAREHOUSE_SORT_ROBOT.frontColorSensor.rangeMm), 'the range of the colour sensor at the claw in cm'],
  [0, 'the lowest total'],
  // ("-5 points" for the referee's cube return of the rules: the same number as the wrong bay)
];

/** The numbers of a French text ("23,7" is 23.7; "mBot2" is a name, not a number). */
const frenchNumbers = (text: string): number[] => [...text.matchAll(/(?<![\p{L}\p{N},.])-?\d+(?:,\d+)?/gu)].map((match) => Math.abs(Number(match[0].replace(',', '.'))));
/** ... and of an English one ("23.7"). */
const englishNumbers = (text: string): number[] => [...text.matchAll(/(?<![\p{L}\p{N},.])-?\d+(?:\.\d+)?/gu)].map((match) => Math.abs(Number(match[0])));

test('every number in the French rules window is a number of the game', () => {
  const unknown: string[] = [];
  let found = 0;
  for (const text of EVERY_TEXT) {
    for (const value of frenchNumbers(text)) {
      found++;
      if (!KNOWN_NUMBERS.some(([known]) => Math.abs(known - value) < 1e-9)) unknown.push(`${value} in "${text}"`);
    }
  }
  assert.deepEqual(unknown, [], 'a number that is not a constant of the game');
  assert.ok(found >= 30, `${found} numbers checked`);
});

test('the English window part for part and line for line: each French line says the numbers of its English line', () => {
  const shape = (rules: readonly RulesSection[], part: RulesPart) => [rules.map((s) => s.items.length), part.sections.map((s) => s.items.length)];
  assert.deepEqual(shape(ROBOT_EN_FETE_RULES, ROBOT_EN_FETE_ASSUMPTIONS), shape(WAREHOUSE_SORT_RULES, WAREHOUSE_SORT_ASSUMPTIONS));
  assert.equal(EVERY_TEXT.length, EVERY_ENGLISH.length);
  EVERY_TEXT.forEach((french, i) => {
    const english = EVERY_ENGLISH[i];
    assert.deepEqual(frenchNumbers(french).sort((a, b) => a - b), englishNumbers(english).sort((a, b) => a - b), `"${french}" / "${english}"`);
    assert.notEqual(french, english, 'translated');
  });
});

test("the numbers are the referee's: the points, the time, the restart, the sizes - with a decimal comma", () => {
  assert.equal(POINTS_LEAVE_START + CUBES_TO_SORT * POINTS_PICK + CUBES_TO_SORT * POINTS_DELIVER + POINTS_PARK + POINTS_CLEAN, MAX_SCORE);
  assert.ok(RULES_TEXT.includes(`Points (${MAX_SCORE} au plus)`));
  assert.ok(RULES_TEXT.includes(`En tout${NB}: 5 + 3 × 5 + 3 × 15 + 10 + 5 = 80.`));
  assert.ok(RULES_TEXT.includes('Le cube bleu ne rapporte aucun point.'));
  assert.ok(RULES_TEXT.includes(`Un match dure ${robotEnFeteGame.matchDuration} secondes.`));
  assert.ok(RULES_TEXT.includes(`cela coûte ${robotEnFeteGame.restartPenalty} points`));
  assert.equal(robotEnFeteGame.restartRules, undefined, 'no limit on restarts, as the window says');
  assert.ok(RULES_TEXT.includes('Les règles ne limitent pas le nombre de relances.'));
  assert.ok(RULES_TEXT.includes('Le tapis mesure 123,5 × 123,5 cm.'));
  assert.ok(ASSUMED_TEXT.includes('23,7 cm de long et 13 cm de large'));
  assert.ok(ASSUMED_TEXT.includes('Une aire mesure environ 16 cm de large.'));
  assert.ok(ASSUMED_TEXT.includes(`«${NB}Toucher${NB}» veut dire${NB}: à moins de 0,5 mm.`));
  assert.ok(ASSUMED_TEXT.includes('au plus à 3,5 cm devant le milieu de la pince'), 'the colour sensor at the claw');
  for (const text of EVERY_TEXT) assert.doesNotMatch(text, /\d\.\d/, `a decimal point: ${text}`);
  for (const text of EVERY_TEXT) assert.doesNotMatch(text, /\d x \d/, `"x" for "times": ${text}`);
  // the referee's own sheet gives the same highest score
  const sim = createSimulation({ game: robotEnFeteGame, scenario: defaultScenario(), program: program([script(whenStart(), [])]) });
  assert.equal(sim.score().max, MAX_SCORE);
});

test('what the simulator only assumes is in the second part; the rules part does not say it', () => {
  assert.equal(ROBOT_EN_FETE_ASSUMPTIONS.title, 'Ce que ce simulateur suppose');
  assert.match(ROBOT_EN_FETE_ASSUMPTIONS.note ?? '', /^Ce ne sont pas des règles\./);
  const assumed: Array<[string, RegExp]> = [
    ['the size of a cube', /Un cube mesure 4 cm de chaque côté et il est léger/],
    ['the table around the mat', /Le tapis est posé sur une table\. .* s’arrêtent à 10 cm du tapis/],
    ['touching a pad is enough', /Ici, toucher une aire suffit\./],
    ['a held cube at a restart', /Un cube dans la pince au moment d’une relance retourne dans son entrepôt, le cube bleu aussi\./],
    ['its square taken at a restart', /Si un autre cube est sur son carré, il est posé le plus près possible\. Un cube bleu posé à plus de 5 mm de sa place compte comme déplacé\./],
    ['a cube off the mat stays', /Le simulateur ne le fait pas : le cube reste où il est\./],
    ['the start zone of the rules and of the mat', /Les règles disent que la zone de départ est une surface verte\. Sur le tapis, c’est la surface avec le cadre jaune en bas/],
    ['the finish pads of the rules and of the mat', /Les règles disent que les aires d’arrivée sont des cercles jaunes avec un damier\. Sur le tapis, ce sont les deux images rondes à gauche et à droite/],
    ['85 or 80', /Dans leur exemple, les règles donnent 85 points au plus\. Leurs propres points font 80 pour 3 cubes \(100 pour 4\)\./],
    ['the turned mat', /Ici, tout le tapis est tourné vers la droite, pour que le robot parte en regardant vers le haut\./],
    ["the blue cube is the simulator's", /Les règles écrites n’ont que des cubes rouges et verts\. Ce simulateur ajoute un cube bleu/],
    ['what moving the blue cube costs', /Les règles ne disent pas ce que coûte le déplacement du cube bleu\. Ici, il coûte 5 points, une fois\./],
    ['"moved"', /« Déplacé » veut dire : le robot l’a pris ou soulevé, même s’il a été remis\. Ou le robot le tient à la fin, ou il est à plus de 5 mm de sa place\./],
    ['a touch costs nothing', /Le toucher sans le déplacer ne coûte rien\. Dans une baie, le cube bleu ne rapporte aucun point, et ce n’est pas non plus une mauvaise baie\./],
    ['the clean run of a robot that never moves', /un robot qui ne bouge jamais le reçoit aussi/],
    ['the total never below 0', /Le total n’est jamais en dessous de 0\./],
    ['the yellow frame', /Le cadre jaune fait partie de la zone de départ\./],
    ['"carried"', /« Porté » veut dire : la pince tient le cube et l’a déplacé d’au moins 4 cm\./],
    ['a raised claw does not touch a cube', /« Toucher » veut dire : à moins de 0,5 mm\. Une pince haut au-dessus d’un cube ne le touche pas\./],
    ['a cube in the wrong bay loses its pick-up points', /Un cube dans la baie de l’autre couleur : -5, et il perd aussi ses 5 points pour avoir été pris\./],
    ['partly inside the other bay', /Un cube seulement en partie dedans ne coûte rien\./],
    ['a held cube is not off the mat', /Un cube que le robot tient encore n’est pas hors du tapis\./],
    ['cubes do not stack', /Les cubes ne s’empilent pas/],
    ['backing off the mat leaves the zone', /un robot qui sort du tapis en reculant par là est aussi sorti de la zone/],
    ['a real sensor may have to learn the mat', /Sur un vrai mBot2, le capteur de ligne doit peut-être d’abord apprendre ce tapis\./],
  ];
  for (const [what, sentence] of assumed) {
    assert.match(ASSUMED_TEXT, sentence, what);
    assert.doesNotMatch(RULES_TEXT, sentence, `${what}: not in the rules part`);
  }
  // the rules part says neither of the two contradicting words about parking, nor any size the rules do not give
  for (const word of [/touch(er|ant) une aire/i, /entièrement/i, /\b4 cm\b/, /\b85\b/, /en dessous de 0/, /table/i, /cadre jaune/i, /en partie/i, /pour avoir été pris/i, /déplacement du cube bleu/i, /tourné/i, /\b100\b/]) {
    assert.doesNotMatch(RULES_TEXT, word, String(word));
  }
  // the wrong bay in the rules part: the rules' own words, nothing more
  assert.ok(RULES_TEXT.includes('-5 pour chaque cube dans la baie de l’autre couleur à la fin, et aucun point pour ce cube.'));
  // where the rules are open the window says so, and does not invent a rule
  assert.match(ASSUMED_TEXT, /Les règles ne donnent pas de taille\./);
  assert.match(ASSUMED_TEXT, /Les règles n’en disent pas plus/);
  // the note: the beginner mission, and the English name of the same mission (a name)
  assert.match(ROBOT_EN_FETE_RULES_NOTE, /^Mission pour débutants/);
  assert.match(ROBOT_EN_FETE_RULES_NOTE, /la même mission que Warehouse Sort\.$/);
});

test('French for children of 8 to 12: "tu", short sentences, French typography, no English left', () => {
  for (const text of EVERY_TEXT) {
    // (French is longer than English: the sentences keep the English limit, a line may be longer)
    assert.ok(text.length <= 240, `${text.length}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${sentence.length}: ${sentence}`);
    assert.doesNotMatch(text, /(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/iu, `"tu", not "vous": ${text}`);
    assert.doesNotMatch(text, /'/, `a straight apostrophe: ${text}`);
    assert.doesNotMatch(text, /"/, `English quotation marks: ${text}`);
    assert.doesNotMatch(text, /\.\.\./, text);
    assert.doesNotMatch(text, /«(?! )|(?<! )»/, `« » with no-break spaces: ${text}`);
    assert.doesNotMatch(text, /(?<! )[:;!?]/, `a no-break space before : ; ! ?: ${text}`);
    assert.doesNotMatch(text, / [:;!?»]/, `a plain space before : ; ! ? »: ${text}`);
    // English words a French line must not have (the names are allowed: Warehouse Sort, Fire Rescue Junior and Senior, MakeX Lebanon, Makeblock, CyberPi, mBot2, Inspire, STOP)
    const without = text.replace(/Warehouse Sort|Fire Rescue Junior et Senior|MakeX Lebanon|Makeblock|CyberPi|mBot2|Inspire|STOP|quad RGB/g, '');
    assert.doesNotMatch(without, /(?<![\p{L}])(the|of|and|is|it|cube is|bay|pad|robot is|start|zone is|restart|points? for|with|for|to|at|in)(?![\p{L}])/iu, `English: ${text}`);
  }
  // the two parts: the mission first, every section with a heading of its own and at least one line
  assert.equal(ROBOT_EN_FETE_RULES[0].title, 'La mission');
  for (const part of [ROBOT_EN_FETE_RULES, ROBOT_EN_FETE_ASSUMPTIONS.sections]) {
    assert.equal(new Set(part.map((section) => section.title)).size, part.length, 'no heading twice');
    for (const section of part) {
      assert.ok(section.items.length > 0, section.title);
      assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no line twice`);
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Sentences tried out on the French game
// ---------------------------------------------------------------------------------------------

function play(blocks: Parameters<typeof script>[1], seconds: number, restartsAt: number[] = []) {
  const sim = createSimulation({ game: robotEnFeteGame, scenario: defaultScenario(), program: program([script(whenStart(), blocks)]) });
  sim.start();
  const left = [...restartsAt];
  while (sim.status === 'running' && sim.world.time < seconds) {
    sim.step(1);
    if (left.length > 0 && sim.world.time >= left[0]) {
      left.shift();
      sim.restart();
    }
  }
  return sim;
}
const lineOf = (sim: ReturnType<typeof play>, id: string) => sim.score().lines.find((line) => line.id === id);

test('« un robot qui ne bouge jamais le reçoit aussi » : le bonus de parcours propre sans bouger', () => {
  const sim = play([wait(2)], 3);
  assert.equal(lineOf(sim, LINE_CLEAN)?.points, POINTS_CLEAN);
  assert.equal(sim.score().total, POINTS_CLEAN);
});

test('« Quand une personne touche le robot … cela coûte 10 points » ; « Le chrono continue de tourner » ; « Le total n’est jamais en dessous de 0 »', () => {
  const sim = play([moveCm('forward', 30), wait(5)], 4, [2]);
  assert.equal(sim.restarts, 1);
  assert.equal(lineOf(sim, LINE_RESTARTS)?.points, -RESTART_PENALTY);
  assert.equal(lineOf(sim, LINE_CLEAN)?.points, 0);
  assert.ok(sim.world.time >= 4, 'the clock ran on');
  assert.equal(sim.score().total, 0);
});
