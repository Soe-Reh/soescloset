import {S,$,G,clamp,ss,sss,lerp,mix,mixc,hold,vis,add,money,hex,lum,contrast,WHITE,BLACK,HH,CT,sharpen} from '../core.js';
import {roomBar} from '../mover.js';
const {q,N,last}=S;
const touch=!matchMedia('(hover:hover)').matches;
const note=add(`<p class="note" id="nWall">${touch?'One slit from each. The higher the dye, the dearer.<br>Drag to scan, tap for the piece, hold to pull one out':'One slit from each. The higher the dye, the dearer.<br>Move across to open one, click for the piece, pull it out to hold it'}.</p>`);
const key=$('wallKey'),sorter=$('wallSort'),ring=add('<div id="wallRing" aria-hidden="true"></div>');key.max=last;
const rule=add('<div id="wallRule" aria-hidden="true"></div>'),mark=add('<div id="wallMark"></div>');
const cap=add('<p id="wallCap" role="status"><b class="six"></b><span></span></p>'),capB=cap.firstChild,capT=cap.lastChild;
const stage=$('stage'),gs=$('gs');
gs.insertAdjacentHTML('beforeend','<canvas class="rack" id="rack1" aria-hidden="true"></canvas><canvas class="rack" id="rack2" aria-hidden="true"></canvas><div id="wallBig" class="six" aria-hidden="true"></div>');
const racks=[$('rack1'),$('rack2')],big=$('wallBig');

// Dye height: the price's position on a ratio scale, because on a linear one everything under $300 would sit in the rib. The ruler prints the scale.
const prices=G.map(g=>g.price),lo=Math.min(...prices),hi=Math.max(...prices);
const level=p=>hi>lo?Math.log(p/lo)/Math.log(hi/lo):1;
const SLITS=4.6,CUFF=1240/1600,HEM=1338/1600,yAt=e=>lerp(CUFF,CT,e);

const order=G.map((_,i)=>i),slot=G.map((_,i)=>i),SORTS={Color:(a,b)=>a-b,Price:(a,b)=>G[a].price-G[b].price||a-b,Brand:(a,b)=>G[a].brand.localeCompare(G[b].brand)||G[a].price-G[b].price,
  Fit:(a,b)=>G[a].fitRank-G[b].fitRank||G[a].price-G[b].price}; // v5: Fit tab (core.js g.fitRank) and US spelling, the only changes to the original's sorts
const lay=[],open=G.map(()=>0),flood=G.map(g=>1),off=G.map(()=>({x:0,v:0,wait:0}));
let F=0,A=0,keyed=false,wallOn=false,inWall=false,pin=null,pinT=0,pinMx=null,barAt=-1,gut=52,c=1,y0=0,sortN=0;
// The crown starts below the nav's own boxes: the index part inks any word a garment reaches, and this cloth never does.
const size=()=>{const {h,w}=S,top=$('stage').getBoundingClientRect().top;gut=w<=760?30:52;y0=Math.max(h*.058,...[...$('nav').children].map(a=>a.getBoundingClientRect().bottom-top+6));c=(h-band()-y0-(w<=760?56:0))/HH};
// The strip under the hem holds the caption and the corner bar, so a short screen (a phone on its side) still gets enough of it.
const band=()=>Math.max(S.h*.102,84);

function layoutSlots(){
  // Phone: squeezing every slit into the width leaves slits nobody can read. Here they keep a readable width on a rail that pans, and the open one widens.
  if(S.pt){
    const W=S.w-gut,base=W/SLITS;let x=0;
    order.forEach((i,s)=>{const d=(s-F)/.8,o=Math.exp(-d*d);open[i]=o*A;const b=base*(1+A*o*1.6);lay[s]=[x+b/2,b];x+=b});
    const f=Math.min(Math.floor(F),Math.max(0,last-1)),fx=lerp(lay[f][0],(lay[f+1]||lay[f])[0],F-f),pan=clamp(W/2-fx,Math.min(0,W-x),0);
    lay.forEach(v=>v[0]+=pan);
    return;
  }
  const mult=S.pt?60:12,sig=S.pt?.8:1.25,W=S.w-gut;let sum=0,x=0;
  const ws=order.map((_,s)=>{const d=(s-F)/sig,o=Math.exp(-d*d);open[order[s]]=o*A;const v=1+A*mult*o;sum+=v;return v});
  ws.forEach((v,s)=>{const b=v/sum*W;lay[s]=[x+b/2,b];x+=b});
}

