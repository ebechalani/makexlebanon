/**
 * The examples of Robot en fête 2027 (samples.ts): the six examples of Warehouse Sort, in French
 * (design 6, test T8), run for real:
 *
 *   block program (builder)  ->  interpreter  ->  engine  ->  the French referee
 *
 *   - THE SAME PROGRAMS: every block, field, number and id is the one of its twin in
 *     ../warehouse-sort/samples.ts; only the texts differ, one French text for one English text;
 *   - THE SAME MATCHES: on all 24 arrangements, on the vector drawing of the mat and on the
 *     picture the browser reads, each French example is played tick by tick beside its English
 *     twin: the robot and every cube stand in the same place on every tick, and the end, the time,
 *     the points and every score line (id, points, ok, time) are the same - 10, 10, 10, 30, 60
 *     and 80 points, at the end times of the design (0.2). The blue cube never moves;
 *   - FRENCH: every title, heading, description, note, name and printed text is French, with
 *     French typography; only the colour names the sensor gives stay English (design D7);
 *   - what they print fits the 18 columns of the CyberPi screen; they load into the French block
 *     editor without one stack on another, and what it saves plays the same match;
 *   - a French match of "fete-one-cube" names no W1 - W4 in a console line or a score line (T7);
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
import type { BlockJson, MatSampler, ProgramJson, ScoreLine, ScoreReport, SimEvent, Simulation } from '../core/types';
import { EXAMPLE_LEVELS as FIRE_CADET_LEVELS, SAMPLE_CATALOG as FIRE_CADET_CATALOG } from '../fire-cadet/sample-catalog';
import { EXAMPLE_LEVELS as FIRE_CHIEF_LEVELS, SAMPLE_CATALOG as FIRE_CHIEF_CATALOG } from '../fire-chief/sample-catalog';
import { EXAMPLE_LEVELS as FIRE_FIGHTER_LEVELS, SAMPLE_CATALOG as FIRE_FIGHTER_CATALOG } from '../fire-fighter/sample-catalog';
import { EXAMPLE_LEVELS as FIRE_RESCUE_LEVELS, SAMPLE_CATALOG as FIRE_RESCUE_CATALOG } from '../fire-rescue/sample-catalog';
import { EXAMPLE_LEVELS as LOCKER_ROOM_LEVELS, SAMPLE_CATALOG as LOCKER_ROOM_CATALOG } from '../locker-room/sample-catalog';
import { restartFacts } from '../ui/format';
import { ROBOT_EN_FETE_WORDS } from '../ui/robot-en-fete/words';
import { FR_TEXT } from '../ui/text/fr';
import { supportsBlock } from '../vm';
import { MAT_SIZE, MAT_VECTOR, WAREHOUSE_IDS, type WarehouseId } from '../warehouse-sort/field';
import { LINE_BLUE, LINE_PARK, MAX_SCORE, cubeBodyId, deliverLineId, pickLineId, warehouseSortGame } from '../warehouse-sort/game';
import { EXAMPLE_LEVELS as WAREHOUSE_SORT_LEVELS, SAMPLE_CATALOG as WAREHOUSE_SORT_CATALOG } from '../warehouse-sort/sample-catalog';
import * as English from '../warehouse-sort/samples';
import { SCENARIO_COUNT, allScenarios, blueWarehouse, defaultScenario, type WarehouseSortScenario } from '../warehouse-sort/scenario';
import { robotEnFeteGame } from './game';
import { FR_REFEREE_WORDS } from './referee-words';
import { FR_CODEC } from './scenario-words';
import { EXAMPLE_LEVELS, SAMPLE_CATALOG, exampleCard } from './sample-catalog';
import * as French from './samples';
import { SAMPLE_PROGRAMS, getSampleProgram, type SampleProgram } from './samples';

type Sim = Simulation<WarehouseSortScenario>;

/** The folder of this file. */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The no-break space of French typography. */
const NB = ' ';

/** The 24 arrangements, in number order. */
const ARRANGEMENTS: WarehouseSortScenario[] = allScenarios();

/** An arrangement as this page writes it ("VR-BR"). */
const label = (s: WarehouseSortScenario): string => FR_CODEC.encode(s);

function sample(id: string): SampleProgram {
  const s = getSampleProgram(id);
  assert.ok(s, id);
  return s;
}

/** The English twin of a French example: the example of Warehouse Sort at the same place of its list. */
function twinOf(s: SampleProgram): English.SampleProgram {
  const twin = English.SAMPLE_PROGRAMS[SAMPLE_PROGRAMS.indexOf(s)];
  assert.ok(twin, s.id);
  return twin;
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

/** The blocks of the start script, in order (the top level only). */
function startScript(blocks: ProgramJson): BlockJson[] {
  const start = (blocks.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start');
  assert.ok(start);
  const out: BlockJson[] = [];
  for (let block = start.next?.block; block; block = block.next?.block) out.push(block);
  return out;
}

/** A copy of a program in which `change` has changed something (what a "Essaie ..." of a description asks for). */
function changed(blocks: ProgramJson, change: (all: BlockJson[]) => void): ProgramJson {
  const copy = JSON.parse(JSON.stringify(blocks)) as ProgramJson;
  change(blocksOf(copy));
  return copy;
}

/** The numbers of a text, in order, with a decimal comma read as a point: "110,5 cm (E4)" -> [110.5, 4]. */
const numbersIn = (text: string): number[] => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));

// =============================================================================================
// What a French text may not contain
// =============================================================================================

/**
 * English words that are no French words: one of them in a French text is a text left in
 * English. (Taken as words of their own, with Unicode boundaries: "turn" in "tourne" is no word.)
 */
const ENGLISH =
  /(?<![\p{L}\p{N}])(the|of|and|is|it|its|to|at|by|with|from|this|that|then|put|take|down|up|left|right|red|green|blue|look|leave|first|bay|pad|line|drive|turn|found|out|go|try|scores?|seconds?|warehouses?|claw|arm|colou?r|row|way|now|until|back)(?![\p{L}\p{N}])/iu;

/**
 * The colour names the colour sensor gives, as a French sentence may name them (design D7): the
 * value, then its French in brackets - or, in the one sentence that says what the screen shows,
 * the three names the sensor gives.
 */
