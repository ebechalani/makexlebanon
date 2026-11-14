/**
 * MakeX Lebanon 2027 - Fire Chief (Dynamic Maze Challenge): the game definition and its referee.
 *
 * This file answers these questions for the rest of the simulator:
 *   1. What is on the field at the start of an attempt?        -> createBodies(), createWalls()
 *   2. Which areas should be highlighted on the mat?           -> overlays()
 *   3. What has the robot earned so far, when, and why (not)?  -> createReferee()
 *
 * The referee follows the draft rules (§6 - §11; timing, scoring, restart and the fan action
 * are "proposed" there and built here as written):
 *
 *   10 points  the robot has completely left START
 *   20 points  the robot is completely inside the living room or the bedroom (only once)
 *   30 points  the robot stands still, faces the fire target and starts a directed fan action
 *   40 points  that fan action lasts 3 seconds without a break
 *
 * Each of the four is earned once, and the referee writes down the time (the ranking uses it).
 * The attempt ends when the 3-second fan action is complete, after 180 seconds, when the team
 * says "Finished", or at once when the robot pushes the fire target out of its place.
 * One restart is allowed: it clears the points, the clock keeps running.
 *
 * Unlike Fire Rescue, these points cannot be read from the field at the end: they depend on what
 * happened and when. So this referee has a memory and is told about every tick (core/types.ts:
 * Referee).
 *
 * Plain TypeScript only (no DOM, no React), so it also runs headless under Node.
 *
 * =====================================================================================
 *  DECISIONS OF THE ORGANISER - what the organiser has answered since the draft rules
 * =====================================================================================
 * These are rules now, not assumptions: the screen and the texts for students say them as
 * rules. Behind every line: the constant (or the function) that holds it.
 *
 *   D1. Touching or hitting the fire target without moving it costs nothing. Only a target
 *       that is moved ends the attempt. (The draft's own condition stays: no fan action
 *       counts while the robot touches the target, §7. How far "moved" is: assumption 9.)
 *                                                                     observe(), checkFan()
 *   D2. A fan action from outside the room is valid when the fan is within 30 cm of the
 *       target. It gives the 30 and the 40 points; a team that never drove completely into a
 *       room then ends "mission complete" with 80 points, without the 20 points for a room.
 *                                              FAN.reachMm in ./robot.ts, observe(), score()
 *   D3. The 30 points need only the position: standing still, facing the target, fan on,
 *       within 30 cm, no wall between. What the colour sensor reads does not matter to the
 *       referee: no reading of any sensor counts for a point.                    checkFan()
 *   D4. The fire target is 60 mm wide and 120 mm high.           TARGET_WIDTH, TARGET_HEIGHT
 *   D5. The outer edge of the field is walled.                                   OUTER_WALLS
 *   (Decided earlier, with the map: the walls are 3 mm thick.                WALL_THICKNESS)
 *   (Decided after the draft, which names a flame sensor and an infrared emitter in the
 *   target - §1, §4, §5: the robot finds the fire with a COLOUR SENSOR that looks forward, and
 *   the fire target is RED. The game has no flame sensor and the target no emitter. What the
 *   organiser has not said about the colour sensor and the red target is assumed: 4 to 7
 *   below.)
 *
 * =====================================================================================
 *  ASSUMPTIONS - the one list of everything neither the draft rules nor the organiser say
 * =====================================================================================
 * The organiser has to confirm each of them. Behind every line: the constant (or the function)
 * that holds it, so that a changed answer is changed in one place. An answer of the organiser
 * moves its line up into the list of decisions - and the sentence about it in the rules window
 * (../ui/fire-chief/rules.ts) from "What this simulator assumes" into the rules.
 *
 * A. The field (./field.ts)
 *   1. A wall panel is one cell + one thickness long, so that panels close the corners
 *      without a gap.                                                            WALL_LENGTH
 *   2. The target is 20 mm deep and light enough to be pushed.     TARGET_DEPTH, TARGET_MASS
 *   3. Three spots per room, against the outer walls, facing into the room.
 *                                                                 FIRE_SPOTS, targetPose()
 *   4. The target is red on every face: the colour sensor reads "red" from whichever side
 *      the robot comes.                                                         TARGET_COLOR
 *   5. What the colour sensor reads on a wooden wall: never "red". The simulator names the
 *      wood colour with its own colour naming (the one of the Quad RGB sensor), which calls
 *      light wood "yellow". Inner and outer walls read the same.  WALL_COLOR_NAME, WALL_WOOD
 *
 * B. The robot (./robot.ts)
 *   6. Which colour sensor it is, and where it sits: one sensor, fixed to the middle of the
 *      front face of the chassis, 60 mm above the mat (half the height of the target), looking
 *      straight ahead along one line. It names the nearest thing on that line and is never
 *      wrong (no noise). The texts of its two blocks in mBlock are not confirmed either
 *      (blocks/mblock-wording.ts).                                             COLOR_SENSOR
 *   7. How close it must be: 15 mm or less from the face of the sensor to the thing it looks
 *      at. Makeblock gives a detection range of 5 to 15 mm for its RGB colour sensors; the
 *      simulator takes the far end and no more, because a stricter simulator is the safe side
 *      (a program that works at 15 mm also works with a sensor that sees further). The near
 *      end is not modelled: it also reads a thing it touches.          COLOR_SENSOR_RANGE_MM
 *      (What follows from 3, 7 and the 130 mm wide chassis together: a robot that drives
 *      straight at a target in a corner is stopped by the two walls of that corner when its
 *      nose is exactly 15 mm from the target. So that target is read only by a robot that
 *      touches both walls or nearly does: in every pose that reads "red" there, both walls
 *      are 2.5 mm away or nearer.)
 *   8. The fan: on port M1, blowing from 20 % power, 20 degrees to each side. (How far it
 *      reaches, 300 mm, is decision D2.)                                                FAN
 *
 * C. The referee (this file)
 *   9. "Displaced" (§11) = one corner of the target is more than 5 mm from where it stood.
 *                                                                       TARGET_DISPLACED_MM
 *  10. The target cannot fall over in the simulator ("must not knock over", §7, is not
 *      modelled). A robot that hits it squarely, where it stands flat against its wall, does
 *      not move it at all. The referee says a sentence when the robot touches the target.
 *  11. "Touching" (§7) = closer than half a millimetre. (Measured with the target made that
 *      much larger on every side: at a corner of the target it is up to 0.7 mm.)       TOUCH_MM
 *  12. "Stationary" (§7) = both wheel speeds are 0 and the robot is exactly where it was one
 *      tick (1/100 s) before. Wheels that spin against a wall are not stationary.   observe()
 *  13. "Directed towards the wooden flame" (§7) = the straight-ahead line of the fan hits the
 *      target, or the middle of the target is at most 20 degrees away from that line. The
 *      30 cm of D2 are measured from the fan to the middle of the target. "No wall between" =
 *      no wall on the straight line from the fan to the middle of the target.
 *                                                                  lookAtFan(), checkFan()
 *  14. A fan action begins at the beginning of the first tick in which everything was right;
 *      that moment is the time written on the 30 points.                           observe()
 *  15. What is earned on the tick that ends at exactly 180.00 s still counts, and "mission
 *      complete" on that tick wins over "time".              tick() in core/engine.ts
 *  16. ScoreReport.complete is true only with all four achievements (100 points). An attempt
 *      can end with the reason 'mission-complete' and complete = false (see D2).      score()
 *  17. Restart (§10): the robot is put back exactly where and how it started; a nudged target
 *      is put back.                                                   fireChiefGame.restartRules
 *  18. A fifth end that §8 does not name: the program has ended, the robot stands still and no
 *      DC motor runs ('program-ended'). It is the simulator's way to say "nothing more will
 *      happen". A program that ends with a DC motor left on runs to 180 s. After this end, as
 *      after every end, no restart is possible.                              core/engine.ts
 *  19. The start (§6.1, §8): the screen puts the robot only where the whole robot is inside
 *      START (Simulation.setStartPose refuses everything else). A start pose handed over in
 *      SimulationOptions is NOT held to START - tests use it to begin next to the target. The
 *      referee notes it at the start signal and writes it on the sheet (line 'start-position').
 *      (A robot that such a pose puts into a wall, or on top of the target, is moved out of the
 *      wall and off the target at the start signal and after a restart, with a sentence in the
 *      log; the target stays where it is: core/engine.ts.)
 *
 * D. The engine (core/engine.ts)
 *  20. Walls cannot be moved, are perfectly smooth and never stop a turn: a robot that touches
 *      one while it drives or turns slides along it. "Minor accidental contact with a wall"
 *      (§11) is therefore any contact, for any time; "must not deliberately push walls" is not
 *      judged.
 *
 * E. Rule sentences that are NOT implemented
 *      §1, §4, §5 "use a flame sensor", "detect the infrared signal rather than relying only on
 *                the target's colour or shape": overruled by the organiser's later decision
 *                for a colour sensor and a red target. No sensor is checked at all (D3).
 *      §3        "must not depend solely on a memorised sequence of movements": the referee does
 *                not judge how a program finds its way.
 *      §4, §6.2  "operate autonomously, no remote control": the CyberPi buttons work during an
 *                attempt, so a program that reads them can be steered by hand.
 *      §6.6      "stop to indicate mission completion": at "mission complete" the simulator
 *                stops the robot and its fan itself.
 *      §8        "the referee checks the robot's dimensions and sensor heights": the robot of
 *                this game is fixed (./robot.ts) and inside the limits.
 *      §8        "the referee stops the attempt because of a rule violation": only for the
 *                displaced target.
 *      §10       "touching the robot without authorisation ends the attempt": there is no hand
 *                in the simulator.
 *      §12       "two scored attempts, the best one counts": the simulator plays one attempt at
 *                a time; it records the score and the time of each achievement (ScoreLine.time,
 *                ScoreReport.time), which is what the ranking needs.
 */
