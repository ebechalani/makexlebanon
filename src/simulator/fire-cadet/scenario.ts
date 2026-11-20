/**
 * Fire Cadet - Rescue City: a "map" - one combination of the field (on the screen it is called a
 * map: "Map 3", "My own map"; children know what a map is).
 *
 * A map says where the Fire is (School, Factory, House or Bakery: ORGANISER 4), where the four
 * rescue items start (the Water, the Cat, the Injured Person, the Emergency Equipment) and where
 * the three obstacles stand (Road Closed, Fallen Tree, Broken Vehicle: rules l.88-98). The robot
 * always starts in the Fire Station at the bottom, D7, looking up the map (ASSUMPTION A12); the
 * way it is played (Mini or Junior) is a setting of the screen, not part of the map (N19).
 *
 * There is no official list of combinations yet (ORGANISER 2). So there are:
 *   - eight PRACTICE maps of this simulator, P1 (easiest) to P8 (hardest)            PRACTICE_MAPS
 *   - "My own map": any map that keeps the rules of design 5.4 (N12), so a teacher can copy an
 *     official combination when there is one                    scenarioProblems(), placeProblem()
 *
 * The short code (design 5.2): "P1" ... "P8" for a practice map; for an own setup the letter of
 * the Fire (S School, F Factory, H House, B Bakery) and then seven squares - the Water, the Cat,
 * the Injured Person, the Equipment, the Road Closed sign, the Fallen Tree, the Broken Vehicle:
 * "S-A6-D5-C5-C7-E3-F5-F7". Reading a code ignores capitals, blanks, hyphens, dots and commas.
 * Every map has exactly one code (a practice map always gets its "P" code).
 *
 * Plain TypeScript, no DOM: it runs under Node too.
 */
import { PLACES, PLACE_WORDS, START_SQUARE, WATER_SQUARES, isWaterSquare, onMap, placeAt, sameSquare, type PlaceName } from './field';
import { FIRE_CADET, type Square } from './numbers';

export type { Square } from './numbers';

/** The four places where the Fire can be (ORGANISER 4). */
export type FirePlace = 'school' | 'factory' | 'house' | 'bakery';
export const FIRE_PLACES: readonly FirePlace[] = ['school', 'factory', 'house', 'bakery'];

/** The four rescue items (rules l.9). */
export type ItemName = 'water' | 'cat' | 'person' | 'equipment';
export const ITEM_NAMES: readonly ItemName[] = ['water', 'cat', 'person', 'equipment'];

/** The three obstacles (rules l.88-98), in the order of the code and of FireCadetScenario.obstacles. */
export const OBSTACLE_KINDS = ['road-closed', 'fallen-tree', 'broken-vehicle'] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

/** Everything that can be placed on a map: the Fire, the four items, the three obstacles. */
export type MapThing = 'fire' | ItemName | ObstacleKind;
/** In the order of the code (and of the own-map editor's tray). */
export const MAP_THINGS: readonly MapThing[] = ['fire', ...ITEM_NAMES, ...OBSTACLE_KINDS];

export interface FireCadetScenario {
  readonly fire: FirePlace;
  /** one of WATER_SQUARES */
  readonly water: Square;
  readonly cat: Square;
  readonly person: Square;
  readonly equipment: Square;
  /** in the order of OBSTACLE_KINDS: the Road Closed sign, the Fallen Tree, the Broken Vehicle */
  readonly obstacles: readonly [Square, Square, Square];
}

/** The name of each item in a sentence, after "the" ("the Injured Person"). */
export const ITEM_WORDS: Readonly<Record<ItemName, string>> = {
  water: 'Water',
  cat: 'Cat',
  person: 'Injured Person',
  equipment: 'Equipment',
};

