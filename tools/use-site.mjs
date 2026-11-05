// Uses the site the way a shopper does, at 1440 with a mouse and 390 with touch. Exits non-zero on any failure.
// Serve first: python3 -m http.server 8741 --directory site
import {createRequire} from 'module';
const {chromium}=createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const base='http://localhost:8741/';
const fails=[],check=(ok,msg)=>{console.log(ok?'ok  ':'FAIL',msg);if(!ok)fails.push(msg)};
await fetch(base).catch(()=>{throw new Error('nothing on '+base+', start the server first')});
const data=await (await fetch(base+'data.json')).json();

const b=await chromium.launch();
async function page(opts){
  const c=await b.newContext(opts),pg=await c.newPage(),errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  return {c,pg,errs};
}
const go=async(pg,h,wait=900)=>{await pg.goto(base+h);await pg.reload();await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(wait)};
const x=pg=>pg.evaluate(()=>document.querySelector('.mover.on')?.scrollLeft??-1);
const stop=pg=>pg.evaluate(()=>{const m=document.querySelector('.mover.on');return +m.closest('#stage').querySelector('.pos.on b').textContent.split('/')[0]-1});
const settled=async pg=>{let a=await x(pg);for(let i=0;i<40;i++){await pg.waitForTimeout(120);const n=await x(pg);if(n===a&&!(await pg.evaluate(()=>document.querySelector('.mover.on')?.classList.contains('free'))))return n;a=n}return a};
const pvOpen=pg=>pg.evaluate(()=>document.getElementById('pv').open);
const hash=pg=>pg.evaluate(()=>location.hash);
// On the rack the open piece, not whichever closed one comes first: clicking those moves the rail, which has its own test.
const garmentAt=pg=>pg.evaluate(()=>{const S=soescloset,P=S.room==='walk'?S.live[Math.round(S.T)]:S.live.filter(p=>p.o>.5&&Math.abs(p.x-S.w/2)<S.w*.4)[0];return P?[Math.round(P.x),Math.round(P.y+P.c*.3)]:null});

