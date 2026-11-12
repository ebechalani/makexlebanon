#!/usr/bin/env node
/**
 * Makes new codes for the examples of the Fire Rescue simulator: member codes, or - with
 * --advanced - advanced codes.
 *
 *   node scripts/generate-simulator-codes.mjs --count 500 --out ~/Documents/makex-simulator-codes.csv
 *   node scripts/generate-simulator-codes.mjs --advanced --count 10 --out ~/Documents/makex-advanced-codes.csv
 *
 * The two kinds of code look alike (FIRE-XXXX-XXXX). What tells them apart is the list their
 * fingerprint is on in content/simulator-codes.ts: a member code opens the examples for
 * members, an advanced code opens every example (see the top of that file).
 *
 * What it does:
 *
 *   1. draws the codes at random (FIRE-XXXX-XXXX, see src/simulator/members/code-format.mjs);
 *   2. writes them to the CSV file named after --out, with the columns No, Code, Given to.
 *      That file is the ONLY place where the codes exist. It must be outside the website's
 *      folder - the script refuses anything else - and it never overwrites a file.
 *      Member codes are numbered 1, 2, 3 ...; advanced codes A1, A2, A3 ..., so that the two
 *      files cannot be mixed up;
 *   3. adds one line per code to ONE list in content/simulator-codes.ts - "simulatorCodes", or
 *      with --advanced "advancedSimulatorCodes": the number of the code and its fingerprint
 *      (not the code). The numbers go on from the last one of that list, also when lines were
 *      cancelled or deleted in between, so no number is ever given out twice.
 *      Nothing else in that file is touched - not the other list of codes, not
 *      "examplesOpenToEveryone", not "examplesForAdvancedCodesOnly".
 *
 * Then commit and push content/simulator-codes.ts; the codes work as soon as Vercel has
 * redeployed the site.
 *
 * Options:
 *
 *   --count N       how many codes to make                                   (needed)
 *   --out FILE      the CSV file for the codes, outside the website's folder (needed)
 *   --advanced      make advanced codes (without it: member codes)
 *   --replace       empty the list first and start again at number 1 - the list of member
 *                   codes, or with --advanced the list of advanced codes. The other list is
 *                   not touched. EVERY code of that kind handed out before stops working.
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
 * apart. A new code whose fingerprint is already on either list is thrown away and drawn again.
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

/**
 * The two lists of content/simulator-codes.ts.
 *
 *   member     "simulatorCodes"           numbers 1, 2, 3 ...
 *   advanced   "advancedSimulatorCodes"   numbers A1, A2, A3 ... in the CSV file
 */
const LISTS = {
  member: {
    start: 'export const simulatorCodes: { no: number; fingerprint: string }[] = [',
    nextName: 'nextSimulatorCodeNumber',
    next: /^export const nextSimulatorCodeNumber = (\d+);[ \t]*$/m,
    /** what stands in front of a number in the CSV file */
    prefix: '',
    name: 'member',
  },
  advanced: {
    start: 'export const advancedSimulatorCodes: { no: number; fingerprint: string }[] = [',
    nextName: 'nextAdvancedSimulatorCodeNumber',
    next: /^export const nextAdvancedSimulatorCodeNumber = (\d+);[ \t]*$/m,
    prefix: 'A',
    name: 'advanced',
  },
};
const LIST_END = '];';
/** One line of a list, cancelled ("// ...") or not. */
const ENTRY = /^[ \t]*(?:\/\/[ \t]*)?\{[ \t]*no:[ \t]*(\d+)[ \t]*,[ \t]*fingerprint:[ \t]*'([0-9a-f]+)'[ \t]*\}[ \t]*,?/gm;
/** The line that closes a list: "];" - also with a blank in front of it, or without its ";" (both still build). */
const LIST_CLOSE = /^[ \t]*\][ \t]*;?[ \t]*(?:\/\/.*)?$/;
/** What may stand on a line of a list besides its entries: nothing, or a remark ("// ..."). */
const REST_OF_LINE = /^[ \t]*(?:\/\/.*)?$/;

/**
 * Where the lines of a list end: the position of the line break in front of the line that
 * closes it. Gives -1 when the list is not closed properly.
 *
 * It reads line by line and takes NOTHING for granted: every line up to the closing one must be
 * a line of the list (a code, cancelled or not), a remark or empty. So a list whose "];" was
 * damaged by a slip while editing is never read on into what comes after it - the next list of
 * codes, for one. (If it were, new member codes could be written into the list of advanced
 * codes.)
 *
 * @param from  the position right after the opening "[" of the list
 */
