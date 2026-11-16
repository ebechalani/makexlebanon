/**
 * The example programs of Warehouse Sort (samples.ts), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Warehouse Sort referee
 *
 * Every example is played on all 24 arrangements of the cubes (one of them blue in each), on the
 * vector drawing of the mat, and each test asserts what the description of that example promises
 * - no more, no less. The examples are also played on the picture the browser reads (the sensor
 * picture of the mat, decoded with sharp, which comes with Next.js; the test is skipped where
 * sharp is missing).
 *
 * "Nothing is pushed" is checked tick by tick: a cube that is not in the claw never moves, the
 * engine reports no bump, and the robot never presses against anything. The blue cube is watched
 * more closely still: in no example, on no arrangement, does it ever leave its place - not by a
 * step of the engine, not by a turn, not in the claw - and its line on the score sheet says
 * "left alone" (game.ts, Q15).
 *
 * The field is the field as the screen shows it, turned 90 degrees to the right (./field.ts): the
 * robot starts in the middle of the bottom edge, facing up.
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
import { RasterMatSampler } from '../core/mat';
import { createSimulation } from '../core/simulation';
import type { BlockJson, MatSampler, Pose, ProgramJson, ScoreLine, SimEvent, Simulation } from '../core/types';
import { SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { supportsBlock } from '../vm';
import { eq, ifElse, moveCm, program as buildProgram, script, turn, v, whenStart, type BlockNode } from '../vm/builder';
import {
  BAYS,
  CUBE_SIZE,
  FINISH_PADS,
  LONG_LINE_X,
  MAT_SIZE,
  MAT_VECTOR,
  WAREHOUSE_IDS,
  WHITE_LINES,
  type BayColor,
  type WarehouseId,
} from './field';
import {
  LINE_BLUE,
  LINE_LAST_DELIVERY,
  LINE_LEAVE_START,
  LINE_PARK,
  MAX_SCORE,
  cubeBodyId,
  cubeHome,
  deliverLineId,
  pickLineId,
  warehouseSortGame,
} from './game';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from './robot';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import {
  BOTTOM_LINE_Y_CM,
  FIRST_PLACE_Y_CM,
  INTO_BAY_CM,
  LEAVE_CM,
  PARK_LEFT_CM,
  PARK_Y_CM,
  PAST_THE_FRAME_CM,
  PICK_CM,
  PLACE_STEP_CM,
  SAMPLE_PROGRAMS,
  START_Y_CM,
  TOP_LINE_Y_CM,
  TO_BOTTOM_LINE_CM,
  UP_TO_TOP_LINE_CM,
  getSampleProgram,
  type SampleProgram,
} from './samples';
import {
  SCENARIO_COUNT,
  allScenarios,
  blueWarehouse,
  defaultScenario,
  encodeScenario,
  type CubeColor,
  type WarehouseSortScenario,
} from './scenario';

type Sim = Simulation<WarehouseSortScenario>;

/** The folder of this file. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The 24 arrangements, in number order. */
const ARRANGEMENTS: WarehouseSortScenario[] = allScenarios();

/** The middle of the white line across the bottom of the mat, and of the one across the top (y, mm). */
const BOTTOM_LINE_Y = WHITE_LINES.bottomRight.y + WHITE_LINES.bottomRight.h / 2;
const TOP_LINE_Y = WHITE_LINES.topRight.y + WHITE_LINES.topRight.h / 2;

// =============================================================================================
// Playing an example
// =============================================================================================

interface Played {
  sim: Sim;
  scenario: WarehouseSortScenario;
  events: SimEvent[];
  /** cubes that moved while they were not in the claw: "cube:W1 at 12.34" */
  pushed: string[];
  /** ticks in which the robot pressed against something */
  touchTicks: number;
  /** ticks in which the blue cube was not exactly where it stood at the start, or was held */
  blueOutOfPlace: number;
  /** the largest distance (mm) of the robot's middle from the middle of the white line at the bottom, while it was right of x 785 */
  besideTheLine: number;
}

function sample(id: string): SampleProgram {
  const s = getSampleProgram(id);
  assert.ok(s, id);
  return s;
}

/** Play one whole match, tick by tick, and watch the cubes. */
function play(blocks: ProgramJson, scenario: WarehouseSortScenario, options: { sampler?: MatSampler; startPose?: Pose } = {}): Played {
  const sim = createSimulation({ game: warehouseSortGame, scenario, program: blocks, sampler: options.sampler, startPose: options.startPose });
  const events: SimEvent[] = [];
  const pushed: string[] = [];
  const before = new Map<string, { x: number; y: number; angle: number; held: boolean }>();
  for (const b of sim.world.bodies) before.set(b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held });
  const blueId = cubeBodyId(blueWarehouse(scenario) as WarehouseId);
  let touchTicks = 0;
  let blueOutOfPlace = 0;
  let besideTheLine = 0;
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    if (sim.world.robot.touching) touchTicks++;
    const pose = sim.world.robot.pose;
    if (pose.x > 785 && Math.abs(pose.y - BOTTOM_LINE_Y) < 100) besideTheLine = Math.max(besideTheLine, Math.abs(pose.y - BOTTOM_LINE_Y));
    for (const b of sim.world.bodies) {
      const was = before.get(b.id)!;
      const moved = Math.hypot(b.x - was.x, b.y - was.y) > 1e-9 || b.angle !== was.angle;
      if (!b.held && !was.held && moved) pushed.push(`${b.id} at ${sim.world.time.toFixed(2)}`);
      before.set(b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held });
      if (b.id === blueId && (b.held || b.x !== b.home.x || b.y !== b.home.y || b.angle !== b.home.angle || b.z !== 0)) blueOutOfPlace++;
    }
  }
  return { sim, scenario, events, pushed, touchTicks, blueOutOfPlace, besideTheLine };
}

const lineOf = (sim: Sim, id: string): ScoreLine => {
  const line = sim.score().lines.find((l) => l.id === id);
  assert.ok(line, id);
  return line;
};
const screen = (sim: Sim): string[] => sim.world.robot.screen.lines;
const cubeOf = (sim: Sim, w: WarehouseId) => sim.world.bodies.find((b) => b.id === cubeBodyId(w))!;
const label = (s: WarehouseSortScenario): string => encodeScenario(s);

/** The blue cube never left its place, and the score sheet says so: "left alone", 0 points. */
function assertBlueLeftAlone(played: Played, what: string): void {
  assert.equal(played.blueOutOfPlace, 0, `${what}: the blue cube left its place`);
  const blue = lineOf(played.sim, LINE_BLUE);
  assert.equal(blue.points, 0, `${what}: ${blue.detail}`);
  assert.equal(blue.detail, 'left alone', what);
}

