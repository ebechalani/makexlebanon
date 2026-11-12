/**
 * Tests for the ruler of the stage (./ruler.ts) and for the small decisions of the stage
 * (./stage-view.ts: the Escape key, the Tab key in the enlarged stage, the hint line).
 *
 * What these tests protect: the ruler measures real millimetres of the mat - the same
 * millimetres the engine drives - whatever the size of the screen; its words say what the
 * robot would have to do; a click sets a point and only a pointer that moves drags one; and
 * Escape never throws away more than one step.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEG, distance, type Vec2 } from '../core/geometry';
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { Pose, ProgramJson } from '../core/types';
import { fireRescueGame, startPoseFor } from '../fire-rescue/game';
import { moveCm, program, script, turn, whenStart } from '../vm/builder';
import { fitView, viewToMat } from './render';
import {
  addRulerPoint,
  cmText,
  dragRulerPoint,
  EMPTY_RULER,
  followRobot,
  isRulerClick,
  MAX_RULER_POINTS,
  measureRuler,
  moveRulerPoint,
  removeLastRulerPoint,
  RULER_REACH,
  rulerClick,
  rulerHold,
  rulerLabels,
  rulerPointAt,
  rulerReading,
  rulerText,
  startsOnRobot,
  turnText,
  type Ruler,
  type RulerLabel,
} from './ruler';
import { escapeAction, readyHint, sizeButtonHint, tabStop } from './stage-view';

const MAT = { width: 1250, height: 1250 };
const ROBOT: Pose = { x: 625, y: 673.2, heading: 0 };

/** A ruler through these points; `robot` puts its first point on the robot. */
function line(points: Array<[number, number]>, robot: Pose | null = null): Ruler {
  let ruler = EMPTY_RULER;
  points.forEach(([x, y], i) => {
    ruler = addRulerPoint(ruler, { x, y }, i === 0 ? robot : null, MAT);
  });
  return ruler;
}

// =============================================================================================
// Setting, moving and removing points
// =============================================================================================

test('points are added in the order they are set, and the empty ruler is never changed', () => {
  const ruler = line([
    [100, 200],
    [400, 200],
    [400, 600],
  ]);
  assert.deepEqual(ruler.points, [
    { x: 100, y: 200 },
    { x: 400, y: 200 },
    { x: 400, y: 600 },
  ]);
  assert.equal(ruler.startHeading, null);
  assert.deepEqual(EMPTY_RULER, { points: [], startHeading: null });
});

test('a first point set on the robot snaps to its turning centre and remembers where the robot faces', () => {
  // the click was on the front of the robot, 90 mm ahead of the axle
  const ruler = addRulerPoint(EMPTY_RULER, { x: 630, y: 583 }, ROBOT, MAT);
  assert.deepEqual(ruler.points, [{ x: 625, y: 673.2 }]);
  assert.equal(ruler.startHeading, 0);
});

test('only the FIRST point snaps: later points on the robot stay where they were clicked', () => {
  let ruler = addRulerPoint(EMPTY_RULER, { x: 100, y: 100 }, null, MAT);
  ruler = addRulerPoint(ruler, { x: 630, y: 583 }, ROBOT, MAT);
  assert.deepEqual(ruler.points[1], { x: 630, y: 583 });
  assert.equal(ruler.startHeading, null);
});

test('a click on the table beside the mat measures to the edge of the mat', () => {
  const ruler = line([
    [-30, 400],
    [1290, 1300],
  ]);
  assert.deepEqual(ruler.points, [
    { x: 0, y: 400 },
    { x: 1250, y: 1250 },
  ]);
});

test('a full ruler takes no more points, and says so', () => {
  let ruler = EMPTY_RULER;
  for (let i = 0; i < MAX_RULER_POINTS; i++) ruler = addRulerPoint(ruler, { x: 10 + i * 50, y: 300 }, null, MAT);
  assert.equal(ruler.points.length, MAX_RULER_POINTS);
  assert.equal(addRulerPoint(ruler, { x: 5, y: 5 }, null, MAT), ruler, 'the same ruler comes back');
  assert.match(rulerText(ruler), /The ruler is full: 20 points\./);
});

test('a dragged point moves, the others stay', () => {
  const ruler = line([
    [100, 200],
    [400, 200],
    [400, 600],
  ]);
  const moved = moveRulerPoint(ruler, 1, { x: 500, y: 250 }, null, MAT);
  assert.deepEqual(moved.points, [
    { x: 100, y: 200 },
    { x: 500, y: 250 },
    { x: 400, y: 600 },
  ]);
  assert.deepEqual(ruler.points[1], { x: 400, y: 200 }, 'the ruler it came from is not changed');
  // dragged off the mat: it stops at the edge
  assert.deepEqual(moveRulerPoint(ruler, 2, { x: 2000, y: -50 }, null, MAT).points[2], { x: 1250, y: 0 });
  // a point that does not exist
  assert.equal(moveRulerPoint(ruler, 7, { x: 1, y: 1 }, null, MAT), ruler);
  assert.equal(moveRulerPoint(ruler, -1, { x: 1, y: 1 }, null, MAT), ruler);
});

test('the first point is tied to the robot exactly while it is on the robot', () => {
  const onRobot = line(
    [
      [625, 600],
      [625, 300],
    ],
    ROBOT,
  );
  assert.equal(onRobot.startHeading, 0);
  // dragged off the robot: a free point, no first turn any more
  const free = moveRulerPoint(onRobot, 0, { x: 300, y: 900 }, null, MAT);
  assert.deepEqual(free.points[0], { x: 300, y: 900 });
  assert.equal(free.startHeading, null);
  // dragged back onto the robot (which was turned in the meantime): it snaps again
  const turned: Pose = { ...ROBOT, heading: 90 * DEG };
  const back = moveRulerPoint(free, 0, { x: 640, y: 650 }, turned, MAT);
  assert.deepEqual(back.points[0], { x: 625, y: 673.2 });
  assert.equal(back.startHeading, 90 * DEG);
  // another point dragged over the robot does not snap and does not change the start
  const other = moveRulerPoint(onRobot, 1, { x: 640, y: 650 }, ROBOT, MAT);
  assert.deepEqual(other.points[1], { x: 640, y: 650 });
  assert.equal(other.startHeading, 0);
});

