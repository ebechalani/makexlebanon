/**
 * MakeX Lebanon, Season 2027 - Fire Fighter (mBot2, ages 8-10): the game and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?            -> createBodies() (no walls)
 *   2. Which areas should be highlighted on the mat?            -> overlays()
 *   3. What does the referee show on the towers?                -> the referee's props(): the flaps
 *   4. What has the robot earned so far, when, and why (not)?   -> createReferee()
 *
 * The referee follows the organiser's rules ("Fire Fighter - Fire City", §4 - §7, "Proposed
 * scoring for organizer review") and the organiser's answers:
 *
 *   +20  each of the towers M, A, K and E with a red cube under it and its letter showing
 *   +20  tower X with the yellow cube under it and its letter showing - when X was the robot's
 *        next delivery after it took the yellow cube ("Once you collect it, X must be your next
 *        delivery", §4.3, §7.1)
 *   -4   each tower that ends the match off its picture square (0 for its delivery too), once per
 *        tower (§7.2)
 *   Each tower is judged once, at the end (§6, §7.1). The total is never below 0 and at most 100
 *   (§7.3).
 *
 * A match lasts 180 s (the organiser). It ends then, or when the team says "Finished", or when the
 * program has ended and the robot stands still (as in the other mBot2 games: a convention of the
 * simulator, not a rule); then the field is judged as it lies. There is no early end when all five
 * letters show: the robot must still move clear. The simulator has no restarts (F12).
 *
 * A TOWER is two side supports (game elements of kind 'tower-support') with the same Body.group,
 * so they slide together as one piece and never come apart or turn (core/engine.ts, "Rigid
 * groups"), and a flap drawn between them (a RefereeProp) that shows the letter.
 *
 * WORDS OF THE RULES, IN ENGINE TERMS
 *   - A cube is IN a tower while its base overlaps the space between the two supports (60 x 40 mm,
 *     where the tower now stands; touching is not overlapping). One STAY is the time a cube is in
 *     one tower without leaving it. Its first tick decides how it came in: THROUGH THE OPENING when
 *     the cube's middle was then on the opening's side of the middle of the white dashed square
 *     (or on it), FROM THE BACK otherwise. A held cube can be in a tower too.
 *   - THE LETTER SHOWS (rules §5) when a cube went in through the opening (its stay), stands on the
 *     mat (not held, on nothing, at most ON_MAT_MM high), and its whole base is inside the white
 *     dashed square measured to the outer edge of its dashes (field.ts LETTER_AREA), moved as far
 *     as the tower has slid.                                                   letterShows()
 *   - A DELIVERY is the first tick of a stay at which the letter shows because of that cube and no
 *     part of the robot is within TOUCH_MM of it: at most one per stay. Touching or nudging a cube
 *     that is already under a tower makes none; a cube taken out of the space between the supports
 *     and pushed in again makes a new one. A cube of the wrong colour makes a delivery too.
 *   - The yellow cube is COLLECTED at the first tick at which the claw holds it or its middle is
 *     outside its red-framed square (its edge counts as inside). "X must be your next delivery" is
 *     decided once, by the first delivery at or after that tick: the yellow cube at X - yes;
 *     anything else, the yellow cube under another tower too - no. Two deliveries on one tick: the
 *     yellow cube at X is looked at first. Deliveries before the collection do not count for it.
 *   - A tower is ON ITS PICTURE SQUARE while its 105 x 40 mm base, where it now stands, overlaps or
 *     touches the picture tile it stands on at the start (§7.2: "Touching the boundary counts").
 *   - At the end (finished()), the field is kept as it was at the last moment of the match, before
 *     the motors stop: what was held, what touched the robot, where everything stood.
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 *
 * =====================================================================================
 *  WHERE THE RULES ARE OPEN - what the simulator does, and the constant behind it
 * =====================================================================================
 *   F1. Which way tower X faces, and a cube that goes into a tower from the back - ANSWERED by the
 *       organiser: X opens "Up, toward the hydrant line": the cube slides into X from the hydrant's
 *       black line, so the robot comes down the hydrant line. A cube that goes in from the back
 *       (from the yellow square below X) does not count: the letter does not show, and the score
 *       sheet and the console say why. The corner towers open towards their stems (the rules: "The
 *       referee faces each tower opening toward its track"): M and A to the top, K and E to the
 *       bottom.                                                       OPENING (./field.ts)
 *   F2. The space between a tower's two side supports - ANSWERED by the organiser: "About 6 cm", the
 *       width of the white square printed between the side marks; the gripper holding a cube does
 *       not fit, so the robot lets go and pushes the cube in. The simulator takes 60 mm; with the
 *       organiser's 10.5 cm width the supports are solid, 22.5 mm thick (the rules' photos show thin
 *       plates). A cube in the middle has 5 mm on each side.   TOWER_GAP, SUPPORT_WIDTH (./field.ts)
 *   F3. The tower's height: 10 cm (ASSUMPTION). The flap with the letter is drawn from 7 cm (the top
 *       of a cube) up; nothing collides with it. The lever a real cube pushes is not simulated: the
 *       letter follows the rule above.                       TOWER_HEIGHT, FLAP_BOTTOM (./field.ts)
 *   F4. When the letter shows: the white dashed square to the OUTER edge of its dashes (ASSUMPTION;
 *       its inner edge or its centre line would leave less room). The dashed line counts; "half
 *       in" never does. A cube pushed so far towards the back that its base leaves the square does
 *       not show the letter either.                                       LETTER_AREA (./field.ts)
 *   F5. The robot's gripper and the supports: a claw that holds a cube (66 mm) is wider than the
 *       space between the supports, so the robot lets the cube go in front of the tower and pushes
 *       it in with the closed, empty claw (36 mm). (The organiser's answer to F2 says the same.)
 *       Opening the claw inside a tower pushes the tower away (the engine has no motor that stalls:
 *       a real claw would stop). Closing the claw around one support stops against it and moves
 *       nothing - but a robot that then turns drags the tower along.  robot.ts FIRE_FIGHTER_ROBOT
 *   F6. The T bars at M, A, K and E: the claw of this robot reaches 82 mm further ahead than its
 *       line sensor, and the T bars of the corner towers lie only 56.6 - 60.4 mm before the tower,
 *       so a robot that stops when its sensor sees the bar has its claw in the tower already. At X
 *       the bar lies 130 mm before the tower.            robot.ts clawAheadOfLineSensor(), TOWER_STEMS
 *   F7. "Collect" the yellow cube: the claw holds it, or it was pushed off its red square - either
 *       counts (ASSUMPTION).                                         YELLOW_SQUARE (./field.ts)
 *   F8. What is a delivery: a cube under any tower with its letter showing and the robot clear of
 *       it - also a cube under the wrong tower ("A cube at the wrong tower must be moved to its
 *       correct destination"), so the yellow cube under K first breaks the yellow rule. Touching or
 *       nudging a cube that is already under a tower is not a new delivery; taking it out and
 *       pushing it in again is (ASSUMPTION: the rules' "before making another delivery").  look()
 *   F9. A cube the robot still touches at the end scores 0: "move clear" is read as "no longer
 *       touching" (ASSUMPTION).                                                       TOUCH_MM
 *   F10. A tower that moved but still touches its picture square keeps its 20 points ("A correct
 *       delivery can still earn all 20 points", §7.2); its letter is judged where it now stands.
 *   F11. The scoring is the rules' "Proposed scoring for organizer review": the simulator plays it as
 *       written.                                    DELIVERY_POINTS, MOVED_TOWER_PENALTY, MAX_SCORE
 *   F12. Restarts: the rules name none, and the simulator has none.        restartRules (below)
 *   F13. The start: the robot stands inside the Fire Station (the rules: "inside the Fire Station
 *       start area"), at first facing up with its middle on the Fire Station stem; a student may
 *       move and turn it, but only inside the Fire Station's picture.     robot.ts START_POSE
 *
 * Not simulated: a referee's judgement by eye (the simulator measures every cube to the
 * millimetre), a tower that turns or tips over (the engine cannot turn or tip things: the rules'
 * "A tower may slide or turn" is half simulated), a cube that tips over.
 */
