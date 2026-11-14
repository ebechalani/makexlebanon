/**
 * Ready-made block programs for the Fire Chief simulator (the maze game).
 *
 *   chief-first-wall     starter       drive until the ultrasonic sensor sees a wall close ahead
 *   chief-count-lines    starter       count the printed grid lines with the Quad RGB sensor
 *   chief-flame-fan      starter       open field: drive to the fire by heart, read red, start the fan
 *   chief-wall-follow    intermediate  follow the right-hand wall, cell by cell, to a room
 *   chief-face-flame     intermediate  go to a room, find the place of the fire, read red, start the fan
 *   chief-full-mission   advanced      the whole mission, on any maze that can be played
 *
 * (Two ids still say "flame": that is the name of the wooden fire target. The game is played
 * without a flame sensor: the robot finds the target with its ultrasonic sensor and makes sure
 * with the colour sensor at its front, which reads "red" on the target. No program here holds
 * a flame sensor block.)
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of Fire Rescue (../fire-rescue/samples.ts): a visitor's
 *  browser gets a program and the text that explains it only from the server, which decides for
 *  every request what that visitor may have. So nothing that runs in the browser
 *  (src/simulator/ui, anything with 'use client', a page of the website) may import this file -
 *  nor ./sample-catalog.ts, the list of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  blocks are here. The server hands them out through /api/simulator/unlock, to a request that
 *  names this game (see ../members/all-examples.ts).
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of the Fire Chief palette
 * (blocks/palettes.ts): blocks that real mBlock has. Every one of them is run by the tests
 * (samples.test.ts) on the real engine with the real referee, on the default maze, on the five
 * named mazes with the fire at each of its six places, and on several hundred random mazes.
 * What a description promises is what those tests measure.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation.
 *
 * The numbers behind the programs. The field is 5 x 5 cells of 30 cm (field.ts). The robot
 * starts in the middle of START (bottom row, middle column) facing up, and the point it turns
 * around is the middle of its wheel axle:
 *
 *   - 30 cm forward brings it from the middle of one cell to the middle of the next;
 *   - in the middle of a cell the ultrasonic sensor reads 4.4 cm to a wall that closes the cell
 *     (4.5 cm to the wall around the field), and at least 34.4 cm when the cell is open on that
 *     side: "more than 20 cm" means "the way is free";
 *   - the Quad RGB sensor is 8.5 cm ahead of the axle, and a grid line lies on the boundary of
 *     two cells: 8.5 + 15 = 23.5 cm after the sensor has crossed a line the robot is in the
 *     middle of the next cell (measured: within 1 mm);
 *   - in the middle of a room the robot can turn all the way round without touching the fire
 *     target (the nearest place leaves 6.5 mm).
 *
 * Finding the fire. The target stands at one of three places of its room, against the outer
 * walls (field.ts: back wall, side wall, or the corner between them). Two sensors find it:
 *
 *   - The ultrasonic sensor says WHERE something stands, from the middle of the room. Looking
 *     squarely at the back or the side wall it reads 4.5 cm on the bare wall, and 3 cm - its
 *     smallest value - when the target, which is 2 cm deep, stands in front of it. Looking into
 *     the corner it reads 9 cm on the empty corner and 5.7 cm on the target. (WALL_PLACE_CM and
 *     CORNER_PLACE_CM lie between.)
 *   - The colour sensor says WHAT it is, from very near: it names a colour only when the thing
 *     is 1.5 cm or less ahead of the robot's nose (robot.ts: COLOR_SENSOR_RANGE_MM, an
 *     assumption). From the middle of the room the target is 2.5 cm ahead (back, side) or 5.7 cm
 *     (corner), so the robot drives closer, slowly, until the sensor reads "red", and stops.
 *     At the back and at the side wall it stops 1.4 cm in front of the target and touches nothing.
 *
 * THE CORNER. The robot is 13 cm wide: driving into the corner along its diagonal, the two
 * walls stop it when its nose is exactly 1.5 cm from the target - the very edge of what the
 * colour sensor sees. So with the target in the corner every program here that reads red
 * touches the two walls of that corner: for 3 hundredths of a second it presses on them, then
 * it has read red and stops, resting against them. In the simulator that costs nothing (walls
 * are smooth and cannot move). The draft rules allow "minor accidental contact with a wall" and
 * forbid pushing walls on purpose: the descriptions say that the robot touches the walls and
 * send the student to the referee, and it is a question for the organiser. (Looked for on a
 * grid of 0.25 mm and 0.25 degrees: no place from which the sensor reads the corner target
 * while the robot is clear of both walls by 1.25 mm or more and does not touch the target.)
 *
 * The referee does not ask what the colour sensor reads: the fan points count by position
 * alone (game.ts, decision D3). "Read red, then blow" is what the programs do to be sure
 * themselves.
 *
 * The simulated robot is perfect (no wheel slip), so counting cells by distance is exact here:
 * after 42 cells and 84 quarter turns the robot is still within half a millimetre of the middle
 * of its cell. A real robot drifts: it has to correct itself against the walls or the grid
 * lines - the line counter shows the first step of that. And every program that drives by
 * distance needs the robot where the simulator puts it: in the middle of START, facing up.
 * (Measured with wheels that slip by up to 2 %: the full mission then reaches 100 points in
 * about 1 maze of 10; with 0.5 % in 3 of 10. The few millimetres between "bare wall" and
 * "target" on the ultrasonic sensor, and the 1.5 cm of the colour sensor, leave no room for
 * drift. Noise on the sensors alone changed nothing.)
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { ProgramJson } from '../core/types';
import {
  add,
  and,
  call,
  changeVar,
  colorSensorDetects,
  dcMotor,
  define,
  eq,
  gt,
  ifElse,
  ifThen,
  join,
  ledColor,
  lt,
  mod,
  move,
  moveCm,
  not,
  note,
  or,
  print,
  probeDetects,
  program,
  repeatUntil,
  resetTimer,
  script,
  setVar,
  stop,
  stopDcMotor,
  stopMotors,
  timer,
  turn,
  ultrasonic,
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
  /** what the program does, what it scores and what to try next, in a few plain sentences */
  description: string;
  program: ProgramJson;
}

