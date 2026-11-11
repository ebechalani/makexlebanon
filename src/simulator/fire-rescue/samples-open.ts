/**
 * The example programs that are open to everyone: the three starters. These travel to the
 * browser together with the simulator.
 *
 *   hello          drive, turn, LEDs, screen
 *   line-follow    follow the black line with the Quad RGB sensor
 *   gripper-demo   every gripper block, on the bucket of water tower W1
 *
 * Their names and the texts of their cards are in ./sample-catalog.ts. How the numbers were
 * found, and what the notes on the blocks are, is explained at the top of ./samples.ts.
 *
 * NEVER import ./samples-locked.ts (or ./samples.ts, which brings it along) from here: this file
 * is part of what every visitor's browser downloads.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import {
  and,
  arm,
  driveRpm,
  forever,
  gripper,
  ifElse,
  ledColor,
  lt,
  move,
  moveCm,
  note,
  or,
  print,
  probeDetects,
  program,
  script,
  stop,
  stopMotors,
  turn,
  ultrasonic,
  wait,
  whenStart,
} from '../vm/builder';
import { sampleWithProgram, type SampleProgram } from './sample-catalog';
import { fetchBucketFromW1 } from './sample-pieces';

// =============================================================================================
// 1. hello
// =============================================================================================

export const HELLO_SAMPLE: SampleProgram = sampleWithProgram(
  'hello',
  program([
    script(note(whenStart(), 'A first program. Change the numbers, the colours and the texts, then press Start again.'), [
      print('Hello MakeX!'),
      ledColor('all', '#00ff00'),
      moveCm('forward', 20),
      moveCm('backward', 20),
      turn('right', 90),
      ledColor('all', '#0000ff'),
      print('Ready for the mission'),
    ]),
  ]),
);

// =============================================================================================
// 2. line-follow
// =============================================================================================

export const LINE_FOLLOW_SAMPLE: SampleProgram = sampleWithProgram(
  'line-follow',
  program([
    script(whenStart(), [
      print('Line follower'),
      note(
        moveCm('forward', 11),
        'Out of the Fire Station first: the picture inside it has dark spots that are not a line. After this move the sensor is over the black line.',
      ),
      forever([
        note(
          ifElse(
            lt(ultrasonic(), 12),
            // the rescue towers are close ahead: stop the motors and end the program
            [stopMotors('all'), print('Safe zone reached'), stop('all')],
            [
              note(
                ifElse(
                  and(probeDetects('L1', 'line'), probeDetects('R1', 'line')),
                  [move('forward', 40)],
                  [
                    ifElse(
                      or(probeDetects('L1', 'line'), probeDetects('L2', 'line')),
                      // the line is to the left: left wheel slower, the robot curves left
                      [
                        note(
                          driveRpm(15, -40),
                          'The line is to the left: the left wheel (EM1) turns slower, so the robot curves left. EM2, the right wheel, is mounted mirrored: a negative speed drives it forward.',
                        ),
                      ],
                      [
                        ifElse(
                          or(probeDetects('R1', 'line'), probeDetects('R2', 'line')),
                          // the line is to the right: right wheel slower, the robot curves right
                          [note(driveRpm(40, -15), 'The line is to the right: the right wheel (EM2) turns slower, so the robot curves right.')],
                          // no line under the sensor: straight on until it shows up again
                          [note(move('forward', 40), 'No line under the sensor (the yellow marker): straight on until the line shows up again.')],
                        ),
                      ],
                    ),
                  ],
                ),
                'L1 and R1 are the two middle probes of the sensor. Both on the line: the robot is centred, straight on.',
              ),
            ],
          ),
          'The rescue towers are closer than 12 cm: stop the motors and end the program. Otherwise: follow the line.',
        ),
      ]),
    ]),
  ]),
);

// =============================================================================================
// 3. gripper-demo
// =============================================================================================

export const GRIPPER_DEMO_SAMPLE: SampleProgram = sampleWithProgram(
  'gripper-demo',
  program([
    script(whenStart(), [
      gripper('open'),
      ...fetchBucketFromW1(),
      moveCm('backward', 12),
      // put the bucket down on the mat ...
      note(arm('lower'), 'Put the bucket down on the mat ...'),
      gripper('open'),
      wait(1),
      // ... and pick it up again
      note(gripper('close'), '... and pick it up again, from the mat this time.'),
      arm('raise'),
      print('Got it!'),
    ]),
  ]),
);

// =============================================================================================
// The list
// =============================================================================================

/** The examples everyone may load, in the order of the Examples window. */
export const OPEN_SAMPLE_PROGRAMS: SampleProgram[] = [HELLO_SAMPLE, LINE_FOLLOW_SAMPLE, GRIPPER_DEMO_SAMPLE];
