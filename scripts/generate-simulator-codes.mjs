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
 *   3. adds one line per code to the list in content/simulator-codes.ts: the number of the code
 *      and its fingerprint (not the code). The numbers go on from the last one, also when lines
 *      were cancelled or deleted in between, so no number is ever given out twice.
 *      Nothing else in that file is touched - in particular not "examplesOpenToEveryone".
 *
 * Then commit and push content/simulator-codes.ts; the codes work as soon as Vercel has
 * redeployed the site.
 *
 * Options:
 *
 *   --count N       how many codes to make                                   (needed)
 *   --out FILE      the CSV file for the codes, outside the website's folder (needed)
 *   --replace       empty the list first and start again at number 1.
 *                   EVERY code handed out before stops working.
 *   --print-codes   also show the new codes on the screen (they are not shown otherwise)
 *   --list FILE     write the fingerprints to another file than content/simulator-codes.ts
 *                   (the tests use this; you do not need it)
 *   --help          show this text
 *
 * Plain Node, nothing to install. Unless you ask with --print-codes, the codes are never shown
 * on the screen, and they are never written anywhere but the CSV file.
 *
 * The fingerprint of a code is worked out by src/simulator/members/code-fingerprint.mjs - the
 * very same function the website's server uses to check a typed code, so the two cannot drift
 * apart.
 */
import { randomInt } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fingerprintOf } from '../src/simulator/members/code-fingerprint.mjs';
import { CODE_ALPHABET, CODE_EXAMPLE, CODE_LENGTH, formatCode } from '../src/simulator/members/code-format.mjs';

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

