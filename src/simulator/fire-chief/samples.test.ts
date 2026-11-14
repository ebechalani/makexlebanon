/**
 * The example programs of Fire Chief (samples.ts), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine (walls, sensors)  ->  Fire Chief referee
 *
 * Every example is played on the default maze, on the five named mazes with the fire at each of
 * its six places, and on 300 random mazes (seeds 1 to 300 of the game's own generator: both
 * rooms, all three places of the fire, 4 to 16 walls), and each test asserts what the
 * description of that example promises - no more, no less. What an example should do in a maze
 * is worked out here a second time, on squared paper so to say (which sides of a cell are open,
 * where the fire stands), without the engine: the two must agree.
 *
 * A hand on the wall nearly always finds the room on its own side first (the right hand the
 * bedroom, the left hand the living room). So the two examples that stop in the first room are
 * also played on 60 more random mazes each, picked because the hand leads to the OTHER room
 * there: both rooms and all three places of the fire are then seen from the inside.
 *
 * The full mission is also played on the mazes it finds hardest: mazes with one way only
 * ("perfect" mazes), mazes that no generator of the game would draw, and the slowest kind of
 * maze there is.
 *
 * The robot finds the fire with its ultrasonic sensor and makes sure with its colour sensor,
 * which reads "red" on the target from 1.5 cm or less. No example holds a flame sensor block:
 * a test here says so. (The big measurement - the full mission on many thousand mazes - is not
 * part of this suite; samples.ts gives its numbers above the full mission.)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { BUILTIN_BLOCK_TYPES } from '../blocks/catalog';
import { createEditor, type BlocklyApi } from '../blocks/register';
import { paletteBlockTypes } from '../blocks/toolbox';
import { runMatch } from '../core/batch';
import { DEG, makeRng, wrapAngle } from '../core/geometry';
import { RasterMatSampler } from '../core/mat';
import { createSimulation } from '../core/simulation';
import type { BlockJson, Game, MatSampler, ProgramJson, RGB, ScoreLine, SimEvent, Simulation } from '../core/types';
import { SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { supportsBlock } from '../vm';
import { changeVar, forever, move, probeDetects, program, script, setVar, waitUntil, whenStart } from '../vm/builder';
import {
  FIELD_SIZE,
  FIRE_SPOTS,
  MAT_VECTOR,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  TARGET_DEPTH,
  TARGET_WIDTH,
  cellAt,
  cellCenter,
  cellName,
  isCell,
  sameCell,
  type Cell,
  type FireSpot,
  type RoomId,
} from './field';
import { MATCH_DURATION, fireChiefGame, hasLeftStart, roomAround, targetOf, targetShift } from './game';
import { COLOR_SENSOR_RANGE_MM, FAN, FIRE_CHIEF_ROBOT, START_POSE } from './robot';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import {
  AFTER_LINE_CM,
  APPROACH_RPM,
  APPROACH_SECONDS,
  CORNER_PLACE_CM,
  FAN_SECONDS,
  FIRST_APPROACH_SECONDS,
  FIRST_WALL_STOP_CM,
  LINE_COUNTER_CELLS,
  LINE_COUNTER_RPM,
  OPEN_WAY_CM,
  SAMPLE_PROGRAMS,
  WALL_NEAR_CM,
  WALL_PLACE_CM,
  getSampleProgram,
  type SampleProgram,
} from './samples';
import {
  NAMED_MAZES,
  PERFECT_MAZE_WALLS,
  decodeScenario,
  defaultScenario,
  encodeScenario,
  isValidScenario,
  openField,
  perfectMazeWalls,
  randomScenario,
  wallBetweenCells,
  wallCount,
  withFire,
  type FireChiefScenario,
} from './scenario';

type Sim = Simulation<FireChiefScenario>;

// =============================================================================================
// The mazes
// =============================================================================================

const RANDOM_MAZES = 300;

/** The 300 random mazes every example is played on: seeds 1 to 300 of the game's own generator. */
const RANDOM: FireChiefScenario[] = Array.from({ length: RANDOM_MAZES }, (_, i) => randomScenario(makeRng(i + 1)));

/** The six places where the fire can stand: three in each room. */
const PLACES: Array<{ room: RoomId; spot: FireSpot }> = ROOM_IDS.flatMap((room) => FIRE_SPOTS.map((spot) => ({ room, spot })));

/** The default maze and the five named ones, the fire where each of them has it. */
const NAMED: FireChiefScenario[] = [defaultScenario(), ...NAMED_MAZES.map((maze) => maze.scenario)];

/** The five named mazes with the fire at each of its six places: 30 combinations. The default maze is one of them. */
const NAMED_PLACES: FireChiefScenario[] = NAMED_MAZES.flatMap((maze) => PLACES.map(({ room, spot }) => withFire(maze.scenario, room, spot)));

/** The mazes every example is played on: the named mazes with the fire at every place, and the random ones - 30 + 300. */
const ALL_MAZES: FireChiefScenario[] = [...NAMED_PLACES, ...RANDOM];

/** The open field: the maze without inner walls. */
const OPEN_FIELD = NAMED_MAZES.find((maze) => maze.id === 'open')!;

/** Mazes with one way only (16 walls), the fire once in each room: the longest ways along the wall. */
const PERFECT: FireChiefScenario[] = Array.from({ length: 60 }, (_, i) => perfectMazeWalls(makeRng(100_001 + i))).flatMap((walls, i) =>
  ROOM_IDS.map((fireRoom): FireChiefScenario => ({ walls: [...walls], fireRoom, fireSpot: FIRE_SPOTS[i % FIRE_SPOTS.length] })),
);

/**
 * Mazes the game's generator never draws: every wall is there or not by the throw of a coin
 * (a different coin for each maze), and the maze is kept when it can be played. They have
 * closed-off cells, loose walls in the middle of the field, and up to 25 walls.
 */
const ODD: FireChiefScenario[] = (() => {
  const out: FireChiefScenario[] = [];
  const rng = makeRng(2027);
  while (out.length < 120) {
    const share = 0.15 + 0.5 * rng();
    const walls = Array.from({ length: 40 }, () => rng() < share);
    const scenario: FireChiefScenario = {
      walls,
      fireRoom: ROOM_IDS[out.length % 2],
      fireSpot: FIRE_SPOTS[out.length % 3],
    };
    if (isValidScenario(scenario)) out.push(scenario);
  }
  return out;
})();

/**
 * The slowest kind of maze for the full mission: one way only, the fire in the bedroom, and the
 * left hand leads through all the rest of the field first - 42 cells and 84 quarter turns.
 * No maze should need more cells: a hand on the wall drives through at most 48 openings before
 * it is back where it began (a maze with one way only has exactly 48), and from the fire room
 * back to START it needs at least 6 of them. A search through 400 000 mazes of four kinds (the
 * fire once in each room), and a search that changed mazes wall by wall to make them slower,
 * found none that needs more - and in none of them did the hand fail to reach the fire room.
 */
const SLOWEST_MAZE = 'BC-KQDM-42C0';

// =============================================================================================
// On squared paper: what the hand on the wall does, without the engine
// =============================================================================================

/** One cell further in direction 0 = up, 1 = right, 2 = down, 3 = left. */
const STEPS: ReadonlyArray<{ col: number; row: number }> = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

const next = (cell: Cell, dir: number): Cell => ({ col: cell.col + STEPS[dir].col, row: cell.row + STEPS[dir].row });

/** Can the robot drive from `cell` one cell in direction `dir`? (Not through a wall, not off the field.) */
const isOpen = (s: FireChiefScenario, cell: Cell, dir: number): boolean => isCell(next(cell, dir)) && !wallBetweenCells(s.walls, cell, next(cell, dir));

const roomOf = (cell: Cell): RoomId | null => ROOM_IDS.find((id) => sameCell(ROOMS[id].cell, cell)) ?? null;

/** The first free way out of START when turning right from "up": the direction the two first examples drive off in. */
function freeWayOutOfStart(s: FireChiefScenario): number {
  const dir = [0, 1, 2, 3].find((d) => isOpen(s, START_CELL, d));
  assert.ok(dir !== undefined, 'START is open on one side');
  return dir;
}

/** A cell on the way of the robot, and the way it faced when it drove into it (0 = up, 1 = right, 2 = down, 3 = left). */
interface Step extends Cell {
  dir: number;
}

/** Where a robot with a hand on the wall is after each cell it has driven, from START to the first room. */
function handOnTheWall(s: FireChiefScenario, hand: 'left' | 'right', until: (cell: Cell) => boolean = (cell) => roomOf(cell) !== null): Step[] {
  const towards = hand === 'left' ? 3 : 1;
  const away = hand === 'left' ? 1 : 3;
  let cell: Cell = { ...START_CELL };
  let dir = 0;
  const way: Step[] = [];
  while (way.length < 200) {
    dir = (dir + towards) % 4;
    for (let look = 0; look < 3 && !isOpen(s, cell, dir); look++) dir = (dir + away) % 4;
    cell = next(cell, dir);
    way.push({ ...cell, dir });
    if (until(cell)) return way;
  }
  throw new Error('the hand on the wall never arrives');
}

const lastOf = <T>(list: readonly T[]): T => list[list.length - 1];

/**
 * "look for the fire" on paper. A robot that comes into a room facing `dir` looks straight
 * ahead first (a wall), then into the outer corner, then at the other wall. Which way it turns
 * for that ("swing": 1 = to the right, -1 = to the left), at which of the three looks it finds
 * the fire at `spot`, and the way it faces then (degrees, 0 = up, clockwise positive).
 */
function lookOnPaper(room: RoomId, dir: number, spot: FireSpot): { swing: number; looks: number; heading: number } {
  // the two walls with a place: the back wall is up (0), the side wall is to the left (living room) or to the right (bedroom)
  const side = room === 'living' ? 3 : 1;
  assert.ok(dir === 0 || dir === side, `a robot comes into the ${room} facing up or facing its side wall, not ${dir}`);
  const outwards = room === 'living' ? -1 : 1;
  const swing = dir === 0 ? outwards : -outwards;
  const ahead: FireSpot = dir === 0 ? 'back' : 'side';
  const looks = spot === ahead ? 1 : spot === 'corner' ? 2 : 3;
  const heading = spot === 'back' ? 0 : spot === 'side' ? outwards * 90 : outwards * 45;
  return { swing, looks, heading };
}

/**
 * More random mazes (seeds 301, 302, ... of the game's generator), kept when the hand on the
 * wall leads to `room` first: 12 with the fire in that room at each of its three spots, and 24
 * with the fire in the other room - 60 mazes. (Such mazes are rare: about 3 in 100.)
 */
function mazesWhereTheHandFinds(hand: 'left' | 'right', room: RoomId): FireChiefScenario[] {
  const wanted: Record<string, number> = { corner: 12, back: 12, side: 12, elsewhere: 24 };
  const out: FireChiefScenario[] = [];
  for (let seed = RANDOM_MAZES + 1; out.length < 60; seed++) {
    assert.ok(seed < 100_000, 'enough mazes are found long before');
    const s = randomScenario(makeRng(seed));
    if (roomOf(lastOf(handOnTheWall(s, hand))) !== room) continue;
    const kind = s.fireRoom === room ? s.fireSpot : 'elsewhere';
    if (wanted[kind] === 0) continue;
    wanted[kind]--;
    out.push(s);
  }
  return out;
}

// =============================================================================================
// Playing an example
// =============================================================================================

interface Played {
  sim: Sim;
  events: SimEvent[];
  /** the robot pressed against something at some moment */
  touched: boolean;
  /** in how many ticks (hundredths of a second) it did */
  touchTicks: number;
  /** the colour sensor read red at some moment */
  sawRed: boolean;
  /** the furthest (mm) the fire target was from its place at any moment */
  maxShift: number;
  /** seconds the fan was blowing */
  fanSeconds: number;
  /** all five LEDs were red at some moment */
  ledsWereRed: boolean;
}

