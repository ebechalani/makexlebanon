/**
 * The six examples of Fire Cadet (samples.ts), run for real:
 *
 *   row of cards  ->  card interpreter (cards.ts)  ->  engine with the two sticks  ->  referee (game.ts)
 *
 * Every example is played on its own practice map and on all eight, and the tests hold the two
 * tables of design 5.5 number for number: a change of the engine, the referee or the maps that
 * moves one number is seen here. Each test of a description asserts what that description
 * promises - no more, no less - and every number written in a description is checked against
 * the measured one.
 *
 * The second table is the one of lead decisions D1 and D5: an obstacle touched costs 1 point,
 * the referee puts it back, and the robot goes on with its row, on the squares. (With the fixed
 * obstacles of the design's revision 2 a touched obstacle stopped the robot off the squares for
 * the rest of the match: 14 cells of that table were 0 where they are 4 now - the return bonus
 * minus the touch. The first table did not change.) Every touch of that table is the robot's own:
 * no example pushes an item into an obstacle on any map, so D5 (an item's touch costs the point
 * too) changed no number of either table.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import type { BatchResult } from '../core/batch';
import { EXAMPLE_LEVELS as FIRE_CHIEF_LEVELS, SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { EXAMPLE_LEVELS as FIRE_RESCUE_LEVELS, SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { EXAMPLE_LEVELS as LOCKER_ROOM_LEVELS, SAMPLE_CATALOG as LOCKER_ROOM_CATALOG } from '../locker-room/sample-catalog';
import { EXAMPLE_LEVELS as WAREHOUSE_SORT_LEVELS, SAMPLE_CATALOG as WAREHOUSE_SORT_CATALOG } from '../warehouse-sort/sample-catalog';
import { cardRowProgram, cardsFromText, cardsToText, expand, isNumberCard, readCards, rowProblem, rowSeconds, rowTicks, timesOf } from './cards';
import { PLACES } from './field';
import { REFEREE_WORDS, itemId } from './game';
import { FIRE_CADET, spot } from './numbers';
import { playEveryPracticeMap, playFireCadet } from './play';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import { SAMPLE_PROGRAMS, getSampleProgram, type SampleProgram } from './samples';
import { ITEM_NAMES, PRACTICE_MAPS, practiceMapNumber, readMapCode, squareName, type FireCadetScenario, type ItemName, type ObstacleKind } from './scenario';
import { findRowForAllPoints, solve } from './solver';
import { sq, watchMatch, type WatchedMatch } from './test-helpers';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================================
// The two tables of design 5.5, as measured
// =============================================================================================

/** Each example on its own map: the first table (and the moment each item was delivered). */
const OWN: Record<string, { map: string; row: string; cards: number; moves: number; seconds: number; points: number; delivered: Partial<Record<ItemName, number>>; home: boolean }> = {
  'cadet-three-forward': { map: 'P1', row: 'F F F', cards: 3, moves: 3, seconds: 5.6, points: 5, delivered: { cat: 4.34 }, home: false },
  'cadet-there-and-back': { map: 'P1', row: 'F3 B3', cards: 4, moves: 6, seconds: 11.6, points: 10, delivered: { cat: 4.34 }, home: true },
  'cadet-turn-around': { map: 'P3', row: 'F R2 F', cards: 4, moves: 4, seconds: 7, points: 10, delivered: { equipment: 5.74 }, home: true },
  'cadet-two-rescues': { map: 'P1', row: 'F3 B L F3 B3 L F2', cards: 11, moves: 14, seconds: 27, points: 15, delivered: { cat: 4.34, person: 14.04 }, home: true },
  'cadet-round-the-sign': { map: 'P5', row: 'L B R F3 L F B L F3 R F', cards: 13, moves: 15, seconds: 28.1, points: 10, delivered: { cat: 13.44 }, home: true },
  'cadet-all-four': {
    map: 'P1',
    row: 'F3 B L F3 L F R2 F5 B5 B R F3',
    cards: 18,
    moves: 27,
    seconds: 52.1,
    points: 25,
    delivered: { cat: 4.34, person: 14.04, water: 31.14, equipment: 50.84 },
    home: true,
  },
};

/**
 * Each example on the eight maps, P1 to P8: the second table ("4 (-1)": 4 points, one obstacle
 * touched; the total never goes below 0, so "0 (-1)" is a touch with nothing else earned).
 */
const EIGHT: Record<string, readonly string[]> = {
  'cadet-three-forward': ['5', '0', '0', '0', '0 (-1)', '0', '0 (-1)', '0 (-1)'],
  'cadet-there-and-back': ['10', '5', '5', '5', '4 (-1)', '5', '4 (-1)', '4 (-1)'],
  'cadet-turn-around': ['5', '5', '10', '5', '5', '5', '5', '5'],
  'cadet-two-rescues': ['15', '5', '5', '4 (-1)', '4 (-1)', '4 (-1)', '4 (-1)', '4 (-1)'],
  'cadet-round-the-sign': ['5', '10', '5', '4 (-1)', '10', '5', '5', '5'],
  'cadet-all-four': ['25', '5', '5', '4 (-1)', '4 (-1)', '4 (-1)', '4 (-1)', '4 (-1)'],
};

