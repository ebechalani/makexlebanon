/**
 * The words of Fire Chief on the simulator screen, where they differ from the words of the
 * first game (../screen-words.ts): Fire Chief plays an "attempt" (the word of its rules) with
 * four "achievements", in a maze, and its restart and its end follow other rules.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { ScreenWords } from '../screen-words';

/** What the start zone of this game is called in the sentences about placing the robot. */
export const FIRE_CHIEF_START_ZONE = 'START cell';

export const FIRE_CHIEF_WORDS: Partial<ScreenWords> = {
  match: 'attempt',
  goal: 'achievement',
  goals: 'achievements',
  zonesHint: 'Colour START and the two rooms. The room with the fire is orange.',
  finishedHint: 'Tell the referee "Finished": the robot stops and the attempt ends with the points earned so far',
  resetHint: 'Put the fire target and the robot back where they started, ready for a new start.',
  sheetNotesHeading: 'Notes of the referee',
  sheetNote: 'Every achievement is earned once, at the moment the referee sees it. A restart clears the points.',
  randomLabel: 'Random maze',
  randomHint: 'Draw a random maze and a random place for the fire',
  defaultLabel: 'Default',
  defaultHint: 'The default maze (Crossroads) with the fire in the corner of the living room',
};
