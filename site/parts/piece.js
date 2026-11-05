// The shared piece view. A real <dialog> gives focus trap, inert page, Esc and focus return; the rest is one garment growing from where it sat.
import {S,G,money,css} from '../core.js';
const dlg=document.getElementById('pv'),N=G.length,prices=[...G].sort((a,b)=>a.price-b.price);
const attr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const Arrow=d=>`<svg viewBox="0 0 16 10" aria-hidden="true"><path d="${d>0?'M0 5h15M11 1l4 4-4 4':'M16 5H1M5 1L1 5l4 4'}"/></svg>`;
dlg.innerHTML=`<div class="pv-bg"></div>
<div class="pv-stage"><img class="pv-g" id="pvImg" alt="" draggable="false"><img class="pv-g pv-o" id="pvOther" alt="" draggable="false" hidden></div>
<div class="pv-panel">
  <p class="pv-brand"></p>
  <h2 id="pvT" class="pv-name" tabindex="-1" autofocus></h2>
  <b class="six pv-price"></b>
  <div class="pv-go"></div>
  <ul class="pv-notes"></ul>
  <table class="pv-facts"></table>
  <p class="pv-small"></p>
  <button type="button" class="pv-cbtn" aria-expanded="false">Compare with another piece</button>
  <div class="pv-picks" hidden></div>
  <a class="pv-room" hidden></a>
</div>
<button type="button" class="pv-x">Close</button>
<div class="pv-nav"><button type="button" class="pv-p" aria-label="Previous piece">${Arrow(-1)}</button><span class="pv-n"></span><button type="button" class="pv-q" aria-label="Next piece">${Arrow(1)}</button></div>`;
const $=s=>dlg.querySelector(s),img=$('#pvImg'),other=$('#pvOther'),bg=$('.pv-bg'),panel=$('.pv-panel'),picks=$('.pv-picks'),cbtn=$('.pv-cbtn'),fades=[panel,$('.pv-x'),$('.pv-nav')];
let cur=-1,cmp=-1,from=null,closing=false,live=[];

const title=g=>(g.short||g.name)+(g.col?`, ${g.col.toLowerCase()}`:'');
// A ratio means nothing to a stranger, so each one is said against the rest of the set, with its place on a line from the set's least to its most.
const against=(key,[most,more,less,least])=>g=>{
  const v=+g[key],all=G.map(x=>+x[key]),lo=Math.min(...all),hi=Math.max(...all),rank=all.filter(x=>x<v).length/(N-1);
  const word=v===hi?`${most} of ${N}`:v===lo?`${least} of ${N}`:rank>=.66?`${more} than most`:rank<=.33?`${less} than most`:'Middle of the set';
  return `<span title="${v.toFixed(3)}, share of garment height">${word}<i class="pv-line" style="--x:${(hi>lo?(v-lo)/(hi-lo):.5).toFixed(3)}"></i></span>`;
};
const fit=g=>g.details?.find(l=>/\bfit\b/i.test(l))||'';
const gsm=g=>(g.details?.join(' ').match(/(\d+) GSM/)||[])[1];
const ROWS=[
  ['Price',(g,o)=>o?money(g.price):''],
  ['Material',g=>g.material||''],
  ['Weight',g=>gsm(g)?gsm(g)+' GSM':''],
  ['Fit',fit],
  ['By price',g=>{const r=prices.indexOf(g)+1;return r===1?`Cheapest of ${N}`:r===N?`Dearest of ${N}`:`${r} of ${N}, low to high`}],
  ['Hood',g=>`${g.hood_crown} crown, ${g.hood_mouth} mouth`.replace(/^./,c=>c.toUpperCase())],
  ['Shoulders',against('shoulder_width_ratio',['Widest','Wider','Narrower','Narrowest'])],
  ['Body',against('body_length_ratio',['Longest','Longer','Shorter','Shortest'])],
  ['Hood height',against('hood_height_ratio',['Tallest','Taller','Shorter','Shortest'])],
  ['Sleeves fall',against('sleeve_drop',['Lowest','Lower','Higher','Highest'])],
];
// Notes the rows above do not already say. A bare "Cotton" only repeats Material.
const notes=g=>(g.details||[]).filter(l=>l!==fit(g)&&!/^\d+ GSM$/.test(l)&&!/^cotton( blend)?$/i.test(l));
const link=(g,o)=>g.url?.startsWith('https://')?`<a href="${attr(g.url)}" target="_blank" rel="noopener">View${o?' '+(g.short||g.name):''} at ${g.source_store}<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 9l8-8M2 1h7v7"/></svg></a>`:'';

