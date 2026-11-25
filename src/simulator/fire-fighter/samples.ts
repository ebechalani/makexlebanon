/**
 * Ready-made block programs for the Fire Fighter simulator (MakeX Lebanon, Season 2027, the mBot2
 * category for ages 8-10).
 *
 *   fighter-first-grab      starter       drive by distance to the yellow cube, take it, lift it, light up
 *   fighter-line-to-t       starter       follow the black line up to the T, then take the yellow cube
 *   fighter-yellow-x        starter       the yellow cube around the hydrant picture and down into tower X: 20 points
 *   fighter-left-bay        intermediate  the two red cubes of the left bay to the towers E and M: 40 points
 *   fighter-right-bay       intermediate  the two red cubes of the right bay to the towers K and A: 40 points
 *   fighter-whole-mission   advanced      all five letters, M A K E X: 100 points
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other games (../fire-rescue/samples.ts,
 *  ../locker-room/samples.ts ...): a visitor's browser gets a program and the text that explains
 *  it only from the server, which decides for every request what that visitor may have. So nothing
 *  that runs in the browser (src/simulator/ui, anything with 'use client', a page of the website)
 *  may import this file - nor ./sample-catalog.ts, the list of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  blocks are here. The server hands them out from ../members/all-examples.ts, the only file that
 *  imports this one.
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of this game's palette (blocks/palettes.ts: the
 * categories of Fire Rescue). Every one is run by the tests (samples.test.ts) on the real engine
 * with the real referee, on the vector drawing of the mat and on the picture the browser reads.
 * What a description promises is what those tests measure; the numbers are written in a comment
 * above each program.
 *
 * The descriptions are for ages 8 to 10 and their teachers: short sentences, plain words, and
 * nothing more certain than what the simulator really knows. No sentence of a description is a
 * sentence of the screen, and no title, id or heading of the examples is written in a file of the
 * screen (../members/client-guard.test.ts): the screen says "tower X opens to the top", a text here
 * says "the opening of tower X faces the top of the mat".
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation.
 *
 * THE NUMBERS BEHIND THE PROGRAMS (./field.ts, ./robot.ts, ./game.ts; mm from the top-left corner
 * of the mat, as the screen shows it, the MakeX Lebanon logo at the top). The robot starts in the
 * Fire Station at the bottom middle, facing UP, its middle (the middle of its wheel axle, the point
 * it turns around) at x 633.8, y 1158.9: on the Fire Station stem, the black line up to the yellow
 * cube (./robot.ts START_POSE). From that point the middle of the claw is 142 mm ahead, the tips of
 * the fingers 167 mm, the front of the body 105 mm, the Quad RGB sensor 85 mm; the back of the body
 * is 70 mm behind. The open claw is 64 mm wide inside (80 mm outside): each finger passes a 50 mm
 * cube with 7 mm to spare. Holding a cube it is 66 mm wide, closed and empty 36 mm.
 *
 *   - The yellow cube stands at (633.7, 827.6), 331.3 mm ahead of the start: 18.93 cm of driving
 *     put the middle of the claw on it (TO_YELLOW_CM). The red cubes stand in the two bays at the
 *     sides: left (64.2, 573.7) and (64.3, 697.2), right (1175.5, 561.2) and (1175.4, 693.1).
 *   - The towers: E (129.9, 138.2) at the park, top left; K (1102.6, 138.2) at the bakery, top
 *     right; M (128.3, 1115.0) at the school, bottom left; A (1104.8, 1115.0) at the hospital,
 *     bottom right; X (633.8, 624.3) at the hydrant, in the middle. Each opens towards its track
 *     (./field.ts OPENING): M, A and X to the top, K and E to the bottom. A cube counts only when it
 *     went in through the opening (./game.ts letterShows): the straight way from the yellow square
 *     leads into the BACK of tower X, so the yellow examples go round the hydrant picture and come
 *     down from above (the organiser: X opens "Up, toward the hydrant line").
 *   - The lines the bay examples drive along: the left line (x 380.6) and the right line (x 885.3),
 *     and the lines to the park (y 364.1), the bakery (y 364.2), the school (y 885.4) and the
 *     hospital (y 884.4). The robot never drives up a stem to the T before a corner tower: there
 *     the T bar is only 56.6 to 60.4 mm before the tower, and the claw reaches 82 mm further than
 *     the line sensor (./game.ts F6). Every way is driven by distance, at 50 RPM (167.6 mm/s).
 *   - THE DELIVERY is the same at every tower (the my-block "slide the cube in"; written out, block
 *     by block, in the third starter). It starts with the cube held in the middle of the claw, the
 *     robot facing the tower's opening on the middle line of its white dashed square, the front of
 *     the cube 10 mm before the tower: at (129.9, 335.2) facing up for E, (1102.6, 335.2) facing up
 *     for K, (128.3, 918.0) facing down for M, (1104.8, 918.0) facing down for A, (633.8, 427.3)
 *     facing down for X.
 *       gripper open        the cube stands free, 1 cm before the tower (the claw that holds a cube,
 *                           66 mm, is wider than the 60 mm between the tower's two sides)
 *       backward 5.5 cm     the open fingers come off the cube (it is 5 cm deep)
 *       gripper close       the empty claw is 36 mm wide: it fits between the two sides
 *       forward 6 cm        the tips meet the cube after 0.5 cm and push it 5.5 cm: its middle ends
 *                           on the middle of the white dashed square (within 0.1 mm at every tower)
 *       backward 6 cm       the robot moves clear: the delivery counts now (./game.ts F8, F9)
 *       gripper open        ready for the next cube
 *     Exactly 5 cm is a knife edge: it frees a cube that sits exactly in the middle of the claw
 *     (./game.test.ts), but the yellow cube of these examples sits 0.03 mm deeper (the
 *     claw closed after 189.30 mm of driving, 0.03 mm more than the 189.27 mm to the middle of the
 *     cube): backing off 5.0 cm, the tips are still over the back of the cube, the claw grabs it again
 *     and the robot pulls it back out of the tower (5.05 cm is enough; samples.test.ts tries both).
 *     Hence "more than 5 cm" in the notes and the texts.
 *
 * The simulated robot is perfect (no wheel slip), so driving by distance is exact here. A real
 * robot drifts: it has to find the lines again on its way. These programs need the robot where the
 * simulator puts it at the start: how far a start may be moved or turned, example by example, is
 * written above each program and tried by samples.test.ts. The screen moves the robot in steps of
 * 5 mm and turns it in steps of 1 degree; "left", "right", "up" and "down" are as the screen shows
 * the mat. The Fire Station leaves the robot 6.5 mm in front and behind, 65.8 mm on its left and
 * 54.2 mm on its right, and lets it turn by up to 6 degrees where it stands.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { ProgramJson } from '../core/types';
import {
  and,
  arm,
  call,
  define,
  driveRpm,
  gripper,
  ifElse,
  ledColor,
  lineStatusIs,
  move,
  moveCm,
  note,
  or,
  print,
  probeDetects,
  program,
  repeatUntil,
  script,
  stopMotors,
  turn,
  whenStart,
  type BlockNode,
  type DefinitionNode,
  type TurnDirection,
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

/** From the start, this far forward (cm) puts the middle of the claw on the yellow cube: 1158.9 - 142 - 827.6 = 189.3 mm. */
export const TO_YELLOW_CM = 18.93;
/** The try of the first starter: too short - the middle of the cube is not between the fingers, and the claw catches nothing. */
export const TOO_SHORT_CM = 15;

