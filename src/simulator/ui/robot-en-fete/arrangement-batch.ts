/**
 * Robot en fête 2027: what "Tester sur plusieurs dispositions" offers - the French twin of
 * ../warehouse-sort/arrangement-batch.ts. The lists, the ranking and the order of the summary are
 * Warehouse Sort's (the same 24 arrangements, the same tie-breakers); only the words are French.
 *
 *   Les 24 dispositions    every arrangement once, in number order
 *   Cette disposition      the arrangement on the stage
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { frWarehouse, NB } from '../../robot-en-fete/scenario-words';
import { WAREHOUSE_IDS } from '../../warehouse-sort/field';
import { LINE_BLUE, LINE_LAST_DELIVERY, deliverLineId, pickLineId } from '../../warehouse-sort/game';
import { SCENARIO_COUNT, allScenarios, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import type { BatchPreset, BatchTieBreak } from '../BatchDialog';
import { arrangementSummaryOrder, compareArrangementRuns, lastDeliveryTime } from '../warehouse-sort/arrangement-batch';

export const ROBOT_EN_FETE_BATCH_PRESETS: BatchPreset<WarehouseSortScenario>[] = [
  {
    id: 'all-arrangements',
    label: `Les ${SCENARIO_COUNT} dispositions`,
    hint: `Toutes les façons de mettre les cubes dans les quatre entrepôts${NB}: un bleu, les autres rouges ou verts, au moins un de chaque. ${SCENARIO_COUNT} matchs.`,
    scenarios: () => allScenarios(),
  },
  {
    id: 'this-arrangement',
    label: 'Cette disposition',
    hint: `La disposition sur la scène${NB}: un match.`,
    scenarios: (current) => [current],
  },
];

/** With equal points the rules rank by the cubes in the right bay, then by the time of the last delivery (as in Warehouse Sort). */
export const ROBOT_EN_FETE_TIE_BREAK: BatchTieBreak = {
  label: 'Dernière livraison',
  hint: 'Le temps au chrono quand le dernier cube qui compte a été posé dans sa baie. À points égaux, les règles classent d’abord l’essai qui a le plus de cubes dans la bonne baie, puis celui dont la dernière livraison est la plus tôt.',
  timeOf: lastDeliveryTime,
  none: 'aucun cube dans la bonne baie',
  compare: compareArrangementRuns,
};

/**
 * The name of a line in the summary of the test window: the warehouse only, not the colour of
 * its cube, which changes from one arrangement to the next ("Prendre le cube de E1"). The line
 * of the blue cube names no warehouse; the time for a tie is not in the summary (null). Any other
 * line keeps the referee's own (French) label.
 */
export function robotEnFeteSummaryLabel(line: { id: string; label: string }): string | null {
  if (line.id === LINE_LAST_DELIVERY) return null;
  if (line.id === LINE_BLUE) return 'Cube bleu déplacé';
  for (const w of WAREHOUSE_IDS) {
    if (line.id === pickLineId(w)) return `Prendre le cube de ${frWarehouse(w)}`;
    if (line.id === deliverLineId(w)) return `Cube de ${frWarehouse(w)} dans la bonne baie`;
  }
  return line.label;
}

/** The order of the summary: Warehouse Sort's (E1 to E4, then the penalties; it has no words). */
export const robotEnFeteSummaryOrder = arrangementSummaryOrder;
