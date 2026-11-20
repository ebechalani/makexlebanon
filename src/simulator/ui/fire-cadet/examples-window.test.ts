/**
 * The Examples button of the Fire Cadet screen (design 7.12): the shared window
 * (../ExamplesDialog.tsx) with this game's sentence about loading, the lock of the website's
 * server, and what loading an example does to the screen.
 *
 *   - Reading an example (./map-code.ts exampleToLoad): its row with readCards and its map with
 *     readMapCode, for every one of the six examples; a map code that does not read leaves the map
 *     as it is, and the banner then says only "its cards".
 *   - The whole screen in a stand-in document (jsdom), against a pretend website whose answers come
 *     from the real door (../../members/unlock.ts handleUnlockRequest) with two throwaway codes made
 *     here: a visitor sees 5 examples and can open 3, a member code opens 5, an advanced code 6.
 *     Loading one switches to Junior, puts its cards in the row as one step of Undo, sets its
 *     practice map, closes the window and says so in the banner. The advanced example, loaded,
 *     scores all 25 points on the map it set. The button is locked during a match.
 *
 * The screen is never told the examples: they come from the pretend website, as in the browser.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { cardRowProgram, readCards, type CardName } from '../../fire-cadet/cards';
import { FIRE_CADET as NUMBERS } from '../../fire-cadet/numbers';
import { playFireCadet } from '../../fire-cadet/play';
import { encodeScenario, readMapCode } from '../../fire-cadet/scenario';
import { ALL_GAMES, FIRE_CADET } from '../../members/all-examples';
import { fingerprintOf } from '../../members/code-fingerprint.mjs';
import { normalizeCode } from '../../members/code-format.mjs';
import { handleUnlockRequest, type UnlockSetup } from '../../members/unlock';
import { examplesIntro } from '../examples-words';
import { EXAMPLES_GAMES } from '../member-unlock';
import { storageKey } from '../storage';
import { exampleNote, exampleToLoad, GAME_ID } from './map-code';
import { CADET_WORDS } from './words';

/** Throwaway codes, made for this test alone (as ../member-unlock.test.ts does): one member code, one advanced code. */
const MEMBER_CODE = 'FIRE-AAAA-2222';
const ADVANCED_CODE = 'FIRE-DDDD-5555';

const examples = FIRE_CADET.examples;
const fieldOf = (program: unknown): string => String((program as { field?: unknown }).field);
const byLevel = (level: string) => examples.filter((example) => example.level === level);

// =============================================================================================
// Reading an example
// =============================================================================================

test('every example reads to its row and to its practice map; the banner says both', () => {
  assert.equal(examples.length, 6);
  for (const example of examples) {
    const loaded = exampleToLoad(example.program);
    assert.deepEqual(loaded.cards, readCards(example.program), example.id);
    assert.ok(loaded.cards.length > 0, example.id);
    const map = readMapCode(fieldOf(example.program));
    assert.ok(map.ok && loaded.scenario !== null, example.id);
    assert.equal(encodeScenario(loaded.scenario), encodeScenario(map.scenario), `${example.id}: the map it was made for`);
    assert.match(encodeScenario(loaded.scenario), /^P[1-8]$/, `${example.id}: a practice map`);
    assert.equal(exampleNote(loaded), 'Example loaded: its cards and its map.');
  }
});

test('an example whose map code does not read: its cards are loaded, the map stays, and the banner says only that', () => {
  const cards: CardName[] = ['forward', 'x3'];
  for (const field of [undefined, 'P9', 'hello', 7]) {
    const loaded = exampleToLoad({ ...cardRowProgram(cards), field });
    assert.deepEqual(loaded.cards, cards, String(field));
    assert.equal(loaded.scenario, null, String(field));
    assert.equal(exampleNote(loaded), 'Example loaded: its cards.');
  }
  // what is not a row of cards gives no cards (readCards never throws)
  assert.deepEqual(exampleToLoad(null), { cards: [], scenario: null });
  assert.deepEqual(exampleToLoad({ format: 'mbot2', blocks: [] }).cards, []);
});

