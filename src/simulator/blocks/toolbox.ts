/**
 * The toolbox: the palette of blocks on the left of the editor, in mBlock order and colours.
 *
 * It is built from the catalog and is PURE DATA (Blockly's "toolbox JSON" format), so importing
 * this file needs neither Blockly nor a browser:
 *
 *   Blockly.inject(div, { toolbox: TOOLBOX, ... })
 *
 * Every number / text slot gets its white bubble (a "shadow" block) with the default value, like
 * in Scratch: the student can type into it or drop a round block on top of it.
 *
 * Two categories fill themselves while the editor runs:
 *   - Variables  (custom: 'VARIABLE')  -> see variablesFlyout() in register.ts
 *   - My Blocks  (custom: 'PROCEDURE') -> Blockly's own "functions" category
 *
 * One category starts with a few words and a button: Gripper. Real mBlock has no such category
 * (its blocks are shortcuts made for the simulator), and the button shows the code they stand for.
 */
import { BLOCKS, CATEGORIES, fieldArgs, fieldDefault, getBlockDef, getCategory, valueInputs } from './catalog';
import type { CategoryId, ShadowSpec } from './catalog';

// =============================================================================================
// Types (the subset of Blockly's toolbox JSON we produce)
// =============================================================================================

export interface ToolboxShadow {
  type: 'math_number' | 'text';
  fields: Record<string, number | string>;
}

export interface ToolboxBlock {
  kind: 'block';
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { shadow: ToolboxShadow }>;
}

export interface ToolboxSeparator {
  kind: 'sep';
  /** pixels between the block above and the block below */
  gap: number;
}

export interface ToolboxButton {
  kind: 'button';
  text: string;
  callbackkey: string;
}

export interface ToolboxLabel {
  kind: 'label';
  text: string;
}

export type ToolboxItem = ToolboxBlock | ToolboxSeparator | ToolboxButton | ToolboxLabel;

export interface ToolboxCategory {
  kind: 'category';
  name: string;
  colour: string;
  /** our category id; lets the editor find / select a category */
  toolboxitemid: CategoryId;
  /** static categories: their blocks */
  contents?: ToolboxItem[];
  /** dynamic categories: the name of the Blockly callback that produces the blocks */
  custom?: string;
}

export interface ToolboxJson {
  kind: 'categoryToolbox';
  contents: ToolboxCategory[];
}

/** Space left above a block that starts a new group inside a category. */
export const GROUP_GAP = 40;

/** Space between two lines of words at the top of a category. */
const LINE_GAP = 6;

/**
 * The button at the top of the Gripper category, and the entry of the same name in the menu that
 * a right-click (or a long press) on a Gripper block opens: both show the window "Inside the
 * Gripper blocks". register.ts connects the two to whoever shows that window.
 */
export const SEE_MBLOCK_CODE = 'See the real mBlock code';
export const GRIPPER_CODE_CALLBACK = 'MBOT2_GRIPPER_CODE';

/**
 * What a category shows above its blocks.
 * Gripper: mBlock has no Gripper category. A student who only knows the simulator would look for
 * these blocks in mBlock and not find them, so the palette says what they are.
 */
const CATEGORY_INTRO: Partial<Record<CategoryId, ToolboxItem[]>> = {
  gripper: [
    { kind: 'label', text: 'Shortcuts made for this simulator.' },
    { kind: 'sep', gap: LINE_GAP },
    { kind: 'label', text: 'mBlock does not have these blocks.' },
    { kind: 'button', text: SEE_MBLOCK_CODE, callbackkey: GRIPPER_CODE_CALLBACK },
  ],
};

// =============================================================================================
// Builders
// =============================================================================================

/** The white bubble for a slot. */
export function shadowFor(spec: ShadowSpec): ToolboxShadow {
  return spec.kind === 'number'
    ? { type: 'math_number', fields: { NUM: spec.value } }
    : { type: 'text', fields: { TEXT: spec.value } };
}

/**
 * Toolbox entry of one catalog block, with its default bubbles.
 * `fields` lets you preset dropdowns (e.g. the variable to show in a "set ... to" block).
 */
export function toolboxBlock(type: string, fields?: Record<string, unknown>): ToolboxBlock {
  const def = getBlockDef(type);
  if (!def) throw new Error(`toolboxBlock: "${type}" is not in the block catalog.`);
  const entry: ToolboxBlock = { kind: 'block', type };

  const presetFields: Record<string, unknown> = {};
  for (const arg of fieldArgs(def)) {
    if (fields && arg.name in fields) presetFields[arg.name] = fields[arg.name];
    else if (arg.type !== 'field_variable') {
      const value = fieldDefault(arg);
      if (value !== undefined) presetFields[arg.name] = value;
    }
  }
  if (Object.keys(presetFields).length > 0) entry.fields = presetFields;

  const inputs: Record<string, { shadow: ToolboxShadow }> = {};
  for (const arg of valueInputs(def)) {
    if (arg.shadow) inputs[arg.name] = { shadow: shadowFor(arg.shadow) };
  }
  if (Object.keys(inputs).length > 0) entry.inputs = inputs;
  return entry;
}

/** What one static category shows: its few words (if it has any), then its blocks in catalog order, with gaps between groups. */
export function categoryContents(id: CategoryId): ToolboxItem[] {
  const items: ToolboxItem[] = (CATEGORY_INTRO[id] ?? []).map((item) => ({ ...item }));
  let blocks = 0;
  for (const def of BLOCKS) {
    if (def.category !== id || def.hidden) continue;
    if (def.gapBefore && blocks > 0) items.push({ kind: 'sep', gap: GROUP_GAP });
    items.push(toolboxBlock(def.type));
    blocks++;
  }
  return items;
}

/**
 * Build the toolbox. Without argument: every category, in catalog (mBlock) order. With a list of
 * category ids: only those categories, in the order you list them (for example a beginner set
 * that starts with Events and the chassis and leaves the sensors out).
 */
export function buildToolbox(only?: CategoryId[]): ToolboxJson {
  const contents: ToolboxCategory[] = [];
  const wanted = only ? only.map((id) => getCategory(id)) : CATEGORIES;
  for (const category of wanted) {
    if (contents.some((entry) => entry.toolboxitemid === category.id)) continue; // listed twice
    const entry: ToolboxCategory = {
      kind: 'category',
      name: category.name,
      colour: category.colour,
      toolboxitemid: category.id,
    };
    if (category.custom) entry.custom = category.custom;
    else entry.contents = categoryContents(category.id);
    contents.push(entry);
  }
  return { kind: 'categoryToolbox', contents };
}

/** The complete toolbox with every category. */
export const TOOLBOX: ToolboxJson = buildToolbox();

/** Every block type a toolbox mentions (blocks and their shadows), for checks and tests. */
export function toolboxBlockTypes(toolbox: ToolboxJson = TOOLBOX): string[] {
  const types = new Set<string>();
  for (const category of toolbox.contents) {
    for (const item of category.contents ?? []) {
      if (item.kind !== 'block') continue;
      types.add(item.type);
      for (const slot of Object.values(item.inputs ?? {})) types.add(slot.shadow.type);
    }
  }
  return [...types];
}
