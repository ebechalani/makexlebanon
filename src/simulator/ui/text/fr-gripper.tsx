/**
 * The French of the window "Inside the Gripper blocks" (./gripper.tsx GripperText), for the page
 * of Tri d’entrepôt (Robot en fête 2027): the twin of the English there. "tu", the infinitive on a
 * button and in its hint, a no-break space before : ; ! ? and inside « », the My Blocks under
 * « Mes blocs ». Part of the French word table (./fr.tsx): only the French page downloads it.
 */
import type { GripperChange } from '../../blocks/gripper-original';
import type { GripperText } from './gripper';

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
  addHint: `Mettre les cinq blocs dans ton espace de travail, sous ${MY_BLOCKS}. Tu peux les modifier comme tous tes blocs.`,
  convertButton: 'Montrer mon programme à la manière de mBlock',
  convertHint: `Remplacer chaque bloc de la pince de ton programme par son bloc de ${MY_BLOCKS}.`,
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
