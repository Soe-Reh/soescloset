// Shared stage, timeline and garments. rooms.js moves S.tp; nothing here scrolls. Parts register hooks with S.part(); a throwing hook is switched off, never fatal.
export const $=id=>document.getElementById(id);
export const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v, ss=t=>t*t*(3-2*t), sss=t=>t*t*t*(t*(t*6-15)+10), lerp=(a,b,t)=>a+(b-a)*t, hold=(a,b)=>clamp(a)*(1-clamp(b));
export const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)), css=c=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`, mixc=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const lum=c=>{const f=c.map(v=>{v/=255;return v<.04?v/12.9:((v+.055)/1.055)**2.4});return .2126*f[0]+.7152*f[1]+.0722*f[2]};
export const contrast=(a,b)=>{const x=lum(a)+.05,y=lum(b)+.05;return x>y?x/y:y/x};
export const WHITE=hex('#f6f6f4'),BLACK=hex('#0b0b0b'),money=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
export const mix=(a,b,t)=>t<=0?a:t>=1?b:{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),c:a.c*(b.c/a.c)**t,o:lerp(a.o,b.o,t),l:lerp(a.l,b.l,t),r:lerp(a.r,b.r,t)};
export const vis=(el,o)=>{const on=o>.004;if(el._on!==on){el.style.visibility=on?'visible':'hidden';el._on=on}if(on&&el._o!==o){el.style.opacity=o;el._o=o}};
export const fitWidth=(el,target)=>{el.style.fontSize='100px';const fs=100*target/el.scrollWidth;el.style.fontSize=fs+'px';return fs};
export const add=html=>{$('stage').insertAdjacentHTML('beforeend',html);return $('stage').lastElementChild};
export const CT=100/1600,HH=1245/1600; // canvas fractions: hood top, and hood top to hem

import {dk} from './motion.js'; // round 3: frame-rate independent damping for the lerps below

const getData=()=>fetch('data.json').then(r=>r.json());
const data=await getData().catch(()=>new Promise(r=>setTimeout(r,400)).then(getData)).catch(e=>(console.error(e),[]));

// Colour chain, so each room slides into the next. Opens on the chosen piece (or the first if it has gone) and ends on the palest neutral, which hands over to white.
const OPENER='madhappy-cabernet';
function chain(items){
  const rest=[...items],take=e=>rest.splice(rest.indexOf(e),1)[0],d=(a,b)=>Math.hypot(...hex(a.dominant_hex).map((v,i)=>v-hex(b.dominant_hex)[i]));
  const pale=e=>{const c=hex(e.dominant_hex);return lum(c)-(Math.max(...c)-Math.min(...c))/255};
  const out=[take(rest.find(e=>e.id===OPENER)||rest[0])];
  const end=rest.length?take(rest.reduce((a,b)=>pale(b)>pale(a)?b:a)):null;
  while(rest.length)out.push(take(rest.reduce((a,b)=>d(b,out.at(-1))<d(a,out.at(-1))?b:a)));
  return end?[...out,end]:out;
}
export const G=data.length?chain(data):[];
const vivid=(c,k)=>{const m=(c[0]+c[1]+c[2])/3;return c.map(v=>clamp(m+(v-m)*k,0,255))};
// Loose to fitted: the order fit sorts use everywhere.
export const FIT_ORDER=['Oversized','Boxy','Relaxed','Regular','Not listed'];
G.forEach((g,i)=>{
  const d=hex(g.dominant_hex),L=lum(d);
  // Near-black and tonal dark pieces dissolve on dark, so they get a pale or lifted tinted room. The rest stand on a deeper shade of themselves.
  // v5: one neutral studio grey for every room, so each garment shows its true colour and none sets the page's mood. Ink is always near-black.
  g.room=hex('#e1e1df');g.ink=hex('#111111');void L;
  // The original's room colour, kept as the flood a room takes while one piece is hovered or held: the piece takes over the room, then it goes back to grey. Nudged until its ink clears 4.5:1.
  g.tint=L<.035?mixc(d,hex('#e9e8e4'),.9):L<.08?vivid(mixc(d,hex('#e9e8e4'),.56),2):L>.5?mixc(d,BLACK,.22):L>.3?mixc(d,BLACK,.2):mixc(d,BLACK,.34);
  g.tintInk=lum(g.tint)>.26?BLACK:mixc(d,WHITE,.82);
  for(let k=0;k<30&&contrast(g.tint,g.tintInk)<4.5;k++)g.tint=mixc(g.tint,g.tintInk===BLACK?WHITE:BLACK,.06);
  g.price=+g.price;g.label=money(g.price).slice(1);
  g.short=g.name.replace(g.brand,'').replace(/ - .*/,'').trim();
  // Fit, grouped from the store's own wording so it can be sorted. Drop shoulder is a shoulder style on a regular body, so it counts as Regular.
  {const f=((g.details||[]).find(x=>/fit/i.test(x))||'').toLowerCase();g.fitGroup=/oversized/.test(f)?'Oversized':/boxy/.test(f)?'Boxy':/relaxed/.test(f)?'Relaxed':f?'Regular':'Not listed';g.fitRank=FIT_ORDER.indexOf(g.fitGroup)}
  g.col=g.colorway||(g.name.match(/ - (.*)/)||[])[1]||'';
  const el=document.createElement('div');el.className='g';el.style.zIndex=100-i;
  // The shadow waits for every small picture (see `whole` below), so on a slow line the garments come first.
  el.innerHTML=`<img class="sh" alt=""><img class="ct" alt="${g.name.replace(/"/g,'&quot;')}" decoding="async" ${i?'':'fetchpriority="high"'} src="${g.image_600}">`;
  $('gs').append(el);g.el=el;g.ct=el.lastChild;g.sh=el.firstChild;g.lift=0;g.sw=0;g.swv=0;
});
const N=G.length,last=N-1;
// Price is the site's only data colour: pale for the cheapest, near-black for the dearest, on a log scale.
const PR=G.map(g=>g.price),PLO=Math.min(...PR),PHI=Math.max(...PR);
export const priceLevel=p=>PHI>PLO?Math.log(p/PLO)/Math.log(PHI/PLO):1,priceTone=p=>css(mixc(hex('#b3b3ae'),hex('#111111'),clamp(priceLevel(p))));
export const stag=(v,n,s=.42)=>sss(clamp(v*(1+s)-s*n/last));

