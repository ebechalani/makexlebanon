import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from './ui';

export type Crumb = { label: string; href?: string };

/** Standard dark page header used on every inner page. */
export function PageHero({
  eyebrow,
  title,
  lead,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-ink-950 text-white">
      <div className="absolute inset-0 bg-grid" aria-hidden="true" />
      <div
        className="absolute -right-40 -top-52 h-[26rem] w-[26rem] rounded-full bg-brand-500/15 blur-3xl"
        aria-hidden="true"
      />

      <Container className="relative py-14 sm:py-20">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/50">
              {breadcrumbs.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-brand-300">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white/80">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 ? <span aria-hidden="true">/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="max-w-4xl text-3xl leading-tight sm:text-4xl lg:text-5xl">{title}</h1>

        {lead ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70 text-pretty">{lead}</p>
        ) : null}

        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </div>
  );
}
