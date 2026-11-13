'use client';

/**
 * The simulator for the MakeX "Fire Chief" category (the maze game, ages 14 to 17): the general
 * simulator screen (../SimulatorApp) filled in with this category's game, robot, examples,
 * rules, words and - until the maze editor exists - a small panel to pick a maze.
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
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { MazePicker } from './MazePicker';
import { FIRE_CHIEF_RULES, FIRE_CHIEF_RULES_NOTE } from './rules';
import { FIRE_CHIEF_START_ZONE, FIRE_CHIEF_WORDS } from './words';

function renderCombinationEditor(scenario: FireChiefScenario, onChange: (next: FireChiefScenario) => void): ReactNode {
  return <MazePicker scenario={scenario} onChange={onChange} />;
}

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
      // the robot of this game: no gripper, a flame sensor and a fan (../../fire-chief/robot.ts)
      robotConfig={FIRE_CHIEF_ROBOT}
      title="Fire Chief"
      startZoneName={FIRE_CHIEF_START_ZONE}
      examples={EXAMPLES}
      rules={FIRE_CHIEF_RULES}
      rulesNote={FIRE_CHIEF_RULES_NOTE}
      words={FIRE_CHIEF_WORDS}
      // in the middle of START, facing up the mat: the place the examples count on
      initialStartPose={START_POSE}
      // the fire can stand in either top corner of the mat: the "Enlarge" button lies on the bottom corner
      enlargeButtonCorner="bottom"
      renderCombinationEditor={renderCombinationEditor}
      // (no ready-made lists of mazes for "Test on many combinations" yet: random mazes only)
    />
  );
}
