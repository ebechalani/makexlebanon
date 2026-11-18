/**
 * Ready-made block programs for the Locker Room simulator (MakeX Lebanon, Season 2026, Capelli
 * Starter, ages 13-15).
 *
 *   locker-to-station      starter       drive by distance: out of the Locker Room, into the Scan Station
 *   locker-follow-line     starter       follow the WHITE bottom line to the yellow frame of the Scan Station
 *   locker-read-card       starter       stop in the Scan Station, read the referee's colour card, wait until the Team Box is lifted
 *   locker-team-cube       intermediate  read the card, then bring the cube of the team colour into the big circle of that colour
 *   locker-two-tokens      intermediate  read the tokens of zones A and B and put each on the maze target of its colour
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
 * the back of the body 70 mm behind.
 *
 *   - The Locker Room (its yellow frame included) ends at x 252.8: the whole robot is out of it
 *     when its middle is past x 322.8 (24.5 cm of driving). The Scan Station (its frame included)
 *     starts at x 982.3: the whole robot is inside it with its middle between x 1052.3 and 1068.0.
 *     98.2 cm forward puts it at x 1059.9 (7.6 mm of room behind, 8.1 mm in front).
 *   - The team cubes stand turned by 45 degrees in the middle of the red rectangle at the top left
 *     (130.8, 118.5) and of the green one at the top right (1102.5, 118.9) - ./field.ts MARK_ROLES.
 *     The white diagonal lines of the "tree" above the maze point at them. A cube is 50 mm wide;
 *     the open claw is 64 mm wide, so each finger passes the cube with 7 mm to spare.
 *       GREEN: from the Scan Station up 69.0 cm, a turn of 45 degrees to the left, 18.2 cm: the
 *       robot is on the tree's right diagonal line, facing along it after a turn of 90 degrees to the
 *       right; 10 cm on puts the claw around the cube. Back 10 cm, down 64.4 cm, 16.6 cm to the left:
 *       the cube is over the middle of the big green circle (623.6, 933.2).
 *       RED: up 76.8 cm (not higher: the fingers stay 19 mm below the green cube), 70.8 cm to the
 *       left, a turn of 45 degrees to the right: the robot faces the red cube along the tree's left
 *       diagonal line; 17.1 cm on puts the claw around it. Back 40.5 cm along the same line, down to
 *       y 505.6, the height of the big red circle; a turn to the right and 44.8 cm put the cube over
 *       its middle (1107.7, 505.3).
 *   - The tokens stand in the middle of the zone pictures on the left: zone A (130.8, 776.3), B
 *     (130.8, 611.0), C (133.6, 457.9). The maze targets: the red square (621.9, 506.4), the blue disc
 *     (618.4, 615.1), the green square (621.9, 723.3).
 *       "The road" of the token programs is a straight way up and down at x 340 (34 cm from the
 *       left edge), between the zone pictures and the maze. It is not printed: the robot drives it
 *       by distance, and on it always faces up; "robot y" says where it is (cm from the top edge).
 *       From the road, a quarter turn to the left and 6.6 cm put the claw around the token of a
 *       zone; a quarter turn to the right and 14 cm put a token in the claw over its target. While
 *       the robot turns on the road, the tips of its open claw stay 9.6 mm or more away from the
 *       tokens in the zones, and its body 7 mm or more away from the place of the gate (the closest
 *       is the turn at zone A; at x 345 it was 3.8 mm, so the road moved 5 mm to the left).
 *   - With 50 mm cubes, a token can never be COMPLETELY inside the red or the green square (41.9 mm):
 *     the red and the green token can only earn 5 points each (half points), the blue one 10. So
 *     the most a match can give in this simulator is 75 of the 85 points (./game.ts L1).
 *
 * The simulated robot is perfect (no wheel slip), so driving by distance is exact here. A real
 * robot drifts: it has to correct its way with the white lines - which is what the line follower
 * starts to show. Every program that drives by distance needs the robot where the simulator puts
 * it at the start. The distances are whole millimetres, so a cube is a fraction of a millimetre off
 * the middle of the claw when the claw closes: the closing claw moves it to the middle, by 0.32 mm at
 * most on the 72 matches of the tests (they allow less than 0.5 mm in the moment of gripping, and no
 * other move of a cube that is not in the claw).
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

/** The way from the Scan Station to the green cube and into the big green circle (cm; see the table above). */
export const GREEN_WAY = { up: 69.0, diagonal: 18.2, toCube: 10, down: 64.4, toCircle: 16.6 } as const;
/** The way from the Scan Station to the red cube and into the big red circle (cm). */
export const RED_WAY = { up: 76.8, left: 70.8, toCube: 17.1, back: 40.5, toCircle: 44.8 } as const;
/** After a delivery the robot backs away this far (cm). */
export const AWAY_FROM_CUBE_CM = 15;

