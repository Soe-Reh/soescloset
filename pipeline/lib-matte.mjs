// Pixel helpers shared by the refine step. Float32Array / Uint8Array images, row-major.
import sharp from 'sharp';

export function flood(w,h,seed,pass){ // 4-connected; seed: indices; pass(i)=may enter
  const seen=new Uint8Array(w*h), st=new Int32Array(w*h); let n=0;
  for(const i of seed) if(!seen[i]&&pass(i)){seen[i]=1;st[n++]=i;}
  while(n){const i=st[--n],x=i%w;
    if(x>0&&!seen[i-1]&&pass(i-1)){seen[i-1]=1;st[n++]=i-1}
    if(x<w-1&&!seen[i+1]&&pass(i+1)){seen[i+1]=1;st[n++]=i+1}
    if(i>=w&&!seen[i-w]&&pass(i-w)){seen[i-w]=1;st[n++]=i-w}
    if(i<w*h-w&&!seen[i+w]&&pass(i+w)){seen[i+w]=1;st[n++]=i+w}}
  return seen;
}
export function border(w,h){const b=[];for(let x=0;x<w;x++)b.push(x,w*h-w+x);for(let y=0;y<h;y++)b.push(y*w,y*w+w-1);return b}
export function dist(w,h,inside){ // chamfer distance to the nearest non-inside pixel
  const d=new Float32Array(w*h).fill(1e6);
  for(let i=0;i<w*h;i++) if(!inside(i)) d[i]=0;
  const D=1,E=1.414;
  for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i++){if(!d[i])continue;
    if(x)d[i]=Math.min(d[i],d[i-1]+D); if(y){d[i]=Math.min(d[i],d[i-w]+D); if(x)d[i]=Math.min(d[i],d[i-w-1]+E); if(x<w-1)d[i]=Math.min(d[i],d[i-w+1]+E);}}
  for(let y=h-1,i=w*h-1;y>=0;y--)for(let x=w-1;x>=0;x--,i--){if(!d[i])continue;
    if(x<w-1)d[i]=Math.min(d[i],d[i+1]+D); if(y<h-1){d[i]=Math.min(d[i],d[i+w]+D); if(x<w-1)d[i]=Math.min(d[i],d[i+w+1]+E); if(x)d[i]=Math.min(d[i],d[i+w-1]+E);}}
  return d;
}
export function median(a){a.sort((x,y)=>x-y);return a[a.length>>1]??0}

