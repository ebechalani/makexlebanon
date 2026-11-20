/**
 * Fire Cadet: the cards (cards.ts, design 4) - reading a program, the rows that are refused, the
 * times, and the two interpreters (the row of cards for Junior, the direction panel for Mini) in
 * the engine.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSimulation } from '../core/simulation';
import type { ButtonName, Simulation } from '../core/types';
import {
  CARD_NAMES,
  ROW_PROBLEM_WORDS,
  cardRowProgram,
  cardsFromText,
  cardsToText,
  createCardVM,
  createFireCadetVM,
  createPanelVM,
  expand,
  panelProgram,
  readCards,
  rowProblem,
  rowSeconds,
  rowTicks,
  turnRpm,
  type CardName,
} from './cards';
import { fireCadetGame, fireCadetGameWith } from './game';
import { FIRE_CADET, spot, ticks, type CardTimes } from './numbers';
import { playFireCadet } from './play';
import { MTINY_ROBOT } from './robot';
import { PRACTICE_MAPS, type FireCadetScenario } from './scenario';
import { parkedMap, sq } from './test-helpers';

const row = cardsFromText;
const program = (text: string) => cardRowProgram(row(text));
const D = spot({ col: 3, row: 0 }).x; // the x of column D

test('the short notation: "F3 B L" is Forward, x3, Backward, Turn left', () => {
  assert.deepEqual(row('F3 B L'), ['forward', 'x3', 'backward', 'left']);
  assert.deepEqual(row('r5r5'), ['right', 'x5', 'right', 'x5']);
  assert.equal(cardsToText(['forward', 'x3', 'backward', 'left']), 'F3 B L');
  assert.throws(() => row('F6'));
  assert.throws(() => row('Q'));
});

test('readCards: any program becomes a valid row, and it never throws', () => {
  assert.deepEqual(readCards({}), []);
  assert.deepEqual(readCards(null), []);
  assert.deepEqual(readCards(undefined), []);
  assert.deepEqual(readCards('forward'), []);
  assert.deepEqual(readCards({ blocks: { blocks: [{ type: 'cyberpi_event_start', id: 'a' }] } }), [], 'a block program');
  assert.deepEqual(readCards(panelProgram()), []);
  assert.deepEqual(readCards({ cards: 'forward' }), []);
  assert.deepEqual(readCards(program('F3 B L')), row('F3 B L'));
  // names it does not know are dropped; a number card that does not follow a move card is dropped
  assert.deepEqual(readCards({ cards: ['jump', 'forward', 7, null, 'x3', 'x2', 'loop', 'left', 'x9', 'x5'] }), ['forward', 'x3', 'left', 'x5']);
  assert.deepEqual(readCards({ cards: ['x2', 'forward'] }), ['forward']);
  // more than 70 cards: cut after the 70th
  const long = readCards({ cards: Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? 'right' : 'x2')) });
  assert.equal(long.length, FIRE_CADET.MAX_ROW_CARDS);
  assert.equal(rowProblem(long), null);
  // every random program reads as a valid row
  let seed = 5;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const names = [...CARD_NAMES, 'junk', 'x1', 'x6', ''];
  for (let k = 0; k < 2000; k++) {
    const cards = Array.from({ length: Math.floor(rnd() * 90) }, () => names[Math.floor(rnd() * names.length)]);
    const read = readCards({ cards });
    assert.equal(rowProblem(read), null, JSON.stringify(cards));
  }
});

test('rowProblem: the four refusals of design 4.3, each with its words', () => {
  assert.equal(rowProblem([]), null);
  assert.equal(rowProblem(row('F3 B L R2')), null);
  assert.equal(rowProblem(['x2']), 'number-first');
  assert.equal(rowProblem(['x2', 'forward']), 'number-first');
  assert.equal(rowProblem(['x2'], 'move'), 'number-alone');
  assert.equal(rowProblem(['forward', 'x2', 'x3']), 'number-twice');
  assert.equal(rowProblem(['forward', 'x2', 'x3'], 'move'), 'number-twice');
  const full = Array.from({ length: FIRE_CADET.MAX_ROW_CARDS + 1 }, () => 'forward');
  assert.equal(rowProblem(full), 'full');
  assert.equal(rowProblem(full.slice(1)), null);
  assert.deepEqual(ROW_PROBLEM_WORDS, {
    'number-first': 'Put an arrow card first.',
    'number-twice': 'One number card for each arrow.',
    'number-alone': 'A number card comes after an arrow.',
    full: 'The row is full: 70 cards.',
  });
});

test('expand: a move card with xN gives N equal moves', () => {
  assert.deepEqual(expand(row('L F3')), [
    { move: 'left', card: 0, numberCard: null, nth: 1, times: 1 },
    { move: 'forward', card: 1, numberCard: 2, nth: 1, times: 3 },
    { move: 'forward', card: 1, numberCard: 2, nth: 2, times: 3 },
    { move: 'forward', card: 1, numberCard: 2, nth: 3, times: 3 },
  ]);
  assert.equal(expand(row('R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5')).length, 70);
});

test('the times of design 4.4: Forward 1.6 s, Forward x3 5.6 s, Forward Turn right Forward 5.3 s, and 8 cards 14.1 s - in the formula and in the engine', () => {
  const cases: [string, number][] = [
    ['F', 1.6],
    ['F3', 5.6],
    ['F R F', 5.3],
    ['F R F L B R R L', 14.1],
  ];
  for (const [text, seconds] of cases) {
    assert.equal(rowSeconds(row(text)), seconds, text);
    assert.equal(rowTicks(row(text)), Math.round(seconds * 100), text);
    // in the engine: the match ends when the row has run, at exactly that tick
    const result = playFireCadet(program(text), parkedMap());
    assert.equal(result.finishReason, 'program-ended', text);
    assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), rowTicks(row(text)), text);
  }
  assert.equal(rowSeconds([]), 0);
});

test('a tuned time never breaks the counting: every time x 0.25 (a turn of 0.325 s) - the P1 proof row takes 13.05 s in the formula and in the engine', () => {
  const quarter: CardTimes = {
    MOVE_SECONDS: FIRE_CADET.MOVE_SECONDS * 0.25,
    TURN_SECONDS: FIRE_CADET.TURN_SECONDS * 0.25,
    REST_SECONDS: FIRE_CADET.REST_SECONDS * 0.25,
    RAMP_SECONDS: FIRE_CADET.RAMP_SECONDS * 0.25,
  };
  const p1 = row('F3 B L F3 L F R2 F5 B5 B R F3');
  assert.equal(rowSeconds(p1, quarter), 13.05);
  const result = playFireCadet(cardRowProgram(p1), PRACTICE_MAPS[0], { times: quarter });
  assert.equal(result.finishReason, 'program-ended');
  assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), rowTicks(p1, quarter));
  assert.equal(result.total, 25, 'the faster robot still does the whole mission');
});

/** The ticks each move of a row drives its wheels (from the first tick a wheel turns to the last). */
function motionTicks(text: string): number[] {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: program(text) });
  sim.start();
  const out: number[] = [];
  let run = 0;
  while (sim.status === 'running') {
    sim.step(1);
    const turning = sim.world.robot.left.rpm !== 0 || sim.world.robot.right.rpm !== 0;
    if (turning) run++;
    else if (run > 0) {
      out.push(run);
      run = 0;
    }
  }
  if (run > 0) out.push(run);
  return out;
}

