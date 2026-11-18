/**
 * The example programs of Locker Room (samples.ts), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  Locker Room referee
 *
 * Every example is played on all 12 arrangements (2 team colours x 6 zone cards), on the vector
 * drawing of the mat, and each test asserts what the description of that example promises - no
 * more, no less. The examples are also played on the picture the browser reads (the sensor
 * picture of the mat, decoded with sharp, which comes with Next.js; the test is skipped where
 * sharp is missing).
 *
 * "Nothing is pushed" is checked tick by tick: a cube that is not in the claw never moves, the
 * engine reports no bump, and the robot never presses against anything - with one exception: the
 * closing claw moves a cube by less than 0.5 mm to the middle of its fingers in the moment it grips
 * it (the programs drive in whole millimetres, so a cube is a fraction of a millimetre off the
 * middle of the claw). That is gripping, not pushing.
 *
 * The routes are worked out from ./field.ts (MARK_ROLES: where the team cubes stand, which mark is
 * the target of each token). If the organiser's answer swaps the pickup zones and the targets,
 * "the numbers in the blocks are the ones of field.ts" fails first and says which number to change.
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
import { obbCorners, type OBB } from '../core/geometry';
import { RasterMatSampler } from '../core/mat';
import { robotShapesAt } from '../core/robot';
import { createSimulation } from '../core/simulation';
import type { BlockJson, MatSampler, Pose, ProgramJson, ScoreLine, SimEvent, Simulation } from '../core/types';
import { SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { supportsBlock } from '../vm';
import { program as buildProgram, script, wait, whenStart, type BlockNode } from '../vm/builder';
import { SAMPLE_CATALOG as WAREHOUSE_SORT_CATALOG } from '../warehouse-sort/sample-catalog';
import { BIG_CIRCLES, CUBE_SIZE, GATE_MARK, LOCKER_ROOM, MAT_SIZE, MAT_VECTOR, SCAN_STATION, ZONE_IDS, targetOf, type TeamColor, type ZoneId } from './field';
import {
  BOX_LIFT_S,
  CARD_AWAY_S,
  CARD_SHOW_S,
  GATE_ID,
  LINE_APPROVAL,
  LINE_DELIVERY,
  LINE_GATE,
  LINE_GATE_TOUCH,
  LINE_LEAVE,
  LINE_SCAN_STATION,
  MATCH_DURATION,
  MAX_SCORE,
  lockerRoomGame,
  onMark,
  teamCubeHome,
  teamCubeId,
  tokenHome,
  tokenId,
  tokenLineId,
} from './game';
import { LOCKER_ROOM_ROBOT, START_POSE, robotReach } from './robot';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import {
  AFTER_CARD_S,
  AWAY_FROM_CUBE_CM,
  GREEN_TO_ROAD,
  GREEN_WAY,
  INTO_STATION_CM,
  PAST_THE_FRAME_CM,
  RED_TO_ROAD,
  RED_WAY,
  ROAD_X_CM,
  SAMPLE_PROGRAMS,
  SHORTEST_TO_STATION_CM,
  START_TO_ROAD_CM,
  START_Y_CM,
  TARGET_Y_CM,
  TOO_SHORT_WAIT_S,
  TO_STATION_CM,
  TO_TARGET_CM,
  TO_TOKEN_CM,
  ZONE_Y_CM,
  getSampleProgram,
  type SampleProgram,
} from './samples';
import { SCENARIO_COUNT, TOKEN_COLORS, allScenarios, defaultScenario, encodeScenario, tokensOf, type LockerRoomScenario, type TokenColor } from './scenario';

type Sim = Simulation<LockerRoomScenario>;

/** The folder of this file. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The 12 arrangements, in number order (R1 .. R6, G1 .. G6). */
const ARRANGEMENTS: LockerRoomScenario[] = allScenarios();

const GRIP = LOCKER_ROOM_ROBOT.gripper.gripForward;
const REACH = robotReach(LOCKER_ROOM_ROBOT);

// =============================================================================================
// Playing an example
// =============================================================================================

interface Played {
  sim: Sim;
  scenario: LockerRoomScenario;
  events: SimEvent[];
  /** cubes that moved while they were not in the claw (other than the closing claw centring them): "token:A at 12.34" */
  pushed: string[];
  /** the largest distance (mm) the closing claw moved a cube to the middle of its fingers */
  centred: number;
  /** ticks in which the robot pressed against something, other than the tick in which it gripped a cube */
  touchTicks: number;
  /** when the robot first stood still completely inside the Scan Station (s), or null */
  stoppedInStation: number | null;
}

function sample(id: string): SampleProgram {
  const s = getSampleProgram(id);
  assert.ok(s, id);
  return s;
}

/** Play one whole match, tick by tick, and watch the cubes. */
function play(blocks: ProgramJson, scenario: LockerRoomScenario, options: { sampler?: MatSampler; startPose?: Pose } = {}): Played {
  const sim = createSimulation({ game: lockerRoomGame, scenario, program: blocks, sampler: options.sampler, startPose: options.startPose });
  const events: SimEvent[] = [];
  const moves: Array<{ id: string; time: number; d: number; turned: boolean }> = [];
  const touches: number[] = [];
  const before = new Map<string, { x: number; y: number; angle: number; held: boolean }>();
  for (const b of sim.world.bodies) before.set(b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held });
  let stoppedInStation: number | null = null;
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    events.push(...sim.drainEvents());
    if (sim.world.robot.touching) touches.push(sim.world.time);
    for (const b of sim.world.bodies) {
      const was = before.get(b.id)!;
      const d = Math.hypot(b.x - was.x, b.y - was.y);
      if (!b.held && !was.held && (d > 1e-9 || b.angle !== was.angle)) moves.push({ id: b.id, time: sim.world.time, d, turned: b.angle !== was.angle });
      before.set(b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held });
    }
    const robot = sim.world.robot;
    if (stoppedInStation === null && robot.left.rpm === 0 && robot.right.rpm === 0 && sim.robotShapes().every((s) => insideRect(s, SCAN_STATION))) {
      stoppedInStation = sim.world.time;
    }
  }
  const grabs = events.flatMap((e) => (e.type === 'grab' ? [e] : []));
  const gripping = (id: string | null, time: number): boolean => grabs.some((g) => (id === null || g.bodyId === id) && Math.abs(g.time - time) < 0.015);
  const centring = moves.filter((m) => m.d < 0.5 && !m.turned && gripping(m.id, m.time));
  const pushed = moves.filter((m) => !centring.includes(m)).map((m) => `${m.id} at ${m.time.toFixed(2)}`);
  return {
    sim,
    scenario,
    events,
    pushed,
    centred: Math.max(0, ...centring.map((m) => m.d)),
    touchTicks: touches.filter((t) => !gripping(null, t)).length,
    stoppedInStation,
  };
}

