/**
 * Ready-made block programs for the Warehouse Sort simulator (MakeX Lebanon, Inspire, the
 * beginner mission).
 *
 *   sort-leave-start    starter       drive by distance: out of the start zone
 *   sort-white-line     starter       follow a WHITE line on the black mat to the T at its end
 *   sort-cube-colour    starter       drive to a cube, read its colour (red, green or blue) with the colour sensor at the claw
 *   sort-one-cube       intermediate  look at the nearest cube: blue - leave it and take the next one; put the cube in the bay of its colour
 *   sort-two-cubes      intermediate  one cube of the bottom row and one of the top row, never the blue one, each to its bay, then park
 *   sort-all-cubes      advanced      look at all four cubes, leave the blue one, sort the other three and park, on any of the 24 arrangements
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other two games (../fire-rescue/samples.ts,
 *  ../fire-chief/samples.ts): a visitor's browser gets a program and the text that explains it
 *  only from the server, which decides for every request what that visitor may have. So nothing
 *  that runs in the browser (src/simulator/ui, anything with 'use client', a page of the
 *  website) may import this file - nor ./sample-catalog.ts, the list of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  blocks are here. The server hands them out from ../members/all-examples.ts, the only file
 *  that imports this one.
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of this game's palette (blocks/palettes.ts:
 * the blocks of real mBlock, and the Gripper shortcuts of Fire Rescue). Every one is run by
 * the tests (samples.test.ts) on the real engine with the real referee, on all 24 arrangements
 * of the cubes, on the vector drawing of the mat and on the picture the browser reads. What a
 * description promises is what those tests measure; the numbers are written in a comment above
 * each program.
 *
 * The blue cube. One cube of every arrangement is blue, and the robot must leave it where it is
 * (the owner of the site: "the robot checks it; if it is blue, it leaves it" - ./game.ts, Q15).
 * So every example that takes a cube LOOKS FIRST: it drives its open claw around the cube - the
 * fingers do not touch it - and reads the colour sensor at the claw before it closes the claw.
 * Blue: it backs away, and the blue cube stands exactly where it stood. No example ever moves the
 * blue cube, on any arrangement (the tests check it on all 24: its line on the score sheet is
 * "left alone", and it never moves by a single step of the engine).
 *
 * The descriptions are for beginners, many of whom read English as a second language: short
 * sentences, plain words, and nothing more certain than what the simulator really knows.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation (mBlock has comments on
 * blocks too).
 *
 * The numbers behind the programs (field.ts, robot.ts; mm from the top-left corner of the mat as
 * the screen shows it). The robot starts in the start zone in the middle of the bottom edge,
 * facing UP, at x 630.1, y 1151.1: its middle (the middle of its wheel axle, the point it turns
 * around) is on the long white line up the middle of the mat. From that point:
 *
 *   - the middle of the claw is 142 mm ahead, the tips of the fingers 167 mm, the front of the
 *     body 105 mm, the Quad RGB sensor 85 mm;
 *   - the white line at the bottom (left and right of the start zone) runs at y 1105.3: 4.6 cm
 *     forward brings the robot's middle onto it. The white line at the top runs at y 134.3;
 *   - the cubes stand in the middle of the orange squares. From the long line (x 630.1) the claw
 *     is around a cube after
 *         W1 (top left)      on the top line     y 134.3   turn left    35.1 cm
 *         W2 (top right)     on the top line     y 134.3   turn right   35.4 cm
 *         W3 (bottom left)   on the bottom line  y 1105.3  turn left    36.2 cm
 *         W4 (bottom right)  on the bottom line  y 1105.3  turn right   35.5 cm
 *     With the claw open (64 mm between the fingers) around a 40 mm cube, each finger is 12 mm
 *     from it, and the front of the body 17 mm: the robot can look at a cube without touching it;
 *   - the red bay is right of the long line (x 734.9 to 839.6, y 531.3 to 705.9), the green bay
 *     left of it (x 419.6 to 524.4, y 533.9 to 708.5). A robot on the long line that turns to a
 *     bay and drives 1.5 cm has the cube in its claw over the middle of the bay;
 *   - the two round finish pads are at the left and the right end of the middle line (y 620,
 *     x 171 and x 1090, 160 mm across).
 *
 * No example reads which way the robot points (no gyro block): they move by "forward" and "turn"
 * only, so what they do does not depend on how the mat is turned on the screen - only the names
 * of the places do. (The starters drive exactly the moves they drove before the field was turned,
 * when the robot faced left.)
 *
 * Where cubes stand in a bay. Three cubes are sorted, at least one of each colour, so at most two
 * go to one bay. They stand side by side, 6.2 cm apart, at y 68.2 and 62.0 cm (a third place at
 * 55.8 cm would fit too): the claw opens to 64 mm, and a cube next to it must stay out of the way
 * of the opening fingers (2 mm to spare). The cube at 68.2 cm is 3.8 mm from the bottom edge of
 * the red bay, 6.4 mm from that of the green bay. The whole cube must be inside the bay to score.
 *
 * Turning near the bays. The body of the robot reaches 123.5 mm from its middle while it turns
 * (a corner of the body), its rear 95.5 mm. Turning on the long line, it stays about 13 mm away
 * from a cube in either bay. The fingers reach further, so a program raises the arm before it
 * turns there: then the fingers, and a cube in them, pass over the 4 cm cubes.
 *
 * The simulated robot is perfect (no wheel slip), so driving by distance is exact here. A real
 * robot drifts: it has to correct its way with the white lines - which is what the line
 * follower starts to show. Every program that drives by distance needs the robot where the
 * simulator puts it at the start. (Measured once, in a scratch script, with wheels that slip by
 * up to 0.5 %, 1 % and 2 %, three seeds on each of the 24 arrangements - 72 matches each: the
 * advanced example kept its 80 points in 44 %, 25 % and 10 % of the matches, the two-cube example
 * its 60 points in 44 %, 25 % and 11 %, the one-cube example its 30 points in 99 %, 89 % and
 * 50 %; the three starters never lost a point. A robot that drifts can also push the blue cube
 * with its fingers: that happened in 2, 8 and 13 of the 72 advanced matches, in 1, 3 and 7 of the
 * two-cube ones and in 0, 0 and 4 of the one-cube ones.)
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { ProgramJson } from '../core/types';
import {
  and,
  arm,
  call,
  changeVar,
  clawColor,
  clawColorIs,
  clawObjectDetected,
  define,
  eq,
  gripper,
  ifElse,
  ifThen,
  join,
  ledColor,
  lineStatusIs,
  lt,
  move,
  moveCm,
  note,
  print,
  probeDetects,
  program,
  repeatUntil,
  script,
  setVar,
  stopMotors,
  sub,
  turn,
  v,
  waitUntil,
  whenStart,
  type BlockNode,
  type DefinitionNode,
} from '../vm/builder';
import { exampleCard, type ExampleLevel } from './sample-catalog';

export type SampleLevel = ExampleLevel;

export interface SampleProgram {
  /** stable name, used in links and tests */
  id: string;
  title: string;
  level: SampleLevel;
  /** what the program does, what it scores and what to try next, in a few short sentences */
  description: string;
  program: ProgramJson;
}

