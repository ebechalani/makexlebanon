/**
 * The robot Logistique intelligente is played with: Tri d'entrepôt's mBot2, the very same object
 * (WAREHOUSE_SORT_ROBOT, imported, not copied: one robot for the three mats with white lines on
 * black). The gripper at the front (servo S1 lifts the arm, S2 opens and closes the claw), the
 * colour sensor at the claw (a cube in the claw reads yellow), the Ultrasonic Sensor 2, the Quad
 * RGB sensor looking down and set for a LIGHT line (border 70: the white lines read 100, the black
 * field 12.7; the light yellow of the patches, of the centre square and of the warehouses' 1 mm
 * border reads 85.6, a line too; the orange 64.6 does not), and the CyberPi.
 *
 * What matters for this mission (from the middle of the drive axle):
 *   - the claw's underside goes from 5 mm (arm down) to 75 mm (arm up), the block "arm to (p) %"
 *     puts it at 5 + 0.7 p mm. A stack of two is 100 mm high: with the claw's underside at 49.5 mm
 *     or more (63,58 % and up) the claw takes the top cube alone; lower (63,57 % and down) it takes
 *     the bottom cube, and the top cube comes with it (the cubes keep their riders, ./game.ts);
 *   - the finger tips reach 167 mm ahead, the chassis 70 mm behind: 237 mm with the claw open, which
 *     fits the start area (250 mm deep, 248 mm wide) either way;
 *   - the chassis (90 mm) is higher than the frame (50 mm): only the raised claw passes over it.
 */
import type { Pose, RobotConfig } from '../core/types';
import { WAREHOUSE_SORT_ROBOT, robotReach } from '../warehouse-sort/robot';
import { START_AREA, START_LINE_X } from './field';

/** Tri d'entrepôt's mBot2 (the same object as Warehouse Sort's robot). */
export const LOGISTIQUE_ROBOT: RobotConfig = WAREHOUSE_SORT_ROBOT;

/** Facing up, into the field (heading 0 is up the mat, clockwise positive). */
export const START_HEADING = 0;

/**
 * Where a robot starts (the design's Q10: one default pose; the student may move it inside the
 * start area before the match): facing up, with the same room in front of it and behind it inside
 * the start area, its middle on the middle of the stem that runs into the start area (so a robot
 * that drives straight ahead drives up the stem, towards the cross).
 */
export function startPoseFor(config: RobotConfig): Pose {
  const { front, rear } = robotReach(config);
  // facing up, the front is at y - front and the back at y + rear
  const y = START_AREA.y + (START_AREA.h - (front + rear)) / 2 + front;
  return { x: START_LINE_X, y, heading: START_HEADING };
}

/**
 * The start pose of this game's robot: x 600, y 1123.5 mm, facing up. The robot (237 mm long with
 * its open claw, 130 mm wide) then has 6.5 mm free in front of it and behind it inside the start
 * area, 59 mm on its left and on its right. Its claw's middle is at y 981.5, its line sensor at
 * y 1038.5 (45.5 mm below the end of the stem, y 993), its ultrasonic sensor's face at y 1018.5,
 * 341.5 mm from the face of the bottom stack of the cross (y 677).
 */
export const START_POSE: Pose = startPoseFor(LOGISTIQUE_ROBOT);
