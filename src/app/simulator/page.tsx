import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { simulatorSeasons, type SimulatorCard } from '@content/seasons';
import { site } from '@content/site';
import { simulatorCategories } from '@content/standalone';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Container } from '@/components/ui';
// (a plain file that imports nothing: the title row itself, @/simulator/ui/TitleBar, would bring its client code onto this page)
import { POWERED_BY } from '@/simulator/ui/powered-by';

const PATH = '/simulator';
const TITLE = 'Robot simulators';
// (written by hand, in the order of the page: Season 2027, then Season 2026, then Robot en fête 2027;
// unlike the page, the menu and the Training card, it does not follow the data: edit it when a simulator is added)
const DESCRIPTION =
  'Program a Makeblock mBot2 with mBlock-style blocks, or lay mTiny coding cards, and watch the robot play a ' +
  'MakeX Lebanon mission in the browser: the 2027 categories Fire Cadet (mTiny, ages 4–7), Fire Fighter ' +
  '(ages 8–10), Fire Rescue Junior (ages 10–12), Fire Rescue Senior (ages 13–15) and Fire Chief (ages 14–17), ' +
  'and the Season 2026 category Locker Room (Capelli, ages 13–15) and Warehouse Sort, the beginner mission of ' +
  'the Inspire category (Season 2026). And Robot en fête 2027 (in French): Tri d’entrepôt, the French ' +
  'version of Warehouse Sort. Free, nothing to install.';

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
 * The Simulator section of the website: one page, one part per season, the newest first (Season
 * 2027, then Season 2026), and in each part one card per simulator. Nothing about a simulator is written
 * here: the seasons, names, labels, sentences, addresses and pictures all come from
 * `simulatorSeasons()` in content/seasons.ts, so a simulator added there appears here by itself.
 *
 * After the seasons, one part for each category of its own that has a simulator
 * (`simulatorCategories()` in content/standalone.ts, which the menu takes too): Robot en
 * fête 2027, in French, with a card for each of its simulators (today Tri d’entrepôt). That part is
 * in its category's language (lang="fr"), and so are all the words of its cards, which come from
 * the same entry: a card is given all its words (CardWords), so that none of them can fall back to
 * the English of the other cards.
 *
 * The heading of each part has an id (season-2027, category-robot-en-fete): the groups of the
 * Simulator dropdown of the menu lead to it (/simulator#season-2027, simulatorMenu() in
 * content/site.ts). It keeps the height of the sticky header above it when the page scrolls to
 * it (scroll-mt-24), also when the menu changes the page without a reload.
 *
 * A card is one link to the simulator (the picture, the name and the sentences), so it can be
 * clicked anywhere. The "About <category>" link is a separate link under the card: a link may
 * not hold another link.
 */