/** The name of each obstacle in a sentence ("Touched: the Fallen Tree."). */
export const OBSTACLE_WORDS: Readonly<Record<ObstacleKind, string>> = {
  'road-closed': 'the Road Closed sign',
  'fallen-tree': 'the Fallen Tree',
  'broken-vehicle': 'the Broken Vehicle',
};

/** The letter of each Fire place in a code. */
const FIRE_LETTER: Readonly<Record<FirePlace, string>> = { school: 'S', factory: 'F', house: 'H', bakery: 'B' };

// =============================================================================================
// Squares and targets
// =============================================================================================

const COLUMN_LETTERS = 'ABCDEFG';

/** "A1" for (0,0), "D7" for (3,6). */
export function squareName(sq: Square): string {
  return `${COLUMN_LETTERS[sq.col]}${sq.row + 1}`;
}

/** The square of "A1" ... "G7" (capitals or not), or null. */
export function parseSquare(text: string): Square | null {
  const m = /^([A-Ga-g])([1-7])$/.exec(text.trim());
  if (!m) return null;
  return { col: COLUMN_LETTERS.indexOf(m[1].toUpperCase()), row: Number(m[2]) - 1 };
}

/** Where an item must go: the Water to the Fire, the Cat to the Safe Zone, the Injured Person to the Hospital, the Equipment back to the Fire Station at the bottom. */
export function targetPlace(s: Pick<FireCadetScenario, 'fire'>, item: ItemName): PlaceName {
  switch (item) {
    case 'water':
      return s.fire;
    case 'cat':
      return 'safeZone';
    case 'person':
      return 'hospital';
    case 'equipment':
      return 'station';
  }
}

export const targetSquare = (s: Pick<FireCadetScenario, 'fire'>, item: ItemName): Square => PLACES[targetPlace(s, item)];

/** Where a thing stands on this map (the Fire: the square of its place). */
export function squareOf(s: FireCadetScenario, thing: MapThing): Square {
  if (thing === 'fire') return PLACES[s.fire];
  const k = (OBSTACLE_KINDS as readonly string[]).indexOf(thing);
  if (k >= 0) return s.obstacles[k];
  return s[thing as ItemName];
}

/** The things standing on this square (the Fire is a flat sign: it stands on nothing). */
export function thingsOn(s: FireCadetScenario, sq: Square): MapThing[] {
  return MAP_THINGS.filter((thing) => thing !== 'fire' && sameSquare(squareOf(s, thing), sq));
}

/** A copy of the map with one thing moved (for the own-map editor). The Fire goes to a place: give its square. */
export function withThing(s: FireCadetScenario, thing: MapThing, sq: Square): FireCadetScenario {
  const at = { col: sq.col, row: sq.row };
  if (thing === 'fire') {
    const place = placeAt(at);
    return place !== null && (FIRE_PLACES as readonly string[]).includes(place) ? { ...s, fire: place as FirePlace } : s;
  }
  const k = (OBSTACLE_KINDS as readonly string[]).indexOf(thing);
  if (k >= 0) {
    const obstacles = [...s.obstacles] as [Square, Square, Square];
    obstacles[k] = at;
    return { ...s, obstacles };
  }
  return { ...s, [thing]: at };
}

// =============================================================================================
// The rules of an own setup (design 5.4, ASSUMPTION N12)
// =============================================================================================

/**
 * Why a thing may not stand on a square:
 *   'fire-place'       the Fire is only at the School, the Factory, the House or the Bakery
 *   'water-square'     the Water starts on A6, B6, A7 or B7
 *   'start-square'     nothing stands on D7: the robot starts there
 *   'own-target'       an item does not start on its own target (the Cat not on D4, the Injured
 *                      Person not on A5)
 *   'obstacle-marked'  an obstacle stands on a road, not on a square with a dashed frame
 *   'taken'            one thing per square
 * The own-map editor says each in its own words; reading a code says them with the square named.
 */
export type PlaceProblem = 'fire-place' | 'water-square' | 'start-square' | 'own-target' | 'obstacle-marked' | 'taken';

