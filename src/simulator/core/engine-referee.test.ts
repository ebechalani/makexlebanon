/**
 * What a Game may add to the standard match (all optional): a referee with memory, restart
 * rules, its own robot, fixed walls. Tested here with a small made-up game, so that these parts
 * of the contract do not depend on one particular competition.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireRescueGame } from '../fire-rescue/game';
import { defaultScenario } from '../fire-rescue/scenario';
import { createEngineSimulation } from './engine';
import { DEFAULT_ROBOT_CONFIG } from './robot';
import { runMatch } from './batch';
import { drive, forever, makeBody, near, scripted, sleep, type Script } from './test-helpers';
import type {
  Body,
  Game,
  MatVector,
  Referee,
  RefereeCall,
  RestartRules,
  RobotConfig,
  RobotState,
  ScoreContext,
  SimEvent,
} from './types';

// =============================================================================================
// Helpers
// =============================================================================================

const MAT: MatVector = {
  width: 1000,
  height: 1000,
  background: { r: 255, g: 255, b: 255 },
  outside: { r: 120, g: 120, b: 120 },
  layers: [],
};

const BARE: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, enabled: false },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor, enabled: false },
};

interface GameParts {
  referee?: () => Referee<null>;
  restartRules?: RestartRules;
  robotConfig?: RobotConfig;
  bodies?: Body[];
  duration?: number;
}

function makeGame(parts: GameParts = {}): Game<null> {
  const game: Game<null> = {
    id: 'referee-test',
    title: 'Referee test',
    mat: { width: 1000, height: 1000, imageUrl: '', sensorImageUrl: '', vector: MAT },
    matchDuration: parts.duration ?? 180,
    startZone: { x: 0, y: 0, w: 1000, h: 1000 },
    defaultStartPose: { x: 500, y: 800, heading: 0 },
    restartPenalty: 5,
    defaultScenario: () => null,
    randomScenario: () => null,
    scenarioCount: () => 1,
    encodeScenario: () => '',
    decodeScenario: () => null,
    describeScenario: () => '',
    createBodies: () => (parts.bodies ?? []).map((b) => ({ ...b, home: { ...b.home } })),
    overlays: () => [],
    score: (ctx) => ({ total: 100 - 5 * ctx.restarts, max: 100, lines: [], complete: false }),
  };
  if (parts.referee) game.createReferee = parts.referee;
  if (parts.restartRules) game.restartRules = parts.restartRules;
  if (parts.robotConfig) game.robotConfig = parts.robotConfig;
  return game;
}

/** `robotConfig`: the robot the caller names; 'none' = the caller names no robot. */
function setup(script: Script, parts: GameParts = {}, robotConfig: RobotConfig | 'none' = BARE) {
  const harness = scripted(script);
  const sim = createEngineSimulation(
    robotConfig === 'none'
      ? { game: makeGame(parts), scenario: null, program: {} }
      : { game: makeGame(parts), scenario: null, robotConfig, program: {} },
    harness.factory,
  );
  return { sim, harness, robot: sim.world.robot };
}

/**
 * A referee that gives one point for every 100 mm the robot has driven up the mat, remembers
 * the best it has seen, and ends the match when the robot reaches y = 300.
 */
function distanceReferee(log: string[]): Referee<null> {
  let best = 0;
  let restarts = 0;
  const points = (): number => Math.floor(best / 100);
  return {
    observe(ctx: ScoreContext<null>): RefereeCall | null {
      log.push(`observe ${ctx.world.tick} ${ctx.world.time.toFixed(2)}`);
      const before = points();
      best = Math.max(best, 800 - ctx.world.robot.pose.y);
      const call: RefereeCall = {};
      if (points() > before) call.say = [`${points()} point${points() === 1 ? '' : 's'}`];
      if (ctx.world.robot.pose.y <= 300) call.end = { reason: 'mission-complete', detail: 'The robot reached the line.' };
      return call.say || call.end ? call : null;
    },
    restart(ctx: ScoreContext<null>): void {
      log.push(`restart ${ctx.restarts} at ${ctx.world.robot.pose.y}`);
      restarts++;
      best = 0;
    },
    score(ctx: ScoreContext<null>) {
      return {
        total: points(),
        max: 5,
        lines: [{ id: 'far', label: 'Distance', points: points(), max: 5, ok: points() >= 5, detail: `${restarts} restarts`, time: ctx.world.time }],
        complete: points() >= 5,
        time: ctx.world.time,
      };
    },
  };
}

