/**
 * Ready-made block programs for the Warehouse Sort simulator (MakeX Lebanon, Inspire, the
 * beginner mission).
 *
 *   sort-leave-start    starter       drive by distance: out of the start zone
 *   sort-white-line     starter       follow a WHITE line on the black mat to the T at its end
 *   sort-cube-colour    starter       drive to a cube, read its colour with the colour sensor at the claw
 *   sort-one-cube       intermediate  take the nearest cube, read its colour, put it in the bay of that colour
 *   sort-two-cubes      intermediate  the two cubes on the right, each to its bay, then park on a pad
 *   sort-all-cubes      advanced      all four cubes to their bays and park, on any of the 14 arrangements
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
 * the tests (samples.test.ts) on the real engine with the real referee, on all 14 arrangements
 * of the cubes, on the vector drawing of the mat and on the picture the browser reads. What a
 * description promises is what those tests measure; the numbers are written in a comment above
 * each program.
 *
 * The descriptions are for beginners, many of whom read English as a second language: short
 * sentences, plain words, and nothing more certain than what the simulator really knows.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation (mBlock has comments on
 * blocks too).
 *
 * The numbers behind the programs (field.ts, robot.ts; mm from the top-left corner of the mat).
 * The robot starts in the start zone on the right, facing LEFT, at x 1151.1, y 604.9: its middle
 * (the middle of its wheel axle, the point it turns around) is on the long white line across
 * the mat. From that point:
 *
 *   - the middle of the claw is 142 mm ahead, the tips of the fingers 167 mm, the front of the
 *     body 105 mm, the Quad RGB sensor 85 mm;
 *   - the white line on the right (above and below the start zone) runs at x 1105.3: 4.6 cm
 *     forward brings the robot's middle onto it;
 *   - the cubes stand in the middle of the orange squares, and from the long line (y 604.9) the
 *     claw is around a cube after
 *         W1 (top left)      x 134.3   up    35.4 cm      (the line on the left is at x 134.3)
 *         W2 (top right)     x 1105.3  up    35.5 cm
 *         W3 (bottom left)   x 134.3   down  35.1 cm
 *         W4 (bottom right)  x 1105.3  down  36.2 cm
 *   - the red bay is above the long line (y 395.3 to 500.1), the green bay below it (y 710.5 to
 *     815.3), both from about x 534 to 706. A robot on the long line that turns to a bay and
 *     drives 1.5 cm has the cube in its claw over the middle of the bay;
 *   - the two round finish pads are at the top and the bottom of the middle line (x 620,
 *     y 144 and y 1064, 160 mm across).
 *
 * Where cubes stand in a bay. Up to three cubes can go to one bay (at least one cube has the
 * other colour). They stand side by side, 6.2 cm apart, at x 68.2, 62.0 and 55.8 cm: the claw
 * opens to 64 mm, and a cube next to it must stay out of the way of the opening fingers (2 mm
 * to spare). The outer cubes are 3.8 mm (red bay) and 4.2 mm (green bay) from the edge of the
 * bay. The whole cube must be inside the bay to score.
 *
 * Turning near the bays. The body of the robot reaches 123.5 mm from its middle while it turns
 * (a corner of the body), its rear 95.5 mm. Turning on the long line, it stays about 13 mm away
 * from a cube in either bay (measured: 13.0 mm at the least). The fingers reach further, so a
 * program raises the arm before it turns: then the fingers, and a cube in them, pass over the
 * 4 cm cubes.
 *
 * The simulated robot is perfect (no wheel slip), so driving by distance is exact here. A real
 * robot drifts: it has to correct its way with the white lines - which is what the line
 * follower starts to show. Every program that drives by distance needs the robot where the
 * simulator puts it at the start. (Measured once, in a scratch script, with wheels that slip by
 * up to 0.5 %, 1 % and 2 %, three seeds on each of the 14 arrangements: the advanced example
 * kept its 100 points in 45 %, 24 % and 7 % of the matches, the two-cube example its 60 points
 * in 98 %, 81 % and 33 %, the one-cube example its 30 points in 98 %, 90 % and 52 %; the three
 * starters never lost a point.)
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
/** From the start, this far forward (cm) puts the robot's middle on the white line on the right (x 1105.3 mm). */
export const TO_RIGHT_LINE_CM = 4.6;
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
export const PICK_CM = { W1: 35.4, W2: 35.5, W3: 35.1, W4: 36.2 } as const;
/** Where the robot's middle is at the start, and where the two white lines at the sides are: cm from the left edge of the mat. */
export const START_X_CM = 115.1;
export const RIGHT_LINE_X_CM = 110.5;
export const LEFT_LINE_X_CM = 13.4;
/** The places for cubes in a bay (cm from the left edge of the mat): the first one, and the step to the next. */
export const FIRST_PLACE_X_CM = 68.2;
export const PLACE_STEP_CM = 6.2;
/** From the long line this far (cm) towards a bay: the cube in the claw is over the middle of the bay. */
export const INTO_BAY_CM = 1.5;
/**
 * Parking: on the long line at this x (cm) the robot is right of the green bay; this far down
 * (cm) it is level with the middle of the bottom pad; a quarter turn to the right then puts its
 * claw over the pad.
 */
