'use client';

/**
 * The four small pieces of the match (design 7.7). They are not one bar on the screen: the clock
 * and the points stand on the top edge of the map (phone) or at the two ends of the banner line
 * (classroom screen); the speed buttons stand beside the round button; the mode switch stands
 * above everything. Each control is at least 48 x 48 px.
 *
 *   MatchClock   counts down from 2:00, red in the last CLOCK_RED_SECONDS
 *   MatchPoints  a star and "10 / 25"
 *   SpeedButtons 1x, 2x, 4x - Junior only (Mini always plays at 1x: N8)
 *   ModeSwitch   "Junior: cards" and "Mini: tap to drive" - locked during a match
 *
 * Also the keyboard of a radio group (radioKeys), used here and by the map picker.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { formatClock } from '../format';
import { CADET_SPEEDS } from './map-code';
import { CADET_WORDS, PLAY_MODES, type PlayMode } from './words';

/** The clock turns red in the last this many seconds of the match (design 7.7). */
export const CLOCK_RED_SECONDS = 30;

/**
 * The arrow keys of a radio group: Left / Up the one before, Right / Down the one after (round the
 * end), Home the first, End the last. The new one is chosen and gets the focus. Other keys: nothing.
 */
export function radioKeys<T>(event: KeyboardEvent<HTMLElement>, options: readonly T[], current: T, choose: (next: T) => void): void {
  const at = Math.max(0, options.indexOf(current));
  let next: number | null = null;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % options.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + options.length) % options.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = options.length - 1;
  if (next === null) return;
  event.preventDefault();
  choose(options[next]);
  const buttons = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
  buttons[next]?.focus();
}

export function MatchClock({ timeLeft, className = '' }: { timeLeft: number; className?: string }) {
  const text = formatClock(timeLeft);
  const red = timeLeft <= CLOCK_RED_SECONDS && timeLeft > 0;
  return (
    <span
      role="timer"
      aria-label={CADET_WORDS.clockLabel(text)}
      className={`cadet-chip font-mono text-base font-bold tabular-nums ${red ? 'bg-rose-600 text-white' : 'bg-ink-900/85 text-white'} ${className}`}
    >
      {text}
    </span>
  );
}

export function MatchPoints({ total, max, className = '' }: { total: number; max: number; className?: string }) {
  return (
    <span aria-label={CADET_WORDS.pointsLabel(total, max)} role="img" className={`cadet-chip gap-1 bg-ink-900/85 font-mono text-base font-bold tabular-nums text-white ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-300" aria-hidden="true" focusable="false">
        <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="currentColor" />
      </svg>
      <span aria-hidden="true">
        {total} / {max}
      </span>
    </span>
  );
}

export function SpeedButtons({ speed, onSpeed }: { speed: number; onSpeed: (speed: (typeof CADET_SPEEDS)[number]) => void }) {
  return (
    <div role="radiogroup" aria-label={CADET_WORDS.speedGroup} className="flex gap-1.5" onKeyDown={(event) => radioKeys(event, CADET_SPEEDS, speed as (typeof CADET_SPEEDS)[number], onSpeed)}>
      {CADET_SPEEDS.map((value) => {
        const on = value === speed;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSpeed(value)}
            className={`cadet-touch rounded-xl border-2 px-2 text-sm font-bold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}
          >
            {CADET_WORDS.speed(value)}
          </button>
        );
      })}
    </div>
  );
}

/** The small picture on each way to play: three cards in a row (Junior), the yellow panel (Mini). */
function ModePicture({ mode }: { mode: PlayMode }): ReactNode {
  if (mode === 'cards') {
    return (
      <svg viewBox="0 0 36 20" className="h-6 w-10 shrink-0" aria-hidden="true" focusable="false">
        <rect x="1" y="3" width="10" height="14" rx="3" fill="#f5b301" />
        <rect x="13" y="3" width="10" height="14" rx="3" fill="#1f6fe5" />
        <rect x="25" y="3" width="10" height="14" rx="3" fill="#1f6fe5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#facc15" />
      <rect x="9" y="3" width="6" height="6" rx="1.5" fill="#1f6fe5" />
      <rect x="3" y="9" width="6" height="6" rx="1.5" fill="#1f6fe5" />
      <rect x="15" y="9" width="6" height="6" rx="1.5" fill="#1f6fe5" />
      <rect x="9" y="15" width="6" height="6" rx="1.5" fill="#1f6fe5" />
    </svg>
  );
}

export function ModeSwitch({ mode, onMode, locked }: { mode: PlayMode; onMode: (mode: PlayMode) => void; locked: boolean }) {
  return (
    <div role="radiogroup" aria-label={CADET_WORDS.modeGroup} className="grid grid-cols-2 gap-2" onKeyDown={(event) => !locked && radioKeys(event, PLAY_MODES, mode, onMode)}>
      {PLAY_MODES.map((value) => {
        const on = value === mode;
        const words = CADET_WORDS.mode[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={locked}
            onClick={() => onMode(value)}
            className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-2.5 py-1 text-left disabled:cursor-not-allowed ${
              on ? 'border-brand-600 bg-brand-50 text-ink-900' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50 disabled:opacity-50'
            }`}
          >
            <ModePicture mode={value} />
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-bold">{words.label}</span>
              <span className="block text-xs text-ink-500">{words.ages}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
