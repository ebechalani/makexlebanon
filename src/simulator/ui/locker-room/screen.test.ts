/**
 * The screen parts of Locker Room without a browser: its words, the Cards panel (its logic - one
 * token of each colour, always one of the six zone cards - the code field, and the panel drawn to
 * HTML and clicked in jsdom), the lists of "Test on many draws", the window itself run on all 12
 * draws, the stage's drawing of the Team Box, the card and the turned warehouses, the console's
 * names, and the wiring of the page - the props it hands the general screen, and that the general
 * screen hands them on (and that the other three games pass none of the new ones).
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BatchResult } from '../../core/batch';
import { TABLE_MARGIN } from '../../core/engine';
import { createSimulation } from '../../core/simulation';
import type { ProgramJson, ScoreReport, Simulation } from '../../core/types';
import { BIG_CIRCLES, MARK_ROLES, TABLE_STRIP, ZONES, ZONE_IDS, markOutline, pickupZone, targetOf, type ZoneId } from '../../locker-room/field';
import {
  CARD_SHOW_S,
  CUBE_FILL,
  GATE_ID,
  KIND_CUBE,
  LINE_APPROVAL,
  LINE_DELIVERY,
  LINE_GATE,
  LINE_GATE_TOUCH,
  LINE_LEAVE,
  LINE_SCAN_STATION,
  MAX_SCORE,
  PROP_CARD,
  PROP_TEAM_BOX,
  lockerRoomGame,
  teamCubeId,
  tokenId,
  tokenLineId,
} from '../../locker-room/game';
import { LOCKER_ROOM_ROBOT, START_POSE } from '../../locker-room/robot';
import { SCENARIO_COUNT, TOKEN_COLORS, ZONE_OPTIONS, ZONE_OPTION_NUMBERS, allScenarios, decodeScenario, defaultScenario, encodeScenario, isValidScenario, tokensOf, type LockerRoomScenario, type ZoneOption } from '../../locker-room/scenario';
import { warehouseSortGame } from '../../warehouse-sort/game';
import { moveCm, program, script, wait, whenStart } from '../../vm/builder';
import { CombinationPanel } from '../CombinationPanel';
import { ControlBar } from '../ControlBar';
import { bodyName, describeEvent, restartFacts } from '../format';
import { CUBE_KIND, MatPainter, STAGE_MARGIN, drawStage, fitView, propBox } from '../render';
import { StatusLine } from '../ScoreSheet';
import { DEFAULT_WORDS, scoreSheetSummary, screenWords } from '../screen-words';
import { DRAW_BATCH_PRESETS, DRAW_TIE_BREAK, compareDrawRuns, drawSummaryLabel, lastStepTime } from './cards-batch';
import { readCardsCode } from './cards-code';
import { CardsEditor } from './CardsEditor';
import { COLOR_WORD, ZONES_TOP_DOWN, ZONE_PLACE, changeOption, changeTeam, changeZone, optionInWords, optionOf } from './cards-panel';
import { DEFAULT_DRAW_CODE, LOCKER_ROOM_START_ZONE, LOCKER_ROOM_WORDS } from './words';

const WORDS = screenWords(LOCKER_ROOM_WORDS);
const nothing = (): void => undefined;
const drawOf = (code: string): LockerRoomScenario => {
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

/** Straight out of the Locker Room and into the Scan Station (98.2 cm, the distance of the first starter example): 15 points on every draw. */
const TO_THE_STATION: ProgramJson = program([script(whenStart(), [moveCm('forward', 98.2)])]);

// =============================================================================================
// Words
// =============================================================================================

