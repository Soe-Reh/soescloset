import {S,$,G,clamp,mixc,vis,add,ss,lerp} from '../core.js';
const {q,N,last,reduced}=S;
const rail=add('<div id="rail"></div>');
const odo=add('<div id="odo" class="six" aria-hidden="true"><div id="odoIn"></div></div>'),odoIn=odo.firstChild;
odoIn.innerHTML=G.map(g=>`<p><span>${g.brand}</span></p>`).join('');
const lines=[...odoIn.children],gs=$('gs');
// The whole rail in small, to jump along it: press anywhere, or run a finger across. Keys already reach every stop, so this stays out of the tab order.
const rack=add(`<div id="rack" aria-hidden="true">${G.map(g=>`<img alt="" draggable="false" title="${g.brand} ${g.short}" src="${g.image_600}">`).join('')}</div>`),minis=[...rack.children];
const scrub=e=>{const b=rack.getBoundingClientRect();S.moverGo?.(Math.round(clamp((e.clientX-b.left)/b.width)*last))};
rack.addEventListener('pointerdown',e=>{rack.setPointerCapture(e.pointerId);scrub(e)});
rack.addEventListener('pointermove',e=>{if(rack.hasPointerCapture(e.pointerId))scrub(e)});
rack.addEventListener('click',e=>e.stopPropagation());
let rackN=-1,shook=0;
const tagBox=add(`<div id="tags" aria-hidden="true">${G.map((g,i)=>`<div class="tag"><div><small>${String(i+1).padStart(2,'0')}/${N}</small><b class="six">$${g.label}</b><span>${g.short}${g.col?`<em>${g.col.toLowerCase()}</em>`:''}</span></div></div>`).join('')}</div>`),tags=[...tagBox.children];
let tagW=150,T=0,wk=-1,lastT=0,speed=0,act=0,belt=0,beltV=0,sag=0,sagV=0,xs=[],held=-1,ringN=-1,push=G.map(()=>0);
const HOOK=52/1600,YAW=66;let RAIL=62; // hook length in canvas units, the rod's height just under the chrome, and how far a closed piece stands edge-on
const typeH=()=>Math.round(S.h*(S.pt?.19:.17));
const hovers=matchMedia('(hover:hover) and (pointer:fine)').matches;
// Hood to cuff (.85 of the canvas for all but the longest sleeves) fills what the rod and the type leave, so hems clear the live name and only cuffs may touch it.
// On a phone the widest cut just clears the screen, so the piece reads whole and the next reads as next. Below it: the name, the rack, the controls.
const size=()=>Math.min(S.w*(S.pt?1.26:.6),(S.h-RAIL-typeH()-(S.pt?116:22))/(.85+HOOK));

// Every piece has a hook on the rail and its own tag on the rod. Same tag on every piece, whatever the price says.
G.forEach(g=>{
  g.el.insertAdjacentHTML('beforeend','<i class="hk"></i>');
  g.tga=g.tgv=g.hem=g.shear=g.lag=g.lagV=g.pull=g.yw=g.ywv=g.yaw=g.hv=g.hvv=0;
});

