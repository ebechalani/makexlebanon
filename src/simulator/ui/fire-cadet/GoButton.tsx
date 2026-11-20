'use client';

/**
 * The big round button (design 7.4): the pen's round Start button. One button, three faces:
 *
 *   before a match   green, a white triangle, GO      start the match (Junior: the row runs)
 *   during a match   red, a white square, STOP         the student says "STOP": the match ends and the points count
 *   after a match    blue, a round arrow, AGAIN        put everything back to the start
 *
 * No countdown: the press is the referee's GO, and the clock starts at once (N11, N21).
 */
import type { RunState } from '../useSimulation';
import { CADET_WORDS, type PlayMode } from './words';

/** Which face the round button shows. */
export type GoFace = 'go' | 'stop' | 'again';

/** The face for a state of the run loop: GO before, STOP while the match runs, AGAIN once it is over. */
export function goFace(runState: RunState): GoFace {
  if (runState === 'running' || runState === 'paused') return 'stop';
  if (runState === 'finished' || runState === 'stopped') return 'again';
  return 'go';
}

const LOOK: Readonly<Record<GoFace, string>> = {
  go: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 ring-emerald-200',
  stop: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 ring-rose-200',
  again: 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 ring-brand-200',
};

export function GoButton({ face, mode, onPress }: { face: GoFace; mode: PlayMode; onPress: () => void }) {
  const label = face === 'go' ? CADET_WORDS.go.label[mode] : face === 'stop' ? CADET_WORDS.stop.label : CADET_WORDS.again.label;
  const word = face === 'go' ? CADET_WORDS.go.word : face === 'stop' ? CADET_WORDS.stop.word : CADET_WORDS.again.word;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      data-face={face}
      className={`cadet-go flex shrink-0 flex-col items-center justify-center rounded-full text-white shadow-lg ring-4 transition-colors ${LOOK[face]}`}
    >
      <svg viewBox="0 0 24 24" className="cadet-go-icon" aria-hidden="true" focusable="false">
        {face === 'go' && <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" />}
        {face === 'stop' && <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" />}
        {face === 'again' && (
          <g fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 1 0 2.6-5.9" />
            <path d="M4 4.5v4.6h4.6" />
          </g>
        )}
      </svg>
      <span aria-hidden="true" className="cadet-go-word font-black tracking-wide">
        {word}
      </span>
    </button>
  );
}
