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
 *  blocks are here. The server hands them out through /api/simulator/unlock, to a request that
 *  names this game (see ../members/all-examples.ts).
 * =====================================================================================
 *
 * Every program is written with the program builder (vm/builder.ts), so it is exactly what the
 * block editor would save, and it uses only blocks of the Fire Chief palette
 * (blocks/palettes.ts): blocks that real mBlock has. Every one of them is run by the tests
 * (samples.test.ts) on the real engine with the real referee, on the default maze and on
 * several hundred random mazes. What a description promises is what those tests measure.
 *
 * The blocks that are not obvious carry a note (`note(block, text)`): in the editor such a block
 * shows a small round "?" icon, and a click on it opens the explanation.
 *
 * The numbers behind the programs. The field is 5 x 5 cells of 30 cm (field.ts). The robot
 * starts in the middle of START (bottom row, middle column) facing up, and the point it turns
 * around is the middle of its wheel axle:
 *
 *   - 30 cm forward brings it from the middle of one cell to the middle of the next;
 *   - in the middle of a cell the ultrasonic sensor reads 4.4 cm to a wall that closes the cell,
 *     and at least 34.4 cm when the cell is open on that side: "more than 20 cm" means "the way
 *     is free";
 *   - the Quad RGB sensor is 8.5 cm ahead of the axle, and a grid line lies on the boundary of
 *     two cells: 8.5 + 15 = 23.5 cm after the sensor has crossed a line the robot is in the
 *     middle of the next cell (measured: within 1 mm);
 *   - in the middle of a room the robot can turn all the way round without touching the fire
 *     target (the nearest spot leaves 6.5 mm), and the fan, which reaches 30 cm, reaches every
 *     spot where the target can stand. So the robot never has to drive closer to the target.
 *
 * The gyro. "rotated angle around z axis" counts every turn the robot makes and goes on past
 * 360. The programs never set it back to 0: they write down the angle at which a turn begins
 * (the variable "start angle") and work with the difference. In this simulator "reset yaw
 * angle" would set it back; real mBlock has a block of its own for that, which this palette
 * does not have - with the difference the programs are right either way.
 *
 * The simulated robot is perfect (no wheel slip), so counting cells by distance is exact here:
 * after 42 cells and 84 quarter turns the robot is still within half a millimetre of the middle
 * of its cell. A real robot drifts: it has to correct itself against the walls or the grid
 * lines - the line counter shows the first step of that. And every program that drives by
 * distance needs the robot where the simulator puts it: in the middle of START, facing up.
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
  repeat,
  repeatUntil,
  rotationZ,
  script,
  setVar,
  showLabel,
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
/** The first look at the flame sensor turns once round in this many steps ... */
export const LOOK_STEPS = 36;
/** ... of this many degrees. */
export const LOOK_STEP_DEG = 360 / LOOK_STEPS;
/** Wheel speed (RPM) of the slow turn on the spot of "look around": about one degree between two readings. */
export const LOOK_AROUND_RPM = 30;
/** "There is a flame": the highest value of a turn is above this (the threshold of the "detects flame?" block). */
export const FLAME_SEEN = 10;
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

/**
 * My-block "look around": one slow turn on the spot, and back to where it began. It leaves the
 * highest flame value of the turn in "best", and in "best turn" how far (degrees to the right)
 * the robot had turned when it read that value.
 */
function lookAroundBlock(): DefinitionNode {
  const turned = (): BlockNode => sub(rotationZ(), v('start angle'));
  return note(
    define('look around', [], [
      setVar('best', 0),
      setVar('best turn', 0),
      note(
        setVar('start angle', rotationZ()),
        'The gyro counts every turn the robot has made so far. Remember its angle now: "rotated angle - start angle" is how far the robot has turned since this moment.',
      ),
      note(move('right', LOOK_AROUND_RPM), 'Turn on the spot, slowly, so that the sensor has time to look.'),
      note(
        repeatUntil(gt(turned(), 360), [ifThen(gt(flameSize(), v('best')), [setVar('best', flameSize()), setVar('best turn', turned())])]),
        'Until the robot has turned once round: when the flame value is higher than every value before, remember the value and how far the robot has turned.',
      ),
      stopMotors('all'),
      wait(0.2),
      note(
        turn('left', sub(turned(), 360)),
        'The robot has turned a little more than 360 degrees. Turn back by the rest: now it faces exactly the way it did before, and "dir" is still right.',
      ),
    ]),
    'One slow turn on the spot. Afterwards "best" is the highest flame value of the turn, and "best turn" says how many degrees to the right of here it was read.',
  );
}

