import {S,$,G,CT,HH,BLACK,clamp,lerp,sss,mix,vis,money,add,hex,css,lum} from '../core.js';
const {q,N,deep}=S,g0=G[0],prices=G.map(g=>g.price);
const stage=$('stage'),ground=$('ground');
document.title='soescloset';
const note=add(`<p class="note" id="nHero"><strong>Compare clothes side by side.</strong><span>${N} hoodies from ${new Set(G.map(g=>g.brand)).size} labels, ${money(Math.min(...prices))} to ${money(Math.max(...prices))}.</span></p>`);
const enterIn=add(`<a id="heroIn" class="btn" href="#/closet">Start<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M0 5h15M11 1l4 4-4 4"/></svg></a>`);
// The way on for anyone who does not see Start: it pulses, and nudges once if nothing has happened for a while.
const cue=add(`<a id="heroCue" href="#/closet" aria-label="Scroll to the next room, the Closet">Scroll<i></i></a>`);
const key=add(`<button id="dyeKey" type="button">Drag to paint it in</button>`);
const cap=add(`<p id="heroCap">${g0?`${g0.brand}<span class="long"> ${g0.short}${g0.col?', '+g0.col[0].toUpperCase()+g0.col.slice(1):''}</span>, ${money(g0.price)}`:''}</p>`);
const wms=[$('wmB'),$('wmF')],spans=wms.flatMap(w=>[...w.children]);
// If the opener is gone and its stand-in has a pale room, butter letters would vanish on it.
if(g0&&g0.ink===BLACK)[...wms,note].forEach(el=>el.style.setProperty('--accent',css(BLACK)));
let boot=deep?1:0,start=0,wmDone=false,hx=0,hy=0,hc=0,sy=1;

// ---- plaster and dye. One shader draws the garment while it is being painted; the real <img> takes over when it closes.
const FS=`#version 300 es
precision highp float;
uniform sampler2D T,M,O;uniform float close,L0,oRev,stain,K;uniform vec3 room;in vec2 v;out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float y(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  vec4 t=texture(T,v,-.5);
  if(t.a<.003){o=vec4(0);return;}
  vec3 c=t.rgb/t.a;vec4 s=texture(T,v,2.6);
  // Plaster is a cast: keep the folds, lose most of the knit. Light is normalised to this cloth, so a dark piece casts as white as a pale one.
  float ls=y(s.rgb/max(s.a,.01)),k=max(L0,.14),l=mix(ls,y(c),.55),sh=clamp(.78+(l-L0)/k*1.05,0.,1.);
  sh=mix(sh,sh*sh*(3.-2.*sh),.5);
  vec3 pl=mix(mix(room,vec3(.6,.57,.55),.6),vec3(.97,.955,.925),sh)+(h(gl_FragCoord.xy*K)-.5)*.018+(n(gl_FragCoord.xy*K*.3)-.5)*.012;
  // Dye runs into valleys and seams first and feathers along the cloth. With no paint nearby the sum can never reach the front.
  // The mask is warped so no stroke keeps the round shape of the brush.
  vec2 wv=v+(vec2(n(v*13.),n(v*13.+9.))-.5)*.04;
  float m=texture(M,wv).r,w1=textureLod(M,wv,2.5).r,w2=max(textureLod(M,v,5.5).r,textureLod(O,v,5.5).r),fine=n(v*150.)*.55+n(v*330.)*.45,low=n(v*9.),fold=1.-sh,det=clamp((y(c)-ls)/k,-.4,.4),wale=n(vec2(v.x*620.,v.y*210.));
  float e=m*1.3+(fold-.3)*.42+(fine-.5)*.12+(wale-.5)*.12+(low-.5)*.14-det*.35;
  // Dry brush: ahead of the wet edge pigment only catches the raised wales of the knit.
  float a=max(smoothstep(.6,.625,e),smoothstep(.62,.7,wale*.72+fine*.42)*smoothstep(.52,.6,e));
  // Closing spreads out of what is already dyed, and down the cloth, rather than appearing everywhere at once.
  float sw=close*1.9-.34-(1.-clamp(w2*2.6+w1,0.,1.))*.75-sh*.12+(fine-.5)*.05+(low-.5)*.2+(v.y-.5)*.26;
  // The missing O of the wordmark is dyed into the cast: it pours down from the hood, its edge caught by the knit.
  float ow=textureLod(O,v,1.1).r+(fine-.5)*.1+(wale-.5)*.08,oa=smoothstep(.4,.6,ow)*smoothstep(0.,.09,oRev*1.2-(v.y-.05)/.84-(low-.5)*.1);
  a=max(max(a,oa),smoothstep(0.,.05,sw));
  // A dye front leaves a dark tide line and a faint dusty wash, never a bright halo.
  float tide=max((smoothstep(.6,.64,e)-smoothstep(.64,.76,e))*(1.-close),smoothstep(0.,.02,sw)-smoothstep(.02,.12,sw));
  float st=max(smoothstep(.34,.6,e),smoothstep(-.2,0.,sw)*step(.001,close));
  o=vec4(mix(mix(pl,c,st*.16),c*(1.-max(tide*.2,oa*stain*.2)),a),1.)*t.a;
}`;
const VS=`#version 300 es
layout(location=0) in vec2 p;out vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0,1);}`;
const MS=320;
let gl=null,glc=null,mctx=null,U={},dirty=false,paint=false,close=0,closeRate=0,idleAt=0,fullUp=false,fullImg=null;
const stamps=[],cells=new Set();
let brush=null,last=null,hidden=false;

