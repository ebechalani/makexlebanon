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
| `npm run test:sim` | Runs the simulator's own tests — see "The Fire Rescue simulators" below |

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

Three files hold all the content:

### `content/site.ts`

Organisation name, description, email, phone, social links, the team-portal link, and the
navigation menu.

### `content/seasons.ts`

Seasons, categories, age ranges, descriptions, field-map prices, downloadable rules, the
international events list, and the training tracks.

To add next year's season, copy the `2026` block, change the year, slug, title and categories,
and move it to the top of the `seasons` array. Then create matching folders under
`public/gallery/<year>/`.

### `content/standalone.ts`

The categories of their own, outside every season: today **Robot en fête 2027**, whose French
simulators are named by their mission — today **Tri d’entrepôt**, the French version of Warehouse
Sort (a second, « Logistique intelligente », is to come: one more item of its `simulators`). Its
name, its texts (in French: the cards of its simulators on the Simulator page, its page
`/robot-en-fete`), its simulators and their lines in the menu. No season counts it (see "The Tri
d’entrepôt simulator (Robot en fête 2027)").

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
or `other`. An entry can also have a `note`: one or two plain sentences that the category page
shows under the link — for what a reader of the file must know and the file itself does not say.
Only the Locker Room rules have one (see "Which rules" in "The Locker Room simulator").

**The Capelli Starter — Locker Room rules are not fetched.** The organiser sent newer rules as a
Word file, which replaced v2.3 (the old address redirects: "Old URLs" below).
`capelli-starter-locker-room-rules.pdf` was made from it with LibreOffice, outside the
repository, without changing a word:

- Arial comes out as Liberation Sans (the same widths). The Word file sets three "−10 points."
  in "Arial Unicode MS", which was not installed: a fontconfig file (`FONTCONFIG_FILE`) maps it
  to Liberation Sans too, or they come out in another face.
- The Word file has no title. A copy of it got only `docProps/core.xml` with the title
  "Capelli Starter — Locker Room Mission — Official Rules", so that the PDF has one; `word/`
  stayed byte for byte.
- `soffice --headless --convert-to pdf`, with `HOME` set to an empty folder outside the
  repository (LibreOffice writes its profile there). Check the result with `pdfinfo` (a title,
  no author) and look at every page.

A later version goes in the same way, under the same name, so that every link stays.

---

## The Fire Rescue simulators: Fire Rescue Junior and Fire Rescue Senior

A browser simulator of the Makeblock mBot2 for the 2027 **Fire Rescue** categories. The student
builds a program with mBlock-style blocks and watches the robot run it on the competition mat,
on any starting combination the referee could draw, scored by the category rules.

**Fire Rescue is two categories.** The organiser split the 2027 category Fire Rescue (it was
11–13 years) into two: "a category 10-12 yo where the water buckets will be randomised position
everything else at its place. 13-15 yo everything is randomized." So there are two pages, on the
same field, with the same robot, referee and examples:

| Category | Ages | What the referee draws | Combinations | Page |
| --- | --- | --- | --- | --- |
| **Fire Rescue Junior** | 10–12 | only which bucket stands on which water tower W1–W4; every person stands where the rule book shows it (square 1, the person of each building in its colour) | 24 | `/simulator/fire-rescue-junior` |
| **Fire Rescue Senior** | 13–15 | everything: the buckets, the square of each person and its colour | 9,216 | `/simulator/fire-rescue-senior` |

```
https://www.makexlebanon.com/simulator/fire-rescue-junior
https://www.makexlebanon.com/simulator/fire-rescue-senior
```

(Fire Fighter, 8–10, and Fire Chief, 14–17, keep their ages: the overlaps with Junior and Senior
stay, as the organiser said.)

**Fire Rescue Senior is the Fire Rescue simulator of before the split**, unchanged: the same game
(`src/simulator/fire-rescue/game.ts`, Game id `'fire-rescue'`), the same 9,216 combinations and
codes, the same rules text. Only its title row says "Fire Rescue Senior simulator · mBot2". Because
the Game id stays `'fire-rescue'`, the blocks and settings a student saved on the old page, and the
program files saved there, are found again on the Senior page. The old address
`/simulator/fire-rescue` is a permanent redirect to `/simulator/fire-rescue-senior` (a shared link
or a bookmark keeps the game it had), `/training/simulator/fire-rescue` goes straight there too,
and the old category page `/season/2027/fire-rescue` goes to `/season/2027`, which lists both new
categories (see "Old URLs").

**Fire Rescue Junior is the same game with a smaller draw** (`src/simulator/fire-rescue-junior/`):

- `game.ts` — `fireRescueJuniorGame` is `fireRescueGame` with its own id `'fire-rescue-junior'`
  and its own combinations. The field, the robot, the start zone, the clock, the referee and the
  score sheet are the very same functions: nothing of `src/simulator/fire-rescue/` changed.
- `scenario.ts` — the 24 Junior combinations: the four buckets on W1–W4 in every order, the
  people always those of `defaultScenario()` (the rule book: everybody in square 1, red at A, blue
  at B, yellow at C, green at D). The random draw, the list of all 24 and the code reader only
  ever give one of these 24.
- **Its code is four letters**, the bucket colours on W1 W2 W3 W4: `RGBY` is the rule book. It is
  not a Senior code (`RGBY-A1R-B1B-C1Y-D1G`). The Junior page refuses every Senior code in plain
  words — also one whose people stand as in the rule book (then it says which four letters to type)
  — and every number, with the sentence it gives any text that is no code ("… is not a Fire
  Rescue Junior code."): the Senior page reads numbers too, but never shows one, so a student
  could not know one as a Senior code. Four letters with a colour more than once say how many
  times it is there ("red is there three times")
  (`src/simulator/ui/fire-rescue-junior/junior-code.ts`).
- Its **Combination** panel offers only the buckets; the people are listed, without buttons
  (`src/simulator/ui/fire-rescue-junior/CombinationEditor.tsx`). Its **Test on many
  combinations** window plays all 24, or the one on the stage — no random lists
  (`junior-batch.ts`). Its **Rules** window says what is drawn and that everything else stands
  where the rule book shows it; the rest of the rules is Senior's, word for word (`rules.ts`).
- Its Game id keeps its saved blocks and settings apart from Senior's (`mbot2-sim:fire-rescue-junior:…`
  in the browser). It shows the block palette of Fire Rescue (`GAME_VERSIONS` in
  `src/simulator/blocks/palettes.ts`), and a program file saved in one of the two opens in the
  other without "This program was saved in the … simulator" (`programGameOf` in
  `src/simulator/ui/program-file.ts`). A Junior file opened in another game says "saved in the
  Fire Rescue Junior simulator", a Senior file "saved in the Fire Rescue Senior simulator" (the
  name of its page, `gameName` in `program-file.ts`: the id `'fire-rescue'` alone would give
  "Fire Rescue"). A file saved on the Fire Rescue page before the split says "Fire Rescue
  Senior" too: it is the same game, and the old address leads to the Senior page.
- **Blocks made on the Fire Rescue page are on the Senior page**, under the id `'fire-rescue'`;
  Junior starts with its own, empty workspace. So that a student who used the Fire Rescue page
  (then for ages 11–13) and now opens Junior does not think them lost, Junior says, in a message
  at the bottom of the screen (20 seconds), "Did you make blocks on the Fire Rescue page before?
  They are on the Fire Rescue Senior page now. To use them here, press Save there, then Open
  here." It says so each time it opens with no block but the yellow start block, and only when
  this browser keeps Fire Rescue blocks (`earlier-blocks.ts`: it reads Senior's saved blocks and
  never changes them). Not in the note "Build your program here" in the workspace: on a phone
  that note has no room for three more sentences — they would lie on Blockly's zoom buttons.
- **The examples are the Fire Rescue examples, behind the same lock:** both pages ask
  `/api/simulator/unlock` for the game `'fire-rescue'`. `content/simulator-codes.ts` and the
  examples did not change. On the 24 Junior draws they score (measured headless, the test
  `src/simulator/fire-rescue-junior/game.test.ts` pins it):

  | Example | Points on the 24 Junior draws |
  | --- | --- |
  | `hello`, `line-follow`, `gripper-demo` | 0 on all 24 (as their texts say) |
  | `one-bucket` | 20 on the 6 draws with the red bucket on W1, 0 on the other 18 |
  | `smart-bucket` | 20 on all 24 |
  | `one-person` | 20 on all 24 — the red person always waits in A1 in Junior |
  | `full-mission` | 180 on `RGBY` only; 80 to 120 on the 23 others (on average 100.8 over all 24) |

  Three descriptions were written for a draw that moves the people, and say more than is true in
  Junior (they were not changed): `one-person` says it scores "ONLY when the red person waits in
  A1 … with another combination the square is empty" — in Junior it scores on every draw;
  `smart-bucket` says "for every one of the 9216 combinations" — Junior has 24; `one-bucket` says
  that with another combination "the robot runs into the person" — in Junior the person never
  moves, only the bucket can be the wrong one.

Both cards show the picture of the Fire Rescue mat, the one the game itself shows:
`public/simulator/fire-rescue/mat.webp` (no copy of it next to the new pages).

The same simulator has more games: **Fire Chief** (the maze, ages 14–17), **Warehouse Sort**
(the beginner mission of the MakeX Lebanon Inspire category, local event), **Locker Room**
(Season 2026), **Fire Fighter** (the letter towers, ages 8–10) and **Tri d’entrepôt** (Warehouse
Sort all in French, of Robot en fête 2027, a category of its own): see "The Fire Chief simulator", "The
Warehouse Sort simulator", "The Tri d’entrepôt simulator (Robot en fête 2027)", "The Locker Room simulator" and
"The Fire Fighter simulator" further down. One more simulator, **Fire Cadet**, is for another
robot, the mTiny, and has a screen of its own: see "The Fire Cadet simulator". `/simulator`
lists the eight simulators: seven by season, then Tri d’entrepôt in the part of Robot en fête 2027 — see
"The Simulator page" there. Nothing is installed, and the
student's blocks are saved in their own browser — they are never sent anywhere. The one thing
the simulator asks the website's server for is the ready-made examples: the server decides,
visitor by visitor, which of them to show and to open. See "Member codes for the simulator
examples" below.

