import type { Metadata } from 'next';
import { site } from '@content/site';
import { FireChiefLoader } from '@/simulator/ui/fire-chief/FireChiefLoader';

const PATH = '/training/simulator/fire-chief';
const TITLE = 'mBot2 simulator — Fire Chief';
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 find its way through the ' +
  'MakeX Lebanon 2027 Fire Chief maze: around the walls, to the room with the fire, with a flame ' +
  'sensor and a fan — on any maze, scored by the draft rules of the category. Free, in the ' +
  'browser, for ages 14–17.';

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
export default function FireChiefSimulatorPage() {
  return <FireChiefLoader />;
}
