import type { Metadata } from 'next';
import Link from 'next/link';
import { trainingTracks } from '@content/seasons';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Badge, Button, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Training & hints',
  description:
    'Training material and competition hints for MakeX Lebanon mentors and students, by category.',
};

export default function TrainingPage() {
  const available = trainingTracks.filter((t) => t.status === 'available');
  const upcoming = trainingTracks.filter((t) => t.status === 'coming-soon');

  return (
    <>
      <PageHero
        eyebrow="Training"
        title="Training and hints for mentors and students"
        lead="Practical guidance for each competition category — field setup, sensor calibration, and scoring strategy."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Training' }]}
      />

      <Section>
        {available.length > 0 ? (
          <>
            <SectionHeading eyebrow="Available now" title="Published training tracks" />
            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {available.map((track) => (
                <li key={track.name}>
                  <Link
                    href={track.href ?? '#'}
                    className="group flex h-full flex-col rounded-card p-6 ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-brand-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{track.ageRange}</Badge>
                      <Badge tone="success">Available</Badge>
                    </div>
                    <h3 className="mt-4 text-lg text-ink-900 group-hover:text-brand-700">
                      {track.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500 text-pretty">
                      {track.summary}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
                      Open training
                      <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {upcoming.length > 0 ? (
          <div className={available.length > 0 ? 'mt-20' : ''}>
            <SectionHeading
              eyebrow="In preparation"
              title="Coming soon"
              lead="These tracks are being written. Contact us in the meantime and we will share what we have."
            />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((track) => (
                <li
                  key={track.name}
                  className="rounded-card bg-slate-50 p-6 ring-1 ring-inset ring-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{track.ageRange}</Badge>
                    <Badge tone="muted">Coming soon</Badge>
                  </div>
                  <h3 className="mt-4 text-base text-ink-800">{track.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500 text-pretty">
                    {track.summary}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section dark>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <SectionHeading
            dark
            title="Need help preparing a team?"
            lead="We run mentor sessions and can advise on kit, field setup and strategy."
          />
          <div className="flex flex-wrap gap-3">
            <Button href="/contact">Contact us</Button>
            <Button href={site.portal.href} variant="ghost" external>
              {site.portal.label}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
