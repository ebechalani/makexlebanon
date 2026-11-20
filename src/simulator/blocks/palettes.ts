/**
 * A palette per game: which categories of blocks the editor of a game shows, and in which order.
 *
 * The block catalog (./catalog.ts) holds every block of the simulator. A game shows only the
 * blocks its robot can use - and only blocks that exist in real mBlock, plus (in Fire Rescue)
 * the Gripper shortcuts that were made for that game:
 *
 *   Fire Rescue   the mBot2 with the gripper: Servos, Gripper and the Colour Sensor at the claw;
 *                 no fan.
 *   Fire Chief    the mBot2 with a fan on DC motor port M1 and a colour sensor fixed to its
 *                 front (it has blocks of its own); no gripper, so no Servos, no Gripper
 *                 shortcuts and no Colour Sensor at the claw.
 *   Warehouse Sort   the same robot and the same blocks as Fire Rescue. Its mat has WHITE lines
 *                 on black, and its robot's Quad RGB sensor has learned that: one hover text
 *                 says so (PALETTE_TOOLTIPS below).
 *   Locker Room   the robot of Warehouse Sort (it carries a Team Box on top, which no block
 *                 touches): the same blocks, and the same hover texts about the white line and
 *                 the cubes; the colour sensor at the claw also reads the referee's colour card.
 *   Fire Fighter  the robot of Fire Rescue, part for part: the same blocks. Its mat has black
 *                 lines on white, as Fire Rescue's, so the line texts stay the catalog's; the
 *                 gripper takes cubes, so two hover texts say "a cube", as Warehouse Sort's do.
 *
 *   Fire Rescue Junior   another version of Fire Rescue (the same robot and field, fewer draws):
 *                 the palette of Fire Rescue, through GAME_VERSIONS below.
 *
 * The name of a palette is the id of its game (Game.id). To get the palette of a game:
 *
 *   paletteCategories('fire-chief')              the ids of its categories, in order
 *   paletteToolbox('fire-chief')                 the toolbox JSON for Blockly      (./toolbox.ts)
 *   paletteBlockTypes('fire-chief')              every block type of its categories (./toolbox.ts)
 *   createEditor(Blockly, div, { palette: 'fire-chief' })                          (./register.ts)
 *
 * A palette only decides what the editor OFFERS. Every block of the catalog stays known to
 * Blockly and to the interpreter in every game, so a program that was made in another game (or
 * loaded from a file) still shows and runs; a block for a part the robot does not have does
 * nothing and says so in the console.
 *
 * Plain data: no Blockly, no DOM.
 */
import { GRIPPER_SHORTCUT, type CategoryId } from './catalog';

/** The games that have a palette: the same words as Game.id. */
export type PaletteId = 'fire-rescue' | 'fire-chief' | 'warehouse-sort' | 'locker-room' | 'fire-fighter';

/** The palette an editor gets when no game is named (and for a game that has no palette of its own). */
export const DEFAULT_PALETTE: PaletteId = 'fire-rescue';

/** What every game has: the CyberPi, the Scratch basics and the two drive motors. */
const COMMON: CategoryId[] = ['cyberpi', 'sensing', 'events', 'control', 'operators', 'variables', 'myblocks', 'chassis'];

/** The categories of each game's palette, in the order they are shown (mBlock order). */
export const PALETTES: Record<PaletteId, readonly CategoryId[]> = {
  'fire-rescue': [...COMMON, 'servo', 'gripper', 'quadrgb', 'ultrasonic', 'colorsensor'],
  'fire-chief': [...COMMON, 'extensionport', 'quadrgb', 'ultrasonic', 'frontcolorsensor'],
  'warehouse-sort': [...COMMON, 'servo', 'gripper', 'quadrgb', 'ultrasonic', 'colorsensor'],
  'locker-room': [...COMMON, 'servo', 'gripper', 'quadrgb', 'ultrasonic', 'colorsensor'],
  'fire-fighter': [...COMMON, 'servo', 'gripper', 'quadrgb', 'ultrasonic', 'colorsensor'],
};

