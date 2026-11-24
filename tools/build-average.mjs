// Builds the Average chapter's images once, so visitors' browsers do no pixel math.
// Run: python3 -m http.server 8752 --directory site & node tools/build-average.mjs
import {createRequire} from 'module';import fs from 'fs';
const {chromium}=createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const base='http://localhost:8752/',out=new URL('../site/',import.meta.url).pathname;
const b=await chromium.launch(),pg=await b.newPage();await pg.goto(base+'data.json');
const r=await pg.evaluate(async()=>{
  const G=await (await fetch('/data.json')).json(),N=G.length,S=1000;
  const imgs=await Promise.all(G.map(g=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src='/'+g.image})));
  const t=document.createElement('canvas');t.width=t.height=S;const c=t.getContext('2d',{willReadFrequently:true});
  const sum=new Float64Array(S*S*4),each=[];
  for(const im of imgs){c.clearRect(0,0,S,S);c.drawImage(im,0,0,S,S);const d=c.getImageData(0,0,S,S).data;each.push(d);
    for(let p=0;p<d.length;p+=4){const a=d[p+3]/255;sum[p]+=d[p]*a;sum[p+1]+=d[p+1]*a;sum[p+2]+=d[p+2]*a;sum[p+3]+=a}}
  // True mean: premultiplied sums, so a pixel's alpha is the share of pieces covering it.
  const mean=new ImageData(S,S),o=mean.data;
  for(let p=0;p<o.length;p+=4){const a=sum[p+3];if(!a)continue;o[p]=sum[p]/a;o[p+1]=sum[p+1]/a;o[p+2]=sum[p+2]/a;o[p+3]=255*a/N}
  const dist=each.map(d=>{let s=0,n=0;for(let p=0;p<d.length;p+=4){const a=d[p+3]/255,m=o[p+3]/255;if(a<.05&&m<.05)continue;
    s+=Math.abs(d[p]*a-o[p]*m)+Math.abs(d[p+1]*a-o[p+1]*m)+Math.abs(d[p+2]*a-o[p+2]*m);n++}return s/n});
  const order=dist.map((d,i)=>i).sort((a,b)=>dist[a]-dist[b]);
  // Outlines: every piece traced 2px wide in maroon; overlaps darken.
  const cnt=new Uint8Array(S*S);
  for(const d of each)for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){const p=y*S+x;
    if(d[p*4+3]>128&&(d[(p-1)*4+3]<=128||d[(p+1)*4+3]<=128||d[(p-S)*4+3]<=128||d[(p+S)*4+3]<=128)){cnt[p]++;cnt[p+1]++;cnt[p+S]++}}
  const ol=new ImageData(S,S);for(let p=0;p<S*S;p++)if(cnt[p]){ol.data[p*4]=92;ol.data[p*4+1]=36;ol.data[p*4+2]=48;ol.data[p*4+3]=Math.min(255,cnt[p]*70)}
  // Average shape: faint stack of all outlines, the mean silhouette (covered by half the pieces or more) filled in the mean colour and traced 3px black.
  let mr=0,mg=0,mb=0,mn=0;for(let p=0;p<o.length;p+=4)if(o[p+3]>=128){mr+=o[p];mg+=o[p+1];mb+=o[p+2];mn++}
  const inside=p=>o[p*4+3]>=128,sh=new ImageData(S,S),q=sh.data;
  for(let p=0;p<S*S;p++){if(cnt[p]){q[p*4]=92;q[p*4+1]=36;q[p*4+2]=48;q[p*4+3]=Math.min(90,cnt[p]*25)}
    if(inside(p)){q[p*4]=mr/mn;q[p*4+1]=mg/mn;q[p*4+2]=mb/mn;q[p*4+3]=110}}
  const S1=S;for(let y=3;y<S1-3;y++)for(let x=3;x<S1-3;x++){const p=y*S1+x;if(!inside(p))continue;
    let edge=false;for(let dy=-2;dy<=2&&!edge;dy++)for(let dx=-2;dx<=2;dx++)if(!inside(p+dy*S1+dx)){edge=true;break}
    if(edge){q[p*4]=11;q[p*4+1]=11;q[p*4+2]=11;q[p*4+3]=255}}
  const url=id=>{c.clearRect(0,0,S,S);c.putImageData(id,0,0);return t.toDataURL('image/webp',.92)};
  return {mean:url(sh),outline:url(ol),closest:G[order[0]].id,furthest:G[order[N-1]].id};
});
const save=(f,u)=>fs.writeFileSync(out+f,Buffer.from(u.split(',')[1],'base64'));
save('img/average-mean.webp',r.mean);save('img/average-outline.webp',r.outline);
fs.writeFileSync(out+'average.json',JSON.stringify({closest:r.closest,furthest:r.furthest})+'\n');
console.log('closest',r.closest,'furthest',r.furthest);
await b.close();
