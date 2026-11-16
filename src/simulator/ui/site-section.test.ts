/**
 * The Simulator section of the website: the menu item, the one page /simulator with a part per
 * season, the pages of the games under /simulator/<game>, the title row above each game, the
 * old addresses under Training that send visitors on, the sitemap, and the Training page's card
 * that leads to the section.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  missionSimulators,
  seasons,
  simulatorSeasons,
  simulatorTrack,
  trainingTracks,
  type MissionSimulator,
  type Season,
} from '../../../content/seasons';
import { nav, site } from '../../../content/site';
import { TitleBar } from './TitleBar';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fromRoot = (file: string): string => path.join(REPO_ROOT, file);

/** The old address of the list and of the three games, under Training. */
const OLD = '/training/simulator';

/** Every simulator in content/seasons.ts: of a category, or of a mission. */
const SIMULATOR_HREFS = [
  ...seasons.flatMap((season) => season.categories.flatMap((category) => (category.simulator ? [category.simulator] : []))),
  ...missionSimulators,
].map((simulator) => ({ href: simulator.href, mat: simulator.mat }));

test('menu: "Simulator" is a plain link to /simulator, between Training and Videos; Training no longer lists the simulators', () => {
  const labels = nav.map((item) => item.label);
  assert.deepEqual(labels, ['Home', 'Seasons', 'Competitions', 'Gallery', 'Training', 'Simulator', 'Videos', 'Contact']);
  const simulator = nav.find((item) => item.label === 'Simulator');
  assert.equal(simulator?.href, '/simulator');
  assert.equal(simulator?.children, undefined, 'no dropdown, like Gallery');
  const training = nav.find((item) => item.label === 'Training');
  assert.deepEqual(
    training?.children?.map((child) => child.href),
    ['/training', '/workshops', '/kits'],
  );
  // (no line of the menu leads to a simulator but "Simulator" itself)
  for (const item of nav) {
    for (const link of [item, ...(item.children ?? [])]) {
      if (link !== simulator) assert.ok(!link.href.startsWith('/simulator') && !/simulator/i.test(link.label), link.label);
    }
  }
});

test('pages: every simulator is /simulator/<game>, with its page folder, its address in the page, and its mat picture in public/simulator/<game>/', async () => {
  assert.deepEqual(
    SIMULATOR_HREFS.map((simulator) => simulator.href).sort(),
    ['/simulator/fire-chief', '/simulator/fire-rescue', '/simulator/warehouse-sort'],
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
    // the picture keeps its address next to the page: a file in public/simulator/<game>/, and no file where the page is
    assert.equal(mat, `/simulator/${game}/mat.webp`);
    assert.ok(statSync(fromRoot(`public${mat}`)).isFile(), mat);
    assert.ok(statSync(fromRoot(`public/simulator/${game}`)).isDirectory(), `public/simulator/${game} is a folder, not a file that would hide the page`);
  }
  // one page and the pages of the games, nothing else: no page per season
  const folders = readdirSync(fromRoot('src/app/simulator'), { withFileTypes: true });
  assert.deepEqual(
    folders.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name)).sort(),
    ['fire-chief/', 'fire-rescue/', 'page.tsx', 'warehouse-sort/'],
  );
  assert.ok(!existsSync(fromRoot('src/app/training/simulator')), 'the old folder is gone');
});

test('Simulator page: Season 2026 (Warehouse Sort), then Season 2027 (Fire Rescue, Fire Chief)', () => {
  assert.deepEqual(
    simulatorSeasons().map((section) => [section.year, section.simulators.map((simulator) => simulator.name)]),
    [
      [2026, ['Warehouse Sort']],
      [2027, ['Fire Rescue', 'Fire Chief']],
    ],
  );
  const [season2026, season2027] = simulatorSeasons();
  assert.deepEqual(season2026.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/warehouse-sort', ['MakeX Inspire · Beginner', 'Local event'], undefined],
  ]);
  assert.deepEqual(season2027.simulators.map((card) => [card.href, card.labels, card.about]), [
    ['/simulator/fire-rescue', ['11–13 years', 'Season 2027'], '/season/2027/fire-rescue'],
    ['/simulator/fire-chief', ['14–17 years', 'Season 2027'], '/season/2027/fire-chief'],
  ]);
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
      [2026, ['/simulator/warehouse-sort']],
      [2027, ['/simulator/fire-rescue', '/simulator/fire-chief', '/simulator/later']],
    ],
  );
  // no simulator at all: no part at all
  assert.deepEqual(simulatorSeasons(seasons.map((season) => ({ ...season, categories: season.categories.map(({ simulator: _, ...category }) => category) })), []), []);
});

