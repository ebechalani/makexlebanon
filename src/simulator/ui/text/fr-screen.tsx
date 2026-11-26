/**
 * The French of the title row, the screen itself, the strip above the blocks, the Examples
 * window and the panel of the arrangement (./types.ts TitleText, AppText, ProgramText,
 * CombinationText). Part of the French word table (./fr.tsx); the texts are those of the design's
 * table (fr-strings.json), with "tu" and the infinitive for buttons.
 */
import { CODE_LOOKS_LIKE } from '../member-unlock';
import { capital } from '../screen-words';
import type { CodeStatus } from '../useMemberExamples';
import type { CodeMessage, ExamplesView } from '../examples-words';
import { EN_TEXT } from './en';
import { NB } from './fr-common';
import { frPlural } from './plural';
import type { AppText, CombinationText, ExamplesWords, ProgramText } from './types';

// =============================================================================================
// The title row
// =============================================================================================

// (a file of its own, which the loading screen reads without the rest of the table)
export { FR_TITLE_TEXT } from './fr-title';

// =============================================================================================
// The screen
// =============================================================================================

export const FR_APP_TEXT: AppText = {
  notAllowed: (startZoneName) => `Le robot doit être tout entier dans la ${startZoneName}.`,
  notAllowedAtAngle: (notAllowed) => `${notAllowed} Il n’y entre pas avec cet angle.`,
  placingProblem: (notAllowed) => `Pas possible${NB}: ${notAllowed.charAt(0).toLowerCase()}${notAllowed.slice(1)} Il reste où il était.`,
  editorStillLoading: 'L’éditeur de blocs est encore en train de se charger. Réessaie dans un instant.',
  nothingToRun: (canLoadExamples) =>
    canLoadExamples
      ? `Rien à exécuter pour l’instant${NB}: accroche des blocs sous le bloc jaune «${NB}lorsque CyberPi démarre${NB}», ou ouvre un des Exemples.`
      : `Rien à exécuter pour l’instant${NB}: accroche des blocs sous le bloc jaune «${NB}lorsque CyberPi démarre${NB}», puis appuie de nouveau sur Démarrer.`,
  replaceConfirm: (what) => `Remplacer les blocs de ton espace de travail par ${what}${NB}?\n(Annuler les fait revenir.)`,
  programNotShown: 'Ce programme n’a pas pu être affiché. Tes blocs n’ont pas changé.',
  newProgramWhat: 'un nouveau programme vide',
  exampleWhat: (title) => `l’exemple «${NB}${title}${NB}»`,
  exampleLoaded: (title) => `Exemple chargé${NB}: ${title}. Appuie sur Démarrer pour le regarder.`,
  fileWhat: (fileName) => `le programme du fichier «${NB}${fileName}${NB}»`,
  openedWithNotes: (fileName, notes) => `${fileName} est ouvert. ${notes.join(' ')}`,
  opened: (fileName) => `${fileName} est ouvert.`,
  programSaved: 'Programme enregistré dans tes téléchargements.',
  blockGone: 'Ce bloc n’est plus dans ton espace de travail.',
  shrink: 'Réduire',
  enlarge: 'Agrandir',
  testOnMany: (scenarios) => `Tester sur plusieurs ${scenarios}`,
  testShort: 'Tester',
  rulesButton: 'Règles',
  rulesRegion: 'Les règles en bref',
  rulesTitle: (title) => (
    <>
      {title}
      {`${NB}: les règles en bref`}
    </>
  ),
  yourProgram: 'Ton programme',
  // (one French sentence each: design 4.5; short, so that on a phone it stays clear of the zoom buttons and the bin, as the English)
  emptyWorkspace: (canLoadExamples) => (
    <>
      <span className="font-bold text-ink-700">Construis ton programme ici.</span> Clique sur une catégorie à gauche (essaie{' '}
      <span className="font-semibold text-ink-700">Châssis mBot2</span>) et accroche un bloc sous le bloc jaune. Puis appuie sur{' '}
      <span className="font-semibold text-ink-700">Démarrer</span>.
      {canLoadExamples && (
        <>
          {' '}
          Ou ouvre un des <span className="font-semibold text-ink-700">Exemples</span>.
        </>
      )}
    </>
  ),
  stageRegion: 'Scène',
  stageEnlarged: 'La scène, agrandie',
  rulerPrefix: `Règle${NB}: `,
  clearRulerHint: 'Effacer la mesure (la touche Échap n’efface que le dernier point)',
  clearRuler: 'Effacer',
  showOnStage: 'Montrer sur la scène',
  zones: 'Zones',
  sensorsButton: 'Capteurs',
  pathHint: 'Dessiner le trajet du robot',
  path: 'Trajet',
  rulerHint: `Mesurer sur le tapis${NB}: clique sur des points pour voir les distances en cm et les virages entre eux`,
  rulerButton: 'Règle',
  cyberPiButtons: 'Boutons du CyberPi',
  cyberPiButtonsHint: 'Maintiens un bouton enfoncé pour appuyer sur celui du robot. Le joystick est dans le panneau CyberPi plus bas.',
  buttonA: 'Bouton A',
  buttonB: 'Bouton B',
  startPosition: 'Position de départ du robot',
  headingHint: `Direction du robot${NB}: 0° = vers le haut du tapis, 90° = vers la droite`,
  turnLeftLabel: (step) => `Tourner le robot de ${step} degrés vers la gauche`,
  turnLeftHint: 'Tourner à gauche (la molette de la souris sur le robot le fait tourner aussi)',
  turnRightLabel: (step) => `Tourner le robot de ${step} degrés vers la droite`,
  turnRightHint: 'Tourner à droite (la molette de la souris sur le robot le fait tourner aussi)',
  turningStep: 'Pas de rotation',
  turningStepHint: 'De combien un appui fait tourner le robot',
  scoreSheet: 'Feuille de score',
  sensorsTitle: 'Capteurs',
  lineSensorReal: 'Le capteur de ligne lit la vraie image du tapis, dessins compris.',
  lineSensorDrawn: 'Le capteur de ligne lit un dessin simplifié du tapis (la vraie image est encore en train de se charger).',
  consoleTitle: 'Console',
  consoleProblems: (count) => frPlural(count, `${count} problème`, `${count} problèmes`),
  consoleMessages: (count) => frPlural(count, `${count} message`, `${count} messages`),
  scenarioLoaded: (scenario) => `${capital(scenario)} chargée. Appuie sur Démarrer pour voir ce que fait ton programme sur cette ${scenario}.`,
  close: 'Fermer',
};

