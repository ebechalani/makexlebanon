#!/usr/bin/env node
/**
 * Makes new member codes for the Fire Rescue simulator.
 *
 *   node scripts/generate-simulator-codes.mjs --count 500 --out ~/Documents/makex-simulator-codes.csv
 *
 * What it does:
 *
 *   1. draws the codes at random (FIRE-XXXX-XXXX, see src/simulator/members/code-format.mjs);
 *   2. writes them to the CSV file named after --out, with the columns No, Code, Given to.
 *      That file is the ONLY place where the codes exist. It must be outside the website's
 *      folder - the script refuses anything else - and it never overwrites a file;
 *   3. adds one line per code to content/simulator-codes.ts: the number of the code and its
 *      fingerprint (not the code). The numbers go on from the last one, also when lines were
 *      cancelled or deleted in between, so no number is ever given out twice.
 *
 * Then commit and push content/simulator-codes.ts; the codes work as soon as Vercel has
 * redeployed the site.
 *
 * Options:
 *
 *   --count N     how many codes to make                                   (needed)
 *   --out FILE    the CSV file for the codes, outside the website's folder (needed)
 *   --replace     throw the current list away and start again at number 1.
 *                 EVERY code handed out before stops working.
 *   --list FILE   write the fingerprints to another file than content/simulator-codes.ts
 *                 (the tests use this; you do not need it)
 *   --help        show this text
 *
 * Plain Node, nothing to install. The codes are never printed on the screen and never written
 * anywhere but the CSV file.
 */
import { randomInt } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fingerprintOf } from '../src/simulator/members/code-fingerprint.mjs';
import { CODE_ALPHABET, CODE_LENGTH, formatCode } from '../src/simulator/members/code-format.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LIST = path.join(REPO_ROOT, 'content', 'simulator-codes.ts');

/** More than this in one go is a typing mistake. */
const MAX_COUNT = 5000;

// =============================================================================================
// The list file (content/simulator-codes.ts)
// =============================================================================================

const LIST_START = 'export const simulatorCodes: { no: number; fingerprint: string }[] = [';
const LIST_END = '];';
const NEXT_NUMBER = /^export const nextSimulatorCodeNumber = (\d+);[ \t]*$/m;
/** One line of the list, cancelled ("// ...") or not. */
const ENTRY = /^[ \t]*(?:\/\/[ \t]*)?\{[ \t]*no:[ \t]*(\d+)[ \t]*,[ \t]*fingerprint:[ \t]*'([0-9a-f]+)'[ \t]*\}[ \t]*,?/gm;

function entryLine(no, fingerprint) {
  return `  { no: ${no}, fingerprint: '${fingerprint}' },`;
}

/** A new, empty list file: the explanation for the owner, the list and the next number. */
export function freshListFile() {
  return `/**
 * Member codes for the Fire Rescue simulator.
 *
 * The Intermediate and Advanced examples of the simulator open only with a member code
 * (FIRE-XXXX-XXXX). This file is the list of the codes that work. Read "Member codes for the
 * simulator examples" in README.md first.
 *
 * The codes themselves are NOT in this file, and must never be: this repository is public.
 * Each line holds the number of a code and its fingerprint - a row of letters and digits that
 * is worked out from the code, and from which the code cannot be read back. The codes are in
 * the CSV file that was written when they were made (No, Code, Given to). Keep that file
 * somewhere private, outside this folder.
 *
 * TO CANCEL ONE CODE: look up its number in your CSV file, find the line with that number
 * below (for code 37: "no: 37") and put two slashes in front of it:
 *
 *     // { no: 37, fingerprint: '...' },
 *
 * Deleting the line works too. Save, commit and push. Once Vercel has redeployed the site,
 * that code opens nothing any more, and a browser that had it saved locks the examples again
 * on its next visit. Take the two slashes away and the code works again.
 *
 * TO MAKE MORE CODES: never write lines by hand. Run
 *
 *     node scripts/generate-simulator-codes.mjs --count 50 --out ~/Documents/more-codes.csv
 *
 * It adds the new lines at the end, numbered on from the last one.
 */

${LIST_START}
${LIST_END}

/**
 * The number the next new code gets. The script keeps it up to date so that a number is never
 * given out twice, even after lines were deleted. Leave it alone.
 */
export const nextSimulatorCodeNumber = 1;
`;
}

