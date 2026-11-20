/**
 * Fire Cadet: the two ways to drive the mTiny, as two interpreters of one game (design 4, N19).
 *
 *   Junior (ages 6-7): a ROW of coding cards laid after the yellow start card; the round button
 *   starts it and the robot runs it alone (rules l.138-146, ASSUMPTION A3).
 *       { "format": "mtiny-cards", "version": 1, "cards": ["forward", "x3", "left", ...], "field": "P1" }
 *   Mini (ages 4-5): the four arrow cards of the yellow DIRECTION PANEL; one tap is one whole move
 *   (rules l.130-136, ASSUMPTION A4).
 *       { "format": "mtiny-panel", "version": 1 }
 *
 * Both are plain program objects (core/types.ts: ProgramJson), so a row travels through the
 * examples door as it is. The game's interpreter (game.ts: Game.createVM) is createFireCadetVM.
 *
 * The cards: Forward, Backward (one square, 178 mm, without turning), Turn left, Turn right (90
 * degrees on the spot), and the number cards x2 ... x5: the ONE move card right before a number card
 * runs that many times in all. A number card must follow a move card, and a move card takes one
 * number card at most; the screen never builds another row (rowProblem), and readCards() makes any
 * program it is given into a row that keeps this rule.
 *
 * Every time is counted in whole ticks of the engine, the way the interpreter counts them, so the
 * time worked out for a row (rowSeconds) is exactly the time the engine takes, for any times in
 * the table (numbers.ts).
 *
 * Plain TypeScript, no DOM: it runs under Node too.
 */
import type { RobotIO } from '../core/io';
import { wheelDegreesForDistance, wheelDegreesForTurn } from '../core/robot';
import type { ButtonName, ProgramJson, RobotConfig, Scalar, VM } from '../core/types';
import { FIRE_CADET, ticks, type CardTimes } from './numbers';

// =============================================================================================
// The cards and the program format
// =============================================================================================

/** The four move cards (blue). On the direction panel they are the four arrow cards. */
export type MoveCard = 'forward' | 'backward' | 'left' | 'right';
/** The four number cards (yellow). */
export type NumberCard = 'x2' | 'x3' | 'x4' | 'x5';
/** The name of a card in a row (the start card is not in the row: it is always there). */
export type CardName = MoveCard | NumberCard;

export const MOVE_CARDS: readonly MoveCard[] = ['forward', 'backward', 'left', 'right'];
export const NUMBER_CARDS: readonly NumberCard[] = ['x2', 'x3', 'x4', 'x5'];
export const CARD_NAMES: readonly CardName[] = [...MOVE_CARDS, ...NUMBER_CARDS];

export const isMoveCard = (name: unknown): name is MoveCard => typeof name === 'string' && (MOVE_CARDS as readonly string[]).includes(name);
export const isNumberCard = (name: unknown): name is NumberCard =>
  typeof name === 'string' && (NUMBER_CARDS as readonly string[]).includes(name);

/** How many times in all a number card runs the move card before it: x3 -> 3. */
export const timesOf = (card: NumberCard): number => Number(card.slice(1));

export const CARDS_FORMAT = 'mtiny-cards';
export const PANEL_FORMAT = 'mtiny-panel';
export const PROGRAM_VERSION = 1;

/** A row of cards (Junior). */
export interface CardRowProgram extends ProgramJson {
  /** the screen writes it; the reader does not need it */
  format: typeof CARDS_FORMAT;
  version: typeof PROGRAM_VERSION;
  /** the cards in the order of the row, WITHOUT the start card */
  cards: CardName[];
  /**
   * the code of the map the row is made for ("P1" ... "P8", or an own setup's code). Only the
   * examples carry it (N14): the screen sets that map when it loads the row. The interpreter
   * ignores it.
   */
  field?: string;
}

/** The direction panel (Mini). */
export interface PanelProgram extends ProgramJson {
  format: typeof PANEL_FORMAT;
  version: typeof PROGRAM_VERSION;
}

/** A row as a program object. */
export function cardRowProgram(cards: readonly CardName[], field?: string): CardRowProgram {
  const program: CardRowProgram = { format: CARDS_FORMAT, version: PROGRAM_VERSION, cards: [...cards] };
  if (field !== undefined) program.field = field;
  return program;
}

/** The direction panel as a program object. */
export const panelProgram = (): PanelProgram => ({ format: PANEL_FORMAT, version: PROGRAM_VERSION });

/** Is this the direction panel's program (Mini)? Anything else is read as a row of cards. */
export const isPanelProgram = (program: unknown): boolean =>
  program !== null && typeof program === 'object' && (program as { format?: unknown }).format === PANEL_FORMAT;

