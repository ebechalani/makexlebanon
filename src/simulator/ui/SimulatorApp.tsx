'use client';

/**
 * The simulator screen: block workspace on the left, stage with its controls and panels on the
 * right (stacked on narrow screens). It works for any Game; what is special about one category
 * (its examples, rules, combination editor, a few words) is passed in as props - see
 * ./fire-rescue/FireRescueSimulator.tsx and ./fire-chief/FireChiefSimulator.tsx.
 *
 * Everything else the screen asks the game, the robot and the simulation:
 *   game.id                 the block palette (../blocks/palettes.ts), the saved work, the program files
 *   game.restartRules,      what the "Restart" button says and when it is off
 *     game.restartPenalty   (with Simulation.restartsLeft)
 *   game.overlays()         the zones of the "Zones" view
 *   game.startZone          where the robot may be put before the start, and - with the game's default
 *                           start position - where the button beside the turning buttons puts it
 *                           (./start-pose.ts: HomeKind)
 *   game.createReferee      how a moment of a match is written (./format.ts: timeTextOf)
 *   robotConfig             which sensors and motors the Sensors panel and the stage show (./robot-parts.ts)
 *   Simulation.world.walls  the walls on the stage
 *   Simulation.finishDetail the referee's own sentence about the end of a match
 *   ScoreLine.time,         the times on the score sheet
 *     ScoreReport.time
 *
 * The screen is a page of the website: it starts under the site's header and fills the rest of
 * the window (its frame is in ./page-frame.ts, the sizes that follow from it in ./simulator.css).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { DEG } from '../core/geometry';
import type { GripperVariantId } from '../blocks/gripper-original';
import { paletteCategories } from '../blocks/palettes';
import type { Game, Pose, ProgramJson, RobotConfig, Simulation } from '../core/types';
import { BatchDialog, type BatchPreset, type BatchRandom } from './BatchDialog';
import { BlocklyEditor, type BlocklyEditorHandle, type EditorStatus } from './BlocklyEditor';
import { CombinationPanel } from './CombinationPanel';
import { ConsolePanel } from './ConsolePanel';
import { ControlBar } from './ControlBar';
import { CyberPiPanel, HoldButton } from './CyberPiPanel';
import { EditorToolbar } from './EditorToolbar';
import { timeTextOf } from './format';
import { GripperCodeDialog } from './GripperCodeDialog';
import { CentreIcon, EnlargeIcon, RotateLeftIcon, RotateRightIcon, RulerIcon, RulesIcon, SensorsIcon, ShrinkIcon, TestIcon, TrailIcon, ZonesIcon } from './icons';
import type { ExampleProgram } from './member-unlock';
import { blankProgram, hasRunnableScript, otherGameNote, parseProgramFile, programFileName, serializeProgramFile } from './program-file';
import type { StageOptions } from './render';
import { robotParts, sensorSummary, sensorsViewHint } from './robot-parts';
import { EMPTY_RULER, followRobot, removeLastRulerPoint, rulerText, startsOnRobot, type Ruler } from './ruler';
import type { CodeReader } from './scenario-code';
import { ScoreSheet, StatusLine } from './ScoreSheet';
import { capital, screenWords, type ScreenWords } from './screen-words';
import { SensorDashboard } from './SensorDashboard';
import { StageCanvas } from './StageCanvas';
import { escapeAction, readyHint, sizeButtonHint, tabStop } from './stage-view';
import { headingDegrees, homeButtonWords, homeKind, homePose, isPose, poseFits, rotatedPose } from './start-pose';
import { PAGE_FRAME } from './page-frame';
import { isRecord, loadJson, saveJson, storageKey } from './storage';
import { TitleBar, titleBarButton } from './TitleBar';
import { useMemberExamples, type ExamplesConfig } from './useMemberExamples';
import { SPEEDS, useSimulation, type Speed } from './useSimulation';
import { button, FOCUSABLE, Section, toggleClass, usePopover } from './widgets';
// The simulator's own stylesheet travels with the simulator: the browser fetches it together with
// this screen, so pages that only link to the simulator never load it.
import './simulator.css';

/** Folder (in /public) with Blockly's own pictures. */
const BLOCKLY_MEDIA = '/blockly-media/';

export interface RulesSection {
  title: string;
  items: string[];
}

/**
 * A second part of the rules window with a heading of its own, under the rules - for what is
 * not a rule: Fire Chief lists there what the simulator assumes where the rules say nothing yet.
 */
export interface RulesPart {
  title: string;
  /** one sentence under the heading that says what kind of list this is */
  note?: string;
  sections: RulesSection[];
}