/** Nothing went wrong: no error, no warning, nothing pushed, no bump, never pressed against anything - and the blue cube left alone. */
function assertClean(played: Played, what: string): void {
  assert.deepEqual(played.sim.vm.errors(), [], `${what}: errors`);
  const warnings = played.events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));
  assert.deepEqual(warnings, [], `${what}: warnings`);
  assert.deepEqual(played.pushed, [], `${what}: pushed`);
  assert.deepEqual(played.events.filter((e) => e.type === 'bump'), [], `${what}: bumps`);
  assert.equal(played.touchTicks, 0, `${what}: pressed against something`);
  assertBlueLeftAlone(played, what);
}

/** How far (mm) the tips of the fingers are from the near face of a cube straight ahead. */
function fingerTipsToCube(sim: Sim, w: WarehouseId): number {
  const pose = sim.world.robot.pose;
  const cube = cubeOf(sim, w);
  const along = (cube.x - pose.x) * Math.sin(pose.heading) - (cube.y - pose.y) * Math.cos(pose.heading);
  const g = WAREHOUSE_SORT_ROBOT.gripper;
  return along - CUBE_SIZE / 2 - (g.gripForward + g.fingerLength / 2);
}

/** The cube is where it started, and nothing took it (a red or green cube: no points for picking it). */
function assertUntouched(sim: Sim, w: WarehouseId, what: string): void {
  const cube = cubeOf(sim, w);
  const home = cubeHome(w);
  assert.equal(cube.x, home.x, `${what}: ${w} x`);
  assert.equal(cube.y, home.y, `${what}: ${w} y`);
  assert.equal(cube.angle, 0, `${what}: ${w} turned`);
  const pick = sim.score().lines.find((l) => l.id === pickLineId(w));
  // (the blue cube has no "pick up" line: it never scores)
  if (pick) assert.equal(pick.points, 0, `${what}: ${w} not picked`);
}

/** Smallest distance (mm) from the cube to an edge of a bay it is completely inside. */
function marginInBay(sim: Sim, w: WarehouseId, color: CubeColor): number {
  const cube = cubeOf(sim, w);
  const bay = BAYS[color as BayColor];
  const h = CUBE_SIZE / 2;
  return Math.min(cube.x - h - bay.x, bay.x + bay.w - (cube.x + h), cube.y - h - bay.y, bay.y + bay.h - (cube.y + h));
}

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

/** The name of the variable a "data_variable" block reads (the program keeps variables by id). */
function variableName(blocks: ProgramJson, block: BlockJson | undefined): string | undefined {
  if (block?.type !== 'data_variable') return undefined;
  const field = block.fields?.VARIABLE as { id?: string; name?: string } | string | undefined;
  if (typeof field === 'string') return field;
  return field?.name ?? blocks.variables?.find((variable) => variable.id === field?.id)?.name;
}

/** The notes a student reads on the blocks of a program (the comment bubbles). */
function notesOf(blocks: ProgramJson): string[] {
  return blocksOf(blocks)
    .map((block) => (block.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '')
    .filter((text) => text !== '');
}

/** A copy of a program in which `change` has changed something (what a "Try ..." of a description asks for). */
function changed(blocks: ProgramJson, change: (all: BlockJson[]) => void): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  change(blocksOf(copy));
  return copy;
}

/** The blocks of the start script, in order (the top level only). */
function startScript(blocks: ProgramJson): BlockJson[] {
  const start = (blocks.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start');
  assert.ok(start);
  const out: BlockJson[] = [];
  for (let block = start.next?.block; block; block = block.next?.block) out.push(block);
  return out;
}

/**
 * A copy of a program with more blocks at the end of its start script (what a "Try ..." of a
 * description asks a student to add). The new blocks use the variables of the program by name.
 */
function withMoreAtTheEnd(blocks: ProgramJson, more: BlockNode[]): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  const extra = buildProgram([script(whenStart(), more)]);
  const nameOf = new Map((extra.variables ?? []).map((variable) => [variable.id, variable.name]));
  const idOf = new Map((copy.variables ?? []).map((variable) => [variable.name, variable.id]));
  const first = (extra.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start')?.next?.block;
  assert.ok(first);
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    block.id = `try-${block.id}`;
    const field = block.fields?.VARIABLE as { id?: string } | undefined;
    if (field && typeof field === 'object') {
      field.id = idOf.get(nameOf.get(field.id ?? '') ?? '');
      assert.ok(field.id, 'the program has this variable');
    }
    for (const slot of Object.values(block.inputs ?? {})) {
      visit(slot.shadow);
      visit(slot.block);
    }
    visit(block.next?.block);
  };
  visit(first);
  const chain = startScript(copy);
  chain[chain.length - 1].next = { block: first };
  return copy;
}

/** The colour the LEDs light in: "red", "green", "blue", or what the LEDs show. */
function ledsColour(sim: Sim): string {
  const leds = sim.world.robot.leds;
  const named: Record<string, string> = { '255,0,0': 'red', '0,255,0': 'green', '0,0,255': 'blue' };
  const each = leds.map((l) => named[`${l.r},${l.g},${l.b}`] ?? `${l.r},${l.g},${l.b}`);
  assert.ok(each.every((c) => c === each[0]), `all LEDs alike: ${each.join(' ')}`);
  return each[0];
}