const driveUp: Script = function* (io) {
  yield* drive(io, 600, 120);
  yield* forever();
};

// =============================================================================================
// A referee with memory
// =============================================================================================

test('referee: it is told about every tick of the running match, after the tick, and not before or after', () => {
  const log: string[] = [];
  const { sim } = setup(driveUp, { referee: () => distanceReferee(log) });
  assert.deepEqual(log, [], 'nothing before the start');
  sim.start();
  assert.deepEqual(log, []);
  sim.step(3);
  assert.deepEqual(log, ['observe 1 0.01', 'observe 2 0.02', 'observe 3 0.03']);
  sim.step(5000);
  assert.equal(sim.status, 'finished');
  const ticks = sim.world.tick;
  assert.equal(log.length, ticks, 'once per tick');
  assert.equal(log[log.length - 1], `observe ${ticks} ${sim.world.time.toFixed(2)}`);
  sim.step(100);
  assert.equal(log.length, ticks, 'nothing after the end');
});

test('referee: what it says goes into the log, with the match time', () => {
  const { sim } = setup(driveUp, { referee: () => distanceReferee([]) });
  sim.start();
  sim.step(5000);
  const said = sim.drainEvents().filter((e) => e.type === 'log');
  assert.deepEqual(
    said.map((e) => (e.type === 'log' ? `${e.level}: ${e.text}` : '')),
    ['info: 1 point', 'info: 2 points', 'info: 3 points', 'info: 4 points', 'info: 5 points'],
  );
  for (let i = 1; i < said.length; i++) assert.ok(said[i].time > said[i - 1].time);
});

test('referee: it can end the match - with a reason for the program and a sentence for people', () => {
  const { sim, robot, harness } = setup(
    function* (io) {
      io.setDcMotor('M1', 50);
      yield* drive(io, 600, 120);
      yield* forever();
    },
    { referee: () => distanceReferee([]) },
  );
  sim.start();
  assert.equal(sim.finishDetail, null);
  sim.step(5000);
  assert.equal(sim.status, 'finished');
  assert.equal(sim.finishReason, 'mission-complete');
  assert.equal(sim.finishDetail, 'The robot reached the line.');
  assert.ok(sim.world.time < 10, `ended at ${sim.world.time} s, long before the 180 s`);
  assert.ok(robot.pose.y <= 300 && robot.pose.y > 290, 'at once: on the tick the robot crossed the line');
  // the 'finish' event carries both
  const finish = sim.drainEvents().filter((e) => e.type === 'finish');
  assert.deepEqual(finish, [
    { type: 'finish', reason: 'mission-complete', time: sim.world.time, detail: 'The robot reached the line.' },
  ]);
  // everything stands still: wheels, DC motors, the program
  assert.equal(robot.left.rpm, 0);
  assert.equal(robot.right.rpm, 0);
  assert.equal(harness.io().dcMotorPower('M1'), 0);
  assert.equal(sim.vm.running, false);
  const at = { ...robot.pose };
  sim.step(100);
  assert.deepEqual(robot.pose, at);
});

test('referee: the score comes from the referee (with its times), not from game.score()', () => {
  const { sim } = setup(driveUp, { referee: () => distanceReferee([]) });
  assert.equal(sim.score().total, 0);
  assert.equal(sim.score().max, 5);
  sim.start();
  sim.step(5000);
  const report = sim.score();
  assert.equal(report.total, 5);
  assert.equal(report.complete, true);
  assert.equal(report.time, sim.world.time);
  assert.equal(report.lines[0].time, sim.world.time);
  // a game without a referee is scored by game.score(), as always
  const plain = setup(driveUp);
  assert.equal(plain.sim.score().total, 100);
  assert.equal(plain.sim.score().time, undefined);
});

test('referee: when it ends the match on the very last tick, its reason counts, not "time"', () => {
  let ticks = 0;
  const referee = (): Referee<null> => ({
    observe: () => (++ticks === 100 ? { end: { reason: 'target-displaced', detail: 'Out.' } } : null),
    restart: () => {},
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  });
  const { sim } = setup(function* () { yield* forever(); }, { referee, duration: 1 });
  sim.start();
  sim.step(500);
  assert.equal(sim.world.tick, 100);
  assert.equal(sim.finishReason, 'target-displaced');
  assert.equal(sim.finishDetail, 'Out.');
});

