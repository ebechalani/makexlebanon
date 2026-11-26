/**
 * Where the texts of the shared screen are (design 8.2 T5): static checks of the sources.
 *
 *   (a) the phrase inventory: walking the imports from the French page, no phrase of the shared
 *       screen is left outside the word table (./en.tsx and its French twin) - a shared component
 *       holds none, and a plain module holds them only inside its text functions, which are members
 *       of the table (or the few helpers listed here, each with its reason). The other games'
 *       files, the blocks (../../blocks: design T6), the engine (its console lines: ./text.test.ts)
 *       and the French game's own files are not the shared screen;
 *   (b) the short-text scan (design 1.1): no JSX text, no string in a JSX expression (ternaries
 *       and templates included) and no `title` / `aria-label` / `unit` / `placeholder` / `label` /
 *       `hint` / `alt` of a shared component is a word - only names;
 *   (c) no shared component imports a text function of a plain module (design 2.3 rule 2); no
 *       default of a shared file is an English sentence or formatter (rule 3); and every element of
 *       ../SimulatorApp.tsx whose component takes `words` is given `words=`.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { EN_TEXT } from './en';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(HERE, '..');
const SIMULATOR = path.join(UI, '..');
const SRC = path.join(SIMULATOR, '..');
const ROOT = path.join(SRC, '..');
const rel = (file: string): string => path.relative(SIMULATOR, file).split(path.sep).join('/');

/** The page of Robot en fête 2027 (design 7.3) - and, while it is not written yet, the shared screen it shows. */
const FRENCH_PAGE = path.join(SRC, 'app', 'simulator', 'robot-en-fete', 'page.tsx');
const SCREEN_ENTRIES = [path.join(UI, 'SimulatorApp.tsx'), path.join(UI, 'TitleBar.tsx')];

/** The files of the shared screen: directly in ../ (not a game's folder, not the tables), no test. */
const SHARED_FILES = readdirSync(UI)
  .filter((name) => /\.tsx?$/.test(name) && !name.endsWith('.test.ts'))
  .map((name) => path.join(UI, name));
/** ... its components (and the hook that writes the console lines, design 2.3 rule 4) */
const SHARED_COMPONENTS = SHARED_FILES.filter((file) => file.endsWith('.tsx') || file.endsWith('useSimulation.ts'));
/** ... and its plain modules whose text functions are members of the table (design 2.3 rule 2) */
const TEXT_MODULES = ['format', 'match-words', 'ruler', 'stage-view', 'start-pose', 'robot-parts', 'program-file', 'examples-words', 'batch-words', 'screen-words', 'scenario-code', 'gripper-code-words'];

// =============================================================================================
// Reading the sources
// =============================================================================================

const sources = new Map<string, ts.SourceFile>();
function sourceOf(file: string): ts.SourceFile {
  let source = sources.get(file);
  if (!source) {
    source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    sources.set(file, source);
  }
  return source;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('@content/')) base = path.join(ROOT, 'content', spec.slice('@content/'.length));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const ending of ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts', '/index.tsx']) {
    const file = base + ending;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/** The modules a file imports for their values (an import of types only brings no text). */
function valueImports(file: string): Array<{ spec: string; target: string | null; names: string[] }> {
  const found: Array<{ spec: string; target: string | null; names: string[] }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause?.isTypeOnly) {
        const names: string[] = [];
        if (clause?.name) names.push('default');
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text);
        if (bindings && ts.isNamespaceImport(bindings)) names.push('*');
        if (names.length > 0 || !clause) found.push({ spec: node.moduleSpecifier.text, target: resolveImport(file, node.moduleSpecifier.text), names });
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      found.push({ spec: node.moduleSpecifier.text, target: resolveImport(file, node.moduleSpecifier.text), names: ['*'] });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      found.push({ spec: node.arguments[0].text, target: resolveImport(file, node.arguments[0].text), names: ['*'] });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceOf(file));
  return found;
}

