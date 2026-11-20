/**
 * The screen of Fire Cadet without a browser (design 12.7): its parts drawn to HTML with
 * react-dom/server and, in a stand-in document (jsdom), tapped as a child or a teacher would.
 *
 *   - Words: no file of the screen but ./words.ts and ./rules.ts holds an English sentence (the
 *     string literals and the text of every file are read); no level name, no example title and no
 *     example id is in the folder, the page or the loader.
 *   - Sizes: every control a child uses has a class that makes it at least 48 x 48 px, and the
 *     stylesheet gives those classes 48 px or more. (The squares of the editor's board follow the
 *     width of the window: a browser measures them, design 12.11.)
 *   - Names: every aria-label of design 7.13.
 *   - The row, the panel, the map picker and the own-map editor, tapped in a document.
 *   - The stage's drawings (./paint.ts) in a recording context: the four items and the three
 *     obstacles by their kind, the robot, the Fire marker; a token is never smaller than
 *     TOKEN_MIN_PIXELS across.
 *   - The page and the wiring of the screen: the page's words (design 10.5), the loader, and what
 *     the screen hands the shared stage.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createSimulation } from '../../core/simulation';
import type { Body, Simulation } from '../../core/types';
import { CARD_NAMES, ROW_PROBLEM_WORDS, cardRowProgram, cardsFromText, type CardName, type MoveCard } from '../../fire-cadet/cards';
import { fireCadetGame, itemBodyKind, itemId, obstacleBodyKind, obstacleId } from '../../fire-cadet/game';
import { FIRE_CADET } from '../../fire-cadet/numbers';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG } from '../../fire-cadet/sample-catalog';
import { ITEM_NAMES, OBSTACLE_KINDS, PRACTICE_MAPS, encodeScenario, placeProblem, readMapCode, type FireCadetScenario } from '../../fire-cadet/scenario';
import { findRowForAllPoints } from '../../fire-cadet/solver';
import { fitView, type StageView } from '../render';
import { Banner } from './Banner';
import { rowOf, type RowState } from './card-row';
import { CardRow, type CardRowProps } from './CardRow';
import { DirectionPanel } from './DirectionPanel';
import { GoButton } from './GoButton';
import { MapEditor } from './MapEditor';
import { SOLVER_PAUSE_MS } from './map-editor';
import { MapPicker } from './MapPicker';
import { MatchClock, MatchPoints, ModeSwitch, SpeedButtons } from './MatchBar';
import { FLAME_MM, HINT_MM, PICTURE_OF_KIND, cadetPainters, paintElement, tokenSize } from './paint';
import { PlanningClock } from './PlanningClock';
import { planningIdle } from './planning-clock';
import { RulesWindow } from './RulesWindow';
import { ScoreStrip } from './ScoreStrip';
import { CADET_WORDS, solverLine } from './words';

const f = FIRE_CADET;
const here = (name: string): string => fileURLToPath(new URL(name, import.meta.url));
const read = (name: string): string => readFileSync(here(name), 'utf8');
const nothing = (): void => undefined;
const P1 = PRACTICE_MAPS[0];

/** The files of the screen (not its tests). */
const SCREEN_FILES = readdirSync(here('.')).filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts'));
/** The page and the loader, read with the screen. */
const PAGE = fileURLToPath(new URL('../../../app/simulator/fire-cadet/page.tsx', import.meta.url));

/** What a reader sees: the tags taken out, the quotation marks back as typed. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const draw = (element: ReactElement): string => renderToStaticMarkup(element);
const labels = (html: string): string[] => [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"'));

const cardRowProps = (row: RowState, change: Partial<CardRowProps> = {}): CardRowProps => ({
  row,
  onEdit: nothing,
  onRefused: nothing,
  onEmptied: nothing,
  locked: false,
  running: null,
  nth: 0,
  times: 0,
  doneBefore: 0,
  refusal: null,
  refusals: 0,
  said: '',
  ...change,
});

// =============================================================================================
// Words: only words.ts and rules.ts hold English sentences
// =============================================================================================

/** Small words that a class list, a path or a key name never holds, but an English sentence nearly always does. */
const SMALL_WORDS = /^(the|a|an|to|of|and|or|is|are|in|on|it|its|your|you|this|that|with|for|not|no|here|there|first|card|cards|map|robot|tap|press|row|points?)$/i;

/** Does this text read as English words (rather than a class list, a path, a colour or a key)? */
function readsAsEnglish(t: string): boolean {
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (/[.!?]$/.test(t) && /[A-Za-z]{2,}/.test(t)) return true;
  if (/(^|\s)[A-Z][a-z]+\s+[A-Za-z]/.test(t)) return true;
  return words.some((w) => SMALL_WORDS.test(w.replace(/[.,:;!?]$/, '')));
}

