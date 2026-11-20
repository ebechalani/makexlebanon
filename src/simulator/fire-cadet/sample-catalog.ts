/**
 * The list of example rows of the Fire Cadet simulator (MakeX Lebanon, Season 2027, "Fire Cadet -
 * Rescue City", ages 4-7, the Makeblock mTiny): for each one its id, its title and its level - and
 * the headings of the three levels.
 *
 *   cadet-three-forward     starter       Three cards for the cat         (practice map 1)
 *   cadet-there-and-back    starter       There and back again            (practice map 1)
 *   cadet-turn-around       starter       Turn around with the toolbox    (practice map 3)
 *   cadet-two-rescues       intermediate  Two rescues and home            (practice map 1)
 *   cadet-round-the-sign    intermediate  Round the closed road           (practice map 5)
 *   cadet-all-four          advanced      All four rescues                (practice map 1)
 *
 * Every id starts with "cadet-": the ids of the examples must be different across all games (the
 * other lists are ../fire-rescue/sample-catalog.ts, ../fire-chief/sample-catalog.ts,
 * ../warehouse-sort/sample-catalog.ts and ../locker-room/sample-catalog.ts). The ids do not change
 * when a title does: the lists of content/simulator-codes.ts name the examples by id.
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other four games: not every visitor may know that
 *  every example exists, so the simulator screen holds no list of examples at all - not a
 *  title, not even the heading of a level. It asks the server, which answers with the cards and
 *  the headings this visitor may see. Nothing that runs in the browser (src/simulator/ui,
 *  anything with 'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  The server hands them out through /api/simulator/unlock, to a request that names the game
 *  "fire-cadet" (see ../members/all-examples.ts and ../members/unlock.ts). Only
 *  ../members/all-examples.ts and ./samples.ts may import this list.
 * =====================================================================================
 *
 * To change the title or the level of an example, or the heading of a level, change it here:
 * ./samples.ts takes them from this file. The rows of cards themselves and the texts that explain
 * them are in ./samples.ts.
 *
 * Plain TypeScript, no DOM, and no import of any other file.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** The id, the title and the level of an example: what a card of the Examples window shows before it is opened. */
export interface ExampleCard {
  /** stable name, used by the server and by the tests; starts with "cadet-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'cadet-three-forward', title: 'Three cards for the cat', level: 'starter' },
  { id: 'cadet-there-and-back', title: 'There and back again', level: 'starter' },
  { id: 'cadet-turn-around', title: 'Turn around with the toolbox', level: 'starter' },
  { id: 'cadet-two-rescues', title: 'Two rescues and home', level: 'intermediate' },
  { id: 'cadet-round-the-sign', title: 'Round the closed road', level: 'intermediate' },
  { id: 'cadet-all-four', title: 'All four rescues', level: 'advanced' },
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
 * "Advanced" heading either. (Few, short words: the teachers of children of 4 to 7 read them,
 * many in English as a second language. They differ from the words of the other four games.)
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'a few cards, one rescue' },
  { id: 'intermediate', title: 'Intermediate', about: 'two rescues, or a way round a sign' },
  { id: 'advanced', title: 'Advanced', about: 'every rescue on one map' },
];
