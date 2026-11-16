/**
 * Play a block program on Warehouse Sort without a screen and get the score - for the examples,
 * their tests and anyone who wants to check a program on many arrangements.
 *
 *   playWarehouseSort(program)                       the default arrangement, "GR-BR"
 *   playWarehouseSort(program, 'GB-RG')              an arrangement by its code
 *   playWarehouseSort(program, 5)                    ... or by its place in allScenarios() (0..23)
 *   playWarehouseSort(program, scenario, { seed })   with options (see PlayOptions)
 *   playEveryArrangement(program)                    all 24 arrangements, in number order
 *
 * It is the same match as on the screen (core/batch.ts: runMatch - the same engine, interpreter
 * and referee), with one difference: the floor sensors read the vector drawing of the mat
 * (field.ts: MAT_VECTOR), not the picture the browser reads. Where the two differ is written at
 * MAT_VECTOR. The same program, arrangement and seed always give the same result.
 *
 * Plain TypeScript, no DOM: it runs under Node.
 */
import { runMatch, type BatchResult } from '../core/batch';
import type { MatSampler, Pose, ProgramJson, RobotConfig } from '../core/types';
import { warehouseSortGame } from './game';
import { SCENARIO_COUNT, allScenarios, decodeScenario, defaultScenario, scenarioFromIndex, type WarehouseSortScenario } from './scenario';

export interface PlayOptions {
  /** seed of the noise generator (noise is off unless the robot has some) - default 1 */
  seed?: number;
  /** stop after this many simulated seconds, as if the team said "Finished" (default: the whole 90 s) */
  maxSeconds?: number;
  /** where the robot starts (default: the game's start pose, in the start zone facing up) */
  startPose?: Pose;
  /** another robot (default: the game's mBot2) */
  robotConfig?: RobotConfig;
  /** what the floor sensors see (default: the vector drawing of the mat) */
  sampler?: MatSampler;
}

/**
 * An arrangement from a code ("GR-BR", "grbr"), from its place 0..23 in allScenarios() (for
 * programs that test; a student never types a number), or as it is. Throws for anything else.
 */
export function arrangement(which: WarehouseSortScenario | string | number = defaultScenario()): WarehouseSortScenario {
  if (typeof which === 'object') return which;
  if (typeof which === 'number') {
    if (Number.isInteger(which) && which >= 0 && which < SCENARIO_COUNT) return scenarioFromIndex(which);
    throw new Error(`${which} is not the place of a Warehouse Sort arrangement (0 to ${SCENARIO_COUNT - 1})`);
  }
  const scenario = decodeScenario(which);
  if (!scenario) throw new Error(`"${which}" is not the code of a Warehouse Sort arrangement (like "GR-BR")`);
  return scenario;
}

/** Play one whole match and return its result: points, score sheet, end, time. */
export function playWarehouseSort(
  program: ProgramJson,
  which: WarehouseSortScenario | string | number = defaultScenario(),
  options: PlayOptions = {},
): BatchResult {
  return runMatch(
    {
      game: warehouseSortGame,
      scenario: arrangement(which),
      program,
      robotConfig: options.robotConfig,
      startPose: options.startPose,
      sampler: options.sampler,
      seed: options.seed ?? 1,
    },
    options.maxSeconds,
  );
}

/** Play the program on all 24 arrangements, one after the other (seed + n for arrangement n). */
export function playEveryArrangement(program: ProgramJson, options: PlayOptions = {}): BatchResult[] {
  const seed = options.seed ?? 1;
  return allScenarios().map((scenario, n) => playWarehouseSort(program, scenario, { ...options, seed: seed + n }));
}