test('a first point that is dragged off the mat stops at the edge of the mat, like every other point', () => {
  const free = line([
    [200, 600],
    [1000, 600],
  ]);
  const moved = moveRulerPoint(free, 0, { x: -400, y: 600 }, null, MAT);
  assert.deepEqual(moved.points[0], { x: 0, y: 600 });
  assert.equal(rulerReading(moved), '100.0 cm');
  // also a first point that was on the robot and is dragged away from it, past the corner of the mat
  const onRobot = line(
    [
      [625, 600],
      [625, 300],
    ],
    ROBOT,
  );
  const away = moveRulerPoint(onRobot, 0, { x: 1900, y: 1300 }, null, MAT);
  assert.deepEqual(away.points[0], { x: 1250, y: 1250 });
  assert.equal(away.startHeading, null);
});

test('Escape takes the last point away, down to the empty ruler', () => {
  const three = line(
    [
      [625, 600],
      [625, 300],
      [900, 300],
    ],
    ROBOT,
  );
  const two = removeLastRulerPoint(three);
  assert.equal(two.points.length, 2);
  assert.equal(two.startHeading, 0, 'the line still starts on the robot');
  const one = removeLastRulerPoint(two);
  assert.equal(one.points.length, 1);
  const none = removeLastRulerPoint(one);
  assert.deepEqual(none, EMPTY_RULER);
  assert.equal(none.startHeading, null, 'an empty ruler has forgotten the robot');
  assert.equal(removeLastRulerPoint(none), none);
});

test('the pointer takes hold of the nearest point within reach, the later one of two at the same place', () => {
  const ruler = line([
    [100, 100],
    [130, 100],
    [130, 100],
    [600, 600],
  ]);
  assert.equal(rulerPointAt(ruler, { x: 104, y: 100 }, 20), 0);
  assert.equal(rulerPointAt(ruler, { x: 120, y: 100 }, 20), 2, 'nearest, and the later of the two that lie on each other');
  assert.equal(rulerPointAt(ruler, { x: 600, y: 620 }, 20), 3, 'exactly at the edge of the reach');
  assert.equal(rulerPointAt(ruler, { x: 600, y: 621 }, 20), -1);
  assert.equal(rulerPointAt(EMPTY_RULER, { x: 0, y: 0 }, 1000), -1);
});

test('a line that starts on the robot follows the robot while it is being placed', () => {
  const ruler = line(
    [
      [625, 600],
      [625, 300],
    ],
    ROBOT,
  );
  // the robot is moved and turned before the match
  const next: Pose = { x: 600, y: 660, heading: 15 * DEG };
  const followed = followRobot(ruler, ROBOT, next);
  assert.deepEqual(followed.points, [
    { x: 600, y: 660 },
    { x: 625, y: 300 },
  ]);
  assert.equal(followed.startHeading, 15 * DEG);
  // nothing moved: the very same ruler comes back (no needless redraw)
  assert.equal(followRobot(ruler, ROBOT, { ...ROBOT }), ruler);
});

test('a line that does not start where the robot stood is left alone', () => {
  // a free line
  const free = line([
    [625, 673.2],
    [625, 300],
  ]);
  assert.equal(followRobot(free, ROBOT, { x: 600, y: 660, heading: 0 }), free);
  // a line that was started on the robot in the middle of the field, after a match: the robot
  // is back in its start zone now and is placed again there
  const midField = addRulerPoint(EMPTY_RULER, { x: 300, y: 300 }, { x: 300, y: 300, heading: 90 * DEG }, MAT);
  assert.equal(followRobot(midField, ROBOT, { x: 600, y: 660, heading: 0 }), midField);
  assert.equal(followRobot(EMPTY_RULER, ROBOT, { x: 600, y: 660, heading: 0 }), EMPTY_RULER);
});

test('"From the robot" is said only while the robot is where the line starts - or starts every match there', () => {
  const start: Pose = { x: 625, y: 674.2, heading: 0 };
  // after a match the robot stands in the middle of the field, facing right; a line is started on it
  const end: Pose = { x: 925, y: 674.2, heading: 90 * DEG };
  const midField = addRulerPoint(addRulerPoint(EMPTY_RULER, { x: 930, y: 660 }, end, MAT), { x: 925, y: 474.2 }, null, MAT);
  assert.equal(startsOnRobot(midField, end, start), true, 'the robot stands there');
  assert.equal(rulerReading(midField, true), 'From the robot: 90° left, then 20.0 cm');
  // "Reset field" has put the robot back into its start zone: the numbers stay, the words change
  assert.equal(startsOnRobot(midField, start, start), false);
  assert.equal(rulerReading(midField, false), 'From where the robot was: 90° left, then 20.0 cm');
  assert.equal(rulerText(midField, false), 'From where the robot was: 90° left, then 20.0 cm');
  // the robot stands on the same spot but faces another way: the first turn is no longer its turn
  assert.equal(startsOnRobot(midField, { ...end, heading: 0 }), false);
  // it faces the same way but stands somewhere else
  assert.equal(startsOnRobot(midField, { ...end, x: end.x + 20 }), false);

  // a plan made at the start place is the robot's plan also while the robot drives and after the match
  const plan = addRulerPoint(addRulerPoint(EMPTY_RULER, { x: 620, y: 600 }, start, MAT), { x: 925, y: 674.2 }, null, MAT);
  assert.equal(startsOnRobot(plan, { x: 800, y: 674.2, heading: 90 * DEG }, start), true);
  assert.equal(rulerReading(plan), 'From the robot: 90° right, then 30.0 cm');

  // a free line never starts on the robot, wherever the robot is; neither does an empty ruler
  const free = line([
    [625, 674.2],
    [625, 300],
  ]);
  assert.equal(startsOnRobot(free, start), false);
  assert.equal(startsOnRobot(EMPTY_RULER, start), false);
  // one point only, and the robot has gone
  const one = addRulerPoint(EMPTY_RULER, { x: 930, y: 660 }, end, MAT);
  assert.equal(rulerText(one, true), 'The ruler starts between the wheels of the robot. Now click where the robot should go.');
  assert.equal(rulerText(one, false), 'The ruler starts where the robot was. Now click the second point.');
});

