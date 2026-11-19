/**
 * Ready-made block programs for the Locker Room simulator (MakeX Lebanon, Season 2026, Capelli
 * Starter, ages 13-15).
 *
 *   locker-to-station      starter       drive by distance: out of the Locker Room, into the Scan Station
 *   locker-follow-line     starter       follow the WHITE bottom line to the yellow frame of the Scan Station
 *   locker-read-card       starter       stop in the Scan Station, read the referee's colour card, wait until the Team Box is lifted
 *   locker-team-cube       intermediate  read the card, then bring the team cube from its square in the maze into its big circle
 *   locker-two-tokens      intermediate  read the tokens of zones A and B and put each into the warehouse of its colour
 *   locker-whole-mission   advanced      the card, the team cube, and all three tokens, on any of the 12 arrangements
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other games (../fire-rescue/samples.ts,
 *  ../fire-chief/samples.ts, ../warehouse-sort/samples.ts): a visitor's browser gets a program
 *  and the text that explains it only from the server, which decides for every request what that
 *  visitor may have. So nothing that runs in the browser (src/simulator/ui, anything with
 *  'use client', a page of the website) may import this file - nor ./sample-catalog.ts, the list
 *  of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  blocks are here. The server hands them out from ../members/all-examples.ts, the only file that
 *  imports this one.
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of this game's palette (blocks/palettes.ts:
 * the blocks of real mBlock, and the Gripper shortcuts of Fire Rescue). Every one is run by the
 * tests (samples.test.ts) on the real engine with the real referee, on all 12 arrangements, on
 * the vector drawing of the mat and on the picture the browser reads. What a description
 * promises is what those tests measure; the numbers are written in a comment above each program.
 *
 * The descriptions are for ages 13 to 15, many of whom read English as a second language: short
 * sentences, plain words, and nothing more certain than what the simulator really knows. Where
 * a number is the simulator's own choice (when the referee shows the card, lifts the Team Box),
 * the text says "in this simulator".
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation (mBlock has comments on
 * blocks too).
 *
 * The numbers behind the programs (./field.ts, ./robot.ts, ./game.ts; mm from the top-left corner
 * of the mat, as the screen shows it). The robot starts in the Locker Room at the bottom left,
 * facing RIGHT, its middle (the middle of its wheel axle, the point it turns around) at x 77.9,
 * y 1108.1: on the middle of the bottom line. From that point the middle of the claw is 142 mm
 * ahead, the tips of the fingers 167 mm, the front of the body 105 mm, the Quad RGB sensor 85 mm,
 * the back of the body 70 mm behind. A cube is 50 mm wide; the open claw is 64 mm wide, so each
 * finger passes a cube with 7 mm to spare.
 *
 *   - The Locker Room (its yellow frame included) ends at x 252.8: the whole robot is out of it
 *     when its middle is past x 322.8 (24.5 cm of driving). The Scan Station (its frame included)
 *     starts at x 982.3: the whole robot is inside it with its middle between x 1052.3 and 1068.0.
 *     98.2 cm forward puts it at x 1059.9 (7.6 mm of room behind, 8.1 mm in front).
 *   - The team cubes stand straight in the middle of the small squares in the maze (./field.ts
 *     MARK_ROLES, as the organiser decided): RED (621.9, 506.4), GREEN (621.9, 723.3). The big
 *     circles: RED (1107.7, 505.3) on the right, at the height of the red cube; GREEN (623.6,
 *     933.2) right below the green cube. Neither cube can be taken from between them (the red one
 *     from below, the green one from above): the cubes stand 216.8 mm apart, and with the claw
 *     around one cube the back of the robot reaches 212 mm from it - into the other cube, whose near
 *     side is only 191.8 mm away. From the other three sides each can be taken (samples.test.ts
 *     tries all four): the green way takes the green cube from below, the red way the red cube
 *     from the right.
 *       GREEN: from the Scan Station back 43.8 cm along the bottom line (x 621.9, right below the
 *       green cube), a turn to the left, and "forward to a white line": the white line at the
 *       bottom of the maze (its lower edge at y 785.2) stops the robot with its middle at y 869.3,
 *       the open claw around the cube (its middle 4 mm short of the cube's middle; the front of
 *       the body 16 mm before the cube). Close; back 21 cm: the cube 1.7 mm from the middle of
 *       the big green circle. Open; back 6 cm (the back of the robot then stays on the mat).
 *       RED: back 19.7 cm (x 862.9), a turn to the left, "forward to a white line": the short
 *       white line from the maze to the right (its lower edge at y 628.6) is the first line on
 *       that way; then 20.69 cm on, to the height of the red cube; a turn to the left and 9.9 cm
 *       put the claw around it. Close; a half turn to the right (the cube swings over the top,
 *       far from the green cube); 20.2 cm put it 1.5 mm from the middle of the big red circle.
 *   - The tokens stand in the middle of the zone pictures on the left: zone A (130.8, 776.3), B
 *     (130.8, 611.0), C (133.6, 457.9). Their targets are the three WAREHOUSES at the top (./field.ts
 *     MARK_ROLES): RED (130.8, 118.5) at the top left and GREEN (1102.5, 118.9) at the top right,
 *     both turned by 45 degrees, and BLUE (621.2, 118.5) in the middle, straight. Each is 104.76 x
 *     62.86 mm: a cube fits completely, in a turned one only when it is turned with it, to within
 *     17.7 degrees (./game.ts L1, turnRoom).
 *       "The road" of the token programs is a straight way up and down at x 340 (34 cm from the
 *       left edge), between the zone pictures and the maze. It is not printed, but it crosses
 *       printed white lines: the three short lines that join the long line to the maze, one at
 *       the height of each zone, and the cross line of the "tree" at the top. On the road the
 *       robot always faces up; "robot y" says where it is (cm from the top edge).
 *       The two-tokens example learns how far up the road it is with "forward to a white line"
 *       (the line next to zone A); the whole mission knows it from the white line of its team
 *       cube's way. (Only how far up: "WHAT A WHITE-LINE STOP MAKES UP FOR" below.) The
 *       numbers that follow such a stop (LINE_A_Y_CM, RED_WAY.up, GREEN_TO_ROAD.y, RED_TO_ROAD.y)
 *       and the zone heights have two decimals: they are measured, so that the claw closes within
 *       0.75 mm of the middle of every cube, on the drawing and on the picture of the mat, for a
 *       start moved up to 1 cm up or down (the probe sees the line one tick of the simulation
 *       earlier or later: 0.67 mm at 20 RPM; the picture's line edges lie about 0.5 mm off the
 *       drawing's). Then the closing claw moves no cube by more than 0.32 mm.
 *       From the road, a quarter turn to the left and 6.6 cm put the claw around the token of a
 *       zone (zone C's token stands 2.8 mm further left: it sits a little deeper in the claw).
 *       The robot takes the token facing left, so the claw holds it turned by a quarter turn from
 *       the robot: square to the robot, whichever way the robot faces.
 *       At y 328 (TOP_Y_CM 32.8) the robot is on the cross line, at the end of the white diagonal
 *       line on the left; that line points at the RED warehouse. RED: a turn of 45 degrees to the
 *       left and 15.4 cm put the token over its middle, turned like it. GREEN: 55.3 cm to the right
 *       along the cross line (x 893, the end of the diagonal line on the right), a turn of 45
 *       degrees to the left, 15.4 cm. BLUE: 28.1 cm to the right (x 621, the middle line of the
 *       tree), a turn to the left, 6.7 cm. Every token ends within 2.8 mm of the middle of its
 *       warehouse (it may be 6.4 mm off across the short side). After a token is down the robot
 *       backs the same way: after 6.7 cm the open fingers turn 12 mm clear of the blue token.
 *       While the robot turns on the road, the tips of its open claw stay 9.6 mm or more away from
 *       the tokens in the zones, and its body 7 mm or more away from the place of the gate (the
 *       closest is the turn at zone A; at x 345 it was 3.8 mm, so the road moved 5 mm to the left).
 *   - The highest score, 85, can be reached: every warehouse holds a whole cube.
 *
 * The simulated robot is perfect (no wheel slip), so driving by distance is exact here. A real
 * robot drifts: it has to correct its way with the white lines - which is what the line follower
 * starts to show, and what "forward to a white line" does once on every way to a cube. A program
 * that drives by distance needs the robot where the simulator puts it at the start.
 *
 * WHAT A WHITE-LINE STOP MAKES UP FOR, AND WHAT NOT (measured on all 12 draws; samples.test.ts
 * holds both halves). Every such stop is driven facing up the mat, so it tells the robot only how
 * far UP it is:
 *   - a start moved up or down in the Locker Room (the try of the line follower) is made up for:
 *     1 cm either way, every example scores the same;
 *   - a start that is turned, or moved to the left or right (along the bottom line), is NOT: the
 *     robot is then at an angle to its way or beside it, and the stop does not see that. Tried in
 *     steps of 0.1 degree and 0.5 mm, an example keeps its points on all 12 draws only for a start
 *                                 turned by                          moved by
 *       "Deliver the team cube"   1.2 degrees left to 1.1 right      anything inside the Locker Room (7.5 mm)
 *       "Sort two tokens"         0.6 degrees left to 0.4 right      4 mm left to 3 mm right
 *       the whole mission         0.2 degrees left to 0.3 right      2.5 mm left to 3 mm right
 *     on the drawing of the mat. On the picture of the mat - what the line sensor reads in the
 *     browser, so what a student meets - the same, but for the whole mission: there it holds only
 *     to 0.2 degrees and 2.5 mm to the right.
 *     Turned 1 degree to the right, the whole mission scores 55 on the RED draws and 75 to 80 on
 *     the GREEN ones (on the picture 75 on all six); moved 5 mm to the right, 80 on all 12.
 * The screen turns the robot in steps of 1 degree and moves it in steps of 5 mm (1 mm with Shift),
 * so a student can try all of this. No text may promise more than the first line: the note on
 * "forward to a white line" says both halves.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { ProgramJson } from '../core/types';
import {
  and,
  call,
  clawColor,
  clawObjectDetected,
  define,
  eq,
  gripper,
  ifElse,
  ifThen,
  join,
  ledColor,
  lt,
  move,
  moveCm,
  not,
  note,
  print,
  probeColorIs,
  probeDetects,
  program,
  repeatUntil,
  script,
  setVar,
  stopMotors,
  sub,
  turn,
  v,
  wait,
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

/** From the start, this far forward (cm) puts the whole robot inside the Scan Station (its middle at x 1059.9 mm). */
export const TO_STATION_CM = 98.2;
/** The try of the first starter: the shortest drive (cm) that still earns Step 2 (97.4 cm does not). */
export const SHORTEST_TO_STATION_CM = 97.5;
/**
 * The line follower drives this far (cm) before it looks at the line: its sensor is then past the
 * yellow frame of the Locker Room. Yellow is light, so the sensor counts the frame as line, and
 * the frame crosses the white line there. (10 cm is too little for a robot that starts a little
 * crooked: while it steers, a probe can still touch the frame.)
 */
