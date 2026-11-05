// Run imgly ("medium" is the highest-quality model it ships) per raw image, save its RGBA for refinement.
import fs from 'node:fs'; import sharp from 'sharp';
import {removeBackground} from '@imgly/background-removal-node';
const items = JSON.parse(fs.readFileSync('items.json'));
const only = process.argv.slice(2);
for (const it of items) {
  if (only.length && !only.includes(it.id)) continue;
  const out = `../assets/masks/${it.id}.png`;
  if (fs.existsSync(out) && !only.length) continue;
  const t=Date.now();
  // imgly sniffs the type from the blob, so hand it a typed PNG
  const png = await sharp(it.raw).flatten({background:'#f5f5f5'}).removeAlpha().png().toBuffer();
  const res = await removeBackground(new Blob([png],{type:'image/png'}),{model:'medium',output:{format:'image/png',quality:1}});
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(it.id,Date.now()-t,'ms');
}
