/**
 * A palette per game (./palettes.ts).
 *
 *  - Fire Rescue is live: its palette must stay exactly what it was before the second game
 *    came. It is pinned here three ways: its categories and blocks written out, a fingerprint
 *    of the whole toolbox (so a changed default value, label or gap is caught too), and a
 *    fingerprint of the definitions of its blocks (texts, menus, tooltips).
 *  - Fire Chief shows the same without Gripper, Servos and the Colour Sensor at the claw, plus
 *    two categories of its own: the DC motor ports and the colour sensor that is fixed to the
 *    front of its robot. It has no flame sensor: no block, no category, no word of one.
 *  - The texts of the new blocks are not confirmed against mBlock yet; they all come from one
 *    file (./mblock-wording.ts).
 *  - The real Blockly library accepts both palettes (it is loaded with a pretend browser, jsdom).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { before, describe, it, test } from 'node:test';

import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import { fireChiefGame } from '../fire-chief/game';
import { fireRescueGame } from '../fire-rescue/game';
import { BLOCKS, CATEGORIES, getBlockDef, getCategory, type CategoryId } from './catalog';
import { DC_MOTOR_MENU, DC_MOTOR_STOP_MENU, UNCONFIRMED_BLOCK_TEXTS, UNCONFIRMED_BLOCK_TYPES, UNCONFIRMED_CATEGORY_NAMES } from './mblock-wording';
import { DEFAULT_PALETTE, isPaletteId, PALETTE_IDS, paletteCategories, paletteOf, PALETTES } from './palettes';
import { createEditor, type BlocklyApi } from './register';
import { buildToolbox, paletteBlockTypes, paletteToolbox, TOOLBOX, toolboxBlockTypes, type ToolboxJson } from './toolbox';

const fingerprint = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');

interface PinnedCategory {
  id: CategoryId;
  name: string;
  colour: string;
  custom?: string;
  blocks: string[];
}

/** What a toolbox shows, category by category: the shape of the pins below. */
function shown(toolbox: ToolboxJson): PinnedCategory[] {
  return toolbox.contents.map((category) => {
    const entry: PinnedCategory = {
      id: category.toolboxitemid,
      name: category.name,
      colour: category.colour,
      blocks: (category.contents ?? []).flatMap((item) => (item.kind === 'block' ? [item.type] : [])),
    };
    if (category.custom) entry.custom = category.custom;
    return entry;
  });
}

// prettier-ignore
/** The eight categories both games share, as they were at commit 4be0896 (before Fire Chief). */
const COMMON_PINNED: PinnedCategory[] = [
  { id: 'cyberpi', name: 'CyberPi', colour: '#9966FF', blocks: [
    'cyberpi_led_color', 'cyberpi_led_rgb', 'cyberpi_led_off', 'cyberpi_print', 'cyberpi_show_label',
    'cyberpi_clear_screen', 'cyberpi_play_tone',
  ] },
  { id: 'sensing', name: 'Sensing', colour: '#5CB1D6', blocks: [
    'cyberpi_button_pressed', 'cyberpi_joystick_pulled', 'cyberpi_timer', 'cyberpi_reset_timer',
    'cyberpi_rotation_z', 'cyberpi_yaw', 'cyberpi_reset_yaw',
  ] },
  { id: 'events', name: 'Events', colour: '#FFBF00', blocks: [
    'event_cyberpi_start', 'event_button_pressed', 'event_joystick', 'event_whenbroadcastreceived',
    'event_broadcast', 'event_broadcastandwait',
  ] },
  { id: 'control', name: 'Control', colour: '#FFAB19', blocks: [
    'control_wait', 'control_repeat', 'control_forever', 'control_if', 'control_if_else', 'control_wait_until',
    'control_repeat_until', 'control_stop',
  ] },
  { id: 'operators', name: 'Operators', colour: '#59C059', blocks: [
    'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_random', 'operator_gt',
    'operator_lt', 'operator_equals', 'operator_and', 'operator_or', 'operator_not', 'operator_join',
    'operator_letter_of', 'operator_length', 'operator_contains', 'operator_mod', 'operator_round',
    'operator_mathop',
  ] },
  { id: 'variables', name: 'Variables', colour: '#FF8C1A', custom: 'VARIABLE', blocks: [] },
  { id: 'myblocks', name: 'My Blocks', colour: '#FF6680', custom: 'PROCEDURE', blocks: [] },
  { id: 'chassis', name: 'mBot2 Chassis', colour: '#4C97FF', blocks: [
    'mbot2_move_direction_with_time', 'mbot2_straight_cm', 'mbot2_turn_deg', 'mbot2_move_direction',
    'mbot2_drive_speed', 'mbot2_drive_power', 'mbot2_motor_speed', 'mbot2_motor_power', 'mbot2_motor_rotate_deg',
    'mbot2_stop', 'mbot2_motor_angle', 'mbot2_motor_rpm', 'mbot2_motor_power_value', 'mbot2_motor_reset_angle',
  ] },
];

