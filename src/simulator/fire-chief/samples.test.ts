/**
 * The example programs of Fire Chief (samples.ts), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine (walls, sensors)  ->  Fire Chief referee
 *
 * Every example is played on the default maze, on the five named mazes and on 300 random mazes
 * (seeds 1 to 300 of the game's own generator: both rooms, all three spots of the fire, 4 to 16
 * walls), and each test asserts what the description of that example promises - no more, no less.
 * What an example should do in a maze is worked out here a second time, on squared paper so to
 * say (which sides of a cell are open), without the engine: the two must agree.
 *
 * The full mission is also played on the mazes it finds hardest: mazes with one way only
 * ("perfect" mazes), mazes that no generator of the game would draw, and the slowest maze found.
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
import type { BlockJson, MatSampler, ProgramJson, RGB, ScoreLine, SimEvent, Simulation } from '../core/types';
import { SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { supportsBlock } from '../vm';
import {
  FIELD_SIZE,
  FIRE_SPOTS,
  MAT_VECTOR,
  ROOMS,
  ROOM_IDS,
  START_CELL,
  cellAt,
  cellCenter,
  cellName,
  isCell,
  sameCell,
  type Cell,
  type RoomId,
} from './field';
import { MATCH_DURATION, fireChiefGame, hasLeftStart, roomAround, targetOf, targetShift } from './game';
import { FAN, FLAME_SENSOR, START_POSE } from './robot';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import {
  AFTER_LINE_CM,
  FAN_SECONDS,
  FIRST_WALL_STOP_CM,
  FLAME_SEEN,
  LINE_COUNTER_CELLS,
  SAMPLE_PROGRAMS,
  WALL_NEAR_CM,
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
  perfectMazeWalls,
  randomScenario,
  wallBetweenCells,
  wallCount,
  type FireChiefScenario,
} from './scenario';

type Sim = Simulation<FireChiefScenario>;

// =============================================================================================
// The mazes
// =============================================================================================

const RANDOM_MAZES = 300;

/** The 300 random mazes every example is played on: seeds 1 to 300 of the game's own generator. */
const RANDOM: FireChiefScenario[] = Array.from({ length: RANDOM_MAZES }, (_, i) => randomScenario(makeRng(i + 1)));

/** The default maze and the five named ones. */
const NAMED: FireChiefScenario[] = [defaultScenario(), ...NAMED_MAZES.map((maze) => maze.scenario)];

const ALL_MAZES: FireChiefScenario[] = [...NAMED, ...RANDOM];

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
 * The slowest kind of maze for the full mission: one way only, and the left hand reaches the
 * fire room after 42 cells and 84 quarter turns - no maze of 300 000 one-way mazes needed more.
 */
const SLOWEST_MAZE = 'BC-B9CG-2CPC';

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

/** Where a robot with a hand on the wall is after each cell it has driven, from START to the first room. */
function handOnTheWall(s: FireChiefScenario, hand: 'left' | 'right', until: (cell: Cell) => boolean = (cell) => roomOf(cell) !== null): Cell[] {
  const towards = hand === 'left' ? 3 : 1;
  const away = hand === 'left' ? 1 : 3;
  let cell: Cell = { ...START_CELL };
  let dir = 0;
  const way: Cell[] = [];
  while (way.length < 200) {
    dir = (dir + towards) % 4;
    for (let look = 0; look < 3 && !isOpen(s, cell, dir); look++) dir = (dir + away) % 4;
    cell = next(cell, dir);
    way.push(cell);
    if (until(cell)) return way;
  }
  throw new Error('the hand on the wall never arrives');
}

const lastOf = <T>(list: readonly T[]): T => list[list.length - 1];

// =============================================================================================
// Playing an example
// =============================================================================================

interface Played {
  sim: Sim;
  events: SimEvent[];
  /** the robot pressed against something at some moment */
  touched: boolean;
  /** highest flame value the sensor read during the match */
  maxFlame: number;
  /** seconds the fan was blowing */
  fanSeconds: number;
  /** all five LEDs were red at some moment */
  ledsWereRed: boolean;
}