// =============================================================================================
// The list
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples: three for starters, two in between, one advanced', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'sort-leave-start starter',
        'sort-white-line starter',
        'sort-cube-colour starter',
        'sort-one-cube intermediate',
        'sort-two-cubes intermediate',
        'sort-all-cubes advanced',
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
    for (const level of EXAMPLE_LEVELS) assert.ok(level.title.length > 3 && level.about.length > 8 && level.about.length < 40, level.id);
  });

  test('every id starts with "sort-", and no id or title is used by an example of the other games', () => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^sort-[a-z]+(-[a-z]+)*$/, card.id);
    for (const card of [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG]) assert.ok(!card.id.startsWith('sort-'), card.id);
    // a beginner reads the titles: short
    for (const card of SAMPLE_CATALOG) assert.ok(card.title.length <= 30, card.title);
  });

  test('every description says, in short plain sentences, what the program does, what it scores and what to try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 650, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.match(s.description, /\bTry\b/, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      // this is the beginner category: shorter sentences than in the other two games (230 there)
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 140, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
      // the most a match can score is 80 now (three cubes are sorted, the blue one is left alone): no text promises more
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= MAX_SCORE, `${s.id}: ${number} points`);
      assert.ok(!/\b(14|100)\b/.test(s.description), `${s.id} still speaks of the field before the blue cube`);
    }
    // the points and the seconds each one promises, as the tests below measure them
    const promised: Record<string, RegExp[]> = {
      'sort-leave-start': [/It scores 10 points on every arrangement of the cubes: 5 for leaving the start zone, and 5 for a clean run \(no restart\)\./, /It ends after 2 seconds\./],
      'sort-white-line': [/It scores 10 points on every arrangement \(leave the start zone, clean run\), after 3 seconds\./, /It does not touch the cube in front of it\./],
      'sort-cube-colour': [/The screen shows the colour of the cube: red, green or blue\./, /It always shows the right colour, on every arrangement\. It does not touch the cube\./, /It scores 10 points \(leave the start zone, clean run\), after 3 seconds\./],
      'sort-one-cube': [/Blue: the robot leaves it where it is and takes the cube at the bottom left instead\./, /It scores 30 points on every arrangement, after 11 to 17 seconds\. It never moves the blue cube\./],
      'sort-two-cubes': [/Blue: it leaves it and takes the cube on the left\./, /It scores 60 points on every arrangement, after 32 to 38 seconds\. It never moves the blue cube\./, /parks on the left finish pad/],
      'sort-all-cubes': [/Blue: it leaves the cube where it is\./, /It scores 80 points on all 24 arrangements, in 53 to 61 of the 90 seconds\. It never moves the blue cube\./, /It never guesses a colour\./],
    };
    for (const s of SAMPLE_PROGRAMS) for (const promise of promised[s.id]) assert.match(s.description, promise, s.id);
    // the lines are white on this mat: the line follower says so, and so does the note on its first block
    assert.match(sample('sort-white-line').description, /Here the lines are WHITE on a black mat\./);
    assert.ok(notesOf(sample('sort-white-line').program).some((text) => /"detects line" means white here/.test(text)));
    // what the colour sensor at the claw sees is the simulator's own number: said with "In this simulator"
    for (const s of SAMPLE_PROGRAMS) {
      for (const text of [s.description, ...notesOf(s.program)]) {
        for (const sentence of text.split(/(?<=[.?!])\s+/)) {
          if (/3\.5 cm/.test(sentence)) assert.match(sentence, /[Ii]n this simulator/, `${s.id}: "${sentence}"`);
        }
      }
    }
    // every example that drives by distance to a cube says on its first block that a real robot drifts
    for (const id of ['sort-cube-colour', 'sort-one-cube', 'sort-two-cubes', 'sort-all-cubes']) {
      assert.ok(notesOf(sample(id).program).some((text) => /A real robot drifts a little/.test(text)), id);
    }
    // the three that take cubes say on a block that they look first
    for (const id of ['sort-one-cube', 'sort-two-cubes', 'sort-all-cubes']) {
      assert.ok(notesOf(sample(id).program).some((text) => /Look first!/.test(text)), id);
    }
    // no description promises a time it does not keep within the 90 seconds of a match
    assert.equal(warehouseSortGame.matchDuration, 90);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Warehouse Sort stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/warehouse-sort/sample-catalog.ts';
  const SAMPLES = 'simulator/warehouse-sort/samples.ts';
  // the only file that may import them
  const SERVER_LIST = 'simulator/members/all-examples.ts';

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
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/core/types', 'simulator/vm/builder', 'simulator/warehouse-sort/sample-catalog']);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'sort-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test('nothing but the server\'s list of all examples may import them - no file of the simulator screen, no page (and the tests)', () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    for (const file of importers(CATALOG)) assert.ok(file === SAMPLES || file === SERVER_LIST, `${file} imports the list of titles`);
    for (const file of importers(SAMPLES)) assert.equal(file, SERVER_LIST, `${file} imports the examples`);
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

describe('the blocks of the examples', () => {
  test('only blocks of the Warehouse Sort palette: blocks of real mBlock, and the Gripper shortcuts', () => {
    const allowed = new Set([...paletteBlockTypes('warehouse-sort'), ...BUILTIN_BLOCK_TYPES]);
    for (const s of SAMPLE_PROGRAMS) {
      const types = new Set(blocksOf(s.program).map((block) => block.type));
      for (const type of types) {
        assert.ok(allowed.has(type), `${s.id} uses ${type}`);
        assert.ok(supportsBlock(type), `${s.id}: the interpreter knows ${type}`);
      }
      // (my-blocks are plain "define" blocks: mBlock has no my-block that gives back a value)
      assert.ok(!types.has('procedures_defreturn') && !types.has('procedures_callreturn') && !types.has('procedures_ifreturn'), s.id);
      // no block of the colour sensor that Fire Chief's robot has fixed to its front: this robot's sensor is at the claw
      assert.ok(![...types].some((type) => type.startsWith('sensing_colorsensor_')), s.id);
      // no block that reads where the robot points: the examples move by "forward" and "turn" only,
      // so they do the same on the turned field as on the field as printed
      assert.ok(![...types].some((type) => /yaw|rotation|angle|gyro/.test(type)), s.id);
    }
  });

  test('each example shows the blocks it is about, and a starter is short', () => {
    const uses = (id: string): Set<string> => new Set(blocksOf(sample(id).program).map((block) => block.type));
    const GRIPPER = ['gripper_claw', 'gripper_arm'];
    const CLAW_SENSOR = ['sensing_claw_color', 'sensing_claw_color_is', 'sensing_claw_object_detected'];
    assert.ok(uses('sort-leave-start').has('mbot2_straight_cm'));
    assert.ok(uses('sort-white-line').has('sensing_quadrgb_probe_detects') && uses('sort-white-line').has('sensing_quadrgb_status_is'));
    assert.ok(uses('sort-cube-colour').has('sensing_claw_object_detected') && uses('sort-cube-colour').has('sensing_claw_color'));
    // the three starters teach one thing each: none of them grips a cube
    for (const id of ['sort-leave-start', 'sort-white-line', 'sort-cube-colour']) {
      for (const type of GRIPPER) assert.ok(!uses(id).has(type), `${id}: ${type}`);
    }
    for (const id of ['sort-leave-start', 'sort-white-line']) for (const type of CLAW_SENSOR) assert.ok(!uses(id).has(type), `${id}: ${type}`);
    // the three that sort: the gripper, and the colour read in the claw decides
    for (const id of ['sort-one-cube', 'sort-two-cubes', 'sort-all-cubes']) {
      for (const type of [...GRIPPER, 'sensing_claw_color', 'operator_equals', 'control_if_else']) assert.ok(uses(id).has(type), `${id}: ${type}`);
      // ... and each of them asks whether a cube is blue
      const asksBlue = blocksOf(sample(id).program).some(
        (block) =>
          (block.type === 'sensing_claw_color_is' && block.fields?.COLOR === 'blue') ||
          (block.type === 'operator_equals' && Object.values(block.inputs ?? {}).some((slot) => slot.shadow?.fields?.TEXT === 'blue')),
      );
      assert.ok(asksBlue, `${id} asks whether the cube is blue`);
    }
    // my-blocks from the second intermediate on
    assert.ok(uses('sort-two-cubes').has('procedures_defnoreturn') && uses('sort-all-cubes').has('procedures_defnoreturn'));
    // a starter is short; the advanced example is the longest
    const size = (id: string): number => blocksOf(sample(id).program).filter((block) => block.type !== 'math_number' && block.type !== 'text').length;
    for (const card of SAMPLE_CATALOG) {
      if (card.level === 'starter') assert.ok(size(card.id) <= 20, `${card.id}: ${size(card.id)} blocks`);
      assert.ok(size(card.id) <= size('sort-all-cubes'), card.id);
    }
  });

  test('the numbers in the blocks are the ones of the table in samples.ts', () => {
    const grip = WAREHOUSE_SORT_ROBOT.gripper.gripForward;
    // the start and the two white lines across the mat (within 1 mm)
    assert.ok(Math.abs(START_Y_CM * 10 - START_POSE.y) < 1, `the start: y ${START_POSE.y.toFixed(2)}`);
    assert.ok(Math.abs(START_POSE.y - TO_BOTTOM_LINE_CM * 10 - BOTTOM_LINE_Y) < 1, 'forward 4.6 cm: onto the bottom line');
    assert.ok(Math.abs(BOTTOM_LINE_Y_CM * 10 - BOTTOM_LINE_Y) < 1 && Math.abs(TOP_LINE_Y_CM * 10 - TOP_LINE_Y) < 1);
    assert.ok(Math.abs(UP_TO_TOP_LINE_CM - (BOTTOM_LINE_Y_CM - TOP_LINE_Y_CM)) < 0.01);
    // the cubes of the top row stand on the top line, those of the bottom row on the bottom line (within 1 mm) ...
    for (const w of ['W1', 'W2'] as const) assert.ok(Math.abs(cubeHome(w).y - TOP_LINE_Y) < 1, w);
    for (const w of ['W3', 'W4'] as const) assert.ok(Math.abs(cubeHome(w).y - BOTTOM_LINE_Y) < 1, w);
    // ... and the distance from the long line to each cube puts the middle of the claw on the cube (within 2 mm)
    for (const w of WAREHOUSE_IDS) {
      const needed = Math.abs(cubeHome(w).x - LONG_LINE_X) - grip;
      assert.ok(Math.abs(PICK_CM[w] * 10 - needed) <= 2, `${w}: ${PICK_CM[w]} cm, needed ${(needed / 10).toFixed(2)} cm`);
    }
    // the places in the bays: inside both bays, far enough apart for the opening claw (64 mm + two fingers of 8 mm)
    const places = [0, 1, 2].map((k) => (FIRST_PLACE_Y_CM - k * PLACE_STEP_CM) * 10);
    for (const y of places) {
      for (const color of ['red', 'green'] as const) {
        const bay = BAYS[color];
        assert.ok(y - CUBE_SIZE / 2 > bay.y + 3 && y + CUBE_SIZE / 2 < bay.y + bay.h - 3, `place ${y} in the ${color} bay`);
      }
    }
    const g = WAREHOUSE_SORT_ROBOT.gripper;
    assert.ok(PLACE_STEP_CM * 10 - CUBE_SIZE / 2 > g.clawOpenGap / 2 + g.fingerThickness, 'a cube next to the opening claw is not hit');
    // turned to a bay and 1.5 cm in, the cube in the claw is over the middle of the bay (within 2 mm)
    const red = BAYS.red;
    const green = BAYS.green;
    assert.ok(Math.abs(LONG_LINE_X + grip + INTO_BAY_CM * 10 - (red.x + red.w / 2)) < 2);
    assert.ok(Math.abs(LONG_LINE_X - grip - INTO_BAY_CM * 10 - (green.x + green.w / 2)) < 2);
    // the drives of "Two cubes, then park", one after the other, are these differences
    const drives = startScript(sample('sort-two-cubes').program)
      .filter((block) => block.type === 'mbot2_straight_cm')
      .map((block) => Number(block.inputs?.DISTANCE?.shadow?.fields?.NUM));
    const second = FIRST_PLACE_Y_CM - PLACE_STEP_CM;
    const expected = [TO_BOTTOM_LINE_CM, BOTTOM_LINE_Y_CM - FIRST_PLACE_Y_CM, FIRST_PLACE_Y_CM - TOP_LINE_Y_CM, second - TOP_LINE_Y_CM, PARK_Y_CM - second, PARK_LEFT_CM];
    assert.deepEqual(drives, expected.map((cm) => Number(cm.toFixed(1))));
  });
});

// =============================================================================================
// 1. sort-leave-start
// =============================================================================================

describe('sort-leave-start: leave the start zone and stop', () => {
  const s = sample('sort-leave-start');

  test('all 24 arrangements: 10 points (left the start zone, clean run), after 1.85 s, nothing touched', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      assertClean(played, label(scenario));
      assert.equal(sim.finishReason, 'program-ended', label(scenario));
      assert.equal(sim.score().total, 10, label(scenario));
      assert.equal(lineOf(sim, LINE_LEAVE_START).points, 5);
      assert.ok(Math.abs(sim.world.time - 1.85) < 0.02 && Math.round(sim.world.time) === 2, `${sim.world.time} s`);
      assert.deepEqual(screen(sim), ['Go!', 'Out of the zone']);
      assert.equal(ledsColour(sim), 'green');
      // it drove LEAVE_CM straight up
      assert.ok(Math.abs(START_POSE.y - sim.world.robot.pose.y - LEAVE_CM * 10) < 0.5);
      assert.ok(Math.abs(START_POSE.x - sim.world.robot.pose.x) < 0.5);
      for (const w of WAREHOUSE_IDS) assertUntouched(sim, w, label(scenario));
    }
  });

  test('the try of the description: from 1.4 cm on the 5 points are earned - the claw is out of the zone - with 1.3 cm not', () => {
    const withDistance = (cm: number): ProgramJson =>
      changed(s.program, (all) => {
        const drive = all.find((block) => block.type === 'mbot2_straight_cm')!;
        drive.inputs!.DISTANCE.shadow!.fields!.NUM = cm;
      });
    assert.equal(play(withDistance(1.4), defaultScenario()).sim.score().total, 10);
    assert.equal(play(withDistance(1.3), defaultScenario()).sim.score().total, 5);
  });
});

