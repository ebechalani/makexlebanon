'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { nav, site } from '@content/site';
import { Container, ExternalIcon } from './ui';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
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
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active ? 'text-brand-300' : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>

                  {item.children ? (
                    <div className="invisible absolute left-0 top-full w-56 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      <ul className="overflow-hidden rounded-lg bg-white py-1.5 shadow-xl ring-1 ring-black/5">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className="block px-4 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}

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
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link href={child.href} className="block px-3 py-2 text-sm text-white/65">
                            {child.label}
                          </Link>
                        </li>
                      ))}
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