function insideRect(shape: OBB, r: { x: number; y: number; w: number; h: number }): boolean {
  return obbCorners(shape).every((p) => p.x >= r.x - 1e-6 && p.x <= r.x + r.w + 1e-6 && p.y >= r.y - 1e-6 && p.y <= r.y + r.h + 1e-6);
}

const lineOf = (sim: Sim, id: string): ScoreLine => {
  const line = sim.score().lines.find((l) => l.id === id);
  assert.ok(line, id);
  return line;
};
const pointsOf = (sim: Sim, id: string): number => lineOf(sim, id).points;
const screen = (sim: Sim): string[] => sim.world.robot.screen.lines;
const bodyOf = (sim: Sim, id: string) => sim.world.bodies.find((b) => b.id === id)!;
const label = (s: LockerRoomScenario): string => encodeScenario(s);
const otherTeam = (team: TeamColor): TeamColor => (team === 'red' ? 'green' : 'red');

/** Nothing went wrong: no error, no warning, nothing pushed, no bump, never pressed against anything, the gate never touched. */
function assertClean(played: Played, what: string): void {
  assert.deepEqual(played.sim.vm.errors(), [], `${what}: errors`);
  const warnings = played.events.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));
  assert.deepEqual(warnings, [], `${what}: warnings`);
  assert.deepEqual(played.pushed, [], `${what}: pushed`);
  assert.ok(played.centred < 0.5, `${what}: the closing claw moved a cube by ${played.centred.toFixed(2)} mm`);
  assert.deepEqual(played.events.filter((e) => e.type === 'bump'), [], `${what}: bumps`);
  assert.equal(played.touchTicks, 0, `${what}: pressed against something`);
  assert.equal(pointsOf(played.sim, LINE_GATE_TOUCH), 0, `${what}: the gate was touched`);
}

/** The body never left its place. */
function assertUntouched(sim: Sim, id: string, what: string): void {
  const b = bodyOf(sim, id);
  assert.equal(b.x, b.home.x, `${what}: ${id} x`);
  assert.equal(b.y, b.home.y, `${what}: ${id} y`);
  assert.equal(b.angle, b.home.angle, `${what}: ${id} turned`);
}

/** Steps 1, 2 and 3 as every example that reads the card earns them: at 1.50, 5.85 and 9.91 s. */
function assertCardSteps(sim: Sim, what: string): void {
  assert.equal(pointsOf(sim, LINE_LEAVE), 5, what);
  assert.equal(pointsOf(sim, LINE_SCAN_STATION), 10, what);
  assert.equal(pointsOf(sim, LINE_APPROVAL), 15, what);
  assert.ok(Math.abs(lineOf(sim, LINE_LEAVE).time! - 1.5) < 0.02, `${what}: Step 1 at ${lineOf(sim, LINE_LEAVE).time}`);
  assert.ok(Math.abs(lineOf(sim, LINE_SCAN_STATION).time! - 5.85) < 0.02, `${what}: Step 2 at ${lineOf(sim, LINE_SCAN_STATION).time}`);
  assert.ok(Math.abs(lineOf(sim, LINE_APPROVAL).time! - 9.91) < 0.02, `${what}: Step 3 at ${lineOf(sim, LINE_APPROVAL).time}`);
}