export const PARK_X_CM = 79;
export const PARK_DOWN_CM = 45.9;

const RED = '#ff0000';
const GREEN = '#00ff00';

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE =
  'This program drives by distance. The robot of the simulator drives exactly. A real robot drifts a little: there, use the white lines to correct the way.';

/** On "moves forward" towards a cube with the open claw. */
const AROUND_THE_CUBE_NOTE = 'The arm is down and the claw is open: the fingers slide around the cube.';

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

/** "take the cube": the open claw is around a cube. Grip it, lift it and remember its colour. */
function takeTheCube(): DefinitionNode {
  return note(
    define('take the cube', [], [
      note(arm('lower'), 'The arm must be down to grip a cube on the mat.'),
      gripper('close'),
      note(arm('raise'), PICKED_NOTE),
      note(
        setVar('colour', clawColor()),
        'The colour sensor at the claw sees the cube the robot holds. "colour" is now red or green.',
      ),
    ]),
    'The open claw is around a cube. Grip it, lift it, and keep its colour in the variable "colour".',
  );
}

/**
 * "to its bay": the robot stands on the long line between the bays, facing left, the cube up in
 * its claw. Red bay up, green bay down - and back to facing left.
 */
function toItsBay(): DefinitionNode {
  return note(
    define('to its bay', [], [
      ifElse(
        eq(v('colour'), 'red'),
        [note(turn('right', 90), 'Red: the red bay is above the long line.'), call('put the cube down'), turn('left', 90)],
        [note(turn('left', 90), 'Green: the green bay is below the long line.'), call('put the cube down'), turn('right', 90)],
      ),
    ]),
    'The robot stands on the long line between the bays, facing left. "colour" decides the bay. Afterwards it faces left again.',
  );
}

/** From the long line (facing left, arm up) onto the bottom finish pad. */
function parkOnTheBottomPad(fromX: number): BlockNode[] {
  return [
    note(
      moveCm('backward', Number((PARK_X_CM - fromX).toFixed(1))),
      'Backwards along the long line, to the right of the bays: the cubes in the green bay are not in the way down.',
    ),
    note(turn('left', 90), 'Now the robot faces down.'),
    note(moveCm('forward', PARK_DOWN_CM), 'Level with the middle of the bottom pad.'),
    note(turn('right', 90), 'The claw and the front of the robot are over the pad: +10 points at the end.'),
  ];
}

// =============================================================================================
// 1. sort-leave-start
// =============================================================================================
// Measured (samples.test.ts): 10 points on all 14 arrangements (5 for leaving the start zone,
// 5 for the clean run), the program ends after 1.85 s. The claw is out of the start zone after
// 1.4 cm (13.9 mm of room in front of the robot): from 1.4 cm on the drive earns the 5 points,
// with 1.3 cm it does not.

const leaveStart: SampleProgram = {
  ...exampleCard('sort-leave-start'),
  description:
    `The robot drives ${LEAVE_CM} cm forward, out of the start zone, and stops. ` +
    'Then its LEDs turn green and its screen says so. ' +
    'It scores 10 points on every arrangement of the cubes: 5 for leaving the start zone, and 5 for a clean run (no restart). ' +
    'It ends after 2 seconds. ' +
    'Try a smaller number than 30. How short can the drive be, and still earn the 5 points?',
  program: program([
    script(note(whenStart(), 'A first program. Change the numbers, then press Start again.'), [
      print('Go!'),
      note(
        moveCm('forward', LEAVE_CM),
        'The robot faces left, into the field. A part of the robot outside the start zone: +5 points.',
      ),
      ledColor('all', GREEN),
      print('Out of the zone'),
    ]),
  ]),
};