/** Both rooms are in the top row of the field: the robot's turning point is in that row above this line (mm). */
const ROOM_ROW_BOTTOM = FIELD_SIZE / 5;

const RED: RGB = { r: 255, g: 0, b: 0 };
const GREEN: RGB = { r: 0, g: 255, b: 0 };
const BLUE: RGB = { r: 0, g: 0, b: 255 };

const ledsAre = (sim: Sim, colour: RGB): boolean => sim.world.robot.leds.every((led) => led.r === colour.r && led.g === colour.g && led.b === colour.b);

function sample(id: string): SampleProgram {
  const found = getSampleProgram(id);
  assert.ok(found, `example "${id}" exists`);
  return found;
}

/** Play a program from the start signal to the end of the attempt, looking at the robot after every tick. */
function play(blocks: ProgramJson, scenario: FireChiefScenario, sampler?: MatSampler, game: Game<FireChiefScenario> = fireChiefGame): Played {
  const sim = createSimulation({ game, scenario, program: blocks, sampler });
  const played: Played = { sim, events: [], touched: false, touchTicks: 0, sawRed: false, maxShift: 0, fanSeconds: 0, ledsWereRed: false };
  const target = targetOf(sim.world);
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    const robot = sim.world.robot;
    if (robot.touching) {
      played.touched = true;
      played.touchTicks++;
    }
    if (robot.fanOn) played.fanSeconds += sim.dt;
    if (ledsAre(sim, RED)) played.ledsWereRed = true;
    if (target) played.maxShift = Math.max(played.maxShift, targetShift(target));
    // (the colour sensor reads red only 1.5 cm in front of the target: no need to ask it outside the top row)
    if (!played.sawRed && robot.pose.y < ROOM_ROW_BOTTOM && sim.readSensors().frontColor === 'red') played.sawRed = true;
    const events = sim.drainEvents();
    if (events.length > 0) played.events.push(...events);
  }
  played.events.push(...sim.drainEvents());
  return played;
}

/** Warnings and errors of the match. */
const problems = (played: Played): string[] => played.events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));

const bumps = (played: Played): string[] => played.events.flatMap((e) => (e.type === 'bump' ? [e.bodyId] : []));

/** Points of the four achievements, in the order of the score sheet. */
const points = (sim: Sim): number[] =>
  sim
    .score()
    .lines.filter((line) => line.max > 0)
    .map((line) => line.points);

const lineOf = (sim: Sim, id: string): ScoreLine => {
  const line = sim.score().lines.find((l) => l.id === id);
  assert.ok(line, `score line ${id}`);
  return line;
};

const screen = (sim: Sim): string[] => sim.world.robot.screen.lines;

/** The cell the robot's turning point is in. */
function cellOf(sim: Sim): Cell {
  const cell = cellAt(sim.world.robot.pose.x, sim.world.robot.pose.y);
  assert.ok(cell, 'the robot is on the field');
  return cell;
}

/** How far (mm) the robot's turning point is from the middle of a cell. */
function offCentre(sim: Sim, cell: Cell): number {
  const middle = cellCenter(cell);
  return Math.hypot(sim.world.robot.pose.x - middle.x, sim.world.robot.pose.y - middle.y);
}

/** Degrees between the way the robot faces and direction 0 = up, 1 = right, 2 = down, 3 = left. */
const offDirection = (sim: Sim, dir: number): number => Math.abs(wrapAngle(sim.world.robot.pose.heading - (dir * Math.PI) / 2)) / DEG;

/** What the referee said during the match. */
const said = (played: Played): string[] => played.events.flatMap((e) => (e.type === 'log' && e.level === 'info' ? [e.text] : []));

/**
 * How far (mm) the middle of the robot's front face - where the colour sensor sits - is from the
 * front face of the fire target, worked out on paper: the face of a target at the back wall or
 * at the side wall lies one target depth in front of that wall; the face of a target in the
 * corner lies across the corner, (width + depth) / 2 + depth / 2 from it.
 */
function noseToTarget(sim: Sim): number {
  const s = sim.scenario;
  const pose = sim.world.robot.pose;
  const front = sim.robotConfig.chassisFront;
  const nose = { x: pose.x + front * Math.sin(pose.heading), y: pose.y - front * Math.cos(pose.heading) };
  // how far the nose is from the outer side wall of the room
  const fromSide = s.fireRoom === 'living' ? nose.x : FIELD_SIZE - nose.x;
  if (s.fireSpot === 'back') return nose.y - TARGET_DEPTH;
  if (s.fireSpot === 'side') return fromSide - TARGET_DEPTH;
  return (fromSide + nose.y) / Math.SQRT2 - ((TARGET_WIDTH + TARGET_DEPTH) / 2 + TARGET_DEPTH / 2);
}

/** What every example promises: the program has no fault, the robot never moved the fire target, and the attempt is over in time. */
function assertNoFault(played: Played, what: string): void {
  const { sim } = played;
  assert.deepEqual(sim.vm.errors(), [], `${what}: the interpreter found no problem`);
  assert.deepEqual(problems(played), [], `${what}: no warning`);
  const target = targetOf(sim.world);
  assert.ok(target);
  assert.equal(played.maxShift, 0, `${what}: the fire target never moved`);
  assert.equal(targetShift(target), 0, `${what}: the fire target stands where it stood`);
  assert.ok(!said(played).some((text) => text.startsWith('The robot touches the fire target')), `${what}: the referee never saw the robot touch the target`);
  assert.ok(sim.world.time < MATCH_DURATION, `${what}: over before the 180 seconds`);
}

/** ... and, wherever the fire is not in a corner: the robot touched nothing - no wall, not the fire target. */
function assertCleanRun(played: Played, what: string): void {
  assertNoFault(played, what);
  assert.equal(played.touched, false, `${what}: the robot touched nothing`);
  assert.deepEqual(bumps(played), [], `${what}: no bump`);
}

/**
 * A robot that reads red on a target in the corner touches the two walls of that corner: they
 * stop it when its nose is exactly 1.5 cm from the target, and only then is the colour sensor
 * close enough. It presses on them for 3 hundredths of a second at most (until it has read red
 * and its wheels have stopped), and touches nothing else. The engine reports one bump: the wall
 * that was touched first.
 */
function assertTouchedOnlyTheCorner(played: Played, what: string): void {
  const s = played.sim.scenario;
  assert.equal(s.fireSpot, 'corner', what);
  assertNoFault(played, what);
  assert.ok(played.touchTicks >= 1 && played.touchTicks <= 3, `${what}: pressed on a wall for ${played.touchTicks} ticks`);
  const cornerWalls = ['wall:top', s.fireRoom === 'living' ? 'wall:left' : 'wall:right'];
  assert.equal(bumps(played).length, 1, `${what}: bumps ${bumps(played).join(', ')}`);
  assert.ok(cornerWalls.includes(bumps(played)[0]), `${what}: bumped into ${bumps(played)[0]}`);
}

/**
 * The robot has read red and stands in front of the fire: squarely, facing `heading` (degrees),
 * its nose 1.4 cm from a target at a wall, exactly the 1.5 cm of the colour sensor from a target
 * in the corner. It touched nothing - but the two walls of the corner, for a target in the corner.
 */
function assertStandsAtTheFire(played: Played, heading: number, what: string): void {
  const { sim } = played;
  const s = sim.scenario;
  assert.equal(played.sawRed, true, `${what}: the colour sensor read red`);
  assert.equal(sim.readSensors().frontColor, 'red', `${what}: it still reads red at the end`);
  assert.ok(Math.abs(wrapAngle(sim.world.robot.pose.heading - heading * DEG)) / DEG < 0.06, `${what}: facing ${sim.world.robot.pose.heading / DEG} degrees, not ${heading}`);
  const gap = noseToTarget(sim);
  if (s.fireSpot === 'corner') {
    assert.ok(Math.abs(gap - COLOR_SENSOR_RANGE_MM) < 0.01, `${what}: the nose is ${gap.toFixed(3)} mm from the target in the corner`);
    assertTouchedOnlyTheCorner(played, what);
  } else {
    assert.ok(gap > 13.9 && gap < 14.2, `${what}: the nose is ${gap.toFixed(3)} mm from the target`);
    assertCleanRun(played, what);
  }
  // the whole robot is still inside the room
  assert.equal(roomAround(sim.robotShapes()), s.fireRoom, what);
}

/** Three seconds of fan, started while standing still: the referee ends the attempt with "mission complete". */
function assertFanAction(played: Played, what: string): void {
  const { sim } = played;
  assert.equal(sim.finishReason, 'mission-complete', what);
  const fan = lineOf(sim, 'fan-start');
  const done = lineOf(sim, 'fan-complete');
  assert.ok(Math.abs(done.time! - fan.time! - 3) < 0.011, what);
  assert.ok(Math.abs(played.fanSeconds - 3) < 0.03, `${what}: fan on for ${played.fanSeconds} s`);
  assert.equal(sim.score().time, done.time, what);
  assert.equal(played.ledsWereRed, true, `${what}: LEDs red before the fan`);
}