const RED: RGB = { r: 255, g: 0, b: 0 };
const GREEN: RGB = { r: 0, g: 255, b: 0 };
const BLUE: RGB = { r: 0, g: 0, b: 255 };
const OFF: RGB = { r: 0, g: 0, b: 0 };

const ledsAre = (sim: Sim, colour: RGB): boolean => sim.world.robot.leds.every((led) => led.r === colour.r && led.g === colour.g && led.b === colour.b);

function sample(id: string): SampleProgram {
  const found = getSampleProgram(id);
  assert.ok(found, `example "${id}" exists`);
  return found;
}

/** Play a program from the start signal to the end of the attempt, looking at the robot after every tick. */
function play(blocks: ProgramJson, scenario: FireChiefScenario, sampler?: MatSampler): Played {
  const sim = createSimulation({ game: fireChiefGame, scenario, program: blocks, sampler });
  const played: Played = { sim, events: [], touched: false, maxFlame: 0, fanSeconds: 0, ledsWereRed: false };
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    const robot = sim.world.robot;
    if (robot.touching) played.touched = true;
    if (robot.fanOn) played.fanSeconds += sim.dt;
    if ((robot.lastFlame ?? 0) > played.maxFlame) played.maxFlame = robot.lastFlame ?? 0;
    if (ledsAre(sim, RED)) played.ledsWereRed = true;
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

/** Degrees between the way the robot faces and the direction from its turning point to the fire target. */
function aimErrorDeg(sim: Sim): number {
  const target = targetOf(sim.world);
  assert.ok(target, 'the fire target is on the field');
  const pose = sim.world.robot.pose;
  return Math.abs(wrapAngle(Math.atan2(target.x - pose.x, pose.y - target.y) - pose.heading)) / DEG;
}

/** What every example promises: the program has no fault, and the robot touched neither a wall nor the fire target. */
function assertCleanRun(played: Played, what: string): void {
  const { sim } = played;
  assert.deepEqual(sim.vm.errors(), [], `${what}: the interpreter found no problem`);
  assert.deepEqual(problems(played), [], `${what}: no warning`);
  assert.equal(played.touched, false, `${what}: the robot touched nothing`);
  assert.deepEqual(bumps(played), [], `${what}: no bump`);
  const target = targetOf(sim.world);
  assert.ok(target);
  assert.equal(targetShift(target), 0, `${what}: the fire target stands where it stood`);
  assert.ok(sim.world.time < MATCH_DURATION, `${what}: over before the 180 seconds`);
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
      assert.ok(s.description.length >= 250 && s.description.length <= 850, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
    }
    for (const id of ['chief-first-wall', 'chief-count-lines', 'chief-flame-fan', 'chief-wall-follow', 'chief-face-flame']) {
      assert.match(sample(id).description, /\bTry\b/, `${id} says what to try next`);
    }
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

  test('no file of the simulator or of the website imports them (only the tests do, until the server hands them out)', () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files].filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, ''))).map(([file]) => file);
    assert.deepEqual(importers(CATALOG), [SAMPLES]);
    assert.deepEqual(importers(SAMPLES), []);
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
    assert.ok(uses('chief-first-wall').has('sensing_ultrasonic_distance'));
    assert.ok(uses('chief-count-lines').has('sensing_quadrgb_probe_detects'));
    for (const type of ['sensing_flame_detected', 'sensing_flame_size', 'mbot2_dc_motor_power', 'mbot2_dc_motor_stop', 'cyberpi_rotation_z']) {
      assert.ok(uses('chief-flame-fan').has(type), type);
    }
    assert.ok(uses('chief-wall-follow').has('sensing_ultrasonic_distance') && !uses('chief-wall-follow').has('sensing_flame_size'));
    assert.ok(uses('chief-face-flame').has('sensing_flame_size') && !uses('chief-face-flame').has('mbot2_dc_motor_power'));
    for (const type of ['sensing_ultrasonic_distance', 'sensing_flame_size', 'mbot2_dc_motor_power', 'cyberpi_rotation_z']) {
      assert.ok(uses('chief-full-mission').has(type), type);
    }
    // a starter program is short; the full mission is the longest
    const size = (id: string): number => blocksOf(sample(id).program).filter((block) => block.type !== 'math_number' && block.type !== 'text').length;
    for (const card of SAMPLE_CATALOG) {
      if (card.level === 'starter') assert.ok(size(card.id) <= 22, `${card.id}: ${size(card.id)} blocks`);
      assert.ok(size(card.id) <= size('chief-full-mission'), card.id);
    }
  });
});