// =============================================================================================
// The rule of the number cards, and the rows that are refused (design 4.3)
// =============================================================================================

/**
 * Why a row cannot be built (the screen refuses the edit and says why, A3):
 *   'number-first'  adding: a number card would stand right after the start card
 *   'number-twice'  a number card would stand right after a number card (its arrow has one already)
 *   'number-alone'  moving: a number card would be left without its arrow
 *   'full'          the row would have more than MAX_ROW_CARDS cards
 */
export type RowProblem = 'number-first' | 'number-twice' | 'number-alone' | 'full';

/** The words of each refusal (design 4.3), for the banner and the bubble over the card box. */
export const ROW_PROBLEM_WORDS: Readonly<Record<RowProblem, string>> = {
  'number-first': 'Put an arrow card first.',
  'number-twice': 'One number card for each arrow.',
  'number-alone': 'A number card comes after an arrow.',
  full: `The row is full: ${FIRE_CADET.MAX_ROW_CARDS} cards.`,
};

/**
 * The first problem of a row that the screen is about to build, or null when the row is valid.
 * A row is valid when every number card stands right after a move card and it has at most
 * MAX_ROW_CARDS cards. `edit` says how the row came about, which decides the words when a number
 * card would stand first: added there, the child must "Put an arrow card first."; moved there, "A
 * number card comes after an arrow."
 */
export function rowProblem(cards: readonly string[], edit: 'add' | 'move' = 'add'): RowProblem | null {
  if (cards.length > FIRE_CADET.MAX_ROW_CARDS) return 'full';
  for (let i = 0; i < cards.length; i++) {
    if (!isNumberCard(cards[i])) continue;
    if (i === 0) return edit === 'move' ? 'number-alone' : 'number-first';
    if (!isMoveCard(cards[i - 1])) return 'number-twice';
  }
  return null;
}

/**
 * The row of any program, made valid. It never throws. It keeps the card names it knows, drops a
 * number card that does not stand right after a move card, and cuts the row after MAX_ROW_CARDS
 * cards. {}, a block program, null, a panel program and junk give an empty row. ({} is what the
 * stage holds before a start.)
 */
export function readCards(program: unknown): CardName[] {
  if (program === null || typeof program !== 'object') return [];
  const list = (program as { cards?: unknown }).cards;
  if (!Array.isArray(list)) return [];
  const out: CardName[] = [];
  for (const name of list) {
    if (out.length >= FIRE_CADET.MAX_ROW_CARDS) break;
    if (isMoveCard(name)) out.push(name);
    else if (isNumberCard(name) && out.length > 0 && isMoveCard(out[out.length - 1])) out.push(name);
  }
  return out;
}

// =============================================================================================
// Moves and times (design 4.4)
// =============================================================================================

/** One move of a running row. */
export interface Step {
  move: MoveCard;
  /** the place of its move card in the row (0 = the first card after the start card) */
  card: number;
  /** the place of the number card behind it, or null */
  numberCard: number | null;
  /** which time this is (1 ... times) */
  nth: number;
  /** how many times the move card runs in all */
  times: number;
}

/** The moves of a row, one by one: a move card followed by xN gives N equal moves. (A number card without its move card is skipped.) */
export function expand(cards: readonly CardName[]): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!isMoveCard(card)) continue;
    const next = cards[i + 1];
    const numberCard = isNumberCard(next) ? i + 1 : null;
    const times = isNumberCard(next) ? timesOf(next) : 1;
    for (let nth = 1; nth <= times; nth++) steps.push({ move: card, card: i, numberCard, nth, times });
  }
  return steps;
}

const isDrive = (move: MoveCard): boolean => move === 'forward' || move === 'backward';

/** The ticks one move takes, rest not included: ticks(MOVE_SECONDS) or ticks(TURN_SECONDS). */
export const slotTicks = (move: MoveCard, times: CardTimes = FIRE_CADET, dt: number = FIRE_CADET.SIM_DT): number =>
  ticks(isDrive(move) ? times.MOVE_SECONDS : times.TURN_SECONDS, dt);

/**
 * How many ticks a row takes, from the round button to the end of its last move: the slot of every
 * move, and a rest between two moves (none after the last). This is how the interpreter counts, so
 * the engine ends the match at exactly this tick.
 */
export function rowTicks(cards: readonly CardName[], times: CardTimes = FIRE_CADET, dt: number = FIRE_CADET.SIM_DT): number {
  const steps = expand(cards);
  let sum = 0;
  for (const step of steps) sum += slotTicks(step.move, times, dt);
  return sum + Math.max(0, steps.length - 1) * ticks(times.REST_SECONDS, dt);
}