/** What a file of the page is. Only 'shared' files are the shared screen; the walk goes through the others. */
type Kind = 'shared' | 'table' | 'french' | 'game' | 'blocks' | 'engine' | 'site' | 'unread';
function kindOf(file: string): Kind {
  const inSrc = path.relative(SRC, file).split(path.sep);
  // (the site's data, the codes of the members, a stylesheet: never read here)
  if (inSrc[0] === '..' || (inSrc[0] === 'simulator' && inSrc[1] === 'members') || !/\.(ts|tsx|mts)$/.test(file)) return 'unread';
  if (inSrc.includes('robot-en-fete')) return 'french';
  if (inSrc[0] !== 'simulator') return 'site';
  const [, top, sub] = inSrc;
  if (top === 'ui') return sub === 'text' ? 'table' : inSrc.length > 3 ? 'game' : 'shared';
  if (top === 'blocks') return 'blocks';
  if (top === 'core' || top === 'vm') return 'engine';
  return 'game';
}

/** Every file the page reaches through its imports (the French page; while it is not there, the shared screen). */
function reachedFiles(): { entries: string[]; files: Map<string, Kind> } {
  const entries = existsSync(FRENCH_PAGE) ? [FRENCH_PAGE] : SCREEN_ENTRIES;
  const files = new Map<string, Kind>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    const kind = kindOf(file);
    files.set(file, kind);
    if (kind === 'unread' || kind === 'blocks' || kind === 'engine') continue;
    for (const { target } of valueImports(file)) if (target && !files.has(target)) queue.push(target);
  }
  return { entries, files };
}

// =============================================================================================
// What is a text
// =============================================================================================

/** JSX attributes that never hold a text the visitor reads or hears. */
const CODE_ATTRIBUTES = /^(className|style|key|id|htmlFor|href|role|type|rel|target|src|name|accept|tabIndex|viewBox|d|fill|stroke|xmlns|points|transform|strokeLinecap|strokeLinejoin|strokeWidth|fillRule|clipRule|width|height|x|y|cx|cy|r|rx|ry|x1|x2|y1|y2|opacity|lang|dir|mode|align|widthClass|tone|kind|place|variant|autoComplete|autoCapitalize|autoCorrect|enterKeyHint|inputMode|spellCheck|wrap|scope|aria-live|aria-haspopup|aria-hidden|aria-current|aria-orientation|aria-controls|aria-labelledby|aria-describedby|aria-expanded|aria-pressed|aria-checked|aria-selected|aria-modal|aria-disabled|aria-invalid|aria-busy|aria-atomic|aria-valuemin|aria-valuemax|aria-valuenow|data-.*|on[A-Z].*)$/;
/** Calls whose strings are no text: storage keys, selectors, string handling, the developer's console ... */
const CODE_CALLS = /^(storageKey|loadJson|saveJson|require|querySelector|querySelectorAll|getElementById|createElement|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|getItem|setItem|removeItem|matchMedia|startsWith|endsWith|includes|split|join|replace|replaceAll|indexOf|lastIndexOf|padStart|padEnd|toFixed|localeCompare|test|match|matchAll|search|exec|RegExp|getContext|getPropertyValue|setProperty|dispatchEvent|postMessage|fetch|toLocaleString|getFieldValue|getField|getInput|registerButtonCallback|registerToolboxCategoryCallback|getElementsByClassName|closest|contains|warn|error|log|info|debug)$/;

