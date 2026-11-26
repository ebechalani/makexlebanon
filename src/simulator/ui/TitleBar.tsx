/**
 * The slim title row of the simulator. It sits directly under the website's own header, so it
 * carries no logo and no "Home" button of its own: only where the page is on the site
 * (Home / Simulator / ...), its title, and the simulator's buttons on the right.
 *
 * On screens that show blocks and stage side by side the row is exactly 3rem tall; the size of
 * the mat is worked out from that (see .mbot2-mat in simulator.css). On a phone the path gets a
 * line of its own above the title.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { POWERED_BY } from './powered-by';
import { usePoweredBy, useTitleText } from './text/title-context';
import type { TitleText } from './text/types';

/** The pages above the simulator on the website: the Simulator page lists all the simulators. */
const parentPages = (text: TitleText): Array<{ label: string; href: string }> => [
  { label: text.homeCrumb, href: '/' },
  { label: text.simulatorCrumb, href: '/simulator' },
];

export interface TitleBarProps {
  /** short name of the category, e.g. "Fire Rescue Senior" */
  title: string;
  /**
   * true: on a phone a title that is too long for its line goes on over a second line instead of
   * being cut off ("Warehouse Sort sim..." on a 360 px phone; Fire Rescue Junior and Senior too).
   * Left out: cut off with "...", as it always was - the title of Fire Chief fits a 360 px phone.
   */
  wrapOnPhone?: boolean;
  /** the robot the simulator plays with, after the title ("mBot2" when left out; Fire Cadet: "mTiny") */
  robot?: string;
  /** the buttons on the right of the row */
  children?: ReactNode;
}

export function TitleBar({ title, wrapOnPhone = false, robot = 'mBot2', children }: TitleBarProps) {
  // (the title row is on every loading screen: it reads its own words of the table, not the whole table - ./text/title-context.tsx)
  const text = useTitleText();
  const PARENT_PAGES = parentPages(text);
  return (
    <div className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-white/10 bg-ink-950 px-3 py-1.5 text-white sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0">
      <nav aria-label={text.breadcrumb} className="max-sm:w-full">
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
        <h1 className={`truncate text-base font-semibold leading-tight text-white${wrapOnPhone ? ' max-sm:whitespace-normal' : ''}`}>
          {text.simulatorTitle(title)}<span className="font-medium text-brand-300 max-md:hidden">· {robot}</span>
        </h1>
        <PoweredBy className="truncate max-sm:hidden" />
      </div>

      {children ? <div className="ml-auto flex items-center gap-1.5">{children}</div> : null}

      {/* (on a phone the title shares its line with the buttons: the credit gets a line of its own, so it is never cut off) */}
      <PoweredBy className="w-full sm:hidden" />
    </div>
  );
}

/** Who the simulator is powered by (./powered-by.ts). Shown on every simulator page, also while it loads. */
export { POWERED_BY };

function PoweredBy({ className }: { className: string }) {
  const text = useTitleText();
  // (a Robot en fête simulator names who its page hands its loader: ./text/title-context.tsx PoweredByContext)
  const name = usePoweredBy() ?? POWERED_BY;
  return (
    <p className={`text-[11px] leading-tight text-white/60 ${className}`} data-powered-by>
      {text.poweredBy}<span className="font-semibold text-white/85">{name}</span>
    </p>
  );
}

/** A button of the title row: the website's light-on-dark button, a little smaller. */
export const titleBarButton =
  'flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 ' +
  'transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40';