// =============================================================================================
// The mazes of these tests
// =============================================================================================

test('the 300 random mazes can all be played and cover both rooms, the three spots and 4 to 16 walls', () => {
  assert.equal(RANDOM.length, 300);
  for (const s of [...ALL_MAZES, ...PERFECT, ...ODD]) assert.ok(isValidScenario(s), label(s));
  assert.equal(new Set(RANDOM.map(encodeScenario)).size, 300, 'no maze twice');
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const count = RANDOM.filter((s) => s.fireRoom === room && s.fireSpot === spot).length;
      assert.ok(count >= 30, `${count} mazes with the fire in the ${room}, ${spot}`);
    }
  }
  const counts = new Set(RANDOM.map(wallCount));
  for (let walls = 4; walls <= PERFECT_MAZE_WALLS; walls++) assert.ok(counts.has(walls), `a maze with ${walls} walls`);
  // START is closed upwards in some of them, and to the left and right in others
  for (const dir of [0, 1, 3]) assert.ok(RANDOM.filter((s) => freeWayOutOfStart(s) === dir).length >= 10, `way out ${dir}`);
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
    assert.deepEqual(screen(sim), ['To the first wall', `Wall ahead, cm: ${Math.round(gap * 10) / 10}`], what);
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

  test('named mazes and 300 random mazes: 10 points in every one, the robot never touches a wall', () => {
    for (const s of ALL_MAZES) check(s);
  });

  test('a wall right in front of START: the robot turns to the free way first', () => {
    const closed = RANDOM.filter((s) => !isOpen(s, START_CELL, 0));
    assert.ok(closed.length >= 30, `${closed.length} mazes with START closed upwards`);
    for (const s of closed.slice(0, 5)) {
      const { sim } = check(s);
      assert.ok(cellOf(sim).row === START_CELL.row && cellOf(sim).col !== START_CELL.col, 'it left START sideways');
    }
  });
});

// =============================================================================================
// 2. chief-count-lines
// =============================================================================================

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

  test('named mazes and 300 random mazes: 10 points in every one; it stops counting where a wall closes the way', () => {
    const counted = [0, 0, 0];
    for (const s of ALL_MAZES) counted[check(s).sim.vm.variables().cells as number]++;
    // all three endings happen: no cell (a wall at once), one cell, two cells
    for (const [cells, mazes] of counted.entries()) assert.ok(mazes >= 20, `${mazes} mazes with ${cells} cells counted`);
  });
});

// =============================================================================================
// 3. chief-flame-fan
// =============================================================================================

