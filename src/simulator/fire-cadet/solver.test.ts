/**
 * Fire Cadet: the solver of the own-map editor (solver.ts, design 5.4, N18) and the own-setup
 * survey of the design, again on the site's code.
 *
 * The survey: the 3,000 random own setups of the design (seed 2027, drawn as P/rev2/survey-rev2.mts
 * drew them, the rules of 5.4). The solver finds no row for 18 of them and a row inside 120 s for
 * 2,925. Every row it finds for the first 300 setups is played in the engine, through the referee
 * of lead decisions D1 and D5, and must score all 25 points at exactly the planned time; so must
 * the rows of 150 other random own maps (seed 7), with no obstacle touched by the robot or by an
 * item: a row found for 25 points never relies on pushing an item into an obstacle. (All rows in
 * the engine take minutes: that run is a probe, not part of test:sim - PROBE below. Before D5 it
 * was run on 19 November with the referee of D1: 2,925 of 2,925 scored 25 at the planned time; two
 * of them end exactly at 120.00 s, by the clock - see the last test.)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cardRowProgram, cardsFromText, cardsToText, expand, rowSeconds, rowTicks, type MoveCard } from './cards';
import { FIRE_CADET, ticks } from './numbers';
import { playFireCadet } from './play';
import { PRACTICE_MAPS, decodeScenario, hyphenated, type FireCadetScenario } from './scenario';
import { compressMoves, findRowForAllPoints, solve } from './solver';
import { itemOnMarkedPlace, ownSetups } from './test-helpers';

const MATCH_TICKS = ticks(FIRE_CADET.MATCH_SECONDS);

test('compressMoves: a run of equal moves becomes a move card and a number card, five at most', () => {
  const run = (n: number, move: MoveCard = 'forward'): MoveCard[] => Array.from({ length: n }, () => move);
  assert.equal(cardsToText(compressMoves(run(1))), 'F');
  assert.equal(cardsToText(compressMoves(run(5))), 'F5');
  assert.equal(cardsToText(compressMoves(run(6))), 'F5 F');
  assert.equal(cardsToText(compressMoves(run(7))), 'F5 F2');
  assert.equal(cardsToText(compressMoves(run(11))), 'F5 F5 F');
  assert.equal(cardsToText(compressMoves([...run(2), ...run(2, 'right'), 'backward'])), 'F2 R2 B');
  for (const n of [1, 2, 6, 10, 13]) assert.equal(expand(compressMoves(run(n))).length, n);
});

test('practice map 1: the solver finds 27 moves, 52.1 s, and its row scores 25 in the engine at that time', () => {
  const row = solve(PRACTICE_MAPS[0]);
  assert.ok(row);
  assert.equal(row.moves.length, 27);
  assert.equal(row.seconds, 52.1);
  assert.equal(row.ticks, rowTicks(row.cards));
  assert.equal(row.seconds, rowSeconds(row.cards));
  assert.equal(expand(row.cards).length, 27);
  assert.deepEqual(new Set(row.order), new Set(['cat', 'person', 'water', 'equipment']));
  // (among rows of the same time it may pick another one than the proof row of the design)
  const result = playFireCadet(cardRowProgram(row.cards), PRACTICE_MAPS[0]);
  assert.equal(result.total, 25);
  assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), row.ticks);
  assert.deepEqual(findRowForAllPoints(PRACTICE_MAPS[0]), { found: true, moves: 27, seconds: 52.1 });
});

/** The survey, worked out once for the tests below. */
let surveyRows: ReturnType<typeof solve>[] | null = null;
const SETUPS = ownSetups(3000, 2027);
const survey = (): ReturnType<typeof solve>[] => (surveyRows ??= SETUPS.map((s) => solve(s)));

test('a map the solver finds no row for, and the longest shortest row of the survey', () => {
  // the first of the 18 setups of the survey without a row: the Fire is at the School, and both
  // squares next to the School (A2 and B1) hold an obstacle, so the Water can never get there
  const none = decodeScenario('S-B6-B4-E1-C1-A2-B1-F7') as FireCadetScenario;
  assert.ok(none);
  assert.equal(solve(none), null);
  assert.deepEqual(findRowForAllPoints(none), { found: false });
  // the longest shortest row of the survey takes 140.5 s: found, but not inside the match
  const longest = survey().reduce((a, b) => ((b?.ticks ?? 0) > (a?.ticks ?? 0) ? b : a));
  assert.ok(longest && longest.seconds === 140.5);
  const setup = SETUPS[survey().indexOf(longest)];
  assert.deepEqual(findRowForAllPoints(setup), { found: false });
});

