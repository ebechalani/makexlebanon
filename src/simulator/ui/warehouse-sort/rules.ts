/**
 * What the "Rules" button of the Warehouse Sort simulator shows. Two parts, kept clearly apart:
 *
 *   1. WAREHOUSE_SORT_RULES - the rules of the mission ("Beginner - Warehouse Sort (MakeX
 *      Lebanon, Local)") in short, plain words, with the points as the simulator counts them.
 *   2. WAREHOUSE_SORT_ASSUMPTIONS - "What this simulator assumes": where the rules are open,
 *      where they contradict themselves, and where they differ from the printed mat. Nobody
 *      should take one of these for a rule, so they are never mixed into part 1.
 *      The full list of questions for the organiser, with the constant behind every one, is at
 *      the top of ../../warehouse-sort/game.ts (Q1 - Q14, the same numbers as in the README).
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
  CARRY_MM,
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

/** The rules' own "example max" (§6), which does not add up: their line items give MAX_SCORE. */
export const RULES_EXAMPLE_MAX = 85;

/** The sentence under the heading of the rules window. */
export const WAREHOUSE_SORT_RULES_NOTE = 'Beginner mission of the Inspire category, MakeX Lebanon local event.';

export const WAREHOUSE_SORT_RULES: RulesSection[] = [
  {
    title: 'The mission',
    items: [
      `${CUBE_COUNT} warehouses near the corners hold one cube each. A cube is red or green.`,
      'Take each cube to the bay of its colour: a red cube to the red bay, a green cube to the green bay.',
      'At the end, park the robot on one of the two round finish pads, at the top or at the bottom.',
      'After the start the robot drives on its own. Nobody touches it.',
    ],
  },
  {
    title: 'The field',
    items: [
      `The mat is ${cm(MAT_SIZE)} x ${cm(MAT_SIZE)} cm. It is black, with white lines.`,
      'The white lines are only a help. The robot may drive anywhere on the mat.',
      'The start zone is on the right edge of the mat.',
      'The red bay is above the middle of the mat, the green bay below it.',
      'Before the match the referee puts the cubes in the warehouses: at least one red and one green.',
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
      `+${POINTS_PICK} for each cube picked up: the gripper lifts it at least ${cm(LIFT_MM)} cm, or carries it. Each cube counts once.`,
      `+${POINTS_DELIVER} for each cube in the bay of its colour at the end: the whole cube inside the bay, standing on the mat, not touching the robot.`,
      // (the rules' own words; how the simulator reads them is in the second part)
      `-${WRONG_BAY_PENALTY} for each cube in the bay of the other colour at the end, and no points for that cube.`,
      `+${POINTS_PARK}: at the end the robot is parked on a finish pad.`,
      `+${POINTS_CLEAN}: clean run, nobody touched the robot.`,
      `All together: ${POINTS_LEAVE_START} + ${CUBE_COUNT} x ${POINTS_PICK} + ${CUBE_COUNT} x ${POINTS_DELIVER} + ${POINTS_PARK} + ${POINTS_CLEAN} = ${MAX_SCORE}.`,
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
        'The rules say the start zone is a green area. On the mat it is the area with the yellow frame on the right. The simulator uses that area.',
        'The rules say the finish pads are yellow circles with a checkerboard. On the mat they are the two round pictures at the top and at the bottom. The simulator uses those.',
        `The rules say "park touching the circle", and later "entirely inside one circle". A pad is about ${cm(2 * Math.max(FINISH_PADS.top.rx, FINISH_PADS.top.ry))} cm across. The robot is ${cm(robotLength(WAREHOUSE_SORT_ROBOT))} cm long, so it can never be entirely inside. Here touching a pad is enough.`,
        `The rules give ${RULES_EXAMPLE_MAX} points as the example maximum, but their own points add up to ${MAX_SCORE}. The simulator counts the points one by one.`,
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
        'The zone goes to the right edge of the mat. So a robot that drives backwards off the mat there has also left the zone.',
        `The mat lies on a table. The robot and the cubes can leave the mat, and they stop ${cm(TABLE_MARGIN)} cm outside it.`,
      ],
    },
    {
      title: 'Restarts',
      items: [
        'A cube in the gripper at a restart goes back to its own warehouse. All other cubes stay where they are.',
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
