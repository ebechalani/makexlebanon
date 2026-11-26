/**
 * The page of Logistique intelligente (Robot en fête 2027) without a browser: what its screen
 * (./LogistiqueSimulator.tsx) hands the general screen - the French word table, text={FR_TEXT},
 * this game, Tri d’entrepôt's robot, its French words, rules and panel « Le terrain », one setup
 * (`fixedSetup`), no Restart button, room for a three-digit score (`scoreDigits`) - the whole
 * screen drawn to HTML as the page draws it, in French; its loader (./LogistiqueLoader.tsx), whose
 * loading screen is already French and names « Proposé par Eddy Bachaalany »; the page's address,
 * title and description; and that the score box of the other pages did not change for it.
 *
 * (The words, the rules and the panel themselves are tested in ./words.test.ts and
 * ./rules.test.ts; the French table of the screen in ../text/text.test.ts; the site's parts - the
 * entry, the Simulator page, the menu and the sitemap - in ../site-section.test.ts.)
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { standaloneCategories } from '../../../../content/standalone';
import { TABLE_MARGIN } from '../../core/engine';
import { LOGISTIQUE_ID, MATCH_DURATION, MAX_SCORE, logistiqueGame } from '../../logistique-intelligente/game';
import { LOGISTIQUE_ROBOT, START_POSE } from '../../logistique-intelligente/robot';
import { WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import { ControlBar, type ControlBarProps } from '../ControlBar';
import { EXAMPLES_GAMES } from '../member-unlock';
import { ScreenTextContext } from '../text/context';
import { FR_TEXT } from '../text/fr';
import { FR_TITLE_TEXT } from '../text/fr-title';
import { PoweredByContext, TitleTextContext } from '../text/title-context';
import { TitleBar } from '../TitleBar';
import { LOGISTIQUE_TITLE } from './title';
import { LOGISTIQUE_WORDS } from './words';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(path.join(HERE, file), 'utf8');
const NB = ' ';
const nothing = (): void => undefined;

/** The props of the one <SimulatorApp> element of a screen file, as written: name -> the text of its value ('' for a bare prop). */
function simulatorAppProps(file: string): Map<string, string> {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<Map<string, string>> = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'SimulatorApp') {
      const props = new Map<string, string>();
      for (const attribute of node.attributes.properties) {
        assert.ok(ts.isJsxAttribute(attribute), `${file}: no spread props`);
        props.set(attribute.name.getText(source), attribute.initializer ? attribute.initializer.getText(source) : '');
      }
      found.push(props);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(found.length, 1, `${file}: one <SimulatorApp>`);
  return found[0];
}

/** The code of a file without its comments (a comment may name anything). */
const code = (text: string): string => text.replace(/\/\*[^]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** What a reader sees: the tags taken out, quotation marks back as typed (the no-break spaces kept: \s would take them too). */
const seen = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/^ | $/g, '');

/** The general screen and the screens built on it bring their stylesheet along (a .css import): Node has nothing to do with it. */
function withoutStylesheets(): NodeJS.Require {
  const require = createRequire(import.meta.url);
  require.extensions['.css'] = (module) => {
    module.exports = {};
  };
  return require;
}

/** The screen, drawn as the page draws it: under the name the page hands over (content/standalone.ts). (import(), once the stylesheets are said.) */
async function drawScreen(poweredBy: string | null): Promise<string> {
  withoutStylesheets();
  const screen = ((await import('./LogistiqueSimulator')) as { default: ComponentType }).default;
  return renderToStaticMarkup(createElement(PoweredByContext.Provider, { value: poweredBy }, createElement(screen)));
}

/** The category the page reads its credit from. */
function robotEnFete() {
  const category = standaloneCategories.find((entry) => entry.slug === 'robot-en-fete');
  assert.ok(category, 'content/standalone.ts has Robot en fête 2027');
  return category;
}

/** Words of the English screen that must not be on this one (a reader sees them; names such as "Score" or "Stop" are the same in both). */
const ENGLISH = ['Home', 'Simulator /', 'simulator ·', 'Powered by', 'Rules', 'Examples', 'Open', 'Save', 'Undo', 'Redo', 'Start', 'Finished', 'Reset', 'Speed', 'Ready', 'Drag the robot', 'Enlarge', 'Sensors', 'Trail', 'Ruler', 'Score sheet', 'The field', 'one setup', 'Test on many', 'Restart', 'Loading', 'Getting the mat'];

// =============================================================================================
// The screen
// =============================================================================================