const D7_VALUES = ['red, green ou blue (rouge, vert ou bleu)', 'red (rouge)', 'green (vert)', `capteur${NB}: red, green ou blue`];

/** What is wrong with a French text, or null (design 4.3, D6, D7, D10). */
function frenchProblem(text: string): string | null {
  if (text.trim() === '') return 'empty';
  if (/\bW[1-4]\b/.test(text)) return 'names a warehouse W1 - W4 (here: E1 - E4)';
  const words = D7_VALUES.reduce((rest, value) => rest.split(value).join(' '), text);
  if (ENGLISH.test(words)) return `an English word: "${ENGLISH.exec(words)?.[0]}"`;
  if (/\d\.\d/.test(text)) return 'a number with a decimal point (French: a comma)';
  if (/'/.test(text)) return "a straight apostrophe (French writes ’)";
  if (/"/.test(text)) return 'straight quotes (French writes « »)';
  if (/\.\.\./.test(text)) return '"..." (French writes …)';
  if (/«(?! )/.test(text) || /(?<! )»/.test(text)) return 'no no-break space inside « »';
  if (/(?<! )[:;!?]/.test(text)) return 'no no-break space before : ; ! ?';
  if (/ - /.test(text)) return 'a hyphen used as a dash (French writes « – »)';
  if (/ (?![:;!?»–])/.test(text.replace(/« /g, ''))) return 'a no-break space where none belongs';
  return null;
}

// =============================================================================================
// The list
// =============================================================================================

describe('the list of the examples', () => {
  test('six examples: the six of Warehouse Sort, in the same order and at the same levels, with ids of their own', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id} ${card.level}`),
      [
        'fete-leave-start starter',
        'fete-white-line starter',
        'fete-cube-colour starter',
        'fete-one-cube intermediate',
        'fete-two-cubes intermediate',
        'fete-all-cubes advanced',
      ],
    );
    // the same examples as Warehouse Sort's, place by place: "sort-" there is "fete-" here
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => `${card.id.replace(/^fete-/, '')} ${card.level}`),
      WAREHOUSE_SORT_CATALOG.map((card) => `${card.id.replace(/^sort-/, '')} ${card.level}`),
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
    assert.equal(getSampleProgram('sort-leave-start'), undefined, 'an example of Warehouse Sort is no example here');
    assert.throws(() => exampleCard('bonjour'), /not on the list/);
  });

  test('the titles and the headings are the French of the design (fr-src/3-examples.txt)', () => {
    assert.deepEqual(
      SAMPLE_CATALOG.map((card) => card.title),
      [
        'Sortir de la zone de départ et s’arrêter',
        'Suivre la ligne blanche jusqu’au T',
        'Lire la couleur d’un cube',
        'Mettre un cube dans sa baie',
        'Deux cubes, puis se garer',
        'Trier les cubes et se garer',
      ],
    );
    assert.deepEqual(
      EXAMPLE_LEVELS.map((level) => [level.id, level.title, level.about]),
      [
        ['starter', 'Premiers pas', 'une chose à la fois'],
        ['intermediate', 'Intermédiaire', 'des cubes dans la bonne baie'],
        ['advanced', 'Avancé', 'tous les cubes, toutes les dispositions'],
      ],
    );
    for (const text of [...SAMPLE_CATALOG.map((card) => card.title), ...EXAMPLE_LEVELS.flatMap((level) => [level.title, level.about])]) {
      assert.equal(frenchProblem(text), null, text);
    }
    // a beginner reads the titles: short (Warehouse Sort: 30 letters; French words are longer)
    for (const card of SAMPLE_CATALOG) assert.ok(card.title.length >= 4 && card.title.length <= 40, card.title);
  });

  test('every id starts with "fete-", and no id, title or heading is used by an example of the other six games - Warehouse Sort included', () => {
    const others = [...FIRE_RESCUE_CATALOG, ...FIRE_CHIEF_CATALOG, ...WAREHOUSE_SORT_CATALOG, ...LOCKER_ROOM_CATALOG, ...FIRE_CADET_CATALOG, ...FIRE_FIGHTER_CATALOG];
    assert.equal(others.length, 7 + 6 + 6 + 6 + 6 + 6);
    const ids = new Set<string>();
    const titles = new Set<string>();
    for (const card of [...others, ...SAMPLE_CATALOG]) {
      assert.ok(!ids.has(card.id), `the id ${card.id} is used twice`);
      assert.ok(!titles.has(card.title.toLowerCase()), `the title "${card.title}" is used twice`);
      ids.add(card.id);
      titles.add(card.title.toLowerCase());
    }
    for (const card of SAMPLE_CATALOG) assert.match(card.id, /^fete-[a-z]+(-[a-z]+)*$/, card.id);
    for (const card of others) assert.ok(!card.id.startsWith('fete-'), card.id);
    // the words after a heading are this game's own
    const otherAbouts = new Set([...FIRE_RESCUE_LEVELS, ...FIRE_CHIEF_LEVELS, ...WAREHOUSE_SORT_LEVELS, ...LOCKER_ROOM_LEVELS, ...FIRE_CADET_LEVELS, ...FIRE_FIGHTER_LEVELS].map((level) => level.about));
    assert.equal(otherAbouts.size, 18);
    for (const level of EXAMPLE_LEVELS) assert.ok(!otherAbouts.has(level.about), level.about);
  });

  test('every description says, in short plain French sentences, what the program does, what it scores and what to try', () => {
    for (const s of SAMPLE_PROGRAMS) {
      assert.ok(s.description.length >= 250 && s.description.length <= 700, `${s.id}: ${s.description.length} characters`);
      assert.match(s.description, /(?<![\p{L}])points(?![\p{L}])/u, `${s.id} says what it scores`);
      assert.match(s.description, /(?<![\p{L}])Essaie(?![\p{L}])/u, `${s.id} says what to try next`);
      assert.ok(!/\s{2,}|\n/.test(s.description), `${s.id}: one paragraph, single blanks`);
      assert.match(s.description, /[.?]$/, `${s.id} ends with a full sentence`);
      assert.equal(frenchProblem(s.description), null, `${s.id}: ${frenchProblem(s.description)}`);
      // beginners of 8 to 12: short sentences (Warehouse Sort: 140 letters; a French sentence is longer)
      for (const sentence of s.description.split(/(?<=[.?!])\s+/)) {
        assert.ok(sentence.length <= 150, `${s.id}: a sentence of ${sentence.length} characters ("${sentence.slice(0, 40)}...")`);
      }
      for (const number of s.description.match(/\d+(?= points)/g) ?? []) assert.ok(Number(number) <= MAX_SCORE, `${s.id}: ${number} points`);
      // it promises what the English description promises: the same numbers, in the same order
      assert.deepEqual(numbersIn(s.description), numbersIn(twinOf(s).description), `${s.id}: the numbers of the description`);
    }
    // the points and the seconds each one promises, as the tests below measure them
    const promised: Record<string, RegExp[]> = {
      'fete-leave-start': [
        new RegExp(`Il marque 10 points quelle que soit la disposition des cubes${NB}: 5 pour la sortie de la zone de départ, et 5 pour un parcours propre \\(sans relance\\)\\.`),
        /Il a fini au bout de 2 secondes\./,
      ],
      'fete-white-line': [/Il marque 10 points quelle que soit la disposition \(sortie de la zone de départ, parcours propre\), en 3 secondes\./, /Il ne touche pas le cube devant lui\./],
      'fete-cube-colour': [
        new RegExp(`L’écran montre la couleur du cube, avec le nom que donne le capteur${NB}: red, green ou blue\\.`),
        /Il montre toujours la bonne couleur, quelle que soit la disposition\. Il ne touche pas le cube\./,
        /Il marque 10 points \(sortie de la zone de départ, parcours propre\), en 3 secondes\./,
      ],
      'fete-one-cube': [
        new RegExp(`Bleu${NB}: le robot le laisse où il est et prend à la place le cube en bas à gauche\\.`),
        /Il marque 30 points quelle que soit la disposition, en 11 à 17 secondes\. Il ne déplace jamais le cube bleu\./,
      ],
      'fete-two-cubes': [
        new RegExp(`Bleu${NB}: il le laisse et prend le cube de gauche\\.`),
        /Il marque 60 points quelle que soit la disposition, en 32 à 38 secondes\. Il ne déplace jamais le cube bleu\./,
        /se gare sur l’aire d’arrivée de gauche/,
      ],
      'fete-all-cubes': [
        new RegExp(`Bleu${NB}: il laisse le cube où il est\\.`),
        /Il marque 80 points sur chacune des 24 dispositions, en 53 à 61 secondes sur 90\. Il ne déplace jamais le cube bleu\./,
        /Il ne devine jamais une couleur\./,
      ],
    };
    for (const s of SAMPLE_PROGRAMS) for (const promise of promised[s.id]) assert.match(s.description, promise, s.id);
    // the lines are white on this mat: the line follower says so, and so does the note on its first block
    assert.match(sample('fete-white-line').description, /Ici, les lignes sont BLANCHES sur un tapis noir\./);
    assert.ok(notesOf(sample('fete-white-line').program).some((text) => text.includes(`«${NB}détecte la ligne${NB}» veut dire blanc ici`)));
    // what the colour sensor at the claw sees is the simulator's own number: said with "Dans ce simulateur"
    for (const s of SAMPLE_PROGRAMS) {
      for (const text of [s.description, ...notesOf(s.program)]) {
        for (const sentence of text.split(/(?<=[.?!])\s+/)) {
          if (/3,5 cm/.test(sentence)) assert.match(sentence, /[Dd]ans ce simulateur/, `${s.id}: "${sentence}"`);
        }
      }
    }
    // every example that drives by distance to a cube says on its first block that a real robot drifts
    for (const id of ['fete-cube-colour', 'fete-one-cube', 'fete-two-cubes', 'fete-all-cubes']) {
      assert.ok(notesOf(sample(id).program).some((text) => /Un vrai robot dévie un peu/.test(text)), id);
    }
    // the three that take cubes say on a block that they look first
    for (const id of ['fete-one-cube', 'fete-two-cubes', 'fete-all-cubes']) {
      assert.ok(notesOf(sample(id).program).some((text) => text.startsWith(`D’abord regarder${NB}!`)), id);
    }
  });
});

// =============================================================================================
// The same programs as in Warehouse Sort
// =============================================================================================

/** A text of a program and where it stands: a note, a printed or compared text, a name. */
interface TextPair {
  en: string;
  fr: string;
  where: string;
}

/**
 * Walk an English program and its French twin side by side and return the texts that differ.
 * Everything else must be the same: every block, its id, its fields, its numbers, its place in the
 * program. Only these may differ - a text (a note, the text in a bubble, the name of a my-block,
 * of an input or of a variable), the size the builder gives a note (it grows with its text), and
 * the x of a stack (frenchLayout in samples.ts).
 */
function differences(en: unknown, fr: unknown, where = '', found: TextPair[] = []): TextPair[] {
  const last = where.split('.').pop() ?? '';
  if (typeof en === 'string' && typeof fr === 'string') {
    if (en !== fr) {
      const isText = ['text', 'TEXT', 'NAME', 'name'].includes(last) || /\.params\.\d+$/.test(where);
      assert.ok(isText, `${where}: "${en}" is "${fr}" - but only a text may differ`);
      found.push({ en, fr, where });
    }
    return found;
  }
  if (typeof en === 'number' && typeof fr === 'number') {
    if (en !== fr) {
      const isLayout = /^blocks\.blocks\.\d+\.x$/.test(where) || /\.comment\.height$/.test(where);
      assert.ok(isLayout, `${where}: the number ${en} is ${fr} - but only the place of a stack or the size of a note may differ`);
    }
    return found;
  }
  if (Array.isArray(en) || Array.isArray(fr)) {
    assert.ok(Array.isArray(en) && Array.isArray(fr) && en.length === fr.length, `${where}: the same list`);
    en.forEach((item, i) => differences(item, (fr as unknown[])[i], `${where}.${i}`, found));
    return found;
  }
  if (en !== null && fr !== null && typeof en === 'object' && typeof fr === 'object') {
    assert.deepEqual(Object.keys(fr), Object.keys(en), `${where}: the same parts, in the same order`);
    for (const key of Object.keys(en)) differences((en as Record<string, unknown>)[key], (fr as Record<string, unknown>)[key], where === '' ? key : `${where}.${key}`, found);
    return found;
  }
  assert.equal(fr, en, where);
  return found;
}

describe('the same programs as in Warehouse Sort', () => {
  test('the numbers they share are those of Warehouse Sort, number for number', () => {
    // (every export that is a number, or a table of numbers: PICK_CM)
    const numbersOf = (module: Record<string, unknown>) =>
      Object.entries(module)
        .filter(([, value]) => typeof value === 'number' || (typeof value === 'object' && value !== null && !Array.isArray(value)))
        .sort(([a], [b]) => a.localeCompare(b));
    const english = numbersOf(English);
    assert.deepEqual(
      english.map(([name]) => name),
      ['BOTTOM_LINE_Y_CM', 'FIRST_PLACE_Y_CM', 'FOLLOW_RPM', 'INTO_BAY_CM', 'LEAVE_CM', 'PARK_LEFT_CM', 'PARK_Y_CM', 'PAST_THE_FRAME_CM', 'PICK_CM', 'PLACE_STEP_CM', 'START_Y_CM', 'STEER_RPM', 'TO_BOTTOM_LINE_CM', 'TO_CUBE_RPM', 'TOP_LINE_Y_CM', 'UP_TO_TOP_LINE_CM'],
    );
    assert.deepEqual(numbersOf(French), english);
  });

  test('every block, field, number and id is the one of the English twin; only the texts are French, one French text for one English text', () => {
    const toFrench = new Map<string, string>();
    const toEnglish = new Map<string, string>();
    let texts = 0;
    for (const s of SAMPLE_PROGRAMS) {
      const twin = twinOf(s);
      assert.equal(blocksOf(s.program).length, blocksOf(twin.program).length, s.id);
      const pairs = differences(twin.program, s.program);
      assert.ok(pairs.length >= 4, `${s.id}: ${pairs.length} texts in French`);
      for (const { en, fr, where } of pairs) {
        assert.equal(toFrench.get(en) ?? fr, fr, `"${en}" is said in two ways (${where})`);
        assert.equal(toEnglish.get(fr) ?? en, en, `"${fr}" says two English texts (${where})`);
        toFrench.set(en, fr);
        toEnglish.set(fr, en);
        // a sentence keeps its numbers (with a decimal comma), a name its digits
        assert.deepEqual(numbersIn(fr), numbersIn(en), `${s.id}, ${where}: "${fr}"`);
      }
      texts += pairs.length;
      // the stacks stand in the same order: the start script first, then the my-blocks as the builder placed them
      const order = (program: ProgramJson) => [...(program.blocks?.blocks ?? [])].sort((a, b) => (a.x ?? 0) - (b.x ?? 0)).map((top) => top.id);
      assert.deepEqual(order(s.program), order(twin.program), `${s.id}: the stacks in the same order`);
    }
    assert.ok(texts > 150, `${texts} texts`);
    // what is left as it is, in a bubble a student sees: the colour names of the sensor (design D7) and numbers;
    // and the names that are the same in French
    const kept = new Set<string>();
    const hidden = new Set<string>();
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        for (const slot of Object.values(block.inputs ?? {})) {
          const text = slot.shadow?.type === 'text' ? slot.shadow.fields?.TEXT : undefined;
          if (typeof text !== 'string') continue;
          // (a bubble with a block in it is hidden: its text is the default the palette gives)
          if (slot.block) hidden.add(text);
          else if (!toEnglish.has(text) && !/^-?\d+(\.\d+)?$/.test(text)) kept.add(text);
        }
      }
      for (const variable of s.program.variables ?? []) if (!toEnglish.has(variable.name)) kept.add(variable.name);
    }
    assert.deepEqual([...kept].sort(), ['blue', 'cm', 'green', 'red', 'y']);
    // the hidden defaults are those of the French palette: "banane" under "regrouper", where Warehouse Sort has "banana"
    assert.deepEqual([...hidden].sort(), ['', '0', '50', 'banane', 'makeblock']);
    assert.equal(toFrench.get('banana'), 'banane');
    // the words a my-block gets as its "way" are the program's own words, in French
    assert.equal(toFrench.get('right'), 'droite');
    assert.equal(toFrench.get('left'), 'gauche');
  });

  test('every comment, name and printed text is French, with French typography (the colour names of the sensor stay English: D7)', () => {
    const problems: string[] = [];
    for (const s of SAMPLE_PROGRAMS) {
      for (const { fr, where } of differences(twinOf(s).program, s.program)) {
        // (a printed text that ends where the sensor's value is joined to it ends with a blank)
        const problem = frenchProblem(fr.replace(/ $/, ''));
        if (problem) problems.push(`${s.id}, ${where}: "${fr}" - ${problem}`);
      }
    }
    assert.deepEqual(problems, []);
    // the names of the my-blocks, as the editor shows them
    const names = new Set(SAMPLE_PROGRAMS.flatMap((s) => blocksOf(s.program).filter((b) => b.type === 'procedures_defnoreturn').map((b) => String(b.fields?.NAME))));
    assert.deepEqual([...names].sort(), [
      'l’amener à sa baie',
      'poser le cube',
      'prendre le cube',
      'prendre un cube de cette rangée',
      'regarder le cube',
      'rouler sur la longue ligne jusqu’à',
      'vers sa baie',
    ]);
    const variables = new Set(SAMPLE_PROGRAMS.flatMap((s) => (s.program.variables ?? []).map((variable) => variable.name)));
    assert.deepEqual([...variables].sort(), ['cm', 'cm à droite', 'cm à gauche', 'couleur', 'place rouge', 'place verte', 'sens', 'y', 'y de la ligne', 'y du robot']);
  });

  test('only blocks of the palette of this page (the one of Warehouse Sort), which the interpreter knows', () => {
    const allowed = new Set([...paletteBlockTypes(robotEnFeteGame.id), ...BUILTIN_BLOCK_TYPES]);
    assert.deepEqual(paletteBlockTypes(robotEnFeteGame.id), paletteBlockTypes(warehouseSortGame.id));
    for (const s of SAMPLE_PROGRAMS) {
      for (const type of new Set(blocksOf(s.program).map((block) => block.type))) {
        assert.ok(allowed.has(type), `${s.id} uses ${type}`);
        assert.ok(supportsBlock(type), `${s.id}: the interpreter knows ${type}`);
      }
    }
  });
});

// =============================================================================================
// The same matches as in Warehouse Sort
// =============================================================================================

interface Pair {
  en: Sim;
  fr: Sim;
  /** ticks on which the robot, its gripper or a cube stood elsewhere in the two matches */
  apart: number;
  /** the events of the two matches, without their words */
  events: { en: unknown[]; fr: unknown[] };
  /** the French events, with their words */
  frEvents: SimEvent[];
  /** French cubes that moved while they were not in the claw */
  pushed: string[];
  /** ticks in which the French robot pressed against something */
  touchTicks: number;
  /** ticks in which the blue cube was not exactly where it stood at the start, or was held */
  blueOutOfPlace: number;
}

/** What a body is, without its words (the letter on a green cube is V here, G in Warehouse Sort). */
const placeOf = (sim: Sim) => ({
  pose: sim.world.robot.pose,
  wheels: [sim.world.robot.left, sim.world.robot.right],
  gripper: sim.world.robot.gripper,
  leds: sim.world.robot.leds,
  touching: sim.world.robot.touching,
  bodies: sim.world.bodies.map((b) => [b.id, b.x, b.y, b.angle, b.z, b.held]),
});

/** An event without its words (the referee's lines are words). */
const eventFacts = (event: SimEvent) => (event.type === 'log' ? { type: event.type, level: event.level, time: event.time } : event);

/** Play an English example and its French twin, tick by tick, side by side; watch the French cubes. */
function playBoth(s: SampleProgram, scenario: WarehouseSortScenario, options: { sampler?: MatSampler; program?: ProgramJson; twin?: ProgramJson } = {}): Pair {
  const en = createSimulation({ game: warehouseSortGame, scenario, program: options.twin ?? twinOf(s).program, sampler: options.sampler });
  const fr = createSimulation({ game: robotEnFeteGame, scenario, program: options.program ?? s.program, sampler: options.sampler });
  const pair: Pair = { en, fr, apart: 0, events: { en: [], fr: [] }, frEvents: [], pushed: [], touchTicks: 0, blueOutOfPlace: 0 };
  const before = new Map(fr.world.bodies.map((b) => [b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held }]));
  const blueId = cubeBodyId(blueWarehouse(scenario) as WarehouseId);
  en.start();
  fr.start();
  while (en.status === 'running' || fr.status === 'running') {
    en.step(1);
    fr.step(1);
    if (JSON.stringify(placeOf(en)) !== JSON.stringify(placeOf(fr))) pair.apart++;
    pair.events.en.push(...en.drainEvents().map(eventFacts));
    const said = fr.drainEvents();
    pair.frEvents.push(...said);
    pair.events.fr.push(...said.map(eventFacts));
    if (fr.world.robot.touching) pair.touchTicks++;
    for (const b of fr.world.bodies) {
      const was = before.get(b.id)!;
      const moved = Math.hypot(b.x - was.x, b.y - was.y) > 1e-9 || b.angle !== was.angle;
      if (!b.held && !was.held && moved) pair.pushed.push(`${b.id} at ${fr.world.time.toFixed(2)}`);
      before.set(b.id, { x: b.x, y: b.y, angle: b.angle, held: b.held });
      if (b.id === blueId && (b.held || b.x !== b.home.x || b.y !== b.home.y || b.angle !== b.home.angle || b.z !== 0)) pair.blueOutOfPlace++;
    }
  }
  return pair;
}

/** The parts of a score sheet that are no words. */
const facts = (line: ScoreLine) => ({ id: line.id, points: line.points, max: line.max, ok: line.ok, time: line.time });
const factsOf = (report: ScoreReport) => ({ total: report.total, max: report.max, complete: report.complete, time: report.time, lines: report.lines.map(facts) });

/** The two matches are one match in two languages: the same moves on every tick, the same end, the same score sheet. */
function assertSameMatch(pair: Pair, what: string): void {
  const { en, fr } = pair;
  assert.equal(pair.apart, 0, `${what}: ${pair.apart} ticks on which something stood elsewhere`);
  assert.equal(fr.status, en.status, what);
  assert.equal(fr.world.time, en.world.time, what);
  assert.equal(fr.finishReason, en.finishReason, what);
  assert.equal(fr.restarts, en.restarts, what);
  assert.deepEqual(factsOf(fr.score()), factsOf(en.score()), `${what}: the score sheet`);
  assert.deepEqual(pair.events.fr, pair.events.en, `${what}: the same events at the same times`);
  assert.deepEqual(fr.vm.errors(), [], `${what}: errors`);
}

/** Nothing went wrong in the French match: no warning, nothing pushed, no bump, never pressed against anything - and the blue cube left alone. */
function assertClean(pair: Pair, what: string): void {
  const warnings = pair.frEvents.flatMap((e) => (e.type === 'log' && e.level !== 'info' ? [e.text] : []));
  assert.deepEqual(warnings, [], `${what}: warnings`);
  assert.deepEqual(pair.pushed, [], `${what}: pushed`);
  assert.deepEqual(pair.frEvents.filter((e) => e.type === 'bump'), [], `${what}: bumps`);
  assert.equal(pair.touchTicks, 0, `${what}: pressed against something`);
  assert.equal(pair.blueOutOfPlace, 0, `${what}: the blue cube left its place`);
  const blue = pair.fr.score().lines.find((l) => l.id === LINE_BLUE);
  assert.ok(blue, what);
  assert.equal(blue.points, 0, `${what}: ${blue.detail}`);
  assert.equal(blue.detail, FR_REFEREE_WORDS.leftAlone, `${what}: "laissé en place"`);
}

/** What the French CyberPi screen shows at the end, for each example (the English one says the same in English). */
function frenchScreen(id: string, scenario: WarehouseSortScenario): string[] {
  const cube = (w: WarehouseId) => `Cube${NB}: ${scenario.cubes[w]}`;
  switch (id) {
    case 'fete-leave-start':
      return [`C’est parti${NB}!`, 'Sorti de la zone'];
    case 'fete-white-line':
      return [`T trouvé${NB}!`];
    case 'fete-cube-colour':
      return [cube('W3')];
    case 'fete-one-cube':
      return scenario.cubes.W4 === 'blue' ? ['Bleu, on le laisse', cube('W3')] : [cube('W4')];
    case 'fete-two-cubes':
      return [];
    default:
      return ['Bleu, on le laisse'];
  }
}

/** The points of each example and when it ends (design 0.2: the same as in Warehouse Sort). */
const RESULTS: Record<string, { points: number; ends: [number, number] }> = {
  'fete-leave-start': { points: 10, ends: [1.85, 1.85] },
  'fete-white-line': { points: 10, ends: [3.17, 3.17] },
  'fete-cube-colour': { points: 10, ends: [3.27, 3.27] },
  'fete-one-cube': { points: 30, ends: [11.19, 16.71] },
  'fete-two-cubes': { points: 60, ends: [32.43, 37.95] },
  'fete-all-cubes': { points: 80, ends: [53.51, 60.84] },
};

describe('the same matches as in Warehouse Sort, on all 24 arrangements', () => {
  assert.equal(ARRANGEMENTS.length, SCENARIO_COUNT);
  for (const s of SAMPLE_PROGRAMS) {
    test(`${s.id}: tick by tick the moves of Warehouse Sort, ${RESULTS[s.id].points} points, the end at ${RESULTS[s.id].ends.join(' - ')} s, the blue cube left alone - and a French screen`, () => {
      const times: number[] = [];
      for (const scenario of ARRANGEMENTS) {
        const pair = playBoth(s, scenario);
        const what = `${s.id} on ${label(scenario)}`;
        assertSameMatch(pair, what);
        assertClean(pair, what);
        assert.equal(pair.fr.finishReason, 'program-ended', what);
        assert.equal(pair.fr.score().total, RESULTS[s.id].points, what);
        times.push(pair.fr.world.time);
        // the blue cube was never in the claw
        const blue = blueWarehouse(scenario) as WarehouseId;
        assert.ok(!pair.frEvents.some((e) => e.type === 'grab' && e.bodyId === cubeBodyId(blue)), `${what}: gripped`);
        // the CyberPi screen speaks French - but for the colour name the sensor gives (D7)
        assert.deepEqual(pair.fr.world.robot.screen.lines, frenchScreen(s.id, scenario), what);
        assert.equal(pair.fr.world.robot.screen.lines.length, pair.en.world.robot.screen.lines.length, what);
      }
      const round = (t: number) => Math.round(t * 100) / 100;
      assert.deepEqual([round(Math.min(...times)), round(Math.max(...times))], RESULTS[s.id].ends, `${s.id}: ${Math.min(...times)} to ${Math.max(...times)} s`);
    });
  }

  test('fete-two-cubes parks on the left pad, fete-all-cubes sorts every red and green cube into its bay - as the French sheet says', () => {
    for (const scenario of ARRANGEMENTS) {
      const two = playBoth(sample('fete-two-cubes'), scenario).fr.score();
      assert.match(two.lines.find((l) => l.id === LINE_PARK)?.detail ?? '', /gauche/, label(scenario));
      const all = playBoth(sample('fete-all-cubes'), scenario).fr.score();
      for (const w of WAREHOUSE_IDS) {
        if (scenario.cubes[w] === 'blue') continue;
        assert.equal(all.lines.find((l) => l.id === pickLineId(w))?.points, 5, `${label(scenario)} ${w}`);
        assert.equal(all.lines.find((l) => l.id === deliverLineId(w))?.points, 15, `${label(scenario)} ${w}`);
      }
      assert.equal(all.complete, true, label(scenario));
    }
    // the usual arrangement, "VR-BR" here
    assert.equal(label(defaultScenario()), 'VR-BR');
    assert.ok(Math.abs(playBoth(sample('fete-all-cubes'), defaultScenario()).fr.world.time - 58.06) < 0.02);
  });

  test('the tries of the descriptions work with the French words: a shorter drive; the four warehouses in another order ("droite", "gauche")', () => {
    // fete-leave-start: from 1,4 cm on the 5 points are earned, with 1,3 cm not
    const withDistance = (cm: number): ProgramJson =>
      changed(sample('fete-leave-start').program, (all) => {
        all.find((block) => block.type === 'mbot2_straight_cm')!.inputs!.DISTANCE.shadow!.fields!.NUM = cm;
      });
    assert.equal(runMatch({ game: robotEnFeteGame, scenario: defaultScenario(), program: withDistance(1.4) }).total, 10);
    assert.equal(runMatch({ game: robotEnFeteGame, scenario: defaultScenario(), program: withDistance(1.3) }).total, 5);
    // fete-all-cubes: the bottom row first (one of the fastest orders), with the French names of its my-block and its words
    const copy = changed(sample('fete-all-cubes').program, () => undefined);
    const chain = startScript(copy);
    const looks = chain.map((block, i) => ({ block, i })).filter(({ block }) => block.type === 'procedures_callnoreturn' && (block.extraState as { name: string }).name === 'regarder le cube');
    assert.equal(looks.length, 4);
    assert.deepEqual(
      looks.map(({ block }) => block.inputs?.ARG1?.shadow?.fields?.TEXT),
      ['droite', 'droite', 'gauche', 'gauche'],
    );
    // E4, E2, E1, E3 as written; E4, E3, E1, E2 instead: swap the second and the fourth visit (each with its "l’amener à sa baie")
    const pairs = looks.map(({ i }) => [chain[i], chain[i + 1]]);
    const blocks = [...chain.slice(0, looks[0].i), ...pairs[0], ...pairs[3], ...pairs[2], ...pairs[1], ...chain.slice(looks[3].i + 2)];
    for (const block of blocks) delete block.next;
    for (let i = 0; i + 1 < blocks.length; i++) blocks[i].next = { block: blocks[i + 1] };
    (copy.blocks?.blocks ?? []).find((block) => block.type === 'event_cyberpi_start')!.next = { block: blocks[0] };
    for (const scenario of ARRANGEMENTS) {
      const result = runMatch({ game: robotEnFeteGame, scenario, program: copy });
      assert.equal(result.total, 80, label(scenario));
      assert.ok(result.time < 61, `${label(scenario)}: ${result.time} s`);
    }
  });
});

// =============================================================================================
// On the picture the browser reads
// =============================================================================================

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
    const file = path.join(HERE, '../../../public', robotEnFeteGame.mat.sensorImageUrl);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new RasterMatSampler({ data, width: info.width, height: info.height }, MAT_SIZE, MAT_SIZE, MAT_VECTOR.outside);
  } catch {
    return null;
  }
}

describe('the examples on the picture of the mat', () => {
  const picture = loadMatPicture();

  test('the mat of this page is the mat of Warehouse Sort: the same pictures', () => {
    assert.deepEqual(robotEnFeteGame.mat, warehouseSortGame.mat);
  });

  test('on the picture too, every French example plays its English twin tick by tick, on all 24 arrangements', async (t) => {
    const mat = await picture;
    if (!mat) return t.skip('the mat picture could not be decoded (sharp is not installed)');
    for (const s of SAMPLE_PROGRAMS) {
      for (const scenario of ARRANGEMENTS) {
        const pair = playBoth(s, scenario, { sampler: mat });
        const what = `picture, ${s.id} on ${label(scenario)}`;
        assertSameMatch(pair, what);
        assertClean(pair, what);
        assert.equal(pair.fr.score().total, RESULTS[s.id].points, what);
      }
    }
  });
});

// =============================================================================================
// A French match names no W1 - W4 (T7)
// =============================================================================================

test('a French match of fete-one-cube names no W1 - W4: not in a console line of the French screen, not in a score line - with a restart too', () => {
  const consoleOf = (event: SimEvent) =>
    FR_TEXT.describeEvent(event, {
      ...restartFacts(robotEnFeteGame),
      left: Infinity,
      match: ROBOT_EN_FETE_WORDS.match,
      grabbed: ROBOT_EN_FETE_WORDS.grabbed,
      tableEdge: ROBOT_EN_FETE_WORDS.tableEdge,
    });
  const s = sample('fete-one-cube');
  let lines = 0;
  const kinds = new Set<string>();
  for (const scenario of ARRANGEMENTS) {
    for (const restartAt of [Infinity, 8]) {
      const sim = createSimulation({ game: robotEnFeteGame, scenario, program: s.program, seed: 1 });
      sim.start();
      let restarted = false;
      const texts: string[] = [];
      while (sim.status === 'running') {
        sim.step(10);
        if (!restarted && sim.world.time >= restartAt) {
          restarted = true;
          sim.restart();
        }
        for (const event of sim.drainEvents()) {
          const line = consoleOf(event);
          if (!line) continue;
          kinds.add(event.type);
          texts.push(line.text);
        }
      }
      for (const line of sim.score().lines) texts.push(line.label, line.detail);
      texts.push(...sim.world.robot.screen.lines);
      for (const text of texts) assert.doesNotMatch(text, /\bW[1-4]\b/, `${label(scenario)}: "${text}"`);
      lines += texts.length;
    }
  }
  assert.ok(lines > 1000, `${lines} lines`);
  for (const kind of ['log', 'grab', 'release', 'restart', 'finish']) assert.ok(kinds.has(kind), `a "${kind}" line was checked`);
});

// =============================================================================================
// What the examples print
// =============================================================================================

describe('what the examples print', () => {
  /** How many characters one row of the simulator's CyberPi screen holds (read from the panel itself: a longer text is broken there). */
  const columns = Number(/const SCREEN_COLUMNS = (\d+);/.exec(readFileSync(path.join(HERE, '../ui/CyberPiPanel.tsx'), 'utf8'))?.[1]);

  test('every text an example prints fits on one row of the CyberPi screen - with the longest colour name the sensor gives', () => {
    assert.equal(columns, 18, 'the CyberPi screen of the simulator is 18 characters wide');
    const printed: string[] = [];
    for (const s of SAMPLE_PROGRAMS) {
      for (const block of blocksOf(s.program)) {
        if (block.type !== 'cyberpi_print') continue;
        const slot = block.inputs?.TEXT;
        // a written text, or a written text joined to the colour the sensor read ("green" is the longest)
        const join = slot?.block?.type === 'operator_join' ? slot.block : undefined;
        const text = String((join ? join.inputs?.STRING1?.shadow : slot?.shadow)?.fields?.TEXT ?? '');
        const longest = join ? text.length + 'green'.length : text.length;
        assert.ok(text.length > 0 && longest <= columns, `${s.id}: "${text}" shows up to ${longest} characters`);
        printed.push(join ? `${text}…` : text);
      }
    }
    assert.deepEqual(printed, [`C’est parti${NB}!`, 'Sorti de la zone', `T trouvé${NB}!`, `Cube${NB}: …`, 'Bleu, on le laisse', `Cube${NB}: …`, 'Bleu, on le laisse']);
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
  test('the stacks stand side by side by the width of their French rows, with the gap of the builder - not by the English widths', () => {
    let wider = 0;
    for (const s of SAMPLE_PROGRAMS) {
      const tops = [...(s.program.blocks?.blocks ?? [])].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const variables = s.program.variables ?? [];
      assert.equal(tops[0].x, twinOf(s).program.blocks?.blocks?.reduce((left, top) => Math.min(left, top.x ?? 0), Infinity), `${s.id}: the first stack where the builder puts it`);
      for (let i = 0; i + 1 < tops.length; i++) {
        const french = Math.ceil(estimateStackWidth(tops[i], variables, 'fr'));
        assert.equal(tops[i + 1].x, (tops[i].x ?? 0) + french + COLUMN_GAP, `${s.id}: the stack after ${tops[i].type}`);
        if (french > Math.ceil(estimateStackWidth(tops[i], variables, 'en')) + COLUMN_GAP) wider++;
      }
      for (const top of tops) assert.equal(top.y, twinOf(s).program.blocks?.blocks?.find((other) => other.id === top.id)?.y, `${s.id}: the same height`);
    }
    // (why: placed by their English widths, French stacks would lie on one another - measured, it happens)
    assert.ok(wider >= 1, `${wider} stacks are wider in French than the English width and the gap together`);
  });


  test('every example loads into the editor of this page (French blocks), no stack on another, and what Blockly saves plays the same match', async () => {
    const Blockly = await loadBlocklyWithDom();
    const frenchMessages = blocklyMessagesOf(createRequire(import.meta.url)('blockly/msg/fr') as Record<string, unknown>);
    const workspace = createEditor(Blockly, 'editor', { sounds: false, palette: robotEnFeteGame.id, locale: 'fr', frenchMessages });
    for (const s of SAMPLE_PROGRAMS) {
      workspace.clear();
      Blockly.serialization.workspaces.load(s.program as never, workspace);
      const drawn = workspace.getAllBlocks(false);
      assert.ok(drawn.length >= 5, `${s.id}: ${drawn.length} blocks drawn`);
      for (const block of drawn) assert.ok(supportsBlock(block.type), `${s.id}: ${block.type}`);
      // the rows are French (the start block of this page: "lorsque CyberPi démarre")
      const start = drawn.find((block) => block.type === 'event_cyberpi_start');
      assert.match(start?.toString() ?? '', /lorsque/, `${s.id}: ${start?.toString()}`);

      // tidy on the workspace: the start script is the leftmost stack, and no stack lies on top of another
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
      // the explanations ("?" icons) arrive in the editor, and each one is short (Warehouse Sort: 220 letters)
      const notes = drawn.map((block) => block.getCommentText() ?? '').filter((text) => text !== '');
      assert.ok(notes.length >= 2, `${s.id}: has notes`);
      for (const text of notes) assert.ok(text.length <= 250, `${s.id}: a note is short ("${text}")`);

      const saved = Blockly.serialization.workspaces.save(workspace) as ProgramJson;
      // (the first arrangement has the blue cube in E1, the last one in E4: the one-cube example takes its other way there)
      for (const scenario of [defaultScenario(), ARRANGEMENTS[0], ARRANGEMENTS[SCENARIO_COUNT - 1]]) {
        const fromBuilder = runMatch({ game: robotEnFeteGame, scenario, program: s.program });
        const fromEditor = runMatch({ game: robotEnFeteGame, scenario, program: saved });
        assert.deepEqual(fromEditor, fromBuilder, s.id);
        assert.equal(fromEditor.errors, undefined, s.id);
      }
    }
    disposeEditor(Blockly, workspace);
  });
});

// =============================================================================================
// The server-only rule
// =============================================================================================

describe('the examples of Robot en fête 2027 stay on the server, like the ones of the other games', () => {
  // (the folder is worked out with path, not with new URL(..., import.meta.url): the guard of the
  // server, ../members/client-guard.test.ts, reads such a URL as an import of a file)
  const SRC = path.resolve(HERE, '../..');
  const CATALOG = 'simulator/robot-en-fete/sample-catalog.ts';
  const SAMPLES = 'simulator/robot-en-fete/samples.ts';
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
    // (the French words of the blocks: their widths, to place the stacks, and the default texts of the French palette)
    assert.deepEqual(importsOf(SAMPLES, samples).sort(), ['simulator/blocks/fr', 'simulator/blocks/stack-size', 'simulator/core/types', 'simulator/robot-en-fete/sample-catalog', 'simulator/vm/builder']);
    // not the examples of Warehouse Sort: its samples.ts is the server list's alone (its own test says so)
    assert.ok(!importsOf(SAMPLES, samples).some((target) => target.startsWith('simulator/warehouse-sort/')));
    // every entry of the list is one short line: { id, title, level }
    const entries = catalog.match(/^ {2}\{ id: .* level: .*\},$/gm) ?? [];
    assert.equal(entries.length, SAMPLE_CATALOG.length);
    for (const entry of entries) assert.match(entry.trim(), /^\{ id: 'fete-[a-z-]+', title: '[^']{4,80}', level: '(starter|intermediate|advanced)' \},$/);
  });

  test('nothing but the server\'s list of all examples may import them - no file of the simulator screen, no page (and the tests)', () => {
    assert.ok(files.size > 80, `${files.size} source files read`);
    const importers = (target: string): string[] =>
      [...files]
        .filter(([file, text]) => importsOf(file, text).includes(target.replace(/\.ts$/, '')))
        .map(([file]) => file)
        .sort();
    assert.deepEqual(importers(CATALOG), [SERVER_LIST, SAMPLES]);
    assert.deepEqual(importers(SAMPLES), [SERVER_LIST]);
  });

  test('no other file holds a title, an id or the words after a heading of these examples (letters as French has them: "Avancé")', () => {
    const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // (a French word may begin or end with "é": the boundaries are those of Unicode letters, not \b)
    const words = (text: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${text.trim().split(/\s+/).map(escape).join('\\s+')}(?![\\p{L}\\p{N}])`, 'iu');
    const telling: RegExp[] = [
      ...SAMPLE_CATALOG.map((card) => words(card.title)),
      ...SAMPLE_CATALOG.map((card) => new RegExp(`(?<![\\w-])${escape(card.id)}(?![\\w-])`, 'i')),
      ...EXAMPLE_LEVELS.map((level) => words(level.about)),
    ];
    for (const [file, text] of files) {
      if (file === CATALOG || file === SAMPLES || file === SERVER_LIST) continue;
      const found = telling.find((marker) => marker.test(text));
      assert.equal(found, undefined, `${file} says "${found?.exec(text)?.[0]}"`);
    }
    // the boundaries see a French word whole
    assert.ok(words('Avancé').test('« Avancé »') && !words('Avancé').test('Avancées') && !words('Avancé').test('avancer'));
    assert.ok(words('Trier les cubes et se garer').test('TRIER LES CUBES\n  ET SE GARER'));
  });
});
