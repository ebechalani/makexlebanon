/**
 * The rules window of Locker Room (./rules.ts) against the game:
 *   - every number in its sentences is the number the code has - compared one by one with the
 *     constant that holds it; a number that is on no list here fails the test,
 *   - the points add up to the highest score the referee gives (85), and the highest score a
 *     robot can reach with these marks and this cube (75) is worked out, not written,
 *   - what the simulator only assumes is in the second part, and the rules part does not say it,
 *   - the texts follow the one table of which mark is a pickup zone and which a target,
 *   - the sentences are short (many students read English as a second language),
 *   - the sentences about the referee at the Scan Station are tried out on the real engine.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TABLE_MARGIN } from '../../core/engine';
import { createSimulation } from '../../core/simulation';
import type { Simulation } from '../../core/types';
import { CARD, CUBE_HEIGHT, CUBE_SIZE, GATE_HEIGHT, MARKS, MAT_SIZE, TEAM_BOX, targetOf } from '../../locker-room/field';
import {
  BOX_LIFT_S,
  CARD_AWAY_S,
  CARD_SHOW_S,
  GATE_TOUCH_PENALTY,
  LINE_APPROVAL,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_APPROVAL,
  POINTS_DELIVERY,
  POINTS_GATE,
  POINTS_LEAVE,
  POINTS_SCAN_STATION,
  POINTS_TOKEN,
  POINTS_TOKEN_PARTLY,
  PROP_CARD,
  PROP_TEAM_BOX,
  WRONG_DELIVERY_PENALTY,
  WRONG_TOKEN_PENALTY,
  lockerRoomGame,
} from '../../locker-room/game';
import { LOCKER_ROOM_ROBOT } from '../../locker-room/robot';
import { TOKEN_COLORS, ZONE_OPTION_NUMBERS, defaultScenario } from '../../locker-room/scenario';
import { moveCm, program, script, wait, whenStart } from '../../vm/builder';
import type { RulesSection } from '../SimulatorApp';
import { INSIDE_THE_FRAME, LOCKER_ROOM_ASSUMPTIONS, LOCKER_ROOM_RULES, LOCKER_ROOM_RULES_NOTE, REACHABLE_MAX, TOO_SMALL_TARGETS, cubeFitsInside, robotLength, robotWidth } from './rules';

const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(LOCKER_ROOM_RULES);
const ASSUMED = sentences(LOCKER_ROOM_ASSUMPTIONS.sections);
const RULES_TEXT = RULES.join('\n');
const ASSUMED_TEXT = ASSUMED.join('\n');
const EVERY_TEXT = [LOCKER_ROOM_RULES_NOTE, LOCKER_ROOM_ASSUMPTIONS.title, LOCKER_ROOM_ASSUMPTIONS.note ?? '', ...RULES, ...ASSUMED];

const cm = (mm: number): number => Math.round(mm) / 10;

/**
 * The numbers the window may say, and what each one is. A number in a sentence that is not one
 * of these values fails the test - so a new number needs its constant here.
 */
