/**
 * Competition seasons, categories and downloadable resources.
 *
 * HOW TO ADD PHOTOS
 * -----------------
 * Every category has a `slug`. Drop image files into:
 *
 *     public/gallery/<season year>/<category slug>/
 *
 * e.g. public/gallery/2026/sportswonderland/final-round-01.jpg
 *
 * They appear automatically on the gallery pages. No code change needed.
 * Supported: .jpg .jpeg .png .webp .avif
 */

export type Download = {
  label: string;
  /** Put the file in public/downloads/ and reference it as /downloads/<file> */
  href: string;
  kind: 'rules' | 'scoresheet' | 'combinations' | 'stl' | 'other';
};

export type Category = {
  slug: string;
  name: string;
  ageRange: string;
  /** Robot platform used, e.g. mTiny or mBot2 */
  platform?: string;
  summary: string;
  /** Price of the official field map in USD, if sold. */
  mapPriceUsd?: number;
  /** How the field is played, as labelled on the order list. */
  mapMode?: string;
  downloads?: Download[];
};

export type Season = {
  year: number;
  slug: string;
  title: string;
  subtitle?: string;
  /** 'completed' | 'upcoming' | 'open' */
  status: 'completed' | 'upcoming' | 'open';
  /** Human readable date range. Leave empty if not announced. */
  dates?: string;
  venue?: string;
  intro: string;
  /**
   * What the category galleries contain.
   * 'photos'  — event photography (the 2024 and 2025 archives)
   * 'results' — the ranking cards published for each category
   */
  galleryKind?: 'photos' | 'results';
  categories: Category[];
};

