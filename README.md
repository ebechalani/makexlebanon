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
| `npm run test:sim` | Runs the simulator's own tests — see "The Fire Rescue simulator" below |

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

## The Fire Rescue simulator

A browser simulator of the Makeblock mBot2 for the 2027 **Fire Rescue** category (ages 11–13).
The student builds a program with mBlock-style blocks and watches the robot run it on the
competition mat, on any starting combination the referee could draw, scored by the category
rules. It lives at:

```
https://www.makexlebanon.com/training/simulator/fire-rescue
```

(`/training/simulator` on its own leads to the same page.) Nothing is installed, and the
student's blocks are saved in their own browser — they are never sent anywhere. The one thing
the simulator asks the website's server for is the ready-made examples: the server decides,
visitor by visitor, which of them to show and to open. See "Member codes for the simulator
examples" below.

Visitors reach it from the **Training** menu, the Training page, the Fire Rescue category page
and the Season 2027 block on the homepage; the Season 2027 page marks the category with an
"Online simulator" label. All of that comes from the content files: the `simulator` entry on
the Fire Rescue category and the training track in `content/seasons.ts`, and the menu in
`content/site.ts`. Remove those entries and the links disappear; the simulator page itself
stays.

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

| Folder | What is in it |
| --- | --- |
| `src/simulator/core/` | The physics: the robot, its motors and sensors, collisions, the match clock |
| `src/simulator/vm/` | The interpreter that runs a block program, one block at a time |
| `src/simulator/blocks/` | The block language: every block, its colour and its place in the palette |
| `src/simulator/fire-rescue/` | Everything specific to this category: the mat, the combinations, the referee, the example programs |
| `src/simulator/members/` | The codes (member codes and advanced codes): what a code looks like, its fingerprint, and the check the server makes |
| `src/app/api/simulator/unlock/` | The address on the website that checks a code and hands out the examples a visitor may see |
| `src/simulator/ui/` | What you see: the screen, its buttons and panels, the drawing of the mat, and its stylesheet (`simulator.css`) |
| `src/app/training/simulator/` | The page itself: its address, title and description |
| `public/simulator/fire-rescue/` | The two pictures of the mat: `mat.webp` is the one shown, `mat-sensor.webp` is the one the line sensor reads |
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
| The short rules behind the **Rules** button | `src/simulator/ui/fire-rescue/rules.ts` |
| What the ruler says ("32.5 cm, then 90° right, …", "Click the mat to set the first point"), and how close a click must be to a point of the ruler (`RULER_REACH`) | `src/simulator/ui/ruler.ts` |
| The measurements of the robot | `src/simulator/core/robot.ts` |
| The text on the cards that lead to the simulator | `content/seasons.ts` |

The scoring file and the short rules are two separate things: the first one decides the points,
the second is only the summary students read. Change both when a rule changes.

### Member codes for the simulator examples

The simulator's **Examples** window holds seven ready-made programs. They are in three
groups, and there are two kinds of codes:

| Group | Now in it | Who sees the card | Who can open it |
| --- | --- | --- | --- |
| **Open to everyone** | the three starter examples | everybody | everybody, without a code |
| **For members** | the two intermediate examples | everybody — with a lock and "Members only" | a **member code** or an advanced code |
| **For advanced codes only** | the two advanced examples | nobody else | an **advanced code** |

So there are three kinds of visitor:

- **No code.** Three open cards, two locked ones. Nothing else.
- **A member code** (one of the 500 you already have). Five open cards. Nothing else.
- **An advanced code.** All seven cards, under the headings Starter, Intermediate and Advanced.

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

- **A member who gets an advanced code later** presses **Use a different code** in the same
  window and types the new one. Nothing has to be forgotten first. If the new code is
  accepted it takes the place of the old one; if it is not — a typing mistake — everything
  stays as it was.
- **"Forget this code on this device"**, in the same window, removes the code from the
  browser — useful on a shared computer.

#### What you change, and where

Everything you decide is in one file, **`content/simulator-codes.ts`**. It has four parts, in
this order, each with its own explanation:

