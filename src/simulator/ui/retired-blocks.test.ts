/**
 * A program that still holds flame sensor blocks (./program-file.ts: withoutRetiredBlocks).
 *
 * The Fire Chief robot had a flame sensor while its page was being built; the organiser then
 * chose a colour sensor and the flame sensor went, with its two blocks. Somebody who tried the
 * page in those days can still have such blocks, in the browser's saved work or in a file.
 *
 *  - Blockly refuses the whole program for one block it does not know (shown here with the real
 *    library), so the page takes those blocks out first;
 *  - the rest of the program stays as it was, slot by slot;
 *  - the student gets one sentence that says what happened.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, describe, it } from 'node:test';

import { BLOCKS, getBlockDef } from '../blocks/catalog';
import { createEditor, type BlocklyApi } from '../blocks/register';
import { createSimulation } from '../core/simulation';
import type { BlockJson, ProgramJson } from '../core/types';
import { fireChiefGame } from '../fire-chief/game';
import { defaultScenario } from '../fire-chief/scenario';
import { blockRole } from '../vm';
import { dcMotor, moveCm, program, script, whenStart } from '../vm/builder';
import { countBlocks, otherGameNote, parseProgramFile, RETIRED_BLOCKS, retiredBlocksNote, serializeProgramFile, topBlocks, withoutRetiredBlocks } from './program-file';

/**
 * A program as the page of those days saved it - written by the program builder of commit
 * 95bf3b6, the last one that knew the flame sensor blocks (the "loose" block was added by hand):
 *
 *   when CyberPi starts up
 *     moves forward 10 cm
 *     wait until < flame sensor (1) detects flame? >
 *     set [best] to ( flame sensor (1) flame size )
 *     if < ( flame sensor (1) flame size ) > 20 > then
 *       DC motor M1 at 100 %, wait 3.5 s, DC motor M1 stops
 *     print ( join "flame " ( flame sensor ( n ) flame size ) )
 *   and, lying loose beside the script:  < flame sensor (1) detects flame? >
 */
// prettier-ignore
const WITH_FLAME_BLOCKS: ProgramJson = {
  blocks: { languageVersion: 0, blocks: [
    { type: 'event_cyberpi_start', id: 'b1', x: 40, y: 40, next: { block:
      { type: 'mbot2_straight_cm', id: 'b2', fields: { DIRECTION: 'forward' }, inputs: { DISTANCE: { shadow: { type: 'math_number', id: 'b3', fields: { NUM: 10 } } } }, next: { block:
      { type: 'control_wait_until', id: 'b4', inputs: { CONDITION: { block:
        { type: 'sensing_flame_detected', id: 'b5', inputs: { INDEX: { shadow: { type: 'math_number', id: 'b6', fields: { NUM: 1 } } } } } } }, next: { block:
      { type: 'data_setvariableto', id: 'b7', fields: { VARIABLE: { id: 'var1' } }, inputs: { VALUE: { shadow: { type: 'text', id: 'b8', fields: { TEXT: '0' } }, block:
        { type: 'sensing_flame_size', id: 'b9', inputs: { INDEX: { shadow: { type: 'math_number', id: 'b10', fields: { NUM: 1 } } } } } } }, next: { block:
      { type: 'control_if', id: 'b11', inputs: {
        CONDITION: { block: { type: 'operator_gt', id: 'b12', inputs: {
          OPERAND1: { shadow: { type: 'text', id: 'b13', fields: { TEXT: '' } }, block:
            { type: 'sensing_flame_size', id: 'b14', inputs: { INDEX: { shadow: { type: 'math_number', id: 'b15', fields: { NUM: 1 } } } } } },
          OPERAND2: { shadow: { type: 'text', id: 'b16', fields: { TEXT: '20' } } } } } },
        SUBSTACK: { block: { type: 'mbot2_dc_motor_power', id: 'b17', fields: { PORT: 'M1' }, inputs: { POWER: { shadow: { type: 'math_number', id: 'b18', fields: { NUM: 100 } } } }, next: { block:
          { type: 'control_wait', id: 'b19', inputs: { DURATION: { shadow: { type: 'math_number', id: 'b20', fields: { NUM: 3.5 } } } }, next: { block:
          { type: 'mbot2_dc_motor_stop', id: 'b21', fields: { PORT: 'M1' } } } } } } } }, next: { block:
      { type: 'cyberpi_print', id: 'b22', inputs: { TEXT: { shadow: { type: 'text', id: 'b23', fields: { TEXT: 'makeblock' } }, block:
        { type: 'operator_join', id: 'b24', inputs: {
          STRING1: { shadow: { type: 'text', id: 'b25', fields: { TEXT: 'flame ' } } },
          STRING2: { shadow: { type: 'text', id: 'b26', fields: { TEXT: 'banana' } }, block:
            { type: 'sensing_flame_size', id: 'b27', inputs: { INDEX: { shadow: { type: 'math_number', id: 'b28', fields: { NUM: 1 } }, block:
              { type: 'data_variable', id: 'b29', fields: { VARIABLE: { id: 'var2' } } } } } } } } } } } },
      } } } } } } } } } },
    { type: 'sensing_flame_detected', id: 'loose', x: 420, y: 40, inputs: { INDEX: { shadow: { type: 'math_number', id: 'loose-1', fields: { NUM: 1 } } } } },
  ] },
  variables: [{ name: 'best', id: 'var1' }, { name: 'n', id: 'var2' }],
};