// =============================================================================================
// The pointer: a click sets a point, only a pointer that moves drags one
// =============================================================================================

/** The stage of a small phone: 272 px for 1340 mm, so one pixel of the screen is 4.93 mm of the mat. */
const SMALL_MAT = 1340 / 272;
/** The enlarged stage of a laptop: 884 px. */
const LARGE_MAT = 1340 / 884;

test('the reach of the pointer is a size on the screen: on a small mat it is more millimetres', () => {
  const ruler = line([
    [300, 900],
    [700, 900],
  ]);
  // a mouse 6 px beside the second point takes hold of it, 8 px beside it does not - at any size of the mat
  for (const mmPerPixel of [SMALL_MAT, LARGE_MAT]) {
    assert.equal(rulerHold(ruler, { x: 700 + 6 * mmPerPixel, y: 900 }, 'mouse', mmPerPixel)?.index, 1);
    assert.equal(rulerHold(ruler, { x: 700 + 8 * mmPerPixel, y: 900 }, 'mouse', mmPerPixel), null);
    // a finger reaches further: 20 px, but not 24 px
    assert.equal(rulerHold(ruler, { x: 700, y: 900 - 20 * mmPerPixel }, 'finger', mmPerPixel)?.index, 1);
    assert.equal(rulerHold(ruler, { x: 700, y: 900 - 24 * mmPerPixel }, 'finger', mmPerPixel), null);
  }
  // the numbers this file is built on
  assert.deepEqual(RULER_REACH, { mouse: { hold: 7, on: 7, slop: 3 }, finger: { hold: 22, on: 10, slop: 10 } });
  assert.equal(rulerHold(EMPTY_RULER, { x: 5, y: 5 }, 'finger', SMALL_MAT), null);
});

test('a press that hardly moves is a click or a tap, one that moves further is a drag', () => {
  assert.equal(isRulerClick(0, 'mouse'), true);
  assert.equal(isRulerClick(3, 'mouse'), true);
  assert.equal(isRulerClick(3.5, 'mouse'), false);
  // a finger is never quite still
  assert.equal(isRulerClick(10, 'finger'), true);
  assert.equal(isRulerClick(11, 'finger'), false);
});

test('a dragged point keeps its distance to the pointer: a press beside a point does not make it jump', () => {
  const ruler = line([
    [300, 900],
    [600, 900],
  ]);
  const noRobot = () => null;
  // the mouse comes down 5 px to the right of the end point (on a 311 px mat) ...
  const mmPerPixel = 1340 / 311;
  const down = { x: 600 + 5 * mmPerPixel, y: 900 };
  const hold = rulerHold(ruler, down, 'mouse', mmPerPixel);
  assert.ok(hold);
  assert.equal(hold.index, 1);
  // ... and moves 100 mm to the right: the point has moved 100 mm, not 100 mm and 5 px
  const dragged = dragRulerPoint(ruler, hold, { x: down.x + 100, y: 900 }, noRobot, MAT);
  assert.ok(Math.abs(dragged.points[1].x - 700) < 1e-9 && dragged.points[1].y === 900);
  assert.equal(rulerReading(dragged), '40.0 cm');
  // back where the pointer came down, the point is exactly where it was
  assert.deepEqual(dragRulerPoint(dragged, hold, down, noRobot, MAT).points[1], { x: 600, y: 900 });
});

test('the first point snaps to the robot while it is dragged over the robot, wherever the pointer holds it', () => {
  const ruler = line(
    [
      [625, 600],
      [625, 300],
    ],
    ROBOT,
  );
  // the place of the POINT decides, not the place of the pointer
  const seen: Vec2[] = [];
  const robotAt = (place: Vec2): Pose | null => {
    seen.push(place);
    return distance(place, ROBOT) < 100 ? ROBOT : null;
  };
  const hold = rulerHold(ruler, { x: 630, y: 673.2 }, 'mouse', 4);
  assert.ok(hold);
  const still = dragRulerPoint(ruler, hold, { x: 660, y: 673.2 }, robotAt, MAT);
  assert.deepEqual(seen[0], { x: 655, y: 673.2 });
  assert.deepEqual(still.points[0], { x: 625, y: 673.2 }, 'still on the robot: snapped');
  assert.equal(still.startHeading, 0);
  const away = dragRulerPoint(ruler, hold, { x: 905, y: 673.2 }, robotAt, MAT);
  assert.deepEqual(away.points[0], { x: 900, y: 673.2 });
  assert.equal(away.startHeading, null);
  // another point never asks about the robot
  seen.length = 0;
  dragRulerPoint(ruler, { index: 1, dx: 0, dy: 0 }, { x: 630, y: 660 }, robotAt, MAT);
  assert.equal(seen.length, 0);
});