/**
 * May `thing` go to `sq` on this map (the other things staying where they are)? Null when it may,
 * otherwise the first rule it breaks. The editor keeps these rules at every tap, so a map on the
 * stage can always be played:
 *   1. the Fire: one of its four places;
 *   2. the Water: one of its four squares;
 *   3. the Cat, the Injured Person, the Equipment: any square that holds nothing else, except D7
 *      and the item's own target. A marked place is allowed, the place with the Fire too: the rules
 *      put the Cat and the Injured Person "at a rescue location" and the Equipment "at a location on
 *      the map" (l.64, l.70, l.76);
 *   4. the obstacles: any square without a dashed frame that holds nothing else ("on the roads",
 *      l.90);
 *   5. always all four items and all three obstacles, one of each kind.
 */
export function placeProblem(s: FireCadetScenario, thing: MapThing, sq: Square): PlaceProblem | null {
  if (thing === 'fire') {
    const place = placeAt(sq);
    return place !== null && (FIRE_PLACES as readonly string[]).includes(place) ? null : 'fire-place';
  }
  if (thing === 'water' && !isWaterSquare(sq)) return 'water-square';
  if (sameSquare(sq, START_SQUARE)) return 'start-square';
  if (thing !== 'water' && (ITEM_NAMES as readonly string[]).includes(thing) && sameSquare(sq, targetSquare(s, thing as ItemName))) {
    return 'own-target';
  }
  if ((OBSTACLE_KINDS as readonly string[]).includes(thing) && placeAt(sq) !== null) return 'obstacle-marked';
  if (thingsOn(s, sq).some((other) => other !== thing)) return 'taken';
  return null;
}

const isFirePlace = (v: unknown): v is FirePlace => typeof v === 'string' && (FIRE_PLACES as readonly string[]).includes(v);

/** "A6, B6, A7 or B7" */
const listWithOr = (words: readonly string[]): string =>
  words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;

/** The sentences of design 5.2: what is wrong with a map, in the order of that table. */
const PROBLEM_WORDS = {
  notACode: (): string => `This is not a map code. A code looks like P3 or like ${hyphenated(PRACTICE_MAPS[0])}.`,
  noSuchPracticeMap: (): string => `There are ${PRACTICE_MAPS.length} practice maps: P1 to P${PRACTICE_MAPS.length}.`,
  fire: (): string => `The Fire can be at ${listWithOr(FIRE_PLACES.map((p) => PLACE_WORDS[p]))}.`,
  square: (): string => 'A square is a letter A to G and a number 1 to 7.',
  water: (): string => `The Water starts on ${listWithOr(WATER_SQUARES.map(squareName))}.`,
  start: (): string => `Nothing can stand on ${squareName(START_SQUARE)}: the robot starts there.`,
  ownTarget: (s: FireCadetScenario, item: ItemName): string => {
    const place = targetPlace(s, item);
    return `The ${ITEM_WORDS[item]} cannot start on ${squareName(PLACES[place])}: that is ${PLACE_WORDS[place]}, where it must go.`;
  },
  obstacleMarked: (sq: Square): string => {
    const place = placeAt(sq) as PlaceName;
    return `An obstacle cannot stand on ${squareName(sq)}: that is ${PLACE_WORDS[place]}. Obstacles stand on roads.`;
  },
  twoThings: (sq: Square): string => `Two things are on ${squareName(sq)}. One square takes one thing.`,
};

/**
 * What is wrong with a map, one plain sentence per problem; empty when it can be played. The
 * sentences are those of design 5.2, in the order of its table.
 */
