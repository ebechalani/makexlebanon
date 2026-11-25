'use client';

/**
 * The simulator for "Fire Fighter" (MakeX Lebanon, Season 2027, the mBot2 category for ages 8 to
 * 10): the general simulator screen (../SimulatorApp) filled in with this game, its robot,
 * examples, rules, words and the list of its one setup.
 *
 * Fire Fighter has ONE setup and nothing is drawn (../../fire-fighter/scenario.ts): the screen has
 * no "Test on many ..." button and its panel "The field" lists where everything stands, without a
 * code, Random or Default (`fixedSetup`). The rules name no restart: no Restart button either.
 *
 * As in the other games, nothing about the examples is here - no program, no description, not
 * even a title: only the address on this website that hands them out (/api/simulator/unlock) and
 * the name of this game. The server decides for every visitor which examples they may see and
 * open, and the Examples window draws its answer. So this file, and everything else on the
 * screen, must NEVER import ../../fire-fighter/sample-catalog (the titles) or
 * ../../fire-fighter/samples (the programs and their descriptions).
 *
 * What the stage shows beyond the other games comes from the simulation itself: the two side
 * supports of each letter tower (game elements, one rigid piece each: Body.group) and the flap
 * between them with its letter while the letter shows (World.props, the letter as high as on the
 * mat: RefereeProp.labelMm) - see ../render.ts.
 */
import type { ReactNode } from 'react';
import { TABLE_MARGIN } from '../../core/engine';
import { fireFighterGame } from '../../fire-fighter/game';
import { FIRE_FIGHTER_ROBOT, START_POSE } from '../../fire-fighter/robot';
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { FIRE_FIGHTER_ASSUMPTIONS, FIRE_FIGHTER_RULES, FIRE_FIGHTER_RULES_NOTE } from './rules';
import { SetupList } from './SetupList';
import { FIRE_FIGHTER_START_ZONE, FIRE_FIGHTER_WORDS } from './words';

/** The panel "The field": the one setup, as a list (nothing in it can be changed). */
function renderCombinationEditor(): ReactNode {
  return <SetupList />;
}

/**
 * The Examples window: the address that hands out the cards and the programs, the game they are
 * for (one of ../member-unlock.ts EXAMPLES_GAMES, the name ../../members/all-examples.ts gives the
 * examples of this game), and whose members they are for.
 */
export const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'fire-fighter',
  organisation: 'MakeX Lebanon',
};

export default function FireFighterSimulator() {
  return (
    <SimulatorApp
      game={fireFighterGame}
      // the mBot2 of Fire Rescue, part for part: gripper, colour sensor at the claw, line sensor for black lines (../../fire-fighter/robot.ts)
      robotConfig={FIRE_FIGHTER_ROBOT}
      title="Fire Fighter"
      // no walls around the mat: the robot and a cube it carries can leave it, up to the edge of the table - the stage shows all of it
      stageMargin={TABLE_MARGIN}
      startZoneName={FIRE_FIGHTER_START_ZONE}
      examples={EXAMPLES}
      rules={FIRE_FIGHTER_RULES}
      rulesNote={FIRE_FIGHTER_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={FIRE_FIGHTER_ASSUMPTIONS}
      words={FIRE_FIGHTER_WORDS}
      // in the Fire Station, facing up, its middle on the black line up to the yellow cube: the place the examples count on
      initialStartPose={START_POSE}
      // the starter examples print what they did ("I have the yellow cube"): the closed CyberPi panel shows the last line
      showLastPrint
      // the rules name no restart: no Restart button
      restartButton={false}
      // one setup, nothing drawn: no "Test on many ...", and the panel lists the field instead of a code (./SetupList.tsx)
      fixedSetup
      renderCombinationEditor={renderCombinationEditor}
    />
  );
}
