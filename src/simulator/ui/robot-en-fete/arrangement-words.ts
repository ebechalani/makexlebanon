/**
 * Robot en fête 2027: the words of the Cube colours panel ("Couleurs des cubes",
 * ../warehouse-sort/ArrangementEditor.tsx with `words={FR_ARRANGEMENT_WORDS}`). The panel and
 * what it allows are Warehouse Sort's (../warehouse-sort/arrangement-panel.ts); only the words are
 * French: the warehouses E1 - E4, the colours of a cube (rouge, vert, bleu), the letters R, V, B
 * of the codes, and the sentences of a refused or a double change.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { FR_CODEC, FR_PLACE, FR_SCENARIO_TEXT, NB, frCubeColour, frWarehouse } from '../../robot-en-fete/scenario-words';
import type { ArrangementWords } from '../warehouse-sort/arrangement-panel';

export const FR_ARRANGEMENT_WORDS = {
  warehouse: frWarehouse,
  place: (w) => FR_PLACE[w] ?? w,
  color: frCubeColour,
  // (the letters drawn on the cubes of this game, and of its codes: V for vert)
  letter: (color) => FR_CODEC.letters[color] ?? '?',
  legend: 'Les cubes dans les entrepôts',
  chipsLabel: (name) => `Cube dans ${name}`,
  notAColour: 'Un cube est rouge, vert ou bleu.',
  notPossible: (problems) => `Pas possible. ${problems.join(' ')}`,
  blueMoved: (from, now) => `Un seul cube peut être bleu${NB}: ${from} est ${now} maintenant.`,
  blueStays: 'Un cube doit être bleu. Pour le déplacer, choisis bleu pour un autre entrepôt.',
  lastOfColour: (missing) => `Pas possible${NB}: alors aucun cube ne serait ${missing}. Au moins un cube doit être ${missing}.`,
  problems: FR_SCENARIO_TEXT.scenarioProblems,
} satisfies Required<ArrangementWords>;
