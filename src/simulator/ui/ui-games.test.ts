/**
 * Tests for the parts of the simulator screen that depend on the GAME that is played: the words
 * of the restart button, the end of a match in the referee's own words, the times on the score
 * sheet, which rows the Sensors panel shows for which robot, a program file from another game,
 * the walls and the fire on the stage, and the small maze panel of Fire Chief.
 *
 * Two things are protected here:
 *   - Fire Rescue says and shows exactly what it did before a second game existed (its words
 *     are written out below, letter for letter);
 *   - Fire Chief gets true sentences: one restart, points cleared, an end the referee calls.
 *
 * No browser is needed: plain logic is called directly, and components are drawn to HTML text.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { paletteCategories } from '../blocks/palettes';
import { DEG, makeRng, obbCorners, type Rect } from '../core/geometry';
import { DEFAULT_ROBOT_CONFIG, robotFitsInRect } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { FixedWall, Pose, ProgramJson, RobotConfig, ScoreReport, Simulation } from '../core/types';
import { PROBE_NAMES, SERVO_PORTS } from '../core/types';
import { START_RECT, roomRect } from '../fire-chief/field';
import { clock, fireChiefGame } from '../fire-chief/game';
import { FIRE_CHIEF_ROBOT, START_POSE } from '../fire-chief/robot';
import { PLAYABLE_MAZE_COUNT, decodeScenario, defaultScenario, encodeScenario, openField, scenarioProblems, withFire, type FireChiefScenario } from '../fire-chief/scenario';
import { fireRescueGame, startPoseFor } from '../fire-rescue/game';
import { arm, dcMotor, flameSize, gripper, gt, moveCm, program, repeatUntil, script, setServo, stopDcMotor, turn, wait, whenStart } from '../vm/builder';
import { ConsolePanel } from './ConsolePanel';
import { ControlBar, type ControlBarProps } from './ControlBar';
import { MAZE_CHOICES, mazeChoiceOf, ROOM_LABEL, SPOT_LABEL, withMaze } from './fire-chief/maze-choices';
import { FIRE_CHIEF_START_ZONE, FIRE_CHIEF_WORDS } from './fire-chief/words';
import { bodyName, describeEvent, finishText, formatRefereeTime, formatStamp, restartFacts, restartLine, restartsLeftText, timeTextOf, type LogLine } from './format';
import { finishSentence, restartButton, restartSummary } from './match-words';
import { foreignBlocks, gameNameFromId, otherGameNote, parseProgramFile, serializeProgramFile } from './program-file';
import { fitView, placeZoneLabels, sightPolygon, viewToMat, wallDrawBox, WALL_MIN_PIXELS } from './render';
import { dcMotorUse, robotParts, sensorSummary, sensorsViewHint } from './robot-parts';
import { addRulerPoint, EMPTY_RULER, rulerText } from './ruler';
import { lineMark, linePoints, lineTime, ScoreSheet, StatusLine, type StatusLineProps } from './ScoreSheet';
import { capital, DEFAULT_WORDS, screenWords } from './screen-words';
import { SensorDashboard } from './SensorDashboard';
import { readyHint } from './stage-view';
import { centredPose, homeButtonWords, homeKind, homePose, poseFits } from './start-pose';
import type { RunState, UiSnapshot } from './useSimulation';

// =============================================================================================
// Helpers
// =============================================================================================

const nothing = (): void => undefined;

/** What a reader sees: the tags taken out, quotation marks back as typed. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

/** The opening tag of the button whose text starts with `name`. */
function buttonTag(html: string, name: string): string {
  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const found = buttons.find((b) => b.includes(`aria-label="${name}"`) || b.replace(/<[^>]+>/g, '').trim().startsWith(name));
  assert.ok(found, `there is a "${name}" button`);
  return found.slice(0, found.indexOf('>') + 1);
}
const isDisabled = (tag: string): boolean => /\sdisabled(=""|\s|>)/.test(tag);
const titleOf = (tag: string): string => (/title="([^"]*)"/.exec(tag)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

const CHIEF_WORDS = screenWords(FIRE_CHIEF_WORDS);
const RESCUE = restartFacts(fireRescueGame);
const CHIEF = restartFacts(fireChiefGame);

/** From START to the middle of the living room on the default maze, cell by cell (ends facing left). */
const TO_LIVING_ROOM = [
  moveCm('forward', 30),
  turn('left', 90),
  moveCm('forward', 60),
  turn('right', 90),
  moveCm('forward', 60),
  turn('right', 90),
  moveCm('forward', 30),
  turn('left', 90),
  moveCm('forward', 30),
  turn('left', 90),
  moveCm('forward', 30),
];

/** A whole mission on the default maze: to the living room, turn to the flame, blow for 3 seconds. */
const MISSION: ProgramJson = program([
  script(whenStart(), [...TO_LIVING_ROOM, repeatUntil(gt(flameSize(), 75), [turn('right', 3), wait(0.1)]), dcMotor('M1', 100), wait(3.2), stopDcMotor('M1')]),
]);

/** Play a Fire Chief attempt without a screen, up to `seconds` of match time (or to its end). */
function playChief(prog: ProgramJson, options: { scenario?: FireChiefScenario; seconds?: number; startPose?: Pose; restartAt?: number } = {}): Simulation<FireChiefScenario> {
  const sim = createSimulation({ game: fireChiefGame, scenario: options.scenario ?? defaultScenario(), program: prog, startPose: options.startPose });
  sim.start();
  let restarted = false;
  while (sim.status === 'running' && sim.world.time < (options.seconds ?? 180)) {
    sim.step(1);
    if (options.restartAt !== undefined && !restarted && sim.world.time >= options.restartAt) {
      restarted = true;
      sim.restart();
    }
  }
  return sim;
}

function controlBar(runState: RunState, extra: Partial<ControlBarProps> = {}): string {
  const props: ControlBarProps = {
    runState,
    canStart: true,
    timeLeft: 170,
    score: { lines: [], total: 0, max: 100, complete: false },
    restartPenalty: 5,
    speed: 1,
    onSpeed: nothing,
    onStart: nothing,
    onStop: nothing,
    onPause: nothing,
    onResume: nothing,
    onRestart: nothing,
    onFinished: nothing,
    onReset: nothing,
    ...extra,
  };
  return renderToStaticMarkup(createElement(ControlBar, props));
}

/** The control bar as the Fire Chief page draws it. */
const chiefBar = (runState: RunState, restartsLeft: number): string =>
  controlBar(runState, { restartPenalty: fireChiefGame.restartPenalty, restartRules: fireChiefGame.restartRules, restartsLeft, words: CHIEF_WORDS });

function statusLine(runState: RunState, score: ScoreReport, extra: Partial<StatusLineProps> = {}): string {
  const props: StatusLineProps = { runState, finishReason: null, score, time: 10, readyHint: 'Ready.', placingProblem: null, onShowSheet: nothing, ...extra };
  return renderToStaticMarkup(createElement(StatusLine, props));
}

/** What the panels get from a simulation (the same fields as useSimulation copies out of it). */
function snapshotOf<S>(sim: Simulation<S>, runState: RunState = 'running'): UiSnapshot {
  const robot = sim.world.robot;
  const sensors = sim.readSensors();
  const servos = Object.fromEntries(SERVO_PORTS.map((port) => [port, robot.servos[port].angle])) as UiSnapshot['servos'];
  return {
    runState,
    time: sim.world.time,
    timeLeft: sim.timeLeft,
    score: sim.score(),
    restarts: sim.restarts,
    restartsLeft: sim.restartsLeft,
    finishReason: sim.finishReason,
    finishDetail: sim.finishDetail,
    sensors,
    variables: sim.vm.variables(),
    leds: robot.leds,
    screenLines: robot.screen.lines,
    screenLabels: robot.screen.labels,
    gripper: robot.gripper,
    servos,
    leftPower: robot.left.power,
    rightPower: robot.right.power,
    pose: robot.pose,
  };
}

