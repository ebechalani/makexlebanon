/**
 * What "Test on many arrangements" offers in Warehouse Sort (../BatchDialog.tsx).
 *
 * There are only 14 arrangements of the cubes, so the window offers no random lists: one list
 * plays them all, the other the arrangement on the stage.
 *
 *   All 14 arrangements    every arrangement once, in number order (scenario.ts: allScenarios)
 *   This arrangement       the arrangement on the stage
 *
 * With equal points the rules rank by "more correct deliveries", then by "faster time of last
 * correct delivery" (tie-breakers 2 and 3). The table shows that time and ranks the runs that
 * way (ARRANGEMENT_TIE_BREAK).
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { BatchResult } from '../../core/batch';
import { LINE_LAST_DELIVERY, deliverLineId, pickLineId } from '../../warehouse-sort/game';
import { WAREHOUSE_IDS } from '../../warehouse-sort/field';
import { SCENARIO_COUNT, allScenarios, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import type { BatchPreset, BatchTieBreak } from '../BatchDialog';

export const ARRANGEMENT_BATCH_PRESETS: BatchPreset<WarehouseSortScenario>[] = [
  {
    id: 'all-arrangements',
    label: `All ${SCENARIO_COUNT} arrangements`,
    hint: `Every way to put red and green cubes in the four warehouses, with at least one of each colour: ${SCENARIO_COUNT} matches.`,
    scenarios: () => allScenarios(),
  },
  {
    id: 'this-arrangement',
    label: 'This arrangement',
    hint: 'The arrangement on the stage: one match.',
    scenarios: (current) => [current],
  },
];

/** How many cubes of a run counted as delivered to the right bay at the end. */
export function correctDeliveries(result: Pick<BatchResult, 'lines'>): number {
  const ids = new Set(WAREHOUSE_IDS.map(deliverLineId));
  return result.lines.filter((line) => ids.has(line.id) && line.ok).length;
}

/** The time of the last correct delivery of a run (the referee's line for a tie), or undefined when no cube counts. */
export function lastDeliveryTime(result: Pick<BatchResult, 'lines'>): number | undefined {
  const time = result.lines.find((line) => line.id === LINE_LAST_DELIVERY)?.time;
  return typeof time === 'number' && Number.isFinite(time) ? time : undefined;
}

/**
 * Which of two runs ranks higher, as the rules' tie-breakers 1 to 3 say: more points, then more
 * cubes in the right bay, then the earlier time of the last of those deliveries. Negative when
 * `a` ranks higher. (Tie-breaker 4 is the head referee: two runs that are equal here stay equal.)
 */
export function compareArrangementRuns(a: Pick<BatchResult, 'total' | 'lines'>, b: Pick<BatchResult, 'total' | 'lines'>): number {
  if (a.total !== b.total) return b.total - a.total;
  const deliveries = correctDeliveries(b) - correctDeliveries(a);
  if (deliveries !== 0) return deliveries;
  return (lastDeliveryTime(a) ?? Infinity) - (lastDeliveryTime(b) ?? Infinity) || 0;
}

export const ARRANGEMENT_TIE_BREAK: BatchTieBreak = {
  label: 'Last delivery',
  hint: 'The time on the clock when the last cube that counts was put in its bay. With equal points, the rules rank more cubes in the right bay higher, then the earlier time.',
  timeOf: lastDeliveryTime,
  none: 'no cube in the right bay',
  compare: compareArrangementRuns,
};

/**
 * The name of a line in the summary of the test window. The score sheet names a cube with its
 * colour ("Pick up cube W1 (red)"), but the colour changes from one arrangement to the next: the
 * summary names the warehouse only. The time for a tie is no goal and no penalty: it is not in
 * the summary (null), only in its column of the table.
 */
export function arrangementSummaryLabel(line: { id: string; label: string }): string | null {
  if (line.id === LINE_LAST_DELIVERY) return null;
  for (const w of WAREHOUSE_IDS) {
    if (line.id === pickLineId(w)) return `Pick up the cube of ${w}`;
    if (line.id === deliverLineId(w)) return `Cube of ${w} in the right bay`;
  }
  return line.label;
}
