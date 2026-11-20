/**
 * The rules window of Fire Fighter (./rules.ts) against the game:
 *   - every number in its sentences is the number the code has - compared one by one with the
 *     constant that holds it; a number that is on no list here fails the test,
 *   - the points add up to the highest score the referee gives (100),
 *   - the organiser's two answers - tower X opens to the top, towards the hydrant line; the two
 *     sides of a tower stand about 6 cm apart - are said as the organiser's, not as choices of the
 *     simulator, and what is still open is in the second part,
 *   - what the simulator only assumes is in the second part, and the rules part does not say it,
 *   - the sentences about the field, the towers, the claw and the T bars are worked out from the
 *     field, the bodies and the robot the game is played with,
 *   - no sentence names a voided run or two runs (Locker Room's rules, not these),
 *   - no text of the Fire Fighter screen holds the title, the head of a title, the id or the level
 *     of an example of any game, or a sentence of six words or more of one (the guard of the
 *     examples, ../../members/client-guard.test.ts, would fail the page),
 *   - the sentences are short (ages 8 to 10).
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_ROBOT_CONFIG } from '../../core/robot';
import { createSimulation } from '../../core/simulation';
import type { Body } from '../../core/types';
import {
  CUBE_HOMES,
  CUBE_PLACES,
  CUBE_SIZE,
  CUBE_SQUARES,
  FIRE_STATION,
  LETTER_AREA,
  LINES,
  LINE_WIDTH,
  MAT_SIZE,
  OPENING,
  ROOM_ACROSS,
  ROOM_ALONG_OPENING,
  SQUARE_MIDDLES,
  SUPPORT_WIDTH,
  TOWER_DEPTH,
  TOWER_GAP,
  TOWER_HEIGHT,
  TOWER_IDS,
  TOWER_MIDDLES,
  TOWER_NAMES,
  TOWER_PLACES,
  TOWER_STEMS,
  TOWER_WIDTH,
  YELLOW_SQUARE,
  type TowerId,
} from '../../fire-fighter/field';
import { CUBE_COLORS, DELIVERY_POINTS, MATCH_DURATION, MAX_SCORE, MOVED_TOWER_PENALTY, WANTED_COLOR, cubeId, fireFighterGame, insideLetterArea, supportId } from '../../fire-fighter/game';
import { FIRE_FIGHTER_ROBOT, clawAheadOfLineSensor } from '../../fire-fighter/robot';
import { RULES_SETUP } from '../../fire-fighter/scenario';
import { ALL_GAMES } from '../../members/all-examples';
import { program, script, whenStart } from '../../vm/builder';
import { screenWords } from '../screen-words';
import type { RulesSection } from '../SimulatorApp';
import { FIRE_FIGHTER_ASSUMPTIONS, FIRE_FIGHTER_RULES, FIRE_FIGHTER_RULES_NOTE, RED_TOWERS, cm, mmDown } from './rules';
import { SetupList } from './SetupList';
import { FIRE_FIGHTER_START_ZONE, FIRE_FIGHTER_WORDS } from './words';

const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(FIRE_FIGHTER_RULES);
const ASSUMED = sentences(FIRE_FIGHTER_ASSUMPTIONS.sections);
const RULES_TEXT = RULES.join('\n');
const ASSUMED_TEXT = ASSUMED.join('\n');
const WINDOW = [FIRE_FIGHTER_RULES_NOTE, FIRE_FIGHTER_ASSUMPTIONS.title, FIRE_FIGHTER_ASSUMPTIONS.note ?? '', ...RULES, ...ASSUMED];

/** What a reader sees of some markup: the tags taken out, quotation marks back as typed. */
const textOf = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