const KNOWN_NUMBERS: ReadonlyArray<[number, string]> = [
  [POINTS_LEAVE, 'POINTS_LEAVE'],
  [POINTS_SCAN_STATION, 'POINTS_SCAN_STATION'],
  [POINTS_APPROVAL, 'POINTS_APPROVAL'],
  [POINTS_DELIVERY, 'POINTS_DELIVERY'],
  [WRONG_DELIVERY_PENALTY, 'WRONG_DELIVERY_PENALTY'],
  [POINTS_GATE, 'POINTS_GATE'],
  [GATE_TOUCH_PENALTY, 'GATE_TOUCH_PENALTY'],
  [POINTS_TOKEN, 'POINTS_TOKEN'],
  [POINTS_TOKEN_PARTLY, 'POINTS_TOKEN_PARTLY'],
  [WRONG_TOKEN_PENALTY, 'WRONG_TOKEN_PENALTY'],
  [MAX_SCORE, 'MAX_SCORE'],
  [REACHABLE_MAX, 'REACHABLE_MAX'],
  [MATCH_DURATION, 'MATCH_DURATION'],
  [TOKEN_COLORS.length, 'the number of tokens'],
  [ZONE_OPTION_NUMBERS.length, 'the number of zone cards'],
  [CARD_SHOW_S, 'CARD_SHOW_S'],
  [CARD_AWAY_S, 'CARD_AWAY_S'],
  [BOX_LIFT_S, 'BOX_LIFT_S'],
  [cm(MAT_SIZE), 'MAT_SIZE in cm'],
  [cm(CUBE_SIZE), 'CUBE_SIZE in cm'],
  [cm(CUBE_HEIGHT), 'CUBE_HEIGHT in cm'],
  [cm(TEAM_BOX.w), 'TEAM_BOX.w in cm'],
  [cm(TEAM_BOX.l), 'TEAM_BOX.l in cm'],
  [cm(TEAM_BOX.h), 'TEAM_BOX.h in cm'],
  [cm(CARD.w), 'CARD.w in cm'],
  [cm(CARD.h), 'CARD.h in cm'],
  [cm(GATE_HEIGHT), 'GATE_HEIGHT in cm'],
  [cm(TABLE_MARGIN), 'TABLE_MARGIN in cm'],
  [cm(INSIDE_THE_FRAME), 'the room inside the frame of the Locker Room in cm'],
  [cm(robotLength(LOCKER_ROOM_ROBOT)), 'the length of the robot in cm'],
  [cm(robotWidth(LOCKER_ROOM_ROBOT)), 'the width of the robot in cm'],
  [cm(LOCKER_ROOM_ROBOT.frontColorSensor.rangeMm), 'the range of the colour sensor at the claw in cm'],
  [2026, 'the season'],
  [2.3, 'the version of the older rules on this website'],
  [13, 'the youngest age of the category'],
  [15, 'the oldest age of the category'],
  [2, 'the 2 runs of the ranking'],
  [0, 'the lowest total, and a run that counts 0'],
  // ("Step 1" ... "Step 6": the numbers of the steps of the rules, §5)
  ...[1, 2, 3, 4, 5, 6].map((step): [number, string] => [step, `Step ${step}`]),
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
  assert.ok(found >= 50, `${found} numbers checked`);
});

test('the numbers are the referee\'s: the points, the time, the timings at the Scan Station, the sizes', () => {
  assert.equal(POINTS_LEAVE + POINTS_SCAN_STATION + POINTS_APPROVAL + POINTS_DELIVERY + POINTS_GATE + TOKEN_COLORS.length * POINTS_TOKEN, MAX_SCORE);
  assert.equal(MAX_SCORE, 85);
  assert.ok(RULES_TEXT.includes(`Points (${MAX_SCORE} at most)`));
  assert.ok(RULES_TEXT.includes('All together: 5 + 10 + 15 + 20 + 5 + 3 x 10 = 85.'));
  assert.ok(RULES_TEXT.includes(`A match lasts ${lockerRoomGame.matchDuration} seconds.`));
  assert.ok(ASSUMED_TEXT.includes('0.5 seconds later the referee shows the card. At 2.5 seconds the referee takes it away. At 4 seconds the referee lifts the Team Box: +15.'));
  assert.deepEqual([CARD_SHOW_S, CARD_AWAY_S, BOX_LIFT_S], [0.5, 2.5, 4]);
  // the robot's sizes, from the same robot the game is played with
  assert.equal(robotLength(LOCKER_ROOM_ROBOT), 237);
  assert.equal(robotWidth(LOCKER_ROOM_ROBOT), 130);
  assert.ok(ASSUMED_TEXT.includes('23.7 cm long and 13 cm wide'));
  assert.ok(ASSUMED_TEXT.includes('inside the frame there are only 23.6 cm, and the robot is 23.7 cm long'));
  assert.ok(ASSUMED_TEXT.includes('A cube is 5 x 5 cm and 7 cm high'));
  assert.ok(ASSUMED_TEXT.includes('9 x 11 x 8 cm here. The rules give no size.'));
  // the referee's own sheet gives the same highest score
  const sim = createSimulation({ game: lockerRoomGame, scenario: defaultScenario(), program: program([script(whenStart(), [])]) });
  assert.equal(sim.score().max, MAX_SCORE);
  // no restarts: the game allows none, the window says why there is no button
  assert.deepEqual(lockerRoomGame.restartRules, { maxRestarts: 0 });
  assert.ok(RULES_TEXT.includes('There are no restarts. If anyone but the referee touches the robot after GO, the run counts 0. So there is no Restart button here.'));
});