/**
 * The time of a row in seconds: rowTicks x SIM_DT (Forward 1.6 s; Forward x3 5.6 s; Forward, Turn
 * right, Forward 5.3 s). (Worked out as ticks / ticks per second, so that 5210 ticks give exactly
 * the number 52.1.)
 */
export const rowSeconds = (cards: readonly CardName[], times: CardTimes = FIRE_CADET, dt: number = FIRE_CADET.SIM_DT): number =>
  rowTicks(cards, times, dt) / ticks(1, dt);

// =============================================================================================
// Driving the robot
// =============================================================================================

/**
 * The wheel speed (RPM) at which speeding up, turning by 90 degrees and braking take exactly
 * TURN_SECONDS (a move gets the robot's top speed, maxRpm: robot.ts works it out so that a move
 * takes MOVE_SECONDS). Each wheel travels s = (pi / 2) x (track / 2) mm, speeds up and brakes with
 * a = rpmPerSecond / 60 x pi x wheel diameter (mm/s2), so T = s / v + v / a and
 * v = (a T - sqrt(a2 T2 - 4 a s)) / 2: 47.4 mm/s = 22.6 RPM with the sizes of the table. (If the
 * time is too short for that, the wheels speed up and brake without cruising, as fast as they can.)
 */
export function turnRpm(config: RobotConfig, times: CardTimes = FIRE_CADET): number {
  const s = (Math.PI / 2) * (config.trackWidth / 2);
  const a = (config.rpmPerSecond / 60) * Math.PI * config.wheelDiameter;
  const T = times.TURN_SECONDS;
  const disc = a * a * T * T - 4 * a * s;
  const v = disc > 0 ? (a * T - Math.sqrt(disc)) / 2 : Math.sqrt(a * s);
  return Math.min(config.maxRpm, (v / (Math.PI * config.wheelDiameter)) * 60);
}

/** Start one move: one square ahead or back (STEP), or a quarter turn on the spot (TURN). */
function startMove(io: RobotIO, move: MoveCard, times: CardTimes): void {
  const cfg = io.config;
  if (isDrive(move)) {
    const deg = wheelDegreesForDistance(cfg, FIRE_CADET.STEP) * (move === 'forward' ? 1 : -1);
    io.startMotion(deg, deg, cfg.maxRpm);
  } else {
    const deg = wheelDegreesForTurn(cfg, FIRE_CADET.TURN) * (move === 'right' ? 1 : -1);
    io.startMotion(deg, -deg, turnRpm(cfg, times));
  }
}

/**
 * The interpreter of a row of cards (Junior). It talks to the robot through RobotIO only.
 *
 * Each move gets its slot (MOVE_SECONDS or TURN_SECONDS, in ticks): the motion ends inside it (a
 * move after 157 or 158 ticks, a turn after 127), and the next move begins REST_SECONDS after the
 * end of the slot. After the last move there is no rest: the row is done, the interpreter is idle,
 * and the engine ends the match at that tick ('program-ended'). A move that the robot cannot
 * finish (pressed against the edge of the table) runs out on time with spinning wheels, and the
 * next card starts from where the robot stands.
 *
 * activeBlockIds(): 'card-<place in the row>' of the running move card, and of its number card.
 * variables(): move (1 ...), moves (of the row), nth and times (which time of how many).
 */
export function createCardVM(program: ProgramJson, io: RobotIO, times: CardTimes = FIRE_CADET): VM {
  const steps = expand(readCards(program));
  const rest = ticks(times.REST_SECONDS, io.dt);
  let running = false;
  let tick = 0;
  let at = 0;
  let stepStart = 0;
  const begin = (i: number): void => {
    at = i;
    stepStart = tick;
    startMove(io, steps[i].move, times);
  };
  return {
    start() {
      running = steps.length > 0;
      tick = 0;
      if (running) begin(0);
    },
    step() {
      if (!running) return;
      tick++;
      const since = tick - stepStart;
      const slot = slotTicks(steps[at].move, times, io.dt);
      if (since >= slot && io.motionDone()) {
        if (at === steps.length - 1) running = false; // the row is done: no rest after the last card
        else if (since >= slot + rest) begin(at + 1);
      }
    },
    stopAll() {
      running = false;
    },
    get running() {
      return running;
    },
    get idle() {
      return !running;
    },
    activeBlockIds() {
      if (!running) return [];
      const step = steps[at];
      return step.numberCard === null ? [`card-${step.card}`] : [`card-${step.card}`, `card-${step.numberCard}`];
    },
    variables(): Record<string, Scalar> {
      if (!running) return {};
      const step = steps[at];
      return { move: at + 1, moves: steps.length, nth: step.nth, times: step.times };
    },
    errors() {
      return [];
    },
  };
}