export interface SimulatorAppProps<S> {
  game: Game<S>;
  robotConfig: RobotConfig;
  /** short name of the category for the header, e.g. "Fire Rescue" */
  title: string;
  /** what the start zone is called in this category, e.g. "Fire Station" */
  startZoneName: string;
  /**
   * The examples of the category: where on this website they are handed out. Neither the
   * programs nor their titles are part of the screen (see ./useMemberExamples.ts).
   * Pass one object that stays the same between renders.
   */
  examples: ExamplesConfig;
  rules: RulesSection[];
  /** one sentence under the heading of the rules, e.g. that they are a draft (left out: no sentence) */
  rulesNote?: string;
  /** a second part under the rules, with its own heading (left out: the window ends with the rules) */
  rulesExtra?: RulesPart;
  /**
   * The sentences of the screen that are different in this category (see ./screen-words.ts).
   * Left out, or what is left out of it: the words of Fire Rescue.
   * Pass one object that stays the same between renders.
   */
  words?: Partial<ScreenWords>;
  /** where the robot stands when nothing was saved (must fit the start zone) */
  initialStartPose: Pose;
  /**
   * The corner of the mat that the "Enlarge" button lies on (always on the right): 'top' (left
   * out) or 'bottom'. The button covers a little of the mat, so a category picks the corner
   * where nothing has to be seen - in Fire Rescue the roof of a building at the top, in Fire
   * Chief the bottom (the fire can stand in the top corners).
   * A message of the simulator that is shown on the enlarged mat goes to the other edge: the
   * lower one for 'top', the upper one for 'bottom' (where the button is at the bottom the robot
   * starts at the bottom too, and the message would lie on it).
   */
  enlargeButtonCorner?: 'top' | 'bottom';
  /** the category's own editor for a combination */
  renderCombinationEditor: (scenario: S, onChange: (next: S) => void) => ReactNode;
  /**
   * How this category reads a code that was typed in - and the code it saved for the next visit:
   * the combination it stands for, or one plain sentence that says why it is none (see
   * ./scenario-code.ts). Left out: the game decodes it (Game.decodeScenario).
   * Pass one function that stays the same between renders.
   */
  readCode?: CodeReader<S>;
  /** ready-made lists for "Test on many ..." (left out: random lists only) */
  batchPresets?: BatchPreset<S>[];
  /** the category's own way to draw the random lists of "Test on many ..." (left out: game.randomScenario) */
  batchRandom?: BatchRandom<S>;
}

type SectionId = 'score' | 'combination' | 'sensors' | 'cyberpi' | 'console';

const DEFAULT_OPEN: Record<SectionId, boolean> = {
  score: false,
  combination: true,
  sensors: false,
  cyberpi: false,
  console: false,
};

const DEFAULT_VIEW: StageOptions = { overlays: false, sensors: true, trail: true };

const ROTATE_STEPS = [1, 15, 90] as const;

/*
 * The pictures on the Zones / Sensors / Path / Ruler buttons are shown where they fit. The row
 * under the mat measures its own width (it is a "container"), because the stage column is
 * narrow on a tablet although the screen is not:
 *   - from 35rem: the four buttons with their pictures and the buttons that turn the robot fit on one row;
 *   - from 29rem: they fit on one row without the pictures;
 *   - below that the row has two lines anyway, and from 21rem the first line has room for the pictures
 *     (the four buttons are 334 px wide; 21rem is the row of a phone that is 360 px wide).
 * (Written out in full because Tailwind only finds complete class names.)
 */
const VIEW_ICON = 'hidden h-4 w-4 @[21rem]:block @[29rem]:hidden @[35rem]:block';

interface Notice {
  text: string;
  tone: 'info' | 'error';
}