// =============================================================================================
// Numbers the programs share (the tests read them too)
// =============================================================================================

/** The first starter drives this far (cm). Any part of the robot outside the start zone is enough: 1.4 cm already is. */
export const LEAVE_CM = 30;
/** From the start, this far forward (cm) puts the robot's middle on the white line at the bottom (y 1105.3 mm). */
export const TO_BOTTOM_LINE_CM = 4.6;
/**
 * The line follower drives this far (cm) before it looks at the line: its sensor is then past
 * the yellow frame of the start zone. Yellow is light, so the sensor counts the frame as line
 * (robot.ts), and the frame crosses the white line there.
 */
export const PAST_THE_FRAME_CM = 7;
/** The line follower: speed straight on, and speed of a turn on the spot (RPM). */
export const FOLLOW_RPM = 40;
export const STEER_RPM = 20;
/** The colour starter drives at a cube at this speed (RPM) until the colour sensor at the claw sees it. */
export const TO_CUBE_RPM = 40;
/** From the long line to the cube of each warehouse (cm, see the table above). */
export const PICK_CM = { W1: 35.1, W2: 35.4, W3: 36.2, W4: 35.5 } as const;
/** Where the robot's middle is at the start, and where the two white lines across the mat are: cm from the top edge of the mat. */
export const START_Y_CM = 115.1;
export const BOTTOM_LINE_Y_CM = 110.5;
export const TOP_LINE_Y_CM = 13.4;
/** From the white line at the bottom (y 110.5 cm) up the long line to the white line at the top (y 13.4 cm). */
export const UP_TO_TOP_LINE_CM = 97.1;
/** The places for cubes in a bay (cm from the top edge of the mat): the first one, and the step to the next. */
export const FIRST_PLACE_Y_CM = 68.2;
export const PLACE_STEP_CM = 6.2;
/** From the long line this far (cm) towards a bay: the cube in the claw is over the middle of the bay. */
export const INTO_BAY_CM = 1.5;
/**
 * Parking: on the long line at this y (cm) the robot is below the green bay; this far to the
 * left (cm) it is level with the middle of the left pad; a quarter turn to the right then puts
 * its claw over the pad.
 */
