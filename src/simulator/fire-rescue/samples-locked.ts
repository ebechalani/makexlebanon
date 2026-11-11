/**
 * The example programs for registered members only:
 *
 *   one-bucket     intermediate  deliver one bucket (default combination)
 *   one-person     intermediate  rescue one person (default combination)
 *   smart-bucket   advanced      deliver the W1 bucket for ANY combination (colour + ultrasonic sensor)
 *   full-mission   advanced      the whole match, 180 points (default combination)
 *
 * =====================================================================================
 *  THIS FILE MUST STAY ON THE SERVER.
 *
 *  A visitor's browser gets these programs only from the website's server, after a member's
 *  code was checked there (../members/unlock.ts, behind /api/simulator/unlock). So nothing that
 *  runs in the browser may import this file - not directly, and not through ./samples.ts,
 *  which brings it along. The screen takes the names and texts of these examples from
 *  ./sample-catalog.ts instead. A test (../members/client-guard.test.ts) fails when a file of
 *  the screen starts to import this one.
 * =====================================================================================
 *
 * Their names and the texts of their cards are in ./sample-catalog.ts. How the numbers were
 * found, and what the notes on the blocks are, is explained at the top of ./samples.ts.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import {
  arm,
  call,
  clawColor,
  define,
  eq,
  gripper,
  ifElse,
  ifThen,
  join,
  ledColor,
  lt,
  moveCm,
  note,
  print,
  program,
  script,
  setVar,
  turn,
  ultrasonic,
  v,
  whenStart,
  type BlockNode,
} from '../vm/builder';
import { sampleWithProgram, type SampleProgram } from './sample-catalog';
import { fetchBucketFromW1 } from './sample-pieces';

// =============================================================================================
// A piece shared by the bucket programs
// =============================================================================================

/** Lower the bucket to the mat, let go and move away (a bucket that still touches the robot does not score). */
function putDownAndLeave(): BlockNode[] {
  return [
    arm('lower'),
    gripper('open'),
    note(moveCm('backward', 10), 'Move away: a bucket that still touches the robot does not score.'),
  ];
}

// =============================================================================================
// one-bucket
// =============================================================================================

export const ONE_BUCKET_SAMPLE: SampleProgram = sampleWithProgram(
  'one-bucket',
  program([
    script(whenStart(), [
      ...fetchBucketFromW1(),
      moveCm('backward', 10),
      // across the field to building A
      note(turn('right', 90), 'Across the field to building A (top right).'),
      moveCm('forward', 62.9),
      turn('left', 90),
      note(moveCm('forward', 35.9), 'Now in front of square A1, where the person stands.'),
      // one square to the right, driving backwards
      note(turn('left', 90), 'One square to the right, driving backwards: this way the gripper never sticks out over the edge of the mat.'),
      moveCm('backward', 11),
      turn('right', 90),
      // into square A2
      note(moveCm('forward', 5.3), 'Into square A2.'),
      ...putDownAndLeave(),
    ]),
  ]),
);

// =============================================================================================
// smart-bucket
// =============================================================================================

