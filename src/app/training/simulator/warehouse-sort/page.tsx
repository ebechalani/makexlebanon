import type { Metadata } from 'next';
import { site } from '@content/site';
import { WarehouseSortLoader } from '@/simulator/ui/warehouse-sort/WarehouseSortLoader';

const PATH = '/training/simulator/warehouse-sort';
const TITLE = 'mBot2 simulator — Warehouse Sort';
const DESCRIPTION =
  'Build a program with mBlock-style blocks and watch a Makeblock mBot2 sort red and green cubes ' +
  'on the MakeX Lebanon Inspire mat: from the four warehouses into the bay of their colour, then ' +
  'park — with any arrangement of the cubes, scored by the rules of the beginner mission ' +
  '“Warehouse Sort”. Free, in the browser.';

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
export default function WarehouseSortSimulatorPage() {
  return <WarehouseSortLoader />;
}
