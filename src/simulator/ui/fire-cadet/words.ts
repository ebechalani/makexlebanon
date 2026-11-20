/**
 * Every word of the Fire Cadet screen (design 7.15), in one place - except the Rules window, whose
 * texts are in ./rules.ts. No other file of this folder holds an English sentence (words.test.ts
 * reads the string literals of the folder to make sure).
 *
 * The screen is for children of 4 to 7, who mostly cannot read yet, and for their teachers: the
 * controls a child uses are pictures, and the words are short, plain English that many readers
 * speak as a second language. Nothing here is more certain than the simulator itself:
 *
 *   - What the referee says is NOT here. The banner shows the referee's own sentence
 *     (ScoreReport.now, written in ../../fire-cadet/game.ts) as it is, and the score sheet shows the
 *     referee's own lines. So the screen can never say something the referee did not do.
 *   - The refusals of the row are the game's own (../../fire-cadet/cards.ts: ROW_PROBLEM_WORDS), and
 *     the sentences about a map code that does not read are the map's own (../../fire-cadet/scenario.ts).
 *   - Every number is written from the one table, FIRE_CADET (../../fire-cadet/numbers.ts), or from
 *     the game's own lists: a time, a size or a count that changes there changes here.
 *
 * Plain TypeScript (no DOM, no React), so the tests read it under Node.
 */
import { ROW_PROBLEM_WORDS, type CardName, type MoveCard } from '../../fire-cadet/cards';
import { PLACES, PLACE_WORDS, START_SQUARE, WATER_SQUARES } from '../../fire-cadet/field';
import { itemId, obstacleId } from '../../fire-cadet/game';
import { FIRE_CADET, gridBound, type Square } from '../../fire-cadet/numbers';
import {
  FIRE_PLACES,
  ITEM_NAMES,
  ITEM_WORDS,
  OBSTACLE_KINDS,
  OBSTACLE_WORDS,
  PRACTICE_MAPS,
  squareName,
  type FireCadetScenario,
  type ItemName,
  type MapThing,
  type ObstacleKind,
  type PlaceProblem,
} from '../../fire-cadet/scenario';
import type { SolverVerdict } from '../../fire-cadet/solver';
import type { Body, Pose } from '../../core/types';
import type { ScreenWords } from '../screen-words';

// =============================================================================================
// Small helpers for numbers in sentences
// =============================================================================================

/** "1 card", "6 cards". */
export const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * A time the referee wrote down, in seconds, as a sentence says it: cut to tenths, never rounded
 * up (as the referee writes it: ../format.ts formatRefereeTime), and without ".0" - 11.6, 7, 52.1.
 */
export function secondsText(seconds: number): string {
  const tenths = Math.max(0, Math.floor((Number.isFinite(seconds) ? seconds : 0) * 10 + 1e-6));
  return String(tenths / 10);
}