test('a click on an earlier point brings the line back to exactly that point', () => {
  // "drive there and come back": A, B, then a click on A - 3 px beside its middle
  const there = line([
    [300, 900],
    [300, 500],
  ]);
  const back = rulerClick(there, { x: 300 + 3 * LARGE_MAT, y: 900 }, 'mouse', LARGE_MAT, null, MAT);
  assert.deepEqual(back.points, [
    { x: 300, y: 900 },
    { x: 300, y: 500 },
    { x: 300, y: 900 },
  ]);
  assert.notEqual(back.points[2], back.points[0], 'a point of its own, so that it can be dragged away alone');
  assert.equal(rulerReading(back), '40.0 cm, then 180° turn, then 40.0 cm - 80.0 cm in all');
  // a tap of a finger is on the point from further away (10 px), on any mat
  const tapped = rulerClick(there, { x: 300, y: 900 + 9 * SMALL_MAT }, 'finger', SMALL_MAT, null, MAT);
  assert.deepEqual(tapped.points[2], { x: 300, y: 900 });
  // a line that starts on the robot stays a line that starts on the robot
  const fromRobot = line(
    [
      [0, 0],
      [625, 373.2],
    ],
    ROBOT,
  );
  const home = rulerClick(fromRobot, { x: 626, y: 673 }, 'mouse', LARGE_MAT, ROBOT, MAT);
  assert.equal(rulerReading(home), 'From the robot: straight on, then 30.0 cm, then 180° turn, then 30.0 cm - 60.0 cm in all');
});

test('a click on the last point changes nothing: the point is already there', () => {
  const ruler = line([
    [300, 900],
    [300, 500],
  ]);
  assert.equal(rulerClick(ruler, { x: 301, y: 501 }, 'mouse', LARGE_MAT, null, MAT), ruler);
  assert.equal(rulerClick(ruler, { x: 300, y: 500 + 8 * SMALL_MAT }, 'finger', SMALL_MAT, null, MAT), ruler);
  // after "there and back" the last point lies on the first: a click there adds no third one
  const back = rulerClick(ruler, { x: 300, y: 900 }, 'mouse', LARGE_MAT, null, MAT);
  assert.equal(rulerClick(back, { x: 300, y: 900 }, 'mouse', LARGE_MAT, null, MAT), back);
  // a single point
  const one = line([[300, 900]]);
  assert.equal(rulerClick(one, { x: 300, y: 900 }, 'mouse', LARGE_MAT, null, MAT), one);
});

test('a click or a tap close beside a point sets a new point there: short pieces can be set on a small mat', () => {
  const one = line([[300, 900]]);
  // a finger taps 12 px beside the point on the smallest mat: that is 59 mm away, inside the reach
  // of a finger that wants to DRAG the point (22 px), but it did not move
  const beside = { x: 300 + 12 * SMALL_MAT, y: 900 };
  assert.equal(rulerHold(one, beside, 'finger', SMALL_MAT)?.index, 0);
  const two = rulerClick(one, beside, 'finger', SMALL_MAT, null, MAT);
  assert.equal(two.points.length, 2);
  assert.equal(rulerReading(two), '5.9 cm');
  // the centres of two neighbouring squares of the mat are 110 mm apart: 22 px on that mat
  const squares = rulerClick(one, { x: 410, y: 900 }, 'finger', SMALL_MAT, null, MAT);
  assert.equal(rulerReading(squares), '11.0 cm');
  // a mouse: 8 px beside a point is a new point, also on the small stage of a laptop (311 px: 3.4 cm)
  const laptop = 1340 / 311;
  assert.equal(rulerReading(rulerClick(one, { x: 300 + 8 * laptop, y: 900 }, 'mouse', laptop, null, MAT)), '3.4 cm');
});

test('a click on free mat adds a point like before: the first one snaps to the robot, a full ruler stays full', () => {
  const first = rulerClick(EMPTY_RULER, { x: 630, y: 583 }, 'finger', SMALL_MAT, ROBOT, MAT);
  assert.deepEqual(first.points, [{ x: 625, y: 673.2 }]);
  assert.equal(first.startHeading, 0);
  const second = rulerClick(first, { x: 1300, y: 673.2 }, 'mouse', LARGE_MAT, null, MAT);
  assert.deepEqual(second.points[1], { x: 1250, y: 673.2 }, 'beside the mat: at its edge');
  let full = EMPTY_RULER;
  for (let i = 0; i < MAX_RULER_POINTS; i++) full = addRulerPoint(full, { x: 10 + i * 50, y: 300 }, null, MAT);
  assert.equal(rulerClick(full, { x: 600, y: 900 }, 'mouse', LARGE_MAT, null, MAT), full);
  // also the way back to an earlier point needs a free place
  assert.equal(rulerClick(full, { x: 10, y: 300 }, 'mouse', LARGE_MAT, null, MAT), full);
});

// =============================================================================================
// The numbers
// =============================================================================================

test('lengths are whole millimetres, shown as centimetres with one decimal', () => {
  assert.equal(cmText(325), '32.5 cm');
  assert.equal(cmText(300), '30.0 cm');
  assert.equal(cmText(0), '0.0 cm');
  assert.equal(cmText(1767.4), '176.7 cm');
  const { pieces, totalMm } = measureRuler(
    line([
      [100, 100],
      [400, 500],
    ]),
  );
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].mm, 500, 'a 3-4-5 triangle');
  assert.equal(totalMm, 500);
});