// =============================================================================================
// 2. sort-white-line
// =============================================================================================

describe('sort-white-line: follow the white line to a T', () => {
  const s = sample('sort-white-line');
  const RIGHT_T = WHITE_LINES.bottomRightT;
  const quad = WAREHOUSE_SORT_ROBOT.quadRgb.forward;

  /** The sensor stopped on the T at the right end of the line (the robot faces right), the claw short of the cube of W4. */
  function assertAtTheRightT(played: Played, what: string): void {
    const { sim } = played;
    const sensorX = sim.world.robot.pose.x + quad;
    assert.ok(sensorX > RIGHT_T.x && sensorX < RIGHT_T.x + RIGHT_T.w + 1, `${what}: the sensor is at x ${sensorX.toFixed(1)}`);
    assert.equal(lineOf(sim, LINE_LEAVE_START).points, 5, what);
    assert.equal(sim.score().total, 10, what);
    assert.deepEqual(screen(sim), ['T found!'], what);
    const gap = fingerTipsToCube(sim, 'W4');
    assert.ok(gap > 2.5 && gap < 8, `${what}: the finger tips are ${gap.toFixed(2)} mm before the cube`);
    assertUntouched(sim, 'W4', what);
  }

  test('all 24 arrangements: it follows the line to the right and stops at the T after 3.17 s, 10 points, the cube is not touched', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      assertClean(played, label(scenario));
      assertAtTheRightT(played, label(scenario));
      assert.equal(played.sim.finishReason, 'program-ended');
      assert.ok(Math.abs(played.sim.world.time - 3.17) < 0.02, `${played.sim.world.time} s`);
      assert.ok(played.besideTheLine < 0.5, `${played.besideTheLine} mm beside the line`);
      assert.ok(Math.abs(fingerTipsToCube(played.sim, 'W4') - 6.2) < 0.1);
    }
  });

  test('started crooked (up to 5 degrees) and beside the long line (up to 1 cm), still in the start zone: it steers back and stops at the T', () => {
    for (const degrees of [-5, -2.5, 2.5, 5]) {
      for (const dx of [-10, 0, 10]) {
        const startPose = { ...START_POSE, x: START_POSE.x + dx, heading: START_POSE.heading + (degrees * Math.PI) / 180 };
        const played = play(s.program, defaultScenario(), { startPose });
        const what = `${degrees} degrees, ${dx} mm`;
        assertClean(played, what);
        assertAtTheRightT(played, what);
        assert.ok(played.besideTheLine < 5, `${what}: ${played.besideTheLine.toFixed(2)} mm beside the line`);
        assert.ok(played.sim.world.time < 3.6, `${what}: ${played.sim.world.time} s`);
      }
    }
  });

  test(`why it drives ${PAST_THE_FRAME_CM} cm first: started 1 cm to the left and crooked, the yellow frame stops a robot that looks at once`, () => {
    // (the frame of the start zone is light, so the sensor counts it as line, and it crosses the white line)
    const lookingSooner = changed(s.program, (all) => {
      const drives = all.filter((block) => block.type === 'mbot2_straight_cm');
      drives[1].inputs!.DISTANCE.shadow!.fields!.NUM = 5;
    });
    const startPose = { ...START_POSE, x: START_POSE.x - 10, heading: START_POSE.heading - (5 * Math.PI) / 180 };
    const early = play(lookingSooner, defaultScenario(), { startPose }).sim;
    assert.ok(early.world.robot.pose.x < 700, `it stopped on the frame, at x ${early.world.robot.pose.x.toFixed(0)}`);
  });

  test('the try of the description: turn left instead of right - it follows the line left of the start zone to its T', () => {
    const turnLeft = changed(s.program, (all) => {
      all.find((block) => block.type === 'mbot2_turn_deg')!.fields!.DIRECTION = 'left';
    });
    for (const scenario of ARRANGEMENTS) {
      const played = play(turnLeft, scenario);
      assertClean(played, `turn left ${label(scenario)}`);
      const { sim } = played;
      const LEFT_T = WHITE_LINES.bottomLeftT;
      const sensorX = sim.world.robot.pose.x - quad;
      assert.ok(sensorX > LEFT_T.x - 1 && sensorX < LEFT_T.x + LEFT_T.w, `the sensor is at x ${sensorX.toFixed(1)}`);
      assert.equal(sim.score().total, 10);
      const gap = fingerTipsToCube(sim, 'W3');
      assert.ok(gap > 2 && gap < 6, `the finger tips are ${gap.toFixed(2)} mm before the cube`);
      assertUntouched(sim, 'W3', 'turn left');
    }
  });
});