/**
 * The line follower drives this far (cm) before it looks at the line: then its line sensor (85 mm
 * ahead of the middle) is at y 963.9, past the Fire Station picture (it ends at y 985.4). That
 * picture has dark drawing lines: on the picture the browser reads, a line follower that starts
 * looking after 8 cm or less finds a "T" in it and stops there.
 */
export const PAST_THE_PICTURE_CM = 11;
/** The line follower: its speed when both middle probes are on the line, and the two wheel speeds of a steer (RPM). */
export const FOLLOW_RPM = 30;
export const STEER_FAST_RPM = 30;
export const STEER_SLOW_RPM = 10;
/** "quad rgb sensor line status is ■■■■": all four probes on the line - the robot is at the T just below the yellow cube. */
export const ALL_FOUR_ON_THE_LINE = 15;
/**
 * From the T, this far (cm) puts the claw around the yellow cube. The robot stops at the T with its
 * middle at y 1000.8 (its sensor on the lower edge of the T bar, y 916.0): 31.4 mm more put the middle
 * of the claw 0.3 mm past the middle of the cube.
 */
export const T_TO_YELLOW_CM = 3.14;

/**
 * The way of the yellow cube around the hydrant picture to the top of tower X (cm), after
 * TO_YELLOW_CM: to the left, from the Fire Station stem (x 633.8) to x 480.0 - going up, the robot's
 * right side (65 mm from its middle) passes tower X with 36.3 mm to spare -; up to y 300.0, 30.4 cm
 * above the opening of tower X (there the robot turns with the cube in its claw); to the right,
 * back over the middle of tower X; down, until the front of the cube is 10 mm before the tower
 * (the robot's middle at y 427.3).
 */