function makeBrush(){
  brush=document.createElement('canvas');brush.width=brush.height=128;
  const b=brush.getContext('2d'),r=b.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(255,0,0,1)');r.addColorStop(.55,'rgba(255,0,0,.72)');r.addColorStop(1,'rgba(255,0,0,0)');
  b.fillStyle=r;b.fillRect(0,0,128,128);
}
function initGL(){
  const c=document.createElement('canvas');c.className='dye';c.setAttribute('aria-hidden','true');
  gl=c.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false});
  if(!gl)return false;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  for(const n of ['T','M','O','close','L0','oRev','stain','room','K'])U[n]=gl.getUniformLocation(pr,n);
  gl.uniform1i(U.T,0);gl.uniform1i(U.M,1);gl.uniform1i(U.O,2);
  const d=hex(g0.dominant_hex).map(v=>v/255);gl.uniform1f(U.L0,d[0]*.299+d[1]*.587+d[2]*.114);gl.uniform3fv(U.room,g0.room.map(v=>v/255));
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  upload(g0.ct);
  const mc=document.createElement('canvas');mc.width=mc.height=MS;mctx=mc.getContext('2d',{willReadFrequently:true});mctx.fillRect(0,0,MS,MS);mctx.globalCompositeOperation='lighter';
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mc);gl.generateMipmap(gl.TEXTURE_2D);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
  drawO();
  makeBrush();
  c.addEventListener('webglcontextlost',()=>finish());
  g0.el.append(c);glc=c;
  sizeGL();
  g0.ct.style.opacity=0;
  paint=true;dirty=true;
  return true;
}
// The O sits exactly where the word's own glyph would, so the name reads whole on the cloth.
const OS=1024,oc=document.createElement('canvas');oc.width=oc.height=OS;
function drawO(){
  if(!gl)return;
  const sp=wms[1].children[6],m=new DOMMatrix(getComputedStyle(wms[1]).transform),fs=parseFloat(getComputedStyle(sp).fontSize),K=OS/hc,c=oc.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,OS,OS);c.fillStyle='#000';c.fillRect(0,0,OS,OS);c.fillStyle='#f00';
  c.setTransform(K,0,0,K*m.d,(m.e+sp.offsetLeft-hx+hc/2)*K,(m.f+sp.offsetTop*m.d-hy+hc*CT)*K);
  // .917em: the baseline inside a .94 line box of Six Caps (ascent 1.105, descent .211).
  c.font=fs+'px Six';c.fillText('O',0,.917*fs);
  gl.activeTexture(gl.TEXTURE2);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,oc);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  dirty=true;
}
function upload(img){
  gl.activeTexture(gl.TEXTURE0);
  if(!U.tex)U.tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,U.tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
}
// While the dye moves the shader draws at 1 CSS px per pixel (2.5x fewer pixels on a 2x screen); once still for 200 ms it draws once at full size, so the cloth at rest is unchanged.
let fullR=0,lowR=0,curR=0,lastDraw=0;
function setR(r){if(curR===r)return;curR=glc.width=glc.height=r;gl.viewport(0,0,r,r);gl.uniform1f(U.K,fullR/r)}
function sizeGL(){if(!glc)return;fullR=Math.round(Math.min(1600,hc*S.dpr));lowR=Math.round(Math.min(fullR,hc));setR(fullR);dirty=true}
function finish(){paint=false;close=1;stage.classList.add('noO');if(glc){g0.ct.style.opacity='';glc.remove();glc=null;gl=null}}

