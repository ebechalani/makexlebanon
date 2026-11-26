/**
 * The words of the window "Inside the Gripper blocks" (../GripperCodeDialog.tsx) in the word table
 * of the screen (./types.ts ScreenText.gripper): what they are, and the English.
 *
 * English is not new: its strings and its three text functions are those of ../gripper-code-words.ts
 * (referenced, not copied - that file's tests keep testing them), and the two picture descriptions
 * are moved here from the window as they were. The French twin is ./fr-gripper.tsx, a file of its
 * own: the English word table imports this one, and an English page must not download French.
 *
 * The names in these sentences - the My Blocks a button added, a block's label - come from the
 * blocks (../../blocks/gripper-original.ts), in the language of the page.
 */
import type { GripperChange } from '../../blocks/gripper-original';
import type { RobotConfig } from '../../core/types';
import { addedMessage, convertedMessage, GRIPPER_CODE_WORDS, gripperCodeIntro } from '../gripper-code-words';

export interface GripperText {
  /** the title of the window */
  title: string;
  /** above the left pictures */
  blockHeading: string;
  /** above the right pictures */
  codeHeading: string;
  /** the same two, short: on a phone they stand above every picture */
  blockCaption: string;
  codeCaption: string;
  addButton: string;
  addHint: string;
  convertButton: string;
  convertHint: string;
  /** while Blockly draws the pictures */
  drawing: string;
  drawingFailed: string;
  /** a button was pressed before the student's editor was ready */
  notReady: string;
  /** a button could not change the program */
  failed: string;
  /** the sentences at the top of the window; the servo names come from the robot */
  intro(config: RobotConfig): string[];
  /** what the window says after "Add these My Blocks to my program" */
  addedMessage(change: Pick<GripperChange, 'added' | 'myBlocks'>): string;
  /** what the window says after "Show my program the mBlock way" */
  convertedMessage(change: Pick<GripperChange, 'replaced' | 'added'>): string;
  /** what a screen reader says for the picture of a Gripper block (`label`: the block in words) */
  blockPicture(label: string): string;
  /** ... and for the picture of its My Block (`lines`: one block per line, in words) */
  codePicture(lines: readonly string[]): string;
}

export const EN_GRIPPER_TEXT: GripperText = {
  title: GRIPPER_CODE_WORDS.title,
  blockHeading: GRIPPER_CODE_WORDS.blockHeading,
  codeHeading: GRIPPER_CODE_WORDS.codeHeading,
  blockCaption: GRIPPER_CODE_WORDS.blockCaption,
  codeCaption: GRIPPER_CODE_WORDS.codeCaption,
  addButton: GRIPPER_CODE_WORDS.addButton,
  addHint: GRIPPER_CODE_WORDS.addHint,
  convertButton: GRIPPER_CODE_WORDS.convertButton,
  convertHint: GRIPPER_CODE_WORDS.convertHint,
  drawing: GRIPPER_CODE_WORDS.drawing,
  drawingFailed: GRIPPER_CODE_WORDS.drawingFailed,
  notReady: GRIPPER_CODE_WORDS.notReady,
  failed: GRIPPER_CODE_WORDS.failed,
  intro: gripperCodeIntro,
  addedMessage,
  convertedMessage,
  blockPicture: (label) => `Gripper block: ${label}`,
  codePicture: (lines) => `My Block: ${lines.join(', ')}`,
};