// prettier-ignore
const QUAD_RGB_PINNED: PinnedCategory = { id: 'quadrgb', name: 'Quad RGB Sensor', colour: '#0FBD8C', blocks: [
  'sensing_quadrgb_line_status', 'sensing_quadrgb_status_is', 'sensing_quadrgb_deviation',
  'sensing_quadrgb_probe_detects', 'sensing_quadrgb_probe_color_is', 'sensing_quadrgb_probe_color',
  'sensing_quadrgb_probe_rgb', 'sensing_quadrgb_probe_gray', 'sensing_quadrgb_probe_light',
] };
const ULTRASONIC_PINNED: PinnedCategory = {
  id: 'ultrasonic',
  name: 'Ultrasonic Sensor 2',
  colour: '#0E9E86',
  blocks: ['sensing_ultrasonic_distance'],
};

/** The palette of Fire Rescue as it was at commit 4be0896: 13 categories, 78 blocks in the static ones. */
const FIRE_RESCUE_PINNED: PinnedCategory[] = [
  ...COMMON_PINNED,
  { id: 'servo', name: 'Servos', colour: '#4A6CD4', blocks: ['mbot2_servo_set', 'mbot2_servo_angle'] },
  { id: 'gripper', name: 'Gripper', colour: '#CF63CF', blocks: ['gripper_claw', 'gripper_arm', 'gripper_arm_height'] },
  QUAD_RGB_PINNED,
  ULTRASONIC_PINNED,
  {
    id: 'colorsensor',
    name: 'Colour Sensor',
    colour: '#2E9BB5',
    blocks: ['sensing_claw_color_is', 'sensing_claw_color', 'sensing_claw_object_detected'],
  },
];

/**
 * Fingerprints taken from the code of commit 4be0896 (git archive 4be0896, then
 * sha256 of JSON.stringify): the whole toolbox, and the definitions of its 91 blocks.
 */
const FIRE_RESCUE_TOOLBOX_FINGERPRINT = 'd2128fa4c33a8a1673f3590cbafd0c7abfb61ced04ff704e9a625704141edae6';
const FIRE_RESCUE_BLOCKS_FINGERPRINT = '29a225233bcbd098dd0441ed0592962a5153f316c6a6545ad2d9e5e999464445';

/**
 * The palette of Fire Chief: no Servos, no Gripper, no Colour Sensor at the claw; the DC motor
 * ports and the colour sensor that looks forward instead.
 */
const FIRE_CHIEF_PINNED: PinnedCategory[] = [
  ...COMMON_PINNED,
  {
    id: 'extensionport',
    name: 'mBot2 Extension Port',
    colour: '#3F6FD9',
    blocks: ['mbot2_dc_motor_power', 'mbot2_dc_motor_drive', 'mbot2_dc_motor_stop'],
  },
  QUAD_RGB_PINNED,
  ULTRASONIC_PINNED,
  {
    id: 'frontcolorsensor',
    name: 'Colour Sensor',
    colour: '#2E9BB5',
    blocks: ['sensing_colorsensor_color_is', 'sensing_colorsensor_color'],
  },
];