/** Whole seconds as a clock shows them, counting up: 83.9 -> "1:23" (the planning stopwatch). */
export function clockUp(seconds: number): string {
  const whole = Math.max(0, Math.floor((Number.isFinite(seconds) ? seconds : 0) + 1e-6));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "a, b and c" */
const listWithAnd = (words: readonly string[]): string =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
/** "a, b or c" */
const listWithOr = (words: readonly string[]): string =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;

// =============================================================================================
// The two ways to play
// =============================================================================================

/** Junior lays a row of coding cards ('cards'); Mini drives with taps on the direction panel ('panel'). */
export type PlayMode = 'cards' | 'panel';
export const PLAY_MODES: readonly PlayMode[] = ['cards', 'panel'];

/** The ages of the two ways to play (rules l.130, l.138): written here once, read by the Rules window too. */
export const AGES: Readonly<Record<PlayMode, string>> = { panel: '4-5', cards: '6-7' };
/** The ages of the whole category. */
export const CATEGORY_AGES = '4 to 7';

/** The name of each way to play, first in every sentence about the end of a match: Mini and Junior are ranked apart (rules l.261). */
export const MODE_NAME: Readonly<Record<PlayMode, string>> = { cards: 'Junior', panel: 'Mini' };

// =============================================================================================
// The cards
// =============================================================================================

/** The name of each card, as the box, the row and the panel say it. */
export const CARD_WORDS: Readonly<Record<CardName, string>> = {
  forward: 'Forward',
  backward: 'Backward',
  left: 'Turn left',
  right: 'Turn right',
  x2: '2 times',
  x3: '3 times',
  x4: '4 times',
  x5: '5 times',
};

/** The words on a number card: "x3". */
export const numberCardText = (card: CardName): string => card;

// =============================================================================================
// The screen's words
// =============================================================================================

/** The words of the score sheet (../ScoreSheet.tsx) for this game: a "match" of "jobs", and the line under the sheet. */
export const CADET_SHEET_WORDS: Partial<ScreenWords> = {
  match: 'match',
  goal: 'job',
  goals: 'jobs',
  goalsShort: 'done',
  sheetNotesHeading: 'Obstacles',
  sheetNote: 'The points are what the referee would write down right now. Here the total is never below 0: the rules do not say.',
};

const PLANNING_WHOLE = clockUp(FIRE_CADET.PLANNING_SECONDS);
const PLANNING_MINUTES = FIRE_CADET.PLANNING_SECONDS / 60;

export const CADET_WORDS = {
  // ---- the title row and the loading screen
  title: 'Fire Cadet',
  robot: 'mTiny',
  examplesButton: 'Examples',
  rulesButton: 'Rules',
  loading: 'Getting the map and the robot ready…',
  /** the one sentence of the Examples window that says what loading an example does here (design 7.12, ../ExamplesDialog.tsx howLoadingWorks) */
  howLoadingWorks: 'Loading one puts its cards in your row and sets its map (Undo brings your cards back).',

  // ---- the mode switch
  modeGroup: 'How to play',
  mode: {
    cards: { label: 'Junior: cards', ages: `ages ${AGES.cards}` },
    panel: { label: 'Mini: tap to drive', ages: `ages ${AGES.panel}` },
  } as Readonly<Record<PlayMode, { label: string; ages: string }>>,

  // ---- the match bar
  speedGroup: 'Speed',
  speed: (n: number): string => `${n}x`,
  clockLabel: (left: string): string => `Match clock: ${left} left`,
  pointsLabel: (total: number, max: number): string => `${total} of ${max} points`,

  // ---- the round button (design 7.4)
  go: {
    word: 'GO',
    label: { cards: 'Go: the robot runs your row', panel: 'Go: the match starts' } as Readonly<Record<PlayMode, string>>,
  },
  stop: { word: 'STOP', label: 'Stop: the match ends now and the points count' },
  again: { word: 'AGAIN', label: 'Again: put everything back to the start' },

  // ---- the row and the card box (design 7.3, 7.13)
  row: {
    heading: 'Your row',
    box: 'The cards',
    label: (n: number): string => `Your row: ${count(n, 'card', 'cards')}`,
    startCard: 'Start card',
    card: (place: number, card: CardName, numberCard: boolean): string =>
      numberCard ? `Card ${place}: ${CARD_WORDS[card]}, for the card before it` : `Card ${place}: ${CARD_WORDS[card]}`,
    add: (card: CardName): string => `Add ${CARD_WORDS[card]}`,
    undo: 'Undo',
    redo: 'Redo',
    moveLeft: 'Move the card to the left',
    moveRight: 'Move the card to the right',
    remove: 'Remove the card',
    clear: 'New row',
    /** the end of the row: a tap there lets go of the selected card */
    end: 'End of the row',
    // what a screen reader hears after every change of the row
    added: (card: CardName, n: number): string => `${CARD_WORDS[card]} added. ${count(n, 'card', 'cards')}.`,
    removed: (n: number): string => `Card removed. ${count(n, 'card', 'cards')}.`,
    moved: 'Card moved.',
    undone: (n: number): string => `Undo. ${count(n, 'card', 'cards')}.`,
    redone: (n: number): string => `Redo. ${count(n, 'card', 'cards')}.`,
  },
  /** the refusals of the row (design 4.3): the game's own words */
  refusals: ROW_PROBLEM_WORDS,

  // ---- what the screen itself says in the banner, for a few seconds (design 7.6)
  notes: {
    emptied: 'The row is empty. Undo brings your cards back.',
    addFirst: 'Add a card first.',
    example: 'Example loaded: its cards and its map.',
    practiceMap: (n: number): string => `Map ${n}.`,
    ownMap: 'My own map.',
  },

  // ---- the banner (design 7.6): what is going on, when the referee and the screen have nothing newer to say
  banner: {
    running: { cards: 'The robot runs your cards.', panel: 'Tap an arrow.' } as Readonly<Record<PlayMode, string>>,
    readyEmpty: 'Tap a card to build your row.',
    ready: { cards: 'Press GO. The robot runs your row.', panel: 'Press GO. Then tap an arrow.' } as Readonly<Record<PlayMode, string>>,
    /** "10 of 25 points" - or, with every point, "All 25 points" */
    points: (total: number, max: number): string => (total >= max ? `All ${max} points` : `${total} of ${max} points`),
    rowDone: (mode: PlayMode, points: string, seconds: string, all: boolean): string =>
      `${MODE_NAME[mode]}: all cards are done. ${points} in ${seconds} seconds${all ? '!' : '.'}`,
    timeUp: (mode: PlayMode, points: string, all: boolean): string => `${MODE_NAME[mode]}: time is up. ${points}${all ? '!' : '.'}`,
    stopped: (mode: PlayMode, points: string, seconds: string, all: boolean): string =>
      `${MODE_NAME[mode]}: stop. ${points} in ${seconds} seconds${all ? '!' : '.'}`,
    /** (a match that ended any other way: none does in this game, but the banner must say something true) */
    over: (mode: PlayMode, points: string, all: boolean): string => `${MODE_NAME[mode]}: the match is over. ${points}${all ? '!' : '.'}`,
  },

  // ---- the direction panel (design 7.5)
  panel: {
    label: 'Direction panel',
    oneTap: 'One tap, one move.',
    goFirst: 'Press GO first.',
    card: { forward: 'Forward', backward: 'Backward', left: 'Turn left', right: 'Turn right' } as Readonly<Record<MoveCard, string>>,
  },

  // ---- the planning stopwatch (design 7.10)
  planning: {
    title: 'Planning time',
    start: 'Start',
    finish: 'Finish!',
    again: 'Again',
    over: `${PLANNING_MINUTES} minutes are over.`,
    recorded: (time: string): string => `Planning time: ${time}.`,
    underSheet: (time: string): string => `Planning time: ${time} of ${PLANNING_WHOLE}.`,
    clockLabel: (time: string): string => `Planning time: ${time}`,
  },

  // ---- the map picker (design 7.8)
  map: {
    title: 'Map',
    practiceGroup: 'Practice map',
    practice: (n: number): string => String(n),
    own: 'My own map',
    surprise: 'Surprise',
    first: 'Map 1',
    code: 'Code:',
    copy: 'Copy the map code',
    copied: 'Copied',
    enterCode: 'Enter a code',
    use: 'Use',
    note:
      `Maps 1 to ${PRACTICE_MAPS.length} are practice maps of this simulator, not official ones. ` +
      `1 is the easiest, ${PRACTICE_MAPS.length} the hardest. Here an obstacle stands in the middle of its square. ` +
      'A new map puts everything back to the start.',
  },

  // ---- the own-map editor (design 7.8)
  editor: {
    title: 'My own map',
    how: 'Tap a thing. Then tap a square.',
    tray: 'Things on the map',
    board: 'The map',
    code: 'Code:',
    cancel: 'Cancel',
    use: 'Use this map',
    found: (moves: number, seconds: number): string =>
      `This simulator found a row for all ${FIRE_CADET.MAX_POINTS} points: ${moves} moves, ${secondsText(seconds)} seconds.`,
    notFound: `This simulator found no row for all ${FIRE_CADET.MAX_POINTS} points inside ${FIRE_CADET.MATCH_SECONDS} seconds.`,
    /** what a screen reader hears for a square of the board: "D5: Cat", "D7: the robot starts here", "C3: empty" */
    square: (name: string, things: readonly MapThing[], start: boolean): string => {
      if (start) return `${name}: the robot starts here`;
      if (things.length === 0) return `${name}: empty`;
      return `${name}: ${things.map((thing) => THING_WORDS[thing]).join(', ')}`;
    },
  },

  // ---- the score (design 7.9)
  score: {
    sheet: (mode: PlayMode): string => `Score sheet · ${MODE_NAME[mode]}`,
    stripLabel: 'Score',
    done: (name: string): string => `${name}: done`,
    notYet: (name: string): string => `${name}: not yet`,
    touched: (name: string): string => `${name}: touched, ${FIRE_CADET.POINTS_OBSTACLE} point less`,
    notTouched: (name: string): string => `${name}: not touched`,
    minus: `-${FIRE_CADET.POINTS_OBSTACLE}`,
  },
};

/** The name of each thing in the editor's tray (design 7.8) and on the score strip. */
export const THING_WORDS: Readonly<Record<MapThing, string>> = {
  fire: 'Fire',
  water: 'Water',
  cat: 'Cat',
  person: 'Injured Person',
  equipment: 'Equipment',
  'road-closed': 'Road Closed',
  'fallen-tree': 'Fallen Tree',
  'broken-vehicle': 'Broken Vehicle',
};

/** The names on the score strip, by the id of the score sheet's line (../../fire-cadet/game.ts). */
export const STRIP_WORDS: Readonly<Record<ItemName | 'return', string>> = {
  water: THING_WORDS.water,
  cat: THING_WORDS.cat,
  person: THING_WORDS.person,
  equipment: THING_WORDS.equipment,
  return: 'Robot home',
};

/**
 * Why the editor does not put a thing on a square (design 7.8): one sentence for each rule of
 * ../../fire-cadet/scenario.ts placeProblem. `thing` is the thing that was lifted.
 */
export function editorRefusal(problem: PlaceProblem, thing: MapThing): string {
  switch (problem) {
    case 'fire-place':
      return `The Fire can be at ${listWithOr(FIRE_PLACES.map((place) => PLACE_WORDS[place]))}.`;
    case 'water-square':
      return `The Water starts on ${listWithOr(WATER_SQUARES.map(squareName))}.`;
    case 'start-square':
      return 'Nothing can stand where the robot starts.';
    case 'own-target':
      return thing === 'cat' ? `The Cat cannot start in ${PLACE_WORDS.safeZone}.` : `The ${ITEM_WORDS[thing as ItemName]} cannot start in ${PLACE_WORDS.hospital}.`;
    case 'obstacle-marked':
      return 'An obstacle stands on a road, not on a marked place.';
    case 'taken':
      return 'This square is taken.';
  }
}

/** The solver's line under the editor's board (N18): "found" - never "possible" (../../fire-cadet/solver.ts). */
export const solverLine = (verdict: SolverVerdict): string =>
  verdict.found ? CADET_WORDS.editor.found(verdict.moves, verdict.seconds) : CADET_WORDS.editor.notFound;

// =============================================================================================
// The field in words (design 7.13): the description of the stage for a screen reader
// =============================================================================================

const HEADING_WORDS = ['up', 'right', 'down', 'left'] as const;

/** The square that holds a point of the mat, or null off the mat. */
export function squareAt(x: number, y: number): Square | null {
  const n = FIRE_CADET.GRID_COUNT;
  if (!(x >= 0 && x <= FIRE_CADET.MAT && y >= 0 && y <= FIRE_CADET.MAT)) return null;
  let col = 0;
  let row = 0;
  while (col < n - 1 && x >= gridBound(col + 1)) col++;
  while (row < n - 1 && y >= gridBound(row + 1)) row++;
  return { col, row };
}

/** Which way the robot looks, as a child says it: the nearest of up, right, down and left. */
export function lookWord(heading: number): (typeof HEADING_WORDS)[number] {
  const quarter = Math.round(heading / (Math.PI / 2));
  return HEADING_WORDS[((quarter % 4) + 4) % 4];
}

/**
 * Does this item stand between the robot's two sticks? Its middle ahead of the front of the body
 * and not ahead of the tips of the sticks, and between the two sticks (the same place the engine
 * takes along in a turn: core/engine.ts, fixed sticks).
 */
export function betweenSticks(pose: Pose, item: Pick<Body, 'x' | 'y'>): boolean {
  const dx = item.x - pose.x;
  const dy = item.y - pose.y;
  // heading 0 looks up the mat (-y), clockwise: forward = (sin h, -cos h), right = (cos h, sin h)
  const ahead = dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading);
  const aside = dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading);
  return ahead > FIRE_CADET.TURNING_POINT_TO_FRONT && ahead <= FIRE_CADET.TURNING_POINT_TO_FRONT + FIRE_CADET.STICK_LENGTH && Math.abs(aside) < FIRE_CADET.STICK_GAP / 2;
}

