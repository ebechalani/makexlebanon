/**
 * The Fire Rescue Junior screen: how a typed code is read (only the 24 Junior codes; a Fire
 * Rescue Senior code is refused in plain words), the words of the screen, the rules window, the
 * Combination panel and its editor (only the buckets can be changed - drawn as the page draws
 * them, and used in a document with jsdom), the test window (all 24 combinations, no random
 * lists), and how the page hands all of it to the general screen. Also what changed for Fire
 * Rescue Senior: its title, and nothing else.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_ROBOT_CONFIG } from '../../core/robot';
import { WATER_TOWER_IDS } from '../../fire-rescue/field';
import { fireRescueGame, startPoseFor } from '../../fire-rescue/game';
import { getSampleProgram } from '../../fire-rescue/samples';
import { defaultScenario, encodeScenario, scenarioFromIndex, type FireRescueScenario } from '../../fire-rescue/scenario';
import { fireRescueJuniorGame } from '../../fire-rescue-junior/game';
import { allJuniorScenarios, encodeJuniorScenario, isJuniorScenario, juniorScenarioFromIndex } from '../../fire-rescue-junior/scenario';
import { fireChiefGame } from '../../fire-chief/game';
import { lockerRoomGame } from '../../locker-room/game';
import { moveCm, program, script, whenStart } from '../../vm/builder';
import { warehouseSortGame } from '../../warehouse-sort/game';
import { CombinationPanel } from '../CombinationPanel';
import { blankProgram, gameName, otherGameNote, parseProgramFile, serializeProgramFile } from '../program-file';
import { storageKey } from '../storage';
import { FIRE_RESCUE_RULES, FIRE_RESCUE_SCORING_RULES } from '../fire-rescue/rules';
import { DEFAULT_WORDS, screenWords } from '../screen-words';
import { JuniorCombinationEditor } from './CombinationEditor';
import { EARLIER_BLOCKS_NOTE, earlierBlocksNote, holdsBlocks } from './earlier-blocks';
import { JUNIOR_BATCH_PRESETS } from './junior-batch';
import { DEFAULT_JUNIOR_CODE, readJuniorCode } from './junior-code';
import { FIRE_RESCUE_JUNIOR_RULES } from './rules';
import { FIRE_RESCUE_JUNIOR_WORDS } from './words';

const WORDS = screenWords(FIRE_RESCUE_JUNIOR_WORDS);
const nothing = (): void => undefined;
const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
/** The source without its comments (a comment may name a prop it does not pass). */
const code = (source: string): string =>
  source
    .replace(/\/\*[^]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const LOOKS_LIKE = 'A Fire Rescue Junior code is the four bucket colours on W1 to W4, like RGBY (R red, G green, B blue, Y yellow).';

// =============================================================================================
// The code field
// =============================================================================================

test('code: the 24 Junior codes are read, in any letter case and with any separators', () => {
  assert.equal(DEFAULT_JUNIOR_CODE, encodeJuniorScenario(defaultScenario()));
  for (const s of allJuniorScenarios()) {
    const typed = encodeJuniorScenario(s);
    assert.deepEqual(readJuniorCode(typed), { ok: true, scenario: s });
    assert.deepEqual(readJuniorCode(` ${typed.toLowerCase().split('').join(' - ')} `), { ok: true, scenario: s });
  }
});

test('code: a Fire Rescue Senior code is refused in plain words - also one whose people stand as in the rule book', () => {
  // people moved: refused, and the sentence says why
  const moved = encodeScenario(scenarioFromIndex(1234));
  assert.ok(!isJuniorScenario(scenarioFromIndex(1234)));
  assert.deepEqual(readJuniorCode(moved), {
    ok: false,
    problem: `This is a Fire Rescue Senior code. In Fire Rescue Junior only the buckets are drawn, and the people always stand where the rule book shows them. ${LOOKS_LIKE}`,
  });
  // the Senior code of a Junior combination: refused too, with the four letters to type instead
  assert.deepEqual(readJuniorCode('GRYB-A1R-B1B-C1Y-D1G'), {
    ok: false,
    problem: 'This is a Fire Rescue Senior code. A Fire Rescue Junior code has only the four bucket letters: for these buckets, type GRYB.',
  });
  assert.equal(readJuniorCode(encodeScenario(defaultScenario())).ok, false);
  // every Senior code is refused
  for (let i = 0; i < 9216; i += 13) assert.equal(readJuniorCode(encodeScenario(scenarioFromIndex(i))).ok, false, encodeScenario(scenarioFromIndex(i)));
});

test('code: a number is no code - the same sentence as any other text, and not a word about Senior codes', () => {
  // (Fire Rescue Senior reads a number from 0 to 9215 too, but its screen never shows one: a student who
  // types "12" for "combination 12" could not know that it is one; 9216 and above were refused like any text)
  for (const typed of ['0', '1', '7', '12', '17', '23', '24', '00', ' 7 ', '1234', '9215', '9216', '123456']) {
    assert.deepEqual(readJuniorCode(typed), { ok: false, problem: `"${typed.trim()}" is not a Fire Rescue Junior code. ${LOOKS_LIKE}` }, typed);
  }
  assert.deepEqual(readJuniorCode('-1'), { ok: false, problem: `"-1" is not a Fire Rescue Junior code. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('9'.repeat(40)), { ok: false, problem: `"${'9'.repeat(29)}…" is not a Fire Rescue Junior code. ${LOOKS_LIKE}` });
});

test('code: a colour twice, three or four times, no code at all, and odd texts get one plain sentence each - and never an exception', () => {
  assert.deepEqual(readJuniorCode('RRBY'), { ok: false, problem: `In "RRBY" red is there twice. Every bucket colour is there once. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('bbyy'), { ok: false, problem: `In "bbyy" blue and yellow are there twice. Every bucket colour is there once. ${LOOKS_LIKE}` });
  // as many times as it is there
  assert.deepEqual(readJuniorCode('RRRB'), { ok: false, problem: `In "RRRB" red is there three times. Every bucket colour is there once. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('g-y-g-g'), { ok: false, problem: `In "g-y-g-g" green is there three times. Every bucket colour is there once. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('RRRR'), { ok: false, problem: `In "RRRR" red is there four times. Every bucket colour is there once. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('yyyy'), { ok: false, problem: `In "yyyy" yellow is there four times. Every bucket colour is there once. ${LOOKS_LIKE}` });
  // every four letters of R, G, B, Y: a code, or a sentence that counts right
  const LETTERS = ['R', 'G', 'B', 'Y'];
  const NAMES: Record<string, string> = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };
  const WORD: Record<number, string> = { 2: 'twice', 3: 'three times', 4: 'four times' };
  for (let n = 0; n < 4 ** 4; n++) {
    const typed = [0, 1, 2, 3].map((i) => LETTERS[Math.floor(n / 4 ** i) % 4]).join('');
    const reading = readJuniorCode(typed);
    const more = LETTERS.filter((letter) => typed.split(letter).length - 1 > 1);
    if (more.length === 0) {
      assert.equal(reading.ok, true, typed);
      continue;
    }
    assert.equal(reading.ok, false, typed);
    if (reading.ok) continue;
    // (the first sentence: "In "RRRG" red is there three times")
    const [said, rest] = reading.problem.split('. Every bucket colour is there once. ');
    assert.equal(rest, LOOKS_LIKE, typed);
    for (const letter of LETTERS) assert.equal(said.includes(NAMES[letter]), more.includes(letter), `${typed}: ${said}`);
    for (const letter of more) assert.ok(said.endsWith(` there ${WORD[typed.split(letter).length - 1]}`), `${typed}: ${said}`);
  }
  assert.deepEqual(readJuniorCode('hello'), { ok: false, problem: `"hello" is not a Fire Rescue Junior code. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('RGB'), { ok: false, problem: `"RGB" is not a Fire Rescue Junior code. ${LOOKS_LIKE}` });
  assert.deepEqual(readJuniorCode('   '), { ok: false, problem: `Type a code into the field. ${LOOKS_LIKE}` });
  // a long text is quoted cut short
  const long = readJuniorCode('x'.repeat(5000));
  assert.ok(!long.ok && long.problem.startsWith(`"${'x'.repeat(29)}…" is not a Fire Rescue Junior code.`), JSON.stringify(long).slice(0, 80));
  for (const odd of ['\u0000', '-', 'RGBY-', 'R-G-B-Y-A1R', '__proto__', 'constructor']) assert.doesNotThrow(() => readJuniorCode(odd), odd);
  assert.deepEqual(readJuniorCode('R-G-B-Y'), { ok: true, scenario: defaultScenario() });
});

// =============================================================================================
// Words, rules, test lists
// =============================================================================================

test('words: the panel says that 24 combinations are possible and that the people do not move; everything else as in Fire Rescue', () => {
  assert.deepEqual(Object.keys(FIRE_RESCUE_JUNIOR_WORDS).sort(), ['randomHint', 'scenarioNote']);
  assert.equal(
    WORDS.scenarioNote,
    '24 combinations are possible: only the buckets on W1 to W4 change. The people always stand where the rule book shows them. Changing the combination puts the field back to the start.',
  );
  assert.equal(WORDS.randomHint, 'Draw where the four buckets stand, like the referee does. The people stay where the rule book shows them.');
  for (const key of Object.keys(DEFAULT_WORDS) as Array<keyof typeof DEFAULT_WORDS>) {
    if (key !== 'randomHint' && key !== 'scenarioNote') assert.equal(WORDS[key], DEFAULT_WORDS[key], key);
  }
});

test('rules: Junior says what is drawn - only the buckets, 24 draws - and that everything else stands where the rule book shows it; the rest is Senior\'s, word for word', () => {
  assert.equal(FIRE_RESCUE_JUNIOR_RULES[0].title, 'The field');
  const field = FIRE_RESCUE_JUNIOR_RULES[0].items.join(' ');
  assert.match(field, /the referee draws only which bucket stands on which water tower: there are 24 possible draws\./);
  assert.match(field, /Everything else always stands where the rule book shows it, as the organiser decided for Fire Rescue Junior\./);
  assert.match(field, /always in the left white dashed square \(square 1\): red at A, blue at B, yellow at C, green at D\./);
  // nothing that says a person is drawn
  assert.ok(!/where each person stands|which colour it is|left \(1\) or right \(2\)/.test(field), field);
  // the first two lines are Senior's, and so is everything after "The field"
  assert.deepEqual(FIRE_RESCUE_JUNIOR_RULES[0].items.slice(0, 2), FIRE_RESCUE_RULES[0].items.slice(0, 2));
  assert.deepEqual(FIRE_RESCUE_JUNIOR_RULES.slice(1), FIRE_RESCUE_SCORING_RULES);
  assert.deepEqual(FIRE_RESCUE_RULES.slice(1), FIRE_RESCUE_SCORING_RULES);
});

test('rules: Fire Rescue Senior keeps the rules text of the Fire Rescue page letter for letter', () => {
  // (the fingerprint of FIRE_RESCUE_RULES at b4d7f80, before the split)
  const fingerprint = createHash('sha256').update(JSON.stringify(FIRE_RESCUE_RULES)).digest('hex');
  assert.equal(fingerprint, '1a176b5765587caf1a79a4b17d56906cc3aebb52bca2fb07200f592fcf7a7620');
  assert.match(FIRE_RESCUE_RULES[0].items[3], /^Before the match the referee draws the combination: which bucket is on which water tower, where each person stands and which colour it is\.$/);
});

test('test lists: all 24 Junior combinations in number order, or the one on the stage - nothing that moves a person', () => {
  assert.deepEqual(
    JUNIOR_BATCH_PRESETS.map((preset) => [preset.id, preset.label]),
    [
      ['all-combinations', 'All 24 combinations'],
      ['this-combination', 'This combination'],
    ],
  );
  const current = juniorScenarioFromIndex(9);
  const all = JUNIOR_BATCH_PRESETS[0].scenarios(current);
  assert.deepEqual(all, allJuniorScenarios());
  for (const s of all) assert.ok(isJuniorScenario(s));
  assert.deepEqual(JUNIOR_BATCH_PRESETS[1].scenarios(current), [current]);
  assert.equal(JUNIOR_BATCH_PRESETS[0].hint, 'Every way the referee can put the four buckets on W1 to W4. The people stand where the rule book shows them. 24 matches.');
});

// =============================================================================================
// The Combination panel
// =============================================================================================

test('panel: drawn as the page draws it - the four-letter code, the buckets to choose, the people as a list without buttons', () => {
  const scenario = juniorScenarioFromIndex(7);
  const html = renderToStaticMarkup(
    createElement(CombinationPanel<FireRescueScenario>, {
      game: fireRescueJuniorGame,
      scenario,
      onChange: nothing,
      words: WORDS,
      readCode: readJuniorCode,
      children: createElement(JuniorCombinationEditor, { scenario, onChange: nothing }),
    }),
  );
  const seen = text(html);
  assert.ok(seen.startsWith('GRYB'), seen.slice(0, 40));
  assert.ok(html.includes('aria-label="Combination code GRYB"'));
  assert.ok(html.includes('placeholder="RGBY"'), 'the field shows what a code looks like');
  assert.ok(seen.includes(WORDS.scenarioNote ?? '-'));
  // one radio group per water tower, with its four colours
  for (const tower of WATER_TOWER_IDS) {
    assert.ok(html.includes(`aria-label="Bucket on water tower ${tower}"`), tower);
    assert.match(html, new RegExp(`<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*aria-label="${scenario.buckets[tower]}"`));
  }
  assert.equal(html.match(/role="radio"/g)?.length, 16, 'four colours for each of the four buckets, and nothing else to choose');
  // the people: a list, no buttons, no square to choose
  assert.ok(!html.includes('Square of the person'), 'no square to choose');
  assert.ok(!html.includes('Colour of the person'), 'no colour of a person to choose');
  const people = html.slice(html.indexOf('data-fixed-people'), html.indexOf('</div>', html.indexOf('data-fixed-people')));
  assert.ok(!people.includes('<button'), 'no button among the people');
  assert.deepEqual(
    [...text(people).matchAll(/([ABCD]) [RGBY] (\w+) person in square (\d)/g)].map((m) => `${m[1]}${m[3]} ${m[2]}`),
    ['A1 red', 'B1 blue', 'C1 yellow', 'D1 green'],
  );
  assert.ok(seen.includes('People at the buildings'));
  assert.ok(seen.includes('In Fire Rescue Junior only the buckets are drawn. The people always stand where the rule book shows them'));
  // one "Random" button (the game's own draw) and "Default"
  assert.ok(html.includes(`title="${WORDS.randomHint}"`));
  assert.ok(seen.includes('Random') && seen.includes('Default'));
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

test('panel in a document: Random only moves buckets, a colour swaps two buckets, a Senior code is refused, a Junior code and Default work', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act, useState } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const changes: FireRescueScenario[] = [];
  function Panel() {
    const [scenario, setScenario] = useState<FireRescueScenario>(defaultScenario());
    const onChange = (next: FireRescueScenario) => {
      changes.push(next);
      setScenario(next);
    };
    return createElement(CombinationPanel<FireRescueScenario>, {
      game: fireRescueJuniorGame,
      scenario,
      onChange,
      words: WORDS,
      readCode: readJuniorCode,
      children: createElement(JuniorCombinationEditor, { scenario, onChange }),
    });
  }
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => root.render(createElement(Panel)));
  const click = async (el: HTMLElement) => act(async () => el.click());
  const button = (label: string): HTMLElement => [...document.querySelectorAll('button')].find((b) => textOf(b) === label) as HTMLElement;
  const shown = (): string => textOf(document.querySelector('[aria-label^="Combination code"]'));

  // "Random", many times: only the buckets change, and many different draws come up
  for (let i = 0; i < 60; i++) await click(button('Random'));
  assert.equal(changes.length, 60);
  for (const s of changes) {
    assert.ok(isJuniorScenario(s), encodeScenario(s));
    assert.deepEqual(s.people, defaultScenario().people);
  }
  assert.ok(new Set(changes.map(encodeJuniorScenario)).size >= 10, 'different draws');
  assert.match(shown(), /^[RGBY]{4}$/);

  // Default: the rule book
  await click(button('Default'));
  assert.equal(shown(), 'RGBY');
  // a colour for a bucket swaps it with the tower that had it
  const chip = (tower: string, color: string): HTMLElement =>
    document.querySelector(`[aria-label="Bucket on water tower ${tower}"] [aria-label="${color}"]`) as HTMLElement;
  await click(chip('W1', 'yellow'));
  assert.equal(shown(), 'YGBR');
  assert.ok(isJuniorScenario(changes[changes.length - 1]));
  // the only buttons of the panel: copy, Random, Default, 16 colour chips, Use
  assert.deepEqual(
    [...document.querySelectorAll('button')].filter((b) => b.getAttribute('role') !== 'radio').map((b) => b.getAttribute('aria-label') ?? textOf(b)),
    ['Copy the combination code', 'Random', 'Default', 'Use'],
  );
  assert.equal(document.querySelectorAll('button[role="radio"]').length, 16);

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
  const error = (): string | null => {
    const el = document.getElementById('combination-code-error');
    return el ? textOf(el) : null;
  };
  const before = changes.length;
  await type('RGBY-A2R-B1B-C1Y-D2G');
  assert.equal(error(), `This is a Fire Rescue Senior code. In Fire Rescue Junior only the buckets are drawn, and the people always stand where the rule book shows them. ${LOOKS_LIKE}`);
  assert.equal(shown(), 'YGBR', 'nothing changed');
  await type('bgry-a1r-b1b-c1y-d1g');
  assert.equal(error(), 'This is a Fire Rescue Senior code. A Fire Rescue Junior code has only the four bucket letters: for these buckets, type BGRY.');
  await type('1234');
  assert.equal(error(), `"1234" is not a Fire Rescue Junior code. ${LOOKS_LIKE}`);
  await type('RRRR');
  assert.equal(error(), `In "RRRR" red is there four times. Every bucket colour is there once. ${LOOKS_LIKE}`);
  assert.equal(changes.length, before, 'no refused code changed the combination');
  await type('b g r y');
  assert.equal(error(), null);
  assert.equal(shown(), 'BGRY');
  assert.ok(isJuniorScenario(changes[changes.length - 1]));

  await act(async () => root.unmount());
});

test('test window in a document: no random lists, "All 24 combinations" chosen - every Junior combination played once, and nothing else', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { BatchDialog } = await import('../BatchDialog');
  const oneBucket = getSampleProgram('one-bucket')?.program;
  assert.ok(oneBucket);
  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => {
    root.render(
      createElement(BatchDialog<FireRescueScenario>, {
        game: fireRescueJuniorGame,
        robotConfig: DEFAULT_ROBOT_CONFIG,
        getProgram: () => oneBucket,
        startPose: startPoseFor(DEFAULT_ROBOT_CONFIG),
        getSampler: () => undefined,
        currentScenario: defaultScenario(),
        presets: JUNIOR_BATCH_PRESETS,
        randomLists: false,
        words: WORDS,
        onPick: nothing,
        onClose: nothing,
      }),
    );
  });
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
  assert.deepEqual(
    radios.map((r) => textOf(r.closest('label')?.querySelector('.font-semibold'))),
    ['All 24 combinations', 'This combination'],
    'only the two lists of the game: no random lists',
  );
  assert.equal(radios[0].checked, true);
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
  assert.deepEqual(rows.map((cells) => cells[1]), allJuniorScenarios().map(encodeJuniorScenario), 'every Junior combination once, in number order');
  // "Deliver one bucket" takes the bucket of W1 to A: 20 points where it is the red one
  for (const cells of rows) assert.equal(cells[2], cells[1].startsWith('R') ? '20' : '0', cells[1]);

  await act(async () => root.unmount());
});

// =============================================================================================
// The page
// =============================================================================================

test('page: the Junior screen hands the general screen its game, the Fire Rescue robot and examples, and its own rules, words, panel, codes and test lists', () => {
  const page = code(read('./FireRescueJuniorSimulator.tsx'));
  for (const prop of [
    /\sgame=\{fireRescueJuniorGame\}\s/,
    /\srobotConfig=\{DEFAULT_ROBOT_CONFIG\}\s/,
    /\stitle="Fire Rescue Junior"\s/,
    /\stitleWrapsOnPhone\s/,
    /\sstartZoneName="Fire Station"\s/,
    /\sexamples=\{EXAMPLES\}\s/,
    /\srules=\{FIRE_RESCUE_JUNIOR_RULES\}\s/,
    /\swords=\{FIRE_RESCUE_JUNIOR_WORDS\}\s/,
    /\sinitialStartPose=\{START_POSE\}\s/,
    /\srenderCombinationEditor=\{renderCombinationEditor\}\s/,
    /\semptyWorkspaceNote=\{earlierBlocksNote\}\s/,
    /\sreadCode=\{readJuniorCode\}\s/,
    /\sbatchPresets=\{JUNIOR_BATCH_PRESETS\}\s/,
    /\sbatchRandomLists=\{false\}\s/,
  ]) {
    assert.match(page, prop);
  }
  // no random draws of its own: the one "Random" button draws the game's randomScenario (the 24)
  assert.ok(!page.includes('randomDraws'));
  assert.ok(!page.includes('batchRandom='));
  assert.match(page, /<JuniorCombinationEditor scenario=\{scenario\} onChange=\{onChange\} \/>/);
  // the examples: those of Fire Rescue, through the same lock - the request names 'fire-rescue'
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'fire-rescue',\s+organisation: 'MakeX Lebanon',/);
  assert.match(code(read('../fire-rescue/FireRescueSimulator.tsx')), /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'fire-rescue',\s+organisation: 'MakeX Lebanon',/);
  // the robot starts where it starts in Senior
  assert.match(page, /const START_POSE = startPoseFor\(DEFAULT_ROBOT_CONFIG\);/);
  assert.match(read('./FireRescueJuniorSimulator.tsx'), /^'use client';/);
});

