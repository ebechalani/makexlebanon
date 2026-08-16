import type { Metadata } from 'next';
import { kits } from '@content/outreach';
import { currentSeason } from '@content/seasons';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { Badge, Button, ExternalIcon, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Competition kits',
  description:
    'What each MakeX Lebanon competition category involves, the robot platforms used, and how to order official field maps.',
};

export default function KitsPage() {
  const maps = currentSeason.categories.filter((c) => typeof c.mapPriceUsd === 'number');

  return (
    <>
      <PageHero
        eyebrow="Equipment"
        title="Competition kits and field maps"
        lead="What each category involves, and how schools and academies equip a team."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Competition kits' }]}
      />

      <Section>
        <SectionHeading
          eyebrow="Categories"
          title="What each category involves"
          lead="These descriptions cover the MakeX Inspire and Starter category structure."
        />

        <div className="mt-12 space-y-8">
          {kits.map((kit) => (
            <article key={kit.category} className="rounded-card bg-white p-7 ring-1 ring-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{kit.ageRange}</Badge>
              </div>
              <h2 className="mt-3 text-xl text-ink-900">{kit.category}</h2>
              <div className="mt-3 space-y-3">
                {kit.body.map((para) => (
                  <p key={para.slice(0, 40)} className="leading-relaxed text-ink-600 text-pretty">
                    {para}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section className="bg-slate-50">
        <SectionHeading
          eyebrow="Order"
          title="Official field maps"
          lead="Printed competition mats for the current season, sold to participating schools and academies."
        />

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-ink-500">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Map
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Platform
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Mission type
                </th>
                <th scope="col" className="py-3 text-right font-semibold">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {maps.map((category) => (
                <tr key={category.slug} className="border-b border-slate-200">
                  <td className="py-4 pr-4 font-medium text-ink-800">{category.name}</td>
                  <td className="py-4 pr-4 text-ink-500">{category.platform ?? '—'}</td>
                  <td className="py-4 pr-4 text-ink-500">{category.mapMode ?? '—'}</td>
                  <td className="py-4 text-right font-semibold text-ink-900 tabular-nums">
                    ${category.mapPriceUsd?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={site.contact.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Order on WhatsApp
            <ExternalIcon />
          </a>
          <Button href="/contact" variant="secondary">
            Contact the organisers
          </Button>
        </div>
      </Section>
    </>
  );
}
