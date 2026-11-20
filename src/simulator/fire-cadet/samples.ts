/**
 * Ready-made rows of mTiny coding cards for the Fire Cadet simulator (MakeX Lebanon, Season 2027,
 * "Fire Cadet - Rescue City", ages 4-7).
 *
 *   cadet-three-forward     starter       F F F                             practice map 1
 *   cadet-there-and-back    starter       F3 B3                             practice map 1
 *   cadet-turn-around       starter       F R2 F                            practice map 3
 *   cadet-two-rescues       intermediate  F3 B L F3 B3 L F2                 practice map 1
 *   cadet-round-the-sign    intermediate  L B R F3 L F B L F3 R F           practice map 5
 *   cadet-all-four          advanced      F3 B L F3 L F R2 F5 B5 B R F3     practice map 1
 *
 * (The short notation of the rows: F Forward, B Backward, L Turn left, R Turn right; a digit after
 * a letter is the number card behind it, so "F3 B L" is Forward, x3, Backward, Turn left. It is
 * the notation of ./cards.ts, cardsFromText.)
 *
 * =====================================================================================
 *  THIS FILE STAYS ON THE WEBSITE'S SERVER. NEVER IMPORT IT FROM THE SIMULATOR SCREEN.
 *
 *  The same rule as for the examples of the other games (../fire-rescue/samples.ts,
 *  ../fire-chief/samples.ts, ../warehouse-sort/samples.ts, ../locker-room/samples.ts): a
 *  visitor's browser gets a row and the text that explains it only from the server, which decides
 *  for every request what that visitor may have. So nothing that runs in the browser
 *  (src/simulator/ui, anything with 'use client', a page of the website) may import this file -
 *  nor ./sample-catalog.ts, the list of the titles.
 *
 *  The title and the level of each example are in ./sample-catalog.ts; the description and the
 *  row of cards are here. The server hands them out from ../members/all-examples.ts, the only file
 *  that imports this one.
 * =====================================================================================
 *
 * AN EXAMPLE IS A ROW OF CARDS MADE FOR ONE PRACTICE MAP (design 5.5; ASSUMPTION A15, N14). Its
 * program carries the code of that map in "field" ("P1" ... "P8": ./scenario.ts, PRACTICE_MAPS),
 * and the screen sets that map when it loads the row. A row of cards has no sensor and no "if": on
 * another map it drives exactly the same way and finds other things on its way, so it scores
 * little there. samples.test.ts plays every row on its own map and on all eight, and holds both
 * tables of numbers.
 *
 * Each program is a plain object in the format of a row (./cards.ts, CardRowProgram), as the
 * screen saves it - not written with the program builder (vm/builder.ts): a row of cards has no
 * blocks. It is valid as it stands (every number card right after a move card), so readCards()
 * gives it back unchanged.
 *
 * The robot starts on the middle of D7, the Fire Station at the bottom, looking up the map. One
 * Forward or Backward card moves it one square, a Turn card turns it a quarter turn on the spot
 * (./numbers.ts holds the sizes and the time of each card). The match ends when the row has run,
 * and that time counts. (Squares: a letter A to G for the column, a number 1 to 7 for the row,
 * A1 at the top left.)
 *
 * THE OBSTACLES (lead decisions D1 and D5): a touched obstacle costs 1 point, once for each
 * obstacle, whether the robot or an item it pushes touched it, and the referee puts it back on its
 * spot. On their own maps the six rows never touch one; on the other maps some of them do, always
 * with the robot itself (the comments below say where): none of them pushes an item into an
 * obstacle on any of the eight maps.
 *
 * The descriptions are for children of 4 to 7 and the teachers who read with them, many in English
 * as a second language: short sentences, plain words, and nothing more certain than the
 * simulator really knows. Every number in a description is the measured one (samples.test.ts
 * checks each of them), and none of their sentences may stand in a file the browser gets (the
 * guard of ../members/client-guard.test.ts).
 */
import type { CardRowProgram } from './cards';
import { exampleCard, type ExampleLevel } from './sample-catalog';

export type SampleLevel = ExampleLevel;

export interface SampleProgram {
  /** stable name, used in links and tests */
  id: string;
  title: string;
  level: SampleLevel;
  /** what the row does, what it scores and what to try next, in a few short sentences */
  description: string;
  /** the row of cards, and in "field" the code of the practice map it is made for */
  program: CardRowProgram;
}

// =============================================================================================
// 1. cadet-three-forward (starter): one card is one square
// =============================================================================================
// F F F on practice map 1. Measured (samples.test.ts): 5 points - the Cat goes into the Safe Zone
// (D4) 0.34 s into the third move, at 4.34 s - and the row ends after 5.6 s ('program-ended'). The
// robot stops on D6, D5 and D4: it ends in the Safe Zone, so there is no Fire Station bonus. No
// obstacle is touched. The try (Forward with x3): the same three moves, the same 5 points after
// 5.6 seconds.
// On the other maps: 0 points; on maps 5, 7 and 8 the robot touches the Road Closed sign on D5.

