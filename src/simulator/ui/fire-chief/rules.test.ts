/**
 * The rules window of Fire Chief (./rules.ts) against the game:
 *   - every number in its sentences is the number the code has - compared one by one with the
 *     constant that holds it; a number that is on no list here fails the test,
 *   - the draft is marked as a draft, the organiser's decisions are among the rules, and what
 *     the simulator only assumes is in the second part and nowhere else,
 *   - a few sentences that can be tried out are tried out on the real engine and referee.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSimulation } from '../../core/simulation';
import {
  CELL_SIZE,
  FIELD_SIZE,
  FIRE_SPOTS,
  GRID_CELLS,
  OUTER_WALLS,
  ROBOT_MAX_HEIGHT,
  ROBOT_MAX_LENGTH,
  ROBOT_MAX_WIDTH,
  ROOM_IDS,
  SENSOR_MAX_HEIGHT,
  TARGET_COLOR,
  TARGET_DEPTH,
  TARGET_HEIGHT,
  TARGET_MASS,
  TARGET_WIDTH,
  WALL_COLOR_NAME,
  WALL_HEIGHT,
  WALL_LENGTH,
  WALL_THICKNESS,
  targetPose,
} from '../../fire-chief/field';
import {
  FAN_ACTION_SECONDS,
  MATCH_DURATION,
  MAX_RESTARTS,
  MAX_SCORE,
  POINTS_ENTER_ROOM,
  POINTS_FAN_COMPLETE,
  POINTS_FAN_START,
  POINTS_LEAVE_START,
  TARGET_DISPLACED_MM,
  TOUCH_MM,
  fireChiefGame,
} from '../../fire-chief/game';
import { COLOR_SENSOR, COLOR_SENSOR_RANGE_MM, FAN, FIRE_CHIEF_ROBOT, START_POSE } from '../../fire-chief/robot';
import { defaultScenario, openField } from '../../fire-chief/scenario';
import { blankProgram } from '../program-file';
import { dcMotor, move, moveCm, program, script, wait, whenStart } from '../../vm/builder';
import type { RulesSection } from '../SimulatorApp';
import { FIRE_CHIEF_ASSUMPTIONS, FIRE_CHIEF_RULES, FIRE_CHIEF_RULES_NOTE } from './rules';

const sentences = (sections: readonly RulesSection[]): string[] => sections.flatMap((section) => [section.title, ...section.items]);
const RULES = sentences(FIRE_CHIEF_RULES);
const ASSUMED = sentences(FIRE_CHIEF_ASSUMPTIONS.sections);
const RULES_TEXT = RULES.join('\n');
const ASSUMED_TEXT = ASSUMED.join('\n');

const cm = (mm: number): number => mm / 10;

/**
 * A number in a sentence and the value the code has for it. `find` is looked for in every
 * sentence; each of its groups is one number, in the order of `values`.
 */
interface NumberCheck {
  find: RegExp;
  values: number[];
  /** in which part it must be found: the rules, the assumptions, or both */
  part: 'rules' | 'assumed' | 'both';
}

