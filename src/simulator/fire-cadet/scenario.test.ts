/**
 * Fire Cadet maps: the code (design 5.2), the refusals and their sentences, the rules of an own
 * setup (5.4, N12), the count of maps, the default and the random map.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../core/geometry';
import {
  MAP_THINGS,
  PRACTICE_MAPS,
  SCENARIO_COUNT,
  countOwnSetups,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  hyphenated,
  parseSquare,
  placeProblem,
  practiceMapNumber,
  randomScenario,
  surpriseMap,
  readMapCode,
  scenarioProblems,
  squareName,
  squareOf,
  thingsOn,
  withThing,
  type FireCadetScenario,
} from './scenario';
import { ownSetups, sq } from './test-helpers';

const P1 = PRACTICE_MAPS[0];
const problem = (code: string): string => {
  const reading = readMapCode(code);
  assert.equal(reading.ok, false, `${code} should be refused`);
  return reading.ok ? '' : reading.problem;
};

test('squares: A1 is (0,0), D7 is (3,6), G7 is (6,6)', () => {
  assert.equal(squareName({ col: 0, row: 0 }), 'A1');
  assert.equal(squareName({ col: 3, row: 6 }), 'D7');
  assert.deepEqual(parseSquare('g7'), { col: 6, row: 6 });
  assert.equal(parseSquare('H1'), null);
  assert.equal(parseSquare('A8'), null);
  assert.equal(parseSquare('A0'), null);
});

test('the count of maps (design 5.2): 71,983,941,120; with nothing on a marked place 44,218,137,600', () => {
  assert.equal(SCENARIO_COUNT, 71_983_941_120);
  assert.equal(countOwnSetups(true), 71_983_941_120);
  // the rule of the first revision, as a check of the formula: 16 x P(40, 3) x P(37, 3)
  assert.equal(countOwnSetups(false), 16 * (40 * 39 * 38) * (37 * 36 * 35));
  assert.equal(countOwnSetups(false), 44_218_137_600);
});

test('the default map is practice map 1; "Surprise" gives each of the eight practice maps', () => {
  assert.equal(defaultScenario(), P1);
  assert.equal(encodeScenario(defaultScenario()), 'P1');
  const rng = makeRng(7);
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const s = randomScenario(rng);
    assert.ok(PRACTICE_MAPS.includes(s));
    seen.add(encodeScenario(s));
  }
  assert.equal(seen.size, 8);
  assert.equal(randomScenario(() => 0), PRACTICE_MAPS[0]);
  assert.equal(randomScenario(() => 0.999999), PRACTICE_MAPS[7]);
});

test('the Surprise button never gives the map that is on the stage: each of the other seven, and from an own map any of the eight', () => {
  const rng = makeRng(2027);
  PRACTICE_MAPS.forEach((current, k) => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = surpriseMap(rng, current);
      assert.ok(PRACTICE_MAPS.includes(s));
      assert.notEqual(s, current, `map ${k + 1}: Surprise gave the same map`);
      seen.add(encodeScenario(s));
    }
    assert.equal(seen.size, 7, `map ${k + 1}`);
  });
  // the same map read from its long code is that practice map
  assert.notEqual(surpriseMap(() => 0, P1), P1);
  assert.equal(surpriseMap(() => 0, P1), PRACTICE_MAPS[1]);
  assert.equal(surpriseMap(() => 0.999999, PRACTICE_MAPS[7]), PRACTICE_MAPS[6]);
  const own: FireCadetScenario = { ...P1, obstacles: [P1.obstacles[0], P1.obstacles[1], { col: 6, row: 1 }] };
  const fromOwn = new Set<string>();
  for (let i = 0; i < 400; i++) fromOwn.add(encodeScenario(surpriseMap(rng, own)));
  assert.equal(fromOwn.size, 8);
});

test('every map has exactly one code: P1 ... P8, or the long code; decoding gives the map back', () => {
  PRACTICE_MAPS.forEach((s, n) => {
    assert.equal(encodeScenario(s), `P${n + 1}`);
    assert.equal(decodeScenario(`P${n + 1}`), s);
    assert.equal(decodeScenario(hyphenated(s)), s, 'the long code of a practice map reads as that practice map');
    assert.equal(practiceMapNumber(s), n + 1);
  });
  const setups = ownSetups(10_000, 1);
  let own = 0;
  for (const s of setups) {
    assert.deepEqual(scenarioProblems(s), [], hyphenated(s));
    const code = encodeScenario(s);
    const back = decodeScenario(code) as FireCadetScenario;
    assert.notEqual(back, null, code);
    assert.equal(encodeScenario(back), code);
    assert.equal(hyphenated(back), hyphenated(s));
    if (practiceMapNumber(s) === null) own++;
  }
  assert.equal(own, 10_000);
});

test('reading a code ignores capitals, blanks, hyphens, dots and commas', () => {
  for (const code of ['sa6d5c5c7e3f5f7', ' S-A6-D5-C5-C7-E3-F5-F7 ', 'S.A6.D5.C5.C7.E3.F5.F7', 's, a6, d5, c5, c7, e3, f5, f7', 'S A6 D5 C5 C7 E3 F5 F7']) {
    assert.equal(decodeScenario(code), P1, code);
  }
  assert.equal(decodeScenario(' p3 '), PRACTICE_MAPS[2]);
  assert.equal(decodeScenario('p-3'), PRACTICE_MAPS[2]);
  const own = 'B-B6-E5-B4-F7-C2-D3-E3';
  assert.equal(encodeScenario(decodeScenario(own.toLowerCase().replace(/-/g, ' ')) as FireCadetScenario), own);
});

test('every refusal of design 5.2 gives its one sentence', () => {
  const notACode = 'This is not a map code. A code looks like P3 or like S-A6-D5-C5-C7-E3-F5-F7.';
  for (const junk of ['', 'hello', 'P', 'X-A6-D5-C5-C7-E3-F5-F7', 'S-A6-D5-C5-C7-E3-F5', 'S-A6-D5-C5-C7-E3-F5-F7-G1', 'S-A6-D5-C5-C7-E3-F5-H7', 'S-A6-D5-C5-C7-E3-F5-F8', 'P3a']) {
    assert.equal(problem(junk), notACode, junk);
  }
  for (const p of ['P0', 'P9', 'P12', 'P03']) assert.equal(problem(p), 'There are 8 practice maps: P1 to P8.', p);
  assert.equal(problem('S-C6-D5-C5-C7-E3-F5-F7'), 'The Water starts on A6, B6, A7 or B7.');
  assert.equal(problem('S-A6-D7-C5-C7-E3-F5-F7'), 'Nothing can stand on D7: the robot starts there.');
  assert.equal(problem('S-A6-D5-C5-D7-E3-F5-F7'), 'Nothing can stand on D7: the robot starts there.', 'the Equipment on D7 (its own target)');
  assert.equal(problem('S-A6-D5-C5-C7-D7-F5-F7'), 'Nothing can stand on D7: the robot starts there.');
  assert.equal(problem('S-A6-D4-C5-C7-E3-F5-F7'), 'The Cat cannot start on D4: that is the Safe Zone, where it must go.');
  assert.equal(problem('S-A6-D5-A5-C7-E3-F5-F7'), 'The Injured Person cannot start on A5: that is the Hospital, where it must go.');
  assert.equal(problem('S-A6-D5-C5-C7-G3-F5-F7'), 'An obstacle cannot stand on G3: that is the House, a marked place.');
  assert.equal(problem('S-A6-D5-C5-C7-D1-F5-F7'), 'An obstacle cannot stand on D1: that is the top Fire Station, a marked place.');
  assert.equal(problem('S-A6-D5-C5-C7-E3-A1-F7'), 'An obstacle cannot stand on A1: that is the School, a marked place.');
  assert.equal(problem('S-A6-D5-D5-C7-E3-F5-F7'), 'Two things are on D5. One square takes one thing.');
  assert.equal(problem('S-A6-D5-C5-C7-E3-E3-F7'), 'Two things are on E3. One square takes one thing.');
  assert.equal(problem('S-A6-A6-C5-C7-E3-F5-F7'), 'Two things are on A6. One square takes one thing.');
});

test('a marked place may hold the Cat, the Injured Person or the Equipment when it is not their own target (N12)', () => {
  // the Cat on the House, the Injured Person on the top Fire Station, the Equipment on the Hospital
  const s = decodeScenario('H-A6-G3-D1-A5-E3-F5-F7');
  assert.notEqual(s, null);
  assert.deepEqual(scenarioProblems(s as FireCadetScenario), []);
  // the Cat on the place with the Fire, the Equipment on the Safe Zone
  assert.notEqual(decodeScenario('S-B6-A1-C5-D4-E3-F5-F7'), null);
  // ... and the obstacles may stand on the free Water squares (they have no dashed frame)
  assert.notEqual(decodeScenario('S-A6-D5-C5-C7-B6-A7-B7'), null);
});

test('scenarioProblems: every problem of a map, one sentence each; nothing throws on junk', () => {
  assert.deepEqual(scenarioProblems(P1), []);
  const broken = { ...P1, water: sq('D5'), cat: sq('D4'), obstacles: [sq('G3'), sq('F5'), sq('D7')] } as FireCadetScenario;
  assert.deepEqual(scenarioProblems(broken), [
    'The Water starts on A6, B6, A7 or B7.',
    'Nothing can stand on D7: the robot starts there.',
    'The Cat cannot start on D4: that is the Safe Zone, where it must go.',
    'An obstacle cannot stand on G3: that is the House, a marked place.',
  ]);
  assert.deepEqual(scenarioProblems({ ...P1, fire: 'hospital' } as unknown as FireCadetScenario), [
    'The Fire can be at the School, the Factory, the House or the Bakery.',
  ]);
  assert.deepEqual(scenarioProblems({ ...P1, cat: { col: 9, row: 0 } }), ['A square is a letter A to G and a number 1 to 7.']);
  for (const junk of [null, undefined, 3, 'P1', {}, { fire: 'school' }, { ...P1, obstacles: [] }, { ...P1, obstacles: null }]) {
    assert.ok(scenarioProblems(junk as unknown as FireCadetScenario).length > 0, JSON.stringify(junk));
  }
  // readMapCode never throws on junk either
  const rng = makeRng(3);
  const alphabet = 'SFHBPABCDEFG01234567-., x';
  for (let i = 0; i < 2000; i++) {
    let text = '';
    const n = Math.floor(rng() * 24);
    for (let k = 0; k < n; k++) text += alphabet[Math.floor(rng() * alphabet.length)];
    const reading = readMapCode(text);
    if (reading.ok) assert.deepEqual(scenarioProblems(reading.scenario), []);
  }
  assert.equal(readMapCode(undefined as unknown as string).ok, false);
});

test('placeProblem: the rules of the own-map editor (design 5.4), one tap at a time', () => {
  const s = P1; // Fire School, Water A6, Cat D5, Injured Person C5, Equipment C7, obstacles E3 F5 F7
  assert.equal(placeProblem(s, 'fire', sq('G3')), null, 'the House');
  assert.equal(placeProblem(s, 'fire', sq('D4')), 'fire-place', 'the Safe Zone is no Fire place');
  assert.equal(placeProblem(s, 'fire', sq('B2')), 'fire-place');
  assert.equal(placeProblem(s, 'water', sq('B7')), null);
  assert.equal(placeProblem(s, 'water', sq('C6')), 'water-square');
  assert.equal(placeProblem(s, 'cat', sq('D7')), 'start-square');
  assert.equal(placeProblem(s, 'equipment', sq('D7')), 'start-square');
  assert.equal(placeProblem(s, 'road-closed', sq('D7')), 'start-square');
  assert.equal(placeProblem(s, 'cat', sq('D4')), 'own-target');
  assert.equal(placeProblem(s, 'person', sq('A5')), 'own-target');
  assert.equal(placeProblem(s, 'cat', sq('A5')), null, 'the Cat may stand on the Hospital');
  assert.equal(placeProblem(s, 'cat', sq('A1')), null, 'the Cat may stand on the place with the Fire');
  assert.equal(placeProblem(s, 'fallen-tree', sq('G3')), 'obstacle-marked');
  assert.equal(placeProblem(s, 'fallen-tree', sq('B7')), null, 'a free Water square has no dashed frame');
  assert.equal(placeProblem(s, 'cat', sq('C5')), 'taken', 'the Injured Person stands there');
  assert.equal(placeProblem(s, 'cat', sq('D5')), null, 'its own square');
  assert.equal(placeProblem(s, 'road-closed', sq('A6')), 'taken', 'the Water stands there');
  // every map a sequence of allowed taps builds is a map without problems
  const rng = makeRng(11);
  let map: FireCadetScenario = P1;
  let changed = 0;
  for (let i = 0; i < 20_000; i++) {
    const thing = MAP_THINGS[Math.floor(rng() * MAP_THINGS.length)];
    const target = { col: Math.floor(rng() * 7), row: Math.floor(rng() * 7) };
    if (placeProblem(map, thing, target) !== null) continue;
    map = withThing(map, thing, target);
    changed++;
    assert.deepEqual(scenarioProblems(map), [], hyphenated(map));
    assert.deepEqual(squareOf(map, thing), target);
  }
  assert.ok(changed > 1000);
});

test('thingsOn and withThing', () => {
  assert.deepEqual(thingsOn(P1, sq('D5')), ['cat']);
  assert.deepEqual(thingsOn(P1, sq('A1')), [], 'the Fire is a flat sign');
  const moved = withThing(P1, 'broken-vehicle', sq('B2'));
  assert.equal(squareName(moved.obstacles[2]), 'B2');
  assert.equal(squareName(P1.obstacles[2]), 'F7', 'the practice map itself is not changed');
  assert.equal(withThing(P1, 'fire', sq('G5')).fire, 'bakery');
  assert.equal(withThing(P1, 'fire', sq('B2')), P1, 'not a Fire place: nothing changes');
});

test('describeScenario: "Practice map n", or the whole own map in words', () => {
  PRACTICE_MAPS.forEach((s, n) => assert.equal(describeScenario(s), `Practice map ${n + 1}`));
  const own = decodeScenario('S-A6-D5-C5-C7-E3-F5-E7') as FireCadetScenario;
  assert.equal(
    describeScenario(own),
    'Own map: Fire at the School, Water A6, Cat D5, Injured Person C5, Equipment C7, obstacles E3, F5, E7',
  );
});
