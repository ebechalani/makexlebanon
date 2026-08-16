/**
 * Imports the 2026 season ranking cards from Google Drive into
 * public/gallery/2026/, preserving the competition's own structure:
 *
 *     public/gallery/2026/<category>/<division group>/rank-01.webp
 *
 * The competition splits each category into schools and clubs divisions, and
 * then by age band, so those stay as separate galleries rather than being
 * merged. Cards are renamed by placing, and scripts/2026-ranks.json supplies
 * the rank plus the winner's name and school for each card, which becomes the
 * caption and the alt text.
 *
 *     node scripts/import-2026-photos.mjs [--source "<path>"] [--dry-run] [--force]
 *
 * Source images are ~2.3 MB PNGs; they are re-encoded to WebP (max 1400px).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DEFAULT_SOURCE =
  'G:/My Drive/HDD Eddy 2015-2026/MakeX/4.National competition 2026/Photos MakeX National 2026';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const sourceFlag = args.indexOf('--source');
const SOURCE = sourceFlag !== -1 ? args[sourceFlag + 1] : DEFAULT_SOURCE;

const MAX_WIDTH = 1400;
const WEBP_QUALITY = 82;

/** [Drive folder, category slug, division group slug, group label, sort order] */
const MAPPING = [
  ['Capelli Sportswonderland schools 4-5', 'sportswonderland', 'schools-4-5', 'Schools · ages 4–5', 1],
  ['Capelli Sportswonderland schools 6-7', 'sportswonderland', 'schools-6-7', 'Schools · ages 6–7', 2],
  ['Capelli Sportswonderland clubs 4-5', 'sportswonderland', 'clubs-4-5', 'Clubs · ages 4–5', 3],
  ['Capelli Sportswonderland clubs 6-7', 'sportswonderland', 'clubs-6-7', 'Clubs · ages 6–7', 4],

  ['Capelli Inspire schools 8-9', 'smart-logistics', 'schools-8-9', 'Schools · ages 8–9', 1],
  ['Capelli Inspire schools 10-12', 'smart-logistics', 'schools-10-12', 'Schools · ages 10–12', 2],
  ['Capell Inspire clubs 8-9', 'smart-logistics', 'clubs-8-9', 'Clubs · ages 8–9', 3],
  ['Capell Inspire clubs 10-12', 'smart-logistics', 'clubs-10-12', 'Clubs · ages 10–12', 4],

  ['Capell Starter schools 13-15', 'locker-room', 'schools-13-15', 'Schools · ages 13–15', 1],
  ['Capell Starter clubs 13-15', 'locker-room', 'clubs-13-15', 'Clubs · ages 13–15', 2],

  ['Capelli Soccer', 'football', 'overall', 'Overall standings', 1],

  ['MakeX Inspire schools', 'code-courier', 'schools', 'Schools', 1],
  ['MakeX Inspire clubs', 'code-courier', 'clubs', 'Clubs', 2],

  ['MakeX Starter', 'signal-rise', 'overall', 'Overall standings', 1],
];

const CATEGORY_NAMES = {
  sportswonderland: 'Capelli SportsWonderland',
  'smart-logistics': 'Capelli Inspire — Smart Logistics',
  'locker-room': 'Capelli Starter — Locker Room',
  football: 'Capelli Sport — Football',
  'code-courier': 'MakeX Inspire — Code Courier',
  'signal-rise': 'MakeX Starter — Signal Rise',
};

const IMAGE_RE = /\.(jpe?g|png|webp|heic)$/i;

const ranksPath = path.join(process.cwd(), 'scripts', '2026-ranks.json');
let RANKS = {};
try {
  RANKS = JSON.parse(await fs.readFile(ranksPath, 'utf8'));
} catch {
  console.error('WARN  scripts/2026-ranks.json not found — cards keep source order.');
}

