/**
 * The Rules window of Fire Cadet (./rules.ts, design 7.11 with lead decision D1) against the game:
 *   - every number of every sentence is a number of the game - FIRE_CADET or the game's own lists;
 *     a number that is on no list here fails the test. 18.6 cm, the one number of the real robot,
 *     comes from REAL_STEP only;
 *   - part 2 holds a sentence for every assumption that changes what a child sees (with D1 in
 *     place of N17 and N23), and part 1 - the rules - holds no sentence that begins with "Here";
 *   - what part 2 says about the obstacles is what the referee and the engine really do, tried on
 *     real matches: the referee lifts a touched obstacle at once and puts it back on its own spot,
 *     the robot goes on, the robot's own touch costs 1 point once, an item's touch costs nothing;
 *   - rules.ts reaches nothing outside ui/fire-cadet/ and fire-cadet/ (not ../SimulatorApp.tsx);
 *   - the sentences are short.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createSimulation } from '../../core/simulation';
import type { Simulation } from '../../core/types';
import { NUMBER_CARDS, cardRowProgram, cardsFromText } from '../../fire-cadet/cards';
import { WATER_SQUARES } from '../../fire-cadet/field';
import { fireCadetGame, obstacleId } from '../../fire-cadet/game';
import { FIRE_CADET, spot } from '../../fire-cadet/numbers';
import { ITEM_NAMES, OBSTACLE_KINDS, PRACTICE_MAPS, parseSquare, readMapCode, type FireCadetScenario } from '../../fire-cadet/scenario';
import { ASSUMPTIONS_NOTE, ASSUMPTIONS_SHOWN, CADET_ASSUMPTIONS, CADET_RULES, ROUNDS, RULES_NOTE, cm, numberWord, type CadetRulesPart } from './rules';
import { AGES, CATEGORY_AGES } from './words';

const f = FIRE_CADET;
const sentencesOf = (part: CadetRulesPart): string[] => [...(part.note ? [part.note] : []), ...part.sections.flatMap((s) => [s.title, ...s.items])];
const ALL = [...sentencesOf(CADET_RULES), ...sentencesOf(CADET_ASSUMPTIONS)];
const itemsOf = (part: CadetRulesPart): string[] => part.sections.flatMap((s) => s.items);

/** Every number a sentence of the window may hold, each with where it comes from. */
const ALLOWED: ReadonlyArray<[string, string]> = [
  [String(f.GRID_COUNT), 'GRID_COUNT (7 x 7 squares)'],
  [String(f.MATCH_SECONDS), 'MATCH_SECONDS'],
  [String(f.PLANNING_SECONDS), 'PLANNING_SECONDS'],
  [String(f.MATCH_SECONDS / 60), 'MATCH_SECONDS in minutes'],
  [String(f.PLANNING_SECONDS / 60), 'PLANNING_SECONDS in minutes'],
  [String(f.POINTS_ITEM), 'POINTS_ITEM'],
  [String(f.POINTS_RETURN), 'POINTS_RETURN'],
  [String(f.POINTS_OBSTACLE), 'POINTS_OBSTACLE'],
  [String(f.MAX_POINTS), 'MAX_POINTS'],
  [String(OBSTACLE_KINDS.length * f.POINTS_OBSTACLE), 'the most an obstacle can cost: 3 x POINTS_OBSTACLE'],
  [String(ITEM_NAMES.length), 'the four items'],
  [String(OBSTACLE_KINDS.length), 'the three obstacles'],
  [cm(f.STEP), 'STEP in cm'],
  [cm(f.REAL_STEP), 'REAL_STEP in cm (the one number of the real robot)'],
  [cm(f.REAL_STEP - f.STEP), 'REAL_STEP - STEP in cm'],
  [String(f.MOVE_SECONDS), 'MOVE_SECONDS'],
  [String(f.TURN_SECONDS), 'TURN_SECONDS'],
  [String(f.REST_SECONDS), 'REST_SECONDS'],
  [cm(f.BODY_LENGTH), 'BODY_LENGTH in cm'],
  [cm(f.BODY_WIDTH), 'BODY_WIDTH in cm'],
  [cm(f.TABLE_MARGIN), 'TABLE_MARGIN in cm'],
  [cm(f.STICK_LENGTH), 'STICK_LENGTH in cm'],
  [cm(f.STICK_THICKNESS), 'STICK_THICKNESS in cm'],
  [cm(f.ITEM_BASE), 'ITEM_BASE in cm'],
  [cm(f.OBSTACLE_BASE), 'OBSTACLE_BASE in cm'],
  [cm(f.RESTORE_CLEARANCE), 'RESTORE_CLEARANCE in cm (D1)'],
  [String(f.MAX_ROW_CARDS), 'MAX_ROW_CARDS'],
  [String(PRACTICE_MAPS.length), 'the practice maps'],
  ['1', 'the first practice map ("Maps 1 to 8")'],
  [String(ROUNDS), 'ROUNDS (rules l.258)'],
  ['0', 'the total is never below 0 (A9)'],
  ...NUMBER_CARDS.map((card): [string, string] => [card.slice(1), `the number card ${card}`]),
  ...`${AGES.panel} ${AGES.cards} ${CATEGORY_AGES}`.split(/[^0-9]+/).filter(Boolean).map((n): [string, string] => [n, 'the ages of the rules']),
];