describe('the palette of Fire Rescue stays exactly as it was', () => {
  it('has the same 13 categories with the same blocks, in the same order', () => {
    assert.deepEqual(shown(TOOLBOX), FIRE_RESCUE_PINNED);
    assert.equal(TOOLBOX.contents.length, 13);
    assert.equal(shown(TOOLBOX).reduce((count, category) => count + category.blocks.length, 0), 78);
  });

  it('is the same toolbox to the last default value, label and gap', () => {
    assert.equal(fingerprint(TOOLBOX), FIRE_RESCUE_TOOLBOX_FINGERPRINT);
  });

  it('is what an editor gets that names no game, or names Fire Rescue', () => {
    assert.equal(DEFAULT_PALETTE, 'fire-rescue');
    assert.equal(fireRescueGame.id, 'fire-rescue');
    assert.deepEqual(paletteToolbox(), TOOLBOX);
    assert.deepEqual(paletteToolbox(fireRescueGame.id), TOOLBOX);
    assert.deepEqual(buildToolbox(paletteCategories('fire-rescue')), TOOLBOX);
    // a game that has no palette of its own gets it too, and so does nonsense
    assert.deepEqual(paletteToolbox('some-future-game'), TOOLBOX);
    assert.equal(paletteOf('some-future-game'), 'fire-rescue');
    assert.equal(paletteOf(undefined), 'fire-rescue');
    assert.equal(paletteOf('toString'), 'fire-rescue');
    assert.equal(paletteOf('__proto__'), 'fire-rescue');
  });

  it('none of its blocks was changed: texts, menus, default values and tooltips are what they were', () => {
    const categories = new Set(paletteCategories('fire-rescue'));
    const blocks = BLOCKS.filter((def) => categories.has(def.category));
    assert.equal(blocks.length, 91);
    assert.equal(fingerprint(blocks), FIRE_RESCUE_BLOCKS_FINGERPRINT);
    assert.deepEqual(
      paletteBlockTypes('fire-rescue'),
      blocks.map((def) => def.type),
    );
  });

  it('shows nothing of the fan or the colour sensor of Fire Chief', () => {
    const types = toolboxBlockTypes(TOOLBOX);
    for (const type of [
      'mbot2_dc_motor_power',
      'mbot2_dc_motor_drive',
      'mbot2_dc_motor_stop',
      'sensing_colorsensor_color_is',
      'sensing_colorsensor_color',
    ]) {
      assert.ok(!types.includes(type), type);
      assert.ok(!paletteBlockTypes('fire-rescue').includes(type), type);
    }
    assert.ok(!JSON.stringify(TOOLBOX).includes('DC motor'));
    assert.ok(!JSON.stringify(TOOLBOX).includes('colorsensor_'));
    // its one "Colour Sensor" category is the one at the claw, with the three blocks it always had
    const colour = TOOLBOX.contents.filter((category) => category.name === 'Colour Sensor');
    assert.deepEqual(
      colour.map((category) => category.toolboxitemid),
      ['colorsensor'],
    );
    assert.deepEqual(
      ['sensing_claw_color_is', 'sensing_claw_color', 'sensing_claw_object_detected'].map((type) => getBlockDef(type)?.message),
      ['claw colour sensor detects %1 ?', 'claw colour sensor colour', 'object detected at claw ?'],
    );
  });
});