const CHECKS: NumberCheck[] = [
  // ---- the field
  { find: /grid of (\d+) x (\d+) cells/, values: [GRID_CELLS, GRID_CELLS], part: 'rules' },
  { find: /a cell is (\d+) x (\d+) cm/, values: [cm(CELL_SIZE), cm(CELL_SIZE)], part: 'rules' },
  { find: /whole mat is (\d+) x (\d+) cm/, values: [cm(FIELD_SIZE), cm(FIELD_SIZE)], part: 'rules' },
  { find: /They are (\d+) cm high and (\d+) mm thick/, values: [cm(WALL_HEIGHT), WALL_THICKNESS], part: 'rules' },
  { find: /a red wooden flame, (\d+) cm wide and (\d+) cm high/, values: [cm(TARGET_WIDTH), cm(TARGET_HEIGHT)], part: 'rules' },
  // ---- the robot
  { find: /at most (\d+) cm long, (\d+) cm wide and (\d+) cm high/, values: [cm(ROBOT_MAX_LENGTH), cm(ROBOT_MAX_WIDTH), cm(ROBOT_MAX_HEIGHT)], part: 'rules' },
  { find: /higher than (\d+) cm above the mat/, values: [cm(SENSOR_MAX_HEIGHT)], part: 'rules' },
  // ---- the attempt and the points
  { find: /lasts at most (\d+) minutes \((\d+) seconds\)/, values: [MATCH_DURATION / 60, MATCH_DURATION], part: 'rules' },
  { find: /counts once \((\d+) in all\)/, values: [MAX_SCORE], part: 'rules' },
  { find: /^(\d+) points: the whole robot has left the START cell/, values: [POINTS_LEAVE_START], part: 'rules' },
  { find: /^(\d+) points: the whole robot is inside the living room or the bedroom/, values: [POINTS_ENTER_ROOM], part: 'rules' },
  { find: /^(\d+) points: the robot stands still, faces the fire target and its fan is on/, values: [POINTS_FAN_START], part: 'rules' },
  { find: /^(\d+) points: the fan keeps blowing at the target like this for (\d+) seconds without a break/, values: [POINTS_FAN_COMPLETE, FAN_ACTION_SECONDS], part: 'rules' },
  { find: /at most (\d+) cm from the target/, values: [cm(FAN.reachMm)], part: 'rules' },
  { find: /ends the attempt with (\d+) points/, values: [MAX_SCORE - POINTS_ENTER_ROOM], part: 'rules' },
  { find: /stops before the (\d+) seconds are over\. The (\d+) points stay, and the (\d+) seconds start again/, values: [FAN_ACTION_SECONDS, POINTS_FAN_START, FAN_ACTION_SECONDS], part: 'rules' },
  { find: /the (\d+)-second fan action is done/, values: [FAN_ACTION_SECONDS], part: 'rules' },
  // ---- what the simulator assumes: the target
  { find: /It is (\d+) cm thick and light/, values: [cm(TARGET_DEPTH)], part: 'assumed' },
  { find: /more than (\d+) mm away from its place/, values: [TARGET_DISPLACED_MM], part: 'assumed' },
  { find: /closer than ([\d.]+) mm/, values: [TOUCH_MM], part: 'assumed' },
  // ---- the colour sensor and the fan
  { find: /one sensor in the middle of the front of the robot, (\d+) cm above the mat/, values: [cm(COLOR_SENSOR.mount!.height)], part: 'assumed' },
  { find: /the thing in front of it is (\d+) mm away or closer/, values: [COLOR_SENSOR_RANGE_MM], part: 'assumed' },
  { find: /stop the robot (\d+) mm in front of it/, values: [COLOR_SENSOR_RANGE_MM], part: 'assumed' },
  { find: /power of that motor is (\d+) % or more/, values: [FAN.minPower], part: 'assumed' },
  { find: /at most (\d+) degrees to the side/, values: [FAN.coneHalfAngleDeg], part: 'assumed' },
  { find: /The (\d+) cm are measured from the fan/, values: [cm(FAN.reachMm)], part: 'assumed' },
  // ---- the robot of the simulator
  { find: /([\d.]+) cm long and (\d+) cm wide, with the colour sensor and the fan/, values: [cm(FIRE_CHIEF_ROBOT.chassisFront + FIRE_CHIEF_ROBOT.chassisRear), cm(FIRE_CHIEF_ROBOT.chassisWidth)], part: 'assumed' },
  { find: /time written on the (\d+) points/, values: [POINTS_FAN_START], part: 'assumed' },
];

/** Every number that stands in a sentence on its own (not glued to a letter, like the 2 of "mBot2" or the 1 of "M1"). */
const numbersIn = (sentence: string): Array<{ at: number; text: string }> =>
  [...sentence.matchAll(/(?<![A-Za-z\d.])\d+(?:\.\d+)?/g)].map((m) => ({ at: m.index, text: m[0] }));

