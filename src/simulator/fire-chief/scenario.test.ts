/**
 * Fire Chief combinations: which mazes can be played, the hand-made mazes, the random generator,
 * and the short code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../core/geometry';
import {
  BEDROOM_CELL,
  FIRE_SPOTS,
  LIVING_ROOM_CELL,
  ROOM_IDS,
  START_CELL,
  WALL_POSITIONS,
  cellFromNumber,
  cellNumber,
  neighbours,
  wallIndexBetween,
  type Cell,
} from './field';
import {
  NAMED_MAZES,
  PERFECT_MAZE_WALLS,
  PLAYABLE_MAZE_COUNT,
  RANDOM_MIN_WALLS,
  SCENARIO_COUNT,
  decodeScenario,
  defaultScenario,
  describeScenario,
  drawScenario,
  encodeScenario,
  isValidScenario,
  namedMaze,
  openField,
  perfectMazeWalls,
  randomScenario,
  scenarioOfCode,
  scenarioProblems,
  shortestWay,
  stepsFrom,
  stepsToRoom,
  toggleWall,
  wallBetweenCells,
  wallCount,
  wallsFromDrawing,
  withFire,
  withWall,
  type FireChiefScenario,
} from './scenario';

const CODE = /^[LB][CBS]-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** The index of the wall place between two cells given by name-like pairs. */
const between = (a: [number, number], b: [number, number]): number =>
  wallIndexBetween({ col: a[0], row: a[1] }, { col: b[0], row: b[1] });

/** An open field with walls at the given places. */
function fieldWith(...indices: number[]): FireChiefScenario {
  let s = openField('living', 'corner');
  for (const index of indices) s = withWall(s, index, true);
  return s;
}

// =============================================================================================
// Which mazes can be played
// =============================================================================================

test('valid: the open field can be played; every cell is reached in its "city block" distance', () => {
  const open = openField();
  assert.equal(wallCount(open), 0);
  assert.equal(open.walls.length, 40);
  assert.deepEqual(scenarioProblems(open), []);
  assert.equal(isValidScenario(open), true);
  const steps = stepsFrom(open.walls, START_CELL);
  for (let n = 0; n < 25; n++) {
    const cell = cellFromNumber(n);
    assert.equal(steps[n], Math.abs(cell.col - START_CELL.col) + Math.abs(cell.row - START_CELL.row));
  }
  assert.equal(stepsToRoom(open, 'living'), 6);
  assert.equal(stepsToRoom(open, 'bedroom'), 6);
});

test('valid: a maze needs a way from START to the living room AND to the bedroom', () => {
  // close the living room off: walls on its right and below it
  const noLiving = fieldWith(between([0, 0], [1, 0]), between([0, 0], [0, 1]));
  assert.equal(isValidScenario(noLiving), false);
  assert.deepEqual(scenarioProblems(noLiving), ['There is no way from START to the living room: take a wall away.']);
  assert.equal(stepsToRoom(noLiving, 'living'), -1);
  assert.equal(stepsToRoom(noLiving, 'bedroom'), 6);
  // one of the two walls alone leaves a door
  assert.equal(isValidScenario(fieldWith(between([0, 0], [1, 0]))), true);
  assert.equal(isValidScenario(fieldWith(between([0, 0], [0, 1]))), true);

  const noBedroom = fieldWith(between([3, 0], [4, 0]), between([4, 0], [4, 1]));
  assert.deepEqual(scenarioProblems(noBedroom), ['There is no way from START to the bedroom: take a wall away.']);

  // START walled in: neither room can be reached - two problems
  const shutIn = fieldWith(between([1, 4], [2, 4]), between([2, 4], [3, 4]), between([2, 3], [2, 4]));
  assert.equal(scenarioProblems(shutIn).length, 2);
  // it does not matter in which room the fire is: both rooms must be reachable
  assert.equal(isValidScenario(withFire(noLiving, 'bedroom', 'back')), false);
});

test('valid: other cells may be closed off - only START and the two rooms count', () => {
  // the cell in the middle of the field behind four walls
  const island = fieldWith(between([1, 2], [2, 2]), between([2, 2], [3, 2]), between([2, 1], [2, 2]), between([2, 2], [2, 3]));
  assert.equal(isValidScenario(island), true);
  assert.equal(stepsFrom(island.walls, START_CELL)[cellNumber({ col: 2, row: 2 })], -1);
  assert.equal(stepsToRoom(island, 'living'), 6);
});

