/**
 * Fire Cadet: the one table of numbers (numbers.ts) - the limits the sizes must keep (design 0.3),
 * the numbers worked out from others, and the squares.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESTORE_CLEARANCE, SIM_DT, TABLE_MARGIN } from '../core/engine';
import { FIRE_CADET, frontReach, gridBound, spot, squareRect, ticks } from './numbers';

const f = FIRE_CADET;

test('the limits of the sizes (design 0.3): if the organiser sends real sizes that break one, this says which', () => {
  assert.ok(
    frontReach() <= f.GRID_PITCH / 2,
    `the front of the robot with its sticks (${frontReach()} mm) must reach at most half a square (${f.GRID_PITCH / 2} mm): ` +
      'otherwise the robot does not fit inside one square, so there is no legal start and no return bonus (sticks of 33 mm and more)',
  );
  assert.ok(
    f.STICK_LENGTH > f.ITEM_BASE / 2,
    `a stick (${f.STICK_LENGTH} mm) must reach past the middle of an item (${f.ITEM_BASE / 2} mm ahead of the body): ` +
      'otherwise the item is not held in a turn (sticks of 20 mm and less; an item base of twice the stick length and more)',
  );
  assert.ok(
    f.ITEM_BASE <= f.STICK_GAP,
    `an item (${f.ITEM_BASE} mm) must fit between the sticks (${f.STICK_GAP} mm apart)`,
  );
  assert.ok(
    f.STICK_LENGTH < f.ITEM_BASE,
    `a stick (${f.STICK_LENGTH} mm) must be shorter than an item (${f.ITEM_BASE} mm): otherwise an item pushed against an ` +
      'obstacle would also be the sticks touching it (the same 1 point, D5, but the referee would call it the robot\'s touch)',
  );
  assert.equal(frontReach(), 87);
});

test('the numbers worked out from others', () => {
  // A5: the sticks on the left and the right edge of the front
  assert.equal(f.STICK_GAP, f.BODY_WIDTH - 2 * f.STICK_THICKNESS);
  assert.equal(f.STICK_GAP, 90.5);
  // N9: 70 cards, worked out in ticks
  assert.equal(
    f.MAX_ROW_CARDS,
    Math.floor((ticks(f.MATCH_SECONDS) + ticks(f.REST_SECONDS)) / (ticks(f.TURN_SECONDS) + ticks(f.REST_SECONDS))),
  );
  assert.equal(f.MAX_ROW_CARDS, 70);
  // ... because 70 turns fit in the match and 71 do not
  const turnsTicks = (n: number): number => n * ticks(f.TURN_SECONDS) + (n - 1) * ticks(f.REST_SECONDS);
  assert.ok(turnsTicks(70) <= ticks(f.MATCH_SECONDS));
  assert.ok(turnsTicks(71) > ticks(f.MATCH_SECONDS));
  assert.equal(turnsTicks(70) / ticks(1), 118.6);
  assert.equal(turnsTicks(71) / ticks(1), 120.3);
  // RULE l.254: 25 = 4 x 5 + 5
  assert.equal(f.MAX_POINTS, 4 * f.POINTS_ITEM + f.POINTS_RETURN);
  assert.equal(f.MAX_POINTS, 25);
  // A1: one card is one square
  assert.equal(f.STEP, f.GRID_PITCH);
  // the turning point is the middle of the body (N2)
  assert.equal(f.TURNING_POINT_TO_FRONT, f.BODY_LENGTH / 2);
});

test("the engine's own numbers are imported, not copied", () => {
  assert.equal(f.TABLE_MARGIN, TABLE_MARGIN);
  assert.equal(f.SIM_DT, SIM_DT);
  assert.equal(f.RESTORE_CLEARANCE, RESTORE_CLEARANCE);
  // D1: the room the referee needs to put an obstacle back is more than its touching distance
  assert.ok(f.RESTORE_CLEARANCE > f.TOUCH_MM);
});

test('ticks: the interpreter rounds a time to whole ticks', () => {
  assert.equal(ticks(f.MOVE_SECONDS), 160);
  assert.equal(ticks(f.TURN_SECONDS), 130);
  assert.equal(ticks(f.REST_SECONDS), 40);
  assert.equal(ticks(0.325), 33); // a tuned time that is not a whole number of ticks
});

test('the squares: target areas from line middle to line middle, spots on the lattice of N1', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map((k) => Math.round(gridBound(k) * 1000) / 1000),
    [0, 179.764, 357.764, 535.764, 713.764, 891.764, 1069.764, 1250],
  );
  assert.deepEqual(squareRect({ col: 0, row: 0 }), { x: 0, y: 0, w: 179.764, h: 179.764 });
  const g7 = squareRect({ col: 6, row: 6 });
  assert.equal(Math.round(g7.x * 1000) / 1000, 1069.764);
  assert.equal(Math.round(g7.w * 1000) / 1000, 180.236);
  const d7 = spot({ col: 3, row: 6 });
  assert.equal(Math.round(d7.x * 1000) / 1000, 624.764);
  assert.equal(Math.round(d7.y * 1000) / 1000, 1158.764);
  assert.equal(Math.round(spot({ col: 0, row: 0 }).x * 1000) / 1000, 90.764);
});
