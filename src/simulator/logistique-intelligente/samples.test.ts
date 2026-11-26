/**
 * The examples of Logistique intelligente (samples.ts): six block programs in French (design 8,
 * test T10), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  the referee of ./game.ts
 *
 *   - THE LIST: six examples, three starters, two intermediate, one advanced, with French titles
 *     and headings; ids of their own ("logi-"), different from every id of every other game;
 *   - THE MATCHES, AS MEASURED: 0, 0, 50, 100, 100 and 500 points, the end at 1.85, 3.27, 7.91,
 *     7.05, 22.29 and 56.64 s - on the vector drawing of the mat and on the picture the browser
 *     reads; the claw takes and lets go of the cubes it should at the times measured, only those
 *     cubes move, nothing is bumped, nothing falls, the robot never leaves the arena;
 *   - THE START MOVED OR TURNED inside the start area: how far each example keeps its points, and
 *     that one step further it does not (the examples count on the default start pose);
 *   - THE TRIES of the descriptions ("Essaie ...") do what the descriptions say;
 *   - FRENCH: every title, heading, description, note, name and printed text is French, with
 *     French typography; the colour the sensor gives stays as the program holds it, "yellow",
 *     with its French in brackets (design D7);
 *   - what they print fits the 18 columns of the CyberPi screen; they load into the French block
 *     editor without one stack on another, and what it saves plays the same match;
 *   - they stay on the server, and their ids and titles are nobody else's.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { BUILTIN_BLOCK_TYPES } from '../blocks/catalog';
import { blocklyMessagesOf } from '../blocks/locale';
import { createEditor, disposeEditor, type BlocklyApi } from '../blocks/register';
import { COLUMN_GAP, estimateStackWidth } from '../blocks/stack-size';
import { paletteBlockTypes } from '../blocks/toolbox';
import { runMatch } from '../core/batch';
import { RasterMatSampler } from '../core/mat';
import { createSimulation } from '../core/simulation';
import type { Body, BlockJson, MatSampler, Pose, ProgramJson, Simulation } from '../core/types';
import { ALL_GAMES } from '../members/all-examples';
import { poseFits } from '../ui/start-pose';
import { supportsBlock } from '../vm';
import { MAT_SIZE, MAT_VECTOR, START_AREA, WAREHOUSES, type WarehouseId } from './field';
import { FAULTS, LINE_FAULTS, MAX_SCORE, SHEET, cubeId, logistiqueGame } from './game';
import { LOGISTIQUE_ROBOT, START_POSE } from './robot';
import { RULES_SETUP, type LogistiqueScenario } from './scenario';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import * as Samples from './samples';
import { SAMPLE_PROGRAMS, getSampleProgram, type SampleProgram } from './samples';

type Sim = Simulation<LogistiqueScenario>;

/** The folder of this file. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The no-break space of French typography. */
const NB = '\u00a0';
const DEG = Math.PI / 180;

function sample(id: string): SampleProgram {
  const s = getSampleProgram(id);
  assert.ok(s, id);
  return s;
}

/** Every block of a program: the scripts, the my-block definitions, and everything inside them. */
function blocksOf(blocks: ProgramJson): BlockJson[] {
  const out: BlockJson[] = [];
  const visit = (block: BlockJson | undefined): void => {
    if (!block) return;
    out.push(block);
    for (const slot of Object.values(block.inputs ?? {})) {
      visit(slot.shadow);
      visit(slot.block);
    }
    visit(block.next?.block);
  };
  (blocks.blocks?.blocks ?? []).forEach(visit);
  return out;
}

/** The notes a student reads on the blocks of a program (the comment bubbles). */
function notesOf(blocks: ProgramJson): string[] {
  return blocksOf(blocks)
    .map((block) => (block.icons as { comment?: { text?: string } } | undefined)?.comment?.text ?? '')
    .filter((text) => text !== '');
}

/** The texts written into the bubbles of a program that a student sees (a bubble with a block in it is hidden). */
function bubbleTextsOf(blocks: ProgramJson): string[] {
  const out: string[] = [];
  for (const block of blocksOf(blocks)) {
    for (const slot of Object.values(block.inputs ?? {})) {
      const text = slot.shadow?.type === 'text' && !slot.block ? slot.shadow.fields?.TEXT : undefined;
      if (typeof text === 'string' && text !== '' && !/^-?\d+(\.\d+)?$/.test(text)) out.push(text);
    }
  }
  return out;
}

/** A copy of a program in which `change` has changed something (what a "Essaie ..." of a description asks for). */
function changed(blocks: ProgramJson, change: (all: BlockJson[]) => void): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  change(blocksOf(copy));
  return copy;
}

/** The number in the slot of a block ("avancer de 23.25 cm": 23.25). */
const numberIn = (block: BlockJson, slot: string): unknown => block.inputs?.[slot]?.shadow?.fields?.NUM;

// =============================================================================================
// What a French text may not contain
// =============================================================================================

/**
 * English words that are no French words: one of them in a French text is a text left in
 * English. (Taken as words of their own, with Unicode boundaries: "turn" in "tourne" is no word.)
 */
const ENGLISH =
  /(?<![\p{L}\p{N}])(the|of|and|is|it|its|to|at|by|with|from|this|that|then|put|take|down|up|left|right|yellow|red|green|blue|look|leave|first|stack|cube is|line|drive|turn|found|out|go|try|scores?|seconds?|warehouses?|claw|arm|colou?r|row|way|now|until|back|arrived)(?![\p{L}\p{N}])/iu;

/** The colour name the colour sensor gives, as a French sentence may name it (design D7): the value, then its French in brackets. */
const D7_VALUES = ['yellow (jaune)'];

