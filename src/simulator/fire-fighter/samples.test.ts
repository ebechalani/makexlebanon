/**
 * The example programs of Fire Fighter (samples.ts), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Fire Fighter referee
 *
 * Fire Fighter has one setup (./scenario.ts), so every example is played on it: on the vector
 * drawing of the mat, and on the picture the browser reads (the sensor picture of the mat, decoded
 * with sharp, which comes with Next.js; those tests are skipped where sharp is missing). Each test
 * asserts what the description of that example promises - no more, no less - and the numbers the
 * comments above the programs give.
 *
 * "Nothing is pushed" is checked tick by tick: no tower moves by even 0.01 mm, no cube moves that the
 * claw has not taken, the robot never bumps into a side of a tower, and every cube that scores went
 * into its tower through the opening (the referee never says "from the back"). The numbers of the
 * blocks are worked out again from ./field.ts ("the numbers in the blocks"), and the starts that keep
 * the points - written above each program - are tried, with one step more that loses them.
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
import { SAMPLE_CATALOG as FIRE_CADET_CATALOG, EXAMPLE_LEVELS as FIRE_CADET_LEVELS } from '../fire-cadet/sample-catalog';
import { SAMPLE_CATALOG as FIRE_CHIEF_CATALOG, EXAMPLE_LEVELS as FIRE_CHIEF_LEVELS } from '../fire-chief/sample-catalog';
import { SAMPLE_CATALOG as FIRE_RESCUE_CATALOG, EXAMPLE_LEVELS as FIRE_RESCUE_LEVELS } from '../fire-rescue/sample-catalog';
import { SAMPLE_CATALOG as LOCKER_ROOM_CATALOG, EXAMPLE_LEVELS as LOCKER_ROOM_LEVELS } from '../locker-room/sample-catalog';
import { poseFits } from '../ui/start-pose';
import { supportsBlock } from '../vm';
import { gripper, moveCm, program as buildProgram, script, turn, whenStart, type BlockNode } from '../vm/builder';
import { SAMPLE_CATALOG as WAREHOUSE_SORT_CATALOG, EXAMPLE_LEVELS as WAREHOUSE_SORT_LEVELS } from '../warehouse-sort/sample-catalog';
import {
  CUBE_HOMES,
  FIRE_STATION,
  LINES,
  LINE_WIDTH,
  LEFT_LINE_X,
  MAT_SIZE,
  MAT_VECTOR,
  OPENING,
  RIGHT_LINE_X,
  SQUARE_MIDDLES,
  TOWER_DEPTH,
  TOWER_IDS,
  TOWER_MIDDLES,
  TOWER_WIDTH,
  type CubePlace,
  type TowerId,
} from './field';
import {
  CUBE_IDS,
  MATCH_DURATION,
  MAX_SCORE,
  YELLOW_CUBE_ID,
  createFireFighterReferee,
  cubeId,
  fireFighterGame,
  towerLineId,
  towerShift,
  type FireFighterReferee,
} from './game';
import { FIRE_FIGHTER_ROBOT, START_POSE, robotReach } from './robot';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import {
  ALL_FOUR_ON_THE_LINE,
  AROUND_THE_HYDRANT,
  DELIVERY,
  FOLLOW_RPM,
  LEFT_BAY,
  MISSION_WAYS,
  PAST_THE_PICTURE_CM,
  RIGHT_BAY,
  SAMPLE_PROGRAMS,
  SLIDE_IN,
  STEER_FAST_RPM,
  STEER_SLOW_RPM,
  TOO_SHORT_CM,
  TO_YELLOW_CM,
  T_TO_YELLOW_CM,
  UP_FIRST_CM,
  getSampleProgram,
  type SampleProgram,
} from './samples';
import { RULES_SETUP, type FireFighterScenario } from './scenario';

type Sim = Simulation<FireFighterScenario>;

/** The folder of this file. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

const DEG = Math.PI / 180;
const GRIPPER = FIRE_FIGHTER_ROBOT.gripper;
/** From the middle of the robot to the middle of the claw, and to the tips of the fingers (mm). */
const GRIP = GRIPPER.gripForward;
const TIPS = GRIPPER.gripForward + GRIPPER.fingerLength / 2;
const REACH = robotReach(FIRE_FIGHTER_ROBOT);
/** How far the open claw reaches from the middle of the robot: a turn on the spot sweeps a circle this big (171.7 mm). */
const SWEEP = Math.hypot(TIPS, GRIPPER.clawOpenGap / 2 + GRIPPER.fingerThickness);

// =============================================================================================
// Playing an example
// =============================================================================================

interface Played {
  sim: Sim;
  referee: FireFighterReferee;
  events: SimEvent[];
  /** what the referee said in the console, in order */
  said: string[];
  /** the largest distance (mm) any tower stood from its place, at any tick */
  towerMoved: number;
  /** cubes that moved although the claw had not taken them yet: "cube:red-left-upper at 12.34" */
  pushed: string[];
  /** bumps of the robot into a side of a tower */
  towerBumps: string[];
}

function sample(id: string): SampleProgram {
  const s = getSampleProgram(id);
  assert.ok(s, id);
  return s;
}

/** Play one whole match, tick by tick, and watch the towers and the cubes. */
function play(blocks: ProgramJson, options: { sampler?: MatSampler; startPose?: Pose } = {}): Played {
  let referee: FireFighterReferee | null = null;
  const game = { ...fireFighterGame, createReferee: (s: FireFighterScenario) => (referee = createFireFighterReferee(s)) };
  const sim = createSimulation({ game, scenario: RULES_SETUP, program: blocks, sampler: options.sampler, startPose: options.startPose });
  const events: SimEvent[] = [];
  const taken = new Set<string>();
  const home = new Map(sim.world.bodies.map((b) => [b.id, { x: b.x, y: b.y, angle: b.angle }]));
  const pushed: string[] = [];
  let towerMoved = 0;
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    const now = sim.drainEvents();
    events.push(...now);
    for (const e of now) if (e.type === 'grab') taken.add(e.bodyId);
    for (const b of sim.world.bodies) {
      if (b.kind !== 'cube' || taken.has(b.id)) continue;
      const was = home.get(b.id)!;
      if (b.x !== was.x || b.y !== was.y || b.angle !== was.angle) pushed.push(`${b.id} at ${sim.world.time.toFixed(2)}`);
    }
    for (const tower of TOWER_IDS) {
      const shift = towerShift(tower, sim.world.bodies);
      towerMoved = Math.max(towerMoved, Math.hypot(shift.x, shift.y));
    }
  }
  events.push(...sim.drainEvents());
  assert.ok(referee, 'the simulation made its referee');
  return {
    sim,
    referee,
    events,
    said: events.flatMap((e) => (e.type === 'log' && e.level === 'info' ? [e.text] : [])),
    towerMoved,
    pushed: [...new Set(pushed.map((p) => p.split(' at ')[0]))],
    towerBumps: events.flatMap((e) => (e.type === 'bump' && e.bodyId.startsWith('tower:') ? [`${e.bodyId} at ${e.time.toFixed(2)}`] : [])),
  };
}

/** Nothing went wrong: no error, no warning, no tower moved or bumped, no cube pushed before the claw took it, no cube in from the back. */
function assertClean(played: Played, what: string): void {
  assert.deepEqual(played.sim.vm.errors(), [], `${what}: errors`);
  const warnings = played.events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));
  assert.deepEqual(warnings, [], `${what}: warnings`);
  assert.ok(played.towerMoved < 0.01, `${what}: a tower moved ${played.towerMoved.toFixed(3)} mm`);
  assert.deepEqual(played.towerBumps, [], `${what}: the robot bumped into a tower`);
  assert.deepEqual(played.pushed, [], `${what}: pushed`);
  assert.ok(!played.said.some((line) => /from the back/.test(line)), `${what}: a cube went in from the back`);
}