test('rules: every number in the window is the number the code has', () => {
  // each check finds its sentence, in the right part, and the numbers in it are the code's
  for (const check of CHECKS) {
    const found = (part: readonly string[]): string[] => part.filter((sentence) => check.find.test(sentence));
    const inRules = found(RULES);
    const inAssumed = found(ASSUMED);
    if (check.part === 'rules') assert.ok(inRules.length >= 1 && inAssumed.length === 0, `${check.find} is said in the rules, and only there`);
    if (check.part === 'assumed') assert.ok(inAssumed.length >= 1 && inRules.length === 0, `${check.find} is said among the assumptions, and only there`);
    for (const sentence of [...inRules, ...inAssumed]) {
      const m = check.find.exec(sentence);
      assert.ok(m);
      assert.deepEqual(m.slice(1).map(Number), check.values, `"${sentence}"`);
    }
  }
  // and no sentence holds a number that no check has looked at
  for (const sentence of [...RULES, ...ASSUMED]) {
    const covered: Array<[number, number]> = [];
    for (const check of CHECKS) {
      const m = check.find.exec(sentence);
      if (m) covered.push([m.index, m.index + m[0].length]);
    }
    for (const number of numbersIn(sentence)) {
      assert.ok(
        covered.some(([from, to]) => number.at >= from && number.at < to),
        `the number ${number.text} in "${sentence}" is not compared with the code: add it to CHECKS`,
      );
    }
  }
  // the checks really find numbers: all the sentences together hold this many, and each is looked at
  const all = [...RULES, ...ASSUMED].flatMap(numbersIn);
  assert.ok(all.length >= 40, `${all.length} numbers`);
});

test('rules: what is said in words instead of numbers is the code\'s too', () => {
  // "one restart per attempt"
  assert.match(RULES_TEXT, /A team may ask for one restart per attempt\./);
  assert.equal(MAX_RESTARTS, 1);
  assert.equal(fireChiefGame.restartRules?.maxRestarts, 1);
  assert.equal(fireChiefGame.restartRules?.clearsPoints, true);
  assert.match(RULES_TEXT, /The points earned so far in this attempt are cleared\./);
  // the four achievements are the referee's four lines, with the points of the window
  const lines = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: blankProgram() })
    .score()
    .lines.filter((line) => line.max > 0);
  assert.deepEqual(lines.map((line) => line.max), [10, 20, 30, 40]);
  assert.equal(lines.reduce((sum, line) => sum + line.max, 0), MAX_SCORE);
  assert.equal(fireChiefGame.matchDuration, MATCH_DURATION);
  // "three places of its room": corner, back wall, side wall
  assert.match(ASSUMED_TEXT, /three places of its room, always against an outer wall and facing into the room: in the corner, in the middle of the back wall \(the top edge of the mat\) or in the middle of the side wall/);
  assert.deepEqual(FIRE_SPOTS, ['corner', 'back', 'side']);
  for (const room of ROOM_IDS) {
    const back = targetPose(room, 'back');
    const side = targetPose(room, 'side');
    const corner = targetPose(room, 'corner');
    // back: against the top edge of the mat, in the middle of the cell, facing down the mat
    assert.equal(back.y, TARGET_DEPTH / 2);
    assert.equal(back.x % CELL_SIZE, CELL_SIZE / 2);
    assert.equal(back.angle, Math.PI);
    // side: against the outer side wall, in the middle of the cell
    assert.equal(side.y, CELL_SIZE / 2);
    assert.ok(side.x === TARGET_DEPTH / 2 || side.x === FIELD_SIZE - TARGET_DEPTH / 2);
    // corner: as near to the two outer walls as its size allows
    assert.ok(corner.y < 40 && (corner.x < 40 || corner.x > FIELD_SIZE - 40));
  }
  // "the outer edge of the field is walled", "light: the robot can push it away", port M1
  assert.equal(OUTER_WALLS, true);
  assert.equal(TARGET_MASS, 1);
  assert.match(ASSUMED_TEXT, /The fan is on DC motor port M1\./);
  assert.equal(FAN.port, 'M1');
  // "walls close the corners without a gap": a panel is one thickness longer than a cell
  assert.equal(WALL_LENGTH, CELL_SIZE + WALL_THICKNESS);
  // "the robot is perfect": no wheel slip, no sensor noise
  assert.match(ASSUMED_TEXT, /The robot is perfect: its wheels do not slip and its sensors make no mistakes\./);
  assert.deepEqual(FIRE_CHIEF_ROBOT.noise, { wheelSlip: 0, sensor: 0, ultrasonicCm: 0 });
  // the robot of the simulator is inside the limits the rules give
  assert.ok(FIRE_CHIEF_ROBOT.chassisFront + FIRE_CHIEF_ROBOT.chassisRear <= ROBOT_MAX_LENGTH);
  assert.ok(FIRE_CHIEF_ROBOT.chassisWidth <= ROBOT_MAX_WIDTH);
  assert.ok(COLOR_SENSOR.mount!.height <= SENSOR_MAX_HEIGHT);
  // "the fan, at the front of the robot", "one sensor in the middle of the front of the robot":
  // both sit on the front face of the chassis
  assert.equal(FAN.forward, FIRE_CHIEF_ROBOT.chassisFront);
  assert.equal(FIRE_CHIEF_ROBOT.frontColorSensor, COLOR_SENSOR);
  assert.equal(COLOR_SENSOR.mount!.forward, FIRE_CHIEF_ROBOT.chassisFront);
  // "the fire is a red wooden flame", 'on the fire target it reads "red". On a wall it reads "yellow", never "red"'
  assert.match(RULES_TEXT, /The fire is a red wooden flame/);
  assert.match(ASSUMED_TEXT, /On the fire target it reads "red"\. On a wall it reads "yellow", never "red"\./);
  assert.equal(TARGET_COLOR, 'red');
  assert.equal(WALL_COLOR_NAME, 'yellow');
  // the robot of the rules has no flame sensor: nothing of the game's robot is called one
  assert.ok(!Object.keys(FIRE_CHIEF_ROBOT).some((part) => /flame/i.test(part)));
});