test('valid: a combination with a wrong list of walls, room or spot says what is wrong', () => {
  const short = { walls: new Array(39).fill(false), fireRoom: 'living', fireSpot: 'corner' } as FireChiefScenario;
  assert.deepEqual(scenarioProblems(short), ['A maze needs exactly 40 wall places (wall or no wall).']);
  const numbers = { walls: new Array(40).fill(0), fireRoom: 'living', fireSpot: 'corner' } as unknown as FireChiefScenario;
  assert.equal(isValidScenario(numbers), false);
  const kitchen = { ...openField(), fireRoom: 'kitchen' } as unknown as FireChiefScenario;
  assert.deepEqual(scenarioProblems(kitchen), ['The fire must be in the living room or in the bedroom.']);
  const middle = { ...openField(), fireSpot: 'middle' } as unknown as FireChiefScenario;
  assert.deepEqual(scenarioProblems(middle), ['The fire must stand at one of the three spots: corner, back or side.']);
  assert.equal(isValidScenario(null as unknown as FireChiefScenario), false);
  assert.match(describeScenario(short), /cannot be played/);
});

test('ways: the shortest way is a chain of neighbouring cells with no wall between them', () => {
  for (const { scenario, id } of NAMED_MAZES) {
    for (const goal of [LIVING_ROOM_CELL, BEDROOM_CELL]) {
      const way = shortestWay(scenario.walls, START_CELL, goal);
      assert.ok(way, `${id}: there is a way`);
      assert.deepEqual(way[0], START_CELL);
      assert.deepEqual(way[way.length - 1], goal);
      assert.equal(way.length - 1, stepsFrom(scenario.walls, START_CELL)[cellNumber(goal)]);
      for (let i = 1; i < way.length; i++) {
        assert.ok(wallIndexBetween(way[i - 1], way[i]) >= 0, 'neighbours');
        assert.equal(wallBetweenCells(scenario.walls, way[i - 1], way[i]), false, 'no wall between');
      }
    }
  }
  const noLiving = fieldWith(between([0, 0], [1, 0]), between([0, 0], [0, 1]));
  assert.equal(shortestWay(noLiving.walls, START_CELL, LIVING_ROOM_CELL), null);
  assert.deepEqual(shortestWay(openField().walls, START_CELL, START_CELL), [START_CELL]);
  // cells that are not neighbours count as "wall between"
  assert.equal(wallBetweenCells(openField().walls, { col: 0, row: 0 }, { col: 2, row: 0 }), true);
});

// =============================================================================================
// Hand-made mazes
// =============================================================================================

test('named mazes: five, from the open field to a perfect maze, every one playable', () => {
  assert.deepEqual(NAMED_MAZES.map((m) => m.id), ['open', 'two-doors', 'crossroads', 'detour', 'one-way']);
  assert.deepEqual(NAMED_MAZES.map((m) => m.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(NAMED_MAZES.map((m) => wallCount(m.scenario)), [0, 4, 10, 13, 16]);
  for (const m of NAMED_MAZES) {
    assert.deepEqual(scenarioProblems(m.scenario), [], m.id);
    assert.ok(m.name.length > 0 && m.about.length > 0);
    // START always opens upwards
    assert.equal(wallBetweenCells(m.scenario.walls, START_CELL, { col: 2, row: 3 }), false, m.id);
  }
  // rising difficulty: the way to the fire does not get shorter
  const steps = NAMED_MAZES.map((m) => stepsToRoom(m.scenario, m.scenario.fireRoom));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1], `steps ${steps.join(' ')}`);
  // they use both rooms and all three spots
  assert.deepEqual(new Set(NAMED_MAZES.map((m) => m.scenario.fireRoom)), new Set(ROOM_IDS));
  assert.deepEqual(new Set(NAMED_MAZES.map((m) => m.scenario.fireSpot)), new Set(FIRE_SPOTS));
});

test('named mazes: the default is "Crossroads" - medium, fire in the corner of the living room', () => {
  const s = defaultScenario();
  assert.deepEqual(s, namedMaze('crossroads'));
  assert.equal(s.fireRoom, 'living');
  assert.equal(s.fireSpot, 'corner');
  assert.equal(wallCount(s), 10);
  assert.equal(encodeScenario(s), 'LC-4406-N0E0');
  assert.deepEqual(drawScenario(s), [
    '+---+---+---+---+---+',
    '| *         |     B |',
    '+---+   +---+   +---+',
    '|               |   |',
    '+   +   +   +   +   +',
    '|                   |',
    '+   +---+---+---+   +',
    '|                   |',
    '+   +   +   +   +   +',
    '|       | S |       |',
    '+---+---+---+---+---+',
  ]);
  // every call hands out a fresh copy: changing one does not change the next
  s.walls[0] = true;
  s.fireRoom = 'bedroom';
  assert.equal(defaultScenario().walls[0], false);
  assert.equal(defaultScenario().fireRoom, 'living');
  assert.equal(namedMaze('nothing'), null);
});

