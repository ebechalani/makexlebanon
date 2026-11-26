/**
 * The English word table of the shared simulator screen (./types.ts).
 *
 * Every English page reads this table, through the default value of the context (./context.tsx):
 * no page sets it. So nothing here is new English. A string is moved here exactly as it stood in
 * its component; a sentence the English builds from JSX pieces stays those pieces (the same text
 * nodes, the same elements and classes); and a text function of a plain module is not copied but
 * referenced - `bodyName: bodyName` - so the English screen runs the same function as before, and
 * that module's own tests keep testing it.
 */
import type { ReactNode } from 'react';
import { codeReaderOf } from '../scenario-code';
import { endSentence, scoreTimeText } from '../batch-words';
import { codeMessage, examplesIntro, EXAMPLES_WORDS } from '../examples-words';
import { bodyName, cyberPiSummary, describeEvent, finishText, formatClock, formatNumber, formatRefereeTime, formatStamp, timeTextOf } from '../format';
import { finishHeadline, finishSentence, restartButton, restartSummary } from '../match-words';
import { otherGameNote, parseProgramFile, retiredBlocksNote } from '../program-file';
import { colourRangeNote, colourRangeText, dcMotorUse, sensorSummary, sensorsViewHint } from '../robot-parts';
import { cmText, rulerLabels, rulerReading, rulerText, turnText } from '../ruler';
import { capital, scoreSheetSummary } from '../screen-words';
import { readyHint, sizeButtonHint } from '../stage-view';
import { homeButtonWords } from '../start-pose';
import { EN_TITLE_TEXT } from './en-title';
import { EN_GRIPPER_TEXT } from './gripper';
import type { MatchOver, ScreenText } from './types';

/** The status line of a match that is over: the referee's words or the reason, then the score (../ScoreSheet.tsx). */
function statusOver(o: MatchOver, points: ReactNode): ReactNode {
  return (
    <>
      <span className="font-bold">{`${o.Match} over.`}</span>{' '}
      {o.ending !== null ? (
        // the referee ended the match: its own sentence says why (and when) - in a brief ending its first words only
        <>
          {o.ending} Final score: {points}
        </>
      ) : (
        <>
          {o.reason} at {o.time}. Final score: {points}
        </>
      )}
      {o.perfect ? ' - a perfect run!' : o.complete ? ` - every ${o.goal} complete.` : ''}
      {o.penaltyNote && ` (${o.penaltyNote})`}
    </>
  );
}

