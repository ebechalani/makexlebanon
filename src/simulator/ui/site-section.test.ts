/**
 * The Simulator section of the website: the menu item and its dropdown, the one page /simulator with a part per
 * season, the pages of the games under /simulator/<game>, the title row above each game, the
 * old addresses under Training that send visitors on, the sitemap, and the Training page's card
 * that leads to the section.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import ts from 'typescript';
import {
  getCategory,
  getSeason,
  missionSimulators,
  seasons,
  simulatorSeasons,
  simulatorTrack,
  trainingTracks,
  type MissionSimulator,
  type Season,
} from '../../../content/seasons';
import { nav, simulatorMenu, site } from '../../../content/site';
import { standaloneCategories, type StandaloneCategory } from '../../../content/standalone';
import { fireFighterGame } from '../fire-fighter/game';
import { SAMPLE_CATALOG as FIGHTER_CATALOG } from '../fire-fighter/sample-catalog';
import { SAMPLE_CATALOG as FETE_CATALOG } from '../robot-en-fete/sample-catalog';
import { fireRescueGame } from '../fire-rescue/game';
import { GAME_OF_AN_UNNAMED_ANSWER } from './member-unlock';
import { TitleBar } from './TitleBar';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fromRoot = (file: string): string => path.join(REPO_ROOT, file);

/** The old address of the list and of the three games of before, under Training. (Locker Room came later and never had one.) */
const OLD = '/training/simulator';

/** Every simulator in content/seasons.ts: of a category, or of a mission. */
const SIMULATOR_HREFS = [
  ...seasons.flatMap((season) => season.categories.flatMap((category) => (category.simulator ? [category.simulator] : []))),
  ...missionSimulators,
].map((simulator) => ({ href: simulator.href, mat: simulator.mat }));

test('menu: "Simulator" links to /simulator, between Training and Videos; Training no longer lists the simulators', () => {
  const labels = nav.map((item) => item.label);
  assert.deepEqual(labels, ['Home', 'Seasons', 'Competitions', 'Gallery', 'Training', 'Simulator', 'Videos', 'Contact']);
  const simulator = nav.find((item) => item.label === 'Simulator');
  assert.equal(simulator?.href, '/simulator');
  const training = nav.find((item) => item.label === 'Training');
  assert.deepEqual(
    training?.children?.map((child) => child.href),
    ['/training', '/workshops', '/kits'],
  );
  // (no line of the menu leads to a simulator but "Simulator" and its dropdown)
  for (const item of nav) {
    if (item === simulator) continue;
    for (const link of [item, ...(item.children ?? [])]) {
      assert.ok(!link.href.startsWith('/simulator') && !/simulator/i.test(link.label), link.label);
    }
  }
});

test('menu: the dropdown of "Simulator" is the Simulator page, then each simulator in the order of that page', () => {
  const simulator = nav.find((item) => item.label === 'Simulator');
  assert.deepEqual(simulator?.children, [
    { label: 'All simulators', href: '/simulator' },
    { label: 'Locker Room — Season 2026', href: '/simulator/locker-room' },
    { label: 'Warehouse Sort — Season 2026', href: '/simulator/warehouse-sort' },
    { label: 'Fire Cadet — Season 2027', href: '/simulator/fire-cadet' },
    { label: 'Fire Fighter — Season 2027', href: '/simulator/fire-fighter' },
    { label: 'Fire Rescue Junior — Season 2027', href: '/simulator/fire-rescue-junior' },
    { label: 'Fire Rescue Senior — Season 2027', href: '/simulator/fire-rescue-senior' },
    { label: 'Fire Chief — Season 2027', href: '/simulator/fire-chief' },
    // (after the seasons, the simulator of the category of its own: content/standalone.ts. The menu is English;
    // the two names in its line are French proper names, the simulator's and its category's)
    { label: 'Tri d’entrepôt — Robot en fête 2027', href: '/simulator/tri-entrepot' },
  ]);
  // the same simulators as the cards of /simulator, in the same order: the seasons' first, then the categories of their own
  assert.deepEqual(
    simulator?.children?.slice(1).map((child) => child.href),
    [
      ...simulatorSeasons().flatMap((section) => section.simulators.map((card) => card.href)),
      ...standaloneCategories.flatMap((category) => category.simulators.map((card) => card.href)),
    ],
  );
  // (built from the season data, not typed by hand)
  assert.deepEqual(simulator?.children, simulatorMenu());
  // (on a computer the dropdown is as wide as its longest line: "Warehouse Sort — Season 2026" would break in the usual width)
  assert.equal(simulator?.childrenOnOneLine, true);
});

test('menu: a simulator added to a season appears in the dropdown by itself, in its season\'s place', () => {
  const withSummary = { summary: 'Two sentences.', mat: '/simulator/new/mat.webp' };
  const added: Season[] = seasons.map((season) =>
    season.year === 2025
      ? { ...season, categories: season.categories.map((category, i) => (i === 0 ? { ...category, simulator: { href: '/simulator/new', ...withSummary } } : category)) }
      : season,
  );
  const first2025 = seasons.find((season) => season.year === 2025)?.categories[0].name;
  assert.ok(first2025);
  const missions: MissionSimulator[] = [
    ...missionSimulators,
    { name: 'Later Mission', season: 2027, label: 'Level', event: 'Local event', href: '/simulator/later', ...withSummary },
  ];
  assert.deepEqual(simulatorMenu(simulatorSeasons(added, missions)), [
    { label: 'All simulators', href: '/simulator' },
    { label: `${first2025} — Season 2025`, href: '/simulator/new' },
    { label: 'Locker Room — Season 2026', href: '/simulator/locker-room' },
    { label: 'Warehouse Sort — Season 2026', href: '/simulator/warehouse-sort' },
    { label: 'Fire Cadet — Season 2027', href: '/simulator/fire-cadet' },
    { label: 'Fire Fighter — Season 2027', href: '/simulator/fire-fighter' },
    { label: 'Fire Rescue Junior — Season 2027', href: '/simulator/fire-rescue-junior' },
    { label: 'Fire Rescue Senior — Season 2027', href: '/simulator/fire-rescue-senior' },
    { label: 'Fire Chief — Season 2027', href: '/simulator/fire-chief' },
    { label: 'Later Mission — Season 2027', href: '/simulator/later' },
    // (the category of its own stays at the end, after every season)
    { label: 'Tri d’entrepôt — Robot en fête 2027', href: '/simulator/tri-entrepot' },
  ]);
  // no simulator at all: only the Simulator page; no season but the category of its own: its line alone
  assert.deepEqual(simulatorMenu([], []), [{ label: 'All simulators', href: '/simulator' }]);
  assert.deepEqual(simulatorMenu([]), [
    { label: 'All simulators', href: '/simulator' },
    { label: 'Tri d’entrepôt — Robot en fête 2027', href: '/simulator/tri-entrepot' },
  ]);
  // a second simulator of the category (the organiser's « Logistique intelligente », to come) gets its line after the first, by itself
  const [fete] = standaloneCategories;
  const later = { ...fete.simulators[0], name: 'Plus tard', href: '/simulator/plus-tard', menuLabel: 'Plus tard — Robot en fête 2027' };
  assert.deepEqual(simulatorMenu([], [{ ...fete, simulators: [...fete.simulators, later] }]), [
    { label: 'All simulators', href: '/simulator' },
    { label: 'Tri d’entrepôt — Robot en fête 2027', href: '/simulator/tri-entrepot' },
    { label: 'Plus tard — Robot en fête 2027', href: '/simulator/plus-tard' },
  ]);
});

test('menu: a category with a long name can give the dropdown a shorter one (menuName); the Simulator page keeps the full name', () => {
  const locker = simulatorSeasons()
    .flatMap((section) => section.simulators)
    .find((card) => card.href === '/simulator/locker-room');
  assert.equal(locker?.name, 'Capelli Starter — Locker Room');
  assert.equal(locker?.menuName, 'Locker Room');
  // only Locker Room has one: the other cards carry no menuName at all
  assert.deepEqual(
    simulatorSeasons()
      .flatMap((section) => section.simulators)
      .filter((card) => 'menuName' in card)
      .map((card) => card.href),
    ['/simulator/locker-room'],
  );
  // no line of the dropdown has two dashes
  for (const child of simulatorMenu().slice(1)) assert.equal(child.label.split(' — ').length, 2, child.label);
});

test('menu: every line of the Simulator dropdown opens a page of the website', () => {
  const simulator = nav.find((item) => item.label === 'Simulator');
  assert.ok(simulator?.children?.length);
  for (const { href } of simulator.children) {
    const page = `src/app${href}/page.tsx`;
    assert.ok(existsSync(fromRoot(page)), `${href}: ${page}`);
  }
});

test('menu: the other items and their dropdowns are as before', () => {
  assert.deepEqual(
    nav.filter((item) => item.label !== 'Simulator'),
    [
      { label: 'Home', href: '/' },
      {
        label: 'Seasons',
        href: '/season/2026',
        children: [
          { label: 'Season 2027 — Fire Rescue ✨', href: '/season/2027' },
          { label: 'Season 2026 — Capelli Sport', href: '/season/2026' },
        ],
      },
      {
        label: 'Competitions',
        href: '/competitions',
        children: [
          { label: 'National', href: '/competitions/national' },
          { label: 'International', href: '/competitions/international' },
        ],
      },
      { label: 'Gallery', href: '/gallery' },
      {
        label: 'Training',
        href: '/training',
        children: [
          { label: 'Training & hints', href: '/training' },
          { label: 'Workshops & events', href: '/workshops' },
          { label: 'Competition kits', href: '/kits' },
        ],
      },
      { label: 'Videos', href: '/media' },
      { label: 'Contact', href: '/contact' },
    ],
  );
});

