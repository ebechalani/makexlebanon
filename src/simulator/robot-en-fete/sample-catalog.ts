/**
 * The list of example programs of the Robot en fête 2027 simulator (the Warehouse Sort mission in
 * French, a category of its own): for each one its id, its title and its level - and the headings
 * of the three levels. Every text here is French: the page shows them as they are.
 *
 *   fete-leave-start    starter       Sortir de la zone de départ et s’arrêter
 *   fete-white-line     starter       Suivre la ligne blanche jusqu’au T
 *   fete-cube-colour    starter       Lire la couleur d’un cube
 *   fete-one-cube       intermediate  Mettre un cube dans sa baie
 *   fete-two-cubes      intermediate  Deux cubes, puis se garer
 *   fete-all-cubes      advanced      Trier les cubes et se garer
 *
 * They are the six examples of Warehouse Sort, in the same order and at the same levels, with their
 * texts in French (./samples.ts). Every id starts with "fete-": the ids of the examples must be
 * different across all games, Warehouse Sort included - the owner's lists in
 * content/simulator-codes.ts name an example by its id alone, so a line there decides about one
 * page only. The ids do not change when a title does.
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
 *  "robot-en-fete" (see ../members/all-examples.ts and ../members/unlock.ts). Only
 *  ../members/all-examples.ts and ./samples.ts import this list; the guard test of the server
 *  (../members/client-guard.test.ts) fails when anything else does.
 * =====================================================================================
 *
 * To change the title or the level of an example, or the heading of a level, change it here:
 * ./samples.ts takes them from this file. French typography: ’ in a word, never '.
 *
 * Plain TypeScript, no DOM, no Blockly, and no import of any other file.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** The id, the title and the level of an example: what a card of the Examples window shows before it is opened. */
export interface ExampleCard {
  /** stable name, used by the server and by the tests; starts with "fete-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'fete-leave-start', title: 'Sortir de la zone de départ et s’arrêter', level: 'starter' },
  { id: 'fete-white-line', title: 'Suivre la ligne blanche jusqu’au T', level: 'starter' },
  { id: 'fete-cube-colour', title: 'Lire la couleur d’un cube', level: 'starter' },
  { id: 'fete-one-cube', title: 'Mettre un cube dans sa baie', level: 'intermediate' },
  { id: 'fete-two-cubes', title: 'Deux cubes, puis se garer', level: 'intermediate' },
  { id: 'fete-all-cubes', title: 'Trier les cubes et se garer', level: 'advanced' },
];

/** The id, title and level of one example. Throws for an id that is not on the list. */
export function exampleCard(id: string): ExampleCard {
  const card = SAMPLE_CATALOG.find((entry) => entry.id === id);
  if (!card) throw new Error(`"${id}" is not on the list of examples (robot-en-fete/sample-catalog.ts).`);
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
 * "Avancé" heading either. (Short words: this is the beginners' mission.)
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Premiers pas', about: 'une chose à la fois' },
  { id: 'intermediate', title: 'Intermédiaire', about: 'des cubes dans la bonne baie' },
  { id: 'advanced', title: 'Avancé', about: 'tous les cubes, toutes les dispositions' },
];