const label = (s: FireChiefScenario): string => `${encodeScenario(s)} (${wallCount(s)} walls)`;

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// =============================================================================================
// The list
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples: three for starters, two in between, one advanced', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'chief-first-wall starter',
        'chief-count-lines starter',
        'chief-flame-fan starter',
        'chief-wall-follow intermediate',
        'chief-face-flame intermediate',
        'chief-full-mission advanced',
      ],
    );
    assert.deepEqual(
      SAMPLE_PROGRAMS.map((s) => s.id),
      SAMPLE_CATALOG.map((card) => card.id),
      'samples.ts has a program for every card, in the same order',
    );
    for (const s of SAMPLE_PROGRAMS) {
      assert.deepEqual({ id: s.id, title: s.title, level: s.level }, exampleCard(s.id), 'title and level come from the catalog');
      assert.equal(getSampleProgram(s.id), s);
    }
    assert.equal(getSampleProgram('no-such-example'), undefined);
    assert.throws(() => exampleCard('hello'), /not on the list/);
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => level.id),
      ['starter', 'intermediate', 'advanced'],
    );
    for (const level of EXAMPLE_LEVELS) assert.ok(level.title.length > 3 && level.about.length > 8 && level.about.length < 50, level.id);
  });

  test('every id starts with "chief-" and no id or title is used by an example of Fire Rescue', () => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...FIRE_RESCUE_CATALOG, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^chief-[a-z]+(-[a-z]+)*$/, card.id);
    for (const card of FIRE_RESCUE_CATALOG) assert.ok(!card.id.startsWith('chief-'), card.id);
  });

  test('every description says, in plain sentences, what the program does, what it scores and what to try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 900, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.match(s.description, /\bTry\b/, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      // short sentences: students read them in a second language
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 230, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
    }
    // the points each one promises, as its tests below measure them
    const promised: Record<string, RegExp[]> = {
      'chief-first-wall': [/scores 10 points .* in every maze that can be played/],
      'chief-count-lines': [/scores 10 points .* in every maze that can be played/],
      // one maze, one place of the fire: 100 points there, 30 with the fire elsewhere on that maze
      'chief-flame-fan': [/^First choose the maze "Open field" and put the fire at the "Back wall" of the living room: this program knows one way only, by heart\./, /mission is complete, 100 points/, /With the fire at another place .* scores 30 points/],
      'chief-wall-follow': [/scores 30 points .* in every maze that can be played/],
      // 100 points when the fire is in the room the left hand reaches first, 30 points when it is in the other one
      'chief-face-flame': [/Nothing: the fire is in the other room\. The LEDs turn blue: 30 points\./, /only then starts the fan: 100 points/],
      'chief-full-mission': [/scored 100 points in all \d+ mazes it was tested on, with the fire at each of its six places, and never moved the target/],
    };
    for (const s of SAMPLE_PROGRAMS) for (const promise of promised[s.id]) assert.match(s.description, promise, s.id);
    // every program drives by distance: each one says that it needs the robot where the simulator
    // puts it (moved inside START, or turned, it can touch a wall - or miss the fire)
    for (const s of SAMPLE_PROGRAMS) assert.match(s.description, /It needs the robot at its default start position\./, s.id);
    // no text for students speaks of a flame sensor: the robot finds the fire by its colour
    for (const s of SAMPLE_PROGRAMS) {
      assert.doesNotMatch(`${s.title} ${s.description} ${JSON.stringify(s.program)}`, /flame/i, s.id);
    }
    // the three programs that read red say how near the colour sensor must be - the number of the robot
    assert.equal(COLOR_SENSOR_RANGE_MM, 15);
    // ... and say that this number is the simulator's own: it is an assumption, not a fact about the real sensor
    assert.match(sample('chief-flame-fan').description, /In this simulator the sensor names a colour only from 1\.5 cm or less/);
    assert.match(sample('chief-face-flame').description, /the sensor is close enough \(1\.5 cm in this simulator\) only when the two walls stop the robot: it touches them for a moment/);
    for (const s of SAMPLE_PROGRAMS) {
      // (wherever "1.5 cm" is written - in a description or in a note on a block - "in this simulator" stands in the same sentence)
      const texts = [s.description, ...notesOf(s.program)];
      for (const text of texts) {
        for (const sentence of text.split(/(?<=[.?!])\s+/)) {
          if (/1\.5 cm/.test(sentence)) assert.match(sentence, /[Ii]n this simulator/, `${s.id}: "${sentence}"`);
        }
      }
    }
    assert.equal(SAMPLE_PROGRAMS.filter((s) => [s.description, ...notesOf(s.program)].some((text) => /1\.5 cm/.test(text))).length, 3, 'the three examples that read red');
    // what a robot does at the corner is said where it is done, with the rule about walls beside it -
    // in both examples that go into the corner: "ask the referee first"
    assert.match(sample('chief-face-flame').description, /On a real field, ask the referee first: the rules allow a light touch of a wall only by accident\./);
    assert.match(sample('chief-full-mission').description, /With the target in a corner it touches the two walls of that corner for a moment; otherwise it touched nothing\. On a real field, ask the referee about that first\./);
    // the two examples that find the fire in many mazes say on their first block that their points are the points of a robot that does not drift
    for (const id of ['chief-face-flame', 'chief-full-mission']) {
      assert.ok(
        notesOf(sample(id).program).some((text) => /the robot of the simulator drives exactly\. A real robot drifts a little/.test(text)),
        `${id}: the note about a real robot`,
      );
    }
    // the note on "moves forward" in front of the target names what decides: slowly, and straight at it
    for (const id of ['chief-flame-fan', 'chief-face-flame', 'chief-full-mission']) {
      assert.ok(
        notesOf(sample(id).program).some((text) => /^Slowly, and straight at it: a robot that comes at a slant pushes the target with its front corner/.test(text)),
        `${id}: the note about coming straight at the target`,
      );
    }
    // what the simulator does differently from a real field is said where a student meets walls first
    assert.match(
      sample('chief-first-wall').description,
      /Walls in the simulator are perfectly smooth: a robot that touches one slides along it, also while it turns\. A real robot gets stuck there, so keep away from the walls\./,
    );
    // only a target that is moved ends the attempt (a touch that does not move it costs nothing: game.test.ts)
    assert.match(sample('chief-flame-fan').description, /pushing the target away ends the attempt/);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Fire Chief stay on the server, like the ones of Fire Rescue', () => {
  const SRC = fileURLToPath(new URL('../..', import.meta.url));
  const CATALOG = 'simulator/fire-chief/sample-catalog.ts';
  const SAMPLES = 'simulator/fire-chief/samples.ts';

  /** Every source file below src/ that is not a test: its path from src/ and its text. */
  const files = new Map<string, string>();
  const walk = (folder: string): void => {
    for (const entry of readdirSync(path.join(SRC, folder), { withFileTypes: true })) {
      const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (/\.(ts|tsx|mjs|js|jsx|css|json)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) {
        files.set(relative, readFileSync(path.join(SRC, relative), 'utf8'));
      }
    }
  };
  walk('');

  /** The files a file imports from (as paths from src/, without extension). */
  const importsOf = (file: string, text: string): string[] =>
    [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((match) => {
      const specifier = match[1];
      if (specifier.startsWith('@/')) return specifier.slice(2);
      if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(file), specifier);
      return specifier;
    });

  test('the list of titles imports nothing; the programs import only the builder, the list and types', () => {
    const catalog = files.get(CATALOG);
    const samples = files.get(SAMPLES);
    assert.ok(catalog && samples);
    assert.deepEqual(importsOf(CATALOG, catalog), []);
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/core/types', 'simulator/fire-chief/sample-catalog', 'simulator/vm/builder']);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'chief-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test('only the server\'s list of all examples imports them - no file of the simulator screen, no page of the website (and the tests)', () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    // members/all-examples.ts is what the server hands out from (../members/unlock.ts); the
    // guard of the server (../members/client-guard.test.ts) keeps it away from the browser
    const SERVER_LIST = 'simulator/members/all-examples.ts';
    assert.deepEqual(importers(CATALOG), [SAMPLES, SERVER_LIST].sort());
    assert.deepEqual(importers(SAMPLES), [SERVER_LIST]);
  });

  test('no other file holds a title, an id or the heading of a level of these examples', () => {
    const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const words = (text: string): RegExp => new RegExp(`(?<!\\w)${text.trim().split(/\s+/).map(escape).join('\\s+')}(?!\\w)`, 'i');
    const telling: RegExp[] = [
      ...SAMPLE_CATALOG.map((card) => words(card.title)),
      ...SAMPLE_CATALOG.map((card) => new RegExp(`(?<![\\w-])${escape(card.id)}(?![\\w-])`, 'i')),
      ...EXAMPLE_LEVELS.map((level) => words(level.about)),
    ];
    for (const [file, text] of files) {
      if (file === CATALOG || file === SAMPLES) continue;
      const found = telling.find((marker) => marker.test(text));
      assert.equal(found, undefined, `${file} says "${found?.exec(text)?.[0]}"`);
    }
  });
});

// =============================================================================================
// The blocks the examples are made of
// =============================================================================================

/** Every block of a program: the scripts, the my-block definitions, and everything inside them. */
function blocksOf(blocks: ProgramJson): BlockJson[] {
  const out: BlockJson[] = [];
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    out.push(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      visit(slot.shadow);
      visit(slot.block);
    }
    visit(block.next?.block);
  };
  (blocks.blocks?.blocks ?? []).forEach(visit);
  return out;
}

/** The notes a student reads on the blocks of a program (the comment bubbles), in the order of the blocks. */
function notesOf(blocks: ProgramJson): string[] {
  return blocksOf(blocks)
    .map((block) => (block.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '')
    .filter((text) => text !== '');
}

/**
 * The same program with the other hand on the wall: "turn right" and "turn left" swapped in the
 * loop of its start script - what two descriptions suggest to try. `first` is the turn the
 * loop begins with as the example is written.
 */
function withTheOtherHand(blocks: ProgramJson, first: 'turn right' | 'turn left'): ProgramJson {
  const second = first === 'turn right' ? 'turn left' : 'turn right';
  const swapped = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  const start = (swapped.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start');
  assert.ok(start);
  const calls = blocksOf({ blocks: { blocks: [start] } }).filter((block) => block.type === 'procedures_callnoreturn');
  const names = calls.map((block) => block.extraState as { name: string });
  assert.deepEqual(names.slice(0, 3).map((state) => state.name), [first, second, 'one cell forward'], 'the loop: look to the hand, turn away while there is a wall, drive');
  names[0].name = second;
  names[1].name = first;
  return swapped;
}

describe('the blocks of the examples', () => {
  test('only blocks of the Fire Chief palette: nothing mBlock does not have, no gripper, no servo', () => {
    const allowed = new Set([...paletteBlockTypes('fire-chief'), ...BUILTIN_BLOCK_TYPES]);
    for (const s of SAMPLE_PROGRAMS) {
      const types = new Set(blocksOf(s.program).map((block) => block.type));
      for (const type of types) {
        assert.ok(allowed.has(type), `${s.id} uses ${type}`);
        assert.ok(supportsBlock(type), `${s.id}: the interpreter knows ${type}`);
      }
      // (my-blocks are plain "define" blocks: mBlock has no my-block that gives back a value)
      assert.ok(!types.has('procedures_defreturn') && !types.has('procedures_callreturn') && !types.has('procedures_ifreturn'), s.id);
    }
  });

  test('each example shows the blocks it is about', () => {
    const uses = (id: string): Set<string> => new Set(blocksOf(sample(id).program).map((block) => block.type));
    const COLOUR = 'sensing_colorsensor_color_is';
    const FAN_BLOCKS = ['mbot2_dc_motor_power', 'mbot2_dc_motor_stop'];
    const TIMER = ['cyberpi_reset_timer', 'cyberpi_timer'];
    assert.ok(uses('chief-first-wall').has('sensing_ultrasonic_distance'));
    assert.ok(uses('chief-count-lines').has('sensing_quadrgb_probe_detects'));
    // the two that do not look for the fire use neither the colour sensor nor the fan
    for (const id of ['chief-first-wall', 'chief-count-lines', 'chief-wall-follow']) {
      for (const type of [COLOUR, ...FAN_BLOCKS]) assert.ok(!uses(id).has(type), `${id}: ${type}`);
    }
    assert.ok(uses('chief-wall-follow').has('sensing_ultrasonic_distance'));
    // the three that read red: the colour sensor, the fan, the timer that ends a drive without red -
    // and the ultrasonic sensor, which looks before the robot drives
    for (const id of ['chief-flame-fan', 'chief-face-flame', 'chief-full-mission']) {
      for (const type of [COLOUR, ...FAN_BLOCKS, ...TIMER, 'sensing_ultrasonic_distance', 'mbot2_move_direction']) assert.ok(uses(id).has(type), `${id}: ${type}`);
    }
    // a starter program is short (the line follower of Fire Rescue, a starter too, has 26 blocks); the full mission is the longest
    const size = (id: string): number => blocksOf(sample(id).program).filter((block) => block.type !== 'math_number' && block.type !== 'text').length;
    for (const card of SAMPLE_CATALOG) {
      if (card.level === 'starter') assert.ok(size(card.id) <= 26, `${card.id}: ${size(card.id)} blocks`);
      assert.ok(size(card.id) <= size('chief-full-mission'), card.id);
    }
  });

  test('no example holds a flame sensor block: the robot finds the fire with its ultrasonic sensor and its colour sensor', () => {
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) assert.ok(!/flame/i.test(block.type), `${s.id} holds ${block.type}`);
    }
    // the colour the three programs wait for is red, on colour sensor number 1 - the one the robot has
    for (const id of ['chief-flame-fan', 'chief-face-flame', 'chief-full-mission']) {
      const asked = blocksOf(sample(id).program).filter((block) => block.type === 'sensing_colorsensor_color_is');
      assert.ok(asked.length >= 2, `${id}: once while it drives, once before the fan`);
      for (const block of asked) {
        assert.equal(block.fields?.COLOR, 'red', id);
        assert.equal(block.inputs?.INDEX?.shadow?.fields?.NUM, 1, id);
      }
      // (what the sensor reads on a wall is an assumption of the simulator: no program asks for another colour)
      assert.ok(!blocksOf(sample(id).program).some((block) => block.type === 'sensing_colorsensor_color'), id);
    }
  });

  test('no program sets the gyro back, and none needs the gyro: every turn is a turn by a number of degrees', () => {
    // ("reset yaw angle" sets "rotated angle around z axis" back in this simulator; real mBlock has
    // another block for that.)
    for (const s of SAMPLE_PROGRAMS) {
      for (const type of ['cyberpi_reset_yaw', 'cyberpi_rotation_z', 'cyberpi_yaw']) {
        assert.ok(!blocksOf(s.program).some((block) => block.type === type), `${s.id}: ${type}`);
      }
    }
  });
});

