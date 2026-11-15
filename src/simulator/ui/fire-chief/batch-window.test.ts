/**
 * "Test on many mazes" as a student uses it: the window drawn into a document of jsdom (it comes
 * along with Blockly), a click on one of the two kinds of random competition mazes and on "Run
 * the test" - and the wiring of the page that hands the window, and the Maze panel, the random
 * draws of Fire Chief (./FireChiefSimulator.tsx, ../SimulatorApp.tsx).
 *
 * (The markup of the window without a click is tested in ./maze.test.ts.)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fireChiefGame } from '../../fire-chief/game';
import { FIRE_CHIEF_ROBOT, START_POSE } from '../../fire-chief/robot';
import { COMPETITION_WALL_COUNTS, defaultScenario, encodeScenario, type FireChiefScenario } from '../../fire-chief/scenario';
import { blankProgram } from '../program-file';
import { screenWords } from '../screen-words';
import { MAZE_BATCH_PRESETS, MAZE_BATCH_RANDOM, RANDOM_MAZE_KINDS } from './maze-batch';
import { FIRE_CHIEF_WORDS } from './words';

/** Give Node the few browser globals React needs to draw into a document; false without jsdom (the test is then skipped). */
function withDom(): boolean {
  let JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> };
  try {
    ({ JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: typeof JSDOM });
  } catch {
    return false;
  }
  const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'Event', 'MouseEvent', 'KeyboardEvent',
    'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']; // prettier-ignore
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return true;
}

test('test window: the kind chosen beside the seed is the kind that is tested, and the results say which kind they come from', async (t) => {
  if (!withDom()) {
    t.skip('jsdom is not installed');
    return;
  }
  // (loaded once the document is there: React's DOM part looks for it when it is loaded)
  const { act, createElement } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { BatchDialog } = await import('../BatchDialog');

  const root = createRoot(document.getElementById('root') as HTMLElement);
  await act(async () => {
    root.render(
      createElement(BatchDialog<FireChiefScenario>, {
        game: fireChiefGame,
        robotConfig: FIRE_CHIEF_ROBOT,
        getProgram: () => blankProgram(),
        startPose: START_POSE,
        getSampler: () => undefined,
        currentScenario: defaultScenario(),
        presets: MAZE_BATCH_PRESETS,
        random: MAZE_BATCH_RANDOM,
        words: screenWords(FIRE_CHIEF_WORDS),
        onPick: () => undefined,
        onClose: () => undefined,
      }),
    );
  });

  const textOf = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  /** the radio button whose words begin with `words` */
  const radio = (words: string): HTMLInputElement => {
    const label = [...document.querySelectorAll('label')].find((l) => textOf(l).startsWith(words));
    const input = label?.querySelector('input[type="radio"]');
    assert.ok(input instanceof HTMLInputElement, `a radio button "${words}"`);
    return input;
  };
  const click = async (el: HTMLElement): Promise<void> => {
    await act(async () => {
      el.click();
    });
  };
  const runButton = (): HTMLElement => {
    const found = [...document.querySelectorAll('button')].find((b) => /^(Run the test|Run again)$/.test(textOf(b)));
    assert.ok(found, 'the button "Run the test"');
    return found;
  };
  const progress = (): string => textOf(document.querySelector('[aria-live="polite"]'));
  /** run, and wait (in real time: the window works in short slices) until all `count` runs are done */
  const runAll = async (count: number): Promise<void> => {
    await click(runButton());
    for (let i = 0; i < 4000 && !(progress() === `${count} / ${count}` && textOf(runButton()) === 'Run again'); i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    }
    assert.equal(progress(), `${count} / ${count}`);
  };
  /** the codes in the table of every run, in the order of the list */
  const codes = (): string[] => [...document.querySelectorAll('tbody tr')].map((row) => textOf(row.querySelectorAll('td')[1]));
  const wallsOf = (code: string): number => {
    const maze = fireChiefGame.decodeScenario(code);
    assert.ok(maze, code);
    return maze.walls.filter(Boolean).length;
  };
  /** what the window says about the kind the results come from (null: it says nothing) */
  const ranKind = (): string | null => {
    const el = document.querySelector('[data-batch-ran-kind]');
    return el ? textOf(el) : null;
  };

  const [fewer, more] = COMPETITION_WALL_COUNTS;
  const [fewerKind, moreKind] = RANDOM_MAZE_KINDS;
  const named = (kind: (typeof RANDOM_MAZE_KINDS)[number]): string => `${MAZE_BATCH_RANDOM.kindsLegend} ${kind.label}`;

  await click(radio('10 random competition mazes'));
  assert.equal(radio(fewerKind.label).checked, true, 'the first kind is chosen when the window opens');
  assert.equal(ranKind(), null, 'nothing has run yet');

  // the second kind: the list it draws for this seed is the list that is tested
  await click(radio(moreKind.label));
  assert.deepEqual([radio(fewerKind.label).checked, radio(moreKind.label).checked], [false, true]);
  await runAll(10);
  assert.deepEqual(codes(), moreKind.draw(10, 1).map(encodeScenario));
  assert.deepEqual(codes().map(wallsOf), Array<number>(10).fill(more));
  assert.equal(ranKind(), named(moreKind));
  assert.equal(ranKind(), 'Competition mazes with 16 inner walls (corridors only)');

  // the other kind chosen, but not run yet: the results on the screen still say where they come from
  await click(radio(fewerKind.label));
  assert.deepEqual(codes(), moreKind.draw(10, 1).map(encodeScenario));
  assert.equal(ranKind(), named(moreKind));
  // run: now the first kind is tested, and named
  await runAll(10);
  assert.deepEqual(codes(), fewerKind.draw(10, 1).map(encodeScenario));
  assert.deepEqual(codes().map(wallsOf), Array<number>(10).fill(fewer));
  assert.equal(ranKind(), 'Competition mazes with 13 inner walls');

  // a list that is not random has no kind: nothing is said about one
  await click(radio('This maze, fire at every place'));
  await runAll(6);
  assert.equal(ranKind(), null);

  await act(async () => {
    root.unmount();
  });
});

