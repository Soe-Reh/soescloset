import {$,S,G,clamp,ss,sss,lerp,mixc,css,hold,vis,add,money,sharpen} from '../core.js';
import {combo} from './combo.js';
const {q}=S,hoverable=matchMedia('(hover:hover)').matches;
// Every piece, sharpest crown to roundest, so panning the row reads as one hood changing shape. The first is the piece the push lands on.
const row=[...G].sort((a,b)=>(a.hood_crown_ratio||0)-(b.hood_crown_ratio||0));
const N=row.length,last=N-1,tileOf=new Map(row.map((g,t)=>[g,t])),pi=G.indexOf(row[0]);
const DEPTH=[1.22,1.5,1.08,1.7,1.34]; // zoom-parallax layers: neighbours outrun the pivot at different rates

const rooms=add(`<div id="hrooms" aria-hidden="true">${row.map(()=>'<div></div>').join('')}</div>`);
const verb=hoverable?'Click':'Tap',esc=t=>String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const label=g=>`${g.brand} ${g.short}, ${money(g.price)}`;
// Plain words for the crown: the tip's width against the hood lower down, read against the middle of the set.
const mid=[...row].sort((a,b)=>a.hood_crown_ratio-b.hood_crown_ratio)[last>>1].hood_crown_ratio;
const shapeWord=(g,t)=>t===0?'Pointiest of the '+N:t===last?'Roundest of the '+N:g.hood_crown_ratio<mid?'Pointier than most':g.hood_crown_ratio>mid?'Rounder than most':'In the middle';
const legend=t=>t===last?'':'<span><i class="k1"></i>This hood</span> <span><i class="k2"></i>The roundest</span>';
const cap=add(`<p id="hcap">Where these differ most: domed or peaked at the top, open or closed at the face.</p>`);
const strip=add(`<div id="strip"><div class="hend" id="nHood"><b class="six">Pointiest top</b><p>All ${N} hoods at one scale, pointiest first. Each card draws the hood's outline over the roundest hood in dashes.</p><p class="how"><span class="hcap2">Where these differ most: domed or peaked at the top, open or closed at the face.<br></span>${hoverable?`Drag, scroll or arrow keys to move. ${verb} any hood to open it.`:'<b>Swipe &larr; &rarr;</b> for the next hood. Dashes show the roundest.'}</p></div><div class="hend" id="hEnd" aria-hidden="true"><b class="six">Roundest top</b><p>The roundest of the ${N}. Next, all of them blended into one average.</p></div>${row.map((g,t)=>`<div class="htag" aria-hidden="true" style="--r:${css(g.tint)};--i:${css(g.tintInk)};--c:${g.dominant_hex}"><div class="hin"><b class="six hb">${g.brand}</b><b class="six pr">${money(g.price)}</b><span class="who">${g.short}</span><span class="fm">${g.hood_crown} top, ${g.hood_mouth} face</span><svg class="hc" viewBox="500 90 600 340"><path class="me"/><path class="gh"/></svg><span class="ms"><b>${shapeWord(g,t)}</b> ${legend(t)}</span><span class="go">Open &rarr;</span></div></div>`).join('')}</div>`);
// Runs, not a filter: the row's order is the comparison, so a form only says where it starts, and every hood stays one tap away.
const runs=row.reduce((o,g,t)=>{if(o.at(-1)?.f!==g.hood_form)o.push({f:g.hood_form,n:`${g.hood_crown}, ${g.hood_mouth}`,ts:[]});o.at(-1).ts.push(t);return o},[]);
const bar=add(`<div id="hbar"><span id="hfindAt"></span><div id="hmap" role="group" aria-label="Every hood in row order, grouped by form">${runs.map(r=>`<div class="hrun"><small>${r.n}</small><div>${r.ts.map(t=>{const g=row[t];return `<button type="button" tabindex="-1" data-t="${t}" aria-label="${esc(label(g))}" style="background:${css(g.room)} url(${g.image_600}) 50% 4%/220% no-repeat"></button>`}).join('')}</div></div>`).join('')}</div><div id="hzoom" role="group" aria-label="Zoom into the cloth"><span>Zoom</span><div></div></div></div>`);
const nowEl=add('<p id="hnow"><span aria-live="polite"></span><button type="button">Zoom out</button></p>'),tip=add('<p id="htip" aria-hidden="true"></p>');
const items=l=>l.map(g=>({value:row.indexOf(g),title:g.brand,sub:g.short,meta:money(g.price),thumb:g.image_600,search:`${g.brand} ${g.short} ${g.col||''} ${g.price} ${money(g.price)}`}));
const find=combo({label:'Find a hoodie',placeholder:'Find a hoodie',groups:[{label:'By brand',items:items([...row].sort((a,b)=>a.brand.localeCompare(b.brand)))},{label:'By price, low to high',items:items([...row].sort((a,b)=>a.price-b.price))}],onPick:t=>go(t)});
find.el.id='hfind';$('hfindAt').replaceWith(find.el);
const thumbs=[...bar.querySelectorAll('#hmap button')],zoomEl=bar.querySelector('#hzoom div'),nowText=nowEl.firstChild;
const note=$('nHood'),hEnd=$('hEnd'),tags=[...strip.querySelectorAll('.htag')],mine=tags.map(t=>t.querySelector('.me')),ghosts=tags.map(t=>t.querySelector('.gh')),panels=[...rooms.children],stage=$('stage');
const CROP=540,CROPW=680,LABEL=360; // canvas units below the hood top: the collar, the crop's width, the neck label
let MAXC=1600; // set by size(): how far the 1600px photo can go before it reads as upscaled