export const PARK_Y_CM = 79;
export const PARK_LEFT_CM = 45.9;

const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE =
  'This program drives by distance. The robot of the simulator drives exactly. A real robot drifts a little: there, use the white lines to correct the way.';

/** On "moves forward" towards a cube with the open claw. */
const AROUND_THE_CUBE_NOTE = 'The claw is open: its fingers end up on both sides of the cube, without touching it.';

/** On the block that asks whether the cube in the claw is blue. */
const LOOK_FIRST_NOTE = 'Look first! The colour sensor at the claw sees the cube between the fingers. A blue cube must stay where it is.';

/** On "moves backward" away from a blue cube. */
const LEAVE_BLUE_NOTE = 'Back to the long line. The claw was never closed: the blue cube stays exactly where it is.';

/** On "arm raises" with a cube in the claw. */
const PICKED_NOTE = 'The cube is lifted more than 1 cm: +5 points (a cube is picked once).';

// =============================================================================================
// My-blocks shared by several programs
// =============================================================================================

/**
 * "put the cube down": the robot stands on the long line and faces a bay, the cube in its claw,
 * the arm up. In, down, open, out - and the arm goes up again before the robot turns.
 */
function putTheCubeDown(): DefinitionNode {
  return note(
    define('put the cube down', [], [
      note(moveCm('forward', INTO_BAY_CM), 'Now the cube is over the middle of the bay.'),
      note(arm('lower'), 'The arm stops when the cube stands on the mat.'),
      gripper('open'),
      note(moveCm('backward', INTO_BAY_CM), 'Back onto the long line. The open fingers do not touch the cube.'),
      note(
        arm('raise'),
        'Arm up before the robot turns: the fingers pass over the cubes in the bays. Down low, they would hit them.',
      ),
    ]),
    'The robot faces a bay, with the cube in its claw. It puts the cube down in the bay and leaves it there.',
  );
}

/** "take the cube": the arm is down and the open claw is around a cube that is not blue. Grip it, lift it and remember its colour. */
function takeTheCube(): DefinitionNode {
  return note(
    define('take the cube', [], [
      gripper('close'),
      note(arm('raise'), PICKED_NOTE),
      note(setVar('colour', clawColor()), 'The colour sensor at the claw sees the cube the robot holds. "colour" is now red or green.'),
    ]),
    'The arm is down and the open claw is around a cube that is not blue. Grip it, lift it, and keep its colour in "colour".',
  );
}

/**
 * "to its bay": the robot stands on the long line between the bays, facing up, the cube up in
 * its claw. Red bay to the right, green bay to the left - and back to facing up.
 */
function toItsBay(): DefinitionNode {
  return note(
    define('to its bay', [], [
      ifElse(
        eq(v('colour'), 'red'),
        [note(turn('right', 90), 'Red: the red bay is right of the long line.'), call('put the cube down'), turn('left', 90)],
        [note(turn('left', 90), 'Green: the green bay is left of the long line.'), call('put the cube down'), turn('right', 90)],
      ),
    ]),
    'The robot stands on the long line between the bays, facing up. "colour" decides the bay. Afterwards it faces up again.',
  );
}

