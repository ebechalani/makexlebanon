/**
 * Robot en fête 2027 - « Logistique intelligente »: the words of the simulator screen that belong
 * to this game. The screen's own words (buttons, windows, the console) are in the screen's word
 * table (../text/fr.tsx, FR_TEXT, unchanged); these are the ones a game gives (ScreenWords).
 *
 * Every key of ScreenWords is given (`satisfies Required<ScreenWords>`): a key a game leaves out
 * takes the English default of the first game, so on this page a missing key would not compile.
 * The 23 keys are Tri d'entrepôt's (../robot-en-fete/words.ts). The keys only a hidden part of the
 * screen shows (the Random and Default buttons, the "test on many" window: this game has one setup,
 * SimulatorAppProps.fixedSetup) are given all the same, in French and true.
 *
 * The texts are those of the design's table 7.2, with « tu » for the student and the infinitive for
 * what a button does. Every number is written from the constant that holds it. Typography: a
 * no-break space (U+00A0) before : ; ! ? % and the closing guillemet, after the opening one; × for
 * "times"; "-20" with a hyphen-minus, as Tri d'entrepôt writes a deduction.
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { WAREHOUSE_IDS } from '../../logistique-intelligente/field';
import { CUBE_COUNT, MAX_PER_WAREHOUSE, POINTS_PER_CUBE, VIOLATION_POINTS } from '../../logistique-intelligente/game';
import { NB } from '../../logistique-intelligente/scenario';
import { capital, type ScreenWords } from '../screen-words';

/** The small counts of this game in letters, as a French sentence writes them (« dix cubes », « huit entrepôts »). */
const IN_LETTERS: Readonly<Record<number, string>> = { 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix' };

/**
 * A count in letters: 10 -> « dix », 8 -> « huit ». A count this table does not have is written in
 * digits, so a sentence never says a wrong word for a changed constant (./words.test.ts reads them back).
 */
export function inLetters(count: number): string {
  return IN_LETTERS[count] ?? String(count);
}

/** The number of warehouses on the mat (E1 - E8). */
export const WAREHOUSE_COUNT = WAREHOUSE_IDS.length;

/** What the start zone is called in the sentences about placing the robot (« tout entier dans la zone de départ »). */
export const LOGISTIQUE_START_ZONE = 'zone de départ';

export const LOGISTIQUE_WORDS = {
  match: 'match',
  // (one objective = one valid cube: FR_TEXT writes « 3 objectifs atteints sur 10 »)
  goal: 'objectif',
  goals: 'objectifs',
  // (on the closed Score sheet: « 150 / 500 points · cubes : 3/10 »)
  goalsShort: 'cubes',
  // (the zones as the game draws them: ../../logistique-intelligente/game.ts overlays)
  zonesHint: `Montrer les zones en couleur${NB}: la ${LOGISTIQUE_START_ZONE}, la zone de stockage et les ${inLetters(WAREHOUSE_COUNT)} entrepôts`,
  finishedHint: `Dire «${NB}Terminé${NB}» à l’arbitre${NB}: le robot s’arrête, le chrono aussi, et le terrain est noté tel qu’il est`,
  // (the screen adds « Possible à tout moment, même pendant un match. »)
  resetHint: `Remettre les ${inLetters(CUBE_COUNT)} cubes sur la croix et le robot dans la ${LOGISTIQUE_START_ZONE}, prêt pour un nouveau match.`,
  // (« Fautes » is the rules' "Violation" - R19 - and the heading over the line « Robot sorti du
  // terrain ». FR_TEXT's mark of such a line says « pénalité » (../text/fr-match.tsx markNames): the
  // shared word, unchanged; only this heading is the game's.)
  sheetNotesHeading: 'Fautes',
  sheetNote:
    // (a no-break space keeps a number on the line of its unit, and « × -20 » together, on a phone too)
    `Le terrain est noté à la fin du match. Un cube valide rapporte ${POINTS_PER_CUBE}${NB}points${NB}; un entrepôt compte au plus ${inLetters(MAX_PER_WAREHOUSE)} cubes valides. ` +
    `Chaque sortie du robot coûte ${VIOLATION_POINTS}${NB}points. Le total n’est jamais en dessous de 0. ` +
    // (the four numbers of the official score sheet, p. 31/27: "Quantity of Cube (50 points each)", "Violation (-20points each)", "Total Score", "Completion Time")
    `Comme sur la feuille officielle${NB}: cubes valides ×${NB}${POINTS_PER_CUBE}, fautes ×${NB}-${VIOLATION_POINTS}, total, temps de fin.`,
  cleanLine: 'Aucune faute',
  randomLabel: 'Disposition au hasard',
  randomHint: `Ici, il n’y a qu’une disposition${NB}: c’est toujours la même.`,
  defaultLabel: 'Disposition des règles',
  defaultHint: `${capital(inLetters(CUBE_COUNT))} cubes en deux étages sur la croix de la zone de stockage, comme dans les règles`,
  scenario: 'disposition',
  scenarios: 'dispositions',
  scenarioTitle: 'Le terrain',
  // (beside the heading of the panel « Le terrain », where a game that draws its setup shows a code)
  scenarioSummary: 'une seule disposition',
  scenarioNote: `Les cubes sont toujours placés de la même façon${NB}: rien n’est tiré au sort.`,
  batchHint: 'Faire tourner ton programme plusieurs fois',
  batchIntro: `Ici, les cubes sont toujours placés de la même façon${NB}: un seul match suffit pour voir ce que fait ton programme.`,
  // (the claw closing on a cube: the referee counts nothing for it, so the console does not say « pris »)
  grabbed: 'Pince fermée sur',
  // (the frame stops the robot long before the edge of the table: never said here, given all the same)
  tableEdge: 'le bord de la table',
} satisfies Required<ScreenWords>;
