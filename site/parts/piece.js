// The shared piece view. A real <dialog> gives focus trap, inert page, Esc and focus return; the rest is a sheet that fades in with the garment rising into it.
import {S,G,money,css,priceLevel,priceTone} from '../core.js';
const dlg=document.getElementById('pv'),N=G.length,prices=[...G].sort((a,b)=>a.price-b.price),LO=prices[0]?.price,HI=prices.at(-1)?.price;
const attr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const Arrow=d=>`<svg viewBox="0 0 16 10" aria-hidden="true"><path d="${d>0?'M0 5h15M11 1l4 4-4 4':'M16 5H1M5 1L1 5l4 4'}"/></svg>`;
dlg.innerHTML=`<div class="pv-bg"></div>
<div class="pv-stage"><div class="pv-card pv-out" hidden><img class="pv-g" alt="" draggable="false"></div><div class="pv-card pv-in"><img class="pv-g" id="pvImg" alt="" draggable="false"></div></div>
<div class="pv-panel">
  <p class="pv-brand"></p>
  <h2 id="pvT" class="pv-name" tabindex="-1" autofocus></h2>
  <b class="six pv-price"></b>
  <div class="pv-bar" aria-hidden="true"><i></i><span>${money(LO||0)}</span><span>${money(HI||0)}</span></div>
  <div class="pv-go"></div>
  <table class="pv-facts"></table>
  <ul class="pv-notes"></ul>
  <p class="pv-small">Details and price are the store's own, in USD.</p>
</div>
<button type="button" class="pv-x">Close</button>
<div class="pv-nav"><button type="button" class="pv-p" aria-label="Previous piece">${Arrow(-1)}</button><span class="pv-n" aria-live="polite"></span><button type="button" class="pv-q" aria-label="Next piece">${Arrow(1)}</button></div>`;
const $=s=>dlg.querySelector(s),img=$('#pvImg'),bg=$('.pv-bg'),panel=$('.pv-panel'),stageEl=$('.pv-stage'),cardIn=$('.pv-in'),cardOut=$('.pv-out'),imgOut=cardOut.firstChild,fades=[panel,$('.pv-x'),$('.pv-nav')];
let cur=-1,closing=false,dir=0;

const title=g=>(g.short||g.name)+(g.col?`, ${g.col.toLowerCase()}`:'');
const fit=g=>g.details?.find(l=>/\bfit\b/i.test(l))||'';
const cap=s=>s.replace(/^./,c=>c.toUpperCase());
const ROWS=[
  ['Fabric',g=>g.material||''],
  // The group in plain words first, then whatever else the store's phrase adds ("Boxy cropped fit" reads "Boxy, cropped").
  ['Fit',g=>{if(!g.fitGroup||g.fitGroup==='Not listed')return '';const more=fit(g).replace(/\bfit\b/ig,'').replace(new RegExp('\\b'+g.fitGroup+'\\b','i'),'').trim().toLowerCase();return g.fitGroup+(more?', '+more:'')}],
  ['Hood',g=>g.hood_crown?cap(`${g.hood_crown} crown, ${g.hood_mouth} mouth`):''],
  ['Price rank',g=>{const r=prices.indexOf(g)+1;return r===1?`Cheapest of ${N}`:r===N?`Dearest of ${N}`:`${r} of ${N}, low to high`}],
];
// The store's own lines, minus what the rows above already say.
const notes=g=>(g.details||[]).filter(l=>l!==fit(g)&&!/^\d+ GSM$/.test(l)&&!/^cotton( blend)?$/i.test(l));
// A store whose name is not the label's is a stockist, and the button says so.
const flat=s=>s.normalize('NFD').replace(/[^a-z]/gi,'').toLowerCase();
const stockist=g=>!flat(g.source_store||'').includes(flat(g.brand));
const link=g=>g.url?.startsWith('https://')?`<a href="${attr(g.url)}" target="_blank" rel="noopener">View at ${esc(g.source_store)}${stockist(g)?' (stockist)':''}<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 9l8-8M2 1h7v7"/></svg></a>`:'';