/** Which obstacle the robot touches, on the maps where it touches one (map number -> kind), as the comments of samples.ts say. */
const TOUCHED: Record<string, Readonly<Record<number, ObstacleKind>>> = {
  'cadet-three-forward': { 5: 'road-closed', 7: 'road-closed', 8: 'road-closed' },
  'cadet-there-and-back': { 5: 'road-closed', 7: 'road-closed', 8: 'road-closed' },
  'cadet-turn-around': {},
  'cadet-two-rescues': { 4: 'road-closed', 5: 'road-closed', 6: 'broken-vehicle', 7: 'road-closed', 8: 'road-closed' },
  'cadet-round-the-sign': { 4: 'broken-vehicle' },
  'cadet-all-four': { 4: 'road-closed', 5: 'road-closed', 6: 'broken-vehicle', 7: 'road-closed', 8: 'road-closed' },
};

/** The items an example delivers on a map that is not its own (everything else there is the bonus alone, or nothing). */
const ALSO_DELIVERED: Record<string, Readonly<Record<number, readonly ItemName[]>>> = {
  'cadet-round-the-sign': { 2: ['cat'] },
};

/** The tries of the descriptions that name a map or a row: the map, the row, and what it scores there. */
const TRIES: Record<string, { map: string; row: string; points: number; seconds?: number }> = {
  // "Try a Forward card with an x3 card behind it in place of the three Forward cards. Does the robot do the same?"
  'cadet-three-forward': { map: 'P1', row: 'F3', points: 5, seconds: 5.6 },
  // "Try it on map 2: there is no Cat on the way, so it scores 5."
  'cadet-there-and-back': { map: 'P2', row: 'F3 B3', points: 5 },
  // "Try Turn left with x2 in place of Turn right with x2."
  'cadet-turn-around': { map: 'P3', row: 'F L2 F', points: 10, seconds: 7 },
  // "Try it on map 2: the Cat stands in the same column there."
  'cadet-round-the-sign': { map: 'P2', row: 'L B R F3 L F B L F3 R F', points: 10 },
};

/**
 * Every number a description writes, in its order, and what it stands for: its map; the points
 * and the seconds on that map; the number of cards; a number card of its row ("x3": the next
 * number card of the row that the text names); a number card of the row of its try; the map of
 * its try, and what the try scores.
 */
const TOLD: Record<string, readonly string[]> = {
  'cadet-three-forward': ['map', 'points', 'seconds', 'try card'],
  'cadet-there-and-back': ['map', 'card', 'card', 'points', 'seconds', 'try map', 'try points'],
  'cadet-turn-around': ['map', 'card', 'points', 'seconds', 'try card', 'card again'],
  'cadet-two-rescues': ['map', 'card', 'card', 'card', 'card', 'points', 'seconds'],
  'cadet-round-the-sign': ['map', 'card', 'card', 'points', 'seconds', 'try map'],
  'cadet-all-four': ['map', 'points', 'seconds', 'cards', 'card', 'card', 'card', 'try map'],
};

const IDS = ['cadet-three-forward', 'cadet-there-and-back', 'cadet-turn-around', 'cadet-two-rescues', 'cadet-round-the-sign', 'cadet-all-four'];

// =============================================================================================
// Helpers, and every match played once
// =============================================================================================

const sample = (id: string): SampleProgram => {
  const found = getSampleProgram(id);
  assert.ok(found, id);
  return found;
};

/** A practice map from its code ("P3"). */
const mapOf = (code: string): FireCadetScenario => {
  const reading = readMapCode(code);
  assert.ok(reading.ok, code);
  return reading.scenario;
};

/** One line of the score sheet: 'water', 'cat', 'person', 'equipment', 'return' or 'obstacles'. */
const lineOf = (result: BatchResult, id: string) => {
  const line = result.lines.find((l) => l.id === id);
  assert.ok(line, id);
  return line;
};

/** "4 (-1)": the total, and the obstacle penalty when there is one - the notation of the second table. */
const cell = (result: BatchResult): string => {
  const penalty = lineOf(result, 'obstacles').points;
  return penalty < 0 ? `${result.total} (${penalty})` : `${result.total}`;
};

/** How far a point is from the lattice of the squares' spots (N1), along one axis. */
const LATTICE = spot({ col: 0, row: 0 }).x;
const offLattice = (v: number): number => Math.abs(v - (LATTICE + FIRE_CADET.GRID_PITCH * Math.round((v - LATTICE) / FIRE_CADET.GRID_PITCH)));

/** The square of a stop of the robot ([x, y, heading]) as the screen names it: "D5". */
const squareAt = ([x, y]: readonly number[]): string =>
  squareName({ col: Math.round((x - LATTICE) / FIRE_CADET.GRID_PITCH), row: Math.round((y - LATTICE) / FIRE_CADET.GRID_PITCH) });

/** Where the robot stopped after each move, as squares: ["D6", "D5", ...]. */
const stopSquares = (watched: WatchedMatch): string[] => watched.stops.map(squareAt);

