import Link from 'next/link';
import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                          */
/* -------------------------------------------------------------------------- */

export function Container({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Section({
  children,
  className = '',
  dark = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`py-16 sm:py-24 ${dark ? 'bg-ink-900 text-white' : ''} ${className}`}
    >
      <Container>{children}</Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Typography                                                                 */
/* -------------------------------------------------------------------------- */

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${
        dark ? 'text-brand-300' : 'text-brand-600'
      }`}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  dark = false,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  dark?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? <Eyebrow dark={dark}>{eyebrow}</Eyebrow> : null}
      <h2 className={`text-3xl sm:text-4xl ${dark ? 'text-white' : 'text-ink-900'}`}>{title}</h2>
      {lead ? (
        <p className={`mt-4 text-lg leading-relaxed text-pretty ${dark ? 'text-white/70' : 'text-ink-600'}`}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  external?: boolean;
  className?: string;
};

const buttonStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm',
  secondary: 'bg-white text-ink-900 hover:bg-brand-50 ring-1 ring-inset ring-ink-200/60',
  ghost: 'bg-white/10 text-white hover:bg-white/20 ring-1 ring-inset ring-white/25',
};

export function Button({
  href,
  children,
  variant = 'primary',
  external = false,
  className = '',
}: ButtonProps) {
  const classes =
    'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold ' +
    `transition-colors ${buttonStyles[variant]} ${className}`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        <ExternalIcon />
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards & badges                                                             */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'neutral' | 'muted' | 'success';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    neutral: 'bg-ink-50 text-ink-700 ring-ink-200',
    muted: 'bg-slate-100 text-slate-500 ring-slate-200',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  const base =
    'group relative flex flex-col rounded-card bg-white p-6 ring-1 ring-slate-200/80 ' +
    `transition-shadow ${href ? 'hover:shadow-lg hover:ring-brand-300' : ''} ${className}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return <div className={base}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

export function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
    >
      <path d="M7.5 4.5h-3v11h11v-3" strokeLinecap="round" />
      <path d="M11 4.5h4.5V9M15.5 4.5 9 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-4 w-4 shrink-0 ${className}`}
    >
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 shrink-0"
    >
      <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1" strokeLinecap="round" />
    </svg>
  );
}
