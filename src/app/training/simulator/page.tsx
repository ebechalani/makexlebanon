import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { seasons } from '@content/seasons';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Button, Section, SectionHeading } from '@/components/ui';
import { POWERED_BY } from '@/simulator/ui/TitleBar';

const PATH = '/training/simulator';
const TITLE = 'mBot2 simulators';
const DESCRIPTION =
  'Program a Makeblock mBot2 with mBlock-style blocks and watch it play a MakeX Lebanon 2027 ' +
  'category in the browser: Fire Rescue (ages 11–13) and the Fire Chief maze (ages 14–17). ' +
  'Free, nothing to install.';

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
 * The list of simulators: one card for every category that has a `simulator` entry in
 * content/seasons.ts, in the order of that file. Nothing about a simulator is written here -
 * its name, age group, sentences, address and picture all come from that entry, so a category
 * that gets a simulator later appears on this page by itself.
 */
const SIMULATORS = seasons.flatMap((season) =>
  season.categories.flatMap((category) => (category.simulator ? [{ season, category, simulator: category.simulator }] : [])),
);

export default function SimulatorListPage() {
  return (
    <>
      <PageHero
        eyebrow="Training"
        title="mBot2 simulators"
        lead="Build a program with blocks and watch the mBot2 run it on the competition mat. Choose the simulator of your category."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Training', href: '/training' }, { label: 'Simulators' }]}
      />

      <Section>
        <SectionHeading
          eyebrow="In the browser"
          title="Choose your category"
          lead="No robot and no installation needed. The blocks you build are saved in your own browser."
        />

        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {SIMULATORS.map(({ season, category, simulator }) => (
            <li key={simulator.href}>
              <article className="flex h-full flex-col overflow-hidden rounded-card bg-white ring-1 ring-slate-200">
                {simulator.mat ? (
                  // (the picture is the mat of the simulator, seen from above; the button below it is the link)
                  <div className="bg-slate-100 p-5 sm:p-6">
                    <Image
                      src={simulator.mat}
                      alt={`The mat of the ${category.name} simulator, seen from above`}
                      width={640}
                      height={640}
                      sizes="(min-width: 768px) 20rem, 80vw"
                      className="mx-auto h-auto w-full max-w-xs rounded-md bg-white shadow-md ring-1 ring-slate-300"
                    />
                  </div>
                ) : null}

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{category.ageRange}</Badge>
                    <Badge tone="neutral">Season {season.year}</Badge>
                  </div>
                  <h3 className="mt-4 text-xl text-ink-900">{category.name} simulator</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600 text-pretty">{simulator.summary}</p>

                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <Button href={simulator.href}>Open the {category.name} simulator</Button>
                    <Link
                      href={`/season/${season.slug}/${category.slug}`}
                      className="group inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      About {category.name}
                      <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>

        {/* who the simulators are powered by: the same credit as in the title row of every simulator */}
        <p className="mt-8 text-sm text-ink-500">
          Powered by <span className="font-semibold text-ink-700">{POWERED_BY}</span>
        </p>
      </Section>
    </>
  );
}
