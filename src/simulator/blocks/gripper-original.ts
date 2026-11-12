/**
 * The "original code" of the Gripper blocks.
 *
 * Real mBlock has no Gripper category. The three Gripper blocks of the palette are shortcuts made
 * for this simulator; in mBlock a student builds the same thing as My Blocks, out of the servo
 * block and a wait:
 *
 *   gripper [opens]  until done      ->  define gripper opens          set servo S2 angle to 0 °,  wait 0.4 seconds
 *   gripper [closes] until done      ->  define gripper closes         set servo S2 angle to 60 °, wait 0.4 seconds
 *   arm [raises] until done          ->  define arm raises             set servo S1 angle to 90 °, wait 0.5 seconds
 *   arm [lowers] until done          ->  define arm lowers             set servo S1 angle to 0 °,  wait 0.5 seconds
 *   arm moves to height (50) % ...   ->  define arm moves to height    set servo S1 angle to (height * 0.9) °, wait 0.5 seconds
 *                                        (one number input: height)
 *
 * Nothing above is written down here as a fixed number: the servo ports and the angles are read
 * from the robot (`config.gripper`, see core/robot.ts), and each wait is the time that servo needs
 * to travel between the gripper's own two positions at `config.servoSpeed`, rounded up to a tenth
 * of a second. The numbers shown are those of the default robot.
 *
 * This file gives:
 *   - GRIPPER_VARIANTS / gripperVariantOf()   which My Block each Gripper block stands for;
 *   - gripperOriginals()                      the five My Blocks for a robot: servo, angle, wait, and
 *                                             their blocks in words;
 *   - gripperBlockProgram() / gripperDefinitionProgram() / gripperDefinitionsProgram()
 *                                             the same as Blockly workspace JSON (ProgramJson);
 *   - addGripperMyBlocks()                    puts the definitions into a program (only the missing ones);
 *   - convertGripperBlocks()                  rewrites a whole program "the mBlock way": every Gripper
 *                                             block becomes a call of its My Block.
 *
 * The definitions are made only of blocks real mBlock has for the mBot2: "set servo ... angle to",
 * "wait ... seconds", the + - * operators and a My Block with one number input.
 *
 * One difference to know about: the Gripper blocks wait exactly until the servo has arrived (or is
 * held up by what it grips), the My Blocks always wait their fixed time; and "arm moves to height"
 * as a Gripper block keeps the height between 0 and 100, the My Block does not check it.
 *
 * Plain data and pure functions: no DOM, no Blockly, and no import of the program builder
 * (vm/builder.ts), so the simulator screen may use this file.
 */
import type { BlockJson, GripperConfig, ProgramJson, RobotConfig, ServoPort, VariableJson } from '../core/types';
import { COLUMN_GAP, estimateStackWidth, FIRST_X, FIRST_Y, noteState } from './stack-size';
import { toolboxBlock } from './toolbox';

// =============================================================================================
// Which My Block each Gripper block stands for
// =============================================================================================

export type GripperVariantId = 'claw-open' | 'claw-close' | 'arm-raise' | 'arm-lower' | 'arm-height';

/** One Gripper block as it can be set: a block type and, for the two blocks with a menu, one choice of it. */
export interface GripperVariant {
  id: GripperVariantId;
  /** the Gripper block of the palette */
  blockType: 'gripper_claw' | 'gripper_arm' | 'gripper_arm_height';
  /** the choice of its menu (field ACTION) that makes this variant; the height block has no menu */
  action?: 'open' | 'close' | 'raise' | 'lower';
  /** what the Gripper block says */
  label: string;
  /** name of the My Block it stands for */
  myBlock: string;
  /** names of the number inputs of that My Block */
  inputs: string[];
  /** the part of the gripper it moves */
  part: 'claw' | 'arm';
}

/** Name of the number input of "arm moves to height". */
const HEIGHT_INPUT = 'height';

