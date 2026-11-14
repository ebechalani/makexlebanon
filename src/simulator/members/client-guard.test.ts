/**
 * The guard on the examples: nothing a visitor's browser gets may contain an example program,
 * the text that explains one - or so much as the title of one.
 *
 * Every game of the simulator has examples of its own: Fire Rescue and Fire Chief. The programs
 * and descriptions (samples.ts in ../fire-rescue and in ../fire-chief) and the lists of the
 * titles (sample-catalog.ts, next to them) stay on the server. They leave it only through
 * /api/simulator/unlock, which decides for every request what that visitor may see: an example
 * the owner keeps for advanced codes only must not show anywhere - not even its title, not
 * even the heading of its level - before an advanced code was checked. If a file of the
 * simulator screen - or any page of the website - started to import one of those files, or to
 * hold a title itself, the build would quietly put it into what everybody downloads. This test
 * reads the source files, follows every import, and fails when that could happen. It names the
 * chain of files, so the import to take out is easy to find.
 *
 * What it treats as "holding programs, descriptions or titles":
 *   - the files listed in HOLDERS below;
 *   - any file (that is not a test) which imports the program builder, vm/builder.ts: that is
 *     how an example program is written, so a new file of examples is caught without being
 *     listed here;
 *   - any file (that is not a test) in which the title or the id of an example is written,
 *     anywhere, even in a comment: so a list of titles copied into a file of the screen by
 *     hand is caught as well. That goes for files that are not code too - a .json file of
 *     cards, a stylesheet - and for a title written in small letters, broken over two lines or
 *     spelt with escapes or with a page's own signs for a blank ("&nbsp;"). The examples of ALL
 *     games are looked for in ALL files: the screen of one game must not hold a title of
 *     another game either;
 *   - any such file in which a sentence of the DESCRIPTION of an example is written: the text
 *     that explains a locked example is as much the example as its title.
 *
 * "Not a test" means: a file named *.test.* that nothing of the browser imports. The name
 * alone protects nothing - a file of the screen can import "titles.test.ts" like any other
 * file, and the build would pack it - so a test file that the browser's code reaches is looked
 * at like every other file.
 *
 * What it cannot see (so this still needs the eyes of whoever reviews a change): a program
 * pasted as plain data without its texts, a sentence that only hints at an example ("six
 * examples, one of them for the best teams"), and the bare word "Advanced" on a page outside
 * the simulator - the website itself uses that word.
 *
 * Where it starts from ("what the browser gets"):
 *   - every file that begins with 'use client', and everything those import;
 *   - every page, layout and component of the website, and every other address of it (all of
 *     src/app except the one route that hands out the examples, src/components, src/pages,
 *     and the files directly in src): what such a file imports can end up in what it sends.
 *
 * It also looks at what is served as it is: no file in public/ may name an example, in its
 * name or in its text, and neither may the configuration files of the website.
 *
 * And one thing more: the files of the simulator that the browser gets must not name a level
 * of the examples ("advanced") or hold one of the headings - of either game. The headings come
 * from the server together with the cards, so that a heading without a visible card never
 * reaches a browser.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { EXAMPLE_LEVELS as CHIEF_LEVELS, SAMPLE_CATALOG as CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { EXAMPLE_LEVELS as RESCUE_LEVELS, SAMPLE_CATALOG as RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { ALL_GAMES } from './all-examples';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The list of the examples of Fire Rescue: their ids, titles and levels, and the headings of the levels. */
const CATALOG = 'src/simulator/fire-rescue/sample-catalog.ts';
/** The same list for Fire Chief. */
const CHIEF_CATALOG_FILE = 'src/simulator/fire-chief/sample-catalog.ts';
/** The list of every game, with the number of examples it holds. */
const CATALOGS: ReadonlyArray<{ file: string; samples: string; game: string; examples: number }> = [
  { file: CATALOG, samples: 'src/simulator/fire-rescue/samples.ts', game: 'Fire Rescue', examples: 7 },
  { file: CHIEF_CATALOG_FILE, samples: 'src/simulator/fire-chief/samples.ts', game: 'Fire Chief', examples: 6 },
];

/** The cards of every game: what the titles and the ids are taken from. */
const SAMPLE_CATALOG = [...RESCUE_CATALOG, ...CHIEF_CATALOG];
/**
 * The headings of every game. (Both games call their levels the same - Starter, Intermediate,
 * Advanced - but the few words after a heading are a game's own, and all six are looked for.)
 */
const EXAMPLE_LEVELS = [...RESCUE_LEVELS, ...CHIEF_LEVELS];

/** The files that hold the examples (paths from the repository's folder), and what they hold. */
const HOLDERS: Record<string, string> = {
  'src/simulator/fire-rescue/samples.ts': 'holds example programs and descriptions',
  'src/simulator/fire-chief/samples.ts': 'holds example programs and descriptions',
  'src/simulator/members/all-examples.ts': 'holds example programs and descriptions',
  [CATALOG]: 'holds the titles of the examples',
  [CHIEF_CATALOG_FILE]: 'holds the titles of the examples',
};

/** Files that belong to the server for other reasons: the lists of codes and the code that checks one. */
const SERVER_ONLY = [
  'content/simulator-codes.ts',
  'src/simulator/members/unlock.ts',
  'src/simulator/members/code-fingerprint.mjs',
  'src/app/api/simulator/unlock/route.ts',
];

/** The program builder: whoever imports it writes programs. */
const BUILDER = 'src/simulator/vm/builder.ts';

/**
 * What gives an example away when it is written in a file: its title, the first words of a
 * title up to its colon ("Smart bucket"), and its id when that is more than one plain word
 * ('full-mission'; an id like 'hello' is just a word).
 *
 * A title is found in capitals or small letters, and with any blanks between its words (in a
 * page, a title broken over two lines reads the same). The first words of a title are looked
 * for as they are written: "Full mission" is found, "the robot's full mission" is plain English.
 */
function exampleMarkers(cards: ReadonlyArray<{ id: string; title: string }>): RegExp[] {
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // (as words of their own: "Full mission" is not found in "Full missions")
  const words = (text: string): string => `(?<!\\w)${text.trim().split(/\s+/).map(escape).join('\\s+')}(?!\\w)`;
  const markers: RegExp[] = [];
  for (const card of cards) {
    markers.push(new RegExp(words(card.title), 'i'));
    const head = card.title.split(':')[0].trim();
    if (head !== card.title && /\s/.test(head)) markers.push(new RegExp(words(head)));
    if (card.id.includes('-')) markers.push(new RegExp(`(?<![\\w-])${escape(card.id)}(?![\\w-])`, 'i'));
  }
  return markers;
}

/** A sentence of a description counts as "telling" from this many words on: "Then it stops." is plain English. */
const TELLING_SENTENCE_WORDS = 6;

/**
 * What gives the DESCRIPTION of an example away: every sentence of it that is long enough to
 * be nobody else's sentence (TELLING_SENTENCE_WORDS words or more). Like a title, a sentence is
 * found in capitals or small letters and with any blanks between its words.
 */
function descriptionMarkers(examples: ReadonlyArray<{ description: string }>): RegExp[] {
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markers: RegExp[] = [];
  for (const example of examples) {
    // (a sentence ends at ". ", "! ", "? " or ": " - or at the end of the text)
    for (const sentence of example.description.split(/(?<=[.!?:])\s+/)) {
      const words = sentence
        .replace(/[.!?:]+$/, '')
        .trim()
        .split(/\s+/);
      if (words.length >= TELLING_SENTENCE_WORDS) markers.push(new RegExp(words.map(escape).join('\\s+'), 'i'));
    }
  }
  return markers;
}

/** The titles and ids of the real examples, of every game. */
const TITLE_MARKERS = exampleMarkers(SAMPLE_CATALOG);
/** The sentences of the descriptions of the real examples, of every game. */
const DESCRIPTION_MARKERS = descriptionMarkers(ALL_GAMES.flatMap((game) => game.examples));
/** Everything that gives a real example away when it is written in a file. */
const REAL_MARKERS = [...TITLE_MARKERS, ...DESCRIPTION_MARKERS];

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.test\.[a-z]+$/;
/**
 * Files that are not code but can be read as text - data, stylesheets, drawings. An import of
 * one brings its text along (a .json file of cards would be packed into the page like any
 * list written in code), so the guard reads them too: they import nothing themselves, but a
 * title written in one is found.
 */
const TEXT_FILE = /\.(?:json|css|scss|svg|txt|md|csv|html?|xml|ya?ml|webmanifest)$/;
/** Imports of things that are neither code nor text (pictures, fonts) lead nowhere. */
const NOT_CODE = /\.(?:css|scss|svg|png|jpe?g|webp|avif|gif|ico|json|woff2?|txt|md|csv|html?|xml|ya?ml|webmanifest|mp3|mp4|pdf)$/;

type Files = Map<string, string>;

// =============================================================================================
// Reading the source files
// =============================================================================================