/** One section of the rules window: its heading and its bullets. */
function rulesSection(section: RulesSection): ReactNode {
  return (
    <div key={section.title} className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{section.title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-snug">
        {section.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** What is remembered between visits (besides the blocks, which the editor saves itself). */
interface SavedSettings<S> {
  scenario: S;
  startPose: Pose;
  view: StageOptions;
  open: Record<SectionId, boolean>;
  speed: Speed;
  sound: boolean;
  rotateStep: number;
}

function readSettings<S>(game: Game<S>, robotConfig: RobotConfig, fallbackPose: Pose, readCode?: CodeReader<S>): SavedSettings<S> {
  const raw = loadJson(storageKey(game.id, 'settings'), isRecord) ?? {};
  // (a category that reads codes its own way reads the saved one that way too: what could be set up before a reload is there after it)
  const decode = (code: string): S | null => {
    if (!readCode) return game.decodeScenario(code);
    const reading = readCode(code);
    return reading.ok ? reading.scenario : null;
  };
  const scenario = (typeof raw.scenario === 'string' ? decode(raw.scenario) : null) ?? game.defaultScenario();
  const safeFallback = poseFits(robotConfig, game.startZone, fallbackPose) ? fallbackPose : game.defaultStartPose;
  const startPose = isPose(raw.startPose) && poseFits(robotConfig, game.startZone, raw.startPose) ? raw.startPose : safeFallback;
  const view = { ...DEFAULT_VIEW };
  if (isRecord(raw.view)) {
    for (const key of ['overlays', 'sensors', 'trail'] as const) {
      if (typeof raw.view[key] === 'boolean') view[key] = raw.view[key];
    }
  }
  const open = { ...DEFAULT_OPEN };
  if (isRecord(raw.open)) {
    for (const key of Object.keys(DEFAULT_OPEN) as SectionId[]) {
      if (typeof raw.open[key] === 'boolean') open[key] = raw.open[key];
    }
  }
  const speed = SPEEDS.find((s) => s === raw.speed) ?? 1;
  const rotateStep = ROTATE_STEPS.find((s) => s === raw.rotateStep) ?? 90;
  return { scenario, startPose, view, open, speed, sound: raw.sound !== false, rotateStep };
}

export function SimulatorApp<S>(props: SimulatorAppProps<S>) {
  const { game, robotConfig, startZoneName } = props;
  const words = useMemo(() => screenWords(props.words), [props.words]);
  // how this game writes a moment of a match (as its referee does, where the referee writes times down)
  const timeText = useMemo(() => timeTextOf(game), [game]);
  // what this robot has: the Sensors panel and the stage show only that
  const parts = useMemo(() => robotParts(robotConfig), [robotConfig]);
  // The Gripper blocks are shortcuts mBlock does not have, and the window that shows the real
  // mBlock code behind them belongs to them: a game whose palette has no Gripper group gets
  // neither the button nor the right-click entry nor the window.
  const hasGripperBlocks = useMemo(() => paletteCategories(game.id).includes('gripper'), [game.id]);

  const [saved] = useState(() => readSettings(game, robotConfig, props.initialStartPose, props.readCode));
  const [scenario, setScenario] = useState<S>(saved.scenario);
  const [view, setView] = useState<StageOptions>(saved.view);
  const [open, setOpen] = useState<Record<SectionId, boolean>>(saved.open);
  const [rotateStep, setRotateStep] = useState<number>(saved.rotateStep);
  const [ghost, setGhost] = useState<Pose | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  // the window "Inside the Gripper blocks": closed (null), or open at one Gripper block (or at none)
  const [gripperCode, setGripperCode] = useState<{ at: GripperVariantId | null } | null>(null);
  const showGripperCode = useCallback((at: GripperVariantId | null) => setGripperCode({ at }), []);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>({ canUndo: false, canRedo: false, blocks: 0 });
  const rules = usePopover<HTMLDivElement>();
  // which examples this visitor may see and load: the website's server says so (more with a code than without)
  const examples = useMemberExamples(props.examples);
  const canLoadExamples = Object.keys(examples.available).length > 0;

  // ------------------------------------------------------------------ the block editor
  const editorRef = useRef<BlocklyEditorHandle | null>(null);
  const onEditorReady = useCallback((handle: BlocklyEditorHandle | null) => {
    editorRef.current = handle;
    setEditorReady(handle !== null);
  }, []);
  const getProgram = useCallback((): ProgramJson | null => editorRef.current?.getProgram() ?? null, []);
  /**
   * True when the workspace was replaced (New, Examples, Open) while a match was on: the robot
   * still runs the program it was started with, which is no longer the one on screen. Blocks
   * of the two programs can carry the same ids, so until the next Start nothing lights up -
   * better than lighting up blocks the robot is not running.
   */
  const replacedDuringMatch = useRef(false);
  const highlightBlocks = useCallback((ids: string[]) => editorRef.current?.highlight(replacedDuringMatch.current ? [] : ids), []);

  // ------------------------------------------------------------------ the simulation
  const sim = useSimulation<S>({
    game,
    robotConfig,
    scenario,
    initialStartPose: saved.startPose,
    getProgram,
    onActiveBlocks: highlightBlocks,
    matchWord: words.match,
    scenarioWord: words.scenario,
  });
  const { snapshot, setSpeed, setSoundOn, setStartPose } = sim;
  const runState = snapshot.runState;
  const placing = runState === 'ready';
  const matchOn = runState === 'running' || runState === 'paused';

  // apply the remembered speed and sound once
  useEffect(() => {
    setSpeed(saved.speed);
    setSoundOn(saved.sound);
  }, [saved, setSoundOn, setSpeed]);

  // remember the settings for the next visit
  useEffect(() => {
    saveJson(storageKey(game.id, 'settings'), {
      scenario: game.encodeScenario(scenario),
      startPose: sim.startPose,
      view,
      open,
      speed: sim.speed,
      sound: sim.soundOn,
      rotateStep,
    });
  }, [game, scenario, sim.startPose, view, open, sim.speed, sim.soundOn, rotateStep]);

  // ------------------------------------------------------------------ small messages at the bottom of the screen
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((text: string, tone: Notice['tone'] = 'info', showFor: number = tone === 'error' ? 6000 : 3500) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), showFor);
  }, []);
  const hush = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(null);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // ------------------------------------------------------------------ placing the robot
  const notAllowed = `The robot must be completely inside the ${startZoneName}.`;

  const onPlace = useCallback(
    (pose: Pose, phase: 'move' | 'end') => {
      if (setStartPose(pose)) setGhost(null);
      // while dragging, show where the robot would be; on release it snaps back to the last allowed place
      else setGhost(phase === 'move' ? pose : null);
    },
    [setStartPose],
  );

  const ghostRef = useRef<Pose | null>(null);
  const startPoseRef = useRef(sim.startPose);
  useEffect(() => {
    ghostRef.current = ghost;
    startPoseRef.current = sim.startPose;
  });

  const onRotate = useCallback(
    (degrees: number) => {
      const from = ghostRef.current ?? startPoseRef.current;
      const result = rotatedPose(robotConfig, game.startZone, from, from.heading + degrees * DEG);
      if (result.legal && setStartPose(result.pose)) setGhost(null);
      else setGhost(result.pose);
    },
    [game, robotConfig, setStartPose],
  );

  // The button beside the turning buttons: into the middle of the start zone, or - in a game whose
  // default start position is not the middle - back to that position (see HomeKind in ./start-pose.ts).
  const defaultPose = useMemo(
    () => (poseFits(robotConfig, game.startZone, props.initialStartPose) ? props.initialStartPose : game.defaultStartPose),
    [game, robotConfig, props.initialStartPose],
  );
  const home = useMemo(() => homeKind(robotConfig, game.startZone, defaultPose), [game, robotConfig, defaultPose]);
  const homeWords = homeButtonWords(home, startZoneName);

  const centreRobot = () => {
    const from = ghost ?? sim.startPose;
    const pose = homePose(home, robotConfig, game.startZone, defaultPose, from.heading);
    if (setStartPose(pose)) setGhost(null);
    else say(home === 'default' ? notAllowed : `${notAllowed} It does not fit at this angle.`, 'error');
  };

  const changeScenario = useCallback((next: S) => {
    setGhost(null);
    setScenario(next);
  }, []);

  // ------------------------------------------------------------------ the ruler
  // (The line is kept while the ruler is switched off, so that the student can drag the robot and
  // come back to the measurement. Nothing of it is saved: after a reload the ruler is off and empty.)
  const [rulerOn, setRulerOn] = useState(false);
  const [ruler, setRuler] = useState<Ruler>(EMPTY_RULER);
  const rulerButtonRef = useRef<HTMLButtonElement>(null);

  // a line that starts on the robot keeps starting on the robot when the robot is put somewhere else
  const rulerPoseRef = useRef(sim.startPose);
  useEffect(() => {
    const from = rulerPoseRef.current;
    rulerPoseRef.current = sim.startPose;
    if (from !== sim.startPose) setRuler((line) => followRobot(line, from, sim.startPose));
  }, [sim.startPose]);

  // A line can be started on the robot wherever it stands - also in the middle of the field,
  // after a match. Once the robot is somewhere else (Reset field puts it back into its start
  // zone) the words must not say "From the robot" any more. The place where the robot starts
  // every match counts as "the robot" all the time: a plan made there is still the robot's plan
  // while it drives.
  const rulerRobotThere = startsOnRobot(ruler, snapshot.pose, sim.startPose);
  const rulerReading = rulerText(ruler, rulerRobotThere);

  // ------------------------------------------------------------------ the enlarged stage
  // (How it is laid over the window is in simulator.css, at ".mbot2-stage-head[data-enlarged]".)
  const stageHeadRef = useRef<HTMLDivElement>(null);
  const enlargeButtonRef = useRef<HTMLButtonElement>(null);
  /**
   * Null: normal size. Otherwise the stage covers the window, and `keep` is the height it had in
   * the page: that room is kept free behind it, so that nothing in the page moves and "Shrink"
   * puts the stage back exactly where it was. Not saved: after a reload the stage is normal.
   */
  const [enlarged, setEnlarged] = useState<{ keep: number } | null>(null);
  const isEnlarged = enlarged !== null;
  const enlarge = () => setEnlarged({ keep: stageHeadRef.current?.getBoundingClientRect().height ?? 0 });
  const shrink = () => setEnlarged(null);

  // A long measurement of the ruler scrolls inside its row (simulator.css, .mbot2-ruler-text).
  // After every change - and when the row gets another size - its end is shown: that is where
  // the newest piece and the total are.
  const rulerTextRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const text = rulerTextRef.current;
    if (text) text.scrollTop = text.scrollHeight;
  }, [rulerReading, rulerOn, isEnlarged]);

  useEffect(() => {
    if (!isEnlarged) return;
    const head = stageHeadRef.current;
    const page = document.documentElement;
    const column = head?.parentElement ?? null;
    // the page behind must not scroll (simulator.css) ...
    page.classList.add('mbot2-enlarged');
    // ... and should a browser let it scroll all the same, it is put back afterwards
    const scrolled = { page: window.scrollY, column: column?.scrollTop ?? 0 };
    const windowWidth = window.innerWidth;
    // the keyboard focus goes into the enlarged stage ...
    head?.focus({ preventScroll: true });
    // ... and Tab stays in it: the rest of the page is covered
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !head) return;
      const items = Array.from(head.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.getClientRects().length > 0);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement instanceof HTMLElement ? items.indexOf(document.activeElement) : -1;
      const stop = tabStop(items.length, active, event.shiftKey);
      if (stop === null) return;
      event.preventDefault();
      items[stop].focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      page.classList.remove('mbot2-enlarged');
      if (column && column.scrollTop !== scrolled.column) column.scrollTop = scrolled.column;
      if (window.scrollY !== scrolled.page) window.scrollTo({ top: scrolled.page, behavior: 'instant' });
      // The window got another width while the stage was enlarged (a tablet was turned): the page
      // is laid out differently now, and the old scroll position shows some other part of it.
      // Bring the stage into view. (Otherwise nothing is scrolled: the stage is where it was.)
      if (window.innerWidth !== windowWidth) head?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      // Back at the normal size the focus is on the button that enlarges the stage again. (The
      // button is looked up only now: it stands in another place while the ruler is on, and the
      // ruler may have been switched on or off in the enlarged stage.)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      enlargeButtonRef.current?.focus({ preventScroll: true });
    };
  }, [isEnlarged]);

  // Escape undoes the smallest thing first: the last point of the ruler, then the enlarged
  // stage, then the ruler itself (see escapeAction in ./stage-view.ts).
  const rulerPoints = ruler.points.length;
  useEffect(() => {
    if (!rulerOn && !isEnlarged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // The key belongs to the stage only while the stage is being used: the focus is in it, or
      // nowhere. (In the block editor Escape closes the block palette and leaves a number field;
      // a window on top of the page takes the key for itself before it gets here.)
      const target = event.target;
      const onStage = isEnlarged || target === document.body || (target instanceof Node && stageHeadRef.current?.contains(target) === true);
      if (!onStage) return;
      const action = escapeAction({ rulerOn, rulerPoints, enlarged: isEnlarged });
      if (!action) return;
      event.preventDefault();
      if (action === 'remove-point') setRuler(removeLastRulerPoint);
      else if (action === 'shrink') setEnlarged(null);
      else {
        // The ruler's row goes away. If the focus is on something in it (Clear, the Enlarge
        // button), it goes to the Ruler button: it must not get lost with the row.
        if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.mbot2-ruler-row')) rulerButtonRef.current?.focus({ preventScroll: true });
        setRulerOn(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rulerOn, rulerPoints, isEnlarged]);

  // ------------------------------------------------------------------ match buttons
  const start = () => {
    setGhost(null);
    if (!sim.start()) {
      say('The block editor is still loading. Try again in a moment.', 'error');
      return;
    }
    replacedDuringMatch.current = false;
    // a program with nothing under its yellow block ends in the same moment: say why
    const program = getProgram();
    if (program && !hasRunnableScript(program)) {
      say(
        canLoadExamples
          ? 'Nothing to run yet: snap blocks under the yellow "when CyberPi starts up" block, or open one of the Examples.'
          : 'Nothing to run yet: snap blocks under the yellow "when CyberPi starts up" block, then press Start again.',
      );
    }
  };
  const reset = () => {
    setGhost(null);
    sim.reset();
  };

  // the first problem of a run opens the console, so that it is not missed
  const errorCount = useMemo(() => sim.logs.filter((line) => line.level === 'error').length, [sim.logs]);
  const hadErrors = useRef(false);
  useEffect(() => {
    if (errorCount > 0 && !hadErrors.current) setOpen((o) => ({ ...o, console: true }));
    hadErrors.current = errorCount > 0;
  }, [errorCount]);

  // ------------------------------------------------------------------ program buttons
  const replaceProgram = (program: ProgramJson, what: string): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    if (editor.blockCount() > 1 && !window.confirm(`Replace the blocks in your workspace with ${what}?\n(You can get them back with Undo.)`)) {
      return false;
    }
    if (!editor.loadProgram(program)) {
      say('This program could not be shown. Your blocks were not changed.', 'error');
      return false;
    }
    if (matchOn) replacedDuringMatch.current = true;
    return true;
  };

  const onNew = () => {
    replaceProgram(blankProgram(), 'a new, empty program');
  };

  const onExample = (example: ExampleProgram) => {
    if (replaceProgram(example.program, `the example "${example.title}"`)) say(`Example loaded: ${example.title}. Press Start to watch it.`);
  };

  const onOpenFile = (text: string, fileName: string) => {
    const parsed = parseProgramFile(text);
    if (!parsed.ok) {
      say(parsed.error, 'error');
      return;
    }
    if (!replaceProgram(parsed.program, `the program from "${fileName}"`)) return;
    // A program made in another game opens here too, but its blocks for parts this robot does
    // not have do not work: say so now, in plain words (and long enough to be read).
    const note = otherGameNote(parsed.program, parsed.game, game.id);
    if (note) say(`Opened ${fileName}. ${note}`, 'info', 12000);
    else say(`Opened ${fileName}.`);
  };

  const onSave = () => {
    const program = editorRef.current?.getProgram();
    if (!program) return;
    const blob = new Blob([serializeProgramFile(game.id, program)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = programFileName(game.id);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Program saved to your downloads.');
  };

  const selectBlock = useCallback(
    (blockId: string) => {
      if (!editorRef.current?.selectBlock(blockId)) say('That block is no longer in your workspace.', 'error');
    },
    [say],
  );

  // ------------------------------------------------------------------ derived texts
  const overlays = useMemo(() => game.overlays(scenario), [game, scenario]);
  const missions = snapshot.score.lines.filter((line) => line.max > 0 && line.id !== 'bonus');
  const missionsDone = missions.filter((line) => line.ok).length;
  const shownPose = ghost ?? sim.startPose;
  const toggleSection = (id: SectionId) => (value: boolean) => setOpen((o) => ({ ...o, [id]: value }));

  /** Open the score sheet and bring it into view. */
  const scoreSheetRef = useRef<HTMLDivElement>(null);
  const showScoreSheet = () => {
    // (the sheet is in the page, behind an enlarged stage)
    setEnlarged(null);
    setOpen((o) => ({ ...o, score: true }));
    requestAnimationFrame(() => scoreSheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const toggleView = (key: keyof StageOptions) => () => setView((v) => ({ ...v, [key]: !v[key] }));

  /**
   * The button that enlarges the stage (and shrinks it again). It has two places, and only one
   * at a time:
   *   'mat'  on the top right corner of the mat, like the full-screen button of a video. The rows
   *          around the mat have no room left for it, and it must not cost the mat any size.
   *   'row'  at the end of the ruler's row under the mat, while the ruler is on. A button on the
   *          mat would take the clicks and taps that are meant to set a point there (on a small
   *          phone it covered both squares of the building in that corner), so with the ruler on
   *          nothing lies on the mat at all.
   */
  const sizeLabel = isEnlarged ? 'Shrink' : 'Enlarge';
  const sizeButton = (place: 'mat' | 'row') => (
    <button
      ref={enlargeButtonRef}
      type="button"
      onClick={isEnlarged ? shrink : enlarge}
      aria-label={sizeLabel}
      title={sizeButtonHint({ rulerOn, rulerPoints, enlarged: isEnlarged })}
      className={
        place === 'mat'
          ? // small and tight in the corner: even on the smallest mat (17rem) it covers only the roof of the building there.
            // For a finger the area that answers is larger than the button looks (the "before:" classes).
            // (which corner: see `enlargeButtonCorner`)
            `absolute right-0.5 ${props.enlargeButtonCorner === 'bottom' ? 'bottom-0.5' : 'top-0.5'} inline-flex h-6 select-none items-center gap-1 rounded-lg bg-ink-950/80 px-2 text-xs font-bold text-white shadow-md ring-1 ring-inset ring-white/30 transition hover:bg-ink-950 pointer-coarse:before:absolute pointer-coarse:before:-inset-2 pointer-coarse:before:content-['']`
          : 'inline-flex h-9 min-w-9 shrink-0 select-none items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-ink-700 transition hover:bg-slate-50 active:bg-slate-100'
      }
    >
      {isEnlarged ? <ShrinkIcon className={place === 'mat' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : <EnlargeIcon className={place === 'mat' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {/* (in a narrow row only the picture is shown; the name of the button is still "Enlarge" / "Shrink") */}
      <span className={place === 'row' ? 'hidden @[30rem]:inline' : undefined}>{sizeLabel}</span>
    </button>
  );

  /** The small message of the simulator (see `say`). */
  const message = notice && (
    <p
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`max-w-xl rounded-card px-4 py-2.5 text-sm font-semibold text-white shadow-xl ${notice.tone === 'error' ? 'bg-rose-700' : 'bg-ink-900'}`}
    >
      {notice.text}
    </p>
  );

  return (
    <div className={`${PAGE_FRAME} text-ink-900`}>
      {/* ================================================================ title row (under the site header) */}
      <TitleBar title={props.title}>
        <button
          type="button"
          onClick={() => {
            hush();
            setBatchOpen(true);
          }}
          disabled={!editorReady}
          className={titleBarButton}
          title={words.batchHint}
        >
          <TestIcon className="h-4 w-4" />
          <span className="hidden md:inline">{`Test on many ${words.scenarios}`}</span>
          <span className="md:hidden">Test</span>
        </button>
        <div className="relative" ref={rules.ref}>
          <button type="button" onClick={() => rules.setOpen(!rules.open)} aria-expanded={rules.open} aria-haspopup="true" className={titleBarButton}>
            <RulesIcon className="h-4 w-4" />
            Rules
          </button>
          {rules.open && (
            <div
              role="region"
              aria-label="Rules in short"
              className="mbot2-rules-panel absolute right-0 top-full z-40 mt-2 w-[min(30rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card border border-slate-200 bg-white p-4 text-ink-800 shadow-2xl"
            >
              <p className="text-base font-bold text-ink-900">{props.title}: the rules in short</p>
              {props.rulesNote && <p className="mt-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold leading-snug text-amber-900">{props.rulesNote}</p>}
              {props.rules.map(rulesSection)}
              {/* what is not a rule gets its own heading, clearly apart from the rules above it */}
              {props.rulesExtra && (
                <div className="mt-4 border-t-2 border-slate-200 pt-3" data-rules-extra>
                  <p className="text-base font-bold text-ink-900">{props.rulesExtra.title}</p>
                  {props.rulesExtra.note && <p className="mt-1 rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold leading-snug text-sky-900">{props.rulesExtra.note}</p>}
                  {props.rulesExtra.sections.map(rulesSection)}
                </div>
              )}
            </div>
          )}
        </div>
      </TitleBar>

      {/* (the page's <main> is the website's own, in src/app/layout.tsx) */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ============================================================== blocks */}
        {/* (side by side, the blocks get all the width the stage column does not need: see .mbot2-stage-column in simulator.css) */}
        <section aria-label="Your program" className="relative flex h-[72dvh] min-h-[26rem] flex-col border-b border-slate-300 bg-white lg:h-auto lg:min-h-0 lg:min-w-0 lg:flex-1 lg:border-b-0 lg:border-r">
          <EditorToolbar
            ready={editorReady}
            canUndo={editorStatus.canUndo}
            canRedo={editorStatus.canRedo}
            blocks={editorStatus.blocks}
            examples={examples}
            onNew={onNew}
            onExample={onExample}
            onOpenFile={onOpenFile}
            onSave={onSave}
            onUndo={() => editorRef.current?.undo()}
            onRedo={() => editorRef.current?.redo()}
          />
          <div className="relative isolate min-h-0 flex-1">
            <BlocklyEditor
              storageKey={storageKey(game.id, 'workspace')}
              palette={game.id}
              initialProgram={blankProgram}
              mediaPath={BLOCKLY_MEDIA}
              onReady={onEditorReady}
              onStatus={setEditorStatus}
              onGripperCode={hasGripperBlocks ? showGripperCode : undefined}
            />
            {/* An empty workspace says how to begin. The note lies under the open block palette
                (which has z-index 20) and lets clicks and drags through; it goes away with the
                first block that is added. Its left edge clears the list of block groups. */}
            {editorReady && editorStatus.blocks <= 1 && (
              <p className="pointer-events-none absolute left-[10.75rem] right-10 top-28 z-10 max-w-sm text-sm leading-relaxed text-ink-500">
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
              </p>
            )}
          </div>
        </section>

        {/* ============================================================== stage */}
        <section
          aria-label="Stage"
          data-enlarged={isEnlarged ? '' : undefined}
          className="mbot2-stage-column relative flex min-h-0 flex-col gap-2 p-3 lg:shrink-0 lg:overflow-y-auto"
        >
          {/* while the stage covers the window, this keeps its room in the page free */}
          {enlarged && <div aria-hidden="true" className="shrink-0" style={{ height: enlarged.keep }} />}

          {/* The upper part of the stage: the part that "Enlarge" lays over the whole window (.mbot2-stage-head in simulator.css). */}
          <div
            ref={stageHeadRef}
            // (the scroll margins keep it clear of the site's sticky header when it is brought into view)
            className="mbot2-stage-head flex scroll-mb-3 scroll-mt-24 flex-col gap-2 lg:scroll-mt-3"
            data-enlarged={isEnlarged ? '' : undefined}
            data-ruler={rulerOn ? '' : undefined}
            role={isEnlarged ? 'dialog' : undefined}
            aria-modal={isEnlarged ? true : undefined}
            aria-label={isEnlarged ? 'The stage, enlarged' : undefined}
            tabIndex={isEnlarged ? -1 : undefined}
          >
          <ControlBar
            runState={runState}
            canStart={editorReady}
            timeLeft={snapshot.timeLeft}
            score={snapshot.score}
            restartPenalty={game.restartPenalty}
            restartRules={game.restartRules}
            restartsLeft={snapshot.restartsLeft}
            words={words}
            speed={sim.speed}
            onSpeed={sim.setSpeed}
            onStart={start}
            onStop={sim.stop}
            onPause={sim.pause}
            onResume={sim.resume}
            onRestart={sim.restart}
            onFinished={sim.declareFinished}
            onReset={reset}
          />

          <StatusLine
            runState={runState}
            finishReason={snapshot.finishReason}
            finishDetail={snapshot.finishDetail}
            score={snapshot.score}
            time={snapshot.time}
            restarts={snapshot.restarts}
            restartPenalty={game.restartPenalty}
            restartRules={game.restartRules}
            restartsLeft={snapshot.restartsLeft}
            words={words}
            timeText={timeText}
            readyHint={readyHint(startZoneName, rulerOn, isEnlarged)}
            placingProblem={placing && ghost ? `Not allowed: ${notAllowed.charAt(0).toLowerCase()}${notAllowed.slice(1)} It stays where it was.` : null}
            onShowSheet={showScoreSheet}
          />

          {/* as large as fits under the controls without scrolling: .mbot2-mat in simulator.css (the width of the column follows this size) */}
          {/* (.mbot2-mat-cell is no box of its own until the stage is enlarged) */}
          <div className="mbot2-mat-cell">
          <div className="mbot2-mat relative mx-auto aspect-square w-full">
            <StageCanvas
              simRef={sim.simRef as RefObject<Simulation<unknown>>}
              trail={sim.trail}
              subscribeFrame={sim.subscribeFrame}
              options={view}
              overlays={overlays}
              placing={placing}
              ghost={placing ? ghost : null}
              onPlace={onPlace}
              onRotate={onRotate}
              ruler={rulerOn ? ruler : null}
              onRuler={setRuler}
            />
            {/* (while the ruler is on, the button stands in the ruler's row instead: see sizeButton) */}
            {!rulerOn && sizeButton('mat')}
            {/* In the enlarged stage a message of the simulator is shown on the lower edge of the mat:
                at the bottom of the window it would lie on the buttons under the mat. */}
            {/* (where the "Enlarge" button lies on the lower edge, the message is shown on the upper edge: see `enlargeButtonCorner`) */}
            {isEnlarged && message && (
              <div className={`pointer-events-none absolute inset-x-0 ${props.enlargeButtonCorner === 'bottom' ? 'top-3' : 'bottom-3'} z-10 flex justify-center px-3`}>{message}</div>
            )}
          </div>
          </div>

          {/* The measurement of the ruler as text: for screen readers, for copying, and because the numbers on a small mat are hard to read. */}
          {/* (The row measures its own width: the button at its end shows its name only where there is room.) */}
          {rulerOn && (
            <div className="mbot2-ruler-row @container flex items-start gap-2">
              <div className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 py-0.5 pl-2.5 pr-1 text-xs leading-tight text-ink-900">
                {/* A long measurement does not make the row taller and push the buttons below it out of
                    the window: it scrolls inside the row (.mbot2-ruler-text in simulator.css). From two
                    points on, the text can be reached with the Tab key, so that it can be scrolled with
                    the keyboard too. */}
                <p ref={rulerTextRef} aria-live="polite" tabIndex={rulerPoints >= 2 ? 0 : undefined} className="mbot2-ruler-text min-w-0 flex-1 font-medium tabular-nums">
                  <span className="sr-only">Ruler: </span>
                  {rulerReading}
                </p>
                <button
                  type="button"
                  onClick={() => setRuler(EMPTY_RULER)}
                  disabled={rulerPoints === 0}
                  className="inline-flex h-7 shrink-0 select-none items-center rounded-md border border-orange-300 bg-white px-2 text-xs font-semibold text-ink-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Remove the measurement (the Esc key removes only the last point)"
                >
                  Clear
                </button>
              </div>
              {sizeButton('row')}
            </div>
          )}

          {/* what to show on the stage, and where the robot starts */}
          {/* (the row measures its own width: see VIEW_ICON) */}
          <div className="@container">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Show on the stage">
              <button type="button" aria-pressed={view.overlays} onClick={toggleView('overlays')} className={toggleClass(view.overlays)} title={words.zonesHint}>
                <ZonesIcon className={VIEW_ICON} />
                Zones
              </button>
              <button type="button" aria-pressed={view.sensors} onClick={toggleView('sensors')} className={toggleClass(view.sensors)} title={sensorsViewHint(parts)}>
                <SensorsIcon className={VIEW_ICON} />
                Sensors
              </button>
              <button type="button" aria-pressed={view.trail} onClick={toggleView('trail')} className={toggleClass(view.trail)} title="Draw the path the robot has driven">
                <TrailIcon className={VIEW_ICON} />
                Path
              </button>
              <button
                ref={rulerButtonRef}
                type="button"
                aria-pressed={rulerOn}
                onClick={() => setRulerOn(!rulerOn)}
                className={toggleClass(rulerOn)}
                title="Measure on the mat: click points to see the distances in cm and the turns between them"
              >
                <RulerIcon className={VIEW_ICON} />
                Ruler
              </button>
            </div>

            {/* during a match the robot cannot be placed any more: its two buttons take that spot, so that
                "when button A pressed" programs can be started while watching the stage */}
            {matchOn && (
              <div className="ml-auto flex items-center gap-1.5" role="group" aria-label="CyberPi buttons">
                <span className="text-xs font-semibold text-ink-600" title="Hold a button down to press it on the robot. The joystick is in the CyberPi panel below.">
                  CyberPi
                </span>
                <HoldButton name="a" label="Button A" onButton={sim.setButton} className="h-9 w-9 rounded-full text-sm">
                  A
                </HoldButton>
                <HoldButton name="b" label="Button B" onButton={sim.setButton} className="h-9 w-9 rounded-full text-sm">
                  B
                </HoldButton>
              </div>
            )}

            <div className={matchOn ? 'hidden' : 'ml-auto flex items-center gap-1.5'} role="group" aria-label="Robot start position">
              <span className="font-mono text-xs tabular-nums text-ink-600" title="Direction the robot faces: 0° = up the mat, 90° = to the right">
                {headingDegrees(shownPose.heading)}°
              </span>
              <button type="button" onClick={() => onRotate(-rotateStep)} disabled={!placing} className={button.icon} aria-label={`Turn the robot ${rotateStep} degrees to the left`} title="Turn left (the mouse wheel on the robot turns it too)">
                <RotateLeftIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onRotate(rotateStep)} disabled={!placing} className={button.icon} aria-label={`Turn the robot ${rotateStep} degrees to the right`} title="Turn right (the mouse wheel on the robot turns it too)">
                <RotateRightIcon className="h-4 w-4" />
              </button>
              <label className="sr-only" htmlFor="rotate-step">
                Turning step
              </label>
              <select
                id="rotate-step"
                value={rotateStep}
                disabled={!placing}
                onChange={(event) => setRotateStep(Number(event.target.value))}
                className="h-9 rounded-lg border border-slate-300 bg-white px-1.5 text-xs font-semibold text-ink-700 disabled:opacity-40"
                title="How far one press turns the robot"
              >
                {ROTATE_STEPS.map((step) => (
                  <option key={step} value={step}>
                    {step}°
                  </option>
                ))}
              </select>
              <button type="button" onClick={centreRobot} disabled={!placing} className={button.icon} aria-label={homeWords.label} title={homeWords.hint}>
                <CentreIcon className="h-4 w-4" />
              </button>
            </div>

          </div>
          </div>
          </div>

          {/* (stacked, the page itself scrolls to the sheet: keep it clear of the site's sticky header) */}
          <div ref={scoreSheetRef} className="scroll-mb-3 scroll-mt-24 lg:scroll-mt-3">
          <Section
            title="Score sheet"
            summary={`${snapshot.score.total} / ${snapshot.score.max} points · ${missionsDone} of ${missions.length} ${words.goals}`}
            open={open.score}
            onToggle={toggleSection('score')}
          >
            <ScoreSheet score={snapshot.score} words={words} />
          </Section>
          </div>

          <Section title={words.scenarioTitle} summary={<span className="font-mono">{game.encodeScenario(scenario)}</span>} open={open.combination} onToggle={toggleSection('combination')}>
            <CombinationPanel game={game} scenario={scenario} onChange={changeScenario} words={words} readCode={props.readCode}>
              {props.renderCombinationEditor(scenario, changeScenario)}
            </CombinationPanel>
          </Section>

          <Section
            title="Sensors"
            summary={sensorSummary(parts, snapshot.sensors)}
            open={open.sensors}
            onToggle={toggleSection('sensors')}
          >
            <SensorDashboard snapshot={snapshot} robotConfig={robotConfig} />
            <p className="mt-2 text-xs text-ink-500">
              {sim.realMat
                ? 'The line sensor reads the real picture of the mat, illustrations included.'
                : 'The line sensor reads a simplified drawing of the mat (the real picture is still loading).'}
            </p>
          </Section>

          <Section title="CyberPi" summary="screen, LEDs, buttons A / B, joystick" open={open.cyberpi} onToggle={toggleSection('cyberpi')}>
            <CyberPiPanel
              lines={snapshot.screenLines}
              labels={snapshot.screenLabels}
              leds={snapshot.leds}
              onButton={sim.setButton}
              soundOn={sim.soundOn}
              onSound={sim.setSoundOn}
            />
          </Section>

          <Section
            title="Console"
            summary={
              errorCount > 0 ? (
                <span className="font-bold text-rose-700">
                  {errorCount} problem{errorCount === 1 ? '' : 's'}
                </span>
              ) : (
                `${sim.logs.length} message${sim.logs.length === 1 ? '' : 's'}`
              )
            }
            open={open.console}
            onToggle={toggleSection('console')}
          >
            <ConsolePanel logs={sim.logs} onClear={sim.clearLogs} onSelectBlock={selectBlock} timeText={timeText} />
          </Section>
        </section>
      </div>

      {/* ================================================================ floating message */}
      {/* (it lets clicks through: a message must never be in the way of a button below it) */}
      {/* (side by side, it sits at the bottom of the block workspace, where it covers no button of the stage) */}
      {/* (while the stage is enlarged, the message is shown on the mat instead: see above) */}
      {message && !isEnlarged && <div className="mbot2-toast pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-3">{message}</div>}

      {batchOpen && (
        <BatchDialog
          game={game}
          robotConfig={robotConfig}
          getProgram={getProgram}
          startPose={sim.startPose}
          getSampler={sim.getSampler}
          currentScenario={scenario}
          presets={props.batchPresets}
          random={props.batchRandom}
          words={words}
          onPick={(picked) => {
            setBatchOpen(false);
            changeScenario(picked);
            say(`${capital(words.scenario)} loaded. Press Start to watch your program on it.`);
          }}
          onClose={() => setBatchOpen(false)}
        />
      )}

      {hasGripperBlocks && gripperCode && (
        <GripperCodeDialog
          robotConfig={robotConfig}
          at={gripperCode.at}
          getEditor={() => editorRef.current}
          mediaPath={BLOCKLY_MEDIA}
          onConverted={() => {
            // (as after New / Examples / Open: the robot still runs the blocks it was started with)
            if (matchOn) replacedDuringMatch.current = true;
          }}
          onClose={() => setGripperCode(null)}
        />
      )}
    </div>
  );
}
