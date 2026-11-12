/**
 * The slim title row of the simulator. It sits directly under the website's own header, so it
 * carries no logo and no "Home" button of its own: only where the page is on the site
 * (Home / Training / ...), its title, and the simulator's buttons on the right.
 *
 * On screens that show blocks and stage side by side the row is exactly 3rem tall; the size of
 * the mat is worked out from that (see .mbot2-mat in simulator.css). On a phone the path gets a
 * line of its own above the title.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

/** The pages above the simulator on the website. */
const PARENT_PAGES: Array<{ label: string; href: string }> = [
  { label: 'Home', href: '/' },
  { label: 'Training', href: '/training' },
];

export interface TitleBarProps {
  /** short name of the category, e.g. "Fire Rescue" */
  title: string;
  /** the buttons on the right of the row */
  children?: ReactNode;
}

export function TitleBar({ title, children }: TitleBarProps) {
  return (
    <div className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-white/10 bg-ink-950 px-3 py-1.5 text-white sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0">
      <nav aria-label="Breadcrumb" className="max-sm:w-full">
        <ol className="flex items-center gap-x-2 text-sm text-white/70">
          {PARENT_PAGES.map((page, i) => (
            <li key={page.href} className="flex items-center gap-x-2">
              <Link href={page.href} className="rounded-sm transition-colors hover:text-brand-300">
                {page.label}
              </Link>
              {/* (on a phone the title starts a new line, so the last slash would point at nothing) */}
              <span aria-hidden="true" className={i === PARENT_PAGES.length - 1 ? 'max-sm:hidden' : undefined}>
                /
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* The title and, under it, who the simulator is powered by. The two lines together are
          lower than the row, so the row keeps its height. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h1 className="truncate text-base font-semibold leading-tight text-white">
          {title} simulator <span className="font-medium text-brand-300 max-md:hidden">· mBot2</span>
        </h1>
        <PoweredBy className="truncate max-sm:hidden" />
      </div>

      {children ? <div className="ml-auto flex items-center gap-1.5">{children}</div> : null}

      {/* (on a phone the title shares its line with the buttons: the credit gets a line of its own, so it is never cut off) */}
      <PoweredBy className="w-full sm:hidden" />
    </div>
  );
}

/** Who the simulator is powered by. Shown on every simulator page, also while it loads. */
export const POWERED_BY = 'RoboHolic Robotics Academy';

function PoweredBy({ className }: { className: string }) {
  return (
    <p className={`text-[11px] leading-tight text-white/60 ${className}`} data-powered-by>
      Powered by <span className="font-semibold text-white/85">{POWERED_BY}</span>
    </p>
  );
}

/** A button of the title row: the website's light-on-dark button, a little smaller. */
export const titleBarButton =
  'flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 ' +
  'transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40';
