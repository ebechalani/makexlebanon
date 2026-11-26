/**
 * How much room a stack of blocks needs on the workspace, worked out without a browser.
 *
 * Two things place stacks next to each other and must not put one on top of another:
 *   - the program builder (vm/builder.ts), which lays out the scripts of a program written in code;
 *   - the "original code" of the Gripper blocks (./gripper-original.ts), which adds My Blocks to a
 *     student's program and has to put them beside what is already there.
 *
 * A French workspace (Robot en fête 2027) draws the same blocks with French rows, which are often
 * longer: give the Sizer (or estimateStackWidth) the locale 'fr' and it counts the French words
 * (./fr.ts). Left out, English: the widths every English program has always had.
 *
 * Plain TypeScript: no DOM, no Blockly.
 */
import { getBlockDef } from './catalog';
import type { BlockArg, BlockDef } from './catalog';
import { FR_BLOCKS, FR_DEFAULT_TEXTS } from './fr';
import type { BlockLocale } from './locale';
import type { BlockJson, VariableJson } from '../core/types';

/** Where the first script is put, and the free space between two scripts (workspace pixels). */
export const FIRST_X = 40;
export const FIRST_Y = 40;
export const COLUMN_GAP = 60;

// There is no browser to measure text with here, so letters are counted. The numbers below were
// compared with what Blockly really draws (zelos renderer, 100 % zoom) and are a little generous:
// a guess that is too wide only makes the gap between two scripts wider, never an overlap.
/** one letter */
const CHAR_WIDTH = 8.5;
/** left + right edge of a block */
const ROW_PADDING = 24;
/** space between two parts of a row (a word, a dropdown, a bubble ...) */
const PART_GAP = 12;
/** frame and arrow of a dropdown */
const DROPDOWN_EXTRA = 44;
/** frame of a white bubble or a text box, and the narrowest bubble */
const BUBBLE_EXTRA = 30;
const BUBBLE_MIN = 46;
/** an empty pointed or round slot */
const EMPTY_SLOT = 52;
/** the colour swatch of the LED block */
const COLOUR_SWATCH = 44;
/** blocks inside a C-shaped block start this much further to the right */
const INDENT = 20;
/** a C-shaped block is never narrower than this, even when it is empty */
const C_BLOCK_MIN = 170;
/** the rounded or pointed ends of a value block */
const VALUE_ENDS = 10;
/** a stackable block that starts with a dropdown is drawn with some free space before it */
const LEADING_FIELD = 36;
/** the two small icons (gear, "?") at the start of a my-block definition */
const DEFINITION_ICONS = 60;
/** the "?" icon of a block that carries a note */
const NOTE_ICON = 30;

const letters = (text: string): number => text.length * CHAR_WIDTH;

/** The words of Blockly's own blocks that a row shows, per language (Blockly.Msg: ./locale.ts). */
const BUILT_IN_WORDS: Readonly<Record<BlockLocale, { define: string; with: string; return: string; if: string; false: string }>> = {
  en: { define: 'define', with: 'with:', return: 'return', if: 'if', false: 'false' },
  fr: { define: 'définir', with: 'avec :', return: 'retourner', if: 'si', false: 'faux' },
};

/** A note on a block as Blockly saves it: closed (only the "?" icon shows) until it is clicked. */
export function noteState(text: string): { text: string; pinned: boolean; width: number; height: number } {
  const lines = Math.max(2, Math.ceil(text.length / 30));
  return { text, pinned: false, width: 240, height: Math.min(200, 24 + lines * 18) };
}

/**
 * Rough width (workspace pixels at 100 % zoom) of a stack of blocks as Blockly draws it, given its
 * top block. The program builder uses it to place the scripts; a check against the real editor
 * makes sure the guess is never too small.
 */
export function estimateStackWidth(top: BlockJson, variables: VariableJson[] = [], locale: BlockLocale = 'en'): number {
  return new Sizer(new Map(variables.map((v) => [v.id, v.name])), locale).stack(top);
}

/** Estimates how wide blocks are drawn (see the constants above), in the words of a language. */
export class Sizer {
  constructor(
    private readonly variableNames: Map<string, string>,
    private readonly locale: BlockLocale = 'en',
  ) {}

  /** The text of row `index` of a block (0 = its first row) in the language of the sizer. */
  private message(def: BlockDef, index: number): string {
    const english = index === 0 ? def.message : (def.rows?.[index - 1]?.message ?? '');
    if (this.locale !== 'fr') return english;
    const french = FR_BLOCKS[def.type];
    return (index === 0 ? french?.message : french?.rows?.[index - 1]) ?? english;
  }

  /** What a menu shows for its value, in the language of the sizer. */
  private optionText(def: BlockDef, arg: Extract<BlockArg, { type: 'field_dropdown' }>, stored: unknown): string {
    const index = Math.max(0, arg.options.findIndex(([, value]) => value === stored));
    const english = arg.options[index][0];
    return this.locale === 'fr' ? (FR_BLOCKS[def.type]?.options?.[arg.name]?.[index] ?? english) : english;
  }

  /** A default word (a variable's name, a text) in the language of the sizer. */
  private word(text: string): string {
    return this.locale === 'fr' && Object.prototype.hasOwnProperty.call(FR_DEFAULT_TEXTS, text) ? FR_DEFAULT_TEXTS[text] : text;
  }

