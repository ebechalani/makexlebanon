/**
 * The list of example programs of the Fire Rescue simulator: for each one its id, its title and
 * its level - and the headings of the three levels.
 *
 *   hello          starter       Hello, mBot2
 *   line-follow    starter       Follow the black line
 *   gripper-demo   starter       Gripper: grab, put down, lift
 *   one-bucket     intermediate  Deliver one bucket
 *   one-person     intermediate  Rescue one person
 *   smart-bucket   advanced      Smart bucket: any colour, any square
 *   full-mission   advanced      Full mission: 180 points on the default combination
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  Not every visitor may know that every example exists: the owner can keep examples for
 *  advanced codes only ("examplesForAdvancedCodesOnly" in content/simulator-codes.ts), and
 *  such an example must not show anywhere - not its title, not even the heading of its level -
 *  until the server has checked an advanced code. So the simulator screen holds no list of
 *  examples at all. It asks the server (/api/simulator/unlock, see ../members/unlock.ts),
 *  which answers with the cards and the headings this visitor may see.
 *
 *  A test (../members/client-guard.test.ts) fails when a file of the screen, or a page of the
 *  website, starts to import this file - or holds one of the titles below itself.
 * =====================================================================================
 *
 * To change the title or the level of an example, or the heading of a level, change it here:
 * ./samples.ts and the server take them from this file. The programs themselves and the texts
 * that explain how they work are in ./samples.ts.
 *
 * Plain TypeScript, no DOM, no Blockly, and no import of any other file.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** The id, the title and the level of an example: what a card of the Examples window shows before it is opened. */
export interface ExampleCard {
  /** stable name, used by the server, by content/simulator-codes.ts and by the tests */
  id: string;
  title: string;
  level: ExampleLevel;
}

/** Every example, in the order of the Examples window (which groups them by level). */
export const SAMPLE_CATALOG: readonly ExampleCard[] = [
  { id: 'hello', title: 'Hello, mBot2', level: 'starter' },
  { id: 'line-follow', title: 'Follow the black line', level: 'starter' },
  { id: 'gripper-demo', title: 'Gripper: grab, put down, lift', level: 'starter' },
  { id: 'one-bucket', title: 'Deliver one bucket', level: 'intermediate' },
  { id: 'one-person', title: 'Rescue one person', level: 'intermediate' },
  { id: 'smart-bucket', title: 'Smart bucket: any colour, any square', level: 'advanced' },
  { id: 'full-mission', title: 'Full mission: 180 points on the default combination', level: 'advanced' },
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
 * The three levels, in the order of the Examples window. The server sends a heading only
 * together with a card of that level: a visitor who may not see any advanced example does not
 * get the "Advanced" heading either.
 */
export const EXAMPLE_LEVELS: readonly ExampleLevelHeading[] = [
  { id: 'starter', title: 'Starter', about: 'first steps' },
  { id: 'intermediate', title: 'Intermediate', about: 'one mission from start to finish' },
  { id: 'advanced', title: 'Advanced', about: 'adapting to the combination, and the whole match' },
];
