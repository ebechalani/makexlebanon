/**
 * Downloads the competition photo galleries from the old GoDaddy Website
 * Builder site into public/gallery/, grouped by season and category.
 *
 *     node scripts/fetch-legacy-photos.mjs            # download
 *     node scripts/fetch-legacy-photos.mjs --dry-run  # list only
 *     node scripts/fetch-legacy-photos.mjs --force    # re-download everything
 *
 * The old site paginates each gallery at 20 images behind a "Show More"
 * button, and the remaining images are never present in the server HTML — they
 * are rendered client-side. So the full file lists were harvested from a real
 * browser with every gallery expanded, and recorded in legacy-manifest.json.
 * That manifest is the input here; this script only downloads and re-encodes.
 *
 * Originals are full-resolution phone/DSLR shots (0.3–5 MB each). They are
 * re-encoded to WebP at up to 1600px, which keeps them sharp for the lightbox
 * while keeping the repository to a sane size.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 80;
const CONCURRENCY = 6;

const manifestPath = path.join(process.cwd(), 'scripts', 'legacy-manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

/** dest -> [absolute source URL, ...] (groups with the same dest are merged) */
const plan = new Map();

for (const group of manifest.groups) {
  const urls = group.suffixes.map((s) => manifest._base + group.prefix + s);
  if (!plan.has(group.dest)) plan.set(group.dest, []);
  plan.get(group.dest).push(...urls);
}

console.log('Planned downloads:');
let planned = 0;
for (const [dest, urls] of plan) {
  console.log(`  ${dest.padEnd(32)} ${String(urls.length).padStart(4)} photos`);
  planned += urls.length;
}
console.log(`  ${''.padEnd(32)} ${String(planned).padStart(4)} total\n`);

if (DRY_RUN) {
  console.log('Dry run — nothing downloaded.');
  process.exit(0);
}

const galleryRoot = path.join(process.cwd(), 'public', 'gallery');
let ok = 0;
let skipped = 0;
let failed = 0;
let outBytes = 0;
const failures = [];

/** Download one image and write it as WebP. */
async function importOne(url, dir, index) {
  const name = `photo-${String(index + 1).padStart(3, '0')}.webp`;
  const target = path.join(dir, name);

  if (!FORCE) {
    try {
      await fs.access(target);
      skipped++;
      return;
    } catch {
      // not present yet
    }
  }

  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    await fs.writeFile(target, out);
    outBytes += out.length;
    ok++;
  } catch (error) {
    failed++;
    failures.push(`${path.basename(dir)}/${name}: ${error.message}`);
  }

  const done = ok + skipped + failed;
  if (done % 10 === 0 || done === planned) {
    process.stdout.write(`\r  ${done}/${planned} — ${ok} written, ${skipped} skipped, ${failed} failed   `);
  }
}

for (const [dest, urls] of plan) {
  const dir = path.join(galleryRoot, dest);
  await fs.mkdir(dir, { recursive: true });

  // Bounded concurrency: the CDN is fine with a handful of parallel requests.
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((url, j) => importOne(url, dir, i + j)));
  }
}

console.log(
  `\n\n${ok} downloaded (${(outBytes / 1024 / 1024).toFixed(1)} MB), ${skipped} skipped, ${failed} failed.`,
);
if (failures.length) {
  console.log('\nFailures:');
  failures.slice(0, 20).forEach((f) => console.log('  ' + f));
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  process.exitCode = 1;
}