async function listImages(dir) {
  try {
    return (await fs.readdir(dir))
      .filter((f) => IMAGE_RE.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  } catch {
    return null;
  }
}

/** Build the ordered, labelled card list for one division group. */
function describe(files, key, categoryName, groupLabel) {
  const known = RANKS[key];

  const cards = files.map((file, i) => {
    const info = known?.find((r) => r.i === i);
    return {
      file,
      rank: info?.rank ?? null,
      name: info?.name ?? '',
      team: info?.team ?? '',
    };
  });

  // Order: podium summary (rank 0) first, then placings, then unknowns, then
  // non-card extras (rank -1) last.
  cards.sort((a, b) => {
    const key_ = (c) =>
      c.rank === null ? 900 : c.rank === -1 ? 950 : c.rank === 0 ? 0 : c.rank;
    return key_(a) - key_(b);
  });

  // Some divisions have duplicate cards (two exports of the same placing, or
  // several podium variants) — suffix repeats so nothing overwrites.
  const used = new Map();
  const unique = (base) => {
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? `${base}.webp` : `${base}-${n}.webp`;
  };

  return cards.map((card, i) => {
    let outName;
    let caption;

    if (card.rank === 0) {
      // rank-00 so the summary graphic sorts ahead of the individual placings —
      // galleries are ordered by filename.
      outName = unique('rank-00-final-standings');
      caption = `${categoryName} — ${groupLabel}, final standings, MakeX Lebanon 2026`;
    } else if (card.rank === -1) {
      outName = unique('extra');
      caption = `${categoryName} — ${groupLabel}, MakeX Lebanon 2026`;
    } else if (card.rank !== null) {
      outName = unique(`rank-${String(card.rank).padStart(2, '0')}-${slug(card.name) || i}`);
      caption =
        `Rank ${card.rank} — ${card.name}` +
        (card.team ? `, ${card.team}` : '') +
        ` · ${categoryName}, ${groupLabel}, MakeX Lebanon 2026`;
    } else {
      outName = unique(`card-${String(i + 1).padStart(2, '0')}`);
      caption = `${categoryName} — ${groupLabel}, MakeX Lebanon 2026 results`;
    }

    return { ...card, outName, caption };
  });
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Plan -------------------------------------------------------------------

const plan = [];
for (const [folder, category, group, label, order] of MAPPING) {
  const files = await listImages(path.join(SOURCE, folder));
  if (files === null) {
    console.error(`WARN  source folder not found, skipped: ${folder}`);
    continue;
  }
  const key = `${category}__${group}`;
  plan.push({
    folder,
    category,
    group,
    label,
    order,
    key,
    cards: describe(files, key, CATEGORY_NAMES[category] ?? category, label),
    named: Boolean(RANKS[key]),
  });
}

console.log(`Source: ${SOURCE}\n`);
let planned = 0;
for (const g of plan) {
  console.log(
    `  2026/${g.category}/${g.group}`.padEnd(46) +
      `${String(g.cards.length).padStart(3)} cards  ${g.named ? 'ranked' : 'UNRANKED (source order)'}`,
  );
  planned += g.cards.length;
}
console.log(`  ${''.padEnd(44)} ${planned} total\n`);

if (DRY_RUN) {
  console.log('Dry run — nothing written.');
  process.exit(0);
}

// --- Convert ----------------------------------------------------------------

const root = path.join(process.cwd(), 'public', 'gallery', '2026');
let written = 0;
let skipped = 0;
let failed = 0;

for (const g of plan) {
  const dir = path.join(root, g.category, g.group);
  await fs.mkdir(dir, { recursive: true });

  const captions = {};
  for (const card of g.cards) {
    captions[card.outName] = card.caption;

    const target = path.join(dir, card.outName);
    if (!FORCE) {
      try {
        await fs.access(target);
        skipped++;
        continue;
      } catch {
        /* download it */
      }
    }

    try {
      const input = await fs.readFile(path.join(SOURCE, g.folder, card.file));
      const out = await sharp(input)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      await fs.writeFile(target, out);
      written++;
      process.stdout.write(`\r  converting… ${written + skipped}/${planned}   `);
    } catch (error) {
      console.error(`\nFAIL  ${g.category}/${g.group}/${card.outName} — ${error.message}`);
      failed++;
    }
  }

  await fs.writeFile(path.join(dir, 'captions.json'), JSON.stringify(captions, null, 2) + '\n');
  await fs.writeFile(
    path.join(dir, 'group.json'),
    JSON.stringify({ label: g.label, order: g.order }, null, 2) + '\n',
  );
}

console.log(`\n\n${written} converted, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