import { obbOverlap, obbTouches, obbTouchesRect, pointInRect, rectContainsOBB, rectToOBB, type OBB, type Rect, type Vec2 } from '../core/geometry';
import type { Body, ColorName, Game, Referee, RefereeCall, RefereeProp, ScoreContext, ScoreLine, ScoreReport, ZoneOverlay } from '../core/types';
import {
  CUBE_HEIGHT,
  CUBE_HOMES,
  CUBE_MASS,
  CUBE_PLACES,
  CUBE_SIZE,
  CUBE_SQUARES,
  FIRE_STATION,
  FLAP_BOTTOM,
  LETTER_AREA,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  OPENING,
  PICTURE_SQUARES,
  SQUARE_MIDDLES,
  SUPPORT_WIDTH,
  TOWER_DEPTH,
  TOWER_GAP,
  TOWER_HEIGHT,
  TOWER_IDS,
  TOWER_MASS,
  TOWER_MIDDLES,
  TOWER_NAMES,
  TOWER_WIDTH,
  YELLOW_SQUARE,
  supportMiddle,
  type CubePlace,
  type TowerId,
} from './field';
import { FIRE_FIGHTER_ROBOT, START_POSE } from './robot';
import {
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  type FireFighterScenario,
} from './scenario';

// =============================================================================================
// Points and time (rules §7; the organiser)
// =============================================================================================

/** RULE §7.1: "Award 20 points for each correct red delivery and 20 points for the direct yellow delivery to X." */
export const DELIVERY_POINTS = 20;
/** RULE §7.2: a tower that ends off its picture square: 0 for its delivery, "and deduct 4 points. Count this penalty only once per tower." */
export const MOVED_TOWER_PENALTY = 4;
/** RULE §7.1, §7.3: "Five successful deliveries earn 100 points." "The highest score is 100." */
export const MAX_SCORE = TOWER_IDS.length * DELIVERY_POINTS;
/** ORGANISER: a match lasts 3 minutes (the rules give no time). */
export const MATCH_DURATION = 180;

/** Two things closer than this (mm) touch (as in Locker Room and Warehouse Sort). */
export const TOUCH_MM = 0.5;
/** A cube whose base is at most this high (mm) stands on the mat (as in Locker Room). */
export const ON_MAT_MM = 0.5;