// =============================================================================================
// The strip above the blocks and the Examples window
// =============================================================================================

/** EXAMPLES_WORDS (../examples-words.ts) in French. */
const FR_EXAMPLES_WORDS: ExamplesWords = {
  codeLabel: 'J’ai un code de membre',
  unlock: 'Débloquer',
  membersOnly: 'Réservé aux membres',
  loadExample: 'Charger cet exemple',
  tryAgain: 'Réessayer',
  loadingExamples: 'Chargement des exemples…',
  websiteNotReached: `Les exemples ne peuvent pas être affichés${NB}: le site n’a pas pu être joint. Vérifie ta connexion à Internet, puis réessaie.`,
  noExamples: 'Il n’y a pas encore d’exemples.',
  savedOnThisDevice: `Enregistré sur cet appareil${NB}:`,
  notSaved: `Ce navigateur ne peut pas enregistrer ton code${NB}: tu devras le taper de nouveau la prochaine fois.`,
  useDifferentCode: 'Utiliser un autre code',
  differentCodeLabel: 'Un autre code',
  useThisCode: 'Utiliser ce code',
  keepCurrentCode: 'Annuler',
  currentCodeStays: 'Rien ne change tant qu’il n’est pas accepté.',
  currentCodeStillInUse: 'Ton code actuel est toujours utilisé.',
  forget: 'Oublier ce code sur cet appareil',
  forgetQuestion: `Oublier ce code${NB}? Les exemples qu’il a ouverts seront verrouillés jusqu’à ce que tu le tapes de nouveau.`,
  forgetNo: 'Le garder',
  forgetYes: 'Oui, l’oublier',
  buttonHint: 'Programmes tout prêts',
  buttonHintLocked: 'Programmes tout prêts pour les membres inscrits',
};

