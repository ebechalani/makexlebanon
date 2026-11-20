/**
 * "My own map" (./map-editor.ts, design 7.8 and 5.4): every tap that breaks a rule of the game is
 * refused with its sentence and changes nothing; a tap that keeps the rules moves the thing; the
 * code under the board follows every tap; the lit squares are exactly the squares the game allows;
 * the solver's line says "found", never "possible".
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSquare, placeProblem, PRACTICE_MAPS, MAP_THINGS, readMapCode, scenarioProblems, type FireCadetScenario } from '../../fire-cadet/scenario';
import { findRowForAllPoints } from '../../fire-cadet/solver';
import { SOLVER_PAUSE_MS, boardSquares, editorCode, isLit, liftThing, moveFocus, openEditor, tapSquare, type EditorState } from './map-editor';
import { solverLine } from './words';

const sq = (name: string) => {
  const square = parseSquare(name);
  assert.ok(square, name);
  return square;
};
const P1 = PRACTICE_MAPS[0];
const lift = (state: EditorState, ...things: Parameters<typeof liftThing>[1][]): EditorState => things.reduce(liftThing, state);

test('the editor opens with the map on the stage, nothing lifted, the keyboard on the start square', () => {
  const state = openEditor(P1);
  assert.equal(state.scenario, P1);
  assert.equal(state.lifted, null);
  assert.equal(state.refusal, null);
  assert.deepEqual(state.focus, sq('D7'));
  assert.equal(editorCode(state), 'P1');
});

test('every refused tap says why, with the words of design 7.8, and changes nothing', () => {
  const cases: [Parameters<typeof liftThing>[1], string, string][] = [
    ['fire', 'C3', 'The Fire can be at the School, the Factory, the House or the Bakery.'],
    ['fire', 'D4', 'The Fire can be at the School, the Factory, the House or the Bakery.'],
    ['water', 'C6', 'The Water starts on A6, B6, A7 or B7.'],
    ['cat', 'D7', 'Nothing can stand where the robot starts.'],
    ['road-closed', 'D7', 'Nothing can stand where the robot starts.'],
    ['cat', 'D4', 'The Cat cannot start in the Safe Zone.'],
    ['person', 'A5', 'The Injured Person cannot start in the Hospital.'],
    ['road-closed', 'G3', 'An obstacle stands on a road, not on a marked place.'],
    ['broken-vehicle', 'D1', 'An obstacle stands on a road, not on a marked place.'],
    ['cat', 'C5', 'This square is taken.'],
  ];
  for (const [thing, square, words] of cases) {
    const before = lift(openEditor(P1), thing);
    const after = tapSquare(before, sq(square));
    assert.equal(after.refusal, words, `${thing} on ${square}`);
    assert.equal(after.scenario, P1, `${thing} on ${square}: the map is unchanged`);
    assert.equal(after.lifted, thing, 'the thing stays lifted');
    assert.equal(editorCode(after), 'P1');
  }
  // a thing on a square another thing takes - the Water on the square of the Equipment of map 6 (A7)
  const six = lift(openEditor(PRACTICE_MAPS[5]), 'water');
  assert.equal(tapSquare(six, sq('A7')).refusal, 'This square is taken.');
});

test('a tap that keeps the rules: the thing stands there, nothing is lifted, the code follows', () => {
  let state = lift(openEditor(P1), 'cat');
  state = tapSquare(state, sq('G3'));
  assert.equal(state.lifted, null);
  assert.equal(state.refusal, null);
  assert.deepEqual(state.scenario.cat, sq('G3'), 'the Cat may stand on a marked place that is not its own target (N12)');
  assert.equal(editorCode(state), 'S-A6-G3-C5-C7-E3-F5-F7');
  // the Fire goes to a place; the code's first letter follows
  state = tapSquare(lift(state, 'fire'), sq('G5'));
  assert.equal(state.scenario.fire, 'bakery');
  assert.equal(editorCode(state), 'B-A6-G3-C5-C7-E3-F5-F7');
  // an obstacle to a road square
  state = tapSquare(lift(state, 'fallen-tree'), sq('B2'));
  assert.equal(editorCode(state), 'B-A6-G3-C5-C7-E3-B2-F7');
  // the map can always be played, and its code reads back to it
  assert.deepEqual(scenarioProblems(state.scenario), []);
  const reading = readMapCode(editorCode(state));
  assert.ok(reading.ok && reading.scenario.fire === 'bakery');
  // putting everything back where it was gives practice map 1 - and its short code
  state = tapSquare(lift(state, 'cat'), sq('D5'));
  state = tapSquare(lift(state, 'fire'), sq('A1'));
  state = tapSquare(lift(state, 'fallen-tree'), sq('F5'));
  assert.equal(editorCode(state), 'P1');
});

test('tap a thing in the tray again: it is put down; with nothing lifted, a tap on a square lifts what stands there', () => {
  assert.equal(lift(openEditor(P1), 'cat', 'cat').lifted, null);
  assert.equal(lift(openEditor(P1), 'cat', 'water').lifted, 'water');
  assert.equal(tapSquare(openEditor(P1), sq('D5')).lifted, 'cat');
  assert.equal(tapSquare(openEditor(P1), sq('E3')).lifted, 'road-closed');
  // the School holds only the Fire (a flat sign): the Fire is lifted
  assert.equal(tapSquare(openEditor(P1), sq('A1')).lifted, 'fire');
  // an empty square lifts nothing
  assert.equal(tapSquare(openEditor(P1), sq('B2')).lifted, null);
});

test('the lit squares are exactly the squares the game allows for the lifted thing (every thing, every square, every practice map)', () => {
  for (const map of PRACTICE_MAPS) {
    for (const thing of MAP_THINGS) {
      const state = lift(openEditor(map), thing);
      const board = boardSquares(state);
      assert.equal(board.length, 49);
      for (const square of board) assert.equal(square.lit, placeProblem(map, thing, square.square) === null, `${thing} on ${square.name}`);
    }
  }
  // nothing lifted: nothing is lit
  assert.ok(boardSquares(openEditor(P1)).every((square) => !square.lit));
  assert.equal(isLit(openEditor(P1), sq('B2')), false);
});

test('the board for a screen reader: every square says its name and what stands on it', () => {
  const board = boardSquares(openEditor(P1));
  const label = (name: string): string | undefined => board.find((square) => square.name === name)?.label;
  assert.equal(label('D5'), 'D5: Cat');
  assert.equal(label('D7'), 'D7: the robot starts here');
  assert.equal(label('C3'), 'C3: empty');
  assert.equal(label('A1'), 'A1: Fire');
  assert.equal(label('E3'), 'E3: Road Closed');
  assert.equal(board[0].name, 'A1');
  assert.equal(board[48].name, 'G7');
});

test('the keyboard on the board: the arrow keys move by one square and stop at the edge; Enter is a tap', () => {
  let state = openEditor(P1);
  state = moveFocus(state, 0, 1);
  assert.deepEqual(state.focus, sq('D7'), 'D7 is the last row');
  state = moveFocus(moveFocus(state, -1, 0), 0, -2);
  assert.deepEqual(state.focus, sq('C5'));
  state = moveFocus(state, -10, -10);
  assert.deepEqual(state.focus, sq('A1'));
  // Enter on a square is tapSquare on the keyboard's square: it moves the keyboard there too
  assert.deepEqual(tapSquare(openEditor(P1), sq('F2')).focus, sq('F2'));
});

test('the solver\'s line: "found" with its moves and seconds, or "found no row" - never "possible"', () => {
  assert.equal(SOLVER_PAUSE_MS, 150);
  assert.equal(solverLine(findRowForAllPoints(P1)), 'This simulator found a row for all 25 points: 27 moves, 52.1 seconds.');
  assert.equal(solverLine({ found: false }), 'This simulator found no row for all 25 points inside 120 seconds.');
  // a map with the Cat shut in the corner G7 by two obstacles (F7, G6): no row reaches it
  const shut: FireCadetScenario = { ...P1, cat: sq('G7'), obstacles: [sq('F7'), sq('G6'), sq('E3')] };
  assert.deepEqual(scenarioProblems(shut), []);
  assert.equal(solverLine(findRowForAllPoints(shut)), 'This simulator found no row for all 25 points inside 120 seconds.');
  for (const line of [solverLine(findRowForAllPoints(P1)), solverLine({ found: false })]) assert.doesNotMatch(line, /possible/i);
});
