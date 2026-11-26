/**
 * The French of the stage (the ruler, the enlarged stage, the start position, the canvas) and of
 * program files (./types.ts StageText, FileText). Part of the French word table (./fr.tsx).
 *
 * The numbers of the ruler have a decimal comma - "32,5 cm" - also on the canvas: that is the
 * text a student copies into the blocks, and the French workspace reads the comma (design D10).
 */
import { CATEGORIES, getCategory } from '../../blocks/catalog';
import { FR_CATEGORY_NAMES } from '../../blocks/fr';
import type { ProgramJson } from '../../core/types';
import { foreignBlocks, gameName, parseProgramFile as englishParseProgramFile, programGameOf, type ParsedProgramFile, type WithoutRetiredBlocks } from '../program-file';
import { MAX_RULER_POINTS, measureRuler, placeRulerLabels, type Ruler, type RulerLabel, type RulerLabelStyle } from '../ruler';
import { escapeAction } from '../stage-view';
import type { HomeKind } from '../start-pose';
import { NB, withComma } from './fr-common';
import { frPlural } from './plural';
import type { FileText, StageText } from './types';

// =============================================================================================
// The ruler
// =============================================================================================

/** cmText (../ruler.ts) in French: 325 -> "32,5 cm". */
const cmText = (mm: number): string => `${withComma((Math.round(mm) / 10).toFixed(1))} cm`;

/** turnText (../ruler.ts) in French: 90 -> "90° à droite", -45 -> "45° à gauche", 0 -> "tout droit", 180 -> "demi-tour". */
function turnText(degrees: number): string {
  if (degrees === 0) return 'tout droit';
  if (Math.abs(degrees) === 180) return 'demi-tour';
  return degrees > 0 ? `${degrees}° à droite` : `${-degrees}° à gauche`;
}

/** rulerReading (../ruler.ts) in French: "Depuis le robot : 45° à gauche, puis 30,0 cm". */
function rulerReading(ruler: Ruler, robotThere = true): string {
  const { pieces, turns, totalMm } = measureRuler(ruler);
  if (pieces.length === 0) return '';
  const steps: string[] = [];
  pieces.forEach((piece, i) => {
    const turn = turns[i];
    if (turn !== null) steps.push(turnText(turn));
    steps.push(cmText(piece.mm));
  });
  const start = ruler.startHeading === null ? '' : robotThere ? `Depuis le robot${NB}: ` : `Depuis la place du robot${NB}: `;
  const total = pieces.length > 1 ? `\u00a0– ${cmText(totalMm)} en tout` : '';
  return `${start}${steps.join(', puis ')}${total}`;
}

/** rulerText (../ruler.ts) in French: how to begin, or the measurement. */
function rulerText(ruler: Ruler, robotThere = true): string {
  if (ruler.points.length === 0) return 'Clique sur le tapis pour poser le premier point. Clique sur le robot pour que la règle parte d’entre ses roues.';
  if (ruler.points.length === 1) {
    if (ruler.startHeading === null) return 'Premier point posé. Clique maintenant pour poser le deuxième point.';
    return robotThere
      ? 'La règle part d’entre les roues du robot. Clique maintenant là où le robot doit aller.'
      : 'La règle part de la place du robot. Clique maintenant pour poser le deuxième point.';
  }
  const full = ruler.points.length >= MAX_RULER_POINTS ? ` (La règle est pleine${NB}: ${MAX_RULER_POINTS} points.)` : '';
  return `${rulerReading(ruler, robotThere)}${full}`;
}

/** rulerLabels (../ruler.ts) in French: the same places, found for the French texts. */
const rulerLabels = (ruler: Ruler, style: RulerLabelStyle): RulerLabel[] =>
  placeRulerLabels(ruler, style, { cm: cmText, turn: turnText, total: (mm) => `${cmText(mm)} en tout` });

export const FR_STAGE_TEXT: StageText = {
  cmText,
  turnText,
  rulerReading,
  rulerText,
  rulerLabels,
  sizeButtonHint: (state) => {
    if (!state.enlarged) return 'Montrer la scène aussi grande que la fenêtre le permet';
    return escapeAction(state) === 'shrink'
      ? 'Revenir à la taille normale (la touche Échap fait la même chose)'
      : 'Revenir à la taille normale (la touche Échap efface d’abord le dernier point de la règle)';
  },
  readyHint: (startZoneName, rulerOn, enlarged) => {
    if (rulerOn) return `Prêt. La règle est allumée${NB}: clique sur le tapis pour poser des points. Pour déplacer le robot, éteins la règle.`;
    return `Prêt. Fais glisser le robot dans la ${startZoneName}${NB}; tourne-le avec les boutons ${enlarged ? 'à côté' : 'en dessous'} du tapis.`;
  },
  homeButtonWords: (kind: HomeKind, startZoneName: string) =>
    kind === 'default'
      ? { label: 'Remettre le robot à sa position de départ habituelle', hint: `Retour à la position de départ habituelle dans la ${startZoneName}` }
      : { label: `Mettre le robot au milieu de la ${startZoneName}`, hint: `Milieu de la ${startZoneName}` },
  matRuler: `Le tapis de compétition vu de dessus. La règle est allumée${NB}: un clic sur le tapis pose un point. La mesure est écrite à côté du tapis.`,
  matPlacing: `Le tapis de compétition vu de dessus. Le robot peut être placé${NB}: fais-le glisser, ou utilise les flèches pour le déplacer et Q ou E pour le tourner.`,
  matWatching: 'Le tapis de compétition vu de dessus, avec le robot et les éléments du jeu.',
};