test('the marks: with the published 5 cm cube the RED and the GREEN targets (4.2 cm squares) can never hold a whole token - so 75 is the most, and the window says so', () => {
  assert.deepEqual(TOO_SMALL_TARGETS, ['red', 'green']);
  assert.equal(REACHABLE_MAX, 75);
  assert.ok(ASSUMED_TEXT.includes('A cube is 5 cm wide, and here the RED and the GREEN token have targets that are smaller. So they can never be completely inside: +5 at most. The most a robot can score here is 75.'));
  assert.ok(ASSUMED_TEXT.includes('Here the team cubes start on the red rectangle at the top left and on the green rectangle at the top right.'));
  assert.ok(ASSUMED_TEXT.includes('The tokens go to their targets: RED to the red square in the maze, GREEN to the green square in the maze, BLUE to the blue disc in the maze.'));
  // if the organiser swaps the marks (the turned rectangles and the light-blue one as targets), every target holds a cube
  for (const id of ['redDiamond', 'greenDiamond', 'cyanRect', 'blueDisc'] as const) assert.equal(cubeFitsInside(MARKS[id]), true, id);
  for (const id of ['redSquare', 'greenSquare'] as const) assert.equal(cubeFitsInside(MARKS[id]), false, id);
  // (a disc must hold the cube however it is turned: its corners on the circle)
  assert.equal(cubeFitsInside({ id: 'blueDisc', name: '', color: 'blue', circle: { cx: 0, cy: 0, r: (CUBE_SIZE * Math.SQRT2) / 2 - 0.01 } }), false);
  assert.equal(cubeFitsInside(targetOf('blue')), true);
});