// =============================================================================================
// 1. sort-leave-start
// =============================================================================================
// Measured (samples.test.ts): 10 points on all 24 arrangements (5 for leaving the start zone,
// 5 for the clean run), the program ends after 1.85 s; no cube moves, the blue one is "left
// alone". The claw is out of the start zone after 1.4 cm (13.9 mm of room in front of the
// robot): from 1.4 cm on the drive earns the 5 points, with 1.3 cm it does not.

const leaveStart: SampleProgram = {
  ...exampleCard('sort-leave-start'),
  description:
    `The robot drives ${LEAVE_CM} cm forward, up out of the start zone, and stops. ` +
    'Then its LEDs turn green and its screen says so. ' +
    'It scores 10 points on every arrangement of the cubes: 5 for leaving the start zone, and 5 for a clean run (no restart). ' +
    'It ends after 2 seconds. ' +
    'Try a smaller number than 30. How short can the drive be, and still earn the 5 points?',
  program: program([
    script(note(whenStart(), 'A first program. Change the numbers, then press Start again.'), [
      print('Go!'),
      note(moveCm('forward', LEAVE_CM), 'The robot faces up, into the field. A part of the robot outside the start zone: +5 points.'),
      ledColor('all', GREEN),
      print('Out of the zone'),
    ]),
  ]),
};

// =============================================================================================
// 2. sort-white-line
// =============================================================================================
// Measured (samples.test.ts), on the vector drawing of the mat and on the picture the browser
// reads: 10 points on all 24 arrangements (leave the start zone, clean run); the program ends at
// the T after 3.17 s (3.18 s on the picture), the robot's middle at most 0.25 mm beside the line.
// The claw is open and stops short of the cube of W4: the tips of the fingers 6.2 mm (4.9 mm on
// the picture) before the near face of the cube - blue or not, it is never touched. Started 2.5
// or 5 degrees crooked and up to 1 cm beside the long line (still in the start zone), it stops at
// the T every time: at most 4.6 mm beside the line, the finger tips 4.8 to 7.4 mm before the cube
// (4.3 to 5.6 mm on the picture), after 3.1 to 3.6 s. The try of the description (turn left
// instead of right) follows the white line left of the start zone to its T: 10 points, the finger
// tips 4.0 mm (2.7 mm on the picture) before the cube of W3.

const whiteLine: SampleProgram = {
  ...exampleCard('sort-white-line'),
  description:
    'A line follower for this mat. Here the lines are WHITE on a black mat. ' +
    'The robot drives onto the white line at the bottom and follows it to the right with the Quad RGB sensor. ' +
    'Both middle probes (L1 and R1) see the line: straight on. Only L1: turn left a little. Only R1: turn right a little. ' +
    'At the T at the end of the line all four probes see white, and the robot stops. ' +
    'It scores 10 points on every arrangement (leave the start zone, clean run), after 3 seconds. ' +
    'It does not touch the cube in front of it. ' +
    'Try the line on the left of the start zone: turn left instead of right.',
  program: program([
    script(note(whenStart(), 'On this mat the line is white. The robot of the simulator knows that: "detects line" means white here.'), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), 'Onto the white line at the bottom of the field.'),
      turn('right', 90),
      note(
        moveCm('forward', PAST_THE_FRAME_CM),
        'Out of the start zone first. Its yellow frame is light too: the sensor would take it for a T.',
      ),
      note(
        repeatUntil(lineStatusIs(15), [
          ifElse(
            and(probeDetects('L1', 'line'), probeDetects('R1', 'line')),
            [note(move('forward', FOLLOW_RPM), 'L1 and R1 are the two middle probes. Both on the line: straight on.')],
            [
              ifElse(
                probeDetects('L1', 'line'),
                [note(move('left', STEER_RPM), 'The line is under the left probe: turn left a little.')],
                [ifThen(probeDetects('R1', 'line'), [note(move('right', STEER_RPM), 'The line is under the right probe: turn right a little.')])],
              ),
            ],
          ),
        ]),
        'Until all four probes see white (status 15): the T at the end of the line.',
      ),
      stopMotors('all'),
      ledColor('all', GREEN),
      print('T found!'),
    ]),
  ]),
};

