/**
 * The banner of the Fire Cadet screen (./banner.ts, design 7.6): the table, first match wins - and
 * that the words come from the referee itself: the banner shows ScoreReport.now as the referee of
 * ../../fire-cadet/game.ts wrote it, and the end sentence the referee's total and time, measured
 * on real matches of the engine.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../../core/simulation';
import type { ScoreReport, Simulation } from '../../core/types';
import { cardRowProgram, cardsFromText, panelProgram } from '../../fire-cadet/cards';
import { REFEREE_WORDS, fireCadetGame } from '../../fire-cadet/game';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { PRACTICE_MAPS, readMapCode, type FireCadetScenario } from '../../fire-cadet/scenario';
import { NOTE_SECONDS, REFUSAL_SECONDS, bannerSentence, stillShown, type BannerInput } from './banner';
import { CADET_WORDS } from './words';

const score = (total: number, extra: Partial<ScoreReport> = {}): BannerInput['score'] => ({ total, max: FIRE_CADET.MAX_POINTS, ...extra });
const base: BannerInput = { mode: 'cards', runState: 'ready', finishReason: null, score: score(0), time: 0, rowLength: 3, refusal: null, note: null };
const banner = (change: Partial<BannerInput>): string => bannerSentence({ ...base, ...change });

test('the table of design 7.6, first match wins', () => {
  // before a match
  assert.equal(banner({ rowLength: 0 }), 'Tap a card to build your row.');
  assert.equal(banner({}), 'Press GO. The robot runs your row.');
  assert.equal(banner({ mode: 'panel', rowLength: 0 }), 'Press GO. Then tap an arrow.');
  // a refusal wins over everything - in Junior; Mini has no row
  assert.equal(banner({ refusal: 'Put an arrow card first.', note: 'Map 3.' }), 'Put an arrow card first.');
  assert.equal(banner({ mode: 'panel', refusal: 'Put an arrow card first.', note: 'Map 3.' }), 'Map 3.');
  // a note of the screen wins over the referee
  assert.equal(banner({ runState: 'running', note: 'Map 3.', score: score(5, { now: 'The Cat is in the Safe Zone. 5 points.' }) }), 'Map 3.');
  // the match runs
  assert.equal(banner({ runState: 'running', score: score(5, { now: 'The Cat is in the Safe Zone. 5 points.' }) }), 'The Cat is in the Safe Zone. 5 points.');
  assert.equal(banner({ runState: 'running' }), 'The robot runs your cards.');
  assert.equal(banner({ mode: 'panel', runState: 'running' }), 'Tap an arrow.');
  // the match is over: the mode first (Mini and Junior are ranked apart), the referee's points and time
  assert.equal(banner({ runState: 'finished', finishReason: 'program-ended', score: score(10, { time: 11.6 }) }), 'Junior: all cards are done. 10 of 25 points in 11.6 seconds.');
  assert.equal(banner({ runState: 'finished', finishReason: 'time', score: score(10, { time: 120 }) }), 'Junior: time is up. 10 of 25 points.');
  assert.equal(banner({ mode: 'panel', runState: 'finished', finishReason: 'time', score: score(10, { time: 120 }) }), 'Mini: time is up. 10 of 25 points.');
  assert.equal(banner({ runState: 'finished', finishReason: 'declared', score: score(10, { time: 48.2 }) }), 'Junior: stop. 10 of 25 points in 48.2 seconds.');
  assert.equal(banner({ mode: 'panel', runState: 'finished', finishReason: 'declared', score: score(10, { time: 48.2 }) }), 'Mini: stop. 10 of 25 points in 48.2 seconds.');
  // with every point: "All 25 points"
  assert.equal(banner({ runState: 'finished', finishReason: 'program-ended', score: score(25, { time: 52.1 }) }), 'Junior: all cards are done. All 25 points in 52.1 seconds!');
  // a time is cut to tenths, never rounded up, as the referee writes it
  assert.equal(banner({ runState: 'finished', finishReason: 'declared', score: score(0, { time: 7.0 }) }), 'Junior: stop. 0 of 25 points in 7 seconds.');
  assert.equal(banner({ runState: 'finished', finishReason: 'declared', score: score(0, { time: 3.6999 }) }), 'Junior: stop. 0 of 25 points in 3.6 seconds.');
});

test('the few seconds of a refusal and of a note', () => {
  assert.equal(REFUSAL_SECONDS, 4);
  assert.equal(NOTE_SECONDS, 4);
  assert.equal(stillShown({ text: 'Map 3.', until: 1000 }, 999), 'Map 3.');
  assert.equal(stillShown({ text: 'Map 3.', until: 1000 }, 1000), null);
  assert.equal(stillShown(null, 0), null);
  // the notes of the screen (design 7.6)
  assert.equal(CADET_WORDS.notes.emptied, 'The row is empty. Undo brings your cards back.');
  assert.equal(CADET_WORDS.notes.addFirst, 'Add a card first.');
  assert.equal(CADET_WORDS.notes.example, 'Example loaded: its cards and its map.');
  assert.equal(CADET_WORDS.notes.practiceMap(3), 'Map 3.');
  assert.equal(CADET_WORDS.notes.ownMap, 'My own map.');
});

/** Play until `until` says stop (or the match ends), as the screen's run loop does, tick by tick. */
function play(scenario: FireCadetScenario, program: Parameters<typeof cardRowProgram>[0] | 'panel', until: (sim: Simulation<FireCadetScenario>) => boolean): Simulation<FireCadetScenario> {
  const sim = createSimulation({ game: fireCadetGame, scenario, program: program === 'panel' ? panelProgram() : cardRowProgram(program) });
  sim.start();
  while (sim.status === 'running' && !until(sim)) sim.step(1);
  return sim;
}

