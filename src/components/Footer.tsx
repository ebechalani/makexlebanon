import Image from 'next/image';
import Link from 'next/link';
import { nav, site } from '@content/site';
import { Container, ExternalIcon } from './ui';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-ink-950 text-white/70">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Image
              src="/logo.png"
              alt={site.name}
              width={935}
              height={267}
              className="h-10 w-auto"
            />
            <p className="mt-5 max-w-sm text-sm leading-relaxed">{site.description}</p>
          </div>

          <nav aria-label="Footer">
            <p className="text-sm font-semibold text-white">Explore</p>
            <ul className="mt-2 text-sm">
              {nav
                .filter((item) => item.href !== '/')
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-9 items-center py-1.5 transition-colors hover:text-brand-300"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-semibold text-white">Contact</p>
            <ul className="mt-2 text-sm">
              <li>
                <a
                  href={`mailto:${site.contact.email}`}
                  className="inline-flex min-h-9 items-center break-all py-1.5 transition-colors hover:text-brand-300"
                >
                  {site.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${site.contact.phoneHref}`}
                  className="inline-flex min-h-9 items-center py-1.5 transition-colors hover:text-brand-300"
                >
                  {site.contact.phone}
                </a>
              </li>
              {site.social.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 py-1.5 transition-colors hover:text-brand-300"
                  >
                    {s.label}
                    <ExternalIcon />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