// The live state parts read. A segment whose part is absent reads as 0, so the others carry on.
const q=new Proxy({},{get:(t,k)=>t[k]||0});
const deep=!!location.hash&&location.hash!=='#/';
const fallback=i=>({x:S.w/2,y:S.h*.085,c:S.h*1.56,o:i?0:1,l:0,r:1});
export const S={G,N,last,q,at:{},total:0,deep,w:innerWidth,h:innerHeight,pt:false,dpr:1,now:0,dt:16,jump:false,T:0,rail:0,
  measure,draw,base:fallback,gr:G[0]?.room||WHITE,ink:G[0]?.ink||BLACK,live:[],mx:-1,my:-1,inside:false,hover:-1,noTip:false,stack:null,part,hit};
// Anything that sets the timeline wakes the loop, so movers, films and room changes need no wake call of their own.
let tp=0,until=0,asleep=true,prev=performance.now();Object.defineProperty(S,'tp',{get:()=>tp,set:v=>{if(v!==tp){tp=v;wake()}},enumerable:true});
window.soescloset=S;
const stage=$('stage');

const parts=[],$sec=[...document.querySelectorAll('main section')];
let segs=[];const owner={}; // room name to the part that runs it, which alone can say the room has come to rest
function part(id,def){
  const p={id,...def};
  parts.push(p);parts.sort((a,b)=>$sec.indexOf($(a.id))-$sec.indexOf($(b.id)));
  $(id).dataset.ready='';
  layout();
  try{p.measure?.()}catch(e){console.error(id,e)}
}
// Timeline positions come from the parts' own segments. A missing part just leaves a shorter timeline.
function layout(){
  S.total=0;S.at={};segs=[];S.rooms={};
  for(const p of parts){
    for(const [n,l] of p.segs||[]){S.at[n]=[S.total,l];segs.push(n);S.total+=l}
    Object.assign(S.rooms,p.rooms);for(const k in p.rooms)owner[k]=p;
  }
}

