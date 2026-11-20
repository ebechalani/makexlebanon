'use client';

/**
 * "My own map" (design 7.8): the window in which a teacher copies a combination. The board is 49
 * square buttons over the mat picture; under it the tray of the eight things, the code of the map
 * and what the simulator's solver says about it. What every tap does is in ./map-editor.ts.
 *
 *   - Tap a thing in the tray: it is lifted (a ring). The squares it may go to light up, the others
 *     go pale. Tap a lit square: the thing stands there. A tap on a square that is not lit changes
 *     nothing and says why, under the board.
 *   - The code under the board follows every tap; so does the solver's line, SOLVER_PAUSE_MS after
 *     the last tap: "found" or "found no row" - never "possible" (N18, D2: the row is never shown).
 *   - "Use this map" puts it on the stage and closes the window; "Cancel" and Escape change nothing.
 *   - The keyboard: the board is one stop of Tab, the arrow keys move over the 49 squares, Enter
 *     (or Space) puts the lifted thing down - or lifts what stands there.
 *
 * The window is the shared one (../widgets.tsx Modal) in its full-screen form: on a phone it fills
 * the screen, so the squares get the whole width (at least 48 px each).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MAT_IMAGE_URL } from '../../fire-cadet/field';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { MAP_THINGS, type FireCadetScenario, type MapThing } from '../../fire-cadet/scenario';
import { findRowForAllPoints, type SolverVerdict } from '../../fire-cadet/solver';
import { CheckIcon, CrossIcon } from '../icons';
import { Modal } from '../widgets';
import { SOLVER_PAUSE_MS, boardSquares, editorCode, liftThing, moveFocus, openEditor, tapSquare, type EditorState } from './map-editor';
import { Picture, type PictureName } from './pictures';
import { CADET_WORDS, THING_WORDS, solverLine } from './words';

export interface MapEditorProps {
  /** the map on the stage: the editor opens with it */
  scenario: FireCadetScenario;
  /** "Use this map" */
  onUse: (scenario: FireCadetScenario) => void;
  /** "Cancel", Escape, the close button */
  onClose: () => void;
}

const COLUMN_LETTERS = 'ABCDEFG';
const N = FIRE_CADET.GRID_COUNT;

/** The robot at the start, as the board draws it: a white body looking up. */
function StartMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" aria-hidden="true" focusable="false">
      <rect x="4" y="5" width="16" height="16" rx="4" fill="#ffffff" stroke="#475569" strokeWidth="1.2" />
      <rect x="4.5" y="1.5" width="2" height="4.5" fill="#f59e0b" />
      <rect x="17.5" y="1.5" width="2" height="4.5" fill="#f59e0b" />
      <path d="M12 9l4 6H8z" fill="#93c5fd" />
    </svg>
  );
}