test('referee: time, "Finished" and the end of the program end the match as in every game, without a sentence', () => {
  const timed = setup(function* () { yield* forever(); }, { referee: () => distanceReferee([]), duration: 2 });
  timed.sim.start();
  timed.sim.step(500);
  assert.equal(timed.sim.finishReason, 'time');
  assert.equal(timed.sim.finishDetail, null);
  assert.deepEqual(timed.sim.drainEvents().filter((e) => e.type === 'finish'), [{ type: 'finish', reason: 'time', time: 2 }]);

  const declared = setup(function* () { yield* forever(); }, { referee: () => distanceReferee([]) });
  declared.sim.start();
  declared.sim.step(50);
  declared.sim.declareFinished();
  assert.equal(declared.sim.finishReason, 'declared');
  assert.equal(declared.sim.finishDetail, null);

  const ended = setup(function* (io) { yield* drive(io, 150, 60); }, { referee: () => distanceReferee([]) });
  ended.sim.start();
  ended.sim.step(2000);
  assert.equal(ended.sim.finishReason, 'program-ended');
  assert.equal(ended.sim.score().total, 1, 'the points earned stay');
});

test('referee: begin() is called once at the start signal - the robot still stands where the team put it', () => {
  const log: string[] = [];
  const referee = (): Referee<null> => ({
    begin: (ctx) => {
      log.push(`begin tick ${ctx.world.tick} at ${ctx.world.robot.pose.x},${ctx.world.robot.pose.y} shapes ${ctx.robotShapes.length}`);
    },
    observe: (ctx) => {
      if (ctx.world.tick <= 2) log.push(`observe ${ctx.world.tick}`);
      return null;
    },
    restart: () => {
      log.push('restart');
    },
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  });
  const { sim } = setup(driveUp, { referee });
  assert.deepEqual(log, [], 'not when the simulation is created');
  assert.equal(sim.setStartPose({ x: 400, y: 700, heading: 0 }), true);
  assert.deepEqual(log, [], 'not when the robot is placed');
  sim.start();
  assert.deepEqual(log, ['begin tick 0 at 400,700 shapes 1'], 'at the start signal, before anything moved');
  sim.start(); // (a second start signal does nothing)
  sim.step(100);
  sim.restart();
  sim.step(100);
  assert.deepEqual(log, ['begin tick 0 at 400,700 shapes 1', 'observe 1', 'observe 2', 'restart'], 'once per match, not again after a restart');
});

test('referee: finished() is called once at every kind of end, while the motors still run', () => {
  const makeReferee = (log: string[], endAt = Infinity) => (): Referee<null> => ({
    observe: (ctx) => (ctx.world.tick >= endAt ? { end: { reason: 'mission-complete', detail: 'Done.' } } : null),
    restart: () => {},
    finished: (ctx, reason) => {
      const robot = ctx.world.robot;
      log.push(`${reason} at tick ${ctx.world.tick}: M1 ${robot.dcMotors?.M1.power}, fan ${robot.fanOn}, left wheel ${robot.left.targetRpm} RPM`);
    },
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  });
  // a robot with a fan that drives and blows for the whole match
  const busy: Script = function* (io) {
    io.setDcMotor('M1', 80);
    io.setWheelRpm('left', 30);
    io.setWheelRpm('right', -30);
    yield* forever();
  };
  const FAN_ROBOT: RobotConfig = { ...BARE, fan: { enabled: true, port: 'M1', forward: 105, minPower: 20, coneHalfAngleDeg: 20, reachMm: 300 } };
  const stopped = (robot: RobotState): void => {
    assert.equal(robot.dcMotors?.M1.power, 0, 'afterwards the motor is stopped');
    assert.equal(robot.fanOn, false);
    assert.equal(robot.left.targetRpm, 0);
  };

  // the time is up
  let log: string[] = [];
  const timed = setup(busy, { referee: makeReferee(log), duration: 1 }, FAN_ROBOT);
  timed.sim.start();
  timed.sim.step(99);
  assert.deepEqual(log, [], 'not before the end');
  timed.sim.step(500);
  assert.deepEqual(log, ['time at tick 100: M1 80, fan true, left wheel 30 RPM']);
  stopped(timed.robot);

  // the team says "Finished"
  log = [];
  const declared = setup(busy, { referee: makeReferee(log) }, FAN_ROBOT);
  declared.sim.start();
  declared.sim.step(50);
  declared.sim.declareFinished();
  declared.sim.declareFinished();
  declared.sim.step(50);
  assert.deepEqual(log, ['declared at tick 50: M1 80, fan true, left wheel 30 RPM'], 'once');
  stopped(declared.robot);

  // the referee itself ends the match
  log = [];
  const called = setup(busy, { referee: makeReferee(log, 20) }, FAN_ROBOT);
  called.sim.start();
  called.sim.step(500);
  assert.deepEqual(log, ['mission-complete at tick 20: M1 80, fan true, left wheel 30 RPM']);
  assert.equal(called.sim.finishDetail, 'Done.');
  stopped(called.robot);

  // the program has ended (it switched everything off itself)
  log = [];
  const ended = setup(function* (io) { yield* sleep(5); io.setDcMotor('M1', 0); }, { referee: makeReferee(log) }, FAN_ROBOT);
  ended.sim.start();
  ended.sim.step(500);
  assert.equal(log.length, 1);
  assert.match(log[0], /^program-ended at tick \d+: M1 0, fan false, left wheel 0 RPM$/);

  // a referee without finished() and begin() is as good as before (the first tests of this file)
});

