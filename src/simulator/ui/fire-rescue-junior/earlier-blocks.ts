/**
 * Where the blocks are that a student made on the Fire Rescue page before the split: on the Fire
 * Rescue Senior page.
 *
 * The browser keeps a student's blocks under the id of the game. Fire Rescue Senior kept the id
 * of the Fire Rescue game of before the split ('fire-rescue'), so the blocks made on the Fire
 * Rescue page come back on the Senior page (mbot2-sim:fire-rescue:workspace). Fire Rescue Junior
 * has an id of its own ('fire-rescue-junior', ../../fire-rescue-junior/game.ts): it starts with
 * an empty workspace of its own. The Fire Rescue category was for ages 11 to 13, Junior is for 10
 * to 12 - so a student who used the Fire Rescue page may now open Junior and think the blocks
 * are gone. So when Junior opens with an empty workspace, and this browser keeps Fire Rescue
 * blocks, a message at the bottom of the screen says where they are
 * (SimulatorAppProps.emptyWorkspaceNote). It is said each time Junior is opened like that, and
 * not once Junior's workspace holds blocks of its own. (Not in the note "Build your program here
 * ..." in the workspace: on a phone that note has no room for three more sentences - they would
 * lie on Blockly's zoom buttons.)
 *
 * This only READS what the browser keeps for Fire Rescue Senior: it never changes it.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import type { ProgramJson } from '../../core/types';
import { fireRescueGame } from '../../fire-rescue/game';
import { countBlocks, isProgramJson, START_HAT_TYPE, topBlocks } from '../program-file';
import { loadJson, storageKey } from '../storage';

/** What the message says. */
export const EARLIER_BLOCKS_NOTE =
  'Did you make blocks on the Fire Rescue page before? They are on the Fire Rescue Senior page now. To use them here, press Save there, then Open here.';

/** True when a program holds a block somebody put there: anything but the yellow start block alone (a new workspace). */
export function holdsBlocks(program: ProgramJson): boolean {
  const count = countBlocks(program);
  if (count === 0) return false;
  return count > 1 || topBlocks(program)[0]?.type !== START_HAT_TYPE;
}

/** The sentence when this browser keeps blocks of Fire Rescue (Senior, the Fire Rescue page of before); else null. Never throws. */
export function earlierBlocksNote(): string | null {
  try {
    const saved = loadJson(storageKey(fireRescueGame.id, 'workspace'), isProgramJson);
    return saved !== null && holdsBlocks(saved) ? EARLIER_BLOCKS_NOTE : null;
  } catch {
    // (blocks saved in a shape the editor would not show either: nothing to say about them)
    return null;
  }
}
