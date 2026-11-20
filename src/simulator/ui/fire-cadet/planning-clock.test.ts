/**
 * Junior's planning stopwatch (./planning-clock.ts, design 7.10): it never starts by itself,
 * counts up, says once that the planning time of the rules is over and goes on counting, locks
 * nothing, and keeps its time when it is stopped - by "Finish!" or by GO.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { planningIdle, planningOver, planningSeconds, planningUnderSheet, planningView, pressPlanningButton, startPlanning, stopPlanning } from './planning-clock';
import { CADET_WORDS } from './words';

const at = (seconds: number): number => 1_000_000 + seconds * 1000;

test('not started: 0:00 and "Start"; it never starts by itself', () => {
  const clock = planningIdle();
  const view = planningView(clock, at(500));
  assert.deepEqual(view, { clock: '0:00', button: 'Start', over: false, note: null, bar: 0 });
  assert.equal(planningUnderSheet(clock), null);
});

test('running: it counts up, the button says "Finish!", the bar fills in the planning time of the rules', () => {
  const clock = startPlanning(at(0));
  assert.equal(planningView(clock, at(35.9)).clock, '0:35', 'whole seconds, counting up');
  assert.equal(planningView(clock, at(83.2)).clock, '1:23');
  assert.equal(planningView(clock, at(35)).button, 'Finish!');
  assert.equal(planningView(clock, at(FIRE_CADET.PLANNING_SECONDS / 2)).bar, 0.5);
  assert.equal(planningView(clock, at(35)).note, null);
});

test('over: "2 minutes are over." from 120 s on, amber, and the clock goes on counting - nothing is locked', () => {
  const clock = startPlanning(at(0));
  assert.equal(planningOver(clock, at(119.99)), false);
  const over = planningView(clock, at(FIRE_CADET.PLANNING_SECONDS));
  assert.equal(over.over, true);
  assert.equal(over.note, '2 minutes are over.');
  assert.equal(over.note, CADET_WORDS.planning.over);
  assert.equal(over.bar, 1);
  const later = planningView(clock, at(150));
  assert.equal(later.clock, '2:30');
  assert.equal(later.button, 'Finish!');
});

test('stopped by "Finish!" or by GO: the recorded time, "Again", and the line under the score sheet', () => {
  const stopped = pressPlanningButton(pressPlanningButton(planningIdle(), at(0)), at(83.7));
  assert.equal(stopped.phase, 'stopped');
  assert.equal(planningSeconds(stopped, at(500)), 83.7);
  const view = planningView(stopped, at(500));
  assert.equal(view.clock, '1:23');
  assert.equal(view.button, 'Again');
  assert.equal(view.note, 'Planning time: 1:23.');
  assert.equal(planningUnderSheet(stopped), 'Planning time: 1:23 of 2:00.');
  // GO stops a running clock the same way; a clock that does not run is left as it is
  const byGo = stopPlanning(startPlanning(at(0)), at(12));
  assert.equal(planningView(byGo, at(99)).note, 'Planning time: 0:12.');
  assert.equal(stopPlanning(planningIdle(), at(5)).phase, 'idle');
  assert.equal(stopPlanning(byGo, at(50)), byGo);
  // "Again": back to 0:00
  assert.deepEqual(planningView(pressPlanningButton(stopped, at(600)), at(700)).clock, '0:00');
});