const lineOf = (sim: Sim, id: string): ScoreLine => {
  const line = sim.score().lines.find((l) => l.id === id);
  assert.ok(line, id);
  return line;
};
const bodyOf = (sim: Sim, id: string) => {
  const body = sim.world.bodies.find((b) => b.id === id);
  assert.ok(body, id);
  return body;
};

/**
 * The deliveries of a match, "X 11.67, E 25.33": each cube under its tower, in order, with its time.
 * And each of them scores at the end: its line has 20 points and the time of that delivery.
 */
function deliveries(played: Played): string {
  return played.referee
    .deliveries()
    .map((d) => `${d.tower} ${d.time.toFixed(2)}`)
    .join(', ');
}

/** Every cube that scores: 20 points on its tower's line, in through the opening, within 0.1 mm of the middle of the white dashed square. */
function assertScored(played: Played, towers: Partial<Record<TowerId, CubePlace>>, what: string): void {
  const sim = played.sim;
  for (const tower of TOWER_IDS) {
    const line = lineOf(sim, towerLineId(tower));
    const place = towers[tower];
    if (place === undefined) {
      assert.equal(line.points, 0, `${what}: ${tower}`);
      continue;
    }
    assert.equal(line.points, 20, `${what}: ${tower} - ${line.detail}`);
    const delivery = played.referee.deliveries().find((d) => d.tower === tower);
    assert.ok(delivery && delivery.cube === cubeId(place), `${what}: the cube of ${place} under ${tower}`);
    assert.equal(line.time, delivery.time, `${what}: ${tower} scores the time of its delivery`);
    const stay = played.referee.stayOf(delivery.cube);
    assert.ok(stay && stay.tower === tower && stay.throughOpening, `${what}: in through the opening of ${tower}`);
    const cube = bodyOf(sim, delivery.cube);
    const middle = SQUARE_MIDDLES[tower];
    assert.ok(Math.hypot(cube.x - middle.x, cube.y - middle.y) < 0.1, `${what}: the cube under ${tower} ends ${Math.hypot(cube.x - middle.x, cube.y - middle.y).toFixed(3)} mm from the middle`);
  }
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

/** The notes a student reads on the blocks of a program (the comment bubbles). */
function notesOf(blocks: ProgramJson): string[] {
  return blocksOf(blocks)
    .map((block) => (block.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '')
    .filter((text) => text !== '');
}

/** A stack of blocks from its first block on (the top level only). */
function stack(first: BlockJson | undefined): BlockJson[] {
  const out: BlockJson[] = [];
  for (let block = first; block; block = block.next?.block) out.push(block);
  return out;
}

/** The blocks of the start script, in order (the top level only). */
function startScript(blocks: ProgramJson): BlockJson[] {
  const start = (blocks.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start');
  assert.ok(start);
  return stack(start.next?.block);
}

/** The my-block definition of that name. */
function definitionOf(blocks: ProgramJson, name: string): BlockJson {
  const found = (blocks.blocks?.blocks ?? []).find((block) => block.type === 'procedures_defnoreturn' && block.fields?.NAME === name);
  assert.ok(found, name);
  return found;
}

/** The blocks of a my-block's body (the top level only). */
function bodyOfDefinition(blocks: ProgramJson, name: string): BlockJson[] {
  return stack(definitionOf(blocks, name).inputs?.STACK?.block);
}

/** The number in a slot of a block (a plain number, as the builder writes it). */
function numberIn(block: BlockJson, slot: string): number {
  const value = block.inputs?.[slot]?.shadow?.fields?.NUM;
  assert.ok(value !== undefined && block.inputs?.[slot]?.block === undefined, `${block.type}: a plain number in ${slot}`);
  return Number(value);
}

/** A copy of a program with every "move ... cm" of one number changed to another (what a "Try ..." asks for). */
function withDistance(blocks: ProgramJson, from: number, to: number): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  let changed = 0;
  for (const block of blocksOf(copy)) {
    if (block.type === 'mbot2_straight_cm' && numberIn(block, 'DISTANCE') === from) {
      (block.inputs!.DISTANCE.shadow!.fields as { NUM: number }).NUM = to;
      changed++;
    }
  }
  assert.ok(changed > 0, `a move of ${from} cm`);
  return copy;
}

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
    const file = path.join(HERE, '../../../public', fireFighterGame.mat.sensorImageUrl ?? '');
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}
const picture = loadMatPicture();

/** Both mats: the drawing the tests play on, and the picture the browser reads (when it can be decoded). */
async function bothMats(): Promise<Array<[string, MatSampler | undefined]>> {
  const mat = await picture;
  return mat ? [['on the drawing', undefined], ['on the picture', mat]] : [['on the drawing', undefined]];
}

/** A start pose moved (mm: + right / + down, as the screen shows the mat) and turned (degrees: + to the right). */
const startAt = (dx: number, dy: number, degrees = 0): Pose => ({ x: START_POSE.x + dx, y: START_POSE.y + dy, heading: START_POSE.heading + degrees * DEG });
/** The robot fits the Fire Station there (what the screen allows before Start). */
const fits = (pose: Pose): boolean => poseFits(FIRE_FIGHTER_ROBOT, FIRE_STATION, pose);

// =============================================================================================
// The list
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples: three for starters, two in between, one advanced', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'fighter-first-grab starter',
        'fighter-line-to-t starter',
        'fighter-yellow-x starter',
        'fighter-left-bay intermediate',
        'fighter-right-bay intermediate',
        'fighter-whole-mission advanced',
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
      EXAMPLE_LEVELS.map((level) => `${level.id} ${level.title}`),
      ['starter Starter', 'intermediate Intermediate', 'advanced Advanced'],
    );
    for (const level of EXAMPLE_LEVELS) assert.ok(level.about.length > 8 && level.about.length < 40, level.id);
  });

  test('every id starts with "fighter-", and no id, title or heading is used by an example of the other five games', () => {
    const others = [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...WAREHOUSE_SORT_CATALOG, ...LOCKER_ROOM_CATALOG, ...FIRE_CADET_CATALOG];
    assert.equal(others.length, 7 + 6 + 6 + 6 + 6);
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...others, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^fighter-[a-z]+(-[a-z]+)*$/, card.id);
    for (const card of others) assert.ok(!card.id.startsWith('fighter-'), card.id);
    // the words after a heading are this game's own
    const otherAbouts = new Set([...FIRE_RESCUE_LEVELS, ...FIRE_CHIEF_LEVELS, ...WAREHOUSE_SORT_LEVELS, ...LOCKER_ROOM_LEVELS, ...FIRE_CADET_LEVELS].map((level) => level.about));
    assert.equal(otherAbouts.size, 15);
    for (const level of EXAMPLE_LEVELS) assert.ok(!otherAbouts.has(level.about), level.about);
    // a student of 8 to 10 reads the titles: short, no apostrophe - and none says "straight": the straight way from the
    // yellow square leads into the back of tower X, where a cube does not count
    for (const card of SAMPLE_CATALOG) {
      assert.ok(card.title.length >= 4 && card.title.length <= 40, card.title);
      assert.ok(!card.title.includes("'"), card.title);
      assert.doesNotMatch(card.title, /straight/i, card.title);
    }
  });

  test('every description says, in short plain sentences, what the program does and what it scores - as the tests below measure it', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 750, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      // ages 8 to 10: short sentences
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 125, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
      // no text promises more than a match can give
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= MAX_SCORE, `${s.id}: ${number} points`);
      // no text leads a student into the back of tower X
      for (const text of [s.description, ...notesOf(s.program)]) assert.doesNotMatch(text, /straight/i, s.id);
    }
    // the numbers and the facts each one promises, as the tests below measure them
    const promised: Record<string, RegExp[]> = {
      'fighter-first-grab': [
        /The robot drives forward 18\.93 cm, to the yellow cube\./,
        /Now the cube stands between the open fingers of the claw\./,
        /the screen says "I have the yellow cube"/,
        /Then the arm goes down again: the claw still holds the cube\./,
        /This scores no points: a cube scores only under its tower\./,
        /Try 15 cm: the robot stops too soon, and the claw catches nothing\.$/,
      ],
      'fighter-line-to-t': [
        /First the robot drives 11 cm: then its line sensor is past the picture of the Fire Station\. That picture has dark spots that are not a line\./,
        /All four probes on black: the robot is at the T\. It drives 3\.14 cm more and closes the claw on the yellow cube\./,
        /This scores no points\./,
        /Try to move the robot 1 cm to the side, or turn it a little, before you press Start: it still finds the line and the cube\./,
        /the right motor \(EM2\) is mounted the other way round: a negative speed drives it forward\.$/,
      ],
      'fighter-yellow-x': [
        /X must be the robot's next delivery once it has taken the yellow cube\./,
        /The opening of tower X faces the top of the mat\./,
        /A cube pushed into the back of a tower does not count\./,
        /So it lets go 1 cm before the tower and backs off 5\.5 cm\. Then it closes its empty claw and pushes the cube into the white dashed square\./,
        /The letter X shows: 20 points, in 12 seconds\./,
        /Back off more than 5 cm before you close the claw: closed sooner, it grabs the cube again\./,
        /start it exactly where the simulator puts it\.$/,
      ],
      'fighter-left-bay': [
        /The upper one goes to tower E at the park \(top left\), the lower one to tower M at the school \(bottom left\)\./,
        /"slide the cube in": the same at every tower\./,
        /40 points in 30 seconds\./,
        /It drives by distance only: turned 1 degree at the start, it scores nothing\.$/,
      ],
      'fighter-right-bay': [
        /The upper red cube goes to tower K at the bakery \(top right\), the lower one to tower A at the hospital \(bottom right\)\./,
        /The robot first drives 13 cm up, then turns right\. Lower down, its claw would hit tower A when it turns on the right line\./,
        /40 points in 29 seconds\./,
        /It drives by distance only: turned 1 degree at the start, it scores nothing\.$/,
      ],
      'fighter-whole-mission': [
        /^All five letters, M A K E X, for 100 points\./,
        /First the yellow cube to X: once the robot has taken it, X is its very next delivery, so it counts\./,
        /Moved 5 mm to the side, it loses points\. Turned 1 degree, it loses them all\./,
        /Done in 70 seconds of the 180\.$/,
      ],
    };
    for (const s of SAMPLE_PROGRAMS) for (const promise of promised[s.id]) assert.match(s.description, promise, s.id);
    assert.equal(MATCH_DURATION, 180);
    // the numbers the texts name are the numbers of the blocks
    assert.equal(TO_YELLOW_CM, 18.93);
    assert.equal(TOO_SHORT_CM, 15);
    assert.equal(PAST_THE_PICTURE_CM, 11);
    assert.equal(T_TO_YELLOW_CM, 3.14);
    assert.equal(DELIVERY.backOff, 5.5);
    assert.equal(UP_FIRST_CM, 13);
    // every example that drives by distance to a cube says on its first block that a real robot drifts
    for (const id of ['fighter-yellow-x', 'fighter-left-bay', 'fighter-right-bay', 'fighter-whole-mission']) {
      const first = (blocks: ProgramJson) => (blocks.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start');
      const said = (first(sample(id).program)?.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '';
      assert.match(said, /A real robot drifts a little/, id);
    }
    // the delivery's trap is said on the block where it is set: back off MORE than 5 cm (5.0 cm is not enough: "the trap" below)
    for (const id of ['fighter-yellow-x', 'fighter-left-bay', 'fighter-right-bay', 'fighter-whole-mission']) {
      assert.ok(notesOf(sample(id).program).some((text) => /Back off more than 5 cm, or the closing claw grabs the cube again\./.test(text)), id);
    }
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Fire Fighter stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/fire-fighter/sample-catalog.ts';
  const SAMPLES = 'simulator/fire-fighter/samples.ts';
  // the only file that imports them
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
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/core/types', 'simulator/fire-fighter/sample-catalog', 'simulator/vm/builder']);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'fighter-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test("nothing imports them but each other and the server's list of all examples - no file of the simulator screen, no page (and the tests)", () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers(CATALOG), [SAMPLES, SERVER_LIST]);
    assert.deepEqual(importers(SAMPLES), [SERVER_LIST]);
    // the game itself does not reach them: the page imports the game
    for (const file of ['simulator/fire-fighter/game.ts', 'simulator/fire-fighter/field.ts', 'simulator/fire-fighter/robot.ts', 'simulator/fire-fighter/scenario.ts', 'simulator/fire-fighter/play.ts']) {
      const text = files.get(file);
      assert.ok(text, file);
      assert.ok(!importsOf(file, text).some((target) => target.endsWith('sample-catalog') || target.endsWith('samples')), file);
    }
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
  test('only blocks of the Fire Fighter palette (the categories of Fire Rescue), all of them known to the interpreter', () => {
    const allowed = new Set([...paletteBlockTypes('fire-fighter'), ...BUILTIN_BLOCK_TYPES]);
    for (const s of SAMPLE_PROGRAMS) {
      const types = new Set(blocksOf(s.program).map((block) => block.type));
      for (const type of types) {
        assert.ok(allowed.has(type), `${s.id} uses ${type}`);
        assert.ok(supportsBlock(type), `${s.id}: the interpreter knows ${type}`);
      }
      // (my-blocks are plain "define" blocks: mBlock has no my-block that gives back a value)
      assert.ok(!types.has('procedures_defreturn') && !types.has('procedures_callreturn') && !types.has('procedures_ifreturn'), s.id);
      // no block that reads where the robot points: the examples move by "forward" and "turn" only
      assert.ok(![...types].some((type) => /yaw|rotation|angle|gyro/.test(type)), s.id);
      // the examples drive at the speed of the "move ... cm" and "turn ..." blocks, and use no variables
      assert.equal(s.program.variables?.length ?? 0, 0, s.id);
    }
  });

  test('each example shows the blocks it is about, and a starter is short', () => {
    const uses = (id: string): Set<string> => new Set(blocksOf(sample(id).program).map((block) => block.type));
    const count = (id: string, type: string): number => blocksOf(sample(id).program).filter((block) => block.type === type).length;
    for (const type of ['mbot2_straight_cm', 'gripper_claw', 'gripper_arm', 'cyberpi_led_color', 'cyberpi_print']) assert.ok(uses('fighter-first-grab').has(type), type);
    for (const type of ['control_repeat_until', 'sensing_quadrgb_status_is', 'sensing_quadrgb_probe_detects', 'operator_and', 'operator_or', 'mbot2_move_direction', 'mbot2_drive_speed', 'mbot2_stop']) {
      assert.ok(uses('fighter-line-to-t').has(type), type);
    }
    // the third starter writes the delivery out, block by block; the others call the my-block "slide the cube in" once per tower
    assert.ok(!uses('fighter-yellow-x').has('procedures_defnoreturn'));
    for (const [id, towers] of [
      ['fighter-left-bay', 2],
      ['fighter-right-bay', 2],
      ['fighter-whole-mission', 5],
    ] as const) {
      definitionOf(sample(id).program, SLIDE_IN);
      assert.equal(count(id, 'procedures_callnoreturn'), towers, id);
    }
    // only the first starter lifts the arm: every other cube is carried on the mat, in the closed claw
    for (const s of SAMPLE_PROGRAMS) if (s.id !== 'fighter-first-grab') assert.ok(!uses(s.id).has('gripper_arm'), s.id);
    // a starter is short; the advanced example is the longest
    const size = (id: string): number => blocksOf(sample(id).program).filter((block) => block.type !== 'math_number' && block.type !== 'text').length;
    for (const card of SAMPLE_CATALOG) {
      if (card.level === 'starter') assert.ok(size(card.id) <= 25, `${card.id}: ${size(card.id)} blocks`);
      assert.ok(size(card.id) <= size('fighter-whole-mission'), card.id);
    }
  });

  test('the delivery is the same at every tower: the six blocks of the third starter are the body of "slide the cube in"', () => {
    const shape = (blocks: BlockJson[]): string[] =>
      blocks.map((block) => `${block.type} ${String(block.fields?.ACTION ?? block.fields?.DIRECTION ?? '')} ${block.type === 'mbot2_straight_cm' ? numberIn(block, 'DISTANCE') : ''}`.trim());
    const expected = ['gripper_claw open', `mbot2_straight_cm backward ${DELIVERY.backOff}`, 'gripper_claw close', `mbot2_straight_cm forward ${DELIVERY.push}`, `mbot2_straight_cm backward ${DELIVERY.clear}`, 'gripper_claw open'];
    assert.deepEqual(shape(startScript(sample('fighter-yellow-x').program).slice(-6)), expected);
    for (const id of ['fighter-left-bay', 'fighter-right-bay', 'fighter-whole-mission']) assert.deepEqual(shape(bodyOfDefinition(sample(id).program, SLIDE_IN)), expected, id);
    // the closed claw pushes the cube from 0.5 cm behind it: as far as it backed off, plus the 5 mm the claw's tips stood behind the cube
    assert.equal(DELIVERY.push - DELIVERY.backOff, 0.5);
    assert.ok(DELIVERY.clear >= DELIVERY.push, 'it backs off at least as far as it pushed');
    const closed = GRIPPER.clawClosedGap + 2 * GRIPPER.fingerThickness;
    const holding = 50 + 2 * GRIPPER.fingerThickness;
    assert.ok(closed < 60 && holding > 60, `the claw is ${closed} mm wide closed and ${holding} mm holding a cube; the sides of a tower stand 60 mm apart`);
  });

  test('the numbers in the blocks are the ones of field.ts: the claw closes on the middle of every cube, every cube is let go 1 cm before its tower', () => {
    // a little robot that drives the blocks exactly, as the simulator does (heading in degrees, 0 = up, clockwise)
    class Walker {
      constructor(
        public x: number,
        public y: number,
        public h: number,
      ) {}
      forward(mm: number): void {
        this.x += mm * Math.sin(this.h * DEG);
        this.y -= mm * Math.cos(this.h * DEG);
      }
      /** a point `ahead` mm in front of the middle */
      ahead(mm: number): { x: number; y: number } {
        return { x: this.x + mm * Math.sin(this.h * DEG), y: this.y - mm * Math.cos(this.h * DEG) };
      }
    }
    /** where the robot stands to let a cube go: facing the opening of the tower, the front of the cube (the tips of the claw) 10 mm before the tower */
    const deliveryPoint = (tower: TowerId): { x: number; y: number; h: number } => {
      const m = TOWER_MIDDLES[tower];
      const top = OPENING[tower] === 'top';
      const face = top ? m.y - TOWER_DEPTH / 2 : m.y + TOWER_DEPTH / 2;
      return { x: m.x, y: top ? face - 10 - TIPS : face + 10 + TIPS, h: top ? 180 : 0 };
    };
    /** the black lines as rectangles: a turn on one of them is a turn on the line */
    const onALine = (p: { x: number; y: number }): boolean =>
      Object.values(LINES).some(([a, b]) => {
        const half = LINE_WIDTH / 2;
        if (a.x === b.x) return Math.abs(p.x - a.x) < 0.2 && p.y >= Math.min(a.y, b.y) - half && p.y <= Math.max(a.y, b.y) + half;
        return Math.abs(p.y - a.y) < 0.2 && p.x >= Math.min(a.x, b.x) - half && p.x <= Math.max(a.x, b.x) + half;
      });
    const near = (a: { x: number; y: number }, b: { x: number; y: number }, mm: number, what: string): void => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d <= mm, `${what}: ${d.toFixed(3)} mm apart`);
    };
    const facing = (h: number, wanted: number): boolean => Math.abs((((h - wanted) % 360) + 360) % 360) < 1e-9;
    const towerBase = (tower: TowerId) => ({ x: TOWER_MIDDLES[tower].x - TOWER_WIDTH / 2, y: TOWER_MIDDLES[tower].y - TOWER_DEPTH / 2, w: TOWER_WIDTH, h: TOWER_DEPTH });
    const toRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): number => {
      const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
      const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
      return Math.hypot(dx, dy);
    };

    // the robot after the yellow cube's way to the top of tower X (the corners of that way are not on a line, but named)
    const yellowCorners = (() => {
      const w = new Walker(START_POSE.x, START_POSE.y, 0);
      w.forward(TO_YELLOW_CM * 10);
      const corners: Array<{ x: number; y: number }> = [];
      w.h = -90;
      w.forward(AROUND_THE_HYDRANT.left * 10);
      corners.push({ x: w.x, y: w.y });
      w.h = 0;
      w.forward(AROUND_THE_HYDRANT.up * 10);
      corners.push({ x: w.x, y: w.y });
      w.h = 90;
      w.forward(AROUND_THE_HYDRANT.right * 10);
      corners.push({ x: w.x, y: w.y });
      return corners;
    })();

    interface Walked {
      takes: string[];
      deliveries: TowerId[];
    }
    /** Drive the blocks of a program (the start script, and the my-blocks it calls), and check every take, every delivery and every turn on the way. */
    const walk = (s: SampleProgram): Walked => {
      const w = new Walker(START_POSE.x, START_POSE.y, (START_POSE.heading * 180) / Math.PI);
      const walked: Walked = { takes: [], deliveries: [] };
      let deliveryEnd: { x: number; y: number } | null = null;
      const run = (blocks: BlockJson[]): void => {
        blocks.forEach((block, i) => {
          const next = blocks[i + 1];
          if (block.type === 'procedures_callnoreturn') {
            run(bodyOfDefinition(s.program, (block.extraState as { name: string }).name));
          } else if (block.type === 'mbot2_straight_cm') {
            w.forward((block.fields?.DIRECTION === 'backward' ? -1 : 1) * numberIn(block, 'DISTANCE') * 10);
          } else if (block.type === 'mbot2_turn_deg') {
            // every turn: on a black line, at the end of a delivery, or at a corner of the yellow way - and never where the open claw would sweep into a tower
            const at = { x: w.x, y: w.y };
            const named = (deliveryEnd !== null && Math.hypot(at.x - deliveryEnd.x, at.y - deliveryEnd.y) < 0.2) || yellowCorners.some((c) => Math.hypot(at.x - c.x, at.y - c.y) < 1e-6);
            assert.ok(onALine(at) || named, `${s.id}: a turn at (${at.x.toFixed(2)}, ${at.y.toFixed(2)}) is on no line`);
            for (const tower of TOWER_IDS) assert.ok(toRect(at, towerBase(tower)) > SWEEP + 5, `${s.id}: a turn at (${at.x.toFixed(1)}, ${at.y.toFixed(1)}) sweeps within 5 mm of tower ${tower}`);
            w.h += (block.fields?.DIRECTION === 'left' ? -1 : 1) * numberIn(block, 'ANGLE');
          } else if (block.type === 'gripper_claw' && block.fields?.ACTION === 'close' && blocks[i - 1]?.type === 'mbot2_straight_cm' && blocks[i - 1].fields?.DIRECTION === 'forward') {
            // a take: the middle of the claw on the middle of a cube, the robot facing a side of it
            const claw = w.ahead(GRIP);
            const place = (Object.keys(CUBE_HOMES) as CubePlace[]).find((p) => Math.hypot(claw.x - CUBE_HOMES[p].x, claw.y - CUBE_HOMES[p].y) < 5);
            assert.ok(place, `${s.id}: the claw closes at (${claw.x.toFixed(1)}, ${claw.y.toFixed(1)}), on no cube`);
            near(claw, CUBE_HOMES[place], 0.2, `${s.id}: the claw on the cube of ${place}`);
            assert.ok(facing(w.h, Math.round(w.h / 90) * 90), `${s.id}: square to the cube`);
            walked.takes.push(place);
          } else if (block.type === 'gripper_claw' && block.fields?.ACTION === 'open' && next?.type === 'mbot2_straight_cm' && next.fields?.DIRECTION === 'backward') {
            // a delivery: let go facing the opening of a tower, the front of the cube 1 cm before it
            const tower = TOWER_IDS.find((t) => Math.hypot(w.x - deliveryPoint(t).x, w.y - deliveryPoint(t).y) < 5);
            assert.ok(tower, `${s.id}: the claw opens at (${w.x.toFixed(1)}, ${w.y.toFixed(1)}), in front of no tower`);
            near(w, deliveryPoint(tower), 0.2, `${s.id}: let go in front of tower ${tower}`);
            assert.ok(facing(w.h, deliveryPoint(tower).h), `${s.id}: facing the opening of tower ${tower}`);
            walked.deliveries.push(tower);
            deliveryEnd = w.ahead(-(DELIVERY.backOff - DELIVERY.push + DELIVERY.clear) * 10);
          }
        });
      };
      run(startScript(s.program));
      return walked;
    };

    assert.deepEqual(walk(sample('fighter-first-grab')), { takes: ['yellow'], deliveries: [] });
    assert.deepEqual(walk(sample('fighter-yellow-x')), { takes: ['yellow'], deliveries: ['X'] });
    assert.deepEqual(walk(sample('fighter-left-bay')), { takes: ['red-left-upper', 'red-left-lower'], deliveries: ['E', 'M'] });
    assert.deepEqual(walk(sample('fighter-right-bay')), { takes: ['red-right-upper', 'red-right-lower'], deliveries: ['K', 'A'] });
    assert.deepEqual(walk(sample('fighter-whole-mission')), { takes: ['yellow', 'red-left-upper', 'red-left-lower', 'red-right-lower', 'red-right-upper'], deliveries: ['X', 'E', 'M', 'A', 'K'] });

    // ---- the numbers worked out from field.ts once more, the way the comments of samples.ts say (rounded to 0.1 mm)
    const cm = (mm: number): number => Math.round(mm) / 10;
    const cm2 = (mm: number): number => Math.round(mm * 10) / 100;
    assert.equal(TO_YELLOW_CM, cm2(START_POSE.y - GRIP - CUBE_HOMES.yellow.y), 'the yellow cube is 18.93 cm ahead of the claw');
    assert.equal(AROUND_THE_HYDRANT.right, AROUND_THE_HYDRANT.left, 'back over the middle of tower X');
    assert.ok(Math.abs(START_POSE.x - TOWER_MIDDLES.X.x) < 0.01, 'the Fire Station stem is the middle line of tower X');
    const top = START_POSE.y - (TO_YELLOW_CM + AROUND_THE_HYDRANT.up) * 10;
    assert.equal(AROUND_THE_HYDRANT.down, cm2(deliveryPoint('X').y - top), 'down to the delivery point of X');
    // going up beside tower X, the robot (65 mm from its middle to its side) passes it with 36 mm to spare
    const besideX = TOWER_MIDDLES.X.x - TOWER_WIDTH / 2 - (START_POSE.x - AROUND_THE_HYDRANT.left * 10 + REACH.halfWidth);
    assert.ok(besideX > 35 && besideX < 37, `${besideX.toFixed(1)} mm beside tower X`);
    assert.equal(LEFT_BAY.toLine, cm2(START_POSE.x - LEFT_LINE_X));
    assert.equal(RIGHT_BAY.toLine, cm2(RIGHT_LINE_X - START_POSE.x));
    assert.equal(LEFT_BAY.toCube, cm2(LEFT_LINE_X - GRIP - CUBE_HOMES['red-left-upper'].x));
    assert.equal(LEFT_BAY.toLowerCube, cm2(LEFT_LINE_X - GRIP - CUBE_HOMES['red-left-lower'].x));
    assert.equal(RIGHT_BAY.toCube, cm2(CUBE_HOMES['red-right-upper'].x - GRIP - RIGHT_LINE_X));
    assert.equal(RIGHT_BAY.toLowerCube, cm2(CUBE_HOMES['red-right-lower'].x - GRIP - RIGHT_LINE_X));
    assert.equal(LEFT_BAY.toE, cm2(LEFT_LINE_X - TOWER_MIDDLES.E.x));
    assert.equal(LEFT_BAY.toM, cm2(LEFT_LINE_X - TOWER_MIDDLES.M.x));
    assert.equal(RIGHT_BAY.toK, cm2(TOWER_MIDDLES.K.x - RIGHT_LINE_X));
    assert.equal(RIGHT_BAY.toA, cm2(TOWER_MIDDLES.A.x - RIGHT_LINE_X));
    assert.equal(MISSION_WAYS.xToLeftLine, LEFT_BAY.toLine);
    assert.equal(MISSION_WAYS.mToRightLine, cm(RIGHT_LINE_X - TOWER_MIDDLES.M.x));
    // the bay examples drive 13 cm up first: the turn on the right line then sweeps clear of tower A ("why 13 cm up" below plays 10)
    assert.ok(toRect({ x: RIGHT_LINE_X, y: START_POSE.y - UP_FIRST_CM * 10 }, towerBase('A')) > SWEEP);
    assert.ok(toRect({ x: RIGHT_LINE_X, y: START_POSE.y - 10 * 10 }, towerBase('A')) < SWEEP);
    // the line follower looks at the line only when its sensor has left the Fire Station picture (and its spots)
    assert.ok(START_POSE.y - PAST_THE_PICTURE_CM * 10 - FIRE_FIGHTER_ROBOT.quadRgb.forward < FIRE_STATION.y);
    assert.ok(START_POSE.y - 8 * 10 - FIRE_FIGHTER_ROBOT.quadRgb.forward > FIRE_STATION.y);
    assert.equal(ALL_FOUR_ON_THE_LINE, 0b1111);
    assert.ok(STEER_SLOW_RPM < STEER_FAST_RPM && FOLLOW_RPM === STEER_FAST_RPM);
  });
});

