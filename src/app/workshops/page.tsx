import type { Metadata } from 'next';
import { workshops } from '@content/outreach';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { Badge, Button, Container, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Workshops & events',
  description:
    'MakeX Lebanon mentor training sessions, launches and regional workshops held across Lebanon since 2023.',
};

export default function WorkshopsPage() {
  // Most recent first.
  const sorted = [...workshops].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHero
        eyebrow="Outreach"
        title="Workshops, launches and mentor training"
        lead="MakeX Lebanon runs sessions for teachers, coaches and academies across the country, from Beirut and Keserwan to the Bekaa and the South."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Workshops & events' }]}
      />

      <div className="py-16 sm:py-24">
        <Container>
          <ol className="relative space-y-8 border-l border-slate-200 pl-6 sm:pl-8">
            {sorted.map((event) => (
              <li key={`${event.title}-${event.date}`} className="relative">
                <span
                  className="absolute -left-[1.9rem] top-2 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white sm:-left-[2.4rem]"
                  aria-hidden="true"
                />
                <div className="rounded-card bg-white p-6 ring-1 ring-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{event.dateLabel}</Badge>
                    {event.region ? <Badge tone="neutral">{event.region}</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-lg text-ink-900">{event.title}</h2>
                  <p className="mt-1 text-sm text-ink-500">{event.venue}</p>
                  {event.note ? (
                    <p className="mt-3 text-sm leading-relaxed text-ink-600 text-pretty">
                      {event.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </div>

      <Section dark>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <SectionHeading
            dark
            title="Want a workshop at your school?"
            lead="We travel across Lebanon to train mentors and introduce students to competitive robotics."
          />
          <div className="flex flex-wrap gap-3">
            <Button href="/contact">Request a session</Button>
            <Button href={site.volunteer.href} variant="ghost" external>
              Volunteer or referee
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
