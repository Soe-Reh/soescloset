// Round 3: the alive background. Faint contour lines on the resting stage that drift slowly, rise into a hill under the pointer (or a finger)
// and ripple from a press. In a flooded room they take the room's colour, mixed toward its AA-checked ink. One WebGL2 quad at half resolution,
// at the screen's own frame rate so the drift never steps; it stops drawing while the tab is hidden or a piece view covers it.
// Slow drift is motion-safe, so it moves the same for everyone. Without WebGL2 a static SVG of contours stands in.
import {S,hex} from './core.js';
const stage=document.getElementById('stage'),ground=document.getElementById('ground'),ix=document.getElementById('index'),pv=document.getElementById('pv');
const cv=document.createElement('canvas');cv.id='topo';cv.setAttribute('aria-hidden','true');
ground.after(cv);
const gl=cv.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});

const FS=`#version 300 es
precision highp float;
uniform vec2 res;uniform float t,scale,hillA,ripT;uniform vec2 hill,rip;uniform vec3 col;uniform float alpha;out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 px=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)*scale; // CSS px, top-left origin like the pointer
  vec2 p=px/420.;
  // Two layers drifting different ways, so the land slowly reshapes as well as moves: about a minute for a feature to cross its own width.
  float e=n(p+vec2(t*.011,t*.007))*.62+n(p*2.1-vec2(t*.009,-t*.013)+4.7)*.28+n(p*4.3+vec2(-t*.02,t*.015)+9.1)*.10;
  // The pointer raises a hill; a press sends one ripple out from where it landed.
  vec2 d=px-hill;e+=hillA*.34*exp(-dot(d,d)/(190.*190.));
  if(ripT<2.5){float r=length(px-rip),front=ripT*520.;e+=.05*sin((r-front)/26.)*exp(-ripT*1.4)*(1.-smoothstep(front-160.,front,r))*smoothstep(front-420.,front-160.,r);}
  float v=e*14.,w=fwidth(v),f=abs(fract(v)-.5),line=1.-smoothstep(w*.2,w*.85,.5-f);
  // Every fifth line a little stronger, as on a survey map.
  float major=mod(floor(v+.5),5.)<.5?1.5:1.;
  float a=line*alpha*major;o=vec4(col*a,a);
}`;
const VS=`#version 300 es
layout(location=0) in vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

const RES=.5;
let U={},clock=0,last=0,spd=1,hx=-9999,hy=-9999,tx=-9999,ty=-9999,ha=0,hat=0,rx=0,ry=0,rt=9,key='';
let col=[17,17,17],colT=[17,17,17],alpha=.07,alphaT=.07;
S.bgCost=[]; // ms of main-thread work per drawn frame, for the perf script

function fallback(){
  // Static contours: closed wavy rings around two centres, drawn once.
  const W=1600,H=1000,ring=(cx,cy,R,k)=>{let d='';for(let s=0;s<=96;s++){const a=s/96*Math.PI*2,r=R*(1+.09*Math.sin(3*a+k)+.05*Math.sin(5*a-k*1.7));d+=(s?'L':'M')+(cx+Math.cos(a)*r).toFixed(1)+' '+(cy+Math.sin(a)*r*.7).toFixed(1)}return d+'Z'};
  let paths='';for(let k=1;k<16;k++)paths+=`<path d="${ring(380,260,k*60,k*.4)}"/><path d="${ring(1300,820,k*48,k*.7+2)}"/>`;
  cv.replaceWith(Object.assign(document.createElement('div'),{id:'topo',innerHTML:`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#111" stroke-opacity=".07" stroke-width="1.2">${paths}</svg>`}));
}