test('named mazes: the open field has no wall; "One way only" is a perfect maze', () => {
  assert.equal(wallCount(openField()), 0);
  assert.deepEqual(openField('bedroom', 'side'), { walls: new Array(40).fill(false), fireRoom: 'bedroom', fireSpot: 'side' });
  const perfect = namedMaze('one-way');
  assert.ok(perfect);
  assert.equal(wallCount(perfect), PERFECT_MAZE_WALLS);
  assert.equal(PERFECT_MAZE_WALLS, 16);
  // every cell can be reached, and 24 openings for 25 cells means: in exactly one way
  assert.ok(stepsFrom(perfect.walls, START_CELL).every((s) => s >= 0));
});

test('drawings: a maze can be drawn and read back', () => {
  for (const m of NAMED_MAZES) {
    assert.deepEqual(wallsFromDrawing(drawScenario(m.scenario)), m.scenario.walls, m.id);
  }
  for (let seed = 0; seed < 200; seed++) {
    const s = randomScenario(makeRng(seed));
    const drawing = drawScenario(s);
    assert.equal(drawing.length, 11);
    for (const line of drawing) assert.equal(line.length, 21);
    assert.deepEqual(wallsFromDrawing(drawing), s.walls);
    // exactly one fire mark, in the room of the fire
    assert.equal(drawing.join('').split('*').length - 1, 1);
    assert.equal(drawing[1][s.fireRoom === 'living' ? 2 : 18], '*');
    assert.equal(drawing[9][10], 'S');
  }
  // a wall drawn between two named cells is the wall between those cells
  const drawing = drawScenario(openField());
  drawing[1] = '| * |             B |';
  drawing[2] = '+   +---+   +   +   +';
  const walls = wallsFromDrawing(drawing);
  assert.deepEqual(
    WALL_POSITIONS.filter((p) => walls[p.index]).map((p) => p.label),
    ['A1-B1', 'B1-B2'],
  );
  assert.throws(() => wallsFromDrawing(['+---+']), /11 lines/);
});

// =============================================================================================
// Random mazes
// =============================================================================================