/** Two numbers that must agree (times and lengths: the engine adds up ticks of 0.01 s in floating point). */
const close = (a: number, b: number, why: string, within = 1e-6): void => assert.ok(Math.abs(a - b) <= within, `${why}: ${a} and ${b}`);

/** The middle of an item in the robot's frame: [mm ahead of the turning point, mm to its right]. */
function inRobotFrame(watched: WatchedMatch, item: ItemName): [number, number] {
  const body = watched.sim.world.bodies.find((b) => b.id === itemId(item));
  assert.ok(body, `${item} is on the field`);
  const pose = watched.sim.world.robot.pose;
  const dx = body.x - pose.x;
  const dy = body.y - pose.y;
  // (heading 0 looks up the map, to smaller y; a quarter turn to the right looks to larger x)
  return [dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading), dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading)];
}

/** Between the two sticks, as the engine holds an item there: against the front of the body, on the robot's middle line. */
function assertBetweenTheSticks(watched: WatchedMatch, item: ItemName, why: string): void {
  const [ahead, side] = inRobotFrame(watched, item);
  close(ahead, FIRE_CADET.TURNING_POINT_TO_FRONT + FIRE_CADET.ITEM_BASE / 2, `${why}: the ${item} rests against the front of the body`, 0.01);
  close(side, 0, `${why}: the ${item} is on the robot's middle line`, 0.01);
  assert.ok(ahead < FIRE_CADET.TURNING_POINT_TO_FRONT + FIRE_CADET.STICK_LENGTH, `${why}: not beyond the tips of the sticks`);
}

/** The first `n` cards of an example's row, played on its own map. */
const firstCards = (id: string, n: number): WatchedMatch => watchMatch(cardRowProgram(sample(id).program.cards.slice(0, n)), mapOf(OWN[id].map));

const OWN_RESULT = new Map(IDS.map((id) => [id, playFireCadet(sample(id).program, OWN[id].map)]));
const OWN_WATCHED = new Map(IDS.map((id) => [id, watchMatch(sample(id).program, mapOf(OWN[id].map))]));
const ON_EIGHT = new Map(IDS.map((id) => [id, playEveryPracticeMap(sample(id).program)]));

/** The sentences the examples guard looks for: those of six words or more (members/client-guard.test.ts, descriptionMarkers). */
function tellingSentences(description: string): string[] {
  return description
    .split(/(?<=[.!?:])\s+/)
    .map((sentence) => sentence.replace(/[.!?:]+$/, '').trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 6);
}

// =============================================================================================
// The list of the examples
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples: three for starters, two in between, one advanced - in the order of the Examples window', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'cadet-three-forward starter',
        'cadet-there-and-back starter',
        'cadet-turn-around starter',
        'cadet-two-rescues intermediate',
        'cadet-round-the-sign intermediate',
        'cadet-all-four advanced',
      ],
    );
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => card.title),
      ['Three cards for the cat', 'There and back again', 'Turn around with the toolbox', 'Two rescues and home', 'Round the closed road', 'All four rescues'],
    );
    assert.deepEqual(
      SAMPLE_PROGRAMS.map((s) => s.id),
      IDS,
      'samples.ts has a program for every card, in the same order',
    );
    for (const s of SAMPLE_PROGRAMS) {
      assert.deepEqual({ id: s.id, title: s.title, level: s.level }, exampleCard(s.id), 'title and level come from the catalog');
      assert.equal(getSampleProgram(s.id), s);
      assert.deepEqual(Object.keys(s).sort(), ['description', 'id', 'level', 'program', 'title']);
    }
    assert.equal(getSampleProgram('no-such-example'), undefined);
    assert.throws(() => exampleCard('locker-to-station'), /not on the list/);
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => `${level.id} ${level.title}`),
      ['starter Starter', 'intermediate Intermediate', 'advanced Advanced'],
    );
    for (const level of EXAMPLE_LEVELS) assert.ok(level.about.length > 8 && level.about.length < 40, level.id);
    // they use maps 1, 3 and 5 only: maps 2, 4, 6, 7 and 8 stay for the children's own rows
    assert.deepEqual([...new Set(SAMPLE_PROGRAMS.map((s) => s.program.field))].sort(), ['P1', 'P3', 'P5']);
  });

  test('every id starts with "cadet-"; no id, title or heading words of another game are used again', () => {
    const others = [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...WAREHOUSE_SORT_CATALOG, ...LOCKER_ROOM_CATALOG];
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...others, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^cadet-[a-z]+(-[a-z]+)*$/, `${card.id}: small letters and hyphens, no digits`);
    for (const card of others) assert.ok(!card.id.startsWith('cadet-'), card.id);
    // a teacher reads the titles out: short, no apostrophe (the guard's rule for a line of the catalog)
    for (const card of SAMPLE_CATALOG) assert.match(card.title, /^[^']{4,30}$/, card.title);
    // the few words after a heading are this game's own: different from each other and from the twelve of the other games
    const otherAbouts = [...FIRE_RESCUE_LEVELS, ...FIRE_CHIEF_LEVELS, ...WAREHOUSE_SORT_LEVELS, ...LOCKER_ROOM_LEVELS].map((level) => level.about);
    assert.equal(otherAbouts.length, 12);
    assert.equal(new Set([...otherAbouts, ...EXAMPLE_LEVELS.map((level) => level.about)]).size, 15);
  });

  test('every program is a valid row of cards for one practice map: readCards gives it back unchanged, and "field" reads as that map', () => {
    for (const s of SAMPLE_PROGRAMS) {
      const own = OWN[s.id];
      assert.deepEqual(Object.keys(s.program).sort(), ['cards', 'field', 'format', 'version'], s.id);
      assert.equal(s.program.format, 'mtiny-cards');
      assert.equal(s.program.version, 1);
      assert.equal(rowProblem(s.program.cards), null, `${s.id}: no refused card`);
      assert.deepEqual(readCards(s.program), s.program.cards, `${s.id}: read back unchanged`);
      assert.deepEqual(readCards(JSON.parse(JSON.stringify(s.program))), s.program.cards, `${s.id}: also after a trip through JSON, as from the server`);
      assert.deepEqual(s.program, cardRowProgram(cardsFromText(own.row), own.map), `${s.id}: the row of the table`);
      assert.equal(cardsToText(s.program.cards), own.row);
      assert.equal(s.program.cards.length, own.cards, `${s.id}: cards`);
      assert.equal(expand(s.program.cards).length, own.moves, `${s.id}: moves`);
      const reading = readMapCode(s.program.field ?? '');
      assert.ok(reading.ok, `${s.id}: "${s.program.field}" reads as a map`);
      assert.equal(practiceMapNumber(reading.scenario), Number(own.map.slice(1)), `${s.id}: a practice map`);
      assert.ok(s.program.cards.length <= FIRE_CADET.MAX_ROW_CARDS);
    }
  });
});