/** What is wrong with a French text, or null (Tri d'entrepôt's rules, with the no-break space before "%" too). */
function frenchProblem(text: string): string | null {
  if (text.trim() === '') return 'empty';
  if (/\bW[1-8]\b/.test(text)) return 'names a warehouse W1 - W8 (here: E1 - E8)';
  const words = D7_VALUES.reduce((rest, value) => rest.split(value).join(' '), text);
  if (ENGLISH.test(words)) return `an English word: "${ENGLISH.exec(words)?.[0]}"`;
  if (/\d\.\d/.test(text)) return 'a number with a decimal point (French: a comma)';
  if (/'/.test(text)) return "a straight apostrophe (French writes ’)";
  if (/"/.test(text)) return 'straight quotes (French writes « »)';
  if (/\.\.\./.test(text)) return '"..." (French writes …)';
  if (/«(?!\u00a0)/.test(text) || /(?<!\u00a0)»/.test(text)) return 'no no-break space inside « »';
  if (/(?<!\u00a0)[:;!?%]/.test(text)) return 'no no-break space before : ; ! ? %';
  if (/ - /.test(text)) return 'a hyphen used as a dash (French writes « – »)';
  if (/\u00a0(?![:;!?%»–])/.test(text.replace(/«\u00a0/g, ''))) return 'a no-break space where none belongs';
  // (the arm is « en haut » or « en bas »: that is the arm, not a layer)
  if (/(?<![\p{L}])en (haut|bas)(?![\p{L}])/u.test(text.replace(/[Bb]ras (tout )?en (haut|bas)/g, ''))) return '« en haut / en bas » for a layer (French here: « dessous / dessus »)';
  return null;
}

// =============================================================================================
// The list
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples - three starters, two intermediate, one advanced - with ids of their own, in the order of the catalog', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'logi-ligne-croix starter',
        'logi-cube-dessus starter',
        'logi-un-cube-e8 starter',
        'logi-pile-e7 intermediate',
        'logi-empiler-e6 intermediate',
        'logi-toute-mission advanced',
      ],
    );
    assert.deepEqual(
      SAMPLE_PROGRAMS.map((s) => s.id),
      SAMPLE_CATALOG.map((card) => card.id),
      'samples.ts has a program for every card, in the same order',
    );
    for (const s of SAMPLE_PROGRAMS) {
      assert.deepEqual({ id: s.id, title: s.title, level: s.level }, exampleCard(s.id), 'title and level come from the catalog');
      assert.equal(getSampleProgram(s.id), s);
    }
    assert.equal(getSampleProgram('fete-leave-start'), undefined, 'an example of Tri d’entrepôt is no example here');
    assert.throws(() => exampleCard('bonjour'), /not on the list/);
  });

  test('the titles and the headings are the French of the design (8.1), with French typography', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => card.title),
      [
        'Suivre la ligne jusqu’à la croix',
        'Prendre le cube du dessus',
        'Un cube dans l’entrepôt E8',
        'Une pile entière dans l’entrepôt E7',
        'Empiler deux cubes dans l’entrepôt E6',
        `Toute la mission${NB}: 500 points`,
      ],
    );
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => [level.id, level.title, level.about]),
      [
        ['starter', 'Premiers pas', 'avancer, prendre, poser'],
        ['intermediate', 'Intermédiaire', 'des piles dans les entrepôts'],
        ['advanced', 'Avancé', 'toute la mission'],
      ],
    );
    for (const text of [...SAMPLE_CATALOG.map((card) => card.title), ...EXAMPLE_LEVELS.flatMap((level) => [level.title, level.about])]) {
      assert.equal(frenchProblem(text), null, text);
    }
    for (const card of SAMPLE_CATALOG) assert.ok(card.title.length >= 4 && card.title.length <= 40, card.title);
    // the advanced title promises what the advanced example scores
    assert.match(SAMPLE_CATALOG[5].title, new RegExp(`${MAX_SCORE} points$`));
  });

  test('every id starts with "logi-", and no id, title or heading text is used by an example of another game (over every game of the server)', () => {
    const others = ALL_GAMES.filter((game) => game.game !== logistiqueGame.id);
    assert.equal(others.length, ALL_GAMES.length - 1, 'this game is on the server list');
    assert.ok(ALL_GAMES.some((game) => game.game === logistiqueGame.id && game.examples.length === SAMPLE_PROGRAMS.length));
    const otherExamples = others.flatMap((game) => game.examples);
    assert.ok(otherExamples.length >= 43, `${otherExamples.length} examples of the other games`);
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...otherExamples, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^logi-[a-z0-9]+(-[a-z0-9]+)*$/, card.id);
    for (const card of otherExamples) assert.ok(!card.id.startsWith('logi-'), card.id);
    // the words after a heading are this game's own
    const otherAbouts = new Set(others.flatMap((game) => game.levels.map((level) => level.about)));
    for (const level of EXAMPLE_LEVELS) assert.ok(!otherAbouts.has(level.about), level.about);
  });
});

// =============================================================================================
// The descriptions
// =============================================================================================

/** What each description promises, as the matches below measure it. */
const PROMISED: Record<string, RegExp[]> = {
  'logi-ligne-croix': [
    new RegExp(`^Le robot avance de 5 cm${NB}: son capteur quad RGB arrive sur la ligne blanche`),
    new RegExp(`Quand il voit la première pile de cubes à moins de 10 cm, le robot s’arrête et l’écran affiche «${NB}Arrivé${NB}!${NB}»\\.`),
    /Il ne touche aucun cube et ne marque pas de points\. Il a fini au bout de 2 secondes\./,
    new RegExp(`Essaie 5 cm au lieu de 10${NB}: les doigts ouverts arrivent des deux côtés du cube du dessous, sans le toucher\\.$`),
  ],
  'logi-cube-dessus': [
    new RegExp(`^Le robot lève le bras tout en haut \\(100${NB}%\\) et avance de 32,5 cm, jusqu’à la pile du carré du bas, la plus proche\\.`),
    new RegExp(`L’écran affiche sa couleur, avec le nom que donne le capteur${NB}: yellow \\(jaune\\)\\.`),
    /pas encore de points\. Il a fini au bout de 3 secondes\./,
    new RegExp(`Essaie le bras à 50${NB}%${NB}: la pince prend alors le cube du dessous, et le cube 10 vient avec lui\\.$`),
  ],
  'logi-un-cube-e8': [
    new RegExp(`Le cube couvre tout l’entrepôt E8 et ne touche pas le robot${NB}: 50 points, en 8 secondes\\.`),
    new RegExp(`Essaie l’entrepôt E7, à gauche${NB}: tourne à gauche au lieu de tourner à droite\\.$`),
  ],
  'logi-pile-e7': [
    /^Bras en bas, le robot avance jusqu’à la pile du carré du bas\./,
    new RegExp(`Le cube 5 couvre tout l’entrepôt E7 et le cube 10 ne touche que lui${NB}: 100 points, en 7 secondes\\.`),
    new RegExp(`Essaie l’entrepôt E8${NB}: tourne à droite au lieu de tourner à gauche\\.$`),
  ],
  'logi-empiler-e6': [
    new RegExp(`Le cube 9 couvre tout l’entrepôt E6 et le cube 6 ne touche que lui${NB}: 100 points, en 22 secondes\\.`),
    new RegExp(`Essaie un nombre plus petit que 23,25 cm à la fin${NB}: jusqu’où le cube 6 peut-il dépasser du cube 9 et compter encore${NB}\\?$`),
  ],
  'logi-toute-mission': [
    /Il porte la pile du carré du bas dans E7, celle de droite dans E8, celle de gauche dans E5, celle du haut dans E6 et celle du centre dans E3\./,
    new RegExp(`chaque cube du dessus ne touche que lui${NB}: 500 points, en 57 secondes sur 150\\.`),
    new RegExp(`Essaie un autre ordre des piles, ou d’autres entrepôts${NB}: quel trajet est le plus rapide${NB}\\?$`),
  ],
};