/** A Tailwind class list: no text. */
const looksLikeClasses = (text: string): boolean => {
  const words = text.trim().split(/\s+/);
  return words.every((w) => /^[!a-z0-9@:[\]\-_/.%()#&>~*=',+]+$/.test(w)) && words.some((w) => /[-:[]/.test(w) && /[a-z]/.test(w));
};
/** A CSS colour or font, a selector: no text. */
const looksLikeStyle = (text: string): boolean => /^(rgba?|hsla?)\(/.test(text) || /\bpx\b|sans-serif|monospace/.test(text) || /:not\(|\[[a-z-]+[\]=]/.test(text);
/** One word that is code (an id, a value, a field name: "left", "EM1", "sort-x"); "Start" and "Zones" are words. */
const looksLikeToken = (text: string): boolean => /^[A-Za-z0-9_.#\-:/]+$/.test(text) && !/^[A-Z][a-z]+$/.test(text);
/** A phrase: what a visitor could read (letters; no class list, no style; not one code-like word). The values of a template ({}) are left out. */
const isPhrase = (text: string): boolean => {
  const spaced = text.replace(/\{\}/g, ' ').replace(/\s+/g, ' ').trim();
  const joined = text.replace(/\{\}/g, '').replace(/\s+/g, ' ').trim();
  return /[A-Za-zÀ-ÿ]{2,}/.test(spaced) && !looksLikeClasses(spaced) && !looksLikeStyle(spaced) && !looksLikeToken(joined);
};

/** Why a string literal is no text, or null when it may be one. */
function codeContext(node: ts.Node): string | null {
  const parent = node.parent;
  if (!parent) return null;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return 'module';
  if (ts.isLiteralTypeNode(parent)) return 'type';
  if (ts.isExpressionStatement(parent)) return 'directive';
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return 'key';
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return 'index';
  if (
    ts.isBinaryExpression(parent) &&
    [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(parent.operatorToken.kind)
  )
    return 'compare';
  if (ts.isCaseClause(parent)) return 'case';
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    const callee = parent.expression.getText();
    if (parent.expression.kind === ts.SyntaxKind.ImportKeyword) return 'module';
    if (CODE_CALLS.test(callee.split('.').pop() ?? '')) return `call ${callee}`;
    if (ts.isNewExpression(parent) && /Error$/.test(callee)) return 'an error for the developer';
  }
  // inside a JSX attribute: an attribute of code (className={x ? 'a' : 'b'} included)
  for (let up: ts.Node | undefined = parent, i = 0; up && i < 8; up = up.parent, i++) {
    if (ts.isJsxAttribute(up)) return CODE_ATTRIBUTES.test(up.name.getText()) ? `attribute ${up.name.getText()}` : null;
    if (ts.isPropertyAssignment(up) && /^(className|style|kind|tone|shape|type|id|level|key|colour|color|fill|stroke|ring)$/.test(up.name.getText())) return `property ${up.name.getText()}`;
    if (ts.isJsxElement(up) || ts.isJsxSelfClosingElement(up) || ts.isFunctionLike(up) || ts.isStatement(up)) break;
  }
  return null;
}

interface Phrase {
  file: string;
  line: number;
  text: string;
  /** the top-level declaration it is in (the name of a function or a constant), or null */
  owner: string | null;
}

/** The name of the top-level declaration a node is in. */
function ownerOf(node: ts.Node): string | null {
  let top: ts.Node = node;
  while (top.parent && !ts.isSourceFile(top.parent)) top = top.parent;
  if (ts.isFunctionDeclaration(top) || ts.isClassDeclaration(top)) return top.name?.text ?? null;
  if (ts.isVariableStatement(top)) {
    const declaration = top.declarationList.declarations.find((d) => d.pos <= node.pos && node.end <= d.end) ?? top.declarationList.declarations[0];
    return ts.isIdentifier(declaration.name) ? declaration.name.text : null;
  }
  return null;
}

/** Every phrase of a file: JSX texts, string literals and the pieces of templates that may be texts. */
function phrasesOf(file: string): Phrase[] {
  const source = sourceOf(file);
  const phrases: Phrase[] = [];
  const add = (node: ts.Node, text: string) => {
    if (!isPhrase(text)) return;
    phrases.push({ file: rel(file), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: text.replace(/\s+/g, ' ').trim(), owner: ownerOf(node) });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) add(node, node.getText());
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && codeContext(node) === null) add(node, node.text);
    else if (ts.isTemplateExpression(node) && codeContext(node) === null) {
      let text = node.head.text;
      for (const span of node.templateSpans) text += `{} ${span.literal.text}`;
      add(node, text.replace(/\{\} /g, '{}'));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return phrases;
}

// =============================================================================================
// (a) the phrase inventory
// =============================================================================================

/** Every value of the English table, those of its parts too (EN_TEXT.gripper.title). */
const TABLE_VALUES = new Set<unknown>();
(function collect(table: object) {
  for (const value of Object.values(table)) {
    TABLE_VALUES.add(value);
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && !('$$typeof' in value)) collect(value);
  }
})(EN_TEXT);

/**
 * The exports of a plain module that ARE the English table: a text function the table names
 * (EN_TEXT.x === the export), or a list of words each of which the table holds.
 */
async function tableMembersOf(module: string): Promise<Set<string>> {
  const exports = (await import(`../${module}`)) as Record<string, unknown>;
  const isMember = (value: unknown): boolean => {
    if (TABLE_VALUES.has(value)) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const values = Object.values(value);
    return values.length > 0 && values.every((v) => TABLE_VALUES.has(v));
  };
  return new Set(Object.keys(exports).filter((name) => isMember(exports[name])));
}

/**
 * The declarations of a plain module that hold English texts and are no member of the table: a
 * helper of a member (the French twin of the member replaces it too), or a game's word list,
 * whose English default stays (design 2.3 rule 3). Each with its reason; a new one fails the test
 * until it is listed here or moved into the table.
 */
const ALLOWED_DECLARATIONS: Record<string, string> = {
  'ui/format.ts restartLine': "part of describeEvent's restart line (French twin: frRestartLine, ./fr-common.tsx)",
  'ui/format.ts restartsLeftText': 'part of restartLine and restartSummary (French twin: frRestartsLeftText)',
  'ui/format.ts restartNote': 'part of restartSummary (French twin: frRestartNote)',
  'ui/format.ts CYBERPI_PANEL_HOLDS': 'part of cyberPiSummary (French twin: ./fr-panels.tsx)',
  'ui/examples-words.ts WHAT_THEY_ARE': 'part of examplesIntro (French twin: ./fr-screen.tsx)',
  'ui/examples-words.ts HOW_LOADING_WORKS': 'part of examplesIntro (French twin: ./fr-screen.tsx)',
  'ui/examples-words.ts waitInWords': 'part of codeMessage (French twin: ./fr-screen.tsx)',
  'ui/program-file.ts RETIRED_BLOCKS': 'the part a retired block was for, given to retiredBlocksNote (French: FR_RETIRED_PARTS)',
  'ui/program-file.ts foreignBlocks': "the names of the groups otherGameNote lists (French: frenchGroup, ./fr-stage.tsx)",
  'ui/ruler.ts RULER_LABEL_WORDS': 'the words of rulerLabels (French twin: ./fr-stage.tsx)',
  'ui/screen-words.ts DEFAULT_WORDS': "a game's word list: its English default stays for the English pages and the tests (design 2.3 rule 3); the French page passes its own words, Required<ScreenWords>",
  'ui/program-file.ts GAME_NAMES': 'the names of the games, as their title rows write them (names: the same in both languages)',
  'ui/powered-by.ts POWERED_BY': 'the name of the academy (design 1.2: it stays)',
  'ui/gripper-code-words.ts UNDO_ADD': 'part of addedMessage, in the window "Inside the Gripper blocks" (French twin: ./gripper.tsx)',
};

/** Texts a shared component may hold, and why: a name, or a key the table turns into words. */
const ALLOWED_IN_COMPONENTS: Record<string, string> = {
  'ui/SimulatorApp.tsx "this program"': "a key, not a text: retiredBlocksNote's `whose` (the French table maps it: ./fr-stage.tsx FR_WHOSE)",
  'ui/BlocklyEditor.tsx "your saved program"': "a key, not a text: retiredBlocksNote's `whose`",
};

test('(a) the phrase inventory: from the French page, no phrase of the shared screen is outside the word table', async (t) => {
  const { entries, files } = reachedFiles();
  if (entries[0] !== FRENCH_PAGE) t.diagnostic('the French page (src/app/simulator/robot-en-fete/page.tsx) is not there yet: the walk starts at the shared screen');
  const shared = [...files].filter(([, kind]) => kind === 'shared').map(([file]) => file);
  // (the walk reaches the whole shared screen, the table and the plain modules of the table)
  for (const name of ['SimulatorApp.tsx', 'TitleBar.tsx', 'ControlBar.tsx', 'ScoreSheet.tsx', 'SensorDashboard.tsx', 'ConsolePanel.tsx', 'format.ts', 'match-words.ts', 'ruler.ts', 'program-file.ts']) {
    assert.ok(shared.includes(path.join(UI, name)), `the walk reaches ui/${name}`);
  }
  assert.ok(files.get(path.join(HERE, 'en.tsx')) === 'table' && files.get(path.join(HERE, 'fr.tsx')) === 'table', 'the walk reaches both tables');

  const left: string[] = [];
  const used = new Set<string>();
  for (const file of shared) {
    const phrases = phrasesOf(file);
    const module = path.basename(file).replace(/\.tsx?$/, '');
    if (file.endsWith('.tsx') || module === 'useSimulation') {
      // a shared component holds no text of its own: it reads them all from the table
      for (const p of phrases) {
        const key = `${p.file} ${JSON.stringify(p.text)}`;
        if (ALLOWED_IN_COMPONENTS[key]) used.add(key);
        else left.push(`${p.file}:${p.line} ${JSON.stringify(p.text)}`);
      }
      continue;
    }
    const members = await tableMembersOf(module);
    for (const p of phrases) {
      const key = `${p.file} ${p.owner}`;
      if (p.owner !== null && members.has(p.owner)) continue;
      if (ALLOWED_DECLARATIONS[key]) {
        used.add(key);
        continue;
      }
      left.push(`${p.file}:${p.line} (in ${p.owner ?? 'the file'}) ${JSON.stringify(p.text)}`);
    }
  }
  assert.deepEqual(left, [], `phrases outside the word table:\n${left.join('\n')}`);
  // (the list names only declarations that hold a text)
  assert.deepEqual(
    [...Object.keys(ALLOWED_DECLARATIONS), ...Object.keys(ALLOWED_IN_COMPONENTS)].filter((key) => !used.has(key)),
    [],
  );
});

// =============================================================================================
// (b) the short texts
// =============================================================================================

/** Names and signs: the same on both pages (design 1.1). */
const NAMES = new Set(['CyberPi', 'mBot2', 'mBlock', 'mTiny', 'Max', 'Score', 'Total', 'Zones', 'Console', 'Info', 'Joystick', 'A', 'B', 'L1', 'L2', 'R1', 'R2', 'EM1', 'EM2', 'S1', 'S2', 'cm', 'mm', 's', '°', '%', 'x', 'y', 'OK', 'RGB', 'Hz', 'LED', 'JSON', 'Ctrl']);
/** The attributes whose value a visitor reads or hears. */
const TEXT_ATTRIBUTES = new Set(['title', 'aria-label', 'unit', 'placeholder', 'label', 'hint', 'alt', 'aria-valuetext', 'aria-roledescription']);
/** A short text: one or two words with letters. */
const isWordy = (text: string): boolean => /[A-Za-zÀ-ÿ]{2,}/.test(text) && text.trim().split(/\s+/).length <= 2;

/** Every short text a shared component puts on the screen itself (design 1.1, probes/rev-oneword-scan.mts). */
function shortTextsOf(file: string): Array<{ line: number; text: string; how: string }> {
  const source = sourceOf(file);
  const found: Array<{ line: number; text: string; how: string }> = [];
  const add = (node: ts.Node, text: string, how: string) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t && isWordy(t) && !NAMES.has(t)) found.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: t, how });
  };
  /** a string inside a JSX expression that reaches the screen (not a comparison, not an argument of a call) */
  const inJsxExpression = (node: ts.Node): boolean => {
    for (let up = node.parent; up; up = up.parent) {
      if (ts.isJsxExpression(up)) return !ts.isJsxAttribute(up.parent) || TEXT_ATTRIBUTES.has(up.parent.name.getText());
      if (ts.isCallExpression(up) || (ts.isBinaryExpression(up) && ['===', '!==', '==', '!='].includes(up.operatorToken.getText()))) return false;
      if (ts.isJsxElement(up) || ts.isJsxSelfClosingElement(up) || ts.isFunctionLike(up)) return false;
    }
    return false;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) add(node, node.getText(), 'JSX text');
    else if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer)) add(node, node.initializer.text, `${node.name.getText()}=`);
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !ts.isJsxAttribute(node.parent) && inJsxExpression(node)) add(node, node.text, 'a string in JSX');
    else if (ts.isTemplateExpression(node) && inJsxExpression(node)) for (const piece of [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]) add(node, piece, 'a template piece in JSX');
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test('(b) the short texts: no word of a shared component is its own - only names; every word is in the table', () => {
  const words: string[] = [];
  const components = SHARED_FILES.filter((file) => file.endsWith('.tsx'));
  assert.ok(components.length >= 15, `${components.length} shared components`);
  for (const file of components) for (const s of shortTextsOf(file)) words.push(`${rel(file)}:${s.line} ${s.how} ${JSON.stringify(s.text)}`);
  assert.deepEqual(words, [], `short texts of the shared screen outside the word table:\n${words.join('\n')}`);
  // (the scan finds each kind)
  const probe = path.join(HERE, 'en.tsx');
  assert.ok(shortTextsOf(probe).some((s) => s.text === 'Sound' && s.how === 'JSX text'), 'the scan sees a JSX text');
  assert.ok(shortTextsOf(probe).some((s) => s.text === 'on' || s.text === 'off'), 'the scan sees a string in a ternary');
});