// =============================================================================================
// 2. sort-white-line
// =============================================================================================
// Measured (samples.test.ts), on the vector drawing of the mat and on the picture the browser
// reads: 10 points on all 14 arrangements (leave the start zone, clean run); the program ends at
// the T after 3.17 s (3.18 s on the picture), the robot's middle at most 0.25 mm beside the
// line. The claw is open and stops short of the cube of W2: the tips of the fingers 6.2 mm
// (4.9 mm on the picture) before the near face of the cube - and if the robot went on, the cube
// would go between the open fingers. Started up to 5 degrees crooked and up to 1 cm beside the
// line (still in the start zone), it stops at the T every time: at most 4.6 mm beside the
// line, the finger tips 4.3 to 7.6 mm before the cube, after 3.1 to 3.5 s.
// The try of the description (turn left instead of right) follows the line BELOW the start zone
// to its T: 10 points, the finger tips 4.0 mm (2.7 mm on the picture) before the cube of W4.

const whiteLine: SampleProgram = {
  ...exampleCard('sort-white-line'),
  description:
    'A line follower for this mat. Here the lines are WHITE on a black mat. ' +
    'The robot drives onto the white line above the start zone and follows it up with the Quad RGB sensor. ' +
    'Both middle probes (L1 and R1) see the line: straight on. Only L1: turn left a little. Only R1: turn right a little. ' +
    'At the T at the end of the line all four probes see white, and the robot stops. ' +
    'It scores 10 points on every arrangement (leave the start zone, clean run), after 3 seconds. ' +
    'It does not touch the cube in front of it. ' +
    'Try the line below the start zone: turn left instead of right.',
  program: program([
    script(note(whenStart(), 'On this mat the line is white. The robot of the simulator knows that: "detects line" means white here.'), [
      note(moveCm('forward', TO_RIGHT_LINE_CM), 'Onto the white line on the right of the field.'),
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
// Measured (samples.test.ts): on all 14 arrangements the screen shows the colour of the cube of
// W4, and the LEDs light in that colour; 10 points (leave the start zone, clean run); the
// program ends after 3.27 s. The robot stops with the tips of its open fingers 7.0 mm before the
// near face of the cube: it never touches it. (The colour sensor at the claw sees a cube up to
// 3.5 cm beyond the middle of the claw: the sensor of Fire Rescue, an assumption of the
// simulator - core/robot.ts.)
// The try (turn right instead of left) reads the cube of W2 in the same way, on all 14
// arrangements (finger tips 7.8 mm before the cube).

const cubeColour: SampleProgram = {
  ...exampleCard('sort-cube-colour'),
  description:
    'The robot drives to the white line on the right and turns to the warehouse at the bottom right. ' +
    'It drives slowly at the cube there, until the colour sensor at the claw sees it. Then it stops. ' +
    'The screen shows the colour of the cube, and the LEDs light red or green. ' +
    'It always shows the right colour, on every arrangement. It does not touch the cube. ' +
    'It scores 10 points (leave the start zone, clean run), after 3 seconds. ' +
    'Try the cube at the top right: turn right instead of left.',
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_RIGHT_LINE_CM), 'Onto the white line on the right of the field.'),
      note(turn('left', 90), 'Now the robot faces down, to the warehouse at the bottom right.'),
      note(move('forward', TO_CUBE_RPM), 'Slowly: the robot must stop before it touches the cube.'),
      note(
        waitUntil(clawObjectDetected()),
        'Wait until the colour sensor at the claw sees something. In this simulator it sees a cube up to 3.5 cm in front of the middle of the claw.',
      ),
      stopMotors('all'),
      print(join('Cube: ', clawColor())),
      note(
        ifElse(clawColorIs('red'), [ledColor('all', RED)], [ledColor('all', GREEN)]),
        'A cube is red or green: not red means green.',
      ),
    ]),
  ]),
};

// =============================================================================================
// 4. sort-one-cube
// =============================================================================================
// Measured (samples.test.ts): 30 points on all 14 arrangements (leave the start zone 5, cube W2
// picked 5 at 3.4 s, in the bay of its colour 15, clean run 5); the cube stands in its bay from
// 10.4 s on, the program ends after 11.2 s. The cube stands at x 682.1 mm: 3.8 mm from the
// right edge of the red bay, 6.4 mm from the right edge of the green bay, about 32 mm from the
// top and the bottom edge. Nothing else moves.