const dashboard = <S>(sim: Simulation<S>, robotConfig: RobotConfig): string => renderToStaticMarkup(createElement(SensorDashboard, { snapshot: snapshotOf(sim), robotConfig }));

// =============================================================================================
// The words of a game
// =============================================================================================

test('words: a game that says nothing gets the words of Fire Rescue, letter for letter', () => {
  assert.deepEqual(screenWords(), {
    match: 'match',
    goal: 'mission',
    goals: 'missions',
    zonesHint: 'Colour the zones of this combination: start, people, water squares, tower areas',
    finishedHint: 'Tell the referee "Finished": the robot stops and the field is scored as it is',
    resetHint: 'Put every tower, bucket and person back and the robot into the start zone, ready for a new start.',
    sheetNotesHeading: 'Penalties',
    sheetNote: 'The score is what the field is worth right now. It can never go below 0.',
    cleanLine: 'No penalty',
    randomLabel: 'Random',
    randomHint: 'Draw a random combination, like the referee does',
    defaultLabel: 'Default',
    defaultHint: 'The combination drawn in the rule book',
    scenario: 'combination',
    scenarios: 'combinations',
    scenarioTitle: 'Combination',
    batchHint: 'Run your program on many starting combinations at once',
    batchIntro:
      'A good program works whatever the referee draws. Run your blocks on many starting combinations at once and see where they fail. Click a result to load that combination on the stage and watch what happens.',
  });
  // (the last line of the Combination panel is counted from the game when a game gives no sentence of its own)
  assert.equal(screenWords().scenarioNote, undefined);
  assert.equal(screenWords(undefined), DEFAULT_WORDS, 'no new object when nothing differs');
});

test('words: a game changes only what it names; Fire Chief plays an "attempt" with "achievements"', () => {
  const mixed = screenWords({ match: 'round' });
  assert.equal(mixed.match, 'round');
  assert.equal(mixed.goals, 'missions');
  assert.equal(CHIEF_WORDS.match, 'attempt');
  assert.equal(CHIEF_WORDS.goal, 'achievement');
  assert.equal(CHIEF_WORDS.goals, 'achievements');
  assert.equal(CHIEF_WORDS.randomLabel, 'Random maze');
  assert.equal(CHIEF_WORDS.defaultLabel, 'Default maze');
  // a starting arrangement is a "maze" there: the panel, the code, the console and the test window say so
  assert.equal(CHIEF_WORDS.scenario, 'maze');
  assert.equal(CHIEF_WORDS.scenarios, 'mazes');
  assert.equal(CHIEF_WORDS.scenarioTitle, 'Maze');
  assert.equal(CHIEF_WORDS.batchHint, 'Run your program on many mazes at once');
  assert.match(CHIEF_WORDS.batchIntro, /^A good program finds the fire in every maze\. /);
  assert.ok(!Object.values(CHIEF_WORDS).some((value) => /combination/i.test(value)), 'no word of the Fire Chief screen speaks of a "combination"');
  // "more than 100 billion mazes": the number of mazes the game counts
  assert.equal(CHIEF_WORDS.scenarioNote, 'More than 100 billion mazes have a way from START to both rooms. Changing the maze or the place of the fire puts the field back to the start.');
  assert.ok(PLAYABLE_MAZE_COUNT > 100e9 && PLAYABLE_MAZE_COUNT < 200e9);
  // a line of the sheet without points is a note of the referee there, not a penalty
  assert.equal(CHIEF_WORDS.sheetNotesHeading, 'Notes of the referee');
  assert.equal(CHIEF_WORDS.cleanLine, 'Nothing to note');
  assert.ok(!Object.values(CHIEF_WORDS).some((value) => /penalt/i.test(value)), 'a restart costs no points in Fire Chief: no word of the screen calls it a penalty');
  // every word of the screen has a Fire Chief answer that is not about towers, buckets or people
  for (const [key, value] of Object.entries(CHIEF_WORDS)) {
    assert.ok(!/tower|bucket|person|people|water square|rule book/i.test(value), `${key}: "${value}"`);
  }
  assert.equal(capital('attempt'), 'Attempt');
  assert.equal(capital(''), '');
});

// =============================================================================================
// Restart
// =============================================================================================

test('restart button: Fire Rescue shows what a restart costs and is never off for lack of restarts', () => {
  const button = restartButton(RESCUE, Infinity, 'match');
  assert.deepEqual(button, {
    badge: '-5',
    tone: 'cost',
    allowed: true,
    hint: 'Rules restart: the robot goes back into the start zone, whatever it carries goes back to where it came from, the clock keeps running. Costs 5 points.',
  });
  // after any number of restarts: the same
  assert.deepEqual(restartButton(RESCUE, Infinity, 'match'), button);
  const html = controlBar('running');
  const tag = buttonTag(html, 'Restart');
  assert.equal(isDisabled(tag), false);
  assert.equal(titleOf(tag), button.hint);
  assert.match(html, /Restart<span class="rounded-md bg-amber-100 px-1\.5 py-0\.5 text-xs font-bold text-amber-800">-5<\/span>/);
});

test('restart button: Fire Chief says how many restarts are left, and what a restart does there', () => {
  const button = restartButton(CHIEF, 1, 'attempt');
  assert.equal(button.badge, '1 left');
  assert.equal(button.tone, 'left');
  assert.equal(button.allowed, true);
  assert.match(button.hint, /every game element is put back where it started/);
  assert.match(button.hint, /the clock keeps running/);
  assert.match(button.hint, /The points earned so far are cleared\./);
  assert.match(button.hint, /This game allows 1 restart per attempt: 1 left\./);
  assert.ok(!/Costs/.test(button.hint), 'a restart of Fire Chief costs no points of its own');

  const before = chiefBar('ready', 1);
  assert.match(text(before), /Restart1 left/);
  assert.equal(isDisabled(buttonTag(before, 'Restart')), true, 'before the start signal there is nothing to restart');
  const during = chiefBar('running', 1);
  assert.equal(isDisabled(buttonTag(during, 'Restart')), false);
  assert.equal(titleOf(buttonTag(during, 'Restart')), button.hint);
});

test('restart button: once the one restart is used the button is off and says why', () => {
  const button = restartButton(CHIEF, 0, 'attempt');
  assert.equal(button.badge, '0 left');
  assert.equal(button.tone, 'none');
  assert.equal(button.allowed, false);
  assert.equal(button.hint, 'No restart left: this game allows 1 restart per attempt, and it was used.');

  for (const state of ['running', 'paused'] as RunState[]) {
    const html = chiefBar(state, 0);
    const tag = buttonTag(html, 'Restart');
    assert.equal(isDisabled(tag), true, state);
    assert.equal(titleOf(tag), button.hint);
    assert.match(text(html), /Restart0 left/);
    // the other buttons of a running attempt still work
    assert.equal(isDisabled(buttonTag(html, 'Finished')), false);
    assert.equal(isDisabled(buttonTag(html, 'Stop')), false);
  }
});