/** Every block of a program, the ones in slots and the white bubbles too. */
function allBlocks(prog: ProgramJson): BlockJson[] {
  const found: BlockJson[] = [];
  const walk = (block: BlockJson | undefined): void => {
    if (!block) return;
    found.push(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      walk(slot.block);
      walk(slot.shadow);
    }
    walk(block.next?.block);
  };
  for (const top of topBlocks(prog)) walk(top);
  return found;
}

const byId = (prog: ProgramJson, id: string): BlockJson => {
  const block = allBlocks(prog).find((b) => b.id === id);
  assert.ok(block, `block ${id}`);
  return block;
};

describe('a program with flame sensor blocks: they are taken out, the rest stays', () => {
  const before = JSON.stringify(WITH_FLAME_BLOCKS);
  const taken = withoutRetiredBlocks(WITH_FLAME_BLOCKS);

  it('the two flame sensor blocks are the blocks that are gone - and they are really gone from the simulator', () => {
    assert.deepEqual(Object.keys(RETIRED_BLOCKS).sort(), ['sensing_flame_detected', 'sensing_flame_size']);
    for (const [type, part] of Object.entries(RETIRED_BLOCKS)) {
      assert.equal(part, 'flame sensor');
      // (a block that comes back into the catalog must leave this list, or it would be taken out of every program)
      assert.equal(getBlockDef(type), undefined, `${type} is not a block of the catalog`);
      assert.equal(blockRole(type), undefined, `${type}: the interpreter does not know it`);
    }
    assert.ok(!BLOCKS.some((def) => /flame/i.test(def.type)));
  });

  it('takes out all five, counts them, and leaves no flame block behind', () => {
    assert.equal(taken.removed, 5);
    assert.deepEqual(taken.parts, ['flame sensor']);
    assert.ok(!allBlocks(taken.program).some((block) => /flame/i.test(block.type)));
    // every other block is still there: 17 blocks before (white bubbles not counted), 5 flame
    // blocks and the variable that was plugged into one of them gone
    assert.equal(countBlocks(WITH_FLAME_BLOCKS), 17);
    assert.equal(countBlocks(taken.program), 17 - 5 - 1);
    assert.deepEqual(
      topBlocks(taken.program).map((block) => block.id),
      ['b1'],
      'the loose block is gone, the script is still the one script',
    );
    // the variables of the program are kept, also the one that is no longer used
    assert.deepEqual(taken.program.variables, WITH_FLAME_BLOCKS.variables);
  });

  it('a slot that held a flame block is empty afterwards: its white bubble shows again, or it has none', () => {
    // "wait until < >": a pointed slot has no bubble
    assert.equal(byId(taken.program, 'b4').inputs?.CONDITION, undefined);
    // "set [best] to (0)", "( ) > 20", "join (flame ) (banana)": the bubbles are back
    assert.deepEqual(byId(taken.program, 'b7').inputs?.VALUE, { shadow: { type: 'text', id: 'b8', fields: { TEXT: '0' } } });
    assert.deepEqual(byId(taken.program, 'b12').inputs?.OPERAND1, { shadow: { type: 'text', id: 'b13', fields: { TEXT: '' } } });
    assert.deepEqual(byId(taken.program, 'b24').inputs?.STRING2, { shadow: { type: 'text', id: 'b26', fields: { TEXT: 'banana' } } });
    // what was not touched is exactly what it was: the blocks inside "if", the text a student typed
    assert.deepEqual(byId(taken.program, 'b17'), byId(WITH_FLAME_BLOCKS, 'b17'));
    assert.deepEqual(byId(taken.program, 'b25').fields, { TEXT: 'flame ' });
    assert.deepEqual(byId(taken.program, 'b2'), { ...byId(WITH_FLAME_BLOCKS, 'b2'), next: byId(taken.program, 'b2').next });
  });

  it('does not change the program it was given', () => {
    assert.equal(JSON.stringify(WITH_FLAME_BLOCKS), before);
  });

  it('a program without such blocks comes back as it is - the very same object, nothing to say', () => {
    const plain = program([script(whenStart(), [moveCm('forward', 10), dcMotor('M1', 50)])]);
    const same = withoutRetiredBlocks(plain);
    assert.equal(same.program, plain);
    assert.deepEqual({ removed: same.removed, parts: same.parts }, { removed: 0, parts: [] });
    assert.equal(retiredBlocksNote(same, 'this program'), null);
    // nothing in it, or nothing at all
    assert.equal(withoutRetiredBlocks({}).removed, 0);
    assert.equal(withoutRetiredBlocks({ blocks: { blocks: [] } }).removed, 0);
    // a block Blockly's own (or nobody's) is not ours to take out
    const unknown: ProgramJson = { blocks: { blocks: [{ type: 'no_such_block', id: 'x' }] } };
    assert.equal(withoutRetiredBlocks(unknown).program, unknown);
  });

  it('says it in one plain sentence - for a file, and for the blocks the browser saved', () => {
    assert.equal(
      retiredBlocksNote(taken, 'this program'),
      '5 flame sensor blocks were taken out of this program, because the simulator has no flame sensor any more: their places are empty now.',
    );
    assert.equal(
      retiredBlocksNote(taken, 'your saved program'),
      '5 flame sensor blocks were taken out of your saved program, because the simulator has no flame sensor any more: their places are empty now.',
    );
    const one = withoutRetiredBlocks({ blocks: { blocks: [{ type: 'sensing_flame_size', id: 'x' }] } });
    assert.equal(one.removed, 1);
    assert.equal(
      retiredBlocksNote(one, 'this program'),
      '1 flame sensor block was taken out of this program, because the simulator has no flame sensor any more: its place is empty now.',
    );
    // one sentence: one full stop, at its end
    for (const note of [retiredBlocksNote(taken, 'this program'), retiredBlocksNote(one, 'your saved program')]) {
      assert.equal((note ?? '').match(/\./g)?.length, 1);
      assert.match(note ?? '', /\.$/);
    }
  });

  it('a program file with such blocks is read like any other file; the page then takes them out', () => {
    const parsed = parseProgramFile(serializeProgramFile('fire-chief', WITH_FLAME_BLOCKS));
    assert.ok(parsed.ok);
    assert.equal(parsed.game, 'fire-chief');
    const kept = withoutRetiredBlocks(parsed.program);
    assert.equal(kept.removed, 5);
    // what is left is a program of Fire Chief: on its own page there is nothing more to say ...
    assert.equal(otherGameNote(kept.program, parsed.game, 'fire-chief'), null);
    // ... and on the page of Fire Rescue the usual note about the DC motor blocks follows
    assert.equal(
      otherGameNote(kept.program, parsed.game, 'fire-rescue'),
      'This program was saved in the Fire Chief simulator. 2 of its blocks are for parts this robot does not have (mBot2 Extension Port): they do not work here.',
    );
  });

  it('what is left runs: the interpreter knows every block of it', () => {
    for (const block of allBlocks(taken.program)) assert.notEqual(blockRole(block.type), undefined, block.type);
    // "wait until < >" with nothing in it waits: the robot drives its 10 cm and then stands
    const sim = createSimulation({ game: fireChiefGame, scenario: defaultScenario(), program: taken.program });
    sim.start();
    sim.step(500);
    assert.deepEqual(
      sim.vm.errors().filter((error) => /unknown|flame/i.test(error.message)),
      [],
    );
    assert.equal(sim.status, 'running');
    assert.equal(sim.score().total, 0);
  });
});

