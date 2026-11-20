import type { Metadata } from 'next';
import { site } from '@content/site';
import { FireRescueJuniorLoader } from '@/simulator/ui/fire-rescue-junior/FireRescueJuniorLoader';

/**
 * Fire Rescue Junior (ages 10–12): the Fire Rescue game with only the buckets drawn
 * (src/simulator/fire-rescue-junior).
 */
const PATH = '/simulator/fire-rescue-junior';
const TITLE = 'mBot2 simulator — Fire Rescue Junior';
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 run it on the MakeX Lebanon ' +
  '2027 Fire Rescue mat — with the four buckets on the water towers in any of the 24 ways the referee ' +
  'could draw them and everything else where the rule book shows it, scored by the category rules. ' +
  'Free, in the browser, for Fire Rescue Junior, ages 10–12.';

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
export default function FireRescueJuniorSimulatorPage() {
  return <FireRescueJuniorLoader />;
}
