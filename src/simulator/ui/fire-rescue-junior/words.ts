/**
 * The sentences of the simulator screen that are different in Fire Rescue Junior (see
 * ../screen-words.ts). Everything left out is said as in Fire Rescue: a Junior match is a Fire
 * Rescue match, with the same missions, towers and buckets. Only the combination is smaller -
 * the buckets on W1 to W4, and nothing else.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { JUNIOR_SCENARIO_COUNT } from '../../fire-rescue-junior/scenario';
import type { ScreenWords } from '../screen-words';

export const FIRE_RESCUE_JUNIOR_WORDS: Partial<ScreenWords> = {
  randomHint: 'Draw where the four buckets stand, like the referee does. The people stay where the rule book shows them.',
  scenarioNote:
    `${JUNIOR_SCENARIO_COUNT} combinations are possible: only the buckets on W1 to W4 change. ` +
    'The people always stand where the rule book shows them. Changing the combination puts the field back to the start.',
};