// One plaster cast per piece keeps the folds, logos and pockets as relief with no runtime filter. It is baked at full size off the main thread, so the scroll never pays for it, and each piece is normalised to itself so black and white cast alike.
// shortcut: no Worker or OffscreenCanvas (Safari before 16.4) means no plaster, the wall stays in full colour; add a main-thread bake if that audience matters.
const CAST=`onmessage=async({data:{src,i}})=>{try{
  const bm=await createImageBitmap(await(await fetch(src)).blob()),n=Math.min(1200,bm.width);
  const cv=new OffscreenCanvas(n,n),x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0,n,n);
  const im=x.getImageData(0,0,n,n),d=im.data;
  // Light comes from the softened cloth, so type and seams read as cast relief; the silhouette keeps its sharp alpha.
  const s=new OffscreenCanvas(n>>3,n>>3),sx=s.getContext('2d');sx.imageSmoothingQuality='high';sx.drawImage(bm,0,0,n>>3,n>>3);
  x.clearRect(0,0,n,n);x.imageSmoothingQuality='high';x.drawImage(s,0,0,n>>3,n>>3,0,0,n,n);
  const so=x.getImageData(0,0,n,n).data,Y=new Float32Array(n*n);let m=0,v2=0,w=0;
  for(let i=0;i<Y.length;i++){const j=i*4,l=.3*so[j]+.59*so[j+1]+.11*so[j+2];Y[i]=so[j+3]?l:-1;if(d[j+3]>200){m+=l;v2+=l*l;w++}}
  m/=w||1;const sd=Math.max(12,Math.sqrt(Math.max(0,v2/(w||1)-m*m))),t=Math.round(n/200),o=t+t*n;
  // Height is squashed before it is lit, so a printed logo is a low step in the cast and not a cliff.
  for(let i=0;i<Y.length;i++)Y[i]=Y[i]<0?-9:Math.tanh((Y[i]-m)/sd*.6);
  for(let i=0;i<Y.length;i++){const j=i*4,a=Y[i-o],b=Y[i+o],e=a>-9&&b>-9?a-b:0,v=.962+.006*Y[i]+.018*Math.tanh(e*2.2);d[j]=v*247;d[j+1]=v*245;d[j+2]=v*240}
  x.putImageData(im,0,0);const out=cv.transferToImageBitmap();postMessage({i,out},[out]);
}catch(e){postMessage({i,err:String(e)})}}`;
let cast=()=>{cast=()=>{};
  const wk=new Worker(URL.createObjectURL(new Blob([CAST],{type:'text/javascript'})));
  const next=k=>{if(k<N)wk.postMessage({src:new URL(G[k].image,location).href,i:k});else wk.terminate()};
  wk.onmessage=({data:{i,out,err}})=>{
    const g=G[i];
    if(out){const cv=document.createElement('canvas');cv.width=cv.height=out.width;cv.setAttribute('aria-hidden','true');cv.getContext('2d').drawImage(out,0,0);out.close();g.el.append(cv);g.pl=cv;g.plAt=performance.now()}else console.error(g.id,err);
    // The cast has fetched the full image anyway, and 600 is soft on a wall this tall.
    sharpen(g); // core swaps it in once the room is at rest
    next(i+1);
  };
  S.smallIn.then(()=>next(0)); // after every small picture, so the casts never hold up a garment
};

// Spring state of the one piece out of the rail.
const L={i:-1,on:false,ax:0,ay:0,vx:0,vy:0,a:0,va:0,o:0,ov:0,c:1,cv:0,ux:.5,uy:.5,hx:0,hy:0,tx:0,ty:0,px:0,py:0,pvx:0,pvy:0,pt:0,r:0,slotX:0,by:null};
const free=()=>L.i<0||!L.on&&L.o<.35; // once a released piece is nearly home the wall answers the pointer again; it no longer waits for the last swing to die
const hang=()=>{const dx=L.ux-.5,len=Math.max(.14,.46-L.uy);return -Math.atan2(dx,len)*57.3*.55};

