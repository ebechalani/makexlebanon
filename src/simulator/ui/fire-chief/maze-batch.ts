/**
 * The lists of mazes that "Test on many mazes" offers in Fire Chief (../BatchDialog.tsx):
 *
 *   random mazes       10, 50 or 200 different random COMPETITION mazes, with 13 or with 16
 *                      inner walls (one small choice beside the seed); the fire stands at each
 *                      of its six places in turn, so even the short list has it in both rooms
 *                      and at all three spots
 *   the named mazes    the game's five hand-made mazes, each with the fire at its six places
 *   this maze          the maze on the stage with the fire at its six places
 *
 * (Until the organiser decided how many walls a competition maze has, the random lists were
 * mixed: 4 to 16 walls. That mix is still what the game's randomScenario() draws, but the page
 * does not offer it any more: "random" on the page now always means a competition maze. Easier
 * mazes for practice are among the named ones, and any maze can be made easier by hand.)
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { makeRng } from '../../core/geometry';
import { FIRE_SPOTS, ROOM_IDS, type FireSpot, type RoomId } from '../../fire-chief/field';
import {
  COMPETITION_WALL_COUNTS,
  NAMED_MAZES,
  PERFECT_MAZE_WALLS,
  encodeScenario,
  randomScenarioWithWalls,
  scenarioProblems,
  withFire,
  type CompetitionWallCount,
  type FireChiefScenario,
} from '../../fire-chief/scenario';
import type { BatchPreset, BatchRandom, BatchRandomKind } from '../BatchDialog';
import { KIND_WORD, competitionMazeHas, mazeFacts, mazeKind } from './maze-level';

/** The six places of the fire: both rooms, each with its three spots. */
export const FIRE_PLACES: ReadonlyArray<{ room: RoomId; spot: FireSpot }> = ROOM_IDS.flatMap((room) => FIRE_SPOTS.map((spot) => ({ room, spot })));

/** One maze with the fire at each of its six places. */
export function withEveryFirePlace(s: FireChiefScenario): FireChiefScenario[] {
  return FIRE_PLACES.map((place) => withFire(s, place.room, place.spot));
}

/** The game's named mazes, from easy to hard, each with the fire at its six places. */
export function namedMazesEverywhere(): FireChiefScenario[] {
  return NAMED_MAZES.flatMap((maze) => withEveryFirePlace(maze.scenario));
}

/** The eight characters of a code that stand for the walls (two mazes with the same walls have the same). */
const wallsCode = (s: FireChiefScenario): string => encodeScenario(s).slice(3);

/**
 * `count` different random mazes with exactly `walls` inner walls - the same list every time
 * for the same seed and the same number of walls. Every one can be played (the game's
 * randomScenarioWithWalls). The fire does not stand where chance puts it: it goes round its six
 * places, maze after maze, so that a list of six or more has it in both rooms and at all three
 * spots, and no place more than once more often than another.
 */
export function randomMazes(count: number, seed: number, walls: number): FireChiefScenario[] {
  const wanted = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rng = makeRng(seed);
  const seen = new Set<string>();
  const out: FireChiefScenario[] = [];
  // (there are millions of mazes of each kind: a repeated one is rare, and the limit is only a safety net)
  for (let tries = 0; out.length < wanted && tries < wanted * 50 + 100; tries++) {
    const maze = randomScenarioWithWalls(rng, walls);
    const code = wallsCode(maze);
    if (seen.has(code)) continue;
    seen.add(code);
    const place = FIRE_PLACES[out.length % FIRE_PLACES.length];
    out.push(withFire(maze, place.room, place.spot));
  }
  return out;
}

/** What one kind of random list is called beside the seed: "13 inner walls", "16 inner walls (corridors only)". */
export function randomKindLabel(walls: CompetitionWallCount): string {
  return walls === PERFECT_MAZE_WALLS ? `${walls} inner walls (corridors only)` : `${walls} inner walls`;
}

/** The kinds of random lists: one for each number of inner walls a competition maze can have. */
export const RANDOM_MAZE_KINDS: BatchRandomKind<FireChiefScenario>[] = COMPETITION_WALL_COUNTS.map((walls) => ({
  id: `walls-${walls}`,
  label: randomKindLabel(walls),
  draw: (count: number, seed: number) => randomMazes(count, seed, walls),
}));

/** What the test window says under the random lists. */
export const RANDOM_MAZES_NOTE = 'In the random mazes the fire stands at each of its six places in turn: both rooms, each with corner, back wall and side wall.';

/** The random lists of "Test on many mazes": random competition mazes of one of the two kinds, the fire at each of its six places in turn. */
export const MAZE_BATCH_RANDOM: BatchRandom<FireChiefScenario> = {
  draw: RANDOM_MAZE_KINDS[0].draw,
  // "10 random competition mazes"
  name: `${KIND_WORD.competition}s`,
  kindsLegend: 'Competition mazes with',
  kinds: RANDOM_MAZE_KINDS,
  note: RANDOM_MAZES_NOTE,
};

/** "Detour and One way only": the names of a list, in a sentence. */
function inWords(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Which of the named mazes are competition mazes, as one sentence: "Detour and One way only are competition mazes, the others are practice mazes." */
export function namedKindsSentence(): string {
  const competition = NAMED_MAZES.filter((maze) => mazeKind(mazeFacts(maze.scenario)) === 'competition').map((maze) => maze.name);
  if (competition.length === 0) return `All of them are ${KIND_WORD.practice}s.`;
  if (competition.length === NAMED_MAZES.length) return `All of them are ${KIND_WORD.competition}s.`;
  return `${inWords(competition)} ${competition.length === 1 ? `is a ${KIND_WORD.competition}` : `are ${KIND_WORD.competition}s`}, the others are ${KIND_WORD.practice}s.`;
}

/**
 * What the window says about the maze on the stage while "This maze" is chosen: nothing for a
 * competition maze; for a practice maze that it is one, what a competition maze has that it has
 * not, and - when a room cannot be reached - what is wrong, in the game's own words.
 */
export function stageMazeNote(current: FireChiefScenario): string | null {
  const facts = mazeFacts(current);
  if (mazeKind(facts) === 'competition') return null;
  const problems = scenarioProblems(current);
  return [`The maze on the stage is a ${KIND_WORD.practice}, not a ${KIND_WORD.competition}: a ${KIND_WORD.competition} has ${competitionMazeHas(facts)}.`, ...problems].join(' ');
}

const NAMED_COUNT = NAMED_MAZES.length;
const PLACES = FIRE_PLACES.length;

export const MAZE_BATCH_PRESETS: BatchPreset<FireChiefScenario>[] = [
  {
    id: 'named-mazes',
    label: `The ${NAMED_COUNT} named mazes, fire at every place (${NAMED_COUNT * PLACES})`,
    hint: `${NAMED_MAZES.map((maze) => maze.name).join(', ')}: each one with the fire at its ${PLACES} places. ${namedKindsSentence()}`,
    scenarios: namedMazesEverywhere,
  },
  {
    id: 'this-maze',
    label: `This maze, fire at every place (${PLACES})`,
    hint: `The maze on the stage with the fire at each of its ${PLACES} places: both rooms, each with corner, back wall and side wall.`,
    scenarios: withEveryFirePlace,
    // a practice maze can be tested too - also one in which a room cannot be reached: say what it is
    note: stageMazeNote,
  },
];