test('every card takes exactly its time: the motion ends inside the slot (a move 157 or 158 ticks of 160, a turn 127 of 130)', () => {
  assert.equal(ticks(FIRE_CADET.MOVE_SECONDS), 160);
  assert.equal(ticks(FIRE_CADET.TURN_SECONDS), 130);
  // (counted as the ticks in which a wheel turns; the design's probe counted from the start of the
  // card to the first tick the motion was done, and so found 158 for the first move)
  const measured = motionTicks('F R F L B R R L');
  assert.deepEqual(measured, [157, 127, 157, 127, 157, 127, 127, 127]);
  expand(row('F R F L B R R L')).forEach((step, k) =>
    assert.ok(measured[k] < (step.move === 'forward' || step.move === 'backward' ? 160 : 130), `move ${k + 1}: ${measured[k]} ticks`),
  );
  // the speed of a turn: 22.6 RPM, so that speeding up, turning and braking take TURN_SECONDS
  assert.ok(Math.abs(turnRpm(MTINY_ROBOT) - 22.6) < 0.05);
  assert.ok(Math.abs(MTINY_ROBOT.maxRpm - 60.7) < 0.01);
});

test('the rest comes between two moves, not after the last; the next card starts from where the robot stands', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: program('F L') });
  sim.start();
  const starts: number[] = [];
  let moves = 0;
  while (sim.status === 'running') {
    sim.step(1);
    const m = Number(sim.vm.variables().move ?? moves);
    if (m > moves) {
      starts.push(Math.round(sim.world.time * 100));
      moves = m;
    }
  }
  // move 1 begins at the round button, tick 0 (seen here after tick 1); move 2 at tick 160 + 40
  assert.deepEqual(starts, [1, 200]);
  assert.equal(Math.round(sim.world.time * 100), 160 + 40 + 130);
  assert.equal(sim.finishReason, 'program-ended');
});

