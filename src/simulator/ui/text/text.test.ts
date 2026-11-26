/**
 * The word tables of the shared screen (design 8.2 T4): ./en.tsx and ./fr.tsx.
 *
 *   - the English table IS today's screen: its text functions are the functions of the plain
 *     modules themselves, and the context gives it to every page that sets no table;
 *   - the French table has every key, nothing empty, nothing left in English - except the names
 *     and the texts this page never shows, each listed here with its reason;
 *   - French numbers and times have a decimal comma (and no "-0"); plurals take the first form
 *     for 0 and 1; French typography (a no-break space before : ; ! ? % », after «; « » quotes,
 *     ’ and …) holds for every French text, those built with values included;
 *   - every sentence the engine and the interpreter can log has its French pattern;
 *   - the cubes are E1 – E4 in French sentences, never W1 – W4;
 *   - a colour a sensor reads is shown as the program gets it, with its French: "red (rouge)".
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createSimulation } from '../../core/simulation';
import type { SensorColor, SimEvent } from '../../core/types';
import { allScenarios } from '../../warehouse-sort/scenario';
import { warehouseSortGame } from '../../warehouse-sort/game';
import { WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import { DEFAULT_ROBOT_CONFIG } from '../../core/robot';
import { gripper, program, script, whenStart } from '../../vm/builder';
import * as batchWords from '../batch-words';
import * as examplesWords from '../examples-words';
import * as format from '../format';
import * as matchWords from '../match-words';
import * as programFile from '../program-file';
import * as robotParts from '../robot-parts';
import * as ruler from '../ruler';
import * as scenarioCode from '../scenario-code';
import * as screenWords from '../screen-words';
import * as stageView from '../stage-view';
import * as startPose from '../start-pose';
import { ScreenTextContext, useScreenText } from './context';
import { EN_TEXT } from './en';
import { EN_TITLE_TEXT } from './en-title';
import { ScreenTextContext as TitleContext, TitleTextContext, useTitleText } from './title-context';
import { FR_TITLE_TEXT } from './fr-title';
import { TitleBar } from '../TitleBar';
import { FR_TEXT } from './fr';
import { FR_COLOUR_NAMES, frSensorValue } from './fr-common';
import { FR_CONSOLE_NOT_ON_THIS_PAGE, FR_CONSOLE_PATTERNS, frConsoleLine } from './fr-console';
import { FR_FILE_PROBLEMS } from './fr-stage';
import { frPlural } from './plural';
import type { MatchOver, ScreenText } from './types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NB = '\u00a0';

/** Members of the table: every key, the records' keys too ("probeHint.L2"). */
function keysOf(table: object, prefix = ''): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    value && typeof value === 'object' && !isValidElement(value) ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}
const at = (table: object, key: string): unknown => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], table);

/** The text a member gives (a ReactNode is drawn and its text taken). */
function plain(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  return renderToStaticMarkup(createElement('div', null, node))
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

// =============================================================================================
// What may be the same in both languages, and why
// =============================================================================================

/** Names and words that are the same in French (design 8.2 T4's list, as far as this table has them). */
const SAME_WORDS: Record<string, string> = {
  zones: 'Zones (the French word too)',
  consoleTitle: 'Console (the French word too)',
  consoleLabel: 'Console (the French word too)',
  pause: 'Pause (the French word too)',
  // (the French word too, as "Pause" beside it - and short: "Arrêter" broke the row of the match buttons at 1 440 px)
  stop: 'Stop (the French word too)',
  scoreWord: 'Score (the French word too)',
  scoreColumn: 'Score (the French word too)',
  total: 'Total (the French word too)',
  variablesTitle: 'Variables (the French word too)',
  joystick: 'Joystick (a name)',
  'logLevels.info': 'Info (the French word too)',
  'gripper.title': 'WP2 (./gripper.tsx)',
};

/** Members whose English is used on the French page because the page never shows them (design table fr-strings.json, "not shown"). */
const NOT_ON_THIS_PAGE: Record<string, string> = {
  seed: 'random lists only (Robot en fête: batchRandomLists={false})',
  anotherSeed: 'random lists only',
  randomListName: 'random lists only',
  randomCountHint: 'random lists only',
  kindOfRandom: 'random lists only',
  seedHint: 'random lists only',
  anotherSeedHint: 'random lists only',
  pointsTimeHint: 'Robot en fête shows its own column, "Dernière livraison" (batchTieBreak)',
  pointsTime: 'Robot en fête shows its own column (batchTieBreak)',
  colourSensor: "Fire Chief's front colour sensor (this robot has none)",
  frontColourHint: "Fire Chief's front colour sensor",
  colourRangeNote: "Fire Chief's front colour sensor",
  dcMotorLabel: "Fire Chief's fan port (this robot has none)",
  dcMotorHint: "Fire Chief's fan port",
  dcMotorUse: "Fire Chief's fan port",
  fan: "Fire Chief's fan (this robot has none)",
  fanHint: "Fire Chief's fan",
  fanState: "Fire Chief's fan",
  scenarioCountNote: 'Robot en fête gives its own last line (scenarioNote)',
  codeReaderOf: 'Robot en fête reads codes its own way (readCode)',
  // (no word in them)
  clock: 'whole seconds, no decimal: "1:24" in both languages',
  scoreTimeText: 'no word in it: the time as the game writes it, or a dash',
};

/** French texts that are English on purpose (a word of the English table that this page does not show, the names of other games). */
const ENGLISH_ON_PURPOSE = new Set([...Object.keys(NOT_ON_THIS_PAGE), ...Object.keys(SAME_WORDS)]);

// =============================================================================================
// The English table is today's screen
// =============================================================================================

test('English: the text functions of the table ARE the functions of the plain modules (the English screen runs the same code)', () => {
  const same: Array<[keyof ScreenText, unknown]> = [
    ['number', format.formatNumber],
    ['clock', format.formatClock],
    ['moment', format.formatStamp],
    ['refereeTime', format.formatRefereeTime],
    ['timeTextOf', format.timeTextOf],
    ['bodyName', format.bodyName],
    ['finishText', format.finishText],
    ['describeEvent', format.describeEvent],
    ['cyberPiSummary', format.cyberPiSummary],
    ['restartButton', matchWords.restartButton],
    ['restartSummary', matchWords.restartSummary],
    ['finishSentence', matchWords.finishSentence],
    ['finishHeadline', matchWords.finishHeadline],
    ['examplesIntro', examplesWords.examplesIntro],
    ['codeMessage', examplesWords.codeMessage],
    ['examplesWords', examplesWords.EXAMPLES_WORDS],
    ['endSentence', batchWords.endSentence],
    ['scoreTimeText', batchWords.scoreTimeText],
    ['scoreSheetSummary', screenWords.scoreSheetSummary],
    ['codeReaderOf', scenarioCode.codeReaderOf],
    ['cmText', ruler.cmText],
    ['turnText', ruler.turnText],
    ['rulerReading', ruler.rulerReading],
    ['rulerText', ruler.rulerText],
    ['rulerLabels', ruler.rulerLabels],
    ['sizeButtonHint', stageView.sizeButtonHint],
    ['readyHint', stageView.readyHint],
    ['homeButtonWords', startPose.homeButtonWords],
    ['dcMotorUse', robotParts.dcMotorUse],
    ['colourRangeText', robotParts.colourRangeText],
    ['colourRangeNote', robotParts.colourRangeNote],
    ['sensorSummary', robotParts.sensorSummary],
    ['sensorsViewHint', robotParts.sensorsViewHint],
    ['parseProgramFile', programFile.parseProgramFile],
    ['otherGameNote', programFile.otherGameNote],
    ['retiredBlocksNote', programFile.retiredBlocksNote],
  ];
  for (const [key, fn] of same) assert.equal(EN_TEXT[key], fn, key);
  // the English lines of the console are the engine's own
  assert.equal(EN_TEXT.consoleLine('The program stopped: x'), 'The program stopped: x');
  assert.equal(EN_TEXT.locale, 'en');
});

test('English: the context gives the English table where no page sets one, and the French one under the French provider', () => {
  const Probe = () => createElement('span', null, useScreenText().locale);
  assert.equal(renderToStaticMarkup(createElement(Probe)), '<span>en</span>');
  assert.equal(renderToStaticMarkup(createElement(ScreenTextContext.Provider, { value: FR_TEXT }, createElement(Probe))), '<span>fr</span>');
  const Table = () => createElement('span', null, useScreenText() === EN_TEXT ? 'EN_TEXT' : 'another');
  assert.equal(renderToStaticMarkup(createElement(Table)), '<span>EN_TEXT</span>');
  // the title row reads the same context, with its own English words to fall back on (one provider sets both)
  assert.equal(ScreenTextContext, TitleContext);
  const Title = () => createElement('span', null, useTitleText().homeCrumb);
  assert.equal(renderToStaticMarkup(createElement(Title)), '<span>Home</span>');
  assert.equal(renderToStaticMarkup(createElement(ScreenTextContext.Provider, { value: FR_TEXT }, createElement(Title))), '<span>Accueil</span>');
  for (const [key, value] of Object.entries(EN_TITLE_TEXT)) assert.equal(EN_TEXT[key as keyof ScreenText], value, key);
  // the first line of both context files is 'use client' (a page that is a Server Component reaches them through TitleBar.tsx)
  assert.match(readFileSync(path.join(HERE, 'context.tsx'), 'utf8'), /^'use client';\n/);
  assert.match(readFileSync(path.join(HERE, 'title-context.tsx'), 'utf8'), /^'use client';\n/);
});

test('English: the title row stays small - every loading screen and the Simulator page get it before anything else', () => {
  // (the whole table imports every text function, the block catalog with them: the title row imports none of it)
  const imports = (file: string) =>
    [...readFileSync(path.join(HERE, file), 'utf8').matchAll(/^import (?!type )[^;]*? from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports('../TitleBar.tsx'), ['next/link', './powered-by', './text/title-context']);
  assert.deepEqual(imports('../powered-by.ts'), []);
  assert.deepEqual(imports('title-context.tsx'), ['react', './en-title']);
  assert.deepEqual(imports('en-title.tsx'), []);
});

// =============================================================================================
// What each page downloads: no French on an English page, no screen on the French loading screen
// =============================================================================================

const SRC = path.resolve(HERE, '../../..');
const ROOT = path.resolve(SRC, '..');

/** The file an import names (a package: null). */
function resolveSource(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('@content/')) base = path.join(ROOT, 'content', spec.slice('@content/'.length));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const ending of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const file = base + ending;
    try {
      if (readdirSync(path.dirname(file)).includes(path.basename(file)) && /\.(ts|tsx)$/.test(file)) return file;
    } catch {
      // (no such folder)
    }
  }
  return null;
}