// =============================================================================================
// The mazes of these tests
// =============================================================================================

test('the 300 random mazes can all be played and cover both rooms, the three spots and 4 to 16 walls', () => {
  assert.equal(RANDOM.length, 300);
  assert.equal(NAMED_PLACES.length, 30);
  assert.equal(ALL_MAZES.length, 330);
  for (const s of [...NAMED, ...ALL_MAZES, ...PERFECT, ...ODD]) assert.ok(isValidScenario(s), label(s));
  assert.equal(new Set(ALL_MAZES.map(encodeScenario)).size, 330, 'no maze twice');
  // the default maze, and each named maze as it comes, is one of the 30
  for (const s of NAMED) assert.ok(NAMED_PLACES.some((other) => encodeScenario(other) === encodeScenario(s)), label(s));
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const count = RANDOM.filter((s) => s.fireRoom === room && s.fireSpot === spot).length;
      assert.ok(count >= 30, `${count} mazes with the fire in the ${room}, ${spot}`);
    }
  }
  const counts = new Set(RANDOM.map(wallCount));
  for (let walls = 4; walls <= PERFECT_MAZE_WALLS; walls++) assert.ok(counts.has(walls), `a maze with ${walls} walls`);
  // START is open upwards in most of them, closed upwards in the others: the way out is then to the right or to the left
  const wayOut = (mazes: FireChiefScenario[], dir: number): number => mazes.filter((s) => freeWayOutOfStart(s) === dir).length;
  assert.deepEqual([wayOut(RANDOM, 0), wayOut(RANDOM, 1), wayOut(RANDOM, 2), wayOut(RANDOM, 3)], [209, 84, 0, 7]);
  // a hand on the wall nearly always finds the room on its own side first
  const firstRoom = (hand: 'left' | 'right', room: RoomId): number => RANDOM.filter((s) => roomOf(lastOf(handOnTheWall(s, hand))) === room).length;
  assert.deepEqual([firstRoom('right', 'bedroom'), firstRoom('right', 'living')], [291, 9]);
  assert.deepEqual([firstRoom('left', 'living'), firstRoom('left', 'bedroom')], [292, 8]);
  for (const s of PERFECT) assert.equal(wallCount(s), PERFECT_MAZE_WALLS);
  assert.ok(Math.max(...ODD.map(wallCount)) > PERFECT_MAZE_WALLS, 'mazes with closed-off cells');
  assert.ok(decodeScenario(SLOWEST_MAZE));
});

// =============================================================================================
// 1. chief-first-wall
// =============================================================================================

describe('chief-first-wall: stop in front of the first wall', () => {
  const blocks = sample('chief-first-wall').program;

  /** The cell in which the robot must end: straight on from START, the first free way, as far as it is open. */
  function expected(s: FireChiefScenario): { dir: number; cell: Cell } {
    const dir = freeWayOutOfStart(s);
    let cell: Cell = { ...START_CELL };
    while (isOpen(s, cell, dir)) cell = next(cell, dir);
    return { dir, cell };
  }

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    const want = expected(s);
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    assert.equal(cellName(cellOf(sim)), cellName(want.cell), `${what}: the cell in front of the first wall`);
    assert.ok(offDirection(sim, want.dir) < 0.01, `${what}: facing the wall`);
    // it stands in front of the wall: nearer than the 8 cm of the program, and not more than 1 cm nearer
    const gap = sim.readSensors().ultrasonicCm;
    assert.ok(gap < FIRST_WALL_STOP_CM && gap > FIRST_WALL_STOP_CM - 1, `${what}: ${gap} cm from the wall`);
    // the screen shows the distance at which it stands (it was measured after the robot had come to rest)
    assert.deepEqual(screen(sim), [`Wall, cm: ${Math.round(gap * 10) / 10}`], what);
    assert.equal(sim.world.robot.left.rpm, 0, what);
    assert.ok(ledsAre(sim, GREEN), `${what}: LEDs green`);
    // 10 points: the robot has left START completely - in every maze
    assert.deepEqual(points(sim), [10, 0, 0, 0], what);
    assert.ok(hasLeftStart(sim.robotShapes()), what);
    return played;
  }

  test('default maze: one cell up, stops 7 to 8 cm before the bar, 10 points', () => {
    const { sim } = check(defaultScenario());
    assert.equal(cellName(cellOf(sim)), 'C4');
    assert.ok(sim.world.time < 4, `${sim.world.time} s`);
    assert.ok(lineOf(sim, 'leave-start').time! < sim.world.time);
  });

  test('named mazes with the fire at every place and 300 random mazes: 10 points in every one, the robot never touches a wall', () => {
    for (const s of ALL_MAZES) check(s);
  });

  test('a wall right in front of START: the robot turns to the free way first', () => {
    const closed = ALL_MAZES.filter((s) => !isOpen(s, START_CELL, 0));
    assert.ok(closed.length >= 90, `${closed.length} mazes with START closed upwards`);
    const sides = new Set<number>();
    for (const s of closed) {
      // (check() has played every one of them in the test above; here a few are looked at again)
      if (sides.size === 2 && sides.has(freeWayOutOfStart(s))) continue;
      const { sim } = check(s);
      assert.ok(cellOf(sim).row === START_CELL.row && cellOf(sim).col !== START_CELL.col, 'it left START sideways');
      sides.add(freeWayOutOfStart(s));
    }
    assert.deepEqual([...sides].sort(), [1, 3], 'to the right in some mazes, to the left in others');
  });
});

// =============================================================================================
// 2. chief-count-lines
// =============================================================================================

/**
 * The counting loop of the line counter alone, at any speed: straight up the middle column of
 * the open field from the cell above START, over three grid lines. `runs` matches, each begun
 * 0.05 mm further up. Returns how many crossings were not counted, and how many were counted twice.
 */
function linesMissed(rpm: number, runs: number, sampler?: MatSampler): { missed: number; extra: number } {
  const counter = program([
    script(whenStart(), [
      setVar('lines', 0),
      move('forward', rpm),
      forever([waitUntil(probeDetects('L1', 'line')), waitUntil(probeDetects('L1', 'background')), changeVar('lines', 1)]),
    ]),
  ]);
  let missed = 0;
  let extra = 0;
  for (let k = 0; k < runs; k++) {
    const sim = createSimulation({
      game: fireChiefGame,
      scenario: NAMED_MAZES[0].scenario,
      program: counter,
      sampler,
      startPose: { x: START_POSE.x, y: 1150 + k * 0.05, heading: 0 },
    });
    sim.start();
    // until the probes are in the middle of the top row, well past the third line
    while (sim.status === 'running' && sim.world.robot.pose.y > 240) sim.step(1);
    const lines = sim.vm.variables().lines as number;
    if (lines < 3) missed += 3 - lines;
    if (lines > 3) extra += lines - 3;
  }
  return { missed, extra };
}

describe('chief-count-lines: count grid lines to drive two cells', () => {
  const blocks = sample('chief-count-lines').program;

  /** One cell out of START the first free way, a quarter turn to the left, then up to two cells while the way is open. */
  function expected(s: FireChiefScenario): { dir: number; cell: Cell; cells: number } {
    const dir = (freeWayOutOfStart(s) + 3) % 4;
    let cell = next(START_CELL, freeWayOutOfStart(s));
    let cells = 0;
    while (cells < LINE_COUNTER_CELLS && isOpen(s, cell, dir)) {
      cell = next(cell, dir);
      cells++;
    }
    return { dir, cell, cells };
  }

  function check(s: FireChiefScenario, sampler?: MatSampler): Played {
    const what = label(s);
    const played = play(blocks, s, sampler);
    const { sim } = played;
    const want = expected(s);
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    assert.equal(sim.vm.variables().cells, want.cells, `${what}: cells counted`);
    assert.deepEqual(screen(sim), [`Cells counted: ${want.cells}`], what);
    assert.equal(cellName(cellOf(sim)), cellName(want.cell), `${what}: the cell it ends in`);
    // in the middle of that cell: by distance exactly, after a grid line within 3 mm
    assert.ok(offCentre(sim, want.cell) < (want.cells === 0 ? 0.1 : 3), `${what}: ${offCentre(sim, want.cell).toFixed(1)} mm from the middle`);
    assert.ok(offDirection(sim, want.dir) < 0.01, what);
    assert.ok(ledsAre(sim, GREEN), what);
    assert.deepEqual(points(sim), [10, 0, 0, 0], what);
    return played;
  }

  test('default maze: up one cell, then two cells to the left by counting two lines, 10 points', () => {
    const { sim } = check(defaultScenario());
    assert.equal(cellName(cellOf(sim)), 'A4');
    assert.equal(sim.vm.variables().cells, 2);
  });

  test('the line is where the program thinks: 8.5 + 15 = 23.5 cm after a line the robot is in the middle of the cell', () => {
    assert.equal(AFTER_LINE_CM, 23.5);
    assert.equal(AFTER_LINE_CM * 10, fireChiefGame.robotConfig!.quadRgb.forward + 150);
    const { sim } = check(defaultScenario());
    assert.ok(offCentre(sim, { col: 0, row: 3 }) < 1.5, `${offCentre(sim, { col: 0, row: 3 }).toFixed(2)} mm`);
  });

  test('the speed of the line counter: up to 170 RPM every grid line is seen, at the full 180 RPM one is missed now and then', () => {
    assert.equal(LINE_COUNTER_RPM, 50);
    assert.match(sample('chief-count-lines').description, /Do not count lines at full speed: a line can be missed\./);
    for (const rpm of [LINE_COUNTER_RPM, 120, 170]) {
      assert.deepEqual(linesMissed(rpm, 100), { missed: 0, extra: 0 }, `${rpm} RPM`);
    }
    const full = linesMissed(180, 400);
    assert.ok(full.missed > 0 && full.missed < 20, `180 RPM: ${full.missed} of 1200 crossings missed`);
    assert.equal(full.extra, 0);
  });

  test('named mazes with the fire at every place and 300 random mazes: 10 points in every one; it stops counting where a wall closes the way', () => {
    const counted = [0, 0, 0];
    for (const s of ALL_MAZES) counted[check(s).sim.vm.variables().cells as number]++;
    // all three endings happen: no cell (a wall at once), one cell, two cells
    for (const [cells, mazes] of counted.entries()) assert.ok(mazes >= 50, `${mazes} mazes with ${cells} cells counted`);
  });
});

// =============================================================================================
// 3. chief-flame-fan
// =============================================================================================

