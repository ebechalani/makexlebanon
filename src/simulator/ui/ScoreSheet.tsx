'use client';

/**
 * The referee's score sheet: every line of the ScoreReport with the reason it does or does not
 * score, in the referee's words, plus the status line shown above the stage.
 *
 * The sheet shows whatever lines the game's referee gives, in the referee's order: the lines
 * that bring points first, then the lines that bring none (penalties, a note about the restart
 * or about the start position). A game that records WHEN a line was earned (ScoreLine.time) and
 * when the total was reached (ScoreReport.time) gets those times on the sheet: a ranking that
 * uses the time needs them.
 */
import type { ReactNode } from 'react';
import type { FinishReason, RestartRules, ScoreLine, ScoreReport } from '../core/types';
import { finishText, formatRefereeTime, formatStamp, type TimeText } from './format';
import { CheckIcon, CrossIcon } from './icons';
import { finishHeadline, finishSentence, restartSummary } from './match-words';
import { capital, DEFAULT_WORDS, type ScreenWords } from './screen-words';
import type { RunState } from './useSimulation';

/**
 * How one line of the sheet is marked:
 *   'done'      it brings its points, or (a line without points) nothing is wrong
 *   'not-done'  a line with points that has not been earned
 *   'penalty'   a line without points that has cost some
 *   'note'      a line without points that the referee wants the team to read: it costs nothing
 *               by itself (the restart was used, the robot did not start where it should)
 */
export type LineMark = 'done' | 'not-done' | 'penalty' | 'note';

export function lineMark(line: Pick<ScoreLine, 'points' | 'max' | 'ok'>): LineMark {
  if (line.max === 0 && line.points < 0) return 'penalty';
  if (line.ok) return 'done';
  return line.max === 0 ? 'note' : 'not-done';
}

/** What the right-hand end of a line shows: "20/20", a penalty "-5" (or a clean "0"), nothing beside a note. */
export function linePoints(line: Pick<ScoreLine, 'points' | 'max' | 'ok'>): string {
  if (line.max > 0) return `${line.points}/${line.max}`;
  return lineMark(line) === 'note' ? '' : String(line.points);
}

/** The time a line was earned, as the referee wrote it down; empty for a line that has none. */
export function lineTime(line: Pick<ScoreLine, 'time'>): string {
  return typeof line.time === 'number' && Number.isFinite(line.time) ? formatRefereeTime(line.time) : '';
}

const MARK_STYLE: Record<LineMark, { ring: string; name: string }> = {
  done: { ring: 'bg-emerald-100 text-emerald-700', name: 'done' },
  'not-done': { ring: 'bg-slate-100 text-ink-400', name: 'not done' },
  penalty: { ring: 'bg-rose-100 text-rose-700', name: 'penalty' },
  note: { ring: 'bg-amber-100 text-amber-800', name: 'note' },
};