/** The files a file brings along for their code: its imports and re-exports that are not types only, and its import() when `dynamic`. */
function codeImports(file: string, dynamic: boolean): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      // (an import of types only is gone once the code is compiled)
      const onlyTypes = clause?.isTypeOnly || (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly));
      if (!onlyTypes) found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      found.push(node.moduleSpecifier.text);
    } else if (dynamic && ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.map((spec) => resolveSource(file, spec)).filter((target): target is string => target !== null);
}

/** Every file of the repository a file brings along, as paths from src/ (with import(): also what it loads later). */
function reachedFrom(entry: string, dynamic: boolean): Set<string> {
  const seen = new Set<string>();
  const queue = [path.join(ROOT, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    const name = path.relative(ROOT, file);
    if (seen.has(name)) continue;
    seen.add(name);
    queue.push(...codeImports(file, dynamic));
  }
  return seen;
}

/** The French tables: the screen's (fr.tsx and its parts) and the blocks' (../../blocks/fr.ts). */
const isFrench = (file: string): boolean => /^src\/simulator\/ui\/text\/fr[^/]*\.tsx$/.test(file) || file === 'src/simulator/blocks/fr.ts';

test('no English page downloads French: no English loader, screen or editor, nor the menu, reaches a French table (an import() included)', () => {
  const games = readdirSync(path.join(HERE, '..'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== 'text' && entry.name !== 'robot-en-fete');
  const entries = [
    ...games.flatMap((game) => readdirSync(path.join(HERE, '..', game.name)).filter((name) => /(Loader|Simulator)\.tsx$/.test(name)).map((name) => `src/simulator/ui/${game.name}/${name}`)),
    'src/simulator/ui/TitleBar.tsx',
    'src/simulator/ui/SimulatorApp.tsx',
    'src/simulator/ui/BlocklyEditor.tsx',
    'src/simulator/ui/GripperCodeDialog.tsx',
    'src/simulator/vm/builder.ts',
    'src/app/simulator/page.tsx',
    'src/app/simulator/warehouse-sort/page.tsx',
    'content/site.ts',
  ];
  // (every English game has its loader and its screen here: Warehouse Sort, Locker Room, Fire Rescue, Fire Chief, Fire Fighter, Fire Cadet ...)
  assert.ok(entries.filter((entry) => entry.endsWith('Loader.tsx')).length >= 7, entries.join(', '));
  for (const entry of entries) {
    const french = [...reachedFrom(entry, true)].filter(isFrench);
    assert.deepEqual(french, [], `${entry} brings along ${french.join(', ')}`);
  }
  // ... while the French screen does reach both tables (it hands the screen's to the general screen, which loads the blocks' words)
  const screen = reachedFrom('src/simulator/ui/robot-en-fete/RobotEnFeteSimulator.tsx', false);
  for (const table of ['src/simulator/ui/text/fr.tsx', 'src/simulator/blocks/fr.ts']) assert.ok(screen.has(table), table);
});

test('the French loading screen is small: the title row and its five French words, not the screen, not either word table, not the blocks - every page fetches it ahead, through the menu', () => {
  const loader = reachedFrom('src/simulator/ui/robot-en-fete/RobotEnFeteLoader.tsx', false);
  for (const heavy of ['src/simulator/ui/text/en.tsx', 'src/simulator/ui/text/fr.tsx', 'src/simulator/blocks/catalog.ts', 'src/simulator/blocks/fr.ts', 'src/simulator/ui/SimulatorApp.tsx']) {
    assert.ok(!loader.has(heavy), `the loader brings along ${heavy}`);
  }
  assert.ok(loader.has('src/simulator/ui/text/fr-title.tsx') && loader.has('src/simulator/ui/TitleBar.tsx'));
  // (the French words of the title row are those of the French table: one object)
  assert.equal(FR_TEXT.homeCrumb, FR_TITLE_TEXT.homeCrumb);
  assert.deepEqual(
    Object.keys(FR_TITLE_TEXT).map((key) => [key, FR_TEXT[key as keyof typeof FR_TITLE_TEXT] === FR_TITLE_TEXT[key as keyof typeof FR_TITLE_TEXT]]),
    Object.keys(FR_TITLE_TEXT).map((key) => [key, true]),
  );
  // the title row reads them from the title context, where no screen table is set
  const row = renderToStaticMarkup(createElement(TitleTextContext.Provider, { value: FR_TITLE_TEXT }, createElement(TitleBar, { title: 'Tri d’entrepôt' })));
  assert.ok(row.includes('>Accueil<') && row.includes('Simulateur Tri d’entrepôt ') && row.includes('Proposé par '), row);
  // ... and a screen table, where there is one, wins (the French screen sets both: the same words)
  const both = renderToStaticMarkup(
    createElement(ScreenTextContext.Provider, { value: EN_TEXT }, createElement(TitleTextContext.Provider, { value: FR_TITLE_TEXT }, createElement(TitleBar, { title: 'X' }))),
  );
  assert.ok(both.includes('>Home<'), both);
});

test('English: the sentences moved into the table are the ones the screen always said', () => {
  assert.equal(EN_TEXT.testOnMany('arrangements'), 'Test on many arrangements');
  assert.equal(plain(EN_TEXT.simulatorTitle('Warehouse Sort')), 'Warehouse Sort simulator ');
  assert.equal(EN_TEXT.speedLabel(0.5), '0.5×');
  assert.equal(EN_TEXT.clockLabel('match', '1:30'), 'Match clock: 1:30 left');
  assert.equal(EN_TEXT.resetHint('Put it back.', 'attempt'), 'Put it back. Works at any moment, also during an attempt.');
  assert.equal(EN_TEXT.blockCount(1), '1 block · saved automatically');
  assert.equal(EN_TEXT.startLine(undefined, 'X'), 'Start! Combination X.');
  assert.equal(EN_TEXT.percent(0.505), '51%');
  assert.equal(EN_TEXT.averageScore(37.5), '37.5');
  assert.equal(plain(EN_TEXT.statusRunning('Match', 3, 9, 'goals', null)), 'Match running. 3 of 9 goals complete.');
  assert.equal(plain(EN_TEXT.emptyWorkspace(true)), 'Build your program here. Click a group on the left (try mBot2 Chassis), drag a block out and snap it under the yellow block. Then press Start. Or open one of the Examples to see how it is done.');
});

// =============================================================================================
// The French table: every key, nothing left in English
// =============================================================================================

test('French: the table has every key of the English one (and no other), and no French text is empty', () => {
  assert.deepEqual(keysOf(FR_TEXT).sort(), keysOf(EN_TEXT).sort());
  for (const key of keysOf(FR_TEXT)) {
    const value = at(FR_TEXT, key);
    assert.notEqual(value, undefined, key);
    // (but the second word of the reset button: "Replacer" is the whole command, there is nothing to add on a wide bar)
    if (typeof value === 'string' && key !== 'resetFieldWord') assert.notEqual(value.trim(), '', key);
  }
  assert.equal(FR_TEXT.resetFieldWord, '');
  assert.equal(FR_TEXT.locale, 'fr');
});

test('French: no text and no text function is the English one, but the names and what this page never shows (each with its reason)', () => {
  for (const key of keysOf(FR_TEXT)) {
    if (key === 'locale') continue;
    const fr = at(FR_TEXT, key);
    const en = at(EN_TEXT, key);
    if (ENGLISH_ON_PURPOSE.has(key)) continue;
    assert.notEqual(fr, en, `${key} is still the English one`);
  }
  // (the lists name only members of the table)
  for (const key of ENGLISH_ON_PURPOSE) assert.ok(keysOf(EN_TEXT).includes(key) || keysOf(EN_TEXT).some((k) => k.startsWith(`${key}.`)), key);
});

// =============================================================================================
// Numbers, times, plurals
// =============================================================================================

test('French numbers and times: the English digits with a decimal comma, no "-0", tenths cut off for the referee', () => {
  assert.equal(FR_TEXT.number(18.94, 1), '18,9');
  assert.equal(FR_TEXT.number(-0.04, 1), '0,0');
  assert.equal(FR_TEXT.number(-0.4), '0');
  assert.equal(FR_TEXT.number(12), '12');
  assert.equal(FR_TEXT.number(Number.NaN), '-');
  assert.equal(FR_TEXT.clock(83.2), '1:24');
  assert.equal(FR_TEXT.moment(83.47), '1:23,5');
  assert.equal(FR_TEXT.refereeTime(83.47), '1:23,4');
  assert.equal(FR_TEXT.timeTextOf(warehouseSortGame), FR_TEXT.refereeTime);
  assert.equal(FR_TEXT.timeTextOf({ createReferee: undefined }), FR_TEXT.moment);
  assert.equal(FR_TEXT.speedLabel(0.5), '0,5×');
  assert.equal(FR_TEXT.speedLabel(2), '2×');
  assert.equal(FR_TEXT.speedLabel('max'), 'Max');
  assert.equal(FR_TEXT.percent(0.505), `51${NB}%`);
  assert.equal(FR_TEXT.averageScore(37.5), '37,5');
  assert.equal(FR_TEXT.cmText(325), '32,5 cm');
  assert.equal(FR_TEXT.colourRangeText({ forward: 0, height: 0, rangeMm: 15 }), '1,5 cm');
});

test('French plurals: the first form for 0 and 1, the second from 2 on - and for 1,5', () => {
  assert.equal(frPlural(0, 'bloc', 'blocs'), 'bloc');
  assert.equal(frPlural(1, 'bloc', 'blocs'), 'bloc');
  assert.equal(frPlural(1.5, 'point', 'points'), 'points');
  assert.equal(frPlural(2, 'bloc', 'blocs'), 'blocs');
  // (short: the strip above the blocks keeps one row with 48 blocks at 1 440 px, as the English one)
  assert.equal(FR_TEXT.blockCount(0), '0 bloc · sauvegarde auto');
  assert.equal(FR_TEXT.blockCount(1), '1 bloc · sauvegarde auto');
  assert.equal(FR_TEXT.blockCount(2), '2 blocs · sauvegarde auto');
  assert.equal(plain(FR_TEXT.consoleProblems(1)), '1 problème');
  assert.equal(plain(FR_TEXT.consoleProblems(3)), '3 problèmes');
  assert.equal(FR_TEXT.consoleMessages(0), '0 message');
  assert.equal(FR_TEXT.runsCount(1, 24), '1 essai sur 24');
  assert.equal(FR_TEXT.runsCount(24, 24), '24 essais sur 24');
  assert.equal(FR_TEXT.runRestarts(2), ', 2 relances');
  // (what a screen reader says of the score: "0 point" after a restart, as before a start "5 points")
  assert.equal(FR_TEXT.scoreLabel(0, 80), `Score${NB}: 0 point sur 80`);
  assert.equal(FR_TEXT.scoreLabel(5, 80), `Score${NB}: 5 points sur 80`);
});

// =============================================================================================
// The French sentences (a sample of each kind)
// =============================================================================================

test('French sentences: the status line as one sentence, the title row, the console, the ruler, the files', () => {
  assert.equal(plain(FR_TEXT.simulatorTitle('Tri d’entrepôt')), 'Simulateur Tri d’entrepôt ');
  assert.equal(plain(FR_TEXT.statusRunning('Match', 3, 9, 'objectifs', null)), 'Match en cours. 3 objectifs atteints sur 9.');
  assert.equal(plain(FR_TEXT.statusRunning('Match', 1, 9, 'objectifs', null)), 'Match en cours. 1 objectif atteint sur 9.');
  assert.equal(plain(FR_TEXT.statusPaused(FR_TEXT.moment(41.53), 'match')), 'En pause à 0:41,5. Le chrono du match est aussi en pause.');
  assert.equal(
    plain(FR_TEXT.statusStopped('0:41,5', '35 / 80')),
    'Tu as arrêté le match à 0:41,5\u00a0– pas de score final (pour l’instant 35 / 80). Démarrer recommence, Replacer remet le terrain en place.',
  );
  const over: MatchOver = { Match: 'Match', ending: null, reason: FR_TEXT.finishText('time'), time: '1:30,0', total: 80, max: 80, perfect: true, complete: true, goal: 'objectif', goals: 'objectifs', penaltyNote: '' };
  assert.equal(plain(FR_TEXT.statusOver(over, '80 / 80')), `Match terminé. Le temps est écoulé à 1:30,0. Score final${NB}: 80 / 80\u00a0– un parcours parfait${NB}!`);
  assert.equal(FR_TEXT.statusOverText(over), plain(FR_TEXT.statusOver(over, '80 / 80')));
  const some: MatchOver = { ...over, ending: 'La pince a lâché le cube.', perfect: false, total: 35, penaltyNote: FR_TEXT.restartSummary(1, { penalty: 10 }) };
  assert.equal(FR_TEXT.statusOverText(some), `Match terminé. La pince a lâché le cube. Score final${NB}: 35 / 80\u00a0– tous les objectifs atteints. (1 relance${NB}: -10 points)`);
  assert.equal(FR_TEXT.statusOverText(some), plain(FR_TEXT.statusOver(some, '35 / 80')));
  // the referee's first words: a French colon has its no-break space, which goes with it
  assert.equal(FR_TEXT.finishHeadline(`Parcours terminé à 0:53,5 avec 80 points${NB}: tous les cubes sont triés.`), 'Parcours terminé à 0:53,5 avec 80 points.');
  assert.equal(FR_TEXT.finishHeadline(`Bravo${NB}! Le reste.`), `Bravo${NB}!`);
  assert.equal(FR_TEXT.clockLabel('match', '1:30'), `Chrono du match${NB}: il reste 1:30`);
  assert.equal(FR_TEXT.startLine('disposition', 'VR-BR'), `C’est parti${NB}! Disposition VR-BR.`);
  // (short: "80 / 80 points · objectifs : 9/9" fits its heading on a 360 px phone)
  assert.equal(FR_TEXT.scoreSheetSummary({ total: 5, max: 80 }, 1, 9, screenWords.screenWords({ goals: 'objectifs' })), `5 / 80 points · objectifs${NB}: 1/9`);
  assert.equal(plain(FR_TEXT.soundButton(true)), 'Son activé');
  assert.equal(plain(FR_TEXT.soundButton(false)), 'Son coupé');
  assert.equal(FR_TEXT.cyberPiSummary(['Cube : red'], true), `écran${NB}: «${NB}Cube : red${NB}»`);
  // the ruler
  const line = { points: [{ x: 300, y: 900 }, { x: 300, y: 600 }, { x: 600, y: 600 }], startHeading: null };
  assert.equal(FR_TEXT.rulerReading(line), '30,0 cm, puis 90° à droite, puis 30,0 cm\u00a0– 60,0 cm en tout');
  assert.equal(FR_TEXT.rulerText(ruler.EMPTY_RULER), 'Clique sur le tapis pour poser le premier point. Clique sur le robot pour que la règle parte d’entre ses roues.');
  assert.equal(FR_TEXT.rulerText({ points: [{ x: 1, y: 1 }], startHeading: null }), 'Premier point posé. Clique maintenant pour poser le deuxième point.');
  assert.equal(FR_TEXT.rulerText({ points: [{ x: 1, y: 1 }], startHeading: 0 }, false), 'La règle part de la place du robot. Clique maintenant pour poser le deuxième point.');
  // the hints and labels the final check and the review corrected
  assert.equal(FR_TEXT.rulerHint, `Mesurer sur le tapis${NB}: clique sur des points pour voir les distances en cm et les virages entre eux`);
  assert.equal(FR_TEXT.resetHint('Remettre les cubes.', 'match'), 'Remettre les cubes. Possible à tout moment, même pendant un match.');
  assert.deepEqual([FR_TEXT.resetWord, FR_TEXT.resetLabel, FR_TEXT.stop], ['Replacer', 'Replacer', 'Stop']);
  assert.equal(FR_TEXT.stopHint('match'), `Arrêter le programme et le robot là où ils sont. Le match ne compte pas${NB}; Replacer remet tout comme au début.`);
  assert.deepEqual([FR_TEXT.em1Angle, FR_TEXT.em2Angle], ['Angle EM1 (g.)', 'Angle EM2 (d.)']);
  assert.equal(FR_TEXT.scenarioLoaded('disposition'), 'Disposition chargée. Appuie sur Démarrer pour voir ce que fait ton programme sur cette disposition.');
  assert.equal(FR_TEXT.lineEarnedHint, 'Le temps au chrono quand les points de cette ligne ont été gagnés');
  assert.equal(FR_TEXT.lineSuccessTitle, 'Combien de fois chaque ligne de la feuille de score est réussie');
  assert.equal(
    plain(FR_TEXT.emptyWorkspace(true)),
    'Construis ton programme ici. Clique sur une catégorie à gauche (essaie Châssis mBot2) et accroche un bloc sous le bloc jaune. Puis appuie sur Démarrer. Ou ouvre un des Exemples.',
  );
  assert.equal(plain(FR_TEXT.emptyWorkspace(false)), 'Construis ton programme ici. Clique sur une catégorie à gauche (essaie Châssis mBot2) et accroche un bloc sous le bloc jaune. Puis appuie sur Démarrer.');
  const style = { textWidth: (text: string) => text.length * 7, fontSize: 12, clearance: 9, bounds: { x: 0, y: 0, w: 2000, h: 2000 } };
  const labels = FR_TEXT.rulerLabels(line, style);
  assert.deepEqual(labels.map((label) => label.text), ['30,0 cm', '30,0 cm', '90° à droite', '60,0 cm en tout']);
  // (each box is as wide as its French text)
  for (const label of labels) assert.equal(label.w, label.text.length * 7 + 12 * 0.9, label.text);
  assert.deepEqual(EN_TEXT.rulerLabels(line, style).map((label) => label.text), ['30.0 cm', '30.0 cm', '90° right', '60.0 cm in all']);
  // files: every sentence of parseProgramFile has its French
  for (const bad of ['{', '{"format":"mbot2-simulator-program","program":{"blocks":3}}', '[1,2]']) {
    const english = programFile.parseProgramFile(bad);
    const french = FR_TEXT.parseProgramFile(bad);
    assert.ok(!english.ok && !french.ok);
    assert.equal(french.error, FR_FILE_PROBLEMS[english.error], english.error);
  }
  assert.equal(
    FR_TEXT.retiredBlocksNote({ removed: 2, parts: ['flame sensor'] }, 'your saved program'),
    `2 blocs du capteur de flamme ont été retirés de ton programme enregistré, parce que le simulateur n’a plus de capteur de flamme. Regarde les endroits où ils étaient${NB}: une case y est vide maintenant, ou montre un nombre ou un texte que tu n’as pas choisi.`,
  );
  assert.equal(FR_TEXT.retiredBlocksNote({ removed: 0, parts: [] }, 'this program'), null);
});

test('French: a program file of another game names that game and its groups of blocks in French; Warehouse Sort is no other game', () => {
  const gripperBlock = program([script(whenStart(), [gripper('open')])]);
  const note = FR_TEXT.otherGameNote(gripperBlock, 'fire-rescue', 'fire-chief');
  assert.equal(note, `Ce programme a été enregistré dans le simulateur Fire Rescue Senior. 1 de ses blocs sert à des pièces que ce robot n’a pas (Pince)${NB}: il ne marche pas ici.`);
  assert.equal(FR_TEXT.otherGameNote({}, 'fire-chief', 'warehouse-sort'), 'Ce programme a été enregistré dans le simulateur Fire Chief. Tous ses blocs marchent aussi ici.');
  // the name of the French game, as its title row writes it (design 2.3 rule 9): its simulator, « Tri d’entrepôt » - in the English sentence too
  assert.equal(programFile.gameName('robot-en-fete'), 'Tri d’entrepôt');
  assert.equal(EN_TEXT.otherGameNote({}, 'robot-en-fete', 'fire-chief'), 'This program was saved in the Tri d’entrepôt simulator. All its blocks work here too.');
  // and its program files are named after it, not after the id of its game, which its category shares
  assert.equal(programFile.programFileName('robot-en-fete', new Date('2026-11-26T10:00:00Z')), 'tri-entrepot-program-2026-11-26.json');
  assert.equal(programFile.programFileName('warehouse-sort', new Date('2026-11-26T10:00:00Z')), 'warehouse-sort-program-2026-11-26.json');
});

// =============================================================================================
// The lines of the console
// =============================================================================================

/** Every sentence core and vm can log: the literals and templates of their log calls, with sample values. */
function engineSentences(): Array<{ file: string; sentence: string }> {
  const found: Array<{ file: string; sentence: string }> = [];
  for (const folder of ['core', 'vm']) {
    const dir = path.join(HERE, '..', '..', folder);
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
      const file = `${folder}/${name}`;
      const source = ts.createSourceFile(name, readFileSync(path.join(dir, name), 'utf8'), ts.ScriptTarget.Latest, true);
      // (top-level sentences that a log call names: const NO_GRIPPER = '...')
      const constants = new Map<string, ts.Expression>();
      source.forEachChild((node) => {
        if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) constants.set(d.name.text, d.initializer);
      });
      const samples = (expr: ts.Expression): string[] => {
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
        if (ts.isParenthesizedExpression(expr)) return samples(expr.expression);
        if (ts.isConditionalExpression(expr)) return [...samples(expr.whenTrue), ...samples(expr.whenFalse)];
        if (ts.isIdentifier(expr) && constants.has(expr.text)) return samples(constants.get(expr.text) as ts.Expression);
        if (ts.isTemplateExpression(expr)) {
          // a value: a number ("7"); a plural ending (`restart${max === 1 ? '' : 's'}`): nothing
          let text = expr.head.text;
          for (const span of expr.templateSpans) text += (ts.isConditionalExpression(span.expression) ? '' : '7') + span.literal.text;
          return [text];
        }
        return [];
      };
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression.getText(source);
          // the engine: pushEvent({ type: 'log', ..., text: ... })
          if (callee === 'this.pushEvent' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
            const props = node.arguments[0].properties.filter(ts.isPropertyAssignment);
            const type = props.find((p) => p.name.getText(source) === 'type');
            const text = props.find((p) => p.name.getText(source) === 'text');
            if (type && type.initializer.getText(source) === "'log'" && text) for (const s of samples(text.initializer)) found.push({ file, sentence: s });
          }
          // the interpreter: this.error(block, '...'), ctx.warn('...')
          if (callee === 'this.error' && node.arguments[1]) for (const s of samples(node.arguments[1])) found.push({ file, sentence: s });
          if (callee === 'ctx.warn' && node.arguments[0]) for (const s of samples(node.arguments[0])) found.push({ file, sentence: s });
        }
        node.forEachChild(visit);
      };
      visit(source);
    }
  }
  return found;
}