/** The four arrow cards of the panel are the engine's buttons (core/types.ts: ButtonName). */
export const PANEL_BUTTONS: Readonly<Record<MoveCard, ButtonName>> = { forward: 'up', backward: 'down', left: 'left', right: 'right' };

/**
 * The interpreter of the direction panel (Mini). One tap is one whole move (the change of a button
 * from up to down; holding it does nothing more). A tap while the robot moves, or rests after a
 * move, is kept and runs after the rest - one only, the newest (ASSUMPTION N7: chosen for comfort;
 * a real pen most likely ignores such a tap or keeps them all - question 2 to the organiser). The
 * panel never ends the match by itself: it ends at 120 s or at STOP.
 *
 * activeBlockIds(): 'panel-<move>' of the running move, and 'panel-next-<move>' of a kept tap.
 * variables(): moves (begun so far).
 */
export function createPanelVM(_program: ProgramJson, io: RobotIO, times: CardTimes = FIRE_CADET): VM {
  const wasDown: Record<MoveCard, boolean> = { forward: false, backward: false, left: false, right: false };
  let running = false;
  let tick = 0;
  let busyUntil = 0;
  let waiting: MoveCard | null = null;
  let current: MoveCard | null = null;
  let moves = 0;
  return {
    start() {
      running = true;
      tick = 0;
      busyUntil = 0;
      waiting = null;
      current = null;
      moves = 0;
      for (const move of MOVE_CARDS) wasDown[move] = io.buttonDown(PANEL_BUTTONS[move]);
    },
    step() {
      if (!running) return;
      tick++;
      for (const move of MOVE_CARDS) {
        const down = io.buttonDown(PANEL_BUTTONS[move]);
        if (down && !wasDown[move]) waiting = move; // a new tap; the newest one wins
        wasDown[move] = down;
      }
      if (tick >= busyUntil && io.motionDone()) {
        current = null;
        if (waiting !== null) {
          current = waiting;
          waiting = null;
          moves++;
          startMove(io, current, times);
          busyUntil = tick + slotTicks(current, times, io.dt) + ticks(times.REST_SECONDS, io.dt);
        }
      }
    },
    stopAll() {
      running = false;
    },
    get running() {
      return running;
    },
    get idle() {
      return false;
    },
    activeBlockIds() {
      const ids: string[] = [];
      if (current !== null) ids.push(`panel-${current}`);
      if (waiting !== null) ids.push(`panel-next-${waiting}`);
      return ids;
    },
    variables() {
      return { moves };
    },
    errors() {
      return [];
    },
  };
}

/** The game's interpreter (Game.createVM): the panel for a panel program, a row of cards for anything else. */
export function createFireCadetVM(program: ProgramJson, io: RobotIO): VM {
  return isPanelProgram(program) ? createPanelVM(program, io) : createCardVM(program, io);
}

// =============================================================================================
// The short notation of a row (tests, examples, README)
// =============================================================================================

const LETTER_OF: Readonly<Record<MoveCard, string>> = { forward: 'F', backward: 'B', left: 'L', right: 'R' };
const MOVE_OF: Readonly<Record<string, MoveCard>> = { F: 'forward', B: 'backward', L: 'left', R: 'right' };

/**
 * A row from the short notation of the design: F Forward, B Backward, L Turn left, R Turn right,
 * and a digit after a letter for the number card behind it - "F3 B L" = Forward, x3, Backward,
 * Turn left. Throws on anything else (it is for tests and examples, not for children).
 */
export function cardsFromText(text: string): CardName[] {
  const out: CardName[] = [];
  for (const ch of text.replace(/\s+/g, '').toUpperCase()) {
    if (MOVE_OF[ch]) out.push(MOVE_OF[ch]);
    else if ('2345'.includes(ch)) out.push(`x${ch}` as NumberCard);
    else throw new Error(`"${ch}" is not a card of the short notation (F, B, L, R, 2 to 5)`);
  }
  return out;
}

/** The short notation of a row: "F3 B L". */
export function cardsToText(cards: readonly CardName[]): string {
  const words: string[] = [];
  for (const card of cards) {
    if (isNumberCard(card) && words.length > 0) words[words.length - 1] += card.slice(1);
    else words.push(isMoveCard(card) ? LETTER_OF[card] : card);
  }
  return words.join(' ');
}