// =============================================================================================
// The cubes and the towers as game elements
// =============================================================================================

export const KIND_CUBE = 'cube';
export const KIND_SUPPORT = 'tower-support';

/** The colour of each cube (rules §2.2): four red ones in the bays, the yellow one on its red square. */
export type CubeColor = Extract<ColorName, 'red' | 'yellow'>;
export const CUBE_COLORS: Readonly<Record<CubePlace, CubeColor>> = {
  'red-left-upper': 'red',
  'red-left-lower': 'red',
  'red-right-upper': 'red',
  'red-right-lower': 'red',
  yellow: 'yellow',
};
/** The colour each tower needs (rules §6): red at M, A, K and E, yellow at X. */
export const WANTED_COLOR: Readonly<Record<TowerId, CubeColor>> = { M: 'red', A: 'red', K: 'red', E: 'red', X: 'yellow' };

/** Body id of the cube that starts on a place: 'cube:red-left-upper' ... 'cube:yellow'. */
export const cubeId = (place: CubePlace): string => `cube:${place}`;
export const YELLOW_CUBE_ID = cubeId('yellow');
export const CUBE_IDS: readonly string[] = CUBE_PLACES.map(cubeId);

export type SupportSide = 'left' | 'right';
/** Body id of a tower's side support: 'tower:M:left', 'tower:M:right' (the console names both "tower M"). */
export const supportId = (tower: TowerId, side: SupportSide): string => `tower:${tower}:${side}`;
/** The Body.group of a tower's two supports: 'tower:M'. */
export const towerGroup = (tower: TowerId): string => `tower:${tower}`;
/** Id of the flap of a tower (a RefereeProp): 'letter:M'. */
export const flapId = (tower: TowerId): string => `letter:${tower}`;

/** How the cubes are drawn: a strong red and a strong yellow. */
export const CUBE_FILL: Readonly<Record<CubeColor, string>> = { red: '#e8382f', yellow: '#ffd21f' };
/** The supports, and a flap whose letter is hidden: light plywood (the rules' photos). */
export const PLYWOOD_FILL = '#d8bf94';
/** A flap whose letter shows: light, with the letter on it. */
export const FLAP_SHOWN_FILL = '#fff7e0';
/** How high the letter on a flap is drawn, in mm of the mat. */
export const FLAP_LETTER_MM = 30;

function cube(place: CubePlace): Body {
  const { x, y } = CUBE_HOMES[place];
  const color = CUBE_COLORS[place];
  return {
    id: cubeId(place),
    kind: KIND_CUBE,
    label: '',
    fill: CUBE_FILL[color],
    colorName: color,
    x,
    y,
    angle: 0,
    w: CUBE_SIZE,
    l: CUBE_SIZE,
    h: CUBE_HEIGHT,
    z: 0,
    restingOn: null,
    held: false,
    grippable: true,
    platform: false,
    mass: CUBE_MASS,
    home: { x, y, angle: 0, z: 0, restingOn: null },
  };
}

function support(tower: TowerId, side: SupportSide): Body {
  const { x, y } = supportMiddle(tower, side);
  return {
    id: supportId(tower, side),
    kind: KIND_SUPPORT,
    label: '',
    fill: PLYWOOD_FILL,
    x,
    y,
    angle: 0,
    w: SUPPORT_WIDTH,
    l: TOWER_DEPTH,
    h: TOWER_HEIGHT,
    z: 0,
    restingOn: null,
    held: false,
    grippable: false,
    platform: false,
    mass: TOWER_MASS,
    home: { x, y, angle: 0, z: 0, restingOn: null },
    group: towerGroup(tower),
  };
}

/** The ten supports of the five towers (left, right; M A K E X), then the five cubes on their squares. */
function createBodies(): Body[] {
  const bodies: Body[] = [];
  for (const tower of TOWER_IDS) bodies.push(support(tower, 'left'), support(tower, 'right'));
  for (const place of CUBE_PLACES) bodies.push(cube(place));
  return bodies;
}

// =============================================================================================
// Areas the screen can highlight
// =============================================================================================

const START_CSS = '#facc15';
const PICKUP_CSS: Readonly<Record<CubeColor, string>> = { red: '#dc2626', yellow: '#eab308' };
const LETTER_AREA_CSS = '#16a34a';
const PICTURE_SQUARE_CSS = '#0284c7';

function overlays(): ZoneOverlay[] {
  const out: ZoneOverlay[] = [{ id: 'start', label: 'Fire Station', rect: FIRE_STATION, color: START_CSS, kind: 'start' }];
  for (const place of CUBE_PLACES) {
    const color = CUBE_COLORS[place];
    out.push({ id: `pickup:${place}`, label: `${color} cube`, rect: CUBE_SQUARES[place], color: PICKUP_CSS[color], kind: 'pickup' });
  }
  for (const tower of TOWER_IDS) out.push({ id: `delivery:${tower}`, label: tower, rect: LETTER_AREA[tower], color: LETTER_AREA_CSS, kind: 'delivery' });
  for (const tower of TOWER_IDS) {
    out.push({ id: `picture:${tower}`, label: `${tower} · ${TOWER_NAMES[tower]}`, rect: PICTURE_SQUARES[tower], color: PICTURE_SQUARE_CSS, kind: 'tower-area' });
  }
  return out;
}

