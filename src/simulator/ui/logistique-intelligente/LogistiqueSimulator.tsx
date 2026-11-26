'use client';

/**
 * The simulator Logistique intelligente of Robot en fête 2027 (a category of its own): the regular
 * mission of MakeX Inspire 2024, "Smart Logistics", all in French. It is the general simulator
 * screen (../SimulatorApp) given the French word table, `text={FR_TEXT}` - the table above the
 * whole screen, lang="fr" on its frame, the blocks and Blockly's own words in French (the table
 * loads the French words of the blocks too: ../../blocks/fr.ts) - filled in with this game
 * (../../logistique-intelligente/game.ts: the mat inside its frame, the ten cubes in two layers on
 * the cross, the eight warehouses E1 - E8 and the referee of the regular mission, in French), its
 * robot (Tri d’entrepôt's mBot2), its French words, rules and panel « Le terrain ».
 *
 * As Fire Fighter's screen (../fire-fighter/FireFighterSimulator.tsx), the regular mission has ONE
 * setup and nothing is drawn (rules p. 12/8): no « Tester sur plusieurs dispositions », and the
 * panel lists where everything stands, without a code, Random or Default (`fixedSetup`). The rules
 * forbid restarts (p. 15/11): no « Recommencer » button either. Its score goes up to 500: the box
 * of the score has room for three digits from the start (`scoreDigits`).
 *
 * As in every game, nothing about the examples is here - no program, no description, not even a
 * title: only the address on this website that hands them out (/api/simulator/unlock) and the
 * name of this game, 'logistique-intelligente'. The server decides for every visitor which
 * examples they may see and open (the same member and advanced codes as the other games), and the
 * Examples window draws its answer, French titles and headings included. So this file, and
 * everything else on the screen, must NEVER import ../../logistique-intelligente/sample-catalog
 * (the titles) or ../../logistique-intelligente/samples (the programs and their descriptions).
 */
import type { ReactNode } from 'react';
import { TABLE_MARGIN } from '../../core/engine';
import { logistiqueGame } from '../../logistique-intelligente/game';
import { LOGISTIQUE_ROBOT, START_POSE } from '../../logistique-intelligente/robot';
import { SimulatorApp } from '../SimulatorApp';
import { FR_TEXT } from '../text/fr';
import type { ExamplesConfig } from '../useMemberExamples';
import { LOGISTIQUE_ASSUMPTIONS, LOGISTIQUE_RULES, LOGISTIQUE_RULES_NOTE } from './rules';
import { SetupList } from './SetupList';
import { LOGISTIQUE_TITLE } from './title';
import { LOGISTIQUE_START_ZONE, LOGISTIQUE_WORDS } from './words';

/** The panel « Le terrain »: the one setup, as a list (nothing in it can be changed). */
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
  game: 'logistique-intelligente',
  organisation: 'MakeX Lebanon',
};

export default function LogistiqueSimulator() {
  return (
    <SimulatorApp
      // the whole screen in French: the word table, lang="fr", the blocks (../text/fr.tsx, ../../blocks/fr.ts)
      text={FR_TEXT}
      game={logistiqueGame}
      // Tri d’entrepôt's mBot2: gripper, colour sensor at the claw, line sensor set for white lines on the black mat
      robotConfig={LOGISTIQUE_ROBOT}
      title={LOGISTIQUE_TITLE}
      // (« Simulateur Logistique intelligente » with the robot's name does not fit a phone's line: two lines there, not cut off)
      titleWrapsOnPhone
      // the frame and the table around it: the raised claw reaches over the frame (62 mm out), and a cube it carries leaves the arena there
      stageMargin={TABLE_MARGIN}
      startZoneName={LOGISTIQUE_START_ZONE}
      examples={EXAMPLES}
      rules={LOGISTIQUE_RULES}
      rulesNote={LOGISTIQUE_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={LOGISTIQUE_ASSUMPTIONS}
      // (every key given, in French: `satisfies Required<ScreenWords>`, so that no word falls back to English)
      words={LOGISTIQUE_WORDS}
      // in the middle of the start area, facing up the stem towards the cross: the place the examples count on
      initialStartPose={START_POSE}
      // the starter examples print what they found (« Cube : yellow »): the closed CyberPi panel shows the last line
      showLastPrint
      // the rules allow no restart: no Restart button
      restartButton={false}
      // one setup, nothing drawn: no « Tester sur plusieurs dispositions », and the panel lists the field instead of a code (./SetupList.tsx)
      fixedSetup
      // 0, 50, 100 … 500: room for three digits from the first second
      scoreDigits={3}
      renderCombinationEditor={renderCombinationEditor}
    />
  );
}