test('what the simulator only assumes is in the second part; the rules part does not say it', () => {
  assert.equal(LOCKER_ROOM_ASSUMPTIONS.title, 'What this simulator assumes');
  assert.match(LOCKER_ROOM_ASSUMPTIONS.note ?? '', /^These are not rules\./);
  const assumed: Array<[string, RegExp]> = [
    ['which marks are pickup zones and targets', /Here the team cubes start on /],
    ['the evidence for the other reading', /The older rules say both "pickup zone \(top left\)" and "the cube on the matching square"\. The organiser has been asked/],
    ['the Team Box rides on the robot', /The Team Box rides on top of the robot from the start/],
    ['the Team Box is no part of the footprint', /It does not make the robot bigger on the mat, and no sensor sees it\./],
    ['the card', /The rules say "a color cube" and "the card"\. Here the referee holds a card of the team colour just in front of the claw\./],
    ['the card is read by the claw sensor, not pushed, not seen by the ultrasonic', /It is read by the colour sensor at the claw\. The robot cannot push it, and the ultrasonic sensor does not see it\./],
    ['the timings', /The rules give no times\./],
    ['moving before the box is lifted', /If the robot moves before that, the card goes away and the box stays on\./],
    ['a program that ends while waiting', /If your program ends while the robot waits, the match ends too - before the box is lifted\./],
    ['leaving = the whole robot', /Step 1 counts when the whole robot is outside the Locker Room, its yellow frame included\./],
    ['reaching = the whole robot', /Step 2 counts when the whole robot is inside the Scan Station, its yellow frame included\./],
    ['the first delivery decides', /The first delivery decides Step 5\. Later deliveries change nothing\./],
    ['the scan need not come first', /The rules do not say that the robot must read the card first\. Here it does not have to\./],
    ['a token in a big circle', /A token in a big circle, or a team cube on a maze target, counts for nothing\./],
    ['partly inside another target, and not in its own = wrong', /A token that is partly inside a target of another colour, and not in its own, counts as a wrong delivery: -10\./],
    ['partly inside its own target and another one', /A token that is partly inside its own target counts for it, even if it touches another target too\./],
    ['the scan is not checked', /The simulator cannot see if your program read the card\. Here the box is lifted after 4 seconds, read or not\./],
    ['the scan at the competition', /At the competition the robot must read the card\. The rules do not say how the referee checks it\./],
    ['the cube of the other colour in any circle', /The rules say only "Wrong color circle"\. Here the cube of the other colour in any big circle is a wrong delivery too: -10\./],
    ['the closed gate and the tokens', /Here the closed gate does not stop the robot from sorting the tokens: they count all the same\. The robot can drive around the gate\./],
    ['the gate in the story and in v2.3', /The story of the rules sorts the tokens after the gate opens\. The older rules \(v2\.3\) let the robot enter the maze only then\./],
    ['the line sensor sees yellow as line', /"Line" means a light colour: white, and also yellow \(the frames, the band, the pieces\)\./],
    ['+5 is done on a target too small for a cube', /So on the score sheet, \+5 counts as done for those tokens\./],
    ['the gate touch once', /Touching it costs 10 points once, however often the robot touches it\./],
    ['a pushed cube is no touch', /A cube that the robot pushes against the gate is not the robot touching it\./],
    ['the size of the gate', /6 cm high\. The rules give no size\./],
    ['the cube size', /as the cube file on this website\. It is light/],
    ['the table around the mat', /The mat lies on a table\. .* stop 10 cm outside it/],
    ['the yellow pieces and the light-blue rectangle', /have no role in the rules/],
    ['the total never below 0', /The total is never below 0\. The rules do not say\./],
  ];
  for (const [what, sentence] of assumed) {
    assert.match(ASSUMED_TEXT, sentence, what);
    assert.doesNotMatch(RULES_TEXT, sentence, `${what}: not in the rules part`);
  }
  // the rules part says none of the simulator's own numbers or choices
  for (const word of [/\b0\.5\b/, /\b2\.5\b/, /\b75\b/, /below 0/, /table/i, /yellow frame/i, /\bonce\b/, /whole robot/i, /first delivery/i, /(?<![\d.])5 cm\b/, /disc/i, /square/i, /rectangle/i]) {
    assert.doesNotMatch(RULES_TEXT, word, String(word));
  }
  // the rules part: the rules' own points, and their 4 seconds as the rules say them
  assert.ok(RULES_TEXT.includes('+10 for each token completely inside the target of its colour, +5 when it is only partly inside. A wrong delivery: -10.'));
  assert.ok(RULES_TEXT.includes('The rules say: it is better when the robot waits 4 seconds, so that the referee can lift the Team Box.'));
  // the rules part: the referee puts the colour in front of the robot - how (a card held at the claw) is the simulator's choice
  assert.ok(RULES_TEXT.includes('The referee puts the team colour (RED or GREEN) in front of the robot. The robot reads it by itself.'));
  assert.doesNotMatch(RULES_TEXT, /holds a card|claw/);
  // nothing the simulator cannot do: its table stops the robot before it could back out of the Locker Room over the edge
  assert.doesNotMatch(ASSUMED_TEXT, /backwards/);
  assert.doesNotMatch(ASSUMED_TEXT, /"line" means a white line/);
  // where the field comes from the older rules, the window says so
  assert.ok(RULES_TEXT.includes('The older rules (v2.3) put the RED pickup zone at the top left and the GREEN pickup zone at the top right.'));
  assert.match(LOCKER_ROOM_RULES_NOTE, /The rules file on this website is the older version 2\.3\./);
  assert.doesNotMatch(LOCKER_ROOM_RULES_NOTE, /Starter|Advanced|Intermediate/, 'not the name of a level of the examples');
});

