/**
 * Fire Cadet: the eight practice maps (scenario.ts PRACTICE_MAPS, design 5.3), proved in the engine.
 *
 * The proof rows are written HERE ONLY: the files the browser gets never hold a row that scores
 * all 25 points (design 5.5, the note for the lead). Each is the shortest row the design's solver
 * found; this file plays it through the whole chain - the card interpreter, the engine with the
 * two sticks, the referee of lead decisions D1 and D5 - and checks the table of 5.3 number for number.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { cardRowProgram, cardsFromText, expand, rowSeconds, rowTicks } from './cards';
import { isRoadSquare } from './field';
import { FIRE_CADET, spot, ticks, type CardTimes } from './numbers';
import { playFireCadet } from './play';
import { PRACTICE_MAPS, decodeScenario, describeScenario, encodeScenario, hyphenated, squareName, type FireCadetScenario } from './scenario';
import { solve } from './solver';
import { watchMatch } from './test-helpers';

/** Design 5.3, the table and the proof rows. */
const TABLE = [
  { code: 'S-A6-D5-C5-C7-E3-F5-F7', row: 'F3 B L F3 L F R2 F5 B5 B R F3', cards: 18, moves: 27, turns: 5, seconds: 52.1, free: 52.1 },
  { code: 'B-B6-E5-B4-F7-C2-D3-E2', row: 'L B R F3 L F4 L F2 L F5 F L F B2 L F3', cards: 22, moves: 29, turns: 7, seconds: 55.5, free: 55.5 },
  { code: 'H-B7-C5-E3-D6-C2-E2-B4', row: 'L F2 L2 F5 L F4 L F5 F L F2 L F3 L F L2 F3', cards: 26, moves: 36, turns: 10, seconds: 68.6, free: 68.6 },
  { code: 'S-B7-B3-C3-E6-B5-C4-E7', row: 'L F3 R F5 F B2 R F L F R F2 R F2 B R F3 L F3 L F4 L2 F L F', cards: 34, moves: 42, turns: 12, seconds: 80.0, free: 74.3 },
  { code: 'F-A7-E6-C3-F2-D5-E3-B4', row: 'L B R F3 L F R F L F3 L F4 L F5 F L F5 F L F L F5 F R F2', cards: 32, moves: 45, turns: 11, seconds: 86.3, free: 84.6 },
  { code: 'B-A6-C6-F2-A7-G4-F5-B5', row: 'L F R F3 R F3 L F2 L F5 L F4 L F5 F L F B2 L F5 F R2 F3', cards: 33, moves: 47, turns: 11, seconds: 90.3, free: 82.9 },
  { code: 'H-A7-F6-B2-B4-D5-C4-D3', row: 'L F3 R2 F5 F L F4 B3 L F R F2 L F2 B L B2 R F4 L F3 B L F R F3 L F2', cards: 40, moves: 51, turns: 13, seconds: 97.7, free: 88.6 },
  { code: 'F-B6-G6-E3-F2-D5-D3-G4', row: 'F R F3 R2 F R F2 L F2 B R F L2 F R F4 L F2 L F L F5 R F5 B R F5 F R F2', cards: 41, moves: 53, turns: 15, seconds: 101.1, free: 92.6 },
] as const;

const MATCH_TICKS = ticks(FIRE_CADET.MATCH_SECONDS);
const LATTICE = spot({ col: 0, row: 0 }).x;
const offLattice = (v: number): number => {
  const k = Math.round((v - LATTICE) / FIRE_CADET.GRID_PITCH);
  return Math.abs(v - (LATTICE + FIRE_CADET.GRID_PITCH * k));
};

test('there are eight practice maps, and each is the map of the table of design 5.3', () => {
  assert.equal(PRACTICE_MAPS.length, TABLE.length);
  PRACTICE_MAPS.forEach((s, n) => {
    assert.equal(hyphenated(s), TABLE[n].code, `P${n + 1}`);
    assert.equal(encodeScenario(s), `P${n + 1}`);
    assert.equal(decodeScenario(TABLE[n].code), s, 'its long code reads as the same map');
    assert.equal(decodeScenario(`p${n + 1}`), s);
  });
});