test('the page hands Fire Chief its own random draws: the two buttons of the Maze panel and the random lists of the test window', () => {
  const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
  // (comments do not count: a prop that is only mentioned in one is not passed)
  const code = (source: string): string =>
    source
      .replace(/\/\*[^]*?\*\//g, '')
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n');
  // Without these props the panel falls back to one button that draws the game's mixed mazes
  // (4 to 16 walls), and the window to random lists of those mazes: no test of the two parts
  // alone notices, as they are given the props by hand.
  const page = code(read('./FireChiefSimulator.tsx'));
  assert.match(page, /\srandomDraws=\{RANDOM_MAZE_DRAWS\}\s/);
  assert.match(page, /\sbatchRandom=\{MAZE_BATCH_RANDOM\}\s/);
  assert.match(page, /\sbatchPresets=\{MAZE_BATCH_PRESETS\}\s/);
  // and the general screen hands them on
  const app = code(read('../SimulatorApp.tsx'));
  assert.match(app, /<CombinationPanel\b[^>]*\srandomDraws=\{props\.randomDraws\}/);
  assert.match(app, /<BatchDialog\b(?:(?!<\/?[A-Z])[^])*?\srandom=\{props\.batchRandom\}/);
  assert.match(app, /<BatchDialog\b(?:(?!<\/?[A-Z])[^])*?\spresets=\{props\.batchPresets\}/);
  // (the check does find a missing prop)
  assert.doesNotMatch(code('<X\n  // batchRandom={MAZE_BATCH_RANDOM}\n/>'), /\sbatchRandom=\{MAZE_BATCH_RANDOM\}\s/);
});
