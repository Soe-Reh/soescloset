// Thumbnail sheets of candidates so a human/agent can eyeball which shots are garment-alone.
import fs from 'node:fs'; import {createRequire} from 'node:module';
const {chromium} = createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const cand = JSON.parse(fs.readFileSync('candidates.json'));
fs.mkdirSync('sheets',{recursive:true});
const b = await chromium.launch(); const pg = await b.newPage({viewport:{width:1500,height:1000}});
for (const [store,list] of Object.entries(cand)) {
  if(!list.length || (process.argv[2] && process.argv[2]!==store)) continue;
  const html = `<body style="margin:6px;font:10px Helvetica;background:#fff;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px">`+list.slice(0,60).map((p,i)=>`<div><div style="white-space:nowrap;overflow:hidden">${i}: ${p.title} $${p.price}</div><div style="display:flex;gap:2px">`+p.images.slice(0,6).map((u,k)=>`<div style="position:relative"><img loading=eager src="${u}${u.includes('?')?'&':'?'}width=160" style="width:110px;height:130px;object-fit:contain;background:#ddd;display:block"><b style="position:absolute;left:1px;top:0;color:#f00">${k}</b></div>`).join('')+`</div></div>`).join('');
  await pg.setContent(html,{waitUntil:'networkidle',timeout:90000}).catch(e=>console.log(store,e.message));
  await pg.screenshot({path:`sheets/${store}.png`,fullPage:true});
  console.log(store);
}
await b.close();
