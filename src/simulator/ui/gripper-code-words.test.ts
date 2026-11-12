/**
 * What the window "Inside the Gripper blocks" says (./gripper-code-words.ts): the sentences at
 * its top and the answers of its two buttons.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { addGripperMyBlocks, convertGripperBlocks } from '../blocks/gripper-original';
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { ProgramJson } from '../core/types';
import { addedMessage, convertedMessage, GRIPPER_CODE_WORDS, gripperCodeIntro } from './gripper-code-words';
import { blankProgram } from './program-file';

/** The blank program with some Gripper blocks under the yellow block. */
function withGripperBlocks(actions: Array<'open' | 'close'>): ProgramJson {
  const program = blankProgram();
  let above = program.blocks!.blocks![0];
  actions.forEach((action, i) => {
    const block = { type: 'gripper_claw', id: `claw-${i}`, fields: { ACTION: action } };
    above.next = { block };
    above = block;
  });
  return program;
}

describe('the words of the window "Inside the Gripper blocks"', () => {
  test('the sentences at the top say what the Gripper blocks are, and name the servos of the robot', () => {
    const intro = gripperCodeIntro(DEFAULT_ROBOT_CONFIG);
    assert.equal(intro.length, 3, 'three sentences, no more');
    assert.match(intro[0], /mBlock has no Gripper category/);
    assert.match(intro[1], /My Blocks/);
    assert.equal(intro[2], 'On this robot servo S1 moves the arm and servo S2 moves the claw.');
    const other = { ...DEFAULT_ROBOT_CONFIG, gripper: { ...DEFAULT_ROBOT_CONFIG.gripper, liftServo: 'S3' as const, clawServo: 'S4' as const } };
    assert.equal(gripperCodeIntro(other)[2], 'On this robot servo S3 moves the arm and servo S4 moves the claw.');
    for (const sentence of intro) assert.ok(sentence.length < 130, 'short sentences');
    assert.equal(GRIPPER_CODE_WORDS.title, 'Inside the Gripper blocks');
    assert.equal(GRIPPER_CODE_WORDS.addButton, 'Add these My Blocks to my program');
    assert.equal(GRIPPER_CODE_WORDS.convertButton, 'Show my program the mBlock way');
  });

  test('"Add these My Blocks": how many were added, and that a second press adds nothing', () => {
    const first = addGripperMyBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG);
    assert.match(addedMessage(first), /^5 My Blocks were added to your program\./);
    assert.match(addedMessage(first), /Undo takes them out again\.$/);
    const second = addGripperMyBlocks(first.program, DEFAULT_ROBOT_CONFIG);
    assert.equal(addedMessage(second), 'Nothing was added: all 5 My Blocks are already in your program. Look under My Blocks.');

    // some were there already (the program was shown the mBlock way before)
    const some = addGripperMyBlocks(convertGripperBlocks(withGripperBlocks(['close', 'open']), DEFAULT_ROBOT_CONFIG).program, DEFAULT_ROBOT_CONFIG);
    assert.match(addedMessage(some), /^3 My Blocks were added to your program: arm raises, arm lowers and arm moves to height\. The other 2 were already there\./);
    assert.match(addedMessage({ added: ['arm lowers'], myBlocks: first.myBlocks }), /^1 My Block was added to your program: arm lowers\. The other 4 were already there\./);
    assert.match(addedMessage({ added: first.added.slice(0, 4), myBlocks: first.myBlocks }), /The other one was already there\./);
  });

  test('"Show my program the mBlock way": how many blocks were replaced, or that there are none', () => {
    assert.equal(convertedMessage(convertGripperBlocks(blankProgram(), DEFAULT_ROBOT_CONFIG)), 'Your program has no Gripper blocks, so there is nothing to change.');
    assert.match(convertedMessage(convertGripperBlocks(withGripperBlocks(['close']), DEFAULT_ROBOT_CONFIG)), /^1 Gripper block was replaced by its My Block\./);
    const three = convertedMessage(convertGripperBlocks(withGripperBlocks(['close', 'open', 'close']), DEFAULT_ROBOT_CONFIG));
    assert.match(three, /^3 Gripper blocks were replaced by their My Blocks\./);
    assert.match(three, /Undo brings the Gripper blocks back\.$/);
  });
});