function setImg(im,g){
  im.alt=g.name;im.src=g.image_600;
  const hi=new Image();hi.src=g.image;hi.decode().then(()=>{if(im.alt===g.name)im.src=g.image}).catch(()=>{});
}
function render(){
  const g=G[cur],o=cmp>=0?G[cmp]:null;
  dlg.style.setProperty('--pr',css(g.room));dlg.style.setProperty('--pi',css(g.ink));
  $('.pv-brand').textContent=o?`${g.brand} / ${o.brand}`:g.brand;
  $('#pvT').textContent=o?`${title(g)} / ${title(o)}`:title(g);
  $('.pv-price').textContent=o?`${money(g.price)} / ${money(o.price)}`:money(g.price);
  $('.pv-go').innerHTML=link(g,o)+(o?link(o,g):'');
  $('.pv-facts').innerHTML=(o?`<tr><th></th><td><strong>${g.brand}</strong><br>${title(g)}</td><td><strong>${o.brand}</strong><br>${title(o)}</td></tr>`:'')+ROWS.map(([l,f])=>{const a=f(g,o),b=o?f(o,g):'';return a||b?`<tr><th scope="row">${l}</th><td>${a}</td>${o?`<td>${b}</td>`:''}</tr>`:''}).join('');
  const nt=$('.pv-notes');nt.hidden=!!o;nt.innerHTML=notes(g).map(l=>`<li>${l.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</li>`).join('');
  $('.pv-small').textContent=`Notes and price are the store's own, in USD. Shoulders, body, hood and sleeves are read from the photograph as a share of garment height and set against the other ${N-1}: shape, not size.`;
  {const o=order();$('.pv-n').textContent=`${String(o.indexOf(cur)+1).padStart(2,'0')}/${o.length}`}
  setImg(img,g);
  dlg.classList.toggle('two',!!o);other.hidden=!o;if(o)setImg(other,o);
  const room=$('.pv-room');room.hidden=!o;if(o){room.href=`#/splice/${g.id}/${o.id}`;room.textContent='Open both in Compare'}
  live=[...picks.children];live.forEach(b=>{const i=+b.dataset.o;b.hidden=i===cur;b.setAttribute('aria-pressed',i===cmp)});
  if(!picks.children.length)buildPicks();
}
function buildPicks(){
  picks.innerHTML=prices.map(g=>`<button type="button" data-o="${G.indexOf(g)}" aria-pressed="false" aria-label="Compare with ${attr(g.brand)} ${attr(g.short)}, ${money(g.price)}"${G.indexOf(g)===cur?' hidden':''}><img alt="" loading="lazy" src="${g.image_600}"><span>${g.brand}<br>${title(g)}<br>${money(g.price)}</span></button>`).join('');
}
picks.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=+b.dataset.o;cmp=cmp===i?-1:i;render();if(innerWidth<=760)dlg.scrollTo({top:0,behavior:S.reduced?'auto':'smooth'})}); // on a phone the two pieces are above the fold, so a pick must show them
cbtn.addEventListener('click',()=>{const on=picks.hidden;picks.hidden=!on;cbtn.setAttribute('aria-expanded',on);if(on&&!picks.children.length)buildPicks();if(on)picks.scrollIntoView({block:'nearest',behavior:S.reduced?'auto':'smooth'})});

// The room's own order, so the number and the arrows agree with the row behind the sheet. A room without one falls back to the set's.
const order=()=>{const r=S.rooms?.[S.room],o=r?.stops?r.stops().map((_,s)=>r.piece(s)).filter(i=>i>=0):[];return o.includes(cur)?o:G.map((_,i)=>i)};
const step=d=>{const o=order();S.stepPiece(G[o[(o.indexOf(cur)+d+o.length)%o.length]].id)};
$('.pv-p').addEventListener('click',()=>step(-1));$('.pv-q').addEventListener('click',()=>step(1));
$('.pv-x').addEventListener('click',()=>S.closePiece());
// Esc must run the same way out as everything else, so the URL and the animation stay honest.
dlg.addEventListener('cancel',e=>{e.preventDefault();S.closePiece()});
dlg.addEventListener('close',()=>{if(!closing&&cur>=0){cur=-1;S.closePiece()}});
dlg.addEventListener('keydown',e=>{
  if(e.target.closest?.('.pv-picks'))return;
  if(e.key==='ArrowLeft')step(-1);else if(e.key==='ArrowRight')step(1);
});
dlg.addEventListener('click',e=>{if(e.target===dlg||e.target===bg||e.target===panel||e.target.classList.contains('pv-stage'))S.closePiece()});