export const GRIPPER_VARIANTS: readonly GripperVariant[] = [
  { id: 'claw-open', blockType: 'gripper_claw', action: 'open', label: 'gripper opens until done', myBlock: 'gripper opens', inputs: [], part: 'claw' },
  { id: 'claw-close', blockType: 'gripper_claw', action: 'close', label: 'gripper closes until done', myBlock: 'gripper closes', inputs: [], part: 'claw' },
  { id: 'arm-raise', blockType: 'gripper_arm', action: 'raise', label: 'arm raises until done', myBlock: 'arm raises', inputs: [], part: 'arm' },
  { id: 'arm-lower', blockType: 'gripper_arm', action: 'lower', label: 'arm lowers until done', myBlock: 'arm lowers', inputs: [], part: 'arm' },
  {
    id: 'arm-height',
    blockType: 'gripper_arm_height',
    label: 'arm moves to height 50 % until done',
    myBlock: 'arm moves to height',
    inputs: [HEIGHT_INPUT],
    part: 'arm',
  },
];

const VARIANT_BY_ID = new Map<GripperVariantId, GripperVariant>(GRIPPER_VARIANTS.map((v) => [v.id, v]));

export function gripperVariant(id: GripperVariantId): GripperVariant {
  const variant = VARIANT_BY_ID.get(id);
  if (!variant) throw new Error(`Unknown Gripper block "${id}".`);
  return variant;
}

/** What a menu of a saved block holds, read the way the interpreter reads it. */
function fieldText(block: Pick<BlockJson, 'fields'>, name: string): string | undefined {
  const value = block.fields?.[name];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/**
 * Which variant a block of a program is; undefined for every block that is not a Gripper block.
 * It decides exactly like the interpreter (vm/handlers.ts): a claw block closes only when its
 * menu says "close", an arm block raises only when its menu says "raise".
 */
export function gripperVariantOf(block: Pick<BlockJson, 'type' | 'fields'>): GripperVariant | undefined {
  switch (block.type) {
    case 'gripper_claw':
      return gripperVariant(fieldText(block, 'ACTION') === 'close' ? 'claw-close' : 'claw-open');
    case 'gripper_arm':
      // (a block saved without its menu counts as the first choice, "raises")
      return gripperVariant((fieldText(block, 'ACTION') ?? 'raise') === 'raise' ? 'arm-raise' : 'arm-lower');
    case 'gripper_arm_height':
      return gripperVariant('arm-height');
    default:
      return undefined;
  }
}

// =============================================================================================
// The five My Blocks for a robot
// =============================================================================================

/** A value in a round slot: a number, the input of the My Block, or two of those joined by an operator. */
type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'input'; name: string }
  | { kind: 'operator'; type: 'operator_add' | 'operator_subtract' | 'operator_multiply'; sign: '+' | '-' | '*'; left: Expr; right: Expr };

const num = (value: number): Expr => ({ kind: 'number', value });
const OPERATOR = { '+': 'operator_add', '-': 'operator_subtract', '*': 'operator_multiply' } as const;
const join = (sign: '+' | '-' | '*', left: Expr, right: Expr): Expr => ({ kind: 'operator', type: OPERATOR[sign], sign, left, right });

/** Numbers without binary noise: 0.9, not 0.9000000000000001. */
const tidy = (n: number): number => Math.round(n * 1e6) / 1e6;

function exprText(e: Expr): string {
  if (e.kind === 'number') return String(e.value);
  if (e.kind === 'input') return e.name;
  return `${exprText(e.left)} ${e.sign} ${exprText(e.right)}`;
}

/**
 * The lift servo angle for a height in percent: down + height x (up - down) / 100, written as
 * simply as the numbers allow ("height * 0.9" when the arm is down at 0 degrees and up at 90).
 */
function heightAngle(g: GripperConfig): Expr {
  const down = tidy(g.liftDownAngle);
  const perPercent = tidy((g.liftUpAngle - g.liftDownAngle) / 100);
  if (perPercent === 0) return num(down);
  const size = Math.abs(perPercent);
  const height: Expr = { kind: 'input', name: HEIGHT_INPUT };
  const scaled = size === 1 ? height : join('*', height, num(size));
  if (down === 0 && perPercent > 0) return scaled;
  return join(perPercent > 0 ? '+' : '-', num(down), scaled);
}

