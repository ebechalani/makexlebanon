import type { Metadata } from 'next';
import Link from 'next/link';
import { seasons } from '@content/seasons';
import { countCategoryImages } from '@/lib/gallery';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Container, Section } from '@/components/ui';

export const metadata: Metadata = {
  title: 'National competitions',
  description:
    'Every MakeX Lebanon national robotics competition, with the categories that ran in each season.',
};

export default function NationalPage() {
  return (
    <>
      <PageHero
        eyebrow="National"
        title="MakeX Lebanon national competitions"
        lead="The national qualifier, held each season across age-banded categories. Winners go on to represent Lebanon internationally."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Competitions', href: '/competitions' },
          { label: 'National' },
        ]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <div className="space-y-16">
            {seasons.map((season) => (
              <section key={season.slug} aria-labelledby={`season-${season.slug}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-slate-200 pb-5">
                  <div>
                    <h2 id={`season-${season.slug}`} className="text-2xl text-ink-900 sm:text-3xl">
                      {season.title}
                    </h2>
                    {season.dates ? (
                      <p className="mt-1.5 text-sm text-ink-500">{season.dates}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/season/${season.slug}`}
                    className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Season details
                    <ArrowIcon />
                  </Link>
                </div>

                <p className="mt-5 max-w-3xl text-ink-600 text-pretty">{season.intro}</p>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {season.categories.map((category) => {
                    const photos = countCategoryImages(season.year, category.slug);
                    return (
                      <li key={category.slug}>
                        <Link
                          href={`/season/${season.slug}/${category.slug}`}
                          className="group flex h-full flex-col rounded-card p-5 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:ring-brand-300"
                        >
                          <Badge>{category.ageRange}</Badge>
                          <span className="mt-3 flex-1 text-sm font-semibold text-ink-800 group-hover:text-brand-700">
                            {category.name}
                          </span>
                          <span className="mt-3 text-xs text-ink-400">
                            {photos > 0 ? `${photos} photos` : 'Photos coming soon'}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Container>
      </div>

      <Section dark className="py-14 sm:py-16">
        <p className="text-sm text-white/60">
          Looking for rules and scoresheets? They are listed on each category page of the current
          season.
        </p>
      </Section>
    </>
  );
}
