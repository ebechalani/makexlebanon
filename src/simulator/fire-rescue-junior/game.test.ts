/**
 * Fire Rescue Junior as a game (./game.ts): the Fire Rescue field, robot, referee and examples
 * under an id of its own, with only the 24 bucket draws. Its block palette, its program files,
 * its saved settings, and the Fire Rescue examples played on all 24 draws.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEFAULT_PALETTE, GAME_VERSIONS, PALETTE_IDS, PALETTE_TOOLTIPS, isPaletteId, paletteCategories, paletteOf, paletteTooltip, versionOf } from '../blocks/palettes';
import { paletteBlockTypes, paletteToolbox } from '../blocks/toolbox';
import { runMatch } from '../core/batch';
import { makeRng } from '../core/geometry';
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import { fireRescueGame, startPoseFor } from '../fire-rescue/game';
import { FULL_MISSION_SAMPLE, SAMPLE_PROGRAMS } from '../fire-rescue/samples';
import { defaultScenario, scenarioFromIndex, SCENARIO_COUNT, withPersonSlot } from '../fire-rescue/scenario';
import { program, script, whenStart } from '../vm/builder';
import { otherGameNote, parseProgramFile, programFileName, programGameOf, serializeProgramFile } from '../ui/program-file';
import { storageKey } from '../ui/storage';
import { FIRE_RESCUE_JUNIOR_ID, fireRescueJuniorGame } from './game';
import { allJuniorScenarios, encodeJuniorScenario, isJuniorScenario, JUNIOR_SCENARIO_COUNT } from './scenario';

describe('the Junior game is the Fire Rescue game with its own id and its own draws', () => {
  test('its id and title; Fire Rescue (Senior) keeps its id', () => {
    assert.equal(FIRE_RESCUE_JUNIOR_ID, 'fire-rescue-junior');
    assert.equal(fireRescueJuniorGame.id, 'fire-rescue-junior');
    assert.equal(fireRescueJuniorGame.title, 'MakeX Lebanon 2027 - Fire Rescue Junior');
    assert.equal(fireRescueGame.id, 'fire-rescue');
    assert.equal(fireRescueGame.title, 'MakeX Lebanon 2027 - Fire Rescue');
  });

  test('the same field, start zone, clock, penalty and referee - the very same functions', () => {
    for (const key of ['mat', 'matchDuration', 'startZone', 'defaultStartPose', 'restartPenalty', 'createBodies', 'overlays', 'score', 'defaultScenario'] as const) {
      assert.equal(fireRescueJuniorGame[key], fireRescueGame[key], key);
    }
    // nothing optional of its own: no walls, no referee with memory, no own interpreter, no robot of its own
    for (const key of ['createWalls', 'createReferee', 'createVM', 'restartRules', 'robotConfig'] as const) {
      assert.equal(fireRescueJuniorGame[key], undefined, key);
      assert.equal(fireRescueGame[key], undefined, key);
    }
    // the same field for the same combination
    const s = allJuniorScenarios()[13];
    assert.deepEqual(fireRescueJuniorGame.createBodies(s), fireRescueGame.createBodies(s));
    assert.deepEqual(fireRescueJuniorGame.overlays(s), fireRescueGame.overlays(s));
  });

  test('its own draws: 24 combinations, a random draw moves only buckets, its own codes', () => {
    assert.equal(fireRescueJuniorGame.scenarioCount(), JUNIOR_SCENARIO_COUNT);
    assert.equal(fireRescueGame.scenarioCount(), SCENARIO_COUNT);
    const rng = makeRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = fireRescueJuniorGame.randomScenario(rng);
      assert.ok(isJuniorScenario(s));
      assert.deepEqual(s.people, defaultScenario().people);
      seen.add(fireRescueJuniorGame.encodeScenario(s));
    }
    assert.equal(seen.size, 24);
    assert.equal(fireRescueJuniorGame.encodeScenario(fireRescueJuniorGame.defaultScenario()), 'RGBY');
    for (const s of allJuniorScenarios()) assert.deepEqual(fireRescueJuniorGame.decodeScenario(fireRescueJuniorGame.encodeScenario(s)), s);
    // a Senior code is no Junior code (and the other way round)
    assert.equal(fireRescueJuniorGame.decodeScenario(fireRescueGame.encodeScenario(scenarioFromIndex(1234))), null);
    assert.equal(fireRescueJuniorGame.decodeScenario('RGBY-A1R-B1B-C1Y-D1G'), null);
    assert.equal(fireRescueGame.decodeScenario('GRYB'), null);
    // what is wrong with a combination that moves a person
    assert.deepEqual(fireRescueJuniorGame.scenarioProblems?.(defaultScenario()), []);
    assert.equal(fireRescueJuniorGame.scenarioProblems?.(withPersonSlot(defaultScenario(), 'B', 2)).length, 1);
  });

  test('the Fire Rescue game itself still draws everything', () => {
    const rng = makeRng(11);
    let peopleMoved = 0;
    for (let i = 0; i < 100; i++) if (!isJuniorScenario(fireRescueGame.randomScenario(rng))) peopleMoved++;
    assert.ok(peopleMoved > 90, `${peopleMoved} of 100 Senior draws move a person`);
  });
});

describe('palette: Junior shows exactly the blocks of Fire Rescue', () => {
  test('the palette, the toolbox, the block types and the hover texts of Fire Rescue', () => {
    assert.deepEqual(GAME_VERSIONS, { 'fire-rescue-junior': 'fire-rescue' });
    assert.equal(versionOf('fire-rescue-junior'), 'fire-rescue');
    assert.equal(paletteOf('fire-rescue-junior'), 'fire-rescue');
    assert.deepEqual(paletteCategories('fire-rescue-junior'), paletteCategories('fire-rescue'));
    assert.deepEqual(paletteToolbox('fire-rescue-junior'), paletteToolbox('fire-rescue'));
    assert.deepEqual(paletteBlockTypes('fire-rescue-junior'), paletteBlockTypes('fire-rescue'));
    assert.ok(paletteCategories('fire-rescue-junior').includes('gripper'), 'with the Gripper blocks (and the window with their mBlock code)');
    for (const type of ['gripper_claw', 'sensing_quadrgb_probe_detects', 'sensing_claw_object_detected']) {
      assert.equal(paletteTooltip(type, 'fire-rescue-junior'), paletteTooltip(type, 'fire-rescue'), type);
    }
    // it is not a palette of its own: the list of palettes and their hover texts are as they were
    assert.equal(isPaletteId('fire-rescue-junior'), false);
    assert.ok(!PALETTE_IDS.includes('fire-rescue-junior' as never));
    assert.ok(!('fire-rescue-junior' in PALETTE_TOOLTIPS));
    // it does not depend on the default palette: Junior has Fire Rescue's even if the default were another one
    assert.equal(DEFAULT_PALETTE, 'fire-rescue');
    assert.equal(versionOf('fire-rescue'), undefined);
    for (const id of ['fire-chief', 'warehouse-sort', 'locker-room', 'fire-cadet', 'some-future-game', 'constructor', '__proto__', 'toString', undefined]) {
      assert.equal(versionOf(id), undefined, String(id));
    }
  });
});

describe('program files: one game for a program, Junior and Senior', () => {
  const RESCUE_PROGRAM = program([script(whenStart(), [])]);

  test('a file saved in one opens in the other without a word about another game', () => {
    assert.equal(programGameOf('fire-rescue-junior'), 'fire-rescue');
    assert.equal(programGameOf('fire-rescue'), 'fire-rescue');
    assert.equal(programGameOf('fire-chief'), 'fire-chief');
    // saved in Junior, opened in Senior - and the other way round
    for (const [saved, opened] of [
      ['fire-rescue-junior', 'fire-rescue'],
      ['fire-rescue', 'fire-rescue-junior'],
      ['fire-rescue-junior', 'fire-rescue-junior'],
    ]) {
      const file = parseProgramFile(serializeProgramFile(saved, RESCUE_PROGRAM));
      assert.ok(file.ok);
      assert.equal(file.game, saved);
      assert.equal(otherGameNote(file.program, file.game, opened), null, `${saved} -> ${opened}`);
    }
    // a Junior file says which game it was saved in, and is named after it
    assert.match(serializeProgramFile('fire-rescue-junior', RESCUE_PROGRAM), /"game": "fire-rescue-junior"/);
    assert.equal(programFileName('fire-rescue-junior', new Date('2027-03-14T10:00:00Z')), 'fire-rescue-junior-program-2027-03-14.json');
  });

  test('a file of another game still gets its note in Junior, and a Junior file gets one in another game', () => {
    const chief = program([script(whenStart(), [])]);
    assert.equal(otherGameNote(chief, 'fire-chief', 'fire-rescue-junior'), otherGameNote(chief, 'fire-chief', 'fire-rescue'));
    assert.equal(otherGameNote(chief, 'fire-chief', 'fire-rescue-junior'), 'This program was saved in the Fire Chief simulator. All its blocks work here too.');
    assert.equal(otherGameNote(RESCUE_PROGRAM, 'fire-rescue-junior', 'fire-chief'), 'This program was saved in the Fire Rescue Junior simulator. All its blocks work here too.');
    assert.equal(otherGameNote(RESCUE_PROGRAM, 'fire-rescue-junior', 'warehouse-sort'), 'This program was saved in the Fire Rescue Junior simulator. All its blocks work here too.');
    // (a bare Blockly file says nothing in either)
    assert.equal(otherGameNote(RESCUE_PROGRAM, null, 'fire-rescue-junior'), null);
  });
});

test('saved work: Junior keeps its blocks and settings apart from Senior', () => {
  for (const name of ['settings', 'workspace']) {
    assert.equal(storageKey(fireRescueJuniorGame.id, name), `mbot2-sim:fire-rescue-junior:${name}`);
    assert.equal(storageKey(fireRescueGame.id, name), `mbot2-sim:fire-rescue:${name}`);
    assert.notEqual(storageKey(fireRescueJuniorGame.id, name), storageKey(fireRescueGame.id, name));
  }
});

describe('the Fire Rescue examples on all 24 Junior draws (headless, as "Test on many combinations" plays them)', () => {
  const startPose = startPoseFor(DEFAULT_ROBOT_CONFIG);
  const draws = allJuniorScenarios();
  /** The total of each example on each draw, by the draw's code. */
  const totals = new Map<string, Map<string, number>>();
  for (const sample of [...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE]) {
    const byDraw = new Map<string, number>();
    for (const s of draws) {
      byDraw.set(encodeJuniorScenario(s), runMatch({ game: fireRescueJuniorGame, robotConfig: DEFAULT_ROBOT_CONFIG, scenario: s, program: sample.program, startPose }).total);
    }
    totals.set(sample.id, byDraw);
  }
  const of = (id: string): Map<string, number> => {
    const found = totals.get(id);
    assert.ok(found, id);
    return found;
  };

  test('the three starter examples score nothing, on every draw', () => {
    for (const id of ['hello', 'line-follow', 'gripper-demo']) assert.deepEqual([...new Set(of(id).values())], [0], id);
  });

  test('"one bucket" scores 20 exactly when the red bucket is on W1 (6 of the 24 draws)', () => {
    for (const [code, total] of of('one-bucket')) assert.equal(total, code.startsWith('R') ? 20 : 0, code);
  });

  test('"smart bucket" delivers the W1 bucket on every draw: 20 points on all 24', () => {
    assert.deepEqual([...new Set(of('smart-bucket').values())], [20]);
  });

  test('"one person" scores 20 on every draw: in Junior the red person always waits in A1', () => {
    assert.deepEqual([...new Set(of('one-person').values())], [20]);
  });

  test('the full mission scores 180 on the rule book\'s draw only; on the 23 others less', () => {
    const full = of('full-mission');
    assert.equal(full.get('RGBY'), 180);
    for (const [code, total] of full) if (code !== 'RGBY') assert.ok(total < 180 && total >= 80, `${code}: ${total}`);
  });
});