test('every practice map scores all 25 points with its proof row, at exactly the time of the table', () => {
  PRACTICE_MAPS.forEach((s, n) => {
    const t = TABLE[n];
    const cards = cardsFromText(t.row);
    const steps = expand(cards);
    assert.equal(cards.length, t.cards, `P${n + 1}: cards`);
    assert.equal(steps.length, t.moves, `P${n + 1}: moves`);
    assert.equal(steps.filter((st) => st.move === 'left' || st.move === 'right').length, t.turns, `P${n + 1}: turns`);
    assert.equal(rowSeconds(cards), t.seconds, `P${n + 1}: rowSeconds`);
    const result = playFireCadet(cardRowProgram(cards), s);
    assert.equal(result.finishReason, 'program-ended', `P${n + 1}`);
    assert.equal(result.total, 25, `P${n + 1}`);
    assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), rowTicks(cards), `P${n + 1}: the match ends at the tick of rowTicks`);
    assert.ok(Math.abs(result.time - t.seconds) < 1e-9, `P${n + 1}: ${result.time}`);
    assert.ok(result.complete);
    for (const line of result.lines) {
      if (line.id === 'obstacles') assert.equal(line.points, 0, `P${n + 1}: no obstacle touched`);
      else assert.equal(line.points, 5, `P${n + 1}: ${line.id}`);
    }
  });
});

test('on the proof rows the robot stands on a square after every card, the referee never says "wrong place", and nothing is lifted', () => {
  PRACTICE_MAPS.forEach((s, n) => {
    const watched = watchMatch(cardRowProgram(cardsFromText(TABLE[n].row)), s);
    // N24: an item pushed through a marked place is not "in a wrong place" (measured: 0 of 8)
    assert.deepEqual(
      watched.said.filter(([, text]) => /belongs/.test(text)),
      [],
      `P${n + 1}`,
    );
    for (const line of watched.sim.score().lines) assert.doesNotMatch(line.detail, /belongs/, `P${n + 1}: ${line.id}`);
    // only the four delivered items leave the field: no obstacle is touched
    assert.deepEqual(watched.gone.map(([, id]) => id).sort(), ['item:cat', 'item:equipment', 'item:person', 'item:water'], `P${n + 1}`);
    assert.deepEqual(watched.back, []);
    assert.equal(watched.stops.length, expand(cardsFromText(TABLE[n].row)).length, `P${n + 1}: one stop per move`);
    for (const [x, y] of watched.stops) assert.ok(offLattice(x) < 0.001 && offLattice(y) < 0.001, `P${n + 1}: ${x}, ${y}`);
  });
});

test('every obstacle of the practice maps stands on a road square (map report 3.2, class A or B)', () => {
  PRACTICE_MAPS.forEach((s, n) => {
    for (const o of s.obstacles) assert.ok(isRoadSquare(o), `P${n + 1}: ${squareName(o)}`);
  });
  // every Fire place twice, every Water square twice
  const count = (values: string[]): Record<string, number> => values.reduce<Record<string, number>>((c, v) => ({ ...c, [v]: (c[v] ?? 0) + 1 }), {});
  assert.deepEqual(count(PRACTICE_MAPS.map((s) => s.fire)), { school: 2, bakery: 2, house: 2, factory: 2 });
  assert.deepEqual(count(PRACTICE_MAPS.map((s) => squareName(s.water))), { A6: 2, B6: 2, B7: 2, A7: 2 });
  // map 6 starts the Equipment in the Water / Equipment Area
  assert.equal(squareName(PRACTICE_MAPS[5].equipment), 'A7');
});