  /** Width of a stack of blocks: its widest block, the blocks nested inside C-shaped blocks included. */
  stack(first: BlockJson | undefined): number {
    let widest = 0;
    for (let block = first; block; block = block.next?.block) widest = Math.max(widest, this.block(block));
    return widest;
  }

  private block(block: BlockJson): number {
    const def = getBlockDef(block.type);
    if (!def) return this.builtIn(block);
    const first = this.message(def, 0);
    let widest = this.row(block, def, first, def.args);
    if (block.icons) widest += NOTE_ICON;
    if (def.shape === 'reporter' || def.shape === 'boolean') widest += VALUE_ENDS;
    else if (/^%\d/.test(first) && def.args.length > 0 && def.args[0].type !== 'input_value') widest += LEADING_FIELD;
    for (const [i, row] of (def.rows ?? []).entries()) {
      widest = Math.max(widest, this.row(block, def, this.message(def, i + 1), row.args ?? []));
      for (const arg of row.args ?? []) {
        if (arg.type === 'input_statement') widest = Math.max(widest, C_BLOCK_MIN, INDENT + this.stack(block.inputs?.[arg.name]?.block));
      }
    }
    return widest;
  }

  /** One row of a catalog block: its words, fields and value slots side by side. */
  private row(block: BlockJson, def: BlockDef, message: string, args: BlockArg[]): number {
    const parts: number[] = [];
    for (const label of message.split(/%\d+/)) {
      if (label.trim() !== '') parts.push(letters(label.trim()));
    }
    for (const arg of args) {
      switch (arg.type) {
        case 'input_statement':
          break;
        case 'input_value':
          parts.push(this.slot(block, arg.name));
          break;
        case 'field_dropdown':
          parts.push(letters(this.optionText(def, arg, block.fields?.[arg.name])) + DROPDOWN_EXTRA);
          break;
        case 'field_input':
          parts.push(letters(String(block.fields?.[arg.name] ?? this.word(arg.text))) + BUBBLE_EXTRA);
          break;
        case 'field_variable': {
          const ref = block.fields?.[arg.name] as { id?: string } | undefined;
          parts.push(letters(this.variableNames.get(ref?.id ?? '') ?? this.word(arg.variable)) + DROPDOWN_EXTRA);
          break;
        }
        case 'field_colour':
          parts.push(COLOUR_SWATCH);
          break;
      }
    }
    return this.sum(parts);
  }

  private sum(parts: number[]): number {
    return ROW_PADDING + parts.reduce((total, part) => total + part, 0) + PART_GAP * Math.max(0, parts.length - 1);
  }

  /** What sits in a value slot: a dropped-in block, else the white bubble, else nothing. */
  private slot(block: BlockJson, name: string): number {
    const slot = block.inputs?.[name];
    const child = slot?.block ?? slot?.shadow;
    if (!child) return EMPTY_SLOT;
    if (child.type === 'math_number') return Math.max(BUBBLE_MIN, letters(String(child.fields?.NUM ?? '')) + BUBBLE_EXTRA);
    if (child.type === 'text') return Math.max(BUBBLE_MIN, letters(String(child.fields?.TEXT ?? '')) + BUBBLE_EXTRA);
    return this.block(child);
  }

  /** Blockly's own blocks: my-block definitions and calls, plain variable blocks. */
  private builtIn(block: BlockJson): number {
    const state = (block.extraState ?? {}) as { name?: unknown; params?: unknown };
    const words = BUILT_IN_WORDS[this.locale];
    switch (block.type) {
      case 'procedures_defnoreturn':
      case 'procedures_defreturn': {
        const params = Array.isArray(state.params) ? state.params.map((p) => String((p as { name?: unknown }).name ?? '')) : [];
        const title = `${words.define} ${String(block.fields?.NAME ?? '')}${params.length > 0 ? ` ${words.with} ${params.join(', ')}` : ''}`;
        let widest = letters(title) + BUBBLE_EXTRA + DEFINITION_ICONS + ROW_PADDING;
        widest = Math.max(widest, INDENT + this.stack(block.inputs?.STACK?.block));
        if (block.type === 'procedures_defreturn') widest = Math.max(widest, this.sum([letters(words.return), this.slot(block, 'RETURN')]) + INDENT);
        return widest;
      }
      case 'procedures_callnoreturn':
      case 'procedures_callreturn': {
        const params = Array.isArray(state.params) ? state.params.map(String) : [];
        // the name on the first row, then one row per value: "name" (value)
        let widest = this.sum([letters(`${String(state.name ?? '')}${params.length > 0 ? ` ${words.with}` : ''}`)]);
        params.forEach((param, i) => (widest = Math.max(widest, this.sum([letters(param), this.slot(block, `ARG${i}`)]))));
        return widest;
      }
      case 'procedures_ifreturn':
        return this.sum([letters(words.if), this.slot(block, 'CONDITION'), letters(words.return), this.slot(block, 'VALUE')]);
      case 'logic_boolean':
        return this.sum([letters(words.false) + DROPDOWN_EXTRA]);
      default: {
        // anything else: its fields and slots side by side
        const parts: number[] = [letters(block.type)];
        for (const name of Object.keys(block.inputs ?? {})) parts.push(this.slot(block, name));
        return this.sum(parts);
      }
    }
  }
}
