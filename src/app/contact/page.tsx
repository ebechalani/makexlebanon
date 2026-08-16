import type { Metadata } from 'next';
import { site } from '@content/site';
import { PageHero } from '@/components/PageHero';
import { Button, ExternalIcon, Section, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact MakeX Lebanon about taking part in the national robotics competition, ordering field maps, or mentor training.',
};

export default function ContactPage() {
  const reasons = [
    {
      title: 'Enter a school team',
      body: 'Ask how your school can register for the next season and which category suits your students.',
    },
    {
      title: 'Order official field maps',
      body: 'Printed competition mats for each category, priced per map.',
    },
    {
      title: 'Mentor training',
      body: 'Sessions for teachers and coaches on kit, field setup and competition strategy.',
    },
    {
      title: 'Volunteer or referee',
      body: 'Help run a competition day as a referee, judge or event volunteer.',
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch with MakeX Lebanon"
        lead="For schools, mentors, parents, volunteers and partners."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Contact details */}
          <div>
            <SectionHeading eyebrow="Direct" title="Contact details" />

            <dl className="mt-8 space-y-6">
              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                  Email
                </dt>
                <dd className="mt-1.5">
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="break-all text-lg font-medium text-brand-600 hover:text-brand-700"
                  >
                    {site.contact.email}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                  Phone
                </dt>
                <dd className="mt-1.5">
                  <a
                    href={`tel:${site.contact.phoneHref}`}
                    className="text-lg font-medium text-brand-600 hover:text-brand-700"
                  >
                    {site.contact.phone}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                  Follow
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {site.social.map((s) => (
                    <a
                      key={s.href}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-700 ring-1 ring-slate-200 transition-colors hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                    >
                      {s.label}
                      <ExternalIcon />
                    </a>
                  ))}
                </dd>
              </div>
            </dl>

            <div className="mt-10">
              <Button href={`mailto:${site.contact.email}`}>Send an email</Button>
            </div>
          </div>

          {/* What to contact about */}
          <div>
            <SectionHeading eyebrow="Common requests" title="What we can help with" />

            <ul className="mt-8 space-y-4">
              {reasons.map((reason) => (
                <li
                  key={reason.title}
                  className="rounded-card bg-slate-50 p-6 ring-1 ring-inset ring-slate-200"
                >
                  <h3 className="text-base text-ink-900">{reason.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500 text-pretty">
                    {reason.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
