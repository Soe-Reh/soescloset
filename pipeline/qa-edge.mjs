// node qa-edge.mjs [id ...]: unroll every cutout's whole contour into strips on white and near-black (sheets/edge-<id>.png), and list the worst rim cells.
// node qa-edge.mjs zoom out.png id,x,y,w,h ... : 3x crops of the master on white and near-black, for checking a named spot.
import fs from 'node:fs'; import sharp from 'sharp'; import {tracePath} from './lib-matte.mjs'; import {oklab} from './grade.mjs';
const S=1600, GW='#ffffff', GD='#0e0e0e';
const lin=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
const load=async id=>(await sharp(`../site/img/${id}.webp`).raw().toBuffer());
if(process.argv[2]==='zoom'){
  const out=process.argv[3],tiles=[],F=+(process.env.ZF??3);let W=0,y=0;
  for(const spec of process.argv.slice(4)){const [id,x,yy,w,h]=spec.split(',');const [X,Y,Wd,H]=[x,yy,w,h].map(Number);
    const ex={left:Math.max(0,X),top:Math.max(0,Y),width:Wd,height:H};const crop=await sharp(`../site/img/${id}.webp`).extract(ex).resize(Wd*F,H*F,{kernel:'nearest'}).png().toBuffer();
    for(const [k,g] of [[0,GW],[1,GD]])tiles.push({input:await sharp({create:{width:Wd*F,height:H*F,channels:3,background:g}}).composite([{input:crop}]).png().toBuffer(),left:k*(Wd*F+6),top:y});
    W=Math.max(W,Wd*2*F+6);y+=H*F+6}
  await sharp({create:{width:W,height:y,channels:3,background:'#808080'}}).composite(tiles).png().toFile(out);process.exit(0)}
const ids=process.argv.length>2?process.argv.slice(2):JSON.parse(fs.readFileSync('../site/data.json')).map(d=>d.id);
for(const id of ids){
  const d=await load(id),q=new Float32Array(S*S);for(let i=0;i<q.length;i++)q[i]=d[i*4+3]/255;
  const {loops}=tracePath(q,S,S,{fine:1,coarse:2,cornerLo:9,cornerHi:10,minLoop:50,minHole:4});
  const bil=(x,y,c)=>{const X=Math.max(0,Math.min(S-2,Math.floor(x))),Y=Math.max(0,Math.min(S-2,Math.floor(y))),u=x-X,v=y-Y,o=(yy,xx)=>d[(yy*S+xx)*4+c];return (o(Y,X)*(1-u)+o(Y,X+1)*u)*(1-v)+(o(Y+1,X)*(1-u)+o(Y+1,X+1)*u)*v};
  const out=[...loops].sort((a,b)=>b.area-a.area)[0],n=out.px.length,HB=16,ZOOM=2,ROW=800; // band half-height and row length in contour samples (every 2 px)
  const rows=Math.ceil(n/ROW),H=(HB*2+1)*ZOOM,img=Buffer.alloc((ROW*2)*(rows*(H*2+4))*3,128),W=ROW*2;
  const cells=[];
  for(let i=0;i<n;i++){const a=(i+n-3)%n,b=(i+3)%n;let nx=out.py[b]-out.py[a],ny=-(out.px[b]-out.px[a]);const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
    // sign: outward has lower alpha
    if(bil(out.px[i]+nx*5,out.py[i]+ny*5,3)>bil(out.px[i]-nx*5,out.py[i]-ny*5,3)){nx=-nx;ny=-ny}
    const r=i/ROW|0,cx=(i%ROW)*2;
    for(let t=-HB;t<=HB;t++){const X=out.px[i]+nx*t,Y=out.py[i]+ny*t,al=bil(X,Y,3)/255,c=[bil(X,Y,0),bil(X,Y,1),bil(X,Y,2)];
      for(let k=0;k<2;k++){const g=k?14:255;for(let z=0;z<ZOOM;z++)for(let dx=0;dx<2;dx++){const yy=r*(H*2+4)+k*H+(t+HB)*ZOOM+z,o=(yy*W+cx+dx)*3;for(let ch=0;ch<3;ch++)img[o+ch]=Math.round(c[ch]*al+g*(1-al))}}}
    if(i%3===0){const P=(t)=>oklab(lin(bil(out.px[i]-nx*t,out.py[i]-ny*t,0)),lin(bil(out.px[i]-nx*t,out.py[i]-ny*t,1)),lin(bil(out.px[i]-nx*t,out.py[i]-ny*t,2)));
      const rim=P(1),inn=P(8);cells.push({x:Math.round(out.px[i]),y:Math.round(out.py[i]),dL:rim[0]-inn[0],dC:Math.hypot(rim[1]-inn[1],rim[2]-inn[2])})}}
  await sharp(img,{raw:{width:W,height:rows*(H*2+4),channels:3}}).png().toFile(`sheets/edge-${id}.png`);
  const worst=[...cells].sort((a,b)=>(Math.abs(b.dL)+b.dC)-(Math.abs(a.dL)+a.dC)).filter((c,i,arr)=>arr.slice(0,i).every(o=>Math.hypot(o.x-c.x,o.y-c.y)>40)).slice(0,5);
  const ms=cells.map(c=>Math.abs(c.dL)+c.dC).sort((a,b)=>a-b);
  let area=0;for(let i=3;i<d.length;i+=4)area+=d[i]/255;
  console.log(id.padEnd(28),'fill',(area/(S*S)).toFixed(3),'rows',rows,'holes',loops.length-1,'rim p95',ms[Math.floor(ms.length*.95)].toFixed(3),'worst',worst.map(c=>`(${c.x},${c.y} ${c.dL.toFixed(2)}/${c.dC.toFixed(2)})`).join(' '));
}
