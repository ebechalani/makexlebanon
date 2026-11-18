/**
 * MakeX Lebanon, Season 2026 - Capelli Starter "Locker Room" (ages 13-15): the game and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of a match?            -> createBodies(), createWalls()
 *   2. Which areas should be highlighted on the mat?            -> overlays()
 *   3. What does the referee hold, or put on the robot?         -> the referee's props()
 *   4. What has the robot earned so far, when, and why (not)?   -> createReferee()
 *
 * The referee follows the organiser's latest rules ("Starter - Locker Room Mission", §5 - §9):
 *
 *   +5   Step 1, leave the Locker Room: the first moment the whole robot is outside it (its frame
 *        included), with the Team Box still on it (kept)
 *   +10  Step 2, reach the Scan Station: the first moment the whole robot is inside it (its yellow
 *        frame included), with the Team Box still on it (kept)
 *   +15  Step 3, coach approval: the robot comes to rest completely inside the Scan Station with
 *        the Team Box on it; the referee shows the colour card of the team colour, takes it away,
 *        and lifts the Team Box (timing: CARD_SHOW_S, CARD_AWAY_S, BOX_LIFT_S below)
 *   (Step 4, the 4-second pause, is cancelled in the rules.)
 *   +20 / -10  Step 5, the FIRST delivery of a team cube into a big circle decides it once: the
 *        cube of the team colour in the circle of the team colour +20, any other -10 (the cube of
 *        the team colour in the other circle, or the cube of the other colour in either circle)
 *   +5   Step 6, the stadium gate bonus, with a correct Step 5; the gate opens then
 *   -10  touching the closed gate (once per match)
 *   +10 / +5 / -10  Step 7, each token at the end: completely inside the target of its colour,
 *        partly inside it, or (otherwise, not on its own target at all) at least partly inside a
 *        target of another colour
 *   The total is never below 0. Highest score: 5 + 10 + 15 + 20 + 5 + 3 x 10 = 85.
 *
 * A match lasts 150 s. It ends then, or when the program has ended and the robot stands still (as
 * in Warehouse Sort); then the field is judged as it lies. There are no restarts (the rules have
 * none: touching the robot after GO voids the run).
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 *
 * =====================================================================================
 *  WHERE THE RULES ARE OPEN - what the simulator does, and the constant behind it
 * =====================================================================================
 *   L1. Which marks are pickup zones and which are targets: the rules v2.3 say both "RED pickup
 *       zone (top-left)" and "the cube located in the center zone on the matching RED or GREEN
 *       square". The simulator: team cubes on the two turned rectangles at the top, tokens to the
 *       small squares and the blue disc in the maze. ONE table: MARK_ROLES (./field.ts). With the
 *       published 50 mm cube, a token can never be COMPLETELY inside a 41.9 mm square: the red and
 *       the green token can only earn +5, and their line of the sheet counts +5 as done (it says
 *       why), so that the best a robot can do here is "complete".    cubeFitsInside()
 *   L2. "Drives out of the locker room": the WHOLE robot outside it (frame included).  isOutside()
 *   L3. Step 3: when does the referee show the card, take it away, lift the box? 0.5 s, 2.5 s and
 *       4.0 s after the robot came to rest (no wheel turning) completely inside the Scan Station
 *       with the box; if it moves before the box is lifted, the card goes away, the box stays,
 *       and it all starts again at the next rest.          CARD_SHOW_S, CARD_AWAY_S, BOX_LIFT_S
 *       The referee does NOT check that the program read the card: the simulator cannot see what
 *       a program reads, so a robot that only waits gets the +15 too. The rules: "At the Scan
 *       Station, the robot scans the color card" - how a real referee sees that is not written.
 *   L4. The card: the rules say "a color cube" and "the card". The referee holds a card of the
 *       team colour upright just in front of the claw, where the colour sensor at the claw reads
 *       it; the robot cannot push it, the ultrasonic sensor does not see it.   CARD (./field.ts)
 *   L5. A delivery: the cube stands on the mat, released, not touching the robot, completely
 *       inside a big circle. The first one decides Step 5; later ones change nothing. The rules
 *       do not say that the scan must come first: the simulator does not require it. The rules
 *       say only "Wrong color circle: -10": the cube of the other colour in ITS OWN circle is a
 *       wrong delivery here too. (Two team cubes delivered on the same tick: the cube of the team
 *       colour is looked at first.)                                         watchTeamCubes()
 *   L6. A token in a big circle, and a team cube on a maze target, count for nothing.
 *   L7. Gate penalty: once per match, however often the robot touches the closed gate; a cube
 *       pushed against the gate is not the robot touching it.            GATE_TOUCH_PENALTY
 *   L8. Step 7: "partly inside" a target of another colour counts as a wrong delivery (-10), like
 *       completely inside - unless the token is also partly on its own target (+5): the red square
 *       and the blue disc are only 19.6 mm apart; a token that is held, lifted or touching the
 *       robot at the end is not judged (0).                                        judgeToken()
 *   L9. The total is never below 0 (as in the other games).
 *   L10. Gate, Team Box and card sizes, the cube's weight: ./field.ts (GATE_HEIGHT, TEAM_BOX, CARD,
 *       CUBE_MASS).
 *   L11. The closed gate and the maze: the tokens are judged whether the gate is open or not, and
 *       the closed gate is only a block on the floor that the robot can drive around (the maze has
 *       no walls). The rules' story sorts the tokens "once the gate is open"; the rules v2.3 say
 *       "Only then may the robot enter the maze area." The latest rules give no penalty and no
 *       condition on the gate in Step 7, so the simulator adds none.             score()
 *
 * Not simulated: a voided run (score 0), field damage, the two runs of the ranking (the best of
 * two counts). The CyberPi buttons work during a match, so a program that reads them can be
 * steered by hand - the rules say "no remote control".
 */
