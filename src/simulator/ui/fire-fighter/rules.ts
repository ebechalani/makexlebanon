/**
 * What the "Rules" button of the Fire Fighter simulator shows. Two parts, kept clearly apart:
 *
 *   1. FIRE_FIGHTER_RULES - the mission ("Fire Fighter - Fire City", ages 8 to 10) in short, plain
 *      words: only what the rules say and what the organiser answered (the match time, where the
 *      letters stand, which way tower X opens). One sentence says what is different in this
 *      simulator (the claw), and says so.
 *   2. FIRE_FIGHTER_ASSUMPTIONS - "What this simulator assumes": every choice the simulator had to
 *      make where the rules and the organiser say nothing (yet). Nobody should take one of these for
 *      a rule, so they are never mixed into part 1. The two lines in it that the organiser gave - the
 *      size of a tower, and the room between its two sides - say so. The questions for the organiser,
 *      with the constant behind every one, are at the top of ../../fire-fighter/game.ts (F1 - F13)
 *      and in the README.
 *
 * The scoring of the rules is "Proposed scoring for organizer review": the note under the heading
 * says that the organiser has not confirmed it yet. No rules file is linked: none is published on
 * this website (a question to the organiser, F11).
 *
 * The category is for ages 8 to 10, and their teachers read along: short sentences, plain words,
 * nothing more certain than the rules or the simulator. Every number is written from the constant
 * that holds it, and ./rules.test.ts checks every number of every sentence against the game.
 *
 * (The referee itself is in ../../fire-fighter/game.ts; this is only what students read.)
 */
import {
  CUBE_SIZE,
  OPENING,
  ROOM_ACROSS,
  ROOM_ALONG_OPENING,
  SUPPORT_WIDTH,
  TOWER_DEPTH,
  TOWER_GAP,
  TOWER_HEIGHT,
  TOWER_IDS,
  TOWER_NAMES,
  TOWER_PLACES,
  TOWER_WIDTH,
} from '../../fire-fighter/field';
import { DELIVERY_POINTS, MATCH_DURATION, MAX_SCORE, MOVED_TOWER_PENALTY, WANTED_COLOR } from '../../fire-fighter/game';
import { clawAheadOfLineSensor, FIRE_FIGHTER_ROBOT } from '../../fire-fighter/robot';
import type { RulesPart, RulesSection } from '../SimulatorApp';
import { FIRE_FIGHTER_START_ZONE } from './words';

/** mm in cm, as a sentence writes it: 105 -> "10.5", 22.5 -> "2.25", 50 -> "5". */
export const cm = (mm: number): string => String(Math.round(mm * 10) / 100);

/**
 * mm as a sentence writes them, to a tenth, ROUNDED DOWN: the window never promises more room than
 * the referee gives (7.8195 -> "7.8").
 */
export const mmDown = (mm: number): string => String(Math.floor(mm * 10 + 1e-9) / 10);

/** The four towers that want a red cube, in the order of the rules' check table (§6): M, A, K, E. (X wants the yellow one.) */
export const RED_TOWERS = TOWER_IDS.filter((tower) => WANTED_COLOR[tower] === 'red');

/** "M, A, K and E" */
const listed = (items: readonly string[], last = 'and'): string => `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`;

/** The sentence under the heading of the rules window. (No name of a level of the examples here: ./rules.test.ts.) */
export const FIRE_FIGHTER_RULES_NOTE = 'MakeX Lebanon, Season 2027, ages 8 to 10. The scoring is a proposal the organiser has not confirmed yet.';

