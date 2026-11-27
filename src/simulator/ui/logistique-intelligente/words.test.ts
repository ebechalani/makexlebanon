/**
 * The words Logistique intelligente gives the simulator screen (./words.ts), its title (./title.ts)
 * and its panel « Le terrain » (./SetupList.tsx): every one French and true of this game - the
 * same 23 keys as Tri d'entrepôt, the design's texts (its 7.2 and 7.3), the numbers from the
 * game's constants, French typography, « dessous / dessus » for the layers.
 *
 * Run with:  npm run test:sim
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSimulation } from '../../core/simulation';
import { STORAGE_SQUARE_IDS, WAREHOUSE_IDS, WAREHOUSE_SIZE, WAREHOUSES } from '../../logistique-intelligente/field';
import { CUBE_COUNT, CUBE_FILL, LINE_FAULTS, MAX_PER_WAREHOUSE, MAX_SCORE, POINTS_PER_CUBE, VIOLATION_POINTS, cubeStart, logistiqueGame } from '../../logistique-intelligente/game';
import { RULES_SETUP, SCENARIO_COUNT, randomScenario } from '../../logistique-intelligente/scenario';
import { program, script, whenStart } from '../../vm/builder';
import { ROBOT_EN_FETE_WORDS } from '../robot-en-fete/words';
import { DEFAULT_WORDS, type ScreenWords } from '../screen-words';
import { FR_TEXT } from '../text/fr';
import { SETUP_LINES, SQUARE_PLACES, SetupList } from './SetupList';
import { LOGISTIQUE_TITLE } from './title';
import { LOGISTIQUE_START_ZONE, LOGISTIQUE_WORDS, WAREHOUSE_COUNT, inLetters } from './words';

const NB = '\u00a0';
const read = (file: string): string => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

/**
 * What is wrong with a French text of this screen, or null: French typography (a no-break space
 * before : ; ! ? % » and the dash –, after «; no straight quotes; « – », not " - ", for a dash),
 * no decimal point, no warehouse named W1 - W8, « tu » and not « vous », a layer is « dessous /
 * dessus » (« de haut en bas », the reading order of the mat, names no layer).
 */