const oneCube: SampleProgram = {
  ...exampleCard('sort-one-cube'),
  description:
    'The robot takes the cube of the nearest warehouse (top right). ' +
    'It grips the cube and lifts it, and the colour sensor at the claw reads its colour. ' +
    'Back on the long white line, it drives between the two bays. ' +
    'Red: it turns to the red bay. Green: it turns to the green bay. There it puts the cube down. ' +
    'It scores 30 points on every arrangement, after 11 seconds: leave the start zone 5, cube picked 5, cube in the right bay 15, clean run 5. ' +
    'Try to park on a finish pad at the end, for 10 more points.',
  program: program([
    putTheCubeDown(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_RIGHT_LINE_CM), 'Onto the white line on the right of the field.'),
      note(turn('right', 90), 'Now the robot faces up, to the warehouse at the top right.'),
      note(moveCm('forward', PICK_CM.W2), AROUND_THE_CUBE_NOTE),
      gripper('close'),
      note(arm('raise'), PICKED_NOTE),
      note(setVar('colour', clawColor()), 'The colour sensor at the claw sees the cube the robot holds: red or green.'),
      print(join('Cube: ', v('colour'))),
      note(moveCm('backward', PICK_CM.W2), 'Back to the long white line.'),
      turn('left', 90),
      note(moveCm('forward', 42.3), 'Now the robot is between the two bays: the red one above, the green one below.'),
      note(
        ifElse(eq(v('colour'), 'red'), [turn('right', 90)], [turn('left', 90)]),
        'The colour decides the bay: red up, green down.',
      ),
      call('put the cube down'),
    ]),
  ]),
};

// =============================================================================================
// 5. sort-two-cubes
// =============================================================================================
// Measured (samples.test.ts): 60 points on all 14 arrangements (leave the start zone 5, two
// cubes picked 10, both in the bay of their colour 30, parked on the bottom pad 10, clean run
// 5); the cubes are put down at 10.4 s and 25.3 s, the program ends after 31.8 s. Each cube has
// its own place in the bays (W2 at x 682 mm, W4 at x 620 mm), so two cubes of one colour stand
// side by side. Nothing is pushed.
// The try (park on the top pad: turn right, 45.9 cm, turn left) also scores 60 everywhere.

const twoCubes: SampleProgram = {
  ...exampleCard('sort-two-cubes'),
  description:
    'Two cubes, then park. The robot takes the cube at the top right, reads its colour and puts it in the bay of that colour. ' +
    'Then it does the same with the cube at the bottom right. ' +
    'Three my-blocks do the work: "take the cube", "to its bay" and "put the cube down". ' +
    'The second cube goes to another place in the bay: two cubes of one colour stand side by side. ' +
    'At the end the robot parks on the bottom finish pad. ' +
    'It scores 60 points on every arrangement, after 32 seconds. ' +
    'Try to park on the top pad instead.',
  program: program([
    takeTheCube(),
    putTheCubeDown(),
    toItsBay(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_RIGHT_LINE_CM), 'Onto the white line on the right of the field.'),
      note(turn('right', 90), 'Up, to the warehouse at the top right.'),
      note(moveCm('forward', PICK_CM.W2), AROUND_THE_CUBE_NOTE),
      call('take the cube'),
      moveCm('backward', PICK_CM.W2),
      note(turn('left', 90), 'Back on the long line, facing left.'),
      note(moveCm('forward', 42.3), 'The first place in a bay.'),
      call('to its bay'),
      note(moveCm('backward', 42.3), 'Back to the white line on the right.'),
      note(turn('left', 90), 'Down, to the warehouse at the bottom right. The arm is up: it goes down in "take the cube".'),
      moveCm('forward', PICK_CM.W4),
      call('take the cube'),
      moveCm('backward', PICK_CM.W4),
      note(turn('right', 90), 'Back on the long line, facing left.'),
      note(
        moveCm('forward', 48.5),
        'A second place, 6.2 cm further left: if both cubes have the same colour, they stand side by side.',
      ),
      call('to its bay'),
      ...parkOnTheBottomPad(62),
    ]),
  ]),
};

// =============================================================================================
// 6. sort-all-cubes
// =============================================================================================
// How it works: the long white line is the robot's road. On it the robot always faces left and
// knows where it is ("robot x", cm from the left edge of the mat), so the my-block "drive on the
// long line to" can go forward or backward. From the white line at a side it fetches a cube, up or
// down; the colour it reads in the claw decides the bay; "red place" and "green place" are
// where the next cube goes in each bay (68.2, 62.0, 55.8 cm: at most three cubes go to one
// bay). It never assumes an arrangement: every bay is chosen by the colour the sensor reads.
// Measured (samples.test.ts): 100 points on all 14 arrangements, every cube in the bay of its
// colour, nothing pushed, never a cube touched except the one in the claw. The program ends
// after 62.3 to 64.5 s (63.7 s on the default arrangement, RG-GR); the last cube is put down at
// 56.2 to 57.7 s (the time of the tie-breaker). Every one of the 24 orders of the four
// warehouses (the try of the description) also scores 100 on all 14 arrangements (measured
// once, in a scratch script: 336 matches, 61.5 to 70.3 s; the fastest orders take the two cubes
// on the right first: 61.5 to 63.0 s); the tests play three of them.