test('while a row runs: the running card and its number card are lit, with "which time of how many"', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: program('L F3') });
  sim.start();
  const seen: string[] = [];
  while (sim.status === 'running') {
    sim.step(1);
    const ids = sim.vm.activeBlockIds().join('+');
    const v = sim.vm.variables();
    const line = ids === '' ? 'done' : `${ids} move ${v.move} of ${v.moves}, ${v.nth} of ${v.times}`;
    if (seen[seen.length - 1] !== line) seen.push(line);
  }
  assert.deepEqual(seen, [
    'card-0 move 1 of 4, 1 of 1',
    'card-1+card-2 move 2 of 4, 1 of 3',
    'card-1+card-2 move 3 of 4, 2 of 3',
    'card-1+card-2 move 4 of 4, 3 of 3',
    'done',
  ]);
  assert.deepEqual(sim.vm.activeBlockIds(), []);
  assert.deepEqual(sim.vm.variables(), {});
  assert.deepEqual(sim.vm.errors(), []);
});

test('an empty row ends at 0.01 s; 70 turns end by themselves at 118.6 s; a 71st turn could not run: the clock ends the match at 120 s', () => {
  const empty = playFireCadet(cardRowProgram([]), parkedMap());
  assert.equal(empty.finishReason, 'program-ended');
  assert.equal(empty.time, 0.01);
  const seventy = 'R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5 R5';
  const r70 = playFireCadet(program(seventy), parkedMap());
  assert.equal(r70.finishReason, 'program-ended');
  assert.ok(Math.abs(r70.time - 118.6) < 1e-9);
  // one turn more (29 cards, 71 turns): the clock ends the match before the row is done
  const turns71 = playFireCadet(program(`${seventy} R`), parkedMap());
  assert.equal(expand(row(`${seventy} R`)).length, 71);
  assert.equal(turns71.finishReason, 'time');
  assert.equal(turns71.time, FIRE_CADET.MATCH_SECONDS);
});

/** Drive the direction panel: taps as [time in s, button]; each tap holds the button 3 ticks (the screen does so). */
function tapPanel(scenario: FireCadetScenario, taps: [number, ButtonName][], until: number): { sim: Simulation<FireCadetScenario>; starts: number[] } {
  const sim = createSimulation({ game: fireCadetGame, scenario, program: panelProgram() });
  sim.start();
  const pending = [...taps];
  const release: [number, ButtonName][] = [];
  const starts: number[] = [];
  let moves = 0;
  while (sim.status === 'running' && sim.world.time < until - 1e-9) {
    while (pending.length > 0 && sim.world.time >= pending[0][0] - 1e-9) {
      const [, button] = pending.shift() as [number, ButtonName];
      sim.setButton(button, true);
      release.push([sim.world.tick + 3, button]);
    }
    while (release.length > 0 && sim.world.tick >= release[0][0]) sim.setButton((release.shift() as [number, ButtonName])[1], false);
    sim.step(1);
    const m = Number(sim.vm.variables().moves);
    if (m > moves) {
      starts.push(Math.round(sim.world.time * 100) / 100);
      moves = m;
    }
  }
  return { sim, starts };
}

const at = (sim: Simulation<FireCadetScenario>): string => {
  const p = sim.world.robot.pose;
  return `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000},${Math.round((p.heading * 180) / Math.PI)}`;
};
const spotText = (name: string, heading = 0): string => {
  const p = spot(sq(name));
  return `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000},${heading}`;
};

