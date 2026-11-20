/**
 * "My own map": the logic of the own-setup editor (design 7.8, 5.4), as pure functions.
 *
 * A teacher copies a combination: tap a thing in the tray (it is lifted), the squares it may go to
 * light up, tap one of them and the thing stands there. A tap on a square that is not lit changes
 * nothing and says why. The rules are the game's own (../../fire-cadet/scenario.ts placeProblem),
 * kept at every tap, so the map in the editor can always be played:
 *   the Fire at one of its four places; the Water on one of its four squares; the Cat, the Injured
 *   Person and the Equipment on any square that holds nothing else, except D7 and their own
 *   target; the obstacles on squares without a dashed frame; one thing per square.
 *
 * With nothing lifted, a tap on a square lifts what stands there (an item or an obstacle before
 * the Fire, which is a flat sign under them), so a thing can also be moved from the board.
 *
 * Plain TypeScript (no DOM, no React), so it is tested under Node.
 */
import { PLACES, START_SQUARE, sameSquare } from '../../fire-cadet/field';
import { FIRE_CADET, type Square } from '../../fire-cadet/numbers';
import { encodeScenario, placeProblem, squareName, thingsOn, withThing, type FireCadetScenario, type MapThing } from '../../fire-cadet/scenario';
import { CADET_WORDS, editorRefusal } from './words';

/** How long after the last tap the editor asks the solver again (ms): the line does not flicker while a teacher taps fast. */
export const SOLVER_PAUSE_MS = 150;

export interface EditorState {
  readonly scenario: FireCadetScenario;
  /** the thing lifted from the tray (it has a ring), or null */
  readonly lifted: MapThing | null;
  /** why the last tap changed nothing, or null */
  readonly refusal: string | null;
  /** the square the keyboard is on (the board is one stop of Tab; the arrow keys move over it) */
  readonly focus: Square;
}

/** The editor, opened with the map on the stage. */
export const openEditor = (scenario: FireCadetScenario): EditorState => ({ scenario, lifted: null, refusal: null, focus: { ...START_SQUARE } });

/** Tap a thing in the tray: it is lifted. Tap it again: it is put back where it stands. */
export function liftThing(state: EditorState, thing: MapThing): EditorState {
  return { ...state, lifted: state.lifted === thing ? null : thing, refusal: null };
}

/** May the lifted thing go to this square? (No thing lifted: no square is lit.) */
export const isLit = (state: Pick<EditorState, 'scenario' | 'lifted'>, sq: Square): boolean =>
  state.lifted !== null && placeProblem(state.scenario, state.lifted, sq) === null;

/** What stands on a square, for the board: the things on it and whether the Fire is there. */
export function squareContents(s: FireCadetScenario, sq: Square): { things: MapThing[]; fire: boolean; start: boolean } {
  return { things: thingsOn(s, sq), fire: sameSquare(PLACES[s.fire], sq), start: sameSquare(START_SQUARE, sq) };
}

/**
 * Tap a square of the board.
 *   - A thing is lifted and may stand there: it stands there now, and nothing is lifted.
 *   - A thing is lifted and may not: nothing changes, and `refusal` says why.
 *   - Nothing is lifted: what stands on the square is lifted (an item or an obstacle; the Fire when
 *     only the Fire is there). An empty square does nothing.
 */
export function tapSquare(state: EditorState, sq: Square): EditorState {
  const focus = { col: sq.col, row: sq.row };
  if (state.lifted === null) {
    const { things, fire } = squareContents(state.scenario, sq);
    const thing = things[0] ?? (fire ? 'fire' : null);
    return { ...state, lifted: thing, refusal: null, focus };
  }
  const problem = placeProblem(state.scenario, state.lifted, sq);
  if (problem !== null) return { ...state, refusal: editorRefusal(problem, state.lifted), focus };
  return { scenario: withThing(state.scenario, state.lifted, sq), lifted: null, refusal: null, focus };
}

/** The arrow keys on the board: the keyboard square moves by one, and stops at the edge. */
export function moveFocus(state: EditorState, dcol: number, drow: number): EditorState {
  const n = FIRE_CADET.GRID_COUNT;
  const col = Math.min(n - 1, Math.max(0, state.focus.col + dcol));
  const row = Math.min(n - 1, Math.max(0, state.focus.row + drow));
  return { ...state, focus: { col, row } };
}

/** The code under the board: it follows every tap ("P3" for a practice map, the long code otherwise). */
export const editorCode = (state: Pick<EditorState, 'scenario'>): string => encodeScenario(state.scenario);

/** Every square of the board, row by row from the top: its name, what is on it, whether it is lit, and its words for a screen reader. */
export function boardSquares(state: EditorState): { square: Square; name: string; things: MapThing[]; fire: boolean; start: boolean; lit: boolean; label: string }[] {
  const out = [];
  for (let row = 0; row < FIRE_CADET.GRID_COUNT; row++) {
    for (let col = 0; col < FIRE_CADET.GRID_COUNT; col++) {
      const square = { col, row };
      const name = squareName(square);
      const { things, fire, start } = squareContents(state.scenario, square);
      const shown: MapThing[] = fire ? ['fire', ...things] : things;
      out.push({ square, name, things, fire, start, lit: isLit(state, square), label: CADET_WORDS.editor.square(name, shown, start) });
    }
  }
  return out;
}
