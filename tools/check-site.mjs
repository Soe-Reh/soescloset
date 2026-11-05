// Health of every room at 1440 and 390. Exits non-zero on any failure. Behaviour lives in tools/use-site.mjs. Optional: --shots <dir> writes one still per room.
// Serve first: python3 -m http.server 8741 --directory site
import {createRequire} from 'module';
const {chromium}=createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const base='http://localhost:8741/',ROOMS=['#/','#/walk','#/wall','#/hood','#/average','#/price','#/splice','#/index'];
const shotsAt=process.argv.indexOf('--shots'),shots=shotsAt>0?process.argv[shotsAt+1]:null;
const fails=[],check=(ok,msg)=>{if(!ok){fails.push(msg);console.log('FAIL',msg)}};
await fetch(base).catch(()=>{throw new Error('nothing on '+base+', start the server first')});
const data=await (await fetch(base+'data.json')).json();

const b=await chromium.launch();
async function open(opts,prep){
  const c=await b.newContext(opts),pg=await c.newPage(),errs=[];
  pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
  pg.on('console',m=>m.type()==='error'&&errs.push('console: '+m.text()));
  pg.on('requestfailed',r=>{if(/SOCKET_NOT_CONNECTED|CONNECTION_RESET/.test(r.failure()?.errorText))errs.socket=true;errs.push('request failed: '+r.url())});
  pg.on('response',r=>r.status()>=400&&errs.push(r.status()+': '+r.url()));
  if(prep)await prep(pg);
  return {c,pg,errs};
}
const inspect=pg=>pg.evaluate(async()=>{
  document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');
  await new Promise(r=>setTimeout(r,500));
  const imgs=[...document.images],root=document.documentElement;
  return {
    over:root.scrollWidth-innerWidth,pageH:root.scrollHeight-innerHeight,
    broken:imgs.filter(i=>i.complete&&!i.naturalWidth&&i.src).map(i=>i.src),
    noAlt:imgs.filter(i=>!i.hasAttribute('alt')).map(i=>i.src),
    room:soescloset.room,
    current:document.querySelector('#nav [aria-current=page]')?.textContent.trim()||null,
    navOver:Math.max(...[...document.querySelectorAll('#chrome a')].map(a=>a.getBoundingClientRect().right))-innerWidth,
    garments:[...document.querySelectorAll('.g')].filter(g=>getComputedStyle(g).visibility==='visible').length,
    styled:getComputedStyle(document.getElementById('stage')).position==='fixed',
  };
});
const NAV={'#/walk':'Walk','#/wall':'Wall','#/hood':'Hood','#/average':'Average','#/price':'Price','#/splice':'Compare','#/index':'Index'};

for(const [w,h,tag] of [[1440,900,'1440'],[390,844,'390']]){
  const opts={viewport:{width:w,height:h},...(w<500?{deviceScaleFactor:2,isMobile:true,hasTouch:true}:{})};
  // First paint on a cold load: nonois shows seconds of blank colour, we must not.
  {
    const {c,pg}=await open(opts);
    await pg.goto(base,{waitUntil:'commit'});
    await pg.waitForFunction(()=>performance.getEntriesByType('paint').length>=2);
    const fcp=await pg.evaluate(()=>performance.getEntriesByName('first-contentful-paint')[0].startTime);
    console.log(tag,'first contentful paint',Math.round(fcp)+'ms');
    check(fcp<600,`${tag}: first paint ${Math.round(fcp)}ms`);
    await c.close();
  }
  for(const room of ROOMS){
    let {c,pg,errs}=await open(opts);
    const load=async()=>{await pg.goto(base+room);await pg.waitForFunction(()=>window.soescloset?.ready,null,{timeout:6000}).catch(()=>{});await pg.waitForTimeout(room==='#/'?1900:900)};
    await load();
    // shortcut: http.server's listen backlog of 5 occasionally resets a connection in a burst; that is the dev server, so such a load gets retried.
    for(let n=0;n<3&&errs.socket;n++){await c.close();await new Promise(r=>setTimeout(r,500));({c,pg,errs}=await open(opts));await load()}
    const r=await inspect(pg),at=`${tag} ${room}`;
    check(r.styled,`${at}: page is unstyled`);
    check(!errs.length,`${at}: ${errs.join(' | ')}`);
    check(r.over<=0,`${at}: horizontal overflow ${r.over}px`);
    check(r.navOver<=0,`${at}: nav runs off the screen by ${r.navOver}px`);
    check(!r.broken.length,`${at}: broken ${r.broken}`);
    check(!r.noAlt.length,`${at}: no alt ${r.noAlt}`);
    check(r.room===(room.slice(2)||'cover'),`${at}: landed in ${r.room}`);
    check(r.current===(NAV[room]||null),`${at}: nav marks ${r.current}`);
    if(room==='#/index')check(r.pageH>0,`${at}: index should scroll`);
    else{check(r.pageH<=0,`${at}: page scrolls ${r.pageH}px`);check(r.garments>0,`${at}: no garment on stage`)}
    if(shots)await pg.screenshot({path:`${shots}/${tag}-${room.slice(2)||'cover'}.png`});
    await c.close();
  }
}

