/**
 * Helpers for the tests of Fire Cadet (not used by the game or its screen).
 *
 *   ownSetups(n, seed)          random own setups under the rules of design 5.4, drawn exactly as the
 *                               design's survey drew them (P/rev2/survey-rev2.mts), so that seed 2027
 *                               gives the same 3,000 setups the design measured
 *   parkedMap(part)             a map for single experiments: everything parked far from the action
 *   watchMatch(...)             a whole match tick by tick, with what the referee said, when each
 *                               element left the field and came back, and where the robot stopped
 *   withSizes(sizes)            the game with other bases for some items and obstacles (what would
 *                               change if the organiser sent other sizes), for watchMatch
 */
import { createSimulation } from '../core/simulation';
import type { Body, Game, Pose, ProgramJson, Simulation } from '../core/types';
import { PLACES, WATER_SQUARES, sameSquare } from './field';
import { createBodies, fireCadetGame } from './game';
import { FIRE_CADET, type Square } from './numbers';
import { FIRE_PLACES, parseSquare, targetSquare, type FireCadetScenario } from './scenario';

/** "D5" -> its square (throws on a bad name: tests only). */
export function sq(name: string): Square {
  const square = parseSquare(name);
  if (square === null) throw new Error(`${name} is not a square`);
  return square;
}

/**
 * A map for single experiments: the Fire at the Factory, the items in the bottom right corner and
 * the obstacles at the top, far from where the tests drive. (Not always a map a child could make:
 * it is for looking at one thing at a time.)
 */
export function parkedMap(part: Partial<FireCadetScenario> = {}): FireCadetScenario {
  return {
    fire: 'factory',
    water: sq('B7'),
    cat: sq('G6'),
    person: sq('F7'),
    equipment: sq('F6'),
    obstacles: [sq('B1'), sq('C1'), sq('E1')],
    ...part,
  };
}

/** The random numbers of the design's survey (a linear congruential generator). */
export function surveyRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const DASHED = new Set(Object.values(PLACES).map((p) => p.col * 7 + p.row));

/**
 * `n` random own setups under the rules of design 5.4, drawn as the design's survey drew them: the
 * Fire, the Water square, then the Cat, the Injured Person, the Equipment (any free square; a
 * marked place too, but not D7 and not its own target) and the three obstacles (any free square
 * without a dashed frame), each by trying random squares until one may be used.
 */
export function ownSetups(n: number, seed = 2027): FireCadetScenario[] {
  const rng = surveyRng(seed);
  const out: FireCadetScenario[] = [];
  for (let i = 0; i < n; i++) {
    const fire = FIRE_PLACES[Math.floor(rng() * 4)];
    const water = WATER_SQUARES[Math.floor(rng() * 4)];
    const used = new Set<number>([water.col * 7 + water.row]);
    const pick = (who: 'cat' | 'person' | 'equipment' | 'obstacle'): Square => {
      for (;;) {
        const col = Math.floor(rng() * 7);
        const row = Math.floor(rng() * 7);
        const k = col * 7 + row;
        if (used.has(k)) continue;
        if (DASHED.has(k)) {
          if (who === 'obstacle') continue;
          const here = { col, row };
          if (sameSquare(here, PLACES.station) || sameSquare(here, targetSquare({ fire }, who))) continue;
        }
        used.add(k);
        return { col, row };
      }
    };
    const cat = pick('cat');
    const person = pick('person');
    const equipment = pick('equipment');
    out.push({ fire, water, cat, person, equipment, obstacles: [pick('obstacle'), pick('obstacle'), pick('obstacle')] });
  }
  return out;
}

