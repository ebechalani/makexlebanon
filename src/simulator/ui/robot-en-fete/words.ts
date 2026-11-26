/**
 * Robot en fête 2027: the words of the simulator screen that belong to this game - the French
 * twin of ../warehouse-sort/words.ts. The screen's own words (buttons, windows, the console) are
 * in the screen's word table (../text/fr.tsx); these are the ones a game gives (ScreenWords).
 *
 * Every key of ScreenWords is given (`satisfies Required<ScreenWords>`): a key the English game
 * leaves out takes an English default, so on this page a missing key would not compile.
 *
 * The texts are those of the design's French table (fr-strings.json, files
 * "src/simulator/ui/warehouse-sort/words.ts" and "src/simulator/ui/screen-words.ts"), with "tu"
 * for the student and the infinitive for what a button does. Typography: a no-break space
 * (U+00A0) before : ; ! ? and inside « ».
 *
 * Plain TypeScript (no DOM, no React), so the tests can read it under Node.
 */
import { FR_CODEC, NB } from '../../robot-en-fete/scenario-words';
import { BLUE_PENALTY } from '../../warehouse-sort/game';
import { defaultScenario, SCENARIO_COUNT } from '../../warehouse-sort/scenario';
import type { ScreenWords } from '../screen-words';

/** The arrangement a new visitor sees first: "VR-BR" (the "GR-BR" of Warehouse Sort). */
export const ROBOT_EN_FETE_DEFAULT_CODE = FR_CODEC.encode(defaultScenario());

/** What the start zone is called in the sentences about placing the robot ("tout entier dans la zone de départ"). */
export const ROBOT_EN_FETE_START_ZONE = 'zone de départ';

export const ROBOT_EN_FETE_WORDS = {
  match: 'match',
  goal: 'objectif',
  goals: 'objectifs',
  // (on the closed Score sheet: "5 / 80 points · objectifs : 1 sur 9")
  goalsShort: 'objectifs',
  zonesHint: `Montrer les zones en couleur${NB}: zone de départ, entrepôts, les deux baies et les deux aires d’arrivée`,
  finishedHint: `Dire «${NB}Terminé${NB}» à l’arbitre${NB}: le robot s’arrête et le terrain est noté tel qu’il est`,
  resetHint: 'Remettre les quatre cubes dans leurs entrepôts et le robot dans la zone de départ, prêt pour un nouveau départ.',
  sheetNotesHeading: 'Pénalités et remarques',
  sheetNote:
    'Sortir de la zone de départ et prendre un cube comptent une fois. Les cubes dans les baies et le stationnement comptent à la fin. ' +
    `Ici, déplacer le cube bleu coûte ${BLUE_PENALTY} points. Le total n’est jamais en dessous de 0.`,
  cleanLine: 'Aucune pénalité',
  randomLabel: 'Disposition au hasard',
  randomHint: `Tirer au hasard une des ${SCENARIO_COUNT} dispositions`,
  defaultLabel: 'Disposition habituelle',
  defaultHint: `La première disposition du simulateur, ${ROBOT_EN_FETE_DEFAULT_CODE}${NB}: vert en haut à gauche, rouge à droite, bleu en bas à gauche`,
  scenario: 'disposition',
  scenarios: 'dispositions',
  scenarioTitle: 'Couleurs des cubes',
  // (only a screen with one fixed setup shows these words - SimulatorAppProps.fixedSetup - and this
  // one draws its arrangements: never on the page. Given all the same, in French and true, so
  // that every key is French.)
  scenarioSummary: `${SCENARIO_COUNT} dispositions`,
  scenarioNote: `${SCENARIO_COUNT} dispositions sont possibles${NB}: un cube est bleu, les autres rouges ou verts, au moins un de chaque. Changer une couleur remet le terrain au départ.`,
  batchHint: 'Faire tourner ton programme sur plusieurs dispositions à la fois',
  batchIntro:
    'Un bon programme marche avec toutes les dispositions des cubes. Fais tourner tes blocs sur plusieurs dispositions à la fois et regarde où ils échouent. ' +
    'Clique sur un résultat pour le regarder sur la scène.',
  // (the referee counts "pris" only when the cube is lifted 1 cm or carried: closing the claw is not enough)
  grabbed: 'Pince fermée sur',
  // (this mission has no walls: the robot stops where the table ends)
  tableEdge: 'le bord de la table',
} satisfies Required<ScreenWords>;