function endOfList(text, from) {
  // the opening line holds nothing after its "["
  let lineBreak = text.indexOf('\n', from);
  if (lineBreak < 0 || !REST_OF_LINE.test(text.slice(from, lineBreak).replace(/\r$/, ''))) return -1;
  for (;;) {
    const next = text.indexOf('\n', lineBreak + 1);
    const line = text.slice(lineBreak + 1, next < 0 ? text.length : next).replace(/\r$/, '');
    if (LIST_CLOSE.test(line)) return lineBreak;
    // (a remark is looked at before the entries: "// { no: 2, ... }, // A2" is one cancelled line)
    if (!REST_OF_LINE.test(line) && !REST_OF_LINE.test(line.replace(ENTRY, ''))) return -1;
    if (next < 0) return -1;
    lineBreak = next;
  }
}

function listOf(kind) {
  const list = LISTS[kind];
  if (!list) throw new Error(`"${kind}" is not a kind of code (member or advanced).`);
  return list;
}

/**
 * One line of a list. A line of the advanced list ends with its number as the CSV file writes
 * it ("// A7"), so that it cannot be mistaken for line 7 of the member list.
 */
function entryLine(no, fingerprint, kind) {
  const list = listOf(kind);
  return `  { no: ${no}, fingerprint: '${fingerprint}' },${list.prefix === '' ? '' : ` // ${list.prefix}${no}`}`;
}