// =============================================================================================
// Numbers the programs share (the tests read them too)
// =============================================================================================

/** "The way is free": the ultrasonic sensor reads more than this (cm). Less: a wall closes this side of the cell. */
export const WALL_NEAR_CM = 20;
/** The first-wall program stops when the wall is nearer than this (cm). */
export const FIRST_WALL_STOP_CM = 8;
/** The line counter drives this many cells. */
export const LINE_COUNTER_CELLS = 2;
/**
 * Wheel speed (RPM) of the line counter. Measured on the drawing of the mat and on its picture:
 * up to 170 RPM a program that looks at the sensor on every tick sees every grid line; at the
 * full 180 RPM the robot moves 6 mm per tick, as much as a line is wide, and a crossing is
 * missed now and then (7 of 1200).
 */
export const LINE_COUNTER_RPM = 50;
/** After the Quad RGB sensor has crossed a grid line: this far (cm) to the middle of the cell (8.5 + 15). */
export const AFTER_LINE_CM = 23.5;
/**
 * Wheel speed (RPM) of the slow drive towards the fire target, until the colour sensor reads
 * red. Two measurements stand behind it, both with the blocks "moves forward at N RPM, wait
 * until red, stop":
 *   - With a running start, on the open field (the engineer who built the sensor measured it at
 *     every place of the target): a robot that comes squarely stops without touching the target
 *     up to 90 RPM; one that comes 20 degrees off square, with slipping wheels and noisy sensors,
 *     up to 20 RPM.
 *   - From the middle of the room, as the programs here do it: at 20 RPM red comes after 0.17
 *     seconds at a wall and the robot stops 14.0 mm in front of the target; in the corner red
 *     comes after 0.65 seconds, in the tick in which the two walls stop the robot.
 * At 20 RPM the robot moves 0.67 mm between two looks at the sensor.
 */
export const APPROACH_RPM = 20;
/**
 * From the middle of a room, looking squarely at the back wall or at the side wall: "something
 * stands in front of this wall" when the ultrasonic sensor reads less than this (cm). The bare
 * wall reads 4.5 cm; the target, which is 2 cm deep, reads 3 cm (the smallest value the sensor
 * gives).
 */
