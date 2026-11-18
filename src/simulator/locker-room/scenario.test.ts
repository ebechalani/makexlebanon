/**
 * Locker Room arrangements: the Team Color card (RED or GREEN) and the Zone Assignment card
 * (options 1 to 6 of rules §3.2) - 12 of them, their codes, the refusals, the random draw and the
 * default.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../core/geometry';
import { ZONE_IDS } from './field';
import { lockerRoomGame } from './game';
import {
  SCENARIO_COUNT,
  TOKEN_COLORS,
  ZONE_OPTIONS,
  ZONE_OPTION_NUMBERS,
  allScenarios,
  compactCode,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  isValidScenario,
  randomScenario,
  scenarioFromIndex,
  scenarioIndex,
  scenarioProblems,
  tokensOf,
  zoneOfToken,
  type LockerRoomScenario,
  type ZoneOption,
} from './scenario';

test('rules §3.2: the six options, exactly as the rules list them', () => {
  // "Option 1: RED in A ● GREEN in B ● BLUE in C" ... "Option 6: BLUE in A ● GREEN in B ● RED in C"
  const RULES = [
    'Option 1: RED in A ● GREEN in B ● BLUE in C',
    'Option 2: RED in A ● BLUE in B ● GREEN in C',
    'Option 3: GREEN in A ● RED in B ● BLUE in C',
    'Option 4: GREEN in A ● BLUE in B ● RED in C',
    'Option 5: BLUE in A ● RED in B ● GREEN in C',
    'Option 6: BLUE in A ● GREEN in B ● RED in C',
  ];
  assert.deepEqual(ZONE_OPTION_NUMBERS, [1, 2, 3, 4, 5, 6]);
  for (const n of ZONE_OPTION_NUMBERS) {
    const o = ZONE_OPTIONS[n];
    assert.equal(`Option ${n}: ${ZONE_IDS.map((z) => `${o[z].toUpperCase()} in ${z}`).join(' ● ')}`, RULES[n - 1]);
  }
  // they are the six orders of the three colours, each once
  const orders = new Set(ZONE_OPTION_NUMBERS.map((n) => ZONE_IDS.map((z) => ZONE_OPTIONS[n][z]).join()));
  assert.equal(orders.size, 6);
  for (const n of ZONE_OPTION_NUMBERS) assert.deepEqual(ZONE_IDS.map((z) => ZONE_OPTIONS[n][z]).sort(), [...TOKEN_COLORS].sort());
});

test('arrangements: 2 team colours x 6 options = 12, all different, in the order R1 .. R6, G1 .. G6', () => {
  assert.equal(SCENARIO_COUNT, 12);
  assert.equal(lockerRoomGame.scenarioCount(), 12);
  const all = allScenarios();
  assert.deepEqual(all.map(encodeScenario), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
  all.forEach((s, i) => {
    assert.ok(isValidScenario(s));
    assert.deepEqual(scenarioProblems(s), []);
    assert.equal(scenarioIndex(s), i);
    assert.deepEqual(scenarioFromIndex(i), s);
  });
  // numbers outside 0 .. 11 wrap round
  assert.deepEqual(scenarioFromIndex(12), all[0]);
  assert.deepEqual(scenarioFromIndex(-1), all[11]);
  assert.deepEqual(scenarioFromIndex(13.7), all[1]);
});

test('codes: every arrangement goes to its code and back; letter case, spaces, dashes and wide letters do not matter', () => {
  for (const s of allScenarios()) {
    const code = encodeScenario(s);
    assert.match(code, /^[RG][1-6]$/);
    assert.deepEqual(decodeScenario(code), s);
    assert.deepEqual(decodeScenario(code.toLowerCase()), s);
    assert.deepEqual(decodeScenario(` ${code[0]} - ${code[1]} `), s);
    assert.equal(lockerRoomGame.encodeScenario(s), code);
    assert.deepEqual(lockerRoomGame.decodeScenario(code), s);
  }
  assert.deepEqual(decodeScenario('green 5'), { team: 'green', option: 5 });
  assert.deepEqual(decodeScenario('RED-2'), { team: 'red', option: 2 });
  assert.deepEqual(decodeScenario('Ｇ５'), { team: 'green', option: 5 });
  assert.equal(compactCode('g-5'), 'G5');
});

test('codes: anything else is no code - a row number alone, option 0 or 7, another colour - and nothing throws', () => {
  for (const code of ['', '5', '12', 'R', 'G0', 'R7', 'B3', 'BLUE 3', 'RG5', 'R55', 'R5G', 'GREEN', 'RE5', 'x'.repeat(200)]) {
    assert.equal(decodeScenario(code), null, code);
  }
  for (const bad of [null, undefined, 5, {}, []] as unknown[]) assert.equal(decodeScenario(bad as string), null);
});

test('refusals: a team colour other than RED or GREEN, an option outside 1 .. 6', () => {
  assert.deepEqual(scenarioProblems({ team: 'blue', option: 1 } as unknown as LockerRoomScenario), ['The team colour must be RED or GREEN.']);
  assert.deepEqual(scenarioProblems({ team: 'red', option: 7 as ZoneOption }), ['The zone card must be option 1 to 6.']);
  assert.deepEqual(scenarioProblems({ team: 'red', option: 2.5 as ZoneOption }), ['The zone card must be option 1 to 6.']);
  assert.equal(scenarioProblems(null as unknown as LockerRoomScenario).length, 1);
  assert.equal(scenarioIndex({ team: 'red', option: 0 as ZoneOption }), -1);
  assert.match(describeScenario({ team: 'red', option: 9 as ZoneOption }), /^This draw cannot be played\./);
  assert.equal(lockerRoomGame.scenarioProblems?.({ team: 'green', option: 4 }).length, 0);
});

test('the default is "G5": not the first team colour, not the first option, every token away from where option 1 puts it', () => {
  const s = defaultScenario();
  assert.equal(encodeScenario(s), 'G5');
  assert.deepEqual(lockerRoomGame.defaultScenario(), s);
  assert.notEqual(s.team, 'red');
  assert.notEqual(s.option, 1);
  for (const zone of ZONE_IDS) assert.notEqual(tokensOf(s)[zone], ZONE_OPTIONS[1][zone], zone);
  assert.equal(describeScenario(s), 'Team GREEN. Option 5: BLUE in A, RED in B, GREEN in C.');
  assert.equal(zoneOfToken(s, 'blue'), 'A');
  assert.equal(zoneOfToken(s, 'red'), 'B');
  assert.equal(zoneOfToken(s, 'green'), 'C');
});

test('the random draw: every arrangement equally likely, the same sequence gives the same arrangement', () => {
  const counts = new Map<string, number>();
  const rng = makeRng(7);
  for (let i = 0; i < 12000; i++) {
    const code = encodeScenario(randomScenario(rng));
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  assert.equal(counts.size, 12);
  for (const [code, n] of counts) assert.ok(n > 850 && n < 1150, `${code}: ${n}`);
  assert.deepEqual(randomScenario(makeRng(3)), randomScenario(makeRng(3)));
  // the ends of the generator's range
  assert.equal(encodeScenario(randomScenario(() => 0)), 'R1');
  assert.equal(encodeScenario(randomScenario(() => 0.999999999)), 'G6');
  assert.deepEqual(lockerRoomGame.randomScenario(makeRng(3)), randomScenario(makeRng(3)));
});
