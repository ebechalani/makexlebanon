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
import type { CategoryId } from './catalog';

/** The games that have a palette: the same words as Game.id. */
export type PaletteId = 'fire-rescue' | 'fire-chief';

/** The palette an editor gets when no game is named (and for a game that has no palette of its own). */
export const DEFAULT_PALETTE: PaletteId = 'fire-rescue';

/** What every game has: the CyberPi, the Scratch basics and the two drive motors. */
const COMMON: CategoryId[] = ['cyberpi', 'sensing', 'events', 'control', 'operators', 'variables', 'myblocks', 'chassis'];

/** The categories of each game's palette, in the order they are shown (mBlock order). */
export const PALETTES: Record<PaletteId, readonly CategoryId[]> = {
  'fire-rescue': [...COMMON, 'servo', 'gripper', 'quadrgb', 'ultrasonic', 'colorsensor'],
  'fire-chief': [...COMMON, 'extensionport', 'quadrgb', 'ultrasonic', 'frontcolorsensor'],
};

export const PALETTE_IDS: PaletteId[] = Object.keys(PALETTES) as PaletteId[];

export function isPaletteId(id: unknown): id is PaletteId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PALETTES, id);
}

/** The palette of a game (give Game.id). A game without a palette of its own gets the default one. */
export function paletteOf(gameId: string | undefined): PaletteId {
  return isPaletteId(gameId) ? gameId : DEFAULT_PALETTE;
}

/** The ids of the categories a game's palette shows, in order (a fresh list: change it as you like). */
export function paletteCategories(gameId?: string): CategoryId[] {
  return [...PALETTES[paletteOf(gameId)]];
}
