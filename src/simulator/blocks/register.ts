/**
 * Makes the catalog blocks real Blockly blocks. Browser side (it is also safe under Node, where
 * the tests run Blockly "headless" to check that every block definition is accepted).
 *
 * This file never imports Blockly itself: the caller hands the Blockly module in. That keeps the
 * whole blocks/ folder importable anywhere (server-side rendering included) and lets the page
 * decide when to load Blockly.
 *
 *   import * as Blockly from 'blockly';
 *   const workspace = createEditor(Blockly, div);              // does the three steps below
 *
 *   const workspace = createEditor(Blockly, div, { palette: 'fire-chief' });   // the palette of a game
 *
 *   registerBlocks(Blockly);                                   // once, before Blockly.inject
 *   const workspace = Blockly.inject(div, { toolbox: TOOLBOX, ...EDITOR_LOOK });
 *   attachToolboxCallbacks(Blockly, workspace);                // Scratch-like Variables palette
 *
 * The blocks in French (Robot en fête 2027): `createEditor(Blockly, div, { palette, locale: 'fr',
 * frenchMessages })` makes a French editor - French palette, French blocks, Blockly's own words in
 * French, number bubbles that read a decimal comma. The blocks are the same blocks: a catalog block
 * made in a French workspace (./locale.ts) is built from its French texts (./fr.ts) with the same
 * type, fields and stored values. Every other workspace is English and runs exactly what it ran
 * before the French version came.
 */
import type * as BlocklyModule from 'blockly';
import { BLOCKS, blocklyDefinitions, getBlockDef, LIST_VARIABLE_TYPE, toBlocklyJson } from './catalog';
import { FR_BLOCKS, FR_PALETTE_TOOLTIPS, FR_TEXT_BUBBLE_TOOLTIP, FR_TOOLBOX } from './fr';
import { gripperVariantOf } from './gripper-original';
import type { GripperVariantId } from './gripper-original';
import { applyBlocklyMessages, localeOfWorkspace, setWorkspaceLocale, withBlocklyMessage } from './locale';
import type { BlockLocale } from './locale';
import { createCommaNumberFieldClass, putCommaNumberField } from './number-field';
import { PALETTE_TOOLTIPS, paletteOf, paletteTooltip } from './palettes';
import { EDITOR_LOOK } from './theme';
import { defaultText, GRIPPER_CODE_CALLBACK, GROUP_GAP, paletteToolbox, seeMblockCode, toolboxBlock } from './toolbox';
import type { ToolboxItem, ToolboxJson } from './toolbox';

/** The Blockly module, as you get it from `import * as Blockly from 'blockly'`. */
export type BlocklyApi = typeof BlocklyModule;

/** Name of our colour picker field in block definitions. */
export const COLOUR_FIELD_TYPE = 'field_colour';

/** Colours offered by the LED colour picker (rows of 8). */
export const LED_PALETTE: string[] = [
  '#ff0000', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#8000ff', '#ff00ff',
  '#ff8080', '#ffc080', '#ffff80', '#80ff80', '#80ffff', '#8080ff', '#c080ff', '#ff80ff',
  '#800000', '#804000', '#808000', '#008000', '#008080', '#000080', '#400080', '#800080',
  '#ffffff', '#c0c0c0', '#808080', '#404040', '#000000', '#ff0080', '#00ff80', '#0080ff',
];

/** Toolbox button callbacks registered by attachToolboxCallbacks(). */
export const MAKE_VARIABLE_CALLBACK = 'MBOT2_MAKE_VARIABLE';
export const MAKE_LIST_CALLBACK = 'MBOT2_MAKE_LIST';

// =============================================================================================
// Colour picker field (Blockly 11+ no longer ships one)
// =============================================================================================

/**
 * A small field that shows a colour swatch on the block; clicking it opens a palette.
 * Its value is a '#rrggbb' text. Built as a function because the class has to extend
 * Blockly.Field, which we only have once the Blockly module is handed in.
 */