/**
 * How long a My Block waits for its servo: the time the servo needs between the two positions of
 * that part of the gripper, rounded up to a tenth of a second.
 */
export function gripperWaitSeconds(config: RobotConfig, part: 'claw' | 'arm'): number {
  const g = config.gripper;
  const travel = part === 'claw' ? Math.abs(g.clawClosedAngle - g.clawOpenAngle) : Math.abs(g.liftUpAngle - g.liftDownAngle);
  if (!(travel > 0) || !(config.servoSpeed > 0)) return 0;
  // (the small number keeps 0.3 from becoming 0.4 because 0.3 x 10 is 3.0000000000000004)
  return Math.ceil((travel / config.servoSpeed) * 10 - 1e-9) / 10;
}

/** The original code of one Gripper block on one robot. */
export interface GripperOriginal {
  variant: GripperVariant;
  /** the servo its My Block moves */
  servo: ServoPort;
  /** the angle it sets; undefined for "arm moves to height", which works it out from its input */
  angle?: number;
  /** the angle as it is written in the servo block: "60", "height * 0.9" */
  angleText: string;
  /** seconds the My Block waits for the servo */
  wait: number;
  /** the My Block in words, one block per line (for screen readers, the README and the tests) */
  lines: string[];
  /** what the "?" on the definition says once it is in a program: which Gripper block this is */
  note: string;
}

interface Original extends GripperOriginal {
  expr: Expr;
}

function originalOf(config: RobotConfig, variant: GripperVariant): Original {
  const g = config.gripper;
  const servo = variant.part === 'claw' ? g.clawServo : g.liftServo;
  let expr: Expr;
  switch (variant.id) {
    case 'claw-open':
      expr = num(tidy(g.clawOpenAngle));
      break;
    case 'claw-close':
      expr = num(tidy(g.clawClosedAngle));
      break;
    case 'arm-raise':
      expr = num(tidy(g.liftUpAngle));
      break;
    case 'arm-lower':
      expr = num(tidy(g.liftDownAngle));
      break;
    default:
      expr = heightAngle(g);
  }
  const wait = gripperWaitSeconds(config, variant.part);
  const angleText = exprText(expr);
  const head = variant.inputs.length > 0 ? `define ${variant.myBlock} (${variant.inputs.join(') (')})` : `define ${variant.myBlock}`;
  const does = `Does what the Gripper block "${variant.label}" does`;
  const note =
    variant.id === 'arm-height'
      ? `${does}: height 0 is all the way down, 100 all the way up. The wait gives servo ${servo} time to get there.`
      : `${does}: servo ${servo} turns to ${angleText}°, and the wait gives it time to get there.`;
  const original: Original = {
    variant,
    servo,
    angleText,
    wait,
    lines: [head, `set servo ${servo} angle to ${angleText} °`, `wait ${wait} seconds`],
    note,
    expr,
  };
  if (expr.kind === 'number' && variant.id !== 'arm-height') original.angle = expr.value;
  return original;
}

/** The five My Blocks for this robot, in palette order. */
export function gripperOriginals(config: RobotConfig): GripperOriginal[] {
  return GRIPPER_VARIANTS.map((variant) => {
    const { expr: _expr, ...original } = originalOf(config, variant);
    return original;
  });
}

// =============================================================================================
// Writing blocks (Blockly's own JSON, as Blockly.serialization.workspaces.save() writes it)
// =============================================================================================

/** Hands out ids that are not used yet: the wanted one, or the wanted one with a number. */
class Ids {
  constructor(private readonly used: Set<string>) {}

  take(wanted: string): string {
    let id = wanted;
    for (let n = 2; this.used.has(id); n++) id = `${wanted}-${n}`;
    this.used.add(id);
    return id;
  }
}

type Slot = { shadow?: BlockJson; block?: BlockJson };