// =============================================================================================
// (c) imports, defaults, words=
// =============================================================================================

/** The text declarations of each plain module of the table: its members of the table, and every declaration holding a phrase. */
async function textDeclarations(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const module of TEXT_MODULES) {
    const names = await tableMembersOf(module);
    for (const p of phrasesOf(path.join(UI, `${module}.ts`))) if (p.owner) names.add(p.owner);
    map.set(module, names);
  }
  return map;
}

/** What a shared component may import from a plain module although it holds words: a game's word list (design 2.3 rule 3), and no text. */
const ALLOWED_IMPORTS: Record<string, string> = {
  'screen-words DEFAULT_WORDS': "the English default of a game's word list (rule 3); SimulatorApp passes words= to every child",
  'screen-words capital': 'no text: it writes the first letter of a text as a capital',
};

test('(c) no shared component imports a text function of a plain module: it reads the table (design 2.3 rule 2)', async () => {
  const declarations = await textDeclarations();
  // (the rule's own list is among them)
  for (const name of ['formatNumber', 'formatClock', 'formatStamp', 'formatRefereeTime', 'timeTextOf', 'finishText', 'bodyName', 'describeEvent']) assert.ok(declarations.get('format')?.has(name), name);
  for (const name of ['restartButton', 'finishSentence', 'rulerText', 'rulerLabels', 'readyHint', 'homeButtonWords', 'sensorSummary', 'otherGameNote', 'retiredBlocksNote', 'codeMessage', 'endSentence', 'scoreSheetSummary']) {
    assert.ok([...declarations.values()].some((names) => names.has(name)), name);
  }
  const wrong: string[] = [];
  for (const file of SHARED_COMPONENTS) {
    for (const { target, names } of valueImports(file)) {
      if (!target || path.dirname(target) !== UI) continue;
      const module = path.basename(target).replace(/\.tsx?$/, '');
      const texts = declarations.get(module);
      if (!texts) continue;
      for (const name of names) if ((name === '*' || texts.has(name)) && !ALLOWED_IMPORTS[`${module} ${name}`]) wrong.push(`${rel(file)} imports ${name} from ./${module}`);
    }
  }
  assert.deepEqual(wrong, []);
  // (and the table is where the shared components get their words: each of them reads it, or has no word at all;
  // the title row reads its own part of it, from the same context - ./title-context.tsx)
  for (const file of SHARED_COMPONENTS) {
    const text = readFileSync(file, 'utf8');
    if (/useScreenText\(\)/.test(text)) continue;
    if (path.basename(file) === 'TitleBar.tsx' && /useTitleText\(\)/.test(text)) continue;
    assert.ok(['icons.tsx'].includes(path.basename(file)), `${rel(file)} does not read the table`);
  }
});