test('menu: content/seasons.ts imports nothing, so content/site.ts can take the simulators from it without an import cycle', () => {
  // (the menu is drawn by a client component: what content/site.ts imports goes to every visitor's
  // browser, so it takes plain data only. preProcessFile lists imports, re-exports, require() and import().)
  const importsOf = (file: string): string[] =>
    ts.preProcessFile(readFileSync(fromRoot(file), 'utf8'), true, true).importedFiles.map((imported) => imported.fileName);
  assert.deepEqual(importsOf('content/seasons.ts'), []);
  // (and the categories of their own, outside every season, are plain data too: content/seasons.ts does not know them)
  assert.deepEqual(importsOf('content/standalone.ts'), []);
  assert.deepEqual(importsOf('content/site.ts'), ['./seasons', './standalone']);
});

/**
 * Give Node the few browser globals React needs to draw into a document. Returns the function that
 * takes them away again (the other tests of this file run without them), or null without jsdom.
 */
function withDom(): (() => void) | null {
  let JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> & { close(): void } };
  try {
    ({ JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: typeof JSDOM });
  } catch {
    return null;
  }
  const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { pretendToBeVisual: true, url: 'http://localhost/contact' });
  const names = ['self', 'window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent',
    'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT']; // prettier-ignore
  const before = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  for (const name of names) {
    const value = name === 'window' || name === 'self' ? dom.window : name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return () => {
    for (const [name, descriptor] of before) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
    dom.window.close();
  };
}

test('menu on a computer: a line picked in a dropdown lets go of the focus, so the list does not stay open over the new page', async (t) => {
  const removeDom = withDom();
  if (!removeDom) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  // (usePathname() reads the page's address from this context, which Next fills on the website)
  const { PathnameContext } = createRequire(import.meta.url)('next/dist/shared/lib/hooks-client-context.shared-runtime') as {
    PathnameContext: import('react').Context<string | null>;
  };
  const { Header } = await import('../../components/Header');
  const root = createRoot(document.getElementById('root') as HTMLElement);
  // (a link here would lead jsdom to a page it cannot open: the click only does what the menu does)
  const stay = (event: Event) => event.preventDefault();
  window.addEventListener('click', stay);
  try {
    await act(async () => root.render(createElement(PathnameContext.Provider, { value: '/contact' }, createElement(Header))));
    const groups = [...document.querySelectorAll('nav[aria-label="Main"] > div.group')];
    const groupOf = (label: string): Element => {
      const group = groups.find((g) => g.querySelector(':scope > a')?.textContent === label);
      assert.ok(group, label);
      return group;
    };
    // (the list shows on :focus-within of its menu item, that is while the focus is inside it; asked
    // this way because jsdom's own :focus-within still matches after the focus has gone)
    const open = (group: Element): boolean => group.contains(document.activeElement);
    // (what has the focus, in words: a failed assert.equal on the elements themselves would print all of jsdom)
    const focused = (): string => {
      const element = document.activeElement;
      return element === document.body ? 'the page' : `${element?.tagName} ${element?.textContent}`;
    };
    let lines = 0;
    for (const item of nav.filter((navItem) => navItem.children)) {
      const group = groupOf(item.label);
      const links = [...group.querySelectorAll<HTMLAnchorElement>(':scope > div a')];
      assert.deepEqual(
        links.map((link) => link.textContent),
        item.children?.map((child) => child.label),
      );
      for (const link of links) {
        // the list shows while one of its lines has the focus (that is how the keyboard opens it) ...
        link.focus();
        assert.equal(focused(), `A ${link.textContent}`);
        assert.ok(open(group), `${item.label} / ${link.textContent}: open on focus`);
        // ... and a click on the line (or Enter, which is a click too) lets go of it: Next changes the
        // page without a reload, so a line that kept the focus would keep the list open over the new
        // page, where on a game it covers the Start button and a click there opened another game
        await act(async () => link.click());
        assert.equal(focused(), 'the page', `${item.label} / ${link.textContent}: focus let go`);
        assert.ok(!open(group), `${item.label} / ${link.textContent}: closed once the mouse leaves`);
        lines += 1;
      }
    }
    assert.equal(lines, nav.reduce((sum, item) => sum + (item.children?.length ?? 0), 0));
    // the menu item itself keeps the focus after a click: on a touch screen, which has no hover, a tap on
    // "Simulator" opens the Simulator page and shows its list, from which a game is then picked
    const simulator = groupOf('Simulator').querySelector<HTMLAnchorElement>(':scope > a');
    assert.ok(simulator);
    simulator.focus();
    await act(async () => simulator.click());
    assert.equal(focused(), 'A Simulator');
    assert.ok(open(groupOf('Simulator')));

    // the width of the lists: the usual 14rem (w-56); Simulator's as wide as its longest line, but at most
    // 24rem (max-w-sm), so that a long simulator name wraps instead of running off the window at 1024 px,
    // where the list starts about 621 px from the left (621 + 384 = 1005)
    const widthOf = (label: string): string[] =>
      (groupOf(label).querySelector(':scope > div')?.className ?? '').split(/\s+/).filter((name) => /^(min-|max-)?w-/.test(name));
    assert.deepEqual(widthOf('Simulator'), ['w-max', 'min-w-56', 'max-w-sm']);
    for (const label of ['Seasons', 'Competitions', 'Training']) assert.deepEqual(widthOf(label), ['w-56'], label);
  } finally {
    window.removeEventListener('click', stay);
    await act(async () => root.unmount());
    removeDom();
  }
});

/**
 * The two Fire Rescue categories play the Fire Rescue field: their cards show the picture the
 * Fire Rescue game itself shows, in public/simulator/fire-rescue/ (the folder of the page of
 * before the split, whose address now leads to Senior). No copy of it lies next to their pages.
 */
const SHARED_MAT: Readonly<Record<string, string>> = {
  '/simulator/fire-rescue-junior': '/simulator/fire-rescue/mat.webp',
  '/simulator/fire-rescue-senior': '/simulator/fire-rescue/mat.webp',
};

test('pages: every simulator is /simulator/<game>, with its page folder, its address in the page, and its mat picture in public/simulator/<game>/ (Fire Rescue Junior and Senior: the one of Fire Rescue)', async () => {
  assert.deepEqual(
    SIMULATOR_HREFS.map((simulator) => simulator.href).sort(),
    [
      '/simulator/fire-cadet',
      '/simulator/fire-chief',
      '/simulator/fire-fighter',
      '/simulator/fire-rescue-junior',
      '/simulator/fire-rescue-senior',
      '/simulator/locker-room',
      '/simulator/warehouse-sort',
    ],
  );
  for (const { href, mat } of SIMULATOR_HREFS) {
    const game = /^\/simulator\/([a-z0-9-]+)$/.exec(href)?.[1];
    assert.ok(game, href);
    const page = `src/app/simulator/${game}/page.tsx`;
    assert.ok(existsSync(fromRoot(page)), page);
    // the page's own address: canonical and share data
    const { metadata } = (await import(`../../app/simulator/${game}/page`)) as { metadata: { alternates?: { canonical?: string }; openGraph?: { url?: string } } };
    assert.equal(metadata.alternates?.canonical, href, page);
    assert.equal(metadata.openGraph?.url, href, page);
    // the picture keeps its address next to the page of its game: a file in public/simulator/<game>/, and no
    // file where the page is. The two Fire Rescue categories share the one of the Fire Rescue game (SHARED_MAT).
    assert.equal(mat, SHARED_MAT[href] ?? `/simulator/${game}/mat.webp`);
    assert.ok(statSync(fromRoot(`public${mat}`)).isFile(), mat);
    if (SHARED_MAT[href]) assert.ok(!existsSync(fromRoot(`public/simulator/${game}`)), `nothing in public/ at the address of ${href}`);
    else assert.ok(statSync(fromRoot(`public/simulator/${game}`)).isDirectory(), `public/simulator/${game} is a folder, not a file that would hide the page`);
  }
  // (the shared picture is the one the Fire Rescue game shows on its stage)
  assert.equal(fireRescueGame.mat.imageUrl, '/simulator/fire-rescue/mat.webp');
  // one page and the pages of the games, nothing else: no page per season
  const folders = readdirSync(fromRoot('src/app/simulator'), { withFileTypes: true });
  assert.deepEqual(
    folders.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort(),
    ['fire-cadet/', 'fire-chief/', 'fire-fighter/', 'fire-rescue-junior/', 'fire-rescue-senior/', 'locker-room/', 'page.tsx', 'tri-entrepot/', 'warehouse-sort/'],
  );
  assert.ok(!existsSync(fromRoot('src/app/training/simulator')), 'the old folder is gone');
  assert.ok(!existsSync(fromRoot('src/app/simulator/fire-rescue')), 'the page of before the split is gone: its address is a redirect');
});