test('turns are what the robot would do: clockwise is right, in whole degrees', () => {
  // up the mat, then to the right, then down, then to the left
  const square = measureRuler(
    line([
      [100, 500],
      [100, 200],
      [400, 200],
      [400, 500],
      [100, 500],
    ]),
  );
  assert.deepEqual(square.turns, [null, 90, 90, 90, null]);
  // the same way round the other way
  const other = measureRuler(
    line([
      [400, 500],
      [400, 200],
      [100, 200],
      [100, 500],
    ]),
  );
  assert.deepEqual(other.turns, [null, -90, -90, null]);
  // 45 degrees to the left, straight on, and back the way it came
  const mixed = measureRuler(
    line([
      [500, 900],
      [500, 700],
      [400, 600],
      [300, 500],
      [400, 600],
    ]),
  );
  assert.deepEqual(mixed.turns, [null, -45, 0, 180, null]);
  assert.ok(Object.is(mixed.turns[2], 0), 'never "-0"');
});

test('a turn is never "-180" and never "-0", from whichever side it is rounded', () => {
  // up the mat, then back down a hair to the LEFT of the way it came: 179.6 degrees to the left
  const back = measureRuler(
    line([
      [500, 900],
      [500, 500],
      [497.2, 900],
    ]),
  );
  assert.ok(Object.is(back.turns[1], 180), `turn around is 180, got ${back.turns[1]}`);
  // and a hair to the right: 179.6 degrees to the right
  assert.ok(Object.is(measureRuler(line([[500, 900], [500, 500], [502.8, 900]])).turns[1], 180));
  // nearly straight on, a hair to the left: 0.1 degrees is "straight on", and it is a plain 0
  const straight = measureRuler(
    line([
      [500, 900],
      [500, 700],
      [499.6, 500],
    ]),
  );
  assert.ok(Object.is(straight.turns[1], 0), 'a tiny left turn rounds to 0, not to -0');
  assert.equal(rulerReading(line([[500, 900], [500, 700], [499.6, 500]])), '20.0 cm, then straight on, then 20.0 cm - 40.0 cm in all');
});

test('a line that starts on the robot begins with the turn from where the robot faces', () => {
  // the robot faces up the mat; the first piece goes to the right
  const right = measureRuler(
    line(
      [
        [0, 0],
        [925, 673.2],
      ],
      ROBOT,
    ),
  );
  assert.deepEqual(right.turns, [90, null]);
  // straight ahead: no turn needed
  const ahead = measureRuler(
    line(
      [
        [0, 0],
        [625, 373.2],
      ],
      ROBOT,
    ),
  );
  assert.deepEqual(ahead.turns, [0, null]);
  assert.equal(ahead.pieces[0].mm, 300);
  // the robot faces down-left (heading 225 degrees), the piece goes up: 135 degrees to the right
  const turned = measureRuler(
    line(
      [
        [0, 0],
        [625, 373.2],
      ],
      { ...ROBOT, heading: 225 * DEG },
    ),
  );
  assert.deepEqual(turned.turns, [135, null]);
});

test('two points on the same spot do not hide the turn of that corner', () => {
  // a right angle; the third point lies on the second (dragged there, or 0.2 mm beside it)
  const ruler = line([
    [100, 100],
    [300, 100],
    [300, 100.2],
    [300, 400],
  ]);
  const { pieces, turns, arriving } = measureRuler(ruler);
  assert.equal(pieces[1].mm, 0);
  assert.equal(pieces[1].heading, null, 'a piece without length has no direction');
  // the robot does not turn for a piece without length: the turn is shown where the next real piece begins
  assert.deepEqual(turns, [null, null, 90, null]);
  assert.equal(arriving[2], 90 * DEG, 'it still faces the way the last real piece went');
  assert.equal(rulerReading(ruler), '20.0 cm, then 0.0 cm, then 90° right, then 30.0 cm - 50.0 cm in all');
  // exactly the same spot, and three points on it
  const three = line([
    [100, 100],
    [100, 400],
    [100, 400],
    [100, 400],
    [400, 400],
  ]);
  assert.deepEqual(measureRuler(three).turns, [null, null, null, -90, null]);
  // a line that starts on the robot with two points on the robot: the robot's own turn is not lost
  const fromRobot: Ruler = { points: [{ x: 625, y: 673.2 }, { x: 625, y: 673.2 }, { x: 925, y: 673.2 }], startHeading: 0 };
  assert.equal(rulerReading(fromRobot), 'From the robot: 0.0 cm, then 90° right, then 30.0 cm - 30.0 cm in all');
  // a free line that begins with two points on one spot has no direction to turn from
  assert.deepEqual(measureRuler(line([[100, 100], [100, 100], [100, 400]])).turns, [null, null, null]);
  // the numbers on the mat follow the same rule: one turn, at the corner
  assert.deepEqual(
    labelsOf(ruler).filter((label) => label.kind === 'turn').map((label) => label.text),
    ['90° right'],
  );
});

test('a piece of one millimetre has a direction, and the corners beside it have their turns', () => {
  // (only a piece that reads "0.0 cm" has none)
  const ruler = line([
    [100, 400],
    [300, 400],
    [300, 399],
    [600, 399],
  ]);
  const { pieces, turns } = measureRuler(ruler);
  assert.equal(pieces[1].mm, 1);
  assert.equal(pieces[1].heading, 0, 'straight up the mat');
  assert.deepEqual(turns, [null, -90, 90, null]);
  assert.equal(rulerReading(ruler), '20.0 cm, then 90° left, then 0.1 cm, then 90° right, then 30.0 cm - 50.1 cm in all');
  // 0.6 mm is the shortest piece that still reads "0.1 cm"
  assert.equal(measureRuler(line([[100, 400], [100.6, 400]])).pieces[0].heading, 90 * DEG);
  assert.equal(measureRuler(line([[100, 400], [100.4, 400]])).pieces[0].heading, null);
});