describe('the palette of Fire Chief', () => {
  const toolbox = paletteToolbox('fire-chief');

  it('is the palette of Fire Rescue without Gripper, Servos and the Colour Sensor at the claw, plus the DC motor ports and its own colour sensor', () => {
    assert.equal(fireChiefGame.id, 'fire-chief');
    assert.deepEqual(shown(toolbox), FIRE_CHIEF_PINNED);
    assert.deepEqual(paletteCategories('fire-chief'), FIRE_CHIEF_PINNED.map((category) => category.id));
    const rescue = paletteCategories('fire-rescue');
    const chief = paletteCategories('fire-chief');
    assert.deepEqual(
      rescue.filter((id) => !chief.includes(id)),
      ['servo', 'gripper', 'colorsensor'],
    );
    assert.deepEqual(
      chief.filter((id) => !rescue.includes(id)),
      ['extensionport', 'frontcolorsensor'],
    );
    // a category both games show is the very same in both: same blocks, default values and gaps
    for (const category of toolbox.contents) {
      const twin = TOOLBOX.contents.find((c) => c.toolboxitemid === category.toolboxitemid);
      if (twin) assert.deepEqual(category, twin, category.name);
    }
  });

  it('holds only blocks real mBlock has: no Gripper shortcut, no servo, no claw colour sensor', () => {
    const types = toolboxBlockTypes(toolbox);
    for (const type of types) {
      assert.ok(!/^gripper_|^mbot2_servo_|^sensing_claw_/.test(type), type);
    }
    assert.ok(!JSON.stringify(toolbox).includes('Shortcuts made for this simulator'));
    assert.ok(!toolbox.contents.some((category) => (category.contents ?? []).some((item) => item.kind === 'button' || item.kind === 'label')));
    // every block it lists is a block of the catalog, in a category of this palette
    const mine = new Set(paletteBlockTypes('fire-chief'));
    for (const category of toolbox.contents) {
      for (const item of category.contents ?? []) {
        if (item.kind !== 'block') continue;
        assert.ok(mine.has(item.type), item.type);
        assert.equal(getBlockDef(item.type)?.category, category.toolboxitemid, item.type);
      }
    }
    assert.equal(mine.size, 91 - 2 - 3 - 3 + 3 + 2);
  });

  it('has no flame sensor: the game is played with the colour sensor, and no palette, category or block of the simulator names a flame', () => {
    // (the flame sensor of the draft rules was taken out when the organiser chose a colour sensor)
    assert.equal(/flame/i.test(JSON.stringify(toolbox)), false, 'the Fire Chief toolbox');
    assert.equal(/flame/i.test(JSON.stringify(TOOLBOX)), false, 'the Fire Rescue toolbox');
    assert.equal(/flame/i.test(JSON.stringify(CATEGORIES)), false, 'the categories of the catalog');
    assert.equal(/flame|infrared/i.test(JSON.stringify(BLOCKS)), false, 'the blocks of the catalog: types, texts, tooltips');
    assert.equal(/flame/i.test(JSON.stringify([UNCONFIRMED_CATEGORY_NAMES, UNCONFIRMED_BLOCK_TEXTS])), false, 'the texts that wait for a check against mBlock');
    // the colour sensor is there, and it is the last category
    assert.equal(toolbox.contents[toolbox.contents.length - 1].toolboxitemid, 'frontcolorsensor');
  });

  it('gives the new blocks their white bubbles and menus', () => {
    const port = toolbox.contents.find((c) => c.toolboxitemid === 'extensionport')!;
    assert.deepEqual(port.contents, [
      {
        kind: 'block',
        type: 'mbot2_dc_motor_power',
        fields: { PORT: 'M1' },
        inputs: { POWER: { shadow: { type: 'math_number', fields: { NUM: 50 } } } },
      },
      {
        kind: 'block',
        type: 'mbot2_dc_motor_drive',
        inputs: {
          M1: { shadow: { type: 'math_number', fields: { NUM: 50 } } },
          M2: { shadow: { type: 'math_number', fields: { NUM: 50 } } },
        },
      },
      { kind: 'block', type: 'mbot2_dc_motor_stop', fields: { PORT: 'M1' } },
    ]);
    const colour = toolbox.contents.find((c) => c.toolboxitemid === 'frontcolorsensor')!;
    assert.deepEqual(colour.contents, [
      {
        kind: 'block',
        type: 'sensing_colorsensor_color_is',
        fields: { COLOR: 'red' },
        inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } },
      },
      { kind: 'block', type: 'sensing_colorsensor_color', inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
    ]);
  });
});

