import type { Metadata } from 'next';
import { site } from '@content/site';
import { standaloneCategories } from '@content/standalone';
import { LogistiqueLoader } from '@/simulator/ui/logistique-intelligente/LogistiqueLoader';

/**
 * The simulator Logistique intelligente of Robot en fête 2027 (content/standalone.ts): the regular
 * mission of MakeX Inspire 2024, "Smart Logistics", all in French - the screen, the blocks, the
 * Rules window, the score sheet, the console and the examples. (Robot en fête 2027 names its
 * French simulators by their mission: this one is « Logistique intelligente », the second after
 * « Tri d’entrepôt ».)
 * The page's title and description are French as well; the site's header, menu and footer around
 * it stay English, and so does <html lang="en">: the screen itself says lang="fr".
 *
 * (No hreflang link: this simulator has no English page.)
 */
const PATH = '/simulator/logistique-intelligente';
const TITLE = 'Simulateur mBot2 — Logistique intelligente (Robot en fête 2027)';
const DESCRIPTION =
  'Construis un programme avec des blocs comme dans mBlock et regarde un mBot2 de Makeblock ranger dix cubes ' +
  'jaunes dans les entrepôts du tapis MakeX Inspire « Smart Logistics » : deux cubes au plus par entrepôt, le ' +
  'deuxième posé sur le premier — avec le score de la mission normale des règles MakeX Inspire 2024 : 500 points ' +
  'au plus. Gratuit, dans le navigateur.';

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
export default function LogistiqueIntelligenteSimulatorPage() {
  // (its title row names who Robot en fête 2027 is proposed by, not the academy of the season simulators)
  const category = standaloneCategories.find((entry) => entry.slug === 'robot-en-fete');
  if (!category) throw new Error('content/standalone.ts has no Robot en fête 2027');
  return <LogistiqueLoader poweredBy={category.poweredBy} />;
}