test('the total is the sum of the lengths as they are shown', () => {
  // 325.4 mm and 180.4 mm: together 505.8 mm, but the student adds 32.5 and 18.0
  const ruler = line([
    [100, 100],
    [425.4, 100],
    [425.4, 280.4],
  ]);
  const { pieces, totalMm } = measureRuler(ruler);
  assert.deepEqual(
    pieces.map((p) => p.mm),
    [325, 180],
  );
  assert.equal(totalMm, 505);
  assert.equal(rulerReading(ruler), '32.5 cm, then 90° right, then 18.0 cm - 50.5 cm in all');
});

// =============================================================================================
// The words
// =============================================================================================

test('turns in words', () => {
  assert.equal(turnText(90), '90° right');
  assert.equal(turnText(-45), '45° left');
  assert.equal(turnText(1), '1° right');
  assert.equal(turnText(0), 'straight on');
  assert.equal(turnText(180), '180° turn');
});

test('the reading says the measurement in the order the robot would do it', () => {
  // two points: only the length
  assert.equal(
    rulerReading(
      line([
        [100, 100],
        [100, 425],
      ]),
    ),
    '32.5 cm',
  );
  // three points: the turn between the pieces, and the total
  assert.equal(
    rulerReading(
      line([
        [100, 500],
        [100, 175],
        [280, 175],
      ]),
    ),
    '32.5 cm, then 90° right, then 18.0 cm - 50.5 cm in all',
  );
  // started on the robot: its own turn comes first
  assert.equal(
    rulerReading(
      line(
        [
          [0, 0],
          [925, 673.2],
          [925, 473.2],
        ],
        ROBOT,
      ),
    ),
    'From the robot: 90° right, then 30.0 cm, then 90° left, then 20.0 cm - 50.0 cm in all',
  );
  assert.equal(rulerReading(EMPTY_RULER), '');
  assert.equal(rulerReading(line([[5, 5]])), '');
});

test('before there is something to measure, the text says how to go on', () => {
  assert.equal(rulerText(EMPTY_RULER), 'Click the mat to set the first point. Click the robot to start between its wheels.');
  assert.equal(rulerText(line([[5, 5]])), 'First point set. Now click the second point.');
  assert.equal(rulerText(line([[5, 5]], ROBOT)), 'The ruler starts between the wheels of the robot. Now click where the robot should go.');
  assert.equal(
    rulerText(
      line([
        [100, 100],
        [100, 425],
      ]),
    ),
    '32.5 cm',
  );
});

// =============================================================================================
// The ruler and the engine measure the same millimetres
// =============================================================================================

function run(blocks: ProgramJson, start: Pose): Pose {
  const sim = createSimulation({
    game: fireRescueGame,
    scenario: fireRescueGame.defaultScenario(),
    robotConfig: DEFAULT_ROBOT_CONFIG,
    program: blocks,
    startPose: start,
  });
  sim.start();
  for (let i = 0; i < 400 && sim.status === 'running'; i++) sim.step(50);
  assert.equal(sim.status, 'finished');
  assert.deepEqual(sim.vm.errors(), []);
  return { ...sim.world.robot.pose };
}

test('a piece measured as 30.0 cm is what "moves forward 30 cm" drives', () => {
  const start = startPoseFor(DEFAULT_ROBOT_CONFIG);
  // the student clicks the robot, then a point 300 mm ahead of its turning centre
  const ruler = line(
    [
      [start.x, start.y - 60],
      [start.x, start.y - 300],
    ],
    start,
  );
  assert.equal(rulerReading(ruler), 'From the robot: straight on, then 30.0 cm');

  const end = run(program([script(whenStart(), [moveCm('forward', 30)])]), start);
  assert.ok(distance(end, ruler.points[1]) < 1, `the robot stops ${distance(end, ruler.points[1]).toFixed(2)} mm from the second point`);
  // and measured the other way round: the ruler from where the robot started to where it stopped
  assert.equal(rulerReading({ points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }], startHeading: start.heading }), 'From the robot: straight on, then 30.0 cm');
});

test('a plan read off the ruler - turn, length, turn, length - brings the robot to the last point', () => {
  const start = startPoseFor(DEFAULT_ROBOT_CONFIG);
  const ruler = line(
    [
      [0, 0],
      [start.x + 150, start.y],
      [start.x + 150, start.y - 120],
    ],
    start,
  );
  assert.equal(rulerReading(ruler), 'From the robot: 90° right, then 15.0 cm, then 90° left, then 12.0 cm - 27.0 cm in all');
  const end = run(program([script(whenStart(), [turn('right', 90), moveCm('forward', 15), turn('left', 90), moveCm('forward', 12)])]), start);
  const off = distance(end, ruler.points[2]);
  assert.ok(off < 3, `the robot stops ${off.toFixed(2)} mm from the last point`);
});

test('the numbers do not depend on the size of the stage or on the pixel ratio of the screen', () => {
  // two places on the mat, 300 mm apart
  const a: Vec2 = { x: 625, y: 673.2 };
  const b: Vec2 = { x: 625, y: 373.2 };
  // the stage of a small laptop, of a large one, of a phone with a 3x screen, and enlarged
  const stages: Array<[number, number, number]> = [
    [355, 355, 1],
    [535, 535, 1],
    [366, 366, 3],
    [876, 876, 2],
    [700, 420, 1.25],
  ];
  for (const [width, height, dpr] of stages) {
    const view = fitView(width, height, MAT.width, MAT.height, dpr);
    // where the two places are on that screen, and what a click there is turned into
    const click = (p: Vec2): Vec2 => viewToMat(view, view.originX + p.x * view.scale, view.originY + p.y * view.scale);
    const ruler = addRulerPoint(addRulerPoint(EMPTY_RULER, click(a), null, MAT), click(b), null, MAT);
    assert.equal(rulerReading(ruler), '30.0 cm', `${width} x ${height} at ${dpr}x`);
  }
});