test('Simulator page: seven simulators - Season 2026 (Locker Room, Warehouse Sort), then Season 2027 (Fire Cadet, Fire Fighter, Fire Rescue Junior, Fire Rescue Senior, Fire Chief)', () => {
  assert.deepEqual(
    simulatorSeasons().map((section) => [section.year, section.simulators.map((simulator) => simulator.name)]),
    [
      [2026, ['Capelli Starter — Locker Room', 'Warehouse Sort']],
      [2027, ['Fire Cadet', 'Fire Fighter', 'Fire Rescue Junior', 'Fire Rescue Senior', 'Fire Chief']],
    ],
  );
  assert.equal(simulatorSeasons().flatMap((section) => section.simulators).length, 7);
  const [season2026, season2027] = simulatorSeasons();
  // (the category first, with its age group, its season and its "About" link; then the mission of the local event)
  assert.deepEqual(season2026.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/locker-room', ['13–15 years', 'Season 2026'], '/season/2026/locker-room'],
    ['/simulator/warehouse-sort', ['MakeX Inspire · Beginner', 'Local event'], undefined],
  ]);
  // (Fire Cadet first: the first category of Season 2027 in content/seasons.ts; Fire Fighter, the second, next)
  assert.deepEqual(season2027.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/fire-cadet', ['4–7 years', 'Season 2027'], '/season/2027/fire-cadet'],
    ['/simulator/fire-fighter', ['8–10 years', 'Season 2027'], '/season/2027/fire-fighter'],
    ['/simulator/fire-rescue-junior', ['10–12 years', 'Season 2027'], '/season/2027/fire-rescue-junior'],
    ['/simulator/fire-rescue-senior', ['13–15 years', 'Season 2027'], '/season/2027/fire-rescue-senior'],
    ['/simulator/fire-chief', ['14–17 years', 'Season 2027'], '/season/2027/fire-chief'],
  ]);
});

test('Fire Cadet: the first category of Season 2027 has a simulator (the mTiny), no shorter menu name, and no download', async () => {
  const season2027 = seasons.find((season) => season.year === 2027);
  const cadet = season2027?.categories.find((category) => category.slug === 'fire-cadet');
  assert.ok(cadet);
  assert.equal(season2027?.categories[0], cadet);
  assert.deepEqual([cadet.name, cadet.ageRange, cadet.platform], ['Fire Cadet', '4–7 years', 'mTiny']);
  assert.deepEqual(cadet.simulator, {
    href: '/simulator/fire-cadet',
    summary:
      'Lay a row of mTiny coding cards, or drive the robot with taps on the arrow cards, and watch it rescue ' +
      'Fire City on the competition map. It runs in the browser: no robot and no installation needed.',
    mat: '/simulator/fire-cadet/mat.webp',
  });
  // no rules file is published for this category yet (the Rules window of the simulator tells the rules),
  // and no official printed map is said to exist: neither is added for the simulator
  assert.equal(cadet.downloads, undefined);
  assert.equal(cadet.hasMap, undefined);
  // the mTiny has no line sensor: the mat has one picture only, the one that is shown
  assert.deepEqual(readdirSync(fromRoot('public/simulator/fire-cadet')), ['mat.webp']);
  // the page names the robot in its title
  const { metadata } = (await import('../../app/simulator/fire-cadet/page')) as { metadata: { title?: string } };
  assert.equal(metadata.title, 'mTiny simulator — Fire Cadet');
});

test('Fire Fighter: the second category of Season 2027 has a simulator (the mBot2), no shorter menu name, and no download', async () => {
  const season2027 = seasons.find((season) => season.year === 2027);
  const fighter = season2027?.categories.find((category) => category.slug === 'fire-fighter');
  assert.ok(fighter);
  assert.equal(season2027?.categories[1], fighter);
  // the ages are the rules' (8–10), as the organiser said; the teaser stays as it was
  assert.deepEqual([fighter.name, fighter.ageRange, fighter.platform], ['Fire Fighter', '8–10 years', 'mBot2']);
  assert.equal(fighter.summary, 'The robot rolls out on its own. Same city — higher stakes.');
  // (no menuName: "Fire Fighter" is short)
  assert.deepEqual(fighter.simulator, {
    href: '/simulator/fire-fighter',
    summary:
      'Build a program with mBlock-style blocks and watch the mBot2 carry the cubes to the letter towers on ' +
      'the Fire Fighter mat — four red cubes to M, A, K and E, the yellow one to X — scored as the rules ' +
      'propose. It runs in the browser: no robot and no installation needed.',
    mat: '/simulator/fire-fighter/mat.webp',
  });
  // no rules file is published for this category: its scoring is a proposal the organiser has not confirmed, and
  // whether the website may publish the file is still a question for the organiser (the simulator's Rules window
  // tells the rules). No official printed map is said to exist either. The source says why.
  assert.equal(fighter.downloads, undefined);
  assert.equal(fighter.hasMap, undefined);
  const source = readFileSync(fromRoot('content/seasons.ts'), 'utf8');
  const block = source.slice(source.indexOf("slug: 'fire-fighter'"), source.indexOf("slug: 'fire-rescue-junior'"));
  assert.match(block.replace(/\s+\/\/\s*/g, ' '), /No `downloads`: the rules file is not published here/);
  // the mBot2 has a line sensor: the mat has two pictures, the one that is shown and the one the sensor reads
  assert.deepEqual(readdirSync(fromRoot('public/simulator/fire-fighter')).sort(), ['mat-sensor.webp', 'mat.webp']);
  assert.deepEqual(
    [fireFighterGame.mat.imageUrl, fireFighterGame.mat.sensorImageUrl],
    ['/simulator/fire-fighter/mat.webp', '/simulator/fire-fighter/mat-sensor.webp'],
  );
  // the page names the robot in its title, and the mission and its ages in its description
  const { metadata } = (await import('../../app/simulator/fire-fighter/page')) as { metadata: { title?: string; description?: string } };
  assert.equal(metadata.title, 'mBot2 simulator — Fire Fighter');
  assert.equal(
    metadata.description,
    'Build a program with mBlock-style blocks and watch a Makeblock mBot2 play the Fire Fighter mission of ' +
      'MakeX Lebanon Season 2027 (ages 8–10): carry the four red cubes to the towers M, A, K and E and the ' +
      'yellow cube to X, and reveal the letters M A K E X — scored as the rules propose. Free, in the browser.',
  );
  // its category page offers the simulator, and no "Rules and downloads"
  const { default: CategoryPage } = (await import('../../app/season/[year]/[category]/page')) as {
    default: (props: { params: Promise<{ year: string; category: string }> }) => Promise<Parameters<typeof renderToStaticMarkup>[0]>;
  };
  const html = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ year: '2027', category: 'fire-fighter' }) }));
  assert.match(html, /<h1[^>]*>Fire Fighter<\/h1>/);
  assert.ok(html.includes('Ages 8–10'), 'its ages');
  assert.ok(html.includes('Try the Fire Fighter simulator'));
  assert.ok(html.includes(fighter.simulator?.summary ?? '?'), 'the sentences of its simulator');
  assert.match(html, /<a[^>]*href="\/simulator\/fire-fighter"[^>]*>Open the simulator<\/a>/);
  assert.ok(!html.includes('Rules and downloads'), 'no downloads');
  assert.ok(!html.includes('/downloads/'), 'no file');
});

test('Simulator page: a simulator added to a season appears in its part by itself; a season without one has no part', () => {
  const withSummary = { summary: 'Two sentences.', mat: '/simulator/new/mat.webp' };
  const added: Season[] = seasons.map((season) =>
    season.year === 2025
      ? { ...season, categories: season.categories.map((category, i) => (i === 0 ? { ...category, simulator: { href: '/simulator/new', ...withSummary } } : category)) }
      : season,
  );
  const missions: MissionSimulator[] = [
    ...missionSimulators,
    { name: 'Later Mission', season: 2027, label: 'Level', event: 'Local event', href: '/simulator/later', ...withSummary },
  ];
  assert.deepEqual(
    simulatorSeasons(added, missions).map((section) => [section.year, section.simulators.map((simulator) => simulator.href)]),
    [
      [2025, ['/simulator/new']],
      [2026, ['/simulator/locker-room', '/simulator/warehouse-sort']],
      [2027, ['/simulator/fire-cadet', '/simulator/fire-fighter', '/simulator/fire-rescue-junior', '/simulator/fire-rescue-senior', '/simulator/fire-chief', '/simulator/later']],
    ],
  );
  // no simulator at all: no part at all
  assert.deepEqual(simulatorSeasons(seasons.map((season) => ({ ...season, categories: season.categories.map(({ simulator: _, ...category }) => category) })), []), []);
});