export function createColourFieldClass(Blockly: BlocklyApi) {
  const SWATCH_WIDTH = 28;

  class FieldColour extends Blockly.Field<string> {
    /** the value is saved with the program */
    override SERIALIZABLE = true;

    constructor(value?: string, validator?: BlocklyModule.FieldValidator<string> | null, config?: BlocklyModule.FieldConfig) {
      super(Blockly.Field.SKIP_SETUP);
      if (config) this.configure_(config);
      this.setValue(value ?? '#ff0000');
      if (validator) this.setValidator(validator);
    }

    /** Called by Blockly for `{ "type": "field_colour", "colour": "#ff0000" }` in a block definition. */
    static override fromJson(options: BlocklyModule.FieldConfig & { colour?: string }): FieldColour {
      return new FieldColour(options.colour, undefined, options);
    }

    protected override initView(): void {
      this.createBorderRect_();
      const rect = this.getBorderRect();
      rect.style.fillOpacity = '1';
      rect.setAttribute('stroke', '#ffffff');
      rect.setAttribute('stroke-width', '1.5');
      rect.style.cursor = 'pointer';
    }

    override applyColour(): void {
      if (this.borderRect_) this.borderRect_.style.fill = this.getValue() ?? '#000000';
    }

    /** The swatch has a fixed size (there is no text to measure). */
    protected override updateSize_(): void {
      const constants = this.getConstants();
      const height = constants ? constants.FIELD_BORDER_RECT_HEIGHT : 16;
      this.size_ = new Blockly.utils.Size(SWATCH_WIDTH, height);
      this.positionBorderRect_();
    }

    protected override doClassValidation_(newValue?: unknown): string | null {
      if (typeof newValue !== 'string') return null;
      return Blockly.utils.colour.parse(newValue);
    }

    protected override doValueUpdate_(newValue: string): void {
      this.value_ = newValue;
      if (this.borderRect_) this.borderRect_.style.fill = newValue;
    }

    override getText(): string {
      return this.getValue() ?? '';
    }

    /** Open the palette under the field. */
    protected override showEditor_(): void {
      Blockly.DropDownDiv.clearContent();
      Blockly.DropDownDiv.getContentDiv().appendChild(this.createPalette());
      Blockly.DropDownDiv.setColour('#ffffff', '#cccccc');
      Blockly.DropDownDiv.showPositionedByField<string>(this);
    }

    private createPalette(): HTMLElement {
      const current = (this.getValue() ?? '').toLowerCase();
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(8, 26px)';
      grid.style.gap = '4px';
      grid.style.padding = '8px';
      for (const colour of LED_PALETTE) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.title = colour;
        cell.setAttribute('aria-label', colour);
        cell.style.width = '26px';
        cell.style.height = '26px';
        cell.style.padding = '0';
        cell.style.borderRadius = '6px';
        cell.style.cursor = 'pointer';
        cell.style.background = colour;
        cell.style.border = colour === current ? '3px solid #333333' : '1px solid #bbbbbb';
        cell.addEventListener('click', () => {
          this.setValue(colour);
          Blockly.DropDownDiv.hideIfOwner<string>(this);
        });
        grid.appendChild(cell);
      }
      return grid;
    }
  }

  return FieldColour;
}

// =============================================================================================
// Registration
// =============================================================================================

/**
 * Define every catalog block in Blockly. Safe to call more than once (for example when a React
 * component mounts again): what already exists is left alone.
 *
 * It writes none of Blockly's own words (Blockly.Msg): createEditor sets those, in the editor's
 * language (./locale.ts applyBlocklyMessages). So the window "Inside the Gripper blocks", which
 * calls this again, leaves the words of a French editor French.
 */
export function registerBlocks(Blockly: BlocklyApi): void {
  if (!Blockly.registry.hasItem(Blockly.registry.Type.FIELD, COLOUR_FIELD_TYPE)) {
    Blockly.fieldRegistry.register(COLOUR_FIELD_TYPE, createColourFieldClass(Blockly));
  }

  const missing = blocklyDefinitions().filter((def) => !(String(def.type) in Blockly.Blocks));
  if (missing.length > 0) Blockly.common.defineBlocksWithJsonArray(missing);

  useFrenchBlocks(Blockly);

  usePlainTextBubble(Blockly);

  useFrenchNumberBubbles(Blockly);

  registerGripperCodeMenu(Blockly);

  useGameTooltips(Blockly);
}

