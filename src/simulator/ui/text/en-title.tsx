/**
 * The English words of the title row (./types.ts TitleText): part of the English word table
 * (./en.tsx spreads them in, so EN_TEXT.homeCrumb IS this homeCrumb).
 *
 * They are a file of their own because the title row is on the loading screen of every simulator
 * page, and the Simulator page imports from ../TitleBar.tsx too: what the title row reads must
 * stay small (./title-context.tsx). This file imports nothing but React's JSX.
 */
import type { TitleText } from './types';

export const EN_TITLE_TEXT: TitleText = {
  breadcrumb: 'Breadcrumb',
  homeCrumb: 'Home',
  simulatorCrumb: 'Simulator',
  simulatorTitle: (title) => <>{title} simulator </>,
  poweredBy: 'Powered by ',
};