/** A new list file: the explanations for the owner, no example open to everyone, the advanced examples hidden, two empty lists of codes. */
export function freshListFile() {
  return `/**
 * Codes for the examples of the Fire Rescue simulator.
 *
 * The simulator's Examples window holds seven ready-made programs. This file decides who gets
 * which of them. The examples are in three groups, and there are two kinds of codes:
 *
 *   GROUP                         WHO SEES THE CARD            WHO CAN OPEN IT
 *   open to everyone              everybody                    everybody, without a code
 *   for members                   everybody, with a lock       a member code, or an advanced code
 *   for advanced codes only       nobody else                  an advanced code
 *
 * Both kinds of code look alike (FIRE-7K2M-9QXD) and are typed into the same field. A member
 * code opens the examples for members. An advanced code opens every example. An example of the
 * third group is hidden from everybody else: a visitor, and a member with an ordinary member
 * code, do not see its card, its title or the heading above it - nothing tells them that it
 * exists.
 *
 * The four things you decide here, in this order:
 *
 *   1. which examples are open to everyone, without a code   (none, as long as the list is empty)
 *   2. which examples only an advanced code shows            (now: the two advanced examples)
 *   3. which member codes work
 *   4. which advanced codes work                             (at the very end of the file)
 *
 * An example that is on neither list 1 nor list 2 is "for members".
 *
 * Read "Member codes for the simulator examples" in README.md first. After every change:
 * save, commit and push. The change is live once Vercel has redeployed the site.
 */

// =====================================================================================
//  1. EXAMPLES OPEN TO EVERYONE
// =====================================================================================

/**
 * The examples anyone may open WITHOUT a code. Empty = every example needs a code.
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
 * window, with its description and its "Load this example" button - no code needed. An id
 * that is misspelt opens nothing. To lock an example again, take its line out: it is then
 * "for members" - shown to everybody with a lock, opened by a code.
 *
 * Do not write an id here that is also on list 2 below. If one is on both lists, the stricter
 * rule wins: the example stays hidden.
 */
export const examplesOpenToEveryone: string[] = [
  // (empty: every example needs a code)
];

// =====================================================================================
//  2. EXAMPLES FOR ADVANCED CODES ONLY
// =====================================================================================

/**
 * The examples that ONLY an advanced code shows. Everybody else - a visitor without a code,
 * and a member with an ordinary member code - does not get to see that these examples exist:
 * no card, no title, no "Advanced" heading.
 *
 * The ids are the same seven as above. To hide an example from everybody but the holders of
 * an advanced code, write its id here. To show it to all members again (with a lock for
 * visitors), take its line out.
 *
 * Empty = nothing is hidden: an advanced code then opens exactly what a member code opens.
 *
 * Mind the spelling. An id that is misspelt here would hide nothing - the example you meant
 * would be shown to everybody. So the website refuses to be built with one: Vercel reports a
 * failed build that names the line, and the site stays as it was until the line is put right.
 */
export const examplesForAdvancedCodesOnly: string[] = [
  // the two advanced examples
  'smart-bucket',
  'full-mission',
];

// =====================================================================================
//  3. THE MEMBER CODES
// =====================================================================================

/**
 * The list of the member codes that work. A member code opens every example that is not on
 * list 2 above.
 *
 * The codes themselves are NOT in this file, and must never be: this repository is public.
 * Each line holds the number of a code and its fingerprint - a row of letters and digits that
 * is worked out from the code, and from which the code cannot be read back. The codes are in
 * the CSV file that was written when they were made (No, Code, Given to). Keep that file
 * somewhere private, outside this folder.
 *
 * TO CANCEL ONE MEMBER CODE: look up its number in your CSV file, find the line with that
 * number below (for code 37: "no: 37") and put two slashes in front of it:
 *
 *     // { no: 37, fingerprint: '...' },
 *
 * Deleting the line works too. Once the site has been redeployed, that code opens nothing any
 * more, and a browser that had it saved locks the examples again on its next visit. Take the
 * two slashes away and the code works again.
 *
 * (The advanced codes have a list of their own, at the very end of this file, with their own
 * numbers. In your CSV files an advanced code is numbered A1, A2, A3 ... and a member code
 * 1, 2, 3 ... - so "37" is always a line of THIS list, and "A37" never is.)
 *
 * TO MAKE MORE MEMBER CODES: never write lines by hand. Run
 *
 *     node scripts/generate-simulator-codes.mjs --count 50 --out ~/Documents/more-codes.csv
 *
 * It adds the new lines at the end of this list, numbered on from the last one.
 */
${LISTS.member.start}
${LIST_END}

/**
 * The number the next new member code gets. The script keeps it up to date so that a number is
 * never given out twice, even after lines were deleted. Leave it alone.
 */
export const nextSimulatorCodeNumber = 1;

// =====================================================================================
//  4. THE ADVANCED CODES
// =====================================================================================

/**
 * The list of the advanced codes that work. An advanced code opens EVERY example: the ones
 * for members, and the ones on list 2 above that nobody else gets to see.
 *
 * It works like the list of member codes: one line per code, with its number and its
 * fingerprint - never the code itself. The plain codes are in the CSV file that was written
 * when they were made. There they are numbered A1, A2, A3 ... (with an A in front), so that
 * the two files cannot be mixed up. Each line below ends with that number.
 *
 * TO CANCEL ONE ADVANCED CODE: look up its number in your CSV file - say A7. Find the line of
 * THIS list that starts with "{ no: 7," and ends with "// A7", and put two slashes in front
 * of it:
 *
 *     // { no: 7, fingerprint: '...' }, // A7
 *
 * Deleting the line works too. (Mind the list: "{ no: 7," further up, in the list of member
 * codes, is member code 7 - another code, of another person.) Once the site has been
 * redeployed, a browser that had that code saved locks the examples again on its next visit.
 *
 * TO MAKE MORE ADVANCED CODES: never write lines by hand. Run the same script with --advanced:
 *
 *     node scripts/generate-simulator-codes.mjs --advanced --count 10 --out ~/Documents/more-advanced-codes.csv
 *
 * It adds the new lines at the end of this list, numbered on from the last one.
 */
${LISTS.advanced.start}
${LIST_END}

/**
 * The number the next new advanced code gets (A1 is 1, A2 is 2 ...). The script keeps it up
 * to date so that a number is never given out twice. Leave it alone.
 */
export const nextAdvancedSimulatorCodeNumber = 1;
`;
}

/**
 * Read what matters about ONE list of a list file - the member codes, or with kind "advanced"
 * the advanced codes: the fingerprints on it (cancelled lines included), the number the next
 * code gets, and where the lines of the list begin and end. Gives null when the text does not
 * hold such a list.
 */