/** How a token lies on the target of its own colour: 'full', 'part' or null. */
function onOwnTarget(sim: Sim, zone: ZoneId, color: TokenColor): 'full' | 'part' | null {
  const b = bodyOf(sim, tokenId(zone));
  return onMark({ x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle }, targetOf(color));
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

/** The my-block definition of that name. */
function definitionOf(blocks: ProgramJson, name: string): BlockJson {
  const found = (blocks.blocks?.blocks ?? []).find((block) => block.type === 'procedures_defnoreturn' && block.fields?.NAME === name);
  assert.ok(found, name);
  return found;
}

/** A copy of a program with more blocks at the end of its start script (what a "Try ..." asks a student to add). */
function withMoreAtTheEnd(blocks: ProgramJson, more: BlockNode[]): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  const extra = buildProgram([script(whenStart(), more)]);
  const first = (extra.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start')?.next?.block;
  assert.ok(first);
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    block.id = `try-${block.id}`;
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

/** A copy of a program whose start script ends with the last `keep` blocks of it copied once more (the try "zone C too"). */
function withLastBlocksAgain(blocks: ProgramJson, keep: number, change: (copies: BlockJson[]) => void): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  const chain = startScript(copy);
  const again = chain.slice(-keep).map((block) => {
    const one = JSON.parse(JSON.stringify({ ...block, next: undefined })) as BlockJson;
    const rename = (b: BlockJson | undefined): void => {
      if (!b) return;
      b.id = `again-${b.id}`;
      for (const slot of Object.values(b.inputs ?? {})) {
        rename(slot.shadow);
        rename(slot.block);
      }
    };
    rename(one);
    delete one.next;
    return one;
  });
  change(again);
  for (let i = 0; i + 1 < again.length; i++) again[i].next = { block: again[i + 1] };
  chain[chain.length - 1].next = { block: again[0] };
  return copy;
}

/** The colour the LEDs light in: "red", "green", or what the LEDs show. */
function ledsColour(sim: Sim): string {
  const leds = sim.world.robot.leds;
  const named: Record<string, string> = { '255,0,0': 'red', '0,255,0': 'green' };
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
        'locker-to-station starter',
        'locker-follow-line starter',
        'locker-read-card starter',
        'locker-team-cube intermediate',
        'locker-two-tokens intermediate',
        'locker-whole-mission advanced',
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

  test('every id starts with "locker-", and no id, title or heading is used by an example of the other games', () => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...WAREHOUSE_SORT_CATALOG, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^locker-[a-z]+(-[a-z]+)*$/, card.id);
    for (const card of [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...WAREHOUSE_SORT_CATALOG]) assert.ok(!card.id.startsWith('locker-'), card.id);
    // a student reads the titles: short
    for (const card of SAMPLE_CATALOG) assert.ok(card.title.length <= 30, card.title);
  });

  test('every description says, in short plain sentences, what the program does, what it scores and what to try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 650, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.match(s.description, /\bTry\b/, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      // ages 13 to 15, many read English as a second language: short sentences (as in Warehouse Sort)
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 140, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
      // no text promises more than a match can give
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= MAX_SCORE, `${s.id}: ${number} points`);
    }
    // the points and the seconds each one promises, as the tests below measure them
    const promised: Record<string, RegExp[]> = {
      'locker-to-station': [/It scores 15 points on every draw, after 6 seconds\./, /On the way the whole robot leaves the Locker Room: \+5 points\./],
      'locker-follow-line': [/It scores 15 points on every draw, after 7 seconds\./, /Here the lines are WHITE on a black mat\./, /Try to move the robot 1 cm up or down in the Locker Room before you press Start\./],
      'locker-read-card': [/It scores 30 points on every draw, after 10\.4 seconds\./, /The screen shows the team colour, and the LEDs light in it\./],
      'locker-team-cube': [/It scores 55 points on all 12 draws, after 26 to 29 seconds\./],
      'locker-two-tokens': [/It scores 20 points on 8 of the 12 draws and 15 on the other 4, after 16 to 18 seconds\./, /only partly inside, 5 points\./, /It does not open the gate\. In this simulator the tokens count all the same \(the rules do not say\)\./],
      'locker-whole-mission': [/It scores 75 points on all 12 draws, in 51 to 57 of the 150 seconds\./, /It never guesses a colour\./, /In this simulator 75 is the most there is/],
    };
    for (const s of SAMPLE_PROGRAMS) for (const promise of promised[s.id]) assert.match(s.description, promise, s.id);
    // the screen's word for the two cards drawn before a match is "draw" (the Cards panel, "Test on many draws"): not a second word for it
    for (const s of SAMPLE_PROGRAMS) assert.doesNotMatch(s.description, /arrangement/i, s.id);
    // no try teaches that Step 3 needs no scan (the referee of the simulator cannot see what a program reads)
    for (const s of SAMPLE_PROGRAMS) assert.doesNotMatch(s.description, /Try to wait/, s.id);
    // the referee's timing is the simulator's own choice: every sentence that names it says "In this simulator"
    for (const s of SAMPLE_PROGRAMS) {
      for (const text of [s.description, ...notesOf(s.program)]) {
        for (const sentence of text.split(/(?<=[.?!])\s+/)) {
          if (/\b(0\.5 s|4 s|4 seconds)\b/.test(sentence) && /referee|card|Team Box/.test(sentence)) assert.match(sentence, /[Ii]n this simulator/, `${s.id}: "${sentence}"`);
        }
      }
    }
    // the lines are white on this mat: the line follower says so, and so does the note on its first block
    assert.ok(notesOf(sample('locker-follow-line').program).some((text) => /"detects line" means white here/.test(text)));
    // every example that drives by distance to a cube or a card says on its first block that a real robot drifts
    for (const id of ['locker-read-card', 'locker-team-cube', 'locker-two-tokens', 'locker-whole-mission']) {
      assert.ok(notesOf(sample(id).program).some((text) => /A real robot drifts a little/.test(text)), id);
    }
    // the two that take tokens say on a block that the colour is read before the claw closes
    for (const id of ['locker-two-tokens', 'locker-whole-mission']) assert.ok(notesOf(sample(id).program).some((text) => /sees the token between the open fingers/.test(text)), id);
    // a match is 150 s
    assert.equal(lockerRoomGame.matchDuration, 150);
    assert.equal(MATCH_DURATION, 150);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Locker Room stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/locker-room/sample-catalog.ts';
  const SAMPLES = 'simulator/locker-room/samples.ts';
  // the only file that will import them, once Locker Room is wired into the server
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
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/core/types', 'simulator/locker-room/sample-catalog', 'simulator/vm/builder']);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'locker-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test("nothing imports them but each other and, later, the server's list of all examples - no file of the simulator screen, no page (and the tests)", () => {
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
  test('only blocks of the Locker Room palette: blocks of real mBlock, and the Gripper shortcuts', () => {
    const allowed = new Set([...paletteBlockTypes('locker-room'), ...BUILTIN_BLOCK_TYPES]);
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
      // no block that reads where the robot points: the examples move by "forward" and "turn" only
      assert.ok(![...types].some((type) => /yaw|rotation|angle|gyro/.test(type)), s.id);
      // the arm never moves: the cubes are carried on the mat, in the closed claw
      assert.ok(!types.has('gripper_arm') && !types.has('gripper_arm_height'), s.id);
    }
  });

  test('each example shows the blocks it is about, and a starter is short', () => {
    const uses = (id: string): Set<string> => new Set(blocksOf(sample(id).program).map((block) => block.type));
    const CLAW_SENSOR = ['sensing_claw_color', 'sensing_claw_color_is', 'sensing_claw_object_detected'];
    assert.ok(uses('locker-to-station').has('mbot2_straight_cm'));
    assert.ok(uses('locker-follow-line').has('sensing_quadrgb_probe_detects') && uses('locker-follow-line').has('sensing_quadrgb_probe_color_is'));
    assert.ok(uses('locker-read-card').has('sensing_claw_object_detected') && uses('locker-read-card').has('sensing_claw_color'));
    // the three starters teach one thing each: none of them uses the gripper
    for (const id of ['locker-to-station', 'locker-follow-line', 'locker-read-card']) assert.ok(!uses(id).has('gripper_claw'), id);
    for (const id of ['locker-to-station', 'locker-follow-line']) for (const type of CLAW_SENSOR) assert.ok(!uses(id).has(type), `${id}: ${type}`);
    // the three that carry cubes: the gripper, the colour read at the claw, my-blocks, and a decision
    for (const id of ['locker-team-cube', 'locker-two-tokens', 'locker-whole-mission']) {
      for (const type of ['gripper_claw', 'sensing_claw_color', 'operator_equals', 'control_if_else', 'procedures_defnoreturn']) assert.ok(uses(id).has(type), `${id}: ${type}`);
    }
    // a starter is short; the advanced example is the longest
    const size = (id: string): number => blocksOf(sample(id).program).filter((block) => block.type !== 'math_number' && block.type !== 'text').length;
    for (const card of SAMPLE_CATALOG) {
      if (card.level === 'starter') assert.ok(size(card.id) <= 20, `${card.id}: ${size(card.id)} blocks`);
      assert.ok(size(card.id) <= size('locker-whole-mission'), card.id);
    }
  });

  test('the numbers in the blocks are the ones of field.ts (and of MARK_ROLES: where the team cubes stand, which mark is a target)', () => {
    // a little robot that drives the moves of the blocks exactly, as the simulator does (heading in degrees, 0 = up, clockwise)
    class Walker {
      constructor(public x: number, public y: number, public h: number) {}
      forward(cm: number): this {
        this.x += cm * 10 * Math.sin((this.h * Math.PI) / 180);
        this.y -= cm * 10 * Math.cos((this.h * Math.PI) / 180);
        return this;
      }
      turn(degrees: number): this {
        this.h += degrees;
        return this;
      }
      /** the middle of the claw */
      get claw(): { x: number; y: number } {
        return { x: this.x + GRIP * Math.sin((this.h * Math.PI) / 180), y: this.y - GRIP * Math.cos((this.h * Math.PI) / 180) };
      }
    }
    const near = (a: { x: number; y: number }, b: { x: number; y: number }, mm: number, what: string): void => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d <= mm, `${what}: ${d.toFixed(2)} mm apart`);
    };
    /** a robot with this heading (degrees) drives straight at a side of a cube turned by `angle` (radians) */
    const facesASide = (degrees: number, angle: number): boolean => {
      const quarters = ((degrees * Math.PI) / 180 - angle) / (Math.PI / 2);
      return Math.abs(quarters - Math.round(quarters)) < 1e-9;
    };
    const startDeg = (START_POSE.heading * 180) / Math.PI;
    assert.equal(startDeg, 90, 'the robot starts facing right');

    // ---- the Scan Station: the whole robot inside it after TO_STATION_CM, and after SHORTEST_TO_STATION_CM; not after 1 mm less
    const inStation = (x: number): boolean => x - REACH.rear >= SCAN_STATION.x && x + REACH.front <= SCAN_STATION.x + SCAN_STATION.w;
    const station = new Walker(START_POSE.x, START_POSE.y, startDeg).forward(TO_STATION_CM);
    assert.ok(inStation(station.x) && station.x - REACH.rear - SCAN_STATION.x > 7 && SCAN_STATION.x + SCAN_STATION.w - station.x - REACH.front > 7);
    assert.ok(inStation(START_POSE.x + SHORTEST_TO_STATION_CM * 10) && !inStation(START_POSE.x + SHORTEST_TO_STATION_CM * 10 - 1));
    // ---- the line follower looks at the line only when its sensor is past the yellow frame of the Locker Room (and its probes' spots)
    const sensorX = START_POSE.x + PAST_THE_FRAME_CM * 10 + LOCKER_ROOM_ROBOT.quadRgb.forward;
    assert.ok(sensorX - LOCKER_ROOM.x - LOCKER_ROOM.w > 25, `the sensor is ${(sensorX - LOCKER_ROOM.x - LOCKER_ROOM.w).toFixed(1)} mm past the frame`);
    // ... and from the outer edge of the Scan Station's frame INTO_STATION_CM puts the whole robot inside
    assert.ok(inStation(SCAN_STATION.x - LOCKER_ROOM_ROBOT.quadRgb.forward + INTO_STATION_CM * 10));

    // ---- the green way: the claw around the green cube, facing one of its sides; then the cube over the middle of the big green circle
    const green = new Walker(station.x, station.y, 90).turn(-90).forward(GREEN_WAY.up).turn(-45).forward(GREEN_WAY.diagonal).turn(90).forward(GREEN_WAY.toCube);
    near(green.claw, teamCubeHome('green'), 1, 'the claw around the green cube');
    assert.ok(facesASide(green.h, teamCubeHome('green').angle), 'it faces a side of the green cube');
    green.forward(-GREEN_WAY.toCube).turn(135).forward(GREEN_WAY.down).turn(90).forward(GREEN_WAY.toCircle);
    near(green.claw, { x: BIG_CIRCLES.green.cx, y: BIG_CIRCLES.green.cy }, 1, 'the green cube over the middle of the big green circle');
    // ... and to the road, passing above the place of the gate (the robot is 130 mm wide)
    green.forward(-AWAY_FROM_CUBE_CM).turn(90).forward(GREEN_TO_ROAD.up);
    assert.ok(GATE_MARK.y - (green.y + LOCKER_ROOM_ROBOT.chassisWidth / 2) > 10, 'above the place of the gate');
    green.turn(-90).forward(GREEN_TO_ROAD.left);
    near(green, { x: ROAD_X_CM * 10, y: GREEN_TO_ROAD.y * 10 }, 1, 'on the road after the green way');

    // ---- the red way: up, not so high that the fingers reach the green cube; then the claw around the red cube; then the red circle
    const red = new Walker(station.x, station.y, 90).turn(-90).forward(RED_WAY.up);
    const greenCubeBottom = teamCubeHome('green').y + (CUBE_SIZE / 2) * Math.SQRT2;
    assert.ok(red.y - REACH.front - greenCubeBottom > 15, `the fingers stay ${(red.y - REACH.front - greenCubeBottom).toFixed(1)} mm below the green cube`);
    red.turn(-90).forward(RED_WAY.left).turn(45).forward(RED_WAY.toCube);
    near(red.claw, teamCubeHome('red'), 1, 'the claw around the red cube');
    assert.ok(facesASide(red.h, teamCubeHome('red').angle), 'it faces a side of the red cube');
    red.forward(-RED_WAY.back).turn(135).forward(RED_WAY.toCircle);
    near(red.claw, { x: BIG_CIRCLES.red.cx, y: BIG_CIRCLES.red.cy }, 1, 'the red cube over the middle of the big red circle');
    red.forward(-AWAY_FROM_CUBE_CM).turn(-180).forward(RED_TO_ROAD.left);
    near(red, { x: ROAD_X_CM * 10, y: RED_TO_ROAD.y * 10 }, 1, 'on the road after the red way');

    // ---- the road: from the start onto it; the zones and the targets at their heights; the claw over each
    near(new Walker(START_POSE.x, START_POSE.y, 90).forward(START_TO_ROAD_CM), { x: ROAD_X_CM * 10, y: START_POSE.y }, 1, 'from the start onto the road');
    assert.ok(Math.abs(START_Y_CM * 10 - START_POSE.y) < 1);
    for (const zone of ZONE_IDS) {
      const home = tokenHome(zone);
      assert.ok(Math.abs(ZONE_Y_CM[zone] * 10 - home.y) < 1, `zone ${zone} at ${ZONE_Y_CM[zone]} cm`);
      near(new Walker(ROAD_X_CM * 10, home.y, -90).forward(TO_TOKEN_CM).claw, home, 2, `the claw around the token of zone ${zone}`);
    }
    for (const color of TOKEN_COLORS) {
      const mark = targetOf(color);
      const middle = mark.circle ? { x: mark.circle.cx, y: mark.circle.cy } : { x: mark.box!.x, y: mark.box!.y };
      assert.ok(Math.abs(TARGET_Y_CM[color] * 10 - middle.y) < 1, `the ${color} target at ${TARGET_Y_CM[color]} cm`);
      near(new Walker(ROAD_X_CM * 10, middle.y, 90).forward(TO_TARGET_CM).claw, middle, 4, `the ${color} token over its target`);
    }
    // turning on the road, the open claw stays 9 mm or more away from every token in a zone, and the body
    // (its corners) stays 7 mm or more away from the place of the gate
    const g = LOCKER_ROOM_ROBOT.gripper;
    const clawReach = Math.hypot(g.gripForward + g.fingerLength / 2, g.clawOpenGap / 2 + g.fingerThickness);
    for (const zone of ZONE_IDS) {
      const home = tokenHome(zone);
      const nearest = ROAD_X_CM * 10 - (home.x + CUBE_SIZE / 2);
      assert.ok(nearest - clawReach > 9, `zone ${zone}: ${(nearest - clawReach).toFixed(1)} mm`);
    }
    const rearCorner = Math.hypot(LOCKER_ROOM_ROBOT.chassisRear, LOCKER_ROOM_ROBOT.chassisWidth / 2);
    const toGate = Math.hypot(GATE_MARK.x - ROAD_X_CM * 10, GATE_MARK.y - tokenHome('A').y);
    assert.ok(toGate - rearCorner > 7, `the body turns ${(toGate - rearCorner).toFixed(1)} mm from the place of the gate`);
  });
});

