/**
 * Ready-made block programs for the Fire Chief simulator (the maze game).
 *
 *   chief-first-wall     starter       drive until the ultrasonic sensor sees a wall close ahead
 *   chief-count-lines    starter       count the printed grid lines with the Quad RGB sensor
 *   chief-flame-fan      starter       the flame sensor and the fan, standing in START
 *   chief-wall-follow    intermediate  follow the right-hand wall, cell by cell, to a room
 *   chief-face-flame     intermediate  go to a room, turn to the highest flame value
 *   chief-full-mission   advanced      the whole mission, on any maze that can be played
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
 *  blocks are here. The server does not hand these examples out yet: that comes with the screen
 *  of this game.
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of the Fire Chief palette
 * (blocks/palettes.ts): blocks that real mBlock has. Every one of them is run by the tests
 * (samples.test.ts) on the real engine with the real referee, on the default maze and on
 * several hundred random mazes.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation.
 *
 * The numbers behind the programs. The field is 5 x 5 cells of 30 cm (field.ts). The robot
 * starts in the middle of START (bottom row, middle column) facing up, and the point it turns
 * around is the middle of its wheel axle:
 *
 *   - 30 cm forward brings it from the middle of one cell to the middle of the next;
 *   - in the middle of a cell the front of the robot is 4.4 cm from a wall that closes the cell,
 *     and 34.4 cm from the wall behind the next cell: "nearer than 20 cm" means "this side of
 *     my cell is closed";
 *   - the Quad RGB sensor is 8.5 cm ahead of the axle, and a grid line lies on the boundary of
 *     two cells: 8.5 + 15 = 23.5 cm after the sensor has crossed a line the robot is in the
 *     middle of the next cell (measured: within 1 mm);
 *   - in the middle of a room the robot can turn all the way round without touching the fire
 *     target, and the fan (30 cm reach) reaches every place where the target can stand.
 *
 * The simulated robot is perfect (no wheel slip unless noise is switched on), so counting
 * cells by distance is exact here. A real robot drifts: it has to correct itself against the
 * walls or the grid lines - the line counter shows the first step of that.
 *
 * Plain TypeScript, no DOM, no Blockly.
 */
