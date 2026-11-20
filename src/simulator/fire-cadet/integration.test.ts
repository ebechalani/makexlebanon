/**
 * Fire Cadet as the engine and the screen use it: the Game object (game.ts), the robot at the
 * start, the elements of a map, and a whole match of each kind through createSimulation - Junior
 * with a row of cards, Mini with taps on the direction panel.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rectContainsOBB } from '../core/geometry';
import { robotShapesAt } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { ButtonName } from '../core/types';
import { cardRowProgram, cardsFromText, createFireCadetVM, panelProgram } from './cards';
import { MAT_IMAGE_URL, MAT_VECTOR, START_SQUARE } from './field';
import { fireCadetGame, itemBodyKind, itemId, obstacleBodyKind, obstacleId } from './game';
import { FIRE_CADET, spot, squareRect } from './numbers';
import { MTINY_ROBOT, START_POSE } from './robot';
import { ITEM_NAMES, OBSTACLE_KINDS, PRACTICE_MAPS, SCENARIO_COUNT, scenarioProblems } from './scenario';

const game = fireCadetGame;

test('the Game object: id, title, mat, clock, start, robot, interpreter, no restarts, no walls', () => {
  assert.equal(game.id, 'fire-cadet');
  assert.equal(game.title, 'MakeX Lebanon 2027 - Fire Cadet: Rescue City');
  assert.deepEqual(game.mat, { width: 1250, height: 1250, imageUrl: MAT_IMAGE_URL, sensorImageUrl: '', vector: MAT_VECTOR });
  assert.equal(game.matchDuration, FIRE_CADET.MATCH_SECONDS);
  assert.deepEqual(game.startZone, squareRect(START_SQUARE));
  assert.deepEqual(game.defaultStartPose, START_POSE);
  assert.equal(game.robotConfig, MTINY_ROBOT);
  assert.equal(game.createVM, createFireCadetVM);
  assert.deepEqual(game.restartRules, { maxRestarts: 0 });
  assert.equal(game.restartPenalty, 0);
  assert.equal(game.createWalls, undefined, 'D1: the obstacles are game elements, not fixed walls');
  assert.equal(game.scenarioCount(), SCENARIO_COUNT);
  assert.equal(game.encodeScenario(game.defaultScenario()), 'P1');
  assert.equal(game.decodeScenario('p8'), PRACTICE_MAPS[7]);
  assert.equal(game.describeScenario(PRACTICE_MAPS[2]), 'Practice map 3');
  assert.deepEqual(game.scenarioProblems?.(PRACTICE_MAPS[0]), []);
  assert.ok(PRACTICE_MAPS.includes(game.randomScenario(() => 0.4)));
  assert.equal(scenarioProblems(game.defaultScenario()).length, 0);
});

test('the mTiny: the body and the sticks of section 2, the speeds that make a move 1.6 s', () => {
  const r = MTINY_ROBOT;
  assert.deepEqual(
    [r.chassisFront, r.chassisRear, r.chassisWidth, r.chassisHeight, r.wheelDiameter, r.trackWidth],
    [57, 57, 106.5, 98, 40, 74],
  );
  assert.ok(Math.abs(r.maxRpm - 60.7) < 0.01);
  assert.ok(Math.abs(r.rpmPerSecond - 303.5) < 0.05);
  const g = r.gripper;
  assert.equal(g.enabled, true);
  assert.equal(g.fixedSticks, true);
  assert.deepEqual([g.clawOpenGap, g.clawClosedGap, g.liftDownHeight, g.liftUpHeight], [90.5, 90.5, 5, 5]);
  assert.deepEqual([g.gripForward, g.fingerLength, g.fingerThickness, g.fingerHeight], [72, 30, 8, 20]);
  assert.equal(r.frontColorSensor.enabled, false);
  assert.deepEqual(r.noise, { wheelSlip: 0, sensor: 0, ultrasonicCm: 0 });
  // three boxes: the body and the two sticks
  assert.equal(robotShapesAt(r, START_POSE).length, 3);
});

test('the robot on the start spot fits the Fire Station in all four directions: 2.0 mm to spare at the tips, 4.24 mm looking down', () => {
  const d7 = squareRect(START_SQUARE);
  assert.deepEqual([Math.round(START_POSE.x * 1000) / 1000, Math.round(START_POSE.y * 1000) / 1000, START_POSE.heading], [624.764, 1158.764, 0]);
  const room = (heading: number): number => {
    const shapes = robotShapesAt(MTINY_ROBOT, { ...START_POSE, heading });
    for (const s of shapes) assert.ok(rectContainsOBB(d7, s), `heading ${heading}`);
    let least = Infinity;
    for (const s of shapes) {
      const ex = (Math.abs(s.w * Math.cos(s.angle)) + Math.abs(s.l * Math.sin(s.angle))) / 2;
      const ey = (Math.abs(s.w * Math.sin(s.angle)) + Math.abs(s.l * Math.cos(s.angle))) / 2;
      least = Math.min(least, s.x - ex - d7.x, d7.x + d7.w - (s.x + ex), s.y - ey - d7.y, d7.y + d7.h - (s.y + ey));
    }
    return Math.round(least * 100) / 100;
  };
  assert.equal(room(0), 2);
  assert.equal(room(Math.PI / 2), 2);
  assert.equal(room(-Math.PI / 2), 2);
  assert.equal(room(Math.PI), 4.24);
  // the start pose is accepted by the engine as inside the start zone
  const sim = createSimulation({ game, scenario: PRACTICE_MAPS[0], program: cardRowProgram([]) });
  assert.equal(sim.setStartPose(START_POSE), true);
});

test('every item and every obstacle stands on the spot of its square, unturned, on a 40 mm base', () => {
  for (const s of PRACTICE_MAPS) {
    const bodies = game.createBodies(s);
    assert.equal(bodies.length, 7);
    ITEM_NAMES.forEach((item, k) => {
      const b = bodies[k];
      assert.deepEqual([b.id, b.kind], [itemId(item), itemBodyKind(item)]);
      assert.deepEqual([b.x, b.y, b.angle, b.w, b.l, b.h, b.z], [spot(s[item]).x, spot(s[item]).y, 0, 40, 40, 50, 0]);
      assert.deepEqual(b.home, { x: b.x, y: b.y, angle: 0, z: 0, restingOn: null });
      assert.equal(b.grippable, false);
    });
    OBSTACLE_KINDS.forEach((kind, k) => {
      const b = bodies[4 + k];
      assert.deepEqual([b.id, b.kind], [obstacleId(kind), obstacleBodyKind(kind)]);
      assert.deepEqual([b.x, b.y, b.angle, b.w, b.l, b.h], [spot(s.obstacles[k]).x, spot(s.obstacles[k]).y, 0, 40, 40, 50]);
    });
  }
  const zones = game.overlays(PRACTICE_MAPS[0]);
  assert.deepEqual(
    zones.map((z) => [z.id, z.kind]),
    [
      ['start', 'start'],
      ['target-water', 'delivery'],
      ['target-cat', 'delivery'],
      ['target-person', 'delivery'],
    ],
  );
});

test('a whole Junior match through createSimulation: the row of practice map 1, 25 points, the clock stops when the row is done', () => {
  const sim = createSimulation({ game, scenario: PRACTICE_MAPS[0], program: cardRowProgram(cardsFromText('F3 B L F3 L F R2 F5 B5 B R F3')) });
  assert.equal(String(sim.status), 'ready');
  assert.equal(sim.world.bodies.length, 7);
  sim.start();
  let lastNow: string | undefined;
  const banner: string[] = [];
  while (sim.status === 'running') {
    sim.step(1);
    const now = sim.score().now;
    if (now !== undefined && now !== lastNow) banner.push(now);
    lastNow = now;
  }
  assert.equal(sim.finishReason, 'program-ended');
  assert.ok(Math.abs(sim.world.time - 52.1) < 1e-9);
  assert.equal(sim.score().total, 25);
  assert.equal(sim.score().time, sim.world.time);
  assert.deepEqual(banner, [
    'The Cat is in the Safe Zone. 5 points.',
    'The Injured Person is in the Hospital. 5 points.',
    'The Water reached the Fire. 5 points.',
    'The Equipment is back in the Fire Station. 5 points.',
  ]);
  // the four items have been taken off the field; the three obstacles are left on it
  assert.deepEqual(sim.world.bodies.map((b) => b.id), OBSTACLE_KINDS.map(obstacleId));
});

test('a whole Mini match through createSimulation: taps on the panel, the clock runs to 120 s; STOP ends it at once', () => {
  const tapAll = (sim: ReturnType<typeof createSimulation>, buttons: ButtonName[]): void => {
    for (const button of buttons) {
      sim.setButton(button, true);
      sim.step(3);
      sim.setButton(button, false);
      // wait until the panel has started this move and the robot is at rest again
      while (sim.status === 'running' && sim.vm.activeBlockIds().length > 0) sim.step(1);
    }
  };
  // there and back on practice map 1: three Forward taps (the Cat into the Safe Zone), three Backward
  const sim = createSimulation({ game, scenario: PRACTICE_MAPS[0], program: panelProgram() });
  sim.start();
  tapAll(sim, ['up', 'up', 'up', 'down', 'down', 'down']);
  assert.equal(sim.status, 'running', 'the panel does not end the match');
  assert.equal(sim.score().total, 10);
  sim.step(20_000);
  assert.equal(sim.finishReason, 'time');
  assert.equal(sim.world.time, FIRE_CADET.MATCH_SECONDS);
  assert.equal(sim.score().total, 10);
  // STOP: the match ends now, and the points count
  const stop = createSimulation({ game, scenario: PRACTICE_MAPS[0], program: panelProgram() });
  stop.start();
  tapAll(stop, ['up', 'up', 'up']);
  stop.declareFinished();
  assert.equal(stop.finishReason, 'declared');
  assert.equal(stop.score().total, 5);
  assert.equal(stop.score().time, stop.world.time);
});
