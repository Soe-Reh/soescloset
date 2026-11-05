// Shared stage, timeline and garments. rooms.js moves S.tp; nothing here scrolls. Parts register hooks with S.part(); a throwing hook is switched off, never fatal.
export const $=id=>document.getElementById(id);
export const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v, ss=t=>t*t*(3-2*t), sss=t=>t*t*t*(t*(t*6-15)+10), lerp=(a,b,t)=>a+(b-a)*t, hold=(a,b)=>clamp(a)*(1-clamp(b));
export const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)), css=c=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`, mixc=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const lum=c=>{const f=c.map(v=>{v/=255;return v<.04?v/12.9:((v+.055)/1.055)**2.4});return .2126*f[0]+.7152*f[1]+.0722*f[2]};
export const WHITE=hex('#f6f6f4'),BLACK=hex('#0b0b0b'),money=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
export const mix=(a,b,t)=>t<=0?a:t>=1?b:{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),c:a.c*(b.c/a.c)**t,o:lerp(a.o,b.o,t),l:lerp(a.l,b.l,t),r:lerp(a.r,b.r,t)};
export const vis=(el,o)=>{const on=o>.004;if(el._on!==on){el.style.visibility=on?'visible':'hidden';el._on=on}if(on&&el._o!==o){el.style.opacity=o;el._o=o}};
export const fitWidth=(el,target)=>{el.style.fontSize='100px';const fs=100*target/el.scrollWidth;el.style.fontSize=fs+'px';return fs};
export const add=html=>{$('stage').insertAdjacentHTML('beforeend',html);return $('stage').lastElementChild};
export const CT=100/1600,HH=1245/1600; // canvas fractions: hood top, and hood top to hem

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
G.forEach((g,i)=>{
  const d=hex(g.dominant_hex),L=lum(d);
  // Near-black and tonal dark pieces dissolve on dark, so they get a pale or lifted tinted room. The rest stand on a deeper shade of themselves.
  g.room=L<.035?mixc(d,hex('#e9e8e4'),.9):L<.08?vivid(mixc(d,hex('#e9e8e4'),.56),2):L>.5?mixc(d,BLACK,.22):L>.3?mixc(d,BLACK,.2):mixc(d,BLACK,.34);
  g.ink=lum(g.room)>.26?BLACK:mixc(d,WHITE,.82);
  g.price=+g.price;g.label=money(g.price).slice(1);
  g.short=g.name.replace(g.brand,'').replace(/ - .*/,'').trim();
  g.col=g.colorway||(g.name.match(/ - (.*)/)||[])[1]||'';
  const el=document.createElement('div');el.className='g';el.style.zIndex=100-i;
  el.innerHTML=`<img class="sh" alt="" src="${g.image_shadow}"><img class="ct" alt="${g.name.replace(/"/g,'&quot;')}" decoding="async" ${i?'':'fetchpriority="high"'} src="${g.image_600}">`;
  $('gs').append(el);g.el=el;g.ct=el.lastChild;g.sh=el.firstChild;g.lift=0;g.sw=0;g.swv=0;
});
const N=G.length,last=N-1;
export const stag=(v,n,s=.42)=>sss(clamp(v*(1+s)-s*n/last));

// The live state parts read. A segment whose part is absent reads as 0, so the others carry on.
const q=new Proxy({},{get:(t,k)=>t[k]||0});
const deep=!!location.hash&&location.hash!=='#/';
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const fallback=i=>({x:S.w/2,y:S.h*.085,c:S.h*1.56,o:i?0:1,l:0,r:1});
export const S={G,N,last,q,at:{},total:0,reduced,deep,w:innerWidth,h:innerHeight,pt:false,dpr:1,now:0,dt:16,jump:false,T:0,rail:0,
  tp:0,measure,draw,base:fallback,gr:G[0]?.room||WHITE,ink:G[0]?.ink||BLACK,live:[],mx:-1,my:-1,inside:false,hover:-1,noTip:false,stack:null,part,hit};
window.soescloset=S;
const stage=$('stage');

const parts=[],$sec=[...document.querySelectorAll('main section')];
let segs=[];
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
    Object.assign(S.rooms,p.rooms);
  }
}