test('the window\'s sentence about loading is this game\'s, in every view that says what loading does', () => {
  assert.equal(CADET_WORDS.howLoadingWorks, 'Loading one puts its cards in your row and sets its map (Undo brings your cards back).');
  assert.equal(examplesIntro('unlocked', CADET_WORDS.organisation, CADET_WORDS.howLoadingWorks), `Ready-made programs to run, read and change. ${CADET_WORDS.howLoadingWorks}`);
  assert.match(examplesIntro('some-open', CADET_WORDS.organisation, CADET_WORDS.howLoadingWorks), /sets its map \(Undo brings your cards back\)\. The ones marked “Members only” are for registered MakeX Lebanon members\.$/);
  // (no view speaks of blocks on this screen)
  for (const view of ['unlocked', 'all-open', 'some-open', 'checking-some-open', 'checking-saved', 'locked', 'not-known'] as const) {
    assert.doesNotMatch(examplesIntro(view, CADET_WORDS.organisation, CADET_WORDS.howLoadingWorks), /block|workspace/i, view);
  }
  assert.ok((EXAMPLES_GAMES as readonly string[]).includes(GAME_ID), 'the server knows the game of this screen');
});

// =============================================================================================
// The whole screen, in a document, against a pretend website
// =============================================================================================

/** The examples door with the two throwaway codes, and the rule the owner chose for every game: the starters open to everyone, the advanced ones for advanced codes. */
let setup: UnlockSetup;
before(async () => {
  setup = {
    codes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(MEMBER_CODE) as string) }],
    advancedCodes: [{ no: 1, fingerprint: await fingerprintOf(normalizeCode(ADVANCED_CODE) as string) }],
    games: ALL_GAMES,
    openToEveryone: ALL_GAMES.flatMap((game) => game.examples.filter((example) => example.level === 'starter').map((example) => example.id)),
    advancedOnly: ALL_GAMES.flatMap((game) => game.examples.filter((example) => example.level === 'advanced').map((example) => example.id)),
  };
});

/** What the pretend website was asked, request by request. */
const asked: Array<{ url: string; body: string }> = [];
const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

/** The browser things the screen needs, from jsdom; false without jsdom (the test is then skipped). Animation frames run only when the test says so. */
/** What the stand-in document can be told and asked: run animation frames, pretend to be a phone or a classroom screen, the page scrolls it was asked for. */
interface StandIn {
  frames: (n: number) => void;
  screen: { classroom: boolean };
  scrolls: ScrollToOptions[];
  close: () => void;
}

function withDom(): StandIn | null {
  const require = createRequire(import.meta.url);
  let JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> & { close: () => void } };
  try {
    ({ JSDOM } = require('jsdom') as { JSDOM: typeof JSDOM });
  } catch {
    return null;
  }
  // the screen brings its stylesheet with it (an import of a .css file): Node has nothing to do with it
  require.extensions['.css'] = (module) => {
    module.exports = {};
  };
  const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { url: 'https://simulator.test/simulator/fire-cadet', pretendToBeVisual: true });
  const win = dom.window as unknown as Record<string, unknown> & { HTMLCanvasElement: { prototype: { getContext: unknown } } };
  // no drawing here: a canvas has no context (the stage then draws nothing), and nothing changes size
  win.HTMLCanvasElement.prototype.getContext = () => null;
  const queue: FrameRequestCallback[] = [];
  // a phone, unless the test says it is a classroom screen; the page only writes down how it was asked to scroll
  const screen = { classroom: false };
  const scrolls: ScrollToOptions[] = [];
  win.matchMedia = (query: string) => ({ matches: screen.classroom && query === '(min-width: 64rem)', media: query, addEventListener() {}, removeEventListener() {} });
  win.scrollBy = (options: ScrollToOptions) => void scrolls.push(options);
  const globals: Record<string, unknown> = {
    requestAnimationFrame: (callback: FrameRequestCallback) => queue.push(callback),
    cancelAnimationFrame: () => undefined,
    ResizeObserver: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  };
  const names = ['window', 'document', 'navigator', 'localStorage', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLFormElement', 'HTMLCanvasElement',
    'Image', 'Event', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'SubmitEvent', 'FocusEvent', 'StorageEvent', 'getComputedStyle']; // prettier-ignore
  for (const name of names) globals[name] = name === 'window' ? win : win[name];
  // (the links of the title row ask for idle time through "self", as in a browser)
  globals.self = win;
  for (const [name, value] of Object.entries(globals)) {
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  Object.defineProperty(win, 'requestAnimationFrame', { value: globals.requestAnimationFrame, configurable: true, writable: true });
  Object.defineProperty(win, 'cancelAnimationFrame', { value: globals.cancelAnimationFrame, configurable: true, writable: true });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // the website: the real door behind a pretend address
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const body = typeof init?.body === 'string' ? init.body : '';
    asked.push({ url: String(input), body });
    const answer = await handleUnlockRequest({ method: init?.method ?? 'GET', body, contentType: new Headers(init?.headers).get('content-type'), client: 'test' }, setup);
    return Response.json(answer.body, { status: answer.status, headers: answer.headers });
  }) as typeof fetch;
  let now = 0;
  return {
    frames: (n: number) => {
      for (let i = 0; i < n; i++) {
        now += 1000 / 60;
        for (const callback of queue.splice(0)) callback(now);
      }
    },
    screen,
    scrolls,
    close: () => dom.window.close(),
  };
}

