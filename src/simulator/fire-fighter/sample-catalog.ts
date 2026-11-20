/**
 * The list of example programs of the Fire Fighter simulator (MakeX Lebanon, Season 2027, the mBot2
 * category for ages 8-10): for each one its id, its title and its level - and the headings of the
 * three levels.
 *
 *   fighter-first-grab      starter       First grab: the yellow cube
 *   fighter-line-to-t       starter       Line follower to the T
 *   fighter-yellow-x        starter       Yellow cube under the X tower
 *   fighter-left-bay        intermediate  Two red cubes: park and school
 *   fighter-right-bay       intermediate  Two red cubes: bakery and hospital
 *   fighter-whole-mission   advanced      The whole Fire Fighter mission
 *
 * Every id starts with "fighter-": the ids of the examples must be different across all games
 * (the other lists are ../fire-rescue/sample-catalog.ts, ../fire-chief/sample-catalog.ts,
 * ../warehouse-sort/sample-catalog.ts, ../locker-room/sample-catalog.ts and
 * ../fire-cadet/sample-catalog.ts). The ids do not change when a title does: the lists of
 * content/simulator-codes.ts name the examples by id.
 *
 * No title says "straight": the straight way from the yellow square leads into the BACK of tower X,
 * and a cube that goes in from the back does not count (tower X opens to the top - the organiser's
 * answer). And no title is a phrase of the screen (../members/client-guard.test.ts looks for the
 * titles in everything a browser gets): the screen says "tower X", the title "the X tower".
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other games: not every visitor may know that every
 *  example exists, so the simulator screen holds no list of examples at all - not a title, not
 *  even the heading of a level. It asks the server, which answers with the cards and the headings
 *  this visitor may see. Nothing that runs in the browser (src/simulator/ui, anything with
 *  'use client', a page of the website) may import this file or ./samples.ts.
 *
 *  The server hands them out through /api/simulator/unlock, to a request that names the game
 *  "fire-fighter" (see ../members/all-examples.ts and ../members/unlock.ts). Only
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
  /** stable name, used by the server and by the tests; starts with "fighter-" */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'fighter-first-grab', title: 'First grab: the yellow cube', level: 'starter' },
  { id: 'fighter-line-to-t', title: 'Line follower to the T', level: 'starter' },
  { id: 'fighter-yellow-x', title: 'Yellow cube under the X tower', level: 'starter' },
  { id: 'fighter-left-bay', title: 'Two red cubes: park and school', level: 'intermediate' },
  { id: 'fighter-right-bay', title: 'Two red cubes: bakery and hospital', level: 'intermediate' },
  { id: 'fighter-whole-mission', title: 'The whole Fire Fighter mission', level: 'advanced' },
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
 * with a card of that level: a visitor who may not see the advanced example does not get the
 * "Advanced" heading either. (Short words: the students are 8 to 10 years old.)
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'drive, grab, follow the line' },
  { id: 'intermediate', title: 'Intermediate', about: 'two red cubes, two towers' },
  { id: 'advanced', title: 'Advanced', about: 'all five letters, M A K E X' },
];
