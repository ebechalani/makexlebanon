/**
 * Coverage audit: lists the headings, outbound links, downloadable files and
 * embedded media on every page of the old GoDaddy site, so nothing is missed
 * when migrating. Read-only — prints a report, changes nothing.
 *
 *     node scripts/audit-old-site.mjs
 */

const PAGES = [
  '/',
  '/makex-2026-capelli-sport',
  '/national',
  '/international',
  '/training-%26-hints',
  '/traininngs',
  '/categories-2024-2025-1',
  '/national-2025-1',
  '/competition-kits',
  '/newsletters',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

for (const page of PAGES) {
  let html;
  try {
    const r = await fetch('https://makexlebanon.com' + page, { headers: { 'user-agent': UA } });
    if (!r.ok) {
      console.log(`\n### ${page}  -> HTTP ${r.status}`);
      continue;
    }
    html = await r.text();
  } catch (e) {
    console.log(`\n### ${page}  -> ERROR ${e.message}`);
    continue;
  }

  console.log(`\n${'='.repeat(74)}\n### ${page}\n${'='.repeat(74)}`);

  const title = strip(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
  console.log(`title: ${title}`);

  const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((m) => `  h${m[1]}: ${strip(m[2])}`)
    .filter((h) => h.split(': ')[1]);
  if (headings.length) console.log('headings:\n' + headings.join('\n'));

  // Paragraph text, deduped, only reasonably long ones
  const paras = [
    ...new Set(
      [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).filter((t) => t.length > 45),
    ),
  ];
  if (paras.length) {
    console.log('paragraphs:');
    paras.forEach((p) => console.log(`  - ${p.slice(0, 220)}${p.length > 220 ? '…' : ''}`));
  }

  // Downloadable assets
  const downloads = [
    ...new Set(
      [...html.matchAll(/href="([^"]*\/downloads\/[^"]+)"/g)].map((m) =>
        decodeURIComponent(m[1].split('?')[0].split('/').pop()),
      ),
    ),
  ];
  if (downloads.length) {
    console.log('downloads:');
    downloads.forEach((d) => console.log(`  - ${d}`));
  }

  // Outbound / non-site links
  const links = [
    ...new Set(
      [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !/makexlebanon\.com|wsimg\.com|godaddy|secureserver/i.test(u)),
    ),
  ];
  if (links.length) {
    console.log('external links:');
    links.forEach((l) => console.log(`  - ${l}`));
  }

  // Embedded media
  const iframes = [...new Set([...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
  const videoRefs = [...new Set(html.match(/vimeo\.com\/[0-9]+|youtube\.com\/[^\s"']+/g) || [])];
  if (iframes.length) console.log('iframes:\n' + iframes.map((i) => '  - ' + i).join('\n'));
  if (videoRefs.length) console.log('video refs:\n' + videoRefs.map((v) => '  - ' + v).join('\n'));

  const imgs = (html.match(/<img[^>]*>/g) || []).length;
  console.log(`images on page: ${imgs}`);
}