export const WALL_PLACE_CM = 4;
/**
 * From the middle of a room, looking into the outer corner: "something stands in the corner"
 * when the ultrasonic sensor reads less than this (cm). The empty corner reads 9 cm, the target
 * 5.7 cm.
 */
export const CORNER_PLACE_CM = 7.5;
/**
 * The drive towards a thing the ultrasonic sensor has found ends after this many seconds when
 * the colour sensor has not read red by then. (Red comes after 0.2 seconds at a wall, after 0.7
 * seconds in the corner.)
 */
export const APPROACH_SECONDS = 3;
/**
 * The same for the starter program, which drives at the back wall without knowing whether the
 * target stands there: after this many seconds the robot has moved 3.3 cm - enough to read red
 * on a target (1 cm is enough), and not enough to reach the wall (4.5 cm).
 */
export const FIRST_APPROACH_SECONDS = 0.5;
/**
 * The starter program drives a way it has learned by heart, on the open field. Before it
 * drives off it asks the ultrasonic sensor: more than this (cm) free ahead means no wall is on
 * the way up from START.
 */
export const OPEN_WAY_CM = 110;
/** The fan blows this long (seconds): the rules ask for 3, the rest is a margin. */
export const FAN_SECONDS = 3.5;

/** "The room I have looked at" before any room was looked at: a column that does not exist. */
const NO_ROOM = 9;

const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

// =============================================================================================
// Pieces shared by several programs
// =============================================================================================

/** True when no wall closes the cell on the side the robot is looking at. */
const wayIsFree = (): BlockNode => gt(ultrasonic(), WALL_NEAR_CM);
/** True when a wall closes the cell on the side the robot is looking at. */
const wallAhead = (): BlockNode => lt(ultrasonic(), WALL_NEAR_CM);

/**
 * Turn right, a quarter turn at a time, until no wall closes the cell on the side the robot is
 * looking at. (A cell of a maze that can be played is never closed on all four sides.)
 */
function findTheFreeWay(): BlockNode {
  return note(
    repeatUntil(wayIsFree(), [turn('right', 90)]),
    `Is the way free? A wall that closes this cell is about 4 cm ahead, the next one at least 34 cm. While the sensor reads less than ${WALL_NEAR_CM} cm, the robot turns a quarter turn to the right and looks again.`,
  );
}

/** True when the robot stands in the living room (top left) or in the bedroom (top right). */
const inARoom = (): BlockNode => and(eq(v('row'), 0), or(eq(v('col'), 0), eq(v('col'), 4)));

/**
 * The robot keeps track of where it is with three variables. START is column 2, row 4
 * (columns and rows are counted from the top left corner, starting at 0), and it faces up.
 */
function rememberStart(): BlockNode[] {
  return [
    note(
      setVar('col', 2),
      'The robot keeps track of where it is. Columns are counted from the left (0 to 4), rows from the top (0 to 4): START is column 2, row 4.',
    ),
    setVar('row', 4),
    note(setVar('dir', 0), 'The way the robot faces: 0 = up, 1 = right, 2 = down, 3 = left. It starts facing up.'),
  ];
}

/** My-blocks: a quarter turn that also updates "dir", and one cell forward that also updates "col" / "row". */
function movingBlocks(): DefinitionNode[] {
  return [
    note(
      define('turn right', [], [turn('right', 90), setVar('dir', mod(add(v('dir'), 1), 4))]),
      'A quarter turn to the right. "dir" counts on by 1; after 3 comes 0 again (that is what "mod 4" does).',
    ),
    note(
      define('turn left', [], [turn('left', 90), setVar('dir', mod(add(v('dir'), 3), 4))]),
      'A quarter turn to the left. Adding 3 and taking "mod 4" is the same as counting back by 1.',
    ),
    note(
      define('one cell forward', [], [
        moveCm('forward', 30),
        ifThen(eq(v('dir'), 0), [changeVar('row', -1)]),
        ifThen(eq(v('dir'), 1), [changeVar('col', 1)]),
        ifThen(eq(v('dir'), 2), [changeVar('row', 1)]),
        ifThen(eq(v('dir'), 3), [changeVar('col', -1)]),
      ]),
      'A cell is 30 cm wide: 30 cm forward is the middle of the next cell. Then the robot updates where it is.',
    ),
  ];
}

