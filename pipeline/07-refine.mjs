// Turn raw + model matte into the one collection style. Order: hand retouch and matte at source resolution,
// scale onto the shared canvas between hood and hem rails, crisp fixed-width alpha ramp, then one shared grade (grade.mjs).
import fs from 'node:fs'; import sharp from 'sharp';
import {gauss,flood,border,dist,median,nearestFrom,polyMask,measure,dominantHex,peelMask,findGaps,tracePath,renderPath} from './lib-matte.mjs';
import {grade,lab8,linrgb} from './grade.mjs';
const srgbEnc=v=>{v=Math.max(0,Math.min(1,v));return v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055};
import RETOUCH from './retouch.mjs';
const CANVAS=1600, TOP=100, HEM=1345; // two rails: hood tops at TOP, hems at HEM. Width stays each cut's own; equal-mass scaling made hems jump 165px between rows.
const MAXBOT=1525, MAXW=1440;
const RAMP=2.2;                   // alpha ramp width on the master, px
const PATH={fine:1.1,coarse:5.5,cornerLo:0.9,cornerHi:2.6,inset:0.1}; // clipping path, master px
const items=JSON.parse(fs.readFileSync('items.json'));
const only=process.argv.slice(2);
const live=new Set(items.map(i=>i.id));
const prev=fs.existsSync('measures.json')?JSON.parse(fs.readFileSync('measures.json')):{};
for(const k of Object.keys(prev)) if(!live.has(k)) delete prev[k];
fs.mkdirSync('../site/img',{recursive:true});
const lum=(r,g,b)=>0.2126*r+0.7152*g+0.0722*b;
// the site reads these files while this runs: a reader only ever sees a whole image
const put=async(pipe,name)=>{const t=`.put-${process.pid}.webp`;await pipe.toFile(t);fs.renameSync(t,`../site/img/${name}`)};
const clamp01=v=>v<0?0:v>1?1:v;