// =============================================================================================
// 1. locker-to-station
// =============================================================================================

describe('locker-to-station: drive to the Scan Station', () => {
  const s = sample('locker-to-station');

  test('all 12 arrangements: 15 points (out of the Locker Room, into the Scan Station), after 5.92 s, nothing touched', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.equal(sim.score().total, 15, what);
      assert.equal(pointsOf(sim, LINE_LEAVE), 5, what);
      assert.equal(pointsOf(sim, LINE_SCAN_STATION), 10, what);
      assert.equal(pointsOf(sim, LINE_APPROVAL), 0, `${what}: the match ends with the program, before the referee lifts the Team Box`);
      assert.ok(Math.abs(sim.world.time - 5.92) < 0.02 && Math.round(sim.world.time) === 6, `${sim.world.time} s`);
      assert.deepEqual(screen(sim), ['Go!', 'In the station']);
      // it drove TO_STATION_CM straight on, and stands with the whole robot inside the Scan Station
      assert.ok(Math.abs(sim.world.robot.pose.x - START_POSE.x - TO_STATION_CM * 10) < 0.5);
      assert.ok(sim.robotShapes().every((shape) => insideRect(shape, SCAN_STATION)), what);
      for (const b of sim.world.bodies) assertUntouched(sim, b.id, what);
    }
  });

  test(`the try of the description: from ${SHORTEST_TO_STATION_CM} cm on the 10 points of Step 2 are earned, with 1 mm less not`, () => {
    const withDistance = (cm: number): ProgramJson =>
      changed(s.program, (all) => {
        all.find((block) => block.type === 'mbot2_straight_cm')!.inputs!.DISTANCE.shadow!.fields!.NUM = cm;
      });
    assert.equal(play(withDistance(SHORTEST_TO_STATION_CM), defaultScenario()).sim.score().total, 15);
    assert.equal(play(withDistance(SHORTEST_TO_STATION_CM - 0.1), defaultScenario()).sim.score().total, 5);
  });
});