// The drawing is the hood's own edge, read from its cutout on one fixed scale, over the row's roundest in dashes: it says how far this one is from that.
const trace=async()=>{
  const SZ=600,k=SZ/1600,cv=document.createElement('canvas');cv.width=cv.height=SZ;const x=cv.getContext('2d',{willReadFrequently:true});
  for(let t=0;t<N;t++){
    const g=row[t],im=new Image();im.src=g.image_600;
    try{await im.decode()}catch{continue}
    x.clearRect(0,0,SZ,SZ);x.drawImage(im,0,0,SZ,SZ);
    const d=x.getImageData(0,0,SZ,SZ).data,y0=Math.round(g.canvas.hood_top_y*k),y1=Math.round((g.canvas.hood_top_y+g.hood_height_ratio*g.canvas.garment_height)*k),L=[],R=[];
    for(let y=y0-6;y<=y1;y++){
      let a=-1,b=-1;
      for(let i=0;i<SZ;i++)if(d[(y*SZ+i)*4+3]>128){if(a<0)a=i;b=i}
      if(a>=0){L.push([a/k,y/k]);R.push([b/k,y/k])}
    }
    // 600px alpha steps in whole pixels: a small running mean takes the stairs out of a line printed large on a phone.
    const soft=E=>E.map((p,i)=>[E.slice(Math.max(0,i-3),i+4).reduce((a,e,_,o)=>a+e[0]/o.length,0),p[1]]);
    // Scanlines cap a crown with a flat bar, which draws a peak as blunt: a curve over the top rows lands its apex on the real top instead.
    if(L.length>3){
      const l=soft(L).slice(3).reverse(),r=soft(R).slice(3),pts=E=>E.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(0)).join('L');
      mine[t].setAttribute('d',`M${pts(l)}Q${((l.at(-1)[0]+r[0][0])/2).toFixed(1)} ${(2*L[0][1]-r[0][1]).toFixed(0)} ${pts(r)}`);
    }
    await new Promise(r=>setTimeout(r));
  }
  const round=mine[last].getAttribute('d');if(round)ghosts.forEach((p,t)=>{if(t<last)p.setAttribute('d',round)});
};
// Every hood sharp before the push reaches it. Same flag as core's own upgrade, so neither repeats the other.
const sharpenAll=()=>{for(const g of row)sharpen(g)}; // core fetches them one at a time and swaps each in unseen or at rest