// =============================================================================================
// 1. fighter-first-grab
// =============================================================================================

describe('fighter-first-grab: the yellow cube', () => {
  const s = sample('fighter-first-grab');

  test('0 points; the claw takes the yellow cube at 1.29 s and still holds it at the end, after 2.32 s; the screen and the LEDs; nothing else moves', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const { sim } = played;
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(sim.score().total, 0, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.ok(Math.abs(sim.world.time - 2.32) < 0.05, `${what}: ends at ${sim.world.time}`);
      assert.equal(sim.world.robot.gripper.holding, YELLOW_CUBE_ID, what);
      assert.deepEqual(sim.world.robot.screen.lines, ['Fire Fighter!', 'I have the yellow cube'], what);
      for (const led of sim.world.robot.leds) assert.deepEqual([led.r, led.g, led.b], [255, 208, 0], `${what}: the LEDs are yellow`);
      assert.deepEqual(played.said, ['The robot took the yellow cube. Now tower X must be its next delivery.'], what);
      const collected = played.referee.yellowRule().collectedAt;
      assert.ok(collected !== null && Math.abs(collected - 1.29) < 0.05, `${what}: taken at ${collected}`);
      for (const id of CUBE_IDS) if (id !== YELLOW_CUBE_ID) assert.deepEqual([bodyOf(sim, id).x, bodyOf(sim, id).y], [bodyOf(sim, id).home.x, bodyOf(sim, id).home.y], `${what}: ${id}`);
    }
  });

  test(`the try of the description: ${TOO_SHORT_CM} cm - the robot stops too soon, the claw catches nothing and moves nothing (from 16.5 cm on it catches the cube)`, () => {
    for (const [cm, catches] of [
      [TOO_SHORT_CM, false],
      [16.25, false],
      [16.5, true],
    ] as const) {
      const played = play(withDistance(s.program, TO_YELLOW_CM, cm));
      assert.equal(played.sim.world.robot.gripper.holding, catches ? YELLOW_CUBE_ID : null, `${cm} cm`);
      assertClean(played, `${cm} cm`);
      if (!catches) assert.deepEqual(played.said, [], `${cm} cm: the referee says nothing`);
    }
  });
});

