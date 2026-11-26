/**
 * The language of the blocks: English, or French on the page of Robot en fête 2027.
 *
 * The language belongs to a WORKSPACE, not to the page: the editor of the French page is a French
 * workspace, and so are the little read-only workspaces of the window "Inside the Gripper blocks"
 * on that page. A workspace nobody marked is English - every editor of every English page, and
 * every workspace of the tests. A block asks its workspace when it is made; a block in the open
 * palette (a "flyout") asks the editor that palette belongs to.
 *
 *   setWorkspaceLocale(workspace, 'fr')     right after Blockly.inject, before any block is loaded
 *   localeOfWorkspace(block.workspace)      'en' | 'fr'
 *
 * The blocks are the same in both languages: the same types, fields and stored values. Only what
 * the student reads changes (./fr.ts), so a program moves between the two pages unchanged.
 *
 * Blockly's own words (Blockly.Msg: "define", "Make a Variable", the menus, the screen-reader
 * labels) are ONE object for the whole page. This file is the only one that writes it:
 * applyBlocklyMessages() sets the words of one language (createEditor calls it, in the editor's
 * language, before it makes the workspace), and withBlocklyMessage() changes one word for the
 * moment of one call. registerBlocks() - which the Gripper window calls too - writes none, so it
 * can never turn the words of a French editor back into English.
 *
 * Needs no Blockly at import time: the caller hands the Blockly module in (as ./register.ts).
 */
import type * as BlocklyModule from 'blockly';
import { FR_BLOCKLY_MSG } from './fr';

/** The language of a workspace's blocks. */
export type BlockLocale = 'en' | 'fr';

type BlocklyWithMessages = Pick<typeof BlocklyModule, 'Msg'>;

// =============================================================================================
// The language of a workspace
// =============================================================================================

const workspaceLocales = new WeakMap<BlocklyModule.Workspace, BlockLocale>();

/** Mark a workspace as English or French. Call it right after Blockly.inject, before blocks are loaded into it. */
export function setWorkspaceLocale(workspace: BlocklyModule.Workspace, locale: BlockLocale): void {
  workspaceLocales.set(workspace, locale);
}

/**
 * The language of the blocks of a workspace: what setWorkspaceLocale said, else English. A palette
 * (flyout) and the trash can's list speak the language of the editor they belong to.
 */
export function localeOfWorkspace(workspace: BlocklyModule.Workspace | null | undefined): BlockLocale {
  if (!workspace) return 'en';
  const svg = workspace as BlocklyModule.WorkspaceSvg;
  const editor = svg.isFlyout && svg.targetWorkspace ? svg.targetWorkspace : workspace;
  return workspaceLocales.get(editor) ?? 'en';
}

// =============================================================================================
// Blockly's own words
// =============================================================================================

/**
 * Scratch / mBlock words for the Blockly built-ins we show (My Blocks, variable dialogs), in English.
 * (They were written by registerBlocks until the blocks had a French version; the same ten keys.)
 */
const SCRATCH_WORDS: Readonly<Record<string, string>> = {
  PROCEDURES_DEFNORETURN_TITLE: 'define',
  PROCEDURES_DEFNORETURN_PROCEDURE: 'my block',
  PROCEDURES_DEFNORETURN_TOOLTIP: 'Make your own block: the blocks inside run each time the block is used.',
  PROCEDURES_DEFRETURN_TITLE: 'define',
  PROCEDURES_DEFRETURN_PROCEDURE: 'my value',
  PROCEDURES_DEFRETURN_TOOLTIP: 'Make your own round block: it runs the blocks inside and gives back a value.',
  PROCEDURES_CALLNORETURN_TOOLTIP: "Runs your block '%1'.",
  PROCEDURES_CALLRETURN_TOOLTIP: "Runs your block '%1' and uses the value it gives back.",
  NEW_VARIABLE: 'Make a Variable',
  NEW_VARIABLE_TITLE: 'New variable name:',
};

/** Blockly's own English, as it was before anything was written (kept by the first call below). */
let blocklyEnglish: Record<string, string> | null = null;

/**
 * Set Blockly's own words for an editor in this language:
 *   'en'  Blockly's English as it came, then the Scratch words above - what every English page
 *         has always had;
 *   'fr'  Blockly's English, then Blockly's French file (`frenchMessages`: the strings of
 *         `blockly/msg/fr`, which the French page loads), then ours (./fr.ts FR_BLOCKLY_MSG).
 * Each call starts again from Blockly's English, so the words of one language never stay behind
 * in the other: an English editor after a French one (the site's links, no reload) is English
 * again, key for key.
 */
export function applyBlocklyMessages(Blockly: BlocklyWithMessages, locale: BlockLocale, frenchMessages: Readonly<Record<string, string>> = {}): void {
  const msg = Blockly.Msg as Record<string, string>;
  if (!blocklyEnglish) blocklyEnglish = { ...msg };
  for (const key of Object.keys(msg)) if (!(key in blocklyEnglish)) delete msg[key];
  Object.assign(msg, blocklyEnglish);
  if (locale === 'fr') Object.assign(msg, frenchMessages, FR_BLOCKLY_MSG);
  else Object.assign(msg, SCRATCH_WORDS);
}

/**
 * One of Blockly's words changed for the moment of one call, then put back as it was. Blockly has
 * one question for the dialog that names a new variable ("New variable name:") and reads it when
 * the dialog opens: the "Make a List" button asks its own question this way.
 */
export function withBlocklyMessage(Blockly: BlocklyWithMessages, key: string, text: string, run: () => void): void {
  const msg = Blockly.Msg as Record<string, string>;
  const before = msg[key];
  msg[key] = text;
  try {
    run();
  } finally {
    msg[key] = before;
  }
}

/** The strings of a module of Blockly's messages (`import('blockly/msg/fr')`): every other export left out. */
export function blocklyMessagesOf(module: Readonly<Record<string, unknown>>): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const [key, value] of Object.entries(module)) if (typeof value === 'string') messages[key] = value;
  return messages;
}