// =============================================================================================
// What the referee looks at
// =============================================================================================

/** Footprint of a body on the mat, seen from above. */
export function footprint(body: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle'>): OBB {
  return { x: body.x, y: body.y, w: body.w, l: body.l, angle: body.angle };
}

const shifted = (r: Rect, by: Vec2): Rect => ({ x: r.x + by.x, y: r.y + by.y, w: r.w, h: r.h });
const NO_SHIFT: Vec2 = Object.freeze({ x: 0, y: 0 });

/**
 * How far a tower has slid from where it stood at the start (its two supports move together:
 * Body.group). (0, 0) for a tower whose support is not on the field.
 */
export function towerShift(tower: TowerId, bodies: readonly Body[]): Vec2 {
  const id = supportId(tower, 'left');
  for (const body of bodies) if (body.id === id) return { x: body.x - body.home.x, y: body.y - body.home.y };
  return NO_SHIFT;
}

/** The space between a tower's two supports (60 x 40 mm), where the tower now stands. */
export function gapNow(tower: TowerId, shift: Vec2): OBB {
  const m = TOWER_MIDDLES[tower];
  return { x: m.x + shift.x, y: m.y + shift.y, w: TOWER_GAP, l: TOWER_DEPTH, angle: 0 };
}

/** The tower's base (105 x 40 mm), where it now stands. */
export function baseNow(tower: TowerId, shift: Vec2): OBB {
  const m = TOWER_MIDDLES[tower];
  return { x: m.x + shift.x, y: m.y + shift.y, w: TOWER_WIDTH, l: TOWER_DEPTH, angle: 0 };
}

/** The letter area (the dashed square to the outer edge of its dashes), where the tower now stands. */
export function letterAreaNow(tower: TowerId, shift: Vec2): Rect {
  return shifted(LETTER_AREA[tower], shift);
}

/** (a cube farther than this from the middle of a tower's gap cannot overlap it: half the diagonals of both) */
const NEAR_GAP = Math.hypot(TOWER_GAP, TOWER_DEPTH) / 2 + Math.hypot(CUBE_SIZE, CUBE_SIZE) / 2 + 1;

/** The cube's base overlaps the space between the tower's supports (touching it is not overlapping). */
export function inGap(body: Body, tower: TowerId, shift: Vec2): boolean {
  const gap = gapNow(tower, shift);
  if (Math.abs(body.x - gap.x) > NEAR_GAP || Math.abs(body.y - gap.y) > NEAR_GAP) return false;
  return obbOverlap(gap, footprint(body)) !== null;
}

/** The tower (if any) whose gap the cube's base overlaps now. */
function towerAround(body: Body, shifts: Readonly<Record<TowerId, Vec2>>): TowerId | null {
  for (const tower of TOWER_IDS) if (inGap(body, tower, shifts[tower])) return tower;
  return null;
}

/**
 * How far (mm) the cube's middle stands from the middle of the tower's white dashed square,
 * towards the tower's opening (negative: towards its back), where the tower now stands.
 */
export function towardsOpening(body: Pick<Body, 'y'>, tower: TowerId, shift: Vec2): number {
  const middle = SQUARE_MIDDLES[tower].y + shift.y;
  return OPENING[tower] === 'top' ? middle - body.y : body.y - middle;
}

/** The cube's whole base is inside the letter area of the tower (its edge counts as inside). */
export function insideLetterArea(body: Body, tower: TowerId, shift: Vec2): boolean {
  return rectContainsOBB(letterAreaNow(tower, shift), footprint(body));
}

/** A part of the cube's base is inside the letter area of the tower. */
function overlapsLetterArea(body: Body, tower: TowerId, shift: Vec2): boolean {
  return obbOverlap(rectToOBB(letterAreaNow(tower, shift)), footprint(body)) !== null;
}

/** RULE §7.2: the tower's base still touches (or overlaps) its picture square - "Touching the boundary counts". */
export function onPictureSquare(tower: TowerId, shift: Vec2): boolean {
  return obbTouchesRect(baseNow(tower, shift), PICTURE_SQUARES[tower], 0);
}

/** The cube is held by the gripper. */
const isHeld = (body: Body, holding: string | null): boolean => body.held || holding === body.id;

/** The cube stands on the mat: not held, not lifted, not on anything. */
const standsOnMat = (body: Body, holding: string | null): boolean => !isHeld(body, holding) && body.restingOn === null && body.z <= ON_MAT_MM;

/**
 * A part of the robot is closer than TOUCH_MM to a box that stands from `z` up to `z + h`, seen
 * from above AND in height: the chassis reaches from the mat to its height, each finger from the
 * underside of the claw up by the height of a finger (ScoreContext.robotShapes: the chassis first,
 * then the two fingers). So a raised claw above a cube does not touch it. (As in Locker Room.)
 */