/**
 * One step of "keep a hand on the wall": look to the side of that hand first; while a wall is
 * there, turn the other way and look again (straight ahead, then the other side, then back);
 * then drive one cell. `hand` is the side of the hand.
 */
function wallStep(hand: 'right' | 'left'): BlockNode[] {
  const towards = hand === 'right' ? 'turn right' : 'turn left';
  const away = hand === 'right' ? 'turn left' : 'turn right';
  const other = hand === 'right' ? 'left' : 'right';
  return [
    note(call(towards), `Look to the ${hand} first: that is where the hand is.`),
    note(
      repeatUntil(wayIsFree(), [call(away)]),
      `A wall there (the sensor reads less than ${WALL_NEAR_CM} cm)? Then a quarter turn to the ${other} and look again: straight ahead, then to the ${other}, and at last the way the robot came from.`,
    ),
    call('one cell forward'),
  ];
}

/** True while the colour sensor at the front of the robot reads red: the fire target is at most 1.5 cm ahead. */
const seesRed = (): BlockNode => colorSensorDetects('red');

/**
 * My-blocks for the middle of a room: "look for the fire" asks the ultrasonic sensor at which of
 * the three places of the room something stands in front of the wall, and leaves the robot
 * facing that place with "fire" = 1 - or facing the way it came in, with "fire" = 0.
 *
 * The three places lie straight ahead, half a quarter turn further and a quarter turn further:
 * the robot comes into a room facing its back wall or its side wall, and the corner is between
 * the two. "swing" says which way "further" is.
 */
function lookForTheFireBlocks(): DefinitionNode[] {
  const nothingYet = (): BlockNode => eq(v('fire'), 0);
  return [
    note(
      define('turn on', ['degrees'], [ifElse(eq(v('swing'), 1), [turn('right', v('degrees'))], [turn('left', v('degrees'))])]),
      'Turn on by so many degrees, the way "swing" says: 1 = to the right, -1 = to the left.',
    ),
    note(
      define('look at this place', ['limit'], [
        note(wait(0.2), 'Stand still, then measure.'),
        ifThen(lt(ultrasonic(), v('limit')), [setVar('fire', 1)]),
      ]),
      'Does something stand in front of the wall here? Then the ultrasonic sensor reads less than "limit" (cm), and "fire" becomes 1.',
    ),
    note(
      define('look for the fire', [], [
        setVar('fire', 0),
        note(
          setVar('swing', 1),
          'The fire can stand at three places of a room: straight ahead, half a quarter turn (45 degrees) further, and a quarter turn further. "swing" says which way: 1 = to the right.',
        ),
        note(
          ifThen(or(and(eq(v('col'), 0), eq(v('dir'), 0)), and(eq(v('col'), 4), eq(v('dir'), 1))), [setVar('swing', -1)]),
          'In the living room (column 0) facing up, and in the bedroom (column 4) facing right, the outer corner is to the left: look around to the left.',
        ),
        note(
          call('look at this place', WALL_PLACE_CM),
          `Straight ahead is a wall, 4.5 cm away. The fire target is 2 cm deep: with the target there the sensor reads less (3 cm, its smallest value). Less than ${WALL_PLACE_CM} cm: something stands there.`,
        ),
        note(
          ifThen(nothingYet(), [call('turn on', 45), call('look at this place', CORNER_PLACE_CM)]),
          `Nothing yet: look into the corner. The empty corner reads 9 cm, the target in it 5.7 cm. Less than ${CORNER_PLACE_CM} cm: something stands there.`,
        ),
        note(
          ifThen(nothingYet(), [call('turn on', 45), call('look at this place', WALL_PLACE_CM)]),
          'Still nothing: look at the other wall.',
        ),
        note(
          ifThen(nothingYet(), [ifElse(eq(v('swing'), 1), [turn('left', 90)], [turn('right', 90)])]),
          'Nothing at any of the three places: turn back a quarter turn. The robot faces the way it came in again, and "dir" is still right.',
        ),
      ]),
      'In the middle of a room: look at the three places where the fire can stand. Afterwards "fire" is 1 and the robot faces the place where something stands - or "fire" is 0.',
    ),
  ];
}

