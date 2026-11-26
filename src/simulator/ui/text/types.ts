/**
 * The word table of the shared simulator screen: one table per language (./en.tsx, ./fr.tsx).
 *
 * The screen (../SimulatorApp.tsx and its parts) is the same for every game and, since Robot en
 * fête 2027, for two languages. A shared part of the screen gets every text, number and time it
 * shows from this table - `const text = useScreenText();` (./context.tsx) - and from nowhere
 * else. The English page sets no table: the context gives the English one by default, and the
 * English page runs the very same code it always ran (EN_TEXT holds today's strings, moved, and
 * today's text functions themselves). Only the French page sets one: `<SimulatorApp locale="fr">`.
 *
 * How a member is written:
 *   - a text with no value in it is a string;
 *   - a sentence with values is a function;
 *   - a sentence the English builds from several JSX pieces is a function that returns those
 *     pieces (a ReactNode): the browser fits each text node on its own;
 *   - a text function of a plain module (../format.ts, ../program-file.ts ...) is a member of the
 *     same name and type: the English member IS that function, the French one is its twin.
 * A key the French table does not give does not compile.
 *
 * What is NOT here: the words of one game (../screen-words.ts ScreenWords, handed over by the
 * game's page), the referee's sentences (the game), the blocks (../../blocks), the examples and
 * the site's pages.
 *
 * Plain TypeScript (no DOM, no React at run time), so it can be read and tested under Node.
 */
import type { ReactNode } from 'react';
import type { cyberPiSummary, describeEvent, finishText, LogLevel, TimeText, bodyName } from '../format';
import type { finishHeadline, finishSentence, restartButton, restartSummary } from '../match-words';
import type { codeMessage, examplesIntro, EXAMPLES_WORDS } from '../examples-words';
import type { endSentence, scoreTimeText } from '../batch-words';
import type { otherGameNote, parseProgramFile, WithoutRetiredBlocks } from '../program-file';
import type { colourRangeNote, colourRangeText, dcMotorUse, sensorSummary, sensorsViewHint } from '../robot-parts';
import type { cmText, rulerLabels, rulerReading, rulerText, turnText } from '../ruler';
import type { codeReaderOf } from '../scenario-code';
import type { scoreSheetSummary } from '../screen-words';
import type { readyHint, sizeButtonHint } from '../stage-view';
import type { homeButtonWords } from '../start-pose';
import type { LineMark } from '../ScoreSheet';
import type { Speed } from '../useSimulation';
import type { Game, ProbeName, SensorColor } from '../../core/types';
import type { GripperText } from './gripper';

/** The language of a screen. */
export type Locale = 'en' | 'fr';

/** Every sentence of the Examples window that is not built with values (../examples-words.ts EXAMPLES_WORDS). */
export type ExamplesWords = { readonly [K in keyof typeof EXAMPLES_WORDS]: string };

// =============================================================================================
// Numbers and times
// =============================================================================================

export interface NumberText {
  /** the language of the table: the blocks of the workspace speak it too (../BlocklyEditor.tsx, ../GripperCodeDialog.tsx) */
  locale: Locale;
  /** a number for the dashboard: at most `digits` decimals, no "-0" - English formatNumber: "18.9", French "18,9" */
  number(value: number, digits?: number): string;
  /** the match clock, whole seconds: "1:23" (formatClock) */
  clock(seconds: number): string;
  /** a moment of the match, rounded: "1:23.4" / "1:23,4" (formatStamp) */
  moment(seconds: number): string;
  /** a time the referee wrote down, tenths cut off: "1:23.4" / "1:23,4" (formatRefereeTime) */
  refereeTime(seconds: number): string;
  /** how the screen writes the moments of a match in this game: `moment` or `refereeTime` (timeTextOf) */
  timeTextOf(game: Pick<Game, 'createReferee'>): TimeText;
  /** a share of the runs of a test: "50%" / "50 %" (../BatchDialog.tsx) */
  percent(share: number): string;
  /** the average score of a test, one decimal: "37.5" / "37,5" (../BatchDialog.tsx) */
  averageScore(value: number): string;
}

// =============================================================================================
// The title row (../TitleBar.tsx)
// =============================================================================================

