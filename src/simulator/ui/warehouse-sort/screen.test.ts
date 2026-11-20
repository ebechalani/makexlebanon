/**
 * The screen parts of Warehouse Sort without a browser: its words, the Cube colours panel (its
 * logic - one blue cube, always - the code field, and the panel drawn to HTML and clicked in
 * jsdom), the lists of "Test on many arrangements" with the rules' tie-breakers, the window
 * itself run on all 24 arrangements, the stage's drawing of cubes and round pads, and the wiring of the page - the
 * props it hands the general screen, and that the general screen hands them on.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BatchResult } from '../../core/batch';
import { createSimulation } from '../../core/simulation';
import type { ProgramJson } from '../../core/types';
import { arm, gripper, moveCm, program, script, turn, whenStart } from '../../vm/builder';
import { TABLE_MARGIN } from '../../core/engine';
import { FINISH_PADS, TABLE_STRIP, WAREHOUSES, WAREHOUSE_IDS } from '../../warehouse-sort/field';
import { KIND_CUBE, LINE_BLUE, LINE_LAST_DELIVERY, LINE_START_POSITION, MAX_SCORE, deliverLineId, pickLineId, warehouseSortGame } from '../../warehouse-sort/game';
import { START_POSE, WAREHOUSE_SORT_ROBOT } from '../../warehouse-sort/robot';
import { CUBE_COLORS, SCENARIO_COUNT, allScenarios, decodeScenario, defaultScenario, encodeScenario, isValidScenario, scenarioOfCode, type WarehouseSortScenario } from '../../warehouse-sort/scenario';
import { CombinationPanel } from '../CombinationPanel';
import { describeEvent, restartFacts } from '../format';
import { CUBE_KIND, STAGE_MARGIN } from '../render';
import { DEFAULT_WORDS, scoreSheetSummary, screenWords } from '../screen-words';
import {
  ARRANGEMENT_BATCH_PRESETS,
  ARRANGEMENT_TIE_BREAK,
  arrangementSummaryLabel,
  arrangementSummaryOrder,
  compareArrangementRuns,
  correctDeliveries,
  lastDeliveryTime,
} from './arrangement-batch';
import { readArrangementCode } from './arrangement-code';
import { ArrangementEditor } from './ArrangementEditor';
import { arrangementInWords, changeCube, otherColor, WAREHOUSE_ROWS, warehouseName } from './arrangement-panel';
import { DEFAULT_ARRANGEMENT_CODE, WAREHOUSE_SORT_START_ZONE, WAREHOUSE_SORT_WORDS } from './words';

const WORDS = screenWords(WAREHOUSE_SORT_WORDS);
const nothing = (): void => undefined;
const arrangementOf = (code: string): WarehouseSortScenario => {
  const scenario = decodeScenario(code);
  assert.ok(scenario, code);
  return scenario;
};
/** What a reader sees: the tags taken out, quotation marks back as typed. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * From the start zone to W3 (bottom left), its cube into the RED bay, back onto the left pad
 * (the route of ../../warehouse-sort/integration.test.ts): 40 points when the W3 cube is red, 15
 * when it is green (in the wrong bay: -5, and no points for picking it) and 15 when it is blue
 * (lifted: -5).
 */
const W3_TO_RED_BAY: ProgramJson = program([
  script(whenStart(), [
    moveCm('forward', 4.575),
    turn('left', 90),
    moveCm('forward', 36.243),
    gripper('close'),
    arm('raise'),
    turn('right', 90),
    moveCm('forward', 48.678),
    turn('right', 90),
    moveCm('forward', 37.761),
    arm('lower'),
    gripper('open'),
    moveCm('backward', 32.6),
  ]),
]);

// =============================================================================================
// Words
// =============================================================================================

