/**
 * The list of example programs of the Fire Rescue simulator: for each one its id, its title and
 * its level - and NOTHING else.
 *
 *   hello          starter       Hello, mBot2
 *   line-follow    starter       Follow the black line
 *   gripper-demo   starter       Gripper: grab, put down, lift
 *   one-bucket     intermediate  Deliver one bucket
 *   one-person     intermediate  Rescue one person
 *   smart-bucket   advanced      Smart bucket: any colour, any square
 *   full-mission   advanced      Full mission: 180 points on the default combination
 *
 * This is the one thing about the examples that every visitor's browser downloads: enough for
 * the Examples window to show that these programs exist ("Members only"). The programs
 * themselves and the texts that explain how they work are in ./samples.ts, which stays on the
 * website's server; a browser gets them only from /api/simulator/unlock, after the server has
 * checked a member code (see ../members/unlock.ts).
 *
 * =====================================================================================
 *  KEEP THIS FILE TO ID, TITLE AND LEVEL.
 *  No description, no program, no hint at how a solution works, and no import of any other
 *  file: whatever is written here can be read by everybody. A test
 *  (../members/client-guard.test.ts) fails when this file grows another field or an import.
 * =====================================================================================
 *
 * To change the title or the level of an example, change it here: ./samples.ts takes them from
 * this list, so the locked card and the unlocked card can never disagree.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */

export type ExampleLevel = 'starter' | 'intermediate' | 'advanced';

/** What everybody may know about an example. */
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