test('restart button: the real simulation counts the restarts the button shows', () => {
  const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: MISSION });
  assert.equal(restartButton(CHIEF, sim.restartsLeft, 'attempt').badge, '1 left');
  sim.start();
  sim.step(300);
  sim.restart();
  assert.equal(sim.restartsLeft, 0);
  assert.equal(restartButton(CHIEF, sim.restartsLeft, 'attempt').allowed, false);
  // a second press does nothing but a warning in the log
  sim.drainEvents();
  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.ok(sim.drainEvents().some((e) => e.type === 'log' && e.level === 'warn' && /No restart left/.test(e.text)));

  const rescue = createSimulation({ game: fireRescueGame, scenario: fireRescueGame.defaultScenario(), program: {} });
  assert.equal(rescue.restartsLeft, Infinity);
  assert.equal(restartButton(RESCUE, rescue.restartsLeft, 'match').badge, '-5');
});

test('restart button: other rules than the two games have get true words too, and odd numbers never break it', () => {
  // a game with three restarts of 2 points each
  const three = restartButton({ penalty: 2, rules: { maxRestarts: 3 } }, 2, 'round');
  assert.equal(three.badge, '2 left');
  assert.match(three.hint, /Costs 2 points\. This game allows 3 restarts per round: 2 left\./);
  assert.equal(restartButton({ penalty: 2, rules: { maxRestarts: 3 } }, 0, 'round').hint, 'No restart left: this game allows 3 restarts per round, and they were used.');
  // a game without restarts
  const none = restartButton({ penalty: 0, rules: { maxRestarts: 0 } }, 0, 'match');
  assert.equal(none.allowed, false);
  assert.equal(none.hint, 'This game allows no restart.');
  // free restarts without a limit: no label at all
  assert.equal(restartButton({ penalty: 0 }, Infinity, 'match').badge, '');
  // a number that is not known is read as "all of them"
  assert.equal(restartButton(CHIEF, NaN, 'attempt').badge, '1 left');
  assert.equal(restartButton(CHIEF, Infinity, 'attempt').badge, '1 left');
  assert.equal(restartButton(CHIEF, -4, 'attempt').allowed, false);
});

test('restart: the status line and the console say what the restart did in this game', () => {
  // Fire Rescue: as before
  assert.equal(restartSummary(0, RESCUE), '');
  assert.equal(restartSummary(1, RESCUE), '1 restart: -5 points');
  assert.equal(restartSummary(3, RESCUE, Infinity), '3 restarts: -15 points');
  assert.equal(restartLine(RESCUE), 'Restart: the robot is back in the start zone (-5 points).');
  assert.equal(restartLine(RESCUE, Infinity), 'Restart: the robot is back in the start zone (-5 points).');
  assert.equal(restartsLeftText(RESCUE, Infinity), '');
  // Fire Chief: the points are cleared, and none is left
  assert.equal(restartSummary(0, CHIEF, 1), '');
  assert.equal(restartSummary(1, CHIEF, 0), '1 restart: points cleared, no restart left');
  assert.equal(restartLine(CHIEF, 0), 'Restart: the robot is back in the start zone. The points earned so far are cleared; the clock keeps running. No restart left.');
  assert.equal(restartsLeftText(CHIEF, 1), '1 restart left');
  assert.equal(restartsLeftText(CHIEF, undefined), '');
  // other numbers
  assert.equal(restartSummary(2, { penalty: 0, rules: { maxRestarts: 5 } }, 3), '2 restarts, 3 restarts left');
  assert.equal(restartSummary(NaN, CHIEF, 0), '');
});

test('console: a restart event is worded for the game that is played; Fire Rescue keeps its line', () => {
  const event = { type: 'restart', time: 12 } as const;
  assert.equal(describeEvent(event)?.text, 'Restart: the robot is back in the start zone (-5 points).');
  assert.equal(describeEvent(event, { ...RESCUE, left: Infinity, match: 'match' })?.text, 'Restart: the robot is back in the start zone (-5 points).');
  const chief = describeEvent(event, { ...CHIEF, left: 0, match: 'attempt' });
  assert.equal(chief?.level, 'warn');
  assert.equal(chief?.text, 'Restart: the robot is back in the start zone. The points earned so far are cleared; the clock keeps running. No restart left.');
});

// =============================================================================================
// The end of a match
// =============================================================================================

test('end: the two reasons a referee can call have words of their own', () => {
  assert.equal(finishText('mission-complete'), 'Mission complete');
  assert.equal(finishText('target-displaced'), 'The target was moved');
  // the old ones are as they were
  assert.equal(finishText('time'), 'Time is up');
  assert.equal(finishText('declared'), 'You declared "Finished"');
  assert.equal(finishText('program-ended'), 'The program ended');
  assert.equal(finishText(null), 'Match over');
});

test("end: the referee's own sentence is shown where it gave one; otherwise the reason and the time", () => {
  assert.equal(finishSentence('time', null, 180), 'Time is up at 3:00.0.');
  assert.equal(finishSentence('program-ended', undefined, 10), 'The program ended at 0:10.0.');
  assert.equal(finishSentence('declared', '', 5.04), 'You declared "Finished" at 0:05.0.');
  assert.equal(finishSentence('mission-complete', 'Mission complete at 0:23.0: the fan blew at the fire for 3 seconds.', 23.07), 'Mission complete at 0:23.0: the fan blew at the fire for 3 seconds.');
  // a sentence without its full stop gets one; spaces around it go
  assert.equal(finishSentence('target-displaced', '  The robot pushed the fire target ', 4), 'The robot pushed the fire target.');
});

test('end: a whole mission ends "mission complete", and the screen says it in the referee\'s words', () => {
  const sim = playChief(MISSION);
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'mission-complete');
  const score = sim.score();
  assert.equal(score.total, 100);
  assert.ok(sim.finishDetail);

  const line = text(statusLine('finished', score, { finishReason: sim.finishReason, finishDetail: sim.finishDetail, time: sim.world.time, words: CHIEF_WORDS }));
  assert.match(line, /^Attempt over\. Mission complete at 0:\d\d\.\d: the fan blew at the fire for 3 seconds\. Final score: 100 \/ 100 - a perfect run!/);
  assert.ok(!/Match/.test(line), 'Fire Chief does not call it a match');
  assert.match(line, /Score sheet/);

  // the console gets the same sentence, once
  const finish = { type: 'finish', reason: 'mission-complete', time: sim.world.time, detail: sim.finishDetail } as const;
  assert.equal(describeEvent(finish, { ...CHIEF, left: 1, match: 'attempt' })?.text, sim.finishDetail);
});

test('end: a target that was pushed away ends the attempt, with the reason on the screen', () => {
  // the robot slides along the top wall into the target that stands at the back wall of the living room
  const push = program([script(whenStart(), [...TO_LIVING_ROOM.slice(0, 9), turn('left', 60), moveCm('forward', 50)])]);
  const sim = playChief(push, { scenario: withFire(defaultScenario(), 'living', 'back') });
  assert.equal(sim.finishReason, 'target-displaced');
  const line = text(statusLine('finished', sim.score(), { finishReason: sim.finishReason, finishDetail: sim.finishDetail, time: sim.world.time, words: CHIEF_WORDS }));
  assert.match(line, /^Attempt over\. The robot pushed the fire target out of its place \(by [\d.]+ mm\)\. The attempt ends here; the points earned before stay\. Final score: 10 \/ 100/);
  assert.ok(!/perfect|complete/.test(line));
});

test('end: an end without a referee\'s sentence names the reason in the words of the game', () => {
  const sim = playChief(program([script(whenStart(), [moveCm('forward', 5)])]));
  assert.equal(sim.finishReason, 'program-ended');
  assert.equal(sim.finishDetail, null);
  const line = text(statusLine('finished', sim.score(), { finishReason: sim.finishReason, finishDetail: sim.finishDetail, time: sim.world.time, words: CHIEF_WORDS }));
  assert.match(line, /^Attempt over\. The program ended at 0:\d\d\.\d\. Final score: 0 \/ 100/);
  assert.equal(describeEvent({ type: 'finish', reason: 'time', time: 180 }, { ...CHIEF, match: 'attempt' })?.text, 'Time is up - the attempt is over.');
  // Fire Rescue: as before
  assert.equal(describeEvent({ type: 'finish', reason: 'time', time: 180 })?.text, 'Time is up - the match is over.');
});