/**
 * My-block "go close": drive slowly at the thing straight ahead until the colour sensor reads
 * red, and stop. It gives up after APPROACH_SECONDS; the caller asks the sensor again.
 */
function goCloseBlock(): DefinitionNode {
  return note(
    define('go close', [], [
      resetTimer(),
      note(
        move('forward', APPROACH_RPM),
        `Slowly: at ${APPROACH_RPM} RPM the robot moves less than 1 mm between two looks at the sensor, and stops in time. Do not drive at the fire target fast: a target that is pushed away ends the attempt.`,
      ),
      note(
        waitUntil(or(seesRed(), gt(timer(), APPROACH_SECONDS))),
        `The colour sensor names a colour only from 1.5 cm or less. Wait until it reads red - or until ${APPROACH_SECONDS} seconds are over: then this is not the fire.`,
      ),
      stopMotors('all'),
    ]),
    'Drive slowly at the thing ahead until the colour sensor reads red, then stop.',
  );
}

/** Red was read: stand still, LEDs red, and let the fan blow for a little more than the 3 seconds of the rules. */
function blowAtTheFire(): BlockNode[] {
  return [
    ledColor('all', RED),
    note(wait(0.5), 'Stand still: a fan action only counts when the robot does not move.'),
    note(dcMotor('M1', 100), 'Fan on. It is on DC motor port M1 and blows from a power of 20 % on.'),
    note(wait(FAN_SECONDS), 'The fan must blow at the fire for 3 seconds without a break. A little more does no harm.'),
    note(
      stopDcMotor('M1'),
      'Fan off. In the simulator the referee has ended the attempt before this block (mission complete). A real robot must switch its fan off itself.',
    ),
  ];
}

// =============================================================================================
// 1. chief-first-wall
// =============================================================================================

const firstWall: SampleProgram = {
  ...exampleCard('chief-first-wall'),
  description:
    'The robot looks for a free way out of START: while the ultrasonic sensor sees a wall close ahead, it turns a ' +
    'quarter turn to the right. Then it drives straight on and stops by itself in front of the first wall: ' +
    `"wait until" lets it drive until the sensor measures less than ${FIRST_WALL_STOP_CM} cm. ` +
    'The LEDs turn green and the screen shows the distance to the wall. It never touches a wall. ' +
    'It scores 10 points (the robot has left START completely) in every maze that can be played. ' +
    'It needs the robot at its default start position. ' +
    'Walls in the simulator are perfectly smooth: a robot that touches one slides along it, also while it turns. ' +
    'A real robot gets stuck there, so keep away from the walls. ' +
    `Try 20 instead of ${FIRST_WALL_STOP_CM}: the robot stops earlier - is it still completely out of START? ` +
    'Or add a turn and a second "wait until" to go on to the next wall.',
  program: program([
    script(note(whenStart(), 'A first program for the maze. Change the numbers, then press Start again.'), [
      findTheFreeWay(),
      note(move('forward', 50), 'Starts driving and goes on to the next block at once.'),
      note(
        waitUntil(lt(ultrasonic(), FIRST_WALL_STOP_CM)),
        `The robot keeps driving while the script waits here, until the ultrasonic sensor measures less than ${FIRST_WALL_STOP_CM} cm to the wall.`,
      ),
      stopMotors('all'),
      note(wait(0.5), 'A robot does not stop at once. Wait until it stands still, then measure.'),
      ledColor('all', GREEN),
      print(join('Wall ahead, cm: ', ultrasonic())),
    ]),
  ]),
};

// =============================================================================================
// 2. chief-count-lines
// =============================================================================================

