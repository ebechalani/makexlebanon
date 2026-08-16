import type { Metadata } from 'next';
import { VIDEO_TOPICS, videos } from '@content/outreach';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { Button, ExternalIcon, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Videos',
  description:
    'Competition films and highlights from MakeX Lebanon national and international events.',
};

function embedUrl(video: (typeof videos)[number]) {
  if (video.provider === 'vimeo') {
    const hash = video.hash ? `?h=${video.hash}` : '';
    return `https://player.vimeo.com/video/${video.id}${hash}`;
  }
  return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0`;
}

export default function MediaPage() {
  return (
    <>
      <PageHero
        eyebrow="Media"
        title="Videos"
        lead="Highlights from MakeX Lebanon national competitions, launches and international trips."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Videos' }]}
      />

      <Section>
        <div className="space-y-16">
          {VIDEO_TOPICS.map((topic) => {
            const items = videos.filter((v) => v.topic === topic.id);
            if (items.length === 0) return null;

            return (
              <section key={topic.id} aria-labelledby={`topic-${topic.id}`}>
                <div className="border-b border-slate-200 pb-4">
                  <h2 id={`topic-${topic.id}`} className="text-2xl text-ink-900 sm:text-3xl">
                    {topic.title}
                  </h2>
                  <p className="mt-1.5 text-ink-500 text-pretty">{topic.blurb}</p>
                </div>

                <ul className="mt-8 grid gap-8 lg:grid-cols-2">
                  {items.map((video) => (
                    <li key={video.id}>
                      <div className="overflow-hidden rounded-card bg-ink-950 ring-1 ring-slate-200">
                        <div className="relative aspect-video">
                          <iframe
                            src={embedUrl(video)}
                            title={video.title}
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 h-full w-full border-0"
                          />
                        </div>
                      </div>
                      <h3 className="mt-4 text-lg text-ink-900">{video.title}</h3>
                      {video.context ? (
                        <p className="mt-1 text-sm text-ink-500">{video.context}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Section>

      <Section className="bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <SectionHeading
            title="More on our channels"
            lead="Full match footage, reels and behind-the-scenes from each competition day."
          />
          <div className="flex flex-wrap gap-2">
            {site.social.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
              >
                {s.label}
                <ExternalIcon />
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8">
          <Button href="/gallery" variant="secondary">
            Browse competition photos
          </Button>
        </div>
      </Section>
    </>
  );
}