function snapshot(){
  const {w,h}=S,W=w+48,H=h+48;
  const [a,b]=racks;a.width=W*.5;a.height=H*.5;b.width=W*.2;b.height=H*.2;
  const x=a.getContext('2d');x.scale(.5,.5);x.translate(24,24);x.fillStyle='#f6f6f4';x.fillRect(-24,-24,W,H);
  const top=y0-c*CT;
  order.forEach((i,s)=>{
    if(i===L.i)return;const g=G[i],[cx,w2]=lay[s];
    x.save();x.beginPath();x.rect(cx-w2/2,0,w2+.5,top+c*HEM);x.clip();x.drawImage(g.ct,cx-c/2,top,c,c);
    if(g.pl&&flood[i]<.999){x.beginPath();x.rect(cx-w2/2,top,w2+.5,c*yAt(flood[i]));x.clip();x.drawImage(g.pl,cx-c/2,top,c,c)}
    x.restore();
  });
  b.getContext('2d').drawImage(a,0,0,b.width,b.height);
}
// The numerals stand on the hem rail and reach the crown, the same height as the wall, so the price is the wall's own measure. Near-black cloth would vanish on black figures.
function bigPrice(g){
  big.textContent='$'+g.label;big.style.fontSize='100px';big.style.color=lum(hex(g.dominant_hex))<.05?'#d8d6cf':'';
  const m=document.createElement('canvas').getContext('2d');m.font='100px Six';const t=m.measureText('H'),cap=t.actualBoundingBoxAscent/100||.82;
  const span=c*(HEM-CT),fs=Math.min((span-14)/cap,(S.w-gut-24)/(big.offsetWidth/100));big.style.fontSize=fs+'px';big.style.lineHeight=fs+'px';
  const lead=(fs-(t.fontBoundingBoxAscent+t.fontBoundingBoxDescent)/100*fs)/2+t.fontBoundingBoxAscent/100*fs; // baseline inside the line box
  bw=big.offsetWidth;big.dataset.y=y0+span-lead;bx=bigX();
}
function lift(i,x,y,by){
  const s=slot[i],[cx]=lay[s],gx=clamp(x-cx,-c*.3,c*.3),gy=clamp(y-y0,0,c*.75);
  L.i=i;L.on=true;L.by=by;L.ux=.5+gx/c;L.uy=CT+gy/c;L.ax=L.hx=x;L.ay=L.hy=y;L.tx=x;L.ty=y;L.vx=L.vy=0;L.vy=-160;L.c=c;L.cv=0;L.a=0;L.va=0;L.o=0;L.ov=0;
  L.gx=gx;L.slotY=y0+gy;L.px=x;L.py=y;L.pvx=L.pvy=0;L.pt=performance.now();
  snapshot();bigPrice(G[i]);stage.classList.add('wall-held');
}
function drop(){if(!L.on)return;L.on=false;stage.classList.remove('wall-held');L.vx+=clamp(L.pvx,-2600,2600)*.75;L.vy+=clamp(L.pvy,-2600,2600)*.75}
const local=e=>{const r=stage.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
const slotAt=x=>{for(let s=0;s<N;s++)if(x<lay[s][0]+lay[s][1]/2)return s;return last};

let hold_=0,x0=null,pin0=0;
stage.addEventListener('pointerdown',e=>{
  if(!wallOn||!free()||e.button||e.target.closest('a,button,input'))return;
  const [x,y]=local(e);if(y<y0||y>y0+c*HH||x>S.w-gut)return;
  const sl=slotAt(x),go=()=>{lift(order[sl],x,y,'p');stage.setPointerCapture?.(e.pointerId)};
  if(e.pointerType==='mouse')return go();
  // A touch only lifts after a still press, so a drag across still scans and a swipe still scrolls.
  pin=S.pt?sl:clamp(x/(S.w-gut)*N-.5,0,last);pin0=pin;pinMx=null;x0=x;pinT=S.tp;clearTimeout(hold_);hold_=setTimeout(go,200);
});
stage.addEventListener('pointermove',e=>{
  const [x,y]=local(e);
  if(e.pointerType!=='mouse'&&!L.on){if(wallOn&&y>y0){pin=S.pt&&x0!==null?clamp(pin0-(x-x0)/((S.w-gut)/SLITS),0,last):clamp(x/(S.w-gut)*N-.5,0,last);pinT=S.tp;pinMx=null}clearTimeout(hold_)}
  if(L.on&&L.by==='p'){const n=performance.now(),d=Math.max(8,n-L.pt)/1000;L.pvx+=((x-L.px)/d-L.pvx)*.45;L.pvy+=((y-L.py)/d-L.pvy)*.45;L.px=x;L.py=y;L.pt=n;L.tx=x;L.ty=y}
});
const end=()=>{clearTimeout(hold_);x0=null;if(L.by==='p'){if(performance.now()-L.pt>90)L.pvx=L.pvy=0;drop()}};
stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);