function robotTouches(box: OBB, z: number, h: number, ctx: ScoreContext<FireFighterScenario>): boolean {
  const config = ctx.robotConfig;
  const claw = ctx.world.robot.gripper.height;
  return ctx.robotShapes.some((shape, i) => {
    const finger = i > 0 && config.gripper.enabled;
    const bottom = finger ? claw : 0;
    const top = finger ? claw + config.gripper.fingerHeight : config.chassisHeight;
    const heightsMeet = bottom < z + h + TOUCH_MM && z < top + TOUCH_MM;
    return heightsMeet && obbTouches(box, shape, TOUCH_MM);
  });
}

/** The cube touches the robot (F9: a cube that touches the robot is no delivery, and scores nothing at the end). */
export function touchesRobot(body: Body, ctx: ScoreContext<FireFighterScenario>): boolean {
  return robotTouches(footprint(body), body.z, body.h, ctx);
}

// =============================================================================================
// Words
// =============================================================================================

/** Match time as the referee writes it: 41.27 -> "0:41.2" (tenths cut off, never rounded up). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1)}`;
}

const isYellow = (id: string): boolean => id === YELLOW_CUBE_ID;
/** "the yellow cube" / "a red cube" (the four red cubes are alike: "any red cube", §4.2) */
const cubeName = (id: string): string => (isYellow(id) ? 'the yellow cube' : 'a red cube');
const CubeName = (id: string): string => (isYellow(id) ? 'The yellow cube' : 'A red cube');

/** The label of a tower's line on the score sheet: "M · school: a red cube". */
export function towerLabel(tower: TowerId): string {
  return tower === 'X' ? 'X · hydrant: the yellow cube, as the next delivery' : `${tower} · ${TOWER_NAMES[tower]}: a red cube`;
}

/** The console's sentences: each is said once, on the tick it happens. */
export const SAY = {
  collected: 'The robot took the yellow cube. Now tower X must be its next delivery.',
  delivered: (cube: string, tower: TowerId): string => {
    if (WANTED_COLOR[tower] === (isYellow(cube) ? 'yellow' : 'red')) return `${CubeName(cube)} is under tower ${tower}: the letter ${tower} shows.`;
    return tower === 'X'
      ? 'A red cube is under tower X: the letter X shows, but X needs the yellow cube.'
      : `The yellow cube is under tower ${tower}: the letter ${tower} shows, but ${tower} needs a red cube.`;
  },
  notDirect: 'That was not the yellow cube at X: the yellow cube can no longer score.',
  fromTheBack: (tower: TowerId): string => `A cube went in from the back of tower ${tower}. Tower ${tower} opens to the ${OPENING[tower]}: a cube counts only when it goes in from there.`,
  offPicture: (tower: TowerId): string => `Tower ${tower} is off its picture square: 0 for ${tower}, and ${MOVED_TOWER_PENALTY} points off.`,
} as const;

/** The status line while the robot has taken the yellow cube and X is still to come. */
export const NOW_YELLOW_TAKEN = 'The robot took the yellow cube: X must be its next delivery.';

// =============================================================================================
// The referee
// =============================================================================================

export const towerLineId = (tower: TowerId): string => `tower-${tower}`;
export const LINE_TOWERS_MOVED = 'towers-moved';

/** One cube in one tower, from the tick it came in until it leaves (see "WORDS OF THE RULES" above). */
export interface Stay {
  tower: TowerId;
  /** it came in through the tower's opening (false: from the back) */
  throughOpening: boolean;
  /** match time of its first tick */
  since: number;
  /** match time of its delivery (null: none yet) */
  delivered: number | null;
}

/** A delivery (F8): which cube, under which tower, when. */
export interface Delivery {
  cube: string;
  tower: TowerId;
  time: number;
}

/** What the referee knows about the yellow rule: "After pickup, was X the robot's next delivery with yellow?" */
export interface YellowRule {
  /** when the robot took the yellow cube (null: not yet) */
  collectedAt: number | null;
  /** the first delivery at or after that moment, which decides it (null: none yet) */
  decidedBy: Delivery | null;
  /** yes: the yellow cube at X; no: anything else; unknown: not decided yet */
  direct: 'yes' | 'no' | 'unknown';
}

/** The field as the referee judges it: the cubes, how far each tower slid, what the claw holds, what touches the robot. */
interface FieldView {
  cubes: readonly Body[];
  shifts: Readonly<Record<TowerId, Vec2>>;
  holding: string | null;
  touching: (cube: Body) => boolean;
  stays: ReadonlyMap<string, Stay>;
}

function shiftsOf(bodies: readonly Body[]): Record<TowerId, Vec2> {
  return { M: towerShift('M', bodies), A: towerShift('A', bodies), K: towerShift('K', bodies), E: towerShift('E', bodies), X: towerShift('X', bodies) };
}

function cubesOf(bodies: readonly Body[]): Body[] {
  return bodies.filter((body) => body.kind === KIND_CUBE);
}

/** The letter of the tower shows because of this cube (see "WORDS OF THE RULES" above). */
export function letterShows(body: Body, tower: TowerId, stay: Stay | undefined, holding: string | null, shift: Vec2): boolean {
  if (!stay || stay.tower !== tower || !stay.throughOpening) return false;
  return standsOnMat(body, holding) && insideLetterArea(body, tower, shift);
}