// =============================================================================================
// 2. locker-follow-line
// =============================================================================================

describe('locker-follow-line: follow the bottom line', () => {
  const s = sample('locker-follow-line');

  /** It stopped with the whole robot inside the Scan Station, on the line. */
  function assertInStation(played: Played, what: string, roomBehind: [number, number]): void {
    const { sim } = played;
    assert.equal(sim.score().total, 15, what);
    assert.equal(pointsOf(sim, LINE_LEAVE), 5, what);
    assert.equal(pointsOf(sim, LINE_SCAN_STATION), 10, what);
    assert.deepEqual(screen(sim), ['In the station'], what);
    assert.ok(sim.robotShapes().every((shape) => insideRect(shape, SCAN_STATION)), `${what}: inside the Scan Station`);
    const behind = sim.world.robot.pose.x - REACH.rear - SCAN_STATION.x;
    assert.ok(behind >= roomBehind[0] && behind <= roomBehind[1], `${what}: ${behind.toFixed(2)} mm of room behind`);
  }

  test('all 12 arrangements: it follows the line and stops inside the Scan Station after 7.01 s, 15 points', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      assertClean(played, label(scenario));
      assertInStation(played, label(scenario), [6.8, 7.0]);
      assert.equal(played.sim.finishReason, 'program-ended');
      assert.ok(Math.abs(played.sim.world.time - 7.01) < 0.02 && Math.round(played.sim.world.time) === 7, `${played.sim.world.time} s`);
      assert.ok(Math.abs(lineOf(played.sim, LINE_LEAVE).time! - 1.73) < 0.02 && Math.abs(lineOf(played.sim, LINE_SCAN_STATION).time! - 6.94) < 0.02);
      assert.ok(Math.abs(played.sim.world.robot.pose.y - START_POSE.y) < 0.5, 'on the middle of the line');
    }
  });

  /** The starts of the robustness tests: crooked by up to 2.5 degrees, up to 1 cm beside the line, 5 mm further forward or back. */
  const STARTS: Pose[] = [];
  for (const degrees of [-2.5, 0, 2.5]) {
    for (const side of [-10, 0, 10]) {
      for (const along of [-5, 0, 5]) STARTS.push({ x: START_POSE.x + along, y: START_POSE.y + side, heading: START_POSE.heading + (degrees * Math.PI) / 180 });
    }
  }

  test('started crooked (up to 2.5 degrees), beside the line (up to 1 cm), still in the Locker Room: it steers back and stops in the Scan Station', () => {
    for (const startPose of STARTS) {
      const played = play(s.program, defaultScenario(), { startPose });
      const what = `start ${startPose.x.toFixed(1)}, ${startPose.y.toFixed(1)}, ${((startPose.heading * 180) / Math.PI).toFixed(1)} deg`;
      assertClean(played, what);
      assertInStation(played, what, [6.5, 9.5]);
      assert.ok(Math.abs(played.sim.world.robot.pose.y - START_POSE.y) < 6, `${what}: ${(played.sim.world.robot.pose.y - START_POSE.y).toFixed(2)} mm beside the line`);
      assert.ok(played.sim.world.time > 6.8 && played.sim.world.time < 7.6, `${what}: ${played.sim.world.time} s`);
    }
  });

  test('5 degrees crooked: pointing back towards the line it still gets there; 1 cm beside it and pointing away, it loses the line', () => {
    const at = (degrees: number, side: number): Pose => ({ x: START_POSE.x, y: START_POSE.y + side, heading: START_POSE.heading + (degrees * Math.PI) / 180 });
    // (heading +5 degrees points down the mat, -5 up it; side +10 is 1 cm below the line)
    for (const [degrees, side] of [[5, -10], [-5, 10], [5, 0], [-5, 0]]) assertInStation(play(s.program, defaultScenario(), { startPose: at(degrees, side) }), `${degrees} deg, ${side} mm`, [6.5, 9.5]);
    for (const [degrees, side] of [[5, 10], [-5, -10]]) {
      const { sim } = play(s.program, defaultScenario(), { startPose: at(degrees, side) });
      assert.equal(sim.finishReason, 'time', 'the robot stands still beside the line until the end of the match');
      assert.equal(sim.score().total, 0);
    }
  });

  test(`why it drives ${PAST_THE_FRAME_CM} cm first: with 10 cm a crooked start stops at the yellow frame of the Locker Room`, () => {
    const lookingSooner = changed(s.program, (all) => {
      all.find((block) => block.type === 'mbot2_straight_cm')!.inputs!.DISTANCE.shadow!.fields!.NUM = 10;
    });
    const startPose = { x: START_POSE.x - 5, y: START_POSE.y + 10, heading: START_POSE.heading + (2.5 * Math.PI) / 180 };
    const early = play(lookingSooner, defaultScenario(), { startPose }).sim;
    assert.ok(early.world.robot.pose.x < 400, `it stopped at x ${early.world.robot.pose.x.toFixed(0)}`);
    assert.equal(early.score().total, 5);
  });

  test('the try of the description: the robot moved 1 cm up or down before Start (still in the Locker Room) - it finds the line, 15 points on all 12 draws', () => {
    for (const side of [-10, 10]) {
      const startPose = { ...START_POSE, y: START_POSE.y + side };
      assert.ok(robotShapesAt(LOCKER_ROOM_ROBOT, startPose).every((shape) => insideRect(shape, LOCKER_ROOM)), `${side} mm: still completely inside the Locker Room`);
      for (const scenario of ARRANGEMENTS) {
        const played = play(s.program, scenario, { startPose });
        const what = `${label(scenario)}, ${side} mm`;
        assertClean(played, what);
        assertInStation(played, what, [6.5, 9.5]);
        assert.ok(Math.abs(played.sim.world.robot.pose.y - START_POSE.y) < 6, `${what}: back on the line`);
      }
    }
  });

  test('what the old try did, and why it is no try any more: waiting 5 s at the end earns Step 3 without reading the card', () => {
    // (the referee of the simulator cannot see what a program reads: README, question 16)
    const waiting = withMoreAtTheEnd(s.program, [wait(5)]);
    const played = play(waiting, defaultScenario());
    assert.equal(played.sim.score().total, 30);
    assert.equal(pointsOf(played.sim, LINE_APPROVAL), 15);
    assert.ok(Math.abs(lineOf(played.sim, LINE_APPROVAL).time! - played.stoppedInStation! - BOX_LIFT_S) < 0.02);
  });
});