describe('the descriptions', () => {
  test('every description says, in short plain French sentences, what the program does, what it scores and what to try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 700, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /(?<![\p{L}])points(?![\p{L}])/u, `${s.id} says what it scores`);
      assert.match(s.description, /(?<![\p{L}])Essaie(?![\p{L}])/u, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      assert.equal(frenchProblem(s.description), null, `${s.id}: ${frenchProblem(s.description)}`);
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 150, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= MAX_SCORE, `${s.id}: ${number} points`);
      for (const promise of PROMISED[s.id]) assert.match(s.description, promise, s.id);
    }
  });

  test('the notes say what a real robot does differently, and the advanced example says how to reach E1 and E4', () => {
    // every example that drives by distance says on its first block that a real robot drifts
    for (const id of ['logi-cube-dessus', 'logi-un-cube-e8', 'logi-pile-e7', 'logi-empiler-e6', 'logi-toute-mission']) {
      assert.ok(notesOf(sample(id).program).some((text) => /Un vrai robot dévie un peu/.test(text)), id);
    }
    // the line follower knows that the line is white here
    assert.ok(notesOf(sample('logi-ligne-croix').program).some((text) => text.includes(`«${NB}détecte la ligne${NB}» veut dire blanc ici`)));
    // no example covers E1 or E4 (a cube turned 45 degrees): the advanced one says how it would be done
    assert.ok(notesOf(sample('logi-toute-mission').program).some((text) => /E1 ou E4, les losanges, il faudrait y arriver tourné de 45°/.test(text)));
    // the two layers are « dessous / dessus », never « en haut / en bas » (frenchProblem looks at every note too, below)
    assert.ok(SAMPLE_PROGRAMS.some((s) => /du dessous/.test(s.description)) && SAMPLE_PROGRAMS.some((s) => /du dessus/.test(s.description)));
  });
});

// =============================================================================================
// The programs
// =============================================================================================

describe('the programs', () => {
  test('only blocks of the palette of this page (the one of Warehouse Sort and Tri d’entrepôt), which the interpreter knows', () => {
    assert.deepEqual(paletteBlockTypes(logistiqueGame.id), paletteBlockTypes('warehouse-sort'));
    const allowed = new Set([...paletteBlockTypes(logistiqueGame.id), ...BUILTIN_BLOCK_TYPES]);
    for (const s of SAMPLE_PROGRAMS) {
      for (const type of new Set(blocksOf(s.program).map((block) => block.type))) {
        assert.ok(allowed.has(type), `${s.id} uses ${type}`);
        assert.ok(supportsBlock(type), `${s.id}: the interpreter knows ${type}`);
      }
    }
  });

  test('every note, printed text and name is French, with French typography (the colour the sensor gives stays "yellow": D7)', () => {
    const problems: string[] = [];
    let texts = 0;
    for (const s of SAMPLE_PROGRAMS) {
      for (const text of [...notesOf(s.program), ...bubbleTextsOf(s.program)]) {
        texts++;
        // (a printed text that ends where the sensor's value is joined to it ends with a blank)
        const problem = frenchProblem(text.replace(/ $/, ''));
        if (problem) problems.push(`${s.id}: "${text}" - ${problem}`);
      }
    }
    assert.deepEqual(problems, []);
    assert.ok(texts > 80, `${texts} texts`);
    const names = new Set(SAMPLE_PROGRAMS.flatMap((s) => blocksOf(s.program).filter((b) => b.type === 'procedures_defnoreturn').map((b) => String(b.fields?.NAME))));
    assert.deepEqual([...names].sort(), ['poser la pile', 'prendre la pile', 'prendre le cube 10']);
    const variables = new Set(SAMPLE_PROGRAMS.flatMap((s) => (s.program.variables ?? []).map((variable) => variable.name)));
    assert.deepEqual([...variables], ['piles posées']);
    for (const name of [...names, ...variables]) assert.equal(frenchProblem(name), null, name);
  });

  test('the numbers the programs share are the ones of their blocks', () => {
    const numbers = Object.entries(Samples)
      .filter(([, value]) => typeof value === 'number')
      .sort(([a], [b]) => a.localeCompare(b));
    assert.deepEqual(numbers, [
      ['ARM_DOWN', 0],
      ['ARM_UP', 100],
      ['AWAY_CM', 10],
      ['BACK_TO_E7_E8_CM', 18.7],
      ['FOLLOW_RPM', 40],
      ['ONTO_THE_LINE_CM', 5],
      ['STEER_RPM', 20],
      ['STOP_AT_CM', 10],
      ['TO_E7_E8_CM', 39.6],
      ['TO_THE_BOTTOM_STACK_CM', 32.5],
    ]);
    // 32.5 cm from the start: the claw's middle 4.5 mm short of the middle of the stack of the bottom square
    const clawMiddle = START_POSE.y - Samples.TO_THE_BOTTOM_STACK_CM * 10 - LOGISTIQUE_ROBOT.gripper.gripForward;
    assert.equal(Number((clawMiddle - 652).toFixed(6)), 4.5);
    // E7 and E8 are as far left as right of the start line: one distance to both
    assert.equal(600 - WAREHOUSES.E7.centre.x, WAREHOUSES.E8.centre.x - 600);
    assert.equal(WAREHOUSES.E7.centre.y, WAREHOUSES.E8.centre.y);
    // the arm up takes the top cube alone, the arm down the bottom one (the limit is 63,57 % / 63,58 %, ./robot.ts)
    assert.ok(Samples.ARM_UP > 63.58 && Samples.ARM_DOWN < 63.57);
  });
});

