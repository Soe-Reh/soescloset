// Sideways movement for a room. A native snapping scroller is the source of truth, so touch and trackpad momentum are the browser's own;
// mouse drag, wheel, keys and buttons turn snap off and drive the same scrollLeft, damped toward a target (round 3: maath-style damp, not a spring).
// Past either end the rail rubber-bands (S.over, drawn by core); pulling or scrolling on past the end turns the page to the next or previous room.
import {S,G,clamp,lerp,money} from './core.js';
import {sec,damp,RUBBER} from './motion.js';
const stage=document.getElementById('stage'),ARROW=d=>`<svg viewBox="0 0 16 10" aria-hidden="true"><path d="${d>0?'M0 5h15M11 1l4 4-4 4':'M16 5H1M5 1L1 5l4 4'}"/></svg>`;
const fine=matchMedia('(pointer:fine)').matches;

// A page turn by gesture takes two on purpose: the first push past the end only arms it and says so above the bar; a second push within 2.5 s turns.
// A click on the bar's named arrow is already deliberate and turns at once.
function armer(chip){
  const el=document.createElement('span');el.className='again';el.setAttribute('role','status');chip.append(el);
  let d0=0,to=0;
  const clear=()=>{d0=0;clearTimeout(to);chip.classList.remove('armed')}; // the words stay while it fades
  return {clear,push(d,room){
    if(!room)return false;
    if(d0===d){clear();return true}
    d0=d;el.textContent=`${fine?'Scroll':'Swipe'} again for ${room[1]}`;chip.classList.add('armed');clearTimeout(to);to=setTimeout(clear,2500);return false;
  }};
}

// The same corner bar for a room with no rail (Wall, Compare): back and on, with a count when the room has pieces to step through.
// At either end (or always, with no count) the arrow names the next room and turns the page, as a rail's bar does.
export function roomBar(name,{n=0,step}={}){
  const chip=document.createElement('div');chip.className='pos on-bar'+(n?'':' links');chip.dataset.room=name;
  chip.innerHTML=`<button type="button" class="pv"></button>${n?'<b></b>':''}<i></i><button type="button" class="nx"></button>`;
  stage.append(chip);
  const pv=chip.querySelector('.pv'),nx=chip.querySelector('.nx'),count=chip.querySelector('b'),line=chip.querySelector('i');
  let at=0;
  const ends=()=>S.nbr?.(name)||[null,null];
  const go=(d,turn=true)=>{
    if(n&&(d>0?at<n-1:at>0))return step(d);
    if(!turn)return; // keys stop at the end, as on a rail; only the bar's named arrow turns the page
    const to=ends()[d>0?1:0];if(to){S.hush?.(900);location.hash=to[0]}
  };
  pv.addEventListener('click',()=>go(-1));nx.addEventListener('click',()=>go(1));
  function set(a=at){
    at=a;const [p,x]=ends(),s=!n||at<=0,e=!n||at>=n-1;
    if(n){count.textContent=`${String(at+1).padStart(2,'0')}/${n}`;line.style.setProperty('--at',n>1?at/(n-1):1)}
    pv.innerHTML=s&&p?`${ARROW(-1)}&nbsp;${p[1]}`:ARROW(-1);pv.setAttribute('aria-label',s&&p?`Previous room: ${p[1]}`:'Previous');pv.disabled=s&&!p;
    nx.innerHTML=e&&x?`${x[1]}&nbsp;${ARROW(1)}`:ARROW(1);nx.setAttribute('aria-label',e&&x?`Next room: ${x[1]}`:'Next');nx.disabled=e&&!x;
  }
  const arm=armer(chip);
  const push=d=>{const to=ends()[d>0?1:0];if(arm.push(d,to)){S.hush?.(900);location.hash=to[0]}};
  return {chip,set,go,n,push,clear:arm.clear};
}