test('the table of 5.3: the solver\'s shortest time is the time of the table, and without the obstacles the second number', () => {
  PRACTICE_MAPS.forEach((s, n) => {
    const row = solve(s);
    assert.ok(row, `P${n + 1}`);
    assert.equal(row.seconds, TABLE[n].seconds, `P${n + 1}`);
    assert.equal(row.moves.length, TABLE[n].moves, `P${n + 1}: moves`);
    // without the obstacles: put them off the map, where the solver never drives
    const free = solve({ ...s, obstacles: [{ col: -1, row: -1 }, { col: -1, row: -1 }, { col: -1, row: -1 }] });
    assert.ok(free);
    assert.equal(free.seconds, TABLE[n].free, `P${n + 1} without obstacles`);
  });
});

test('D5: the row of "Without the obstacles", played on the real map, never scores 25 - each obstacle it touches costs 1 point, also through an item - and the README says what it scores', () => {
  const off: FireCadetScenario['obstacles'] = [{ col: -1, row: -1 }, { col: -1, row: -1 }, { col: -1, row: -1 }];
  const measured = PRACTICE_MAPS.map((s, n) => {
    const free = solve({ ...s, obstacles: off });
    assert.ok(free, `P${n + 1}`);
    const result = playFireCadet(cardRowProgram(free.cards), s);
    const penalty = result.lines.find((line) => line.id === 'obstacles')?.points ?? 0;
    // every item delivered and the robot home: only the obstacles can cost points
    assert.ok(result.lines.every((line) => line.id === 'obstacles' || line.points === 5), `P${n + 1}`);
    assert.equal(result.total, 25 + penalty, `P${n + 1}`);
    assert.ok(Math.abs(result.time - TABLE[n].free) < 1e-9, `P${n + 1}: ${result.time}`);
    return result.total;
  });
  // maps 1 to 3: the obstacles stand beside the ways, the row is the proof row's time and touches none
  assert.deepEqual(measured, [25, 25, 25, 22, 24, 24, 22, 22]);
  for (let n = 3; n < 8; n++) assert.ok(TABLE[n].free < TABLE[n].seconds && measured[n] < 25, `P${n + 1}`);
  const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8').replace(/\s+/g, ' ');
  const sentence = (n: number): string => `${measured[n]} on map ${n + 1} (${n === 3 ? 'in ' : ''}${TABLE[n].free.toFixed(1)} s)`;
  assert.ok(
    readme.includes(`measured, it scores ${sentence(3)}, ${sentence(4)}, ${sentence(5)}, ${sentence(6)} and ${sentence(7)}, never the 25 of the proof row`),
    'the README gives what the rows of "Without the obstacles" score',
  );
  assert.ok(
    readme.includes(
      `the rows through the obstacles score ${measured[3]}, ${measured[4]} and ${measured[7]} points, in ${TABLE[3].free.toFixed(1)} s, ${TABLE[4].free.toFixed(1)} s and ${TABLE[7].free.toFixed(1)} s ` +
        `(the proof rows, which go round: 25 in ${TABLE[3].seconds.toFixed(1)} s, ${TABLE[4].seconds.toFixed(1)} s and ${TABLE[7].seconds.toFixed(1)} s)`,
    ),
    'Known limits gives the same numbers',
  );
});

test('easy to hard: the shortest times rise from P1 to P8', () => {
  for (let n = 1; n < TABLE.length; n++) assert.ok(TABLE[n].seconds > TABLE[n - 1].seconds);
  assert.deepEqual(
    PRACTICE_MAPS.map((s) => solve(s)?.seconds),
    TABLE.map((t) => t.seconds),
  );
});