// =============================================================================================
// The matches, as measured
// =============================================================================================

interface Played {
  sim: Sim;
  /** « time grab|release cube:n », in order */
  claws: string[];
  /** bodies the robot bumped into */
  bumps: string[];
  /** lines of the console that are not 'info' (warnings, errors) */
  warnings: string[];
  /** what the referee said (a fall, a cube or the robot out of the arena) */
  said: string[];
  /** ticks in which the robot pressed against something */
  touchTicks: number;
  /** the cubes that moved during the match */
  moved: string[];
}

/** Play an example tick by tick and watch it. */
function play(blocks: ProgramJson, options: { sampler?: MatSampler; startPose?: Pose } = {}): Played {
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: blocks, sampler: options.sampler, startPose: options.startPose });
  const home = new Map(sim.world.bodies.map((b) => [b.id, `${b.x} ${b.y} ${b.z} ${b.angle}`]));
  const played: Played = { sim, claws: [], bumps: [], warnings: [], said: [], touchTicks: 0, moved: [] };
  sim.start();
  while (sim.status === 'running') {
    sim.step(1);
    for (const e of sim.drainEvents()) {
      if (e.type === 'grab' || e.type === 'release') played.claws.push(`${e.time.toFixed(2)} ${e.type} ${e.bodyId}`);
      if (e.type === 'bump') played.bumps.push(`${e.time.toFixed(2)} ${e.bodyId}`);
      if (e.type === 'log' && e.level !== 'info') played.warnings.push(e.text);
      if (e.type === 'log' && e.level === 'info') played.said.push(e.text);
    }
    if (sim.world.robot.touching) played.touchTicks++;
  }
  played.moved = sim.world.bodies.filter((b) => home.get(b.id) !== `${b.x} ${b.y} ${b.z} ${b.angle}`).map((b) => b.id);
  return played;
}

const cube = (sim: Sim, n: number): Body => {
  const found = sim.world.bodies.find((b) => b.id === cubeId(n));
  assert.ok(found, `cube ${n}`);
  return found;
};

/** What each example ends with, measured (the same on the drawing and on the picture of the mat). */
const RESULTS: Record<
  string,
  {
    points: number;
    ends: number;
    claws: string[];
    moved: string[];
    holding: string | null;
    screen: string[];
    /** the cubes that score: [lower cube, upper cube or null, warehouse] */
    stacks: Array<[number, number | null, WarehouseId]>;
  }
> = {
  'logi-ligne-croix': { points: 0, ends: 1.85, claws: [], moved: [], holding: null, screen: [`Arrivé${NB}!`], stacks: [] },
  'logi-cube-dessus': { points: 0, ends: 3.27, claws: ['2.60 grab cube:10'], moved: ['cube:10'], holding: 'cube:10', screen: [`Cube${NB}: yellow`], stacks: [] },
  'logi-un-cube-e8': {
    points: 50,
    ends: 7.91,
    claws: ['2.60 grab cube:10', '7.14 release cube:10'],
    moved: ['cube:10'],
    holding: null,
    screen: [],
    stacks: [[10, null, 'E8']],
  },
  'logi-pile-e7': {
    points: 100,
    ends: 7.05,
    claws: ['2.10 grab cube:5', '6.28 release cube:5'],
    moved: ['cube:5', 'cube:10'],
    holding: null,
    screen: [],
    stacks: [[5, 10, 'E7']],
  },
  'logi-empiler-e6': {
    points: 100,
    ends: 22.29,
    claws: ['8.05 grab cube:9', '10.58 release cube:9', '19.34 grab cube:6', '21.52 release cube:6'],
    moved: ['cube:6', 'cube:9'],
    holding: null,
    screen: [],
    stacks: [[9, 6, 'E6']],
  },
  'logi-toute-mission': {
    points: 500,
    ends: 56.64,
    claws: [
      '2.15 grab cube:5',
      '6.32 release cube:5',
      '16.02 grab cube:4',
      '20.82 release cube:4',
      '30.52 grab cube:2',
      '32.69 release cube:2',
      '40.93 grab cube:1',
      '43.10 release cube:1',
      '49.98 grab cube:3',
      '55.87 release cube:3',
    ],
    moved: ['cube:1', 'cube:2', 'cube:3', 'cube:4', 'cube:5', 'cube:6', 'cube:7', 'cube:8', 'cube:9', 'cube:10'],
    holding: null,
    screen: [1, 2, 3, 4, 5].map((n) => `Piles posées${NB}: ${n}`),
    stacks: [
      [5, 10, 'E7'],
      [4, 9, 'E8'],
      [2, 7, 'E5'],
      [1, 6, 'E6'],
      [3, 8, 'E3'],
    ],
  },
};

