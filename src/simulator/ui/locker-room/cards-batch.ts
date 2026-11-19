/**
 * What "Test on many draws" offers in Locker Room (../BatchDialog.tsx).
 *
 * There are only 12 draws of the two cards, so the window offers no random lists: one list plays
 * them all, the other the draw on the stage.
 *
 *   All 12 draws    every draw once, in number order: R1 .. R6, G1 .. G6 (scenario.ts: allScenarios)
 *   This draw       the draw on the stage
 *
 * The rules rank teams by the better of their 2 runs and say nothing about equal points. So the
 * window does not invent a tie-breaker: runs with equal points keep the order of the list. Its
 * time column shows when the last step with a time was done (Steps 1, 2, 3, 5 and 6 - the tokens
 * are judged at the end and have no time), to see how fast a program is - not to rank it.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { BatchResult } from '../../core/batch';
import { LINE_DELIVERY, tokenLineId } from '../../locker-room/game';
import { SCENARIO_COUNT, TOKEN_COLORS, allScenarios, type LockerRoomScenario } from '../../locker-room/scenario';
import type { BatchPreset, BatchTieBreak } from '../BatchDialog';
import { COLOR_WORD } from './cards-panel';

export const DRAW_BATCH_PRESETS: BatchPreset<LockerRoomScenario>[] = [
  {
    id: 'all-draws',
    label: `All ${SCENARIO_COUNT} draws`,
    hint: `Every draw of the two cards: 2 team colours x 6 zone cards. ${SCENARIO_COUNT} matches.`,
    scenarios: () => allScenarios(),
  },
  {
    id: 'this-draw',
    label: 'This draw',
    hint: 'The draw on the stage: one match.',
    scenarios: (current) => [current],
  },
];

/** The time of the last step of a run that has a time and brought points (seconds), or undefined when none did. */
export function lastStepTime(result: Pick<BatchResult, 'lines'>): number | undefined {
  let last: number | undefined;
  for (const line of result.lines) {
    if (line.points > 0 && typeof line.time === 'number' && Number.isFinite(line.time)) last = last === undefined ? line.time : Math.max(last, line.time);
  }
  return last;
}

/** More points rank higher; equal points stay equal (the rules have no tie-breaker). Negative when `a` ranks higher. */
export function compareDrawRuns(a: Pick<BatchResult, 'total'>, b: Pick<BatchResult, 'total'>): number {
  return b.total - a.total;
}

export const DRAW_TIE_BREAK: BatchTieBreak = {
  label: 'Last step',
  hint: 'The time on the clock when the last step with a time was done (Steps 1, 2, 3, 5, 6; the tokens count at the end). The rules do not say how equal points are ranked: here runs with equal points keep their order.',
  timeOf: lastStepTime,
  none: 'no step done',
  // (the tokens count at the end: "Best run 85 at 0:28.0" would read as if the 85 were reached then)
  tileWords: 'last step at',
  compare: compareDrawRuns,
};

/**
 * The name of a line in the summary of the test window. The score sheet names the team cube with
 * the team colour ("Step 5: deliver the RED cube") and a token with its zone ("Step 7: the RED
 * token (zone A)"), but both change from one draw to the next: the summary names what stays.
 */
export function drawSummaryLabel(line: { id: string; label: string }): string | null {
  if (line.id === LINE_DELIVERY) return 'Step 5: the team colour cube in its circle';
  for (const color of TOKEN_COLORS) if (line.id === tokenLineId(color)) return `Step 7: the ${COLOR_WORD[color]} token`;
  return line.label;
}