Visitors reach each page from the Simulator page (the **Simulator** item of the menu, whose
dropdown also opens each simulator directly: "Fire Rescue Junior — Season 2027", "Fire Rescue
Senior — Season 2027"), its category page and the Season 2027 block on the homepage; the Season
2027 page marks both categories with an "Online simulator" label. All of that comes from the
`simulator` entry on each of the two categories in `content/seasons.ts`. Remove an entry and its
links disappear; the simulator page itself stays.

The older, simpler simulator inside the Smart Logistics lessons
(`/training/interactive/smart-logistics`) is separate and shares nothing with this one except
the Blockly library.

### The ruler and the enlarged stage

Two helpers on the stage (the mat with its buttons, on the right of the blocks):

- **Ruler** — a button next to Zones / Sensors / Path. While it is on, every click or tap on
  the mat sets a point. Two points make a line with its length in cm (one decimal); more points
  continue the line, and every corner shows the turn the robot would make there ("90° right").
  From three points on, the total length is shown too. A first point set **on the robot** starts
  at the robot's turning centre — the middle between its two wheels, the point that "moves
  forward" moves — and the line then begins with the turn from where the robot faces now. Read
  from start to end, the numbers are a plan: turn, length, turn, length. A piece that reads
  30.0 cm is what "moves forward 30 cm" drives.
  A point is dragged by pressing on it and moving; a press that does not move is a click. A
  click on an earlier point brings the line back to exactly that point ("drive there and come
  back"); a click close beside a point sets a new point there. **Clear** removes the line, the
  **Esc** key removes the last point (with no point left, it switches the ruler off). The same
  numbers are written as text in a row under the mat, for screen readers and for copying; a long
  text scrolls inside that row. While the ruler is on, the pointer does not drag the robot; the
  buttons that turn it still work. The line stays while a match runs. When the robot is no
  longer where a line was started on it (after **Reset field**, for example), the text says
  "From where the robot was" instead of "From the robot". Nothing of the ruler is saved: after
  a reload it is off.
- **Enlarge** — a button on the top right corner of the mat. While the ruler is on, it stands
  at the end of the ruler's row under the mat instead, so that every place of the mat can be
  clicked. The stage — mat, Start / Stop, clock and score, speed, the hint line, the buttons
  under the mat and the ruler — then covers the whole browser window, with the mat as large as
  the window allows (beside the controls on a wide window, between them on a tall one; on a
  small phone held upright the mat takes the full width and the buttons under it are reached by
  scrolling). The button then reads **Shrink**; the Esc key goes back too. Esc always undoes the
  smallest thing first: a point of the ruler, then the enlarged stage, then the ruler itself.
  It is a view that covers the window, not the browser's full-screen mode, so it works on
  phones and tablets as well. It is not saved either.

The ruler measures millimetres of the mat, the same millimetres the physics uses, so its
numbers do not depend on the size of the screen. Its arithmetic, its words and the rules of the
pointer (how close a click must be to a point, what counts as a click) are in
`src/simulator/ui/ruler.ts`, the rule for the Esc key and the hint line in
`src/simulator/ui/stage-view.ts`, the layout of the enlarged stage in
`src/simulator/ui/simulator.css` (look for "The enlarged stage").

### Where its files live

(The files that only Fire Chief has are listed in "The Fire Chief simulator" below.)

| Folder | What is in it |
| --- | --- |
| `src/simulator/core/` | The physics: the robot, its motors and sensors, collisions, the match clock |
| `src/simulator/vm/` | The interpreter that runs a block program, one block at a time |
| `src/simulator/blocks/` | The block language: every block, its colour and its place in the palette |
| `src/simulator/fire-rescue/` | Everything specific to Fire Rescue (the Senior game): the mat, the combinations, the referee, the example programs |
| `src/simulator/fire-rescue-junior/` | Fire Rescue Junior: the same game with its own id and only the 24 bucket draws |
| `src/simulator/members/` | The codes (member codes and advanced codes): what a code looks like, its fingerprint, and the check the server makes |
| `src/app/api/simulator/unlock/` | The address on the website that checks a code and hands out the examples a visitor may see |
| `src/simulator/ui/` | What you see: the screen, its buttons and panels, the drawing of the mat, and its stylesheet (`simulator.css`) |
| `src/app/simulator/fire-rescue-junior/`, `src/app/simulator/fire-rescue-senior/` | The two pages: their addresses, titles and descriptions |
| `src/simulator/ui/fire-rescue/`, `src/simulator/ui/fire-rescue-junior/` | The screen parts of Senior and of Junior (rules, combination editor; Junior also its words, codes and test lists) |
| `public/simulator/fire-rescue/` | The two pictures of the mat, for both pages: `mat.webp` is the one shown, `mat-sensor.webp` is the one the line sensor reads |
| `public/blockly-media/` | Blockly's own small pictures, shared with the Smart Logistics lessons |

### What to change, and where

| To change… | Edit |
| --- | --- |
| The programs in the **Examples** window, and the texts that explain them | `src/simulator/fire-rescue/samples.ts` |
| The title or the level of an example, and the headings "Starter", "Intermediate", "Advanced" | `src/simulator/fire-rescue/sample-catalog.ts` |
| Who may see and open the examples: the member codes, the advanced codes, and which example belongs to which group | `content/simulator-codes.ts` — see the next section |
| What the **Examples** window says about member codes (the hint under the field, "That code did not open the examples", …) | `src/simulator/ui/examples-words.ts` |
| The measurements of the mat (zones, lines, tower squares, sizes of the elements) | `src/simulator/fire-rescue/field.ts` |
| The scoring (points, bonus, penalties, what counts as delivered) | `src/simulator/fire-rescue/game.ts` |
| The short rules behind the **Rules** button | `src/simulator/ui/fire-rescue/rules.ts` (Senior, and every section after "The field" for both); `src/simulator/ui/fire-rescue-junior/rules.ts` (Junior's "The field") |
| What Fire Rescue Junior draws, and its codes | `src/simulator/fire-rescue-junior/scenario.ts`; the sentences for a refused code: `src/simulator/ui/fire-rescue-junior/junior-code.ts` |
| The words of the Junior screen ("24 combinations are possible: only the buckets …") | `src/simulator/ui/fire-rescue-junior/words.ts` |
| What the ruler says ("32.5 cm, then 90° right, …", "Click the mat to set the first point"), and how close a click must be to a point of the ruler (`RULER_REACH`) | `src/simulator/ui/ruler.ts` |
| The measurements of the robot | `src/simulator/core/robot.ts` |
| The text on the cards that lead to the simulators, the names and the ages of the two categories | `content/seasons.ts` |

The scoring file and the short rules are two separate things: the first one decides the points,
the second is only the summary students read. Change both when a rule changes.

### Member codes for the simulator examples

The simulators have seven games with examples: **Fire Rescue** (both pages, Fire Rescue Junior
and Fire Rescue Senior, show the same examples: both ask for the game `'fire-rescue'`), **Fire
Chief** (the maze), **Warehouse Sort** (Inspire, beginner), **Locker Room** (Capelli Starter,
Season 2026), **Fire Fighter** (Season 2027, ages 8–10) and **Robot en fête 2027** (Warehouse
Sort in French: the game `'robot-en-fete'`) for the mBot2, and **Fire Cadet** (Season 2027,
ages 4–7) for the mTiny. Each has its own **Examples** window with ready-made programs (in Fire
Cadet: rows of coding cards): seven in Fire Rescue, six in Fire Chief, six in Warehouse Sort,
six in Locker Room, six in Fire Cadet, six in Fire Fighter, six in Robot en fête 2027 (the six
of Warehouse Sort, in French). In every game the examples are in three groups, and there are two
kinds of codes:

| Group | Now in it, in Fire Rescue | Now in it, in Fire Chief, Warehouse Sort, Locker Room, Fire Cadet, Fire Fighter and Robot en fête 2027 | Who sees the card | Who can open it |
| --- | --- | --- | --- | --- |
| **Open to everyone** | the three starter examples | the three starter examples | everybody | everybody, without a code |
| **For members** | the two intermediate examples | the two intermediate examples | everybody — with a lock and "Members only" | a **member code** or an advanced code |
| **For advanced codes only** | the two advanced examples | the one advanced example | nobody else | an **advanced code** |

So there are three kinds of visitor, and each sees the same in every game:

- **No code.** Three open cards, two locked ones. Nothing else.
- **A member code** (one of the 500 you already have). Five open cards. Nothing else.
- **An advanced code.** All the cards of that game — seven in Fire Rescue, six in Fire Chief,
  Warehouse Sort, Locker Room, Fire Cadet, Fire Fighter and Robot en fête 2027 — under the
  headings Starter, Intermediate and Advanced (in Robot en fête 2027: Premiers pas,
  Intermédiaire, Avancé).

**One set of codes for all seven games.** There is no code "for Fire Rescue", "for Fire Chief",
"for Warehouse Sort", "for Locker Room", "for Fire Cadet", "for Fire Fighter" or "for Robot en
fête 2027". A member code opens the examples for members in every game, and an advanced code
opens every example in every game. The codes you have already handed out work in Fire Chief,
Warehouse Sort, Locker Room, Fire Cadet, Fire Fighter and Robot en fête 2027 as they are: there
is nothing to make and nothing to hand out again. Cancelling a code cancels it in every game.

An example of the third group is *hidden*, not locked. A visitor, and a member with an ordinary
member code, do not see its card, its title, the "Advanced" heading or a count — nothing on
the screen, and nothing in what their browser downloads, tells them that there is more. Not
one word about the examples is part of the pages themselves: the website's server sends each
browser the cards it may show, and it sends an advanced example only after it has checked an
advanced code.

**The two kinds of code look the same.** Both look like `FIRE-7K2M-9QXD` and are typed into the
same field. What makes a code a member code or an advanced code is the list it is on in
`content/simulator-codes.ts`. To tell them apart in your own files, the script numbers member
codes `1, 2, 3 …` and advanced codes `A1, A2, A3 …`.

**How somebody uses a code.** In the simulator: **Examples**, type the code under "I have a
member code", **Unlock**. Capitals, dashes and spaces do not matter. The cards open at once,
with their descriptions and a "Load this example" button. The browser remembers the code, so
it is typed once per device, and the simulator checks it with the server again on every visit.

The code is remembered once for all games. Somebody who typed a code in Fire Rescue — also
long ago, before Fire Chief existed — finds the examples of Fire Chief, Warehouse Sort, Locker
Room, Fire Cadet, Fire Fighter and Robot en fête 2027 open in the same browser without typing anything, and the other way round. Other tabs of the same browser that
have a simulator open follow at once: a code that is accepted in one tab opens the examples in
the others too (each asks the server what the code opens in its own game). A tab that follows
stands as it does after a fresh load with that code: what an earlier code had opened there is
closed until the server has answered, and if the server cannot be reached the tab says so and
offers "Try again". Only the tab in which a code was typed saves it; a tab that follows never
writes it back, and an answer that comes after the code was forgotten or replaced is dropped —
so "Forget" stays forgotten, and tabs never go on asking each other.

- **A member who gets an advanced code later** presses **Use a different code** in the same
  window and types the new one. Nothing has to be forgotten first. If the new code is
  accepted it takes the place of the old one; if it is not — a typing mistake — everything
  stays as it was.
- **"Forget this code on this device"**, in the same window, removes the code from the
  browser — useful on a shared computer. It is then forgotten for every game, and every other
  tab of that browser that has a simulator open locks its examples in the same moment (also
  the advanced ones): nobody has to remember to close or reload the other tab.

#### What you change, and where

Everything you decide is in one file, **`content/simulator-codes.ts`**. It has four parts, in
this order, each with its own explanation:

1. `examplesOpenToEveryone` — the examples that need no code
2. `examplesForAdvancedCodesOnly` — the examples only an advanced code shows
3. `simulatorCodes` — the member codes (a long list)
4. `advancedSimulatorCodes` — the advanced codes (at the very end of the file)

After any change: save, commit and push. The change is live once Vercel has redeployed.

**Moving an example between the three groups.** Every example has an id; the ids of all
seven games are listed at the top of the file:

- Fire Rescue: `'hello'`, `'line-follow'`, `'gripper-demo'`, `'one-bucket'`, `'one-person'`,
  `'smart-bucket'`, `'full-mission'`
- Fire Chief: `'chief-first-wall'`, `'chief-count-lines'`, `'chief-flame-fan'`,
  `'chief-wall-follow'`, `'chief-face-flame'`, `'chief-full-mission'`
- Warehouse Sort: `'sort-leave-start'`, `'sort-white-line'`, `'sort-cube-colour'`,
  `'sort-one-cube'`, `'sort-two-cubes'`, `'sort-all-cubes'`
- Locker Room: `'locker-to-station'`, `'locker-follow-line'`, `'locker-read-card'`,
  `'locker-team-cube'`, `'locker-two-tokens'`, `'locker-whole-mission'`
- Fire Cadet: `'cadet-three-forward'`, `'cadet-there-and-back'`, `'cadet-turn-around'`,
  `'cadet-two-rescues'`, `'cadet-round-the-sign'`, `'cadet-all-four'`
- Fire Fighter: `'fighter-first-grab'`, `'fighter-line-to-t'`, `'fighter-yellow-x'`,
  `'fighter-left-bay'`, `'fighter-right-bay'`, `'fighter-whole-mission'`
- Robot en fête 2027: `'fete-leave-start'`, `'fete-white-line'`, `'fete-cube-colour'`,
  `'fete-one-cube'`, `'fete-two-cubes'`, `'fete-all-cubes'`

Lists 1 and 2 hold the ids of all seven games together, one below the other. Every id of Fire
Chief begins with `chief-`, every id of Warehouse Sort with `sort-`, every id of Locker Room
with `locker-`, every id of Fire Cadet with `cadet-`, every id of Fire Fighter with
`fighter-` and every id of Robot en fête 2027 with `fete-`, so they cannot be mixed up: `'full-mission'` is the full mission of Fire Rescue, `'chief-full-mission'` the one
of Fire Chief. A line decides about that one example, in its own game, and about nothing in
another game. Robot en fête 2027 shows the six programs of Warehouse Sort in French, but it is a
game of its own: a line about `'sort-one-cube'` decides nothing for `'fete-one-cube'`. To open
or to hide an example on both pages, write both ids.

An example is in a group because of the list its id is on:

| To put an example into the group… | Its id must be… |
| --- | --- |
| **Open to everyone** | on list 1 (`examplesOpenToEveryone`), and not on list 2 |
| **For members** | on neither list |
| **For advanced codes only** | on list 2 (`examplesForAdvancedCodesOnly`), and not on list 1 |

To add an id to a list, write it on a line of its own between the square brackets, in quotes
and followed by a comma — `'one-bucket',`. To take it off, delete that line. Three examples:

- *Show "Smart bucket" to all members* (locked for visitors): delete the line `'smart-bucket',`
  from list 2.
- *Open "Deliver one bucket" to everyone*: add the line `'one-bucket',` to list 1.
- *Hide "Rescue one person" from everybody without an advanced code*: add the line
  `'one-person',` to list 2.

If an id ends up on both lists, the stricter rule wins — the example stays hidden — and the
tests fail and name it (see "Run its tests after every change"). If list 2 is empty, nothing
is hidden, and an advanced code opens exactly what a member code opens.

Mind the spelling of an id. A misspelt id on list 1 opens nothing; the tests point it out. A
misspelt id on **list 2** — one that is not the id of an example of either game — would hide
nothing: the example you meant to hide would be shown to everybody. So the website refuses to
be built with one: Vercel reports a **failed build**, its log names the line, and the website
stays exactly as it was until you correct the line and push again.

**Cancelling a code.** Look the code up in your CSV file and note its number.

| The number in your CSV file | The line to cancel in `content/simulator-codes.ts` |
| --- | --- |
| a plain number — for example **37** (a member code) | in the list `simulatorCodes`: the line that starts with `{ no: 37,` |
| a number with an A — for example **A7** (an advanced code) | in the list `advancedSimulatorCodes`, at the end of the file: the line that starts with `{ no: 7,` and ends with `// A7` |

Delete that line, or put `//` in front of it. That code then opens nothing, and a browser that
had it saved locks the examples again on its next visit. The other codes are not affected.

Mind the list. Both lists have a line `{ no: 7,` — one is member code 7, the other is advanced
code A7, and they belong to two different people. The surest way to find an advanced code is
to search the file for its number with the two slashes in front: `// A7`.

A person whose advanced code you cancel has no code any more. If they should go on as an
ordinary member, give them a member code.

After pushing, check that Vercel reports the deployment as done. If it reports a failed build
— a missing comma or quote in the file is enough — nothing has changed on the website yet: a
code you cancelled still works, and an example you hid is still shown, until the file is fixed
and pushed again.

#### Making codes

Do not write lines into the lists by hand: run the script. For **member codes**:

```bash
node scripts/generate-simulator-codes.mjs --count 50 --out ~/Documents/makex-member-codes-2.csv
```

For **advanced codes**, the same script with `--advanced`:

```bash
node scripts/generate-simulator-codes.mjs --advanced --count 10 --out ~/Documents/makex-advanced-codes.csv
```

Each run draws new codes and does two things. It writes the codes to the CSV file you named,
with the columns `No`, `Code` and `Given to` — open it in Excel and note who got which code.
And it adds one line per code to one list in `content/simulator-codes.ts`: the member list,
or with `--advanced` the advanced list. Nothing else in that file is touched. The screen says
which kind was made. Then commit and push `content/simulator-codes.ts`.

- The CSV file **must be outside this folder** — the script refuses anything else — and the
  script never overwrites a file, so give every run a new file name. Keep the files of the
  two kinds apart: put "member" or "advanced" in the name. Inside, the numbers tell you
  (`12` is a member code, `A12` an advanced code).
- Run it again whenever you need more: the new lines are added at the end of that list and
  the numbers go on from its last one, also when lines were deleted in between.
- `--replace` empties one list first and starts it again at number 1: the member list, or
  with `--advanced` the advanced list. The other list is not touched. **Every code of that
  kind handed out before stops working.** Use it only to start over.
- The codes are not shown on the screen. If you want to see them there as well, add
  `--print-codes`.
- A new code is never one that is already on either list.
- If the script answers that the file "does not look like the list this script writes", a
  line of one of the two lists of codes was damaged while editing (a lost quote or bracket,
  for instance). It then changes nothing and writes no CSV file. Undo your last edit of
  `content/simulator-codes.ts` and run it again.
- If `content/simulator-codes.ts` is not there at all, the script writes a new one: with the
  same explanations, with the starter examples of every game open to everyone and the advanced
  examples of every game kept for advanced codes — and with no code on it but the new ones, so
  every code handed out before stops working. (You never need this; it is what happens after
  the file was deleted.) The text of that new file is inside the script. **When an example is
  added to a game, or its id, title or level changes, change `content/simulator-codes.ts` and
  the same lines in `scripts/generate-simulator-codes.mjs`**: a test compares the two, and
  another one makes a new file and checks that it hides every advanced example of every game.

**Never commit the plain codes.** `content/simulator-codes.ts` holds only *fingerprints*: rows
of letters and digits worked out from the codes, from which a code cannot be read back. The
CSV files are the only place where the codes themselves exist. Keep them somewhere private,
keep a copy of them, and never put them in this folder, in a commit or in an issue — this
repository is public. (As a safety net, `.gitignore` leaves out any `.csv` file with "codes"
in its name.)

#### What the lock does not do

The honest limits:

- **The repository is public on GitHub.** Anyone who looks there can read every example
  program in the `samples.ts` of every game (`src/simulator/fire-rescue/samples.ts`,
  `src/simulator/fire-chief/samples.ts` and so on) — the advanced ones too — and can read in
  `content/simulator-codes.ts` which examples are kept for advanced codes. The lock and the
  hiding keep the examples out of the *website*, not out of GitHub. If that ever matters, the
  repository has to be made private.
- **Somebody with a code can pass things on**: the code itself, or a loaded example saved as a
  file (the **Save** button), which anyone can open with **Open** (Fire Cadet has no Save, but a
  row of cards can be copied by hand). One code per person keeps
  this in check — when a code gets around, cancel that one code. Give advanced codes only to
  people you trust with the advanced programs.
- **A shared computer remembers.** Once somebody has typed a code in a browser, the examples
  stay open — in every game, and the advanced ones too, if it was an advanced code — for
  everybody who uses that browser on that computer afterwards, until somebody presses "Forget
  this code on this device", or you cancel the code. On school computers, ask people to press
  it when they are done. (Pressing it in one tab locks the examples in every open tab of that
  browser. A very old browser that does not tell its other tabs still shows them there until
  the tab is loaded again.)
- **Forgetting a code does not empty the workspace.** A program that was loaded stays in the
  blocks (in Fire Cadet: in the row of cards) — and is saved in that browser — until somebody
  presses **New** (in Fire Cadet: **New row**) or loads something else. That goes for an advanced
  example as well.
- **A member can notice the field.** The window offers "Use a different code" to everybody
  whose examples are open. That is all it says: it does not say what another code would open,
  or that there is another kind.
- **The fingerprints are public too**, and a code is short. With 500 codes on the list, one
  fast graphics card that tries codes against the fingerprints finds *a* working member code
  in about half a day (it cannot aim at a particular person's code, and you cannot tell which
  one it found). The advanced list is much shorter, so finding an advanced code that way
  takes correspondingly longer — weeks rather than hours for a list of ten. All such a code
  opens is the programs that are already in this public repository.
- **The limit on wrong codes is a courtesy**, not a wall. After a hundred wrong codes within
  ten minutes from one network — a school, for instance — the server checks only one code per
  second from that network, and answers "wait a moment" in between. Nobody is locked out
  for a time: as soon as the wrong codes stop, a right code opens the examples again, a
  second later at most. A few typing mistakes never get near the limit. The wrong codes of a
  network are counted together for all games: trying codes in another game gives no new
  tries.

### Run its tests after every change

```bash
npm run test:sim
```

It runs about nineteen hundred checks (1,917 at the end of November 2026, with Tri d’entrepôt); among them,
every example program of every game is played on the real engine with the real referee and its
score is compared, and every practice map of Fire Cadet is proved. They also check
`content/simulator-codes.ts` (a misspelt example id, an example that is on both lists, a
damaged line, a code that is on both lists of codes) and that nothing about an example —
not even a title — can slip back into what every visitor's browser downloads. It takes
around two and a half minutes (136 to 146 s measured at the end of November 2026) and must end with `fail 0`. If it does not, do not deploy — a failing
test means a program would now score differently, a block would behave differently, or an
example would be shown to somebody who should not see it.

### If you change the site header

The simulator fills the window under the site header, so it has to know how tall the header
is. That height is written once, in `src/simulator/ui/page-frame.ts` (`--mbot2-site-header`:
4rem on phones, 5rem on wider screens). If the header in `src/components/Header.tsx` ever gets
taller or shorter, change the two numbers there to match, or the mat will no longer fit on a
laptop screen without scrolling.

### The Gripper blocks are shortcuts: "Inside the Gripper blocks"

Real mBlock has no Gripper category. The three blocks of the simulator's **Gripper** palette
were made for the simulator; in mBlock a student builds each of them as a **My Block**, out of
the "set servo … angle to …" block and a "wait". The simulator says so and shows that original
code, so that students can rebuild it in mBlock:

- The Gripper palette starts with two lines ("Shortcuts made for this simulator. mBlock does
  not have these blocks.") and the button **See the real mBlock code**. A right-click on a
  Gripper block — a long press on a touch screen — has an entry of the same name, and the
  tooltip of each Gripper block points to it.
- Both open the window **Inside the Gripper blocks**: five pairs, on the left a Gripper block,
  on the right the My Block it stands for, both drawn as real blocks.

| Gripper block | The My Block it stands for (default robot) |
| --- | --- |
| gripper opens until done | `define gripper opens`: set servo S2 angle to 0 °, wait 0.4 seconds |
| gripper closes until done | `define gripper closes`: set servo S2 angle to 60 °, wait 0.4 seconds |
| arm raises until done | `define arm raises`: set servo S1 angle to 90 °, wait 0.5 seconds |
| arm lowers until done | `define arm lowers`: set servo S1 angle to 0 °, wait 0.5 seconds |
| arm moves to height (50) % until done | `define arm moves to height (height)`: set servo S1 angle to height * 0.9 °, wait 0.5 seconds |

The window has two buttons; each is a single step of **Undo**:

- **Add these My Blocks to my program** puts the five definitions into the student's workspace
  as ordinary My Blocks: they appear under **My Blocks** and can be changed like any other. A
  second press adds nothing.
- **Show my program the mBlock way** replaces every Gripper block of the program by its My
  Block and adds the definitions that are needed. What is left is made only of blocks mBlock
  has. The examples score the same afterwards.

**Where the angles come from.** Nothing in the window is typed in by hand. The servo ports and
the angles are the measurements of the gripper in `src/simulator/core/robot.ts` (`gripper`:
servo S1 lifts the arm, 0° down and 90° up; servo S2 moves the claw, 0° open and 60° closed).
Each wait is the time that servo needs between its two positions at `servoSpeed` (180° per
second), rounded up to a tenth of a second. Change the robot there and the window, the My
Blocks and the rewritten programs follow. On a real mBot2 the right angles depend on how the
servos are mounted, so expect students to adjust the numbers in their own My Blocks.

Good to know:

- A Gripper block waits exactly until its servo has arrived (or is held up by what it grips);
  a My Block always waits its fixed time. A rewritten program therefore takes a little longer —
  the full mission 108 seconds instead of 103 — and scores the same.
- "arm moves to height" as a Gripper block keeps the height between 0 and 100. The My Block
  does not check it.
- A My Block the student already has under one of the five names is used as it is when it has
  the same number of inputs, moves the same servo and holds no Gripper block or other My Block
  (the student may have tuned its numbers). Any other My Block of that name is left alone, and
  the new one gets a number: "gripper opens 2".

The My Blocks themselves are written in `src/simulator/blocks/gripper-original.ts`, the words
of the window in `src/simulator/ui/gripper-code-words.ts`, the two lines of the palette in
`src/simulator/blocks/toolbox.ts`.

### Known limits

The simulator is a training tool, not a copy of the real field:

- **Nothing tips over.** Towers, buckets and people always stay upright.
- **Pushed objects slide but do not turn.** A real bucket pushed off-centre would also rotate.
- **The claw holds one object at a time.**
- **Distance-only programs are exact only because the simulated robot is perfect** — no wheel
  slip, no sensor noise. A program that drives "20.4 cm, turn, 10.4 cm" without looking at a
  sensor works every time here and will drift on a real mBot2. The examples that use sensors
  show the way.
- **Only the two centre lines can be followed** with the line sensor — the ones that run from
  the Fire Station to the upper and the lower safe zone.

---

## The Fire Chief simulator

The second game of the same simulator: the 2027 **Fire Chief** category, the "Dynamic Maze
Challenge" for ages 14–17. The robot — an mBot2 without the gripper, with a **colour sensor**
that looks forward and a **fan** at its front — starts in the START cell of a 5 × 5 field,
finds its way round the walls to the room with the fire, goes up to the red fire target,
reads "red", faces the target and blows at it for 3 seconds. The walls are different in every
round, so the student sets up the maze, draws a random one or types in a code. **Competition
mazes have 13 or 16 inner walls** (decided by the organiser): the page opens with one, and
every random maze it draws is one — see "Competition mazes: 13 or 16 inner walls" below. It
lives at:

```
https://www.makexlebanon.com/simulator/fire-chief
```

**The rules of this category are a draft** ("MakeX Lebanon 2027, Fire Chief, draft competition
rules": timing, scoring, restarts and the fan action are proposals). The simulator follows that
draft and what the organiser has decided since. Its **Rules** window says so in its first
line, and has a second part, "What this simulator assumes", for what nobody has decided yet
and a student can notice. When the organiser answers one of those questions, see "When the
organiser decides something" below.

**The draft names a flame sensor; the game has none.** The draft asks the robot to "use a
flame sensor to locate the infrared fire target". After the draft the organiser decided that
Fire Chief is played with a colour sensor that looks forward and that the fire target is red.
The simulator had a flame sensor for a short time while the page was being built; it is gone,
with its blocks. The word "flame" is still in the code where it means the wooden fire target
(the rules call it "the wooden flame"), in the flame sign the stage draws around the target,
and in two example ids (`chief-flame-fan`, `chief-face-flame`), which never change.

Everything that is general works as in Fire Rescue and is described above: the blocks and
their saving, the ruler and the enlarged stage, the examples and their codes, the title row
with "Powered by …", the header height.

### The Simulator page

The simulators have a section of their own on the website: **Simulator** in the menu, between
Training and Videos, leads to `/simulator`. It is one page (`src/app/simulator/page.tsx`, titled
"Robot simulators") that lists the eight simulators of two robots — Locker Room and Warehouse Sort
(Season 2026), Fire Cadet, Fire Fighter, Fire Rescue Junior, Fire Rescue Senior and Fire Chief (Season 2027), and
Tri d’entrepôt (Robot en fête 2027, no season); Fire Cadet is played with the
mTiny, the others with the mBot2 — with one part per season — "Season 2026", then "Season 2027" —
and in each part one card per simulator: the picture of its mat, its two labels (age group and season, or for a mission
without an age group its category and level, and its event), its name and two sentences. The
whole card is one link to the simulator; under the card of a category is the link "About
<category>" to its category page. Nothing about a simulator is written in that page itself:
it shows what `simulatorSeasons()` in `content/seasons.ts` gives. Every category in
`content/seasons.ts` that has a `simulator` entry gets a card in the part of its season, in the
order of that file:

```ts
simulator: {
  href: '/simulator/fire-chief',            // the simulator's page
  summary: 'Two sentences …',               // also shown on the category page
  mat: '/simulator/fire-chief/mat.webp',    // the picture on the card (a file under public/)
},
```

The same entry puts the "Online simulator" label on the season page and the simulator block on
the category page — and, for a category of the coming season (Season 2027), the "Try the
simulator" link in the homepage's block of that season. (The homepage's block of the current
season, Season 2026, links to the category pages only: Locker Room is reached from there through
its category page.) A simulator of a mission that
is not a category of a season (Warehouse Sort, the beginner mission of a local event) is an
entry of `missionSimulators` in the same file instead: its `season` (a year) says in which part
it is shown, after the categories of that season; it has two labels of its own (`label`,
`event`) and no "About" link. A season without a simulator gets no part. A category that belongs
to no season at all (Robot en fête 2027, whose simulator Tri d’entrepôt is the French version of
Warehouse Sort) is an entry of `standaloneCategories` in `content/standalone.ts`: after the seasons
it gets a part of its own, headed with its name and in its language (`lang="fr"`), with one card
per item of its `simulators`, which takes all its words from that entry ("Ouvrir le simulateur
Tri d’entrepôt", "À propos de Robot en fête 2027"), and whose "About" link leads to the category's
own page, `/<slug>`. `content/seasons.ts` does not know it, so no
season, count or list changes for it. The Training page
keeps one card that leads to `/simulator` (`simulatorTrack()` in `trainingTracks`, same file),
"Robot simulators": its badge and its sentence name the seasons and the simulators, worked out
from `simulatorSeasons()` too, so a simulator added later is named there by itself. The page and
the card name both robots ("blocks (mBot2) or coding cards (mTiny)"); the page of each game names
its own robot in its title row ("Fire Cadet simulator · mTiny", "Fire Rescue Senior simulator · mBot2").

The **Simulator** item of the menu has a dropdown, built by `simulatorMenu()` in
`content/site.ts` from the same `simulatorSeasons()`: "All simulators" (this page), then one
line per simulator in the order of the page, as "<name> — Season <year>" ("Warehouse Sort —
Season 2026"), and after them one line per simulator of a category of its own, from `content/standalone.ts`
("Tri d’entrepôt — Robot en fête 2027": the menu is English, and these two French names are proper names). A simulator added later gets its line by itself; on a phone the lines are listed
under "Simulator" in the menu. Keep simulator names short: on a computer the dropdown is as
wide as its longest line but at most 24rem (`max-w-sm` in `src/components/Header.tsx`), so that
at 1024 px it still ends inside the window; a longer line breaks onto a second one. A category
with a long name gives its simulator a shorter one for the menu with `menuName` (Capelli
Starter — Locker Room is "Locker Room — Season 2026" in the dropdown); the Simulator page keeps
the full name.

The simulators used to be under Training: `/training/simulator` and
`/training/simulator/<game>`. Those addresses are permanent redirects to the new ones
(`next.config.mjs`), so old links and bookmarks keep working, and the blocks a student saved
stay: the browser keeps them under the name of the game, not under the address of the page.
The pictures of the mats and the Blockly media stay where they were, in `public/simulator/<game>/`
and `public/blockly-media/`: a file there keeps its address next to the page of its game. The
two Fire Rescue pages share the pictures of the Fire Rescue game, in `public/simulator/fire-rescue/`:
there is no copy of them next to `/simulator/fire-rescue-junior` or `/simulator/fire-rescue-senior`.

### How the game is put together

| File | What is in it |
| --- | --- |
| `src/simulator/fire-chief/field.ts` | Every measure of the field, the walls and the fire target; the 25 cells and the 40 places where an inner wall can stand |
| `src/simulator/fire-chief/robot.ts` | The robot of this game: where the colour sensor and the fan sit and what they reach; where the robot starts |
| `src/simulator/fire-chief/scenario.ts` | A maze: which of the 40 walls stand, the room of the fire and its place in the room. Which mazes can be played, the named mazes, the default maze, the random mazes, how many inner walls a competition maze has, the short code |
| `src/simulator/fire-chief/game.ts` | The game and its referee: the four achievements with their points, the 3 minutes, the 3 seconds of the fan, the one restart, the end of an attempt. At its top: the two lists described below |
| `src/simulator/fire-chief/sample-catalog.ts`, `samples.ts` | The examples: titles and levels, and the programs with their descriptions. They stay on the server (see "Member codes" above) |
| `src/simulator/ui/fire-chief/` | What only this game shows: `FireChiefSimulator.tsx` (what the general screen is given), `MazeEditor.tsx` (the Maze panel) with its plain helpers `maze-plan.ts`, `maze-level.ts`, `maze-code.ts`, `maze-words.ts`, `maze-choices.ts`, `maze-batch.ts`, the `rules.ts` of the Rules window and the `words.ts` of the screen |
| `src/app/simulator/fire-chief/page.tsx` | The page: its address, title and description |
| `public/simulator/fire-chief/` | The two pictures of the mat: `mat.webp` is the one shown, `mat-sensor.webp` is the one the line sensor reads |

What the two games share is everything else: the engine (`src/simulator/core/` — it knows
walls, a colour sensor that is fixed to the front of a robot and a fan on a DC motor port for
any game), the interpreter, the blocks and the screen (`src/simulator/ui/SimulatorApp.tsx`).

- **The blocks.** Each game has its own palette (`src/simulator/blocks/palettes.ts`). Fire
  Chief has no Servo and no Gripper group, and two groups Fire Rescue does not have: **mBot2
  Extension Port** (the DC motor that drives the fan) and its own **Colour Sensor** group, for
  the sensor that looks forward ("colour sensor (1) detects [red] ?" and "colour sensor (1)
  colour"). Fire Rescue's group of the same name is another sensor, the one at the claw; no
  palette shows both. The texts on the blocks of these two groups are in
  `src/simulator/blocks/mblock-wording.ts`; that file also says, block by block, what has not
  been compared with real mBlock yet (see "Block texts that are not confirmed" below).
- **The referee has a memory.** In Fire Rescue the points can be read from the field at the
  end. Here they depend on what happened and when, so the referee looks at every moment of the
  attempt and writes down the time of each achievement — the ranking uses the time.
- **The screen's words.** The general screen says "match", "missions" and "combination"; this
  game hands it "attempt", "achievements" and "maze" (`src/simulator/ui/fire-chief/words.ts`;
  all the words a game can change are listed in `src/simulator/ui/screen-words.ts`).

### Where the measures, the decisions and the assumptions are

Every number is written once:

| What | Where |
| --- | --- |
| The mat (1500 mm, 5 × 5 cells of 300 mm), the walls (150 mm high, 3 mm thick, the wall around the field; what a colour sensor reads on them), the fire target (60 mm wide, 120 mm high, 20 mm deep; red; its three places per room), the size limits of the robot | `src/simulator/fire-chief/field.ts` |
| The colour sensor (in the middle of the front, 60 mm above the mat, reads from 15 mm or closer) and the fan (port M1, from 20 % power, 20° to each side, 300 mm) | `src/simulator/fire-chief/robot.ts` |
| The points (10, 20, 30, 40), the 180 seconds, the 3 seconds of the fan action, the one restart, how far the target may move before it counts as moved (5 mm) | `src/simulator/fire-chief/game.ts` |
| How many inner walls a competition maze has (13 or 16) | `src/simulator/fire-chief/scenario.ts` (`COMPETITION_WALL_COUNTS`) |

The top of `src/simulator/fire-chief/game.ts` holds two lists, each line with the name of the
constant behind it:

- **Decisions of the organiser** — what the organiser has answered since the draft: touching
  the target without moving it costs nothing; a fan action counts from outside the room within
  30 cm of the target (it then ends the attempt with 80 points); the 30 points need only the
  position — what the colour sensor reads does not matter to the referee; the target is 6 cm
  wide and 12 cm high; the outer edge of the field is walled; the walls are 3 mm thick; the
  robot finds the fire with a colour sensor that looks forward, and the fire target is red.
  One decision is not in that list, because it is about the maze and not about the referee:
  **a competition maze has 13 or 16 inner walls.** It is written at its constant,
  `COMPETITION_WALL_COUNTS` in `src/simulator/fire-chief/scenario.ts`, and described in
  "Competition mazes: 13 or 16 inner walls" below.
- **Assumptions** — everything neither the draft nor the organiser says, which the simulator
  had to choose. They are numbered 1 to 20 there; in short:
  - *The field:* how long a wall panel is; that the target is 20 mm deep and light enough to
    be pushed; its three places per room; **that it is red on every face**; **what the colour
    sensor reads on a wooden wall** ("yellow", never "red").
  - *The robot:* **which colour sensor it is and where it sits** (one sensor in the middle of
    the front, 60 mm above the mat, looking along one straight line, never wrong); **how close
    it must be** (15 mm or less from the face of the sensor — Makeblock gives 5 to 15 mm for
    its RGB colour sensors, and the simulator takes the strict end: a program that works at
    15 mm also works with a sensor that sees further); the fan (port M1, from 20 % power, 20°
    to each side).
  - *The referee:* when the target counts as moved (5 mm), that it cannot fall over, what
    "touching" (0.5 mm), "standing still" and "facing the target" mean, when a fan action
    begins, the last moment of the time, the restart, the start position, and one more end of
    an attempt ("the program has ended").
  - *The engine:* walls cannot be moved and are perfectly smooth.

  The list ends with the sentences of the draft that the simulator does not judge at all —
  among them "use a flame sensor", which the organiser's decision for a colour sensor
  overrules.

The **Rules** window (`src/simulator/ui/fire-chief/rules.ts`) has the same two parts: the
draft rules with the organiser's decisions, and "What this simulator assumes" — the
assumptions a student can notice. An assumption must never read like a rule.

#### Block texts that are not confirmed

Nobody has compared these texts letter for letter with real mBlock 5 (Makeblock's help pages
could not be opened when they were written). They are all in
`src/simulator/blocks/mblock-wording.ts`, each with a note on what exactly is open:

| Block (as the simulator shows it) | How sure |
| --- | --- |
| Group name "mBot2 Extension Port" | likely: it is the title of Makeblock's help page for these blocks |
| "DC motor [M1] rotates at power (50) %" | likely: the block exists, the word order was not read |
| "DC motor M1 rotates at power (50) % , DC motor M2 rotates at power (50) %" | a guess: a block for both ports exists, its text is open |
| "DC motor [M1] stops rotating" | a guess: the block exists; "stops rotating" and the menu entry "all" are open |
| Group name "Colour Sensor" | a guess: it depends on which colour sensor the robot gets |
| "colour sensor (1) detects [red] ?" | a guess: the usual pattern of an mBuild module; the words and the colours of the menu are open |
| "colour sensor (1) colour" | a guess: the words, and what it gives when it sees no colour ("none" here), are open |

(mBlock spells "color"; the simulator writes "colour" in every text of its blocks.)

#### Questions for the organiser

Each answer turns an assumption into a decision (see the next section for the steps):

1. **Which colour sensor is it**, and where on the robot does it sit? (Its model decides the
   blocks in mBlock, how far it sees and how wide its spot is.)
2. **How close must it be** to read a colour? The simulator takes 15 mm or less.
3. **Is the target red on every face**, or only on its front?
4. **What are the walls made of**, and what should a colour sensor read on them? (The
   simulator draws light wood and reads "yellow" on it, never "red".)
5. **Can the target really stand in a corner?** With the three assumptions above, a 130 mm
   wide robot that drives at a corner target is stopped by the two walls of the corner when
   its nose is exactly 15 mm from the target. So it reads "red" there only while it touches
   both walls or almost does (no pose that reads "red" is clear of both walls by more than
   1.4 mm, or further than 3 mm from either), and with no margin at all: with a sensor that
   reads from 14.999 mm the advanced example scores 30 points on the default maze, with 15 mm
   100. A sensor that sees a few millimetres further, or no corner place, would remove this
   (measured, as the most a robot that reads "red" can be clear of both walls at once: about
   5.3 mm with a range of 20 mm, 8.7 mm with 25 mm, 11.9 mm with 30 mm).
   Three questions in one:
   - **May a robot rest against the two walls of a corner?** The draft allows only "minor
     accidental contact with a wall" (§11). The simulator does not judge it; the two examples
     that go into the corner say "ask the referee first".
   - **How far does the real sensor read?**
   - **Does the corner place stay?**
6. **Where may the target stand**, how deep and how heavy is it, and how far may it be pushed
   before it counts as moved? (Assumed: three places per room, 20 mm, light, 5 mm.)
7. The exact texts of the DC motor blocks and of the colour sensor blocks in mBlock (the
   table above).
8. **What "directed towards the wooden flame" means** (§7). The simulator counts a fan action
   when the straight-ahead line of the fan hits the target, or the middle of the target is at
   most 20 degrees to the side. A robot turned by exactly 20 degrees counts. The sentence of
   the referee says "in this simulator" with that number, because it is no rule.
9. **The words that introduce the category on the website.** `content/seasons.ts` said "Two
   robots. One operation. Command the whole response." on the platform "mBot2 + vision" — the
   teaser from before the draft rules. The summary now says what the draft rules say (one
   robot, a maze that can change between rounds, find the fire), in words that are not the
   organiser's: see "Things left to fill in". The platform now reads "mBot2". That is **not**
   from the draft, which names no robot at all: it is what is left of "mBot2 + vision", and
   the robot the simulator plays this category with. Are these words right, and is the mBot2
   the platform — or what should stand there?
10. **Which number of inner walls is used in which round?** The organiser has decided that a
    competition maze has 13 or 16 inner walls, and has not said which of the two belongs to
    which round. The simulator offers both side by side and says nothing about rounds.
11. **Must every cell of a competition maze be reachable?** The decision names only the
    number of walls. The page asks for that number and a way from START to both rooms, so a
    maze built by hand with 13 or 16 walls and closed-off cells counts as a competition maze.
    If every cell must be reachable, add that condition to `isCompetitionMaze()` in
    `scenario.ts` and to `mazeKind()` in `maze-level.ts`.

#### When the organiser decides something

1. Change the constant (if the number changes).
2. In the comment of the constant, change the word `ASSUMPTION` to `DECISION`.
3. In the header of `game.ts`, move the line from the list of assumptions to the list of
   decisions. (A decision about the maze and not about the referee — the 13 or 16 inner walls
   of a competition maze — is written at its constant in `scenario.ts` instead of in that
   header.)
4. In `src/simulator/ui/fire-chief/rules.ts`, move the sentence from `FIRE_CHIEF_ASSUMPTIONS`
   into `FIRE_CHIEF_RULES` and word it as a rule.
5. `npm run test:sim`. Two tests tell you what you forgot: "decisions and assumptions" in
   `src/simulator/fire-chief/game.test.ts` compares the comments with the two lists, and
   `src/simulator/ui/fire-chief/rules.test.ts` compares **every number in the Rules window**
   with the constant that holds it. A number in the window that is on no list of that test
   fails it, so a new sentence with a number needs a line in its `CHECKS`.

### Competition mazes: 13 or 16 inner walls

**Decided by the organiser:** a competition maze has **13 or 16 inner walls** (the wall around
the field is not counted). With fewer walls a maze is a practice maze. The organiser has not
said which of the two numbers is used in which round, so no text of the simulator says it.

- **Why.** Where walls are missing, open squares make the ways short and the maze easy. 16 is
  the most a maze can have while every cell can still be reached: such a maze has corridors
  only, and exactly one way to each room. With 13, three walls of such a maze are gone and
  there are rings to drive round.
- **Can a robot circle for ever in a maze with rings?** One that keeps a hand on the wall
  cannot, on this field: START and both rooms lie against the outer wall, so the wall the hand
  follows from START leads through both rooms. A test walks it on squared paper
  (`scenario.test.ts`: 10 500 mazes — 3000 with 13 walls, 3000 with 16, 3000 of the mixed
  generator and 1500 that no generator draws — each with the left and with the right hand:
  both rooms reached in 21 000 of 21 000 walks, after 42 cells at most). A program that chooses
  its turns another way and does not remember where it has been can still circle — that is part
  of the challenge.
- **The one constant.** `COMPETITION_WALL_COUNTS = [13, 16]` in
  `src/simulator/fire-chief/scenario.ts`. Every text that names the numbers is built from it:
  the Rules window, the two random buttons of the Maze panel, the box "How hard is this
  maze?", the test window. A test (`maze.test.ts`: "every text of the screen that names the
  numbers …") fails for a line of the screen's code that writes 13 or 16 itself. The sentences
  that say "corridors only" count on the larger number being 16 (`PERFECT_MAZE_WALLS`, the
  number of a maze with one way only); the tests say so if the numbers ever change.
- **What a competition maze is, on the whole page:** it has 13 or 16 inner walls **and** a way
  from START to both rooms (`isCompetitionMaze()` in `scenario.ts`; the editor's `mazeKind()`
  in `maze-level.ts` gives the same answer). Every other maze is a **practice maze** — one with
  10 walls as much as one with a closed room. The two words mean this wherever the page says
  them. (A maze with 13 or 16 walls that was built by hand can have closed-off cells that are
  no room — `LC-18J6-69T0` has 13 walls and 4 such cells, `LC-Z8G6-69T0` 16 walls and 2: by
  the two conditions it is a competition maze, and the page calls it one, but it does not say
  "corridors only" about it. No random draw makes such a maze. See question 11.)
- **The generator.** `randomScenarioWithWalls(rng, count)` makes a random maze with exactly
  `count` inner walls the way the older `randomScenario()` makes its mixed mazes: a maze with
  corridors only, from which walls are taken away by chance. So every cell of it can be
  reached and it can always be played. `randomScenario()` itself is unchanged — the same seed
  gives the same maze of 4 to 16 walls as before (a test holds it to ten codes that were
  written down before the change and to one number made from the codes of seeds 1 to 2000;
  seeds 0 to 19 999 were also compared once with the website as it was before) — but the page
  does not draw from it any more.
- **The random mazes are of one sort.** The maze with corridors only is dug depth first
  (`perfectMazeWalls()`: one way on until it is stuck, then back), which gives long corridors
  and few dead ends. Counted on 20 000 mazes of each kind, against mazes drawn evenly among all
  mazes with corridors only (Wilson's algorithm, then the same walls taken away): 4.3 dead ends
  on average against 7.8 with 16 walls, 2.8 against 5.2 with 13; START has a single way out in
  13 % against 31 % of the mazes with 16 walls, 8 % against 20 % with 13. A competition maze
  built by hand can be of the other sort. The advanced example scored 100 points on those too
  (1000 of each kind, the fire at all six places: 12 000 attempts), more slowly on average
  (57.2 s with 13 walls, 74.8 s with 16) and with the same slowest times (116.0 s, 133.6 s).
- **What the page does with it.** It opens with a competition maze (see "The default maze"
  below); the Maze panel has one button for a random competition maze with 13 inner walls and
  one for 16; the box "How hard is this maze?" names the kind of the maze on the stage; each
  ready-made maze says on its button what it is; "Test on many mazes" draws random competition
  mazes of either kind; the Rules window has the decision among the rules of the field.
- **A code names the maze it always named.** Nothing about the code changed. `LC-4406-N0E0`,
  the code of the old default maze, is still "Crossroads" with the fire in the corner of the
  living room, and a visitor whose browser has saved a maze gets that maze back.

**Measured** with the advanced example ("The whole mission on any maze"), on one maze from each
seed 1, 2, 3, … (`randomScenarioWithWalls(makeRng(seed), count)`), the first 5000 different
ones of each kind, each maze with the fire at all six places (30 000 attempts of each kind, on
the simulator's perfect robot, which never slips):

| Inner walls | 100 points | Average time | Half of them under | Slowest | Cells the left hand drives to the fire room (on paper) |
| --- | --- | --- | --- | --- | --- |
| 13 | 30 000 of 30 000 | 50.7 s | 48.0 s | 116.0 s | 14.9 on average, 36 at most |
| 16 | 30 000 of 30 000 | 68.2 s | 64.3 s | 133.6 s | 20.8 on average, 42 at most |

In every attempt the mission was complete (3 seconds of fan on the fire) well inside the 180
seconds. The first 2000 mazes of each kind alone give 50.8 s / 116.0 s and 68.6 s / 133.6 s.
The test window's own list for seed 1 is another set of mazes (`randomMazes(5000, 1, count)`
in `maze-batch.ts` draws them all from one run of random numbers): 100 points in all 60 000
attempts, the same slowest times, averages of 50.8 s and 68.3 s, but half of them under 47.4 s
and 61.7 s — the middle value depends on the sample more than the others.
(The suite repeats this on a small scale: 30 mazes of each kind in `samples.test.ts`.)

### The Maze panel

The panel "Maze" under the stage (it takes the place of Fire Rescue's "Combination"):

- **The plan.** The 5 × 5 field with START and the two rooms. Each of the 40 places of an
  inner wall is a button: a click or a tap puts the wall up or takes it away, and the stage
  shows it at once. With the keyboard, the plan is one stop of the Tab key; the arrow keys go
  from wall to wall and the space bar switches the wall. A screen reader hears "Wall between
  A1 and B1, pressed". A change puts the field back to the start, as in Fire Rescue — also
  during an attempt.
- **Random competition maze:** two buttons, **13 inner walls** and **16 inner walls**. A press
  draws a new competition maze of that kind and a random place for the fire. They take the
  place of the old button "Random maze", which drew a maze with 4 to 16 walls: three random
  buttons and "Default maze" do not fit a 360 px phone in a way that stays clear, and a draw
  that mixes practice mazes and competition mazes would blur the two words. For an easier
  maze there are the three ready-made practice mazes, and any maze gets easier with a tap on
  one of its walls. (The buttons are a list the game hands to the general panel:
  `RANDOM_MAZE_DRAWS` in `maze-choices.ts`, shown by `CombinationPanel.tsx`. Fire Rescue
  hands over none and keeps its one "Random" button.)
- **Default maze:** back to the maze a new visitor sees first (see "The default maze" below).
- **Ready-made mazes** (the named mazes of the game). Each button has a small second line:
  "competition maze" (Detour, 13 walls; One way only, 16 walls) or "practice maze" (Open
  field, Two doors, Crossroads). The sentence under the buttons begins with the same words. A
  ready-made maze changes the walls only: the fire stays where the student put it.
- **The fire:** its room and its place in the room (corner, back wall, side wall).
- **How hard is this maze?** A level from 1 to 5, then **the kind of the maze with its
  walls** — "Competition maze: 13 inner walls.", "Competition maze: 16 inner walls, corridors
  only." or "Practice maze: 10 inner walls. A competition maze has 13 or 16 inner walls." (a
  practice maze is told what a competition maze has that it has not: the walls, the way to
  both rooms, or both) — and what was counted about the ways: the shortest way from START into
  the room of the fire, its turns, the dead ends. The level comes from the number of walls
  (none: 1, up to 6: 2, up to 11: 3, up to 15: 4, more: 5) and is one higher when the shortest
  way is 10 cells or longer. It is counted, not measured with a program, and the panel says
  so. The rules are in `src/simulator/ui/fire-chief/maze-level.ts`.
- **The code**, for example `LC-H8G6-69T0` (the default maze): the room of the fire (L or B),
  its place (C, B or S), then eight characters for the 40 walls. **Copy** copies it; typed or
  pasted into the field it brings the maze back. A text that is no code gets one plain
  sentence that says what a code looks like (`maze-code.ts`).

**A maze in which a room cannot be reached** is no competition maze — the draft asks for a way
from START to both rooms. The simulator still lets the student **start an attempt in it, for
practice**: a maze built by hand passes through such states, a closed room or a box around
START is a useful exercise, and nothing in the engine or the referee needs the ways. As long
as the maze is like this, the panel says what is wrong in the game's own words ("There is no
way from START to the bedroom: take a wall away.") in a note of its own, that it is a
practice maze and what a competition maze has, and it shows the closed cells in grey. Its
code can be copied and typed in like any other, and it is still there after a reload. (The
reasons are written down in `maze-words.ts`.)

**Test on many mazes** (the button in the title row) plays the program on a list of mazes:
10, 50 or 200 **random competition mazes**, in which the fire stands at each of its six places
in turn; the named mazes, each with the fire at its six places; or the maze on the stage with
the fire at its six places. While a random list is chosen, one small choice beside the seed
says which kind: **"Competition mazes with: 13 inner walls / 16 inner walls (corridors
only)"** — 13 when the window opens. That is one choice of two for all three lists; six lists
would have been more to read, and a list that mixed the two kinds could not be asked for 16
walls alone. The mixed list of before (4 to 16 walls) is gone with the old "Random maze"
button, for the same reason. Beside the progress ("10 / 10") the results name the kind they
come from ("Competition mazes with 13 inner walls"), so they cannot be taken for the other kind
when the choice changes before "Run again" (`batch-window.test.ts` clicks it through in
jsdom). With "This maze" chosen and a practice maze on the stage, a line says so and what a
competition maze has. For every run the table shows the points, the time
at which they were reached (the ranking uses it) and how the attempt ended in the referee's
own words. The lists are in `src/simulator/ui/fire-chief/maze-batch.ts`; a game hands the
general window its kinds of random lists as `BatchRandom.kinds` (`BatchDialog.tsx`).

### What to change, and where

| To change… | Edit |
| --- | --- |
| A measure of the field, the walls or the fire target | `src/simulator/fire-chief/field.ts` |
| Where the colour sensor sits and how far it sees, what the fan reaches, or where the robot starts | `src/simulator/fire-chief/robot.ts` |
| The points, the time of an attempt, the seconds of the fan action, the restart, when the target counts as moved | `src/simulator/fire-chief/game.ts` |
| The sentences of the **Rules** window | `src/simulator/ui/fire-chief/rules.ts` (and the list `CHECKS` in `rules.test.ts` when a number is new) |
| The named mazes, the default maze, how random mazes are made | `src/simulator/fire-chief/scenario.ts` |
| How many inner walls a competition maze has | `COMPETITION_WALL_COUNTS` in `src/simulator/fire-chief/scenario.ts` — one line; then `npm run test:sim` (see "Competition mazes" above) |
| How the level of a maze is counted, the words "competition maze" and "practice maze" and the sentence about the kind | `src/simulator/ui/fire-chief/maze-level.ts` |
| The two random buttons of the Maze panel, the words on the ready-made mazes | `src/simulator/ui/fire-chief/maze-choices.ts` |
| The lists of "Test on many mazes" and its two kinds of random lists | `src/simulator/ui/fire-chief/maze-batch.ts` |
| The examples | `src/simulator/fire-chief/samples.ts` and `sample-catalog.ts`; who may see them: `content/simulator-codes.ts` |
| The words "attempt", "achievement", "maze" and the hints of the buttons | `src/simulator/ui/fire-chief/words.ts` |
| The texts on the Colour Sensor and DC motor blocks | `src/simulator/blocks/mblock-wording.ts` |
| The cards and links that lead to the simulator | `content/seasons.ts`, `content/site.ts` |

#### Adding a named maze

Named mazes are drawn, not typed as numbers. In `src/simulator/fire-chief/scenario.ts`, add
an entry to `NAMED_MAZES`:

```ts
{
  id: 'zigzag',                      // never change an id later
  name: 'Zigzag',
  level: 3,                          // 1 (easiest) to 5: see below
  about: 'Nine walls. …',            // one sentence for the student
  scenario: maze('living', 'side', [ // the room of the fire and its place: corner, back or side
    '+---+---+---+---+---+',
    '| L |           | B |',         // "|" between two cells = a wall, a space = no wall
    '+   +---+---+   +   +',         // "---" under a cell = a wall, spaces = no wall
    …                                // 11 lines of 21 characters; see the top of scenario.ts
  ]),
},
```

That is all: the maze gets its button in the Maze panel and is part of "Test on many mazes".
`npm run test:sim` then tells you what else to do:

- A maze without a way from START to both rooms stops everything with "a maze of scenario.ts
  cannot be played".
- `level` must be the level the Maze panel counts for it (see "How hard is this maze?" above),
  so that the panel does not show two different levels for one maze.
- A few tests say "five named mazes" and "30 runs" in so many words (`scenario.test.ts`,
  `maze.test.ts`, `ui-games.test.ts`): change the numbers there.

A new named maze says by itself whether it is a competition maze (13 or 16 inner walls) or a
practice maze: on its button, in its sentence and in the list of the test window.

#### The default maze

The maze a new visitor sees first is the one `defaultScenario()` returns in the same file: the
walls of **"Detour"** — a competition maze with 13 inner walls — with the fire in the **corner
of the living room**, code `LC-H8G6-69T0`. (Until the organiser decided on 13 or 16 inner
walls it was "Crossroads", with ten walls. A visitor whose browser has saved a maze keeps that
maze.) The fire is not where the ready-made "Detour" has it, at the side wall of the bedroom:
the two examples that keep the left hand on the wall come to the living room first, so a
first visitor sees them find the fire; and a ready-made maze changes the walls only.

What the six examples do on it (each is a test in `samples.test.ts`):

| Example | On the default maze |
| --- | --- |
| Stop in front of the first wall | drives three cells up the middle and stops 7.5 cm in front of the wall above C2: 10 points after 5.7 s |
| Count grid lines to drive two cells | one cell up, a quarter turn to the left, two cells by counting lines: "Cells counted: 2", 10 points |
| Read red, then start the fan | sees a wall on the way up, shows "Choose: Open field" and stays in START (it knows the open field only) |
| Follow the right-hand wall to a room | ten cells round the right side into the bedroom: 30 points after 30 s |
| Find the fire in a room and check its colour | twelve cells with the left hand into the living room, finds the fire in its corner, reads red, blows: 100 points after 41 s |
| The whole mission on any maze | the same way: 100 points after 41 s |

Four example descriptions name the default maze (what the line counter counts there, the room
the right hand reaches, and the 41 seconds of the last two), and a test holds each of them to
it; so do the hint of the "Default maze" button and the example code under the code field.
Think twice before changing it, and run `npm run test:sim` when you do.

#### Adding an example

1. Write the program in `src/simulator/fire-chief/samples.ts`, built with the same helpers as
   the six that are there, and add it to `SAMPLE_PROGRAMS`.
2. Give it an id, a title and a level in `src/simulator/fire-chief/sample-catalog.ts`. The id
   starts with `chief-`: an id must not exist twice, in either game.
3. Decide who sees it, in `content/simulator-codes.ts`: add the id to `examplesOpenToEveryone`
   for an example without a lock, or to `examplesForAdvancedCodesOnly` to hide it from
   everybody without an advanced code. On neither list, it is an example for members.
4. `npm run test:sim`. The tests play every example in many mazes (`samples.test.ts`): add
   the points you expect from the new one there, and change the test that counts the
   examples ("six examples …"). The guard that keeps the examples out of the browser
   (`src/simulator/members/client-guard.test.ts`) reads the new title and id from the
   catalog by itself, but one of its tests counts them: change that number too. The website
   is not built while an id on one of the two lists is misspelt.

Use only blocks of the Fire Chief palette — blocks that exist in real mBlock. A test checks it.

### How the examples lock treats the games

Described in full in "Member codes for the simulator examples" above. In short:

- **One address, seven games.** Every simulator asks `/api/simulator/unlock`, and each says which
  game it is (Fire Rescue Junior and Senior both say `'fire-rescue'`: they show the same
  examples). The answer holds the cards and the programs of that game only, and says the name
  of the game back. A page takes an answer only when it is about its own game: should a tab
  stay open while the website is put back to a state from before Fire Chief, that older server
  answers every question with the examples of Fire Rescue — the Fire Chief page then shows
  "could not be reached" instead of the cards of the other game. (An answer without a name
  counts as Fire Rescue's, so the two Fire Rescue pages, Junior and Senior, go on working with
  such a server: both ask for `'fire-rescue'`.) The same happens after a rollback to the first
  release of Fire Chief, whose server answered rightly but did not say the name back: a Fire
  Chief tab that is still open then shows no examples and says "the website could not be
  reached", although it was. Loading the page again cures it, and so does putting the newer
  server back.
- **One set of codes.** A member code opens the member examples of every game, an advanced
  code shows every example of every game. There is nothing to make or to hand out for Fire
  Chief, Warehouse Sort, Locker Room, Fire Cadet, Fire Fighter or Robot en fête 2027.
- **Typed once.** The browser keeps the code in one place for all games.
- **The same three groups.** Fire Chief has three starter examples open to everyone, two for
  members and one that only an advanced code shows — and, without such a code, no card, no
  heading and no hint that it exists.
- **Wrong codes are counted together** for all games.

### Known limits of Fire Chief

- **The rules are a draft**, and so is everything that follows from them.
- **The fire target cannot fall over**, and it does not move at all when the robot hits it
  squarely where it stands flat against its wall. A real target can fall.
- **Walls cannot be moved** and are perfectly smooth: a robot that touches one slides along it.
- **The robot is perfect** — no wheel slip, no sensor noise. The examples that count cells by
  distance work every time here and will drift on a real robot.
- **The texts of the Colour Sensor and DC motor blocks** have not been compared letter for
  letter with real mBlock (see "Block texts that are not confirmed" above).
- **The colour sensor is an assumption from end to end**: which sensor, where it sits, that it
  reads from 15 mm or closer, that it is never wrong. With the target in a corner the robot
  reads "red" only while it touches the two walls of that corner (question 5 above).
- **No reading of the colour sensor is worth a point.** The referee counts the position only,
  so a program that never reads a colour scores the same.
- **The colour sensor reads only from 1.5 cm**, and on the screen that is a few dots: a robot
  that looks as if it stood at the target can read "none". The screen says so in four places:
  under the "Colour sensor" row of the Sensors panel (always to be read), on the closed
  Sensors panel when the robot is close to something and reads "none" ("colour none (too
  far)" — without the number: wherever the 1.5 cm are written, "in this simulator" stands
  with them, and the closed panel has no room for that on a phone), as a short line in front
  of the robot in the **Sensors** view (it ends exactly where the range ends — flat ends,
  nothing is painted beyond — and takes the colour that is read), and in the Rules window.
- **Walls are drawn thicker than they are** (6 dots at least, the real wall is 3 mm), around
  their true middle line. The robot stops at the real wall, and the ruler measures the real
  field: measured to the edge of a drawn wall it reads up to 1.5 cm short. The Rules window
  says to measure to the middle of a drawn wall.
- **The air of the fan is drawn 20 degrees to each side**, and the referee asks for the
  *middle* of the target within those 20 degrees (or for the straight-ahead line of the fan to
  hit the target). So the drawn air can lie on a part of the target while the fan action does
  not count; the sentence of the referee then gives the angle. While the fan blows, the fan on
  the robot has a bright ring: close to the target the air itself is hidden.
- **The line above the mat says the end of an attempt in the referee's first words** ("Mission
  complete at 0:14.4 with 80 of 100 points."), on two lines at most where the stage stands
  beside the blocks. The whole sentence is at the top of the Score sheet and in the Console.
  In a window that is only just wide enough for that layout (1024 dots) two lines can be too
  short for the text: its end is then cut off ("…"), and the pointer shows the whole line.
- **A program that still holds flame sensor blocks** (saved in a browser or in a file while
  the page was being built) opens without them: the blocks are taken out, the rest of the
  program stays, and two sentences at the bottom of the screen say so ("2 flame sensor blocks
  were taken out of this program, because the simulator has no flame sensor any more. Look at
  the places where they were: a slot there is empty now, or shows a number or a text that you
  did not choose."). Without this, Blockly would refuse the whole program. The code is
  `withoutRetiredBlocks` in `src/simulator/ui/program-file.ts`; the page with the flame sensor
  was never published, so it can go once nobody can hold such a program any more.
- **The level of a maze** is counted from its walls and its shortest way. It says nothing
  about how hard the maze is for one particular program.
- **Which number of walls is used in which round is not decided**, so the page offers both
  kinds side by side and says nothing about rounds.
- **Random mazes are competition mazes only.** The page no longer draws a random practice maze
  (4 to 16 walls); `randomScenario()` still makes them, for the tests.

## The Warehouse Sort simulator

The third game of the same simulator: **Warehouse Sort**, the beginner mission of the MakeX
Lebanon **Inspire** category ("Beginner — Warehouse Sort (MakeX Lebanon, Local)"). Four cubes
stand in four warehouses near the corners of the mat: three are red or green, one is **blue**.
The robot — the mBot2 of Fire Rescue, with its gripper and the colour sensor at the claw —
starts at the bottom of the mat facing up, checks each cube's colour, takes the red and green
ones to the bay of their colour (red bay right of the middle, green bay left of it), leaves the
blue one where it is, and parks on one of the two round finish pads (left and right). A match
lasts 90 seconds. It lives at:

```
https://www.makexlebanon.com/simulator/warehouse-sort
```

The mat is the print file `Capelli_Inspire_1235mm.pdf` (1235 × 1235 mm, black, with **white**
lines), **turned 90° to the right** (clockwise): the owner of the site decided that the robot
starts facing up, so the start zone, which the print file has on its right edge, is in the
middle of the bottom edge. Everything on the mat turned with it. The **blue cube** is the owner's
addition too: the written rules have red and green cubes only. The rules give no sizes and leave
several things open, and in two places they say something else than the printed mat; the
simulator follows the mat and says so. Its **Rules** window has the rules in short beginner
words, and a second part, "What this simulator assumes", for everything the simulator had to
choose. This is the beginner category: every
text on the screen is short and plain, and many students read English as a second language —
keep it that way.

Everything that is general works as in Fire Rescue and is described above: the blocks and
their saving, the ruler and the enlarged stage, the examples and their codes (one set of codes
for all games), the title row with "Powered by …", the header height.

### How the game is put together

| File | What is in it |
| --- | --- |
| `src/simulator/warehouse-sort/field.ts` | Every measure of the mat (from the vectors of the print file, turned), the colours, the cubes, and the vector drawing of the mat the sensors read in tests (`MAT_VECTOR`) |
| `src/simulator/warehouse-sort/sponsor-logo.ts` | The outlines of the sponsor's letters in the middle of the mat (the floor sensors see them) |
| `src/simulator/warehouse-sort/robot.ts` | The robot: Fire Rescue's mBot2, with its line sensor set for white lines on a black mat; where it starts |
| `src/simulator/warehouse-sort/scenario.ts` | An arrangement: the colour of the cube in each warehouse — one blue, the other three red or green (24 of them) — its short code, the random draw, the default |
| `src/simulator/warehouse-sort/game.ts` | The game and its referee, and at its top the questions for the organiser Q1 – Q15 — the same numbers as the list below — each with the constant behind it |
| `src/simulator/warehouse-sort/play.ts` | Play a program without a screen, on one or on all 24 arrangements (the tests use it) |
| `src/simulator/warehouse-sort/sample-catalog.ts`, `samples.ts` | The six examples. They stay on the server (see "Member codes" above) |
| `src/simulator/ui/warehouse-sort/` | What only this game shows: `WarehouseSortSimulator.tsx` (what the general screen is given), `ArrangementEditor.tsx` (the Cube colours panel) with `arrangement-panel.ts`, `arrangement-code.ts` (a typed code), `arrangement-batch.ts` (the lists and the ranking of "Test on many arrangements"), `rules.ts` (the Rules window) and `words.ts` (the screen's words) |
| `src/app/simulator/warehouse-sort/page.tsx` | The page: its address, title and description |
| `public/simulator/warehouse-sort/` | The two pictures of the mat: `mat.webp` (2500 px) is shown, `mat-sensor.webp` (1250 px) is what the line sensor reads |

The page is on the Simulator page, in the part "Season 2026". It is not a
category of a season in `content/seasons.ts`, so its card there comes from
`missionSimulators` in that file (see "The Simulator page" above): "MakeX Inspire ·
Beginner", "Local event". The rules give no age group, so none is shown. It is not the 2026
category Smart Logistics either: the organiser has not said that it is the same mission.

What the general screen got for this game — optional props that the other two games do not
pass, so their screens are as they were:

- **`batchRandomLists={false}`**: "Test on many arrangements" offers no random lists. There
  are only 24 arrangements; the window offers **All 24 arrangements** and **This
  arrangement**.
- **`batchTieBreak`**: with equal points the rules rank by the number of cubes in the right
  bay, then by the time of the last correct delivery. The test window ranks the runs that way
  ("Worst first", best and worst run) and shows a column **Last delivery** instead of "Time of
  the points".
- **`batchSummaryLabel`**: the score sheet names a cube with its colour ("Pick up cube W1
  (red)"), which changes from one arrangement to the next; the summary of the test window names
  the warehouse ("Pick up the cube of W1", counted over the runs in which that warehouse holds a
  red or green cube), calls the line of the blue cube "Blue cube moved", and leaves out the time
  for a tie.
- **`batchSummaryOrder`**: that summary lists the lines in the order of the score sheet, W1 to
  W4 in turn. (The summary takes the lines in the order it first meets them, and every run
  lacks the lines of the warehouse of its blue cube: the first run, BR-RG, has no W1 lines, so
  without this order "Pick up the cube of W1" came last, after the penalties.)
- On the stage a body of the kind `cube` is drawn as a solid block, and a zone can be round
  (`ZoneOverlay.shape: 'ellipse'`): the **Zones** view shows the finish pads as they are.
- **`stageMargin={TABLE_STRIP}`**: the stage shows the whole 100 mm strip of table around the
  mat (the other games show 45 mm), because here the robot and the cubes can leave the mat and
  stop only at the edge of the table. The mat is drawn a little smaller for that.
- **`titleWrapsOnPhone`** (also on the title row of the loader): "Warehouse Sort simulator" is
  longer than a 360 px phone has room for, so there it goes over two lines instead of being cut
  off. The other two titles fit and are cut off as before where they do not.
- Two words of its own for the **Console** (`words.ts`, `ScreenWords.grabbed` and
  `tableEdge`): closing the claw on a cube says "Gripped the W2 cube." — the referee counts
  "picked up" only once the cube is lifted 1 cm or carried 4 cm — and running into the end of
  the table says "Bumped into the edge of the table." (the other games keep "Picked up …" and
  "the table wall").
- Three **hover texts** of its own (`PALETTE_TOOLTIPS` in `src/simulator/blocks/palettes.ts`):
  "detects line" speaks of the white line, and "gripper opens/closes" and "object detected at
  claw" speak of a cube instead of Fire Rescue's bucket or person.

### The field (measured from the print file, turned)

All in mm, origin at the top-left corner of the mat **as the screen shows it** (turned), +y down.
Measured from the vectors of the print file turned 90° to the right (the PDF's "rotate right",
`/Rotate 90`; `pdftocairo -svg`, 1 pt = 1235 / 3500.79 mm); `field.test.ts` holds the turned print
file's own numbers, and the numbers of the print file as printed with the name each shape has
now. A point x, y of the field before the turn is at 1234.93 − y, x now (pdftocairo draws the page
at 3500.58 pt, 0.006 % smaller than the page: every number has always been measured on that
drawing). The two pictures of the mat are the same pictures, turned pixel for pixel and saved
without loss.

| What | Measure |
| --- | --- |
| Mat | 1235 × 1235, black (35, 31, 32) |
| White lines | 26.2 wide (a few 25.0 – 27.3); the long line up the middle at x 630.1, from the top line (y 134) down into the start zone (y 1004.5) |
| Yellow band along the edge | 17 – 20 wide, with a gap in the middle of the left and the right edge (y 483 – 763) |
| Warehouses W1 – W4 | thin yellow frames of 110 × 155 (W4: 107 × 155) near the corners, each with an orange square of 38 – 40 × 40 where a cube stands. The rules do not name them; the simulator numbers them like a page is read, on the field as the screen shows it: W1 top left, W2 top right, W3 bottom left, W4 bottom right (before the turn they had other numbers) |
| Red bay / green bay | 104.8 × 174.6, red at (734.9, 531.3) right of the middle, green at (419.6, 533.9) left of it |
| Finish pads | two round pictures, 157.1 × 160.2, centres (171.4, 620.1) on the left and (1090.5, 619.4) on the right |
| Start zone | the area inside the outer edge of the yellow frame at the bottom: x 491.7 – 755.1, y 970.2 – 1235 (263.5 × 264.8) |
| Robot | 237 × 130 with its claw open; it starts facing up on the long line at (630.1, 1151.1), 13.9 mm from the front and the back of the start zone, 73.4 on its left, 60.1 on its right |
| Cube (ASSUMPTION) | 40 × 40 × 40, light (the robot can push it). The blue cube is drawn in the blue of the MakeX mats (0, 174, 239) with a "B" |
| Table around the mat (ASSUMPTION) | 100 mm on every side, the engine's table of every game: the robot and the cubes can leave the mat and stop at its edge |

The **line sensor** of this robot is set for a **light line on a dark mat** (`lightLine`,
border at brightness 70): "line" means the white line, and the line blocks — line status,
deviation, "detects line" — work on the white lines. The real Quad RGB sensor learns this when
it is taught on the mat (press its button twice and sweep it over line and background); the
simulator's robot comes taught. No block was added for it.

### The referee

| Line | Points | When |
| --- | --- | --- |
| Leave the start zone | +5 | the first moment a part of the robot is outside the start zone (kept) — also over the bottom edge of the mat, where the zone ends (question 11) |
| Pick up a red or green cube (each) | +5 | the gripper holds it and lifts it at least 10 mm, or has moved it 40 mm while holding it; once per cube |
| A red or green cube in the bay of its colour (each) | +15 | at the end: the whole cube inside the bay, on the mat, not held, not touching the robot (closer than 0.5 mm, seen from above **and** in height: a raised claw above a cube does not touch it) |
| A red or green cube in the bay of the other colour (each) | −5 | the same conditions. "And no points for that cube": no +15, and that cube also loses its +5 for being picked up (question 10). A cube only partly in a bay counts neither way |
| The blue cube | 0 / −5 | ASSUMPTION (question 15): −5, once, when at the end the blue cube is not where it was put — it was picked up or lifted at any time (also when a restart put it back), the robot holds it, or it is more than 5 mm from its place (the largest distance of one of its corners, as Fire Chief measures its target). A touch that does not move it costs nothing. It never scores, and there is no "wrong bay" for it. The sheet says "Blue cube (W3): left alone 0" or "moved: …, −5", and a match in which it was moved does not end "every goal complete" (nor counts as such in the test window). A cube the claw held at a restart goes back to its square; if another cube stands there, the engine puts it as close as there is room, and more than 5 mm from its square counts as moved |
| Park on a finish pad | +10 | at the end the robot touches one of the two pads |
| Clean run | +5 | no restart was used |
| Restart (each) | −10 | the robot goes back to the start zone, the clock runs on; a cube in the gripper goes back to its warehouse (the blue one too), every other cube stays; points earned stay; no limit |

Highest score: 5 + 3 × 5 + 3 × 15 + 10 + 5 = **80**. The total is never below 0. The match
ends at 90 s, when the team presses "Finished", or when the program has ended and the robot
stands still; then the field is judged as it lies. The score sheet also shows the **time of the
last correct delivery** (tie-breaker 3 of the rules): the latest moment at which a cube that
counts at the end was put down in its bay. A cube completely off the mat scores nothing — also
not its pick-up points — and stays where it is; a cube the gripper still holds out over the
table is held, not off the mat. Cubes cannot stand on each other: the engine slides a cube that
is put down on another cube off it (as with Fire Rescue's buckets).

Not simulated: field damage (−20), the operator rules, the referee returning a cube that left
the mat (−5).

### The examples, as measured

Six examples, in `src/simulator/warehouse-sort/samples.ts`, written for the field as the screen
shows it (the robot faces up) and for the blue cube. Every example that takes a cube **looks
first**: it drives its open claw around the cube — the fingers are 12 mm from it on each side
and do not touch it — reads the colour sensor at the claw, and only then closes the claw. Blue:
it backs away and the cube stays exactly where it stood. None of them reads which way the robot
points; they move by "forward … cm" and "turn … degrees" only. Measured by `samples.test.ts` on
all 24 arrangements, on the vector mat and on the picture the browser reads (the same points
on both):

| Id | Level | What it does | Points | Ends at |
| --- | --- | --- | --- | --- |
| `sort-leave-start` | starter | drives 30 cm up, out of the start zone | 10 on all 24 | 1.85 s |
| `sort-white-line` | starter | follows the white line right of the start zone to its T-end and stops 6.2 mm short of the cube of W4 | 10 on all 24 | 3.17 s |
| `sort-cube-colour` | starter | drives at the cube of W3 until the claw sensor sees it, shows "Cube: red", "Cube: green" or "Cube: blue" and lights the LEDs in that colour; stops 7.0 mm short of the cube | 10 on all 24 | 3.27 s |
| `sort-one-cube` | intermediate | looks at the cube of W4; blue: leaves it and takes the cube of W3 instead; the cube goes to the bay of its colour | 30 on all 24 | 11.19 s (W4 not blue, 18 arrangements), 16.71 s (W4 blue, 6) |
| `sort-two-cubes` | intermediate | one cube from the bottom row (W4, or W3 where W4 is blue) and one from the top row (W2, or W1 where W2 is blue), each to the bay of its colour, then parks on the left pad | 60 on all 24 | 32.43 s (blue in W1 or W3), 37.83 s (W2), 37.95 s (W4) |
| `sort-all-cubes` | advanced | looks at all four cubes (W4, W2, W1, W3), leaves the blue one, sorts the other three, parks on the left pad | 80 on all 24 (the most there is) | 53.51 – 60.84 s; last delivery 41.58 – 54.40 s |

**The blue cube is never moved**: in all 144 matches (6 examples × 24 arrangements) it does not
move by a single step of the engine, the gripper never holds it, and the score sheet says "left
alone". The "Try …" of each description is tested too (the one-cube example with parking added
scores 40 on all 24; the advanced one in three other warehouse orders scores 80 on all 24 —
all 24 orders were measured once, in a scratch script: 80 in all 576 matches, 53.5 – 65.9 s).

They drive by distance: the simulated robot is perfect. With wheels that slip by up to 0.5 %,
1 % and 2 % (measured once, in a scratch script, 72 matches each), the advanced example kept its
80 points in 44 %, 25 % and 10 % of the matches, the two-cube example its 60 in 44 %, 25 % and
11 %, the one-cube example its 30 in 99 %, 89 % and 50 %; the starters never lost a point. A
robot that drifts can push the blue cube with its fingers: in 2, 8 and 13 of the 72 advanced
matches, 1, 3 and 7 of the two-cube ones, 0, 0 and 4 of the one-cube ones. The three starters
are open to everyone, the two intermediate ones need a member code, the advanced one is shown
to advanced codes only — the same rule as in the other games, in `content/simulator-codes.ts`.

### Questions for the organiser

Each one is answered in the simulator in the way given here, and listed at the top of
`src/simulator/warehouse-sort/game.ts` with the constant or function behind it — as Q1 – Q15,
with the same numbers as here. (Two things are not questions: the owner of the site decided
them. The field is turned 90° to the right, so the robot starts facing up; and one cube is blue
and must be left alone. The rules describe the mat as printed — "start zone on the right", "RED
rectangle (upper middle)" — and have no blue cube.)

1. **The start zone.** The rules call it "a large green area on the right"; the mat has a
   yellow-framed area with a blue picture there (the print file has a green rectangle hidden
   under that picture). The simulator uses the yellow-framed area. Does the yellow frame belong
   to the zone? The simulator says yes.
2. **The finish pads.** The rules call them "yellow circles with checkerboards"; the mat has two
   round pictures without a checkerboard, top and bottom centre of the print file (left and
   right on the turned field). The simulator uses those.
3. **Touching or entirely inside?** §5 says "park touching the circle", §8 "the robot's
   projection is entirely inside one circle". A pad is 160.2 × 157.1 mm; the mBot2 with its
   gripper is 237 × 130 mm (the smallest circle around it is about 270 mm), so it can never be
   entirely inside. The simulator scores **touching**.
4. **85 or 80?** §6 says "Example max = 85", but its own line items add up to
   5 + 4 × 5 + 4 × 15 + 10 + 5 = 100 for four cubes — and with the blue cube three cubes are
   sorted: 5 + 3 × 5 + 3 × 15 + 10 + 5 = 80. The simulator uses the line items (80).
5. **The clean run bonus** ("no human touch after GO"): taken as written, a robot that never
   moves gets it — and so a team has 5 points before the start. The simulator follows the
   rules as written.
6. **Cube size and weight** are not in the rules. The simulator uses a light 40 mm cube (it fits
   the orange squares and the gripper).
7. **"Visibly carried"**: how far? The simulator counts 40 mm moved while held (or a lift of
   10 mm, as the rules say).
8. **A restart** ("human touch"): are the points earned before it kept, and where does a cube
   the robot holds go? The simulator keeps the points and puts that cube back on its own
   warehouse; every other cube stays.
9. **A cube off the mat**: the rules let the referee return it to its warehouse for −5, or leave
   it there "(no score)". The simulator never returns it: the cube stays off the mat and scores
   nothing — not even its 5 points for being picked up. Is that right? (A cube the robot still
   holds out over the table is not off the mat.)
10. **A cube in the wrong bay**: "−5 (and no points for that cube)". The simulator takes the −5
    only for a cube completely inside the other bay, on the mat, not touching the robot (the
    conditions of a correct delivery), and reads "no points for that cube" as written: it also
    loses its 5 points for being picked up — the same reading as "no score" in question 9. A
    cube only partly inside the other bay costs nothing. Is that right? (The other reading, "no
    +15 only", would give a cube in the wrong bay 5 points more.)
11. **Leaving the start zone over the edge of the mat**: the zone runs to the edge of the mat
    (the bottom edge on the turned field), so a robot that drives backwards off the mat there
    has also "crossed the Start boundary" and gets the 5 points without driving into the field.
    Should only the frame's side towards the field count?
12. **The table around the mat**: what happens when the robot leaves the mat? The rules say only
    that teams may drive freely "as long as they stay on the mat". The simulator has no
    penalty; a table 100 mm wide around the mat stops the robot and the cubes.
13. **Can the total go below 0?** The simulator says no, as in Fire Rescue.
14. **The time of the last correct delivery** (tie-breaker 3): is it the moment the last cube
    that counts at the end was put down in its bay? That is what the simulator shows.
15. **What does touching or moving the blue cube cost?** The rules have no blue cube, so they
    do not say. The simulator: −5, once, when at the end the blue cube is not where it was put
    — the robot picked it up or lifted it at any time (also if a restart put it back), holds it
    at the end, or it is more than 5 mm from its place. A touch that does not move it costs
    nothing; a blue cube in a bay scores nothing and is no "wrong bay". One constant each:
    `BLUE_PENALTY` and `BLUE_MOVED_MM` in `game.ts`. Two edges of that answer: a cube that was
    only dragged in the claw (less than 40 mm, never lifted) and is put back on its square by a
    restart is "left alone" (the console says "back in its place"); but if another cube stands
    on its square at that restart, it is put down next to it and counts as moved when that is
    more than 5 mm away. Should the referee judge it from where the restart put it?

### What to change, and where

- **What the blue cube costs**: `BLUE_PENALTY` (5) and `BLUE_MOVED_MM` (5 mm) in `game.ts`;
  the Rules window and the score sheet's note take the numbers from there. Change the README's
  referee table and question 15 by hand.
- **A rule decided by the organiser**: the constant in `game.ts` (its list at the top says
  which), then the sentence in `src/simulator/ui/warehouse-sort/rules.ts` — its test
  (`rules.test.ts`) compares every number of the window with the constants and says which
  sentence to change. Move a sentence from "What this simulator assumes" into the rules part
  once it is decided.
- **The cube size or weight**: `CUBE_SIZE`, `CUBE_MASS` in `field.ts`. The examples are
  measured for a 40 mm cube: run `npm run test:sim` and look at `samples.test.ts`.
- **An example**: as in Fire Chief ("Adding an example" above), with an id that begins with
  `sort-`, in `src/simulator/warehouse-sort/`; then decide its group in
  `content/simulator-codes.ts` and change the same lines in
  `scripts/generate-simulator-codes.mjs`. Use only blocks of this game's palette.

### Known limits of Warehouse Sort

- **The rules leave much open** (the list above); every choice of the simulator is in the
  second part of its Rules window.
- **The robot is perfect** — no wheel slip, no sensor noise. The examples drive by distance and
  will drift on a real robot.
- **The pictures on the mat** (the pads, the start-zone art, the pictures in the bays) are read
  by the line sensor from the picture of the mat in the browser; the tests read a vector
  drawing in which each picture is one flat colour (see `MAT_VECTOR` in `field.ts`). Over the
  pads, the HOME hexagon and the picture in the green bay the sensor names that flat colour
  "white" — the name most of the real picture gets, not all of it (`PICTURE_COLORS`). Line or
  background agrees with the picture on 88 – 96 % of each picture.
- **The texts of the colour sensor blocks at the claw** are Fire Rescue's and have not been
  compared with real mBlock 5 for this robot.
- **Cubes do not stack.** A cube put down on top of another cube slides off it, and both move
  by about 2 cm in one step (engine behaviour, the same for Fire Rescue's buckets).
- **Closing the claw on a turned cube** straightens it in one step of the simulation (a cube at
  45° snaps to 90°): engine behaviour, the same for Fire Rescue's buckets.
- **The score shows 5 points before the start** (the clean run bonus, question 5).
- **Arrangement codes are letters only** ("GR-BR": R, G or B). Unlike Fire Rescue, a number is
  no code: the rows of the test window are numbered 1 – 24, and a row number must not name
  another arrangement.
- **One blue cube, always.** In the Cube colours panel, blue for another warehouse moves the
  blue cube there: the two cubes swap their colours, and a short sentence says which cube
  changed. Red or green for the blue cube is refused (there must be one), as is a change that
  leaves no red or no green cube.

---

## The Tri d’entrepôt simulator (Robot en fête 2027)

**Tri d’entrepôt** is the Warehouse Sort simulator **all in French**, the simulator of **Robot en
fête 2027** — a category of its own, outside every season. The organiser asked for it ("ajoute une
catégorie robot en fête qui sera la version française de warehouse sort") and decided: everything
in French, the blocks included ("tout, blocs compris"); exactly the same mission ("oui, exactement
la même"); no age group ("pas d'âge affiché"); a category on its own, "Robot en fête 2027", with its
own card and page, in French ("une catégorie seule", "à part, sa propre fiche", "fiche en
français"). Robot en fête 2027 names its French simulators by their mission: this one is « Tri
d’entrepôt »; a second one, « Logistique intelligente » (MakeX Inspire Smart Logistics), is to
come. It lives at:

```
https://www.makexlebanon.com/simulator/tri-entrepot
https://www.makexlebanon.com/robot-en-fete           (the category's page: what it is, and a button to each of its simulators)
```

The game inside keeps the id `robot-en-fete` (the work a student saves in the browser,
`mbot2-sim:robot-en-fete:*`, and the ids of the examples); its program files are named
`tri-entrepot-program-<day>.json`, and an English page that opens one says "This program was saved
in the Tri d’entrepôt simulator."

**It is the same mission as Warehouse Sort**: the same mat, the same four cubes and 24
arrangements, the same robot, points, clock and referee. A match gives the same points, the same
times and the same lines of the score sheet as the same match in Warehouse Sort — only the words
are French (`src/simulator/robot-en-fete/game.test.ts` plays every example on every arrangement in
both and compares them). Everything on its page is French: the buttons, the messages, the Rules
window, the score sheet, the console, "Tester sur plusieurs dispositions", the Cube colours panel
("Couleurs des cubes"), the six examples, the blocks ("avancer de … cm", "la pince s’ouvre") and
Blockly's own words ("Créer une variable", "Mes blocs"). The French speaks to the student with
"tu", and writes French numbers: `18,9 cm`, `1:23,4`, `0,5×`.

A few names are this game's own:

| English (Warehouse Sort) | French (Tri d’entrepôt) |
| --- | --- |
| warehouses W1 – W4 ("the W1 cube") | entrepôts E1 – E4 ("le cube E1") |
| codes with R, G, B: `GR-BR` | codes with R, V, B: `VR-BR` (a code with G is read too: `GR-BR` is the same arrangement) |
| arrangement, bay, finish pad, restart | disposition, baie, aire d'arrivée, relance |
| Starter, Intermediate, Advanced | Premiers pas, Intermédiaire, Avancé |

**What stays English.** The website around it: the header, the menu (its line in the Simulator
dropdown reads "Tri d’entrepôt — Robot en fête 2027": two French proper names in the English menu),
the footer, the breadcrumbs of `/robot-en-fete` (Home / Simulator / Robot en fête 2027) and the
share picture. And the **values a program gets**:
the colour sensor gives `red`, `green`, `blue`, … `none`, a condition is `true` or `false`, the
same on both pages, as we believe the robot gives them (not verified: question 1 below). The
screen shows them as the program holds them — in the Variables panel, on the CyberPi screen, in
a printed line ("Cube : red") — and where a sensor reading is shown, the Sensors panel adds the
French in brackets: `red (rouge)`. The block menus show French and store the English value
(`rouge` in the menu, `red` in the program).

### Where it is on the website

Its entry is **`content/standalone.ts`**, a list of the categories of their own: its name, its
robot, the lead of its page, the words of its page, and its `simulators` — today one, Tri
d’entrepôt, with its address, its sentences, the words of its card, its picture (the mat of
Warehouse Sort) and its line in the menu. Every text is in French but the menu line, and every one
is required, so nothing on a card or a page can fall back to English. A second simulator is one
more item of `simulators`: its card, its part of the category's page, its line in the menu and the
sitemap follow by themselves, with no change to any page. `content/seasons.ts`
does not know it: no season page, no count of categories, the homepage, the Training card and
the lists of Season 2026 and Season 2027 are exactly as they were. From that entry:

- **The Simulator page** shows, after the two seasons, a part of its own headed "Robot en fête
  2027", in French (`lang="fr"`), with one card per simulator, like the others: the mat, the
  labels "En français" and "mBot2", "Simulateur Tri d’entrepôt", its sentences, "Ouvrir le
  simulateur Tri d’entrepôt", and under it "À propos de Robot en fête 2027", the link to the
  category's page. The page's English description says it in one more sentence: "And Robot en
  fête 2027 (in French): Tri d’entrepôt, the French version of Warehouse Sort."
- **Its page `/robot-en-fete`** (`src/app/robot-en-fete/page.tsx`): its name, its lead, the robot
  ("mBot2", no age) and one part per simulator, "Essaie le simulateur Tri d’entrepôt" with the
  button "Ouvrir le simulateur". The French texts say `lang="fr"`; the breadcrumbs are English. It
  has no photos, no downloads and no other categories next to it: it belongs to no season.
- **The menu**: "Tri d’entrepôt — Robot en fête 2027", after the lines of the seasons
  (`simulatorMenu()` in `content/site.ts`).
- **The sitemap** has the category's page and the simulator's page.

The simulator's page itself, `src/app/simulator/tri-entrepot/page.tsx`, has a French title
("Simulateur mBot2 — Tri d’entrepôt (Robot en fête 2027)") and description; its title row reads
"Simulateur Tri d’entrepôt · mBot2". The page of the website stays
`<html lang="en">`; the simulator's screen and its loading screen say `lang="fr"`. There is no
`hreflang` link between it and Warehouse Sort's page (it would change the English page too).

### How the French is put together

| What | Where |
| --- | --- |
| The screen in French | `src/simulator/ui/robot-en-fete/RobotEnFeteSimulator.tsx`: the general screen given the French word table, `text={FR_TEXT}`, filled in as Warehouse Sort's (`WarehouseSortSimulator.tsx`) with the French game and its French words, rules, panel words, code reader and test lists (the other files of `src/simulator/ui/robot-en-fete/`; its name in `title.ts`). `RobotEnFeteLoader.tsx`: the loading screen, French already, with only the French words of the title row (`text/fr-title.tsx`) |
| The words of the screen | One word table per language: `src/simulator/ui/text/en.tsx` (English) and `fr.tsx` with its parts `fr-common`, `fr-screen`, `fr-title`, `fr-match`, `fr-panels`, `fr-console`, `fr-stage`, `fr-gripper` (French). `text={FR_TEXT}` sets the French table above the whole screen; a page that sets none — every English page — reads the English one, by the very same code as before |
| The game in French | `src/simulator/robot-en-fete/game.ts`: Warehouse Sort's game, made by the same function (`createWarehouseSortGame` in `src/simulator/warehouse-sort/game.ts`) with the French words of the referee (`referee-words.ts`) and the French names and codes (`scenario-words.ts`). Its id `robot-en-fete` names the work a student saves here and the examples; its program files are named after its simulator, `tri-entrepot-program-<day>.json` |
| The blocks in French | `src/simulator/blocks/fr.ts`: every block, menu and hover text of the palette, and our French for Blockly's own words (Blockly's French file comes with the `blockly` package). The blocks are the same blocks with the same stored values: a program file saved on one page opens on the other. The code of the blocks reads these words through `blocks/french.ts`, only on its French paths, and `fr.ts` hands them in when it is loaded — by the French table of the screen, so only the French page downloads them |
| The examples in French | `src/simulator/robot-en-fete/sample-catalog.ts` (titles, headings) and `samples.ts` (descriptions, notes, names, printed texts). They stay on the server, like every game's |

**A number typed into a block.** The French screen writes a decimal comma; in the French blocks a
number bubble takes a comma as the decimal point too: typing `18,9` gives 18.9. The bubble then
shows the number as Blockly does, with a point (`18.9`), as mBlock does. The white bubbles of
"mettre … à" and of `<`, `>` and `=` are bubbles of text, as in mBlock: there `30,5` stays a text,
which the program — as the robot — counts as no number. When Start is pressed, the console says
so for each such text (« 30,5 » est un texte dans cette bulle, pas un nombre … : écris 30.5, avec un
point); `src/simulator/ui/comma-texts.ts` finds them. The English screen says nothing.

**Blockly's own words.** Blockly writes some words itself, outside our tables. The French page
gives the shortcuts in its menus, toasts and screen-reader hints the French names of the keys
("Annuler   Ctrl + Z", "Alt + Maj + A"), puts `lang="fr"` on Blockly's question windows ("Nom de
la nouvelle variable"), and reads "menu : rouge", "Modifier nombre : 100" with a no-break space
(`src/simulator/blocks/locale.ts`, `register.ts`, `ui/BlocklyEditor.tsx`). What Blockly writes in
its own code stays as it is: the ", " between the parts of a block it reads out, and its
"%1 piles de blocs" (one form).

### The examples

The six examples of Warehouse Sort, in French: the same blocks, numbers and order, only their
texts are French. They score exactly what Warehouse Sort's do, on all 24 arrangements (measured by
`src/simulator/robot-en-fete/samples.test.ts`, tick by tick beside the English twin):

| Id | Level | Title | Points | Ends at |
| --- | --- | --- | --- | --- |
| `fete-leave-start` | starter | Sortir de la zone de départ et s’arrêter | 10 on all 24 | 1.85 s |
| `fete-white-line` | starter | Suivre la ligne blanche jusqu’au T | 10 on all 24 | 3.17 s |
| `fete-cube-colour` | starter | Lire la couleur d’un cube | 10 on all 24 | 3.27 s |
| `fete-one-cube` | intermediate | Mettre un cube dans sa baie | 30 on all 24 | 11.19 – 16.71 s |
| `fete-two-cubes` | intermediate | Deux cubes, puis se garer | 60 on all 24 | 32.43 – 37.95 s |
| `fete-all-cubes` | advanced | Trier les cubes et se garer | 80 on all 24 | 53.51 – 60.84 s |

The same member and advanced codes open them, by the same rule: three open to everyone, two for
members, one for advanced codes only. But they are examples of their own, with ids that begin with
`fete-`: in `content/simulator-codes.ts` a line about `'sort-one-cube'` decides nothing for
`'fete-one-cube'`. To open or to hide an example on both pages, write both ids (see "Member codes
for the simulator examples" above). An example changed in Warehouse Sort is not changed here by
itself: change its French twin in `samples.ts` too (`samples.test.ts` fails until both are the
same program).

### What to change, and where

| To change … | Edit … |
| --- | --- |
| a word of the screen (a button, a window, a message, the console) | `src/simulator/ui/text/fr-*.tsx` (the English of the same word is in `en.tsx`) |
| a word of the blocks, of their menus and hover texts, or of Blockly's own menus | `src/simulator/blocks/fr.ts` |
| a line of the score sheet or of the console about the referee | `src/simulator/robot-en-fete/referee-words.ts` |
| the names of the warehouses, colours and places, or the letters of the codes | `src/simulator/robot-en-fete/scenario-words.ts` |
| the Rules window | `src/simulator/ui/robot-en-fete/rules.ts` (`rules.test.ts` checks every number against the game and the English window) |
| the other words of this game (score sheet notes, hints), the Cube colours panel, the test lists, the messages about a typed code | `words.ts`, `arrangement-words.ts`, `arrangement-batch.ts`, `arrangement-code.ts` in `src/simulator/ui/robot-en-fete/` |
| an example | `src/simulator/robot-en-fete/samples.ts` and `sample-catalog.ts`; its group in `content/simulator-codes.ts` and the same lines in `scripts/generate-simulator-codes.mjs` |
| its card, its category's page, its menu line, a second simulator | `content/standalone.ts` |
| the title and description of the simulator's page | `src/app/simulator/tri-entrepot/page.tsx`; its name in the title row: `src/simulator/ui/robot-en-fete/title.ts` |
| a rule of the mission | in Warehouse Sort first (`src/simulator/warehouse-sort/game.ts`), then the sentences of both Rules windows: the two games share the referee |

Keep the French as it is written now: "tu" for the student, the infinitive on a button
("Démarrer", "Replacer"), a no-break space before `:` `;` `!` `?` and inside « », `’` as
the apostrophe, a decimal comma. The tests check each of these (`src/simulator/ui/text/text.test.ts`,
`src/simulator/blocks/fr.test.ts` and the tests next to each French file), that every text of the
shared screen goes through the word table (`src/simulator/ui/text/inventory.test.ts`), and that the
English pages did not change.

### Questions for the organiser

1. **Colour names on the robot.** On your mBot2 with mBlock 5 in French, does the colour block
   give `red` or `rouge` for a red cube? The simulator keeps `red` and shows `red (rouge)` on the
   Sensors panel. If it is `rouge`, the values of the program change: a change of its own.
2. **The block words.** Could somebody with mBlock 5 in French compare our block texts with
   mBlock's (`src/simulator/blocks/fr.ts`; mainly CyberPi, Châssis mBot2, capteur quad RGB,
   servos)? In particular: is the start block **"lorsque CyberPi démarre"** (our choice, from
   French mBot sheets) or "quand CyberPi démarre"? And "lorsque le bouton A est pressé", "bouton A
   pressé ?"?
3. **What stays English.** The site's menu, header, footer and breadcrumbs stay English; the menu
   line reads "Tri d’entrepôt — Robot en fête 2027". Warehouses E1 – E4 and codes with V for
   "vert": fine?
4. **Its page and its place.** Its own page at `/robot-en-fete`; on the Simulator page a part of
   its own after the seasons, headed "Robot en fête 2027"; not on the Training page's card. Is
   that what you want?
5. **Numbers.** The French screen writes `18,9 cm`; the number bubbles accept `18,9` and show
   `18.9`, as mBlock does. Fine?

### Known limits of Tri d’entrepôt

- **Everything of Warehouse Sort** ("Known limits of Warehouse Sort" above): it is the same game.
- **Our own French.** The words of the blocks, the screen and the examples are our own
  translation, written for children of 8 to 12 and their teachers; they have not been compared
  with mBlock 5 in French (question 2).
- **The number bubbles show a point** (`18.9`) while the sentences around them write a comma
  (question 5).
- **Blockly says "%1 piles de blocs"** for any number of stacks but one, also for none (one form
  in its own French file).
- **The values of a program are English** (`red`, `true`): question 1.
- **A text bubble keeps a comma** (`30,5` is no number there, as on the robot): the console says
  so at Start.
- **One French text is read with the site's English voice**: the website's own announcement of the
  page's title after a link inside the site (Next's route announcer, in `<body>`, which stays
  `lang="en"` with the whole site: design D8).
- **On a phone** the strip above the blocks takes two rows (English: one) and "Son activé" two
  lines: no shorter French says the same.
- **Blockly's own punctuation**: the ", " between the parts of a block that a screen reader hears
  is written by Blockly's code.

---

## The Locker Room simulator

The fourth game of the same simulator: **Locker Room**, the Season 2026 category **Capelli
Starter — Locker Room** (ages 13–15, mBot2). The robot is the team's helper on match day. It
starts in the **Locker Room** (bottom left) with the **Team Box** on it, drives to the **Scan
Station** (bottom right), where the referee holds up a **colour card** — RED or GREEN, the team
colour of the match — and then lifts the Team Box off the robot (the coach's approval). The
robot then takes the **cube of the team colour** from its pickup zone — a small square in the
middle of the maze — to the **big circle** of that colour, which opens the **stadium gate**, and
last it sorts the **three tokens** (RED, GREEN, BLUE) from the zones A, B and C into the
**warehouses** of their colours, the three targets at the top of the mat. A match lasts 150
seconds. It lives at:

```
https://www.makexlebanon.com/simulator/locker-room
```

**Which rules.** The simulator follows the organiser's **latest rules** ("Starter — Locker Room
Mission", 150 s, half points for a token that is only partly inside its target, the 4-second
pause cancelled), and **these are also the rules file you can download on the category page**
(`public/downloads/capelli-starter-locker-room-rules.pdf`, made from the organiser's Word file:
"Rules, scoresheets and other downloads" above says how). They replaced the older **v2.3**,
which still had the mandatory 4-second pause, no half points and no match time. Its old address
`/downloads/capelli-starter-locker-room-rules-v2.3.pdf` is a permanent redirect to the new file
(`next.config.mjs`); the v2.3 file itself is only in the git history
(`git show 35c7d37:public/downloads/capelli-starter-locker-room-rules-v2.3.pdf > v2.3.pdf`).
Where the pickup zones and the targets are, which neither version made clear, the organiser has
confirmed (question 1 below). **The file itself still says the targets are "inside the maze"**
(§2.6 and Step 7) and names no place for the pickup zones: it is the organiser's text and is
not changed here. So the category page says under the download what the organiser confirmed —
the `note` of that download in `content/seasons.ts` — until a corrected file comes (question 20).
The **Rules** window says in its first line which rules it follows and where to download them:
the sentence ends with a link to `/season/2026/locker-room` (`LOCKER_ROOM_RULES_LINK` in
`rules.ts`, the optional `rulesNoteLink` of the general screen; the other three games pass
none).

The mat is the print file `Capelli-Starter_1235mm.idml` (an InDesign file, one page of 1235 ×
1235 mm, black, with **white** lines). Its pictures (the Locker Room art, the coach badge, the
zone pictures, the blue disc, the logos) are linked files that are not in the IDML: their look
comes from the organiser's own render of the whole mat in the rules v2.3 (page 2; the newer
rules have no picture of the mat), cut out at the frames of the print file, and is therefore
soft. The rules give no sizes and leave several things open; every choice the simulator had to
make is in the second part of the Rules window, "What this simulator assumes", and in the
questions below. This category is for ages 13–15, and many students read English as a second
language: every text on the screen is short and plain — keep it that way.

Everything that is general works as in Fire Rescue and is described above: the blocks and their
saving, the ruler and the enlarged stage, the examples and their codes (one set of codes for all
games), the title row with "Powered by …", the header height. The block palette is the one of
Warehouse Sort (only blocks of real mBlock 5, plus the Gripper shortcuts).

### How the game is put together

| File | What is in it |
| --- | --- |
| `src/simulator/locker-room/field.ts` | Every measure of the mat (from the vectors of the print file), the colours, the cubes, the gate, the Team Box and the card, and the vector drawing of the mat the sensors read in tests (`MAT_VECTOR`). **`MARK_ROLES`**: the one table that says which marks are the pickup zones and which the targets |
| `src/simulator/locker-room/robot.ts` | The robot: the mBot2 of Warehouse Sort, part for part; where it starts |
| `src/simulator/locker-room/scenario.ts` | A draw: the Team Colour card (RED/GREEN) and the Zone Assignment card (option 1 – 6, numbered as in the rules §3.2) — 12 draws — the short code ("G5"), the random draw, the default |
| `src/simulator/locker-room/game.ts` | The game and its referee, the timings at the Scan Station, and at its top the open questions L1 – L11, each with the constant behind it |
| `src/simulator/locker-room/play.ts` | Play a program without a screen, on one or on all 12 draws (the tests use it) |
| `src/simulator/locker-room/sample-catalog.ts`, `samples.ts` | The six examples. They stay on the server (see "Member codes" above) |
| `src/simulator/ui/locker-room/` | What only this game shows: `LockerRoomSimulator.tsx` (what the general screen is given), `CardsEditor.tsx` (the Cards panel) with `cards-panel.ts`, `cards-code.ts` (a typed code), `cards-batch.ts` (the lists of "Test on many draws"), `rules.ts` (the Rules window) and `words.ts` (the screen's words) |
| `src/app/simulator/locker-room/page.tsx` | The page: its address, title and description |
| `public/simulator/locker-room/` | The two pictures of the mat: `mat.webp` (2500 px) is shown, `mat-sensor.webp` (1250 px) is what the line sensor reads |

The category has a `simulator` entry in `content/seasons.ts`, so the Simulator page shows it in
the part "Season 2026" (before Warehouse Sort, a mission and not a category), the season page
labels it "Online simulator", its category page has the "Try the … simulator" block, and the
Training page's card names it.

What the general screen got for this game — optional, and the other three games pass none of
it, so their screens are as they were:

- **`restartButton={false}`**: the match controls have **no Restart button**. The rules never
  name a restart — they only void a run when anyone but the referee touches the robot after GO
  (question 19) — and the Rules window says just that. The game itself allows none
  (`restartRules: { maxRestarts: 0 }`).
- **What the referee holds is drawn on the stage** (`World.props`, see below): the Team Box on
  top of the robot (drawn see-through, so that the CyberPi and its LEDs still show), and the
  colour card in front of the claw while the referee holds it, with its name ("GREEN card")
  beside it. A game without props draws nothing more.
- **A zone of another shape** (`ZoneOverlay.outline`): the **Zones** view draws the RED and the
  GREEN warehouse as the turned rectangles they are.
- **What the referee is doing right now** (`ScoreReport.now`): while the robot waits at the Scan
  Station, the status line above the stage says "The referee shows the GREEN card in front of
  the robot." (and the step before and after it) in place of the count of goals, so that a robot
  standing still for 4 s is explained without opening the score sheet or the console.
- The **Console** names the things of this game plainly: "Picked up the GREEN team cube.", "Put
  down the token of zone A on the mat.", "Bumped into the stadium gate." (`bodyName` in
  `src/simulator/ui/format.ts`; the names of the other games are unchanged.)
- As in Warehouse Sort: `stageMargin={TABLE_STRIP}` (the whole 100 mm table strip, the robot can
  leave the mat), `batchRandomLists={false}` (**All 12 draws** and **This draw**),
  `batchSummaryLabel` (the summary names "Step 5: the team colour cube in its circle" and "Step
  7: the RED token", without the colour or the zone of one draw), and `showLastPrint`.
- **`batchTieBreak`**: the rules rank by the better of two runs and say nothing about equal
  points. The test window does not invent a tie-breaker — equal points keep their order — and
  its column **Last step** shows when the last step with a time was done (Steps 1, 2, 3, 5, 6).
  The **Best run** and **Worst run** tiles say "last step at 0:28.0" (`BatchTieBreak.tileWords`),
  not "at 0:28.0": the tokens count at the end, so a plain "at" would read as the moment the
  points were reached. (Warehouse Sort passes no `tileWords` and keeps "at".)

What the engine got for this game (also optional: the three other games get no new field at
all, which `src/simulator/core/engine-referee-props.test.ts` checks; their examples, traces and
sensor readings were also compared before and after the change, once, in a scratch script): a
referee can take a wall off the field (`RefereeCall.removeWalls`:
the gate opens), a referee can hold things or put them on the robot (`Referee.props()`,
`World.props`, `RefereeProp`: nothing collides with them, the ultrasonic sensor does not see
them, the colour sensor at the claw reads one that has a colour), and a zone can have an outline.

The screen's word for one starting arrangement is a **draw** ("Test on many draws", "Random
draw", "Default draw"), and its panel is **Cards**: the Team Colour card (RED/GREEN), the six
zone cards by number (each shows its three colours), and the three zones as they lie on the mat
(C at the top, B, A at the bottom) with a colour each. A colour picked for a zone moves that
token there, and the token that was there takes its place — one sentence says which zone changed
too — so the panel never shows anything that is not one of the six cards. The code is the two
cards as the referee draws them: `G5` = team GREEN, option 5 (BLUE in A, RED in B, GREEN in C),
the default draw (not the first of anything). A code like `G7` or `Y2`, or a number alone, gets
one plain sentence.

### The field (measured from the print file)

All in mm, origin at the top-left corner of the mat, +y down. Measured from the vectors of the
IDML (1 pt = 1235 / 3500.787 mm); `field.test.ts` holds the print file's own numbers.

| What | Measure |
| --- | --- |
| Mat | 1235 × 1235, black (35, 31, 32) |
| White lines | 26.2 wide; the maze x 446.2 – 785.6, y 445.4 – 785.2; the long line on the left x 235.7 – 261.9, y 408.8 – 822.4, with two **yellow** pieces in it (y 507.6 – 566.3 and 665.1 – 723.7); the bottom line from the Locker Room to the Scan Station, centre y 1108.1 |
| Yellow band | 20 wide, gaps in the middle of the top (x 484.5 – 759.3) and the bottom edge (x 483.8 – 749.7) |
| Locker Room | its frame (yellow, 12 wide) included, to the edge of the mat: x 0 – 252.8, y 981.4 – 1235. Inside the frame alone there are only 236.0 mm |
| Scan Station | frame included: x 982.3 – 1235, y 983.0 – 1235 |
| Big circles | RED centre (1107.7, 505.3), r 103.5; GREEN centre (623.6, 933.2), r 104.8 |
| Warehouses at the top (the targets, `MARK_ROLES`) | three rectangles of 104.8 × 62.9: red at (130.8, 118.5) and green at (1102.5, 118.9), both turned 45°; light blue (the BLUE one) x 568.8 – 673.6, y 87.1 – 150.0, not turned. A 50 mm cube fits completely into a turned one only turned with it: straight, a cube of at most 44.4 mm would fit; centred, it may be 17.7° off |
| Pickup zones (`MARK_ROLES`) | in the maze: red square x 600.9 – 642.8, y 485.5 – 527.4 (**41.9 mm**: the 50 mm team cube stands on it centred, straight, over its edges); green square the same x, y 702.3 – 744.2 |
| Zones A, B, C | the part of each picture that shows, 56.0 × 57.7: A (the lowest) y 747.5, B y 582.2, C (the top) y 429.1; x 102.8 (C 105.6) |
| Blue disc (a picture) | centre (618.4, 615.1), r 68.1, between the two squares — no role |
| Gate mark | dotted rectangle x 430.5 – 488.1, y 829.0 – 915.6 |
| Gate (ASSUMPTION) | a wall with that footprint, 60 high, until it opens |
| Cube (MEASURED, from the published STL) | **50 × 50 × 70** (not Warehouse Sort's 40 mm assumption); light |
| Team Box (ASSUMPTION) | 90 × 110 × 80 on top of the chassis; not part of the robot's footprint; no sensor sees it |
| Card (ASSUMPTION) | 60 wide, 100 high, 2 thick, held upright with its face 5 mm beyond the claw tips: the colour sensor at the claw reads it, with the arm down or up |
| Robot | 237 × 130 with its claw open; it starts facing right on the bottom line at (77.9, 1108.1), 7.9 mm from the back and the front of the Locker Room, 61.8 and 61.9 on its sides |
| Table around the mat (ASSUMPTION) | 100 mm on every side, as in Warehouse Sort |

The two small orange squares of the print file (in the top-left corner of the Locker Room and
the top-right corner of the Scan Station) lie **under** the Locker Room picture and the Scan
Station's glow and do not show on the organiser's render; the simulator does not draw them. The
line sensor is set for white lines on black as in Warehouse Sort: white reads as line, the
yellow pieces read as line and as "yellow", everything else (red, green, light blue, the
pictures) as background.

### The referee

| Line | Points | When |
| --- | --- | --- |
| Step 1: leave the Locker Room | +5 | the first moment the **whole** robot is outside the Locker Room (frame included) with the Team Box on it; kept |
| Step 2: reach the Scan Station | +10 | the first moment the whole robot is inside the Scan Station (frame included) with the Team Box on it; kept |
| Step 3: coach approval | +15 | the robot stands still (no wheel turns) completely inside the Scan Station with the Team Box: the referee shows the card of the team colour **0.5 s** later, takes it away at **2.5 s**, and lifts the Team Box at **4.0 s** (`CARD_SHOW_S`, `CARD_AWAY_S`, `BOX_LIFT_S`). If the robot moves before that, the card goes away, the box stays on, and it all starts again at the next stop in the station. The score sheet's line says live what the referee is doing. **The referee does not check that the program read the card**: the simulator cannot see what a program reads, so a robot that only stands there for 4 s gets the +15 too (the rules: "the robot scans the color card"; question 16). The Rules window says so |
| Step 5: deliver the team-colour cube | +20 / −10 | the **first** moment a team cube stands on the mat, released, not touching the robot, completely inside one of the big circles decides it once: the team-colour cube in the circle of that colour +20, anything else −10 — also the cube of the **other** colour in **its own** circle (the rules say only "Wrong color circle"; question 18). Later deliveries change nothing. The card does not have to be read first. (Both team cubes delivered on the same 1/100 s: the team colour's cube is looked at first) |
| Step 6: stadium gate bonus | +5 | with a correct Step 5; the gate is taken off the field at that moment |
| Touching the gate | −10 | the robot touches the closed gate — once per match; a cube pushed against it is not the robot |
| Step 7: each token | +10 / +5 / −10 | at the end, for a token on the mat, not held, not touching the robot: completely inside the warehouse of its colour +10, partly inside +5, otherwise (not on its own warehouse at all) at least partly inside a warehouse of another colour −10. Every warehouse holds a whole 50 mm cube, when the cube stands almost like the warehouse: in the middle it may be turned up to 17.7° off it (`turnRoom` in `game.ts`; the Rules window says "about 17 degrees"), so a token in the turned RED and GREEN ones must be turned with them (the claw holds a cube square to the robot, so the robot puts it down facing along the tree's turned lines). A token that is only partly inside because of its turn gets a line that says so. (On a target too small for a whole cube — none now — +5 would count as done: `cubeFitsInside` in `game.ts`) |

**The closed gate does not keep the robot out of the maze** (question 17): it is a block on the
floor that the robot can drive around (the maze has no walls), and the tokens count whether the
gate is open or not. The latest rules give Step 7 no condition on the gate; their story sorts
the tokens "once the gate is open", and the older v2.3 said "Only then may the robot enter the
maze area".

Highest score: 5 + 10 + 15 + 20 + 5 + 3 × 10 = **85**, and a robot can reach it:
`integration.test.ts` plays a program of real blocks that scores all 85 on the draws G5 and R5
(in 56.5 and 66.1 s). The Rules window works the reachable score out from the marks. The
total is never below 0. The match ends at 150 s, with
"Finished" (the referee's "STOP"), or when the program has ended and the robot stands still —
so **a program must keep running while it waits at the Scan Station**, or the match ends before
the box is lifted. A token in a big circle, or a team cube in a warehouse, counts for nothing.
Not simulated: a voided run, field damage, the two runs of the ranking.

### The examples, as measured

Six examples in `src/simulator/locker-room/samples.ts`, measured by `samples.test.ts` on all 12
draws, on the vector mat and on the picture the browser reads (the same points on both), and
again with the robot moved 5 mm and 1 cm up and down in the Locker Room before Start (the same
points). The three that carry cubes stop once on their way at a white line that crosses it (the
my-block "forward to a white line", at 20 RPM). Every such stop is driven facing up the mat, so
it tells the robot **how far up it is, and no more**: it makes up for a start moved up or down,
not for one that is turned or moved to the left or right (the numbers are below the table). The
team cubes stand on the small squares in the maze and the tokens go into the warehouses at the
top (question 1).

| Id | Level | What it does | Points | Ends at |
| --- | --- | --- | --- | --- |
| `locker-to-station` | starter | drives 98.2 cm and stops inside the Scan Station (the program ends before the box can be lifted) | 15 on all 12 | 5.92 s |
| `locker-follow-line` | starter | follows the white bottom line until a probe sees the station's yellow frame, then 16.4 cm more | 15 on all 12 | 7.01 s |
| `locker-read-card` | starter | stops in the station, waits for the card, shows "Team: red/green" on the screen and the LEDs, waits until the box is lifted | 30 on all 12 | 10.42 s |
| `locker-team-cube` | intermediate | the card, then the cube of the colour it read from its square into the big circle of that colour (the gate opens). GREEN: back along the bottom line, up to the white line at the bottom of the maze (the claw is then around the cube), back down into the circle. RED: up to the short white line right of the maze, on to the cube's height, left to the cube, a half turn, into the circle | 55 on all 12 | RED 24.15 s, GREEN 19.18 s |
| `locker-two-tokens` | intermediate | up "the road" (x 340 mm, not printed) to the white line next to zone A; takes the tokens of zones A and B, reads each one's colour and puts it completely into the warehouse of that colour (into the turned RED and GREEN ones along the white diagonal lines, so the token is turned with them); it never opens the gate, and its text says the tokens count all the same here (question 17) | 25 on all 12 | 26.40 s (RED and BLUE in A and B), 30.16 s (RED and GREEN), 34.26 s (GREEN and BLUE) |
| `locker-whole-mission` | advanced | the card, the team cube, then zones A, B and C into their warehouses | **85 on all 12** (every point there is) | RED 63.69 s, GREEN 58.71 s |

On the default draw G5: 15, 15, 30, 55, 25 and 85 points. The "Try"s, measured too: a shorter
drive in the first starter (97.5 cm still earns the station, 97.4 cm not); the robot moved 1 cm up
or down before the line follower starts (15 on all 12 draws); a 1 s wait in the card starter (15:
the box is not lifted yet); the two ways of the team cube swapped (20 on all 12: a wrong delivery,
−10, the gate stays closed); zone C too in the token example (35 on all 12, 40.78 s — the text
gives the 45.79 cm of zone C, because the zones are not evenly spaced: the same step again from
the two numbers in the blocks, 44.57, misses the token and scores 25); the zones in
the order C, B, A in the advanced one (85 on all 12, but slower on all 12: 64.27 s RED, 62.51 s
GREEN — after every token the robot goes up to the top, so zone A is best taken first). The line
follower's try used to be "wait 5 seconds at the end", which earns the +15 of Step 3 without
reading the card — that taught that Step 3 needs no scan (question 16); reading the card is the
next example.

No example ever pushes a cube, touches the gate or makes a wrong delivery: the closing claw moves a
cube by 0.32 mm at most, to the middle of its fingers. The numbers that follow a white-line stop,
and the heights of the zones, have two decimals: they are measured so that the claw closes within
0.75 mm of the middle of each cube on the drawing and on the picture (the sensor sees a line one
tick of the simulation sooner or later, and the picture's line edges lie about 0.5 mm off the
drawing's).

**A start that is turned, or moved to the left or right, is not made up for** — the three that
carry cubes drive by distance, and the stop at a white line only tells them how far up they are.
Tried in steps of 0.1° and 0.5 mm, on the vector mat and on the picture the browser reads, each
keeps its points on all 12 draws only for a start

| Example | turned by | moved (along the bottom line) by |
| --- | --- | --- |
| `locker-team-cube` | 1.2° to the left … 1.1° to the right | anything that stays inside the Locker Room (7.5 mm each way) |
| `locker-two-tokens` | 0.6° to the left … 0.4° to the right | 4 mm to the left … 3 mm to the right |
| `locker-whole-mission` | 0.2° to the left … 0.3° to the right (on the picture: 0.2°) | 2.5 mm to the left … 3 mm to the right (on the picture: 2.5 mm) |

and one step further at least one draw scores less. The two mats give the same ends but for the
advanced example, which on the picture — what a student's browser plays on — holds one step less
far to the right. The screen turns the robot in steps of 1° and moves it in steps of 5 mm (1 mm
with Shift): turned 1° to the right, the advanced example scores 55 on the RED draws and 75 to 80
on the GREEN ones (on the picture 75 on all six; a browser showed 75 on the default draw); moved
5 mm to the right, 80 on all 12. No text of an example promises otherwise: the note on "forward to
a white line" says "This does not help if it started turned, or too far left or right", and
`samples.test.ts` holds both the numbers (on both mats) and the wording. On a real robot all of
them will drift.

The three starters are open to everyone, the two intermediate ones need a member code, the
advanced one is shown to advanced codes only (`content/simulator-codes.ts`).

### Questions for the organiser

Each one is answered in the simulator in the way given here (the list L1 – L11 at the top of
`src/simulator/locker-room/game.ts` names the constant behind each).

The website's own photos of the 2026 competition day (`public/gallery/2026/locker-room/`, shown
on `/season/2026/locker-room`) bear on several of them; they are cited below. We could not tell
from the photos whether they show a field before a match or after one, so they settle nothing on
their own:

1. **Which marks are the pickup zones, and which are the targets? — Decided by the organiser.**
   (L1, `MARK_ROLES` in `field.ts`.) The organiser wrote: "red and green that robot should place
   in the circles should be placed in the squares in center, the warehouses are on the top of
   the map". So the team cubes start on the small red and green squares in the maze, and the
   tokens go to the three rectangles at the top — the "warehouses": RED at the top left, BLUE
   (light blue) in the middle, GREEN at the top right; the blue disc is a picture with no role.
   It agrees with the latest rules ("3 colored target rectangles: RED, GREEN, and BLUE", though
   they say "inside the maze"), with the sizes (the three rectangles are 104.8 × 62.9 mm and hold
   the 50 mm cube; a 41.9 mm square cannot) and with the photo `event-025.webp` (a red cube on
   the small red square early in a match). It was asked because v2.3 said both "RED pickup zone
   (top-left)" and "the cube located in the center zone on the matching RED or GREEN square". The
   table can still be changed in `MARK_ROLES`; `game.test.ts` plays the earlier reading with it.
2. **The two orange squares** in the corners of the Locker Room and the Scan Station: the print
   file hides them under pictures. Are they printed? Is it where the Team Box stands?
3. **The light-blue rectangle** at the top: what is it for? — Answered with question 1: it is the
   BLUE warehouse.
4. **The two yellow pieces** in the long line on the left: do they have a role?
5. **The timings at the Scan Station** (L3): when does the referee show the card, take it away
   and lift the Team Box? The simulator: 0.5 s, 2.5 s and 4.0 s after the robot came to rest.
6. **Must the robot scan the card before it delivers?** The simulator does not require it.
7. **The card** (L4): the rules say "a color cube" and "the card". Where is it held? Does the
   ultrasonic sensor see it? The simulator: a card held just in front of the claw, seen by the
   colour sensor at the claw only. The photo `event-008.webp` shows a green cube standing just in
   front of a robot in the Scan Station — a cube, not a card held up.
8. **Touching the gate** (L7): every touch −10, or once per match? The simulator: once.
9. **A token partly inside a target of another colour** (L8): −10? The simulator says yes.
10. **The cube**: is the published "Inspire + Starter" cube (50 × 50 × 70) the one of this
    category? (Warehouse Sort assumes 40 mm.)
11. **The Team Box**: its size (the simulator: 90 × 110 × 80 on top of the robot, drawn
    orange). Does it count for the robot's size at the start? The photo `event-025.webp` shows a
    light-blue box with a handle on a robot.
12. **"Drives out" and "reaches"** (L2): the whole robot? The simulator says yes. Does the
    yellow frame belong to the zones? Without it the 237 mm robot does not fit inside the Locker
    Room facing straight (236 mm inside the frame). On a real field the Locker Room runs to the
    edge of the mat: could a robot leave it backwards over the edge? (Not in the simulator: its
    100 mm table stops the robot first — the robot is at least 130 mm across.)
13. **The table around the mat** and **the gate's size**: the simulator has a 100 mm table and a
    60 mm high gate on its dotted rectangle. The photos (`event-008.webp`, `event-021.webp`,
    `event-025.webp`) show tables with a raised rim right at the edge of the mat, and the gate as
    a yellow block with an arm, on the dotted rectangle.
14. **Can the total go below 0?** The simulator says no, as in the other games.
15. **The first delivery decides Step 5** (L5), and a token in a big circle or a team cube in a
    warehouse counts for nothing (L6): is that right?
16. **How does the referee know that the robot scanned the card?** (L3.) The rules: "At the Scan
    Station, the robot scans the color card. The referee removes the card. The referee lifts the
    Team Box … +15" and "After scanning, the referee removes the cube and lifts the Team Box"
    (§2.2). The simulator cannot see what a program reads, so its referee lifts the box 4.0 s
    after the robot stopped, read or not: a program that only drives into the station and waits
    gets the +15 (30 points on all 12 draws). The Rules window says this. Must the robot show
    what it read (a screen, the LEDs)? Giving the +15 only when the program read the colour sensor
    while the card was out would be a change of the referee, not made without an answer.
17. **May the robot sort the tokens while the gate is closed, and do they count?** (L11.) The
    latest rules: "Once the gate is open, the robot finishes by sorting the rest of the equipment
    inside the maze" (§1), the gate is "near the entrance to the maze" (§2.4), and "If Step 5 was
    wrong or skipped, the gate stays closed" (Step 6) — but Step 7 has no condition on the gate.
    v2.3, Phase 4: "If correct delivery was made, the referee declares the gate open. Only then
    may the robot enter the maze area." With the decided layout the team cubes stand in the maze,
    so a robot goes in before the gate can open, and the tokens go to the warehouses at the top,
    outside it. The simulator: the tokens count whether the gate is open or not, and the closed
    gate is a block the robot can drive around. The intermediate example "Sort two tokens" never
    opens the gate (its text says so).
18. **The cube of the other colour in its own circle** (L5): the rules say "Wrong color circle:
    −10". Team GREEN puts the RED cube into the RED circle: −10 (the simulator), or "not
    delivered", 0? The simulator gives −10 and the gate stays closed; the Rules window says so.
19. **Restarts.** The rules never name one: they only void a run when "anyone except the referee
    touches the robot or the field after GO" (§8.3). May a team restart a run, and what would it
    cost? The simulator has no Restart button, and the Rules window says "The rules say nothing
    about restarts" — not "There are no restarts", which would be a rule of our own making.
20. **The rules file and the confirmed layout.** The file still says "Inside the maze, there are
    3 colored target rectangles" (§2.6) and "delivers it to the matching color target inside the
    maze" (Step 7), and it does not say where the pickup zones are. The organiser confirmed the
    places by message (question 1). Can the organiser send a corrected file? Until then the
    category page says the confirmed places under the download (the `note` in
    `content/seasons.ts`); take the note away when the file says it itself.
21. **Who draws the two cards?** The rules: "Two random cards are drawn", and the setup steps
    "Draw the Team Color card", "Draw the Zone Assignment card" — by the referee, or by the team?
    The Rules window says "Two cards are drawn" and no more.
22. **How closely is "completely inside" a warehouse judged?** (L1.) The rules: +10 "completely
    inside", half points "if PARTIALLY inside". The simulator measures: every corner of the 50 mm
    token inside the printed 104.8 × 62.9 mm rectangle. That leaves 6.4 mm to each side across
    the warehouse, and a token in its middle may be turned up to 17.7° off the warehouse — so in
    the turned RED and GREEN ones a token that stands straight on the mat gets +5 only. Will a
    referee judge it like that, by eye? The Rules window says it under "What this simulator
    assumes" ("turned almost the same way … about 17 degrees off, not more"), not as a rule.

### What to change, and where

- **The pickup zones and the targets** (question 1, decided): `MARK_ROLES` in `field.ts`, now
  `pickup: { red: 'redSquare', green: 'greenSquare' }` and
  `target: { red: 'redDiamond', green: 'greenDiamond', blue: 'cyanRect' }`. The cubes, the
  referee, the Zones view, the score sheet and the Rules window follow it by themselves (the
  highest reachable score, which targets are turned, and the mark with no role are worked out).
  The examples drive by distance to the marks: `samples.test.ts` fails first and names the
  numbers in `samples.ts` to change. The numbers after a white-line stop are measured (the
  comment at the top of `samples.ts` says how): measure them again when a line, the picture or
  the robot changes.
- **The timings at the Scan Station**: `CARD_SHOW_S`, `CARD_AWAY_S`, `BOX_LIFT_S` in `game.ts`;
  the Rules window takes them from there. The examples wait 2 s after the card is gone — check
  `samples.test.ts`.
- **A rule decided by the organiser**: the constant in `game.ts` (its list at the top says
  which), then the sentence in `src/simulator/ui/locker-room/rules.ts` — its test compares every
  number of the window with the constants. Move a sentence from "What this simulator assumes"
  into the rules part once it is decided.
- **The cube, the gate, the Team Box, the card**: `CUBE_SIZE`, `CUBE_HEIGHT`, `CUBE_MASS`,
  `GATE_HEIGHT`, `TEAM_BOX`, `CARD` in `field.ts`.
- **An example**: as in Fire Chief ("Adding an example" above), with an id that begins with
  `locker-`, in `src/simulator/locker-room/`; then decide its group in
  `content/simulator-codes.ts` and change the same lines in
  `scripts/generate-simulator-codes.mjs`. Do not write the title of an example, or a sentence of
  its description, anywhere else: the guard (`client-guard.test.ts`) fails. Note that the word
  "Starter" is the name of a level of the examples, so the simulator's own files that a browser
  gets cannot say "Capelli Starter" (the page says "Locker Room" and "Capelli").

### Known limits of Locker Room

- **The rules leave much open** (the list above); every choice is in the second part of the
  Rules window.
- **The pictures on the mat are soft**: the print file links them, and the only source is the
  organiser's render in the rules v2.3 (0.49 px per mm). The line sensor reads them from the
  picture in the browser; the tests read the vector drawing, in which a picture is one flat
  colour.
- **The robot is perfect** — no wheel slip, no sensor noise. The intermediate and advanced
  examples drive by distance and will drift on a real robot; their one stop at a white line
  makes up for a start moved up or down, not for one that is turned or moved to the left or
  right — the advanced example loses points from 0.3° or 3 mm ("The examples, as measured").
- **The Team Box hides part of the robot on the stage** (it is drawn see-through on top).
- **No restarts, no voided run**: touching the robot is not simulated, so neither is a run that
  counts 0. The CyberPi buttons work during a match; at the competition nobody may steer the
  robot.
- **The two runs of the ranking** are not simulated: the test window can play all 12 draws.
- **The gate is perfectly smooth** (engine behaviour, as every wall of the simulator): a robot that
  turns right beside it is pushed away along it instead of catching on it (about 15 cm in under a
  second, measured), and a cube put down on top of the gate — carried there with the arm up — is
  moved off it, possibly to the other side, in one step. Nothing goes through it.
- **Cubes do not stack.** A cube put down on top of another cube slides off it, and both move by
  up to about 3 cm in one step (engine behaviour, as in Warehouse Sort).
- **Closing the claw on a turned cube** straightens it (a cube at 45° ends square to the claw):
  engine behaviour, as in Warehouse Sort. The team cubes stand straight on their squares; a
  token for the turned RED or GREEN warehouse must be put down turned with it (45°, give or take
  17.7°), so the robot faces along the tree's turned lines when it lets go.
- **The referee does not check the scan** (question 16) and **the closed gate does not keep the
  robot out of the maze** (question 17): both are said in the Rules window.

---

## The Fire Cadet simulator

The fifth simulator of the site, and the first for another robot: the Makeblock **mTiny**, for the
Season 2027 category **Fire Cadet – Rescue City** (ages 4–7). The robot is the rescue robot of
Fire City. It starts in the **Fire Station** at the bottom of a 7 × 7 map and pushes four rescue
items to their places — the **Water** to the Fire (at the School, the Factory, the House or the
Bakery), the **Cat** to the Safe Zone, the **Injured Person** to the Hospital and the **Emergency
Equipment** back to the Fire Station — round three obstacles, and parks in the Fire Station again
for the return bonus. There are two ways to play, as in the rules: **Junior** (ages 6–7) lays a row
of mTiny coding cards and presses the round GO button; **Mini** (ages 4–5) drives the robot tap by
tap with the four arrow cards of a direction panel. A match lasts 120 seconds. It lives at:

```
https://www.makexlebanon.com/simulator/fire-cadet
```

**Which rules.** The organiser's rules "Fire Cadet – Rescue City" (version 1, a Word file) and the
organiser's answers of 19 November 2026: the robot starts and ends in the Fire Station at the
bottom, the Fire can be at four places, the robot gets two sticks at its front to push an item,
and every item stands on a 4 cm base for now. The Word file is **not** published on the site (it
carries a personal name in its metadata), so the category has no download (`content/seasons.ts`
has no `downloads` for it); the **Rules** window tells the rules in short. The season's sentence
"missions, fields and rules will be revealed soon" stays as it is (question 20). The map is the
organiser's print file "Robo-Ville mTiny National 2027" (1250 mm); the PDF is not published
either (a personal name in its metadata). The picture on the stage is made from it.

**The obstacles: decided by the lead engineer (D1 and D5).** The rules say "If the robot touches
an obstacle: −1 point. If an obstacle is moved, the referee returns it to its original position
while the match timer continues." So in this simulator **as soon as anything touches an obstacle**
— the robot, or an item the robot pushes against it — **the referee lifts it off the map at once**,
and puts it back on its own square, unturned, as soon as nothing is nearer to its base than 5 mm.
**An obstacle costs 1 point the first time it is touched, by the robot or by an item the robot
pushes**: once for each obstacle, whoever touched it, so 3 at most, and the total never goes below
0. The rules also say "The robot must not push an obstacle away to open the road": pushing an item
into an obstacle is the robot pushing it away, so it costs the same point, and the referee says
"The Cat touched the Road Closed sign: -1. On the real map, go round it." So the robot never gets
stuck on an obstacle and is never pushed off the squares by one: it goes on with its row from
where it is, on the squares. (The design had fixed blocks instead, with the robot stuck 7.7 cm off
the squares for the rest of the match after a single hit; that cost a child far more than the 1
point of the rules. With D1 alone an item's touch cost nothing, and a row that pushed items
through the obstacles of maps 4, 5 and 8 scored all 25 points sooner than the way round; D5 gave
the item's touch its point. Question 3 asks the organiser.)

This category is for children of 4 to 7 who mostly cannot read yet, and their teachers. Every
control a child uses is a picture of at least 48 × 48 px, and every sentence on the screen is
short and plain — keep it that way. Many teachers read English as a second language.

**It does not use the general screen.** There are no blocks, no block palette, no Open / Save
of program files, no sensors, no console and no "Test on many". The screen is its own
(`src/simulator/ui/fire-cadet/`); what it shares with the other games is the engine, the stage,
the run loop, the score sheet, the windows and the examples with their codes (one set of codes
for all games: "Member codes for the simulator examples" above).

### How the game is put together

| File | What is in it |
| --- | --- |
| `src/simulator/fire-cadet/numbers.ts` | **The one table of numbers**, `FIRE_CADET`: the map, the times of a card, the sizes of the robot, its sticks, the items and the obstacles, the points. Every value says where it comes from (RULE, ORGANISER, MEASURED, SPEC, ASSUMPTION). No other file writes one of these numbers again, not in a sentence either |
| `src/simulator/fire-cadet/field.ts` | The map as measured from the print file: the eight marked places, the four squares of the Water / Equipment Area, the thirteen road squares, the drawn stand-in of the mat (`MAT_VECTOR`) |
| `src/simulator/fire-cadet/scenario.ts` | A **map** (one combination): where the Fire is, where the four items and the three obstacles start; the eight practice maps (`PRACTICE_MAPS`); the short code ("P3", "S-A6-D5-C5-C7-E3-F5-F7"); the rules of an own map and their sentences |
| `src/simulator/fire-cadet/robot.ts` | The mTiny with its two sticks (`MTINY_ROBOT`), and where it starts |
| `src/simulator/fire-cadet/cards.ts` | The two interpreters: a row of cards (Junior) and the direction panel (Mini); the rules of a row; the time of a row |
| `src/simulator/fire-cadet/game.ts` | The game and its referee: the score sheet, the obstacles (D1, D5), every sentence of the referee |
| `src/simulator/fire-cadet/solver.ts` | Finds the shortest row for all 25 points on a map. The own-map editor uses it (it says only "found" and the time, never the row), and the tests prove the practice maps with it |
| `src/simulator/fire-cadet/play.ts` | Play a row without a screen, on one map or on all eight (the tests use it) |
| `src/simulator/fire-cadet/test-helpers.ts` | For the tests only: random own maps, a whole match watched tick by tick |
| `src/simulator/fire-cadet/sample-catalog.ts`, `samples.ts` | The six examples. They stay on the server (see "Member codes" above). `samples.ts` writes each row as a plain object: there is no block builder for cards |
| `src/simulator/ui/fire-cadet/` | The screen: `FireCadetSimulator.tsx` (the whole screen), `FireCadetLoader.tsx`, `MatchBar.tsx` (the mode switch, the clock, the points, the speed), `GoButton.tsx` (the round GO / STOP / AGAIN button), `CardRow.tsx` with `card-row.ts` (the row and the card box), `CodingCard.tsx` (our drawings of the cards), `DirectionPanel.tsx`, `MapPicker.tsx`, `MapEditor.tsx` with `map-editor.ts` ("My own map"), `map-code.ts` (codes and what the browser remembers), `ScoreStrip.tsx` (the score in pictures), `Banner.tsx` with `banner.ts` (the one sentence under the map), `PlanningClock.tsx` with `planning-clock.ts`, `RulesWindow.tsx` with `rules.ts`, `paint.ts` (what the stage draws), `pictures.tsx` (the small pictures), `words.ts` (every word of the screen), `fire-cadet.css` |
| `src/app/simulator/fire-cadet/page.tsx` | The page: its address, title and description |
| `public/simulator/fire-cadet/mat.webp` | The picture of the map (2500 px, 2 px per mm). There is no `mat-sensor.webp`: the mTiny has no floor sensor here |

The category has a `simulator` entry in `content/seasons.ts`, so the Simulator page shows it first
in the part "Season 2027", the menu's dropdown has the line "Fire Cadet — Season 2027", the season
page labels it "Online simulator", its category page has the "Try the Fire Cadet simulator" block,
the homepage's 2027 block has "Try the simulator", and the Training page's card names it. It has
no `menuName` ("Fire Cadet" is short; question 21).

What the shared code got for this game. Every change is behind something the four older games
leave out (an optional field, an optional prop, a parameter with a default), so they run exactly
the lines they ran before. Their examples were played before and after the change, once, in a
scratch script, with the same result byte for byte, and every older test still passes (only the
tests that count the games were changed).

| File | The change |
| --- | --- |
| `src/simulator/core/types.ts`, `core/engine.ts` | **Fixed sticks** (`GripperConfig.fixedSticks`): what stands between the two sticks turns with the robot when it turns. **The referee can take bodies off the field** (`RefereeCall.removeBodies`: a delivered item, a touched obstacle) **and put them back** (`RefereeCall.restoreBodies`: where it stood at the start of the match, unturned, only when nothing is nearer than `RESTORE_CLEARANCE`, 5 mm; else nothing happens and the referee asks again on a later tick). **A game can name its own interpreter** (`Game.createVM`) |
| `src/simulator/core/simulation.ts` | uses `game.createVM` when a game has one |
| `src/simulator/ui/useSimulation.ts` | the two "Nothing will happen …" warnings only for block programs; no sensor picture is loaded when a game has none |
| `src/simulator/ui/render.ts`, `StageCanvas.tsx` | optional **painters**: a game can draw the robot, its items and flat things on the mat itself |
| `src/simulator/ui/TitleBar.tsx` | the prop `robot` ("· mTiny"; "· mBot2" when none is given) |
| `src/simulator/ui/examples-words.ts`, `ExamplesDialog.tsx` | the sentence on how loading works can be given ("Loading one puts its cards in your row and sets its map …") |
| `src/simulator/ui/widgets.tsx` | `Modal` has a third frame, `align: 'full'`: the own-map editor fills a phone's screen |

Their tests: `core/engine-sticks.test.ts`, `core/engine-referee-bodies.test.ts`,
`ui/render-painters.test.ts`, `ui/widgets-modal.test.ts`.

### The field (measured from the print file)

All in mm, origin at the top-left corner of the map, +y down. A square is written with a letter
for its column (A to G) and a number for its row (1 to 7): A1 is the School at the top left, D7
the Fire Station at the bottom.

| What | Measure |
| --- | --- |
| Map | 1250 × 1250, 7 × 7 squares (`MAT`, `GRID_COUNT`) |
| Black lines | 178.000 apart (`GRID_PITCH`), the first one's middle 179.764 from the edge (`GRID_FIRST_LINE`), 7.06 wide |
| A square (a target) | to the middle of the lines; at the edge of the map, to the edge: the first column and row are 179.764 wide, the middle five 178, the last 180.236 |
| Where things stand | on a lattice of 178 mm (one Forward card): x = 90.764 + 178 × column, the same for y. That is the middle of the 25 inner squares and at most 1.12 mm from the middle of an edge square |
| Marked places (a white dashed frame) | School A1, the top Fire Station D1 (no job), Factory G1, House G3, Safe Zone D4, Hospital A5, Bakery G5, the Fire Station D7 (start, finish, and the Equipment's place) |
| Water / Equipment Area | A6, B6, A7, B7 (no dashed frame) |
| Road squares | a drawn road under the middle: C3, D3, E3, B4, D5, F7; within 30 mm of it: C2, E2, C4, B5, F5, G4, E7. The practice maps put their obstacles only there |
| Table around the map (ASSUMPTION) | 100 mm on every side, as in Warehouse Sort and Locker Room |

### The robot and the two sticks

The robot is a box of 114 × 106.5 mm (98 high) that turns around its middle. The organiser
answered: "2 sticks will be added on the left and right to push it in front of the robot". Here
each stick is 30 mm long beyond the front of the body and 8 mm thick, on the left and the right
edge of the front, so the free width between them is 90.5 mm; the robot reaches 87 mm ahead of
its turning point. The real sizes are not decided (question 4).

- **Forward** pushes an item: it rests against the body, between the sticks, its middle 77 mm
  ahead of the turning point.
- **A turn** takes it along: what stands between the sticks turns with the robot (fixed sticks,
  in the engine). With real geometry and no such rule, a 40 mm item does not stay between the
  sticks through quarter turns at any stick length from 20 to 32 mm (at most 7 of 12 sequences of
  turns worked; measured in the design). So the rule is what the organiser's answer asks for, made
  into one rule of the engine.
- **Backward** leaves the item where it is.

Measured: the whole robot fits inside the Fire Station on its start place in all four
directions, with 2.0 mm to spare at the tips of the sticks (4.24 mm looking down); an item
caught from any side ends 77 mm ahead of the turning point; 48 moves end on the start place to
0.001 mm. **What breaks at other sizes** (tell the organiser when the real sizes come):

| Size | Works | Breaks | Why |
| --- | --- | --- | --- |
| Stick length (beyond the front of the body) | 21 to 32 mm | 20 mm and less: the item is not held in a turn. 33 mm and more: the robot does not fit inside one square, so no return bonus and no legal start | the middle of a 40 mm item is 20 mm ahead of the body; 57 + 32 = 89 mm = half a square |
| Item base | up to 59 mm with 30 mm sticks | 60 mm and more: not held in a turn | the base must be less than twice the stick length |
| Item base, if the referee looked only when the robot has stopped | up to 32 mm | 33 mm sticks out of the far side of the target by 1 mm; 40 mm by 8 mm; 50 mm by 18 mm | 57 + base must be at most 89 mm. Counted "at the first moment" (as here), every base works |
| Free width between the sticks | 40 mm and more for a 40 mm item | under the item's width | the item must fit between them |
| Obstacle base | up to 150 mm | 152 mm and more: a robot that turns in the next square touches it | the tips of the sticks sweep a circle of 102 mm |

**Sticks longer than the item** break nothing. A 40 mm obstacle stands between the sticks (90.5 mm
apart), 25.25 mm from each, so an item pushed into it is what touches it, and the referee names
the item (−1, D5). Measured with 30 mm sticks and items of 26 mm (the tips of the sticks get 3.4 mm
past the front of the obstacle, beside it) and 30 mm. Only an obstacle 90 mm wide or more is met by
the tips of longer sticks before the item: the referee then says that the robot touched it, which
is true, and it is the same −1.

`numbers.test.ts` holds the limits of the stick length, the item base and the free width: if real
sizes break one, it says which, and sizes of the "Works" column pass. `game.test.ts` plays sticks
longer than the item. No test holds the obstacle base row (the design measured it).

### The cards and the panel

**Junior: a row of cards.** The row always begins with the yellow start card; the round GO button
starts it, like the button of the Tap Pen. The cards are the ones seen at the organiser's events:

| Card | The robot |
| --- | --- |
| Forward, Backward (blue) | one square ahead or back, without turning: 178 mm in 1.6 s |
| Turn left, Turn right (blue) | a quarter turn on the spot: 1.3 s |
| x2, x3, x4, x5 (yellow) | the one arrow card right before it runs 2, 3, 4 or 5 times in all |

The robot rests 0.4 s between two moves, not after the last one, so "Forward, x3" takes 3 × 1.6 +
2 × 0.4 = 5.6 s. Times are counted in whole ticks of the engine (0.01 s), the way the
interpreter counts them, so the time worked out for a row is exactly the time of the match.
A number card must stand right after an arrow card, and an arrow takes one number card at most:
the row refuses anything else and says why in a few words ("Put an arrow card first.", "One
number card for each arrow.", "A number card comes after an arrow."). Removing an arrow removes
its number card; moving it moves its number card with it. A row holds **70 cards** at most ("The
row is full: 70 cards."): the shortest card is a turn, and a 71st card could never be finished
inside 120 s — 70 turns end at 118.6 s, so a 71st would start at 119.0 s and be cut off by the
clock (worked out from the times, so it changes with them). During a match the row is locked; the
running card has a white ring. The match clock starts when the row starts, and the match ends
when the whole row has run (that time counts), at 120 s or at STOP.

**Mini: the direction panel.** A yellow panel with the four arrow cards: one tap is one whole
move. A tap while the robot moves is kept for after the move — only the newest one — so a child
can tap the next move ahead (and change their mind until it starts). Holding a card down does not
repeat it. The arrow keys do the same. The match ends at 120 s or at STOP. A real pen probably
ignores such a tap or keeps every tap, so the Rules window tells children to wait until the robot
stops on a real pen (question 2).

The programs are plain objects, so a row travels through the examples lock as it is:
`{ "format": "mtiny-cards", "version": 1, "cards": ["forward", "x3", "left"], "field": "P1" }`
(`field` only on an example: loading it sets that map), and `{ "format": "mtiny-panel",
"version": 1 }`. Speeds: Junior 1x, 2x, 4x; Mini 1x only (driving tap by tap at 2x is another
game). There are no restarts, no pause and no countdown: GO is the referee's start, STOP is the
student saying "STOP". The planning stopwatch of Junior (the rules give 120 s to plan) only counts
and says when 2 minutes are over; it locks nothing (question 15).

### The referee

| Line | Points | When |
| --- | --- | --- |
| Water to the Fire | +5 | the first moment the Water's whole base is inside the square with the Fire; the referee then takes it off the field and the points stay |
| Cat to the Safe Zone | +5 | … inside D4 |
| Injured Person to the Hospital | +5 | … inside A5 |
| Equipment to the Fire Station | +5 | … inside D7, the Fire Station at the bottom |
| Robot back in the Fire Station | +5 | when the match ends: the whole robot, sticks included, completely inside D7 — and it was completely outside D7 before |
| Obstacles touched | −1 each | the robot (its body or a stick) or an item the robot pushes touched it (D5); once for each obstacle, whoever touched it, so −3 at most |

The most is 25 = 4 × 5 + 5, and it can be reached on all eight practice maps. The total is never
below 0. The four items can be done in any order. Edge cases, in short:

- **An obstacle touched** (D1, D5): the referee lifts it at the first touch and puts it back on
  its own square once nothing is within 5 mm of its place. Driven into head-on, the robot touches
  it 0.88 s into the card and goes on to the end of the card, on its square line. An item pushed
  against it lifts it too and costs the same point: "The Equipment touched the Road Closed sign:
  -1. On the real map, go round it." Touched again later, by the robot or by an item: no second
  point ("The robot touched the Road Closed sign again. The referee puts it back."; "… too." when
  something else touched it first). The score sheet ("Touched: the Road Closed sign.") and the
  score strip (a red "-1") count an item's touch like the robot's own. An item left on an
  obstacle's place keeps it off the map until the place is free. An obstacle that moved while
  nothing touched it was turned along by the sticks: that counts as the robot's touch.
- **An item in a wrong marked place** brings nothing and costs nothing; it stays on the map. The
  referee says so once ("The Cat is in the Hospital. It belongs in the Safe Zone."), and only when
  the item was moved and has come to rest there — not while it is pushed through a marked place,
  and not for an item that started on one.
- **A delivery** counts 0.35 s into the card that drives the item in (when the robot has driven
  32.4 mm of that card); the item is gone from the next tick and the robot drives on without it. The
  Equipment goes home into D7: the robot must leave, catch it and drive in behind it.
- **The return bonus** needs the robot to have left D7 first: Forward, Backward scores 5;
  turning on the spot scores nothing. It is looked at once, when the match ends: STOP 0.6 s
  before the robot is home gives no bonus. During the match it is never shown as earned, nor added
  to the points: a robot that is home says "The robot is in the Fire Station now. The bonus counts
  when the match ends." (it may still drive out again).
- **Leaving the map** costs nothing: the robot stops with the tips of its sticks 100 mm outside
  (the edge of the table) and the referee says "The robot left the map." once. An item partly off
  the map is in no target; nobody puts it back.
- **The very end**: a delivery on the tick of exactly 120.00 s still counts.
- **Not simulated**: a run the referee stops because somebody touched the robot, the two rounds
  and the ranking. The Rules window says so.

The banner under the map shows the referee's newest sentence for 3 s ("The Cat is in the Safe
Zone. 5 points.", "The robot touched the Fallen Tree: -1. The referee puts it back."), then what to
do next. The score sheet (for the teacher) is titled "Score sheet · Junior" or "Score sheet ·
Mini", because the two are ranked apart.

### The screen, as measured

One column on a phone or a tablet: the map block sticks to the top of the window (with the clock,
the points and the banner), the bar with the round button sticks to the bottom, and the row, its
buttons and the card box scroll between them. On the first screen the title row and the mode
switch stand above the map block and push the row and the box under the bar, so when the screen
opens the page scrolls them away once (only when the work area is not in view, and only down), and
GO brings the row (Junior) or the panel (Mini) into view the same way. The banner under the map is
as wide as the screen, not only as the map, and has three lines at most. In a window under 560 px
high — a phone held sideways — the map block does not stick (it and the bar would cover the whole
window): the page scrolls as one, and every card and arrow can be reached. From 1024 px wide: two
columns, the map on the left, the row and the cards on the right. Measured in Chromium, in a build,
after that first scroll:

| Window | Side of the map | Mat | Room under the banner | Row, buttons and box |
| --- | --- | --- | --- | --- |
| 390 × 844 | 366 px | 316 px | 277 px | 260 px: fits |
| 390 × 664 (a phone with its browser bars shown) | 201 px | 173 px | 262 px | all but the last 8 px of the box |
| 360 × 640 | 200 px | 172 px | 239 px | a short scroll |
| 768 × 1024 | 545 px | 470 px | 262 px | 192 px: fits |

On the classroom screen the map is 399 px at 1024 × 768 (the right column fits with no scroll),
531 px at 1440 × 900 and 711 px at 1920 × 1080. Where the left column is narrow (up to about
1280 × 800) the banner takes the whole line over the map and the clock and the points lie on the
map's top edge, as on a phone; the eight map buttons stand in one line only where the picker itself
is 426 px wide, else in two lines of four (map 8 was cut off at 1024 × 768, 1366 × 768 and 1280 ×
720). The first GO of a visit closes the Map section, so that the score sheet stays in view in the
short column under the map. In Mini the four arrows of the panel are in view under the banner on
the three phones (the line under the panel may need a short scroll). Every control is 48 px or more
(the panel cards are 64 px under 700 px of height, 56 px under 660 px), and on this page the
breadcrumb links Home and Simulator of the shared title row too; the squares of the own-map editor
are 53.4 px at 390 px wide and 49.1 px at 360. A refusal's bubble lets taps through to the buttons
under it. The Rules window's text takes the keyboard when it opens, so the arrow keys, Page Down,
Space and End scroll it. The banner reads a refusal out again when it comes twice. The browser remembers the row, the map, the mode, the speed and which sections are open
(`mbot2-sim:fire-cadet:…`).

### The practice maps

There is **no official list** of field combinations yet (the organiser). So the simulator has
eight **practice maps of this simulator** — never called official on the screen — from the easiest
(P1) to the hardest (P8), and "My own map", where a teacher can place the Fire, the four items and
the three obstacles to copy any combination. "Surprise" gives one of the eight — never the one on
the stage.

| Map | Code | Fire | Water | Cat | Injured Person | Equipment | Road Closed, Fallen Tree, Broken Vehicle | Cards | Moves (turns) | Time | Without the obstacles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | `S-A6-D5-C5-C7-E3-F5-F7` | School | A6 | D5 | C5 | C7 | E3, F5, F7 | 18 | 27 (5) | 52.1 s | 52.1 s |
| P2 | `B-B6-E5-B4-F7-C2-D3-E2` | Bakery | B6 | E5 | B4 | F7 | C2, D3, E2 | 22 | 29 (7) | 55.5 s | 55.5 s |
| P3 | `H-B7-C5-E3-D6-C2-E2-B4` | House | B7 | C5 | E3 | D6 | C2, E2, B4 | 26 | 36 (10) | 68.6 s | 68.6 s |
| P4 | `S-B7-B3-C3-E6-B5-C4-E7` | School | B7 | B3 | C3 | E6 | B5, C4, E7 | 34 | 42 (12) | 80.0 s | 74.3 s |
| P5 | `F-A7-E6-C3-F2-D5-E3-B4` | Factory | A7 | E6 | C3 | F2 | D5, E3, B4 | 32 | 45 (11) | 86.3 s | 84.6 s |
| P6 | `B-A6-C6-F2-A7-G4-F5-B5` | Bakery | A6 | C6 | F2 | A7 | G4, F5, B5 | 33 | 47 (11) | 90.3 s | 82.9 s |
| P7 | `H-A7-F6-B2-B4-D5-C4-D3` | House | A7 | F6 | B2 | B4 | D5, C4, D3 | 40 | 51 (13) | 97.7 s | 88.6 s |
| P8 | `F-B6-G6-E3-F2-D5-D3-G4` | Factory | B6 | G6 | E3 | F2 | D5, D3, G4 | 41 | 53 (15) | 101.1 s | 92.6 s |

"Cards", "Moves" and "Time" are those of the proof row of each map in `practice.test.ts`: a
shortest row for all 25 points, as the solver finds it (on map 6 the solver itself lays the same 47
moves and 90.3 s in 34 cards; the proof row puts them in 33).
Each map is **proved in the engine** by `practice.test.ts`: its row scores 25 at exactly that time,
the robot stands on a square after every card, the referee never says "wrong place", and no
obstacle is touched. Every obstacle stands on a road square; every Fire place and every Water
square is used twice; on map 6 the Equipment starts in the Water / Equipment Area. On maps 1 to 3
the obstacles stand beside the ways; from map 4 on they stand on the shortest ways, and the proof
rows go round them. ("Without the obstacles" is the time with no obstacle on the map. The row of
that time, played on the real map, pushes items into the obstacles or touches them, and each
obstacle touched costs 1 point (D5): measured, it scores 22 on map 4 (in 74.3 s), 24 on map 5
(84.6 s), 24 on map 6 (82.9 s), 22 on map 7 (88.6 s) and 22 on map 8 (92.6 s), never the 25 of the
proof row; the referee tells the child to go round on the real map, and question 3 asks the
organiser.) In a code the first
letter is the Fire (S School, F Factory, H House, B Bakery), then the squares of the Water, the
Cat, the Injured Person, the Equipment and the three obstacles; capitals, blanks and hyphens do
not matter, and a practice map always gets its short code (`P3`).

Map 8 leaves 18.9 s. If the real card times are slower (all times more than 120 / 101.1, about
1.19 times as long), map 8 falls out of the 120 s first, and `practice.test.ts` says so.

**My own map** keeps these rules at every tap: one thing per square; the Water on one of its four
squares; the Cat, the Injured Person and the Equipment on any other square except their own target
and D7 (a marked place is allowed: the rules put them "at a rescue location"); the three obstacles
on squares without a dashed frame (the editor does not check that the square has a road: grass and
the pond are allowed; question 8); always all four items and all three obstacles.
That allows 71,983,941,120 maps. The editor says, a moment after every tap, whether this simulator
**finds** a row for all 25 points inside 120 s ("found", never "possible": the solver never backs
away from an item). Measured on 3,000 random own maps (seed 2027): 18 have no row; 57 have one
only over 120 s; 2,925 have one inside 120 s (shortest 51.5 s, middle 92.0 s, nine in ten under
107.4 s, longest 120.0 s; 21 to 54 cards, middle 36). Every one of those 2,925 rows scored 25 in
the engine at exactly its time, with the referee of D5 (two of them end at exactly 120.00 s, where
the clock ends the match on the same tick), and so did all 2,912 rows inside 120 s of 3,000 other
random own maps (seed 7). In none of these matches did the robot or an item it pushes touch an
obstacle: the solver never drives into an obstacle's square, and an item between the sticks never
reaches the next square's obstacle (measured, an item never came nearer than 4.6 cm to one, the
robot never nearer than 4.0 cm). So "found" never relies on pushing an item into an obstacle.
`solver.test.ts` plays the first 300 rows of the survey and the rows of 150 of the other maps
again on every run.

### The examples, as measured

Six rows of cards in `src/simulator/fire-cadet/samples.ts`, each made for one practice map (its
`field`: loading it sets that map). `samples.test.ts` plays each on its own map and on all eight,
and checks every number and every claim of its text.

| Id | Level | Title | Map | Row | Cards | Moves | Time | Points on its map |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cadet-three-forward` | starter | Three cards for the cat | P1 | `F F F` | 3 | 3 | 5.6 s | 5: Cat |
| `cadet-there-and-back` | starter | There and back again | P1 | `F3 B3` | 4 | 6 | 11.6 s | 10: Cat, return |
| `cadet-turn-around` | starter | Turn around with the toolbox | P3 | `F R2 F` | 4 | 4 | 7.0 s | 10: Equipment, return |
| `cadet-two-rescues` | intermediate | Two rescues and home | P1 | `F3 B L F3 B3 L F2` | 11 | 14 | 27.0 s | 15: Cat, Injured Person, return |
| `cadet-round-the-sign` | intermediate | Round the closed road | P5 | `L B R F3 L F B L F3 R F` | 13 | 15 | 28.1 s | 10: Cat, return; the Road Closed sign on D5 is not touched |
| `cadet-all-four` | advanced | All four rescues | P1 | `F3 B L F3 L F R2 F5 B5 B R F3` | 18 | 27 | 52.1 s | 25: all five lines, no obstacle |

(F Forward, B Backward, L Turn left, R Turn right; a digit after a letter is the number card
behind it: `F3 B L` is Forward, x3, Backward, Turn left.) Every row is valid, every match ends by
itself when the row has run, none touches an obstacle on its own map and none gets a "wrong
place" sentence. The "Try"s of the texts, measured too: `F3` in place of `F F F` on map 1, 5
points in 5.6 s; `F L2 F` on map 3, 10 points in 7 s; "there and back" on map 2, 5 points.

**What each one scores on the eight maps** — a row of cards fits one map. (−1) = one obstacle
touched, each time by the robot itself (no example pushes an item into an obstacle on any of the
eight maps): that costs 1 point and nothing more. `samples.test.ts` holds this whole table.

| Example | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `cadet-three-forward` | **5** | 0 | 0 | 0 | 0 (−1) | 0 | 0 (−1) | 0 (−1) |
| `cadet-there-and-back` | **10** | 5 | 5 | 5 | 4 (−1) | 5 | 4 (−1) | 4 (−1) |
| `cadet-turn-around` | 5 | 5 | **10** | 5 | 5 | 5 | 5 | 5 |
| `cadet-two-rescues` | **15** | 5 | 5 | 4 (−1) | 4 (−1) | 4 (−1) | 4 (−1) | 4 (−1) |
| `cadet-round-the-sign` | 5 | 10 | 5 | 4 (−1) | **10** | 5 | 5 | 5 |
| `cadet-all-four` | **25** | 5 | 5 | 4 (−1) | 4 (−1) | 4 (−1) | 4 (−1) | 4 (−1) |

The three starters teach one idea each (one card is one square; a number card and Backward; an
item turns with the robot), the two intermediate ones put two ideas together, the advanced one is
the whole mission on the easiest map. They use maps 1, 3 and 5 only, so the other maps stay for the
children's own rows. The three starters are open to everyone, the two intermediate ones need a
member code, the advanced one is shown to advanced codes only (`content/simulator-codes.ts`).

**A note on the solver.** The own-map editor runs the solver in the browser, and it can work out
a 25-point row for any map — map 1 included, whose shortest row is the advanced example. The screen
shows only "found: N moves, S seconds", never the row, and the proof rows of the practice maps are
in a test file only. Somebody who reads the site's JavaScript could still run it. The lead engineer
decided to keep it (a practice tool).

### What this simulator assumes

The second part of the **Rules** window, "What this simulator assumes", tells what a child or a
teacher can notice (`src/simulator/ui/fire-cadet/rules.ts`; `ASSUMPTIONS_SHOWN` there says which
sentence stands for which assumption, and `rules.test.ts` checks that none is missing and that
every number comes from `numbers.ts`). The whole list, one line each — A are the assumptions the
lead engineer took before the design, N those the design added, D1 and D5 the lead's decisions on
the obstacles. The question to the organiser that would settle each is in brackets.

| # | Assumption |
| --- | --- |
| A1 | One Forward or Backward card moves the robot exactly one square, 17.8 cm; one Turn card turns it 90° on the spot. (Q1) |
| A2 | A move takes 1.6 s, a turn 1.3 s, the rest between two cards 0.4 s. (Q5) |
| A3 | Junior: Forward, Backward, Turn left, Turn right, x2 to x5; the yellow start card is always first and the round button starts the row; a row the robot may not understand cannot be built — the row refuses it and says why. (Q6, Q7) |
| A4 | Mini: the four arrow cards of the yellow panel; one tap is one whole move; no joystick. (Q2) |
| A5 | The items and the obstacles stand on 4 × 4 cm bases; the sticks are 3 cm long and 0.8 cm thick, on the two front corners. (Q4) |
| A6 | A target is its square, to the middle of the black lines (to the edge at the edge of the map); an item counts at the first moment its whole base is inside. (Q10) |
| A7 | Touching an obstacle costs 1 point once for each obstacle, 3 at most, whether the robot or an item it pushes touched it (D5); the robot is not put back to the start. (A7 also said the obstacles are fixed and the robot stays stuck: replaced by D1.) (Q3, Q3a, Q3b, Q3c) |
| A8 | The return bonus: the whole robot, sticks included, completely inside D7 when the match ends, and only if it was completely outside D7 before. (Q11) |
| A9 | The total is never below 0. (Q17) |
| A10 | Junior: the match ends when the row has run (that time is recorded), at 120 s or at STOP. Mini: at 120 s or at STOP. (Q14) |
| A11 | The programming time is a stopwatch that locks nothing. (Q15) |
| A12 | The robot starts on the middle of D7, looking up the map; it may drive over every square (roads, grass and water are pictures). (Q12, Q19) |
| A13 | The Water starts on any of A6, B6, A7, B7; the Fire is a flat sign that nothing bumps into. (Q9, Q13) |
| A14 | Practice maps of this simulator and an own map; never called official. (Q8) |
| A15 | A visitor opens the three starter examples, a member code five, an advanced code all six, as in the other simulators. (Q22) |
| A16 | No rules file on the site; the Rules window tells the rules. (Q20) |
| A17 | Our own simple drawings, in the colours seen at the organiser's events. (Q23) |
| A18 | For children and teachers, on phones, tablets and classroom screens: a screen of its own with big pictures, few words and 48 px or more for every touch. (Q24) |
| N1 | Everything stands on a lattice of 178 mm (x = 90.764 + 178 × column), at most 1.12 mm from the middle of an edge square. |
| N2 | The robot turns around the middle of its body. |
| N3 | An item between the two sticks goes round with the robot when it turns; Forward pushes it, Backward leaves it. (Q4) |
| N4 | Items and obstacles are 50 mm high, the sticks 5 to 25 mm above the mat, the wheels 40 mm, their track 74 mm. (They change nothing that is measured here.) |
| N5 | A move takes exactly its time, speeding up and braking included; the rest comes only between two moves; x3 is three moves with rests. (Q5) |
| N6 | A delivered item is gone from the next tick. |
| N7 | Mini: a tap during a move is kept for after it, only the newest one. (Q2) |
| N8 | Speeds: Junior 1x, 2x, 4x; Mini 1x only. |
| N9 | A row holds 70 cards at most. (Q6) |
| N10 | The robot and the items can leave the map; they stop at the edge of the table, 100 mm outside; no points lost; an item partly off the map is in no target. (Q16) |
| N11 | No countdown, no pause, no restart; the red STOP button is the student saying "STOP". |
| N12 | My own map: one thing per square; the Water on its four squares; the other items anywhere but their own target and D7; the obstacles on squares without a dashed frame; always three obstacles, one of each kind. (Q8, Q18) |
| N13 | The match time on the score sheet is the time the match ended. |
| N14 | An example is tied to its practice map by the word `field` in its program. |
| N15 | "Surprise" gives one of the eight practice maps, never the one on the stage (a random own map need not be playable). |
| N16 | On a small screen an item or obstacle is drawn at least 22 px across, with its true base under it. |
| N17 | Replaced by D1. (It said: after a hit, the row goes on from where the robot is stuck.) |
| N18 | The own-map editor says whether this simulator finds a row for 25 points inside 120 s; it never shows the row. |
| N19 | Mini and Junior are two interpreters of one game (no sensors, no "if"), chosen by a word in the program. |
| N20 | No sound, no program files (Open, Save), no "Test on many". |
| N21 | The Junior match clock starts at the round button; laying the cards takes no time. (Q14) |
| N22 | The banner shows the referee's newest sentence for 3 s. |
| N23 | Dropped with D1. (It said: a robot pressed against a fixed obstacle cannot turn round it. With D1 nothing fixed is left that a turning robot can be pressed against but the edge of the table, which that rule never covered: measured.) |
| N24 | The referee says that an item is in a wrong marked place only when the item has moved and has come to rest there, or at the end of the match. |
| D1 | As soon as anything touches an obstacle the referee lifts it, and puts it back on its own square, unturned, once nothing is nearer to its base than 5 mm. (D1 also said that only the robot's touch costs a point: replaced by D5.) (Q3) |
| D5 | An item the robot pushes against an obstacle costs 1 point too, like the robot's own touch: once for each obstacle, whoever touched it. The referee adds "On the real map, go round it." (Q3b) |

### Questions for the organiser

Most important first. Each says what the simulator does now.

1. **One card against one square.** A real mTiny drives 18.6 cm for one Forward card on the
   maker's own map blocks of 18.6 cm (verified for Forward; Backward is likely the same). Your Fire
   City map is 125 cm wide with 7 squares of 17.8 cm, so a real robot would probably end about 0.8
   cm further with every move (5.6 cm after 7 moves). Is the map printed at 125 cm at the
   competition? Has a whole run been tried on it? *Now: one card = one square of 17.8 cm (A1).*
2. **Mini: tapping while the robot moves.** What does a real Tap Pen do when a child taps a card
   again while the robot still moves: ignore the tap, or keep every tap and run them in order?
   Only the four arrow cards of the yellow panel, one tap one move, or may Mini also use the
   joystick of the pen? *Now: the four cards; a tap during a move is kept for after it, only the
   last one (A4, N7). Part 2 of the Rules window tells children to wait on a real pen.*
3. **A robot that touches an obstacle.** The rules say −1 when the robot touches an obstacle, that
   the robot "may not push an obstacle away and use the blocked road", and that the referee
   returns a moved obstacle to its place while the clock runs (l.183). Are the obstacles loose or
   fixed to the map? When does the referee put a moved one back: at once, or once the robot has
   gone? What happens to a robot that pushes an obstacle away and drives on along the blocked
   road? And three more:
   (a) **Is the −1 once for each obstacle, or for every touch?** The rules say both "If the robot
   touches an obstacle: −1 point" (l.179-181) and "Each obstacle touched: −1 point" (l.243-245).
   (b) **An item against an obstacle.** We chose −1: if the robot pushes a rescue item into an
   obstacle, that costs 1 point, as if the robot had touched it (once for each obstacle). Is that
   what the referee does? Or is it "pushing an obstacle away to use the blocked road", and the
   referee does more: stops the run, or takes more points? (Without a point for it, a row that
   pushes items through the obstacles of practice maps 4, 5 and 8 scores all 25 points sooner than
   the way round, and with equal points the shorter time ranks higher.)
   (c) **Back to the start?** Your mTiny rules of last season said "Touching a cone makes the team
   lose 1 point and the Judge resets the mTiny to its starting position while the timer is
   running." Does anything like that apply in 2027?
   *Now (D1, D5): as soon as anything touches an obstacle the referee lifts it off the map, and
   puts it back on its own square as soon as nothing is within 5 mm of its place; −1 once for each
   obstacle (a), whether the robot or an item it pushes touched it (b), and then the referee says
   "The Cat touched the Road Closed sign: -1. On the real map, go round it."; the robot is not put
   back to the start (c). So the robot is never stuck and goes on with
   its row, on the squares. While an obstacle is off the map, the robot — or an item it pushes —
   could pass through its square: the simulator takes the point but does not check the blocked
   road, and the Rules window tells children to drive around the obstacles. If real obstacles are
   fixed to the map, a real robot that hits one stays stuck there, and we would change this.*
4. **The real sizes**: the base of the 4 items and of the 3 obstacles, their height, and the two
   sticks (length beyond the front of the robot, thickness, how far apart, how high). *Now: 4 × 4
   cm bases, sticks 3 cm long and 0.8 cm thick on the two front corners (A5).* What works in the
   simulator ("The robot and the two sticks" above): sticks 2.1 to 3.2 cm long; an item base under
   twice the stick length and narrower than the gap between the sticks. Will an item really stay
   between the sticks when the robot turns? Please try it with a real mTiny: the simulator assumes
   it does (N3).
5. **The time of a card.** How long does one move, one turn, and the pause between two cards take
   on a real mTiny? A short video or a stopwatch would do. *Now: 1.6 s, 1.3 s and 0.4 s (A2). With
   these, every practice map can be done inside 120 s; the hardest needs 101.1 s.*
6. **Which cards are allowed in Junior**, and how many of each? Only Forward, Backward, Turn left,
   Turn right and x2 to x5 (as on your tables in 2024-2026), or also Loop, brackets and the other
   cards of the kit? Is there a limit on the number of cards? *Now: those eight cards, at most 70
   in a row (A3, N9).*
7. **How a program is started in 2027, and rows the robot may not understand.** Does the row begin
   with the yellow start card, and is it started with the round Start button of the Tap Pen, as at
   your 2024-2026 events? What does a real mTiny do with a number card right after the start card,
   or with x2 followed by x3? *Now: the yellow start card is always there and the round button
   starts the row; such rows cannot be built here (A3).*
8. **The official field combinations.** Will there be a list, as last season (8 combinations)?
   Where may items and obstacles stand: may the Cat, the Injured Person or the Equipment start on a
   marked place (a House, the School, the top Fire Station), and do the obstacles always stand on
   roads? *Now: 8 practice maps of this simulator, never called official, and "My own map": items
   on any square but their own target and the start square, obstacles on squares without a dashed
   frame — the editor does not check that the square has a road, so grass and the pond are
   allowed, and its refusal says only "An obstacle cannot stand on a marked place." (A14, N12).*
9. **Where the Water starts.** The rules list what a combination shows (l.108-114), and the Water
   is not on that list. Does the Water always start on the same spot? Which one? And may the
   Equipment also start in the Water / Equipment Area, as its name says? *Now: the Water on any of
   the four squares of the area; the Equipment of practice map 6 starts there too (A13).*
10. **When a delivery counts**: at the first moment the base is fully inside the target, or only
    when the robot has stopped? *Now: the first moment (A6). With the simulator's sizes, a 4 cm
    item still sticks out of the far side by 0.8 cm when the robot has stopped in the middle of
    the target, so the answer matters.*
11. **The return bonus**: must the robot have left the Fire Station first? *Now: yes (A8).*
12. **Which way the robot faces at the start**, and does it stand in the middle of the Fire
    Station? The rules say only "fully inside the starting area" (l.49, l.118). *Now: in the
    middle, looking up the map (A12).*
13. **The Fire marker**: is it flat, so that the robot and the items can go over it? *Now: flat;
    nothing bumps into it (A13).*
14. **The Junior match clock.** Does it start when the row starts (tapping the cards with the pen
    not counted)? Does the match end, and is the time recorded, when the robot has run the whole
    row - or only at STOP or after 120 seconds? *Now: it starts with the row and ends when the row
    has been run, and that time is recorded (A10, N21).*
15. **The programming time**: is it enforced at 120 s? *Now: a stopwatch that only tells (A11).*
16. **Leaving the map**: may the robot or an item leave the map, and what happens then? *Now: they
    may; it costs nothing; an item partly off the map is in no target (N10).*
17. **The total**: can it go below 0? *Now: never (A9).*
18. **The obstacles**: always 3, one of each kind? *Now: yes (N12).*
19. **The roads**: may the robot drive over grass, water and buildings? *Now: yes; the roads are
    pictures (A12).*
20. **The rules file and the season page.** When will the rules be published, and may the season's
    sentence "missions, fields and rules will be revealed soon" change? *Now: no rules file on the
    site; the Rules window tells the rules (A16).*
21. **The name in the menu**: "Fire Cadet", or "Fire Cadet — Rescue City"? *Now: "Fire Cadet".*
22. **The ready-made examples**: is it right that a visitor can open the three starter examples, a
    member code opens five and an advanced code all six, as in the other simulators? *Now: yes
    (A15).*
23. **Pictures**: may the simulator show the real coding cards, the real robot and the real items
    as pictures, or should it keep its own simple drawings? *Now: our own drawings, in the colours
    seen at your events (A17).*
24. **Who uses it**: do the children use the simulator themselves on phones and tablets, or mostly
    the teachers on a classroom screen? *Now: both; big pictures and few words, 48 px or more for
    every touch (A18).*

### What to change, and where

| To change … | Change … |
| --- | --- |
| a size or a time (a card, the robot, the sticks, an item, an obstacle) | its line in `src/simulator/fire-cadet/numbers.ts`, nothing else: the game, the screen and the Rules window read it from there. Then run the tests: `numbers.test.ts` says which limit of "What breaks at other sizes" a size breaks, `practice.test.ts` whether a practice map still fits in 120 s, and `samples.test.ts` which numbers in the texts of the examples changed (they are written by hand: change them in `samples.ts`, and the tables here) |
| a rule the organiser decides | the referee in `game.ts`, then the sentence in `src/simulator/ui/fire-cadet/rules.ts` (move it from "What this simulator assumes" into the rules part once it is decided; `rules.test.ts` checks every number), and the lists here |
| the obstacles, if they turn out to be fixed to the map | not a number: the D1 part of the referee in `game.ts`. Without it the engine's smooth walls would slide a robot that turns while pressed against an obstacle round it (by up to 97 mm, measured in the design); the design's engine rule against that (N23) was dropped with D1 |
| the margin before a lifted obstacle goes back (5 mm) | `RESTORE_CLEARANCE` in `src/simulator/core/engine.ts` (the engine's, for every game that puts a body back; `numbers.ts` and the Rules window read it) |
| a practice map | `PRACTICE_MAPS` in `scenario.ts` and its line in `practice.test.ts` (the row, cards, moves, turns and times: the test proves it in the engine); then the table "What each one scores on the eight maps" in `samples.test.ts` and here |
| an example | `samples.ts` (and `sample-catalog.ts` for a new id, title or level), `samples.test.ts`, the tables here; the id begins with `cadet-`. Then its group in `content/simulator-codes.ts` and the same lines in `scripts/generate-simulator-codes.mjs`. Do not write the title of an example or a sentence of its text anywhere else: the guard (`client-guard.test.ts`) fails |
| who sees which example | `content/simulator-codes.ts` ("Member codes for the simulator examples" above) |
| a word on the screen | `src/simulator/ui/fire-cadet/words.ts` (the Rules window: `rules.ts`). No other screen file holds an English sentence (`screen.test.ts` checks) |
| a picture | `paint.ts` (the stage), `pictures.tsx` (the small pictures), `CodingCard.tsx` (the cards) |
| the text on the cards that lead to it | the `simulator` entry of the category `fire-cadet` in `content/seasons.ts` |

### Known limits of Fire Cadet

- **Nothing was measured on a real mTiny.** The sizes and times are the specification's or
  assumptions (questions 1, 4, 5). One card is one square of 17.8 cm here; a real robot probably
  drives 18.6 cm.
- **The item is carried rigidly.** An item between the sticks turns with the robot exactly; a real
  one would slide towards the stick that leads the turn. A pushed item never slides sideways or
  turns by itself.
- **No friction, no slip, no drift**: 48 moves end on the start place to 0.001 mm.
- **An item that was left behind** (the robot backed away from it) can only be caught again along
  the line it was pushed on: a robot that passes on the next line misses it.
- **The blocked road is not checked** (D1, D5, question 3): while an obstacle is off the map, the
  robot can drive through its square, and a robot that pushes an item against an obstacle lifts it
  and can then push on through. That costs 1 point for each obstacle (D5) and nothing more: on
  practice maps 4, 5 and 8 the rows through the obstacles score 22, 24 and 22 points, in 74.3 s,
  84.6 s and 92.6 s (the proof rows, which go round: 25 in 80.0 s, 86.3 s and 101.1 s). The rules
  forbid using a blocked road: the Rules window says "drive around the obstacles", and the referee
  says "On the real map, go round it." each time an item touches an obstacle. A real referee may do
  more than take 1 point (question 3b). An obstacle goes back only once its place is free: an item
  left on it keeps it off the map.
- **The edge of the table**: a robot or an item that leaves the map stops at the table, 100 mm
  outside, and is then off the squares for the rest of the match. A robot that turns while pressed
  against the table's edge is pushed about 15 mm away from it (the engine's smooth walls, as in the
  four older games). A robot that stands on a square never reaches the edge when it turns.
- **Two items at once**: the engine pushes a chain, and the second item is squeezed aside.
- **The solver** finds rows square by square and never backs away from an item: "found no row"
  means none without leaving an item behind somewhere. It runs in the browser (see "A note on the
  solver" above).
- **Not simulated**: the real Tap Pen and the real cards (the screen's cards and panel stand for
  them), the joystick of the pen, a run stopped because somebody touched the robot, the two rounds
  and the ranking.
- **Not tried with a screen reader** (VoiceOver, NVDA) or on a real phone or Safari: the names and
  live regions were checked in the page, touch in Chromium only.

---

## The Fire Fighter simulator

The seventh simulator of the site, for the Season 2027 category **Fire Fighter** (ages 8–10,
mBot2), the mission "Fire Fighter — Fire City". The robot is the mBot2 of Fire Rescue, part for
part. It starts in the **Fire Station** at the bottom middle of a white mat with black lines. Five
**cubes** stand on the mat, 5 × 5 cm and 7 cm tall: four red ones on the marked squares of the
two **pickup bays** (left and right) and a yellow one on the **red square** above the Fire Station.
Five **letter towers** wait for them: **M** at the school (bottom left), **A** at the hospital
(bottom right), **K** at the bakery (top right), **E** at the park (top left) and **X** at the
hydrant in the middle. The robot must put one red cube under each of M, A, K and E, and take the
yellow cube to X — once it has taken the yellow cube, X must be its next delivery. A cube pushed far
enough in under a tower makes its letter show: M A K E X. 20 points for each tower, at most 100;
4 points off for each tower pushed off its picture square. A match lasts 180 seconds. It lives at:

```
https://www.makexlebanon.com/simulator/fire-fighter
```

**Which rules.** The organiser's rules "Fire Fighter — Fire City" ("Official Rules, Ages 8–10",
the Word file `Fire_Fighter_Mission_Rules_1.docx`), whose scoring is headed **"Proposed scoring
for organizer review"**: the organiser has not confirmed it yet. The simulator plays it as written,
and the first line of its **Rules** window says "The scoring is a proposal the organiser has not confirmed yet." With the rules came the
organiser's answers of 20 November 2026: a match lasts **3 minutes** ("the same as Fire Rescue");
the letters stand **"M bottom left and then counter clockwise"** (with the logo at the top: M bottom
left, A bottom right, K top right, E top left, X at the hydrant), always the same, no draw; a tower
is **"Width 10.5 cm length 4 cm"**, and "the extra white is the square where the cube will be posed
(5×5cm) under the tower". After the design the organiser answered two more of our questions (the
same day): tower X opens **"Up, toward the hydrant line"**, and the space between a tower's two side
supports is **"About 6 cm"** — both as the simulator already played them (questions 1 and 2 below).
The rules file is **not** published on the site: whether it may be, with its proposed scoring, is a
question for the organiser (question 11). So the category has no download (`content/seasons.ts`
has no `downloads` for it, and says why), and the Rules window tells the rules in short. The map is
the organiser's print file `Fire_Fighter1250mm.pdf` (1250 mm); it is not published either. The
pictures on the stage are made from it.

**The ages.** The rules say 8–10; the organiser's Drive folder of the category is named "8-9 yo".
The site keeps 8–10, as the organiser said earlier (question 16).

This category is for children of 8 to 10, and many of them and their teachers read English as a
second language: every text on the screen is short and plain, and says nothing more certain than
the simulator knows — keep it that way. Everything that is general works as in Fire Rescue and is
described above: the blocks and their saving, the ruler and the enlarged stage, the examples and
their codes (one set of codes for all games), the title row with "Powered by …", the header height.
The block palette is the one of Fire Rescue (Servo, Gripper, Quad RGB, ultrasonic and colour
sensor, plus the Gripper shortcuts); two hover texts speak of cubes, as Warehouse Sort's do.

### How the game is put together

| File | What is in it |
| --- | --- |
| `src/simulator/fire-fighter/field.ts` | Every measure of the print file, each a named constant with its source (MEASURED, ORGANISER, RULE, PICTURE, ASSUMPTION): the 32 black lines (`LINES`, B00 – B31, in the order of the print file), the picture tiles and their colours (`TILES`, `TILE_COLORS`), the towers (`TOWER_WIDTH`, `TOWER_DEPTH`, `TOWER_GAP`, `SUPPORT_WIDTH`, `TOWER_HEIGHT`, `DASHED_SQUARES`, `SIDE_MARKS`, `LETTER_AREA`, `OPENING`, `TOWER_STEMS`, `PICTURE_SQUARES`), the cubes (`CUBE_SIZE`, `CUBE_SQUARES`, `CUBE_HOMES`), and the drawn stand-in of the mat the tests read (`MAT_VECTOR`, 163 layers in the order of the print file; the dashes are written out as the numbers that define them) |
| `src/simulator/fire-fighter/robot.ts` | The robot: Fire Rescue's mBot2, copied part for part (`FIRE_FIGHTER_ROBOT`); how far its claw reaches past its line sensor (`clawAheadOfLineSensor`, 82 mm); where it starts (`START_POSE`) |
| `src/simulator/fire-fighter/scenario.ts` | The **one setup** (`RULES_SETUP`, code `MAKEX`): nothing is drawn |
| `src/simulator/fire-fighter/game.ts` | The game and its referee: the bodies (ten side supports in five rigid groups, five cubes), the zones, the letter flaps, the score sheet and every sentence of the referee. At its top, the open points **F1 – F13** (questions 1 – 13 below), each with the constant behind it |
| `src/simulator/fire-fighter/play.ts` | Play a program without a screen (`playFireFighter`; the tests use it) |
| `src/simulator/fire-fighter/sample-catalog.ts`, `samples.ts` | The six examples. They stay on the server (see "Member codes" above) |
| `src/simulator/ui/fire-fighter/` | What only this game shows: `FireFighterSimulator.tsx` (what the general screen is given), `FireFighterLoader.tsx`, `SetupList.tsx` (the read-only list "The field" in place of the Combination panel), `rules.ts` (the Rules window) and `words.ts` (the screen's words) |
| `src/app/simulator/fire-fighter/page.tsx` | The page: its address, title and description |
| `public/simulator/fire-fighter/` | The two pictures of the mat: `mat.webp` (2500 px) is shown, `mat-sensor.webp` (1250 px) is what the line sensor reads |

Its tests: `field.test.ts`, `scenario.test.ts`, `game.test.ts`, `integration.test.ts` and
`samples.test.ts` in `src/simulator/fire-fighter/`, and `rules.test.ts` and `screen.test.ts` in
`src/simulator/ui/fire-fighter/`.

The category has a `simulator` entry in `content/seasons.ts`, so the Simulator page shows it in the
part "Season 2027" (after Fire Cadet, in the order of that file), the menu's dropdown has the line
"Fire Fighter — Season 2027", the season page labels it "Online simulator", its category page has
the "Try the Fire Fighter simulator" block, the homepage's 2027 block has "Try the simulator", and
the Training page's card names it. It has no `menuName` ("Fire Fighter" is short).

What the shared code got for this game. Every change is behind something the other games leave
out (an optional field, an optional prop, a word), so they run exactly the lines they ran before.
Their examples were played before and after the change, in two scratch scripts, with the same
result byte for byte, and every older test still passes (only the tests that count the games were
changed).

| File | The change |
| --- | --- |
| `src/simulator/core/types.ts`, `core/engine.ts`, `core/engine-collide.ts` | **Rigid groups** (`Body.group`): bodies with the same group are one piece made of several boxes — the two side supports of a tower. Whatever pushes one moves all of them by the same amount, what stops one stops all, and they never push each other. A group never turns: the engine's helper that straightens a body between the open fingers leaves its members alone, and so do Fire Cadet's fixed sticks. **Contacts with a member are decided by the side that met**: the side whose gap closed last since everything was apart, not the side of least overlap, so how much room a cube has does not depend on the speed of the robot (with the side of least overlap it was 5.0 mm at 10 RPM and 7 mm at 100 RPM) |
| `src/simulator/core/types.ts`, `ui/render.ts` | `RefereeProp.labelMm`: how high the letters of a prop's label are, in mm of the mat (the letters on the flaps: 30 mm). Left out, as by every other game: 11 px on the screen, as before |
| `src/simulator/ui/SimulatorApp.tsx`, `ui/screen-words.ts` | **`fixedSetup`** and the word `scenarioSummary`: a category with one setup and no draw. The title row has no "Test on many …" button, and the field's section shows only the game's own list — no code, no Random, no Default, no code field, no count — with "one setup" beside its heading |
| `src/simulator/ui/format.ts` | `bodyName`: `cube:red-…` reads "a red cube" in the console ("Picked up a red cube.") |
| `src/simulator/blocks/palettes.ts` | the palette `'fire-fighter'` |

Their tests: `core/engine-groups.test.ts` (the groups, the guard, the contact rule, a seeded random
test of approaches near a tower: no tower comes apart or turns), `ui/fire-fighter/screen.test.ts`
(`fixedSetup`, `labelMm`), `blocks/palettes.test.ts`, `ui/ui-games.test.ts`.

### The field (measured from the print file)

All in mm, origin at the top-left corner of the mat (the side with the MakeX Lebanon logo is the
top), +y down. Measured from the vectors of the PDF (1 pt = 25.4 / 72 mm) and, for the cubes'
squares, from the colours of the pictures; `field.test.ts` holds the print file's own numbers (in
points) and checks every constant against them.

| What | Measure |
| --- | --- |
| Mat | 1250 × 1250 (the page is 3543.31 pt = 1250.001 mm), white |
| Black lines | 25.4 wide (72 pt), RGB 35, 31, 32. An **outer loop**: the left line x 380.633, the right line x 885.339, the top line y 248.748, the bottom line y 1110.412 (hidden under the Fire Station picture); **branches** to the park and the school, the bakery and the hospital, and to the two bays; the **hydrant stem** x 637.700, from the top line down to X's T bar; the **Fire Station stem** x 633.834, from the Fire Station up to the yellow T bar. The yellow square is joined to nothing but the Fire Station stem: X is reached only from the top line |
| Picture tiles | 250 × 250: E park (top left), K bakery (top right), M school (bottom left), A hospital (bottom right), X hydrant (middle), the **Fire Station** (the start zone, x 503.045 – 753.045, y 985.412 – 1235.412); the two bays 120 × 240; the **yellow square** (the red frame) 100 × 100, x 583.833 – 683.833, y 772.058 – 872.058 |
| A tower's outline | a white **dashed square**, 60.000 × 60.700 between the centre lines of its 4.939 mm dashes (64.939 × 65.639 to their outer edge, 55.061 × 55.761 to their inner edge), between two dashed **side marks** (40.000 deep to their outer edge); the whole outline is 104.894 wide between the centre lines: the organiser's 10.5 cm. The square sticks out 12.8 mm in front of and behind the side marks |
| Towers (middles of their dashed squares) | M (128.301, 1114.985), A (1104.762, 1114.985), K (1102.645, 138.214), E (129.856, 138.214), X (633.833, 624.310) |
| Openings (`OPENING`) | M, A and X to the top, K and E to the bottom: the side their stem comes from (rules §3: "The referee faces each tower opening toward its track"; for X the organiser's answer) |
| T bars, near edge → tower | M and A 58.95, K 56.63, E 60.37, X 130.05 |
| Cubes (middles of the boxes around their printed corner brackets) | red: left bay (64.203, 573.689) and (64.338, 697.204), right bay (1175.498, 561.227) and (1175.428, 693.132); yellow (633.713, 827.638), 0.12 left of the Fire Station stem and 5.6 below the middle of its red frame |
| Robot | 237 × 130 with its claw open; it starts facing up with its middle on the Fire Station stem at (633.834, 1158.912): 6.5 free in front and behind inside the Fire Station, 65.8 on its left, 54.2 on its right |
| Table around the mat | 100 on every side, the engine's table of every game: the robot and the cubes can leave the mat and stop at its edge |

The drawn stand-in (`MAT_VECTOR`) agrees with the print file to 0.00054 mm. Against the picture the
line sensor reads, on white and on the lines: 99.5 % the same line or background, 99.35 % the same
colour name; the line edges lie 0.31 mm apart on average (4.4 mm at most, where a line meets a
picture). The examples score the same on both. Two things of the print: the **hydrant stem is 3.87
mm right of the middle of tower X** (a cube pushed along it goes in with 1.13 mm to spare), and the
lower T bar of the right bay lies 2.1 mm over the bay picture (question 17).

### The tower and the letter

**A tower is two side supports and a flap.** The supports are game elements of 22.5 × 40 × 100
mm, their inner faces 60 mm apart (the organiser: "about 6 cm"), standing on the side marks of the
outline; with the organiser's 10.5 cm they are solid, 2.25 cm thick (the rules' photos show thin
plywood plates: question 2). They have the same `Body.group`, so they slide together as one piece
and never come apart or turn. They cannot be gripped. The **flap** between them is only drawn (a
`RefereeProp`: nothing collides with it, no sensor sees it), from 7 cm — the top of a cube — up to
10 cm; it shows the tower's letter, 30 mm high, while the letter shows, and follows the tower when
it slides. The 250 × 250 picture tile under a tower is its **picture square**.

**The letter shows** when a cube

1. went into the tower **through its opening** — its stay in the tower began with its middle on the
   opening's side of the middle of the dashed square (a cube that goes in from the back never
   counts: tower X opens to the top, so the straight way from the yellow square into X's back
   scores nothing, and the score sheet and the console say why);
2. stands on the mat: not held, on nothing;
3. has its **whole base inside the white dashed square, measured to the outer edge of its dashes**
   (`LETTER_AREA`), where the tower now stands. The dashed line counts as inside.

What that leaves, measured in the engine (`game.test.ts`, `field.test.ts`):

| | Room |
| --- | --- |
| Along the opening | the cube's middle up to **7.8 mm** off the middle of the square, towards the opening or the back (7.8 mm: the letter shows; 7.9 mm: it does not) |
| Across | **5.0 mm** on each side: the supports are 60 mm apart. 5.00 mm off goes in; 5.05 mm catches the front of a support and pushes the tower away (tower X 45.02 mm), at 10, 20, 50 and 100 RPM alike |
| Turned | a cube pushed straight in by the closed claw: 9.5° goes in (the tower is nudged 3.3 mm sideways), 10° pushes the tower |
| From the back | never |

**The claw does not fit with a cube.** The open claw is 80 mm wide outside, 66 mm on a cube and 36
mm closed and empty; the supports are 60 mm apart. So a delivery is: let go about 1 cm before the
tower, back off **more than 5 cm**, close the empty claw, push the cube in, back off. (Measured: a
cube that sits exactly in the middle of the claw comes free after 5.0 cm; at 4.95 cm or less the
closing claw takes hold of it again and the robot carries it back out — no points. The yellow
cube of the examples sits 0.026 mm deeper in the claw, so for it 5.0 cm is not enough and 5.05 cm
is.)

**The claw against a support.** The engine has no motor that stalls. Opening the claw 15 mm inside
an empty tower pushes the tower 15.7 mm along its opening. Closing it around one support stops
against the support and moves nothing; a turn afterwards drags the tower along, by (−22.1, 20.7)
mm. A real claw would stop. A centred cube sticks out 5 mm in front of the 40 mm tower, so the
closed claw's tips never get inside in a normal delivery.

**The T bars of the corner towers come too late for this robot.** Its claw reaches 82 mm further
ahead than its line sensor (finger tips 167 mm, sensor 85 mm ahead of the axle), but the T bars of
M, A, K and E lie only 56.6 – 60.4 mm before their towers: a robot that stops when its sensor sees
the bar has its claw 21.6 – 25.4 mm inside the tower already. At X the bar lies 130 mm before the
tower, and works (question 6).

**Tower A is within reach of the right line.** A robot with its middle on the right line that faces
right has its claw tips 0.08 mm inside tower A's left support, and a turn on the spot there, between
y 1055 and 1175, sweeps the open claw (radius 171.7 mm) up to 4.8 mm into tower A. On the left the
same moves clear tower M by 28 mm or more. That holds for the simulator's solid 10.5 cm tower
(question 2). The examples turn only where the sweep of the claw stays at least 5 mm clear of every
tower (`samples.test.ts` checks it): the bay examples drive 13 cm up before they turn towards the
right line.

### The referee

| Line | Points | When |
| --- | --- | --- |
| M · school: a red cube | 20 / 0 | at the end: a red cube under M whose letter shows, and no part of the robot touches it |
| A · hospital: a red cube | 20 / 0 | the same |
| K · bakery: a red cube | 20 / 0 | the same |
| E · park: a red cube | 20 / 0 | the same |
| X · hydrant: the yellow cube, as the next delivery | 20 / 0 | at the end: the yellow cube under X whose letter shows, no part of the robot touches it, and X was the robot's next delivery after it took the yellow cube |
| Towers on their picture squares | 0, −4 per tower | at the end, for each tower whose 105 × 40 mm base, where it now stands, no longer touches its picture square: 0 for that tower's line and 4 points off, once per tower. Touching the edge is enough (rules §7.2); a tower pushed off and back counts as on its square |

**Each tower is judged once, at the end**, with the field as it lay at the last moment of the match.
A cube counts for the tower whose letter it shows; a cube of the wrong colour (the yellow one under M,
a red one under X) scores 0, and the sheet says which cube the tower needs. A cube the robot still
holds, or still touches (within 0.5 mm), scores 0: the robot must move clear. Highest score 100, and a
robot can reach it (the advanced example). The total is never below 0.

**A delivery** is the first moment, during one **stay** of a cube in a tower (the time its base
overlaps the space between the two supports without leaving it), at which the letter shows because
of that cube and no part of the robot is within 0.5 mm of it. At most one per stay: touching or
nudging a cube that is already under a tower makes no new delivery; a cube taken out from between
the supports and pushed in again makes one. A cube of the wrong colour makes a delivery too.

**The yellow cube.** The robot has **taken** it at the first moment its claw holds it, or its
middle has left its red square. Whether X is "the next delivery" is decided once, by the first
delivery from that moment on: the yellow cube at X — yes; anything else, the yellow cube under
another tower too — no, for the rest of the match. Deliveries before the robot took the yellow cube
do not matter. While it is still open, the status line above the stage says "The robot took the
yellow cube: X must be its next delivery."

**The sentences.** Every line of the score sheet says why it scores or not ("A red cube is under
tower K and the letter K shows.", "A cube is at the entrance of tower M: push it farther in, inside
the white dashed square.", "A cube went in from the back of tower X. Tower X opens to the top: a cube
counts only when it goes in from there.", "The yellow cube is under X, but X was not the robot's next
delivery after it took the yellow cube: first a red cube went under tower M (0:41.2)."); while the
match runs a line can say "… It counts once the robot has moved clear.", on the closed sheet "… when
the match ended: it does not count." The console says each moment once: the yellow cube taken, a
delivery, the yellow cube no longer able to score, a cube in from the back, a tower off its picture
square. The summary of the closed sheet reads, for example, "20 / 100 points · 1 of 5 deliveries".

**The end.** The match ends at 180 s, with "Finished", or when the program has ended and the robot
stands still (as in the other mBot2 games: a convention of the simulator, not a rule). It does not
end early when all five letters show: the robot must still move clear. There is **no Restart
button**: the rules name no restarts, and the Rules window says "The rules say nothing about
restarts." The rules give no rule about how many runs a team has; the simulator plays one.

### The examples, as measured

Six examples in `src/simulator/fire-fighter/samples.ts`, measured by `samples.test.ts` on the vector
mat and on the picture the browser reads (the same on both). All drive by distance ("move forward …
cm", "turn … °", 50 RPM), but the line follower. In every one no tower moves by 0.01 mm or more, no
cube moves before the claw takes it, the robot never bumps a tower, and every scoring cube goes in
through its tower's opening and ends within 0.1 mm of the middle of its square. How a cube goes into
a tower is the same at every tower (the my-block **"slide the cube in"** in the intermediate and
advanced examples, written out block by block in the third starter): let go 1 cm before the tower,
back off 5.5 cm, close the claw, forward 6 cm, back 6 cm, open the claw.

| Id | Level | Title | What it does | Points | Deliveries | Ends at |
| --- | --- | --- | --- | --- | --- | --- |
| `fighter-first-grab` | starter | First grab: the yellow cube | drives 18.93 cm, takes the yellow cube, lifts it, the LEDs turn yellow, the screen says "I have the yellow cube" | 0 (it holds the cube at the end) | — | 2.32 s |
| `fighter-line-to-t` | starter | Line follower to the T | drives 11 cm (past the Fire Station picture), follows the Fire Station stem up to the T, 3.14 cm more, takes the yellow cube | 0 | — | 1.54 s, at y 969.36 |
| `fighter-yellow-x` | starter | Yellow cube under the X tower | takes the yellow cube, drives round the hydrant picture and comes down the hydrant line into X | 20 | X 11.67 s | 12.41 s |
| `fighter-left-bay` | intermediate | Two red cubes: park and school | the two red cubes of the left bay to E and M | 40 | E 15.27 s, M 29.46 s | 30.20 s |
| `fighter-right-bay` | intermediate | Two red cubes: bakery and hospital | the two red cubes of the right bay to K and A | 40 | K 14.76 s, A 28.24 s | 28.98 s |
| `fighter-whole-mission` | advanced | The whole Fire Fighter mission | the yellow cube to X first, then the left bay to E and M, the right bay to A and K | **100** | X 11.67, E 25.33, M 39.52, A 55.43, K 68.91 s | 69.65 s |

The "Try"s, measured too: the first starter with 15 cm or 16.25 cm catches nothing (from 16.5 cm it
catches the cube); the line follower moved 10 mm to the side, turned up to 6° (the most the Fire
Station allows where the robot stands), or both, still takes the cube (15 mm to the side works on the
drawing but not on the picture; 20 mm fails on both). Started after only 8 cm, it sees a "T" in the
Fire Station picture and stops at once; from 9 cm it works. The bay examples drive 13 cm up before
they turn: with 10 cm or less the turn on the right line pushes tower A (0.58 mm at 10 cm, 4.0 mm at
8 cm).

**A start that is moved or turned is not made up for** — the examples drive by distance. Tried in
steps of 0.5 mm and 0.1°, each keeps its points only for a start

| Example | left / right | up / down | turned |
| --- | --- | --- | --- |
| `fighter-yellow-x` | 5.0 mm left … 4.5 mm right | 4.5 mm up … 6.5 mm down | 0.5° either way |
| `fighter-left-bay`, `fighter-right-bay` | 4.5 mm either way | 6.5 mm either way | 0.2° either way |
| `fighter-whole-mission` | 4.5 mm either way | 4.5 mm up … 6.5 mm down | 0.2° either way |

and one step further it loses points ("down" stops at 6.5 mm: the Fire Station leaves no more room).
The screen moves the robot in steps of 5 mm and turns it in steps of 1°; one such step:

| Example | 5 mm left | 5 mm right | 5 mm up | 5 mm down | 1° left | 1° right |
| --- | --- | --- | --- | --- | --- | --- |
| `fighter-yellow-x` | 20 | 0 (X pushed 45.0 mm) | 0 | 20 | 0 (X pushed 45.5 mm) | 0 (X pushed 45.5 mm) |
| `fighter-left-bay` | 0 (E pushed) | 20 (M pushed) | 40 | 40 | 0 | 0 (E pushed 3.4 mm) |
| `fighter-right-bay` | 0 (A and K pushed) | 0 | 40 | 40 | 0 (K pushed) | 0 |
| `fighter-whole-mission` | 20 | 20 | 80 (no X) | 100 | 0 | 0 |

**The back-off trap.** In the third starter, backing off exactly 5.0 cm before closing the claw
scores 0: the claw grabs the yellow cube a second time and the robot pulls it out of the tower ("No
cube under tower X."); 5.05 cm scores 20 (the cube sits 0.026 mm deeper than the middle of the claw,
see above; `samples.test.ts` pins it). That is also why "5 mm up" gives 0 for the third starter and
80 for the advanced one. The texts and the notes say "Back off more than 5 cm before you close the
claw". (The design had expected a pinched cube and a claw that stays open; measured, the claw grabs
the cube again, and the tower moved only when the back-off was shortened and the 6 cm push kept.)

Every block is one of the Fire Fighter palette; all six load in the block editor, and a saved
workspace plays the same result. The three starters are open to everyone, the two intermediate ones
need a member code, the advanced one is shown to advanced codes only (`content/simulator-codes.ts`).
On a real robot all of them will drift: a real robot has to find the black lines again on its way
(following the lines on the long legs would make them robust; not done).

### What this simulator assumes

The second part of the **Rules** window, "What this simulator assumes", tells a child or a teacher
what they can notice (`src/simulator/ui/fire-fighter/rules.ts`; `rules.test.ts` checks every number
of every sentence against the game's constants). Its note says that these are choices of the
simulator, not rules, except what the organiser gave: the tower's size and the room between its
sides. The whole list, with the open point of `game.ts` (F1 – F13) and the question below that
would settle it:

| # | What the simulator does | Who decided |
| --- | --- | --- |
| F1 | Tower X opens to the top, towards the hydrant line; M and A open to the top, K and E to the bottom (towards their stems). A cube that goes in from the back does not count, and the sheet and the console say why. (`OPENING`) | **the organiser** ("Up, toward the hydrant line"); the corner towers: the rules ("toward its track") and the map |
| F2 | The two sides of a tower stand 60 mm apart; with the 10.5 cm width they are solid, 22.5 mm thick; a cube in the middle has 5 mm on each side. (`TOWER_GAP`, `SUPPORT_WIDTH`) | **the organiser** ("About 6 cm"); the thickness follows from it, solid sides are our choice (the photos show thin plates: question 2) |
| F3 | A tower is 10 cm high; the flap with the letter is drawn from 7 cm up, and nothing collides with it. The lever a real cube pushes is not simulated: the letter follows the rule above. (`TOWER_HEIGHT`, `FLAP_BOTTOM`) | assumption (question 3) |
| F4 | The letter shows when the whole base of the cube is inside the white dashed square, measured to the outer edge of its dashes; a cube pushed 8 mm or more past the middle towards the back does not show it either. (`LETTER_AREA`) | assumption (question 4) |
| F5 | A claw that holds a cube (66 mm) is too wide for the 60 mm between the sides: the robot lets go and pushes the cube in with the closed claw (36 mm). Opening the claw inside a tower pushes the tower (no motor stalls here). | follows from F2 (the organiser's answer says the same); still asked (question 5) |
| F6 | The claw reaches 8.2 cm further than the line sensor: at M, A, K and E the T bar is so close to the tower that the claw would already be inside the tower when the sensor sees the bar. (`clawAheadOfLineSensor`, `TOWER_STEMS`) | the robot and the map (question 6) |
| F7 | The robot has taken the yellow cube when its claw holds it, or when the middle of the cube has left its red square. (`YELLOW_SQUARE`) | assumption (question 7) |
| F8 | A delivery: a cube under any tower with its letter showing and the robot clear of it — also under the wrong tower, so the yellow cube under K first breaks the yellow rule. Touching or nudging a cube already under a tower is not a new delivery; taking it out and pushing it in again is. | assumption (question 8) |
| F9 | A cube the robot still touches at the end scores 0: "move clear" is read as "no longer touching" (0.5 mm). (`TOUCH_MM`) | assumption (question 9) |
| F10 | A tower that moved but still touches its picture square keeps its 20 points; its letter is judged where it now stands. | the rules (§7.2) (question 10) |
| F11 | The scoring is the rules' "Proposed scoring for organizer review", played as written; no rules file on the site. (`DELIVERY_POINTS`, `MOVED_TOWER_PENALTY`, `MAX_SCORE`) | the rules (question 11) |
| F12 | No restarts, no Restart button. | the rules name none (question 12) |
| F13 | The robot starts inside the Fire Station, at first facing up with its middle on the Fire Station stem; a student may move and turn it inside the Fire Station picture. (`START_POSE`) | assumption (question 13) |
| — | Each cube starts in the middle of its marked square, upright and square to the mat. (`CUBE_HOMES`) | assumption (question 14) |
| — | A support weighs as much as a cube: a robot that bumps a tower slides it. (`TOWER_MASS`) | assumption (question 15) |
| — | A tower can slide but never turns and never falls over; a cube always stands upright (the engine cannot turn or tip things: the rules' "A tower may slide or turn" is half simulated). | the engine |
| — | The match also ends with "Finished", or when the program has ended and the robot stands still. | the simulator, as in the other mBot2 games |
| — | A referee's judgement by eye is not simulated: the simulator measures every cube to the millimetre. | the simulator |

### Questions for the organiser

Each says what the simulator does now; questions 1 and 2 are answered. The list F1 – F13 at the top
of `src/simulator/fire-fighter/game.ts` names the constant behind questions 1 – 13.

1. **Which way does tower X face, and can a cube go in from the back? — Answered by the
   organiser** (F1, `OPENING`): "Up, toward the hydrant line." The cube slides into X from the
   hydrant's black line, so the robot goes round and comes down the hydrant line. A cube pushed in
   from the back — from the yellow square below — does not count: the letter does not show, and the
   sheet and the console say why. That is what the simulator did before the answer; nothing changed.
2. **The space between a tower's two side supports — Answered by the organiser** (F2, `TOWER_GAP`,
   `SUPPORT_WIDTH`): "About 6 cm", as the white square printed on the map. A gripper that holds a
   cube does not fit, so the robot lets go and pushes the cube in — as the simulator already did
   (60 mm, 5 mm of room on each side of the cube). Still open about the tower, if it matters: the
   rules' photos show thin plywood plates, and a cube that almost fills the gap between them, where
   the simulator has solid sides 2.25 cm thick (with the organiser's 10.5 cm). Thin sides would
   change where the robot can turn near tower A ("The tower and the letter" above). And are the
   cube's edges rounded enough to guide it in when it is a little off the middle?
3. **The tower's height** (F3, `TOWER_HEIGHT`): the simulator assumes 10 cm. Is the flap high
   enough for a 7 cm cube, and how low does its lever hang?
4. **When does the letter show?** (F4, `LETTER_AREA`) The white dashed square can be read three
   ways: its inner edge (55.1 × 55.8 mm: 2.5 mm of room across, 2.9 along), its centre line
   (60.0 × 60.7 mm: 5.0 / 5.35) or its outer edge (64.9 × 65.6 mm: 7.47 / 7.82). The simulator takes
   the outer edge, the dashed line included. Which does a referee use? And: a cube pushed past the
   middle, towards the back (8 mm or more) — does the letter still show? The simulator: no.
5. **The robot's gripper and the supports** (F5): a gripper that holds a cube from both sides does
   not fit the 6 cm gap. Is that intended — must the robot push the cube in? (The rules say "Slide
   the cube between the two side supports … Release the cube".) The organiser's answer to question 2
   says the robot lets go and pushes the cube in; whether that is the intended way is still asked.
6. **The T bars at M, A, K and E** (F6): with a claw like the simulator's mBot2 (8.2 cm ahead of the
   line sensor), the claw would be 2.2 – 2.5 cm inside the tower when the sensor reaches the bar.
   Are the bars meant as the place to stop?
7. **"Collect" the yellow cube** (F7): picking it up only, or also pushing it off its square? The
   simulator: either.
8. **What is a delivery?** (F8) The simulator: a cube under any tower with its letter showing and
   the robot no longer touching it — also a cube under the wrong tower (the rules: "A cube at the
   wrong tower must be moved"), so the yellow cube put under K first breaks the yellow rule. Touching
   or nudging a cube that is already under a tower is not a new delivery; taking it out and pushing
   it in again is. Is that how a referee counts "before making another delivery"?
9. **A cube the robot still touches at the end** (F9): the simulator scores it 0 (it reads "move
   clear" as "no longer touching"). Right?
10. **A tower that moved but still touches its picture square, with a correct cube under it**
    (F10): 20 points (the rules: "A correct delivery can still earn all 20 points"). The simulator
    judges the letter where the tower now stands.
11. **The rules file** (F11): may the website publish it on the category page? It says "Proposed
    scoring for organizer review". Until then the Rules window says "The scoring is a proposal the
    organiser has not confirmed yet", and no file is linked.
12. **Restarts** (F12): the rules name none. The simulator has no Restart button.
13. **The start** (F13): anywhere inside the Fire Station tile, facing any way? The simulator puts
    the robot facing up on the black line, and lets a student move it inside the tile.
14. **The cubes' places**: in the middle of each marked square? The yellow cube in the middle of the
    red corner marks (5.6 mm below the middle of its red frame)?
15. **The towers' weight** (`TOWER_MASS`): a robot that bumps a tower makes it slide in the
    simulator. Are the real towers light enough to slide? Fixed to the mat?
16. **The ages**: the rules say 8–10, the Drive folder "8-9 yo"; the site keeps 8–10 (as the
    organiser said earlier).
17. **The map**: the hydrant stem is 3.87 mm right of the middle of tower X (in the simulator a cube
    that follows it has 1.13 mm to spare), and the lower T bar of the right bay lies 2.1 mm over the
    bay picture. Intended?

### What to change, and where

| To change … | Change … |
| --- | --- |
| a measure of the field (a line, a tile, a tower, a cube's square) | its constant in `src/simulator/fire-fighter/field.ts`, with its source; `field.test.ts` compares the print file's numbers. The game, the Zones view, the Rules window and the field list read it from there |
| which way a tower opens | `OPENING` in `field.ts`, one value per tower (F1). The referee and the Rules window follow by themselves; the examples that use that tower must take another route: `samples.test.ts` fails first |
| the room between a tower's sides, or its size | `TOWER_GAP`, `TOWER_WIDTH`, `TOWER_DEPTH` in `field.ts` (`SUPPORT_WIDTH` follows); `TOWER_HEIGHT`, `FLAP_BOTTOM` for the heights. Then measure the examples again (`samples.test.ts`) and the numbers of "The tower and the letter" |
| when the letter shows | `LETTER_AREA` in `field.ts` (F4); the referee's `letterShows()` in `game.ts` |
| a rule the organiser decides | the constant or the referee in `game.ts` (its list F1 – F13 says which), then the sentence in `src/simulator/ui/fire-fighter/rules.ts` — its test compares every number with the constants. Move a sentence from "What this simulator assumes" into the rules part once it is decided, mark it as the organiser's answer, and change the lists here |
| the points, the penalty, the match time | `DELIVERY_POINTS`, `MOVED_TOWER_PENALTY`, `MATCH_DURATION` in `game.ts` (`MAX_SCORE` follows) |
| a sentence of the referee | `game.ts` (`SAY`, the score sheet's lines); `game.test.ts` holds each one |
| a word of the screen | `src/simulator/ui/fire-fighter/words.ts`; the list "The field": `SetupList.tsx` |
| an example | `samples.ts` (and `sample-catalog.ts` for a new id, title or level), `samples.test.ts`, the tables here; the id begins with `fighter-`. Then its group in `content/simulator-codes.ts` and the same lines in `scripts/generate-simulator-codes.mjs`. Do not write the title of an example, or a sentence of its text, anywhere else: the guard (`client-guard.test.ts`) fails. The screens say "tower X", never "the X tower" (a title says that), and never "Two red cubes" or "First grab" |
| the text on the cards that lead to it, the category's name and ages | the `simulator` entry of the category `fire-fighter` in `content/seasons.ts` |
| the rules file, once the organiser allows it | put it in `public/downloads/` and add a `downloads` entry to the category in `content/seasons.ts` ("Rules, scoresheets and other downloads" above); take the sentence "No `downloads`" out of its comment and change the test "Fire Fighter: … no download" in `src/simulator/ui/site-section.test.ts`; the Rules window can then link it (`rulesNoteLink`, as Locker Room's does) |

A game with rigid groups must not put bodies back with a restart or move them with
`RefereeCall.removeBodies` / `restoreBodies`: those move one member of a group alone (the comment
of "Rigid groups" in `core/engine.ts` says so). Fire Fighter has no restarts and removes nothing.

### Known limits of Fire Fighter

- **The scoring is a proposal** (question 11), and many points of the rules are open (the list
  above); every choice is in the second part of the Rules window.
- **The robot is perfect** — no wheel slip, no sensor noise. The examples drive by distance: here
  they score exactly, on a real robot they will drift. Turned 1° at the start, the scoring ones lose
  everything ("The examples, as measured").
- **A tower slides but never turns or tips**, and a cube never tips: the engine moves a pushed thing
  straight. The rules' "A tower may slide or turn" is half simulated.
- **The claw does not stall** against a support: opened inside a tower it pushes the tower, and a
  claw closed around a support drags the tower when the robot turns ("The tower and the letter").
- **The flap is only drawn**: a raised claw would pass through it, and the letter follows the
  rule of "The tower and the letter", not a lever a cube lifts.
- **The sides of a tower are solid**, 2.25 cm thick (the rules' photos show thin plates: question
  2): where the robot can turn near tower A depends on it.
- **The pictures on the mat** are read by the line sensor from the picture in the browser: the
  Fire Station picture has dark spots that read as a line (the line follower drives 11 cm before it
  looks). Most tests read the drawn stand-in, in which a picture is one flat colour; the examples
  are played on the picture too.
- **Not simulated**: a referee's judgement by eye (every cube is measured to the millimetre), the
  rounds and how many runs a team has, the real flap's lever.
- **Not tried on a real phone or Safari**, nor with a screen reader: the page was checked in
  Chromium only, at 1440 and 390 px wide.

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

One redirect is of this site's own: the Locker Room rules v2.3,
`/downloads/capelli-starter-locker-room-rules-v2.3.pdf`, go to the organiser's newer rules that
replaced them, `/downloads/capelli-starter-locker-room-rules.pdf`.

When Fire Rescue was split into Fire Rescue Junior and Fire Rescue Senior, three more came (see
"The Fire Rescue simulators"):

| Old path | New path |
| --- | --- |
| `/simulator/fire-rescue` | `/simulator/fire-rescue-senior` (the same game, with everything drawn) |
| `/training/simulator/fire-rescue` | `/simulator/fire-rescue-senior` (straight there, no chain of two redirects) |
| `/season/2027/fire-rescue` | `/season/2027` (it lists both new categories) |

An old address written with a slash at the end takes one step more: `/simulator/fire-rescue/`
goes to `/simulator/fire-rescue` and then to `/simulator/fire-rescue-senior` (and
`/season/2027/fire-rescue/` likewise). The first step is Next.js's own permanent redirect, which
takes the slash off every address of the site and is checked before the redirects of
`next.config.mjs` (`node_modules/next/dist/lib/load-custom-routes.js` puts it first), so no
redirect of ours can make it one step. Only switching that rule off for the whole site
(`skipTrailingSlashRedirect`) could, and this site does not do that. Browsers and search engines
follow both steps, and the query string is kept. It was always so for the other old addresses
too (`/training/simulator/fire-rescue/`, `/national/`).

The other simulator pages under `/training/simulator` are described in "The Simulator page".

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
- **2026 event photos** — the ranking cards are in, but the 1,514 unsorted competition
  photographs on the Drive are not. See "Still not imported" above.
- **Ranking-card captions** — each 2026 gallery has a `captions.json` describing the division
  and age band. Edit it to add winner names, which become the alt text.
- **The Fire Chief category text — to confirm.** `content/seasons.ts` introduced Fire Chief as
  "Two robots. One operation. Command the whole response." on the platform "mBot2 + vision":
  the teaser from before the draft rules. The draft rules of the category describe one robot
  in a maze that changes, with a fan and a sensor that finds the fire, and no camera — and the
  category page shows the simulator, which plays exactly that, right under the teaser. So the
  teaser now reads "One robot, on its own. A maze that can change between rounds. Find the
  fire." on the platform "mBot2", and the introduction of the 2027 season ends "… to a robot
  that finds the fire on its own, in a maze that can change between rounds" instead of "… to a
  coordinated two-robot rescue operation". These three wordings are not the organiser's own.
  The summary and the introduction say only what the draft rules say. The platform does not
  come from the draft, which names no robot: "mBot2" is what is left of "mBot2 + vision" and
  the robot the simulator plays this category with — it is to be confirmed like the rest. Ask
  the organiser, then replace them (`summary`, `platform`, and `intro` of the 2027 season)
  with the organiser's words — or put the old ones back.
- **The Fire Rescue Junior and Senior texts — to confirm.** The organiser gave the names, the
  ages and what is drawn. The two teasers in `content/seasons.ts` are not their words: Junior "Only
  the water buckets are drawn. Everything else stands where the rule book shows it."; Senior
  "Everything is drawn: the buckets, the people and where they stand." followed by the old Fire
  Rescue teaser "Nothing goes as planned. Sense the situation, decide, adapt.". The 2027
  introduction now says "five ways to answer the call" (it said "four ways", one per category),
  and the homepage block "Five ways to answer the call". Ask the organiser, then replace them.
  Two questions came up in review, to ask at the same time:
  1. **"The rule book".** Junior's teaser says "Everything else stands where the rule book shows
     it", on the homepage right under "Missions, fields and rules will be revealed soon", and the
     category pages link no rules file. Our assumption (the simulator plays it, and its Rules
     window says it): "everything else at its place" means where the Fire Rescue rules the
     simulator follows draw it — every person in square 1 of its building, red at A, blue at B,
     yellow at C, green at D. Is that the 2027 arrangement, and may the page name the rule book
     before it is published — or should the teaser say it without naming it?
  2. **"Drawn".** Both teasers say what is "drawn" (by lot, by the referee). A student who reads
     English as a second language may read "drawn with a pencil". The organiser's own word was
     "randomised". Which word should the teasers use?
- **Training tracks** — four of the seven are marked `coming-soon`. Write the content, then
  change `status` to `available` and add an `href` in `content/seasons.ts`. (A track can also
  set `cta` to change the wording of its link — the simulator's card says "Open the simulator"
  instead of "Open training".)

---

## Project layout

```
content/            All editable text and data
  site.ts           Contact details, nav, org info
  seasons.ts        Seasons, categories, downloads, events, training
  standalone.ts     Categories of their own, outside the seasons (Robot en fête 2027, in French)
  simulator-codes.ts  Member codes for the simulator examples (fingerprints only)
public/
  gallery/          Competition photos, by year and category
  downloads/        Rules, scoresheets, STL archives
  simulator/        Pictures of the six mats, for the simulators (Fire Rescue Junior and Senior share one)
scripts/
  fetch-legacy-assets.mjs
  generate-simulator-codes.mjs   Makes new member codes for the simulator
src/
  app/              Pages and routing
  components/       Header, Footer, Gallery, shared UI
  lib/gallery.ts    Reads the photo folders
  simulator/        The simulators: Fire Rescue Junior and Senior, Fire Chief, Warehouse Sort, Robot en fête 2027 (Warehouse Sort in French), Locker Room, Fire Fighter (mBot2) and Fire Cadet (mTiny) (see their sections above)
```