describe('chief-flame-fan: read red, then start the fan', () => {
  const blocks = sample('chief-flame-fan').program;

  /** What the ultrasonic sensor reads at the start signal: the look the program takes before it drives. */
  const firstLook = (s: FireChiefScenario): number => createSimulation({ game: fireChiefGame, scenario: s, program: blocks }).readSensors().ultrasonicCm;

  /** On paper: is the way the program knows by heart free? Four cells up from START, then two cells to the left. */
  function wayIsFree(s: FireChiefScenario): boolean {
    let cell: Cell = { ...START_CELL };
    for (const dir of [0, 0, 0, 0, 3, 3]) {
      if (!isOpen(s, cell, dir)) return false;
      cell = next(cell, dir);
    }
    return roomOf(cell) === 'living';
  }

  /**
   * The four things this program can do in a maze:
   *   'stays'      it sees a wall up the field: "Choose: Open field", and it does not move
   *   'fire'       the way is free and the fire stands at the back wall of the living room: 100 points
   *   'no red'     the way is free and the fire stands somewhere else: "No red here", 30 points
   *   'into wall'  it sees no wall, drives off and runs into one (the wall that closes the living room on the right)
   */
  type Outcome = 'stays' | 'fire' | 'no red' | 'into wall';

  function check(s: FireChiefScenario): Outcome {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    assertNoFault(played, what);

    if (firstLook(s) < OPEN_WAY_CM) {
      // a wall up the field, on the way or close beside it: the program ends at once, in START
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.ok(sim.world.time < 0.05, `${what}: ${sim.world.time} s`);
      assert.deepEqual(sim.world.robot.pose, START_POSE, what);
      assert.deepEqual(screen(sim), ['Choose: Open field'], what);
      assert.deepEqual(points(sim), [0, 0, 0, 0], what);
      assert.equal(played.touched, false, what);
      assert.equal(played.fanSeconds, 0, what);
      return 'stays';
    }
    // (whenever a wall stands in the way up, the look sees it: the program never drives into one of those)
    for (let row = START_CELL.row; row > 0; row--) assert.ok(isOpen(s, { col: START_CELL.col, row }, 0), `${what}: a wall above row ${row} was not seen`);

    if (!wayIsFree(s)) {
      // the one kind of wall the look does not see: the living room is closed on its right side.
      // The robot runs into that wall, turns, finds no red and ends without the fan.
      assert.equal(wallBetweenCells(s.walls, { col: 0, row: 0 }, { col: 1, row: 0 }), true, what);
      assert.deepEqual([...new Set(bumps(played))], ['wall:A1-B1'], what);
      assert.equal(played.touched, true, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.deepEqual(screen(sim), ['No red here'], what);
      assert.deepEqual(points(sim), [10, 0, 0, 0], what);
      assert.equal(played.fanSeconds, 0, what);
      assert.equal(played.sawRed, false, what);
      return 'into wall';
    }

    // the way is free: the robot has come into the living room and has driven at its back wall
    assert.equal(roomAround(sim.robotShapes()), 'living', what);
    assert.ok(offDirection(sim, 0) < 0.01, `${what}: facing the back wall`);
    if (s.fireRoom === 'living' && s.fireSpot === 'back') {
      // red: it stopped 1.4 cm in front of the target, and the fan blew for 3 seconds
      assertStandsAtTheFire(played, 0, what);
      assertFanAction(played, what);
      assert.deepEqual(points(sim), [10, 20, 30, 40], what);
      assert.equal(sim.score().complete, true, what);
      assert.deepEqual(screen(sim), [], what);
      return 'fire';
    }
    // no red within half a second: the robot has stopped short of the wall, and the fan stays off
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    assert.equal(played.sawRed, false, what);
    assert.deepEqual(screen(sim), ['No red here'], what);
    assert.deepEqual(points(sim), [10, 20, 0, 0], what);
    assert.equal(played.fanSeconds, 0, what);
    assert.equal(played.ledsWereRed, false, what);
    // it drove about 3 cm on from the middle of the room: its nose is still 1 cm from the back wall
    const nose = sim.world.robot.pose.y - sim.robotConfig.chassisFront;
    assert.ok(nose > 10 && nose < 13, `${what}: the nose is ${nose.toFixed(1)} mm from the back wall`);
    return 'no red';
  }

  test('open field, the fire at the back wall of the living room: red after 12.5 seconds, 100 points after 16', () => {
    const s = OPEN_FIELD.scenario;
    assert.deepEqual([s.fireRoom, s.fireSpot, wallCount(s)], ['living', 'back', 0], 'the maze "Open field" as it comes');
    assert.equal(check(s), 'fire');
    const played = play(blocks, s);
    assert.ok(lineOf(played.sim, 'fan-start').time! > 12.5 && lineOf(played.sim, 'fan-start').time! < 13, `${lineOf(played.sim, 'fan-start').time} s`);
    assert.ok(played.sim.world.time > 15.5 && played.sim.world.time < 16, `${played.sim.world.time} s`);
    // the look before the drive: 124.5 cm free up the open field
    assert.equal(firstLook(s), 124.5);
  });

  test('open field, the fire at each of the other five places: "No red here", 30 points, the fan stays off', () => {
    for (const { room, spot } of PLACES) {
      if (room === 'living' && spot === 'back') continue;
      assert.equal(check(openField(room, spot)), 'no red', `${room} ${spot}`);
    }
  });

  test('the try of the description: without the last turn the robot finds the fire at the side wall of the living room', () => {
    assert.match(sample('chief-flame-fan').description, /Try the fire at the side wall of the living room: which block do you take away\?$/);
    // take away "turns right 90": the robot then faces the side wall, where it came in
    const changed = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
    const stack = blocksOf(changed).filter((block) => block.type === 'mbot2_turn_deg' || block.type === 'mbot2_straight_cm');
    assert.deepEqual(stack.map((block) => `${block.type} ${block.fields?.DIRECTION}`), ['mbot2_straight_cm forward', 'mbot2_turn_deg left', 'mbot2_straight_cm forward', 'mbot2_turn_deg right']);
    const before = stack[2];
    assert.equal(before.next?.block, stack[3]);
    before.next = stack[3].next;
    const atTheSide = play(changed, openField('living', 'side'));
    assertStandsAtTheFire(atTheSide, -90, 'fire at the side wall');
    assertFanAction(atTheSide, 'fire at the side wall');
    assert.deepEqual(points(atTheSide.sim), [10, 20, 30, 40]);
    // and with the turn left in, the same fire is not found
    assert.equal(check(openField('living', 'side')), 'no red');
  });

  test('the default maze and the named mazes with the fire at every place: it stays in START where it sees a wall; in "Two doors" it runs into one', () => {
    assert.equal(check(defaultScenario()), 'stays');
    const outcomes: Record<string, Outcome[]> = {};
    for (const maze of NAMED_MAZES) outcomes[maze.id] = PLACES.map(({ room, spot }) => check(withFire(maze.scenario, room, spot)));
    const all = (outcome: Outcome): Outcome[] => PLACES.map(() => outcome);
    assert.deepEqual(outcomes.crossroads, all('stays'));
    assert.deepEqual(outcomes.detour, all('stays'));
    assert.deepEqual(outcomes['one-way'], all('stays'));
    assert.deepEqual(outcomes['two-doors'], all('into wall'), 'as the description says');
    assert.deepEqual(outcomes.open, ['no red', 'fire', 'no red', 'no red', 'no red', 'no red'], 'in the order of the six places: living room corner, back, side; bedroom corner, back, side');
    assert.match(sample('chief-flame-fan').description, /if it sees a wall, it stays in START\. It does not see every wall: in the maze "Two doors" it runs into one\./);
  });

  /**
   * More random mazes (seeds 301, 302, ...), kept when the look up the field sees no wall: the
   * program drives off in them. (Such mazes are rare: about 4 in 100.)
   */
  const NO_WALL_SEEN: FireChiefScenario[] = (() => {
    const out: FireChiefScenario[] = [];
    for (let seed = RANDOM_MAZES + 1; out.length < 60; seed++) {
      assert.ok(seed < 100_000, 'enough mazes are found long before');
      const s = randomScenario(makeRng(seed));
      if (firstLook(s) >= OPEN_WAY_CM) out.push(s);
    }
    return out;
  })();

  test('300 random mazes, and 60 more in which it sees no wall: it stays in START, or drives its way and blows only where it reads red', (t) => {
    const counts: Record<Outcome, number> = { stays: 0, fire: 0, 'no red': 0, 'into wall': 0 };
    for (const s of RANDOM) counts[check(s)]++;
    t.diagnostic(`300 random mazes: stays in START in ${counts.stays}, 100 points in ${counts.fire}, "No red here" in ${counts['no red']}, into a wall in ${counts['into wall']}`);
    // nearly every maze with inner walls has one that the look up the field sees
    assert.ok(counts.stays >= 270, `${counts.stays} of 300`);
    const driven: Record<Outcome, number> = { stays: 0, fire: 0, 'no red': 0, 'into wall': 0 };
    for (const s of NO_WALL_SEEN) driven[check(s)]++;
    t.diagnostic(`60 mazes in which it sees no wall: 100 points in ${driven.fire}, "No red here" in ${driven['no red']}, into a wall in ${driven['into wall']}`);
    assert.equal(driven.stays, 0);
    assert.ok(driven.fire >= 3 && driven['no red'] >= 20 && driven['into wall'] >= 3, JSON.stringify(driven));
  });

  test('the numbers of the program: the look before the drive, the slow drive, and the half second without red', () => {
    // from anywhere inside START the open field reads 120 cm or more, and a wall on the way up 102.4 cm at most
    assert.equal(OPEN_WAY_CM, 110);
    const fromStart = (y: number, s: FireChiefScenario): number =>
      createSimulation({ game: fireChiefGame, scenario: s, program: blocks, startPose: { ...START_POSE, y } }).readSensors().ultrasonicCm;
    // (the whole robot inside START: its turning point is 105 mm to 230 mm below the top of the cell)
    const top = START_POSE.y - 45;
    const bottom = START_POSE.y + 80;
    assert.ok(fromStart(top, OPEN_FIELD.scenario) >= OPEN_WAY_CM + 10 && fromStart(bottom, OPEN_FIELD.scenario) >= OPEN_WAY_CM + 10);
    const wallAtTheTop = withFire(OPEN_FIELD.scenario, 'living', 'back');
    wallAtTheTop.walls = wallAtTheTop.walls.map((_, i) => i === 20 + 2); // the wall between C1 and C2: the furthest one on the way up
    assert.equal(wallBetweenCells(wallAtTheTop.walls, { col: 2, row: 0 }, { col: 2, row: 1 }), true);
    assert.ok(fromStart(bottom, wallAtTheTop) <= OPEN_WAY_CM - 5 && fromStart(top, wallAtTheTop) <= OPEN_WAY_CM - 5, `${fromStart(bottom, wallAtTheTop)} cm`);
    // half a second at 20 RPM is 3.3 cm: more than the 1 cm to red, less than the 4.5 cm to the wall
    assert.equal(APPROACH_RPM, 20);
    assert.equal(FIRST_APPROACH_SECONDS, 0.5);
    const mmPerSecond = (APPROACH_RPM / 60) * Math.PI * FIRE_CHIEF_ROBOT.wheelDiameter;
    assert.ok(mmPerSecond < 100, 'less than 1 mm between two looks at the sensor (a hundredth of a second apart)');
    const driven = mmPerSecond * FIRST_APPROACH_SECONDS;
    const noseToWall = 150 - FIRE_CHIEF_ROBOT.chassisFront;
    assert.ok(driven > noseToWall - TARGET_DEPTH - COLOR_SENSOR_RANGE_MM + 10 && driven < noseToWall - 10, `${driven.toFixed(1)} mm`);
  });
});

// =============================================================================================
// 4. chief-wall-follow
// =============================================================================================

describe('chief-wall-follow: follow the right-hand wall to a room', () => {
  const blocks = sample('chief-wall-follow').program;

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    const way = handOnTheWall(s, 'right');
    const room = roomOf(lastOf(way));
    assert.ok(room);
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    // it stands in the middle of the room the right hand leads to first, and knows where it is
    assert.equal(roomAround(sim.robotShapes()), room, what);
    assert.ok(offCentre(sim, ROOMS[room].cell) < 0.1, `${what}: ${offCentre(sim, ROOMS[room].cell)} mm from the middle`);
    const variables = sim.vm.variables();
    assert.deepEqual([variables.col, variables.row], [ROOMS[room].cell.col, 0], what);
    assert.ok(offDirection(sim, variables.dir as number) < 0.01, `${what}: "dir" is the way it faces`);
    assert.deepEqual(screen(sim), [room === 'living' ? 'In the living room' : 'In the bedroom'], what);
    assert.ok(ledsAre(sim, GREEN), what);
    // 30 points: out of START and completely inside a room; it does not use the fan
    assert.deepEqual(points(sim), [10, 20, 0, 0], what);
    assert.equal(played.fanSeconds, 0, what);
    return played;
  }

  test('default maze: the right hand leads round the right side into the bedroom, 30 points', () => {
    const s = defaultScenario();
    const { sim } = check(s);
    assert.equal(roomAround(sim.robotShapes()), 'bedroom');
    assert.equal(s.fireRoom, 'living', 'the fire is in the other room: this example does not look for it');
    assert.equal(handOnTheWall(s, 'right').length, 12, 'twelve cells along the wall');
    assert.ok(sim.world.time > 30 && sim.world.time < 40, `${sim.world.time} s`);
  });

  /** 60 more mazes in which the right hand leads to the living room first (it nearly always finds the bedroom). */
  const TO_THE_LIVING_ROOM = mazesWhereTheHandFinds('right', 'living');

  test('named mazes with the fire at every place and 300 random mazes: 30 points in every one, in the room the right hand reaches first', (t) => {
    const rooms = { living: 0, bedroom: 0 };
    const times: number[] = [];
    for (const s of ALL_MAZES) {
      const { sim } = check(s);
      rooms[roomAround(sim.robotShapes())!]++;
      times.push(sim.world.time);
    }
    t.diagnostic(`${ALL_MAZES.length} mazes: 30 points in every one (bedroom ${rooms.bedroom}, living room ${rooms.living}), median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
    // the right hand nearly always leads to the bedroom, which is on the right
    assert.deepEqual(rooms, { living: 9, bedroom: 321 });
    assert.ok(Math.max(...times) < 110, `slowest ${Math.max(...times)} s`);
  });

  test('60 more random mazes in which the right hand leads to the living room: 30 points in every one', () => {
    for (const s of TO_THE_LIVING_ROOM) {
      const { sim } = check(s);
      assert.equal(roomAround(sim.robotShapes()), 'living', label(s));
    }
  });

  test('it walks into the fire room without touching the target, wherever the target stands', () => {
    const fireFirst = [...ALL_MAZES, ...TO_THE_LIVING_ROOM].filter((s) => roomOf(lastOf(handOnTheWall(s, 'right'))) === s.fireRoom);
    for (const room of ROOM_IDS) {
      for (const spot of FIRE_SPOTS) {
        const count = fireFirst.filter((s) => s.fireRoom === room && s.fireSpot === spot).length;
        assert.ok(count >= 12, `${count} mazes that end in the ${room} with the fire at its ${spot}`);
      }
    }
    // (check() has asserted for each of them that nothing was touched and the target did not move)
    assert.ok(fireFirst.length >= 200, `${fireFirst.length} mazes where the first room is the fire room`);
  });

  test('the left hand, as the description suggests to try: swap the two turns of the loop', () => {
    const swapped = withTheOtherHand(blocks, 'turn right');
    for (const s of [defaultScenario(), ...RANDOM.slice(0, 40)]) {
      const played = play(swapped, s);
      const room = roomOf(lastOf(handOnTheWall(s, 'left')));
      assert.deepEqual(played.sim.vm.errors(), [], label(s));
      assert.equal(roomAround(played.sim.robotShapes()), room, label(s));
      assert.deepEqual(points(played.sim), [10, 20, 0, 0], label(s));
      assert.equal(played.touched, false, label(s));
    }
    // in the default maze the left hand ends in the living room, the right hand in the bedroom
    assert.equal(roomOf(lastOf(handOnTheWall(defaultScenario(), 'left'))), 'living');
  });
});

// =============================================================================================
// 5. chief-face-flame
// =============================================================================================

/** The same game with a fire target that has no colour: the colour sensor reads nothing on it. (For the "not red" branch.) */
const GREY_TARGET_GAME: Game<FireChiefScenario> = {
  ...fireChiefGame,
  createBodies: (s) => fireChiefGame.createBodies(s).map((body) => ({ ...body, colorName: undefined })),
};

describe('chief-face-flame: find the fire in a room and check its colour', () => {
  const blocks = sample('chief-face-flame').program;

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    const arrived = lastOf(handOnTheWall(s, 'left'));
    const room = roomOf(arrived);
    assert.ok(room);
    const variables = sim.vm.variables();
    assert.deepEqual([variables.col, variables.row], [ROOMS[room].cell.col, 0], `${what}: it knows that it is in the ${room}`);
    if (room === s.fireRoom) {
      // the fire is here: the ultrasonic sensor found its place, the colour sensor read red, the fan blew
      const paper = lookOnPaper(room, arrived.dir, s.fireSpot);
      assert.deepEqual([variables.fire, variables.swing], [1, paper.swing], what);
      assertStandsAtTheFire(played, paper.heading, what);
      assertFanAction(played, what);
      assert.deepEqual(points(sim), [10, 20, 30, 40], what);
      assert.equal(sim.score().complete, true, what);
      assert.deepEqual(screen(sim), ['Red: fan on'], what);
    } else {
      // the fire is in the other room: nothing at any of the three places, LEDs blue, and the
      // robot stands in the middle of the room, facing again the way it came in
      assertCleanRun(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.equal(roomAround(sim.robotShapes()), room, what);
      assert.ok(offCentre(sim, ROOMS[room].cell) < 0.1, what);
      assert.equal(variables.fire, 0, what);
      assert.equal(variables.dir, arrived.dir, what);
      assert.ok(offDirection(sim, arrived.dir) < 0.01, `${what}: "dir" is the way it faces`);
      assert.ok(ledsAre(sim, BLUE), what);
      assert.deepEqual(screen(sim), ['No fire here'], what);
      assert.deepEqual(points(sim), [10, 20, 0, 0], what);
      assert.equal(played.fanSeconds, 0, what);
      assert.equal(played.sawRed, false, what);
    }
    return played;
  }

  test('default maze: the left hand leads to the living room; the robot reads red on the fire in its corner: 100 points after 34 seconds', () => {
    const s = defaultScenario();
    const { sim, touchTicks } = check(s);
    assert.equal(roomAround(sim.robotShapes()), 'living');
    assert.equal(s.fireSpot, 'corner');
    // the corner target is up and to the left: the robot faces north-west, against the two walls of the corner
    assert.ok(Math.abs(sim.world.robot.pose.heading / DEG + 45) < 0.06, `heading ${sim.world.robot.pose.heading / DEG}`);
    assert.equal(touchTicks, 3, 'it pressed on the walls for 3 hundredths of a second');
    const told = /In the default maze the left hand leads to the fire: 100 points after (\d+) seconds\./.exec(sample('chief-face-flame').description);
    assert.ok(told);
    assert.equal(Number(told[1]), Math.round(sim.world.time), `${sim.world.time} s`);
  });

  /** 60 more mazes in which the left hand leads to the bedroom first (it nearly always finds the living room). */
  const TO_THE_BEDROOM = mazesWhereTheHandFinds('left', 'bedroom');

  test('named mazes with the fire at every place, 300 random mazes and 60 where the left hand leads to the bedroom: 100 points where the fire is in that room, 30 where it is not', (t) => {
    let empty = 0;
    const found: Record<string, number> = {};
    const times: number[] = [];
    for (const s of [...ALL_MAZES, ...TO_THE_BEDROOM]) {
      const { sim } = check(s);
      times.push(sim.world.time);
      if (sim.score().total === 100) found[`${s.fireRoom} ${s.fireSpot}`] = (found[`${s.fireRoom} ${s.fireSpot}`] ?? 0) + 1;
      else empty++;
    }
    const foundTotal = Object.values(found).reduce((sum, n) => sum + n, 0);
    t.diagnostic(
      `${times.length} mazes: read red and blew in ${foundTotal} (100 points), found the room empty in ${empty} (30 points); ` +
        `median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`,
    );
    assert.ok(foundTotal >= 150 && empty >= 150, `found the fire in ${foundTotal} mazes, found the room empty in ${empty}`);
    // both rooms, all three places - each of the six in at least 12 mazes
    for (const { room, spot } of PLACES) assert.ok((found[`${room} ${spot}`] ?? 0) >= 12, `${found[`${room} ${spot}`] ?? 0} mazes with the fire in the ${room}, ${spot}`);
    assert.ok(Math.max(...times) < 115, `slowest ${Math.max(...times)} s`);
  });

  test('"look for the fire": the robot comes in facing a wall or facing up, and finds each place at the first, second or third look', () => {
    // every way of coming into a room, with the fire at every place of that room: (room, direction, place) -> the look that finds it
    const seen = new Set<string>();
    for (const s of [...ALL_MAZES, ...TO_THE_BEDROOM]) {
      const arrived = lastOf(handOnTheWall(s, 'left'));
      const room = roomOf(arrived);
      if (room !== s.fireRoom) continue;
      const paper = lookOnPaper(room, arrived.dir, s.fireSpot);
      seen.add(`${room} ${arrived.dir} ${s.fireSpot} ${paper.looks}`);
    }
    // The left hand comes into the living room facing up or facing left, and into the bedroom
    // facing up: 3 ways x 3 places. (It comes into the bedroom facing right when it has been in the
    // living room before: the full mission, below, does.)
    assert.deepEqual([...seen].sort(), [
      'bedroom 0 back 1', 'bedroom 0 corner 2', 'bedroom 0 side 3',
      'living 0 back 1', 'living 0 corner 2', 'living 0 side 3',
      'living 3 back 3', 'living 3 corner 2', 'living 3 side 1',
    ]); // prettier-ignore
    // the fire in the corner of the default maze is found at the second look, half a quarter turn to the right
    const corner = play(blocks, defaultScenario()).sim.vm.variables();
    assert.deepEqual([corner.dir, corner.swing, corner.fire], [3, 1, 1]);
    // the same maze with the fire at the back wall: the third look, a quarter turn to the right
    const atTheBack = withFire(defaultScenario(), 'living', 'back');
    assert.deepEqual(lookOnPaper('living', lastOf(handOnTheWall(atTheBack, 'left')).dir, 'back'), { swing: 1, looks: 3, heading: 0 });
    assert.ok(offDirection(play(blocks, atTheBack).sim, 0) < 0.06);
    // open field: the left hand leads up the left side, the robot comes in facing the back wall and finds the fire there at the first look
    assert.deepEqual(lookOnPaper('living', lastOf(handOnTheWall(OPEN_FIELD.scenario, 'left')).dir, 'back'), { swing: -1, looks: 1, heading: 0 });
    assert.deepEqual(play(blocks, OPEN_FIELD.scenario).sim.vm.variables().swing, -1);
  });

  test('the numbers of "look for the fire": what the ultrasonic sensor reads at the three places, with the target and without', () => {
    // the robot in the middle of a room, looking at a place: straight at a wall, or into the corner
    const reading = (room: RoomId, look: FireSpot, fire: FireChiefScenario): number => {
      const outwards = room === 'living' ? -1 : 1;
      const heading = (look === 'back' ? 0 : look === 'side' ? outwards * 90 : outwards * 45) * DEG;
      const sim = createSimulation({ game: fireChiefGame, scenario: fire, program: blocks, startPose: { ...cellCenter(ROOMS[room].cell), heading } });
      // (from there the colour sensor reads nothing: the target is more than 1.5 cm away)
      assert.equal(sim.readSensors().frontColor, 'none', `${room} ${look}`);
      return sim.readSensors().ultrasonicCm;
    };
    for (const room of ROOM_IDS) {
      const other: RoomId = room === 'living' ? 'bedroom' : 'living';
      for (const look of FIRE_SPOTS) {
        const limit = look === 'corner' ? CORNER_PLACE_CM : WALL_PLACE_CM;
        // the target at this place: clearly less than the limit
        const withTarget = reading(room, look, openField(room, look));
        assert.equal(withTarget, look === 'corner' ? 5.7 : 3, `${room} ${look}`);
        assert.ok(withTarget < limit - 0.9, `${room} ${look}: ${withTarget} cm`);
        // the target at another place of the room, or in the other room: the bare wall, clearly more
        for (const elsewhere of [...FIRE_SPOTS.filter((spot) => spot !== look).map((spot) => openField(room, spot)), openField(other, look)]) {
          const bare = reading(room, look, elsewhere);
          assert.equal(bare, look === 'corner' ? 9 : 4.5, `${room} ${look}, fire ${elsewhere.fireRoom} ${elsewhere.fireSpot}`);
          assert.ok(bare > limit + 0.4, `${room} ${look}: ${bare} cm`);
        }
      }
    }
    assert.deepEqual([WALL_PLACE_CM, CORNER_PLACE_CM], [4, 7.5]);
    // the notes on the blocks give these numbers
    const notes = blocksOf(blocks).map((block) => (block.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '');
    assert.ok(notes.some((text) => /a wall, 4\.5 cm away\..*\(3 cm, its smallest value\)\. Less than 4 cm/.test(text)), 'the note on the first look');
    assert.ok(notes.some((text) => /The empty corner reads 9 cm, the target in it 5\.7 cm\. Less than 7\.5 cm/.test(text)), 'the note on the look into the corner');
  });

  test('the try of the description: the default maze with the fire in the bedroom - "No fire here", 30 points', () => {
    assert.match(sample('chief-face-flame').description, /Try the default maze with the fire in the bedroom: what does the robot show\?$/);
    for (const spot of FIRE_SPOTS) {
      const { sim } = check(withFire(defaultScenario(), 'bedroom', spot));
      assert.equal(roomAround(sim.robotShapes()), 'living');
      assert.deepEqual(screen(sim), ['No fire here']);
      assert.equal(sim.score().total, 30);
    }
  });

  test('"make sure before you blow": a thing that does not read red gets no fan', () => {
    // the same maze with a target the colour sensor cannot name: the ultrasonic sensor finds it,
    // the robot drives at it for 3 seconds, reads no red - and leaves the fan off
    assert.equal(APPROACH_SECONDS, 3);
    for (const spot of FIRE_SPOTS) {
      const s = withFire(defaultScenario(), 'living', spot);
      const played = play(blocks, s, undefined, GREY_TARGET_GAME);
      const { sim } = played;
      const what = `a target without colour, ${spot}`;
      assert.deepEqual(sim.vm.errors(), [], what);
      assert.equal(sim.vm.variables().fire, 1, `${what}: the ultrasonic sensor found it`);
      assert.equal(played.sawRed, false, what);
      assert.deepEqual(screen(sim), ['Not red: no fan'], what);
      assert.equal(played.fanSeconds, 0, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.deepEqual(points(sim), [10, 20, 0, 0], what);
      // head-on, a target that stands flat against its wall does not move (the wall holds it); in the corner the walls stop the robot
      assert.ok(played.maxShift < 1e-9, `${what}: the target moved ${played.maxShift} mm`);
    }
  });
});

// =============================================================================================
// 6. chief-full-mission
// =============================================================================================

describe('chief-full-mission: the whole mission on any maze', () => {
  const blocks = sample('chief-full-mission').program;

  /** Does the left hand lead through the room without fire before it reaches the fire room? */
  const otherRoomFirst = (s: FireChiefScenario): boolean =>
    handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom).some((cell) => roomOf(cell) !== null && roomOf(cell) !== s.fireRoom);

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    // 100 points, and the referee ends the attempt: mission complete
    assert.deepEqual(points(sim), [10, 20, 30, 40], what);
    assert.equal(sim.score().complete, true, what);
    assertFanAction(played, what);
    // it found the place of the fire where the paper says, read red there, and stands 1.4 cm in
    // front of the target (1.5 cm, against the two walls, in a corner)
    const arrived = lastOf(handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom));
    const paper = lookOnPaper(s.fireRoom, arrived.dir, s.fireSpot);
    assert.deepEqual([sim.vm.variables().fire, sim.vm.variables().swing], [1, paper.swing], what);
    assertStandsAtTheFire(played, paper.heading, what);
    // the screen says what it found in every room it looked into: the room without fire first, if
    // the way along the wall led through it, then the fire
    assert.deepEqual(screen(sim), otherRoomFirst(s) ? ['No fire here', 'Red: fan on'] : ['Red: fan on'], what);
    return played;
  }

  /** The numbers the description names: how many mazes, and the two times. */
  const description = sample('chief-full-mission').description;
  const counted = /It scored 100 points in all (\d+) mazes it was tested on, with the fire at each of its six places/.exec(description);
  const told = /The default maze takes (\d+) seconds, the slowest maze found (\d+) of the 180 seconds/.exec(description);

  test('default maze: 100 points after 34 seconds, as the description says', () => {
    const { sim } = check(defaultScenario());
    assert.ok(sim.world.time > 33 && sim.world.time < 36, `${sim.world.time} s`);
    assert.equal(sim.restarts, 0);
    assert.ok(told, 'the description names the two times');
    assert.equal(Number(told[1]), Math.round(sim.world.time), `${sim.world.time} s`);
  });

  test('the five named mazes, from the open field to the maze with one way only, the fire at each of its six places: 100 points', () => {
    for (const s of NAMED_PLACES) check(s);
  });

  test('300 random mazes: 100 points in every one, the slowest well inside the 180 seconds', (t) => {
    const runs = RANDOM.map((s) => check(s));
    const times = runs.map((played) => played.sim.world.time);
    t.diagnostic(`300 random mazes: 300 of 300 complete with 100 points, median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
    assert.ok(median(times) > 30 && median(times) < 50, `median ${median(times)} s`);
    assert.ok(Math.max(...times) < 140, `slowest ${Math.max(...times)} s`);
    // the room without fire came first in about half of them
    const through = RANDOM.filter(otherRoomFirst).length;
    assert.ok(through >= 100 && through <= 200, `${through} mazes with the other room first`);
    // the robot touched the walls of a corner in the mazes with the fire in a corner, and nothing in the others
    const corners = RANDOM.filter((s) => s.fireSpot === 'corner').length;
    assert.ok(corners >= 80, `${corners} mazes with the fire in a corner`);
    assert.equal(runs.filter((played) => played.touched).length, corners);
  });

  test('120 mazes with one way only (the longest ways), the fire once in each room: 100 points', (t) => {
    const times = PERFECT.map((s) => check(s).sim.world.time);
    t.diagnostic(`120 one-way mazes: 120 of 120 complete with 100 points, median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
    assert.ok(Math.max(...times) < 140, `slowest ${Math.max(...times)} s`);
  });

  test('120 mazes no generator draws - closed-off cells, loose walls, up to 25 walls: 100 points', (t) => {
    const times = ODD.map((s) => check(s).sim.world.time);
    t.diagnostic(`120 odd mazes: 120 of 120 complete with 100 points, median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
  });

  test('the slowest kind of maze (42 cells and 84 quarter turns before the fire room): 100 points after 134 seconds, as the description says', () => {
    const s = decodeScenario(SLOWEST_MAZE);
    assert.ok(s);
    const way = handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom);
    assert.equal(way.length, 42);
    assert.equal(otherRoomFirst(s), true, 'and the room without fire is on the way');
    const times = FIRE_SPOTS.map((fireSpot) => check({ ...s, fireSpot }).sim.world.time);
    for (const time of times) assert.ok(time > 131 && time < 135, `${time} s`);
    assert.ok(told, 'the description names the two times');
    assert.equal(Number(told[2]), Math.ceil(Math.max(...times)), `the slowest of the three places: ${Math.max(...times)} s`);
    // no maze of these tests is slower
    for (const other of [...ALL_MAZES, ...PERFECT, ...ODD]) {
      assert.ok(handOnTheWall(other, 'left', (cell) => roomOf(cell) === other.fireRoom).length <= 42, label(other));
    }
  });

  test('the description counts the mazes of these tests, and they have the fire at each of its six places', () => {
    // "... in all 570 mazes it was tested on ...": the named mazes with the fire at every place
    // (the default maze is one of them), the random ones, the ones with one way only and the odd ones
    const tested = [...NAMED_PLACES, ...RANDOM, ...PERFECT, ...ODD];
    assert.ok(counted);
    assert.equal(Number(counted[1]), tested.length);
    assert.equal(new Set(tested.map(encodeScenario)).size, tested.length, 'no maze twice');
    assert.ok(tested.some((s) => encodeScenario(s) === encodeScenario(defaultScenario())));
    for (const set of [NAMED_PLACES, RANDOM, PERFECT, ODD]) {
      for (const { room, spot } of PLACES) {
        assert.ok(set.some((s) => s.fireRoom === room && s.fireSpot === spot), `${room} ${spot}`);
      }
    }
    // and the robot comes into the fire room in each of the four ways there are - the living room
    // facing up or left, the bedroom facing up or right - with the fire at each of the three places
    const ways = new Set(
      tested.map((s) => `${s.fireRoom} ${lastOf(handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom)).dir} ${s.fireSpot}`),
    );
    assert.equal(ways.size, 12, [...ways].sort().join(' | '));
  });

  test('the right hand, as the description suggests to try: 100 points as well, faster in some mazes and slower in others', () => {
    const swapped = withTheOtherHand(blocks, 'turn left');
    let faster = 0;
    let slower = 0;
    for (const s of [defaultScenario(), ...RANDOM.slice(0, 60)]) {
      const right = play(swapped, s);
      assert.deepEqual(right.sim.vm.errors(), [], label(s));
      assert.equal(right.sim.finishReason, 'mission-complete', label(s));
      assert.deepEqual(points(right.sim), [10, 20, 30, 40], label(s));
      assert.equal(right.sawRed, true, label(s));
      assert.equal(right.maxShift, 0, label(s));
      assert.equal(right.touched, s.fireSpot === 'corner', label(s));
      const left = play(blocks, s).sim.world.time;
      if (right.sim.world.time < left) faster++;
      if (right.sim.world.time > left) slower++;
    }
    assert.ok(faster >= 10 && slower >= 10, `the right hand is faster in ${faster} mazes and slower in ${slower}`);
  });

  test('the fan blows a little longer than the 3 seconds of the rules, from the port of the fan, and only after red', () => {
    assert.ok(FAN_SECONDS > 3 && FAN_SECONDS <= 4);
    const fanBlock = blocksOf(blocks).find((block) => block.type === 'mbot2_dc_motor_power');
    assert.equal(fanBlock?.fields?.PORT, FAN.port);
    assert.equal(blocksOf(blocks).find((block) => block.type === 'mbot2_dc_motor_stop')?.fields?.PORT, FAN.port);
    assert.equal(WALL_NEAR_CM, 20);
    // in each of the three programs that use the fan, the one "fan on" block sits inside "if the colour sensor detects red"
    for (const id of ['chief-flame-fan', 'chief-face-flame', 'chief-full-mission']) {
      const all = blocksOf(sample(id).program);
      const guarded = all.filter((block) => block.type === 'control_if_else' && block.inputs?.CONDITION?.block?.type === 'sensing_colorsensor_color_is');
      assert.equal(guarded.length, 1, id);
      const inside = blocksOf({ blocks: { blocks: [guarded[0].inputs!.SUBSTACK!.block!] } });
      assert.equal(all.filter((block) => block.type === 'mbot2_dc_motor_power').length, 1, id);
      assert.ok(inside.some((block) => block.type === 'mbot2_dc_motor_power'), id);
    }
  });

  test('a target that does not read red: the robot leaves the fan off and says so', () => {
    const played = play(blocks, defaultScenario(), undefined, GREY_TARGET_GAME);
    assert.deepEqual(played.sim.vm.errors(), []);
    assert.deepEqual(screen(played.sim), ['Not red: no fan']);
    assert.equal(played.fanSeconds, 0);
    assert.deepEqual(points(played.sim), [10, 20, 0, 0]);
    assert.equal(played.sim.finishReason, 'program-ended');
  });

  test('with the one restart of the rules the program begins again at START and still completes the mission', () => {
    // (the restart clears the points and the clock keeps running; the program must not rely on what it knew before)
    /** The robot is in the middle of "look for the fire": it faces a corner, half a quarter turn off the grid. */
    const lookingIntoACorner = (sim: Sim): boolean => {
      const offGrid = Math.abs(wrapAngle(sim.world.robot.pose.heading * 4)) / 4 / DEG;
      return sim.world.robot.pose.y < ROOM_ROW_BOTTOM && Math.abs(offGrid - 45) < 1 && sim.world.robot.left.rpm === 0;
    };
    const cases: Array<[FireChiefScenario, (sim: Sim) => boolean]> = [
      // on the way, after 20 seconds
      [defaultScenario(), (sim) => sim.world.time >= 20],
      // in the room without fire, while it looks into the corner: the robot is taken away half turned
      [NAMED_MAZES.find((maze) => maze.id === 'two-doors')!.scenario, lookingIntoACorner],
    ];
    for (const [s, now] of cases) {
      const sim = createSimulation({ game: fireChiefGame, scenario: s, program: blocks });
      sim.start();
      while (sim.status === 'running' && !now(sim)) sim.step(1);
      assert.equal(sim.status, 'running', label(s));
      const restartAt = sim.world.time;
      const before = sim.score().total;
      sim.restart();
      assert.equal(sim.score().total, 0, 'the points are cleared');
      let touched = false;
      while (sim.status === 'running') {
        sim.step(1);
        if (sim.world.robot.touching) touched = true;
      }
      assert.ok(before >= 10, `${label(s)}: ${before} points before the restart`);
      assert.equal(sim.restarts, 1, label(s));
      assert.equal(sim.finishReason, 'mission-complete', label(s));
      assert.deepEqual(points(sim), [10, 20, 30, 40], label(s));
      assert.equal(touched, s.fireSpot === 'corner', label(s));
      // the whole way a second time: the time of the first try is lost, no more
      const alone = play(blocks, s).sim.world.time;
      assert.ok(Math.abs(sim.world.time - (restartAt + alone)) < 0.05, `${sim.world.time} s, alone ${alone} s after ${restartAt} s`);
    }
  });

  test('the same maze twice plays the same match, tick for tick', () => {
    const s = RANDOM[7];
    const first = play(blocks, s);
    const second = play(blocks, s);
    assert.equal(second.sim.world.tick, first.sim.world.tick);
    assert.deepEqual(second.sim.world.robot.pose, first.sim.world.robot.pose);
    assert.deepEqual(second.events, first.events);
  });
});

// =============================================================================================
// In the block editor
// =============================================================================================

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly. */
async function loadBlocklyWithDom(): Promise<BlocklyApi> {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> } };
  const dom = new JSDOM('<!DOCTYPE html><div id="editor" style="width: 900px; height: 600px"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'DOMParser', 'XMLSerializer',
    'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']; // prettier-ignore
  // jsdom has no canvas; Blockly only uses it to measure how wide a text is
  const canvas = dom.window.HTMLCanvasElement as { prototype: { getContext: unknown } };
  canvas.prototype.getContext = () => ({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) });
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return (await import('blockly')) as unknown as BlocklyApi;
}

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(new URL('../ui/CyberPiPanel.tsx', import.meta.url), 'utf8'))?.[1]);

  /** One slot of a block: the text written into it, or the block that is plugged into it. */
  type Slot = { shadow?: BlockJson; block?: BlockJson } | undefined;

  /**
   * The longest text a slot can give, in characters: the written text, the two halves of a
   * "join" together - or, for a value that is measured or counted, the longest number it can
   * be: "123.4" for the ultrasonic sensor (up to 300 cm, one decimal), three digits for a variable.
   */
  function longest(slot: Slot, where: string): number {
    const block = slot?.block;
    if (!block) return String(slot?.shadow?.fields?.TEXT ?? '').length;
    if (block.type === 'operator_join') return longest(block.inputs?.STRING1, where) + longest(block.inputs?.STRING2, where);
    if (block.type === 'sensing_ultrasonic_distance') return 5;
    if (block.type === 'data_variable') return 3;
    assert.fail(`${where}: this test does not know how long the value of a "${block.type}" block can be`);
  }

  test('every text an example prints fits on one row of the CyberPi screen: no word and no number is cut in two', () => {
    assert.equal(columns, 18, 'the CyberPi screen of the simulator is 18 characters wide');
    let seen = 0;
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        if (block.type !== 'cyberpi_print') continue;
        const length = longest(block.inputs?.TEXT, s.id);
        assert.ok(length > 0, `${s.id}: a print block has a text`);
        assert.ok(length <= columns, `${s.id}: a print block shows up to ${length} characters - more than one row of the screen (${columns}): ${JSON.stringify(block.inputs?.TEXT).slice(0, 200)}`);
        seen++;
      }
    }
    assert.equal(seen, 12, 'every print block of the six examples was looked at');
  });

  test('the first starter shows the distance on one row: "Wall, cm: 7.5"', () => {
    const { sim } = play(sample('chief-first-wall').program, defaultScenario());
    const lines = sim.world.robot.screen.lines;
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^Wall, cm: \d+(\.\d)?$/);
    assert.ok(lines[0].length <= columns, `"${lines[0]}" fits one row`);
  });
});

