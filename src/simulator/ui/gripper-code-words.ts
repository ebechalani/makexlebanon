/**
 * The words of the window "Inside the Gripper blocks" (./GripperCodeDialog.tsx): its title, the
 * few sentences at its top, its two buttons and what it says after a button was pressed.
 *
 * Written for 12-year-old students and their teacher: plain words, no jargon. The words of the
 * palette (the two lines and the button at the top of the Gripper category) are with the palette,
 * in ../blocks/toolbox.ts; the sentence in the tooltips is in ../blocks/catalog.ts.
 *
 * Plain TypeScript (no DOM, no Blockly), so it can be unit-tested under Node.
 */
import type { GripperChange } from '../blocks/gripper-original';
import type { RobotConfig } from '../core/types';

export const GRIPPER_CODE_WORDS = {
  title: 'Inside the Gripper blocks',
  /** above the left pictures */
  blockHeading: 'Gripper block (only in this simulator)',
  /** above the right pictures */
  codeHeading: 'The same in mBlock: a My Block you make',
  /** the same two, short: on a phone they stand above every picture */
  blockCaption: 'Gripper block',
  codeCaption: 'The same in mBlock',
  addButton: 'Add these My Blocks to my program',
  addHint: 'Puts the five My Blocks into your workspace. You can change them like any My Block.',
  convertButton: 'Show my program the mBlock way',
  convertHint: 'Swaps every Gripper block of your program for its My Block.',
  drawing: 'Drawing the blocks…',
  drawingFailed: 'The blocks could not be drawn. Please reload the page.',
  notReady: 'The block editor is still loading. Try again in a moment.',
  failed: 'That did not work. Your blocks were not changed.',
} as const;

/** The sentences at the top of the window. The servo names come from the robot. */
export function gripperCodeIntro(config: RobotConfig): string[] {
  const g = config.gripper;
  return [
    'mBlock has no Gripper category: the Gripper blocks are shortcuts that only this simulator has.',
    'In mBlock you make them yourself as My Blocks: a "set servo" block, then a short wait while the servo moves.',
    `On this robot servo ${g.liftServo} moves the arm and servo ${g.clawServo} moves the claw.`,
  ];
}

/** "gripper opens, gripper closes and arm raises" */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const UNDO_ADD = 'Close this window to see them; you also find them under My Blocks. Undo takes them out again.';

/** What the window says after "Add these My Blocks to my program". */
export function addedMessage(change: Pick<GripperChange, 'added' | 'myBlocks'>): string {
  const added = change.added.length;
  const total = Object.keys(change.myBlocks).length;
  if (added === 0) return `Nothing was added: all ${total} My Blocks are already in your program. Look under My Blocks.`;
  if (added === total) return `${added} My Blocks were added to your program. ${UNDO_ADD}`;
  const already = total - added;
  return (
    `${added} My Block${added === 1 ? ' was' : 's were'} added to your program: ${listOf(change.added)}. ` +
    `The other ${already === 1 ? 'one was' : `${already} were`} already there. ${UNDO_ADD}`
  );
}

/** What the window says after "Show my program the mBlock way". */
export function convertedMessage(change: Pick<GripperChange, 'replaced' | 'added'>): string {
  const replaced = change.replaced;
  if (replaced === 0) return 'Your program has no Gripper blocks, so there is nothing to change.';
  const swapped = replaced === 1 ? '1 Gripper block was replaced by its My Block.' : `${replaced} Gripper blocks were replaced by their My Blocks.`;
  return `${swapped} Close this window to see your program. Undo brings the Gripper blocks back.`;
}
