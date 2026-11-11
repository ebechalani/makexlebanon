/**
 * A piece of program that several examples share. It is used by an open example (the gripper
 * demo), so it travels to the browser: nothing that only the members' examples need belongs here.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import { arm, gripper, moveCm, note, turn, type BlockNode } from '../vm/builder';

/**
 * From the Fire Station to water tower W1 and grip the bucket that stands on it.
 * The arm is raised first: the fingers then pass over the 50 mm tower, left and right of the bucket.
 */
export function fetchBucketFromW1(): BlockNode[] {
  return [
    turn('left', 90),
    note(moveCm('forward', 20.4), 'Now the robot is exactly below water tower W1.'),
    turn('right', 90),
    note(arm('raise'), 'Arm up: the fingers pass over the tower, left and right of the bucket.'),
    note(moveCm('forward', 10.4), 'The claw is around the bucket. The robot stops 3 mm before the tower.'),
    gripper('close'),
  ];
}
