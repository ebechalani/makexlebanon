/**
 * The robot Locker Room is played with: the simulator's mBot2 exactly as in Warehouse Sort - the
 * gripper at the front (servo S1 lifts the arm, S2 opens and closes the claw), the colour sensor
 * at the claw, the Ultrasonic Sensor 2, the Quad RGB sensor looking down (taught to see the WHITE
 * lines of a black mat, as in Warehouse Sort) and the CyberPi.
 *
 * And the Team Box on top (rules §4: "Each team must build a part on their robot that holds the
 * Team Box"): it rides on the robot from the start until the referee lifts it at the Scan Station.
 * It is not part of the robot's configuration: the referee owns it (./game.ts puts it on the
 * robot as a RefereeProp), it does not change the robot's footprint (./field.ts TEAM_BOX) and no
 * sensor sees it.
 */
import type { Pose, RobotConfig } from '../core/types';
import { LIGHT_LINE_THRESHOLD, WAREHOUSE_SORT_ROBOT, robotReach } from '../warehouse-sort/robot';
import { BOTTOM_LINE_Y, LOCKER_ROOM } from './field';

export { LIGHT_LINE_THRESHOLD, robotReach };

/**
 * The same mBot2 as in Warehouse Sort, part for part: a copy of its numbers when this file is
 * loaded (so that a change to one game's robot object while the site runs does not touch the
 * other game; a change to Warehouse Sort's robot.ts carries over - on purpose: it is the same robot).
 */
export const LOCKER_ROOM_ROBOT: RobotConfig = {
  ...WAREHOUSE_SORT_ROBOT,
  quadRgb: { ...WAREHOUSE_SORT_ROBOT.quadRgb },
  ultrasonic: { ...WAREHOUSE_SORT_ROBOT.ultrasonic },
  frontColorSensor: { ...WAREHOUSE_SORT_ROBOT.frontColorSensor },
  gripper: { ...WAREHOUSE_SORT_ROBOT.gripper },
  noise: { ...WAREHOUSE_SORT_ROBOT.noise },
};

/** Facing right (heading 0 is up the mat, clockwise positive): along the bottom line, towards the Scan Station. */
export const START_HEADING = Math.PI / 2;

/**
 * Where a robot starts: inside the Locker Room, facing right, with the same room in front of it and
 * behind it, and its middle on the middle of the bottom line (so a robot that drives straight ahead
 * drives along that line - it starts 13 mm inside the Locker Room's frame).
 */
export function startPoseFor(config: RobotConfig): Pose {
  const { front, rear } = robotReach(config);
  // facing right, the back is at x - rear and the front at x + front
  const x = LOCKER_ROOM.x + (LOCKER_ROOM.w - (front + rear)) / 2 + rear;
  return { x, y: BOTTOM_LINE_Y, heading: START_HEADING };
}

/**
 * The start pose of this game's robot: x 77.92, y 1108.14 mm, facing right. The robot (237 mm long
 * with its open claw, 130 mm wide) then has 7.92 mm free behind it and in front of it inside the
 * Locker Room (frame included), 61.78 mm on its left (towards the top of the mat) and 61.86 mm on
 * its right. Inside the frame alone (236.01 mm) it would not fit facing right or up.
 */
export const START_POSE: Pose = startPoseFor(LOCKER_ROOM_ROBOT);
