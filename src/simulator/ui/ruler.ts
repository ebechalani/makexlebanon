/**
 * The ruler of the stage: a line of points that the student sets on the mat. It shows how long
 * every piece of the line is (in cm) and how far the robot would have to turn at every corner -
 * the two numbers the "moves forward ... cm" and "turns right ... °" blocks ask for.
 *
 * Everything here is in MILLIMETRES ON THE MAT, the unit of the engine (core/geometry.ts: +x is
 * right, +y is down, a heading of 0 faces up the mat and grows clockwise). That is why the
 * numbers do not depend on how large the mat is shown: the canvas turns a click into mat
 * millimetres first (render.ts, viewToMat) and only then hands it to this file.
 *
 * This file holds the geometry, the wording and the rules of the pointer (when a press takes
 * hold of a point and when it sets a new one). It draws nothing and touches no page, so it can
 * be tested under Node; the drawing is in render.ts, the pointer events in StageCanvas.tsx.
 */
import { DEG, distance, forwardOf, headingOf, rightOf, wrapAngle, type Rect, type Vec2 } from '../core/geometry';
import type { Pose } from '../core/types';

// =============================================================================================
// The line
// =============================================================================================

export interface Ruler {
  /** the points of the line in the order they were set, in millimetres on the mat */
  points: Vec2[];
  /**
   * Set when the first point stands on the robot's turning centre (the middle of its drive
   * axle): the heading of the robot there, in radians. The first piece then also has a turn -
   * the one the robot must make before it drives. Null for a line that starts anywhere else.
   */
  startHeading: number | null;
}

export const EMPTY_RULER: Ruler = { points: [], startHeading: null };

/** The most points one line can have. A plan for a match needs far fewer; more would only fill the mat with numbers. */
export const MAX_RULER_POINTS = 20;

/** The size of the mat, in mm. */
export interface MatSize {
  width: number;
  height: number;
}

/** The nearest place on the mat: a click on the table beside the mat measures to the mat's edge. */
function onMat(point: Vec2, mat: MatSize): Vec2 {
  return {
    x: Math.max(0, Math.min(mat.width, point.x)),
    y: Math.max(0, Math.min(mat.height, point.y)),
  };
}

/**
 * Add a point at the end of the line. `robot` is the pose of the robot when the click was ON the
 * robot, otherwise null: a FIRST point set on the robot snaps to its turning centre.
 * A full line is returned as it is.
 */
export function addRulerPoint(ruler: Ruler, point: Vec2, robot: Pose | null, mat: MatSize): Ruler {
  if (ruler.points.length >= MAX_RULER_POINTS) return ruler;
  if (ruler.points.length === 0 && robot) return { points: [{ x: robot.x, y: robot.y }], startHeading: robot.heading };
  return { points: [...ruler.points, onMat(point, mat)], startHeading: ruler.startHeading };
}

/**
 * Move one point of the line (the student drags it). The first point follows the same rule as
 * when it was set: on the robot it snaps to the turning centre, anywhere else it is a free point.
 */
export function moveRulerPoint(ruler: Ruler, index: number, point: Vec2, robot: Pose | null, mat: MatSize): Ruler {
  if (index < 0 || index >= ruler.points.length) return ruler;
  const points = ruler.points.slice();
  if (index === 0) {
    points[0] = robot ? { x: robot.x, y: robot.y } : onMat(point, mat);
    return { points, startHeading: robot ? robot.heading : null };
  }
  points[index] = onMat(point, mat);
  return { points, startHeading: ruler.startHeading };
}

/** Take the last point away (the Escape key). Without a point left the line is empty again. */
export function removeLastRulerPoint(ruler: Ruler): Ruler {
  if (ruler.points.length <= 1) return ruler.points.length === 0 ? ruler : EMPTY_RULER;
  return { points: ruler.points.slice(0, -1), startHeading: ruler.startHeading };
}

/**
 * Which point of the line is under the pointer: the index of the nearest point that is not
 * further away than `radius` (mm), or -1. Of two points at the same place the later one wins -
 * it is the one drawn on top.
 */
