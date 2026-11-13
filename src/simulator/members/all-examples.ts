/**
 * Every example of the simulator, game by game: for each game its examples with their
 * descriptions and programs, in the order of the Examples window, and the headings of their
 * levels. This is what the server hands out from (see ./unlock.ts).
 *
 * Server only. This file brings the samples.ts and the sample-catalog.ts of every game along
 * (../fire-rescue and ../fire-chief), so nothing of the simulator screen may import it (a test,
 * ./client-guard.test.ts, watches over this).
 *
 * A game is named here the way its page names it when it asks the server ("game" in the
 * request), which is also the id of the game in its game.ts.
 *
 * A NEW GAME gets its line in ALL_GAMES below - and the ids of its examples must be different
 * from every id of the other games: the owner's lists in content/simulator-codes.ts name an
 * example by its id alone. (The website is not built while two games share an id: see
 * mistakesInSetup in ./unlock.ts.)
 */
import { EXAMPLE_LEVELS as FIRE_CHIEF_LEVELS, SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { getSampleProgram as fireChiefProgram } from '../fire-chief/samples';
import { EXAMPLE_LEVELS as FIRE_RESCUE_LEVELS, SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { getSampleProgram as fireRescueProgram } from '../fire-rescue/samples';

/** The examples of a game in the order of its catalog. Throws - when the server starts - for a card that has no program. */
function inCatalogOrder<Example>(game: string, catalog: ReadonlyArray<{ id: string }>, programOf: (id: string) => Example | undefined): readonly Example[] {
  return catalog.map((card) => {
    const sample = programOf(card.id);
    if (!sample) throw new Error(`The example "${card.id}" of ${game} is on the list (sample-catalog.ts) but has no program in samples.ts.`);
    return sample;
  });
}

/**
 * Fire Rescue: the seven examples (the six samples and the full mission), ordered like the list
 * in ../fire-rescue/sample-catalog.ts, under the headings Starter, Intermediate, Advanced.
 */
export const FIRE_RESCUE = {
  game: 'fire-rescue',
  examples: inCatalogOrder('Fire Rescue', FIRE_RESCUE_CATALOG, fireRescueProgram),
  levels: FIRE_RESCUE_LEVELS,
};

/** Fire Chief (the maze): its six examples, ordered like the list in ../fire-chief/sample-catalog.ts, under headings of its own. */
export const FIRE_CHIEF = {
  game: 'fire-chief',
  examples: inCatalogOrder('Fire Chief', FIRE_CHIEF_CATALOG, fireChiefProgram),
  levels: FIRE_CHIEF_LEVELS,
};

/** Every game that has examples. A request to the server names one of them (or none, which means Fire Rescue). */
export const ALL_GAMES = [FIRE_RESCUE, FIRE_CHIEF];
