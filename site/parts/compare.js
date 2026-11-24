import {S,G,$,clamp,ss,sss,lerp,mix,mixc,vis,money,css,hex,add,lum,BLACK,WHITE,sharpen} from '../core.js';
import {roomBar} from '../mover.js';
const {q,N,last}=S,prices=G.map(g=>g.price),minP=Math.min(...prices),maxP=Math.max(...prices);
const stage=$('stage'),gs=$('gs');
const doorA=document.createElement('div'),doorB=document.createElement('div');doorA.className=doorB.className='door';for(const d of [doorA,doorB])stage.insertBefore(d,gs);
const order=G.map((_,i)=>i).sort((a,b)=>prices[a]-prices[b]||a-b),rank=[];order.forEach((i,r)=>rank[i]=r);
const by=r=>G[order[r]],low=by(0),top=by(last),ratio=p=>{const v=p/minP;return (v<10?v.toFixed(1):Math.round(v))+'x'};
// v5: the colour flood behind the dearest piece is gone; the stage stays grey and price is the only data colour.
// The number stands on the floor behind the pieces.
const run=add('<div class="big six" id="run" aria-hidden="true"></div>'),mult=add('<div class="big six" id="mult" aria-hidden="true"></div>');
const tagsBox=add('<div id="ptags" aria-hidden="true"></div>');
tagsBox.innerHTML=G.map(g=>`<div class="ptag"><strong>${g.brand}</strong>$${g.label}</div>`).join('');
const tags=[...tagsBox.children];
const nPrice=add(`<p class="note" id="nPrice">Height is price. Every piece on one scale.</p>`);
const nGap=add(`<p class="note" id="nGap">${low.brand} ${money(minP)}, ${top.brand} ${money(maxP)}. Same floor, same scale, ${ratio(maxP)} the height.</p>`);
const pa=add('<div class="big six" id="pa"></div>'),pb=add('<div class="big six" id="pb"></div>'),times=add('<div class="big" id="times"></div>'),seamEl=add('<div id="seam"></div>');
const capA=add('<div class="cap" id="capA"></div>'),capB=add('<div class="cap" id="capB"></div>');
const pickA=add('<div class="pick" id="pickA" role="group" aria-label="Left piece"></div>'),pickB=add('<div class="pick" id="pickB" role="group" aria-label="Right piece"></div>');
const pickAL=add('<p class="pickL" id="pickAL" aria-hidden="true">Left</p>'),pickBL=add('<p class="pickL" id="pickBL" aria-hidden="true">Right</p>');
// The two pieces row by row, under the seam. Rows that match can be hidden, so the differences line up on their own.
const specs=add(`<div id="specs" role="region" aria-label="The two pieces, row by row"><div id="specHead"><p id="specSay" aria-live="polite"></p>
<button type="button" id="specDiff" class="btn" role="switch" aria-checked="false"><span>Show only differences</span><i aria-hidden="true"></i></button></div>
<table><thead><tr><th scope="col" id="specA"></th><th scope="col"><span class="sr">Row</span></th><th scope="col" id="specB"></th></tr></thead><tbody></tbody></table></div>`);
const specBody=specs.querySelector('tbody'),specDiff=$('specDiff');
// Fit in plain words: the group, then whatever else the store's phrase adds ("Boxy cropped fit" reads "Boxy, cropped").
const fitOf=g=>{if(!g.fitGroup||g.fitGroup==='Not listed')return '';const raw=g.details?.find(l=>/\bfit\b/i.test(l))||'',more=raw.replace(/\bfit\b/ig,'').replace(new RegExp('\\b'+g.fitGroup+'\\b','i'),'').trim().toLowerCase();return g.fitGroup+(more?', '+more:'')},safe=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
const SPEC=[['Price',g=>money(g.price)],['Fabric',g=>g.material||''],['Fit',fitOf],['Hood',g=>(g.hood_form||'').replace('-',', ')],['Sold at',g=>g.source_store||'']];
const shop=g=>g.url?.startsWith('https://')?`<a href="${safe(g.url)}" target="_blank" rel="noopener">${safe(g.source_store)}</a>`:safe(g.source_store||'');
// "9.4x the price." One decimal, a whole number keeps no ".0".
const ratioLine=(a,b)=>{const r=Math.max(a,b)/Math.min(a,b);return a===b?'Same price.':`${(Math.round(r*10)/10).toString()}x the price.`};
const fabric=(a,b)=>!a.material||!b.material?'':a.material===b.material?` Both ${a.material.toLowerCase()}.`:` ${a.material.toLowerCase()} against ${b.material.toLowerCase()}.`;
function specRender(a,b){
  specs.querySelector('#specA').textContent=a.brand;specs.querySelector('#specB').textContent=b.brand;
  specs.querySelector('#specSay').textContent=ratioLine(a.price,b.price)+fabric(a,b);
  specBody.innerHTML=SPEC.map(([n,f])=>{const x=f(a),y=f(b),same=x.toLowerCase()===y.toLowerCase();
    return `<tr${same?' class="same"':''}><td>${n==='Sold at'?shop(a):safe(x)}</td><th scope="row">${n}</th><td>${n==='Sold at'?shop(b):safe(y)}</td></tr>`}).join('');
}
// The rows that match fold away (or come back) rather than blink; the box eases to its new height.
let diffOn=false;
specDiff.addEventListener('click',()=>{
  diffOn=!diffOn;specDiff.setAttribute('aria-checked',diffOn);
  const same=[...specBody.querySelectorAll('tr.same')],h0=specs.offsetHeight;
  if(!same.length){specs.classList.toggle('diff',diffOn);return}
  const ease='cubic-bezier(.16,1,.3,1)',grow=()=>{const h1=specs.offsetHeight;specs.animate([{height:h0+'px'},{height:h1+'px'}],{duration:320,easing:ease})};
  if(diffOn){Promise.all(same.map(r=>r.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'}).finished)).then(()=>{same.forEach(r=>r.getAnimations().forEach(a=>a.cancel()));const h=specs.offsetHeight;specs.classList.add('diff');specs.animate([{height:h+'px'},{height:specs.offsetHeight+'px'}],{duration:320,easing:ease})})}
  else{specs.classList.remove('diff');grow();same.forEach(r=>r.animate([{opacity:0},{opacity:1}],{duration:260,delay:160,easing:ease,fill:'backwards'}))}
});
// Clicks on the table are reading, never a pick of the piece behind it.
specs.addEventListener('click',e=>e.stopPropagation());
const seamKey=add('<input id="seamKey" type="range" min="0" max="100" value="50" aria-label="Move the seam between the two pieces">');

// Each piece gets scroll in proportion to the root of its price, so the big ones whip past but never cut.
const allot=[0];for(let r=1;r<N;r++)allot[r]=allot[r-1]+Math.sqrt(prices[order[r]]);
const atRank=r=>N>1?allot[r]/allot[last]:1;
const rankAt=v=>{let r=0;while(r<last-1&&atRank(r+1)<v)r++;if(N<2)return 0;const t=clamp((v-atRank(r))/(atRank(r+1)-atRank(r)));return r+lerp(t,ss(t),.5)};
const SEG={priceIn:1,price:5.5,priceUp:1.4,priceBack:1.8,spliceIn:1.2,splice:1.5};

// Dearest against cheapest: the gap is the story.
let wA=0,wB=0,xA=0,xB=0,sy2=1,sBase=0,sCap=0,A=order[last],B=order[0],prevA=-1,prevB=-1,tA=-1e9,tB=-1e9,seam=0,seamT=0,held=false,sweep=-1,loaded=false;
const thumbs=g=>`<img alt="${g.ct.alt.replace(/"/g,'&quot;')}" src="${g.image_600}"><b>${g.brand} ${money(g.price)}</b>`;
const listing=(el,side)=>{
  el.innerHTML=order.map(i=>`<button data-i="${i}" aria-pressed="false" aria-label="${G[i].brand} ${G[i].short}, ${money(G[i].price)}">${thumbs(G[i])}</button>`).join('');
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;choose(side,+b.dataset.i)});
};
listing(pickA,'A');listing(pickB,'B');
// Picking the other page's piece swaps the pages rather than refusing.
function choose(side,i){
  const now=S.now,oa=A,ob=B;
  if(side==='A'){if(i===A)return;A=i;if(i===ob){B=oa}}else{if(i===B)return;B=i;if(i===oa){A=ob}}
  if(A!==oa){prevA=oa;tA=now}if(B!==ob){prevB=ob;tB=now}
  sync(true);
  S.setTail?.(`${G[A].id}/${G[B].id}`);
}
const rise=el=>{el.animate([{translate:'0 .1em',opacity:0},{translate:'0 0',opacity:1}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'})};
function sync(anim){
  for(const [box,cur] of [[pickA,A],[pickB,B]])for(const b of box.children)b.setAttribute('aria-pressed',+b.dataset.i===cur);
  const a=G[A],b=G[B],pt=money(a.price),pu=money(b.price);
  if(anim&&pa.textContent!==pt)rise(pa);if(anim&&pb.textContent!==pu)rise(pb);
  pa.textContent=pt;pb.textContent=pu;place();
  const hi=Math.max(a.price,b.price),lo=Math.min(a.price,b.price);
  times.textContent=hi===lo?'◂ same price ▸':`◂ ${(hi/lo).toFixed(1)}x ▸`;
  const cap=g=>`<strong>${g.brand}</strong>${g.short}${g.col?'<br>'+g.col:''}`;
  capA.innerHTML=cap(a);capB.innerHTML=cap(b);specRender(a,b);
  doorA.style.backgroundColor=css(a.room);doorB.style.backgroundColor=css(b.room);
  pa.style.color=capA.style.color=css(a.ink);pb.style.color=capB.style.color=css(b.ink);
}
// Both prices stand at one height. On a wide frame they flank the piece behind its sleeves; on a phone the piece fills the page, so they meet at the gutter in front.
function place(){
  const {w,pt}=S;wA=pa.offsetWidth;wB=pb.offsetWidth;
  xA=pt?12:84;xB=pt?w-12-wB:w-84-wB;
}
sync();

// The seam obeys the pointer everywhere except over the racks, or reaching for a piece would drag the page away.
stage.addEventListener('pointermove',e=>{if(q.spliceIn>.9&&!e.target.closest('.pick,#specs,.pos')){seamT=e.clientX;held=true}});
stage.addEventListener('pointerdown',e=>{if(q.spliceIn>.9&&!e.target.closest('.pick,#specs,.pos')){seamT=e.clientX;held=true;times.classList.add('held')}});
addEventListener('pointerup',()=>times.classList.remove('held'));
seamKey.addEventListener('input',()=>{seamT=+seamKey.value/100*S.w;held=true});
// M: the top of the type, below the masthead's paper band.
let specH=0,M=64,topY=64,rlen=0,C=[],X=[],Sx=[],floor=0,floorE=0,zEnd=1,fs=0,sy=1,mfs=0,ax1=0,sfs=0,wayW=0,wayP=0,multW=0;
// Six Caps, per em: top of the $ above the baseline, and the baseline's drop inside a line-height .9 box.
const DOL=.977,BASE=.895;
const contact=g=>(g.canvas.bottom_y-100)/1600;
const idOf=id=>G.findIndex(g=>g.id===id);
S.part('compare',{segs:Object.entries(SEG),
  rooms:{
    price:{
      stops:()=>[...order.map((_,r)=>S.at.price[0]+S.at.price[1]*atRank(r)),S.at.priceUp[0]+S.at.priceUp[1],S.at.priceBack[0]+S.at.priceBack[1]],
      pitch:()=>Math.max(S.w*.14,90),
      piece:v=>v<N?order[v]:null,
      label:v=>v===N?`Up the dearest piece, ${money(maxP)}`:`Every piece at one scale, ${money(minP)} to ${money(maxP)}`,
      box:()=>({x:S.w*.2,y:60,w:S.w*.6,h:S.h-120}),
      pick(){const i=S.hit();return i>=0&&S.live[i].c<S.h*1.2?i:-1},
    },
    splice:{
      at:()=>S.at.splice[0]+S.at.splice[1],
      now:()=>A,
      bar:roomBar('splice'),
      arg(a){const [x,y]=a.split('/').map(idOf);if(x>=0)choose('A',x);if(y>=0)choose('B',y)},
      pick:()=>S.my>52?(S.mx<seam?A:B):-1,
    },
  },
  measure(){
    const {w,h,pt}=S;
    // Digits fill the frame from under the nav down to the floor. Where the width runs out they stretch instead of shrinking.
    run.textContent=money(maxP);run.style.fontSize='100px';const per=run.offsetWidth/100;M=pt?54:64;topY=pt?122:104;rlen=0;
    floor=h-(pt?100:96);floorE=h*(pt?.86:.88);
    const cap=floor-topY;fs=Math.min(cap/DOL,(w-40)/per);sy=pt?1:cap/(fs*DOL);run.style.fontSize=fs+'px';
    mfs=pt?h*.07:h*.24;mult.style.fontSize=mfs+'px';
    // Height is price. The cheapest is anchored at a legible size, and the dearest is forced past the frame even if the range shrinks.
    const k=Math.max(h*.201/minP,h*2.4/maxP);
    C=order.map(i=>prices[i]*k);X=[0];
    // Sleeves overlap, so the frame always holds enough of the line to see it climbing.
    for(let r=1;r<N;r++)X[r]=X[r-1]+(C[r-1]+C[r])*.5*.46+Math.max(2,w*.002);
    wayW=h/2-floor;wayP=h*.44-contact(top)*C[last];
    // Skyline: the last pose fits the whole range in one frame. The others crowd up to the dearest, pitch by a root of size so the small pieces keep their own air.
    const cE=floorE*1.05/contact(top);zEnd=cE/C[last];ax1=w*(pt?.5:.76);
    const weights=C.map(c=>c**.62);let sum=0;for(let r=1;r<last;r++)sum+=(weights[r-1]+weights[r])/2;
    const left=(pt?.05:.035)*w,span=(pt?w*.95:ax1-cE*.24)-left;Sx=[left];for(let r=1;r<last;r++)Sx[r]=Sx[r-1]+(weights[r-1]+weights[r])/2/sum*span;Sx[last]=ax1;
    for(const t of tags)t.style.maxWidth=pt?'88px':'116px';
    // Spread digits: fit the widest label to a page.
    const longest=G.reduce((a,g)=>money(g.price).length>a.length?money(g.price):a,'');
    pa.style.fontSize='100px';const was=pa.textContent;pa.textContent=longest;const sp=pa.offsetWidth/100;pa.textContent=was;
    // The rows stand at the foot: under the garment on a wide frame, above the two thumb rails on a phone.
    // Phone: the piece fills the page, so the prices stand on the rows' own paper, one in each corner, never on the cloth or on each other.
    if(pt){sfs=Math.min((w/2-30)/sp,Math.min(56,h*.068)/DOL);sCap=sfs*DOL;specs.style.paddingTop=Math.round(sCap+26)+'px'}else specs.style.paddingTop='';
    specs.classList.remove('diff');specH=specs.offsetHeight;specs.classList.toggle('diff',diffOn);
    if(!pt){sBase=h-76;sCap=sBase-124;sfs=Math.min((w/2-84-h*.36)/sp,sCap/DOL)}
    sy2=sCap/(sfs*DOL);pa.style.fontSize=pb.style.fontSize=sfs+'px';pa.style.zIndex=pb.style.zIndex=pt?9:3;place();
    run.textContent='';multW=mult.offsetWidth;
  },
  pre(){
    // Shadow files carry a faint rectangle that shows on this pale floor, and the hero's slit is still up after a deep link.
    stage.classList.toggle('bare',q.priceIn>.3);if(q.priceIn>0)$('ground').classList.add('open');
    if(q.priceIn>0&&!loaded){loaded=true;for(let r=Math.max(0,last-9);r<N;r++)sharpen(by(r))}
    if(q.priceIn>.5&&q.priceUp<=0)S.rail=rankAt(q.price);
    if(q.spliceIn>.3)S.stack=['s',i=>i===A?101:i===B?100:i===prevA||i===prevB?99:90-rank[i]];else if(q.priceIn>.05)S.stack=['p',i=>100-rank[i]];
    // The seam rests on the gutter, sweeps once to teach the gesture, then belongs to the pointer.
    if(q.spliceIn<.5){held=false;sweep=-1}
    if(!held){seamT=S.w/2;if(q.spliceIn>=1){if(sweep<0)sweep=S.now;const t=(S.now-sweep)/2400;if(t<1)seamT+=Math.sin(t*Math.PI*2)*(1-t)*S.w*.2}}
    seam=S.jump?seamT:seam+(seamT-seam)*(1-Math.exp(-S.dt*.016));
    if(document.activeElement!==seamKey)seamKey.value=seam/S.w*100;
    S.ink=mixc(S.ink,G[A].ink,sss(q.spliceIn));
  },
  pose(i,P){
    const {w,h,pt}=S,r=rank[i];
    if(q.priceIn>0){
      const rf=rankAt(q.price),ri=Math.floor(rf),rt=rf-ri,xc=lerp(X[ri],X[Math.min(ri+1,last)],rt),cc=lerp(C[ri],C[Math.min(ri+1,last)],rt);
      // Camera: hold the floor on the walk, crane up the top piece, then pull back until every piece fits.
      const up=sss(q.priceUp),b=q.priceBack,e=sss(b),z=zEnd**e;
      const fx=lerp(pt?.5:.62,.5,clamp(cc/(w*.9)));
      const way=lerp(wayW,wayP,up);
      const ax=lerp(w*fx,ax1,e),ay=lerp(h/2,floorE-zEnd*(0-wayP),e);
      const xs=X[last]+(Sx[r]-ax1)/zEnd,wx=lerp(X[r],r===last?X[last]:xs,e),cam=lerp(xc,X[last],e);
      const c=C[r],sx=ax+z*(wx-cam),sc=z*c,hy=ay+z*(-contact(G[i])*c-way);
      const T={x:sx,y:hy,c:sc,o:1,l:0,r:1};
      // Off frame is hidden, so a 5000px layer costs nothing until it arrives.
      if(q.priceIn>=1&&(sx+sc*.4<-20||sx-sc*.4>w+20))T.o=0;
      P=q.priceIn>=1?T:mix(P,T,sss(clamp(q.priceIn*1.3-.3*r/last)));
    }
    if(q.spliceIn>0){
      const c=pt?w*2.15:Math.min(h*1.2,(h-specH-48-h*.035)/.84),y=pt?h*.075:h*.035,side=i===A?0:i===B?1:i===prevA?2:i===prevB?3:-1,inS=sss(q.spliceIn);
      if(side<0){const f=sss(clamp(q.spliceIn*1.9-.5*r/last));return {...P,y:P.y+f*h*1.15,o:f>=1?0:P.o}}
      // A swap slides along the rail from the outer edge: the old piece leaves the way the new one came.
      const left=side%2===0,t0=left?tA:tB,k=sss(clamp((S.now-t0)/620)),out=side>=2,shift=(left?-1:1)*w*.16*(out?k:1-k),x=w/2+shift;
      if(out&&k>=1)return {...P,o:0};
      const sf=clamp(.5+(seam-x)/c),T=left?{x,y,c,o:out?1-k:k,l:0,r:Math.min(sf,.89)}:{x,y,c,o:out?1-k:k,l:Math.max(sf,.11),r:1};
      P=mix(P,T,inS);
    }
    return P;
  },
  draw(){
    const {w,h,pt}=S,up=sss(q.priceUp),e=sss(q.priceBack),rf=rankAt(q.price),r0=Math.floor(rf),t=rf-r0;
    const walkOn=clamp((q.priceIn-.55)*2.4);
    // Doors close from both edges onto the seam, so background and garment split together.
    const d=sss(clamp((q.spliceIn-.1)/.9)),on=d>0;
    for(const [el,v] of [[doorA,lerp(-w,seam-w,d)],[doorB,lerp(w,seam,d)]]){vis(el,on?1:0);if(on)el.style.transform=`translate3d(${v.toFixed(1)}px,0,0)`}
    // Running price: rises on the floor, then sinks with it as the camera cranes up the dearest piece.
    const num=walkOn>0&&q.priceUp<1;
    vis(run,num?1:0);
    if(num){
      const p=up>0?maxP:t>0&&r0<last?Math.round(lerp(by(r0).price,by(r0+1).price,t)):by(Math.min(r0,last)).price,txt=money(p);
      if(run.textContent!==txt){run.textContent=txt;
        // Phone: real proportions, refitted when the number gains a digit, never stretched to the floor.
        if(pt&&txt.length!==rlen){rlen=txt.length;fs=Math.min(fs*(w-40)/run.offsetWidth,h*.42/DOL);run.style.fontSize=fs+'px'}}
      const y=(pt?topY+DOL*fs-BASE*fs:floor-BASE*fs*sy)+(1-sss(walkOn))*h+up*(wayW-wayP)*1.15,sc=`,${y.toFixed(1)}px,0) scale(1,${sy.toFixed(4)})`;
      run.style.transform=`translate3d(20px${sc}`;
    }
    // The multiple keeps the corner on the walk, then stands over the crowd at full height.
    // On the walk it stands behind the cloth, so it bows out before the next pieces climb past it and leave a stub at the edge of a hood.
    const reach=C[Math.min(r0+2,last)]*.84,mV=walkOn*(1-clamp(q.priceUp*5))*clamp((floor-M-mfs*.9-reach)/40+1),mE=sss(clamp((q.priceBack-.55)*3))*(1-sss(clamp(q.spliceIn*4)));
    vis(mult,mV>0||mE>0?1:0);
    if(mV>0||mE>0){
      const v=mE>0?maxP:t>0&&r0<last?lerp(by(r0).price,by(r0+1).price,t):by(Math.min(r0,last)).price,txt=ratio(v);
      if(mult._t!==txt||mult.classList.contains('sky')!==mE>0){mult._t=txt;mult.innerHTML=`${txt.slice(0,-1)}<span class="x">x</span><small>the cheapest</small>`;mult.classList.toggle('sky',mE>0);multW=mult.offsetWidth}
      mult.style.zIndex=mE>0?6:3;
      if(mE>0){const s=pt?Math.min(w*.56/multW,h*.3/(mfs*.9)):h*.62/(mfs*.9);mult.style.transform=`translate3d(20px,${lerp(h,M,mE).toFixed(1)}px,0) scale(${s.toFixed(3)})`;nGap.style.top=(M+mfs*.9*s+10)+'px'}
      else mult.style.transform=`translate3d(${(w-20-multW).toFixed(1)}px,${(M+(pt?34:0)-(1-mV)*(mfs+94)).toFixed(1)}px,0)`; // phone: under the room's one-line rule
    }
    vis(nPrice,walkOn*(1-clamp(q.priceUp*5))); // stays for the whole walk, so the rule is there whenever someone looks
    vis(nGap,clamp((q.priceBack-.82)*5.5)*(1-clamp(q.spliceIn*4)));
    // Foot tags, walked from the dearest down: a piece keeps its tag only if it clears the one to its right. On the skyline, only the two ends.
    const tagO=clamp((q.priceIn-.75)*4)*(1-clamp(q.priceUp*6)),tagS=clamp((q.priceBack-.85)*6.7)*(1-clamp(q.spliceIn*5)),tw=pt?96:124;
    let room=Infinity;
    for(let r=last;r>=0;r--){
      const i=order[r],el=tags[i],P=S.live[i];if(!P)continue;
      const ends=r===0||r===last,o=tagS>0?(ends?tagS:0):tagO,half=P.c*.27,x=tagS>0&&pt&&r===last?w-tw:clamp(P.x-half,20,w-tw);
      if(o<=0||P.o<=0||P.x+half<0||P.x-half>w||x+tw>room){vis(el,0);continue}
      room=x;vis(el,o);
      el.style.transform=`translate3d(${x.toFixed(1)}px,${((tagS>0?floorE:floor)+6).toFixed(1)}px,0)`;
    }
    // The spread.
    const sV=clamp((q.spliceIn-.72)*3.6);
    for(const el of [pickA,pickB,capA,capB,pickAL,pickBL,specs])vis(el,sV);specs.style.pointerEvents=sV>.5?'auto':'none';
    vis(pa,sV>0?1:0);vis(pb,sV>0?1:0);
    seamKey.style.visibility=sV>0?'visible':'hidden'; // not vis(): its inline opacity would show the bare range
    pickA.style.pointerEvents=pickB.style.pointerEvents=sV>.5?'auto':'none';
    const line=sV>0;vis(seamEl,line?sV:0);vis(times,line?sV:0);
    if(line){
      seamEl.style.transform=`translate3d(${seam.toFixed(1)}px,0,0)`;seamEl.style.background=css(G[B].ink);
      // Each price belongs to its page, so the seam wipes it with the garment and the ground.
      if(pt)sBase=specs.offsetTop+12+sCap; // follows the rows' paper as matching rows fold away
      const dy=sBase-BASE*sfs*sy2+(1-sss(sV))*h*.6,sc=` scale(1,${sy2.toFixed(4)})`;
      pa.style.transform=`translate3d(${xA.toFixed(1)}px,${dy.toFixed(1)}px,0)${sc}`;
      pb.style.transform=`translate3d(${xB.toFixed(1)}px,${dy.toFixed(1)}px,0)${sc}`;
      pa.style.clipPath=`inset(-30% ${Math.max(0,xA+wA-seam).toFixed(1)}px -30% -9px)`;
      pb.style.clipPath=`inset(-30% -9px -30% ${Math.max(0,seam-xB).toFixed(1)}px)`;
      const tw=times.offsetWidth,ty=pt?specs.offsetTop-34:h-specH-58;times.style.transform=`translate3d(${clamp(seam-tw/2,0,w-tw).toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      seamKey.style.transform=`translate3d(${clamp(seam-48,0,w-96).toFixed(1)}px,${(ty-1).toFixed(1)}px,0)`;
      const cw=(c,left)=>left?seam>84+c.offsetWidth:seam<w-84-c.offsetWidth;vis(capA,cw(capA,true)?sV:0);vis(capB,cw(capB,false)?sV:0);
    }
    // The nav sits on whichever page is under it.
    const nav=$('nav');nav.style.color=sV>0?css(seam<w*.72?G[B].ink:G[A].ink):'';$('logo').style.color=sV>0?css(seam>120?G[A].ink:G[B].ink):''; // core only repaints --ink when the ground changes
  },
  hover(){const live=q.priceIn>.8&&q.priceUp<=0||q.priceBack>.92&&q.spliceIn<.2;if(!live)return -1;const i=S.hit();return i>=0&&S.live[i].c<S.h*1.2?i:-1},
});
