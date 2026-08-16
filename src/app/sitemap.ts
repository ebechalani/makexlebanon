import type { MetadataRoute } from 'next';
import { seasons } from '@content/seasons';
import { site } from '@content/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    { path: '/', priority: 1 },
    { path: '/season/2026', priority: 0.9 },
    { path: '/competitions', priority: 0.7 },
    { path: '/competitions/national', priority: 0.8 },
    { path: '/competitions/international', priority: 0.7 },
    { path: '/gallery', priority: 0.8 },
    { path: '/training', priority: 0.6 },
    { path: '/workshops', priority: 0.6 },
    { path: '/kits', priority: 0.6 },
    { path: '/media', priority: 0.6 },
    { path: '/newsletters', priority: 0.5 },
    { path: '/contact', priority: 0.6 },
  ];

  const seasonPaths = seasons.flatMap((season) => [
    { path: `/season/${season.slug}`, priority: 0.7 },
    ...season.categories.map((category) => ({
      path: `/season/${season.slug}/${category.slug}`,
      priority: 0.6,
    })),
  ]);

  // De-duplicate: /season/2026 appears in both lists.
  const seen = new Set<string>();
  const lastModified = new Date();

  return [...staticPaths, ...seasonPaths]
    .filter((entry) => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    })
    .map((entry) => ({
      url: `${site.url}${entry.path}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: entry.priority,
    }));
}