// =============================================================================================
// With the real Blockly library
// =============================================================================================

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly (as in ../blocks/palettes.test.ts). */
async function loadBlocklyWithDom(): Promise<BlocklyApi> {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> } };
  const dom = new JSDOM('<!DOCTYPE html><div id="editor" style="width: 900px; height: 600px"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'DOMParser', 'XMLSerializer',
    'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']; // prettier-ignore
  // jsdom has no canvas; Blockly only uses it to measure how wide a text is
  const canvas = dom.window.HTMLCanvasElement as { prototype: { getContext: unknown } };
  canvas.prototype.getContext = () => ({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) });
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return (await import('blockly')) as unknown as BlocklyApi;
}

describe('a program with flame sensor blocks in the real editor', () => {
  let Blockly: BlocklyApi;
  before(async () => {
    Blockly = await loadBlocklyWithDom();
  });

  it('Blockly refuses the program as it was saved, and shows it once the flame blocks are out', () => {
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: 'fire-chief' });
    const serializer = Blockly.serialization.workspaces;
    // as it was saved: one unknown block, and the whole program is refused
    assert.throws(() => serializer.load(WITH_FLAME_BLOCKS as never, workspace, { recordUndo: false }), /sensing_flame_detected|sensing_flame_size/);
    workspace.clear();

    // without them it loads, and the script is whole: 11 blocks under each other and in each other
    const kept = withoutRetiredBlocks(WITH_FLAME_BLOCKS);
    serializer.load(kept.program as never, workspace, { recordUndo: false });
    const shown = workspace.getAllBlocks(false).filter((block) => !block.isShadow());
    assert.equal(shown.length, countBlocks(kept.program));
    assert.equal(workspace.getTopBlocks(false).length, 1);
    const waitUntil = workspace.getBlocksByType('control_wait_until')[0];
    assert.equal(waitUntil.getInput('CONDITION')?.connection?.targetBlock(), null, 'the slot of "wait until" is empty');
    // the white bubble of "set [best] to" shows again, with the value it had
    const setVariable = workspace.getBlocksByType('data_setvariableto')[0];
    const bubble = setVariable.getInput('VALUE')?.connection?.targetBlock();
    assert.equal(bubble?.isShadow(), true);
    assert.equal(bubble?.getFieldValue('TEXT'), '0');
    // and what Blockly saves again holds no flame block: the next save in the browser is clean
    const saved = serializer.save(workspace) as ProgramJson;
    assert.equal(withoutRetiredBlocks(saved).removed, 0);
    assert.ok(!/flame_/.test(JSON.stringify(saved)));
    workspace.dispose();
  });
});
