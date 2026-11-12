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
 */
import {
  localToWorld,
  obbCorners,
  obbTouches,
  obbTouchesRect,
  pointInRect,
  rectContainsOBB,
  type OBB,
} from '../core/geometry';
import type {
  Body,
  FixedWall,
  Game,
  Referee,
  RefereeCall,
  ScoreContext,
  ScoreLine,
  ScoreReport,
  World,
  ZoneOverlay,
} from '../core/types';
import { wallBetween } from '../core/walls';
import {
  EMITTER_HALF_ANGLE_DEG,
  EMITTER_HEIGHT,
  FIELD_SIZE,
  MAT_IMAGE_URL,
  MAT_SENSOR_IMAGE_URL,
  MAT_VECTOR,
  ROOMS,
  ROOM_IDS,
  START_RECT,
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
 * where it stood. ASSUMPTION - the rules only say "displaces".
 */
export const TARGET_DISPLACED_MM = 5;
/** Two things closer than this (mm) count as touching. */
const TOUCH_EPS = 0.5;

// =============================================================================================
// The field at the start of an attempt
// =============================================================================================

export const KIND_FIRE_TARGET = 'fire-target';
export const TARGET_BODY_ID = 'target:fire';

const TARGET_FILL = '#f97316';
const START_ZONE_CSS = '#dc2626';
const ROOM_CSS = '#2563eb';
const FIRE_ROOM_CSS = '#f97316';

/** Footprint of a body on the mat, seen from above. */
export function footprint(body: Pick<Body, 'x' | 'y' | 'w' | 'l' | 'angle'>): OBB {
  return { x: body.x, y: body.y, w: body.w, l: body.l, angle: body.angle };
}

/** The one game element: the wooden flame with its infrared emitter, looking into its room. */
function createBodies(s: FireChiefScenario): Body[] {
  const at = targetPose(s.fireRoom, s.fireSpot);
  return [
    {
      id: TARGET_BODY_ID,
      kind: KIND_FIRE_TARGET,
      label: 'F',
      fill: TARGET_FILL,
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
      // the emitter sits in the middle of the front face
      infrared: { forward: TARGET_DEPTH / 2, height: EMITTER_HEIGHT, halfAngleDeg: EMITTER_HALF_ANGLE_DEG },
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
  /** degrees between "straight ahead" of the fan and the direction of the target */
  offDeg: number;
  /** the wall that stands between the fan and the target, if any */
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
  const ahead = dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading);
  const aside = dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading);
  const targetShape = footprint(target);
  return {
    fanOn: ctx.world.robot.fanOn === true,
    distance: Math.hypot(dx, dy),
    offDeg: (Math.abs(Math.atan2(aside, ahead)) * 180) / Math.PI,
    wall: wallBetween(ctx.world.walls, from, { x: target.x, y: target.y }),
    touching: ctx.robotShapes.some((shape) => obbTouches(targetShape, shape, TOUCH_EPS)),
  };
}

/**
 * Why the fan action does not count right now, in student words - or null when it counts:
 * the robot stands still, the fan is on, the target is in front of the fan (inside its cone and
 * its reach), no wall is between them and the robot does not touch the target.
 */
export function fanProblem(ctx: ScoreContext<FireChiefScenario>, still: boolean): string | null {
  const fan = ctx.robotConfig.fan;
  if (!fan || !fan.enabled) return 'this robot has no fan';
  // (the two quick questions first: the referee asks on every tick, and mostly the fan is off)
  if (ctx.world.robot.fanOn !== true) return 'the fan is off';
  if (!still) return 'the robot is moving - it must stand still';
  const view = lookAtFan(ctx);
  if (!view) return 'there is no fire target on the field';
  if (view.touching) return 'the robot touches the fire target - move back a little';
  if (view.wall) return 'there is a wall between the fan and the fire';
  if (view.distance > fan.reachMm) {
    return `the fire is too far from the fan (${Math.round(view.distance)} mm, at most ${fan.reachMm} mm)`;
  }
  if (view.offDeg > fan.coneHalfAngleDeg) {
    return `the fan does not point at the fire (${Math.round(view.offDeg)} degrees off, at most ${fan.coneHalfAngleDeg})`;
  }
  return null;
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
  /** where the robot was at the last tick, to see whether it stands still */
  const last = { known: false, x: 0, y: 0, heading: 0 };
  let still = false;
  /** match time of the restart, if the team used it */
  let restartAt: number | null = null;

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
    last.known = true;
    last.x = pose.x;
    last.y = pose.y;
    last.heading = pose.heading;

    // ---- rules §11: a displaced target ends the attempt; what was earned before stays
    const target = targetOf(world);
    if (target) {
      const shift = targetShift(target);
      if (shift > TARGET_DISPLACED_MM) {
        actionSince = null;
        return {
          end: {
            reason: 'target-displaced',
            detail:
              `The robot pushed the fire target out of its place (by ${Math.round(shift)} mm). ` +
              'The attempt ends here; the points earned before stay.',
          },
        };
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
    const problem = fanProblem(ctx, still);
    if (problem === null) {
      if (actionSince === null) actionSince = time;
      if (!earned.has('fan-start')) {
        award('fan-start', time, 'the robot stands still, faces the fire and the fan is on.');
      }
      if (time - actionSince >= FAN_ACTION_SECONDS - 1e-9) {
        award('fan-complete', time, `the fan blew at the fire for ${FAN_ACTION_SECONDS} seconds.`);
        return {
          say: say ?? undefined,
          end: {
            reason: 'mission-complete',
            detail: `Mission complete at ${clock(time)}: the fan blew at the fire for ${FAN_ACTION_SECONDS} seconds.`,
          },
        };
      }
    } else if (actionSince !== null) {
      // the action broke: the 30 points stay, the 3 seconds start again with the next action
      speak(
        `The fan action stopped after ${oneDecimal(time - actionSince)} s: ${problem}. ` +
          `The ${FAN_ACTION_SECONDS} seconds start again.`,
      );
      actionSince = null;
    }

    return say === null ? null : { say };
  }

  /** Rules §10: the points of the attempt are cleared; the clock, the maze and the target stay. */
  function restart(ctx: ScoreContext<FireChiefScenario>): void {
    earned.clear();
    enteredRoom = null;
    actionSince = null;
    last.known = false;
    still = false;
    restartAt = ctx.world.time;
  }

  function score(ctx: ScoreContext<FireChiefScenario>): ScoreReport {
    const time = ctx.world.time;
    const detailOf = (id: AchievementId): string => {
      const at = earned.get(id);
      if (at !== undefined) {
        if (id === 'enter-room' && enteredRoom) return `done at ${clock(at)} (${ROOMS[enteredRoom].name})`;
        if (id === 'fan-complete') return `done at ${clock(at)}: mission complete`;
        return `done at ${clock(at)}`;
      }
      if (id === 'leave-start') return 'not yet - the whole robot must be outside the START cell';
      if (id === 'enter-room') return 'not yet - the whole robot must be inside the living room or the bedroom';
      if (id === 'fan-start') return `not yet - ${fanProblem(ctx, still) ?? 'stand still in front of the fire and switch the fan on'}`;
      // fan-complete
      if (actionSince !== null) {
        return `the fan is on the fire: ${oneDecimal(time - actionSince)} of ${FAN_ACTION_SECONDS} seconds - keep still`;
      }
      if (earned.has('fan-start')) {
        return `the fan action stopped too early (${fanProblem(ctx, still) ?? 'it broke'}) - hold it for ${FAN_ACTION_SECONDS} seconds without a break`;
      }
      return `not yet - the fan must blow at the fire for ${FAN_ACTION_SECONDS} seconds without a break`;
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

    const total = lines.reduce((sum, line) => sum + line.points, 0);
    const report: ScoreReport = { total, max: MAX_SCORE, lines, complete: earned.size === ACHIEVEMENT_IDS.length };
    // the ranking uses "the time at which this score was reached": the time of the last achievement
    if (earned.size > 0) report.time = Math.max(...earned.values());
    return report;
  }

  return { observe, restart, score };
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