export function readListFile(text, kind = 'member') {
  const list = listOf(kind);
  const start = text.indexOf(list.start);
  const from = start + list.start.length;
  // (the list must be there once, and end where it should: see endOfList)
  const end = start < 0 || text.indexOf(list.start, from) >= 0 ? -1 : endOfList(text, from);
  const next = list.next.exec(text);
  if (start < 0 || end < 0 || !next) return null;
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

/** True when ONE list - its lines and its next number - is letter for letter the same in two texts of a list file (or is in neither). */
function sameLines(before, after, kind) {
  const a = readListFile(before, kind);
  const b = readListFile(after, kind);
  if (!a || !b) return !a && !b;
  return before.slice(a.listFrom, a.listTo) === after.slice(b.listFrom, b.listTo) && a.nextNumber === b.nextNumber;
}

/** The text of a list file with ONE list emptied and its numbering started again at 1. Nothing else changes - not the other list. */
export function emptyListFile(text, kind = 'member') {
  const info = readListFile(text, kind);
  if (!info) throw new Error('not a list file');
  const list = listOf(kind);
  return `${text.slice(0, info.listFrom)}${text.slice(info.listTo)}`.replace(list.next, `export const ${list.nextName} = 1;`);
}

/** The text of a list file with the new lines added at the end of ONE list. Nothing else changes. */
export function addToListFile(text, entries, kind = 'member') {
  const info = readListFile(text, kind);
  if (!info) throw new Error('not a list file');
  const list = listOf(kind);
  const lines = entries.map((entry) => entryLine(entry.no, entry.fingerprint, kind)).join('\n');
  const after = entries.length > 0 ? entries[entries.length - 1].no + 1 : info.nextNumber;
  const withLines = entries.length > 0 ? `${text.slice(0, info.listTo)}\n${lines}${text.slice(info.listTo)}` : text;
  return withLines.replace(list.next, `export const ${list.nextName} = ${after};`);
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
 * taken - it is on the list of member codes or on the list of advanced codes, or it was drawn
 * twice - and the made-up code that the website shows as an example of what a code looks like,
 * are thrown away and drawn again. It practically never happens, but it must not: a code that
 * is on both lists would be a member code and an advanced code at once.
 *
 * @param taken  the fingerprints that are on either list already
 * @param draw   gives the 8 characters of one code (the tests bring their own)
 */
export async function makeCodes(count, firstNumber, taken, onProgress = () => {}, draw = drawCode) {
  const made = [];
  const seen = new Set(taken);
  while (made.length < count) {
    // four at a time: the fingerprints are slow on purpose, and Node works on four in parallel
    const batch = Array.from({ length: Math.min(4, count - made.length) }, () => draw());
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

/** The CSV file. `prefix` stands in front of every number: nothing for member codes, "A" for advanced codes. */
function csvText(codes, prefix) {
  // (CRLF line ends: that is what Excel expects of a CSV file)
  return ['No,Code,Given to', ...codes.map((c) => `${prefix}${c.no},${c.code},`)].join('\r\n') + '\r\n';
}

// =============================================================================================
// The command line
// =============================================================================================

class Refusal extends Error {}

function parseArguments(argv) {
  const options = { count: null, out: null, advanced: false, replace: false, printCodes: false, list: DEFAULT_LIST, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new Refusal(`${arg} needs a value after it.`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--replace') options.replace = true;
    else if (arg === '--advanced') options.advanced = true;
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
    'Makes new codes for the examples of the Fire Rescue simulator: member codes, or with',
    '--advanced advanced codes.',
    '',
    '  node scripts/generate-simulator-codes.mjs --count 500 --out ~/Documents/makex-simulator-codes.csv',
    '  node scripts/generate-simulator-codes.mjs --advanced --count 10 --out ~/Documents/makex-advanced-codes.csv',
    '',
    '  --count N       how many codes to make',
    '  --out FILE      the CSV file for the codes (No, Code, Given to). It must be OUTSIDE the',
    "                  website's folder, and it must not exist yet.",
    '  --advanced      make advanced codes: they open every example, also the ones kept for',
    '                  advanced codes only. In the CSV file they are numbered A1, A2, A3 ...',
    '                  Without it: member codes, numbered 1, 2, 3 ...',
    '  --replace       empty the list first and start again at number 1: the list of member',
    '                  codes, or with --advanced the list of advanced codes (never both).',
    '                  EVERY code of that kind handed out before stops working.',
    '  --print-codes   also show the new codes on the screen (they are not shown otherwise)',
    '',
    'The fingerprints of the new codes are added to one list in content/simulator-codes.ts; nothing',
    'else in that file is changed. See "Member codes for the simulator examples" in README.md.',
  ].join('\n');
}

/**
 * @param argv   the options, as typed after the name of the script
 * @param print  shows a line on the screen (the tests bring their own)
 * @param draw   gives the 8 characters of one new code (the tests bring their own)
 */
export async function main(argv, print = console.log, draw = drawCode) {
  const options = parseArguments(argv);
  if (options.help) {
    print(usage());
    return;
  }

  // ---- what was asked for
  if (options.count === null || options.out === null) throw new Refusal(`Say how many codes and where to write them:\n\n${usage()}`);
  const count = Number(options.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) throw new Refusal(`--count must be a whole number from 1 to ${MAX_COUNT}, not "${options.count}".`);
  const kind = options.advanced ? 'advanced' : 'member';
  const list = listOf(kind);
  /** "member code" / "advanced codes" */
  const codesWord = (n) => `${list.name} code${n === 1 ? '' : 's'}`;

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

  // ---- the lists as they are now
  const listName = path.relative(REPO_ROOT, options.list).startsWith('..') ? options.list : path.relative(REPO_ROOT, options.list);
  const current = existsSync(options.list) ? readFileSync(options.list, 'utf8') : freshListFile();
  const members = readListFile(current, 'member');
  const advanced = readListFile(current, 'advanced');
  if (!members) {
    throw new Refusal(
      `${listName} does not look like the list this script writes, so nothing was changed.\n` +
        'Undo the last edit of that file (git can do that). Or, to start over, delete the file and run this script again -\n' +
        'but then every code handed out before stops working, and the examples you opened to everyone are locked again.',
    );
  }
  // (a file from before there were advanced codes has no such list, and member codes can still be made for it;
  //  a file that has one which cannot be read is damaged, whichever kind is asked for)
  if (!advanced && (kind === 'advanced' || /advancedSimulatorCodes|nextAdvancedSimulatorCodeNumber/.test(current))) {
    throw new Refusal(
      `${listName} does not look like the list this script writes: the list of advanced codes ("advancedSimulatorCodes" and\n` +
        '"nextAdvancedSimulatorCodeNumber", at the end of the file) is missing or damaged, so nothing was changed.\n' +
        'Undo the last edit of that file (git can do that).',
    );
  }
  // (--replace empties ONE list of codes: the rest of the file - the other list, "examplesOpenToEveryone",
  //  "examplesForAdvancedCodesOnly" - stays as it is)
  const before = options.replace ? emptyListFile(current, kind) : current;
  const info = readListFile(before, kind);
  if (!info) throw new Refusal(`${listName} does not look like the list this script writes, so nothing was changed.\nUndo the last edit of that file (git can do that).`);
  // a new code must not be on either list (also not as a cancelled line, and not on the list that is being emptied)
  const taken = new Set([...members.fingerprints, ...(advanced ? advanced.fingerprints : [])]);

  // ---- the new codes
  print(`Making ${count} ${codesWord(count)} ...`);
  let shown = 0;
  const codes = await makeCodes(
    count,
    info.nextNumber,
    taken,
    (done) => {
      if (count >= 100 && done - shown >= 100 && done < count) {
        shown = done;
        print(`  ${done} of ${count}`);
      }
    },
    draw,
  );

  // ---- the new text of the list file - checked once more before anything is written: the new
  //      lines are in the list they were made for, and the OTHER list is exactly as it was
  const after = addToListFile(before, codes, kind);
  const other = kind === 'advanced' ? 'member' : 'advanced';
  const mine = readListFile(after, kind);
  const sameOtherList = sameLines(current, after, other);
  if (!mine || !codes.every((code) => mine.fingerprints.has(code.fingerprint)) || mine.active !== info.active + count || !sameOtherList) {
    throw new Refusal(
      `Stopped: the new ${codesWord(count)} would not have ended up in the right list of ${listName}, so nothing was changed\n` +
        'and no CSV file was written. The file is damaged: undo the last edit of that file (git can do that).',
    );
  }

  // ---- write: first the codes (if that fails, the list is untouched), then the list
  writeFileSync(out, csvText(codes, list.prefix), { flag: 'wx', mode: 0o600 });
  try {
    const temporary = `${options.list}.new`;
    writeFileSync(temporary, after);
    renameSync(temporary, options.list);
  } catch (error) {
    rmSync(out, { force: true });
    throw new Refusal(`${listName} could not be written (${error instanceof Error ? error.message : String(error)}). Nothing was changed, and the CSV file was removed again.`);
  }

  const first = `${list.prefix}${codes[0].no}`;
  const last = `${list.prefix}${codes[codes.length - 1].no}`;
  print('');
  print(`Done: ${count} new ${codesWord(count)}, number${count === 1 ? ` ${first}` : `s ${first} to ${last}`}.`);
  print(
    kind === 'advanced'
      ? '      An advanced code opens every example - also the ones kept for advanced codes only.'
      : '      A member code opens the examples for members (not the ones kept for advanced codes only).',
  );
  print('');
  print(`  The codes:         ${out}`);
  print('                     Keep this file private. It is the only place where the codes are.');
  print(`  The fingerprints:  ${listName}  (${info.active + count} ${codesWord(info.active + count)} on the list now)`);
  if (options.replace) print(`                     The list of ${list.name} codes was started again: ${list.name} codes handed out before no longer work.`);
  if (options.printCodes) {
    print('');
    print('  No    Code');
    for (const code of codes) print(`  ${`${list.prefix}${code.no}`.padEnd(5)} ${code.code}`);
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