test('screen: the French screen hands the general screen the French word table, this game, Tri d’entrepôt’s robot, the table strip, one setup, no Restart and room for three digits', () => {
  const props = simulatorAppProps('./LogistiqueSimulator.tsx');
  assert.deepEqual(Object.fromEntries(props), {
    text: '{FR_TEXT}',
    game: '{logistiqueGame}',
    robotConfig: '{LOGISTIQUE_ROBOT}',
    title: '{LOGISTIQUE_TITLE}',
    titleWrapsOnPhone: '',
    stageMargin: '{TABLE_MARGIN}',
    startZoneName: '{LOGISTIQUE_START_ZONE}',
    examples: '{EXAMPLES}',
    rules: '{LOGISTIQUE_RULES}',
    rulesNote: '{LOGISTIQUE_RULES_NOTE}',
    rulesExtra: '{LOGISTIQUE_ASSUMPTIONS}',
    words: '{LOGISTIQUE_WORDS}',
    initialStartPose: '{START_POSE}',
    showLastPrint: '',
    restartButton: '{false}',
    fixedSetup: '',
    scoreDigits: '{3}',
    renderCombinationEditor: '{renderCombinationEditor}',
  });
  // one setup and no restart, as Fire Fighter's screen passes them; nothing for « Tester sur plusieurs dispositions »
  const fighter = simulatorAppProps('../fire-fighter/FireFighterSimulator.tsx');
  for (const same of ['fixedSetup', 'restartButton', 'renderCombinationEditor', 'stageMargin', 'examples']) assert.equal(props.get(same), fighter.get(same), same);
  const page = code(read('./LogistiqueSimulator.tsx'));
  assert.match(read('./LogistiqueSimulator.tsx'), /^'use client';/);
  assert.match(page, /function renderCombinationEditor\(\): ReactNode \{\s+return <SetupList \/>;\s+\}/);
  // the examples: the one address, and the name of this game - nothing else about them; the server knows the game
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'logistique-intelligente',\s+organisation: 'MakeX Lebanon',/);
  assert.ok((EXAMPLES_GAMES as readonly string[]).includes(LOGISTIQUE_ID));
  assert.doesNotMatch(page, /from '[^']*(?:sample-catalog|samples)'|import\('[^']*(?:sample-catalog|samples)'/);
  assert.deepEqual([...page.matchAll(/from '([^']+)'/g)].map((match) => match[1]).filter((target) => target.includes('logistique-intelligente/')), ['../../logistique-intelligente/game', '../../logistique-intelligente/robot']);
  // the game: its own id (its saved work, its program files), its robot (Tri d’entrepôt's, the same object), its start pose
  assert.equal(logistiqueGame.id, 'logistique-intelligente');
  assert.equal(logistiqueGame.robotConfig, LOGISTIQUE_ROBOT);
  assert.equal(LOGISTIQUE_ROBOT, WAREHOUSE_SORT_ROBOT);
  assert.deepEqual(START_POSE, logistiqueGame.defaultStartPose);
  assert.equal(TABLE_MARGIN, 100);
  // no Restart button: the rules allow none (p. 15/11), and the game allows none either
  assert.deepEqual(logistiqueGame.restartRules, { maxRestarts: 0 });
  // three digits: the most a match gives
  assert.equal(MAX_SCORE, 500);
  assert.equal(String(MAX_SCORE).length, 3);
  // its name: the name of its mission (the organiser), the same on the loading screen
  assert.equal(LOGISTIQUE_TITLE, 'Logistique intelligente');
  assert.match(logistiqueGame.title, new RegExp(`Inspire${NB}: Logistique intelligente \\(Robot en fête 2027\\)$`));
});