const DEFINITION_TYPES = ['procedures_defnoreturn', 'procedures_defreturn'];
const CALL_TYPES = ['procedures_callnoreturn', 'procedures_callreturn'];

/** The number a slot shows before anything is typed into it (what the palette hands out). */
function defaultNumber(type: string, input: string): number {
  const value = toolboxBlock(type).inputs?.[input]?.shadow.fields.NUM;
  return typeof value === 'number' ? value : 0;
}

/**
 * The blocks of one definition.
 * @param name the name the My Block gets in this program
 * @param parameter the variable behind its number input (null for a My Block without input)
 * @param withNote give the definition its note (the "?" icon). Without one, Blockly puts its own
 *   "Describe this function..." there as soon as the definition is in the editor.
 */
function definitionBlock(original: Original, name: string, parameter: VariableJson | null, ids: Ids, withNote: boolean): BlockJson {
  const base = `mblock-${original.variant.id}`;
  const bubble = (what: string, value: number): BlockJson => ({ type: 'math_number', id: ids.take(`${base}-${what}`), fields: { NUM: value } });

  const valueBlock = (e: Expr): BlockJson => {
    if (e.kind === 'input') return { type: 'data_variable', id: ids.take(`${base}-input`), fields: { VARIABLE: { id: parameter?.id ?? '' } } };
    if (e.kind === 'number') return bubble('number', e.value);
    return {
      type: e.type,
      id: ids.take(`${base}-${e.type.replace('operator_', '')}`),
      inputs: { NUM1: slot(e.left, e.type, 'NUM1'), NUM2: slot(e.right, e.type, 'NUM2') },
    };
  };
  /** a number goes into the white bubble; anything else is dropped onto the bubble the slot has by default */
  const slot = (e: Expr, type: string, input: string): Slot =>
    e.kind === 'number'
      ? { shadow: bubble('number', e.value) }
      : { shadow: bubble('number', defaultNumber(type, input)), block: valueBlock(e) };

  const wait: BlockJson = {
    type: 'control_wait',
    id: ids.take(`${base}-wait`),
    inputs: { DURATION: { shadow: bubble('seconds', original.wait) } },
  };
  const servo: BlockJson = {
    type: 'mbot2_servo_set',
    id: ids.take(`${base}-servo`),
    fields: { PORT: original.servo },
    inputs: { ANGLE: slot(original.expr, 'mbot2_servo_set', 'ANGLE') },
    next: { block: wait },
  };
  const definition: BlockJson = { type: 'procedures_defnoreturn', id: ids.take(base) };
  if (parameter) definition.extraState = { params: [{ name: parameter.name, id: parameter.id }] };
  if (withNote) definition.icons = { comment: noteState(original.note) };
  definition.fields = { NAME: name };
  definition.inputs = { STACK: { block: servo } };
  return definition;
}

/** Every block of a program: the stacks, what is inside C-shaped blocks, and what sits in the slots. */
function forEachBlock(first: BlockJson | undefined, visit: (block: BlockJson) => void): void {
  for (let block = first; block; block = block.next?.block) {
    visit(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      if (slot?.shadow) forEachBlock(slot.shadow, visit);
      if (slot?.block) forEachBlock(slot.block, visit);
    }
    if (block.next?.shadow) forEachBlock(block.next.shadow, visit);
  }
}

function topBlocks(program: ProgramJson): BlockJson[] {
  const list = program.blocks?.blocks;
  return Array.isArray(list) ? list.filter((b) => b && typeof b.type === 'string') : [];
}

function isDisabled(block: BlockJson): boolean {
  return block.enabled === false || (Array.isArray(block.disabledReasons) && block.disabledReasons.length > 0);
}

/** How the interpreter (and Blockly) compare the names of My Blocks: spaces at the ends and capitals do not count. */
const nameKey = (name: string): string => name.trim().toLowerCase();

// =============================================================================================
// The pictures for the "Inside the Gripper blocks" window
// =============================================================================================

