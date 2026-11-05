import {S,G,$,clamp,sss,lum,hex,money,css,vis,CT,HH,WHITE,BLACK} from '../core.js';
const {N,reduced}=S,box=$('index'),EASE='cubic-bezier(.22,1,.36,1)';
const pad=n=>String(n).padStart(2,'0'),key=s=>s.toLocaleLowerCase('en');
const attr=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const ref=g=>`href="#/piece/${g.id}" data-piece="${g.id}"`;

// Labels A to Z, each label's pieces cheapest first. Only piece numbers tie it back to the walk.
const brands=[...new Set(G.map(g=>g.brand))].sort((a,b)=>key(a).localeCompare(key(b),'en')).map(b=>G.filter(g=>g.brand===b).sort((x,y)=>x.price-y.price));
const flat=brands.flat(),byPrice=[...G].sort((a,b)=>a.price-b.price),lo=byPrice[0],hi=byPrice.at(-1);
box.innerHTML=`<div id="ixhead"><h2>Index, A to Z</h2><p>${N} pieces from ${brands.length} labels</p></div>
<ol id="ixrows">${brands.map((ps,b)=>{const L=ps[0].brand[0].toUpperCase(),prev=b?brands[b-1][0].brand[0].toUpperCase():'';
  return `<li class="ixrow"><span class="ixl" aria-hidden="true">${L===prev?'':L}</span>
<h3 class="ixn six"><a tabindex="-1" ${ref(ps[0])}><span>${ps[0].brand}</span></a></h3>
<ul class="ixp">${ps.map(g=>`<li><a ${ref(g)} data-i="${flat.indexOf(g)}"><img alt="${attr(g.name)}" loading="lazy" src="${g.image_600}"><b class="num">${pad(G.indexOf(g)+1)}</b><span>${g.short||g.name}${g.col?', '+g.col.toLowerCase():''}</span><span class="num">$${g.label}</span></a></li>`).join('')}</ul></li>`}).join('')}</ol>
<div id="end" style="background:${N?css(G[0].room):''}"><div id="endPin">
<div id="endW" class="six" aria-hidden="true">${[...'soescloset'].map(c=>`<span>${c}</span>`).join('')}</div>
<div id="endRail"></div>
<div id="endGs" aria-hidden="true">${byPrice.map((g,r)=>`<div class="eg" data-piece="${g.id}" style="z-index:${N-Math.abs(2*r-N+1)}"><img alt="${attr(g.name)}" decoding="async" src="${g.image_600}"></div>`).join('')}</div>
<p class="endT num" id="endLo">${N?money(lo.price):''}</p><p class="endT num" id="endHi">${N?money(hi.price):''}</p>
<div id="endN"><p>Cutouts made from each store's own product photograph, then graded to one light.</p><p>Prices as listed in USD.</p></div>
</div></div>`;
const list=$('ixrows'),rows=[...list.children];

// Reveal
if(!reduced){
  box.classList.add('rv');
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{rootMargin:'0px 0px -6% 0px'});
  rows.forEach(r=>io.observe(r));
}