key.addEventListener('focus',()=>{keyed=true});
key.addEventListener('blur',()=>{keyed=false;if(L.by==='k')drop()});
key.addEventListener('input',()=>{if(L.by==='k')drop();valueText()});
key.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();drop();S.openPiece(G[order[+key.value]])}
  else if(e.key===' '){e.preventDefault();if(L.on)drop();else if(wallOn&&free()){const i=order[+key.value],[cx]=lay[slot[i]];lift(i,cx,S.h*.42,'k');L.tx=(S.w-gut)/2;L.ty=S.h*.42}}
  else if(e.key==='Escape')drop();
});
const valueText=()=>{const g=G[order[+key.value]];key.setAttribute('aria-valuetext',`${g.brand}, ${g.short}, $${g.label}`)};
valueText();

sorter.innerHTML=Object.keys(SORTS).map((n,k)=>`<button type="button" aria-pressed="${!k}" data-s="${n}">${n}</button>`).join('');
sorter.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  for(const n of sorter.children)n.setAttribute('aria-pressed',n===b);
  if(L.i>=0&&free()){L.i=-1;L.r=0;L.o=0} // nearly home: the re-sort carries it, so it must not fly back as a second motion
  const was=lay.map(v=>v[0]),before=G.map((_,i)=>was[slot[i]]+off[i].x);
  order.sort(SORTS[b.dataset.s]);order.forEach((i,s)=>slot[i]=s);
  if(!free())F=slot[L.i]; // a piece still out keeps its slit open, wherever the slit went
  layoutSlots();sortN++;
  G.forEach((_,i)=>{const o=off[i];o.x=before[i]-lay[slot[i]][0];o.v=0;o.wait=slot[i]*11;o.z=Math.abs(o.x)});
  valueText();
});

function ruler(){
  const span=(CUFF-CT)*c,fmt=n=>gut<40?(n>=1000?(n/1000)+'k':Math.round(n)+''):money(Math.round(n*100)/100);
  const ticks=[[lo,fmt(lo)],[hi,fmt(hi)]];for(let p=100;p<hi;p*=2)if(level(p)>.08&&level(p)<.92)ticks.push([p,fmt(p)]);
  rule.style.cssText=`width:${gut}px;height:${span}px;top:${y0+c*CT-c*CT}px`;
  rule.innerHTML=ticks.map(([p,t])=>{const y=(1-level(p))*100;return `<i style="top:${y}%;transform:scaleX(.12)"></i><span style="top:${y}%;margin-top:-6px">${t}</span>`}).join('');
}

// The numerals stand on the side the piece is not, and cross when it does, so the price is never the thing it hides. Too wide for that, they stay centred.
let bw=0,bx=0;
const bigX=()=>{const room=S.w-gut;return bw>room*.72?(room-bw)/2:L.ax>room/2?14:room-bw-14};
const stepS=(v,to,x,k,cc,d)=>{const nv=v+(-k*(x-to)-cc*v)*d;return [x+nv*d,nv]};
// The corner bar steps the slits like a rail's; a stepped slit stays open until the mouse moves again.
const bar=roomBar('wall',{n:N,step(d){const s=clamp(Math.round(F)+d,0,last);pin=s;pinT=S.tp;pinMx=S.mx;key.value=s;valueText();S.wake()}});
let capI=-1,capW=0,rO=0,capX=null,wf=0,tcol=null; // wf,tcol: v5 flood

