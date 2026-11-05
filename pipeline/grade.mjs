// One studio for every garment. In OKLab, on the placed canvas: flatten each photo's own big-scale lighting towards a shared
// amount, lift fold contrast on flat flash shots, pull fabric micro-detail towards a shared level, apply a single shared light
// (soft top-down plus form-edge burn). The garment's own colour wins: exposure stays within a hair of the source fabric,
// hue and chroma are never moved except to stay in gamut.
import {gauss,maskedGauss,dist} from './lib-matte.mjs';
const toLin=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
const LUT=Float32Array.from({length:256},(_,i)=>toLin(i));
const toS=v=>v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055;
export function oklab(r,g,b){const l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b),m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b),s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
  return [0.2104542553*l+0.793617785*m-0.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,0.0259040371*l+0.7827717662*m-0.808675766*s]}
export const lab8=(r,g,b)=>oklab(LUT[r],LUT[g],LUT[b]);
export function linrgb(L,a,b){const l=(L+0.3963377774*a+0.2158037573*b)**3,m=(L-0.1055613458*a-0.0638541728*b)**3,s=(L-0.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.707614701*s]}
const med=a=>{const s=a.slice().sort((x,y)=>x-y);return s[s.length>>1]??0};
const pct=(s,p)=>s[Math.min(s.length-1,Math.floor(s.length*p))]??0;
const std=a=>{let m=0,v=0;for(const x of a)m+=x;m/=a.length||1;for(const x of a)v+=(x-m)**2;return Math.sqrt(v/(a.length||1))};
const sstep=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};
const clampC=(l,a,b)=>{ // continuous gamut map by chroma only. A stepped search here posterised saturated shadows into hard-edged stains.
  const ok=v=>v>=-1e-4&&v<=1+1e-4; const inG=(p)=>ok(p[0])&&ok(p[1])&&ok(p[2]);
  let rgb=linrgb(l,a,b); if(inG(rgb))return rgb;
  let lo=0,hi=1; for(let k=0;k<12;k++){const t=(lo+hi)/2;if(inG(linrgb(l,a*t,b*t)))lo=t;else hi=t}
  return linrgb(l,a*lo,b*lo);
};
const FINE=0.013; // shared fabric micro-detail target: std of the sigma 1.1 high-pass band, OKLab L
const BAND=0.0105; // shared ceiling for the sigma 1.1 to 11 band