test('every number in the Rules window is a number of the game', () => {
  const allowed = new Set(ALLOWED.map(([n]) => n));
  for (const sentence of ALL) {
    for (const n of sentence.match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(allowed.has(n), `"${n}" in: ${sentence}`);
  }
});

test('the numbers are where they belong: each sentence carries the value of its constant', () => {
  const has = (part: CadetRulesPart, words: RegExp): string => {
    const found = itemsOf(part).find((item) => words.test(item));
    assert.ok(found, String(words));
    return found;
  };
  assert.match(has(CADET_ASSUMPTIONS, /exactly one square/), new RegExp(`${cm(f.STEP)} cm`));
  assert.match(has(CADET_ASSUMPTIONS, /real mTiny/), new RegExp(`${cm(f.REAL_STEP).replace('.', '\\.')} cm .* about ${cm(f.REAL_STEP - f.STEP).replace('.', '\\.')} cm further`));
  assert.match(has(CADET_ASSUMPTIONS, /a move takes/), new RegExp(`${f.MOVE_SECONDS} seconds and a turn ${f.TURN_SECONDS} seconds.*rests ${f.REST_SECONDS} seconds`));
  assert.match(has(CADET_ASSUMPTIONS, /cm long and/), new RegExp(`${cm(f.BODY_LENGTH)} cm long and ${cm(f.BODY_WIDTH)} cm wide`));
  assert.match(has(CADET_ASSUMPTIONS, /stops .* cm outside/), new RegExp(`${cm(f.TABLE_MARGIN)} cm outside`));
  assert.match(has(CADET_ASSUMPTIONS, /each stick is/), new RegExp(`${cm(f.STICK_LENGTH)} cm long and ${cm(f.STICK_THICKNESS)} cm thick`));
  assert.match(has(CADET_ASSUMPTIONS, /base of/), new RegExp(`${cm(f.ITEM_BASE)} cm by ${cm(f.ITEM_BASE)} cm`));
  assert.match(has(CADET_ASSUMPTIONS, /holds .* cards at most/), new RegExp(`${f.MAX_ROW_CARDS} cards at most.*${f.MATCH_SECONDS} seconds`));
  assert.match(has(CADET_ASSUMPTIONS, /closer to its place/), new RegExp(`${cm(f.RESTORE_CLEARANCE)} cm`));
  assert.match(has(CADET_RULES, /match lasts/), new RegExp(`${f.MATCH_SECONDS} seconds \\(${f.MATCH_SECONDS / 60} minutes\\)`));
  assert.match(has(CADET_RULES, /Each item in its place/), new RegExp(`${f.POINTS_ITEM} points`));
  assert.match(has(CADET_RULES, /Each obstacle touched/), new RegExp(`${f.POINTS_OBSTACLE} point less`));
  assert.ok(CADET_RULES.sections.some((s) => s.title === `Points (${f.MAX_POINTS} at most)`));
  assert.equal(f.MAX_POINTS, ITEM_NAMES.length * f.POINTS_ITEM + f.POINTS_RETURN, 'the points of part 1 add up to the most');
  assert.match(has(CADET_ASSUMPTIONS, /WATER \/ EQUIPMENT AREA/), new RegExp(`the ${numberWord(WATER_SQUARES.length)} squares`));
  // 18.6 cm is REAL_STEP: it is never typed in the code of rules.ts (its comments may name it)
  const code = readFileSync(fileURLToPath(new URL('./rules.ts', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /18\.6|\b186\b|17\.8|\b0\.8\b/, 'the sizes are written from FIRE_CADET, not typed');
});

test('part 2 holds a sentence for every assumption a child sees; D1 stands in place of N17 and N23', () => {
  const required = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'N1', 'N2', 'N3', 'N5', 'N7', 'N9', 'N10', 'N12', 'N21', 'N24', 'D1'];
  assert.deepEqual(Object.keys(ASSUMPTIONS_SHOWN).sort(), [...required].sort());
  const part2 = itemsOf(CADET_ASSUMPTIONS);
  for (const id of required) assert.ok(part2.includes(ASSUMPTIONS_SHOWN[id]), `${id}: ${ASSUMPTIONS_SHOWN[id]}`);
  // lead decision D1: no word of the fixed obstacles of the design is left (N17, N23)
  for (const sentence of ALL) assert.doesNotMatch(sentence, /cannot be moved|gets stuck on it|Backward frees|stuck robot|off the middle of the squares/i, sentence);
  assert.ok(part2.some((s) => /never gets stuck/.test(s)));
});

test('part 1 holds only the rules: no sentence of it begins with "Here"; part 2 says what it is', () => {
  for (const item of [...itemsOf(CADET_RULES), RULES_NOTE]) {
    for (const sentence of item.split(/(?<=[.!?])\s+/)) assert.doesNotMatch(sentence, /^Here\b/, sentence);
  }
  assert.equal(CADET_RULES.title, 'Rules');
  assert.equal(CADET_ASSUMPTIONS.title, 'What this simulator assumes');
  assert.match(ASSUMPTIONS_NOTE, /^These are not rules\./);
  // the rules of the obstacles, as the organiser wrote them (rules l.88-100, l.171-185)
  const obstacles = CADET_RULES.sections.find((s) => s.title === 'The obstacles');
  assert.ok(obstacles);
  assert.deepEqual(obstacles.items, [
    '3 obstacles block roads: Road Closed, Fallen Tree, Broken Vehicle.',
    'All three mean the same: find another way.',
    'Try not to touch an obstacle: each one touched costs 1 point.',
    'Do not push an obstacle away to use its road.',
    'If the robot moves an obstacle, the referee puts it back.',
  ]);
  // the pictures stand in front of the item sentences
  const mission = CADET_RULES.sections[0];
  assert.deepEqual(mission.pictures?.filter((p) => p !== null), ['water', 'cat', 'person', 'equipment']);
});

test('rules.ts reaches nothing outside ui/fire-cadet/ and fire-cadet/ (not ../SimulatorApp.tsx, not even for a type)', () => {
  const source = readFileSync(fileURLToPath(new URL('./rules.ts', import.meta.url)), 'utf8');
  const specifiers = [...source.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(specifiers.length > 0);
  for (const s of specifiers) assert.match(s, /^(\.\/[\w-]+|\.\.\/\.\.\/fire-cadet\/[\w-]+)$/, s);
});

test('short sentences: none longer than 140 characters; every section has a heading and at least one line', () => {
  for (const item of ALL) for (const sentence of item.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${sentence.length}: ${sentence}`);
  for (const part of [CADET_RULES, CADET_ASSUMPTIONS]) {
    for (const section of part.sections) {
      assert.ok(section.title.length > 0 && section.items.length > 0, section.title);
      if (section.pictures) assert.equal(section.pictures.length, section.items.length, section.title);
    }
  }
});

// =============================================================================================
// What part 2 says about the obstacles, tried on the engine (lead decision D1)
// =============================================================================================

const mapOf = (code: string): FireCadetScenario => {
  const reading = readMapCode(code);
  assert.ok(reading.ok, code);
  return reading.scenario;
};
/** The Road Closed sign on D5, right ahead of the robot; the other things out of the way. */
const SIGN_AHEAD = mapOf('S-A6-B3-C5-C7-D5-F5-F7');
/** The Equipment on D5 and the Road Closed sign on D3: Forward pushes the Equipment into the sign. */
const ITEM_INTO_SIGN = mapOf('S-A6-B3-C5-D5-D3-F5-F7');

function run(scenario: FireCadetScenario, row: string, each?: (sim: Simulation<FireCadetScenario>) => void): Simulation<FireCadetScenario> {
  const sim = createSimulation({ game: fireCadetGame, scenario, program: cardRowProgram(cardsFromText(row)) });
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    each?.(sim);
  }
  return sim;
}
const obstacleLine = (sim: Simulation<FireCadetScenario>) => sim.score().lines.find((line) => line.id === 'obstacles');
const signOf = (sim: Simulation<FireCadetScenario>) => sim.world.bodies.find((b) => b.id === obstacleId('road-closed'));

test('"When anything touches an obstacle, the referee takes it off the map at once" - and "the robot never gets stuck: it goes on from where it is"', () => {
  let liftedAt: number | null = null;
  const sim = run(SIGN_AHEAD, 'F2', (s) => {
    if (liftedAt === null && signOf(s) === undefined) liftedAt = s.world.time;
  });
  assert.ok(liftedAt !== null, 'the sign was lifted');
  // the robot drove on through the square of the lifted sign and stands on the spot of D5
  const d5 = spot(parseSquare('D5') as NonNullable<ReturnType<typeof parseSquare>>);
  assert.ok(Math.abs(sim.world.robot.pose.x - d5.x) < 0.001 && Math.abs(sim.world.robot.pose.y - d5.y) < 0.001, JSON.stringify(sim.world.robot.pose));
  assert.equal(obstacleLine(sim)?.points, -f.POINTS_OBSTACLE);
});

test('"It goes back on its own square as soon as nothing is near its place": the sign is back on its spot, unturned, once the robot has left', () => {
  let backAt: number | null = null;
  let wasLifted = false;
  const sim = run(SIGN_AHEAD, 'F2 B2', (s) => {
    const sign = signOf(s);
    if (sign === undefined) wasLifted = true;
    else if (wasLifted && backAt === null) backAt = s.world.time;
  });
  assert.ok(wasLifted && backAt !== null, 'lifted, then put back');
  const sign = signOf(sim);
  assert.ok(sign);
  const d5 = spot(SIGN_AHEAD.obstacles[0]);
  assert.deepEqual([sign.x, sign.y, sign.angle], [d5.x, d5.y, 0]);
});

test('"Only the robot touching an obstacle costs a point: 1 point once for each obstacle, however often"', () => {
  const twice = run(SIGN_AHEAD, 'F3 B3');
  assert.equal(obstacleLine(twice)?.points, -f.POINTS_OBSTACLE, 'two touches of the same sign: 1 point');
});

test('"An item that the robot pushes against an obstacle costs no point"', () => {
  let lifted = false;
  const sim = run(ITEM_INTO_SIGN, 'F4', (s) => {
    if (signOf(s) === undefined) lifted = true;
  });
  assert.ok(lifted, 'the Equipment touched the sign: the referee lifted it');
  assert.equal(obstacleLine(sim)?.points, 0);
});

test('"Here an obstacle always stands in the middle of its square" (on the lattice of the squares, N1)', () => {
  for (const map of PRACTICE_MAPS) {
    const sim = createSimulation({ game: fireCadetGame, scenario: map, program: {} });
    OBSTACLE_KINDS.forEach((kind, k) => {
      const body = sim.world.bodies.find((b) => b.id === obstacleId(kind));
      assert.ok(body);
      assert.deepEqual([body.x, body.y], [spot(map.obstacles[k]).x, spot(map.obstacles[k]).y]);
      assert.equal(body.w, f.OBSTACLE_BASE);
    });
  }
});
