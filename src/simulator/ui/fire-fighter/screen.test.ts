/**
 * The screen parts of Fire Fighter without a browser: its words, the list of its one setup, the
 * whole screen drawn to HTML as the page draws it (no "Test on many ...", no code, no Random, no
 * Default, no code field, no Restart button - and the list of the field, the title row, the words),
 * the two branches the general screen takes for a category with one setup (`fixedSetup`) - and
 * that every other screen takes neither, the letters on the towers' flaps (RefereeProp.labelMm),
 * and the wiring of the page.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TABLE_MARGIN } from '../../core/engine';
import { createSimulation } from '../../core/simulation';
import type { Simulation } from '../../core/types';
import { SQUARE_MIDDLES, TOWER_IDS, TOWER_NAMES, TOWER_PLACES } from '../../fire-fighter/field';
import { CUBE_FILL, FLAP_LETTER_MM, MAX_SCORE, MOVED_TOWER_PENALTY, NOW_YELLOW_TAKEN, cubeId, fireFighterGame, flapId, flapProp } from '../../fire-fighter/game';
import { FIRE_FIGHTER_ROBOT, START_POSE } from '../../fire-fighter/robot';
import { RULES_SETUP, SETUP_CODE } from '../../fire-fighter/scenario';
import { program, script, whenStart } from '../../vm/builder';
import { ControlBar } from '../ControlBar';
import { STAGE_MARGIN, drawStage, fitView, type MatPainter } from '../render';
import { ScoreSheet, StatusLine } from '../ScoreSheet';
import { DEFAULT_WORDS, scoreSheetSummary, screenWords } from '../screen-words';
import type { SimulatorAppProps } from '../SimulatorApp';
import { FIRE_FIGHTER_ASSUMPTIONS, FIRE_FIGHTER_RULES, FIRE_FIGHTER_RULES_NOTE } from './rules';
import { SetupList } from './SetupList';
import { FIRE_FIGHTER_START_ZONE, FIRE_FIGHTER_WORDS } from './words';

const WORDS = screenWords(FIRE_FIGHTER_WORDS);
const nothing = (): void => undefined;
/** What a reader sees: the tags taken out, quotation marks back as typed. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
/** The code of a file without its comments: a prop that is only mentioned in a comment is not passed. */
const code = (source: string): string =>
  source
    .replace(/\/\*[^]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');

/**
 * The general screen and the screens built on it bring their stylesheet along (an import of a
 * .css file): Node has nothing to do with it. Loaded only after that is said - so with import(),
 * not with an import at the top of this file.
 */
async function screenModules() {
  const require = createRequire(import.meta.url);
  require.extensions['.css'] = (module) => {
    module.exports = {};
  };
  return {
    app: await import('../SimulatorApp'),
    fighter: await import('./FireFighterSimulator'),
  };
}

// =============================================================================================
// Words
// =============================================================================================

test('words: a "delivery" brings points, the panel is "The field" with "one setup" beside it, the start zone is the Fire Station', () => {
  assert.equal(FIRE_FIGHTER_START_ZONE, 'Fire Station');
  assert.equal(WORDS.match, DEFAULT_WORDS.match, 'a match, as the rules say');
  assert.equal(WORDS.goal, 'delivery');
  assert.equal(WORDS.goals, 'deliveries');
  assert.equal(WORDS.goalsShort, undefined, '"0 of 5 deliveries" fits the closed sheet');
  assert.equal(WORDS.zonesHint, 'Colour the zones: the Fire Station, the cube squares, the white dashed squares under the towers and the five picture squares');
  assert.equal(WORDS.resetHint, 'Put the five cubes and the five towers back and the robot into the Fire Station, ready for a new start.');
  assert.equal(WORDS.sheetNotesHeading, 'Penalties');
  assert.equal(
    WORDS.sheetNote,
    "Each tower is checked once, at the end. The yellow cube counts only if X was the robot's next delivery after it took the yellow cube. " +
      'A tower pushed off its picture square: 0 for it and 4 points off. The total is never below 0.',
  );
  assert.equal(MOVED_TOWER_PENALTY, 4);
  assert.equal(WORDS.scenario, 'setup');
  assert.equal(WORDS.scenarios, 'setups');
  assert.equal(WORDS.scenarioTitle, 'The field');
  assert.equal(WORDS.scenarioSummary, 'one setup');
  assert.equal(WORDS.tableEdge, 'the edge of the table');
  // the rest is the first game's: the "Finished" call, and the words of the panel and the test window, which this screen does not show
  for (const key of ['finishedHint', 'cleanLine', 'randomLabel', 'randomHint', 'defaultLabel', 'defaultHint', 'batchHint', 'batchIntro', 'grabbed'] as const) {
    assert.equal(WORDS[key], DEFAULT_WORDS[key], key);
  }
  assert.equal(WORDS.scenarioNote, undefined);
  // (no other game gives the new word: it goes with a screen of one setup)
  assert.equal(DEFAULT_WORDS.scenarioSummary, undefined);
  // short and plain: no sentence of the game's own words is longer than 140 characters
  for (const [key, value] of Object.entries(FIRE_FIGHTER_WORDS)) {
    for (const sentence of String(value).split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${key}: ${sentence}`);
  }
});

test('words: the zones the Zones button names are the zones of the game - the Fire Station, five cube squares, five dashed squares, five picture squares', () => {
  const zones = fireFighterGame.overlays(RULES_SETUP);
  const kinds = zones.map((zone) => zone.kind);
  assert.deepEqual(
    [kinds.filter((k) => k === 'start').length, kinds.filter((k) => k === 'pickup').length, kinds.filter((k) => k === 'delivery').length, kinds.filter((k) => k === 'tower-area').length],
    [1, 5, TOWER_IDS.length, TOWER_IDS.length],
  );
  assert.equal(zones.length, 1 + 5 + 2 * TOWER_IDS.length, 'nothing else');
  assert.equal(zones.find((zone) => zone.kind === 'start')?.label, FIRE_FIGHTER_START_ZONE);
  assert.equal(TOWER_IDS.length, 5, '"the five picture squares"');
});

test('words: the closed Score sheet before the start - 0 / 100 points, 0 of 5 deliveries; the sheet ends with the game\'s note', () => {
  const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) });
  const score = sim.score();
  const goals = score.lines.filter((line) => line.max > 0 && line.id !== 'bonus');
  assert.equal(goals.length, TOWER_IDS.length);
  assert.equal(MAX_SCORE, 100);
  assert.equal(scoreSheetSummary(score, goals.filter((line) => line.ok).length, goals.length, WORDS), '0 / 100 points · 0 of 5 deliveries');
  const sheet = text(renderToStaticMarkup(createElement(ScoreSheet, { score, words: WORDS })));
  assert.ok(sheet.includes('Penalties'), sheet);
  assert.ok(sheet.endsWith(WORDS.sheetNote), sheet);
  // the status line during a match: the count of the deliveries, or what the referee says the robot must do now
  const status = (now?: string) =>
    text(
      renderToStaticMarkup(
        createElement(StatusLine, {
          runState: 'running',
          finishReason: null,
          finishDetail: null,
          score: { ...score, ...(now ? { now } : {}) },
          time: 12,
          restarts: 0,
          restartPenalty: 0,
          restartRules: fireFighterGame.restartRules,
          restartsLeft: 0,
          words: WORDS,
          timeText: (t: number) => `${t} s`,
          briefEnding: true,
          readyHint: '',
          placingProblem: null,
          onShowSheet: nothing,
        }),
      ),
    );
  assert.equal(status(), 'Match running. 0 of 5 deliveries complete.');
  assert.equal(status(NOW_YELLOW_TAKEN), 'Match running. The robot took the yellow cube: X must be its next delivery.');
});

// =============================================================================================
// The list of the field
// =============================================================================================

test('the field: a plain list of where everything stands - the cubes, the five towers from the one table, the robot - and nothing to click', () => {
  const html = renderToStaticMarkup(createElement(SetupList));
  const lines = [...html.matchAll(/<li\b[^>]*>([^]*?)<\/li>/g)].map((match) => text(match[1]));
  assert.deepEqual(lines, [
    'Red cubes: one on each of the two squares of the left bay and of the right bay.',
    'Yellow cube: on the red square above the Fire Station.',
    'Towers: M school (bottom left), A hospital (bottom right), K bakery (top right), E park (top left), X hydrant (middle).',
    'The robot starts in the Fire Station.',
  ]);
  assert.match(html, /<p class="[^"]*">It is the same in every match\. &quot;Reset field&quot; puts all of it back\.<\/p>/);
  // the towers come from the one table of the field, in the order of the rules' check table
  assert.deepEqual([...html.matchAll(/data-tower="([A-Z])"/g)].map((match) => match[1]), [...TOWER_IDS]);
  for (const tower of TOWER_IDS) assert.ok(lines[2].includes(`${tower} ${TOWER_NAMES[tower]} (${TOWER_PLACES[tower]})`), tower);
  // the two squares in front of the cubes are only pictures, in the colours of the cubes on the stage
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.ok(html.includes(`background:${CUBE_FILL.red}`) && html.includes(`background:${CUBE_FILL.yellow}`));
  // nothing to choose: no button, no field, no code
  assert.doesNotMatch(html, /<button|<input|<select|<form/);
  assert.ok(!html.includes(SETUP_CODE));
  assert.match(read('./SetupList.tsx'), /^'use client';/);
});

// =============================================================================================
// The whole screen, drawn as the page draws it
// =============================================================================================

test('the screen: no "Test on many ..." button, no code, no Random, no Default, no "Enter a code", no Restart - and the list of the field, the title row and the words', async () => {
  const { fighter } = await screenModules();
  const html = renderToStaticMarkup(createElement(fighter.default));
  const seen = text(html);
  // the title row: "Fire Fighter simulator · mBot2", its path on the site, and only the Rules button
  assert.match(html, /<h1 class="[^"]*">Fire Fighter simulator <span class="[^"]*">· mBot2<\/span><\/h1>/);
  assert.ok(seen.startsWith('Home / Simulator / Fire Fighter simulator · mBot2 Powered by RoboHolic Robotics Academy Rules '), seen.slice(0, 120));
  assert.ok(!/Test on many/i.test(html), 'no "Test on many ..."');
  assert.ok(!/>Test</.test(html), 'not even its short form for a phone');
  assert.ok(!html.includes(WORDS.batchHint));
  // the panel of the field: its heading, "one setup" beside it, the list - and nothing of the panel of a code
  assert.match(html, /<span class="shrink-0">The field<\/span><span class="ml-auto min-w-0 truncate text-xs font-medium text-ink-500">one setup<\/span>/);
  assert.ok(html.includes('data-setup-list'));
  assert.ok(seen.includes('Towers: M school (bottom left), A hospital (bottom right), K bakery (top right), E park (top left), X hydrant (middle).'));
  for (const gone of [SETUP_CODE, 'Enter a code', 'combination-code', 'Copy the', 'combinations are possible', 'setups are possible', WORDS.randomHint, WORDS.defaultHint]) {
    assert.ok(!html.includes(gone), gone);
  }
  assert.ok(!/>\s*(?:Random|Default)\s*</.test(html), 'no Random, no Default');
  // no Restart button (here, before a match, the bar has none anyway: the next test looks during a match)
  assert.ok(!/Restart/.test(seen));
  // the words of the screen: the Zones button, the status line before the start, the closed Score sheet
  assert.ok(html.includes(`title="${WORDS.zonesHint}"`));
  assert.ok(seen.includes('Ready. Drag the robot inside the Fire Station; turn it with the buttons below the mat.'));
  assert.ok(seen.includes('Score sheet 0 / 100 points · 0 of 5 deliveries'));
  assert.ok(seen.includes('Time 3:00'), 'a match of 180 seconds');
  // and the Examples button of every screen (what it opens, the website's server says)
  assert.ok(/>\s*Examples\s*</.test(html));
});

test('match controls: during a match there is no Restart button - the game allows none', () => {
  assert.deepEqual(fireFighterGame.restartRules, { maxRestarts: 0 });
  const bar = (restartButton?: boolean) =>
    renderToStaticMarkup(
      createElement(ControlBar, {
        runState: 'running',
        canStart: true,
        timeLeft: 100,
        score: { total: 0, max: MAX_SCORE, lines: [], complete: false },
        restartPenalty: fireFighterGame.restartPenalty,
        restartRules: fireFighterGame.restartRules,
        restartsLeft: 0,
        restartButton,
        words: WORDS,
        speed: 1,
        onSpeed: nothing,
        onStart: nothing,
        onStop: nothing,
        onPause: nothing,
        onResume: nothing,
        onRestart: nothing,
        onFinished: nothing,
        onReset: nothing,
      }),
    );
  assert.ok(!text(bar(false)).includes('Restart'), text(bar(false)));
  assert.ok(text(bar()).includes('Restart'), 'with the button, as the other games have it');
  for (const label of ['Stop', 'Finished', 'Reset']) assert.ok(text(bar(false)).includes(label), label);
  // (the Reset button says what it puts back, in this game's words)
  assert.ok(bar(false).includes(WORDS.resetHint.slice(0, 40)));
});

/** The props of the general screen with this game, as the page hands them over (but `fixedSetup`). */
function fighterProps(examples: SimulatorAppProps<typeof RULES_SETUP>['examples']): SimulatorAppProps<typeof RULES_SETUP> {
  return {
    game: fireFighterGame,
    robotConfig: FIRE_FIGHTER_ROBOT,
    title: 'Fire Fighter',
    stageMargin: TABLE_MARGIN,
    startZoneName: FIRE_FIGHTER_START_ZONE,
    examples,
    rules: FIRE_FIGHTER_RULES,
    rulesNote: FIRE_FIGHTER_RULES_NOTE,
    rulesExtra: FIRE_FIGHTER_ASSUMPTIONS,
    words: FIRE_FIGHTER_WORDS,
    initialStartPose: START_POSE,
    showLastPrint: true,
    restartButton: false,
    renderCombinationEditor: (): ReactNode => createElement(SetupList),
  };
}

test('fixedSetup: left out it is as always; true takes out the "Test on many ..." button and the panel of the code - and changes nothing else', async () => {
  const { app, fighter } = await screenModules();
  const { CombinationPanel } = await import('../CombinationPanel');
  const props = fighterProps(fighter.EXAMPLES);
  const draw = (fixedSetup?: boolean) => renderToStaticMarkup(createElement(app.SimulatorApp<typeof RULES_SETUP>, { ...props, ...(fixedSetup === undefined ? {} : { fixedSetup }) }));
  const always = draw();
  assert.equal(draw(false), always, 'false is the same as left out');
  // left out: the button, and the panel with the code, Random, Default and the code field - the list of the field inside it
  assert.ok(always.includes('Test on many setups'));
  assert.ok(always.includes(`<span class="font-mono">${SETUP_CODE}</span>`));
  const panel = renderToStaticMarkup(createElement(CombinationPanel<typeof RULES_SETUP>, { game: fireFighterGame, scenario: RULES_SETUP, onChange: nothing, words: WORDS, children: createElement(SetupList) }));
  assert.ok(always.includes(panel), 'the panel of the code, as every other game has it');
  assert.ok(panel.includes('Enter a code') && panel.includes('Random</button>') && panel.includes('Default</button>'));
  // true: exactly these three things change - the button goes, "one setup" stands beside the heading, the list stands alone
  const list = renderToStaticMarkup(createElement(SetupList));
  const button = /<button type="button"[^>]*title="Run your program on many starting combinations at once"[^>]*>(?:(?!<\/button>)[^])*<\/button>/;
  assert.match(always, button);
  const expected = always.replace(button, '').replace(`<span class="font-mono">${SETUP_CODE}</span>`, 'one setup').replace(panel, list);
  assert.equal(draw(true), expected);
  // (a game with one setup that gives no `scenarioSummary`: nothing beside the heading)
  const plain = renderToStaticMarkup(createElement(app.SimulatorApp<typeof RULES_SETUP>, { ...props, words: { ...FIRE_FIGHTER_WORDS, scenarioSummary: undefined }, fixedSetup: true }));
  assert.match(plain, /<span class="shrink-0">The field<\/span><\/button>/);
});

test('fixedSetup: only this screen passes it; the general screen uses it in its two places and nowhere else', async () => {
  const page = code(read('./FireFighterSimulator.tsx'));
  assert.match(page, /\sfixedSetup\s/);
  for (const other of ['../fire-rescue/FireRescueSimulator.tsx', '../fire-rescue-junior/FireRescueJuniorSimulator.tsx', '../fire-chief/FireChiefSimulator.tsx', '../warehouse-sort/WarehouseSortSimulator.tsx', '../locker-room/LockerRoomSimulator.tsx']) {
    assert.ok(!read(other).includes('fixedSetup'), other);
    assert.ok(!read(other).includes('scenarioSummary'), other);
  }
  const app = code(read('../SimulatorApp.tsx'));
  assert.equal(app.split('fixedSetup').length - 1, 4, 'the prop, the button of the title row, and the summary and the body of the panel');
  assert.match(app, /\{!props\.fixedSetup && \(\s+<button\b(?:(?!<\/button>)[^])*Test on many \$\{words\.scenarios\}(?:(?!<\/button>)[^])*<\/button>\s+\)\}/);
  assert.match(app, /summary=\{props\.fixedSetup \? words\.scenarioSummary : <span className="font-mono">\{game\.encodeScenario\(scenario\)\}<\/span>\}/);
  assert.match(app, /\{props\.fixedSetup \? \(\s+props\.renderCombinationEditor\(scenario, changeScenario\)\s+\) : \(\s+<CombinationPanel /);
  // ... and every other screen still has the button and the panel of the code (drawn as their pages draw them)
  await screenModules();
  const screens: Array<[string, string]> = [
    ['../fire-rescue/FireRescueSimulator', 'combinations'],
    ['../fire-rescue-junior/FireRescueJuniorSimulator', 'combinations'],
    ['../fire-chief/FireChiefSimulator', 'mazes'],
    ['../warehouse-sort/WarehouseSortSimulator', 'arrangements'],
    ['../locker-room/LockerRoomSimulator', 'draws'],
  ];
  for (const [file, scenarios] of screens) {
    const screen = (await import(file)) as { default: ComponentType };
    const html = renderToStaticMarkup(createElement(screen.default));
    assert.ok(html.includes(`Test on many ${scenarios}`), `${file}: "Test on many ${scenarios}"`);
    assert.ok(html.includes('Enter a code') && html.includes('id="combination-code"'), `${file}: the code field`);
    assert.match(html, /<span class="ml-auto min-w-0 truncate text-xs font-medium text-ink-500"><span class="font-mono">[^<]+<\/span><\/span>/, `${file}: the code beside the heading`);
  }
});

// =============================================================================================
// The letters on the towers
// =============================================================================================

/** One entry per call or setting of the 2-D context: its name and its arguments (an object is written as its kind). */
type Entry = Array<string | number | boolean | null>;
const flat = (value: unknown): string | number | boolean | null =>
  value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : `<${typeof value}>`;

/** A 2-D context that writes down every call and every setting (as ../render-painters.test.ts does). */
function recordingContext(log: Entry[]): CanvasRenderingContext2D {
  const state: Record<string, unknown> = { canvas: { width: 800, height: 800 } };
  const gradient = { addColorStop: (...args: unknown[]) => log.push(['addColorStop', ...args.map(flat)]) };
  return new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push([key, ...args.map(flat)]);
        if (key === 'measureText') return { width: String(args[0]).length * 5 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient;
        if (key === 'getImageData') return { data: new Uint8ClampedArray(4) };
        return undefined;
      };
    },
    set(target, key: string, value) {
      log.push([`=${key}`, flat(value)]);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Draw the stage of `sim` once, as the page does (the whole table strip around the mat), into a log. */
function drawLogged(sim: Simulation<unknown>, size = 800): { log: Entry[]; scale: number } {
  const log: Entry[] = [];
  const view = fitView(size, size, sim.game.mat.width, sim.game.mat.height, 1, TABLE_MARGIN);
  const mat = { paint: () => log.push(['mat']) } as unknown as MatPainter;
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const standIn = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingContext([]) }) };
  Object.defineProperty(globalThis, 'document', { value: standIn, configurable: true, writable: true });
  try {
    drawStage(recordingContext(log), { sim, view, options: { overlays: false, sensors: false, trail: false }, mat, trail: { points: [] } as never, overlays: [], placing: false, ghost: null, ruler: null });
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had);
    else delete (globalThis as { document?: unknown }).document;
  }
  return { log, scale: view.scale };
}

test('stage: a letter that shows is drawn as high as on the flap (30 mm of the mat, at any size of the stage); a hidden one is not drawn', () => {
  assert.ok(TABLE_MARGIN > STAGE_MARGIN, 'the page shows the whole table strip');
  const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) }) as Simulation<unknown>;
  // at the start: five flaps, letters hidden
  assert.deepEqual((sim.world.props ?? []).map((prop) => [prop.id, prop.label, prop.labelMm]), TOWER_IDS.map((tower) => [flapId(tower), '', FLAP_LETTER_MM]));
  const hidden = drawLogged(sim);
  assert.deepEqual(hidden.log.filter((e) => e[0] === 'fillText').map((e) => e[1]).filter((s) => s !== ''), [], 'no letter drawn');
  // a red cube put down right in the middle of tower M (a stay that begins in the middle counts as through the opening): the M shows
  const cube = sim.world.bodies.find((body) => body.id === cubeId('red-left-upper'));
  assert.ok(cube);
  Object.assign(cube, { x: SQUARE_MIDDLES.M.x, y: SQUARE_MIDDLES.M.y });
  sim.start();
  sim.step(1);
  const flap = (sim.world.props ?? []).find((prop) => prop.id === flapId('M'));
  assert.deepEqual([flap?.label, flap?.labelMm], ['M', FLAP_LETTER_MM]);
  for (const size of [800, 360]) {
    const { log, scale } = drawLogged(sim, size);
    const at = log.findIndex((e) => e[0] === 'fillText' && e[1] === 'M');
    assert.ok(at > 0, 'the letter is written');
    const font = [...log.slice(0, at)].reverse().find((e) => e[0] === '=font');
    assert.ok(font && String(font[1]).startsWith(`700 ${FLAP_LETTER_MM}px `), `${size}: ${font?.[1]} (not 11 px of the screen: ${11 / scale}px)`);
  }
  assert.equal(FLAP_LETTER_MM, 30);
});

test('stage: labelMm changes the size of the letters and nothing else of the drawing of a prop', () => {
  const sim = createSimulation({ game: fireFighterGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) }) as Simulation<unknown>;
  const shown = flapProp('X', { x: 0, y: 0 }, true);
  sim.world.props = [shown];
  const withMm = drawLogged(sim).log;
  const { labelMm: _left, ...plain } = shown;
  sim.world.props = [plain];
  const { log: without, scale } = drawLogged(sim);
  assert.equal(withMm.length, without.length);
  const differ = withMm.map((entry, i) => [entry, without[i]] as const).filter(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
  assert.equal(differ.length, 1, JSON.stringify(differ));
  const [[a, b]] = differ;
  assert.equal(a[0], '=font');
  assert.ok(String(a[1]).startsWith(`700 ${FLAP_LETTER_MM}px `), String(a[1]));
  assert.ok(String(b[1]).startsWith(`700 ${11 / scale}px `), String(b[1]));
});

// =============================================================================================
// The page
// =============================================================================================

test('page: the Fire Fighter screen hands the general screen its game, robot, table strip, examples, rules, words and the list of the field - and no Restart, no test window', () => {
  const page = code(read('./FireFighterSimulator.tsx'));
  for (const prop of [
    /\sgame=\{fireFighterGame\}\s/,
    /\srobotConfig=\{FIRE_FIGHTER_ROBOT\}\s/,
    /\stitle="Fire Fighter"\s/,
    /\sstageMargin=\{TABLE_MARGIN\}\s/,
    /\sstartZoneName=\{FIRE_FIGHTER_START_ZONE\}\s/,
    /\sexamples=\{EXAMPLES\}\s/,
    /\srules=\{FIRE_FIGHTER_RULES\}\s/,
    /\srulesNote=\{FIRE_FIGHTER_RULES_NOTE\}\s/,
    /\srulesExtra=\{FIRE_FIGHTER_ASSUMPTIONS\}\s/,
    /\swords=\{FIRE_FIGHTER_WORDS\}\s/,
    /\sinitialStartPose=\{START_POSE\}\s/,
    /\sshowLastPrint\s/,
    /\srestartButton=\{false\}\s/,
    /\sfixedSetup\s/,
    /\srenderCombinationEditor=\{renderCombinationEditor\}\s/,
  ]) {
    assert.match(page, prop);
  }
  // nothing for "Test on many ...", no code of its own, no rules file to link (none is published), no other title
  for (const prop of ['batchPresets', 'batchRandom', 'batchRandomLists', 'batchTieBreak', 'batchSummaryLabel', 'batchSummaryOrder', 'randomDraws', 'readCode', 'rulesNoteLink', 'emptyWorkspaceNote', 'enlargeButtonCorner', 'titleWrapsOnPhone']) {
    assert.ok(!page.includes(prop), prop);
  }
  assert.match(page, /function renderCombinationEditor\(\): ReactNode \{\s+return <SetupList \/>;\s+\}/);
  // the examples: the one address, and the name of this game - nothing else about them
  assert.match(page, /unlockUrl: '\/api\/simulator\/unlock',\s+game: 'fire-fighter'[^,\n]*,\s+organisation: 'MakeX Lebanon',/);
  assert.doesNotMatch(page, /sample-catalog|samples/);
  // the robot and its start are the game's; the start fits the Fire Station
  assert.equal(fireFighterGame.robotConfig, FIRE_FIGHTER_ROBOT);
  assert.deepEqual(START_POSE, fireFighterGame.defaultStartPose);
  assert.equal(TABLE_MARGIN, 100);
});

test('page: its address, title and description; the loader shows the name of the game while the simulator loads', () => {
  const page = read('../../../app/simulator/fire-fighter/page.tsx');
  assert.match(page, /const PATH = '\/simulator\/fire-fighter';/);
  assert.match(page, /const TITLE = 'mBot2 simulator — Fire Fighter';/);
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /return <FireFighterLoader \/>;/);
  const description = /const DESCRIPTION =\s*('[^;]+);/.exec(page)?.[1].replace(/'\s*\+\s*'/g, '').slice(1, -1);
  assert.equal(
    description,
    'Build a program with mBlock-style blocks and watch a Makeblock mBot2 play the Fire Fighter mission of MakeX Lebanon Season 2027 (ages 8–10): ' +
      'carry the four red cubes to the towers M, A, K and E and the yellow cube to X, and reveal the letters M A K E X — scored as the rules propose. Free, in the browser.',
  );
  const loader = code(read('./FireFighterLoader.tsx'));
  assert.match(loader, /<TitleBar title="Fire Fighter" \/>/);
  assert.match(loader, /dynamic\(\(\) => import\('\.\/FireFighterSimulator'\), \{\s+ssr: false,/);
  for (const file of ['./FireFighterLoader.tsx', './FireFighterSimulator.tsx', './SetupList.tsx']) assert.match(read(file), /^'use client';/, file);
  // the loading screen: the title row of the page, while the simulator loads in the browser only
  const loading = renderToStaticMarkup(createElement(fighterLoader()));
  assert.match(loading, /<h1 class="[^"]*">Fire Fighter simulator <span class="[^"]*">· mBot2<\/span><\/h1>/);
  assert.ok(text(loading).includes('Getting the mat and the robot ready…'));
});

/** The loader, read once: its module asks next/dynamic for the screen, which is not loaded on the server. */
function fighterLoader(): ComponentType {
  const require = createRequire(import.meta.url);
  require.extensions['.css'] = (module) => {
    module.exports = {};
  };
  return (require('./FireFighterLoader') as { FireFighterLoader: ComponentType }).FireFighterLoader;
}
