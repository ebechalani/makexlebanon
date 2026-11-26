import type { Metadata } from 'next';
import { site } from '@content/site';
import { RobotEnFeteLoader } from '@/simulator/ui/robot-en-fete/RobotEnFeteLoader';

/**
 * The simulator Tri d’entrepôt of Robot en fête 2027 (content/standalone.ts): the Warehouse Sort
 * mission, all in French - the screen, the blocks, the Rules window, the score sheet, the console
 * and the examples. (Robot en fête 2027 names its French simulators by their mission: this one is
 * « Tri d’entrepôt », the French version of Warehouse Sort.)
 * The page's title and description are French as well; the site's header, menu and footer around
 * it stay English, and so does <html lang="en">: the screen itself says lang="fr".
 *
 * (No hreflang link between this page and /simulator/warehouse-sort: it would change the English
 * page's head too.)
 */
const PATH = '/simulator/tri-entrepot';
const TITLE = 'Simulateur mBot2 — Tri d’entrepôt (Robot en fête 2027)';
const DESCRIPTION =
  'Construis un programme avec des blocs comme dans mBlock et regarde un mBot2 de Makeblock ranger des cubes ' +
  'rouges et verts sur le tapis Inspire de MakeX Lebanon : des entrepôts vers la baie de leur couleur, en ' +
  'laissant le cube bleu à sa place, puis se garer — avec toutes les dispositions des cubes, et le score que donnent ' +
  'les règles de la mission pour débutants « Warehouse Sort ». Gratuit, dans le navigateur. Tri d’entrepôt est ' +
  'la version française de Warehouse Sort.';

/**
 * The site's share card (src/app/opengraph-image.tsx). A page that sets its own `openGraph`
 * no longer inherits that picture, so it is named here again. (The picture and its alt text are
 * the site's own, in English.)
 */
const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: `${site.name} — national robotics competition`,
};

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    // (the page is French; the site's own locale is en_LB)
    locale: 'fr_LB',
    siteName: site.name,
    url: PATH,
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

/**
 * The page itself is rendered on the server (title row and loading message, in French); the
 * simulator inside it runs in the browser only. It fills the window under the site header, so this
 * page has no PageHero: its heading and breadcrumb are the simulator's slim title row.
 */
export default function TriEntrepotSimulatorPage() {
  return <RobotEnFeteLoader />;
}