export const PAST_THE_FRAME_CM = 12;
/** When probe L2 sees the yellow frame of the Scan Station, this far more (cm) puts the whole robot inside the station. */
export const INTO_STATION_CM = 16.4;
/** The line follower: speed straight on, and speed of a turn on the spot (RPM) - as in Warehouse Sort. */
export const FOLLOW_RPM = 40;
export const STEER_RPM = 20;
/**
 * After the referee has taken the card away, the robot waits this long (s) without moving. In this
 * simulator the card goes away 2.5 s after the robot stopped and the Team Box is lifted at 4 s
 * (./game.ts CARD_AWAY_S, BOX_LIFT_S): 2 s more leaves half a second to spare.
 */
export const AFTER_CARD_S = 2;
/** The try of the card starter: a shorter wait, which ends the program before the box is lifted. */
export const TOO_SHORT_WAIT_S = 1;

/**
 * "forward to a white line": the speed (RPM) at which the robot drives until its sensor sees a white
 * line across its way. Slowly, so that it stops close to where the line starts: at 20 RPM it rolls
 * 0.67 mm in one tick of the simulation (at 40 RPM, 1.3 mm - too much for a claw that must close
 * on the middle of a cube).
 */
export const TO_LINE_RPM = 20;

/**
 * The way from the Scan Station to the green cube on the green square in the maze, and into the
 * big green circle just below it (cm; see the table above).
 */