// =============================================================================================
// The first table: each example on its own map
// =============================================================================================

describe('each example on its own map (the first table of design 5.5)', () => {
  for (const id of IDS) {
    const own = OWN[id];
    test(`${id} on ${own.map}: ${own.points} points after ${own.seconds} s, the row runs to its end`, () => {
      const result = OWN_RESULT.get(id) as BatchResult;
      const cards = sample(id).program.cards;
      assert.equal(result.finishReason, 'program-ended', 'the match ends when the row has run');
      assert.equal(result.total, own.points);
      close(result.time, own.seconds, 'the time');
      assert.equal(Math.round(result.time / FIRE_CADET.SIM_DT), rowTicks(cards), 'at the tick of rowTicks');
      close(rowSeconds(cards), own.seconds, 'rowSeconds');
      assert.equal(result.complete, own.points === FIRE_CADET.MAX_POINTS);
      // the lines, one by one: the items delivered (and when), the bonus, no obstacle
      for (const item of ITEM_NAMES) {
        const line = lineOf(result, item);
        const at = own.delivered[item];
        assert.equal(line.points, at === undefined ? 0 : FIRE_CADET.POINTS_ITEM, `${id}: ${item}`);
        if (at !== undefined) close(line.time ?? Number.NaN, at, `${id}: when the ${item} was delivered`);
      }
      assert.equal(lineOf(result, 'return').points, own.home ? FIRE_CADET.POINTS_RETURN : 0, `${id}: the bonus`);
      assert.equal(lineOf(result, 'obstacles').points, 0, `${id}: no obstacle touched`);
      assert.equal(lineOf(result, 'obstacles').detail, REFEREE_WORDS.noObstacle);
    });

    test(`${id} on ${own.map}: on the squares after every card, no "wrong place", and only the delivered items leave the field`, () => {
      const watched = OWN_WATCHED.get(id) as WatchedMatch;
      assert.equal(watched.stops.length, own.moves, 'one stop per move');
      for (const [x, y] of watched.stops) assert.ok(offLattice(x) < 0.001 && offLattice(y) < 0.001, `${id}: a stop at ${x}, ${y}`);
      // N24: an item pushed through a marked place is not "in a wrong place"
      assert.deepEqual(
        watched.said.filter(([, text]) => /belongs/.test(text)),
        [],
      );
      for (const line of watched.sim.score().lines) assert.doesNotMatch(line.detail, /belongs/, `${id}: ${line.id}`);
      // the referee lifts nothing but the delivered items: no obstacle is touched, none is put back
      assert.deepEqual(
        watched.gone.map(([, gone]) => gone).sort(),
        Object.keys(own.delivered)
          .map((item) => itemId(item as ItemName))
          .sort(),
      );
      assert.deepEqual(watched.back, []);
      assert.equal(watched.tableEdge, false, 'nothing meets the edge of the table');
      // what the referee says is one sentence per delivery, and nothing else
      assert.deepEqual(
        watched.said.map(([, text]) => text),
        (Object.entries(own.delivered) as [ItemName, number][]).sort((a, b) => a[1] - b[1]).map(([item]) => REFEREE_WORDS.delivered[item]),
      );
    });
  }
});

// =============================================================================================
// The second table: each example on all eight maps
// =============================================================================================