const WHAT_THEY_ARE = 'Des programmes tout prêts à exécuter, lire et modifier.';
const HOW_LOADING_WORKS = 'En charger un remplace les blocs de ton espace de travail (Annuler les fait revenir).';

/** examplesIntro (../examples-words.ts) in French: the same views, the same rules about what may be said. */
function examplesIntro(view: ExamplesView, organisation: string, howLoadingWorks: string = HOW_LOADING_WORKS): string {
  const members = `membres inscrits de ${organisation}`;
  switch (view) {
    case 'unlocked':
    case 'all-open':
    case 'checking-some-open':
      return `${WHAT_THEY_ARE} ${howLoadingWorks}`;
    case 'some-open':
      return `${WHAT_THEY_ARE} ${howLoadingWorks} Ceux marqués «${NB}${FR_EXAMPLES_WORDS.membersOnly}${NB}» sont pour les ${members}.`;
    case 'checking-saved':
      return `Ces programmes tout prêts sont pour les ${members}.`;
    case 'locked':
      return `Ces programmes tout prêts sont pour les ${members}${NB}: tape ton code de membre ci-dessous et ils s’ouvrent tout de suite. Tout le reste du simulateur marche sans code.`;
    case 'not-known':
      return WHAT_THEY_ARE;
  }
}

/** How long to wait, the way one would say it (waitInWords of ../examples-words.ts). */
function waitInWords(seconds: number | undefined): string {
  if (seconds === undefined || !(seconds > 0)) return 'un peu';
  if (seconds <= 15) return 'un instant';
  if (seconds <= 90) return 'une minute';
  return `${Math.ceil(seconds / 60)} minutes`;
}

/** codeMessage (../examples-words.ts) in French: the same cases, the same tones. */
function codeMessage(status: CodeStatus, organisation: string, unlocked = false): CodeMessage {
  const saved = status.about === 'saved';
  const looksLike = `Un code ressemble à ${CODE_LOOKS_LIKE}.`;
  const checkTyping = `Vérifie s’il y a une faute de frappe\u00a0– un code ressemble à ${CODE_LOOKS_LIKE}.`;
  switch (status.phase) {
    case 'none':
      return unlocked
        ? { tone: 'hint', rest: [looksLike, FR_EXAMPLES_WORDS.currentCodeStays] }
        : { tone: 'hint', rest: [looksLike, `Les membres reçoivent le leur de ${organisation}.`] };
    case 'checking':
      return { tone: 'info', lead: saved ? 'Vérification du code de membre enregistré sur cet appareil…' : 'Vérification de ton code…', rest: [] };
    case 'unlocked':
      return {
        tone: 'good',
        lead: status.replaced ? `Ton nouveau code est accepté${NB}: tous les exemples ci-dessous sont prêts à être chargés.` : `Débloqué${NB}: tous les exemples ci-dessous sont prêts à être chargés.`,
        rest: [],
      };
    case 'rejected':
      if (unlocked) {
        return { tone: 'bad', lead: 'Ce code n’a pas été accepté, donc rien n’a changé.', rest: [checkTyping, FR_EXAMPLES_WORDS.currentCodeStillInUse] };
      }
      return saved
        ? {
            tone: 'bad',
            lead: 'Le code de membre enregistré sur cet appareil ne marche plus, donc les exemples qu’il ouvrait sont de nouveau verrouillés.',
            rest: [`Demande un nouveau code à ${organisation}, puis tape-le ici.`],
          }
        : { tone: 'bad', lead: 'Ce code n’a pas ouvert les exemples.', rest: [checkTyping, `Si cela ne marche toujours pas, demande de l’aide à ${organisation}.`] };
    case 'busy':
      return {
        tone: 'bad',
        lead: 'Trop de codes faux ont été tapés sur ce réseau en peu de temps.',
        rest: [`Attends ${waitInWords(status.waitSeconds)}, puis réessaie.`, ...(unlocked ? [FR_EXAMPLES_WORDS.currentCodeStillInUse] : [])],
      };
    case 'unreachable':
      if (unlocked) {
        return {
          tone: 'bad',
          lead: 'Le site n’a pas pu être joint, donc ton code n’a pas pu être vérifié.',
          rest: ['Vérifie ta connexion à Internet et réessaie.', FR_EXAMPLES_WORDS.currentCodeStillInUse],
        };
      }
      return saved
        ? {
            tone: 'bad',
            lead: 'Le site n’a pas pu être joint, donc le code de membre enregistré sur cet appareil n’a pas pu être vérifié.',
            rest: [
              'Les exemples qu’il ouvre restent verrouillés jusqu’à ce qu’il soit vérifié.',
              `Vérifie ta connexion à Internet, puis appuie sur «${NB}${FR_EXAMPLES_WORDS.tryAgain}${NB}».`,
            ],
          }
        : { tone: 'bad', lead: 'Le site n’a pas pu être joint, donc ton code n’a pas pu être vérifié.', rest: ['Vérifie ta connexion à Internet et réessaie.'] };
  }
}

