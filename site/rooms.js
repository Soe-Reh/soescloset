// Routes, room changes and the shared hoodie click. Loaded last, so every part has already said what its rooms are.
import {S,G,CT} from './core.js';
import {wheelPx} from './motion.js';
import {mover} from './mover.js';
import {show,hide,isOpen} from './parts/piece.js';

// Round 3: the Closet (the room still named 'index' inside, its section #index) is the main room, right after Home. #/index stays as an alias.
const ORDER=[['cover','hero','Home'],['index','index','Closet'],['walk','walk','Walk'],['wall','wall','Wall'],['price','compare','Price'],['splice','compare','Compare'],['hood','hood','Hood'],['average','mean','Average']];
const hashOf=n=>n==='cover'?'#/':n==='index'?'#/closet':'#/'+n,root=document.documentElement,stage=document.getElementById('stage'),say=document.getElementById('roomSay');
const secs=[...document.querySelectorAll('main>section')],navs=[...document.querySelectorAll('#nav a')],hair=document.getElementById('hair');
const movers={},tails={},idOf=id=>G.findIndex(g=>g.id===id);
history.scrollRestoration='manual'; // the index restores its own place; the browser would restore it before we can read it
let ixY=0,fromRoom=false,origin=null,lastEl=null;

// A room's neighbours as [hash, label]: the last room hands on to the Closet, the hub; the first rail room backs into it.
S.nbr=name=>{const at=ORDER.findIndex(o=>o[0]===name),nx=ORDER[at+1]||ORDER[1],pv=at>1?ORDER[at-1]:null;return [pv&&[hashOf(pv[0]),pv[2]],nx&&[hashOf(nx[0]),nx[2]]]};
const moverFor=name=>{
  const r=S.rooms[name];if(!r?.stops)return null;
  if(!movers[name]){
    const [pv,nx]=S.nbr(name);
    r.settled=s=>{const g=G[r.piece?.(s)],t=g?g.id:null;if(t!==(tails[name]||null)||!location.hash.endsWith(t))setTail(t)};
    movers[name]=mover(name,r,nx,pv);
  }
  return movers[name];
};
function setTail(t){
  const name=S.room;tails[name]=t;
  if(!isOpen())history.replaceState(null,'',roomHash(name));
}
S.setTail=setTail;
const roomHash=n=>hashOf(n)+(tails[n]?(n==='cover'?'':'/')+tails[n]:'');
const parse=()=>{const [n,...a]=location.hash.replace(/^#\/?/,'').split('/');return [n==='closet'?'index':n||'cover',a.join('/')]};

// Where a room lands: its own URL tail, then the garment carried from the last room, then its last place.
function stopFor(name,arg,carry){
  const m=moverFor(name),byId=arg?m.stopOfPiece(idOf(arg)):-1;
  if(byId>=0)return byId;
  const c=carry>=0?m.stopOfPiece(carry):-1;
  return c>=0?c:undefined;
}
const pieceNow=()=>movers[S.room]&&S.rooms[S.room]?.stops?movers[S.room].piece():S.rooms[S.room]?.now?.()??-1;

function arrive(name,arg,carry,playing){
  const from=S.room,r=S.rooms[name];
  if(from==='index'){ixY=scrollY;scrollTo(0,0)}
  if(from&&movers[from])movers[from].leave();
  S.room=name;tails[name]=arg||tails[name]||'';
  root.classList.toggle('ix',name==='index');
  const sec=ORDER.find(o=>o[0]===name);
  for(const s of secs)s.hidden=s.id!==sec[1];
  document.title=name==='cover'?'soescloset':`soescloset, ${sec[2]}`;
  say.textContent=sec[2];
  mark(name);
  for(const k in S.rooms)S.rooms[k].bar?.chip.classList.toggle('on',k===name);
  r?.bar?.set();
  S.bgNow?.();
  for(const g of G)g.hi=false; // full-size pictures are let go on every room change; the new room asks again for what it shows big (Hood alone held all 17, ~170 MB)
  if(name==='index'){S.measure();scrollTo(0,ixY);return}
  if(!playing){
    const m=moverFor(name);
    if(m)m.enter(stopFor(name,arg,carry));else S.tp=r.at();
    S.jump=true;
  }
  if(arg)r.arg?.(arg);
}
// The hairline travels to the current word; on the cover there is no word to underline.
function mark(name){
  const cur=navs.find(a=>a.getAttribute('href')===hashOf(name)),cb=document.getElementById('chrome').getBoundingClientRect();
  navs.forEach(a=>a===cur?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  navNow.textContent=cur?cur.textContent.trim():'Menu';
  if(!cur){hair.style.transform=`translate3d(${hair._x||0}px,${hair._y||0}px,0) scaleX(0)`;return}
  const b=cur.firstElementChild.getBoundingClientRect();hair._x=b.left-cb.left;hair._y=Math.round(b.bottom-cb.top+1);
  hair.style.transform=`translate3d(${hair._x}px,${hair._y}px,0) scaleX(${b.width})`;
}
addEventListener('resize',()=>mark(S.room));document.fonts.ready.then(()=>S.room&&mark(S.room));

// The phone's room list.
const navNow=document.getElementById('navNow'),navBtn=document.getElementById('navBtn'),navEl=document.getElementById('nav');
const menu=on=>{navEl.classList.toggle('open',on);navBtn.setAttribute('aria-expanded',on)};
navBtn.addEventListener('click',()=>menu(!navEl.classList.contains('open')));
navEl.addEventListener('click',()=>menu(false));

// Every room change is the page turn: the new room slides up whole over the old one, which recedes (down over it when going back).
// The old picture is a still, and the new room is drawn settled (S.jump) inside the callback, so no frame of it is caught mid-move.
const rank=n=>ORDER.findIndex(o=>o[0]===n);
function transit(name,arg){
  const from=S.room,carry=pieceNow();
  if(!document.startViewTransition){
    arrive(name,arg,carry);S.draw(performance.now());
    stage.classList.remove('stage-in');void stage.offsetWidth;stage.classList.add('stage-in');
    return;
  }
  if(rank(name)<rank(from))root.dataset.turn='back';else delete root.dataset.turn;
  const vt=document.startViewTransition(()=>{arrive(name,arg,carry);S.draw(performance.now())});
  vt.ready.catch(()=>{});vt.updateCallbackDone.catch(()=>{});vt.finished.catch(()=>{}).finally(()=>{if(!document.activeViewTransition||document.activeViewTransition===vt)delete root.dataset.turn});
}

function route(){
  if(window.OLD[location.hash]){location.replace(window.OLD[location.hash]);return}
  if(/^#\/index(\/|$)/.test(location.hash))history.replaceState(null,'',location.hash.replace('#/index','#/closet'));
  const [name,arg]=parse();
  if(name==='piece'){
    const i=idOf(arg);
    if(i<0){location.replace('#/walk');return}
    if(!isOpen())fromRoom=!!S.room;
    if(!S.room)arrive(S.rooms.walk?'walk':'cover',S.rooms.walk?arg:'',-1);
    show(G[i],origin);origin=null;
    // The rail follows behind the sheet, so closing lands on the piece last looked at.
    const m=movers[S.room],s=m?m.stopOfPiece(i):-1;
    if(s>=0&&s!==m.stop()){m.enter(s);tails[S.room]=G[i].id;S.jump=true;S.draw(performance.now())}
    return;
  }
  const known=name==='index'||S.rooms[name];
  if(!known){if(name!=='cover')location.replace('#/');else if(!S.room)S.room='cover';return}
  const closing=isOpen();
  if(closing)hide();
  // Back out of a piece view is the same place, whatever the older URL's tail still says.
  if(closing&&name===S.room){history.replaceState(null,'',roomHash(name));return}
  if(!S.room)arrive(name,arg,-1);
  else if(name!==S.room)transit(name,arg);
  else{
    // A nav link to the room you are in keeps your place, and puts the tail back.
    if(arg)S.rooms[name].arg?.(arg);
    const m=movers[name];if(m&&arg){const s=m.stopOfPiece(idOf(arg));if(s>=0&&s!==m.stop())m.enter(s)}
    if(!arg&&tails[name])history.replaceState(null,'',roomHash(name));
  }
}
addEventListener('hashchange',route);

// ---- the piece view's way in and out
// The garment's own canvas rect and clip, read off the stage, so the view grows from exactly what was on screen.
S.originOf=(g,el=lastEl)=>{
  const P=S.room!=='index'?S.live[G.indexOf(g)]:null;
  if(P&&P.o>.3)return {x:P.x-P.c/2,y:P.y-P.c*CT,c:P.c,l:P.l,r:P.r};
  const im=el?.querySelector('img'),t=im?.offsetWidth?im:el;
  if(!t)return null;
  const b=t.getBoundingClientRect();if(!b.width)return null;
  const c=Math.max(b.width,b.height);return {x:b.left+b.width/2-c/2,y:b.top+b.height/2-c/2,c,l:0,r:1};
};
S.openPiece=(g,el)=>{lastEl=el||null;origin=S.originOf(g,el);location.hash='#/piece/'+g.id};
S.closePiece=()=>{
  // Opened in this session: one Back. A deep link has nowhere to go back to, so it lands on its room instead of leaving the site.
  if(fromRoom){fromRoom=false;history.back()}else location.replace(roomHash(S.room));
};
S.stepPiece=(id)=>location.replace('#/piece/'+id);

// A press that travelled or lingered was a gesture: a drag, a Wall pull, a Splice wipe.
let down=null;
stage.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:e.timeStamp}},true);
stage.addEventListener('click',e=>{
  if(!down||e.target.closest('[data-piece],a,input,.pick,.pos,#wallSort,#dyeKey'))return;
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>8||e.timeStamp-down.t>400)return;
  const i=S.rooms[S.room]?.pick?.();
  if(i>=0)S.openPiece(G[i]);
});
document.addEventListener('click',e=>{
  const el=e.target.closest?.('[data-piece]');if(!el||e.defaultPrevented)return;
  e.preventDefault();const i=idOf(el.dataset.piece);if(i>=0)S.openPiece(G[i],el);
});

