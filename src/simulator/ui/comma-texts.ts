/**
 * The texts of a program that look like a number with a decimal comma - "30,5" typed into the
 * white bubble of "mettre … à" or of a comparison - for the warning of the French screen.
 *
 * On the French page every number is written with a comma (18,9 cm), and a NUMBER bubble reads
 * a typed comma as the decimal point (../blocks/number-field.ts). But the bubbles of "mettre … à"
 * and of "<", ">" and "=" are bubbles of TEXT, as in mBlock and Scratch: what is typed there is a
 * text, and the program counts a text like "30,5" as no number at all (0 in a sum; a comparison
 * of texts compares letters). The robot does the same, so the simulator keeps it - and the screen
 * says so when Start is pressed (../text/fr-console.tsx commaTextWarning; the English screen,
 * which writes a decimal point, says nothing).
 *
 * No words here: plain data in, the typed texts out.
 */
import type { BlockJson, ProgramJson } from '../core/types';

/** The text bubbles of these blocks are read as numbers when they hold one: the comparisons, and the value a variable is set to. */
const NUMBER_TEXT_INPUTS: Readonly<Record<string, readonly string[]>> = {
  operator_lt: ['OPERAND1', 'OPERAND2'],
  operator_gt: ['OPERAND1', 'OPERAND2'],
  operator_equals: ['OPERAND1', 'OPERAND2'],
  data_setvariableto: ['VALUE'],
  variables_set: ['VALUE'],
};

/** "30,5", ",5", "-0,5", "30," - a number written with a decimal comma (and nothing else). */
const COMMA_NUMBER = /^\s*[-+]?(\d+,\d*|,\d+)\s*$/;

/**
 * Every text typed into such a bubble that is a number with a decimal comma, in the order of the
 * program (each block, its inputs and the blocks under it). A bubble covered by a round block is
 * not read: the block's value is.
 */
export function commaNumberTexts(program: ProgramJson): string[] {
  const found: string[] = [];
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    const watched = NUMBER_TEXT_INPUTS[block.type] ?? [];
    for (const [name, input] of Object.entries(block.inputs ?? {})) {
      const shadow = input.shadow;
      if (watched.includes(name) && !input.block && shadow?.type === 'text') {
        const typed = shadow.fields?.TEXT;
        if (typeof typed === 'string' && COMMA_NUMBER.test(typed)) found.push(typed.trim());
      }
      visit(input.block);
    }
    visit(block.next?.block);
  };
  for (const top of program.blocks?.blocks ?? []) visit(top);
  return found;
}
