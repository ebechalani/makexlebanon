'use client';

/**
 * Junior's row of coding cards, its six buttons and the card box (design 7.3, 7.13). What every
 * tap does is in ./card-row.ts; this file draws it and passes the taps on.
 *
 *   - The row begins with the yellow start card. After the last card - or behind the selected
 *     card - a thin blinking bar says "the next card goes here".
 *   - A tap on a card of the row selects it (a white ring), a second tap lets go; so does a tap
 *     on the empty end of the row.
 *   - During a match the row is locked: the running card has a white ring and stands a little
 *     higher, its number card shows small dots for "which time of how many", and the cards that
 *     have run are paler. The row scrolls by itself to keep the bar, or the running card, in view.
 *   - The keyboard: the row is ONE stop of Tab; Left / Right go from card to card, Enter or Space
 *     selects or lets go, Delete or Backspace removes, Alt+Left / Alt+Right move the card, Ctrl+Z
 *     and Ctrl+Y (Cmd on a Mac) undo and redo.
 *   - A refused tap: the sentence is in the banner (read out there) and, for the child who taps
 *     the box, in a bubble right above it (aria-hidden: one live region is enough).
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CARD_NAMES, isNumberCard, type CardName, type RowProblem } from '../../fire-cadet/cards';
import { NewFileIcon, RedoIcon, UndoIcon } from '../icons';
import { addCard, barIndex, canRedo, canUndo, clearRow, moveCard, redo, removeCard, selectCard, undo, type RowEdit, type RowState } from './card-row';
import { CodingCard } from './CodingCard';
import { CADET_WORDS } from './words';

export interface CardRowProps {
  row: RowState;
  /** the row changed; `said` is the line a screen reader hears ("Forward added. 6 cards.") */
  onEdit: (next: RowState, said: string) => void;
  /** a tap was refused (the screen shows the sentence for a few seconds) */
  onRefused: (problem: RowProblem) => void;
  /** "New row" emptied the row (the banner says that Undo brings the cards back) */
  onEmptied: () => void;
  /** during a match: no tap changes the row */
  locked: boolean;
  /** the running move card and its number card (places in the row), or null */
  running: { card: number; numberCard: number | null } | null;
  /** which time of how many the running card runs (from the interpreter: nth, times) */
  nth: number;
  times: number;
  /** the cards before this place have run (they are paler) */
  doneBefore: number;
  /** the refusal shown in the bubble over the box, or null */
  refusal: string | null;
  /** grows with every refusal, so the bubble shakes again */
  refusals: number;
  /** what the hidden line reads out after a change */
  said: string;
}

/** A button of the row (48 x 48 px at least). */
const ROW_BUTTON =
  'cadet-touch inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-ink-700 hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35';