export const AROUND_THE_HYDRANT = { left: 15.38, up: 66.96, right: 15.38, down: 12.73 } as const;

/** The delivery, "slide the cube in" (see the table at the top). */
export const DELIVERY = { backOff: 5.5, push: 6, clear: 6 } as const;

/**
 * From the start, the bay examples first drive this far up (cm), to y 1028.9, before they turn to a
 * side line. Lower down, the claw would push tower A when the robot turns on the right line (with
 * 10 cm it does: samples.test.ts).
 */
export const UP_FIRST_CM = 13;

/**
 * The left bay: the ways of "Two red cubes: park and school" (cm). From (633.8, 1028.9): left to the
 * left line (x 380.6); up to the upper red cube (y 573.7); the claw around it (its middle at x 64.2);
 * up to the line to the park (y 364.1); along it to below tower E (x 129.9); up to the delivery point
 * of E (y 335.2). Then from the left line down to the lower red cube (y 697.2), the claw around it
 * (x 64.3), down to the line to the school (y 885.4), along it to above tower M (x 128.3), down to the
 * delivery point of M (y 918.0).
 */
export const LEFT_BAY = {
  toLine: 25.32,
  upToCube: 45.52,
  toCube: 17.44,
  upToParkLine: 20.96,
  toE: 25.08,
  toDeliveryE: 2.89,
  downToCube: 30.7,
  toLowerCube: 17.43,
  downToSchoolLine: 18.82,
  toM: 25.23,
  toDeliveryM: 3.25,
} as const;

/**
 * The right bay: the ways of "Two red cubes: bakery and hospital" (cm), the mirror of the left bay.
 * From (633.8, 1028.9): right to the right line (x 885.3); up to the upper red cube (y 561.2); the
 * claw around it (x 1175.5); up to the line to the bakery (y 364.2); along it to below tower K
 * (x 1102.6); up to the delivery point of K (y 335.2). Then down to the lower red cube (y 693.1), the
 * claw around it (x 1175.4), down to the line to the hospital (y 884.4), along it to above tower A
 * (x 1104.8), down to the delivery point of A (y 918.0).
 */
export const RIGHT_BAY = {
  toLine: 25.15,
  upToCube: 46.77,
  toCube: 14.82,
  upToBakeryLine: 19.7,
  toK: 21.73,
  toDeliveryK: 2.9,
  downToCube: 30.29,
  toLowerCube: 14.81,
  downToHospitalLine: 19.13,
  toA: 21.94,
  toDeliveryA: 3.36,
} as const;

/**
 * The ways of the whole mission between the parts above (cm): from tower X (the robot's middle at
 * y 372.3 after the delivery) left to the left line, and down to the upper red cube of the left bay
 * (y 573.7); from tower M (y 862.9) to the right line; up to the lower red cube of the
 * right bay (y 693.1); and, after tower A (y 863.0), up to the upper red cube of the right bay
 * (y 561.3).
 */
export const MISSION_WAYS = { xToLeftLine: 25.32, downToUpperLeft: 20.14, mToRightLine: 75.7, upToLowerRight: 16.98, upToUpperRight: 30.17 } as const;

/** The yellow of the LEDs in the first starter. */
const YELLOW_LIGHT = '#ffd000';

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE =
  'This program drives by distance. The robot of the simulator drives exactly. A real robot drifts a little: it has to find the black lines again on its way.';

/** On "move forward" towards a red cube with the open claw. */
const AROUND_THE_CUBE_NOTE = 'The claw is open: its fingers end up on both sides of the cube, without touching it.';

/** On the "move forward" that brings a cube to a tower. */
const BEFORE_THE_TOWER_NOTE = 'Now the front of the cube is 1 cm before the tower.';

/** The six blocks of the delivery, with their notes: written out in the third starter, the my-block "slide the cube in" in the others. */
function deliveryBlocks(): BlockNode[] {
  return [
    note(gripper('open'), 'Let the cube go. A claw that holds a cube is too wide: it does not fit between the two sides of the tower.'),
    note(
      moveCm('backward', DELIVERY.backOff),
      `Back ${DELIVERY.backOff} cm: the open fingers come off the cube (it is 5 cm deep). Back off more than 5 cm, or the closing claw grabs the cube again.`,
    ),
    note(gripper('close'), 'The closed, empty claw is narrow: it fits between the two sides of the tower.'),
    note(moveCm('forward', DELIVERY.push), 'Push the cube 5.5 cm, into the white dashed square under the tower.'),
    note(moveCm('backward', DELIVERY.clear), 'Move clear: a cube counts only when the robot no longer touches it.'),
    note(gripper('open'), 'Open the claw again, ready for the next cube.'),
  ];
}

