/**
 * Every example of the Fire Rescue simulator with its description and its program, in the order
 * of the Examples window: what the server hands out (see ./unlock.ts).
 *
 * Server only. This file brings ../fire-rescue/samples.ts along, so nothing of the simulator
 * screen may import it (a test, ./client-guard.test.ts, watches over this).
 */
import { SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';
import { getSampleProgram, type SampleProgram } from '../fire-rescue/samples';

/** The seven examples: the six samples and the full mission, ordered like the list in sample-catalog.ts. */
export const ALL_EXAMPLES: readonly SampleProgram[] = SAMPLE_CATALOG.map((card) => {
  const sample = getSampleProgram(card.id);
  if (!sample) throw new Error(`The example "${card.id}" is on the list (sample-catalog.ts) but has no program in samples.ts.`);
  return sample;
});
