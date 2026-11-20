/**
 * What the "Rules" button of the Fire Cadet simulator shows (design 7.11, changed by lead decision
 * D1 for the obstacles). Two parts, kept clearly apart:
 *
 *   1. CADET_RULES - the organiser's rules in short (txt/rules.txt, "Fire Cadet - Rescue City",
 *      Season 2027) and the organiser's answers: nothing else. No sentence of it begins with
 *      "Here": what the simulator had to choose is never mixed into the rules.
 *   2. CADET_ASSUMPTIONS - "What this simulator assumes": where the rules are open, what the
 *      organiser has not decided yet, and every number the simulator had to choose. Each sentence
 *      stands for one or more assumptions of the design (A1-A14, N1-N24, and D1 of the lead), which
 *      ASSUMPTIONS_SHOWN lists, so rules.test.ts can check that none is missing.
 *
 * For children of 4 to 7 and their teachers, many of whom read English as a second language: short
 * sentences, plain words, and nothing more certain than the rules or the simulator. Every number
 * is written from the one table, FIRE_CADET (../../fire-cadet/numbers.ts), or from the game's own
 * lists; rules.test.ts checks every number of every sentence. The one number of the real robot,
 * 18.6 cm for one Forward card on the maker's own map, is REAL_STEP.
 *
 * The two small interfaces below have the same shape as RulesSection and RulesPart of
 * ../SimulatorApp.tsx, but are declared here: the Fire Cadet page must not reach SimulatorApp.tsx,
 * not even through a type (the examples guard follows type-only imports: members/client-guard.test.ts).
 * So this file imports nothing outside ui/fire-cadet/ and fire-cadet/.
 *
 * Plain TypeScript (no DOM, no React), so the tests read it under Node.
 */
import { NUMBER_CARDS } from '../../fire-cadet/cards';
import { PLACE_WORDS, WATER_SQUARES } from '../../fire-cadet/field';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { FIRE_PLACES, ITEM_NAMES, OBSTACLE_KINDS, PRACTICE_MAPS } from '../../fire-cadet/scenario';
import type { PictureName } from './pictures';
import { AGES, CATEGORY_AGES, THING_WORDS } from './words';

/** One section of the window: its heading and its bullets. `pictures`: the small picture in front of a bullet, by its place (an item, the Fire, an obstacle). */
export interface CadetRulesSection {
  title: string;
  items: string[];
  pictures?: readonly (PictureName | null)[];
}

/** One part of the window, with a heading of its own and one sentence under it. */
export interface CadetRulesPart {
  title: string;
  note?: string;
  sections: CadetRulesSection[];
}

const f = FIRE_CADET;

/** mm in cm, as a sentence writes it: 178 -> "17.8", 106.5 -> "10.65", 40 -> "4". */
export const cm = (mm: number): string => String(Math.round(mm * 10) / 100);

/** A small count as a word: "four" items, "three" obstacles, "two" sticks. */
export function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return words[n] ?? String(n);
}

/** The rules give two rounds; the best one counts (rules l.258-260). */
export const ROUNDS = 2;

/** A section whose bullets may carry a picture: [sentence, picture] or a sentence alone. */
function section(title: string, lines: readonly (string | readonly [string, PictureName])[]): CadetRulesSection {
  const items = lines.map((line) => (typeof line === 'string' ? line : line[0]));
  const pictures = lines.map((line) => (typeof line === 'string' ? null : line[1]));
  return pictures.some((p) => p !== null) ? { title, items, pictures } : { title, items };
}

const listWithOr = (words: readonly string[]): string => `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
const ITEMS = numberWord(ITEM_NAMES.length);
const OBSTACLES = numberWord(OBSTACLE_KINDS.length);
const MATCH_MINUTES = f.MATCH_SECONDS / 60;
const PLANNING_MINUTES = f.PLANNING_SECONDS / 60;

// =============================================================================================
// Part 1: the rules in short
// =============================================================================================

/** The line under the heading of the rules. */
export const RULES_NOTE = `Fire Cadet - Rescue City, ages ${CATEGORY_AGES}. These are the organiser's rules in short. What the rules do not say is in the second part.`;

