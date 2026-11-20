/**
 * The robot of Fire Cadet: a Makeblock mTiny with the two pushing sticks the organiser adds ("2
 * sticks will be added on the left and right to push it in front of the robot", ORGANISER 3).
 *
 * For the engine it is a box (the body, 114 x 106.5 mm, turning around its middle: N2) with a
 * claw whose two fingers are the two sticks: 30 mm long beyond the front of the body, 8 mm thick,
 * on the left and the right edge of the front, 90.5 mm apart (A5). The claw never opens or closes
 * and nothing commands a servo, so the sticks never move. GripperConfig.fixedSticks (core/types.ts)
 * makes what stands between them go round with the robot when it turns (N3): driving forward pushes
 * an item, turning takes it along, driving backward leaves it.
 *
 *          +-[ ]--------[ ]-+     <- the tips of the sticks: 87 mm ahead of the turning point
 *          |  |  item here  |  |
 *          +--+-------------+--+  <- the front of the body: 57 mm ahead
 *          |        +          |     + = the turning point, the middle of the body
 *          +-------------------+  <- the back: 57 mm behind
 *
 * The robot has no sensor here: the cards and the panel drive it blind, as the real one.
 *
 * Plain TypeScript, no DOM: it runs under Node too.
 */
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { Pose, RobotConfig } from '../core/types';
import { START_SQUARE } from './field';
import { FIRE_CADET, spot, type CardTimes } from './numbers';

/**
 * The mTiny for a set of card times. Its top speed is worked out so that one move - speeding up
 * for RAMP_SECONDS, cruising, braking for RAMP_SECONDS - covers one STEP in MOVE_SECONDS:
 * maxRpm = (STEP / (MOVE_SECONDS - RAMP_SECONDS)) / (pi x WHEEL_DIAMETER) x 60 = 60.70 RPM, and
 * rpmPerSecond = maxRpm / RAMP_SECONDS = 303.5. (A turn runs slower: cards.ts, turnRpm.)
 */
export function mtinyRobot(times: CardTimes = FIRE_CADET): RobotConfig {
  const f = FIRE_CADET;
  const maxRpm = (f.STEP / (times.MOVE_SECONDS - times.RAMP_SECONDS) / (Math.PI * f.WHEEL_DIAMETER)) * 60;
  return {
    chassisFront: f.TURNING_POINT_TO_FRONT,
    chassisRear: f.BODY_LENGTH - f.TURNING_POINT_TO_FRONT,
    chassisWidth: f.BODY_WIDTH,
    chassisHeight: f.BODY_HEIGHT,
    wheelDiameter: f.WHEEL_DIAMETER,
    trackWidth: f.TRACK_WIDTH,
    maxRpm,
    rpmPerSecond: maxRpm / times.RAMP_SECONDS,
    // never used: no servo is commanded
    servoSpeed: DEFAULT_ROBOT_CONFIG.servoSpeed,
    // the engine needs these filled in; nothing reads them (the mTiny has no sensor here)
    quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb, probeOffsets: [...DEFAULT_ROBOT_CONFIG.quadRgb.probeOffsets] },
    ultrasonic: { ...DEFAULT_ROBOT_CONFIG.ultrasonic, forward: f.TURNING_POINT_TO_FRONT },
    frontColorSensor: { enabled: false, rangeMm: 0 },
    // the two sticks are the two fingers of a claw that never moves
    gripper: {
      ...DEFAULT_ROBOT_CONFIG.gripper,
      enabled: true,
      fixedSticks: true,
      // the "arm" never moves: the sticks are STICK_BOTTOM above the mat
      liftDownHeight: f.STICK_BOTTOM,
      liftUpHeight: f.STICK_BOTTOM,
      // the "claw" never moves: the sticks are STICK_GAP apart
      clawOpenGap: f.STICK_GAP,
      clawClosedGap: f.STICK_GAP,
      // the middle of a stick: 57 + 30 / 2 = 72 mm ahead of the turning point
      gripForward: f.TURNING_POINT_TO_FRONT + f.STICK_LENGTH / 2,
      fingerLength: f.STICK_LENGTH,
      fingerThickness: f.STICK_THICKNESS,
      fingerHeight: f.STICK_HEIGHT,
    },
    noise: { wheelSlip: 0, sensor: 0, ultrasonicCm: 0 },
  };
}

/** The mTiny of the game, with the card times of numbers.ts. */
export const MTINY_ROBOT: RobotConfig = mtinyRobot();

/**
 * Where the robot starts (ASSUMPTION A12, N1): on the spot of the Fire Station at the bottom, D7
 * (x 624.764, y 1158.764 mm), looking up the map. The whole robot, sticks included, is then inside
 * D7 with 2.0 mm to spare at the tips of the sticks (integration.test.ts).
 */
export const START_POSE: Pose = { ...spot(START_SQUARE), heading: 0 };
