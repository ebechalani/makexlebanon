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
  /**
   * The last word of the few words on the closed Score sheet: "0 / 100 points · 0 of 4 ...".
   * Left out: `goals` ("3 of 9 missions"). A game whose word for a goal is long gives a short
   * one here - the closed panel is narrow on a phone, and a longer text is cut off there.
   */
  goalsShort?: string;
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
  /**
   * In the results of "Test on many combinations": what a line of the sheet that brings no points
   * is called while nothing is wrong with it. The name of the line follows: "No penalty: restarts".
   */
  cleanLine: string;
  /** the button of the Combination panel that draws a random combination, and what it does */
  randomLabel: string;
  randomHint: string;
  /** the button of the Combination panel that goes back to the default combination, and what that is */
  defaultLabel: string;
  defaultHint: string;
  /**
   * What one starting arrangement of the field is called - one of them, several of them, and as
   * the heading of the panel that sets it: "combination" (Fire Rescue), "maze" (Fire Chief).
   * The screen uses these words wherever it speaks about the arrangement: the code and its
   * field, the console line of a start, "Test on many ..." and its window.
   */
  scenario: string;
  scenarios: string;
  scenarioTitle: string;
  /**
   * The last line of that panel. Left out: the screen says how many combinations the game has
   * and that changing one puts the field back to the start.
   */
  scenarioNote?: string;
  /** "Test on many ...": what its button in the title row says when the pointer rests on it ... */
  batchHint: string;
  /** ... and the first lines of its window */
  batchIntro: string;
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
  cleanLine: 'No penalty',
  randomLabel: 'Random',
  randomHint: 'Draw a random combination, like the referee does',
  defaultLabel: 'Default',
  defaultHint: 'The combination drawn in the rule book',
  scenario: 'combination',
  scenarios: 'combinations',
  scenarioTitle: 'Combination',
  batchHint: 'Run your program on many starting combinations at once',
  batchIntro:
    'A good program works whatever the referee draws. Run your blocks on many starting combinations at once and see where they fail. ' +
    'Click a result to load that combination on the stage and watch what happens.',
};

/** The words of a game: its own where it gave them, the default ones everywhere else. */
export function screenWords(own?: Partial<ScreenWords>): ScreenWords {
  return own ? { ...DEFAULT_WORDS, ...own } : DEFAULT_WORDS;
}

/**
 * The few words on the closed Score sheet: "30 / 180 points · 3 of 9 missions" (Fire Rescue),
 * "30 / 100 points · 2 of 4 done" (Fire Chief: see ScreenWords.goalsShort).
 */
export function scoreSheetSummary(score: { total: number; max: number }, done: number, of: number, words: ScreenWords): string {
  return `${score.total} / ${score.max} points · ${done} of ${of} ${words.goalsShort ?? words.goals}`;
}

/** "match" -> "Match": a word at the beginning of a sentence. */
export function capital(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}