/**
 * Read what matters from a list file: the fingerprints on it (cancelled lines included), the
 * number the next code gets, and where new lines go.
 */
export function readListFile(text) {
  const start = text.indexOf(LIST_START);
  const end = start < 0 ? -1 : text.indexOf(`\n${LIST_END}`, start);
  const next = NEXT_NUMBER.exec(text);
  if (start < 0 || end < 0 || !next) return null;
  const fingerprints = new Set();
  let highest = 0;
  let active = 0;
  for (const match of text.matchAll(ENTRY)) {
    highest = Math.max(highest, Number(match[1]));
    fingerprints.add(match[2]);
    if (!match[0].trimStart().startsWith('//')) active++;
  }
  return {
    fingerprints,
    active,
    nextNumber: Math.max(Number(next[1]), highest + 1),
    /** position of the line break in front of the closing "];" */
    insertAt: end,
  };
}

/** The text of the list file with the new lines added at the end of the list. */
export function addToListFile(text, entries) {
  const info = readListFile(text);
  if (!info) throw new Error('not a list file');
  const lines = entries.map((entry) => entryLine(entry.no, entry.fingerprint)).join('\n');
  const after = entries.length > 0 ? entries[entries.length - 1].no + 1 : info.nextNumber;
  const withLines = entries.length > 0 ? `${text.slice(0, info.insertAt)}\n${lines}${text.slice(info.insertAt)}` : text;
  return withLines.replace(NEXT_NUMBER, `export const nextSimulatorCodeNumber = ${after};`);
}

// =============================================================================================
// The codes
// =============================================================================================

/** Eight characters drawn at random with the system's secure random numbers. */
function drawCode() {
  let characters = '';
  for (let i = 0; i < CODE_LENGTH; i++) characters += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return characters;
}

/**
 * Draw `count` new codes and work out their fingerprints. A code whose fingerprint is already
 * on the list (or was drawn twice) is drawn again - it practically never happens, but it must not.
 */
async function makeCodes(count, firstNumber, taken, onProgress) {
  const made = [];
  const seen = new Set(taken);
  while (made.length < count) {
    // four at a time: the fingerprints are slow on purpose, and Node works on four in parallel
    const batch = Array.from({ length: Math.min(4, count - made.length) }, drawCode);
    const fingerprints = await Promise.all(batch.map((characters) => fingerprintOf(characters)));
    batch.forEach((characters, i) => {
      if (seen.has(fingerprints[i])) return;
      seen.add(fingerprints[i]);
      made.push({ no: firstNumber + made.length, code: formatCode(characters), fingerprint: fingerprints[i] });
    });
    onProgress(made.length);
  }
  return made;
}

function csvText(codes) {
  // (CRLF line ends: that is what Excel expects of a CSV file)
  return ['No,Code,Given to', ...codes.map((c) => `${c.no},${c.code},`)].join('\r\n') + '\r\n';
}

// =============================================================================================
// The command line
// =============================================================================================

class Refusal extends Error {}