export const GREEN_WAY = { back: 43.8, down: 21, away: 6 } as const;
/**
 * The way from the Scan Station to the red cube on the red square in the maze, and into the big red
 * circle on the right (cm). "up" comes after the stop at the white line: measured (see the table above).
 */
export const RED_WAY = { back: 19.7, up: 20.69, toCube: 9.9, toCircle: 20.2, away: 15 } as const;

/** The road of the token programs: 34 cm from the left edge of the mat (x 340 mm). */
export const ROAD_X_CM = 34;
/** From the start, this far forward (cm) brings the robot's middle onto the road. */
export const START_TO_ROAD_CM = 26.2;
/**
 * "robot y" when the robot has stopped at the white line next to zone A, facing up on the road (cm
 * from the top edge). Measured: with it, the claw closes on the middle of each token (see the table above).
 */
export const LINE_A_Y_CM = 86.99;
/** The height (cm from the top edge) of the middle of each zone picture (to 0.1 mm: see the table above). */
export const ZONE_Y_CM = { A: 77.63, B: 61.1, C: 45.79 } as const;
/** From the road, facing left: this far (cm) puts the open claw around the token of a zone. */
export const TO_TOKEN_CM = 6.6;
/** On the road, at this height (cm from the top edge) the robot turns towards the warehouse of the token it holds. */
export const TOP_Y_CM = 32.8;
/**
 * From the road at TOP_Y_CM to each warehouse (cm). RED: a turn of 45 degrees to the left, then along
 * the white diagonal line on the left. GREEN: right along the top, a turn of 45 degrees to the left,
 * then along the white diagonal line on the right. BLUE: right to the middle line of the "tree", a
 * turn to the left, then up.
 */
export const WAREHOUSE_WAY = { red: { diagonal: 15.4 }, green: { across: 55.3, diagonal: 15.4 }, blue: { across: 28.1, up: 6.7 } } as const;
/** After the green circle: left to the road, along the bottom of the field; there "robot y" is this (measured). */
export const GREEN_TO_ROAD = { left: 28.2, y: 113.89 } as const;
/** After the red circle: backward to the road, at the height of the red circle; there "robot y" is this (measured). */
export const RED_TO_ROAD = { back: 47.6, y: 50.65 } as const;

const RED = '#ff0000';
const GREEN = '#00ff00';

// =============================================================================================
// Notes shared by several programs
// =============================================================================================

/** On the first block of every program that drives by distance. */
const BY_DISTANCE_NOTE =
  'This program drives by distance. The robot of the simulator drives exactly. A real robot drifts a little: there, use the white lines to correct the way.';

/** On "moves forward" towards a cube or a token with the open claw. */
const AROUND_THE_CUBE_NOTE = 'The claw is open: its fingers end up on both sides of the cube, without touching it.';

/** On the block that waits for the card. */
const WAIT_FOR_CARD_NOTE =
  'Wait for the referee. In this simulator the card comes 0.5 s after the robot stopped, just in front of the claw. The colour sensor at the claw sees it.';