/** The sensor picture of the mat, decoded with sharp (it comes with Next.js); null where it is missing. */
async function loadMatPicture(): Promise<MatSampler | null> {
  interface Decoded {
    data: Uint8Array;
    info: { width: number; height: number };
  }
  type Sharp = (file: string) => {
    ensureAlpha(): { raw(): { toBuffer(options: { resolveWithObject: true }): Promise<Decoded> } };
  };
  try {
    const sharp = createRequire(import.meta.url)('sharp') as Sharp;
    const file = path.join(HERE, '../../../public', logistiqueGame.mat.sensorImageUrl);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}
const picture = loadMatPicture();

/** Both mats: the drawing the tests play on, and the picture the browser reads (when it can be decoded). */
async function bothMats(): Promise<Array<[string, MatSampler | undefined]>> {
  const mat = await picture;
  return mat ? [['on the drawing', undefined], ['on the picture', mat]] : [['on the drawing', undefined]];
}

/** The line of a cube on the score sheet when it was not moved: on the cross, below or above. */
const atTheStart = (n: number): string => (n <= 5 ? SHEET.inStorage : SHEET.onInStorage(n - 5));

describe('the matches, as measured: 0, 0, 50, 100, 100 and 500 points', () => {
  for (const s of SAMPLE_PROGRAMS) {
    const r = RESULTS[s.id];
    test(`${s.id}: ${r.points} points, the end at ${r.ends} s; the claw on the cubes it should, at the times measured, and nothing bumped, fallen or out - on the drawing and on the picture of the mat`, async () => {
      for (const [mat, sampler] of await bothMats()) {
        const what = `${s.id} ${mat}`;
        const played = play(s.program, { sampler });
        const { sim } = played;
        const report = sim.score();
        assert.equal(sim.finishReason, 'program-ended', what);
        assert.equal(sim.world.time.toFixed(2), r.ends.toFixed(2), what);
        assert.equal(report.total, r.points, what);
        assert.equal(report.time, sim.world.time, `${what}: the time of this score is the end of the match`);
        assert.equal(report.complete, r.points === MAX_SCORE, what);
        assert.deepEqual(played.claws, r.claws, `${what}: grabs and releases`);
        assert.deepEqual([...played.moved].sort(), [...r.moved].sort(), `${what}: the cubes that moved`);
        assert.equal(sim.world.robot.gripper.holding, r.holding, what);
        assert.deepEqual(sim.world.robot.screen.lines, r.screen, `${what}: the CyberPi screen`);
        assert.deepEqual(played.bumps, [], `${what}: bumps`);
        assert.deepEqual(played.warnings, [], `${what}: warnings`);
        assert.deepEqual(played.said, [], `${what}: nothing fell, nothing left the arena`);
        assert.equal(played.touchTicks, 0, `${what}: never pressed against anything`);
        assert.deepEqual(sim.vm.errors(), [], `${what}: errors`);
        // the score sheet, line by line
        const scoring = new Map<number, string>();
        for (const [lower, upper, w] of r.stacks) {
          scoring.set(lower, SHEET.covers(w));
          if (upper !== null) scoring.set(upper, SHEET.onCovering(lower, w));
          // the lower cube on the middle of its warehouse (0.25 mm at most), square to it; the upper one right on it
          const below = cube(sim, lower);
          const centre = WAREHOUSES[w].centre;
          assert.ok(Math.hypot(below.x - centre.x, below.y - centre.y) <= 0.25 + 1e-6, `${what}: cube ${lower} ${below.x - centre.x}, ${below.y - centre.y} off the middle of ${w}`);
          assert.ok(Math.abs(Math.sin(2 * below.angle)) < 1e-9, `${what}: cube ${lower} square to ${w}`);
          assert.equal(below.z, 0, what);
          if (upper !== null) {
            const above = cube(sim, upper);
            assert.equal(above.restingOn, below.id, what);
            assert.ok(Math.hypot(above.x - below.x, above.y - below.y) < 1e-6 && above.z === below.h, `${what}: cube ${upper} right on cube ${lower}`);
          }
        }
        if (s.id === 'logi-cube-dessus') scoring.set(10, SHEET.held);
        assert.deepEqual(
          report.lines.map((line) => `${line.id} ${line.points} ${line.detail}`),
          [
            ...Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const detail = scoring.get(n) ?? (r.moved.includes(cubeId(n)) ? '?' : n > 5 && r.moved.includes(cubeId(n - 5)) ? '?' : atTheStart(n));
              return `${cubeId(n)} ${r.stacks.some(([lower, upper]) => lower === n || upper === n) ? 50 : 0} ${detail}`;
            }),
            `${LINE_FAULTS} 0 ${FAULTS.none}`,
          ],
          `${what}: the score sheet`,
        );
      }
    });
  }

  test('the advanced example makes the whole mission in well under the 100 s the design gives it, with 93 s left of the match', () => {
    assert.ok(RESULTS['logi-toute-mission'].ends < 100);
    assert.equal(Math.round(logistiqueGame.matchDuration - RESULTS['logi-toute-mission'].ends), 93);
    // (and every example ends long before the match does: nothing waits for the clock)
    for (const r of Object.values(RESULTS)) assert.ok(r.ends < logistiqueGame.matchDuration);
  });

  test('every description gives its end time rounded to the second, and its points', () => {
    for (const s of SAMPLE_PROGRAMS) {
      const r = RESULTS[s.id];
      assert.match(s.description, new RegExp(`(au bout de|en) ${Math.round(r.ends)} secondes`), s.id);
      if (r.points > 0) assert.match(s.description, new RegExp(`${r.points} points`), s.id);
    }
  });
});

// =============================================================================================
// The tries of the descriptions
// =============================================================================================