test('referee: runMatch reports the referee\'s sentence and the time of the score', () => {
  const game = makeGame({ referee: () => distanceReferee([]) });
  // (the real interpreter with an empty program: the robot does not move, so the match is cut short)
  const result = runMatch({ game, scenario: null, robotConfig: BARE, program: {} }, 1);
  assert.equal(result.total, 0);
  assert.equal(result.finishDetail, undefined);
  assert.equal(typeof result.scoreTime, 'number');
  // Fire Rescue has no referee with memory: neither field appears in its results
  const rescue = runMatch({ game: fireRescueGame, scenario: defaultScenario(), robotConfig: DEFAULT_ROBOT_CONFIG, program: {} }, 1);
  assert.equal('finishDetail' in rescue, false);
  assert.equal('scoreTime' in rescue, false);
});

// =============================================================================================
// Restart rules
// =============================================================================================

test('restart rules: without any, a game allows as many restarts as the team wants (as before)', () => {
  const { sim, harness } = setup(function* () { yield* forever(); });
  assert.equal(sim.restartsLeft, Infinity);
  sim.start();
  for (let i = 0; i < 7; i++) {
    sim.step(10);
    sim.restart();
  }
  assert.equal(sim.restarts, 7);
  assert.equal(sim.restartsLeft, Infinity);
  assert.equal(harness.starts(), 8);
  assert.equal(sim.score().total, 100 - 35);
  // Fire Rescue itself has no restart rules
  assert.equal(fireRescueGame.restartRules, undefined);
  assert.equal(fireRescueGame.createReferee, undefined);
  assert.equal(fireRescueGame.createWalls, undefined);
  assert.equal(fireRescueGame.robotConfig, undefined);
});

test('restart rules: a game can allow only so many restarts; one more does nothing but a warning', () => {
  const log: string[] = [];
  const { sim, robot, harness } = setup(driveUp, { referee: () => distanceReferee(log), restartRules: { maxRestarts: 1, clearsPoints: true } });
  assert.equal(sim.restartsLeft, 1);
  sim.start();
  sim.step(80);
  assert.ok(sim.score().total >= 1);
  const timeBefore = sim.world.time;

  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.equal(sim.restartsLeft, 0);
  assert.equal(robot.pose.y, 800, 'back at the start');
  assert.equal(sim.world.time, timeBefore, 'the clock keeps running');
  assert.equal(harness.starts(), 2, 'the program starts again');
  // the referee was told, after the robot was put back, and forgot the points
  assert.equal(log.filter((l) => l.startsWith('restart')).join(), 'restart 1 at 800');
  assert.equal(sim.score().total, 0);
  let events = sim.drainEvents();
  assert.equal(events.filter((e) => e.type === 'restart').length, 1);

  // the second restart is refused
  sim.step(80);
  const y = robot.pose.y;
  const points = sim.score().total;
  assert.ok(points >= 1);
  sim.restart();
  assert.equal(sim.restarts, 1);
  assert.equal(sim.restartsLeft, 0);
  assert.equal(robot.pose.y, y, 'the robot stays where it is');
  assert.equal(sim.score().total, points, 'the points stay');
  assert.equal(harness.starts(), 2, 'the program runs on');
  assert.equal(log.filter((l) => l.startsWith('restart')).length, 1);
  events = sim.drainEvents();
  assert.equal(events.filter((e) => e.type === 'restart').length, 0);
  const warnings = events.filter((e): e is Extract<SimEvent, { type: 'log' }> => e.type === 'log' && e.level === 'warn');
  assert.deepEqual(warnings.map((e) => e.text), ['No restart left: this game allows 1 restart per attempt.']);
  sim.step(10);
  assert.equal(sim.status, 'running');
});