for(const it of items){
  if(only.length&&!only.includes(it.id)) continue;
  const cfg=RETOUCH[it.id]??{};
  const {data:rgb0,info}=await sharp(it.raw).flatten({background:'#f5f5f5'}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,ch=info.channels,N=w*h;
  const am=await sharp(`../assets/masks/${it.id}.png`).extractChannel(3).resize(w,h,{fit:'fill'}).raw().toBuffer();
  const A=new Float32Array(N); for(let i=0;i<N;i++)A[i]=am[i];

  // backdrop colour from clearly-outside pixels
  const br=[],bg=[],bb=[]; for(let i=0;i<N;i+=7) if(A[i]<4){br.push(rgb0[i*ch]);bg.push(rgb0[i*ch+1]);bb.push(rgb0[i*ch+2])}
  const B=[median(br),median(bg),median(bb)], bL=lum(...B);

  // biggest solid thing only (drops stray props and flecks)
  const solid=new Uint8Array(N); for(let i=0;i<N;i++)solid[i]=A[i]>128?1:0;
  let best=null,bestN=0; const vis=new Uint8Array(N);
  for(let i=0;i<N;i++) if(solid[i]&&!vis[i]){const c=flood(w,h,[i],j=>solid[j]===1);let n=0;for(let j=0;j<N;j++)if(c[j]){vis[j]=1;n++} if(n>bestN){bestN=n;best=c} if(bestN>N/8)break}
  const reach=flood(w,h,[...best.keys()].filter(i=>best[i]),j=>A[j]>20);
  for(let i=0;i<N;i++) if(!reach[i])A[i]=0;

  // matte holes stay open only when they show backdrop; otherwise fill (dark hood interior etc.)
  const out0=flood(w,h,border(w,h),j=>A[j]<128);
  const hole=new Uint8Array(N); for(let i=0;i<N;i++) if(A[i]<128&&!out0[i])hole[i]=1;
  for(let i=0;i<N;i++) if(hole[i]===1){const c=flood(w,h,[i],j=>hole[j]===1);let n=0,e=0;for(let j=0;j<N;j++)if(c[j]){hole[j]=2;n++;e+=Math.abs(rgb0[j*ch]-B[0])+Math.abs(rgb0[j*ch+1]-B[1])+Math.abs(rgb0[j*ch+2]-B[2])}
    if(e/n>24)for(let j=0;j<N;j++)if(c[j])A[j]=255}

  // cast shadows on saturated garments: grey pixels reachable from outside are never fabric
  const inner=[]; for(let i=0;i<N;i+=11) if(A[i]>240) inner.push(Math.max(rgb0[i*ch],rgb0[i*ch+1],rgb0[i*ch+2])-Math.min(rgb0[i*ch],rgb0[i*ch+1],rgb0[i*ch+2]));
  const gC=median(inner);
  if(gC>40){
    const lim=Math.max(14,gC*0.3);
    const s=flood(w,h,border(w,h),j=>{const r=rgb0[j*ch],g=rgb0[j*ch+1],b=rgb0[j*ch+2];return A[j]<4||(Math.max(r,g,b)-Math.min(r,g,b)<lim&&lum(r,g,b)<bL+6)});
    for(let i=0;i<N;i++) if(s[i]&&A[i]>0)A[i]=0;
  }

  // hand-drawn matte fixes, source pixels
  for(const p of cfg.cut??[]){const m=await polyMask(p,w,h);for(let i=0;i<N;i++)if(m[i]>127)A[i]=0}
  for(const p of cfg.keep??[]){const m=await polyMask(p,w,h);for(let i=0;i<N;i++)if(m[i]>127)A[i]=255}

  // fabric the model dropped (a rolled hem lip): inside the polygon, chroma says what is cloth
  for(const z of cfg.grow??[]){const m=await polyMask(z.poly,w,h);for(let i=0;i<N;i++)if(m[i]>127){const p=lab8(rgb0[i*ch],rgb0[i*ch+1],rgb0[i*ch+2]);if(Math.hypot(p[1],p[2])>(z.minC??0.018))A[i]=255}}

  // measure silhouette at source res to find the optical scale before any px-based filter
  const bin0=new Uint8Array(N); for(let i=0;i<N;i++)bin0[i]=A[i]>128?255:0;
  const m0=measure(bin0,w,h);
  let s=(HEM-TOP)/(m0.hem-m0.top); // provisional, the px-based filters below only need its order of magnitude; the placed scale is re-read from the final contour
  const cap=()=>Math.min((MAXBOT-TOP)/(m0.bot-m0.top+1),MAXW/(m0.wR-m0.wL+1));
  const capped=s>cap(); s=Math.min(s,cap());

  // guide = distance from backdrop, so hue contrast counts as much as luma; shadows weigh less on chromatic garments
  const wL=gC>40?0.2:1, guide=new Float32Array(N);
  for(let i=0;i<N;i++){const r=rgb0[i*ch]-B[0],g=rgb0[i*ch+1]-B[1],b=rgb0[i*ch+2]-B[2],l=0.2126*r+0.7152*g+0.0722*b;
    guide[i]=Math.sqrt(wL*l*l+(r-l)*(r-l)+(g-l)*(g-l)+(b-l)*(b-l))}
  const gIn=[];for(let i=0;i<N;i+=5)if(A[i]>250)gIn.push(guide[i]); const gMed=Math.max(8,median(gIn));
  for(let i=0;i<N;i++)guide[i]=Math.min(1.6,guide[i]/gMed);
  const dIn0=dist(w,h,j=>A[j]>=128), dOut0=dist(w,h,j=>A[j]<128);
  const res=(m0.bot-m0.top)/1000, band=Math.max(6,Math.round(5*res));
  const inBand=i=>dIn0[i]<=band&&dOut0[i]<=band;
  const q=new Float32Array(N), filled=[];
  {
    // edge-aware guided filter pulls the model's wobbly 1024px contour onto the photographed edge
    const r=Math.max(4,Math.round(4*res)), eps=(cfg.eps??0.012);
    const P=new Float32Array(N); for(let i=0;i<N;i++)P[i]=A[i]/255;
    const box=a=>gauss(a,w,h,r/1.6);
    const mI=box(guide), mP=box(P), II=new Float32Array(N), IP=new Float32Array(N);
    for(let i=0;i<N;i++){II[i]=guide[i]*guide[i];IP[i]=guide[i]*P[i]}
    const mII=box(II), mIP=box(IP), aa=new Float32Array(N), bb2=new Float32Array(N);
    for(let i=0;i<N;i++){const v=mII[i]-mI[i]*mI[i],c=mIP[i]-mI[i]*mP[i];aa[i]=c/(v+eps);bb2[i]=mP[i]-aa[i]*mI[i]}
    const ma=box(aa), mb=box(bb2);
    for(let i=0;i<N;i++) q[i]=dIn0[i]>band?1:dOut0[i]>band?0:clamp01(ma[i]*guide[i]+mb[i]);
    // crisp contour: threshold, smooth the path slightly so low-contrast stretches do not stair-step, threshold again
    const pull=cfg.pull??0.55;
    for(let i=0;i<N;i++) q[i]=clamp01((q[i]-pull)*6+0.5);
    const blurred=gauss(q,w,h,(cfg.path??1.6)/s);
    for(let i=0;i<N;i++) q[i]=clamp01((blurred[i]-0.5)*6+0.5);
    for(const z of cfg.smooth??[]){ // hand-marked stretches that need a stronger path clean-up
      const big=gauss(q,w,h,z.sigma), r2=z.r*z.r;
      for(let y=Math.max(0,z.y-z.r);y<Math.min(h,z.y+z.r);y++)for(let x=Math.max(0,z.x-z.r);x<Math.min(w,z.x+z.r);x++){
        const dd=(x-z.x)**2+(y-z.y)**2; if(dd>=r2)continue; const t=Math.min(1,(1-dd/r2)*3),i=y*w+x; q[i]=q[i]*(1-t)+clamp01((big[i]-0.5)*6+0.5)*t}
    }
  }

  // the model's matte hugs contact shadows and backdrop plugs: peel them from outside in, source pixels
  {const LL=new Float32Array(N),aa2=new Float32Array(N),bb3=new Float32Array(N);
   for(let i=0;i<N;i++){const p=lab8(rgb0[i*ch],rgb0[i*ch+1],rgb0[i*ch+2]);LL[i]=p[0];aa2[i]=p[1];bb3[i]=p[2]}
   const bin1=new Uint8Array(N);for(let i=0;i<N;i++)bin1[i]=q[i]>=0.5?255:0;
   // pale, low-chroma cloth reads as backdrop to the peel tests, so automatic peeling stays off there and hand polygons do the work
   const lf=[];for(let i=0;i<N;i+=11)if(A[i]>240)lf.push(LL[i]); const pale=gC<40&&lab8(B[0],B[1],B[2])[0]-median(lf)<0.33;
   const m1=measure(bin1,w,h), gaps=[...(cfg.noGaps||pale?[]:findGaps(q,w,h,m1.top,m1.bot,res)),...(cfg.gaps??[])];
   const {peeled,paint,refs}=peelMask({q,L:LL,a:aa2,b:bb3,w,h,Bl:lab8(B[0],B[1],B[2]),res,top:m1.top,bot:m1.bot,thin:Math.max(4,(cfg.thin??11)/s),wide:Math.round(70*res),gaps,shoulderY:m1.sy+(cfg.peelBelow??0),o:{band:false,...cfg.peel}});
   for(const pp of cfg.noPeel??[]){const m=await polyMask(pp,w,h);for(let i=0;i<N;i++)if(m[i]>127)peeled[i]=0}
   let cleared=0;for(let i=0;i<N;i++)if(peeled[i]&&q[i]>=0.5)cleared++;
   if(cleared){
     for(let i=0;i<N;i++)if(peeled[i])q[i]=0;
     // tracePath below closes the contour; re-closing here painted flat plugs over the real underarm wedges
   }
   const R2=2;for(const i of paint)for(let dy=-R2;dy<=R2;dy++)for(let dx=-R2;dx<=R2;dx++){const j=i+dy*w+dx;if(j<0||j>=N)continue;const c=linrgb(refs.rL[i],refs.rA[i],refs.rB[i]).map(v=>Math.round(255*srgbEnc(v)));for(let k=0;k<3;k++)rgb0[j*ch+k]=c[k]}
   for(const p of cfg.cutLate??[]){const m=await polyMask(p,w,h);for(let i=0;i<N;i++)if(m[i]>127)q[i]=0}
   console.log(it.id,'peeled',cleared,'painted',paint.length,'gaps',JSON.stringify(gaps.map(g=>[g.x,g.y])));
  }

  // pen-tool clipping path: one treatment for every contour in the set. Filled pinholes get repainted below with the rim.
  {const before=Uint8Array.from(q,v=>v>=0.5?1:0);
   // trim: walk the contour inward over a marked stretch, tapered at its ends, past residue that sits on the last rows of a rib
   for(const z of cfg.trim??[]){const m=await polyMask(z.poly,w,h,z.feather??30),dIn=dist(w,h,j=>q[j]>=0.5);for(let i=0;i<N;i++)if(m[i]&&q[i]>=0.5&&dIn[i]<z.px*m[i]/255)q[i]=0}
   const P=cfg.path2??{};
   const {loops,dropped}=tracePath(q,w,h,{fine:(P.fine??PATH.fine)/s,coarse:(P.coarse??PATH.coarse)/s,cornerLo:(P.cornerLo??PATH.cornerLo)/s,cornerHi:(P.cornerHi??PATH.cornerHi)/s,minLoop:400/(s*s),minHole:(cfg.minHole??600)/(s*s)});
   const r=await renderPath(loops,w,h); q.set(r);
   for(const z of cfg.cutPath??[]){const m=await polyMask(z,w,h,0.8/s);for(let i=0;i<N;i++)q[i]*=1-m[i]/255}
   // anything that was outside the old matte and is now inside must not keep backdrop colour
   for(let i=0;i<N;i++)if(q[i]>=0.5&&!before[i])filled.push(i);
   console.log(it.id,'path loops',loops.length,'holes',loops.filter(l=>l.hole).map(l=>Math.round(l.area*s*s)).join(','),'dropped',dropped,'newly filled',filled.length);
  }
  // colours near the edge come from safely-inside fabric, so no backdrop survives in the rim
  const wasFilled=new Uint8Array(N); {const R=Math.ceil(3/s);for(const i of filled)for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const j=i+dy*w+dx;if(j>=0&&j<N)wasFilled[j]=1}}
  const dI=dist(w,h,j=>q[j]>=0.5&&!wasFilled[j]);
  const rim=Math.max(3,(cfg.rim??3.2)/s);
  // rimFabric: the rim only borrows cloth colour, a print beside the edge must not bleed into it
  let fabRGB=null;if(cfg.rimFabric){const v=[[],[],[]];for(let i=0;i<N;i+=9)if(A[i]>250)for(let c=0;c<3;c++)v[c].push(rgb0[i*ch+c]);fabRGB=v.map(median)}
  const near=nearestFrom(w,h,i=>dI[i]>rim&&(!fabRGB||Math.abs(rgb0[i*ch]-fabRGB[0])+Math.abs(rgb0[i*ch+1]-fabRGB[1])+Math.abs(rgb0[i*ch+2]-fabRGB[2])<cfg.rimFabric),rim*3+Math.ceil(30/s));
  const sm=await sharp(rgb0,{raw:{width:w,height:h,channels:ch}}).blur(Math.max(0.6,0.8/s)).raw().toBuffer();
  const rgb=Buffer.alloc(N*4);
  const gains=[0,1,2].map(c=>Math.min(1.06,Math.max(0.94,bL/B[c])));
  for(let i=0;i<N;i++){
    const t=dI[i]>=rim*1.6?1:dI[i]<=rim?0:(dI[i]-rim)/(rim*0.6), src=near[i]<0?i:near[i];
    for(let c=0;c<3;c++){
      const v=rgb0[i*ch+c]*t+sm[src*ch+c]*(1-t);
      rgb[i*4+c]=Math.min(255,Math.round(v*gains[c]));
    }
    rgb[i*4+3]=Math.round(q[i]*255);
  }
  // hand-painted colour fixes, source pixels. heal: clone from an offset. tone: squeeze luma under a ceiling.
  for(const z of cfg.heal??[]){const m=await polyMask(z.poly,w,h,z.feather??6);
    const copy=Buffer.from(rgb); const dx=z.from[0],dy=z.from[1];
    for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){const t=m[i]/255;if(!t)continue;const sx=x+dx,sy=y+dy;if(sx<0||sy<0||sx>=w||sy>=h)continue;const j=sy*w+sx;for(let c=0;c<3;c++)rgb[i*4+c]=Math.round(rgb[i*4+c]*(1-t)+copy[j*4+c]*t)}}
  for(const z of cfg.tone??[]){const m=await polyMask(z.poly,w,h,z.feather??4);
    for(let i=0;i<N;i++){const t=m[i]/255;if(!t)continue;const l=lum(rgb[i*4],rgb[i*4+1],rgb[i*4+2]);const nl=Math.min(l,z.ceil+(l-z.ceil)*0.12)*(z.gain??1);const k=l>0?nl/l:1;for(let c=0;c<3;c++){const v=Math.min(255,rgb[i*4+c]*k), tinted=z.color?v*0.3+z.color[c]*(nl/lum(...z.color))*0.7:v;rgb[i*4+c]=Math.round(rgb[i*4+c]*(1-t)+Math.min(255,tinted)*t)}}}

  // neutral: pull a stain's chroma back to the fabric's, lightness stays
  for(const z of cfg.neutral??[]){const m=await polyMask(z.poly,w,h,z.feather??6);const sa=[],sb=[];for(let i=0;i<N;i+=9)if(A[i]>250){const p=lab8(rgb[i*4],rgb[i*4+1],rgb[i*4+2]);sa.push(p[1]);sb.push(p[2])}const fa=median(sa),fb=median(sb);
    for(let i=0;i<N;i++){const t=m[i]/255;if(!t)continue;const p=lab8(rgb[i*4],rgb[i*4+1],rgb[i*4+2]),c=linrgb(p[0]*(1-t)+t*Math.min(1,p[0]+(z.lift??0)),p[1]*(1-t)+fa*t,p[2]*(1-t)+fb*t);for(let k=0;k<3;k++)rgb[i*4+k]=Math.round(255*srgbEnc(c[k]))}}

  // place on the shared canvas: hood top at TOP, hood axis (shared with the shoulder midline) on centre
  const bin=new Uint8Array(N); for(let i=0;i<N;i++)bin[i]=q[i]>=0.5?255:0;
  const mq=measure(bin,w,h);
  if(!capped)s=(HEM-TOP)/(mq.hem-mq.top);
  let sx=0,sn=0; for(let y=mq.top;y<mq.top+(mq.bot-mq.top)*0.1;y++)for(let x=0;x<w;x++)if(bin[y*w+x]){sx+=x;sn++}
  const axis=0.5*(sx/sn)+0.5*(mq.left[mq.sy]+mq.right[mq.sy])/2;
  const x0=mq.wL,y0=mq.top,cw=mq.wR-mq.wL+1,gh=mq.bot-mq.top+1, nw=Math.round(cw*s), nh=Math.round(gh*s);
  const pad=Math.ceil(8/s), ex={left:Math.max(0,x0-pad),top:Math.max(0,y0-pad)};
  ex.width=Math.min(w-ex.left,cw+2*pad); ex.height=Math.min(h-ex.top,gh+2*pad);
  const resized=await sharp(rgb,{raw:{width:w,height:h,channels:4}}).extract(ex).resize(Math.round(ex.width*s),Math.round(ex.height*s),{kernel:'lanczos3'}).png().toBuffer();
  const leftPx=Math.round(CANVAS/2-(axis-ex.left)*s), topPx=Math.round(TOP-(y0-ex.top)*s);
  if(leftPx+(x0-ex.left)*s<8||leftPx+(x0-ex.left+cw)*s>CANVAS-8||TOP+nh>CANVAS-8) console.log('!! overflow',it.id,nw,nh,leftPx);
  const placed=await sharp({create:{width:CANVAS,height:CANVAS,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:resized,left:Math.max(0,leftPx),top:Math.max(0,topPx)}]).raw().toBuffer();
  // un-premultiplied colour at thin alpha is quantised junk and reads as a dark or dirty rim: the ramp takes its colour from the nearest fully opaque pixel
  {const nearP=nearestFrom(CANVAS,CANVAS,i=>placed[i*4+3]>=250,8);for(let i=0;i<CANVAS*CANVAS;i++)if(placed[i*4+3]<250&&nearP[i]>=0){const j=nearP[i];for(let c=0;c<3;c++)placed[i*4+c]=placed[j*4+c]}}
  // fix the ramp width in master pixels
  const blurA=new Float32Array(CANVAS*CANVAS); for(let i=0;i<blurA.length;i++)blurA[i]=placed[i*4+3]/255;
  {const ga=gauss(blurA,CANVAS,CANVAS,0.9), G=(0.9*2.5+1.1)/RAMP; // 0.9 blur + resample softness, normalised to RAMP
    for(let i=0;i<blurA.length;i++){const v=clamp01((ga[i]-0.5-PATH.inset)*G+0.5);blurA[i]=v<0.02?0:v>0.98?1:v}}

  // only what touches the garment survives
  {const body=flood(CANVAS,CANVAS,[(TOP+400)*CANVAS+CANVAS/2],i=>blurA[i]>0.02);for(let i=0;i<blurA.length;i++)if(!body[i])blurA[i]=0}

  // the shared grade
  const g=grade(placed,blurA,CANVAS,cfg.grade??{},s);
  // lossy WebP smears whatever colour sits under alpha 0 into the ramp, so fabric colour goes there, never black: this was the dirty dotted contour on pale garments
  {const near=nearestFrom(CANVAS,CANVAS,i=>g.rgba[i*4+3]>200,24);
   for(let i=0;i<CANVAS*CANVAS;i++)if(g.rgba[i*4+3]<=200&&near[i]>=0){const j=near[i];const a=g.rgba[i*4+3];if(a<8)for(let c=0;c<3;c++)g.rgba[i*4+c]=g.rgba[j*4+c]}}
  const canvas=await sharp(g.rgba,{raw:{width:CANVAS,height:CANVAS,channels:4}}).png().toBuffer();
  await put(sharp(canvas).webp({quality:97,alphaQuality:100,effort:5,smartSubsample:true,exact:true}),`${it.id}.webp`);
  await put(sharp(canvas).resize(600,600,{kernel:"lanczos3"}).webp({quality:90,alphaQuality:100,effort:5,exact:true}),`${it.id}-600.webp`);

  // measure from the final canvas
  const fin=g.rgba, al=new Uint8Array(CANVAS*CANVAS); for(let i=0;i<al.length;i++)al[i]=fin[i*4+3];
  const m=measure(al,CANVAS,CANVAS), H=m.bot-m.top+1;
  const rd=v=>Math.round(v*1000)/1000;
  // an even, shared soft shadow derived from this garment's alpha, kept as its own layer so the page can place it under the cutout
  {const a600=await sharp(`../site/img/${it.id}-600.webp`).extractChannel(3).raw().toBuffer();
   const f=Float32Array.from(a600,v=>v/255),soft=gauss(f,600,600,13),tight=gauss(f,600,600,3.2),sh=Buffer.alloc(600*600*4);
   for(let y=0;y<600;y++)for(let x=0;x<600;x++){const i=y*600+x,a1=y>=7?soft[i-7*600]:0,a2=y>=2?tight[i-2*600]:0,v=1-(1-a1*0.17)*(1-a2*0.13);sh[i*4]=34;sh[i*4+1]=28;sh[i*4+2]=20;sh[i*4+3]=Math.round(v*255)}
   await put(sharp(sh,{raw:{width:600,height:600,channels:4}}).webp({quality:70,alphaQuality:80,effort:5}),`${it.id}-shadow.webp`)}
  // hood reading from the final pixels: crown from the silhouette, mouth from how much of the hood's middle sits well under the fabric's own lightness
  const hoodH=m.sh-m.top, wAt=f=>{const y=m.top+Math.round(hoodH*f);return m.right[y]-m.left[y]+1};
  const lightOf=j=>lab8(fin[j*4],fin[j*4+1],fin[j*4+2])[0];
  const body=[];for(let y=m.sh+Math.round(H*.1);y<m.hem;y+=5)for(let x=m.left[m.sy]+40;x<m.right[m.sy]-40;x+=5)if(al[y*CANVAS+x]===255)body.push(lightOf(y*CANVAS+x));
  body.sort((a,b)=>a-b);const fabricL=body[body.length>>1];
  let mouth=0,mouthN=0;const hcx=(m.left[m.top+Math.round(hoodH*.5)]+m.right[m.top+Math.round(hoodH*.5)])>>1,hhw=wAt(.5)*.34;
  for(let y=m.top+Math.round(hoodH*.25);y<=m.sh+Math.round(hoodH*.2);y+=3)for(let x=hcx-hhw|0;x<hcx+hhw;x+=3){const j=y*CANVAS+x;if(al[j]===255){mouthN++;if(lightOf(j)<fabricL-0.09)mouth++}}
  prev[it.id]={hood_mouth_dark:rd(mouth/(mouthN||1)),hood_crown_ratio:rd(wAt(.06)/wAt(.3)),fabric_l:rd(fabricL),dominant_hex:dominantHex(await sharp(fin,{raw:{width:CANVAS,height:CANVAS,channels:4}}).blur(4).raw().toBuffer(),4,3,i=>fin[i+3]>250),source_hex:dominantHex(await sharp(placed,{raw:{width:CANVAS,height:CANVAS,channels:4}}).blur(4).raw().toBuffer(),4,3,i=>placed[i+3]>250),
    shoulder_width_ratio:rd((m.right[m.sy]-m.left[m.sy]+1)/H),body_length_ratio:rd((m.hem-m.sh)/H),hood_height_ratio:rd((m.sh-m.top)/H),sleeve_drop:rd((m.cuff-m.sy)/H),garment_height:H,fill_ratio:rd(al.reduce((n,v)=>n+v,0)/255/(CANVAS*CANVAS)),hem_y:m.hem,bottom_y:m.bot,hood_top_width_ratio:rd((m.right[m.top+Math.round(H*0.012)]-m.left[m.top+Math.round(H*0.012)]+1)/(m.right[m.sh]-m.left[m.sh]+1)),
    qa:{map:{ex_left:ex.left,ex_top:ex.top,leftPx,topPx},lines:{top:m.top,neck:m.sh,shoulder:m.sy,hem:m.hem,cuff:Math.round(m.cuff),l:m.left[m.sy],r:m.right[m.sy]},bg:B,gains:gains.map(rd),scale:rd(s),capped,gC,nw,grade:g.stats}};
  // another process may be refining other items: merge onto what is on disk, swap in whole
  {const cur=fs.existsSync('measures.json')?JSON.parse(fs.readFileSync('measures.json')):{};for(const k of Object.keys(cur))if(!live.has(k))delete cur[k];cur[it.id]=prev[it.id];const t=`measures.json.tmp${process.pid}`;fs.writeFileSync(t,JSON.stringify(cur,null,1));fs.renameSync(t,'measures.json')}
  console.log(it.id.padEnd(28),'s',s.toFixed(3),capped?'CAP':'   ','sw',m.right[m.sy]-m.left[m.sy]+1,'hem',m.hem,'bot',m.bot,'W',m.wR-m.wL+1,prev[it.id].dominant_hex,JSON.stringify(g.stats));
}