export const seasons: Season[] = [
  {
    year: 2026,
    slug: '2026',
    title: 'MakeX 2026 — Capelli Sport',
    subtitle: 'Sponsored by Capelli Sport',
    status: 'completed',
    // TODO: fill in the real dates and venue of the 2026 national final.
    dates: '',
    venue: '',
    intro:
      'A sports-themed national robotics competition. Students aged 4 to 15 design, build and ' +
      'code robots to complete real match-day missions — colour-based delivery, logistics and ' +
      'field sorting — alongside the official MakeX Inspire and MakeX Starter world seasons.',
    // The 2026 galleries hold the published ranking cards, one per placing.
    galleryKind: 'results',
    categories: [
      {
        slug: 'sportswonderland',
        name: 'Capelli SportsWonderland',
        ageRange: '4–7 years',
        platform: 'mTiny',
        summary:
          'A playful introduction to robotics in a sports world. Children drive their robot along ' +
          'simple paths, discover sports zones, and complete easy missions that build coordination ' +
          'and logic.',
        mapPriceUsd: 30,
        downloads: [
          { label: 'SportsWonderland Rules v3.0', href: '/downloads/sportswonderland-rules-v3.0.docx', kind: 'rules' },
          { label: 'SportsWonderland Scoresheet', href: '/downloads/sportswonderland-scoresheet.docx', kind: 'scoresheet' },
          { label: 'mTiny SportsWonderland — 8 official combinations', href: '/downloads/mtiny-sportswonderland-8-combinations.pdf', kind: 'combinations' },
          { label: 'SportsWonderland STL files', href: '/downloads/sportswonderland-stl.zip', kind: 'stl' },
        ],
      },
      {
        slug: 'smart-logistics',
        name: 'Capelli Inspire — Smart Logistics',
        ageRange: '8–12 years',
        platform: 'mBot2',
        summary:
          'Students become logistics managers: the robot must move between stations, pick up the ' +
          'right cargo, and deliver it to the correct zone on time.',
        mapPriceUsd: 25,
        downloads: [
          { label: 'Capelli Smart Logistics Rules v3.0', href: '/downloads/capelli-smartlogistics-rules-v3.0.docx', kind: 'rules' },
          { label: 'Capelli Smart Logistics Scoresheet', href: '/downloads/capelli-smartlogistics-scoresheet.docx', kind: 'scoresheet' },
          { label: 'Capelli Inspire — 8 combinations', href: '/downloads/capelli-inspire-8-combos.pdf', kind: 'combinations' },
        ],
      },
      {
        slug: 'locker-room',
        name: 'Capelli Starter — Locker Room',
        ageRange: '13–15 years',
        platform: 'mBot2',
        summary:
          'A real competition scenario for teens. The robot starts from the locker room, scans the ' +
          'assigned colour, then selects and scores the correct object.',
        mapPriceUsd: 25,
        downloads: [
          { label: 'Capelli Starter Locker Room Rules v2.3', href: '/downloads/capelli-starter-locker-room-rules-v2.3.pdf', kind: 'rules' },
          { label: 'Inspire + Starter cube STL files', href: '/downloads/inspire-starter-cube-stl.zip', kind: 'stl' },
        ],
      },
      {
        slug: 'football',
        name: 'Capelli Sport — Football',
        ageRange: '8–12 years',
        platform: 'mBot2',
        summary:
          'A professionally designed mini-soccer pitch tailored for educational robotics, with safe ' +
          'boundaries, two goal areas and a smooth playing surface.',
        mapPriceUsd: 25,
        mapMode: 'Manual mission',
        downloads: [
          { label: 'Capelli Sport Soccer Rules v2.3', href: '/downloads/capelli-sport-soccer-rules-v2.3.pdf', kind: 'rules' },
          { label: 'Soccer STL files', href: '/downloads/soccer-stl.zip', kind: 'stl' },
        ],
      },
      {
        slug: 'code-courier',
        name: 'MakeX Inspire — Code Courier',
        ageRange: '8–12 years',
        summary:
          'The official 2026 MakeX Inspire world season. Its theme, “Code Courier”, is built around ' +
          'artificial intelligence and information security as core concepts.',
        mapPriceUsd: 150,
        mapMode: 'Manual mission',
        downloads: [
          { label: '2026 MakeX Inspire Code Courier Rules Guide v1.0', href: '/downloads/2026-makex-inspire-code-courier-rules-v1.0.pdf', kind: 'rules' },
        ],
      },
      {
        slug: 'signal-rise',
        name: 'MakeX Starter — Signal Rise',
        ageRange: '10–13 years',
        summary:
          'The official 2026 MakeX Starter world season. Its theme, “Signal Rise”, takes signal as ' +
          'the starting point of communication and connection.',
        // NOTE: the old site listed this map at $750 while every other map is $25–$150.
        // Verify before publishing — it looks like a typo for $75.
        mapPriceUsd: 750,
        mapMode: 'Automatic + manual',
        downloads: [
          { label: '2026 MakeX Starter Signal Rise Rules Guide v1.0', href: '/downloads/2026-makex-starter-signal-rise-rules-v1.0.pdf', kind: 'rules' },
        ],
      },
      {
        slug: 'event',
        name: 'Competition day',
        ageRange: 'All ages',
        summary:
          'The national competition day itself — opening ceremony, the halls in full swing, ' +
          'and the awards.',
      },
    ],
  },
  {
    year: 2025,
    slug: '2025',
    title: 'MakeX Lebanon 2025 National',
    status: 'completed',
    dates: '31 May – 1 June 2025',
    venue: '',
    intro: 'The 2025 national competition, held across four age categories.',
    categories: [
      {
        slug: 'fruit-wonderland',
        name: 'Inspire — Fruit Wonderland',
        ageRange: '4–7 years',
        summary: 'The entry-level category for the youngest competitors.',
        downloads: [
          {
            label: 'Inspire Fruit Wonderland Rules (2025)',
            href: '/downloads/2025-inspire-fruit-wonderland-rules.pdf',
            kind: 'rules',
          },
        ],
      },
      {
        slug: 'smart-logistics',
        name: 'Inspire — Smart Logistics',
        ageRange: '8–12 years',
        summary: 'Cargo handling and delivery missions.',
        downloads: [
          {
            label: 'Inspire Smart Logistics National Rules (2025)',
            href: '/downloads/2025-inspire-smart-logistics-national-rules.pdf',
            kind: 'rules',
          },
        ],
      },
      {
        slug: 'starter',
        name: 'Starter',
        ageRange: '8–13 years',
        summary: 'The MakeX Starter world season category.',
      },
      {
        slug: 'challenger',
        name: 'Challenger',
        ageRange: '13–19 years',
        summary: 'The most advanced category, for senior students.',
      },
    ],
  },
  {
    year: 2024,
    slug: '2024',
    title: 'MakeX Lebanon 2024 National',
    status: 'completed',
    intro: 'The 2024 national competition, held across four age categories.',
    categories: [
      { slug: 'fruit-wonderland', name: 'Inspire — Fruit Wonderland', ageRange: '4–7 years', summary: 'The entry-level category for the youngest competitors.' },
      { slug: 'smart-logistics', name: 'Inspire — Smart Logistics', ageRange: '8–12 years', summary: 'Cargo handling and delivery missions.' },
      { slug: 'starter', name: 'Starter', ageRange: '8–13 years', summary: 'The MakeX Starter world season category.' },
      { slug: 'challenger', name: 'Challenger', ageRange: '13–19 years', summary: 'The most advanced category, for senior students.' },
    ],
  },
];

