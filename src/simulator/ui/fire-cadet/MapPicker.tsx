'use client';

/**
 * The map picker (design 7.8), inside the "Map" section. Our own, because the general Combination
 * panel has 36 px buttons and every button here is at least 48 x 48 px:
 *
 *   - eight buttons "1" to "8" for the practice maps (a radio group; the one on the stage is filled),
 *     "My own map" (opens the editor), "Surprise" (one of the eight by chance: N15) and "Map 1";
 *   - for the teacher: the code of the map on the stage with a Copy button, and a field to type a
 *     code ("Enter a code", "Use"); a code that does not read gives the game's one sentence;
 *   - the note: practice maps of this simulator, not official ones.
 *
 * During a match the maps cannot be changed: a new map puts everything back to the start.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { PRACTICE_MAPS, practiceMapNumber, randomScenario, type FireCadetScenario } from '../../fire-cadet/scenario';
import { CopyIcon } from '../icons';
import { mapCode, readTypedCode } from './map-code';
import { radioKeys } from './MatchBar';
import { CADET_WORDS } from './words';

/** How long "Copied" stands on the Copy button (ms). */
export const COPIED_MS = 1500;

export interface MapPickerProps {
  scenario: FireCadetScenario;
  /** put a map on the stage */
  onScenario: (scenario: FireCadetScenario) => void;
  /** open "My own map" */
  onOwnMap: () => void;
  /** a match runs: nothing can be changed */
  locked: boolean;
}

const BIG_BUTTON =
  'cadet-touch inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-ink-800 hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40';

export function MapPicker({ scenario, onScenario, onOwnMap, locked }: MapPickerProps) {
  const words = CADET_WORDS.map;
  const number = practiceMapNumber(scenario);
  const numbers = PRACTICE_MAPS.map((_, k) => k + 1);
  const code = mapCode(scenario);
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const choose = (n: number) => onScenario(PRACTICE_MAPS[n - 1]);

  const copy = () => {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch(() => undefined);
  };

  const use = (event: FormEvent) => {
    event.preventDefault();
    const reading = readTypedCode(typed);
    if (!reading.ok) {
      setProblem(reading.problem);
      return;
    }
    setProblem(null);
    setTyped('');
    onScenario(reading.scenario);
  };

  return (
    <div className="flex flex-col gap-3" data-map-picker>
      <div
        role="radiogroup"
        aria-label={words.practiceGroup}
        className="cadet-maps"
        onKeyDown={(event) => !locked && radioKeys(event, numbers, number ?? 1, choose)}
      >
        {numbers.map((n) => {
          const on = n === number;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (number === null && n === 1) ? 0 : -1}
              disabled={locked}
              onClick={() => choose(n)}
              data-map={n}
              className={`cadet-touch rounded-xl border-2 text-lg font-black tabular-nums disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-ink-800 hover:bg-slate-50'
              }`}
            >
              {words.practice(n)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${BIG_BUTTON} ${number === null ? 'border-brand-600 bg-brand-50' : ''}`} onClick={onOwnMap} disabled={locked} data-own-map>
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" focusable="false">
            <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {words.own}
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => onScenario(randomScenario(Math.random))} disabled={locked}>
          {words.surprise}
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => choose(1)} disabled={locked}>
          {words.first}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-sm text-ink-600">{words.code}</span>
        <span className="font-mono text-sm font-bold text-ink-900" data-map-code>
          {code}
        </span>
        <button type="button" onClick={copy} aria-label={words.copy} className={`${BIG_BUTTON} px-2`}>
          <CopyIcon className="h-5 w-5" />
        </button>
        <span aria-live="polite" className="text-sm font-semibold text-emerald-700">
          {copied ? words.copied : ''}
        </span>
      </div>

      <form onSubmit={use} className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-700">
          {words.enterCode}
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={locked}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={problem !== null}
          aria-describedby={problem !== null ? errorId : undefined}
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-slate-300 px-3 font-mono text-base uppercase text-ink-900 disabled:opacity-40"
        />
        <button type="submit" className={BIG_BUTTON} disabled={locked}>
          {words.use}
        </button>
        {problem !== null && (
          <p id={errorId} role="alert" className="w-full text-sm font-semibold text-rose-700">
            {problem}
          </p>
        )}
      </form>

      <p className="text-xs leading-snug text-ink-500">{words.note}</p>
    </div>
  );
}