describe('palettes and games', () => {
  it('there is one palette per game, named by the id of the game', () => {
    assert.deepEqual([...PALETTE_IDS].sort(), [fireChiefGame.id, fireRescueGame.id].sort());
    for (const id of PALETTE_IDS) assert.ok(isPaletteId(id));
    assert.equal(isPaletteId('fire'), false);
    assert.equal(isPaletteId(undefined), false);
    assert.equal(isPaletteId('constructor'), false);
  });

  it('every palette lists known categories once, in catalog order, and starts with the eight basics', () => {
    const order = CATEGORIES.map((c) => c.id);
    for (const id of PALETTE_IDS) {
      const categories = PALETTES[id];
      assert.equal(new Set(categories).size, categories.length, id);
      for (const category of categories) assert.ok(getCategory(category), category);
      assert.deepEqual(
        [...categories],
        order.filter((c) => categories.includes(c)),
        `${id} follows the order of the catalog`,
      );
      assert.deepEqual(categories.slice(0, 8), ['cyberpi', 'sensing', 'events', 'control', 'operators', 'variables', 'myblocks', 'chassis']);
      // no palette shows two categories of the same name (the catalog has two called "Colour
      // Sensor": the one at the claw of Fire Rescue and the one at the front of Fire Chief)
      const names = categories.map((category) => getCategory(category).name);
      assert.equal(new Set(names).size, names.length, `${id}: ${names.join(', ')}`);
    }
    assert.equal(getCategory('colorsensor').name, getCategory('frontcolorsensor').name);
    // paletteCategories hands out a copy: changing it does not change the palette
    paletteCategories('fire-chief').push('gripper');
    assert.equal(PALETTES['fire-chief'].includes('gripper'), false);
  });

  it('every block of the catalog is offered by at least one game, and every category is used', () => {
    const offered = new Set(PALETTE_IDS.flatMap((id) => paletteBlockTypes(id)));
    assert.deepEqual(
      BLOCKS.filter((def) => !offered.has(def.type)).map((def) => def.type),
      [],
    );
    const used = new Set(PALETTE_IDS.flatMap((id) => [...PALETTES[id]]));
    assert.deepEqual(
      CATEGORIES.filter((c) => !used.has(c.id)).map((c) => c.id),
      [],
    );
  });

  it('a palette shows the blocks of a part exactly when the robot of the game has that part', () => {
    const robots = { 'fire-rescue': fireRescueGame.robotConfig ?? DEFAULT_ROBOT_CONFIG, 'fire-chief': fireChiefGame.robotConfig ?? DEFAULT_ROBOT_CONFIG };
    for (const id of PALETTE_IDS) {
      const robot = robots[id];
      const has = (category: CategoryId): boolean => PALETTES[id].includes(category);
      assert.equal(has('gripper'), robot.gripper.enabled, `${id}: gripper`);
      assert.equal(has('servo'), robot.gripper.enabled, `${id}: servos (they move the gripper)`);
      const colour = robot.frontColorSensor;
      assert.equal(has('colorsensor'), colour.enabled && colour.mount === undefined, `${id}: colour sensor at the claw`);
      assert.equal(has('frontcolorsensor'), colour.enabled && colour.mount !== undefined, `${id}: colour sensor fixed to the front`);
      assert.equal(has('extensionport'), robot.fan?.enabled === true, `${id}: fan on a DC motor port`);
    }
    // the fan of Fire Chief is on a port the DC motor blocks offer
    assert.ok(DC_MOTOR_MENU.includes(fireChiefGame.robotConfig!.fan!.port));
  });
});

