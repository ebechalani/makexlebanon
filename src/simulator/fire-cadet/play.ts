/**
 * Play a row of cards (or the panel) on Fire Cadet without a screen and get the score - for the
 * examples, their tests and anyone who wants to check a row on many maps.
 *
 *   playFireCadet(program)                       practice map 1
 *   playFireCadet(program, 'P3')                 a map by its code ("P3", "S-A6-D5-C5-C7-E3-F5-F7")
 *   playFireCadet(program, scenario, options)    a map as it is, with options (see PlayOptions)
 *   playEveryPracticeMap(program)                the eight practice maps, P1 to P8
 *
 * It is the same match as on the screen (core/batch.ts: runMatch - the same engine, interpreter
 * and referee). Nothing is random: the same row on the same map always gives the same result.
 * (A row of cards ends the match by itself when it has run; the panel needs taps, which only a
 * screen or a test that drives the simulation gives - played here it runs to the end of the time.)
 *
 * Plain TypeScript, no DOM: it runs under Node.
 */
import { runMatch, type BatchResult } from '../core/batch';
import type { Pose, ProgramJson } from '../core/types';
import { fireCadetGame, fireCadetGameWith } from './game';
import type { CardTimes } from './numbers';
import { PRACTICE_MAPS, defaultScenario, readMapCode, type FireCadetScenario } from './scenario';

export interface PlayOptions {
  /** stop after this many simulated seconds, as if the student said STOP (default: the whole match) */
  maxSeconds?: number;
  /** where the robot starts (default: the spot of D7, looking up) */
  startPose?: Pose;
  /** other card times (default: those of numbers.ts) */
  times?: CardTimes;
}

/** A map from a code ("P3", an own setup's code) or as it is. Throws for a code that does not read, with the sentence of the map code. */
export function mapOf(which: FireCadetScenario | string = defaultScenario()): FireCadetScenario {
  if (typeof which !== 'string') return which;
  const reading = readMapCode(which);
  if (!reading.ok) throw new Error(`"${which}" is not a Fire Cadet map: ${reading.problem}`);
  return reading.scenario;
}

/** Play one whole match and return its result: points, score sheet, end, time. */
export function playFireCadet(program: ProgramJson, which: FireCadetScenario | string = defaultScenario(), options: PlayOptions = {}): BatchResult {
  return runMatch(
    {
      game: options.times ? fireCadetGameWith(options.times) : fireCadetGame,
      scenario: mapOf(which),
      program,
      startPose: options.startPose,
    },
    options.maxSeconds,
  );
}

/** Play the program on the eight practice maps, P1 to P8. */
export function playEveryPracticeMap(program: ProgramJson, options: PlayOptions = {}): BatchResult[] {
  return PRACTICE_MAPS.map((scenario) => playFireCadet(program, scenario, options));
}