export function grade(rgba,alpha,S,o,scale){
  const N=S*S, L=new Float32Array(N),A=new Float32Array(N),B=new Float32Array(N),M=new Float32Array(N);
  let top=S,bot=0; const opq=[];
  for(let i=0;i<N;i++){const al=alpha[i]; if(al<=0)continue;
    const p=oklab(LUT[rgba[i*4]],LUT[rgba[i*4+1]],LUT[rgba[i*4+2]]);L[i]=p[0];A[i]=p[1];B[i]=p[2];
    if(al>0.98){M[i]=1;opq.push(i);const y=i/S|0;if(y<top)top=y;if(y>bot)bot=y}}
  // soft-core band stop: low-amplitude ripple in the band goes, grain below it and folds, seams and print edges above it stay
  // cloth only, so a print neither leaks into the band nor gets touched; box is master px with a soft edge, for a stain that sits in one place
  if(o.demoire){const pre=opq.filter((_,k)=>k%5===0),l0=med(pre.map(i=>L[i])),a0=med(pre.map(i=>A[i])),b0=med(pre.map(i=>B[i])),C=new Float32Array(N);
    for(const i of opq)if(Math.abs(A[i]-a0)<0.04&&Math.abs(B[i]-b0)<0.04)C[i]=L[i]-l0; else C[i]=9;
    for(const z of [o.demoire].flat()){const w=z.win??0.12,K=new Float32Array(N);for(const i of opq)if(Math.abs(C[i])<w)K[i]=1;const lo=maskedGauss(L,K,S,S,z.lo),hi=maskedGauss(L,K,S,S,z.hi),bx=z.box;
      for(const i of opq){if(!K[i])continue;const y=i/S|0,x=i%S,t=bx?sstep(0,30,Math.min(x-bx[0],bx[2]-x,y-bx[1],bx[3]-y)):1;if(t<=0)continue;const b=lo[i]-hi[i];L[i]-=t*z.k*b*Math.exp(-((b/z.tau)**2))}}}
  // colour moire is chroma only and the cloth has one colour: over cloth, a and b follow their own wide average. A print is outside the window and keeps its colour.
  if(o.chroma){const pre=opq.filter((_,k)=>k%5===0),a0=med(pre.map(i=>A[i])),b0=med(pre.map(i=>B[i])),K=new Float32Array(N),w=o.chroma.win??0.04;
    for(const i of opq)if(Math.abs(A[i]-a0)<w&&Math.abs(B[i]-b0)<w)K[i]=1;
    const la=maskedGauss(A,K,S,S,o.chroma.sigma),lb=maskedGauss(B,K,S,S,o.chroma.sigma);for(const i of opq)if(K[i]){A[i]=la[i];B[i]=lb[i]}}
  // knit interference runs in straight vertical bands, so it shows only across x: average down y, band-pass across x, take that away soft-core. Ribs stay finer than lo, folds stay above tau.
  if(o.destripe){const z=o.destripe,K=new Float32Array(N),pre=opq.filter((_,k)=>k%5===0),l0=med(pre.map(i=>L[i])),a0=med(pre.map(i=>A[i])),b0=med(pre.map(i=>B[i]));
    for(const i of opq)if(Math.abs(L[i]-l0)<0.2&&Math.abs(A[i]-a0)<0.04&&Math.abs(B[i]-b0)<0.04)K[i]=1;
    const column=new Float32Array(N),nm=new Float32Array(N);{const lK=new Float32Array(N);for(let i=0;i<N;i++)lK[i]=L[i]*K[i];
      for(const [from,to] of [[lK,column],[K,nm]]){for(let x=0;x<S;x++){let v=0;for(let y=0;y<S;y++){v+=from[y*S+x];if(y>=z.len)v-=from[(y-z.len)*S+x];to[Math.max(0,y-(z.len>>1))*S+x]=v}}}
      for(let i=0;i<N;i++)column[i]=nm[i]>z.len/4?column[i]/nm[i]:L[i]}
    const lo=maskedGauss(column,K,S,S,z.lo),hi=maskedGauss(column,K,S,S,z.hi);
    for(const i of opq){if(!K[i])continue;const b=lo[i]-hi[i];L[i]-=z.k*b*Math.exp(-((b/z.tau)**2))}}
  const sample=opq.filter((_,k)=>k%5===0);
  const Lm=med(sample.map(i=>L[i])), am=med(sample.map(i=>A[i])), bm=med(sample.map(i=>B[i]));
  // white balance for pieces the feed names as grey: move the whole picture so the cloth lands on one shared neutral, instead of keeping each frame's cast
  const wbA=o.wb?o.wb[0]-am:0, wbB=o.wb?o.wb[1]-bm:0;
  const fabric=i=>Math.abs(L[i]-Lm)<0.09&&Math.abs(A[i]-am)<0.035&&Math.abs(B[i]-bm)<0.035; // excludes prints from every lighting statistic
  // clean: the light estimate skips print, or a low gMid leaves a pale halo round every tab and pinstripe
  const ML=o.clean?M.map((v,i)=>v&&fabric(i)?1:0):M;
  const low=maskedGauss(L,ML,S,S,70), mid=maskedGauss(L,ML,S,S,11), fine=maskedGauss(L,M,S,S,1.1);
  const fab=sample.filter(fabric);
  const lowStd=std(fab.map(i=>low[i])), midStd=std(fab.map(i=>mid[i]-low[i])), fineStd=std(fab.map(i=>L[i]-fine[i]));
  // converge every photo on the same amount of big-scale light and the same fold contrast
  const kLow=o.kLow??Math.min(1.1,Math.max(0.6,0.03/Math.max(lowStd,1e-3)));
  const gMid=o.gMid??Math.min(1.9,Math.max(0.8,0.019/Math.max(midStd,1e-3)));
  // and on the same fine detail: soft sources get a capped unsharp, the crispest come down a little
  const gFine=o.gFine??Math.min(0.35,Math.max(-0.35,FINE/Math.max(fineStd,1e-4)-1)); // sharpening harder than this turned moire and compression into visible relief
  // cloth mottling between the fine and fold scales: low-amplitude only, so seams and print edges stay; quiet sources are never boosted
  const kBand=o.kBand??Math.min(0.6,Math.max(0,1-BAND/Math.max(std(fab.map(i=>fine[i]-mid[i])),1e-4)));
  const band=i=>{const v=fine[i]-mid[i];return fabric(i)?v*(1-kBand*Math.exp(-((v/0.035)**2))):v};
  const d=dist(S,S,i=>alpha[i]>=0.5);
  const lift=o.lift??0.022*sstep(0.42,0.26,Lm)+0.02*sstep(0.24,0.17,Lm), pale=sstep(0.74,0.9,Lm); // darks keep a hair of rim so the form holds on a dark ground
  const burnA=o.burn??(0.016+0.022*pale), burnD=70, rimA=o.rim??(0.012+0.03*pale), rimD=11, liftD=9;
  const H=Math.max(1,bot-top), softTop=o.softTop??0.975, softBot=o.black??0.12;
  const shape=i=>{const yn=((i/S|0)-top)/H,dd=d[i];
    let l=kLow*(low[i]-Lm)+gMid*(mid[i]-low[i])+(1+gFine)*(L[i]-fine[i])+band(i);
    return {l,mul:1+0.022-0.05*yn,sub:burnA*Math.exp(-dd/burnD)+rimA*Math.exp(-dd/rimD)-lift*Math.exp(-dd/liftD)}};
  // the exposure that lands the fabric median on its source median, plus an optional per-item nudge; this is the drift cap's main lever
  const Lwant=Lm+(o.exposure??0); let Lt=Lwant;
  for(let it=0;it<2;it++){const sL=fab.filter((_,k)=>k%4===0).map(i=>{const s=shape(i);return (Lt+s.l)*s.mul-s.sub}); Lt+=Lwant-med(sL)}
  const out=Buffer.alloc(N*4); let clip=0,n=0; const Ls=[];
  const Lf=new Float32Array(N);
  for(let i=0;i<N;i++){const al=alpha[i]; if(al<=0)continue;
    const s=shape(i); Lf[i]=(Lt+s.l)*s.mul-s.sub}
  // one shared light: each source's own tilt comes out and the same tilt and edge falloff go in, or a left-lit frame reads as another shoot beside a right-lit one. Darks get less, in lightness terms.
  const tone=sstep(0.2,0.6,Lm),body=fab.filter(i=>{const y=i/S|0;return y>top+0.25*H&&y<bot-0.02*H});
  let cx=0,cy=0,cl=0;for(const i of body){cx+=i%S;cy+=i/S|0;cl+=Lf[i]}cx/=body.length||1;cy/=body.length||1;cl/=body.length||1;
  let xx=0,yy=0,xy=0,xl=0,yl=0;for(const i of body){const x=i%S-cx,y=(i/S|0)-cy,v=Lf[i]-cl;xx+=x*x;yy+=y*y;xy+=x*y;xl+=x*v;yl+=y*v}
  const det=xx*yy-xy*xy||1,gx=(xl*yy-yl*xy)/det,gy=(yl*xx-xl*xy)/det,tx=(0.008+0.008*tone)/500,ty=-(0.018+0.02*tone)/700;
  for(let i=0;i<N;i++)if(alpha[i]>0)Lf[i]+=(tx-gx)*(i%S-cx)+(ty-gy)*((i/S|0)-cy);
  const edge0=med(fab.filter(i=>d[i]>150).map(i=>Lf[i]))-med(fab.filter(i=>d[i]>6&&d[i]<30).map(i=>Lf[i]));
  const dEdge=Math.max(-0.04,Math.min(0.04,0.012+0.03*tone-edge0));
  for(let i=0;i<N;i++)if(alpha[i]>0)Lf[i]-=dEdge*Math.exp(-d[i]/40)/0.64;
  // the body fit above leaves the outer sleeves free, and they are what the eye compares across a row: hold them to the same shared tilt
  {const sl=fab.filter(i=>d[i]>8&&d[i]<48&&(i/S|0)>top+0.42*H&&(i/S|0)<top+0.85*H),lft=sl.filter(i=>i%S<cx-200),rgt=sl.filter(i=>i%S>cx+200);
   if(lft.length>200&&rgt.length>200){const mx=a=>a.reduce((p,i)=>p+i%S,0)/a.length,dx=mx(rgt)-mx(lft),g=Math.max(-3e-5,Math.min(3e-5,tx-(med(rgt.map(i=>Lf[i]))-med(lft.map(i=>Lf[i])))/dx));
     for(let i=0;i<N;i++)if(alpha[i]>0)Lf[i]+=g*(i%S-cx)}}
  {const shift=Lwant-med(fab.map(i=>Lf[i]));for(let i=0;i<N;i++)if(alpha[i]>0)Lf[i]+=shift}
  // grain floor: a source too clean to sharpen (waxy render look) gets just enough soft luminance grain to sit with its neighbours. Never added above the shared level.
  const fineNow=fineStd*(1+gFine), grainAmp=o.grain??Math.sqrt(Math.max(0,(FINE*0.85)**2-fineNow**2));
  if(grainAmp>0){let seed=1234567;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296-0.5};
    const nz=new Float32Array(N);for(let i=0;i<N;i++)nz[i]=rnd();const sm=gauss(nz,S,S,0.75);let v=0;for(let i=0;i<N;i+=7)v+=sm[i]*sm[i];const nrm=grainAmp/Math.sqrt(v/(N/7));
    for(const i of opq)Lf[i]+=sm[i]*nrm}
  // rim limiter: no pencil line or glow. In the last pixels before the contour, lightness may leave the cloth just inside it by a soft maximum only.
  // A print is neither a reference nor a target, or the limit would drag a glow out of a logo next to the edge.
  {const cloth=i=>Math.abs(L[i]-Lm)<0.16&&Math.abs(A[i]-am)<0.05&&Math.abs(B[i]-bm)<0.05;
   const inner=new Float32Array(N);for(let i=0;i<N;i++)inner[i]=d[i]>=7&&alpha[i]>0.98&&cloth(i)?1:0;
   const ref=maskedGauss(Lf,inner,S,S,5),lim=o.rimLimit??0.028;
   for(let i=0;i<N;i++){if(alpha[i]<=0||d[i]>=9||(d[i]>=3&&!cloth(i)))continue;const t=1-sstep(5,9,d[i]),l=Lf[i];Lf[i]=l*(1-t)+(ref[i]+lim*Math.tanh((l-ref[i])/lim))*t}}
  for(let i=0;i<N;i++){const al=alpha[i]; if(al<=0)continue;
    let l=Lf[i];
    if(l>softTop-0.04){const k=softTop-0.04,r=0.04;l=k+r*Math.tanh((l-k)/r)}
    if(l<softBot+0.03){const k=softBot+0.03,r=0.03;l=k+r*Math.tanh((l-k)/r)}
    const rgb=clampC(l,A[i]+wbA,B[i]+wbB);
    for(let c=0;c<3;c++)out[i*4+c]=Math.max(0,Math.min(255,Math.round(toS(Math.max(0,Math.min(1,rgb[c])))*255)));
    out[i*4+3]=Math.round(al*255);
    if(al>0.98&&i%5===0){n++;if(out[i*4]>=254||out[i*4+1]>=254||out[i*4+2]>=254)clip++;Ls.push(l)}
  }
  Ls.sort((x,y)=>x-y);
  const r3=v=>Math.round(v*1000)/1000;
  return {rgba:out,stats:{Lm:r3(Lm),Lt:r3(Lt),lowStd:r3(lowStd),midStd:r3(midStd),fineStd:Math.round(fineStd*1e5)/1e5,kLow:r3(kLow),gMid:r3(gMid),gFine:r3(gFine),kBand:r3(kBand),tiltX:Math.round(gx*5e5)/1e3,tiltY:Math.round(gy*7e5)/1e3,edge:r3(edge0),grain:Math.round(grainAmp*1e4)/1e4,p2:r3(pct(Ls,.02)),p98:r3(pct(Ls,.98)),clip:r3(clip/(n||1))}};
}