// =============================================================================================
// 2. fighter-line-to-t
// =============================================================================================

describe('fighter-line-to-t: the line follower to the T', () => {
  const s = sample('fighter-line-to-t');

  test('0 points; it finds the T at 1.22 s, drives 3.14 cm more and takes the yellow cube; it ends after 1.54 s on the Fire Station stem', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const { sim } = played;
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(sim.score().total, 0, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.ok(Math.abs(sim.world.time - 1.54) < 0.05, `${what}: ends at ${sim.world.time}`);
      assert.equal(sim.world.robot.gripper.holding, YELLOW_CUBE_ID, what);
      assert.deepEqual(sim.world.robot.screen.lines, ['T found'], what);
      const pose = sim.world.robot.pose;
      assert.ok(Math.abs(pose.y - 969.36) < 0.05 && Math.abs(pose.x - START_POSE.x) < 0.01 && pose.heading === 0, `${what}: ends at ${pose.x}, ${pose.y}`);
      // the claw closed within 0.5 mm of the middle of the cube
      assert.ok(Math.abs(pose.y - GRIP - CUBE_HOMES.yellow.y) < 0.5, what);
    }
    // when it finds the T: "T found" is on the screen from 1.22 s on
    const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: s.program });
    sim.start();
    let found = -1;
    while (sim.status === 'running') {
      sim.step(1);
      if (found < 0 && sim.world.robot.screen.lines.includes('T found')) found = sim.world.time;
    }
    assert.ok(Math.abs(found - 1.22) < 0.02, `"T found" at ${found}`);
  });

  test('the try of the description: moved 1 cm to the side, or turned a little (up to the 6 degrees the Fire Station allows), it still finds the line and takes the cube', async () => {
    const starts: Array<[string, Pose]> = [
      ['10 mm to the left', startAt(-10, 0)],
      ['10 mm to the right', startAt(10, 0)],
      ['turned 6 degrees to the left', startAt(0, 0, -6)],
      ['turned 3 degrees to the left', startAt(0, 0, -3)],
      ['turned 3 degrees to the right', startAt(0, 0, 3)],
      ['turned 6 degrees to the right', startAt(0, 0, 6)],
      ['10 mm to the left, turned 6 degrees to the left', startAt(-10, 0, -6)],
      ['10 mm to the left, turned 6 degrees to the right', startAt(-10, 0, 6)],
      ['10 mm to the right, turned 6 degrees to the left', startAt(10, 0, -6)],
      ['10 mm to the right, turned 6 degrees to the right', startAt(10, 0, 6)],
    ];
    for (const [mat, sampler] of await bothMats()) {
      for (const [what, startPose] of starts) {
        assert.ok(fits(startPose), `${what}: the robot fits the Fire Station`);
        const played = play(s.program, { sampler, startPose });
        assert.equal(played.sim.world.robot.gripper.holding, YELLOW_CUBE_ID, `${mat}, ${what}`);
        assert.equal(played.sim.score().total, 0);
        assert.ok(played.towerMoved < 0.01 && played.towerBumps.length === 0, `${mat}, ${what}: no tower`);
      }
    }
    // (the Fire Station does not let the robot turn further where it stands)
    assert.ok(!fits(startAt(0, 0, 7)) && !fits(startAt(0, 0, -7)));
  });

  test('how far is too far: 15 mm to the side misses the cube on the picture (not on the drawing), 20 mm on both', async () => {
    for (const dx of [-20, 20]) assert.equal(play(s.program, { startPose: startAt(dx, 0) }).sim.world.robot.gripper.holding, null, `${dx} mm`);
    for (const dx of [-15, 15]) assert.equal(play(s.program, { startPose: startAt(dx, 0) }).sim.world.robot.gripper.holding, YELLOW_CUBE_ID, `${dx} mm on the drawing`);
    const mat = await picture;
    if (!mat) return;
    for (const dx of [-20, -15, 15, 20]) assert.equal(play(s.program, { sampler: mat, startPose: startAt(dx, 0) }).sim.world.robot.gripper.holding, null, `${dx} mm on the picture`);
  });

  test(`why it drives ${PAST_THE_PICTURE_CM} cm first: on the picture of the mat, after 8 cm it finds a "T" in the Fire Station picture and stops there`, async (t) => {
    const early = withDistance(s.program, PAST_THE_PICTURE_CM, 8);
    // on the drawing the picture is one flat colour: it gets there all the same
    assert.equal(play(early).sim.world.robot.gripper.holding, YELLOW_CUBE_ID);
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const played = play(early, { sampler: mat });
    assert.equal(played.sim.world.robot.gripper.holding, null);
    assert.deepEqual(played.sim.world.robot.screen.lines, ['T found']);
    // it saw its "T" as soon as it looked - with its line sensor over the Fire Station picture - and closed the claw 3.14 cm further on
    const sawIt = played.sim.world.robot.pose.y + T_TO_YELLOW_CM * 10;
    assert.ok(Math.abs(sawIt - (START_POSE.y - 8 * 10)) < 1, `it saw a "T" at y ${sawIt.toFixed(1)}`);
    assert.ok(sawIt - FIRE_FIGHTER_ROBOT.quadRgb.forward > FIRE_STATION.y, 'its line sensor was over the Fire Station picture');
  });
});