const countLines: SampleProgram = {
  ...exampleCard('chief-count-lines'),
  description:
    'Counting cells with the Quad RGB sensor: a black grid line is printed between every two cells. ' +
    'The robot turns to a free way out of START, drives one cell by distance and turns left. ' +
    `Then it drives ${LINE_COUNTER_CELLS} cells by counting: each time probe L1 has crossed a line, it drives ${AFTER_LINE_CM} cm more, ` +
    'to the middle of that cell, and adds 1 to the variable "cells". ' +
    'Before every cell the ultrasonic sensor checks the way: if a wall closes it, the robot stops there. ' +
    `The screen shows how many cells it has counted. In the default maze that is ${LINE_COUNTER_CELLS}. ` +
    'It scores 10 points (the robot has left START completely) in every maze that can be played, and it never touches a wall. ' +
    'It needs the robot at its default start position. ' +
    'Do not count lines at full speed: a line can be missed. ' +
    'Try another number of cells. Or count the lines on the way out of START too: the START picture has dark parts - what does the sensor count there?',
  program: program([
    script(whenStart(), [
      setVar('cells', 0),
      findTheFreeWay(),
      note(
        moveCm('forward', 30),
        'Out of START by distance (a cell is 30 cm), without looking down: the START picture has dark parts that the sensor would take for lines.',
      ),
      turn('left', 90),
      note(
        repeatUntil(or(eq(v('cells'), LINE_COUNTER_CELLS), wallAhead()), [
          note(
            move('forward', LINE_COUNTER_RPM),
            `${LINE_COUNTER_RPM} RPM is slow enough to count lines. Do not count at full speed (180 RPM): the robot then moves 6 mm between two looks at the sensor - as much as a line is wide - and misses a line now and then.`,
          ),
          note(waitUntil(probeDetects('L1', 'line')), 'L1 is one of the two middle probes of the sensor. Wait until it is over the black grid line ...'),
          note(waitUntil(probeDetects('L1', 'background')), '... and until it has left the line again: the sensor has crossed into the next cell.'),
          note(
            moveCm('forward', AFTER_LINE_CM),
            'The sensor is 8.5 cm ahead of the wheels, and the middle of the cell is 15 cm behind the line: 8.5 + 15 = 23.5 cm more. Then the robot stops.',
          ),
          changeVar('cells', 1),
        ]),
        `Cell after cell, until ${LINE_COUNTER_CELLS} cells are counted or a wall closes the way (the ultrasonic sensor reads less than ${WALL_NEAR_CM} cm).`,
      ),
      ledColor('all', GREEN),
      print(join('Cells counted: ', v('cells'))),
    ]),
  ]),
};

// =============================================================================================
// 3. chief-flame-fan
// =============================================================================================

// The one way this program knows: the open field, the fire at the back wall of the living room
// (LB-0000-0000). On the page that takes two clicks: the button "Open field" changes the walls
// and leaves the fire where it is - in the corner of the living room, for a visitor who comes
// from the default maze - and the button "Back wall" moves the fire. The description and the
// note on the first block name both. From START: 120 cm up (the middle of the top
// row), a quarter turn to the left, 60 cm (the living room), a quarter turn to the right: the
// middle of the living room, facing its back wall. The target stands 2.5 cm ahead of the robot's
// nose there.
//
// From START the open field is free for 124.5 cm upwards; with a wall anywhere on that way the
// ultrasonic sensor reads 94.4 cm at most. Wherever the robot is put inside START, "more than
// OPEN_WAY_CM" tells the two apart (120 cm and more / 102.4 cm at most).

/** The note on the first block of the starter: what a student has to know before pressing Start. */
const ONE_WAY_NOTE =
  'This program knows one way by heart. Before you press Start, choose the maze "Open field" and put the fire at the "Back wall" of the living room. ' +
  'At the competition the maze changes: the next examples find their way.';