1. `examplesOpenToEveryone` — the examples that need no code
2. `examplesForAdvancedCodesOnly` — the examples only an advanced code shows
3. `simulatorCodes` — the member codes (a long list)
4. `advancedSimulatorCodes` — the advanced codes (at the very end of the file)

After any change: save, commit and push. The change is live once Vercel has redeployed.

**Moving an example between the three groups.** Every example has an id; the seven ids are
listed at the top of the file (`'hello'`, `'line-follow'`, `'gripper-demo'`, `'one-bucket'`,
`'one-person'`, `'smart-bucket'`, `'full-mission'`). An example is in a group because of the
list its id is on:

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
misspelt id on **list 2** would hide nothing — the example you meant to hide would be shown
to everybody — so the website refuses to be built with one: Vercel reports a **failed build**,
its log names the line, and the website stays exactly as it was until you correct the line
and push again.

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

**Never commit the plain codes.** `content/simulator-codes.ts` holds only *fingerprints*: rows
of letters and digits worked out from the codes, from which a code cannot be read back. The
CSV files are the only place where the codes themselves exist. Keep them somewhere private,
keep a copy of them, and never put them in this folder, in a commit or in an issue — this
repository is public. (As a safety net, `.gitignore` leaves out any `.csv` file with "codes"
in its name.)

#### What the lock does not do

The honest limits:

- **The repository is public on GitHub.** Anyone who looks there can read every example
  program in `src/simulator/fire-rescue/samples.ts` — the advanced ones too — and can read in
  `content/simulator-codes.ts` which examples are kept for advanced codes. The lock and the
  hiding keep the examples out of the *website*, not out of GitHub. If that ever matters, the
  repository has to be made private.
- **Somebody with a code can pass things on**: the code itself, or a loaded example saved as a
  file (the **Save** button), which anyone can open with **Open**. One code per person keeps
  this in check — when a code gets around, cancel that one code. Give advanced codes only to
  people you trust with the advanced programs.
- **A shared computer remembers.** Once somebody has typed a code in a browser, the examples
  stay open — the advanced ones too, if it was an advanced code — for everybody who uses that
  browser on that computer afterwards, until somebody presses "Forget this code on this
  device", or you cancel the code. On school computers, ask people to press it when they are
  done.
- **Forgetting a code does not empty the workspace.** A program that was loaded stays in the
  blocks — and is saved in that browser — until somebody presses **New** or loads something
  else. That goes for an advanced example as well.
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
  second later at most. A few typing mistakes never get near the limit.

### Run its tests after every change

```bash
npm run test:sim
```

It runs more than four hundred checks; among them, every example program is played on the
real engine with the real referee and its score is compared. They also check
`content/simulator-codes.ts` (a misspelt example id, an example that is on both lists, a
damaged line, a code that is on both lists of codes) and that nothing about an example —
not even a title — can slip back into what every visitor's browser downloads. It takes
around fifteen seconds and must end with `fail 0`. If it does not, do not deploy — a failing
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
- **2026 event photos** — the ranking cards are in, but the 1,514 unsorted competition
  photographs on the Drive are not. See "Still not imported" above.
- **Ranking-card captions** — each 2026 gallery has a `captions.json` describing the division
  and age band. Edit it to add winner names, which become the alt text.
- **Training tracks** — four of the six are marked `coming-soon`. Write the content, then
  change `status` to `available` and add an `href` in `content/seasons.ts`. (A track can also
  set `cta` to change the wording of its link — the simulator's card says "Open the simulator"
  instead of "Open training".)

---

## Project layout

```
content/            All editable text and data
  site.ts           Contact details, nav, org info
  seasons.ts        Seasons, categories, downloads, events, training
  simulator-codes.ts  Member codes for the simulator examples (fingerprints only)
public/
  gallery/          Competition photos, by year and category
  downloads/        Rules, scoresheets, STL archives
  simulator/        Pictures of the Fire Rescue mat, for the simulator
scripts/
  fetch-legacy-assets.mjs
  generate-simulator-codes.mjs   Makes new member codes for the simulator
src/
  app/              Pages and routing
  components/       Header, Footer, Gallery, shared UI
  lib/gallery.ts    Reads the photo folders
  simulator/        The Fire Rescue simulator (see its own section above)
```