function measure(){
  const s=stage.getBoundingClientRect();S.w=s.width;S.h=s.height;S.pt=S.h>S.w*1.15;S.dpr=Math.min(devicePixelRatio||1,2);
  for(const p of parts)if(p.measure)try{p.measure()}catch(e){console.error(p.id,e);p.measure=null}
  wake();
}
measure();
addEventListener('resize',measure);
Promise.all([document.fonts.ready,document.fonts.load('100px Six')]).then(measure,measure);

// Topmost garment under the pointer.
function hit(){
  let best=-1,bz=-1;
  for(const P of S.live){if(P.o<.3||!P.g)continue;const z=+P.g.el.style.zIndex||0;if(Math.abs(S.mx-P.x)<P.c*.3&&S.my>P.y&&S.my<P.y+P.c*.82&&z>bz){best=P.i;bz=z}}
  return best;
}
stage.insertAdjacentHTML('beforeend','<div id="hov"></div>');
const at=e=>{const s=stage.getBoundingClientRect();S.mx=e.clientX-s.left;S.my=e.clientY-s.top;S.inside=true;wake()};
stage.addEventListener('pointermove',at);stage.addEventListener('pointerdown',at);
stage.addEventListener('pointerleave',()=>{S.inside=false;S.hover=-1;wake()});
// The loop sleeps on a still room, so whatever can change the picture without moving the timeline wakes it.
for(const t of ['hashchange','keydown','wheel','touchstart'])addEventListener(t,()=>wake(),{passive:true});

// Round 4: every garment picture shows whole or not at all. Until its own decode() resolves it is hidden behind a soft blob in its
// dominant color (core.css img.wait), so a slow line never shows a blank, half-drawn or popping hoodie. Covers every room's <img>, later ones too.
const DC={};for(const g of G){DC[g.image_600]=DC[g.image]=g.dominant_hex}
function whole(root){
  for(const im of root.tagName==='IMG'?[root]:root.querySelectorAll?.('img')||[]){
    const c=DC[im.getAttribute('src')];if(!c||im._w)continue;im._w=1;
    if(im.complete&&im.naturalWidth)continue;
    im.style.setProperty('--dc',c);im.classList.add('wait');
    // A dropped request is asked for again (twice, a second apart); until then the blob stands in, never a broken image.
    let tries=0;const done=()=>{im.classList.remove('wait');wake()},fail=()=>{if(tries++<2)setTimeout(()=>{const u=im.getAttribute('src');im.src=u;im.decode().then(done,fail)},1000)};
    im.decode().then(done,()=>im.complete&&im.naturalWidth?done():fail());
  }
}
whole(document);
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)whole(n)}).observe(document.body,{childList:true,subtree:true});
// All 17 small pictures decoded; full-size ones and shadows wait for this, so nothing competes with them on a slow line.
export const smallIn=Promise.all(G.map(g=>g.ct.decode().catch(()=>{}))).then(()=>{for(const g of G){let n=0;g.sh.onerror=()=>{if(n++<2)setTimeout(()=>{g.sh.src=g.image_shadow+'#r'+n},1000)};g.sh.src=g.image_shadow}}); // shadows retry a dropped request too
S.smallIn=smallIn;

// Full-size pictures: asked for by sharpen(), fetched one at a time after smallIn, decoded off screen, and swapped in only while the room
// is at rest (or the piece is hidden), so a piece never sharpens mid-gesture. g.hi=false asks for the small one back the same way, to free memory.
const hiQ=new Set();let hiRun=false;
export function sharpen(g){if(g.hi)return;g.hi=true;hiQ.add(g);if(!hiRun)pump()}
async function pump(){
  hiRun=true;await smallIn;
  for(const g of hiQ){hiQ.delete(g);if(!g.hi||g.full)continue;const im=new Image();im.src=g.image;try{await im.decode();g.full=im;wake()}catch{}}
  hiRun=false;
}
function swap(g){
  if(!g.hi)g.full=null;const big=!!g.full;if(!!g.big===big)return;g.big=big;
  g.ct.src=big?g.image:g.image_600;
}
// Display size is judged at no more than 1.5 device pixels per CSS pixel: past that the extra raster costs more than it shows.
const DPR=()=>Math.min(S.dpr,1.5);
const run=name=>{for(const p of parts)if(p[name])try{p[name]()}catch(e){console.error(p.id,name,e);p[name]=null}};