test('the banner shows the referee\'s own sentence, as it is, for as long as the referee keeps it (a real match)', () => {
  // practice map 1: the Cat stands on D5 - Forward x3 pushes it into the Safe Zone
  const sim = play(PRACTICE_MAPS[0], cardsFromText('F3'), (s) => s.score().now !== undefined);
  const now = sim.score().now;
  assert.equal(now, REFEREE_WORDS.delivered.cat);
  assert.equal(bannerSentence({ ...base, runState: 'running', score: sim.score() }), now);
  // the referee keeps it for MESSAGE_SECONDS; the row ends before that, and then the banner says how the match ended
  const said = sim.world.time;
  while (sim.status === 'running') sim.step(1);
  assert.ok(sim.world.time < said + FIRE_CADET.MESSAGE_SECONDS);
  assert.equal(sim.score().now, undefined, 'a match that is over has no sentence of the moment');
  assert.equal(
    bannerSentence({ ...base, runState: 'finished', finishReason: sim.finishReason, score: sim.score(), time: sim.world.time }),
    'Junior: all cards are done. 5 of 25 points in 5.6 seconds.',
  );
  // and while a match runs on, the sentence goes after MESSAGE_SECONDS: Forward x3, Backward x3 (the Cat, then home)
  const longer = play(PRACTICE_MAPS[0], cardsFromText('F3 B3'), (s) => s.score().now !== undefined);
  const at = longer.world.time;
  while (longer.status === 'running' && longer.world.time < at + FIRE_CADET.MESSAGE_SECONDS + 0.05) longer.step(1);
  assert.equal(longer.status, 'running');
  assert.equal(longer.score().now, undefined);
  assert.equal(bannerSentence({ ...base, runState: 'running', score: longer.score() }), 'The robot runs your cards.');
});

test('a touched obstacle: the banner says what the referee says (lead decision D1: -1, and the referee puts it back)', () => {
  // the Road Closed sign on D5, right ahead of the robot: Forward x2 runs into it
  const reading = readMapCode('S-A6-B3-C5-C7-D5-F5-F7');
  assert.ok(reading.ok);
  const sim = play(reading.scenario, cardsFromText('F2'), (s) => s.score().now !== undefined);
  assert.equal(sim.score().now, 'The robot touched the Road Closed sign: -1. The referee puts it back.');
  assert.equal(sim.score().now, REFEREE_WORDS.robotTouched('road-closed'));
  assert.equal(bannerSentence({ ...base, runState: 'running', score: sim.score() }), sim.score().now);
});

test('the end sentence uses the referee\'s total and time: practice map 1 with its whole row, and STOP', () => {
  const done = play(PRACTICE_MAPS[0], cardsFromText('F3 B L F3 L F R2 F5 B5 B R F3'), () => false);
  assert.equal(done.finishReason, 'program-ended');
  const end = done.score();
  assert.equal(end.total, 25);
  assert.equal(bannerSentence({ ...base, runState: 'finished', finishReason: done.finishReason, score: end, time: done.world.time }), 'Junior: all cards are done. All 25 points in 52.1 seconds!');
  // STOP at 3 s in Mini: the student says STOP; the referee's time
  const mini = play(PRACTICE_MAPS[0], 'panel', (s) => s.world.time >= 3 - 1e-9);
  mini.declareFinished();
  assert.equal(mini.finishReason, 'declared');
  assert.equal(
    bannerSentence({ ...base, mode: 'panel', runState: 'finished', finishReason: mini.finishReason, score: mini.score(), time: mini.world.time }),
    'Mini: stop. 0 of 25 points in 3 seconds.',
  );
});
