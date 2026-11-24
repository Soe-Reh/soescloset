// The Closet (round 3: the main room, was All 17). Every piece once, on a field you drag and throw; sorting snaps it into labelled rows, Free lets it go again.
// The island bar sorts, finds a piece (the shared combobox) and picks two to compare; a hovered piece lifts and floods the room in its own colour.
// A Views row leads to the other rooms. Motion is damped per second (motion.js), so it feels the same at any frame rate.
// This part also keeps the chrome's colour over the stage rooms (mast, word colours, blade cuts), as before.
import {S,G,$,clamp,lum,hex,money,css,vis,HH,WHITE,BLACK,priceTone,priceLevel,FIT_ORDER} from '../core.js';
import {sec,damp,dk,rubber,wheelPx,TILT,TILT_MAX,GRAB} from '../motion.js';
import {combo} from './combo.js';
const {N}=S,box=$('index');
const attr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');

// ---- groups for each sort. Each is [label, pieces] in reading order.
const hsl=h=>{const c=hex(h).map(v=>v/255),M=Math.max(...c),m=Math.min(...c),d=M-m,[r,g,b]=c;const x=!d?0:M===r?((g-b)/d+6)%6:M===g?(b-r)/d+2:(r-g)/d+4;return {h:x*60,d,l:(M+m)/2}};
const family=g=>{const {h,d,l}=hsl(g.dominant_hex);
  if(d<.07)return l<.35?'Black':'White, cream, stone';
  if(h>=15&&h<75&&d<.3)return 'White, cream, stone';
  return h>=75&&h<200?'Green':h>=200&&h<265?'Blue':'Pink, purple, red'};
const FAM=['White, cream, stone','Pink, purple, red','Blue','Green','Black'];
const byP=(a,b)=>a.price-b.price;
const band=p=>p<250?'Under $250':p<400?'$250 to $399':'$400 and up';
const groupBy=(key,names,within=byP)=>names.map(n=>[n,G.filter(g=>key(g)===n).sort(within)]).filter(x=>x[1].length);
const SORTS={
  price:()=>groupBy(g=>band(g.price),['Under $250','$250 to $399','$400 and up']),
  color:()=>groupBy(family,FAM,(a,b)=>hsl(b.dominant_hex).l-hsl(a.dominant_hex).l),
  fit:()=>groupBy(g=>g.fitGroup,FIT_ORDER), // loose to fitted
  brand:()=>groupBy(g=>g.brand,[...new Set(G.map(g=>g.brand))].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}))),
  hood:()=>groupBy(g=>g.hood_form,['domed-closed','peaked-closed','peaked-open']).map(([n,ps])=>[n.replace(/(\w+)-(\w+)/,(_,c,m)=>`${c[0].toUpperCase()+c.slice(1)} crown, ${m} mouth`),ps]),
};
// self-check: every sort shows each piece exactly once
for(const k in SORTS)console.assert(SORTS[k]().flatMap(x=>x[1]).length===N,'sort '+k+' lost a piece');