const Arrow = ({ left }: { left: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" focusable="false">
    <path d={left ? 'M14.5 5.5L8 12l6.5 6.5' : 'M9.5 5.5L16 12l-6.5 6.5'} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Bin = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
    </g>
  </svg>
);

export function CardRow(props: CardRowProps) {
  const { row, locked, running } = props;
  const listRef = useRef<HTMLDivElement>(null);
  /** the card the keyboard is on: 0 the start card, 1 ... n the cards of the row */
  const [focus, setFocus] = useState(0);
  const focusAt = Math.min(focus, row.cards.length);
  const bar = barIndex(row);

  const apply = (edit: RowEdit, said: (next: RowState) => string) => {
    if (!edit.ok) {
      props.onRefused(edit.problem);
      return;
    }
    if (edit.state !== row) props.onEdit(edit.state, said(edit.state));
  };
  const n = (state: RowState): number => state.cards.length;
  const words = CADET_WORDS.row;

  const add = (card: CardName) => !locked && apply(addCard(row, card), (next) => words.added(card, n(next)));
  const remove = () => {
    if (locked || row.cards.length === 0) return;
    const next = removeCard(row);
    props.onEdit(next, words.removed(n(next)));
  };
  const move = (direction: -1 | 1) => !locked && apply(moveCard(row, direction), () => words.moved);
  const doUndo = () => {
    if (locked || !canUndo(row)) return;
    const next = undo(row);
    props.onEdit(next, words.undone(n(next)));
  };
  const doRedo = () => {
    if (locked || !canRedo(row)) return;
    const next = redo(row);
    props.onEdit(next, words.redone(n(next)));
  };
  const clear = () => {
    if (locked || row.cards.length === 0) return;
    // (the banner says it, and the banner is read out: no second line here)
    props.onEdit(clearRow(row), '');
    props.onEmptied();
  };
  const select = (place: number | null) => !locked && props.onEdit(selectCard(row, place), '');

  // keep the bar - or, during a match, the running card - in view: the row scrolls by itself (never the page)
  useEffect(() => {
    const list = listRef.current;
    const target = list?.querySelector<HTMLElement>('[data-running="true"]') ?? list?.querySelector<HTMLElement>('[data-bar]');
    if (!list || !target) return;
    const box = list.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (r.left < box.left) list.scrollLeft -= box.left - r.left + 8;
    else if (r.right > box.right) list.scrollLeft += r.right - box.right + 8;
    if (r.top < box.top) list.scrollTop -= box.top - r.top + 4;
    else if (r.bottom > box.bottom) list.scrollTop += r.bottom - box.bottom + 4;
  }, [bar, row.cards.length, running?.card]);

  const focusCard = (at: number) => {
    const next = Math.max(0, Math.min(row.cards.length, at));
    setFocus(next);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    const place = focusAt - 1; // the place of the focused card in the row (-1: the start card)
    if (mod && !event.altKey && (event.key === 'z' || event.key === 'Z') && !event.shiftKey) {
      event.preventDefault();
      doUndo();
      return;
    }
    if (mod && (event.key === 'y' || event.key === 'Y' || ((event.key === 'z' || event.key === 'Z') && event.shiftKey))) {
      event.preventDefault();
      doRedo();
      return;
    }
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      if (locked || place < 0) return;
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const selected = selectCard({ ...row, selected: null }, place);
      const edit = moveCard(selected, direction);
      if (!edit.ok) {
        props.onRefused(edit.problem);
        return;
      }
      if (edit.state.cards !== selected.cards) {
        props.onEdit(edit.state, words.moved);
        if (edit.state.selected !== null) focusCard(edit.state.selected + 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusCard(focusAt - 1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusCard(focusAt + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusCard(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusCard(row.cards.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (place >= 0) select(place);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (locked || place < 0) return;
      const selected = selectCard({ ...row, selected: null }, place);
      const next = removeCard(selected);
      props.onEdit(next, words.removed(next.cards.length));
      focusCard(Math.min(focusAt, next.cards.length));
    }
  };

  const items: ReactNode[] = [];
  const caret = <span key="bar" data-bar aria-hidden="true" className="cadet-caret" />;
  for (let i = 0; i < row.cards.length; i++) {
    if (bar === i) items.push(caret);
    const card = row.cards[i];
    const isRunning = running !== null && (running.card === i || running.numberCard === i);
    const done = !isRunning && i < props.doneBefore;
    const selected = row.selected === i;
    const numberCard = isNumberCard(card);
    items.push(
      <div
        key={i}
        role="option"
        aria-selected={selected}
        aria-current={isRunning ? 'step' : undefined}
        aria-label={words.card(i + 1, card, numberCard)}
        tabIndex={focusAt === i + 1 ? 0 : -1}
        data-running={isRunning ? 'true' : undefined}
        data-card={card}
        onClick={(event) => {
          event.stopPropagation();
          setFocus(i + 1);
          select(i);
        }}
        className={`cadet-row-card relative shrink-0 rounded-xl ${selected || isRunning ? 'cadet-ring' : ''} ${isRunning ? '-translate-y-1' : ''} ${done ? 'opacity-70' : ''} ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <CodingCard card={card} className="cadet-row-svg" />
        {isRunning && numberCard && props.times > 1 && (
          <span aria-hidden="true" className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5">
            {Array.from({ length: props.times }, (_, k) => (
              <span key={k} className={`h-1.5 w-1.5 rounded-full ${k < props.nth ? 'bg-ink-900' : 'bg-ink-300'}`} />
            ))}
          </span>
        )}
      </div>,
    );
  }
  if (bar >= row.cards.length) items.push(caret);

  return (
    <div className="cadet-cards flex flex-col gap-1 lg:gap-2">
      <p className="cadet-heading max-lg:sr-only">{words.heading}</p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={words.label(row.cards.length)}
        aria-orientation="horizontal"
        aria-disabled={locked || undefined}
        onKeyDown={onKeyDown}
        onClick={() => row.selected !== null && select(null)}
        className="cadet-row"
      >
        <div
          role="option"
          aria-selected={false}
          aria-disabled="true"
          aria-label={words.startCard}
          tabIndex={focusAt === 0 ? 0 : -1}
          className="cadet-row-card cadet-start-card shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            setFocus(0);
          }}
        >
          <CodingCard card="start" className="cadet-row-svg" />
        </div>
        {items}
        {/* (the empty end of the row: a tap here lets go of the selected card) */}
        <span aria-hidden="true" className="min-w-6 flex-1 self-stretch" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ROW_BUTTON} onClick={doUndo} disabled={locked || !canUndo(row)} aria-label={words.undo}>
          <UndoIcon className="h-6 w-6" />
        </button>
        <button type="button" className={ROW_BUTTON} onClick={doRedo} disabled={locked || !canRedo(row)} aria-label={words.redo}>
          <RedoIcon className="h-6 w-6" />
        </button>
        <span className="mx-auto flex gap-2">
          <button type="button" className={ROW_BUTTON} onClick={() => move(-1)} disabled={locked || row.selected === null} aria-label={words.moveLeft}>
            <Arrow left />
          </button>
          <button type="button" className={ROW_BUTTON} onClick={() => move(1)} disabled={locked || row.selected === null} aria-label={words.moveRight}>
            <Arrow left={false} />
          </button>
          <button type="button" className={ROW_BUTTON} onClick={remove} disabled={locked || row.cards.length === 0} aria-label={words.remove}>
            <Bin />
          </button>
        </span>
        <button type="button" className={ROW_BUTTON} onClick={clear} disabled={locked || row.cards.length === 0} aria-label={words.clear}>
          <NewFileIcon className="h-6 w-6" />
        </button>
      </div>

      <p className="cadet-heading max-lg:sr-only">{words.box}</p>
      <div className="relative">
        {props.refusal !== null && (
          <p key={props.refusals} aria-hidden="true" className="cadet-bubble">
            {props.refusal}
          </p>
        )}
        <div className="cadet-box" role="group" aria-label={words.box}>
          {CARD_NAMES.map((card) => (
            <button
              key={card}
              type="button"
              aria-label={words.add(card)}
              data-add={card}
              disabled={locked}
              onClick={() => add(card)}
              className="cadet-box-card flex items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CodingCard card={card} className="cadet-box-svg" />
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite" data-row-said>
        {props.said}
      </p>
    </div>
  );
}