/** The road of the token programs: 34 cm from the left edge of the mat (x 340 mm). */
export const ROAD_X_CM = 34;
/** From the start, this far forward (cm) brings the robot's middle onto the road. */
export const START_TO_ROAD_CM = 26.2;
/** Where the robot's middle is at the start: cm from the top edge (y 1108.1 mm). */
export const START_Y_CM = 110.8;
/** The height (cm from the top edge) of the middle of each zone picture ... */
export const ZONE_Y_CM = { A: 77.6, B: 61.1, C: 45.8 } as const;
/** ... and of each maze target. */
export const TARGET_Y_CM = { red: 50.6, blue: 61.5, green: 72.3 } as const;
/** From the road, facing left: this far (cm) puts the open claw around the token of a zone. */
export const TO_TOKEN_CM = 6.6;
/** From the road, facing right: this far (cm) puts the token in the claw over its target. */
export const TO_TARGET_CM = 14;
/** After the green circle: up this far (cm) - the robot then passes 14 mm above the place of the gate - and this far left to the road. */
export const GREEN_TO_ROAD = { up: 18.3, left: 57.5, y: 75 } as const;
/** After the red circle: this far left (cm) to the road, at the height of the red circle. */
export const RED_TO_ROAD = { left: 47.5, y: 50.6 } as const;

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

/** "bring the green cube": from the Scan Station (facing right, box lifted) to the green cube, and into the big green circle. */
function bringTheGreenCube(): DefinitionNode {
  return note(
    define('bring the green cube', [], [
      note(turn('left', 90), 'Face up.'),
      note(moveCm('forward', GREEN_WAY.up), 'Up the right side of the field.'),
      turn('left', 45),
      note(moveCm('forward', GREEN_WAY.diagonal), 'Now the robot is on the white diagonal line on the right. It points at the green cube.'),
      note(turn('right', 90), 'Face along the diagonal line, up to the right.'),
      note(moveCm('forward', GREEN_WAY.toCube), AROUND_THE_CUBE_NOTE),
      gripper('close'),
      moveCm('backward', GREEN_WAY.toCube),
      note(turn('right', 135), 'Face down.'),
      note(moveCm('forward', GREEN_WAY.down), 'Down to the height of the big green circle.'),
      note(turn('right', 90), 'Face left, at the big green circle.'),
      note(moveCm('forward', GREEN_WAY.toCircle), 'Now the cube is over the middle of the circle.'),
      note(gripper('open'), 'The cube stands completely inside the big green circle. Green team: +20 points, and the gate opens (+5).'),
      note(moveCm('backward', AWAY_FROM_CUBE_CM), 'Back, away from the cube.'),
    ]),
    'From the Scan Station to the green cube at the top right. Take it, and put it in the middle of the big green circle.',
  );
}

