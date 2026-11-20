/**
 * The row of coding cards a child builds (Junior), as pure functions: what every tap does to the
 * row, and which taps are refused (design 7.3, 4.3).
 *
 *   - The row begins with the yellow start card. It is not in `cards`: it is always there and can
 *     be neither selected, moved nor removed.
 *   - The BAR is where the next card goes: behind the selected card (behind its number card, if it
 *     has one), or at the end of the row when nothing is selected.
 *   - A tap in the card box adds a card at the bar; the bar moves behind it.
 *   - A number card goes behind the arrow before the bar. If that arrow has a number card already,
 *     or there is no arrow before the bar, the tap is refused, and the screen says why.
 *   - The bin removes the selected card, or the last card. Removing an arrow removes its number
 *     card too.
 *   - The two arrow buttons move the selected card one place. An arrow takes its number card along
 *     (an arrow and its number card are one piece of the row); a number card moves alone, and only
 *     to a place behind an arrow that has none.
 *   - Every change is one step of Undo; 100 steps are kept.
 *
 * So the row is ALWAYS valid (../../fire-cadet/cards.ts rowProblem): an edit whose result would not
 * be is not done. The words of a refusal are the game's own (ROW_PROBLEM_WORDS).
 *
 * Plain TypeScript (no DOM, no React), so it is tested under Node.
 */
import { isMoveCard, isNumberCard, rowProblem, type CardName, type RowProblem } from '../../fire-cadet/cards';

/** How many steps of Undo are kept. */
export const UNDO_STEPS = 100;

export interface RowState {
  /** the cards after the start card */
  readonly cards: readonly CardName[];
  /** the place of the selected card in `cards`, or null: then the bar is at the end of the row */
  readonly selected: number | null;
  /** the rows before each change, the newest last (at most UNDO_STEPS) */
  readonly past: readonly (readonly CardName[])[];
  /** the rows Undo went back from, the newest last */
  readonly future: readonly (readonly CardName[])[];
}

/** What an edit gives: the new row, or why it is refused. */
export type RowEdit = { ok: true; state: RowState } | { ok: false; problem: RowProblem };

/** A row with these cards, nothing selected, no history. */
export const rowOf = (cards: readonly CardName[] = []): RowState => ({ cards: [...cards], selected: null, past: [], future: [] });

/** Where the next card goes: the place in `cards` it will take. */
export function barIndex(state: Pick<RowState, 'cards' | 'selected'>): number {
  const { cards, selected } = state;
  if (selected === null || selected < 0 || selected >= cards.length) return cards.length;
  // behind the selected card, and behind its number card when it is an arrow that has one
  return isMoveCard(cards[selected]) && isNumberCard(cards[selected + 1]) ? selected + 2 : selected + 1;
}

/** The pieces of a row: each arrow with its number card, or a lone number card (never in a valid row). [first place, length] */
function pieces(cards: readonly CardName[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < cards.length; i++) {
    const length = isMoveCard(cards[i]) && isNumberCard(cards[i + 1]) ? 2 : 1;
    out.push([i, length]);
    i += length - 1;
  }
  return out;
}

/** The piece that holds the card at `place`: [index of the piece, its first place, its length]. */
function pieceOf(cards: readonly CardName[], place: number): [number, number, number] {
  const all = pieces(cards);
  const k = all.findIndex(([start, length]) => place >= start && place < start + length);
  return [k, all[k][0], all[k][1]];
}

/** A change of the row: the old cards go onto the Undo list, Redo is forgotten. */
function changed(state: RowState, cards: readonly CardName[], selected: number | null): RowState {
  const past = [...state.past, state.cards];
  return { cards, selected, past: past.slice(Math.max(0, past.length - UNDO_STEPS)), future: [] };
}

/** Tap a card in the box: it goes in at the bar, and the bar moves behind it. */
export function addCard(state: RowState, card: CardName): RowEdit {
  const at = barIndex(state);
  const cards = [...state.cards.slice(0, at), card, ...state.cards.slice(at)];
  const problem = rowProblem(cards, 'add');
  if (problem !== null) return { ok: false, problem };
  // at the end of the row the bar stays at the end; in the middle it is behind the new card, which is now the selected one
  const selected = state.selected === null ? null : at;
  return { ok: true, state: changed(state, cards, selected) };
}

/** Tap a card in the row: select it (the bar moves behind it), or let go of it when it is selected already. */
export function selectCard(state: RowState, place: number | null): RowState {
  if (place === null || place < 0 || place >= state.cards.length || place === state.selected) return { ...state, selected: null };
  return { ...state, selected: place };
}

/**
 * The bin: remove the selected card, or the last card when nothing is selected. Removing an arrow
 * removes its number card too. Afterwards nothing is selected: the bar is at the end again.
 * (An empty row: nothing happens - the same state comes back.)
 */