test('rules: sentences that can be tried out are true on the real engine and referee', () => {
  // ---- the colour sensor, with the fire at the back wall of the living room (its face is at y = 20 mm)
  const back = targetPose('living', 'back');
  const face = back.y + TARGET_DEPTH / 2;
  const FRONT = FIRE_CHIEF_ROBOT.chassisFront;
  const reads = (pose: { x: number; y: number; heading: number }, spot: 'back' | 'corner' = 'back'): string =>
    createSimulation({ game: fireChiefGame, scenario: openField('living', spot), program: blankProgram(), startPose: pose }).readSensors().frontColor;
  // "it names a colour only when the thing in front of it is 15 mm away or closer. Further away it reads none"
  assert.equal(reads({ x: back.x, y: face + COLOR_SENSOR_RANGE_MM + FRONT, heading: 0 }), 'red');
  assert.equal(reads({ x: back.x, y: face + COLOR_SENSOR_RANGE_MM + 1 + FRONT, heading: 0 }), 'none');
  // 'on a wall it reads "yellow", never "red"': the top wall beside the target, and the left wall
  assert.equal(reads({ x: 250, y: COLOR_SENSOR_RANGE_MM + FRONT, heading: 0 }), 'yellow');
  assert.equal(reads({ x: 250, y: COLOR_SENSOR_RANGE_MM + 1 + FRONT, heading: 0 }), 'none');
  assert.equal(reads({ x: 10 + FRONT, y: 220, heading: -Math.PI / 2 }), 'yellow');
  // "it is red on every side": one of its two ends, looked at along the top wall
  assert.equal(reads({ x: back.x + TARGET_WIDTH / 2 + 10 + FRONT, y: back.y, heading: -Math.PI / 2 }), 'red');
  // "when the target stands in a corner, the two walls of the corner stop the robot 15 mm in
  // front of it. There the sensor reads red only while the robot touches both walls, or almost
  // touches them": a robot that drives at it along the diagonal of the room
  const corner = targetPose('living', 'corner');
  const diagonal = corner.angle + Math.PI; // looking squarely at the front of the target
  const cornerFace = { x: corner.x + (TARGET_DEPTH / 2) * Math.sin(corner.angle), y: corner.y - (TARGET_DEPTH / 2) * Math.cos(corner.angle) };
  const onDiagonal = (gap: number) => ({ x: cornerFace.x - Math.sin(diagonal) * (gap + FRONT), y: cornerFace.y + Math.cos(diagonal) * (gap + FRONT), heading: diagonal });
  const driven = createSimulation({
    game: fireChiefGame,
    scenario: openField('living', 'corner'),
    program: program([script(whenStart(), [move('forward', 20), wait(3)])]),
    startPose: onDiagonal(40),
  });
  driven.start();
  let red = 0;
  let redWithoutWalls = 0;
  for (let tick = 0; tick < 250; tick++) {
    driven.step(1);
    if (driven.readSensors().frontColor !== 'red') continue;
    red++;
    if (!driven.world.robot.touching) redWithoutWalls++;
  }
  const nose = driven.world.robot.pose;
  const gap = Math.hypot(nose.x - cornerFace.x, nose.y - cornerFace.y) - FRONT;
  assert.ok(Math.abs(gap - COLOR_SENSOR_RANGE_MM) < 0.01, `the walls stopped it ${gap} mm in front of the target`);
  assert.ok(red > 100, 'pressed against the two walls it reads red');
  assert.equal(redWithoutWalls, 0, 'it never read red before it touched the walls');
  assert.equal(driven.score().lines.find((line) => line.id === 'fan-start')?.ok, false, 'reading red alone earns nothing');
  // two millimetres further back, clear of the walls, the sensor reads nothing
  assert.equal(reads(onDiagonal(COLOR_SENSOR_RANGE_MM + 2), 'corner'), 'none');

  // "the fan blows when the power of that motor is 20 % or more, forwards or backwards"
  const fanAt = (power: number): boolean => {
    const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: program([script(whenStart(), [dcMotor('M1', power), wait(1)])]) });
    sim.start();
    sim.step(20);
    return sim.readSensors().fanOn;
  };
  assert.equal(fanAt(FAN.minPower), true);
  assert.equal(fanAt(-FAN.minPower), true);
  assert.equal(fanAt(FAN.minPower - 1), false);

  // "before the start the robot can only be put completely inside the START cell"
  const placed = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: blankProgram() });
  assert.equal(placed.setStartPose(START_POSE), true);
  assert.equal(placed.setStartPose({ ...START_POSE, y: START_POSE.y - 60 }), false, 'its nose would be over the line of START');
  assert.equal(placed.setStartPose({ x: 150, y: 150, heading: 0 }), false);

  // "the attempt also ends when the program has ended, the robot stands still and no DC motor runs"
  const ended = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: program([script(whenStart(), [moveCm('forward', 10)])]) });
  ended.start();
  ended.step(100 * 20);
  assert.equal(ended.status, 'finished');
  assert.equal(ended.finishReason, 'program-ended');
  // "a program that ends with the fan still on runs until the time is up"
  const blowing = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: program([script(whenStart(), [dcMotor('M1', 100)])]) });
  blowing.start();
  blowing.step(100 * 60);
  assert.equal(blowing.status, 'running');
  blowing.step(100 * 125);
  assert.equal(blowing.finishReason, 'time');
  assert.ok(Math.abs(blowing.world.time - MATCH_DURATION) < 0.011);

  // "the fan action also counts from outside the room ... ends the attempt with 80 points":
  // in the open field, with the fire at the back wall of the living room, the robot stands in the
  // cell below the room and blows up at the target, 30 cm or less from its fan
  const target = targetPose('living', 'back');
  const below = { x: target.x, y: target.y + FAN.reachMm + FAN.forward - 5, heading: 0 };
  assert.ok(below.y - FIRE_CHIEF_ROBOT.chassisFront > CELL_SIZE, 'the whole robot is below the room');
  const outside = createSimulation({
    game: fireChiefGame,
    scenario: openField('living', 'back'),
    program: program([script(whenStart(), [dcMotor('M1', 100), wait(4)])]),
    startPose: below,
  });
  outside.start();
  outside.step(100 * 5);
  assert.equal(outside.finishReason, 'mission-complete');
  assert.equal(outside.score().total, MAX_SCORE - POINTS_ENTER_ROOM);
  assert.equal(outside.score().total, 80);
  // one centimetre further away it does not count: "at most 30 cm"
  const tooFar = createSimulation({
    game: fireChiefGame,
    scenario: openField('living', 'back'),
    program: program([script(whenStart(), [dcMotor('M1', 100), wait(4)])]),
    startPose: { ...below, y: below.y + 15 },
  });
  tooFar.start();
  tooFar.step(100 * 5);
  assert.equal(tooFar.score().lines.find((line) => line.id === 'fan-start')?.ok, false);
});

