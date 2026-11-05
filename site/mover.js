// Sideways movement for a room. A native snapping scroller is the source of truth, so touch and trackpad momentum are the browser's own;
// mouse drag, wheel, keys and buttons turn snap off and drive the same scrollLeft with one spring.
import {S,G,clamp,lerp,money} from './core.js';
const stage=document.getElementById('stage'),ARROW=d=>`<svg viewBox="0 0 16 10" aria-hidden="true"><path d="${d>0?'M0 5h15M11 1l4 4-4 4':'M16 5H1M5 1L1 5l4 4'}"/></svg>`;
const fine=matchMedia('(pointer:fine)').matches;

export function mover(name,room,next){
  const stops=room.stops(),n=stops.length,el=document.createElement('div'),chip=document.createElement('div'),now=()=>performance.now();
  let fingers=0,pitch=1,x=0,goal=0,v=0,running=false,prev=0,idle=0,settle=0,at=room.start??0,drag=null;
  const nameOf=s=>{const g=G[room.piece?.(s)];return g?`${g.brand} ${g.short}, ${money(g.price)}`:room.label?.(s)||''};
  el.className='mover';el.dataset.room=name;el.setAttribute('role','group');el.setAttribute('aria-label',`${name}: arrow keys move, Enter opens the piece`);
  el.innerHTML=`<div>${stops.map((_,s)=>{const g=G[room.piece?.(s)];return `<div class="slot"><button type="button" tabindex="-1"${g?` data-piece="${g.id}"`:''} aria-label="${nameOf(s).replace(/"/g,'&quot;')}"></button></div>`}).join('')}</div>`;
  chip.className='pos';chip.dataset.room=name;
  chip.innerHTML=`<small>${fine?room.hint||'Drag, scroll or arrow keys':room.touch||'Swipe'}</small><button type="button" class="pv" aria-label="Previous">${ARROW(-1)}</button><b></b><i></i><button type="button" class="nx" aria-label="Next">${ARROW(1)}</button>`;
  stage.append(el,chip);
  const btns=[...el.querySelectorAll('button')],count=chip.querySelector('b'),bar=chip.querySelector('i'),pv=chip.querySelector('.pv'),nx=chip.querySelector('.nx');
  const max=()=>(n-1)*pitch;

  function fit(){
    pitch=room.pitch();const b=room.box?.()||{x:0,y:0,w:S.w,h:S.h};
    el.style.setProperty('--p',pitch+'px');
    for(const [k,val] of [['bx',b.x],['by',b.y],['bw',b.w],['bh',b.h]])el.style.setProperty('--'+k,val+'px');
    el.scrollLeft=x=goal=at*pitch;
    if(room.chip)chip.style.bottom=room.chip()+'px';
  }
  // Position from scrollLeft: a straight line between stops, so the timeline follows the finger exactly.
  function sync(){
    if(S.room!==name)return;
    const t=clamp(el.scrollLeft/pitch,0,n-1),r=Math.abs(t-Math.round(t))<.004?Math.round(t):t,i=Math.min(n-2,Math.floor(r));
    S.tp=n>1?lerp(stops[i],stops[i+1],r-i):stops[0];
    const s=Math.round(r);
    if(s!==at){at=s;mark()}
    bar.style.setProperty('--at',n>1?r/(n-1):1);
    clearTimeout(settle);settle=setTimeout(()=>{
      // A browser can end a touch gesture without snapping (seen in Chromium), and a rail must never rest between two pieces.
      if(!fingers&&!drag&&!running&&!idle&&Math.abs(el.scrollLeft/pitch-at)>.01)goTo(at);
      room.settled?.(at);
    },160);
  }
  function mark(){
    count.textContent=`${String(at+1).padStart(2,'0')}/${n}`;
    btns.forEach((b,s)=>{b.tabIndex=s===at?0:-1});
    if(btns.includes(document.activeElement))btns[at].focus({preventScroll:true});
    pv.disabled=at===0;
    const end=at===n-1&&next;
    nx.disabled=at===n-1&&!next;
    nx.innerHTML=end?`${next[1]}&nbsp;${ARROW(1)}`:ARROW(1);
    nx.setAttribute('aria-label',end?`Next room: ${next[1]}`:'Next');
  }
  const moved=()=>chip.classList.add('moved');
  function run(){
    el.classList.add('free');
    room.settled?.(Math.round(goal/pitch)); // the URL names where the rail is going, not where it was a second ago
    if(S.reduced){x=goal;v=0;el.scrollLeft=x;sync();rest();return}
    if(running)return;running=true;prev=now();requestAnimationFrame(tick);
  }
  function tick(t){
    if(!running)return;
    const dt=Math.min(.033,Math.max(.001,(t-prev)/1000));prev=t;
    v+=(70*(goal-x)-16.7*v)*dt;x+=v*dt; // critically damped, so a throw keeps its speed into the stop and never bounces back past it
    if(Math.abs(goal-x)<.4&&Math.abs(v)<8){x=goal;running=false;v=0}
    el.scrollLeft=x;sync();
    running?requestAnimationFrame(tick):rest();
  }
  // Snap only comes back on a real stop: re-enabling it mid-gesture would yank the rail to the nearest one.
  function rest(){if(!drag&&!idle&&Math.abs(x/pitch-Math.round(x/pitch))<.01)el.classList.remove('free')}
  const halt=()=>{running=false;v=0};
  function step(d){moved();if(!running&&!idle)x=goal=el.scrollLeft;goal=clamp(Math.round(goal/pitch)+d,0,n-1)*pitch;run()}
  function goTo(s){x=el.scrollLeft;goal=clamp(s,0,n-1)*pitch;run()}
  // One notch always lands on the next stop in its direction; it never springs back to where it was.
  function wheel(d){
    moved();if(!running&&!idle)x=goal=el.scrollLeft;
    goal=clamp(goal+d,0,max());run();
    clearTimeout(idle);
    idle=setTimeout(()=>{idle=0;const s=goal/pitch,f=s-Math.floor(s);goal=clamp(d>0?(f>.08?Math.ceil(s):Math.floor(s)):(f<.92?Math.floor(s):Math.ceil(s)),0,n-1)*pitch;run();if(!running)rest()},130);
  }

  el.addEventListener('scroll',sync,{passive:true});
  el.addEventListener('touchstart',e=>{fingers=e.touches.length},{passive:true});
  for(const t of ['touchend','touchcancel'])el.addEventListener(t,e=>{fingers=e.touches.length;sync()},{passive:true});
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){moved();halt();el.classList.remove('free');return}
    if(e.button)return;
    halt();drag={x0:e.clientX,s:el.scrollLeft,px:e.clientX,t:e.timeStamp,vx:0,on:false};
  });
  el.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(!drag.on){if(Math.abs(e.clientX-drag.x0)<6)return;drag.on=true;moved();el.classList.add('free','drag');el.setPointerCapture(e.pointerId)}
    el.scrollLeft=x=drag.s-(e.clientX-drag.x0);sync();
    const dt=e.timeStamp-drag.t;if(dt>0){drag.vx=lerp(drag.vx,-(e.clientX-drag.px)/dt*1000,.5);drag.px=e.clientX;drag.t=e.timeStamp}
  });
  const up=e=>{
    if(!drag)return;const d=drag;drag=null;if(!d.on)return;
    el.classList.remove('drag');
    x=el.scrollLeft;v=e.timeStamp-d.t>90?0:clamp(d.vx,-4000,4000);
    goal=clamp(Math.round((x+v*(room.fling??.16))/pitch),0,n-1)*pitch;run();
  };
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('focusin',e=>{const s=btns.indexOf(e.target);if(s>=0&&!S.pieceClosing&&s!==Math.round(el.scrollLeft/pitch))goTo(s)});
  pv.addEventListener('click',()=>step(-1));
  nx.addEventListener('click',()=>{if(at===n-1&&next)location.hash=next[0];else step(1)});
  addEventListener('resize',fit);

  fit();mark();
  return {
    el,wheel,step,
    stop:()=>at,
    stopOfPiece:i=>stops.findIndex((_,s)=>room.piece?.(s)===i),
    pOf:s=>stops[clamp(s,0,n-1)],
    enter(s=at){at=clamp(s,0,n-1);el.classList.add('on');chip.classList.add('on');S.moverEl=el;S.moverStep=step;S.moverGo=s=>{moved();goTo(s)};halt();fit();S.tp=stops[at];bar.style.setProperty('--at',n>1?at/(n-1):1);mark()},
    leave(){el.classList.remove('on');chip.classList.remove('on');halt();clearTimeout(idle);idle=0;if(S.moverEl===el)S.moverEl=null},
    piece:()=>room.piece?.(at)??-1,
  };
}
