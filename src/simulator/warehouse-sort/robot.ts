/**
 * The robot Warehouse Sort is played with: the simulator's mBot2 exactly as in Fire Rescue -
 * the gripper at the front (servo S1 lifts the arm, S2 opens and closes the claw), the colour
 * sensor at the claw, the Ultrasonic Sensor 2, the Quad RGB sensor looking down and the CyberPi.
 *
 * One thing is set differently: the lines of this mat are WHITE on a BLACK mat, and the Quad
 * RGB sensor is set to see a light line. The real sensor learns which of the two is the line:
 * the team puts it on the black mat, presses its button twice and sweeps it over the white line
 * and the black mat (Makeblock's instructions for the Quad RGB sensor). The simulator's robot
 * comes with that done, so the line blocks ("line status", "deviation", "detects line") mean
 * the white lines.
 */
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { Pose, RobotConfig } from '../core/types';
import { LONG_LINE_Y, START_ZONE } from './field';

/**
 * ASSUMPTION: the border between "line" and "background" for the learned sensor, in brightness
 * 0 (black) .. 100 (white). A probe reads "line" above it. On this mat the black ground reads 13
 * and the white lines 100, so a probe needs about two thirds of its spot on a white line - the
 * same share the standard robot (border 35) needs on a black line on a white mat. Yellow (86)
 * reads "line" too; orange (65), green (51), the pads (40 on average), red (29) and the start
 * zone (22) read "background".
 */
export const LIGHT_LINE_THRESHOLD = 70;

export const WAREHOUSE_SORT_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb, lightLine: true, lineThreshold: LIGHT_LINE_THRESHOLD },
  ultrasonic: { ...DEFAULT_ROBOT_CONFIG.ultrasonic },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor },
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper },
  noise: { ...DEFAULT_ROBOT_CONFIG.noise },
};

/**
 * How far the whole robot reaches from the middle of its drive axle: the chassis and, with a
 * gripper, the fingers opened as wide as they go (the same sum as Fire Rescue's robotExtents).
 */
export function robotReach(config: RobotConfig): { front: number; rear: number; halfWidth: number } {
  let front = config.chassisFront;
  let halfWidth = Math.max(config.chassisWidth, config.trackWidth) / 2;
  const g = config.gripper;
  if (g.enabled) {
    front = Math.max(front, g.gripForward + g.fingerLength / 2);
    halfWidth = Math.max(halfWidth, Math.max(g.clawOpenGap, g.clawClosedGap) / 2 + g.fingerThickness);
  }
  return { front, rear: config.chassisRear, halfWidth };
}

/** Facing left, into the field (heading 0 is up the mat, clockwise positive). */
export const START_HEADING = -Math.PI / 2;

/**
 * Where a robot starts: facing left, into the field, with the same room in front of it and
 * behind it inside the start zone, and its middle on the middle of the long white line (so a
 * robot that drives straight ahead drives along that line).
 */
export function startPoseFor(config: RobotConfig): Pose {
  const { front, rear } = robotReach(config);
  // facing left, the front is at x - front and the back at x + rear
  const x = START_ZONE.x + (START_ZONE.w - (front + rear)) / 2 + front;
  return { x, y: LONG_LINE_Y, heading: START_HEADING };
}

/**
 * The start pose of this game's robot: x 1151.09, y 604.88 mm. The robot (237 mm long with its
 * open claw, 130 mm wide) then has 13.9 mm free in front of it and behind it inside the start
 * zone, 60.1 mm above it and 73.4 mm below it.
 */
export const START_POSE: Pose = startPoseFor(WAREHOUSE_SORT_ROBOT);
