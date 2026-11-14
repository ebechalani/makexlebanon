'use client';

/**
 * "Test on many combinations": run the current program on a whole list of starting
 * arrangements without drawing anything, and show how often each mission succeeds.
 *
 * Every match is played by the same engine, interpreter and referee as the match on the stage
 * (core/batch.ts runMatch). The matches run in short slices with a pause in between, so the
 * page keeps reacting: the progress bar moves and "Cancel" works.
 *
 * The window is the same for every game. What differs comes from the game:
 *   - its words (./screen-words.ts): Fire Chief tests "mazes", not "combinations";
 *   - its ready-made lists (`presets`) and, if it wants, its own way to draw the random lists
 *     (`random`);
 *   - a game whose referee writes times down (Game.createReferee) gets, for every run, the time
 *     at which its points were reached - a ranking by time uses it - and the referee's own
 *     sentence about the end (./batch-words.ts). Fire Rescue has no such referee: its table
 *     shows the time of the end and the reason, as it always did.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runMatch, summarize, type BatchResult } from '../core/batch';
import { makeRng } from '../core/geometry';
import type { Game, MatSampler, Pose, ProgramJson, RobotConfig } from '../core/types';
import { bestAndWorst, compareRuns, endSentence, scoreTimeText } from './batch-words';
import { finishText, timeTextOf } from './format';
import { DiceIcon, TestIcon } from './icons';
import { capital, DEFAULT_WORDS, type ScreenWords } from './screen-words';
import { button, Modal } from './widgets';

/** A ready-made list of combinations offered next to the random draws. */
export interface BatchPreset<S> {
  id: string;
  label: string;
  /** one sentence under the choice */
  hint: string;
  /** the combinations to play; `current` is the combination on the stage */
  scenarios: (current: S) => S[];
  /**
   * One more sentence for the combination that is on the stage right now, shown while this list
   * is chosen - or null when there is nothing to add. (Fire Chief: the maze on the stage is one
   * for practice only.)
   */
  note?: (current: S) => string | null;
}

/** How a game draws its random lists, when it does not leave everything to chance. */
export interface BatchRandom<S> {
  /** `count` different combinations - the same list every time for the same seed */
  draw: (count: number, seed: number) => S[];
  /** one sentence about these lists, shown while one of them is chosen */
  note?: string;
}

export interface BatchDialogProps<S> {
  game: Game<S>;
  robotConfig: RobotConfig;
  /** the blocks as they are right now (null while the editor is loading) */
  getProgram: () => ProgramJson | null;
  startPose: Pose;
  getSampler: () => MatSampler | undefined;
  currentScenario: S;
  presets?: BatchPreset<S>[];
  /** the game's own random lists (left out: `count` draws of game.randomScenario) */
  random?: BatchRandom<S>;
  /** the game's words (left out: the words of Fire Rescue) */
  words?: ScreenWords;
  /** the student wants to watch this combination on the stage */
  onPick: (scenario: S) => void;
  onClose: () => void;
}

interface Row<S> {
  index: number;
  scenario: S;
  result: BatchResult;
}

const RANDOM_COUNTS = [10, 50, 200] as const;
/** Work for about this long, then give the page a turn (ms). */
const SLICE_MS = 30;

/** `count` different combinations, the same list every time for the same seed. */
function drawCombinations<S>(game: Game<S>, count: number, seed: number): S[] {
  const rng = makeRng(seed);
  const wanted = Math.min(count, game.scenarioCount());
  const seen = new Set<string>();
  const out: S[] = [];
  for (let tries = 0; out.length < wanted && tries < wanted * 50 + 100; tries++) {
    const scenario = game.randomScenario(rng);
    const code = game.encodeScenario(scenario);
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(scenario);
  }
  return out;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="text-2xl font-semibold text-ink-900">{value}</p>
      {note && <p className="text-xs text-ink-500">{note}</p>}
    </div>
  );
}

