/**
 * Global site information.
 * Edit this file to change contact details, links, and navigation.
 */

// (seasons.ts and standalone.ts import nothing, so there is no import cycle; they are plain data,
// which the menu of every page then carries: the Header is a client component)
import { simulatorSeasons } from './seasons';
import { simulatorCategories, standaloneCategories, type StandaloneCategory } from './standalone';

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

/** A line of a dropdown, or of a group of one: a link to a page. */
export type NavLink = {
  label: string;
  href: string;
  /** (never: a link has no lines of its own; see NavGroup) */
  children?: never;
};

/**
 * A group of lines in a dropdown: on a computer a row of the dropdown whose lines show beside it
 * when the row is hovered or has the focus; on a phone a button that shows them under it. The row
 * itself is a link too (`href`), so that a tap on a touch screen, which cannot hover, leads to the
 * part of the page that lists the same lines.
 */
export type NavGroup = {
  label: string;
  href: string;
  /** the language of the group's label and of its lines, when it is not the menu's English (lang="fr") */
  lang?: StandaloneCategory['lang'];
  /**
   * what the row holds, in the menu's English, for a screen reader ("5 simulators"): on a computer
   * the row is a link, and this tells that a list of lines goes with it (its aria-describedby)
   */
  description: string;
  children: NavLink[];
};

/** What a dropdown holds: links, and groups of links. */
export type NavChild = NavLink | NavGroup;

export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
};

/** Whether a line of a dropdown is a group of lines (NavGroup) rather than one link. */
export function isNavGroup(child: NavChild): child is NavGroup {
  return child.children !== undefined;
}

/**
 * The dropdown of "Simulator": the Simulator page ("All simulators"), then one group per part of
 * that page, in its order. First the seasons, the newest first ("Season 2027", then "Season
 * 2026"): each group leads to its part of the page (/simulator#season-2027) and holds its
 * simulators by their name, in the order of the page ("Fire Cadet", ... "Fire Chief"; a long name
 * gives way to its `menuName`: "Locker Room"). Then the categories of their own
 * (content/standalone.ts), each a group under its own name ("Robot en fête 2027", leading to
 * /simulator#category-robot-en-fete) with its simulators by their name ("Tri d’entrepôt", then
 * "Logistique intelligente"), in the category's language (lang="fr"). Built from
 * `simulatorSeasons()`, the parts the page shows, and from `simulatorCategories()`, so that a
 * simulator, a season or a category added later appears here by itself, in its place; a season or
 * a category without a simulator has no part and no group. Each group also says how many
 * simulators it holds ("5 simulators"), for a screen reader.
 * (The sections and the categories can be handed in, for the tests.)
 */
export function simulatorMenu(
  sections = simulatorSeasons(),
  standalone: StandaloneCategory[] = standaloneCategories,
): NavChild[] {
  return [
    { label: 'All simulators', href: '/simulator' },
    ...sections.map(
      (section): NavGroup => ({
        label: `Season ${section.year}`,
        href: `/simulator#season-${section.year}`,
        description: simulatorCount(section.simulators.length),
        children: section.simulators.map((simulator) => ({ label: simulator.menuName ?? simulator.name, href: simulator.href })),
      }),
    ),
    ...simulatorCategories(standalone).map(
      (category): NavGroup => ({
        label: category.name,
        href: `/simulator#category-${category.slug}`,
        lang: category.lang,
        description: simulatorCount(category.simulators.length),
        children: category.simulators.map((simulator) => ({ label: simulator.name, href: simulator.href })),
      }),
    ),
  ];
}

/** "1 simulator", "5 simulators" */
function simulatorCount(count: number): string {
  return `${count} simulator${count === 1 ? '' : 's'}`;
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
  // dropdown with a group per part of that page, from which each one opens directly
  { label: 'Simulator', href: '/simulator', children: simulatorMenu() },
  { label: 'Videos', href: '/media' },
  { label: 'Contact', href: '/contact' },
];