describe('each example on all eight practice maps (the second table of design 5.5)', () => {
  test('the whole table, number for number: a row of cards fits one map', () => {
    const table = Object.fromEntries(IDS.map((id) => [id, (ON_EIGHT.get(id) as BatchResult[]).map(cell)]));
    assert.deepEqual(table, EIGHT);
    // its own map is where it scores most
    for (const id of IDS) {
      const own = Number(OWN[id].map.slice(1)) - 1;
      const totals = (ON_EIGHT.get(id) as BatchResult[]).map((r) => r.total);
      assert.equal(Math.max(...totals), totals[own], id);
    }
  });

  test('on every map the row runs to its end at the same moment; the obstacle touched is the one the comments of samples.ts name, and the bonus is all that is left', () => {
    for (const id of IDS) {
      const results = ON_EIGHT.get(id) as BatchResult[];
      results.forEach((result, n) => {
        const map = n + 1;
        const why = `${id} on P${map}`;
        assert.equal(result.finishReason, 'program-ended', why);
        close(result.time, OWN[id].seconds, why);
        const kind = TOUCHED[id][map];
        assert.equal(lineOf(result, 'obstacles').detail, kind === undefined ? REFEREE_WORDS.noObstacle : REFEREE_WORDS.touched([kind]), why);
        if (`P${map}` === OWN[id].map) return;
        const delivered = ITEM_NAMES.filter((item) => lineOf(result, item).points > 0);
        assert.deepEqual(delivered, ALSO_DELIVERED[id]?.[map] ?? [], `${why}: what it delivers`);
      });
    }
  });

  test('D5: no example pushes an item into an obstacle, on any of the eight maps - every obstacle it touches, the robot itself touches', () => {
    let robotTouches = 0;
    for (const id of IDS) {
      PRACTICE_MAPS.forEach((map, n) => {
        const said = watchMatch(sample(id).program, map).said.map(([, text]) => text);
        for (const text of said) assert.doesNotMatch(text, /^The (Water|Cat|Injured Person|Equipment) touched /, `${id} on P${n + 1}: ${text}`);
        if (said.some((text) => /^The robot touched .+: -1\./.test(text))) robotTouches++;
      });
    }
    // the cells with a (-1) in the second table: each one a touch of the robot
    const minus = IDS.flatMap((id) => (ON_EIGHT.get(id) as BatchResult[]).filter((r) => lineOf(r, 'obstacles').points < 0)).length;
    assert.equal(robotTouches, minus);
    assert.equal(minus, 17);
  });
});


// =============================================================================================
// What the descriptions say
// =============================================================================================

