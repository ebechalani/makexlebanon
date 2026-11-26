import type { Metadata } from 'next';
import { site } from '@content/site';
import { standaloneCategories, type StandaloneCategory } from '@content/standalone';
import { PageHero } from '@/components/PageHero';
import { Button, Section, SectionHeading } from '@/components/ui';

/**
 * The page of Robot en fête 2027, a category of its own (content/standalone.ts): outside every
 * season, so it has no season page above it, no photos, no downloads and no other categories next
 * to it - only what it is and its simulators, one part each (today one: Tri d’entrepôt; a simulator
 * added to the entry gets its part by itself). Its texts are French (lang="fr" on each of them); the
 * breadcrumbs are the website's own path and stay English, as the menu and the footer do. No age
 * group is shown (the organiser asked for none).
 */
function entryOf(slug: string): StandaloneCategory {
  const found = standaloneCategories.find((entry) => entry.slug === slug);
  // (the build stops here if the entry is gone: the page would have nothing to show)
  if (!found) throw new Error(`content/standalone.ts has no entry "${slug}"`);
  return found;
}

const category = entryOf('robot-en-fete');

const PATH = `/${category.slug}`;

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
  title: category.page.title,
  description: category.page.description,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    // (the page is French; the site's own locale is en_LB)
    locale: 'fr_LB',
    siteName: site.name,
    url: PATH,
    title: category.page.title,
    description: category.page.description,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: category.page.title,
    description: category.page.description,
    images: [SHARE_IMAGE],
  },
};

export default function RobotEnFetePage() {
  return (
    <>
      <PageHero
        lang={category.lang}
        eyebrow={category.page.eyebrow}
        title={category.name}
        lead={category.summary}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Simulator', href: '/simulator' }, { label: category.name }]}
      >
        {/* (the robot only: a category of its own has no age group to show) */}
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">{category.platform}</span>
        </div>
        {/* who its simulators are powered by: the same name as in their title row */}
        <p className="mt-4 text-sm text-white/70">
          {category.page.poweredByLabel} <span className="font-semibold text-white">{category.poweredBy}</span>
        </p>
      </PageHero>

      {/* Its simulators, as a category page of a season shows its own */}
      {category.simulators.map((simulator) => (
        <div key={simulator.href} lang={category.lang}>
          <Section className="bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-8">
              <SectionHeading eyebrow={category.page.simulatorEyebrow} title={simulator.pageTitle} lead={simulator.summary} />
              <Button href={simulator.href}>{category.page.open}</Button>
            </div>
          </Section>
        </div>
      ))}
    </>
  );
}
