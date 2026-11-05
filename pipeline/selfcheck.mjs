// node selfcheck.mjs: validates site/data.json and every image
import fs from 'node:fs'; import assert from 'node:assert'; import sharp from 'sharp'; import {findGaps,measure} from './lib-matte.mjs';
const d=JSON.parse(fs.readFileSync('../site/data.json'));
assert(d.length>=16&&d.length<=30,'16-30 items'); assert(new Set(d.map(x=>x.brand)).size>=12,'12+ brands'); assert.equal(new Set(d.map(x=>x.id)).size,d.length);
for(const x of d){
  for(const k of ['id','brand','name','price','currency','image','image_600','image_shadow','dominant_hex','source_hex']) assert(x[k],`${x.id} ${k}`);
  const rgb=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)), drift=Math.hypot(...rgb(x.dominant_hex).map((v,i)=>v-rgb(x.source_hex)[i]));
  assert(drift<=24,`${x.id} colour drift ${drift.toFixed(0)}`); // the grade may shape light but never restate a garment's colour
  assert(Math.abs(x.canvas.hem_y-1345)<=3,`${x.id} hem rail ${x.canvas.hem_y}`); assert(x.canvas.bottom_y<=1525,`${x.id} bottom`); assert(/^(domed|flat|peaked)-(open|closed)$/.test(x.hood_form),`${x.id} hood form`); assert.equal(typeof x.on_dark,'boolean',`${x.id} on_dark`);
  assert(fs.existsSync('../site/'+x.image_shadow),x.image_shadow);
  assert(/^\d+\.\d\d$/.test(x.price),x.id); assert(!(Number(x.compare_at_price)>Number(x.price)),`${x.id} sale price`); assert(/^[A-Z]{3}$/.test(x.currency),x.id); assert(x.url===null?/screenshot/.test(x.price_note):/^https:\/\//.test(x.url),`${x.id} url`); // null only for a price read from a user's screenshot assert(/^#[0-9a-f]{6}$/.test(x.dominant_hex),x.id);
  for(const k of ['shoulder_width_ratio','body_length_ratio','hood_height_ratio','sleeve_drop']) assert(x[k]>0&&x[k]<1.2,`${x.id} ${k}=${x[k]}`);
  assert(fs.existsSync('../'+x.raw),x.raw); assert.equal(x.low_res===true,(await sharp('../'+x.raw).metadata()).height<1000,`${x.id} low_res`);
  for(const [p,size] of [[x.image,1600],[x.image_600,600]]){
    const f='../site/'+p; assert(fs.existsSync(f),f);
    const {data,info}=await sharp(f).raw().toBuffer({resolveWithObject:true});
    assert(info.channels===4&&info.width===size&&info.height===size,f);
    let clear=0,solid=0; for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;else if(data[i]===255)solid++}
    const n=size*size; assert(clear/n>0.25&&solid/n>0.2,`${f} real transparency: ${clear/n} ${solid/n}`);
    // nothing touches the canvas edge except by design: sleeves never clipped
    for(let y=0;y<size;y++){assert.equal(data[y*size*4+3],0,f+' left edge');assert.equal(data[(y*size+size-1)*4+3],0,f+' right edge')}
    for(let x2=0;x2<size;x2++){assert.equal(data[x2*4+3],0,f+' top edge');assert.equal(data[(size*(size-1)+x2)*4+3],0,f+' bottom edge')}
    // hood tops align: first opaque row sits at hood_top_y
    let top=-1; for(let i=3,r=0;i<data.length;i+=4,r++) if(data[i]>128){top=Math.floor(r/size);break}
    assert(Math.abs(top*1600/size-x.canvas.hood_top_y)<=8,`${f} hood top at ${top}`);
    // masters: no backdrop speck left at an underarm apex, measured against the fabric around it
    if(size===1600){const al=new Uint8Array(size*size),qq=new Float32Array(size*size),lum=i=>0.2126*data[i*4]+0.7152*data[i*4+1]+0.0722*data[i*4+2];for(let i=0;i<al.length;i++){al[i]=data[i*4+3];qq[i]=al[i]/255}
      const g=measure(al,size,size);for(const z of findGaps(qq,size,size,g.top,g.bot,1.3)){const v=[];for(let y=z.y-60;y<z.y+20;y++)for(let k=z.x-22;k<z.x+22;k++)if(al[y*size+k]===255)v.push(lum(y*size+k));v.sort((a,b)=>a-b);// a deep shadow beside a real sleeve gap must not make the plain cloth next to it read as a speck
        const [dr,dg,db]=rgb(x.dominant_hex),m=Math.max(v[v.length>>1],0.2126*dr+0.7152*dg+0.0722*db);
        const hot=v.filter(u=>u>m+Math.max(45,m*0.9)).length;assert(hot<8,`${x.id} underarm speck at ${z.x},${z.y}: ${hot}px over ${m.toFixed(0)}`)}}
    // masters: alpha ramp stays crisp: partial-alpha area per unit of contour length is the true edge-normal width
    if(size===1600){let semi=0,len=0;for(let y=1;y<size-1;y++)for(let k=1;k<size-1;k++){const q=data[(y*size+k)*4+3];if(q>8&&q<247)semi++;const o=q>=128;if(o!==(data[(y*size+k+1)*4+3]>=128)||o!==(data[((y+1)*size+k)*4+3]>=128))len++}assert(semi/len<3.2,`${f} ramp ${semi/len}`)}
  }
}
// nothing stale left behind
const live=new Set(d.flatMap(x=>[x.image,x.image_600,x.image_shadow].map(p=>p.replace('img/',''))));
for(const f of fs.readdirSync('../site/img')) assert(live.has(f),'orphan '+f);
console.log('ok',d.length,'items');