/** The title and the description of the page (written as pieces joined with "+"). */
const PAGE = read('../../../app/simulator/fire-fighter/page.tsx').replace(/'\s*\+\s*'/g, '');
const PAGE_TEXTS = [/const TITLE = '([^']+)';/, /const DESCRIPTION =\s*'([^']+)';/].map((pattern) => {
  const found = pattern.exec(PAGE)?.[1];
  assert.ok(found, String(pattern));
  return found;
});

/** The lines of the list of the field, as the panel draws them: each line of the list, and the sentence under it. */
const SETUP_LINES = [...renderToStaticMarkup(createElement(SetupList)).matchAll(/<(li|p)\b[^>]*>([^]*?)<\/\1>/g)].map((match) => textOf(match[2]));

/**
 * Every text of the Fire Fighter screen a student or a teacher reads: the rules window, the words
 * of the screen, the list of the field (as the panel draws it), and the title and description of
 * the page.
 */
const SCREEN_TEXTS: string[] = [
  ...WINDOW,
  ...Object.values(FIRE_FIGHTER_WORDS).map(String),
  FIRE_FIGHTER_START_ZONE,
  ...SETUP_LINES,
  ...PAGE_TEXTS,
];

/**
 * The numbers the window may say, and what each one is. A number in a sentence that is not one
 * of these values fails the test - so a new number needs its constant here.
 */
const KNOWN_NUMBERS: ReadonlyArray<[number, string]> = [
  [MATCH_DURATION, 'MATCH_DURATION'],
  [DELIVERY_POINTS, 'DELIVERY_POINTS'],
  [MOVED_TOWER_PENALTY, 'MOVED_TOWER_PENALTY'],
  [MAX_SCORE, 'MAX_SCORE'],
  [0, 'the lowest total, and 0 points'],
  [Number(cm(TOWER_WIDTH)), 'TOWER_WIDTH in cm'],
  [Number(cm(TOWER_DEPTH)), 'TOWER_DEPTH in cm'],
  [Number(cm(TOWER_GAP)), 'TOWER_GAP in cm'],
  [Number(cm(SUPPORT_WIDTH)), 'SUPPORT_WIDTH in cm'],
  [Number(cm(TOWER_HEIGHT)), 'TOWER_HEIGHT in cm'],
  [Number(mmDown(ROOM_ALONG_OPENING)), 'ROOM_ALONG_OPENING in mm, rounded down'],
  [Number(mmDown(ROOM_ACROSS)), 'ROOM_ACROSS in mm'],
  [Number(cm(CUBE_SIZE)), 'CUBE_SIZE in cm'],
  [Number(cm(clawAheadOfLineSensor(FIRE_FIGHTER_ROBOT))), 'how far the claw reaches ahead of the line sensor, in cm'],
  [2027, 'the season'],
  [8, 'the youngest age of the category'],
  [10, 'the oldest age of the category'],
];

test('every number in the rules window is a number of the game', () => {
  const unknown: string[] = [];
  let found = 0;
  for (const text of WINDOW) {
    for (const match of text.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?/g)) {
      found++;
      const value = Math.abs(Number(match[0]));
      if (!KNOWN_NUMBERS.some(([known]) => Math.abs(known - value) < 1e-9)) unknown.push(`${match[0]} in "${text}"`);
    }
  }
  assert.deepEqual(unknown, [], 'a number that is not a constant of the game');
  assert.ok(found >= 20, `${found} numbers checked`);
});