let T=1,cF=1,yF=0,H=1,visH=1,foot=64,cx0=0,cM=1,slide=0,hovT=-1,leanAt=0;
let A=0,M=0,B=0,pan=0,panS=0,drift=0,exit=0,z=0,zGoal=0,u=0,v=0,held=null,grab=null,over=0,sharp=false,cur=-1;
const lift=row.map(()=>0);
let levels=[0,1];
const size=()=>{
  const {w,h,pt:tall}=S;
  const barH=tall?104:64,chipH=tall?64:0;foot=barH+chipH;
  const capB=cap.offsetTop+cap.offsetHeight; // the caption sits above the crowns, never on them
  if(tall){
    // Two whole hoods side by side, the open one on the left: a phone still compares. A short screen loses crop height, never scale.
    T=w/2;cF=T/520*1600;yF=64;cx0=T/2;
    visH=Math.min(Math.round(yF+720*cF/1600),h-foot-236);
  }else{
    // Columns are an exact fraction of the screen, so a settled row has clean edges and no half-cut hood. Odd, so the open one is centred.
    yF=Math.max(72,h*.09,capB+12);cx0=w/2;let k=1;
    do{k+=2;T=w/k;cF=T/CROPW*1600}while(k<9&&(cF>1300||(h>=520&&yF+CROP*cF/1600+foot+150>h)));
    visH=Math.round(yF+CROP*cF/1600);
  }
  H=h-visH-foot;if(H<120){visH=h-foot;H=0}
  strip.style.height=H+'px';strip.style.bottom=foot+'px';strip.style.setProperty('--T',T+'px');strip.style.setProperty('--H',H+'px');
  strip.classList.toggle('low',H-(tall?72:0)<250);
  bar.style.bottom=0;bar.style.height=foot+'px';tip.style.bottom=foot+6+'px';
  // One photo pixel per device pixel is the honest end; a 2x screen is let run to 1.5 device pixels, past which cloth visibly softens. A big row on a 2x screen already sits past that, so it keeps a small step.
  MAXC=S.dpr>1?Math.min(1600,Math.max(1600/1.5,cF*1.3)):1600;
  cM=Math.min(MAXC,cF*1.25);
  // Whole steps a shopper can read, then the source's limit, which is usually not a whole number.
  const max=MAXC/cF,ks=[1];for(let k=2;k<max-.25;k++)ks.push(k);ks.push(max);
  levels=ks.map(k=>(k-1)/(max-1));
  zoomEl.innerHTML=ks.map((k,i)=>`<button type="button" data-z="${levels[i]}" aria-label="${i===ks.length-1?'As far as the photo stays sharp':'Zoom'}, ${+k.toFixed(1)} times">${+k.toFixed(1)}x</button>`).join('');
  setZoom(zGoal);
};
const zc=()=>cF+(MAXC-cF)*z; // linear in screen scale, so the 2x button is truly twice
const pitchW=()=>T+(Math.max(S.w,T*MAXC/cF)-T)*z; // the crop widens to the whole screen as it zooms, and its neighbours step out of the way
const cxNow=()=>lerp(cx0,S.w/2,z);
const winB=()=>visH+slide;
const yAt=c=>S.h*.5-LABEL*c/1600; // the neck label on the screen's centre line
const panAt=v=>last?clamp(v/last):0;
function setZoom(val){
  zGoal=clamp(val);
  for(const b of zoomEl.children)b.setAttribute('aria-pressed',Math.abs(+b.dataset.z-zGoal)<.001);
  now_();
}
zoomEl.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setZoom(+b.dataset.z)});
const stepZoom=d=>setZoom((d>0?levels.find(l=>l>zGoal+.001):levels.findLast(l=>l<zGoal-.001))??zGoal);
function now_(){const g=row[Math.round(pan)];if(g)nowText.textContent=label(g)+(zGoal>0?(zGoal>=1?' As far as the photo stays sharp.':'')+' Drag to move.':'')}
nowEl.lastChild.addEventListener('click',()=>setZoom(0));
// These sit over the stage, and a click there would otherwise count as a click on the hood behind.
for(const el of [bar,nowEl])el.addEventListener('click',e=>e.stopPropagation());
function go(t){S.moverGo?.(t)}
bar.querySelector('#hmap').addEventListener('click',e=>{const b=e.target.closest('button');if(b)go(+b.dataset.t)});
const showTip=b=>{
  tip.textContent=b?b.getAttribute('aria-label'):'';vis(tip,b?1:0);
  if(b)tip.style.transform=`translate3d(${clamp(b.getBoundingClientRect().left-14,8,S.w-tip.offsetWidth-8).toFixed(1)}px,0,0)`;
};
bar.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')showTip(e.target.closest?.('#hmap button'))});
bar.addEventListener('pointerleave',()=>showTip(null));
bar.addEventListener('focusin',e=>showTip(e.target.closest('#hmap button')));
bar.addEventListener('focusout',()=>showTip(null));
// Same place on every piece while stepping: the point of a zoom here is comparing cloth, not losing it.
function fitPan(){
  const k=1600/zc(),hw=S.w/2*k,hh=(winB()-56)/2*k,um=Math.max(0,800-hw),lo=hh-40,hi=Math.max(lo,1345-hh);
  u=clamp(u,-um,um);v=clamp(v,lo,hi);
}
stage.addEventListener('pointerdown',e=>{if(held&&!e.button&&!e.target.closest('a,button,select,input,#hbar,.pos'))grab={x:e.clientX,y:e.clientY,u,v,over:0}},true);
addEventListener('pointermove',e=>{if(grab){const k=1600/zc(),want=grab.u-(e.clientX-grab.x)*k;u=want;v=grab.v-(e.clientY-grab.y)*k;fitPan();grab.over=(want-u)/k}});
// Past the end of the cloth a pull means the next piece, so zoom is never a trap.
for(const t of ['pointerup','pointercancel'])addEventListener(t,()=>{if(grab&&Math.abs(grab.over)>70)S.moverStep?.(Math.sign(grab.over));grab=null});
stage.addEventListener('wheel',e=>{
  if(!held||e.ctrlKey)return; // ctrl-wheel is pinch zoom, and is the user's
  e.preventDefault();e.stopPropagation();
  const k=(e.deltaMode===1?16:1)*1600/zc(),u0=u,v0=v;u+=e.deltaX*k;v+=e.deltaY*k;fitPan();
  if(u!==u0||v!==v0){over=0;return}
  over+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
  // The next piece opens at its near end, so scrolling on reads down it rather than racing along the row.
  if(Math.abs(over)>160){const d=Math.sign(over);S.moverStep?.(d);u=d*-1e4;v=d*-1e4;fitPan();over=0}
},{passive:false});
addEventListener('keydown',e=>{
  if(S.room!=='hood'||$('pv')?.open||e.altKey||e.ctrlKey||e.metaKey)return;
  const k=e.key,field=e.target.matches?.('input,select');
  if(field&&k!=='Escape')return;
  if(k==='+'||k==='=')stepZoom(1);
  else if(k==='-'||k==='_')stepZoom(-1);
  else if(k==='0'||(k==='Escape'&&zGoal>0))setZoom(0);
  else if(zGoal>0&&(k==='ArrowUp'||k==='ArrowDown')){e.preventDefault();v+=k==='ArrowUp'?-90:90;fitPan()}
});
// A finger that tries to scroll this page gets shown which way it does go.
let grabY=0;
stage.addEventListener('touchstart',e=>{grabY=e.touches[0].clientY},{passive:true});
stage.addEventListener('touchmove',e=>{if(!held&&Math.abs(e.touches[0].clientY-grabY)>24&&S.now-leanAt>1200)leanAt=S.now},{passive:true});
// Until the row has been moved it leans toward the next piece every few seconds: a swipe cue that is the swipe itself.
const lean=()=>{
  if(hoverable||S.room!=='hood'||q.hood>=1||z>0)return 0;
  if(!stage.querySelector('.pos.on.moved')&&S.now-leanAt>4800)leanAt=S.now;
  const t=(S.now-leanAt)/900;return t<1?Math.sin(t*Math.PI)**2*.16:0;
};

