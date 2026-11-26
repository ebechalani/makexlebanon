/**
 * The page of Tri d’entrepôt (Robot en fête 2027) without a browser: what its screen
 * (./RobotEnFeteSimulator.tsx) hands the general screen - Warehouse Sort's props, with the French
 * game, words, rules, panel, code reader and test lists, and the French word table, text={FR_TEXT} -
 * and its loader (./RobotEnFeteLoader.tsx), whose loading screen is already French (with the French
 * words of the title row only). And that the English Warehouse Sort page did not change for it.
 *
 * (The words, the rules, the panel and the test lists themselves are tested in ./words.test.ts and
 * ./rules.test.ts; the French table of the screen in ../text/text.test.ts; the site's parts - the
 * entry, its page, the Simulator page, the menu and the sitemap - in ../site-section.test.ts.)
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { robotEnFeteGame } from '../../robot-en-fete/game';
import { warehouseSortGame } from '../../warehouse-sort/game';
import { START_POSE } from '../../warehouse-sort/robot';
import { EXAMPLES_GAMES } from '../member-unlock';
import { FR_TITLE_TEXT } from '../text/fr-title';
import { TitleTextContext } from '../text/title-context';
import { TitleBar } from '../TitleBar';
import { TRI_ENTREPOT_TITLE } from './title';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(path.join(HERE, file), 'utf8');

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

test('screen: the French screen hands the general screen every prop Warehouse Sort\'s hands it, and the French word table - with the French game, words, rules, panel, code reader and test lists', () => {
  const french = simulatorAppProps('./RobotEnFeteSimulator.tsx');
  const english = simulatorAppProps('../warehouse-sort/WarehouseSortSimulator.tsx');
  // the same props, and one more: the word table of the language
  assert.deepEqual([...french.keys()].filter((name) => name !== 'text').sort(), [...english.keys()].sort());
  assert.equal(french.get('text'), '{FR_TEXT}');
  assert.ok(!english.has('text') && !english.has('locale'), 'the English page sets no language');
  // the robot, the table, the start pose and how the screen is laid out: Warehouse Sort's own
  for (const same of ['robotConfig', 'stageMargin', 'initialStartPose', 'showLastPrint', 'titleWrapsOnPhone', 'batchRandomLists', 'renderCombinationEditor', 'examples']) {
    assert.equal(french.get(same), english.get(same), same);
  }
  // the game, the title and every word list: the French ones
  assert.deepEqual(Object.fromEntries([...french].filter(([name]) => !['robotConfig', 'stageMargin', 'initialStartPose', 'showLastPrint', 'titleWrapsOnPhone', 'batchRandomLists', 'renderCombinationEditor', 'examples', 'text'].includes(name))), {
    game: '{robotEnFeteGame}',
    title: '{TRI_ENTREPOT_TITLE}',
    startZoneName: '{ROBOT_EN_FETE_START_ZONE}',
    rules: '{ROBOT_EN_FETE_RULES}',
    rulesNote: '{ROBOT_EN_FETE_RULES_NOTE}',
    rulesExtra: '{ROBOT_EN_FETE_ASSUMPTIONS}',
    words: '{ROBOT_EN_FETE_WORDS}',
    readCode: '{readRobotEnFeteCode}',
    batchPresets: '{ROBOT_EN_FETE_BATCH_PRESETS}',
    batchTieBreak: '{ROBOT_EN_FETE_TIE_BREAK}',
    batchSummaryLabel: '{robotEnFeteSummaryLabel}',
    batchSummaryOrder: '{robotEnFeteSummaryOrder}',
  });
  const page = code(read('./RobotEnFeteSimulator.tsx'));
  // the Cube colours panel of Warehouse Sort, with its French words
  assert.match(page, /<ArrangementEditor scenario=\{scenario\} onChange=\{onChange\} words=\{FR_ARRANGEMENT_WORDS\} \/>/);
  // the examples: the one address, and the name of this game - nothing else about them; the server knows the game
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'robot-en-fete',\s+organisation: 'MakeX Lebanon',/);
  assert.ok((EXAMPLES_GAMES as readonly string[]).includes('robot-en-fete'));
  // the game is the French twin of Warehouse Sort's: its own id (its saved work, its program files), the same start pose
  assert.equal(robotEnFeteGame.id, 'robot-en-fete');
  assert.notEqual(robotEnFeteGame, warehouseSortGame);
  assert.deepEqual(START_POSE, robotEnFeteGame.defaultStartPose);
  assert.match(read('./RobotEnFeteSimulator.tsx'), /^'use client';/);
  // its name: the name of its mission, « Tri d’entrepôt » (the organiser), the same on the loading screen
  assert.equal(TRI_ENTREPOT_TITLE, 'Tri d’entrepôt');
  assert.match(robotEnFeteGame.title, /: Tri d’entrepôt \(Robot en fête 2027\)$/);
});

test('page: its address and its French title and description; the loader shows the French title row and message, in lang="fr", while the screen loads', async () => {
  const { metadata } = (await import('../../../app/simulator/tri-entrepot/page')) as {
    metadata: { title?: string; description?: string; alternates?: { canonical?: string }; openGraph?: { url?: string; locale?: string; title?: string } };
  };
  assert.equal(metadata.title, 'Simulateur mBot2 — Tri d’entrepôt (Robot en fête 2027)');
  assert.equal(metadata.alternates?.canonical, '/simulator/tri-entrepot');
  assert.deepEqual([metadata.openGraph?.url, metadata.openGraph?.locale, metadata.openGraph?.title], ['/simulator/tri-entrepot', 'fr_LB', metadata.title]);
  const description = metadata.description ?? '';
  assert.match(description, /^Construis un programme avec des blocs comme dans mBlock et regarde un mBot2 de Makeblock ranger des cubes rouges et verts /);
  assert.ok(description.includes(' — avec toutes les dispositions des cubes, et le score que donnent les règles de la mission pour débutants « Warehouse Sort ». '), description);
  assert.match(description, / Gratuit, dans le navigateur\. Tri d’entrepôt est la version française de Warehouse Sort\.$/);
  assert.ok(!/ [:;!?»]|« /.test(description), 'a no-break space before : ; ! ? » and after «');
  assert.match(read('../../../app/simulator/tri-entrepot/page.tsx'), /return <RobotEnFeteLoader \/>;/);
  // the loader: the French words of the title row above the loading screen (not the whole table:
  // every page fetches the loader ahead, through the menu), lang="fr" on its frame, the title row of this page
  const loader = code(read('./RobotEnFeteLoader.tsx'));
  assert.match(read('./RobotEnFeteLoader.tsx'), /^'use client';/);
  assert.match(loader, /<TitleTextContext\.Provider value=\{FR_TITLE_TEXT\}>\s*<div className=\{PAGE_FRAME\} lang="fr">/);
  for (const word of ['FR_TEXT', 'ScreenTextContext', "'../text/fr'", "'../text/context'"]) assert.ok(!loader.includes(word), word);
  assert.equal([...loader.matchAll(/<TitleBar\b[^>]*>/g)].length, 1, 'one title row');
  assert.match(loader, /<TitleBar title=\{TRI_ENTREPOT_TITLE\} wrapOnPhone \/>/);
  assert.ok(loader.includes('>Préparation du tapis et du robot…<'));
  assert.match(loader, /dynamic\(\(\) => import\('\.\/RobotEnFeteSimulator'\), \{\s+ssr: false,/);
  // ... which, with those words, is the screen's own title row in French: Accueil / Simulateur, "Simulateur Tri d’entrepôt · mBot2", "Proposé par"
  const row = renderToStaticMarkup(createElement(TitleTextContext.Provider, { value: FR_TITLE_TEXT }, createElement(TitleBar, { title: TRI_ENTREPOT_TITLE, wrapOnPhone: true })));
  assert.deepEqual(
    [...row.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => [match[1], match[2]]),
    [
      ['/', 'Accueil'],
      ['/simulator', 'Simulateur'],
    ],
  );
  assert.match(row, /<nav aria-label="Fil d’Ariane"/);
  assert.match(row, /<h1[^>]*>Simulateur Tri d’entrepôt <span[^>]*>· mBot2<\/span><\/h1>/);
  assert.ok(row.includes('Proposé par <span'));
  for (const word of ['Home', 'Breadcrumb', 'Powered by', ' simulator']) assert.ok(!row.includes(word), word);
});

test('the English page of Warehouse Sort is as it was: no language, no French table, nothing of Robot en fête', () => {
  for (const file of ['../warehouse-sort/WarehouseSortSimulator.tsx', '../warehouse-sort/WarehouseSortLoader.tsx', '../../../app/simulator/warehouse-sort/page.tsx']) {
    const source = code(read(file));
    for (const word of ['locale=', 'lang=', 'text=', 'FR_TEXT', 'FR_TITLE_TEXT', 'ScreenTextContext', 'TitleTextContext', 'robot-en-fete', 'RobotEnFete', 'ROBOT_EN_FETE', 'tri-entrepot', 'fr_LB']) assert.ok(!source.includes(word), `${file}: ${word}`);
  }
  // (the English page's share data keeps the site's own locale)
  assert.match(code(read('../../../app/simulator/warehouse-sort/page.tsx')), /\slocale: site\.locale,\s/);
  assert.match(code(read('../warehouse-sort/WarehouseSortLoader.tsx')), /<div className=\{PAGE_FRAME\}>\s*<TitleBar title="Warehouse Sort" wrapOnPhone \/>/);
});
