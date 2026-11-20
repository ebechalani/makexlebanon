/**
 * The robot Fire Fighter is played with: the simulator's mBot2 exactly as in Fire Rescue - the
 * gripper at the front (servo S1 lifts the arm, S2 opens and closes the claw), the colour sensor at
 * the claw (it names the colour of a cube in the claw: red or yellow), the Ultrasonic Sensor 2, the
 * Quad RGB sensor looking down and the CyberPi. The lines of this mat are black on white, as in Fire
 * Rescue, so the line blocks mean the black lines (border 35: the lines read 12.7, the white mat 100,
 * the pictures 52 to 80 on average).
 *
 * What matters for this game (from the middle of the drive axle):
 *   - the claw's finger tips reach 167 mm ahead, the line sensor 85 mm: the claw is 82 mm ahead of
 *     the line sensor, so at the corner towers the claw is already inside the tower when the sensor
 *     reaches the T bar (field.ts TOWER_STEMS; game.ts F6);
 *   - the claw is 80 mm wide open, 66 mm with a cube in it and 36 mm closed: only the closed, empty
 *     claw fits between a tower's two supports (60 mm, field.ts TOWER_GAP).
 */
import { DEFAULT_ROBOT_CONFIG } from '../core/robot';
import type { Pose, RobotConfig } from '../core/types';
import { FIRE_STATION, FIRE_STATION_STEM_X } from './field';

/**
 * The same mBot2 as in Fire Rescue, part for part: a copy of its numbers when this file is loaded
 * (so that a change to one game's robot object while the site runs does not touch the other game).
 */
export const FIRE_FIGHTER_ROBOT: RobotConfig = {
  ...DEFAULT_ROBOT_CONFIG,
  quadRgb: { ...DEFAULT_ROBOT_CONFIG.quadRgb, probeOffsets: [...DEFAULT_ROBOT_CONFIG.quadRgb.probeOffsets] },
  ultrasonic: { ...DEFAULT_ROBOT_CONFIG.ultrasonic },
  frontColorSensor: { ...DEFAULT_ROBOT_CONFIG.frontColorSensor },
  gripper: { ...DEFAULT_ROBOT_CONFIG.gripper },
  noise: { ...DEFAULT_ROBOT_CONFIG.noise },
};

/**
 * How far the whole robot reaches from the middle of its drive axle: the chassis and, with a
 * gripper, the fingers opened as wide as they go (the same sums as Warehouse Sort's robotReach and
 * Fire Rescue's robotExtents). This robot: 167 mm ahead, 70 behind, 65 to each side.
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

/** How far the claw's finger tips reach ahead of the line sensor (mm): 82 for this robot. */
export function clawAheadOfLineSensor(config: RobotConfig): number {
  const g = config.gripper;
  const tips = g.enabled ? g.gripForward + g.fingerLength / 2 : config.chassisFront;
  return tips - config.quadRgb.forward;
}

/** Facing up, into the field (heading 0 is up the mat, clockwise positive). */
export const START_HEADING = 0;

/**
 * Where a robot starts: inside the Fire Station, facing up, with the same room in front of it and
 * behind it, and its middle on the middle of the Fire Station stem (so a robot that drives straight
 * ahead drives up the stem, to the yellow cube).
 */
export function startPoseFor(config: RobotConfig): Pose {
  const { front, rear } = robotReach(config);
  // facing up, the front is at y - front and the back at y + rear
  const y = FIRE_STATION.y + (FIRE_STATION.h - (front + rear)) / 2 + front;
  return { x: FIRE_STATION_STEM_X, y, heading: START_HEADING };
}

/**
 * The start pose of this game's robot: x 633.834, y 1158.912 mm, facing up. The robot (237 mm long
 * with its open claw, 130 mm wide) then has 6.5 mm free in front of it and behind it inside the Fire
 * Station, 65.8 mm on its left and 54.2 mm on its right. Its line sensor is at y 1073.9, over the
 * Fire Station picture: the stem begins at y 1036.0.
 */
export const START_POSE: Pose = startPoseFor(FIRE_FIGHTER_ROBOT);
