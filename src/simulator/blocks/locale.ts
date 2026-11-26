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
// (our French for Blockly's words, ./fr.ts, is read through ./french.ts: an English page never downloads it)
import { frenchWords } from './french';

/** The language of a workspace's blocks. */
export type BlockLocale = 'en' | 'fr';

type BlocklyWithMessages = Pick<typeof BlocklyModule, 'Msg'>;

/** What the names of the keys of a shortcut are read from (Blockly's own module). */
type BlocklyWithShortcuts = Pick<typeof BlocklyModule, 'Msg' | 'ShortcutRegistry' | 'utils'>;

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
  if (locale === 'fr') {
    Object.assign(msg, frenchMessages, frenchWords().FR_BLOCKLY_MSG);
    // (the shortcuts in Blockly's French sentences, with the French names of the keys: see below)
    if (hasShortcuts(Blockly)) {
      for (const [key, shortcut] of Object.entries(SHORTCUTS_IN_MESSAGES)) {
        const keys = frenchShortcutKeys(Blockly, shortcut);
        if (keys !== '' && typeof msg[key] === 'string') msg[key] = msg[key].replace('%1', keys);
      }
    }
  } else Object.assign(msg, SCRATCH_WORDS);
}

// =============================================================================================
// The names of the keys of a shortcut, in French ("Ctrl + Z", "Alt + Maj + A")
// =============================================================================================
// Blockly writes a shortcut itself - in its right-click menus ("Annuler   Ctrl + Z") and in a few
// of its sentences (the toast "Copié. Appuie sur %1 pour coller.", the screen-reader hint). It takes
// the names of Ctrl, Alt and ⌘ from a little table it makes ONCE, when its code is loaded: before
// any page has set its words, so with its English "Control"; and it writes the Shift key as the
// name it has in the shortcut, "Shift". Nothing a page sets changes that table, so on the French
// page Blockly would write "Annuler Control + Z" and "Alt + Shift + A".
//
// So the French page writes these shortcuts itself, exactly as Blockly does (the same keys, in
// the same order, the same choice of one shortcut for this computer), with the names of Blockly's
// own French file: "Ctrl", "Maj", "Alt" ("⌘" and "⌥" on a Mac, as Blockly writes them) - the names
// the strip above the blocks uses too ("Annuler (Ctrl+Z)", "Rétablir (Ctrl+Maj+Z)"). The sentences
// get them here, with their %1 already filled in (Blockly's own filling then finds no %1 left);
// the right-click menus get them in ./register.ts (frenchMenuShortcuts). English pages never come
// here: their Blockly writes its shortcuts as it always has.

/** Blockly's sentences into which Blockly puts a shortcut (%1), and the shortcut it puts there. */
export const SHORTCUTS_IN_MESSAGES: Readonly<Record<string, string>> = {
  KEYBOARD_NAV_COPIED_HINT: 'paste',
  KEYBOARD_NAV_CUT_HINT: 'paste',
  SCREENREADER_HINT: 'toggle_screenreader',
  SCREENREADER_MODE_ENABLED: 'toggle_screenreader',
  SCREENREADER_MODE_DISABLED: 'toggle_screenreader',
  KEYBOARD_NAV_FLYOUT_LABEL_HINT: 'next_heading',
  HELP_PROMPT: 'list_shortcuts',
};

function hasShortcuts(Blockly: BlocklyWithMessages): Blockly is BlocklyWithShortcuts {
  return 'ShortcutRegistry' in Blockly && 'utils' in Blockly;
}

/** The order Blockly writes the modifier keys in; every other key comes after them. */
const MODIFIER_ORDER = ['Meta', 'Control', 'Alt', 'Shift'];
const modifierRank = (key: string): number => (MODIFIER_ORDER.includes(key) ? MODIFIER_ORDER.indexOf(key) : Number.MAX_VALUE);

/** The keys with a name of their own, by key code, as Blockly names them (the words in Blockly.Msg: Blockly's French file on the French page). */
const KEY_CODE_NAMES: Readonly<Record<number, string>> = {
  8: 'BACKSPACE_KEY', 9: 'TAB_KEY', 13: 'ENTER_KEY', 16: 'SHIFT_KEY', 17: 'CONTROL_KEY', 18: 'ALT_KEY', 19: 'PAUSE_KEY',
  20: 'CAPS_LOCK_KEY', 27: 'ESCAPE', 32: 'SPACE_KEY', 33: 'PAGE_UP_KEY', 34: 'PAGE_DOWN_KEY', 35: 'END_KEY', 36: 'HOME_KEY',
  45: 'INSERT_KEY', 46: 'DELETE_KEY', 93: 'CONTEXT_MENU_KEY',
}; // prettier-ignore

/** The keys Blockly writes as a sign, by key code. */
const KEY_CODE_SIGNS: Readonly<Record<number, string>> = {
  37: '←', 38: '↑', 39: '→', 40: '↓', 106: '×', 107: '+', 109: '−', 110: '.', 111: '÷', 59: ';', 61: '=', 186: ';', 187: '=',
  189: '-', 188: ',', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'", 224: '⌘',
}; // prettier-ignore

/** The name of one key of a shortcut, in the words of Blockly.Msg (French on the French page). */
function keyName(key: string, msg: Readonly<Record<string, string>>, mac: boolean): string {
  let name: string;
  if (key === 'Control') name = msg.CONTROL_KEY;
  else if (key === 'Shift') name = msg.SHIFT_KEY;
  else if (key === 'Alt') name = mac ? '⌥' : msg.ALT_KEY;
  else if (key === 'Meta') name = '⌘';
  else if (Number.isFinite(Number(key))) {
    const code = Number(key);
    if (code >= 65 && code <= 90) name = String.fromCharCode(code);
    else if (code >= 48 && code <= 57) name = String(code - 48);
    else if (code >= 96 && code <= 105) name = String(code - 96);
    else if (code >= 112 && code <= 123) name = `F${code - 111}`;
    else name = KEY_CODE_NAMES[code] ? msg[KEY_CODE_NAMES[code]] : (KEY_CODE_SIGNS[code] ?? String.fromCharCode(code));
  } else name = key;
  name = name ?? key;
  return name.charAt(0).toUpperCase() + name.substring(1);
}

/**
 * A shortcut as Blockly writes it in a menu or a sentence ("Ctrl + Z"; on a Mac "⌘ Z"), with the
 * names of the keys in Blockly.Msg - French once applyBlocklyMessages has set the French words.
 * The same rules as Blockly's own: of the shortcut's key combinations, those for this computer (a
 * Mac uses ⌘), the shortest first, and only the first of them once a modifier key is in one. '' for
 * a shortcut that has no keys (or does not exist).
 */
export function frenchShortcutKeys(Blockly: BlocklyWithShortcuts, shortcutName: string): string {
  const msg = Blockly.Msg as Record<string, string>;
  const mac = Blockly.utils.userAgent.MAC;
  const combos = Blockly.ShortcutRegistry.registry.getKeyCodesByShortcutName(shortcutName).map((code) => code.split('+'));
  if (combos.length === 0) return '';
  combos.forEach((combo) => combo.sort((a, b) => modifierRank(a) - modifierRank(b)));
  combos.sort((a, b) => (b.includes('Meta') ? 1 : 0) - (a.includes('Meta') ? 1 : 0));
  const here = combos.filter((combo) => combo.includes('Meta') === mac);
  const chosen = here.length === 0 ? combos : here;
  chosen.sort((a, b) => a.length - b.length);
  return chosen[0].map((key) => keyName(key, msg, mac)).join(mac ? ' ' : ' + ');
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