// =============================================================================================
// The blocks in French (./fr.ts; which workspace is French: ./locale.ts)
// =============================================================================================

/**
 * The definition of a catalog block in Blockly's JSON format with its French texts: the rows, the
 * texts of its menus (the stored values stay the English ones), the name of the variable it picks
 * by default, the default text of a text box, and its hover text. Type, fields, inputs, shape and
 * colour are the block's own - a French block saves exactly what the English one saves.
 */
export function frenchBlockJson(type: string): Record<string, unknown> | undefined {
  const def = getBlockDef(type);
  const french = FR_BLOCKS[type];
  if (!def || !french) return undefined;
  const json = toBlocklyJson(def);
  json.message0 = french.message;
  (def.rows ?? []).forEach((row, i) => (json[`message${i + 1}`] = french.rows?.[i] ?? row.message));
  json.tooltip = french.tooltip;
  const translate = (arg: Record<string, unknown>): Record<string, unknown> => {
    const name = String(arg.name);
    if (arg.type === 'field_dropdown') {
      const texts = french.options?.[name];
      if (!texts) return arg;
      return { ...arg, options: (arg.options as [string, string][]).map(([text, value], i) => [texts[i] ?? text, value]) };
    }
    if (arg.type === 'field_variable') return { ...arg, variable: defaultText(String(arg.variable), 'fr') };
    if (arg.type === 'field_input') return { ...arg, text: defaultText(String(arg.text), 'fr') };
    return arg;
  };
  for (const key of Object.keys(json)) {
    if (/^args\d+$/.test(key)) json[key] = (json[key] as Record<string, unknown>[]).map(translate);
  }
  return json;
}

/**
 * Every catalog block made in a French workspace is built from its French texts; in every other
 * workspace it runs its own (English) definition, as before. Done once per block (a marker).
 */
function useFrenchBlocks(Blockly: BlocklyApi): void {
  const marker = 'mbot2FrenchBlock';
  for (const def of BLOCKS) {
    const definition = Blockly.Blocks[def.type] as (Record<string, unknown> & { init?: () => void }) | undefined;
    if (!definition || definition[marker] || typeof definition.init !== 'function') continue;
    const french = frenchBlockJson(def.type);
    if (!french) continue;
    const init = definition.init;
    definition.init = function (this: BlocklyModule.Block) {
      if (localeOfWorkspace(this.workspace) === 'fr') this.jsonInit(french);
      else init.call(this);
    };
    definition[marker] = true;
  }
}

/**
 * The number bubbles (Blockly's `math_number`) of a French workspace read a typed decimal comma:
 * "18,9" is 18.9 (./number-field.ts). English workspaces keep Blockly's own number field.
 */
function useFrenchNumberBubbles(Blockly: BlocklyApi): void {
  const marker = 'mbot2FrenchNumber';
  const definition = Blockly.Blocks['math_number'] as (Record<string, unknown> & { init?: () => void }) | undefined;
  if (!definition || definition[marker] || typeof definition.init !== 'function') return;
  const CommaFieldNumber = createCommaNumberFieldClass(Blockly);
  const init = definition.init;
  definition.init = function (this: BlocklyModule.Block) {
    init.call(this);
    if (localeOfWorkspace(this.workspace) === 'fr') putCommaNumberField(Blockly, this, CommaFieldNumber);
  };
  definition[marker] = true;
}

// =============================================================================================
// Hover texts of one game (./palettes.ts: PALETTE_TOOLTIPS)
// =============================================================================================

/** The game whose palette an editor shows, per workspace (createEditor writes it down). */
const workspacePalettes = new WeakMap<BlocklyModule.Workspace, string>();

/** The hover text a block has in a game in French, when that game has its own (FR_PALETTE_TOOLTIPS: the game of Warehouse Sort). */
function frenchPaletteTooltip(type: string, gameId: string | undefined): string | undefined {
  return paletteOf(gameId) === 'warehouse-sort' && Object.prototype.hasOwnProperty.call(FR_PALETTE_TOOLTIPS, type) ? FR_PALETTE_TOOLTIPS[type] : undefined;
}