test('Simulator page: each card is one link (picture, name, sentences) that names the simulator it opens; "About" is a link of its own', async () => {
  const { default: SimulatorPage, metadata } = (await import('../../app/simulator/page')) as {
    default: () => Parameters<typeof renderToStaticMarkup>[0];
    metadata: { title?: string; description?: string; alternates?: { canonical?: string }; openGraph?: { url?: string } };
  };
  assert.equal(metadata.alternates?.canonical, '/simulator');
  assert.equal(metadata.openGraph?.url, '/simulator');
  // the page is about every simulator, so it names both robots, not only the mBot2
  assert.equal(metadata.title, 'Robot simulators');
  assert.match(metadata.description ?? '', /^Program a Makeblock mBot2 with mBlock-style blocks, or lay mTiny coding cards, /);
  assert.match(
    metadata.description ?? '',
    /the 2027 categories Fire Cadet \(mTiny, ages 4–7\), Fire Fighter \(ages 8–10\), Fire Rescue Junior \(ages 10–12\), Fire Rescue Senior \(ages 13–15\) and Fire Chief \(ages 14–17\)\./,
  );
  const html = renderToStaticMarkup(createElement(SimulatorPage));
  assert.ok(html.includes('mBot2 · mTiny · In the browser'), 'the eyebrow');
  assert.ok(html.includes('Build a program with blocks for the mBot2, or a row of coding cards for the mTiny, and watch the robot run it'), 'the lead');
  // the breadcrumb of the hero: Home / Simulator
  assert.match(html, /<nav aria-label="Breadcrumb"[^>]*><ol[^>]*><li[^>]*><a[^>]*href="\/">Home<\/a>.*?<\/li><li[^>]*><span[^>]*>Simulator<\/span><\/li><\/ol><\/nav>/);
  assert.match(html, /<h1[^>]*>Simulator<\/h1>/);
  // the two parts, in this order
  const headings = [...html.matchAll(/<h2 id="season-(\d+)"[^>]*>Season (\d+)<\/h2>/g)].map((match) => match[2]);
  assert.deepEqual(headings, ['2026', '2027']);
  for (const section of simulatorSeasons()) {
    const part = html.slice(html.indexOf(`<section aria-labelledby="season-${section.year}"`), html.indexOf('</section>', html.indexOf(`season-${section.year}`)));
    for (const card of section.simulators) {
      const start = part.indexOf(`<a aria-label="Open the ${card.name} simulator"`);
      assert.ok(start >= 0, `${card.name}: a link named after the simulator, in Season ${section.year}`);
      const link = part.slice(start, part.indexOf('</a>', start) + 4);
      assert.match(link, new RegExp(`href="${card.href}"`));
      assert.ok(!link.slice(2).includes('<a '), `${card.name}: no link inside the link`);
      // the picture, the name, the sentences (which also describe the link) and the visible hint are all inside it
      assert.match(link, /<img [^>]*alt="The mat of the [^"]+ simulator, seen from above"/);
      assert.ok(link.includes(`>${card.name} simulator</h3>`), card.name);
      const describedBy = /aria-describedby="([^"]+)"/.exec(link)?.[1];
      assert.ok(describedBy && link.includes(`<p id="${describedBy}"`), `${card.name}: described by its sentences`);
      assert.ok(link.includes(`>Open the ${card.name} simulator<`), `${card.name}: the hint says what the card does`);
      for (const label of card.labels) assert.ok(link.includes(`>${label}</span>`), label);
      // the "About" link of a category is under the card, outside the link
      const rest = part.slice(start + link.length, part.indexOf('</li>', start + link.length));
      if (card.about) assert.ok(rest.includes(`href="${card.about}"`) && rest.includes(`About ${card.name}`), card.name);
      else assert.ok(!rest.includes('<a '), card.name);
    }
  }
  assert.ok(!html.includes(OLD));
});

test('title row of a game: Home / Simulator, not Training', () => {
  const html = renderToStaticMarkup(createElement(TitleBar, { title: 'Fire Rescue' }));
  const crumbs = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => [match[1], match[2]]);
  assert.deepEqual(crumbs, [
    ['/', 'Home'],
    ['/simulator', 'Simulator'],
  ]);
  assert.match(html, /<h1[^>]*>Fire Rescue simulator /);
  // after the title, the robot: the mBot2 when the screen names none, else the one it names
  assert.match(html, /<h1[^>]*>Fire Rescue simulator <span[^>]*>· mBot2<\/span><\/h1>/);
  assert.match(renderToStaticMarkup(createElement(TitleBar, { title: 'Fire Cadet', robot: 'mTiny' })), /<h1[^>]*>Fire Cadet simulator <span[^>]*>· mTiny<\/span><\/h1>/);
  // the seven simulators show the same row: the six mBot2 ones hand only their title to it, Fire Cadet its title and its robot
  const loaders: Array<[loader: string, title: string, robot: string | null]> = [
    ['fire-rescue-junior/FireRescueJuniorLoader.tsx', 'Fire Rescue Junior', null],
    ['fire-rescue/FireRescueLoader.tsx', 'Fire Rescue Senior', null],
    ['fire-chief/FireChiefLoader.tsx', 'Fire Chief', null],
    ['warehouse-sort/WarehouseSortLoader.tsx', 'Warehouse Sort', null],
    ['locker-room/LockerRoomLoader.tsx', 'Locker Room', null],
    ['fire-cadet/FireCadetLoader.tsx', 'Fire Cadet', 'mTiny'],
    ['fire-fighter/FireFighterLoader.tsx', 'Fire Fighter', null],
  ];
  for (const [loader, title, robot] of loaders) {
    const source = readFileSync(fromRoot(`src/simulator/ui/${loader}`), 'utf8');
    const bars = [...source.matchAll(/<TitleBar\b[^>]*>/g)].map((match) => match[0]);
    assert.equal(bars.length, 1, `${loader}: one title row`);
    assert.match(bars[0], new RegExp(`^<TitleBar title="${title}"`), loader);
    // (no robot named: the row says "· mBot2"; Fire Cadet's says "· mTiny")
    assert.equal(/\brobot="([^"]*)"/.exec(bars[0])?.[1] ?? null, robot, loader);
  }
});

/** The redirects of the real configuration (loaded by its full address: next.config.mjs is outside the folders
 * whose imports the guard of the examples follows - src/, content/, scripts/ - see client-guard.test.ts). */
async function realRedirects(): Promise<Array<{ source: string; destination: string; permanent: boolean }>> {
  const { default: config } = (await import(pathToFileURL(fromRoot('next.config.mjs')).href)) as {
    default: { redirects: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>> };
  };
  return config.redirects();
}