export const FIRE_FIGHTER_RULES: RulesSection[] = [
  {
    title: 'The mission',
    items: [
      `Your mBot2 starts in the ${FIRE_FIGHTER_START_ZONE} and drives on its own.`,
      `Bring one red cube to each of the towers ${listed(RED_TOWERS)}.`,
      'Take the yellow cube to tower X in the middle: once the robot has taken it, X must be its next delivery.',
      `A cube pushed far enough in under a tower makes its letter show: ${TOWER_IDS.join(' ')}.`,
      `A match lasts ${MATCH_DURATION} seconds.`,
    ],
  },
  {
    title: 'The field',
    items: [
      'Red cubes: two in the left bay, two in the right bay, on the marked squares.',
      `Yellow cube: on the red square above the ${FIRE_FIGHTER_START_ZONE}.`,
      // (the four towers of the red cubes stand in the four corners, X in the middle: §2.3 and the organiser)
      `Towers: ${RED_TOWERS.map((tower) => `${tower} at the ${TOWER_NAMES[tower]} (${TOWER_PLACES[tower]})`).join(', ')}.`,
      `Tower X stands at the ${TOWER_NAMES.X}, in the ${TOWER_PLACES.X}.`,
      'The referee turns each tower so that it opens towards its track.',
      // (the organiser's answer to our first question: ../../fire-fighter/field.ts OPENING)
      `Tower X opens to the ${OPENING.X}, towards the hydrant line (the organiser's answer).`,
    ],
  },
  {
    title: 'A delivery',
    items: [
      'Slide the cube between the two supports of the tower, inside the white dashed square, until the letter shows.',
      'Then let go and move clear.',
      `Any red cube can go to ${listed(RED_TOWERS, 'or')}, in any order.`,
      'In this simulator the claw is too wide with a cube in it. Let go in front of the tower, then push the cube in with the closed claw (see below).',
    ],
  },
  {
    title: 'The yellow cube',
    items: [
      'Once the robot has taken the yellow cube, X must be its next delivery.',
      // (the first delivery after the robot took the yellow cube decides: the yellow cube at X, or nothing - ../../fire-fighter/game.ts F8)
      'If another delivery comes first (the yellow cube under another tower counts too), the yellow cube scores nothing, even under X.',
      'Cubes delivered before the robot takes the yellow cube do not matter.',
    ],
  },
  {
    title: 'Points',
    items: [
      `${DELIVERY_POINTS} points for each tower with the right cube and its letter showing (${RED_TOWERS.join(', ')}: red; X: yellow, delivered next after the robot took it).`,
      'Each tower is checked once, at the end.',
      `A tower that ends off its picture square: 0 for that tower, and ${MOVED_TOWER_PENALTY} points off. Touching the edge of the square is enough.`,
      '0 for an empty tower, a cube of the wrong colour, a hidden letter, or a cube the robot still holds.',
      `Highest score ${MAX_SCORE}, lowest 0.`,
    ],
  },
  {
    title: 'The end',
    items: [`The match ends after ${MATCH_DURATION} seconds.`, 'The rules say nothing about restarts.'],
  },
];

/** The second part of the window: what the simulator had to choose because the rules and the organiser do not say it. */
export const FIRE_FIGHTER_ASSUMPTIONS: RulesPart = {
  title: 'What this simulator assumes',
  note: "Choices of the simulator, not rules, except the lines that say they are the organiser's.",
  sections: [
    {
      title: 'The towers',
      items: [
        `A tower is ${cm(TOWER_WIDTH)} cm wide and ${cm(TOWER_DEPTH)} cm deep (the organiser's size).`,
        `Its two sides stand ${cm(TOWER_GAP)} cm apart, as wide as the white dashed square (the organiser's answer: "about ${cm(TOWER_GAP)} cm").`,
        `A tower is ${cm(TOWER_HEIGHT)} cm high (the organiser's answer).`,
        `Here the sides are ${cm(SUPPORT_WIDTH)} cm thick.`,
        "A tower can slide when the robot pushes it (the organiser's answer). It never turns and never falls over: the simulator cannot turn or tip things.",
      ],
    },
    {
      title: 'The letter',
      items: [
        "The letter shows only when the whole bottom of the cube is inside the white dashed square (the organiser's answer). The dashed line counts as inside.",
        "The cube must also have gone in through the tower's opening.",
        'A cube that goes in from the back of a tower does not count.',
        `The cube may be up to ${mmDown(ROOM_ALONG_OPENING)} mm off the middle towards the opening or the back. Sideways it has ${mmDown(ROOM_ACROSS)} mm on each side: more, and it can catch a side and push the tower away.`,
        'A cube always stands upright here.',
      ],
    },
    {
      title: 'Pushing a cube in',
      items: [
        'A claw that holds a cube does not fit between the sides.',
        `Let the cube go in front of the tower, move back more than ${cm(CUBE_SIZE)} cm, close the empty claw and push the cube in.`,
        'Opening the claw inside a tower pushes the tower. A real claw would stop.',
      ],
    },
    {
      title: 'The cubes',
      items: [
        'Each cube starts in the middle of its marked square.',
        "The robot has taken the yellow cube when its claw holds it, or when the middle of the cube has left its red square (the organiser's answer).",
        'A delivery counts when the letter shows and no part of the robot touches the cube.',
        'A cube the robot still touches at the end scores 0: the robot must move clear.',
        'Touching or nudging a cube that is already under a tower is not a new delivery; taking it out and pushing it in again is.',
      ],
    },
    {
      title: 'The robot',
      items: [
        'The robot is the mBot2 of Fire Rescue Junior and Senior: claw in front, line sensor under its nose.',
        `Its claw reaches ${cm(clawAheadOfLineSensor(FIRE_FIGHTER_ROBOT))} cm further than its line sensor. At ${listed(RED_TOWERS)} the T bar is so close to the tower that the claw would already be inside the tower when the sensor sees the bar.`,
      ],
    },
    {
      title: 'The match',
      items: ['The simulator also ends the match when you press Finished, or when the program has ended and the robot stands still.'],
    },
    {
      title: 'Not in the simulator',
      items: ["A referee's judgement by eye: the simulator measures every cube to the millimetre."],
    },
  ],
};
