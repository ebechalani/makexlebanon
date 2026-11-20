import type { Metadata } from 'next';
import { site } from '@content/site';
import { FireFighterLoader } from '@/simulator/ui/fire-fighter/FireFighterLoader';

/**
 * Fire Fighter (Season 2027, ages 8–10): the mBot2 carries the cubes to the letter towers
 * (src/simulator/fire-fighter).
 */
const PATH = '/simulator/fire-fighter';
const TITLE = 'mBot2 simulator — Fire Fighter';
// (no title, sentence or level name of an example here: the guard of the examples reads this page -
// see src/simulator/members/client-guard.test.ts. "As the rules propose": the organiser has not
// confirmed the scoring yet - the rules call it a proposal.)
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 play the Fire Fighter mission of ' +
  'MakeX Lebanon Season 2027 (ages 8–10): carry the four red cubes to the towers M, A, K and E and the ' +
  'yellow cube to X, and reveal the letters M A K E X — scored as the rules propose. Free, in the browser.';

/**
 * The site's share card (src/app/opengraph-image.tsx). A page that sets its own `openGraph`
 * no longer inherits that picture, so it is named here again.
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
    locale: site.locale,
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
 * The page itself is rendered on the server (title row and loading message); the simulator
 * inside it runs in the browser only. It fills the window under the site header, so this page
 * has no PageHero: its heading and breadcrumb are the simulator's slim title row.
 */
export default function FireFighterSimulatorPage() {
  return <FireFighterLoader />;
}