// Reel. Slides are built on first use: 25 stacked images would only cost memory for a visitor who never hovers.
const fine=matchMedia('(hover:hover) and (min-width:761px)');
box.insertAdjacentHTML('beforeend','<p id="ixnote">soescloset is an independent comparison and is not affiliated with any brand or store. Product images and names belong to their owners. Prices were read from each brand or store site and may have changed, so check the link.</p>');
box.insertAdjacentHTML('beforeend','<div id="reel" aria-hidden="true"><div id="reelT"><div id="reelS"></div></div></div>');
const reel=$('reel'),reelT=$('reelT'),reelS=$('reelS'),slides=[];
let cur=-1,on=false,rx=0,ry=0,tilt=0,tiltV=0,hiT=0,px=-1,py=-1;
const slide=i=>{
  if(slides[i])return slides[i];
  const g=flat[i],s=document.createElement('div');s.className='rsl';
  s.innerHTML=`<img alt="" class="sh" src="${g.image_shadow}"><img alt="${attr(g.name)}" src="${g.image_600}">`;
  reelS.append(s);return slides[i]=s;
};
function show(i){
  if(i===cur)return;
  const inn=slide(i),out=slides[cur],d=Math.sign(i-cur)||1;
  inn.classList.add('on');
  if(!reduced&&on){
    // Only the two pieces in play move, so a long jump costs the same as a short one. Same film direction as the list.
    inn.animate([{transform:`translateY(${d*100}%)`},{transform:'none'}],{duration:500,easing:EASE});
    if(out)out.animate([{transform:'none'},{transform:`translateY(${-d*100}%)`}],{duration:500,easing:EASE}).onfinish=()=>{if(cur!==+out.dataset.i)out.classList.remove('on')};
  }else if(out)out.classList.remove('on');
  inn.dataset.i=cur=i;
  rows.forEach(r=>r.classList.toggle('act',r.contains(link(i))));
  list.querySelectorAll('.ixp a.act').forEach(a=>a.classList.remove('act'));
  const a=link(i);a.classList.add('act');
  const name=a.closest('.ixrow').querySelector('.ixn a');name.href=a.getAttribute('href');name.dataset.piece=a.dataset.piece;
  // Sharp only once it has stopped: a jump through the list should not fetch every master.
  clearTimeout(hiT);
  if(S.dpr>1)hiT=setTimeout(()=>{const g=flat[i],im=new Image();im.src=g.image;im.decode().then(()=>{inn.lastChild.src=im.src}).catch(()=>{})},650);
}
const link=i=>list.querySelector(`a[data-i="${i}"]`);
function place(x,y,row){
  const rs=reel.offsetWidth,lim=innerWidth-innerWidth*.3-20-12;
  // The piece stands beside its name, never on it. A name too long for that gives way at its tail.
  x=Math.max(x,row.querySelector('.ixn span').getBoundingClientRect().right+rs*.36);
  x=Math.min(x,lim-rs*.2);
  // hood clear of the top chrome, hem clear of the screen's bottom edge
  const nx=Math.round(reduced?lim-rs*.5:x-rs/2),ny=Math.round(reduced?innerHeight/2-rs/2:clamp(y-rs*.42,34-rs*CT,innerHeight-rs*.88));
  if(on)tiltV+=clamp((nx-rx)*.5,-14,14);
  rx=nx;ry=ny;
  reel.style.transform=`translate3d(${nx}px,${ny}px,0)`;
}
function enter(){
  if(on)return;
  reel.style.transition='none';reel.getBoundingClientRect();
  on=true;reel.classList.add('on');list.classList.add('live');
  requestAnimationFrame(()=>reel.style.transition='');
}
function leave(){
  if(!on)return;
  on=false;reel.classList.remove('on');list.classList.remove('live');
  rows.forEach(r=>r.classList.remove('act'));
}
// A label with several pieces scrubs them across the row.
const pick=(row,x)=>{const as=[...row.querySelectorAll('.ixp a')],b=row.getBoundingClientRect();return +as[clamp(Math.floor((x-b.left)/b.width*as.length),0,as.length-1)].dataset.i};
function at(x,y,el){
  const row=el?.closest?.('.ixrow');
  if(!row||!list.contains(row)){leave();return}
  const a=el.closest('.ixp a'),i=a?+a.dataset.i:pick(row,x);
  show(i);enter();place(x,y,row);
}
// Tracked on the whole page, not the list: the sheet rises under a resting pointer, and the reel must answer without waiting for a nudge.
addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!fine.matches)return;px=e.clientX;py=e.clientY;if(list.contains(e.target))at(px,py,e.target);else if(!list.contains(document.activeElement)||!document.activeElement.matches(':focus-visible'))leave()},{passive:true});
addEventListener('scroll',()=>{if(S.room==='index'&&px>=0&&fine.matches)at(px,py,document.elementFromPoint(px,py))},{passive:true});
list.addEventListener('focusin',e=>{
  const a=e.target.closest('.ixp a');if(!a||!fine.matches||!a.matches(':focus-visible'))return;
  const b=a.getBoundingClientRect();show(+a.dataset.i);enter();place(b.left,b.top+b.height/2,a.closest(".ixrow"));
});
list.addEventListener('focusout',e=>{if(!list.contains(e.relatedTarget)&&!list.matches(':hover'))leave()});

// Ending: the closet's rail fans out by price while the wordmark's doors shut, mirroring the opening.
const endEl=$('end'),pin=$('endPin'),rail=$('endRail'),egs=[...$('endGs').children],wl=[...$('endW').children];
const lox=$('endLo'),hix=$('endHi');
let endTop=0,endLen=1,endC=0,railY=0,ep=reduced?1:0,lastE=-1;
const sw=egs.map(()=>({a:0,v:0}));
function poseEnd(dts){
  const {w,h,pt}=S,e=sss(clamp(ep/.72)),m=pt?-endC*.12:20-endC*.14,span=w-2*m-endC;
  egs.forEach((el,r)=>{
    const x1=m+span*r/Math.max(1,N-1),x0=-endC*.72+r*w*.006,x=x0+(x1-x0)*e,s=sw[r];
    if(!reduced&&dts){s.v+=(-24.5*s.a-2.1*s.v)*dts-(e-lastE)*(1+r/N)*(lastE<0?0:2800)*dts*.4;s.a+=s.v*dts}
    el.style.transform=`translate3d(${x.toFixed(1)}px,${(railY-endC*CT).toFixed(1)}px,0) rotate(${clamp(s.a,-4,4).toFixed(2)}deg)`;
  });
  lastE=e;
  const d=1-sss(clamp((ep-.2)/.7));
  wl.forEach((sp,k)=>{sp.style.transform=d>.001?`translate3d(${((k-4.5)*(pt?h:w)*.17*d).toFixed(1)}px,0,0)`:'none'});
  const t=clamp((ep-.55)*4);lox.style.opacity=hix.style.opacity=t;
  rail.style.transform=`translate3d(0,${railY}px,0) scaleX(${clamp(ep*2.4)})`;
}