// =============================================================================================
// 3. sort-cube-colour
// =============================================================================================

describe('sort-cube-colour: read the colour of a cube', () => {
  const s = sample('sort-cube-colour');

  test('all 24 arrangements: the screen and the LEDs show the colour of the cube at the bottom left - red, green or blue - 10 points, after 3.27 s', () => {
    const shown = new Set<string>();
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      assertClean(played, label(scenario));
      const colour = scenario.cubes.W3;
      assert.deepEqual(screen(sim), [`Cube: ${colour}`], label(scenario));
      assert.equal(ledsColour(sim), colour, `${label(scenario)}: LEDs`);
      shown.add(colour);
      assert.equal(sim.score().total, 10, label(scenario));
      assert.ok(Math.abs(sim.world.time - 3.27) < 0.02, `${sim.world.time} s`);
      // it stops before the cube: the finger tips 7 mm short of it
      const gap = fingerTipsToCube(sim, 'W3');
      assert.ok(gap > 6 && gap < 8, `${label(scenario)}: ${gap.toFixed(2)} mm`);
      for (const w of WAREHOUSE_IDS) assertUntouched(sim, w, label(scenario));
    }
    assert.deepEqual([...shown].sort(), ['blue', 'green', 'red'], 'it has shown all three colours');
  });

  test('the try of the description: turn right instead of left - it reads the cube at the bottom right, on all 24 arrangements', () => {
    const turnRight = changed(s.program, (all) => {
      all.find((block) => block.type === 'mbot2_turn_deg')!.fields!.DIRECTION = 'right';
    });
    for (const scenario of ARRANGEMENTS) {
      const played = play(turnRight, scenario);
      assertClean(played, label(scenario));
      assert.deepEqual(screen(played.sim), [`Cube: ${scenario.cubes.W4}`], label(scenario));
      assert.equal(ledsColour(played.sim), scenario.cubes.W4, label(scenario));
      assert.equal(played.sim.score().total, 10);
      assert.ok(fingerTipsToCube(played.sim, 'W4') > 6);
      assertUntouched(played.sim, 'W4', label(scenario));
    }
  });
});

// =============================================================================================
// 4. sort-one-cube
// =============================================================================================