const redAndFan: SampleProgram = {
  ...exampleCard('chief-flame-fan'),
  description:
    'First choose the maze "Open field" and put the fire at the "Back wall" of the living room: this program knows one way only, by heart. ' +
    'The robot drives 120 cm up, turns left, drives 60 cm and turns right: now it faces that wall. ' +
    'It drives on slowly until its colour sensor reads red, and stops. ' +
    'The sensor names a colour only from 1.5 cm or less, and pushing the target away ends the attempt. ' +
    'Then the fan blows: 3 seconds later the mission is complete, 100 points. ' +
    'With the fire at another place it reads no red: the robot shows "No red here", leaves the fan off and scores 30 points. ' +
    'Before it drives off it looks up the field with the ultrasonic sensor: if it sees a wall, it stays in START. ' +
    'It does not see every wall: in the maze "Two doors" it runs into one. ' +
    'It needs the robot at its default start position. ' +
    'Try the fire at the side wall of the living room: which block do you take away?',
  program: program([
    script(note(whenStart(), ONE_WAY_NOTE), [
      note(
        ifThen(lt(ultrasonic(), OPEN_WAY_CM), [print('Choose the maze Open field'), stop('all')]),
        `Look before you drive: on the open field the way up is free for 124 cm. Less than ${OPEN_WAY_CM} cm: the sensor sees a wall on the way or close beside it. This is not the open field, and the program stops here.`,
      ),
      note(moveCm('forward', 120), 'The way, learned by heart: 120 cm up, a quarter turn to the left, 60 cm. A cell is 30 cm wide.'),
      turn('left', 90),
      moveCm('forward', 60),
      note(turn('right', 90), 'Now the robot stands in the middle of the living room and faces its back wall.'),
      resetTimer(),
      note(
        move('forward', APPROACH_RPM),
        `Slowly: at ${APPROACH_RPM} RPM the robot moves less than 1 mm between two looks at the sensor, and stops in time. Do not drive at the fire target fast: a target that is pushed away ends the attempt.`,
      ),
      note(
        waitUntil(or(seesRed(), gt(timer(), FIRST_APPROACH_SECONDS))),
        `The colour sensor names a colour only from 1.5 cm or less. Wait until it reads red - or until ${FIRST_APPROACH_SECONDS} seconds are over: by then the robot has moved 3 cm, and no fire stands here.`,
      ),
      stopMotors('all'),
      note(
        ifElse(seesRed(), blowAtTheFire(), [print('No red here')]),
        'Make sure before you blow: the fan starts only when the colour sensor reads red.',
      ),
    ]),
  ]),
};

// =============================================================================================
// 4. chief-wall-follow
// =============================================================================================

const wallFollow: SampleProgram = {
  ...exampleCard('chief-wall-follow'),
  description:
    'A way through any maze with only one sensor that looks forward: keep your right hand on the wall. ' +
    'In every cell the robot turns right and measures with the ultrasonic sensor. While a wall is there, it turns a ' +
    'quarter turn to the left and measures again. Then it drives one cell (30 cm). ' +
    'Three variables keep track of where it is: "col" and "row" for the cell, "dir" for the way it faces. ' +
    'When they say that the robot stands in the living room or in the bedroom, it stops and the LEDs turn green. ' +
    'It scores 30 points (10 for leaving START, 20 for being completely inside a room) in every maze that can be played, ' +
    'without touching a wall. Which room it reaches depends on the maze; in the default maze it is the bedroom. ' +
    'It does not look for the fire. It needs the robot at its default start position. ' +
    'Try the left hand: swap "turn right" and "turn left" in the loop and see where the robot ends.',
  program: program([
    ...movingBlocks(),
    script(whenStart(), [
      ...rememberStart(),
      note(
        repeatUntil(inARoom(), wallStep('right')),
        'The two rooms are the top corners of the field: row 0, column 0 or column 4. Until the robot is in one of them: one more step along the wall.',
      ),
      ledColor('all', GREEN),
      ifElse(eq(v('col'), 0), [print('In the living room')], [print('In the bedroom')]),
    ]),
  ]),
};

// =============================================================================================
// 5. chief-face-flame
// =============================================================================================

const findFire: SampleProgram = {
  ...exampleCard('chief-face-flame'),
  description:
    'First the robot follows the wall to a room, with its left hand on the wall. ' +
    'There it looks at the three places where the fire target can stand, with the ultrasonic sensor: where something stands in front of a wall, the sensor reads less. ' +
    'Nothing: the fire is in the other room. The LEDs turn blue: 30 points. ' +
    'Something: it drives at it slowly until the colour sensor reads red, stops, and only then starts the fan: 100 points. ' +
    'At a wall it touches nothing. In the corner the sensor is close enough (1.5 cm) only when the two walls stop the robot: it touches them for a moment. ' +
    'On a real field, ask the referee first: the rules allow a light touch of a wall only by accident. ' +
    'In the default maze the left hand leads to the fire: 100 points after 34 seconds. ' +
    'It needs the robot at its default start position. ' +
    'Try the default maze with the fire in the bedroom: what does the robot show?',
  program: program([
    ...movingBlocks(),
    ...lookForTheFireBlocks(),
    goCloseBlock(),
    script(whenStart(), [
      ...rememberStart(),
      repeatUntil(inARoom(), wallStep('left')),
      call('look for the fire'),
      note(
        ifElse(
          eq(v('fire'), 1),
          [
            call('go close'),
            note(
              ifElse(seesRed(), [print('Red: fan on'), ...blowAtTheFire()], [print('Not red: no fan')]),
              'Make sure before you blow: the fan starts only when the colour sensor reads red.',
            ),
          ],
          [ledColor('all', BLUE), print('No fire in this room')],
        ),
        'Something stands at one of the three places: go close and read its colour. Nothing: the fire is in the other room.',
      ),
    ]),
  ]),
};