const chrome=$('chrome'),words=[$('logo'),...$('nav').children];
$('stage').insertAdjacentHTML('beforeend','<div id="mast"></div>');const mastEl=$('mast');
let wr=[];
// Huge type never greys out on its way in or out: whatever fade another beat asks for is cut as a blade across the letters, the same gesture as the slits and doors.
let blades=[];
function cutType(){
  for(const el of blades){
    const o=el._o;
    if(el._on&&o<1){el.style.opacity=1;el.style.clipPath=`inset(-10% -5% ${((1-o)*100).toFixed(2)}% -5%)`;el._cut=true}
    else if(el._cut){el.style.clipPath='';el._cut=false}
  }
}
let mode='';
function setMode(y){
  const next=S.room==='index'?(y>=endTop-20?'end':'over'):S.mast?'mast':'';
  if(next!==mode){mode=next;chrome.className='chrome'+(next?' '+next:'')}
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

S.part('index',{rooms:{index:{}},
  measure(){
    const {w,h}=S,narrow=w<=760||!matchMedia('(hover:hover)').matches;
    // One size for every label, set by the longest one in the data.
    const ctx=document.createElement('canvas').getContext('2d');ctx.font='100px Six';
    const longest=Math.max(1,...brands.map(ps=>ctx.measureText(ps[0].brand.toUpperCase()).width));
    const avail=narrow?w-40:w-40-16; // the name's 14px lean stays inside its own clip
    box.style.setProperty('--ixfs',Math.min(avail/longest*100,h*.42)+'px');
    wr=words.map(a=>{const b=a.getBoundingClientRect();return {x:(b.left+b.right)/2,t:b.top,b:b.bottom}});
    blades=[...$('stage').querySelectorAll('.big.six,#odo,.wm')];
    if(box.hidden)return; // rooms.js measures again when the index opens
    // Ending geometry
    const eb=endEl.getBoundingClientRect();endTop=eb.top+scrollY;endLen=eb.height-h;
    railY=S.pt?h*.085:h*.085;
    // Desktop: hems just overlap the wordmark's top. The word's top comes from its CSS, as doors may be open at measure time.
    const wmTop=h-parseFloat(getComputedStyle($('endW')).fontSize)*.84-34;
    endC=S.pt?Math.min(h*.4,w*1.1):Math.max(h*.34,(wmTop-railY+h*.06)/HH);
    egs.forEach(el=>{el.style.width=el.style.height=endC+'px';el.style.transformOrigin=`50% ${CT*100}%`});
    lox.style.top=hix.style.top=(railY-18)+'px';
    poseEnd(0);
  },
  draw(){
    const qq=S.q;S.mast=qq.wallIn>.85&&qq.spliceIn<.8;vis(mastEl,S.mast?1:0);
    setMode(0);wordColours();cutType();
  },
});

let prev=performance.now();
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(64,now-prev),dts=dt/1000;prev=now;
  if(S.room!=='index')return;
  const y=scrollY,h=S.h;
  setMode(y);
  if(on&&!reduced){tiltV+=(-60*tilt-9*tiltV)*dts;tilt+=tiltV*dts;reelT.style.transform=`rotate(${clamp(tilt,-2.2,2.2).toFixed(3)}deg)`}
  if(y+h<endTop-10)return;
  // The room opens the way the stage shut: a slit in the paper, parting from the middle.
  const op=reduced?1:sss(clamp((y+h-endTop)/(h*.85)));if(op!==endEl._op){endEl._op=op;endEl.style.clipPath=op<1?`inset(0 ${(50*(1-op)).toFixed(2)}%)`:''}
  const t=clamp((y-endTop+h*.55)/(endLen+h*.55));
  if(reduced)ep=1;else ep+=(t-ep)*(1-Math.exp(-dt*.0085));
  poseEnd(dts);
}
if(N)requestAnimationFrame(tick);