/** The game of the editor a block is in (a block in the open palette: the editor of that palette). */
function gameOfBlock(block: BlocklyModule.Block): string | undefined {
  const workspace = block.workspace as BlocklyModule.WorkspaceSvg;
  const editor = workspace.isFlyout ? workspace.targetWorkspace : workspace;
  return editor ? workspacePalettes.get(editor) : undefined;
}

/**
 * A block whose hover text is different in some game asks, each time the text is shown, which
 * game its editor belongs to. In every other game - and in an editor that names no game - it
 * shows the catalog's text, as before. In a French workspace both are French: the game's text
 * from FR_PALETTE_TOOLTIPS, else the block's French text.
 */
function useGameTooltips(Blockly: BlocklyApi): void {
  const marker = 'mbot2GameTooltip';
  const types = new Set<string>();
  for (const texts of Object.values(PALETTE_TOOLTIPS)) for (const type of Object.keys(texts ?? {})) types.add(type);
  for (const type of types) {
    const definition = Blockly.Blocks[type] as (Record<string, unknown> & { init?: () => void }) | undefined;
    if (!definition || definition[marker] || typeof definition.init !== 'function') continue;
    const init = definition.init;
    definition.init = function (this: BlocklyModule.Block) {
      init.call(this);
      const catalogText = this.tooltip;
      const gameText = localeOfWorkspace(this.workspace) === 'fr' ? frenchPaletteTooltip : paletteTooltip;
      this.setTooltip(() => gameText(type, gameOfBlock(this)) ?? (typeof catalogText === 'function' ? catalogText() : catalogText));
    };
    definition[marker] = true;
  }
}

/**
 * Blockly's own "text" block draws quote marks around its text box, which makes the bubble of a
 * text slot look like a green block. Scratch shows a plain white bubble, the same as for numbers.
 * We swap the definition for one without the quote marks; type name and field name stay the
 * same ('text' / 'TEXT'), so saved programs are not affected.
 */
function usePlainTextBubble(Blockly: BlocklyApi): void {
  const marker = 'mbot2PlainText';
  const current = Blockly.Blocks['text'] as Record<string, unknown> | undefined;
  if (current && current[marker]) return;
  const plain = Blockly.common.createBlockDefinitionsFromJsonArray([
    {
      type: 'text',
      message0: '%1',
      args0: [{ type: 'field_input', name: 'TEXT', text: '' }],
      output: 'String',
      style: 'text_blocks',
      tooltip: 'A text. Click to type.',
    },
  ])['text'] as Record<string, unknown> & { init: () => void };
  // (in a French workspace the bubble says it in French)
  const init = plain.init;
  plain.init = function (this: BlocklyModule.Block) {
    init.call(this);
    if (localeOfWorkspace(this.workspace) === 'fr') this.setTooltip(FR_TEXT_BUBBLE_TOOLTIP);
  };
  plain[marker] = true;
  Blockly.Blocks['text'] = plain;
}

// (Blockly's own words - "define", "my block", "Make a Variable" ... - are set by createEditor in the
// editor's language: ./locale.ts applyBlocklyMessages. The Scratch words in English are there too.)

// =============================================================================================
// The Variables palette (dynamic toolbox category)
// =============================================================================================

type VariableModel = BlocklyModule.IVariableModel<BlocklyModule.IVariableState>;

function byName(a: VariableModel, b: VariableModel): number {
  return a.getName().localeCompare(b.getName());
}

/**
 * Content of the Variables category, Scratch style: a "Make a Variable" button, one round block
 * per variable, "set" / "change" blocks; then the same for lists.
 */