function frenchProblem(text: string): string | null {
  if (/\bW[1-8]\b/.test(text)) return 'names a warehouse W1 - W8';
  if (/\d\.\d/.test(text)) return 'a number with a decimal point';
  if (/['"]/.test(text)) return 'a straight apostrophe or quotation mark';
  if (/«(?!\u00a0)/.test(text) || /(?<!\u00a0)»/.test(text)) return 'no no-break space inside « »';
  if (/(?<!\u00a0)[:;!?%]/.test(text.replace(/\d:\d/g, ''))) return 'no no-break space before : ; ! ? %';
  if (/(?<!\u00a0)–/.test(text)) return 'no no-break space before the dash';
  if (/ - /.test(text)) return 'a hyphen used as a dash (French writes « – »)';
  if (/\.\.\./.test(text)) return 'three dots (French writes « … »)';
  if (/ {2}|^\s|\s$/.test(text)) return 'two spaces, or a space at an end';
  if (/(?<![\p{L}])(vous|votre|vos)(?![\p{L}])/iu.test(text)) return '« vous » (the screen says « tu »)';
  if (/(?<![\p{L}])en (haut|bas)(?![\p{L}])/u.test(text.replace(/de haut en bas/g, ''))) return 'a layer named « en haut / en bas » (« dessous / dessus »)';
  return null;
}

/** The text of a piece of markup: its tags out, its spaces made one (a no-break space stays one). */
const textOf = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

// =============================================================================================
// The screen's words
// =============================================================================================

test('the screen words: the 23 keys of Tri d’entrepôt, every key of ScreenWords, each French, none the English one', () => {
  const keys = Object.keys(LOGISTIQUE_WORDS).sort();
  assert.deepEqual(keys, Object.keys(ROBOT_EN_FETE_WORDS).sort());
  assert.equal(keys.length, 23);
  // every key the English default has, and the five keys it leaves out
  for (const key of Object.keys(DEFAULT_WORDS)) assert.ok(keys.includes(key), key);
  for (const key of ['goalsShort', 'scenarioSummary', 'scenarioNote', 'grabbed', 'tableEdge']) assert.ok(keys.includes(key), key);
  for (const [key, value] of Object.entries(LOGISTIQUE_WORDS)) {
    assert.ok(value.trim().length > 0, key);
    assert.equal(frenchProblem(value), null, `${key}: ${value}`);
    if (key !== 'match' && key in DEFAULT_WORDS) assert.notEqual(value, DEFAULT_WORDS[key as keyof ScreenWords], `${key} is the English`);
    for (const sentence of value.split(/(?<=[.!?])\s+/)) assert.ok(sentence.length <= 140, `${key}: ${sentence}`);
  }
  assert.equal(LOGISTIQUE_START_ZONE, 'zone de départ');
  assert.equal(LOGISTIQUE_TITLE, 'Logistique intelligente');
  assert.match(read('./title.ts'), /export const LOGISTIQUE_TITLE = 'Logistique intelligente';/);
});

test('the screen words are the design’s texts (its table 7.2), with French typography', () => {
  assert.deepEqual(LOGISTIQUE_WORDS, {
    match: 'match',
    goal: 'objectif',
    goals: 'objectifs',
    goalsShort: 'cubes',
    zonesHint: `Montrer les zones en couleur${NB}: la zone de départ, la zone de stockage et les huit entrepôts`,
    finishedHint: `Dire «${NB}Terminé${NB}» à l’arbitre${NB}: le robot s’arrête, le chrono aussi, et le terrain est noté tel qu’il est`,
    resetHint: 'Remettre les dix cubes sur la croix et le robot dans la zone de départ, prêt pour un nouveau match.',
    sheetNotesHeading: 'Fautes',
    sheetNote:
      `Le terrain est noté à la fin du match. Un cube valide rapporte 50${NB}points${NB}; un entrepôt compte au plus deux cubes valides. ` +
      `Chaque sortie du robot coûte 20${NB}points. Le total n’est jamais en dessous de 0. Comme sur la feuille officielle${NB}: cubes valides ×${NB}50, fautes ×${NB}-20, total, temps de fin.`,
    cleanLine: 'Aucune faute',
    randomLabel: 'Disposition au hasard',
    randomHint: `Ici, il n’y a qu’une disposition${NB}: c’est toujours la même.`,
    defaultLabel: 'Disposition des règles',
    defaultHint: 'Dix cubes en deux étages sur la croix de la zone de stockage, comme dans les règles',
    scenario: 'disposition',
    scenarios: 'dispositions',
    scenarioTitle: 'Le terrain',
    scenarioSummary: 'une seule disposition',
    scenarioNote: `Les cubes sont toujours placés de la même façon${NB}: rien n’est tiré au sort.`,
    batchHint: 'Faire tourner ton programme plusieurs fois',
    batchIntro: `Ici, les cubes sont toujours placés de la même façon${NB}: un seul match suffit pour voir ce que fait ton programme.`,
    grabbed: 'Pince fermée sur',
    tableEdge: 'le bord de la table',
  });
  // the words that are Tri d’entrepôt’s too (the glossary of the French category)
  for (const key of ['match', 'goal', 'goals', 'randomLabel', 'scenario', 'scenarios', 'grabbed', 'tableEdge'] as const) assert.equal(LOGISTIQUE_WORDS[key], ROBOT_EN_FETE_WORDS[key], key);
});

test('the numbers and counts of the words are the game’s: 50 points a cube, two a warehouse, 20 a fault, ten cubes, eight warehouses', () => {
  assert.equal(POINTS_PER_CUBE, 50);
  assert.equal(MAX_PER_WAREHOUSE, 2);
  assert.equal(VIOLATION_POINTS, 20);
  assert.equal(CUBE_COUNT, 10);
  assert.equal(WAREHOUSE_COUNT, 8);
  assert.equal(WAREHOUSE_IDS.length, WAREHOUSE_COUNT);
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map(inLetters), ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix']);
  // (a count the table does not have is written in digits: never a wrong word)
  assert.deepEqual([0, 1, 11, 2.5].map(inLetters), ['0', '1', '11', '2.5']);
  // « × -20 »: the faults' line of the sheet takes 20 points per exit
  assert.ok(LOGISTIQUE_WORDS.sheetNote.includes(`cubes valides ×${NB}${POINTS_PER_CUBE}, fautes ×${NB}-${VIOLATION_POINTS}`));
  // (a number never on another line than its unit, nor « -20 » than its « × »: no-break spaces)
  for (const text of Object.values(LOGISTIQUE_WORDS)) assert.doesNotMatch(text, /\d (cm|mm|points?|secondes?)(?![\p{L}])|× /u, text);
});

test('what the words say is true of the game: one setup, nothing drawn; the zones; ten goals on the sheet; the closed sheet fits', () => {
  // « une seule disposition », « il n’y a qu’une disposition », « rien n’est tiré au sort »
  assert.equal(SCENARIO_COUNT, 1);
  assert.equal(logistiqueGame.scenarioCount(), 1);
  for (const seed of [0, 0.3, 0.99]) assert.equal(randomScenario(() => seed), RULES_SETUP);
  assert.equal(logistiqueGame.defaultScenario(), RULES_SETUP);
  // « zone de départ, zone de stockage et les huit entrepôts »: the zones the stage colours
  const zones = logistiqueGame.overlays(RULES_SETUP);
  assert.deepEqual(
    zones.map((zone) => zone.label),
    ['Zone de départ', 'Zone de stockage', ...WAREHOUSE_IDS],
  );
  assert.equal(zones.filter((zone) => zone.kind === 'delivery').length, WAREHOUSE_COUNT);
  // « Remettre les dix cubes sur la croix »: ten cubes, all on the cross at the start
  assert.equal(logistiqueGame.createBodies(RULES_SETUP).filter((body) => body.kind === 'cube').length, CUBE_COUNT);
  // one goal = one valid cube: ten lines bring points, the faults' line (« Fautes ») brings none
  const sim = createSimulation({ game: logistiqueGame, scenario: RULES_SETUP, program: program([script(whenStart(), [])]) });
  const score = sim.score();
  assert.equal(score.lines.filter((line) => line.max > 0).length, CUBE_COUNT);
  assert.equal(score.lines.filter((line) => line.max > 0 && line.max !== POINTS_PER_CUBE).length, 0);
  const faults = score.lines.find((line) => line.id === LINE_FAULTS);
  assert.ok(faults && faults.max === 0);
  // the closed sheet, at its longest (« 500 / 500 points · cubes : 10/10 »): short enough for a 360 px phone
  const longest = FR_TEXT.scoreSheetSummary({ total: MAX_SCORE, max: MAX_SCORE }, CUBE_COUNT, CUBE_COUNT, LOGISTIQUE_WORDS);
  assert.equal(longest, `500 / 500 points · cubes${NB}: 10/10`);
  assert.ok(longest.length <= 33, longest);
  // the screen adds its own sentence to the hint of « Replacer »
  assert.equal(FR_TEXT.resetHint(LOGISTIQUE_WORDS.resetHint, LOGISTIQUE_WORDS.match), `${LOGISTIQUE_WORDS.resetHint} Possible à tout moment, même pendant un match.`);
  assert.equal(frenchProblem(FR_TEXT.resetHint(LOGISTIQUE_WORDS.resetHint, LOGISTIQUE_WORDS.match)), null);
});

// =============================================================================================
// The panel « Le terrain »
// =============================================================================================

test('« Le terrain »: the design’s list (its 7.3) - the two layers of cubes, the warehouses, the robot - and nothing to click', () => {
  const html = renderToStaticMarkup(createElement(SetupList));
  const lines = [...html.matchAll(/<li\b[^>]*>([^]*?)<\/li>/g)].map((match) => textOf(match[1]));
  assert.deepEqual(lines, [
    `Cubes 1 à 5 (dessous)${NB}: 1 sur le carré du haut, 2 à gauche, 3 au centre, 4 à droite, 5 sur le carré du bas.`,
    `Cubes 6 à 10 (dessus)${NB}: chacun sur un cube du dessous${NB}– 6 sur 1, 7 sur 2, 8 sur 3, 9 sur 4, 10 sur 5.`,
    `Entrepôts${NB}: E1 à E8, huit carrés orange de 4${NB}cm. E1 et E4, dans les coins du haut, sont tournés en losange.`,
    'Le robot part de la zone de départ.',
  ]);
  const note = /<p class="[^"]*">([^<]*)<\/p>/.exec(html);
  assert.ok(note);
  assert.equal(note[1], `C’est la même chose à chaque match. «${NB}Replacer${NB}» remet tout en place.`);
  // « Replacer » is the name of the screen's button
  assert.equal(FR_TEXT.resetLabel, 'Replacer');
  // every line French, with its typography
  for (const text of [...lines, note[1], ...Object.values(SETUP_LINES), ...Object.values(SQUARE_PLACES)]) assert.equal(frenchProblem(text), null, text);
  // the two small squares in front of the cubes are only pictures, in the colour of the cubes on the stage
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((html.match(new RegExp(`background:${CUBE_FILL}`, 'g')) ?? []).length, 2);
  assert.ok(logistiqueGame.createBodies(RULES_SETUP).every((body) => body.fill === CUBE_FILL));
  // nothing to choose: no button, no field, no code
  assert.doesNotMatch(html, /<button|<input|<select|<form/);
  assert.ok(!html.includes(logistiqueGame.encodeScenario(RULES_SETUP)));
  assert.match(read('./SetupList.tsx'), /^'use client';/);
});

test('« Le terrain » is made from the game: each cube on the square and the layer the game puts it, the diamonds, the size of a warehouse', () => {
  const bodies = logistiqueGame.createBodies(RULES_SETUP);
  const byId = new Map(bodies.map((body) => [body.id, body]));
  // the game's own start of every cube: bottom cubes 1 - 5 on the mat, top cube n on cube n - 5, on the same square
  for (let n = 1; n <= CUBE_COUNT; n++) {
    const body = byId.get(`cube:${n}`);
    assert.ok(body, `cube ${n}`);
    const { square, layer } = cubeStart(n);
    if (layer === 'dessous') {
      assert.ok(n <= CUBE_COUNT / 2 && body.z === 0 && body.restingOn === null, `cube ${n}`);
      assert.ok(SETUP_LINES.bottom.includes(`${n} ${SQUARE_PLACES[square]}`), `cube ${n} ${square}`);
    } else {
      const under = byId.get(body.restingOn ?? '');
      assert.ok(under && under.z === 0 && cubeStart(Number(under.id.slice(5))).square === square, `cube ${n}`);
      assert.ok(SETUP_LINES.top.includes(`${n} sur ${under.id.slice(5)}`), `cube ${n}`);
      assert.equal(Math.hypot(body.x - under.x, body.y - under.y), 0, `cube ${n} right on its bottom cube`);
    }
  }
  // the places of the squares are where the squares are: haut above the middle, gauche to its left ...
  const middle = (square: (typeof STORAGE_SQUARE_IDS)[number]) => {
    const n = [1, 2, 3, 4, 5].find((m) => cubeStart(m).square === square) ?? 0;
    const body = byId.get(`cube:${n}`);
    assert.ok(body);
    return body;
  };
  const centre = middle('centre');
  assert.ok(middle('haut').y < centre.y && middle('haut').x === centre.x);
  assert.ok(middle('bas').y > centre.y && middle('bas').x === centre.x);
  assert.ok(middle('gauche').x < centre.x && middle('gauche').y === centre.y);
  assert.ok(middle('droite').x > centre.x && middle('droite').y === centre.y);
  // « E1 et E4, dans les coins du haut, sont tournés en losange »; « carrés … de 4 cm »
  const diamonds = WAREHOUSE_IDS.filter((w) => WAREHOUSES[w].turnedDeg !== 0);
  assert.deepEqual(diamonds, ['E1', 'E4']);
  for (const w of diamonds) assert.ok(WAREHOUSES[w].turnedDeg === 45 && WAREHOUSES[w].centre.y < 100, w);
  assert.ok(WAREHOUSES.E1.centre.x < 100 && WAREHOUSES.E4.centre.x > 1100);
  assert.equal(WAREHOUSE_SIZE, 40);
  assert.equal(STORAGE_SQUARE_IDS.length, 5);
});