describe('the examples in the block editor', () => {
  test('every example loads into the Fire Chief editor, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: fireChiefGame.id });
    for (const s of SAMPLE_PROGRAMS) {
      workspace.clear();
      Blockly.serialization.workspaces.load(s.program as never, workspace);
      const drawn = workspace.getAllBlocks(false);
      assert.ok(drawn.length >= 10, `${s.id}: ${drawn.length} blocks drawn`);
      for (const block of drawn) assert.ok(supportsBlock(block.type), `${s.id}: ${block.type}`);

      // tidy on the workspace: the start script is the leftmost stack, and no stack lies on top of another
      const stacks = workspace.getTopBlocks(false).map((block) => ({ type: block.type, box: block.getBoundingRectangle() }));
      const leftmost = stacks.reduce((a, b) => (b.box.left < a.box.left ? b : a));
      assert.equal(leftmost.type, 'event_cyberpi_start', `${s.id}: "when CyberPi starts up" comes first`);
      for (let i = 0; i < stacks.length; i++) {
        for (let j = i + 1; j < stacks.length; j++) {
          const a = stacks[i].box;
          const b = stacks[j].box;
          const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          assert.ok(apart, `${s.id}: ${stacks[i].type} and ${stacks[j].type} overlap`);
        }
      }
      // the explanations ("?" icons) arrive in the editor, and each one is short
      const notes = drawn.map((block) => block.getCommentText() ?? '').filter((text) => text !== '');
      assert.ok(notes.length >= 3, `${s.id}: has notes`);
      for (const text of notes) assert.ok(text.length <= 220, `${s.id}: a note is short ("${text}")`);

      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      for (const scenario of [defaultScenario(), RANDOM[0], RANDOM[1]]) {
        const fromBuilder = runMatch({ game: fireChiefGame, scenario, program: s.program });
        const fromEditor = runMatch({ game: fireChiefGame, scenario, program: saved });
        assert.deepEqual(fromEditor, fromBuilder, s.id);
        assert.equal(fromEditor.errors, undefined, s.id);
      }
    }
    workspace.dispose();
  });
});