test('the survey of design 5.4: 3,000 own setups, no row for 18, a row inside 120 s for 2,925', () => {
  assert.equal(SETUPS.filter(itemOnMarkedPlace).length, 1095);
  const rows = survey();
  const found = rows.filter((r) => r !== null);
  assert.equal(rows.length - found.length, 18);
  const within = found.filter((r) => r.ticks <= MATCH_TICKS);
  assert.equal(within.length, 2925);
  assert.equal(found.length - within.length, 57);
  const seconds = found.map((r) => r.seconds).sort((a, b) => a - b);
  const q = (f: number): number => seconds[Math.floor(f * (seconds.length - 1))];
  assert.deepEqual([q(0), q(0.1), q(0.5), q(0.9), q(1)], [51.5, 76.6, 92, 108.6, 140.5]);
  const cards = found.map((r) => r.cards.length).sort((a, b) => a - b);
  assert.deepEqual([cards[0], cards[cards.length >> 1], cards[cards.length - 1]], [21, 36, 60]);
  // 1,034 of the 2,925 have an item on a marked place
  assert.equal(SETUPS.filter((s, i) => (rows[i]?.ticks ?? Infinity) <= MATCH_TICKS && itemOnMarkedPlace(s)).length, 1034);
  // the numbers the README gives for the 2,925 rows inside 120 s - of those rows, not of all 2,982 found
  const inside = within.map((r) => r.seconds).sort((a, b) => a - b);
  const nineInTen = inside[Math.ceil(0.9 * inside.length) - 1];
  const insideCards = within.map((r) => r.cards.length).sort((a, b) => a - b);
  assert.deepEqual([inside[0], inside[Math.ceil(0.5 * inside.length) - 1], nineInTen, inside[inside.length - 1]], [51.5, 92, 107.4, 120]);
  assert.deepEqual([insideCards[0], insideCards[Math.ceil(0.5 * insideCards.length) - 1], insideCards[insideCards.length - 1]], [21, 36, 54]);
  const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  assert.ok(
    readme.includes(
      '18 have no row; 57 have one only over 120 s; 2,925 have one inside 120 s (shortest 51.5 s, middle 92.0 s, nine in ten under 107.4 s, longest 120.0 s; 21 to 54 cards, middle 36)',
    ),
    'the README gives the numbers of the 2,925 rows',
  );
});

test('every row the solver finds for the first 300 setups of the survey scores 25 in the engine, at exactly its time', () => {
  let played = 0;
  let onMarked = 0;
  for (let i = 0; i < 300; i++) {
    const s = SETUPS[i];
    const row = survey()[i];
    if (row === null || row.ticks > MATCH_TICKS) continue;
    played++;
    if (itemOnMarkedPlace(s)) onMarked++;
    const result = playFireCadet(cardRowProgram(row.cards), s);
    const what = `${hyphenated(s)}: ${cardsToText(row.cards)}`;
    assert.equal(result.total, 25, what);
    assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), row.ticks, what);
    assert.equal(result.finishReason, row.ticks < MATCH_TICKS ? 'program-ended' : 'time', what);
    assert.ok(result.lines.every((line) => line.ok), what);
  }
  assert.ok(played >= 290, `${played} rows played`);
  assert.ok(onMarked >= 20, `${onMarked} with an item on a marked place`);
});

/*
 * PROBE, run on this code on 20 November with the referee of D5 (not part of test:sim: about four
 * minutes for each set): every row the solver finds inside 120 s, played tick by tick in the
 * engine, as the test below plays them.
 *   - the 3,000 setups of the survey (seed 2027): 2,925 rows, 2,925 scored 25 at exactly their time;
 *   - 3,000 other random own maps (seed 7): 2,988 with a row, 2,912 inside 120 s, 2,912 scored 25
 *     at exactly their time.
 * In none of the 5,837 matches was an obstacle touched or lifted. Measured by the referee's own
 * test of a touch (core/geometry.ts obbTouches with a growing margin), an item never came nearer
 * than 46.38 mm to an obstacle, the robot (body and sticks) never nearer than 40.32 mm; the referee
 * counts a touch at 0.5 mm (TOUCH_MM).
 */

test('D5: a row the solver finds never touches an obstacle, with the robot or an item - 150 other random own maps, every row inside 120 s scores 25 in the engine', () => {
  const setups = ownSetups(150, 7);
  let played = 0;
  for (const s of setups) {
    const row = solve(s);
    if (row === null || row.ticks > MATCH_TICKS) continue;
    played++;
    const result = playFireCadet(cardRowProgram(row.cards), s);
    const what = `${hyphenated(s)}: ${cardsToText(row.cards)}`;
    // an obstacle touched by an item the robot pushes costs 1 point (D5): 25 means none was touched
    assert.equal(result.total, 25, what);
    assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), row.ticks, what);
    const obstacles = result.lines.find((line) => line.id === 'obstacles');
    assert.deepEqual([obstacles?.points, obstacles?.ok, obstacles?.detail], [0, true, 'No obstacle touched.'], what);
  }
  assert.ok(played >= 140, `${played} rows played`);
});

test('E12: a row that ends at exactly 120.00 s - the match ends by the clock at that tick, and the last look still counts', () => {
  // setup 332 of the survey: its shortest row takes exactly 12,000 ticks
  const s = decodeScenario('F-A7-B4-E2-G1-E5-A4-B1') as FireCadetScenario;
  const row = solve(s);
  assert.ok(row);
  assert.equal(row.ticks, MATCH_TICKS);
  assert.equal(cardsToText(row.cards), cardsToText(cardsFromText(cardsToText(row.cards))));
  const result = playFireCadet(cardRowProgram(row.cards), s);
  assert.equal(result.finishReason, 'time');
  assert.equal(result.time, FIRE_CADET.MATCH_SECONDS);
  assert.equal(result.total, 25, 'every delivery and the return bonus, judged at 120.00 s');
});
