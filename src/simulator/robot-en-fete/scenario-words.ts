/**
 * Robot en fête 2027 (the French page of the Warehouse Sort mission): the words of its
 * arrangements - the codes, the names of the warehouses and of the colours, the places of the
 * warehouses, and the sentences about an arrangement that cannot be played.
 *
 * The arrangements themselves are Warehouse Sort's (../warehouse-sort/scenario.ts): the same 24,
 * the same order, the same rules. Only what is written differs (design D6):
 *
 *   - the warehouses are E1 - E4 ("entrepôt"; W1 - W4 in English). Their ids stay W1 - W4: they
 *     are data (body ids "cube:W1", score line ids "pick:W1"), never shown;
 *   - a code is written with R (rouge), V (vert) and B (bleu): "VR-BR" is the default
 *     arrangement ("GR-BR" in English). The reader also takes G, so a Warehouse Sort code works
 *     here too ("GR-BR" is the same arrangement);
 *   - a colour agrees with its noun: un cube rouge / vert / bleu, une baie rouge / verte.
 *
 * Typography: a no-break space (U+00A0) before : ; ! ? and inside « » (design 4.3).
 *
 * Plain TypeScript (no DOM, no React), so it also runs headless under Node.
 */
import type { BayColor, PadId, WarehouseId } from '../warehouse-sort/field';
import { scenarioCodec, scenarioText, type CubeColor, type ScenarioWords } from '../warehouse-sort/scenario';

/** The no-break space of French typography. */
export const NB = ' ';

/** A text with the decimal point of the English referee written as a comma: "1:23.4" -> "1:23,4" (design D10). */
export const withComma = (text: string): string => text.replace('.', ',');

/** The letters of the codes: R (rouge), V (vert), B (bleu). */
export const FR_LETTERS: Record<CubeColor, string> = { red: 'R', green: 'V', blue: 'B' };
/** The codes of Robot en fête: "VR-BR"; a code with G (green, as Warehouse Sort writes it) is read too. */
export const FR_CODEC = scenarioCodec(FR_LETTERS, { G: 'green' });

/** The name of a warehouse on the French page: E1 - E4. */
export const FR_WAREHOUSE: Record<WarehouseId, string> = { W1: 'E1', W2: 'E2', W3: 'E3', W4: 'E4' };
export const frWarehouse = (w: WarehouseId): string => FR_WAREHOUSE[w] ?? w;

/** The colour of a cube (un cube rouge, vert, bleu). */
export const FR_CUBE_COLOUR: Record<CubeColor, string> = { red: 'rouge', green: 'vert', blue: 'bleu' };
export const frCubeColour = (color: CubeColor): string => FR_CUBE_COLOUR[color] ?? color;
/** The colour of a bay (une baie rouge, verte). */
export const FR_BAY_COLOUR: Record<BayColor, string> = { red: 'rouge', green: 'verte' };
export const frBayColour = (color: BayColor): string => FR_BAY_COLOUR[color] ?? color;
/** Which finish pad: l'aire d'arrivée de gauche / de droite. */
export const FR_PAD: Record<PadId, string> = { left: 'de gauche', right: 'de droite' };

/** Where each warehouse is on the mat (../warehouse-sort/field.ts WAREHOUSES[w].place). */
export const FR_PLACE: Record<WarehouseId, string> = {
  W1: 'en haut à gauche',
  W2: 'en haut à droite',
  W3: 'en bas à gauche',
  W4: 'en bas à droite',
};

/** The sentences about an arrangement (../warehouse-sort/scenario.ts ScenarioWords). */
export const FR_SCENARIO_WORDS: ScenarioWords = {
  warehouse: frWarehouse,
  needsCube: 'Chaque entrepôt a besoin d’un cube rouge, vert ou bleu.',
  noBlue: 'Un cube doit être bleu.',
  // (only said for 2 blue cubes or more)
  manyBlue: (blue) => `Il y a ${blue} cubes bleus. Un seul cube peut être bleu.`,
  noRed: 'Au moins un cube doit être rouge.',
  noGreen: 'Au moins un cube doit être vert.',
  cannotPlay: (problems) => `Cette disposition ne peut pas être jouée. ${problems.join(' ')}`,
  describe: (where) => `Rouge${NB}: ${where('red')}. Vert${NB}: ${where('green')}. Bleu${NB}: ${where('blue')} (à laisser).`,
};

/** scenarioProblems and describeScenario in French. */
export const FR_SCENARIO_TEXT = scenarioText(FR_SCENARIO_WORDS);
