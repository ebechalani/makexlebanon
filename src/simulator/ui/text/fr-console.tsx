/**
 * The sentences of the engine and of the interpreter (../../core, ../../vm) in French, for the
 * console of the French screen (ScreenText.consoleLine, design 2.3 rule 6 and D4).
 *
 * Core and VM are not touched: they speak English, and their sentences are turned into French
 * where the screen shows them - one pattern per sentence, from a CLOSED list, the values put
 * back. An id in a sentence is named as the screen names it ("(cube:W1)" -> "(le cube E1)"), a
 * number with a decimal comma. A line that is in no pattern (the referee's own sentences, which
 * the French game writes in French; anything new) stays as it is.
 *
 * ./text.test.ts reads every sentence the engine and the interpreter can log and checks that
 * each one has its pattern here - or is in FR_CONSOLE_NOT_ON_THIS_PAGE, with the reason.
 */
import { frBodyName, NB, withComma } from './fr-common';

/** How the empty slot of a block counts (vm/index.ts emptySlot), in French: "false (faux)", "un texte vide", or the number. */
function slotValue(counts: string): string {
  if (counts === 'false') return 'false (faux)';
  if (counts === 'empty text') return 'un texte vide';
  return withComma(counts);
}

/** One English sentence of core / vm and its French. */
interface ConsolePattern {
  english: RegExp;
  french: (...values: string[]) => string;
}

/** Every sentence of core and vm that the French page can show, in the order of their files. */
export const FR_CONSOLE_PATTERNS: readonly ConsolePattern[] = [
  // ---- core/engine.ts
  {
    english: /^The robot is not completely inside the start zone at its start position\.$/,
    french: () => 'À sa position de départ, le robot n’est pas tout entier dans la zone de départ.',
  },
  {
    english: /^The program stopped: ([^]*)$/,
    french: (message) => `Le programme s’est arrêté${NB}: ${message}`,
  },
  {
    english: /^The robot stands on a game element \((.+)\) at its start position\. At the start it is moved off it\.$/,
    french: (id) => `À sa position de départ, le robot est sur un élément du jeu (${frBodyName(id)}). Au départ, il en est sorti.`,
  },
  // ---- vm/handlers.ts
  {
    english: /^Servo (\S+) did not reach its angle after (\S+) seconds; the program carries on\.$/,
    french: (port, seconds) => `Le servo ${port} n’a pas atteint son angle après ${withComma(seconds)} secondes${NB}; le programme continue.`,
  },
  {
    english: /^This robot has no colour sensor that looks forward, so this block sees no colour\.$/,
    french: () => `Ce robot n’a pas de capteur de couleur qui regarde devant lui${NB}: ce bloc ne voit aucune couleur.`,
  },
  {
    english: /^Unknown maths function "([^]*)"\.$/,
    french: (name) => `Fonction mathématique inconnue «${NB}${name}${NB}».`,
  },
  // ---- vm/index.ts
  {
    english: /^The simulator hit a problem while running this block \(([^]*)\)\. This script was stopped\.$/,
    french: (reason) => `Le simulateur a eu un problème en exécutant ce bloc (${reason}). Ce script a été arrêté.`,
  },
  {
    english: /^This hat block listens to an unknown button "([^]*)"\.$/,
    french: (button) => `Ce bloc chapeau attend un bouton inconnu «${NB}${button}${NB}».`,
  },
  {
    // (the English name of the slot - CONDITION, VALUE - is left out: design 6.3)
    english: /^This block has an empty slot \([^]*\)\. It counts as ([^]*) - drop a block into it\.$/,
    french: (counts) => `Ce bloc a une case vide. Elle compte comme ${slotValue(counts)}${NB}: mets-y un bloc.`,
  },
  {
    english: /^The simulator does not know the block "([^]*)"\. It counts as 0\.$/,
    french: (type) => `Le simulateur ne connaît pas le bloc «${NB}${type}${NB}». Il compte comme 0.`,
  },
  {
    english: /^The simulator does not know the block "([^]*)"\. It was skipped\.$/,
    french: (type) => `Le simulateur ne connaît pas le bloc «${NB}${type}${NB}». Il a été sauté.`,
  },
  {
    english: /^There is no definition for the block "([^]*)"\. It was skipped\.$/,
    french: (name) => `Il n’y a pas de définition pour le bloc «${NB}${name}${NB}». Il a été sauté.`,
  },
  {
    english: /^The block "([^]*)" keeps calling itself \(more than (\d+) levels deep\)\. This script was stopped\.$/,
    french: (name, depth) => `Le bloc «${NB}${name}${NB}» s’appelle lui-même sans arrêt (plus de ${depth} niveaux). Ce script a été arrêté.`,
  },
  {
    english: /^A "return" block only works inside the definition of a my-block\.$/,
    french: () => `Un bloc «${NB}retourner${NB}» ne marche que dans un bloc «${NB}définir${NB}» de «${NB}Mes blocs${NB}».`,
  },
];

/**
 * The sentences of core and vm that the French page never shows, and why: they stay English
 * (as every line that is in no pattern does). The design's table has no French for them.
 */
export const FR_CONSOLE_NOT_ON_THIS_PAGE: readonly { english: RegExp; reason: string }[] = [
  { english: /^No restart: this game does not allow restarts\.$/, reason: 'this game allows restarts' },
  { english: /^No restart left: this game allows \d+ restarts? per attempt\.$/, reason: 'this game sets no limit on restarts' },
  { english: /^The robot stands [\d.]+ mm inside a wall \([^]*\) at its start position\. At the start it is moved out of that wall\.$/, reason: 'this mat has no walls' },
  { english: /^This robot has no gripper fitted, so this block does nothing\.$/, reason: 'this robot has a gripper' },
  { english: /^This robot has no claw, so this block finds nothing there\. The colour sensor of this robot looks forward and has its own blocks\.$/, reason: 'this robot has a claw' },
  { english: /^This robot has one colour sensor: its number is 1\. With any other number this block sees no colour\.$/, reason: "Fire Chief's robot only" },
];

/** A sentence of core or vm as the French console shows it; a sentence in no pattern stays as it is. */
export function frConsoleLine(text: string): string {
  for (const pattern of FR_CONSOLE_PATTERNS) {
    const match = pattern.english.exec(text);
    if (match) return pattern.french(...match.slice(1));
  }
  return text;
}