/** "bring the red cube": from the Scan Station (facing right, box lifted) to the red cube, and into the big red circle. */
function bringTheRedCube(): DefinitionNode {
  return note(
    define('bring the red cube', [], [
      note(turn('left', 90), 'Face up.'),
      note(moveCm('forward', RED_WAY.up), 'Up the right side. Not higher: the green cube stands at the top right.'),
      note(turn('left', 90), 'Face left.'),
      note(moveCm('forward', RED_WAY.left), 'Along the top of the field, to the end of the white diagonal line on the left.'),
      note(turn('right', 45), 'Face up to the left: the diagonal line points at the red cube.'),
      note(moveCm('forward', RED_WAY.toCube), AROUND_THE_CUBE_NOTE),
      gripper('close'),
      note(moveCm('backward', RED_WAY.back), 'Back along the same line, down to the height of the big red circle.'),
      note(turn('right', 135), 'Face right, at the big red circle.'),
      note(moveCm('forward', RED_WAY.toCircle), 'Now the cube is over the middle of the circle.'),
      note(gripper('open'), 'The cube stands completely inside the big red circle. Red team: +20 points, and the gate opens (+5).'),
      note(moveCm('backward', AWAY_FROM_CUBE_CM), 'Back, away from the cube.'),
    ]),
    'From the Scan Station to the red cube at the top left. Take it, and put it in the middle of the big red circle.',
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

/** "put the token on its target": the colour that was read decides the target; drive there on the road, put the token down, and back. */
function putTheTokenOnItsTarget(): DefinitionNode {
  return note(
    define('put the token on its target', [], [
      note(
        ifElse(
          eq(v('token colour'), 'red'),
          [call('drive on the road to', TARGET_Y_CM.red)],
          [ifElse(eq(v('token colour'), 'green'), [call('drive on the road to', TARGET_Y_CM.green)], [call('drive on the road to', TARGET_Y_CM.blue)])],
        ),
        'Red square 50.6 cm, green square 72.3 cm, blue disc 61.5 cm from the top edge. Not red and not green means blue.',
      ),
      note(turn('right', 90), 'Face right, into the maze.'),
      note(moveCm('forward', TO_TARGET_CM), 'Now the token is over the middle of its target.'),
      note(gripper('open'), 'On the blue disc a token fits completely: +10. On a small square only partly: +5.'),
      note(moveCm('backward', TO_TARGET_CM), 'Back onto the road. The open fingers do not touch the token.'),
      turn('left', 90),
    ]),
    'The robot holds a token on the road. "token colour" decides the target. Drive there, put the token on it, and come back facing up.',
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
// Measured (samples.test.ts): 55 points on all 12 arrangements (Steps 1, 2 and 3 as in the card
// starter, Step 5 +20 and Step 6 +5; the gate opens), never a wrong delivery, the gate never
// touched, the cube of the other colour never moved.
//   - RED (6 arrangements): the red cube is in the big red circle at 28.04 s, 0.4 mm from its middle
//     (67.7 mm inside its edge); the program ends after 29.10 s.
//   - GREEN (6 arrangements): the green cube is in the big green circle at 24.98 s, 0.2 mm from its
//     middle (69.2 mm inside its edge); the program ends after 26.04 s. (The default arrangement,
//     G5, is a GREEN one: 55 points, 26.04 s.)
// The closing claw moves a team cube by a fraction of a millimetre to the middle of its fingers (the
// robot arrives up to 0.5 mm beside the cube's middle: the distances are whole millimetres).
// The try (the two ways swapped in the "if"): the cube of the other colour goes into its own
// circle - a wrong delivery, -10, and the gate stays closed: 20 points on all 12.

const teamCube: SampleProgram = {
  ...exampleCard('locker-team-cube'),
  description:
    'The first half of the mission. The robot drives into the Scan Station, reads the colour card and waits until the Team Box is lifted. ' +
    'Then "team colour" decides the way. ' +
    'Red: it takes the red cube at the top left and puts it into the big red circle. ' +
    'Green: it takes the green cube at the top right and puts it into the big green circle. Then the gate opens. ' +
    'It scores 55 points on all 12 draws, after 26 to 29 seconds. ' +
    'Try to swap the two ways in the "if" block. What does a wrong delivery cost?',
  program: program([
    waitAtTheScanStation(),
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
// Measured (samples.test.ts), the same on both team colours:
//   - zone cards 1 and 3 (RED and GREEN in zones A and B): 15 points - leave the Locker Room 5, the
//     red and the green token each partly inside its square 5; the program ends after 17.74 s
//     (option 1) or 16.45 s (option 3);
//   - zone cards 2, 4, 5 and 6 (BLUE in zone A or B): 20 points - 5, the blue token completely on
//     the blue disc 10, the other token partly inside its square 5; the program ends after 15.84 to
//     17.09 s (the default arrangement, G5 - BLUE in A, RED in B: 20 points, 16.44 s).
// Every token is put down 4.6 mm (blue) or 1.2 mm (red, green) from the middle of its target, the
// token of zone C and the team cubes are never touched, and neither is the closed gate (the robot
// passes 7 mm from it when it turns at zone A).
// The try (zone C too: "take the token at 45.8" and "put the token on its target" once more): 25
// points on all 12, after 22.39 to 25.59 s.

const twoTokens: SampleProgram = {
  ...exampleCard('locker-two-tokens'),
  description:
    'The robot leaves the Locker Room and drives to "the road": a straight way between the zone pictures and the maze. ' +
    'It takes the token in zone A and reads its colour. It puts it on the target of that colour in the maze. Then the same with zone B. ' +
    '"robot y" says where the robot is on the road. ' +
    'It scores 20 points on 8 of the 12 draws and 15 on the other 4, after 16 to 18 seconds. ' +
    'A blue token fits completely on the blue disc: 10 points. A red or green token is bigger than its square: only partly inside, 5 points. ' +
    'It does not open the gate. In this simulator the tokens count all the same (the rules do not say). ' +
    'Try zone C too.',
  program: program([
    driveOnTheRoad(),
    takeTheToken(),
    putTheTokenOnItsTarget(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', START_TO_ROAD_CM), 'Out of the Locker Room (+5 points), to the road.'),
      note(turn('left', 90), 'Face up.'),
      note(setVar('robot y', START_Y_CM), ON_THE_ROAD_NOTE),
      note(call('take the token at', ZONE_Y_CM.A), 'Zone A, the lowest zone picture: 77.6 cm from the top edge.'),
      call('put the token on its target'),
      note(call('take the token at', ZONE_Y_CM.B), 'Zone B, the middle one: 61.1 cm.'),
      call('put the token on its target'),
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
// Measured (samples.test.ts): 75 points on all 12 arrangements - the most this simulator gives
// (Steps 1, 2, 3, 5, 6 = 55; the blue token completely on the blue disc 10; the red and the green
// token each partly inside its square 5). Never a wrong delivery, the gate never touched, nothing
// pushed (the closing claw moves a cube by 0.32 mm at most to the middle of its fingers). Every token
// ends 1.0 to 2.2 mm (red, green) or 2.4 to 5.5 mm (blue) from the middle of its target. The program
// ends after 50.78 to 56.68 s (53.48 to 56.68 s for RED, 50.78 to 53.98 s for GREEN; 52.03 s on the
// default arrangement, G5). The try (the zones in the order C, B, A) also scores 75 on all 12, after
// 52.14 to 55.59 s; whether it is faster depends on the cards: it is faster on 5 of the 6 RED
// arrangements (up to 3.2 s; a RED team comes onto the road at the height of zone C) and slower on
// 5 of the 6 GREEN ones (up to 3.6 s).

const wholeMission: SampleProgram = {
  ...exampleCard('locker-whole-mission'),
  description:
    'The whole mission, for every draw. At the Scan Station the robot reads the card and waits until the Team Box is lifted. ' +
    'Then it brings the cube of its team colour into the big circle of that colour, and the gate opens. ' +
    'Then it takes the tokens of zones A, B and C, one after the other. It reads the colour of each one and puts it on the target of that colour. ' +
    'It never guesses a colour. ' +
    'It scores 75 points on all 12 draws, in 51 to 57 of the 150 seconds. ' +
    'In this simulator 75 is the most there is: a token is bigger than the red and the green square. ' +
    'Try the zones in the order C, B, A. Is it faster?',
  program: program([
    waitAtTheScanStation(),
    bringTheRedCube(),
    bringTheGreenCube(),
    driveOnTheRoad(),
    takeTheToken(),
    putTheTokenOnItsTarget(),
    script(note(whenStart(), BY_DISTANCE_NOTE), [
      note(moveCm('forward', TO_STATION_CM), 'Into the Scan Station. The whole robot is inside it now, with the Team Box.'),
      call('wait at the Scan Station'),
      note(
        ifElse(
          eq(v('team colour'), 'red'),
          [
            call('bring the red cube'),
            note(turn('left', 180), 'Face left.'),
            note(moveCm('forward', RED_TO_ROAD.left), 'To the road, at the height of the big red circle.'),
            note(turn('right', 90), 'Face up.'),
            note(setVar('robot y', RED_TO_ROAD.y), ON_THE_ROAD_NOTE),
          ],
          [
            call('bring the green cube'),
            note(turn('right', 90), 'Face up.'),
            note(moveCm('forward', GREEN_TO_ROAD.up), 'Up, so that the robot does not pass over the place of the gate.'),
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

/** The three "take the token at" + "put the token on its target" of the advanced example: zone A, B, then C. */
function everyToken(): BlockNode[] {
  return [
    note(call('take the token at', ZONE_Y_CM.A), 'Zone A, the lowest zone picture: 77.6 cm from the top edge.'),
    call('put the token on its target'),
    note(call('take the token at', ZONE_Y_CM.B), 'Zone B, the middle one: 61.1 cm.'),
    call('put the token on its target'),
    note(call('take the token at', ZONE_Y_CM.C), 'Zone C, the top one: 45.8 cm.'),
    call('put the token on its target'),
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