export function scenarioProblems(s: FireCadetScenario): string[] {
  if (!s || typeof s !== 'object') return [PROBLEM_WORDS.notACode()];
  const out: string[] = [];
  if (!isFirePlace(s.fire)) out.push(PROBLEM_WORDS.fire());
  const squares: Square[] = [s.water, s.cat, s.person, s.equipment, ...(Array.isArray(s.obstacles) ? s.obstacles : [])];
  if (squares.length !== 7 || !squares.every(onMap)) {
    out.push(PROBLEM_WORDS.square());
    return out;
  }
  if (!isWaterSquare(s.water)) out.push(PROBLEM_WORDS.water());
  if (squares.some((sq) => sameSquare(sq, START_SQUARE))) out.push(PROBLEM_WORDS.start());
  if (isFirePlace(s.fire)) {
    for (const item of ITEM_NAMES) {
      if (item === 'water' || item === 'equipment') continue; // (the Water has its own squares; the Equipment's target is D7)
      if (sameSquare(s[item], targetSquare(s, item))) out.push(PROBLEM_WORDS.ownTarget(s, item));
    }
  }
  for (const sq of s.obstacles) {
    if (!sameSquare(sq, START_SQUARE) && placeAt(sq) !== null) out.push(PROBLEM_WORDS.obstacleMarked(sq));
  }
  const seen = new Set<string>();
  for (const sq of squares) {
    const name = squareName(sq);
    if (seen.has(name) && !out.includes(PROBLEM_WORDS.twoThings(sq))) out.push(PROBLEM_WORDS.twoThings(sq));
    seen.add(name);
  }
  return out;
}

export const isValidScenario = (s: FireCadetScenario): boolean => scenarioProblems(s).length === 0;

// =============================================================================================
// The eight practice maps (design 5.3)
// =============================================================================================

const at = (name: string): Square => parseSquare(name) as Square;
const practice = (fire: FirePlace, water: string, cat: string, person: string, equipment: string, obstacles: [string, string, string]): FireCadetScenario =>
  Object.freeze({
    fire,
    water: Object.freeze(at(water)),
    cat: Object.freeze(at(cat)),
    person: Object.freeze(at(person)),
    equipment: Object.freeze(at(equipment)),
    obstacles: Object.freeze(obstacles.map((o) => Object.freeze(at(o)))) as unknown as readonly [Square, Square, Square],
  });

/**
 * The eight practice maps of this simulator, from easy to hard by the shortest row that scores all
 * 25 points (design 5.3; proved in the engine by practice.test.ts, whose rows only it holds). They
 * are practice maps, not official ones: the organiser has no list yet (ORGANISER 2).
 *
 * How they were made: the items on squares that suit the drawing (a playground, a park, a road, a
 * yard: map report 3.3); every obstacle on one of the ROAD_SQUARES (field.ts); every Fire place
 * twice; every Water square twice; the Equipment of map 6 in the Water / Equipment Area (its name
 * says the Equipment may start there: question 9 to the organiser).
 *
 *      Fire     Water  Cat  Injured Person  Equipment   Road Closed, Fallen Tree, Broken Vehicle
 *   P1 School   A6     D5   C5              C7          E3, F5, F7   (all in straight lines)
 *   P2 Bakery   B6     E5   B4              F7          C2, D3, E2   (one turn with an item)
 *   P3 House    B7     C5   E3              D6          C2, E2, B4   (the Equipment right above the start)
 *   P4 School   B7     B3   C3              E6          B5, C4, E7   (the Hospital closed on its right)
 *   P5 Factory  A7     E6   C3              F2          D5, E3, B4   (the straight way up closed)
 *   P6 Bakery   A6     C6   F2              A7          G4, F5, B5   (the Bakery open from below only)
 *   P7 House    A7     F6   B2              B4          D5, C4, D3   (the Safe Zone open from the right only)
 *   P8 Factory  B6     G6   E3              F2          D5, D3, G4   (long ways, the middle is closed)
 */