export function removeCard(state: RowState): RowState {
  if (state.cards.length === 0) return state;
  const place = state.selected ?? state.cards.length - 1;
  const length = isMoveCard(state.cards[place]) && isNumberCard(state.cards[place + 1]) ? 2 : 1;
  const cards = [...state.cards.slice(0, place), ...state.cards.slice(place + length)];
  return changed(state, cards, null);
}

/**
 * The two arrow buttons: move the selected card one place to the left (-1) or to the right (+1).
 * An arrow moves with its number card, past the whole piece beside it. A number card moves alone,
 * one card: refused when it would then not stand right behind an arrow without a number card.
 * Nothing selected, or already at that end of the row: nothing happens (the same state comes back).
 */
export function moveCard(state: RowState, direction: -1 | 1): RowEdit {
  const { cards, selected } = state;
  if (selected === null || selected < 0 || selected >= cards.length) return { ok: true, state };
  if (isNumberCard(cards[selected])) {
    const to = selected + direction;
    if (to < 0 || to >= cards.length) return { ok: true, state };
    const next = [...cards];
    [next[selected], next[to]] = [next[to], next[selected]];
    const problem = rowProblem(next, 'move');
    if (problem !== null) return { ok: false, problem };
    return { ok: true, state: changed(state, next, to) };
  }
  const all = pieces(cards);
  const [k, start, length] = pieceOf(cards, selected);
  const other = k + direction;
  if (other < 0 || other >= all.length) return { ok: true, state };
  const [otherStart, otherLength] = all[other];
  const mine = cards.slice(start, start + length);
  const theirs = cards.slice(otherStart, otherStart + otherLength);
  const first = Math.min(start, otherStart);
  const next = [...cards.slice(0, first), ...(direction < 0 ? [...mine, ...theirs] : [...theirs, ...mine]), ...cards.slice(first + length + otherLength)];
  const problem = rowProblem(next, 'move');
  if (problem !== null) return { ok: false, problem };
  return { ok: true, state: changed(state, next, direction < 0 ? first : first + otherLength) };
}

/** "New row": the row is empty. No question is asked - Undo brings the cards back. (Already empty: nothing happens.) */
export function clearRow(state: RowState): RowState {
  if (state.cards.length === 0) return { ...state, selected: null };
  return changed(state, [], null);
}

/** Put a whole row in at once - an example being loaded - as one step of Undo. */
export function replaceRow(state: RowState, cards: readonly CardName[]): RowState {
  return changed(state, [...cards], null);
}

export const canUndo = (state: RowState): boolean => state.past.length > 0;
export const canRedo = (state: RowState): boolean => state.future.length > 0;

/** Back one step. Nothing is selected afterwards. */
export function undo(state: RowState): RowState {
  if (!canUndo(state)) return state;
  const cards = state.past[state.past.length - 1];
  return { cards, selected: null, past: state.past.slice(0, -1), future: [...state.future, state.cards] };
}

/** Forward one step again. */
export function redo(state: RowState): RowState {
  if (!canRedo(state)) return state;
  const cards = state.future[state.future.length - 1];
  return { cards, selected: null, past: [...state.past, state.cards], future: state.future.slice(0, -1) };
}

/** The number card that belongs to the arrow at `place`, or null. */
export const numberCardOf = (cards: readonly CardName[], place: number): number | null =>
  isMoveCard(cards[place]) && isNumberCard(cards[place + 1]) ? place + 1 : null;

/** Is the card at `place` a number card (so its arrow is the card before it)? */
export const isNumberAt = (cards: readonly CardName[], place: number): boolean => isNumberCard(cards[place]);

// =============================================================================================
// The row in view when GO is pressed (a phone)
// =============================================================================================

/** The room left between the row and the map block above it (or the bar with the round button below it), in px. */
export const ROW_IN_VIEW_GAP = 8;

/** Top and bottom of something on the screen, in px from the top of the window. */
export interface Band {
  top: number;
  bottom: number;
}

/**
 * How far to scroll the page (px, + is down) so that the row stands in the band between the map
 * block, which sticks at the top of a phone's screen, and the bar of the round button, which sticks
 * at its bottom; 0 when it is in view already. The screen asks once, when GO is pressed: the child
 * may have scrolled down to the Map section, and then the row is hidden under the map block while
 * the robot runs it. (During the match the row itself keeps the running card in view.) A row
 * taller than the band shows its top.
 */
export function pageScrollToShow(row: Band, band: Band, gap: number = ROW_IN_VIEW_GAP): number {
  const top = band.top + gap;
  const bottom = band.bottom - gap;
  if (row.top < top) return row.top - top;
  if (row.bottom > bottom) return Math.min(row.bottom - bottom, row.top - top);
  return 0;
}
