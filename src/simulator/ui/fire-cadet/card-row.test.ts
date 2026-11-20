/**
 * Junior's row of coding cards (./card-row.ts, design 7.3 and 4.3): what every tap does, every
 * refusal with its words, Undo and Redo - and, over 10,000 random taps, that the row is never
 * invalid and never longer than the game allows.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_NAMES, ROW_PROBLEM_WORDS, cardsFromText, cardsToText, readCards, rowProblem, type CardName } from '../../fire-cadet/cards';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { UNDO_STEPS, addCard, barIndex, canRedo, canUndo, clearRow, moveCard, redo, removeCard, replaceRow, rowOf, selectCard, undo, type RowEdit, type RowState } from './card-row';

const row = (text: string): RowState => rowOf(cardsFromText(text));
const ok = (edit: RowEdit): RowState => {
  assert.ok(edit.ok, edit.ok ? '' : `refused: ${edit.problem}`);
  return edit.state;
};
const text = (state: RowState): string => cardsToText(state.cards);

test('add: a card goes in at the bar; with nothing selected the bar is at the end of the row', () => {
  let s = rowOf();
  assert.equal(barIndex(s), 0);
  s = ok(addCard(s, 'forward'));
  s = ok(addCard(s, 'x3'));
  s = ok(addCard(s, 'left'));
  assert.equal(text(s), 'F3 L');
  assert.equal(s.selected, null);
  assert.equal(barIndex(s), 3);
});

test('select: the bar moves behind the selected card - behind its number card when it has one - and a tap in the box puts the card there', () => {
  let s = row('F3 L F');
  s = selectCard(s, 0);
  assert.equal(barIndex(s), 2, 'behind the x3 of the selected Forward');
  s = ok(addCard(s, 'right'));
  assert.equal(text(s), 'F3 R L F');
  // the bar moved behind the new card, which is now the selected one
  assert.equal(s.selected, 2);
  s = ok(addCard(s, 'x2'));
  assert.equal(text(s), 'F3 R2 L F');
  // a number card selected: the bar is right behind it
  s = selectCard(s, 1);
  assert.equal(barIndex(s), 2);
  // tap the selected card again: let go, the bar is at the end again
  s = selectCard(s, 1);
  assert.equal(s.selected, null);
  assert.equal(barIndex(s), s.cards.length);
  // "the empty end of the row": select(null)
  assert.equal(selectCard(selectCard(s, 0), null).selected, null);
});

test('refusals: a number card first, a second number card for an arrow, a full row - each with the game\'s words', () => {
  const first = addCard(rowOf(), 'x2');
  assert.deepEqual(first, { ok: false, problem: 'number-first' });
  assert.equal(ROW_PROBLEM_WORDS['number-first'], 'Put an arrow card first.');
  const twice = addCard(row('F3'), 'x2');
  assert.deepEqual(twice, { ok: false, problem: 'number-twice' });
  assert.equal(ROW_PROBLEM_WORDS['number-twice'], 'One number card for each arrow.');
  // the arrow before the bar has a number card already, even when it is selected in the middle of the row
  assert.deepEqual(addCard(selectCard(row('F3 L'), 0), 'x4'), { ok: false, problem: 'number-twice' });
  // full: 70 cards
  const full = rowOf(Array.from({ length: FIRE_CADET.MAX_ROW_CARDS }, () => 'right' as CardName));
  assert.deepEqual(addCard(full, 'forward'), { ok: false, problem: 'full' });
  assert.equal(ROW_PROBLEM_WORDS.full, 'The row is full: 70 cards.');
  // a refused tap changes nothing: no step of Undo either
  assert.equal(canUndo(row('F3')), false);
});

test('remove: the selected card, or the last one; an arrow takes its number card with it', () => {
  let s = row('F3 L R2');
  s = removeCard(s);
  assert.equal(text(s), 'F3 L R', 'the last card: the x2 alone');
  s = removeCard(selectCard(s, 0));
  assert.equal(text(s), 'L R', 'the Forward and its x3');
  assert.equal(s.selected, null);
  s = removeCard(selectCard(row('F3 L'), 1));
  assert.equal(text(s), 'F L', 'a number card alone');
  assert.equal(removeCard(rowOf()).cards.length, 0);
});

test('move: an arrow moves with its number card past the whole piece beside it; a number card moves alone, only behind an arrow without one', () => {
  // (places in the row: F 0, x3 1, L 2, R 3)
  let s = selectCard(row('F3 L R'), 3);
  s = ok(moveCard(s, -1));
  assert.equal(text(s), 'F3 R L');
  assert.equal(s.selected, 2, 'the moved card stays selected');
  s = ok(moveCard(s, -1));
  assert.equal(text(s), 'R F3 L');
  assert.equal(s.selected, 0);
  // the Forward with its x3, to the right past L
  s = ok(moveCard(selectCard(s, 1), 1));
  assert.equal(text(s), 'R L F3');
  assert.equal(s.selected, 2);
  // at the end of the row: nothing happens
  const end = moveCard(s, 1);
  assert.ok(end.ok && end.state === s);
  // a number card alone: behind an arrow without one - fine
  s = ok(moveCard(selectCard(row('F3 L'), 1), 1));
  assert.equal(text(s), 'F L3');
  // ... to the front: "A number card comes after an arrow."
  assert.deepEqual(moveCard(selectCard(row('F3 L'), 1), -1), { ok: false, problem: 'number-alone' });
  assert.equal(ROW_PROBLEM_WORDS['number-alone'], 'A number card comes after an arrow.');
  // ... behind an arrow that has one: "One number card for each arrow."
  assert.deepEqual(moveCard(selectCard(row('F3 L2'), 1), 1), { ok: false, problem: 'number-twice' });
  // nothing selected: nothing happens
  const none = moveCard(row('F L'), 1);
  assert.ok(none.ok && none.state.cards.length === 2);
});

test('undo and redo: every change is one step; a new change forgets Redo; 100 steps are kept', () => {
  let s = rowOf();
  s = ok(addCard(s, 'forward'));
  s = ok(addCard(s, 'x2'));
  s = removeCard(s);
  assert.equal(text(s), 'F');
  s = undo(s);
  assert.equal(text(s), 'F2');
  s = undo(s);
  assert.equal(text(s), 'F');
  assert.ok(canRedo(s));
  s = redo(s);
  assert.equal(text(s), 'F2');
  s = ok(addCard(s, 'left'));
  assert.equal(canRedo(s), false);
  // "New row": empty, and Undo brings the cards back
  s = clearRow(s);
  assert.equal(s.cards.length, 0);
  assert.equal(text(undo(s)), 'F2 L');
  // an example loaded is one step
  s = replaceRow(s, cardsFromText('F3 B3'));
  assert.equal(text(s), 'F3 B3');
  assert.equal(text(undo(s)), '');
  // at most UNDO_STEPS steps
  let many = rowOf();
  for (let i = 0; i < UNDO_STEPS + 20; i++) many = i % 2 === 0 ? ok(addCard(many, 'left')) : removeCard(many);
  assert.equal(many.past.length, UNDO_STEPS);
  assert.equal(UNDO_STEPS, 100);
});

test('10,000 random taps: the row is always valid and never longer than 70 cards (the screen never builds another row)', () => {
  // a small fixed random generator, so a failure can be repeated
  let seed = 2027;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  let s = rowOf();
  let refused = 0;
  for (let i = 0; i < 10_000; i++) {
    const r = rnd();
    let edit: RowEdit | null = null;
    if (r < 0.55) edit = addCard(s, CARD_NAMES[Math.floor(rnd() * CARD_NAMES.length)]);
    else if (r < 0.65) s = selectCard(s, s.cards.length === 0 ? null : Math.floor(rnd() * (s.cards.length + 1)));
    else if (r < 0.72) s = removeCard(s);
    else if (r < 0.84) edit = moveCard(s, rnd() < 0.5 ? -1 : 1);
    else if (r < 0.9) s = undo(s);
    else if (r < 0.96) s = redo(s);
    else if (r < 0.97) s = clearRow(s);
    else s = selectCard(s, null);
    if (edit !== null) {
      if (edit.ok) s = edit.state;
      else refused++;
    }
    assert.equal(rowProblem(s.cards), null, `step ${i}: ${text(s)}`);
    assert.ok(s.cards.length <= FIRE_CADET.MAX_ROW_CARDS, `step ${i}: ${s.cards.length} cards`);
    assert.deepEqual(readCards({ cards: s.cards }), [...s.cards], 'the row reads back as it is');
    assert.ok(s.selected === null || (s.selected >= 0 && s.selected < s.cards.length), `step ${i}: selected ${s.selected}`);
  }
  assert.ok(refused > 100, `the random taps were refused ${refused} times: the refusals were tried`);
});
