'use client';

/**
 * The simulator Tri d’entrepôt of Robot en fête 2027 (a category of its own): the Warehouse Sort
 * mission (MakeX Lebanon, Inspire category, local event) all in French. It is the general simulator
 * screen (../SimulatorApp) given the French word table, `text={FR_TEXT}` - the table above the
 * whole screen, lang="fr" on its frame, the blocks and Blockly's own words in French (the table
 * loads the French words of the blocks too: ../../blocks/fr.ts) - filled in with the French
 * twin of the Warehouse Sort game (../../robot-en-fete/game.ts: the same mat, cubes, 24
 * arrangements, points and referee, with French words, the warehouses E1 - E4 and the codes
 * R, V, B), its French words, rules, Cube colours panel and lists of "Tester sur plusieurs
 * dispositions". Everything else is passed as ../warehouse-sort/WarehouseSortSimulator.tsx passes
 * it: the same robot, start pose, table and tests.
 *
 * As in every game, nothing about the examples is here - no program, no description, not even a
 * title: only the address on this website that hands them out (/api/simulator/unlock) and the
 * name of this game, 'robot-en-fete'. The server decides for every visitor which examples they may
 * see and open (the same member and advanced codes as Warehouse Sort), and the Examples window
 * draws its answer, French titles and headings included. So this file, and everything else on the
 * screen, must NEVER import ../../robot-en-fete/sample-catalog (the titles) or
 * ../../robot-en-fete/samples (the programs and their descriptions).
 */
import type { ReactNode } from 'react';
import { robotEnFeteGame } from '../../robot-en-fete/game';
import { TABLE_STRIP } from '../../warehouse-sort/field';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import type { WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { SimulatorApp } from '../SimulatorApp';
import { FR_TEXT } from '../text/fr';
import type { ExamplesConfig } from '../useMemberExamples';
import { ArrangementEditor } from '../warehouse-sort/ArrangementEditor';
import { ROBOT_EN_FETE_BATCH_PRESETS, ROBOT_EN_FETE_TIE_BREAK, robotEnFeteSummaryLabel, robotEnFeteSummaryOrder } from './arrangement-batch';
import { readRobotEnFeteCode } from './arrangement-code';
import { FR_ARRANGEMENT_WORDS } from './arrangement-words';
import { ROBOT_EN_FETE_ASSUMPTIONS, ROBOT_EN_FETE_RULES, ROBOT_EN_FETE_RULES_NOTE } from './rules';
import { TRI_ENTREPOT_TITLE } from './title';
import { ROBOT_EN_FETE_START_ZONE, ROBOT_EN_FETE_WORDS } from './words';

function renderCombinationEditor(scenario: WarehouseSortScenario, onChange: (next: WarehouseSortScenario) => void): ReactNode {
  // (the Cube colours panel of Warehouse Sort, with its French words: "Couleurs des cubes", E1 - E4, rouge / vert / bleu)
  return <ArrangementEditor scenario={scenario} onChange={onChange} words={FR_ARRANGEMENT_WORDS} />;
}

/** The Examples window: the address that hands out the cards and the programs, the game they are for, and whose members they are for. */
const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'robot-en-fete',
  organisation: 'MakeX Lebanon',
};

export default function RobotEnFeteSimulator() {
  return (
    <SimulatorApp
      // the whole screen in French: the word table, lang="fr", the blocks (../text/fr.tsx, ../../blocks/fr.ts)
      text={FR_TEXT}
      game={robotEnFeteGame}
      // the mBot2 of Warehouse Sort, with its line sensor set for white lines on the black mat (../../warehouse-sort/robot.ts)
      robotConfig={WAREHOUSE_SORT_ROBOT}
      title={TRI_ENTREPOT_TITLE}
      // ("Simulateur Tri d’entrepôt" with the robot's name does not fit every phone's line: two lines there, not cut off)
      titleWrapsOnPhone
      // no walls: the robot and the cubes can leave the mat, up to the edge of the table - the stage shows all of it
      stageMargin={TABLE_STRIP}
      startZoneName={ROBOT_EN_FETE_START_ZONE}
      examples={EXAMPLES}
      rules={ROBOT_EN_FETE_RULES}
      rulesNote={ROBOT_EN_FETE_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={ROBOT_EN_FETE_ASSUMPTIONS}
      // (every key given, in French: `satisfies Required<ScreenWords>`, so that no word falls back to English)
      words={ROBOT_EN_FETE_WORDS}
      // in the start zone, facing up along the long white line: the place the examples count on
      initialStartPose={START_POSE}
      // the starter examples print what they found ("Cube : red"): the closed CyberPi panel shows the last line
      showLastPrint
      renderCombinationEditor={renderCombinationEditor}
      // a code that cannot be played ("RR-VV": no blue cube) gets a plain French sentence (./arrangement-code.ts)
      readCode={readRobotEnFeteCode}
      // only 24 arrangements: the test window plays all of them, or the one on the stage (./arrangement-batch.ts)
      batchPresets={ROBOT_EN_FETE_BATCH_PRESETS}
      batchRandomLists={false}
      // with equal points the rules rank by the cubes in the right bay, then by the time of the last delivery
      batchTieBreak={ROBOT_EN_FETE_TIE_BREAK}
      batchSummaryLabel={robotEnFeteSummaryLabel}
      // the summary lists E1 to E4 in order (each run lacks the lines of its blue cube's warehouse)
      batchSummaryOrder={robotEnFeteSummaryOrder}
    />
  );
}