test('random: 10 000 seeds - always playable, the same seed gives the same maze, a good spread of walls', () => {
  const byWalls = new Map<number, number>();
  const byFire = new Map<string, number>();
  const bySteps = new Map<number, number>();
  const codes = new Set<string>();
  for (let seed = 0; seed < 10000; seed++) {
    const s = randomScenario(makeRng(seed));
    assert.deepEqual(scenarioProblems(s), [], `seed ${seed}`);
    assert.equal(s.walls.length, 40);
    const count = wallCount(s);
    assert.ok(count >= RANDOM_MIN_WALLS && count <= PERFECT_MAZE_WALLS, `seed ${seed}: ${count} walls`);
    byWalls.set(count, (byWalls.get(count) ?? 0) + 1);
    byFire.set(`${s.fireRoom} ${s.fireSpot}`, (byFire.get(`${s.fireRoom} ${s.fireSpot}`) ?? 0) + 1);
    const steps = stepsToRoom(s, s.fireRoom);
    bySteps.set(steps, (bySteps.get(steps) ?? 0) + 1);
    codes.add(encodeScenario(s));
    // a maze made from a perfect maze by taking walls away: every cell can still be reached
    assert.ok(stepsFrom(s.walls, START_CELL).every((n) => n >= 0), `seed ${seed}`);
    if (seed % 100 === 0) assert.deepEqual(randomScenario(makeRng(seed)), s, 'same seed, same maze');
  }
  // every number of walls from 4 to 16 turns up about equally often (10 000 / 13 = 769 each)
  assert.deepEqual([...byWalls.keys()].sort((a, b) => a - b), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  for (const [count, times] of byWalls) assert.ok(times > 650 && times < 900, `${count} walls: ${times} times`);
  // the fire is at each of its six places about equally often (1667 each)
  assert.equal(byFire.size, 6);
  for (const [place, times] of byFire) assert.ok(times > 1500 && times < 1850, `${place}: ${times} times`);
  // mixed difficulty: short ways and long ways
  assert.ok((bySteps.get(6) ?? 0) > 5000, 'many mazes with the shortest possible way (6 cells)');
  const long = [...bySteps].filter(([steps]) => steps >= 10).reduce((sum, [, times]) => sum + times, 0);
  assert.ok(long > 800, `${long} mazes with a way of 10 cells or more`);
  // and hardly ever the same maze twice
  assert.ok(codes.size > 9900, `${codes.size} different mazes`);
});

test('random: a perfect maze has 16 walls and exactly one way between any two cells', () => {
  for (let seed = 0; seed < 300; seed++) {
    const walls = perfectMazeWalls(makeRng(seed));
    assert.equal(walls.filter(Boolean).length, 16);
    // all 25 cells reached with 24 openings: a tree
    assert.ok(stepsFrom(walls, START_CELL).every((n) => n >= 0), `seed ${seed}`);
    // taking any one wall away makes a loop; putting any one wall more up cuts the maze in two
    const closed = [...walls];
    closed[walls.indexOf(false)] = true;
    assert.ok(stepsFrom(closed, START_CELL).some((n) => n < 0), `seed ${seed}: one more wall cuts it`);
  }
});

test('random: it copes with any random function - all zeros, all (nearly) ones, even exactly 1', () => {
  for (const rng of [() => 0, () => 0.999999999, () => 1, () => 0.5]) {
    const s = randomScenario(rng);
    assert.deepEqual(scenarioProblems(s), []);
    assert.equal(s.walls.length, 40);
    assert.ok(wallCount(s) >= RANDOM_MIN_WALLS && wallCount(s) <= PERFECT_MAZE_WALLS);
  }
  assert.equal(wallCount(randomScenario(() => 0)), RANDOM_MIN_WALLS);
  assert.equal(wallCount(randomScenario(() => 0.999999999)), PERFECT_MAZE_WALLS);
});

test('count: about one in ten of all wall arrangements can be played', () => {
  assert.equal(SCENARIO_COUNT, PLAYABLE_MAZE_COUNT * 6);
  assert.ok(Number.isSafeInteger(SCENARIO_COUNT));
  const share = PLAYABLE_MAZE_COUNT / 2 ** 40;
  assert.ok(share > 0.1018 && share < 0.1019, `share ${share}`);
  // check the counted number against a sample: 200 000 arrangements with each wall there or not
  const rng = makeRng(40);
  const sample = 200000;
  let playable = 0;
  const s = openField();
  for (let i = 0; i < sample; i++) {
    for (let w = 0; w < 40; w++) s.walls[w] = rng() < 0.5;
    const steps = stepsFrom(s.walls, START_CELL);
    if (steps[cellNumber(LIVING_ROOM_CELL)] >= 0 && steps[cellNumber(BEDROOM_CELL)] >= 0) playable++;
  }
  // (one standard deviation of this sample is 0.0007)
  assert.ok(Math.abs(playable / sample - share) < 0.004, `sample ${playable / sample}, counted ${share}`);
});

// =============================================================================================
// The short code
// =============================================================================================

test('code: 10 000 random mazes and the named ones survive encode -> decode', () => {
  for (const m of NAMED_MAZES) {
    const code = encodeScenario(m.scenario);
    assert.match(code, CODE, m.id);
    assert.deepEqual(decodeScenario(code), m.scenario, m.id);
  }
  const codes = new Set<string>();
  for (let seed = 0; seed < 10000; seed++) {
    const s = randomScenario(makeRng(seed + 50000));
    const code = encodeScenario(s);
    assert.match(code, CODE);
    assert.deepEqual(decodeScenario(code), s, code);
    assert.equal(encodeScenario(decodeScenario(code) as FireChiefScenario), code);
    codes.add(code);
  }
  assert.ok(codes.size > 9900);
  assert.equal(encodeScenario(openField('living', 'back')), 'LB-0000-0000');
  assert.equal(encodeScenario(openField('bedroom', 'side')), 'BS-0000-0000');
});

test('code: every wall place and every fire place has its own spot in the code', () => {
  const seen = new Set<string>();
  for (let index = 0; index < 40; index++) {
    const s = withWall(openField('living', 'corner'), index, true);
    const code = encodeScenario(s);
    assert.match(code, CODE);
    seen.add(code);
    const back = decodeScenario(code);
    assert.ok(back, `wall ${index} alone is playable`);
    assert.deepEqual(back.walls.map((w, i) => (w ? i : -1)).filter((i) => i >= 0), [index]);
  }
  assert.equal(seen.size, 40);
  // the first wall place is the "16" of the first character, the last one the "1" of the last
  assert.equal(encodeScenario(withWall(openField('living', 'corner'), 0, true)), 'LC-G000-0000');
  assert.equal(encodeScenario(withWall(openField('living', 'corner'), 39, true)), 'LC-0000-0001');
  // first half: walls between cells side by side; second half: walls between cells above each other
  assert.equal(encodeScenario(withWall(openField('living', 'corner'), 20, true)), 'LC-0000-G000');
  const places = new Set<string>();
  for (const room of ROOM_IDS) {
    for (const spot of FIRE_SPOTS) {
      const code = encodeScenario(openField(room, spot));
      places.add(code.slice(0, 2));
      assert.deepEqual(decodeScenario(code), openField(room, spot));
    }
  }
  assert.deepEqual([...places].sort(), ['BB', 'BC', 'BS', 'LB', 'LC', 'LS']);
});

test('code: typed in any letter case, with or without separators, with look-alike letters', () => {
  const s = defaultScenario();
  for (const typed of [
    'LC-4406-N0E0',
    'lc-4406-n0e0',
    'LC4406N0E0',
    '  lc 4406 n0e0  ',
    'LC_4406_N0E0',
    'L C - 4 4 0 6 - N 0 E 0',
    '(LC-4406-N0E0)',
    'LC-44O6-NOEO', // the letter O typed for the digit 0
    'lc-44o6-noeo',
  ]) {
    assert.deepEqual(decodeScenario(typed), s, typed);
  }
  // I and L typed for the digit 1
  const one = withWall(openField('bedroom', 'side'), 4, true);
  assert.equal(encodeScenario(one), 'BS-1000-0000');
  assert.deepEqual(decodeScenario('BS-I000-0000'), one);
  assert.deepEqual(decodeScenario('bs-l000-0000'), one);
});

test('code: anything that is not a code gives null and never an error', () => {
  for (const garbage of [
    '',
    ' ',
    'hello',
    'LC',
    'LC-4406',
    'LC-4406-N0E', // one character short
    'LC-4406-N0E00', // one character too many
    'XC-4406-N0E0', // no such room
    'LX-4406-N0E0', // no such spot
    'LC-44U6-N0E0', // U is not used in codes
    'LC-4406-N0E0-LC-4406-N0E0',
    'code LC-4406-N0E0', // other words around it
    'RGBY-A1R-B2B-C1Y-D2G', // a Fire Rescue code
    '1234',
    '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥',
    'LC-ＦＦＦＦ-ＦＦＦＦ', // full-width letters
    '<script>alert(1)</script>',
    '\0\0\0\0\0\0\0\0\0\0',
    'L'.repeat(100000),
  ]) {
    assert.equal(decodeScenario(garbage), null, JSON.stringify(garbage.slice(0, 40)));
  }
  // not even a text
  for (const wrong of [null, undefined, 42, {}, [], true]) {
    assert.equal(decodeScenario(wrong as unknown as string), null);
  }
});

test('code: the code of a maze that cannot be played is refused', () => {
  const noLiving = fieldWith(between([0, 0], [1, 0]), between([0, 0], [0, 1]));
  const code = encodeScenario(noLiving);
  assert.match(code, CODE);
  assert.equal(decodeScenario(code), null);
  // all 40 walls up
  assert.equal(decodeScenario('LC-ZZZZ-ZZZZ'), null);
  assert.equal(decodeScenario('BS-ZZZZ-ZZZZ'), null);
});

test('code: an editor can read what a code says also when its maze cannot be played; a text that is no code is null for it too', () => {
  // a maze in which the living room is closed, and all 40 walls up: decodeScenario refuses both ...
  const noLiving = fieldWith(between([0, 0], [1, 0]), between([0, 0], [0, 1]));
  for (const maze of [noLiving, withFire(noLiving, 'bedroom', 'side'), { ...openField('living', 'back'), walls: new Array<boolean>(40).fill(true) }]) {
    const code = encodeScenario(maze);
    assert.equal(decodeScenario(code), null);
    // ... scenarioOfCode hands the maze back as it was written
    assert.deepEqual(scenarioOfCode(code), maze);
    assert.deepEqual(scenarioOfCode(code.toLowerCase().replace(/-/g, ' ')), maze);
    assert.ok(scenarioProblems(scenarioOfCode(code) as FireChiefScenario).length > 0);
  }
  // for a maze that can be played the two agree, and decodeScenario is "scenarioOfCode, if it can be played"
  const rng = makeRng(5);
  for (let i = 0; i < 2000; i++) {
    const code = encodeScenario(randomScenario(rng));
    assert.deepEqual(scenarioOfCode(code), decodeScenario(code));
  }
  let unplayable = 0;
  for (let i = 0; i < 2000; i++) {
    // any 40 walls: most of these mazes cannot be played
    const maze: FireChiefScenario = { walls: Array.from({ length: 40 }, () => rng() < 0.5), fireRoom: 'living', fireSpot: 'corner' };
    const read = scenarioOfCode(encodeScenario(maze));
    assert.deepEqual(read, maze);
    const played = decodeScenario(encodeScenario(maze));
    if (isValidScenario(maze)) assert.deepEqual(played, maze);
    else {
      unplayable++;
      assert.equal(played, null);
    }
  }
  assert.ok(unplayable > 1000, `${unplayable} of 2000 could not be played`);
  // what is no code at all is null, whatever it is - never an error
  for (const text of ['', 'hello', 'LC-4406-N0E', 'XC-4406-N0E0', 'LX-4406-N0E0', 'LC-44U6-N0E0', 'LC-4406-N0E0-0', 'x'.repeat(500)]) {
    assert.equal(scenarioOfCode(text), null, text);
  }
  for (const wrong of [undefined, null, 42, {}, []]) assert.equal(scenarioOfCode(wrong as unknown as string), null);
});

test('code: 20 000 random texts never throw, and whatever is accepted is a playable maze that encodes back', () => {
  const rng = makeRng(99);
  const alphabet = 'LBCS0123456789ABCDEFGHJKMNPQRSTVWXYZIOU-- lbcs';
  let accepted = 0;
  for (let i = 0; i < 20000; i++) {
    let text = '';
    const length = 8 + Math.floor(rng() * 8);
    for (let k = 0; k < length; k++) text += alphabet[Math.floor(rng() * alphabet.length)];
    // half of the texts start like a code, so that many get past the first checks
    if (i % 2 === 0) text = `${'LB'[Math.floor(rng() * 2)]}${'CBS'[Math.floor(rng() * 3)]}${text.slice(0, 8)}`;
    const s = decodeScenario(text);
    if (s === null) continue;
    accepted++;
    assert.deepEqual(scenarioProblems(s), [], text);
    assert.deepEqual(decodeScenario(encodeScenario(s)), s);
  }
  assert.ok(accepted > 100, `${accepted} texts happened to be codes`);
});

// =============================================================================================
// Words, and changing a combination
// =============================================================================================

test('describe: says where the fire is, how many walls there are and how far it is', () => {
  assert.equal(
    describeScenario(defaultScenario()),
    'Fire in the living room (corner). 10 inner walls. Shortest way from START to the fire: 8 cells.',
  );
  assert.equal(
    describeScenario(openField('bedroom', 'side')),
    'Fire in the bedroom (side). No inner walls. Shortest way from START to the fire: 6 cells.',
  );
  assert.match(describeScenario(fieldWith(0)), /1 inner wall\./);
});

test('editing: walls and the fire are changed on a copy', () => {
  const s = defaultScenario();
  const before = JSON.stringify(s);
  const added = withWall(s, 5, true);
  const toggled = toggleWall(s, 0);
  const moved = withFire(s, 'bedroom', 'back');
  assert.equal(JSON.stringify(s), before, 'the original is untouched');
  assert.equal(added.walls[5], true);
  assert.equal(wallCount(added), wallCount(s) + 1);
  assert.equal(toggled.walls[0], !s.walls[0]);
  assert.deepEqual(toggleWall(toggled, 0), s);
  assert.deepEqual([moved.fireRoom, moved.fireSpot], ['bedroom', 'back']);
  assert.deepEqual(moved.walls, s.walls);
  assert.equal(withFire(s, 'bedroom').fireSpot, s.fireSpot, 'the spot stays when only the room is named');
  // a wall place that does not exist changes nothing
  assert.deepEqual(withWall(s, 40, true), s);
  assert.deepEqual(withWall(s, -1, true), s);
  assert.deepEqual(withWall(s, 1.5, true), s);
  // every cell pair of the editor maps to a wall place
  const cells: Cell[] = [];
  for (let n = 0; n < 25; n++) cells.push(cellFromNumber(n));
  for (const cell of cells) for (const next of neighbours(cell)) assert.ok(wallIndexBetween(cell, next) >= 0);
});