function box1(src,dst,w,h,r,stepA,stepB,nA,nB){ // running-sum box blur along A, for each B
  const n=2*r+1;
  for(let b=0;b<nB;b++){const o=b*stepB; let sum=src[o]*(r+1);
    for(let k=1;k<=r;k++)sum+=src[o+Math.min(k,nA-1)*stepA];
    for(let k=0;k<nA;k++){dst[o+k*stepA]=sum/n;
      const add=src[o+Math.min(k+r+1,nA-1)*stepA], sub=src[o+Math.max(k-r,0)*stepA]; sum+=add-sub}}
}
export function gauss(a,w,h,sigma){ // three box passes ≈ Gaussian
  if(sigma<0.3) return Float32Array.from(a);
  const r=Math.max(1,Math.round((Math.sqrt(12*sigma*sigma/3+1)-1)/2));
  let s=Float32Array.from(a), d=new Float32Array(w*h);
  for(let p=0;p<3;p++){box1(s,d,w,h,r,1,w,w,h);[s,d]=[d,s];box1(s,d,w,h,r,w,1,h,w);[s,d]=[d,s]}
  return s;
}
export function maskedGauss(a,m,w,h,sigma){ // Gaussian that ignores pixels with m=0, so the backdrop never leaks into a light estimate
  const am=new Float32Array(w*h); for(let i=0;i<am.length;i++)am[i]=a[i]*m[i];
  const na=gauss(am,w,h,sigma), nm=gauss(m,w,h,sigma);
  for(let i=0;i<na.length;i++)na[i]=nm[i]>1e-3?na[i]/nm[i]:a[i];
  return na;
}
export function nearestFrom(w,h,safe,limit){ // BFS multi-source: index of the nearest safe pixel, -1 when further than limit
  const N=w*h, near=new Int32Array(N).fill(-1); let q=new Int32Array(N), nq=new Int32Array(N), n=0;
  for(let i=0;i<N;i++) if(safe(i)){near[i]=i;q[n++]=i}
  for(let step=0;step<limit&&n;step++){let m=0;
    for(let k=0;k<n;k++){const i=q[k],x=i%w,v=near[i];
      if(x>0&&near[i-1]<0){near[i-1]=v;nq[m++]=i-1}
      if(x<w-1&&near[i+1]<0){near[i+1]=v;nq[m++]=i+1}
      if(i>=w&&near[i-w]<0){near[i-w]=v;nq[m++]=i-w}
      if(i<N-w&&near[i+w]<0){near[i+w]=v;nq[m++]=i+w}}
    [q,nq]=[nq,q];n=m}
  return near;
}
export async function polyMask(pts,w,h,feather=0){ // [x,y,x,y,...] in source pixels -> 8-bit mask
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polygon points="${pts.join(',')}" fill="#fff"/></svg>`;
  let img=sharp(Buffer.from(svg)).ensureAlpha().extractChannel(3);
  if(feather>0) img=img.blur(feather);
  return img.raw().toBuffer();
}
export function measure(al,W,H){ // silhouette landmarks from an 8-bit alpha
  const left=new Int32Array(H).fill(-1),right=new Int32Array(H).fill(-1);
  for(let y=0;y<H;y++){let l=-1,r=-1;const o=y*W;for(let x=0;x<W;x++)if(al[o+x]>128){if(l<0)l=x;r=x} left[y]=l;right[y]=r}
  let top=-1,bot=-1;for(let y=0;y<H;y++)if(left[y]>=0){if(top<0)top=y;bot=y}
  const Ht=bot-top+1, width=y=>right[y]-left[y]+1;
  const k=Math.round(Ht*0.02), slope=y=>(width(y+k)-width(y))/k;
  // the hood-to-shoulder flare is the steepest widening in the upper body; neck = where it starts, shoulder point = where it settles
  let pk=top+Math.round(Ht*0.07); for(let y=pk;y<top+Ht*0.34;y++) if(slope(y)>slope(pk))pk=y;
  let sh=pk; while(sh>top+Ht*0.05&&slope(sh)>=1.0)sh--;
  let sy=pk; while(sy<pk+Ht*0.14&&slope(sy)>=1.4)sy++;
  // hem = lowest opaque row in the central fifth; cuffs = lowest opaque row in the outer 18% each side
  let hem=top; const cx=Math.round((left[sy]+right[sy])/2), span=right[sy]-left[sy], cr=Math.round(span*0.1);
  for(let y=top;y<=bot;y++)for(let x=cx-cr;x<=cx+cr;x+=4)if(al[y*W+x]>128)hem=y;
  let wL=W,wR=0; for(let y=top;y<=bot;y++)if(left[y]>=0){wL=Math.min(wL,left[y]);wR=Math.max(wR,right[y])}
  const g=wR-wL, cuffAt=(a,b)=>{let c=top;for(let y=top;y<=bot;y++)for(let x=a;x<b;x+=3)if(al[y*W+x]>128)c=y;return c};
  const cuff=(cuffAt(wL,wL+Math.round(g*.18))+cuffAt(wR-Math.round(g*.18),wR))/2;
  return {left,right,top,bot,sh,sy,hem,wL,wR,cuff};
}
export function dominantHex(buf,ch,step,opaque){ // most-populated bin of a coarse RGB grid, then the mean of that bin
  const bins=new Map();
  for(let i=0;i<buf.length;i+=ch*step) if(opaque(i)){const k=(buf[i]>>4)<<8|(buf[i+1]>>4)<<4|buf[i+2]>>4;const b=bins.get(k)??[0,0,0,0];b[0]+=buf[i];b[1]+=buf[i+1];b[2]+=buf[i+2];b[3]++;bins.set(k,b)}
  const d=[...bins.values()].sort((a,b)=>b[3]-a[3])[0];
  return '#'+[0,1,2].map(c=>Math.round(d[c]/d[3]).toString(16).padStart(2,'0')).join('');
}
// Peel what the model called garment but is really backdrop: underarm plugs and contact-shadow bands. Reachable from outside only,
// so nothing inside the form can go. L/a/b are OKLab; ref* are the local fabric colours (masked blur), so lit and shaded fabric both hold.
export function peelMask({q,L,a,b,w,h,Bl,res,top,bot,thin,wide,gaps,shoulderY,o={}}){
  const inGap=(x,y)=>gaps.some(z=>Math.abs(x-z.x)<=z.rx&&y>=z.y-z.up&&y<=z.y+z.down);
  const dI=dist(w,h,j=>q[j]>=0.5);
  const M=new Float32Array(w*h); for(let i=0;i<M.length;i++)M[i]=dI[i]>thin?1:0;
  const sig=Math.max(6,14*res), rL=maskedGauss(L,M,w,h,sig), rA=maskedGauss(a,M,w,h,sig), rB=maskedGauss(b,M,w,h,sig);
  const chromaLim=o.chromaLim??0.02, darkDL=o.darkDL??0.085, diffDL=o.diffDL??0.065, diffC=o.diffC??0.035;
  const cand=i=>{
    if(q[i]<0.5) return true; const di=dI[i], y=i/w|0, x=i%w; if(di>wide) return false;
    const dCb=Math.hypot(a[i]-Bl[1],b[i]-Bl[2]), dL=L[i]-rL[i], dCf=Math.hypot(a[i]-rA[i],b[i]-rB[i]), C=Math.hypot(a[i],b[i]), Cf=Math.hypot(rA[i],rB[i]);
    const neutral=Cf>0.02&&C<Cf*0.5, differs=dCf>diffC||Math.abs(dL)>diffDL||neutral, backdrop=dCb<chromaLim&&L[i]<Bl[0]-0.02&&differs;
    // in an underarm apex nothing bright or greyish can be fabric, so the test is looser there
    if(inGap(x,y)&&differs&&dCb<Math.max(chromaLim,0.045)&&L[i]<Bl[0]+0.02&&L[i]>Bl[0]-(o.gapLow??0.3)) return true; // a dark crease above the apex is cloth, not backdrop
    if(di>thin||y<shoulderY||o.band===false) return false;
    return backdrop||(dL<-darkDL&&C<Cf*0.86);
  };
  const reach=flood(w,h,border(w,h),cand), peeled=new Uint8Array(w*h); let n=0;
  for(let i=0;i<w*h;i++) if(reach[i]&&q[i]>0){peeled[i]=1;n++}
  // bright slits past the apex, walled off from outside by a dark bridge: cutting would punch a pinhole, so they get repainted as the local fabric
  const paint=[],pr=Math.round(40*res);
  for(const z of gaps)for(let y=Math.max(0,z.y-z.up);y<Math.min(h,z.y+z.down);y++)for(let x=Math.max(0,z.x-(z.rx>>1));x<Math.min(w,z.x+(z.rx>>1));x++){const i=y*w+x;
    if(peeled[i]||q[i]<0.5||dI[i]>pr)continue; if(Math.hypot(a[i]-Bl[1],b[i]-Bl[2])<0.045&&L[i]-rL[i]>0.1&&L[i]>Bl[0]-0.07)paint.push(i)} // pale rib beside a dark sleeve is not a slit, so the level must really be the backdrop's
  return {peeled,n,paint,refs:{rL,rA,rB}};
}
// Underarm apexes: topmost interior transparent run on each side of the body, in the lower part of the garment
export function findGaps(q,w,h,top,bot,res){
  const H=bot-top, out=[]; let cx=0,cn=0; for(let y=top;y<bot;y+=4)for(let x=0;x<w;x+=4)if(q[y*w+x]>=0.5){cx+=x;cn++} cx/=cn||1;
  for(const side of [-1,1]){let found=null;
    for(let y=Math.round(top+H*0.4);y<bot&&!found;y++){
      let x=Math.round(cx),state=0,runStart=-1; // walk out from the body's middle: fabric -> gap -> fabric
      for(;x>=0&&x<w;x+=side){const on=q[y*w+x]>=0.5;
        if(state===0&&!on&&Math.abs(x-cx)>H*0.05){state=1;runStart=x}
        else if(state===1&&on){found={x:Math.round((runStart+x)/2),y};break}}
    }
    if(found)out.push({...found,rx:Math.round(60*res),up:Math.round(70*res),down:Math.round(30*res)});
  }
  return out;
}
// Pen-tool clipping path from a soft matte: trace every loop on the pixel grid, drop specks and pinholes, smooth along arc length.
// Coarse smoothing removes chewing, lobes and stair-steps; real corners (cuffs, hem ends) keep the fine path, because there the two disagree.
export function tracePath(q,w,h,{fine,coarse,cornerLo,cornerHi,minLoop,minHole}){
  const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&q[y*w+x]>=0.5;
  // directed cracks between fg and bg, fg on the left: x,y on the (w+1)-wide vertex grid
  const V=w+1, next=new Map(), add=(a,b)=>{const l=next.get(a);if(l)l.push(b);else next.set(a,[b])};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!on(x,y))continue;const v=(X,Y)=>Y*V+X;
    if(!on(x,y-1))add(v(x+1,y),v(x,y)); if(!on(x,y+1))add(v(x,y+1),v(x+1,y+1));
    if(!on(x-1,y))add(v(x,y),v(x,y+1)); if(!on(x+1,y))add(v(x+1,y+1),v(x+1,y))}
  const loops=[];
  for(const start of next.keys()){
    while(next.get(start)?.length){const L=[start];let c=next.get(start).pop();
      while(c!==start){L.push(c);const n=next.get(c);if(!n?.length)break;c=n.pop()}
      if(L.length>=8)loops.push(L)}
    next.delete(start)}
  const smooth=(a,sig)=>{const n=a.length,r=Math.ceil(sig*3),k=[];let t=0;for(let i=-r;i<=r;i++){const g=Math.exp(-i*i/(2*sig*sig));k.push(g);t+=g}
    const o=new Float64Array(n);if(r>=n/2){o.fill(a.reduce((x,y)=>x+y,0)/n);return o}
    for(let i=0;i<n;i++){let s=0;for(let j=-r;j<=r;j++)s+=a[(i+j+n)%n]*k[j+r];o[i]=s/t}return o};
  const out=[];let dropped=0;
  for(const L of loops){
    const xs=Float64Array.from(L,v=>v%V),ys=Float64Array.from(L,v=>v/V|0);
    let area=0;for(let i=0,n=xs.length;i<n;i++){const j=(i+1)%n;area+=xs[i]*ys[j]-xs[j]*ys[i]} area/=2;
    // the crack direction above puts fg on the left, so holes and outer loops have opposite signed areas
    const hole=area>0; if(Math.abs(area)<(hole?minHole:minLoop)){dropped++;continue}
    const fx=smooth(xs,fine),fy=smooth(ys,fine),cx=smooth(xs,coarse),cy=smooth(ys,coarse);
    const d=Float64Array.from(fx,(_,i)=>Math.hypot(fx[i]-cx[i],fy[i]-cy[i]));
    const ts=smooth(Float64Array.from(d,v=>{const t=Math.min(1,Math.max(0,(v-cornerLo)/(cornerHi-cornerLo)));return t*t*(3-2*t)}),fine*2);
    const px=[],py=[];for(let i=0;i<xs.length;i+=2){px.push(cx[i]*(1-ts[i])+fx[i]*ts[i]);py.push(cy[i]*(1-ts[i])+fy[i]*ts[i])}
    out.push({px,py,hole,area:Math.abs(area)})}
  return {loops:out,dropped};
}
export async function renderPath(loops,w,h){
  const d=loops.map(l=>'M'+l.px.map((x,i)=>x.toFixed(2)+' '+l.py[i].toFixed(2)).join('L')+'Z').join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill-rule="evenodd" fill="#fff" d="${d}"/></svg>`;
  const al=await sharp(Buffer.from(svg),{unlimited:true}).ensureAlpha().extractChannel(3).raw().toBuffer();
  return Float32Array.from(al,v=>v/255);
}