/** On the wait after the card. */
const WAIT_FOR_BOX_NOTE =
  'Do not move yet! In this simulator the referee lifts the Team Box 4 s after the robot stopped: Step 3, +15 points.';

/** On "set robot y" when the robot has come onto the road. */
const ON_THE_ROAD_NOTE = 'Now the robot is on the road, facing up. "robot y" says where: cm from the top edge of the mat.';

/** On a call of "forward to a white line". (Only how far up: the stop does not see a robot that is turned or beside the road.) */
const TO_THE_LINE_NOTE = 'Up to the white line next to zone A. Now the robot knows how far up the road it is, even if it started a little too high or too low.';

// =============================================================================================
// My-blocks shared by several programs
// =============================================================================================

/**
 * "wait at the Scan Station": the robot stands still, completely inside the Scan Station. Wait for
 * the card, read it into "team colour", wait until the card is gone and the Team Box is lifted.
 */
function waitAtTheScanStation(): DefinitionNode {
  return note(
    define('wait at the Scan Station', [], [
      note(waitUntil(clawObjectDetected()), WAIT_FOR_CARD_NOTE),
      note(setVar('team colour', clawColor()), '"team colour" is now red or green: the colour of the card.'),
      print(join('Team: ', v('team colour'))),
      note(waitUntil(not(clawObjectDetected())), 'The referee takes the card away.'),
      note(wait(AFTER_CARD_S), WAIT_FOR_BOX_NOTE),
    ]),
    'The robot stands still in the Scan Station. It reads the colour card into "team colour" and waits until the Team Box is lifted.',
  );
}

/**
 * "forward to a white line": drive slowly until probe L1 sees white, then stop. Used where a white
 * line crosses the robot's way: the robot then knows how far it has come along that way - which
 * makes up for a start moved up or down, not for a robot that is turned or beside its way (the
 * table at the top of this file has the measured numbers). The note says both.
 */
function forwardToAWhiteLine(): DefinitionNode {
  return note(
    define('forward to a white line', [], [
      move('forward', TO_LINE_RPM),
      note(waitUntil(probeDetects('L1', 'line')), 'L1 is a middle probe of the sensor under the front of the robot. On this mat "detects line" means white.'),
      stopMotors('all'),
    ]),
    'Forward slowly until the sensor sees a white line, then stop. Now the robot knows how far up it is, even if it started a little too high or too low. ' +
      'This does not help if it started turned, or too far left or right.',
  );
}

/** "bring the green cube": from the Scan Station (facing right, box lifted) to the green cube on its square, and into the big green circle. */
function bringTheGreenCube(): DefinitionNode {
  return note(
    define('bring the green cube', [], [
      note(moveCm('backward', GREEN_WAY.back), 'Back along the bottom line, until the robot is right below the green cube.'),
      note(turn('left', 90), 'Face up, at the green cube.'),
      note(call('forward to a white line'), 'Up to the white line at the bottom of the maze. The open claw is now around the green cube, without touching it.'),
      gripper('close'),
      note(moveCm('backward', GREEN_WAY.down), 'Back down with the cube: now it is over the middle of the big green circle.'),
      note(gripper('open'), 'The cube stands completely inside the big green circle. Green team: +20 points, and the gate opens (+5).'),
      note(moveCm('backward', GREEN_WAY.away), 'Back, away from the cube.'),
    ]),
    'From the Scan Station to the green cube on the green square in the maze. Take it, and put it in the middle of the big green circle, just below.',
  );
}

/** "bring the red cube": from the Scan Station (facing right, box lifted) to the red cube on its square, and into the big red circle. */
function bringTheRedCube(): DefinitionNode {
  return note(
    define('bring the red cube', [], [
      note(moveCm('backward', RED_WAY.back), 'Back along the bottom line a little.'),
      note(turn('left', 90), 'Face up.'),
      note(call('forward to a white line'), 'Up to the short white line on the right of the maze.'),
      note(moveCm('forward', RED_WAY.up), 'Up to the height of the red cube.'),
      note(turn('left', 90), 'Face left, at the red cube.'),
      note(moveCm('forward', RED_WAY.toCube), AROUND_THE_CUBE_NOTE),
      gripper('close'),
      note(turn('right', 180), 'Turn around with the cube: now the robot faces the big red circle.'),
      note(moveCm('forward', RED_WAY.toCircle), 'Now the cube is over the middle of the circle.'),
      note(gripper('open'), 'The cube stands completely inside the big red circle. Red team: +20 points, and the gate opens (+5).'),
      note(moveCm('backward', RED_WAY.away), 'Back, away from the cube.'),
    ]),
    'From the Scan Station to the red cube on the red square in the maze. Take it, and put it in the middle of the big red circle, on the right.',
  );
}

/** "drive on the road to" y: forward when the place is higher up the mat, backward when it is lower. */
function driveOnTheRoad(): DefinitionNode {
  return note(
    define('drive on the road to', ['y'], [
      ifElse(
        lt(v('y'), v('robot y')),
        [moveCm('forward', sub(v('robot y'), v('y')))],
        [moveCm('backward', sub(v('y'), v('robot y')))],
      ),
      setVar('robot y', v('y')),
    ]),
    'On the road the robot always faces up. "robot y" is where it is: cm from the top edge of the mat. To get to y it drives forward (up) or backward (down).',
  );
}

