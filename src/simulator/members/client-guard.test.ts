/**
 * The guard on the examples: nothing a visitor's browser gets may contain an example program
 * or the text that explains one.
 *
 * The programs and descriptions (../fire-rescue/samples.ts) are for registered members. They
 * leave the server only through /api/simulator/unlock, after a member code was checked. If a
 * file of the simulator screen - or any page of the website - started to import them, the
 * build would quietly put them back into what everybody downloads. This test reads the source
 * files, follows every import, and fails when that could happen. It names the chain of files,
 * so the import to take out is easy to find.
 *
 * What it treats as "holding programs or descriptions":
 *   - the files listed in HOLDERS below;
 *   - any file (that is not a test) which imports the program builder, vm/builder.ts: that is
 *     how an example program is written, so a new file of examples is caught without being
 *     listed here.
 *
 * Where it starts from ("what the browser gets"):
 *   - every file that begins with 'use client', and everything those import;
 *   - every page, layout and component of the website (src/app except the route handlers under
 *     src/app/api, and src/components): what a page imports can end up in the HTML it sends.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The files that hold example programs and their descriptions (paths from the repository's folder). */
const HOLDERS = ['src/simulator/fire-rescue/samples.ts', 'src/simulator/members/all-examples.ts'];

/** Files that belong to the server for other reasons: the list of codes and the code that checks one. */
const SERVER_ONLY = [
  'content/simulator-codes.ts',
  'src/simulator/members/unlock.ts',
  'src/simulator/members/code-fingerprint.mjs',
  'src/app/api/simulator/unlock/route.ts',
];

/** The program builder: whoever imports it writes programs. */
const BUILDER = 'src/simulator/vm/builder.ts';