describe('chief-flame-fan: a first look at the flame sensor and the fan', () => {
  const blocks = sample('chief-flame-fan').program;

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    // it stands where it stood, after one full turn (it overshoots by a degree or two while it stops)
    assert.ok(offCentre(sim, START_CELL) < 0.01, what);
    assert.ok(sim.readSensors().yawDeg > 360 && sim.readSensors().yawDeg < 363, `${what}: turned ${sim.readSensors().yawDeg} degrees`);
    // the fan blew for one second
    assert.ok(Math.abs(played.fanSeconds - 1) < 0.02, `${what}: fan on for ${played.fanSeconds} s`);
    assert.equal(sim.readSensors().fanOn, false, what);
    // in START the sensor sees no flame: the value on the screen is 0 and the LEDs were never red
    assert.equal(played.maxFlame, 0, what);
    assert.deepEqual(sim.world.robot.screen.labels, [{ text: 'flame 0', x: 0, y: 0, size: 16 }], what);
    assert.equal(played.ledsWereRed, false, what);
    assert.ok(ledsAre(sim, OFF), what);
    assert.deepEqual(screen(sim), ['Done'], what);
    // no points: it has not left START, and a fan that blows at nothing does not count
    assert.deepEqual(points(sim), [0, 0, 0, 0], what);
    assert.equal(sim.score().total, 0, what);
    return played;
  }

  test('default maze: one turn on the spot, flame value 0, fan for one second, no points', () => {
    const { sim } = check(defaultScenario());
    assert.ok(sim.world.time > 6 && sim.world.time < 7, `${sim.world.time} s`);
  });

  test('named mazes and 300 random mazes: the same everywhere - START is too far from the fire', () => {
    for (const s of ALL_MAZES) check(s);
    // why: the sensor sees one metre, and no place of the target is nearer to START than that
    assert.equal(FLAME_SENSOR.rangeMm, 1000);
    for (const s of NAMED) {
      const target = targetOf(play({}, s).sim.world)!;
      assert.ok(Math.hypot(target.x - START_POSE.x, target.y - START_POSE.y) - FLAME_SENSOR.forward > FLAME_SENSOR.rangeMm);
    }
  });

  test('the same blocks next to the fire: the value goes up and the LEDs turn red', () => {
    // (what the description suggests to try: driving blocks in front - here the way of the open field into the living room)
    const s = NAMED_MAZES.find((maze) => maze.id === 'open')!.scenario;
    const original = sample('chief-flame-fan').program.blocks!.blocks![0];
    const inFront: ProgramJson = JSON.parse(JSON.stringify(sample('chief-flame-fan').program)) as ProgramJson;
    const hat = inFront.blocks!.blocks![0];
    const drive = (id: string, type: string, fields: Record<string, string>, slot: string, value: number, then: BlockJson | undefined): BlockJson => ({
      type,
      id,
      fields,
      inputs: { [slot]: { shadow: { type: 'math_number', id: `${id}n`, fields: { NUM: value } } } },
      next: then ? { block: then } : undefined,
    });
    hat.next = {
      block: drive('d1', 'mbot2_straight_cm', { DIRECTION: 'forward' }, 'DISTANCE', 120, drive('d2', 'mbot2_turn_deg', { DIRECTION: 'left' }, 'ANGLE', 90, drive('d3', 'mbot2_straight_cm', { DIRECTION: 'forward' }, 'DISTANCE', 60, original.next!.block))),
    };
    const played = play(inFront, s);
    assert.deepEqual(played.sim.vm.errors(), []);
    assert.equal(roomAround(played.sim.robotShapes()), 'living');
    assert.ok(played.maxFlame > 80, `flame value up to ${played.maxFlame}`);
    assert.equal(played.ledsWereRed, true);
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
    assert.equal(handOnTheWall(s, 'right').length, 13, 'thirteen cells along the wall');
    assert.ok(sim.world.time > 30 && sim.world.time < 40, `${sim.world.time} s`);
  });

  test('named mazes and 300 random mazes: 30 points in every one, in the room the right hand reaches first', () => {
    const rooms = { living: 0, bedroom: 0 };
    const times: number[] = [];
    for (const s of ALL_MAZES) {
      const { sim } = check(s);
      rooms[roomAround(sim.robotShapes())!]++;
      times.push(sim.world.time);
    }
    assert.ok(rooms.living >= 10 && rooms.bedroom >= 100, `living room ${rooms.living}, bedroom ${rooms.bedroom}`);
    assert.ok(Math.max(...times) < 110, `slowest ${Math.max(...times)} s`);
  });

  test('it walks into the fire room without touching the target, wherever the target stands', () => {
    const fireFirst = RANDOM.filter((s) => roomOf(lastOf(handOnTheWall(s, 'right'))) === s.fireRoom);
    for (const spot of FIRE_SPOTS) assert.ok(fireFirst.some((s) => s.fireSpot === spot), spot);
    // (check() has asserted for each of them that nothing was touched and the target did not move)
    assert.ok(fireFirst.length >= 100, `${fireFirst.length} mazes where the first room is the fire room`);
  });
});

