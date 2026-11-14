/**
 * The program file a student saves to the computer and opens again later (a small .json file),
 * and the "blank" program a new workspace starts with.
 *
 * Plain TypeScript (no DOM, no Blockly), so it can be unit-tested under Node.
 */
import { getBlockDef, getCategory, type CategoryId } from '../blocks/catalog';
import { paletteCategories } from '../blocks/palettes';
import type { BlockJson, ProgramJson } from '../core/types';
import { blockRole } from '../vm';
import { isRecord } from './storage';

export const PROGRAM_FILE_FORMAT = 'mbot2-simulator-program';
export const PROGRAM_FILE_VERSION = 1;

export interface ProgramFile {
  format: typeof PROGRAM_FILE_FORMAT;
  version: number;
  /** id of the game the program was written for, e.g. 'fire-rescue' */
  game: string;
  /** when it was saved (ISO date) */
  savedAt: string;
  /** the blocks, exactly as Blockly.serialization.workspaces.save() wrote them */
  program: ProgramJson;
}

/** True when the value looks like a Blockly workspace: an object whose "blocks" (if any) is a block list. */
export function isProgramJson(value: unknown): value is ProgramJson {
  if (!isRecord(value)) return false;
  if ('variables' in value && value.variables !== undefined && !Array.isArray(value.variables)) return false;
  if (!('blocks' in value) || value.blocks === undefined) return true;
  if (!isRecord(value.blocks)) return false;
  const list = value.blocks.blocks;
  return list === undefined || (Array.isArray(list) && list.every((b) => isRecord(b) && typeof b.type === 'string'));
}

export function serializeProgramFile(gameId: string, program: ProgramJson, now: Date = new Date()): string {
  const file: ProgramFile = {
    format: PROGRAM_FILE_FORMAT,
    version: PROGRAM_FILE_VERSION,
    game: gameId,
    savedAt: now.toISOString(),
    program,
  };
  return JSON.stringify(file, null, 2);
}

export type ParsedProgramFile = { ok: true; program: ProgramJson; game: string | null } | { ok: false; error: string };

/**
 * Read a program file. Accepts our own file format and also a bare Blockly workspace JSON
 * (for example a program copied out of another tool).
 */
export function parseProgramFile(text: string): ParsedProgramFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a program file (it is not valid JSON).' };
  }
  if (isRecord(value) && value.format === PROGRAM_FILE_FORMAT) {
    if (!isProgramJson(value.program)) return { ok: false, error: 'This program file is damaged: the blocks are missing.' };
    return { ok: true, program: value.program, game: typeof value.game === 'string' ? value.game : null };
  }
  if (isRecord(value) && 'blocks' in value && isProgramJson(value)) return { ok: true, program: value, game: null };
  return { ok: false, error: 'This file does not contain an mBot2 simulator program.' };
}

/** Number of top-level stacks (scripts and loose blocks) in a program. */
export function topBlocks(program: ProgramJson): BlockJson[] {
  return program.blocks?.blocks ?? [];
}

/** Count every block of a program, including the ones inside slots (but not the white "shadow" bubbles). */
export function countBlocks(program: ProgramJson): number {
  const walk = (block: BlockJson | undefined): number => {
    if (!block) return 0;
    let n = 1;
    for (const slot of Object.values(block.inputs ?? {})) n += walk(slot.block);
    n += walk(block.next?.block);
    return n;
  };
  return topBlocks(program).reduce((sum, b) => sum + walk(b), 0);
}

/**
 * True when at least one script could ever run: the program has a hat block ("when CyberPi
 * starts up", "when button A pressed" ...). The interpreter is asked which blocks are hats, so
 * this always agrees with what really runs.
 */
export function hasHatBlock(program: ProgramJson): boolean {
  return topBlocks(program).some((b) => blockRole(b.type) === 'hat');
}

/**
 * True when pressing Start can make something happen: at least one hat block has a block
 * snapped under it. (A hat alone - the blank program - starts and ends in the same moment.)
 */