export default function SimulatorPage() {
  const sections = simulatorSeasons();

  return (
    <>
      <PageHero
        eyebrow="mBot2 · mTiny · In the browser"
        title="Simulator"
        lead="Build a program with blocks for the mBot2, or a row of coding cards for the mTiny, and watch the robot run it on the competition mat. No robot and nothing to install."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Simulator' }]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <div className="space-y-16">
            {sections.map(({ year, simulators }) => (
              <section key={year} aria-labelledby={`season-${year}`}>
                <h2 id={`season-${year}`} className="scroll-mt-24 border-b border-slate-200 pb-5 text-2xl text-ink-900 sm:text-3xl">
                  Season {year}
                </h2>

                <ul className="mt-8 grid gap-6 md:grid-cols-2">
                  {simulators.map((simulator) => (
                    <CardItem key={simulator.href} simulator={simulator} words={englishCardWords(simulator.name)} />
                  ))}
                </ul>
              </section>
            ))}

            {/* who the season simulators are powered by: the same credit as in their title row (a category
                of its own, below, names its own in its part) */}
            <p className="text-sm text-ink-500">
              Powered by <span className="font-semibold text-ink-700">{POWERED_BY}</span>
            </p>

            {/* the categories of their own that have a simulator, after the seasons: each part in its
                category's language (a category without one has no part, as a season without one) */}
            {simulatorCategories().map((category) => (
              <section key={category.slug} aria-labelledby={`category-${category.slug}`} lang={category.lang}>
                <h2 id={`category-${category.slug}`} className="scroll-mt-24 border-b border-slate-200 pb-5 text-2xl text-ink-900 sm:text-3xl">
                  {category.name}
                </h2>

                <ul className="mt-8 grid gap-6 md:grid-cols-2">
                  {category.simulators.map((simulator) => (
                    <CardItem
                      key={simulator.href}
                      simulator={{
                        name: simulator.name,
                        href: simulator.href,
                        summary: simulator.summary,
                        mat: simulator.mat,
                        labels: simulator.card.labels,
                        about: `/${category.slug}`,
                      }}
                      words={simulator.card}
                    />
                  ))}
                </ul>

                {/* who its simulators are powered by: the same name as in their title row (content/standalone.ts) */}
                <p className="mt-8 text-sm text-ink-500">
                  {category.page.poweredByLabel} <span className="font-semibold text-ink-700">{category.poweredBy}</span>
                </p>
              </section>
            ))}
          </div>
        </Container>
      </div>
    </>
  );
}

/** The words of a card. Every one is given, so that a card in another language cannot fall back to English. */
type CardWords = {
  /** the name of the card */
  heading: ReactNode;
  /** what the whole card does: its name for a screen reader, and the hint at its foot */
  open: string;
  /** what its picture shows */
  matAlt: string;
  /** the link to the category's own page, under the card */
  about: ReactNode;
};

/** The words of a card of a season: "Fire Chief simulator", "Open the Fire Chief simulator", "About Fire Chief". */
function englishCardWords(name: string): CardWords {
  // (the name and the link keep the pieces of text they always had: "<name>" " simulator", "About " "<name>")
  return {
    heading: <>{name} simulator</>,
    open: `Open the ${name} simulator`,
    matAlt: `The mat of the ${name} simulator, seen from above`,
    about: <>About {name}</>,
  };
}

/** One card: a link to the simulator, and under it the link to its category's page (when it has one). */
function CardItem({ simulator, words }: { simulator: SimulatorCard; words: CardWords }) {
  const summaryId = `simulator-${simulator.href.split('/').pop()}-summary`;
  return (
    <li className="flex flex-col">
      <Link
        href={simulator.href}
        aria-label={words.open}
        aria-describedby={summaryId}
        className="group flex flex-1 flex-col overflow-hidden rounded-card bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-brand-300 focus-visible:outline-offset-4"
      >
        {simulator.mat ? (
          // (the mat of the simulator, seen from above)
          <div className="bg-slate-100 p-5 sm:p-6">
            <Image
              src={simulator.mat}
              alt={words.matAlt}
              width={640}
              height={640}
              sizes="(min-width: 768px) 20rem, 80vw"
              className="mx-auto h-auto w-full max-w-xs rounded-md bg-white shadow-md ring-1 ring-slate-300 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{simulator.labels[0]}</Badge>
            <Badge tone="neutral">{simulator.labels[1]}</Badge>
          </div>
          <h3 className="mt-4 text-xl text-ink-900 group-hover:text-brand-700">{words.heading}</h3>
          <p id={summaryId} className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 text-pretty">
            {simulator.summary}
          </p>
          {/* (what the whole card does, so that it reads as a link) */}
          <span className="mt-6 inline-flex items-center gap-2 self-start rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-brand-600">
            {words.open}
            <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      {simulator.about ? (
        <Link
          href={simulator.about}
          className="group mt-3 inline-flex min-h-9 items-center gap-2 self-start py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          {words.about}
          <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </li>
  );
}