/** Does any of the three movable items stand on a marked place? */
export const itemOnMarkedPlace = (s: FireCadetScenario): boolean => [s.cat, s.person, s.equipment].some((x) => DASHED.has(x.col * 7 + x.row));

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export interface WatchedMatch {
  sim: Simulation<FireCadetScenario>;
  /** every sentence of the log: [time, text] */
  said: [number, string][];
  /** [time, element id] when an element left the field */
  gone: [number, string][];
  /** [time, element id, x, y, angle] when an element came back onto the field */
  back: [number, string, number, number, number][];
  /** where the robot stood each time it came to rest after moving: [x, y, heading in degrees] (0.001 mm) */
  stops: [number, number, number][];
  /** the robot, or an element, met the edge of the table (TABLE_MARGIN outside the mat) at some tick */
  tableEdge: boolean;
}

/**
 * The game with other bases (mm across, square) for the elements named: `{ 'item:person': 26 }`.
 * Everything else - the robot, its sticks, the referee - stays as it is. (The engine and the
 * referee read the size of a body from the body itself; for the sizes game.test.ts uses, this gave
 * the same sentences at the same times as the same base written in numbers.ts.)
 */
export function withSizes(sizes: Readonly<Record<string, number>>): Game<FireCadetScenario> {
  return {
    ...fireCadetGame,
    createBodies: (s) => createBodies(s).map((b) => (sizes[b.id] === undefined ? b : { ...b, w: sizes[b.id], l: sizes[b.id] })),
  };
}

/** Play a whole match tick by tick and watch it (Junior; for the panel, drive the simulation yourself). */
export function watchMatch(
  program: ProgramJson,
  scenario: FireCadetScenario,
  options: {
    startPose?: Pose;
    onTick?: (sim: Simulation<FireCadetScenario>) => void;
    maxSeconds?: number;
    /** another game than Fire Cadet as it is (withSizes) */
    game?: Game<FireCadetScenario>;
  } = {},
): WatchedMatch {
  const sim = createSimulation({ game: options.game ?? fireCadetGame, scenario, program, startPose: options.startPose });
  sim.start();
  const watched: WatchedMatch = { sim, said: [], gone: [], back: [], stops: [], tableEdge: false };
  const edge = FIRE_CADET.MAT + FIRE_CADET.TABLE_MARGIN - 0.01;
  const low = -FIRE_CADET.TABLE_MARGIN + 0.01;
  let present = new Map<string, Body>(sim.world.bodies.map((b) => [b.id, b]));
  let moving = false;
  const limit = options.maxSeconds ?? Infinity;
  while (sim.status === 'running') {
    if (sim.world.time >= limit - 1e-9) {
      sim.declareFinished();
      break;
    }
    sim.step(1);
    const w = sim.world;
    for (const e of sim.drainEvents()) {
      if (e.type === 'log') watched.said.push([r3(e.time), e.text]);
      if (e.type === 'bump' && e.bodyId === 'wall') watched.tableEdge = true;
    }
    for (const b of w.bodies) {
      const ex = (Math.abs(b.w * Math.cos(b.angle)) + Math.abs(b.l * Math.sin(b.angle))) / 2;
      const ey = (Math.abs(b.w * Math.sin(b.angle)) + Math.abs(b.l * Math.cos(b.angle))) / 2;
      if (b.x - ex < low || b.x + ex > edge || b.y - ey < low || b.y + ey > edge) watched.tableEdge = true;
    }
    const now = new Map<string, Body>(w.bodies.map((b) => [b.id, b]));
    for (const id of present.keys()) if (!now.has(id)) watched.gone.push([r3(w.time), id]);
    for (const [id, b] of now) if (!present.has(id)) watched.back.push([r3(w.time), id, b.x, b.y, b.angle]);
    present = now;
    const nowMoving = w.robot.left.rpm !== 0 || w.robot.right.rpm !== 0;
    if (moving && !nowMoving) {
      const p = w.robot.pose;
      watched.stops.push([r3(p.x), r3(p.y), r3((p.heading * 180) / Math.PI)]);
    }
    moving = nowMoving;
    options.onTick?.(sim);
  }
  return watched;
}