import { obbCorners, obbOverlap, obbTouches, pointInRect, rectContainsOBB, rectToOBB, type OBB, type Rect, type Vec2 } from '../core/geometry';
import type {
  Body,
  FixedWall,
  Game,
  Referee,
  RefereeCall,
  RefereeProp,
  ScoreContext,
  ScoreLine,
  ScoreReport,
  ZoneOverlay,
} from '../core/types';
import {
  BIG_CIRCLES,
  CARD,
  CUBE_HEIGHT,
  CUBE_MASS,
  CUBE_SIZE,
  GATE_HEIGHT,
  GATE_MARK,
  LOCKER_ROOM,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_SIZE,
  MAT_VECTOR,
  SCAN_STATION,
  TEAM_BOX,
  TEAM_COLORS,
  ZONES,
  ZONE_IDS,
  markOutline,
  pickupZone,
  targetOf,
  type Circle,
  type Mark,
  type MarkColor,
  type TeamColor,
  type ZoneId,
} from './field';
import { LOCKER_ROOM_ROBOT, START_POSE } from './robot';
import {
  SCENARIO_COUNT,
  TOKEN_COLORS,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  scenarioProblems,
  tokensOf,
  type LockerRoomScenario,
  type TokenColor,
} from './scenario';

// =============================================================================================
// Points (rules §5, §8)
// =============================================================================================

export const POINTS_LEAVE = 5;
export const POINTS_SCAN_STATION = 10;
export const POINTS_APPROVAL = 15;
export const POINTS_DELIVERY = 20;
/** Points removed for a first delivery that is wrong (rules §5 Step 5: "Wrong color circle: -10"). */
export const WRONG_DELIVERY_PENALTY = 10;
export const POINTS_GATE = 5;
/** Points removed for touching the closed gate (rules §8.1; once per match: L7). */
export const GATE_TOUCH_PENALTY = 10;
export const POINTS_TOKEN = 10;
/** "Half points will be counted if PARTIALLY inside the color target." */
export const POINTS_TOKEN_PARTLY = 5;
/** Points removed for a token in a target of another colour (rules §5 Step 7: "Each wrong delivery: -10"). */
export const WRONG_TOKEN_PENALTY = 10;
/** 5 + 10 + 15 + 20 + 5 + 3 x 10 = 85. */
export const MAX_SCORE = POINTS_LEAVE + POINTS_SCAN_STATION + POINTS_APPROVAL + POINTS_DELIVERY + POINTS_GATE + TOKEN_COLORS.length * POINTS_TOKEN;
/** RULE: a match lasts 150 seconds. */
export const MATCH_DURATION = 150;

// =============================================================================================
// The referee's timing at the Scan Station (L3) - ASSUMPTIONS, one constant each
// =============================================================================================

/** The referee shows the colour card this long (s) after the robot came to rest completely inside the Scan Station with the Team Box. */
export const CARD_SHOW_S = 0.5;
/** ... takes it away this long (s) after the robot came to rest ... */
export const CARD_AWAY_S = 2.5;
/**
 * ... and lifts the Team Box this long (s) after the robot came to rest: Step 3, +15. (The rules:
 * "It's preferred that the robot waits 4 seconds in order to let the referee remove the Team Box.")
 */
export const BOX_LIFT_S = 4.0;

/** Two things closer than this (mm) touch (as in Warehouse Sort). */
export const TOUCH_MM = 0.5;
/** A cube whose base is at most this high (mm) stands on the mat (as in Warehouse Sort). */
const ON_MAT_MM = 0.5;
/** (a time "s seconds after" is reached on the tick where the clock is that far - 1e-9 for the arithmetic of 0.01 s ticks) */
const TIME_EPS = 1e-9;

// =============================================================================================
// The cubes and the gate
// =============================================================================================

export const KIND_CUBE = 'cube';
/** Body id of the cube of a team colour, which starts on its pickup zone: 'cube:team-red', 'cube:team-green'. */
export const teamCubeId = (color: TeamColor): string => `cube:team-${color}`;
/** Body id of the token that starts in a zone: 'token:A', 'token:B', 'token:C'. */
export const tokenId = (zone: ZoneId): string => `token:${zone}`;
/** Id of the gate (a fixed wall while it is closed). */
export const GATE_ID = 'wall:gate';

/** Cubes are drawn in the colours of Warehouse Sort's cubes, with a letter for those who cannot tell colours apart. */
export const CUBE_FILL: Record<MarkColor, string> = { red: '#ef4044', green: '#40ad49', blue: '#00aeef' };
export const CUBE_LETTER: Record<MarkColor, string> = { red: 'R', green: 'G', blue: 'B' };

/** The middle of a mark (where a cube stands on it) and how a cube stands on it (turned with it). */
function markPlace(mark: Mark): { x: number; y: number; angle: number } {
  if (mark.circle) return { x: mark.circle.cx, y: mark.circle.cy, angle: 0 };
  const box = mark.box as OBB;
  return { x: box.x, y: box.y, angle: box.angle };
}