/** The name of the my-block of the delivery. */
export const SLIDE_IN = 'slide the cube in';

/** "slide the cube in": the delivery at any tower, from 1 cm before the tower (see the table at the top). */
function slideTheCubeIn(): DefinitionNode {
  return note(
    define(SLIDE_IN, [], deliveryBlocks()),
    'The same at every tower: let the cube go 1 cm before the tower, back off, close the empty claw, push the cube in and move clear.',
  );
}

/** Drive the open claw around a red cube, take it, and back out the same way. */
function takeTheCube(cm: number): BlockNode[] {
  return [note(moveCm('forward', cm), AROUND_THE_CUBE_NOTE), gripper('close'), note(moveCm('backward', cm), 'Back to the line, with the cube.')];
}

/** The yellow cube from the start around the hydrant picture to 1 cm before tower X (the robot then faces down, into X's opening). */
function yellowToTheTopOfX(): BlockNode[] {
  return [
    note(moveCm('forward', TO_YELLOW_CM), 'Up to the yellow cube: now it stands between the open fingers.'),
    note(gripper('close'), 'The robot has taken the yellow cube. From now on, X must be its next delivery.'),
    note(turn('left', 90), 'The opening of tower X faces the top of the mat. So the robot goes round the hydrant picture and comes down from above.'),
    note(moveCm('forward', AROUND_THE_HYDRANT.left), 'Away to the left: going up, the robot and the cube pass tower X on its left side.'),
    turn('right', 90),
    note(moveCm('forward', AROUND_THE_HYDRANT.up), 'Up, past tower X.'),
    turn('right', 90),
    note(moveCm('forward', AROUND_THE_HYDRANT.right), 'Back over the middle of tower X.'),
    note(turn('right', 90), 'Face down, at the opening of tower X.'),
    note(moveCm('forward', AROUND_THE_HYDRANT.down), BEFORE_THE_TOWER_NOTE),
  ];
}

/** The two red cubes of the left bay, from (633.8, 1028.9) facing left on the way to the left line: E, then M. */
function leftBayToEAndM(): BlockNode[] {
  return [
    note(moveCm('forward', LEFT_BAY.toLine), 'To the left line.'),
    note(turn('right', 90), 'Face up, on the left line.'),
    note(moveCm('forward', LEFT_BAY.upToCube), 'Up the left line, to the upper red cube.'),
    ...upperLeftCubeToE('left'),
    ...lowerLeftCubeToM(),
  ];
}

/**
 * On the left line at the height of the upper red cube: face it (a turn to the left when the robot
 * came up the line, to the right when it came down), take it, and slide it into tower E.
 */
function upperLeftCubeToE(towardsTheCube: TurnDirection): BlockNode[] {
  return [
    note(turn(towardsTheCube, 90), 'Face left, at the cube.'),
    ...takeTheCube(LEFT_BAY.toCube),
    note(turn('right', 90), 'Face up.'),
    note(moveCm('forward', LEFT_BAY.upToParkLine), 'Up to the line to the park.'),
    turn('left', 90),
    note(moveCm('forward', LEFT_BAY.toE), 'Along the line to the park, until the robot is below tower E.'),
    note(turn('right', 90), 'Face up, at the opening of tower E.'),
    note(moveCm('forward', LEFT_BAY.toDeliveryE), BEFORE_THE_TOWER_NOTE),
    note(call(SLIDE_IN), 'Into tower E: the letter E shows.'),
  ];
}

/** From tower E back to the left line, down to the lower red cube; take it, and slide it into tower M. */
function lowerLeftCubeToM(): BlockNode[] {
  return [
    turn('right', 90),
    note(moveCm('forward', LEFT_BAY.toE), 'Back to the left line.'),
    note(turn('right', 90), 'Face down.'),
    note(moveCm('forward', LEFT_BAY.downToCube), 'Down the left line, to the lower red cube.'),
    note(turn('right', 90), 'Face left, at the cube.'),
    ...takeTheCube(LEFT_BAY.toLowerCube),
    note(turn('left', 90), 'Face down.'),
    note(moveCm('forward', LEFT_BAY.downToSchoolLine), 'Down to the line to the school.'),
    turn('right', 90),
    note(moveCm('forward', LEFT_BAY.toM), 'Along the line to the school, until the robot is above tower M.'),
    note(turn('left', 90), 'Face down, at the opening of tower M.'),
    note(moveCm('forward', LEFT_BAY.toDeliveryM), BEFORE_THE_TOWER_NOTE),
    note(call(SLIDE_IN), 'Into tower M: the letter M shows.'),
  ];
}

