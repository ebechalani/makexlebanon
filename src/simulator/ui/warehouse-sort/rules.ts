/**
 * What the "Rules" button of the Warehouse Sort simulator shows. Two parts, kept clearly apart:
 *
 *   1. WAREHOUSE_SORT_RULES - the rules of the mission ("Beginner - Warehouse Sort (MakeX
 *      Lebanon, Local)") in short, plain words, with the points as the simulator counts them.
 *   2. WAREHOUSE_SORT_ASSUMPTIONS - "What this simulator assumes": where the rules are open,
 *      where they contradict themselves, and where they differ from the printed mat. Nobody
 *      should take one of these for a rule, so they are never mixed into part 1.
 *      The full list of questions for the organiser, with the constant behind every one, is at
 *      the top of ../../warehouse-sort/game.ts (Q1 - Q15, the same numbers as in the README).
 *
 * This is the beginner category, and many students read English as a second language: short
 * sentences, plain words, nothing more certain than the rules or the simulator. Every number is
 * written from the constant that holds it, and ./rules.test.ts checks every number of every
 * sentence against the game - a number that is on no list there fails the test.
 *
 * (The referee itself is in ../../warehouse-sort/game.ts; this is only what students read.)
 */
import { TABLE_MARGIN } from '../../core/engine';
import type { RobotConfig } from '../../core/types';
import { CUBE_SIZE, FINISH_PADS, MAT_SIZE } from '../../warehouse-sort/field';
import {
  BLUE_MOVED_MM,
  BLUE_PENALTY,
  CARRY_MM,
  CUBES_TO_SORT,
  CUBE_COUNT,
  LIFT_MM,
  MATCH_DURATION,
  MAX_SCORE,
  POINTS_CLEAN,
  POINTS_DELIVER,
  POINTS_LEAVE_START,
  POINTS_PARK,
  POINTS_PICK,
  RESTART_PENALTY,
  TOUCH_MM,
  WRONG_BAY_PENALTY,
} from '../../warehouse-sort/game';
import { WAREHOUSE_SORT_ROBOT, robotReach } from '../../warehouse-sort/robot';
import type { RulesPart, RulesSection } from '../SimulatorApp';

/** mm in cm, as a sentence writes it: 40 -> "4", 1235 -> "123.5". */
const cm = (mm: number): string => String(Math.round(mm) / 10);

/** The whole robot seen from above, with its claw open: from the back of the chassis to the tips of the fingers (mm). */
export const robotLength = (config: RobotConfig): number => robotReach(config).front + robotReach(config).rear;
/** ... and across (mm). */
export const robotWidth = (config: RobotConfig): number => 2 * robotReach(config).halfWidth;

/** The rules' own "example max" (§6), which does not add up: their line items give MAX_SCORE (three cubes sorted), or ... */
export const RULES_EXAMPLE_MAX = 85;
/** ... RULES_FOUR_CUBES_MAX for the four red and green cubes of the written rules. */
export const RULES_FOUR_CUBES_MAX = POINTS_LEAVE_START + CUBE_COUNT * (POINTS_PICK + POINTS_DELIVER) + POINTS_PARK + POINTS_CLEAN;

/** The sentence under the heading of the rules window. */
export const WAREHOUSE_SORT_RULES_NOTE = 'Beginner mission of the Inspire category, MakeX Lebanon local event.';