export function variablesFlyout(workspace: BlocklyModule.Workspace): ToolboxItem[] {
  const map = workspace.getVariableMap();
  const variables = [...map.getVariablesOfType('')].sort(byName);
  const lists = [...map.getVariablesOfType(LIST_VARIABLE_TYPE)].sort(byName);
  const ref = (v: VariableModel): { id: string; name: string; type: string } => ({ id: v.getId(), name: v.getName(), type: v.getType() });
  // (the words of the buttons and of the bubbles: the language of the workspace)
  const locale = localeOfWorkspace(workspace);
  const french = locale === 'fr';

  const items: ToolboxItem[] = [{ kind: 'button', text: french ? FR_TOOLBOX.makeVariable : 'Make a Variable', callbackkey: MAKE_VARIABLE_CALLBACK }];
  for (const variable of variables) items.push(toolboxBlock('data_variable', { VARIABLE: ref(variable) }, locale));
  if (variables.length > 0) {
    const first = ref(variables[0]);
    items.push({ kind: 'sep', gap: GROUP_GAP });
    items.push(toolboxBlock('data_setvariableto', { VARIABLE: first }, locale));
    items.push(toolboxBlock('data_changevariableby', { VARIABLE: first }, locale));
  }

  items.push({ kind: 'button', text: french ? FR_TOOLBOX.makeList : 'Make a List', callbackkey: MAKE_LIST_CALLBACK });
  for (const list of lists) items.push(toolboxBlock('data_listcontents', { LIST: ref(list) }, locale));
  if (lists.length > 0) {
    const first = ref(lists[0]);
    items.push({ kind: 'sep', gap: GROUP_GAP });
    for (const type of [
      'data_addtolist',
      'data_deleteoflist',
      'data_deletealloflist',
      'data_insertatlist',
      'data_replaceitemoflist',
      'data_itemoflist',
      'data_itemnumoflist',
      'data_lengthoflist',
      'data_listcontainsitem',
    ]) {
      items.push(toolboxBlock(type, { LIST: first }, locale));
    }
  }
  return items;
}

/**
 * Call once after Blockly.inject(): replaces Blockly's standard Variables palette by the
 * Scratch-like one above and wires its two buttons. Without this call the Variables category
 * still works, with Blockly's plain variable blocks (the interpreter understands those too).
 */
export function attachToolboxCallbacks(Blockly: BlocklyApi, workspace: BlocklyModule.WorkspaceSvg): void {
  workspace.registerToolboxCategoryCallback('VARIABLE', (ws) => variablesFlyout(ws) as BlocklyModule.utils.toolbox.FlyoutDefinition);
  workspace.registerButtonCallback(MAKE_VARIABLE_CALLBACK, (button) => {
    Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace(), undefined, '');
  });
  workspace.registerButtonCallback(MAKE_LIST_CALLBACK, (button) => {
    // Blockly has one question for this dialog ("New variable name:"); it reads the text at the
    // moment the dialog opens, so for a list the wording is swapped just for that moment.
    const target = button.getTargetWorkspace();
    const question = localeOfWorkspace(target) === 'fr' ? FR_TOOLBOX.newListName : 'New list name:';
    withBlocklyMessage(Blockly, 'NEW_VARIABLE_TITLE', question, () => {
      Blockly.Variables.createVariableButtonHandler(target, undefined, LIST_VARIABLE_TYPE);
    });
  });
  // show the new palette straight away
  workspace.getToolbox()?.refreshSelection();
}

// =============================================================================================
// "See the real mBlock code" (the Gripper blocks are shortcuts mBlock does not have)
// =============================================================================================

/**
 * Called when the student asks for the real mBlock code of the Gripper blocks: with the block
 * that was right-clicked, or with null when the button of the Gripper palette was pressed.
 */
export type GripperCodeHandler = (at: GripperVariantId | null) => void;

/** Name of the entry in Blockly's list of right-click menu entries. */
export const GRIPPER_CODE_MENU_ID = 'mbot2_gripper_code';

/** Who shows the code, per workspace (the menu entry itself is one for all workspaces of the page). */
const gripperCodeHandlers = new WeakMap<BlocklyModule.Workspace, GripperCodeHandler>();

function gripperCodeHandlerFor(block: BlocklyModule.BlockSvg): GripperCodeHandler | undefined {
  const workspace = block.workspace;
  // a block in the open palette lives in the palette's own little workspace
  const editor = workspace.isFlyout ? workspace.targetWorkspace : workspace;
  return editor ? gripperCodeHandlers.get(editor) : undefined;
}