const threeForward: SampleProgram = {
  ...exampleCard('cadet-three-forward'),
  description:
    'Made for practice map 1. Three Forward cards: the robot drives three squares up the map. ' +
    'On the way it pushes the Cat into the Safe Zone. 5 points after 5.6 seconds. ' +
    'The robot stays in the Safe Zone, so there is no Fire Station bonus. ' +
    'Try a Forward card with an x3 card behind it in place of the three Forward cards. Does the robot do the same?',
  program: { format: 'mtiny-cards', version: 1, cards: ['forward', 'forward', 'forward'], field: 'P1' },
};

// =============================================================================================
// 2. cadet-there-and-back (starter): a number card, and Backward
// =============================================================================================
// F3 B3 on practice map 1. Measured: the Cat into the Safe Zone at 4.34 s; three squares back
// down, still looking up; the whole robot back inside D7 at the end: 10 points after 11.6 s
// ('program-ended'). The bonus counts because the robot left D7 first (ASSUMPTION A8).
// On the other maps: the bonus only, 5 points (map 2: no Cat in column D); on maps 5, 7 and 8 the
// robot touches the Road Closed sign on D5 on its way up: 4.

const thereAndBack: SampleProgram = {
  ...exampleCard('cadet-there-and-back'),
  description:
    'Made for practice map 1. Forward with x3: three squares up, and the Cat goes into the Safe Zone. ' +
    'Backward with x3: three squares back down, without turning, into the Fire Station. ' +
    '10 points after 11.6 seconds: the Cat and the Fire Station bonus. ' +
    'Here the bonus needs the robot to leave the Fire Station first and come back. ' +
    'Try it on map 2: there is no Cat on the way, so it scores 5.',
  program: { format: 'mtiny-cards', version: 1, cards: ['forward', 'x3', 'backward', 'x3'], field: 'P1' },
};

// =============================================================================================
// 3. cadet-turn-around (starter): an item turns with the robot
// =============================================================================================
// F R2 F on practice map 3, where the Equipment stands on D6. Measured: after Forward the robot
// stands on D6 with the Equipment between its sticks; Turn right with x2 turns both round on the
// spot; Forward pushes the Equipment back into D7 (5.74 s) and brings the robot in after it: 10
// points after 7 s ('program-ended'). No obstacle is touched. The try (Turn left with x2): the
// same 10 points after 7 s.
// On the other maps: the bonus only, 5 points (no other map has an item on D6); no obstacle there.

const turnAround: SampleProgram = {
  ...exampleCard('cadet-turn-around'),
  description:
    'Made for practice map 3, where the Equipment stands just above the Fire Station. ' +
    'Forward: the Equipment is now between the two sticks. ' +
    'Turn right with x2: the robot turns round to look the other way, and the Equipment turns with it. ' +
    'Forward: the Equipment goes back into the Fire Station, and so does the robot. 10 points after 7 seconds. ' +
    'Try Turn left with x2 in place of Turn right with x2.',
  program: { format: 'mtiny-cards', version: 1, cards: ['forward', 'right', 'x2', 'forward'], field: 'P3' },
};

// =============================================================================================
// 4. cadet-two-rescues (intermediate): two rescues in one row
// =============================================================================================
// F3 B L F3 B3 L F2 on practice map 1. Measured: the Cat into the Safe Zone at 4.34 s; one square
// back to D5, the row of the Injured Person (C5); Turn left, and three squares to the left push it
// into the Hospital (A5) at 14.04 s; three squares back to D5; Turn left (the robot now looks
// down) and two squares home: 15 points after 27 s ('program-ended'). No obstacle is touched. The
// Water (A6) stands right under the Hospital.
// On the other maps: the bonus only, and an obstacle on row 5 or in column D on the way (maps 4,
// 5, 7, 8: the Road Closed sign; map 6: the Broken Vehicle): 4 points there, 5 on maps 2 and 3.

const twoRescues: SampleProgram = {
  ...exampleCard('cadet-two-rescues'),
  description:
    'Made for practice map 1. Forward with x3: the Cat goes into the Safe Zone. ' +
    'Backward: one square back, into the row of the Injured Person. ' +
    'Turn left, then Forward with x3: the Injured Person goes into the Hospital. ' +
    'Backward with x3 brings the robot back to the middle column. ' +
    'Turn left and Forward with x2: home in the Fire Station. 15 points after 27 seconds. ' +
    'Try to add the Water: it stands just under the Hospital.',
  program: {
    format: 'mtiny-cards',
    version: 1,
    cards: ['forward', 'x3', 'backward', 'left', 'forward', 'x3', 'backward', 'x3', 'left', 'forward', 'x2'],
    field: 'P1',
  },
};