/** Every text of a source file that a screen could show: string literals, the parts of template literals, and JSX text. */
function shownTexts(name: string, source: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (/[A-Za-z]/.test(node.text)) out.push(`jsx: ${node.text.trim()}`);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // (not the names of modules, not the directive 'use client')
      const skip = ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExpressionStatement(node.parent);
      if (!skip && readsAsEnglish(node.text.trim())) out.push(node.text.trim());
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (readsAsEnglish(node.text.trim())) out.push(node.text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

test('the reading of English words works: a sentence, a label and a JSX text are found; class lists, paths and keys are not', () => {
  const found = shownTexts('X.tsx', `
    const a = 'Press GO first.';
    const b = 'Add a card';
    const c = 'cadet-touch inline-flex items-center rounded-xl border-2 px-3 hover:bg-slate-50';
    const d = 'M13 5H47A10 10 0 0 1 57 15V26';
    const e = 'ArrowLeft';
    const g = \`\${x} min-h-12 min-w-12 justify-center\`;
    const h = <p className="text-sm">Tap a card</p>;
  `);
  assert.deepEqual(found, ['Press GO first.', 'Add a card', 'jsx: Tap a card']);
});

test('every word of the screen is in words.ts or rules.ts: no other file of the folder holds an English sentence', () => {
  /** the one exception: the title the title row prints, which the site's test reads in the loader as it is written (ui/site-section.test.ts) */
  const ALLOWED = new Set([CADET_WORDS.title]);
  assert.ok(SCREEN_FILES.includes('FireCadetSimulator.tsx') && SCREEN_FILES.length >= 22, SCREEN_FILES.join(', '));
  for (const name of SCREEN_FILES) {
    if (name === 'words.ts' || name === 'rules.ts') continue;
    const found = shownTexts(name, read(name)).filter((t) => !ALLOWED.has(t));
    assert.deepEqual(found, [], `${name} holds words of its own`);
  }
  // and the two that do hold them really do
  assert.ok(shownTexts('words.ts', read('words.ts')).length > 40);
  assert.ok(shownTexts('rules.ts', read('rules.ts')).length > 40);
  // the stylesheet shows no words either (no "content" but the empty one)
  for (const m of read('fire-cadet.css').matchAll(/(?:^|[\s;{])content:\s*([^;]+);/g)) assert.equal(m[1].trim(), "''");
});

test('no level name, no example title and no example id is in the screen, the page or the loader (the examples come from the server)', () => {
  const sources = [...SCREEN_FILES.map((name) => [name, read(name)] as const), ['page.tsx', readFileSync(PAGE, 'utf8')] as const];
  const forbidden = [
    ...EXAMPLE_LEVELS.map((level) => level.title),
    ...EXAMPLE_LEVELS.map((level) => `'${level.id}'`),
    ...EXAMPLE_LEVELS.map((level) => level.about),
    ...SAMPLE_CATALOG.map((card) => card.title),
    ...SAMPLE_CATALOG.map((card) => card.id),
  ];
  assert.equal(forbidden.length, 3 * 3 + 6 * 2);
  for (const [name, source] of sources) {
    for (const word of forbidden) assert.ok(!source.toLowerCase().includes(word.toLowerCase()), `${name} holds "${word}"`);
  }
});

// =============================================================================================
// Sizes: every control a child uses is at least 48 x 48 px
// =============================================================================================

/** The classes that make a control at least 48 x 48 px, with the rule of the stylesheet (or of Tailwind) that does it. */
const SIZE_CLASSES = ['cadet-touch', 'cadet-row-card', 'cadet-box-card', 'cadet-panel-card', 'cadet-go', 'cadet-square'] as const;

/** Every control of a piece of markup: buttons, inputs, and the cards of the row and the radio buttons (role option / radio). */
function controls(html: string): { tag: string; label: string; classes: string[] }[] {
  const out = [];
  for (const m of html.matchAll(/<(button|input|div|span)\b([^>]*)>/g)) {
    const attrs = m[2];
    const interactive = m[1] === 'button' || m[1] === 'input' || /role="(option|radio)"/.test(attrs);
    if (!interactive) continue;
    out.push({
      tag: m[1],
      label: /aria-label="([^"]*)"/.exec(attrs)?.[1] ?? /data-[a-z-]+="([^"]*)"/.exec(attrs)?.[1] ?? '',
      classes: (/class="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/),
    });
  }
  return out;
}

/** The values (px) a custom property of fire-cadet.css takes anywhere in the file. */
const valuesOf = (css: string, property: string): number[] => [...css.matchAll(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`, 'g'))].map((m) => Number(m[1]));

test('sizes: the stylesheet makes every size class 48 px or more, in every layout', () => {
  const css = read('fire-cadet.css');
  const rule = (selector: string): string => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    return css.slice(at, css.indexOf('}', at));
  };
  assert.match(rule('.cadet-touch'), /min-width: 48px;[\s\S]*min-height: 48px;/);
  // the cards of the row, the box, the panel and the round button, at every size the file gives them
  const sizes: Record<string, number[]> = {
    '--cadet-row-card': [56, 64],
    '--cadet-box-height': [64, 56, 80],
    '--cadet-panel-card': [80, 64, 56, 104],
    '--cadet-go': [72, 96],
  };
  for (const [property, expected] of Object.entries(sizes)) {
    assert.deepEqual(valuesOf(css, property), expected, property);
    assert.ok(Math.min(...expected) >= 48, property);
  }
  assert.match(rule('.cadet-row-card'), /width: var\(--cadet-row-card\);\s*height: var\(--cadet-row-card\);/);
  assert.match(rule('.cadet-box-card'), /height: var\(--cadet-box-height\);\s*min-width: 48px;/);
  assert.match(rule('.cadet-panel-card'), /width: var\(--cadet-panel-card\);\s*height: var\(--cadet-panel-card\);/);
  assert.match(rule('.cadet-go'), /width: var\(--cadet-go\);\s*height: var\(--cadet-go\);/);
  // the editor's squares: square, never narrower than 48 px (below 352 px the board scrolls sideways)
  assert.match(rule('.cadet-square'), /aspect-ratio: 1;\s*min-width: 48px;/);
  assert.match(rule('.cadet-board'), /repeat\(7, minmax\(48px, 1fr\)\)/);
  // the eight map buttons are 48 px wide
  assert.match(rule('.cadet-maps'), /repeat\(4, 48px\)/);
  // the shared parts on this screen: the heads of the two sections and the close button of a window
  assert.match(css, /\.cadet-app section > h2 > button\[aria-expanded\] \{\s*min-height: 48px;/);
  assert.match(css, /\.cadet-app \[role='dialog'\] button\[aria-label='Close'\] \{\s*width: 48px;\s*height: 48px;/);
  // ... and the controls of the shared Examples window: the code field, its buttons, "Load this example" (the window marks its parts with these data attributes)
  assert.match(css, /\.cadet-app \[data-member-panel\] button,\s*\.cadet-app \[data-member-panel\] input,\s*\.cadet-app \[data-examples-shelf\] button \{\s*min-width: 48px;\s*min-height: 48px;/);
  const dialog = readFileSync(here('../ExamplesDialog.tsx'), 'utf8');
  for (const part of ['data-member-panel={status.phase}', 'data-examples-shelf']) assert.ok(dialog.includes(part), part);
});

test('sizes: every control of every part of the screen carries one of those classes', () => {
  const row = rowOf(cardsFromText('F3 B L F'));
  const parts: [string, ReactElement][] = [
    ['CardRow', createElement(CardRow, cardRowProps(row))],
    ['DirectionPanel', createElement(DirectionPanel, { live: true, current: 'forward', waiting: 'left', onTap: nothing })],
    ['GoButton', createElement(GoButton, { face: 'go', mode: 'cards', onPress: nothing })],
    ['SpeedButtons', createElement(SpeedButtons, { speed: 1, onSpeed: nothing })],
    ['ModeSwitch', createElement(ModeSwitch, { mode: 'cards', onMode: nothing, locked: false })],
    ['MapPicker', createElement(MapPicker, { scenario: P1, onScenario: nothing, onOwnMap: nothing, locked: false })],
    ['PlanningClock', createElement(PlanningClock, { clock: planningIdle(), onPress: nothing })],
    ['MapEditor', createElement(MapEditor, { scenario: P1, onUse: nothing, onClose: nothing })],
    ['RulesWindow', createElement(RulesWindow, { onClose: nothing })],
  ];
  let counted = 0;
  for (const [name, element] of parts) {
    for (const control of controls(draw(element))) {
      // the close button of the shared window: the stylesheet makes it 48 px on this screen (test above)
      if (control.label === 'Close') continue;
      // the field of the map code: 48 px high (h-12), as wide as the line
      if (control.tag === 'input') {
        assert.ok(control.classes.includes('h-12'), `${name}: the code field`);
        continue;
      }
      counted++;
      assert.ok(
        control.classes.some((c) => (SIZE_CLASSES as readonly string[]).includes(c)),
        `${name}: "${control.label}" has no class that makes it 48 x 48 px (${control.classes.join(' ')})`,
      );
    }
  }
  // the row (start card + 5 cards), its 6 buttons, the box (8); the panel (4); GO; 3 speeds; 2 ways to play; the picker (8 + 3 + Copy + Use); planning (1); the editor (49 + 8 + 2)
  assert.equal(counted, 6 + 6 + 8 + 4 + 1 + 3 + 2 + 13 + 1 + 59);
  // the buttons of the title row, the way to play: 48 px high at least, in the screen's own code
  assert.match(read('FireCadetSimulator.tsx'), /const TITLE_BUTTON = `\$\{titleBarButton\} min-h-12 min-w-12 justify-center`;/);
});

// =============================================================================================
// Names for a screen reader (design 7.13)
// =============================================================================================

test('names: the row, its cards, its six buttons and the card box', () => {
  const html = draw(createElement(CardRow, cardRowProps(rowOf(cardsFromText('F3 B L F')))));
  const names = labels(html);
  assert.ok(names.includes('Your row: 5 cards'), names.join(' | '));
  const cards = names.filter((n) => /^(Start card|Card \d)/.test(n));
  assert.deepEqual(cards, ['Start card', 'Card 1: Forward', 'Card 2: 3 times, for the card before it', 'Card 3: Backward', 'Card 4: Turn left', 'Card 5: Forward']);
  for (const name of ['Undo', 'Redo', 'Move the card to the left', 'Move the card to the right', 'Remove the card', 'New row']) assert.ok(names.includes(name), name);
  assert.deepEqual(
    names.filter((n) => n.startsWith('Add ')),
    ['Add Forward', 'Add Backward', 'Add Turn left', 'Add Turn right', 'Add 2 times', 'Add 3 times', 'Add 4 times', 'Add 5 times'],
  );
  assert.ok(names.includes('The cards'));
  // the row is one stop of Tab: only one card can be reached with it
  assert.equal([...html.matchAll(/role="option"[^>]*tabindex="0"/g)].length, 1);
  // the refusal bubble is not read out a second time: the banner is the live region
  const refused = draw(createElement(CardRow, cardRowProps(rowOf(), { refusal: ROW_PROBLEM_WORDS['number-first'] })));
  assert.match(refused, /<p aria-hidden="true" class="cadet-bubble">Put an arrow card first\.<\/p>/);
});

test('names: the panel, the round button, the clock, the points, the speed, the ways to play, the map picker', () => {
  const panel = draw(createElement(DirectionPanel, { live: false, current: null, waiting: null, onTap: nothing }));
  assert.deepEqual(labels(panel), ['Direction panel', 'Forward', 'Turn left', 'Turn right', 'Backward']);
  assert.match(text(panel), /Press GO first\./);
  assert.match(text(draw(createElement(DirectionPanel, { live: true, current: null, waiting: null, onTap: nothing }))), /One tap, one move\./);
  const faces: [Parameters<typeof GoButton>[0], string, string][] = [
    [{ face: 'go', mode: 'cards', onPress: nothing }, 'Go: the robot runs your row', 'GO'],
    [{ face: 'go', mode: 'panel', onPress: nothing }, 'Go: the match starts', 'GO'],
    [{ face: 'stop', mode: 'cards', onPress: nothing }, 'Stop: the match ends now and the points count', 'STOP'],
    [{ face: 'again', mode: 'panel', onPress: nothing }, 'Again: put everything back to the start', 'AGAIN'],
  ];
  for (const [props, label, word] of faces) {
    const html = draw(createElement(GoButton, props));
    assert.deepEqual(labels(html), [label]);
    assert.equal(text(html), word);
  }
  assert.deepEqual(labels(draw(createElement(MatchClock, { timeLeft: 107 }))), ['Match clock: 1:47 left']);
  assert.match(draw(createElement(MatchClock, { timeLeft: 107 })), /role="timer"/);
  // red in the last 30 seconds
  assert.match(draw(createElement(MatchClock, { timeLeft: 30 })), /bg-rose-600/);
  assert.doesNotMatch(draw(createElement(MatchClock, { timeLeft: 31 })), /bg-rose-600/);
  assert.deepEqual(labels(draw(createElement(MatchPoints, { total: 10, max: f.MAX_POINTS }))), ['10 of 25 points']);
  const speed = draw(createElement(SpeedButtons, { speed: 2, onSpeed: nothing }));
  assert.deepEqual(labels(speed), ['Speed']);
  assert.equal(text(speed), '1x 2x 4x');
  assert.match(speed, /aria-checked="true"[^>]*>2x</);
  const modes = draw(createElement(ModeSwitch, { mode: 'panel', onMode: nothing, locked: true }));
  assert.deepEqual(labels(modes), ['How to play']);
  assert.equal(text(modes), 'Junior: cards ages 6-7 Mini: tap to drive ages 4-5');
  assert.equal([...modes.matchAll(/disabled=""/g)].length, 2, 'locked during a match');
  const picker = draw(createElement(MapPicker, { scenario: PRACTICE_MAPS[2], onScenario: nothing, onOwnMap: nothing, locked: false }));
  assert.ok(labels(picker).includes('Practice map'));
  assert.ok(labels(picker).includes('Copy the map code'));
  assert.match(picker, /role="radio" aria-checked="true"[^>]*>3</);
  assert.match(text(picker), /My own map Surprise Map 1 Code: P3/);
  assert.match(text(picker), /Enter a code/);
  assert.match(text(picker), /Maps 1 to 8 are practice maps of this simulator, not official ones\./);
  // the planning clock: "Planning time", 0:00 and Start
  const clock = draw(createElement(PlanningClock, { clock: planningIdle(), onPress: nothing }));
  assert.match(text(clock), /^Planning time 0:00 Start$/);
  assert.deepEqual(labels(clock), ['Planning time: 0:00']);
  // the banner: one sentence, read out politely
  assert.match(draw(createElement(Banner, { sentence: 'Map 3.', tone: 'calm' })), /^<p role="status" aria-live="polite"[^>]*><span class="line-clamp-2">Map 3\.<\/span><\/p>$/);
});

test('names: the score strip says each picture in words, from the referee\'s own sheet', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: P1, program: cardRowProgram(cardsFromText('F3')) });
  sim.start();
  while (sim.status === 'running') sim.step(1);
  const html = draw(createElement(ScoreStrip, { score: sim.score() }));
  assert.deepEqual(labels(html), [
    'Score',
    'Water: not yet',
    'Cat: done',
    'Injured Person: not yet',
    'Equipment: not yet',
    'Robot home: not yet',
    'Road Closed: not touched',
    'Fallen Tree: not touched',
    'Broken Vehicle: not touched',
  ]);
  // they are pictures, not buttons
  assert.doesNotMatch(html, /<button/);
});

// =============================================================================================
// Tapped in a document (jsdom)
// =============================================================================================

/** Give Node the few browser globals React needs to draw into a document; false without jsdom (the test is then skipped). */
function withDom(): boolean {
  let JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> };
  try {
    ({ JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: typeof JSDOM });
  } catch {
    return false;
  }
  const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'SubmitEvent',
    'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']; // prettier-ignore
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return true;
}
const textOf = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const $ = (selector: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(selector);
  assert.ok(el, selector);
  return el;
};

test('the row in a document: add, refusals in the bubble, select and insert, move, remove, undo, redo, new row, the keyboard, locked', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  let emptied = 0;
  let locked = false;
  let setLockedOutside: (value: boolean) => void = nothing;
  function Host() {
    const [row, setRow] = useState<RowState>(rowOf());
    const [refusal, setRefusal] = useState<string | null>(null);
    const [refusals, setRefusals] = useState(0);
    const [said, setSaid] = useState('');
    const [isLocked, setLocked] = useState(locked);
    setLockedOutside = setLocked;
    return createElement(
      CardRow,
      cardRowProps(row, {
        onEdit: (next, line) => {
          setRow(next);
          setSaid(line);
          setRefusal(null);
        },
        onRefused: (problem) => {
          setRefusal(ROW_PROBLEM_WORDS[problem]);
          setRefusals((n) => n + 1);
        },
        onEmptied: () => emptied++,
        locked: isLocked,
        refusal,
        refusals,
        said,
      }),
    );
  }
  const root = createRoot($('#root'));
  await act(async () => root.render(createElement(Host)));
  const click = async (selector: string) => act(async () => $(selector).click());
  const add = (card: CardName) => click(`[data-add="${card}"]`);
  const row = (): string[] => [...document.querySelectorAll('[role="option"][data-card]')].map((el) => el.getAttribute('data-card') ?? '');
  const bubble = (): string => textOf(document.querySelector('.cadet-bubble'));
  const saidLine = (): string => textOf(document.querySelector('[data-row-said]'));
  const key = async (target: Element, init: KeyboardEventInit) => act(async () => void target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })));

  // a number card first: refused, with the game's words, where the finger is
  await add('x3');
  assert.deepEqual(row(), []);
  assert.equal(bubble(), 'Put an arrow card first.');
  await add('forward');
  assert.equal(bubble(), '', 'a tap that was done: the bubble goes');
  assert.equal(saidLine(), 'Forward added. 1 card.');
  await add('x3');
  await add('backward');
  await add('left');
  await add('x2');
  assert.deepEqual(row(), ['forward', 'x3', 'backward', 'left', 'x2']);
  assert.equal($('[role="listbox"]').getAttribute('aria-label'), 'Your row: 5 cards');
  // a second number card for the same arrow: refused
  await add('x4');
  assert.equal(bubble(), 'One number card for each arrow.');
  assert.deepEqual(row(), ['forward', 'x3', 'backward', 'left', 'x2']);
  // select Forward: the bar moves behind its number card, and the next card goes there
  await click('[aria-label="Card 1: Forward"]');
  assert.equal($('[aria-label="Card 1: Forward"]').getAttribute('aria-selected'), 'true');
  const bar = [...$('[role="listbox"]').children].findIndex((el) => el.hasAttribute('data-bar'));
  assert.equal(bar, 3, 'start card, Forward, x3, then the bar');
  await add('right');
  assert.deepEqual(row(), ['forward', 'x3', 'right', 'backward', 'left', 'x2']);
  // move: the selected Turn right one place to the left - past Forward with its number card
  await click('[aria-label="Move the card to the left"]');
  assert.deepEqual(row(), ['right', 'forward', 'x3', 'backward', 'left', 'x2']);
  assert.equal(saidLine(), 'Card moved.');
  // remove Forward: its number card goes with it
  await click('[aria-label="Card 2: Forward"]');
  await click('[aria-label="Remove the card"]');
  assert.deepEqual(row(), ['right', 'backward', 'left', 'x2']);
  assert.equal(saidLine(), 'Card removed. 4 cards.');
  // undo, redo
  await click('[aria-label="Undo"]');
  assert.deepEqual(row(), ['right', 'forward', 'x3', 'backward', 'left', 'x2']);
  await click('[aria-label="Redo"]');
  assert.deepEqual(row(), ['right', 'backward', 'left', 'x2']);
  // new row: empty, no question; the screen says that Undo brings the cards back
  await click('[aria-label="New row"]');
  assert.deepEqual(row(), []);
  assert.equal(emptied, 1);
  await click('[aria-label="Undo"]');
  assert.deepEqual(row(), ['right', 'backward', 'left', 'x2']);
  // the keyboard: the row is one stop of Tab; Home goes to the start card, Right to the next card, Delete removes it, Ctrl+Z undoes
  await key($('[role="listbox"]'), { key: 'Home' });
  const start = $('[aria-label="Start card"]');
  assert.equal(start.getAttribute('tabindex'), '0');
  assert.equal(document.querySelectorAll('[role="option"][tabindex="0"]').length, 1);
  await key(start, { key: 'ArrowRight' });
  assert.equal($('[aria-label="Card 1: Turn right"]').getAttribute('tabindex'), '0');
  await key($('[aria-label="Card 1: Turn right"]'), { key: 'Delete' });
  assert.deepEqual(row(), ['backward', 'left', 'x2']);
  await key($('[role="listbox"]'), { key: 'z', ctrlKey: true });
  assert.deepEqual(row(), ['right', 'backward', 'left', 'x2']);
  // the keys act on the card the keyboard is on (Ctrl+Z left it on card 1): Right twice to Turn left, and Alt+Left moves it - with its number card
  const list = $('[role="listbox"]');
  await key(list, { key: 'ArrowRight' });
  await key(list, { key: 'ArrowRight' });
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Card 3: Turn left');
  await key(list, { key: 'ArrowLeft', altKey: true });
  assert.deepEqual(row(), ['right', 'left', 'x2', 'backward']);
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Card 2: Turn left', 'the keyboard goes with the card');
  // a number card moves alone: behind Turn right it may stand; first in the row it may not
  await key(list, { key: 'ArrowRight' });
  await key(list, { key: 'ArrowLeft', altKey: true });
  assert.deepEqual(row(), ['right', 'x2', 'left', 'backward']);
  await key(list, { key: 'ArrowLeft', altKey: true });
  assert.deepEqual(row(), ['right', 'x2', 'left', 'backward']);
  assert.equal(bubble(), 'A number card comes after an arrow.');
  // during a match the row is locked: no tap changes it
  await act(async () => setLockedOutside(true));
  await add('forward');
  await click('[aria-label="Card 1: Turn right"]');
  assert.deepEqual(row(), ['right', 'x2', 'left', 'backward']);
  assert.equal($('[aria-label="Card 1: Turn right"]').getAttribute('aria-selected'), 'false');
  for (const name of ['Undo', 'Remove the card', 'New row']) assert.equal(($(`[aria-label="${name}"]`) as HTMLButtonElement).disabled, true, name);
  await act(async () => root.unmount());
});

test('the panel in a document: a tap is a press and a let-go; before GO and after the end nothing happens; Enter and Space too', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const taps: string[] = [];
  const onTap = (move: MoveCard, down: boolean) => void taps.push(`${move}:${down ? 'down' : 'up'}`);
  const root = createRoot($('#root'));
  const show = (live: boolean, current: MoveCard | null = null, waiting: MoveCard | null = null) =>
    act(async () => root.render(createElement(DirectionPanel, { live, current, waiting, onTap })));
  const fire = (move: MoveCard, type: string, init: object = {}) =>
    act(async () => {
      const el = $(`[data-move="${move}"]`);
      el.dispatchEvent(type.startsWith('key') ? new KeyboardEvent(type, { bubbles: true, ...init }) : new MouseEvent(type, { bubbles: true, ...init }));
    });
  await show(false);
  await fire('forward', 'pointerdown');
  await fire('forward', 'pointerup');
  // (a let-go with nothing pressed changes nothing: the screen holds only a pressed card)
  assert.deepEqual(taps.filter((tap) => tap.endsWith('down')), [], 'before GO: no tap');
  assert.equal($('[data-move="forward"]').getAttribute('aria-disabled'), 'true');
  await show(true, 'forward', 'left');
  assert.equal($('[data-move="forward"]').getAttribute('data-state'), 'running');
  assert.equal($('[data-move="left"]').getAttribute('data-state'), 'kept');
  assert.match($('[data-move="left"]').className, /cadet-ring-dashed/);
  taps.length = 0;
  await fire('right', 'pointerdown');
  await fire('right', 'pointerup');
  await fire('backward', 'keydown', { key: 'Enter' });
  await fire('backward', 'keydown', { key: 'Enter', repeat: true });
  await fire('backward', 'keyup', { key: 'Enter' });
  await fire('left', 'keydown', { key: ' ' });
  await fire('left', 'keyup', { key: ' ' });
  assert.deepEqual(taps, ['right:down', 'right:up', 'backward:down', 'backward:up', 'left:down', 'left:up']);
  await act(async () => root.unmount());
});

test('the map picker in a document: a practice map, Surprise, a typed code - a code that does not read says why', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const chosen: FireCadetScenario[] = [];
  let own = 0;
  const root = createRoot($('#root'));
  await act(async () => root.render(createElement(MapPicker, { scenario: P1, onScenario: (s) => void chosen.push(s), onOwnMap: () => own++, locked: false })));
  await act(async () => $('[data-map="3"]').click());
  assert.equal(chosen.pop(), PRACTICE_MAPS[2]);
  const button = (words: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll('button')].find((b) => textOf(b) === words);
    assert.ok(found, words);
    return found;
  };
  await act(async () => button('Surprise').click());
  assert.ok(PRACTICE_MAPS.includes(chosen.pop() as FireCadetScenario), 'Surprise: one of the eight');
  await act(async () => button('Map 1').click());
  assert.equal(chosen.pop(), P1);
  await act(async () => button('My own map').click());
  assert.equal(own, 1);
  const input = $('input') as HTMLInputElement;
  const type = async (value: string) => {
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      setValue?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => (input.form as HTMLFormElement).requestSubmit());
  };
  await type('hello');
  assert.equal(textOf(document.querySelector('[role="alert"]')), 'This is not a map code. A code looks like P3 or like S-A6-D5-C5-C7-E3-F5-F7.');
  assert.equal(chosen.length, 0);
  await type('p9');
  assert.equal(textOf(document.querySelector('[role="alert"]')), 'There are 8 practice maps: P1 to P8.');
  await type('h b7 c5 e3 d6 c2 e2 d4');
  assert.match(textOf(document.querySelector('[role="alert"]')), /^An obstacle cannot stand on D4: that is the Safe Zone\./);
  // capitals, blanks and hyphens do not matter
  await type('s a6 d5 c5 c7 e3 f5 f7');
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(encodeScenario(chosen.pop() as FireCadetScenario), 'P1');
  await act(async () => root.unmount());
});

test('the own-map editor in a document: lift a thing, the lit squares, a refused tap and why, the code, the solver\'s line, Use and Cancel', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const used: FireCadetScenario[] = [];
  let closed = 0;
  const root = createRoot($('#root'));
  await act(async () => root.render(createElement(MapEditor, { scenario: P1, onUse: (s) => void used.push(s), onClose: () => closed++ })));
  assert.equal(textOf(document.querySelector('[role="dialog"] h2')), 'My own map');
  assert.equal(document.querySelectorAll('[data-square]').length, 49);
  assert.equal(textOf(document.querySelector('[data-editor-code]')), 'P1');
  // the solver's line comes a moment after the last change
  await act(async () => new Promise((resolve) => setTimeout(resolve, SOLVER_PAUSE_MS + 100)));
  assert.equal(textOf(document.querySelector('[data-solver-line]')), solverLine(findRowForAllPoints(P1)));
  assert.equal(textOf(document.querySelector('[data-solver-line]')), 'This simulator found a row for all 25 points: 27 moves, 52.1 seconds.');
  // lift the Cat: the squares it may go to light up - exactly the game's
  await act(async () => $('[data-thing="cat"]').click());
  assert.equal($('[data-thing="cat"]').getAttribute('aria-pressed'), 'true');
  const lit = [...document.querySelectorAll('[data-lit="true"]')].map((el) => el.getAttribute('data-square'));
  const allowed = [...document.querySelectorAll('[data-square]')]
    .map((el) => el.getAttribute('data-square') ?? '')
    .filter((name) => placeProblem(P1, 'cat', { col: name.charCodeAt(0) - 65, row: Number(name.slice(1)) - 1 }) === null);
  assert.deepEqual(lit, allowed);
  assert.ok(!lit.includes('D4') && !lit.includes('D7') && !lit.includes('C5'));
  // a tap on its own target: nothing changes, and the editor says why
  await act(async () => $('[data-square="D4"]').click());
  assert.equal(textOf(document.querySelector('[data-editor-refusal]')), 'The Cat cannot start in the Safe Zone.');
  assert.equal(textOf(document.querySelector('[data-editor-code]')), 'P1');
  // a lit square: the Cat stands there, the code follows
  await act(async () => $('[data-square="B3"]').click());
  assert.equal(textOf(document.querySelector('[data-editor-refusal]')), '');
  assert.equal(textOf(document.querySelector('[data-editor-code]')), 'S-A6-B3-C5-C7-E3-F5-F7');
  assert.equal($('[data-square="B3"]').getAttribute('aria-label'), 'B3: Cat');
  assert.equal($('[data-square="D7"]').getAttribute('aria-label'), 'D7: the robot starts here');
  await act(async () => new Promise((resolve) => setTimeout(resolve, SOLVER_PAUSE_MS + 100)));
  const moved = readMapCode('S-A6-B3-C5-C7-E3-F5-F7');
  assert.ok(moved.ok);
  assert.equal(textOf(document.querySelector('[data-solver-line]')), solverLine(findRowForAllPoints(moved.scenario)));
  // an obstacle on a marked place: refused
  await act(async () => $('[data-thing="fallen-tree"]').click());
  await act(async () => $('[data-square="G3"]').click());
  assert.equal(textOf(document.querySelector('[data-editor-refusal]')), 'An obstacle stands on a road, not on a marked place.');
  // "Use this map": the map as it stands now
  await act(async () => $('[data-use-map]').click());
  assert.equal(used.length, 1);
  assert.equal(encodeScenario(used[0]), 'S-A6-B3-C5-C7-E3-F5-F7');
  // "Cancel" and Escape change nothing: they only close
  const cancel = [...document.querySelectorAll('button')].find((b) => textOf(b) === 'Cancel') as HTMLButtonElement;
  await act(async () => cancel.click());
  await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closed, 2);
  assert.equal(used.length, 1);
  await act(async () => root.unmount());
});

// =============================================================================================
// The stage's drawings (./paint.ts)
// =============================================================================================

type Entry = Array<string | number | boolean | null>;
const flat = (value: unknown): string | number | boolean | null =>
  value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : `<${typeof value}>`;
/** A 2-D context that writes down every call and every setting. */
function recordingContext(log: Entry[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { canvas: { width: 800, height: 800 } };
  return new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => void log.push([key, ...args.map(flat)]);
    },
    set(target, key: string, value) {
      log.push([`=${key}`, flat(value)]);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
const balanced = (log: Entry[]): boolean => log.filter((e) => e[0] === 'save').length === log.filter((e) => e[0] === 'restore').length;

test('the stage: the four items and the three obstacles are drawn by their kind; anything else is left to the stage', () => {
  const sim = createSimulation({ game: fireCadetGame, scenario: P1, program: {} });
  const view: StageView = fitView(800, 800, f.MAT, f.MAT, 1, f.TABLE_MARGIN);
  const bodies = sim.world.bodies;
  assert.deepEqual(
    bodies.map((b) => b.kind),
    [...ITEM_NAMES.map(itemBodyKind), ...OBSTACLE_KINDS.map(obstacleBodyKind)],
  );
  for (const body of bodies) {
    assert.ok(PICTURE_OF_KIND.has(body.kind), body.kind);
    const log: Entry[] = [];
    assert.equal(paintElement(recordingContext(log), body, view), true, body.id);
    assert.ok(balanced(log), `${body.id}: the context is left as it was found`);
  }
  const stranger: Body = { ...bodies[0], id: 'other', kind: 'cube' };
  const log: Entry[] = [];
  assert.equal(paintElement(recordingContext(log), stranger, view), false);
  assert.deepEqual(log, []);
  // the painters of the map: the Fire marker and the hints on the ground, the items, the robot (the obstacles are bodies under D1: no walls)
  const painters = cadetPainters(P1);
  assert.deepEqual(Object.keys(painters).sort(), ['body', 'ground', 'robot']);
  const ground: Entry[] = [];
  painters.ground?.(recordingContext(ground), sim, view);
  assert.ok(ground.length > 20 && balanced(ground));
  const robot: Entry[] = [];
  painters.robot?.(recordingContext(robot), sim, view);
  assert.ok(robot.length > 20 && balanced(robot));
  assert.ok(FLAME_MM > 0 && HINT_MM > 0);
});

test('the stage: a token is never drawn smaller than TOKEN_MIN_PIXELS across; then the true base is drawn under it (N16)', () => {
  // a phone: a stage of 315 px for the mat and its table margin - 0.22 px per mm, so 40 mm are 9 px
  const small = fitView(315, 315, f.MAT, f.MAT, 1, f.TABLE_MARGIN);
  const big = fitView(1400, 1400, f.MAT, f.MAT, 1, f.TABLE_MARGIN);
  assert.ok(f.ITEM_BASE * small.scale < f.TOKEN_MIN_PIXELS && f.ITEM_BASE * big.scale > f.TOKEN_MIN_PIXELS);
  assert.ok(Math.abs(tokenSize(f.ITEM_BASE, small) * small.scale - f.TOKEN_MIN_PIXELS) < 1e-9);
  assert.equal(tokenSize(f.ITEM_BASE, big), f.ITEM_BASE);
  const sim = createSimulation({ game: fireCadetGame, scenario: P1, program: {} });
  const cat = sim.world.bodies.find((b) => b.id === itemId('cat')) as Body;
  const sign = sim.world.bodies.find((b) => b.id === obstacleId('road-closed')) as Body;
  for (const body of [cat, sign]) {
    const onPhone: Entry[] = [];
    paintElement(recordingContext(onPhone), body, small);
    assert.ok(onPhone.some((e) => e[0] === 'fillRect' && e[3] === body.w && e[4] === body.l), `${body.id}: the true base under the larger token`);
    const onScreen: Entry[] = [];
    paintElement(recordingContext(onScreen), body, big);
    assert.ok(!onScreen.some((e) => e[0] === 'fillRect'), `${body.id}: drawn at its true size, no base under it`);
  }
});

test('the stage, lead decision D1: an obstacle the referee has lifted is not drawn - it is not on the field - until it is back', () => {
  const reading = readMapCode('S-A6-B3-C5-C7-D5-F5-F7');
  assert.ok(reading.ok);
  const sim = createSimulation({ game: fireCadetGame, scenario: reading.scenario, program: cardRowProgram(cardsFromText('F2 B2')) }) as Simulation<FireCadetScenario>;
  sim.start();
  let lifted = false;
  let back = false;
  while (sim.status === 'running') {
    sim.step(1);
    const there = sim.world.bodies.some((b) => b.id === obstacleId('road-closed'));
    if (!there) lifted = true;
    else if (lifted) back = true;
  }
  assert.ok(lifted && back);
});

// =============================================================================================
// The page, the loader, the wiring of the screen
// =============================================================================================

test('the page: its address, title and description (design 10.5), and nothing but the loader', () => {
  const page = readFileSync(PAGE, 'utf8');
  assert.match(page, /const PATH = '\/simulator\/fire-cadet';/);
  assert.match(page, /const TITLE = 'mTiny simulator — Fire Cadet';/);
  const description = /const DESCRIPTION =\s*([\s\S]*?);\n/.exec(page)?.[1] ?? '';
  const joined = [...description.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
  assert.equal(
    joined,
    'Lay a row of mTiny coding cards, or drive with taps on the four arrow cards, and watch a Makeblock mTiny play the “Fire Cadet – Rescue City” ' +
      'mission of MakeX Lebanon Season 2027 (ages 4–7): push the Water to the Fire, the Cat to the Safe Zone, the Injured Person to the Hospital and ' +
      'the Equipment back to the Fire Station, round the obstacles. Eight practice maps, or your own. Free, in the browser.',
  );
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /export default function FireCadetSimulatorPage\(\) \{\s*return <FireCadetLoader \/>;\s*\}/);
  assert.match(page, /import \{ FireCadetLoader \} from '@\/simulator\/ui\/fire-cadet\/FireCadetLoader';/);
  const loader = read('FireCadetLoader.tsx');
  assert.match(loader, /dynamic\(\(\) => import\('\.\/FireCadetSimulator'\), \{\s*ssr: false,/);
  assert.match(loader, /\{CADET_WORDS\.loading\}/);
});

test('the screen: its own parts, not the general block screen; the stage as design 7.1 asks; nothing of the examples', () => {
  const screen = read('FireCadetSimulator.tsx');
  const imports = [...screen.matchAll(/^import[^;]*?from '([^']+)'/gm)].map((m) => m[1]);
  for (const general of ['../SimulatorApp', '../ControlBar', '../CombinationPanel', '../EditorToolbar', '../BatchDialog', '../SensorDashboard']) {
    assert.ok(!imports.includes(general), `the screen does not use ${general}`);
  }
  for (const own of ['./MatchBar', './GoButton', './CardRow', './DirectionPanel', './MapPicker', './MapEditor', './ScoreStrip', './Banner', './PlanningClock', './RulesWindow', './paint', './words']) {
    assert.ok(imports.includes(own), own);
  }
  assert.ok(!imports.some((s) => /sample|catalog|all-examples/.test(s)), 'nothing of the examples');
  assert.match(screen, /const STAGE_OPTIONS = \{ overlays: false, sensors: false, trail: true \} as const;/);
  for (const prop of ['placing={false}', 'ruler={null}', 'margin={FIRE_CADET.TABLE_MARGIN}', 'painters={painters}', 'options={STAGE_OPTIONS}']) assert.ok(screen.includes(prop), prop);
  // the speeds: Junior 1x, 2x, 4x; Mini always 1x (N8)
  assert.match(screen, /setSimSpeed\(mode === 'panel' \? 1 : speed\)/);
  // the Examples button (design 7.12): in the title row before Rules, locked during a match; the shared window with this
  // game's sentence, drawn next to the Rules window and not in the title row (./examples-window.test.ts taps it all)
  for (const own of ['../ExamplesDialog', '../useMemberExamples', '../examples-words']) assert.ok(imports.includes(own), own);
  assert.match(screen, /<ExamplesButton examples=\{examples\} locked=\{during\} onOpen=\{\(\) => setExamplesOpen\(true\)\} className=\{TITLE_BUTTON\} \/>\s*<button type="button" onClick=\{\(\) => setRulesOpen\(true\)\}/);
  assert.match(screen, /\{rulesOpen && <RulesWindow[^\n]*\n\s*\{examplesOpen && <ExamplesDialog examples=\{examples\} howLoadingWorks=\{CADET_WORDS\.howLoadingWorks\} onLoad=\{loadExample\}/);
  // with the two buttons beside it, the title goes on over a second line on a 360 px phone instead of being cut off - while loading too, so the row keeps its look
  assert.match(screen, /<TitleBar title="Fire Cadet" robot="mTiny" wrapOnPhone>/);
  assert.match(read('FireCadetLoader.tsx'), /<TitleBar title="Fire Cadet" robot="mTiny" wrapOnPhone \/>/);
  // a tap holds the engine's button down for at least 3 ticks (design 7.5)
  assert.match(screen, /export const TAP_TICKS = 3;/);
  // every card name has a picture and a word
  for (const card of CARD_NAMES) assert.ok(CADET_WORDS.row.add(card).length > 4);
});
