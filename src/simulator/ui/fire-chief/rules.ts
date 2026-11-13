/**
 * The Fire Chief rules in a few short bullets, for the "Rules" button of the simulator.
 * (The referee itself lives in ../../fire-chief/game.ts; this is only the summary students read.)
 *
 * This is a first, short list: the four achievements with their points, the ends of an attempt
 * and the restart. The rules of the category are still a DRAFT ("timing, scoring, retries and
 * fan action are proposals pending confirmation"), and the window says so.
 *
 * What the organiser has decided since the draft is written here as a rule: a fan action counts
 * from outside the room when the fan is within 30 cm of the target (it then ends the attempt
 * with 80 points), the 30 points need no flame-sensor reading, and touching the target without
 * moving it costs nothing. What the organiser has NOT decided is said as what the simulator
 * does: how far "moved" is.
 */
import type { RulesSection } from '../SimulatorApp';

/** The sentence under the heading of the rules window. */
export const FIRE_CHIEF_RULES_NOTE =
  'These rules are a draft. The organiser can still change the points, the time, the restart and the fan action.';

export const FIRE_CHIEF_RULES: RulesSection[] = [
  {
    title: 'Points - each achievement counts once (100 in all)',
    items: [
      '10 points: the whole robot has left the START cell.',
      '20 points: the whole robot is inside the living room or the bedroom. The second room adds nothing.',
      '30 points: the robot stands still, faces the fire target and its fan is on. The fan must be at most 30 cm from the target, with no wall between them. The flame sensor does not have to show anything for these points.',
      '40 points: the fan keeps blowing at the target for 3 seconds without a break. During that time the robot must not touch the target.',
      'The referee writes down the time of every achievement. With equal points, the shorter time ranks higher.',
    ],
  },
  {
    title: 'An attempt ends when',
    items: [
      'the mission is complete: the 3-second fan action is done. It also counts from outside the room - without the 20 points for a room the attempt then ends with 80 points;',
      'the time is up: an attempt lasts at most 3 minutes;',
      'the team says "Finished";',
      'the robot moves the fire target. The attempt ends at once and the points earned before stay. Touching the target without moving it costs nothing.',
      'In the simulator, "moved" means more than 5 mm away from its place; the organiser has not given a number yet. The simulator also ends an attempt when the program has ended and the robot and the fan stand still.',
    ],
  },
  {
    title: 'Restart',
    items: [
      'One restart is allowed per attempt.',
      'The robot goes back to where it started in START and the program starts again from its first block.',
      'The points earned so far are cleared. The clock keeps running. The maze and the place of the fire stay the same.',
    ],
  },
];
