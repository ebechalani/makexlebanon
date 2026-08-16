/**
 * Downloads the rules, scoresheets, combination sheets, STL archives and logo
 * from the old GoDaddy Website Builder site into this repository, using clean
 * filenames that match content/seasons.ts.
 *
 * Run once, then commit public/downloads and public/logo.png:
 *
 *     node scripts/fetch-legacy-assets.mjs
 *
 * Safe to re-run: existing files are skipped unless you pass --force.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const BLOB = 'https://img1.wsimg.com/blobby/go/858f9517-ed88-4f2f-8d73-b8abed746526/downloads';
const LOGO =
  'https://img1.wsimg.com/isteam/ip/858f9517-ed88-4f2f-8d73-b8abed746526/Lebanon-removebg-preview-4324f8e.png';

/** [destination filename, source URL] */
const ASSETS = [
  // --- Rules -------------------------------------------------------------
  [
    'downloads/sportswonderland-rules-v3.0.docx',
    `${BLOB}/ad03b91f-9a5c-4ed5-a54d-86f9a79cf3dc/01_SportsWonderland_Rules.docx`,
  ],
  [
    'downloads/capelli-smartlogistics-rules-v3.0.docx',
    `${BLOB}/7a6d6c52-5593-4663-9a8c-b77e287177ae/02_SmartLogistics_Rules.docx`,
  ],
  [
    'downloads/capelli-starter-locker-room-rules-v2.3.pdf',
    `${BLOB}/b4509345-411c-4d9e-9a90-85f433d23c37/Capelli%20Sport%20Cup%20-%20Starter%20Locker%20room%20Rules%20.pdf`,
  ],
  [
    'downloads/capelli-sport-soccer-rules-v2.3.pdf',
    `${BLOB}/515c62e6-31bd-44fd-9c57-83b6f2127ceb/Capelli%20Sport%20soccer%20rules%20v2.3.pdf`,
  ],
  [
    'downloads/2026-makex-inspire-code-courier-rules-v1.0.pdf',
    `${BLOB}/a5ef2d95-0f29-4c51-ae59-52878cf9599e/%5BEnglish%5D%202026%20MakeX%20Inspire%20Code%20Courier%20Rule.pdf`,
  ],
  [
    'downloads/2026-makex-starter-signal-rise-rules-v1.0.pdf',
    `${BLOB}/4b0603d9-7ed2-4f23-81c9-3a4d378dc628/%5BEnglish%5D%202026%20MakeX%20Starter%20Signal%20Rise%20Rules.pdf`,
  ],

  // --- Scoresheets -------------------------------------------------------
  [
    'downloads/sportswonderland-scoresheet.docx',
    `${BLOB}/dddece92-d236-4959-a78b-fbf96c9669aa/SportsWonderland_Scoresheet_updated.docx`,
  ],
  [
    'downloads/capelli-smartlogistics-scoresheet.docx',
    `${BLOB}/e6d4a2df-d548-470f-a6e0-0a076aa39f68/SmartLogistics_Scoresheet%20(1).docx`,
  ],

  // --- Official combinations --------------------------------------------
  [
    'downloads/capelli-inspire-8-combos.pdf',
    `${BLOB}/7115b5cb-e1d8-481c-8e09-6eb38705f7bb/Capelli%20Smart%20logistics%20Rules%20v2.0%20combos.pdf`,
  ],
  [
    'downloads/mtiny-sportswonderland-8-combinations.pdf',
    `${BLOB}/59c091c1-7532-40c2-8558-8c30cd15ef79/mtiny%20SportsWonderland%208%20Official%20combinations.pdf`,
  ],

  // --- STL archives ------------------------------------------------------
  [
    'downloads/inspire-starter-cube-stl.zip',
    `${BLOB}/d202a9c9-c538-468b-a42c-b8a480d8ce84/Inspire%20%2B%20Starter%20cube.zip`,
  ],
  ['downloads/soccer-stl.zip', `${BLOB}/ea37c620-dd84-42f3-b757-4e9411652df7/Soccer%20v2.0.zip`],
  [
    'downloads/sportswonderland-stl.zip',
    `${BLOB}/1b90f5b4-c7ac-4cc3-a0ee-597fd925060c/Sportswonderland.zip`,
  ],

  // --- 2025 season rules (from the old /national-2025-1 page) -------------
  [
    'downloads/2025-inspire-fruit-wonderland-rules.pdf',
    `${BLOB.replace('/downloads', '')}/MakeX%20Inspire%20Fruit%20Wonderland-60e4998.pdf`,
  ],
  [
    'downloads/2025-inspire-smart-logistics-national-rules.pdf',
    `${BLOB.replace('/downloads', '')}/MakeX%20Inspire%20national%202025-b8bbb65.pdf`,
  ],

  // --- Newsletters and brochure ------------------------------------------
  [
    'downloads/newsletter-victory-in-abu-dhabi.pdf',
    `${BLOB.replace('/downloads', '')}/Victory%20in%20Abu%20Dhabi%20(3).pdf`,
  ],
  ['downloads/makex-lebanon-brochure-2025.pdf', `${BLOB.replace('/downloads', '')}/5.pdf`],

  // --- Brand -------------------------------------------------------------
  ['logo.png', LOGO],
];

const force = process.argv.includes('--force');
const publicDir = path.join(process.cwd(), 'public');

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

let ok = 0;
let skipped = 0;
let failed = 0;

for (const [dest, url] of ASSETS) {
  const target = path.join(publicDir, dest);

  if (!force) {
    try {
      await fs.access(target);
      console.log(`skip   ${dest} (already exists)`);
      skipped++;
      continue;
    } catch {
      // Not present — download it.
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    console.log(`ok     ${dest}  (${human(buffer.length)})`);
    ok++;
  } catch (error) {
    console.error(`FAIL   ${dest}  — ${error.message}`);
    failed++;
  }
}

console.log(`\n${ok} downloaded, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) {
  console.log('Failed files were probably removed from the old site. Upload them manually.');
  process.exitCode = 1;
}