test('the time margin: every proof row fits in the 120 s; map 8 leaves 18.9 s and falls out first when the card times grow', () => {
  for (const t of TABLE) assert.ok(rowTicks(cardsFromText(t.row)) <= MATCH_TICKS, t.code);
  assert.equal(Math.round((FIRE_CADET.MATCH_SECONDS - TABLE[7].seconds) * 10) / 10, 18.9);
  // With every card time multiplied by more than 120 / 101.1 (about 1.19), map 8 no longer fits;
  // the other seven still do. (When the organiser's real times are put into numbers.ts, the first
  // test of this file says which maps fall out.)
  const scaled = (k: number): CardTimes => ({
    MOVE_SECONDS: FIRE_CADET.MOVE_SECONDS * k,
    TURN_SECONDS: FIRE_CADET.TURN_SECONDS * k,
    REST_SECONDS: FIRE_CADET.REST_SECONDS * k,
    RAMP_SECONDS: FIRE_CADET.RAMP_SECONDS * k,
  });
  const fits = (k: number): boolean[] => TABLE.map((t) => rowTicks(cardsFromText(t.row), scaled(k)) <= MATCH_TICKS);
  assert.ok(Math.abs(FIRE_CADET.MATCH_SECONDS / TABLE[7].seconds - 1.187) < 0.001);
  assert.deepEqual(fits(1.18), [true, true, true, true, true, true, true, true]);
  assert.deepEqual(fits(1.19), [true, true, true, true, true, true, true, false]);
  // ... and in the engine, with the slower robot, the row of map 8 is cut off by the clock: the
  // match ends at 120 s, not by the end of the row. (It still scores 25 there: the last card has
  // brought the robot inside the Fire Station, and only its braking is cut off.)
  const slow = playFireCadet(cardRowProgram(cardsFromText(TABLE[7].row)), PRACTICE_MAPS[7], { times: scaled(1.19) });
  assert.equal(slow.finishReason, 'time');
  assert.equal(slow.time, FIRE_CADET.MATCH_SECONDS);
  assert.equal(slow.total, 25);
  // at 1.2 the cut comes earlier, before the robot is inside: no return bonus
  const slower = playFireCadet(cardRowProgram(cardsFromText(TABLE[7].row)), PRACTICE_MAPS[7], { times: scaled(1.2) });
  assert.equal(slower.finishReason, 'time');
  assert.equal(slower.total, 20);
});

test('practice, not official: a practice map is described as "Practice map n", and no text of the game calls a map official', () => {
  PRACTICE_MAPS.forEach((s, n) => assert.equal(describeScenario(s), `Practice map ${n + 1}`));
  const folder = path.dirname(fileURLToPath(import.meta.url));
  const files = readdirSync(folder).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'test-helpers.ts');
  assert.ok(files.length >= 8);
  for (const file of files) {
    // every string the game can show: the string literals and the text parts of template literals
    const source = ts.createSourceFile(file, readFileSync(path.join(folder, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const texts: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
      else if (ts.isTemplateExpression(node)) texts.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(texts.length > 0, file);
    for (const text of texts) {
      for (const m of text.matchAll(/official/gi)) {
        const at = m.index ?? 0;
        assert.match(text.slice(Math.max(0, at - 4), at + 8), /not official/i, `${file}: "${text}"`);
      }
    }
  }
});

test('the README\'s table of the practice maps gives the cards, moves, turns and times of the proof rows above, and says so', () => {
  const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8');
  TABLE.forEach((row, n) => {
    const line = readme.split('\n').find((l) => l.startsWith(`| P${n + 1} | \`${row.code}\` |`));
    assert.ok(line, `P${n + 1}`);
    const cells = line.split('|').map((c) => c.trim());
    // ... | Cards | Moves (turns) | Time | Without the obstacles |
    assert.deepEqual(cells.slice(-5, -1), [String(row.cards), `${row.moves} (${row.turns})`, `${row.seconds.toFixed(1)} s`, `${row.free.toFixed(1)} s`], `P${n + 1}`);
    assert.equal(cardsFromText(row.row).length, row.cards, `P${n + 1}: the proof row has that many cards`);
  });
  // the Cards column is the proof row's: the solver itself may put the same moves in another number of cards (map 6: 34)
  assert.match(readme, /"Cards", "Moves" and "Time" are those of the proof row of each map in `practice\.test\.ts`/);
  const six = solve(PRACTICE_MAPS[5]);
  assert.ok(six);
  assert.deepEqual([six.moves.length, six.seconds], [TABLE[5].moves, TABLE[5].seconds]);
  if (six.cards.length !== TABLE[5].cards) assert.match(readme, new RegExp(`on map 6 the solver itself lays the same ${TABLE[5].moves}\\s+moves and ${TABLE[5].seconds} s in ${six.cards.length} cards`));
});