export function rulerPointAt(ruler: Ruler, point: Vec2, radius: number): number {
  let best = -1;
  let bestDistance = radius;
  ruler.points.forEach((p, i) => {
    const d = distance(p, point);
    if (d <= bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/**
 * The robot was put somewhere else (or turned) before the match: a line that starts on the
 * robot keeps starting on the robot. `from` is where the robot stood, `to` where it stands now.
 * A line that starts anywhere else - also on a place the robot has left during a match - stays
 * where it is.
 */
export function followRobot(ruler: Ruler, from: Pose, to: Pose): Ruler {
  const first = ruler.points[0];
  if (ruler.startHeading === null || !first || distance(first, from) > 0.5) return ruler;
  if (first.x === to.x && first.y === to.y && ruler.startHeading === to.heading) return ruler;
  return { points: [{ x: to.x, y: to.y }, ...ruler.points.slice(1)], startHeading: to.heading };
}

/**
 * Is the robot at the place where a line that was started on it begins? `poses` are the places
 * that count: where the robot stands now, and where it starts every match.
 *
 * A line can be started on the robot in the middle of the field, after a match. "Reset field"
 * then puts the robot back into its start zone, and the line no longer starts on the robot: its
 * numbers are still right for the place where the robot was, but the words must say so.
 */
export function startsOnRobot(ruler: Ruler, ...poses: Pose[]): boolean {
  const first = ruler.points[0];
  const heading = ruler.startHeading;
  if (heading === null || !first) return false;
  return poses.some((pose) => distance(first, pose) <= 0.5 && Math.abs(wrapAngle(pose.heading - heading)) <= 0.5 * DEG);
}

// =============================================================================================
// The pointer: take hold of a point, or set a new one
// =============================================================================================

/** A mouse points exactly. A finger (or a pen) does not, and it may also want to scroll the page. */
export type RulerPointer = 'mouse' | 'finger';

/**
 * The reach of the pointer, in pixels of the SCREEN (the canvas turns them into millimetres of
 * the mat at the size the mat is shown):
 *   hold  a press this close to a point takes hold of it - to drag it, if the pointer then moves;
 *   on    a click or tap this close is ON the point (the dot is drawn 6 to 7 px wide from its middle);
 *   slop  a press that moved no further than this between down and up is a click or a tap, not a drag.
 * A finger takes hold from further away than a mouse, because it covers what it touches. A tap
 * that is near a point but not on it still sets a new point there: otherwise two points could
 * not be set close together on a small mat (22 px are 11 cm of the mat on a small phone).
 */
export const RULER_REACH: Record<RulerPointer, { hold: number; on: number; slop: number }> = {
  mouse: { hold: 7, on: 7, slop: 3 },
  finger: { hold: 22, on: 10, slop: 10 },
};

/** A point that the pointer has taken hold of, and how far beside the point the pointer came down (mm). */
export interface RulerHold {
  index: number;
  dx: number;
  dy: number;
}

/**
 * The pointer came down at `point`: the point of the line it takes hold of, or null when none
 * is within reach. `mmPerPixel` is the size of one screen pixel on the mat.
 */
export function rulerHold(ruler: Ruler, point: Vec2, pointer: RulerPointer, mmPerPixel: number): RulerHold | null {
  const index = rulerPointAt(ruler, point, RULER_REACH[pointer].hold * mmPerPixel);
  if (index < 0) return null;
  return { index, dx: point.x - ruler.points[index].x, dy: point.y - ruler.points[index].y };
}

/** Did the pointer stay in place between down and up (`movedPixels` on the screen)? Then it was a click or a tap. */
export function isRulerClick(movedPixels: number, pointer: RulerPointer): boolean {
  return movedPixels <= RULER_REACH[pointer].slop;
}

/**
 * The pointer moved while it holds a point: the point goes with it. It keeps the distance it
 * had to the pointer when it was taken hold of - a press a little beside a point must not make
 * the point jump. `robotAt` says whether a place is on the robot (only the first point snaps).
 */
export function dragRulerPoint(ruler: Ruler, hold: RulerHold, pointer: Vec2, robotAt: (place: Vec2) => Pose | null, mat: MatSize): Ruler {
  const place = { x: pointer.x - hold.dx, y: pointer.y - hold.dy };
  return moveRulerPoint(ruler, hold.index, place, hold.index === 0 ? robotAt(place) : null, mat);
}

/**
 * A click or a tap at `point` (a press that did not move):
 *   - on the last point of the line: nothing - the point is already there;
 *   - on an earlier point: the line goes back to exactly that point ("drive there and come back");
 *   - anywhere else, also close beside a point: a new point at that place.
 * `robot` is the pose of the robot when the click was on the robot (see addRulerPoint).
 */
export function rulerClick(ruler: Ruler, point: Vec2, pointer: RulerPointer, mmPerPixel: number, robot: Pose | null, mat: MatSize): Ruler {
  const on = rulerPointAt(ruler, point, RULER_REACH[pointer].on * mmPerPixel);
  if (on < 0) return addRulerPoint(ruler, point, robot, mat);
  if (on === ruler.points.length - 1 || ruler.points.length >= MAX_RULER_POINTS) return ruler;
  return { points: [...ruler.points, { ...ruler.points[on] }], startHeading: ruler.startHeading };
}

// =============================================================================================
// The numbers
// =============================================================================================

export interface RulerPiece {
  from: Vec2;
  to: Vec2;
  /** length in whole millimetres: exactly what is shown, since one decimal of a centimetre is one millimetre */
  mm: number;
  /** the direction of the piece (radians, 0 = up the mat, clockwise); null for a piece without length */
  heading: number | null;
}

export interface RulerMeasure {
  /** one piece between every two neighbouring points */
  pieces: RulerPiece[];
  /**
   * One entry per point: the turn the robot makes there, in whole degrees (positive = to the
   * right, 180 = turn around), or null where there is no turn - at the last point, at a first
   * point that is not on the robot, and where the piece that leaves the point has no length.
   */
  turns: Array<number | null>;
  /**
   * One entry per point: the direction the robot faces when it arrives there (radians), or null
   * when it has none yet. It is the direction of the last piece before the point that has a
   * length - or, before any such piece, the heading of the robot the line started on.
   */
  arriving: Array<number | null>;
  /** the sum of the shown lengths, so that the total is what the student gets by adding them up */
  totalMm: number;
}

/**
 * A piece shorter than this has no direction (it reads "0.0 cm"): two points on the same spot.
 * Anything that reads "0.1 cm" or more has one.
 */
const NO_LENGTH = 0.5;

/** The turn from one heading to the next, in whole degrees: -179 .. 180, positive = clockwise = to the right. */
function turnDegrees(from: number, to: number): number {
  const degrees = Math.round(wrapAngle(to - from) / DEG);
  // (-180 and 180 are the same turn; "+ 0" turns the "-0" of a tiny left turn into a plain 0)
  return degrees === -180 ? 180 : degrees + 0;
}

export function measureRuler(ruler: Ruler): RulerMeasure {
  const pieces: RulerPiece[] = [];
  for (let i = 0; i + 1 < ruler.points.length; i++) {
    const from = ruler.points[i];
    const to = ruler.points[i + 1];
    const length = distance(from, to);
    pieces.push({ from, to, mm: Math.round(length), heading: length < NO_LENGTH ? null : headingOf({ x: to.x - from.x, y: to.y - from.y }) });
  }
  // A piece without length does not turn the robot: it still faces the way the last real piece
  // went. (Otherwise two points on the same spot would hide the turn of that corner, and the
  // text would read like a straight line.) The turn is shown where the next real piece begins.
  const arriving: Array<number | null> = [];
  let facing = ruler.startHeading;
  ruler.points.forEach((_, i) => {
    if (i > 0 && pieces[i - 1].heading !== null) facing = pieces[i - 1].heading;
    arriving.push(facing);
  });
  const turns: Array<number | null> = ruler.points.map((_, i) => {
    const before = arriving[i];
    const after = i < pieces.length ? pieces[i].heading : null;
    return before === null || after === null ? null : turnDegrees(before, after);
  });
  return { pieces, turns, arriving, totalMm: pieces.reduce((sum, piece) => sum + piece.mm, 0) };
}

// =============================================================================================
// The words
// =============================================================================================

/** 325 -> "32.5 cm": centimetres with one decimal, the way the blocks take them. */
export function cmText(mm: number): string {
  return `${(Math.round(mm) / 10).toFixed(1)} cm`;
}

/** 90 -> "90° right", -45 -> "45° left", 0 -> "straight on", 180 -> "180° turn". */
export function turnText(degrees: number): string {
  if (degrees === 0) return 'straight on';
  if (Math.abs(degrees) === 180) return '180° turn';
  return degrees > 0 ? `${degrees}° right` : `${-degrees}° left`;
}

/**
 * The whole measurement in one sentence, in the order the robot would do it:
 * "32.5 cm, then 90° right, then 18.0 cm - 50.5 cm in all". A line that starts on the robot
 * begins with the robot's own turn: "From the robot: 45° left, then 30.0 cm".
 * `robotThere` is false when the robot has left the place where such a line starts (see
 * startsOnRobot): the numbers stay, the words say "From where the robot was".
 * Empty while the line has fewer than two points.
 */
export function rulerReading(ruler: Ruler, robotThere = true): string {
  const { pieces, turns, totalMm } = measureRuler(ruler);
  if (pieces.length === 0) return '';
  const steps: string[] = [];
  pieces.forEach((piece, i) => {
    const turn = turns[i];
    if (turn !== null) steps.push(turnText(turn));
    steps.push(cmText(piece.mm));
  });
  const start = ruler.startHeading === null ? '' : robotThere ? 'From the robot: ' : 'From where the robot was: ';
  const total = pieces.length > 1 ? ` - ${cmText(totalMm)} in all` : '';
  return `${start}${steps.join(', then ')}${total}`;
}

/**
 * What the line beside the mat says: how to begin, or - from two points on - the measurement.
 * (`robotThere`: see rulerReading.)
 */
export function rulerText(ruler: Ruler, robotThere = true): string {
  if (ruler.points.length === 0) return 'Click the mat to set the first point. Click the robot to start between its wheels.';
  if (ruler.points.length === 1) {
    if (ruler.startHeading === null) return 'First point set. Now click the second point.';
    return robotThere
      ? 'The ruler starts between the wheels of the robot. Now click where the robot should go.'
      : 'The ruler starts where the robot was. Now click the second point.';
  }
  const full = ruler.points.length >= MAX_RULER_POINTS ? ` (The ruler is full: ${MAX_RULER_POINTS} points.)` : '';
  return `${rulerReading(ruler, robotThere)}${full}`;
}

// =============================================================================================
// Where the numbers are written on the mat
// =============================================================================================

export interface RulerLabel {
  /** the length of a piece, the turn at a corner, or the total length */
  kind: 'piece' | 'turn' | 'total';
  text: string;
  /** centre of the label's box */
  x: number;
  y: number;
  /** size of the box */
  w: number;
  h: number;
}

export interface RulerLabelStyle {
  /** width of a text in the label font */
  textWidth: (text: string) => number;
  /** height of the letters */
  fontSize: number;
  /** room kept free around a point of the line (its dot) and beside the line */
  clearance: number;
  /** the part of the mat (and table) that can be seen: no label leaves it */
  bounds: Rect;
}

/** How far the centre of a w x h box must be from a point so that the box just clears it, going in direction `d`. */
function reach(d: Vec2, w: number, h: number): number {
  return (Math.abs(d.x) * w) / 2 + (Math.abs(d.y) * h) / 2;
}

/** The side of a line that is "above" it on the screen (for an upright line: its right). */
function upperSide(heading: number): Vec2 {
  const right = rightOf(heading);
  return right.y < -1e-9 || (Math.abs(right.y) <= 1e-9 && right.x > 0) ? right : { x: -right.x, y: -right.y };
}

/**
 * Decide where every number of the ruler is written, so that it covers neither a point of the
 * line nor another number. All sizes are in the unit of the ruler's points (mm on the mat).
 *
 *  - The length of a piece sits beside the middle of the piece, on the INNER side of the corner
 *    the piece leads to (a straight line: above it).
 *  - The turn of a corner sits on the OUTER side of that corner, so the line itself lies
 *    between the two kinds of numbers.
 *  - The total sits past the last point, in the direction the line was going.
 *
 * On a small mat a short line has little room. A number that would lie on another number, or
 * on a point, or that the edge of the stage pushes back onto its own place, looks around its
 * place - the other sides first, then a little further out - and takes the first spot where it
 * covers nothing (or, if there is none, the spot where it covers least). Lengths are placed
 * first: they get the best places.
 */
export function rulerLabels(ruler: Ruler, style: RulerLabelStyle): RulerLabel[] {
  const { pieces, turns, arriving, totalMm } = measureRuler(ruler);
  const { fontSize, clearance, bounds } = style;
  const labels: RulerLabel[] = [];

  /** `direction` is the side of `anchor` where the number would like to be, `gap` the room between the two. */
  const place = (kind: RulerLabel['kind'], text: string, anchor: Vec2, direction: Vec2, gap: number): void => {
    const w = style.textWidth(text) + fontSize * 0.9;
    const h = fontSize * 1.6;
    // (a box wider than the visible part cannot be kept inside: it is centred instead)
    const keepIn = (value: number, min: number, max: number): number => (min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value)));
    /** The middle of the box when it stands on the side of the anchor that is `degrees` away from the wanted side. */
    const at = (degrees: number, room: number): Vec2 => {
      const cos = Math.cos(degrees * DEG);
      const sin = Math.sin(degrees * DEG);
      const d = { x: direction.x * cos - direction.y * sin, y: direction.x * sin + direction.y * cos };
      const away = reach(d, w, h) + room;
      return {
        x: keepIn(anchor.x + d.x * away, bounds.x + w / 2, bounds.x + bounds.w - w / 2),
        y: keepIn(anchor.y + d.y * away, bounds.y + h / 2, bounds.y + bounds.h - h / 2),
      };
    };
    /** How much of what must stay visible a box at `c` would cover (0 = nothing). */
    const covered = (c: Vec2): number => {
      let area = 0;
      for (const other of labels) {
        const overlapX = Math.min(c.x + w / 2, other.x + other.w / 2) - Math.max(c.x - w / 2, other.x - other.w / 2);
        const overlapY = Math.min(c.y + h / 2, other.y + other.h / 2) - Math.max(c.y - h / 2, other.y - other.h / 2);
        if (overlapX > 0 && overlapY > 0) area += overlapX * overlapY;
      }
      // a point of the line under the box (or the place the number belongs to) is as bad as a whole number under it
      for (const p of [anchor, ...ruler.points]) if (Math.abs(p.x - c.x) < w / 2 && Math.abs(p.y - c.y) < h / 2) area += w * h;
      return area;
    };
    // a length may change to the other side of its piece; a turn or the total rather goes sideways than back onto the line
    const sides = kind === 'piece' ? [0, 180, 90, -90, 45, -45, 135, -135] : [0, 90, -90, 45, -45, 135, -135, 180];
    let best = at(0, gap);
    let least = covered(best);
    for (const further of [0, h]) {
      for (const degrees of sides) {
        if (least === 0) break;
        const spot = at(degrees, gap + further);
        const area = covered(spot);
        if (area < least) {
          best = spot;
          least = area;
        }
      }
    }
    labels.push({ kind, text, x: best.x, y: best.y, w, h });
  };

  pieces.forEach((piece, i) => {
    const middle = { x: (piece.from.x + piece.to.x) / 2, y: (piece.from.y + piece.to.y) / 2 };
    if (piece.heading === null) {
      place('piece', cmText(piece.mm), middle, { x: 0, y: -1 }, clearance);
      return;
    }
    // the corner this piece leads to decides the side; the last piece looks back at its own start
    const turn = turns[i + 1] ?? turns[i];
    const right = rightOf(piece.heading);
    const side = !turn || turn === 180 ? upperSide(piece.heading) : turn > 0 ? right : { x: -right.x, y: -right.y };
    place('piece', cmText(piece.mm), middle, side, clearance * 0.5);
  });

  turns.forEach((turn, i) => {
    if (turn === null) return;
    // (a corner has a turn only when both directions exist: see measureRuler)
    const after = pieces[i].heading as number;
    const before = arriving[i] as number;
    const u = forwardOf(before);
    const v = forwardOf(after);
    const out = { x: u.x - v.x, y: u.y - v.y };
    const size = Math.hypot(out.x, out.y);
    // straight on: a corner without an outer side - the turn is written below the line (for an upright line: on its left)
    const upper = upperSide(after);
    const direction = size < 1e-6 ? { x: -upper.x, y: -upper.y } : { x: out.x / size, y: out.y / size };
    place('turn', turnText(turn), ruler.points[i], direction, clearance);
  });

  if (pieces.length > 1) {
    const last = pieces[pieces.length - 1];
    place('total', `${cmText(totalMm)} in all`, last.to, last.heading === null ? { x: 0, y: 1 } : forwardOf(last.heading), clearance);
  }
  return labels;
}