describe('sort-one-cube: put one cube in its bay', () => {
  const s = sample('sort-one-cube');

  test('all 24 arrangements: the cube at the bottom right - or at the bottom left where that one is blue - goes into the bay of its colour: 30 points', () => {
    let leftBlue = 0;
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      const blueRight = scenario.cubes.W4 === 'blue';
      const taken: WarehouseId = blueRight ? 'W3' : 'W4';
      const colour = scenario.cubes[taken];
      assert.equal(sim.score().total, 30, what);
      assert.equal(lineOf(sim, pickLineId(taken)).points, 5, what);
      assert.equal(lineOf(sim, deliverLineId(taken)).points, 15, what);
      assert.equal(lineOf(sim, LINE_PARK).points, 0, what);
      assert.ok(marginInBay(sim, taken, colour) > 3.5, `${what}: ${marginInBay(sim, taken, colour).toFixed(2)} mm from the edge of the ${colour} bay`);
      assert.deepEqual(screen(sim), blueRight ? ['Blue: leave it', `Cube: ${colour}`] : [`Cube: ${colour}`], what);
      // 11.19 s with the cube of W4; 16.71 s where it is blue and the robot takes the cube of W3
      const end = blueRight ? 16.71 : 11.19;
      assert.ok(Math.abs(sim.world.time - end) < 0.02, `${what}: ${sim.world.time} s`);
      assert.ok(Math.abs(lineOf(sim, deliverLineId(taken)).time! - (blueRight ? 15.87 : 10.35)) < 0.02);
      for (const w of WAREHOUSE_IDS) if (w !== taken) assertUntouched(sim, w, what);
      if (blueRight) leftBlue++;
    }
    assert.equal(leftBlue, 6, 'on 6 arrangements it found the blue cube at the bottom right and left it there');
  });

  test('the try of the description: park on a finish pad at the end - 40 points on all 24 arrangements', () => {
    // back to facing up, down the long line below the bays, to the left pad (the moves of "Two cubes, then park")
    const parked = withMoreAtTheEnd(s.program, [
      ifElse(eq(v('colour'), 'red'), [turn('left', 90)], [turn('right', 90)]),
      moveCm('backward', Number((PARK_Y_CM - FIRST_PLACE_Y_CM).toFixed(1))),
      turn('left', 90),
      moveCm('forward', PARK_LEFT_CM),
      turn('right', 90),
    ]);
    for (const scenario of ARRANGEMENTS) {
      const played = play(parked, scenario);
      assertClean(played, label(scenario));
      assert.equal(played.sim.score().total, 40, label(scenario));
      assert.equal(lineOf(played.sim, LINE_PARK).points, 10, label(scenario));
    }
  });
});

// =============================================================================================
// 5. sort-two-cubes
// =============================================================================================

describe('sort-two-cubes: two cubes, then park', () => {
  const s = sample('sort-two-cubes');

  test('all 24 arrangements: one cube of each row in the bay of its colour, never the blue one, parked on the left pad - 60 points', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(sim.score().total, 60, what);
      const bottom: WarehouseId = scenario.cubes.W4 === 'blue' ? 'W3' : 'W4';
      const top: WarehouseId = scenario.cubes.W2 === 'blue' ? 'W1' : 'W2';
      for (const w of [bottom, top]) {
        assert.equal(lineOf(sim, pickLineId(w)).points, 5, `${what} ${w}`);
        assert.equal(lineOf(sim, deliverLineId(w)).points, 15, `${what} ${w}`);
        assert.ok(marginInBay(sim, w, scenario.cubes[w]) > 3.5, `${what} ${w}`);
      }
      assert.equal(lineOf(sim, LINE_PARK).points, 10, what);
      assert.match(lineOf(sim, LINE_PARK).detail, /left pad/);
      // the time depends only on where the blue cube is: in W1 or W3 no detour, in W2 or W4 one
      const blue = blueWarehouse(scenario);
      const [end, last] = blue === 'W2' ? [37.83, 31.39] : blue === 'W4' ? [37.95, 31.51] : [32.43, 25.99];
      assert.ok(Math.abs(sim.world.time - end) < 0.02 && Math.round(sim.world.time) >= 32 && Math.round(sim.world.time) <= 38, `${what}: ${sim.world.time} s`);
      assert.ok(Math.abs(lineOf(sim, LINE_LAST_DELIVERY).time! - last) < 0.02, `${what}: ${lineOf(sim, LINE_LAST_DELIVERY).time} s`);
      // two cubes of one colour stand side by side, 6.2 cm apart
      assert.ok(Math.abs(cubeOf(sim, bottom).y - cubeOf(sim, top).y - PLACE_STEP_CM * 10) < 0.5, what);
      for (const w of WAREHOUSE_IDS) if (w !== bottom && w !== top) assertUntouched(sim, w, what);
    }
  });

  test('the try of the description: park on the right pad instead - also 60 points on all 24 arrangements', () => {
    const rightPad = changed(s.program, () => undefined);
    const last = startScript(rightPad).slice(-3);
    assert.deepEqual(last.map((block) => block.type), ['mbot2_turn_deg', 'mbot2_straight_cm', 'mbot2_turn_deg']);
    last[0].fields!.DIRECTION = 'right';
    last[2].fields!.DIRECTION = 'left';
    for (const scenario of ARRANGEMENTS) {
      const played = play(rightPad, scenario);
      assertClean(played, label(scenario));
      assert.equal(played.sim.score().total, 60, label(scenario));
      assert.match(lineOf(played.sim, LINE_PARK).detail, /right pad/);
    }
  });
});

// =============================================================================================
// 6. sort-all-cubes
// =============================================================================================