export function MapEditor({ scenario, onUse, onClose }: MapEditorProps) {
  const [state, setState] = useState<EditorState>(() => openEditor(scenario));
  const [verdict, setVerdict] = useState<{ of: FireCadetScenario; says: SolverVerdict } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const words = CADET_WORDS.editor;

  // the solver's line, a moment after the last tap
  useEffect(() => {
    const timer = window.setTimeout(() => setVerdict({ of: state.scenario, says: findRowForAllPoints(state.scenario) }), SOLVER_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [state.scenario]);

  const squares = boardSquares(state);
  const focusIndex = state.focus.row * N + state.focus.col;
  const focusSquare = (next: EditorState) => {
    setState(next);
    boardRef.current?.querySelectorAll<HTMLElement>('[data-square]')[next.focus.row * N + next.focus.col]?.focus();
  };
  const onBoardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      focusSquare(moveFocus(state, move[0], move[1]));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setState(tapSquare(state, state.focus));
    }
  };

  const fresh = verdict !== null && verdict.of === state.scenario;
  return (
    <Modal title={words.title} onClose={onClose} widthClass="max-w-2xl" align="full">
      <div className="flex flex-col gap-3" data-map-editor>
        <p className="text-sm font-semibold text-ink-700">{words.how}</p>

        <div className="cadet-board-frame">
          <div className="cadet-board-letters" aria-hidden="true">
            {COLUMN_LETTERS.slice(0, N)
              .split('')
              .map((letter) => (
                <span key={letter}>{letter}</span>
              ))}
          </div>
          <div className="cadet-board-numbers" aria-hidden="true">
            {Array.from({ length: N }, (_, k) => (
              <span key={k}>{k + 1}</span>
            ))}
          </div>
          <div
            ref={boardRef}
            role="group"
            aria-label={words.board}
            className="cadet-board"
            style={{ backgroundImage: `url(${MAT_IMAGE_URL})` }}
            onKeyDown={onBoardKey}
          >
            {squares.map((sq, index) => {
              const row = sq.square.row;
              const k = sq.square.col;
              const pale = state.lifted !== null && !sq.lit;
              return (
                <button
                  key={sq.name}
                  type="button"
                  data-square={sq.name}
                  data-lit={sq.lit ? 'true' : undefined}
                  aria-label={sq.label}
                  tabIndex={index === focusIndex ? 0 : -1}
                  // (the keys act on the square that has the focus, however it got it)
                  onFocus={() => setState((now) => (now.focus.col === k && now.focus.row === row ? now : { ...now, focus: sq.square }))}
                  onClick={() => setState(tapSquare(state, sq.square))}
                  className={`cadet-square relative flex items-center justify-center ${sq.lit ? 'cadet-square-lit' : ''} ${pale ? 'cadet-square-pale' : ''}`}
                >
                  {(row === 0 || k === 0) && (
                    <span aria-hidden="true" className="cadet-corner">
                      {sq.name}
                    </span>
                  )}
                  {sq.fire && <Picture name="fire" className="absolute inset-[12%] h-[76%] w-[76%] opacity-90" />}
                  {sq.start && <StartMark />}
                  {sq.things.map((thing) => (
                    <Picture key={thing} name={thing as PictureName} className={`relative h-[62%] w-[62%] ${state.lifted === thing ? 'cadet-lifted' : ''}`} />
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        <p aria-live="polite" className="min-h-5 text-sm font-semibold text-rose-700" data-editor-refusal>
          {state.refusal ?? ''}
        </p>

        <div role="group" aria-label={words.tray} className="flex flex-wrap gap-2">
          {MAP_THINGS.map((thing: MapThing) => {
            const on = state.lifted === thing;
            return (
              <button
                key={thing}
                type="button"
                aria-pressed={on}
                data-thing={thing}
                onClick={() => setState(liftThing(state, thing))}
                className={`cadet-touch inline-flex items-center gap-1.5 rounded-xl border-2 px-2 text-sm font-bold ${
                  on ? 'cadet-ring border-brand-600 bg-brand-50 text-ink-900' : 'border-slate-300 bg-white text-ink-800 hover:bg-slate-50'
                }`}
              >
                <Picture name={thing as PictureName} className="h-7 w-7" />
                {THING_WORDS[thing]}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-ink-700">
          {words.code}{' '}
          <span className="font-mono font-bold text-ink-900" data-editor-code>
            {editorCode(state)}
          </span>
        </p>
        <p aria-live="polite" className={`flex items-start gap-2 text-sm font-semibold ${fresh ? '' : 'opacity-50'} ${verdict?.says.found ? 'text-emerald-800' : 'text-rose-800'}`} data-solver-line>
          {verdict !== null && (
            <>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${verdict.says.found ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {verdict.says.found ? <CheckIcon className="h-3.5 w-3.5" /> : <CrossIcon className="h-3.5 w-3.5" />}
              </span>
              <span>{solverLine(verdict.says)}</span>
            </>
          )}
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="cadet-touch rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-ink-800 hover:bg-slate-50">
            {words.cancel}
          </button>
          <button
            type="button"
            onClick={() => onUse(state.scenario)}
            className="cadet-touch rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            data-use-map
          >
            {words.use}
          </button>
        </div>
      </div>
    </Modal>
  );
}
