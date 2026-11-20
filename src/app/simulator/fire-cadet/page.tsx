import type { Metadata } from 'next';
import { site } from '@content/site';
import { FireCadetLoader } from '@/simulator/ui/fire-cadet/FireCadetLoader';

const PATH = '/simulator/fire-cadet';
const TITLE = 'mTiny simulator — Fire Cadet';
// (no title, sentence or level name of an example here: the guard of the examples reads this page -
// see src/simulator/members/client-guard.test.ts)
const DESCRIPTION =
  'Lay a row of mTiny coding cards, or drive with taps on the four arrow cards, and watch a Makeblock mTiny play ' +
  'the “Fire Cadet – Rescue City” mission of MakeX Lebanon Season 2027 (ages 4–7): push the Water to the Fire, ' +
  'the Cat to the Safe Zone, the Injured Person to the Hospital and the Equipment back to the Fire Station, round ' +
  'the obstacles. Eight practice maps, or your own. Free, in the browser.';

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
export default function FireCadetSimulatorPage() {
  return <FireCadetLoader />;
}