/** "take the token at" a zone's height: from the road to the token, read its colour, grip it, and back onto the road. */
function takeTheToken(): DefinitionNode {
  return note(
    define('take the token at', ['zone y'], [
      call('drive on the road to', v('zone y')),
      note(turn('left', 90), 'Face left, at the zone picture.'),
      note(moveCm('forward', TO_TOKEN_CM), AROUND_THE_CUBE_NOTE),
      note(setVar('token colour', clawColor()), 'The colour sensor at the claw sees the token between the open fingers: "token colour" is now red, green or blue.'),
      print(join('Token: ', v('token colour'))),
      gripper('close'),
      moveCm('backward', TO_TOKEN_CM),
      note(turn('right', 90), 'On the road again, facing up.'),
    ]),
    'From the road to the token of the zone at "zone y". Read its colour into "token colour", take it, and come back onto the road.',
  );
}

/**
 * "put the token in its warehouse": up the road to TOP_Y_CM; the colour that was read decides the
 * warehouse; drive there, put the token down, and come back onto the road, facing up.
 */
function putTheTokenInItsWarehouse(): DefinitionNode {
  return note(
    define('put the token in its warehouse', [], [
      note(call('drive on the road to', TOP_Y_CM), `Up the road to the white cross line at the top: ${TOP_Y_CM} cm from the top edge.`),
      note(
        ifElse(
          eq(v('token colour'), 'red'),
          [
            note(turn('left', 45), 'Face up to the left, along the white diagonal line: at the RED warehouse.'),
            note(moveCm('forward', WAREHOUSE_WAY.red.diagonal), 'Now the token is over the middle of the RED warehouse, turned like it.'),
            note(gripper('open'), 'The token stands completely inside the RED warehouse: +10 points.'),
            moveCm('backward', WAREHOUSE_WAY.red.diagonal),
            note(turn('right', 45), 'On the road again, facing up.'),
          ],
          [
            ifElse(
              eq(v('token colour'), 'green'),
              [
                note(turn('right', 90), 'Face right.'),
                note(moveCm('forward', WAREHOUSE_WAY.green.across), 'Along the white cross line, to the white diagonal line on the right.'),
                note(turn('left', 45), 'Face up to the right, along the white diagonal line: at the GREEN warehouse.'),
                note(moveCm('forward', WAREHOUSE_WAY.green.diagonal), 'Now the token is over the middle of the GREEN warehouse, turned like it.'),
                note(gripper('open'), 'The token stands completely inside the GREEN warehouse: +10 points.'),
                moveCm('backward', WAREHOUSE_WAY.green.diagonal),
                note(turn('right', 45), 'Face right.'),
                note(moveCm('backward', WAREHOUSE_WAY.green.across), 'Backward, all the way to the road.'),
                note(turn('left', 90), 'On the road again, facing up.'),
              ],
              [
                note(turn('right', 90), 'Face right.'),
                note(moveCm('forward', WAREHOUSE_WAY.blue.across), 'To the white line in the middle, below the BLUE warehouse.'),
                note(turn('left', 90), 'Face up, at the BLUE warehouse.'),
                note(moveCm('forward', WAREHOUSE_WAY.blue.up), 'Now the token is over the middle of the BLUE warehouse.'),
                note(gripper('open'), 'The token stands completely inside the BLUE warehouse: +10 points.'),
                moveCm('backward', WAREHOUSE_WAY.blue.up),
                note(turn('right', 90), 'Face right.'),
                note(moveCm('backward', WAREHOUSE_WAY.blue.across), 'Backward to the road.'),
                note(turn('left', 90), 'On the road again, facing up.'),
              ],
            ),
          ],
        ),
        'The warehouses are at the top: RED on the left, BLUE in the middle, GREEN on the right. Not red and not green means blue.',
      ),
    ]),
    'The robot holds a token on the road. Up to the top. "token colour" decides the warehouse. Drive there, put the token in it, and come back to the road, facing up.',
  );
}

// =============================================================================================
// 1. locker-to-station
// =============================================================================================
// Measured (samples.test.ts): 15 points on all 12 arrangements (Step 1 at 1.50 s, Step 2 at
// 5.85 s), the program ends after 5.92 s, the robot's middle at x 1059.9 (7.6 mm of room behind
// it in the Scan Station, 8.1 mm in front). No cube moves. The Team Box is not lifted: the match
// ends with the program, 0.07 s after the robot stopped (Step 3 needs 4 s - see the card starter).
// The try (a shorter drive): 97.5 cm still earns the 10 points of Step 2, 97.4 cm does not.