export const EN_TEXT: ScreenText = {
  locale: 'en',

  // ---- numbers and times
  number: formatNumber,
  clock: formatClock,
  moment: formatStamp,
  refereeTime: formatRefereeTime,
  timeTextOf,
  percent: (share) => `${Math.round(share * 100)}%`,
  averageScore: (value) => value.toFixed(1),

  // ---- the title row (TitleBar.tsx): a file of its own, which the title row reads without this table (./title-context.tsx)
  ...EN_TITLE_TEXT,

  // ---- the screen (SimulatorApp.tsx)
  notAllowed: (startZoneName) => `The robot must be completely inside the ${startZoneName}.`,
  notAllowedAtAngle: (notAllowed) => `${notAllowed} It does not fit at this angle.`,
  placingProblem: (notAllowed) => `Not allowed: ${notAllowed.charAt(0).toLowerCase()}${notAllowed.slice(1)} It stays where it was.`,
  editorStillLoading: 'The block editor is still loading. Try again in a moment.',
  nothingToRun: (canLoadExamples) =>
    canLoadExamples
      ? 'Nothing to run yet: snap blocks under the yellow "when CyberPi starts up" block, or open one of the Examples.'
      : 'Nothing to run yet: snap blocks under the yellow "when CyberPi starts up" block, then press Start again.',
  replaceConfirm: (what) => `Replace the blocks in your workspace with ${what}?\n(You can get them back with Undo.)`,
  programNotShown: 'This program could not be shown. Your blocks were not changed.',
  newProgramWhat: 'a new, empty program',
  exampleWhat: (title) => `the example "${title}"`,
  exampleLoaded: (title) => `Example loaded: ${title}. Press Start to watch it.`,
  fileWhat: (fileName) => `the program from "${fileName}"`,
  openedWithNotes: (fileName, notes) => `Opened ${fileName}. ${notes.join(' ')}`,
  opened: (fileName) => `Opened ${fileName}.`,
  programSaved: 'Program saved to your downloads.',
  blockGone: 'That block is no longer in your workspace.',
  shrink: 'Shrink',
  enlarge: 'Enlarge',
  testOnMany: (scenarios) => `Test on many ${scenarios}`,
  testShort: 'Test',
  rulesButton: 'Rules',
  rulesRegion: 'Rules in short',
  rulesTitle: (title) => <>{title}: the rules in short</>,
  yourProgram: 'Your program',
  emptyWorkspace: (canLoadExamples) => (
    <>
      <span className="font-bold text-ink-700">Build your program here.</span> Click a group on the left (try{' '}
      <span className="font-semibold text-ink-700">mBot2 Chassis</span>), drag a block out and snap it under the yellow block. Then press{' '}
      <span className="font-semibold text-ink-700">Start</span>.
      {/* (only for a visitor who can open one: the examples are for members) */}
      {canLoadExamples && (
        <>
          {' '}
          Or open one of the <span className="font-semibold text-ink-700">Examples</span> to see how it is done.
        </>
      )}
    </>
  ),
  stageRegion: 'Stage',
  stageEnlarged: 'The stage, enlarged',
  rulerPrefix: 'Ruler: ',
  clearRulerHint: 'Remove the measurement (the Esc key removes only the last point)',
  clearRuler: 'Clear',
  showOnStage: 'Show on the stage',
  zones: 'Zones',
  sensorsButton: 'Sensors',
  pathHint: 'Draw the path the robot has driven',
  path: 'Path',
  rulerHint: 'Measure on the mat: click points to see the distances in cm and the turns between them',
  rulerButton: 'Ruler',
  cyberPiButtons: 'CyberPi buttons',
  cyberPiButtonsHint: 'Hold a button down to press it on the robot. The joystick is in the CyberPi panel below.',
  buttonA: 'Button A',
  buttonB: 'Button B',
  startPosition: 'Robot start position',
  headingHint: 'Direction the robot faces: 0° = up the mat, 90° = to the right',
  turnLeftLabel: (step) => `Turn the robot ${step} degrees to the left`,
  turnLeftHint: 'Turn left (the mouse wheel on the robot turns it too)',
  turnRightLabel: (step) => `Turn the robot ${step} degrees to the right`,
  turnRightHint: 'Turn right (the mouse wheel on the robot turns it too)',
  turningStep: 'Turning step',
  turningStepHint: 'How far one press turns the robot',
  scoreSheet: 'Score sheet',
  sensorsTitle: 'Sensors',
  lineSensorReal: 'The line sensor reads the real picture of the mat, illustrations included.',
  lineSensorDrawn: 'The line sensor reads a simplified drawing of the mat (the real picture is still loading).',
  consoleTitle: 'Console',
  consoleProblems: (count) => (
    <>
      {count} problem{count === 1 ? '' : 's'}
    </>
  ),
  consoleMessages: (count) => `${count} message${count === 1 ? '' : 's'}`,
  scenarioLoaded: (scenario) => `${capital(scenario)} loaded. Press Start to watch your program on it.`,
  close: 'Close',

  // ---- the strip above the blocks (EditorToolbar.tsx) and the Examples window (ExamplesDialog.tsx)
  toolbarLabel: 'Program',
  newHint: 'Start a new, empty program',
  newButton: 'New',
  examplesButton: 'Examples',
  openHint: 'Open a program file from this computer',
  openButton: 'Open',
  saveHint: 'Save the program as a file on this computer',
  saveButton: 'Save',
  undo: 'Undo',
  undoHint: 'Undo (Ctrl+Z)',
  redo: 'Redo',
  redoHint: 'Redo (Ctrl+Shift+Z)',
  autosaveHint: 'Your blocks are saved in this browser a moment after every change.',
  blockCount: (blocks) => `${blocks} block${blocks === 1 ? '' : 's'} · saved automatically`,
  toolbarLoading: 'Loading…',
  examplesTitle: 'Examples',
  examplesLevel: (title) => `${title} examples`,
  loadExampleLabel: (title) => `Load the example ${title}`,
  memberCode: 'Member code',
  forgetGroup: 'Forget this code on this device?',
  examplesIntro,
  codeMessage,
  examplesWords: EXAMPLES_WORDS,

  // ---- the match controls (ControlBar.tsx)
  speedLabel: (speed) => (speed === 'max' ? 'Max' : `${speed}×`),
  speedWord: 'Speed',
  speedGroup: 'Speed of the simulation',
  speedHint: (match) => `Speed of the simulation (the ${match} clock runs at the same speed)`,
  startHint: (over) =>
    over
      ? 'Try again: the field is set up fresh, the clock starts at the top and your program runs from its first block'
      : "The referee's start signal: the field is set up fresh and your program starts from the top",
  start: 'Start',
  stopHint: (match) => `Stop the program and the robot where they are. The ${match} is not scored; Reset field puts everything back.`,
  stop: 'Stop',
  resume: 'Continue',
  pause: 'Pause',
  pauseHint: (match) => `Pause (the ${match} clock pauses too)`,
  clockLabel: (match, left) => `${capital(match)} clock: ${left} left`,
  timeWord: 'Time',
  scoreLabel: (total, max) => `Score: ${total} of ${max} points`,
  scoreWord: 'Score',
  restartWord: 'Restart',
  finishedWord: 'Finished',
  resetLabel: 'Reset field',
  resetHint: (resetHint, match) => `${resetHint} Works at any moment, also during ${/^[aeiou]/i.test(match) ? 'an' : 'a'} ${match}.`,
  resetWord: 'Reset',
  resetFieldWord: 'field',
  restartButton,
  restartSummary,
  finishSentence,
  finishHeadline,
  finishText,

  // ---- the score sheet and the status line (ScoreSheet.tsx)
  markNames: { done: 'done', 'not-done': 'not done', penalty: 'penalty', note: 'note' },
  lineEarnedHint: 'The time on the clock when this line was earned',
  earnedAt: 'earned at ',
  howEnded: (match) => `How the ${match} ended: `,
  total: 'Total',
  scoreTimeNote: 'Time of this score - with equal points, the rules rank the shorter time higher',
  statusRunning: (Match, done, total, goals, penalty) => (
    <>
      <span className="font-bold">{`${Match} running.`}</span> {done} of {total}
      {` ${goals} complete.`}
      {penalty}
    </>
  ),
  statusRunningNow: (Match, now, penalty) => (
    <>
      <span className="font-bold">{`${Match} running.`}</span> {now}
      {penalty}
    </>
  ),
  statusPaused: (time, match) => (
    <>
      <span className="font-bold">Paused</span> at {time}
      {`. The ${match} clock is paused too.`}
    </>
  ),
  statusStopped: (time, points) => (
    <>
      <span className="font-bold">Stopped by you</span> at {time} - no final score (so far {points}). Start tries again, Reset puts the
      field back.
    </>
  ),
  statusOver,
  statusOverText: (o) =>
    `${o.Match} over. ` +
    (o.ending !== null ? `${o.ending} Final score: ` : `${o.reason} at ${o.time}. Final score: `) +
    `${o.total} / ${o.max}` +
    (o.perfect ? ' - a perfect run!' : o.complete ? ` - every ${o.goal} complete.` : '') +
    (o.penaltyNote ? ` (${o.penaltyNote})` : ''),
  scoreSheetSummary,

  // ---- the panel of the arrangement (CombinationPanel.tsx)
  scenarioCodeLabel: (scenario, code) => `${capital(scenario)} code ${code}`,
  copyCodeLabel: (scenario) => `Copy the ${scenario} code`,
  copyCodeHint: 'Copy the code',
  copied: 'Copied',
  enterCode: 'Enter a code',
  useCode: 'Use',
  randomDrawsLead: (label) => <>{label}:</>,
  scenarioCountNote: (count) => (
    <>
      {count.toLocaleString('en')} combinations are possible. Changing the combination puts the field back to the start.
    </>
  ),
  codeReaderOf,

  // ---- the test window (BatchDialog.tsx)
  batchNothingToTest: (scenario) => `There is no ${scenario} to test.`,
  batchStopped: (message) => `The test stopped: ${message}`,
  batchAt: (time, tileWords) => `${tileWords ?? 'at'} ${time}`,
  whichScenarios: (scenarios) => `Which ${scenarios}?`,
  randomListName: (name) => ` random ${name}`,
  randomCountHint: (count) => (count === 10 ? 'A quick check.' : count === 50 ? 'A good picture of how reliable the program is.' : 'A thorough test. Takes a little longer.'),
  kindOfRandom: (scenarios) => `Kind of random ${scenarios}`,
  seedHint: (scenarios) => `The same seed always draws the same ${scenarios}, so you can repeat a test after changing your program.`,
  seed: 'Seed',
  anotherSeed: 'Pick another seed',
  anotherSeedHint: (scenarios) => `Pick another seed (other ${scenarios})`,
  cancel: 'Cancel',
  runTest: 'Run the test',
  runAgain: 'Run again',
  testProgress: 'Test progress',
  testStoppedNote: ' (stopped)',
  averageScoreLabel: 'Average score',
  ofPoints: (max) => `of ${max} points`,
  bestRun: 'Best run',
  worstRun: 'Worst run',
  everyGoal: (goal) => `Every ${goal} complete`,
  runsCount: (complete, runs) => `${complete} of ${runs} runs`,
  programProblem: 'The program has a problem:',
  moreProblems: (more) => ` (and ${more} more)`,
  lineSuccessTitle: 'How often each line of the score sheet succeeds',
  lineSuccessHint: (name, percent) => `${name}: ${percent} of the runs`,
  cleanLineName: (cleanLine, name) => `${cleanLine}: ${name.toLowerCase()}`,
  everyRun: 'Every run',
  worstFirst: 'Worst first',
  scoreColumn: 'Score',
  pointsTimeHint: 'The time on the clock when the last of these points was earned. With equal points, the shorter time ranks higher.',
  pointsTime: 'Time of the points',
  howItEnded: 'How it ended',
  timeColumn: 'Time',
  endedColumn: 'Ended',
  watch: 'Watch',
  noPoints: 'no points',
  runRestarts: (restarts) => `, ${restarts} restart${restarts === 1 ? '' : 's'}`,
  watchLabel: (scenario, code) => `Watch ${scenario} ${code} on the stage`,
  endSentence,
  scoreTimeText,

  // ---- the Sensors panel (SensorDashboard.tsx)
  probeHint: {
    L2: 'far left',
    L1: 'left',
    R1: 'right',
    R2: 'far right',
  },
  probeTitle: (name, hint) => `Probe ${name} (${hint})`,
  sensorColour: (colour) => colour,
  probeOnLine: 'line',
  probeBackground: 'background',
  lightHint: 'reflected light, 0 (black) to 100 (white)',
  probeLight: (value) => <>light {value}</>,
  quadRgb: 'Quad RGB line sensor',
  lineStatus: 'Line status',
  lineStatusHint: 'One digit per probe, L2 L1 R1 R2: 1 = on the line. Example: 0110 = 6 means the two middle probes see the line.',
  deviation: 'Deviation',
  deviationHint: '-100 = the robot is far to the left of the line, 0 = centred, 100 = far to the right of the line (as on the real mBot2)',
  frontColourHint: (rangeMm) =>
    `What the colour sensor at the front of the robot reads. In this simulator it names the colour of a thing that is ${rangeMm} mm or less in front of it. "none" = nothing is that close.`,
  colourSensor: 'Colour sensor',
  ultrasonic: 'Ultrasonic',
  ultrasonicNothing: 'cm (nothing seen)',
  clawColour: 'Claw colour',
  clawReading: (colour) => (colour === 'none' ? 'nothing' : colour),
  yaw: 'Yaw (turned)',
  yawHint: 'How far the robot has turned since the gyro was reset; clockwise is positive',
  timer: 'Timer',
  em1Angle: 'EM1 angle (left)',
  em1AngleHint: 'Encoder of motor EM1, the left wheel',
  em2Angle: 'EM2 angle (right)',
  em2AngleHint: 'Encoder of motor EM2, the right wheel. It is mounted mirrored, so it counts backwards when the robot drives forward - just like on the real mBot2.',
  em1Speed: 'EM1 speed',
  em2Speed: 'EM2 speed',
  em2SpeedHint: 'Negative while the robot drives forward (mirrored motor)',
  rpm: 'RPM',
  armLabel: (servo) => `Arm (${servo})`,
  armHint: (height) => `Claw is ${height} mm above the mat`,
  clawLabel: (servo) => `Claw (${servo})`,
  clawHint: (gap) => `Opening: ${gap} mm`,
  dcMotorLabel: (port, use) => (use ? `DC motor ${port} (${use})` : `DC motor ${port}`),
  dcMotorHint: (port, use) => `Power of DC motor port ${port}, -100 to 100 %${use ? '' : '. Nothing is connected to this port on this robot.'}`,
  fanHint: (port, minPower) => `The fan blows while DC motor ${port} runs at ${minPower} % power or more, forwards or backwards.`,
  fan: 'Fan',
  fanState: (on) => (on ? 'fan on' : 'fan off'),
  variablesTitle: 'Variables',
  noVariables: 'Your program has no variables yet.',
  variableName: (name) => name,
  dcMotorUse,
  colourRangeText,
  colourRangeNote,
  sensorSummary,
  sensorsViewHint,

  // ---- the CyberPi panel (CyberPiPanel.tsx)
  joystick: 'Joystick',
  joystickUp: 'Joystick up',
  joystickLeft: 'Joystick left',
  joystickMiddle: 'Joystick pressed in the middle',
  joystickRight: 'Joystick right',
  joystickDown: 'Joystick down',
  cyberPiScreen: 'CyberPi screen',
  printHere: 'Use a "print" block to write here',
  leds: 'The five LEDs of the CyberPi',
  buttons: 'Buttons',
  holdHint: 'Hold a button down to press it on the robot.',
  soundButton: (on) => <>Sound {on ? 'on' : 'off'}</>,
  cyberPiSummary,

  // ---- the console (ConsolePanel.tsx, useSimulation.ts)
  logLevels: { info: 'Info', event: 'Event', warn: 'Warning', error: 'Error' },
  levelSeparator: ': ',
  consoleLabel: 'Console',
  consoleEmpty: 'Nothing yet. Messages and problems of your program appear here while it runs.',
  showBlockHint: 'Show the block this message is about',
  underlinedHint: 'Underlined lines: click to see the block.',
  clearConsole: 'Clear',
  startLine: (scenarioWord, code) => `Start! ${capital(scenarioWord ?? 'combination')} ${code}.`,
  noStartHat: 'Nothing will happen: the program has no yellow "when CyberPi starts up" block to begin with.',
  nothingSnapped: 'Nothing will happen: no block is snapped under a yellow "when ..." block yet.',
  commaTextWarning: () => null,
  stoppedByYou: 'Stopped by you. Press Start to try again.',
  matPictureFailed: 'The mat picture could not be loaded: the floor sensors use the simplified drawing of the mat.',
  describeEvent,
  bodyName,
  consoleLine: (text) => text,

  // ---- the stage (ruler.ts, stage-view.ts, start-pose.ts, StageCanvas.tsx)
  cmText,
  turnText,
  rulerReading,
  rulerText,
  rulerLabels,
  sizeButtonHint,
  readyHint,
  homeButtonWords,
  matRuler: 'Competition mat seen from above. The ruler is on: a click on the mat sets a point. The measurement is written next to the mat.',
  matPlacing: 'Competition mat seen from above. The robot can be placed: drag it, or use the arrow keys to move and Q or E to turn.',
  matWatching: 'Competition mat seen from above, with the robot and the game elements.',

  // ---- program files and the block editor (program-file.ts, BlocklyEditor.tsx)
  parseProgramFile,
  otherGameNote,
  editorLoading: 'Loading the blocks…',
  editorFailed: 'The block editor could not be loaded. Please reload the page.',
  retiredBlocksNote,

  gripper: EN_GRIPPER_TEXT,
};
