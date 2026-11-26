/**
 * The words Robot en fête 2027 gives the simulator screen (./words.ts), its code field
 * (./arrangement-code.ts), its test window (./arrangement-batch.ts) and its Cube colours panel
 * (./arrangement-words.ts with ../warehouse-sort/ArrangementEditor.tsx): every one French, the
 * same behaviour as Warehouse Sort, and the English panel unchanged when no words are given.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BatchResult } from '../../core/batch';
import { createSimulation } from '../../core/simulation';
import type { Game, ScoreReport } from '../../core/types';
import { robotEnFeteGame } from '../../robot-en-fete/game';
import { FR_CODEC } from '../../robot-en-fete/scenario-words';
import { WAREHOUSE_IDS, type WarehouseId } from '../../warehouse-sort/field';
import { BLUE_PENALTY, LINE_BLUE, LINE_LAST_DELIVERY, deliverLineId, pickLineId, warehouseSortGame } from '../../warehouse-sort/game';
import { SAMPLE_PROGRAMS } from '../../warehouse-sort/samples';
import { allScenarios, defaultScenario, encodeScenario, SCENARIO_COUNT, type CubeColor, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { screenWords, type ScreenWords } from '../screen-words';
import { ArrangementEditor } from '../warehouse-sort/ArrangementEditor';
import { ARRANGEMENT_BATCH_PRESETS, ARRANGEMENT_TIE_BREAK, arrangementSummaryLabel, arrangementSummaryOrder } from '../warehouse-sort/arrangement-batch';
import { readArrangementCode } from '../warehouse-sort/arrangement-code';
import { arrangementPanel, changeCube, EN_ARRANGEMENT_WORDS } from '../warehouse-sort/arrangement-panel';
import { WAREHOUSE_SORT_WORDS } from '../warehouse-sort/words';
import { ROBOT_EN_FETE_BATCH_PRESETS, ROBOT_EN_FETE_TIE_BREAK, robotEnFeteSummaryLabel, robotEnFeteSummaryOrder } from './arrangement-batch';
import { readRobotEnFeteCode } from './arrangement-code';
import { FR_ARRANGEMENT_WORDS } from './arrangement-words';
import { ROBOT_EN_FETE_DEFAULT_CODE, ROBOT_EN_FETE_START_ZONE, ROBOT_EN_FETE_WORDS } from './words';

const NB = '\u00a0';
const PANEL = arrangementPanel(FR_ARRANGEMENT_WORDS);
const nothing = (): void => undefined;
const arrangement = (code: string): WarehouseSortScenario => {
  const s = FR_CODEC.decode(code);
  assert.ok(s, code);
  return s;
};

/** What is wrong with the typography of a French text, or null (design 4.3). */
function frenchProblem(text: string): string | null {
  if (/\bW[1-4]\b/.test(text)) return 'names a warehouse W1 - W4';
  if (/\d\.\d/.test(text)) return 'a number with a decimal point';
  if (/'/.test(text) || /"/.test(text)) return 'a straight apostrophe or quotation mark';
  if (/«(?!\u00a0)/.test(text) || /(?<!\u00a0)»/.test(text)) return 'no no-break space inside « »';
  if (/(?<!\u00a0)[:;!?]/.test(text.replace(/\d:\d/g, ''))) return 'no no-break space before : ; ! ?';
  if (/(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/iu.test(text)) return '"vous" (the screen says "tu")';
  return null;
}

// =============================================================================================
// The screen's words
// =============================================================================================

test('the screen words: every key of ScreenWords, in French, none the English one ("match" is French too)', () => {
  const english = screenWords(WAREHOUSE_SORT_WORDS) as Required<ScreenWords>;
  const keys = Object.keys(ROBOT_EN_FETE_WORDS).sort();
  // every key the English page has, and the five it leaves to an English default
  for (const key of Object.keys(english)) assert.ok(keys.includes(key), key);
  for (const key of ['goalsShort', 'scenarioSummary', 'scenarioNote', 'grabbed', 'tableEdge']) assert.ok(keys.includes(key), key);
  for (const [key, value] of Object.entries(ROBOT_EN_FETE_WORDS)) {
    assert.ok(value.trim().length > 0, key);
    assert.equal(frenchProblem(value), null, `${key}: ${value}`);
    if (key !== 'match' && key in english) assert.notEqual(value, english[key as keyof ScreenWords], `${key} is the English`);
    for (const sentence of value.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${key}: ${sentence}`);
  }
  assert.equal(ROBOT_EN_FETE_WORDS.match, 'match');
  assert.equal(ROBOT_EN_FETE_WORDS.scenario, 'disposition');
  assert.equal(ROBOT_EN_FETE_WORDS.scenarios, 'dispositions');
  assert.equal(ROBOT_EN_FETE_WORDS.scenarioTitle, 'Couleurs des cubes');
  assert.equal(ROBOT_EN_FETE_START_ZONE, 'zone de départ');
  assert.equal(ROBOT_EN_FETE_DEFAULT_CODE, 'VR-BR');
  assert.equal(ROBOT_EN_FETE_WORDS.defaultHint, `La première disposition du simulateur, VR-BR${NB}: vert en haut à gauche, rouge à droite, bleu en bas à gauche`);
  assert.equal(ROBOT_EN_FETE_WORDS.randomHint, `Tirer au hasard une des ${SCENARIO_COUNT} dispositions`);
  assert.match(ROBOT_EN_FETE_WORDS.scenarioNote, new RegExp(`^${SCENARIO_COUNT} dispositions sont possibles\u00a0: un cube est bleu`));
  assert.match(ROBOT_EN_FETE_WORDS.sheetNote, new RegExp(`Ici, déplacer le cube bleu coûte ${BLUE_PENALTY} points\\.`));
  assert.equal(ROBOT_EN_FETE_WORDS.finishedHint, `Dire «${NB}Terminé${NB}» à l’arbitre${NB}: le robot s’arrête et le terrain est noté tel qu’il est`);
  assert.equal(ROBOT_EN_FETE_WORDS.grabbed, 'Pince fermée sur');
  assert.equal(ROBOT_EN_FETE_WORDS.tableEdge, 'le bord de la table');
});

// =============================================================================================
// The code field
// =============================================================================================

test('the code field: "VR-BR" and the Warehouse Sort code "GR-BR" are read; every refusal is a French sentence that says what is wrong', () => {
  const looksLike = 'Un code a quatre lettres, R (rouge), V (vert) ou B (bleu), comme VR-BR.';
  assert.deepEqual(readRobotEnFeteCode('VR-BR'), { ok: true, scenario: defaultScenario() });
  assert.deepEqual(readRobotEnFeteCode(' vr br '), { ok: true, scenario: defaultScenario() });
  assert.deepEqual(readRobotEnFeteCode('GR-BR'), { ok: true, scenario: defaultScenario() });
  assert.deepEqual(readRobotEnFeteCode(''), { ok: false, problem: `Tape un code dans la case. ${looksLike}` });
  assert.deepEqual(readRobotEnFeteCode('   '), { ok: false, problem: `Tape un code dans la case. ${looksLike}` });
  assert.deepEqual(readRobotEnFeteCode('rr-vv'), { ok: false, problem: 'Cette disposition ne peut pas être jouée. Un cube doit être bleu.' });
  assert.deepEqual(readRobotEnFeteCode('bb-rv'), { ok: false, problem: 'Cette disposition ne peut pas être jouée. Il y a 2 cubes bleus. Un seul cube peut être bleu.' });
  assert.deepEqual(readRobotEnFeteCode('VV-BV'), { ok: false, problem: 'Cette disposition ne peut pas être jouée. Au moins un cube doit être rouge.' });
  assert.deepEqual(readRobotEnFeteCode('xyz'), { ok: false, problem: `Ce n’est pas un code de disposition. ${looksLike}` });
  assert.deepEqual(readRobotEnFeteCode('12'), { ok: false, problem: `Ce n’est pas un code de disposition. ${looksLike}` });
  for (const odd of ['x'.repeat(5000), '\u0000', '-', 'VR-BR-RV']) assert.doesNotThrow(() => readRobotEnFeteCode(odd), JSON.stringify(odd).slice(0, 20));
  assert.equal(readRobotEnFeteCode(undefined as unknown as string).ok, false);
  // the screen's code and the game's agree; and a code the English page reads is read the same here
  for (const s of allScenarios()) {
    assert.deepEqual(readRobotEnFeteCode(robotEnFeteGame.encodeScenario(s)), { ok: true, scenario: s });
    assert.deepEqual(readRobotEnFeteCode(encodeScenario(s)), readArrangementCode(encodeScenario(s)));
  }
  for (const a of 'RVBG') for (const b of 'RVBG') for (const c of 'RVBG') for (const d of 'RVBG') {
    const reading = readRobotEnFeteCode(`${a}${b}${c}${d}`);
    if (!reading.ok) assert.equal(frenchProblem(reading.problem), null, reading.problem);
  }
});

// =============================================================================================
// The test window
// =============================================================================================

test('the test window: the same two lists as Warehouse Sort, the same ranking, French words', () => {
  assert.deepEqual(ROBOT_EN_FETE_BATCH_PRESETS.map((p) => p.id), ARRANGEMENT_BATCH_PRESETS.map((p) => p.id));
  const current = arrangement('RV-VB');
  ROBOT_EN_FETE_BATCH_PRESETS.forEach((preset, i) => {
    assert.deepEqual(preset.scenarios(current), ARRANGEMENT_BATCH_PRESETS[i].scenarios(current));
    assert.equal(frenchProblem(preset.label), null);
    assert.equal(frenchProblem(preset.hint), null);
  });
  assert.equal(ROBOT_EN_FETE_BATCH_PRESETS[0].label, `Les ${SCENARIO_COUNT} dispositions`);
  assert.equal(ROBOT_EN_FETE_BATCH_PRESETS[0].scenarios(current).length, SCENARIO_COUNT);
  assert.equal(ROBOT_EN_FETE_BATCH_PRESETS[1].label, 'Cette disposition');
  assert.equal(ROBOT_EN_FETE_BATCH_PRESETS[1].hint, `La disposition sur la scène${NB}: un match.`);
  // the tie-break: the same time and ranking, French words (the time "at" of the tiles is the screen's: "à")
  assert.equal(ROBOT_EN_FETE_TIE_BREAK.timeOf, ARRANGEMENT_TIE_BREAK.timeOf);
  assert.equal(ROBOT_EN_FETE_TIE_BREAK.compare, ARRANGEMENT_TIE_BREAK.compare);
  assert.equal(ROBOT_EN_FETE_TIE_BREAK.tileWords, undefined);
  assert.equal(ROBOT_EN_FETE_TIE_BREAK.label, 'Dernière livraison');
  assert.equal(ROBOT_EN_FETE_TIE_BREAK.none, 'aucun cube dans la bonne baie');
  assert.equal(frenchProblem(ROBOT_EN_FETE_TIE_BREAK.hint), null);
  assert.equal(robotEnFeteSummaryOrder, arrangementSummaryOrder);
});

test('the summary of the test window names the warehouse E1 - E4, not the colour; the other lines keep the French referee\'s label', () => {
  assert.equal(robotEnFeteSummaryLabel({ id: pickLineId('W1'), label: 'x' }), 'Prendre le cube de E1');
  assert.equal(robotEnFeteSummaryLabel({ id: deliverLineId('W4'), label: 'x' }), 'Cube de E4 dans la bonne baie');
  assert.equal(robotEnFeteSummaryLabel({ id: LINE_BLUE, label: 'x' }), 'Cube bleu déplacé');
  assert.equal(robotEnFeteSummaryLabel({ id: LINE_LAST_DELIVERY, label: 'x' }), null);
  // every line of real French sheets: a French name, or none where the English has none
  const sample = SAMPLE_PROGRAMS.find((p) => p.id === 'sort-all-cubes');
  assert.ok(sample);
  for (const s of allScenarios().filter((_, i) => i % 5 === 0)) {
    const run = (game: Game<WarehouseSortScenario>): ScoreReport => {
      const sim = createSimulation({ game, scenario: s, program: sample.program, seed: 1 });
      sim.start();
      while (sim.status === 'running') sim.step(50);
      return sim.score();
    };
    const [fr, en] = [run(robotEnFeteGame), run(warehouseSortGame)];
    fr.lines.forEach((line, i) => {
      const french = robotEnFeteSummaryLabel(line);
      const english = arrangementSummaryLabel(en.lines[i]);
      assert.equal(french === null, english === null, line.id);
      if (french !== null) {
        assert.equal(frenchProblem(french), null, french);
        assert.notEqual(french, english);
      }
      assert.equal(robotEnFeteSummaryOrder(line), arrangementSummaryOrder(en.lines[i]));
    });
    // the ranking reads the same lines in both languages
    const result = (report: ScoreReport) => ({ total: report.total, lines: report.lines }) as unknown as BatchResult;
    assert.equal(ROBOT_EN_FETE_TIE_BREAK.timeOf(result(fr)), ARRANGEMENT_TIE_BREAK.timeOf(result(en)));
  }
});

// =============================================================================================
// The Cube colours panel
// =============================================================================================

test('the panel in French: E1 - E4 and their places, the colours of a cube, the letters R V B', () => {
  assert.deepEqual(WAREHOUSE_IDS.map((w) => PANEL.warehouseName(w)), ['E1, en haut à gauche', 'E2, en haut à droite', 'E3, en bas à gauche', 'E4, en bas à droite']);
  assert.equal(PANEL.arrangementInWords(defaultScenario()), 'E1 vert, E2 rouge, E3 bleu, E4 rouge');
  assert.deepEqual((['red', 'green', 'blue'] as CubeColor[]).map((c) => [FR_ARRANGEMENT_WORDS.color(c), FR_ARRANGEMENT_WORDS.letter(c)]), [
    ['rouge', 'R'],
    ['vert', 'V'],
    ['bleu', 'B'],
  ]);
  assert.equal(FR_ARRANGEMENT_WORDS.legend, 'Les cubes dans les entrepôts');
});

test('the panel in French does what the English panel does, change for change, and says it in French', () => {
  let changes = 0;
  for (const s of allScenarios()) {
    for (const w of WAREHOUSE_IDS) {
      for (const color of ['red', 'green', 'blue', 'yellow'] as CubeColor[]) {
        const fr = PANEL.changeCube(s, w, color);
        const en = changeCube(s, w, color);
        assert.equal(fr.ok, en.ok);
        if (fr.ok && en.ok) {
          assert.deepEqual(fr.scenario, en.scenario);
          assert.equal(fr.note === undefined, en.note === undefined);
          if (fr.note) assert.equal(frenchProblem(fr.note), null, fr.note);
        } else if (!fr.ok && !en.ok) {
          assert.equal(frenchProblem(fr.problem), null, fr.problem);
          assert.notEqual(fr.problem, en.problem);
        }
        changes++;
      }
    }
  }
  assert.equal(changes, 24 * 4 * 4);
  // the sentences, one by one ("RV-VB": E1 rouge, E2 vert, E3 vert, E4 bleu)
  const s = arrangement('RV-VB');
  assert.deepEqual(PANEL.changeCube(s, 'W1', 'green'), { ok: false, problem: `Pas possible${NB}: alors aucun cube ne serait rouge. Au moins un cube doit être rouge.` });
  assert.deepEqual(PANEL.changeCube(s, 'W4', 'red'), { ok: false, problem: 'Un cube doit être bleu. Pour le déplacer, choisis bleu pour un autre entrepôt.' });
  assert.deepEqual(PANEL.changeCube(s, 'W2', 'blue'), { ok: true, scenario: arrangement('RB-VV'), note: `Un seul cube peut être bleu${NB}: E4 est vert maintenant.` });
  assert.deepEqual(PANEL.changeCube(s, 'W1', 'yellow' as CubeColor), { ok: false, problem: 'Un cube est rouge, vert ou bleu.' });
  // (a swap never breaks an arrangement; only one that had no blue cube can be refused for blue:
  // "Pas possible." and the game's own French problem)
  const noBlue = FR_CODEC.ofCode('RR-RR') as WarehouseSortScenario;
  assert.deepEqual(PANEL.changeCube(noBlue, 'W1', 'blue'), { ok: false, problem: 'Pas possible. Au moins un cube doit être vert.' });
  assert.deepEqual(changeCube(noBlue, 'W1', 'blue'), { ok: false, problem: 'Not possible. At least one cube must be green.' }, 'the English, unchanged');
});

test('the panel drawn in French: the legend, E1 - E4, the places, the buttons rouge / vert / bleu with R V B; the English panel unchanged without words', () => {
  const s = arrangement('RV-VB');
  const french = renderToStaticMarkup(createElement(ArrangementEditor, { scenario: s, onChange: nothing, words: FR_ARRANGEMENT_WORDS }));
  const english = renderToStaticMarkup(createElement(ArrangementEditor, { scenario: s, onChange: nothing }));
  assert.equal(renderToStaticMarkup(createElement(ArrangementEditor, { scenario: s, onChange: nothing, words: EN_ARRANGEMENT_WORDS })), english, 'the English words are the default');
  assert.ok(english.includes('The cubes in the warehouses') && english.includes('aria-label="Cube in W1, top left"') && english.includes('W1 red, W2 green, W3 green, W4 blue.'));
  assert.ok(french.includes('>Les cubes dans les entrepôts</legend>'));
  for (const w of WAREHOUSE_IDS) {
    assert.ok(french.includes(`aria-label="Cube dans ${PANEL.warehouseName(w)}"`), w);
    assert.ok(french.includes(`<span class="font-mono font-bold">${FR_ARRANGEMENT_WORDS.warehouse(w)}</span>`), w);
    assert.ok(french.includes(`<span class="block text-xs text-ink-500">${FR_ARRANGEMENT_WORDS.place(w)}</span>`), w);
    for (const [color, word, letter] of [
      ['red', 'rouge', 'R'],
      ['green', 'vert', 'V'],
      ['blue', 'bleu', 'B'],
    ] as const) {
      // (the data attribute keeps the ids: it is no text)
      assert.match(french, new RegExp(`<button[^>]*aria-label="${word}" title="${word}"[^>]*data-cube="${w}-${color}"[^>]*>${letter}</button>`), `${w} ${color}`);
    }
  }
  assert.ok(french.includes('E1 rouge, E2 vert, E3 vert, E4 bleu.'));
  // (the data attributes are ids and names for the code, no text: data-cube="W1-red", data-warehouse-grid)
  assert.doesNotMatch(french.replace(/ data-[a-z-]+="[^"]*"/g, ''), /\bW[1-4]\b|\b(red|green|blue)\b|warehouse|Cube in/);
  // the same elements in the same order: only the words differ
  const tags = (html: string) => html.match(/<[a-z]+/g);
  assert.deepEqual(tags(french), tags(english));
});

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

/** The text of an element, its spaces and line breaks made one space (a no-break space stays one). */
const textOf = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/[ \t\r\n]+/g, ' ').trim();

test('the panel in a document, in French: a refused click says why, blue moves the blue cube and says so', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const changes: string[] = [];
  function Panel() {
    const [scenario, setScenario] = useState<WarehouseSortScenario>(arrangement('RV-VB'));
    const onChange = (next: WarehouseSortScenario) => {
      changes.push(FR_CODEC.encode(next));
      setScenario(next);
    };
    return createElement(ArrangementEditor, { scenario, onChange, words: FR_ARRANGEMENT_WORDS });
  }
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => root.render(createElement(Panel)));
  const chip = (w: WarehouseId, color: string): HTMLElement => document.querySelector(`[data-cube="${w}-${color}"]`) as HTMLElement;
  const click = async (el: HTMLElement) => act(async () => el.click());
  const problem = (): string | null => {
    const el = document.querySelector('[data-arrangement-problem]');
    return el ? textOf(el) : null;
  };
  const note = (): string => textOf(document.querySelector('[data-arrangement-note]'));

  await click(chip('W1', 'green'));
  assert.equal(problem(), `Pas possible${NB}: alors aucun cube ne serait rouge. Au moins un cube doit être rouge.`);
  assert.deepEqual(changes, []);
  await click(chip('W4', 'red'));
  assert.equal(problem(), 'Un cube doit être bleu. Pour le déplacer, choisis bleu pour un autre entrepôt.');
  await click(chip('W2', 'blue'));
  assert.deepEqual(changes, ['RB-VV']);
  assert.equal(problem(), null);
  assert.equal(note(), `Un seul cube peut être bleu${NB}: E4 est vert maintenant.`);
  assert.equal(textOf(document.querySelector('[data-arrangement-words]')), 'E1 rouge, E2 bleu, E3 vert, E4 vert.');
  assert.equal(chip('W2', 'blue').getAttribute('aria-label'), 'bleu');
  assert.equal(chip('W2', 'blue').getAttribute('aria-checked'), 'true');
  await click(chip('W4', 'red'));
  assert.deepEqual(changes, ['RB-VV', 'RB-VR']);
  assert.equal(note(), '');
  await act(async () => root.unmount());
});