/** The Gripper variant of a block on the workspace (undefined for any other block). */
function gripperVariantOfBlock(block: BlocklyModule.Block): GripperVariantId | undefined {
  return gripperVariantOf({ type: block.type, fields: { ACTION: block.getFieldValue('ACTION') } })?.id;
}

/**
 * Adds the entry "See the real mBlock code" to the menu a right-click (a long press on a touch
 * screen) opens on a Gripper block. It only shows on Gripper blocks, and only in an editor that
 * said who shows the code (attachGripperCode); every other Blockly workspace is left as it is.
 */
function registerGripperCodeMenu(Blockly: BlocklyApi): void {
  const registry = Blockly.ContextMenuRegistry.registry;
  if (registry.getItem(GRIPPER_CODE_MENU_ID)) return;
  registry.register({
    id: GRIPPER_CODE_MENU_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    // first in the menu: it is the one entry that is about this block in particular
    weight: 0,
    // (in the language of the block's workspace)
    displayText: (scope) => seeMblockCode(scope.block ? localeOfWorkspace(scope.block.workspace) : 'en'),
    preconditionFn: (scope) => (scope.block && gripperVariantOfBlock(scope.block) && gripperCodeHandlerFor(scope.block) ? 'enabled' : 'hidden'),
    callback: (scope) => {
      const block = scope.block;
      if (block) gripperCodeHandlerFor(block)?.(gripperVariantOfBlock(block) ?? null);
    },
  });
}

/**
 * Call once after Blockly.inject(): wires the button at the top of the Gripper palette and the
 * right-click entry of the Gripper blocks of this workspace to `handler`, which shows the code.
 */
export function attachGripperCode(workspace: BlocklyModule.WorkspaceSvg, handler: GripperCodeHandler): void {
  gripperCodeHandlers.set(workspace, handler);
  workspace.registerButtonCallback(GRIPPER_CODE_CALLBACK, () => handler(null));
}

// =============================================================================================
// White bubbles for "My Blocks"
// =============================================================================================

/** The value slots of Blockly's my-block blocks that should hold a bubble to type into. */
function slotsToFill(block: BlocklyModule.Block): BlocklyModule.Input[] {
  switch (block.type) {
    case 'procedures_callnoreturn':
    case 'procedures_callreturn':
      // one slot per parameter: ARG0, ARG1 ...
      return block.inputList.filter((input) => input.name.startsWith('ARG'));
    case 'procedures_defreturn':
      return block.inputList.filter((input) => input.name === 'RETURN');
    case 'procedures_ifreturn':
      return block.inputList.filter((input) => input.name === 'VALUE');
    default:
      return [];
  }
}

/**
 * Blockly leaves the value slots of a my-block call (and of "return") as empty holes, and our
 * palette has no loose number block to plug into them. Scratch and mBlock show a white bubble
 * there instead: type a number or a word, or drop a round block on it. This gives every such slot
 * its bubble, when the block is dragged out of the palette and whenever the parameters of a
 * my-block change. Call once after Blockly.inject().
 */
export function addBubblesToMyBlocks(Blockly: BlocklyApi, workspace: BlocklyModule.WorkspaceSvg): void {
  const fill = (id: string | undefined): void => {
    const block = id ? workspace.getBlockById(id) : null;
    if (!block || block.isInFlyout) return;
    for (const input of slotsToFill(block)) {
      const connection = input.connection;
      if (!connection) continue;
      const known = connection.getShadowState();
      if (known) {
        // The slot knows its bubble. It can still be missing: Blockly takes the bubble away when
        // a parameter is moved or removed in the gear dialog of the my-block. Put it back.
        if (!connection.targetBlock()) connection.setShadowState(known);
        continue;
      }
      // The bubble always gets the same id for the same slot. Undo / redo count on that: after
      // "undo" has removed the block and "redo" has put it back, a later step ("typed 25 into the
      // bubble") must find its bubble again.
      const bubbleId = `${block.id}_${input.name}`;
      const state: BlocklyModule.serialization.blocks.State = { type: 'text', fields: { TEXT: '' } };
      if (!workspace.getBlockById(bubbleId)) state.id = bubbleId;
      connection.setShadowState(state);
    }
  };
  workspace.addChangeListener((event: BlocklyModule.Events.Abstract) => {
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      for (const id of (event as BlocklyModule.Events.BlockCreate).ids ?? []) fill(id);
    } else if (event.type === Blockly.Events.BLOCK_CHANGE) {
      // the parameters of a my-block were changed: its calls got new slots
      const change = event as BlocklyModule.Events.BlockChange;
      if (change.element === 'mutation') fill(change.blockId);
    }
  });
}