export const FR_PROGRAM_TEXT: ProgramText = {
  toolbarLabel: 'Programme',
  newHint: 'Commencer un nouveau programme vide',
  newButton: 'Nouveau',
  examplesButton: 'Exemples',
  openHint: 'Ouvrir un fichier de programme de cet ordinateur',
  openButton: 'Ouvrir',
  saveHint: 'Enregistrer le programme dans un fichier sur cet ordinateur',
  saveButton: 'Enregistrer',
  undo: 'Annuler',
  undoHint: 'Annuler (Ctrl+Z)',
  redo: 'Rétablir',
  redoHint: 'Rétablir (Ctrl+Maj+Z)',
  autosaveHint: 'Tes blocs sont enregistrés dans ce navigateur un instant après chaque changement.',
  // (short, so that the strip above the blocks keeps one row on a computer as the English one does)
  blockCount: (blocks) => frPlural(blocks, `${blocks} bloc · sauvegarde auto`, `${blocks} blocs · sauvegarde auto`),
  toolbarLoading: 'Chargement…',
  examplesTitle: 'Exemples',
  examplesLevel: (title) => `Exemples${NB}: ${title}`,
  loadExampleLabel: (title) => `Charger l’exemple ${title}`,
  memberCode: 'Code de membre',
  forgetGroup: `Oublier ce code sur cet appareil${NB}?`,
  examplesIntro,
  codeMessage,
  examplesWords: FR_EXAMPLES_WORDS,
};

// =============================================================================================
// The panel of the arrangement
// =============================================================================================

export const FR_COMBINATION_TEXT: CombinationText = {
  scenarioCodeLabel: (scenario, code) => `Code de la ${scenario} ${code}`,
  copyCodeLabel: (scenario) => `Copier le code de la ${scenario}`,
  copyCodeHint: 'Copier le code',
  copied: 'Copié',
  enterCode: 'Taper un code',
  useCode: 'Utiliser',
  randomDrawsLead: (label) => (
    <>
      {label}
      {`${NB}:`}
    </>
  ),
  // (not on this page: Robot en fête gives its own last line, `scenarioNote`, and reads codes its own way, `readCode`)
  scenarioCountNote: EN_TEXT.scenarioCountNote,
  codeReaderOf: EN_TEXT.codeReaderOf,
};