// =============================================================================================
// 6. chief-full-mission
// =============================================================================================
// Why a hand on the wall is enough here: START and both rooms lie at the outer wall of the
// field, so the wall the hand follows from START leads through both rooms in every maze that
// can be played - and after at most 42 cells (a maze with one way only, the fire room last).
// "look for the fire" leaves the robot facing the way it came in when it finds nothing, so the
// hand stays on the same wall.
// Measured with these blocks (what the tests of samples.test.ts repeat on a smaller scale), the
// fire going round its six places from maze to maze:
//   - 20 000 random mazes of the game's generator (seeds 1 to 20 000): 100 points in every one,
//     half of them under 40 s, 99 of 100 under 117 s, slowest 133.6 s;
//   - 10 000 mazes with one way only: 100 points in every one, slowest 133.6 s;
//   - 5 000 mazes no generator draws (every wall by the throw of a coin): 100 points in every
//     one, slowest 121.5 s;
//   - in every run the colour sensor read red before the fan started, and the target never
//     moved and was never touched;
//   - with the fire at a wall (two runs of three) the robot touched nothing; with the fire in a
//     corner (one run of three) it pressed on the walls of that corner for 3 ticks, and on
//     nothing else.
// The slowest kind of maze (42 cells, the other room on the way) takes 132.5 to 133.6 s,
// depending on the place of the fire: the number the description gives.

const fullMission: SampleProgram = {
  ...exampleCard('chief-full-mission'),
  description:
    'The whole mission, for any maze. The robot follows the wall with its left hand, cell by cell. ' +
    'In a room it looks at the three places where the fire target can stand, with the ultrasonic sensor. ' +
    'Nothing there: it follows the wall on to the other room. ' +
    'Something there: it drives at it slowly until the colour sensor reads red, stops and lets the fan blow. ' +
    'After 3 seconds the referee ends the attempt: mission complete. ' +
    'It scored 100 points in all 570 mazes it was tested on, with the fire at each of its six places, and never moved the target. ' +
    'With the target in a corner it touches the two walls of that corner for a moment; otherwise it touched nothing. ' +
    'The default maze takes 34 seconds, the slowest maze found 134 of the 180 seconds. ' +
    'It needs the robot at its default start position. ' +
    'Try the right hand (swap "turn left" and "turn right" in the loop): in which mazes is it faster?',
  program: program([
    ...movingBlocks(),
    ...lookForTheFireBlocks(),
    goCloseBlock(),
    script(whenStart(), [
      ...rememberStart(),
      setVar('fire', 0),
      note(setVar('room seen', NO_ROOM), `The column of the room the robot has already looked for the fire in. ${NO_ROOM} means: none yet.`),
      note(
        repeatUntil(eq(v('fire'), 1), [
          ...wallStep('left'),
          note(
            ifThen(and(inARoom(), not(eq(v('col'), v('room seen')))), [
              call('look for the fire'),
              setVar('room seen', v('col')),
              ifThen(eq(v('fire'), 0), [print('No fire in this room')]),
            ]),
            'In a room - and not the one the robot has looked for the fire in before (the way along the wall can lead through it twice): look at its three places.',
          ),
        ]),
        'Until the ultrasonic sensor has found something at one of the three places of a room: one more step along the wall.',
      ),
      call('go close'),
      note(
        ifElse(seesRed(), [print('Red: fan on'), ...blowAtTheFire()], [print('Not red: no fan')]),
        'Make sure before you blow: the fan starts only when the colour sensor reads red.',
      ),
    ]),
  ]),
};

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Fire Chief, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [firstWall, countLines, redAndFan, wallFollow, findFire, fullMission];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
