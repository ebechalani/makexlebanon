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
import { renderToStaticMarkup } from 'react-dom/server';
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
    { label: 'Fire Rescue Junior — Season 2027', href: '/simulator/fire-rescue-junior' },
    { label: 'Fire Rescue Senior — Season 2027', href: '/simulator/fire-rescue-senior' },
    { label: 'Fire Chief — Season 2027', href: '/simulator/fire-chief' },
  ]);
  // the same simulators as the cards of /simulator, in the same order
  assert.deepEqual(
    simulator?.children?.slice(1).map((child) => child.href),
    simulatorSeasons().flatMap((section) => section.simulators.map((card) => card.href)),
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
    { label: 'Fire Rescue Junior — Season 2027', href: '/simulator/fire-rescue-junior' },
    { label: 'Fire Rescue Senior — Season 2027', href: '/simulator/fire-rescue-senior' },
    { label: 'Fire Chief — Season 2027', href: '/simulator/fire-chief' },
    { label: 'Later Mission — Season 2027', href: '/simulator/later' },
  ]);
  // no simulator at all: only the Simulator page
  assert.deepEqual(simulatorMenu([]), [{ label: 'All simulators', href: '/simulator' }]);
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
  assert.deepEqual(importsOf('content/site.ts'), ['./seasons']);
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
    ['/simulator/fire-cadet', '/simulator/fire-chief', '/simulator/fire-rescue-junior', '/simulator/fire-rescue-senior', '/simulator/locker-room', '/simulator/warehouse-sort'],
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
    ['fire-cadet/', 'fire-chief/', 'fire-rescue-junior/', 'fire-rescue-senior/', 'locker-room/', 'page.tsx', 'warehouse-sort/'],
  );
  assert.ok(!existsSync(fromRoot('src/app/training/simulator')), 'the old folder is gone');
  assert.ok(!existsSync(fromRoot('src/app/simulator/fire-rescue')), 'the page of before the split is gone: its address is a redirect');
});

test('Simulator page: six simulators - Season 2026 (Locker Room, Warehouse Sort), then Season 2027 (Fire Cadet, Fire Rescue Junior, Fire Rescue Senior, Fire Chief)', () => {
  assert.deepEqual(
    simulatorSeasons().map((section) => [section.year, section.simulators.map((simulator) => simulator.name)]),
    [
      [2026, ['Capelli Starter — Locker Room', 'Warehouse Sort']],
      [2027, ['Fire Cadet', 'Fire Rescue Junior', 'Fire Rescue Senior', 'Fire Chief']],
    ],
  );
  assert.equal(simulatorSeasons().flatMap((section) => section.simulators).length, 6);
  const [season2026, season2027] = simulatorSeasons();
  // (the category first, with its age group, its season and its "About" link; then the mission of the local event)
  assert.deepEqual(season2026.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/locker-room', ['13–15 years', 'Season 2026'], '/season/2026/locker-room'],
    ['/simulator/warehouse-sort', ['MakeX Inspire · Beginner', 'Local event'], undefined],
  ]);
  // (Fire Cadet first: the first category of Season 2027 in content/seasons.ts)
  assert.deepEqual(season2027.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/fire-cadet', ['4–7 years', 'Season 2027'], '/season/2027/fire-cadet'],
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
      [2027, ['/simulator/fire-cadet', '/simulator/fire-rescue-junior', '/simulator/fire-rescue-senior', '/simulator/fire-chief', '/simulator/later']],
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
    /the 2027 categories Fire Cadet \(mTiny, ages 4–7\), Fire Rescue Junior \(ages 10–12\), Fire Rescue Senior \(ages 13–15\) and Fire Chief \(ages 14–17\)\./,
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
  // the six simulators show the same row: the five mBot2 ones hand only their title to it, Fire Cadet its title and its robot
  const loaders: Array<[loader: string, title: string, robot: string | null]> = [
    ['fire-rescue-junior/FireRescueJuniorLoader.tsx', 'Fire Rescue Junior', null],
    ['fire-rescue/FireRescueLoader.tsx', 'Fire Rescue Senior', null],
    ['fire-chief/FireChiefLoader.tsx', 'Fire Chief', null],
    ['warehouse-sort/WarehouseSortLoader.tsx', 'Warehouse Sort', null],
    ['locker-room/LockerRoomLoader.tsx', 'Locker Room', null],
    ['fire-cadet/FireCadetLoader.tsx', 'Fire Cadet', 'mTiny'],
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
      'Capelli Starter — Locker Room and Warehouse Sort (Season 2026), Fire Cadet, Fire Rescue Junior, Fire Rescue Senior and Fire Chief (Season 2027). ' +
      'Works in the browser, no robot needed.',
  );
  // a simulator added later is named on the card too, in its season
  const missions: MissionSimulator[] = [
    ...missionSimulators,
    { name: 'Later Mission', season: 2027, label: 'Level', event: 'Local event', href: '/simulator/later', summary: 'Two sentences.' },
  ];
  assert.match(
    simulatorTrack(simulatorSeasons(seasons, missions)).summary,
    /: Capelli Starter — Locker Room and Warehouse Sort \(Season 2026\), Fire Cadet, Fire Rescue Junior, Fire Rescue Senior, Fire Chief and Later Mission \(Season 2027\)\. /,
  );
  // one season only: "Season", not "Seasons"
  const only2027 = simulatorTrack(simulatorSeasons(seasons.filter((season) => season.year !== 2026), []));
  assert.equal(only2027.ageRange, 'Season 2027');
  assert.match(only2027.summary, /: Fire Cadet, Fire Rescue Junior, Fire Rescue Senior and Fire Chief \(Season 2027\)\. /);
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

test('season page /season/2027: five categories with their ages, both Fire Rescue categories marked "Online simulator" - announced, not "ran"', async () => {
  const { default: SeasonPage } = (await import('../../app/season/[year]/page')) as {
    default: (props: { params: Promise<{ year: string }> }) => Promise<Parameters<typeof renderToStaticMarkup>[0]>;
  };
  const html = renderToStaticMarkup(await SeasonPage({ params: Promise.resolve({ year: '2027' }) }));
  const cards = [...html.matchAll(/<a[^>]*href="\/season\/2027\/([a-z-]+)"[^>]*>([^]*?)<\/a>/g)].map((match) => ({ slug: match[1], text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
  assert.deepEqual(cards.map((card) => card.slug), ['fire-cadet', 'fire-fighter', 'fire-rescue-junior', 'fire-rescue-senior', 'fire-chief']);
  const card = (slug: string): string => cards.find((c) => c.slug === slug)?.text ?? '';
  assert.match(card('fire-rescue-junior'), /^10–12 years mBot2 Online simulator Fire Rescue Junior Only the water buckets are drawn\./);
  assert.match(card('fire-rescue-senior'), /^13–15 years mBot2 Online simulator Fire Rescue Senior Everything is drawn/);
  assert.match(card('fire-fighter'), /^8–10 years mBot2 Fire Fighter/);
  assert.match(card('fire-chief'), /^14–17 years mBot2 Online simulator Fire Chief/);
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