test('console: every sentence the engine and the interpreter can log has its French pattern, or is listed as never shown on this page', () => {
  const sentences = engineSentences();
  // (the reader of the sources finds them: as many as the design's table lists for core and vm, and the start warnings)
  assert.ok(sentences.length >= 20, `${sentences.length} sentences found`);
  for (const { file, sentence } of sentences) {
    const french = frConsoleLine(sentence);
    const notShown = FR_CONSOLE_NOT_ON_THIS_PAGE.some((entry) => entry.english.test(sentence));
    assert.ok(french !== sentence || notShown, `${file}: "${sentence}" has no French pattern`);
    if (!notShown) assert.equal(typographyProblem(french), null, `${file}: ${french}`);
  }
  // every pattern is the pattern of a sentence that exists (none is left behind when a sentence changes)
  for (const pattern of FR_CONSOLE_PATTERNS) assert.ok(sentences.some(({ sentence }) => pattern.english.test(sentence)), String(pattern.english));
  for (const entry of FR_CONSOLE_NOT_ON_THIS_PAGE) assert.ok(sentences.some(({ sentence }) => entry.english.test(sentence)), String(entry.english));
  // the values are put back; an id is named as the screen names it; a line in no pattern stays as it is
  assert.equal(
    frConsoleLine('The robot stands on a game element (cube:W1) at its start position. At the start it is moved off it.'),
    'À sa position de départ, le robot est sur un élément du jeu (le cube E1). Au départ, il en est sorti.',
  );
  assert.equal(frConsoleLine('This block has an empty slot (CONDITION). It counts as false - drop a block into it.'), `Ce bloc a une case vide. Elle compte comme false (faux)${NB}: mets-y un bloc.`);
  assert.equal(frConsoleLine('This block has an empty slot (TEXT). It counts as empty text - drop a block into it.'), `Ce bloc a une case vide. Elle compte comme un texte vide${NB}: mets-y un bloc.`);
  assert.equal(frConsoleLine('Le robot a quitté la zone de départ.'), 'Le robot a quitté la zone de départ.');
  // ... and the console of the French screen passes the engine's lines through it
  const event: SimEvent = { type: 'log', level: 'warn', text: 'The robot is not completely inside the start zone at its start position.', time: 0 };
  assert.equal(FR_TEXT.describeEvent(event)?.text, 'À sa position de départ, le robot n’est pas tout entier dans la zone de départ.');
});

