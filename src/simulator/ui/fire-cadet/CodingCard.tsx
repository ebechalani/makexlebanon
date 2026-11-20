/**
 * The mTiny coding cards, drawn as inline SVG in a box of 64 x 64 units (design 8.4). Our own
 * simple drawings in the colours of the cards seen at the organiser's events - no artwork of the
 * maker is copied.
 *
 *   move cards     blue, round corners, a small round tab on the right and a matching notch on the
 *                  left (they "lock" like the real pieces), a white bar near the left edge and a
 *                  thick white arrow: Forward points away from the bar, Backward at it, Turn left
 *                  bends up, Turn right bends down (in the row the cards lie with the bar on the
 *                  left, as in the photos of the organiser's events: design 4.2)
 *   number cards   the same shape in yellow, "x2" ... "x5" in dark ink (white on yellow, as on the
 *                  real cards, is too pale to read on a screen)
 *   start card     yellow, its left end a half circle, a white ring with a white triangle
 *   on the panel   the four move cards turned upright (Forward points up), without tab and notch
 *
 * Decoration only: every card on the screen also has its name (an aria-label).
 */
import type { CardName, MoveCard } from '../../fire-cadet/cards';
import { isNumberCard } from '../../fire-cadet/cards';

/** The colours of the cards (design 8.4). */
export const CARD_BLUE = '#1f6fe5';
export const CARD_YELLOW = '#f5b301';
export const CARD_INK = '#3b2a00';

/** A card with a tab on the right and a notch on the left. */
const PIECE = 'M13 5H47A10 10 0 0 1 57 15V26A6 6 0 0 1 57 38V49A10 10 0 0 1 47 59H13A10 10 0 0 1 3 49V38A6 6 0 0 0 3 26V15A10 10 0 0 1 13 5Z';
/** The start card: its left end a half circle, a tab on the right. */
const START_PIECE = 'M32 5H47A10 10 0 0 1 57 15V26A6 6 0 0 1 57 38V49A10 10 0 0 1 47 59H32A27 27 0 0 1 32 5Z';

/** The white arrow of each move card, lying in the row (bar on the left). [shaft, head] */
const ARROWS: Readonly<Record<MoveCard, readonly [string, string]>> = {
  forward: ['M19 32H42', 'M38 21L52 32L38 43Z'],
  backward: ['M26 32H48', 'M31 21L17 32L31 43Z'],
  left: ['M19 43H29Q40 43 40 32V27', 'M30 29L40 15L50 29Z'],
  right: ['M19 21H29Q40 21 40 32V37', 'M30 35L40 49L50 35Z'],
};

export interface CodingCardProps {
  card: CardName | 'start';
  /** on the direction panel: upright, without tab and notch */
  upright?: boolean;
  className?: string;
}

export function CodingCard({ card, upright = false, className = 'h-14 w-14' }: CodingCardProps) {
  if (card === 'start') {
    return (
      <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d={START_PIECE} fill={CARD_YELLOW} stroke="#b45309" strokeWidth={1.2} />
        <circle cx={32} cy={32} r={14} fill="none" stroke="#ffffff" strokeWidth={4} />
        <path d="M27.5 24.5L40 32L27.5 39.5Z" fill="#ffffff" />
      </svg>
    );
  }
  if (isNumberCard(card)) {
    return (
      <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d={PIECE} fill={CARD_YELLOW} stroke="#b45309" strokeWidth={1.2} />
        <text x={31} y={33} textAnchor="middle" dominantBaseline="central" fontSize={25} fontWeight={800} fill={CARD_INK} fontFamily="ui-sans-serif, system-ui, sans-serif">
          {card}
        </text>
      </svg>
    );
  }
  const [shaft, head] = ARROWS[card];
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {upright ? (
        <rect x={4} y={4} width={56} height={56} rx={10} fill={CARD_BLUE} stroke="#1e3a8a" strokeWidth={1.2} />
      ) : (
        <path d={PIECE} fill={CARD_BLUE} stroke="#1e3a8a" strokeWidth={1.2} />
      )}
      {/* (upright: the drawing of the row turned a quarter to the left, so Forward points up and the bar lies at the bottom) */}
      <g transform={upright ? 'rotate(-90 32 32)' : undefined}>
        <rect x={10} y={21} width={4} height={22} rx={1.5} fill="#ffffff" />
        <path d={shaft} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <path d={head} fill="#ffffff" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
      </g>
    </svg>
  );
}
