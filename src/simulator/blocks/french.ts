/**
 * Where the code of the blocks finds the French words of the blocks (./fr.ts) - without importing
 * them.
 *
 * ./register.ts, ./toolbox.ts, ./stack-size.ts and ./locale.ts are on every page that has blocks,
 * English or French. If they imported ./fr.ts, every English page would download the French of
 * all the blocks (about 37 kB of source) and never use it. So they ask this file, and only on
 * their French paths (a French workspace, a palette or a size in 'fr'): an English page never
 * calls frenchWords().
 *
 * ./fr.ts hands its words in itself, when it is loaded (setFrenchBlockWords at its end): whatever
 * imports the French words - the French screen (../ui/text/fr.tsx), the French examples
 * (../robot-en-fete/samples.ts), a test - has made them available here. A French path that runs
 * where nothing loaded them is a mistake, and says so.
 *
 * (Only a type is imported from ./fr.ts: it is gone once the code is compiled.)
 */
import type * as FrenchBlockWordsModule from './fr';

/** The French words the code of the blocks reads (./fr.ts). */
export type FrenchBlockWords = Pick<
  typeof FrenchBlockWordsModule,
  'FR_BLOCKS' | 'FR_BLOCKLY_MSG' | 'FR_CATEGORY_NAMES' | 'FR_DEFAULT_TEXTS' | 'FR_PALETTE_TOOLTIPS' | 'FR_TEXT_BUBBLE_TOOLTIP' | 'FR_TOOLBOX'
>;

let words: FrenchBlockWords | null = null;

/** Called by ./fr.ts when it is loaded. */
export function setFrenchBlockWords(next: FrenchBlockWords): void {
  words = next;
}

/** The French words of the blocks. Only a French path asks for them; it fails loudly where they were never loaded. */
export function frenchWords(): FrenchBlockWords {
  if (words === null) throw new Error('The French words of the blocks are not loaded: import ./blocks/fr.ts (the French page does, through its word table).');
  return words;
}