test('the direction panel (Mini): one tap, one whole move; a tap during a move is kept, the newest only (N7, P/p9-panel.out 2a-2g)', () => {
  const map = parkedMap({ cat: sq('D5') });
  // 2a: one tap: one move, one square
  let r = tapPanel(map, [[0, 'up']], 5);
  assert.deepEqual(r.starts, [0.01]);
  assert.equal(at(r.sim), spotText('D6'));
  assert.equal(r.sim.status, 'running', 'the panel never ends the match by itself');
  // 2b: a second tap during the move is kept and runs after the rest
  r = tapPanel(map, [[0, 'up'], [0.5, 'up']], 6);
  assert.deepEqual(r.starts, [0.01, 2.01]);
  assert.equal(at(r.sim), spotText('D5'));
  // 2c: Turn left, then Turn right tapped during the move: the newest wins
  r = tapPanel(map, [[0, 'up'], [0.5, 'left'], [1.0, 'right']], 6);
  assert.deepEqual(r.starts, [0.01, 2.01]);
  assert.equal(at(r.sim), spotText('D6', 90));
  // 2d: three quick taps: two moves, not three
  r = tapPanel(map, [[0, 'up'], [0.2, 'up'], [0.4, 'up']], 8);
  assert.deepEqual(r.starts, [0.01, 2.01]);
  assert.equal(at(r.sim), spotText('D5'));
  // 2e: a tap in the rest between two moves runs at the end of the rest
  r = tapPanel(map, [[0, 'up'], [1.8, 'up']], 6);
  assert.deepEqual(r.starts, [0.01, 2.01]);
  // 2f: nothing tapped: the match runs to the end of the time
  r = tapPanel(map, [], 200);
  assert.equal(r.sim.finishReason, 'time');
  assert.equal(r.sim.world.time, FIRE_CADET.MATCH_SECONDS);
  assert.equal(at(r.sim), spotText('D7'));
  // 2g: three Forward taps as fast as it goes: the Cat goes into the Safe Zone
  r = tapPanel(map, [[0, 'up'], [0.5, 'up'], [2.5, 'up']], 8);
  assert.deepEqual(r.starts, [0.01, 2.01, 4.01]);
  assert.equal(at(r.sim), spotText('D4'));
  assert.equal(r.sim.score().total, 5);
});

test('the panel lights the running move, and a kept tap with its own mark', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: panelProgram() });
  sim.start();
  sim.setButton('up', true);
  sim.step(3);
  sim.setButton('up', false);
  assert.deepEqual(sim.vm.activeBlockIds(), ['panel-forward']);
  sim.setButton('right', true);
  sim.step(3);
  sim.setButton('right', false);
  assert.deepEqual(sim.vm.activeBlockIds(), ['panel-forward', 'panel-next-right']);
  // holding a card down does nothing more: pressed again and held for 6 s, it is one tap
  sim.setButton('right', true);
  sim.step(600);
  assert.deepEqual(sim.vm.variables(), { moves: 2 });
  assert.equal(at(sim), `${Math.round(D * 1000) / 1000},${Math.round(spot(sq('D6')).y * 1000) / 1000},90`);
});

test('createFireCadetVM: the panel for a panel program, a row of cards for anything else', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: panelProgram() });
  assert.equal(sim.vm.idle, false, 'the panel is never idle');
  for (const p of [cardRowProgram([]), {}, { format: 'something else' }, { blocks: {} }]) {
    const s = createSimulation({ game: fireCadetGame, scenario: parkedMap(), program: p });
    s.start();
    assert.equal(s.vm.idle, true, JSON.stringify(p));
  }
  assert.equal(fireCadetGame.createVM, createFireCadetVM);
  // the interpreters with other times (for tests): the game with those times uses them
  const quick: CardTimes = { MOVE_SECONDS: 0.8, TURN_SECONDS: 0.65, REST_SECONDS: 0.2, RAMP_SECONDS: 0.1 };
  const r = playFireCadet(program('F R F'), parkedMap(), { times: quick });
  assert.equal(Math.round(r.time * 100), rowTicks(row('F R F'), quick));
  assert.ok(fireCadetGameWith(quick).robotConfig?.maxRpm === 2 * MTINY_ROBOT.maxRpm);
  // the two interpreters can also be made directly
  assert.equal(typeof createCardVM, 'function');
  assert.equal(typeof createPanelVM, 'function');
});

test('cardRowProgram: the program format of design 4.1', () => {
  const cards: CardName[] = row('F3 B');
  assert.deepEqual(cardRowProgram(cards, 'P1'), { format: 'mtiny-cards', version: 1, cards, field: 'P1' });
  assert.deepEqual(cardRowProgram(cards), { format: 'mtiny-cards', version: 1, cards });
  assert.deepEqual(panelProgram(), { format: 'mtiny-panel', version: 1 });
  assert.deepEqual(readCards(cardRowProgram(cards, 'P1')), cards);
});