/** Where a thing is, in a sentence: "on C5", or "off the map". */
const whereIs = (b: Pick<Body, 'x' | 'y'>): string => {
  const sq = squareAt(b.x, b.y);
  return sq === null ? 'off the map' : `on ${squareName(sq)}`;
};

/**
 * The field in words, for somebody who cannot see the stage (design 7.13):
 * "The robot is on D6 and looks up. Between its sticks: the Cat. On the map: the Water on A6, the
 * Injured Person on C5, the Equipment on C7. Obstacles on E3, F5 and F7. The Fire is at the School."
 * An item that has been delivered is no longer on the field (the referee took it off), and an
 * obstacle the referee has lifted is not on it until it is back.
 */
export function fieldInWords(world: { robot: { pose: Pose }; bodies: readonly Body[] }, scenario: Pick<FireCadetScenario, 'fire'>): string {
  const pose = world.robot.pose;
  const robotSquare = squareAt(pose.x, pose.y);
  const sentences: string[] = [
    `The robot is ${robotSquare === null ? 'off the map' : `on ${squareName(robotSquare)}`} and looks ${lookWord(pose.heading)}.`,
  ];
  const items = ITEM_NAMES.map((item) => ({ item, body: world.bodies.find((b) => b.id === itemId(item)) })).filter(
    (x): x is { item: ItemName; body: Body } => x.body !== undefined,
  );
  const held = items.filter((x) => betweenSticks(pose, x.body));
  if (held.length > 0) sentences.push(`Between its sticks: ${listWithAnd(held.map((x) => `the ${ITEM_WORDS[x.item]}`))}.`);
  const lying = items.filter((x) => !held.includes(x));
  sentences.push(
    lying.length === 0
      ? 'No other item is on the map.'
      : `On the map: ${lying.map((x) => `the ${ITEM_WORDS[x.item]} ${whereIs(x.body)}`).join(', ')}.`,
  );
  const obstacles = OBSTACLE_KINDS.map((kind) => world.bodies.find((b) => b.id === obstacleId(kind))).filter((b): b is Body => b !== undefined);
  const squares = obstacles.map((b) => whereIs(b).replace(/^on /, ''));
  if (squares.length === 1) sentences.push(`An obstacle on ${squares[0]}.`);
  else if (squares.length > 1) sentences.push(`Obstacles on ${listWithAnd(squares)}.`);
  sentences.push(`The Fire is at ${PLACE_WORDS[scenario.fire]}.`);
  return sentences.join(' ');
}

/** The name of an obstacle on the screen, without "the" ("Road Closed"). */
export const obstacleName = (kind: ObstacleKind): string => THING_WORDS[kind];

/** (for the tests: the names the referee uses for the obstacles, "the Road Closed sign" ...) */
export const REFEREE_OBSTACLE_WORDS = OBSTACLE_WORDS;

/** The square of the start, by its name ("D7"). */
export const START_SQUARE_NAME = squareName(START_SQUARE);

/** The marked place of a square's name, or null (for the editor's labels). */
export const PLACE_SQUARES = PLACES;