// =============================================================================================
// 3. locker-read-card
// =============================================================================================

describe('locker-read-card: read the colour card', () => {
  const s = sample('locker-read-card');

  test('all 12 arrangements: the screen and the LEDs show the team colour, the referee lifts the Team Box - 30 points, after 10.42 s', () => {
    const shown = new Set<string>();
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.deepEqual(screen(sim), [`Team: ${scenario.team}`, 'Ready'], what);
      assert.equal(ledsColour(sim), scenario.team, `${what}: LEDs`);
      shown.add(scenario.team);
      assert.equal(sim.score().total, 30, what);
      assertCardSteps(sim, what);
      // the robot stopped at 5.91 s: card at +0.5 s, away at +2.5 s, the box lifted at +4.0 s; the program ends 0.5 s later
      assert.ok(Math.abs(played.stoppedInStation! - 5.91) < 0.02, `stopped at ${played.stoppedInStation}`);
      assert.ok(Math.abs(lineOf(sim, LINE_APPROVAL).time! - played.stoppedInStation! - BOX_LIFT_S) < 0.02);
      assert.ok(Math.abs(sim.world.time - 10.42) < 0.02, `${sim.world.time} s`);
      for (const b of sim.world.bodies) assertUntouched(sim, b.id, what);
    }
    assert.deepEqual([...shown].sort(), ['green', 'red'], 'it has shown both colours');
    // the waits of the program fit the referee's timing of game.ts: 2 s after the card is gone is after the box is lifted
    assert.ok(CARD_AWAY_S + AFTER_CARD_S > BOX_LIFT_S && CARD_AWAY_S + TOO_SHORT_WAIT_S < BOX_LIFT_S && CARD_SHOW_S < CARD_AWAY_S);
  });

  test('the try of the description: wait 1 second instead of 2 - the program ends before the box is lifted, 15 points', () => {
    const shorter = changed(s.program, (all) => {
      all.find((block) => block.type === 'control_wait')!.inputs!.DURATION.shadow!.fields!.NUM = TOO_SHORT_WAIT_S;
    });
    for (const scenario of ARRANGEMENTS) {
      const { sim } = play(shorter, scenario);
      assert.equal(sim.score().total, 15, label(scenario));
      assert.equal(pointsOf(sim, LINE_APPROVAL), 0);
      assert.ok(Math.abs(sim.world.time - 9.42) < 0.02, `${sim.world.time} s`);
    }
  });
});

// =============================================================================================
// 4. locker-team-cube
// =============================================================================================

describe('locker-team-cube: deliver the team cube', () => {
  const s = sample('locker-team-cube');

  test('all 12 arrangements: the cube of the team colour in the big circle of that colour, the gate opens - 55 points', () => {
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      const team = scenario.team;
      assertClean(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.equal(sim.score().total, 55, what);
      assertCardSteps(sim, what);
      assert.equal(pointsOf(sim, LINE_DELIVERY), 20, what);
      assert.equal(pointsOf(sim, LINE_GATE), 5, what);
      assert.deepEqual(sim.world.walls, [], `${what}: the gate opened`);
      assert.deepEqual(screen(sim), [`Team: ${team}`], what);
      // the cube is in the middle of the circle, about 68 mm inside its edge
      const cube = bodyOf(sim, teamCubeId(team));
      const circle = BIG_CIRCLES[team];
      assert.ok(Math.hypot(cube.x - circle.cx, cube.y - circle.cy) < 0.5, `${what}: the cube is ${Math.hypot(cube.x - circle.cx, cube.y - circle.cy).toFixed(2)} mm from the middle`);
      assertUntouched(sim, teamCubeId(otherTeam(team)), what);
      for (const zone of ZONE_IDS) assertUntouched(sim, tokenId(zone), what);
      // RED: delivered at 28.04 s, the end at 29.10 s; GREEN: 24.98 s and 26.04 s
      const [delivered, end] = team === 'red' ? [28.04, 29.1] : [24.98, 26.04];
      assert.ok(Math.abs(lineOf(sim, LINE_DELIVERY).time! - delivered) < 0.02, `${what}: delivered at ${lineOf(sim, LINE_DELIVERY).time}`);
      assert.ok(Math.abs(sim.world.time - end) < 0.02, `${what}: ${sim.world.time} s`);
    }
  });

  test('the try of the description: the two ways swapped - a wrong delivery, -10, the gate stays closed: 20 points', () => {
    const swapped = changed(s.program, () => undefined);
    const decision = startScript(swapped).find((block) => block.type === 'control_if_else')!;
    const ways = decision.inputs!;
    [ways.SUBSTACK, ways.SUBSTACK2] = [ways.SUBSTACK2, ways.SUBSTACK];
    for (const scenario of ARRANGEMENTS) {
      const played = play(swapped, scenario);
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(played.sim.score().total, 20, what);
      assert.equal(pointsOf(played.sim, LINE_DELIVERY), -10, what);
      assert.equal(pointsOf(played.sim, LINE_GATE), 0, what);
      assert.deepEqual(played.sim.world.walls?.map((w) => w.id), [GATE_ID], `${what}: the gate stays closed`);
    }
  });
});