const textOf = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const $ = (selector: string, root: ParentNode = document): HTMLElement => {
  const el = root.querySelector<HTMLElement>(selector);
  assert.ok(el, selector);
  return el;
};
const buttonCalled = (words: string, root: ParentNode = document): HTMLButtonElement => {
  const found = [...root.querySelectorAll('button')].find((b) => textOf(b) === words);
  assert.ok(found, `a button "${words}"`);
  return found;
};

test('the screen in a document: the Examples window as a visitor, with a member code and an advanced code; loading sets the cards and the map', async (t) => {
  const dom = withDom();
  if (!dom) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { default: FireCadetSimulator, EXAMPLES } = await import('./FireCadetSimulator');

  /** Let the pretend website answer (and React draw), until `ok` holds. */
  const until = async (what: string, ok: () => boolean) => {
    for (let i = 0; i < 200 && !ok(); i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
    assert.ok(ok(), `waited for: ${what}`);
  };
  const click = (el: HTMLElement) => act(async () => el.click());
  const row = (): string[] => [...document.querySelectorAll('[role="option"][data-card]')].map((el) => el.getAttribute('data-card') ?? '');
  const banner = (): string => textOf(document.querySelector('[data-banner]'));
  /** the two ways to play, by the first line of their words ("Junior: cards", "Mini: tap to drive") */
  const modes = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="How to play"] [role="radio"]')];
  const modeName = (button: Element): string => textOf(button.querySelector('span > span'));
  const modeButton = (name: string): HTMLButtonElement => {
    const found = modes().find((button) => modeName(button) === name);
    assert.ok(found, name);
    return found;
  };
  const checkedMode = (): string => modes().filter((button) => button.getAttribute('aria-checked') === 'true').map(modeName).join(' + ');
  const checkedMap = (): string | null => document.querySelector('[data-map][aria-checked="true"]')?.getAttribute('data-map') ?? null;
  const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]');
  const cards = () => [...(dialog()?.querySelectorAll('[data-example]') ?? [])];
  const openCards = () => cards().filter((card) => card.getAttribute('data-locked') === 'false');
  const typeCode = async (code: string) => {
    const input = $('input[name="member-code"]', dialog() as HTMLElement) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set?.call(input, code);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => (input.form as HTMLFormElement).requestSubmit());
  };

  // the screen asks the one address of every game, for this game's examples
  assert.deepEqual(EXAMPLES, { unlockUrl: '/api/simulator/unlock', game: 'fire-cadet', organisation: 'MakeX Lebanon' });
  localStorage.clear();
  const root = createRoot($('#root'));
  await act(async () => root.render(createElement(FireCadetSimulator)));
  await until('the visitor\'s answer', () => asked.length === 1 && asked[0].body === '{"game":"fire-cadet"}');
  assert.equal(asked[0].url, '/api/simulator/unlock');

  // the map's canvas is described by the field in words (design 7.13)
  const canvas = $('.cadet-stage canvas');
  const fieldWords = $('[data-field-words]');
  assert.equal(canvas.getAttribute('aria-label'), 'Competition mat seen from above, with the robot and the game elements.');
  assert.ok(fieldWords.id !== '' && canvas.getAttribute('aria-describedby') === fieldWords.id, 'the canvas names the field in words as its description');
  assert.match(textOf(fieldWords), /^The robot is on D7 and looks up\./);

  // the Examples button: in the title row, before Rules, 48 px high like the other buttons there
  const titleRow = $('nav[aria-label="Breadcrumb"]').parentElement as HTMLElement;
  const examplesButton = buttonCalled('Examples', titleRow);
  const rulesButton = buttonCalled('Rules', titleRow);
  assert.ok(examplesButton.compareDocumentPosition(rulesButton) & Node.DOCUMENT_POSITION_FOLLOWING, 'Examples comes before Rules');
  assert.match(examplesButton.className, /\bmin-h-12\b/);
  assert.equal(examplesButton.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(examplesButton.disabled, false);
  // (three examples are open to a visitor: the pointer's words say "ready-made programs", not "for members")
  assert.equal(examplesButton.title, 'Ready-made programs');

  // a visitor's row and map before an example: Forward on map 2, then Mini
  await click($('[data-add="forward"]'));
  await click($('[data-map="2"]'));
  await click(modeButton('Mini: tap to drive'));
  assert.equal(checkedMode(), 'Mini: tap to drive');
  assert.equal(checkedMap(), '2');

  // ---- as a visitor: 5 examples, 3 open, under the headings the website sent
  examplesButton.focus();
  await click(examplesButton);
  assert.ok(dialog(), 'the window is open');
  assert.equal(textOf($('h2', dialog() as HTMLElement)), 'Examples');
  // (the window is not drawn inside the title row, whose layer is under the site's header)
  assert.ok(!titleRow.contains(dialog()) && dialog()?.closest('.cadet-app'), 'the window stands outside the title row, in the screen');
  assert.equal(cards().length, 5);
  assert.equal(openCards().length, 3);
  assert.deepEqual(
    openCards().map((card) => card.getAttribute('data-example')),
    byLevel('starter').map((example) => example.id),
  );
  assert.equal(textOf(document.querySelector('[data-examples-intro]')), examplesIntro('some-open', 'MakeX Lebanon', CADET_WORDS.howLoadingWorks));

  // load the starter made for practice map 3
  const turn = byLevel('starter').find((example) => fieldOf(example.program) === 'P3');
  assert.ok(turn, 'a starter on map 3');
  await click($(`button[aria-label="Load the example ${turn.title}"]`));
  assert.equal(dialog(), null, 'the window closes');
  assert.equal(document.activeElement, examplesButton, 'the keyboard is back on the button');
  assert.equal(checkedMode(), 'Junior: cards', 'Junior');
  assert.equal(checkedMap(), '3', 'its map');
  assert.deepEqual(row(), readCards(turn.program), 'its cards');
  assert.equal(banner(), 'Example loaded: its cards and its map.');
  const settings = JSON.parse(localStorage.getItem(storageKey('fire-cadet', 'settings')) ?? '{}') as { scenario?: string; mode?: string };
  assert.deepEqual([settings.scenario, settings.mode], ['P3', 'cards'], 'remembered');
  // Undo brings the cards back - one step - and the map stays
  await click($('[aria-label="Undo"]'));
  assert.deepEqual(row(), ['forward']);
  assert.equal(checkedMap(), '3');
  await click($('[aria-label="Redo"]'));
  assert.deepEqual(row(), readCards(turn.program));

  // ---- a member code: the 5 cards, all open
  await click(examplesButton);
  await typeCode(MEMBER_CODE);
  await until('the member code is accepted', () => openCards().length === 5);
  assert.equal(cards().length, 5);
  assert.deepEqual(
    openCards().map((card) => card.getAttribute('data-example')),
    examples.filter((example) => example.level !== 'advanced').map((example) => example.id),
  );
  assert.equal(textOf(document.querySelector('[data-examples-intro]')), examplesIntro('unlocked', 'MakeX Lebanon', CADET_WORDS.howLoadingWorks));
  assert.equal(asked.at(-1)?.body, `{"game":"fire-cadet","code":"${MEMBER_CODE}"}`);

  // ---- an advanced code in its place: 6 cards, all open
  await click($('[data-change-code]', dialog() as HTMLElement));
  await typeCode(ADVANCED_CODE);
  await until('the advanced code is accepted', () => openCards().length === 6);
  assert.equal(cards().length, 6);
  const [advanced] = byLevel('advanced');
  assert.ok(advanced && openCards().some((card) => card.getAttribute('data-example') === advanced.id));
  // the window closes with Escape and changes nothing
  await act(async () => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(dialog(), null);
  assert.deepEqual(row(), readCards(turn.program));

  // load the advanced example: its cards and its map, and they score all 25 points there
  await click(examplesButton);
  await click($(`button[aria-label="Load the example ${advanced.title}"]`));
  assert.equal(dialog(), null);
  assert.deepEqual(row(), readCards(advanced.program));
  assert.equal(checkedMap(), fieldOf(advanced.program).slice(1));
  assert.equal(banner(), 'Example loaded: its cards and its map.');
  const shown = readMapCode(`P${checkedMap()}`);
  assert.ok(shown.ok);
  const played = playFireCadet(cardRowProgram(row() as CardName[]), shown.scenario);
  assert.deepEqual([played.total, played.max, played.finishReason], [NUMBERS.MAX_POINTS, NUMBERS.MAX_POINTS, 'program-ended'], 'the row on the screen, on the map on the screen');

  // ---- GO on a phone, after the child scrolled down to the Map section: the row is under the map block, and the page
  // brings it back up, to just under the block (./card-row.ts pageScrollToShow); the row keeps the running card in view itself
  const at = (el: Element, top: number, bottom: number) =>
    Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => ({ top, bottom, left: 0, right: 390, width: 390, height: bottom - top, x: 0, y: top }) });
  at($('.cadet-stage-block'), 64, 460);
  // (the stylesheet makes the block stick under the site header; a document without it is told so here)
  Object.assign($('.cadet-stage-block').style, { position: 'sticky', top: '64px' });
  at($('.cadet-bar'), 756, 844);
  at($('[role="listbox"]'), 200, 280);
  // during a match the button is locked (as the row, the map and the way to play); after STOP it is free again
  await click($('[aria-label="Go: the robot runs your row"]'));
  assert.deepEqual(dom.scrolls, [{ top: 200 - 468, behavior: 'smooth' }], 'GO brought the row into view, once');
  await act(async () => dom.frames(3));
  assert.equal(examplesButton.disabled, true, 'locked during a match');
  await click($('[aria-label="Stop: the match ends now and the points count"]'));
  assert.equal(examplesButton.disabled, false, 'free after the match');
  // AGAIN, and GO with the row in view: the page stays where it is; on the classroom screen it never moves
  await click($('[aria-label="Again: put everything back to the start"]'));
  at($('[role="listbox"]'), 480, 560);
  await click($('[aria-label="Go: the robot runs your row"]'));
  await click($('[aria-label="Stop: the match ends now and the points count"]'));
  await click($('[aria-label="Again: put everything back to the start"]'));
  dom.screen.classroom = true;
  at($('[role="listbox"]'), 200, 280);
  await click($('[aria-label="Go: the robot runs your row"]'));
  await click($('[aria-label="Stop: the match ends now and the points count"]'));
  dom.screen.classroom = false;
  assert.equal(dom.scrolls.length, 1, 'no other scroll of the page');
  // the first GO on the classroom screen closed the Map section (the review: under the map it filled the short left
  // column, and the score sheet was out of view after the match); it opens again with its head
  const mapHead = [...document.querySelectorAll<HTMLButtonElement>('section > h2 > button[aria-expanded]')].find((b) => textOf(b).startsWith(CADET_WORDS.map.title));
  assert.ok(mapHead);
  assert.equal(mapHead.getAttribute('aria-expanded'), 'false', 'the Map section is closed after the first GO of the classroom screen');
  await click(mapHead);
  assert.equal(mapHead.getAttribute('aria-expanded'), 'true');
  // loading after a match puts the field back to the start, as a new map does
  await click(examplesButton);
  const there = byLevel('starter').find((example) => fieldOf(example.program) === 'P1');
  assert.ok(there);
  await click($(`button[aria-label="Load the example ${there.title}"]`));
  assert.ok($('[aria-label="Go: the robot runs your row"]'), 'GO again: the field is at the start');
  assert.deepEqual(row(), readCards(there.program));
  assert.equal(checkedMap(), '1');

  // nothing else was asked of the website: once as a visitor, once per code
  assert.deepEqual(
    asked.map((a) => a.body),
    ['{"game":"fire-cadet"}', `{"game":"fire-cadet","code":"${MEMBER_CODE}"}`, `{"game":"fire-cadet","code":"${ADVANCED_CODE}"}`],
  );
  await act(async () => root.unmount());
  dom.close();
});
