import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const SP='C:/Users/PC/AppData/Local/Temp/claude/C--Users-PC-Documents-GitHub-makexlebanon/d35af81b-ba56-4ed9-aa0e-1ee19f3043a8/scratchpad/nat2026';
const SRC='G:/My Drive/HDD Eddy 2015-2026/MakeX/4.National competition 2026/Photos MakeX National 2026/101NCZ_8_shareable';
const map=JSON.parse(await fs.readFile(SP+'/map.json','utf8'));
const cats=JSON.parse(await fs.readFile(SP+'/cats.json','utf8'));
const ids=Object.keys(map).sort();
const perCat={};
for(const id of ids){
  const cat=cats[id];
  if(!cat||cat==='skip')continue;
  (perCat[cat]??=[]).push(id);
}
let done=0,skip=0,fail=0;
for(const [cat,list] of Object.entries(perCat)){
  const dir=path.join('public/gallery/2026',cat);
  await fs.mkdir(dir,{recursive:true});
  const prefix=cat==='event'?'photo':'event';
  for(const [i,id] of list.entries()){
    const out=path.join(dir,`${prefix}-${String(i+1).padStart(3,'0')}.webp`);
    try{await fs.access(out);skip++;continue;}catch{}
    try{
      const buf=await sharp(path.join(SRC,map[id])).rotate()
        .resize({width:1600,withoutEnlargement:true}).webp({quality:80}).toBuffer();
      await fs.writeFile(out,buf);done++;
    }catch(e){fail++;}
    if((done+skip)%100===0)console.log(done+skip,'imported');
  }
}
console.log('DONE imported='+done+' skipped='+skip+' failed='+fail);