function measure(){
  const s=stage.getBoundingClientRect();S.w=s.width;S.h=s.height;S.pt=S.h>S.w*1.15;S.dpr=Math.min(devicePixelRatio||1,2);
  for(const p of parts)if(p.measure)try{p.measure()}catch(e){console.error(p.id,e);p.measure=null}
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
const at=e=>{const s=stage.getBoundingClientRect();S.mx=e.clientX-s.left;S.my=e.clientY-s.top;S.inside=true};
stage.addEventListener('pointermove',at);stage.addEventListener('pointerdown',at);
stage.addEventListener('pointerleave',()=>{S.inside=false;S.hover=-1});

function upgrade(g){if(g.hi)return;g.hi=true;const im=new Image();im.src=g.image;im.decode().then(()=>{g.ct.src=im.src}).catch(()=>{})}
const run=name=>{for(const p of parts)if(p[name])try{p[name]()}catch(e){console.error(p.id,name,e);p[name]=null}};

let prev=performance.now(),lastZ='',lastG='',lastRail=0,prevMx=0,mxs=0;
const hv=$('hov');
function frame(now){requestAnimationFrame(frame);draw(now)}
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
  const brush=S.inside&&!reduced?clamp((S.mx-prevMx)*.05,-1.6,1.6):0;prevMx=S.mx;
  const parallax=S.inside&&!reduced?(S.mx/w-.5):0;mxs+=(parallax-mxs)*.06;
  const live=S.live=[];
  for(let i=0;i<N;i++){
    const g=G[i];let P;
    try{P=S.base(i,S.T)}catch(e){console.error('base',e);S.base=fallback;P=fallback(i)}
    for(const part of parts)if(part.pose)try{P=part.pose(i,P)}catch(e){console.error(part.id,'pose',e);part.pose=null}
    // sub-perceptual life at rest, and depth against the pointer
    if(!reduced){const sz=P.c/1600,whole=P.r-P.l>.9;P.y+=whole?Math.sin(now/2300+i*1.9)*5*sz*(1-clamp(hung)):0;P.x+=(whole?Math.cos(now/3100+i*1.3)*4*sz:0)-mxs*P.c*.018*(q.spliceIn>.01||q.wallIn>.5&&q.meanIn<.5?0:1)}
    if(!reduced){if(S.hover===i&&hung>0)g.swv+=brush;const pull=clamp(-railV*1.3,-2.5,2.5)*hung;g.swv+=(-(24.5+i*3%5*.5)*(g.sw-pull)-2.1*g.swv)*dts;g.sw+=g.swv*dts}
    const tgt=S.hover===i&&q.wallIn<.2?1:0;g.lift+=(tgt-g.lift)*.14;P.c*=1+g.lift*.03;
    P.i=i;live.push(P);
    if(P.o<.004){vis(g.el,0);continue}
    vis(g.el,P.o);
    const s=P.c/1600;
    // A will-change layer keeps its old raster and gets stretched: a crop at rest repaints at true size.
    const wc=S.crisp&&s>.95?'auto':'';if(g._wc!==wc){g._wc=wc;g.el.style.willChange=wc}
    const hang=(Math.abs(g.sw)>.01||g.yaw)&&P.r-P.l>.9?` translate(800px,48px)${g.yaw?` perspective(8000px) rotateY(${g.yaw.toFixed(2)}deg)`:''} rotate(${g.sw.toFixed(3)}deg) skewX(${(g.shear||0).toFixed(3)}deg) translate(-800px,-48px)`:'';
    g.el.style.transform=`translate3d(${(P.x-P.c/2).toFixed(2)}px,${(P.y-P.c*CT).toFixed(2)}px,0) scale(${s.toFixed(5)})${hang}`;
    const clip=(P.l>.0005||P.r<.9995)?`inset(0 ${((1-P.r)*100).toFixed(3)}% 0 ${(P.l*100).toFixed(3)}%)`:'none';
    if(g._clip!==clip){g.el.style.clipPath=clip;g._clip=clip}
    if(Math.abs(P.x-w/2)<w&&P.o>.02&&((P.r-P.l)*P.c*S.dpr>560||P.c*S.dpr>1500))upgrade(g);
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
  if(hovered>=0&&!S.noTip){const g=G[hovered];if(hv._i!==hovered){hv._i=hovered;hv.innerHTML=`<small>${g.brand}</small><b class="six">$${g.label}</b>${g.short}`}
    const P=S.live[hovered];hv.style.transform=`translate3d(${clamp(P.x+P.c*.17,8,w-hv.offsetWidth-8).toFixed(1)}px,${clamp(P.y,60,h-hv.offsetHeight-8).toFixed(1)}px,0) rotate(-3deg)`;vis(hv,1)}else vis(hv,0);
  const cu=hovered>=0?'pointer':q.spliceIn>.9?'ew-resize':'';stage.style.cursor=cu;if(S.moverEl)S.moverEl.style.cursor=cu;

  S.jump=false;delete document.documentElement.dataset.land;
}
if(N)requestAnimationFrame(frame);else console.error('data.json is empty');