// =============================================================================================
// 3. sort-cube-colour
// =============================================================================================
// Measured (samples.test.ts): on all 24 arrangements the screen shows the colour of the cube of
// W3 - "red", "green" or "blue" - and the LEDs light in that colour; 10 points (leave the start
// zone, clean run); the program ends after 3.27 s. The robot stops with the tips of its open
// fingers 7.0 mm before the near face of the cube: it never touches it, so the blue cube is
// "left alone". (The colour sensor at the claw sees a cube up to 3.5 cm beyond the middle of the
// claw: the sensor of Fire Rescue, an assumption of the simulator - core/robot.ts.)
// The try (turn right instead of left) reads the cube of W4 in the same way, on all 24
// arrangements (finger tips 7.8 mm before the cube), and shows all three colours too.

const cubeColour: SampleProgram = {
  ...exampleCard('sort-cube-colour'),
  description:
    'The robot drives to the white line at the bottom and turns left, to the warehouse at the bottom left. ' +
    'It drives slowly at the cube there, until the colour sensor at the claw sees it. Then it stops. ' +
    'The screen shows the colour of the cube: red, green or blue. The LEDs light in that colour. ' +
    'It always shows the right colour, on every arrangement. It does not touch the cube. ' +
    'It scores 10 points (leave the start zone, clean run), after 3 seconds. ' +
    'Try the cube at the bottom right: turn right instead of left.',
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), 'Onto the white line at the bottom of the field.'),
      note(turn('left', 90), 'Now the robot faces left, to the warehouse at the bottom left.'),
      note(move('forward', TO_CUBE_RPM), 'Slowly: the robot must stop before it touches the cube.'),
      note(
        waitUntil(clawObjectDetected()),
        'Wait until the colour sensor at the claw sees something. In this simulator it sees a cube up to 3.5 cm in front of the middle of the claw.',
      ),
      stopMotors('all'),
      print(join('Cube: ', clawColor())),
      note(
        ifElse(
          clawColorIs('red'),
          [ledColor('all', RED)],
          [ifElse(clawColorIs('green'), [ledColor('all', GREEN)], [ledColor('all', BLUE)])],
        ),
        'A cube is red, green or blue: not red and not green means blue.',
      ),
    ]),
  ]),
};

// =============================================================================================
// 4. sort-one-cube
// =============================================================================================
// Measured (samples.test.ts): 30 points on all 24 arrangements (leave the start zone 5, one cube
// picked 5, in the bay of its colour 15, clean run 5), and the blue cube is never moved.
//   - W4 not blue (18 arrangements): it takes the cube of W4; picked at 3.35 s, in its bay from
//     10.35 s on, the program ends after 11.19 s.
//   - W4 blue (6 arrangements): the open claw goes around the blue cube - each finger 12 mm from
//     it - the sensor reads "blue", the robot backs away and takes the cube of W3 instead: picked
//     at 8.83 s, in its bay from 15.87 s on, the program ends after 16.71 s. The blue cube has not
//     moved at all.
// The cube stands at y 682.0 mm: 3.8 mm from the bottom edge of the red bay, 6.4 mm from the
// bottom edge of the green bay, about 32 mm from its left and right edge. Nothing else moves.
// The try (park on a pad at the end: turn back to face up, 10.8 cm backward, turn left, 45.9 cm,
// turn right - the moves of "Two cubes, then park") scores 40 on all 24 arrangements.