/** A default an English page and the French page share: allowed only where it is the table the English page gets anyway. */
const ALLOWED_DEFAULTS: Record<string, string> = {
  "ui/ScoreSheet.tsx lineTime text = EN_TEXT":
    'an exported helper whose tests call it with one argument: its default is the English table itself (the one the context gives an English page); the screen passes the context’s table',
  'ui/BatchDialog.tsx words = DEFAULT_WORDS': "a game's word list (rule 3): SimulatorApp passes words=",
  'ui/CombinationPanel.tsx words = DEFAULT_WORDS': "a game's word list (rule 3)",
  'ui/ScoreSheet.tsx words = DEFAULT_WORDS': "a game's word list (rule 3)",
  'ui/ControlBar.tsx props.words = DEFAULT_WORDS': "a game's word list (rule 3)",
};

test('(c) no default of a shared file is an English sentence or formatter: a default reads the table (design 2.3 rule 3)', async () => {
  const declarations = await textDeclarations();
  const textNames = new Set([...declarations.values()].flatMap((names) => [...names]));
  const files = SHARED_FILES.filter((file) => file.endsWith('.tsx') || /useSimulation|render\.ts$/.test(file));
  const found: string[] = [];
  const seen = new Set<string>();
  /** what is wrong with a default value, or null */
  const english = (expr: ts.Expression): string | null => {
    if ((ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) && isPhrase(expr.text) && !NAMES.has(expr.text.trim())) return 'an English text';
    if (ts.isTemplateExpression(expr) && [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].some(isPhrase)) return 'an English text';
    const name = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) ? expr.getText() : null;
    if (name === null) return null;
    if (/^EN_TEXT\b/.test(name)) return 'the English table';
    if (textNames.has(name.split('.').pop() as string) && !name.startsWith('text.')) return 'an English text function';
    return null;
  };
  for (const file of files) {
    const source = sourceOf(file);
    const visit = (node: ts.Node): void => {
      let value: ts.Expression | undefined;
      let target = '';
      if ((ts.isParameter(node) || ts.isBindingElement(node)) && node.initializer) {
        value = node.initializer;
        target = node.name.getText();
      } else if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
        value = node.right;
        target = node.left.getText();
      }
      if (value) {
        const problem = english(value);
        if (problem) {
          const owner = ownerOf(node);
          const key = `${rel(file)} ${owner === null ? '' : `${owner} `}${target} = ${value.getText()}`;
          const short = `${rel(file)} ${target} = ${value.getText()}`;
          const allowed = ALLOWED_DEFAULTS[key] ?? ALLOWED_DEFAULTS[short];
          if (allowed) seen.add(ALLOWED_DEFAULTS[key] ? key : short);
          else found.push(`${key} (${problem}), line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(found, []);
  // the defaults that are game word lists are DEFAULT_WORDS (checked as an English text function: it holds phrases) ...
  assert.ok(textNames.has('DEFAULT_WORDS'));
  // ... and every allowed default still exists
  assert.deepEqual(
    Object.keys(ALLOWED_DEFAULTS).filter((key) => !seen.has(key)),
    [],
  );
  // (the check finds each kind: a sentence, a formatter, the English table)
  const probe = ts.createSourceFile('probe.tsx', "function f(a = 'the table wall', b = formatStamp, c = EN_TEXT.moment) { return x ?? 'Picked up'; }", ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const caught: string[] = [];
  const look = (node: ts.Node): void => {
    if (ts.isParameter(node) && node.initializer && english(node.initializer)) caught.push(node.name.getText());
    if (ts.isBinaryExpression(node) && english(node.right)) caught.push('??');
    ts.forEachChild(node, look);
  };
  look(probe);
  assert.deepEqual(caught, ['a', 'b', 'c', '??']);
});

test('(c) every element of SimulatorApp.tsx whose component takes `words` is given `words=` (design 2.3 rule 3)', () => {
  const app = path.join(UI, 'SimulatorApp.tsx');
  const config = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT).options;
  const program = ts.createProgram([app], { ...options, noEmit: true, incremental: false, plugins: [] });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(app) as ts.SourceFile;
  const takesWords: string[] = [];
  const missing: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^[A-Z]/.test(node.tagName.getText())) {
      const type = checker.getTypeAtLocation(node.tagName);
      const signature = [...type.getCallSignatures(), ...type.getConstructSignatures()][0];
      const props = signature?.getParameters()[0];
      const propsType = props ? checker.getTypeOfSymbolAtLocation(props, node) : undefined;
      if (propsType && propsType.getProperty('words')) {
        const name = node.tagName.getText();
        takesWords.push(name);
        const given = node.attributes.properties.some(
          (a) => (ts.isJsxAttribute(a) && a.name.getText() === 'words') || (ts.isJsxSpreadAttribute(a) && checker.getTypeAtLocation(a.expression).getProperty('words') !== undefined),
        );
        if (!given) {
          missing.push(`${name}, line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  // (the screen's parts that take a game's words are found)
  for (const name of ['ControlBar', 'StatusLine', 'ScoreSheet', 'CombinationPanel', 'BatchDialog']) assert.ok(takesWords.includes(name), name);
  assert.deepEqual(missing, []);
});

test("(c) the French page's word list leaves no word to its English default: Required<ScreenWords>", (t) => {
  // (the French screen's own folder: its word list is ./robot-en-fete/words.ts, design 8.1)
  const folder = path.join(UI, 'robot-en-fete');
  const files = existsSync(folder) ? readdirSync(folder).filter((name) => /\.tsx?$/.test(name) && !name.endsWith('.test.ts')) : [];
  const sources = files.map((name) => readFileSync(path.join(folder, name), 'utf8'));
  if (!sources.some((source) => /\bScreenWords\b/.test(source))) {
    t.diagnostic('the French screen has no word list yet (ui/robot-en-fete)');
    return;
  }
  assert.ok(
    sources.some((source) => /satisfies Required<ScreenWords>/.test(source)),
    'the French ScreenWords are typed `satisfies Required<ScreenWords>`',
  );
});