test('old addresses: exactly the four under Training, each a permanent redirect to its new address (Fire Rescue: straight to Fire Rescue Senior)', async () => {
  const redirects = await realRedirects();
  assert.deepEqual(
    redirects.filter((redirect) => redirect.source.startsWith(OLD)),
    [
      { source: '/training/simulator', destination: '/simulator', permanent: true },
      { source: '/training/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true },
      { source: '/training/simulator/fire-chief', destination: '/simulator/fire-chief', permanent: true },
      { source: '/training/simulator/warehouse-sort', destination: '/simulator/warehouse-sort', permanent: true },
    ],
  );
  // (no other redirect touches the new section but the one of the Fire Rescue page of before the split;
  // the old ones of the website are still there)
  assert.deepEqual(
    redirects.filter((redirect) => redirect.source.startsWith('/simulator')),
    [{ source: '/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true }],
  );
  assert.ok(redirects.some((redirect) => redirect.source === '/training-&-hints' && redirect.destination === '/training'));
});

test('Fire Rescue split: the old simulator page leads to Fire Rescue Senior - the same game - and the old category page to the season page, each in one step', async () => {
  const redirects = await realRedirects();
  assert.deepEqual(
    redirects.filter((redirect) => /fire-rescue/.test(redirect.source + redirect.destination)),
    [
      { source: '/training/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true },
      { source: '/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true },
      { source: '/season/2027/fire-rescue', destination: '/season/2027', permanent: true },
    ],
  );
  // no chain: no redirect leads to the address of another one
  const sources = new Set(redirects.map((redirect) => redirect.source));
  for (const redirect of redirects) assert.ok(!sources.has(redirect.destination), `${redirect.source} -> ${redirect.destination} -> ...`);
  // what they lead to is there, and what they come from is gone (a redirect never hides a page)
  assert.ok(existsSync(fromRoot('src/app/simulator/fire-rescue-senior/page.tsx')));
  assert.ok(getSeason('2027'));
  assert.ok(!existsSync(fromRoot('src/app/simulator/fire-rescue')));
  assert.equal(getCategory('2027', 'fire-rescue'), undefined);
  // Fire Rescue Senior is the game of the old page: the same Game, under the same id - the blocks and the
  // settings a student saved there are found again (the browser keeps them under the name of the game)
  const senior = readFileSync(fromRoot('src/simulator/ui/fire-rescue/FireRescueSimulator.tsx'), 'utf8');
  assert.match(senior, /\sgame=\{fireRescueGame\}\s/);
  assert.equal(fireRescueGame.id, 'fire-rescue');
  assert.match(readFileSync(fromRoot('src/app/simulator/fire-rescue-senior/page.tsx'), 'utf8'), /import \{ FireRescueLoader \} from '@\/simulator\/ui\/fire-rescue\/FireRescueLoader';/);
});

test('sitemap: the new addresses, none of the old ones', async () => {
  const { default: sitemap } = (await import('../../app/sitemap')) as { default: () => Array<{ url: string }> };
  const urls = sitemap().map((entry) => entry.url);
  for (const href of ['/simulator', ...SIMULATOR_HREFS.map((simulator) => simulator.href)]) assert.ok(urls.includes(`${site.url}${href}`), href);
  assert.deepEqual(urls.filter((url) => url.includes(OLD)), []);
});

test('Training page: one card that leads to /simulator, and no card of a single simulator', async () => {
  const toSection = trainingTracks.filter((track) => track.href === '/simulator');
  assert.equal(toSection.length, 1);
  assert.equal(toSection[0].status, 'available');
  assert.ok(!trainingTracks.some((track) => track.href?.startsWith('/simulator/')));
  const { default: TrainingPage } = (await import('../../app/training/page')) as { default: () => Parameters<typeof renderToStaticMarkup>[0] };
  const html = renderToStaticMarkup(createElement(TrainingPage));
  assert.equal(html.match(/href="\/simulator"/g)?.length, 1);
  assert.ok(!html.includes(OLD));
});

test('Training page: the card names the seasons and the simulators of the Simulator page, from the same data', () => {
  const card = trainingTracks.find((track) => track.href === '/simulator');
  assert.deepEqual(card, simulatorTrack(simulatorSeasons()));
  assert.equal(card?.ageRange, 'Seasons 2026 · 2027');
  assert.equal(card?.name, 'Robot simulators');
  assert.equal(
    card?.summary,
    'Program the robot with blocks (mBot2) or coding cards (mTiny) and watch it play on the competition mat: ' +
      'Capelli Starter — Locker Room and Warehouse Sort (Season 2026), Fire Cadet, Fire Fighter, Fire Rescue Junior, Fire Rescue Senior and Fire Chief (Season 2027). ' +
      'Works in the browser, no robot needed.',
  );
  // a simulator added later is named on the card too, in its season
  const missions: MissionSimulator[] = [
    ...missionSimulators,
    { name: 'Later Mission', season: 2027, label: 'Level', event: 'Local event', href: '/simulator/later', summary: 'Two sentences.' },
  ];
  assert.match(
    simulatorTrack(simulatorSeasons(seasons, missions)).summary,
    /: Capelli Starter — Locker Room and Warehouse Sort \(Season 2026\), Fire Cadet, Fire Fighter, Fire Rescue Junior, Fire Rescue Senior, Fire Chief and Later Mission \(Season 2027\)\. /,
  );
  // one season only: "Season", not "Seasons"
  const only2027 = simulatorTrack(simulatorSeasons(seasons.filter((season) => season.year !== 2026), []));
  assert.equal(only2027.ageRange, 'Season 2027');
  assert.match(only2027.summary, /: Fire Cadet, Fire Fighter, Fire Rescue Junior, Fire Rescue Senior and Fire Chief \(Season 2027\)\. /);
});

test('a page opened from a link of a scrolled page starts at its top, not under the sticky header', () => {
  // globals.css makes <html> scroll smoothly. Next 16 then needs data-scroll-behavior="smooth" on
  // <html> to jump to the top of the new page; without it the jump is smooth, does not get there
  // and the router scrolls the page down to its first element instead: a game page opened from a
  // card of /simulator had its title row (Home / Simulator, the title, Rules) under the header.
  const css = readFileSync(fromRoot('src/app/globals.css'), 'utf8');
  const smooth = /(?:^|\n)\s*html\s*\{[^}]*scroll-behavior:\s*smooth/.test(css);
  const html = /<html\b[^>]*>/.exec(readFileSync(fromRoot('src/app/layout.tsx'), 'utf8'))?.[0] ?? '';
  assert.ok(html, 'the root layout has an <html> element');
  if (smooth) assert.match(html, /\sdata-scroll-behavior="smooth"/);
});

test('home page on a phone: a champion\'s card keeps to its column, so the page does not scroll sideways', () => {
  // "Season 2026 champions" is a grid of cards, one column on a phone. A grid item is as wide as its content wants
  // unless it has min-w-0: a card with a long name on one line wanted 448 px on a 390 px screen, and the whole page
  // scrolled sideways (measured in Chromium: scrollWidth 468). With min-w-0 the card keeps to its column, and the
  // long line is cut with "..." as its `truncate` means it to be.
  const page = readFileSync(fromRoot('src/app/page.tsx'), 'utf8');
  const list = /<ul className="[^"]*\bgrid\b[^"]*">\s*\{champions\.map\(\(champion\) => \([\s\S]*?<\/ul>/.exec(page)?.[0] ?? '';
  assert.ok(list, 'the list of the champions');
  assert.match(list, /<li key=\{champion\.key \+ champion\.name\} className="(?:[^"]* )?min-w-0(?: [^"]*)?">/);
  // (the lines that can be long are cut, inside a text column that may shrink too)
  assert.match(list, /<span className="min-w-0">\s*<span className="block truncate [^"]*">\s*\{champion\.name\}/);
});

test('no source file names an old address, except the redirects (next.config.mjs), this test and the README note on the redirects', () => {
  const thisFile = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));
  const TEXT = /\.(?:[cm]?[jt]sx?|json|css|html?|svg|txt|xml|md)$/;
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(fromRoot(relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (relative || ['src', 'content', 'scripts', 'public'].includes(entry.name)) walk(name);
      } else if (TEXT.test(entry.name) && name !== 'next.config.mjs' && name !== thisFile && name !== 'package-lock.json' && name !== 'README.md') {
        if (readFileSync(fromRoot(name), 'utf8').includes(OLD)) found.push(name);
      }
    }
  };
  walk('');
  assert.deepEqual(found, []);
});

test('no source file links the Fire Rescue addresses of before the split, except the redirects (next.config.mjs), this test and the README', () => {
  const thisFile = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));
  const TEXT = /\.(?:[cm]?[jt]sx?|json|css|html?|svg|txt|xml|md)$/;
  // (the folder of the pictures, public/simulator/fire-rescue/, keeps its name: the Fire Rescue game shows them;
  // and the folder of the game's code, src/simulator/fire-rescue, is no address)
  const OLD_PAGES = [/(?<!src)\/simulator\/fire-rescue(?![\w/-])/, /\/season\/2027\/fire-rescue(?![\w-])/];
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(fromRoot(relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (relative || ['src', 'content', 'scripts', 'public'].includes(entry.name)) walk(name);
      } else if (TEXT.test(entry.name) && name !== 'next.config.mjs' && name !== thisFile && name !== 'package-lock.json' && name !== 'README.md') {
        const text = readFileSync(fromRoot(name), 'utf8');
        if (OLD_PAGES.some((old) => old.test(text))) found.push(name);
      }
    }
  };
  walk('');
  assert.deepEqual(found, []);
});

// =============================================================================================
// Fire Rescue Junior and Fire Rescue Senior on the website
// =============================================================================================

test('Season 2027: Fire Rescue Junior (10–12) and Fire Rescue Senior (13–15) where Fire Rescue stood; Fire Fighter and Fire Chief keep their ages', () => {
  const season2027 = getSeason('2027');
  assert.ok(season2027);
  assert.deepEqual(
    season2027.categories.map((category) => [category.slug, category.name, category.ageRange, category.platform]),
    [
      ['fire-cadet', 'Fire Cadet', '4–7 years', 'mTiny'],
      ['fire-fighter', 'Fire Fighter', '8–10 years', 'mBot2'],
      ['fire-rescue-junior', 'Fire Rescue Junior', '10–12 years', 'mBot2'],
      ['fire-rescue-senior', 'Fire Rescue Senior', '13–15 years', 'mBot2'],
      ['fire-chief', 'Fire Chief', '14–17 years', 'mBot2'],
    ],
  );
  const junior = getCategory('2027', 'fire-rescue-junior');
  const senior = getCategory('2027', 'fire-rescue-senior');
  assert.ok(junior && senior);
  // the teasers say what is drawn, and nothing more certain than that
  assert.equal(junior.summary, 'Only the water buckets are drawn. Everything else stands where the rule book shows it.');
  assert.match(senior.summary, /^Everything is drawn: the buckets, the people and where they stand\. /);
  // each has its own simulator card, on its own page, with the picture of the Fire Rescue mat
  assert.deepEqual([junior.simulator?.href, junior.simulator?.mat], ['/simulator/fire-rescue-junior', '/simulator/fire-rescue/mat.webp']);
  assert.deepEqual([senior.simulator?.href, senior.simulator?.mat], ['/simulator/fire-rescue-senior', '/simulator/fire-rescue/mat.webp']);
  assert.match(junior.simulator?.summary ?? '', /the four buckets in any of the 24 ways the referee could draw them, and everything else where the rule book shows it/);
  assert.match(senior.simulator?.summary ?? '', /on any of the 9,216 starting combinations the referee could draw/);
  for (const category of [junior, senior]) assert.equal(category.simulator?.menuName, undefined, 'the name is short enough for the menu');
  // the introduction no longer counts four categories
  assert.ok(!/four ways/i.test(season2027.intro), season2027.intro);
  assert.match(season2027.intro, /five ways to answer the call/);
  assert.equal(season2027.categories.length, 5);
  // the source marks the words that are not the organiser's
  const source = readFileSync(fromRoot('content/seasons.ts'), 'utf8');
  const block = source.slice(source.indexOf("slug: 'fire-fighter'"), source.indexOf("slug: 'fire-chief'"));
  assert.match(block, /TO CONFIRM WITH THE ORGANISER/);
  assert.match(source.slice(source.indexOf('intro:'), source.indexOf("'The alarm sounds in 2027.")), /TO CONFIRM WITH THE ORGANISER/);
});

test('category pages: /season/2027/fire-rescue-junior and -senior exist, with their ages, and open their own simulator', async () => {
  const { default: CategoryPage, generateStaticParams, generateMetadata } = (await import('../../app/season/[year]/[category]/page')) as {
    default: (props: { params: Promise<{ year: string; category: string }> }) => Promise<Parameters<typeof renderToStaticMarkup>[0]>;
    generateStaticParams: () => Array<{ year: string; category: string }>;
    generateMetadata: (props: { params: Promise<{ year: string; category: string }> }) => Promise<{ title?: string; description?: string }>;
  };
  const params = generateStaticParams().filter((param) => param.year === '2027').map((param) => param.category);
  assert.deepEqual(params, ['fire-cadet', 'fire-fighter', 'fire-rescue-junior', 'fire-rescue-senior', 'fire-chief']);
  for (const [slug, name, ages, href] of [
    ['fire-rescue-junior', 'Fire Rescue Junior', '10–12', '/simulator/fire-rescue-junior'],
    ['fire-rescue-senior', 'Fire Rescue Senior', '13–15', '/simulator/fire-rescue-senior'],
  ]) {
    const props = { params: Promise.resolve({ year: '2027', category: slug }) };
    const metadata = await generateMetadata(props);
    assert.equal(metadata.title, `${name} — 2027`);
    const html = renderToStaticMarkup(await CategoryPage(props));
    assert.match(html, new RegExp(`<h1[^>]*>${name}</h1>`));
    assert.ok(html.includes(`Ages ${ages}`), `${slug}: its ages`);
    assert.ok(html.includes(`Try the ${name} simulator`), slug);
    assert.match(html, new RegExp(`<a[^>]*href="${href}"[^>]*>Open the simulator</a>`), `${slug}: the button opens its own simulator`);
    // (and not the other one's, nor the old address)
    const other = href.endsWith('junior') ? '/simulator/fire-rescue-senior' : '/simulator/fire-rescue-junior';
    assert.ok(!html.includes(`href="${other}"`), `${slug}: not ${other}`);
    assert.ok(!/href="\/simulator\/fire-rescue"/.test(html));
  }
});

test('season page /season/2027: five categories with their ages, each marked "Online simulator" - announced, not "ran"', async () => {
  const { default: SeasonPage } = (await import('../../app/season/[year]/page')) as {
    default: (props: { params: Promise<{ year: string }> }) => Promise<Parameters<typeof renderToStaticMarkup>[0]>;
  };
  const html = renderToStaticMarkup(await SeasonPage({ params: Promise.resolve({ year: '2027' }) }));
  const cards = [...html.matchAll(/<a[^>]*href="\/season\/2027\/([a-z-]+)"[^>]*>([^]*?)<\/a>/g)].map((match) => ({ slug: match[1], text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
  assert.deepEqual(cards.map((card) => card.slug), ['fire-cadet', 'fire-fighter', 'fire-rescue-junior', 'fire-rescue-senior', 'fire-chief']);
  const card = (slug: string): string => cards.find((c) => c.slug === slug)?.text ?? '';
  assert.match(card('fire-rescue-junior'), /^10–12 years mBot2 Online simulator Fire Rescue Junior Only the water buckets are drawn\./);
  assert.match(card('fire-rescue-senior'), /^13–15 years mBot2 Online simulator Fire Rescue Senior Everything is drawn/);
  assert.match(card('fire-fighter'), /^8–10 years mBot2 Online simulator Fire Fighter The robot rolls out on its own\./);
  assert.match(card('fire-chief'), /^14–17 years mBot2 Online simulator Fire Chief/);
  // (every category of the season has its simulator now)
  for (const { slug, text } of cards) assert.match(text, /^\S+ years \S+ Online simulator /, slug);
  assert.ok(html.includes('five ways to answer the call'));
  assert.ok(!/four ways/i.test(html));
  // the season has not happened yet: its five categories are announced - they did not "run"
  assert.equal(getSeason('2027')?.status, 'upcoming');
  assert.ok(html.includes('5 categories are announced for the 2027 season. Open a category to find out more.'), 'the line under "Competition categories"');
  assert.ok(!/categories ran in/.test(html));
  // a season that has happened keeps its sentence
  const past = renderToStaticMarkup(await SeasonPage({ params: Promise.resolve({ year: '2026' }) }));
  assert.equal(getSeason('2026')?.status, 'completed');
  assert.ok(past.includes(`${getSeason('2026')?.categories.length} categories ran in the 2026 season. Open a category for its rules, resources and photos.`));
});

test('home page: the Season 2027 block counts five ways, lists both Fire Rescue categories, and gives each its own simulator link', () => {
  const page = readFileSync(fromRoot('src/app/page.tsx'), 'utf8');
  assert.match(page, /One city\. One alarm\. Five ways to answer the call\./);
  assert.ok(!/Four ways/i.test(page));
  // a picture for each of the five categories (a category without one would get the fire)
  const emoji = /const TEASER_EMOJI: Record<string, string> = \{([^}]*)\};/.exec(page)?.[1] ?? '';
  assert.deepEqual([...emoji.matchAll(/'([a-z-]+)':/g)].map((match) => match[1]), getSeason('2027')?.categories.map((category) => category.slug));
  // the cards come from the season data, each with "Try the simulator" to category.simulator.href
  assert.match(page, /\{upcomingSeason\.categories\.map\(\(category\) => \(/);
  assert.match(page, /href=\{category\.simulator\.href\}/);
  // five cards: three and two on a laptop, one row on a wide screen
  assert.match(page, /<ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">/);
});

test('README: the note on an answer without a name speaks of the two Fire Rescue pages, which both ask for the game of such an answer', () => {
  const readme = readFileSync(fromRoot('README.md'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(
    readme.includes("(An answer without a name counts as Fire Rescue's, so the two Fire Rescue pages, Junior and Senior, go on working with such a server: both ask for `'fire-rescue'`.)"),
    'the note',
  );
  assert.ok(!readme.includes('so the Fire Rescue page goes on working'), 'not one page');
  // and so it is: an answer without a name is about 'fire-rescue', and both pages ask for that game
  assert.equal(GAME_OF_AN_UNNAMED_ANSWER, 'fire-rescue');
  for (const screen of ['src/simulator/ui/fire-rescue/FireRescueSimulator.tsx', 'src/simulator/ui/fire-rescue-junior/FireRescueJuniorSimulator.tsx']) {
    assert.match(readFileSync(fromRoot(screen), 'utf8'), /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'fire-rescue',/, screen);
  }
});

test('README: the Fire Fighter section, after Fire Cadet\'s - the organiser\'s two answers marked as answers, the list F1 - F13, the six examples, and none of Locker Room\'s words about runs', () => {
  const readme = readFileSync(fromRoot('README.md'), 'utf8');
  const start = readme.indexOf('\n## The Fire Fighter simulator\n');
  const end = readme.indexOf('\n## ', start + 1);
  assert.ok(start > readme.indexOf('\n## The Fire Cadet simulator\n') && readme.indexOf('\n## The Fire Cadet simulator\n') > 0, 'after the Fire Cadet section');
  assert.ok(readme.startsWith('\n## Deploying\n', end), 'and before "Deploying"');
  const section = readme.slice(start, end);
  const flat = section.replace(/\s+/g, ' ');
  assert.ok(flat.includes('https://www.makexlebanon.com/simulator/fire-fighter'));
  // the two answers of the organiser are answers now, in the list of questions and in the list of assumptions
  assert.ok(flat.includes('1. **Which way does tower X face, and can a cube go in from the back? — Answered by the organiser** (F1, `OPENING`): "Up, toward the hydrant line."'));
  assert.ok(flat.includes("2. **The space between a tower's two side supports — Answered by the organiser** (F2, `TOWER_GAP`, `SUPPORT_WIDTH`): \"About 6 cm\""));
  assert.match(flat, /\| F1 \| [^|]+ \| \*\*the organiser\*\* \("Up, toward the hydrant line"\)/);
  assert.match(flat, /\| F2 \| [^|]+ \| \*\*the organiser\*\* \("About 6 cm"\)/);
  // ... and so they are in game.ts, whose list the README follows: F1 - F13, the first two answered
  const game = readFileSync(fromRoot('src/simulator/fire-fighter/game.ts'), 'utf8');
  assert.match(game, /F1\. Which way tower X faces[^]*?ANSWERED by the organiser/);
  assert.match(game, /F2\. The space between a tower's two side supports - ANSWERED by the organiser/);
  for (let f = 1; f <= 13; f++) {
    assert.match(section, new RegExp(`^\\| F${f} \\| `, 'm'), `F${f} in "What this simulator assumes"`);
    assert.match(game, new RegExp(`^ \\*   F${f}\\. `, 'm'), `F${f} in game.ts`);
  }
  // the seventeen questions of the design, numbered
  for (let q = 1; q <= 17; q++) assert.match(section, new RegExp(`^ ?${q}\\. \\*\\*`, 'm'), `question ${q}`);
  assert.ok(!/^ ?18\. \*\*/m.test(section));
  // the six examples of the catalog, each with its level and its title, in catalog order, and the points they score
  const rows = [...section.matchAll(/^\| `(fighter-[a-z-]+)` \| (starter|intermediate|advanced) \| ([^|]+) \| [^|]+ \| ([^|]+) \|/gm)];
  assert.deepEqual(
    rows.map((row) => [row[1], row[2], row[3]]),
    FIGHTER_CATALOG.map((card) => [card.id, card.level, card.title]),
  );
  assert.deepEqual(rows.map((row) => row[4].replace(/\*\*/g, '').replace(/ \(.*\)$/, '')), ['0', '0', '20', '40', '40', '100']);
  // "voided run" and "two runs" are Locker Room's words, not these rules'
  assert.ok(!/voided|two runs/i.test(section));
});

test('sitemap: both new simulator pages and both new category pages; neither old address', async () => {
  const { default: sitemap } = (await import('../../app/sitemap')) as { default: () => Array<{ url: string }> };
  const urls = sitemap().map((entry) => entry.url.slice(site.url.length));
  for (const href of ['/simulator/fire-rescue-junior', '/simulator/fire-rescue-senior', '/season/2027/fire-rescue-junior', '/season/2027/fire-rescue-senior']) {
    assert.ok(urls.includes(href), href);
  }
  assert.ok(!urls.includes('/simulator/fire-rescue'));
  assert.ok(!urls.includes('/season/2027/fire-rescue'));
  assert.equal(urls.length, new Set(urls).size, 'no address twice');
});

// =============================================================================================
// Robot en fête 2027: a category of its own, in French (content/standalone.ts)
// =============================================================================================

/** The entry of Robot en fête 2027. */
function fete(): StandaloneCategory {
  const entry = standaloneCategories.find((category) => category.slug === 'robot-en-fete');
  assert.ok(entry, 'content/standalone.ts has the entry robot-en-fete');
  return entry;
}

/** Every text of an entry, with where it stands. */
function textsOf(value: unknown, at = ''): Array<[at: string, text: string]> {
  if (typeof value === 'string') return [[at, value]];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, inner]) => textsOf(inner, at ? `${at}.${key}` : key));
  return [];
}

test('Robot en fête 2027: a category of its own - in no season, with no age group, and every text of its page and its cards given, in French; its one simulator is « Tri d’entrepôt »', () => {
  assert.deepEqual(standaloneCategories.map((category) => category.slug), ['robot-en-fete']);
  const entry = fete();
  assert.deepEqual([entry.name, entry.lang, entry.platform], ['Robot en fête 2027', 'fr', 'mBot2']);
  assert.deepEqual(entry.page, {
    title: 'Robot en fête 2027',
    description: 'La version française de Warehouse Sort : la même mission pour débutants, entièrement en français, blocs compris.',
    eyebrow: '2027',
    simulatorEyebrow: 'S’entraîner en ligne',
    open: 'Ouvrir le simulateur',
    poweredByLabel: 'Proposé par',
  });
  assert.equal(
    entry.summary,
    'La version française de Warehouse Sort : la même mission pour débutants, entièrement en français, blocs compris. ' +
      'Le robot trie des cubes rouges et verts, laisse le cube bleu à sa place, puis se gare.',
  );
  // (the page's description is the first sentence of its lead)
  assert.ok(entry.summary.startsWith(`${entry.page.description} `));
  // its simulators, named by their mission (the organiser): today one, the French Warehouse Sort
  assert.deepEqual(entry.simulators.map((simulator) => simulator.name), ['Tri d’entrepôt']);
  const [simulator] = entry.simulators;
  assert.deepEqual(
    [simulator.href, simulator.mat, simulator.menuLabel, simulator.pageTitle],
    ['/simulator/tri-entrepot', '/simulator/warehouse-sort/mat.webp', 'Tri d’entrepôt — Robot en fête 2027', 'Essaie le simulateur Tri d’entrepôt'],
  );
  assert.match(simulator.summary, /^Construis un programme avec des blocs comme dans mBlock et regarde le mBot2 trier des cubes rouges et verts sur le tapis Inspire : /);
  assert.ok(simulator.summary.includes(' — avec toutes les dispositions des cubes, et le score que donnent les règles de la mission pour débutants. '), simulator.summary);
  assert.match(simulator.summary, / Tout est en français, les blocs aussi\. Le simulateur fonctionne dans le navigateur : pas besoin de robot ni d’installation\.$/);
  assert.deepEqual(simulator.card, {
    heading: 'Simulateur Tri d’entrepôt',
    open: 'Ouvrir le simulateur Tri d’entrepôt',
    matAlt: 'Le tapis du simulateur Tri d’entrepôt, vu de dessus',
    about: 'À propos de Robot en fête 2027',
    labels: ['En français', 'mBot2'],
  });
  // in no season: no category and no mission of content/seasons.ts is it, and that file does not name it
  for (const season of seasons) assert.ok(!season.categories.some((category) => category.slug === entry.slug || category.name === entry.name), `Season ${season.year}`);
  assert.ok(!missionSimulators.some((mission) => mission.href === simulator.href));
  assert.ok(!simulatorSeasons().some((section) => section.simulators.some((card) => card.href === simulator.href)));
  assert.ok(!/robot-en-f[eê]te|Robot en f[eê]te|tri-entrepot|Tri d.entrep[oô]t|standalone/i.test(readFileSync(fromRoot('content/seasons.ts'), 'utf8')), 'content/seasons.ts does not name it');
  // no age group (the organiser: "pas d'âge affiché"): no field for one, and no text that gives one
  const texts = textsOf(entry);
  assert.ok(!texts.some(([at]) => at.split('.').some((key) => /^(age|ages|ageRange|ageGroup)$/i.test(key))), 'no field for an age');
  for (const [at, text] of texts) assert.ok(!/(?<!\p{L})(ans|âge|ages?|years?)(?!\p{L})|\d\s*[–-]\s*\d/iu.test(text), `${at}: ${text}`);
  // every text of its page and its cards is given (none empty), and written as French is written: a no-break
  // space before : ; ! ?, never one after an opening word; ’ for an apostrophe
  for (const [at, text] of texts) {
    assert.ok(text.trim().length > 0, at);
    assert.ok(!/ [:;!?]/.test(text), `${at}: a plain space before : ; ! ? - ${text}`);
    assert.ok(!/'/.test(text), `${at}: ’, not ' - ${text}`);
  }
  // ... but the menu line, which is English, as the whole menu - "<simulator> — <category>", both French proper names: one dash, as every line of the dropdown
  assert.deepEqual(simulator.menuLabel.split(' — '), [simulator.name, entry.name]);
  // the mat is Warehouse Sort's picture (the same mission on the same mat), and nothing in public/ has the page's address
  assert.equal(simulator.mat, missionSimulators.find((mission) => mission.name === 'Warehouse Sort')?.mat);
  assert.ok(statSync(fromRoot(`public${simulator.mat}`)).isFile());
  for (const folder of ['public/simulator/tri-entrepot', 'public/simulator/robot-en-fete']) assert.ok(!existsSync(fromRoot(folder)), `no file or folder at ${folder}`);
  assert.ok(!existsSync(fromRoot('public/robot-en-fete')), 'no file or folder at the address of its page');
  // its two pages exist; the address the simulator had before its name, never published, is gone (no redirect)
  for (const page of ['src/app/robot-en-fete/page.tsx', 'src/app/simulator/tri-entrepot/page.tsx']) assert.ok(existsSync(fromRoot(page)), page);
  assert.ok(!existsSync(fromRoot('src/app/simulator/robot-en-fete')), 'no page at /simulator/robot-en-fete');
});

test('Robot en fête 2027: its page /robot-en-fete is French (lang="fr" on its texts), with English breadcrumbs, no age, and a part for its simulator Tri d’entrepôt', async () => {
  const entry = fete();
  const [simulator] = entry.simulators;
  const { default: Page, metadata } = (await import('../../app/robot-en-fete/page')) as {
    default: () => Parameters<typeof renderToStaticMarkup>[0];
    metadata: { title?: string; description?: string; alternates?: { canonical?: string }; openGraph?: { url?: string; locale?: string; title?: string } };
  };
  assert.equal(metadata.title, 'Robot en fête 2027');
  assert.equal(metadata.description, entry.page.description);
  assert.equal(metadata.alternates?.canonical, '/robot-en-fete');
  assert.deepEqual([metadata.openGraph?.url, metadata.openGraph?.locale, metadata.openGraph?.title], ['/robot-en-fete', 'fr_LB', 'Robot en fête 2027']);
  const html = renderToStaticMarkup(createElement(Page));
  // the breadcrumbs are the website's own path, in English: Home / Simulator / Robot en fête 2027 - with no lang of their own
  const nav = /<nav aria-label="Breadcrumb"[^>]*>[^]*?<\/nav>/.exec(html)?.[0] ?? '';
  assert.match(nav, /^<nav aria-label="Breadcrumb" class="mb-6">/);
  assert.deepEqual(
    [...nav.matchAll(/<li[^>]*>(?:<a[^>]*href="([^"]+)"[^>]*>|<span[^>]*>)([^<]+)</g)].map((match) => [match[1] ?? null, match[2]]),
    [
      ['/', 'Home'],
      ['/simulator', 'Simulator'],
      [null, 'Robot en fête 2027'],
    ],
  );
  assert.ok(!nav.includes('lang='));
  // the eyebrow, the title, the lead and the robot's pill say lang="fr"; the part about the simulator is inside lang="fr"
  assert.match(html, /<p class="[^"]*" lang="fr">2027<\/p>/);
  assert.match(html, /<h1 class="[^"]*" lang="fr">Robot en fête 2027<\/h1>/);
  assert.ok(html.includes(` lang="fr">${entry.summary}</p>`), 'the lead');
  // (the robot, then who it is proposed by: content/standalone.ts `poweredBy`)
  assert.match(html, /<div class="mt-8" lang="fr"><div class="[^"]*"><span class="[^"]*">mBot2<\/span><\/div><p class="[^"]*">Proposé par <span class="[^"]*">Eddy Bachaalany<\/span><\/p><\/div>/);
  const part = html.slice(html.indexOf('<div lang="fr"><section'));
  assert.ok(part.startsWith('<div lang="fr"><section'), 'the part about the simulator');
  assert.ok(part.includes('>S’entraîner en ligne<') && part.includes('>Essaie le simulateur Tri d’entrepôt</h2>'));
  assert.ok(part.includes(`>${simulator.summary}</p>`), 'the sentences of its simulator');
  assert.match(part, /<a[^>]*href="\/simulator\/tri-entrepot"[^>]*>Ouvrir le simulateur<\/a>/);
  assert.equal(part.match(/<section/g)?.length, 1, 'one part: one simulator');
  assert.equal(html.match(/ lang="fr"/g)?.length, 5, 'eyebrow, title, lead, pill and the part about the simulator');
  // nothing of a season's category page: no age, no downloads, no photos, no other categories - and no English of those pages
  for (const word of ['Ages', 'years', 'Season', 'Practise online', 'Try the', 'Open the simulator', 'Rules and downloads', 'Gallery', 'photos', 'undefined']) {
    assert.ok(!html.includes(word), word);
  }
});

test('Simulator page: after the seasons, a part of its own for Robot en fête 2027 - in French, with a card like the others for Tri d’entrepôt - and the English cards keep their words', async () => {
  const entry = fete();
  const [simulator] = entry.simulators;
  const { default: SimulatorPage, metadata } = (await import('../../app/simulator/page')) as {
    default: () => Parameters<typeof renderToStaticMarkup>[0];
    metadata: { description?: string };
  };
  // the page's description names it after the seasons' categories, in one more English sentence
  assert.match(
    metadata.description ?? '',
    /Fire Chief \(ages 14–17\)\. And Robot en fête 2027 \(in French\): Tri d’entrepôt, the French version of Warehouse Sort\. Free, nothing to install\.$/,
  );
  const html = renderToStaticMarkup(createElement(SimulatorPage));
  const start = html.indexOf('<section aria-labelledby="category-robot-en-fete" lang="fr">');
  assert.ok(start > html.indexOf('<section aria-labelledby="season-2027"') && html.indexOf('<section aria-labelledby="season-2027"') > 0, 'after Season 2027');
  const part = html.slice(start, html.indexOf('</section>', start) + '</section>'.length);
  // the last part of the page, with its own heading and one card
  assert.equal(html.indexOf('<section', start + 1), -1, 'the last part');
  assert.match(part, /<h2 id="category-robot-en-fete" class="[^"]*">Robot en fête 2027<\/h2>/);
  assert.equal(part.match(/<li /g)?.length, 1, 'one card');
  const linkStart = part.indexOf('<a aria-label="Ouvrir le simulateur Tri d’entrepôt"');
  assert.ok(linkStart > 0, 'a link named in French after the simulator');
  const link = part.slice(linkStart, part.indexOf('</a>', linkStart) + 4);
  assert.match(link, /href="\/simulator\/tri-entrepot"/);
  assert.match(link, /aria-describedby="simulator-tri-entrepot-summary"/);
  assert.ok(!link.slice(2).includes('<a '), 'no link inside the link');
  // its picture (the mat of Warehouse Sort), its two labels, its name, its sentences and its hint, all in French
  assert.match(link, /<img [^>]*alt="Le tapis du simulateur Tri d’entrepôt, vu de dessus"/);
  assert.match(link, /<img [^>]*src="[^"]*%2Fsimulator%2Fwarehouse-sort%2Fmat\.webp/);
  for (const label of ['En français', 'mBot2']) assert.ok(link.includes(`>${label}</span>`), label);
  assert.ok(link.includes('>Simulateur Tri d’entrepôt</h3>'));
  assert.ok(link.includes(`<p id="simulator-tri-entrepot-summary" class="mt-2 flex-1 text-sm leading-relaxed text-ink-600 text-pretty">${simulator.summary}</p>`));
  assert.ok(link.includes('>Ouvrir le simulateur Tri d’entrepôt<'));
  // under the card, outside the link, "À propos de" leads to its own page
  const rest = part.slice(linkStart + link.length);
  assert.match(rest, /^<a class="[^"]*" href="\/robot-en-fete">À propos de Robot en fête 2027</);
  // not one English word of the other cards in it, and no age
  for (const word of ['Open the', ' simulator<', 'About', 'The mat of', 'seen from above', 'Season', 'years']) assert.ok(!part.includes(word), word);
  // ... and no French outside it: the seasons' parts are as they were, with no lang of their own
  const before = html.slice(0, start);
  assert.ok(!before.includes('lang='));
  for (const word of ['Simulateur', 'Ouvrir', 'À propos', 'tapis', 'français']) assert.ok(!before.includes(word), word);
  // the English cards keep the very pieces of text they had: "<name>" " simulator", "About " "<name>" (the server's markers between them)
  const markup = renderToString(createElement(SimulatorPage));
  for (const card of simulatorSeasons().flatMap((section) => section.simulators)) {
    assert.ok(markup.includes(`>${card.name.replace(/&/g, '&amp;')}<!-- --> simulator</h3>`), card.name);
    if (card.about) assert.ok(markup.includes(`About <!-- -->${card.name.replace(/&/g, '&amp;')}`), card.name);
  }
  // (the French card's words are whole texts: no markers in them)
  assert.ok(markup.includes('>Simulateur Tri d’entrepôt</h3>') && markup.includes('>À propos de Robot en fête 2027<'));
});

test('sitemap: the page of Robot en fête 2027 and its simulator Tri d’entrepôt, after the seasons, each once', async () => {
  const { default: sitemap } = (await import('../../app/sitemap')) as { default: () => Array<{ url: string; priority?: number }> };
  const entries = sitemap().map((entry) => [entry.url.slice(site.url.length), entry.priority]);
  assert.deepEqual(entries.slice(-2), [
    ['/robot-en-fete', 0.6],
    ['/simulator/tri-entrepot', 0.7],
  ]);
  const urls = entries.map(([url]) => url);
  assert.equal(urls.length, new Set(urls).size, 'no address twice');
});

test('README: the section of Tri d’entrepôt (Robot en fête 2027), after Warehouse Sort\'s - its two addresses, its entry outside the seasons, the six examples, the five questions - and every place that counts the games', () => {
  const readme = readFileSync(fromRoot('README.md'), 'utf8');
  const start = readme.indexOf('\n## The Tri d’entrepôt simulator (Robot en fête 2027)\n');
  const end = readme.indexOf('\n## ', start + 1);
  assert.ok(start > readme.indexOf('\n## The Warehouse Sort simulator\n') && readme.indexOf('\n## The Warehouse Sort simulator\n') > 0, 'after the Warehouse Sort section');
  assert.ok(readme.startsWith('\n## The Locker Room simulator\n', end), 'and before the Locker Room section');
  const section = readme.slice(start, end);
  const flat = section.replace(/\s+/g, ' ');
  for (const address of ['https://www.makexlebanon.com/simulator/tri-entrepot', 'https://www.makexlebanon.com/robot-en-fete']) assert.ok(flat.includes(address), address);
  // (the simulator's address before its name is nowhere; its game's folder src/simulator/robot-en-fete/ keeps its name)
  assert.ok(!/(?<!src)\/simulator\/robot-en-fete\b/.test(readme), 'the simulator\'s address before its name is nowhere');
  // where it is: its own entry, outside the seasons, which content/seasons.ts does not know
  assert.ok(flat.includes('**`content/standalone.ts`**') && flat.includes('`content/seasons.ts` does not know it'));
  assert.ok(flat.includes('`text={FR_TEXT}`') && flat.includes('"Tri d’entrepôt — Robot en fête 2027"'));
  // the six examples of its catalog, each with its level and its title, in catalog order, and the points they score
  const rows = [...section.matchAll(/^\| `(fete-[a-z-]+)` \| (starter|intermediate|advanced) \| ([^|]+) \| ([^|]+) \|/gm)];
  assert.deepEqual(
    rows.map((row) => [row[1], row[2], row[3].trim()]),
    FETE_CATALOG.map((card) => [card.id, card.level, card.title]),
  );
  assert.deepEqual(rows.map((row) => row[4].replace(/ on all 24/, '').trim()), ['10', '10', '10', '30', '60', '80']);
  // the five questions of the design, numbered
  for (let q = 1; q <= 5; q++) assert.match(section, new RegExp(`^${q}\\. \\*\\*`, 'm'), `question ${q}`);
  assert.ok(!/^6\. \*\*/m.test(section));
  // every place of the README that counts the games or the simulators counts it too
  const all = readme.replace(/\s+/g, ' ');
  assert.ok(all.includes('The simulators have seven games with examples:'));
  assert.ok(all.includes('**One set of codes for all seven games.**') && all.includes('the ids of all seven games are listed at the top of the file:'));
  assert.ok(all.includes('Lists 1 and 2 hold the ids of all seven games together') && all.includes('- **One address, seven games.**'));
  assert.ok(all.includes('`/simulator` lists the eight simulators') && all.includes('lists the eight simulators of two robots'));
  assert.ok(all.includes("- Robot en fête 2027: `'fete-leave-start'`, `'fete-white-line'`, `'fete-cube-colour'`, `'fete-one-cube'`, `'fete-two-cubes'`, `'fete-all-cubes'`"));
  for (const old of ['six games with examples', 'all six games', 'One address, six games', 'the seven simulators']) assert.ok(!all.includes(old), old);
});

test('Robot en fête 2027 is proposed by Eddy Bachaalany: its page and its part of the Simulator page name him, not the academy; the season simulators keep the academy', async () => {
  const fete = standaloneCategories.find((category) => category.slug === 'robot-en-fete');
  assert.ok(fete);
  assert.equal(fete.poweredBy, 'Eddy Bachaalany');
  assert.equal(fete.page.poweredByLabel, 'Proposé par');
  const { POWERED_BY } = await import('./powered-by');
  assert.equal(POWERED_BY, 'RoboHolic Robotics Academy');

  // the Simulator page: the academy's credit right after the seasons, then the French part with its own credit
  const { default: SimulatorPage } = (await import('../../app/simulator/page')) as { default: () => Parameters<typeof renderToStaticMarkup>[0] };
  const html = renderToStaticMarkup(createElement(SimulatorPage));
  const french = /<section[^>]*lang="fr"[^>]*>[^]*?<\/section>/.exec(html)?.[0] ?? '';
  assert.ok(french, 'the French part');
  assert.match(french, /<p[^>]*>Proposé par <span[^>]*>Eddy Bachaalany<\/span><\/p><\/section>$/);
  assert.ok(!french.includes('RoboHolic') && !french.includes('Powered by'), french);
  const academy = html.indexOf('Powered by <span class="font-semibold text-ink-700">RoboHolic Robotics Academy</span>');
  assert.ok(academy > html.indexOf('Season 2027') && academy < html.indexOf('lang="fr"'), 'the academy credit sits between the seasons and the French part');
  assert.equal(html.split('RoboHolic').length - 1, 1, 'the academy is named once');

  // the page /robot-en-fete: the credit in its French hero
  const { default: CategoryPage } = (await import('../../app/robot-en-fete/page')) as { default: () => Parameters<typeof renderToStaticMarkup>[0] };
  const page = renderToStaticMarkup(createElement(CategoryPage));
  assert.match(page, /<div class="mt-8" lang="fr">[^]*?<p[^>]*>Proposé par <span[^>]*>Eddy Bachaalany<\/span><\/p><\/div>/);
  assert.ok(!page.includes('RoboHolic'));
});