// =============================================================================================
// 5. chief-face-flame
// =============================================================================================

describe('chief-face-flame: find the flame and turn to face it', () => {
  const blocks = sample('chief-face-flame').program;

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    const room = roomOf(lastOf(handOnTheWall(s, 'left')));
    assert.ok(room);
    assertCleanRun(played, what);
    assert.equal(sim.finishReason, 'program-ended', what);
    assert.equal(roomAround(sim.robotShapes()), room, `${what}: the room the left hand leads to first`);
    assert.ok(offCentre(sim, ROOMS[room].cell) < 0.1, what);
    assert.deepEqual(points(sim), [10, 20, 0, 0], what);
    assert.equal(played.fanSeconds, 0, what);
    const best = sim.vm.variables().best as number;
    if (room === s.fireRoom) {
      // the fire is here: the robot faces the target, LEDs red
      assert.ok(best > 80 && best === played.maxFlame, `${what}: highest flame value ${best}`);
      assert.ok(aimErrorDeg(sim) < 1, `${what}: ${aimErrorDeg(sim).toFixed(2)} degrees off the target`);
      assert.ok(ledsAre(sim, RED), what);
      assert.deepEqual(screen(sim), [`Fire! Flame value ${best}`], what);
      assert.ok(sim.readSensors().flame > 80, `${what}: the sensor looks at the flame`);
    } else {
      // the fire is in the other room, more than a metre away: no flame, LEDs blue
      assert.equal(best, 0, what);
      assert.equal(played.maxFlame, 0, what);
      assert.ok(ledsAre(sim, BLUE), what);
      assert.deepEqual(screen(sim), ['No fire in this room'], what);
    }
    return played;
  }

  test('default maze: the left hand leads to the living room; the robot ends facing the fire in its corner', () => {
    const s = defaultScenario();
    const { sim } = check(s);
    assert.equal(roomAround(sim.robotShapes()), 'living');
    assert.ok(ledsAre(sim, RED));
    // the corner target is up and to the left: the robot faces north-west
    assert.ok(Math.abs(sim.world.robot.pose.heading / DEG + 45) < 1, `heading ${sim.world.robot.pose.heading / DEG}`);
    assert.ok(sim.world.time > 30 && sim.world.time < 40, `${sim.world.time} s`);
  });

  test('named mazes and 300 random mazes: 30 points in every one; it faces the fire whenever the fire is in that room', () => {
    let faced = 0;
    let empty = 0;
    const spots = new Set<string>();
    for (const s of ALL_MAZES) {
      const { sim } = check(s);
      if (ledsAre(sim, RED)) {
        faced++;
        spots.add(`${s.fireRoom} ${s.fireSpot}`);
      } else empty++;
    }
    assert.ok(faced >= 100 && empty >= 100, `faced the fire in ${faced} mazes, found the room empty in ${empty}`);
    assert.equal(spots.size, 6, 'both rooms, all three spots');
    assert.equal(FLAME_SEEN, FLAME_SENSOR.threshold, 'the program uses the threshold of the "detects flame?" block');
  });
});

// =============================================================================================
// 6. chief-full-mission
// =============================================================================================

