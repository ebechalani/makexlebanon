import type { Metadata } from 'next';
import { site } from '@content/site';
import { FireRescueLoader } from '@/simulator/ui/fire-rescue/FireRescueLoader';

/**
 * Fire Rescue Senior (ages 13–15): the simulator of the Fire Rescue page from before the category
 * was split. The address of that page now leads here (next.config.mjs).
 */
const PATH = '/simulator/fire-rescue-senior';
const TITLE = 'mBot2 simulator — Fire Rescue Senior';
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 run it on the MakeX Lebanon ' +
  '2027 Fire Rescue mat — on any starting combination: the buckets, the people and their squares, ' +
  'scored by the category rules. Free, in the browser, for Fire Rescue Senior, ages 13–15.';

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
export default function FireRescueSeniorSimulatorPage() {
  return <FireRescueLoader />;
}