export const CADET_RULES: CadetRulesPart = {
  title: 'Rules',
  note: RULES_NOTE,
  sections: [
    section('The mission', [
      'Your mTiny is the rescue robot of Fire City.',
      `There are ${ITEM_NAMES.length} rescue items on the map. Push each one to its place.`,
      ['The Water goes to the place with the Fire.', 'water'],
      ['The Cat goes to the Safe Zone.', 'cat'],
      ['The Injured Person goes to the Hospital.', 'person'],
      ['The Emergency Equipment goes back to the Fire Station.', 'equipment'],
      `You may do the ${ITEMS} in any order.`,
    ]),
    section('The map', [
      `The map has ${f.GRID_COUNT} x ${f.GRID_COUNT} squares.`,
      'The robot starts fully inside the Fire Station at the bottom of the map. The Equipment goes back there too. The Fire Station at the top has no job.',
      [`The Fire is at ${listWithOr(FIRE_PLACES.map((place) => PLACE_WORDS[place]))}.`, 'fire'],
      'The Water starts in the Water / Equipment Area.',
    ]),
    section('The obstacles', [
      `${OBSTACLE_KINDS.length} obstacles block roads: ${OBSTACLE_KINDS.map((kind) => THING_WORDS[kind]).join(', ')}.`,
      `All ${OBSTACLES} mean the same: find another way.`,
      `Try not to touch an obstacle: each one touched costs ${f.POINTS_OBSTACLE} point.`,
      'Do not push an obstacle away to use its road.',
      'If the robot moves an obstacle, the referee puts it back.',
    ]),
    section('Mini and Junior', [
      `Mini, ages ${AGES.panel}: you drive the robot with the Tap Pen.`,
      `Junior, ages ${AGES.cards}: you put coding cards in a row. Then the robot runs the row by itself.`,
      `In Junior you have ${f.PLANNING_SECONDS} seconds to plan your cards before the match.`,
      'When the planning time ends, the cards cannot be changed. Then the row is started.',
      'In Junior, nobody drives the robot after the start: it runs by itself.',
      'After GO, only the referee touches the robot. Nobody moves an item or an obstacle by hand.',
      'Coaches may not give directions or help with the cards.',
    ]),
    section('The match', [
      `A match lasts ${f.MATCH_SECONDS} seconds (${MATCH_MINUTES} minutes).`,
      'It also ends when you say STOP.',
      'When an item is fully inside its place, the referee takes it off the map. The points stay.',
    ]),
    section(`Points (${f.MAX_POINTS} at most)`, [
      `Each item in its place: ${f.POINTS_ITEM} points.`,
      `The robot fully inside the Fire Station at the end: ${f.POINTS_RETURN} points.`,
      `Each obstacle touched: ${f.POINTS_OBSTACLE} point less.`,
      `You play ${ROUNDS} rounds, perhaps on another map each time. Your best score counts. Mini and Junior are ranked apart.`,
      'With equal points, the shorter time wins. In Junior the planning time can count too.',
    ]),
  ],
};

// =============================================================================================
// Part 2: what this simulator assumes
// =============================================================================================

