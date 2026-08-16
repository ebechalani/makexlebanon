import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { seasons } from '@content/seasons';
import { countCategoryImages, getCategoryImages } from '@/lib/gallery';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Container, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Photo gallery',
  description:
    'Competition photos from MakeX Lebanon national seasons, organised by year and category.',
};

export default function GalleryIndexPage() {
  const seasonsWithCounts = seasons.map((season) => {
    const categories = season.categories.map((category) => {
      const images = getCategoryImages(
        season.year,
        category.slug,
        `${category.name}, MakeX Lebanon ${season.year}`,
      );
      return { category, count: images.length, cover: images[0] };
    });
    const total = categories.reduce((sum, c) => sum + c.count, 0);
    return { season, categories, total };
  });

  const grandTotal = seasonsWithCounts.reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <PageHero
        eyebrow="Gallery"
        title="Competition photos"
        lead={
          grandTotal > 0
            ? `${grandTotal} photos from MakeX Lebanon competitions, organised by season and category.`
            : 'Photos from MakeX Lebanon competitions, organised by season and category.'
        }
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Gallery' }]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <div className="space-y-16">
            {seasonsWithCounts.map(({ season, categories, total }) => (
              <section key={season.slug} aria-labelledby={`gallery-${season.slug}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-slate-200 pb-5">
                  <h2 id={`gallery-${season.slug}`} className="text-2xl text-ink-900 sm:text-3xl">
                    {season.title}
                  </h2>
                  <span className="text-sm text-ink-500">
                    {total > 0 ? `${total} photos` : 'No photos yet'}
                  </span>
                </div>

                <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {categories.map(({ category, count, cover }) => (
                    <li key={category.slug}>
                      <Link
                        href={`/season/${season.slug}/${category.slug}#photos`}
                        className="group block overflow-hidden rounded-card ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-brand-300"
                      >
                        <div className="relative aspect-4/3 bg-slate-100">
                          {cover ? (
                            <Image
                              src={cover.src}
                              alt={cover.alt}
                              fill
                              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-xs text-ink-400">
                              Coming soon
                            </div>
                          )}
                        </div>

                        <div className="p-5">
                          <Badge>{category.ageRange}</Badge>
                          <p className="mt-3 text-sm font-semibold text-ink-800 group-hover:text-brand-700">
                            {category.name}
                          </p>
                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
                            {count > 0 ? `${count} photos` : 'Photos coming soon'}
                            {count > 0 ? <ArrowIcon className="h-3 w-3" /> : null}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Container>
      </div>

      <Section className="bg-slate-50">
        <SectionHeading
          title="International events"
          lead="Photos from MakeX competitions abroad are grouped with each event."
        />
        <div className="mt-6">
          <Link
            href="/competitions/international"
            className="inline-flex min-h-9 items-center gap-2 py-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            Browse international galleries
            <ArrowIcon />
          </Link>
        </div>
      </Section>
    </>
  );
}