const oneCube: SampleProgram = {
  ...exampleCard('sort-one-cube'),
  description:
    'The robot drives to the cube at the bottom right, with its claw open around it. ' +
    'First it looks: the colour sensor at the claw reads the cube. ' +
    'Blue: the robot leaves it where it is and takes the cube at the bottom left instead. ' +
    'It grips the cube and lifts it. Then it drives up the long white line, between the two bays. ' +
    'Red: it turns to the red bay. Green: it turns to the green bay. There it puts the cube down. ' +
    'It scores 30 points on every arrangement, after 11 to 17 seconds. It never moves the blue cube. ' +
    'Try to park on a finish pad at the end, for 10 more points.',
  program: program([
    takeTheCube(),
    putTheCubeDown(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), 'Onto the white line at the bottom of the field.'),
      note(turn('right', 90), 'Now the robot faces right, to the warehouse at the bottom right.'),
      note(moveCm('forward', PICK_CM.W4), AROUND_THE_CUBE_NOTE),
      note(
        ifElse(
          clawColorIs('blue'),
          [
            print('Blue: leave it'),
            note(moveCm('backward', PICK_CM.W4), LEAVE_BLUE_NOTE),
            note(turn('left', 180), 'Now the robot faces left, to the warehouse at the bottom left. Its cube is not blue: only one cube is.'),
            note(moveCm('forward', PICK_CM.W3), AROUND_THE_CUBE_NOTE),
            call('take the cube'),
            moveCm('backward', PICK_CM.W3),
            note(turn('right', 90), 'Facing up, on the long white line.'),
          ],
          [call('take the cube'), moveCm('backward', PICK_CM.W4), note(turn('left', 90), 'Facing up, on the long white line.')],
        ),
        LOOK_FIRST_NOTE,
      ),
      print(join('Cube: ', v('colour'))),
      note(moveCm('forward', 42.3), 'Now the robot is between the two bays: the red one on the right, the green one on the left.'),
      note(ifElse(eq(v('colour'), 'red'), [turn('right', 90)], [turn('left', 90)]), 'The colour decides the bay: red right, green left.'),
      call('put the cube down'),
    ]),
  ]),
};

// =============================================================================================
// 5. sort-two-cubes
// =============================================================================================
// Measured (samples.test.ts): 60 points on all 24 arrangements (leave the start zone 5, two
// cubes picked 10, both in the bay of their colour 30, parked on the left pad 10, clean run 5),
// and the blue cube is never moved. One cube comes from the bottom row (W4, or W3 where W4 is
// blue), one from the top row (W2, or W1 where W2 is blue): a row has at most one blue cube, so
// each row always has a cube to take. The program ends after 32.43 s (blue in W1 or W3), 37.83 s
// (blue in W2) or 37.95 s (blue in W4); the second cube is put down at 25.99, 31.39 or 31.51 s.
// The bottom cube stands at y 682 mm, the top one at y 620 mm, so two cubes of one colour stand
// side by side. Nothing is pushed.
// The try (park on the right pad: turn right, 45.9 cm, turn left) also scores 60 everywhere.

/**
 * "take a cube from this row": the robot stands on the long line, on the white line across the
 * bottom or the top of the mat, facing up. It looks at the cube on the right; blue - it leaves it
 * and takes the cube on the left. Afterwards it stands where it began, facing up, the cube up in
 * its claw.
 */
function takeACubeFromThisRow(): DefinitionNode {
  return note(
    define('take a cube from this row', ['right cm', 'left cm'], [
      note(turn('right', 90), 'To the warehouse on the right of this row.'),
      note(moveCm('forward', v('right cm')), AROUND_THE_CUBE_NOTE),
      note(arm('lower'), 'The open fingers come down around the cube. Now the colour sensor at the claw can see it.'),
      note(
        ifElse(
          clawColorIs('blue'),
          [
            note(moveCm('backward', v('right cm')), LEAVE_BLUE_NOTE),
            note(turn('left', 180), 'To the warehouse on the left of this row. Its cube is not blue: only one cube is.'),
            moveCm('forward', v('left cm')),
            call('take the cube'),
            moveCm('backward', v('left cm')),
            turn('right', 90),
          ],
          [call('take the cube'), moveCm('backward', v('right cm')), turn('left', 90)],
        ),
        LOOK_FIRST_NOTE,
      ),
    ]),
    'On the white line across a row, facing up. Take the cube on the right - or, if it is blue, the cube on the left. Then face up again.',
  );
}