test('rules: marked as a draft; the organiser\'s decisions are rules; what is assumed stands apart and is called so', () => {
  assert.equal(FIRE_CHIEF_RULES_NOTE, 'Draft rules, MakeX Lebanon 2027. Timing, scoring and restarts are proposals and can change.');
  assert.deepEqual(
    FIRE_CHIEF_RULES.map((section) => section.title),
    ['The field', 'The robot', 'The attempt', 'Points - each achievement counts once (100 in all)', 'What does not count', 'An attempt ends when', 'Restart', 'Ranking'],
  );
  // ---- the answers of the organiser (and the thickness of the walls) are in the rules ...
  const decided = [
    /Touching or hitting the target without moving it costs nothing\./,
    /The fan action also counts from outside the room, when the fan is at most 30 cm from the target\./,
    /Only this position counts: what the colour sensor reads does not matter to the referee\./,
    /6 cm wide and 12 cm high/,
    /The outer edge of the field is walled too\./,
    /3 mm thick/,
    // decided after the draft: a colour sensor that looks forward, a red target, no flame sensor
    /It has a colour sensor that looks forward, and a fan\./,
    /The fire is a red wooden flame/,
    /the game is played with a colour sensor, not with a flame sensor\./,
  ];
  for (const said of decided) {
    assert.match(RULES_TEXT, said);
    // ... and not among the assumptions
    assert.ok(!said.test(ASSUMED_TEXT), `${said} is a rule, not an assumption`);
  }
  // the draft's own condition for a fan action stays a rule: the robot does not touch the target
  assert.match(RULES_TEXT, /30 points: [^\n]*the robot must not touch the target/);
  // ---- no rule is called an assumption, and nothing in the rules speaks of the simulator
  assert.ok(!/assum|simulator/i.test(RULES_TEXT), 'the first part is the rules, nothing else');
  // ---- the second part says what it is
  assert.equal(FIRE_CHIEF_ASSUMPTIONS.title, 'What this simulator assumes');
  assert.match(FIRE_CHIEF_ASSUMPTIONS.note ?? '', /These are not rules\./);
  assert.match(FIRE_CHIEF_ASSUMPTIONS.note ?? '', /At the competition they can be different\./);
  assert.deepEqual(
    FIRE_CHIEF_ASSUMPTIONS.sections.map((section) => section.title),
    ['The fire target', 'The colour sensor and the fan', 'The robot and the walls', 'The referee of the simulator'],
  );
  // ---- the flame sensor of the draft: the rules say in one sentence that it is gone, and no
  // other sentence of the window speaks of a flame sensor or of infrared light
  const aboutFlameSensor = [...RULES, ...ASSUMED].filter((sentence) => /flame sensor|infrared/i.test(sentence));
  assert.deepEqual(aboutFlameSensor, ['The draft rules still name a flame sensor. The organiser has decided since then: the game is played with a colour sensor, not with a flame sensor.']);
  // ---- what the organiser has NOT said about the colour sensor is among the assumptions, never
  // among the rules: which sensor, the 15 mm, red on every side, what a wall reads, the corner
  for (const said of [
    /Which colour sensor the robot gets is not decided yet\./,
    /In real mBlock its blocks can have other words than here\./,
    /15 mm away or closer/,
    /It is red on every side/,
    /On a wall it reads "yellow", never "red"\./,
    /touches both walls, or almost touches them/,
  ]) {
    assert.match(ASSUMED_TEXT, said);
    assert.ok(!said.test(RULES_TEXT), `${said} is an assumption, not a rule`);
  }
  assert.ok(!/\d+ mm away|every side|"yellow"|"none"/.test(RULES_TEXT), 'the rules say nothing about how the colour sensor reads');
  // ---- what a student can notice of the list at the top of the game is there
  for (const said of [
    /three places of its room/, // where the fire can stand
    /2 cm thick and light/, // its depth and weight
    /more than 5 mm away from its place/, // when it counts as moved
    /cannot fall over here/,
    /closer than 0\.5 mm/, // touching
    /DC motor port M1/, // the fan
    /at most 20 degrees to the side/, // "facing"
    /measured from the fan, at the front of the robot, to the middle of the target/,
    /perfectly smooth/, // the walls
    /"Standing still" means: both wheels have stopped/,
    /the moment the fan action begins/,
    /also ends when the program has ended, the robot stands still and no DC motor runs/,
    /puts the robot back exactly where and how it started/,
    /CyberPi buttons work during an attempt/,
    /one attempt at a time/,
  ]) {
    assert.match(ASSUMED_TEXT, said);
    assert.ok(!said.test(RULES_TEXT), `${said} is an assumption, not a rule`);
  }
  // ---- the rules of the draft that students need
  for (const said of [
    /START is the cell at the bottom centre/,
    /There is always a way from START to both rooms/,
    /the robot finds it, reads "red" with the colour sensor and blows at it with the fan/,
    /The clock starts at that signal/,
    /A fan that blows in the room without the fire/,
    /the time is up;/,
    /the team asks for the end \("Finished"\);/,
    /The robot moves the fire target or a wall: the attempt ends at once/,
    /The clock keeps running/,
    /Every team has two scored attempts\. The better one counts\./,
    /ranked by the most points; then by the shortest time to reach these points/,
  ]) {
    assert.match(RULES_TEXT, said);
  }
});