/**
 * On the right line at the height of the lower red cube: face it (a turn to the right when the robot
 * came up the line, to the left when it came down), take it, and slide it into tower A.
 */
function lowerRightCubeToA(towardsTheCube: TurnDirection): BlockNode[] {
  return [
    note(turn(towardsTheCube, 90), 'Face right, at the cube.'),
    ...takeTheCube(RIGHT_BAY.toLowerCube),
    note(turn('right', 90), 'Face down.'),
    note(moveCm('forward', RIGHT_BAY.downToHospitalLine), 'Down to the line to the hospital.'),
    turn('left', 90),
    note(moveCm('forward', RIGHT_BAY.toA), 'Along the line to the hospital, until the robot is above tower A.'),
    note(turn('right', 90), 'Face down, at the opening of tower A.'),
    note(moveCm('forward', RIGHT_BAY.toDeliveryA), BEFORE_THE_TOWER_NOTE),
    note(call(SLIDE_IN), 'Into tower A: the letter A shows.'),
  ];
}

/** On the right line at the height of the upper red cube, facing up: take it, and slide it into tower K. */
function upperRightCubeToK(): BlockNode[] {
  return [
    note(turn('right', 90), 'Face right, at the cube.'),
    ...takeTheCube(RIGHT_BAY.toCube),
    note(turn('left', 90), 'Face up.'),
    note(moveCm('forward', RIGHT_BAY.upToBakeryLine), 'Up to the line to the bakery.'),
    turn('right', 90),
    note(moveCm('forward', RIGHT_BAY.toK), 'Along the line to the bakery, until the robot is below tower K.'),
    note(turn('left', 90), 'Face up, at the opening of tower K.'),
    note(moveCm('forward', RIGHT_BAY.toDeliveryK), BEFORE_THE_TOWER_NOTE),
    note(call(SLIDE_IN), 'Into tower K: the letter K shows.'),
  ];
}

// =============================================================================================
// 1. fighter-first-grab
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 0 points; the claw
// takes the yellow cube at 1.29 s (the console: "The robot took the yellow cube."), the program
// ends after 2.32 s with the cube in the claw, the screen showing "Fire Fighter!" and "I have the
// yellow cube", the LEDs yellow. Nothing else moves.
// The try (15 cm instead of 18.93): the middle of the cube is not between the fingers, the claw
// catches nothing, and the cube does not move. (From 16.5 cm on, the claw catches it.)

const firstGrab: SampleProgram = {
  ...exampleCard('fighter-first-grab'),
  description:
    `Your first program. The robot drives forward ${TO_YELLOW_CM} cm, to the yellow cube. ` +
    'Now the cube stands between the open fingers of the claw. ' +
    'The claw closes, the arm lifts the cube, the lights turn yellow, and the screen says "I have the yellow cube". ' +
    'Then the arm goes down again: the claw still holds the cube. ' +
    'This scores no points: a cube scores only under its tower. ' +
    `Try ${TOO_SHORT_CM} cm: the robot stops too soon, and the claw catches nothing.`,
  program: program([
    script(note(whenStart(), 'Your first program. Change a number, then press Start again.'), [
      print('Fire Fighter!'),
      note(moveCm('forward', TO_YELLOW_CM), `The yellow cube is ${TO_YELLOW_CM} cm ahead of the middle of the claw. Now it stands between the open fingers.`),
      gripper('close'),
      note(arm('raise'), 'The arm lifts the cube.'),
      note(ledColor('all', YELLOW_LIGHT), 'All five LEDs light up yellow, like the cube.'),
      print('I have the yellow cube'),
      note(arm('lower'), 'The arm goes down again. The claw still holds the cube.'),
    ]),
  ]),
};

