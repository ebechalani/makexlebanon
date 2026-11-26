'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { isNavGroup, nav, site, type NavGroup, type NavItem, type NavLink } from '@content/site';
import { Container, ExternalIcon } from './ui';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * What a link of a dropdown does when it is clicked: let go of the focus. The page changes without
 * a reload, so the clicked line would keep the focus and the list (shown on focus-within) would
 * stay open over the new page, on top of a game's Start button. Letting go of the focus closes it
 * as soon as the mouse leaves. (The dropdown of groups, Simulator, closes at once: DesktopItem.)
 */
function letGoOfFocus(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.blur();
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/90 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4 sm:h-20">
          <Link
            href="/"
            className="flex items-center gap-3 text-white"
            aria-label={`${site.name} — home`}
          >
            <Logo />
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <DesktopItem key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}

            <a
              href={site.portal.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              {site.portal.label}
              <ExternalIcon />
            </a>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white lg:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </Container>

      {/* Mobile navigation */}
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-ink-950 lg:hidden"
        >
          <Container className="py-4">
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2.5 text-base font-medium ${
                      isActive(pathname, item.href) ? 'text-brand-300' : 'text-white/85'
                    }`}
                  >
                    {item.label}
                  </Link>
                  {item.children ? (
                    <ul className="ml-3 border-l border-white/10 pl-3">
                      {item.children.map((child) =>
                        isNavGroup(child) ? (
                          <MobileGroup key={child.href} group={child} pathname={pathname} />
                        ) : (
                          <li key={child.href}>
                            <MobileLink link={child} />
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>

            <a
              href={site.portal.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
            >
              {site.portal.label}
              <ExternalIcon />
            </a>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}

/**
 * An item of the menu on a computer: its link, and under it its dropdown, which shows while the
 * pointer is on the item or the focus is in it (CSS only: the Tailwind group `group`).
 *
 * The dropdown of groups (Simulator, whose lines lead to the games) also closes once it has done
 * its job, and stays closed until the pointer comes onto the item or leaves it, or the focus comes
 * into it or leaves it (display: none, which closes the lists of its groups too):
 * - after a click on one of its lines or rows (or Enter on one). Its lines lead to the games, whose
 *   Start, Stop and Pause buttons sit right under it from 1024 to 1279 px; open while the pointer
 *   went from the line to Start, it took the click there and opened another game.
 * - on Escape, with the focus in it (the focus goes back to the item's link) or the pointer on it:
 *   what shows on hover or focus can be put away without moving either (WCAG 1.4.13).
 * The other dropdowns are as they always were.
 */
function DesktopItem({ item, active }: { item: NavItem; active: boolean }) {
  const grouped = item.children?.some(isNavGroup) ?? false;
  const [closed, setClosed] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!grouped) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const element = itemRef.current;
      if (event.key !== 'Escape' || !element) return;
      const focusIn = element.contains(document.activeElement);
      if (!focusIn && !element.matches(':hover')) return;
      // (the focus moves first: coming onto the link, it would open the dropdown again)
      if (focusIn) linkRef.current?.focus();
      setClosed(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [grouped]);

  const reopen = () => setClosed(false);
  const closing = grouped
    ? {
        onMouseEnter: reopen,
        onMouseLeave: reopen,
        onFocus: reopen,
        // (the focus leaving the item, unless the pointer is still on it: closed, it stays so until the pointer leaves)
        onBlur: (event: FocusEvent<HTMLDivElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) reopen();
        },
      }
    : {};

  return (
    <div ref={itemRef} className="group relative" {...closing}>
      {/* (px-2 below 1280 px: from 1024 px, where this menu starts, the eight items, the
          logo and the portal button only fit one line with the narrower padding) */}
      <Link
        ref={linkRef}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`rounded-md px-2 py-2 text-sm font-medium transition-colors xl:px-3 ${
          active ? 'text-brand-300' : 'text-white/75 hover:text-white'
        }`}
      >
        {item.label}
      </Link>

      {item.children ? (
        <div
          className={`invisible absolute left-0 top-full pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 w-56${closed ? ' hidden' : ''}`}
          // (a click on any of its links, which first let go of the focus: DropdownLink)
          onClick={
            grouped
              ? (event) => {
                  if ((event.target as Element).closest('a')) setClosed(true);
                }
              : undefined
          }
        >
          {/* (a list with groups lets their lists stand out of it, beside it: no overflow-hidden) */}
          <ul className={`${grouped ? '' : 'overflow-hidden '}rounded-lg bg-white py-1.5 shadow-xl ring-1 ring-black/5`}>
            {item.children.map((child) =>
              isNavGroup(child) ? (
                <DesktopGroup key={child.href} group={child} />
              ) : (
                <li key={child.href}>
                  <DropdownLink link={child} />
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A line of a dropdown on a computer. */
function DropdownLink({ link }: { link: NavLink }) {
  return (
    <Link href={link.href} onClick={letGoOfFocus} className="block px-4 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700">
      {link.label}
    </Link>
  );
}

/**
 * A group of a dropdown on a computer ("Season 2027"): a row of the dropdown with a chevron, and
 * beside it the list of the group's lines, which shows while the pointer is on the row or on the
 * list, or while the focus is in either (the keyboard reaches the group's lines right after its
 * row). CSS only, like the dropdowns: the named group `group/sub` is this row and its list. A list
 * that does not show is see-through and lets the pointer through (opacity, pointer-events), but
 * the keyboard can still reach it while the dropdown is open: Shift+Tab from a row goes back
 * through the lines of the group above it, which then shows. The group with the focus, then the
 * one under the pointer, is drawn over the others (z-index).
 *
 * Where the list opens: to the left of the dropdown below 1536 px (2xl), where there is room for it
 * at every width; to its right from 1536 px, where there is room to spare (170 px and more). The
 * Simulator item stands near the right end of the menu: up to 1279 px its dropdown ends about 180 to
 * 210 px from the edge of the window, less than the list's 224 px, and from 1280 px about 270 px, too
 * little to be sure of with another font or a scroll bar. The list touches the row: its padding
 * (pr-1 / pl-1) is the gap one sees, and it belongs to the group, so the pointer that crosses it
 * keeps the list open. The chevron says that the row has a list (it points right, wherever the list
 * opens, as in the menus of a computer); a screen without hover, where a tap on the row leads to its
 * part of the page and no list shows, has none. A screen reader hears what the row holds ("5
 * simulators", `description`).
 *
 * Hover intent: while the pointer is in the dropdown, a list shows, and goes, 150 ms after the
 * pointer comes onto its row or leaves it (delay-150). The focus in the group shows it at once (no
 * delay: the next Tab must find its lines), and once the pointer leaves the dropdown altogether the
 * list goes with the dropdown, at once. And on its way from the row to a line low in the list, the
 * pointer cuts across the rows below, or below the dropdown's corner, outside both: the "aim", a
 * see-through triangle from where the pointer last was on the row to the edge of the list, holds
 * the group under it the whole way, so that the list stays (menu-aim). The pointer that moves down
 * the rows instead soon leaves it; one that rests on it for 300 ms has it taken away (the row under
 * it then takes the hover at the pointer's next move), and a click on it goes to what lies under it.
 *
 * The row is a link to the group's part of the page (/simulator#season-2027): on a touch screen,
 * which cannot hover, a tap on it leads there, to the cards of the same simulators.
 */
function DesktopGroup({ group }: { group: NavGroup }) {
  const descriptionId = useId();
  const aimRef = useRef<HTMLSpanElement>(null);
  const restRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(restRef.current), []);

  /** Take the triangle away: the pointer left the group, or rests on it. */
  const stopAiming = () => {
    clearTimeout(restRef.current);
    if (aimRef.current) aimRef.current.style.clipPath = '';
  };
  /** The pointer moves on the row: the triangle goes from it to the near edge of the list, top to bottom. */
  const aimFrom = (event: MouseEvent<HTMLAnchorElement>) => {
    const aim = aimRef.current;
    const list = aim?.parentElement?.querySelector('ul');
    if (!aim || !list) return;
    clearTimeout(restRef.current);
    const box = aim.getBoundingClientRect();
    // (the triangle's box lies over the dropdown, beside the list: the list's edge is its left side, or its right)
    const edge = list.getBoundingClientRect().right <= box.left + 1 ? 0 : box.width;
    aim.style.clipPath = `polygon(${event.clientX - box.left}px ${event.clientY - box.top}px, ${edge}px 0, ${edge}px 100%)`;
  };
  /** The pointer moves beside the row: on the triangle (not yet on the list), it must keep moving. */
  const restOnAim = (event: MouseEvent<HTMLDivElement>) => {
    clearTimeout(restRef.current);
    if (event.target === aimRef.current) restRef.current = setTimeout(stopAiming, 300);
  };
  /** A click on the triangle is for what lies under it (a row below, or the page): it goes there. */
  const clickThrough = (event: MouseEvent<HTMLSpanElement>) => {
    stopAiming();
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const target = under?.closest('a, button') ?? under;
    if (target instanceof HTMLElement) target.click();
  };

  return (
    <li className="group/sub relative hover:z-10 focus-within:z-20" lang={group.lang} onMouseLeave={stopAiming}>
      <Link
        href={group.href}
        onClick={letGoOfFocus}
        onMouseMove={aimFrom}
        aria-describedby={descriptionId}
        className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700 group-hover/sub:bg-brand-50 group-hover/sub:text-brand-700 group-focus-within/sub:bg-brand-50 group-focus-within/sub:text-brand-700"
      >
        {group.label}
        <ChevronIcon className="[@media(hover:none)]:hidden" />
      </Link>
      {/* (in the menu's English, also in a group of another language) */}
      <span id={descriptionId} hidden lang={group.lang ? 'en' : undefined}>
        {group.description}
      </span>
      <div
        onMouseMove={restOnAim}
        className="pointer-events-none absolute -top-1.5 right-full w-56 pr-1 opacity-0 transition-[opacity,pointer-events] transition-discrete duration-0 group-hover:group-not-focus-within/sub:delay-150 group-hover/sub:pointer-events-auto group-hover/sub:opacity-100 group-focus-within/sub:pointer-events-auto group-focus-within/sub:opacity-100 2xl:right-auto 2xl:left-full 2xl:pl-1 2xl:pr-0"
      >
        {/* the aim: over the dropdown, beside the list; nothing of it until the pointer moves on the row */}
        <span ref={aimRef} aria-hidden="true" onClick={clickThrough} className="absolute inset-y-0 left-full w-full [clip-path:inset(50%)] 2xl:left-auto 2xl:right-full" />
        <ul aria-label={group.label} className="rounded-lg bg-white py-1.5 shadow-xl ring-1 ring-black/5">
          {group.children.map((link) => (
            <li key={link.href}>
              <DropdownLink link={link} />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/** A line under an item of the menu on a phone. */
function MobileLink({ link }: { link: NavLink }) {
  return (
    <Link href={link.href} className="block px-3 py-2 text-sm text-white/65">
      {link.label}
    </Link>
  );
}

/**
 * A group under an item of the menu on a phone ("Season 2027"): a button that shows or hides the
 * group's lines, indented under it. All are closed when the menu opens, but the group of the page
 * one is on, which starts open (the menu is drawn anew each time it opens).
 */
function MobileGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const listId = useId();
  const [expanded, setExpanded] = useState(() => group.children.some((link) => isActive(pathname, link.href)));
  return (
    <li lang={group.lang}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium text-white/80"
      >
        {group.label}
        <ChevronIcon className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <ul id={listId} hidden={!expanded} className="ml-3 border-l border-white/10 pl-3">
        {group.children.map((link) => (
          <li key={link.href}>
            <MobileLink link={link} />
          </li>
        ))}
      </ul>
    </li>
  );
}

/** A chevron pointing right: a group's lines are beside it (on a computer) or, turned down, open under it (on a phone). */
function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-3.5 w-3.5 shrink-0 ${className}`}>
      <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Official MakeX Lebanon logo (public/logo.png, 935×267). */
function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="MakeX Lebanon"
      width={935}
      height={267}
      priority
      className="h-9 w-auto sm:h-11"
    />
  );
}