test('the numbers are the referee\'s: the points, the time, the highest score - and the rules\' own', () => {
  // the rules (§7): 20 for each of the five towers, 4 off for a tower off its square, 100 at most; the organiser: 180 s
  assert.deepEqual([DELIVERY_POINTS, MOVED_TOWER_PENALTY, MAX_SCORE, MATCH_DURATION], [20, 4, 100, 180]);
  assert.equal(TOWER_IDS.length * DELIVERY_POINTS, MAX_SCORE);
  assert.equal(fireFighterGame.matchDuration, MATCH_DURATION);
  // the sheet of the referee gives the same highest score
  const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) });
  assert.equal(sim.score().max, MAX_SCORE);
  assert.equal(sim.score().total, 0);
  for (const sentence of [
    'A match lasts 180 seconds.',
    '20 points for each tower with the right cube and its letter showing (M, A, K, E: red; X: yellow, delivered next after the robot took it).',
    'A tower that ends off its picture square: 0 for that tower, and 4 points off. Touching the edge of the square is enough.',
    'Highest score 100, lowest 0.',
    'The match ends after 180 seconds.',
  ]) {
    assert.ok(RULES.includes(sentence), sentence);
  }
  // the scoring is the rules' "Proposed scoring for organizer review": the note under the heading says so
  assert.equal(FIRE_FIGHTER_RULES_NOTE, 'MakeX Lebanon, Season 2027, ages 8 to 10. The scoring is a proposal the organiser has not confirmed yet.');
  // no restarts: the game allows none, and the window says what the rules say - nothing - not a rule of its own making
  assert.deepEqual(fireFighterGame.restartRules, { maxRestarts: 0 });
  assert.equal(fireFighterGame.restartPenalty, 0);
  assert.ok(RULES.includes('The rules say nothing about restarts.'));
  assert.doesNotMatch(SCREEN_TEXTS.join('\n'), /There are no restarts|no restarts are allowed|may not restart/i);
});

test('no sentence of the screen names a voided run or two runs: those are the rules of Locker Room', () => {
  for (const text of SCREEN_TEXTS) {
    assert.doesNotMatch(text, /void/i, text);
    assert.doesNotMatch(text, /two runs|\b2 runs\b|runs of the ranking|ranking/i, text);
  }
  assert.ok(SCREEN_TEXTS.length >= 40, `${SCREEN_TEXTS.length} texts looked at`);
});

test('the organiser\'s two answers are said as the organiser\'s: tower X opens to the top, the two sides stand about 6 cm apart', () => {
  // the answers, in the field
  assert.equal(OPENING.X, 'top');
  assert.equal(TOWER_GAP, 60);
  // X: in the rules part, where the organiser's answers stand - marked as the answer it is
  assert.ok(RULES.includes("Tower X opens to the top, towards the hydrant line (the organiser's answer)."));
  assert.doesNotMatch(ASSUMED_TEXT, /Tower X opens/, 'not a choice of the simulator any more');
  // the gap: with the tower's size (the organiser's too) in the second part, beside the simulator's own numbers of the tower
  assert.ok(ASSUMED.includes('A tower is 10.5 cm wide and 4 cm deep (the organiser\'s size).'));
  assert.ok(ASSUMED.includes('Its two sides stand 6 cm apart, as wide as the white dashed square (the organiser\'s answer: "about 6 cm").'));
  assert.ok(ASSUMED.includes('Here the sides are 2.25 cm thick and 10 cm high.'));
  // ... and the part says, above all, that these two are not its choices
  assert.equal(FIRE_FIGHTER_ASSUMPTIONS.title, 'What this simulator assumes');
  assert.equal(FIRE_FIGHTER_ASSUMPTIONS.note, "Choices of the simulator, not rules, except what the organiser gave: the tower's size and the room between its sides.");
  // nothing calls them a question or a guess
  for (const text of SCREEN_TEXTS) assert.doesNotMatch(text, /assum(?:e|ption)s? (?:that )?(?:tower )?X|question|not (?:yet )?known|we guess|probably/i, text);
  // a cube that goes into X from the back (from the yellow square below it) does not count: the simulator's rule for every tower
  assert.ok(ASSUMED.includes('A cube that goes in from the back of a tower does not count.'));
});

