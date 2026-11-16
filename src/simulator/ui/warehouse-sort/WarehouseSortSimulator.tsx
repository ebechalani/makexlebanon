'use client';

/**
 * The simulator for the beginner mission "Warehouse Sort" (MakeX Lebanon, Inspire category,
 * local event): the general simulator screen (../SimulatorApp) filled in with this game, its
 * robot, examples, rules, words, the Cube colours panel and the lists of "Test on many
 * arrangements".
 *
 * As in the other two games, nothing about the examples is here - no program, no description,
 * not even a title: only the address on this website that hands them out (/api/simulator/unlock)
 * and the name of this game. The server decides for every visitor which examples they may see
 * and open, and the Examples window draws its answer. So this file, and everything else on the
 * screen, must NEVER import ../../warehouse-sort/sample-catalog (the titles) or
 * ../../warehouse-sort/samples (the programs and their descriptions).
 */
import type { ReactNode } from 'react';
import { TABLE_STRIP } from '../../warehouse-sort/field';
import { warehouseSortGame } from '../../warehouse-sort/game';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import type { WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { ARRANGEMENT_BATCH_PRESETS, ARRANGEMENT_TIE_BREAK, arrangementSummaryLabel, arrangementSummaryOrder } from './arrangement-batch';
import { readArrangementCode } from './arrangement-code';
import { ArrangementEditor } from './ArrangementEditor';
import { WAREHOUSE_SORT_ASSUMPTIONS, WAREHOUSE_SORT_RULES, WAREHOUSE_SORT_RULES_NOTE } from './rules';
import { WAREHOUSE_SORT_START_ZONE, WAREHOUSE_SORT_WORDS } from './words';

function renderCombinationEditor(scenario: WarehouseSortScenario, onChange: (next: WarehouseSortScenario) => void): ReactNode {
  return <ArrangementEditor scenario={scenario} onChange={onChange} />;
}

/** The Examples window: the address that hands out the cards and the programs, the game they are for, and whose members they are for. */
const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'warehouse-sort',
  organisation: 'MakeX Lebanon',
};

export default function WarehouseSortSimulator() {
  return (
    <SimulatorApp
      game={warehouseSortGame}
      // the mBot2 of Fire Rescue, with its line sensor set for white lines on the black mat (../../warehouse-sort/robot.ts)
      robotConfig={WAREHOUSE_SORT_ROBOT}
      title="Warehouse Sort"
      // ("Warehouse Sort simulator" is longer than a 360 px phone has room for: two lines there, not cut off)
      titleWrapsOnPhone
      // no walls: the robot and the cubes can leave the mat, up to the edge of the table - the stage shows all of it
      stageMargin={TABLE_STRIP}
      startZoneName={WAREHOUSE_SORT_START_ZONE}
      examples={EXAMPLES}
      rules={WAREHOUSE_SORT_RULES}
      rulesNote={WAREHOUSE_SORT_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={WAREHOUSE_SORT_ASSUMPTIONS}
      words={WAREHOUSE_SORT_WORDS}
      // in the start zone, facing up along the long white line: the place the examples count on
      initialStartPose={START_POSE}
      // the starter examples print what they found ("Cube: red"): the closed CyberPi panel shows the last line
      showLastPrint
      renderCombinationEditor={renderCombinationEditor}
      // a code that cannot be played ("RR-GG": no blue cube) gets a plain sentence (./arrangement-code.ts)
      readCode={readArrangementCode}
      // only 24 arrangements: the test window plays all of them, or the one on the stage (./arrangement-batch.ts)
      batchPresets={ARRANGEMENT_BATCH_PRESETS}
      batchRandomLists={false}
      // with equal points the rules rank by the cubes in the right bay, then by the time of the last delivery
      batchTieBreak={ARRANGEMENT_TIE_BREAK}
      batchSummaryLabel={arrangementSummaryLabel}
      // the summary lists W1 to W4 in order (each run lacks the lines of its blue cube's warehouse)
      batchSummaryOrder={arrangementSummaryOrder}
    />
  );
}