// =============================================================================================
// 3. fighter-yellow-x
// =============================================================================================

describe('fighter-yellow-x: the yellow cube under tower X, from above', () => {
  const s = sample('fighter-yellow-x');

  test('20 points: the yellow cube under X at 11.67 s, through the opening, and X was the next delivery after the robot took it; it ends after 12.41 s', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const { sim } = played;
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(sim.score().total, 20, what);
      assert.equal(deliveries(played), 'X 11.67', what);
      assertScored(played, { X: 'yellow' }, what);
      assert.equal(played.referee.yellowRule().direct, 'yes', what);
      assert.ok(Math.abs((played.referee.yellowRule().collectedAt ?? 0) - 1.29) < 0.05, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.ok(Math.abs(sim.world.time - 12.41) < 0.05, `${what}: ends at ${sim.world.time}`);
      assert.deepEqual(
        played.said,
        ['The robot took the yellow cube. Now tower X must be its next delivery.', 'The yellow cube is under tower X: the letter X shows.'],
        what,
      );
      assert.equal(sim.world.props?.find((p) => p.id === 'letter:X')?.label, 'X', `${what}: the letter X shows on its flap`);
      // the cube sits within 0.01 mm of the middle of the white dashed square
      const cube = bodyOf(sim, YELLOW_CUBE_ID);
      assert.ok(Math.hypot(cube.x - SQUARE_MIDDLES.X.x, cube.y - SQUARE_MIDDLES.X.y) < 0.01, what);
    }
  });

  test('the trap of its note: backing off 5.0 cm before the claw closes is not enough - it grabs the cube again and pulls it back out; 5.05 cm is enough', () => {
    const trying = (back: number): ProgramJson => {
      // the delivery with another back-off, and a push that brings the cube to the same place
      return buildProgram([
        script(whenStart(), [
          ...blocksAsNodes(s.program, -6),
          gripper('open'),
          moveCm('backward', back),
          gripper('close'),
          moveCm('forward', DELIVERY.push + back - DELIVERY.backOff),
          moveCm('backward', DELIVERY.clear),
          gripper('open'),
        ]),
      ]);
    };
    const tooSoon = play(trying(5));
    assert.equal(tooSoon.sim.score().total, 0);
    assert.equal(tooSoon.events.filter((e) => e.type === 'grab' && e.bodyId === YELLOW_CUBE_ID).length, 2, 'the claw grabs the yellow cube a second time');
    assert.equal(lineOf(tooSoon.sim, towerLineId('X')).detail, 'No cube under tower X.');
    const enough = play(trying(5.05));
    assert.equal(enough.sim.score().total, 20);
    assert.equal(enough.events.filter((e) => e.type === 'grab').length, 1);
    // why exactly 5 cm is not enough here: the claw closed on the cube after 189.30 mm of driving, 0.03 mm more than the
    // 189.27 mm to its middle - so the cube sits 0.03 mm deeper than the middle of the claw, and 5.0 cm back the tips of
    // the fingers are still over its back (a cube in the very middle of the claw comes free at 5.0 cm: ./game.test.ts)
    const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: s.program });
    sim.start();
    let depth = Number.NaN;
    while (sim.status === 'running' && Number.isNaN(depth)) {
      sim.step(1);
      if (sim.drainEvents().some((e) => e.type === 'grab')) {
        const { pose } = sim.world.robot;
        const cube = bodyOf(sim, YELLOW_CUBE_ID);
        depth = GRIP - ((cube.x - pose.x) * Math.sin(pose.heading) - (cube.y - pose.y) * Math.cos(pose.heading));
      }
    }
    assert.ok(Math.abs(depth - (TO_YELLOW_CM * 10 - (START_POSE.y - GRIP - CUBE_HOMES.yellow.y))) < 1e-6, `the cube sits ${depth.toFixed(4)} mm deeper`);
    assert.ok(depth > 0.02 && depth < 0.03, `the cube sits ${depth.toFixed(4)} mm deeper than the middle of the claw`);
  });
});