test('console: the cubes are E1 - E4 in every French sentence, never W1 - W4 (every body of the Warehouse Sort field, in all 24 arrangements)', async (t) => {
  const ids = new Set<string>(['wall']);
  for (const scenario of allScenarios()) {
    const sim = createSimulation({ game: warehouseSortGame, scenario, robotConfig: WAREHOUSE_SORT_ROBOT, program: {}, startPose: warehouseSortGame.defaultStartPose });
    for (const body of sim.world.bodies) ids.add(body.id);
  }
  // (Robot en fête plays the same field, made by the same function: design D2. Where its game is there, its bodies are checked too.)
  try {
    const { robotEnFeteGame } = (await import(String('../../robot-en-fete/game'))) as { robotEnFeteGame: typeof warehouseSortGame };
    for (const scenario of allScenarios()) {
      const sim = createSimulation({ game: robotEnFeteGame, scenario, robotConfig: WAREHOUSE_SORT_ROBOT, program: {}, startPose: robotEnFeteGame.defaultStartPose });
      for (const body of sim.world.bodies) ids.add(body.id);
    }
  } catch {
    t.diagnostic('robot-en-fete/game.ts is not there yet: the bodies of Warehouse Sort only');
  }
  assert.ok([...ids].some((id) => id.startsWith('cube:W')), 'the cubes are among the bodies');
  for (const id of ids) {
    const name = FR_TEXT.bodyName(id, 'le bord de la table');
    assert.doesNotMatch(name, /\bW[1-4]\b/, `${id} -> ${name}`);
    for (const event of [
      { type: 'grab', bodyId: id, time: 1 },
      { type: 'release', bodyId: id, onto: null, time: 1 },
      { type: 'bump', bodyId: id, time: 1 },
    ] as SimEvent[]) {
      assert.doesNotMatch(FR_TEXT.describeEvent(event, { penalty: 10, grabbed: 'Pince fermée sur', tableEdge: 'le bord de la table' })?.text ?? '', /\bW[1-4]\b/, `${event.type} ${id}`);
    }
  }
  assert.equal(FR_TEXT.bodyName('cube:W1'), 'le cube E1');
  assert.equal(FR_TEXT.describeEvent({ type: 'grab', bodyId: 'cube:W1', time: 1 }, { penalty: 10, grabbed: 'Pince fermée sur' })?.text, 'Pince fermée sur le cube E1.');
  assert.equal(FR_TEXT.describeEvent({ type: 'release', bodyId: 'cube:W1', onto: null, time: 1 })?.text, `Posé${NB}: le cube E1 sur le tapis.`);
  assert.equal(FR_TEXT.describeEvent({ type: 'bump', bodyId: 'cube:W3', time: 1 })?.text, 'Choc contre le cube E3.');
});