test('status line: while an attempt runs it counts achievements and tells about the restart', () => {
  const sim = playChief(MISSION, { seconds: 6, restartAt: 3 });
  assert.equal(sim.restarts, 1);
  const running = text(
    statusLine('running', sim.score(), {
      restarts: sim.restarts,
      restartPenalty: fireChiefGame.restartPenalty,
      restartRules: fireChiefGame.restartRules,
      restartsLeft: sim.restartsLeft,
      words: CHIEF_WORDS,
    }),
  );
  assert.match(running, /^Attempt running\. [01] of 4 achievements complete\. 1 restart: points cleared, no restart left\./);
  assert.match(text(statusLine('paused', sim.score(), { words: CHIEF_WORDS })), /The attempt clock is paused too\./);
});

// =============================================================================================
// The score sheet
// =============================================================================================

test("sheet: the referee's times are cut off like the referee cuts them, never rounded up", () => {
  assert.equal(formatRefereeTime(83.47), '1:23.4');
  assert.equal(formatStamp(83.47), '1:23.5', 'the console rounds: that is why the sheet has its own format');
  assert.equal(formatRefereeTime(0), '0:00.0');
  assert.equal(formatRefereeTime(59.99), '0:59.9');
  assert.equal(formatRefereeTime(60), '1:00.0');
  assert.equal(formatRefereeTime(180), '3:00.0');
  assert.equal(formatRefereeTime(-3), '0:00.0');
  assert.equal(formatRefereeTime(NaN), '0:00.0');
  // exactly the game's own clock, tick by tick over a whole attempt (and at odd values)
  for (let tick = 0; tick <= 18000; tick++) assert.equal(formatRefereeTime(tick / 100), clock(tick / 100), `tick ${tick}`);
  const rng = makeRng(11);
  for (let i = 0; i < 2000; i++) {
    const seconds = rng() * 200;
    assert.equal(formatRefereeTime(seconds), clock(seconds), String(seconds));
  }
});

test('times: where the referee writes times down, every time on the screen is written its way', () => {
  // Fire Chief: cut off, like the sheet; Fire Rescue: the rounded time stamps it always had
  assert.equal(timeTextOf(fireChiefGame), formatRefereeTime);
  assert.equal(timeTextOf(fireRescueGame), formatStamp);
  const chief = timeTextOf(fireChiefGame);

  // the status line: the end, a pause, a stop
  assert.equal(finishSentence('program-ended', null, 2.07, chief), 'The program ended at 0:02.0.');
  assert.equal(finishSentence('program-ended', null, 2.07), 'The program ended at 0:02.1.');
  const score: ScoreReport = { lines: [], total: 0, max: 100, complete: false };
  assert.match(text(statusLine('paused', score, { time: 23.07, words: CHIEF_WORDS, timeText: chief })), /Paused at 0:23\.0\./);
  assert.match(text(statusLine('stopped', score, { time: 23.07, words: CHIEF_WORDS, timeText: chief })), /Stopped by you at 0:23\.0 /);
  assert.match(text(statusLine('paused', score, { time: 23.07 })), /Paused at 0:23\.1\./);

  // the console: the stamp of a line agrees with the time the referee names in it
  const line: LogLine = { n: 1, time: 23.07, level: 'info', text: '+40 points at 0:23.0: the fan blew at the fire for 3 seconds.', count: 1 };
  const panel = (timeText?: (seconds: number) => string): string => text(renderToStaticMarkup(createElement(ConsolePanel, { logs: [line], onClear: nothing, onSelectBlock: nothing, timeText })));
  assert.match(panel(chief), /0:23\.0Info: \+40 points at 0:23\.0/);
  assert.match(panel(), /0:23\.1Info: /);
});

test('sheet: how a line is marked, and what stands at its right-hand end', () => {
  // a line with points
  assert.equal(lineMark({ points: 20, max: 20, ok: true }), 'done');
  assert.equal(lineMark({ points: 0, max: 20, ok: false }), 'not-done');
  assert.equal(linePoints({ points: 20, max: 20, ok: true }), '20/20');
  assert.equal(linePoints({ points: 0, max: 20, ok: false }), '0/20');
  // a penalty line of Fire Rescue: clean, or lost points
  assert.equal(lineMark({ points: 0, max: 0, ok: true }), 'done');
  assert.equal(linePoints({ points: 0, max: 0, ok: true }), '0');
  assert.equal(lineMark({ points: -10, max: 0, ok: false }), 'penalty');
  assert.equal(linePoints({ points: -10, max: 0, ok: false }), '-10');
  // a note of the referee that costs nothing by itself (Fire Chief: restart used, start position)
  assert.equal(lineMark({ points: 0, max: 0, ok: false }), 'note');
  assert.equal(linePoints({ points: 0, max: 0, ok: false }), '');
  // times
  assert.equal(lineTime({ time: 17.03 }), '0:17.0');
  assert.equal(lineTime({}), '');
  assert.equal(lineTime({ time: NaN }), '');
});

test('sheet: a finished Fire Chief attempt shows the time of every achievement and the time of the total', () => {
  const sim = playChief(MISSION);
  const score = sim.score();
  const html = renderToStaticMarkup(createElement(ScoreSheet, { score, words: CHIEF_WORDS }));
  const sheet = text(html);
  // every line the referee gives is on the sheet, with its own words
  for (const line of score.lines) {
    assert.ok(sheet.includes(line.label), line.label);
    assert.ok(sheet.includes(line.detail), line.detail);
  }
  // the four achievements carry their time, in the order they were earned
  const earned = score.lines.filter((line) => line.max > 0);
  assert.equal(earned.length, 4);
  const times = earned.map((line) => line.time);
  for (const [i, line] of earned.entries()) {
    assert.equal(typeof line.time, 'number', line.id);
    assert.ok(html.includes(`<span class="sr-only">earned at </span>${formatRefereeTime(line.time as number)}`), `${line.id} shows ${formatRefereeTime(line.time as number)}`);
    // (the same moment as the referee's own sentence about the line names)
    assert.ok(line.detail.includes(formatRefereeTime(line.time as number)), `${line.detail} names the time beside it`);
    if (i > 0) assert.ok((line.time as number) >= (times[i - 1] as number));
  }
  assert.equal((html.match(/earned at/g) ?? []).length, 4, 'only earned lines have a time');
  // the total: its time is the time of the last achievement, and the sheet says what it is for
  assert.equal(score.time, earned[3].time);
  assert.match(sheet, new RegExp(`Total100 / 100Time of this score - with equal points, the rules rank the shorter time higher${formatRefereeTime(score.time as number).replace('.', '\\.')}`));
  assert.match(sheet, /Notes of the referee/);
  assert.ok(sheet.includes(CHIEF_WORDS.sheetNote));
  assert.ok(!/Penalties|never go below 0/.test(sheet));
});

test('sheet: while nothing is earned there is no time anywhere; lines that are not earned get none', () => {
  const sim = playChief(MISSION, { seconds: 5 });
  const score = sim.score();
  assert.equal(score.total, 10);
  const html = renderToStaticMarkup(createElement(ScoreSheet, { score, words: CHIEF_WORDS }));
  assert.equal((html.match(/earned at/g) ?? []).length, 1);
  assert.match(text(html), /Time of this score/);

  const fresh = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: {} });
  const empty = renderToStaticMarkup(createElement(ScoreSheet, { score: fresh.score(), words: CHIEF_WORDS }));
  assert.ok(!/earned at|Time of this score|data-score-time/.test(empty));
});