/** "drive on the long line to" x: forward when the place is to the left, backward when it is to the right. */
function driveOnTheLongLine(): DefinitionNode {
  return note(
    define('drive on the long line to', ['x'], [
      ifElse(
        lt(v('x'), v('robot x')),
        [moveCm('forward', sub(v('robot x'), v('x')))],
        [moveCm('backward', sub(v('x'), v('robot x')))],
      ),
      setVar('robot x', v('x')),
    ]),
    'On the long white line the robot always faces left. "robot x" is where it is: cm from the left edge of the mat. To get to x it drives forward (x is to the left) or backward (x is to the right).',
  );
}

/** "fetch the cube": from the long line up or down a side line to a cube, take it, and back. */
function fetchTheCube(): DefinitionNode {
  return note(
    define('fetch the cube', ['line x', 'way', 'cm'], [
      call('drive on the long line to', v('line x')),
      ifElse(eq(v('way'), 'up'), [turn('right', 90)], [turn('left', 90)]),
      note(moveCm('forward', v('cm')), 'The open claw ends up around the cube.'),
      call('take the cube'),
      moveCm('backward', v('cm')),
      note(ifElse(eq(v('way'), 'up'), [turn('left', 90)], [turn('right', 90)]), 'Facing left on the long line again.'),
    ]),
    'Fetch a cube: drive on the long line to the white line at a side ("line x"), turn up or down ("way"), drive "cm" to the cube, take it, and come back.',
  );
}

/** "bring it to its bay": to the next free place of the bay of "colour", and put the cube there. */
function bringItToItsBay(): DefinitionNode {
  return note(
    define('bring it to its bay', [], [
      ifElse(
        eq(v('colour'), 'red'),
        [
          call('drive on the long line to', v('red place')),
          note(turn('right', 90), 'The red bay is above the long line.'),
          call('put the cube down'),
          turn('left', 90),
          note(changeVar('red place', -PLACE_STEP_CM), 'The next red cube stands 6.2 cm further left.'),
        ],
        [
          call('drive on the long line to', v('green place')),
          note(turn('left', 90), 'The green bay is below the long line.'),
          call('put the cube down'),
          turn('right', 90),
          note(changeVar('green place', -PLACE_STEP_CM), 'The next green cube stands 6.2 cm further left.'),
        ],
      ),
    ]),
    'The colour the sensor read decides the bay. In each bay the cubes stand side by side.',
  );
}

const allCubes: SampleProgram = {
  ...exampleCard('sort-all-cubes'),
  description:
    'The whole mission, for every arrangement. The robot fetches the four cubes one after the other: top right, top left, bottom left, bottom right. ' +
    'It reads the colour of each cube in its claw and brings it to the bay of that colour. ' +
    'It never guesses a colour. ' +
    'In a bay the cubes stand side by side: "red place" and "green place" say where the next one goes. ' +
    'At the end it parks on the bottom pad. ' +
    'It scores 100 points on all 14 arrangements, in 62 to 65 of the 90 seconds. ' +
    'Try another order of the four warehouses. Which order is the fastest?',
  program: program([
    driveOnTheLongLine(),
    takeTheCube(),
    fetchTheCube(),
    putTheCubeDown(),
    bringItToItsBay(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(setVar('robot x', START_X_CM), 'At the start the robot is here on the long line: 115.1 cm from the left edge.'),
      note(setVar('red place', FIRST_PLACE_X_CM), 'The first place in each bay is at 68.2 cm.'),
      setVar('green place', FIRST_PLACE_X_CM),
      note(call('fetch the cube', RIGHT_LINE_X_CM, 'up', PICK_CM.W2), 'Top right. The white line on the right is at 110.5 cm.'),
      call('bring it to its bay'),
      note(call('fetch the cube', LEFT_LINE_X_CM, 'up', PICK_CM.W1), 'Top left. The white line on the left is at 13.4 cm.'),
      call('bring it to its bay'),
      note(call('fetch the cube', LEFT_LINE_X_CM, 'down', PICK_CM.W3), 'Bottom left.'),
      call('bring it to its bay'),
      note(call('fetch the cube', RIGHT_LINE_X_CM, 'down', PICK_CM.W4), 'Bottom right.'),
      call('bring it to its bay'),
      note(call('drive on the long line to', PARK_X_CM), 'To the right of the bays: the cubes in the green bay are not in the way down.'),
      note(turn('left', 90), 'Now the robot faces down.'),
      note(moveCm('forward', PARK_DOWN_CM), 'Level with the middle of the bottom pad.'),
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
