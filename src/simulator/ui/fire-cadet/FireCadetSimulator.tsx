'use client';

/**
 * The Fire Cadet simulator (MakeX Lebanon, Season 2027, ages 4 to 7, the Makeblock mTiny): a
 * screen of its own (design 7), not the general block screen (../SimulatorApp.tsx), for children
 * who mostly cannot read yet and their teachers:
 *
 *   - Junior (ages 6-7) lays a row of coding cards after the yellow start card; the big round
 *     button runs it. Mini (ages 4-5) drives the robot with taps on the four arrow cards of the
 *     yellow direction panel.
 *   - Pictures first, every control a child uses at least 48 x 48 px, few plain words, and one
 *     sentence in the banner that says what just happened or what to do next.
 *   - The match is the game's own (../../fire-cadet/game.ts): the same engine, interpreters and
 *     referee as the tests. The banner shows the referee's own sentences, the score sheet the
 *     referee's own lines.
 *
 * Its parts: MatchBar.tsx (clock, points, speed, mode switch), GoButton.tsx, CardRow.tsx (row,
 * buttons, card box), DirectionPanel.tsx, ScoreStrip.tsx, Banner.tsx, PlanningClock.tsx,
 * MapPicker.tsx, MapEditor.tsx, RulesWindow.tsx; the stage's drawings in paint.ts; every word in
 * words.ts (and rules.ts); the sizes and the layout in fire-cadet.css.
 *
 * As in every game, nothing about the examples is in this file or anything it imports - no
 * program, no description, no title: they come from the server (/api/simulator/unlock).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Pose, ProgramJson, Simulation } from '../../core/types';
import { PANEL_BUTTONS, cardRowProgram, panelProgram, type MoveCard, type RowProblem } from '../../fire-cadet/cards';
import { fireCadetGame } from '../../fire-cadet/game';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { MTINY_ROBOT, START_POSE } from '../../fire-cadet/robot';
import type { FireCadetScenario } from '../../fire-cadet/scenario';
import { RulesIcon } from '../icons';
import { PAGE_FRAME } from '../page-frame';
import { ScoreSheet } from '../ScoreSheet';
import { scoreSheetSummary, screenWords } from '../screen-words';
import { StageCanvas } from '../StageCanvas';
import { loadJson, saveJson, storageKey } from '../storage';
import { TitleBar, titleBarButton } from '../TitleBar';
import { useSimulation } from '../useSimulation';
import { Section } from '../widgets';
import { NOTE_SECONDS, REFUSAL_SECONDS, bannerSentence, stillShown, type TimedText } from './banner';
import { Banner } from './Banner';
import { replaceRow, rowOf, type RowState } from './card-row';
import { CardRow } from './CardRow';
import { DirectionPanel } from './DirectionPanel';
import { GoButton, goFace } from './GoButton';
import { GAME_ID, exampleToLoad, mapCode, mapNote, readSavedRow, readSettings, savedRow, savedSettings, type ScreenSettings } from './map-code';
import { MapEditor } from './MapEditor';
import { MapPicker } from './MapPicker';
import { MatchClock, MatchPoints, ModeSwitch, SpeedButtons } from './MatchBar';
import { cadetPainters } from './paint';
import { PlanningClock } from './PlanningClock';
import { planningIdle, planningUnderSheet, pressPlanningButton, stopPlanning, type PlanningClock as PlanningState } from './planning-clock';
import { RulesWindow } from './RulesWindow';
import { ScoreStrip } from './ScoreStrip';
import { CADET_SHEET_WORDS, CADET_WORDS, fieldInWords, type PlayMode } from './words';
// The screen's own stylesheet travels with the screen (as ../simulator.css does with the general one).
import './fire-cadet.css';

/** A tap on the panel holds the engine's button down for at least this many ticks (design 7.5): a tap shorter than one frame is not lost. */
export const TAP_TICKS = 3;

/** The words of the score sheet of this game. */
const SHEET_WORDS = screenWords(CADET_SHEET_WORDS);

