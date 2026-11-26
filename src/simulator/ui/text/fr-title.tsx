/**
 * The French words of the title row (./types.ts TitleText): part of the French word table
 * (./fr-screen.tsx hands them on, so FR_TEXT.homeCrumb IS this homeCrumb).
 *
 * A file of its own, the twin of ./en-title.tsx: the loading screen of the French page shows the
 * title row before the screen has loaded, and it must not download the whole French table for
 * five words (../robot-en-fete/RobotEnFeteLoader.tsx sets them through ./title-context.tsx).
 * This file imports nothing but React's JSX.
 */
import type { TitleText } from './types';

export const FR_TITLE_TEXT: TitleText = {
  breadcrumb: 'Fil d’Ariane',
  homeCrumb: 'Accueil',
  simulatorCrumb: 'Simulateur',
  simulatorTitle: (title) => <>Simulateur {title} </>,
  poweredBy: 'Proposé par ',
};