function LineRow({ line }: { line: ScoreLine }) {
  const mark = lineMark(line);
  const points = linePoints(line);
  const time = lineTime(line);
  const pointsText = points !== '' && (
    <span
      className={
        'shrink-0 font-mono text-sm font-bold tabular-nums ' +
        (mark === 'penalty' ? 'text-rose-600' : line.points > 0 ? 'text-emerald-700' : 'text-ink-400')
      }
    >
      {points}
    </span>
  );
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${MARK_STYLE[mark].ring}`}>
        {mark === 'done' ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : mark === 'note' ? (
          <span aria-hidden="true" className="text-xs font-bold leading-none">
            !
          </span>
        ) : (
          <CrossIcon className="h-3.5 w-3.5" />
        )}
        <span className="sr-only">{MARK_STYLE[mark].name}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-800">{line.label}</p>
        <p className="text-xs leading-snug text-ink-500">{line.detail}</p>
      </div>
      {time === '' ? (
        pointsText
      ) : (
        // the referee wrote down the moment this line was earned (a ranking by time uses it): it stands under the points
        <span className="flex shrink-0 flex-col items-end">
          {pointsText}
          <span className="font-mono text-[11px] tabular-nums text-ink-500" title="The time on the clock when this line was earned">
            <span className="sr-only">earned at </span>
            {time}
          </span>
        </span>
      )}
    </li>
  );
}

export interface ScoreSheetProps {
  score: ScoreReport;
  /** the game's words (left out: the words of Fire Rescue) */
  words?: ScreenWords;
  /**
   * The referee's whole sentence about the end of the match, when the referee ended it
   * (Simulation.finishDetail) and the match is over. It stands at the top of the sheet: the
   * status line above the mat has room for its first words only (see finishHeadline).
   * Left out or null: the sheet begins with its lines, as it always did.
   */
  ending?: string | null;
}

export function ScoreSheet({ score, words = DEFAULT_WORDS, ending = null }: ScoreSheetProps) {
  const missions = score.lines.filter((line) => line.max > 0);
  const penalties = score.lines.filter((line) => line.max === 0);
  const totalTime = typeof score.time === 'number' && Number.isFinite(score.time) ? formatRefereeTime(score.time) : '';
  const howItEnded = ending?.trim() ?? '';
  return (
    <div>
      {howItEnded !== '' && (
        <p className="mb-1 rounded-md bg-brand-50 px-2 py-1.5 text-xs leading-snug text-ink-800" data-ending>
          <span className="font-bold">{`How the ${words.match} ended: `}</span>
          {howItEnded}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {missions.map((line) => (
          <LineRow key={line.id} line={line} />
        ))}
      </ul>
      {penalties.length > 0 && (
        <>
          <p className="mt-2 border-t border-slate-200 pt-2 text-xs font-bold uppercase tracking-wide text-ink-500">{words.sheetNotesHeading}</p>
          <ul className="divide-y divide-slate-100">
            {penalties.map((line) => (
              <LineRow key={line.id} line={line} />
            ))}
          </ul>
        </>
      )}
      <div className="mt-2 flex items-baseline justify-between border-t-2 border-slate-200 pt-2">
        <span className="text-sm font-bold text-ink-800">Total</span>
        <span className="font-mono text-lg font-bold tabular-nums text-ink-900">
          {score.total} <span className="text-sm font-medium text-ink-500">/ {score.max}</span>
        </span>
      </div>
      {totalTime !== '' && (
        <p className="flex items-baseline justify-between gap-3 text-xs text-ink-600" data-score-time>
          {/* (said as what the rules of the game say: a game that records times ranks equal points by them) */}
          <span>Time of this score - with equal points, the rules rank the shorter time higher</span>
          <span className="shrink-0 font-mono font-bold tabular-nums text-ink-900">{totalTime}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-ink-500">{words.sheetNote}</p>
    </div>
  );
}

export interface StatusLineProps {
  runState: RunState;
  finishReason: FinishReason | null;
  score: ScoreReport;
  /** simulated seconds on the match clock */
  time: number;
  /** the referee's own sentence about the end of the match, when the referee ended it (Simulation.finishDetail) */
  finishDetail?: string | null;
  /** restarts used in this match, and what each one costs (shown because a restart at 0 points does not change the score) */
  restarts?: number;
  restartPenalty?: number;
  /** the game's own restart rules (Game.restartRules) and how many restarts are left (Simulation.restartsLeft) */
  restartRules?: RestartRules;
  restartsLeft?: number;
  /** the game's words (left out: the words of Fire Rescue) */
  words?: ScreenWords;
  /** how this game writes a moment of the match (left out: rounded time stamps; see timeTextOf in ./format.ts) */
  timeText?: TimeText;
  /**
   * True in a game whose referee writes sentences of its own (Game.createReferee). Its sentence
   * about the end of a match can be long - what happened, what was not earned, what stays - and
   * the line must not grow with it: side by side with the blocks, a taller line pushes the mat
   * and the buttons under it out of a small window. So the line then says the end in the
   * referee's first words (finishHeadline), leaves out what no longer matters once a match is
   * over ("no restart left"), and never shows more than two lines of text there. The whole
   * sentence is on the score sheet. Left out: the line is exactly what it always was.
   */
  briefEnding?: boolean;
  /** what to tell the student before the start (how to place the robot) */
  readyHint: string;
  /** set when the robot is being put somewhere it may not start: shown in red instead of the hint */
  placingProblem: string | null;
  onShowSheet: () => void;
}

/**
 * One line above the stage that always says where the match stands: how to get ready, that it
 * is running, and - when it is over - the result and what to press next. It keeps the same
 * height in every state as long as the text fits on two lines, so the stage below it does not
 * jump; a longer text makes it taller (it is never squeezed: "shrink-0").
 */
export function StatusLine({
  runState,
  finishReason,
  finishDetail = null,
  score,
  time,
  restarts = 0,
  restartPenalty = 0,
  restartRules,
  restartsLeft,
  words = DEFAULT_WORDS,
  timeText = formatStamp,
  briefEnding = false,
  readyHint,
  placingProblem,
  onShowSheet,
}: StatusLineProps) {
  const missions = score.lines.filter((line) => line.max > 0 && line.id !== 'bonus');
  const done = missions.filter((line) => line.ok).length;
  // (once a match is over, how many restarts are left is no news: a brief ending leaves it out)
  const penaltyNote = restartSummary(restarts, { penalty: restartPenalty, rules: restartRules }, briefEnding && runState === 'finished' ? undefined : restartsLeft);
  const Match = capital(words.match);
  // (Below, a sentence with a word of the game in it is written as ONE piece of text, `...${word}...`,
  // not as text around a {word}: the browser fits the letters of each piece of text on their own,
  // and a sentence cut into other pieces is drawn a fraction of a pixel differently.)
  const points = (
    <span className="whitespace-nowrap font-mono font-bold tabular-nums">
      {score.total} / {score.max}
    </span>
  );

  let tone = 'border-slate-200 bg-white text-ink-600';
  let content: ReactNode;
  let showSheet = false;
  if (runState === 'ready') {
    if (placingProblem) {
      tone = 'border-rose-300 bg-rose-50 text-rose-800';
      content = <span className="font-semibold">{placingProblem}</span>;
    } else {
      content = readyHint;
    }
  } else if (runState === 'running') {
    tone = 'border-brand-200 bg-brand-50 text-ink-900';
    content = (
      <>
        <span className="font-bold">{`${Match} running.`}</span> {done} of {missions.length}
        {` ${words.goals} complete.`}
        {penaltyNote && <span className="font-semibold text-amber-800"> {penaltyNote}.</span>}
      </>
    );
  } else if (runState === 'paused') {
    tone = 'border-amber-300 bg-amber-50 text-amber-950';
    content = (
      <>
        <span className="font-bold">Paused</span> at {timeText(time)}
        {`. The ${words.match} clock is paused too.`}
      </>
    );
  } else if (runState === 'stopped') {
    tone = 'border-slate-300 bg-slate-200 text-ink-800';
    showSheet = true;
    content = (
      <>
        <span className="font-bold">Stopped by you</span> at {timeText(time)} - no final score (so far {points}). Start tries again, Reset puts the
        field back.
      </>
    );
  } else {
    const perfect = score.total >= score.max;
    tone = perfect ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-brand-300 bg-brand-100 text-ink-900';
    showSheet = true;
    content = (
      <>
        <span className="font-bold">{`${Match} over.`}</span>{' '}
        {finishDetail ? (
          // the referee ended the match: its own sentence says why (and when) - in a brief ending its first words only
          <>
            {briefEnding ? finishHeadline(finishDetail) : finishSentence(finishReason, finishDetail, time, timeText)} Final score: {points}
          </>
        ) : (
          <>
            {finishText(finishReason)} at {timeText(time)}. Final score: {points}
          </>
        )}
        {perfect ? ' - a perfect run!' : score.complete ? ` - every ${words.goal} complete.` : ''}
        {penaltyNote && ` (${penaltyNote})`}
      </>
    );
  }

  // A brief ending keeps to two lines where the stage stands beside the blocks ("lg:"): there the
  // window does not scroll, and a third line would push the buttons under the mat out of it.
  // (On a narrow screen the page scrolls anyway, and the whole text is shown.)
  const twoLines = briefEnding && runState === 'finished' ? ' lg:line-clamp-2' : '';
  return (
    <div className={`flex min-h-12 shrink-0 items-center gap-2 rounded-card border px-3 py-1.5 text-[13px] leading-snug ${tone}`}>
      <p role="status" aria-live="polite" className={`min-w-0 flex-1${twoLines}`}>
        {content}
      </p>
      {showSheet && (
        <button
          type="button"
          onClick={onShowSheet}
          className="shrink-0 rounded-lg border border-current/30 bg-white/70 px-2.5 py-1 text-xs font-bold hover:bg-white"
        >
          Score sheet
        </button>
      )}
    </div>
  );
}