test('words: a "draw" of two cards, in a panel called "Cards"; a "match" as the rules say', () => {
  assert.equal(WORDS.scenario, 'draw');
  assert.equal(WORDS.scenarios, 'draws');
  assert.equal(WORDS.scenarioTitle, 'Cards');
  assert.equal(WORDS.randomLabel, 'Random draw');
  assert.equal(WORDS.defaultLabel, 'Default draw');
  assert.equal(WORDS.match, DEFAULT_WORDS.match);
  assert.equal(LOCKER_ROOM_START_ZONE, 'Locker Room');
  assert.equal(DEFAULT_DRAW_CODE, 'G5');
  assert.equal(WORDS.defaultHint, "The simulator's first draw, G5. Team GREEN. Option 5: BLUE in A, RED in B, GREEN in C.");
  assert.equal(WORDS.randomHint, 'Draw the two cards at random: one of the 12 draws');
  assert.equal(WORDS.scenarioNote, '12 draws are possible: 2 team colours x 6 zone cards. Changing a card puts the field back to the start.');
  assert.match(WORDS.sheetNote, /Touching the closed gate costs 10 points, once\. The total is never below 0\./);
  assert.match(WORDS.finishedHint, /^The referee says "STOP"/);
  assert.equal(WORDS.tableEdge, 'the edge of the table');
  // the Zones button names the zones as the stage labels them: the pickup zones and the warehouses (the targets at the top)
  assert.equal(WORDS.zonesHint, 'Colour the zones: Locker Room, Scan Station, pickup zones, big circles, zones A, B, C, the warehouses and the gate');
  // short and plain: no sentence of the game's own words is longer than 140 characters
  for (const [key, value] of Object.entries(LOCKER_ROOM_WORDS)) {
    for (const sentence of String(value).split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${key}: ${sentence}`);
  }
});

test('words: the closed Score sheet before the start - 0 / 85 points, 0 of 8 done', () => {
  const sim = createSimulation({ game: lockerRoomGame, scenario: defaultScenario(), program: program([script(whenStart(), [])]) });
  const score = sim.score();
  const goals = score.lines.filter((line) => line.max > 0 && line.id !== 'bonus');
  assert.deepEqual(
    goals.map((line) => line.id),
    [LINE_LEAVE, LINE_SCAN_STATION, LINE_APPROVAL, LINE_DELIVERY, LINE_GATE, ...TOKEN_COLORS.map(tokenLineId)],
  );
  assert.equal(MAX_SCORE, 85);
  assert.equal(scoreSheetSummary(score, goals.filter((line) => line.ok).length, goals.length, WORDS), '0 / 85 points · 0 of 8 done');
  // the gate is a penalty line, with nothing to pay while it is not touched
  const gate = score.lines.find((line) => line.id === LINE_GATE_TOUCH);
  assert.deepEqual([gate?.points, gate?.max, gate?.ok], [0, 0, true]);
});

// =============================================================================================
// The Cards panel
// =============================================================================================

test('panel: the zones are listed as they lie on the mat - C at the top, then B, then A at the bottom', () => {
  assert.deepEqual(ZONES_TOP_DOWN, ['C', 'B', 'A']);
  for (let i = 1; i < ZONES_TOP_DOWN.length; i++) assert.ok(ZONES[ZONES_TOP_DOWN[i - 1]].y < ZONES[ZONES_TOP_DOWN[i]].y, `${ZONES_TOP_DOWN[i - 1]} is above ${ZONES_TOP_DOWN[i]}`);
  assert.deepEqual(ZONE_PLACE, { A: 'at the bottom', B: 'in the middle', C: 'at the top' });
  assert.equal(optionInWords(5), 'BLUE in A, RED in B, GREEN in C');
  assert.equal(optionInWords(1), 'RED in A, GREEN in B, BLUE in C');
});

test('panel: the six zone cards are every way to put the three tokens into the three zones - so a colour picked for a zone swaps two tokens and is always one of them', () => {
  // optionOf finds every card, and nothing that is not one
  for (const option of ZONE_OPTION_NUMBERS) assert.equal(optionOf(ZONE_OPTIONS[option]), option);
  assert.equal(optionOf({ A: 'red', B: 'red', C: 'blue' }), null);
  assert.equal(optionOf({ A: 'red', B: 'green', C: 'yellow' as never }), null);
  // a colour for a zone: the token of that colour moves there, and the one that was there takes its place
  const g5 = defaultScenario();
  assert.deepEqual(tokensOf(g5), { A: 'blue', B: 'red', C: 'green' });
  // (G5: BLUE in A, RED in B, GREEN in C. RED for A: the RED token comes from B, the BLUE one goes there - option 2)
  assert.deepEqual(changeZone(g5, 'A', 'red'), { ok: true, scenario: drawOf('G2'), note: 'Each colour is in one zone only: zone B has the BLUE token now.' });
  // (BLUE for C: the BLUE token comes from A, the GREEN one goes there - option 3)
  assert.deepEqual(changeZone(g5, 'C', 'blue'), { ok: true, scenario: drawOf('G3'), note: 'Each colour is in one zone only: zone A has the GREEN token now.' });
  assert.deepEqual(changeZone(g5, 'B', 'red'), { ok: true, scenario: g5 }, 'the colour it has: nothing changes, nothing is said');
  // the team colour is not touched by a zone, and the zones are not touched by the team colour
  assert.equal((changeZone(drawOf('R2'), 'A', 'blue') as { scenario: LockerRoomScenario }).scenario.team, 'red');
  assert.deepEqual(changeTeam(g5, 'red'), { ok: true, scenario: drawOf('R5') });
  assert.deepEqual(changeTeam(g5, 'green'), { ok: true, scenario: g5 });
  assert.deepEqual(changeOption(g5, 2), { ok: true, scenario: drawOf('G2') });
  // anything else is refused in a plain sentence, and nothing changes
  assert.deepEqual(changeTeam(g5, 'blue' as never), { ok: false, problem: 'The team colour is RED or GREEN.' });
  for (const option of [0, 7, 2.5, -1, Number.NaN]) assert.deepEqual(changeOption(g5, option as ZoneOption), { ok: false, problem: 'There are 6 zone cards: option 1 to 6.' }, String(option));
  assert.deepEqual(changeZone(g5, 'A', 'yellow' as never), { ok: false, problem: 'A token is RED, GREEN or BLUE.' });
  assert.deepEqual(changeZone(g5, 'D' as ZoneId, 'red'), { ok: false, problem: 'The zones are A, B and C.' });
  // every one of the 12 draws can be reached, one click at a time, from the default one - and no click gives one that is no draw
  const seen = new Set([encodeScenario(g5)]);
  const todo = [g5];
  while (todo.length > 0) {
    const from = todo.pop() as LockerRoomScenario;
    const changes = [
      ...(['red', 'green'] as const).map((team) => changeTeam(from, team)),
      ...ZONE_OPTION_NUMBERS.map((option) => changeOption(from, option)),
      ...ZONE_IDS.flatMap((zone) => TOKEN_COLORS.map((color) => changeZone(from, zone, color))),
    ];
    for (const change of changes) {
      assert.ok(change.ok);
      assert.ok(isValidScenario(change.scenario), encodeScenario(change.scenario));
      const code = encodeScenario(change.scenario);
      if (!seen.has(code)) {
        seen.add(code);
        todo.push(change.scenario);
      }
    }
  }
  assert.equal(seen.size, SCENARIO_COUNT);
  assert.deepEqual([...seen].sort(), allScenarios().map(encodeScenario).sort());
});

test('code: the two cards as the referee draws them, whatever the case and the dashes; everything else gets one plain sentence', () => {
  // (also the digits of an Arabic keyboard: many students here type on one)
  for (const [typed, code] of [['G5', 'G5'], ['g5', 'G5'], ['r-2', 'R2'], [' green 6 ', 'G6'], ['RED 1', 'R1'], ['Ｒ３', 'R3'], ['G٥', 'G5'], ['R٢', 'R2'], ['green ۶', 'G6']]) {
    const reading = readCardsCode(typed);
    assert.ok(reading.ok, typed);
    assert.equal(encodeScenario(reading.scenario), code, typed);
  }
  const problem = (typed: string): string => {
    const reading = readCardsCode(typed);
    assert.ok(!reading.ok, typed);
    return reading.problem;
  };
  const LOOKS = 'A code is the team colour, R (RED) or G (GREEN), and the zone card, 1 to 6: like G5.';
  assert.equal(problem(''), `Type a code into the field. ${LOOKS}`);
  assert.equal(problem('   '), `Type a code into the field. ${LOOKS}`);
  for (const typed of ['G7', 'r0', 'green 12', 'R9']) assert.equal(problem(typed), `There are 6 zone cards: the number is 1 to 6. ${LOOKS}`, typed);
  for (const typed of ['B2', 'Y5', 'blue 3', 'X1']) assert.equal(problem(typed), `The team colour is RED or GREEN. ${LOOKS}`, typed);
  // a number is no code (the test window numbers its rows 1 - 12: a row number must not name another draw)
  for (const typed of ['5', '12', '0', '007', ' 5 ', '٥']) assert.equal(problem(typed), `A number alone is not a code. ${LOOKS}`, typed);
  // a word in other letters with a number is no number alone: "red 2" and "c5" in Arabic letters, a G with a mark
  for (const typed of ['أحمر 2', 'ج5', 'أخضر ٥', 'ģ5']) assert.equal(problem(typed), `This is not a code of the cards. ${LOOKS}`, typed);
  for (const typed of ['GR-BR', 'hello', 'G', '5G', '?!', 'LC-4406-N0E0']) assert.equal(problem(typed), `This is not a code of the cards. ${LOOKS}`, typed);
  // never an exception, whatever comes in (a saved setting can be anything)
  for (const odd of ['x'.repeat(5000), '\u0000', '-', 'G5'.repeat(60)]) assert.doesNotThrow(() => readCardsCode(odd), JSON.stringify(odd).slice(0, 20));
  assert.equal(readCardsCode(undefined as unknown as string).ok, false);
  // the screen's code and the game's agree
  for (const s of allScenarios()) assert.deepEqual(readCardsCode(encodeScenario(s)), { ok: true, scenario: s });
});

test('panel: drawn as the page draws it - the code, "Random draw", "Default draw", the team colour, the six zone cards and the three zones', () => {
  const scenario = drawOf('R4');
  const html = renderToStaticMarkup(
    createElement(CombinationPanel<LockerRoomScenario>, {
      game: lockerRoomGame,
      scenario,
      onChange: nothing,
      words: WORDS,
      readCode: readCardsCode,
      children: createElement(CardsEditor, { scenario, onChange: nothing }),
    }),
  );
  const seen = text(html);
  assert.ok(seen.startsWith('R4'), seen.slice(0, 40));
  assert.ok(html.includes('aria-label="Draw code R4"'));
  assert.ok(seen.includes('Random draw') && seen.includes('Default draw'));
  assert.ok(seen.includes('Team Colour card') && seen.includes('Zone Assignment card'));
  assert.match(html, /<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*data-team="red"[^>]*>RED<\/button>/);
  assert.match(html, /<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*data-team="green"[^>]*>GREEN<\/button>/);
  for (const option of ZONE_OPTION_NUMBERS) {
    assert.match(html, new RegExp(`<button[^>]*aria-checked="${option === 4}"[^>]*aria-label="Option ${option}: ${optionInWords(option)}"[^>]*data-option="${option}"`), String(option));
  }
  // the zones from the top down, each with its three colours, the token of the card checked
  const zones = [...html.matchAll(/<span class="font-bold">Zone ([ABC])<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(zones, ['C', 'B', 'A']);
  for (const zone of ZONE_IDS) {
    assert.ok(html.includes(`aria-label="Token in zone ${zone}"`), zone);
    for (const color of TOKEN_COLORS) assert.match(html, new RegExp(`<button[^>]*aria-checked="${ZONE_OPTIONS[4][zone] === color}"[^>]*data-zone-token="${zone}-${color}"`), `${zone} ${color}`);
  }
  // the chips are drawn in the colours of the cubes on the stage, with their letters
  assert.match(html, new RegExp(`<button[^>]*style="background:${CUBE_FILL.blue}"[^>]*data-zone-token="B-blue"[^>]*>B</button>`));
  assert.ok(seen.includes('Team RED. Option 4: GREEN in A, BLUE in B, RED in C.'));
  assert.ok(seen.includes('12 draws are possible'));
  assert.ok(html.includes('placeholder="G5"'), 'the field shows what a code looks like');
  assert.ok(!html.includes('data-draw-problem'), 'no refusal before a click');
  assert.match(html, /<p aria-live="polite"[^>]*data-draw-note="true"><\/p>/, 'no note before a click');
});

// =============================================================================================
// "Test on many draws"
// =============================================================================================

test('test lists: all 12 draws once each, in number order (R1 .. R6, G1 .. G6) - and the draw on the stage', () => {
  assert.deepEqual(
    DRAW_BATCH_PRESETS.map((preset) => [preset.id, preset.label]),
    [
      ['all-draws', 'All 12 draws'],
      ['this-draw', 'This draw'],
    ],
  );
  assert.match(DRAW_BATCH_PRESETS[0].hint, /2 team colours x 6 zone cards\. 12 matches\./);
  const all = DRAW_BATCH_PRESETS[0].scenarios(defaultScenario()).map(encodeScenario);
  assert.deepEqual(all, ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
  const stage = drawOf('R3');
  assert.deepEqual(DRAW_BATCH_PRESETS[1].scenarios(stage), [stage]);
});

/** A result with just what the ranking and the time column look at. */
function run(total: number, times: Array<[number, number | undefined]>): Pick<BatchResult, 'total' | 'lines'> {
  return { total, lines: times.map(([points, time], i) => ({ id: `l${i}`, label: '', points, max: 10, ok: points > 0, detail: '', ...(time === undefined ? {} : { time }) })) };
}

test('test ranking: more points first; the rules have no tie-breaker, so equal points stay equal; the column is the time of the last step that has one', () => {
  assert.ok(compareDrawRuns(run(30, []), run(15, [])) < 0);
  assert.ok(compareDrawRuns(run(15, []), run(30, [])) > 0);
  assert.equal(compareDrawRuns(run(15, [[5, 2]]), run(15, [[5, 9]])), 0, 'equal points: no ranking by time - the rules give none');
  assert.equal(DRAW_TIE_BREAK.compare, compareDrawRuns);
  assert.equal(DRAW_TIE_BREAK.label, 'Last step');
  assert.match(DRAW_TIE_BREAK.hint, /The rules do not say how equal points are ranked/);
  // the last step with points and a time (the tokens have no time; a penalty is no step)
  assert.equal(lastStepTime(run(30, [[5, 1.5], [10, 6], [15, 10.4], [10, undefined], [-10, 20]])), 10.4);
  assert.equal(lastStepTime(run(0, [[0, undefined]])), undefined);
  assert.equal(DRAW_TIE_BREAK.timeOf(run(0, []) as BatchResult), undefined);
});

test('test summary: the team cube and the tokens are named without the colour or the zone of one draw', () => {
  assert.equal(drawSummaryLabel({ id: LINE_DELIVERY, label: 'Step 5: deliver the RED cube' }), 'Step 5: the team colour cube in its circle');
  assert.equal(drawSummaryLabel({ id: tokenLineId('red'), label: 'Step 7: the RED token (zone A)' }), 'Step 7: the RED token');
  assert.equal(drawSummaryLabel({ id: tokenLineId('blue'), label: 'Step 7: the BLUE token (zone C)' }), 'Step 7: the BLUE token');
  assert.equal(drawSummaryLabel({ id: LINE_LEAVE, label: 'Step 1: leave the Locker Room' }), 'Step 1: leave the Locker Room');
  // every draw's sheet has its lines in the same order: no order of its own is needed
  const orders = allScenarios().map((scenario) => createSimulation({ game: lockerRoomGame, scenario, program: program([script(whenStart(), [])]) }).score().lines.map((line) => drawSummaryLabel(line)).join(' | '));
  assert.equal(new Set(orders).size, 1, orders[0]);
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

const textOf = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

test('panel in a document: the team colour, a zone card, a colour for a zone (with its sentence), Default and Random draw, and a typed code', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const changes: string[] = [];
  function Panel() {
    const [scenario, setScenario] = useState<LockerRoomScenario>(drawOf('R1'));
    const onChange = (next: LockerRoomScenario) => {
      changes.push(encodeScenario(next));
      setScenario(next);
    };
    return createElement(CombinationPanel<LockerRoomScenario>, {
      game: lockerRoomGame,
      scenario,
      onChange,
      words: WORDS,
      readCode: readCardsCode,
      children: createElement(CardsEditor, { scenario, onChange }),
    });
  }
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => root.render(createElement(Panel)));
  const click = async (el: Element | null) => act(async () => (el as HTMLElement).click());
  const code = (): string => textOf(document.querySelector('[aria-label^="Draw code"]'));
  const note = (): string => textOf(document.querySelector('[data-draw-note]'));
  const words = (): string => textOf(document.querySelector('[data-draw-words]'));

  await click(document.querySelector('[data-team="green"]'));
  assert.deepEqual(changes, ['G1']);
  assert.equal(words(), 'Team GREEN. Option 1: RED in A, GREEN in B, BLUE in C.');
  await click(document.querySelector('[data-option="6"]'));
  assert.deepEqual(changes, ['G1', 'G6']);
  assert.equal(document.querySelector('[data-option="6"]')?.getAttribute('aria-checked'), 'true');
  // option 6: BLUE in A, GREEN in B, RED in C. GREEN for zone A: the GREEN token moves there, BLUE goes to B - option 4
  await click(document.querySelector('[data-zone-token="A-green"]'));
  assert.deepEqual(changes, ['G1', 'G6', 'G4']);
  assert.equal(words(), 'Team GREEN. Option 4: GREEN in A, BLUE in B, RED in C.');
  assert.equal(note(), 'Each colour is in one zone only: zone B has the BLUE token now.');
  assert.equal(document.querySelector('[data-draw-note]')?.getAttribute('aria-live'), 'polite');
  assert.equal(document.querySelector('[data-zone-token="A-green"]')?.getAttribute('aria-checked'), 'true');
  assert.equal(document.querySelector('[data-zone-token="B-blue"]')?.getAttribute('aria-checked'), 'true');
  assert.equal(document.querySelector('[data-option="4"]')?.getAttribute('aria-checked'), 'true');
  // a click on what is already chosen changes nothing
  await click(document.querySelector('[data-zone-token="A-green"]'));
  await click(document.querySelector('[data-team="green"]'));
  assert.equal(changes.length, 3);
  // the sentence belongs to the draw it was said about: "Default draw" makes it go away
  const button = (label: string): Element | undefined => [...document.querySelectorAll('button')].find((b) => textOf(b) === label);
  await click(button('Default draw') ?? null);
  assert.equal(code(), 'G5');
  assert.equal(note(), '');
  // "Random draw" gives one of the 12
  await click(button('Random draw') ?? null);
  assert.ok(isValidScenario(drawOf(code())), code());

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
  const before = code();
  await type('g7');
  assert.equal(textOf(document.getElementById('combination-code-error')), 'There are 6 zone cards: the number is 1 to 6. A code is the team colour, R (RED) or G (GREEN), and the zone card, 1 to 6: like G5.');
  assert.equal(code(), before, 'a refused code changes nothing');
  await type('red-2');
  assert.equal(code(), 'R2');
  assert.equal(document.getElementById('combination-code-error'), null);
  await act(async () => root.unmount());
});

test('test window in a document: no random lists, "All 12 draws" chosen - every draw played, the time of the last step in its column, the lines named without a draw\'s colour', async (t) => {
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
      createElement(BatchDialog<LockerRoomScenario>, {
        game: lockerRoomGame,
        robotConfig: LOCKER_ROOM_ROBOT,
        getProgram: () => TO_THE_STATION,
        startPose: START_POSE,
        getSampler: () => undefined,
        currentScenario: defaultScenario(),
        presets: DRAW_BATCH_PRESETS,
        randomLists: false,
        tieBreak: DRAW_TIE_BREAK,
        summaryLabel: drawSummaryLabel,
        words: WORDS,
        onPick: nothing,
        onClose: nothing,
      }),
    );
  });
  const dialog = (): string => textOf(document.querySelector('[role="dialog"]') ?? document.body);
  assert.ok(dialog().includes('Test on many draws'));
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
  assert.deepEqual(
    radios.map((r) => textOf(r.closest('label')?.querySelector('.font-semibold'))),
    ['All 12 draws', 'This draw'],
    'only the two lists of the game: no random lists',
  );
  assert.equal(radios[0].checked, true);
  assert.equal(document.querySelector('input[type="number"]'), null, 'no seed');
  const runButton = [...document.querySelectorAll('button')].find((b) => textOf(b) === 'Run the test') as HTMLElement;
  await act(async () => runButton.click());
  for (let i = 0; i < 4000 && !/12 \/ 12/.test(textOf(document.querySelector('[aria-live="polite"]'))); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  assert.equal(textOf(document.querySelector('[aria-live="polite"]')), '12 / 12');
  const rows = [...document.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map(textOf));
  assert.deepEqual(rows.map((cells) => cells[1]), allScenarios().map(encodeScenario), 'every draw once, in number order');
  // out of the Locker Room and into the Scan Station on every draw: 15 points, the last step at the moment it got there
  for (const cells of rows) {
    assert.equal(cells[2], '15', cells[1]);
    assert.match(cells[4], /^0:05\.\d$/, `${cells[1]}: the time of Step 2`);
  }
  const headings = [...document.querySelectorAll('thead th')].map(textOf);
  assert.ok(headings.includes('Last step'), headings.join(' | '));
  // the Best run and Worst run tiles: the time is the last step's, said so ("at 0:05.8" alone would read as the moment of the points)
  const tiles = dialog();
  assert.match(tiles, /Best run15last step at 0:05\.\d/, 'Best run tile');
  assert.match(tiles, /Worst run15last step at 0:05\.\d/, 'Worst run tile');
  const summary = [...document.querySelectorAll('li[title]')].map((li) => li.getAttribute('title') ?? '');
  assert.ok(summary.some((line) => line.startsWith('Step 1: leave the Locker Room: 100%')), summary.join('\n'));
  assert.ok(summary.some((line) => line.startsWith('Step 2: reach the Scan Station: 100%')), summary.join('\n'));
  assert.ok(summary.some((line) => line.startsWith('Step 3: coach approval: 0%')), summary.join('\n'));
  assert.ok(summary.some((line) => line.startsWith('Step 5: the team colour cube in its circle: 0%')), summary.join('\n'));
  for (const color of TOKEN_COLORS) assert.ok(summary.some((line) => line.startsWith(`Step 7: the ${COLOR_WORD[color]} token: 0%`)), color);
  assert.ok(!summary.some((line) => /\(zone [ABC]\)|deliver the (RED|GREEN) cube/.test(line)), 'no colour or zone of one draw in the summary');
  await act(async () => root.unmount());
});

test('status line: while the robot waits at the Scan Station it says what the referee does, in place of the count of goals - and is as before otherwise', () => {
  const sim = createSimulation({ game: lockerRoomGame, scenario: defaultScenario(), program: program([script(whenStart(), [moveCm('forward', 98.2), wait(6)])]) });
  sim.start();
  const said: string[] = [];
  while (sim.status === 'running' && sim.world.time < 12) {
    sim.step(1);
    const now = sim.score().now;
    if (now !== undefined && said[said.length - 1] !== now) said.push(now);
  }
  assert.deepEqual(said, [
    'The robot stopped in the Scan Station. The referee comes with the card.',
    'The referee shows the GREEN card in front of the robot.',
    'The referee took the card away. Next the referee lifts the Team Box.',
  ]);
  const line = (score: ScoreReport): string =>
    renderToStaticMarkup(createElement(StatusLine, { runState: 'running', finishReason: null, score, time: 7, words: WORDS, readyHint: '', placingProblem: null, onShowSheet: nothing })).replace(/<[^>]+>/g, '');
  const waiting = { ...sim.score(), now: said[1] };
  assert.equal(line(waiting), 'Match running. The referee shows the GREEN card in front of the robot.');
  const { now: _now, ...plain } = waiting;
  void _now;
  assert.match(line(plain), /^Match running\. \d+ of 8 goals complete\.$/);
});

// =============================================================================================
// The stage
// =============================================================================================

/** A 2-D context that only remembers what it was asked to do: the fill colours, the texts, the paths. */
function recordingContext() {
  const fills: string[] = [];
  const texts: string[] = [];
  const state: Record<string, unknown> = { canvas: { width: 800, height: 800 }, fillStyle: '#000', strokeStyle: '#000' };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (s: string) => ({ width: s.length * 5 });
      if (key === 'fill' || key === 'fillRect') return () => fills.push(String(target.fillStyle));
      if (key === 'fillText') return (s: string) => texts.push(s);
      if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => undefined;
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, texts };
}

/** Draw the stage once into a recording context. (The walls are drawn into a canvas of their own first: a stand-in document gives one.) */
function drawOnce(sim: Simulation<unknown>) {
  const record = recordingContext();
  const view = fitView(800, 800, sim.game.mat.width, sim.game.mat.height, 1, TABLE_STRIP);
  const mat = { paint: () => undefined } as unknown as MatPainter;
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const standIn = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext().ctx }) };
  Object.defineProperty(globalThis, 'document', { value: standIn, configurable: true, writable: true });
  try {
    drawStage(record.ctx, { sim, view, options: { overlays: true, sensors: false, trail: false }, mat, trail: { points: [] } as never, overlays: sim.game.overlays(sim.scenario), placing: false, ghost: null, ruler: null });
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had);
    else delete (globalThis as { document?: unknown }).document;
  }
  return record;
}

test('stage: the Team Box is drawn on the robot until the referee lifts it, the card only while the referee holds it - in no other game', () => {
  // into the Scan Station, then wait there long enough for the referee
  const stopAt = program([script(whenStart(), [moveCm('forward', 98.2), wait(8)])]);
  const sim = createSimulation({ game: lockerRoomGame, scenario: drawOf('R2'), program: stopAt }) as Simulation<unknown>;
  const BOX = '#f7941d';
  const atStart = drawOnce(sim);
  assert.ok(atStart.fills.includes(BOX), 'the box on the robot before the start');
  assert.ok(atStart.texts.includes('Team Box'));
  assert.ok(!atStart.texts.some((s) => s.endsWith(' card')), 'no card yet');
  sim.start();
  // to the station, then the card
  let shown = false;
  while (sim.status === 'running' && sim.world.time < 30) {
    sim.step(1);
    if ((sim.world.props ?? []).some((p) => p.id === PROP_CARD)) {
      shown = true;
      break;
    }
  }
  assert.ok(shown, `the card was shown (${CARD_SHOW_S} s after the robot stopped)`);
  const withCard = drawOnce(sim);
  assert.ok(withCard.texts.includes('RED card'), withCard.texts.join(' | '));
  assert.ok(withCard.fills.includes(CUBE_FILL.red));
  // the card lies where the engine's colour sensor looks for it: straight ahead of the robot
  const card = (sim.world.props ?? []).find((p) => p.id === PROP_CARD);
  assert.ok(card);
  const box = propBox(card, sim.world.robot.pose);
  const pose = sim.world.robot.pose;
  assert.ok(Math.abs(box.x - (pose.x + card.x * Math.sin(pose.heading))) < 1e-9 && Math.abs(box.y - (pose.y - card.x * Math.cos(pose.heading))) < 1e-9);
  assert.equal(box.angle, pose.heading + card.angle);
  // another game has no props: nothing of the kind is drawn
  const other = createSimulation({ game: warehouseSortGame, scenario: warehouseSortGame.defaultScenario(), program: stopAt }) as Simulation<unknown>;
  assert.equal(other.world.props, undefined);
  const plain = drawOnce(other);
  assert.ok(!plain.fills.includes(BOX) && !plain.texts.includes('Team Box'));
  assert.equal(propBox({ frame: 'mat', x: 10, y: 20, angle: 0.5, w: 3, l: 4 }, START_POSE).x, 10, 'a prop on the mat stays where it is');
});

test('stage: the cubes are drawn as cubes, the RED and GREEN warehouses by their turned outline, the pickup squares and the big circles as they are, the gate is a wall until it opens', () => {
  assert.equal(CUBE_KIND, KIND_CUBE);
  const bodies = lockerRoomGame.createBodies(defaultScenario());
  for (const body of bodies) assert.equal(body.kind, CUBE_KIND);
  assert.deepEqual(bodies.map((body) => body.id).sort(), [teamCubeId('green'), teamCubeId('red'), ...ZONE_IDS.map(tokenId)].sort());
  const overlays = lockerRoomGame.overlays(defaultScenario());
  for (const color of ['red', 'green'] as const) {
    // the warehouse of the colour: turned, so its outline is the zone
    const target = overlays.find((zone) => zone.id === `target:${color}`);
    assert.ok(target?.outline, `${color}: the turned rectangle is the zone`);
    assert.deepEqual(target.outline, markOutline(targetOf(color)));
    assert.equal(MARK_ROLES.target[color].endsWith('Diamond'), true, 'the warehouses of MARK_ROLES');
    // the pickup square: not turned, its rect is the zone
    const pickup = overlays.find((zone) => zone.id === `pickup:${color}`);
    assert.equal(pickup?.outline, undefined, `${color}: a square that is not turned`);
    assert.equal(MARK_ROLES.pickup[color].endsWith('Square'), true, 'the pickup zones of MARK_ROLES');
    assert.ok(pickup && Math.abs(pickup.rect.x + pickup.rect.w / 2 - pickupZone(color).box!.x) < 1e-9);
    const circle = overlays.find((zone) => zone.id === `circle:${color}`);
    assert.equal(circle?.shape, 'ellipse');
    assert.deepEqual(circle?.rect, { x: BIG_CIRCLES[color].cx - BIG_CIRCLES[color].r, y: BIG_CIRCLES[color].cy - BIG_CIRCLES[color].r, w: 2 * BIG_CIRCLES[color].r, h: 2 * BIG_CIRCLES[color].r });
  }
  assert.ok(overlays.some((zone) => zone.id === 'pickup:green' && zone.label === 'Green pickup zone (your team)'), 'the team colour of the draw');
  assert.deepEqual(lockerRoomGame.createWalls?.(defaultScenario()).map((wall) => wall.id), [GATE_ID]);
  // no other game has a zone with an outline
  for (const zone of warehouseSortGame.overlays(warehouseSortGame.defaultScenario())) assert.equal(zone.outline, undefined, zone.id);
});

// =============================================================================================
// The console
// =============================================================================================

test('console: the team cubes, the tokens and the gate have plain names; the names of the other games are as they were', () => {
  assert.equal(bodyName(teamCubeId('red')), 'the RED team cube');
  assert.equal(bodyName(tokenId('B')), 'the token of zone B');
  assert.equal(bodyName(GATE_ID), 'the stadium gate');
  const words = screenWords(LOCKER_ROOM_WORDS);
  const say = (event: Parameters<typeof describeEvent>[0]) => describeEvent(event, { ...restartFacts(lockerRoomGame), match: words.match, grabbed: words.grabbed, tableEdge: words.tableEdge })?.text;
  assert.equal(say({ type: 'grab', bodyId: teamCubeId('green'), time: 20 }), 'Picked up the GREEN team cube.');
  assert.equal(say({ type: 'release', bodyId: tokenId('A'), onto: null, time: 30 }), 'Put down the token of zone A on the mat.');
  assert.equal(say({ type: 'bump', bodyId: GATE_ID, time: 31 }), 'Bumped into the stadium gate.');
  assert.equal(say({ type: 'bump', bodyId: 'wall', time: 32 }), 'Bumped into the edge of the table.');
  // the other games
  assert.equal(bodyName('cube:W2'), 'the W2 cube');
  assert.equal(bodyName('bucket:red'), 'the red bucket');
  assert.equal(bodyName('tower:W1'), 'tower W1');
  assert.equal(bodyName('wall:A1-B1'), 'the wall between A1 and B1');
  assert.equal(bodyName('wall:top'), 'the top wall');
  assert.equal(bodyName('person:green'), 'the green person');
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

test('page: the Locker Room screen hands the general screen its game, robot, examples, rules, words, panel and test lists - and no Restart button', () => {
  const page = code(read('./LockerRoomSimulator.tsx'));
  for (const prop of [
    /\sgame=\{lockerRoomGame\}\s/,
    /\srobotConfig=\{LOCKER_ROOM_ROBOT\}\s/,
    /\stitle="Locker Room"\s/,
    /\sstageMargin=\{TABLE_STRIP\}\s/,
    /\sstartZoneName=\{LOCKER_ROOM_START_ZONE\}\s/,
    /\sexamples=\{EXAMPLES\}\s/,
    /\srules=\{LOCKER_ROOM_RULES\}\s/,
    /\srulesNote=\{LOCKER_ROOM_RULES_NOTE\}\s/,
    /\srulesExtra=\{LOCKER_ROOM_ASSUMPTIONS\}\s/,
    /\swords=\{LOCKER_ROOM_WORDS\}\s/,
    /\sinitialStartPose=\{START_POSE\}\s/,
    /\sshowLastPrint\s/,
    /\srestartButton=\{false\}\s/,
    /\srenderCombinationEditor=\{renderCombinationEditor\}\s/,
    /\sreadCode=\{readCardsCode\}\s/,
    /\sbatchPresets=\{DRAW_BATCH_PRESETS\}\s/,
    /\sbatchRandomLists=\{false\}\s/,
    /\sbatchTieBreak=\{DRAW_TIE_BREAK\}\s/,
    /\sbatchSummaryLabel=\{drawSummaryLabel\}\s/,
  ]) {
    assert.match(page, prop);
  }
  assert.equal(TABLE_STRIP, TABLE_MARGIN);
  assert.ok(TABLE_STRIP > STAGE_MARGIN);
  // the examples: the one address, and the name of this game - nothing else about them
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'locker-room',\s+organisation: 'MakeX Lebanon',/);
  assert.match(page, /<CardsEditor scenario=\{scenario\} onChange=\{onChange\} \/>/);
  // the general screen hands the choice on to the match controls ...
  const app = code(read('../SimulatorApp.tsx'));
  const bar = app.slice(app.indexOf('<ControlBar'), app.indexOf('/>', app.indexOf('<ControlBar')));
  assert.match(bar, /\srestartButton=\{props\.restartButton\}\s/);
  // ... and the other three games pass none of it: their screens are as they were
  for (const other of ['../fire-rescue/FireRescueSimulator.tsx', '../fire-chief/FireChiefSimulator.tsx', '../warehouse-sort/WarehouseSortSimulator.tsx']) {
    assert.ok(!read(other).includes('restartButton'), other);
  }
  // the start pose is the game's, and the game allows no restart
  assert.deepEqual(START_POSE, lockerRoomGame.defaultStartPose);
  assert.deepEqual(lockerRoomGame.restartRules, { maxRestarts: 0 });
});

test('match controls: without a Restart button when the game says so, with it otherwise - everything else the same', () => {
  const props = {
    runState: 'running' as const,
    canStart: true,
    timeLeft: 100,
    score: { total: 0, max: 85, lines: [], complete: false },
    restartPenalty: 0,
    restartRules: { maxRestarts: 0 },
    restartsLeft: 0,
    words: WORDS,
    speed: 1 as const,
    onSpeed: nothing,
    onStart: nothing,
    onStop: nothing,
    onPause: nothing,
    onResume: nothing,
    onRestart: nothing,
    onFinished: nothing,
    onReset: nothing,
  };
  const without = renderToStaticMarkup(createElement(ControlBar, { ...props, restartButton: false }));
  const usual = renderToStaticMarkup(createElement(ControlBar, props));
  assert.ok(!text(without).includes('Restart'), text(without));
  assert.ok(text(usual).includes('Restart'));
  assert.equal(renderToStaticMarkup(createElement(ControlBar, { ...props, restartButton: undefined })), usual, 'left out: as always');
  // the rest of the bar is the same
  assert.equal(without, usual.replace(/<button[^>]*>(?:(?!<\/button>)[^])*Restart(?:(?!<\/button>)[^])*<\/button>/, ''));
  for (const label of ['Start', 'Stop', 'Finished', 'Reset']) assert.ok(text(without).includes(label), label);
});

test('page: its address, title and description; the loader shows the name of the game while the simulator loads', () => {
  const page = read('../../../app/simulator/locker-room/page.tsx');
  assert.match(page, /const PATH = '\/simulator\/locker-room';/);
  assert.match(page, /const TITLE = 'mBot2 simulator — Locker Room';/);
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /return <LockerRoomLoader \/>;/);
  const loader = code(read('./LockerRoomLoader.tsx'));
  assert.match(loader, /<TitleBar title="Locker Room" \/>/);
  assert.match(loader, /dynamic\(\(\) => import\('\.\/LockerRoomSimulator'\), \{\s+ssr: false,/);
  assert.match(read('./LockerRoomLoader.tsx'), /^'use client';/);
  assert.match(read('./LockerRoomSimulator.tsx'), /^'use client';/);
  assert.match(read('./CardsEditor.tsx'), /^'use client';/);
});

test('site: the category of Season 2026 has its simulator - the Simulator page lists it in Season 2026, the sitemap names it', async () => {
  const { seasons, simulatorSeasons } = await import('../../../../content/seasons');
  assert.ok(read('../../../app/sitemap.ts').includes("{ path: '/simulator/locker-room', priority: 0.7 },"));
  const category = seasons.find((season) => season.year === 2026)?.categories.find((c) => c.slug === 'locker-room');
  assert.equal(category?.name, 'Capelli Starter — Locker Room');
  assert.equal(category?.simulator?.href, '/simulator/locker-room');
  assert.equal(category?.simulator?.mat, '/simulator/locker-room/mat.webp');
  // the rules file beside it on the category page is the organiser's newest rules, the ones the simulator follows: the
  // summary and the page's description say so, and nothing calls the file older (v2.3 was replaced: the next test)
  const summary = category?.simulator?.summary ?? '';
  assert.match(summary, /scored by the organiser's newest rules \(the rules file on this website\)\./);
  const description = read('../../../app/simulator/locker-room/page.tsx').replace(/'\s*\+\s*'/g, '');
  assert.match(description, /scored by the organiser’s newest rules \(the rules file on this website\)\./);
  for (const said of [summary, description]) assert.doesNotMatch(said, /v2\.3|older|newer than/);
  assert.deepEqual(
    category?.downloads?.filter((d) => d.kind === 'rules'),
    [{ label: 'Capelli Starter Locker Room Rules', href: '/downloads/capelli-starter-locker-room-rules.pdf', kind: 'rules' }],
  );
  const card = simulatorSeasons().find((section) => section.year === 2026)?.simulators.find((simulator) => simulator.href === '/simulator/locker-room');
  assert.deepEqual(card && [card.name, card.labels, card.about], ['Capelli Starter — Locker Room', ['13–15 years', 'Season 2026'], '/season/2026/locker-room']);
  assert.ok(code(read('../../../app/simulator/page.tsx')).includes('simulatorSeasons()'));
});

test('site: the rules download is a PDF in public/, and the address of the v2.3 file it replaced is a permanent redirect to it', async () => {
  const { seasons } = await import('../../../../content/seasons');
  const href = seasons.find((season) => season.year === 2026)?.categories.find((c) => c.slug === 'locker-room')?.downloads?.find((d) => d.kind === 'rules')?.href;
  assert.equal(href, '/downloads/capelli-starter-locker-room-rules.pdf');
  const fromRoot = (file: string): string => fileURLToPath(new URL(`../../../../${file}`, import.meta.url));
  // the file is there, at that address, and it is a PDF
  const pdf = readFileSync(fromRoot(`public${href}`));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  // ... with a title and no author: a file anybody can download names nobody (README, "Rules, scoresheets and other downloads")
  assert.match(pdf.toString('latin1'), /\/Title[<(]/);
  assert.doesNotMatch(pdf.toString('latin1'), /\/Author[<(]/);
  // the old file is gone: Next.js looks at the redirects before public/, so a file left there could never be opened
  const OLD = '/downloads/capelli-starter-locker-room-rules-v2.3.pdf';
  assert.ok(!existsSync(fromRoot(`public${OLD}`)), 'the v2.3 file is not in public/');
  // the redirect (the real configuration, loaded by its full address as in ../site-section.test.ts)
  const { default: config } = (await import(pathToFileURL(fromRoot('next.config.mjs')).href)) as {
    default: { redirects: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>> };
  };
  const redirects = await config.redirects();
  assert.deepEqual(
    redirects.filter((redirect) => /locker-room-rules/.test(redirect.source + redirect.destination)),
    [{ source: OLD, destination: href, permanent: true }],
  );
  // and no file of the website links the old file any more: only the redirect, the README and this test name it
  const named: string[] = [];
  const walk = (folder: string): void => {
    for (const entry of readdirSync(fromRoot(folder), { withFileTypes: true })) {
      const name = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(name);
      else if (/\.(?:[cm]?[jt]sx?|json|md)$/.test(entry.name) && name !== 'src/simulator/ui/locker-room/screen.test.ts') {
        if (readFileSync(fromRoot(name), 'utf8').includes('capelli-starter-locker-room-rules-v2.3')) named.push(name);
      }
    }
  };
  for (const folder of ['src', 'content', 'scripts']) walk(folder);
  assert.deepEqual(named, []);
});
