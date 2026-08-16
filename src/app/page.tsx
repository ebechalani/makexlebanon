import Image from 'next/image';
import Link from 'next/link';
import ranksJson from '../../scripts/2026-ranks.json';
import { currentSeason, internationalEvents, seasons } from '@content/seasons';
import { site } from '@content/site';
import { countCategoryImages, getCategoryImages } from '@/lib/gallery';
import { HeroVideo } from '@/components/HeroVideo';
import {
  ArrowIcon,
  Badge,
  Button,
  Card,
  Container,
  Eyebrow,
  Section,
  SectionHeading,
} from '@/components/ui';

export default function HomePage() {
  const photoCount = currentSeason.categories.reduce(
    (total, category) => total + countCategoryImages(currentSeason.year, category.slug),
    0,
  );

  return (
    <>
      <Hero photoCount={photoCount} />
      <StatsBar photoCount={photoCount} />
      <SeasonHighlight />
      <Champions />
      <Watch />
      <PhotoMosaic />
      <WhatWeDo />
      <InternationalStrip />
      <ClosingCta />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Hero({ photoCount }: { photoCount: number }) {
  return (
    <div className="relative overflow-hidden bg-ink-950 text-white">
      {/* Looping competition film, behind everything. */}
      <HeroVideo />

      {/* Scrim: keeps the headline legible over moving footage. Darkest on the
          left, where the text sits. */}
      <div
        className="absolute inset-0 bg-linear-to-r from-ink-950/95 via-ink-950/80 to-ink-950/55"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-ink-950/25" aria-hidden="true" />
      {/* Fade the footage out at the bottom so it meets the stats bar cleanly. */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-ink-950 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div
        className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-56 -right-32 h-[30rem] w-[30rem] rounded-full bg-cedar-500/10 blur-3xl"
        aria-hidden="true"
      />

      <Container className="relative py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {currentSeason.title} — season complete
            </span>
          </div>

          <h1 className="text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            Lebanon&rsquo;s national{' '}
            <span className="text-brand-400">robotics competition</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70 text-pretty">
            {site.description}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href={`/season/${currentSeason.slug}`}>
              Explore the {currentSeason.year} season
            </Button>
            {photoCount > 0 ? (
              <Button href="/gallery" variant="ghost">
                View competition photos
              </Button>
            ) : (
              <Button href="/competitions/national" variant="ghost">
                Past competitions
              </Button>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StatsBar({ photoCount }: { photoCount: number }) {
  const stats = [
    { value: `${currentSeason.categories.length}`, label: 'Competition categories' },
    { value: '4–19', label: 'Age range, years' },
    { value: `${seasons.length}`, label: 'National seasons held' },
    { value: `${internationalEvents.length}`, label: 'International events attended' },
  ];

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <Container>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
          {stats.map((stat) => (
            // Reversed visually so the number reads first, while the markup
            // keeps the required <dt> before <dd> order.
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-ink-500">{stat.label}</dt>
              <dd className="text-3xl font-bold tracking-tight text-ink-900">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SeasonHighlight() {
  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow={currentSeason.subtitle}
          title={currentSeason.title}
          lead={currentSeason.intro}
        />
        <Link
          href={`/season/${currentSeason.slug}`}
          className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          All categories &amp; rules
          <ArrowIcon />
        </Link>
      </div>

      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {currentSeason.categories.map((category) => {
          const count = countCategoryImages(currentSeason.year, category.slug);
          return (
            <li key={category.slug}>
              <Card href={`/season/${currentSeason.slug}/${category.slug}`} className="h-full">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{category.ageRange}</Badge>
                  {category.platform ? <Badge tone="neutral">{category.platform}</Badge> : null}
                </div>

                <h3 className="mt-4 text-lg text-ink-900 group-hover:text-brand-700">
                  {category.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500 text-pretty">
                  {category.summary}
                </p>

                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
                  {count > 0 ? `${count} photos` : 'Category details'}
                  <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

type RankCard = { i: number; rank: number; name: string; team: string };

/** Ordered divisions of the 2026 season, mapped to display labels. */
const CHAMPION_DIVISIONS: { key: string; category: string; slug: string; division: string }[] = [
  { key: 'sportswonderland__schools-4-5', category: 'SportsWonderland', slug: 'sportswonderland', division: 'Schools 4–5' },
  { key: 'sportswonderland__schools-6-7', category: 'SportsWonderland', slug: 'sportswonderland', division: 'Schools 6–7' },
  { key: 'sportswonderland__clubs-4-5', category: 'SportsWonderland', slug: 'sportswonderland', division: 'Clubs 4–5' },
  { key: 'sportswonderland__clubs-6-7', category: 'SportsWonderland', slug: 'sportswonderland', division: 'Clubs 6–7' },
  { key: 'smart-logistics__schools-8-9', category: 'Smart Logistics', slug: 'smart-logistics', division: 'Schools 8–9' },
  { key: 'smart-logistics__schools-10-12', category: 'Smart Logistics', slug: 'smart-logistics', division: 'Schools 10–12' },
  { key: 'smart-logistics__clubs-8-9', category: 'Smart Logistics', slug: 'smart-logistics', division: 'Clubs 8–9' },
  { key: 'smart-logistics__clubs-10-12', category: 'Smart Logistics', slug: 'smart-logistics', division: 'Clubs 10–12' },
  { key: 'locker-room__schools-13-15', category: 'Locker Room', slug: 'locker-room', division: 'Schools 13–15' },
  { key: 'locker-room__clubs-13-15', category: 'Locker Room', slug: 'locker-room', division: 'Clubs 13–15' },
  { key: 'football__overall', category: 'Football', slug: 'football', division: 'Overall' },
  { key: 'code-courier__schools', category: 'Code Courier', slug: 'code-courier', division: 'Schools' },
  { key: 'code-courier__clubs', category: 'Code Courier', slug: 'code-courier', division: 'Clubs' },
  { key: 'signal-rise__overall', category: 'Signal Rise', slug: 'signal-rise', division: 'Overall' },
];

/** Every division's first-place winner, straight from the published rankings. */
function Champions() {
  const ranks = ranksJson as unknown as Record<string, RankCard[] | string>;

  const champions = CHAMPION_DIVISIONS.flatMap((division) => {
    const cards = ranks[division.key];
    if (!Array.isArray(cards)) return [];
    const seen = new Set<string>();
    return cards
      .filter((card) => card.rank === 1 && card.name)
      .filter((card) => {
        if (seen.has(card.name)) return false;
        seen.add(card.name);
        return true;
      })
      .map((card) => ({ ...division, name: card.name, team: card.team }));
  });

  if (champions.length === 0) return null;

  return (
    <Section className="bg-slate-50">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="2026 results"
          title="Season 2026 champions"
          lead="First place in every division of the Capelli Sport season."
        />
        <Link
          href="/season/2026"
          className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Full rankings
          <ArrowIcon />
        </Link>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {champions.map((champion) => (
          <li key={champion.key + champion.name}>
            <Link
              href={`/season/2026/${champion.slug}#photos`}
              className="group flex h-full items-center gap-4 rounded-card bg-white p-4 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:ring-brand-300"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-base font-bold text-amber-700 ring-1 ring-inset ring-amber-300"
                aria-hidden="true"
              >
                1
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-brand-700">
                  {champion.name}
                </span>
                <span className="block truncate text-xs text-ink-500">{champion.team}</span>
                <span className="mt-0.5 block text-xs font-medium text-brand-600">
                  {champion.category} · {champion.division}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

/** Featured films: the 2026 launch and the 2025 national, with a link to all. */
function Watch() {
  const featured = [
    {
      id: 'h5b_zcYibPc',
      title: 'MakeX 2026 & Capelli Sport — competition launch',
    },
    {
      id: '9OjMK9pIzm4',
      title: 'MakeX Lebanon 2025 — national competition',
    },
  ];

  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Watch"
          title="Competition films"
          lead="Season launches, match footage and training sessions from our channels."
        />
        <Link
          href="/media"
          className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          All videos
          <ArrowIcon />
        </Link>
      </div>

      <ul className="mt-10 grid gap-8 lg:grid-cols-2">
        {featured.map((video) => (
          <li key={video.id}>
            <div className="overflow-hidden rounded-card bg-ink-950 ring-1 ring-slate-200">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
                  title={video.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
            <h3 className="mt-4 text-lg text-ink-900">{video.title}</h3>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A band of real event photography. Picks are deterministic (folder + index)
 * so the build is stable; each tile links to the gallery it came from.
 */
function PhotoMosaic() {
  const picks: {
    year: string;
    cat: string;
    i: number;
    label: string;
    href: string;
    tall?: boolean;
  // Six tiles, talls first and fourth: with grid auto-placement on four
  // columns this fills exactly two rows with a tall tile on each end.
  }[] = [
    { year: '2024', cat: 'smart-logistics', i: 5, label: 'Smart Logistics · National 2024', href: '/season/2024/smart-logistics#photos', tall: true },
    { year: '2024', cat: 'fruit-wonderland', i: 10, label: 'Fruit Wonderland · National 2024', href: '/season/2024/fruit-wonderland#photos' },
    { year: 'international', cat: 'abu-dhabi-2024', i: 7, label: 'Abu Dhabi 2024', href: '/competitions/international' },
    { year: 'international', cat: 'thailand-2024', i: 130, label: 'Thailand 2024', href: '/competitions/international', tall: true },
    { year: '2024', cat: 'challenger', i: 2, label: 'Challenger · National 2024', href: '/season/2024/challenger#photos' },
    { year: '2025', cat: 'fruit-wonderland', i: 3, label: 'Fruit Wonderland · National 2025', href: '/season/2025/fruit-wonderland#photos' },
  ];

  const tiles = picks
    .map((pick) => {
      const images = getCategoryImages(pick.year, pick.cat, pick.label);
      const image = images[pick.i] ?? images[0];
      return image ? { ...pick, image } : null;
    })
    .filter((tile): tile is NonNullable<typeof tile> => tile !== null);

  if (tiles.length === 0) return null;

  return (
    <Section dark className="py-16 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          dark
          eyebrow="Gallery"
          title="Moments from the floor"
          lead="Match days, pit lanes and podiums — from the national finals to Abu Dhabi and Bangkok."
        />
        <Link
          href="/gallery"
          className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200"
        >
          Browse all photos
          <ArrowIcon />
        </Link>
      </div>

      <ul className="mt-10 grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.image.src} className={tile.tall ? 'row-span-2' : ''}>
            <Link
              href={tile.href}
              className="group relative block h-full overflow-hidden rounded-lg ring-1 ring-white/10"
            >
              <Image
                src={tile.image.src}
                alt={tile.image.alt}
                fill
                sizes="(min-width: 640px) 25vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                className="absolute inset-0 bg-linear-to-t from-ink-950/85 via-ink-950/10 to-transparent opacity-80 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
              <span className="absolute inset-x-0 bottom-0 p-3 text-xs font-semibold text-white/90">
                {tile.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function WhatWeDo() {
  const pillars = [
    {
      title: 'STEAM education, in practice',
      body:
        'Teams design, build and program a working robot to solve a fixed set of missions. ' +
        'Engineering, coding and teamwork are assessed together, not in isolation.',
    },
    {
      title: 'A category for every age',
      body:
        'From four-year-olds driving an mTiny along a path to nineteen-year-olds writing ' +
        'autonomous routines, every student competes against peers at their own level.',
    },
    {
      title: 'A route to the world championship',
      body:
        'National winners represent Lebanon at MakeX intercontinental and international ' +
        'events, and at the MakeX World Championship.',
    },
  ];

  return (
    <Section className="bg-slate-50">
      <SectionHeading
        eyebrow="About"
        title="What MakeX Lebanon does"
        lead="We run the national qualifier for the global MakeX robotics programme, and support schools and mentors year-round."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {pillars.map((pillar, i) => (
          <div key={pillar.title} className="rounded-card bg-white p-7 ring-1 ring-slate-200/80">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-sm font-bold text-brand-600">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-5 text-lg text-ink-900">{pillar.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-500 text-pretty">{pillar.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function InternationalStrip() {
  return (
    <Section dark>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          dark
          eyebrow="Beyond Lebanon"
          title="Where our teams have competed"
          lead="Lebanese teams have represented the country at MakeX events across Asia and the Gulf."
        />
        <Link
          href="/competitions/international"
          className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-300 hover:text-brand-200"
        >
          See all events
          <ArrowIcon />
        </Link>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {internationalEvents.map((event) => {
          const cover = getCategoryImages('international', event.slug, event.name)[3];
          return (
            <li
              key={event.slug}
              className="overflow-hidden rounded-card bg-white/5 ring-1 ring-inset ring-white/10"
            >
              {cover ? (
                <div className="relative aspect-[5/2]">
                  <Image
                    src={cover.src}
                    alt={cover.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <span
                    className="absolute inset-0 bg-linear-to-t from-ink-900/70 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              ) : null}
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-300">
                  {event.year} · {event.kind}
                </p>
                <p className="mt-3 font-semibold text-white">{event.name}</p>
                <p className="mt-1 text-sm text-white/55">{event.location}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

function ClosingCta() {
  return (
    <Section>
      <div className="rounded-2xl bg-linear-to-br from-brand-600 to-brand-800 px-8 py-14 text-center sm:px-14">
        <Eyebrow dark>Schools &amp; mentors</Eyebrow>
        <h2 className="mx-auto max-w-2xl text-3xl text-white sm:text-4xl">
          Bring your students to the next MakeX Lebanon season
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-brand-50/85 text-pretty">
          Get in touch to learn how your school can take part, order official field maps, or
          arrange mentor training.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/contact" variant="secondary">
            Contact the organisers
          </Button>
          <Button href={site.volunteer.href} variant="ghost" external>
            Volunteer or referee
          </Button>
          <Button href={site.portal.href} variant="ghost" external>
            {site.portal.label}
          </Button>
        </div>
      </div>
    </Section>
  );
}
