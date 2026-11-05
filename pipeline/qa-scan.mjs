// node qa-scan.mjs [id ...]: per master, rim pixels off the adjacent cloth by more than 18 levels, off-pattern notches and spurs in the mask, stray islands, pinholes.
import fs from 'node:fs'; import sharp from 'sharp';
const data=JSON.parse(fs.readFileSync('../site/data.json'));
const only=process.argv.slice(2), W=1600, N=W*W;
const lum=(p,i)=>.2126*p[i]+.7152*p[i+1]+.0722*p[i+2];
function morph(src,r,dilate){ // separable box dilate/erode
  const t=new Uint8Array(N),a=new Uint8Array(N);
  for(let y=0;y<W;y++){let c=0;for(let x=-r;x<W;x++){if(x+r<W&&src[y*W+x+r])c++;if(x-r-1>=0&&src[y*W+x-r-1])c--;if(x>=0)t[y*W+x]=dilate?+(c>0):+(c===Math.min(x+r,W-1)-Math.max(x-r,0)+1)}}
  for(let x=0;x<W;x++){let c=0;for(let y=-r;y<W;y++){if(y+r<W&&t[(y+r)*W+x])c++;if(y-r-1>=0&&t[(y-r-1)*W+x])c--;if(y>=0)a[y*W+x]=dilate?+(c>0):+(c===Math.min(y+r,W-1)-Math.max(y-r,0)+1)}}
  return a}
function blobs(test,minN){const lab=new Uint8Array(N),out=[];for(let i=0;i<N;i++){if(lab[i]||!test(i))continue;const s=[i];lab[i]=1;let n=0,x0=W,x1=0,y0=W,y1=0;
  while(s.length){const j=s.pop();n++;const x=j%W,y=j/W|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const k of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<W-1?j+W:-1])if(k>=0&&!lab[k]&&test(k)){lab[k]=1;s.push(k)}}
  if(n>=minN)out.push({n,x0,y0,x1,y1})}return out.sort((a,b)=>b.n-a.n)}
for(const d of data){ if(only.length&&!only.includes(d.id))continue;
  const p=await sharp('../site/'+d.image).ensureAlpha().raw().toBuffer();
  let rim=0,hi=0,lo=0; const OFF=[[-6,0],[6,0],[0,-6],[0,6],[-4,-4],[4,4],[-4,4],[4,-4]];
  for(let y=8;y<W-8;y++)for(let x=8;x<W-8;x++){const i=(y*W+x)*4,a=p[i+3];if(a<60||a>200)continue;let s=0,c=0;for(const [dx,dy] of OFF){const j=((y+dy)*W+x+dx)*4;if(p[j+3]===255){s+=lum(p,j);c++}}if(c>=2){rim++;const dl=lum(p,i)-s/c;if(dl>18)hi++;if(dl<-18)lo++}}
  const m=new Uint8Array(N);for(let i=0;i<N;i++)m[i]=p[i*4+3]>128?1:0;
  const cl=morph(morph(m,12,true),12,false),op=morph(morph(m,3,false),3,true);
  const notch=blobs(i=>cl[i]&&!m[i],40),spur=blobs(i=>m[i]&&!op[i],12),isl=blobs(i=>p[i*4+3]>8,1),seen=new Uint8Array(N);
  const st=[];for(let k=0;k<W;k++)st.push(k,(W-1)*W+k,k*W,k*W+W-1);while(st.length){const j=st.pop();if(seen[j]||p[j*4+3]>8)continue;seen[j]=1;const x=j%W,y=j/W|0;if(x>0)st.push(j-1);if(x<W-1)st.push(j+1);if(y>0)st.push(j-W);if(y<W-1)st.push(j+W)}
  let holes=0;for(let i=0;i<N;i++)if(!seen[i]&&p[i*4+3]<=8)holes++;
  const f=b=>`${b.n}@${b.x0},${b.y0}-${b.x1},${b.y1}`;
  console.log(d.id.padEnd(26),`rim+18 ${(100*hi/rim).toFixed(1)}% rim-18 ${(100*lo/rim).toFixed(1)}% islands ${isl.length} holes ${holes}`,'notch',notch.slice(0,5).map(f).join(' '),'spur',spur.slice(0,4).map(f).join(' '));
}
