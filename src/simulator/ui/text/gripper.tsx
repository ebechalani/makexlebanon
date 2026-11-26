/**
 * The words of the window "Inside the Gripper blocks" (../GripperCodeDialog.tsx) in the word table
 * of the screen (./types.ts ScreenText.gripper), in both languages.
 *
 * English is not new: its strings and its three text functions are those of ../gripper-code-words.ts
 * (referenced, not copied - that file's tests keep testing them), and the two picture descriptions
 * are moved here from the window as they were. French is their twin, for the page of Robot en fête
 * 2027: "tu", a no-break space before : ; ! ? and inside « », the My Blocks under « Mes blocs ».
 *
 * The names in these sentences - the My Blocks a button added, a block's label - come from the
 * blocks (../../blocks/gripper-original.ts), in the language of the page.
 */
import type { GripperChange } from '../../blocks/gripper-original';
import type { RobotConfig } from '../../core/types';
import { addedMessage, convertedMessage, GRIPPER_CODE_WORDS, gripperCodeIntro } from '../gripper-code-words';

export interface GripperText {
  /** the title of the window */
  title: string;
  /** above the left pictures */
  blockHeading: string;
  /** above the right pictures */
  codeHeading: string;
  /** the same two, short: on a phone they stand above every picture */
  blockCaption: string;
  codeCaption: string;
  addButton: string;
  addHint: string;
  convertButton: string;
  convertHint: string;
  /** while Blockly draws the pictures */
  drawing: string;
  drawingFailed: string;
  /** a button was pressed before the student's editor was ready */
  notReady: string;
  /** a button could not change the program */
  failed: string;
  /** the sentences at the top of the window; the servo names come from the robot */
  intro(config: RobotConfig): string[];
  /** what the window says after "Add these My Blocks to my program" */
  addedMessage(change: Pick<GripperChange, 'added' | 'myBlocks'>): string;
  /** what the window says after "Show my program the mBlock way" */
  convertedMessage(change: Pick<GripperChange, 'replaced' | 'added'>): string;
  /** what a screen reader says for the picture of a Gripper block (`label`: the block in words) */
  blockPicture(label: string): string;
  /** ... and for the picture of its My Block (`lines`: one block per line, in words) */
  codePicture(lines: readonly string[]): string;
}

export const EN_GRIPPER_TEXT: GripperText = {
  title: GRIPPER_CODE_WORDS.title,
  blockHeading: GRIPPER_CODE_WORDS.blockHeading,
  codeHeading: GRIPPER_CODE_WORDS.codeHeading,
  blockCaption: GRIPPER_CODE_WORDS.blockCaption,
  codeCaption: GRIPPER_CODE_WORDS.codeCaption,
  addButton: GRIPPER_CODE_WORDS.addButton,
  addHint: GRIPPER_CODE_WORDS.addHint,
  convertButton: GRIPPER_CODE_WORDS.convertButton,
  convertHint: GRIPPER_CODE_WORDS.convertHint,
  drawing: GRIPPER_CODE_WORDS.drawing,
  drawingFailed: GRIPPER_CODE_WORDS.drawingFailed,
  notReady: GRIPPER_CODE_WORDS.notReady,
  failed: GRIPPER_CODE_WORDS.failed,
  intro: gripperCodeIntro,
  addedMessage,
  convertedMessage,
  blockPicture: (label) => `Gripper block: ${label}`,
  codePicture: (lines) => `My Block: ${lines.join(', ')}`,
};

// =============================================================================================
// French
// =============================================================================================

/** (a no-break space: before : ; ! ? and inside « ») */
const NB = ' ';

/** A word inside French quotes: « Mes blocs ». */
const quoted = (text: string): string => `«${NB}${text}${NB}»`;

const MY_BLOCKS = quoted('Mes blocs');

/** "la pince s’ouvre, la pince se ferme et le bras monte" */
function frenchList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