function programOf(blocks: BlockJson[], variables: VariableJson[] = []): ProgramJson {
  return { blocks: { languageVersion: 0, blocks }, variables };
}

/** One Gripper block exactly as the palette hands it out, with the menu set to this variant. */
export function gripperBlockProgram(id: GripperVariantId): ProgramJson {
  const variant = gripperVariant(id);
  const entry = toolboxBlock(variant.blockType, variant.action ? { ACTION: variant.action } : undefined);
  const block: BlockJson = { type: entry.type, id: `gripper-${id}`, x: 0, y: 0 };
  if (entry.fields) block.fields = { ...entry.fields };
  if (entry.inputs) {
    block.inputs = {};
    for (const [name, slot] of Object.entries(entry.inputs)) {
      block.inputs[name] = { shadow: { type: slot.shadow.type, id: `gripper-${id}-${name.toLowerCase()}`, fields: { ...slot.shadow.fields } } };
    }
  }
  return programOf([block]);
}

/** The variable a My Block input is in Blockly: every input is a variable of the workspace. */
function freshParameter(name: string, ids: Ids): VariableJson {
  return { name, id: ids.take(`mblock-${name}`) };
}

/** The "define" stack of one Gripper block, on its own and without its note: the picture of the window. */
export function gripperDefinitionProgram(config: RobotConfig, id: GripperVariantId): ProgramJson {
  const original = originalOf(config, gripperVariant(id));
  const parameter = original.variant.inputs.length > 0 ? freshParameter(original.variant.inputs[0], new Ids(new Set())) : null;
  const definition = definitionBlock(original, original.variant.myBlock, parameter, new Ids(new Set()), false);
  return programOf([{ ...definition, x: 0, y: 0 }], parameter ? [parameter] : []);
}

/** All five definitions as one program (what "Add these My Blocks to my program" puts into an empty workspace). */
export function gripperDefinitionsProgram(config: RobotConfig): ProgramJson {
  return addGripperMyBlocks(programOf([]), config).program;
}

// =============================================================================================
// Putting the My Blocks into a student's program
// =============================================================================================

/** The outcome of addGripperMyBlocks() and convertGripperBlocks(). */
export interface GripperChange {
  /** the new program; the very same object that was passed in when nothing had to change */
  program: ProgramJson;
  /** how many Gripper blocks became a call of their My Block */
  replaced: number;
  /** names of the My Blocks whose definition was added, in palette order */
  added: string[];
  /** the My Block that stands for each Gripper block in this program (only the ones that were looked at) */
  myBlocks: Partial<Record<GripperVariantId, string>>;
}

/** A My Block of the program that stands for a Gripper block: its name and the names of its inputs. */
interface StandIn {
  name: string;
  params: string[];
}

function parameterNames(definition: BlockJson): string[] | null {
  const state = definition.extraState;
  if (state === undefined || state === null) return [];
  if (typeof state !== 'object') return null; // (an old XML mutation: not one of ours)
  const params = (state as { params?: unknown }).params;
  if (params === undefined) return [];
  if (!Array.isArray(params)) return null;
  const names: string[] = [];
  for (const p of params) {
    const name = (p as { name?: unknown } | null)?.name;
    if (typeof name !== 'string') return null;
    names.push(name);
  }
  return names;
}

/**
 * True when a My Block the student already has can stand for a Gripper block: it has the right
 * number of inputs, it moves the right servo, and it is self-contained - no Gripper block and no
 * other My Block inside (a block that leads back to itself would never end).
 * A student who changed the angle or the wait of a My Block keeps that My Block.
 */
function standsFor(definition: BlockJson, original: Original): StandIn | null {
  if (definition.type !== 'procedures_defnoreturn' || isDisabled(definition)) return null;
  const params = parameterNames(definition);
  if (!params || params.length !== original.variant.inputs.length) return null;
  let movesServo = false;
  let selfContained = true;
  forEachBlock(definition.inputs?.STACK?.block, (block) => {
    if (gripperVariantOf(block) || block.type.startsWith('gripper_') || CALL_TYPES.includes(block.type)) selfContained = false;
    if (block.type === 'mbot2_servo_set' && !isDisabled(block)) {
      // (a servo block saved without its menu counts as the first choice, S1)
      const port = fieldText(block, 'PORT') ?? 'S1';
      if (port === original.servo || port === 'all') movesServo = true;
    }
  });
  if (!movesServo || !selfContained) return null;
  return { name: String(definition.fields?.NAME ?? ''), params };
}

