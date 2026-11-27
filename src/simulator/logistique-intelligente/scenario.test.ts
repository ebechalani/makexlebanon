/**
 * Logistique intelligente has one setup and nothing is drawn (rules p. 12/8: "10 Transport cubes are
 * located in the storage center with 2 layers, each layer have 5 cubes, placing as a “cross”"): its
 * one code, CROIX, the refusals, the random draw that draws nothing, and the headless helper that
 * plays a program on it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeRng } from '../core/geometry';
import { CUBE_IDS, LINE_FAULTS, MAX_SCORE, logistiqueGame } from './game';
import { playLogistique } from './play';
import { NB, RULES_SETUP, SCENARIO_COUNT, SETUP_CODE, decodeScenario, defaultScenario, describeScenario, encodeScenario, randomScenario } from './scenario';

test('one setup: the rules\' own, the cross, with the code CROIX', () => {
  assert.equal(SCENARIO_COUNT, 1);
  assert.equal(logistiqueGame.scenarioCount(), 1);
  assert.deepEqual(RULES_SETUP, { setup: 'croix' });
  assert.ok(Object.isFrozen(RULES_SETUP));
  assert.equal(defaultScenario(), RULES_SETUP);
  assert.equal(SETUP_CODE, 'CROIX');
  assert.equal(encodeScenario(RULES_SETUP), 'CROIX');
  assert.equal(logistiqueGame.encodeScenario(logistiqueGame.defaultScenario()), 'CROIX');
  assert.equal(NB, ' ');
  assert.equal(
    describeScenario(RULES_SETUP),
    'Dix cubes jaunes sur la croix de la zone de stockage, en deux étages de cinq : les cubes 1 à 5 dessous, les cubes 6 à 10 dessus.',
  );
  assert.equal(logistiqueGame.describeScenario(RULES_SETUP), describeScenario(RULES_SETUP));
});

test('CROIX reads back in any letter case, with spaces round it; anything else is no code of this game', () => {
  for (const code of ['CROIX', 'croix', 'Croix', '  croix  ', '\tCROIX\n']) assert.equal(decodeScenario(code), RULES_SETUP, JSON.stringify(code));
  for (const code of ['', ' ', 'CROI', 'CROIXX', 'CR OIX', 'C-R-O-I-X', 'MAKEX', 'VR-BR', '1', 'X', 'croix!', 'x'.repeat(101), 'CROIX'.padEnd(101, ' ')]) {
    assert.equal(decodeScenario(code), null, JSON.stringify(code));
  }
  assert.equal(decodeScenario(undefined as unknown as string), null);
  assert.equal(decodeScenario(5 as unknown as string), null);
  // a code saved by the screen comes back as the one setup
  assert.equal(logistiqueGame.decodeScenario(logistiqueGame.encodeScenario(RULES_SETUP)), RULES_SETUP);
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
  assert.equal(logistiqueGame.randomScenario(counting), defaultScenario());
});

test('playLogistique: an empty program scores nothing, and the match ends when the program has ended', () => {
  const result = playLogistique({});
  assert.equal(result.total, 0);
  assert.equal(result.max, MAX_SCORE);
  assert.equal(result.max, 500);
  assert.equal(result.complete, false);
  assert.equal(result.finishReason, 'program-ended');
  assert.equal(result.scenarioCode, 'CROIX');
  assert.deepEqual(result.lines.map((l) => l.id), [...CUBE_IDS, LINE_FAULTS]);
  assert.ok(result.time < 0.1, `${result.time}`);
  // the completion time is the end of the match
  assert.equal(result.scoreTime, result.time);
  // the same program and seed: the same result
  assert.deepEqual(playLogistique({}), result);
});
