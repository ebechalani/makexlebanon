/**
 * The list of example programs of the Locker Room simulator (MakeX Lebanon, Season 2026, Capelli
 * Starter, ages 13-15): for each one its id, its title and its level - and the headings of the
 * three levels.
 *
 *   locker-to-station      starter       Drive to the Scan Station
 *   locker-follow-line     starter       Follow the bottom line
 *   locker-read-card       starter       Read the colour card
 *   locker-team-cube       intermediate  Deliver the team cube
 *   locker-two-tokens      intermediate  Sort two tokens
 *   locker-whole-mission   advanced      The whole Locker Room mission
 *
 * Every id starts with "locker-": the ids of the examples must be different across all games
 * (the other lists are ../fire-rescue/sample-catalog.ts, ../fire-chief/sample-catalog.ts and
 * ../warehouse-sort/sample-catalog.ts). The ids do not change when a title does: the lists of
 * content/simulator-codes.ts name the examples by id.
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other three games: not every visitor may know that
 *  every example exists, so the simulator screen holds no list of examples at all - not a
 *  title, not even the heading of a level. It asks the server, which answers with the cards and
 *  the headings this visitor may see. Nothing that runs in the browser (src/simulator/ui,
 *  anything with 'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  The server hands them out through /api/simulator/unlock, to a request that names the game
 *  "locker-room" (see ../members/all-examples.ts and ../members/unlock.ts). Only
 *  ../members/all-examples.ts and ./samples.ts may import this list.
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
  /** stable name, used by the server and by the tests; starts with "locker-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'locker-to-station', title: 'Drive to the Scan Station', level: 'starter' },
  { id: 'locker-follow-line', title: 'Follow the bottom line', level: 'starter' },
  { id: 'locker-read-card', title: 'Read the colour card', level: 'starter' },
  { id: 'locker-team-cube', title: 'Deliver the team cube', level: 'intermediate' },
  { id: 'locker-two-tokens', title: 'Sort two tokens', level: 'intermediate' },
  { id: 'locker-whole-mission', title: 'The whole Locker Room mission', level: 'advanced' },
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
 * "Advanced" heading either. (Short words: many students read English as a second language.)
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'drive, follow a line, read a card' },
  { id: 'intermediate', title: 'Intermediate', about: 'the team cube, then the tokens' },
  { id: 'advanced', title: 'Advanced', about: 'all the steps, any cards' },
];
