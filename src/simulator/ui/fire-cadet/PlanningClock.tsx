'use client';

/**
 * The planning stopwatch strip of Junior (design 7.10): "Planning time", a clock that counts up, a
 * bar that fills in 120 s, and one button (Start, Finish!, Again). What it does is in
 * ./planning-clock.ts. It runs in real time and locks nothing; "2 minutes are over." is shown and
 * read out once.
 */
import { useEffect, useState } from 'react';
import { planningView, type PlanningClock as Clock } from './planning-clock';
import { CADET_WORDS } from './words';

/** How often a running clock is drawn again (ms). */
const REDRAW_MS = 250;

export function PlanningClock({ clock, onPress }: { clock: Clock; onPress: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (clock.phase !== 'running') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), REDRAW_MS);
    return () => window.clearInterval(timer);
  }, [clock]);
  const view = planningView(clock, clock.phase === 'running' ? now : Date.now());
  const words = CADET_WORDS.planning;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5" data-planning>
      <span className="text-sm font-semibold text-ink-700">{words.title}</span>
      <span
        role="timer"
        aria-label={words.clockLabel(view.clock)}
        className={`font-mono text-lg font-bold tabular-nums ${view.over ? 'text-amber-600' : 'text-ink-900'}`}
      >
        {view.clock}
      </span>
      <span aria-hidden="true" className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200">
        <span className={`block h-full rounded-full ${view.over ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${Math.round(view.bar * 100)}%` }} />
      </span>
      <button
        type="button"
        onClick={onPress}
        className="cadet-touch rounded-xl border-2 border-brand-600 bg-brand-50 px-3 text-sm font-bold text-brand-900 hover:bg-brand-100"
      >
        {view.button}
      </button>
      {/* (said once: the sentence appears when the time is over and stays; a polite live region reads it out when it appears) */}
      <p aria-live="polite" className={`w-full text-xs font-semibold ${view.over && clock.phase === 'running' ? 'text-amber-700' : 'text-ink-600'}`} data-planning-note>
        {view.note ?? ''}
      </p>
    </div>
  );
}