/** A new list file: the explanations for the owner, no example open to everyone, an empty list of codes. */
export function freshListFile() {
  return `/**
 * Member codes for the examples of the Fire Rescue simulator.
 *
 * Every program in the simulator's Examples window is for registered members: it opens only
 * after a member has typed a code like FIRE-7K2M-9QXD. This file decides two things:
 *
 *   1. which examples are open to everyone, without a code  (none, as long as the list is empty)
 *   2. which member codes work
 *
 * Read "Member codes for the simulator examples" in README.md first. After every change:
 * save, commit and push. The change is live once Vercel has redeployed the site.
 */

// =====================================================================================
//  1. EXAMPLES OPEN TO EVERYONE
// =====================================================================================

/**
 * The examples anyone may open WITHOUT a member code. Empty = every example needs a code.
 *
 * To open an example to everyone, write its id between the square brackets, in quotes and
 * followed by a comma. The seven ids are:
 *
 *     'hello'          Hello, mBot2                              (starter)
 *     'line-follow'    Follow the black line                     (starter)
 *     'gripper-demo'   Gripper: grab, put down, lift             (starter)
 *     'one-bucket'     Deliver one bucket                        (intermediate)
 *     'one-person'     Rescue one person                         (intermediate)
 *     'smart-bucket'   Smart bucket: any colour, any square      (advanced)
 *     'full-mission'   Full mission: 180 points on the default combination
 *                                                                (advanced, a complete solution)
 *
 * For example, to open the three starter examples:
 *
 *     export const examplesOpenToEveryone: string[] = [
 *       'hello',
 *       'line-follow',
 *       'gripper-demo',
 *     ];
 *
 * What adding an id does: every visitor sees that example as a normal card in the Examples
 * window, with its description and its "Load this example" button - no code needed. The other
 * examples stay locked. An id that is misspelt opens nothing. To lock an example again, take
 * its line out.
 */
export const examplesOpenToEveryone: string[] = [
  // (empty: every example needs a member code)
];

// =====================================================================================
//  2. THE MEMBER CODES
// =====================================================================================

/**
 * The list of the codes that work.
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
 * Deleting the line works too. Once the site has been redeployed, that code opens nothing any
 * more, and a browser that had it saved locks the examples again on its next visit. Take the
 * two slashes away and the code works again.
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
 * Read what matters from a list file: the fingerprints on the list (cancelled lines included),
 * the number the next code gets, and where the lines of the list begin and end. Gives null
 * when the text does not look like a list file.
 */
export function readListFile(text) {
  const start = text.indexOf(LIST_START);
  const end = start < 0 ? -1 : text.indexOf(`\n${LIST_END}`, start);
  const next = NEXT_NUMBER.exec(text);
  if (start < 0 || end < 0 || !next) return null;
  const from = start + LIST_START.length;
  const fingerprints = new Set();
  let highest = 0;
  let active = 0;
  // (only the lines between "[" and "];" count - not the example in the explanation above them)
  for (const match of text.slice(from, end).matchAll(ENTRY)) {
    highest = Math.max(highest, Number(match[1]));
    fingerprints.add(match[2]);
    if (!match[0].trimStart().startsWith('//')) active++;
  }
  return {
    fingerprints,
    /** lines that are not cancelled */
    active,
    nextNumber: Math.max(Number(next[1]), highest + 1),
    /** position right after the opening "[" of the list */
    listFrom: from,
    /** position of the line break in front of the closing "];" */
    listTo: end,
  };
}

/** The text of a list file with its list emptied and its numbering started again at 1. Nothing else changes. */
export function emptyListFile(text) {
  const info = readListFile(text);
  if (!info) throw new Error('not a list file');
  return `${text.slice(0, info.listFrom)}${text.slice(info.listTo)}`.replace(NEXT_NUMBER, 'export const nextSimulatorCodeNumber = 1;');
}

/** The text of a list file with the new lines added at the end of the list. Nothing else changes. */
export function addToListFile(text, entries) {
  const info = readListFile(text);
  if (!info) throw new Error('not a list file');
  const lines = entries.map((entry) => entryLine(entry.no, entry.fingerprint)).join('\n');
  const after = entries.length > 0 ? entries[entries.length - 1].no + 1 : info.nextNumber;
  const withLines = entries.length > 0 ? `${text.slice(0, info.listTo)}\n${lines}${text.slice(info.listTo)}` : text;
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
 * on the list (or was drawn twice), and the made-up code that the website shows as an example
 * of what a code looks like, are drawn again - it practically never happens, but it must not.
 */
async function makeCodes(count, firstNumber, taken, onProgress) {
  const made = [];
  const seen = new Set(taken);
  while (made.length < count) {
    // four at a time: the fingerprints are slow on purpose, and Node works on four in parallel
    const batch = Array.from({ length: Math.min(4, count - made.length) }, drawCode);
    const fingerprints = await Promise.all(batch.map((characters) => fingerprintOf(characters)));
    batch.forEach((characters, i) => {
      if (seen.has(fingerprints[i]) || formatCode(characters) === CODE_EXAMPLE) return;
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
  const options = { count: null, out: null, replace: false, printCodes: false, list: DEFAULT_LIST, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Refusal(`${arg} needs a value after it.`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--replace') options.replace = true;
    else if (arg === '--print-codes') options.printCodes = true;
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

/** The real path of a folder: links followed and, where the system does not tell capitals apart, in its real spelling. */
function realFolder(folder) {
  return (realpathSync.native ?? realpathSync)(folder);
}

/** The real place of a file that may not exist yet: its folder's real path plus its name. */
function realPlace(file) {
  const absolute = path.resolve(file);
  const folder = path.dirname(absolute);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Refusal(`The folder ${folder} does not exist. Make it first, or choose another place for the CSV file.`);
  return path.join(realFolder(folder), path.basename(absolute));
}

/** True when something has this name already - a file, a folder, or a link (also one that leads nowhere, or into the website's folder). */
function nameIsTaken(file) {
  try {
    lstatSync(file);
    return true;
  } catch {
    return false;
  }
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
    '  --count N       how many codes to make',
    '  --out FILE      the CSV file for the codes (No, Code, Given to). It must be OUTSIDE the',
    "                  website's folder, and it must not exist yet.",
    '  --replace       empty the list first and start again at number 1.',
    '                  EVERY code handed out before stops working.',
    '  --print-codes   also show the new codes on the screen (they are not shown otherwise)',
    '',
    'The fingerprints of the new codes are added to content/simulator-codes.ts; nothing else in',
    'that file is changed. See "Member codes for the simulator examples" in README.md.',
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
  if (isInside(realFolder(REPO_ROOT), out)) {
    throw new Refusal(
      `Refused: ${out} is inside the website's folder (${REPO_ROOT}).\n` +
        'The codes must never end up in the repository - it is public. Choose a place outside it, for example\n' +
        '  --out ~/Documents/makex-simulator-codes.csv',
    );
  }
  // (a link counts as "exists" wherever it leads: the codes are only ever written to a new file of their own)
  if (nameIsTaken(out)) throw new Refusal(`Refused: ${out} already exists. Choose another name, so that the codes in that file are not lost.`);

  // ---- the list as it is now
  const listName = path.relative(REPO_ROOT, options.list).startsWith('..') ? options.list : path.relative(REPO_ROOT, options.list);
  const current = existsSync(options.list) ? readFileSync(options.list, 'utf8') : freshListFile();
  if (!readListFile(current)) {
    throw new Refusal(
      `${listName} does not look like the list this script writes, so nothing was changed.\n` +
        'Undo the last edit of that file (git can do that). Or, to start over, delete the file and run this script again -\n' +
        'but then every code handed out before stops working, and the examples you opened to everyone are locked again.',
    );
  }
  // (--replace empties the list of codes only: the rest of the file, "examplesOpenToEveryone" included, stays as it is)
  const before = options.replace ? emptyListFile(current) : current;
  const info = readListFile(before);

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
  if (options.printCodes) {
    print('');
    print('  No    Code');
    for (const code of codes) print(`  ${String(code.no).padEnd(5)} ${code.code}`);
  }
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