const toStation: SampleProgram = {
  ...exampleCard('locker-to-station'),
  description:
    `A first program. The robot drives ${TO_STATION_CM} cm straight ahead, along the bottom line, and stops. ` +
    'On the way the whole robot leaves the Locker Room: +5 points. ' +
    'It stops with the whole robot inside the Scan Station, still carrying the Team Box: +10 points. ' +
    'It scores 15 points on every draw, after 6 seconds. ' +
    'Try a shorter drive. How short can it be, and still earn the 10 points?',
  program: program([
    script(note(whenStart(), 'A first program. Change the number, then press Start again.'), [
      print('Go!'),
      note(
        moveCm('forward', TO_STATION_CM),
        'The robot faces right, along the bottom line. The WHOLE robot must leave the Locker Room, and the WHOLE robot must be inside the Scan Station.',
      ),
      print('In the station'),
    ]),
  ]),
};

// =============================================================================================
// 2. locker-follow-line
// =============================================================================================
// Measured (samples.test.ts), on the vector drawing of the mat and on the picture the browser
// reads: 15 points on all 12 arrangements (Step 1 at 1.73 s, Step 2 at 6.94 s); the program ends
// after 7.01 s (7.02 s on the picture), the robot's middle on the middle of the line, 6.9 mm (8.3 mm
// on the picture) of room behind it in the Scan Station. Started up to 2.5 degrees crooked, up to
// 1 cm beside the line and 5 mm further forward or back (27 starts, all still in the Locker Room),
// it stops inside the Scan Station every time, on the drawing and on the picture: 6.9 to 9.3 mm of
// room behind it, at most 5.0 mm beside the line, after 6.98 to 7.53 s. Started 5 degrees crooked
// it still gets there from the line, or from 1 cm beside it pointing back towards it; from 5 mm or
// 1 cm beside it pointing away, its middle probes miss the line after the first 12 cm and it stands
// still until the end of the match (0 points) - the line follower has no "the line is lost" branch.
// With 10 cm instead of 12 before it looks, a start 2.5 degrees crooked and 1 cm beside the line
// goes wrong: while the robot steers, probe L2 touches the yellow frame of the Locker Room, the
// loop ends there, and the robot stops 16.4 cm further on, far from the Scan Station (5 points).
// The try (the robot moved 1 cm up or down before Start - the arrow keys move it 5 mm, it stays
// inside the Locker Room): it steers back onto the line and stops inside the Scan Station, 15 points
// on all 12 draws. (Not "wait 5 s at the end": that earns the +15 of Step 3 here without reading
// the card - the referee of the simulator cannot see what a program reads - and would teach that
// Step 3 needs no scan. Reading the card is the next example.)

const followLine: SampleProgram = {
  ...exampleCard('locker-follow-line'),
  description:
    'A line follower for this mat. Here the lines are WHITE on a black mat. ' +
    `The robot drives ${PAST_THE_FRAME_CM} cm, past the yellow frame of the Locker Room. Then it follows the bottom line with the Quad RGB sensor. ` +
    'L1 and R1 both see the line: straight on. Only L1: turn left a little. Only R1: turn right a little. ' +
    `When probe L2 sees yellow, it is at the frame of the Scan Station: ${INTO_STATION_CM} cm more, and it stops inside. ` +
    'It scores 15 points on every draw, after 7 seconds. ' +
    'Try to move the robot 1 cm up or down in the Locker Room before you press Start. Does it still find the line?',
  program: program([
    script(note(whenStart(), 'On this mat the line is white. The robot of the simulator knows that: "detects line" means white here.'), [
      note(
        moveCm('forward', PAST_THE_FRAME_CM),
        'Out of the yellow frame of the Locker Room first. Yellow is light too: the sensor would see it as line.',
      ),
      note(
        repeatUntil(probeColorIs('L2', 'yellow'), [
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
        'Until probe L2 sees yellow. L2 is the outer probe on the left: beside the white line, on the yellow frame of the Scan Station.',
      ),
      note(moveCm('forward', INTO_STATION_CM), 'From the frame into the Scan Station. Then the whole robot is inside it: +10 points.'),
      print('In the station'),
    ]),
  ]),
};

// =============================================================================================
// 3. locker-read-card
// =============================================================================================
// Measured (samples.test.ts): on all 12 arrangements the screen shows the team colour - "red" on
// the 6 RED arrangements, "green" on the 6 GREEN ones - and the LEDs light in it; 30 points (Step 1
// at 1.50 s, Step 2 at 5.85 s, Step 3 at 9.91 s: the robot stopped at 5.91 s, the referee showed the
// card at 6.41 s and took it away at 8.41 s), the program ends after 10.42 s. The card is read with
// the arm down (the arm never moves in these examples). No cube moves.
// The default arrangement (G5): "Team: green", green LEDs, 30 points, 10.42 s.
// The try (wait 1 s instead of 2): the program ends at 9.42 s, before the referee lifts the Team
// Box: 15 points on all 12.

const readCard: SampleProgram = {
  ...exampleCard('locker-read-card'),
  description:
    'The robot drives into the Scan Station and stops. Then it waits for the referee. ' +
    'The referee holds the colour card in front of the claw. The colour sensor at the claw reads it: red or green. ' +
    'The screen shows the team colour, and the LEDs light in it. ' +
    `The robot waits until the card is gone, and ${AFTER_CARD_S} seconds more. In this simulator the referee lifts the Team Box 4 seconds after the robot stopped. ` +
    'It scores 30 points on every draw, after 10.4 seconds. ' +
    'Try a shorter wait at the end, like 1 second. What happens to the 15 points of Step 3?',
  program: program([
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_STATION_CM), 'Into the Scan Station. The whole robot is inside it now, with the Team Box: +10 points.'),
      note(waitUntil(clawObjectDetected()), WAIT_FOR_CARD_NOTE),
      note(setVar('team colour', clawColor()), '"team colour" is now red or green: the colour of the card.'),
      print(join('Team: ', v('team colour'))),
      note(ifElse(eq(v('team colour'), 'red'), [ledColor('all', RED)], [ledColor('all', GREEN)]), 'The card is red or green: not red means green.'),
      note(waitUntil(not(clawObjectDetected())), 'The referee takes the card away.'),
      note(wait(AFTER_CARD_S), WAIT_FOR_BOX_NOTE),
      print('Ready'),
    ]),
  ]),
};