// =============================================================================================
// Where the numbers are written
// =============================================================================================

const BOUNDS = { x: -45, y: -45, w: 1340, h: 1340 };

function labelsOf(ruler: Ruler): RulerLabel[] {
  // letters 30 mm tall and 18 mm wide - about what an 11 px font is on a 355 px stage
  return rulerLabels(ruler, { textWidth: (text) => text.length * 18, fontSize: 30, clearance: 25, bounds: BOUNDS });
}

function covers(label: RulerLabel, p: Vec2): boolean {
  return Math.abs(p.x - label.x) < label.w / 2 && Math.abs(p.y - label.y) < label.h / 2;
}

test('every piece has its length, every corner its turn, and three points or more the total', () => {
  const two = labelsOf(
    line([
      [300, 600],
      [700, 600],
    ]),
  );
  assert.deepEqual(
    two.map((l) => `${l.kind}: ${l.text}`),
    ['piece: 40.0 cm'],
  );
  const three = labelsOf(
    line([
      [300, 800],
      [300, 400],
      [700, 400],
    ]),
  );
  assert.deepEqual(
    three.map((l) => `${l.kind}: ${l.text}`),
    ['piece: 40.0 cm', 'piece: 40.0 cm', 'turn: 90° right', 'total: 80.0 cm in all'],
  );
  const fromRobot = labelsOf(
    line(
      [
        [0, 0],
        [925, 673.2],
      ],
      ROBOT,
    ),
  );
  assert.deepEqual(
    fromRobot.map((l) => `${l.kind}: ${l.text}`),
    ['piece: 30.0 cm', 'turn: 90° right'],
  );
});

test('no number covers a point of the line, and the length of a piece does not lie on the piece', () => {
  const rulers = [
    line([
      [300, 800],
      [300, 400],
      [700, 400],
      [900, 700],
    ]),
    line([
      [200, 200],
      [1000, 260],
      [240, 330],
    ]),
    line(
      [
        [0, 0],
        [625, 373.2],
        [300, 373.2],
        [300, 900],
      ],
      ROBOT,
    ),
  ];
  for (const ruler of rulers) {
    const labels = labelsOf(ruler);
    for (const label of labels) {
      for (const p of ruler.points) assert.ok(!covers(label, p), `"${label.text}" covers the point ${p.x}, ${p.y}`);
    }
    measureRuler(ruler).pieces.forEach((piece, i) => {
      const middle = { x: (piece.from.x + piece.to.x) / 2, y: (piece.from.y + piece.to.y) / 2 };
      assert.ok(!covers(labels[i], middle), `"${labels[i].text}" lies on its own piece`);
    });
  }
});

test('the length of a piece is written inside the corner, the turn outside of it', () => {
  // up the mat, then to the right: the inside of the corner is below and to the right of it
  const [first, second, corner, total] = labelsOf(
    line([
      [300, 800],
      [300, 400],
      [700, 400],
    ]),
  );
  assert.ok(first.x > 300, 'the first length is on the right of the upright piece');
  assert.ok(second.y > 400, 'the second length is below the level piece');
  assert.ok(corner.x < 300 && corner.y < 400, 'the turn is above and to the left of the corner');
  assert.ok(total.x > 700 && Math.abs(total.y - 400) < 1e-9, 'the total is past the last point');
  // a single level line: its length is above it
  const [alone] = labelsOf(
    line([
      [300, 600],
      [700, 600],
    ]),
  );
  assert.ok(alone.y < 600);
});

test('numbers stay inside the part of the mat that can be seen', () => {
  // a line along the top edge that ends in the top right corner
  const labels = labelsOf(
    line([
      [900, 5],
      [1250, 0],
      [1250, 300],
    ]),
  );
  for (const label of labels) {
    assert.ok(label.x - label.w / 2 >= BOUNDS.x - 1e-9 && label.x + label.w / 2 <= BOUNDS.x + BOUNDS.w + 1e-9, `"${label.text}" left / right`);
    assert.ok(label.y - label.h / 2 >= BOUNDS.y - 1e-9 && label.y + label.h / 2 <= BOUNDS.y + BOUNDS.h + 1e-9, `"${label.text}" top / bottom`);
  }
});

test('on a small mat the numbers of a short line move aside instead of lying on each other', () => {
  // the stage of a small laptop with the ruler on (311 px for 1340 mm): 11 px letters are 47 mm
  // tall there, and a number like "40.0 cm" is about 230 mm wide
  const small = (ruler: Ruler): RulerLabel[] => rulerLabels(ruler, { textWidth: (text) => text.length * 27, fontSize: 47, clearance: 39, bounds: BOUNDS });
  const overlap = (a: RulerLabel, b: RulerLabel): boolean => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const rulers = [
    // a long piece up the mat, then a short one back down to the right: both lengths want the same corner
    line([
      [300, 900],
      [300, 500],
      [480, 575],
    ]),
    // from the robot: 30 cm ahead, then 30 cm to the right
    line(
      [
        [0, 0],
        [625, 374.2],
        [925, 374.2],
      ],
      { x: 625, y: 674.2, heading: 0 },
    ),
    // a short zigzag
    line([
      [400, 700],
      [400, 500],
      [600, 500],
      [600, 300],
    ]),
  ];
  for (const ruler of rulers) {
    const labels = small(ruler);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) assert.ok(!overlap(labels[i], labels[j]), `"${labels[i].text}" and "${labels[j].text}" lie on each other`);
      for (const p of ruler.points) assert.ok(!covers(labels[i], p), `"${labels[i].text}" covers the point ${p.x}, ${p.y}`);
    }
  }
});