test('page: the address, title and description of each page; each loader shows its own title while the simulator loads', async () => {
  const pages: Array<[folder: string, title: string, age: RegExp, loader: string, screen: string]> = [
    ['fire-rescue-junior', 'Fire Rescue Junior', /ages 10–12\.$/, '../fire-rescue-junior/FireRescueJuniorLoader.tsx', 'FireRescueJuniorSimulator'],
    ['fire-rescue-senior', 'Fire Rescue Senior', /ages 13–15\.$/, '../fire-rescue/FireRescueLoader.tsx', 'FireRescueSimulator'],
  ];
  for (const [folder, title, age, loaderFile, screen] of pages) {
    const { metadata } = (await import(`../../../app/simulator/${folder}/page`)) as {
      metadata: { title?: string; description?: string; alternates?: { canonical?: string }; openGraph?: { url?: string; title?: string } };
    };
    assert.equal(metadata.title, `mBot2 simulator — ${title}`);
    assert.equal(metadata.alternates?.canonical, `/simulator/${folder}`);
    assert.equal(metadata.openGraph?.url, `/simulator/${folder}`);
    assert.equal(metadata.openGraph?.title, metadata.title);
    assert.match(metadata.description ?? '', age);
    assert.ok(!/11–13/.test(metadata.description ?? ''), 'not the old age group');
    const loader = code(read(loaderFile));
    assert.match(loader, new RegExp(`<TitleBar title="${title}" wrapOnPhone />`));
    assert.match(loader, new RegExp(`dynamic\\(\\(\\) => import\\('\\./${screen}'\\), \\{\\s+ssr: false,`));
  }
  const { metadata: junior } = (await import('../../../app/simulator/fire-rescue-junior/page')) as { metadata: { description?: string } };
  assert.match(junior.description ?? '', /24 ways the referee could draw them and everything else where the rule book shows it/);
});

