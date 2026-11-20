'use client';

/**
 * The simulator for the MakeX "Fire Rescue Junior" category (ages 10-12): the general simulator
 * screen (../SimulatorApp) filled in with the Junior game, the Fire Rescue robot and examples,
 * the Junior rules, words, combination editor and test lists.
 *
 * Fire Rescue Junior is the Fire Rescue game with a smaller draw: the referee draws the buckets on
 * W1 to W4 and nothing else (../../fire-rescue-junior). Everything on this screen that can set a
 * combination - the random draw, the editor, the code field, the lists of "Test on many
 * combinations" - gives one of those 24 and nothing else.
 *
 * The blocks a student made on the Fire Rescue page before the split are on the Fire Rescue Senior
 * page (it kept the id of that game): when this screen opens with an empty workspace, a message
 * says so (./earlier-blocks.ts).
 *
 * The examples are the examples of Fire Rescue, behind the same lock: the request names the game
 * 'fire-rescue'. As on the other screens, nothing about them is here - no program, no
 * description, not even a title: only the address on this website that hands them out
 * (/api/simulator/unlock). So this file, and everything else on the screen, must NEVER import
 * ../../fire-rescue/sample-catalog (the titles) or ../../fire-rescue/samples (the programs and
 * their descriptions).
 */
import type { ReactNode } from 'react';
import { DEFAULT_ROBOT_CONFIG } from '../../core/robot';
import { startPoseFor } from '../../fire-rescue/game';
import type { FireRescueScenario } from '../../fire-rescue/scenario';
import { fireRescueJuniorGame } from '../../fire-rescue-junior/game';
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { JuniorCombinationEditor } from './CombinationEditor';
import { earlierBlocksNote } from './earlier-blocks';
import { readJuniorCode } from './junior-code';
import { JUNIOR_BATCH_PRESETS } from './junior-batch';
import { FIRE_RESCUE_JUNIOR_RULES } from './rules';
import { FIRE_RESCUE_JUNIOR_WORDS } from './words';

function renderCombinationEditor(scenario: FireRescueScenario, onChange: (next: FireRescueScenario) => void): ReactNode {
  return <JuniorCombinationEditor scenario={scenario} onChange={onChange} />;
}

/** The Examples window: the examples of Fire Rescue (the same game for a program), behind the same lock. */
const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'fire-rescue',
  organisation: 'MakeX Lebanon',
};

/** The robot starts facing up the mat, in the middle of the Fire Station - as in Fire Rescue Senior. */
const START_POSE = startPoseFor(DEFAULT_ROBOT_CONFIG);

export default function FireRescueJuniorSimulator() {
  return (
    <SimulatorApp
      game={fireRescueJuniorGame}
      robotConfig={DEFAULT_ROBOT_CONFIG}
      title="Fire Rescue Junior"
      // ("Fire Rescue Junior simulator" is longer than a phone has room for: two lines there, not cut off)
      titleWrapsOnPhone
      startZoneName="Fire Station"
      examples={EXAMPLES}
      rules={FIRE_RESCUE_JUNIOR_RULES}
      words={FIRE_RESCUE_JUNIOR_WORDS}
      initialStartPose={START_POSE}
      renderCombinationEditor={renderCombinationEditor}
      // the blocks of the Fire Rescue page are on the Senior page: said when this screen opens with an empty workspace and the browser keeps some (./earlier-blocks.ts)
      emptyWorkspaceNote={earlierBlocksNote}
      // a code that is not one of the 24 - a Fire Rescue Senior code too - gets a plain sentence (./junior-code.ts)
      readCode={readJuniorCode}
      // only 24 combinations: the test window plays all of them, or the one on the stage (./junior-batch.ts)
      batchPresets={JUNIOR_BATCH_PRESETS}
      batchRandomLists={false}
    />
  );
}