S.part('wall',{segs:[['wallIn',1.1],['wall',2.4]],
  rooms:{wall:{
    at:()=>S.at.wall[0],
    bar,
    pick(){if(S.my<y0||S.my>y0+c*HH||S.mx>S.w-gut)return -1;return order[slotAt(S.mx)]},
    now:()=>free()&&A<.5?-1:idxNow(),
  }},
  measure(){size();if(G.length)ruler();const b=band();cap.style.setProperty('--capfs',Math.min(b-14,84)+'px');cap.style.bottom=(S.w<=760?65:9)+'px'},
  pre(){
    if(!c)size();
    if(S.p>S.at.wallIn[0]-2&&q.hoodIn<1)cast();
    wallOn=q.wallIn>.8&&q.hoodIn<.05;
    if(!wallOn&&L.i>=0){L.i=-1;L.on=false;L.r=0;L.o=0;stage.classList.remove('wall-held')}
    inWall=S.inside&&S.my>y0&&S.my<y0+c*HH&&S.mx<S.w-gut;
    if(pinMx!==null&&Math.abs(S.mx-pinMx)>4){pin=null;pinMx=null}
    if(pin!==null&&(Math.abs(S.tp-pinT)>.05||!wallOn))pin=null;
        const k=1-Math.exp(-S.dt*.0075);
    // While a piece is out, its slot stays where it was so it has a home to return to.
    if(free()){
      const fT=keyed&&wallOn?+key.value:pin!==null?pin:wallOn&&inWall?clamp(S.mx/(S.w-gut)*N-.5,0,last):F;
      const aT=wallOn&&(inWall||keyed||pin!==null)?1:0;
      if(S.jump){F=fT;A=aT}else{F+=(fT-F)*k;A+=(aT-A)*k}
    }
    {const b=Math.round(clamp(F,0,last));if(b!==barAt){barAt=b;bar.set(b)}}
    if(q.wallIn>0&&(q.meanIn<1||!lay.length))layoutSlots();

    const d=Math.min(S.dt/1000,1/30);
    for(const o of off){if(o.x===0&&o.v===0)continue;if(o.wait>0){o.wait-=S.dt;continue}
      o.v+=(-30*o.x-7*o.v)*d;o.x+=o.v*d;if(Math.abs(o.x)<.05&&Math.abs(o.v)<.5){o.x=0;o.v=0}}

    // Dye rises fast into an opening slit and sinks back slowly, like cloth drawing up and draining.
    G.forEach((g,i)=>{const r=level(g.price),o=open[i],t=i===L.i&&!free()?1:r+(1-r)*Math.min(1,o*o*(S.pt?2.2:1.45));
      if(S.jump)flood[i]=t;else flood[i]+=(t-flood[i])*(1-Math.exp(-S.dt*(t>flood[i]?.0095:.0034)))});

    if(L.i>=0){
      const tx=L.on?L.tx:lay[slot[L.i]][0]+L.gx,ty=L.on?L.ty:L.slotY,kp=L.on?190:62,cp=L.on?25:10.5;
      {
        [L.ax,L.vx]=stepS(L.vx,tx,L.ax,kp,cp,d);[L.ay,L.vy]=stepS(L.vy,ty,L.ay,kp,cp,d);
        // Grabbed off centre the garment hangs from the grip; moving, its mass trails the hand.
        const dist=Math.hypot(tx-L.ax,ty-L.ay),aT=(L.on?hang():0)+clamp(L.vx*.011,-24,24);
        [L.a,L.va]=stepS(L.va,aT,L.a,38,L.on?4.8:5.6,d);
        [L.o,L.ov]=stepS(L.ov,L.on?1:clamp(dist/130),L.o,L.on?95:34,L.on?17:10,d);
        [L.c,L.cv]=stepS(L.cv,L.on?liftC():c,L.c,120,20,d);
        L.r+=((L.on?1:0)-L.r)*(1-Math.exp(-S.dt*(L.on?.011:.008)));
        if(!L.on&&dist<.6&&Math.abs(L.a)<.06&&L.o<.012&&Math.hypot(L.vx,L.vy)<8&&Math.abs(L.va)<.4&&L.r<.02){L.i=-1;L.r=0;L.o=0}
      }
    }
    const white=sss(clamp(q.wallIn*1.6))*(1-sss(clamp((q.hoodIn||0)*1.6))); // the plaster is the Wall's alone: it drains back to studio gray on the way out, so Hood, Price, Compare and Average share the grayS.gr=mixc(S.gr,WHITE,white);S.ink=mixc(S.ink,BLACK,white);
    // v5 addition: the open or held piece floods the white wall with its own room colour (g.tint), then drains back to white.
    const fi=idxNow(),amt=wallOn?(free()?clamp(A*1.5-.3):1):0,ek=S.jump?1:1-Math.exp(-S.dt*.006);
    if(amt>.01){const to=G[fi].tint;tcol=tcol?mixc(tcol,to,ek):to}
    wf+=(amt-wf)*ek;
    if(tcol&&wf>.002){S.gr=mixc(S.gr,tcol,wf);const ti=G[fi].tintInk;S.ink=contrast(S.gr,ti)>contrast(S.gr,BLACK)?ti:BLACK}
    if(q.wallIn>.5&&q.hoodIn<.5){const held=L.i;S.stack=[`w${sortN}.${held}`,i=>i===held?300:Math.min(190,10+(off[i].z||0)*.1+(N-slot[i])*.01)|0||1]}
  },
  pose(i,P){
    if(q.wallIn<=0)return P;
    const s=slot[i],[lx,b]=lay[s],o=off[i],x=lx+o.x,ht=Math.abs(o.x)/S.w;
    // A long trip passes in front, so crossing slits read as depth and not as a smear.
    const cc=c*(1+Math.min(.035,ht*.1));
    let f=Math.min(.5,(b+.8)/(2*cc));
    if(i===L.i)f=lerp(f,.5,ss(clamp(L.o)));
    return mix(P,{x,y:y0-(cc-c)*(CT+HH/2),c:cc,o:1,l:.5-f,r:.5+f},sss(clamp(q.wallIn*1.42-.42*s/last)));
  },
  draw(){
    const inO=hold((q.wallIn-.7)*3.3,q.hoodIn*4),rack=L.i>=0?L.r:0,idx=free()?order[Math.round(clamp(F,0,last))]:L.i,lg=G[idx];

    // The dye line splits each slit: plaster above, cloth below, so neither shows through the other's soft edge. Every hem is cut on one rail until a piece is lifted out.
    const hemOn=ss(clamp((q.wallIn-.55)/.3))*(1-clamp(q.hoodIn*2));
    G.forEach((g,i)=>{
      const s=slot[i],drain=ss(clamp((q.wallIn-.42-.3*s/last)/.28)),flat=ss(clamp(q.hoodIn*3.2-.6*s/last));
      const e=q.wallIn<=0?1:Math.max(flood[i],1-drain,flat),bare=e>=.999||!g.pl;
      const hem=(1-HEM)*hemOn*(i===L.i?1-clamp(L.o*1.5):1),top=bare?0:yAt(e);
      const clip=top||hem>.0001?`inset(${(top*100).toFixed(2)}% 0 ${(hem*100).toFixed(2)}% 0)`:'none';
      if(g._ctc!==clip){g.ct.style.clipPath=clip;g._ctc=clip}
      const pl=g.pl;if(!pl)return;
      if(bare){vis(pl,0);return}
      vis(pl,clamp((S.now-g.plAt)/500));
      const pc=`inset(0 0 ${((1-top-.0006)*100).toFixed(2)}% 0)`;if(pl._c!==pc){pl.style.clipPath=pc;pl._c=pc}
    });

    if(L.i>=0){
      const g=G[L.i],s=L.c/1600,ang=L.a;
      g.el.style.transform=`translate3d(${L.ax.toFixed(2)}px,${L.ay.toFixed(2)}px,0) rotate(${ang.toFixed(3)}deg) scale(${s.toFixed(5)}) translate(${(-L.ux*1600).toFixed(1)}px,${(-L.uy*1600).toFixed(1)}px)`;
      const up=clamp(L.o);g.sh.style.transform=up>.002?`translate(${(up*34).toFixed(1)}px,${(up*64).toFixed(1)}px)`:'';
    }
    if(rO!==rack||rack>0){rO=rack;
      vis(racks[0],clamp(rack*2.4));vis(racks[1],clamp(rack*2.2-1.1));
      if(rack>0){const t=`scale(${(1-.018*sss(rack)).toFixed(4)})`;racks[0].style.transform=t;racks[1].style.transform=t}
      const bo=S.w<=760?0:clamp(rack*2-.7);vis(big,bo);bx+=(bigX()-bx)*(1-Math.exp(-S.dt*.005));if(bo>0)big.style.transform=`translate3d(${bx.toFixed(1)}px,${(+big.dataset.y+(1-sss(bo))*S.h*.05).toFixed(1)}px,0)`;
    }

    const capO=inO*clamp(Math.max(A,free()?0:1)*3-1.4);
    vis(note,inO*(1-clamp(capO*2.5)));
    vis(cap,capO);capB.style.opacity=S.w<=760?1:1-clamp(rack*3);
    if(capO>0){
      if(capI!==idx){capI=idx;capB.textContent='$'+lg.label;capT.innerHTML=`<strong>${lg.brand}</strong><br>${lg.short}${lg.col?', '+lg.col.toLowerCase():''}`;capW=cap.offsetWidth}
      const [cx,b]=lay[slot[idx]],maxX=S.w-(S.w<=760?108:gut)-capW-6;
      const px=S.w<=760?0:rack>.5?clamp(bx+bw-capW,8,S.w-capW-8):clamp(cx-b/2+off[idx].x,8,Math.max(16,maxX));
      capX=capX===null?px:capX+(px-capX)*(1-Math.exp(-S.dt*.014));
      cap.style.transform=`translate3d(${capX.toFixed(1)}px,0,0)`;
    }

    // The open slit keeps its price as a line out to the ruler, once its own dye has flooded past it.
    const mo=inO*clamp(A*2-1)*(1-clamp(rack*2))*clamp(open[idx]*2-.8);
    vis(mark,mo);
    if(mo>0){const [cx,b]=lay[slot[idx]],y=y0+c*yAt(level(lg.price)),x0=cx+b/2;mark.style.transform=`translate3d(${x0.toFixed(1)}px,${y.toFixed(1)}px,0) scaleX(${((S.w-x0-gut*.6)/100).toFixed(3)})`}

    vis(rule,inO*(1-clamp(rack*2)*.8));
    vis(sorter,inO*(1-clamp(rack*3)));
    // The range itself stays invisible; focus shows on the slit it opens, inked twice so it holds on black cloth and on white.
    const fo=keyed&&key.matches(':focus-visible')?inO:0;vis(ring,fo);
    if(fo>0){
      // Out of the rail the ring rides the piece, so focus never marks an empty slit.
      if(!free()){ring.style.width=L.c*.76+'px';ring.style.height=L.c*(HEM-CT)+'px';ring.style.transform=`translate3d(${L.ax.toFixed(1)}px,${L.ay.toFixed(1)}px,0) rotate(${L.a.toFixed(2)}deg) translate(${((.12-L.ux)*L.c).toFixed(1)}px,${((CT-L.uy)*L.c).toFixed(1)}px)`}
      else{const s=slot[idx],[cx,b]=lay[s];ring.style.width=b+'px';ring.style.height=c*(HEM-CT)+'px';ring.style.transform=`translate3d(${(cx-b/2+off[order[s]].x).toFixed(1)}px,${y0}px,0)`}
    }
    if(sorter._v!==inO>.5){sorter._v=inO>.5;for(const b of sorter.children)b.tabIndex=inO>.5?0:-1}
    stage.classList.toggle('wall-grab',wallOn&&inWall&&!L.on);
  },
  hover(){if(!wallOn)return -1;S.noTip=true;return inWall||!free()?(free()?order[Math.round(clamp(F,0,last))]:L.i):-1},
});
function idxNow(){return free()?order[Math.round(clamp(F,0,last))]:L.i}
function liftC(){return Math.min(c*1.04,S.w*1.42)}