export const SMART_BUCKET_SAMPLE: SampleProgram = sampleWithProgram(
  'smart-bucket',
  program([
    // "deliver": the robot stands in front of one square of a building, the bucket in its claw.
    // `other` says on which side the building's second square is: left or right.
    note(
      define('deliver', ['other'], [
        note(
          ifThen(lt(ultrasonic(), 20), [
            // a person is standing in this square: move over to the other one
            print('Person here - other square'),
            ifElse(
              eq(v('other'), 'right'),
              [turn('left', 90), moveCm('backward', 11), turn('right', 90)],
              [turn('right', 90), moveCm('backward', 11), turn('left', 90)],
            ),
          ]),
          'Closer than 20 cm: a person is standing in this square. The robot steps sideways to the other square, driving backwards so that the gripper stays over the mat.',
        ),
        note(moveCm('forward', 5.3), 'Into the square.'),
        ...putDownAndLeave(),
      ]),
      'The robot stands in front of one square of a building, the bucket in its claw. "other" tells on which side the second square of that building is: left or right.',
    ),

    script(whenStart(), [
      ...fetchBucketFromW1(),
      note(setVar('colour', clawColor()), 'Remember the colour of the bucket: it decides the building.'),
      print(join('Bucket: ', v('colour'))),
      moveCm('backward', 10),

      // red -> building A (top right)
      note(ifThen(eq(v('colour'), 'red'), [
        turn('right', 90),
        moveCm('forward', 62.9),
        turn('left', 90),
        moveCm('forward', 35.9),
        call('deliver', 'right'),
      ]), 'Red goes to building A (top right).'),
      // blue -> building B (top left)
      note(ifThen(eq(v('colour'), 'blue'), [
        turn('left', 90),
        moveCm('forward', 22.1),
        turn('right', 90),
        moveCm('forward', 35.9),
        call('deliver', 'left'),
      ]), 'Blue goes to building B (top left).'),
      // yellow -> building C (bottom left)
      note(ifThen(eq(v('colour'), 'yellow'), [
        turn('left', 90),
        moveCm('forward', 22.1),
        turn('left', 90),
        moveCm('forward', 27.1),
        call('deliver', 'right'),
      ]), 'Yellow goes to building C (bottom left).'),
      // green -> building D (bottom right)
      note(ifThen(eq(v('colour'), 'green'), [
        turn('right', 90),
        moveCm('forward', 62.9),
        turn('right', 90),
        moveCm('forward', 27.1),
        call('deliver', 'left'),
      ]), 'Green goes to building D (bottom right).'),
    ]),
  ]),
);

// =============================================================================================
// one-person
// =============================================================================================

export const ONE_PERSON_SAMPLE: SampleProgram = sampleWithProgram(
  'one-person',
  program([
    script(whenStart(), [
      // to building A, square 1 (arm down, claw open: that is how the robot starts)
      note(turn('right', 90), 'To building A, square 1. The robot starts with its arm down and its claw open.'),
      moveCm('forward', 42.5),
      turn('left', 90),
      note(moveCm('forward', 41.6), 'The open claw slides around the person.'),
      gripper('close'),
      note(arm('raise'), 'High enough to pass over a tower.'),
      // to rescue tower RR, coming from above
      note(turn('right', 180), 'To rescue tower RR in the lower safe zone, coming from above.'),
      moveCm('forward', 44.3),
      turn('right', 90),
      moveCm('forward', 37),
      turn('left', 90),
      note(moveCm('forward', 25.8), 'The person hangs exactly over the tower.'),
      note(arm('lower'), 'The arm stops by itself when the person stands on the tower.'),
      gripper('open'),
      note(moveCm('backward', 10), 'Move away: a person that still touches the robot does not score.'),
    ]),
  ]),
);

// =============================================================================================
// full-mission: the whole match
// =============================================================================================

const left = (): BlockNode => turn('left', 90);
const right = (): BlockNode => turn('right', 90);
const forward = (cm: number): BlockNode => moveCm('forward', cm);
const backward = (cm: number): BlockNode => moveCm('backward', cm);

/**
 * All eight missions of the default combination, one after the other: 180 points in about
 * 103 seconds of match time. Each bucket is delivered first, then the person waiting in the
 * square next to it is carried to its rescue tower, which leaves the robot close to the next
 * water tower. Two my-blocks keep it short: "pick up" and "put down".
 *
 * It hands out a complete solution, which is why it is for members only. The tests run it to
 * prove that a full score, bonus included, can be reached through blocks.
 *
 * Rules the route follows, worth knowing when you change it:
 *  - near a water tower the robot only drives straight in and straight out with the arm up
 *    (turning there would sweep the fingers through the bucket);
 *  - it turns around only where nothing is within 172 mm (the reach of the finger tips), or with
 *    the arm up where only towers are that close;
 *  - at the outer squares (x = 90 and x = 1160) it arrives backwards, so the gripper stays over
 *    the mat.
 */
