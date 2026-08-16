import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { site } from '@content/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — National Robotics Competition`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    'MakeX Lebanon',
    'robotics competition Lebanon',
    'STEAM education Lebanon',
    'mBot2',
    'mTiny',
    'MakeX Inspire',
    'MakeX Starter',
    'student robotics',
  ],
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: `${site.name} — National Robotics Competition`,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — National Robotics Competition`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#05080f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    description: site.description,
    email: site.contact.email,
    telephone: site.contact.phone,
    address: { '@type': 'PostalAddress', addressCountry: 'LB' },
    sameAs: site.social.map((s) => s.href),
  };

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-900"
        >
          Skip to content
        </a>

        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