describe('the tries of the descriptions', () => {
  test('logi-ligne-croix with 5 cm instead of 10: the open fingers on both sides of the cube 5, 15 mm along it, touching nothing', () => {
    const closer = changed(sample('logi-ligne-croix').program, (all) => {
      const limit = all.find((block) => block.type === 'operator_lt')!.inputs!.OPERAND2.shadow!;
      assert.equal(limit.fields?.TEXT, String(Samples.STOP_AT_CM));
      limit.fields!.TEXT = '5';
    });
    const played = play(closer);
    const tips = played.sim.world.robot.pose.y - (LOGISTIQUE_ROBOT.gripper.gripForward + LOGISTIQUE_ROBOT.gripper.fingerLength / 2);
    const faceOfCube5 = 652 + 25;
    assert.ok(faceOfCube5 - tips > 15 && faceOfCube5 - tips < 16, `the finger tips ${faceOfCube5 - tips} mm along the cube 5`);
    assert.deepEqual([played.bumps, played.moved, played.touchTicks], [[], [], 0]);
    assert.deepEqual(played.sim.world.robot.screen.lines, [`Arrivé${NB}!`]);
    // as written: the finger tips 34.3 mm before it
    const asWritten = play(sample('logi-ligne-croix').program).sim.world.robot.pose.y;
    assert.equal((asWritten - (LOGISTIQUE_ROBOT.gripper.gripForward + LOGISTIQUE_ROBOT.gripper.fingerLength / 2) - faceOfCube5).toFixed(1), '34.3');
  });

  test('logi-cube-dessus with the arm at 50 %: the claw takes the cube 5 and the cube 10 comes with it; 63,57 % takes the pair too, 63,58 % the cube 10 alone', () => {
    const withArm = (percent: number): ProgramJson =>
      changed(sample('logi-cube-dessus').program, (all) => {
        const arm = all.filter((block) => block.type === 'gripper_arm_height');
        assert.equal(arm.length, 1);
        arm[0].inputs!.HEIGHT.shadow!.fields!.NUM = percent;
      });
    for (const [percent, holding, moved] of [
      [50, 'cube:5', ['cube:10', 'cube:5']],
      [63.57, 'cube:5', ['cube:10', 'cube:5']],
      [63.58, 'cube:10', ['cube:10']],
    ] as const) {
      const played = play(withArm(percent));
      assert.equal(played.sim.world.robot.gripper.holding, holding, `${percent} %`);
      assert.deepEqual([...played.moved].sort(), [...moved].sort(), `${percent} %`);
      assert.deepEqual([played.bumps, played.said], [[], []], `${percent} %`);
    }
    // with the pair, the cube 10 rides on the cube 5 - between the fingers, which reach 60 mm up at 50 %: it touches the robot (case g)
    const pair = play(withArm(50)).sim;
    assert.equal(cube(pair, 10).restingOn, 'cube:5');
    assert.equal(pair.score().lines.find((line) => line.id === cubeId(5))?.detail, SHEET.held);
    assert.equal(pair.score().lines.find((line) => line.id === cubeId(10))?.detail, SHEET.onTouchesRobot(5));
  });

  test('logi-un-cube-e8 and logi-pile-e7 the other way round: the same points in E7 and in E8', () => {
    const otherWay = (id: string): ProgramJson =>
      changed(sample(id).program, (all) => {
        for (const block of all.filter((b) => b.type === 'mbot2_turn_deg')) block.fields!.DIRECTION = block.fields!.DIRECTION === 'left' ? 'right' : 'left';
      });
    const one = play(otherWay('logi-un-cube-e8'));
    assert.equal(one.sim.score().total, 50);
    assert.equal(one.sim.score().lines.find((line) => line.id === cubeId(10))?.detail, SHEET.covers('E7'));
    const pair = play(otherWay('logi-pile-e7'));
    assert.equal(pair.sim.score().total, 100);
    assert.equal(pair.sim.score().lines.find((line) => line.id === cubeId(5))?.detail, SHEET.covers('E8'));
    assert.equal(pair.sim.score().lines.find((line) => line.id === cubeId(10))?.detail, SHEET.onCovering(5, 'E8'));
    for (const played of [one, pair]) assert.deepEqual([played.bumps, played.said], [[], []]);
  });

  test('logi-empiler-e6 with a smaller number than 23,25 cm at the end: the cube 6 counts up to 25 mm off the middle of the cube 9 (20,75 cm); 1 mm further it comes down beside it', () => {
    const lastMove = (cm: number): ProgramJson =>
      changed(sample('logi-empiler-e6').program, (all) => {
        const moves = all.filter((block) => block.type === 'mbot2_straight_cm' && numberIn(block, 'DISTANCE') === 23.25);
        assert.equal(moves.length, 1);
        moves[0].inputs!.DISTANCE.shadow!.fields!.NUM = cm;
      });
    const off = play(lastMove(20.75)).sim;
    assert.equal(off.score().total, 100);
    assert.equal(cube(off, 6).restingOn, 'cube:9');
    assert.equal((cube(off, 9).x - cube(off, 6).x).toFixed(3), '25.000');
    const fallen = play(lastMove(20.65)).sim;
    assert.equal(cube(fallen, 6).restingOn, null);
    assert.equal(cube(fallen, 6).z, 0);
    assert.equal(fallen.score().total, 0, 'it comes down beside the cube 9 and pushes it off the middle of E6');
    assert.equal(fallen.score().lines.find((line) => line.id === cubeId(9))?.detail, SHEET.partly('E6'));
  });
});

// =============================================================================================
// The start moved or turned
// =============================================================================================

