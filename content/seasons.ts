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
  /** True when an official printed field map exists for this category. */
  hasMap?: boolean;
  /** How the field is played, as labelled on the order list. */
  mapMode?: string;
  downloads?: Download[];
  /**
   * An online simulator for this category. When set, the category page shows a
   * "try the simulator" block, the season page labels the category "Online simulator",
   * the season block on the homepage links to it, and the Simulator page (/simulator)
   * shows it with its picture, in the section of its season.
   */
  simulator?: {
    /** The simulator's page on this site: /simulator/<name>. */
    href: string;
    /** One or two sentences shown next to the button. */
    summary: string;
    /** Picture of the simulator's mat for the Simulator page: a file under public/. */
    mat?: string;
  };
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
    year: 2027,
    slug: '2027',
    title: 'MakeX 2027 — Fire Rescue Challenge',
    subtitle: 'Season announced',
    status: 'upcoming',
    intro:
      'The alarm sounds in 2027. One city, one emergency — and four ways to answer the call, ' +
      // TO CONFIRM WITH THE ORGANISER (see the note at Fire Chief below): it said "to a
      // coordinated two-robot rescue operation" until the draft rules of Fire Chief were
      // written. They describe one robot in a maze.
      'from a cadet’s very first mission plan to a robot that finds the fire on its own, in a maze that can change between rounds. ' +
      'The categories are announced below; missions, fields and rules will be revealed soon.',
    categories: [
      {
        slug: 'fire-cadet',
        name: 'Fire Cadet',
        ageRange: '4–7 years',
        platform: 'mTiny',
        summary:
          'The city’s first alarm rings for its youngest heroes. Every rescue starts with a plan.',
      },
      {
        slug: 'fire-fighter',
        name: 'Fire Fighter',
        ageRange: '8–10 years',
        platform: 'mBot2',
        summary: 'The robot rolls out on its own. Same city — higher stakes.',
      },
      {
        slug: 'fire-rescue',
        name: 'Fire Rescue',
        ageRange: '11–13 years',
        platform: 'mBot2',
        summary: 'Nothing goes as planned. Sense the situation, decide, adapt.',
        simulator: {
          href: '/simulator/fire-rescue',
          summary:
            'Build a program with mBlock-style blocks and watch the mBot2 run it on the Fire Rescue ' +
            'mat — on any starting combination the referee could draw, scored by the category rules. ' +
            'It runs in the browser: no robot and no installation needed.',
          mat: '/simulator/fire-rescue/mat.webp',
        },
      },
      {
        slug: 'fire-chief',
        name: 'Fire Chief',
        ageRange: '14–17 years',
        // TO CONFIRM WITH THE ORGANISER - these two lines are NOT the organiser's words. They
        // were 'mBot2 + vision' and 'Two robots. One operation. Command the whole response.':
        // the teaser from before the draft rules of the category. The draft rules ("Dynamic
        // Maze Challenge") describe ONE autonomous robot that finds its way through a maze,
        // finds the fire and blows at it with a fan. The maze "may change between rounds", and
        // the draft names no camera. The simulator plays exactly that, and it is offered right
        // under this teaser, so the old words told a teacher two different things on one page.
        // The new `summary` says only what the draft rules say, and nothing more certain than
        // they do. The `platform` is NOT from the draft, which names no robot at all: 'mBot2' is
        // what is left of the old 'mBot2 + vision', and the robot the simulator plays this
        // category with - to be confirmed like the summary. To go back to the old teaser, put
        // the two old strings back here and the old half-sentence back into `intro` above.
        platform: 'mBot2',
        summary: 'One robot, on its own. A maze that can change between rounds. Find the fire.',
        simulator: {
          href: '/simulator/fire-chief',
          summary:
            'Build a program with mBlock-style blocks and watch the mBot2 find its way through the ' +
            'Fire Chief maze to the fire, with a colour sensor and a fan — in any maze you build or ' +
            'draw, scored by the draft rules of the category. ' +
            'It runs in the browser: no robot and no installation needed.',
          mat: '/simulator/fire-chief/mat.webp',
        },
      },
    ],
  },
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
        hasMap: true,
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
        hasMap: true,
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
        hasMap: true,
        downloads: [
          { label: 'Capelli Starter Locker Room Rules v2.3', href: '/downloads/capelli-starter-locker-room-rules-v2.3.pdf', kind: 'rules' },
          { label: 'Inspire + Starter cube STL files', href: '/downloads/inspire-starter-cube-stl.zip', kind: 'stl' },
        ],
        // (the simulator follows the organiser's newer rules - 150 s, half points for a token partly
        // in its target, no 4-second pause - not the v2.3 file above: its Rules window says so)
        simulator: {
          href: '/simulator/locker-room',
          summary:
            'Build a program with mBlock-style blocks and watch the mBot2 carry the Team Box to the Scan ' +
            'Station, scan the team colour, bring the cube of that colour to its big circle to open the ' +
            'stadium gate, then sort the three tokens in the maze — with any draw of the two cards, scored ' +
            "by the organiser's newest rules (newer than the v2.3 rules file). It runs in the browser: no " +
            'robot and no installation needed.',
          mat: '/simulator/locker-room/mat.webp',
        },
      },
      {
        slug: 'football',
        name: 'Capelli Sport — Football',
        ageRange: '8–12 years',
        platform: 'mBot2',
        summary:
          'A professionally designed mini-soccer pitch tailored for educational robotics, with safe ' +
          'boundaries, two goal areas and a smooth playing surface.',
        hasMap: true,
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
        hasMap: true,
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
        hasMap: true,
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
      {
        slug: 'event',
        name: 'Competition day',
        ageRange: 'All ages',
        summary:
          'The 2025 national weekend — opening, the halls in full swing, and the awards.',
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

/** The latest finished season — drives the results-focused sections. */
export const currentSeason = seasons.find((s) => s.status === 'completed') ?? seasons[0];

/** The announced-but-not-yet-run season, if any. */
export const upcomingSeason = seasons.find((s) => s.status === 'upcoming');

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

/**
 * A simulator of a mission that is not a category of a season above (the beginner mission of a
 * local event). The Simulator page (/simulator) shows these in the section of their `season`,
 * after the simulators of that season's categories, each with its picture.
 */
export type MissionSimulator = {
  /** the name of the mission: "Warehouse Sort" */
  name: string;
  /** the year of the season whose section of the Simulator page lists it */
  season: number;
  /** the label of its card, where a category's card shows its age group: its category and level */
  label: string;
  /** the second label of its card, where a category's card shows its season */
  event: string;
  /** the simulator's page on this site: /simulator/<name> */
  href: string;
  /** one or two sentences shown on the card */
  summary: string;
  /** picture of the simulator's mat for the Simulator page: a file under public/ */
  mat?: string;
};

export const missionSimulators: MissionSimulator[] = [
  {
    name: 'Warehouse Sort',
    // (the owner put it in Season 2026. It is NOT the 2026 category Smart Logistics: the organiser
    // has not said that it is the same mission, so it keeps its own two labels)
    season: 2026,
    // (the rules of this mission give no age group)
    label: 'MakeX Inspire · Beginner',
    event: 'Local event',
    href: '/simulator/warehouse-sort',
    summary:
      'Build a program with mBlock-style blocks and watch the mBot2 sort red and green cubes on the ' +
      'Inspire mat: from the warehouses into the bay of their colour, leaving the blue cube where it is, ' +
      'then park on a finish pad — with any arrangement of the cubes, scored by the rules of the beginner mission. ' +
      'It runs in the browser: no robot and no installation needed.',
    mat: '/simulator/warehouse-sort/mat.webp',
  },
];

/** One simulator as the Simulator page shows it: a card of a category or of a mission. */
export type SimulatorCard = {
  /** "Fire Rescue", "Warehouse Sort" */
  name: string;
  href: string;
  summary: string;
  mat?: string;
  /** the two small labels: age group and season (a category), or category and level, and event (a mission) */
  labels: [string, string];
  /** the category's own page, for the "About ..." link under the card (a mission has none) */
  about?: string;
};

/**
 * The sections of the Simulator page: one per season that has a simulator, the oldest season
 * first (Season 2026, then Season 2027). In a section: the categories of that season that have a
 * `simulator`, in the order of `seasons`, then the `missionSimulators` of that season, in their
 * order. Everything comes from the lists above, so a simulator added later appears in its
 * section by itself, and a season without a simulator gets no section. (The two lists can be
 * handed in, for the tests; the page uses the ones of this file.)
 */
export function simulatorSeasons(
  seasonList: Season[] = seasons,
  missions: MissionSimulator[] = missionSimulators,
): Array<{ year: number; simulators: SimulatorCard[] }> {
  const years = [...new Set([...seasonList.map((season) => season.year), ...missions.map((mission) => mission.season)])];
  return years
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      simulators: [
        ...seasonList
          .filter((season) => season.year === year)
          .flatMap((season) =>
            season.categories.flatMap((category): SimulatorCard[] =>
              category.simulator
                ? [
                    {
                      name: category.name,
                      href: category.simulator.href,
                      summary: category.simulator.summary,
                      mat: category.simulator.mat,
                      labels: [category.ageRange, `Season ${season.year}`],
                      about: `/season/${season.slug}/${category.slug}`,
                    },
                  ]
                : [],
            ),
          ),
        ...missions
          .filter((mission) => mission.season === year)
          .map(
            (mission): SimulatorCard => ({
              name: mission.name,
              href: mission.href,
              summary: mission.summary,
              mat: mission.mat,
              labels: [mission.label, mission.event],
            }),
          ),
      ],
    }))
    .filter((section) => section.simulators.length > 0);
}