test("sheet: the referee's extra lines are shown - a used restart, and a start outside START", () => {
  // the restart: a note, not a penalty; no "0" beside it
  const restarted = playChief(MISSION, { seconds: 6, restartAt: 3 });
  const withRestart = renderToStaticMarkup(createElement(ScoreSheet, { score: restarted.score(), words: CHIEF_WORDS }));
  assert.match(text(withRestart), /noteRestartrestart used at 0:03\.0: the points earned before it were cleared/);

  // a robot that does not start completely inside START (only a test can put it there)
  const outside = playChief(program([script(whenStart(), [wait(0.2)])]), { startPose: { x: 750, y: 1150, heading: 0 }, seconds: 1 });
  const lines = outside.score().lines;
  assert.ok(lines.some((line) => line.id === 'start-position'));
  const sheet = text(renderToStaticMarkup(createElement(ScoreSheet, { score: outside.score(), words: CHIEF_WORDS })));
  assert.match(sheet, /noteStart completely inside STARTthe robot did not start completely inside the START cell/);
  // and without that: no such line
  assert.ok(!playChief(program([script(whenStart(), [wait(0.2)])]), { seconds: 1 }).score().lines.some((line) => line.id === 'start-position'));
});

test('sheet: Fire Rescue has no times, and its sheet is drawn exactly as before', () => {
  const sim = createSimulation({ game: fireRescueGame, scenario: fireRescueGame.defaultScenario(), program: program([script(whenStart(), [wait(30)])]) });
  sim.start();
  sim.step(50);
  sim.restart();
  assert.equal(sim.restarts, 1);
  const score = sim.score();
  assert.ok(score.lines.every((line) => line.time === undefined) && score.time === undefined);
  const html = renderToStaticMarkup(createElement(ScoreSheet, { score }));
  assert.ok(!/earned at|Time of this score|data-score-time|flex-col/.test(html));
  assert.match(html, /<p class="mt-2 border-t border-slate-200 pt-2 text-xs font-bold uppercase tracking-wide text-ink-500">Penalties<\/p>/);
  assert.match(html, /<p class="mt-1 text-xs text-ink-500">The score is what the field is worth right now\. It can never go below 0\.<\/p>/);
  // a mission that is not done, a penalty that was lost, a penalty line that is clean: the markup of the first game
  assert.ok(
    html.includes(
      '<li class="flex items-start gap-2.5 py-2"><span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">',
    ),
  );
  assert.match(html, /<span class="sr-only">penalty<\/span><\/span><div class="min-w-0 flex-1"><p class="text-sm font-semibold text-ink-800">Restarts<\/p><p class="text-xs leading-snug text-ink-500">1 restart, -5 points each<\/p><\/div><span class="shrink-0 font-mono text-sm font-bold tabular-nums text-rose-600">-5<\/span><\/li>/);
  assert.match(html, /<span class="sr-only">done<\/span><\/span><div class="min-w-0 flex-1"><p class="text-sm font-semibold text-ink-800">Towers completely outside their area<\/p><p class="text-xs leading-snug text-ink-500">every tower touches its own square<\/p><\/div><span class="shrink-0 font-mono text-sm font-bold tabular-nums text-ink-400">0<\/span><\/li>/);
  assert.match(html, /<span class="sr-only">not done<\/span><\/span><div class="min-w-0 flex-1"><p class="text-sm font-semibold text-ink-800">[^<]+<\/p><p class="text-xs leading-snug text-ink-500">[^<]+<\/p><\/div><span class="shrink-0 font-mono text-sm font-bold tabular-nums text-ink-400">0\/20<\/span><\/li>/);
});

// =============================================================================================
// The Sensors panel: what this robot has
// =============================================================================================

test('robot parts: Fire Rescue has the gripper and the claw colour; Fire Chief the flame sensor and the fan', () => {
  const rescue = robotParts(DEFAULT_ROBOT_CONFIG);
  assert.deepEqual({ gripper: rescue.gripper, clawColour: rescue.clawColour, flame: rescue.flameSensor, fan: rescue.fan, dc: rescue.dcMotors }, { gripper: true, clawColour: true, flame: null, fan: null, dc: [] });
  const chief = robotParts(FIRE_CHIEF_ROBOT);
  assert.equal(chief.gripper, false);
  assert.equal(chief.clawColour, false);
  assert.equal(chief.flameSensor, FIRE_CHIEF_ROBOT.flameSensor);
  assert.equal(chief.fan, FIRE_CHIEF_ROBOT.fan);
  assert.deepEqual(chief.dcMotors, ['M1', 'M2']);
  assert.equal(dcMotorUse(chief, 'M1'), 'fan');
  assert.equal(dcMotorUse(chief, 'M2'), '');
  // a part that is fitted but switched off counts as not there
  const off = robotParts({ ...FIRE_CHIEF_ROBOT, flameSensor: { ...FIRE_CHIEF_ROBOT.flameSensor!, enabled: false }, fan: { ...FIRE_CHIEF_ROBOT.fan!, enabled: false } });
  assert.deepEqual({ flame: off.flameSensor, fan: off.fan, dc: off.dcMotors }, { flame: null, fan: null, dc: [] });
});

test('robot parts: the few words on the closed Sensors panel', () => {
  const reading = { lineStatus: 6, ultrasonicCm: 34.4, frontColor: 'none' as const, flame: 12.34, fanOn: false };
  // Fire Rescue: as before
  assert.equal(sensorSummary(robotParts(DEFAULT_ROBOT_CONFIG), reading), 'line 6 · 34 cm · claw empty');
  assert.equal(sensorSummary(robotParts(DEFAULT_ROBOT_CONFIG), { ...reading, frontColor: 'red' }), 'line 6 · 34 cm · claw red');
  // Fire Chief
  assert.equal(sensorSummary(robotParts(FIRE_CHIEF_ROBOT), reading), 'line 6 · 34 cm · flame 12 · fan off');
  assert.equal(sensorSummary(robotParts(FIRE_CHIEF_ROBOT), { ...reading, fanOn: true }), 'line 6 · 34 cm · flame 12 · fan on');
  assert.equal(sensorsViewHint(robotParts(DEFAULT_ROBOT_CONFIG)), 'Show what the line sensor and the ultrasonic sensor see');
  assert.equal(sensorsViewHint(robotParts(FIRE_CHIEF_ROBOT)), 'Show what the line sensor, the ultrasonic sensor and the flame sensor see');
});

test('Sensors panel: Fire Chief shows flame sensor, DC motors and fan - and no claw, arm or servo', () => {
  const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: program([script(whenStart(), [dcMotor('M1', 80), wait(5)])]) });
  sim.start();
  sim.step(20);
  const panel = text(dashboard(sim, FIRE_CHIEF_ROBOT));
  assert.match(panel, /Flame sensor0\.0no flame/);
  assert.match(panel, /DC motor M1 \(fan\)80%/);
  assert.match(panel, /DC motor M20%/);
  assert.match(panel, /Fanfan on/);
  assert.ok(!/Claw|Arm|S1|S2|servo/i.test(panel), panel);
  // what every robot has is still there
  for (const row of ['Quad RGB line sensor', 'Ultrasonic', 'Yaw (turned)', 'Timer', 'EM1 angle (left)', 'EM2 speed', 'Variables']) assert.ok(panel.includes(row), row);
  for (const probe of PROBE_NAMES) assert.ok(panel.includes(probe));
});

