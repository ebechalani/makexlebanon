/**
 * Ready-made block programs for the Fire Rescue simulator: the ones a teacher shows first.
 *
 *   hello          starter       drive, turn, LEDs, screen
 *   line-follow    starter       follow the black line with the Quad RGB sensor
 *   gripper-demo   starter       every gripper block, on the bucket of water tower W1
 *   one-bucket     intermediate  deliver one bucket (default combination)
 *   smart-bucket   advanced      deliver the W1 bucket for ANY combination (colour + ultrasonic sensor)
 *   one-person     intermediate  rescue one person (default combination)
 *   full-mission   advanced      the whole match, 180 points (default combination)
 *
 * This file only puts the lists together, for the tests. The programs themselves are in three
 * files, because not every visitor may have all of them:
 *
 *   ./sample-catalog.ts   the name, level and text of every example - no blocks
 *   ./samples-open.ts     the blocks of the three starters, open to everyone
 *   ./samples-locked.ts   the blocks of the other four, for registered members only
 *
 * =====================================================================================
 *  DO NOT IMPORT THIS FILE FROM THE SIMULATOR SCREEN (src/simulator/ui).
 *  It brings ./samples-locked.ts along, and those programs must stay on the server until a
 *  member's code was checked there. The screen imports ./sample-catalog.ts and
 *  ./samples-open.ts only. A test (../members/client-guard.test.ts) watches over this.
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and every one of them is run by the tests (integration.test.ts) on the
 * real engine with the real referee.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation.
 *
 * How the numbers were found. The mat is measured in millimetres from its top-left corner
 * (see field.ts). The default robot starts in the Fire Station at x = 625, y = 673.2, facing
 * "up" the mat, and the middle of its claw is 142 mm (14.2 cm) ahead of the middle of its axle:
 *
 *   water tower W1 (bucket)        x = 420.85  y = 426.5
 *   building A squares  A1 / A2    x = 1050 / 1160   y = 115.3      (top right)
 *   building B squares  B1 / B2    x = 90 / 200      y = 115.3      (top left)
 *   building C squares  C1 / C2    x = 90.1 / 200.1  y = 1134.8     (bottom left)
 *   building D squares  D1 / D2    x = 1050.1 / 1160.1  y = 1134.7  (bottom right)
 *   rescue tower RR                x = 680     y = 1100.2
 *
 * So "turn left, 20.4 cm" brings the robot under W1 (625 - 204 = 421), and so on. The simulated
 * robot is perfect (no wheel slip unless you switch noise on), so driving by distance alone
 * ("dead reckoning") is exact here. With only 1 % of wheel slip the distance-only programs
 * already miss two times out of three: on a real mBot2 they need sensors as well - which is what
 * the line follower and the smart bucket program start to show.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { SampleLevel, SampleProgram } from './sample-catalog';
import { FULL_MISSION_PROGRAM, ONE_BUCKET_SAMPLE, ONE_PERSON_SAMPLE, SMART_BUCKET_SAMPLE } from './samples-locked';
import { GRIPPER_DEMO_SAMPLE, HELLO_SAMPLE, LINE_FOLLOW_SAMPLE } from './samples-open';

export type { SampleLevel, SampleProgram };

/** The six programs the tests know as "the samples": the three starters and three of the members' examples. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [
  HELLO_SAMPLE,
  LINE_FOLLOW_SAMPLE,
  GRIPPER_DEMO_SAMPLE,
  ONE_BUCKET_SAMPLE,
  SMART_BUCKET_SAMPLE,
  ONE_PERSON_SAMPLE,
];

/**
 * A complete solution of the default combination (180 points). Kept out of SAMPLE_PROGRAMS, as
 * it always was; in the Examples window it is one of the members' examples.
 */
export const FULL_MISSION_SAMPLE: SampleProgram = FULL_MISSION_PROGRAM;

/** Find a sample by its id (the six samples and 'full-mission'). */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return [...SAMPLE_PROGRAMS, FULL_MISSION_SAMPLE].find((sample) => sample.id === id);
}