/** Training tracks for mentors and students. */
export type TrainingTrack = {
  name: string;
  ageRange: string;
  status: 'available' | 'coming-soon';
  href?: string;
  summary: string;
  /** Text of the link on the track's card. Leave out for the usual "Open training". */
  cta?: string;
};

/** "A", "A and B", "A, B and C" */
function namesList(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
}

/**
 * The card of the Training page that leads to the Simulator page (the simulators have a section
 * of their own, /simulator, "Simulator" in the menu; this card is the way there for whoever still
 * looks for them under Training). Its badge and its sentence name the seasons and the simulators
 * of the Simulator page, worked out from the same `simulatorSeasons()`, so that a simulator added
 * above is named here too. (The badge is not an age group: the Simulator page shows each one's.)
 */
export function simulatorTrack(sections = simulatorSeasons()): TrainingTrack {
  const years = sections.map((section) => section.year);
  const named = sections.map(
    (section) => `${namesList(section.simulators.map((simulator) => simulator.name))} (Season ${section.year})`,
  );
  return {
    name: 'mBot2 simulators',
    ageRange: `${years.length > 1 ? 'Seasons' : 'Season'} ${years.join(' · ')}`,
    status: 'available',
    href: '/simulator',
    summary:
      `Program the mBot2 with blocks and watch it play on the competition mat: ${named.join(', ')}. ` +
      'Works in the browser, no robot needed.',
    cta: 'Go to the simulators',
  };
}

export const trainingTracks: TrainingTrack[] = [
  {
    name: 'Inspire — Smart Logistics',
    ageRange: '7–12 years',
    status: 'available',
    href: '/training/interactive/smart-logistics',
    summary: 'Setup, sensor calibration and scoring strategy for the logistics field.',
  },
  simulatorTrack(),
  { name: 'Inspire — Fruit Wonderland', ageRange: '4–7 years', status: 'coming-soon', summary: 'Introductory driving and mission basics.' },
  { name: 'Starter — All Core Journey', ageRange: '8–13 years', status: 'coming-soon', summary: 'Core mechanics and autonomous routines.' },
  { name: 'Explorer — Digital Pioneer', ageRange: '13–15 years', status: 'coming-soon', summary: 'Advanced sensing and control.' },
  { name: 'Challenge — Ultimate Winner', ageRange: '13–19 years', status: 'coming-soon', summary: 'Competition-level strategy and engineering.' },
];
