/**
 * Fire Cadet: does a row of cards exist that scores all 25 points inside the 120 s of a match?
 * The own-map editor asks this at every change (design 5.4, 7.8, ASSUMPTION N18); the tests use it
 * to prove the practice maps (design 5.3).
 *
 * It finds the SHORTEST row (in time) on a square-by-square model of the game, the one the engine
 * probes of the design proved and practice.test.ts / solver.test.ts prove again in the engine:
 *   - The robot stands on the spot of a square, looking up, right, down or left. A Forward or
 *     Backward card takes it to the next square, a Turn card turns it on the spot.
 *   - Forward into the square of an item: the item is now between the sticks. An item between the
 *     sticks goes along on Forward and on a turn. Forward INTO the item's target square delivers it
 *     (the referee takes it off the field).
 *   - The robot never enters a square with an obstacle, never leaves the map, never drives into a
 *     second item while it carries one, never drives backward with an item between its sticks (it
 *     would leave the item) and never backward into an item.
 * It is Dijkstra's shortest path over (square, direction, the item between the sticks, the items
 * delivered): 49 x 4 x 5 x 16 = 15,680 states, a few milliseconds. Times are counted in ticks the
 * way the interpreter counts them (cards.ts), so its time is the time of the match.
 *
 * Because it never backs away from an item, "no row found" means "none without leaving an item
 * behind somewhere". The screen says "found", never "possible".
 *
 * Plain TypeScript, no DOM: it runs in the browser (the editor) and under Node.
 */
import { type CardName, type MoveCard, rowSeconds, rowTicks } from './cards';
import { PLACES, START_SQUARE } from './field';
import { FIRE_CADET, ticks, type CardTimes, type Square } from './numbers';
import { ITEM_NAMES, targetSquare, type FireCadetScenario, type ItemName } from './scenario';

/** A row the solver found. */
export interface SolvedRow {
  /** the moves, one by one */
  moves: MoveCard[];
  /** the same moves as a row of cards: runs of 2 to 5 equal moves become "move, xN" */
  cards: CardName[];
  /** ticks from the round button to the end of the last move (cards.ts: rowTicks) */
  ticks: number;
  /** the same in seconds */
  seconds: number;
  /** the items in the order they are delivered */
  order: ItemName[];
}

export interface SolveOptions {
  /** another set of card times (default: FIRE_CADET's) */
  times?: CardTimes;
  /** false = the robot need not end in the Fire Station (default: it must, for the return bonus) */
  mustReturn?: boolean;
}

const N = FIRE_CADET.GRID_COUNT;
/** up, right, down, left: the four directions, heading 0 to 3 (clockwise, as headings grow) */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const MOVE_CODES: readonly MoveCard[] = ['forward', 'backward', 'left', 'right'];
const ITEM_COUNT = ITEM_NAMES.length;
const ALL_DONE = (1 << ITEM_COUNT) - 1;

const cellOf = (sq: Square): number => sq.col * N + sq.row;

/**
 * The cards for a list of moves: a run of equal moves becomes the move card and a number card,
 * five at most each time (6 Forward = Forward, x5, Forward: three cards).
 */
export function compressMoves(moves: readonly MoveCard[]): CardName[] {
  const out: CardName[] = [];
  let i = 0;
  while (i < moves.length) {
    let run = 1;
    while (i + run < moves.length && moves[i + run] === moves[i]) run++;
    for (let left = run; left > 0; ) {
      const take = Math.min(5, left);
      out.push(moves[i]);
      if (take > 1) out.push(`x${take}` as CardName);
      left -= take;
    }
    i += run;
  }
  return out;
}

/**
 * A binary heap of states ordered by cost, for Dijkstra. (Typed arrays and no object per entry:
 * the editor asks at every tap and the tests ask thousands of times.)
 */
class Heap {
  private cost = new Float64Array(1024);
  private state = new Int32Array(1024);
  size = 0;
  push(c: number, s: number): void {
    if (this.size === this.cost.length) {
      const cost = new Float64Array(this.size * 2);
      const state = new Int32Array(this.size * 2);
      cost.set(this.cost);
      state.set(this.state);
      this.cost = cost;
      this.state = state;
    }
    const cost = this.cost;
    const state = this.state;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (cost[p] <= c) break;
      cost[i] = cost[p];
      state[i] = state[p];
      i = p;
    }
    cost[i] = c;
    state[i] = s;
  }
  /** the cost of the cheapest state (pop() removes it and returns the state) */
  topCost(): number {
    return this.cost[0];
  }
  pop(): number {
    const cost = this.cost;
    const state = this.state;
    const top = state[0];
    const n = --this.size;
    const c = cost[n];
    const s = state[n];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1;
      const m = r < n && cost[r] < cost[l] ? r : l;
      if (cost[m] >= c) break;
      cost[i] = cost[m];
      state[i] = state[m];
      i = m;
    }
    cost[i] = c;
    state[i] = s;
    return top;
  }
}

