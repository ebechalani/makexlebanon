/**
 * What the maze editor of Fire Chief offers ready-made (MazeEditor.tsx): the named mazes of the
 * game, the two random draws of the panel around it, and the words for the two rooms and the
 * three places of the fire.
 *
 * To add a named maze, draw it in ../../fire-chief/scenario.ts (NAMED_MAZES): it then has a
 * button here and is part of "Test on many mazes" (./maze-batch.ts) without another change.
 *
 * Every ready-made maze says what kind it is, on its button and in its sentence: a competition
 * maze (13 or 16 inner walls) or a practice maze (./maze-level.ts: mazeKind).
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { FireSpot, RoomId } from '../../fire-chief/field';
import {
  COMPETITION_WALL_COUNTS,
  NAMED_MAZES,
  PERFECT_MAZE_WALLS,
  defaultScenario,
  randomScenarioWithWalls,
  type FireChiefScenario,
} from '../../fire-chief/scenario';
import type { RandomDraw } from '../CombinationPanel';
import { capital } from '../screen-words';
import { KIND_WORD, mazeFacts, mazeKind, type MazeKind } from './maze-level';

export interface MazeChoice {
  /** id of the ready-made maze (scenario.ts: NAMED_MAZES) */
  id: string;
  /** the name on its button: "Detour (default maze)", "Open field" */
  label: string;
  /** what kind of maze it is ... */
  kind: MazeKind;
  /** ... as the small second line of its button says it: "competition maze", "practice maze" */
  kindLabel: string;
  /** one sentence about it, with its kind and its level: "Practice maze. Level 3 of 5. Ten walls. ..." */
  about: string;
  /** its walls (one entry per wall place) */
  walls: readonly boolean[];
}

const HARDEST_LEVEL = Math.max(...NAMED_MAZES.map((maze) => maze.level));

/** True when two mazes have the same walls. */
export function sameWalls(a: readonly boolean[], b: readonly boolean[]): boolean {
  return a.length === b.length && a.every((wall, i) => wall === b[i]);
}

/**
 * The ready-made mazes in the order of the panel: the default maze first, then the others from
 * easy to hard. The default maze and the open field are called what the examples call them
 * ("the default maze", "the open field").
 */
export const MAZE_CHOICES: MazeChoice[] = (() => {
  const defaultWalls = defaultScenario().walls;
  const choices = NAMED_MAZES.map((maze) => {
    const isDefault = sameWalls(maze.scenario.walls, defaultWalls);
    const kind = mazeKind(mazeFacts(maze.scenario));
    return {
      id: maze.id,
      label: isDefault ? `${maze.name} (default maze)` : maze.name,
      kind,
      kindLabel: KIND_WORD[kind],
      about: `${capital(KIND_WORD[kind])}. Level ${maze.level} of ${HARDEST_LEVEL}. ${maze.about}`,
      walls: maze.scenario.walls,
      isDefault,
    };
  });
  // (sort is stable: the others keep their order from easy to hard)
  choices.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return choices.map(({ id, label, kind, kindLabel, about, walls }) => ({ id, label, kind, kindLabel, about, walls }));
})();

/** The ready-made maze that is on the stage, or null for any other maze (built by hand, a random one, one from a code). */
export function mazeChoiceOf(scenario: Pick<FireChiefScenario, 'walls'>): MazeChoice | null {
  return MAZE_CHOICES.find((choice) => sameWalls(choice.walls, scenario.walls)) ?? null;
}

/** The scenario with the walls of a ready-made maze; the fire stays where the student put it. */
export function withMaze(scenario: FireChiefScenario, choice: MazeChoice): FireChiefScenario {
  return { walls: [...choice.walls], fireRoom: scenario.fireRoom, fireSpot: scenario.fireSpot };
}

/**
 * The random draws of the Maze panel: one button for each number of inner walls a competition
 * maze can have. The words "Random competition maze:" stand in front of them (./words.ts).
 * A press gives a new maze of that kind, with the fire at a random place.
 */
export const RANDOM_MAZE_DRAWS: RandomDraw<FireChiefScenario>[] = COMPETITION_WALL_COUNTS.map((walls) => ({
  id: `walls-${walls}`,
  label: `${walls} inner walls`,
  hint:
    `Draw a random ${KIND_WORD.competition} with ${walls} inner walls` +
    `${walls === PERFECT_MAZE_WALLS ? ' (corridors only, one way to each room)' : ''} and a random place for the fire`,
  draw: (rng: () => number) => randomScenarioWithWalls(rng, walls),
}));

export const ROOM_LABEL: Record<RoomId, string> = { living: 'Living room', bedroom: 'Bedroom' };

export const SPOT_LABEL: Record<FireSpot, { label: string; hint: string }> = {
  corner: { label: 'Corner', hint: 'In the outer corner of the room, turned towards the middle of the room' },
  back: { label: 'Back wall', hint: 'In the middle of the top wall of the room, facing down the mat' },
  side: { label: 'Side wall', hint: 'In the middle of the outer side wall of the room, facing across the room' },
};
