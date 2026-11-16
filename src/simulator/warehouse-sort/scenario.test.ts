/**
 * Warehouse Sort arrangements: 24 of them - exactly one blue cube, the other three red or green
 * with at least one of each - their codes, the refusals, the random draw and the default.
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
  blueWarehouse,
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
  sortedWarehouses,
  withCube,
  type WarehouseSortScenario,
} from './scenario';

const colorsOf = (s: WarehouseSortScenario) => WAREHOUSE_IDS.map((w) => s.cubes[w]);

test('arrangements: 24, each with exactly one blue cube and at least one red and one green, all different', () => {
  assert.equal(SCENARIO_COUNT, 24);
  assert.equal(warehouseSortGame.scenarioCount(), 24);
  const all = allScenarios();
  assert.equal(all.length, 24);
  const codes = new Set(all.map(encodeScenario));
  assert.equal(codes.size, 24);
  for (const s of all) {
    const colors = colorsOf(s);
    assert.equal(colors.filter((c) => c === 'blue').length, 1, encodeScenario(s));
    assert.ok(colors.includes('red') && colors.includes('green'), encodeScenario(s));
    assert.ok(colors.every((c) => CUBE_COLORS.includes(c)));
    assert.ok(isValidScenario(s));
    assert.deepEqual(scenarioProblems(s), []);
    assert.equal(sortedWarehouses(s).length, 3);
    assert.ok(blueWarehouse(s) !== null && !sortedWarehouses(s).includes(blueWarehouse(s)!));
  }
  // 4 places for the blue cube x 6 colourings of the other three (8 minus all red and all green)
  for (const w of WAREHOUSE_IDS) assert.equal(all.filter((s) => blueWarehouse(s) === w).length, 6, w);
  // every colouring of four cubes with exactly one blue and both other colours: counted by brute force
  let count = 0;
  for (const a of CUBE_COLORS) for (const b of CUBE_COLORS) for (const c of CUBE_COLORS) for (const d of CUBE_COLORS) {
    const s = { cubes: { W1: a, W2: b, W3: c, W4: d } };
    if (isValidScenario(s)) {
      count++;
      assert.ok(codes.has(encodeScenario(s)), encodeScenario(s));
    }
  }
  assert.equal(count, 24);
  // in number order: the blue cube in W1 first; the other three as a binary number (green = 1), minus one
  assert.equal(encodeScenario(all[0]), 'BR-RG');
  assert.equal(encodeScenario(all[5]), 'BG-GR');
  assert.equal(encodeScenario(all[6]), 'RB-RG');
  assert.equal(encodeScenario(all[23]), 'GG-RB');
});

test('arrangements: number and arrangement go both ways', () => {
  for (let n = 0; n < SCENARIO_COUNT; n++) assert.equal(scenarioIndex(scenarioFromIndex(n)), n);
  // other whole numbers wrap round
  assert.deepEqual(scenarioFromIndex(24), scenarioFromIndex(0));
  assert.deepEqual(scenarioFromIndex(-1), scenarioFromIndex(23));
  // an arrangement that cannot be played has no number
  assert.equal(scenarioIndex({ cubes: { W1: 'red', W2: 'red', W3: 'green', W4: 'green' } }), -1);
  assert.equal(scenarioIndex({ cubes: { W1: 'blue', W2: 'blue', W3: 'red', W4: 'green' } }), -1);
  assert.equal(scenarioIndex({ cubes: { W1: 'blue', W2: 'red', W3: 'red', W4: 'red' } }), -1);
  // the key order of a new arrangement is W1 .. W4 (a saved arrangement reads the same)
  assert.deepEqual(Object.keys(scenarioFromIndex(13).cubes), WAREHOUSE_IDS);
});

test('codes: "GR-BR" reads the cubes as they lie on the mat, and every code comes back', () => {
  const s = defaultScenario();
  assert.equal(encodeScenario(s), 'GR-BR');
  assert.deepEqual(s.cubes, { W1: 'green', W2: 'red', W3: 'blue', W4: 'red' });
  for (const one of allScenarios()) {
    const code = encodeScenario(one);
    assert.match(code, /^[RGB]{2}-[RGB]{2}$/);
    assert.deepEqual(decodeScenario(code), one);
    assert.deepEqual(warehouseSortGame.decodeScenario(warehouseSortGame.encodeScenario(one)), one);
    // its number is no code (see decodeScenario)
    assert.equal(decodeScenario(String(scenarioIndex(one))), null);
  }
  // letter case, spaces and dashes do not matter
  for (const typed of ['gr-br', 'GRBR', ' g r b r ', 'Gr_Br', 'GR/BR', 'ＧＲ－ＢＲ']) assert.deepEqual(decodeScenario(typed), s, typed);
  assert.deepEqual(decodeScenario('RB-GR'), { cubes: { W1: 'red', W2: 'blue', W3: 'green', W4: 'red' } });
});

test('codes: no blue, two blues, no red or no green - refused, with a plain sentence that says why; nothing throws', () => {
  for (const bad of ['', 'RG-GR', 'RR-GG', 'BB-RG', 'BB-BB', 'BR-RR', 'BG-GG', 'RB-B', 'GRBRR', 'RGBY', 'XX-XX', '0', '5', '23', '24', '-1', '1.5', 'twelve', 'B'.repeat(500)]) {
    assert.equal(decodeScenario(bad), null, JSON.stringify(bad));
  }
  assert.equal(decodeScenario(undefined as unknown as string), null);
  assert.equal(decodeScenario(42 as unknown as string), null);
  // an editor may read an arrangement that cannot be played, and say what is wrong with it
  const problems = (code: string) => scenarioProblems(scenarioOfCode(code)!);
  assert.deepEqual(problems('RG-GR'), ['One cube must be blue.']);
  assert.deepEqual(problems('BB-RG'), ['There are 2 blue cubes. Only one cube may be blue.']);
  assert.deepEqual(problems('BR-RR'), ['At least one cube must be green.']);
  assert.deepEqual(problems('GG-BG'), ['At least one cube must be red.']);
  assert.deepEqual(problems('RR-RR'), ['One cube must be blue.', 'At least one cube must be green.']);
  assert.deepEqual(problems('BB-BB'), ['There are 4 blue cubes. Only one cube may be blue.', 'At least one cube must be red.', 'At least one cube must be green.']);
  assert.equal(scenarioOfCode('RGB'), null);
  assert.deepEqual(scenarioProblems({ cubes: { W1: 'yellow' } } as unknown as WarehouseSortScenario), ['Every warehouse needs a red, a green or a blue cube.']);
  assert.deepEqual(scenarioProblems(null as unknown as WarehouseSortScenario), ['Every warehouse needs a red, a green or a blue cube.']);
  assert.equal(warehouseSortGame.scenarioProblems?.(defaultScenario()).length, 0);
});

test('random draw: every arrangement, about equally often, and the same seed gives the same draw', () => {
  const rng = makeRng(7);
  const counts = new Map<string, number>();
  for (let i = 0; i < 24000; i++) {
    const code = encodeScenario(randomScenario(rng));
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  assert.equal(counts.size, 24);
  for (const [code, n] of counts) assert.ok(n > 850 && n < 1150, `${code}: ${n}`);
  const a = makeRng(3);
  const b = makeRng(3);
  for (let i = 0; i < 20; i++) assert.deepEqual(randomScenario(a), randomScenario(b));
  // a random source that returns 1 (or a little less) still gives an arrangement
  assert.ok(isValidScenario(randomScenario(() => 0.9999999999)));
  assert.ok(isValidScenario(randomScenario(() => 0)));
});

test('default: one blue cube, the rest mixed - each red or green cube on the side of its bay', () => {
  const s = defaultScenario();
  assert.deepEqual(warehouseSortGame.defaultScenario(), s);
  assert.ok(isValidScenario(s));
  assert.equal(blueWarehouse(s), 'W3');
  // the green bay is left of the middle, the red bay right of it (field.ts): the green cube on the left, the red ones on the right
  assert.equal(s.cubes.W1, 'green');
  assert.deepEqual([s.cubes.W2, s.cubes.W4], ['red', 'red']);
  // a fresh object every time: an editor may change it
  defaultScenario().cubes.W1 = 'red';
  assert.equal(defaultScenario().cubes.W1, 'green');
});

test('words and the editor: describe, change one cube', () => {
  assert.equal(describeScenario(defaultScenario()), 'Red: W2, W4. Green: W1. Blue: W3 (leave it).');
  assert.equal(warehouseSortGame.describeScenario(scenarioFromIndex(0)), 'Red: W2, W3. Green: W4. Blue: W1 (leave it).');
  const s = withCube(defaultScenario(), 'W1', 'red');
  assert.equal(encodeScenario(s), 'RR-BR');
  assert.equal(encodeScenario(defaultScenario()), 'GR-BR', 'the old arrangement was not changed');
  assert.equal(isValidScenario(s), false);
  assert.match(describeScenario(s), /cannot be played.*At least one cube must be green/);
  assert.match(describeScenario(withCube(defaultScenario(), 'W2', 'blue')), /cannot be played.*There are 2 blue cubes/);
});