test('restart rules: a game can allow no restart at all', () => {
  const { sim, robot } = setup(driveUp, { restartRules: { maxRestarts: 0 } });
  assert.equal(sim.restartsLeft, 0);
  sim.start();
  sim.step(100);
  const y = robot.pose.y;
  sim.restart();
  assert.equal(sim.restarts, 0);
  assert.equal(robot.pose.y, y);
  const warnings = sim.drainEvents().filter((e) => e.type === 'log');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].type === 'log' ? warnings[0].text : '', /does not allow restarts/);
});

test('restart rules: "resetsBodies" puts every game element back; without it a pushed element stays', () => {
  const box = makeBody({ id: 'box', x: 500, y: 600, w: 60, l: 20, h: 120 });
  const other = makeBody({ id: 'other', x: 200, y: 200, w: 40, l: 40, h: 40 });
  const push: Script = function* (io) {
    yield* drive(io, 150, 90);
    yield* forever();
  };
  for (const resets of [true, false]) {
    const { sim, robot } = setup(push, { bodies: [box, other], restartRules: resets ? { resetsBodies: true } : {} });
    sim.start();
    sim.step(300);
    const pushed = sim.world.bodies[0];
    near(pushed.y, 800 - 150 - 105 - 10, 0.05, 'the box was pushed up the mat');
    sim.restart();
    assert.equal(robot.pose.y, 800);
    if (resets) {
      assert.deepEqual([pushed.x, pushed.y, pushed.angle], [500, 600, 0], 'back where it started');
    } else {
      near(pushed.y, 535, 0.05, 'still where it was pushed to');
    }
    assert.deepEqual([sim.world.bodies[1].x, sim.world.bodies[1].y], [200, 200]);
    // and the match goes on: the program pushes it again
    sim.step(300);
    near(pushed.y, 535, 0.05);
  }
});

// =============================================================================================
// The robot of the game
// =============================================================================================

test('robot of the game: used when the caller names none; a named one wins; without both, the standard robot', () => {
  const fromGame = setup(function* () {}, { robotConfig: BARE }, 'none');
  assert.equal(fromGame.sim.robotConfig, BARE);
  assert.equal(fromGame.harness.io().config, BARE);
  assert.equal(fromGame.sim.robotShapes().length, 1);

  const named: RobotConfig = { ...DEFAULT_ROBOT_CONFIG, maxRpm: 99 };
  const fromCaller = setup(function* () {}, { robotConfig: BARE }, named);
  assert.equal(fromCaller.sim.robotConfig, named);

  const standard = setup(function* () {}, {}, 'none');
  assert.equal(standard.sim.robotConfig, DEFAULT_ROBOT_CONFIG);
  assert.equal(standard.sim.robotShapes().length, 3);
});

test('a referee sees the robot it judges: the context carries its configuration and its shapes', () => {
  let seen: ScoreContext<null> | null = null;
  const referee = (): Referee<null> => ({
    observe: (ctx) => {
      seen = ctx;
      return null;
    },
    restart: () => {},
    score: () => ({ total: 0, max: 0, lines: [], complete: false }),
  });
  const { sim } = setup(function* () { yield* sleep(3); }, { referee, robotConfig: BARE }, 'none');
  sim.start();
  sim.step(1);
  assert.ok(seen);
  const ctx: ScoreContext<null> = seen;
  assert.equal(ctx.robotConfig, BARE);
  assert.equal(ctx.world, sim.world);
  assert.deepEqual(ctx.robotShapes, sim.robotShapes());
  assert.equal(ctx.restarts, 0);
  assert.deepEqual(ctx.world.walls, []);
});