// =============================================================================================
// The values the program gets (D7)
// =============================================================================================

test('D7: a colour a sensor reads is shown as the program gets it, then its French in brackets; the claw empty is "rien"', () => {
  const expected: Record<SensorColor, string> = {
    red: 'red (rouge)',
    green: 'green (vert)',
    blue: 'blue (bleu)',
    yellow: 'yellow (jaune)',
    cyan: 'cyan',
    purple: 'purple (violet)',
    white: 'white (blanc)',
    black: 'black (noir)',
  };
  assert.deepEqual(Object.keys(FR_COLOUR_NAMES).sort(), Object.keys(expected).sort());
  for (const [colour, shown] of Object.entries(expected) as Array<[SensorColor, string]>) {
    assert.equal(frSensorValue(colour), shown);
    assert.equal(plain(FR_TEXT.sensorColour(colour)), shown);
    assert.equal(plain(FR_TEXT.clawReading(colour)), shown);
    // (English: the value itself, as always)
    assert.equal(EN_TEXT.sensorColour(colour), colour);
  }
  // the panel writes the English value with a capital (CSS); the French one is shown as design 6.3 writes it
  assert.match(renderToStaticMarkup(createElement('div', null, FR_TEXT.sensorColour('red'))), /<span style="text-transform:none">red \(rouge\)<\/span>/);
  assert.equal(plain(FR_TEXT.clawReading('none')), 'rien');
  assert.equal(EN_TEXT.clawReading('none'), 'nothing');
  // the closed panel: the same words
  const parts = robotParts.robotParts(DEFAULT_ROBOT_CONFIG);
  assert.equal(FR_TEXT.sensorSummary(parts, { lineStatus: 6, ultrasonicCm: 7.2, frontColor: 'blue', fanOn: false }), 'ligne 6 · 7 cm · pince blue (bleu)');
  assert.equal(FR_TEXT.sensorSummary(parts, { lineStatus: 0, ultrasonicCm: 300, frontColor: 'none', fanOn: false }), 'ligne 0 · 300 cm · pince vide');
  // a variable's value is shown as the program holds it; a list named like a variable is "x (liste)"
  assert.equal(FR_TEXT.variableName('couleur'), 'couleur');
  assert.equal(FR_TEXT.variableName('cubes (list)'), 'cubes (liste)');
});