export const WAREHOUSE_SORT_RULES: RulesSection[] = [
  {
    title: 'The mission',
    items: [
      `${CUBE_COUNT} warehouses near the corners hold one cube each. ${CUBES_TO_SORT} cubes are red or green, one is blue.`,
      'Take each red or green cube to the bay of its colour: a red cube to the red bay, a green cube to the green bay.',
      'Leave the blue cube where it is. Check the colour of a cube before you take it.',
      'At the end, park the robot on one of the two round finish pads, on the left or on the right.',
      'After the start the robot drives on its own. Nobody touches it.',
    ],
  },
  {
    title: 'The field',
    items: [
      `The mat is ${cm(MAT_SIZE)} x ${cm(MAT_SIZE)} cm. It is black, with white lines.`,
      'The white lines are only a help. The robot may drive anywhere on the mat.',
      'The start zone is in the middle of the bottom edge. The robot starts facing up.',
      'The red bay is right of the middle of the mat, the green bay left of it.',
      'Before the match the cubes are put in the warehouses: one blue, and at least one red and one green.',
    ],
  },
  {
    title: 'The match',
    items: [
      `A match lasts ${MATCH_DURATION} seconds.`,
      'At the start the whole robot is inside the start zone.',
      'The match ends when the time is up, or earlier when the team says "STOP".',
      'Then the referee looks at the field as it is.',
    ],
  },
  {
    title: `Points (${MAX_SCORE} at most)`,
    items: [
      `+${POINTS_LEAVE_START}: the robot leaves the start zone. This counts once.`,
      `+${POINTS_PICK} for each red or green cube picked up: the gripper lifts it at least ${cm(LIFT_MM)} cm, or carries it. Each cube counts once.`,
      `+${POINTS_DELIVER} for each red or green cube in the bay of its colour at the end: the whole cube inside the bay, on the mat, not touching the robot.`,
      // (the rules' own words; how the simulator reads them is in the second part)
      `-${WRONG_BAY_PENALTY} for each cube in the bay of the other colour at the end, and no points for that cube.`,
      // (what moving it costs is not decided: the second part says what the simulator does)
      'The blue cube brings no points.',
      `+${POINTS_PARK}: at the end the robot is parked on a finish pad.`,
      `+${POINTS_CLEAN}: clean run, nobody touched the robot.`,
      `All together: ${POINTS_LEAVE_START} + ${CUBES_TO_SORT} x ${POINTS_PICK} + ${CUBES_TO_SORT} x ${POINTS_DELIVER} + ${POINTS_PARK} + ${POINTS_CLEAN} = ${MAX_SCORE}.`,
    ],
  },
  {
    title: 'Restart',
    items: [
      `When a person touches the robot or a cube, it costs ${RESTART_PENALTY} points and the robot goes back to the start zone. Here the Restart button does that.`,
      'The clock keeps running.',
      `After a restart there is no clean run bonus (${POINTS_CLEAN} points).`,
      'The rules set no limit on restarts.',
    ],
  },
  {
    title: 'With equal points',
    items: ['The team with more cubes in the right bay is first. Then the team whose last correct delivery was earlier.'],
  },
];