/** The shortest row that delivers all four items and ends in the Fire Station, or null when the model finds none. */
export function solve(s: FireCadetScenario, options: SolveOptions = {}): SolvedRow | null {
  const times = options.times ?? FIRE_CADET;
  const rest = ticks(times.REST_SECONDS);
  const costMove = ticks(times.MOVE_SECONDS) + rest;
  const costTurn = ticks(times.TURN_SECONDS) + rest;
  // what stands on each square at the start: -2 an obstacle, k an item, -1 nothing
  const there = new Int8Array(N * N).fill(-1);
  for (const o of s.obstacles) if (o.col >= 0 && o.col < N && o.row >= 0 && o.row < N) there[cellOf(o)] = -2;
  ITEM_NAMES.forEach((item, k) => {
    there[cellOf(s[item])] = k;
  });
  const target = ITEM_NAMES.map((item) => cellOf(targetSquare(s, item)));
  const home = cellOf(PLACES.station);
  const mustReturn = options.mustReturn !== false;

  // state = ((cell x 4 + direction) x 5 + carried item (0 = none, k + 1)) x 16 + delivered (a bit per item)
  const CARRY = ITEM_COUNT + 1;
  const DONE = ALL_DONE + 1;
  const stateCount = N * N * 4 * CARRY * DONE;
  const key = (cell: number, dir: number, carry: number, done: number): number => ((cell * 4 + dir) * CARRY + carry) * DONE + done;
  const dist = new Float64Array(stateCount).fill(Infinity);
  const prev = new Int32Array(stateCount).fill(-1);
  const how = new Uint8Array(stateCount);
  const heap = new Heap();
  const start = key(cellOf(START_SQUARE), 0, 0, 0);
  dist[start] = 0;
  heap.push(0, start);
  let goal = -1;
  while (heap.size > 0) {
    const d = heap.topCost();
    const k = heap.pop();
    if (d > dist[k]) continue;
    const done = k % DONE;
    const carry = Math.floor(k / DONE) % CARRY;
    const dir = Math.floor(k / (DONE * CARRY)) % 4;
    const cell = Math.floor(k / (DONE * CARRY * 4));
    if (done === ALL_DONE && (!mustReturn || cell === home)) {
      goal = k;
      break;
    }
    const col = Math.floor(cell / N);
    const row = cell % N;
    // the four moves: [next state, cost, move code] (-1 = not allowed)
    for (let move = 0; move < 4; move++) {
      let next = -1;
      if (move === 2) next = key(cell, (dir + 3) % 4, carry, done); // Turn left: what is between the sticks goes along
      else if (move === 3) next = key(cell, (dir + 1) % 4, carry, done); // Turn right
      else {
        const sign = move === 0 ? 1 : -1;
        const c = col + sign * DIRECTIONS[dir][0];
        const r = row + sign * DIRECTIONS[dir][1];
        if (c < 0 || c >= N || r < 0 || r >= N) continue; // never off the map
        const n = c * N + r;
        const what = there[n];
        if (what === -2) continue; // never into an obstacle
        // an item still standing there: not delivered, and not the one between the sticks
        const loose = what >= 0 && (done & (1 << what)) === 0 && carry !== what + 1;
        if (move === 0) {
          // Forward
          if (carry === 0) next = key(n, dir, loose ? what + 1 : 0, done);
          else if (!loose) {
            const item = carry - 1;
            next = n === target[item] ? key(n, dir, 0, done | (1 << item)) : key(n, dir, carry, done);
          }
        } else if (carry === 0 && !loose) {
          // Backward: never with an item between the sticks, never into an item
          next = key(n, dir, 0, done);
        }
      }
      if (next < 0) continue;
      const nd = d + (move < 2 ? costMove : costTurn);
      if (nd < dist[next]) {
        dist[next] = nd;
        prev[next] = k;
        how[next] = move;
        heap.push(nd, next);
      }
    }
  }
  if (goal < 0) return null;

  const moves: MoveCard[] = [];
  const order: ItemName[] = [];
  for (let k = goal; prev[k] >= 0; k = prev[k]) {
    moves.push(MOVE_CODES[how[k]]);
    const doneNow = k % DONE;
    const doneBefore = prev[k] % DONE;
    if (doneNow !== doneBefore) order.push(ITEM_NAMES[Math.log2(doneNow ^ doneBefore)]);
  }
  moves.reverse();
  order.reverse();
  const cards = compressMoves(moves);
  return { moves, cards, ticks: rowTicks(cards, times), seconds: rowSeconds(cards, times), order };
}

/** What the own-map editor says (N18): the shortest row found for all 25 points, if it fits in the match. */
export type SolverVerdict = { found: true; moves: number; seconds: number } | { found: false };

/** Does this simulator find a row for all 25 points inside MATCH_SECONDS? (The row itself is never shown: D2.) */
export function findRowForAllPoints(s: FireCadetScenario): SolverVerdict {
  const row = solve(s);
  if (row === null || row.ticks > ticks(FIRE_CADET.MATCH_SECONDS)) return { found: false };
  return { found: true, moves: row.moves.length, seconds: row.seconds };
}