// =============================================================================================
// 2. fighter-line-to-t
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 0 points; the robot
// finds the T at 1.22 s ("T found" on the screen), drives 3.14 cm more and takes the yellow cube
// (1.53 s); the program ends after 1.54 s, the robot's middle at y 969.4 on the Fire Station stem.
// No cube moves before the claw takes the yellow one.
// Started moved 10 mm to the left or right, or turned by up to 6 degrees either way (as far as the
// Fire Station lets it turn), or both: it still finds the line and takes the cube, on the drawing
// and on the picture (the closing claw then pulls the cube a few mm to its middle). 15 mm to the
// side is too far on the picture (the robot misses the cube there; on the drawing it still takes
// it), 20 mm on both.
// Why 11 cm first: started after 8 cm or less, the robot finds a "T" in the dark drawing of the
// Fire Station picture on the picture of the mat (not on the drawing, where the picture is one flat
// colour) and stops there, far from the cube.

const lineToT: SampleProgram = {
  ...exampleCard('fighter-line-to-t'),
  description:
    `A line follower. First the robot drives ${PAST_THE_PICTURE_CM} cm: then its line sensor is past the picture of the Fire Station. That picture has dark spots that are not a line. ` +
    'Then it follows the black line up. ' +
    'Both middle probes (L1 and R1) on the line: drive on. The line under a left probe: steer left. Under a right probe: steer right. ' +
    `All four probes on black: the robot is at the T. It drives ${T_TO_YELLOW_CM} cm more and closes the claw on the yellow cube. ` +
    'This scores no points. ' +
    'Try to move the robot 1 cm to the side, or turn it a little, before you press Start: it still finds the line and the cube. ' +
    'In the "EM1 / EM2" block the right motor (EM2) is mounted the other way round: a negative speed drives it forward.',
  program: program([
    script(note(whenStart(), 'A line follower: the Quad RGB sensor under the front of the robot has four probes, L2 L1 R1 R2 from left to right.'), [
      note(
        moveCm('forward', PAST_THE_PICTURE_CM),
        `First ${PAST_THE_PICTURE_CM} cm: then the line sensor is past the picture of the Fire Station. The dark spots of the picture are not a line.`,
      ),
      note(
        repeatUntil(lineStatusIs(ALL_FOUR_ON_THE_LINE), [
          ifElse(
            and(probeDetects('L1', 'line'), probeDetects('R1', 'line')),
            [note(move('forward', FOLLOW_RPM), 'L1 and R1 are the two middle probes. Both on the line: drive on.')],
            [
              ifElse(
                or(probeDetects('L1', 'line'), probeDetects('L2', 'line')),
                [
                  note(
                    driveRpm(STEER_SLOW_RPM, -STEER_FAST_RPM),
                    'The line is under a left probe: steer left (the left wheel slower). EM2 is mounted the other way round: a negative speed drives it forward.',
                  ),
                ],
                [
                  ifElse(
                    or(probeDetects('R1', 'line'), probeDetects('R2', 'line')),
                    [note(driveRpm(STEER_FAST_RPM, -STEER_SLOW_RPM), 'The line is under a right probe: steer right (the right wheel slower).')],
                    [note(move('forward', FOLLOW_RPM), 'No probe on the line: drive on.')],
                  ),
                ],
              ),
            ],
          ),
        ]),
        'Until all four probes see black: that is the T, just below the yellow cube.',
      ),
      stopMotors('all'),
      print('T found'),
      note(moveCm('forward', T_TO_YELLOW_CM), `The cube is ${T_TO_YELLOW_CM} cm further: now it stands between the open fingers.`),
      gripper('close'),
    ]),
  ]),
};

// =============================================================================================
// 3. fighter-yellow-x
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 20 points - the yellow
// cube under tower X at 11.67 s, through its opening, the letter X shows, and X was the robot's next
// delivery after it took the yellow cube (1.29 s). The program ends after 12.41 s. The cube ends
// 0.002 mm from the middle of the white dashed square. No tower moves, no other cube moves, the claw
// never touches a side of the tower.
// The start: it keeps its 20 points (and moves no tower) moved up to 5 mm to the left or 4.5 mm to
// the right, up to 4.5 mm up, down as far as the Fire Station lets it (6.5 mm), and turned by up to
// 0.5 degrees either way; 0.5 mm or 0.1 degree further, it scores 0. One step of the screen: 5 mm to
// the left 20; 5 mm to the right 0 (the cube catches the right side of tower X, and the tower is
// pushed 45.0 mm); 5 mm up 0 (the claw took the cube 5 mm deeper, so backing off 5.5 cm is not
// enough: the claw grabs the cube again and pulls it back out); 5 mm down 20; turned 1 degree
// either way 0 (tower X is pushed 45.5 mm).
// The trap of its note: backing off 5.0 cm before the claw closes is not enough here (the cube sits
// 0.03 mm deeper than the middle of the claw) - the claw grabs the cube again, and the robot pulls it
// back out (0 points); 5.05 cm is enough.