// Values on screen come from data.json.
{
  const {c,pg,errs}=await open({viewport:{width:1440,height:900}});
  const prices=data.map(d=>+d.price),sh=data.map(d=>d.shoulder_width_ratio);
  await pg.goto(base+'#/price');await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(700);
  const t=+(await pg.textContent('#run')).replace(/[$,]/g,'');check(t===Math.min(...prices),`price room opens on the cheapest, read ${t}`);
  await pg.keyboard.press('End');await pg.waitForTimeout(1600);
  check((await pg.textContent('#nGap')).includes('$'+Math.max(...prices).toLocaleString('en-US')),'price room ends on the dearest');
  await pg.goto(base+'#/average');await pg.reload();await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(500);
  await pg.keyboard.press('End');await pg.waitForTimeout(1400);
  check(await pg.textContent('#ea')===Math.max(...sh).toFixed(3).slice(1),'wide shoulder from data');
  check(await pg.textContent('#eb')===Math.min(...sh).toFixed(3).slice(1),'narrow shoulder from data');
  await pg.goto(base+'#/splice');await pg.reload();await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(900);
  const before=await pg.textContent('#pb');await pg.click('#pickB button:nth-child(3)');
  check(await pg.textContent('#pb')!==before,'picker changes the right piece');
  await pg.mouse.move(300,500);await pg.waitForTimeout(900);
  const sx=await pg.evaluate(()=>new DOMMatrix(getComputedStyle(document.getElementById('seam')).transform).m41);check(Math.abs(sx-300)<8,'seam follows the pointer, at '+sx);
  check(!errs.length,'data run: '+errs.join(' | '));
  await c.close();
}
// Reduced motion: everything still reachable, no travelling.
{
  const {c,pg,errs}=await open({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await pg.goto(base+'#/hood');await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(400);
  const a=await pg.evaluate(()=>document.querySelector('.g').style.transform);await pg.waitForTimeout(300);
  check(a===await pg.evaluate(()=>document.querySelector('.g').style.transform),'reduced motion holds still');
  await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(120);
  check(await pg.evaluate(()=>Math.abs(document.querySelector('.mover.on').scrollLeft/soescloset.G.length)>0),'reduced motion still steps, at once');
  check(!errs.length,'reduced run: '+errs.join(' | '));
  await c.close();
}
// A part that throws must not stop the others (console errors are expected here).
{
  const {c,pg}=await open({viewport:{width:1440,height:900}},pg=>pg.route('**/parts/wall.js',r=>r.fulfill({contentType:'text/javascript',body:'throw new Error("boom")'})));
  await pg.goto(base+'#/average');await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(900);
  const r=await inspect(pg);
  check(r.room==='average'&&r.garments>0,'average still arrives when wall throws');
  await pg.goto(base+'#/wall');await pg.waitForTimeout(600);
  check(await pg.evaluate(()=>soescloset.room==='average'||location.hash==='#/'),'a room whose part failed falls back');
  await c.close();
}
// Items removed from, or cheap items added to, data.json: no crash, and a $30 piece stays legible.
{
  const {c,pg,errs}=await open({viewport:{width:1440,height:900}},pg=>pg.route('**/data.json',async r=>{
    const d=await (await r.fetch()).json();
    const kept=d.filter(g=>g.id!=='madhappy-cabernet'&&g.brand!=='Loewe');
    kept[0]={...kept[0],id:'cheap',brand:'Staple',price:'29.90',name:'Staple Hoodie - Grey'};
    await r.fulfill({json:kept});
  }));
  await pg.goto(base+'#/price');await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(1200);
  const piece=await pg.evaluate(()=>{const i=soescloset.G.findIndex(g=>g.id==='cheap');return soescloset.live[i].c/innerHeight});
  check(piece>.2,'cheapest piece stays legible at price, canvas '+piece.toFixed(2)+' of viewport height');
  check(!errs.length,'edited data run: '+errs.join(' | '));
  await c.close();
}
await b.close();
if(fails.length){console.log(fails.length+' failed');process.exit(1)}
console.log('check-site ok');