test('Senior: the same screen as the Fire Rescue page had - only its title changed', () => {
  const now = code(read('../fire-rescue/FireRescueSimulator.tsx'));
  assert.match(now, /\sgame=\{fireRescueGame\}\s/);
  assert.match(now, /\stitle="Fire Rescue Senior"\s/);
  assert.match(now, /\stitleWrapsOnPhone\s/);
  assert.match(now, /\srules=\{FIRE_RESCUE_RULES\}\s/);
  assert.match(now, /\sbatchPresets=\{BATCH_PRESETS\}\s/);
  // the editor of every part of a combination, the default words, the game's own code reader
  assert.match(now, /<CombinationEditor scenario=\{scenario\} onChange=\{onChange\} \/>/);
  for (const prop of ['readCode', 'words=', 'batchRandomLists', 'randomDraws', 'emptyWorkspaceNote']) assert.ok(!now.includes(prop), prop);
  assert.equal(fireRescueGame.id, 'fire-rescue');
});

// =============================================================================================
// After the split: what the screens say about the two Fire Rescue pages
// =============================================================================================

/** Run `body` with a localStorage of its own (Node has none); give it what the browser keeps. */
function withStorage(kept: Record<string, string>, body: (store: Map<string, string>) => void): void {
  const store = new Map(Object.entries(kept));
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  try {
    body(store);
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test('earlier blocks: the sentence for an empty Junior workspace says where the blocks of the Fire Rescue page are - only when this browser keeps some', () => {
  assert.equal(
    EARLIER_BLOCKS_NOTE,
    'Did you make blocks on the Fire Rescue page before? They are on the Fire Rescue Senior page now. To use them here, press Save there, then Open here.',
  );
  // (the Fire Rescue page kept its blocks under the id of its game, and Senior has that id)
  const SENIOR = storageKey(fireRescueGame.id, 'workspace');
  assert.equal(SENIOR, 'mbot2-sim:fire-rescue:workspace');
  const blocks = JSON.stringify(program([script(whenStart(), [moveCm('forward', 10)])]));
  // nothing kept, or a new workspace (the yellow start block alone): nothing to say
  withStorage({}, () => assert.equal(earlierBlocksNote(), null));
  withStorage({ [SENIOR]: JSON.stringify(blankProgram()) }, () => assert.equal(earlierBlocksNote(), null));
  // a program: the sentence - and nothing is written, nothing of Senior's is changed
  withStorage({ [SENIOR]: blocks }, (store) => {
    assert.equal(earlierBlocksNote(), EARLIER_BLOCKS_NOTE);
    assert.deepEqual([...store.entries()], [[SENIOR, blocks]]);
  });
  // blocks without a start block are blocks too; an empty workspace is not
  assert.equal(holdsBlocks({ blocks: { languageVersion: 0, blocks: [{ type: 'mbot2_move_cm', id: 'x' }] } }), true);
  assert.equal(holdsBlocks(program([script(whenStart(), [])])), false);
  assert.equal(holdsBlocks({ blocks: { languageVersion: 0, blocks: [] } }), false);
  assert.equal(holdsBlocks({}), false);
  // Junior's own blocks are not the ones of the Fire Rescue page
  withStorage({ [storageKey(fireRescueJuniorGame.id, 'workspace')]: blocks }, () => assert.equal(earlierBlocksNote(), null));
  // a damaged save, or storage the browser does not allow: never an exception, nothing to say
  for (const bad of ['{', 'null', '[]', '"x"', '{"blocks":{"blocks":[{"type":"x","inputs":{"A":null}}]}}']) {
    withStorage({ [SENIOR]: bad }, () => assert.equal(earlierBlocksNote(), null, bad));
  }
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      throw new Error('blocked');
    },
    configurable: true,
  });
  try {
    assert.equal(earlierBlocksNote(), null);
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('earlier blocks: the general screen says the sentence once, when the editor is ready with an empty workspace; no other screen passes one', () => {
  const app = code(read('../SimulatorApp.tsx'));
  // read once, when the screen is made
  assert.match(app, /const \[emptyWorkspaceNote\] = useState\(\(\) => props\.emptyWorkspaceNote\?\.\(\) \?\? null\);/);
  // said once, as a message (long enough to read three sentences), when the editor is ready - only with no block but the start block
  assert.match(
    app,
    /const emptyNoteSaid = useRef\(false\);\s+useEffect\(\(\) => \{\s+if \(!editorReady \|\| emptyNoteSaid\.current\) return;\s+emptyNoteSaid\.current = true;\s+if \(emptyWorkspaceNote && editorStatus\.blocks <= 1\) say\(emptyWorkspaceNote, 'info', 20000\);\s+\}, \[editorReady, editorStatus\.blocks, emptyWorkspaceNote, say\]\);/,
  );
  assert.equal(app.split('emptyWorkspaceNote').length - 1, 6, 'the prop, the state, the effect: nowhere else');
  // (the editor reports its blocks before it says it is ready: the count is the one of the blocks it showed)
  assert.match(code(read('../BlocklyEditor.tsx')), /propsRef\.current\.onStatus\?\.\(status\(\)\);\s+propsRef\.current\.onReady\(handle\);/);
  // Junior is the only screen that passes one
  for (const screen of ['../fire-rescue/FireRescueSimulator.tsx', '../fire-chief/FireChiefSimulator.tsx', '../warehouse-sort/WarehouseSortSimulator.tsx', '../locker-room/LockerRoomSimulator.tsx']) {
    assert.ok(!read(screen).includes('emptyWorkspaceNote'), screen);
  }
});

test('program files: a note in another game names a game as the title row of its page does - a Senior file says "Fire Rescue Senior"', () => {
  const screens: Array<[file: string, id: string]> = [
    ['./FireRescueJuniorSimulator.tsx', fireRescueJuniorGame.id],
    ['../fire-rescue/FireRescueSimulator.tsx', fireRescueGame.id],
    ['../fire-chief/FireChiefSimulator.tsx', fireChiefGame.id],
    ['../warehouse-sort/WarehouseSortSimulator.tsx', warehouseSortGame.id],
    ['../locker-room/LockerRoomSimulator.tsx', lockerRoomGame.id],
  ];
  for (const [file, id] of screens) {
    const title = /\stitle="([^"]+)"\s/.exec(code(read(file)))?.[1];
    assert.ok(title, file);
    assert.equal(gameName(id), title, `${file}: the game ${id}`);
  }
  // a file saved on Senior - or on the Fire Rescue page before the split: the same id - in the other games
  const saved = parseProgramFile(serializeProgramFile(fireRescueGame.id, program([script(whenStart(), [moveCm('forward', 10)])])));
  assert.ok(saved.ok);
  for (const other of [fireChiefGame.id, warehouseSortGame.id, lockerRoomGame.id]) {
    assert.match(otherGameNote(saved.program, saved.game, other) ?? '', /^This program was saved in the Fire Rescue Senior simulator\. /, other);
  }
  // between Junior and Senior: nothing to say, either way
  assert.equal(otherGameNote(saved.program, saved.game, fireRescueJuniorGame.id), null);
  assert.equal(otherGameNote(saved.program, fireRescueJuniorGame.id, fireRescueGame.id), null);
});

