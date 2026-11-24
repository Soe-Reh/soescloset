// Crops the top of every hoodie (the hood) to a small webp, so the Hood chapter decodes 600x450 images, not 1600x1600.
import {createRequire} from 'module';import fs from 'fs';
const sharp=createRequire(new URL('../pipeline/package.json',import.meta.url))('sharp');
const dir=new URL('../site/',import.meta.url).pathname,G=JSON.parse(fs.readFileSync(dir+'data.json'));
for(const g of G){
  // Same window the CSS used: a third of the canvas wide, centred, from 4% of the height down.
  const left=Math.round(1600/3),top=Math.round(1600*.04),w=Math.round(1600/3),h=Math.round(w*.75);
  await sharp(dir+g.image).extract({left,top,width:w,height:h}).resize(800).webp({quality:90}).toFile(dir+`img/${g.id}-hood.webp`);
}
console.log('hood crops',G.length);
