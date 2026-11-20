/**
 * The combinations of Fire Rescue Junior (./scenario.ts): the 24 ways to put the four buckets on
 * W1 to W4, with everything else where the rule book shows it - and nothing that moves a person.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../core/geometry';
import { BUILDING_IDS, WATER_TOWER_IDS } from '../fire-rescue/field';
import {
  COLOR_PERMUTATIONS,
  SCENARIO_COUNT,
  defaultScenario,
  encodeScenario,
  isValidScenario,
  scenarioFromIndex,
  withBucket,
  withPersonColor,
  withPersonSlot,
} from '../fire-rescue/scenario';
import {
  JUNIOR_SCENARIO_COUNT,
  allJuniorScenarios,
  decodeJuniorScenario,
  describeJuniorScenario,
  encodeJuniorScenario,
  isJuniorScenario,
  juniorScenarioFromIndex,
  juniorScenarioIndex,
  juniorScenarioProblems,
  randomJuniorScenario,
  repeatedBucketColors,
  rulebookPeople,
} from './scenario';

test('Junior: exactly 24 combinations, all different, all valid, numbered 0 to 23', () => {
  assert.equal(JUNIOR_SCENARIO_COUNT, 24);
  const all = allJuniorScenarios();
  assert.equal(all.length, 24);
  assert.equal(new Set(all.map(encodeJuniorScenario)).size, 24);
  // (and as Fire Rescue combinations they are 24 different ones too)
  assert.equal(new Set(all.map(encodeScenario)).size, 24);
  all.forEach((s, i) => {
    assert.ok(isValidScenario(s), `combination ${i}`);
    assert.ok(isJuniorScenario(s), `combination ${i}`);
    assert.equal(juniorScenarioIndex(s), i);
    assert.deepEqual(juniorScenarioFromIndex(i), s);
    assert.deepEqual(juniorScenarioProblems(s), []);
  });
  // every bucket arrangement is there once
  assert.deepEqual(
    all.map((s) => WATER_TOWER_IDS.map((w) => s.buckets[w])),
    COLOR_PERMUTATIONS,
  );
  // the rule book's arrangement is the first one, and it is Fire Rescue's default combination
  assert.deepEqual(all[0], defaultScenario());
  assert.equal(encodeJuniorScenario(defaultScenario()), 'RGBY');
  // a number outside 0..23 goes round
  assert.deepEqual(juniorScenarioFromIndex(24), all[0]);
  assert.deepEqual(juniorScenarioFromIndex(-1), all[23]);
});

test('Junior: only the buckets differ from the rule book - every person stands where it shows them', () => {
  const book = defaultScenario();
  assert.deepEqual(rulebookPeople(), book.people);
  // (the rule book: everybody in square 1, the person of each building has its colour)
  assert.deepEqual(
    BUILDING_IDS.map((b) => `${b}${book.people[b].slot}${book.people[b].color}`),
    ['A1red', 'B1blue', 'C1yellow', 'D1green'],
  );
  for (const s of allJuniorScenarios()) {
    assert.deepEqual(s.people, book.people, encodeJuniorScenario(s));
    // a fresh object every time: changing one combination changes no other one
    assert.notEqual(s.people, book.people);
  }
  // rulebookPeople() gives a fresh copy too
  const people = rulebookPeople();
  people.A = { slot: 2, color: 'green' };
  assert.deepEqual(rulebookPeople().A, { slot: 1, color: 'red' });
});

test('Junior: random draws give each of the 24 combinations, and never one that moves a person', () => {
  const seen = new Set<string>();
  for (const seed of [1, 2, 3, 7, 42]) {
    const rng = makeRng(seed);
    for (let i = 0; i < 400; i++) {
      const s = randomJuniorScenario(rng);
      assert.ok(isJuniorScenario(s));
      assert.deepEqual(s.people, defaultScenario().people);
      seen.add(encodeJuniorScenario(s));
    }
  }
  assert.equal(seen.size, 24);
  // the edges of the random numbers
  assert.deepEqual(randomJuniorScenario(() => 0), juniorScenarioFromIndex(0));
  assert.deepEqual(randomJuniorScenario(() => 0.999999), juniorScenarioFromIndex(23));
  // Math.random as the screen uses it
  for (let i = 0; i < 200; i++) assert.ok(isJuniorScenario(randomJuniorScenario(Math.random)));
});

test('Junior: codes round-trip and are forgiving about letter case and separators', () => {
  for (const s of allJuniorScenarios()) {
    const code = encodeJuniorScenario(s);
    assert.match(code, /^[RGBY]{4}$/);
    assert.deepEqual(decodeJuniorScenario(code), s);
    assert.deepEqual(decodeJuniorScenario(code.toLowerCase()), s);
    assert.deepEqual(decodeJuniorScenario(` ${code.split('').join('-')} `), s);
    assert.deepEqual(decodeJuniorScenario(code.split('').join(' ')), s);
  }
  assert.deepEqual(decodeJuniorScenario('gryb'), juniorScenarioFromIndex(7));
  // a colour twice, a missing colour, the wrong length, other letters: no code
  for (const text of ['RRBY', 'RGB', 'RGBYY', 'RGBX', 'hello', '', '   ', 'R G B']) assert.equal(decodeJuniorScenario(text), null, text);
  // which colour is there more than once, and how many times (the code field says it in words)
  assert.deepEqual(repeatedBucketColors('RRBY'), [{ color: 'red', times: 2 }]);
  assert.deepEqual(repeatedBucketColors('rrbb'), [
    { color: 'red', times: 2 },
    { color: 'blue', times: 2 },
  ]);
  assert.deepEqual(repeatedBucketColors('RRRB'), [{ color: 'red', times: 3 }]);
  assert.deepEqual(repeatedBucketColors('y-y-g-y'), [{ color: 'yellow', times: 3 }]);
  assert.deepEqual(repeatedBucketColors('RRRR'), [{ color: 'red', times: 4 }]);
  assert.equal(repeatedBucketColors('RGBY'), null);
  assert.equal(repeatedBucketColors('RGB'), null);
});

test('Junior: a Fire Rescue Senior code is never a Junior code - not even one whose people stand as in the rule book', () => {
  // every Senior combination, as its code and as its number
  for (let i = 0; i < SCENARIO_COUNT; i += 7) {
    const senior = scenarioFromIndex(i);
    assert.equal(decodeJuniorScenario(encodeScenario(senior)), null, encodeScenario(senior));
    assert.equal(decodeJuniorScenario(String(i)), null, String(i));
  }
  // the 24 Senior codes of the Junior combinations themselves are refused too
  for (const s of allJuniorScenarios()) assert.equal(decodeJuniorScenario(encodeScenario(s)), null, encodeScenario(s));
  assert.equal(decodeJuniorScenario('RGBY-A1R-B1B-C1Y-D1G'), null);
  assert.equal(decodeJuniorScenario('RGBY-A2R-B1B-C1Y-D1G'), null);
  // numbers are no Junior codes: 0 to 23 would mean another combination in Senior
  for (const n of ['0', '5', '23', '24', '9215']) assert.equal(decodeJuniorScenario(n), null, n);
});

test('Junior: a combination that moves a person is no Junior combination', () => {
  const book = defaultScenario();
  const moved = [
    withPersonSlot(book, 'A', 2),
    withPersonSlot(book, 'D', 2),
    withPersonColor(book, 'A', 'green'),
    withPersonColor(book, 'C', 'blue'),
  ];
  for (const s of moved) {
    assert.ok(isValidScenario(s));
    assert.equal(isJuniorScenario(s), false, encodeScenario(s));
    assert.equal(juniorScenarioIndex(s), -1);
    assert.deepEqual(juniorScenarioProblems(s), ['In Fire Rescue Junior only the buckets are drawn: every person stands where the rule book shows it.']);
  }
  // only 24 of the 9216 Fire Rescue combinations are Junior combinations
  let junior = 0;
  for (let i = 0; i < SCENARIO_COUNT; i++) if (isJuniorScenario(scenarioFromIndex(i))) junior++;
  assert.equal(junior, 24);
  // a broken combination (a colour twice) is none either
  const broken = { buckets: { ...book.buckets, W2: 'red' as const }, people: book.people };
  assert.equal(isJuniorScenario(broken), false);
  assert.deepEqual(juniorScenarioProblems(broken), ['This is not a Fire Rescue combination: every colour must be there once.']);
});

test('Junior: changing a bucket in the editor keeps a Junior combination', () => {
  let s = defaultScenario();
  for (const [tower, color] of [['W1', 'yellow'], ['W3', 'red'], ['W2', 'blue'], ['W4', 'green']] as const) {
    s = withBucket(s, tower, color);
    assert.equal(s.buckets[tower], color);
    assert.ok(isJuniorScenario(s), encodeJuniorScenario(s));
  }
});

test('Junior: the description names the buckets and says that the people stand as in the rule book', () => {
  assert.equal(
    describeJuniorScenario(juniorScenarioFromIndex(7)),
    'Buckets: W1 green, W2 red, W3 yellow, W4 blue. People (as in the rule book): A1 red, B1 blue, C1 yellow, D1 green.',
  );
});