export function BatchDialog<S>(props: BatchDialogProps<S>) {
  const { game, robotConfig, getProgram, startPose, getSampler, currentScenario, presets = [], random, words = DEFAULT_WORDS, onPick, onClose } = props;

  const [choice, setChoice] = useState<string>('random-50');
  const [seed, setSeed] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'cancelled'>('idle');
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row<S>[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [worstFirst, setWorstFirst] = useState(false);

  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // closing the window stops a run in progress
  useEffect(
    () => () => {
      cancelRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const run = useCallback(() => {
    const program = getProgram();
    if (!program) {
      setProblem('The block editor is still loading. Try again in a moment.');
      return;
    }
    let scenarios: S[];
    const preset = presets.find((p) => p.id === choice);
    if (preset) scenarios = preset.scenarios(currentScenario);
    else {
      const count = Number(choice.replace('random-', '')) || 10;
      scenarios = random ? random.draw(count, seed) : drawCombinations(game, count, seed);
    }
    if (scenarios.length === 0) {
      setProblem(`There is no ${words.scenario} to test.`);
      return;
    }

    const sampler = getSampler();
    const collected: Row<S>[] = [];
    cancelRef.current = false;
    setProblem(null);
    setRows([]);
    setTotal(scenarios.length);
    setPhase('running');

    const slice = () => {
      timerRef.current = null;
      if (cancelRef.current) {
        setPhase('cancelled');
        return;
      }
      const sliceStart = performance.now();
      try {
        // at least one match per slice, then as many as fit into the slice
        do {
          const index = collected.length;
          const result = runMatch({ game, scenario: scenarios[index], robotConfig, program, startPose, sampler, seed: seed + index });
          collected.push({ index, scenario: scenarios[index], result });
        } while (collected.length < scenarios.length && performance.now() - sliceStart < SLICE_MS);
      } catch (err) {
        setProblem(`The test stopped: ${err instanceof Error ? err.message : String(err)}`);
        setRows([...collected]);
        setPhase('cancelled');
        return;
      }
      setRows([...collected]);
      if (collected.length >= scenarios.length) setPhase('done');
      else timerRef.current = setTimeout(slice, 0);
    };
    timerRef.current = setTimeout(slice, 0);
  }, [choice, currentScenario, game, getProgram, getSampler, presets, random, robotConfig, seed, startPose, words]);

  const cancel = () => {
    cancelRef.current = true;
  };

  const summary = useMemo(() => summarize(rows.map((row) => row.result)), [rows]);
  const penaltyIds = useMemo(() => new Set((rows[0]?.result.lines ?? []).filter((l) => l.max === 0).map((l) => l.id)), [rows]);
  // A game whose referee writes times down ranks by the points and then by the time they were
  // reached: its results show that time and the referee's own words about the end.
  const refereeTimes = game.createReferee !== undefined;
  const shownRows = useMemo(() => {
    if (!worstFirst) return rows;
    // (worst first: fewest points; where the time ranks too, the later time among equal points)
    if (refereeTimes) return [...rows].sort((a, b) => compareRuns(b.result, a.result) || a.index - b.index);
    return [...rows].sort((a, b) => a.result.total - b.result.total || a.index - b.index);
  }, [rows, worstFirst, refereeTimes]);
  const extremes = useMemo(() => (refereeTimes ? bestAndWorst(rows.map((row) => row.result)) : null), [rows, refereeTimes]);
  const programErrors = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) for (const e of row.result.errors ?? []) seen.add(e.message);
    return [...seen];
  }, [rows]);

  const running = phase === 'running';
  const done = rows.length;
  // (how this game writes a moment of a match: see timeTextOf)
  const timeText = useMemo(() => timeTextOf(game), [game]);
  // what the game adds about the chosen list: about its random lists, or about the combination on the stage
  const randomNote = choice.startsWith('random-') ? (random?.note ?? null) : null;
  const presetNote = presets.find((p) => p.id === choice)?.note?.(currentScenario) ?? null;
  /** "at 0:37.2" under the best and the worst run, where the time of the points ranks (nothing for a run without points) */
  const reachedAt = (result: BatchResult | undefined): string | undefined => {
    const time = result ? scoreTimeText(result, timeText, '') : '';
    return time === '' ? undefined : `at ${time}`;
  };

  return (
    <Modal title={`Test on many ${words.scenarios}`} onClose={onClose} widthClass="max-w-4xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-600">{words.batchIntro}</p>

        {/* ---------------------------------------------------------------- what to run */}
        <fieldset disabled={running} className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">{`Which ${words.scenarios}?`}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RANDOM_COUNTS.map((count) => (
              <label
                key={count}
                className={`flex cursor-pointer items-start gap-2 rounded-card border px-3 py-2 text-sm ${choice === `random-${count}` ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name="batch-choice"
                  className="mt-1 accent-brand-600"
                  checked={choice === `random-${count}`}
                  onChange={() => setChoice(`random-${count}`)}
                />
                <span>
                  <span className="font-semibold text-ink-800">
                    {count}
                    {` random ${words.scenarios}`}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {count === 10 ? 'A quick check.' : count === 50 ? 'A good picture of how reliable the program is.' : 'A thorough test. Takes a little longer.'}
                  </span>
                </span>
              </label>
            ))}
            {presets.map((preset) => (
              <label
                key={preset.id}
                className={`flex cursor-pointer items-start gap-2 rounded-card border px-3 py-2 text-sm ${choice === preset.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name="batch-choice"
                  className="mt-1 accent-brand-600"
                  checked={choice === preset.id}
                  onChange={() => setChoice(preset.id)}
                />
                <span>
                  <span className="font-semibold text-ink-800">{preset.label}</span>
                  <span className="block text-xs text-ink-500">{preset.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {choice.startsWith('random-') && (
              <label className="flex items-center gap-2 text-sm text-ink-600" title={`The same seed always draws the same ${words.scenarios}, so you can repeat a test after changing your program.`}>
                Seed
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={seed}
                  onChange={(event) => setSeed(Math.max(0, Math.min(999999, Math.floor(Number(event.target.value) || 0))))}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm"
                />
                <button
                  type="button"
                  className={button.icon}
                  aria-label="Pick another seed"
                  title={`Pick another seed (other ${words.scenarios})`}
                  onClick={() => setSeed(1 + Math.floor(Math.random() * 99999))}
                >
                  <DiceIcon className="h-4 w-4" />
                </button>
              </label>
            )}
            {randomNote && (
              <p className="min-w-0 flex-1 basis-56 text-xs leading-snug text-ink-600" data-batch-note>
                {randomNote}
              </p>
            )}
            {presetNote && (
              <p className="min-w-0 flex-1 basis-56 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold leading-snug text-amber-900" data-batch-note>
                {presetNote}
              </p>
            )}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          {running ? (
            <button type="button" onClick={cancel} className={button.plain}>
              Cancel
            </button>
          ) : (
            <button type="button" onClick={run} className={button.primary}>
              <TestIcon className="h-4 w-4" />
              {phase === 'idle' ? 'Run the test' : 'Run again'}
            </button>
          )}
          {phase !== 'idle' && (
            <div className="flex min-w-48 flex-1 items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100"
                role="progressbar"
                aria-label="Test progress"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
              >
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-ink-600" aria-live="polite">
                {done} / {total}
                {phase === 'cancelled' && ' (stopped)'}
              </span>
            </div>
          )}
        </div>

        {problem && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {problem}
          </p>
        )}

        {/* ---------------------------------------------------------------- results */}
        {done > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="Average score" value={summary.average.toFixed(1)} note={`of ${rows[0].result.max} points`} />
              <StatTile label="Best run" value={String(summary.best)} note={reachedAt(extremes?.best)} />
              <StatTile label="Worst run" value={String(summary.worst)} note={reachedAt(extremes?.worst)} />
              <StatTile
                label={`Every ${words.goal} complete`}
                value={percent(summary.completeCount / summary.runs)}
                note={`${summary.completeCount} of ${summary.runs} runs`}
              />
            </div>

            {programErrors.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-semibold">The program has a problem:</span> {programErrors[0]}
                {programErrors.length > 1 && ` (and ${programErrors.length - 1} more)`}
              </p>
            )}

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">How often each line of the score sheet succeeds</p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
                {summary.perLine.map((line) => (
                  <li
                    key={line.id}
                    className="grid grid-cols-[minmax(0,1fr)_6rem_2.75rem] items-center gap-2"
                    title={`${line.label}: ${percent(line.successRate)} of the runs`}
                  >
                    <span className="text-sm leading-tight text-ink-700">{penaltyIds.has(line.id) ? `${words.cleanLine}: ${line.label.toLowerCase()}` : line.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-brand-100" aria-hidden="true">
                      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${line.successRate * 100}%` }} />
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums text-ink-900">{percent(line.successRate)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Every run</p>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
                  <input type="checkbox" className="accent-brand-600" checked={worstFirst} onChange={(event) => setWorstFirst(event.target.checked)} />
                  Worst first
                </label>
              </div>
              <div className="max-h-72 overflow-auto rounded-card border border-slate-200">
                {/* (the referee's sentence about the end needs more room than a short reason) */}
                <table className={`w-full ${refereeTimes ? 'min-w-[46rem]' : 'min-w-[34rem]'} border-collapse text-left text-sm`}>
                  <thead className="sticky top-0 bg-slate-100 text-xs text-ink-600">
                    <tr>
                      <th scope="col" className="px-2.5 py-2 font-semibold">#</th>
                      <th scope="col" className="px-2.5 py-2 font-semibold">{capital(words.scenario)}</th>
                      <th scope="col" className="px-2.5 py-2 text-right font-semibold">Score</th>
                      <th scope="col" className="px-2.5 py-2 font-semibold">{capital(words.goals)}</th>
                      {refereeTimes ? (
                        <>
                          <th scope="col" className="px-2.5 py-2 text-right font-semibold" title="The time on the clock when the last of these points was earned. With equal points, the shorter time ranks higher.">
                            Time of the points
                          </th>
                          <th scope="col" className="px-2.5 py-2 font-semibold">How it ended</th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="px-2.5 py-2 text-right font-semibold">Time</th>
                          <th scope="col" className="px-2.5 py-2 font-semibold">Ended</th>
                        </>
                      )}
                      <th scope="col" className="px-2.5 py-2">
                        <span className="sr-only">Watch</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((row) => {
                      const missions = row.result.lines.filter((l) => l.max > 0 && !penaltyIds.has(l.id) && l.id !== 'bonus');
                      const okCount = missions.filter((l) => l.ok).length;
                      return (
                        <tr
                          key={row.index}
                          onClick={() => onPick(row.scenario)}
                          className="cursor-pointer border-t border-slate-100 hover:bg-brand-50"
                        >
                          <td className="px-2.5 py-1.5 font-mono text-xs tabular-nums text-ink-500">{row.index + 1}</td>
                          {/* (where the table is wide anyway - the referee's sentence - the code is not broken over two lines) */}
                          <td className={`px-2.5 py-1.5 font-mono text-xs text-ink-800${refereeTimes ? ' whitespace-nowrap' : ''}`}>{row.result.scenarioCode}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-semibold tabular-nums text-ink-900">{row.result.total}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="flex items-center gap-1" title={missions.map((l) => `${l.ok ? '✓' : '✗'} ${l.label}`).join('\n')}>
                              {missions.map((l) => (
                                <span
                                  key={l.id}
                                  aria-hidden="true"
                                  className={`h-2.5 w-2.5 rounded-full border ${l.ok ? 'border-brand-600 bg-brand-600' : 'border-slate-400 bg-white'}`}
                                />
                              ))}
                              <span className="ml-1 font-mono text-xs tabular-nums text-ink-600">
                                {okCount}/{missions.length}
                              </span>
                            </span>
                          </td>
                          {refereeTimes ? (
                            <>
                              <td className="px-2.5 py-1.5 text-right font-mono text-xs tabular-nums text-ink-600">
                                {row.result.scoreTime === undefined ? (
                                  <>
                                    <span aria-hidden="true">-</span>
                                    <span className="sr-only">no points</span>
                                  </>
                                ) : (
                                  scoreTimeText(row.result, timeText)
                                )}
                              </td>
                              <td className="min-w-[16rem] px-2.5 py-1.5 text-xs leading-snug text-ink-600">{endSentence(row.result, timeText)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-2.5 py-1.5 text-right font-mono text-xs tabular-nums text-ink-600">{timeText(row.result.time)}</td>
                              <td className="px-2.5 py-1.5 text-xs text-ink-600">
                                {finishText(row.result.finishReason)}
                                {row.result.restarts > 0 && `, ${row.result.restarts} restart${row.result.restarts === 1 ? '' : 's'}`}
                              </td>
                            </>
                          )}
                          <td className="px-2.5 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPick(row.scenario);
                              }}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                              aria-label={`Watch ${words.scenario} ${row.result.scenarioCode} on the stage`}
                            >
                              Watch
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