/** Where the team cube of a colour stands at the start: in the middle of its pickup zone, turned with it (MARK_ROLES). */
export function teamCubeHome(color: TeamColor): { x: number; y: number; angle: number } {
  return markPlace(pickupZone(color));
}

/** Where the token of a zone stands at the start: in the middle of the zone's picture. */
export function tokenHome(zone: ZoneId): { x: number; y: number } {
  const r = ZONES[zone];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function cube(id: string, color: MarkColor, x: number, y: number, angle: number): Body {
  return {
    id,
    kind: KIND_CUBE,
    label: CUBE_LETTER[color],
    fill: CUBE_FILL[color],
    colorName: color,
    x,
    y,
    angle,
    w: CUBE_SIZE,
    l: CUBE_SIZE,
    h: CUBE_HEIGHT,
    z: 0,
    restingOn: null,
    held: false,
    grippable: true,
    platform: false,
    mass: CUBE_MASS,
    home: { x, y, angle, z: 0, restingOn: null },
  };
}

/** The two team cubes (on their pickup zones) and the three tokens (one in each zone, as the zone card says). */
function createBodies(s: LockerRoomScenario): Body[] {
  const bodies = TEAM_COLORS.map((color) => {
    const home = teamCubeHome(color);
    return cube(teamCubeId(color), color, home.x, home.y, home.angle);
  });
  const tokens = tokensOf(s);
  for (const zone of ZONE_IDS) {
    const home = tokenHome(zone);
    bodies.push(cube(tokenId(zone), tokens[zone], home.x, home.y, 0));
  }
  return bodies;
}

/** The closed stadium gate: a fixed wall on its dotted rectangle (GATE_HEIGHT high). It opens with a correct Step 5. */
export const GATE_WALL: FixedWall = {
  id: GATE_ID,
  label: 'gate',
  x: GATE_MARK.x + GATE_MARK.w / 2,
  y: GATE_MARK.y + GATE_MARK.h / 2,
  angle: 0,
  w: GATE_MARK.w,
  l: GATE_MARK.h,
  h: GATE_HEIGHT,
  fill: '#facc15',
  colorName: 'yellow',
};

function createWalls(): FixedWall[] {
  return [{ ...GATE_WALL }];
}

// =============================================================================================
// Areas the screen can highlight
// =============================================================================================

const COLOR_CSS: Record<MarkColor, string> = { red: '#dc2626', green: '#16a34a', blue: '#0284c7' };
const WORD: Record<MarkColor, string> = { red: 'RED', green: 'GREEN', blue: 'BLUE' };
/** a colour at the start of a zone's name: "Red pickup zone" */
const NAME: Record<MarkColor, string> = { red: 'Red', green: 'Green', blue: 'Blue' };

function boxAround(points: readonly Vec2[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const circleBox = (c: Circle): Rect => ({ x: c.cx - c.r, y: c.cy - c.r, w: 2 * c.r, h: 2 * c.r });

/** A mark as a zone of the screen: a circle as an ellipse, a turned rectangle by its outline. */
function markOverlay(mark: Mark, id: string, label: string, kind: ZoneOverlay['kind']): ZoneOverlay {
  const color = COLOR_CSS[mark.color];
  if (mark.circle) return { id, label, rect: circleBox(mark.circle), color, kind, shape: 'ellipse' };
  const outline = markOutline(mark);
  const turned = (mark.box as OBB).angle !== 0;
  return turned ? { id, label, rect: boxAround(outline), color, kind, outline } : { id, label, rect: boxAround(outline), color, kind };
}

function overlays(s: LockerRoomScenario): ZoneOverlay[] {
  const out: ZoneOverlay[] = [
    { id: 'start', label: 'Locker Room', rect: LOCKER_ROOM, color: '#facc15', kind: 'start' },
    { id: 'scan', label: 'Scan Station', rect: SCAN_STATION, color: '#f59e0b', kind: 'info' },
  ];
  for (const color of TEAM_COLORS) {
    const yours = color === s.team ? ' (your team)' : '';
    out.push(markOverlay(pickupZone(color), `pickup:${color}`, `${NAME[color]} pickup zone${yours}`, 'pickup'));
    out.push({ id: `circle:${color}`, label: `${NAME[color]} circle${yours}`, rect: circleBox(BIG_CIRCLES[color]), color: COLOR_CSS[color], kind: 'delivery', shape: 'ellipse' });
  }
  const tokens = tokensOf(s);
  for (const zone of ZONE_IDS) {
    out.push({ id: `zone:${zone}`, label: `Zone ${zone}: ${WORD[tokens[zone]]}`, rect: ZONES[zone], color: COLOR_CSS[tokens[zone]], kind: 'pickup' });
  }
  for (const color of TOKEN_COLORS) out.push(markOverlay(targetOf(color), `target:${color}`, `${NAME[color]} target`, 'delivery'));
  out.push({ id: 'gate', label: 'Stadium gate', rect: GATE_MARK, color: '#facc15', kind: 'info' });
  return out;
}

// =============================================================================================
// What the referee looks at
// =============================================================================================

/** Footprint of a body on the mat, seen from above. */
export function footprint(body: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle'>): OBB {
  return { x: body.x, y: body.y, w: body.w, l: body.l, angle: body.angle };
}

const LOCKER_BOX = rectToOBB(LOCKER_ROOM);

/** L2: the whole robot is outside the Locker Room (a shape that only touches its edge is outside). */
export function isOutsideLockerRoom(robotShapes: readonly OBB[]): boolean {
  return robotShapes.every((shape) => obbOverlap(LOCKER_BOX, shape) === null);
}

/** The whole robot is inside the Scan Station (its edge counts as inside). */
export function isInsideScanStation(robotShapes: readonly OBB[]): boolean {
  return robotShapes.every((shape) => rectContainsOBB(SCAN_STATION, shape));
}

/** The whole footprint lies inside the circle (its edge counts as inside). */
export function insideCircle(fp: OBB, c: Circle): boolean {
  return obbCorners(fp).every((p) => Math.hypot(p.x - c.cx, p.y - c.cy) <= c.r + 1e-6);
}

/** A part of the footprint lies inside the circle (a footprint that only touches it is not inside). */
export function overlapsCircle(fp: OBB, c: Circle): boolean {
  // the point of the footprint nearest to the middle of the circle, in the footprint's own frame
  const s = Math.sin(fp.angle);
  const k = Math.cos(fp.angle);
  const dx = c.cx - fp.x;
  const dy = c.cy - fp.y;
  const forward = dx * s - dy * k;
  const right = dx * k + dy * s;
  const f = Math.max(-fp.l / 2, Math.min(fp.l / 2, forward));
  const r = Math.max(-fp.w / 2, Math.min(fp.w / 2, right));
  return Math.hypot(forward - f, right - r) < c.r - 1e-9;
}

/** The big circle (if any) a footprint lies completely inside. */
export function bigCircleAround(fp: OBB): TeamColor | null {
  return TEAM_COLORS.find((color) => insideCircle(fp, BIG_CIRCLES[color])) ?? null;
}

/** How a footprint lies on a mark: 'full' (completely inside), 'part' (a part of it inside) or null. */
export function onMark(fp: OBB, mark: Mark): 'full' | 'part' | null {
  if (mark.circle) {
    if (insideCircle(fp, mark.circle)) return 'full';
    return overlapsCircle(fp, mark.circle) ? 'part' : null;
  }
  const box = mark.box as OBB;
  if (obbOverlap(box, fp) === null) return null;
  const outer = { ...box, w: box.w + 2e-6, l: box.l + 2e-6 };
  const corners = obbCorners(fp);
  // (inside the box: every corner within it - its edge counts as inside)
  const s = Math.sin(outer.angle);
  const k = Math.cos(outer.angle);
  const inside = corners.every((p) => {
    const dx = p.x - outer.x;
    const dy = p.y - outer.y;
    return Math.abs(dx * s - dy * k) <= outer.l / 2 && Math.abs(dx * k + dy * s) <= outer.w / 2;
  });
  return inside ? 'full' : 'part';
}

/**
 * Can a cube stand COMPLETELY inside this mark? A square or rectangle must be at least as wide as
 * the cube; a disc must hold the cube however it is turned (its corners on the circle).
 */
export function cubeFitsInside(mark: Mark, cube = CUBE_SIZE): boolean {
  if (mark.circle) return mark.circle.r >= (cube * Math.SQRT2) / 2;
  const box = mark.box;
  return box !== undefined && Math.min(box.w, box.l) >= cube;
}

/** The cube is held by the gripper. */
const isHeld = (body: Body, holding: string | null): boolean => body.held || holding === body.id;

/** The cube stands on the mat: not held, not lifted, not on anything. */
const standsOnMat = (body: Body, holding: string | null): boolean => !isHeld(body, holding) && body.restingOn === null && body.z <= ON_MAT_MM;

/**
 * A part of the robot is closer than TOUCH_MM to a box that stands on the mat from `z` up to
 * `z + h`, seen from above AND in height: the chassis reaches from the mat to its height, each
 * finger from the underside of the claw up by the height of a finger (ScoreContext.robotShapes:
 * the chassis first, then the two fingers - core/robot.ts robotShapesAt). So a raised claw above
 * a cube does not touch it.
 */
function robotTouches(box: OBB, z: number, h: number, ctx: ScoreContext<LockerRoomScenario>): boolean {
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

/** The cube touches the robot (L5, L8: a cube that touches the robot is no delivery). */
export function touchesRobot(body: Body, ctx: ScoreContext<LockerRoomScenario>): boolean {
  return robotTouches(footprint(body), body.z, body.h, ctx);
}

/** The robot touches the (closed) gate. */
export function touchesGate(ctx: ScoreContext<LockerRoomScenario>): boolean {
  return robotTouches({ x: GATE_WALL.x, y: GATE_WALL.y, w: GATE_WALL.w, l: GATE_WALL.l, angle: GATE_WALL.angle }, 0, GATE_WALL.h, ctx);
}

/** The robot's wheels do not turn (L3: "the robot has come to rest"). */
const atRest = (ctx: ScoreContext<LockerRoomScenario>): boolean => ctx.world.robot.left.rpm === 0 && ctx.world.robot.right.rpm === 0;

/**
 * Step 7: how a token lies at the end, and what that is worth (L8):
 *   'full'   completely inside the target of its colour: +10
 *   'part'   partly inside it: +5
 *   'wrong'  otherwise at least partly inside a target of another colour: -10
 *   'none'   anything else (the reason is in `why`)
 */
export interface TokenJudgement {
  result: 'full' | 'part' | 'wrong' | 'none';
  /** the target it is (partly) inside: its own for 'full' and 'part', the other one for 'wrong' */
  target: TokenColor | null;
  why: 'held' | 'lifted' | 'touching' | 'no-target' | null;
}

export function judgeToken(token: Body, ctx: ScoreContext<LockerRoomScenario>): TokenJudgement {
  const holding = ctx.world.robot.gripper.holding;
  const color = token.colorName as TokenColor;
  if (isHeld(token, holding)) return { result: 'none', target: null, why: 'held' };
  if (!standsOnMat(token, holding)) return { result: 'none', target: null, why: 'lifted' };
  if (touchesRobot(token, ctx)) return { result: 'none', target: null, why: 'touching' };
  const fp = footprint(token);
  const own = onMark(fp, targetOf(color));
  if (own === 'full') return { result: 'full', target: color, why: null };
  if (own === 'part') return { result: 'part', target: color, why: null };
  const other = TOKEN_COLORS.find((c) => c !== color && onMark(fp, targetOf(c)) !== null);
  if (other) return { result: 'wrong', target: other, why: null };
  return { result: 'none', target: null, why: 'no-target' };
}

// =============================================================================================
// Words
// =============================================================================================

/** Match time as the referee writes it: 83.42 -> "1:23.4" (tenths cut off, never rounded up). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1)}`;
}

/** "the RED team cube" */
const teamCubeName = (color: TeamColor): string => `the ${WORD[color]} team cube`;
const circleName = (color: TeamColor): string => `the ${WORD[color]} circle`;
const tokenName = (color: TokenColor): string => `the ${WORD[color]} token`;

// =============================================================================================
// The referee
// =============================================================================================

export const LINE_LEAVE = 'leave-locker-room';
export const LINE_SCAN_STATION = 'scan-station';
export const LINE_APPROVAL = 'coach-approval';
export const LINE_DELIVERY = 'team-delivery';
export const LINE_GATE = 'gate-bonus';
export const LINE_GATE_TOUCH = 'gate-touch';
export const tokenLineId = (color: TokenColor): string => `token:${color}`;
export const LINE_START_POSITION = 'start-position';

/** The Team Box prop (it rides on the robot until the referee lifts it). */
export const PROP_TEAM_BOX = 'team-box';
/** The colour card prop (the referee holds it in front of the claw). */
export const PROP_CARD = 'card';

/** The Team Box on top of the robot (frame 'robot': it moves with the robot). No sensor sees it. */
export function teamBoxProp(chassisHeight = LOCKER_ROOM_ROBOT.chassisHeight): RefereeProp {
  return { id: PROP_TEAM_BOX, label: 'Team Box', fill: '#f7941d', frame: 'robot', x: TEAM_BOX.forward, y: 0, angle: 0, w: TEAM_BOX.w, l: TEAM_BOX.l, z: chassisHeight, h: TEAM_BOX.h };
}

/**
 * The colour card the referee holds (L4): upright, its face CARD.gapToClaw mm beyond the tips of the
 * claw (or the front of the chassis, for a robot without a gripper), in the middle in front of the
 * robot, from the mat up, where the colour sensor at the claw can read it.
 */
export function cardProp(team: TeamColor, config = LOCKER_ROOM_ROBOT): RefereeProp {
  const g = config.gripper;
  const tip = g.enabled ? Math.max(config.chassisFront, g.gripForward + g.fingerLength / 2) : config.chassisFront;
  return {
    id: PROP_CARD,
    label: WORD[team],
    fill: CUBE_FILL[team],
    frame: 'robot',
    x: tip + CARD.gapToClaw + CARD.thickness / 2,
    y: 0,
    angle: 0,
    w: CARD.w,
    l: CARD.thickness,
    z: 0,
    h: CARD.h,
    colorName: team,
  };
}

/** The first delivery of a team cube into a big circle (Step 5, L5). */
export interface Delivery {
  cube: TeamColor;
  circle: TeamColor;
  time: number;
  correct: boolean;
}

function createReferee(scenario: LockerRoomScenario): Referee<LockerRoomScenario> {
  const team = scenario.team;
  /** Step 1: when the whole robot was first outside the Locker Room with the box */
  let leftAt: number | null = null;
  /** Step 2: when the whole robot was first inside the Scan Station with the box */
  let reachedAt: number | null = null;
  /** the Team Box is on the robot */
  let boxOn = true;
  /** Step 3: when the referee lifted the box */
  let liftedAt: number | null = null;
  /** since when the robot is at rest completely inside the Scan Station with the box (null: it is not) */
  let restSince: number | null = null;
  /** the referee holds the card in front of the robot */
  let cardOut = false;
  /** the card was shown during this rest */
  let shownThisRest = false;
  /** when the card was shown last: in the rest that led to the lift, the card of that rest (for the sheet) */
  let cardShownAt: number | null = null;
  /** Step 5: the first delivery */
  let delivery: Delivery | null = null;
  /** Step 6: the gate is open (with a correct delivery) */
  let gateOpenAt: number | null = null;
  /** the robot touched the closed gate (L7: counts once) */
  let gateTouchedAt: number | null = null;
  /** the match is over: from now on the sheet is final */
  let over = false;
  /** the whole robot was inside the Locker Room at the start signal (`begun`: the signal was given) */
  let startedInside = true;
  let begun = false;
  /** the card prop for this robot (made the first time the card is shown) */
  let card: RefereeProp | null = null;
  /** what the referee holds or has put on the robot (the same list while nothing changes) */
  let props: readonly RefereeProp[] = [teamBoxProp()];
  /** the referee says something on this tick, and opens the gate (almost always: null) */
  let call: RefereeCall | null = null;
  const speak = (text: string): void => {
    if (call === null) call = {};
    (call.say ??= []).push(text);
  };

  const bodyOf = (ctx: ScoreContext<LockerRoomScenario>, id: string): Body | null => {
    for (const body of ctx.world.bodies) if (body.id === id) return body;
    return null;
  };

  const showProps = (config: ScoreContext<LockerRoomScenario>['robotConfig']): void => {
    const list: RefereeProp[] = [];
    if (boxOn) list.push(props.find((p) => p.id === PROP_TEAM_BOX) ?? teamBoxProp(config.chassisHeight));
    if (cardOut) list.push((card ??= cardProp(team, config)));
    props = list;
  };

  function begin(ctx: ScoreContext<LockerRoomScenario>): void {
    begun = true;
    startedInside = ctx.robotShapes.every((shape) => rectContainsOBB(LOCKER_ROOM, shape));
  }

  /** Steps 2 and 3: the Scan Station, the card and the box. */
  function watchScanStation(ctx: ScoreContext<LockerRoomScenario>, time: number): void {
    if (!boxOn) return;
    // (the whole robot can be inside the Scan Station only when the middle of its axle is: most
    // of the match there is no need to look at its shapes)
    const inside = pointInRect(ctx.world.robot.pose, SCAN_STATION) && isInsideScanStation(ctx.robotShapes);
    if (inside && reachedAt === null) {
      reachedAt = time;
      speak(`+${POINTS_SCAN_STATION} points at ${clock(time)}: the robot reached the Scan Station with the Team Box.`);
    }
    const resting = inside && atRest(ctx);
    if (!resting) {
      if (restSince !== null) {
        restSince = null;
        if (cardOut) {
          cardOut = false;
          showProps(ctx.robotConfig);
          speak(`${clock(time)}: the robot moved, so the referee takes the card away. The Team Box stays on. Stop again in the Scan Station.`);
        } else if (shownThisRest) {
          speak(`${clock(time)}: the robot moved before the referee could lift the Team Box. Stop again in the Scan Station.`);
        }
        shownThisRest = false;
      }
      return;
    }
    if (restSince === null) restSince = time;
    const waited = time - restSince + TIME_EPS;
    if (!cardOut && waited >= CARD_SHOW_S && waited < CARD_AWAY_S) {
      cardOut = true;
      shownThisRest = true;
      // (the card of THIS rest: a rest that ends with the lift always shows the card first)
      cardShownAt = time;
      showProps(ctx.robotConfig);
      speak(`${clock(time)}: the referee shows the ${WORD[team]} card in front of the robot.`);
    } else if (cardOut && waited >= CARD_AWAY_S) {
      cardOut = false;
      showProps(ctx.robotConfig);
      speak(`${clock(time)}: the referee takes the card away.`);
    }
    if (waited >= BOX_LIFT_S) {
      boxOn = false;
      liftedAt = time;
      restSince = null;
      cardOut = false;
      shownThisRest = false;
      showProps(ctx.robotConfig);
      speak(`+${POINTS_APPROVAL} points at ${clock(time)}: the referee lifted the Team Box. The coach approves the team.`);
    }
  }

  /**
   * Steps 5 and 6: the first delivery of a team cube into a big circle (L5). The cube of the team
   * colour is looked at first: should both team cubes be delivered on the same tick (a robot with
   * one gripper hardly can), the one that can be correct counts.
   */
  const teamFirst: readonly TeamColor[] = [team, ...TEAM_COLORS.filter((color) => color !== team)];
  function watchTeamCubes(ctx: ScoreContext<LockerRoomScenario>, time: number): void {
    if (delivery !== null) return;
    const holding = ctx.world.robot.gripper.holding;
    for (const color of teamFirst) {
      const cube = bodyOf(ctx, teamCubeId(color));
      if (!cube || !standsOnMat(cube, holding)) continue;
      const circle = bigCircleAround(footprint(cube));
      if (circle === null || touchesRobot(cube, ctx)) continue;
      const correct = color === team && circle === team;
      delivery = { cube: color, circle, time, correct };
      if (correct) {
        gateOpenAt = time;
        speak(`+${POINTS_DELIVERY} points at ${clock(time)}: ${teamCubeName(color)} is in ${circleName(circle)}.`);
        speak(`+${POINTS_GATE} points: the stadium gate opens.`);
        (call ??= {}).removeWalls = [GATE_ID];
      } else {
        const why = color === team ? `the ${WORD[team]} cube belongs in ${circleName(team)}` : `the team colour is ${WORD[team]}`;
        speak(`-${WRONG_DELIVERY_PENALTY} points at ${clock(time)}: ${teamCubeName(color)} is in ${circleName(circle)} - wrong (${why}). The gate stays closed.`);
      }
      return;
    }
  }

  function observe(ctx: ScoreContext<LockerRoomScenario>): RefereeCall | null {
    const time = ctx.world.time;
    call = null;

    // ---- Step 1: the first moment the whole robot is outside the Locker Room, with the box
    if (leftAt === null && boxOn && isOutsideLockerRoom(ctx.robotShapes)) {
      leftAt = time;
      speak(`+${POINTS_LEAVE} points at ${clock(time)}: the robot left the Locker Room with the Team Box.`);
    }

    // ---- Steps 2, 3: the Scan Station (only while the box is on)
    watchScanStation(ctx, time);

    // ---- Steps 5, 6
    watchTeamCubes(ctx, time);

    // ---- the closed gate (L7: once)
    if (gateOpenAt === null && gateTouchedAt === null) {
      // (the robot is far from the gate almost always: no need to look at its shapes then)
      const pose = ctx.world.robot.pose;
      if (Math.hypot(pose.x - GATE_WALL.x, pose.y - GATE_WALL.y) < 300 && touchesGate(ctx)) {
        gateTouchedAt = time;
        speak(`-${GATE_TOUCH_PENALTY} points at ${clock(time)}: the robot touched the stadium gate.`);
      }
    }
    return call;
  }

  /** There are no restarts in this game (Game.restartRules: none allowed): nothing to forget. */
  function restart(): void {
    // (the engine never calls this: restartRules.maxRestarts is 0)
  }

  function finished(): void {
    over = true;
    // the referee says STOP and takes the card away: the stage must not show it after the end
    if (cardOut) {
      cardOut = false;
      props = props.filter((prop) => prop.id !== PROP_CARD);
    }
  }

  function score(ctx: ScoreContext<LockerRoomScenario>): ScoreReport {
    const lines: ScoreLine[] = [];

    // ---- Step 1
    lines.push({
      id: LINE_LEAVE,
      label: 'Step 1: leave the Locker Room',
      points: leftAt !== null ? POINTS_LEAVE : 0,
      max: POINTS_LEAVE,
      ok: leftAt !== null,
      detail:
        leftAt !== null
          ? `done at ${clock(leftAt)}`
          : over
            ? 'the whole robot never got out of the Locker Room with the Team Box'
            : 'not yet - drive the whole robot out of the Locker Room',
      ...(leftAt !== null ? { time: leftAt } : {}),
    });

    // ---- Step 2
    lines.push({
      id: LINE_SCAN_STATION,
      label: 'Step 2: reach the Scan Station',
      points: reachedAt !== null ? POINTS_SCAN_STATION : 0,
      max: POINTS_SCAN_STATION,
      ok: reachedAt !== null,
      detail:
        reachedAt !== null
          ? `done at ${clock(reachedAt)}`
          : over
            ? 'the whole robot never got inside the Scan Station with the Team Box'
            : 'not yet - drive the whole robot into the Scan Station',
      ...(reachedAt !== null ? { time: reachedAt } : {}),
    });

    // ---- Step 3: what the referee is doing at the Scan Station right now (the screen shows this line live)
    let approval: string;
    if (liftedAt !== null) approval = `the referee showed the ${WORD[team]} card at ${clock(cardShownAt ?? liftedAt)} and lifted the Team Box at ${clock(liftedAt)}`;
    // (a robot still at rest in the station when the match ended was waiting: the match, by time or
    // because the program ended, was over before the lift - whether the card was out or not)
    else if (restSince !== null && over) approval = 'the robot stopped in the Scan Station, but the match ended before the referee lifted the Team Box';
    else if (cardOut) approval = `the referee holds up the ${WORD[team]} card - wait until the Team Box is lifted (${BOX_LIFT_S} s after the robot stopped)`;
    else if (restSince !== null && shownThisRest) approval = `the referee took the card away - wait: the Team Box is lifted ${BOX_LIFT_S} s after the robot stopped`;
    else if (restSince !== null) approval = `stopped - the referee shows the card after ${CARD_SHOW_S} s and lifts the Team Box after ${BOX_LIFT_S} s`;
    else if (over) approval = `the robot did not stop in the Scan Station for ${BOX_LIFT_S} s with the Team Box`;
    else approval = `not yet - stop in the Scan Station and wait ${BOX_LIFT_S} s`;
    lines.push({
      id: LINE_APPROVAL,
      label: 'Step 3: coach approval',
      points: liftedAt !== null ? POINTS_APPROVAL : 0,
      max: POINTS_APPROVAL,
      ok: liftedAt !== null,
      detail: approval,
      ...(liftedAt !== null ? { time: liftedAt } : {}),
    });

    // ---- Steps 5 and 6
    const d = delivery as Delivery | null;
    lines.push({
      id: LINE_DELIVERY,
      label: `Step 5: deliver the ${WORD[team]} cube`,
      points: d === null ? 0 : d.correct ? POINTS_DELIVERY : -WRONG_DELIVERY_PENALTY,
      max: POINTS_DELIVERY,
      ok: d !== null && d.correct,
      detail:
        d === null
          ? over
            ? 'no team cube was delivered into a big circle'
            : `not yet - put the ${WORD[team]} cube completely into ${circleName(team)}`
          : d.correct
            ? `done at ${clock(d.time)}`
            : `${teamCubeName(d.cube)} went into ${circleName(d.circle)} at ${clock(d.time)}: wrong, -${WRONG_DELIVERY_PENALTY}`,
      ...(d !== null && d.correct ? { time: d.time } : {}),
    });
    lines.push({
      id: LINE_GATE,
      label: 'Step 6: stadium gate bonus',
      points: gateOpenAt !== null ? POINTS_GATE : 0,
      max: POINTS_GATE,
      ok: gateOpenAt !== null,
      detail: gateOpenAt !== null ? `the gate opened at ${clock(gateOpenAt)}` : d !== null ? 'the first delivery was wrong: the gate stays closed' : 'the gate opens with a correct Step 5',
      ...(gateOpenAt !== null ? { time: gateOpenAt } : {}),
    });
    lines.push({
      id: LINE_GATE_TOUCH,
      label: 'Touching the gate',
      points: gateTouchedAt !== null ? -GATE_TOUCH_PENALTY : 0,
      max: 0,
      ok: gateTouchedAt === null,
      detail: gateTouchedAt !== null ? `the robot touched the closed gate at ${clock(gateTouchedAt)}, -${GATE_TOUCH_PENALTY}` : 'not touched',
      ...(gateTouchedAt !== null ? { time: gateTouchedAt } : {}),
    });

    // ---- Step 7, judged as the tokens lie now
    const zoneOf = new Map<TokenColor, ZoneId>();
    const tokens = tokensOf(scenario);
    for (const zone of ZONE_IDS) zoneOf.set(tokens[zone], zone);
    for (const color of TOKEN_COLORS) {
      const zone = zoneOf.get(color) as ZoneId;
      const token = bodyOf(ctx, tokenId(zone));
      const j: TokenJudgement = token ? judgeToken(token, ctx) : { result: 'none', target: null, why: 'no-target' };
      let points = 0;
      let detail: string;
      switch (j.result) {
        case 'full':
          points = POINTS_TOKEN;
          detail = `completely inside ${targetOf(color).name}`;
          break;
        case 'part':
          points = POINTS_TOKEN_PARTLY;
          detail = cubeFitsInside(targetOf(color))
            ? `only partly inside ${targetOf(color).name}: half points`
            : `partly inside ${targetOf(color).name}: ${POINTS_TOKEN_PARTLY} points, the most here (a cube is bigger than this target)`;
          break;
        case 'wrong':
          points = -WRONG_TOKEN_PENALTY;
          detail = `in ${targetOf(j.target as TokenColor).name} - wrong target, -${WRONG_TOKEN_PENALTY}`;
          break;
        default:
          if (!token) detail = 'this token is not on the field';
          else if (j.why === 'held') detail = `the robot ${over ? 'still held' : 'is holding'} it - put it down in ${targetOf(color).name}`;
          else if (j.why === 'lifted') detail = `not standing on the mat - put it down in ${targetOf(color).name}`;
          else if (j.why === 'touching') detail = `touching the robot${over ? '' : ' - move away'}`;
          else detail = over ? 'not in a target' : `not yet - put it in ${targetOf(color).name}`;
      }
      lines.push({
        id: tokenLineId(color),
        label: `Step 7: ${tokenName(color)} (zone ${zone})`,
        points,
        max: POINTS_TOKEN,
        // (done: completely inside - or, on a target too small for a whole cube (L1), partly
        // inside, the most a robot can do there; it follows MARK_ROLES)
        ok: j.result === 'full' || (j.result === 'part' && !cubeFitsInside(targetOf(color))),
        detail,
      });
    }

    // ---- the start position (only a start pose handed to the simulation can be outside)
    const inside = begun || ctx.world.tick > 0 ? startedInside : ctx.robotShapes.every((shape) => rectContainsOBB(LOCKER_ROOM, shape));
    if (!inside) {
      lines.push({
        id: LINE_START_POSITION,
        label: 'Start inside the Locker Room',
        points: 0,
        max: 0,
        ok: false,
        detail: 'the robot did not start completely inside the Locker Room - a referee would not start this match',
      });
    }

    const sum = lines.reduce((total, line) => total + line.points, 0);
    // every goal: each line with points earned in full, and the gate never touched
    const complete = lines.every((line) => line.ok || (line.max === 0 && line.id !== LINE_GATE_TOUCH));
    // while the robot waits at the Scan Station, the status line says why nothing moves
    let now: string | undefined;
    if (!over && liftedAt === null && restSince !== null) {
      if (cardOut) now = `The referee shows the ${WORD[team]} card in front of the robot.`;
      else if (shownThisRest) now = 'The referee took the card away. Next the referee lifts the Team Box.';
      else now = 'The robot stopped in the Scan Station. The referee comes with the card.';
    }
    return { total: Math.max(0, sum), max: MAX_SCORE, lines, complete, ...(now ? { now } : {}) };
  }

  return {
    begin,
    observe,
    restart,
    finished,
    score,
    props: () => props,
  };
}

// =============================================================================================
// The game
// =============================================================================================

export const lockerRoomGame: Game<LockerRoomScenario> = {
  id: 'locker-room',
  // (not "Capelli Starter": the simulator files a browser gets must not hold the name of a level
  // of the examples - "Starter" is one - see members/client-guard.test.ts)
  title: 'MakeX Lebanon 2026 - Capelli: Locker Room',
  mat: {
    width: MAT_SIZE,
    height: MAT_SIZE,
    imageUrl: MAT_IMAGE_URL,
    sensorImageUrl: MAT_SENSOR_IMAGE_URL,
    vector: MAT_VECTOR,
  },
  matchDuration: MATCH_DURATION,
  startZone: LOCKER_ROOM,
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
  // (during a match the referee below keeps the score; this is the sheet of a match in which
  // nothing has happened yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: LOCKER_ROOM_ROBOT,
  createWalls,
  createReferee,
  // RULE: no restarts - "anyone touching the robot after GO voids the run"
  restartRules: { maxRestarts: 0 },
  scenarioProblems,
};