/**
 * The start script of a program as builder blocks again, without its last `drop` blocks (negative:
 * from the end) - so that a test can put other blocks at its end. Only the blocks the yellow way uses.
 */
function blocksAsNodes(blocks: ProgramJson, drop: number): BlockNode[] {
  return startScript(blocks)
    .slice(0, drop)
    .map((block) => {
      if (block.type === 'mbot2_straight_cm') return moveCm(block.fields?.DIRECTION === 'backward' ? 'backward' : 'forward', numberIn(block, 'DISTANCE'));
      if (block.type === 'gripper_claw') return gripper(block.fields?.ACTION === 'open' ? 'open' : 'close');
      if (block.type === 'mbot2_turn_deg') return turn(block.fields?.DIRECTION === 'left' ? 'left' : 'right', numberIn(block, 'ANGLE'));
      throw new Error(`blocksAsNodes does not know "${block.type}"`);
    });
}

// =============================================================================================
// 4. and 5. the two bays
// =============================================================================================

describe('fighter-left-bay: two red cubes to the park and the school', () => {
  const s = sample('fighter-left-bay');

  test('40 points: the upper red cube under E at 15.27 s, the lower one under M at 29.46 s, through their openings; it ends after 30.20 s', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(played.sim.score().total, 40, what);
      assert.equal(deliveries(played), 'E 15.27, M 29.46', what);
      assertScored(played, { E: 'red-left-upper', M: 'red-left-lower' }, what);
      assert.ok(Math.abs(played.sim.world.time - 30.2) < 0.05, `${what}: ends at ${played.sim.world.time}`);
      for (const id of [YELLOW_CUBE_ID, cubeId('red-right-upper'), cubeId('red-right-lower')]) {
        const cube = bodyOf(played.sim, id);
        assert.deepEqual([cube.x, cube.y, cube.angle], [cube.home.x, cube.home.y, cube.home.angle], `${what}: ${id} never moves`);
      }
    }
  });
});

