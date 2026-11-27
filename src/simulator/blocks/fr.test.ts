/**
 * The blocks in French (Robot en fête 2027): ./fr.ts, ./locale.ts, ./number-field.ts and what
 * ./register.ts, ./toolbox.ts, ./gripper-original.ts and ./stack-size.ts do with them.
 *
 *  - The table: every catalog block has its French, with every placeholder of its rows exactly
 *    once, a French text for every menu of words, French names for every category; French
 *    typography (no-break spaces, ’, …); "tu", never "vous".
 *  - English is untouched: every palette in English is what it was, every English workspace builds
 *    the English blocks, Blockly's own words are English again after a French editor.
 *  - A French workspace (real Blockly, loaded with a pretend browser, jsdom): French rows, menus and
 *    hover texts, the SAME saved program; Blockly's own words French and they stay French when the
 *    Gripper window registers the blocks again; number bubbles that read a decimal comma.
 *  - The My Blocks of the Gripper window in French.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, describe, test } from 'node:test';

import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { BlockJson, ProgramJson } from '../core/types';
import * as B from '../vm/builder';
import { allArgs, BLOCKS, CATEGORIES, getBlockDef, toBlocklyJson } from './catalog';
import {
  FR_BLOCKLY_MSG,
  FR_BLOCKLY_NOT_ON_THIS_PAGE,
  FR_BLOCKS,
  FR_CATEGORY_NAMES,
  FR_DEFAULT_TEXTS,
  FR_GRIPPER_SHORTCUT,
  FR_PALETTE_TOOLTIPS,
  FR_START_BLOCK,
  FR_TEXT_BUBBLE_TOOLTIP,
  FR_TOOLBOX,
} from './fr';
import { addGripperMyBlocks, convertGripperBlocks, gripperDefinitionProgram, gripperDefinitionsProgram, gripperOriginals, GRIPPER_VARIANTS, gripperVariants } from './gripper-original';
import { applyBlocklyMessages, blocklyMessagesOf, frenchShortcutKeys, localeOfWorkspace, setWorkspaceLocale, SHORTCUTS_IN_MESSAGES, withBlocklyMessage } from './locale';
import { withDecimalPoint } from './number-field';
import { GAME_VERSIONS, LANGUAGE_VERSIONS, PALETTE_IDS, PALETTE_TOOLTIPS, paletteCategories, paletteOf, paletteTooltip, versionOf } from './palettes';
import { createEditor, disposeEditor, frenchBlockJson, frenchTooltipLines, GRIPPER_CODE_MENU_ID, MAKE_LIST_CALLBACK, registerBlocks, variablesFlyout, type BlocklyApi } from './register';
import { estimateStackWidth } from './stack-size';
import { buildToolbox, paletteToolbox, SEE_MBLOCK_CODE, TOOLBOX, toolboxBlock, toolboxBlockTypes, type ToolboxJson } from './toolbox';

const NB = ' ';
const ROBOT_EN_FETE = 'robot-en-fete';
/** The second French simulator of Robot en fête 2027: a palette of its own (French only), the robot of Warehouse Sort. */
const LOGISTIQUE = 'logistique-intelligente';

/** The placeholders of a row, sorted: "%1,%2". */
const holes = (message: string): string => (message.match(/%\d+/g) ?? []).sort().join(',');

/** Every French text of the table that a student reads or hears (not the notes for developers). */
function frenchTexts(): Array<[where: string, text: string]> {
  const out: Array<[string, string]> = [];
  for (const [type, fr] of Object.entries(FR_BLOCKS)) {
    out.push([`${type} row`, fr.message], [`${type} tooltip`, fr.tooltip]);
    (fr.rows ?? []).forEach((row, i) => out.push([`${type} row ${i + 1}`, row]));
    for (const [name, texts] of Object.entries(fr.options ?? {})) texts.forEach((text) => out.push([`${type} menu ${name}`, text]));
  }
  for (const [key, text] of Object.entries(FR_PALETTE_TOOLTIPS)) out.push([`palette tooltip ${key}`, text]);
  for (const [key, text] of Object.entries(FR_CATEGORY_NAMES)) out.push([`category ${key}`, text]);
  for (const [key, text] of Object.entries(FR_TOOLBOX)) out.push([`toolbox ${key}`, text]);
  for (const [key, text] of Object.entries(FR_DEFAULT_TEXTS)) out.push([`default text ${key}`, text]);
  for (const [key, text] of Object.entries(FR_BLOCKLY_MSG)) out.push([`Blockly.Msg ${key}`, text]);
  out.push(['start block', FR_START_BLOCK], ['gripper shortcut', FR_GRIPPER_SHORTCUT], ['text bubble', FR_TEXT_BUBBLE_TOOLTIP]);
  return out;
}

// =============================================================================================
// The table (no Blockly)
// =============================================================================================