const yellowX: SampleProgram = {
  ...exampleCard('fighter-yellow-x'),
  description:
    "The yellow cube must go under tower X, and X must be the robot's next delivery once it has taken the yellow cube. " +
    'The opening of tower X faces the top of the mat. ' +
    'So the robot takes the cube and drives round the hydrant picture, to come down from above. ' +
    'A cube pushed into the back of a tower does not count. ' +
    'A claw that holds a cube is too wide for the tower. ' +
    `So it lets go 1 cm before the tower and backs off ${DELIVERY.backOff} cm. Then it closes its empty claw and pushes the cube into the white dashed square. ` +
    'The letter X shows: 20 points, in 12 seconds. ' +
    'Back off more than 5 cm before you close the claw: closed sooner, it grabs the cube again. ' +
    'The robot drives by distance only: start it exactly where the simulator puts it.',
  program: program([script(note(whenStart(), BY_DISTANCE_NOTE), [...yellowToTheTopOfX(), ...deliveryBlocks()])]),
};

// =============================================================================================
// 4. fighter-left-bay
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 40 points - the upper
// red cube under tower E at 15.27 s, the lower one under tower M at 29.46 s, each through its
// tower's opening. The program ends after 30.20 s. The cubes end 0.02 mm (E) and 0.08 mm (M) from
// the middles of the white dashed squares. No tower moves, no other cube moves.
// The start: it keeps its 40 points (and moves no tower) moved up to 4.5 mm to the left or right,
// up or down as far as the Fire Station lets it (6.5 mm), and turned by up to 0.2 degrees either
// way; 0.5 mm or 0.1 degree further, it scores less. One step of the screen: 5 mm to the left 0
// (tower E is pushed 45.0 mm); 5 mm to the right 20 (E only; tower M is pushed 44.9 mm); 5 mm up or
// down 40; turned 1 degree either way 0.

const leftBay: SampleProgram = {
  ...exampleCard('fighter-left-bay'),
  description:
    'Two red cubes from the left bay. The upper one goes to tower E at the park (top left), the lower one to tower M at the school (bottom left). ' +
    'The robot drives by distance, along the black lines. ' +
    'How a cube goes into a tower is one my-block, "slide the cube in": the same at every tower. ' +
    'The robot never drives up to the T of a tower. Here the T is so close to the tower that the claw would be inside it when the line sensor sees the T. ' +
    '40 points in 30 seconds. ' +
    'It drives by distance only: turned 1 degree at the start, it scores nothing.',
  program: program([
    slideTheCubeIn(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [note(moveCm('forward', UP_FIRST_CM), `First ${UP_FIRST_CM} cm up.`), note(turn('left', 90), 'Face left.'), ...leftBayToEAndM()]),
  ]),
};

// =============================================================================================
// 5. fighter-right-bay
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 40 points - the upper
// red cube under tower K at 14.76 s, the lower one under tower A at 28.24 s, each through its
// tower's opening. The program ends after 28.98 s. The cubes end 0.01 mm (K) and 0.04 mm (A) from
// the middles of the white dashed squares. No tower moves, no other cube moves.
// The start: it keeps its 40 points (and moves no tower) moved up to 4.5 mm to the left or right,
// up or down as far as the Fire Station lets it (6.5 mm), and turned by up to 0.2 degrees either
// way; 0.5 mm or 0.1 degree further, it scores less. One step of the screen: 5 mm to the left 0
// (the towers K and A are pushed 45 mm); 5 mm to the right 0; 5 mm up or down 40; turned 1 degree
// either way 0.
// Why 13 cm up first: with 10 cm the claw pushes tower A when the robot turns on the right line.
// ("Its claw would hit tower A" holds for the simulator's tower, 10.5 cm wide - ./game.ts F2.)