import { boxesOverlap, makeContact, rayBoxDistance } from '../core/engine-collide';
import {
  localToWorld,
  obbCorners,
  obbTouches,
  obbTouchesRect,
  pointInRect,
  rectContainsOBB,
  type OBB,
} from '../core/geometry';
import { widestClawGap } from '../core/robot';
import type {
  Body,
  FixedWall,
  Game,
  Referee,
  RefereeCall,
  RobotConfig,
  ScoreContext,
  ScoreLine,
  ScoreReport,
  World,
  ZoneOverlay,
} from '../core/types';
import { wallBetween } from '../core/walls';
import {
  FIELD_SIZE,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_VECTOR,
  ROOMS,
  ROOM_IDS,
  START_RECT,
  TARGET_COLOR,
  TARGET_DEPTH,
  TARGET_HEIGHT,
  TARGET_MASS,
  TARGET_WIDTH,
  WALL_POSITIONS,
  innerWall,
  outerWalls,
  roomRect,
  targetPose,
  type RoomId,
} from './field';
import { FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import {
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  encodeScenario,
  randomScenario,
  scenarioProblems,
  type FireChiefScenario,
} from './scenario';

// =============================================================================================
// Points and limits (rules §7 - §11)
// =============================================================================================

export const POINTS_LEAVE_START = 10;
export const POINTS_ENTER_ROOM = 20;
export const POINTS_FAN_START = 30;
export const POINTS_FAN_COMPLETE = 40;
export const MAX_SCORE = POINTS_LEAVE_START + POINTS_ENTER_ROOM + POINTS_FAN_START + POINTS_FAN_COMPLETE;

/** An attempt lasts at most 3 minutes. */
export const MATCH_DURATION = 180;
/** The fan must blow at the fire for this long without a break (seconds). */
export const FAN_ACTION_SECONDS = 3;
/** One restart per attempt. */
export const MAX_RESTARTS = 1;
/**
 * The attempt ends when the robot "displaces" the target. A touch that moves it by a millimetre
 * is not that: it counts as displaced when one of its corners is more than this (mm) away from
 * where it stood. ASSUMPTION - the rules only say "displaces", and the organiser's decision D1
 * ("only a target that is moved ends the attempt") gives no number either.
 */
export const TARGET_DISPLACED_MM = 5;
/**
 * ASSUMPTION: the robot "touches" the target when the two are closer than this (mm). (The test
 * makes the target this much larger on every side - obbTouches() in core/geometry.ts - so at a
 * corner of the target "closer than" reaches up to 0.7 mm.)
 */
export const TOUCH_MM = 0.5;
/** The referee says "the robot touches the target" once per touch; touches less than this (seconds) apart are one touch. */
const TOUCH_QUIET_SECONDS = 0.5;

// =============================================================================================
// The field at the start of an attempt
// =============================================================================================

export const KIND_FIRE_TARGET = 'fire-target';
export const TARGET_BODY_ID = 'target:fire';

/**
 * The target is drawn in the colour the colour sensor reads on it: a clear red, easy to tell
 * from the wood of the walls and from the blue robot. (A test holds that the simulator's own
 * colour naming calls this colour by the name the sensor reads: TARGET_COLOR.)
 */
export const TARGET_FILL = '#dc2626';
const START_ZONE_CSS = '#dc2626';
const ROOM_CSS = '#2563eb';
const FIRE_ROOM_CSS = '#f97316';

/** Footprint of a body on the mat, seen from above. */
export function footprint(body: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle'>): OBB {
  return { x: body.x, y: body.y, w: body.w, l: body.l, angle: body.angle };
}

/** The one game element: the red wooden flame, standing against the outer wall of its room. */
function createBodies(s: FireChiefScenario): Body[] {
  const at = targetPose(s.fireRoom, s.fireSpot);
  return [
    {
      id: TARGET_BODY_ID,
      kind: KIND_FIRE_TARGET,
      // (no letter: on a 20 mm board it could not be read; the stage draws a flame sign around it)
      label: '',
      fill: TARGET_FILL,
      // what the robot's colour sensor reads on it, from every side
      colorName: TARGET_COLOR,
      x: at.x,
      y: at.y,
      angle: at.angle,
      w: TARGET_WIDTH,
      l: TARGET_DEPTH,
      h: TARGET_HEIGHT,
      z: 0,
      restingOn: null,
      held: false,
      grippable: false,
      platform: false,
      mass: TARGET_MASS,
      home: { x: at.x, y: at.y, angle: at.angle, z: 0, restingOn: null },
    },
  ];
}

/** The walls of a combination: the four around the field, then the inner walls that stand. */
function createWalls(s: FireChiefScenario): FixedWall[] {
  const walls = outerWalls();
  for (const position of WALL_POSITIONS) {
    if (s.walls[position.index] === true) walls.push(innerWall(position));
  }
  return walls;
}

function overlays(s: FireChiefScenario): ZoneOverlay[] {
  const out: ZoneOverlay[] = [{ id: 'start', label: 'START', rect: START_RECT, color: START_ZONE_CSS, kind: 'start' }];
  for (const id of ROOM_IDS) {
    const fire = s.fireRoom === id;
    const name = id === 'living' ? 'Living room' : 'Bedroom';
    out.push({
      id: `room:${id}`,
      label: fire ? `${name} (fire)` : name,
      rect: roomRect(id),
      color: fire ? FIRE_ROOM_CSS : ROOM_CSS,
      kind: 'info',
    });
  }
  return out;
}

/** The fire target of a world (null if a test took it away). */
export function targetOf(world: World): Body | null {
  for (const body of world.bodies) if (body.id === TARGET_BODY_ID) return body;
  return null;
}

// =============================================================================================
// What the referee looks at
// =============================================================================================

/** True when no part of the robot is over the START cell any more. */
export function hasLeftStart(robotShapes: readonly OBB[]): boolean {
  return robotShapes.every((shape) => !obbTouchesRect(shape, START_RECT));
}

/** The room the whole robot is inside of, or null. */
export function roomAround(robotShapes: readonly OBB[]): RoomId | null {
  return ROOM_IDS.find((id) => robotShapes.every((shape) => rectContainsOBB(roomRect(id), shape))) ?? null;
}

/** How far (mm) the target is from where it stood: the largest distance of one of its corners. */
export function targetShift(target: Body): number {
  // (almost always it has not moved at all: no need to work out its corners then)
  if (target.x === target.home.x && target.y === target.home.y && target.angle === target.home.angle) return 0;
  const now = obbCorners(footprint(target));
  const home = obbCorners({ x: target.home.x, y: target.home.y, w: target.w, l: target.l, angle: target.home.angle });
  let far = 0;
  for (let i = 0; i < 4; i++) far = Math.max(far, Math.hypot(now[i].x - home[i].x, now[i].y - home[i].y));
  return far;
}

/** Everything that decides whether the fan is blowing at the fire right now. */
export interface FanView {
  /** the fan is blowing */
  fanOn: boolean;
  /** mm from the fan to the middle of the target */
  distance: number;
  /** degrees between "straight ahead" of the fan and the direction of the middle of the target */
  offDeg: number;
  /** the straight-ahead line of the fan hits the target (some part of it, not only its middle) */
  pointsAt: boolean;
  /** the wall that stands between the fan and the middle of the target, if any */
  wall: FixedWall | null;
  /** the robot touches the target */
  touching: boolean;
}

export function lookAtFan(ctx: ScoreContext<FireChiefScenario>): FanView | null {
  const target = targetOf(ctx.world);
  const fan = ctx.robotConfig.fan;
  if (!target || !fan || !fan.enabled) return null;
  const pose = ctx.world.robot.pose;
  const from = localToWorld(pose, fan.forward, 0);
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  // the direction of the target in the robot's frame: `ahead` mm in front of the fan, `aside` mm beside it
  const sin = Math.sin(pose.heading);
  const cos = Math.cos(pose.heading);
  const ahead = dx * sin - dy * cos;
  const aside = dx * cos + dy * sin;
  const targetShape = footprint(target);
  return {
    fanOn: ctx.world.robot.fanOn === true,
    distance: Math.hypot(dx, dy),
    offDeg: (Math.abs(Math.atan2(aside, ahead)) * 180) / Math.PI,
    // (a ray from the fan straight ahead against the footprint of the target; -1 = it misses)
    pointsAt:
      rayBoxDistance(from.x, from.y, sin, -cos, target.x, target.y, target.w / 2, target.l / 2, Math.sin(target.angle), Math.cos(target.angle)) >= 0,
    wall: wallBetween(ctx.world.walls, from, { x: target.x, y: target.y }),
    touching: ctx.robotShapes.some((shape) => obbTouches(targetShape, shape, TOUCH_MM)),
  };
}

/** The reasons why a fan action does not count. */
type FanIssueKind = 'no-fan' | 'off' | 'moving' | 'no-target' | 'touching' | 'wall' | 'far' | 'aim';

/** One reason, with the measure that is over its limit ('far': mm, 'aim': degrees). */
interface FanIssue {
  kind: FanIssueKind;
  value: number;
  limit: number;
}

/**
 * A measure that is over its limit, written so that it never reads like the limit itself:
 * 301.2 -> "301", but 300.3 -> "300.3" (not "300 mm, at most 300 mm").
 */
function overLimit(value: number, limit: number): string {
  const whole = Math.round(value);
  if (whole > limit) return String(whole);
  return (Math.ceil(value * 10 - 1e-9) / 10).toFixed(1);
}

/**
 * A reason in student words. `past` = for the sheet of an attempt that is over ("the fan was
 * off" instead of "the fan is off").
 */
function issueText(issue: FanIssue, past = false): string {
  switch (issue.kind) {
    case 'no-fan':
      return 'this robot has no fan';
    case 'off':
      return past ? 'the fan was off' : 'the fan is off';
    case 'moving':
      return past ? 'the robot was moving - it must stand still' : 'the robot is moving - it must stand still';
    case 'no-target':
      return past ? 'there was no fire target on the field' : 'there is no fire target on the field';
    case 'touching':
      return past ? 'the robot touched the fire target' : 'the robot touches the fire target - move back a little';
    case 'wall':
      return past ? 'there was a wall between the fan and the fire' : 'there is a wall between the fan and the fire';
    case 'far':
      return `the fire ${past ? 'was' : 'is'} too far from the fan (${overLimit(issue.value, issue.limit)} mm, at most ${issue.limit} mm)`;
    case 'aim':
      return `the fan ${past ? 'did not point' : 'does not point'} at the fire (${overLimit(issue.value, issue.limit)} degrees off, at most ${issue.limit})`;
  }
}

/**
 * Does the fan action count right now? It does when the robot stands still, the fan is on, the
 * fan is directed at the target (its straight-ahead line hits the target, or the middle of the
 * target is inside its cone), the target is in reach, no wall is between them and the robot
 * does not touch the target. Otherwise the reason is written into `issue`.
 * (The referee asks on every tick: nothing is built here unless the fan is on and the robot stands.)
 */
function checkFan(ctx: ScoreContext<FireChiefScenario>, still: boolean, issue: FanIssue): boolean {
  const fan = ctx.robotConfig.fan;
  issue.value = 0;
  issue.limit = 0;
  if (!fan || !fan.enabled) {
    issue.kind = 'no-fan';
    return false;
  }
  // (the two quick questions first: mostly the fan is off)
  if (ctx.world.robot.fanOn !== true) {
    issue.kind = 'off';
    return false;
  }
  if (!still) {
    issue.kind = 'moving';
    return false;
  }
  const view = lookAtFan(ctx);
  if (!view) {
    issue.kind = 'no-target';
    return false;
  }
  if (view.touching) {
    issue.kind = 'touching';
    return false;
  }
  if (view.wall) {
    issue.kind = 'wall';
    return false;
  }
  if (view.distance > fan.reachMm) {
    issue.kind = 'far';
    issue.value = view.distance;
    issue.limit = fan.reachMm;
    return false;
  }
  // A robot that stands squarely in front of any part of the target points at it, however
  // close it is: the middle of a 60 mm wide target is easily more than 20 degrees away then.
  if (!view.pointsAt && view.offDeg > fan.coneHalfAngleDeg) {
    issue.kind = 'aim';
    issue.value = view.offDeg;
    issue.limit = fan.coneHalfAngleDeg;
    return false;
  }
  return true;
}

const newIssue = (): FanIssue => ({ kind: 'off', value: 0, limit: 0 });

/**
 * Why the fan action does not count right now, in student words - or null when it counts
 * (see checkFan). `still`: the robot stands still.
 */
export function fanProblem(ctx: ScoreContext<FireChiefScenario>, still: boolean): string | null {
  const issue = newIssue();
  return checkFan(ctx, still, issue) ? null : issueText(issue);
}

const scratchContact = makeContact();

/**
 * A quick "could the robot be touching the target?" with plain numbers, for the referee's look
 * on every tick while the robot is near the target (in the middle of the fire room it is). It
 * may say yes too often, never no when they touch: the exact test follows a yes.
 */
function mayTouch(config: RobotConfig, pose: { x: number; y: number; heading: number }, target: Body): boolean {
  // (a robot with fingers has more parts than its chassis: no shortcut for it)
  if (config.gripper.enabled) return true;
  const sin = Math.sin(pose.heading);
  const cos = Math.cos(pose.heading);
  const middle = (config.chassisFront - config.chassisRear) / 2;
  const margin = TOUCH_MM + 0.01;
  return boxesOverlap(
    pose.x + middle * sin,
    pose.y - middle * cos,
    config.chassisWidth / 2 + margin,
    (config.chassisFront + config.chassisRear) / 2 + margin,
    sin,
    cos,
    target.x,
    target.y,
    target.w / 2,
    target.l / 2,
    Math.sin(target.angle),
    Math.cos(target.angle),
    scratchContact,
  );
}

/** Everything of the robot lies within this distance (mm) of the middle of its wheel axle. */
function robotReach(config: RobotConfig): number {
  const half = config.chassisWidth / 2;
  let reach = Math.max(Math.hypot(config.chassisFront, half), Math.hypot(config.chassisRear, half));
  const g = config.gripper;
  if (g.enabled) {
    reach = Math.max(reach, Math.hypot(g.gripForward + g.fingerLength / 2, widestClawGap(config) / 2 + g.fingerThickness));
  }
  return reach;
}

// =============================================================================================
// The referee
// =============================================================================================

export type AchievementId = 'leave-start' | 'enter-room' | 'fan-start' | 'fan-complete';
export const ACHIEVEMENT_IDS: AchievementId[] = ['leave-start', 'enter-room', 'fan-start', 'fan-complete'];

const ACHIEVEMENTS: Record<AchievementId, { label: string; points: number }> = {
  'leave-start': { label: 'Leave START completely', points: POINTS_LEAVE_START },
  'enter-room': { label: 'Drive completely into the living room or the bedroom', points: POINTS_ENTER_ROOM },
  'fan-start': { label: 'Stand still, face the fire and start the fan', points: POINTS_FAN_START },
  'fan-complete': { label: `Keep the fan on the fire for ${FAN_ACTION_SECONDS} seconds`, points: POINTS_FAN_COMPLETE },
};

/** The extra line of the sheet for a robot that did not start inside START (see assumption 19 at the top). */
export const START_POSITION_LINE_ID = 'start-position';

/** Match time as the referee writes it down: 83.42 -> "1:23.4" (tenths are cut off, never rounded up). */
export function clock(seconds: number): string {
  const tenths = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths - minutes * 600;
  return `${minutes}:${rest < 100 ? '0' : ''}${(rest / 10).toFixed(1)}`;
}

/** Seconds with one decimal, cut off: 1.49 -> "1.4". */
const oneDecimal = (seconds: number): string => (Math.floor(seconds * 10 + 1e-6) / 10).toFixed(1);

function createReferee(_scenario: FireChiefScenario): Referee<FireChiefScenario> {
  /** when each achievement was earned (match time, seconds); not in the map = not earned */
  const earned = new Map<AchievementId, number>();
  /** the room that gave the room points */
  let enteredRoom: RoomId | null = null;
  /** match time at which the fan action that is going on right now began; null = no action */
  let actionSince: number | null = null;
  /** where the robot was at the last tick (and when that was), to see whether it stands still */
  const last = { known: false, x: 0, y: 0, heading: 0, time: 0 };
  let still = false;
  /** match time of the restart, if the team used it */
  let restartAt: number | null = null;
  /** rules §6.1: the whole robot was inside START at the start signal (`begun`: the signal was given) */
  let startedInside = true;
  let begun = false;

  // ---- what the final sheet needs to say why something was NOT earned
  /** why the fan action does not count on this tick (one object, filled again on every tick) */
  const issue = newIssue();
  /** the last time the fan blew without counting: when, and why */
  const miss = { seen: false, time: 0, issue: newIssue() };
  /** the last fan action that broke before its 3 seconds were over: how long it had lasted, and why it broke */
  const broke = { seen: false, seconds: 0, issue: newIssue() };
  /** match time of the last tick in which the robot touched the target */
  let lastTouch = -Infinity;
  /** set when the attempt is over: how long the fan action that was going on had lasted (null = none was) */
  let over: { actionSeconds: number | null } | null = null;
  /** the robot is nearer to the target than this (mm, middle of the axle to middle of the target) when it can touch it */
  let touchRange = -1;

  const copyIssue = (to: FanIssue): void => {
    to.kind = issue.kind;
    to.value = issue.value;
    to.limit = issue.limit;
  };

  /** what the referee says on this tick (almost always nothing) */
  let say: string[] | null = null;
  const speak = (sentence: string): void => {
    if (say === null) say = [];
    say.push(sentence);
  };
  const award = (id: AchievementId, time: number, what: string): void => {
    earned.set(id, time);
    speak(`+${ACHIEVEMENTS[id].points} points at ${clock(time)}: ${what}`);
  };

  /** The attempt is over: from now on the sheet is final. */
  const close = (time: number): void => {
    if (over !== null) return;
    over = { actionSeconds: actionSince === null ? null : time - actionSince };
    actionSince = null;
  };

  /** Rules §8: before the start the referee checks the starting position. */
  function begin(ctx: ScoreContext<FireChiefScenario>): void {
    begun = true;
    startedInside = ctx.robotShapes.every((shape) => rectContainsOBB(START_RECT, shape));
  }

  function observe(ctx: ScoreContext<FireChiefScenario>): RefereeCall | null {
    const world = ctx.world;
    const robot = world.robot;
    const time = world.time;
    say = null;

    // "stands still": the wheels do not turn and the robot is exactly where it was a tick ago
    const pose = robot.pose;
    still =
      last.known &&
      robot.left.rpm === 0 &&
      robot.right.rpm === 0 &&
      Math.abs(pose.x - last.x) < 1e-6 &&
      Math.abs(pose.y - last.y) < 1e-6 &&
      Math.abs(pose.heading - last.heading) < 1e-9;
    // the tick the referee is looking at began when the one before it ended
    const tickBegan = last.time;
    last.known = true;
    last.x = pose.x;
    last.y = pose.y;
    last.heading = pose.heading;
    last.time = time;

    const target = targetOf(world);
    if (target) {
      // ---- rules §11: a displaced target ends the attempt; what was earned before stays
      const shift = targetShift(target);
      if (shift > TARGET_DISPLACED_MM) {
        close(time);
        return {
          end: {
            reason: 'target-displaced',
            detail:
              `The robot pushed the fire target out of its place (by ${overLimit(shift, TARGET_DISPLACED_MM)} mm). ` +
              'The attempt ends here; the points earned before stay.',
          },
        };
      }

      // ---- a touch that does not displace the target costs nothing (the organiser's decision D1
      // at the top), but the team should know about it. (Only looked at when the robot is near enough.)
      if (touchRange < 0) touchRange = robotReach(ctx.robotConfig) + Math.hypot(target.w, target.l) / 2 + TOUCH_MM;
      const dx = target.x - pose.x;
      const dy = target.y - pose.y;
      if (dx * dx + dy * dy <= touchRange * touchRange && mayTouch(ctx.robotConfig, pose, target)) {
        const targetShape = footprint(target);
        if (ctx.robotShapes.some((shape) => obbTouches(targetShape, shape, TOUCH_MM))) {
          if (time - lastTouch > TOUCH_QUIET_SECONDS) {
            speak(
              'The robot touches the fire target. A fan action does not count while it touches, and the attempt ends ' +
                'if the target is pushed out of its place. Keep a distance: a real target can also fall over.',
            );
          }
          lastTouch = time;
        }
      }
    }

    // ---- 10 points: completely out of START
    // (while the middle of its axle is over START the robot cannot be out: no need to measure)
    if (!earned.has('leave-start') && !pointInRect(pose, START_RECT) && hasLeftStart(ctx.robotShapes)) {
      award('leave-start', time, 'the robot has left START completely.');
    }

    // ---- 20 points: completely inside one of the two rooms (the second room adds nothing)
    if (!earned.has('enter-room') && (pointInRect(pose, roomRect('living')) || pointInRect(pose, roomRect('bedroom')))) {
      const room = roomAround(ctx.robotShapes);
      if (room) {
        enteredRoom = room;
        award('enter-room', time, `the robot is completely inside the ${ROOMS[room].name}.`);
      }
    }

    // ---- 30 + 40 points: the fan action
    // The referee looks at the END of a tick. When everything is right then, it was right for
    // that whole tick: the robot has not moved since the tick began, and a program switches the
    // fan on at the beginning of a tick. So an action begins at the BEGINNING of the first tick
    // that was right - the moment the program switched the fan on (or the robot came to rest) -
    // and a fan that blows for 300 ticks ("fan on, wait 3 seconds, fan off") has blown for 3 s.
    if (robot.fanOn !== true && actionSince === null) {
      // (almost every tick of an attempt: the fan is off and no action is going on - nothing to look at)
    } else if (checkFan(ctx, still, issue)) {
      if (actionSince === null) actionSince = tickBegan;
      if (!earned.has('fan-start')) {
        award('fan-start', actionSince, 'the robot stands still, faces the fire and the fan is on.');
      }
      if (time - actionSince >= FAN_ACTION_SECONDS - 1e-9) {
        award('fan-complete', time, `the fan blew at the fire for ${FAN_ACTION_SECONDS} seconds.`);
        close(time);
        // (with fewer than 100 points the sentence says what is missing: see decision D2 at the top)
        const total = [...earned.keys()].reduce((sum, id) => sum + ACHIEVEMENTS[id].points, 0);
        const missing = ACHIEVEMENT_IDS.filter((id) => !earned.has(id));
        const detail =
          missing.length === 0
            ? `Mission complete at ${clock(time)}: the fan blew at the fire for ${FAN_ACTION_SECONDS} seconds.`
            : `Mission complete at ${clock(time)} with ${total} of ${MAX_SCORE} points: the fan blew at the fire for ` +
              `${FAN_ACTION_SECONDS} seconds. Not earned: ` +
              `${missing.map((id) => `${ACHIEVEMENTS[id].label} (${ACHIEVEMENTS[id].points} points)`).join(', ')}.`;
        return { say: say ?? undefined, end: { reason: 'mission-complete', detail } };
      }
    } else {
      if (issue.kind !== 'off' && issue.kind !== 'no-fan') {
        // the fan blows, but not so that it counts: the final sheet says when and why
        miss.seen = true;
        miss.time = time;
        copyIssue(miss.issue);
      }
      if (actionSince !== null) {
        // The action broke during this tick (it was still right when the tick began): the 30
        // points stay, the 3 seconds start again with the next action.
        broke.seen = true;
        broke.seconds = tickBegan - actionSince;
        copyIssue(broke.issue);
        speak(
          `The fan action stopped after ${oneDecimal(broke.seconds)} s: ${issueText(issue)}. ` +
            `The ${FAN_ACTION_SECONDS} seconds start again.`,
        );
        actionSince = null;
      }
    }

    return say === null ? null : { say };
  }

  /** Rules §10: the points of the attempt are cleared; the clock, the maze and the target stay. */
  function restart(ctx: ScoreContext<FireChiefScenario>): void {
    earned.clear();
    enteredRoom = null;
    actionSince = null;
    last.known = false;
    last.time = ctx.world.time;
    still = false;
    restartAt = ctx.world.time;
    miss.seen = false;
    broke.seen = false;
    lastTouch = -Infinity;
  }

  /**
   * The attempt has ended (time, "Finished", the end of the program - or this referee ended it
   * and has closed its book already). The simulation calls this before it switches the fan
   * off, so what was going on at the last moment is still known here.
   */
  function finished(ctx: ScoreContext<FireChiefScenario>): void {
    close(ctx.world.time);
  }

  /** A line that was not earned, on the sheet of an attempt that is still running. */
  function notYet(id: AchievementId, ctx: ScoreContext<FireChiefScenario>): string {
    if (id === 'leave-start') return 'not yet - the whole robot must be outside the START cell';
    if (id === 'enter-room') return 'not yet - the whole robot must be inside the living room or the bedroom';
    if (id === 'fan-start') return `not yet - ${fanProblem(ctx, still) ?? 'stand still in front of the fire and switch the fan on'}`;
    // fan-complete
    if (actionSince !== null) {
      return `the fan is on the fire: ${oneDecimal(ctx.world.time - actionSince)} of ${FAN_ACTION_SECONDS} seconds - keep still`;
    }
    if (broke.seen) {
      // (why it broke then - not what the robot is doing now)
      return (
        `the fan action stopped after ${oneDecimal(broke.seconds)} of ${FAN_ACTION_SECONDS} seconds (${issueText(broke.issue, true)}) - ` +
        `hold it for ${FAN_ACTION_SECONDS} seconds without a break`
      );
    }
    return `not yet - the fan must blow at the fire for ${FAN_ACTION_SECONDS} seconds without a break`;
  }

  /**
   * A line that was not earned, on the final sheet. Nothing here looks at the field as it is
   * now (the simulation has stopped the robot and its fan): it says what the referee saw.
   */
  function notEarned(id: AchievementId, ctx: ScoreContext<FireChiefScenario>, actionSeconds: number | null): string {
    if (id === 'leave-start') return 'not earned - the robot never left the START cell completely';
    if (id === 'enter-room') return 'not earned - the robot was never completely inside the living room or the bedroom';
    if (id === 'fan-start') {
      const fan = ctx.robotConfig.fan;
      if (!fan || !fan.enabled) return 'not earned - this robot has no fan';
      if (!miss.seen) return 'not earned - the fan never blew';
      return `not earned - the fan blew, but it did not count. The last time, at ${clock(miss.time)}: ${issueText(miss.issue, true)}`;
    }
    // fan-complete
    if (actionSeconds !== null) {
      return `not earned - the fan action was ${oneDecimal(actionSeconds)} of ${FAN_ACTION_SECONDS} seconds long when the attempt ended`;
    }
    if (broke.seen) {
      return `not earned - the fan action stopped after ${oneDecimal(broke.seconds)} of ${FAN_ACTION_SECONDS} seconds: ${issueText(broke.issue, true)}`;
    }
    return `not earned - the fan never blew at the fire for ${FAN_ACTION_SECONDS} seconds without a break`;
  }

  function score(ctx: ScoreContext<FireChiefScenario>): ScoreReport {
    const ended = over;
    const detailOf = (id: AchievementId): string => {
      const at = earned.get(id);
      if (at !== undefined) {
        if (id === 'enter-room' && enteredRoom) return `done at ${clock(at)} (${ROOMS[enteredRoom].name})`;
        if (id === 'fan-complete') return `done at ${clock(at)}: mission complete`;
        return `done at ${clock(at)}`;
      }
      return ended === null ? notYet(id, ctx) : notEarned(id, ctx, ended.actionSeconds);
    };

    const lines: ScoreLine[] = ACHIEVEMENT_IDS.map((id) => {
      const at = earned.get(id);
      const line: ScoreLine = {
        id,
        label: ACHIEVEMENTS[id].label,
        points: at !== undefined ? ACHIEVEMENTS[id].points : 0,
        max: ACHIEVEMENTS[id].points,
        ok: at !== undefined,
        detail: detailOf(id),
      };
      if (at !== undefined) line.time = at;
      return line;
    });
    lines.push({
      id: 'restart',
      label: 'Restart',
      points: 0,
      max: 0,
      ok: restartAt === null,
      detail:
        restartAt === null
          ? 'no restart used (one is allowed; it clears the points, the clock keeps running)'
          : `restart used at ${clock(restartAt)}: the points earned before it were cleared`,
    });
    // before the start signal the robot still stands where it will start: look at it now
    const inside =
      begun || ctx.world.tick > 0 ? startedInside : ctx.robotShapes.every((shape) => rectContainsOBB(START_RECT, shape));
    if (!inside) {
      // (only a start pose from SimulationOptions can do this: see assumption 19 at the top)
      lines.push({
        id: START_POSITION_LINE_ID,
        label: 'Start completely inside START',
        points: 0,
        max: 0,
        ok: false,
        detail:
          'the robot did not start completely inside the START cell - on the real field the referee does not start such an attempt',
      });
    }

    const total = lines.reduce((sum, line) => sum + line.points, 0);
    // complete = all four achievements (an attempt can end "mission complete" with fewer: decision D2 at the top)
    const report: ScoreReport = { total, max: MAX_SCORE, lines, complete: earned.size === ACHIEVEMENT_IDS.length };
    // the ranking uses "the time at which this score was reached": the time of the last achievement
    if (earned.size > 0) report.time = Math.max(...earned.values());
    return report;
  }

  return { begin, observe, restart, finished, score };
}

// =============================================================================================
// The game
// =============================================================================================

export const fireChiefGame: Game<FireChiefScenario> = {
  id: 'fire-chief',
  title: 'MakeX Lebanon 2027 - Fire Chief',
  mat: {
    width: FIELD_SIZE,
    height: FIELD_SIZE,
    imageUrl: MAT_IMAGE_URL,
    sensorImageUrl: MAT_SENSOR_IMAGE_URL,
    vector: MAT_VECTOR,
  },
  matchDuration: MATCH_DURATION,
  startZone: START_RECT,
  defaultStartPose: START_POSE,
  // a restart costs no points of its own: it clears what was earned (restartRules below)
  restartPenalty: 0,
  defaultScenario,
  randomScenario,
  scenarioCount: () => SCENARIO_COUNT,
  encodeScenario,
  decodeScenario,
  describeScenario,
  createBodies,
  overlays,
  // (during a match the referee below keeps the score; this is the sheet of an attempt in which
  // nothing has been earned yet)
  score: (ctx) => createReferee(ctx.scenario).score(ctx),

  robotConfig: FIRE_CHIEF_ROBOT,
  createWalls,
  createReferee,
  restartRules: { maxRestarts: MAX_RESTARTS, clearsPoints: true, resetsBodies: true },
  scenarioProblems,
};