describe('the French table of the blocks', () => {
  test('every catalog block has its French: the same placeholders, each once, in every row; a text for every menu of words', () => {
    const problems: string[] = [];
    for (const def of BLOCKS) {
      const fr = FR_BLOCKS[def.type];
      if (!fr) {
        problems.push(`no French for ${def.type}`);
        continue;
      }
      if (holes(fr.message) !== holes(def.message)) problems.push(`${def.type}: row 0 "${fr.message}" vs "${def.message}"`);
      for (const message of [fr.message, ...(fr.rows ?? [])]) {
        const list = message.match(/%\d+/g) ?? [];
        if (new Set(list).size !== list.length) problems.push(`${def.type}: a placeholder twice in "${message}"`);
      }
      if ((fr.rows ?? []).length !== (def.rows ?? []).length) problems.push(`${def.type}: ${fr.rows?.length ?? 0} rows vs ${(def.rows ?? []).length}`);
      (def.rows ?? []).forEach((row, i) => {
        if (holes(fr.rows?.[i] ?? '') !== holes(row.message)) problems.push(`${def.type}: row ${i + 1}`);
      });
      for (const [name, texts] of Object.entries(fr.options ?? {})) {
        const arg = allArgs(def).find((a) => a.name === name);
        if (!arg || arg.type !== 'field_dropdown') problems.push(`${def.type}: no menu ${name}`);
        else if (arg.options.length !== texts.length) problems.push(`${def.type}: menu ${name} has ${arg.options.length} options, French ${texts.length}`);
      }
      // a menu of words left out of the French table would show English (names - EM1, L2, abs, sin ... - are shown as they are)
      for (const arg of allArgs(def)) {
        if (arg.type !== 'field_dropdown' || fr.options?.[arg.name]) continue;
        if (arg.options.some(([text]) => /[a-z]{3}/.test(text) && !/^(abs|sin|cos|tan|asin|acos|atan|ln|log)$/.test(text))) {
          problems.push(`${def.type}: menu ${arg.name} has English words (${arg.options.map((o) => o[0]).join('/')})`);
        }
      }
      if (fr.tooltip.trim() === '' || fr.tooltip === def.tooltip) problems.push(`${def.type}: no French tooltip`);
    }
    for (const type of Object.keys(FR_BLOCKS)) if (!getBlockDef(type)) problems.push(`French for a block that does not exist: ${type}`);
    for (const category of CATEGORIES) if (!FR_CATEGORY_NAMES[category.id]) problems.push(`no French name for the category ${category.id}`);
    for (const type of Object.keys(PALETTE_TOOLTIPS['warehouse-sort'] ?? {})) if (!FR_PALETTE_TOOLTIPS[type]) problems.push(`no French hover text of Warehouse Sort for ${type}`);
    assert.deepEqual(problems, []);
    assert.equal(Object.keys(FR_BLOCKS).length, BLOCKS.length);
    assert.equal(BLOCKS.length, 96);
    assert.equal(CATEGORIES.length, 15);
  });

  test('French typography: a no-break space before : ; ! ? % » and after «, ’ not \', … not ..., and "tu", never "vous"', () => {
    const problems: string[] = [];
    for (const [where, text] of frenchTexts()) {
      // ("%1" is a placeholder; "%" alone is the percent sign)
      if (/ [:;!?»]| %(?!\d)|« /.test(text)) problems.push(`${where}: a plain space - ${JSON.stringify(text)}`);
      if (/[^\s  (%\d]:(?!\d)|[^\s  ][;!?»]|«[^  ]/.test(text.replace(/%\d+/g, 'X'))) problems.push(`${where}: no space - ${JSON.stringify(text)}`);
      if (text.includes("'")) problems.push(`${where}: ' instead of ’ - ${JSON.stringify(text)}`);
      if (text.includes('...')) problems.push(`${where}: ... instead of … - ${JSON.stringify(text)}`);
      // (never "fonction" for a My Block - the glossary; "Fonctions mathématiques", sin and cos, are what they are)
      if (/\b(vous|votre|vos)\b|\bfonctions?\b(?! math)|procédure/i.test(text)) problems.push(`${where}: ${JSON.stringify(text)}`);
      // (the bubble "pomme " ends with a space on purpose - "regrouper pomme  et banane" gives "pomme banane", as in Scratch -
      // and Blockly puts " et un commentaire" after a number of stacks)
      // (but the type names of Blockly's screen-reader labels: they end with the no-break space of Blockly's own ": ")
      const typeName = /^Blockly\.Msg ARIA_TYPE_FIELD_/.test(where) && /[^\s]\u00a0$/.test(text);
      if (text !== text.trim() && text !== FR_DEFAULT_TEXTS['apple '] && !/^ et /.test(text) && !typeName) problems.push(`${where}: spaces at an end - ${JSON.stringify(text)}`);
    }
    assert.deepEqual(problems, []);
    // the number of no-break spaces of the table, as the design counted them (79 with the one of its old header comment)
    const all = JSON.stringify([FR_BLOCKS, FR_PALETTE_TOOLTIPS, FR_CATEGORY_NAMES, FR_TOOLBOX, FR_BLOCKLY_MSG, FR_GRIPPER_SHORTCUT]);
    assert.ok((all.match(/ /g) ?? []).length >= 70);
  });

  test('the hats of the CyberPi say "lorsque", Scratch\'s hat says "quand" (one constant for the start block)', () => {
    assert.equal(FR_START_BLOCK, 'lorsque CyberPi démarre');
    assert.equal(FR_BLOCKS.event_cyberpi_start.message, FR_START_BLOCK);
    assert.equal(FR_BLOCKS.event_button_pressed.message, 'lorsque le bouton %1 est pressé');
    assert.equal(FR_BLOCKS.event_joystick.message, 'lorsque le joystick est %1');
    assert.equal(FR_BLOCKS.event_whenbroadcastreceived.message, 'quand je reçois %1');
    // the condition says "pressé ?", as Scratch 3 says "touche … pressée ?"
    assert.equal(FR_BLOCKS.cyberpi_button_pressed.message, `bouton %1 pressé${NB}?`);
  });

  test('the stored values of the menus stay the English ones: only the texts shown are French', () => {
    for (const def of BLOCKS) {
      const json = frenchBlockJson(def.type)!;
      const english = def;
      const args = (json: Record<string, unknown>) => Object.keys(json).filter((k) => /^args\d+$/.test(k)).flatMap((k) => json[k] as Array<Record<string, unknown>>);
      const frenchArgs = args(json);
      assert.equal(frenchArgs.length, allArgs(english).length, def.type);
      frenchArgs.forEach((arg, i) => {
        const before = allArgs(english)[i];
        assert.equal(arg.name, before.name, def.type);
        assert.equal(arg.type, before.type, def.type);
        if (before.type === 'field_dropdown') {
          assert.deepEqual((arg.options as [string, string][]).map(([, value]) => value), before.options.map(([, value]) => value), `${def.type}.${before.name}`);
        }
      });
      const englishJson = toBlocklyJson(def);
      assert.deepEqual(Object.keys(json).sort(), Object.keys(englishJson).sort(), def.type);
      for (const key of ['type', 'colour', 'output', 'previousStatement', 'nextStatement', 'inputsInline']) {
        assert.deepEqual(json[key], englishJson[key], `${def.type}.${key}`);
      }
    }
  });
});

// =============================================================================================
// The palette
// =============================================================================================

describe('the palette in French', () => {
  test('Robot en fête is Warehouse Sort in another language: its palette, its hover texts and its programs', () => {
    assert.deepEqual(LANGUAGE_VERSIONS, { [ROBOT_EN_FETE]: 'warehouse-sort' });
    assert.equal(versionOf(ROBOT_EN_FETE), 'warehouse-sort');
    assert.equal(paletteOf(ROBOT_EN_FETE), 'warehouse-sort');
    assert.deepEqual(paletteCategories(ROBOT_EN_FETE), paletteCategories('warehouse-sort'));
    assert.deepEqual(paletteToolbox(ROBOT_EN_FETE), paletteToolbox('warehouse-sort'));
    for (const type of Object.keys(PALETTE_TOOLTIPS['warehouse-sort'] ?? {})) assert.equal(paletteTooltip(type, ROBOT_EN_FETE), paletteTooltip(type, 'warehouse-sort'));
    // not a palette of its own, and not one of the versions of a competition (GAME_VERSIONS stays as it was)
    assert.ok(!PALETTE_IDS.includes(ROBOT_EN_FETE as never));
    assert.deepEqual(GAME_VERSIONS, { 'fire-rescue-junior': 'fire-rescue' });
  });

  test('paletteToolbox("robot-en-fete", "fr"): the palette of Warehouse Sort, the same blocks and values, with French words', () => {
    const english = paletteToolbox('warehouse-sort');
    const french = paletteToolbox(ROBOT_EN_FETE, 'fr');
    assert.deepEqual(
      french.contents.map((c) => c.name),
      ['CyberPi', 'Capteurs', 'Événements', 'Contrôle', 'Opérateurs', 'Variables', 'Mes blocs', 'Châssis mBot2', 'Servomoteurs', 'Pince', 'Capteur quad RGB', 'Capteur à ultrasons 2', 'Capteur de couleur'],
    );
    assert.deepEqual(toolboxBlockTypes(french), toolboxBlockTypes(english));
    // the same shape to the last gap; only the words differ
    const words = new Map<string, string>([
      ...english.contents.map((c, i): [string, string] => [c.name, french.contents[i].name]),
      ['Shortcuts made for this simulator.', FR_TOOLBOX.gripperIntro1],
      ['mBlock does not have these blocks.', FR_TOOLBOX.gripperIntro2],
      [SEE_MBLOCK_CODE, FR_TOOLBOX.seeMblockCode],
      ...Object.entries(FR_DEFAULT_TEXTS),
    ]);
    const translated = JSON.parse(JSON.stringify(english), (_key, value) => (typeof value === 'string' && words.has(value) ? words.get(value) : value)) as ToolboxJson;
    assert.deepEqual(french, translated);
    const gripper = french.contents.find((c) => c.toolboxitemid === 'gripper')!;
    assert.deepEqual(
      gripper.contents!.filter((item) => item.kind !== 'block' && item.kind !== 'sep').map((item) => ('text' in item ? item.text : '')),
      ['Des raccourcis faits pour ce simulateur.', 'mBlock n’a pas ces blocs.', 'Voir le vrai code mBlock'],
    );
    // the bubbles of words: French default texts ("pomme", "banane", "chose"); "makeblock", "message1", "50" stay
    const join = french.contents.find((c) => c.toolboxitemid === 'operators')!.contents!.find((item) => item.kind === 'block' && item.type === 'operator_join');
    assert.deepEqual(join && 'inputs' in join ? join.inputs : null, { STRING1: { shadow: { type: 'text', fields: { TEXT: 'pomme ' } } }, STRING2: { shadow: { type: 'text', fields: { TEXT: 'banane' } } } });
    assert.deepEqual(toolboxBlock('cyberpi_print', undefined, 'fr').inputs, toolboxBlock('cyberpi_print').inputs);
    assert.equal(/apple|banana|thing|Shortcuts|Sensing|Events|Chassis/.test(JSON.stringify(french)), false);
  });

  test('English stays exactly as it was: every palette without a language, or with "en", is the same toolbox', () => {
    for (const id of [...PALETTE_IDS, 'fire-rescue-junior', ROBOT_EN_FETE, undefined]) {
      assert.deepEqual(paletteToolbox(id, 'en'), paletteToolbox(id), String(id));
    }
    assert.deepEqual(buildToolbox(undefined, 'en'), buildToolbox());
    assert.deepEqual(TOOLBOX, paletteToolbox());
    // no French word in any English palette
    for (const id of PALETTE_IDS) assert.equal(/[éèàçû’]|Capteur|Pince|pomme/.test(JSON.stringify(paletteToolbox(id))), false, id);
  });

  test('Logistique intelligente: a palette of its own - the categories of Warehouse Sort, in French the words of Tri d’entrepôt - and no version of Warehouse Sort', () => {
    assert.ok(PALETTE_IDS.includes(LOGISTIQUE as never));
    assert.equal(paletteOf(LOGISTIQUE), LOGISTIQUE);
    assert.deepEqual(paletteCategories(LOGISTIQUE), paletteCategories('warehouse-sort'));
    // (a program saved here is a program of this game, not of Warehouse Sort: no version, of either kind)
    assert.equal(versionOf(LOGISTIQUE), undefined);
    assert.deepEqual(LANGUAGE_VERSIONS, { [ROBOT_EN_FETE]: 'warehouse-sort' });
    // no English hover text of its own: the page is French only (its French ones: the French workspace below)
    assert.equal(PALETTE_TOOLTIPS[LOGISTIQUE as keyof typeof PALETTE_TOOLTIPS], undefined);
    const french = paletteToolbox(LOGISTIQUE, 'fr');
    assert.deepEqual(french, paletteToolbox(ROBOT_EN_FETE, 'fr'));
    assert.deepEqual(
      french.contents.map((c) => c.name),
      ['CyberPi', 'Capteurs', 'Événements', 'Contrôle', 'Opérateurs', 'Variables', 'Mes blocs', 'Châssis mBot2', 'Servomoteurs', 'Pince', 'Capteur quad RGB', 'Capteur à ultrasons 2', 'Capteur de couleur'],
    );
    assert.deepEqual(toolboxBlockTypes(french), toolboxBlockTypes(paletteToolbox('warehouse-sort')));
  });
});

// =============================================================================================
// The width of a French row (the place of new My Blocks)
// =============================================================================================

describe('the width of French rows', () => {
  test('a French stack is measured with its French words; an English one exactly as before', () => {
    const stack = (type: string, fields?: Record<string, unknown>): BlockJson => ({ type, id: 'x', fields: fields as BlockJson['fields'] });
    // "la sonde %1 du capteur quad RGB détecte la couleur %2 ?" is longer than "quad RGB sensor %1 detects colour %2 ?"
    const probe = stack('sensing_quadrgb_probe_color_is', { PROBE: 'L1', COLOR: 'red' });
    assert.ok(estimateStackWidth(probe, [], 'fr') > estimateStackWidth(probe));
    assert.equal(estimateStackWidth(probe, [], 'en'), estimateStackWidth(probe));
    // a menu counts the French text of the chosen value ("tourner à gauche" for "left")
    const move = stack('mbot2_move_direction', { DIRECTION: 'left' });
    assert.notEqual(estimateStackWidth(move, [], 'fr'), estimateStackWidth(move));
    // a My Block: "définir" for "define"
    const define: BlockJson = { type: 'procedures_defnoreturn', id: 'd', fields: { NAME: 'go' } };
    assert.equal(estimateStackWidth(define, [], 'fr') - estimateStackWidth(define), 8.5 * ('définir'.length - 'define'.length));
  });
});

// =============================================================================================
// The My Blocks of the Gripper window in French
// =============================================================================================

describe('the My Blocks of the Gripper window in French', () => {
  test('the five variants: French labels (the French block in words), French names, the input "hauteur"; English untouched', () => {
    const french = gripperVariants('fr');
    assert.equal(gripperVariants(), GRIPPER_VARIANTS);
    assert.deepEqual(french.map((v) => v.id), GRIPPER_VARIANTS.map((v) => v.id));
    for (const variant of french) {
      const fr = FR_BLOCKS[variant.blockType];
      const english = getBlockDef(variant.blockType)!;
      if (variant.action) {
        const menu = allArgs(english).find((a) => a.type === 'field_dropdown')!;
        if (menu.type !== 'field_dropdown') throw new Error('no menu');
        const index = menu.options.findIndex(([, value]) => value === variant.action);
        assert.equal(variant.label, fr.message.replace('%1', fr.options!.ACTION[index]), variant.id);
      } else {
        assert.equal(variant.label, fr.message.replace('%1', '50'), variant.id);
      }
      assert.ok(variant.label.startsWith(variant.myBlock), variant.id);
    }
    assert.deepEqual(french.map((v) => v.myBlock), ['la pince s’ouvre', 'la pince se ferme', 'le bras monte', 'le bras descend', 'le bras va à la hauteur']);
    assert.deepEqual(french.find((v) => v.id === 'arm-height')!.inputs, ['hauteur']);
    assert.deepEqual(GRIPPER_VARIANTS.find((v) => v.id === 'arm-height')!.inputs, ['height']);
  });

  test('the code in words and the notes: French, numbers with a decimal comma', () => {
    const originals = gripperOriginals(DEFAULT_ROBOT_CONFIG, 'fr');
    assert.deepEqual(
      originals.map((o) => o.lines),
      [
        ['définir la pince s’ouvre', 'régler le servo S2 à l’angle 0 °', 'attendre 0,4 secondes'],
        ['définir la pince se ferme', 'régler le servo S2 à l’angle 60 °', 'attendre 0,4 secondes'],
        ['définir le bras monte', 'régler le servo S1 à l’angle 90 °', 'attendre 0,5 secondes'],
        ['définir le bras descend', 'régler le servo S1 à l’angle 0 °', 'attendre 0,5 secondes'],
        ['définir le bras va à la hauteur (hauteur)', 'régler le servo S1 à l’angle hauteur * 0,9 °', 'attendre 0,5 secondes'],
      ],
    );
    assert.equal(originals[1].note, `Fait ce que fait le bloc de la pince «${NB}la pince se ferme jusqu’à la fin${NB}»${NB}: le servo S2 tourne à 60°, et l’attente lui laisse le temps d’y arriver.`);
    assert.equal(
      originals[4].note,
      `Fait ce que fait le bloc de la pince «${NB}le bras va à la hauteur 50${NB}% jusqu’à la fin${NB}»${NB}: la hauteur 0 est tout en bas, 100 tout en haut. L’attente laisse au servo S1 le temps d’y arriver.`,
    );
    // the same servos, angles and waits as in English
    assert.deepEqual(
      originals.map((o) => [o.variant.id, o.servo, o.angle, o.wait]),
      gripperOriginals(DEFAULT_ROBOT_CONFIG).map((o) => [o.variant.id, o.servo, o.angle, o.wait]),
    );
    assert.equal(gripperOriginals(DEFAULT_ROBOT_CONFIG)[0].lines[0], 'define gripper opens');
  });

  test('the buttons add French My Blocks; the blocks inside are the same as the English ones', () => {
    const blank: ProgramJson = { blocks: { languageVersion: 0, blocks: [{ type: 'event_cyberpi_start', id: 'hat', x: 40, y: 40, next: { block: { type: 'gripper_arm_height', id: 'h', inputs: { HEIGHT: { shadow: { type: 'math_number', id: 'n', fields: { NUM: 30 } } } } } } }] } };
    const french = convertGripperBlocks(blank, DEFAULT_ROBOT_CONFIG, 'fr');
    const english = convertGripperBlocks(blank, DEFAULT_ROBOT_CONFIG);
    assert.deepEqual(french.added, ['le bras va à la hauteur']);
    assert.deepEqual(english.added, ['arm moves to height']);
    assert.equal(french.replaced, 1);
    const call = french.program.blocks!.blocks!.find((b) => b.id === 'hat')!.next!.block!;
    assert.deepEqual(call.extraState, { name: 'le bras va à la hauteur', params: ['hauteur'] });
    assert.deepEqual(call.inputs, { ARG0: { shadow: { type: 'math_number', id: 'n', fields: { NUM: 30 } } } });
    assert.deepEqual(french.program.variables, [{ name: 'hauteur', id: 'mblock-hauteur' }]);
    // the definition: the same blocks as in English, but its name, input and note
    const definitionOf = (change: typeof french) => change.program.blocks!.blocks!.find((b) => b.type === 'procedures_defnoreturn')!;
    // (x: the French rows are longer, so the definition is placed a little further to the right)
    const strip = (block: BlockJson) =>
      JSON.stringify(block, (key, value) => (['NAME', 'icons', 'extraState', 'id', 'VARIABLE', 'x'].includes(key) ? undefined : value));
    assert.equal(strip(definitionOf(french)), strip(definitionOf(english)));
    // all five on a blank workspace, twice: nothing more the second time
    const all = addGripperMyBlocks({}, DEFAULT_ROBOT_CONFIG, 'fr');
    assert.deepEqual(all.added, gripperVariants('fr').map((v) => v.myBlock));
    assert.equal(addGripperMyBlocks(all.program, DEFAULT_ROBOT_CONFIG, 'fr').program, all.program);
    assert.deepEqual(gripperDefinitionsProgram(DEFAULT_ROBOT_CONFIG, 'fr'), all.program);
    assert.equal(gripperDefinitionProgram(DEFAULT_ROBOT_CONFIG, 'claw-open', 'fr').blocks!.blocks![0].fields!.NAME, 'la pince s’ouvre');
    assert.equal(gripperDefinitionProgram(DEFAULT_ROBOT_CONFIG, 'claw-open').blocks!.blocks![0].fields!.NAME, 'gripper opens');
  });
});

// =============================================================================================
// With the real Blockly library
// =============================================================================================

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly. */
async function loadBlocklyWithDom(): Promise<BlocklyApi> {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> } };
  const divs = ['en', 'fr', 'en2', 'fr2', 'picture'].map((id) => `<div id="${id}" style="width: 900px; height: 600px"></div>`).join('');
  const dom = new JSDOM(`<!DOCTYPE html>${divs}`, { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'DOMParser', 'XMLSerializer',
    'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']; // prettier-ignore
  // jsdom has no canvas; Blockly only uses it to measure how wide a text is
  const canvas = dom.window.HTMLCanvasElement as { prototype: { getContext: unknown } };
  canvas.prototype.getContext = () => ({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) });
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return (await import('blockly')) as unknown as BlocklyApi;
}