test('Simulator page: each card is one link (picture, name, sentences) that names the simulator it opens; "About" is a link of its own', async () => {
  const { default: SimulatorPage, metadata } = (await import('../../app/simulator/page')) as {
    default: () => Parameters<typeof renderToStaticMarkup>[0];
    metadata: { alternates?: { canonical?: string }; openGraph?: { url?: string } };
  };
  assert.equal(metadata.alternates?.canonical, '/simulator');
  assert.equal(metadata.openGraph?.url, '/simulator');
  const html = renderToStaticMarkup(createElement(SimulatorPage));
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
  // the three games show the same row: they all hand only their title to it
  for (const [loader, title] of [
    ['fire-rescue/FireRescueLoader.tsx', 'Fire Rescue'],
    ['fire-chief/FireChiefLoader.tsx', 'Fire Chief'],
    ['warehouse-sort/WarehouseSortLoader.tsx', 'Warehouse Sort'],
  ]) {
    assert.match(readFileSync(fromRoot(`src/simulator/ui/${loader}`), 'utf8'), new RegExp(`<TitleBar title="${title}"`), loader);
  }
});

test('old addresses: exactly the four under Training, each a permanent redirect to its new address', async () => {
  // (the real configuration, loaded by its full address: next.config.mjs is outside the folders
  // whose imports the guard of the examples follows - src/, content/, scripts/ - see client-guard.test.ts)
  const { default: config } = (await import(pathToFileURL(fromRoot('next.config.mjs')).href)) as {
    default: { redirects: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>> };
  };
  const redirects = await config.redirects();
  assert.deepEqual(
    redirects.filter((redirect) => redirect.source.startsWith(OLD)),
    [
      { source: '/training/simulator', destination: '/simulator', permanent: true },
      { source: '/training/simulator/fire-rescue', destination: '/simulator/fire-rescue', permanent: true },
      { source: '/training/simulator/fire-chief', destination: '/simulator/fire-chief', permanent: true },
      { source: '/training/simulator/warehouse-sort', destination: '/simulator/warehouse-sort', permanent: true },
    ],
  );
  // (no other redirect touches the new section; the old ones of the website are still there)
  assert.ok(!redirects.some((redirect) => redirect.source.startsWith('/simulator')));
  assert.ok(redirects.some((redirect) => redirect.source === '/training-&-hints' && redirect.destination === '/training'));
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
  assert.equal(
    card?.summary,
    'Program the mBot2 with blocks and watch it play on the competition mat: Warehouse Sort (Season 2026), ' +
      'Fire Rescue and Fire Chief (Season 2027). Works in the browser, no robot needed.',
  );
  // a simulator added later is named on the card too, in its season
  const missions: MissionSimulator[] = [
    ...missionSimulators,
    { name: 'Later Mission', season: 2027, label: 'Level', event: 'Local event', href: '/simulator/later', summary: 'Two sentences.' },
  ];
  assert.match(simulatorTrack(simulatorSeasons(seasons, missions)).summary, /: Warehouse Sort \(Season 2026\), Fire Rescue, Fire Chief and Later Mission \(Season 2027\)\. /);
  // one season only: "Season", not "Seasons"
  const only2027 = simulatorTrack(simulatorSeasons(seasons, []));
  assert.equal(only2027.ageRange, 'Season 2027');
  assert.match(only2027.summary, /: Fire Rescue and Fire Chief \(Season 2027\)\. /);
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
