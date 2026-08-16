import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSeason, seasons } from '@content/seasons';
import { countCategoryImages } from '@/lib/gallery';
import { PageHero } from '@/components/PageHero';
import {
  ArrowIcon,
  Badge,
  Button,
  Card,
  Section,
  SectionHeading,
} from '@/components/ui';

type Params = { params: Promise<{ year: string }> };

export function generateStaticParams() {
  return seasons.map((season) => ({ year: season.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { year } = await params;
  const season = getSeason(year);
  if (!season) return {};

  return {
    title: season.title,
    description: season.intro,
    openGraph: { title: season.title, description: season.intro },
  };
}

export default async function SeasonPage({ params }: Params) {
  const { year } = await params;
  const season = getSeason(year);
  if (!season) notFound();

  const statusLabel = {
    completed: 'Season complete',
    upcoming: 'Upcoming season',
    open: 'Registration open',
  }[season.status];

  const mapsForSale = season.categories.filter((c) => typeof c.mapPriceUsd === 'number');

  return (
    <>
      <PageHero
        eyebrow={season.subtitle ?? `${season.year} season`}
        title={season.title}
        lead={season.intro}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: `Season ${season.year}` }]}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {statusLabel}
          </span>
          {season.dates ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">
              {season.dates}
            </span>
          ) : null}
          {season.venue ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">
              {season.venue}
            </span>
          ) : null}
        </div>
      </PageHero>

      {/* Categories --------------------------------------------------------- */}
      <Section>
        <SectionHeading
          eyebrow="Categories"
          title="Competition categories"
          lead={`${season.categories.length} categories ran in the ${season.year} season. Open a category for its rules, resources and photos.`}
        />

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {season.categories.map((category) => {
            const photos = countCategoryImages(season.year, category.slug);
            return (
              <li key={category.slug}>
                <Card href={`/season/${season.slug}/${category.slug}`} className="h-full">
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

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
                      View category
                      <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                    {photos > 0 ? (
                      <span className="text-xs text-ink-400">{photos} photos</span>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Field maps --------------------------------------------------------- */}
      {mapsForSale.length > 0 ? (
        <Section className="bg-slate-50">
          <SectionHeading
            eyebrow="Equipment"
            title="Official field maps"
            lead="Printed competition mats, sold to participating schools and teams. Contact us to place an order."
          />

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-ink-500">
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="py-3 pr-4 font-semibold">
                    Platform
                  </th>
                  <th scope="col" className="py-3 text-right font-semibold">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {mapsForSale.map((category) => (
                  <tr key={category.slug} className="border-b border-slate-200">
                    <td className="py-4 pr-4 font-medium text-ink-800">{category.name}</td>
                    <td className="py-4 pr-4 text-ink-500">{category.platform ?? '—'}</td>
                    <td className="py-4 text-right font-semibold text-ink-900 tabular-nums">
                      ${category.mapPriceUsd?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <Button href="/contact" variant="secondary">
              Enquire about field maps
            </Button>
          </div>
        </Section>
      ) : null}
    </>
  );
}