// =============================================================================================
// One call that sets up a complete editor
// =============================================================================================

export interface EditorOptions extends Omit<BlocklyModule.BlocklyOptions, 'toolbox'> {
  /**
   * The game whose palette the editor shows: give Game.id ('fire-rescue', 'fire-chief',
   * 'warehouse-sort', 'locker-room' - see ./palettes.ts). Left out, or a game without a palette
   * of its own: the palette of Fire Rescue. It also picks the hover texts of that game
   * (PALETTE_TOOLTIPS).
   */
  palette?: string;
  /**
   * The language of the editor: its palette, its blocks, Blockly's own words and the number
   * bubbles (which read a decimal comma in French). Left out: English - every English page. A
   * French editor that forgets this is wholly English, never half French.
   */
  locale?: BlockLocale;
  /**
   * Blockly's own words in French: the strings of Blockly's French file, `blockly/msg/fr` (see
   * ./locale.ts blocklyMessagesOf). Only read when `locale` is 'fr'; our own French words go on top.
   */
  frenchMessages?: Readonly<Record<string, string>>;
  /** your own toolbox instead of a game's palette, e.g. buildToolbox([...]) for a smaller one; it wins over `palette` */
  toolbox?: ToolboxJson;
  /**
   * Shows the real mBlock code of the Gripper blocks (the button of the Gripper palette and the
   * right-click entry of a Gripper block call it). Without it the button does nothing and the
   * entry does not show.
   */
  onGripperCode?: GripperCodeHandler;
}

/**
 * Register the blocks, create a Blockly workspace inside `container` with the mBlock toolbox and
 * look, and install the Scratch-like Variables palette, the bubbles of the my-block slots and the
 * "See the real mBlock code" button and menu entry of the Gripper blocks. `palette` picks the
 * palette of a game, `locale` the language ('fr': the page of Robot en fête 2027). Any Blockly option can be overridden
 * (readOnly, media, plugins: CONTINUOUS_TOOLBOX_PLUGINS, zoom ...).
 */
export function createEditor(Blockly: BlocklyApi, container: Element | string, options: EditorOptions = {}): BlocklyModule.WorkspaceSvg {
  registerBlocks(Blockly);
  const { palette, locale = 'en', frenchMessages, toolbox = paletteToolbox(palette, locale), onGripperCode, ...rest } = options;
  // Blockly's own words, in the language of this editor (before the workspace is made: it reads them)
  applyBlocklyMessages(Blockly, locale, frenchMessages);
  const workspace = Blockly.inject(container, {
    ...EDITOR_LOOK,
    ...rest,
    // our toolbox type is a strict subset of Blockly's loosely typed toolbox JSON
    toolbox: toolbox as unknown as BlocklyModule.utils.toolbox.ToolboxDefinition,
  });
  // (before any block is made in it: its blocks, its palette and its bubbles speak this language)
  setWorkspaceLocale(workspace, locale);
  if (palette !== undefined) workspacePalettes.set(workspace, palette);
  attachToolboxCallbacks(Blockly, workspace);
  addBubblesToMyBlocks(Blockly, workspace);
  if (onGripperCode) attachGripperCode(workspace, onGripperCode);
  // (the palette has the button either way: without a handler a press on it simply does nothing)
  else workspace.registerButtonCallback(GRIPPER_CODE_CALLBACK, () => {});
  return workspace;
}