describe('the start moved or turned inside the start area (the examples count on the default start pose)', () => {
  const startAt = (dx: number, dy: number, degrees = 0): Pose => ({ x: START_POSE.x + dx, y: START_POSE.y + dy, heading: START_POSE.heading + degrees * DEG });
  /** The robot fits the start area there (what the screen allows before Démarrer). */
  const fits = (pose: Pose): boolean => poseFits(LOGISTIQUE_ROBOT, START_AREA, pose);

  /**
   * How far each example keeps what it does - its points, the cube in its claw, its screen and
   * its end, with nothing bumped - from a start moved to the side (x, mm), up or down (y, mm) or
   * turned (degrees): measured in steps of 0.5 mm and 0.1 degree. Where the robot no longer fits
   * the start area one step further, the limit is the start area's.
   */
  const HOLDS: Record<string, { x: [number, number]; y: [number, number]; turn: [number, number] }> = {
    'logi-ligne-croix': { x: [-45.5, 45.5], y: [-6.5, 6.5], turn: [-6, 6] },
    'logi-cube-dessus': { x: [-7, 7], y: [-4.5, 6.5], turn: [-0.8, 0.8] },
    'logi-un-cube-e8': { x: [-5, 5], y: [-4.5, 4.5], turn: [-0.5, 0.4] },
    'logi-pile-e7': { x: [-5, 5], y: [-4.5, 4.5], turn: [-0.4, 0.5] },
    'logi-empiler-e6': { x: [-5, 5], y: [-5, 5], turn: [-0.3, 0.3] },
    'logi-toute-mission': { x: [-2.5, 2.5], y: [-5, 4.5], turn: [-0.2, 0.2] },
  };

  /** What a match from this start keeps of the default one. */
  const keeps = (s: SampleProgram, pose: Pose, sampler?: MatSampler): boolean => {
    const played = play(s.program, { startPose: pose, sampler });
    const r = RESULTS[s.id];
    return (
      played.sim.score().total === r.points &&
      played.bumps.length === 0 &&
      played.warnings.length === 0 &&
      played.sim.finishReason === 'program-ended' &&
      played.sim.world.robot.gripper.holding === r.holding &&
      JSON.stringify(played.sim.world.robot.screen.lines) === JSON.stringify(r.screen)
    );
  };

  for (const s of SAMPLE_PROGRAMS) {
    test(`${s.id}: from x ${HOLDS[s.id].x.join(' to ')} mm, y ${HOLDS[s.id].y.join(' to ')} mm, turned ${HOLDS[s.id].turn.join(' to ')} degrees it does the same - and one step further it does not, or the robot does not fit`, async () => {
      const mats = s.id === 'logi-ligne-croix' ? await bothMats() : [['on the drawing', undefined] as [string, undefined]];
      for (const [mat, sampler] of mats) {
        for (const [ends, step, pose] of [
          [HOLDS[s.id].x, 0.5, (v: number) => startAt(v, 0)],
          [HOLDS[s.id].y, 0.5, (v: number) => startAt(0, v)],
          [HOLDS[s.id].turn, 0.1, (v: number) => startAt(0, 0, v)],
        ] as const) {
          for (const end of ends) {
            const beyond = Math.round((end + Math.sign(end) * step) * 10) / 10;
            assert.ok(fits(pose(end)), `${s.id} ${mat}: the robot fits at ${end}`);
            assert.ok(keeps(s, pose(end), sampler), `${s.id} ${mat}: from ${JSON.stringify(pose(end))} it does the same`);
            assert.ok(!fits(pose(beyond)) || !keeps(s, pose(beyond), sampler), `${s.id} ${mat}: one step further (${beyond}) it does not`);
          }
        }
      }
    });
  }

  test('the line follower is the one that forgives: it finds its line from most of the start area, the others drive by distance', () => {
    assert.ok(HOLDS['logi-ligne-croix'].x[1] > 40 && !fits(startAt(0, 7)) && !fits(startAt(0, 0, 6.1)));
    for (const id of ['logi-un-cube-e8', 'logi-pile-e7', 'logi-empiler-e6', 'logi-toute-mission']) assert.ok(HOLDS[id].x[1] <= 5 && HOLDS[id].turn[1] <= 0.5, id);
  });
});

// =============================================================================================
// What the examples print
// =============================================================================================

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(path.join(HERE, '../ui/CyberPiPanel.tsx'), 'utf8'))?.[1]);

  test('every text an example prints fits on one row of the CyberPi screen - with what is joined to it', () => {
    assert.equal(columns, 18, 'the CyberPi screen of the simulator is 18 characters wide');
    const printed: string[] = [];
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        if (block.type !== 'cyberpi_print') continue;
        const slot = block.inputs?.TEXT;
        // a written text, or a written text joined to the colour the sensor read ("yellow") or to the count of stacks (one digit: 1 - 5)
        const join = slot?.block?.type === 'operator_join' ? slot.block : undefined;
        const text = String((join ? join.inputs?.STRING1?.shadow : slot?.shadow)?.fields?.TEXT ?? '');
        const joined = join?.inputs?.STRING2?.block?.type;
        if (join) assert.ok(joined === 'sensing_claw_color' || joined === 'data_variable', `${s.id}: ${joined}`);
        const longest = join ? text.length + (joined === 'sensing_claw_color' ? 'yellow'.length : 1) : text.length;
        assert.ok(text.length > 0 && longest <= columns, `${s.id}: "${text}" shows up to ${longest} characters`);
        printed.push(join ? `${text}…` : text);
      }
    }
    assert.deepEqual(printed, [`Arrivé${NB}!`, `Cube${NB}: …`, `Piles posées${NB}: …`]);
  });
});

// =============================================================================================
// In the French block editor
// =============================================================================================

/** Give Node the few browser globals Blockly needs to draw blocks, then load Blockly (as the other games' tests do). */
async function loadBlocklyWithDom(): Promise<BlocklyApi> {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options?: object) => { window: Record<string, unknown> } };
  const dom = new JSDOM('<!DOCTYPE html><div id="editor" style="width: 900px; height: 600px"></div>', { pretendToBeVisual: true });
  const names = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'DOMParser', 'XMLSerializer',
    'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']; // prettier-ignore
  // jsdom has no canvas; Blockly only uses it to measure how wide a text is
  const canvas = dom.window.HTMLCanvasElement as { prototype: { getContext: unknown } };
  canvas.prototype.getContext = () => ({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) });
  for (const name of names) {
    const value = name === 'window' ? dom.window : dom.window[name];
    if (value !== undefined) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  return (await import('blockly')) as unknown as BlocklyApi;
}