test('words: an "arrangement" of cubes, in a panel called "Cube colours"; everything else as in Fire Rescue', () => {
  assert.equal(WORDS.scenario, 'arrangement');
  assert.equal(WORDS.scenarios, 'arrangements');
  assert.equal(WORDS.scenarioTitle, 'Cube colours');
  assert.equal(WORDS.randomLabel, 'Random arrangement');
  assert.equal(WORDS.defaultLabel, 'Default arrangement');
  assert.equal(WORDS.match, DEFAULT_WORDS.match, 'a "match", as the rules say');
  assert.equal(WORDS.finishedHint, DEFAULT_WORDS.finishedHint);
  assert.equal(WAREHOUSE_SORT_START_ZONE, 'start zone');
  assert.equal(DEFAULT_ARRANGEMENT_CODE, 'GR-BR');
  assert.match(WORDS.scenarioNote ?? '', /^24 arrangements are possible: one cube is blue/);
  assert.match(WORDS.defaultHint, /GR-BR/);
  assert.match(WORDS.sheetNote, /Here, moving the blue cube costs 5 points\./);
  // short and plain: no sentence of the game's own words is longer than 140 characters
  for (const [key, value] of Object.entries(WAREHOUSE_SORT_WORDS)) {
    for (const sentence of String(value).split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${key}: ${sentence}`);
  }
});

test('words: the closed Score sheet before the start - 5 / 80 points for the clean run, 1 of 9 done', () => {
  const sim = createSimulation({ game: warehouseSortGame, scenario: defaultScenario(), program: program([script(whenStart(), [])]) });
  const score = sim.score();
  const goals = score.lines.filter((line) => line.max > 0 && line.id !== 'bonus');
  assert.equal(goals.length, 9, 'leave, 3 picks, 3 deliveries, park, clean run (the blue cube is no goal)');
  assert.equal(MAX_SCORE, 80);
  assert.equal(scoreSheetSummary(score, goals.filter((line) => line.ok).length, goals.length, WORDS), `5 / 80 points · 1 of 9 done`);
  // the line of the blue cube is with the penalties and notes: 0 while it is left alone
  const blue = score.lines.find((line) => line.id === LINE_BLUE);
  assert.deepEqual([blue?.label, blue?.detail, blue?.points, blue?.max], ['Blue cube (W3)', 'left alone', 0, 0]);
});

// =============================================================================================
// The Cube colours panel
// =============================================================================================

test('panel: the four warehouses lie as on the mat - W1 and W2 at the top, W1 and W3 on the left', () => {
  assert.deepEqual(WAREHOUSE_ROWS, [['W1', 'W2'], ['W3', 'W4']]);
  for (const [left, right] of WAREHOUSE_ROWS) assert.ok(WAREHOUSES[left].frame.x < WAREHOUSES[right].frame.x, `${left} is left of ${right}`);
  for (const column of [0, 1] as const) assert.ok(WAREHOUSES[WAREHOUSE_ROWS[0][column]].frame.y < WAREHOUSES[WAREHOUSE_ROWS[1][column]].frame.y);
  assert.equal(warehouseName('W3'), 'W3, bottom left');
  assert.equal(arrangementInWords(defaultScenario()), 'W1 green, W2 red, W3 blue, W4 red');
});

test('panel: one blue cube, always - blue elsewhere moves it (the two cubes swap); a change that leaves no blue, red or green is refused in a plain sentence', () => {
  // the default "GR-BR": W1 green (the only green), W2 red, W3 blue, W4 red
  assert.deepEqual(changeCube(defaultScenario(), 'W2', 'green'), { ok: true, scenario: arrangementOf('GG-BR') });
  assert.deepEqual(changeCube(defaultScenario(), 'W1', 'red'), { ok: false, problem: 'Not possible: then no cube is green. At least one cube must be green.' });
  assert.deepEqual(changeCube(arrangementOf('RG-BG'), 'W1', 'green'), { ok: false, problem: 'Not possible: then no cube is red. At least one cube must be red.' });
  // blue for W1: the blue cube moves there, and W3 takes the green W1 had
  assert.deepEqual(changeCube(defaultScenario(), 'W1', 'blue'), { ok: true, scenario: arrangementOf('BR-GR'), note: 'Only one cube can be blue: W3 is green now.' });
  assert.deepEqual(changeCube(defaultScenario(), 'W4', 'blue'), { ok: true, scenario: arrangementOf('GR-RB'), note: 'Only one cube can be blue: W3 is red now.' });
  // red or green for the blue cube: there would be no blue cube
  assert.deepEqual(changeCube(defaultScenario(), 'W3', 'red'), { ok: false, problem: 'One cube must be blue. To move it, choose blue for another warehouse.' });
  assert.deepEqual(changeCube(defaultScenario(), 'W3', 'blue'), { ok: true, scenario: defaultScenario() }, 'the colour it has: nothing changes');
  assert.equal(otherColor('red'), 'green');
  // every one of the 24 arrangements can be reached, one click at a time, from the default one -
  // and no click ever gives an arrangement that cannot be played
  const seen = new Set([encodeScenario(defaultScenario())]);
  const todo = [defaultScenario()];
  while (todo.length > 0) {
    const from = todo.pop() as WarehouseSortScenario;
    for (const w of WAREHOUSE_IDS) {
      for (const color of CUBE_COLORS) {
        const change = changeCube(from, w, color);
        if (!change.ok) continue;
        assert.ok(isValidScenario(change.scenario), encodeScenario(change.scenario));
        const code = encodeScenario(change.scenario);
        if (!seen.has(code)) {
          seen.add(code);
          todo.push(change.scenario);
        }
      }
    }
  }
  assert.equal(seen.size, SCENARIO_COUNT);
  assert.deepEqual([...seen].sort(), allScenarios().map(encodeScenario).sort());
});

test('code: a code of a playable arrangement is read whatever its case and dashes; everything else gets one plain sentence', () => {
  for (const [typed, code] of [['GR-BR', 'GR-BR'], ['gb-rg', 'GB-RG'], [' R G R B ', 'RG-RB'], ['brrg', 'BR-RG'], ['RB–GR', 'RB-GR'], ['ＧＲ－ＢＲ', 'GR-BR']]) {
    const reading = readArrangementCode(typed);
    assert.ok(reading.ok, typed);
    assert.equal(encodeScenario(reading.scenario), code, typed);
  }
  const problem = (typed: string): string => {
    const reading = readArrangementCode(typed);
    assert.ok(!reading.ok, typed);
    return reading.problem;
  };
  // no blue, two blues, no red, no green: each said plainly
  assert.equal(problem('RG-GR'), 'This arrangement cannot be played. One cube must be blue.');
  assert.equal(problem('rr-gg'), 'This arrangement cannot be played. One cube must be blue.');
  assert.equal(problem('BB-RG'), 'This arrangement cannot be played. There are 2 blue cubes. Only one cube may be blue.');
  assert.equal(problem('BR-RR'), 'This arrangement cannot be played. At least one cube must be green.');
  assert.equal(problem('gggb'), 'This arrangement cannot be played. At least one cube must be red.');
  assert.equal(problem('RR-RR'), 'This arrangement cannot be played. One cube must be blue. At least one cube must be green.');
  assert.equal(problem(''), 'Type a code into the field. A code has four letters, R (red), G (green) or B (blue), like GR-BR.');
  // a number is no code (the test window numbers its rows 1 - 24: a row number must not name another arrangement)
  const notACode = 'This is not an arrangement code. A code has four letters, R (red), G (green) or B (blue), like GR-BR.';
  for (const typed of ['0', '1', '13', '23', '24', '007', '-1', '1 3', '#3', '3.0', '١٣', '9'.repeat(30)]) assert.equal(problem(typed), notACode, typed);
  // something that has no letter or digit at all was still typed: it is answered, not asked for
  for (const typed of ['-', '?!', '–']) assert.equal(problem(typed), notACode, typed);
  assert.equal(problem('   '), 'Type a code into the field. A code has four letters, R (red), G (green) or B (blue), like GR-BR.');
  assert.equal(problem('RGB-GR'), notACode);
  assert.equal(problem('RGY-R'), notACode);
  assert.equal(problem('LC-4406-N0E0'), notACode);
  // never an exception, whatever comes in (a saved setting can be anything)
  for (const odd of ['x'.repeat(5000), '\u0000', '-', '   ', 'GR-BR-RG']) assert.doesNotThrow(() => readArrangementCode(odd), JSON.stringify(odd).slice(0, 20));
  assert.equal(readArrangementCode(undefined as unknown as string).ok, false);
  // the screen's code and the game's agree
  for (const s of allScenarios()) assert.deepEqual(readArrangementCode(encodeScenario(s)), { ok: true, scenario: s });
  assert.equal(scenarioOfCode('RR-GG') !== null, true, 'the game reads it, and says what is wrong with it');
});

test('panel: drawn as the page draws it - the code, "Random arrangement", "Default arrangement", the four warehouses and their three colours', () => {
  const scenario = arrangementOf('RG-GB');
  const html = renderToStaticMarkup(
    createElement(CombinationPanel<WarehouseSortScenario>, {
      game: warehouseSortGame,
      scenario,
      onChange: nothing,
      words: WORDS,
      readCode: readArrangementCode,
      children: createElement(ArrangementEditor, { scenario, onChange: nothing }),
    }),
  );
  const seen = text(html);
  assert.ok(seen.startsWith('RG-GB'), seen.slice(0, 40));
  assert.ok(html.includes('aria-label="Arrangement code RG-GB"'));
  assert.ok(seen.includes('Random arrangement') && seen.includes('Default arrangement'));
  // (the rules have no draw - the referee places the cubes: the hint does not say "like the referee does")
  assert.ok(html.includes('title="Draw one of the 24 arrangements at random"'));
  assert.ok(!seen.includes('referee') && !html.includes('referee'));
  assert.ok(seen.includes('The cubes in the warehouses'));
  for (const w of WAREHOUSE_IDS) {
    assert.ok(html.includes(`aria-label="Cube in ${warehouseName(w)}"`), w);
    for (const color of ['red', 'green', 'blue'] as const) {
      const button = new RegExp(`<button[^>]*aria-checked="${scenario.cubes[w] === color}"[^>]*data-cube="${w}-${color}"`);
      assert.match(html, button, `${w} ${color}`);
    }
  }
  // the chips are drawn in the colours of the cubes on the stage, with their letters
  assert.match(html, /<button[^>]*style="background:#00aeef"[^>]*data-cube="W4-blue"[^>]*>B<\/button>/);
  assert.ok(seen.includes('W1 red, W2 green, W3 green, W4 blue.'));
  assert.ok(seen.includes('24 arrangements are possible'));
  assert.ok(html.includes('placeholder="GR-BR"'), 'the field shows what a code looks like');
  assert.ok(!html.includes('data-arrangement-problem'), 'no refusal before a click');
  assert.match(html, /<p aria-live="polite"[^>]*data-arrangement-note="true"><\/p>/, 'no note before a click');
});

// =============================================================================================
// "Test on many arrangements"
// =============================================================================================

test('test lists: all 24 arrangements once each, in number order - and the arrangement on the stage', () => {
  assert.deepEqual(
    ARRANGEMENT_BATCH_PRESETS.map((preset) => [preset.id, preset.label]),
    [
      ['all-arrangements', 'All 24 arrangements'],
      ['this-arrangement', 'This arrangement'],
    ],
  );
  assert.match(ARRANGEMENT_BATCH_PRESETS[0].hint, /one blue, the others red or green, at least one of each\. 24 matches\./);
  const all = ARRANGEMENT_BATCH_PRESETS[0].scenarios(defaultScenario()).map(encodeScenario);
  assert.deepEqual(all, allScenarios().map(encodeScenario));
  assert.equal(new Set(all).size, 24);
  const stage = arrangementOf('GR-RB');
  assert.deepEqual(ARRANGEMENT_BATCH_PRESETS[1].scenarios(stage), [stage]);
});

/** A result with just what the ranking looks at. */
function run(total: number, delivered: number, last?: number): Pick<BatchResult, 'total' | 'lines'> {
  const lines = WAREHOUSE_IDS.map((w, i) => ({ id: deliverLineId(w), label: '', points: i < delivered ? 15 : 0, max: 15, ok: i < delivered, detail: '' }));
  if (last !== undefined) lines.push({ id: LINE_LAST_DELIVERY, label: '', points: 0, max: 0, ok: true, detail: '', time: last } as (typeof lines)[number]);
  return { total, lines };
}

test('test ranking: more points first; with equal points more cubes in the right bay, then the earlier last delivery (tie-breakers 1 to 3)', () => {
  assert.ok(compareArrangementRuns(run(60, 2, 30), run(40, 2, 10)) < 0, 'more points');
  assert.ok(compareArrangementRuns(run(45, 3, 50), run(45, 2, 10)) < 0, 'equal points: more deliveries');
  assert.ok(compareArrangementRuns(run(45, 2, 20), run(45, 2, 30)) < 0, 'equal points and deliveries: earlier');
  assert.ok(compareArrangementRuns(run(45, 2, 30), run(45, 2, 20)) > 0);
  assert.equal(compareArrangementRuns(run(45, 2, 20), run(45, 2, 20)), 0, 'tie-breaker 4 is the head referee');
  assert.ok(compareArrangementRuns(run(10, 0), run(10, 1, 80)) > 0, 'a delivery beats none');
  assert.equal(compareArrangementRuns(run(10, 0), run(10, 0)), 0);
  assert.equal(correctDeliveries(run(45, 3, 50)), 3);
  assert.equal(lastDeliveryTime(run(45, 3, 50)), 50);
  assert.equal(lastDeliveryTime(run(10, 0)), undefined);
  assert.equal(ARRANGEMENT_TIE_BREAK.compare, compareArrangementRuns);
  assert.equal(ARRANGEMENT_TIE_BREAK.label, 'Last delivery');
  assert.match(ARRANGEMENT_TIE_BREAK.hint, /more cubes in the right bay higher, then the earlier time/);
});

test('test summary: a line is named after its warehouse - the colour changes from one arrangement to the next', () => {
  assert.equal(arrangementSummaryLabel({ id: pickLineId('W1'), label: 'Pick up cube W1 (red)' }), 'Pick up the cube of W1');
  assert.equal(arrangementSummaryLabel({ id: deliverLineId('W4'), label: 'Cube W4 (red) in the red bay' }), 'Cube of W4 in the right bay');
  assert.equal(arrangementSummaryLabel({ id: LINE_BLUE, label: 'Blue cube (W3)' }), 'Blue cube moved', 'the blue cube is in another warehouse in each run');
  assert.equal(arrangementSummaryLabel({ id: 'park', label: 'Park on a finish pad' }), 'Park on a finish pad');
  assert.equal(arrangementSummaryLabel({ id: LINE_LAST_DELIVERY, label: 'Time of the last correct delivery' }), null, 'no goal and no penalty: not in the summary');
});

test('test summary: the order of the lines is the score sheet\'s, with W1 to W4 in turn - whichever warehouse is blue in the first run', () => {
  // every line of every arrangement's sheet is known, in the order the referee writes it
  for (const scenario of allScenarios()) {
    const sim = createSimulation({ game: warehouseSortGame, scenario, program: program([script(whenStart(), [])]) });
    const places = sim.score().lines.map(arrangementSummaryOrder);
    const code = encodeScenario(scenario);
    assert.ok(places.every((place, i) => place < LAST_PLACE && (i === 0 || place > places[i - 1])), `${code}: ${places.join(' ')}`);
  }
  const order = (id: string) => arrangementSummaryOrder({ id });
  assert.ok(order(pickLineId('W1')) < order(pickLineId('W4')) && order(pickLineId('W4')) < order(deliverLineId('W1')));
  assert.ok(order(deliverLineId('W4')) < order(LINE_BLUE), 'the warehouses before the penalties');
  assert.ok(order(LINE_BLUE) < order(LINE_LAST_DELIVERY) && order(LINE_LAST_DELIVERY) < order(LINE_START_POSITION));
  assert.equal(order('a line of another game'), LAST_PLACE, 'an unknown line after them all');
});
/** where arrangementSummaryOrder puts a line it does not know */
const LAST_PLACE = arrangementSummaryOrder({ id: 'not a line' });

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

test('panel in a document: a click changes one cube; blue moves the blue cube and says so; a refused click says why; Default and a typed code work', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const changes: string[] = [];
  function Panel() {
    const [scenario, setScenario] = useState<WarehouseSortScenario>(arrangementOf('RG-GB'));
    const onChange = (next: WarehouseSortScenario) => {
      changes.push(encodeScenario(next));
      setScenario(next);
    };
    return createElement(CombinationPanel<WarehouseSortScenario>, {
      game: warehouseSortGame,
      scenario,
      onChange,
      words: WORDS,
      readCode: readArrangementCode,
      children: createElement(ArrangementEditor, { scenario, onChange }),
    });
  }
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => root.render(createElement(Panel)));
  const chip = (w: string, color: string): HTMLElement => document.querySelector(`[data-cube="${w}-${color}"]`) as HTMLElement;
  const click = async (el: HTMLElement) => act(async () => el.click());
  const problem = (): string | null => {
    const el = document.querySelector('[data-arrangement-problem]');
    return el ? textOf(el) : null;
  };
  const note = (): string => textOf(document.querySelector('[data-arrangement-note]'));
  const code = (): string => textOf(document.querySelector('[aria-label^="Arrangement code"]'));

  // "RG-GB": W1 is the only red cube - making it green is refused, and nothing changes
  await click(chip('W1', 'green'));
  assert.equal(problem(), 'Not possible: then no cube is red. At least one cube must be red.');
  assert.equal(document.querySelector('[data-arrangement-problem]')?.getAttribute('role'), 'alert');
  assert.deepEqual(changes, []);
  assert.equal(code(), 'RG-GB');
  // the blue cube cannot become red: there must be a blue cube
  await click(chip('W4', 'red'));
  assert.equal(problem(), 'One cube must be blue. To move it, choose blue for another warehouse.');
  assert.deepEqual(changes, []);
  // blue for W2: the blue cube moves there, W4 takes the green of W2 - and a polite sentence says so
  await click(chip('W2', 'blue'));
  assert.deepEqual(changes, ['RB-GG']);
  assert.equal(problem(), null);
  assert.equal(note(), 'Only one cube can be blue: W4 is green now.');
  assert.equal(document.querySelector('[data-arrangement-note]')?.getAttribute('aria-live'), 'polite');
  assert.equal(chip('W2', 'blue').getAttribute('aria-checked'), 'true');
  assert.equal(chip('W4', 'green').getAttribute('aria-checked'), 'true');
  assert.equal(textOf(document.querySelector('[data-arrangement-words]')), 'W1 red, W2 blue, W3 green, W4 green.');
  // another cube red: allowed, and the sentence goes away
  await click(chip('W4', 'red'));
  assert.deepEqual(changes, ['RB-GG', 'RB-GR']);
  assert.equal(note(), '');
  // now W1 may turn green
  await click(chip('W1', 'green'));
  assert.deepEqual(changes, ['RB-GG', 'RB-GR', 'GB-GR']);
  // a click on the colour a cube already has changes nothing
  await click(chip('W1', 'green'));
  assert.equal(changes.length, 3);

  // a refusal belongs to the arrangement it was said about: "Default arrangement" makes it go away
  await click(chip('W4', 'green'));
  assert.equal(problem(), 'Not possible: then no cube is red. At least one cube must be red.');
  const button = (label: string): HTMLElement => [...document.querySelectorAll('button')].find((b) => textOf(b) === label) as HTMLElement;
  await click(button('Default arrangement'));
  assert.equal(code(), 'GR-BR');
  assert.equal(problem(), null);

  // a typed code
  const input = document.getElementById('combination-code') as HTMLInputElement;
  const type = async (value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
    await act(async () => {
      (input.form as HTMLFormElement).requestSubmit();
    });
  };
  await type('rr-gg');
  assert.equal(textOf(document.getElementById('combination-code-error')), 'This arrangement cannot be played. One cube must be blue.');
  assert.equal(code(), 'GR-BR');
  await type('bb-rg');
  assert.equal(textOf(document.getElementById('combination-code-error')), 'This arrangement cannot be played. There are 2 blue cubes. Only one cube may be blue.');
  await type('gr bg');
  assert.equal(code(), 'GR-BG');
  assert.equal(document.getElementById('combination-code-error'), null);

  await act(async () => root.unmount());
});

test('test window in a document: no random lists, "All 24 arrangements" chosen - every arrangement played, the last delivery in its column, the lines named by warehouse', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { BatchDialog } = await import('../BatchDialog');
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => {
    root.render(
      createElement(BatchDialog<WarehouseSortScenario>, {
        game: warehouseSortGame,
        robotConfig: WAREHOUSE_SORT_ROBOT,
        getProgram: () => W3_TO_RED_BAY,
        startPose: START_POSE,
        getSampler: () => undefined,
        currentScenario: defaultScenario(),
        presets: ARRANGEMENT_BATCH_PRESETS,
        randomLists: false,
        tieBreak: ARRANGEMENT_TIE_BREAK,
        summaryLabel: arrangementSummaryLabel,
        summaryOrder: arrangementSummaryOrder,
        words: WORDS,
        onPick: nothing,
        onClose: nothing,
      }),
    );
  });
  const dialog = (): string => textOf(document.querySelector('[role="dialog"]') ?? document.body);
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
  assert.deepEqual(
    radios.map((r) => textOf(r.closest('label')?.querySelector('.font-semibold'))),
    ['All 24 arrangements', 'This arrangement'],
    'only the two lists of the game: no random lists',
  );
  assert.equal(radios[0].checked, true, 'the first list is chosen when the window opens');
  assert.ok(!/random/i.test(dialog().replace('Test on many arrangements', '')), 'no word of random lists and no seed');
  assert.equal(document.querySelector('input[type="number"]'), null, 'no seed');

  const run = [...document.querySelectorAll('button')].find((b) => textOf(b) === 'Run the test') as HTMLElement;
  await act(async () => run.click());
  for (let i = 0; i < 4000 && !/24 \/ 24/.test(textOf(document.querySelector('[aria-live="polite"]'))); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  assert.equal(textOf(document.querySelector('[aria-live="polite"]')), '24 / 24');
  const rows = [...document.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map(textOf));
  assert.deepEqual(rows.map((cells) => cells[1]), allScenarios().map(encodeScenario), 'every arrangement once, in number order');
  // 40 points where W3 is red, 15 where it is green or blue - and the time of the last correct delivery only where there is one
  for (const cells of rows) {
    const w3Red = arrangementOf(cells[1]).cubes.W3 === 'red';
    assert.equal(cells[2], w3Red ? '40' : '15', cells[1]);
    if (w3Red) assert.match(cells[4], /^0:\d\d\.\d$/, `${cells[1]}: the time of the delivery`);
    else assert.equal(cells[4], '-no cube in the right bay', `${cells[1]}: no time ("-"), and a screen reader hears why`);
  }
  const headings = [...document.querySelectorAll('thead th')].map(textOf);
  assert.ok(headings.includes('Last delivery'), headings.join(' | '));
  assert.ok(!headings.includes('Time of the points'));
  const lastHeading = [...document.querySelectorAll('thead th')].find((th) => textOf(th) === 'Last delivery');
  assert.equal(lastHeading?.getAttribute('title'), ARRANGEMENT_TIE_BREAK.hint);
  // the summary names the warehouse, not a colour that is only true for some arrangements
  const summary = [...document.querySelectorAll('li[title]')].map((li) => li.getAttribute('title') ?? '');
  // (W3 has a red or green cube in 18 of the 24 runs, a red one in 9 of them; a green W3 cube ends in
  // the red bay: "no points for that cube", also not for picking it)
  assert.ok(summary.some((line) => line.startsWith('Pick up the cube of W3: 50%')), summary.join('\n'));
  assert.ok(summary.some((line) => line.startsWith('Cube of W3 in the right bay: 50%')), summary.join('\n'));
  // the blue cube was lifted in the 6 runs where W3 holds it
  assert.ok(summary.some((line) => line.startsWith('Blue cube moved: 75%')), summary.join('\n'));
  assert.ok(!summary.some((line) => /\((red|green)\)/.test(line)), 'no colour in a line of the summary');
  assert.ok(!summary.some((line) => line.startsWith('No penalty: time of the last correct delivery')), 'the time for a tie is not a line of the summary');
  // in the order of the score sheet, W1 to W4 in turn - though the first run (BR-RG) has its blue
  // cube in W1 and so no W1 lines (without the game's order they came last, after the penalties)
  assert.equal(encodeScenario(allScenarios()[0]).startsWith('B'), true, 'the first run has no W1 lines');
  assert.deepEqual(
    summary.map((line) => line.replace(/: \d+% of the runs$/, '')),
    [
      'Leave the start zone',
      ...WAREHOUSE_IDS.map((w) => `Pick up the cube of ${w}`),
      ...WAREHOUSE_IDS.map((w) => `Cube of ${w} in the right bay`),
      'Park on a finish pad',
      'Clean run: no restart',
      'Restarts',
      'Cubes in the wrong bay',
      'Blue cube moved',
    ],
  );
  // the best run: 40 points, with the time of its last correct delivery; the worst has no delivery and no time
  const tiles = [...document.querySelectorAll('.grid > div')].map((tile) => [...tile.querySelectorAll('p')].map(textOf).join(' | '));
  assert.ok(tiles.some((tile) => /^Best run \| 40 \| at 0:\d\d\.\d$/.test(tile)), tiles.join('\n'));
  assert.ok(tiles.includes('Worst run | 15'), tiles.join('\n'));

  await act(async () => root.unmount());
});

// =============================================================================================
// The stage
// =============================================================================================

test('stage: a cube is drawn as a cube (the kind the game gives its cubes), and the finish pads as round zones', () => {
  assert.equal(CUBE_KIND, KIND_CUBE);
  for (const body of warehouseSortGame.createBodies(defaultScenario())) assert.equal(body.kind, CUBE_KIND);
  const pads = warehouseSortGame.overlays(defaultScenario()).filter((zone) => zone.id.startsWith('pad:'));
  assert.equal(pads.length, 2);
  for (const pad of pads) {
    assert.equal(pad.shape, 'ellipse');
    const e = FINISH_PADS[pad.id === 'pad:left' ? 'left' : 'right'];
    assert.deepEqual(pad.rect, { x: e.cx - e.rx, y: e.cy - e.ry, w: 2 * e.rx, h: 2 * e.ry });
  }
  // every other zone is a rectangle, as in the other games
  for (const zone of warehouseSortGame.overlays(defaultScenario())) if (!zone.id.startsWith('pad:')) assert.equal(zone.shape, undefined, zone.id);
});

// =============================================================================================
// The page
// =============================================================================================

const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
/** The code of a file without its comments: a prop that is only mentioned in a comment is not passed. */
const code = (source: string): string =>
  source
    .replace(/\/\*[^]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');

test('console: closing the claw on a cube says "Gripped", not "Picked up" (the referee counts that later); the edge is the table\'s', () => {
  const words = screenWords(WAREHOUSE_SORT_WORDS);
  const say = (event: Parameters<typeof describeEvent>[0], own: { grabbed?: string; tableEdge?: string }) =>
    describeEvent(event, { ...restartFacts(warehouseSortGame), match: words.match, ...own })?.text;
  const ws = { grabbed: words.grabbed, tableEdge: words.tableEdge };
  assert.equal(say({ type: 'grab', bodyId: 'cube:W2', time: 3.2 }, ws), 'Gripped the W2 cube.');
  assert.equal(say({ type: 'release', bodyId: 'cube:W2', onto: null, time: 4 }, ws), 'Put down the W2 cube on the mat.');
  assert.equal(say({ type: 'bump', bodyId: 'wall', time: 6.4 }, ws), 'Bumped into the edge of the table.');
  assert.equal(say({ type: 'bump', bodyId: 'cube:W1', time: 6.4 }, ws), 'Bumped into the W1 cube.');
  // the words of Fire Rescue (and so of Fire Chief, which gives none of its own) are as they were
  assert.equal(DEFAULT_WORDS.grabbed, undefined);
  assert.equal(DEFAULT_WORDS.tableEdge, undefined);
  assert.equal(describeEvent({ type: 'grab', bodyId: 'bucket:red', time: 1 })?.text, 'Picked up the red bucket.');
  assert.equal(describeEvent({ type: 'bump', bodyId: 'wall', time: 1 })?.text, 'Bumped into the table wall.');
  // the general screen hands the two words on to the console
  const app = code(read('../SimulatorApp.tsx'));
  assert.match(app, /grabbedWord: words\.grabbed,/);
  assert.match(app, /tableEdgeWord: words\.tableEdge,/);
  const loop = code(read('../useSimulation.ts'));
  assert.match(loop, /grabbed: optionsRef\.current\.grabbedWord,/);
  assert.match(loop, /tableEdge: optionsRef\.current\.tableEdgeWord,/);
});

test('page: the Warehouse Sort screen hands the general screen its game, robot, examples, rules, words, panel and test lists', () => {
  const page = code(read('./WarehouseSortSimulator.tsx'));
  for (const prop of [
    /\sgame=\{warehouseSortGame\}\s/,
    /\srobotConfig=\{WAREHOUSE_SORT_ROBOT\}\s/,
    /\stitle="Warehouse Sort"\s/,
    /\sstartZoneName=\{WAREHOUSE_SORT_START_ZONE\}\s/,
    /\sexamples=\{EXAMPLES\}\s/,
    /\srules=\{WAREHOUSE_SORT_RULES\}\s/,
    /\srulesNote=\{WAREHOUSE_SORT_RULES_NOTE\}\s/,
    /\srulesExtra=\{WAREHOUSE_SORT_ASSUMPTIONS\}\s/,
    /\swords=\{WAREHOUSE_SORT_WORDS\}\s/,
    /\sinitialStartPose=\{START_POSE\}\s/,
    /\sshowLastPrint\s/,
    /\srenderCombinationEditor=\{renderCombinationEditor\}\s/,
    /\sreadCode=\{readArrangementCode\}\s/,
    /\sbatchPresets=\{ARRANGEMENT_BATCH_PRESETS\}\s/,
    /\sbatchRandomLists=\{false\}\s/,
    /\sbatchTieBreak=\{ARRANGEMENT_TIE_BREAK\}\s/,
    /\sbatchSummaryLabel=\{arrangementSummaryLabel\}\s/,
    /\sbatchSummaryOrder=\{arrangementSummaryOrder\}\s/,
    /\stitleWrapsOnPhone\s/,
    /\sstageMargin=\{TABLE_STRIP\}\s/,
  ]) {
    assert.match(page, prop);
  }
  // the stage shows the whole table strip on which the robot can still move
  assert.equal(TABLE_STRIP, TABLE_MARGIN);
  assert.ok(TABLE_STRIP > STAGE_MARGIN);
  // the examples: the one address, and the name of this game - nothing else about them
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'warehouse-sort',\s+organisation: 'MakeX Lebanon',/);
  assert.match(page, /<ArrangementEditor scenario=\{scenario\} onChange=\{onChange\} \/>/);
  // the general screen hands the new props on to the test window
  const app = code(read('../SimulatorApp.tsx'));
  for (const [prop, from] of [
    ['randomLists', 'batchRandomLists'],
    ['tieBreak', 'batchTieBreak'],
    ['summaryLabel', 'batchSummaryLabel'],
    ['summaryOrder', 'batchSummaryOrder'],
  ]) {
    assert.match(app, new RegExp(`<BatchDialog\\b(?:(?!</?[A-Z])[^])*?\\s${prop}=\\{props\\.${from}\\}`), prop);
  }
  // ... the title and the stage get theirs
  assert.match(app, /<TitleBar title=\{props\.title\} wrapOnPhone=\{props\.titleWrapsOnPhone\}>/);
  const stage = app.slice(app.indexOf('<StageCanvas'), app.indexOf('/>', app.indexOf('<StageCanvas')));
  assert.match(stage, /\smargin=\{props\.stageMargin\}\s/);
  // ... and the two other games pass none of them: their screens are as they were. (Since Fire Rescue was
  // split, its screen is Fire Rescue Senior's: "Fire Rescue Senior simulator" is too long for a phone too, so
  // its title wraps there - only that.)
  for (const other of ['../fire-rescue/FireRescueSimulator.tsx', '../fire-chief/FireChiefSimulator.tsx', '../fire-rescue/FireRescueLoader.tsx', '../fire-chief/FireChiefLoader.tsx']) {
    const source = read(other);
    const wraps = other.startsWith('../fire-rescue/') ? [] : ['titleWrapsOnPhone', 'wrapOnPhone'];
    for (const prop of ['batchRandomLists', 'batchTieBreak', 'batchSummaryLabel', 'batchSummaryOrder', 'stageMargin', ...wraps]) assert.ok(!source.includes(prop), `${other}: ${prop}`);
  }
  // the start pose of the page is the game's, and it fits the start zone
  assert.deepEqual(START_POSE, warehouseSortGame.defaultStartPose);
});

test('page: its address, title and description; the loader shows the name of the game while the simulator loads', () => {
  const page = read('../../../app/simulator/warehouse-sort/page.tsx');
  assert.match(page, /const PATH = '\/simulator\/warehouse-sort';/);
  assert.match(page, /const TITLE = 'mBot2 simulator — Warehouse Sort';/);
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /return <WarehouseSortLoader \/>;/);
  const loader = code(read('./WarehouseSortLoader.tsx'));
  assert.match(loader, /<TitleBar title="Warehouse Sort" wrapOnPhone \/>/);
  assert.match(loader, /dynamic\(\(\) => import\('\.\/WarehouseSortSimulator'\), \{\s+ssr: false,/);
  assert.match(read('./WarehouseSortLoader.tsx'), /^'use client';/);
  assert.match(read('./WarehouseSortSimulator.tsx'), /^'use client';/);
});

test('site: the Simulator page lists the page in Season 2026, and the sitemap names it', async () => {
  const { missionSimulators, simulatorSeasons } = await import('../../../../content/seasons');
  assert.ok(read('../../../app/sitemap.ts').includes("{ path: '/simulator/warehouse-sort', priority: 0.7 },"));
  assert.deepEqual(
    missionSimulators.map((mission) => [mission.name, mission.season, mission.label, mission.event, mission.href, mission.mat]),
    [['Warehouse Sort', 2026, 'MakeX Inspire · Beginner', 'Local event', '/simulator/warehouse-sort', '/simulator/warehouse-sort/mat.webp']],
  );
  // (its card in the part "Season 2026", with its own two labels and no "About" link: it is not the category Smart Logistics)
  const card = simulatorSeasons().find((section) => section.year === 2026)?.simulators.find((simulator) => simulator.name === 'Warehouse Sort');
  assert.deepEqual(card && [card.href, card.labels, card.about], ['/simulator/warehouse-sort', ['MakeX Inspire · Beginner', 'Local event'], undefined]);
  assert.ok(code(read('../../../app/simulator/page.tsx')).includes('simulatorSeasons()'));
});