// =============================================================================================
// 4. locker-team-cube
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture: 55 points on all 12 arrangements
// (Steps 1, 2 and 3 as in the card starter, Step 5 +20 and Step 6 +5; the gate opens), never a wrong
// delivery, the gate never touched, the cube of the other colour and the tokens never moved.
//   - RED (6 arrangements): the red cube is in the big red circle at 23.09 s, 1.5 mm from its middle;
//     the program ends after 24.15 s.
//   - GREEN (6 arrangements): the green cube is in the big green circle at 18.66 s, 1.7 mm from its
//     middle; the program ends after 19.18 s. (The default arrangement, G5, is a GREEN one: 55 points,
//     19.18 s.)
// Started 1 cm (or less) higher or lower in the Locker Room: the same 55 points on all 12, ending
// 0.15 s sooner or later - "forward to a white line" tells the robot how far up it has come. (A
// turned start is not made up for: from 1.2 degrees to the right, or 1.3 to the left, the GREEN
// draws score 30 - the claw pushes the green cube, so nothing is delivered.)
// The try (the two ways swapped in the "if"): the cube of the other colour goes into its own
// circle - a wrong delivery, -10, and the gate stays closed: 20 points on all 12.

const teamCube: SampleProgram = {
  ...exampleCard('locker-team-cube'),
  description:
    'The first half of the mission. The robot drives into the Scan Station, reads the colour card and waits until the Team Box is lifted. ' +
    'Then "team colour" decides the way. ' +
    'Red: it takes the red cube from the red square in the maze to the big red circle. ' +
    'Green: it takes the green cube from the green square to the big green circle. The gate opens. ' +
    'On the way up it stops at a white line: then it knows how far up it is. ' +
    'It scores 55 points on all 12 draws, after 19 to 24 seconds. ' +
    'Try to swap the two ways in the "if" block. What does a wrong delivery cost?',
  program: program([
    waitAtTheScanStation(),
    forwardToAWhiteLine(),
    bringTheRedCube(),
    bringTheGreenCube(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_STATION_CM), 'Into the Scan Station. The whole robot is inside it now, with the Team Box.'),
      call('wait at the Scan Station'),
      note(
        ifElse(eq(v('team colour'), 'red'), [call('bring the red cube')], [call('bring the green cube')]),
        'The card decides: the cube of the team colour goes into the big circle of that colour.',
      ),
    ]),
  ]),
};

// =============================================================================================
// 5. locker-two-tokens
// =============================================================================================
// Measured (samples.test.ts), on the drawing and on the picture, the same on both team colours:
// 25 points on all 12 arrangements (leave the Locker Room 5; each of the two tokens completely
// inside the warehouse of its colour, 10 + 10). How long it takes depends on the colours in zones A
// and B: RED and BLUE (zone cards 2 and 5) 26.40 s, RED and GREEN (1 and 3) 30.16 s, GREEN and
// BLUE (4 and 6) 34.26 s - the GREEN warehouse is the farthest from the road, the RED one the
// nearest. (The default arrangement, G5 - BLUE in A, RED in B: 25 points, 26.40 s.) Every token
// ends within 1.2 mm of the middle of its warehouse (1.6 mm with the start moved); the token of
// zone C and the team cubes are never touched, and neither is the closed gate. Started 1 cm (or
// less) higher or lower: the same points.
// The try (zone C too: "take the token at 45.79" and "put the token in its warehouse" once more):
// 35 points on all 12, after 40.78 s. The text gives the 45.79: the zones are not evenly spaced
// (A to B 16.53 cm, B to C 15.31 cm), and the guess a student makes from the two numbers in the
// blocks - 44.57, the same step again - misses the token: 25 points, "not in a warehouse" (any
// number from 45 to 46.5 scores the 35).

