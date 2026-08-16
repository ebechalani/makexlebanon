/**
 * Content migrated from three pages of the old GoDaddy site:
 *   /traininngs       -> workshops
 *   /competition-kits -> kits
 *   homepage + others -> videos
 */

/** Workshops, launches and training sessions run around the country. */
export type Workshop = {
  title: string;
  venue: string;
  /** ISO date, used for sorting. */
  date: string;
  /** As printed on the old site. */
  dateLabel: string;
  region?: string;
  note?: string;
};

export const workshops: Workshop[] = [
  {
    title: 'MakeX Lebanon launch',
    venue: 'La Marina, Dbayeh',
    date: '2024-02-17',
    dateLabel: '17 February 2024',
    region: 'Mount Lebanon',
    note: 'The public launch of MakeX Lebanon.',
  },
  {
    title: 'Mentor training',
    venue: 'Librairie Antoine, Mkalles',
    date: '2023-09-15',
    dateLabel: '15 September 2023',
    region: 'Beirut',
  },
  {
    title: 'Mentor training',
    venue: 'Macrotronics, Tabarja',
    date: '2023-09-22',
    dateLabel: '22 September 2023',
    region: 'Keserwan',
  },
  {
    title: 'Mentor training',
    venue: 'Librairie Antoine, Mkalles',
    date: '2024-01-13',
    dateLabel: '13 January 2024',
    region: 'Beirut',
  },
  {
    title: 'Mentor training',
    venue: 'Algocode',
    date: '2024-03-24',
    dateLabel: '24 March 2024',
  },
  {
    title: 'Mentor training',
    venue: 'RoboHolic Robotics Academy',
    date: '2024-11-30',
    dateLabel: '30 November 2024',
  },
  {
    title: 'Mentor training',
    venue: 'RoboHolic Robotics Academy',
    date: '2024-12-27',
    dateLabel: '27 December 2024',
  },
  {
    title: 'MakeX in Keserwan',
    venue: 'RoboHolic Robotics Academy',
    date: '2025-02-15',
    dateLabel: '15 February 2025',
    region: 'Keserwan',
  },
  {
    title: 'MakeX in Beirut',
    venue: 'École Saint Elie des Soeurs Maronites de la Sainte Famille, Zahlé',
    date: '2025-02-22',
    dateLabel: '22 February 2025',
    region: 'Beirut',
  },
  {
    title: 'MakeX in the Bekaa',
    venue: 'Algocode',
    date: '2025-03-01',
    dateLabel: '1 March 2025',
    region: 'Bekaa',
  },
  {
    title: 'Online session — Quad RGB and gyroscope sensors',
    venue: 'Online',
    date: '2025-03-15',
    dateLabel: '15 March 2025',
    note: 'Sensor calibration and use for the Inspire and Starter categories.',
  },
  {
    title: 'MakeX in Saida',
    venue: 'Saida',
    date: '2026-01-17',
    dateLabel: '17 January 2026',
    region: 'South Lebanon',
  },
];

/**
 * Competition kit descriptions, from the old /competition-kits page.
 * These describe the 2024–2025 category structure.
 */
export type Kit = {
  category: string;
  ageRange: string;
  body: string[];
};

export const kits: Kit[] = [
  {
    category: 'Inspire — Fruit Wonderland',
    ageRange: '4–7 years',
    body: [
      'The entry-level MakeX Inspire category, designed for the youngest competitors. Teams ' +
        'drive their robot along simple paths and complete approachable missions that build ' +
        'coordination, sequencing and basic logic.',
    ],
  },
  {
    category: 'Inspire — Smart Logistics',
    ageRange: '8–12 years',
    body: [
      'The 2024 MakeX Inspire Smart Logistics competition focuses on simulating modern factory ' +
        'logistics scenarios, to teach students about Internet of Things and artificial ' +
        'intelligence technologies.',
      'Teams have the flexibility to engage in tasks using either manual or automatic methods, ' +
        'or a combination of both, to optimise their strategy for success.',
    ],
  },
  {
    category: 'Starter',
    ageRange: '8–13 years',
    body: [
      'MakeX Starter is a multi-mission competition programme for teenagers. It integrates an ' +
        'automatic stage and a manual stage, which greatly enhances the fun and the participation ' +
        'experience of the competition.',
      'The concept of multiple missions and the alliance cooperation design fully exercises ' +
        'contestants’ critical thinking and strategic planning, as well as improving communication ' +
        'and cooperation between alliance teams.',
    ],
  },
];

/**
 * Videos, grouped by subject.
 *
 * Each one's subject was recovered from the heading it sat under on the old
 * site, so a launch film is not filed with competition footage or a training
 * session. Add new videos by giving them a `topic` from VIDEO_TOPICS.
 */
export type VideoTopic = 'highlights' | 'launch' | 'national' | 'international' | 'training';

export const VIDEO_TOPICS: { id: VideoTopic; title: string; blurb: string }[] = [
  {
    id: 'highlights',
    title: 'Highlights',
    blurb: 'The showreel — what a MakeX Lebanon competition day looks like.',
  },
  {
    id: 'launch',
    title: 'Season launches',
    blurb: 'Announcements opening each new season and its categories.',
  },
  {
    id: 'national',
    title: 'National competition',
    blurb: 'Footage from the national finals, day by day.',
  },
  {
    id: 'international',
    title: 'International competitions',
    blurb: 'Lebanese teams abroad, and advice brought home from them.',
  },
  {
    id: 'training',
    title: 'Training & tutorials',
    blurb: 'Sessions for mentors and students on building, coding and sensors.',
  },
];

export type Video = {
  title: string;
  /** YouTube video id, or a Vimeo id when provider is 'vimeo'. */
  id: string;
  provider: 'youtube' | 'vimeo';
  /** Extra query params required for private Vimeo embeds. */
  hash?: string;
  topic: VideoTopic;
  context?: string;
};

export const videos: Video[] = [
  {
    title: 'MakeX Lebanon — competition showreel',
    id: '906431452',
    provider: 'vimeo',
    hash: '42048bba37',
    topic: 'highlights',
    context: 'The film that plays behind the homepage.',
  },

  {
    title: 'MakeX 2026 & Capelli Sport — competition launch',
    id: 'h5b_zcYibPc',
    provider: 'youtube',
    topic: 'launch',
    context: 'Announcing the 2026 season and its six categories.',
  },

  {
    title: 'MakeX Lebanon 2025 — national competition',
    id: '9OjMK9pIzm4',
    provider: 'youtube',
    topic: 'national',
    context: '31 May – 1 June 2025.',
  },
  {
    title: 'MakeX 2025 — competition film',
    id: 'lcfrMydjJKY',
    provider: 'youtube',
    topic: 'national',
  },
  {
    title: 'MakeX Lebanon 2025 — day 1',
    id: '5n-LItlJs9M',
    provider: 'youtube',
    topic: 'national',
    context: '31 May 2025.',
  },

  {
    title: 'MakeX Thailand, July 2023 — advice for Lebanese teams',
    id: 'EYDKAUHHYvc',
    provider: 'youtube',
    topic: 'international',
    context: 'Intercontinental competition.',
  },

  {
    title: 'Online session — Quad RGB and gyroscope sensors',
    id: 'PHCrAU02Kc8',
    provider: 'youtube',
    topic: 'training',
    context: '15 March 2025.',
  },
];