import type { ProgramJson } from '../core/types';
import {
  add,
  and,
  call,
  changeVar,
  dcMotor,
  define,
  eq,
  flameDetected,
  flameSize,
  gt,
  ifElse,
  ifThen,
  join,
  ledColor,
  ledOff,
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
  resetYaw,
  rotationZ,
  script,
  setVar,
  showLabel,
  stop,
  stopDcMotor,
  stopMotors,
  sub,
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

/** "A wall closes this side of my cell": the ultrasonic sensor reads less than this (cm). */
export const WALL_NEAR_CM = 20;
/** The first-wall program stops when the wall is nearer than this (cm). */
export const FIRST_WALL_STOP_CM = 8;
/** The line counter drives this many cells to the left. */
export const LINE_COUNTER_CELLS = 2;
/** After the Quad RGB sensor has crossed a grid line: this far (cm) to the middle of the cell (8.5 + 15). */
export const AFTER_LINE_CM = 23.5;
/** Wheel speed (RPM) of the slow turn on the spot while the flame sensor looks around. */
export const LOOK_AROUND_RPM = 30;
/** "There is a flame": the highest value of a turn is above this (the threshold of the "detects flame?" block). */
export const FLAME_SEEN = 10;
/** The fan blows this long (seconds): the rules ask for 3, the rest is a margin. */
export const FAN_SECONDS = 3.5;

/** "empty room" before any room was found empty: a column that does not exist. */
const NO_ROOM = 9;

const RED = '#ff0000';
const GREEN = '#00ff00';
const BLUE = '#0000ff';

// =============================================================================================
// Pieces shared by several programs
// =============================================================================================

/** True when a wall closes the cell on the side the robot is looking at. */
const wallAhead = (): BlockNode => lt(ultrasonic(), WALL_NEAR_CM);

/**
 * Turn right, a quarter turn at a time, until no wall closes the cell on the side the robot is
 * looking at. (A cell of a maze that can be played is never closed on all four sides.)
 */
function findTheFreeWay(): BlockNode {
  return note(
    repeatUntil(gt(ultrasonic(), WALL_NEAR_CM), [turn('right', 90)]),
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
 * One step of "keep a hand on the wall": look to the side of that hand first, then straight
 * ahead, then to the other side, then back - and drive one cell the first way that is free.
 * `hand` is the side of the hand; the robot turns the other way to look further.
 */
function wallStep(hand: 'right' | 'left'): BlockNode[] {
  const towards = hand === 'right' ? 'turn right' : 'turn left';
  const away = hand === 'right' ? 'turn left' : 'turn right';
  const other = hand === 'right' ? 'left' : 'right';
  return [
    note(call(towards), `Look to the ${hand} first: that is where the hand is.`),
    note(
      ifThen(wallAhead(), [
        call(away),
        ifThen(wallAhead(), [call(away), ifThen(wallAhead(), [call(away)])]),
      ]),
      `A wall there (nearer than ${WALL_NEAR_CM} cm)? Then look straight ahead, then to the ${other}. If all three are closed, the last turn faces the way the robot came from.`,
    ),
    call('one cell forward'),
  ];
}

/**
 * My-block "look around": one slow turn on the spot. It leaves the highest flame value in
 * "best" and the angle at which it was read in "best angle".
 */
function lookAroundBlock(): DefinitionNode {
  return note(
    define('look around', [], [
      setVar('best', 0),
      setVar('best angle', 0),
      note(resetYaw(), 'The gyro starts counting the turn from 0.'),
      note(move('right', LOOK_AROUND_RPM), 'Turn on the spot, slowly, so that the sensor has time to look.'),
      note(
        repeatUntil(gt(rotationZ(), 360), [
          ifThen(gt(flameSize(), v('best')), [setVar('best', flameSize()), setVar('best angle', rotationZ())]),
        ]),
        'Until the robot has turned once round: when the flame value is higher than every value before, remember it and the angle of the gyro.',
      ),
      stopMotors('all'),
      wait(0.2),
    ]),
    'One slow turn on the spot. Afterwards "best" is the highest flame value of the turn and "best angle" says where it was.',
  );
}

/** Turn back from the end of "look around" to the direction in which the flame value was highest. */
function faceTheFlame(): BlockNode {
  return note(
    turn('left', sub(rotationZ(), v('best angle'))),
    'The gyro says how far the robot has turned by now. Turning left by the difference brings it back to where the flame value was highest: it faces the fire.',
  );
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
    'The LEDs turn green and the screen shows the distance. It never touches a wall. ' +
    'It scores 10 points (the robot has left START completely) in every maze that can be played. ' +
    `Try 20 instead of ${FIRST_WALL_STOP_CM}: the robot stops earlier - is it still completely out of START? ` +
    'Or add a turn and a second "wait until" to go on to the next wall.',
  program: program([
    script(note(whenStart(), 'A first program for the maze. Change the numbers, then press Start again.'), [
      print('To the first wall'),
      findTheFreeWay(),
      note(move('forward', 50), 'Starts driving and goes on to the next block at once.'),
      note(
        waitUntil(lt(ultrasonic(), FIRST_WALL_STOP_CM)),
        `The robot keeps driving while the script waits here, until the ultrasonic sensor measures less than ${FIRST_WALL_STOP_CM} cm to the wall.`,
      ),
      stopMotors('all'),
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
    'The robot turns to a free way out of START, drives one cell, turns left and then drives two cells by counting: ' +
    `each time probe L1 has crossed a line, it drives ${AFTER_LINE_CM} cm more, to the middle of that cell, and adds 1 to the variable "cells". ` +
    'Before every cell it checks with the ultrasonic sensor that no wall closes the way; if one does, it stops there. ' +
    'At the end the screen shows how many cells it has counted. In the default maze that is 2: it ends two cells to the left of the cell above START. ' +
    'It scores 10 points (the robot has left START completely) in every maze that can be played, and it never touches a wall. ' +
    'Leaving START is done by distance, without looking down: the START picture has dark parts that the sensor would count as lines. ' +
    'Try another number of cells, or count the lines on the way out of START as well and see what happens.',
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
          move('forward', 50),
          note(waitUntil(probeDetects('L1', 'line')), 'L1 is one of the two middle probes of the sensor. Wait until it is over the black grid line ...'),
          note(waitUntil(probeDetects('L1', 'background')), '... and until it has left the line again: the sensor has crossed into the next cell.'),
          stopMotors('all'),
          note(
            moveCm('forward', AFTER_LINE_CM),
            'The sensor is 8.5 cm ahead of the wheels, and the middle of the cell is 15 cm behind the line: 8.5 + 15 = 23.5 cm more.',
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

const flameAndFan: SampleProgram = {
  ...exampleCard('chief-flame-fan'),
  description:
    'Meet the two new parts of the robot. It turns once round on the spot (the gyro counts the 360 degrees) and ' +
    'shows the value of the flame sensor on its screen all the time: 0 means no flame, 100 a very strong one. ' +
    'While the sensor detects a flame the LEDs are red. Then the fan, which is on DC motor port M1, blows for one second. ' +
    'In START the value stays 0 and the LEDs stay off: the fire is too far away (the sensor sees about one metre) and behind walls. ' +
    'The program scores no points: the robot does not leave START, and a fan that blows at nothing does not count. ' +
    'Try putting driving blocks in front, so that the robot looks around inside a room - the next examples show how to get there.',
  program: program([
    script(whenStart(), [
      note(resetYaw(), 'The gyro starts counting the turn from 0.'),
      note(move('right', 20), 'Turn on the spot, slowly.'),
      note(
        repeatUntil(gt(rotationZ(), 360), [
          showLabel(join('flame ', flameSize()), 0, 0, 16),
          ifElse(flameDetected(), [ledColor('all', RED)], [ledOff('all')]),
        ]),
        'Until the robot has turned once round (360 degrees on the gyro): show the flame value, and light the LEDs red while a flame is detected.',
      ),
      stopMotors('all'),
      note(dcMotor('M1', 100), 'The fan is on DC motor port M1. It blows from a power of 20 % on.'),
      wait(1),
      stopDcMotor('M1'),
      print('Done'),
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
    'In every cell the robot turns right and measures with the ultrasonic sensor. A wall? It turns back and looks ' +
    'straight ahead, then left, then back - and drives one cell (30 cm) the first way that is free. ' +
    'Three variables keep track of where it is: "col" and "row" for the cell, "dir" for the way it faces. ' +
    'When they say that the robot stands in the living room or in the bedroom, it stops and the LEDs turn green. ' +
    'It scores 30 points (10 for leaving START, 20 for being completely inside a room) in every maze that can be played, ' +
    'without touching a wall. Which room it reaches depends on the maze; in the default maze it is the bedroom. ' +
    'It does not look for the fire. Try the left hand instead (swap the "turn right" and "turn left" blocks in the loop) and see where it ends.',
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

const faceFlame: SampleProgram = {
  ...exampleCard('chief-face-flame'),
  description:
    'First the robot follows the wall to a room, this time with its left hand on the wall. There it turns once ' +
    'round on the spot, slowly, and remembers the highest value of the flame sensor and the angle of the gyro at that ' +
    `moment (the my-block "look around"). If that value is above ${FLAME_SEEN}, the fire is in this room: the robot turns back to ` +
    'that angle, so that it faces the fire target, and its LEDs turn red. If not, the fire is in the other room: the LEDs turn blue. ' +
    'It scores 30 points in every maze that can be played (10 for leaving START, 20 for the room), and it never touches the target. ' +
    'In the default maze the left hand leads to the living room, where the fire is. ' +
    'Try adding the fan (DC motor M1) once the robot faces the fire - or look at the last example.',
  program: program([
    ...movingBlocks(),
    lookAroundBlock(),
    script(whenStart(), [
      ...rememberStart(),
      repeatUntil(inARoom(), wallStep('left')),
      call('look around'),
      note(
        ifElse(
          gt(v('best'), FLAME_SEEN),
          [faceTheFlame(), ledColor('all', RED), print(join('Fire! Flame value ', v('best')))],
          [ledColor('all', BLUE), print('No fire in this room')],
        ),
        `Above ${FLAME_SEEN} the block "detects flame?" says yes: the fire is in this room.`,
      ),
    ]),
  ]),
};

// =============================================================================================
// 6. chief-full-mission
// =============================================================================================

const fullMission: SampleProgram = {
  ...exampleCard('chief-full-mission'),
  description:
    'The whole mission. The robot follows the wall with its left hand, cell by cell. Every time it arrives in a room ' +
    'it looks around with the flame sensor. No flame: it turns back to where it was and follows the wall on to the other room. ' +
    'A flame: it turns to face it, stands still, lets the fan blow for a little more than 3 seconds and stops.',
  program: program([
    ...movingBlocks(),
    lookAroundBlock(),
    script(whenStart(), [
      ...rememberStart(),
      setVar('best', 0),
      note(setVar('empty room', NO_ROOM), `The column of the room that had no fire. ${NO_ROOM} means: no such room yet.`),
      note(
        repeatUntil(gt(v('best'), FLAME_SEEN), [
          ...wallStep('left'),
          note(
            ifThen(and(inARoom(), not(eq(v('col'), v('empty room')))), [
              call('look around'),
              note(
                ifThen(not(gt(v('best'), FLAME_SEEN)), [
                  print('No fire here'),
                  setVar('empty room', v('col')),
                  turn('left', sub(rotationZ(), 360)),
                ]),
                'No flame in this room: remember the room, and turn back exactly to where the robot faced before it looked around, so that "dir" is right again. The loop then follows the wall to the other room.',
              ),
            ]),
            'In a room - and not the one that was empty before (the way along the wall can pass through it twice): look around for the fire.',
          ),
        ]),
        `Until the flame sensor has seen the fire (a value above ${FLAME_SEEN}): one more step along the wall.`,
      ),
      faceTheFlame(),
      ledColor('all', RED),
      note(wait(0.5), 'Stand still: a fan action only counts when the robot does not move.'),
      note(dcMotor('M1', 100), 'Fan on. It is on DC motor port M1.'),
      note(wait(FAN_SECONDS), 'The fan must blow at the fire for 3 seconds without a break.'),
      stopDcMotor('M1'),
      ledColor('all', GREEN),
      print('Fire out!'),
      stop('all'),
    ]),
  ]),
};

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Fire Chief, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [firstWall, countLines, flameAndFan, wallFollow, faceFlame, fullMission];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
