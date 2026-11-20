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

      // The mBot2 simulators were under Training until they got a section of their own,
      // /simulator. Shared links and bookmarks go on working (a query string is kept).
      { source: '/training/simulator', destination: '/simulator', permanent: true },
      // (straight to Fire Rescue Senior, the simulator that was at /simulator/fire-rescue: no chain of two redirects)
      { source: '/training/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true },
      { source: '/training/simulator/fire-chief', destination: '/simulator/fire-chief', permanent: true },
      { source: '/training/simulator/warehouse-sort', destination: '/simulator/warehouse-sort', permanent: true },

      // Fire Rescue was split into two categories, Fire Rescue Junior (10-12 years) and Fire Rescue
      // Senior (13-15 years). Its simulator - every combination drawn - is the Senior one now, so a
      // shared link or a bookmark keeps the game it had. Its category page is gone: the season page
      // lists both new categories.
      { source: '/simulator/fire-rescue', destination: '/simulator/fire-rescue-senior', permanent: true },
      { source: '/season/2027/fire-rescue', destination: '/season/2027', permanent: true },

      // The Locker Room rules file was the organiser's v2.3 until their newer rules replaced it
      // (README, "Locker Room"). The file now has a name without a version, so links to the old
      // file - shared, printed, or kept by a search engine - get the current rules.
      {
        source: '/downloads/capelli-starter-locker-room-rules-v2.3.pdf',
        destination: '/downloads/capelli-starter-locker-room-rules.pdf',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