// =============================================================================================
// On the real mat picture
// =============================================================================================

/**
 * In the browser the floor sensors look at the real picture of the mat (mat-sensor.webp), not at
 * the simple drawing the other tests use. The picture is decoded here with "sharp", which comes
 * along with Next.js; without it these tests are skipped.
 */
async function loadMatPicture(): Promise<MatSampler | null> {
  interface Decoded {
    data: Uint8Array;
    info: { width: number; height: number };
  }
  type Sharp = (file: string) => {
    ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<Decoded> } };
  };
  try {
    const sharp = createRequire(import.meta.url)('sharp') as Sharp;
    const file = fileURLToPath(new URL(`../../../public${fireChiefGame.mat.sensorImageUrl}`, import.meta.url));
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, FIELD_SIZE, FIELD_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

describe('the examples on the real mat picture', () => {
  const picture = loadMatPicture();

  test('every example scores on the picture what it scores on the drawing (default maze)', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const s of SAMPLE_PROGRAMS) {
      const onDrawing = play(s.program, defaultScenario());
      const onPicture = play(s.program, defaultScenario(), mat);
      assert.deepEqual(onPicture.sim.vm.errors(), [], s.id);
      assert.equal(onPicture.sim.score().total, onDrawing.sim.score().total, s.id);
      assert.equal(onPicture.sim.finishReason, onDrawing.sim.finishReason, s.id);
      // (in the default maze the fire stands in a corner: the two programs that read red touch its walls, on the picture as on the drawing)
      assert.equal(onPicture.touchTicks, onDrawing.touchTicks, s.id);
      assert.equal(onPicture.touched, s.id === 'chief-face-flame' || s.id === 'chief-full-mission', s.id);
      assert.equal(onPicture.maxShift, 0, s.id);
      const a = onPicture.sim.world.robot.pose;
      const b = onDrawing.sim.world.robot.pose;
      // only the line counter looks at the floor: every other example ends in exactly the same place
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(apart <= (s.id === 'chief-count-lines' ? 3 : 0), `${s.id}: ${apart.toFixed(2)} mm apart`);
    }
  });

  test('the line counter counts the same cells on the picture: it never looks down inside START or a room', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const blocks = sample('chief-count-lines').program;
    let counted = 0;
    for (const s of [...NAMED, ...RANDOM.slice(0, 100)]) {
      const onDrawing = play(blocks, s);
      const onPicture = play(blocks, s, mat);
      const what = label(s);
      assert.equal(onPicture.sim.vm.variables().cells, onDrawing.sim.vm.variables().cells, what);
      assert.equal(cellName(cellOf(onPicture.sim)), cellName(cellOf(onDrawing.sim)), what);
      assert.ok(offCentre(onPicture.sim, cellOf(onDrawing.sim)) < 4, `${what}: ${offCentre(onPicture.sim, cellOf(onDrawing.sim)).toFixed(1)} mm from the middle`);
      assert.equal(onPicture.sim.score().total, 10, what);
      assert.equal(onPicture.touched, false, what);
      counted += onPicture.sim.vm.variables().cells as number;
    }
    assert.ok(counted > 60, `${counted} cells counted on the picture`);
  });

  test('the speed of the line counter is the same on the picture: nothing missed up to 170 RPM, a line now and then at 180 RPM', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const rpm of [LINE_COUNTER_RPM, 120, 170]) {
      assert.deepEqual(linesMissed(rpm, 100, mat), { missed: 0, extra: 0 }, `${rpm} RPM`);
    }
    const full = linesMissed(180, 400, mat);
    assert.ok(full.missed > 0 && full.missed < 20, `180 RPM: ${full.missed} of 1200 crossings missed`);
  });
});