// ---- Desktop: wheel, drag, keys
{
  const {c,pg,errs}=await page({viewport:{width:1440,height:900}});
  for(const room of ['walk','hood']){
    await go(pg,'#/'+room);
    await pg.mouse.move(720,450);
    await pg.mouse.wheel(0,100);const w=await settled(pg);
    check(w>0&&await stop(pg)===1,`${room}: one wheel notch moves one stop (x ${w})`);
    await pg.mouse.wheel(0,-100);await settled(pg);
    check(await stop(pg)===0,`${room}: wheel back returns`);
    await pg.mouse.wheel(120,0);await settled(pg);
    check(await stop(pg)===1,`${room}: sideways wheel moves too`);
    await pg.keyboard.press('ArrowRight');await settled(pg);
    check(await stop(pg)===2,`${room}: arrow right with nothing focused`);
    await pg.keyboard.press('ArrowLeft');await settled(pg);
    check(await stop(pg)===1,`${room}: arrow left`);
    await pg.keyboard.press('End');await settled(pg);
    const last=await pg.evaluate(()=>+document.querySelector('.pos.on b').textContent.split('/')[1]-1);
    check(await stop(pg)===last,`${room}: End reaches the last piece`);
    check(await pg.evaluate(()=>/\S/.test(document.querySelector('.pos.on .nx').textContent)),`${room}: the last stop offers the next room`);
    await pg.keyboard.press('Home');await settled(pg);
    // Drag: 1:1 under the pointer, then a throw settles on a stop.
    const x0=await x(pg);
    await pg.mouse.move(900,300);await pg.mouse.down();await pg.mouse.move(860,300,{steps:2});await pg.mouse.move(800,300,{steps:3});
    const mid=await x(pg);
    check(Math.abs(mid-x0-100)<3,`${room}: drag is 1:1 (${mid-x0}px for 100px)`);
    await pg.mouse.move(500,300,{steps:4});await pg.mouse.up();
    const end=await settled(pg);
    const onStop=await pg.evaluate(()=>{const m=document.querySelector('.mover.on'),p=m.querySelector('.slot').offsetWidth,t=m.scrollLeft/p;return Math.abs(t-Math.round(t))<.01});
    check(await stop(pg)>=1&&end>x0&&onStop,`${room}: drag settles exactly on a stop (${await stop(pg)})`);
    check(!await pvOpen(pg),`${room}: a drag never opens a piece`);
    check(await pg.evaluate(()=>getComputedStyle(document.querySelector('.pos.on')).visibility==='visible'),`${room}: position is visible`);
    check((await pg.evaluate(()=>scrollY))===0,`${room}: the page did not scroll`);
  }

  // ---- The rack: closed pieces turn to the pointer, a throw runs on, the ring and the rail agree.
  await go(pg,'#/walk');
  const facing=i=>pg.evaluate(i=>Math.abs(soescloset.G[i].yaw),i);
  check(await facing(0)<2&&await facing(3)>50,'walk: the open piece faces you, the rest stand edge-on');
  const closed=await pg.evaluate(()=>{const S=soescloset,P=S.live[4];return [Math.round(P.x),Math.round(P.y+P.c*.3)]});
  await pg.mouse.move(...closed);await pg.waitForTimeout(800);
  check(await pg.evaluate(()=>soescloset.hover===4)&&await facing(4)<3,'walk: a closed piece turns to the pointer');
  check(await stop(pg)===0,'walk: hovering does not move the rail');
  await pg.mouse.move(closed[0]+6,closed[1]);await pg.waitForTimeout(200);
  check(await pg.evaluate(()=>soescloset.hover===4),'walk: the rack does not flicker under a small move');
  await pg.mouse.click(closed[0]+6,closed[1]);await pg.waitForTimeout(900);
  check(await pvOpen(pg)&&(await hash(pg)).endsWith(await pg.evaluate(()=>soescloset.G[4].id)),'walk: clicking a closed piece opens that piece');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(800);
  check(await stop(pg)===4,'walk: the rail has come round to it behind the view');
  await pg.keyboard.press('Home');await settled(pg);
  await pg.mouse.move(1200,800);await pg.mouse.down();await pg.mouse.move(900,800,{steps:2});await pg.mouse.move(400,800,{steps:2});await pg.mouse.up();
  await pg.waitForTimeout(150);
  check(await pg.evaluate(()=>Math.max(...soescloset.G.map(g=>Math.abs(g.sw))))>.5,'walk: a throw sets the hangers swinging');
  await settled(pg);
  check(await stop(pg)>=3,`walk: a throw runs on past the hand (${await stop(pg)})`);
  await pg.locator('.mover.on button[tabindex="0"]').focus();await pg.keyboard.press('ArrowRight');await settled(pg);
  check(await pg.evaluate(()=>{const S=soescloset,b=document.activeElement.getBoundingClientRect(),P=S.live[Math.round(S.T)];return Math.abs(b.left+b.width/2-P.x)<24}),'walk: the focus ring sits on the open piece');
  await pg.evaluate(()=>document.activeElement.blur());

  // ---- Piece view
  await go(pg,'#/walk');
  const [gx,gy]=await garmentAt(pg);
  await pg.mouse.move(gx,gy);await pg.waitForTimeout(100);
  await pg.mouse.click(gx,gy);await pg.waitForTimeout(800);
  check(await pvOpen(pg),'walk: clicking a hoodie opens the piece view');
  const openHash=await hash(pg),id=openHash.split('/')[2],item=data.find(d=>d.id===id);
  check(!!item,'piece view has the hoodie in its URL: '+openHash);
  const a=await pg.locator('#pv .pv-go a').first();
  check(await a.getAttribute('href')===item.url&&item.url.startsWith('https://'),'link is the item url, https');
  check(await a.getAttribute('target')==='_blank'&&(await a.getAttribute('rel')).includes('noopener'),'link opens a new tab, noopener');
  check((await a.textContent()).includes(item.source_store),'link says where it goes: '+(await a.textContent()).trim());
  const txt=await pg.textContent('#pv');
  check(txt.includes(item.brand)&&txt.includes('$'+(+item.price).toLocaleString('en-US')),'real brand and price');
  check((await pg.innerHTML('#pv .pv-facts')).includes((+item.shoulder_width_ratio).toFixed(3)),'real measured ratio behind the plain words');
  check(txt.includes(item.material)&&item.details.every(l=>!/^(Style|Color):/.test(l)),'real material from the store listing');
  check(!/\.[0-9]{3}/.test(await pg.textContent('#pv .pv-facts')),'no bare decimals in the facts');
  check(await pg.evaluate(()=>document.getElementById('pv').contains(document.activeElement)),'focus moved into the view');
  await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  check((await hash(pg))!==openHash,'next piece, from the keyboard');
  await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(300);
  check((await hash(pg))===openHash,'previous piece');
  await pg.click('#pv .pv-cbtn');await pg.locator('#pv .pv-picks button:not([hidden])').first().click();await pg.waitForTimeout(250);
  check(await pg.evaluate(()=>document.querySelectorAll('#pv .pv-go a').length===2&&!document.getElementById('pvOther').hidden),'compare shows a second piece with its own link');
  check(await pg.evaluate(()=>/^#\/splice\/[^/]+\/[^/]+$/.test(document.querySelector('#pv .pv-room').getAttribute('href'))),'compare leads on to the Compare room');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(700);
  check(!await pvOpen(pg),'Esc closes');
  check((await hash(pg)).startsWith('#/walk'),'Esc returns to the room: '+await hash(pg));

  // Browsing inside the view moves the rail with it, and the mini rack jumps along it.
  await go(pg,'#/walk');
  const wx=await garmentAt(pg);await pg.mouse.move(...wx);await pg.mouse.click(...wx);await pg.waitForTimeout(700);
  await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(200);await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
  const seen=(await hash(pg)).split('/')[2];
  await pg.keyboard.press('Escape');await pg.waitForTimeout(800);
  check((await hash(pg))==='#/walk/'+seen&&await pg.evaluate(id=>soescloset.G[Math.round(soescloset.T)].id===id,seen),'closing lands the rail on the piece last viewed');
  const rk=await pg.locator('#rack').boundingBox();
  await pg.mouse.click(rk.x+rk.width-2,rk.y+12);await pg.waitForTimeout(150);
  check((await hash(pg)).endsWith(await pg.evaluate(()=>soescloset.G.at(-1).id)),'the URL already names where the rail is going');
  await settled(pg);
  check(await stop(pg)===await pg.evaluate(()=>soescloset.last)&&!await pvOpen(pg),'the rack jumps along the rail without opening a piece');
  await pg.keyboard.press('Home');await settled(pg);await pg.keyboard.press('PageDown');await settled(pg);
  check(await stop(pg)===4,'PageDown walks on');
  await pg.mouse.move(720,890);await pg.waitForTimeout(300);
  await pg.keyboard.press('Space');await settled(pg);
  check(await stop(pg)===5||await pvOpen(pg),'Space walks on, or opens a focused hanger');
  if(await pvOpen(pg)){await pg.keyboard.press('Escape');await pg.waitForTimeout(700)}

  // Same place after Back, and after clicking outside.
  await pg.keyboard.press('ArrowRight');await settled(pg);await pg.keyboard.press('ArrowRight');await settled(pg);
  const before=await stop(pg);
  await pg.mouse.move(720,890);await pg.waitForTimeout(600); // off the rack first: a piece the pointer holds open pushes the others aside
  await pg.mouse.move(...await garmentAt(pg));await pg.mouse.click(...await garmentAt(pg));await pg.waitForTimeout(700);
  check(await pvOpen(pg),'opens again further along');
  await pg.goBack();await pg.waitForTimeout(700);
  check(!await pvOpen(pg)&&await stop(pg)===before,'browser Back closes it, same stop');
  await pg.goForward();await pg.waitForTimeout(700);
  check(await pvOpen(pg),'browser Forward reopens it');
  await pg.mouse.click(1425,450);await pg.waitForTimeout(100);
  if(await pvOpen(pg)){await pg.mouse.click(20,20);}
  await pg.waitForTimeout(700);
  check(!await pvOpen(pg)&&await stop(pg)===before,'clicking outside closes it, same stop');

  // Keyboard path and focus return.
  await go(pg,'#/hood');
  await pg.locator('.mover.on button[tabindex="0"]').focus();
  await pg.keyboard.press('ArrowRight');await settled(pg);
  check(await pg.evaluate(()=>document.activeElement.matches('.slot button')&&document.activeElement.tabIndex===0),'arrow keys carry focus along the row');
  check(await pg.evaluate(()=>document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineStyle!=='none'&&document.activeElement.getBoundingClientRect().width>100),'focus is visible, and large enough to read as the hoodie');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(700);
  check(await pvOpen(pg),'hood: Enter on a hoodie opens it');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(700);
  check(await pg.evaluate(()=>document.activeElement.matches('.slot button')),'focus returns to the hoodie');

  // A hoodie opens from every room that has one.
  for(const [room,fn] of [['wall',async()=>{await pg.mouse.move(400,780);await pg.waitForTimeout(500);await pg.mouse.click(400,780)}],
    ['price',async()=>{const [px,py]=await pg.evaluate(()=>{const S=soescloset,P=S.live.filter(p=>p.o>.5&&p.x>0&&p.x<S.w).sort((a,b)=>b.x-a.x)[1];return [P.x,P.y+P.c*.3]});await pg.mouse.click(px,py)}],
    ['average',async()=>{const [px,py]=await pg.evaluate(()=>{const S=soescloset,P=S.live[0];return [P.x,P.y+P.c*.3]});await pg.mouse.click(px,py)}],
    ['splice',async()=>{await pg.mouse.click(300,500)}],
    ['',async()=>{const [px,py]=await pg.evaluate(()=>{const P=soescloset.live[0];return [P.x-P.c*.2,P.y+P.c*.5]});await pg.mouse.click(px,py)}]]){
    await go(pg,'#/'+room,room?900:1900);
    await fn();await pg.waitForTimeout(800);
    check(await pvOpen(pg),`${room||'cover'}: a click on a hoodie opens the view`);
    await pg.keyboard.press('Escape');await pg.waitForTimeout(600);
  }
  await go(pg,'#/index');
  await pg.locator('.ixp a').first().click();await pg.waitForTimeout(800);
  check(await pvOpen(pg),'index: a row opens the view, not the store');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(600);
  check((await hash(pg)).startsWith('#/index')&&await pg.evaluate(()=>soescloset.room==='index'),'index: Esc returns');

  // ---- Deep links, reload, redirects
  const deep=data[3].id;
  await pg.goto('about:blank');await pg.goto(base+'#/piece/'+deep);await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(800);
  check(await pvOpen(pg)&&(await pg.textContent('#pv .pv-brand'))===data[3].brand,'deep link opens that piece');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(700);
  check((await hash(pg)).startsWith('#/walk'),'closing a deep link lands in a room, it does not leave the site');
  check((await pg.evaluate(()=>{const S=soescloset;return S.G[Math.round(S.q.walk*S.last)].id}))===deep,'and on that same piece');
  await go(pg,'#/walk');
  await pg.keyboard.press('ArrowRight');await settled(pg);await pg.waitForTimeout(300);
  const tail=await hash(pg),was=await stop(pg);
  await pg.reload();await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(500);
  check(/^#\/walk\/./.test(tail)&&(await hash(pg))===tail&&await stop(pg)===was,'reload keeps the room and the place: '+tail);
  for(const [o,n] of [['#walk','#/walk'],['#mean','#/average'],['#compare','#/price'],['#hero','#/']]){
    await pg.goto('about:blank');await pg.goto(base+o);await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(200);
    check((await hash(pg))===n,`old anchor ${o} goes to ${n}`);
  }
  await go(pg,'#/piece/nope',300);
  check((await hash(pg)).startsWith('#/walk'),'an unknown piece falls back to a room');
  await pg.goto('about:blank');await pg.goto(base+'#/nonsense');await pg.waitForFunction(()=>window.soescloset?.ready);await pg.waitForTimeout(300);
  check((await hash(pg))==='#/'&&await pg.evaluate(()=>soescloset.room==='cover'),'an unknown room falls back to the cover');

  // ---- Hood: the zoom is the user's, stops at the photo's own pixels, and hands the drag to the cloth.
  await go(pg,'#/hood',1500);
  const hoodC=()=>pg.evaluate(()=>{const S=soescloset;return Math.max(...S.live.filter(p=>p.o>.5).map(p=>p.c))});
  const c0=await hoodC();
  check(c0<1600,`hood: the row rests below the source's pixels (c ${Math.round(c0)})`);
  await pg.mouse.move(720,300);await pg.waitForTimeout(800);
  check(await hoodC()===c0,'hood: nothing zooms unless asked');
  // Every hood is one click away, from a thumbnail or by brand and price, and the bar shows where you are.
  const rowIds=await pg.evaluate(()=>[...soescloset.G].sort((a,b)=>(a.hood_crown_ratio||0)-(b.hood_crown_ratio||0)).map(g=>g.id));
  const pieceAt=()=>pg.evaluate(ids=>ids[Math.round(soescloset.q.hood*(ids.length-1))],rowIds);
  await pg.click('#hmap button[data-t="9"]');await settled(pg);
  check(await stop(pg)===9,'hood: a thumbnail jumps to its piece');
  check(await pg.evaluate(()=>document.querySelector('#hmap button[aria-current]')?.dataset.t==='9'),'hood: the thumbnails mark where you are');
  const loewe=data.findIndex(g=>g.brand==='Loewe');
  await pg.selectOption('#hfind',String(rowIds.indexOf(data[loewe].id)));await settled(pg);
  check(await pieceAt()===data[loewe].id,'hood: Find jumps straight to a brand');
  check(await pg.inputValue('#hfind')==='','hood: Find goes back to its label, so the same piece can be found again');
  await pg.keyboard.press('Home');await settled(pg);await pg.keyboard.press('ArrowRight');await settled(pg);
  const barY=async()=>(await pg.locator('#hzoom button:last-child').boundingBox()).y;
  const bar0=await barY();
  await pg.click('#hzoom button:last-child');await pg.waitForTimeout(1200);
  check(await barY()===bar0,'hood: the zoom control stays under the pointer while zooming');
  check(Math.abs(await hoodC()-1600)<1,'hood: zoom ends at one photo pixel per CSS pixel');
  check((await pg.textContent('#hnow')).includes('stays sharp'),'hood: the readout says so');
  check(await pg.evaluate(()=>{const n=document.getElementById('hnow').getBoundingClientRect(),b=document.querySelector('#hnow button').getBoundingClientRect();return n.top>=0&&b.width>40}),'hood: a zoom out control is on screen');
  await pg.keyboard.press('+');await pg.waitForTimeout(300);
  check(Math.abs(await hoodC()-1600)<1,'hood: the zoom cannot pass the source');
  const yOf=()=>pg.evaluate(()=>Math.max(...soescloset.live.filter(p=>p.o>.5).map(p=>p.y)));
  const y0=await yOf(),s0=await stop(pg);
  await pg.mouse.move(700,500);await pg.mouse.down();await pg.mouse.move(700,300,{steps:5});await pg.mouse.up();await pg.waitForTimeout(250);
  check(Math.abs(await yOf()-y0+200)<8,'hood: while zoomed a drag moves the cloth 1:1');
  check(await stop(pg)===s0&&!await pvOpen(pg),'hood: that drag neither moves the row nor opens a piece');
  await pg.keyboard.press('ArrowRight');await settled(pg);
  check(await stop(pg)===s0+1&&Math.abs(await hoodC()-1600)<1,'hood: keys step to the next piece at the same zoom');
  await pg.mouse.click(700,300);await pg.waitForTimeout(700);
  check(await pvOpen(pg),'hood: a click on zoomed cloth still opens the piece');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(700);
  check(!await pvOpen(pg)&&Math.abs(await hoodC()-1600)<1,'hood: Esc closes the piece first, the zoom stays');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(1000);
  check(Math.abs(await hoodC()-c0)<1,'hood: a second Esc returns to the row');
  await pg.mouse.move(720,300);await pg.mouse.wheel(0,100);await settled(pg);
  check(await stop(pg)===s0+2,'hood: back in the row the wheel moves it again');
  await pg.click('#hzoom button:last-child');await pg.waitForTimeout(600);
  await pg.click('#nav a[href="#/wall"]');await pg.waitForTimeout(1500);
  check(await pg.evaluate(()=>getComputedStyle(document.getElementById('hbar')).visibility==='hidden'),'hood: its bar leaves with the room');
  await pg.click('#nav a[href="#/hood"]');await pg.waitForTimeout(1500);
  check(Math.abs(await hoodC()-c0)<1,'hood: leaving the room resets the zoom');

  // ---- Hood: the card is one thing to click, and the piece view keeps the row's order and place.
  await go(pg,'#/hood',1500);
  await pg.mouse.move(1200,650);await pg.waitForTimeout(300);
  check(await pg.evaluate(()=>document.querySelectorAll('.htag.on').length===1),'hood: hovering a card visibly answers');
  await pg.keyboard.press('ArrowRight');await settled(pg);await pg.keyboard.press('ArrowRight');await settled(pg);await pg.keyboard.press('ArrowRight');await settled(pg);
  const railNo=await pg.textContent('.pos.on b');
  await pg.mouse.click(720,650);await pg.waitForTimeout(700);
  check(await pvOpen(pg),'hood: a click on the card, not only the photo, opens the piece');
  check(await pg.textContent('#pv .pv-n')===railNo,`hood: the piece view numbers it as the row does (${railNo})`);
  await pg.click('#pv .pv-q');await pg.waitForTimeout(300);await pg.click('#pv .pv-q');await pg.waitForTimeout(300);
  const viewed=await hash(pg);
  await pg.keyboard.press('Escape');await pg.waitForTimeout(800);
  check(await stop(pg)===5&&(await hash(pg)).endsWith(viewed.split('/').pop()),'hood: closing lands on the piece last viewed, which is two along the row');
  check(await pg.evaluate(()=>document.activeElement.matches('.slot button')),'hood: focus lands on that hood');
  check(await pg.evaluate(()=>{const c=[...document.querySelectorAll('.htag')].filter(t=>t.style.visibility==='visible'),l=c.map(t=>t.getBoundingClientRect().left);return l.every(x=>Math.abs(x%(innerWidth/3))<1||Math.abs(x%(innerWidth/3)-innerWidth/3)<1)}),'hood: settled columns land on clean edges');

  // ---- Nav and history across rooms, including a film and a view transition.
  await go(pg,'#/');
  await pg.click('#heroIn');await pg.waitForTimeout(1200);
  check(await pg.evaluate(()=>soescloset.room==='walk'&&soescloset.q.hero===1),'the cover has a plain way in');
  await pg.keyboard.press('ArrowRight');await settled(pg);await pg.keyboard.press('ArrowRight');await settled(pg);
  await pg.click('#nav a[href="#/hood"]');await pg.waitForTimeout(1200);
  check(await pg.evaluate(()=>soescloset.room==='hood'&&document.querySelector('#nav [aria-current=page]').textContent.trim()==='Hood'),'nav goes to Hood and marks it');
  const carried=await pg.evaluate(()=>{const S=soescloset,row=[...S.G].sort((a,b)=>(a.hood_crown_ratio||0)-(b.hood_crown_ratio||0));return row[Math.round(S.q.hood*(row.length-1))].id});
  check(carried===await pg.evaluate(()=>soescloset.G[2].id),'the same garment carries into the next room');
  await pg.click('#nav a[href="#/index"]');await pg.waitForTimeout(1000);
  await pg.evaluate(()=>scrollTo(0,1500));await pg.waitForTimeout(200);
  await pg.goBack();await pg.waitForTimeout(1200);
  check(await pg.evaluate(()=>soescloset.room==='hood'&&scrollY===0),'Back leaves the index for Hood');
  await pg.goForward();await pg.waitForTimeout(1200);
  check(await pg.evaluate(()=>soescloset.room==='index'&&scrollY>1400),'Forward returns to the same place in the index');
  await pg.goBack();await pg.waitForTimeout(1000);
  check(!errs.length,'desktop run has no errors: '+errs.join(' | '));
  await c.close();
}

// ---- No View Transitions API: rooms still change, plainly.
{
  const {c,pg,errs}=await page({viewport:{width:1440,height:900}});
  await pg.addInitScript(()=>{delete Document.prototype.startViewTransition});
  await go(pg,'#/walk');
  await pg.click('#nav a[href="#/price"]');await pg.waitForTimeout(800);
  check(await pg.evaluate(()=>!document.startViewTransition&&soescloset.room==='price'),'no View Transitions: the room still changes');
  check(!errs.length,'fallback run has no errors: '+errs.join(' | '));
  await c.close();
}

// ---- Phone: swipe, tap, sheet
{
  const {c,pg,errs}=await page({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const cdp=await c.newCDPSession(pg);
  const swipe=async(dx,dy=0,sx=300,sy=420)=>{await cdp.send('Input.synthesizeScrollGesture',{x:sx,y:sy,xDistance:dx,yDistance:dy,speed:1400,gestureSourceType:'touch'});await pg.waitForTimeout(500)};
  for(const room of ['walk','hood']){
    await go(pg,'#/'+room,2500);
    // The rack packs tighter than a screen and lets a swipe run on, so its one-stop swipe is one pitch, not one screen.
    const dist=await pg.evaluate(()=>document.querySelector('.mover.on .slot').offsetWidth*1.1|0);
    const sy=room==='hood'?250:420; // Hood's controls sit at 420; a swipe belongs on the row above them
    await swipe(-dist,0,300,sy);await settled(pg); // the synthetic gesture has no fling, so it must pass halfway on distance alone
    check(await stop(pg)===1,`${room} 390: a swipe moves one stop, snapped`);
    await swipe(dist,0,300,sy);await settled(pg);
    check(await stop(pg)===0,`${room} 390: a swipe back returns`);
    check(await pg.evaluate(()=>document.querySelector('#navBtn').getBoundingClientRect().bottom<80),`${room} 390: nav stays on screen`);
    const tag=await pg.locator('.pos.on .nx').boundingBox();
    check(tag.height>=38&&tag.width>=44,`${room} 390: next button is a real target`);
    await pg.locator('.pos.on .nx').tap();await settled(pg);
    check(await stop(pg)===1,`${room} 390: the next button steps`);
    const [gx,gy]=await pg.evaluate(r=>{const S=soescloset,b=S.rooms[r].box();return [r==='hood'?b.x+b.w/2:S.w/2,S.h*.3]},room); // Hood's open piece is the left of two
    await pg.touchscreen.tap(gx,gy);await pg.waitForTimeout(800);
    check(await pvOpen(pg),`${room} 390: a tap on a hoodie opens the view`);
    check(await pg.evaluate(()=>{const r=document.documentElement;return r.scrollWidth<=innerWidth&&document.getElementById('pv').scrollWidth<=innerWidth}),`${room} 390: the view fits the width`);
    check(await pg.evaluate(()=>{const a=document.querySelector('#pv .pv-go a').getBoundingClientRect();return a.height>=44&&a.top>0}),`${room} 390: the store link is a real target`);
    await pg.locator('#pv .pv-x').tap();await pg.waitForTimeout(700);
    check(!await pvOpen(pg)&&await stop(pg)===1,`${room} 390: Close returns to the same stop`);
    if(room==='walk'){
      await pg.touchscreen.tap(383,300);await settled(pg);
      check(!await pvOpen(pg)&&await stop(pg)===2,'walk 390: a tap on a closed piece brings it round, it does not open');
    }
  }
  // Hood on touch: the slider zooms, a finger then drags the cloth, a tap still opens the piece.
  await go(pg,'#/hood',2500);
  const hc=()=>pg.evaluate(()=>{const S=soescloset;return Math.max(...S.live.filter(p=>p.o>.5).map(p=>p.c))});
  const box=await pg.locator('#hzoom button:last-child').boundingBox();
  check(box.height>=40,'hood 390: the zoom is a real target');
  // A vertical swipe over the controls must never change the zoom.
  await swipe(0,-120,box.x+box.width/2,box.y+box.height/2);
  check(await pg.evaluate(()=>document.querySelector('#hzoom button').getAttribute('aria-pressed'))==='true','hood 390: a vertical swipe over the bar leaves the zoom alone');
  await pg.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await pg.waitForTimeout(1300);
  check(Math.abs(await hc()-1600/1.5)<30,'hood 390: the last zoom step stops where a 2x screen stays sharp: '+await hc());
  const s1=await stop(pg),before=await pg.evaluate(()=>soescloset.live.filter(p=>p.o>.5).map(p=>[p.x,p.y])[0]);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await touch('touchStart',200,400);for(let i=1;i<=6;i++){await touch('touchMove',200-i*20,400-i*20);await pg.waitForTimeout(16)}await touch('touchEnd');await pg.waitForTimeout(300);
  const after=await pg.evaluate(()=>soescloset.live.filter(p=>p.o>.5).map(p=>[p.x,p.y])[0]);
  check(Math.abs(after[0]-before[0]+120)<8&&Math.abs(after[1]-before[1]+120)<8,`hood 390: a finger drags the cloth (${Math.round(after[0]-before[0])},${Math.round(after[1]-before[1])})`);
  check(await stop(pg)===s1&&!await pvOpen(pg),'hood 390: that drag did not move the row or open a piece');
  await pg.touchscreen.tap(200,300);await pg.waitForTimeout(800);
  check(await pvOpen(pg),'hood 390: a tap on zoomed cloth opens the piece');
  await pg.locator('#pv .pv-x').tap();await pg.waitForTimeout(600);
  // A swipe on the photo in the piece view moves along the row the phone just taught.
  await go(pg,'#/hood',1500);
  await pg.touchscreen.tap(95,250);await pg.waitForTimeout(800);
  const pv0=await hash(pg),t2=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await t2('touchStart',300,200);for(let i=1;i<=6;i++){await t2('touchMove',300-i*30,200);await pg.waitForTimeout(16)}await t2('touchEnd');await pg.waitForTimeout(400);
  check(await pvOpen(pg)&&await hash(pg)!==pv0,'hood 390: a swipe in the piece view moves to the next piece');
  await pg.locator('#pv .pv-x').tap();await pg.waitForTimeout(600);
  await go(pg,'#/wall');
  await pg.touchscreen.tap(120,500);await pg.waitForTimeout(800);
  check(await pvOpen(pg),'wall 390: a tap opens the view');
  await pg.locator('#pv .pv-x').tap();await pg.waitForTimeout(600);
  await pg.locator('#navBtn').tap();await pg.locator('#nav a[href="#/price"]').tap();await pg.waitForTimeout(1300);
  check(await pg.evaluate(()=>soescloset.room==='price'),'390: nav can be tapped');
  check(!errs.length,'phone run has no errors: '+errs.join(' | '));
  await c.close();
}
await b.close();
if(fails.length){console.log(fails.length+' failed:\n'+fails.join('\n'));process.exit(1)}
console.log('use-site ok');