export const currentSeason = seasons[0];

export function getSeason(slug: string): Season | undefined {
  return seasons.find((s) => s.slug === slug);
}

export function getCategory(seasonSlug: string, categorySlug: string): Category | undefined {
  return getSeason(seasonSlug)?.categories.find((c) => c.slug === categorySlug);
}

/** Lebanese participation in MakeX events abroad. */
export type InternationalEvent = {
  slug: string;
  name: string;
  location: string;
  year: number;
  kind: 'Championship' | 'International' | 'Intercontinental';
  summary?: string;
};

export const internationalEvents: InternationalEvent[] = [
  {
    slug: 'wuxi-2026',
    name: 'MakeX Championship',
    location: 'Wuxi, China',
    year: 2026,
    kind: 'Championship',
    summary: 'The MakeX World Championship.',
  },
  { slug: 'abu-dhabi-2024', name: 'MakeX International Competition', location: 'Abu Dhabi, UAE', year: 2024, kind: 'International' },
  { slug: 'thailand-2024', name: 'MakeX Intercontinental Competition', location: 'Thailand', year: 2024, kind: 'Intercontinental' },
  { slug: 'abu-dhabi-2023', name: 'MakeX International Competition', location: 'Abu Dhabi, UAE', year: 2023, kind: 'International' },
  { slug: 'thailand-2023', name: 'MakeX Intercontinental Competition', location: 'Thailand', year: 2023, kind: 'Intercontinental' },
];

/** Training tracks for mentors and students. */
export type TrainingTrack = {
  name: string;
  ageRange: string;
  status: 'available' | 'coming-soon';
  href?: string;
  summary: string;
};

export const trainingTracks: TrainingTrack[] = [
  {
    name: 'Inspire — Smart Logistics',
    ageRange: '7–12 years',
    status: 'available',
    href: '/training/interactive/smart-logistics',
    summary: 'Setup, sensor calibration and scoring strategy for the logistics field.',
  },
  { name: 'Inspire — Fruit Wonderland', ageRange: '4–7 years', status: 'coming-soon', summary: 'Introductory driving and mission basics.' },
  { name: 'Starter — All Core Journey', ageRange: '8–13 years', status: 'coming-soon', summary: 'Core mechanics and autonomous routines.' },
  { name: 'Explorer — Digital Pioneer', ageRange: '13–15 years', status: 'coming-soon', summary: 'Advanced sensing and control.' },
  { name: 'Challenge — Ultimate Winner', ageRange: '13–19 years', status: 'coming-soon', summary: 'Competition-level strategy and engineering.' },
];