const twoTokens: SampleProgram = {
  ...exampleCard('locker-two-tokens'),
  description:
    'The robot leaves the Locker Room (+5 points) and drives to "the road", between the zone pictures and the maze. ' +
    'Up the road, it stops at the white line next to zone A. ' +
    'It takes the token of zone A and reads its colour. It puts it into the warehouse of that colour, at the top. Then the same with zone B. ' +
    'The RED and GREEN warehouses are turned: the robot drives along a white diagonal line, so the token is turned like them. ' +
    'It scores 25 points on all 12 draws, after 26 to 34 seconds. ' +
    'It does not open the gate. In this simulator the tokens count all the same (the rules do not say). ' +
    `Try zone C too: it is ${ZONE_Y_CM.C} cm from the top edge.`,
  program: program([
    forwardToAWhiteLine(),
    driveOnTheRoad(),
    takeTheToken(),
    putTheTokenInItsWarehouse(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', START_TO_ROAD_CM), 'Out of the Locker Room (+5 points), to the road.'),
      note(turn('left', 90), 'Face up.'),
      note(call('forward to a white line'), TO_THE_LINE_NOTE),
      note(setVar('robot y', LINE_A_Y_CM), ON_THE_ROAD_NOTE),
      note(call('take the token at', ZONE_Y_CM.A), `Zone A, the lowest zone picture: ${ZONE_Y_CM.A} cm from the top edge.`),
      call('put the token in its warehouse'),
      note(call('take the token at', ZONE_Y_CM.B), `Zone B, the middle one: ${ZONE_Y_CM.B} cm.`),
      call('put the token in its warehouse'),
    ]),
  ]),
};

// =============================================================================================
// 6. locker-whole-mission
// =============================================================================================
// How it works: the first half is "Deliver the team cube" (the card decides the way); from the
// big circle the robot drives onto the road, and then it does with zones A, B and C what "Sort two
// tokens" does with A and B. It never assumes an arrangement: the card is read in one place
// ("wait at the Scan Station"), every token in one place ("take the token at"), and every colour
// a block names is compared with what was read.
// Measured (samples.test.ts), on the drawing and on the picture: 85 points on all 12 arrangements
// - every point there is (Steps 1, 2, 3, 5, 6 = 55; each token completely inside the warehouse of
// its colour, 3 x 10). Never a wrong delivery, the gate never touched, nothing pushed. Every token
// ends within 2.6 mm of the middle of its warehouse (2.8 mm with the start moved; the token of
// zone C sits 2.8 mm deeper in the claw). The program ends after 63.69 s on the 6 RED arrangements
// and 58.71 s on the 6 GREEN ones (the default, G5: 58.71 s): every draw has one token of each
// colour, so the way is as long on all six zone cards. Started 1 cm (or less) higher or
// lower: the same 85, 0.15 s sooner or later. The try (the zones in the order C, B, A) also scores
// 85 on all 12, and is slower on all 12: 64.27 s (RED), 62.51 s (GREEN).

const wholeMission: SampleProgram = {
  ...exampleCard('locker-whole-mission'),
  description:
    'The whole mission, for every draw. At the Scan Station the robot reads the card and waits until the Team Box is lifted. ' +
    'Then it brings the cube of its team colour into the big circle of that colour, and the gate opens. ' +
    'Then it takes the tokens of zones A, B and C, one after the other. It reads the colour of each one and puts it into the warehouse of that colour. ' +
    'It never guesses a colour. ' +
    'It scores 85 points on all 12 draws, in 59 to 64 of the 150 seconds. 85 is the most a match can give. ' +
    'Try the zones in the order C, B, A. Is it faster?',
  program: program([
    waitAtTheScanStation(),
    forwardToAWhiteLine(),
    bringTheRedCube(),
    bringTheGreenCube(),
    driveOnTheRoad(),
    takeTheToken(),
    putTheTokenInItsWarehouse(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_STATION_CM), 'Into the Scan Station. The whole robot is inside it now, with the Team Box.'),
      call('wait at the Scan Station'),
      note(
        ifElse(
          eq(v('team colour'), 'red'),
          [
            call('bring the red cube'),
            note(moveCm('backward', RED_TO_ROAD.back), 'Backward to the road, at the height of the big red circle.'),
            note(turn('left', 90), 'Face up.'),
            note(setVar('robot y', RED_TO_ROAD.y), ON_THE_ROAD_NOTE),
          ],
          [
            call('bring the green cube'),
            note(turn('left', 90), 'Face left.'),
            note(moveCm('forward', GREEN_TO_ROAD.left), 'To the road.'),
            note(turn('right', 90), 'Face up.'),
            note(setVar('robot y', GREEN_TO_ROAD.y), ON_THE_ROAD_NOTE),
          ],
        ),
        'The card decides: the cube of the team colour goes into the big circle of that colour. Then onto the road.',
      ),
      ...everyToken(),
    ]),
  ]),
};

/** The three "take the token at" + "put the token in its warehouse" of the advanced example: zone A, B, then C. */
function everyToken(): BlockNode[] {
  return [
    note(call('take the token at', ZONE_Y_CM.A), `Zone A, the lowest zone picture: ${ZONE_Y_CM.A} cm from the top edge.`),
    call('put the token in its warehouse'),
    note(call('take the token at', ZONE_Y_CM.B), `Zone B, the middle one: ${ZONE_Y_CM.B} cm.`),
    call('put the token in its warehouse'),
    note(call('take the token at', ZONE_Y_CM.C), `Zone C, the top one: ${ZONE_Y_CM.C} cm.`),
    call('put the token in its warehouse'),
  ];
}

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Locker Room, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [toStation, followLine, readCard, teamCube, twoTokens, wholeMission];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