// Phone: pull the garment down to put it back. The view follows the finger a little slower than the finger.
// Sideways does what the row behind it taught: the next piece.
let pull=null,x0=0,y0=0;
const stageEl=$('.pv-stage');
stageEl.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;pull=dlg.scrollTop<=0?y0:null},{passive:true});
stageEl.addEventListener('touchmove',e=>{
  const dx=e.touches[0].clientX-x0,dy=e.touches[0].clientY-y0;
  if(Math.abs(dx)>Math.abs(dy)){dlg.style.transform='';img.style.transform=`translateX(${dx*.6}px)`}
  else if(pull!==null){img.style.transform='';dlg.style.transform=`translateY(${Math.max(0,dy)*.8}px)`}
},{passive:true});
stageEl.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;img.style.transform='';
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){dlg.style.transform='';step(dx<0?1:-1)}
  else if(pull!==null&&dy>110)S.closePiece();else dlg.style.transform='';
  pull=null;
},{passive:true});

const EASE='cubic-bezier(.16,1,.3,1)';
function flight(o){
  const f=img.getBoundingClientRect(),s=o.c/f.width;
  return [{transformOrigin:'0 0',transform:`translate(${o.x-f.left}px,${o.y-f.top}px) scale(${s})`,clipPath:`inset(0 ${(1-o.r)*100}% 0 ${o.l*100}%)`},{transformOrigin:'0 0',transform:'none',clipPath:'inset(0 0% 0 0%)'}];
}
// Starts as the window the piece was seen through, not its whole canvas, and the text waits for a filled sheet so it never ghosts in low contrast.
const veil=o=>{const l=Math.max(0,o.x+o.l*o.c),r=Math.max(0,innerWidth-o.x-o.r*o.c),b=Math.max(0,innerHeight-o.y-o.c);return [{clipPath:`inset(${Math.max(0,o.y)}px ${r}px ${b}px ${l}px)`},{clipPath:'inset(0 0 0 0)'}]};
function openAnim(o){
  if(S.reduced)return;
  const d=440;
  if(o){img.animate(flight(o),{duration:d,easing:EASE});bg.animate(veil(o),{duration:d,easing:EASE})}
  else dlg.animate([{opacity:0},{opacity:1}],{duration:240});
  for(const el of fades)el.animate([{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:220,delay:o?260:0,fill:'backwards',easing:EASE});
}

export const isOpen=()=>dlg.open&&!closing;
export function show(g,o){
  const i=G.indexOf(g),fresh=!dlg.open;
  if(closing){closing=false;dlg.getAnimations({subtree:true}).forEach(a=>a.cancel())}
  if(!fresh&&i===cur)return;
  if(fresh){cmp=-1;picks.hidden=true;cbtn.setAttribute('aria-expanded',false)}
  if(i===cmp)cmp=-1;
  cur=i;render();
  document.title=`${g.brand} ${g.short}, soescloset`;
  if(fresh){
    from=o?g:null;
    dlg.style.transform='';dlg.showModal();dlg.scrollTop=0;
    openAnim(o);
  }
}
export function hide(){
  if(!dlg.open||closing)return;
  const g=G[cur];closing=true;dlg.style.transform='';
  const o=from&&cmp<0?S.originOf(g):null;
  // The platform hands focus back to the hanger that opened the view, which would walk the rail back there too.
  const done=()=>{if(closing){closing=false;cur=-1;S.pieceClosing=true;dlg.close();S.pieceClosing=false;const f=document.activeElement;if(f===document.body||dlg.contains(f)||S.moverEl?.contains(f))S.moverEl?.querySelector('button[tabindex="0"]')?.focus({preventScroll:true})}};
  if(S.reduced)return done();
  dlg.scrollTop=0;
  for(const el of fades)el.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'}).onfinish=e=>e.target.cancel();
  const end=o?img.animate(flight(o).reverse(),{duration:420,easing:EASE,fill:'forwards'}):dlg.animate([{opacity:1},{opacity:0}],{duration:200,fill:'forwards'});
  if(o)bg.animate(veil(o).reverse(),{duration:420,easing:EASE,fill:'forwards'});
  end.onfinish=()=>{done();dlg.getAnimations({subtree:true}).forEach(a=>a.cancel())};
}
