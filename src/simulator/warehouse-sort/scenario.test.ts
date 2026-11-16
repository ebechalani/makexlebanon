/**
 * Warehouse Sort arrangements: 14 of them, their codes, the random draw and the default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../core/geometry';
import { WAREHOUSE_IDS } from './field';
import { warehouseSortGame } from './game';
import {
  CUBE_COLORS,
  SCENARIO_COUNT,
  allScenarios,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  isValidScenario,
  randomScenario,
  scenarioFromIndex,
  scenarioIndex,
  scenarioOfCode,
  scenarioProblems,
  withCube,
  type WarehouseSortScenario,
} from './scenario';

test('arrangements: 14, each with at least one red and one green cube, all different', () => {
  assert.equal(SCENARIO_COUNT, 14);
  assert.equal(warehouseSortGame.scenarioCount(), 14);
  const all = allScenarios();
  assert.equal(all.length, 14);
  const codes = new Set(all.map(encodeScenario));
  assert.equal(codes.size, 14);
  for (const s of all) {
    const colors = WAREHOUSE_IDS.map((w) => s.cubes[w]);
    assert.ok(colors.includes('red') && colors.includes('green'), encodeScenario(s));
    assert.ok(colors.every((c) => CUBE_COLORS.includes(c)));
    assert.ok(isValidScenario(s));
    assert.deepEqual(scenarioProblems(s), []);
  }
  // 16 ways to colour four cubes, minus all red and all green
  assert.ok(!codes.has('RR-RR') && !codes.has('GG-GG'));
  // in number order: W1 W2 W3 W4 as a binary number (green = 1), minus one
  assert.equal(encodeScenario(all[0]), 'RR-RG');
  assert.equal(encodeScenario(all[13]), 'GG-GR');
});

test('arrangements: number and arrangement go both ways', () => {
  for (let n = 0; n < SCENARIO_COUNT; n++) assert.equal(scenarioIndex(scenarioFromIndex(n)), n);
  // other whole numbers wrap round
  assert.deepEqual(scenarioFromIndex(14), scenarioFromIndex(0));
  assert.deepEqual(scenarioFromIndex(-1), scenarioFromIndex(13));
  assert.equal(scenarioIndex({ cubes: { W1: 'red', W2: 'red', W3: 'red', W4: 'red' } }), -1);
});

test('codes: "RG-GR" reads the cubes as they lie on the mat, and every code comes back', () => {
  const s = defaultScenario();
  assert.equal(encodeScenario(s), 'RG-GR');
  assert.deepEqual(s.cubes, { W1: 'red', W2: 'green', W3: 'green', W4: 'red' });
  for (const one of allScenarios()) {
    const code = encodeScenario(one);
    assert.match(code, /^[RG]{2}-[RG]{2}$/);
    assert.deepEqual(decodeScenario(code), one);
    assert.deepEqual(warehouseSortGame.decodeScenario(warehouseSortGame.encodeScenario(one)), one);
    // its number is no code (see decodeScenario)
    assert.equal(decodeScenario(String(scenarioIndex(one))), null);
  }
  // letter case, spaces and dashes do not matter
  for (const typed of ['rg-gr', 'RGGR', ' r g g r ', 'Rg_Gr', 'RG/GR', 'ＲＧ－ＧＲ']) assert.deepEqual(decodeScenario(typed), s, typed);
});

test('codes: anything else is no arrangement - and nothing throws', () => {
  for (const bad of ['', 'RR-RR', 'GG-GG', 'RGG', 'RGGRR', 'RGBY', 'XX-XX', '0', '5', '13', '14', '-1', '1.5', 'twelve', 'R'.repeat(500)]) {
    assert.equal(decodeScenario(bad), null, JSON.stringify(bad));
  }
  assert.equal(decodeScenario(undefined as unknown as string), null);
  assert.equal(decodeScenario(42 as unknown as string), null);
  // an editor may read an arrangement that cannot be played
  assert.deepEqual(scenarioOfCode('RR-RR'), { cubes: { W1: 'red', W2: 'red', W3: 'red', W4: 'red' } });
  assert.equal(scenarioOfCode('RGB'), null);
  assert.deepEqual(scenarioProblems({ cubes: { W1: 'red', W2: 'red', W3: 'red', W4: 'red' } }), ['At least one cube must be green.']);
  assert.deepEqual(scenarioProblems({ cubes: { W1: 'green', W2: 'green', W3: 'green', W4: 'green' } }), ['At least one cube must be red.']);
  assert.deepEqual(scenarioProblems({ cubes: { W1: 'blue' } } as unknown as WarehouseSortScenario), ['Every warehouse needs a red or a green cube.']);
  assert.deepEqual(scenarioProblems(null as unknown as WarehouseSortScenario), ['Every warehouse needs a red or a green cube.']);
  assert.equal(warehouseSortGame.scenarioProblems?.(defaultScenario()).length, 0);
});

test('random draw: every arrangement, about equally often, and the same seed gives the same draw', () => {
  const rng = makeRng(7);
  const counts = new Map<string, number>();
  for (let i = 0; i < 14000; i++) {
    const code = encodeScenario(randomScenario(rng));
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  assert.equal(counts.size, 14);
  for (const [code, n] of counts) assert.ok(n > 850 && n < 1150, `${code}: ${n}`);
  const a = makeRng(3);
  const b = makeRng(3);
  for (let i = 0; i < 20; i++) assert.deepEqual(randomScenario(a), randomScenario(b));
  // a random source that returns 1 (or a little less) still gives an arrangement
  assert.ok(isValidScenario(randomScenario(() => 0.9999999999)));
});

test('default: a mix, two of each colour, one of each in every row and every column', () => {
  const s = defaultScenario();
  assert.deepEqual(warehouseSortGame.defaultScenario(), s);
  const row = (a: 'W1' | 'W3', b: 'W2' | 'W4') => new Set([s.cubes[a], s.cubes[b]]).size;
  assert.equal(row('W1', 'W2'), 2);
  assert.equal(row('W3', 'W4'), 2);
  assert.notEqual(s.cubes.W1, s.cubes.W3);
  assert.notEqual(s.cubes.W2, s.cubes.W4);
  // a fresh object every time: an editor may change it
  defaultScenario().cubes.W1 = 'green';
  assert.equal(defaultScenario().cubes.W1, 'red');
});

test('words and the editor: describe, change one cube', () => {
  assert.equal(describeScenario(defaultScenario()), 'Red: W1, W4. Green: W2, W3.');
  assert.equal(warehouseSortGame.describeScenario(scenarioFromIndex(0)), 'Red: W1, W2, W3. Green: W4.');
  const s = withCube(defaultScenario(), 'W1', 'green');
  assert.equal(encodeScenario(s), 'GG-GR');
  assert.equal(encodeScenario(defaultScenario()), 'RG-GR', 'the old arrangement was not changed');
  const allGreen = withCube(withCube(s, 'W4', 'green'), 'W4', 'green');
  assert.equal(isValidScenario(allGreen), false);
  assert.match(describeScenario(allGreen), /cannot be played.*At least one cube must be red/);
});
