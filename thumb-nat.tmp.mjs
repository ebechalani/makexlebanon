import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const SRC = 'G:/My Drive/HDD Eddy 2015-2026/MakeX/4.National competition 2026/Photos MakeX National 2026/101NCZ_8_shareable';
const OUT = 'C:/Users/PC/AppData/Local/Temp/claude/C--Users-PC-Documents-GitHub-makexlebanon/d35af81b-ba56-4ed9-aa0e-1ee19f3043a8/scratchpad/nat2026';
await fs.mkdir(OUT, { recursive: true });
const files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const map = {};
let done = 0, skip = 0, fail = 0;
for (const [i, f] of files.entries()) {
  const id = 'n-' + String(i).padStart(4, '0');
  map[id] = f;
  const out = path.join(OUT, id + '.webp');
  try { await fs.access(out); skip++; continue; } catch {}
  try {
    await sharp(path.join(SRC, f)).rotate().resize({ width: 300 }).webp({ quality: 55 }).toFile(out);
    done++;
  } catch (e) { fail++; console.log('fail', f, e.message); }
  if ((done + skip) % 100 === 0) console.log(done + skip, '/', files.length);
}
await fs.writeFile(path.join(OUT, 'map.json'), JSON.stringify(map));
console.log('DONE new=' + done + ' skip=' + skip + ' fail=' + fail + ' total=' + files.length);