const twoCubes: SampleProgram = {
  ...exampleCard('sort-two-cubes'),
  description:
    'Two cubes, then park. The robot takes one cube from the bottom row and one from the top row. ' +
    'In each row it looks at the cube on the right first. Blue: it leaves it and takes the cube on the left. ' +
    'Each cube goes to the bay of its colour. Two cubes of one colour stand side by side. ' +
    'At the end the robot parks on the left finish pad. ' +
    'It scores 60 points on every arrangement, after 32 to 38 seconds. It never moves the blue cube. ' +
    'Try to park on the right pad instead.',
  program: program([
    takeTheCube(),
    putTheCubeDown(),
    toItsBay(),
    takeACubeFromThisRow(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_BOTTOM_LINE_CM), 'Onto the white line at the bottom of the field.'),
      note(call('take a cube from this row', PICK_CM.W4, PICK_CM.W3), 'The bottom row: W4 on the right, W3 on the left.'),
      note(moveCm('forward', 42.3), 'Up the long line, to the first place in a bay.'),
      call('to its bay'),
      note(moveCm('forward', 54.8), 'Up to the white line at the top.'),
      note(call('take a cube from this row', PICK_CM.W2, PICK_CM.W1), 'The top row: W2 on the right, W1 on the left.'),
      note(
        moveCm('backward', 48.6),
        'Back down the long line, to a second place: if both cubes have the same colour, they stand side by side.',
      ),
      call('to its bay'),
      note(
        moveCm('backward', Number((PARK_Y_CM - FIRST_PLACE_Y_CM + PLACE_STEP_CM).toFixed(1))),
        'Down the long line, below the bays: the cubes in the green bay are not in the way to the left.',
      ),
      note(turn('left', 90), 'Now the robot faces left.'),
      note(moveCm('forward', PARK_LEFT_CM), 'Level with the middle of the left pad.'),
      note(turn('right', 90), 'The claw and the front of the robot are over the pad: +10 points at the end.'),
    ]),
  ]),
};

// =============================================================================================
// 6. sort-all-cubes
// =============================================================================================
// How it works: the long white line is the robot's road. On it the robot always faces up and
// knows where it is ("robot y", cm from the top edge of the mat), so the my-block "drive on the
// long line to" can go forward or backward. From the white line across the top or the bottom it
// goes to a cube, right or left, with the claw open; the colour sensor at the claw reads the cube
// before the claw closes. Blue: the claw stays open and the robot backs away. Red or green: it
// takes the cube to the bay of that colour; "red place" and "green place" are where the next
// cube goes in each bay (68.2, then 62.0 cm). It never assumes an arrangement: every decision is
// the colour the sensor reads.
// Measured (samples.test.ts): 80 points on all 24 arrangements (the most there is), every red
// and green cube in the bay of its colour, the blue cube never moved, nothing pushed, never a
// cube touched except the one in the claw. The program ends after 53.51 to 60.84 s (58.06 s on
// the default arrangement, GR-BR); the last cube is put down at 41.58 to 54.40 s (the time of the
// tie-breaker). Every one of the 24 orders of the four warehouses (the try of the description)
// also scores 80 on all 24 arrangements (measured once, in a scratch script: 576 matches, 53.5 to
// 65.9 s; the fastest orders take the two cubes of the bottom row first: 53.5 to 60.1 s); the
// tests play three of them.

/** "drive on the long line to" y: forward when the place is higher up the mat, backward when it is lower. */
function driveOnTheLongLine(): DefinitionNode {
  return note(
    define('drive on the long line to', ['y'], [
      ifElse(
        lt(v('y'), v('robot y')),
        [moveCm('forward', sub(v('robot y'), v('y')))],
        [moveCm('backward', sub(v('y'), v('robot y')))],
      ),
      setVar('robot y', v('y')),
    ]),
    'On the long white line the robot always faces up. "robot y" is where it is: cm from the top edge of the mat. To get to y it drives forward (up) or backward (down).',
  );
}

/**
 * "look at the cube": from the long line to a warehouse, right or left, with the claw open
 * around the cube; read its colour; take it unless it is blue; and back.
 */
function lookAtTheCube(): DefinitionNode {
  return note(
    define('look at the cube', ['line y', 'way', 'cm'], [
      call('drive on the long line to', v('line y')),
      ifElse(eq(v('way'), 'right'), [turn('right', 90)], [turn('left', 90)]),
      note(moveCm('forward', v('cm')), AROUND_THE_CUBE_NOTE),
      note(arm('lower'), 'The open fingers come down around the cube. Now the colour sensor at the claw can see it.'),
      note(setVar('colour', clawColor()), 'Look first! "colour" is now red, green or blue.'),
      note(
        ifElse(eq(v('colour'), 'blue'), [print('Blue: leave it')], [gripper('close')]),
        'Blue: the claw stays open, the blue cube stays where it is. Red or green: grip it.',
      ),
      note(arm('raise'), 'With a red or green cube in the claw: it is lifted, +5 points. With a blue cube: the open fingers go up, the cube stays.'),
      moveCm('backward', v('cm')),
      note(ifElse(eq(v('way'), 'right'), [turn('left', 90)], [turn('right', 90)]), 'Facing up on the long line again.'),
    ]),
    'Look at a cube: drive on the long line to the white line of its row ("line y"), turn right or left ("way"), drive "cm" to the cube, read it, take it unless it is blue, and come back.',
  );
}