describe('sort-all-cubes: sort the cubes and park', () => {
  const s = sample('sort-all-cubes');

  /** The same program with the four warehouses visited in another order (the try of the description). */
  function inOrder(order: WarehouseId[]): ProgramJson {
    const copy = changed(s.program, () => undefined);
    const chain = startScript(copy);
    const looks = chain
      .map((block, i) => ({ block, i }))
      .filter(({ block }) => block.type === 'procedures_callnoreturn' && (block.extraState as { name: string }).name === 'look at the cube');
    assert.equal(looks.length, 4);
    // the warehouse each "look at the cube" goes to: the white line of its row, and right or left
    const warehouseOf = (block: BlockJson): WarehouseId => {
      const lineY = Number(block.inputs?.ARG0?.shadow?.fields?.NUM);
      const way = block.inputs?.ARG1?.shadow?.fields?.TEXT;
      return lineY > 60 ? (way === 'right' ? 'W4' : 'W3') : way === 'right' ? 'W2' : 'W1';
    };
    const pairs = new Map(looks.map(({ block, i }) => [warehouseOf(block), [chain[i], chain[i + 1]]]));
    const first = looks[0].i;
    const rest = chain.slice(looks[3].i + 2);
    const blocks = [...chain.slice(0, first), ...order.flatMap((w) => pairs.get(w)!), ...rest];
    for (const block of blocks) delete block.next;
    for (let i = 0; i + 1 < blocks.length; i++) blocks[i].next = { block: blocks[i + 1] };
    const start = (copy.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start')!;
    start.next = { block: blocks[0] };
    return copy;
  }

  test('all 24 arrangements: every red and green cube in the bay of its colour, the blue one left alone, parked on the left pad - 80 points in 53.5 to 60.9 s', () => {
    const times: number[] = [];
    const lastDeliveries: number[] = [];
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.equal(sim.score().total, 80, what);
      assert.equal(sim.score().total, MAX_SCORE, 'the most there is');
      assert.equal(sim.score().complete, true, what);
      for (const w of WAREHOUSE_IDS) {
        if (scenario.cubes[w] === 'blue') {
          assertUntouched(sim, w, what);
          continue;
        }
        assert.equal(lineOf(sim, pickLineId(w)).points, 5, `${what} ${w}`);
        assert.equal(lineOf(sim, deliverLineId(w)).points, 15, `${what} ${w}`);
        assert.ok(marginInBay(sim, w, scenario.cubes[w]) > 3.5, `${what} ${w}: ${marginInBay(sim, w, scenario.cubes[w]).toFixed(2)} mm`);
      }
      assert.match(lineOf(sim, LINE_PARK).detail, /left pad/);
      // the CyberPi says it once: it left the blue cube
      assert.deepEqual(screen(sim), ['Blue: leave it'], what);
      times.push(sim.world.time);
      lastDeliveries.push(lineOf(sim, LINE_LAST_DELIVERY).time!);
    }
    assert.ok(Math.min(...times) > 53.5 && Math.max(...times) < 60.9, `${Math.min(...times)} to ${Math.max(...times)} s`);
    // the description's "53 to 61 of the 90 seconds"
    assert.ok(Math.floor(Math.min(...times)) === 53 && Math.ceil(Math.max(...times)) === 61);
    assert.ok(Math.min(...lastDeliveries) > 41.5 && Math.max(...lastDeliveries) < 54.5, `${Math.min(...lastDeliveries)} to ${Math.max(...lastDeliveries)} s`);
    // the default arrangement
    const usual = play(s.program, defaultScenario()).sim;
    assert.ok(Math.abs(usual.world.time - 58.06) < 0.02, `${usual.world.time} s`);
  });

  test('it never assumes an arrangement: the colour it reads in the claw decides every cube', () => {
    // the program holds no colour of a cube: the sensor is read in one place, into "colour", and
    // every colour a block names is compared with "colour"
    const blocks = blocksOf(s.program);
    assert.equal(blocks.filter((block) => block.type === 'sensing_claw_color').length, 1, 'one place reads the sensor: "look at the cube"');
    assert.equal(blocks.filter((block) => block.type === 'sensing_claw_color_is').length, 0);
    const COLOURS = ['red', 'green', 'blue'];
    let compared = 0;
    for (const block of blocks.filter((b) => b.type === 'operator_equals')) {
      const sides = [block.inputs?.OPERAND1, block.inputs?.OPERAND2];
      const named = sides.find((slot) => !slot?.block && COLOURS.includes(String(slot?.shadow?.fields?.TEXT)));
      if (!named) continue;
      const other = sides.find((slot) => slot !== named);
      assert.equal(variableName(s.program, other?.block), 'colour', 'a colour is only ever compared with what the sensor read');
      compared++;
    }
    assert.equal(compared, 3, 'blue (leave it), red and green (the bays)');
    // the same blocks do with each cube what its colour says, whatever the arrangement: the cube of
    // a warehouse ends in the red bay on the arrangements where it is red, in the green bay where it
    // is green, and stays in its warehouse where it is blue
    const whereIs = (sim: Sim, w: WarehouseId): string => {
      const cube = cubeOf(sim, w);
      const home = cubeHome(w);
      if (cube.x === home.x && cube.y === home.y) return 'blue';
      for (const color of ['red', 'green'] as const) {
        const bay = BAYS[color];
        if (cube.x > bay.x && cube.x < bay.x + bay.w && cube.y > bay.y && cube.y < bay.y + bay.h) return color;
      }
      return 'nowhere';
    };
    const seen = new Map<WarehouseId, Set<string>>(WAREHOUSE_IDS.map((w) => [w, new Set()]));
    for (const scenario of ARRANGEMENTS) {
      const { sim } = play(s.program, scenario);
      for (const w of WAREHOUSE_IDS) {
        assert.equal(whereIs(sim, w), scenario.cubes[w], `${label(scenario)} ${w}`);
        seen.get(w)!.add(whereIs(sim, w));
      }
    }
    for (const w of WAREHOUSE_IDS) assert.deepEqual([...seen.get(w)!].sort(), ['blue', 'green', 'red'], `${w}: red bay, green bay, and left alone`);
  });

  test('the try of the description: other orders of the warehouses also score 80 on all 24 arrangements', () => {
    // (all 24 orders were measured once: 80 points in all 576 matches, 53.5 to 65.9 s; here three of them)
    const orders: WarehouseId[][] = [
      ['W4', 'W3', 'W1', 'W2'],
      ['W1', 'W2', 'W3', 'W4'],
      ['W2', 'W4', 'W1', 'W3'],
    ];
    const asWritten = inOrder(['W4', 'W2', 'W1', 'W3']);
    assert.deepEqual(asWritten, s.program, 'the program as it is written visits W4, W2, W1, W3');
    for (const order of orders) {
      const blocks = inOrder(order);
      for (const scenario of ARRANGEMENTS) {
        const played = play(blocks, scenario);
        assertClean(played, `${order.join(' ')} ${label(scenario)}`);
        assert.equal(played.sim.score().total, 80, `${order.join(' ')} ${label(scenario)}`);
        assert.ok(played.sim.world.time < 66, `${order.join(' ')}: ${played.sim.world.time} s`);
      }
    }
  });
});

// =============================================================================================
// The blue cube, in every example
// =============================================================================================

describe('the blue cube', () => {
  test(`no example ever moves it: ${SAMPLE_PROGRAMS.length} examples x ${SCENARIO_COUNT} arrangements, "left alone" on every score sheet`, () => {
    assert.equal(ARRANGEMENTS.length, 24);
    for (const s of SAMPLE_PROGRAMS) {
      for (const scenario of ARRANGEMENTS) {
        const played = play(s.program, scenario);
        const what = `${s.id} ${label(scenario)}`;
        assertBlueLeftAlone(played, what);
        // and it was never in the claw: the gripper never held it, it never scored anything
        const blue = blueWarehouse(scenario) as WarehouseId;
        assert.ok(!played.events.some((e) => e.type === 'grab' && e.bodyId === cubeBodyId(blue)), `${what}: gripped`);
        assert.equal(played.sim.score().lines.filter((l) => l.id.endsWith(`:${blue}`)).length, 0, `${what}: the blue cube has no line that scores`);
      }
    }
  });
});

