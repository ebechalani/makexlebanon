import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Badge, Button, DownloadIcon, ExternalIcon, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Newsletters & brochure',
  description: 'MakeX Lebanon newsletters and the printable programme brochure.',
};

/**
 * Both issues migrated from the old site's /newsletters page. Issue 1 is a
 * Visme flipbook (embedded); Issue 2 is a PDF. Add new issues to this list.
 */
const newsletters: {
  issue: string;
  title: string;
  date: string;
  summary: string;
  /** Visme (or similar) viewer URL, shown embedded. */
  embed?: string;
  /** PDF in public/downloads. */
  pdf?: string;
}[] = [
  {
    issue: 'Issue 1',
    title: 'Back to School, Back to STEAM',
    date: 'September 2024',
    summary:
      'Opening the 2024–2025 season: what MakeX brings to Lebanese schools, and how to get a team started.',
    embed: 'https://my.visme.co/view/x40o07nn-makex-september-2024-quot-back-to-school-back-to-steam-quot',
  },
  {
    issue: 'Issue 2',
    title: 'Victory in Abu Dhabi',
    date: 'Winter 2024–2025',
    summary:
      'Lebanon at the MakeX International Competition in Abu Dhabi — results, team highlights and what the delegation brought home.',
    pdf: '/downloads/newsletter-victory-in-abu-dhabi.pdf',
  },
];

const publications = [
  {
    title: 'MakeX Lebanon brochure',
    summary:
      'The printable programme overview — categories, age groups and how schools take part. Designed for A3 printing.',
    href: '/downloads/makex-lebanon-brochure-2025.pdf',
  },
];

export default function NewslettersPage() {
  return (
    <>
      <PageHero
        eyebrow="Publications"
        title="Newsletters & brochure"
        lead="Season write-ups and printable material for schools, mentors and partners."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Newsletters' }]}
      />

      <Section>
        <SectionHeading eyebrow="Newsletters" title="Season newsletters" />

        <div className="mt-10 space-y-14">
          {newsletters.map((item) => (
            <article key={item.issue} className="rounded-card bg-white p-7 ring-1 ring-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{item.issue}</Badge>
                <Badge tone="neutral">{item.date}</Badge>
              </div>
              <h2 className="mt-4 text-xl text-ink-900">{item.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500 text-pretty">
                {item.summary}
              </p>

              {item.embed ? (
                <div className="mt-6">
                  <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                    <iframe
                      src={item.embed}
                      title={`${item.title} — newsletter`}
                      loading="lazy"
                      allowFullScreen
                      className="h-[75vh] min-h-96 w-full border-0"
                    />
                  </div>
                  <a
                    href={item.embed}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Open the newsletter in a new tab
                    <ExternalIcon />
                  </a>
                </div>
              ) : null}

              {item.pdf ? (
                <a
                  href={item.pdf}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-ink-800 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                >
                  <DownloadIcon />
                  Read the newsletter (PDF)
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </Section>

      <Section className="bg-slate-50">
        <SectionHeading eyebrow="Print" title="Brochure" />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {publications.map((item) => (
            <li key={item.href}>
              <article className="flex h-full flex-col rounded-card bg-white p-7 ring-1 ring-slate-200/80">
                <h2 className="text-xl text-ink-900">{item.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-500 text-pretty">
                  {item.summary}
                </p>
                <a
                  href={item.href}
                  className="mt-6 inline-flex items-center gap-2 self-start rounded-lg px-4 py-3 text-sm font-semibold text-ink-800 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                >
                  <DownloadIcon />
                  Download the brochure (PDF)
                </a>
              </article>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Button href="/contact" variant="secondary">
            Request printed copies
          </Button>
        </div>
      </Section>
    </>
  );
}
