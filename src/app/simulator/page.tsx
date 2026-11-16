import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { simulatorSeasons } from '@content/seasons';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Container } from '@/components/ui';
import { POWERED_BY } from '@/simulator/ui/TitleBar';

const PATH = '/simulator';
const TITLE = 'mBot2 simulators';
const DESCRIPTION =
  'Program a Makeblock mBot2 with mBlock-style blocks and watch it play a MakeX Lebanon mission ' +
  'in the browser: Warehouse Sort, the beginner mission of the Inspire category (Season 2026), and ' +
  'the 2027 categories Fire Rescue (ages 11–13) and Fire Chief (ages 14–17). Free, nothing to install.';

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
 * The Simulator section of the website: one page, one part per season (Season 2026, then
 * Season 2027), and in each part one card per simulator. Nothing about a simulator is written
 * here: the seasons, names, labels, sentences, addresses and pictures all come from
 * `simulatorSeasons()` in content/seasons.ts, so a simulator added there appears here by itself.
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
        eyebrow="mBot2 · In the browser"
        title="Simulator"
        lead="Build a program with blocks and watch the mBot2 run it on the competition mat. No robot and nothing to install."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Simulator' }]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <div className="space-y-16">
            {sections.map(({ year, simulators }) => (
              <section key={year} aria-labelledby={`season-${year}`}>
                <h2 id={`season-${year}`} className="border-b border-slate-200 pb-5 text-2xl text-ink-900 sm:text-3xl">
                  Season {year}
                </h2>

                <ul className="mt-8 grid gap-6 md:grid-cols-2">
                  {simulators.map((simulator) => {
                    const summaryId = `simulator-${simulator.href.split('/').pop()}-summary`;
                    const open = `Open the ${simulator.name} simulator`;
                    return (
                      <li key={simulator.href} className="flex flex-col">
                        <Link
                          href={simulator.href}
                          aria-label={open}
                          aria-describedby={summaryId}
                          className="group flex flex-1 flex-col overflow-hidden rounded-card bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-brand-300 focus-visible:outline-offset-4"
                        >
                          {simulator.mat ? (
                            // (the mat of the simulator, seen from above)
                            <div className="bg-slate-100 p-5 sm:p-6">
                              <Image
                                src={simulator.mat}
                                alt={`The mat of the ${simulator.name} simulator, seen from above`}
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
                            <h3 className="mt-4 text-xl text-ink-900 group-hover:text-brand-700">{simulator.name} simulator</h3>
                            <p id={summaryId} className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 text-pretty">
                              {simulator.summary}
                            </p>
                            {/* (what the whole card does, so that it reads as a link) */}
                            <span className="mt-6 inline-flex items-center gap-2 self-start rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-brand-600">
                              {open}
                              <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </Link>

                        {simulator.about ? (
                          <Link
                            href={simulator.about}
                            className="group mt-3 inline-flex min-h-9 items-center gap-2 self-start py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                          >
                            About {simulator.name}
                            <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* who the simulators are powered by: the same credit as in the title row of every simulator */}
          <p className="mt-16 text-sm text-ink-500">
            Powered by <span className="font-semibold text-ink-700">{POWERED_BY}</span>
          </p>
        </Container>
      </div>
    </>
  );
}
