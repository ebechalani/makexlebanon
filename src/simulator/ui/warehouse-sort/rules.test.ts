/**
 * The rules window of Warehouse Sort (./rules.ts) against the game:
 *   - every number in its sentences is the number the code has - compared one by one with the
 *     constant that holds it; a number that is on no list here fails the test,
 *   - the points add up to the highest score the referee gives,
 *   - what the simulator only assumes is in the second part, and the rules part does not say it,
 *   - the sentences are short (this is the beginner category),
 *   - a few sentences that can be tried out are tried out on the real engine and referee.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TABLE_MARGIN } from '../../core/engine';
import { createSimulation } from '../../core/simulation';
import { arm, gripper, moveCm, program, script, turn, wait, whenStart } from '../../vm/builder';
import { CUBE_SIZE, FINISH_PADS, MAT_SIZE, WAREHOUSES } from '../../warehouse-sort/field';
import {
  CARRY_MM,
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
  cubeBodyId,
  cubeHome,
  warehouseSortGame,
} from '../../warehouse-sort/game';
import { WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import { defaultScenario } from '../../warehouse-sort/scenario';
import type { RulesSection } from '../SimulatorApp';
import { RULES_EXAMPLE_MAX, WAREHOUSE_SORT_ASSUMPTIONS, WAREHOUSE_SORT_RULES, WAREHOUSE_SORT_RULES_NOTE, robotLength, robotWidth } from './rules';

const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(WAREHOUSE_SORT_RULES);
const ASSUMED = sentences(WAREHOUSE_SORT_ASSUMPTIONS.sections);
const RULES_TEXT = RULES.join('\n');
const ASSUMED_TEXT = ASSUMED.join('\n');
const EVERY_TEXT = [WAREHOUSE_SORT_RULES_NOTE, WAREHOUSE_SORT_ASSUMPTIONS.title, WAREHOUSE_SORT_ASSUMPTIONS.note ?? '', ...RULES, ...ASSUMED];

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
  [CUBE_COUNT, 'CUBE_COUNT (four warehouses, four cubes)'],
  [MATCH_DURATION, 'MATCH_DURATION'],
  [cm(MAT_SIZE), 'MAT_SIZE in cm'],
  [cm(LIFT_MM), 'LIFT_MM in cm'],
  [cm(CARRY_MM), 'CARRY_MM in cm'],
  [cm(CUBE_SIZE), 'CUBE_SIZE in cm'],
  [TOUCH_MM, 'TOUCH_MM'],
  [cm(TABLE_MARGIN), 'TABLE_MARGIN in cm'],
  [cm(2 * Math.max(FINISH_PADS.top.rx, FINISH_PADS.top.ry)), 'the size of a finish pad in cm'],
  [cm(robotLength(WAREHOUSE_SORT_ROBOT)), 'the length of the robot in cm'],
  [cm(robotWidth(WAREHOUSE_SORT_ROBOT)), 'the width of the robot in cm'],
  [cm(WAREHOUSE_SORT_ROBOT.frontColorSensor.rangeMm), 'the range of the colour sensor at the claw in cm'],
  [0, 'the lowest total'],
  // ("-5 points" for the referee's cube return of the rules: the same number as the wrong bay)
];

test('every number in the rules window is a number of the game', () => {
  const unknown: string[] = [];
  let found = 0;
  for (const text of EVERY_TEXT) {
    for (const match of text.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?/g)) {
      found++;
      const value = Math.abs(Number(match[0]));
      if (!KNOWN_NUMBERS.some(([known]) => Math.abs(known - value) < 1e-9)) unknown.push(`${match[0]} in "${text}"`);
    }
  }
  assert.deepEqual(unknown, [], 'a number that is not a constant of the game');
  assert.ok(found >= 30, `${found} numbers checked`);
});

test('the numbers are the referee\'s: the points, the time, the restart, the sizes', () => {
  assert.equal(POINTS_LEAVE_START + CUBE_COUNT * POINTS_PICK + CUBE_COUNT * POINTS_DELIVER + POINTS_PARK + POINTS_CLEAN, MAX_SCORE);
  assert.equal(MAX_SCORE, 100);
  assert.equal(RULES_EXAMPLE_MAX, 85, 'what the rules write as their example');
  assert.ok(RULES_TEXT.includes(`Points (${MAX_SCORE} at most)`));
  assert.ok(RULES_TEXT.includes(`All together: 5 + 4 x 5 + 4 x 15 + 10 + 5 = 100.`));
  assert.ok(RULES_TEXT.includes(`A match lasts ${warehouseSortGame.matchDuration} seconds.`));
  assert.ok(RULES_TEXT.includes(`it costs ${warehouseSortGame.restartPenalty} points`));
  assert.equal(warehouseSortGame.restartRules, undefined, 'no limit on restarts, as the window says');
  assert.ok(RULES_TEXT.includes('The rules set no limit on restarts.'));
  // the robot's sizes, from the same robot the game is played with
  assert.equal(robotLength(WAREHOUSE_SORT_ROBOT), 237);
  assert.equal(robotWidth(WAREHOUSE_SORT_ROBOT), 130);
  assert.ok(ASSUMED_TEXT.includes('23.7 cm long and 13 cm wide'));
  assert.ok(ASSUMED_TEXT.includes('A pad is about 16 cm across.'));
  // the referee's own sheet gives the same highest score
  const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: program([script(whenStart(), [])]) });
  assert.equal(sim.score().max, MAX_SCORE);
});

test('what the simulator only assumes is in the second part; the rules part does not say it', () => {
  assert.equal(WAREHOUSE_SORT_ASSUMPTIONS.title, 'What this simulator assumes');
  assert.match(WAREHOUSE_SORT_ASSUMPTIONS.note ?? '', /^These are not rules\./);
  // what the brief of this game lists as the simulator's own choices, each in the second part
  const assumed: Array<[string, RegExp]> = [
    ['the size of a cube', /A cube is 4 cm on each side and light/],
    ['the table around the mat', /The mat lies on a table\. .* stop 10 cm outside it/],
    ['touching a pad is enough', /Here touching a pad is enough\./],
    ['a held cube at a restart', /A cube in the gripper at a restart goes back to its own warehouse\./],
    ['a cube off the mat stays', /The simulator does not do that: the cube stays where it is\./],
    ['the start zone of the rules and of the mat', /The rules say the start zone is a green area\. On the mat it is the area with the yellow frame/],
    ['the finish pads of the rules and of the mat', /The rules say the finish pads are yellow circles with a checkerboard\. On the mat they are the two round pictures/],
    ['85 or 100', /The rules give 85 points as the example maximum, but their own points add up to 100\./],
    ['the clean run of a robot that never moves', /a robot that never moves gets it too/],
    ['the total never below 0', /The total is never below 0\./],
    ['the yellow frame', /The yellow frame is part of the start zone\./],
    ['"carried"', /"Carried" means: the gripper holds the cube and has moved it at least 4 cm\./],
    ['a raised claw does not touch a cube', /"Touching" means: closer than 0\.5 mm\. A claw high above a cube does not touch it\./],
    ['a cube in the wrong bay loses its pick-up points', /A cube in the bay of the other colour: -5, and it also loses its 5 points for picking it up\./],
    ['partly inside the other bay', /A cube that is only partly inside costs nothing\./],
    ['a held cube is not off the mat', /A cube that the robot still holds is not off the mat\./],
    ['cubes do not stack', /Cubes do not stack/],
    ['backing off the mat leaves the zone', /a robot that drives backwards off the mat there has also left the zone/],
    ['a real sensor may have to learn the mat', /On a real mBot2 the line sensor may first have to learn this mat\./],
  ];
  for (const [what, sentence] of assumed) {
    assert.match(ASSUMED_TEXT, sentence, what);
    assert.doesNotMatch(RULES_TEXT, sentence, `${what}: not in the rules part`);
  }
  // the rules part says neither of the two contradicting words about parking, nor any size the rules do not give
  for (const word of [/touch(es|ing)? a (finish )?pad/i, /entirely inside/i, /\b4 cm\b/, /\b85\b/, /below 0/, /table/i, /yellow frame/i, /partly/i, /no 15 points/, /picking it up/i]) {
    assert.doesNotMatch(RULES_TEXT, word, String(word));
  }
  // the wrong bay in the rules part: the rules' own words, nothing more
  assert.ok(RULES_TEXT.includes('-5 for each cube in the bay of the other colour at the end, and no points for that cube.'));
  // where the rules are open the window says so, and does not invent a rule
  assert.match(ASSUMED_TEXT, /The rules give no size\./);
  assert.match(ASSUMED_TEXT, /The rules say no more/);
  assert.match(WAREHOUSE_SORT_RULES_NOTE, /Beginner mission/);
});

test('short sentences for beginners: no sentence is longer than 140 characters, no bullet longer than 210', () => {
  for (const text of EVERY_TEXT) {
    assert.ok(text.length <= 210, `${text.length}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${sentence.length}: ${sentence}`);
  }
});

test('the two parts: the mission first, every section with a heading of its own and at least one line', () => {
  assert.equal(WAREHOUSE_SORT_RULES[0].title, 'The mission');
  for (const part of [WAREHOUSE_SORT_RULES, WAREHOUSE_SORT_ASSUMPTIONS.sections]) {
    assert.equal(new Set(part.map((section) => section.title)).size, part.length, 'no heading twice');
    for (const section of part) {
      assert.ok(section.items.length > 0, section.title);
      assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no line twice`);
    }
  }
  // (the screen draws the second part under its own heading: SimulatorApp's rulesExtra)
  assert.ok(WAREHOUSE_SORT_ASSUMPTIONS.sections.length >= 5);
});

// ---------------------------------------------------------------------------------------------
// Sentences tried out on the real engine and referee
// ---------------------------------------------------------------------------------------------

/** Play the default arrangement up to `seconds` (or to the end), with restarts at the given times. */
function play(blocks: Parameters<typeof script>[1], seconds = MATCH_DURATION, restartsAt: number[] = []) {
  const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: program([script(whenStart(), blocks)]) });
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