/** The stage draws no zones, no sensors (the mTiny has none here), and the path the robot drove. */
const STAGE_OPTIONS = { overlays: false, sensors: false, trail: true } as const;
const NO_ZONES: never[] = [];
const nothing = (): void => undefined;

/** A button of the title row, at least 48 px high (the general look is a little smaller). */
const TITLE_BUTTON = `${titleBarButton} min-h-12 min-w-12 justify-center`;

/** The places in the row of the running move card and its number card, read from the interpreter's ids ('card-3'). */
function runningCards(ids: readonly string[]): { card: number; numberCard: number | null } | null {
  const places = ids
    .map((id) => /^card-(\d+)$/.exec(id))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  if (places.length === 0) return null;
  return { card: Math.min(...places), numberCard: places.length > 1 ? Math.max(...places) : null };
}

/** The running move of the panel and the tap kept for after it, from the interpreter's ids ('panel-forward', 'panel-next-left'). */
function panelMoves(ids: readonly string[]): { current: MoveCard | null; waiting: MoveCard | null } {
  let current: MoveCard | null = null;
  let waiting: MoveCard | null = null;
  for (const id of ids) {
    const next = /^panel-next-(forward|backward|left|right)$/.exec(id);
    if (next) waiting = next[1] as MoveCard;
    const now = /^panel-(forward|backward|left|right)$/.exec(id);
    if (now) current = now[1] as MoveCard;
  }
  return { current, waiting };
}

