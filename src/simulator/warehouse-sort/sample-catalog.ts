/**
 * The list of example programs of the Warehouse Sort simulator (MakeX Lebanon, Inspire, the
 * beginner mission): for each one its id, its title and its level - and the headings of the
 * three levels.
 *
 *   sort-leave-start    starter       Leave the start zone and stop
 *   sort-white-line     starter       Follow the white line to a T
 *   sort-cube-colour    starter       Read the colour of a cube
 *   sort-one-cube       intermediate  Put one cube in its bay
 *   sort-two-cubes      intermediate  Two cubes, then park
 *   sort-all-cubes      advanced      Sort all four cubes and park
 *
 * Every id starts with "sort-": the ids of the examples must be different across all games
 * (the other lists are ../fire-rescue/sample-catalog.ts and ../fire-chief/sample-catalog.ts).
 * The ids do not change when a title does: the lists of content/simulator-codes.ts name the
 * examples by id.
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other two games: not every visitor may know that
 *  every example exists, so the simulator screen holds no list of examples at all - not a
 *  title, not even the heading of a level. It asks the server, which answers with the cards and
 *  the headings this visitor may see. Nothing that runs in the browser (src/simulator/ui,
 *  anything with 'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  The server hands them out through /api/simulator/unlock, to a request that names the game
 *  "warehouse-sort" (see ../members/all-examples.ts and ../members/unlock.ts). Only
 *  ../members/all-examples.ts and ./samples.ts import this list; the guard test of the server
 *  (../members/client-guard.test.ts) fails when anything else does.
 * =====================================================================================
 *
 * To change the title or the level of an example, or the heading of a level, change it here:
 * ./samples.ts takes them from this file. The programs themselves and the texts that explain
 * how they work are in ./samples.ts.
 *
 * Plain TypeScript, no DOM, no Blockly, and no import of any other file.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** The id, the title and the level of an example: what a card of the Examples window shows before it is opened. */
export interface ExampleCard {
  /** stable name, used by the server and by the tests; starts with "sort-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'sort-leave-start', title: 'Leave the start zone and stop', level: 'starter' },
  { id: 'sort-white-line', title: 'Follow the white line to a T', level: 'starter' },
  { id: 'sort-cube-colour', title: 'Read the colour of a cube', level: 'starter' },
  { id: 'sort-one-cube', title: 'Put one cube in its bay', level: 'intermediate' },
  { id: 'sort-two-cubes', title: 'Two cubes, then park', level: 'intermediate' },
  { id: 'sort-all-cubes', title: 'Sort all four cubes and park', level: 'advanced' },
];

/** The id, title and level of one example. Throws for an id that is not on the list. */
export function exampleCard(id: string): ExampleCard {
  const card = SAMPLE_CATALOG.find((entry) => entry.id === id);
  if (!card) throw new Error(`"${id}" is not on the list of examples (sample-catalog.ts).`);
  return { id: card.id, title: card.title, level: card.level };
}

/** The heading over the cards of one level in the Examples window. */
export interface ExampleLevelHeading {
  id: ExampleLevel;
  /** the word on the coloured label: "Starter" */
  title: string;
  /** the few words after it: what the examples of this level are about */
  about: string;
}

/**
 * The three levels, in the order of the Examples window. A heading is only to be sent together
 * with a card of that level: a visitor who may not see any advanced example does not get the
 * "Advanced" heading either. (Short words: this is the beginner category.)
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'one skill at a time' },
  { id: 'intermediate', title: 'Intermediate', about: 'cubes into the right bay' },
  { id: 'advanced', title: 'Advanced', about: 'every cube, any arrangement' },
];
