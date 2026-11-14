/**
 * What the results of "Test on many ..." say about one run, for a game whose referee writes
 * times down (Game.createReferee: Fire Chief). There the ranking uses the points and then the
 * time at which those points were reached, and the referee ends an attempt with a sentence of
 * its own - so the table shows that time and that sentence.
 *
 * A game without such a referee (Fire Rescue) uses none of this: its table is as it always was.
 *
 * Plain TypeScript (no DOM, no React), so it can be unit-tested under Node.
 */
import type { BatchResult } from '../core/batch';
import type { TimeText } from './format';
import { finishSentence } from './match-words';

/** The part of a result the ranking looks at. */
type Ranked = Pick<BatchResult, 'total' | 'scoreTime'>;

/**
 * Which of two runs ranks higher where the ranking is "most points, then the shortest time to
 * reach them": a negative number when `a` ranks higher, a positive one when `b` does, 0 when
 * they are equal. (A run without points has no time; among such runs none is better.)
 */
export function compareRuns(a: Ranked, b: Ranked): number {
  if (a.total !== b.total) return b.total - a.total;
  return (a.scoreTime ?? Infinity) - (b.scoreTime ?? Infinity) || 0;
}

/** The best and the worst of a list of runs by that ranking (the first of equal ones), or null for an empty list. */
export function bestAndWorst<R extends Ranked>(runs: readonly R[]): { best: R; worst: R } | null {
  if (runs.length === 0) return null;
  let best = runs[0];
  let worst = runs[0];
  for (const run of runs) {
    if (compareRuns(run, best) < 0) best = run;
    if (compareRuns(run, worst) > 0) worst = run;
  }
  return { best, worst };
}

/** The time at which the points of a run were reached, as the referee writes it; `none` for a run without points. */
export function scoreTimeText(result: Ranked, timeText: TimeText, none = '-'): string {
  return typeof result.scoreTime === 'number' && Number.isFinite(result.scoreTime) ? timeText(result.scoreTime) : none;
}

/**
 * How a run ended, as a sentence: the referee's own sentence when the referee ended it
 * ("Mission complete at 0:37.2: ..."), otherwise the reason and the time ("Time is up at
 * 3:00.0."). A run in which restarts were used says so too.
 */
export function endSentence(result: Pick<BatchResult, 'finishReason' | 'finishDetail' | 'time' | 'restarts'>, timeText: TimeText): string {
  const sentence = finishSentence(result.finishReason, result.finishDetail, result.time, timeText);
  if (!(result.restarts > 0)) return sentence;
  return `${sentence} ${result.restarts} restart${result.restarts === 1 ? '' : 's'} used.`;
}
