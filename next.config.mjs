/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  /**
   * Permanent redirects from the old GoDaddy Website Builder URLs, so existing
   * links, bookmarks and search-engine results keep working after the switch.
   */
  async redirects() {
    return [
      { source: '/makex-2026-capelli-sport', destination: '/season/2026', permanent: true },
      { source: '/national', destination: '/competitions/national', permanent: true },
      { source: '/international', destination: '/competitions/international', permanent: true },
      { source: '/training-&-hints', destination: '/training', permanent: true },
      // /traininngs was the workshops-and-events archive, not the hints page.
      { source: '/traininngs', destination: '/workshops', permanent: true },
      { source: '/categories-2024-2025-1', destination: '/competitions/national', permanent: true },
      { source: '/national-2025-1', destination: '/season/2025', permanent: true },
      { source: '/competition-kits', destination: '/kits', permanent: true },
      // Hidden task-series page reachable only from a tile on the old
      // Training & Hints page — now the interactive course.
      { source: '/hints-smart-logistics', destination: '/training/interactive/smart-logistics', permanent: true },
      // /newsletters keeps its own route on the new site — no redirect needed.
    ];
  },
};

export default nextConfig;