export interface TitleText {
  /** the name of the path on the site, for a screen reader */
  breadcrumb: string;
  homeCrumb: string;
  simulatorCrumb: string;
  /** the heading before "· mBot2": English "<title> simulator " (the pieces as the English JSX has them) */
  simulatorTitle(title: string): ReactNode;
  /** before the name of the academy (its trailing blank included) */
  poweredBy: string;
}

// =============================================================================================
// The screen itself (../SimulatorApp.tsx)
// =============================================================================================

export interface AppText {
  /** where the robot must be before the start */
  notAllowed(startZoneName: string): string;
  /** ... and the same when it does not fit at the angle it has */
  notAllowedAtAngle(notAllowed: string): string;
  /** the status line while the robot is dragged where it may not start */
  placingProblem(notAllowed: string): string;
  /** a button was pressed before Blockly was ready (also in the test window) */
  editorStillLoading: string;
  /** Start with nothing under the yellow block: `canLoadExamples` says whether the Examples may be named */
  nothingToRun(canLoadExamples: boolean): string;
  /** the question before the blocks of the workspace are replaced with `what` */
  replaceConfirm(what: string): string;
  programNotShown: string;
  /** what replaces the blocks: New ... */
  newProgramWhat: string;
  /** ... an example ... */
  exampleWhat(title: string): string;
  exampleLoaded(title: string): string;
  /** ... a file */
  fileWhat(fileName: string): string;
  /** a file was opened, with what there is to say about it */
  openedWithNotes(fileName: string, notes: string[]): string;
  opened(fileName: string): string;
  programSaved: string;
  /** a line of the console names a block that is gone */
  blockGone: string;
  /** the button that enlarges the stage, and shrinks it again */
  shrink: string;
  enlarge: string;
  /** the button of the title row that opens the test window (and the title of that window) */
  testOnMany(scenarios: string): string;
  /** ... the same on a phone */
  testShort: string;
  rulesButton: string;
  /** the name of the rules window, for a screen reader */
  rulesRegion: string;
  /** the title of the rules window (the pieces as the English JSX has them) */
  rulesTitle(title: string): ReactNode;
  /** the part of the page with the blocks */
  yourProgram: string;
  /** what an empty workspace says (the pieces as the English JSX has them) */
  emptyWorkspace(canLoadExamples: boolean): ReactNode;
  /** the part of the page with the stage */
  stageRegion: string;
  /** the enlarged stage, a window of its own */
  stageEnlarged: string;
  /** before the measurement of the ruler, for a screen reader (its trailing blank included) */
  rulerPrefix: string;
  clearRulerHint: string;
  clearRuler: string;
  /** the group of the four buttons under the mat */
  showOnStage: string;
  zones: string;
  sensorsButton: string;
  pathHint: string;
  path: string;
  rulerHint: string;
  rulerButton: string;
  /** buttons A and B under the mat during a match */
  cyberPiButtons: string;
  cyberPiButtonsHint: string;
  buttonA: string;
  buttonB: string;
  /** the controls that place the robot before the start */
  startPosition: string;
  headingHint: string;
  turnLeftLabel(step: number): string;
  turnLeftHint: string;
  turnRightLabel(step: number): string;
  turnRightHint: string;
  turningStep: string;
  turningStepHint: string;
  /** the title of the score sheet (and its button on the status line) */
  scoreSheet: string;
  sensorsTitle: string;
  /** under the Sensors panel: which picture of the mat the line sensor reads */
  lineSensorReal: string;
  lineSensorDrawn: string;
  consoleTitle: string;
  /** the closed console: how many problems (the pieces as the English JSX has them) ... */
  consoleProblems(count: number): ReactNode;
  /** ... or how many lines */
  consoleMessages(count: number): string;
  /** a run of the test window was put on the stage */
  scenarioLoaded(scenario: string): string;
  /** the button that closes a window (../widgets.tsx) */
  close: string;
}

// =============================================================================================
// The strip above the blocks and the Examples window (../EditorToolbar.tsx, ../ExamplesDialog.tsx)
// =============================================================================================