describe('the examples in the French block editor', () => {
  test('the stacks stand side by side by the width of their French rows, with the gap of the builder', () => {
    for (const s of SAMPLE_PROGRAMS) {
      const tops = [...(s.program.blocks?.blocks ?? [])].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const variables = s.program.variables ?? [];
      assert.equal(tops[0].type, 'event_cyberpi_start', `${s.id}: "lorsque CyberPi démarre" comes first`);
      for (let i = 0; i + 1 < tops.length; i++) {
        assert.equal(tops[i + 1].x, (tops[i].x ?? 0) + Math.ceil(estimateStackWidth(tops[i], variables, 'fr')) + COLUMN_GAP, `${s.id}: the stack after ${tops[i].type}`);
      }
    }
    // the hidden default text under "regrouper" is the French palette's
    for (const id of ['logi-cube-dessus', 'logi-toute-mission']) {
      const join = blocksOf(sample(id).program).find((block) => block.type === 'operator_join');
      assert.equal(join?.inputs?.STRING2?.shadow?.fields?.TEXT, 'banane', id);
    }
  });

  test('every example loads into the editor of this page (French blocks), no stack on another, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const frenchMessages = blocklyMessagesOf(createRequire(import.meta.url)('blockly/msg/fr') as Record<string, unknown>);
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: logistiqueGame.id, locale: 'fr', frenchMessages });
    for (const s of SAMPLE_PROGRAMS) {
      workspace.clear();
      Blockly.serialization.workspaces.load(s.program as never, workspace);
      const drawn = workspace.getAllBlocks(false);
      assert.ok(drawn.length >= 5, `${s.id}: ${drawn.length} blocks drawn`);
      for (const block of drawn) assert.ok(supportsBlock(block.type), `${s.id}: ${block.type}`);
      const start = drawn.find((block) => block.type === 'event_cyberpi_start');
      assert.match(start?.toString() ?? '', /lorsque/, `${s.id}: ${start?.toString()}`);
      const stacks = workspace.getTopBlocks(false).map((block) => ({ type: block.type, box: block.getBoundingRectangle() }));
      const leftmost = stacks.reduce((a, b) => (b.box.left < a.box.left ? b : a));
      assert.equal(leftmost.type, 'event_cyberpi_start', `${s.id}: "lorsque CyberPi démarre" comes first`);
      for (let i = 0; i < stacks.length; i++) {
        for (let j = i + 1; j < stacks.length; j++) {
          const a = stacks[i].box;
          const b = stacks[j].box;
          const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          assert.ok(apart, `${s.id}: ${stacks[i].type} and ${stacks[j].type} overlap`);
        }
      }
      // the explanations ("?" icons) arrive in the editor, and each one is short
      const notes = drawn.map((block) => block.getCommentText() ?? '').filter((text) => text !== '');
      assert.ok(notes.length >= 2, `${s.id}: has notes`);
      for (const text of notes) assert.ok(text.length <= 250, `${s.id}: a note is short ("${text}")`);
      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      const fromBuilder = runMatch({ game: logistiqueGame, scenario: RULES_SETUP, program: s.program });
      const fromEditor = runMatch({ game: logistiqueGame, scenario: RULES_SETUP, program: saved });
      assert.deepEqual(fromEditor, fromBuilder, s.id);
      assert.equal(fromEditor.errors, undefined, s.id);
      assert.equal(fromEditor.total, RESULTS[s.id].points, s.id);
    }
    disposeEditor(Blockly, workspace);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Logistique intelligente stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/logistique-intelligente/sample-catalog.ts';
  const SAMPLES = 'simulator/logistique-intelligente/samples.ts';
  // the only file that may import them
  const SERVER_LIST = 'simulator/members/all-examples.ts';

  /** Every source file below src/ that is not a test: its path from src/ and its text. */
  const files = new Map<string, string>();
  const walk = (folder: string): void => {
    for (const entry of readdirSync(path.join(SRC, folder), { withFileTypes: true })) {
      const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (/\.(ts|tsx|mjs|js|jsx|css|json)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) {
        files.set(relative, readFileSync(path.join(SRC, relative), 'utf8'));
      }
    }
  };
  walk('');

  /** The files a file imports from (as paths from src/, without extension). */
  const importsOf = (file: string, text: string): string[] =>
    [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((match) => {
      const specifier = match[1];
      if (specifier.startsWith('@/')) return specifier.slice(2);
      if (specifier.startsWith('.')) return path.posix.join(path.posix.dirname(file), specifier);
      return specifier;
    });

  test('the list of titles imports nothing; the programs import the builder, the list, the French words of the blocks and types', () => {
    const catalog = files.get(CATALOG);
    const samples = files.get(SAMPLES);
    assert.ok(catalog && samples);
    assert.deepEqual(importsOf(CATALOG, catalog), []);
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/blocks/fr', 'simulator/blocks/stack-size', 'simulator/core/types', 'simulator/logistique-intelligente/sample-catalog', 'simulator/vm/builder']);
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'logi-[a-z0-9-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test("nothing but the server's list of all examples may import them - no file of the simulator screen, no page (and the tests)", () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers(CATALOG), [SAMPLES, SERVER_LIST]);
    assert.deepEqual(importers(SAMPLES), [SERVER_LIST]);
  });

  test('no other file holds a title, an id or the words after a heading of these examples (letters as French has them)', () => {
    const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // (a French word may begin or end with "é": the boundaries are those of Unicode letters, not \b)
    const words = (text: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${text.trim().split(/\s+/).map(escape).join('\\s+')}(?![\\p{L}\\p{N}])`, 'iu');
    const telling: RegExp[] = [
      ...SAMPLE_CATALOG.map((card) => words(card.title)),
      ...SAMPLE_CATALOG.map((card) => new RegExp(`(?<![\\w-])${escape(card.id)}(?![\\w-])`, 'i')),
      // (the words after a heading as the guard of the server looks for them: as they are written - "Toute la mission,
      //  pour chaque disposition." of Tri d'entrepôt's advanced example is not "toute la mission")
      ...EXAMPLE_LEVELS.map((level) => new RegExp(escape(level.about))),
    ];
    for (const [file, text] of files) {
      if (file === CATALOG || file === SAMPLES || file === SERVER_LIST) continue;
      const found = telling.find((marker) => marker.test(text));
      assert.equal(found, undefined, `${file} says "${found?.exec(text)?.[0]}"`);
    }
    // the boundaries see a French title whole, its no-break space as a blank; the words after a heading are looked for as written
    assert.ok(new RegExp(escape(EXAMPLE_LEVELS[2].about)).test('about: "toute la mission"') && !new RegExp(escape(EXAMPLE_LEVELS[2].about)).test('Toute la mission, pour chaque disposition.'));
    assert.ok(words(SAMPLE_CATALOG[5].title).test('TOUTE LA MISSION : 500 POINTS') && !words(SAMPLE_CATALOG[5].title).test('Toute la mission : 5000 points'));
  });
});