/** Room one new definition takes on the workspace, top to bottom (a little generous, like the widths). */
const DEFINITION_HEIGHT = 216;
const DEFINITION_GAP = 32;

/**
 * The work shared by "add the My Blocks" and "show my program the mBlock way".
 * @param replace false: make sure all five My Blocks are in the program. true: turn every Gripper
 *   block into a call of its My Block, and make sure the My Blocks that are called are there.
 */
function change(program: ProgramJson, config: RobotConfig, replace: boolean): GripperChange {
  const tops = topBlocks(program);

  // ---- what is in the program
  const used = new Set<GripperVariantId>();
  const blockIds = new Set<string>();
  for (const top of tops) {
    forEachBlock(top, (block) => {
      if (typeof block.id === 'string') blockIds.add(block.id);
      const variant = gripperVariantOf(block);
      if (variant) used.add(variant.id);
    });
  }
  const takenNames = new Set<string>();
  const running = new Map<string, BlockJson>(); // the definition the interpreter runs for a name: the last one that is not switched off
  for (const top of tops) {
    if (!DEFINITION_TYPES.includes(top.type)) continue;
    const key = nameKey(String(top.fields?.NAME ?? ''));
    takenNames.add(key);
    if (!isDisabled(top)) running.set(key, top);
  }

  // ---- the My Block for every variant that is needed: one the student has, or a new one
  const needed = replace ? GRIPPER_VARIANTS.filter((variant) => used.has(variant.id)) : GRIPPER_VARIANTS;
  const standIns = new Map<GripperVariantId, StandIn>();
  const toCreate: Array<{ original: Original; name: string }> = [];
  for (const variant of needed) {
    const original = originalOf(config, variant);
    for (let n = 1; !standIns.has(variant.id); n++) {
      // a name that is taken by something else gets a number: "gripper opens 2"
      const name = n === 1 ? variant.myBlock : `${variant.myBlock} ${n}`;
      const existing = running.get(nameKey(name));
      const found = existing ? standsFor(existing, original) : null;
      if (found) standIns.set(variant.id, found);
      else if (!takenNames.has(nameKey(name))) {
        toCreate.push({ original, name });
        takenNames.add(nameKey(name));
        standIns.set(variant.id, { name, params: [...variant.inputs] });
      }
    }
  }

  const myBlocks: GripperChange['myBlocks'] = {};
  for (const [id, standIn] of standIns) myBlocks[id] = standIn.name;
  // nothing to add and nothing to replace: the program comes back as it is (this is what makes a second run change nothing)
  if (toCreate.length === 0 && !(replace && used.size > 0)) return { program, replaced: 0, added: [], myBlocks };

  // ---- from here on a copy is changed; the program that was passed in stays as it is
  const next = JSON.parse(JSON.stringify(program)) as ProgramJson;
  const variables: VariableJson[] = Array.isArray(next.variables) ? next.variables : [];
  const ids = new Ids(blockIds);
  const variableIds = new Ids(new Set(variables.map((v) => v.id)));

  /** The variable behind an input name: the one the program already has under that name (Blockly keeps one per name), or a new one. */
  const parameterFor = (name: string): VariableJson => {
    const existing = variables.find((v) => (v.type ?? '') === '' && typeof v.name === 'string' && v.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const created = freshParameter(name, variableIds);
    variables.push(created);
    return created;
  };

  const definitions: BlockJson[] = [];
  for (const { original, name } of toCreate) {
    const parameter = original.variant.inputs.length > 0 ? parameterFor(original.variant.inputs[0]) : null;
    definitions.push(definitionBlock(original, name, parameter, ids, true));
    // the input may already exist with other capitals ("Height"): calls must use the name it really has
    if (parameter) standIns.set(original.variant.id, { name, params: [parameter.name] });
  }

  // ---- every Gripper block becomes a call of its My Block: same id, same place, same neighbours
  const callOf = (block: BlockJson, standIn: StandIn): BlockJson => {
    const { type: _type, fields: _fields, inputs, extraState: _state, ...rest } = block;
    const call: BlockJson = { ...rest, type: 'procedures_callnoreturn', id: block.id };
    call.extraState = standIn.params.length > 0 ? { name: standIn.name, params: [...standIn.params] } : { name: standIn.name };
    // whatever is plugged into "height" (a number, a variable, a sum ...) moves over untouched
    if (standIn.params.length > 0 && inputs?.HEIGHT) call.inputs = { ARG0: inputs.HEIGHT };
    return call;
  };
  let replaced = 0;
  const convertBlock = (block: BlockJson): BlockJson => {
    for (const slot of Object.values(block.inputs ?? {})) {
      if (slot?.block) slot.block = convertStack(slot.block);
    }
    const variant = gripperVariantOf(block);
    const standIn = variant ? standIns.get(variant.id) : undefined;
    if (!standIn) return block;
    replaced++;
    return callOf(block, standIn);
  };
  const convertStack = (first: BlockJson): BlockJson => {
    const head = convertBlock(first);
    for (let block = head; block.next?.block; block = block.next.block) block.next.block = convertBlock(block.next.block);
    return head;
  };
  const kept = replace ? topBlocks(next).map(convertStack) : topBlocks(next);

  // ---- the new definitions go in a column to the right of everything that is already there
  let x = FIRST_X;
  let y = FIRST_Y;
  if (kept.length > 0) {
    x = Math.ceil(Math.max(...kept.map((top) => finite(top.x) + estimateStackWidth(top, variables)))) + COLUMN_GAP;
    y = Math.min(...kept.map((top) => finite(top.y)));
  }
  const placed = definitions.map((definition) => {
    const { type, id, ...rest } = definition;
    const block: BlockJson = { type, id, x, y, ...rest };
    y += DEFINITION_HEIGHT + DEFINITION_GAP;
    return block;
  });

  // (definitions first, as the program builder writes them: Blockly then knows a My Block before it meets a call of it)
  next.blocks = { ...(next.blocks ?? {}), languageVersion: next.blocks?.languageVersion ?? 0, blocks: [...placed, ...kept] };
  next.variables = variables;
  return { program: next, replaced, added: toCreate.map((entry) => entry.name), myBlocks };
}

const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** How many Gripper blocks a program holds (switched-off ones and ones lying loose included). */
export function countGripperBlocks(program: ProgramJson): number {
  let count = 0;
  for (const top of topBlocks(program)) {
    forEachBlock(top, (block) => {
      if (gripperVariantOf(block)) count++;
    });
  }
  return count;
}

/**
 * "Add these My Blocks to my program": the five definitions as normal My Blocks, in a column to
 * the right of what is already there. A My Block the program already has (same name, same number
 * of inputs, moves the same servo) is left alone and not added a second time, so doing this
 * twice adds nothing the second time.
 */
export function addGripperMyBlocks(program: ProgramJson, config: RobotConfig): GripperChange {
  return change(program, config, false);
}

/**
 * "Show my program the mBlock way": every Gripper block becomes a call of its My Block - with the
 * same id, in the same place, with the same blocks above, below and inside, and with whatever was
 * plugged into "height" - and the definitions that are needed are added (see addGripperMyBlocks).
 *
 * A My Block or a variable of the student is never changed. If the student already has a My
 * Block called "gripper opens" that is something else, the new one is named "gripper opens 2".
 * A program without Gripper blocks comes back as it is, so converting twice changes nothing more.
 */
export function convertGripperBlocks(program: ProgramJson, config: RobotConfig): GripperChange {
  return change(program, config, true);
}
