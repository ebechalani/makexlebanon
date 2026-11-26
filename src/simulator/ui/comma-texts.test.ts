/**
 * A number with a decimal comma typed into a TEXT bubble ("mettre distance à (30,5)"): the program
 * counts it as no number - as on the robot, so the simulator keeps it - and the French screen,
 * which writes every number with a comma, says so at Start (./comma-texts.ts, the console words
 * commaTextWarning, ./useSimulation.ts). The English screen says nothing.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createSimulation } from '../core/simulation';
import { robotEnFeteGame } from '../robot-en-fete/game';
import { eq, gt, ifThen, lt, moveCm, program, script, setVar, v, whenStart } from '../vm/builder';
import { defaultScenario } from '../warehouse-sort/scenario';
import { LINE_LEAVE_START, warehouseSortGame } from '../warehouse-sort/game';
import { commaNumberTexts } from './comma-texts';
import { EN_TEXT } from './text/en';
import { FR_TEXT } from './text/fr';

const NB = ' ';
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** "mettre distance à (<typed>)", then "avancer de (distance) cm". */
const byVariable = (typed: string) => program([script(whenStart(), [setVar('distance', typed), moveCm('forward', v('distance'))])], { variables: ['distance'] });

test('the texts that look like a number with a decimal comma: in "mettre … à" and in < > =, not elsewhere, not under a round block', () => {
  assert.deepEqual(commaNumberTexts(byVariable('30,5')), ['30,5']);
  assert.deepEqual(commaNumberTexts(program([script(whenStart(), [ifThen(lt(v('distance'), '7,5'), [])])], { variables: ['distance'] })), ['7,5']);
  assert.deepEqual(commaNumberTexts(program([script(whenStart(), [ifThen(gt(',5', '-0,5'), []), ifThen(eq('12,', '3'), [])])])), [',5', '-0,5', '12,']);
  // a number with a point, a text that is a sentence, a list of numbers, a number alone: no warning
  for (const typed of ['30.5', '30', 'Bonjour, robot', '1,5,3', 'red', '']) assert.deepEqual(commaNumberTexts(byVariable(typed)), [], typed);
  // a bubble covered by a round block is not what the program reads
  const covered = byVariable('30,5');
  const set = covered.blocks?.blocks?.[0].next?.block;
  assert.equal(set?.type, 'data_setvariableto');
  set!.inputs!.VALUE.block = { type: 'data_variable', id: 'cover', fields: { VARIABLE: { id: 'distance' } } };
  assert.deepEqual(commaNumberTexts(covered), []);
});

test('the program counts "30,5" in a text bubble as no number, as the robot does: the robot does not leave the start zone (the same in both games)', () => {
  const leftStart = (game: typeof robotEnFeteGame, typed: string): boolean => {
    const sim = createSimulation({ game, scenario: defaultScenario(), program: byVariable(typed) as never, seed: 1 });
    sim.start();
    while (sim.status === 'running' && sim.world.time < 10) sim.step(10);
    return sim.score().lines.find((line) => line.id === LINE_LEAVE_START)?.ok === true;
  };
  assert.equal(leftStart(robotEnFeteGame, '30,5'), false);
  assert.equal(leftStart(robotEnFeteGame, '30.5'), true);
  assert.equal(leftStart(warehouseSortGame, '30,5'), false, 'the engine is the same: nothing changed for English');
});

test('the warning: French, with its no-break spaces and the number with a point; English: none', () => {
  assert.equal(EN_TEXT.commaTextWarning('30,5'), null);
  assert.equal(
    FR_TEXT.commaTextWarning('30,5'),
    `«${NB}30,5${NB}» est un texte dans cette bulle, pas un nombre (seules les bulles de nombre lisent la virgule)${NB}: écris 30.5, avec un point.`,
  );
  assert.ok(FR_TEXT.commaTextWarning(',5')?.includes(' écris .5, avec un point.'));
  // the screen gives it at Start, after the other two warnings, once per text, for block programs only
  const hook = readFileSync(path.join(HERE, 'useSimulation.ts'), 'utf8');
  assert.match(hook, /if \(blockProgram\) \{\s+for \(const typed of commaNumberTexts\(program\)\) \{\s+const line = text\.commaTextWarning\(typed\);\s+if \(line\) addLog\(\{ time: 0, level: 'warn', text: line \}\);/);
});