describe('fighter-right-bay: two red cubes to the bakery and the hospital', () => {
  const s = sample('fighter-right-bay');

  test('40 points: the upper red cube under K at 14.76 s, the lower one under A at 28.24 s, through their openings; it ends after 28.98 s', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(played.sim.score().total, 40, what);
      assert.equal(deliveries(played), 'K 14.76, A 28.24', what);
      assertScored(played, { K: 'red-right-upper', A: 'red-right-lower' }, what);
      assert.ok(Math.abs(played.sim.world.time - 28.98) < 0.05, `${what}: ends at ${played.sim.world.time}`);
      for (const id of [YELLOW_CUBE_ID, cubeId('red-left-upper'), cubeId('red-left-lower')]) {
        const cube = bodyOf(played.sim, id);
        assert.deepEqual([cube.x, cube.y, cube.angle], [cube.home.x, cube.home.y, cube.home.angle], `${what}: ${id} never moves`);
      }
    }
  });

  test(`why ${UP_FIRST_CM} cm up first: with 10 cm the claw pushes tower A when the robot turns on the right line (11 cm is clear)`, () => {
    const firstLeg = (cm: number): ProgramJson =>
      buildProgram([script(whenStart(), [moveCm('forward', cm), ...blocksAsNodesFrom(s.program, 1, 4)])]);
    const towerA = (cm: number): number => {
      const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: firstLeg(cm) });
      sim.start();
      let moved = 0;
      while (sim.status === 'running') {
        sim.step(1);
        const shift = towerShift('A', sim.world.bodies);
        moved = Math.max(moved, Math.hypot(shift.x, shift.y));
      }
      return moved;
    };
    assert.ok(towerA(10) > 0.1, 'with 10 cm the turn pushes tower A');
    assert.equal(towerA(11), 0);
    assert.equal(towerA(UP_FIRST_CM), 0);
  });
});

/** Blocks `from` .. `to` (not included) of a program's start script as builder blocks again: moves and turns only. */
function blocksAsNodesFrom(blocks: ProgramJson, from: number, to: number): BlockNode[] {
  return startScript(blocks)
    .slice(from, to)
    .map((block) => {
      if (block.type === 'mbot2_straight_cm') return moveCm(block.fields?.DIRECTION === 'backward' ? 'backward' : 'forward', numberIn(block, 'DISTANCE'));
      if (block.type === 'mbot2_turn_deg') return turn(block.fields?.DIRECTION === 'left' ? 'left' : 'right', numberIn(block, 'ANGLE'));
      throw new Error(`blocksAsNodesFrom does not know "${block.type}"`);
    });
}

// =============================================================================================
// 6. fighter-whole-mission
// =============================================================================================