test('Sensors panel: the flame value rises when the robot looks at the fire, and "flame detected" follows the threshold', () => {
  // the open field, fire at the back wall of the living room; the robot stands one cell below the room, facing it
  const scenario = openField('living', 'back');
  const look = (pose: Pose): { flame: number; panel: string } => {
    const sim = createSimulation({ game: fireChiefGame, scenario, program: {}, startPose: pose });
    sim.start();
    return { flame: sim.readSensors().flame, panel: text(dashboard(sim, FIRE_CHIEF_ROBOT)) };
  };
  const away = look({ x: 150, y: 450, heading: 180 * DEG });
  const aside = look({ x: 150, y: 450, heading: 20 * DEG });
  const facing = look({ x: 150, y: 450, heading: 0 });
  assert.equal(away.flame, 0);
  assert.ok(aside.flame > 0 && facing.flame > aside.flame, `${aside.flame} < ${facing.flame}`);
  assert.match(away.panel, /Flame sensor0\.0no flame/);
  assert.match(facing.panel, new RegExp(`Flame sensor${facing.flame.toFixed(1).replace('.', '\\.')}flame detected`));
  assert.ok(facing.flame > FIRE_CHIEF_ROBOT.flameSensor!.threshold);
});

test('Sensors panel: Fire Rescue shows what it always showed - claw colour, arm and claw - and nothing of Fire Chief', () => {
  const sim = createSimulation({ game: fireRescueGame, scenario: fireRescueGame.defaultScenario(), program: {} });
  const panel = text(dashboard(sim, DEFAULT_ROBOT_CONFIG));
  assert.match(panel, /Claw colournothing/);
  assert.match(panel, /Arm \(S1\)0°/);
  assert.match(panel, /Claw \(S2\)0°/);
  assert.ok(!/Flame|DC motor|Fan/i.test(panel), panel);
});

// =============================================================================================
// The palette, and a program from the other game
// =============================================================================================

test('palette: Fire Chief has no Gripper group (so the window with the real mBlock code is not offered there)', () => {
  assert.ok(paletteCategories('fire-rescue').includes('gripper'));
  const chief = paletteCategories('fire-chief');
  for (const group of ['gripper', 'servo', 'colorsensor']) assert.ok(!chief.includes(group as never), group);
  for (const group of ['extensionport', 'flamesensor', 'chassis', 'quadrgb', 'ultrasonic']) assert.ok(chief.includes(group as never), group);
});

const RESCUE_PROGRAM: ProgramJson = program([script(whenStart(), [moveCm('forward', 10), gripper('close'), arm('raise'), setServo('S1', 45), moveCm('backward', 10)])]);
const CHIEF_PROGRAM: ProgramJson = program([script(whenStart(), [moveCm('forward', 10), repeatUntil(gt(flameSize(), 5), [turn('right', 10)]), dcMotor('M1', 60), wait(1), stopDcMotor('M1')])]);

test('other game: the blocks a game does not have are counted, with the names of their groups', () => {
  assert.deepEqual(foreignBlocks(RESCUE_PROGRAM, 'fire-chief'), { count: 3, groups: ['Gripper', 'Servos'] });
  assert.deepEqual(foreignBlocks(RESCUE_PROGRAM, 'fire-rescue'), { count: 0, groups: [] });
  const inRescue = foreignBlocks(CHIEF_PROGRAM, 'fire-rescue');
  assert.equal(inRescue.count, 3, 'flame size, DC motor on, DC motor off');
  assert.equal(inRescue.groups.length, 2);
  assert.deepEqual(foreignBlocks(CHIEF_PROGRAM, 'fire-chief'), { count: 0, groups: [] });
  // the whole mission uses only blocks of Fire Chief
  assert.equal(foreignBlocks(MISSION, 'fire-chief').count, 0);
  // nothing to count, nothing that breaks it
  assert.deepEqual(foreignBlocks({}, 'fire-chief'), { count: 0, groups: [] });
  assert.deepEqual(foreignBlocks({ blocks: { blocks: [{ type: 'no_such_block', id: 'x' }] } }, 'fire-chief'), { count: 0, groups: [] });
  assert.deepEqual(foreignBlocks({ blocks: { blocks: [{ type: 'gripper_claw', id: 'x', inputs: { A: {} }, next: {} }] } }, 'fire-chief'), { count: 1, groups: ['Gripper'] });
});

test('other game: opening such a file says in plain words what will not work', () => {
  assert.equal(gameNameFromId('fire-rescue'), 'Fire Rescue');
  assert.equal(gameNameFromId('fire-chief'), 'Fire Chief');
  assert.equal(gameNameFromId(''), '');

  // a Fire Rescue file on the Fire Chief page
  const file = parseProgramFile(serializeProgramFile('fire-rescue', RESCUE_PROGRAM));
  assert.ok(file.ok);
  assert.equal(
    otherGameNote(file.program, file.game, 'fire-chief'),
    'This program was saved in the Fire Rescue simulator. 3 of its blocks are for parts this robot does not have (Gripper, Servos): they do not work here.',
  );
  // the other way round
  const note = otherGameNote(CHIEF_PROGRAM, 'fire-chief', 'fire-rescue');
  assert.match(note ?? '', /^This program was saved in the Fire Chief simulator\. 3 of its blocks are for parts this robot does not have \(.+\): they do not work here\.$/);
  // one block
  const one = program([script(whenStart(), [gripper('open')])]);
  assert.equal(otherGameNote(one, null, 'fire-chief'), '1 of its blocks is for parts this robot does not have (Gripper): it does not work here.');
  // a file of the other game that only uses blocks both games have
  const plain = program([script(whenStart(), [moveCm('forward', 10)])]);
  assert.equal(otherGameNote(plain, 'fire-rescue', 'fire-chief'), 'This program was saved in the Fire Rescue simulator. All its blocks work here too.');
  // nothing to say: a file of this game, a bare file without foreign blocks
  assert.equal(otherGameNote(MISSION, 'fire-chief', 'fire-chief'), null);
  assert.equal(otherGameNote(plain, null, 'fire-chief'), null);
  assert.equal(otherGameNote(RESCUE_PROGRAM, 'fire-rescue', 'fire-rescue'), null);
});

test('other game: the program still runs - a block for a missing part does nothing and says so', () => {
  const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: RESCUE_PROGRAM });
  sim.start();
  const lines: string[] = [];
  while (sim.status === 'running' && sim.world.time < 20) {
    sim.step(1);
    for (const event of sim.drainEvents()) if (event.type === 'log') lines.push(`${event.level}: ${event.text}`);
  }
  assert.equal(sim.finishReason, 'program-ended');
  assert.ok(!lines.some((line) => line.startsWith('error')), lines.join('\n'));
  assert.ok(lines.some((line) => /no gripper fitted/.test(line)), lines.join('\n'));
  // it drove 10 cm forward and 10 cm back: the blocks both games have did their work
  assert.ok(Math.abs(sim.world.robot.pose.y - START_POSE.y) < 1);
});

// =============================================================================================
// The stage: walls, what a cone can reach, the names of the zones
// =============================================================================================

const wall = (x: number, y: number, w: number, l: number, angle = 0): FixedWall => ({ id: 'wall:test', label: 'test', x, y, angle, w, l, h: 150, fill: '#c9a26b' });

