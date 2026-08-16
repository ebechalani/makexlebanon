import type { Metadata } from 'next';
import { internationalEvents, seasons } from '@content/seasons';
import { PageHero } from '@/components/PageHero';
import { ArrowIcon, Card, Section } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Competitions',
  description:
    'National MakeX Lebanon competitions and the international MakeX events Lebanese teams have attended.',
};

export default function CompetitionsPage() {
  const links = [
    {
      href: '/competitions/national',
      title: 'National competitions',
      body: `Every MakeX Lebanon national season, ${seasons[seasons.length - 1].year} to ${seasons[0].year}, with categories and results.`,
      meta: `${seasons.length} seasons`,
    },
    {
      href: '/competitions/international',
      title: 'International competitions',
      body: 'MakeX intercontinental, international and world championship events attended by Lebanese teams.',
      meta: `${internationalEvents.length} events`,
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Competitions"
        title="Where MakeX Lebanon competes"
        lead="A national qualifier at home, and a pathway to MakeX events around the world."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Competitions' }]}
      />

      <Section>
        <ul className="grid gap-6 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.href}>
              <Card href={link.href} className="h-full">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-600">
                  {link.meta}
                </span>
                <h2 className="mt-3 text-xl text-ink-900 group-hover:text-brand-700">
                  {link.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500 text-pretty">
                  {link.body}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">
                  Open
                  <ArrowIcon className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