/** The flap of a tower: between the supports where the tower now stands, from the top of a cube to the top of the tower. */
export function flapProp(tower: TowerId, shift: Vec2, shown: boolean): RefereeProp {
  const m = TOWER_MIDDLES[tower];
  return {
    id: flapId(tower),
    label: shown ? tower : '',
    fill: shown ? FLAP_SHOWN_FILL : PLYWOOD_FILL,
    frame: 'mat',
    x: m.x + shift.x,
    y: m.y + shift.y,
    angle: 0,
    w: TOWER_GAP,
    l: TOWER_DEPTH,
    z: FLAP_BOTTOM,
    h: TOWER_HEIGHT - FLAP_BOTTOM,
    labelMm: FLAP_LETTER_MM,
  };
}

/** What the five flaps show and where they stand, as one string (the flaps change when it changes). */
function flapsKey(shown: readonly boolean[], shifts: Readonly<Record<TowerId, Vec2>>): string {
  return TOWER_IDS.map((tower, i) => `${tower}${shown[i] ? 1 : 0}${shifts[tower].x},${shifts[tower].y}`).join('|');
}

/** Two deliveries on one tick: the yellow cube at X first (then in the order of the cubes). */
const yellowAtXFirst = (a: Delivery, b: Delivery): number => Number(isYellow(b.cube) && b.tower === 'X') - Number(isYellow(a.cube) && a.tower === 'X');

export interface FireFighterReferee extends Referee<FireFighterScenario> {
  /** What the referee knows about the yellow rule (for tests and for anyone who wants to look). */
  yellowRule(): YellowRule;
  /** Every delivery so far, in order. */
  deliveries(): readonly Delivery[];
  /** The stay of a cube in a tower right now (as of the referee's last look), if any. */
  stayOf(cubeId: string): Stay | undefined;
}