test('what the simulator only assumes is in the second part; the rules part does not say it', () => {
  const assumed: Array<[string, RegExp]> = [
    ['solid sides of 2.25 cm', /Here the sides are 2\.25 cm thick and 10 cm high\./],
    ['towers slide, never turn or tip', /A tower can slide when the robot pushes it\. It never turns and never falls over: the simulator cannot turn or tip things\./],
    ['the letter rule', /The letter shows when the cube went in through the tower's opening and its whole bottom is inside the white dashed square\. The dashed line counts as inside\./],
    ['the back of a tower', /A cube that goes in from the back of a tower does not count\./],
    ['the room in a tower', /The cube may be up to 7\.8 mm off the middle towards the opening or the back\. Sideways it has 5 mm on each side: more, and it can catch a side and push the tower away\./],
    ['upright cubes', /A cube always stands upright here\./],
    ['the claw with a cube', /A claw that holds a cube does not fit between the sides\./],
    ['how to push a cube in', /Let the cube go in front of the tower, move back at least 5 cm, close the empty claw and push the cube in\./],
    ['the claw inside a tower', /Opening or closing the claw inside a tower pushes the tower\. A real claw would stop\./],
    ['where the cubes start', /Each cube starts in the middle of its marked square\./],
    ['taking the yellow cube', /The robot has taken the yellow cube when its claw holds it, or when the middle of the cube has left its red square\./],
    ['when a delivery counts', /A delivery counts when the letter shows and no part of the robot touches the cube\./],
    ['touching at the end', /A cube the robot still touches at the end scores 0: the robot must move clear\./],
    ['one delivery per stay', /Touching or nudging a cube that is already under a tower is not a new delivery; taking it out and pushing it in again is\./],
    ['the robot', /The robot is the mBot2 of Fire Rescue Junior and Senior: claw in front, line sensor under its nose\./],
    ['the T bars', /Its claw reaches 8\.2 cm further than its line sensor\. At M, A, K and E the T bar is so close to the tower that the claw would already be inside the tower when the sensor sees the bar\./],
    ['the end of a match', /The simulator also ends the match when you press Finished, or when the program has ended and the robot stands still\./],
    ['not simulated', /A referee's judgement by eye: the simulator measures every cube to the millimetre\./],
  ];
  for (const [what, sentence] of assumed) {
    assert.match(ASSUMED_TEXT, sentence, what);
    assert.doesNotMatch(RULES_TEXT, sentence, `${what}: not in the rules part`);
  }
  // the rules part says none of the simulator's own numbers or choices ...
  for (const word of [/2\.25/, /7\.8/, /\b5 mm\b/, /\bmm\b/, /\bcm\b/, /solid/i, /upright/i, /millimetre/i, /Finished/, /stands still/, /back of a tower/, /dashed line counts/, /assum/i, /\bHere\b/, /middle of its marked square/]) {
    assert.doesNotMatch(RULES_TEXT, word, String(word));
  }
  // ... but for one sentence about the claw, and that one says it is about this simulator
  const aboutSimulator = RULES.filter((sentence) => /simulator/i.test(sentence));
  assert.deepEqual(aboutSimulator, ['In this simulator the claw is too wide with a cube in it. Let go in front of the tower, then push the cube in with the closed claw (see below).']);
});

test('the rules part: the mission, the field and the yellow rule as the rules and the organiser say them', () => {
  assert.equal(FIRE_FIGHTER_RULES[0].title, 'The mission');
  assert.deepEqual(
    FIRE_FIGHTER_RULES.map((section) => section.title),
    ['The mission', 'The field', 'A delivery', 'The yellow cube', 'Points', 'The end'],
  );
  for (const sentence of [
    'Your mBot2 starts in the Fire Station and drives on its own.',
    'Bring one red cube to each of the towers M, A, K and E.',
    'Take the yellow cube to tower X in the middle: once the robot has taken it, X must be its next delivery.',
    'A cube pushed far enough in under a tower makes its letter show: M A K E X.',
    'Red cubes: two in the left bay, two in the right bay, on the marked squares.',
    'Yellow cube: on the red square above the Fire Station.',
    'Towers: M at the school (bottom left), A at the hospital (bottom right), K at the bakery (top right), E at the park (top left).',
    'Tower X stands at the hydrant, in the middle.',
    'The referee turns each tower so that it opens towards its track.',
    'Slide the cube between the two supports of the tower, inside the white dashed square, until the letter shows.',
    'Then let go and move clear.',
    'Any red cube can go to M, A, K or E, in any order.',
    'Once the robot has taken the yellow cube, X must be its next delivery.',
    // (the critics' case: the yellow cube under another tower first is a delivery too)
    'If another delivery comes first (the yellow cube under another tower counts too), the yellow cube scores nothing, even under X.',
    'Cubes delivered before the robot takes the yellow cube do not matter.',
    'Each tower is checked once, at the end.',
    '0 for an empty tower, a cube of the wrong colour, a hidden letter, or a cube the robot still holds.',
  ]) {
    assert.ok(RULES.includes(sentence), sentence);
  }
  // which tower wants which cube: the referee's own table (the rules' check table, §6)
  assert.deepEqual(WANTED_COLOR, { M: 'red', A: 'red', K: 'red', E: 'red', X: 'yellow' });
  assert.deepEqual(RED_TOWERS, ['M', 'A', 'K', 'E']);
  // where the towers stand (the organiser: "M bottom left and then counter clockwise"), from where their squares are on the mat
  const third = (v: number, low: string, mid: string, high: string): string => (v < MAT_SIZE / 3 ? low : v > (2 * MAT_SIZE) / 3 ? high : mid);
  for (const tower of TOWER_IDS) {
    const { x, y } = SQUARE_MIDDLES[tower];
    const place = tower === 'X' ? 'middle' : `${third(y, 'top', 'middle', 'bottom')} ${third(x, 'left', 'middle', 'right')}`;
    assert.equal(TOWER_PLACES[tower], place, tower);
  }
  assert.deepEqual(TOWER_NAMES, { M: 'school', A: 'hospital', K: 'bakery', E: 'park', X: 'hydrant' });
  const middle = SQUARE_MIDDLES.X;
  assert.ok(Math.abs(middle.x - MAT_SIZE / 2) < 20 && Math.abs(middle.y - MAT_SIZE / 2) < 20, 'X stands in the middle');
  // two red cubes in each bay; the yellow cube's red square above the Fire Station
  const reds = CUBE_PLACES.filter((place) => CUBE_COLORS[place] === 'red');
  assert.equal(reds.filter((place) => CUBE_HOMES[place].x < MAT_SIZE / 4).length, 2, 'the left bay');
  assert.equal(reds.filter((place) => CUBE_HOMES[place].x > (3 * MAT_SIZE) / 4).length, 2, 'the right bay');
  assert.equal(CUBE_COLORS.yellow, 'yellow');
  assert.ok(YELLOW_SQUARE.y + YELLOW_SQUARE.h <= FIRE_STATION.y, 'above the Fire Station');
  assert.ok(YELLOW_SQUARE.x >= FIRE_STATION.x && YELLOW_SQUARE.x + YELLOW_SQUARE.w <= FIRE_STATION.x + FIRE_STATION.w, '... right above it');
  assert.ok(CUBE_HOMES.yellow.x > YELLOW_SQUARE.x && CUBE_HOMES.yellow.x < YELLOW_SQUARE.x + YELLOW_SQUARE.w && CUBE_HOMES.yellow.y > YELLOW_SQUARE.y && CUBE_HOMES.yellow.y < YELLOW_SQUARE.y + YELLOW_SQUARE.h);
});

/** The two supports of a tower as the game puts them on the field. */
function supportsOf(tower: TowerId): [Body, Body] {
  const bodies = fireFighterGame.createBodies(RULES_SETUP);
  const left = bodies.find((body) => body.id === supportId(tower, 'left'));
  const right = bodies.find((body) => body.id === supportId(tower, 'right'));
  assert.ok(left && right, tower);
  return [left, right];
}

test('the towers as the window describes them are the towers on the field: 10.5 x 4 cm, sides 2.25 cm thick and 10 cm high, 6 cm apart', () => {
  assert.deepEqual([TOWER_WIDTH, TOWER_DEPTH, TOWER_GAP, SUPPORT_WIDTH, TOWER_HEIGHT], [105, 40, 60, 22.5, 100]);
  assert.equal(cm(SUPPORT_WIDTH), '2.25', 'not rounded to 2.3');
  for (const tower of TOWER_IDS) {
    const [left, right] = supportsOf(tower);
    for (const side of [left, right]) {
      assert.deepEqual([side.w, side.l, side.h, side.angle], [SUPPORT_WIDTH, TOWER_DEPTH, TOWER_HEIGHT, 0], side.id);
      assert.equal(side.grippable, false, side.id);
    }
    assert.ok(Math.abs(right.x + right.w / 2 - (left.x - left.w / 2) - TOWER_WIDTH) < 1e-9, `${tower}: 10.5 cm wide`);
    assert.ok(Math.abs(right.x - right.w / 2 - (left.x + left.w / 2) - TOWER_GAP) < 1e-9, `${tower}: the sides 6 cm apart`);
    // "as wide as the white dashed square": the square between the side marks, measured on the middle of its dashes
    assert.ok(Math.abs(left.x + left.w / 2 - (SQUARE_MIDDLES[tower].x - TOWER_GAP / 2)) < 0.1, `${tower}: the left side on the square's edge`);
    assert.equal(left.group, right.group, `${tower}: one piece`);
    assert.equal(left.y, TOWER_MIDDLES[tower].y);
  }
});

test('the room in a tower: 7.8 mm off the middle along the opening is still inside the dashed square, 7.9 mm is not; 5 mm on each side', () => {
  assert.equal(mmDown(ROOM_ALONG_OPENING), '7.8');
  assert.ok(ROOM_ALONG_OPENING >= 7.8 && ROOM_ALONG_OPENING < 7.9, `${ROOM_ALONG_OPENING}: rounded DOWN, so the window promises no more than the referee gives`);
  assert.equal(ROOM_ACROSS, (TOWER_GAP - CUBE_SIZE) / 2);
  assert.equal(ROOM_ACROSS, 5);
  // the referee's own test of the letter area (without the robot, the stay and the mat), on every tower, both ways
  const cubeAt = (x: number, y: number): Body => {
    const body = fireFighterGame.createBodies(RULES_SETUP).find((b) => b.id === cubeId('yellow'));
    assert.ok(body);
    return { ...body, x, y };
  };
  const none = { x: 0, y: 0 };
  for (const tower of TOWER_IDS) {
    const { x, y } = SQUARE_MIDDLES[tower];
    for (const sign of [1, -1]) {
      assert.equal(insideLetterArea(cubeAt(x, y + sign * 7.8), tower, none), true, `${tower}: 7.8 mm`);
      assert.equal(insideLetterArea(cubeAt(x, y + sign * 7.9), tower, none), false, `${tower}: 7.9 mm`);
      // across, the letter area would allow more than the sides do (7.47 mm): the 5 mm of the window are the sides'
      assert.equal(insideLetterArea(cubeAt(x + sign * ROOM_ACROSS, y), tower, none), true, `${tower}: 5 mm sideways`);
      assert.ok((LETTER_AREA[tower].w - CUBE_SIZE) / 2 > ROOM_ACROSS, tower);
    }
    const [left, right] = supportsOf(tower);
    assert.ok(Math.abs(right.x - right.w / 2 - (x + CUBE_SIZE / 2) - ROOM_ACROSS) < 0.1 && Math.abs(x - CUBE_SIZE / 2 - (left.x + left.w / 2) - ROOM_ACROSS) < 0.1, `${tower}: 5 mm on each side`);
  }
});

test('the claw: with a cube in it, it is too wide for a tower; closed and empty, it fits - the robot is the mBot2 of Fire Rescue', () => {
  const g = FIRE_FIGHTER_ROBOT.gripper;
  assert.equal(g.enabled, true);
  const withCube = CUBE_SIZE + 2 * g.fingerThickness;
  const closed = g.clawClosedGap + 2 * g.fingerThickness;
  const open = g.clawOpenGap + 2 * g.fingerThickness;
  assert.deepEqual([withCube, closed, open], [66, 36, 80]);
  assert.ok(withCube > TOWER_GAP, '"A claw that holds a cube does not fit between the sides."');
  assert.ok(open > TOWER_GAP);
  assert.ok(closed < TOWER_GAP, '"close the empty claw and push the cube in"');
  // "move back at least 5 cm": the cube is that deep, and the open fingers must come off it before they close
  assert.equal(cm(CUBE_SIZE), '5');
  // "the mBot2 of Fire Rescue Junior and Senior", part for part (both screens play with DEFAULT_ROBOT_CONFIG)
  assert.deepEqual(FIRE_FIGHTER_ROBOT, DEFAULT_ROBOT_CONFIG);
  assert.match(read('../fire-rescue/FireRescueSimulator.tsx'), /robotConfig=\{DEFAULT_ROBOT_CONFIG\}/);
  assert.match(read('../fire-rescue-junior/FireRescueJuniorSimulator.tsx'), /robotConfig=\{DEFAULT_ROBOT_CONFIG\}/);
  assert.equal(fireFighterGame.robotConfig, FIRE_FIGHTER_ROBOT);
});

test('the T bars: at M, A, K and E the claw is already inside the tower when the line sensor reaches the bar; at X it is not', () => {
  const ahead = clawAheadOfLineSensor(FIRE_FIGHTER_ROBOT);
  assert.equal(ahead, 82);
  assert.equal(cm(ahead), '8.2');
  /** From the edge of the T bar the sensor meets first, driving towards the tower, to the tower's face (mm). */
  const barToTower = (tower: TowerId): number => {
    const barY = LINES[TOWER_STEMS[tower].tBar][0].y;
    const middle = TOWER_MIDDLES[tower].y;
    return OPENING[tower] === 'top' ? middle - TOWER_DEPTH / 2 - (barY - LINE_WIDTH / 2) : barY + LINE_WIDTH / 2 - (middle + TOWER_DEPTH / 2);
  };
  for (const tower of RED_TOWERS) {
    const gap = barToTower(tower);
    assert.ok(gap > 50 && gap < ahead, `${tower}: ${gap.toFixed(2)} mm, the claw ${(ahead - gap).toFixed(2)} mm inside`);
    assert.ok(ahead - gap < TOWER_DEPTH, `${tower}: inside the tower, not through it`);
  }
  assert.ok(barToTower('X') > ahead, `X: ${barToTower('X').toFixed(2)} mm`);
});

test('the cubes start in the middle of their marked squares', () => {
  const bodies = fireFighterGame.createBodies(RULES_SETUP);
  for (const place of CUBE_PLACES) {
    const body = bodies.find((b) => b.id === cubeId(place));
    assert.ok(body, place);
    const square = CUBE_SQUARES[place];
    assert.ok(Math.abs(body.x - (square.x + square.w / 2)) < 1e-9 && Math.abs(body.y - (square.y + square.h / 2)) < 1e-9, place);
    assert.deepEqual([body.w, body.l, body.angle, body.colorName], [CUBE_SIZE, CUBE_SIZE, 0, CUBE_COLORS[place]], place);
  }
});

test('short sentences: no sentence is longer than 140 characters, no bullet longer than 230', () => {
  for (const text of SCREEN_TEXTS.filter((t) => !PAGE_TEXTS.includes(t))) {
    assert.ok(text.length <= 230, `${text.length}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${sentence.length}: ${sentence}`);
  }
});

test('the two parts: every section with a heading of its own and at least one line, none twice', () => {
  for (const part of [FIRE_FIGHTER_RULES, FIRE_FIGHTER_ASSUMPTIONS.sections]) {
    assert.equal(new Set(part.map((section) => section.title)).size, part.length, 'no heading twice');
    for (const section of part) {
      assert.ok(section.items.length > 0, section.title);
      assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no line twice`);
    }
  }
  assert.deepEqual(
    FIRE_FIGHTER_ASSUMPTIONS.sections.map((section) => section.title),
    ['The towers', 'The letter', 'Pushing a cube in', 'The cubes', 'The robot', 'The match', 'Not in the simulator'],
  );
  // (no heading of one part is a heading of the other: the window shows them as headings of one page)
  const both = [...FIRE_FIGHTER_RULES, ...FIRE_FIGHTER_ASSUMPTIONS.sections].map((section) => section.title);
  assert.equal(new Set(both).size, both.length);
});

// ---------------------------------------------------------------------------------------------
// The examples of every game: none of their words on this screen
// ---------------------------------------------------------------------------------------------

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A text as words of its own, in any letter case, with any blanks between its words (as the guard finds a title). */
const asWords = (text: string, flags = 'i'): RegExp => new RegExp(`(?<!\\w)${text.trim().split(/\s+/).map(escape).join('\\s+')}(?!\\w)`, flags);

/**
 * What would give an example away on this screen, of every game that has examples (../../members/all-examples.ts:
 * also Fire Fighter's, once it has them): its title in any letter case; the words before the colon of a title, as
 * written; its id when that has a dash; the name and the few words of a level; and every sentence of six words or
 * more of its description (a sentence ends at ". ", "! ", "? " or ": "), in any letter case.
 */
function exampleMarkers(): Array<[RegExp, string]> {
  const markers: Array<[RegExp, string]> = [];
  for (const game of ALL_GAMES) {
    for (const example of game.examples) {
      markers.push([asWords(example.title), `the title of ${example.id}`]);
      const head = example.title.split(':')[0].trim();
      if (head !== example.title && /\s/.test(head)) markers.push([asWords(head, ''), `the head of the title of ${example.id}`]);
      if (example.id.includes('-')) markers.push([new RegExp(`(?<![\\w-])${escape(example.id)}(?![\\w-])`, 'i'), `the id ${example.id}`]);
      for (const sentence of example.description.split(/(?<=[.!?:])\s+/)) {
        const words = sentence.replace(/[.!?:]+$/, '').trim().split(/\s+/);
        if (words.length >= 6) markers.push([new RegExp(words.map(escape).join('\\s+'), 'i'), `a sentence of ${example.id}: "${words.join(' ')}"`]);
      }
    }
    for (const level of game.levels) {
      markers.push([asWords(level.title), `the level ${level.id} of ${game.game}`]);
      markers.push([new RegExp(escape(level.about)), `the words of the level ${level.id} of ${game.game}`]);
    }
  }
  return markers;
}

test('no text of the Fire Fighter screen gives an example away: no title, head, id or level, no sentence of an example of any game', () => {
  const markers = exampleMarkers();
  assert.ok(markers.length > 150, `${markers.length} markers`);
  const found: string[] = [];
  for (const text of SCREEN_TEXTS) {
    for (const [marker, what] of markers) if (marker.test(text)) found.push(`${what} in "${text}"`);
    // the names of the levels, in any letter case (the screen of a game names none)
    if (/\b(?:starter|intermediate|advanced)\b/i.test(text)) found.push(`a level name in "${text}"`);
  }
  assert.deepEqual(found, []);
  // (the test does find one: a title, a head, a sentence of a description)
  const fireRescue = ALL_GAMES.find((game) => game.game === 'fire-rescue');
  assert.ok(fireRescue);
  const probe = (text: string): boolean => markers.some(([marker]) => marker.test(text));
  assert.equal(probe(`Try "${fireRescue.examples[1].title.toUpperCase()}" here.`), true);
  assert.equal(probe(fireRescue.examples[0].description), true);
  assert.equal(probe('The robot drives on its own.'), false);
});

test('the words of the screen hold no number that is not a constant either', () => {
  const words = screenWords(FIRE_FIGHTER_WORDS);
  const numbers = [...words.sheetNote.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  assert.deepEqual(numbers, [0, MOVED_TOWER_PENALTY, 0]);
});
