'use client';

/**
 * Mini's direction panel (design 7.5): a yellow square with round corners and a white bar along
 * its bottom edge, like the organiser's panel, with the four blue arrow cards in a cross - Forward
 * at the top, Turn left on the left, Turn right on the right, Backward at the bottom (A4).
 *
 *   - Before GO and after the end the cards are pale and do nothing: "Press GO first."
 *   - One tap is one whole move (../../fire-cadet/cards.ts createPanelVM). The card of the running
 *     move has a white ring; a card tapped during a move gets a dashed ring until its move starts
 *     (N7: the newest tap is kept for after the move).
 *   - A tap holds the engine's button down for a few ticks (the screen takes care of that:
 *     FireCadetSimulator.tsx), so a tap shorter than one frame is not lost.
 *   - Enter or Space on a card is a tap; the arrow keys too (FireCadetSimulator.tsx).
 */
import type { KeyboardEvent, PointerEvent } from 'react';
import type { MoveCard } from '../../fire-cadet/cards';
import { CodingCard } from './CodingCard';
import { CADET_WORDS } from './words';

export interface DirectionPanelProps {
  /** the match runs: the cards can be tapped */
  live: boolean;
  /** the move that runs now, and the tap kept for after it */
  current: MoveCard | null;
  waiting: MoveCard | null;
  /** a card is pressed (down) or let go (up) */
  onTap: (move: MoveCard, down: boolean) => void;
}

/** Where each card stands in the cross (column, row of a 3 x 3 grid). */
const PLACE: Readonly<Record<MoveCard, string>> = {
  forward: 'col-start-2 row-start-1',
  left: 'col-start-1 row-start-2',
  right: 'col-start-3 row-start-2',
  backward: 'col-start-2 row-start-3',
};

const ORDER: readonly MoveCard[] = ['forward', 'left', 'right', 'backward'];

export function DirectionPanel({ live, current, waiting, onTap }: DirectionPanelProps) {
  const words = CADET_WORDS.panel;
  const press = (move: MoveCard) => (event: PointerEvent<HTMLButtonElement>) => {
    if (!live || (event.pointerType === 'mouse' && event.button !== 0)) return;
    // (the finger keeps the card: a slide off it still lets it go - see onPointerUp below)
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onTap(move, true);
  };
  const letGo = (move: MoveCard) => () => onTap(move, false);
  const key = (move: MoveCard, down: boolean) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    // (a key held down counts once)
    if (down && event.repeat) return;
    if (live) onTap(move, down);
  };
  return (
    <div className="flex flex-col items-center gap-1" data-panel-block>
      <div role="group" aria-label={words.label} className="cadet-panel">
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          {ORDER.map((move) => (
            <button
              key={move}
              type="button"
              aria-label={words.card[move]}
              aria-disabled={!live || undefined}
              data-move={move}
              data-state={current === move ? 'running' : waiting === move ? 'kept' : undefined}
              onPointerDown={press(move)}
              onPointerUp={letGo(move)}
              onPointerCancel={letGo(move)}
              onKeyDown={key(move, true)}
              onKeyUp={key(move, false)}
              onContextMenu={(event) => event.preventDefault()}
              className={`cadet-panel-card ${PLACE[move]} rounded-2xl ${live ? '' : 'opacity-45'} ${current === move ? 'cadet-ring' : ''} ${waiting === move ? 'cadet-ring-dashed' : ''}`}
            >
              <CodingCard card={move} upright className="h-full w-full" />
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-sm font-semibold text-ink-700" data-panel-line>
        {live ? words.oneTap : words.goFirst}
      </p>
    </div>
  );
}
