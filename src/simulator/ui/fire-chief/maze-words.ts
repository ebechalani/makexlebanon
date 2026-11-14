/**
 * The sentences of the Fire Chief maze editor (MazeEditor.tsx) that are not counted from the
 * maze: how to use the plan, and what the editor says about a maze in which a room cannot be
 * reached.
 *
 * SUCH A MAZE CAN STILL BE STARTED, FOR PRACTICE. Why:
 *   - A maze built by hand passes through such states (close one way, then open another). An
 *     editor that refused those clicks, or a Start button that went off in between, would be
 *     hard to understand.
 *   - It is useful practice: a box around START to test "stop in front of a wall", a maze with
 *     one room closed to see what a program does when it cannot get there.
 *   - Nothing in the engine or the referee needs the ways: walls are walls, and the points do
 *     not depend on them.
 * What keeps it honest: as long as the maze is like this, the editor says so - what is wrong in
 * the game's own words (Game.scenarioProblems), that it is no competition maze, and that an
 * attempt in it is practice. The code of such a maze can be copied and typed in like any other.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { scenarioProblems, type FireChiefScenario } from '../../fire-chief/scenario';

/** Under the heading of the plan: how a wall is switched, with a pointer, a finger and the keyboard. */
export const PLAN_HINT =
  'Click or tap a line between two cells to put a wall there or to take it away. ' +
  'With the keyboard: the arrow keys go from wall to wall, the space bar switches the wall.';

/** What a wall place says when the pointer rests on it. */
export function wallHint(name: string, standing: boolean): string {
  return standing ? `${name}: a wall stands here. Click to take it away.` : `${name}: no wall. Click to put one here.`;
}

/** What the editor calls a maze that is none of the ready-made ones. */
export const OWN_MAZE_ABOUT = 'Your own maze: built by hand, drawn at random or loaded from a code.';

export interface PracticeNote {
  /** the heading of the note */
  title: string;
  /** what is wrong, one sentence per problem, in the game's own words */
  problems: string[];
  /** what that means: no competition maze, but practice is possible */
  meaning: string;
}

/**
 * What the editor says about a maze that the game would not play in a competition, or null for
 * a maze that is fine. (The draft rules, §3: every competition layout has a way from START to
 * both rooms.)
 */
export function practiceNote(s: FireChiefScenario): PracticeNote | null {
  const problems = scenarioProblems(s);
  if (problems.length === 0) return null;
  return {
    title: 'This is a practice maze, not a competition maze.',
    problems,
    meaning: 'The draft rules say that a competition maze has a way from START to both rooms. You can still start an attempt in this maze to practise.',
  };
}
