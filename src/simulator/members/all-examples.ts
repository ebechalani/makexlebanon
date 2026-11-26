/**
 * Every example of the simulator, game by game: for each game its examples with their
 * descriptions and programs, in the order of the Examples window, and the headings of their
 * levels. This is what the server hands out from (see ./unlock.ts).
 *
 * Server only. This file brings the samples.ts and the sample-catalog.ts of every game along
 * (../fire-rescue, ../fire-chief, ../warehouse-sort, ../locker-room, ../fire-cadet,
 * ../fire-fighter and ../robot-en-fete), so nothing of the simulator screen may import it (a
 * test, ./client-guard.test.ts, watches over this).
 *
 * A game is named here the way its page names it when it asks the server ("game" in the
 * request), which is also the id of the game in its game.ts.
 *
 * A NEW GAME gets its line in ALL_GAMES below - and the ids of its examples must be different
 * from every id of the other games: the owner's lists in content/simulator-codes.ts name an
 * example by its id alone. (The website is not built while two games share an id: see
 * mistakesInSetup in ./unlock.ts.)
 */
import { EXAMPLE_LEVELS as FIRE_CADET_LEVELS, SAMPLE_CATALOG as FIRE_CADET_CATALOG } from '../fire-cadet/sample-catalog';
import { getSampleProgram as fireCadetProgram } from '../fire-cadet/samples';
import { EXAMPLE_LEVELS as FIRE_CHIEF_LEVELS, SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { getSampleProgram as fireChiefProgram } from '../fire-chief/samples';
import { EXAMPLE_LEVELS as FIRE_FIGHTER_LEVELS, SAMPLE_CATALOG as FIRE_FIGHTER_CATALOG } from '../fire-fighter/sample-catalog';
import { getSampleProgram as fireFighterProgram } from '../fire-fighter/samples';
import { EXAMPLE_LEVELS as FIRE_RESCUE_LEVELS, SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { getSampleProgram as fireRescueProgram } from '../fire-rescue/samples';
import { EXAMPLE_LEVELS as LOCKER_ROOM_LEVELS, SAMPLE_CATALOG as LOCKER_ROOM_CATALOG } from '../locker-room/sample-catalog';
import { getSampleProgram as lockerRoomProgram } from '../locker-room/samples';
import { EXAMPLE_LEVELS as ROBOT_EN_FETE_LEVELS, SAMPLE_CATALOG as ROBOT_EN_FETE_CATALOG } from '../robot-en-fete/sample-catalog';
import { getSampleProgram as robotEnFeteProgram } from '../robot-en-fete/samples';
import { EXAMPLE_LEVELS as WAREHOUSE_SORT_LEVELS, SAMPLE_CATALOG as WAREHOUSE_SORT_CATALOG } from '../warehouse-sort/sample-catalog';
import { getSampleProgram as warehouseSortProgram } from '../warehouse-sort/samples';

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

/**
 * Warehouse Sort (MakeX Lebanon, Inspire, the beginner mission): its six examples, ordered like
 * the list in ../warehouse-sort/sample-catalog.ts, under headings of its own. Every id starts
 * with "sort-".
 */
export const WAREHOUSE_SORT = {
  game: 'warehouse-sort',
  examples: inCatalogOrder('Warehouse Sort', WAREHOUSE_SORT_CATALOG, warehouseSortProgram),
  levels: WAREHOUSE_SORT_LEVELS,
};

/**
 * Locker Room (MakeX Lebanon, Season 2026, Capelli Starter): its six examples, ordered like the
 * list in ../locker-room/sample-catalog.ts, under headings of its own. Every id starts with
 * "locker-".
 */
export const LOCKER_ROOM = {
  game: 'locker-room',
  examples: inCatalogOrder('Locker Room', LOCKER_ROOM_CATALOG, lockerRoomProgram),
  levels: LOCKER_ROOM_LEVELS,
};

/**
 * Fire Cadet (MakeX Lebanon, Season 2027, the mTiny, ages 4-7): its six examples, ordered like the
 * list in ../fire-cadet/sample-catalog.ts, under headings of its own. Every id starts with
 * "cadet-". Its programs are rows of coding cards (../fire-cadet/cards.ts), not blocks: the door
 * hands them out the same way.
 */
export const FIRE_CADET = {
  game: 'fire-cadet',
  examples: inCatalogOrder('Fire Cadet', FIRE_CADET_CATALOG, fireCadetProgram),
  levels: FIRE_CADET_LEVELS,
};

/**
 * Fire Fighter (MakeX Lebanon, Season 2027, the mBot2, ages 8-10): its six examples, ordered like
 * the list in ../fire-fighter/sample-catalog.ts, under headings of its own. Every id starts with
 * "fighter-".
 */
export const FIRE_FIGHTER = {
  game: 'fire-fighter',
  examples: inCatalogOrder('Fire Fighter', FIRE_FIGHTER_CATALOG, fireFighterProgram),
  levels: FIRE_FIGHTER_LEVELS,
};

/**
 * Robot en fête 2027 (MakeX Lebanon, a category of its own, outside every season: the Warehouse
 * Sort mission in French): its six examples - those of Warehouse Sort, the same programs with
 * French texts - ordered like the list in ../robot-en-fete/sample-catalog.ts, under French
 * headings of its own. Every id starts with "fete-", so that the owner's lists name them apart
 * from the "sort-" examples of Warehouse Sort; the same codes open them.
 */
export const ROBOT_EN_FETE = {
  game: 'robot-en-fete',
  examples: inCatalogOrder('Robot en fête 2027', ROBOT_EN_FETE_CATALOG, robotEnFeteProgram),
  levels: ROBOT_EN_FETE_LEVELS,
};

/** Every game that has examples. A request to the server names one of them (or none, which means Fire Rescue). */
export const ALL_GAMES = [FIRE_RESCUE, FIRE_CHIEF, WAREHOUSE_SORT, LOCKER_ROOM, FIRE_CADET, FIRE_FIGHTER, ROBOT_EN_FETE];