const FR_UNDO_ADD = `Ferme cette fenêtre pour les voir${NB}; tu les trouves aussi dans ${MY_BLOCKS}. Annuler les enlève de nouveau.`;

/** French: the first form for 0 and 1 ("1 bloc a été ajouté"), the second from 2 on. */
const one = (n: number): boolean => n <= 1;

function frenchAddedMessage(change: Pick<GripperChange, 'added' | 'myBlocks'>): string {
  const added = change.added.length;
  const total = Object.keys(change.myBlocks).length;
  if (added === 0) return `Rien n’a été ajouté${NB}: les ${total} blocs sont déjà dans ton programme. Regarde dans ${MY_BLOCKS}.`;
  if (added === total) return `${added} blocs ont été ajoutés à ton programme. ${FR_UNDO_ADD}`;
  const already = total - added;
  return (
    (one(added)
      ? `${added} bloc a été ajouté à ton programme${NB}: ${frenchList(change.added)}. `
      : `${added} blocs ont été ajoutés à ton programme${NB}: ${frenchList(change.added)}. `) +
    (one(already) ? `L’autre était déjà là. ${FR_UNDO_ADD}` : `Les ${already} autres étaient déjà là. ${FR_UNDO_ADD}`)
  );
}

function frenchConvertedMessage(change: Pick<GripperChange, 'replaced' | 'added'>): string {
  const replaced = change.replaced;
  if (replaced === 0) return `Ton programme n’a pas de blocs de la pince${NB}: il n’y a rien à changer.`;
  const swapped =
    replaced === 1
      ? `1 bloc de la pince a été remplacé par son bloc de ${MY_BLOCKS}.`
      : `${replaced} blocs de la pince ont été remplacés par leurs blocs de ${MY_BLOCKS}.`;
  return `${swapped} Ferme cette fenêtre pour voir ton programme. Annuler fait revenir les blocs de la pince.`;
}

export const FR_GRIPPER_TEXT: GripperText = {
  title: 'À l’intérieur des blocs de la pince',
  blockHeading: 'Bloc de la pince (seulement dans ce simulateur)',
  codeHeading: `La même chose dans mBlock${NB}: un bloc de ${MY_BLOCKS} que tu fais toi-même`,
  blockCaption: 'Bloc de la pince',
  codeCaption: 'La même chose dans mBlock',
  addButton: 'Ajouter ces blocs à mon programme',
  addHint: `Met les cinq blocs dans ton espace de travail, sous ${MY_BLOCKS}. Tu peux les modifier comme tous tes blocs.`,
  convertButton: 'Montrer mon programme à la manière de mBlock',
  convertHint: `Remplace chaque bloc de la pince de ton programme par son bloc de ${MY_BLOCKS}.`,
  drawing: 'Dessin des blocs…',
  drawingFailed: 'Les blocs n’ont pas pu être dessinés. Recharge la page.',
  notReady: 'L’éditeur de blocs est encore en train de se charger. Réessaie dans un instant.',
  failed: 'Ça n’a pas marché. Tes blocs n’ont pas changé.',
  intro: (config) => {
    const g = config.gripper;
    return [
      `mBlock n’a pas de catégorie Pince${NB}: les blocs de la pince sont des raccourcis que seul ce simulateur a.`,
      `Dans mBlock, tu les fais toi-même dans ${MY_BLOCKS}${NB}: un bloc ${quoted('régler le servo')}, puis une petite attente pendant que le servo bouge.`,
      `Sur ce robot, le servo ${g.liftServo} bouge le bras et le servo ${g.clawServo} bouge la pince.`,
    ];
  },
  addedMessage: frenchAddedMessage,
  convertedMessage: frenchConvertedMessage,
  blockPicture: (label) => `Bloc de la pince${NB}: ${label}`,
  codePicture: (lines) => `Mon bloc${NB}: ${lines.join(', ')}`,
};