export interface ProgramText {
  toolbarLabel: string;
  newHint: string;
  newButton: string;
  examplesButton: string;
  openHint: string;
  openButton: string;
  saveHint: string;
  saveButton: string;
  undo: string;
  undoHint: string;
  redo: string;
  redoHint: string;
  autosaveHint: string;
  /** "12 blocks · saved automatically" */
  blockCount(blocks: number): string;
  /** in that place while the editor loads */
  toolbarLoading: string;
  examplesTitle: string;
  /** the name of the cards of one level, for a screen reader */
  examplesLevel(title: string): string;
  loadExampleLabel(title: string): string;
  memberCode: string;
  forgetGroup: string;
  /** ../examples-words.ts */
  examplesIntro: typeof examplesIntro;
  codeMessage: typeof codeMessage;
  examplesWords: ExamplesWords;
}

// =============================================================================================
// The match: controls, status line, score sheet (../ControlBar.tsx, ../ScoreSheet.tsx, ../match-words.ts)
// =============================================================================================

/** What the status line says about a match that is over (../ScoreSheet.tsx StatusLine). */
export interface MatchOver {
  /** what one scored run is called, as at the beginning of a sentence: "Match" */
  Match: string;
  /** the referee's own sentence, as the line shows it (its first words, or the whole), or null when the referee said nothing */
  ending: string | null;
  /** how the match ended where the referee said nothing (finishText) */
  reason: string;
  /** when it ended, as this game writes a moment */
  time: string;
  total: number;
  max: number;
  /** every point of the field */
  perfect: boolean;
  /** every goal complete (ScoreReport.complete) */
  complete: boolean;
  goal: string;
  goals: string;
  /** what the restarts did (restartSummary); empty when there was none */
  penaltyNote: string;
}

export interface MatchText {
  /** "0.5×" ... "Max" */
  speedLabel(speed: Speed): string;
  speedWord: string;
  speedGroup: string;
  speedHint(match: string): string;
  /** what Start does: `over` once a run was stopped or is over */
  startHint(over: boolean): string;
  start: string;
  stopHint(match: string): string;
  stop: string;
  resume: string;
  pause: string;
  pauseHint(match: string): string;
  /** the clock, for a screen reader: `left` is the time on it */
  clockLabel(match: string, left: string): string;
  timeWord: string;
  scoreLabel(total: number, max: number): string;
  scoreWord: string;
  restartWord: string;
  finishedWord: string;
  resetLabel: string;
  /** what Reset field puts back (the game's words), and when it works */
  resetHint(resetHint: string, match: string): string;
  /** the two words on the Reset field button: the second one is left out where the bar is narrow */
  resetWord: string;
  resetFieldWord: string;
  /** ../match-words.ts */
  restartButton: typeof restartButton;
  restartSummary: typeof restartSummary;
  finishSentence: typeof finishSentence;
  finishHeadline: typeof finishHeadline;
  /** ../format.ts */
  finishText: typeof finishText;
  /** how each line of the sheet is marked, for a screen reader */
  markNames: Record<LineMark, string>;
  lineEarnedHint: string;
  /** before the time of a line, for a screen reader (its trailing blank included) */
  earnedAt: string;
  /** before the referee's whole sentence at the top of the sheet */
  howEnded(match: string): string;
  total: string;
  scoreTimeNote: string;
  /** the status line during a match: the goals complete so far (the pieces as the English JSX has them) ... */
  statusRunning(Match: string, done: number, total: number, goals: string, penalty: ReactNode): ReactNode;
  /** ... or what the referee is doing (ScoreReport.now) */
  statusRunningNow(Match: string, now: string, penalty: ReactNode): ReactNode;
  statusPaused(time: string, match: string): ReactNode;
  statusStopped(time: string, points: ReactNode): ReactNode;
  statusOver(over: MatchOver, points: ReactNode): ReactNode;
  /** the same words as one text: the hint of a line that is cut after two lines */
  statusOverText(over: MatchOver): string;
  /** ../screen-words.ts: the few words on the closed score sheet */
  scoreSheetSummary: typeof scoreSheetSummary;
}

// =============================================================================================
// The panel of the arrangement and the test window (../CombinationPanel.tsx, ../BatchDialog.tsx)
// =============================================================================================

