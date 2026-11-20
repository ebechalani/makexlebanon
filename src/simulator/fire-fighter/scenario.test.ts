/**
 * Fire Fighter has one setup and nothing is drawn (rules §3; the organiser: "Always the same: no
 * draw of the letters"): its one code, MAKEX, the refusals, the random draw that draws nothing, and
 * the headless helper that plays a program on it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../core/geometry';
import { fireFighterGame } from './game';
import { playFireFighter } from './play';
import { RULES_SETUP, SCENARIO_COUNT, SETUP_CODE, decodeScenario, defaultScenario, describeScenario, encodeScenario, randomScenario } from './scenario';

test('one setup: the rules\' own, with the code MAKEX (the five letters, in the order of the rules\' check table)', () => {
  assert.equal(SCENARIO_COUNT, 1);
  assert.equal(fireFighterGame.scenarioCount(), 1);
  assert.deepEqual(RULES_SETUP, { setup: 'rules' });
  assert.ok(Object.isFrozen(RULES_SETUP));
  assert.equal(defaultScenario(), RULES_SETUP);
  assert.equal(SETUP_CODE, 'MAKEX');
  assert.equal(encodeScenario(RULES_SETUP), 'MAKEX');
  assert.equal(fireFighterGame.encodeScenario(fireFighterGame.defaultScenario()), 'MAKEX');
  assert.equal(
    describeScenario(RULES_SETUP),
    'Red cubes on the four squares of the bays, the yellow cube on its red square; towers M (school), A (hospital), K (bakery), E (park) and X (hydrant).',
  );
});

test('MAKEX reads back in any letter case, with spaces round it; anything else is no code of this game', () => {
  for (const code of ['MAKEX', 'makex', 'MakeX', '  makex  ', '\tMAKEX\n']) assert.equal(decodeScenario(code), RULES_SETUP, JSON.stringify(code));
  for (const code of ['', ' ', 'MAKE', 'MAKEXX', 'MA KEX', 'M-A-K-E-X', 'G5', '1', '0', 'X', 'rules', 'MAKEX!', 'x'.repeat(101), 'MAKEX'.padEnd(101, ' ')]) {
    assert.equal(decodeScenario(code), null, JSON.stringify(code));
  }
  assert.equal(decodeScenario(undefined as unknown as string), null);
  assert.equal(decodeScenario(5 as unknown as string), null);
  // a code saved by the screen comes back as the one setup
  assert.equal(fireFighterGame.decodeScenario(fireFighterGame.encodeScenario(RULES_SETUP)), RULES_SETUP);
});

test('the random draw draws nothing: always the one setup, and it takes no number from the generator', () => {
  let taken = 0;
  const rng = makeRng(7);
  const counting = (): number => {
    taken++;
    return rng();
  };
  for (let i = 0; i < 20; i++) assert.equal(randomScenario(counting), RULES_SETUP);
  assert.equal(taken, 0);
  assert.equal(fireFighterGame.randomScenario(counting), defaultScenario());
});

test('playFireFighter: an empty program scores nothing, and the match ends when the program has ended', () => {
  const result = playFireFighter({});
  assert.equal(result.total, 0);
  assert.equal(result.max, 100);
  assert.equal(result.complete, false);
  assert.equal(result.finishReason, 'program-ended');
  assert.equal(result.scenarioCode, 'MAKEX');
  assert.equal(result.lines.length, 6);
  assert.ok(result.time < 0.1, `${result.time}`);
  // the same program and seed: the same result
  assert.deepEqual(playFireFighter({}), result);
});