// =============================================================================================
// French typography, in every French text
// =============================================================================================

/** What is wrong with the typography of a French text, or null. */
function typographyProblem(text: string): string | null {
  if (/ [:;!?%»]/.test(text)) return 'a plain space before : ; ! ? % »';
  if (/«(?!\u00a0)/.test(text) || /(?<!\u00a0)»/.test(text)) return 'no no-break space inside « »';
  if (/[^\s\u00a0][:;!?»](?=\s|$)/u.test(text.replace(/\d:\d/g, '').replace(/https?:/g, ''))) return 'no space at all before : ; ! ? »';
  if (/"/.test(text)) return 'a straight quote (French quotes are « »)';
  if (/'/.test(text)) return "a straight apostrophe (French writes ’)";
  if (/\.\.\./.test(text)) return 'three dots (French writes …)';
  return null;
}

/** Every French text of the table: the strings, and what each function gives for a sample of its values. */
function frenchTexts(): Array<[string, string]> {
  const texts: Array<[string, string]> = [];
  const add = (key: string, value: unknown) => {
    if (typeof value === 'string') texts.push([key, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
    else if (isValidElement(value)) texts.push([key, plain(value)]);
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) add(`${key}.${k}`, v);
  };
  const T = FR_TEXT;
  const parts = robotParts.robotParts(DEFAULT_ROBOT_CONFIG);
  const line = { points: [{ x: 300, y: 900 }, { x: 300, y: 600 }, { x: 600, y: 600 }], startHeading: 0 };
  const style = { textWidth: (text: string) => text.length * 7, fontSize: 12, clearance: 9, bounds: { x: 0, y: 0, w: 2000, h: 2000 } };
  const over: MatchOver = { Match: 'Match', ending: 'Fin.', reason: 'Le temps est écoulé', time: '1:30,0', total: 5, max: 80, perfect: false, complete: true, goal: 'objectif', goals: 'objectifs', penaltyNote: '1 relance' };
  const samples: Partial<Record<keyof ScreenText, () => unknown>> = {
    number: () => T.number(1.25, 2),
    moment: () => T.moment(3.33),
    refereeTime: () => T.refereeTime(3.33),
    timeTextOf: () => T.timeTextOf(warehouseSortGame)(3.33),
    percent: () => T.percent(0.5),
    averageScore: () => T.averageScore(3.25),
    simulatorTitle: () => T.simulatorTitle('Robot en fête 2027'),
    notAllowed: () => T.notAllowed('zone de départ'),
    notAllowedAtAngle: () => T.notAllowedAtAngle('Non.'),
    placingProblem: () => T.placingProblem('Le robot doit être tout entier dans la zone de départ.'),
    nothingToRun: () => [T.nothingToRun(true), T.nothingToRun(false)],
    replaceConfirm: () => T.replaceConfirm('un nouveau programme vide'),
    exampleWhat: () => T.exampleWhat('Sortir'),
    exampleLoaded: () => T.exampleLoaded('Sortir'),
    fileWhat: () => T.fileWhat('a.json'),
    openedWithNotes: () => T.openedWithNotes('a.json', ['Un.', 'Deux.']),
    opened: () => T.opened('a.json'),
    testOnMany: () => T.testOnMany('dispositions'),
    rulesTitle: () => T.rulesTitle('Robot en fête 2027'),
    emptyWorkspace: () => [T.emptyWorkspace(true), T.emptyWorkspace(false)],
    turnLeftLabel: () => T.turnLeftLabel(15),
    turnRightLabel: () => T.turnRightLabel(15),
    consoleProblems: () => [T.consoleProblems(1), T.consoleProblems(2)],
    consoleMessages: () => [T.consoleMessages(1), T.consoleMessages(2)],
    scenarioLoaded: () => T.scenarioLoaded('disposition'),
    blockCount: () => [T.blockCount(1), T.blockCount(2)],
    examplesLevel: () => T.examplesLevel('Premiers pas'),
    loadExampleLabel: () => T.loadExampleLabel('Sortir'),
    examplesIntro: () => (['unlocked', 'all-open', 'some-open', 'checking-some-open', 'checking-saved', 'locked', 'not-known'] as const).map((view) => T.examplesIntro(view, 'MakeX Lebanon')),
    codeMessage: () =>
      [
        { phase: 'none', about: 'typed' },
        { phase: 'checking', about: 'saved' },
        { phase: 'checking', about: 'typed' },
        { phase: 'unlocked', about: 'typed', replaced: true },
        { phase: 'unlocked', about: 'typed' },
        { phase: 'rejected', about: 'typed' },
        { phase: 'rejected', about: 'saved' },
        { phase: 'busy', about: 'typed', waitSeconds: 300 },
        { phase: 'busy', about: 'typed' },
        { phase: 'unreachable', about: 'typed' },
        { phase: 'unreachable', about: 'saved' },
      ].flatMap((status) => [false, true].map((unlocked) => T.codeMessage(status as never, 'MakeX Lebanon', unlocked))),
    speedLabel: () => [T.speedLabel(0.5), T.speedLabel('max')],
    speedHint: () => T.speedHint('match'),
    startHint: () => [T.startHint(true), T.startHint(false)],
    stopHint: () => T.stopHint('match'),
    pauseHint: () => T.pauseHint('match'),
    clockLabel: () => T.clockLabel('match', '1:30'),
    scoreLabel: () => T.scoreLabel(5, 80),
    resetHint: () => T.resetHint('Remettre les cubes.', 'match'),
    restartButton: () => [
      T.restartButton({ penalty: 10 }, Infinity, 'match'),
      T.restartButton({ penalty: 0, rules: { maxRestarts: 1, clearsPoints: true, resetsBodies: true } }, 1, 'match'),
      T.restartButton({ penalty: 0, rules: { maxRestarts: 2 } }, 0, 'match'),
      T.restartButton({ penalty: 0, rules: { maxRestarts: 0 } }, 0, 'match'),
    ],
    restartSummary: () => [T.restartSummary(2, { penalty: 10 }), T.restartSummary(1, { penalty: 0, rules: { maxRestarts: 2, clearsPoints: true } }, 1), T.restartSummary(1, { penalty: 5, rules: { maxRestarts: 1, clearsPoints: true } }, 0)],
    finishSentence: () => [T.finishSentence('time', null, 90), T.finishSentence(null, 'Fin', 3)],
    finishHeadline: () => T.finishHeadline(`Fin à 0:53,5${NB}: tout.`),
    finishText: () => (['time', 'declared', 'program-ended', null] as const).map((reason) => T.finishText(reason)),
    howEnded: () => T.howEnded('match'),
    statusRunning: () => [T.statusRunning('Match', 1, 9, 'objectifs', null), T.statusRunning('Match', 2, 9, 'objectifs', null)],
    statusRunningNow: () => T.statusRunningNow('Match', 'L’arbitre prend le cube.', null),
    statusPaused: () => T.statusPaused('0:41,5', 'match'),
    statusStopped: () => T.statusStopped('0:41,5', '5 / 80'),
    statusOver: () => [T.statusOver(over, '5 / 80'), T.statusOver({ ...over, ending: null }, '5 / 80')],
    statusOverText: () => [T.statusOverText(over), T.statusOverText({ ...over, perfect: true })],
    scoreSheetSummary: () => T.scoreSheetSummary({ total: 5, max: 80 }, 1, 9, screenWords.screenWords({ goals: 'objectifs' })),
    scenarioCodeLabel: () => T.scenarioCodeLabel('disposition', 'VR-BR'),
    copyCodeLabel: () => T.copyCodeLabel('disposition'),
    randomDrawsLead: () => T.randomDrawsLead('Disposition au hasard'),
    batchNothingToTest: () => T.batchNothingToTest('disposition'),
    batchStopped: () => T.batchStopped('x'),
    batchAt: () => [T.batchAt('0:37,2', undefined), T.batchAt('0:37,2', 'dernière livraison à')],
    whichScenarios: () => T.whichScenarios('dispositions'),
    ofPoints: () => T.ofPoints(80),
    everyGoal: () => T.everyGoal('objectif', 'objectifs'),
    runsCount: () => [T.runsCount(1, 24), T.runsCount(2, 24)],
    moreProblems: () => [T.moreProblems(1), T.moreProblems(2)],
    lineSuccessHint: () => T.lineSuccessHint('Prendre le cube E1', T.percent(0.5)),
    cleanLineName: () => T.cleanLineName('Aucune pénalité', 'Cube bleu'),
    runRestarts: () => [T.runRestarts(1), T.runRestarts(2)],
    watchLabel: () => T.watchLabel('disposition', 'VR-BR'),
    endSentence: () => [T.endSentence({ finishReason: 'time', time: 90, restarts: 0 }, T.moment), T.endSentence({ finishReason: 'time', time: 90, restarts: 2 }, T.moment)],
    probeTitle: () => T.probeTitle('L2', T.probeHint.L2),
    sensorColour: () => T.sensorColour('red'),
    probeLight: () => T.probeLight('12'),
    clawReading: () => [T.clawReading('none'), T.clawReading('green')],
    armLabel: () => T.armLabel('S1'),
    armHint: () => T.armHint('12'),
    clawLabel: () => T.clawLabel('S2'),
    clawHint: () => T.clawHint('33'),
    variableName: () => T.variableName('x (list)'),
    colourRangeText: () => T.colourRangeText({ forward: 0, height: 0, rangeMm: 15 }),
    sensorSummary: () => T.sensorSummary(parts, { lineStatus: 6, ultrasonicCm: 7, frontColor: 'red', fanOn: false }),
    sensorsViewHint: () => T.sensorsViewHint(parts),
    soundButton: () => [T.soundButton(true), T.soundButton(false)],
    // (a printed text is the program's own: a text without punctuation, so that only the frame is checked)
    cyberPiSummary: () => [T.cyberPiSummary(['Bonjour red'], true), T.cyberPiSummary([], false)],
    startLine: () => T.startLine('disposition', 'VR-BR'),
    commaTextWarning: () => [T.commaTextWarning('30,5') ?? ''],
    describeEvent: () =>
      (
        [
          { type: 'grab', bodyId: 'cube:W1', time: 1 },
          { type: 'release', bodyId: 'cube:W1', onto: 'cube:W2', time: 1 },
          { type: 'release', bodyId: 'cube:W1', onto: null, time: 1 },
          { type: 'bump', bodyId: 'wall', time: 1 },
          { type: 'restart', time: 1 },
          { type: 'finish', reason: 'time', time: 90 },
        ] as SimEvent[]
      ).map((event) => T.describeEvent(event, { penalty: 10, grabbed: 'Pince fermée sur', tableEdge: 'le bord de la table', match: 'match' })?.text),
    bodyName: () => T.bodyName('cube:W1'),
    consoleLine: () => T.consoleLine('A "return" block only works inside the definition of a my-block.'),
    cmText: () => T.cmText(325),
    turnText: () => [0, 90, -45, 180].map((degrees) => T.turnText(degrees)),
    rulerReading: () => [T.rulerReading(line, true), T.rulerReading(line, false)],
    rulerText: () => [T.rulerText(ruler.EMPTY_RULER), T.rulerText({ points: [{ x: 1, y: 1 }], startHeading: null }), T.rulerText({ points: [{ x: 1, y: 1 }], startHeading: 0 }, true), T.rulerText({ points: [{ x: 1, y: 1 }], startHeading: 0 }, false), T.rulerText(line)],
    rulerLabels: () => T.rulerLabels(line, style).map((label) => label.text),
    sizeButtonHint: () => [T.sizeButtonHint({ rulerOn: false, rulerPoints: 0, enlarged: false }), T.sizeButtonHint({ rulerOn: false, rulerPoints: 0, enlarged: true }), T.sizeButtonHint({ rulerOn: true, rulerPoints: 2, enlarged: true })],
    readyHint: () => [T.readyHint('zone de départ', true, false), T.readyHint('zone de départ', false, false), T.readyHint('zone de départ', false, true)],
    homeButtonWords: () => [T.homeButtonWords('middle', 'zone de départ'), T.homeButtonWords('default', 'zone de départ')],
    parseProgramFile: () => ['{', '{"format":"mbot2-simulator-program","program":{"blocks":3}}', '[1]'].map((bad) => T.parseProgramFile(bad)),
    otherGameNote: () => [T.otherGameNote({}, 'fire-chief', 'warehouse-sort')],
    retiredBlocksNote: () => [T.retiredBlocksNote({ removed: 1, parts: ['flame sensor'] }, 'this program'), T.retiredBlocksNote({ removed: 2, parts: ['flame sensor'] }, 'your saved program')],
  };
  for (const key of keysOf(FR_TEXT)) {
    const top = key.split('.')[0] as keyof ScreenText;
    if (ENGLISH_ON_PURPOSE.has(key) || ENGLISH_ON_PURPOSE.has(top) || top === 'gripper' || key === 'locale') continue;
    const value = at(FR_TEXT, key);
    if (typeof value === 'function') {
      const sample = samples[top];
      assert.ok(sample, `the test has no sample of ${key}: add one`);
      add(key, sample());
    } else {
      add(key, value);
    }
  }
  return texts;
}

test('French typography: a no-break space before : ; ! ? % » and after «, « » quotes, ’ and … - in every French text, those built with values too', () => {
  const texts = frenchTexts();
  assert.ok(texts.length > 300, `${texts.length} French texts`);
  for (const [key, text] of texts) assert.equal(typographyProblem(text), null, `${key}: ${JSON.stringify(text)}`);
  // (the check finds each fault)
  for (const bad of ['Score : 5', 'Score: 5', '« x »', 'Il dit "oui"', "l'exemple", 'Attends...']) assert.notEqual(typographyProblem(bad), null, bad);
  assert.equal(typographyProblem(`Score${NB}: 5 à 0:41,5 «${NB}x${NB}»`), null);
});