// The sentences of part 2 that stand for an assumption, by name, so that ASSUMPTIONS_SHOWN can
// point at them (and the test can find each one in the window).
const S = {
  start: 'Here the robot starts in the middle of the Fire Station and looks up the map. The rules do not say which way.',
  oneSquare: `One Forward or Backward card moves the robot exactly one square: ${cm(f.STEP)} cm. One Turn card turns it a quarter turn on the spot.`,
  realStep:
    `One Forward card moves a real mTiny ${cm(f.REAL_STEP)} cm on the maker's own map. On this map it would probably end about ` +
    `${cm(f.REAL_STEP - f.STEP)} cm further with every move. The simulator does not show that.`,
  times:
    `Here a move takes ${f.MOVE_SECONDS} seconds and a turn ${f.TURN_SECONDS} seconds. Between two moves the robot rests ` +
    `${f.REST_SECONDS} seconds. Nobody has timed a real robot for us.`,
  size: `The robot is ${cm(f.BODY_LENGTH)} cm long and ${cm(f.BODY_WIDTH)} cm wide. It turns around its middle.`,
  everySquare: 'The robot may drive over every square. Roads, grass and water are only pictures.',
  leaveMap: `The robot can leave the map. It stops ${cm(f.TABLE_MARGIN)} cm outside. That costs no points.`,

  organiserSticks: 'The organiser says: the robot gets two sticks at the front, on the left and on the right, to push an item in front of it.',
  stickSize: `Here each stick is ${cm(f.STICK_LENGTH)} cm long and ${cm(f.STICK_THICKNESS)} cm thick. The real size is not decided.`,
  sticksTurn: 'An item between the sticks goes along when the robot drives forward and when it turns. When the robot drives backward, the item stays where it is.',
  catch: 'So the robot must drive into the square of an item to catch it, and into the target square to deliver it.',

  itemBase: `Every item stands on a base of ${cm(f.ITEM_BASE)} cm by ${cm(f.ITEM_BASE)} cm. The real size is not decided.`,
  counts: 'An item counts at the first moment its whole base is inside the target square. The square reaches to the middle of the black lines, and to the edge of the map.',
  wrongPlace: 'An item in a wrong place gives no points and costs none. It stays on the map. The referee says so once it has stopped there.',
  waterStart: `The Water starts on one of the ${numberWord(WATER_SQUARES.length)} squares under the words WATER / EQUIPMENT AREA.`,
  flatFire: 'The Fire is a flat sign. The robot and the items can go over it.',

  obstacleBase: `Here an obstacle is ${cm(f.OBSTACLE_BASE)} cm by ${cm(f.OBSTACLE_BASE)} cm and stands in the middle of a square.`,
  lifted:
    'When anything touches an obstacle, the referee takes it off the map at once. ' +
    `It goes back on its own square as soon as nothing is closer to its place than ${cm(f.RESTORE_CLEARANCE)} cm.`,
  neverStuck: 'So the robot never gets stuck on an obstacle. It goes on from where it is.',
  oncePerObstacle:
    `Only the robot touching an obstacle costs a point: ${f.POINTS_OBSTACLE} point once for each obstacle, however often. ` +
    `So ${OBSTACLE_KINDS.length * f.POINTS_OBSTACLE} points at most.`,
  itemAgainst:
    'Here an item that the robot pushes against an obstacle costs no point: the rules do not say. ' +
    'But on the real map the robot may not open a blocked road that way.',
  closedRoad:
    'While an obstacle is off the map, the robot - or an item it pushes - could go through its square here. ' +
    'On the real map that is not allowed: drive around the obstacles.',

  cards: `Junior uses the cards seen at the organiser's events: Forward, Backward, Turn left, Turn right, and ${NUMBER_CARDS.join(', ')}. There are no Loop cards here.`,
  startCard: 'The row begins with the yellow start card. The round button starts it, like the button of the Tap Pen.',
  numberRule: 'Here a number card must follow an arrow card, and each arrow takes one number card at most. What a real robot does otherwise is not known.',
  times3: `With ${NUMBER_CARDS[1]} the arrow before it runs ${NUMBER_CARDS[1].slice(1)} times in all.`,
  maxCards: `A row holds ${f.MAX_ROW_CARDS} cards at most: more could not all be done in ${f.MATCH_SECONDS} seconds.`,
  mini: 'Mini uses the four arrow cards of the yellow panel. One tap is one whole move. Here a tap during a move is kept for after the move - only the last one.',
  realPen: 'On a real pen, wait until the robot stops before you tap again.',
  joystick: 'The joystick of the pen is not here.',

  juniorClock:
    `Junior: here the match clock starts when the row starts. The match ends when all cards are done, and that time counts. ` +
    `It also ends at ${f.MATCH_SECONDS} seconds or at STOP.`,
  miniClock: `Mini: the match ends at ${f.MATCH_SECONDS} seconds or at STOP.`,
  planning: `The planning clock only counts, and tells you when ${PLANNING_MINUTES} minutes are over. It locks nothing.`,

  bonus: 'Here the whole robot, with its sticks, must be inside the Fire Station square when the match ends.',
  leftFirst: 'And it must have been completely outside the square before. A robot that never left gets no bonus.',

  total: 'Here the total is never below 0. The rules do not say.',

  noList: `There is no official list of field combinations yet. Maps 1 to ${PRACTICE_MAPS.length} are practice maps of this simulator.`,
  ownMap: `With "My own map" you can copy a combination: the Fire, the ${ITEMS} items and the ${OBSTACLES} obstacles. An obstacle cannot stand on a marked place.`,
  middle: 'Here an obstacle always stands in the middle of its square.',

  notSimulated: `The ${ROUNDS} rounds and the ranking. A run that the referee stops because somebody touched the robot. The real Tap Pen and the real cards.`,
} as const;

