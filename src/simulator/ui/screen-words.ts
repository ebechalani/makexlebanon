/**
 * The words of one game on the simulator screen.
 *
 * The screen (SimulatorApp.tsx and its parts) is the same for every game, but a few of its
 * sentences are only true for one of them: Fire Rescue plays a "match" with "missions", towers
 * and buckets; Fire Chief plays an "attempt" with "achievements" in a maze. Those sentences are
 * collected here. A game hands over the ones that differ (SimulatorAppProps.words); everything
 * it leaves out is said as Fire Rescue, the first game of the simulator, says it.
 *
 * What is NOT here: the lines of the score sheet, the referee's sentences and the names of the
 * zones. Those come from the game itself (Game.score, Game.createReferee, Game.overlays).
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */

export interface ScreenWords {
  /** what one scored run is called: "match" (Fire Rescue) or "attempt" (Fire Chief) */
  match: string;
  /** what a line of the score sheet that brings points is called: one of them ... */
  goal: string;
  /** ... and several */
  goals: string;
  /** what the "Zones" button colours on the mat */
  zonesHint: string;
  /** what the team's "Finished" call does */
  finishedHint: string;
  /** what "Reset field" puts back, without the last sentence about when it works */
  resetHint: string;
  /** the heading over the lines of the score sheet that bring no points */
  sheetNotesHeading: string;
  /** the last line of the score sheet: how to read it */
  sheetNote: string;
  /** the button of the Combination panel that draws a random combination, and what it does */
  randomLabel: string;
  randomHint: string;
  /** the button of the Combination panel that goes back to the default combination, and what that is */
  defaultLabel: string;
  defaultHint: string;
}

/** The screen's words when a game says nothing else: the words of Fire Rescue. */
export const DEFAULT_WORDS: ScreenWords = {
  match: 'match',
  goal: 'mission',
  goals: 'missions',
  zonesHint: 'Colour the zones of this combination: start, people, water squares, tower areas',
  finishedHint: 'Tell the referee "Finished": the robot stops and the field is scored as it is',
  resetHint: 'Put every tower, bucket and person back and the robot into the start zone, ready for a new start.',
  sheetNotesHeading: 'Penalties',
  sheetNote: 'The score is what the field is worth right now. It can never go below 0.',
  randomLabel: 'Random',
  randomHint: 'Draw a random combination, like the referee does',
  defaultLabel: 'Default',
  defaultHint: 'The combination drawn in the rule book',
};

/** The words of a game: its own where it gave them, the default ones everywhere else. */
export function screenWords(own?: Partial<ScreenWords>): ScreenWords {
  return own ? { ...DEFAULT_WORDS, ...own } : DEFAULT_WORDS;
}

/** "match" -> "Match": a word at the beginning of a sentence. */
export function capital(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}