function readSourceFiles(folders: string[]): Files {
  const files: Files = new Map();
  const walk = (folder: string): void => {
    for (const entry of readdirSync(path.join(REPO_ROOT, folder), { withFileTypes: true })) {
      const relative = `${folder}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(relative);
      } else if (SOURCE_FILE.test(entry.name) || TEXT_FILE.test(entry.name)) {
        files.set(relative, readFileSync(path.join(REPO_ROOT, relative), 'utf8'));
      }
    }
  };
  folders.forEach(walk);
  return files;
}

/**
 * The short names for folders that tsconfig.json defines ("@/x" is "src/x"), as pairs: what an
 * import begins with, and the folder that stands for. They are read from tsconfig.json itself,
 * so a short name that is added there later is followed as well - an import the guard cannot
 * follow would be an import it does not watch.
 */
function readAliases(): Array<[string, string]> {
  const read = ts.readConfigFile(path.join(REPO_ROOT, 'tsconfig.json'), (file) => readFileSync(file, 'utf8'));
  const options: { baseUrl?: unknown; paths?: Record<string, string[]> } = read.config?.compilerOptions ?? {};
  // ("baseUrl" would turn every folder of the repository into a name one can import: 'src/simulator/...')
  if (options.baseUrl !== undefined) throw new Error('tsconfig.json has a "baseUrl": the guard on the examples (client-guard.test.ts) cannot follow imports that lean on it. Use the "paths" names instead.');
  const aliases: Array<[string, string]> = [];
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    if (!pattern.endsWith('/*') || targets.length !== 1 || !targets[0].endsWith('/*')) {
      throw new Error(`tsconfig.json: the guard on the examples (client-guard.test.ts) can only follow "paths" of the kind "name/*": ["./folder/*"], not ${JSON.stringify({ [pattern]: targets })}.`);
    }
    aliases.push([pattern.slice(0, -1), `${path.posix.normalize(targets[0].slice(0, -2))}/`]);
  }
  return aliases;
}

const ALIASES = readAliases();

/** True when the file begins with the 'use client' directive (comments may come before it). */
function isClientFile(text: string): boolean {
  const source = ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'use client') return true;
  }
  return false;
}

/** What a file brings in from other files. */
interface FileImports {
  /** the files it names: './x', '@/x', 'react' ... */
  imports: string[];
  /** imports whose target is worked out while the program runs, so that nobody can say where they lead */
  hidden: string[];
}

/**
 * Everything a file imports, read from its syntax tree - every way there is to bring another
 * file in, type-only ones included:
 *
 *   import ... from '...'          import '...'           import x = require('...')
 *   export ... from '...'          export * from '...'    export * as name from '...'
 *   import('...')                  require('...')         require.resolve('...')
 *   new URL('...', import.meta.url)                       a type written as import('...').Name
 *
 * An import that does not name its file - import(`./${name}`), require(path),
 * require.context(...), import.meta.glob(...) - cannot be followed. The bundler answers such a
 * line by packing every file it could mean, so it is reported as "hidden", and the guard does
 * not accept one in anything the browser gets.
 */
function scanImports(text: string): FileImports {
  const source = ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: string[] = [];
  const hidden: string[] = [];
  const shown = (node: ts.Node): string => node.getText(source).replace(/\s+/g, ' ').slice(0, 80);
  const add = (target: ts.Node | undefined, whole: ts.Node): void => {
    if (target && (ts.isStringLiteral(target) || ts.isNoSubstitutionTemplateLiteral(target))) imports.push(target.text);
    else hidden.push(shown(whole));
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node.moduleSpecifier, node);
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression, node);
    } else if (ts.isImportTypeNode(node)) {
      add(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined, node);
    } else if (ts.isCallExpression(node)) {
      const called = node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import' : node.expression.getText(source).replace(/\s+/g, '');
      if (called === 'import' || called === 'require' || called === 'require.resolve' || called === 'module.require' || called === 'import.meta.resolve') add(node.arguments[0], node);
      else if (called === 'require.context' || called === 'import.meta.glob' || called === 'import.meta.webpackContext') hidden.push(shown(node));
    } else if (ts.isNewExpression(node) && node.arguments?.length === 2) {
      if (node.expression.getText(source) === 'URL' && node.arguments[1].getText(source).replace(/\s+/g, '') === 'import.meta.url') add(node.arguments[0], node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, hidden };
}

/** The files a file names in its imports (see scanImports). */
function importsOf(text: string): string[] {
  return scanImports(text).imports;
}

/**
 * The file an import leads to: a path from the repository's folder; null for a package, a Node
 * module or something that is not code; 'unresolved' when it should be a file but none is there.
 */
function resolveImport(files: Files, from: string, specifier: string): string | null | 'unresolved' {
  let target: string;
  const alias = ALIASES.find(([prefix]) => specifier.startsWith(prefix));
  // (the path is tidied up: '@/simulator/ui/../fire-rescue/samples' is src/simulator/fire-rescue/samples)
  if (alias) target = path.posix.normalize(`${alias[1]}${specifier.slice(alias[0].length)}`);
  else if (specifier.startsWith('.')) target = path.posix.join(path.posix.dirname(from), specifier);
  // a path from the top of the disk, a name out of package.json's "imports", a file: address - nothing this guard can follow
  else if (specifier.startsWith('/') || specifier.startsWith('#') || /^file:/i.test(specifier)) return 'unresolved';
  else return null;
  // a file that is read as text is followed like any other (it imports nothing, but it is looked at); a picture leads nowhere
  if (NOT_CODE.test(target)) return files.has(target) ? target : null;
  const candidates = [
    target,
    ...['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.cjs', '.json'].map((extension) => `${target}${extension}`),
    ...['.ts', '.tsx'].map((extension) => target.replace(/\.[cm]?js$/, extension)),
    ...['index.ts', 'index.tsx', 'index.js', 'index.mjs'].map((index) => `${target}/${index}`),
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? 'unresolved';
}

// =============================================================================================
// Following the imports
// =============================================================================================

interface Graph {
  /** file -> the files it imports */
  edges: Map<string, string[]>;
  /** imports that should lead to a file but do not: "file -> specifier" */
  unresolved: string[];
  /** file -> its imports that do not name a file (see scanImports) */
  hidden: Map<string, string[]>;
}

function buildGraph(files: Files): Graph {
  const edges = new Map<string, string[]>();
  const unresolved: string[] = [];
  const hidden = new Map<string, string[]>();
  for (const [file, text] of files) {
    const targets: string[] = [];
    // (a file that is not code - data, a stylesheet - imports nothing)
    const found = SOURCE_FILE.test(file) ? scanImports(text) : { imports: [], hidden: [] };
    for (const specifier of found.imports) {
      const target = resolveImport(files, file, specifier);
      if (target === 'unresolved') unresolved.push(`${file} -> ${specifier}`);
      else if (target !== null) targets.push(target);
    }
    edges.set(file, targets);
    if (found.hidden.length > 0) hidden.set(file, found.hidden);
  }
  return { edges, unresolved, hidden };
}

/**
 * The files that hold programs, descriptions or titles, or belong to the server: the ones of the
 * lists, every file that imports the builder, and every file in which a title or an id of an
 * example is written.
 */
function forbiddenFiles(files: Files, graph: Graph, markers: RegExp[] = REAL_MARKERS): Map<string, string> {
  const forbidden = new Map<string, string>();
  for (const [file, why] of Object.entries(HOLDERS)) if (files.has(file)) forbidden.set(file, why);
  for (const file of SERVER_ONLY) if (files.has(file)) forbidden.set(file, 'belongs to the server');
  // A test may build programs and name every example - as long as it is only a test. A file
  // named *.test.* that the browser's code imports is packed like any other file, so it is
  // looked at like any other file.
  const reached = reachedByBrowser(files, graph);
  const onlyATest = (file: string): boolean => TEST_FILE.test(file) && !reached.has(file);
  for (const [file, targets] of graph.edges) {
    if (!onlyATest(file) && file !== BUILDER && targets.includes(BUILDER) && !forbidden.has(file)) {
      forbidden.set(file, 'imports the program builder, so it holds programs');
    }
  }
  for (const [file, text] of files) {
    if (onlyATest(file) || forbidden.has(file)) continue;
    // as it is written, and as it reads: 'Full\u0020mission', 'Full ' + 'mission' and "Full&nbsp;mission" are that title too
    const read = SOURCE_FILE.test(file) ? `${text}\n${spokenText(text)}` : withoutEntities(text);
    const found = markers.find((marker) => marker.test(read));
    if (found) forbidden.set(file, `holds the title or the id of an example, or a sentence that explains one: it says "${found.exec(read)?.[0].replace(/\s+/g, ' ')}"`);
  }
  return forbidden;
}

/**
 * A text with the signs a page uses for single characters written out: "&nbsp;" and "&#160;"
 * are blanks, "&#x41;" is an A, "&amp;" is "&". (Between the tags of a page a title can be
 * written with them, and it reads the same on the screen.)
 */
function withoutEntities(text: string): string {
  const named: Record<string, string> = { nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', comma: ',', hyphen: '-', dash: '-', ndash: '-', mdash: '-' };
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, decimal?: string, hex?: string, name?: string) => {
    if (decimal !== undefined) return String.fromCodePoint(Number(decimal));
    if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
    return named[(name as string).toLowerCase()] ?? whole;
  });
}

/**
 * The texts of a file as they read once the program runs: what stands between quotes (with
 * escapes like \u0020 worked out) and between the tags of a page, one after the other. A title
 * that is written in pieces, or with escapes, is found in this.
 */
function spokenText(text: string): string {
  const source = ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) parts.push(node.text);
    // (between tags, and in the value of an attribute, a page writes some characters as "&nbsp;", "&#32;" ...)
    else if (ts.isJsxText(node)) parts.push(withoutEntities(node.text));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return withoutEntities(parts.join(' '));
}

/** The one address of the website that may hand out examples: it is the server's side, not something a browser gets. */
const UNLOCK_ROUTE = 'src/app/api/simulator/unlock/route.ts';

/**
 * Where the browser's code starts: 'use client' files, and everything that answers a browser -
 * the website's pages, layouts and components, every address under src/app but the one that
 * hands out the examples, pages of the older kind (src/pages), and the files directly in src
 * (they see every request).
 */
function browserRoots(files: Files): { client: string[]; pages: string[] } {
  const client: string[] = [];
  const pages: string[] = [];
  for (const [file, text] of files) {
    if (TEST_FILE.test(file) || !SOURCE_FILE.test(file)) continue;
    if (isClientFile(text)) client.push(file);
    else if (file.startsWith('src/components/') || file.startsWith('src/pages/') || (file.startsWith('src/app/') && file !== UNLOCK_ROUTE) || /^src\/[^/]+$/.test(file)) pages.push(file);
  }
  return { client, pages };
}

/** The way from a root to every file it reaches: file -> the chain of files that leads to it. */
function reachableFrom(graph: Graph, root: string): Map<string, string[]> {
  const chains = new Map<string, string[]>([[root, [root]]]);
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    for (const target of graph.edges.get(file) ?? []) {
      if (chains.has(target)) continue;
      chains.set(target, [...(chains.get(file) as string[]), target]);
      queue.push(target);
    }
  }
  return chains;
}

/** Every file the browser's code reaches: the roots themselves and everything they import, directly or through other files. */
function reachedByBrowser(files: Files, graph: Graph): Set<string> {
  const roots = browserRoots(files);
  const reached = new Set<string>();
  for (const root of [...roots.client, ...roots.pages]) for (const file of reachableFrom(graph, root).keys()) reached.add(file);
  return reached;
}

/** Every way from the browser's code to a forbidden file, as readable lines. Empty when all is well. */
function findLeaks(files: Files, markers: RegExp[] = REAL_MARKERS): string[] {
  const graph = buildGraph(files);
  const forbidden = forbiddenFiles(files, graph, markers);
  const roots = browserRoots(files);
  const leaks: string[] = [];
  for (const root of [...roots.client, ...roots.pages]) {
    for (const [file, chain] of reachableFrom(graph, root)) {
      const why = forbidden.get(file);
      if (why) leaks.push(`${chain.join('  ->  ')}   (${file} ${why})`);
      for (const line of graph.hidden.get(file) ?? []) {
        leaks.push(`${chain.join('  ->  ')}   (${file} has an import that does not name its file, so nobody can say what it brings along: ${line})`);
      }
    }
  }
  return leaks;
}

/**
 * The text of a file without its comments: everything that can end up in what the browser
 * downloads (names, texts in quotes, the words between the tags of the page).
 */
function codeOnly(text: string): string {
  const source = ts.createSourceFile('file.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parts: string[] = [];
  const visit = (node: ts.Node): void => {
    // (a comment that starts with two stars is part of the syntax tree: leave it out like the others)
    if (ts.isJSDoc(node)) return;
    const children = node.getChildren(source);
    if (children.length === 0) parts.push(node.getText(source));
    else children.forEach(visit);
  };
  visit(source);
  return parts.join(' ');
}

/** What names a level of the examples: its id in quotes, its heading, and the words after the heading. */
function levelMarkers(levels: ReadonlyArray<{ id: string; title: string; about: string }>): RegExp[] {
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return levels.flatMap((level) => [new RegExp(`['"\`]${escape(level.id)}['"\`]`), new RegExp(`\\b${escape(level.title)}\\b`), new RegExp(escape(level.about))]);
}

/** The same for a file that is not code (a stylesheet has no quotes around a name: [data-level=advanced]): the id as a word of its own. */
function levelMarkersInText(levels: ReadonlyArray<{ id: string; title: string; about: string }>): RegExp[] {
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return levels.flatMap((level) => [new RegExp(`(?<![\\w])${escape(level.id)}(?![\\w])`, 'i'), new RegExp(escape(level.about))]);
}

/**
 * The files in which a level of the examples must not be named: the simulator's own, and the
 * pages it stands on. (Another page of the website may say "advanced": the website has
 * "advanced" categories.) The few words after a heading are another matter: they are the
 * simulator's own words, and they are looked for in every file the browser gets.
 */
const SIMULATOR_FILES = ['src/simulator/', 'src/app/training/simulator/'];

/** The words after the headings alone ("explore, find the fire and blow it out"). */
function aboutMarkers(levels: ReadonlyArray<{ about: string }>): RegExp[] {
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return levels.map((level) => new RegExp(escape(level.about)));
}

/** Every file of the simulator the browser gets in which a level of the examples is named, as readable lines. */
function findLevelNames(files: Files, levels: ReadonlyArray<{ id: string; title: string; about: string }> = EXAMPLE_LEVELS): string[] {
  const graph = buildGraph(files);
  const roots = browserRoots(files);
  const markers = levelMarkers(levels);
  const markersInText = levelMarkersInText(levels);
  const markersElsewhere = aboutMarkers(levels);
  const found = new Map<string, string>();
  for (const root of [...roots.client, ...roots.pages]) {
    for (const [file, chain] of reachableFrom(graph, root)) {
      if (found.has(file)) continue;
      // (of a file of code its code, not its comments; of a stylesheet or a data file every letter)
      const isCode = SOURCE_FILE.test(file);
      const code = isCode ? codeOnly(files.get(file) ?? '') : (files.get(file) ?? '');
      // in the simulator's own files: every name of a level; anywhere else: the words after a heading
      const lookFor = !SIMULATOR_FILES.some((folder) => file.startsWith(folder)) ? markersElsewhere : isCode ? markers : markersInText;
      const marker = lookFor.find((m) => m.test(code));
      if (marker) found.set(file, `${chain.join('  ->  ')}   (${file} says ${marker.exec(code)?.[0]})`);
    }
  }
  return [...found.values()];
}

// =============================================================================================
// What is served as it is: the files in public/, and the website's configuration
// =============================================================================================

/** A file as the guard looks at it: its path, and its text when it is a file of text. */
interface ServedFile {
  name: string;
  text: string | null;
}

/** Every file below a folder of the repository (text files with their text, up to 2 MB each). */
function readServedFiles(folder: string): ServedFile[] {
  const found: ServedFile[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(path.join(REPO_ROOT, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(name);
      else {
        const full = path.join(REPO_ROOT, name);
        const isText = (SOURCE_FILE.test(entry.name) || TEXT_FILE.test(entry.name)) && statSync(full).size <= 2_000_000;
        found.push({ name, text: isText ? readFileSync(full, 'utf8') : null });
      }
    }
  };
  if (existsSync(path.join(REPO_ROOT, folder))) walk(folder);
  return found;
}

/** The files that name an example - in their own name ("full-mission.png") or in their text - as readable lines. */
function findNamedExamples(served: ServedFile[], markers: RegExp[] = REAL_MARKERS): string[] {
  const lines: string[] = [];
  for (const file of served) {
    // (a file name has dashes or underscores where a title has blanks, and capitals where it likes)
    const spoken = file.name.replace(/[_-]+/g, ' ');
    const inName = markers.map((marker) => new RegExp(marker.source, 'i')).find((marker) => marker.test(file.name) || marker.test(spoken));
    if (inName) lines.push(`${file.name}   (its name says "${(inName.exec(file.name) ?? inName.exec(spoken))?.[0]}")`);
    const inText = file.text === null ? undefined : markers.find((marker) => marker.test(file.text as string));
    if (inText) lines.push(`${file.name}   (it says "${inText.exec(file.text as string)?.[0].replace(/\s+/g, ' ')}")`);
  }
  return lines;
}

// =============================================================================================
// The real files
// =============================================================================================

describe('the examples stay on the server', () => {
  const files = readSourceFiles(['src', 'content', 'scripts']);
  const graph = buildGraph(files);
  const roots = browserRoots(files);

  test('the guard sees the simulator screen and can follow its imports', () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    assert.deepEqual(graph.unresolved, [], 'every import of a file leads to a file');
    // the short names of tsconfig.json are followed ("@/x" is src/x), and the files that are not code are read as well
    for (const alias of [['@/', 'src/'], ['@content/', 'content/']]) assert.ok(ALIASES.some(([prefix, folder]) => prefix === alias[0] && folder === alias[1]), alias.join(' -> '));
    assert.ok(files.has('src/simulator/ui/simulator.css'), 'the stylesheet of the simulator is looked at');
    assert.ok(
      roots.client.some((root) => reachableFrom(graph, root).has('src/simulator/ui/simulator.css')),
      'and the import that brings it in is followed',
    );
    assert.ok(roots.client.length >= 15, `${roots.client.length} files begin with 'use client'`);
    for (const screen of [
      'src/simulator/ui/SimulatorApp.tsx',
      'src/simulator/ui/ExamplesDialog.tsx',
      'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx',
      'src/simulator/ui/fire-rescue/FireRescueLoader.tsx',
      'src/simulator/ui/fire-chief/FireChiefSimulator.tsx',
      'src/simulator/ui/fire-chief/FireChiefLoader.tsx',
      'src/simulator/ui/fire-chief/MazeEditor.tsx',
    ]) {
      assert.ok(roots.client.includes(screen), `${screen} begins with 'use client'`);
    }
    // the page of every game reaches its screen (through a dynamic import), and the screen reaches what asks the server
    for (const [page, loader, simulator, own] of [
      ['src/app/training/simulator/fire-rescue/page.tsx', 'src/simulator/ui/fire-rescue/FireRescueLoader.tsx', 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx', 'src/simulator/fire-rescue/game.ts'],
      ['src/app/training/simulator/fire-chief/page.tsx', 'src/simulator/ui/fire-chief/FireChiefLoader.tsx', 'src/simulator/ui/fire-chief/FireChiefSimulator.tsx', 'src/simulator/fire-chief/game.ts'],
    ]) {
      assert.ok(roots.pages.includes(page), page);
      const fromPage = reachableFrom(graph, page);
      assert.ok(fromPage.has(loader) && fromPage.has(simulator), `${page} -> loader -> import() -> the screen of its game`);
      assert.ok(fromPage.has('src/simulator/ui/SimulatorApp.tsx'), `${page} -> the simulator`);
      assert.ok(fromPage.has('src/simulator/ui/ExamplesDialog.tsx'), `${page}: the Examples window`);
      assert.ok(fromPage.has('src/simulator/ui/member-unlock.ts'), page);
      assert.ok(fromPage.has(own), `${page}: the game itself`);
      for (const catalog of CATALOGS) assert.ok(!fromPage.has(catalog.file) && !fromPage.has(catalog.samples), `${page}: the screen holds no list of examples, and no example: not of ${catalog.game}`);
      assert.ok(reachableFrom(graph, simulator).has('src/simulator/vm/index.ts'), `${simulator}: and the interpreter`);
    }
    // the Fire Chief screen has files of its own: its words, its rules window and its maze panel are looked at too
    const chiefScreen = reachableFrom(graph, 'src/simulator/ui/fire-chief/FireChiefSimulator.tsx');
    for (const file of ['src/simulator/ui/fire-chief/words.ts', 'src/simulator/ui/fire-chief/rules.ts', 'src/simulator/ui/fire-chief/MazeEditor.tsx', 'src/simulator/ui/fire-chief/maze-words.ts']) {
      assert.ok(chiefScreen.has(file), `the Fire Chief screen -> ${file}`);
    }
    // the page that lists the simulators is a page of the website like any other
    assert.ok(roots.pages.includes('src/app/training/simulator/page.tsx'));
  });

  test('the files that hold the examples are known to the guard', () => {
    const forbidden = forbiddenFiles(files, graph);
    for (const file of [...Object.keys(HOLDERS), ...SERVER_ONLY]) assert.ok(forbidden.has(file), `${file} exists`);
    // the examples of every game: its list of titles and its programs
    assert.deepEqual(
      CATALOGS.map((catalog) => catalog.game),
      ['Fire Rescue', 'Fire Chief'],
    );
    for (const catalog of CATALOGS) {
      assert.match(forbidden.get(catalog.file) ?? '', /titles/, catalog.file);
      assert.match(forbidden.get(catalog.samples) ?? '', /programs and descriptions/, catalog.samples);
    }
    // nothing but the samples.ts of a game builds programs outside the tests
    assert.deepEqual(
      [...forbidden].filter(([, why]) => why.includes('builder')).map(([file]) => file),
      [],
      'a file that imports the program builder holds programs: list it in HOLDERS and keep it on the server',
    );
    for (const catalog of CATALOGS) assert.ok((graph.edges.get(catalog.samples) ?? []).includes(BUILDER), `${catalog.samples} is written with the program builder`);
    // ... and the server's own list brings them all along
    for (const catalog of CATALOGS) {
      for (const file of [catalog.file, catalog.samples]) assert.ok((graph.edges.get('src/simulator/members/all-examples.ts') ?? []).includes(file), `all-examples.ts imports ${file}`);
    }
    // files in which a title or an id is written are found without being listed: the script that
    // makes codes (its explanations for the owner name every example) is one of them
    assert.match(forbidden.get('scripts/generate-simulator-codes.mjs') ?? '', /holds the title or the id of an example/);
    assert.equal(exampleMarkers(RESCUE_CATALOG).length, 7 + 2 + 6, 'Fire Rescue: seven titles, two first halves of a title, six ids of more than one word');
    assert.equal(exampleMarkers(CHIEF_CATALOG).length, 6 + 0 + 6, 'Fire Chief: six titles (none with a colon), six ids of more than one word');
    assert.equal(TITLE_MARKERS.length, 15 + 12, 'and the guard looks for all of them');
    assert.equal(SAMPLE_CATALOG.length, 7 + 6);
    // ... and for the sentences of every description: of all thirteen examples, several each
    const everyExample = ALL_GAMES.flatMap((game) => game.examples);
    assert.equal(everyExample.length, 7 + 6);
    for (const example of everyExample) {
      const mine = descriptionMarkers([example]);
      assert.ok(mine.length >= 2, `${example.id}: ${mine.length} sentences of its description are looked for`);
      // its first sentence that is long enough is one of them, however it is written
      const first = example.description.split(/(?<=[.!?:])\s+/).find((sentence) => sentence.split(/\s+/).length >= TELLING_SENTENCE_WORDS);
      assert.ok(first, example.id);
      assert.ok(REAL_MARKERS.some((marker) => marker.test(`about: '${first}'`)), `${example.id}: ${first}`);
      assert.ok(REAL_MARKERS.some((marker) => marker.test(first.toUpperCase().replace(/ /g, '\n  '))), `${example.id}, in capitals and over many lines`);
    }
    assert.equal(REAL_MARKERS.length, TITLE_MARKERS.length + DESCRIPTION_MARKERS.length);
    for (const card of SAMPLE_CATALOG) {
      assert.ok(REAL_MARKERS.some((marker) => marker.test(`title: '${card.title}'`)), card.title);
      assert.ok(REAL_MARKERS.some((marker) => marker.test(card.title.toUpperCase())), `${card.title}, in capitals`);
      if (card.id.includes('-')) assert.ok(REAL_MARKERS.some((marker) => marker.test(`{ id: "${card.id}" }`)), card.id);
    }
    for (const telling of ["'smart-bucket'", '"full-mission"', 'the "Smart bucket" program', 'Full mission', '`one-person`']) {
      assert.ok(REAL_MARKERS.some((marker) => marker.test(telling)), telling);
    }
    for (const harmless of ['A line-following robot', 'hello', 'the gripper', 'smart', 'a bucket', 'one-personality', 'not-one-bucket']) {
      assert.ok(!REAL_MARKERS.some((marker) => marker.test(harmless)), harmless);
    }
    // the same for Fire Chief
    for (const telling of ["'chief-first-wall'", '"chief-full-mission"', '`chief-flame-fan`', 'the "Follow the right-hand wall to a room" program', 'the whole mission on\n   any maze', 'data-example="chief-count-lines"']) {
      assert.ok(REAL_MARKERS.some((marker) => marker.test(telling)), telling);
    }
    for (const harmless of ['fire-chief', 'chief', 'the fire chief', 'chief-first-walls', 'the first wall', 'the whole mission', 'count the grid lines', 'the colour sensor and the fan', 'read red', 'start the fan', 'find the fire', 'follow the wall to a room']) {
      assert.ok(!REAL_MARKERS.some((marker) => marker.test(harmless)), harmless);
    }
  });

  test("nothing reachable from a 'use client' file, a page, a layout or a component imports a file that holds programs, descriptions or titles", () => {
    const leaks = findLeaks(files);
    assert.deepEqual(
      leaks,
      [],
      `\n\nExample programs, their descriptions or their titles would be sent to every visitor's browser:\n\n  ${leaks.join('\n  ')}\n\n` +
        'Take that import out (or the title that was written into that file). The screen holds nothing about the examples -\n' +
        'not even a sample-catalog.ts (src/simulator/fire-rescue, src/simulator/fire-chief), the list of the titles of a game:\n' +
        'an example for advanced codes only must not show anywhere. The cards, the programs and the descriptions come from\n' +
        'the server, through /api/simulator/unlock.\n',
    );
  });

  test('the simulator screen names no level of the examples and holds no heading: those come from the server with the cards', () => {
    const named = findLevelNames(files);
    assert.deepEqual(
      named,
      [],
      `\n\nA level of the examples is named in what every visitor's browser downloads:\n\n  ${named.join('\n  ')}\n\n` +
        'The headings (Starter, Intermediate, Advanced) and the few words after them are in the sample-catalog.ts of each game\n' +
        '(src/simulator/fire-rescue, src/simulator/fire-chief), on the server.\n' +
        'The Examples window draws the headings the server sends - a visitor who may not see an advanced example\n' +
        'must not get the word "Advanced" either.\n',
    );
    // the headings of both games are looked for: the names of the three levels, and the words after each heading
    assert.equal(EXAMPLE_LEVELS.length, 3 + 3);
    assert.equal(new Set(EXAMPLE_LEVELS.map((level) => level.about)).size, 6, 'six different texts');
    assert.deepEqual([...new Set(EXAMPLE_LEVELS.map((level) => level.id))], ['starter', 'intermediate', 'advanced']);
    // (the check looks at the screen's own files, and at their code, not at their comments)
    const screen = reachableFrom(graph, 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx');
    assert.ok([...screen.keys()].filter((file) => file.startsWith('src/simulator/')).length >= 30);
    assert.equal(codeOnly("// 'advanced'\n/* Advanced */\n/** The 'advanced' level. */\nexport const a = 1; // first steps\n").includes('dvanced'), false);
    assert.equal(codeOnly("/** Advanced. */\nexport function f() {\n  /** advanced */\n  return 1;\n}\n").replace(/\s+/g, ' '), 'export function f ( ) { return 1 ; } ');
    assert.ok(codeOnly("export const a = <p title='x'>Advanced {`first ${1} steps`}</p>;").includes('Advanced'));
  });

  for (const catalog of CATALOGS) {
    test(`${catalog.game}: the catalog - the list of the titles - stays on the server, and imports nothing`, () => {
      const text = files.get(catalog.file);
      assert.ok(text);
      assert.deepEqual(importsOf(text), [], 'no import at all');
      const code = codeOnly(text);
      for (const word of ['description', 'program', 'blocks', 'note(']) {
        assert.ok(!code.includes(word), `sample-catalog.ts has no "${word}" outside its comments`);
      }
      // every entry of the list is one short line: { id, title, level }
      const entries = text.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
      assert.equal(entries.length, catalog.examples);
      for (const entry of entries) assert.match(entry.trim(), /^\{ id: '[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
      // nothing the browser gets leads to it, or to the programs
      for (const root of [...roots.client, ...roots.pages]) {
        const reached = reachableFrom(graph, root);
        assert.ok(!reached.has(catalog.file), `${root} does not reach the catalog`);
        assert.ok(!reached.has(catalog.samples), `${root} does not reach the programs`);
      }
    });
  }

  test('nothing that is served as it is names an example: no file in public/, and not the configuration of the website', () => {
    const served = readServedFiles('public');
    assert.ok(served.length > 100 && served.some((file) => file.text !== null), `${served.length} files in public/`);
    const named = findNamedExamples(served);
    assert.deepEqual(
      named,
      [],
      `\n\nA file in public/ names an example. Everything in public/ can be downloaded by anybody, code or no code:\n\n  ${named.join('\n  ')}\n\n` +
        'Take the file out, or give it a name and a text that say nothing about the example.\n',
    );
    // next.config.mjs, package.json and the like: what stands there can end up in every page (redirects, "env", headers)
    const config = readdirSync(REPO_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && (SOURCE_FILE.test(entry.name) || /\.json$/.test(entry.name)))
      .map((entry) => ({ name: entry.name, text: readFileSync(path.join(REPO_ROOT, entry.name), 'utf8') }));
    assert.ok(config.some((file) => file.name === 'next.config.mjs') && config.some((file) => file.name === 'package.json'));
    assert.deepEqual(findNamedExamples(config), [], 'the configuration files of the website name no example');
  });

  test('only the server and the tests import the examples and the list of codes', () => {
    const importers = (target: string): string[] =>
      [...graph.edges]
        .filter(([file, targets]) => targets.includes(target) && !TEST_FILE.test(file))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers(CATALOG), ['src/simulator/fire-rescue/samples.ts', 'src/simulator/members/all-examples.ts']);
    assert.deepEqual(importers('src/simulator/fire-rescue/samples.ts'), ['src/simulator/members/all-examples.ts']);
    assert.deepEqual(importers(CHIEF_CATALOG_FILE), ['src/simulator/fire-chief/samples.ts', 'src/simulator/members/all-examples.ts']);
    assert.deepEqual(importers('src/simulator/fire-chief/samples.ts'), ['src/simulator/members/all-examples.ts']);
    assert.deepEqual(importers('src/simulator/members/all-examples.ts'), ['src/app/api/simulator/unlock/route.ts']);
    assert.deepEqual(importers('src/simulator/members/unlock.ts'), ['src/app/api/simulator/unlock/route.ts']);
    assert.deepEqual(importers('content/simulator-codes.ts'), ['src/app/api/simulator/unlock/route.ts']);
    assert.deepEqual(importers('src/app/api/simulator/unlock/route.ts'), []);
  });
});

// =============================================================================================
// The guard itself: it must fail when it should
// =============================================================================================

describe('the guard catches a leak', () => {
  const SAMPLES = "import { program } from '../vm/builder';\nexport const SAMPLE_PROGRAMS = [program([])];\n";
  const base = (): Files =>
    new Map([
      ['src/simulator/vm/builder.ts', 'export function program(scripts: unknown[]) { return { scripts }; }\n'],
      ['src/simulator/fire-rescue/samples.ts', SAMPLES],
      ['src/simulator/fire-rescue/sample-catalog.ts', "export const SAMPLE_CATALOG = [{ id: 'hello', title: 'Hello, mBot2' }, { id: 'full-mission', title: 'Full mission: 180 points on the default combination' }];\n"],
      ['src/simulator/fire-chief/samples.ts', SAMPLES],
      ['src/simulator/fire-chief/sample-catalog.ts', "export const SAMPLE_CATALOG = [{ id: 'chief-first-wall', title: 'Stop in front of the first wall' }, { id: 'chief-full-mission', title: 'The whole mission on any maze' }];\n"],
      [
        'src/simulator/members/all-examples.ts',
        "import { SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';\nimport { SAMPLE_PROGRAMS } from '../fire-rescue/samples';\n" +
          "import { SAMPLE_CATALOG as CHIEF_CATALOG } from '../fire-chief/sample-catalog';\nimport { SAMPLE_PROGRAMS as CHIEF_PROGRAMS } from '../fire-chief/samples';\n" +
          'export const ALL_GAMES = [SAMPLE_CATALOG, SAMPLE_PROGRAMS, CHIEF_CATALOG, CHIEF_PROGRAMS];\n',
      ],
      ['src/app/api/simulator/unlock/route.ts', "import { ALL_GAMES } from '@/simulator/members/all-examples';\nexport const POST = () => ALL_GAMES;\n"],
      ['src/simulator/fire-rescue/integration.test.ts', "import { SAMPLE_PROGRAMS } from './samples';\nvoid SAMPLE_PROGRAMS;\n"],
      ['src/simulator/ui/member-unlock.ts', "export const requestUnlock = (url: string) => fetch(url, { method: 'POST' });\n"],
      ['src/simulator/ui/Screen.tsx', "'use client';\nimport { requestUnlock } from './member-unlock';\nexport const Screen = () => requestUnlock('/api/simulator/unlock');\n"],
      ['src/app/page.tsx', "import { Screen } from '@/simulator/ui/Screen';\nexport default function Page() { return Screen(); }\n"],
    ]);
  const withFile = (file: string, text: string): Files => new Map([...base(), [file, text]]);

  test('a tree like the real one is clean (the route handler and the tests may import the examples)', () => {
    assert.deepEqual(findLeaks(base()), []);
  });

  test("a 'use client' file that imports samples.ts", () => {
    const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', "'use client';\nimport { SAMPLE_PROGRAMS } from '../fire-rescue/samples';\nexport const Screen = () => SAMPLE_PROGRAMS;\n"));
    assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/fire-rescue/samples.ts')), leaks.join('\n'));
  });

  test("a 'use client' file that imports sample-catalog.ts - the titles - is a leak too, however it gets there", () => {
    const direct = findLeaks(withFile('src/simulator/ui/Screen.tsx', "'use client';\nimport { SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';\nexport const Screen = () => SAMPLE_CATALOG.length;\n"));
    assert.ok(direct.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/fire-rescue/sample-catalog.ts') && leak.includes('holds the titles')), direct.join('\n'));
    // a type-only import, a dynamic import, through a helper, from a page
    for (const line of ["import type { ExampleCard } from '../fire-rescue/sample-catalog';", "const load = () => import('../fire-rescue/sample-catalog');", "export * from '@/simulator/fire-rescue/sample-catalog';"]) {
      const files = withFile('src/simulator/ui/helper.ts', `${line}\nexport const helper = 1;\n`);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { helper } from './helper';\nexport const Screen = () => helper;\n");
      const leaks = findLeaks(files);
      assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/helper.ts  ->  src/simulator/fire-rescue/sample-catalog.ts')), line);
    }
    const page = findLeaks(withFile('src/app/training/page.tsx', "import { SAMPLE_CATALOG } from '@/simulator/fire-rescue/sample-catalog';\nexport default function Page() { return SAMPLE_CATALOG.length; }\n"));
    assert.ok(page.some((leak) => leak.startsWith('src/app/training/page.tsx  ->  src/simulator/fire-rescue/sample-catalog.ts')));
  });

  test('the examples of Fire Chief are guarded like the ones of Fire Rescue: its programs, its list of titles, however a file gets there', () => {
    const ways = ["import { SAMPLE_PROGRAMS } from '../fire-chief/samples';", "import type { SampleProgram } from '../fire-chief/samples';", "const load = () => import('@/simulator/fire-chief/samples');", "export * from '../fire-chief/samples';"];
    for (const line of ways) {
      const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`));
      assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/fire-chief/samples.ts') && leak.includes('holds example programs and descriptions')), line);
    }
    for (const line of ["import { SAMPLE_CATALOG } from '../fire-chief/sample-catalog';", "import type { ExampleCard } from '../fire-chief/sample-catalog';", "const load = () => import('../fire-chief/sample-catalog');"]) {
      // in the screen every game shares, in a screen of Fire Chief's own, through a helper
      for (const screen of ['src/simulator/ui/Screen.tsx', 'src/simulator/ui/fire-chief/FireChiefSimulator.tsx']) {
        const from = line.replace("'../fire-chief/", screen.includes('/ui/fire-chief/') ? "'../../fire-chief/" : "'../fire-chief/");
        const leaks = findLeaks(withFile(screen, `'use client';\n${from}\nexport const Screen = () => null;\n`));
        assert.ok(leaks.some((leak) => leak.startsWith(`${screen}  ->  src/simulator/fire-chief/sample-catalog.ts`) && leak.includes('holds the titles')), `${screen}: ${from}`);
      }
      const files = withFile('src/simulator/ui/helper.ts', `${line}\nexport const helper = 1;\n`);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { helper } from './helper';\nexport const Screen = () => helper;\n");
      assert.ok(findLeaks(files).some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/helper.ts  ->  src/simulator/fire-chief/sample-catalog.ts')), line);
    }
    // a page of the game, and the server's list of every game's examples
    const page = findLeaks(withFile('src/app/training/simulator/fire-chief/page.tsx', "import { SAMPLE_CATALOG } from '@/simulator/fire-chief/sample-catalog';\nexport default function Page() { return SAMPLE_CATALOG.length; }\n"));
    assert.ok(page.some((leak) => leak.startsWith('src/app/training/simulator/fire-chief/page.tsx  ->  src/simulator/fire-chief/sample-catalog.ts')));
    const all = findLeaks(withFile('src/simulator/ui/Screen.tsx', "'use client';\nimport { ALL_GAMES } from '../members/all-examples';\nexport const Screen = () => ALL_GAMES;\n"));
    for (const file of ['src/simulator/fire-rescue/samples.ts', 'src/simulator/fire-rescue/sample-catalog.ts', 'src/simulator/fire-chief/samples.ts', 'src/simulator/fire-chief/sample-catalog.ts']) {
      assert.ok(all.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/members/all-examples.ts') && leak.includes(`(${file} `)), file);
    }
  });

  test('a title or an id of a Fire Chief example written into a file the browser gets is caught - with the real titles, also in the screen of the other game', () => {
    assert.deepEqual(findLeaks(base()), [], 'the tree is clean with the real titles');
    const telling = [
      ...CHIEF_CATALOG.map((card) => `export const CARDS = [{ id: 'x', title: '${card.title}' }];`),
      ...CHIEF_CATALOG.map((card) => `export const CARDS = [{ id: '${card.id}' }];`),
      'export const hint = "Ask for the whole mission on any maze";',
      "export const title = 'STOP IN FRONT OF THE FIRST WALL';",
      'export const card = <li>Find the fire in a room\n        and check   its colour</li>;',
      "export const title = 'Count grid' + ' lines to drive ' + `two cells`;",
      '// the locked card of chief-wall-follow is not drawn\nexport const nothing = 1;',
    ];
    for (const line of telling) {
      for (const file of ['src/simulator/ui/Screen.tsx', 'src/simulator/ui/fire-chief/FireChiefSimulator.tsx', 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx']) {
        const leaks = findLeaks(withFile(file, `'use client';\n${line}\nexport const Screen = () => null;\n`));
        assert.ok(leaks.some((leak) => leak.startsWith(file) && leak.includes('holds the title or the id of an example')), `${file}: ${line}`);
      }
      assert.ok(findLeaks(withFile('src/app/training/simulator/fire-chief/page.tsx', `${line}\nexport default function Page() { return null; }\n`)).length > 0, line);
      // on the server and in a test it is nobody's business
      assert.deepEqual(findLeaks(withFile('src/simulator/members/server-helper.ts', `${line}\n`)), [], line);
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/cards.test.ts', `${line}\n`)), [], line);
    }
    // a stylesheet, a file of cards, a file in public/
    for (const [file, text, line] of [
      ['src/simulator/ui/screen.css', '[data-example="chief-full-mission"] { color: red; }', "import './screen.css';"],
      ['src/simulator/ui/cards.json', '[{ "title": "Read red, then start the fan" }]', "import cards from './cards.json';"],
    ] as const) {
      const files = withFile(file, text);
      files.set('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`);
      assert.ok(findLeaks(files).some((leak) => leak.startsWith(`src/simulator/ui/Screen.tsx  ->  ${file}`) && leak.includes('holds the title or the id of an example')), file);
    }
    assert.deepEqual(
      findNamedExamples([
        { name: 'public/simulator/fire-chief/mat.webp', text: null },
        { name: 'public/simulator/fire-chief/chief-full-mission.png', text: null },
        { name: 'public/simulator/fire-chief/The_Whole_Mission_On_Any_Maze.pdf', text: null },
        { name: 'public/simulator/fire-chief/examples.json', text: '[{ "title": "Follow the right-hand wall to a room" }]' },
      ]).map((line) => line.split('   ')[0]),
      ['public/simulator/fire-chief/chief-full-mission.png', 'public/simulator/fire-chief/The_Whole_Mission_On_Any_Maze.pdf', 'public/simulator/fire-chief/examples.json'],
    );
    // plain words about the game are no title
    for (const line of ["export const title = 'Fire Chief';", "export const text = 'Drive through the maze, find the fire and blow it out with the fan.';", "export const id = 'fire-chief';", "export const hint = 'Stop in front of a wall';"]) {
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/fire-chief/FireChiefSimulator.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`)), [], line);
    }
  });

  test('the headings of Fire Chief are looked for like the ones of Fire Rescue: the words after a heading, in the screen of either game and on its page', () => {
    assert.deepEqual(findLevelNames(base()), []);
    for (const level of CHIEF_LEVELS) {
      for (const file of ['src/simulator/ui/Screen.tsx', 'src/simulator/ui/fire-chief/FireChiefSimulator.tsx', 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx']) {
        const named = findLevelNames(withFile(file, `'use client';\nexport const about = '${level.about}';\nexport const Screen = () => null;\n`));
        assert.equal(named.length, 1, `${file}: ${level.about}`);
        assert.ok(named[0].includes(level.about));
      }
      assert.equal(findLevelNames(withFile('src/app/training/simulator/fire-chief/page.tsx', `export default function Page() { return '${level.title}: ${level.about}'; }\n`)).length, 1, level.about);
      // in a comment, on the server and on another page of the website it is nobody's business
      assert.deepEqual(findLevelNames(withFile('src/simulator/ui/Screen.tsx', `'use client';\n// ${level.about}\nexport const Screen = () => null;\n`)), [], level.about);
      assert.deepEqual(findLevelNames(withFile('src/simulator/members/server-helper.ts', `export const about = '${level.about}';\n`)), [], level.about);
    }
  });

  test('a sentence of the description of an example written into a file the browser gets is caught - of every example of both games', () => {
    assert.deepEqual(findLeaks(base()), [], 'the tree is clean with the real descriptions');
    for (const game of ALL_GAMES) {
      for (const example of game.examples) {
        const sentence = example.description.split(/(?<=[.!?:])\s+/).find((one) => one.split(/\s+/).length >= TELLING_SENTENCE_WORDS);
        assert.ok(sentence, example.id);
        // (written as a page would write it: between tags, so that quotes in the sentence do no harm)
        for (const file of ['src/simulator/ui/fire-chief/words.tsx', 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx', 'src/components/Footer.tsx']) {
          const leaks = findLeaks(withFile(file, `'use client';\nexport const Hint = () => <p>{'x'} ${sentence.replace(/[{}<>]/g, ' ')}</p>;\n`));
          assert.ok(leaks.some((leak) => leak.startsWith(file) && leak.includes('a sentence that explains one')), `${file}: ${example.id}: ${sentence}`);
        }
        // on the server it is nobody's business
        assert.deepEqual(findLeaks(withFile('src/simulator/members/server-helper.tsx', `export const Hint = () => <p>${sentence.replace(/[{}<>]/g, ' ')}</p>;\n`)), [], example.id);
      }
    }
    // a short sentence, and words about the game that are no sentence of a description, are plain English
    for (const line of ["export const hint = 'Then it stops.';", "export const text = 'The robot drives through the maze and looks for the fire with its colour sensor.';"]) {
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/fire-chief/words.ts', `'use client';\n${line}\n`)), [], line);
    }
  });

  test('a file named *.test.* is only a test as long as nothing of the browser imports it', () => {
    const title = "export const TITLES = ['The whole mission on any maze'];\n";
    // nobody imports it: a test may name every example
    assert.deepEqual(findLeaks(withFile('src/simulator/ui/fire-chief/titles.test.ts', title)), []);
    // a file of the screen imports it: now it is packed for the browser like any other file
    const imported = withFile('src/simulator/ui/fire-chief/titles.test.ts', title);
    imported.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { TITLES } from './fire-chief/titles.test';\nexport const Screen = () => TITLES;\n");
    const leaks = findLeaks(imported);
    assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/fire-chief/titles.test.ts') && leak.includes('holds the title or the id of an example')), leaks.join('\n'));
    // the same through a helper, from a page, and for a "test" that builds a program
    const viaHelper = withFile('src/simulator/ui/fire-chief/titles.test.ts', title);
    viaHelper.set('src/simulator/ui/helper.ts', "export * from './fire-chief/titles.test';\n");
    viaHelper.set('src/app/training/page.tsx', "import { TITLES } from '@/simulator/ui/helper';\nexport default function Page() { return TITLES.length; }\n");
    assert.ok(findLeaks(viaHelper).some((leak) => leak.startsWith('src/app/training/page.tsx  ->  src/simulator/ui/helper.ts  ->  src/simulator/ui/fire-chief/titles.test.ts')));
    const built = withFile('src/simulator/ui/programs.test.ts', "import { program } from '../vm/builder';\nexport const EXTRA = program([]);\n");
    assert.deepEqual(findLeaks(built), [], 'a test that builds programs and is only a test');
    built.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { EXTRA } from './programs.test';\nexport const Screen = () => EXTRA;\n");
    assert.ok(findLeaks(built).some((leak) => leak.includes('programs.test.ts') && leak.includes('imports the program builder')));
    // the real test that reads the examples stays a test
    assert.deepEqual(findLeaks(base()), []);
  });

  test("a title written with a page's signs for single characters (&nbsp;, &#32;, &#x20;) is caught", () => {
    for (const line of [
      'export const Card = () => <p>The whole mission on any&nbsp;maze</p>;',
      'export const Card = () => <p>The&#32;whole&#x20;mission on any maze</p>;',
      'export const Card = () => <p>The whole mission on any&#160;maze</p>;',
      "export const card = 'The whole mission on any&nbsp;maze';",
    ]) {
      for (const file of ['src/app/training/simulator/fire-chief/page.tsx', 'src/simulator/ui/Screen.tsx']) {
        const leaks = findLeaks(withFile(file, `${file.includes('/ui/') ? "'use client';\n" : ''}${line}\nexport default function Page() { return null; }\n`));
        assert.ok(leaks.some((leak) => leak.startsWith(file) && leak.includes('holds the title or the id of an example')), `${file}: ${line}`);
      }
    }
    // a text file the screen imports (a drawing with a caption), and what is plain text with such a sign
    const drawing = withFile('src/simulator/ui/help.svg', '<svg><text>The whole mission on any&nbsp;maze</text></svg>');
    drawing.set('src/simulator/ui/Screen.tsx', "'use client';\nconst help = new URL('./help.svg', import.meta.url);\nexport const Screen = () => help;\n");
    assert.ok(findLeaks(drawing).some((leak) => leak.includes('help.svg')));
    assert.deepEqual(findLeaks(withFile('src/simulator/ui/Screen.tsx', "'use client';\nexport const Card = () => <p>Fire&nbsp;Chief: find the fire &amp; blow it out</p>;\n")), []);
    assert.equal(withoutEntities('a&nbsp;b&#32;c&#x20;d &amp; e &unknown; f'), 'a b c d & e &unknown; f');
  });

  test('the words after a heading are looked for in every file the browser gets, not only in the simulator\'s own', () => {
    for (const level of [...RESCUE_LEVELS, ...CHIEF_LEVELS]) {
      for (const file of ['src/components/Footer.tsx', 'src/app/season/page.tsx']) {
        const named = findLevelNames(withFile(file, `export default function View() { return '${level.title}: ${level.about}'; }\n`));
        assert.equal(named.length, 1, `${file}: ${level.about}`);
      }
      // content that a page imports
      const content = withFile('content/seasons.ts', `export const teaser = '${level.about}';\n`);
      content.set('src/app/season/page.tsx', "import { teaser } from '@content/seasons';\nexport default function Page() { return teaser; }\n");
      assert.equal(findLevelNames(content).length, 1, `content: ${level.about}`);
    }
    // the bare name of a level stays the business of the simulator's files: the website has "advanced" categories
    assert.deepEqual(findLevelNames(withFile('src/components/Footer.tsx', "export default function View() { return 'Advanced: explore the maze'; }\n")), []);
  });

  test('a title or an id of an example written into a file of the screen is caught without any import', () => {
    const markers = exampleMarkers([
      { id: 'hello', title: 'Hello, mBot2' },
      { id: 'full-mission', title: 'Full mission: 180 points on the default combination' },
    ]);
    assert.deepEqual(findLeaks(base(), markers), [], 'the tree is clean with these titles too');
    const telling = [
      "export const CARDS = [{ id: 'x', title: 'Full mission: 180 points on the default combination' }];",
      "export const CARDS = [{ id: 'full-mission' }];",
      'export const hint = "Ask for the Full mission";',
      "export const first = 'Hello, mBot2';",
      '// the locked card of full-mission is not drawn\nexport const nothing = 1;',
    ];
    for (const line of telling) {
      // in a helper the screen imports ...
      const files = withFile('src/simulator/ui/cards.ts', `${line}\n`);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport './cards';\nexport const Screen = () => null;\n");
      const leaks = findLeaks(files, markers);
      assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/cards.ts') && leak.includes('holds the title or the id of an example')), line);
      // ... in the screen itself, and in a page of the website
      assert.ok(findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`), markers).length > 0, line);
      assert.ok(findLeaks(withFile('src/app/training/page.tsx', `${line}\nexport default function Page() { return null; }\n`), markers).length > 0, line);
      // on the server and in a test it is nobody's business
      assert.deepEqual(findLeaks(withFile('src/simulator/members/server-helper.ts', `${line}\n`), markers), [], line);
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/cards.test.ts', `${line}\n`), markers), [], line);
    }
    // a plain word is no title: 'hello' is an id, but not one that gives anything away
    assert.deepEqual(findLeaks(withFile('src/simulator/ui/Screen.tsx', "'use client';\nexport const Screen = () => 'hello, full missions';\n"), markers), []);
  });

  test('a level of the examples named in a file of the screen is caught: its id, its heading, the words after it', () => {
    const levels = [{ id: 'advanced', title: 'Advanced', about: 'the whole match' }];
    assert.deepEqual(findLevelNames(base(), levels), []);
    for (const line of ["const LEVELS = ['starter', 'advanced'];", 'const heading = <h3>Advanced</h3>;', "const about = 'the whole match';", 'const level = "advanced";']) {
      const inScreen = findLevelNames(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`), levels);
      assert.equal(inScreen.length, 1, line);
      const files = withFile('src/simulator/ui/levels.ts', `${line}\nexport const helper = 1;\n`);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { helper } from './levels';\nexport const Screen = () => helper;\n");
      assert.ok(findLevelNames(files, levels)[0]?.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/levels.ts'), line);
    }
    // a comment, another word, a file of the server and a page that is not the simulator are left alone
    for (const line of ['// advanced: see the server', 'const text = "the simulation is advanced by one step";', 'const advancedBy = 1;']) {
      assert.deepEqual(findLevelNames(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`), levels), [], line);
    }
    assert.deepEqual(findLevelNames(withFile('src/simulator/members/server-helper.ts', "export const level = 'advanced';\n"), levels), []);
    assert.deepEqual(findLevelNames(withFile('src/app/about/page.tsx', "export default function Page() { return 'Advanced sensing'; }\n"), levels), []);
  });

  test('a title is found however it is written: in small letters, over two lines, with escapes, in pieces', () => {
    const markers = exampleMarkers([{ id: 'full-mission', title: 'Full mission: 180 points on the default combination' }]);
    const telling = [
      "export const title = 'FULL MISSION: 180 POINTS ON THE DEFAULT COMBINATION';",
      'export const card = <li>Full mission: 180 points\n        on the default   combination</li>;',
      "export const title = 'Full\\u0020mission';",
      "export const title = 'Full' + ' ' + 'mission';",
      "export const title = `${'Full'} mission`;",
      "export const id = 'Full-Mission';",
      'export const card = <li>\n  Full\n  mission\n</li>;',
    ];
    for (const line of telling) {
      const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`), markers);
      assert.ok(leaks.some((leak) => leak.includes('holds the title or the id of an example')), line);
    }
    for (const line of ["export const text = 'the full mission of a fire fighter';", "export const text = 'Full of missions';", "export const a = 'Full'; export const b = 3; export const c = 'missions';"]) {
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`), markers), [], line);
    }
  });

  test('a file that is not code - a list of cards as .json, a stylesheet - is looked at like any other', () => {
    const markers = exampleMarkers([{ id: 'full-mission', title: 'Full mission: 180 points on the default combination' }]);
    for (const [file, text, line] of [
      ['src/simulator/ui/cards.json', '[{ "id": "full-mission" }]', "import cards from './cards.json';"],
      ['src/simulator/ui/cards.json', '[{ "title": "Full mission: 180 points on the default combination" }]', "import cards from './cards';"],
      ['src/simulator/ui/cards.json', '["Full mission"]', "const cards = () => import('@/simulator/ui/cards.json');"],
      ['src/simulator/ui/screen.css', '[data-example="full-mission"] { color: red; }', "import './screen.css';"],
      ['src/simulator/ui/notes.txt', 'Full mission', "const notes = new URL('./notes.txt', import.meta.url);"],
    ] as const) {
      const files = withFile(file, text);
      files.set('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`);
      const leaks = findLeaks(files, markers);
      assert.ok(leaks.some((leak) => leak.startsWith(`src/simulator/ui/Screen.tsx  ->  ${file}`) && leak.includes('holds the title or the id of an example')), `${file}: ${line}`);
      // the same file is nobody's business as long as nothing of the browser imports it
      assert.deepEqual(findLeaks(withFile(file, text), markers), [], file);
    }
    // a stylesheet that names a level of the examples
    const levels = [{ id: 'advanced', title: 'Advanced', about: 'the whole match' }];
    for (const css of ['[data-example-level=advanced] { color: red; }', '.level-advanced { color: red; }', '.ADVANCED::after { content: "x"; }', '.x::after { content: "the whole match"; }']) {
      const files = withFile('src/simulator/ui/screen.css', css);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport './screen.css';\nexport const Screen = () => null;\n");
      assert.ok(findLevelNames(files, levels)[0]?.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/screen.css'), css);
    }
    const harmless = withFile('src/simulator/ui/screen.css', '.card { transition: all 0.2s; } /* the clock is advancedBy one step */');
    harmless.set('src/simulator/ui/Screen.tsx', "'use client';\nimport './screen.css';\nexport const Screen = () => null;\n");
    assert.deepEqual(findLevelNames(harmless, levels), []);
    // the page the simulator stands on must not name a level either; another page of the website may say "Advanced"
    assert.equal(findLevelNames(withFile('src/app/training/simulator/fire-rescue/page.tsx', "export default function Page() { return 'Starter, Intermediate and Advanced examples'; }\n"), levels).length, 1);
    assert.deepEqual(findLevelNames(withFile('src/app/season/page.tsx', "export default function Page() { return 'Advanced sensing'; }\n"), levels), []);
  });

  test('every address of the website counts as "the browser gets it" - but the one that hands out the examples', () => {
    const line = "import { ALL_EXAMPLES } from '@/simulator/members/all-examples';\nexport const GET = () => Response.json(ALL_EXAMPLES);\n";
    for (const file of ['src/app/api/debug/route.ts', 'src/app/api/simulator/unlock/all/route.ts', 'src/app/examples.json/route.ts', 'src/pages/api/examples.ts', 'src/pages/examples.tsx', 'src/middleware.ts', 'src/proxy.ts', 'src/instrumentation.ts']) {
      const leaks = findLeaks(withFile(file, line));
      assert.ok(leaks.some((leak) => leak.startsWith(`${file}  ->  src/simulator/members/all-examples.ts`)), file);
    }
    // the same for a title that such a file holds itself
    const markers = exampleMarkers([{ id: 'full-mission', title: 'Full mission: 180 points on the default combination' }]);
    for (const file of ['src/app/api/titles/route.ts', 'src/pages/api/titles.ts', 'src/middleware.ts']) {
      assert.ok(findLeaks(withFile(file, "export const GET = () => new Response('Full mission');\n"), markers).length > 0, file);
    }
    // the route that hands out the examples, and a file of the server that no address imports, are left alone
    assert.deepEqual(findLeaks(base()), []);
    assert.deepEqual(findLeaks(withFile('src/simulator/members/helper.ts', line)), []);
  });

  test('a path that takes a detour is tidied up, and a name the guard cannot follow is reported', () => {
    for (const line of [
      "import { SAMPLE_CATALOG } from '@/simulator/ui/../fire-rescue/sample-catalog';",
      "import { SAMPLE_CATALOG } from '@/../src/simulator/fire-rescue/sample-catalog';",
      "import { SAMPLE_CATALOG } from './../ui/../fire-rescue/sample-catalog';",
      "import { SAMPLE_CATALOG } from '@/simulator//fire-rescue/sample-catalog';",
    ]) {
      const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => SAMPLE_CATALOG;\n`));
      assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/fire-rescue/sample-catalog.ts')), line);
    }
    for (const specifier of ['/home/user/site/src/simulator/fire-rescue/sample-catalog', '#examples/catalog', 'file:///site/src/simulator/fire-rescue/sample-catalog.ts']) {
      const graph = buildGraph(withFile('src/simulator/ui/Screen.tsx', `'use client';\nimport { SAMPLE_CATALOG } from '${specifier}';\nexport const Screen = () => SAMPLE_CATALOG;\n`));
      assert.deepEqual(graph.unresolved, [`src/simulator/ui/Screen.tsx -> ${specifier}`], specifier);
    }
    // a package and a part of Node are no files of the website
    assert.deepEqual(buildGraph(withFile('src/simulator/ui/Screen.tsx', "'use client';\nimport React from 'react';\nimport { join } from 'node:path';\nimport x from '@scope/package';\nexport const Screen = () => [React, join, x];\n")).unresolved, []);
  });

  test('a file in public/ that names an example is found: by its name, and by its text', () => {
    const markers = exampleMarkers([
      { id: 'hello', title: 'Hello, mBot2' },
      { id: 'full-mission', title: 'Full mission: 180 points on the default combination' },
    ]);
    const served: ServedFile[] = [
      { name: 'public/simulator/fire-rescue/mat.webp', text: null },
      { name: 'public/simulator/fire-rescue/full-mission.png', text: null },
      { name: 'public/simulator/fire-rescue/Full_Mission_solution.pdf', text: null },
      { name: 'public/simulator/fire-rescue/examples.json', text: '[{ "title": "Hello, mBot2" }]' },
      { name: 'public/simulator/fire-rescue/help.svg', text: '<svg><text>Full\n mission</text></svg>' },
      { name: 'public/training/hello.png', text: null },
      { name: 'public/gallery/2026/captions.json', text: '{ "1.webp": "The full team after its mission" }' },
    ];
    assert.deepEqual(
      findNamedExamples(served, markers).map((line) => line.split('   ')[0]),
      ['public/simulator/fire-rescue/full-mission.png', 'public/simulator/fire-rescue/Full_Mission_solution.pdf', 'public/simulator/fire-rescue/examples.json', 'public/simulator/fire-rescue/help.svg'],
    );
  });

  test("the directive is found after comments and in double quotes; a file that only mentions 'use client' is not a client file", () => {
    assert.ok(isClientFile("/** A screen. */\n// eslint-disable-next-line\n\"use client\";\nimport x from './x';\n"));
    assert.ok(isClientFile("'use strict';\n'use client';\n"));
    assert.ok(!isClientFile("import x from './x';\n'use client';\n"));
    assert.ok(!isClientFile("// 'use client'\nexport const a = 1;\n"));
    assert.ok(!isClientFile("export const text = 'use client';\n"));
  });

  test('through other files: a re-export, an alias path, a plain helper', () => {
    const files = base();
    files.set('src/simulator/ui/helpers.ts', "export * from '@/simulator/ui/more';\n");
    files.set('src/simulator/ui/more.ts', "export { ALL_EXAMPLES } from '../members/all-examples';\n");
    files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { ALL_EXAMPLES } from './helpers';\nexport const Screen = () => ALL_EXAMPLES;\n");
    const leaks = findLeaks(files);
    assert.ok(
      leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/helpers.ts  ->  src/simulator/ui/more.ts  ->  src/simulator/members/all-examples.ts  ->  src/simulator/fire-rescue/samples.ts')),
      leaks.join('\n'),
    );
  });

  test('a dynamic import(), a require() and a type-only import count too', () => {
    for (const line of ["const load = () => import('../fire-rescue/samples');", "const samples = require('../fire-rescue/samples');", "import type { SampleProgram } from '../fire-rescue/samples';"]) {
      const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`));
      assert.ok(leaks.some((leak) => leak.includes('samples.ts')), line);
    }
  });

  test('every way of writing an import is seen - also export * as, import x = require, a template without holes, a type import', () => {
    const ways = [
      "import '../fire-rescue/samples';",
      "import * as samples from '../fire-rescue/samples';",
      "import samples = require('../fire-rescue/samples');",
      "export * from '../fire-rescue/samples';",
      "export * as samples from '../fire-rescue/samples';",
      "export { SAMPLE_PROGRAMS } from '../fire-rescue/samples';",
      "export type * as Samples from '../fire-rescue/samples';",
      'const load = () => import(`../fire-rescue/samples`);',
      "const load = () => import(/* a comment */ '../fire-rescue/samples');",
      'const samples = require(`../fire-rescue/samples`);',
      "const where = require.resolve('../fire-rescue/samples');",
      "const samples = module.require('../fire-rescue/samples');",
      "const where = import.meta.resolve('../fire-rescue/samples');",
      "const where = new URL('../fire-rescue/samples.ts', import.meta.url);",
      "export type One = import('../fire-rescue/samples').SampleProgram;",
    ];
    for (const line of ways) {
      assert.deepEqual(importsOf(line).map((specifier) => specifier.replace(/\.ts$/, '')), ['../fire-rescue/samples'], line);
      const leaks = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`));
      assert.ok(leaks.some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/fire-rescue/samples.ts')), line);
    }
    // what only looks like an import is none
    for (const line of ["// import '../fire-rescue/samples';", "const text = \"import '../fire-rescue/samples'\";", "/* require('../fire-rescue/samples') */", 'const url = new URL(\'https://example.com\');']) {
      assert.deepEqual(scanImports(line), { imports: [], hidden: [] }, line);
    }
  });

  test('an import that does not name its file cannot be followed: in the browser\'s code it counts as a leak', () => {
    const hiddenWays = [
      'const load = (name: string) => import(`../fire-rescue/${name}`);',
      'const load = (name: string) => import(name);',
      "const load = (name: string) => import('../fire-rescue/' + name);",
      'const load = (name: string) => require(name);',
      "const all = require.context('../fire-rescue', false, /\\.ts$/);",
      "const all = import.meta.glob('../fire-rescue/*.ts');",
      'const where = (name: string) => new URL(name, import.meta.url);',
    ];
    for (const line of hiddenWays) {
      assert.equal(scanImports(line).hidden.length, 1, line);
      const inScreen = findLeaks(withFile('src/simulator/ui/Screen.tsx', `'use client';\n${line}\nexport const Screen = () => null;\n`));
      assert.ok(inScreen.some((leak) => leak.includes('does not name its file')), line);
      // also in a helper the screen imports
      const files = withFile('src/simulator/ui/helper.ts', `${line}\nexport const helper = 1;\n`);
      files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { helper } from './helper';\nexport const Screen = () => helper;\n");
      assert.ok(findLeaks(files).some((leak) => leak.startsWith('src/simulator/ui/Screen.tsx  ->  src/simulator/ui/helper.ts') && leak.includes('does not name its file')), line);
      // on the server and in a test it is nobody's business
      assert.deepEqual(findLeaks(withFile('src/simulator/members/server-helper.ts', `${line}\nexport const helper = 1;\n`)), [], line);
      assert.deepEqual(findLeaks(withFile('src/simulator/ui/screen.test.ts', `${line}\nexport const helper = 1;\n`)), [], line);
    }
  });

  test('a new file of examples (it imports the program builder) is caught without being listed', () => {
    const files = base();
    files.set('src/simulator/fire-rescue/more-samples.ts', "import { program } from '../vm/builder';\nexport const EXTRA = program([]);\n");
    files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { EXTRA } from '../fire-rescue/more-samples';\nexport const Screen = () => EXTRA;\n");
    const leaks = findLeaks(files);
    assert.ok(leaks.some((leak) => leak.includes('more-samples.ts') && leak.includes('imports the program builder')), leaks.join('\n'));
  });

  test('a page or a component of the website that imports the examples (they would end up in the HTML)', () => {
    for (const file of ['src/app/training/page.tsx', 'src/app/layout.tsx', 'src/components/Card.tsx']) {
      const leaks = findLeaks(withFile(file, "import { ALL_EXAMPLES } from '@/simulator/members/all-examples';\nexport default function View() { return ALL_EXAMPLES.length; }\n"));
      assert.ok(leaks.some((leak) => leak.startsWith(`${file}  ->  src/simulator/members/all-examples.ts`)), file);
    }
  });

  test('the list of codes and the code that checks one are for the server too', () => {
    const files = base();
    files.set('content/simulator-codes.ts', 'export const simulatorCodes = [];\n');
    files.set('src/simulator/ui/Screen.tsx', "'use client';\nimport { simulatorCodes } from '@content/simulator-codes';\nexport const Screen = () => simulatorCodes;\n");
    assert.ok(findLeaks(files).some((leak) => leak.includes('content/simulator-codes.ts')));
  });

  test('an import that leads to no file is reported, not skipped', () => {
    const graph = buildGraph(withFile('src/simulator/ui/Screen.tsx', "'use client';\nimport { x } from './no-such-file';\nimport './screen.css';\nimport React from 'react';\nexport const Screen = () => x;\n"));
    assert.deepEqual(graph.unresolved, ['src/simulator/ui/Screen.tsx -> ./no-such-file']);
  });
});