function setImg(im,g){
  im.alt=g.name;im.src=g.full?g.image:g.image_600; // already decoded full size: no soft-to-sharp swap
  if(g.full)return;
  const hi=new Image();hi.src=g.image;hi.decode().then(()=>{if(im.alt===g.name)im.src=g.image}).catch(()=>{});
}
function render(){
  const g=G[cur];
  // The open piece floods the sheet with its own colour (same rule as hover on Wall and Hood); text uses its AA-checked ink.
  dlg.style.setProperty('--pr',css(g.tint||g.room));dlg.style.setProperty('--pi',css(g.tintInk||g.ink));
  $('.pv-brand').textContent=g.brand;
  $('#pvT').textContent=title(g);
  $('.pv-price').textContent=money(g.price);
  const bar=$('.pv-bar');bar.style.setProperty('--x',priceLevel(g.price).toFixed(3));bar.style.setProperty('--t',priceTone(g.price));
  // Shopper story: from any piece, one step to comparing it. Compare opens with this piece on the left.
  $('.pv-go').innerHTML=link(g)+`<a class="pv-cmp" href="#/splice/${attr(g.id)}">Compare with another</a>`;
  $('.pv-facts').innerHTML=ROWS.map(([l,f])=>{const a=f(g);return a?`<tr><th scope="row">${l}</th><td>${esc(a)}</td></tr>`:''}).join('');
  $('.pv-notes').innerHTML=notes(g).map(l=>`<li>${esc(l)}</li>`).join('');
  const o=order();$('.pv-n').textContent=`${String(o.indexOf(cur)+1).padStart(2,'0')}/${o.length}`;
  setImg(img,g);
}

// The room's own order, so the number and the arrows agree with what is behind the sheet. A room without one falls back to the set's.
const order=()=>{
  const r=S.rooms?.[S.room],x=r?.order?.()||(r?.stops?r.stops().map((_,s)=>r.piece(s)).filter(i=>i>=0):[]);
  return x.includes(cur)?x:G.map((_,i)=>i);
};
const step=d=>{const o=order();dir=d;S.stepPiece(G[o[(o.indexOf(cur)+d+o.length)%o.length]].id)};
$('.pv-p').addEventListener('click',()=>step(-1));$('.pv-q').addEventListener('click',()=>step(1));
$('.pv-x').addEventListener('click',()=>S.closePiece());
// Esc must run the same way out as everything else, so the URL and the animation stay honest.
dlg.addEventListener('cancel',e=>{e.preventDefault();S.closePiece()});
dlg.addEventListener('close',()=>{if(!closing&&cur>=0){cur=-1;S.closePiece()}});
dlg.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}else if(e.key==='ArrowRight'){e.preventDefault();step(1)}
});
dlg.addEventListener('click',e=>{if(e.target===dlg||e.target===bg)S.closePiece()});