let lastZ='',lastG='',lastRail=0,prevMx=0,mxs=0,life=1,coreBusy=true;
const hv=$('hov');
// Draw only while something moves: a room whose part says it is at rest (busy() false) lets the loop sleep; input, resize, images and the timeline wake it. A part without busy() keeps its room drawing every frame, as before.
function wake(ms=600){const t=performance.now();until=Math.max(until,t+ms);if(asleep&&N){asleep=false;prev=t-16;requestAnimationFrame(frame)}}
S.wake=wake;
function frame(now){
  draw(now);
  const p=owner[S.room],rest=S.ready&&now>until&&(S.room==='index'||!!p?.busy&&!coreBusy&&life<.01&&!p.busy());
  // A room that never rests (no busy()) swaps as before; one that rests swaps on the frame it stops.
  if(rest||!p?.busy)for(const g of G)swap(g);
  if(rest)asleep=true;else requestAnimationFrame(frame);
}
// rooms.js also calls this inside a View Transition, so the new room is on screen in the same task.
function draw(now){
  const dt=Math.min(64,now-prev),{w,h}=S;prev=now;S.now=now;S.dt=dt;
  if(!S.ready||S.room==='index')return; // the index is a page of its own, the stage sleeps under it
  const p=S.tp;
  for(const n of segs)q[n]=clamp((p-S.at[n][0])/S.at[n][1]);
  S.p=p;S.stack=null;

  run('pre');

  // Rail speed in pieces per second. Whatever hangs from the rail trails it and settles, so the procession has mass.
  const dts=dt/1000,railV=dts>0&&!S.jump?(S.rail-lastRail)/dts:0;lastRail=S.rail;
  const hung=(1-clamp(q.wallIn*3))+clamp((q.priceIn-.8)*5)*(1-clamp(q.spliceIn*5));
  const brush=S.inside?clamp((S.mx-prevMx)*.05,-1.6,1.6):0;prevMx=S.mx;
  const parallax=S.inside?(S.mx/w-.5):0;mxs+=(parallax-mxs)*dk(3.7,dts);
  const live=S.live=[];coreBusy=false;const want=S.want?.();
  // The resting bob fades out before the loop sleeps and back in on waking, so a piece never jumps when it stops or starts.
  const canRest=!!owner[S.room]?.busy;life+=((canRest&&now>until?0:1)-life)*(canRest?dk(3.1,dts):1);
  for(let i=0;i<N;i++){
    const g=G[i];let P;
    try{P=S.base(i,S.T)}catch(e){console.error('base',e);S.base=fallback;P=fallback(i)}
    for(const part of parts)if(part.pose)try{P=part.pose(i,P)}catch(e){console.error(part.id,'pose',e);part.pose=null}
    // round 3: a rail pulled past its end gives as a whole (mover.js sets S.over, already rubber-banded)
    if(S.over)P.x-=S.over;
    // sub-perceptual life at rest, and depth against the pointer
    // Slow drift, a gentle pointer lean and the cloth sway are motion-safe, so they play for everyone (Reduce Motion on or off).
    {const sz=P.c/1600,whole=P.r-P.l>.9;P.y+=whole?Math.sin(now/2300+i*1.9)*5*sz*(1-clamp(hung))*life:0;P.x+=(whole?Math.cos(now/3100+i*1.3)*4*sz*life:0)-mxs*P.c*.018*(q.spliceIn>.01||q.wallIn>.5&&q.meanIn<.5?0:1)}
    {if(S.hover===i&&hung>0)g.swv+=brush;const pull=clamp(-railV*1.3,-2.5,2.5)*hung;g.swv+=(-(24.5+i*3%5*.5)*(g.sw-pull)-2.1*g.swv)*dts;g.sw+=g.swv*dts;if(Math.abs(g.swv)>.1||Math.abs(g.sw-pull)>.02)coreBusy=true}
    const tgt=S.hover===i&&q.wallIn<.2?1:0;g.lift+=(tgt-g.lift)*dk(9,dts);if(Math.abs(tgt-g.lift)>.002)coreBusy=true;P.c*=1+g.lift*.03;
    P.i=i;live.push(P);
    if(P.o<.004){vis(g.el,0);swap(g);continue} // a hidden piece may change picture unseen
    vis(g.el,P.o);
    const s=P.c/1600;
    // Round 4: a turned piece is a 2D squeeze and a slight shear, not a 3D rotateY, so it never forces a layer of its own.
    const yr=(g.yaw||0)*Math.PI/180;
    const hang=(Math.abs(g.sw)>.01||g.yaw)&&P.r-P.l>.9?` translate(800px,48px)${g.yaw?` scale(${Math.cos(yr).toFixed(4)},1) skewY(${(Math.sin(yr)*4).toFixed(3)}deg)`:''} rotate(${g.sw.toFixed(3)}deg) skewX(${(g.shear||0).toFixed(3)}deg) translate(-800px,-48px)`:'';
    g.el.style.transform=`translate3d(${(P.x-P.c/2).toFixed(2)}px,${(P.y-P.c*CT).toFixed(2)}px,0) scale(${s.toFixed(5)})${hang}`;
    const clip=(P.l>.0005||P.r<.9995)?`inset(0 ${((1-P.r)*100).toFixed(3)}% 0 ${(P.l*100).toFixed(3)}%)`:'none';
    if(g._clip!==clip){g.el.style.clipPath=clip;g._clip=clip}
    // Sharp where it shows: a room can name its pieces (S.want, the Walk keeps the open one and its neighbors); otherwise any big piece facing the viewer.
    if(want?want.includes(i):Math.abs(g.yaw||0)<20&&Math.abs(P.x-w/2)<w&&P.o>.02&&((P.r-P.l)*P.c*DPR()>560||P.c*DPR()>1500))sharpen(g);
    else if(g.hi&&(want||Math.abs(g.yaw||0)>40||Math.abs(P.x-w/2)>w*1.5))g.hi=false;
    const sho=P.r-P.l>.8?1:0;if(g._s!==sho){g.sh.style.display=sho?'':'none';g._s=sho}
    P.g=g;
  }

  // Stacking per scene: parts claim S.stack in pre.
  const [scene,zf]=S.stack||['w',i=>100-i];
  if(scene!==lastZ){lastZ=scene;G.forEach((g,i)=>g.el.style.zIndex=zf(i))}

  const gcss=css(S.gr);
  if(gcss!==lastG){lastG=gcss;const r=document.documentElement.style;r.setProperty('--ground',gcss);r.setProperty('--ink',css(S.ink))}

  run('draw');

  // Hover: the first part that claims the pointer names the piece.
  let hovered=-1;S.noTip=false;
  if(S.inside)for(const part of parts)if(part.hover)try{const r=part.hover();if(r>=0){hovered=r;break}}catch(e){console.error(part.id,'hover',e);part.hover=null}
  S.hover=hovered;
  if(hovered>=0&&!S.noTip){const g=G[hovered];if(hv._i!==hovered){hv._i=hovered;hv.innerHTML=`<small>${g.brand}</small><b class="six">$${g.label}</b>${g.short}`;hv._w=hv.offsetWidth;hv._h=hv.offsetHeight} // the tip's size is read once per piece, not every frame
    const P=S.live[hovered];hv.style.transform=`translate3d(${clamp(P.x+P.c*.17,8,w-hv._w-8).toFixed(1)}px,${clamp(P.y,60,h-hv._h-8).toFixed(1)}px,0) rotate(-3deg)`;vis(hv,1)}else vis(hv,0);
  const cu=hovered>=0?'pointer':q.spliceIn>.9?'ew-resize':'';stage.style.cursor=cu;if(S.moverEl)S.moverEl.style.cursor=cu;

  S.jump=false;delete document.documentElement.dataset.land;
}
if(N)wake();else console.error('data.json is empty');
