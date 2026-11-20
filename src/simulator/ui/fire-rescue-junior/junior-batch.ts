/**
 * What "Test on many combinations" offers in Fire Rescue Junior (../BatchDialog.tsx).
 *
 * There are only 24 Junior combinations - the buckets on W1 to W4, the people always where the
 * rule book shows them - so the window offers no random lists: one list plays them all, the other
 * the combination on the stage. (Like Warehouse Sort: ../warehouse-sort/arrangement-batch.ts.)
 *
 *   All 24 combinations    every Junior combination once, in number order (allJuniorScenarios)
 *   This combination       the combination on the stage
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { FireRescueScenario } from '../../fire-rescue/scenario';
import { JUNIOR_SCENARIO_COUNT, allJuniorScenarios } from '../../fire-rescue-junior/scenario';
import type { BatchPreset } from '../BatchDialog';

export const JUNIOR_BATCH_PRESETS: BatchPreset<FireRescueScenario>[] = [
  {
    id: 'all-combinations',
    label: `All ${JUNIOR_SCENARIO_COUNT} combinations`,
    hint: `Every way the referee can put the four buckets on W1 to W4. The people stand where the rule book shows them. ${JUNIOR_SCENARIO_COUNT} matches.`,
    scenarios: () => allJuniorScenarios(),
  },
  {
    id: 'this-combination',
    label: 'This combination',
    hint: 'The combination on the stage: one match.',
    scenarios: (current) => [current],
  },
];