export const PRACTICE_MAPS: readonly FireCadetScenario[] = Object.freeze([
  practice('school', 'A6', 'D5', 'C5', 'C7', ['E3', 'F5', 'F7']),
  practice('bakery', 'B6', 'E5', 'B4', 'F7', ['C2', 'D3', 'E2']),
  practice('house', 'B7', 'C5', 'E3', 'D6', ['C2', 'E2', 'B4']),
  practice('school', 'B7', 'B3', 'C3', 'E6', ['B5', 'C4', 'E7']),
  practice('factory', 'A7', 'E6', 'C3', 'F2', ['D5', 'E3', 'B4']),
  practice('bakery', 'A6', 'C6', 'F2', 'A7', ['G4', 'F5', 'B5']),
  practice('house', 'A7', 'F6', 'B2', 'B4', ['D5', 'C4', 'D3']),
  practice('factory', 'B6', 'G6', 'E3', 'F2', ['D5', 'D3', 'G4']),
]);

const sameScenario = (a: FireCadetScenario, b: FireCadetScenario): boolean =>
  a.fire === b.fire &&
  sameSquare(a.water, b.water) &&
  sameSquare(a.cat, b.cat) &&
  sameSquare(a.person, b.person) &&
  sameSquare(a.equipment, b.equipment) &&
  a.obstacles.every((o, k) => sameSquare(o, b.obstacles[k]));

/** 1 ... 8 when the map is one of the practice maps, else null. */
export function practiceMapNumber(s: FireCadetScenario): number | null {
  const k = PRACTICE_MAPS.findIndex((p) => sameScenario(p, s));
  return k >= 0 ? k + 1 : null;
}

/** Practice map 1, the easiest. */
export const defaultScenario = (): FireCadetScenario => PRACTICE_MAPS[0];

/** "Surprise": one of the eight practice maps by chance (N15: an own setup by chance need not be playable). */
export function randomScenario(rng: () => number): FireCadetScenario {
  const k = Math.min(PRACTICE_MAPS.length - 1, Math.max(0, Math.floor(rng() * PRACTICE_MAPS.length)));
  return PRACTICE_MAPS[k];
}

// =============================================================================================
// How many maps there are (design 5.2)
// =============================================================================================

/**
 * How many own setups the rules of 5.4 allow (the eight practice maps are eight of them):
 * 4 Fires x 4 Water squares x (every way to put the Cat, the Injured Person and the Equipment on
 * different squares) x (every ordered way to put the three obstacles on the plain squares the
 * items left free). A "plain" square has no dashed frame: 41 of them, 40 once the Water has taken
 * one. An item may also stand on a marked place that is neither its own target nor D7.
 *
 * With `onMarkedPlaces` false the items may not stand on a marked place (the rule of the design's
 * first revision): a check of the formula, 16 x P(40, 3) x P(37, 3) = 44,218,137,600.
 */
export function countOwnSetups(onMarkedPlaces = true): number {
  const plainSquares = FIRE_CADET.GRID_COUNT * FIRE_CADET.GRID_COUNT - Object.keys(PLACES).length - 1;
  const ordered = (n: number, k: number): number => {
    let p = 1;
    for (let i = 0; i < k; i++) p *= n - i;
    return p;
  };
  // (the Water stays on its own squares; the targets of these three do not depend on the Fire)
  const movable: ItemName[] = ['cat', 'person', 'equipment'];
  const markedFor = (item: ItemName): PlaceName[] =>
    !onMarkedPlaces ? [] : (Object.keys(PLACES) as PlaceName[]).filter((p) => p !== 'station' && p !== targetPlace({ fire: 'school' }, item));
  let ways = 0;
  const place = (i: number, plainUsed: number, markedTaken: PlaceName[], waysSoFar: number): void => {
    if (i === movable.length) {
      ways += waysSoFar * ordered(plainSquares - plainUsed, OBSTACLE_KINDS.length);
      return;
    }
    place(i + 1, plainUsed + 1, markedTaken, waysSoFar * (plainSquares - plainUsed));
    for (const p of markedFor(movable[i])) if (!markedTaken.includes(p)) place(i + 1, plainUsed, [...markedTaken, p], waysSoFar);
  };
  place(0, 0, [], 1);
  return FIRE_PLACES.length * WATER_SQUARES.length * ways;
}