/** The one thing about the examples the browser may have. */
const CATALOG = 'src/simulator/fire-rescue/sample-catalog.ts';

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.test\.[a-z]+$/;
/** Imports of things that are not code (stylesheets, pictures, data) lead nowhere. */
const NOT_CODE = /\.(?:css|scss|svg|png|jpe?g|webp|avif|gif|ico|json|woff2?|txt|md)$/;

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
      } else if (SOURCE_FILE.test(entry.name)) {
        files.set(relative, readFileSync(path.join(REPO_ROOT, relative), 'utf8'));
      }
    }
  };
  folders.forEach(walk);
  return files;
}

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
      if (called === 'import' || called === 'require' || called === 'require.resolve') add(node.arguments[0], node);
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
  if (specifier.startsWith('@/')) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith('@content/')) target = `content/${specifier.slice('@content/'.length)}`;
  else if (specifier.startsWith('.')) target = path.posix.join(path.posix.dirname(from), specifier);
  else return null;
  if (NOT_CODE.test(target)) return null;
  const candidates = [
    target,
    ...['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.cjs'].map((extension) => `${target}${extension}`),
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
    const found = scanImports(text);
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

/** The files that hold programs or descriptions, or belong to the server: the ones of the lists, and every file that imports the builder. */
function forbiddenFiles(files: Files, graph: Graph): Map<string, string> {
  const forbidden = new Map<string, string>();
  for (const file of HOLDERS) if (files.has(file)) forbidden.set(file, 'holds example programs and descriptions');
  for (const file of SERVER_ONLY) if (files.has(file)) forbidden.set(file, 'belongs to the server');
  for (const [file, targets] of graph.edges) {
    if (!TEST_FILE.test(file) && file !== BUILDER && targets.includes(BUILDER) && !forbidden.has(file)) {
      forbidden.set(file, 'imports the program builder, so it holds programs');
    }
  }
  return forbidden;
}

/** Where the browser's code starts: 'use client' files, and the website's pages, layouts and components. */
function browserRoots(files: Files): { client: string[]; pages: string[] } {
  const client: string[] = [];
  const pages: string[] = [];
  for (const [file, text] of files) {
    if (TEST_FILE.test(file)) continue;
    if (isClientFile(text)) client.push(file);
    else if (file.startsWith('src/components/') || (file.startsWith('src/app/') && !file.startsWith('src/app/api/'))) pages.push(file);
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

/** Every way from the browser's code to a forbidden file, as readable lines. Empty when all is well. */
function findLeaks(files: Files): string[] {
  const graph = buildGraph(files);
  const forbidden = forbiddenFiles(files, graph);
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
    assert.ok(roots.client.length >= 15, `${roots.client.length} files begin with 'use client'`);
    for (const screen of ['src/simulator/ui/SimulatorApp.tsx', 'src/simulator/ui/ExamplesDialog.tsx', 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx', 'src/simulator/ui/fire-rescue/FireRescueLoader.tsx']) {
      assert.ok(roots.client.includes(screen), `${screen} begins with 'use client'`);
    }
    assert.ok(roots.pages.includes('src/app/training/simulator/fire-rescue/page.tsx'));
    // the page reaches the screen (through a dynamic import), and the screen reaches the catalog
    const fromPage = reachableFrom(graph, 'src/app/training/simulator/fire-rescue/page.tsx');
    assert.ok(fromPage.has('src/simulator/ui/SimulatorApp.tsx'), 'page -> loader -> import() -> simulator');
    assert.ok(fromPage.has(CATALOG), 'the screen knows the list of examples');
    assert.ok(fromPage.has('src/simulator/ui/member-unlock.ts'));
    assert.ok(reachableFrom(graph, 'src/simulator/ui/fire-rescue/FireRescueSimulator.tsx').has('src/simulator/vm/index.ts'), 'and the interpreter');
  });

  test('the files that hold the examples are known to the guard', () => {
    const forbidden = forbiddenFiles(files, graph);
    for (const file of [...HOLDERS, ...SERVER_ONLY]) assert.ok(forbidden.has(file), `${file} exists`);
    // nothing but samples.ts builds programs outside the tests
    assert.deepEqual(
      [...forbidden].filter(([, why]) => why.includes('builder')).map(([file]) => file),
      [],
      'a file that imports the program builder holds programs: list it in HOLDERS and keep it on the server',
    );
    assert.ok((graph.edges.get('src/simulator/fire-rescue/samples.ts') ?? []).includes(BUILDER));
  });

  test("nothing reachable from a 'use client' file, a page, a layout or a component imports a file that holds programs or descriptions", () => {
    const leaks = findLeaks(files);
    assert.deepEqual(
      leaks,
      [],
      `\n\nExample programs or their descriptions would be sent to every visitor's browser:\n\n  ${leaks.join('\n  ')}\n\n` +
        'Take that import out. The screen may only use src/simulator/fire-rescue/sample-catalog.ts (id, title, level);\n' +
        'programs and descriptions come from the server, through /api/simulator/unlock.\n',
    );
  });

  test('the catalog - the one file about the examples the browser has - imports nothing and holds nothing but id, title and level', () => {
    const text = files.get(CATALOG);
    assert.ok(text);
    assert.deepEqual(importsOf(text), [], 'no import at all');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const word of ['description', 'program', 'blocks', 'note(']) {
      assert.ok(!code.includes(word), `sample-catalog.ts has no "${word}" outside its comments`);
    }
    // every entry of the list is one short line: { id, title, level }
    const entries = code.match(/^\s*\{.*\},?$/gm) ?? [];
    assert.equal(entries.length, 7);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: '[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test('only the server and the tests import the examples and the list of codes', () => {
    const importers = (target: string): string[] =>
      [...graph.edges]
        .filter(([file, targets]) => targets.includes(target) && !TEST_FILE.test(file))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers('src/simulator/fire-rescue/samples.ts'), ['src/simulator/members/all-examples.ts']);
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
      ['src/simulator/fire-rescue/sample-catalog.ts', "export const SAMPLE_CATALOG = [{ id: 'hello' }];\n"],
      ['src/simulator/members/all-examples.ts', "import { SAMPLE_PROGRAMS } from '../fire-rescue/samples';\nexport const ALL_EXAMPLES = SAMPLE_PROGRAMS;\n"],
      ['src/app/api/simulator/unlock/route.ts', "import { ALL_EXAMPLES } from '@/simulator/members/all-examples';\nexport const POST = () => ALL_EXAMPLES;\n"],
      ['src/simulator/fire-rescue/integration.test.ts', "import { SAMPLE_PROGRAMS } from './samples';\nvoid SAMPLE_PROGRAMS;\n"],
      ['src/simulator/ui/Screen.tsx', "'use client';\nimport { SAMPLE_CATALOG } from '../fire-rescue/sample-catalog';\nexport const Screen = () => SAMPLE_CATALOG.length;\n"],
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