// ---- the other rooms, each with a tiny preview drawn from the pieces themselves
const im=g=>`url('${g.image_600}')`,byPrice=[...G].sort(byP);
const VIEWS=[
  ['walk','Walk',`<span class="vp vp-walk">${[G[2],G[1],G[0]].map((g,k)=>`<i style="background-image:${im(g)};--k:${k}"></i>`).join('')}</span>`],
  ['wall','Wall',`<span class="vp vp-wall">${G.slice(0,9).map(g=>`<i style="background-image:${im(g)}"></i>`).join('')}</span>`],
  ['price','Price',`<span class="vp vp-price">${byPrice.map(g=>`<i style="height:${(18+82*priceLevel(g.price)).toFixed(0)}%;background:${priceTone(g.price)}"></i>`).join('')}</span>`],
  ['splice','Compare',`<span class="vp vp-cmp"><i style="background-image:${im(G[0])}"></i><i style="background-image:${im(G.at(-1))}"></i></span>`],
  ['hood','Hood',`<span class="vp vp-hood" style="background-image:${im(G[3]||G[0])}"></span>`],
  ['average','Average','<span class="vp vp-avg"></span>'],
];
const SORTL=[['free','Free'],['price','Price'],['color','Color'],['brand','Brand'],['hood','Hood'],['fit','Fit']];
box.innerHTML=`<div id="ex"><div id="exField" aria-label="All ${N} pieces. Drag to move them, pick one to open it.">
${G.map(g=>`<a class="xt" href="#/piece/${g.id}" data-piece="${g.id}" aria-label="${attr(g.brand)}, ${attr(g.short)}, ${money(g.price)}" draggable="false"><img alt="" src="${g.image_600}" draggable="false" decoding="async"><span class="xm"><b>${g.brand}</b><span>${money(g.price)}</span><i style="background:${priceTone(g.price)}"></i></span></a>`).join('')}
</div>
<div id="exViews" role="navigation" aria-label="Views of the closet"><span class="xvl">Views</span>${VIEWS.map(([k,l,p])=>`<a class="vw" href="#/${k}">${p}<b>${l}</b></a>`).join('')}</div>
<p id="exPick" role="status" hidden></p>
<div id="exBar" role="group" aria-label="Arrange, find and compare the pieces"><div class="xs" role="group" aria-label="Sort"><span class="xn">Sort</span>${SORTL.map(([k,l])=>`<button type="button" data-k="${k}" aria-pressed="${k==='free'}">${l}</button>`).join('')}</div><i class="xsep" aria-hidden="true"></i><span id="exFindAt"></span><i class="xsep" aria-hidden="true"></i><button type="button" id="exCmp" aria-pressed="false">Compare two</button></div>
</div>
<footer id="exFoot">
<form id="sug" novalidate><label for="sugUrl">Suggest a hoodie</label><input id="sugUrl" name="url" type="url" inputmode="url" autocomplete="off" placeholder="Link to the product page" required><input name="website" class="sr" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit" class="btn">Suggest</button><output id="sugSay" aria-live="polite"></output></form>
<p>Soe Reh · <a href="mailto:soereh@utexas.edu">soereh@utexas.edu</a> · <a href="https://www.linkedin.com/in/soe" target="_blank" rel="noopener">LinkedIn</a> · <a href="https://github.com/Soe-Reh" target="_blank" rel="noopener">GitHub</a></p>
<a id="exNext" href="#/walk" aria-label="Next room: Walk">Walk<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M0 5h15M11 1l4 4-4 4"/></svg></a>
</footer>`;

// ---- suggest box
// Google Apps Script web app that appends each suggestion to Soe's sheet (tools/suggest-apps-script.js). Empty: the box says it opens soon.
const SUGGEST_TO='https://script.google.com/macros/s/AKfycbzxtypc1iLaYzlpcX333cGlx8H-1p0Ei4moGCY97E6n-Kc8WYaCNfHj-N853gNSHOZb/exec';
const sug=$('sug'),sugUrl=$('sugUrl'),sugSay=$('sugSay');
const isWebUrl=s=>{try{const u=new URL(s.trim());return (u.protocol==='http:'||u.protocol==='https:')&&!!u.hostname.includes('.')}catch{return false}};
console.assert(isWebUrl('https://kith.com/x')&&isWebUrl('http://a.co')&&!isWebUrl('javascript:alert(1)')&&!isWebUrl('kith')&&!isWebUrl('ftp://a.co'),'isWebUrl');
sug.addEventListener('submit',e=>{
  e.preventDefault();
  if(!isWebUrl(sugUrl.value)){sugSay.textContent='That needs to be a web link, starting with http or https.';sugUrl.setAttribute('aria-invalid','true');sugUrl.focus();return}
  sugUrl.removeAttribute('aria-invalid');
  if(!SUGGEST_TO){sugSay.textContent='Suggestions open soon.';return}
  // no-cors: Apps Script answers from another origin, so the reply is unreadable; only a network failure is known.
  const btn=sug.querySelector('button'),url=sugUrl.value.trim();btn.disabled=true;sugSay.textContent='Sending…';
  fetch(SUGGEST_TO,{method:'POST',mode:'no-cors',body:new URLSearchParams({url,page:location.hash||'#/',website:sug.website.value})})
    .then(()=>{sugUrl.value='';sugSay.textContent="Thanks. I'll take a look."})
    .catch(()=>{sugSay.textContent="Couldn't send that. Try again in a moment."})
    .finally(()=>{btn.disabled=false});
});
sugUrl.addEventListener('input',()=>{if(sugUrl.hasAttribute('aria-invalid')){sugUrl.removeAttribute('aria-invalid');sugSay.textContent=''}});