test('"a robot that never moves gets it too": the clean run bonus without moving', () => {
  const sim = play([wait(2)], 3);
  assert.equal(lineOf(sim, LINE_CLEAN)?.points, POINTS_CLEAN);
  assert.equal(sim.score().total, POINTS_CLEAN);
});

test('a restart costs 10 points and the clean run bonus, the clock runs on, and nothing goes below 0', () => {
  const sim = play([moveCm('forward', 30), wait(5)], 4, [2]);
  assert.equal(sim.restarts, 1);
  assert.equal(lineOf(sim, LINE_RESTARTS)?.points, -RESTART_PENALTY);
  assert.equal(lineOf(sim, LINE_CLEAN)?.points, 0);
  assert.ok(sim.world.time >= 4, 'the clock ran on');
  // 5 for leaving the start zone - 10 for the restart: the total stays at 0
  assert.equal(sim.score().total, 0);
});

test('"a cube in the gripper at a restart goes back to its own warehouse; points earned before a restart stay"', () => {
  // W4 (bottom right): the route of the integration test, as far as the cube in the raised claw
  // (the cube is held from 3.3 s on, the turn has carried it away from its square by 6 s; the program ends at about 10 s)
  const route = [moveCm('forward', 4.575), turn('left', 90), moveCm('forward', 36.243), gripper('close'), arm('raise'), turn('right', 90), wait(5)];
  const before = play(route, 6.9);
  const carried = before.world.bodies.find((body) => body.id === cubeBodyId('W4'));
  assert.ok(carried && before.world.robot.gripper.holding === carried.id && carried.z > 50, 'held and lifted before the restart');
  assert.ok(Math.hypot(carried.x - cubeHome('W4').x, carried.y - cubeHome('W4').y) > 50, 'and carried away from its square');
  const sim = play(route, 8, [7]);
  assert.equal(sim.restarts, 1);
  const cube = sim.world.bodies.find((body) => body.id === cubeBodyId('W4'));
  assert.ok(cube);
  assert.equal(sim.world.robot.gripper.holding, null, 'the gripper holds nothing after the restart');
  const home = cubeHome('W4');
  assert.ok(Math.hypot(cube.x - home.x, cube.y - home.y) < 1, 'back on the orange square of W4');
  assert.equal(cube.z, 0);
  assert.ok(cube.x > WAREHOUSES.W4.frame.x && cube.x < WAREHOUSES.W4.frame.x + WAREHOUSES.W4.frame.w);
  assert.equal(sim.score().lines.find((line) => line.id === 'pick:W4')?.points, POINTS_PICK, 'the 5 points for picking it up stay');
  assert.equal(sim.score().lines.find((line) => line.id === 'leave-start')?.points, POINTS_LEAVE_START);
});