const stamp=(u,v,r,a)=>{const R=r*MS*2;mctx.globalAlpha=a;mctx.drawImage(brush,u*MS-R/2,v*MS-R/2,R,R);dirty=true};
// The tip marks now and the dye keeps soaking outward for a moment after the hand has gone.
function dab(u,v,now,fast){
  // A slow hand is wet and wide, a fast one thin and dry.
  stamp(u,v,lerp(.036,.02,fast),lerp(.85,.55,fast));
  stamps.push([now+130,u,v,.05,lerp(.34,.14,fast)],[now+360,u,v,.07,lerp(.22,.06,fast)]);
  const cx=clamp((u-.17)/.66)*15|0,cy=clamp((v-.06)/.8)*15|0;if(u>.17&&u<.83&&v>.06&&v<.86)cells.add(cy*16+cx);
}
function stroke(u,v,now,dry){
  if(last){const d=Math.hypot(u-last[0],v-last[1]),n=Math.ceil(d/.012);if(d>.3){last=null}else for(let i=1;i<=n;i++)dab(lerp(last[0],u,i/n),lerp(last[1],v,i/n),now,dry??clamp(d/.05))}
  if(!last)dab(u,v,now,dry??0);
  last=[u,v];
}
function pointer(x,y){
  if(!paint||boot<.3||q.hero>.1)return;
  const s=stage.getBoundingClientRect(),P=S.live[0];if(!P)return;
  const u=(x-s.left-(P.x-P.c/2))/P.c,v=(y-s.top-(P.y-P.c*CT))/P.c;
  if(u<0||u>1||v<0||v>1){last=null;return}
  if(auto){auto=false;last=null}
  idleAt=S.now+2600;stroke(u,v,S.now);
  key.style.setProperty('--p',clamp(cells.size/41));
  if(!closeRate&&cells.size>41)closeRate=1/2600;
}
stage.addEventListener('pointermove',e=>pointer(e.clientX,e.clientY));
stage.addEventListener('pointerdown',e=>{last=null;pointer(e.clientX,e.clientY)});
stage.addEventListener('pointerleave',()=>last=null);
// Once a finger starts panning the browser cancels pointer events, but touchmove keeps coming.
stage.addEventListener('touchmove',e=>pointer(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
stage.addEventListener('touchend',()=>last=null,{passive:true});
key.addEventListener('click',()=>{if(paint&&!closeRate)closeRate=1/2200});

// ---- never stuck: one scroll, swipe, arrow key or Space on Home goes on to the Closet (round 3: the main room).
const home=()=>S.room==='cover'&&!document.getElementById('pv')?.open;
let gone=0,lockTo=0,lastWheel=0,nudge=0,ty=null;
const go=()=>{if(!home()||performance.now()-gone<1500)return;gone=performance.now();S.hush?.(1200);location.hash='#/closet'};
const poke=()=>{clearTimeout(nudge);if(!cue.classList.contains('nudged'))nudge=setTimeout(()=>{if(home()){cue.classList.add('nudged')}},6000)};
poke();
// A trackpad flick keeps sending deltas for a second; they belong to this turn, not to the Walk rail. Loaded before rooms.js, so this listener runs first.
addEventListener('wheel',e=>{
  const t=performance.now();
  if(t<lockTo){if(t-lastWheel<220){lastWheel=t;lockTo=t+400;e.preventDefault();e.stopImmediatePropagation()}return}
  if(!home()||e.ctrlKey)return;
  lastWheel=t;poke();
  if(Math.abs(e.deltaY)+Math.abs(e.deltaX)<4)return;
  e.preventDefault();lockTo=t+1200;go();
},{passive:false});
addEventListener('keydown',e=>{
  poke();
  if(!home()||e.altKey||e.ctrlKey||e.metaKey||e.target.matches?.('input,select,textarea'))return;
  const k=e.key,on=!e.target.matches?.('button');
  if(k==='ArrowDown'||k==='ArrowRight'||k==='PageDown'||(k===' '&&on)){e.preventDefault();go()}
});
addEventListener('touchstart',e=>{poke();ty=home()?[e.touches[0].clientX,e.touches[0].clientY]:null},{passive:true});
addEventListener('touchend',e=>{
  if(!ty)return;const t=e.changedTouches[0],dx=t.clientX-ty[0],dy=t.clientY-ty[1];ty=null;
  if(dy<-40&&Math.abs(dy)>Math.abs(dx)*1.2)go();
},{passive:true});
addEventListener('pointermove',poke,{passive:true});

// ---- the paint plays by itself. A hand on the cloth takes over the brush.
// The wordmark rise, the slit opening and the paint-in play the same for everyone (Reduce Motion on or off): slides, fades and a slow colour flood.
let auto=true,autoT=0;
const AUTO=2600,PASS=6;
// A serpentine down the cloth, so the dye arrives the way a hand would bring it.
const autoAt=t=>{const k=t*PASS,p=Math.min(PASS-1,k|0),f=k-p,u=p%2?lerp(.78,.22,f):lerp(.22,.78,f);return [u+Math.sin(t*31)*.02,lerp(.1,.84,(p+f*.6)/PASS)]};
function autoPaint(now){
  if(!auto||!start)return;
  const t=(now-start-500)/AUTO;if(t<0)return;
  if(t>=1){auto=false;last=null;if(!closeRate)closeRate=1/2600;return}
  if(!autoT){autoT=1;last=null}
  const [u,v]=autoAt(t);stroke(u,v,now,.25);key.style.setProperty('--p',clamp(t));
}


function tick(now){
  autoPaint(now);
  while(stamps.length&&stamps[0][0]<=now){const s=stamps.shift();stamp(s[1],s[2],s[3],s[4])}
  if(idleAt&&now>idleAt&&!closeRate)closeRate=1/3400;
  if(closeRate)close=Math.min(1,close+S.dt*closeRate);
  // Scrolling away dyes it too, and for good: the walk needs the real piece. Back at the top the cloth keeps a wet O, so the name still reads.
  const away=q.hero>=.21;
  if(away)close=1;
  if(away!==hidden){hidden=away;glc.style.visibility=away?'hidden':'';g0.ct.style.opacity=away?'':0;if(!away)dirty=true}
  if(away)return;
  const eff=Math.max(close,clamp(q.hero*5)),oR=clamp((now-start-380)/1100),sta=close*(1-clamp(q.hero*7));
  if(eff!==U._c||oR!==U._r||sta!==U._s){U._c=eff;U._r=oR;U._s=sta;gl.uniform1f(U.close,sss(eff));gl.uniform1f(U.oRev,oR);gl.uniform1f(U.stain,sta);dirty=true}
  if(fullImg&&!fullUp){fullUp=true;upload(fullImg);dirty=true}
  if(!dirty){if(curR!==fullR&&now-lastDraw>200){setR(fullR);gl.drawArrays(gl.TRIANGLES,0,3)}return}
  dirty=false;setR(lowR);lastDraw=now;
  gl.activeTexture(gl.TEXTURE1);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,mctx.canvas);gl.generateMipmap(gl.TEXTURE_2D);
  gl.drawArrays(gl.TRIANGLES,0,3);
}

// A deep link lands past the opening; if it ever scrolls back, the O is a plain letter.
// A pale stand-in opener would dye an O nobody could see, so there the letter stays.
if(deep||!g0||lum(hex(g0.dominant_hex))>.3)stage.classList.add('noO');
if(!deep&&g0){
  // The slit is already on screen from CSS; the garment joins it as soon as it can decode.
  const ready=[g0.ct.decode?g0.ct.decode().catch(()=>{}):0,document.fonts.load('100px Six')];
  Promise.all(ready).then(()=>{
    measure();
    start=performance.now();
    try{if(!initGL())finish()}catch(e){console.error(e);finish()}
    S.smallIn.then(()=>{const im=new Image();im.src=g0.image;return im.decode().then(()=>fullImg=im)}).catch(()=>{}); // full size only once every small picture is in
  });
}

function heroPose(i){
  if(i===0)return {x:hx,y:hy,c:hc,o:1,l:0,r:1};
  const P=S.base(i,0);P.x+=S.w*.5;P.o=0;return P;
}
function measure(){
  const a=getComputedStyle(ground,'::after');
  hx=parseFloat(a.left);hy=parseFloat(a.top);hc=parseFloat(a.height)/HH;sy=new DOMMatrix(getComputedStyle(wms[1]).transform).d;
  sizeGL();drawO();
}
S.part('hero',{segs:[['hero',.9]],
  rooms:{cover:{at:()=>0,now:()=>0,pick:()=>S.hit()}},
  measure,
  pre(){S.dyeing=paint&&S.room==='cover';if(start&&boot<1)boot=clamp((S.now-start)/720);if(start)ground.classList.add('open');if(paint)tick(S.now);stage.classList.toggle('pre-walk',q.hero<.5)},
  pose(i,P){
    if(q.hero<1)P=mix(heroPose(i),P,sss(q.hero));
    // The opening: fast out of the slit, so the very first frames already read as a door opening on the whole piece.
    if(i===0&&boot<1){const e=1-(1-boot)**4,f=lerp(.006,.36,e);P={...P,l:.5-f,r:.5+f,c:P.c*(1+(1-e)*.05),o:start?1:0}}
    return P;
  },
  draw(){
    // The word leaves whole: each letter travels up and out in one piece, from the O outward, so no frame holds a stump.
    if(q.hero<1||!wmDone){spans.forEach((sp,n)=>{const t=sss(clamp(q.hero*2.4-Math.abs(n%10-6)*.07));sp.style.transform=`translate3d(0,${(-t*S.h*1.2/sy).toFixed(1)}px,0)`});wmDone=q.hero>=1}
    wms.forEach(el=>vis(el,q.hero<.7?1:0));
    const n=clamp((boot-.65)*3)*(1-clamp(q.hero*25));
    vis(note,n);vis(enterIn,n);vis(cue,n);vis(key,paint&&!closeRate?n:0);vis(cap,paint&&!closeRate?0:n);
  },
});