export default function FireCadetSimulator() {
  // ---- what the browser remembers (read once, on the first render)
  const [saved] = useState(() => ({
    settings: readSettings(loadJson(storageKey(GAME_ID, 'settings'), (value): value is unknown => true)),
    cards: readSavedRow(loadJson(storageKey(GAME_ID, 'workspace'), (value): value is unknown => true)),
  }));
  const [scenario, setScenario] = useState<FireCadetScenario>(saved.settings.scenario);
  const [mode, setMode] = useState<PlayMode>(saved.settings.mode);
  const [speed, setSpeed] = useState<ScreenSettings['speed']>(saved.settings.speed);
  const [open, setOpen] = useState(saved.settings.open);
  const [row, setRow] = useState<RowState>(() => rowOf(saved.cards));

  // ---- what the screen says for a few seconds, and what a screen reader hears after a change of the row
  const [refusal, setRefusal] = useState<TimedText | null>(null);
  const [refusals, setRefusals] = useState(0);
  const [note, setNote] = useState<TimedText | null>(null);
  const [said, setSaid] = useState('');
  const [, redraw] = useState(0);

  const [planning, setPlanning] = useState<PlanningState>(planningIdle);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  /** the last move card that ran in this match (for the paler cards after the end), or -1 */
  const [lastRan, setLastRan] = useState(-1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fieldWords, setFieldWords] = useState('');

  // the program a press of GO starts: the row (Junior) or the panel (Mini)
  const programRef = useRef<ProgramJson>(cardRowProgram(saved.cards));
  useEffect(() => {
    programRef.current = mode === 'panel' ? panelProgram() : cardRowProgram(row.cards);
  }, [mode, row.cards]);

  const onActiveBlocks = useCallback((ids: string[]) => {
    setActiveIds(ids);
    const running = runningCards(ids);
    if (running) setLastRan((last) => Math.max(last, running.card));
  }, []);

  const sim = useSimulation<FireCadetScenario>({
    game: fireCadetGame,
    robotConfig: MTINY_ROBOT,
    scenario,
    initialStartPose: START_POSE,
    getProgram: () => programRef.current,
    onActiveBlocks,
    matchWord: 'match',
    scenarioWord: 'map',
  });
  const { snapshot } = sim;
  const face = goFace(snapshot.runState);
  const during = face === 'stop';

  // ---- remember the settings and the row
  useEffect(() => {
    saveJson(storageKey(GAME_ID, 'settings'), savedSettings({ scenario, mode, speed, open }));
  }, [scenario, mode, speed, open]);
  useEffect(() => {
    saveJson(storageKey(GAME_ID, 'workspace'), savedRow(row.cards));
  }, [row.cards]);

  // ---- the speed: Junior chooses, Mini always plays at 1x (N8)
  const { setSpeed: setSimSpeed } = sim;
  useEffect(() => {
    setSimSpeed(mode === 'panel' ? 1 : speed);
  }, [mode, speed, setSimSpeed]);

  // ---- a sentence of the screen goes away when its time is over
  useEffect(() => {
    const until = Math.max(refusal?.until ?? 0, note?.until ?? 0);
    const wait = until - Date.now();
    if (wait <= 0) return;
    const timer = window.setTimeout(() => redraw((n) => n + 1), wait + 20);
    return () => window.clearTimeout(timer);
  }, [refusal, note]);
  const showNote = useCallback((text: string) => setNote({ text, until: Date.now() + NOTE_SECONDS * 1000 }), []);
  const showRefusal = useCallback((problem: RowProblem) => {
    setRefusal({ text: CADET_WORDS.refusals[problem], until: Date.now() + REFUSAL_SECONDS * 1000 });
    setRefusals((n) => n + 1);
    setNote(null);
  }, []);

  // ---- the field in words, for a screen reader: renewed each time the robot comes to rest
  const lastPose = useRef<Pose | null>(null);
  const { simRef } = sim;
  useEffect(() => {
    const pose = snapshot.pose;
    const before = lastPose.current;
    lastPose.current = pose;
    const atRest = snapshot.runState !== 'running' || (before !== null && before.x === pose.x && before.y === pose.y && before.heading === pose.heading);
    if (atRest) setFieldWords(fieldInWords(simRef.current.world, scenario));
  }, [snapshot, scenario, simRef]);

  // ---- the direction panel: a tap holds the engine's button down for at least TAP_TICKS
  const holds = useRef(new Map<MoveCard, { tick: number; released: boolean }>());
  const { setButton, subscribeFrame } = sim;
  const releaseDue = useCallback(() => {
    const tick = simRef.current.world.tick;
    for (const [move, hold] of holds.current) {
      if (hold.released && tick >= hold.tick + TAP_TICKS) {
        setButton(PANEL_BUTTONS[move], false);
        holds.current.delete(move);
      }
    }
  }, [setButton, simRef]);
  useEffect(() => subscribeFrame(() => holds.current.size > 0 && releaseDue()), [subscribeFrame, releaseDue]);
  const liveRef = useRef(false);
  liveRef.current = during && mode === 'panel';
  const onTap = useCallback(
    (move: MoveCard, down: boolean) => {
      if (down) {
        if (!liveRef.current || holds.current.has(move)) return;
        setButton(PANEL_BUTTONS[move], true);
        holds.current.set(move, { tick: simRef.current.world.tick, released: false });
      } else {
        const hold = holds.current.get(move);
        if (!hold) return;
        hold.released = true;
        releaseDue();
      }
    },
    [releaseDue, setButton, simRef],
  );
  // the arrow keys are the four cards during a Mini match (not in a text field or a window; a key held down counts once)
  useEffect(() => {
    if (mode !== 'panel' || !during) return;
    const keyMove: Record<string, MoveCard> = { ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'left', ArrowRight: 'right' };
    const elsewhere = (target: EventTarget | null) =>
      target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') !== null;
    const onDown = (event: KeyboardEvent) => {
      const move = keyMove[event.key];
      if (!move || event.altKey || event.ctrlKey || event.metaKey || elsewhere(event.target)) return;
      // (the page does not scroll)
      event.preventDefault();
      if (!event.repeat) onTap(move, true);
    };
    const onUp = (event: KeyboardEvent) => {
      const move = keyMove[event.key];
      if (move) onTap(move, false);
    };
    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
    };
  }, [mode, during, onTap]);

  // ---- the round button
  const { start, declareFinished, reset } = sim;
  const freshMatch = () => {
    holds.current.clear();
    setLastRan(-1);
    setActiveIds([]);
  };
  const onGo = () => {
    if (face === 'go') {
      if (mode === 'cards' && row.cards.length === 0) {
        showNote(CADET_WORDS.notes.addFirst);
        return;
      }
      // pressing GO also stops a running planning clock (design 7.10)
      setPlanning((clock) => stopPlanning(clock, Date.now()));
      setRow((r) => ({ ...r, selected: null }));
      setNote(null);
      setRefusal(null);
      freshMatch();
      start();
    } else if (face === 'stop') {
      declareFinished();
    } else {
      freshMatch();
      reset();
    }
  };

  // ---- the map, the way to play
  const putMap = (next: FireCadetScenario, words: string = mapNote(next)) => {
    if (during) return;
    // (the same map again: everything goes back to the start all the same)
    if (next === scenario) reset();
    freshMatch();
    setScenario(next);
    showNote(words);
  };
  const changeMode = (next: PlayMode) => {
    if (during || next === mode) return;
    // switching puts the field back to the start
    if (face === 'again') reset();
    freshMatch();
    setMode(next);
    setNote(null);
    setRefusal(null);
  };

  /**
   * Loading an example (design 7.12) - for the Examples button, which the next package wires once
   * 'fire-cadet' is an ExamplesGame (see EXAMPLES_BUTTON below): its cards with readCards and its
   * map with readMapCode (exampleToLoad); Junior; that map, if its code reads; the cards as one
   * step of Undo; the banner says so. (The window closes itself: ExamplesDialog's onLoad.)
   */
  const loadExample = (program: ProgramJson) => {
    const example = exampleToLoad(program);
    if (face !== 'go') reset();
    freshMatch();
    setMode('cards');
    if (example.scenario !== null) setScenario(example.scenario);
    setRow((r) => replaceRow(r, example.cards));
    setRefusal(null);
    showNote(CADET_WORDS.notes.example);
  };
  void loadExample;

  /**
   * EXAMPLES_BUTTON - the typed place of the Examples button in the title row. It stays empty
   * until 'fire-cadet' is in EXAMPLES_GAMES (../member-unlock.ts, WP3): before that,
   * useMemberExamples({ game: 'fire-cadet' }) does not type-check. Then it becomes:
   *   const examples = useMemberExamples(EXAMPLES);   // { unlockUrl: '/api/simulator/unlock', game: GAME_ID, organisation: 'MakeX Lebanon' }
   *   a button (TITLE_BUTTON, ExamplesIcon, CADET_WORDS.examplesButton) that opens
   *   <ExamplesDialog examples={examples} howLoadingWorks={CADET_WORDS.howLoadingWorks}
   *     onLoad={(example) => { loadExample(example.program); close(); }} onClose={close} />
   */
  const EXAMPLES_BUTTON: ReactNode = null;

  // ---- what the screen shows
  const painters = useMemo(() => cadetPainters(scenario), [scenario]);
  const now = Date.now();
  const refusalNow = stillShown(refusal, now);
  const banner = bannerSentence({
    mode,
    runState: snapshot.runState,
    finishReason: snapshot.finishReason,
    score: snapshot.score,
    time: snapshot.time,
    rowLength: row.cards.length,
    refusal: refusalNow,
    note: stillShown(note, now),
  });
  const tone = mode === 'cards' && refusalNow ? 'refused' : during ? 'match' : face === 'again' ? 'end' : 'calm';
  const running = during && mode === 'cards' ? runningCards(activeIds) : null;
  const doneBefore =
    running !== null ? running.card : face === 'again' ? (snapshot.finishReason === 'program-ended' ? row.cards.length : Math.max(0, lastRan)) : 0;
  const variables = snapshot.variables;
  const panel = panelMoves(during ? activeIds : []);
  const goals = snapshot.score.lines.filter((line) => line.max > 0);
  const underSheet = mode === 'cards' ? planningUnderSheet(planning) : null;

  return (
    <div className={`${PAGE_FRAME} cadet-app text-ink-900`} data-mode={mode}>
      <TitleBar title="Fire Cadet" robot="mTiny">
        {EXAMPLES_BUTTON}
        <button type="button" onClick={() => setRulesOpen(true)} aria-haspopup="dialog" className={TITLE_BUTTON}>
          <RulesIcon className="h-4 w-4" />
          {CADET_WORDS.rulesButton}
        </button>
      </TitleBar>

      <div className="cadet-screen">
        <div className="cadet-mode">
          <ModeSwitch mode={mode} onMode={changeMode} locked={during} />
        </div>

        <div className="cadet-stage-block">
          <MatchClock timeLeft={snapshot.timeLeft} className="cadet-clock" />
          <Banner sentence={banner} tone={tone} />
          <MatchPoints total={snapshot.score.total} max={snapshot.score.max} className="cadet-points" />
          <div className="cadet-stage">
            <StageCanvas
              simRef={simRef as unknown as RefObject<Simulation<unknown>>}
              trail={sim.trail}
              subscribeFrame={subscribeFrame}
              options={STAGE_OPTIONS}
              overlays={NO_ZONES}
              placing={false}
              ghost={null}
              onPlace={nothing}
              onRotate={nothing}
              ruler={null}
              onRuler={nothing}
              margin={FIRE_CADET.TABLE_MARGIN}
              painters={painters}
            />
          </div>
          {/* the field in words, right after the stage (the canvas cannot be given a description of its own: see the report of WP4) */}
          <p className="sr-only" data-field-words>
            {fieldWords}
          </p>
        </div>

        <div className="cadet-work">
          {mode === 'cards' ? (
            <>
              <CardRow
                row={row}
                onEdit={(next, line) => {
                  setRow(next);
                  setSaid(line);
                  // (a tap that was done: the sentence about a refused one is old news)
                  setRefusal(null);
                  if (next.cards !== row.cards) setLastRan(-1);
                }}
                onRefused={showRefusal}
                onEmptied={() => showNote(CADET_WORDS.notes.emptied)}
                locked={during}
                running={running}
                nth={typeof variables.nth === 'number' ? variables.nth : 0}
                times={typeof variables.times === 'number' ? variables.times : 0}
                doneBefore={doneBefore}
                refusal={refusalNow}
                refusals={refusals}
                said={said}
              />
              <ScoreStrip score={snapshot.score} className="lg:hidden" />
              <PlanningClock clock={planning} onPress={() => setPlanning((clock) => pressPlanningButton(clock, Date.now()))} />
            </>
          ) : (
            <>
              <DirectionPanel live={during} current={panel.current} waiting={panel.waiting} onTap={onTap} />
              <ScoreStrip score={snapshot.score} className="lg:hidden" />
            </>
          )}
        </div>

        <div className="cadet-sections">
          <ScoreStrip score={snapshot.score} className="max-lg:hidden" />
          <Section title={CADET_WORDS.map.title} summary={mapCode(scenario)} open={open.map} onToggle={(map) => setOpen((o) => ({ ...o, map }))}>
            <MapPicker scenario={scenario} onScenario={(next) => putMap(next)} onOwnMap={() => setEditorOpen(true)} locked={during} />
          </Section>
          <Section
            title={CADET_WORDS.score.sheet(mode)}
            summary={scoreSheetSummary(snapshot.score, goals.filter((line) => line.ok).length, goals.length, SHEET_WORDS)}
            open={open.score}
            onToggle={(score) => setOpen((o) => ({ ...o, score }))}
          >
            <ScoreSheet score={snapshot.score} words={SHEET_WORDS} />
            {underSheet !== null && <p className="mt-2 text-xs font-semibold text-ink-700">{underSheet}</p>}
          </Section>
        </div>

        <div className="cadet-bar">
          {mode === 'cards' ? <SpeedButtons speed={speed} onSpeed={setSpeed} /> : <span />}
          <GoButton face={face} mode={mode} onPress={onGo} />
        </div>
      </div>

      {editorOpen && (
        <MapEditor
          scenario={scenario}
          onClose={() => setEditorOpen(false)}
          onUse={(next) => {
            setEditorOpen(false);
            putMap(next);
          }}
        />
      )}
      {rulesOpen && <RulesWindow onClose={() => setRulesOpen(false)} />}
    </div>
  );
}
