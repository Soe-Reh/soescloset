// node qa-set.mjs: set-wide numbers the retoucher reads. Outer-sleeve balance, cloth surface at two scales, chroma ripple, width.
import fs from 'node:fs'; import sharp from 'sharp'; import {measure,gauss} from './lib-matte.mjs'; import {lab8} from './grade.mjs';
const d=JSON.parse(fs.readFileSync('../site/data.json')), S=1600, rows=[];
const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1]??0, std=a=>{const m=a.reduce((p,c)=>p+c,0)/(a.length||1);return Math.sqrt(a.reduce((p,c)=>p+(c-m)**2,0)/(a.length||1))};
for(const x of d){
  const {data}=await sharp('../site/'+x.image).raw().toBuffer({resolveWithObject:true});
  const N=S*S,al=new Uint8Array(N),L=new Float32Array(N),a=new Float32Array(N),b=new Float32Array(N);
  for(let i=0;i<N;i++){al[i]=data[i*4+3];const p=lab8(data[i*4],data[i*4+1],data[i*4+2]);L[i]=p[0];a[i]=p[1];b[i]=p[2]}
  const m=measure(al,S,S), H=m.hem-m.sy, y0=m.sy+Math.round(H*.3), y1=m.sy+Math.round(H*.8), l=[],r=[];
  for(let y=y0;y<y1;y+=3){let xl=0;while(xl<S&&al[y*S+xl]<255)xl++;let xr=S-1;while(xr>0&&al[y*S+xr]<255)xr--;
    for(let k=8;k<48;k+=3){l.push(L[y*S+xl+k]);r.push(L[y*S+xr-k])}}
  // cloth = pixels near the median colour, inner body
  const px=[];for(let y=m.sy;y<m.hem;y+=2)for(let k=m.left[m.sy]+60;k<m.right[m.sy]-60;k+=2)if(al[y*S+k]===255)px.push(y*S+k);
  const Lm=med(px.map(i=>L[i])),am=med(px.map(i=>a[i])),bm=med(px.map(i=>b[i])),cl=px.filter(i=>Math.abs(L[i]-Lm)<.09&&Math.abs(a[i]-am)<.03&&Math.abs(b[i]-bm)<.03);
  const f1=gauss(L,S,S,1.1),f2=gauss(L,S,S,5),f3=gauss(L,S,S,14),ca=gauss(a,S,S,3),cb=gauss(b,S,S,3),cA=gauss(a,S,S,20),cB=gauss(b,S,S,20);
  rows.push({id:x.id,w:m.wR-m.wL+1,cuff:Math.round(m.cuff-m.hem),balance:+(med(r)-med(l)).toFixed(3),fine:+(1e3*std(cl.map(i=>L[i]-f1[i]))).toFixed(1),band:+(1e3*std(cl.map(i=>f1[i]-f3[i]))).toFixed(1),ripple:+(1e3*std(cl.map(i=>Math.hypot(ca[i]-cA[i],cb[i]-cB[i])))).toFixed(1),L:+Lm.toFixed(3)});
}
rows.sort((p,q)=>p.id<q.id?-1:1);console.table(rows);