/** After "look around": turn to the direction in which the flame value was highest, the short way round. */
function faceTheFlame(): BlockNode {
  return note(
    ifElse(gt(v('best turn'), 180), [turn('left', sub(360, v('best turn')))], [turn('right', v('best turn'))]),
    'Turn to where the flame value was highest, the short way: more than half a turn to the right is less than half a turn to the left. Now the robot faces the fire.',
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

const flameAndFan: SampleProgram = {
  ...exampleCard('chief-flame-fan'),
  description:
    'Meet the two new parts of the robot. It turns once round on the spot, in ' +
    `${LOOK_STEPS} steps of ${LOOK_STEP_DEG} degrees. After every step it shows the value of the flame sensor on its screen ` +
    '(0 means no flame, 100 a very strong one), and its LEDs are red while the sensor detects a flame. ' +
    'Then the fan, which is on DC motor port M1, blows for one second. ' +
    'In START the value stays 0 and the LEDs stay off: the sensor sees about one metre, and the fire is further away. ' +
    'The program scores no points: the robot does not leave START, and a fan that blows at nothing does not count. ' +
    'Try it on the open field (the maze without inner walls) with driving blocks in front, so that the robot looks around ' +
    'inside a room: 120 cm forward, a quarter turn to the left, 60 cm forward.',
  program: program([
    script(whenStart(), [
      note(
        repeat(LOOK_STEPS, [
          showLabel(join('flame ', flameSize()), 0, 0, 16),
          note(
            ifElse(flameDetected(), [ledColor('all', RED)], [ledOff('all')]),
            `"detects flame?" is true when the flame value is above ${FLAME_SEEN}.`,
          ),
          turn('right', LOOK_STEP_DEG),
        ]),
        `${LOOK_STEPS} steps of ${LOOK_STEP_DEG} degrees are one full turn. At every step: show the flame value, and light the LEDs red while a flame is detected.`,
      ),
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

const faceFlame: SampleProgram = {
  ...exampleCard('chief-face-flame'),
  description:
    'First the robot follows the wall to a room, this time with its left hand on the wall. There it turns once ' +
    'round on the spot, slowly, and remembers the highest value of the flame sensor and how far it had turned at that ' +
    `moment (the my-block "look around" uses the gyro for that). If the value is above ${FLAME_SEEN}, the fire is in this room: ` +
    'the robot turns to that direction, so that it faces the fire target, and its LEDs turn red. ' +
    'If not, the fire is in the other room: the LEDs turn blue. ' +
    'It scores 30 points in every maze that can be played (10 for leaving START, 20 for the room), and it never touches the target. ' +
    'In the default maze the left hand leads to the living room, where the fire is. ' +
    'It needs the robot at its default start position. ' +
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
// Why a hand on the wall is enough here: START and both rooms lie at the outer wall of the
// field, so the wall the hand follows from START leads through both rooms in every maze that
// can be played - and after at most 42 cells (a maze with one way only, the fire room last).
// Measured with these blocks (what the tests of samples.test.ts repeat on a smaller scale):
//   - 20 000 random mazes of the game's generator (seeds 1 to 20 000): 100 points in every one,
//     half of them under 44 s, 99 of 100 under 126 s, slowest 138.5 s;
//   - 10 000 mazes with one way only: 100 points in every one, slowest 138.5 s;
//   - the robot never touched a wall or the target, and ended at most 0.34 mm from the middle
//     of the fire room.
// The slowest kind of maze (42 cells, the other room on the way) takes 137.9 to 138.5 s,
// depending on the spot of the fire: the number the description gives.

const fullMission: SampleProgram = {
  ...exampleCard('chief-full-mission'),
  description:
    'The whole mission, for any maze. The robot follows the wall with its left hand, cell by cell. ' +
    'In a room it looks around with the flame sensor and shows the highest value on its screen. ' +
    'No flame: it follows the wall on to the other room. A flame: it turns to face it, stands still and lets the fan blow. ' +
    'After 3 seconds the referee ends the attempt: mission complete. ' +
    'The robot does not drive closer: the fan reaches the fire from the middle of the room, and moving the fire target would end the attempt. ' +
    'It scored 100 points in every maze it was tested on - the default maze, 300 random mazes and 240 of the hardest kinds - ' +
    'without touching a wall or the target. The default maze takes 37 seconds, the slowest maze found 139 of the 180 seconds. ' +
    'It needs the robot at its default start position. ' +
    'Try the right hand (swap "turn left" and "turn right" in the loop): in which mazes is it faster?',
  program: program([
    ...movingBlocks(),
    lookAroundBlock(),
    script(whenStart(), [
      ...rememberStart(),
      setVar('best', 0),
      note(setVar('room seen', NO_ROOM), `The column of the room the robot has already looked around in. ${NO_ROOM} means: none yet.`),
      note(
        repeatUntil(gt(v('best'), FLAME_SEEN), [
          ...wallStep('left'),
          note(
            ifThen(and(inARoom(), not(eq(v('col'), v('room seen')))), [
              call('look around'),
              print(join('Flame value in this room: ', v('best'))),
              setVar('room seen', v('col')),
            ]),
            'In a room - and not the one the robot has looked around in before (the way along the wall can lead through it twice): look around for the fire.',
          ),
        ]),
        `Until the flame sensor has seen the fire (a value above ${FLAME_SEEN}): one more step along the wall.`,
      ),
      faceTheFlame(),
      ledColor('all', RED),
      note(wait(0.5), 'Stand still: a fan action only counts when the robot does not move.'),
      note(dcMotor('M1', 100), 'Fan on. It is on DC motor port M1.'),
      note(wait(FAN_SECONDS), 'The fan must blow at the fire for 3 seconds without a break. A little more does no harm.'),
      note(
        stopDcMotor('M1'),
        'Fan off. In the simulator the referee has ended the attempt before this block (mission complete). A real robot must switch its fan off itself.',
      ),
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