// =============================================================================================
// Program files
// =============================================================================================

/** The three sentences of parseProgramFile (../program-file.ts), in French. */
export const FR_FILE_PROBLEMS: Readonly<Record<string, string>> = {
  'This file is not a program file (it is not valid JSON).': 'Ce fichier n’est pas un fichier de programme (ce n’est pas du JSON valide).',
  'This program file is damaged: the blocks are missing.': `Ce fichier de programme est abîmé${NB}: les blocs manquent.`,
  'This file does not contain an mBot2 simulator program.': 'Ce fichier ne contient pas de programme du simulateur mBot2.',
};

/** parseProgramFile (../program-file.ts) in French: the file is read as it always is; a file that is no program gets the French sentence. */
function parseProgramFile(text: string): ParsedProgramFile {
  const parsed = englishParseProgramFile(text);
  return parsed.ok ? parsed : { ok: false, error: FR_FILE_PROBLEMS[parsed.error] ?? parsed.error };
}

/** What the English list of foreignBlocks calls a group, and what it is in French ("Gripper" -> "Pince"; "... of the other robot" -> "... de l’autre robot"). */
function frenchGroup(english: string): string {
  const OTHER = ' of the other robot';
  const other = english.endsWith(OTHER);
  const name = other ? english.slice(0, -OTHER.length) : english;
  const category = CATEGORIES.find((c) => getCategory(c.id).name === name);
  const french = category ? (FR_CATEGORY_NAMES[category.id] ?? name) : name;
  return other ? `${french} de l’autre robot` : french;
}

/** otherGameNote (../program-file.ts) in French. (The names of the games are names: they stay as their pages write them.) */
function otherGameNote(program: ProgramJson, fileGame: string | null, gameId: string): string | null {
  const foreign = foreignBlocks(program, gameId);
  const fromOtherGame = fileGame !== null && programGameOf(fileGame) !== programGameOf(gameId);
  const from = fromOtherGame && gameName(fileGame) !== '' ? `Ce programme a été enregistré dans le simulateur ${gameName(fileGame)}. ` : '';
  if (foreign.count === 0) return from === '' ? null : `${from}Tous ses blocs marchent aussi ici.`;
  const groups = foreign.groups.map(frenchGroup).join(', ');
  return frPlural(
    foreign.count,
    `${from}${foreign.count} de ses blocs sert à des pièces que ce robot n’a pas (${groups})${NB}: il ne marche pas ici.`,
    `${from}${foreign.count} de ses blocs servent à des pièces que ce robot n’a pas (${groups})${NB}: ils ne marchent pas ici.`,
  );
}

/** The parts of RETIRED_BLOCKS (../program-file.ts) and the two owners of a program, in French. */
const FR_RETIRED_PARTS: Readonly<Record<string, string>> = { 'flame sensor': 'capteur de flamme' };
const FR_WHOSE: Readonly<Record<'this program' | 'your saved program', string>> = { 'this program': 'ce programme', 'your saved program': 'ton programme enregistré' };

/** retiredBlocksNote (../program-file.ts) in French: what was taken out and why, and where to look. */
function retiredBlocksNote(taken: Pick<WithoutRetiredBlocks, 'removed' | 'parts'>, whose: 'this program' | 'your saved program'): string | null {
  if (taken.removed === 0) return null;
  const n = taken.removed;
  const what = taken.parts.map((part) => FR_RETIRED_PARTS[part] ?? part).join(' et ');
  const owner = FR_WHOSE[whose];
  return (
    frPlural(n, `${n} bloc du ${what} a été retiré de ${owner}, `, `${n} blocs du ${what} ont été retirés de ${owner}, `) +
    `parce que le simulateur n’a plus de ${what}. ` +
    frPlural(
      n,
      `Regarde l’endroit où il était${NB}: une case y est vide maintenant, ou montre un nombre ou un texte que tu n’as pas choisi.`,
      `Regarde les endroits où ils étaient${NB}: une case y est vide maintenant, ou montre un nombre ou un texte que tu n’as pas choisi.`,
    )
  );
}

export const FR_FILE_TEXT: FileText = {
  parseProgramFile,
  otherGameNote,
  editorLoading: 'Chargement des blocs…',
  editorFailed: 'L’éditeur de blocs n’a pas pu être chargé. Recharge la page.',
  retiredBlocksNote,
};
