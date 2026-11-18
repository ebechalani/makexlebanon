import type { Metadata } from 'next';
import { site } from '@content/site';
import { LockerRoomLoader } from '@/simulator/ui/locker-room/LockerRoomLoader';

const PATH = '/simulator/locker-room';
const TITLE = 'mBot2 simulator — Locker Room';
// (not the category's full name: the simulator's pages must not hold the name of a level of the
// examples, and "Starter" is one - see src/simulator/members/client-guard.test.ts)
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 play the Capelli “Locker Room” ' +
  'mission of MakeX Lebanon Season 2026 (ages 13–15): carry the Team Box to the Scan Station, scan the ' +
  'team colour, bring the cube of that colour to its big circle to open the stadium gate, then sort the ' +
  'three tokens in the maze — with any draw of the two cards, scored by the organiser’s newest rules. ' +
  'Free, in the browser.';

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
export default function LockerRoomSimulatorPage() {
  return <LockerRoomLoader />;
}
