/**
 * The planning stopwatch of Junior (design 7.10). The rules give a Junior student 120 seconds to
 * lay the cards before the match, and the judge records the planning time (rules l.150-156). Here
 * it is a stopwatch that counts up and tells when the time is over - it locks nothing (ASSUMPTION
 * A11): the screen of a simulator is for practice, and a teacher decides.
 *
 *   not started   0:00, button "Start"            it never starts by itself
 *   running       counts up, button "Finish!"     the student may say "Finish!" (rules l.153)
 *   over          goes on counting, amber          "2 minutes are over." is shown and read out once
 *   stopped       the recorded time, "Again"       pressing GO also stops a running clock
 *
 * It runs in real time: it is not part of the simulation, and not faster at 2x.
 *
 * Plain TypeScript (no DOM, no React), so it is tested under Node. Times are in milliseconds of
 * the page's clock (Date.now or performance.now - only differences are used).
 */
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { CADET_WORDS, clockUp } from './words';

export type PlanningPhase = 'idle' | 'running' | 'stopped';

export interface PlanningClock {
  readonly phase: PlanningPhase;
  /** when it was started (ms), while it runs */
  readonly startedAt: number;
  /** the recorded time (s), once it is stopped */
  readonly recorded: number;
}

export const planningIdle = (): PlanningClock => ({ phase: 'idle', startedAt: 0, recorded: 0 });

/** "Start": the clock counts from 0. */
export const startPlanning = (now: number): PlanningClock => ({ phase: 'running', startedAt: now, recorded: 0 });

/** "Finish!", or GO: the clock stops and keeps the time. (A clock that does not run is left as it is.) */
export function stopPlanning(clock: PlanningClock, now: number): PlanningClock {
  if (clock.phase !== 'running') return clock;
  return { phase: 'stopped', startedAt: clock.startedAt, recorded: Math.max(0, (now - clock.startedAt) / 1000) };
}

/** The seconds on the clock now. */
export function planningSeconds(clock: PlanningClock, now: number): number {
  if (clock.phase === 'running') return Math.max(0, (now - clock.startedAt) / 1000);
  if (clock.phase === 'stopped') return clock.recorded;
  return 0;
}

/** True from the moment the planning time of the rules is over (the clock goes on counting). */
export const planningOver = (clock: PlanningClock, now: number): boolean =>
  clock.phase !== 'idle' && planningSeconds(clock, now) >= FIRE_CADET.PLANNING_SECONDS - 1e-9;

/** What the strip shows. */
export interface PlanningView {
  /** "1:23" */
  clock: string;
  /** the word on the one button: "Start", "Finish!" or "Again" */
  button: string;
  /** the planning time is over: the clock turns amber */
  over: boolean;
  /** the sentence beside the clock, or null: "2 minutes are over." while it runs, "Planning time: 1:23." once it is stopped */
  note: string | null;
  /** how full the bar is, 0 to 1 (full at the planning time of the rules) */
  bar: number;
}

export function planningView(clock: PlanningClock, now: number): PlanningView {
  const seconds = planningSeconds(clock, now);
  const over = planningOver(clock, now);
  const words = CADET_WORDS.planning;
  return {
    clock: clockUp(seconds),
    button: clock.phase === 'idle' ? words.start : clock.phase === 'running' ? words.finish : words.again,
    over,
    note: clock.phase === 'stopped' ? words.recorded(clockUp(seconds)) : clock.phase === 'running' && over ? words.over : null,
    bar: Math.min(1, seconds / FIRE_CADET.PLANNING_SECONDS),
  };
}

/** What the one button does now. */
export function pressPlanningButton(clock: PlanningClock, now: number): PlanningClock {
  if (clock.phase === 'idle') return startPlanning(now);
  if (clock.phase === 'running') return stopPlanning(clock, now);
  return planningIdle();
}

/** The line under the score sheet in Junior, once the clock was used and stopped: "Planning time: 1:23 of 2:00." (else null). */
export const planningUnderSheet = (clock: PlanningClock): string | null =>
  clock.phase === 'stopped' ? CADET_WORDS.planning.underSheet(clockUp(clock.recorded)) : null;