export function hasRunnableScript(program: ProgramJson): boolean {
  return topBlocks(program).some((b) => blockRole(b.type) === 'hat' && b.next?.block !== undefined);
}

/** Name of the "when CyberPi starts up" hat. */
export const START_HAT_TYPE = 'event_cyberpi_start';

/** The program a brand-new workspace shows: just the yellow start block, ready for blocks to be snapped below. */
export function blankProgram(): ProgramJson {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: START_HAT_TYPE, id: 'start-hat', x: 40, y: 40 }],
    },
    variables: [],
  };
}

/** A safe file name for the download: "fire-rescue-program-2027-03-14.json". */
export function programFileName(gameId: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `${gameId.replace(/[^a-z0-9-]+/gi, '-')}-program-${day}.json`;
}

// =============================================================================================
// A program that was made in another game
// =============================================================================================
// Every game has its own block palette (../blocks/palettes.ts): Fire Rescue has the Servos and
// the Gripper, Fire Chief the DC motors and the flame sensor. A program file made in one game
// opens in the other - every block of the simulator is known to every editor and to the
// interpreter - but a block for a part this robot does not have does not work when it runs: a
// Gripper block does nothing, a flame sensor block always reads "no flame", a DC motor block
// drives a port with nothing on it. The student has to be told, in plain words, at the moment
// the file is opened.

/** The blocks of a program that this game's palette does not offer. */
export interface ForeignBlocks {
  /** how many such blocks the program holds */
  count: number;
  /** the names of the palette groups they come from, as the other game shows them: "Gripper", "Servos" */
  groups: string[];
}

/** Every block of a program, the ones inside slots and inside C-shaped blocks included (white bubbles too). */
function eachBlock(program: ProgramJson, visit: (block: BlockJson) => void): void {
  const walk = (block: BlockJson | undefined): void => {
    if (!block || typeof block.type !== 'string') return;
    visit(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      walk(slot?.block);
      walk(slot?.shadow);
    }
    walk(block.next?.block);
  };
  for (const top of topBlocks(program)) walk(top);
}

/**
 * Which blocks of `program` belong to a part the robot of game `gameId` does not have: blocks of
 * the simulator's catalog whose palette group is not in this game's palette. (Blocks that are
 * not in the catalog at all - Blockly's own number and text bubbles, My Blocks - are in every
 * game.)
 */
export function foreignBlocks(program: ProgramJson, gameId: string): ForeignBlocks {
  const own = new Set<CategoryId>(paletteCategories(gameId));
  const groups: CategoryId[] = [];
  let count = 0;
  eachBlock(program, (block) => {
    const def = getBlockDef(block.type);
    if (!def || own.has(def.category)) return;
    count++;
    if (!groups.includes(def.category)) groups.push(def.category);
  });
  return { count, groups: groups.map((id) => getCategory(id).name) };
}

/** "fire-rescue" -> "Fire Rescue": the name of a game as far as its id tells it. */
export function gameNameFromId(gameId: string): string {
  return gameId
    .split(/[^a-z0-9]+/i)
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * What to tell the student about a program that was just opened, when it comes from another
 * game or holds blocks this game does not have. Null when there is nothing to say.
 *
 * `fileGame` is the game written in the file (null for a bare Blockly file), `gameId` the game
 * on the screen.
 */
export function otherGameNote(program: ProgramJson, fileGame: string | null, gameId: string): string | null {
  const foreign = foreignBlocks(program, gameId);
  const from = fileGame !== null && fileGame !== gameId && gameNameFromId(fileGame) !== '' ? `This program was saved in the ${gameNameFromId(fileGame)} simulator. ` : '';
  if (foreign.count === 0) return from === '' ? null : `${from}All its blocks work here too.`;
  const one = foreign.count === 1;
  return (
    `${from}${foreign.count} of its blocks ${one ? 'is' : 'are'} for parts this robot does not have ` +
    `(${foreign.groups.join(', ')}): ${one ? 'it does' : 'they do'} not work here.`
  );
}