// ---- the field
const ex=$('ex'),field=$('exField'),bar=$('exBar'),views=$('exViews'),pickSay=$('exPick'),cmpBtn=$('exCmp');
const tiles=[...field.children].map((el,i)=>({el,g:G[i],img:el.firstChild,hx:0,hy:0,x:0,y:0,ox:0,oy:0,vx:0,vy:0,lam:6+((i*37)%17)/17*3,lift:0,z:0}));
const labels=[];
let W=0,H=0,T=160,WW=1,WH=1,mode='free',rowsH=0,top0=84,bot0=90;
let cx=0,cy=0,vx=0,vy=0,pcx=0,pcy=0,tiltX=0,tiltY=0,grab=0,aim=null,spot=-1,spotUntil=0,free={x:0,y:0},down=null,mx=-1,my=-1,inside=false,near=-1,flooded=-1,running=false,prevT=0;
const hover=matchMedia('(hover:hover) and (pointer:fine)');
const mod=(a,n)=>((a%n)+n)%n;

// Free: a loose jittered grid on a world a little larger than the screen. It wraps, so a throw never loses a piece and none shows twice.
function homes(){
  const area=Math.max(W+T*1.6,0)*Math.max(H+T*1.6,0),need=N*T*T*1.9;
  const k=Math.sqrt(Math.max(1,need/area));WW=(W+T*1.6)*k;WH=(H+T*1.6)*k;
  const cols=Math.max(3,Math.round(Math.sqrt(N*WW/WH))),rows=Math.ceil(N/cols),cw=WW/cols,ch=WH/rows;
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  tiles.forEach((t,n)=>{const c=(n*7)%N,col=c%cols,row=Math.floor(c/cols);t.hx=(col+.5+(rnd()-.5)*.4+(row%2?.25:-.25))*cw-T/2;t.hy=(row+.5+(rnd()-.5)*.36)*ch-T/2});
}
// Rows: groups flow left to right and wrap, each opened by its label. A group too long for one line carries on under itself.
function rowsLayout(groups){
  const pad=W<700?16:40,step=T*.74,lineH=T*(W<700?.96:1.04)+28,top=top0,maxX=W-pad;
  let x=pad,y=top;const pos=new Map(),labs=[],own=groups.length<=6; // few groups: a row each
  for(const [name,ps] of groups){
    const want=step*Math.min(2,ps.length)+T*.26;
    if(x>pad&&(own||x+want>maxX)){x=pad;y+=lineH}
    labs.push({name,n:ps.length,x,y,tone:ps.every(p=>band(p.price)===name)?priceTone(ps.at(-1).price):''});
    for(const g of ps){if(x+T>maxX+T*.2&&x>pad){x=pad;y+=lineH}pos.set(g,{x:x-T*.13,y:y+22});x+=step}
    x+=T*.5;
  }
  rowsH=y+lineH+bot0;
  return {pos,labs};
}
let layout=null;
function measure(){
  const b=field.getBoundingClientRect();W=b.width;H=b.height;
  // the Closet is the main room: bigger pieces than the old index, still a whole closet on one screen
  T=W<700?Math.min(W*.4,170):Math.min(Math.max(W*.14,150),240);
  ex.style.setProperty('--t',T+'px');
  // rows start under the Views row and end above the island bar
  top0=Math.round(views.getBoundingClientRect().bottom-b.top+20);bot0=Math.round(b.bottom-bar.getBoundingClientRect().top+24);
  homes();
  if(mode!=='free')applyRows(false);
}
function applyRows(animate){
  for(const l of labels)l.remove();labels.length=0;
  if(mode==='free'){layout=null;return}
  layout=rowsLayout(SORTS[mode]());
  for(const l of layout.labs){const el=document.createElement('p');el.className='xl';el.innerHTML=`${l.tone?`<i style="background:${l.tone}"></i>`:''}${l.name}<span>${l.n}</span>`;el._l=l;field.append(el);labels.push(el);if(animate)el.animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:420,delay:180,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'})}
  // tab order follows the rows
  for(const [g] of layout.pos)field.append(tiles[G.indexOf(g)].el);
}
// Where a tile sits before its own offset: wrapped in Free, plain in rows.
function place(t){
  if(layout){const p=layout.pos.get(t.g);t.x=p.x+cx;t.y=p.y+cy;return}
  t.x=mod(t.hx+cx+T,WW)-T;t.y=mod(t.hy+cy+T,WH)-T;
}
// Rows can be panned past their edge with resistance, then come back.
const bounds=()=>layout?{x0:0,x1:0,y0:Math.min(0,H-rowsH),y1:0}:null;

function setMode(k){
  if(k===mode)return;
  // FLIP: every tile keeps its place on screen and damps to the new one, each at its own rate so they arrive as a flock, not a block.
  tiles.forEach(place);const before=tiles.map(t=>[t.x+t.ox,t.y+t.oy]);
  if(mode==='free')free={x:cx,y:cy};
  mode=k;applyRows(true);
  if(mode==='free'){cx=free.x;cy=free.y}else{cx=0;cy=0}
  vx=vy=0;aim=null;pcx=cx;pcy=cy;
  tiles.forEach((t,n)=>{place(t);t.ox=before[n][0]-t.x;t.oy=before[n][1]-t.y;
    // a wrapped tile takes the short way round
    if(!layout){if(Math.abs(t.ox)>WW/2)t.ox-=Math.sign(t.ox)*WW;if(Math.abs(t.oy)>WH/2)t.oy-=Math.sign(t.oy)*WH}
    t.vx=t.vy=0});
  for(const b of bar.querySelectorAll('.xs button'))b.setAttribute('aria-pressed',b.dataset.k===k);
  wake();
}
bar.querySelector('.xs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setMode(b.dataset.k)});

// ---- the room takes the colour of the piece that is up (the original's flood, g.tint and its AA-checked ink), then goes back to grey
// A short hold before switching, so sweeping across the gaps never strobes piece, grey, piece.
let floodWant=-1,floodT=0;
function flood(i){
  if(i===floodWant)return;floodWant=i;clearTimeout(floodT);
  if(i===flooded)return;floodT=setTimeout(()=>floodNow(i),i<0?260:90);
}
function floodNow(i){
  if(i===flooded)return;flooded=i;const g=G[i];
  box.style.backgroundColor=g?css(g.tint):'';box.style.color=g?css(g.tintInk):'';const ch=document.getElementById('chrome').style;ch.setProperty('--xink',g?css(g.tintInk):'');ch.setProperty('--xbg',g?css(g.tint):'');
}

function frame(now){
  if(S.room!=='index'){running=false;return}
  const dt=sec(now-prevT)||.016;prevT=now;
  setChrome();
  if(!down){
    if(aim){ // a wheel or a search jump: damp toward where it asked to go
      cx=damp(cx,aim.x,aim.l,dt);cy=damp(cy,aim.y,aim.l,dt);
      vx=vy=0;if(Math.abs(aim.x-cx)<.5&&Math.abs(aim.y-cy)<.5){cx=aim.x;cy=aim.y;aim=null}
    }else{cx+=vx*dt;cy+=vy*dt;const f=Math.exp(-dt*3.2);vx*=f;vy*=f}
    const bd=bounds();
    if(bd&&!aim){ // back inside the rows
      const ex_=cx<bd.x0?bd.x0-cx:cx>bd.x1?bd.x1-cx:0,ey=cy<bd.y0?bd.y0-cy:cy>bd.y1?bd.y1-cy:0;
      const k=dk(9,dt);
      if(ex_){cx+=Math.abs(ex_)<.5?ex_:ex_*k;vx*=Math.exp(-dt*12)}
      if(ey){cy+=Math.abs(ey)<.5?ey:ey*k;vy*=Math.exp(-dt*12)}
    }
  }
  // velocity tilt from how fast the field really moved this frame, damped so it leans and settles rather than flickers
  const fvx=(cx-pcx)/Math.max(dt,.001),fvy=(cy-pcy)/Math.max(dt,.001);pcx=cx;pcy=cy;
  tiltX=damp(tiltX,clamp(fvx*TILT,-TILT_MAX,TILT_MAX),10,dt);tiltY=damp(tiltY,clamp(fvy*TILT,-TILT_MAX,TILT_MAX),10,dt);
  const held=down&&ex.classList.contains('grab')?1:0;grab=damp(grab,held,14,dt);if(Math.abs(grab-held)<.002)grab=held;
  // the piece that answers: under a mouse, the nearest within reach; on touch, the one nearest the middle once the field stops; a search names its own for a moment
  const fx=hover.matches?(inside&&!down?mx:-1):(down||Math.hypot(vx,vy)>40||aim?-1:W/2),fy=hover.matches?my:H*.45;
  let best=-1,bd2=hover.matches?(T*.55)**2:(T*1.2)**2;
  let busy=!!down||!!aim||Math.hypot(vx,vy)>2||Math.abs(tiltX)+Math.abs(tiltY)>.02||grab!==held;
  const bdn=bounds();if(bdn&&(cy<bdn.y0-.5||cy>bdn.y1+.5||cx<bdn.x0-.5||cx>bdn.x1+.5))busy=true;
  for(const t of tiles){
    place(t);
    if(t.ox||t.oy){const ox=t.ox,oy=t.oy;t.ox=damp(ox,0,t.lam,dt);t.oy=damp(oy,0,t.lam,dt);t.vx=(t.ox-ox)/Math.max(dt,.001);t.vy=(t.oy-oy)/Math.max(dt,.001)}
    if(Math.abs(t.ox)+Math.abs(t.oy)>.3)busy=true;else{t.ox=t.oy=t.vx=t.vy=0}
    if(fx>=0){const dx=t.x+t.ox+T/2-fx,dy=t.y+t.oy+T*.45-fy,d2=dx*dx+dy*dy;if(d2<bd2){bd2=d2;best=tiles.indexOf(t)}}
  }
  if(spot>=0){if(now<spotUntil&&!down&&!(inside&&hover.matches&&best>=0&&best!==spot))best=spot;else spot=-1}
  if(spot>=0)busy=true;
  near=best;flood(near>=0?G.indexOf(tiles[near].g):-1);
  for(let n=0;n<N;n++){
    const t=tiles[n],tgt=n===near?1:0;
    t.lift=damp(t.lift,tgt,14,dt);if(Math.abs(tgt-t.lift)>.004)busy=true;else t.lift=tgt;
  }
  paint();
  if(busy)requestAnimationFrame(frame);else running=false;
}
function paint(){
  const gs=1+(GRAB-1)*grab;
  for(const t of tiles){
    // lean with speed: the field's and the tile's own (a sort's flight). Round 4: a small 2D skew, not a 3D tip, so it stays gentle and needs no 3D layer.
    const sx=clamp(tiltX+t.vx*TILT,-TILT_MAX*1.4,TILT_MAX*1.4),sy=clamp(tiltY+t.vy*TILT,-TILT_MAX*1.4,TILT_MAX*1.4);
    const x=t.x+t.ox,y=t.y+t.oy;
    t.el.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) skew(${(-sx*.5).toFixed(2)}deg,${(sy*.25).toFixed(2)}deg) scale(${((1+t.lift*.09)*gs).toFixed(4)})`;
    const lifted=t.lift>.5;if(t._lf!==lifted){t._lf=lifted;t.el.classList.toggle('near',lifted)}
  }
  for(const el of labels){const l=el._l;el.style.transform=`translate3d(${(l.x+cx).toFixed(1)}px,${(l.y+cy).toFixed(1)}px,0)`}
}
// Draw only while something moves; any input wakes it.
function wake(){if(!running&&S.room==='index'&&W){running=true;prevT=performance.now();requestAnimationFrame(frame)}}

// ---- compare two: a small pick mode. The button reads Cancel while it is on, the status line counts, picked pieces wear their number.
let picking=false,picks=[],pickTimer=0;
function setPicking(on){
  picking=on;picks=[];clearTimeout(pickTimer);
  cmpBtn.setAttribute('aria-pressed',on);cmpBtn.textContent=on?'Cancel':'Compare two';
  ex.classList.toggle('picking',on);
  for(const t of tiles){t.el.classList.remove('picked');delete t.el.dataset.n}
  sayPick();
}
function sayPick(){
  pickSay.hidden=!picking;
  pickSay.innerHTML=!picking?'':picks.length===2?`Comparing <b>${picks[0].brand}</b> and <b>${picks[1].brand}</b>`:picks.length?`<b>${picks[0].brand}</b> picked. Now pick one more. <span>1 of 2</span>`:'Pick two pieces to compare. <span>0 of 2</span>';
}
function pickPiece(g){
  if(picks.length>=2)return;
  const t=tiles[G.indexOf(g)],was=picks.indexOf(g);
  if(was>=0){picks.splice(was,1);t.el.classList.remove('picked');delete t.el.dataset.n;picks.forEach((p,k)=>tiles[G.indexOf(p)].el.dataset.n=k+1);sayPick();return}
  picks.push(g);t.el.classList.add('picked');t.el.dataset.n=picks.length;sayPick();
  if(picks.length===2){const [a,b]=picks;pickTimer=setTimeout(()=>{location.hash=`#/splice/${a.id}/${b.id}`;setPicking(false)},420)}
}
cmpBtn.addEventListener('click',()=>setPicking(!picking));
addEventListener('keydown',e=>{if(e.key==='Escape'&&picking&&S.room==='index'&&!document.querySelector('.cb-pop.open')){e.preventDefault();setPicking(false);cmpBtn.focus()}});
addEventListener('hashchange',()=>{if(picking&&!/^#\/(closet|index)/.test(location.hash))setPicking(false)});

// ---- find: the shared combobox; picking a piece brings it to the middle and lifts it
const items=l=>l.map(g=>({value:g.id,title:g.brand,sub:g.short,meta:money(g.price),thumb:g.image_600,search:`${g.brand} ${g.short} ${g.col||''} ${g.price} ${money(g.price)}`}));
const find=combo({label:'Find a piece',placeholder:'Find a piece',groups:[{label:'By brand',items:items([...G].sort((a,b)=>a.brand.localeCompare(b.brand)))},{label:'By price, low to high',items:items(byPrice)}],onPick:id=>{find.set(null);jump(G.find(g=>g.id===id))}});
find.el.id='exFind';$('exFindAt').replaceWith(find.el);
function jump(g){
  if(!g)return;const t=tiles[G.indexOf(g)];
  if(picking){pickPiece(g);return}
  place(t);t.el.focus({preventScroll:true});
  let dx=W/2-T/2-t.x,dy=(top0+H-bot0)/2-T/2-t.y;
  if(!layout){if(Math.abs(dx)>WW/2)dx-=Math.sign(dx)*WW;if(Math.abs(dy)>WH/2)dy-=Math.sign(dy)*WH}
  let x=cx+dx,y=cy+dy;const bd=bounds();if(bd){x=clamp(x,bd.x0,bd.x1);y=clamp(y,bd.y0,bd.y1)}
  vx=vy=0;aim={x,y,l:5};spot=tiles.indexOf(t);spotUntil=performance.now()+2200;wake();
}

field.addEventListener('pointerdown',e=>{
  if(e.button)return;
  down={x:e.clientX,y:e.clientY,cx,cy,lx:e.clientX,ly:e.clientY,lt:e.timeStamp,m:0,touch:e.pointerType!=='mouse',id:e.pointerId};
  vx=vy=0;aim=null;spot=-1;field.setPointerCapture(e.pointerId);wake();
});
field.addEventListener('pointermove',e=>{
  const b=field.getBoundingClientRect();mx=e.clientX-b.left;my=e.clientY-b.top;inside=true;
  if(down&&e.pointerId===down.id){
    let dx=e.clientX-down.x,dy=e.clientY-down.y;down.m=Math.max(down.m,Math.hypot(dx,dy));
    if(down.m>(down.touch?15:6)&&!ex.classList.contains('grab')){ex.classList.add('grab');document.documentElement.classList.add('nosel')}
    let nx=down.cx+dx,ny=down.cy+dy;const bd=bounds();
    if(bd){nx=rubber(nx,bd.x0,bd.x1);ny=rubber(ny,bd.y0,bd.y1)}
    const dts=Math.max(.008,(e.timeStamp-down.lt)/1000);vx=vx*.4+(nx-cx)/dts*.6;vy=vy*.4+(ny-cy)/dts*.6;down.lt=e.timeStamp;
    cx=nx;cy=ny;
  }
  wake();
});
const up=e=>{
  if(!down||e.pointerId!==down.id)return;
  const d=down;down=null;ex.classList.remove('grab');document.documentElement.classList.remove('nosel');
  if(e.timeStamp-d.lt>80)vx=vy=0; // held still before letting go: no throw
  const max=3200,s=Math.hypot(vx,vy);if(s>max){vx*=max/s;vy*=max/s}
  if(e.type==='pointerup'&&d.m<=(d.touch?15:6)){
    // a click, not a drag: open what is under the pointer, or pick it while comparing
    const el=document.elementsFromPoint(e.clientX,e.clientY).find(x=>x.classList?.contains('xt'));
    if(el){vx=vy=0;const g=G.find(g=>g.id===el.dataset.piece);if(picking)pickPiece(g);else S.openPiece(g,el)}
  }
  wake();
};
field.addEventListener('pointerup',up);field.addEventListener('pointercancel',up);
field.addEventListener('pointerleave',()=>{inside=false;wake()});
// Pointer clicks are handled on release above; only keyboard activation (detail 0) reaches the shared opener, or the picker while comparing.
field.addEventListener('click',e=>{
  if(e.detail>0||picking){e.preventDefault();e.stopPropagation()}
  if(e.detail===0&&picking){const el=e.target.closest('.xt');if(el)pickPiece(G.find(g=>g.id===el.dataset.piece))}
},true);
// Lenis-style wheel: deltas (in px whatever the device) move a target and the field damps toward it; a trackpad's stream gets a quicker damp so it still feels direct.
field.addEventListener('wheel',e=>{
  if(e.ctrlKey)return;e.preventDefault();
  const [dx,dy]=wheelPx(e,H),a=aim||{x:cx,y:cy};a.x-=dx;a.y-=dy;a.l=Math.abs(dx)+Math.abs(dy)<40?24:9;
  const bd=bounds();if(bd){a.x=clamp(a.x,bd.x0-40,bd.x1+40);a.y=clamp(a.y,bd.y0-40,bd.y1+40)}
  vx=vy=0;spot=-1;aim=a;wake();
},{passive:false});
// A focused piece comes into view.
field.addEventListener('focusin',e=>{const t=tiles.find(t=>t.el===e.target);if(t){reveal(t,true);field.scrollTop=field.scrollLeft=0}});
function reveal(t,soft){
  place(t);const m=T*.2;
  const dx=t.x<m?m-t.x:t.x+T>W-m?W-m-T-t.x:0,dy=t.y<top0?top0-t.y:t.y+T>H-bot0?H-bot0-T-t.y:0;
  if(!dx&&!dy)return;
  if(soft){let x=cx+dx,y=cy+dy;const bd=bounds();if(bd){x=clamp(x,bd.x0,bd.x1);y=clamp(y,bd.y0,bd.y1)}aim={x,y,l:8};vx=vy=0}
  else{cx+=dx;cy+=dy;const bd=bounds();if(bd){cx=clamp(cx,bd.x0,bd.x1);cy=clamp(cy,bd.y0,bd.y1)}pcx=cx;pcy=cy;tiles.forEach(place)}
  wake();
}
addEventListener('resize',()=>{if(S.room==='index'){measure();wake()}});

// ---- chrome over the stage rooms (unchanged duties)
const chrome=$('chrome'),words=[$('logo'),...$('nav').children];
$('stage').insertAdjacentHTML('beforeend','<div id="mast"></div>');const mastEl=$('mast');
let wr=[],blades=[],cmode='';
// Huge type never greys out on its way in or out: whatever fade another beat asks for is cut as a blade across the letters, the same gesture as the slits and doors.
function cutType(){
  for(const el of blades){
    const o=el._o;
    if(el._on&&o<1){el.style.opacity=1;el.style.clipPath=`inset(-10% -5% ${((1-o)*100).toFixed(2)}% -5%)`;el._cut=true}
    else if(el._cut){el.style.clipPath='';el._cut=false}
  }
}
function setChrome(){
  const next=S.room==='index'?'over':S.mast?'mast':'';
  if(next!==cmode){cmode=next;chrome.className='chrome'+(next?' '+next:'')}
}
// A word takes the colour of the cloth under it; the cloth itself is never touched.
function wordColours(){
  wr.forEach((r,n)=>{
    let top=null,bz=-1;
    for(const P of S.live){
      if(P.o<.5||P.y>r.b)continue;
      const c=P.c,half=c*Math.min(.33,.1+(r.b-P.y)/c*.9),cx=P.x;
      const left=Math.max(cx-half,P.x-c*(.5-P.l)),right=Math.min(cx+half,P.x-c*(.5-P.r));
      if(r.x<left||r.x>right||P.y+c*HH<r.t)continue;
      const z=+G[P.i].el.style.zIndex||0;if(z>bz){bz=z;top=G[P.i]}
    }
    const col=top&&!S.mast?(lum(hex(top.dominant_hex))>.26?css(BLACK):css(WHITE)):'';
    if(words[n]._c!==col){words[n]._c=col;words[n].style.color=col}
  });
}

let first=true;
S.part('index',{
  rooms:{index:{
    // the piece view steps through the field's current order, and shrinks back into the tile the piece sits in
    order:()=>layout?[...layout.pos.keys()].map(g=>G.indexOf(g)):G.map((_,i)=>i),
    elOf:g=>{const t=tiles[G.indexOf(g)];if(t){reveal(t,false);paint();return t.el}},
  }},
  measure(){
    wr=words.map(a=>{const b=a.getBoundingClientRect();return {x:(b.left+b.right)/2,t:b.top,b:b.bottom}});
    blades=[...$('stage').querySelectorAll('.big.six,#odo,.wm')];
    setChrome();
    if(box.hidden)return; // rooms.js measures again when the index opens
    measure();
    // a little drift on first arrival, so the field reads as something that moves
    if(first){first=false;vx=-70;vy=-40}
    pcx=cx;pcy=cy;
    wake();
  },
  draw(){
    const qq=S.q;S.mast=qq.wallIn>.85&&qq.spliceIn<.8;vis(mastEl,S.mast?1:0);
    setChrome();wordColours();cutType();
  },
});