// One rail, one scale. The open piece faces you; the rest stand edge-on and packed, as a rack does. Front-only cutouts hold up turned this far because each shows only a strip.
// Past the open slot a piece moves at the stack's pitch, so what lies ahead bunches and the open piece alone stays 1:1 under the hand.
const gapOf=c=>c*(S.pt?.43:.45),stackOf=c=>c*(S.pt?.05:.13);
// The rail's first and last stops would each leave half the room bare, so the open slot drifts across as you walk.
const drift=()=>S.pt?0:.28*S.w/last,slotAt=t=>S.w*(S.pt?.46:.36)+drift()*t;
const spot=(u,t,c)=>{const a=Math.abs(u);return slotAt(t)+Math.sign(u)*(gapOf(c)*Math.min(a,1)+stackOf(c)*Math.max(a-1,0))};
S.base=(i,t)=>{
  const c=size(),x=spot(i-t-G[i].lag,t,c)+push[i];
  return {x,y:RAIL+c*HOOK+sag,c,o:x+c*.4<0||x-c*.4>S.w?0:1,l:0,r:1};
};
// The garment under the pointer, read from where pieces rest, not where a hover has pushed them, or the rack would flicker as it parts.
function under(){
  const c=size();let best=-1,bd=1;
  if(S.my<RAIL||S.my>RAIL+c*.9)return -1;
  G.forEach((g,i)=>{const u=i-T,open=1-ss(clamp(Math.abs(u))),d=Math.abs(S.mx-spot(u,T,c))/(c*(lerp(.125,.32,open)));if(d<bd){bd=d;best=i}});
  return best;
}
// Facing is one spring per garment, the proportions of a hand turning a hanger: arrives in about 300ms with a degree of overshoot.
function turn(dt,snap){
  const h=held,c=size();
  push.fill(0);
  G.forEach((g,i)=>{
    const u=i-T,bell=1-ss(clamp(Math.abs(u))),open=i===h?1:h>=0?bell*.3:bell,side=h>=0&&i!==h&&bell>0?Math.sign(i-h):u<0?-1:1,to=-side*YAW*(1-open);
    if(snap){g.yw=to;g.ywv=0;g.hv=i===h?1:0;g.hvv=0}
    else{
      g.ywv+=(-155*(g.yw-to)-19.5*g.ywv)*dt;g.yw+=g.ywv*dt;
      g.hvv+=(-140*(g.hv-(i===h?1:0))-21*g.hvv)*dt;g.hv+=g.hvv*dt;
    }
    if(Math.abs(g.hv)>.002){
      // A piece opened at the screen's edge slides in, tag and all, or you would turn to it and still not see it.
      const x=spot(u,T,c),inset=Math.min(0,S.w-x-c*.42)||Math.max(0,c*.34-x);
      for(let j=0;j<N;j++)push[j]+=g.hv*(inset+(j===i?0:Math.sign(j-i)*c*.21));
    }
  });
  // Off the rack's own beat the plate lies flat again, so the Wall inherits a square garment.
  const keep=1-clamp(q.wallIn*3);
  for(const g of G)g.yaw=g.yw*keep;
}
S.part('walk',{segs:[['walk',last*.52]],
  rooms:{walk:{
    stops:()=>G.map((_,i)=>S.at.walk[0]+S.at.walk[1]*i/last),
    pitch(){return gapOf(size())-drift()}, // the open piece's own travel per stop, so a drag is 1:1
    piece:s=>s,
    fling:.42, // a real rack runs on when you throw it, several hangers past where the hand let go
    hint:'Drag the rail, or click a hoodie',
    touch:'Swipe, tap to open',
    box(){const c=size();return {x:slotAt(Math.round(T))-c*.3,y:RAIL+c*HOOK,w:c*.6,h:c*.82}},
    // The pointer has already turned a piece to face it, so a click opens that one and the rail follows behind the sheet. A finger has no hover: its first tap on a closed piece turns it to the front.
    pick(){
      const i=under(),n=Math.round(T);
      if(i<0||i===n)return i;
      S.moverStep?.(i-n);
      return hovers?i:-1;
    },
  }},
  measure(){
    RAIL=S.pt?Math.max(62,Math.round(S.h*.1)):62; // a tall phone has air to spare: above the rod it reads as a room, below the hem as a gap
    // Conveyor type: one word per piece, each fitted so a long name still reads whole when it is the live one.
    const {w}=S,lh=typeH(),maxW=w-40;tagW=tags[0]?.offsetWidth||150;
    odo.style.height=lh+'px';
    const ctx=document.createElement('canvas').getContext('2d');ctx.font='100px Six';const mt=ctx.measureText('H'),capR=mt.actualBoundingBoxAscent/100,fA=mt.fontBoundingBoxAscent/100,fD=mt.fontBoundingBoxDescent/100;
    lines.forEach(p=>{const sp=p.firstChild,fs0=lh*.96/capR;p.style.height=lh+'px';sp.style.lineHeight=lh+'px';sp.style.fontSize=fs0+'px';const fs=fs0*Math.min(1,maxW/sp.offsetWidth);sp.style.fontSize=fs+'px';sp.style.transform=`translateY(${lh-((lh-(fA+fD)*fs)/2+fA*fs)-3}px)`});
    odoIn.style.gap=lh*.14+'px';xs=lines.map(p=>p.offsetLeft);
    for(const g of G)g.px=null;
  },
  pre(){
    T=S.T=q.walk*last; // the mover's snap is the dwell, so a drag stays 1:1
    const a=Math.min(last,Math.floor(T)),b=Math.min(last,a+1),tf=T-a;
    S.gr=mixc(G[a].room,G[b].room,tf);S.ink=mixc(G[a].ink,G[b].ink,tf);
    if(q.hero>=1)$('ground').classList.add('open'); // a deep link never runs the opening, so its slit would stay lit on this wall
    // Hang-and-part belongs to the rack: claim the stacking while it is on, the nearest to the open slot on top.
    if(q.wallIn<.5){const n=Math.round(T),h=held;S.stack=[`r${n}.${h}`,i=>i===h?200:100-Math.abs(i-n)]}
    // The open slot drifts along the rail, so the focus ring has to follow it.
    const nr=Math.round(T);
    if((nr!==ringN||S.jump)&&S.room==='walk'&&S.moverEl){ringN=nr;S.moverEl.style.setProperty('--bx',slotAt(nr)-size()*.3+'px')}
    if(reduced||S.jump){
      belt=lastT=T;act=Math.round(T);beltV=sagV=sag=speed=0;
      for(const g of G){g.lag=g.lagV=g.pull=0;g.px=null}
      turn(0,true);
      if(reduced)return;
    }
    const dt=Math.max(S.dt,1)/1000,rv=(T-lastT)/dt;lastT=T;
    // First arrival: the queue bumps toward the open piece and swings, so the rack says it can be pushed before anyone tries.
    if(S.room==='walk'&&shook>=0&&q.hero>=1){
      if(!shook)shook=S.now+900;
      else if(S.now>shook){shook=-1;G.forEach((g,i)=>{const u=i-T;if(u>0&&u<8){g.lagV+=3.2/(1+u*.25);g.swv+=11}})}
    }
    turn(dt);
    speed+=(Math.abs(rv)-speed)*(1-Math.exp(-dt/.08));
    // Past the live piece each hanger is only shoved along by the one before it, so the queue arrives late and bunches on the stop.
    G.forEach((g,i)=>{
      const d=Math.abs(i-T),k=170/(1+d*.7);
      g.lagV+=(-k*g.lag-1.24*Math.sqrt(k)*g.lagV)*dt;g.lag=clamp(g.lag+g.lagV*dt-rv*dt,-.6,.6);
      // Drag on the cloth is its own travel along the rail: the live piece is steadied, the queue barely moves so barely swings.
      const P=S.base(i,T),vn=g.px===null?0:(P.x-g.px)/dt/P.c;g.px=P.x;
      g.pull+=(clamp(vn*2.2,-1.3,1.3)*(.5+.5*Math.min(1,d))-g.pull)*(1-Math.exp(-dt/(.04+.035*d)));
      g.swv+=24.5*g.pull*dt;
    });
    // Crossing a piece knocks the pair either side of it apart, as far as the rail was moving.
    const n=Math.round(T);
    if(n!==act){
      const s=Math.min(1,(speed/6)**.7),knock=(j,v)=>{const g=G[j];if(g)g.swv+=v*s*(1-clamp(Math.abs(g.sw)/4.5))};
      knock(n-1,20);knock(n+1,-20);knock(act-Math.sign(n-act),n>act?12:-12);act=n;
    }
    // The rod takes the load: it dips with speed and rings once on the stop.
    sagV+=(-140*(sag-Math.min(3.5,speed*1.1))-9*sagV)*dt;sag+=sagV*dt;
    beltV+=(-70*(belt-(held>=0?held:T))-13*beltV)*dt;belt+=beltV*dt;
    // Cloth: the hem follows the hood late. Tag: k27 c1.8 sits just above the swing's resonance, which holds it about 200ms behind the garment.
    const kh=1-Math.exp(-dt/.09);
    for(const g of G){
      g.hem+=(g.sw-g.hem)*kh;g.shear=g.sw-g.hem;
      g.tgv+=(-27*(g.tga-g.sw*.3-g.pull)-1.8*g.tgv)*dt;g.tga+=g.tgv*dt;
    }
  },
  draw(){
    const inWalk=clamp(q.hero*2)*(1-clamp(q.wallIn*2.2));
    rail.style.transform=`translate3d(0,${(RAIL+sag).toFixed(2)}px,0)`;vis(rail,inWalk);
    vis(odo,inWalk);
    vis(rack,S.room==='walk'?inWalk:0);
    const rn=Math.round(T);
    if(rn!==rackN){minis[rackN]?.classList.remove('on');minis[rn]?.classList.add('on');rackN=rn}
    if(inWalk>0){
      const b=clamp(belt,0,last),f=Math.min(last-1,Math.floor(b));
      odoIn.style.transform=`translate3d(${(20-(xs[f]+(xs[f+1]-xs[f])*(b-f))).toFixed(2)}px,0,0)`;
      // Only the live name: ghosts ran off the frame cut mid-word.
      lines.forEach((p,i)=>{const o=clamp(1.5-Math.abs(i-belt)*1.7).toFixed(2);if(p._o!==o){p._o=o;p.style.opacity=o}});
    }
    // hooks and tags belong to the rail, so they leave with it
    const k=clamp(q.hero*4-.6)*(1-clamp(q.wallIn*5))||0;
    if(k!==wk){wk=k;gs.style.setProperty('--wk',k);gs.classList.toggle('hung',k>0)}
    // Not vis(): a tag's own visibility would outlive a hidden parent.
    tagBox.hidden=!(k>0);tagBox.style.opacity=k;
    if(k>0)for(const P of S.live){
      // Closed, a piece shows only its price, right on its own hook, the one thing worth reading along a rack. Opening it grows the whole tag and swings it clear of the hood.
      const g=G[P.i],open=ss(clamp(1-Math.abs(g.yw)/YAW)),tag=tags[P.i],x=lerp(P.x-tagW/2,P.x+P.c*(S.pt?.14:.17),open),big=open>.3;
      // A phone's stack is too tight to read past the next piece, so only that one keeps its price.
      if(P.o<.004||x>S.w||x+tagW<0||S.pt&&!big&&Math.abs(P.i-T)>1.6){vis(tag,0);continue}
      if(tag._b!==big){tag._b=big;tag.classList.toggle('tiny',!big);tag.style.zIndex=big?2:1}
      vis(tag,1);tag.style.transform=`translate3d(${x.toFixed(2)}px,${(RAIL+1+sag).toFixed(2)}px,0) rotate(${(g.tga-5).toFixed(2)}deg) scale(${lerp(.46,1,open).toFixed(3)})`;
    }
  },
  hover(){
    // A rail in flight runs under a still pointer: only a resting rack answers it.
    let h=-1;
    if(hovers&&q.wallIn<.2&&q.hero>.3&&speed<.6&&!S.moverEl?.classList.contains('drag'))h=under();
    if(h!==held){
      // Pushing a hanger aside knocks the ones either side of it, and its tag is the last to settle.
      if(!reduced&&h>=0){if(G[h-1])G[h-1].swv-=16;if(G[h+1])G[h+1].swv+=16;G[h].tgv+=26}
      held=h;
    }
    S.noTip=true;return h; // the piece's own tag names it
  },
});