test('short sentences: no sentence is longer than 140 characters, no bullet longer than 230', () => {
  for (const text of EVERY_TEXT) {
    assert.ok(text.length <= 230, `${text.length}: ${text}`);
    for (const sentence of text.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${sentence.length}: ${sentence}`);
  }
});

test('the two parts: the mission first, every section with a heading of its own and at least one line', () => {
  assert.equal(LOCKER_ROOM_RULES[0].title, 'The mission');
  for (const part of [LOCKER_ROOM_RULES, LOCKER_ROOM_ASSUMPTIONS.sections]) {
    assert.equal(new Set(part.map((section) => section.title)).size, part.length, 'no heading twice');
    for (const section of part) {
      assert.ok(section.items.length > 0, section.title);
      assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no line twice`);
    }
  }
  assert.ok(LOCKER_ROOM_ASSUMPTIONS.sections.length >= 8);
});

// ---------------------------------------------------------------------------------------------
// The referee at the Scan Station, tried out on the real engine
// ---------------------------------------------------------------------------------------------

/** Into the Scan Station (98.2 cm), then `blocks`. */
function play(blocks: NonNullable<Parameters<typeof script>[1]>): Simulation<unknown> {
  const sim = createSimulation({ game: lockerRoomGame, scenario: defaultScenario(), program: program([script(whenStart(), [moveCm('forward', 98.2), ...blocks])]) }) as Simulation<unknown>;
  sim.start();
  return sim;
}
const props = (sim: Simulation<unknown>): string[] => (sim.world.props ?? []).map((prop) => prop.id);

test('"the referee shows the card 0.5 s later, takes it away at 2.5 s and lifts the Team Box at 4 s" - after the robot came to rest', () => {
  const sim = play([wait(6)]);
  let rest: number | null = null;
  const seen: Array<[string, number]> = [];
  let last = props(sim).join(',');
  while (sim.status === 'running' && sim.world.time < 20) {
    sim.step(1);
    const robot = sim.world.robot;
    if (rest === null && robot.left.rpm === 0 && robot.right.rpm === 0 && sim.world.time > 1) rest = sim.world.time;
    const now = props(sim).join(',');
    if (now !== last) seen.push([now, sim.world.time]);
    last = now;
  }
  assert.ok(rest !== null);
  assert.deepEqual(
    seen.map(([list]) => list),
    [`${PROP_TEAM_BOX},${PROP_CARD}`, PROP_TEAM_BOX, ''],
    'the card comes, the card goes, the box goes',
  );
  const after = seen.map(([, time]) => Math.round((time - rest) * 100) / 100);
  assert.deepEqual(after, [CARD_SHOW_S, CARD_AWAY_S, BOX_LIFT_S]);
  assert.equal(sim.score().lines.find((line) => line.id === LINE_APPROVAL)?.points, POINTS_APPROVAL);
});

test('"if your program ends while the robot waits, the match ends too - before the box is lifted"', () => {
  const sim = play([]);
  while (sim.status === 'running' && sim.world.time < 30) sim.step(1);
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'program-ended');
  assert.ok(sim.world.time < 10, `ended at ${sim.world.time} s`);
  assert.equal(sim.score().total, POINTS_LEAVE + POINTS_SCAN_STATION);
  assert.deepEqual(props(sim), [PROP_TEAM_BOX], 'the box is still on the robot');
});