test('rules: the window can be drawn - no sentence twice, every one a whole sentence', () => {
  const titles = [...FIRE_CHIEF_RULES, ...FIRE_CHIEF_ASSUMPTIONS.sections].map((section) => section.title);
  assert.equal(new Set(titles).size, titles.length, 'every heading once (the window uses them to tell its sections apart)');
  for (const section of [...FIRE_CHIEF_RULES, ...FIRE_CHIEF_ASSUMPTIONS.sections]) {
    assert.ok(section.items.length >= 2, section.title);
    assert.equal(new Set(section.items).size, section.items.length, `${section.title}: no sentence twice`);
    for (const item of section.items) {
      assert.match(item, /[.;]$/, item);
      assert.ok(item.length <= 330, `${item.length} characters: ${item}`);
      assert.ok(!/\s{2,}|\bTODO\b|undefined|NaN/.test(item), item);
      // student words: none of the engine's words
      assert.ok(!/\btick\b|\bOBB\b|radian|emitter|displace|stationary|autonom/i.test(item), item);
    }
  }
  // the list as the window draws it (the same markup as SimulatorApp.tsx: one <li> per sentence)
  const html = renderToStaticMarkup(
    createElement(
      'div',
      null,
      [...FIRE_CHIEF_RULES, ...FIRE_CHIEF_ASSUMPTIONS.sections].map((section) =>
        createElement(
          'ul',
          { key: section.title },
          section.items.map((item) => createElement('li', { key: item }, item)),
        ),
      ),
    ),
  );
  assert.equal((html.match(/<li>/g) ?? []).length, RULES.length + ASSUMED.length - titles.length);
});