describe('block texts that are not confirmed against mBlock yet', () => {
  it('are all in one file: the two category names and the five block texts', () => {
    assert.equal(getCategory('extensionport').name, UNCONFIRMED_CATEGORY_NAMES.extensionPort.text);
    assert.equal(getCategory('frontcolorsensor').name, UNCONFIRMED_CATEGORY_NAMES.colorSensor.text);
    assert.equal(Object.keys(UNCONFIRMED_CATEGORY_NAMES).length, 2);
    assert.equal(UNCONFIRMED_BLOCK_TYPES.length, 5);
    const unconfirmed: CategoryId[] = ['extensionport', 'frontcolorsensor'];
    const fromNewCategories = BLOCKS.filter((def) => unconfirmed.includes(def.category)).map((def) => def.type);
    assert.deepEqual([...UNCONFIRMED_BLOCK_TYPES].sort(), [...fromNewCategories].sort());
    for (const [type, entry] of Object.entries(UNCONFIRMED_BLOCK_TEXTS)) {
      assert.equal(getBlockDef(type)?.message, entry.text, type);
      assert.ok(entry.toCheck.length > 20, type);
    }
    // nothing about the colour sensor is confirmed: its category and both its blocks are guesses
    assert.equal(UNCONFIRMED_CATEGORY_NAMES.colorSensor.confidence, 'guess');
    assert.equal(UNCONFIRMED_BLOCK_TEXTS.sensing_colorsensor_color_is.confidence, 'guess');
    assert.equal(UNCONFIRMED_BLOCK_TEXTS.sensing_colorsensor_color.confidence, 'guess');
  });

  it('are the wording the research found most likely', () => {
    const text = (type: keyof typeof UNCONFIRMED_BLOCK_TEXTS): string => UNCONFIRMED_BLOCK_TEXTS[type].text;
    assert.equal(text('mbot2_dc_motor_power'), 'DC motor %1 rotates at power %2 %');
    assert.equal(text('mbot2_dc_motor_drive'), 'DC motor M1 rotates at power %1 % , DC motor M2 rotates at power %2 %');
    assert.equal(text('mbot2_dc_motor_stop'), 'DC motor %1 stops rotating');
    assert.equal(text('sensing_colorsensor_color_is'), 'colour sensor %1 detects %2 ?');
    assert.equal(text('sensing_colorsensor_color'), 'colour sensor %1 colour');
    assert.deepEqual(DC_MOTOR_MENU, ['M1', 'M2']);
    assert.deepEqual(DC_MOTOR_STOP_MENU, ['M1', 'M2', 'all']);
    assert.equal(UNCONFIRMED_CATEGORY_NAMES.extensionPort.text, 'mBot2 Extension Port');
    assert.equal(UNCONFIRMED_CATEGORY_NAMES.colorSensor.text, 'Colour Sensor');
  });

  it('the blocks of the colour sensor carry the number of the sensor first, as the blocks of mBuild modules do; the tooltips name the 15 mm of this simulator', () => {
    const detects = getBlockDef('sensing_colorsensor_color_is')!;
    const colour = getBlockDef('sensing_colorsensor_color')!;
    assert.deepEqual(
      detects.args.map((arg) => [arg.type, arg.name]),
      [
        ['input_value', 'INDEX'],
        ['field_dropdown', 'COLOR'],
      ],
    );
    assert.deepEqual(
      colour.args.map((arg) => [arg.type, arg.name]),
      [['input_value', 'INDEX']],
    );
    // a number slot whose white bubble says 1: the first (and only) colour sensor
    for (const def of [detects, colour]) assert.deepEqual(def.args[0], { type: 'input_value', name: 'INDEX', shadow: { kind: 'number', value: 1 } });
    // the one number the tooltips say is the range of the sensor of the Fire Chief robot, in centimetres
    const range = fireChiefGame.robotConfig!.frontColorSensor.rangeMm;
    assert.equal(range, 15);
    for (const def of [detects, colour]) {
      assert.ok(def.tooltip.includes(`${range / 10} cm or less`), def.tooltip);
      assert.ok(def.tooltip.includes('in this simulator'), 'the 1.5 cm are the simulator\'s, not a rule');
      assert.deepEqual(def.tooltip.match(/\d+(\.\d+)? ?(cm|mm)/g), ['1.5 cm'], def.tooltip);
    }
  });

  it('the blocks have the shapes mBlock gives them', () => {
    assert.equal(getBlockDef('mbot2_dc_motor_power')?.shape, 'statement');
    assert.equal(getBlockDef('mbot2_dc_motor_drive')?.shape, 'statement');
    assert.equal(getBlockDef('mbot2_dc_motor_stop')?.shape, 'statement');
    assert.equal(getBlockDef('sensing_colorsensor_color_is')?.shape, 'boolean');
    assert.equal(getBlockDef('sensing_colorsensor_color')?.shape, 'reporter');
  });
});

