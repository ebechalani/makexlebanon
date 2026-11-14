/**
 * The lists of mazes that "Test on many mazes" offers in Fire Chief (../BatchDialog.tsx):
 *
 *   random mazes       10, 50 or 200 different random mazes; the fire stands at each of its six
 *                      places in turn, so even the short list has it in both rooms and at all
 *                      three spots
 *   the named mazes    the game's five hand-made mazes, each with the fire at its six places
 *   this maze          the maze on the stage with the fire at its six places
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { makeRng } from '../../core/geometry';
import { FIRE_SPOTS, ROOM_IDS, type FireSpot, type RoomId } from '../../fire-chief/field';
import { NAMED_MAZES, encodeScenario, randomScenario, scenarioProblems, withFire, type FireChiefScenario } from '../../fire-chief/scenario';
import type { BatchPreset } from '../BatchDialog';

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
 * `count` different random mazes that can be played - the same list every time for the same
 * seed. The fire does not stand where chance puts it: it goes round its six places, maze after
 * maze, so that a list of six or more has it in both rooms and at all three spots, and no place
 * more than once more often than another.
 */
export function randomMazes(count: number, seed: number): FireChiefScenario[] {
  const wanted = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rng = makeRng(seed);
  const seen = new Set<string>();
  const out: FireChiefScenario[] = [];
  // (there are billions of mazes: a repeated one is rare, and the limit is only a safety net)
  for (let tries = 0; out.length < wanted && tries < wanted * 50 + 100; tries++) {
    const maze = randomScenario(rng);
    const walls = wallsCode(maze);
    if (seen.has(walls)) continue;
    seen.add(walls);
    const place = FIRE_PLACES[out.length % FIRE_PLACES.length];
    out.push(withFire(maze, place.room, place.spot));
  }
  return out;
}

/** What the test window says under the random lists. */
export const RANDOM_MAZES_NOTE = 'In the random mazes the fire stands at each of its six places in turn: both rooms, each with corner, back wall and side wall.';

const NAMED_COUNT = NAMED_MAZES.length;
const PLACES = FIRE_PLACES.length;

export const MAZE_BATCH_PRESETS: BatchPreset<FireChiefScenario>[] = [
  {
    id: 'named-mazes',
    label: `The ${NAMED_COUNT} named mazes, fire at every place (${NAMED_COUNT * PLACES})`,
    hint: `${NAMED_MAZES.map((maze) => maze.name).join(', ')}: each one with the fire at its ${PLACES} places.`,
    scenarios: namedMazesEverywhere,
  },
  {
    id: 'this-maze',
    label: `This maze, fire at every place (${PLACES})`,
    hint: `The maze on the stage with the fire at each of its ${PLACES} places: both rooms, each with corner, back wall and side wall.`,
    scenarios: withEveryFirePlace,
    // a maze in which a room cannot be reached can be tested too (it can be played for practice): say what it is
    note: (current) => {
      const problems = scenarioProblems(current);
      return problems.length === 0 ? null : `The maze on the stage is a practice maze, not a competition maze. ${problems.join(' ')}`;
    },
  },
];
