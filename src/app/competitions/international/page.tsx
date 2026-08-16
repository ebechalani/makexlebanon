import type { Metadata } from 'next';
import { internationalEvents } from '@content/seasons';
import { getCategoryImages } from '@/lib/gallery';
import { Gallery, GalleryEmpty } from '@/components/Gallery';
import { PageHero } from '@/components/PageHero';
import { Badge, Container, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'International competitions',
  description:
    'MakeX intercontinental, international and world championship events attended by Lebanese teams.',
};

export default function InternationalPage() {
  // Photos live in public/gallery/international/<event slug>/
  const events = internationalEvents.map((event) => ({
    ...event,
    images: getCategoryImages(
      'international',
      event.slug,
      `${event.name}, ${event.location} ${event.year}`,
    ),
  }));

  return (
    <>
      <PageHero
        eyebrow="International"
        title="Intercontinental & championship events"
        lead="Teams qualifying through the national competition go on to represent Lebanon at MakeX events abroad."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Competitions', href: '/competitions' },
          { label: 'International' },
        ]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <div className="space-y-16">
            {events.map((event) => (
              <section key={event.slug} aria-labelledby={`event-${event.slug}`}>
                <div className="border-b border-slate-200 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{event.year}</Badge>
                    <Badge tone="neutral">{event.kind}</Badge>
                  </div>
                  <h2 id={`event-${event.slug}`} className="mt-3 text-2xl text-ink-900 sm:text-3xl">
                    {event.name}
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-500">{event.location}</p>
                </div>

                {event.summary ? (
                  <p className="mt-5 max-w-3xl text-ink-600 text-pretty">{event.summary}</p>
                ) : null}

                <div className="mt-8">
                  {event.images.length > 0 ? (
                    <Gallery images={event.images} />
                  ) : (
                    <GalleryEmpty
                      hint={`Add images to public/gallery/international/${event.slug}/ and they will appear here automatically.`}
                    />
                  )}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </div>

      <Section className="bg-slate-50">
        <SectionHeading
          title="The pathway"
          lead="Compete nationally, qualify, and travel. Each MakeX season culminates in a world championship that brings together teams from dozens of countries."
        />
      </Section>
    </>
  );
}