function parseArguments(argv) {
  const options = { count: null, out: null, replace: false, list: DEFAULT_LIST, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Refusal(`${arg} needs a value after it.`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--replace') options.replace = true;
    else if (arg === '--count') options.count = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--list') options.list = path.resolve(value());
    else throw new Refusal(`"${arg}" is not an option of this script. Try --help.`);
  }
  return options;
}

function expandHome(file) {
  return file === '~' || file.startsWith('~/') || file.startsWith('~\\') ? path.join(homedir(), file.slice(1)) : file;
}

/** The real place of a file that may not exist yet: its folder's real path (links followed) plus its name. */
function realPlace(file) {
  const absolute = path.resolve(file);
  const folder = path.dirname(absolute);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Refusal(`The folder ${folder} does not exist. Make it first, or choose another place for the CSV file.`);
  return path.join(realpathSync(folder), path.basename(absolute));
}

function isInside(folder, file) {
  const relative = path.relative(folder, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function usage() {
  return [
    'Makes new member codes for the Fire Rescue simulator.',
    '',
    '  node scripts/generate-simulator-codes.mjs --count 500 --out ~/Documents/makex-simulator-codes.csv',
    '',
    '  --count N     how many codes to make',
    '  --out FILE    the CSV file for the codes (No, Code, Given to). It must be OUTSIDE the',
    "                website's folder, and it must not exist yet.",
    '  --replace     throw the current list away and start again at number 1.',
    '                EVERY code handed out before stops working.',
    '',
    'The fingerprints of the new codes are added to content/simulator-codes.ts.',
    'See "Member codes for the simulator examples" in README.md.',
  ].join('\n');
}

export async function main(argv, print = console.log) {
  const options = parseArguments(argv);
  if (options.help) {
    print(usage());
    return;
  }

  // ---- what was asked for
  if (options.count === null || options.out === null) throw new Refusal(`Say how many codes and where to write them:\n\n${usage()}`);
  const count = Number(options.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw new Refusal(`--count must be a whole number from 1 to ${MAX_COUNT}, not "${options.count}".`);

  // ---- the CSV file: outside the website's folder, and not there yet
  const out = realPlace(expandHome(options.out));
  if (isInside(realpathSync(REPO_ROOT), out)) {
    throw new Refusal(
      `Refused: ${out} is inside the website's folder (${REPO_ROOT}).\n` +
        'The codes must never end up in the repository - it is public. Choose a place outside it, for example\n' +
        '  --out ~/Documents/makex-simulator-codes.csv',
    );
  }
  if (existsSync(out)) throw new Refusal(`Refused: ${out} already exists. Choose another name, so that the codes in that file are not lost.`);

  // ---- the list as it is now
  const listName = path.relative(REPO_ROOT, options.list).startsWith('..') ? options.list : path.relative(REPO_ROOT, options.list);
  const fresh = options.replace || !existsSync(options.list);
  const before = fresh ? freshListFile() : readFileSync(options.list, 'utf8');
  const info = readListFile(before);
  if (!info) {
    throw new Refusal(
      `${listName} does not look like the list this script writes, so nothing was changed.\n` +
        'Undo the last edit of that file (git can do that), or start a new list with --replace - but then every code handed out before stops working.',
    );
  }

  // ---- the new codes
  print(`Making ${count} code${count === 1 ? '' : 's'} ...`);
  let shown = 0;
  const codes = await makeCodes(count, info.nextNumber, info.fingerprints, (done) => {
    if (count >= 100 && done - shown >= 100 && done < count) {
      shown = done;
      print(`  ${done} of ${count}`);
    }
  });

  // ---- write: first the codes (if that fails, the list is untouched), then the list
  writeFileSync(out, csvText(codes), { flag: 'wx', mode: 0o600 });
  try {
    const temporary = `${options.list}.new`;
    writeFileSync(temporary, addToListFile(before, codes));
    renameSync(temporary, options.list);
  } catch (error) {
    rmSync(out, { force: true });
    throw new Refusal(`${listName} could not be written (${error instanceof Error ? error.message : String(error)}). Nothing was changed, and the CSV file was removed again.`);
  }

  const first = codes[0].no;
  const last = codes[codes.length - 1].no;
  print('');
  print(`Done: ${count} new member code${count === 1 ? '' : 's'}, number${count === 1 ? ` ${first}` : `s ${first} to ${last}`}.`);
  print('');
  print(`  The codes:         ${out}`);
  print('                     Keep this file private. It is the only place where the codes are.');
  print(`  The fingerprints:  ${listName}  (${info.active + count} code${info.active + count === 1 ? '' : 's'} on the list now)`);
  if (options.replace) print('                     The list was started again: codes handed out before no longer work.');
  print('');
  print(`Next: commit and push ${listName}. The new codes work once Vercel has redeployed the site.`);
}

// Run only when started from the command line (the tests import this file).
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Refusal ? error.message : error);
    process.exitCode = 1;
  });
}
