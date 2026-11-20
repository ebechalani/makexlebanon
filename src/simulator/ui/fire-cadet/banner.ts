/**
 * The banner of the Fire Cadet screen: ONE sentence that says what just happened or what to do
 * next (design 7.6). It stands right under the map on a phone and above it on a classroom screen,
 * and a screen reader reads it out (role="status").
 *
 * Which sentence, first match wins:
 *   1. a refusal of the row, for REFUSAL_SECONDS                     (Junior)
 *   2. a note of the screen, for NOTE_SECONDS ("Map 3.", "Add a card first.", ...)
 *   3. the match runs and the referee has a sentence (ScoreReport.now): that sentence, as it is
 *   4. the match runs: what is going on
 *   5. the match is over: how it ended, with the referee's points and the referee's time
 *   6. before the match: what to do first
 *
 * The referee's sentences are never copied here: the banner shows ScoreReport.now as the referee
 * (../../fire-cadet/game.ts) wrote it, for as long as the referee keeps it there (MESSAGE_SECONDS).
 * The end sentence uses the referee's total and the referee's time (ScoreReport.time).
 *
 * Plain TypeScript (no DOM, no React), so it is tested under Node.
 */
import type { FinishReason, ScoreReport } from '../../core/types';
import type { RunState } from '../useSimulation';
import { CADET_WORDS, secondsText, type PlayMode } from './words';

/** How long the screen shows a refusal of the row in the banner and in the bubble over the card box (design 4.3: 4 s). */
export const REFUSAL_SECONDS = 4;
/** How long the screen shows one of its own notes in the banner (design 7.6: 4 s). */
export const NOTE_SECONDS = 4;

/** A sentence of the screen that is shown until `until` (ms, the clock of the page: performance.now or Date.now). */
export interface TimedText {
  text: string;
  until: number;
}

/** The sentence, while it is still to be shown. */
export const stillShown = (timed: TimedText | null, now: number): string | null => (timed !== null && now < timed.until ? timed.text : null);

export interface BannerInput {
  mode: PlayMode;
  runState: RunState;
  finishReason: FinishReason | null;
  score: Pick<ScoreReport, 'total' | 'max' | 'now' | 'time'>;
  /** the match clock (s): the end time when the referee wrote none */
  time: number;
  /** cards in the row (Junior) */
  rowLength: number;
  /** a refusal of the row that is still shown, or null */
  refusal: string | null;
  /** a note of the screen that is still shown, or null */
  note: string | null;
}

/** The banner's sentence (design 7.6, first match wins). */
export function bannerSentence(input: BannerInput): string {
  const words = CADET_WORDS.banner;
  const { mode, runState, score } = input;
  if (mode === 'cards' && input.refusal) return input.refusal;
  if (input.note) return input.note;
  if (runState === 'running' || runState === 'paused') {
    if (score.now) return score.now;
    return words.running[mode];
  }
  if (runState === 'finished' || runState === 'stopped') {
    const all = score.total >= score.max;
    const points = words.points(score.total, score.max);
    const seconds = secondsText(typeof score.time === 'number' && Number.isFinite(score.time) ? score.time : input.time);
    if (input.finishReason === 'program-ended') return words.rowDone(mode, points, seconds, all);
    if (input.finishReason === 'time') return words.timeUp(mode, points, all);
    if (input.finishReason === 'declared' || runState === 'stopped') return words.stopped(mode, points, seconds, all);
    return words.over(mode, points, all);
  }
  if (mode === 'cards' && input.rowLength === 0) return words.readyEmpty;
  return words.ready[mode];
}