/** The second part of the window: what the simulator had to choose because the rules do not say it, or say two things. */
export const WAREHOUSE_SORT_ASSUMPTIONS: RulesPart = {
  title: 'What this simulator assumes',
  note: 'These are not rules. The rules do not say these things, or say two different things, so the simulator had to choose.',
  sections: [
    {
      title: 'Where the rules and the mat disagree',
      items: [
        'The rules describe the mat as it is printed: the start zone on the right, the red bay above the middle. Here the whole mat is turned to the right, so the robot starts facing up.',
        'The rules say the start zone is a green area. On the mat it is the area with the yellow frame at the bottom. The simulator uses that area.',
        'The rules say the finish pads are yellow circles with a checkerboard. On the mat they are the two round pictures on the left and on the right. The simulator uses those.',
        `The rules say "park touching the circle", and later "entirely inside one circle". A pad is about ${cm(2 * Math.max(FINISH_PADS.left.rx, FINISH_PADS.left.ry))} cm across. The robot is ${cm(robotLength(WAREHOUSE_SORT_ROBOT))} cm long, so it can never be entirely inside. Here touching a pad is enough.`,
        `The rules give ${RULES_EXAMPLE_MAX} points as the example maximum. Their own points add up to ${MAX_SCORE} for ${CUBES_TO_SORT} cubes (${RULES_FOUR_CUBES_MAX} for ${CUBE_COUNT}). The simulator counts the points one by one.`,
      ],
    },
    {
      title: 'The blue cube',
      items: [
        'The written rules have only red and green cubes. This simulator adds one blue cube: the robot checks a cube, and leaves it if it is blue.',
        `The rules do not say what moving the blue cube costs. Here it costs ${BLUE_PENALTY} points, once.`,
        `"Moved" means: the robot picked it up or lifted it, even if it was put back. Or the robot holds it at the end, or it is more than ${BLUE_MOVED_MM} mm from its place.`,
        'A touch that does not move it costs nothing. In a bay the blue cube brings no points, and it is no wrong bay either.',
      ],
    },
    {
      title: 'The cubes',
      items: [
        `A cube is ${cm(CUBE_SIZE)} cm on each side and light: the robot can push it. The rules give no size.`,
        `"Carried" means: the gripper holds the cube and has moved it at least ${cm(CARRY_MM)} cm.`,
        `"Touching" means: closer than ${TOUCH_MM} mm. A claw high above a cube does not touch it.`,
        `A cube in the bay of the other colour: -${WRONG_BAY_PENALTY}, and it also loses its ${POINTS_PICK} points for picking it up. The rules say "no points for that cube".`,
        `The -${WRONG_BAY_PENALTY} is only for a cube that is completely inside the other bay. A cube that is only partly inside costs nothing.`,
        'A cube that is completely off the mat gets no points, also not the points for picking it up. The rules let the referee put it back for -5 points. The simulator does not do that: the cube stays where it is.',
        'A cube that the robot still holds is not off the mat.',
        'Cubes do not stack: a cube put down on another cube slides off it.',
      ],
    },
    {
      title: 'Times',
      items: [
        'The time of a correct delivery is the moment the cube stood in its bay, on the mat. The score sheet shows the time of the last one.',
      ],
    },
    {
      title: 'The start zone and the table',
      items: [
        'The yellow frame is part of the start zone. The robot has left the zone when a part of it is past the frame.',
        'The zone goes to the bottom edge of the mat. So a robot that drives backwards off the mat there has also left the zone.',
        `The mat lies on a table. The robot and the cubes can leave the mat, and they stop ${cm(TABLE_MARGIN)} cm outside it.`,
      ],
    },
    {
      title: 'Restarts',
      items: [
        'A cube in the gripper at a restart goes back to its own warehouse, the blue cube too. All other cubes stay where they are.',
        `If another cube stands on its square, it is put down as close as there is room. A blue cube put down more than ${BLUE_MOVED_MM} mm from its place counts as moved.`,
        'Points earned before a restart stay.',
        'The clean run bonus is given when no restart was used. The rules say no more, so a robot that never moves gets it too.',
        'The total is never below 0.',
      ],
    },
    {
      title: 'The robot',
      items: [
        `It is the mBot2 of the Fire Rescue simulator, with the gripper at the front: ${cm(robotLength(WAREHOUSE_SORT_ROBOT))} cm long and ${cm(robotWidth(WAREHOUSE_SORT_ROBOT))} cm wide. It fits inside the start zone.`,
        'Its line sensor is set for white lines on a black mat: "line" means a white line.',
        "On a real mBot2 the line sensor may first have to learn this mat. Look in Makeblock's help for the Quad RGB sensor.",
        `The colour sensor at the claw sees a cube that is at most ${cm(WAREHOUSE_SORT_ROBOT.frontColorSensor.rangeMm)} cm in front of the middle of the claw.`,
        'The robot is perfect: its wheels do not slip and its sensors make no mistakes. A real robot drifts.',
        'The CyberPi buttons work during a match. At the competition nobody may steer the robot.',
        'The "Finished" button is the team\'s "STOP". The match also ends when the program has ended and the robot stands still.',
      ],
    },
    {
      title: 'Not in the simulator',
      items: ['Damage to the field, the rules for the team at the table, and the referee putting a cube back.'],
    },
  ],
};
