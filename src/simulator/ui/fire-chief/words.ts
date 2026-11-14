/**
 * The words of Fire Chief on the simulator screen, where they differ from the words of the
 * first game (../screen-words.ts): Fire Chief plays an "attempt" (the word of its rules) with
 * four "achievements", in a maze, and its restart and its end follow other rules.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { PLAYABLE_MAZE_COUNT } from '../../fire-chief/scenario';
import type { ScreenWords } from '../screen-words';

/** How many mazes can be played, said so that it can be read: "more than 100 billion" (a billion is 1 000 000 000). */
const HUNDREDS_OF_BILLIONS = Math.floor(PLAYABLE_MAZE_COUNT / 100e9) * 100;

/** What the start zone of this game is called in the sentences about placing the robot. */
export const FIRE_CHIEF_START_ZONE = 'START cell';

export const FIRE_CHIEF_WORDS: Partial<ScreenWords> = {
  match: 'attempt',
  goal: 'achievement',
  goals: 'achievements',
  // (on the closed Score sheet: "0 / 100 points · 0 of 4 done" - "achievements" does not fit a phone that is 360 wide)
  goalsShort: 'done',
  zonesHint: 'Colour START and the two rooms. The room with the fire is orange.',
  finishedHint: 'Tell the referee "Finished": the robot stops and the attempt ends with the points earned so far',
  resetHint: 'Put the fire target and the robot back where they started, ready for a new start.',
  sheetNotesHeading: 'Notes of the referee',
  sheetNote: 'Every achievement is earned once, at the moment the referee sees it. A restart clears the points.',
  // (a line without points is a note of the referee here - a used restart costs no points of its own)
  cleanLine: 'Nothing to note',
  randomLabel: 'Random maze',
  randomHint: 'Draw a random maze and a random place for the fire',
  defaultLabel: 'Default maze',
  defaultHint: 'The default maze (Crossroads) with the fire in the corner of the living room',
  // a starting arrangement is a maze here: its walls and the place of the fire
  scenario: 'maze',
  scenarios: 'mazes',
  scenarioTitle: 'Maze',
  scenarioNote: `More than ${HUNDREDS_OF_BILLIONS} billion mazes have a way from START to both rooms. Changing the maze or the place of the fire puts the field back to the start.`,
  batchHint: 'Run your program on many mazes at once',
  batchIntro:
    'A good program finds the fire in every maze. Run your blocks on many mazes at once and see where they fail. ' +
    'Click a result to load that maze on the stage and watch what happens.',
};
