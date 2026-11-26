/**
 * The decimal comma in the number bubbles of a French workspace (Robot en fête 2027).
 *
 * The French screen writes its numbers with a comma (18,9 cm on the ruler, 0,5× ...), and a French
 * student types one: "18,9". Blockly's own number field reads a comma as a thousands separator and
 * drops it - "18,9" became 189 and "0,5" became 5. In a French workspace the number bubbles
 * (Blockly's `math_number`, field NUM) therefore get the field below, which reads a comma as the
 * decimal point and then checks the number exactly as Blockly does: "18,9" -> 18.9, ",5" -> 0.5,
 * "1,5,3" is no number (the bubble keeps its value). It shows the number as Blockly does ("18.9"),
 * the way mBlock and Scratch show numbers.
 *
 * Only the field's class differs, never what is saved: a program keeps `"NUM": 18.9`, the same
 * on both pages. English workspaces keep Blockly's own field: there nothing changes.
 *
 * register.ts puts the field into the bubbles (registerBlocks, the French workspaces only).
 * Built as a function because the class has to extend Blockly.FieldNumber, which we only have once
 * the Blockly module is handed in.
 */
import type * as BlocklyModule from 'blockly';

/** The name of the field of a number bubble (Blockly's `math_number`). */
export const NUMBER_FIELD = 'NUM';

/** A text typed with a decimal comma, as Blockly's number field reads a decimal point: "18,9" -> "18.9". */
export function withDecimalPoint(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/,/g, '.') : value;
}

export function createCommaNumberFieldClass(Blockly: typeof BlocklyModule) {
  class CommaFieldNumber extends Blockly.FieldNumber {
    protected override doClassValidation_(newValue?: unknown): number | null {
      return super.doClassValidation_(withDecimalPoint(newValue));
    }
  }
  return CommaFieldNumber;
}

/**
 * Give a number bubble that was just made the field that reads a decimal comma: in the same place,
 * with the same value, minimum, maximum and precision. Nothing happens to a block without that field.
 */
export function putCommaNumberField(Blockly: typeof BlocklyModule, block: BlocklyModule.Block, FieldClass: ReturnType<typeof createCommaNumberFieldClass>): void {
  const old = block.getField(NUMBER_FIELD);
  if (!(old instanceof Blockly.FieldNumber) || old instanceof FieldClass) return;
  const input = old.getParentInput();
  const index = input.fieldRow.indexOf(old);
  const field = new FieldClass(old.getValue() ?? 0, old.getMin(), old.getMax(), old.getPrecision());
  input.removeField(NUMBER_FIELD);
  input.insertFieldAt<string | number>(index, field, NUMBER_FIELD);
}