// =============================================================================================
// 5. locker-two-tokens
// =============================================================================================

describe('locker-two-tokens: sort two tokens', () => {
  const s = sample('locker-two-tokens');

  test('all 12 arrangements: the tokens of zones A and B on the targets of their colours - 20 points on 8, 15 on 4, after 15.84 to 17.74 s', () => {
    const times: number[] = [];
    const totals: number[] = [];
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      const tokens = tokensOf(scenario);
      let expected = 5;
      for (const zone of ['A', 'B'] as const) {
        const color = tokens[zone];
        // a blue token fits completely on the blue disc, a red or green one is only partly inside its small square
        assert.equal(onOwnTarget(sim, zone, color), color === 'blue' ? 'full' : 'part', `${what}: zone ${zone}`);
        assert.equal(pointsOf(sim, tokenLineId(color)), color === 'blue' ? 10 : 5, `${what}: ${color}`);
        expected += color === 'blue' ? 10 : 5;
      }
      assert.equal(sim.score().total, expected, what);
      assert.equal(expected, [1, 3].includes(scenario.option) ? 15 : 20, `${what}: 15 on zone cards 1 and 3, 20 on the others`);
      assert.equal(pointsOf(sim, LINE_SCAN_STATION), 0);
      assert.deepEqual(screen(sim), [`Token: ${tokens.A}`, `Token: ${tokens.B}`], what);
      assertUntouched(sim, tokenId('C'), what);
      for (const team of ['red', 'green'] as const) assertUntouched(sim, teamCubeId(team), what);
      times.push(sim.world.time);
      totals.push(sim.score().total);
    }
    assert.deepEqual([totals.filter((n) => n === 20).length, totals.filter((n) => n === 15).length], [8, 4]);
    assert.ok(Math.abs(Math.min(...times) - 15.84) < 0.02 && Math.abs(Math.max(...times) - 17.74) < 0.02, `${Math.min(...times)} to ${Math.max(...times)} s`);
    // the description's "after 16 to 18 seconds"
    assert.ok(Math.round(Math.min(...times)) === 16 && Math.round(Math.max(...times)) === 18);
  });

  test('the try of the description: zone C too - all three tokens, 25 points on all 12 arrangements', () => {
    const zoneC = withLastBlocksAgain(s.program, 2, (copies) => {
      copies[0].inputs!.ARG0.shadow!.fields!.NUM = ZONE_Y_CM.C;
    });
    const times: number[] = [];
    for (const scenario of ARRANGEMENTS) {
      const played = play(zoneC, scenario);
      assertClean(played, label(scenario));
      assert.equal(played.sim.score().total, 25, label(scenario));
      for (const color of TOKEN_COLORS) assert.equal(pointsOf(played.sim, tokenLineId(color)), color === 'blue' ? 10 : 5);
      times.push(played.sim.world.time);
    }
    assert.ok(Math.abs(Math.min(...times) - 22.39) < 0.02 && Math.abs(Math.max(...times) - 25.59) < 0.02, `${Math.min(...times)} to ${Math.max(...times)} s`);
  });
});

// =============================================================================================
// 6. locker-whole-mission
// =============================================================================================