/** 71,983,941,120 maps (design 5.2). */
export const SCENARIO_COUNT = countOwnSetups();

// =============================================================================================
// The code
// =============================================================================================

/** The long code of any map, practice maps too, as the screen writes it: "S-A6-D5-C5-C7-E3-F5-F7". */
export function hyphenated(s: FireCadetScenario): string {
  return [FIRE_LETTER[s.fire], squareName(s.water), squareName(s.cat), squareName(s.person), squareName(s.equipment), ...s.obstacles.map(squareName)].join('-');
}

/** "P3" for a practice map, the long code ("S-A6-D5-C5-C7-E3-F5-F7") for any other map. */
export function encodeScenario(s: FireCadetScenario): string {
  const n = practiceMapNumber(s);
  return n !== null ? `P${n}` : hyphenated(s);
}

/** What reading a code gives: the map, or ONE sentence that says what is wrong. */
export type MapCodeReading = { ok: true; scenario: FireCadetScenario } | { ok: false; problem: string };

/**
 * Read a map code. It ignores capitals, blanks, hyphens, dots and commas ("sa6d5c5c7e3f5f7" is the
 * same code as "S-A6-D5-C5-C7-E3-F5-F7"). It never throws: a code that does not read gives the
 * first sentence of design 5.2 that applies.
 */
export function readMapCode(text: string): MapCodeReading {
  const clean = typeof text === 'string' ? text.replace(/[\s\-.,]/g, '').toUpperCase() : '';
  const p = /^P(\d+)$/.exec(clean);
  if (p) {
    const n = Number(p[1]);
    if (n >= 1 && n <= PRACTICE_MAPS.length && String(n) === p[1]) return { ok: true, scenario: PRACTICE_MAPS[n - 1] };
    return { ok: false, problem: PROBLEM_WORDS.noSuchPracticeMap() };
  }
  const own = /^([SFHB])((?:[A-G][1-7]){7})$/.exec(clean);
  if (!own) return { ok: false, problem: PROBLEM_WORDS.notACode() };
  const fire = (Object.keys(FIRE_LETTER) as FirePlace[]).find((f) => FIRE_LETTER[f] === own[1]) as FirePlace;
  const squares = (own[2].match(/[A-G][1-7]/g) as string[]).map(at);
  const scenario: FireCadetScenario = {
    fire,
    water: squares[0],
    cat: squares[1],
    person: squares[2],
    equipment: squares[3],
    obstacles: [squares[4], squares[5], squares[6]],
  };
  const problems = scenarioProblems(scenario);
  if (problems.length > 0) return { ok: false, problem: problems[0] };
  // a practice map read from its long code is that practice map
  const n = practiceMapNumber(scenario);
  return { ok: true, scenario: n !== null ? PRACTICE_MAPS[n - 1] : scenario };
}

/** The map of a code, or null when the code does not read (Game.decodeScenario). */
export function decodeScenario(code: string): FireCadetScenario | null {
  const reading = readMapCode(code);
  return reading.ok ? reading.scenario : null;
}

/**
 * "Practice map 3", or "Own map: Fire at the School, Water A6, Cat D5, Injured Person C5,
 * Equipment C7, obstacles E3, F5, F7".
 */
export function describeScenario(s: FireCadetScenario): string {
  const n = practiceMapNumber(s);
  if (n !== null) return `Practice map ${n}`;
  const items = ITEM_NAMES.map((item) => `${ITEM_WORDS[item]} ${squareName(s[item])}`).join(', ');
  return `Own map: Fire at ${PLACE_WORDS[s.fire]}, ${items}, obstacles ${s.obstacles.map(squareName).join(', ')}`;
}
