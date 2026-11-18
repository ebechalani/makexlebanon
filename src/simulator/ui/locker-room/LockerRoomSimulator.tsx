'use client';

/**
 * The simulator for "Locker Room" (MakeX Lebanon, Season 2026, the Capelli category for ages 13
 * to 15): the general simulator screen (../SimulatorApp) filled in with this game, its robot,
 * examples, rules, words, the Cards panel and the lists of "Test on many draws".
 *
 * As in the other games, nothing about the examples is here - no program, no description, not
 * even a title: only the address on this website that hands them out (/api/simulator/unlock) and
 * the name of this game. The server decides for every visitor which examples they may see and
 * open, and the Examples window draws its answer. So this file, and everything else on the
 * screen, must NEVER import ../../locker-room/sample-catalog (the titles) or
 * ../../locker-room/samples (the programs and their descriptions).
 *
 * What the stage shows beyond the other games comes from the simulation itself: the Team Box on
 * the robot and the referee's colour card (World.props), the stadium gate (World.walls, gone once
 * it opens) and the turned pickup zones (ZoneOverlay.outline) - see ../render.ts.
 */
import type { ReactNode } from 'react';
import { TABLE_STRIP } from '../../locker-room/field';
import { lockerRoomGame } from '../../locker-room/game';
import { LOCKER_ROOM_ROBOT, START_POSE } from '../../locker-room/robot';
import type { LockerRoomScenario } from '../../locker-room/scenario';
import { SimulatorApp } from '../SimulatorApp';
import type { ExamplesConfig } from '../useMemberExamples';
import { DRAW_BATCH_PRESETS, DRAW_TIE_BREAK, drawSummaryLabel } from './cards-batch';
import { readCardsCode } from './cards-code';
import { CardsEditor } from './CardsEditor';
import { LOCKER_ROOM_ASSUMPTIONS, LOCKER_ROOM_RULES, LOCKER_ROOM_RULES_NOTE } from './rules';
import { LOCKER_ROOM_START_ZONE, LOCKER_ROOM_WORDS } from './words';

function renderCombinationEditor(scenario: LockerRoomScenario, onChange: (next: LockerRoomScenario) => void): ReactNode {
  return <CardsEditor scenario={scenario} onChange={onChange} />;
}

/** The Examples window: the address that hands out the cards and the programs, the game they are for, and whose members they are for. */
const EXAMPLES: ExamplesConfig = {
  unlockUrl: '/api/simulator/unlock',
  game: 'locker-room',
  organisation: 'MakeX Lebanon',
};

export default function LockerRoomSimulator() {
  return (
    <SimulatorApp
      game={lockerRoomGame}
      // the mBot2 of Warehouse Sort, part for part: gripper, colour sensor at the claw, line sensor set for white lines (../../locker-room/robot.ts)
      robotConfig={LOCKER_ROOM_ROBOT}
      title="Locker Room"
      // no walls around the mat: the robot and the cubes can leave it, up to the edge of the table - the stage shows all of it
      stageMargin={TABLE_STRIP}
      startZoneName={LOCKER_ROOM_START_ZONE}
      examples={EXAMPLES}
      rules={LOCKER_ROOM_RULES}
      rulesNote={LOCKER_ROOM_RULES_NOTE}
      // what is not a rule but an assumption of the simulator has its own part of the window
      rulesExtra={LOCKER_ROOM_ASSUMPTIONS}
      words={LOCKER_ROOM_WORDS}
      // in the Locker Room, facing right along the bottom line: the place the examples count on
      initialStartPose={START_POSE}
      // the starter examples show what they read ("Team: green"): the closed CyberPi panel shows the last line
      showLastPrint
      // the rules have no restarts (anyone touching the robot after GO voids the run): no Restart button
      restartButton={false}
      renderCombinationEditor={renderCombinationEditor}
      // a code that is no draw ("G7", "Y2") gets a plain sentence (./cards-code.ts)
      readCode={readCardsCode}
      // only 12 draws: the test window plays all of them, or the one on the stage (./cards-batch.ts)
      batchPresets={DRAW_BATCH_PRESETS}
      batchRandomLists={false}
      // the rules have no tie-breaker: equal points keep their order; the column shows the time of the last step
      batchTieBreak={DRAW_TIE_BREAK}
      // the summary names the team cube and the tokens without the colour or the zone of one draw
      batchSummaryLabel={drawSummaryLabel}
    />
  );
}
