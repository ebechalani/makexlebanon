/**
 * Block texts that still have to be checked against the real mBlock 5.
 *
 * The blocks of the DC motor ports (M1 / M2) exist in mBlock, but when they were added to the
 * simulator nobody could read their English text letter for letter (the Makeblock help pages
 * could not be opened). What is written here is the most likely wording.
 * The two blocks of the colour sensor that looks forward (Fire Chief) are here as well; about
 * them even less is known, see below.
 * EVERY text of these blocks that a student reads comes from this one file, so that it can be
 * corrected in one place once somebody has looked at the blocks in mBlock 5 itself:
 *
 *   device mBot2  ->  category "mBot2 Extension Port"   (the DC motor blocks)
 *   "+ extension" ->  mBuild "Color Sensor"             (the colour sensor blocks, if that is the sensor)
 *
 * About the colour sensor nothing is certain: the organiser has said "a colour sensor that
 * looks forward", not which one, so nobody knows yet which blocks mBlock has for it. The
 * simulator takes it to be an mBuild module. The blocks of mBuild modules carry the number of
 * the module (1 = the first one of its kind in the chain), and the simulator words its two
 * blocks after that pattern. mBlock spells "color"; the simulator writes "colour", as in every
 * other text of its blocks.
 *
 * What IS certain (seen in two Makeblock manuals): the Python calls behind the DC motor blocks,
 *   mbot2.motor_set(power, port)      one port, power -100 .. 100, port "M1" / "M2"
 *   mbot2.motor_drive(power1, power2) both ports at once: power1 -> M1, power2 -> M2
 *   mbot2.motor_stop(port)            port "M1" / "M2" / "all"
 *
 * Two more DC motor blocks may exist in mBlock ("increases power by", "power (%)"). Nobody could
 * confirm them, so the simulator leaves them out: its palette shows only blocks mBlock has.
 *
 * `%1`, `%2` are the places of a menu or a value slot, as everywhere in the catalog.
 * Plain data: no import, no Blockly, no DOM.
 */

/** How sure we are of a text: 'likely' = seen described, not read letter for letter; 'guess' = the usual mBlock pattern. */
export type WordingConfidence = 'likely' | 'guess';

export interface UnconfirmedText {
  /** the text as the simulator shows it */
  text: string;
  confidence: WordingConfidence;
  /** what exactly is open */
  toCheck: string;
}

/** Names of the two palette categories. */
export const UNCONFIRMED_CATEGORY_NAMES = {
  extensionPort: {
    text: 'mBot2 Extension Port',
    confidence: 'likely',
    toCheck: 'The Makeblock help page of these blocks has this title; the name in the palette itself was not seen.',
  },
  colorSensor: {
    text: 'Colour Sensor',
    confidence: 'guess',
    toCheck:
      'Which colour sensor the robot has is not known. If it is the mBuild "Color Sensor": the name of the category that this extension adds to the palette (mBlock spells it "Color").',
  },
} as const satisfies Record<string, UnconfirmedText>;

/** The block texts, by the type id of the block in the catalog. */
export const UNCONFIRMED_BLOCK_TEXTS = {
  mbot2_dc_motor_power: {
    text: 'DC motor %1 rotates at power %2 %',
    confidence: 'likely',
    toCheck: 'The block exists (menu M1 / M2, power -100 to 100). Word order not read letter for letter.',
  },
  mbot2_dc_motor_drive: {
    text: 'DC motor M1 rotates at power %1 % , DC motor M2 rotates at power %2 %',
    confidence: 'guess',
    toCheck: 'A block that sets both ports at once exists (likely). Its text, and whether M1 / M2 are fixed words or menus, are open.',
  },
  mbot2_dc_motor_stop: {
    text: 'DC motor %1 stops rotating',
    confidence: 'guess',
    toCheck: 'The block exists, with a menu of ports. "stops rotating" or just "stops", and the menu entry "all", are open.',
  },
  sensing_colorsensor_color_is: {
    text: 'colour sensor %1 detects %2 ?',
    confidence: 'guess',
    toCheck:
      'A true / false block with a menu of colours is expected. The wording follows the usual mBuild pattern "<module> (1) ...?"; the exact words, and which colours the menu offers, are open.',
  },
  sensing_colorsensor_color: {
    text: 'colour sensor %1 colour',
    confidence: 'guess',
    toCheck: 'A block that gives the name of the colour is expected. Its exact words, and what it gives when no colour is seen, are open.',
  },
} as const satisfies Record<string, UnconfirmedText>;

/** The menu of the DC motor blocks that take one port. */
export const DC_MOTOR_MENU: string[] = ['M1', 'M2'];
/** The menu of the stop block: one port, or both ("all": likely, not confirmed). */
export const DC_MOTOR_STOP_MENU: string[] = ['M1', 'M2', 'all'];

/** Type ids of the blocks whose text is not confirmed. */
export const UNCONFIRMED_BLOCK_TYPES: string[] = Object.keys(UNCONFIRMED_BLOCK_TEXTS);
