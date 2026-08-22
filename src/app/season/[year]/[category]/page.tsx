import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Download } from '@content/seasons';
import { getCategory, getSeason, seasons } from '@content/seasons';
import { getCategoryGroups, getCategoryImages } from '@/lib/gallery';
import { Gallery, GalleryEmpty } from '@/components/Gallery';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Button, DownloadIcon, Section, SectionHeading } from '@/components/ui';

type Params = { params: Promise<{ year: string; category: string }> };

export function generateStaticParams() {
  return seasons.flatMap((season) =>
    season.categories.map((category) => ({ year: season.slug, category: category.slug })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { year, category: categorySlug } = await params;
  const season = getSeason(year);
  const category = getCategory(year, categorySlug);
  if (!season || !category) return {};

  const title = `${category.name} — ${season.year}`;
  return {
    title,
    description: category.summary,
    openGraph: { title, description: category.summary },
  };
}

const DOWNLOAD_GROUPS: { kind: Download['kind']; heading: string }[] = [
  { kind: 'rules', heading: 'Rules' },
  { kind: 'scoresheet', heading: 'Scoresheets' },
  { kind: 'combinations', heading: 'Official combinations' },
  { kind: 'stl', heading: '3D print files (STL)' },
  { kind: 'other', heading: 'Other resources' },
];

export default async function CategoryPage({ params }: Params) {
  const { year, category: categorySlug } = await params;
  const season = getSeason(year);
  const category = getCategory(year, categorySlug);
  if (!season || !category) notFound();

  const context = `${category.name}, MakeX Lebanon ${season.year}`;

  // 2026 categories are split into schools/clubs divisions by age band; the
  // 2024/2025 archives store their photos flat.
  const groups = getCategoryGroups(season.year, category.slug, context);
  // Division subfolders hold ranking cards; flat folders are event photos.
  const isResults = season.galleryKind === 'results' && groups.length > 0;
  // Flat files are event photography; division subfolders are ranking cards.
  const images = getCategoryImages(season.year, category.slug, context);
  const cardCount = groups.reduce((n, g) => n + g.images.length, 0);
  const totalImages = cardCount + images.length;
  const downloads = category.downloads ?? [];

  const siblings = season.categories.filter((c) => c.slug !== category.slug);

  return (
    <>
      <PageHero
        eyebrow={`${season.year} · ${category.ageRange}`}
        title={category.name}
        lead={category.summary}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: `Season ${season.year}`, href: `/season/${season.slug}` },
          { label: category.name },
        ]}
      >
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">
            Ages {category.ageRange.replace(' years', '')}
          </span>
          {category.platform ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/20">
              {category.platform}
            </span>
          ) : null}
        </div>
      </PageHero>

      {/* Downloads ---------------------------------------------------------- */}
      {downloads.length > 0 ? (
        <Section>
          <SectionHeading
            eyebrow="Resources"
            title="Rules and downloads"
            lead="Everything mentors and teams need for this category."
          />

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {DOWNLOAD_GROUPS.map((group) => {
              const items = downloads.filter((d) => d.kind === group.kind);
              if (items.length === 0) return null;

              return (
                <div key={group.kind}>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                    {group.heading}
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {items.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-ink-800 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                        >
                          <DownloadIcon />
                          <span className="flex-1">{item.label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* Photos / results — hidden entirely for announced seasons that have
          no photos yet, so a teaser category page stays clean. ------------- */}
      {totalImages > 0 || season.status !== 'upcoming' ? (
      <Section id="photos" className={downloads.length > 0 ? 'bg-slate-50 pt-0 sm:pt-0' : ''}>
        <div className={downloads.length > 0 ? 'pt-16 sm:pt-24' : ''}>
          <SectionHeading
            eyebrow={isResults ? 'Results' : 'Gallery'}
            title={
              isResults
                ? `${category.name} — ${season.year} rankings`
                : `${category.name} — ${season.year}`
            }
            lead={
              totalImages === 0
                ? undefined
                : isResults
                  ? `${cardCount} ranking card${cardCount === 1 ? '' : 's'} across ` +
                    `${groups.length} division${groups.length === 1 ? '' : 's'}` +
                    (images.length > 0
                      ? `, and ${images.length} photos from the competition day.`
                      : '.')
                  : `${totalImages} photo${totalImages === 1 ? '' : 's'} from this category.`
            }
          />

          <div className="mt-10">
            {groups.length > 0 ? (
              <div className="space-y-14">
                {groups.map((group) => (
                  <section key={group.slug} aria-labelledby={`group-${group.slug}`}>
                    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 pb-3">
                      <h3 id={`group-${group.slug}`} className="text-xl text-ink-900">
                        {group.label}
                      </h3>
                      <span className="text-sm text-ink-500">
                        {group.images.length} card{group.images.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Gallery images={group.images} />
                  </section>
                ))}
                {images.length > 0 ? (
                  <section aria-labelledby="group-event-photos">
                    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-200 pb-3">
                      <h3 id="group-event-photos" className="text-xl text-ink-900">
                        From the competition day
                      </h3>
                      <span className="text-sm text-ink-500">{images.length} photos</span>
                    </div>
                    <Gallery images={images} />
                  </section>
                ) : null}
              </div>
            ) : images.length > 0 ? (
              <Gallery images={images} />
            ) : (
              <GalleryEmpty
                hint={
                  season.status === 'upcoming'
                    ? 'Missions, rules and the field will be revealed soon — stay tuned.'
                    : 'Photos from this category will appear here soon.'
                }
              />
            )}
          </div>
        </div>
      </Section>
      ) : null}

      {/* Other categories --------------------------------------------------- */}
      {siblings.length > 0 ? (
        <Section>
          <SectionHeading eyebrow="Keep exploring" title={`Other ${season.year} categories`} />

          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/season/${season.slug}/${sibling.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-lg px-5 py-4 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:ring-brand-300"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-800 group-hover:text-brand-700">
                      {sibling.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">{sibling.ageRange}</span>
                  </span>
                  <ArrowIcon className="text-brand-500 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Button href={`/season/${season.slug}`} variant="secondary">
              Back to the {season.year} season
            </Button>
          </div>
        </Section>
      ) : null}
    </>
  );
}
