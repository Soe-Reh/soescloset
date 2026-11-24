// Films every v5 room at laptop and phone size and builds one contact sheet per size.
// Run: node tools/shoot-v5.mjs [outDir]   (site-v5 served on 127.0.0.1:8790)
import {createRequire} from 'module';import fs from 'fs';import path from 'path';
const {chromium}=createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const out=process.argv[2]||new URL('../research/v5/shots/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:8790/';
const rooms=['','#/walk','#/wall','#/hood','#/average','#/price','#/splice','#/index'];
const b=await chromium.launch();
for(const [tag,o] of [['d',{viewport:{width:1440,height:900}}],['p',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){
  const pg=await (await b.newContext(o)).newPage(),errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  const files=[];
  for(const r of rooms){await pg.goto(base+r);await pg.waitForTimeout(2600);const f=path.join(out,`${tag}-${(r.replace('#/','')||'home')}.jpg`);await pg.screenshot({path:f,type:'jpeg',quality:55});files.push(f)}
  const sw=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const [w,h,c]=tag==='d'?[480,300,4]:[200,433,8];
  const html=`<body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(${c},${w}px);gap:6px;font:13px sans-serif">${files.map(f=>`<div><img src="data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}" style="width:${w}px;height:${h}px;object-fit:cover;object-position:top;display:block">${path.basename(f)}</div>`).join('')}</body>`;
  const sp=await b.newPage({viewport:{width:c*(w+6),height:300}});await sp.setContent(html);await sp.screenshot({path:path.join(out,`sheet-${tag}.jpg`),fullPage:true,type:'jpeg',quality:70});await sp.close();
  console.log(tag,'sideways scroll',sw,'errors',errs.slice(0,5));
}
await b.close();
