/**
 * The list of example programs of the Fire Chief simulator (the maze game): for each one its id,
 * its title and its level - and the headings of the three levels.
 *
 *   chief-first-wall     starter       Stop in front of the first wall
 *   chief-count-lines    starter       Count grid lines to drive two cells
 *   chief-flame-fan      starter       A first look at the flame sensor and the fan
 *   chief-wall-follow    intermediate  Follow the right-hand wall to a room
 *   chief-face-flame     intermediate  Find the flame and turn to face it
 *   chief-full-mission   advanced      The whole mission on any maze
 *
 * Every id starts with "chief-": the ids of the examples must be different across all games
 * (the other list is ../fire-rescue/sample-catalog.ts).
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of Fire Rescue: not every visitor may know that every
 *  example exists, so the simulator screen holds no list of examples at all - not a title, not
 *  even the heading of a level. It asks the server, which answers with the cards and the
 *  headings this visitor may see. Nothing that runs in the browser (src/simulator/ui, anything
 *  with 'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  These examples are not handed out by the server yet: that comes with the screen of this
 *  game. Until then ./samples.test.ts checks that no other file imports the two files or holds
 *  one of the titles below. The guard test of the server (../members/client-guard.test.ts)
 *  already treats ./samples.ts as a file that must stay on the server, because it imports the
 *  program builder; ./samples.ts and these titles still have to be written into its lists.
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
  /** stable name, used by the server and by the tests; starts with "chief-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'chief-first-wall', title: 'Stop in front of the first wall', level: 'starter' },
  { id: 'chief-count-lines', title: 'Count grid lines to drive two cells', level: 'starter' },
  { id: 'chief-flame-fan', title: 'A first look at the flame sensor and the fan', level: 'starter' },
  { id: 'chief-wall-follow', title: 'Follow the right-hand wall to a room', level: 'intermediate' },
  { id: 'chief-face-flame', title: 'Find the flame and turn to face it', level: 'intermediate' },
  { id: 'chief-full-mission', title: 'The whole mission on any maze', level: 'advanced' },
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
 * "Advanced" heading either.
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'one sensor at a time' },
  { id: 'intermediate', title: 'Intermediate', about: 'through the maze to a room' },
  { id: 'advanced', title: 'Advanced', about: 'explore, find the fire and blow it out' },
];