// Keys and wheel reach the room from anywhere on the page, without having to find a control first.
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&navEl.classList.contains('open')){menu(false);navBtn.focus();return}
  if(isOpen()||e.altKey||e.ctrlKey||e.metaKey||e.target.matches?.('input,select,textarea'))return;
  const m=movers[S.room],b=S.rooms[S.room]?.bar;
  if(!m&&b?.n&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();b.go(e.key==='ArrowRight'?1:-1,false);return}
  if(!m||!m.el.classList.contains('on'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();m.step(e.key==='ArrowRight'?1:-1)}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();m.step(e.key==='Home'?-99:99)}
  else if(e.key==='PageDown'||e.key==='PageUp'){e.preventDefault();m.step(e.key==='PageDown'?4:-4)}
  else if(e.key===' '&&e.target===document.body){e.preventDefault();m.step(e.shiftKey?-1:1)}
  else if(e.key==='Enter'&&(e.target===document.body)){const i=m.piece();if(i>=0&&i!==null)S.openPiece(G[i])}
});
// After a page turn the rest of a trackpad flick belongs to the turn, not to the new room: hushed until the stream pauses for 220 ms.
let hush=0,lastW=0;
S.hush=ms=>{hush=performance.now()+ms};
addEventListener('wheel',e=>{
  const t=performance.now();
  if(t<hush&&!e.ctrlKey){if(t-lastW<220)hush=Math.max(hush,t+220);lastW=t;e.preventDefault();e.stopImmediatePropagation()}
  lastW=t;
},{capture:true,passive:false});
addEventListener('wheel',e=>{
  if(e.ctrlKey||isOpen())return; // ctrl-wheel is pinch zoom, and is the user's
  const m=movers[S.room];
  if(!m&&(S.room==='wall'||S.room==='splice')&&!e.target.closest?.('.pick')){e.preventDefault();stillTurn(e);return}
  if(!m||!m.el.classList.contains('on'))return;
  e.preventDefault();
  const [dx,dy]=wheelPx(e,S.w);
  m.wheel(Math.abs(dx)>Math.abs(dy)?dx:dy);
},{passive:false});

// Wall and Compare have no rail, so every scroll there is a push past the end: the bar arms on the first gesture and turns on the second.
// A gesture is one unbroken wheel stream; it counts once, however long it runs, so a single flick can never arm and turn.
let pull=0,pullT=0,fired=false;
function stillTurn(e){
  const t=performance.now(),[dx,dy]=wheelPx(e,S.w),d=Math.abs(dx)>Math.abs(dy)?dx:dy;
  if(!d)return;
  if(t-pullT>220||Math.sign(d)!==Math.sign(pull)){pull=0;fired=false} // a pause or a change of direction starts a new gesture
  pullT=t;pull+=d;
  if(fired||Math.abs(pull)<(Math.abs(d)<40?160:40))return; // trackpad stream vs mouse notch, the mover's thresholds
  fired=true;S.rooms[S.room]?.bar?.push(Math.sign(pull));
}

route();
S.ready=true;