test('the screen drawn as the page draws it: French everywhere, « Proposé par Eddy Bachaalany », one setup, no Relance, 0 / 500 and 2:30', async () => {
  const html = await drawScreen(robotEnFete().poweredBy);
  const text = seen(html);
  // the frame says it is French
  assert.match(html, /^<div class="[^"]*" lang="fr">/);
  // the title row: Accueil / Simulateur, « Simulateur Logistique intelligente · mBot2 », the credit of the category
  assert.match(html, /<h1 class="[^"]*">Simulateur Logistique intelligente <span class="[^"]*">· mBot2<\/span><\/h1>/);
  assert.ok(text.startsWith('Accueil / Simulateur / Simulateur Logistique intelligente · mBot2 Proposé par Eddy Bachaalany Règles '), text.slice(0, 160));
  assert.equal(html.split('Proposé par <span class="font-semibold text-white/85">Eddy Bachaalany</span>').length - 1, 2);
  assert.ok(!html.includes('RoboHolic'));
  // no « Tester sur plusieurs … », not even its short form; no « Relance »
  assert.ok(!html.includes('Tester sur plusieurs'), 'no « Tester sur plusieurs dispositions »');
  assert.ok(!/>Tester</.test(html));
  assert.ok(!html.includes(LOGISTIQUE_WORDS.batchHint));
  assert.ok(!/Relance/.test(html), 'no Relance button');
  // the panel « Le terrain »: « une seule disposition » beside it, the list - no code, no Random, no Default, no code field
  assert.match(html, /<span class="shrink-0">Le terrain<\/span><span class="ml-auto min-w-0 truncate text-xs font-medium text-ink-500">une seule disposition<\/span>/);
  assert.ok(html.includes('data-setup-list'));
  assert.ok(text.includes(`Cubes 1 à 5 (dessous)${NB}: 1 sur le carré du haut, 2 à gauche, 3 au centre, 4 à droite, 5 sur le carré du bas.`), text);
  for (const gone of ['CROIX', 'combination-code', LOGISTIQUE_WORDS.randomLabel, LOGISTIQUE_WORDS.defaultLabel, LOGISTIQUE_WORDS.randomHint, LOGISTIQUE_WORDS.defaultHint]) assert.ok(!html.includes(gone), gone);
  // the match controls: 2:30, 0 / 500, Démarrer, Terminé, Replacer - and the score's number three digits wide from the start
  assert.equal(MATCH_DURATION, 150);
  assert.ok(text.includes('Démarrer Stop Temps 2:30 Score 0 / 500 Terminé Replacer'), text);
  assert.match(html, /<span class="font-mono text-xl font-bold tabular-nums text-ink-900 @\[34rem\]:text-2xl" style="min-width:3ch">0<\/span><span class="text-xs font-medium text-ink-500">\/ 500<\/span>/);
  // the status line before the start, the closed Score sheet, the Zones button: the words of this game
  assert.ok(text.includes(`Prêt. Fais glisser le robot dans la zone de départ${NB}; tourne-le avec les boutons en dessous du tapis.`), text);
  assert.ok(text.includes(`Feuille de score 0 / 500 points · cubes${NB}: 0/10`), text);
  assert.ok(html.includes(`title="${LOGISTIQUE_WORDS.zonesHint}"`));
  assert.ok(/>\s*Exemples\s*</.test(html), 'the Examples button (what it opens, the server says)');
  // no English word a reader sees
  for (const word of ENGLISH) assert.ok(!text.includes(word), `${word}: ${text}`);
  // ... nor one they hear or read in a hint
  const hints = [...html.matchAll(/(?:title|aria-label|placeholder)="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(hints.length > 30, `${hints.length} hints`);
  for (const hint of hints) for (const word of [' the ', ' and ', 'Start ', 'Reset', 'Restart', 'Powered', 'Breadcrumb', 'Simulator']) assert.ok(!hint.includes(word), `${word}: ${hint}`);
});

test('the match controls: with scoreDigits the score\'s number is always three digits wide; left out, the bar is exactly as it was', () => {
  const bar = (props: Partial<ControlBarProps>, total = 0) =>
    renderToStaticMarkup(
      createElement(
        ScreenTextContext.Provider,
        { value: FR_TEXT },
        createElement(ControlBar, {
          runState: 'running',
          canStart: true,
          timeLeft: 100,
          score: { lines: [], total, max: MAX_SCORE, complete: false },
          restartPenalty: logistiqueGame.restartPenalty,
          restartRules: logistiqueGame.restartRules,
          restartsLeft: 0,
          restartButton: false,
          speed: 1,
          onSpeed: nothing,
          onStart: nothing,
          onStop: nothing,
          onPause: nothing,
          onResume: nothing,
          onRestart: nothing,
          onFinished: nothing,
          onReset: nothing,
          ...props,
        }),
      ),
    );
  const number = (total: number) => `<span class="font-mono text-xl font-bold tabular-nums text-ink-900 @[34rem]:text-2xl">${total}</span>`;
  const wide = (total: number) => `<span class="font-mono text-xl font-bold tabular-nums text-ink-900 @[34rem]:text-2xl" style="min-width:3ch">${total}</span>`;
  for (const total of [0, 50, 100, 500]) {
    const plain = bar({}, total);
    assert.ok(plain.includes(number(total)), plain);
    assert.ok(!plain.includes('style='), 'no style at all in the bar of the other games');
    // with three digits: that one span gets the width, and nothing else of the bar changes
    const three = bar({ scoreDigits: 3 }, total);
    assert.equal(three, plain.replace(number(total), wide(total)));
    assert.equal(three.split('style=').length - 1, 1);
    // undefined is the same as left out
    assert.equal(bar({ scoreDigits: undefined }, total), plain);
  }
  // ... the span the French stylesheet's two digits name: the first piece of the last part of the box after the clock
  // (an inline width wins over it; its text-align: right stays: ../robot-en-fete/screen.test.ts pins that rule)
  assert.match(bar({ scoreDigits: 3 }, 500), /role="timer"[^]*?<\/div><div class="[^"]*" aria-label="[^"]*"><span[^>]*>Score<\/span><span class="flex items-baseline gap-1"><span class="[^"]*" style="min-width:3ch">500<\/span><span[^>]*>\/ 500<\/span><\/span><\/div>/);
  // the general screen hands it on, and only this screen passes it
  const app = code(read('../SimulatorApp.tsx'));
  assert.match(app, /\sscoreDigits\?: 3;/);
  assert.match(app, /<ControlBar\b[^>]*\sscoreDigits=\{props\.scoreDigits\}\s/);
  assert.equal(app.split('scoreDigits').length - 1, 3, 'the prop, and handing it on (scoreDigits={props.scoreDigits}): nowhere else');
  assert.match(code(read('../ControlBar.tsx')), /style=\{props\.scoreDigits \? \{ minWidth: `\$\{props\.scoreDigits\}ch` \} : undefined\}/);
  const screens = readdirSync(path.join(HERE, '..'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readdirSync(path.join(HERE, '..', entry.name)).filter((name) => /Simulator\.tsx$/.test(name)).map((name) => `../${entry.name}/${name}`));
  assert.ok(screens.length >= 9, screens.join(', '));
  assert.deepEqual(
    screens.filter((file) => read(file).includes('scoreDigits')),
    ['../logistique-intelligente/LogistiqueSimulator.tsx'],
  );
  // (no stylesheet rule for it: the box of Tri d'entrepôt keeps its two digits)
  assert.ok(!read('../simulator.css').includes('3ch'));
});

// =============================================================================================
// The page and its loader
// =============================================================================================

test('page: its address and its French title and description; the loader shows the French title row and message, in lang="fr", while the screen loads', async () => {
  const { metadata } = (await import('../../../app/simulator/logistique-intelligente/page')) as {
    metadata: { title?: string; description?: string; alternates?: { canonical?: string }; openGraph?: { url?: string; locale?: string; title?: string; description?: string } };
  };
  assert.equal(metadata.title, 'Simulateur mBot2 — Logistique intelligente (Robot en fête 2027)');
  assert.equal(metadata.alternates?.canonical, '/simulator/logistique-intelligente');
  assert.deepEqual([metadata.openGraph?.url, metadata.openGraph?.locale, metadata.openGraph?.title, metadata.openGraph?.description], ['/simulator/logistique-intelligente', 'fr_LB', metadata.title, metadata.description]);
  assert.equal(
    metadata.description,
    'Construis un programme avec des blocs comme dans mBlock et regarde un mBot2 de Makeblock ranger dix cubes jaunes dans les entrepôts du tapis ' +
      `MakeX Inspire «${NB}Smart Logistics${NB}»${NB}: deux cubes au plus par entrepôt, le deuxième posé sur le premier — avec le score de la mission normale ` +
      `des règles MakeX Inspire 2024${NB}: 500 points au plus. Gratuit, dans le navigateur.`,
  );
  assert.ok(!/ [:;!?»%]|« /.test(metadata.description ?? ''), 'a no-break space before : ; ! ? » % and after «');
  const source = code(read('../../../app/simulator/logistique-intelligente/page.tsx'));
  assert.ok(!source.includes('hreflang') && !source.includes('languages:'), 'no English twin to link');
  // the loader: the French words of the title row above the loading screen (not the whole table), lang="fr" on its frame, the title row of this page
  const loader = code(read('./LogistiqueLoader.tsx'));
  assert.match(read('./LogistiqueLoader.tsx'), /^'use client';/);
  assert.match(loader, /<TitleTextContext\.Provider value=\{FR_TITLE_TEXT\}>\s*<div className=\{PAGE_FRAME\} lang="fr">/);
  for (const word of ['FR_TEXT', 'ScreenTextContext', "'../text/fr'", "'../text/context'"]) assert.ok(!loader.includes(word), word);
  assert.equal([...loader.matchAll(/<TitleBar\b[^>]*>/g)].length, 1, 'one title row');
  assert.match(loader, /<TitleBar title=\{LOGISTIQUE_TITLE\} wrapOnPhone \/>/);
  assert.ok(loader.includes('>Préparation du tapis et du robot…<'));
  assert.match(loader, /dynamic\(\(\) => import\('\.\/LogistiqueSimulator'\), \{\s+ssr: false,/);
  // the loading screen as the server sends it: French, the title row of this page
  const { LogistiqueLoader } = withoutStylesheets()('./LogistiqueLoader') as { LogistiqueLoader: ComponentType<{ poweredBy: string }> };
  const loading = renderToStaticMarkup(createElement(LogistiqueLoader, { poweredBy: robotEnFete().poweredBy }));
  assert.match(loading, /^<div class="[^"]*" lang="fr">/);
  assert.deepEqual(
    [...loading.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => [match[1], match[2]]),
    [
      ['/', 'Accueil'],
      ['/simulator', 'Simulateur'],
    ],
  );
  assert.match(loading, /<nav aria-label="Fil d’Ariane"/);
  assert.match(loading, /<h1[^>]*>Simulateur Logistique intelligente <span[^>]*>· mBot2<\/span><\/h1>/);
  assert.ok(seen(loading).endsWith('Préparation du tapis et du robot…'), seen(loading));
  for (const word of ENGLISH) assert.ok(!seen(loading).includes(word), word);
});

test('the title row of Logistique intelligente says « Proposé par Eddy Bachaalany » - while it loads and on the screen - from the entry of Robot en fête 2027', async () => {
  // the page hands the loader the name of content/standalone.ts; the loader sets it above the loading screen and the screen
  const page = code(read('../../../app/simulator/logistique-intelligente/page.tsx'));
  assert.match(page, /standaloneCategories\.find\(\(entry\) => entry\.slug === 'robot-en-fete'\)/);
  assert.match(page, /if \(!category\) throw new Error\(/);
  assert.match(page, /return <LogistiqueLoader poweredBy=\{category\.poweredBy\} \/>;/);
  const loader = code(read('./LogistiqueLoader.tsx'));
  assert.match(loader, /<PoweredByContext\.Provider value=\{poweredBy\}>\s*<LogistiqueSimulator \/>\s*<\/PoweredByContext\.Provider>/);
  assert.equal(robotEnFete().poweredBy, 'Eddy Bachaalany');
  const { LogistiqueLoader } = withoutStylesheets()('./LogistiqueLoader') as { LogistiqueLoader: ComponentType<{ poweredBy: string }> };
  const credit = 'Proposé par <span class="font-semibold text-white/85">Eddy Bachaalany</span>';
  // (twice: under the title on a computer, on a line of its own on a phone)
  for (const html of [renderToStaticMarkup(createElement(LogistiqueLoader, { poweredBy: 'Eddy Bachaalany' })), await drawScreen('Eddy Bachaalany')]) {
    assert.equal(html.split(credit).length - 1, 2, html.slice(0, 600));
    assert.ok(!html.includes('RoboHolic'));
  }
  // nobody set: the academy, as on every season simulator (the title row's own default)
  const row = renderToStaticMarkup(createElement(TitleTextContext.Provider, { value: FR_TITLE_TEXT }, createElement(TitleBar, { title: LOGISTIQUE_TITLE, wrapOnPhone: true })));
  assert.ok(row.includes('Proposé par <span class="font-semibold text-white/85">RoboHolic Robotics Academy</span>'));
});

test('the English pages are as they were: no English screen, loader or page names Logistique intelligente or passes its new prop', () => {
  const folders = readdirSync(path.join(HERE, '..'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && !['text', 'robot-en-fete', 'logistique-intelligente'].includes(entry.name));
  const files = folders.flatMap((entry) => readdirSync(path.join(HERE, '..', entry.name)).filter((name) => /(Loader|Simulator)\.tsx$/.test(name)).map((name) => `../${entry.name}/${name}`));
  assert.ok(files.length >= 14, files.join(', '));
  for (const file of [...files, '../../../app/simulator/warehouse-sort/page.tsx', '../../../app/simulator/fire-fighter/page.tsx']) {
    const source = code(read(file));
    for (const word of ['logistique', 'Logistique', 'LOGISTIQUE', 'scoreDigits', 'FR_TEXT', 'lang="fr"']) assert.ok(!source.includes(word), `${file}: ${word}`);
  }
  // ... and Tri d'entrepôt's screen keeps the stylesheet's two digits
  assert.ok(!read('../robot-en-fete/RobotEnFeteSimulator.tsx').includes('scoreDigits'));
});