export function mover(name,room,next,prev){
  const stops=room.stops(),n=stops.length,el=document.createElement('div'),chip=document.createElement('div'),now=()=>performance.now();
  let fingers=0,pitch=1,x=0,goal=0,lam=9,running=false,last=0,idle=0,settle=0,at=room.start??0,drag=null,ov=0,ovTo=0,raw=0,edge=0,gpad=false,touch0=null;
  const nameOf=s=>{const g=G[room.piece?.(s)];return g?`${g.brand} ${g.short}, ${money(g.price)}`:room.label?.(s)||''};
  el.className='mover';el.dataset.room=name;el.setAttribute('role','group');el.setAttribute('aria-label',`${name}: arrow keys move, Enter opens the piece`);
  el.innerHTML=`<div>${stops.map((_,s)=>{const g=G[room.piece?.(s)];return `<div class="slot"><button type="button" tabindex="-1"${g?` data-piece="${g.id}"`:''} aria-label="${nameOf(s).replace(/"/g,'&quot;')}"></button></div>`}).join('')}</div>`;
  chip.className='pos';chip.dataset.room=name;
  chip.innerHTML=`<small>${fine?room.hint||'Drag, scroll or arrow keys':room.touch||'Swipe'}</small><button type="button" class="pv" aria-label="Previous">${ARROW(-1)}</button><b></b><i></i><button type="button" class="nx" aria-label="Next">${ARROW(1)}</button>`;
  stage.append(el,chip);
  const btns=[...el.querySelectorAll('button')],count=chip.querySelector('b'),bar=chip.querySelector('i'),pv=chip.querySelector('.pv'),nx=chip.querySelector('.nx');
  const max=()=>(n-1)*pitch,arm=armer(chip),push=d=>arm.push(d,d>0?next:prev)&&leaveTo(d);

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
      if(!fingers&&!drag&&!running&&!idle&&Math.abs(el.scrollLeft/pitch-at)>.01)goTo(at,12);
      room.settled?.(at);
    },160);
  }
  function mark(){
    if(at!==0&&at!==n-1)arm.clear();
    count.textContent=`${String(at+1).padStart(2,'0')}/${n}`;
    btns.forEach((b,s)=>{b.tabIndex=s===at?0:-1});
    if(btns.includes(document.activeElement))btns[at].focus({preventScroll:true});
    const start=at===0&&prev;
    pv.disabled=at===0&&!prev;
    pv.innerHTML=start?`${ARROW(-1)}&nbsp;${prev[1]}`:ARROW(-1);
    pv.setAttribute('aria-label',start?`Previous room: ${prev[1]}`:'Previous');
    const end=at===n-1&&next;
    nx.disabled=at===n-1&&!next;
    nx.innerHTML=end?`${next[1]}&nbsp;${ARROW(1)}`:ARROW(1);
    nx.setAttribute('aria-label',end?`Next room: ${next[1]}`:'Next');
  }
  const moved=()=>chip.classList.add('moved');
  // The rail's overshoot past an end, in px. core.js shifts every garment by it, so the whole room gives a little and comes back.
  const setOver=o=>{if(S.room!==name)return;if((S.over||0)!==o){S.over=o;S.wake()}};
  // lambda: how fast the rail closes on its target, per second. A throw's is set from its fling, so the rail leaves the hand at about the hand's speed.
  function run(l=9){
    lam=l;el.classList.add('free');
    room.settled?.(Math.round(goal/pitch)); // the URL names where the rail is going, not where it was a second ago
    if(running)return;running=true;last=now();requestAnimationFrame(tick);
  }
  function tick(t){
    if(!running)return;
    const dt=sec(t-last);last=t;
    x=damp(x,goal,lam,dt);if(Math.abs(goal-x)<.4)x=goal;
    if(!drag){ov=damp(ov,ovTo,14,dt);if(Math.abs(ov-ovTo)<.3)ov=ovTo}
    if(x===goal&&ov===ovTo&&!ovTo)running=false;
    el.scrollLeft=x;setOver(ov);sync();
    running?requestAnimationFrame(tick):rest();
  }
  // Out of the rail's end into the next room (or back into the last one). The wheel is hushed, so the flick's tail does not drive the new room.
  function leaveTo(d){
    const to=d>0?next:prev;raw=0;ovTo=0;arm.clear();
    if(!to)return false;
    S.hush?.(900);location.hash=to[0];return true;
  }
  // Snap only comes back on a real stop: re-enabling it mid-gesture would yank the rail to the nearest one.
  function rest(){if(!drag&&!idle&&Math.abs(x/pitch-Math.round(x/pitch))<.01)el.classList.remove('free')}
  const halt=()=>{running=false};
  function step(d){moved();if(!running&&!idle)x=goal=el.scrollLeft;goal=clamp(Math.round(goal/pitch)+d,0,n-1)*pitch;run(9)}
  function goTo(s,l=9){x=el.scrollLeft;goal=clamp(s,0,n-1)*pitch;run(l)}
  // One notch always lands on the next stop in its direction; it never springs back to where it was.
  // Lenis-style: every delta (already in px) moves a target and the rail damps toward it. A trackpad's stream gets a quick damp so it still feels 1:1; a notch a softer one.
  // Deltas past an end pile up as overshoot, shown at a quarter (rubber band). If the gesture began at that end, enough of it turns the page.
  let g0=0,late=false;
  function wheel(d){
    moved();
    const pad=Math.abs(d)<40;gpad=pad;
    if(!idle){g0=el.scrollLeft;edge=g0<=1?-1:g0>=max()-1?1:0;raw=0;late=false}
    if(!running&&!idle)x=goal=el.scrollLeft;
    const t=goal+d,m=max();
    // A sweep that reaches an end mid-gesture (late) never turns or arms: only a push that starts at the end counts.
    if(!edge&&(t<0||t>m)){edge=t<0?-1:1;raw=0;late=true}
    if(t<0||t>m){raw+=t<0?t:t-m;ovTo=clamp(raw*RUBBER,-S.w*.08,S.w*.08)}
    goal=clamp(t,0,m);run(pad?26:10);
    clearTimeout(idle);
    idle=setTimeout(()=>{
      idle=0;const s=goal/pitch,f=s-Math.floor(s);
      if(edge&&!late&&Math.sign(raw)===edge&&Math.abs(raw)>=(gpad?160:40)&&push(edge))return;
      raw=0;ovTo=0;
      // A long trackpad sweep stops at the nearest piece; a notch or a short flick still lands on the next one in its direction.
      goal=clamp(pad&&Math.abs(goal-g0)>pitch*.6?Math.round(s+Math.sign(d)*.15):d>0?(f>.08?Math.ceil(s):Math.floor(s)):(f<.92?Math.floor(s):Math.ceil(s)),0,n-1)*pitch;run(pad?14:10);if(!running)rest()
    },pad?90:130);
  }

  el.addEventListener('scroll',sync,{passive:true});
  // A swipe on past the first or last piece turns the page; the native scroller has nowhere further to go there, so the gesture is unambiguous.
  el.addEventListener('touchstart',e=>{fingers=e.touches.length;const t=e.touches[0],sl=el.scrollLeft;touch0=fingers===1?{x:t.clientX,y:t.clientY,edge:sl<=1?-1:sl>=max()-1?1:0}:null},{passive:true});
  for(const t of ['touchend','touchcancel'])el.addEventListener(t,e=>{
    fingers=e.touches.length;sync();
    const a=touch0;touch0=null;if(!a?.edge||e.type!=='touchend')return;
    const c=e.changedTouches[0],dx=c.clientX-a.x,sl=el.scrollLeft;
    if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(c.clientY-a.y)*1.3&&-Math.sign(dx)===a.edge&&(a.edge>0?sl>=max()-1:sl<=1))push(a.edge);
  },{passive:true});
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){moved();halt();el.classList.remove('free');return}
    if(e.button)return;
    halt();drag={x0:e.clientX,s:el.scrollLeft,px:e.clientX,t:e.timeStamp,vx:0,on:false};
  });
  el.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(!drag.on){if(Math.abs(e.clientX-drag.x0)<6)return;drag.on=true;moved();el.classList.add('free','drag');el.setPointerCapture(e.pointerId)}
    const p=drag.s-(e.clientX-drag.x0),c=clamp(p,0,max());
    el.scrollLeft=x=c;ov=ovTo=(p-c)*RUBBER;setOver(ov);sync();
    const dt=e.timeStamp-drag.t;if(dt>0){drag.vx=lerp(drag.vx,-(e.clientX-drag.px)/dt*1000,.5);drag.px=e.clientX;drag.t=e.timeStamp}
  });
  const up=e=>{
    if(!drag)return;const d=drag;drag=null;if(!d.on)return;
    el.classList.remove('drag');
    if(Math.abs(ov)>48&&push(Math.sign(ov)))return;
    ovTo=0;
    const fl=room.fling??.16;x=el.scrollLeft;const v=e.timeStamp-d.t>90?0:clamp(d.vx,-4000,4000);
    goal=clamp(Math.round((x+v*fl)/pitch),0,n-1)*pitch;run(clamp(1/fl,3,10));
  };
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('focusin',e=>{const s=btns.indexOf(e.target);if(s>=0&&!S.pieceClosing&&s!==Math.round(el.scrollLeft/pitch))goTo(s)});
  pv.addEventListener('click',()=>{if(at===0&&prev)location.hash=prev[0];else step(-1)});
  nx.addEventListener('click',()=>{if(at===n-1&&next)location.hash=next[0];else step(1)});
  addEventListener('resize',fit);

  fit();mark();
  return {
    el,wheel,step,
    stop:()=>at,
    stopOfPiece:i=>stops.findIndex((_,s)=>room.piece?.(s)===i),
    pOf:s=>stops[clamp(s,0,n-1)],
    enter(s=at){at=clamp(s,0,n-1);el.classList.add('on');chip.classList.add('on');S.moverEl=el;S.moverStep=step;S.moverGo=s=>{moved();goTo(s)};halt();fit();S.tp=stops[at];bar.style.setProperty('--at',n>1?at/(n-1):1);mark()},
    leave(){arm.clear();el.classList.remove('on');chip.classList.remove('on');halt();clearTimeout(idle);idle=0;raw=ov=ovTo=0;S.over=0;if(S.moverEl===el)S.moverEl=null},
    piece:()=>room.piece?.(at)??-1,
  };
}
