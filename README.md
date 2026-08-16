# MakeX Lebanon — website

The official website for MakeX Lebanon, at [www.makexlebanon.com](https://www.makexlebanon.com).

Built with Next.js 16 and Tailwind CSS 4. Replaces the previous GoDaddy Website Builder site.

---

## Running it locally

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Local preview with live reload |
| `npm run build` | Production build — run this before deploying |
| `npm run typecheck` | Checks for mistakes without building |

> **Known dev-only quirk:** the browser-tab icon and the social share image are generated
> images. They render correctly in `npm run build` and on Vercel, but return a 500 in
> `npm run dev` because of a Turbopack limitation. You can ignore it locally — it does not
> affect the deployed site.

---

## What is already in the site

Migrated from the old GoDaddy site:

- **The logo** — `public/logo.png`, used in the header, the footer and the social share card.
- **All 13 rules, scoresheets and STL archives** — in `public/downloads/`, linked from each
  category page.
- **180 competition photos** — see the table below.

| Season | Category | Images |
| --- | --- | --- |
| 2026 | Capelli SportsWonderland | 29 cards · 4 divisions |
| 2026 | Capelli Inspire — Smart Logistics | 26 cards · 4 divisions |
| 2026 | Capelli Starter — Locker Room | 12 cards · 2 divisions |
| 2026 | Capelli Sport — Football | 4 cards · 1 division |
| 2026 | MakeX Inspire — Code Courier | 16 cards · 2 divisions |
| 2026 | MakeX Starter — Signal Rise | 4 cards · 1 division |
| 2025 | Inspire — Fruit Wonderland | 27 photos |
| 2024 | Inspire — Fruit Wonderland | 154 photos |
| 2024 | Inspire — Smart Logistics | 449 photos |
| 2024 | Starter | 21 photos |
| 2024 | Challenger | 75 photos |
| International | Abu Dhabi 2024 | 238 photos |
| International | Thailand 2024 | 157 photos |
| International | Abu Dhabi 2023 | 88 photos |

**1,300 images in total.** All are re-encoded to WebP (max 1600px) on import, which took the
2024/2025 archive from ~1 GB of originals down to 176 MB.

### 2026 divisions and ranks

The 2026 competition splits each category into **schools** and **clubs** divisions, and then by
age band, so those stay as separate galleries rather than being merged:

```
public/gallery/2026/sportswonderland/schools-4-5/
                                     schools-6-7/
                                     clubs-4-5/
                                     clubs-6-7/
```

Each division folder has a `group.json` (its display label and sort order) and a `captions.json`
(alt text per card). Cards are named by placing — `rank-01-laeticia-bachaalany.webp` — so
filename order is rank order. `rank-00-final-standings.webp` is the podium summary graphic.

Rank, winner name and school come from `scripts/2026-ranks.json`, keyed by
`<category>__<division>`. **All fourteen divisions are filled in** — every card is named by
placing, and the homepage "Season 2026 champions" section is generated from the same file.
To correct a name or add a division later, edit that file and re-run:

```bash
node scripts/import-2026-photos.mjs --force
```

### Videos

`content/outreach.ts` holds the videos, each tagged with a `topic` so `/media` groups them by
subject rather than listing them flat: **Highlights**, **Season launches**, **National
competition**, **International competitions**, **Training & tutorials**. Each video's subject was
recovered from the heading it sat under on the old site. To add one, append to `videos` with a
`topic` from `VIDEO_TOPICS`.

The Vimeo showreel doubles as the **homepage hero background** (`src/components/HeroVideo.tsx`).
It is muted, looped and control-free, mounts only after first paint, and is skipped entirely for
visitors with `prefers-reduced-motion: reduce`. It is scaled to 125% to crop past the film's
burned-in subtitles.

### About the two kinds of gallery

The 2026 galleries hold the **published ranking cards** — one designed graphic per placing,
imported from Google Drive. Because of that, 2026 category pages say "Results" and
"N ranking cards" rather than "Gallery" and "N photos". This is controlled by
`galleryKind: 'results'` on the season in `content/seasons.ts`.

The 2024, 2025 and international galleries hold ordinary **event photography**.

### Why the old site under-reported its own photos

The GoDaddy galleries paginated at 20 images behind a "Show More" button, and the images past
the first 20 were never in the page source — they were rendered client-side. Scraping the HTML
therefore only ever found 20 per gallery. The real file lists were harvested from a browser with
every gallery expanded and are recorded in `scripts/legacy-manifest.json`.

To re-run the photo migration (it skips anything already downloaded):

```bash
node scripts/fetch-legacy-photos.mjs
```

To re-run the 2026 ranking-card import from Google Drive:

```bash
node scripts/import-2026-photos.mjs
```

### Still not imported

`4.National competition 2026/Photos MakeX National 2026/101NCZ_8_shareable/` on the Drive holds
**1,514 unsorted event photographs** from the 2026 competition (`DAN_*.JPG`). They are not
categorised, so they were left out rather than guessed at. Sort a selection into
`public/gallery/2026/<category>/` when you want them on the site.

---

## Adding competition photos

This is the part you will use most. **You never need to edit code to add photos.**

The 2026 galleries are empty and waiting — drop your photos into
`public/gallery/2026/<category>/` and they appear immediately.

Drop image files into the folder for the season and category:

```
public/gallery/<year>/<category>/
```

For example, photos of the 2026 football final go in:

```
public/gallery/2026/football/
```

They appear automatically on:

- the category page — `/season/2026/football`
- the gallery index — `/gallery`
- the category's photo count everywhere else

### The folders that already exist

**2026 season** — `public/gallery/2026/`

| Folder | Category |
| --- | --- |
| `sportswonderland` | Capelli SportsWonderland (4–7) |
| `smart-logistics` | Capelli Inspire — Smart Logistics (8–12) |
| `locker-room` | Capelli Starter — Locker Room (13–15) |
| `football` | Capelli Sport — Football (8–12) |
| `code-courier` | MakeX Inspire — Code Courier (8–12) |
| `signal-rise` | MakeX Starter — Signal Rise (10–13) |

**2025 and 2024 seasons** — `public/gallery/2025/` and `public/gallery/2024/`, each with
`fruit-wonderland`, `smart-logistics`, `starter`, `challenger`.

**International events** — `public/gallery/international/`, with `wuxi-2026`,
`abu-dhabi-2024`, `thailand-2024`, `abu-dhabi-2023`, `thailand-2023`.

### Rules for photo files

- **Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
- **Order:** photos are sorted by filename. Name them `01-opening.jpg`, `02-round-one.jpg`,
  `03-awards.jpg` to control the order.
- **Alt text** is generated from the filename, so use real words where you can.
  `final-round-winners.jpg` becomes "Final round winners" — this is what screen readers announce
  and what search engines read. Camera filenames like `IMG_4821.jpg` are recognised as
  meaningless and fall back to the category and year instead, e.g.
  "Capelli Sport — Football, MakeX Lebanon 2026 — photo 3".
- **Size:** resize to about 2000px on the long edge before adding. The site compresses and
  serves modern formats automatically, but very large originals slow down the build.

---

## Editing text, categories and contact details

Two files hold all the content:

### `content/site.ts`

Organisation name, description, email, phone, social links, the team-portal link, and the
navigation menu.

### `content/seasons.ts`

Seasons, categories, age ranges, descriptions, field-map prices, downloadable rules, the
international events list, and the training tracks.

To add next year's season, copy the `2026` block, change the year, slug, title and categories,
and move it to the top of the `seasons` array. Then create matching folders under
`public/gallery/<year>/`.

---

## Rules, scoresheets and other downloads

Files live in `public/downloads/` and are linked from `content/seasons.ts`.

These have **already been migrated** from the old GoDaddy site. To re-fetch them (for example
after the old site changes), run:

```bash
node scripts/fetch-legacy-assets.mjs
```

Re-running skips files that are already there; pass `--force` to overwrite.

To add a new document later: put the file in `public/downloads/`, then add an entry to that
category's `downloads` array with `kind` set to `rules`, `scoresheet`, `combinations`, `stl`
or `other`.

---

## Deploying

The site is designed for Vercel, the same platform already hosting the 2026 team portal.

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, and import `ebechalani/makexlebanon`.
3. Accept the defaults — Vercel detects Next.js automatically. No environment variables needed.
4. Deploy, and check the preview URL.
5. Only once the preview looks right: in **Settings → Domains**, add `makexlebanon.com` and
   `www.makexlebanon.com`, and follow Vercel's DNS instructions in your GoDaddy DNS panel.

Changing DNS is the point of no return for the old site, so leave it until last.

After the first deploy, every push to `main` redeploys automatically.

### Old URLs

`next.config.mjs` permanently redirects the previous GoDaddy paths to their new locations, so
existing links and search results keep working:

| Old path | New path |
| --- | --- |
| `/makex-2026-capelli-sport` | `/season/2026` |
| `/national` | `/competitions/national` |
| `/international` | `/competitions/international` |
| `/training-&-hints` | `/training` |
| `/traininngs` | `/workshops` |
| `/competition-kits` | `/kits` |
| `/national-2025-1` | `/season/2025` |
| `/categories-2024-2025-1` | `/competitions/national` |
| `/newsletters` | `/newsletters` (kept, now a real page) |

---

## Migration coverage

Every page of the old site was audited with `node scripts/audit-old-site.mjs`, which prints each
old page's headings, text, downloads, outbound links and embedded media.

**Carried across:** all six 2026 categories and their rules/scoresheets/STL files; the 2024,
2025 and international photo archives; the logo; the 2025 category rules; the "Victory in Abu
Dhabi" newsletter; the printable brochure; all seven videos (`/media`); the eleven workshops and
launches (`/workshops`); the competition-kit descriptions (`/kits`); the field-map order list
including mission type and the WhatsApp ordering link; the referee/volunteer sign-up; and all
four social accounts (Facebook, Instagram, YouTube, TikTok).

**Deliberately dropped** — these were faults on the old site, not content:

- the homepage hero repeated three times
- six copies of "Under construction…" on Training & Hints
- both newsletters labelled "Issue N1" when only one PDF exists
- broken `transparent_placeholder.png` images

**Not carried across, and why:**

- **Workshop photos** — `/traininngs` had 14 images alongside its event list. The events are on
  `/workshops`; the photos are not. Drop them into `public/gallery/workshops/` if you want them.
- **`/categories-2024-2025-1` graphics** — 7 category diagrams, superseded by the per-category
  pages.
- **"MakeX PowerPoint presentation 2025"** — embedded in the old page rather than linked, so
  there is no file to fetch. Send it over and it can be added to `/season/2025`.
- ~~Newsletter "Issue N2"~~ — found after all: the old page hid it in a client-side iframe.
  Issue 1 is the Visme flipbook "Back to School, Back to STEAM" (September 2024, embedded on
  /newsletters); Issue 2 is the "Victory in Abu Dhabi" PDF.

---

## Things left to fill in

These are marked with `TODO` or `NOTE` comments in `content/seasons.ts`:

- **2026 dates and venue** — currently blank, so the badges are hidden. Add them to the `2026`
  season's `dates` and `venue` fields.
- **Signal Rise field-map price** — the old site listed **$750** while every other map is
  $25–$150. Verify this; it looks like a typo for $75.
- **2026 event photos** — the ranking cards are in, but the 1,514 unsorted competition
  photographs on the Drive are not. See "Still not imported" above.
- **Ranking-card captions** — each 2026 gallery has a `captions.json` describing the division
  and age band. Edit it to add winner names, which become the alt text.
- **Training tracks** — four of the five are marked `coming-soon`. Write the content, then
  change `status` to `available` and add an `href` in `content/seasons.ts`.

---

## Project layout

```
content/            All editable text and data
  site.ts           Contact details, nav, org info
  seasons.ts        Seasons, categories, downloads, events, training
public/
  gallery/          Competition photos, by year and category
  downloads/        Rules, scoresheets, STL archives
scripts/
  fetch-legacy-assets.mjs
src/
  app/              Pages and routing
  components/       Header, Footer, Gallery, shared UI
  lib/gallery.ts    Reads the photo folders
```
