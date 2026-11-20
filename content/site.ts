/**
 * Global site information.
 * Edit this file to change contact details, links, and navigation.
 */

// (seasons.ts imports nothing, so there is no import cycle; it is plain data, which the menu of
// every page then carries: the Header is a client component)
import { simulatorSeasons } from './seasons';

export const site = {
  name: 'MakeX Lebanon',
  shortName: 'MakeX Lebanon',
  tagline: 'Robotics competitions for Lebanese students, ages 4 to 19.',
  description:
    'MakeX Lebanon organises national robotics competitions that promote STEAM education, ' +
    'creativity and problem solving, and send Lebanese teams to MakeX international ' +
    'championships around the world.',
  url: 'https://www.makexlebanon.com',
  locale: 'en_LB',

  contact: {
    email: 'Eddy.Bachaalany@makexlebanon.com',
    phone: '+961 78 859 898',
    phoneHref: '+96178859898',
    country: 'Lebanon',
    /** Direct WhatsApp chat, used on the old site for field-map orders. */
    whatsapp: 'https://wa.me/message/IAM22DUP6UWAH1',
  },

  social: [
    { label: 'Facebook', href: 'https://www.facebook.com/108977428819241' },
    { label: 'Instagram', href: 'https://www.instagram.com/makex.lebanon/' },
    { label: 'YouTube', href: 'https://www.youtube.com/makexlebanon' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@makexlebanon' },
  ],

  /** External team / academy portal. */
  portal: {
    label: 'Team Portal',
    href: 'https://make-x2026.vercel.app/academy',
  },

  /** Referee and volunteer sign-up form. */
  volunteer: {
    label: 'Register as a volunteer or referee',
    href: 'https://tinyurl.com/makexreferees2026',
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
  /**
   * The desktop dropdown is as wide as its longest line (never narrower than the usual w-56), so
   * that no line breaks: "Warehouse Sort — Season 2026" does not fit in w-56. It is at most
   * max-w-sm wide, so that it still ends inside the window at 1024 px: a longer line breaks. (Set
   * only where it is needed, so that the other dropdowns stay as they are.)
   */
  childrenOnOneLine?: boolean;
};

/**
 * The dropdown of "Simulator": the Simulator page, then every simulator in the order of that page
 * (Season 2026 first), as "Warehouse Sort — Season 2026". Built from `simulatorSeasons()`, the
 * list the page shows, so a simulator added in content/seasons.ts appears here by itself, in its
 * season's place. (The sections can be handed in, for the tests.)
 */
export function simulatorMenu(sections = simulatorSeasons()): NonNullable<NavItem['children']> {
  return [
    { label: 'All simulators', href: '/simulator' },
    ...sections.flatMap((section) =>
      section.simulators.map((simulator) => ({
        label: `${simulator.menuName ?? simulator.name} — Season ${section.year}`,
        href: simulator.href,
      })),
    ),
  ];
}

export const nav: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Seasons',
    href: '/season/2026',
    children: [
      { label: 'Season 2027 — Fire Rescue ✨', href: '/season/2027' },
      { label: 'Season 2026 — Capelli Sport', href: '/season/2026' },
    ],
  },
  {
    label: 'Competitions',
    href: '/competitions',
    children: [
      { label: 'National', href: '/competitions/national' },
      { label: 'International', href: '/competitions/international' },
    ],
  },
  { label: 'Gallery', href: '/gallery' },
  {
    label: 'Training',
    href: '/training',
    children: [
      { label: 'Training & hints', href: '/training' },
      { label: 'Workshops & events', href: '/workshops' },
      { label: 'Competition kits', href: '/kits' },
    ],
  },
  // the simulators: one page that lists them by season (src/app/simulator/page.tsx), and a
  // dropdown that opens each one directly
  { label: 'Simulator', href: '/simulator', children: simulatorMenu(), childrenOnOneLine: true },
  { label: 'Videos', href: '/media' },
  { label: 'Contact', href: '/contact' },
];