// =============================================================================================
// With the real Blockly library
// =============================================================================================

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly. */
async function loadBlocklyWithDom(): Promise<BlocklyApi> {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> } };
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="rescue" style="width: 900px; height: 600px"></div><div id="chief" style="width: 900px; height: 600px"></div><div id="own" style="width: 900px; height: 600px"></div>',
    { pretendToBeVisual: true },
  );
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

describe('the editor factory', () => {
  let Blockly: BlocklyApi;
  before(async () => {
    Blockly = await loadBlocklyWithDom();
  });

  /** The names of the categories an editor shows, top to bottom. */
  const categoryNames = (workspace: ReturnType<typeof createEditor>): string[] =>
    (workspace.getToolbox()?.getToolboxItems() ?? []).map((item) => (item as unknown as { getName(): string }).getName());

  test('without a game it shows the palette of Fire Rescue; with palette: "fire-chief" the palette of Fire Chief', () => {
    const rescue = createEditor(Blockly, 'rescue', { sounds: false });
    assert.deepEqual(categoryNames(rescue), FIRE_RESCUE_PINNED.map((category) => category.name));

    const chief = createEditor(Blockly, 'chief', { sounds: false, palette: fireChiefGame.id });
    assert.deepEqual(categoryNames(chief), FIRE_CHIEF_PINNED.map((category) => category.name));
    assert.ok(!categoryNames(chief).includes('Gripper'));

    // a toolbox of one's own wins over the palette of a game
    const own = createEditor(Blockly, 'own', { sounds: false, palette: 'fire-chief', toolbox: buildToolbox(['events', 'chassis']) });
    assert.deepEqual(categoryNames(own), ['Events', 'mBot2 Chassis']);

    for (const workspace of [rescue, chief, own]) workspace.dispose();
  });

  test('Blockly accepts every entry of the Fire Chief palette, and draws the new blocks with their texts', () => {
    const workspace = createEditor(Blockly, 'chief', { sounds: false, palette: 'fire-chief' });
    let count = 0;
    for (const category of paletteToolbox('fire-chief').contents) {
      for (const item of category.contents ?? []) {
        if (item.kind !== 'block') continue;
        const { kind: _kind, ...state } = item;
        const block = Blockly.serialization.blocks.append(state as never, workspace);
        assert.equal(block.type, item.type);
        for (const name of Object.keys(item.inputs ?? {})) {
          assert.ok(block.getInput(name)?.connection?.targetBlock()?.isShadow(), `${item.type}.${name} has no white bubble`);
        }
        count++;
      }
    }
    assert.equal(count, 75, '78 of Fire Rescue - 2 servo - 3 gripper - 3 colour sensor at the claw + 3 DC motor + 2 colour sensor');

    // what a student reads on the new blocks (menus show their first entry, bubbles their default)
    const read = (type: string): string => workspace.getBlocksByType(type)[0].toString();
    assert.equal(read('mbot2_dc_motor_power'), 'DC motor M1 rotates at power 50 %');
    assert.equal(read('mbot2_dc_motor_drive'), 'DC motor M1 rotates at power 50 % , DC motor M2 rotates at power 50 %');
    assert.equal(read('mbot2_dc_motor_stop'), 'DC motor M1 stops rotating');
    assert.equal(read('sensing_colorsensor_color_is'), 'colour sensor 1 detects red ?');
    assert.equal(read('sensing_colorsensor_color'), 'colour sensor 1 colour');

    // the blocks of a game the palette does not show are still known: a program from Fire Rescue loads
    const foreign = Blockly.serialization.blocks.append({ type: 'gripper_claw', fields: { ACTION: 'close' } } as never, workspace);
    assert.equal(foreign.type, 'gripper_claw');
    workspace.dispose();
  });
});
