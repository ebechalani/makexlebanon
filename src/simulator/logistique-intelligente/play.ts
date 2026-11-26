/**
 * Play a block program on Logistique intelligente without a screen and get the score - for the
 * examples, their tests and anyone who wants to check a program.
 *
 *   playLogistique(program)                 the one setup of the rules (the cross)
 *   playLogistique(program, { seed })       with options (see PlayOptions)
 *
 * Logistique intelligente has one setup (./scenario.ts), so there is no arrangement to choose.
 *
 * It is the same match as on the screen (core/batch.ts: runMatch - the same engine, interpreter
 * and referee), with one difference: the floor sensors read the vector drawing of the mat
 * (field.ts: MAT_VECTOR), not the picture the browser reads - unless `sampler` says otherwise.
 * The same program and seed always give the same result.
 *
 * Plain TypeScript, no DOM: it runs under Node.
 */
import { runMatch, type BatchResult } from '../core/batch';
import type { MatSampler, Pose, ProgramJson, RobotConfig } from '../core/types';
import { logistiqueGame } from './game';
import { RULES_SETUP } from './scenario';

export interface PlayOptions {
  /** seed of the noise generator (noise is off unless the robot has some) - default 1 */
  seed?: number;
  /** stop after this many simulated seconds, as if the team said « Terminé » (default: the whole 150 s) */
  maxSeconds?: number;
  /** where the robot starts (default: the game's start pose, in the start area facing up) */
  startPose?: Pose;
  /** another robot (default: the game's mBot2) */
  robotConfig?: RobotConfig;
  /** what the floor sensors see (default: the vector drawing of the mat) */
  sampler?: MatSampler;
}

/** Play one whole match and return its result: points, score sheet, end, time. */
export function playLogistique(program: ProgramJson, options: PlayOptions = {}): BatchResult {
  return runMatch(
    {
      game: logistiqueGame,
      scenario: RULES_SETUP,
      program,
      robotConfig: options.robotConfig,
      startPose: options.startPose,
      sampler: options.sampler,
      seed: options.seed ?? 1,
    },
    options.maxSeconds,
  );
}
