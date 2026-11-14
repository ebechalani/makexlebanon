/**
 * What the maze editor of Fire Chief offers ready-made (MazeEditor.tsx): the named mazes of the
 * game, and the words for the two rooms and the three places of the fire.
 *
 * To add a named maze, draw it in ../../fire-chief/scenario.ts (NAMED_MAZES): it then has a
 * button here and is part of "Test on many mazes" (./maze-batch.ts) without another change.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { FireSpot, RoomId } from '../../fire-chief/field';
import { NAMED_MAZES, defaultScenario, type FireChiefScenario } from '../../fire-chief/scenario';

export interface MazeChoice {
  /** id of the ready-made maze (scenario.ts: NAMED_MAZES) */
  id: string;
  /** the name on its button: "Crossroads (default maze)", "Open field" */
  label: string;
  /** one sentence about it, with its level: "Level 3 of 5. Ten walls. ..." */
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
    return {
      id: maze.id,
      label: isDefault ? `${maze.name} (default maze)` : maze.name,
      about: `Level ${maze.level} of ${HARDEST_LEVEL}. ${maze.about}`,
      walls: maze.scenario.walls,
      isDefault,
    };
  });
  // (sort is stable: the others keep their order from easy to hard)
  choices.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return choices.map(({ id, label, about, walls }) => ({ id, label, about, walls }));
})();

/** The ready-made maze that is on the stage, or null for any other maze (built by hand, a random one, one from a code). */
export function mazeChoiceOf(scenario: Pick<FireChiefScenario, 'walls'>): MazeChoice | null {
  return MAZE_CHOICES.find((choice) => sameWalls(choice.walls, scenario.walls)) ?? null;
}

/** The scenario with the walls of a ready-made maze; the fire stays where the student put it. */
export function withMaze(scenario: FireChiefScenario, choice: MazeChoice): FireChiefScenario {
  return { walls: [...choice.walls], fireRoom: scenario.fireRoom, fireSpot: scenario.fireSpot };
}

export const ROOM_LABEL: Record<RoomId, string> = { living: 'Living room', bedroom: 'Bedroom' };

export const SPOT_LABEL: Record<FireSpot, { label: string; hint: string }> = {
  corner: { label: 'Corner', hint: 'In the outer corner of the room, turned towards the middle of the room' },
  back: { label: 'Back wall', hint: 'In the middle of the top wall of the room, facing down the mat' },
  side: { label: 'Side wall', hint: 'In the middle of the outer side wall of the room, facing across the room' },
};