describe('locker-whole-mission: the whole Locker Room mission', () => {
  const s = sample('locker-whole-mission');

  /** The same program with the zones visited in another order (the try of the description). */
  function inOrder(order: ZoneId[]): ProgramJson {
    const copy = changed(s.program, () => undefined);
    const chain = startScript(copy);
    const takes = chain.map((block, i) => ({ block, i })).filter(({ block }) => block.type === 'procedures_callnoreturn' && (block.extraState as { name: string }).name === 'take the token at');
    assert.equal(takes.length, 3);
    const zoneOf = (block: BlockJson): ZoneId => ZONE_IDS.find((z) => ZONE_Y_CM[z] === Number(block.inputs?.ARG0?.shadow?.fields?.NUM))!;
    const pairs = new Map(takes.map(({ block, i }) => [zoneOf(block), [chain[i], chain[i + 1]]]));
    const blocks = [...chain.slice(0, takes[0].i), ...order.flatMap((z) => pairs.get(z)!)];
    for (const block of blocks) delete block.next;
    for (let i = 0; i + 1 < blocks.length; i++) blocks[i].next = { block: blocks[i + 1] };
    return copy;
  }

  test('all 12 arrangements: 75 points - the card, the team cube, the gate, every token on the target of its colour - in 50.78 to 56.68 s', () => {
    const times: Record<TeamColor, number[]> = { red: [], green: [] };
    for (const scenario of ARRANGEMENTS) {
      const played = play(s.program, scenario);
      const { sim } = played;
      const what = label(scenario);
      assertClean(played, what);
      assert.equal(sim.finishReason, 'program-ended', what);
      assert.equal(sim.score().total, 75, what);
      assertCardSteps(sim, what);
      assert.equal(pointsOf(sim, LINE_DELIVERY), 20, what);
      assert.equal(pointsOf(sim, LINE_GATE), 5, what);
      const tokens = tokensOf(scenario);
      for (const zone of ZONE_IDS) {
        const color = tokens[zone];
        assert.equal(onOwnTarget(sim, zone, color), color === 'blue' ? 'full' : 'part', `${what}: zone ${zone}`);
        assert.equal(pointsOf(sim, tokenLineId(color)), color === 'blue' ? 10 : 5, `${what}: ${color}`);
      }
      // the most a match gives in this simulator: everything but the 5 + 5 a red and a green token can never get on a square smaller than a cube
      assert.equal(sim.score().total, MAX_SCORE - 10);
      assert.deepEqual(screen(sim), [`Team: ${scenario.team}`, ...ZONE_IDS.map((zone) => `Token: ${tokens[zone]}`)], what);
      assertUntouched(sim, teamCubeId(otherTeam(scenario.team)), what);
      times[scenario.team].push(sim.world.time);
    }
    const all = [...times.red, ...times.green];
    const span = (list: number[]): string => `${Math.min(...list).toFixed(2)} to ${Math.max(...list).toFixed(2)}`;
    assert.equal(span(times.red), '53.48 to 56.68');
    assert.equal(span(times.green), '50.78 to 53.98');
    // the description's "in 51 to 57 of the 150 seconds"
    assert.ok(Math.round(Math.min(...all)) === 51 && Math.round(Math.max(...all)) === 57);
    // the default arrangement
    const usual = play(s.program, defaultScenario()).sim;
    assert.ok(Math.abs(usual.world.time - 52.03) < 0.02, `${usual.world.time} s`);
  });

  test('it never assumes an arrangement: the card and every token are read, and what was read decides', () => {
    // the program holds no colour of its own: the claw sensor is read in two places only - the card
    // into "team colour", a token into "token colour" - and every colour a block names is compared
    // with one of those two
    const blocks = blocksOf(s.program);
    const reads = blocks.filter((block) => block.type === 'sensing_claw_color');
    assert.equal(reads.length, 2);
    assert.equal(blocks.filter((block) => block.type === 'sensing_claw_color_is').length, 0);
    const setters = blocks.filter((block) => block.type === 'data_setvariableto' && block.inputs?.VALUE?.block?.type === 'sensing_claw_color');
    const setName = (block: BlockJson): string | undefined => variableName(s.program, { type: 'data_variable', id: block.id, fields: { VARIABLE: block.fields?.VARIABLE } });
    assert.deepEqual(setters.map(setName).sort(), ['team colour', 'token colour']);
    assert.ok(blocksOf({ blocks: { blocks: [definitionOf(s.program, 'wait at the Scan Station')] } }).some((b) => b.type === 'sensing_claw_color'));
    assert.ok(blocksOf({ blocks: { blocks: [definitionOf(s.program, 'take the token at')] } }).some((b) => b.type === 'sensing_claw_color'));
    const COLOURS = ['red', 'green', 'blue'];
    const compared: string[] = [];
    for (const block of blocks.filter((b) => b.type === 'operator_equals')) {
      const sides = [block.inputs?.OPERAND1, block.inputs?.OPERAND2];
      const named = sides.find((slot) => !slot?.block && COLOURS.includes(String(slot?.shadow?.fields?.TEXT)));
      if (!named) continue;
      const other = sides.find((slot) => slot !== named);
      compared.push(`${variableName(s.program, other?.block)} = ${named.shadow?.fields?.TEXT}`);
    }
    assert.deepEqual(compared.sort(), ['team colour = red', 'token colour = green', 'token colour = red']);
    // the same blocks do what the cards say: each zone's token ends on the target of its colour on every
    // arrangement - on the red, the green and the blue target, on different ones - and the cube of
    // each team colour ends in the circle of that colour
    const seen = new Map<ZoneId, Set<string>>(ZONE_IDS.map((zone) => [zone, new Set()]));
    for (const scenario of ARRANGEMENTS) {
      const { sim } = play(s.program, scenario);
      const tokens = tokensOf(scenario);
      for (const zone of ZONE_IDS) {
        const where = TOKEN_COLORS.find((color) => onMark(footprintOf(sim, tokenId(zone)), targetOf(color)) !== null);
        assert.equal(where, tokens[zone], `${label(scenario)} zone ${zone}`);
        seen.get(zone)!.add(where!);
      }
      const cube = bodyOf(sim, teamCubeId(scenario.team));
      const circle = BIG_CIRCLES[scenario.team];
      assert.ok(Math.hypot(cube.x - circle.cx, cube.y - circle.cy) < 1, label(scenario));
    }
    for (const zone of ZONE_IDS) assert.deepEqual([...seen.get(zone)!].sort(), ['blue', 'green', 'red'], `zone ${zone}: all three targets`);
  });

  test('the try of the description: the zones in the order C, B, A - also 75 points on all 12; faster on most RED arrangements, slower on most GREEN ones', () => {
    assert.deepEqual(inOrder(['A', 'B', 'C']), s.program, 'the program as it is written visits A, B, C');
    const reversed = inOrder(['C', 'B', 'A']);
    const faster: Record<TeamColor, number> = { red: 0, green: 0 };
    const times: number[] = [];
    for (const scenario of ARRANGEMENTS) {
      const asWritten = play(s.program, scenario);
      const played = play(reversed, scenario);
      const what = `C B A ${label(scenario)}`;
      assertClean(played, what);
      assert.equal(played.sim.score().total, 75, what);
      if (played.sim.world.time < asWritten.sim.world.time) faster[scenario.team]++;
      times.push(played.sim.world.time);
    }
    // (the cards decide: the order changes which targets come after which zones)
    assert.deepEqual(faster, { red: 5, green: 1 });
    assert.ok(Math.abs(Math.min(...times) - 52.14) < 0.02 && Math.abs(Math.max(...times) - 55.59) < 0.02, `${Math.min(...times)} to ${Math.max(...times)} s`);
  });
});

function footprintOf(sim: Sim, id: string): OBB {
  const b = bodyOf(sim, id);
  return { x: b.x, y: b.y, w: b.w, l: b.l, angle: b.angle };
}

// =============================================================================================
// What the examples print, and the examples in the block editor
// =============================================================================================

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(path.join(HERE, '../ui/CyberPiPanel.tsx'), 'utf8'))?.[1]);

  /** The longest text a slot can give: the written text, the two halves of a "join" - or "green" for a colour read at the claw. */
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
    assert.equal(seen, 9, 'every print block of the six examples was looked at');
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
  test('every example loads into the Locker Room editor, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: lockerRoomGame.id });
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
      // a RED and a GREEN arrangement, and the default one
      for (const scenario of [defaultScenario(), ARRANGEMENTS[0], ARRANGEMENTS[SCENARIO_COUNT - 1]]) {
        const fromBuilder = runMatch({ game: lockerRoomGame, scenario, program: s.program });
        const fromEditor = runMatch({ game: lockerRoomGame, scenario, program: saved });
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
    const file = path.join(HERE, '../../../public', lockerRoomGame.mat.sensorImageUrl);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

describe('the examples on the picture of the mat', () => {
  const picture = loadMatPicture();

  test('every example scores on the picture what it scores on the drawing, on all 12 arrangements', async (t) => {
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
        assert.ok(apart <= (s.id === 'locker-follow-line' ? 2 : 0), `${what}: ${apart.toFixed(2)} mm apart`);
      }
    }
  });

  test('the line follower on the picture: crooked and beside the line it still stops inside the Scan Station', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    const s = sample('locker-follow-line');
    for (const degrees of [-2.5, 0, 2.5]) {
      for (const side of [-10, 0, 10]) {
        const startPose = { x: START_POSE.x, y: START_POSE.y + side, heading: START_POSE.heading + (degrees * Math.PI) / 180 };
        const played = play(s.program, defaultScenario(), { sampler: mat, startPose });
        const what = `picture, ${degrees} degrees, ${side} mm`;
        assertClean(played, what);
        assert.equal(played.sim.score().total, 15, what);
        assert.ok(played.sim.robotShapes().every((shape) => insideRect(shape, SCAN_STATION)), what);
        const behind = played.sim.world.robot.pose.x - REACH.rear - SCAN_STATION.x;
        assert.ok(behind > 6.5 && behind < 9.5, `${what}: ${behind.toFixed(2)} mm of room behind`);
      }
    }
  });
});