const rawTile=x=>Math.round(pan+(x-cxNow())/pitchW());
const tileAt=()=>{const t=rawTile(S.mx);return S.my<S.h-foot&&t>=0&&t<=last?t:-1};
S.part('hood',{segs:[['hoodIn',1.9],['hood',Math.max(3.2,N*.42)]],
  rooms:{hood:{
    stops:()=>row.map((_,v)=>S.at.hood[0]+S.at.hood[1]*panAt(v)),
    pitch:()=>T,
    piece:v=>G.indexOf(row[v]),
    box:()=>({x:cx0-T/2,y:yF,w:T,h:S.h-foot-yF}),
    pick:()=>{const t=tileAt();return t<0?-1:G.indexOf(row[t])},
    chip:()=>12,
  }},
  measure:size,
  hover(){if(!hoverable||q.hoodIn<1||q.meanIn>0)return -1;S.noTip=true;const t=tileAt();return t<0?-1:G.indexOf(row[t])},
  pre(){
    const t=q.hoodIn;S.crisp=false;
    // Push to the cloth, stay there while it keeps creeping, then pull out just far enough to read the whole hood.
    A=clamp(t/.5);M=ss(clamp((t-.5)/.2));B=sss(clamp((t-.7)/.29)); // ends short of 1, as a landing rounds to a whole scroll pixel
    if(!sharp&&(t>0||q.wall>.4)&&q.meanIn<=0){sharp=true;sharpenAll();trace().catch(e=>console.error('hood',e))}
    pan=q.hood*last+lean(); // the mover's snap is the held beat, so a drag stays 1:1
    if(S.jump)panS=pan;else panS+=(pan-panS)*(1-Math.exp(-S.dt*.007));
    drift=clamp(pan-panS,-1,1);
    if(S.room!=='hood'&&zGoal>0)setZoom(0);
    z=zGoal; // one experience: the zoom into the cloth cuts, never animates (a big zoom is not motion-safe)
    // While zoomed a drag means the cloth, so the row's scroller steps aside; keys and the chip still walk the row at the same zoom.
    const want=S.room==='hood'&&zGoal>0?S.moverEl:null;
    if(held!==want){held?.classList.remove('hold');want?.classList.add('hold');held=want;stage.classList.toggle('hheld',!!want);grab=null}
    slide=z*H; // the cloth takes the tape's place and the bar never moves, so no control runs from the pointer
    const hv=row.indexOf(G[S.hover]);for(let t=0;t<N;t++)lift[t]=lift[t]+((t===hv?1:0)-lift[t])*(1-Math.exp(-S.dt*.014));
    if(t>0&&q.meanIn<=0)S.stack=['h',i=>i===pi?200:100-i];
    if(t<=0||!N)return;
    const flood=hold((t-.2)/.35,q.meanIn*6);
    exit=sss(clamp(q.meanIn*3));
    S.gr=mixc(S.gr,row[0].room,flood);S.ink=mixc(S.ink,row[0].ink,flood);
    if(z>0)fitPan();
    S.crisp=B>=1&&exit<=0&&Math.abs(drift)<.03&&z===zGoal;
  },
  pose(i,P){
    const t=q.hoodIn;if(t<=0||!N)return P;
    const {w,h}=S,C=cM,window=(wx,W,c,y,gx=wx)=>({x:gx,y,c,o:Math.abs(wx-w/2)<w/2+W*1.1?1:0,l:clamp(.5+(wx-W/2-gx)/c),r:clamp(.5+(wx+W/2+.8-gx)/c)});
    if(B<=0){
      // Push: the pivot's slit opens to the full screen while every other slit is driven off the edges, each at its own zoom.
      const b=w/G.length,grow=(w/b)**A,hw=b/2*grow,cx=lerp((pi+.5)*b,w/2,ss(A)),d=i-pi;
      const bw=b*grow**.45,wx=d?cx+Math.sign(d)*(hw+(Math.abs(d)-.5)*bw):cx,k=d?A*DEPTH[i%DEPTH.length]:A;
      const c=P.c*(C/P.c)**k,Q=window(wx,d?bw:hw*2,c,lerp(P.y,yAt(c),k));
      const m=clamp(t*14); // once the pivot fills the screen a neighbour is only its .8px overlap, a hairline on the edge, so it goes (o below)
      return {x:lerp(P.x,Q.x,m),y:lerp(P.y,Q.y,m),c:P.c*(Q.c/P.c)**m,o:d&&A>=1?0:Q.o,l:lerp(P.l,Q.l,m),r:lerp(P.r,Q.r,m)};
    }
    const ti=tileOf.get(G[i]);if(ti===undefined)return {...P,o:0};
    const [L,R,c0]=place(ti);
    // Identical crops at rest, so a row compares truly; the cloth only lags its window while the row is moving.
    let c=zc(),k=c/1600,x=c0+drift*T*.18-z*u*k,y=lerp(yF,(56+winB())/2-v*k,z)-lift[ti]*12;
    if(!ti&&B<1){y=lerp(yAt(C),y,B);c=C*(c/C)**B}
    y+=exit*S.h;
    return {x,y,c,o:R>0&&L<w?1:0,l:clamp(.5+(L-x)/c),r:clamp(.5+(R+.8-x)/c)};
  },
  draw(){
    const on=N&&B>0&&exit<1;
    vis(rooms,on?1:0);
    const hs=hold((B-.35)*2,q.meanIn*5),up=(1-sss(hs))*(H+foot);vis(strip,H?hs:0);
    vis(bar,S.room==='hood'?hs:0);
    vis(nowEl,S.room==='hood'?clamp(z*6):0);
    vis(cap,S.room==='hood'?hs*(1-clamp(z*6)):0);
    if(!on)return;
    const {w,h}=S,now=clamp(Math.round(pan),0,last);
    if(now!==cur){
      cur=now;now_();find.set(now);
      thumbs.forEach((b,t)=>{b.tabIndex=t===now?0:-1;t===now?b.setAttribute('aria-current','true'):b.removeAttribute('aria-current')});
      if(S.room==='hood'){
        const map=thumbs[now].closest('#hmap'),b=thumbs[now];
        if(map.scrollWidth>map.clientWidth)map.scrollLeft=b.offsetLeft-map.offsetLeft-map.clientWidth/2+b.offsetWidth/2;
        if(thumbs.includes(document.activeElement))b.focus({preventScroll:true});
      }
    }
    bar.style.transform=`translate3d(0,${up.toFixed(1)}px,0)`;
    rooms.style.transform=`translate3d(0,${(exit*h).toFixed(1)}px,0)`;
    strip.style.transform=`translate3d(0,${(slide+up).toFixed(1)}px,0)`;
    const pw=pitchW(),cx=cxNow(),hov=row.indexOf(G[S.hover]),e0=cx-pan*pw-T/2,e1=cx+(last-pan)*pw+T/2;
    // The hood under the pointer floods its column and its card with its own colour, as the original did; the row rests on grey.
    if(hov!==hovT){tags[hovT]?.classList.remove('on');tags[hov]?.classList.add('on');if(panels[hovT])panels[hovT].style.backgroundColor='';if(panels[hov])panels[hov].style.backgroundColor=css(row[hov].tint);hovT=hov}
    // The tape's two ends say what the order means. They fade as they leave, so a title never rides out mid-letter.
    if(!S.pt){note.style.transform=`translate3d(${(e0-(w-T)/2).toFixed(2)}px,0,0)`;vis(note,clamp(1-pan*1.4))}else vis(note,1);
    hEnd.style.transform=`translate3d(${e1.toFixed(2)}px,0,0)`;vis(hEnd,clamp(1-(last-pan)*1.4));
    for(let t=0;t<N;t++){
      const [L,R,c]=place(t),show=L<w&&R>0;
      vis(panels[t],show?1:0);
      vis(tags[t],show&&hs>0?1:0);
      if(!show)continue;
      panels[t].style.transform=`translate3d(${L.toFixed(2)}px,0,0) scaleX(${((R-L+1)/w).toFixed(5)})`;
      if(hs>0)tags[t].style.transform=`translate3d(${(c-T/2).toFixed(2)}px,0,0)`;
    }
  },
});
// Tile window [left,right,centre]. The ends bleed to the screen edge, and while the pivot is pulling back from full bleed the row stays butted to its right edge.
function place(t){
  const {w}=S,W=pitchW(),c=cxNow()+(t-pan)*W,off=(1-B)*(w-cx0-T/2);
  return [t?c-W/2+off:Math.min(0,c-W/2),t===last?Math.max(w,c+W/2+off):c+W/2+off,c+(t?off:0)];
}
