/**
 * The list of example programs of the Logistique intelligente simulator (Robot en fête 2027: the
 * regular mission of MakeX Inspire 2024, "Smart Logistics", in French): for each one its id, its
 * title and its level - and the headings of the three levels. Every text here is French: the page
 * shows them as they are.
 *
 *   logi-ligne-croix     starter       Suivre la ligne jusqu’à la croix
 *   logi-cube-dessus     starter       Prendre le cube du dessus
 *   logi-un-cube-e8      starter       Un cube dans l’entrepôt E8
 *   logi-pile-e7         intermediate  Une pile entière dans l’entrepôt E7
 *   logi-empiler-e6      intermediate  Empiler deux cubes dans l’entrepôt E6
 *   logi-toute-mission   advanced      Toute la mission : 500 points
 *
 * Every id starts with "logi-": the ids of the examples must be different across all games - the
 * owner's lists in content/simulator-codes.ts name an example by its id alone, so a line there
 * decides about one page only. The ids do not change when a title does.
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of every other game: not every visitor may know that every
 *  example exists, so the simulator screen holds no list of examples at all - not a title, not
 *  even the heading of a level. It asks the server, which answers with the cards and the
 *  headings this visitor may see. Nothing that runs in the browser (src/simulator/ui, anything
 *  with 'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  The server hands them out through /api/simulator/unlock, to a request that names the game
 *  "logistique-intelligente" (see ../members/all-examples.ts and ../members/unlock.ts). Only
 *  ../members/all-examples.ts and ./samples.ts import this list; the guard test of the server
 *  (../members/client-guard.test.ts) fails when anything else does.
 * =====================================================================================
 *
 * To change the title or the level of an example, or the heading of a level, change it here:
 * ./samples.ts takes them from this file. French typography: ’ in a word, never '; a no-break
 * space (U+00A0) before ":".
 *
 * Plain TypeScript, no DOM, no Blockly, and no import of any other file.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** The id, the title and the level of an example: what a card of the Examples window shows before it is opened. */
export interface ExampleCard {
  /** stable name, used by the server and by the tests; starts with "logi-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'logi-ligne-croix', title: 'Suivre la ligne jusqu’à la croix', level: 'starter' },
  { id: 'logi-cube-dessus', title: 'Prendre le cube du dessus', level: 'starter' },
  { id: 'logi-un-cube-e8', title: 'Un cube dans l’entrepôt E8', level: 'starter' },
  { id: 'logi-pile-e7', title: 'Une pile entière dans l’entrepôt E7', level: 'intermediate' },
  { id: 'logi-empiler-e6', title: 'Empiler deux cubes dans l’entrepôt E6', level: 'intermediate' },
  { id: 'logi-toute-mission', title: 'Toute la mission : 500 points', level: 'advanced' },
];

/** The id, title and level of one example. Throws for an id that is not on the list. */
export function exampleCard(id: string): ExampleCard {
  const card = SAMPLE_CATALOG.find((entry) => entry.id === id);
  if (!card) throw new Error(`"${id}" is not on the list of examples (logistique-intelligente/sample-catalog.ts).`);
  return { id: card.id, title: card.title, level: card.level };
}

/** The heading over the cards of one level in the Examples window. */
export interface ExampleLevelHeading {
  id: ExampleLevel;
  /** the word on the coloured label: "Premiers pas" */
  title: string;
  /** the few words after it: what the examples of this level are about */
  about: string;
}

/**
 * The three levels, in the order of the Examples window. A heading is only to be sent together
 * with a card of that level: a visitor who may not see any advanced example does not get the
 * "Avancé" heading either.
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Premiers pas', about: 'avancer, prendre, poser' },
  { id: 'intermediate', title: 'Intermédiaire', about: 'des piles dans les entrepôts' },
  { id: 'advanced', title: 'Avancé', about: 'toute la mission' },
];