// Stepping pieces: the outgoing piece slides aside and fades, the next slides in, then hangs and settles from the hood.
// One experience for everyone (Reduce Motion on or off): slides and fades only, no 3D turn, scale no lower than .97.
const EASE='cubic-bezier(.16,1,.3,1)',FLIP=450;
const away=(d,k=1)=>`translateX(${-d*18*k}%) scale(${1-.03*k})`;
function swap(d,startT){
  if(!d){cardOut.hidden=true;return}
  for(const c of [cardIn,cardOut,img])c.getAnimations().forEach(a=>a.cancel());
  cardOut.hidden=false;
  const out=cardOut.animate([{transform:startT||'none',opacity:1},{transform:away(d),opacity:0}],{duration:FLIP,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  out.onfinish=()=>{cardOut.hidden=true;out.cancel()};
  cardIn.animate([{transform:away(-d,.9),opacity:0},{transform:'none',opacity:1}],{duration:FLIP,easing:EASE});
  img.animate([{rotate:`${d*3.2}deg`},{rotate:`${-d*1.6}deg`,offset:.4},{rotate:`${d*.6}deg`,offset:.72},{rotate:'0deg'}],{duration:1000,delay:FLIP*.55,easing:'ease-in-out',fill:'backwards'});
}

// Drag or swipe sideways: the sheet follows, a far or fast enough flick moves on. Vertical touch stays the sheet's own scroll.
let drag=null;
stageEl.addEventListener('pointerdown',e=>{if(e.button||closing)return;drag={x:e.clientX,y:e.clientY,t:e.timeStamp,on:false,id:e.pointerId,touch:e.pointerType==='touch'}});
stageEl.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.on){if(Math.abs(dx)<(drag.touch?12:6)||Math.abs(dx)<Math.abs(dy))return;drag.on=true;stageEl.setPointerCapture(e.pointerId);stageEl.classList.add('drag')}
  cardIn.style.transform=`translateX(${dx*.85}px)`;
});
const up=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;stageEl.classList.remove('drag');
  if(!d.on)return;
  const dx=e.clientX-d.x,v=dx/Math.max(1,e.timeStamp-d.t),t=cardIn.style.transform;
  // A flick keeps the card where the finger left it until the hashchange swaps pieces; resetting here first painted the old piece back at centre for a frame.
  if(e.type==='pointerup'&&(Math.abs(dx)>innerWidth*.1||Math.abs(v)>.5)){dragFrom=t;step(dx<0?1:-1);return}
  cardIn.style.transform='';
  if(t)cardIn.animate([{transform:t},{transform:'none'}],{duration:320,easing:EASE});
};
let dragFrom='';
stageEl.addEventListener('pointerup',up);stageEl.addEventListener('pointercancel',up);

// Opening no longer grows the piece out of its tile (a big zoom): the sheet fades in, the piece and its text rise a little. Same for everyone.
function openAnim(){
  dlg.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out'});
  img.animate([{opacity:0,translate:'0 24px'},{opacity:1,translate:'0 0'}],{duration:420,easing:EASE});
  for(const el of fades)el.animate([{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:260,delay:120,fill:'backwards',easing:EASE});
}

export const isOpen=()=>dlg.open&&!closing;
export function show(g,o){
  const i=G.indexOf(g),fresh=!dlg.open;
  if(closing){closing=false;dlg.getAnimations({subtree:true}).forEach(a=>a.cancel())}
  if(!fresh&&i===cur){dir=0;cardIn.style.transform='';return}
  if(!fresh){
    // The outgoing face is copied before the new piece is drawn over it.
    const ox=order(),d=dir||Math.sign(ox.indexOf(i)-ox.indexOf(cur))||1;
    imgOut.src=img.currentSrc||img.src;imgOut.alt='';
    cur=i;render();cardIn.style.transform='';swap(d,dragFrom);dragFrom='';dir=0;
  }else{cur=i;render()}
  document.title=`${g.brand} ${g.short}, soescloset`;
  if(fresh){
    cardOut.hidden=true;
    dlg.style.transform='';dlg.showModal();dlg.scrollTop=0;
    openAnim();
  }
}
export function hide(){
  if(!dlg.open||closing)return;
  const g=G[cur];closing=true;dlg.style.transform='';
  // The room brings the piece last looked at into view behind the sheet.
  S.rooms?.[S.room]?.elOf?.(g);
  // The platform hands focus back to the hanger that opened the view, which would walk the rail back there too.
  const done=()=>{if(closing){closing=false;cur=-1;S.pieceClosing=true;dlg.close();S.pieceClosing=false;const f=document.activeElement;if(f===document.body||dlg.contains(f)||S.moverEl?.contains(f))S.moverEl?.querySelector('button[tabindex="0"]')?.focus({preventScroll:true})}};
  dlg.scrollTop=0;cardOut.hidden=true;
  img.animate([{translate:'0 0'},{translate:'0 16px'}],{duration:240,easing:'ease-in',fill:'forwards'});
  const end=dlg.animate([{opacity:1},{opacity:0}],{duration:240,easing:'ease-in',fill:'forwards'});
  end.onfinish=()=>{done();dlg.getAnimations({subtree:true}).forEach(a=>a.cancel())};
}