/** What a screen reader calls the text of the window, which can take the keyboard to be scrolled (./RulesWindow.tsx). */
export const CADET_RULES_TEXT_LABEL = 'The rules, and what this simulator assumes';

/** The line under the heading of part 2. */
export const ASSUMPTIONS_NOTE =
  'These are not rules. The rules do not say these things, or the organiser has not decided them yet, so the simulator had to choose. ' +
  'Ask your teacher how it is at the competition.';

export const CADET_ASSUMPTIONS: CadetRulesPart = {
  title: 'What this simulator assumes',
  note: ASSUMPTIONS_NOTE,
  sections: [
    section('The robot', [S.start, S.oneSquare, S.realStep, S.times, S.size, S.everySquare, S.leaveMap]),
    section('The two sticks', [S.organiserSticks, S.stickSize, S.sticksTurn, S.catch]),
    section('The items', [S.itemBase, S.counts, S.wrongPlace, [S.waterStart, 'water'], [S.flatFire, 'fire']]),
    section('The obstacles', [
      [S.obstacleBase, 'road-closed'],
      S.lifted,
      S.neverStuck,
      S.oncePerObstacle,
      S.itemAgainst,
      S.closedRoad,
    ]),
    section('The cards', [S.cards, S.startCard, S.numberRule, S.times3, S.maxCards, S.mini, S.realPen, S.joystick]),
    section('The clocks', [S.juniorClock, S.miniClock, S.planning]),
    section('The Fire Station bonus', [S.bonus, S.leftFirst]),
    section('The total', [S.total]),
    section('The maps', [S.noList, S.ownMap, S.middle]),
    section('Not in the simulator', [S.notSimulated]),
  ],
};

/**
 * Which sentence of part 2 stands for which assumption (design 7.11, the list at its end, with
 * lead decision D1 in place of N17 and N23: an obstacle is put back by the referee, so the robot
 * is never stuck). Every assumption that changes what a child sees has a sentence; the others are
 * in the README with their questions to the organiser.
 */
export const ASSUMPTIONS_SHOWN: Readonly<Record<string, string>> = {
  A1: S.oneSquare,
  A2: S.times,
  A3: S.numberRule,
  A4: S.mini,
  A5: S.stickSize,
  A6: S.counts,
  A7: S.oncePerObstacle,
  A8: S.leftFirst,
  A9: S.total,
  A10: S.juniorClock,
  A11: S.planning,
  A12: S.start,
  A13: S.waterStart,
  A14: S.noList,
  N1: S.start,
  N2: S.size,
  N3: S.sticksTurn,
  N5: S.times,
  N7: S.mini,
  N9: S.maxCards,
  N10: S.leaveMap,
  N12: S.ownMap,
  N21: S.juniorClock,
  N24: S.wrongPlace,
  D1: S.lifted,
};