type Workspace = ReturnType<typeof createEditor>;
/** (a block of any workspace: wrongWords and labelsOf only read its rows) */
type Block = Pick<ReturnType<Workspace['newBlock']>, 'inputList'>;

/** Spaces of every kind (a no-break space too) as one plain space. */
const norm = (text: string): string => text.replace(/[\s\u00a0\u202f]+/g, ' ').trim();

/** The words a block shows (its labels: the words of its rows, and the words Blockly takes out of a menu whose texts all start or end alike). */
function labelsOf(block: Block): string[] {
  return block.inputList.flatMap((input) => input.fieldRow.filter((field) => !field.EDITABLE && field.getText().trim() !== '').map((field) => norm(field.getText())));
}

/**
 * What is wrong with the words of a block: a label that is not in its rows and menus (another
 * language), or a word of its rows that it does not show.
 */
function wrongWords(block: Block, rows: string[], menus: string[]): string[] {
  const labels = labelsOf(block);
  const source = ` ${norm([...rows, ...menus].join(' | '))} `;
  const parts = rows.flatMap((row) => row.split(/%\d+/).map(norm).filter((part) => part !== ''));
  return [...labels.filter((label) => !source.includes(` ${label} `) && !source.includes(label)).map((label) => `shows "${label}"`), ...parts.filter((part) => !labels.includes(part)).map((part) => `misses "${part}"`)];
}