// =============================================================================================
// 5. cadet-round-the-sign (intermediate): a way round an obstacle
// =============================================================================================
// L B R F3 L F B L F3 R F on practice map 5, where the Road Closed sign stands on D5 and the Cat on
// E6. Measured: Turn left and Backward put the robot on E7, beside the Fire Station; Turn right and
// three squares up column E take the Cat along between the sticks; Turn left turns it with the
// robot, and Forward pushes it into the Safe Zone (D4) at 13.44 s; then Backward to E4, Turn left
// (the robot looks down), three squares down to E7, Turn right (it looks left) and Forward: home.
// 10 points after 28.1 s ('program-ended'), and the sign is never touched (nothing but the Cat
// leaves the field). The try, map 2: the Cat stands on E5 there, in the same column: also 10.
// On the other maps: the bonus only, 5 points; on map 4 the robot touches the Broken Vehicle on
// E7 with its first Backward: 4.

const roundTheSign: SampleProgram = {
  ...exampleCard('cadet-round-the-sign'),
  description:
    'Made for practice map 5. A Road Closed sign stands two squares above the Fire Station, so the robot goes round it. ' +
    'Turn left, then Backward: the robot is now beside the Fire Station. ' +
    'Turn right, then Forward with x3: up the column of the Cat, with the Cat between the sticks. ' +
    'Turn left - the Cat turns with the robot - and Forward: the Cat is home in the Safe Zone. ' +
    'Then Backward, Turn left, Forward with x3, Turn right and Forward: down the same column and home. ' +
    '10 points after 28.1 seconds, and the sign is never touched. ' +
    'Try it on map 2: the Cat stands in the same column there.',
  program: {
    format: 'mtiny-cards',
    version: 1,
    cards: ['left', 'backward', 'right', 'forward', 'x3', 'left', 'forward', 'backward', 'left', 'forward', 'x3', 'right', 'forward'],
    field: 'P5',
  },
};

// =============================================================================================
// 6. cadet-all-four (advanced): the whole mission on the easiest map
// =============================================================================================
// F3 B L F3 L F R2 F5 B5 B R F3 on practice map 1: the shortest row for all 25 points there (the
// proof row of map 1, ./practice.test.ts). Measured: the Cat at 4.34 s, the Injured Person at
// 14.04 s (as in the example before); Turn left (the robot looks down) and Forward bring the robot
// to A6 with the Water between its sticks; Turn right with x2 turns both round; five squares up
// push the Water into the School, where the Fire is, at 31.14 s; Backward with x5 and one more
// Backward bring the robot to A7; Turn right and three squares to the right catch the Equipment on
// C7 and push it into D7 at 50.84 s, the robot in after it. 25 points after 52.1 s
// ('program-ended'), with 18 cards; no obstacle is touched.
// On the other maps: the bonus only - 5 points on maps 2 and 3, 4 on maps 4 to 8, where the robot
// touches one obstacle on its way (the Road Closed sign; on map 6 the Broken Vehicle).

const allFour: SampleProgram = {
  ...exampleCard('cadet-all-four'),
  description:
    'The whole mission on practice map 1: all 25 points after 52.1 seconds, with 18 cards. ' +
    'First the Cat goes to the Safe Zone, then the Injured Person to the Hospital. ' +
    'Then the Water: Turn left, then one square down, turn round with x2, and push it five squares up into the School, where the Fire is. ' +
    'Backward with x5 and one more Backward bring the robot to the bottom row. ' +
    'Turn right and Forward with x3: the robot catches the Equipment on the way, pushes it home and drives in after it. ' +
    'On the other maps this row does not work: a row of cards fits one map. ' +
    'Try map 2 with a row of your own.',
  program: {
    format: 'mtiny-cards',
    version: 1,
    cards: ['forward', 'x3', 'backward', 'left', 'forward', 'x3', 'left', 'forward', 'right', 'x2', 'forward', 'x5', 'backward', 'x5', 'backward', 'right', 'forward', 'x3'],
    field: 'P1',
  },
};

// =============================================================================================
// The lists
// =============================================================================================

/** Every example of Fire Cadet, in the order of ./sample-catalog.ts. */
export const SAMPLE_PROGRAMS: SampleProgram[] = [threeForward, thereAndBack, turnAround, twoRescues, roundTheSign, allFour];

/** Find a sample by its id. */
export function getSampleProgram(id: string): SampleProgram | undefined {
  return SAMPLE_PROGRAMS.find((sample) => sample.id === id);
}