test('walls: a thin wall is drawn thicker, around its true middle line; a thick one as it is', () => {
  // a 3 mm wall of Fire Chief on a small stage: 6 pixels are 35 mm there
  const thin = wall(300, 150, 3, 303);
  const box = wallDrawBox(thin, 35);
  assert.deepEqual({ x: box.x, y: box.y, angle: box.angle }, { x: 300, y: 150, angle: 0 });
  assert.equal(box.w, 35);
  // it grows by the same amount at its ends, so that two walls still meet at a corner
  assert.equal(box.l, 303 + 32);
  const corners = obbCorners(box);
  assert.equal(Math.min(...corners.map((c) => c.x)), 300 - 17.5);
  assert.equal(Math.max(...corners.map((c) => c.x)), 300 + 17.5);
  // a wall that lies the other way, and one that is turned
  assert.deepEqual(wallDrawBox(wall(150, 300, 303, 3), 35), { x: 150, y: 300, w: 335, l: 35, angle: 0 });
  assert.equal(wallDrawBox(wall(0, 0, 3, 100, 0.7), 10).angle, 0.7);
  // thick enough already: unchanged
  assert.deepEqual(wallDrawBox(wall(10, 20, 40, 300), 35), { x: 10, y: 20, w: 40, l: 300, angle: 0 });
  assert.ok(WALL_MIN_PIXELS >= 4, 'thinner than this a wall is lost beside the printed grid lines');
});

test('walls: every wall of every Fire Chief maze shows at every stage size, on its own line', () => {
  for (const size of [272, 366, 535, 900, 1400]) {
    const view = fitView(size, size, fireChiefGame.mat.width, fireChiefGame.mat.height, 1);
    const walls = fireChiefGame.createWalls?.(defaultScenario()) ?? [];
    assert.ok(walls.length > 4);
    for (const w of walls) {
      const box = wallDrawBox(w, WALL_MIN_PIXELS / view.scale);
      assert.ok(Math.min(box.w, box.l) * view.scale >= WALL_MIN_PIXELS - 1e-9, `${w.label} at ${size}px`);
      assert.equal(box.x, w.x);
      assert.equal(box.y, w.y);
      // it grows by the same amount in both directions: its middle line stays the true one
      assert.ok(Math.abs(box.w - w.w - (box.l - w.l)) < 1e-9);
    }
  }
});

test('cone: what a fan or a sensor reaches ends at the first wall, and is the whole cone without walls', () => {
  const origin = { x: 100, y: 500 };
  const open = sightPolygon(origin, 0, 20 * DEG, 300, [], 21);
  assert.equal(open.length, 22);
  assert.deepEqual(open[0], origin);
  for (const p of open.slice(1)) assert.ok(Math.abs(Math.hypot(p.x - origin.x, p.y - origin.y) - 300) < 1e-9);
  // straight ahead is up the mat
  assert.ok(Math.abs(open[11].x - 100) < 1e-9 && Math.abs(open[11].y - 200) < 1e-9);
  assert.deepEqual(sightPolygon(origin, 0, 20 * DEG, 300, undefined, 21), open);

  // a wall across the way, 100 mm ahead: nothing of the cone is behind it
  const across = [wall(100, 400 - 1.5, 400, 3)];
  const cut = sightPolygon(origin, 0, 20 * DEG, 300, across, 21);
  for (const p of cut.slice(1)) assert.ok(p.y >= 400 - 1e-6, `${p.y}`);
  assert.ok(Math.abs(cut[11].y - 400) < 1e-6);
  // a wall that covers only the right half: the left half still reaches all the way
  const half = [wall(200, 400 - 1.5, 200, 3)];
  const halfCut = sightPolygon(origin, 0, 20 * DEG, 300, half, 21);
  assert.ok(Math.abs(Math.hypot(halfCut[1].x - origin.x, halfCut[1].y - origin.y) - 300) < 1e-9, 'the ray on the far left is free');
  assert.ok(halfCut[21].y >= 400 - 1e-6, 'the ray on the far right ends at the wall');
});

test('cone: in a real maze the view of the flame sensor and the air of the fan stay in front of the walls', () => {
  const walls = fireChiefGame.createWalls?.(defaultScenario()) ?? [];
  const fan = FIRE_CHIEF_ROBOT.fan!;
  const flame = FIRE_CHIEF_ROBOT.flameSensor!;
  const rng = makeRng(5);
  for (let i = 0; i < 200; i++) {
    // a robot in the middle of a cell, facing any way
    const origin = { x: 150 + 300 * Math.floor(rng() * 5), y: 150 + 300 * Math.floor(rng() * 5) };
    const heading = rng() * Math.PI * 2;
    for (const [half, range] of [[fan.coneHalfAngleDeg * DEG, fan.reachMm], [flame.halfAngleDeg * DEG, flame.rangeMm]] as const) {
      for (const p of sightPolygon(origin, heading, half, range, walls, 31)) {
        // the outer walls stand just outside the mat: no point of a cone is beyond them
        assert.ok(p.x >= -3.001 && p.x <= 1503.001 && p.y >= -3.001 && p.y <= 1503.001, JSON.stringify(p));
      }
    }
  }
});

test('zones: the names of the two rooms are written below them, and all of every name is on the stage', () => {
  const zones = fireChiefGame.overlays(defaultScenario());
  assert.deepEqual(zones.map((zone) => zone.label), ['START', 'Living room (fire)', 'Bedroom']);
  for (const size of [272, 320, 366, 535, 900]) {
    const view = fitView(size, size, fireChiefGame.mat.width, fireChiefGame.mat.height, 1);
    const fontSize = 10 / view.scale;
    const width = (label: string): number => label.length * fontSize * 0.62;
    const corner = viewToMat(view, 0, 0);
    const stage: Rect = { x: corner.x, y: corner.y, w: size / view.scale, h: size / view.scale };
    const places = placeZoneLabels(zones, width, fontSize, 5 / view.scale, stage);
    zones.forEach((zone, i) => {
      const half = width(zone.label) / 2;
      assert.ok(places[i].x - half >= stage.x - 1e-6 && places[i].x + half <= stage.x + stage.w + 1e-6, `${zone.label} at ${size}px`);
      if (zone.id.startsWith('room:')) {
        assert.equal(places[i].below, true, `${zone.label} at ${size}px`);
        assert.ok(places[i].y > roomRect('living').y + roomRect('living').h);
      } else {
        assert.equal(places[i].below, false);
      }
    });
  }
});

test('zones: the names of Fire Rescue stand where they always stood', () => {
  const rng = makeRng(3);
  for (const size of [272, 320, 366, 535, 900]) {
    const view = fitView(size, size, fireRescueGame.mat.width, fireRescueGame.mat.height, 1);
    const fontSize = 10 / view.scale;
    const width = (label: string): number => label.length * fontSize * 0.62;
    const corner = viewToMat(view, 0, 0);
    const stage: Rect = { x: corner.x, y: corner.y, w: size / view.scale, h: size / view.scale };
    for (let k = 0; k < 20; k++) {
      const zones = fireRescueGame.overlays(k === 0 ? fireRescueGame.defaultScenario() : fireRescueGame.randomScenario(rng));
      assert.deepEqual(placeZoneLabels(zones, width, fontSize, 5 / view.scale, stage), placeZoneLabels(zones, width, fontSize, 5 / view.scale));
    }
  }
});

test('console: a wall is named after the two cells it stands between, or after its side of the field', () => {
  assert.equal(bodyName('wall:A1-B1'), 'the wall between A1 and B1');
  assert.equal(bodyName('wall:top'), 'the top wall');
  assert.equal(bodyName('target:fire'), 'the fire target');
  assert.equal(describeEvent({ type: 'bump', bodyId: 'wall:C3-C4', time: 2 })?.text, 'Bumped into the wall between C3 and C4.');
  // Fire Rescue: as before
  assert.equal(bodyName('wall'), 'the table wall');
  assert.equal(bodyName('tower:W1'), 'tower W1');
  assert.equal(bodyName('bucket:red'), 'the red bucket');
  // every wall of a maze has such a name
  for (const w of fireChiefGame.createWalls?.(defaultScenario()) ?? []) assert.match(bodyName(w.id), /^the (wall between [A-E][1-5] and [A-E][1-5]|(top|right|bottom|left) wall)$/);
});

