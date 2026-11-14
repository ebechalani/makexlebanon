'use client';

/**
 * The simulator for the MakeX "Fire Chief" category (the maze game, ages 14 to 17): the general
 * simulator screen (../SimulatorApp) filled in with this category's game, robot, examples,
 * rules, words, maze editor and the lists of mazes for "Test on many mazes".
 *
 * As in Fire Rescue, nothing about the examples is here - no program, no description, not even
 * a title: only the address on this website that hands them out (/api/simulator/unlock) and the
 * name of this game. The server decides for every visitor which examples they may see and open,
 * and the Examples window draws its answer. So this file, and everything else on the screen,
 * must NEVER import ../../fire-chief/sample-catalog (the titles) or ../../fire-chief/samples
 * (the programs and their descriptions).
 */
import type { ReactNode } from 'react';
import { fireChiefGame } from '../../fire-chief/game';
import { FIRE_CHIEF_ROBOT, START_POSE } from '../../fire-chief/robot';
import type { FireChiefScenario } from '../../fire-chief/scenario';
import type { BatchRandom } from '../BatchDialog';
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { MAZE_BATCH_PRESETS, RANDOM_MAZES_NOTE, randomMazes } from './maze-batch';
import { readMazeCode } from './maze-code';
import { MazeEditor } from './MazeEditor';
import { FIRE_CHIEF_ASSUMPTIONS, FIRE_CHIEF_RULES, FIRE_CHIEF_RULES_NOTE } from './rules';
import { FIRE_CHIEF_START_ZONE, FIRE_CHIEF_WORDS } from './words';

function renderCombinationEditor(scenario: FireChiefScenario, onChange: (next: FireChiefScenario) => void): ReactNode {
  return <MazeEditor scenario={scenario} onChange={onChange} />;
}

/** The random lists of "Test on many mazes": random mazes with the fire at each of its six places in turn. */
const BATCH_RANDOM: BatchRandom<FireChiefScenario> = { draw: randomMazes, note: RANDOM_MAZES_NOTE };

/** The Examples window: the address that hands out the cards and the programs, the game they are for, and whose members they are for. */
const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'fire-chief',
  organisation: 'MakeX Lebanon',
};

export default function FireChiefSimulator() {
  return (
    <SimulatorApp
      game={fireChiefGame}
      // the robot of this game: no gripper, a colour sensor that looks forward and a fan (../../fire-chief/robot.ts)
      robotConfig={FIRE_CHIEF_ROBOT}
      title="Fire Chief"
      startZoneName={FIRE_CHIEF_START_ZONE}
      examples={EXAMPLES}
      rules={FIRE_CHIEF_RULES}
      rulesNote={FIRE_CHIEF_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={FIRE_CHIEF_ASSUMPTIONS}
      words={FIRE_CHIEF_WORDS}
      // in the middle of START, facing up the mat: the place the examples count on
      initialStartPose={START_POSE}
      // A program of this game often says what it found on the CyberPi screen ("No red here",
      // "Choose: Open field") and ends: the closed CyberPi panel shows the last line it printed.
      showLastPrint
      // the fire can stand in either top corner of the mat: the "Enlarge" button lies on the bottom corner
      enlargeButtonCorner="bottom"
      renderCombinationEditor={renderCombinationEditor}
      // a code is read the editor's way: the code of a maze that is not finished is a code too (./maze-code.ts)
      readCode={readMazeCode}
      batchPresets={MAZE_BATCH_PRESETS}
      batchRandom={BATCH_RANDOM}
    />
  );
}