describe('chief-full-mission: the whole mission on any maze', () => {
  const blocks = sample('chief-full-mission').program;

  function check(s: FireChiefScenario): Played {
    const what = label(s);
    const played = play(blocks, s);
    const { sim } = played;
    assertCleanRun(played, what);
    // 100 points, and the referee ends the attempt: mission complete
    assert.deepEqual(points(sim), [10, 20, 30, 40], what);
    assert.equal(sim.finishReason, 'mission-complete', what);
    assert.equal(sim.score().complete, true, what);
    // it stands in the middle of the fire room and faces the target
    assert.equal(roomAround(sim.robotShapes()), s.fireRoom, what);
    assert.ok(offCentre(sim, ROOMS[s.fireRoom].cell) < 1, `${what}: ${offCentre(sim, ROOMS[s.fireRoom].cell).toFixed(2)} mm from the middle`);
    assert.ok(aimErrorDeg(sim) < 1, `${what}: ${aimErrorDeg(sim).toFixed(2)} degrees off the target`);
    // three seconds of fan, started while standing still
    const fan = lineOf(sim, 'fan-start');
    const done = lineOf(sim, 'fan-complete');
    assert.ok(Math.abs(done.time! - fan.time! - 3) < 0.011, what);
    assert.ok(Math.abs(played.fanSeconds - 3) < 0.03, `${what}: fan on for ${played.fanSeconds} s`);
    assert.equal(sim.score().time, done.time, what);
    // the room without fire, if the way led through it first, was looked at once and found empty
    const emptyFirst = handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom).some((cell) => roomOf(cell) !== null && roomOf(cell) !== s.fireRoom);
    assert.deepEqual(screen(sim), emptyFirst ? ['No fire here'] : [], what);
    return played;
  }

  test('default maze: 100 points in under 40 seconds', () => {
    const { sim } = check(defaultScenario());
    assert.ok(sim.world.time > 35 && sim.world.time < 40, `${sim.world.time} s`);
    assert.equal(sim.restarts, 0);
  });

  test('the five named mazes, from the open field to the maze with one way only: 100 points', () => {
    for (const maze of NAMED_MAZES) check(maze.scenario);
  });

  test('300 random mazes: 100 points in every one, the slowest well inside the 180 seconds', (t) => {
    const times = RANDOM.map((s) => check(s).sim.world.time);
    t.diagnostic(`300 random mazes: 300 complete, median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
    assert.ok(median(times) > 35 && median(times) < 55, `median ${median(times)} s`);
    assert.ok(Math.max(...times) < 145, `slowest ${Math.max(...times)} s`);
  });

  test('120 mazes with one way only (the longest ways), the fire once in each room: 100 points', (t) => {
    const times = PERFECT.map((s) => check(s).sim.world.time);
    t.diagnostic(`120 one-way mazes: 120 complete, median ${median(times).toFixed(1)} s, slowest ${Math.max(...times).toFixed(1)} s`);
    assert.ok(Math.max(...times) < 145, `slowest ${Math.max(...times)} s`);
  });

  test('120 mazes no generator draws - closed-off cells, loose walls, up to 25 walls: 100 points', () => {
    for (const s of ODD) check(s);
  });

  test('the slowest maze found (42 cells and 84 quarter turns before the fire room): 100 points after 140 seconds', () => {
    const s = decodeScenario(SLOWEST_MAZE);
    assert.ok(s);
    const way = handOnTheWall(s, 'left', (cell) => roomOf(cell) === s.fireRoom);
    assert.equal(way.length, 42);
    for (const fireSpot of FIRE_SPOTS) {
      const { sim } = check({ ...s, fireSpot });
      assert.ok(sim.world.time > 138 && sim.world.time < 141, `${fireSpot}: ${sim.world.time} s`);
    }
  });

  test('the fan blows a little longer than the 3 seconds of the rules, from the port of the fan', () => {
    assert.ok(FAN_SECONDS > 3 && FAN_SECONDS <= 4);
    const fanBlock = blocksOf(blocks).find((block) => block.type === 'mbot2_dc_motor_power');
    assert.equal(fanBlock?.fields?.PORT, FAN.port);
    assert.equal(WALL_NEAR_CM, 20);
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
      assert.equal(onPicture.touched, false, s.id);
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
});