export interface CombinationText {
  /** the code, for a screen reader */
  scenarioCodeLabel(scenario: string, code: string): string;
  copyCodeLabel(scenario: string): string;
  copyCodeHint: string;
  copied: string;
  enterCode: string;
  useCode: string;
  /** the words in front of a game's own random draws */
  randomDrawsLead(label: string): ReactNode;
  /** the last line of the panel when the game gives none (the pieces as the English JSX has them) */
  scenarioCountNote(count: number): ReactNode;
  /** ../scenario-code.ts: how a typed code is read when the game brings no reader */
  codeReaderOf: typeof codeReaderOf;
}

export interface BatchText {
  batchNothingToTest(scenario: string): string;
  batchStopped(message: string): string;
  /** the time under the best and the worst run: "at 0:37.2" (`tileWords`: the game's own words for "at") */
  batchAt(time: string, tileWords: string | undefined): string;
  whichScenarios(scenarios: string): string;
  /** after the number of a random list: " random combinations" */
  randomListName(name: string): string;
  randomCountHint(count: number): string;
  kindOfRandom(scenarios: string): string;
  seedHint(scenarios: string): string;
  seed: string;
  anotherSeed: string;
  anotherSeedHint(scenarios: string): string;
  cancel: string;
  runTest: string;
  runAgain: string;
  testProgress: string;
  /** after "12 / 50" when the test was cancelled */
  testStoppedNote: string;
  averageScoreLabel: string;
  ofPoints(max: number): string;
  bestRun: string;
  worstRun: string;
  /** the tile of the runs with every goal complete (`goal`, `goals`: the game's words) */
  everyGoal(goal: string, goals: string): string;
  runsCount(complete: number, runs: number): string;
  programProblem: string;
  moreProblems(more: number): string;
  lineSuccessTitle: string;
  lineSuccessHint(name: string, percent: string): string;
  /** a line without points while nothing is wrong with it: "No penalty: restarts" */
  cleanLineName(cleanLine: string, name: string): string;
  everyRun: string;
  worstFirst: string;
  scoreColumn: string;
  pointsTimeHint: string;
  pointsTime: string;
  howItEnded: string;
  timeColumn: string;
  endedColumn: string;
  watch: string;
  noPoints: string;
  /** after how a run ended: ", 2 restarts" */
  runRestarts(restarts: number): string;
  watchLabel(scenario: string, code: string): string;
  /** ../batch-words.ts */
  endSentence: typeof endSentence;
  scoreTimeText: typeof scoreTimeText;
}

// =============================================================================================
// The Sensors panel and the CyberPi panel (../SensorDashboard.tsx, ../robot-parts.ts, ../CyberPiPanel.tsx)
// =============================================================================================

export interface SensorText {
  /** where each probe of the line sensor is */
  probeHint: Record<ProbeName, string>;
  probeTitle(name: ProbeName, hint: string): string;
  /**
   * A colour a sensor reads, as the panel shows it (design 6.3, D7): English the value itself;
   * French the value as the program gets it, then its French in brackets - "red (rouge)".
   */
  sensorColour(colour: SensorColor | 'none'): ReactNode;
  probeOnLine: string;
  probeBackground: string;
  lightHint: string;
  /** the reflected light of a probe: `value` is the number as the screen writes it */
  probeLight(value: string): ReactNode;
  quadRgb: string;
  lineStatus: string;
  lineStatusHint: string;
  deviation: string;
  deviationHint: string;
  /** the colour sensor at the front (Fire Chief): `rangeMm` as the screen writes it */
  frontColourHint(rangeMm: string): string;
  colourSensor: string;
  ultrasonic: string;
  ultrasonicNothing: string;
  clawColour: string;
  /** what the colour sensor at the claw reads: a colour, or nothing */
  clawReading(colour: SensorColor | 'none'): ReactNode;
  yaw: string;
  yawHint: string;
  timer: string;
  em1Angle: string;
  em1AngleHint: string;
  em2Angle: string;
  em2AngleHint: string;
  em1Speed: string;
  em2Speed: string;
  em2SpeedHint: string;
  /** the unit of a motor speed */
  rpm: string;
  armLabel(servo: string): string;
  /** `height` as the screen writes it (mm) */
  armHint(height: string): string;
  clawLabel(servo: string): string;
  /** `gap` as the screen writes it (mm) */
  clawHint(gap: string): string;
  dcMotorLabel(port: string, use: string): string;
  dcMotorHint(port: string, use: string): string;
  /** `minPower` as the screen writes it */
  fanHint(port: string, minPower: string): string;
  fan: string;
  fanState(on: boolean): string;
  variablesTitle: string;
  noVariables: string;
  /** the name of a variable or a list as the interpreter lists it ("x (list)" where a list has a variable's name) */
  variableName(name: string): string;
  /** ../robot-parts.ts */
  dcMotorUse: typeof dcMotorUse;
  colourRangeText: typeof colourRangeText;
  colourRangeNote: typeof colourRangeNote;
  sensorSummary: typeof sensorSummary;
  sensorsViewHint: typeof sensorsViewHint;
}