export const FULL_MISSION_PROGRAM: SampleProgram = sampleWithProgram(
  'full-mission',
  program([
    note(define('pick up', [], [gripper('close'), arm('raise')]), 'Grip what is in the claw and lift it.'),
    note(
      define('put down', [], [arm('lower'), gripper('open'), moveCm('backward', 10)]),
      'Lower the arm, let go and move away: what still touches the robot does not score.',
    ),

    script(whenStart(), [
      // ---- 1. red bucket: water tower W1 -> square A2
      note(left(), '1. Red bucket: from water tower W1 to square A2.'),
      ...fetchBucketFromW1().slice(1),
      backward(10), right(), forward(62.9), left(), forward(35.9),
      left(), backward(11), right(), forward(5.3),
      call('put down'),

      // ---- 2. red person: square A1 -> rescue tower RR
      note(left(), '2. Red person: from square A1 to rescue tower RR.'),
      forward(11), right(), forward(10),
      call('pick up'),
      turn('right', 180), forward(44.3), right(), forward(37), left(), forward(25.8),
      call('put down'),

      // ---- 3. blue bucket: water tower W3 (from its right side) -> square B2
      note(backward(3.3), '3. Blue bucket: from water tower W3 (taken from its right side) to square B2.'),
      arm('raise'), right(), forward(11.6),
      gripper('close'),
      backward(6), right(), forward(15.6), left(), forward(42.4), right(), forward(41.2),
      call('put down'),

      // ---- 4. blue person: square B1 -> rescue tower RB
      note(right(), '4. Blue person: from square B1 to rescue tower RB.'),
      backward(11), left(), forward(10),
      call('pick up'),
      backward(3), right(), forward(48), right(), forward(67.1),
      call('put down'),

      // ---- 5. yellow bucket: water tower W4 (from its left side) -> square C2
      note(backward(3.1), '5. Yellow bucket: from water tower W4 (taken from its left side) to square C2.'),
      arm('raise'), left(), forward(11.4),
      gripper('close'),
      backward(6), left(), forward(15.8), left(), forward(42.4), left(), forward(32.4),
      call('put down'),

      // ---- 6. yellow person: square C1 -> rescue tower RY
      note(left(), '6. Yellow person: from square C1 to rescue tower RY.'),
      backward(11), right(), forward(10),
      call('pick up'),
      backward(32.4), left(), forward(59), left(), forward(38.3),
      call('put down'),

      // ---- 7. green bucket: water tower W2 (from below) -> square D2
      note(backward(28.3), '7. Green bucket: from water tower W2 (taken from below) to square D2.'),
      right(), forward(14.5), left(), arm('raise'), forward(9.9),
      gripper('close'),
      backward(9.9), right(), forward(22.5), right(), forward(27.1),
      right(), backward(11), left(), forward(5.3),
      call('put down'),

      // ---- 8. green person: square D1 -> rescue tower RG
      note(right(), '8. Green person: from square D1 to rescue tower RG.'),
      forward(11), left(), forward(10),
      call('pick up'),
      backward(32.4), right(), forward(48), right(), forward(38.4),
      call('put down'),

      ledColor('all', '#00ff00'),
      print('Mission complete!'),
    ]),
  ]),
);

// =============================================================================================
// The list
// =============================================================================================

/** The members' examples, in the order of the Examples window. This is what a member's code unlocks. */
export const LOCKED_SAMPLE_PROGRAMS: SampleProgram[] = [ONE_BUCKET_SAMPLE, ONE_PERSON_SAMPLE, SMART_BUCKET_SAMPLE, FULL_MISSION_PROGRAM];