function createReferee(_scenario: FireFighterScenario): FireFighterReferee {
  /** the yellow cube was collected (F7) */
  let collectedAt: number | null = null;
  /** the first delivery at or after the collection: it decides "X must be your next delivery" */
  let decidedBy: Delivery | null = null;
  const deliveries: Delivery[] = [];
  /** the cubes that are in a tower now, and how they came in */
  const stays = new Map<string, Stay>();
  /** the towers that have left their picture square at some moment (the console said so) */
  const leftPicture = new Set<TowerId>();
  /** the tick the referee looked at last (it looks once per tick) */
  let lookedAt = -1;
  /** sentences said by the last look(s), not yet handed to the simulation */
  let pending: string[] = [];
  /** the match is over: from now on the sheet is final, and judges the field kept in `final` */
  let over = false;
  let final: FieldView | null = null;
  /** the five flaps (the same list while nothing changes): at the start, on their towers, the letters hidden */
  const noShifts: Record<TowerId, Vec2> = { M: NO_SHIFT, A: NO_SHIFT, K: NO_SHIFT, E: NO_SHIFT, X: NO_SHIFT };
  let props: readonly RefereeProp[] = TOWER_IDS.map((tower) => flapProp(tower, NO_SHIFT, false));
  let propsKey = flapsKey(TOWER_IDS.map(() => false), noShifts);

  const direct = (): YellowRule['direct'] => (decidedBy === null ? 'unknown' : isYellow(decidedBy.cube) && decidedBy.tower === 'X' ? 'yes' : 'no');

  function refreshProps(cubes: readonly Body[], shifts: Readonly<Record<TowerId, Vec2>>, holding: string | null): void {
    const shown = TOWER_IDS.map((tower) => cubes.some((c) => letterShows(c, tower, stays.get(c.id), holding, shifts[tower])));
    const key = flapsKey(shown, shifts);
    if (key === propsKey) return;
    propsKey = key;
    props = TOWER_IDS.map((tower, i) => flapProp(tower, shifts[tower], shown[i]));
  }

  /**
   * Look at the field once per tick: the collection of the yellow cube, the stays, the deliveries,
   * the towers off their picture squares. (score() looks too, so that a sheet asked for a field the
   * referee has not seen yet is the same as after observe(); a second look at the same tick changes
   * nothing.)
   */
  function look(ctx: ScoreContext<FireFighterScenario>): void {
    const world = ctx.world;
    if (world.tick === lookedAt) return;
    lookedAt = world.tick;
    const time = world.time;
    const holding = world.robot.gripper.holding;
    const cubes = cubesOf(world.bodies);
    const shifts = shiftsOf(world.bodies);

    // ---- F7: the yellow cube is collected when the claw holds it or its middle has left its red square
    if (collectedAt === null) {
      const yellow = cubes.find((c) => c.id === YELLOW_CUBE_ID);
      if (yellow && (isHeld(yellow, holding) || !pointInRect(yellow, YELLOW_SQUARE))) {
        collectedAt = time;
        pending.push(SAY.collected);
      }
    }

    // ---- the stays: which tower each cube is in, and how it came in
    for (const c of cubes) {
      const tower = towerAround(c, shifts);
      const stay = stays.get(c.id);
      if (tower === null) {
        if (stay) stays.delete(c.id);
        continue;
      }
      if (stay && stay.tower === tower) continue;
      const throughOpening = towardsOpening(c, tower, shifts[tower]) >= 0;
      stays.set(c.id, { tower, throughOpening, since: time, delivered: null });
      if (!throughOpening) pending.push(SAY.fromTheBack(tower));
    }

    // ---- F8: the deliveries - the first tick of a stay at which the letter shows and the robot is clear of the cube
    const now: Delivery[] = [];
    for (const c of cubes) {
      const stay = stays.get(c.id);
      if (!stay || stay.delivered !== null) continue;
      if (!letterShows(c, stay.tower, stay, holding, shifts[stay.tower]) || touchesRobot(c, ctx)) continue;
      stay.delivered = time;
      now.push({ cube: c.id, tower: stay.tower, time });
    }
    now.sort(yellowAtXFirst);
    for (const d of now) {
      deliveries.push(d);
      pending.push(SAY.delivered(d.cube, d.tower));
      if (collectedAt !== null && decidedBy === null) {
        decidedBy = d;
        if (direct() === 'no') pending.push(SAY.notDirect);
      }
    }

    // ---- §7.2: a tower that leaves its picture square (said once per tower; judged at the end)
    for (const tower of TOWER_IDS) {
      if (!leftPicture.has(tower) && !onPictureSquare(tower, shifts[tower])) {
        leftPicture.add(tower);
        pending.push(SAY.offPicture(tower));
      }
    }

    refreshProps(cubes, shifts, holding);
  }

  function observe(ctx: ScoreContext<FireFighterScenario>): RefereeCall | null {
    look(ctx);
    if (pending.length === 0) return null;
    const say = pending;
    pending = [];
    return { say };
  }

  /** There are no restarts in this game (Game.restartRules: none allowed): nothing to forget. */
  function restart(): void {
    // (the engine never calls this: restartRules.maxRestarts is 0)
  }

  /** The match is over: keep the field as it is now, before the motors stop (held, touching, positions, stays). */
  function finished(ctx: ScoreContext<FireFighterScenario>): void {
    look(ctx);
    const holding = ctx.world.robot.gripper.holding;
    const cubes = cubesOf(ctx.world.bodies).map((c) => ({ ...c, home: { ...c.home } }));
    const touching = new Set(cubesOf(ctx.world.bodies).filter((c) => touchesRobot(c, ctx)).map((c) => c.id));
    final = {
      cubes,
      shifts: shiftsOf(ctx.world.bodies),
      holding,
      touching: (c) => touching.has(c.id),
      stays: new Map([...stays].map(([id, stay]) => [id, { ...stay }])),
    };
    over = true;
  }

  function liveView(ctx: ScoreContext<FireFighterScenario>): FieldView {
    return {
      cubes: cubesOf(ctx.world.bodies),
      shifts: shiftsOf(ctx.world.bodies),
      holding: ctx.world.robot.gripper.holding,
      touching: (c) => touchesRobot(c, ctx),
      stays,
    };
  }

  /**
   * The detail (and points) of one tower's line: the first of these that applies -
   *   1. the tower is off its picture square;
   *   2. its letter shows, about the cube that shows it: the robot still touches it; the cube is of the
   *      wrong colour; (X) X was not the next delivery after the robot took the yellow cube; it scores;
   *   3. the robot holds a cube that is in the tower;
   *   4. a cube (not held) is in the tower, or reaches into its dashed square from the opening's side -
   *      about the one whose middle is nearest the middle of the square: it went in from the back; it is
   *      at the entrance; it is too far in;
   *   5. no cube under the tower.
   * Where the running and the closed sheet differ (the robot touches / touched, holds / held, "push it
   * farther in" / "not far enough in"), the closed form is used after the end of the match.
   */
  function judgeTower(tower: TowerId, field: FieldView): { points: number; detail: string; time?: number } {
    const shift = field.shifts[tower];
    if (!onPictureSquare(tower, shift)) return { points: 0, detail: `Tower ${tower} was pushed off its picture square: 0 for ${tower}, and ${MOVED_TOWER_PENALTY} points off.` };

    // ---- the letter shows: about the cube that shows it
    const shown = field.cubes.find((c) => letterShows(c, tower, field.stays.get(c.id), field.holding, shift));
    if (shown) {
      if (field.touching(shown)) {
        return {
          points: 0,
          detail: over
            ? `The robot still touched the cube under tower ${tower} when the match ended: it does not count.`
            : `The robot still touches the cube under tower ${tower}. It counts once the robot has moved clear.`,
        };
      }
      if (shown.colorName !== WANTED_COLOR[tower]) {
        return {
          points: 0,
          detail: tower === 'X' ? 'A red cube is under tower X. Tower X needs the yellow cube.' : `The yellow cube is under tower ${tower}. Tower ${tower} needs a red cube; the yellow one belongs under X.`,
        };
      }
      if (tower === 'X' && direct() !== 'yes') {
        // (never undecided here: the yellow cube left its red square before it reached X, so it was
        // collected, and the referee looked at this field - the tick its letter first showed with the
        // robot clear decided the rule)
        const first = decidedBy;
        const tail = first ? `: first ${cubeName(first.cube)} went under tower ${first.tower} (${clock(first.time)})` : '';
        return { points: 0, detail: `The yellow cube is under X, but X was not the robot's next delivery after it took the yellow cube${tail}.` };
      }
      const delivered = field.stays.get(shown.id)?.delivered ?? null;
      return {
        points: DELIVERY_POINTS,
        detail:
          tower === 'X'
            ? "The yellow cube is under X, the letter X shows, and X was the robot's next delivery after it took the yellow cube."
            : `A red cube is under tower ${tower} and the letter ${tower} shows.`,
        ...(delivered !== null ? { time: delivered } : {}),
      };
    }

    // ---- the robot holds a cube that is in the tower
    if (field.cubes.some((c) => isHeld(c, field.holding) && inGap(c, tower, shift))) {
      return {
        points: 0,
        detail: over
          ? `The robot still held a cube at tower ${tower} when the match ended: it does not count.`
          : `The robot still holds a cube at tower ${tower}: let go and move clear.`,
      };
    }

    // ---- a cube in the tower, or at its entrance: about the one whose middle is nearest the middle of the square
    const middle = { x: SQUARE_MIDDLES[tower].x + shift.x, y: SQUARE_MIDDLES[tower].y + shift.y };
    let near: Body | null = null;
    let nearest = Infinity;
    for (const c of field.cubes) {
      if (isHeld(c, field.holding)) continue;
      const atTower = inGap(c, tower, shift) || (towardsOpening(c, tower, shift) > 0 && overlapsLetterArea(c, tower, shift));
      const distance = Math.hypot(c.x - middle.x, c.y - middle.y);
      if (atTower && distance < nearest) {
        near = c;
        nearest = distance;
      }
    }
    if (near === null) return { points: 0, detail: `No cube under tower ${tower}.` };
    const stay = field.stays.get(near.id);
    if (stay && stay.tower === tower && !stay.throughOpening) return { points: 0, detail: SAY.fromTheBack(tower) };
    if (towardsOpening(near, tower, shift) > 0) {
      return {
        points: 0,
        detail: over
          ? `A cube is at the entrance of tower ${tower}: it is not far enough in.`
          : `A cube is at the entrance of tower ${tower}: push it farther in, inside the white dashed square.`,
      };
    }
    return { points: 0, detail: `A cube is too far in tower ${tower}: it is past the white dashed square, towards the back.` };
  }

  function score(ctx: ScoreContext<FireFighterScenario>): ScoreReport {
    if (!over) look(ctx);
    const field = over && final ? final : liveView(ctx);
    const lines: ScoreLine[] = [];
    for (const tower of TOWER_IDS) {
      const { points, detail, time } = judgeTower(tower, field);
      lines.push({ id: towerLineId(tower), label: towerLabel(tower), points, max: DELIVERY_POINTS, ok: points > 0, detail, ...(time !== undefined ? { time } : {}) });
    }
    const moved = TOWER_IDS.filter((tower) => !onPictureSquare(tower, field.shifts[tower]));
    const penalty = MOVED_TOWER_PENALTY * moved.length;
    lines.push({
      id: LINE_TOWERS_MOVED,
      label: 'Towers on their picture squares',
      // (0, not -0, when no tower moved)
      points: penalty === 0 ? 0 : -penalty,
      max: 0,
      ok: moved.length === 0,
      detail:
        moved.length === 0
          ? 'Every tower still touches its picture square.'
          : moved.length === 1
            ? `Moved off its picture square: ${moved[0]} (${MOVED_TOWER_PENALTY} points).`
            : `Moved off their picture squares: ${moved.join(', ')} (${MOVED_TOWER_PENALTY} points each).`,
    });
    const sum = lines.reduce((total, line) => total + line.points, 0);
    const now = !over && collectedAt !== null && decidedBy === null ? NOW_YELLOW_TAKEN : undefined;
    return { total: Math.max(0, sum), max: MAX_SCORE, lines, complete: lines.every((line) => line.ok), ...(now ? { now } : {}) };
  }

  return {
    observe,
    restart,
    finished,
    score,
    props: () => props,
    yellowRule: () => ({ collectedAt, decidedBy, direct: direct() }),
    deliveries: () => deliveries,
    stayOf: (id) => stays.get(id),
  };
}

// =============================================================================================
// The game
// =============================================================================================

export const fireFighterGame: Game<FireFighterScenario> = {
  id: 'fire-fighter',
  title: 'MakeX Lebanon 2027 - Fire Fighter',
  mat: {
    width: MAT_SIZE,
    height: MAT_SIZE,
    imageUrl: MAT_IMAGE_URL,
    sensorImageUrl: MAT_SENSOR_IMAGE_URL,
    vector: MAT_VECTOR,
  },
  matchDuration: MATCH_DURATION,
  startZone: FIRE_STATION,
  defaultStartPose: START_POSE,
  // (no restarts in this game: restartRules below)
  restartPenalty: 0,
  defaultScenario,
  randomScenario,
  scenarioCount: () => SCENARIO_COUNT,
  encodeScenario,
  decodeScenario,
  describeScenario,
  createBodies,
  overlays,
  // (during a match the referee below keeps the score; this is the sheet of the field as it is,
  // looked at once - at the start of a match: nothing earned yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: FIRE_FIGHTER_ROBOT,
  createReferee,
  // F12: no restarts. The rules name none.
  restartRules: { maxRestarts: 0 },
};

export { createReferee as createFireFighterReferee };