test('the other screens: no sentence of a Rules window or of the screen names a "Fire Rescue simulator" or "Fire Rescue page" - there are two now', async () => {
  const modules: Array<[name: string, module: Record<string, unknown>]> = [
    ['fire-rescue rules', await import('../fire-rescue/rules')],
    ['fire-rescue-junior rules', await import('./rules')],
    ['fire-rescue-junior words', await import('./words')],
    ['fire-chief rules', await import('../fire-chief/rules')],
    ['fire-chief words', await import('../fire-chief/words')],
    ['warehouse-sort rules', await import('../warehouse-sort/rules')],
    ['warehouse-sort words', await import('../warehouse-sort/words')],
    ['locker-room rules', await import('../locker-room/rules')],
    ['locker-room words', await import('../locker-room/words')],
    ['fire-cadet rules', await import('../fire-cadet/rules')],
    ['fire-cadet words', await import('../fire-cadet/words')],
    ['screen words', await import('../screen-words')],
  ];
  const found: string[] = [];
  let texts = 0;
  for (const [name, module] of modules) {
    const seen = new Set<unknown>();
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        texts++;
        if (/\bFire Rescue (?:simulator|page)\b/.test(value)) found.push(`${name}: ${value}`);
      } else if (value !== null && typeof value === 'object' && !seen.has(value)) {
        seen.add(value);
        for (const inner of Object.values(value)) walk(inner);
      }
    };
    walk(module);
  }
  assert.ok(texts > 300, `${texts} texts read`);
  assert.deepEqual(found, []);
  // the robot of Warehouse Sort is the one of both Fire Rescue categories
  const { WAREHOUSE_SORT_ASSUMPTIONS } = await import('../warehouse-sort/rules');
  const robot = WAREHOUSE_SORT_ASSUMPTIONS.sections.find((section) => section.title === 'The robot');
  assert.match(robot?.items[0] ?? '', /^It is the mBot2 of Fire Rescue Junior and Senior, with the gripper at the front: /);
});