/** "bring it to its bay": to the next free place of the bay of "colour", and put the cube there. A blue cube was not taken. */
function bringItToItsBay(): DefinitionNode {
  return note(
    define('bring it to its bay', [], [
      ifThen(eq(v('colour'), 'red'), [
        call('drive on the long line to', v('red place')),
        note(turn('right', 90), 'The red bay is right of the long line.'),
        call('put the cube down'),
        turn('left', 90),
        note(changeVar('red place', -PLACE_STEP_CM), 'The next red cube stands 6.2 cm higher up.'),
      ]),
      ifThen(eq(v('colour'), 'green'), [
        call('drive on the long line to', v('green place')),
        note(turn('left', 90), 'The green bay is left of the long line.'),
        call('put the cube down'),
        turn('right', 90),
        note(changeVar('green place', -PLACE_STEP_CM), 'The next green cube stands 6.2 cm higher up.'),
      ]),
    ]),
    'The colour the sensor read decides the bay. In each bay the cubes stand side by side. Blue goes to no bay: the robot did not take it.',
  );
}

/** The four "look at the cube" + "bring it to its bay" of the start script, in the order bottom right, top right, top left, bottom left. */
function visitEveryWarehouse(): BlockNode[] {
  return [
    note(call('look at the cube', BOTTOM_LINE_Y_CM, 'right', PICK_CM.W4), 'Bottom right (W4). The white line at the bottom is at 110.5 cm.'),
    call('bring it to its bay'),
    note(call('look at the cube', TOP_LINE_Y_CM, 'right', PICK_CM.W2), 'Top right (W2). The white line at the top is at 13.4 cm.'),
    call('bring it to its bay'),
    note(call('look at the cube', TOP_LINE_Y_CM, 'left', PICK_CM.W1), 'Top left (W1).'),
    call('bring it to its bay'),
    note(call('look at the cube', BOTTOM_LINE_Y_CM, 'left', PICK_CM.W3), 'Bottom left (W3).'),
    call('bring it to its bay'),
  ];
}

const allCubes: SampleProgram = {
  ...exampleCard('sort-all-cubes'),
  description:
    'The whole mission, for every arrangement. The robot goes to the four warehouses one after the other: bottom right, top right, top left, bottom left. ' +
    'At each one it puts its open claw around the cube and reads the colour. ' +
    'Blue: it leaves the cube where it is. Red or green: it brings the cube to the bay of that colour. ' +
    'It never guesses a colour. ' +
    '"red place" and "green place" say where the next cube goes in each bay. At the end it parks on the left pad. ' +
    'It scores 80 points on all 24 arrangements, in 53 to 61 of the 90 seconds. It never moves the blue cube. ' +
    'Try another order of the four warehouses. Which order is the fastest?',
  program: program([
    driveOnTheLongLine(),
    lookAtTheCube(),
    putTheCubeDown(),
    bringItToItsBay(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(setVar('robot y', START_Y_CM), 'At the start the robot is here on the long line: 115.1 cm from the top edge.'),
      note(setVar('red place', FIRST_PLACE_Y_CM), 'The first place in each bay is at 68.2 cm.'),
      setVar('green place', FIRST_PLACE_Y_CM),
      ...visitEveryWarehouse(),
      note(call('drive on the long line to', PARK_Y_CM), 'Below the bays: the cubes in the green bay are not in the way to the left.'),
      note(turn('left', 90), 'Now the robot faces left.'),
      note(moveCm('forward', PARK_LEFT_CM), 'Level with the middle of the left pad.'),
      note(turn('right', 90), 'The claw and the front of the robot are over the pad: +10 points at the end.'),
    ]),
  ]),
};

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Warehouse Sort, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [leaveStart, whiteLine, cubeColour, oneCube, twoCubes, allCubes];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