// =============================================================================================
// Placing the robot, the ruler
// =============================================================================================

test('placing: the robot of Fire Chief starts completely inside START, at any angle when it stands in the middle', () => {
  assert.ok(poseFits(FIRE_CHIEF_ROBOT, fireChiefGame.startZone, START_POSE));
  assert.equal(fireChiefGame.startZone, START_RECT);
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const pose = centredPose(FIRE_CHIEF_ROBOT, fireChiefGame.startZone, degrees * DEG);
    assert.ok(poseFits(FIRE_CHIEF_ROBOT, fireChiefGame.startZone, pose), `${degrees} degrees`);
    assert.ok(robotFitsInRect(FIRE_CHIEF_ROBOT, pose, START_RECT));
  }
  // outside START, or half over its edge: not allowed - and the simulation says the same
  const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: {} });
  for (const pose of [
    { x: 750, y: 1150, heading: 0 },
    { x: 620, y: 1350, heading: 0 },
    { x: 150, y: 150, heading: 0 },
  ]) {
    assert.equal(poseFits(FIRE_CHIEF_ROBOT, fireChiefGame.startZone, pose), false);
    assert.equal(sim.setStartPose(pose), false);
  }
  assert.equal(sim.setStartPose({ x: 760, y: 1340, heading: 30 * DEG }), true);
  // the words about it name the zone as this game calls it
  assert.equal(readyHint(FIRE_CHIEF_START_ZONE, false, false), 'Ready. Drag the robot inside the START cell; turn it with the buttons below the mat.');
});

test('placing: the button beside the turning buttons goes to the middle in Fire Rescue, as before', () => {
  const zone = fireRescueGame.startZone;
  const start = startPoseFor(DEFAULT_ROBOT_CONFIG);
  // the default start position of Fire Rescue IS the middle of the Fire Station ...
  assert.equal(homeKind(DEFAULT_ROBOT_CONFIG, zone, start), 'middle');
  // ... so the button does what it always did: into the middle, turned as the robot is
  for (const degrees of [0, 1, 15, 90, 180, 271]) {
    assert.deepEqual(homePose('middle', DEFAULT_ROBOT_CONFIG, zone, start, degrees * DEG), centredPose(DEFAULT_ROBOT_CONFIG, zone, degrees * DEG), `${degrees} degrees`);
  }
  assert.deepEqual(homeButtonWords('middle', 'Fire Station'), { label: 'Put the robot in the middle of the Fire Station', hint: 'Middle of the Fire Station' });
});

test('placing: in Fire Chief the same button brings the robot back to the default start position', () => {
  const zone = fireChiefGame.startZone;
  // The robot of Fire Chief starts with the point it turns around in the middle of START. Its
  // chassis reaches further forward than back, so that is NOT the place where the robot is centred:
  const centred = centredPose(FIRE_CHIEF_ROBOT, zone, START_POSE.heading);
  assert.ok(Math.abs(centred.y - START_POSE.y) > 10, `the two places are ${Math.abs(centred.y - START_POSE.y)} mm apart`);
  assert.equal(homeKind(FIRE_CHIEF_ROBOT, zone, START_POSE), 'default');
  // wherever the robot was dragged and however it was turned: one press, and it stands as at the start
  for (const degrees of [0, 3, 90, 181]) {
    const home = homePose('default', FIRE_CHIEF_ROBOT, zone, START_POSE, degrees * DEG);
    assert.deepEqual(home, { x: START_POSE.x, y: START_POSE.y, heading: 0 });
    assert.ok(poseFits(FIRE_CHIEF_ROBOT, zone, home));
  }
  // the simulation takes that pose, and a program that counts on it drives as it was written
  const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: MISSION });
  assert.equal(sim.setStartPose({ x: 790, y: 1330, heading: 20 * DEG }), true);
  assert.equal(sim.setStartPose(homePose('default', FIRE_CHIEF_ROBOT, zone, START_POSE, 20 * DEG)), true);
  sim.start();
  while (sim.status === 'running') sim.step(1);
  assert.equal(sim.finishReason, 'mission-complete');
  assert.equal(sim.score().total, 100);
  // the button says what it does, without the word "middle"
  const words = homeButtonWords('default', FIRE_CHIEF_START_ZONE);
  assert.equal(words.label, 'Put the robot back at its default start position');
  assert.equal(words.hint, 'Back to the default start position in the START cell');
  // a game whose default position is half a millimetre from the middle is still "the middle"
  assert.equal(homeKind(FIRE_CHIEF_ROBOT, zone, { ...centred, y: centred.y + 0.4 }), 'middle');
});

test('ruler: on the 1500 mm mat of Fire Chief a cell is 30.0 cm, and a point beside the mat lands on its edge', () => {
  const mat = fireChiefGame.mat;
  let line = addRulerPoint(EMPTY_RULER, { x: 750, y: 1350 }, { ...START_POSE }, mat);
  line = addRulerPoint(line, { x: 750, y: 1050 }, null, mat);
  line = addRulerPoint(line, { x: 150, y: 1050 }, null, mat);
  assert.equal(rulerText(line), 'From the robot: straight on, then 30.0 cm, then 90° left, then 60.0 cm - 90.0 cm in all');
  // across the whole field, and beyond it
  const across = addRulerPoint(addRulerPoint(EMPTY_RULER, { x: -40, y: 750 }, null, mat), { x: 1700, y: 750 }, null, mat);
  assert.equal(rulerText(across), '150.0 cm');
});

// =============================================================================================
// The ready-made mazes of the Fire Chief maze editor
// =============================================================================================

test('ready-made mazes: the default maze comes first, the open field is there, and every maze can be played', () => {
  assert.equal(MAZE_CHOICES[0].label, 'Crossroads (default maze)');
  assert.deepEqual(MAZE_CHOICES[0].walls, defaultScenario().walls);
  assert.ok(MAZE_CHOICES.some((choice) => choice.label === 'Open field' && choice.walls.every((w) => !w)));
  assert.equal(MAZE_CHOICES.length, 5);
  assert.equal(new Set(MAZE_CHOICES.map((choice) => choice.label)).size, 5);
  for (const choice of MAZE_CHOICES) {
    assert.match(choice.about, /^Level [1-5] of 5\. /);
    const scenario = withMaze(defaultScenario(), choice);
    assert.deepEqual(scenarioProblems(scenario), [], choice.label);
    // its code can be typed back in
    assert.deepEqual(decodeScenario(encodeScenario(scenario)), scenario);
  }
});

test('ready-made mazes: picking one keeps the fire where the student put it; any other maze is none of them', () => {
  const mine = withFire(defaultScenario(), 'bedroom', 'side');
  for (const choice of MAZE_CHOICES) {
    const next = withMaze(mine, choice);
    assert.equal(next.fireRoom, 'bedroom');
    assert.equal(next.fireSpot, 'side');
    assert.equal(mazeChoiceOf(next)?.id, choice.id);
    assert.notEqual(next.walls, choice.walls, 'a copy: an editor may change it');
  }
  assert.equal(mazeChoiceOf(defaultScenario())?.label, 'Crossroads (default maze)');
  // a maze that is none of the five
  const other = defaultScenario();
  other.walls[0] = !other.walls[0];
  assert.equal(mazeChoiceOf(other), null);
  assert.deepEqual(Object.keys(ROOM_LABEL).sort(), ['bedroom', 'living']);
  assert.deepEqual(Object.keys(SPOT_LABEL).sort(), ['back', 'corner', 'side']);
});

// (The rules window of Fire Chief is tested in ./fire-chief/rules.test.ts, the maze editor, the
// code field and the lists of "Test on many mazes" in ./fire-chief/maze.test.ts.)