export interface CyberPiText {
  joystick: string;
  joystickUp: string;
  joystickLeft: string;
  joystickMiddle: string;
  joystickRight: string;
  joystickDown: string;
  cyberPiScreen: string;
  printHere: string;
  leds: string;
  buttons: string;
  holdHint: string;
  /** the Sound button (the pieces as the English JSX has them) */
  soundButton(on: boolean): ReactNode;
  /** ../format.ts: the few words on the closed CyberPi panel */
  cyberPiSummary: typeof cyberPiSummary;
}

// =============================================================================================
// The console (../ConsolePanel.tsx, ../useSimulation.ts, ../format.ts)
// =============================================================================================

export interface ConsoleText {
  /** the name of each kind of line, for a screen reader ... */
  logLevels: Record<LogLevel, string>;
  /** ... and what comes after it, before the line itself */
  levelSeparator: string;
  consoleLabel: string;
  consoleEmpty: string;
  showBlockHint: string;
  underlinedHint: string;
  clearConsole: string;
  /** the first line of a match: `scenarioWord` is the game's word for an arrangement (left out: "combination") */
  startLine(scenarioWord: string | undefined, code: string): string;
  noStartHat: string;
  nothingSnapped: string;
  stoppedByYou: string;
  matPictureFailed: string;
  /** ../format.ts: an event of the engine as a line of the console */
  describeEvent: typeof describeEvent;
  /** the name of a body in a sentence: English "the W1 cube", French "le cube E1" (bodyName) */
  bodyName: typeof bodyName;
  /** a sentence of the engine or the interpreter (../../core, ../../vm) as the console shows it; English: the sentence itself */
  consoleLine(text: string): string;
}

// =============================================================================================
// The stage: the ruler, the enlarged stage, the start position (../ruler.ts, ../stage-view.ts, ../start-pose.ts, ../StageCanvas.tsx)
// =============================================================================================

export interface StageText {
  cmText: typeof cmText;
  turnText: typeof turnText;
  rulerReading: typeof rulerReading;
  rulerText: typeof rulerText;
  /** the numbers of the ruler on the canvas (../render.ts draws them) */
  rulerLabels: typeof rulerLabels;
  sizeButtonHint: typeof sizeButtonHint;
  readyHint: typeof readyHint;
  homeButtonWords: typeof homeButtonWords;
  /** what the canvas is, for a screen reader: while the ruler is on ... */
  matRuler: string;
  /** ... while the robot can be placed ... */
  matPlacing: string;
  /** ... and otherwise */
  matWatching: string;
}

// =============================================================================================
// Program files and the block editor (../program-file.ts, ../BlocklyEditor.tsx)
// =============================================================================================

export interface FileText {
  parseProgramFile: typeof parseProgramFile;
  otherGameNote: typeof otherGameNote;
  /** under the workspace while Blockly loads */
  editorLoading: string;
  /** in its place when Blockly could not be loaded */
  editorFailed: string;
  /** what the screen says after blocks of a part that is gone were taken out of a program (retiredBlocksNote) */
  retiredBlocksNote(taken: Pick<WithoutRetiredBlocks, 'removed' | 'parts'>, whose: 'this program' | 'your saved program'): string | null;
}

/** Every text of the shared screen but those of the window "Inside the Gripper blocks". */
export interface CoreText
  extends NumberText,
    TitleText,
    AppText,
    ProgramText,
    MatchText,
    CombinationText,
    BatchText,
    SensorText,
    CyberPiText,
    ConsoleText,
    StageText,
    FileText {}

/** The whole table: the screen's texts and those of the window "Inside the Gripper blocks" (./gripper.tsx). */
export interface ScreenText extends CoreText {
  gripper: GripperText;
}