const rightBay: SampleProgram = {
  ...exampleCard('fighter-right-bay'),
  description:
    'The same for the right bay. The upper red cube goes to tower K at the bakery (top right), the lower one to tower A at the hospital (bottom right). ' +
    `The robot first drives ${UP_FIRST_CM} cm up, then turns right. Lower down, its claw would hit tower A when it turns on the right line. ` +
    'At each tower the my-block "slide the cube in" pushes the cube in with the closed claw. ' +
    '40 points in 29 seconds. ' +
    'It drives by distance only: turned 1 degree at the start, it scores nothing.',
  program: program([
    slideTheCubeIn(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', UP_FIRST_CM), `First ${UP_FIRST_CM} cm up. Lower down, the claw would hit tower A when the robot turns on the right line.`),
      note(turn('right', 90), 'Face right.'),
      note(moveCm('forward', RIGHT_BAY.toLine), 'To the right line.'),
      note(turn('left', 90), 'Face up, on the right line.'),
      note(moveCm('forward', RIGHT_BAY.upToCube), 'Up the right line, to the upper red cube.'),
      ...upperRightCubeToK(),
      turn('left', 90),
      note(moveCm('forward', RIGHT_BAY.toK), 'Back to the right line.'),
      note(turn('left', 90), 'Face down.'),
      note(moveCm('forward', RIGHT_BAY.downToCube), 'Down the right line, to the lower red cube.'),
      ...lowerRightCubeToA('left'),
    ]),
  ]),
};

// =============================================================================================
// 6. fighter-whole-mission
// =============================================================================================
// How it works: the yellow part of "Yellow cube under the X tower" (the robot takes the yellow cube,
// so X must be its next delivery - and it is), then the left bay as in "Two red cubes: park and
// school" (E, M), then the lower red cube of the right bay to A and the upper one to K.
// Measured (samples.test.ts), on the drawing and on the picture of the mat: 100 points - X at
// 11.67 s, E at 25.33 s, M at 39.52 s, A at 55.43 s, K at 68.91 s, each cube through its tower's
// opening; the program ends after 69.65 s. Every cube ends within 0.1 mm of the middle of its white
// dashed square. No tower moves, no cube moves that the claw has not taken.
// The start: it keeps its 100 points (and moves no tower) moved up to 4.5 mm to the left or right,
// up to 4.5 mm up, down as far as the Fire Station lets it (6.5 mm), and turned by up to 0.2 degrees
// either way; 0.5 mm or 0.1 degree further, it scores less. One step of the screen: 5 mm to the left
// 20 (X only; the towers E, K and A are pushed 45 mm); 5 mm to the right 20 (E only; the towers M
// and X are pushed 45 mm); 5 mm up 80 (M, A, K and E: at X the claw grabs the yellow cube again, as
// in "Yellow cube under the X tower"); 5 mm down 100; turned 1 degree either way 0 (tower X is pushed
// 45.5 mm).

const wholeMission: SampleProgram = {
  ...exampleCard('fighter-whole-mission'),
  description:
    'All five letters, M A K E X, for 100 points. ' +
    'First the yellow cube to X: once the robot has taken it, X is its very next delivery, so it counts. ' +
    'Then the two red cubes of the left bay to E and M, and the two of the right bay to A and K. ' +
    'The robot drives by distance only, so it must start exactly where the simulator puts it. ' +
    'Moved 5 mm to the side, it loses points. Turned 1 degree, it loses them all. ' +
    'A real robot drifts: it has to find the black lines again on its way. ' +
    'Done in 70 seconds of the 180.',
  program: program([
    slideTheCubeIn(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      ...yellowToTheTopOfX(),
      note(call(SLIDE_IN), 'Into tower X: the letter X shows, and X was the next delivery after the robot took the yellow cube.'),
      note(turn('right', 90), 'Face left.'),
      note(moveCm('forward', MISSION_WAYS.xToLeftLine), 'To the left line.'),
      note(turn('left', 90), 'Face down, on the left line.'),
      note(moveCm('forward', MISSION_WAYS.downToUpperLeft), 'Down the left line, to the upper red cube.'),
      ...upperLeftCubeToE('right'),
      ...lowerLeftCubeToM(),
      note(turn('left', 90), 'Face right.'),
      note(moveCm('forward', MISSION_WAYS.mToRightLine), 'All the way to the right line.'),
      note(turn('left', 90), 'Face up, on the right line.'),
      note(moveCm('forward', MISSION_WAYS.upToLowerRight), 'Up the right line, to the lower red cube.'),
      ...lowerRightCubeToA('right'),
      turn('right', 90),
      note(moveCm('forward', RIGHT_BAY.toA), 'Back to the right line.'),
      note(turn('right', 90), 'Face up.'),
      note(moveCm('forward', MISSION_WAYS.upToUpperRight), 'Up the right line, to the upper red cube.'),
      ...upperRightCubeToK(),
    ]),
  ]),
};

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Fire Fighter, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [firstGrab, lineToT, yellowX, leftBay, rightBay, wholeMission];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