/** A block or program as Blockly saves it, without ids, places and the names of the variables it made itself; keys in order. */
function shape(state: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== 'id' && key !== 'x' && key !== 'y' && key !== 'name')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, v]) => [key, canonical(v)]),
      );
    }
    return value;
  };
  return JSON.stringify(canonical(state));
}

describe('a French workspace (real Blockly)', () => {
  let Blockly: BlocklyApi;
  let english: Workspace;
  let french: Workspace;
  let blocklyFrench: Record<string, string>;
  let englishMessages: Record<string, string>;

  before(async () => {
    Blockly = await loadBlocklyWithDom();
    blocklyFrench = blocklyMessagesOf(createRequire(import.meta.url)('blockly/msg/fr') as Record<string, unknown>);
    english = createEditor(Blockly, 'en', { sounds: false, palette: 'warehouse-sort' });
    englishMessages = { ...(Blockly.Msg as Record<string, string>) };
    french = createEditor(Blockly, 'fr', { sounds: false, palette: ROBOT_EN_FETE, locale: 'fr', frenchMessages: blocklyFrench });
  });

  test('each workspace knows its language; a palette (flyout) speaks the language of its editor', () => {
    assert.equal(localeOfWorkspace(english), 'en');
    assert.equal(localeOfWorkspace(french), 'fr');
    assert.equal(localeOfWorkspace(null), 'en');
    assert.equal(localeOfWorkspace(new Blockly.Workspace()), 'en');
    const flyout = french.getToolbox()?.getFlyout()?.getWorkspace();
    assert.ok(flyout?.isFlyout);
    assert.equal(localeOfWorkspace(flyout), 'fr');
    assert.equal(localeOfWorkspace(english.getToolbox()?.getFlyout()?.getWorkspace()), 'en');
    // the French editor shows the French palette
    const names = (french.getToolbox()?.getToolboxItems() ?? []).map((item) => (item as unknown as { getName(): string }).getName());
    assert.deepEqual(names, paletteToolbox(ROBOT_EN_FETE, 'fr').contents.map((c) => c.name));
  });

  test('every catalog block: French rows in a French workspace, English rows in an English one, the same saved block', () => {
    const problems: string[] = [];
    for (const def of BLOCKS) {
      const { kind: _kind, ...state } = toolboxBlock(def.type);
      const en = Blockly.serialization.blocks.append(state as never, english);
      const fr = Blockly.serialization.blocks.append(state as never, french);
      const frenchRows = [FR_BLOCKS[def.type].message, ...(FR_BLOCKS[def.type].rows ?? [])];
      const englishRows = [def.message, ...(def.rows ?? []).map((row) => row.message)];
      const englishMenus = allArgs(def).flatMap((arg) => (arg.type === 'field_dropdown' ? arg.options.map(([text]) => text) : []));
      const frenchMenus = allArgs(def).flatMap((arg) => (arg.type === 'field_dropdown' ? (FR_BLOCKS[def.type].options?.[arg.name] ?? arg.options.map(([text]) => text)) : []));
      for (const wrong of wrongWords(fr, frenchRows, frenchMenus)) problems.push(`${def.type} in French: ${wrong}`);
      for (const wrong of wrongWords(en, englishRows, englishMenus)) problems.push(`${def.type} in English: ${wrong}`);
      // the menu shows the French text of its value
      for (const arg of allArgs(def)) {
        if (arg.type !== 'field_dropdown') continue;
        const index = arg.options.findIndex(([, value]) => value === fr.getFieldValue(arg.name));
        const wanted = FR_BLOCKS[def.type].options?.[arg.name]?.[index] ?? arg.options[index][0];
        if (!norm(wanted).endsWith(norm(fr.getField(arg.name)!.getText()))) problems.push(`${def.type}.${arg.name}: shows "${fr.getField(arg.name)!.getText()}"`);
      }
      if (shape(Blockly.serialization.blocks.save(fr)) !== shape(Blockly.serialization.blocks.save(en))) problems.push(`${def.type}: saved differently`);
      // the hover text (in this editor's game: Warehouse Sort), in the lines Blockly shows (frenchTooltipLines: see below)
      const tip = Blockly.Tooltip.getTooltipOfObject(fr);
      const wanted = FR_PALETTE_TOOLTIPS[def.type] ?? FR_BLOCKS[def.type].tooltip;
      if (tip !== frenchTooltipLines(Blockly, wanted) || tip.replace(/\n/g, ' ') !== wanted) problems.push(`${def.type}: tooltip ${JSON.stringify(tip)}`);
      const englishTip = Blockly.Tooltip.getTooltipOfObject(en);
      if (englishTip !== (paletteTooltip(def.type, 'warehouse-sort') ?? def.tooltip)) problems.push(`${def.type}: English tooltip ${JSON.stringify(englishTip)}`);
      en.dispose(false);
      fr.dispose(false);
    }
    assert.deepEqual(problems, []);
  });

  test('Logistique intelligente: its French editor shows the three French hover texts of Warehouse Sort (the white line, a cube); a French editor of another palette shows the blocks\' own', () => {
    const tips = (palette: string): Record<string, string> => {
      const editor = createEditor(Blockly, 'fr2', { sounds: false, palette, locale: 'fr', frenchMessages: blocklyFrench });
      try {
        return Object.fromEntries(
          Object.keys(FR_PALETTE_TOOLTIPS).map((type) => {
            const { kind: _kind, ...state } = toolboxBlock(type);
            const block = Blockly.serialization.blocks.append(state as never, editor);
            const tip = Blockly.Tooltip.getTooltipOfObject(block);
            block.dispose(false);
            return [type, tip];
          }),
        );
      } finally {
        editor.dispose();
      }
    };
    assert.deepEqual(Object.keys(FR_PALETTE_TOOLTIPS).sort(), ['gripper_claw', 'sensing_claw_object_detected', 'sensing_quadrgb_probe_detects']);
    const logistique = tips(LOGISTIQUE);
    for (const [type, text] of Object.entries(FR_PALETTE_TOOLTIPS)) {
      assert.equal(logistique[type], frenchTooltipLines(Blockly, text), type);
      assert.notEqual(text, FR_BLOCKS[type].tooltip, `${type}: the game's own text, not the block's`);
    }
    assert.match(logistique.sensing_quadrgb_probe_detects.replace(/\n/g, ' '), /ligne blanche/);
    assert.match(logistique.sensing_claw_object_detected.replace(/\n/g, ' '), /un cube/);
    // the same as on the page of Tri d’entrepôt
    assert.deepEqual(tips(ROBOT_EN_FETE), logistique);
    // ... and only these two games: Fire Fighter's palette (no French page) keeps the blocks' own French texts
    const other = tips('fire-fighter');
    for (const type of Object.keys(FR_PALETTE_TOOLTIPS)) assert.equal(other[type], frenchTooltipLines(Blockly, FR_BLOCKS[type].tooltip), type);
  });

  test('a menu shows French and keeps the English value; a program moves between the two pages unchanged', () => {
    const { kind: _kind, ...state } = toolboxBlock('mbot2_straight_cm', { DIRECTION: 'backward' });
    const move = Blockly.serialization.blocks.append(state as never, french);
    assert.equal(move.getField('DIRECTION')!.getText(), 'reculer');
    assert.equal(move.getFieldValue('DIRECTION'), 'backward');
    assert.equal(move.toString(), 'reculer de 100 cm jusqu’à la fin');
    move.dispose(false);

    // a program with My Blocks, variables, lists, menus and texts: loaded into both, saved the same
    const program = B.program([
      B.script(B.whenStart(), [
        B.setVar('vitesse', 40),
        B.call('côté', 10),
        B.repeat(2, [B.changeVar('vitesse', 1), B.addToList('log', B.v('vitesse'))]),
        B.ifElse(B.and(B.gt(B.v('vitesse'), 100), B.not(B.probeDetects('L1', 'line'))), [B.print('vite')], [B.print(B.join('vitesse ', B.v('vitesse')))]),
        B.gripper('close'),
        B.moveCm('backward', 18.9),
      ]),
      B.define('côté', ['longueur'], [B.moveCm('forward', B.v('longueur')), B.turn('left', 90)]),
    ]);
    english.clear();
    french.clear();
    Blockly.serialization.workspaces.load(program as never, english);
    Blockly.serialization.workspaces.load(program as never, french);
    const savedEnglish = Blockly.serialization.workspaces.save(english);
    const savedFrench = Blockly.serialization.workspaces.save(french);
    assert.deepEqual(savedFrench, savedEnglish);
    // and back: what the French page saved opens on the English page as the same program
    english.clear();
    Blockly.serialization.workspaces.load(savedFrench, english);
    assert.deepEqual(Blockly.serialization.workspaces.save(english), savedEnglish);
    english.clear();
    french.clear();
  });

  test('the Variables palette, the list question and the right-click entry speak the language of the workspace', () => {
    english.getVariableMap().createVariable('vitesse', '');
    english.getVariableMap().createVariable('route', 'list');
    french.getVariableMap().createVariable('vitesse', '');
    french.getVariableMap().createVariable('route', 'list');
    const buttons = (ws: Workspace) => variablesFlyout(ws).flatMap((item) => (item.kind === 'button' ? [item.text] : []));
    assert.deepEqual(buttons(english), ['Make a Variable', 'Make a List']);
    assert.deepEqual(buttons(french), ['Créer une variable', 'Créer une liste']);
    const addToList = variablesFlyout(french).find((item) => item.kind === 'block' && item.type === 'data_addtolist');
    assert.deepEqual(addToList && 'inputs' in addToList ? addToList.inputs : null, { ITEM: { shadow: { type: 'text', fields: { TEXT: 'chose' } } } });

    // the "Make a List" button asks its own question, then Blockly's question is back
    const asked: string[] = [];
    Blockly.dialog.setPrompt((message: string, _default: string, callback: (answer: string | null) => void) => {
      asked.push(message);
      callback(null);
    });
    for (const ws of [english, french]) {
      const callback = ws.getButtonCallback(MAKE_LIST_CALLBACK)!;
      callback({ getTargetWorkspace: () => ws } as never);
    }
    assert.deepEqual(asked, ['New list name:', `Nom de la nouvelle liste${NB}:`]);
    // (the French editor was made last: Blockly's words are its words)
    assert.equal((Blockly.Msg as Record<string, string>).NEW_VARIABLE_TITLE, `Nom de la nouvelle variable${NB}:`);

    // "See the real mBlock code"
    const item = Blockly.ContextMenuRegistry.registry.getItem(GRIPPER_CODE_MENU_ID)!;
    const displayText = (item as { displayText: (scope: unknown) => string }).displayText;
    const claw = (ws: Workspace) => Blockly.serialization.blocks.append({ type: 'gripper_claw' } as never, ws);
    assert.equal(displayText({ block: claw(english) }), SEE_MBLOCK_CODE);
    assert.equal(displayText({ block: claw(french) }), 'Voir le vrai code mBlock');
    english.clear();
    french.clear();
  });

  test('the bubbles: the text bubble\'s hover text in French; the number bubbles read a decimal comma, in French only', () => {
    const text = Blockly.serialization.blocks.append({ type: 'text', fields: { TEXT: '' } } as never, french);
    assert.equal(Blockly.Tooltip.getTooltipOfObject(text), FR_TEXT_BUBBLE_TOOLTIP);
    const englishText = Blockly.serialization.blocks.append({ type: 'text', fields: { TEXT: '' } } as never, english);
    assert.equal(Blockly.Tooltip.getTooltipOfObject(englishText), 'A text. Click to type.');

    const typed: Array<[typed: string, english: number, french: number]> = [
      ['18.9', 18.9, 18.9],
      ['18,9', 189, 18.9],
      ['0,5', 5, 0.5],
      [',5', 5, 0.5],
      ['-0,5', -5, -0.5],
      ['110,5', 1105, 110.5],
      ['30,0', 300, 30],
      ['42', 42, 42],
    ];
    for (const [value, inEnglish, inFrench] of typed) {
      const en = english.newBlock('math_number');
      const fr = french.newBlock('math_number');
      en.getField('NUM')!.setValue(value);
      fr.getField('NUM')!.setValue(value);
      assert.equal(en.getFieldValue('NUM'), inEnglish, `English "${value}"`);
      assert.equal(fr.getFieldValue('NUM'), inFrench, `French "${value}"`);
    }
    // no number at all: the bubble keeps its value, as Blockly does
    const kept = french.newBlock('math_number');
    kept.getField('NUM')!.setValue('7');
    kept.getField('NUM')!.setValue('1,5,3');
    assert.equal(kept.getFieldValue('NUM'), 7);
    // what the text box hands over when the student types (FieldInput: getValueFromEditorText_, then setValue); the bubble shows Blockly's way
    const typedIn = french.newBlock('math_number');
    const field = typedIn.getField('NUM') as unknown as { getValueFromEditorText_(t: string): unknown; setValue(v: unknown): void; getText(): string };
    field.setValue(field.getValueFromEditorText_('18,9'));
    assert.equal(typedIn.getFieldValue('NUM'), 18.9);
    assert.equal(field.getText(), '18.9');
    // the English bubble is Blockly's own field; the French one only reads commas: the same saved block
    assert.equal(english.newBlock('math_number').getField('NUM')!.constructor, Blockly.FieldNumber);
    assert.notEqual(french.newBlock('math_number').getField('NUM')!.constructor, Blockly.FieldNumber);
    const en = english.newBlock('math_number');
    en.getField('NUM')!.setValue('18.9');
    assert.equal(shape(Blockly.serialization.blocks.save(typedIn)), shape(Blockly.serialization.blocks.save(en)));
    // a file of the English page opened in French and back: same value; the comma read in French only
    const loaded = Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(en)!, french);
    assert.equal(loaded.getFieldValue('NUM'), 18.9);
    loaded.getField('NUM')!.setValue('2,5');
    const back = Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(loaded)!, english);
    assert.equal(back.getFieldValue('NUM'), 2.5);
    back.getField('NUM')!.setValue('2,5');
    assert.equal(back.getFieldValue('NUM'), 25, 'the English bubble drops a comma, as Blockly does');
    // the bubbles of the palette's blocks (the shadows) are number bubbles too
    const straight = Blockly.serialization.blocks.append(toolboxBlock('mbot2_straight_cm') as never, french);
    const distance = straight.getInput('DISTANCE')!.connection!.targetBlock()!;
    distance.getField('NUM')!.setValue('18,9');
    assert.equal(distance.getFieldValue('NUM'), 18.9);
    assert.equal(withDecimalPoint('0,5'), '0.5');
    assert.equal(withDecimalPoint(3), 3);
    english.clear();
    french.clear();
  });

  test("Blockly's own words: French in a French editor, with nothing left in English that the page shows", () => {
    const msg = Blockly.Msg as Record<string, string>;
    const blocklyEnglish = createRequire(import.meta.url)('blockly/msg/en') as Record<string, string>;
    // (the French editor was made last)
    applyBlocklyMessages(Blockly, 'fr', blocklyFrench);
    const allowed = (key: string): boolean =>
      Object.keys(FR_BLOCKLY_NOT_ON_THIS_PAGE).some((k) => (k.startsWith('_') ? key.endsWith(k) : k.endsWith('_') ? key.startsWith(k) : key === k || key.includes(k)));
    const NOT_FRENCH = ['SHORTCUTS_JUMP_BOTTOM_STACK', 'SHORTCUTS_JUMP_TOP_STACK', 'SHORTCUTS_JUMP_FIRST_BLOCK', 'SHORTCUTS_JUMP_LAST_BLOCK'];
    const problems: string[] = [];
    for (const [key, value] of Object.entries(msg)) {
      if (typeof value !== 'string' || allowed(key)) continue;
      const wordy = /[A-Za-z]{3,}/.test(value.replace(/%\d/g, ''));
      if (wordy && value === blocklyEnglish[key] && !(key in FR_BLOCKLY_MSG)) problems.push(`${key}: still English ${JSON.stringify(value)}`);
      if (/\b(vous|votre|vos)\b|\b[A-Za-zéè]+ez\b|fonction|procédure|\.\.\./i.test(value)) problems.push(`${key}: ${JSON.stringify(value)}`);
      if (NOT_FRENCH.includes(key) && !(key in FR_BLOCKLY_MSG)) problems.push(`${key}: not French ${JSON.stringify(value)}`);
    }
    assert.deepEqual(problems, []);
    for (const [key, value] of Object.entries(FR_BLOCKLY_MSG)) {
      assert.ok(key in blocklyEnglish, `${key} is one of Blockly's keys`);
      // (a sentence with a shortcut in it gets the shortcut with the French names of its keys: see the next test)
      const keys = SHORTCUTS_IN_MESSAGES[key] ? frenchShortcutKeys(Blockly, SHORTCUTS_IN_MESSAGES[key]) : '';
      assert.equal(msg[key], keys ? value.replace('%1', keys) : value, key);
    }
    assert.equal(Object.keys(FR_BLOCKLY_MSG).length, 126);
    // and written as French is written, also where Blockly's French file is used as it is: ’ for an apostrophe, a
    // no-break space before : ; ! ? » and after « (only what the page can show or say: not the allow-list)
    const typography: string[] = [];
    for (const [key, value] of Object.entries(msg)) {
      if (typeof value !== 'string' || allowed(key)) continue;
      if (/'/.test(value)) typography.push(`${key}: ' in ${JSON.stringify(value)}`);
      if (/ [:;!?»]|« /.test(value)) typography.push(`${key}: a plain space in ${JSON.stringify(value)}`);
    }
    assert.deepEqual(typography, []);
    assert.equal(msg.PROCEDURES_DEFNORETURN_TITLE, 'définir');
    assert.equal(msg.NEW_VARIABLE, 'Créer une variable');
    assert.equal(msg.REDO, 'Rétablir');
    assert.equal(msg.UNDO, 'Annuler');
  });

  test("the shortcuts Blockly writes - in its right-click menus, its toasts, its screen-reader hints - have the French names of the keys (Ctrl, Maj); English keeps its own", () => {
    const msg = Blockly.Msg as Record<string, string>;
    applyBlocklyMessages(Blockly, 'fr', blocklyFrench);
    // the sentences (the toast after Ctrl + C or Ctrl + X, the screen-reader hints)
    assert.equal(msg.KEYBOARD_NAV_COPIED_HINT, 'Copié. Appuie sur Ctrl + V pour coller.');
    assert.equal(msg.KEYBOARD_NAV_CUT_HINT, 'Coupé. Appuie sur Ctrl + V pour coller.');
    assert.equal(msg.SCREENREADER_HINT, 'Utilise les flèches pour te déplacer. Appuie sur Alt + Maj + A pour activer ou couper le mode lecteur d’écran.');
    assert.equal(msg.SCREENREADER_MODE_ENABLED, 'Le mode lecteur d’écran est activé, appuie sur Alt + Maj + A pour le couper');
    assert.equal(msg.KEYBOARD_NAV_FLYOUT_LABEL_HINT, 'Utilise les flèches pour aller à un bloc, ou appuie sur H pour aller au titre suivant.');
    // (no shortcut "list_shortcuts" in this Blockly: Blockly never shows HELP_PROMPT, which keeps its %1)
    assert.equal(msg.HELP_PROMPT, FR_BLOCKLY_MSG.HELP_PROMPT);
    const onThisPage = (key: string): boolean =>
      !Object.keys(FR_BLOCKLY_NOT_ON_THIS_PAGE).some((k) => (k.startsWith('_') ? key.endsWith(k) : k.endsWith('_') ? key.startsWith(k) : key === k || key.includes(k)));
    for (const [key, value] of Object.entries(msg)) assert.ok(typeof value !== 'string' || !onThisPage(key) || !/\b(Control|Shift)\b/.test(value), `${key}: ${value}`);
    // the right-click menus: each entry with a shortcut, in a French workspace, as Blockly's own line with French keys
    const registry = Blockly.ContextMenuRegistry.registry;
    const line = (id: string, scope: object): string | HTMLElement => {
      const item = registry.getItem(id) as { displayText: (scope: object) => string | HTMLElement };
      return item.displayText(scope);
    };
    const block = Blockly.serialization.blocks.append(toolboxBlock('mbot2_stop', undefined, 'fr') as never, french);
    for (const [id, scope, words, keys] of [
      ['undoWorkspace', { workspace: french }, 'Annuler', ' Ctrl + Z'],
      ['redoWorkspace', { workspace: french }, 'Rétablir', ' Ctrl + Y'],
      ['blockDuplicate', { block }, 'Dupliquer', ' D'],
      ['blockDelete', { block }, msg.DELETE_BLOCK, ' Suppr'],
    ] as const) {
      const element = line(id, scope) as HTMLElement;
      assert.ok(element instanceof HTMLElement, id);
      assert.equal(element.outerHTML, `<div class="blocklyShortcutContainer"><span>${words}</span><span class="blocklyShortcut">${keys}</span></div>`, id);
    }
    // an English workspace gets what Blockly's entry gives, a plain text: Blockly writes its own shortcut ("Control + Z")
    applyBlocklyMessages(Blockly, 'en');
    assert.equal(line('undoWorkspace', { workspace: english }), 'Undo');
    assert.equal(msg.KEYBOARD_NAV_COPIED_HINT, (createRequire(import.meta.url)('blockly/msg/en') as Record<string, string>).KEYBOARD_NAV_COPIED_HINT);
    assert.ok(msg.KEYBOARD_NAV_COPIED_HINT.includes('%1'), 'Blockly fills it in itself, as before');
    applyBlocklyMessages(Blockly, 'fr', blocklyFrench);
    block.dispose();
  });

  test('hover texts in French: Blockly shows them in lines that never start at a no-break space, and keeps every no-break space; English as it was', () => {
    const limit = Blockly.Tooltip.LIMIT;
    const msg = Blockly.Msg as Record<string, string>;
    applyBlocklyMessages(Blockly, 'fr', blocklyFrench);
    const texts: Array<[string, string]> = [
      ...Object.entries(FR_BLOCKS).map(([type, fr]): [string, string] => [type, fr.tooltip]),
      ...Object.entries(FR_PALETTE_TOOLTIPS).map(([type, text]): [string, string] => [`palette ${type}`, text]),
      ['text bubble', FR_TEXT_BUBBLE_TOOLTIP],
      ...Object.keys(msg)
        .filter((key) => key.endsWith('_TOOLTIP') && typeof msg[key] === 'string')
        .map((key): [string, string] => [key, msg[key]]),
    ];
    const problems: string[] = [];
    let cut = 0;
    for (const [where, text] of texts) {
      const lines = frenchTooltipLines(Blockly, text);
      // only line breaks are added, in place of plain spaces: the same text, every no-break space kept
      if (lines.replace(/\n/g, ' ') !== text) problems.push(`${where}: not the same text ${JSON.stringify(lines)}`);
      // ... in lines Blockly shows as they are (it cuts only a line longer than its limit)
      if (Blockly.utils.string.wrap(lines, limit) !== lines) problems.push(`${where}: Blockly cuts it again ${JSON.stringify(lines)}`);
      if (lines.split('\n').some((line) => line.length > limit)) problems.push(`${where}: a line longer than ${limit}`);
      // ... and no line starts with what a no-break space holds to the word before it (a %1 of Blockly's is no "%"), nor ends with a «
      if (lines.split('\n').some((line) => /^(?:[»;:!?]|%(?!\d))/.test(line) || /«$/.test(line))) problems.push(`${where}: ${JSON.stringify(lines)}`);
      if (lines.includes('\n')) cut++;
    }
    assert.deepEqual(problems, []);
    assert.ok(cut >= 100, `${cut} texts are long enough to be cut`);
    // the text that showed it: Blockly's own cut put the » of « quand je reçois » at the start of a line
    const broadcast = FR_BLOCKS.event_broadcast.tooltip;
    assert.equal(Blockly.utils.string.wrap(broadcast, limit), 'Démarre tous les scripts « quand je reçois\n» de ce message, et continue tout de suite.');
    assert.equal(frenchTooltipLines(Blockly, broadcast), `Démarre tous les scripts «${NB}quand je reçois${NB}»\nde ce message, et continue tout de suite.`);
    // a text that fits on one line comes back as it is
    assert.equal(frenchTooltipLines(Blockly, FR_TEXT_BUBBLE_TOOLTIP), FR_TEXT_BUBBLE_TOOLTIP);

    // in the editors: a French block shows its text in those lines - also a text it is given later (a renamed
    // "my block" gives its own again); an English block keeps the text it is given, which Blockly cuts itself
    const fr = Blockly.serialization.blocks.append({ type: 'event_broadcast' } as never, french);
    const en = Blockly.serialization.blocks.append({ type: 'event_broadcast' } as never, english);
    assert.equal(Blockly.Tooltip.getTooltipOfObject(fr), frenchTooltipLines(Blockly, broadcast));
    assert.equal(Blockly.Tooltip.getTooltipOfObject(en), getBlockDef('event_broadcast')?.tooltip);
    const later = `Exécute ton bloc «${NB}avancer jusqu’à la ligne noire du dépôt${NB}».`;
    fr.setTooltip(later);
    en.setTooltip(later);
    assert.equal(Blockly.Tooltip.getTooltipOfObject(fr), frenchTooltipLines(Blockly, later));
    assert.ok(Blockly.Tooltip.getTooltipOfObject(fr).includes('\n'));
    assert.equal(Blockly.Tooltip.getTooltipOfObject(en), later);
    for (const block of [fr, en]) block.dispose();
  });

  test('a block moved with the keyboard: what Blockly says reads as French with the name of the block (its first sentence) and without it (every arrow key after it)', () => {
    const msg = Blockly.Msg as Record<string, string>;
    applyBlocklyMessages(Blockly, 'fr', blocklyFrench);
    // as Blockly fills them (block_drag_strategy.ts announceMove, block_aria_composer.ts computeMoveLabel): %1 the
    // moving block - '' after the first sentence of a move -, %2 the block next to it; white space closed up
    const say = (key: string, block: string): string => msg[key].replace('%1', block).replace('%2', 'le bras, monte').replace(/\s+/g, ' ');
    const where: Record<string, string> = {
      ANNOUNCE_MOVE_WORKSPACE: 'dans l’espace de travail.',
      ANNOUNCE_MOVE_TO: 'vers le bras, monte.',
      ANNOUNCE_MOVE_BEFORE: 'avant le bras, monte.',
      ANNOUNCE_MOVE_AFTER: 'après le bras, monte.',
      ANNOUNCE_MOVE_INSIDE: 'dans le bras, monte.',
      ANNOUNCE_MOVE_AROUND: 'pour entourer le bras, monte.',
    };
    for (const [key, rest] of Object.entries(where)) {
      assert.equal(say(key, ''), `Déplacer ${rest}`, key);
      assert.equal(say(key, 'la pince, se ferme'), `Déplacer la pince, se ferme ${rest}`, key);
    }
    assert.equal(msg.ANNOUNCE_MOVE_CANCELED, 'Déplacement annulé.');
    // English: Blockly's own sentences ("Moving on workspace." once the name is left out)
    const blocklyEnglish = createRequire(import.meta.url)('blockly/msg/en') as Record<string, string>;
    for (const key of Object.keys(where)) assert.equal(englishMessages[key], blocklyEnglish[key], key);
    assert.equal(englishMessages.ANNOUNCE_MOVE_WORKSPACE.replace('%1', '').replace(/\s+/g, ' '), 'Moving on workspace.');
  });

  test("what a screen reader says of a French block: a no-break space before Blockly's \":\" (\"menu : rouge\", \"Modifier nombre : 100\"), no lone \"?\"; the English labels as they were", () => {
    const label = (block: unknown): string => (block as { getFocusableElement(): Element }).getFocusableElement().getAttribute('aria-label') ?? '';
    const fr = Blockly.serialization.blocks.append(toolboxBlock('sensing_claw_color_is', undefined, 'fr') as never, french);
    assert.equal(label(fr), 'Début de pile, le capteur de couleur de la pince détecte, rouge, a une entrée,');
    const dropdown = fr.inputList.flatMap((input) => input.fieldRow).find((field) => field instanceof Blockly.FieldDropdown);
    assert.equal(dropdown?.computeAriaLabel(true), 'menu : rouge');
    const straight = Blockly.serialization.blocks.append(toolboxBlock('mbot2_straight_cm', undefined, 'fr') as never, french);
    const bubble = straight.getInput('DISTANCE')!.connection!.targetBlock()!;
    assert.equal(label(bubble), 'Modifier nombre : 100');
    // every French type name ends with the no-break space Blockly's ": " needs
    for (const key of Object.keys(FR_BLOCKLY_MSG).filter((k) => k.startsWith('ARIA_TYPE_FIELD_'))) assert.ok(FR_BLOCKLY_MSG[key].endsWith(NB), key);
    // English: Blockly's own labels, the lone "?" included
    const en = Blockly.serialization.blocks.append(toolboxBlock('sensing_claw_color_is') as never, english);
    assert.match(label(en), /, \?, /);
    for (const block of [fr, straight, en]) block.dispose();
  });

  test("one writer of Blockly's words: the Gripper window (registerBlocks) leaves French; an English editor is English again, key for key", () => {
    const msg = Blockly.Msg as Record<string, string>;
    createEditor(Blockly, 'fr2', { sounds: false, palette: ROBOT_EN_FETE, locale: 'fr', frenchMessages: blocklyFrench }).dispose();
    const frenchWords = { ...msg };
    assert.equal(msg.PROCEDURES_DEFNORETURN_PROCEDURE, 'mon bloc');
    // what the window "Inside the Gripper blocks" does when it opens
    registerBlocks(Blockly);
    assert.deepEqual({ ...msg }, frenchWords);
    // its pictures: workspaces of their own, marked French - the My Block "définir la pince s’ouvre"
    const picture = Blockly.inject('picture', { readOnly: true, sounds: false });
    setWorkspaceLocale(picture, 'fr');
    Blockly.serialization.workspaces.load(gripperDefinitionProgram(DEFAULT_ROBOT_CONFIG, 'claw-open', 'fr') as never, picture);
    const definition = picture.getTopBlocks(false)[0];
    assert.equal(definition.toString().startsWith('définir la pince s’ouvre'), true, definition.toString());
    assert.ok(definition.toString().includes('régler le servo S2 à l’angle'), definition.toString());
    picture.dispose();
    assert.deepEqual({ ...msg }, frenchWords);
    // back on an English page (the site's links, no reload)
    createEditor(Blockly, 'en2', { sounds: false, palette: 'warehouse-sort' }).dispose();
    assert.deepEqual({ ...msg }, englishMessages);
    assert.equal(msg.PROCEDURES_DEFNORETURN_TITLE, 'define');
    assert.equal(msg.NEW_VARIABLE, 'Make a Variable');
    assert.equal(msg.REDO, 'Redo');
    // and English is Blockly's English plus the ten Scratch words, nothing else
    const blocklyEnglish = createRequire(import.meta.url)('blockly/msg/en') as Record<string, string>;
    const changed = Object.keys(msg).filter((key) => msg[key] !== blocklyEnglish[key]);
    // (NEW_VARIABLE_TITLE is one of the ten, but Blockly's English already says "New variable name:")
    assert.deepEqual(changed.sort(), [
      'NEW_VARIABLE', 'PROCEDURES_CALLNORETURN_TOOLTIP', 'PROCEDURES_CALLRETURN_TOOLTIP', 'PROCEDURES_DEFNORETURN_PROCEDURE',
      'PROCEDURES_DEFNORETURN_TITLE', 'PROCEDURES_DEFNORETURN_TOOLTIP', 'PROCEDURES_DEFRETURN_PROCEDURE', 'PROCEDURES_DEFRETURN_TITLE', 'PROCEDURES_DEFRETURN_TOOLTIP',
    ]); // prettier-ignore
    // a word changed for one call comes back
    withBlocklyMessage(Blockly, 'NEW_VARIABLE_TITLE', 'x', () => assert.equal(msg.NEW_VARIABLE_TITLE, 'x'));
    assert.equal(msg.NEW_VARIABLE_TITLE, 'New variable name:');
  });

  test("a French editor that is closed puts Blockly's own words back into English (a lesson's starter blocks set none of their own)", () => {
    const msg = Blockly.Msg as Record<string, string>;
    const blocklyEnglish = createRequire(import.meta.url)('blockly/msg/en') as Record<string, string>;
    const frenchEditor = createEditor(Blockly, 'fr2', { sounds: false, palette: ROBOT_EN_FETE, locale: 'fr', frenchMessages: blocklyFrench });
    // ("repeat %1 times": Blockly's own block, which the lesson player of the training pages shows)
    assert.equal(msg.CONTROLS_REPEAT_TITLE, blocklyFrench.CONTROLS_REPEAT_TITLE);
    assert.notEqual(msg.CONTROLS_REPEAT_TITLE, blocklyEnglish.CONTROLS_REPEAT_TITLE);
    disposeEditor(Blockly, frenchEditor);
    assert.deepEqual({ ...msg }, englishMessages);
    assert.equal(msg.CONTROLS_REPEAT_TITLE, blocklyEnglish.CONTROLS_REPEAT_TITLE);
    assert.equal(document.querySelector('#fr2 .blocklySvg'), null, 'the French editor is gone');
    // an English editor is only disposed: Blockly's words stay as they are
    const englishEditor = createEditor(Blockly, 'en2', { sounds: false, palette: 'warehouse-sort' });
    const before = { ...msg };
    disposeEditor(Blockly, englishEditor);
    assert.deepEqual({ ...msg }, before);
    assert.equal(document.querySelector('#en2 .blocklySvg'), null, 'the English editor is gone');
  });
});