describe('what the descriptions say', () => {
  test('every number a description writes is the measured one', () => {
    for (const s of SAMPLE_PROGRAMS) {
      const own = OWN[s.id];
      const result = OWN_RESULT.get(s.id) as BatchResult;
      const written = (s.description.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
      assert.equal(written.length, TOLD[s.id].length, `${s.id}: the numbers it writes: ${written.join(', ')}`);
      const numberCards = s.program.cards.filter(isNumberCard).map(timesOf);
      const tryOf = TRIES[s.id];
      let cursor = 0;
      TOLD[s.id].forEach((what, i) => {
        const number = written[i];
        const why = `${s.id}: the number ${number} (${what})`;
        switch (what) {
          case 'map':
            assert.equal(number, Number(own.map.slice(1)), why);
            break;
          case 'points':
            assert.equal(number, result.total, why);
            break;
          case 'seconds':
            close(number, result.time, why);
            break;
          case 'cards':
            assert.equal(number, s.program.cards.length, why);
            break;
          case 'card': {
            // the next number card of the row that the text names (the advanced example tells its first cards in words)
            const at = numberCards.indexOf(number, cursor);
            assert.ok(at >= 0, `${why}: an x${number} card of the row, after the ones named before it`);
            cursor = at + 1;
            break;
          }
          case 'card again':
            assert.equal(number, numberCards[cursor - 1], why);
            break;
          case 'try card':
            assert.ok(tryOf, why);
            assert.ok(cardsFromText(tryOf.row).filter(isNumberCard).map(timesOf).includes(number), `${why}: a number card of the try ${tryOf.row}`);
            break;
          case 'try map':
            assert.ok(tryOf || s.id === 'cadet-all-four', why);
            assert.equal(number, Number((tryOf?.map ?? 'P2').slice(1)), why);
            break;
          case 'try points':
            assert.equal(number, tryOf?.points, why);
            break;
          default:
            assert.fail(`${why}: nothing says what it stands for`);
        }
      });
    }
  });

  test('every try that names a map or a row scores what its sentence says', () => {
    for (const [id, tryOf] of Object.entries(TRIES)) {
      const result = playFireCadet(cardRowProgram(cardsFromText(tryOf.row), tryOf.map), tryOf.map);
      assert.equal(rowProblem(cardsFromText(tryOf.row)), null, `${id}: the try is a row that can be built`);
      assert.equal(result.finishReason, 'program-ended', id);
      assert.equal(result.total, tryOf.points, `${id}: ${tryOf.row} on ${tryOf.map}`);
      if (tryOf.seconds !== undefined) close(result.time, tryOf.seconds, `${id}: ${tryOf.row} on ${tryOf.map}`);
      assert.equal(lineOf(result, 'obstacles').points, 0, `${id}: the try touches no obstacle`);
    }
    // ... and agree with the second table: the same row on map 2
    assert.equal((ON_EIGHT.get('cadet-there-and-back') as BatchResult[])[1].total, TRIES['cadet-there-and-back'].points);
    assert.equal((ON_EIGHT.get('cadet-round-the-sign') as BatchResult[])[1].total, TRIES['cadet-round-the-sign'].points);
  });

  test('cadet-three-forward: three squares up the map, the Cat into the Safe Zone on the way, and the robot stays there', () => {
    const watched = OWN_WATCHED.get('cadet-three-forward') as WatchedMatch;
    const result = OWN_RESULT.get('cadet-three-forward') as BatchResult;
    assert.deepEqual(sample('cadet-three-forward').program.cards, ['forward', 'forward', 'forward'], 'three Forward cards');
    assert.deepEqual(stopSquares(watched), ['D6', 'D5', 'D4'], 'three squares up the map');
    assert.ok(watched.stops.every(([, , heading]) => heading === 0), 'looking up all the time');
    // "on the way": the Cat stands on D5 of map 1, in the robot's way
    assert.equal(squareName(PRACTICE_MAPS[0].cat), 'D5');
    assert.ok(lineOf(result, 'cat').ok);
    // "the robot stays in the Safe Zone, so there is no Fire Station bonus"
    assert.equal(squareAt(watched.stops[watched.stops.length - 1]), squareName(PLACES.safeZone));
    assert.equal(lineOf(result, 'return').points, 0);
    assert.equal(lineOf(result, 'return').detail, REFEREE_WORDS.notHome);
    // the try: "Does the robot do the same?" - yes: the same stops, the same points, the same time
    const withX3 = watchMatch(cardRowProgram(cardsFromText(TRIES['cadet-three-forward'].row)), PRACTICE_MAPS[0]);
    assert.deepEqual(withX3.stops, watched.stops);
    assert.deepEqual(withX3.said, watched.said);
    assert.equal(withX3.sim.world.time, watched.sim.world.time);
  });

  test('cadet-there-and-back: three squares up and three back, without turning, into the Fire Station: the Cat and the bonus', () => {
    const watched = OWN_WATCHED.get('cadet-there-and-back') as WatchedMatch;
    const result = OWN_RESULT.get('cadet-there-and-back') as BatchResult;
    assert.deepEqual(stopSquares(watched), ['D6', 'D5', 'D4', 'D5', 'D6', 'D7']);
    assert.ok(watched.stops.every(([, , heading]) => heading === 0), 'without turning');
    assert.deepEqual(
      result.lines.filter((line) => line.points > 0).map((line) => line.id),
      ['cat', 'return'],
      'the Cat and the Fire Station bonus',
    );
    // "Here the bonus needs the robot to leave the Fire Station first": the referee's rule (A8), the sheet says it the same way
    assert.match(REFEREE_WORDS.neverLeft, /^The robot has not left the Fire Station yet\. Here the bonus needs it to leave first\.$/);
    // the try, map 2: "there is no Cat on the way" - nothing at all stands on D4, D5 or D6 there
    const map2 = PRACTICE_MAPS[1];
    const onTheWay = ['D4', 'D5', 'D6'];
    for (const thing of [map2.water, map2.cat, map2.person, map2.equipment, ...map2.obstacles]) assert.ok(!onTheWay.includes(squareName(thing)), squareName(thing));
    const there = (ON_EIGHT.get('cadet-there-and-back') as BatchResult[])[1];
    assert.deepEqual(
      there.lines.filter((line) => line.points > 0).map((line) => line.id),
      ['return'],
    );
  });

  test('cadet-turn-around: Forward takes the Equipment between the sticks, it turns round with the robot, and both go back into the Fire Station', () => {
    const id = 'cadet-turn-around';
    // "where the Equipment stands just above the Fire Station"
    const map3 = PRACTICE_MAPS[2];
    assert.equal(squareName(map3.equipment), 'D6');
    assert.equal(map3.equipment.row, PLACES.station.row - 1);
    assert.equal(map3.equipment.col, PLACES.station.col);
    // "Forward: the Equipment is now between the two sticks."
    const afterForward = firstCards(id, 1);
    assert.deepEqual(stopSquares(afterForward), ['D6']);
    assertBetweenTheSticks(afterForward, 'equipment', 'after Forward');
    // "Turn right with x2: the robot turns round to look the other way, and the Equipment turns with it."
    const afterTurns = firstCards(id, 3);
    assert.deepEqual(
      afterTurns.stops.map(([, , heading]) => heading),
      [0, 90, 180],
    );
    assertBetweenTheSticks(afterTurns, 'equipment', 'after the two turns');
    // "Forward: the Equipment goes back into the Fire Station, and so does the robot."
    const watched = OWN_WATCHED.get(id) as WatchedMatch;
    assert.equal(stopSquares(watched).at(-1), 'D7');
    const result = OWN_RESULT.get(id) as BatchResult;
    assert.ok(lineOf(result, 'equipment').ok && lineOf(result, 'return').ok);
    // the try, Turn left with x2: the other way round, the same 10 points
    const leftRound = watchMatch(cardRowProgram(cardsFromText(TRIES[id].row)), map3);
    assert.deepEqual(
      leftRound.stops.map(([, , heading]) => heading),
      [0, -90, -180, -180],
    );
  });

  test('cadet-two-rescues: the Cat, one square back into the row of the Injured Person, the Hospital, back to the middle column and home', () => {
    const id = 'cadet-two-rescues';
    const map1 = PRACTICE_MAPS[0];
    const watched = OWN_WATCHED.get(id) as WatchedMatch;
    const stops = stopSquares(watched);
    const result = OWN_RESULT.get(id) as BatchResult;
    // "Forward with x3: the Cat goes into the Safe Zone." - while the first card runs
    assert.deepEqual(stops.slice(0, 3), ['D6', 'D5', 'D4']);
    assert.ok((lineOf(result, 'cat').time ?? Infinity) < rowSeconds(cardsFromText('F3')));
    // "Backward: one square back, into the row of the Injured Person."
    assert.equal(stops[3], 'D5');
    assert.equal(map1.person.row, sq('D5').row);
    // "Turn left, then Forward with x3: the Injured Person goes into the Hospital."
    assert.equal(stops[7], squareName(PLACES.hospital));
    assert.ok((lineOf(result, 'person').time ?? Infinity) <= rowSeconds(cardsFromText('F3 B L F3')));
    // "Backward with x3 brings the robot back to the middle column."
    assert.equal(stops[10], 'D5');
    assert.equal(sq(stops[10]).col, PLACES.station.col);
    // "Turn left and Forward with x2: home in the Fire Station."
    assert.equal(stops.at(-1), 'D7');
    assert.ok(lineOf(result, 'return').ok);
    // the try: "Try to add the Water: it stands just under the Hospital."
    assert.equal(map1.water.col, PLACES.hospital.col);
    assert.equal(map1.water.row, PLACES.hospital.row + 1);
  });

  test('cadet-round-the-sign: round the Road Closed sign, up the column of the Cat with the Cat, the Cat home, down the same column and home - the sign never touched', () => {
    const id = 'cadet-round-the-sign';
    const map5 = PRACTICE_MAPS[4];
    const watched = OWN_WATCHED.get(id) as WatchedMatch;
    const stops = stopSquares(watched);
    const result = OWN_RESULT.get(id) as BatchResult;
    // "A Road Closed sign stands two squares above the Fire Station"
    assert.equal(map5.obstacles[0].col, PLACES.station.col);
    assert.equal(map5.obstacles[0].row, PLACES.station.row - 2);
    // "Turn left, then Backward: the robot is now beside the Fire Station."
    assert.equal(stops[1], 'E7');
    // "Turn right, then Forward with x3: up the column of the Cat, with the Cat between the sticks."
    assert.equal(squareName(map5.cat), 'E6');
    assert.deepEqual(stops.slice(3, 6), ['E6', 'E5', 'E4']);
    assertBetweenTheSticks(firstCards(id, 5), 'cat', 'after Forward with x3');
    // "Turn left - the Cat turns with the robot - and Forward: the Cat is home in the Safe Zone."
    assertBetweenTheSticks(firstCards(id, 6), 'cat', 'after Turn left');
    assert.equal(stops[7], squareName(PLACES.safeZone));
    assert.ok(lineOf(result, 'cat').ok);
    // "Then Backward, Turn left, Forward with x3, Turn right and Forward: down the same column and home."
    assert.deepEqual(stops.slice(8), ['E4', 'E4', 'E5', 'E6', 'E7', 'E7', 'D7']);
    assert.ok(lineOf(result, 'return').ok);
    // "and the sign is never touched": the robot keeps a square away from it all the way
    assert.equal(lineOf(result, 'obstacles').points, 0);
    for (const stop of stops) assert.notEqual(stop, squareName(map5.obstacles[0]));
    // the try: "Try it on map 2: the Cat stands in the same column there."
    assert.equal(PRACTICE_MAPS[1].cat.col, map5.cat.col);
  });

  test('cadet-all-four: the whole mission on map 1 in 18 cards - the Cat, the Injured Person, the Water to the Fire, the Equipment home - and on no other map', () => {
    const id = 'cadet-all-four';
    const map1 = PRACTICE_MAPS[0];
    const watched = OWN_WATCHED.get(id) as WatchedMatch;
    const stops = stopSquares(watched);
    const result = OWN_RESULT.get(id) as BatchResult;
    assert.equal(result.total, FIRE_CADET.MAX_POINTS, 'all 25 points');
    assert.ok(result.complete);
    // "First the Cat goes to the Safe Zone, then the Injured Person to the Hospital." ... then the Water, then the Equipment
    assert.deepEqual(
      watched.gone.map(([, gone]) => gone),
      ['cat', 'person', 'water', 'equipment'].map((item) => itemId(item as ItemName)),
    );
    // "Then the Water: Turn left, then one square down, turn round with x2, and push it five squares up into the School, where the Fire is."
    assert.equal(map1.fire, 'school');
    assert.equal(squareName(map1.water), stops[9], 'one square down: onto the Water');
    assert.deepEqual(stops.slice(12, 17), ['A5', 'A4', 'A3', 'A2', 'A1']);
    // "Backward with x5 and one more Backward bring the robot to the bottom row."
    assert.equal(sq(stops[22]).row, FIRE_CADET.GRID_COUNT - 1);
    // "Turn right and Forward with x3: the robot catches the Equipment on the way, pushes it home and drives in after it."
    assert.deepEqual(stops.slice(24), ['B7', 'C7', 'D7']);
    assert.equal(squareName(map1.equipment), 'C7');
    assert.ok(lineOf(result, 'equipment').ok && lineOf(result, 'return').ok);
    // it is a shortest row for all the points on map 1: the solver finds none faster
    close(solve(map1)?.seconds ?? Number.NaN, OWN[id].seconds, 'the solver');
    // "On the other maps this row does not work": far from 25 on every other map
    (ON_EIGHT.get(id) as BatchResult[]).slice(1).forEach((other, n) => assert.ok(other.total <= FIRE_CADET.POINTS_RETURN && !other.complete, `P${n + 2}`));
    // "Try map 2 with a row of your own." - there is one (the editor's solver finds it)
    assert.equal(findRowForAllPoints(PRACTICE_MAPS[1]).found, true);
  });

  test('every description is short, plain and true to its level: one paragraph, short sentences, its points and a try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 650, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /\bpoints\b/, `${s.id} says what it scores`);
      assert.match(s.description, /\bTry\b/, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) assert.ok(sentence.length <= 140, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= FIRE_CADET.MAX_POINTS, `${s.id}: ${number} points`);
      // the screen's word for a combination is "map", and the cards are the ones of the card box
      assert.doesNotMatch(s.description, /combination|official|arrangement|block/i, s.id);
      assert.match(s.description, /practice map \d/, `${s.id} says which map it is made for`);
    }
    // each later example uses only what the earlier ones showed: the number cards and Backward from the second on, a turn from the third on
    const firstUse = (pattern: RegExp): number => SAMPLE_PROGRAMS.findIndex((s) => s.program.cards.some((card) => pattern.test(card)));
    assert.equal(firstUse(/^x\d$/), 1);
    assert.equal(firstUse(/^backward$/), 1);
    assert.equal(firstUse(/^(left|right)$/), 2);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Fire Cadet stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/fire-cadet/sample-catalog.ts';
  const SAMPLES = 'simulator/fire-cadet/samples.ts';
  // the only file that imports them: the server's list of all examples
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

  test('the list of titles imports nothing; the rows import only the list and the type of a row - not the program builder', () => {
    const catalog = files.get(CATALOG);
    const samples = files.get(SAMPLES);
    assert.ok(catalog && samples);
    assert.deepEqual(importsOf(CATALOG, catalog), []);
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/fire-cadet/cards', 'simulator/fire-cadet/sample-catalog']);
    assert.ok(!importsOf(SAMPLES, samples).includes('simulator/vm/builder'), 'a row of cards is no block program');
    // ... and of ./cards.ts only a type, so the server's list brings no interpreter along
    assert.match(samples, /^import type \{ CardRowProgram \} from '\.\/cards';$/m);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'cadet-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test("nothing imports them but each other and the server's list of all examples - no file of the simulator screen, no page (and the tests)", () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers(CATALOG), [SAMPLES, SERVER_LIST].sort());
    assert.deepEqual(importers(SAMPLES), [SERVER_LIST]);
  });

  test('no other file holds a title, an id or the words of a heading of these examples', () => {
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

  test('no sentence of a description is in a file of the game: not in the referee\'s words, the cards, the maps (the files the screen gets)', () => {
    // (the guard, ../members/client-guard.test.ts, does the same for every file the browser gets; this
    // says it early, and for every file of this folder: the screen of Fire Cadet imports them)
    const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const markers = SAMPLE_PROGRAMS.flatMap((s) => tellingSentences(s.description)).map((sentence) => new RegExp(sentence.split(/\s+/).map(escape).join('\\s+'), 'i'));
    assert.ok(markers.length >= 6 * 3, `${markers.length} sentences are looked for`);
    const own = readdirSync(HERE).filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file) && file !== 'samples.ts' && file !== 'sample-catalog.ts');
    for (const name of ['game.ts', 'cards.ts', 'scenario.ts']) assert.ok(own.includes(name), name);
    for (const file of own) {
      const text = readFileSync(path.join(HERE, file), 'utf8');
      // as it is written, and as its strings read when they are put together (a sentence made of pieces)
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const strings: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) strings.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      const read = `${text}\n${strings.join(' ')}`;
      const found = markers.find((marker) => marker.test(read));
      assert.equal(found, undefined, `${file} holds a sentence of the description of an example: "${found?.exec(read)?.[0]}"`);
    }
    // the guard's rule finds the sentences however they are written
    const first = tellingSentences(SAMPLE_PROGRAMS[0].description)[0];
    assert.ok(markers.some((marker) => marker.test(first.toUpperCase().replace(/ /g, '\n  '))));
  });
});