function setup(){
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  for(const u of ['res','t','scale','hillA','ripT','hill','rip','col','alpha'])U[u]=gl.getUniformLocation(pr,u);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
}
// The canvas box is read only when something could have moved it, never per frame (a read after core's writes would force a layout).
let box=null;const stale=()=>{box=null};addEventListener('resize',stale);addEventListener('scroll',stale,{passive:true});
function size(){
  if(box)return box;
  const r=box=cv.getBoundingClientRect(),k=Math.max(.67,RES*Math.min(devicePixelRatio||1,2)),w=Math.max(1,Math.round(r.width*k)),h=Math.max(1,Math.round(r.height*k));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;gl.viewport(0,0,w,h)}
  gl.uniform2f(U.res,w,h);gl.uniform1f(U.scale,r.width/w);
  return r;
}
// Room colour and ink: the Closet floods its own section, the stage rooms flood S.gr. Lines are the ground pulled most of the way to the ink.
const rgb=s=>(s.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
function target(){
  let g,i;
  if(S.room==='index'){g=ix.style.backgroundColor?rgb(ix.style.backgroundColor):hex('#e1e1df');i=ix.style.color?rgb(ix.style.color):hex('#111111')}
  else{g=S.gr;i=S.ink}
  const flooded=Math.abs(g[0]-225)+Math.abs(g[1]-225)+Math.abs(g[2]-223)>12;
  // Lines are always the ground darkened, never pulled toward the ink: ink flips dark/light mid-fade, and lines following it flashed.
  const L=(.2126*g[0]+.7152*g[1]+.0722*g[2])/255;
  colT=g.map(v=>v*.2);alphaT=flooded?.09+.1*(1-L):.07;S.bgCol=col;
}
// One canvas serves every room: it lives in the stage, and moves into the Closet's section while that room is up.
function place(){
  const home=S.room==='index'?ix:stage;
  if(cv.parentNode!==home){if(home===ix)ix.prepend(cv);else ground.after(cv);box=null}
}
// After 4 s with no input, or while the Home dye paints (it already loads the GPU), the drift eases to a stop over about a second and the loop
// parks (no frames, so an idle page costs nothing); the next input eases it back up. Never a hard freeze or jump.
let input=performance.now(),parked=false;
const poke=()=>{input=performance.now();if(parked){parked=false;last=0;requestAnimationFrame(frame)}};
function frame(now){
  if(document.hidden||pv?.open||!S.ready){last=0;requestAnimationFrame(frame);return}
  const dt=last?Math.min(50,now-last):16.7,s=dt/1000;last=now;
  const want=now-input>4000||S.dyeing&&S.room==='cover'?0:1;spd+=(want-spd)*(1-Math.exp(-3*s));
  if(want===0&&spd<.004&&ha<.004){spd=0;parked=!S.dyeing;if(parked)return}
  requestAnimationFrame(frame);
  if(spd===0)return;
  const t0=performance.now();
  place();target();
  const ease=1-Math.exp(-6*s);
  clock+=s*spd;col=col.map((v,k)=>v+(colT[k]-v)*ease);alpha+=(alphaT-alpha)*ease;
  if(hx<-9000){hx=tx;hy=ty}hx+=(tx-hx)*(1-Math.exp(-5*s));hy+=(ty-hy)*(1-Math.exp(-5*s));
  ha+=(hat*want-ha)*(1-Math.exp(-3*s));rt+=s;
  draw(clock);
  S.bgCost.push(performance.now()-t0);if(S.bgCost.length>600)S.bgCost.shift();
}
// Called by rooms.js inside the room change, so the new room's snapshot already has its lines (no blank page turn into the Closet).
S.bgNow=()=>{if(!U.res||gl.isContextLost())return;place();target();col=colT;alpha=alphaT;draw(clock);poke()};
function draw(t){
  const r=size();
  gl.uniform1f(U.t,t);gl.uniform2f(U.hill,hx-r.left,hy-r.top);gl.uniform1f(U.hillA,ha);
  gl.uniform2f(U.rip,rx-r.left,ry-r.top);gl.uniform1f(U.ripT,rt);
  gl.uniform3f(U.col,col[0]/255,col[1]/255,col[2]/255);gl.uniform1f(U.alpha,alpha);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
}

if(!gl)fallback();
else try{
  setup();
  {
    addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY;hat=1},{passive:true});
    addEventListener('pointerdown',e=>{tx=e.clientX;ty=e.clientY;hat=1;rx=e.clientX;ry=e.clientY;rt=0},{passive:true});
    addEventListener('pointerup',e=>{if(e.pointerType==='touch')hat=0},{passive:true});
    document.addEventListener('pointerout',e=>{if(!e.relatedTarget)hat=0});
  }
  // A lost context comes back by itself; until then nothing is drawn.
  cv.addEventListener('webglcontextlost',e=>e.preventDefault());
  cv.addEventListener('webglcontextrestored',()=>{setup();key='';box=null;poke()});
  for(const t of ['pointermove','pointerdown','touchstart','wheel','keydown','hashchange'])addEventListener(t,poke,{passive:true});
  requestAnimationFrame(frame);
}catch(e){console.error('bg',e);fallback()}