describe('fighter-whole-mission: all five letters', () => {
  const s = sample('fighter-whole-mission');

  test('100 points: X 11.67 s, E 25.33 s, M 39.52 s, A 55.43 s, K 68.91 s, each through its opening; it ends after 69.65 s; the console says so, in order', async () => {
    for (const [mat, sampler] of await bothMats()) {
      const played = play(s.program, { sampler });
      const { sim } = played;
      const what = `${s.id} ${mat}`;
      assertClean(played, what);
      assert.equal(sim.score().total, MAX_SCORE, what);
      assert.equal(sim.score().complete, true, what);
      assert.equal(deliveries(played), 'X 11.67, E 25.33, M 39.52, A 55.43, K 68.91', what);
      assertScored(played, { X: 'yellow', E: 'red-left-upper', M: 'red-left-lower', A: 'red-right-lower', K: 'red-right-upper' }, what);
      assert.equal(played.referee.yellowRule().direct, 'yes', what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.ok(Math.abs(sim.world.time - 69.65) < 0.05, `${what}: ends at ${sim.world.time}`);
      assert.ok(sim.world.time < MATCH_DURATION / 2, 'in less than half of the match');
      assert.deepEqual(
        played.said,
        [
          'The robot took the yellow cube. Now tower X must be its next delivery.',
          'The yellow cube is under tower X: the letter X shows.',
          'A red cube is under tower E: the letter E shows.',
          'A red cube is under tower M: the letter M shows.',
          'A red cube is under tower A: the letter A shows.',
          'A red cube is under tower K: the letter K shows.',
        ],
        what,
      );
      for (const tower of TOWER_IDS) assert.equal(sim.world.props?.find((p) => p.id === `letter:${tower}`)?.label, tower, `${what}: the letter ${tower} shows`);
    }
  });
});

// =============================================================================================
// The start: how far it may be moved or turned (the comments above the programs)
// =============================================================================================

describe('the start: the examples that score drive by distance, and keep their points only near the start the simulator gives', () => {
  /**
   * Tried in steps of 0.5 mm and 0.1 degree: at these ends the example scores its points and no tower
   * moves; one step further out it scores less (or the robot no longer fits the Fire Station).
   * x: + to the right; y: + down; turn: + to the right.
   */
  const HOLDS: Record<string, { points: number; x: [number, number]; y: [number, number]; turn: [number, number] }> = {
    'fighter-yellow-x': { points: 20, x: [-5, 4.5], y: [-4.5, 6.5], turn: [-0.5, 0.5] },
    'fighter-left-bay': { points: 40, x: [-4.5, 4.5], y: [-6.5, 6.5], turn: [-0.2, 0.2] },
    'fighter-right-bay': { points: 40, x: [-4.5, 4.5], y: [-6.5, 6.5], turn: [-0.2, 0.2] },
    'fighter-whole-mission': { points: 100, x: [-4.5, 4.5], y: [-4.5, 6.5], turn: [-0.2, 0.2] },
  };
  /** One step of the screen (5 mm, 1 degree): the points, and the towers that are pushed. */
  const STEPS: Record<string, Record<string, [number, TowerId[]]>> = {
    'fighter-yellow-x': { '5 mm left': [20, []], '5 mm right': [0, ['X']], '5 mm up': [0, []], '5 mm down': [20, []], '1 degree left': [0, ['X']], '1 degree right': [0, ['X']] },
    'fighter-left-bay': { '5 mm left': [0, ['E']], '5 mm right': [20, ['M']], '5 mm up': [40, []], '5 mm down': [40, []], '1 degree left': [0, []], '1 degree right': [0, ['E']] },
    'fighter-right-bay': { '5 mm left': [0, ['A', 'K']], '5 mm right': [0, []], '5 mm up': [40, []], '5 mm down': [40, []], '1 degree left': [0, ['K']], '1 degree right': [0, []] },
    'fighter-whole-mission': {
      '5 mm left': [20, ['A', 'K', 'E']],
      '5 mm right': [20, ['M', 'X']],
      '5 mm up': [80, []],
      '5 mm down': [100, []],
      '1 degree left': [0, ['K', 'X']],
      '1 degree right': [0, ['E', 'X']],
    },
  };
  const STEP_POSES: Record<string, Pose> = {
    '5 mm left': startAt(-5, 0),
    '5 mm right': startAt(5, 0),
    '5 mm up': startAt(0, -5),
    '5 mm down': startAt(0, 5),
    '1 degree left': startAt(0, 0, -1),
    '1 degree right': startAt(0, 0, 1),
  };

  /** The points from this start, and whether a tower moved (the same match as play(), without the watching). */
  const result = (blocks: ProgramJson, startPose: Pose, sampler?: MatSampler): { total: number; moved: TowerId[] } => {
    const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: blocks, startPose, sampler });
    sim.start();
    const moved = new Set<TowerId>();
    while (sim.status === 'running') {
      sim.step(5);
      for (const tower of TOWER_IDS) {
        const shift = towerShift(tower, sim.world.bodies);
        if (Math.hypot(shift.x, shift.y) >= 0.01) moved.add(tower);
      }
    }
    return { total: sim.score().total, moved: TOWER_IDS.filter((tower) => moved.has(tower)) };
  };

  const assertHolds = async (id: string): Promise<void> => {
    const { points, x, y, turn } = HOLDS[id];
    const blocks = sample(id).program;
    for (const [mat, sampler] of await bothMats()) {
      const keeps = (pose: Pose): boolean => {
        const r = result(blocks, pose, sampler);
        return r.total === points && r.moved.length === 0;
      };
      for (const [ends, step, pose] of [
        [x, 0.5, (v: number) => startAt(v, 0)],
        [y, 0.5, (v: number) => startAt(0, v)],
        [turn, 0.1, (v: number) => startAt(0, 0, v)],
      ] as const) {
        for (const end of ends) {
          const beyond = Math.round((end + Math.sign(end) * step) * 10) / 10;
          assert.ok(fits(pose(end)) && keeps(pose(end)), `${mat}, ${id}: from ${JSON.stringify(pose(end))} it keeps its ${points} points`);
          assert.ok(!fits(pose(beyond)) || !keeps(pose(beyond)), `${mat}, ${id}: one step further (${beyond}) it scores less`);
        }
      }
    }
  };

  for (const id of Object.keys(HOLDS)) {
    test(`${id}: the start may be moved or turned this far - and one step more costs points`, async () => {
      await assertHolds(id);
    });
  }

  test('one step of the screen (5 mm, 1 degree): the points and the pushed towers that the comments say - on the drawing and on the picture', async () => {
    for (const [mat, sampler] of await bothMats()) {
      for (const [id, steps] of Object.entries(STEPS)) {
        for (const [step, [points, towers]] of Object.entries(steps)) {
          assert.ok(fits(STEP_POSES[step]), `${step}: the robot fits the Fire Station`);
          const r = result(sample(id).program, STEP_POSES[step], sampler);
          assert.equal(r.total, points, `${mat}, ${id}, ${step}`);
          assert.deepEqual([...r.moved].sort(), [...towers].sort(), `${mat}, ${id}, ${step}: the towers pushed`);
        }
      }
    }
    // what the texts say: turned 1 degree, the three that score by distance score nothing; moved 5 mm to the side the whole mission loses points
    for (const id of ['fighter-yellow-x', 'fighter-left-bay', 'fighter-right-bay', 'fighter-whole-mission']) {
      for (const step of ['1 degree left', '1 degree right']) assert.equal(STEPS[id][step][0], 0, `${id}, ${step}`);
    }
    for (const step of ['5 mm left', '5 mm right']) assert.ok(STEPS['fighter-whole-mission'][step][0] < MAX_SCORE);
  });
});

// =============================================================================================
// What the examples print, and the examples in the block editor
// =============================================================================================

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(path.join(HERE, '../ui/CyberPiPanel.tsx'), 'utf8'))?.[1]);

  test('every text an example prints fits on the CyberPi screen: on one row, or broken between two words', () => {
    assert.equal(columns, 18, 'the CyberPi screen of the simulator is 18 characters wide');
    const printed: string[] = [];
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        if (block.type !== 'cyberpi_print') continue;
        const text = String(block.inputs?.TEXT?.shadow?.fields?.TEXT ?? '');
        assert.ok(text.length > 0 && block.inputs?.TEXT?.block === undefined, `${s.id}: a plain text`);
        // the screen breaks a long text every `columns` characters: there it must break at a blank
        for (let at = columns; at < text.length; at += columns) assert.ok(text[at - 1] === ' ' || text[at] === ' ', `${s.id}: "${text}" is broken inside a word`);
        printed.push(text);
      }
    }
    assert.deepEqual(printed, ['Fire Fighter!', 'I have the yellow cube', 'T found']);
  });
});

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly (as the other games' tests do). */
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
  test('every example loads into the Fire Fighter editor, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: fireFighterGame.id });
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
      assert.ok(notes.length >= 3, `${s.id}: has notes`);
      for (const text of notes) assert.ok(text.length <= 220, `${s.id}: a note is short ("${text}")`);

      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      const fromBuilder = runMatch({ game: fireFighterGame, scenario: RULES_SETUP, program: s.program });
      const fromEditor = runMatch({ game: fireFighterGame, scenario: RULES_SETUP, program: saved });
      assert.deepEqual(fromEditor, fromBuilder, s.id);
      assert.equal(fromEditor.errors, undefined, s.id);
    }
    workspace.dispose();
  });
});

// =============================================================================================
// On the picture the browser reads
// =============================================================================================

describe('the examples on the picture of the mat', () => {
  test('every example scores on the picture what it scores on the drawing, at the same times, and ends in the same place', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const s of SAMPLE_PROGRAMS) {
      const onDrawing = play(s.program);
      const onPicture = play(s.program, { sampler: mat });
      assertClean(onPicture, `${s.id} on the picture`);
      assert.equal(onPicture.sim.score().total, onDrawing.sim.score().total, s.id);
      assert.equal(deliveries(onPicture), deliveries(onDrawing), s.id);
      assert.equal(onPicture.sim.world.time, onDrawing.sim.world.time, s.id);
      const a = onPicture.sim.world.robot.pose;
      const b = onDrawing.sim.world.robot.pose;
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 0.01, `${s.id}: ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(3)} mm apart`);
    }
  });
});