// =============================================================================================
// What the examples print, and the examples in the block editor
// =============================================================================================

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(path.join(HERE, '../ui/CyberPiPanel.tsx'), 'utf8'))?.[1]);

  /** The longest text a slot can give: the written text, the two halves of a "join" - or "green" for a colour read in the claw. */
  function longest(slot: { shadow?: BlockJson; block?: BlockJson } | undefined, where: string): number {
    const block = slot?.block;
    if (!block) return String(slot?.shadow?.fields?.TEXT ?? '').length;
    if (block.type === 'operator_join') return longest(block.inputs?.STRING1, where) + longest(block.inputs?.STRING2, where);
    // the colour sensor at the claw names red, green or blue here (or "none" with nothing in front of it)
    if (block.type === 'sensing_claw_color' || (block.type === 'data_variable' && block.fields?.VARIABLE !== undefined)) return 'green'.length;
    assert.fail(`${where}: this test does not know how long the value of a "${block.type}" block can be`);
  }

  test('every text an example prints fits on one row of the CyberPi screen', () => {
    assert.equal(columns, 18, 'the CyberPi screen of the simulator is 18 characters wide');
    let seen = 0;
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        if (block.type !== 'cyberpi_print') continue;
        const length = longest(block.inputs?.TEXT, s.id);
        assert.ok(length > 0 && length <= columns, `${s.id}: a print block shows up to ${length} characters`);
        seen++;
      }
    }
    assert.equal(seen, 7, 'every print block of the six examples was looked at');
  });
});

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly (as Fire Chief's tests do). */
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
  test('every example loads into the Warehouse Sort editor, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: warehouseSortGame.id });
    for (const s of SAMPLE_PROGRAMS) {
      workspace.clear();
      Blockly.serialization.workspaces.load(s.program as never, workspace);
      const drawn = workspace.getAllBlocks(false);
      assert.ok(drawn.length >= 5, `${s.id}: ${drawn.length} blocks drawn`);
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
      assert.ok(notes.length >= 2, `${s.id}: has notes`);
      for (const text of notes) assert.ok(text.length <= 220, `${s.id}: a note is short ("${text}")`);

      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      // (the first arrangement has the blue cube in W1, the last one in W4: the one-cube example takes its other way there)
      for (const scenario of [defaultScenario(), ARRANGEMENTS[0], ARRANGEMENTS[SCENARIO_COUNT - 1]]) {
        const fromBuilder = runMatch({ game: warehouseSortGame, scenario, program: s.program });
        const fromEditor = runMatch({ game: warehouseSortGame, scenario, program: saved });
        assert.deepEqual(fromEditor, fromBuilder, s.id);
        assert.equal(fromEditor.errors, undefined, s.id);
      }
    }
    workspace.dispose();
  });
});

// =============================================================================================
// On the picture the browser reads
// =============================================================================================

/** The sensor picture of the mat, decoded with sharp (it comes with Next.js); null where it is missing. */
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
    const file = path.join(HERE, '../../../public', warehouseSortGame.mat.sensorImageUrl);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

describe('the examples on the picture of the mat', () => {
  const picture = loadMatPicture();

  test('every example scores on the picture what it scores on the drawing, on all 24 arrangements', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const s of SAMPLE_PROGRAMS) {
      for (const scenario of ARRANGEMENTS) {
        const onDrawing = play(s.program, scenario);
        const onPicture = play(s.program, scenario, { sampler: mat });
        const what = `${s.id} ${label(scenario)}`;
        assertClean(onPicture, what);
        assert.equal(onPicture.sim.score().total, onDrawing.sim.score().total, what);
        assert.equal(onPicture.sim.finishReason, onDrawing.sim.finishReason, what);
        // only the line follower looks at the floor: every other example ends in exactly the same place
        const a = onPicture.sim.world.robot.pose;
        const b = onDrawing.sim.world.robot.pose;
        const apart = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(apart <= (s.id === 'sort-white-line' ? 2 : 0), `${what}: ${apart.toFixed(2)} mm apart`);
      }
    }
  });

  test('the line follower on the picture: crooked and beside the long line it still stops at the T, short of the cube', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const s = sample('sort-white-line');
    const quad = WAREHOUSE_SORT_ROBOT.quadRgb.forward;
    const T = WHITE_LINES.bottomRightT;
    for (const degrees of [-5, 0, 5]) {
      for (const dx of [-10, 0, 10]) {
        const startPose = { ...START_POSE, x: START_POSE.x + dx, heading: START_POSE.heading + (degrees * Math.PI) / 180 };
        const played = play(s.program, defaultScenario(), { sampler: mat, startPose });
        const what = `picture, ${degrees} degrees, ${dx} mm`;
        assertClean(played, what);
        const sensorX = played.sim.world.robot.pose.x + quad;
        assert.ok(sensorX > T.x && sensorX < T.x + T.w + 1, `${what}: x ${sensorX.toFixed(1)}`);
        assert.equal(played.sim.score().total, 10, what);
        assert.ok(played.besideTheLine < 5, `${what}: ${played.besideTheLine.toFixed(2)} mm`);
        const gap = fingerTipsToCube(played.sim, 'W4');
        assert.ok(gap > 2.5, `${what}: ${gap.toFixed(2)} mm`);
      }
    }
  });
});

// =============================================================================================
// The finish pads are where the parking examples think
// =============================================================================================

test('parking: on the long line at y 79 cm the robot is below both bays; 45.9 cm to the left and a quarter turn put its claw on the left pad', () => {
  const pad = FINISH_PADS.left;
  const y = PARK_Y_CM * 10;
  // (the body is 130 mm wide: facing left at y 790 mm its top side is below both bays, and below every place in them)
  assert.ok(y - WAREHOUSE_SORT_ROBOT.chassisWidth / 2 > Math.max(BAYS.red.y + BAYS.red.h, BAYS.green.y + BAYS.green.h));
  assert.ok(Math.abs(LONG_LINE_X - PARK_LEFT_CM * 10 - pad.cx) < 1);
  // facing up there, the middle of the claw is inside the pad
  const clawY = y - WAREHOUSE_SORT_ROBOT.gripper.gripForward;
  assert.ok(((clawY - pad.cy) / pad.ry) ** 2 < 0.5);
  // the try of "Two cubes, then park": the same to the right puts the claw on the right pad
  const right = FINISH_PADS.right;
  assert.ok(Math.abs(LONG_LINE_X + PARK_LEFT_CM * 10 - right.cx) < 2);
  assert.ok(((clawY - right.cy) / right.ry) ** 2 < 0.5);
});