/**
 * Hover texts that are different in one game. The block is the same block everywhere; only what
 * it means in that game is different. In Warehouse Sort:
 *  - the lines are white on a black mat (the robot's Quad RGB sensor has learned that, see
 *    warehouse-sort/robot.ts), so "the line" is the white line - the text of the catalog says
 *    "the dark line";
 *  - the gripper takes cubes - the texts of the catalog name Fire Rescue's buckets and persons.
 */
export const PALETTE_TOOLTIPS: Partial<Record<PaletteId, Readonly<Record<string, string>>>> = {
  'warehouse-sort': {
    sensing_quadrgb_probe_detects: 'True when this probe is over the white line (or over the black mat).',
    gripper_claw: `Opens or closes the claw and waits until it has finished. Closing on a cube grabs it. ${GRIPPER_SHORTCUT}`,
    sensing_claw_object_detected: 'True when there is a cube in (or just in front of) the claw.',
  },
  // (the white lines and the cubes of Warehouse Sort; the referee's colour card is seen too)
  'locker-room': {
    sensing_quadrgb_probe_detects: 'True when this probe is over the white line (or over the black mat).',
    gripper_claw: `Opens or closes the claw and waits until it has finished. Closing on a cube grabs it. ${GRIPPER_SHORTCUT}`,
    sensing_claw_object_detected: "True when there is a cube or the referee's colour card in (or just in front of) the claw.",
  },
  // (the cubes of Fire Fighter; its lines are black on white, as in Fire Rescue: the line text stays the catalog's)
  'fire-fighter': {
    gripper_claw: `Opens or closes the claw and waits until it has finished. Closing on a cube grabs it. ${GRIPPER_SHORTCUT}`,
    sensing_claw_object_detected: 'True when there is a cube in (or just in front of) the claw.',
  },
};

/** The hover text a block has in a game, when that game has its own (otherwise undefined: the catalog's text). */
export function paletteTooltip(type: string, gameId: string | undefined): string | undefined {
  return PALETTE_TOOLTIPS[paletteOf(gameId)]?.[type];
}

export const PALETTE_IDS: PaletteId[] = Object.keys(PALETTES) as PaletteId[];

export function isPaletteId(id: unknown): id is PaletteId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PALETTES, id);
}

/**
 * Games that are another version of a game above: the same robot on the same field, with the
 * same blocks - only what the referee draws before a match is different. Such a game shows the
 * palette and the hover texts of that game, and a program saved in one opens in the other as a
 * program of the same game (../ui/program-file.ts: programGameOf).
 *
 *   fire-rescue-junior   Fire Rescue Junior (ages 10-12): the Fire Rescue game, but only the
 *                        buckets are drawn (../fire-rescue-junior). Fire Rescue Senior is the
 *                        game 'fire-rescue' itself.
 */
export const GAME_VERSIONS: Readonly<Record<string, PaletteId>> = {
  'fire-rescue-junior': 'fire-rescue',
};

/** The game a version is a version of (GAME_VERSIONS), or undefined for any other id. */
export function versionOf(gameId: string | undefined): PaletteId | undefined {
  return typeof gameId === 'string' && Object.prototype.hasOwnProperty.call(GAME_VERSIONS, gameId) ? GAME_VERSIONS[gameId] : undefined;
}

/**
 * The palette of a game (give Game.id). Another version of a game (GAME_VERSIONS) gets the
 * palette of that game; a game without a palette of its own gets the default one.
 */
export function paletteOf(gameId: string | undefined): PaletteId {
  if (isPaletteId(gameId)) return gameId;
  return versionOf(gameId) ?? DEFAULT_PALETTE;
}

/** The ids of the categories a game's palette shows, in order (a fresh list: change it as you like). */
export function paletteCategories(gameId?: string): CategoryId[] {
  return [...PALETTES[paletteOf(gameId)]];
}