test('a number that the edge of the stage pushes back onto its point goes to the side of the point', () => {
  // the line ends close to the left edge, going left: there is no room for the total past the last point
  const ruler = line([
    [200, 200],
    [1000, 260],
    [240, 330],
  ]);
  const total = labelsOf(ruler).find((label) => label.kind === 'total');
  assert.ok(total);
  assert.ok(!covers(total, { x: 240, y: 330 }));
  assert.ok(total.x - total.w / 2 >= BOUNDS.x - 1e-9, 'still inside the visible part');
});

// =============================================================================================
// The Escape key, the Tab key, the hint line
// =============================================================================================

test('Escape undoes the smallest thing first', () => {
  // the ruler has points: one point goes, whether the stage is enlarged or not
  assert.equal(escapeAction({ rulerOn: true, rulerPoints: 3, enlarged: false }), 'remove-point');
  assert.equal(escapeAction({ rulerOn: true, rulerPoints: 1, enlarged: true }), 'remove-point');
  // no point left: the enlarged stage goes back to its normal size, the ruler stays on
  assert.equal(escapeAction({ rulerOn: true, rulerPoints: 0, enlarged: true }), 'shrink');
  assert.equal(escapeAction({ rulerOn: false, rulerPoints: 0, enlarged: true }), 'shrink');
  // normal size, ruler without points: the ruler is switched off
  assert.equal(escapeAction({ rulerOn: true, rulerPoints: 0, enlarged: false }), 'ruler-off');
  // nothing to undo
  assert.equal(escapeAction({ rulerOn: false, rulerPoints: 0, enlarged: false }), null);
});

test('points of a ruler that is switched off do not hold the Escape key back', () => {
  // (the line is kept while the ruler is off, but it is not on the screen)
  assert.equal(escapeAction({ rulerOn: false, rulerPoints: 4, enlarged: true }), 'shrink');
  assert.equal(escapeAction({ rulerOn: false, rulerPoints: 4, enlarged: false }), null);
});

test('from an enlarged stage with a three-point ruler, Escape needs four presses to get back', () => {
  let state = { rulerOn: true, rulerPoints: 3, enlarged: true };
  const done: string[] = [];
  for (let i = 0; i < 10; i++) {
    const action = escapeAction(state);
    if (!action) break;
    done.push(action);
    if (action === 'remove-point') state = { ...state, rulerPoints: state.rulerPoints - 1 };
    else if (action === 'shrink') state = { ...state, enlarged: false };
    else state = { ...state, rulerOn: false };
  }
  assert.deepEqual(done, ['remove-point', 'remove-point', 'remove-point', 'shrink', 'ruler-off']);
});

test('the Shrink button names the Esc key only while Esc really shrinks the stage', () => {
  assert.equal(sizeButtonHint({ rulerOn: false, rulerPoints: 0, enlarged: false }), 'Show the stage as large as the window allows');
  assert.equal(sizeButtonHint({ rulerOn: true, rulerPoints: 3, enlarged: false }), 'Show the stage as large as the window allows');
  assert.equal(sizeButtonHint({ rulerOn: false, rulerPoints: 0, enlarged: true }), 'Back to the normal size (the Esc key does the same)');
  assert.equal(sizeButtonHint({ rulerOn: true, rulerPoints: 0, enlarged: true }), 'Back to the normal size (the Esc key does the same)');
  // points of a ruler that is switched off are not on the screen: Esc shrinks
  assert.equal(sizeButtonHint({ rulerOn: false, rulerPoints: 4, enlarged: true }), 'Back to the normal size (the Esc key does the same)');
  // the ruler has points: Esc takes one of them away first, and the button says so
  assert.equal(sizeButtonHint({ rulerOn: true, rulerPoints: 4, enlarged: true }), 'Back to the normal size (the Esc key first removes the last point of the ruler)');
  // the hint and the key never disagree
  for (const rulerOn of [false, true]) {
    for (const rulerPoints of [0, 1, 5]) {
      const state = { rulerOn, rulerPoints, enlarged: true };
      assert.equal(/does the same/.test(sizeButtonHint(state)), escapeAction(state) === 'shrink', JSON.stringify(state));
    }
  }
});

test('Tab stays inside the enlarged stage', () => {
  // from the last control to the first, and backwards from the first to the last
  assert.equal(tabStop(12, 11, false), 0);
  assert.equal(tabStop(12, 0, true), 11);
  // in between the browser does it
  assert.equal(tabStop(12, 5, false), null);
  assert.equal(tabStop(12, 5, true), null);
  assert.equal(tabStop(12, 0, false), null);
  assert.equal(tabStop(12, 11, true), null);
  // the focus is on the frame of the enlarged stage (or was lost): Tab goes to the first, Shift+Tab to the last
  assert.equal(tabStop(12, -1, false), 0);
  assert.equal(tabStop(12, -1, true), 11);
  // a single control keeps the focus
  assert.equal(tabStop(1, 0, false), 0);
  assert.equal(tabStop(1, 0, true), 0);
  assert.equal(tabStop(0, -1, false), null);
});

test('the hint line says what the pointer does on the mat', () => {
  assert.equal(readyHint('Fire Station', false, false), 'Ready. Drag the robot inside the Fire Station; turn it with the buttons below the mat.');
  assert.equal(readyHint('Fire Station', false, true), 'Ready. Drag the robot inside the Fire Station; turn it with the buttons next to the mat.');
  // the ruler is on: the robot is not dragged, and the line says so
  for (const enlarged of [false, true]) {
    assert.equal(readyHint('Fire Station', true, enlarged), 'Ready. The ruler is on: click the mat to set points. To drag the robot, switch the ruler off.');
  }
});
