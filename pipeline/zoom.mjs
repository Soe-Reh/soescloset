// zoom.mjs out.png bg id:x:y[:size] ... crops of the final 1600 canvas at 1:1 over a backdrop
import sharp from 'sharp'; import {sheet} from './lib-sheet.mjs';
const [out,bg,...specs]=process.argv.slice(2); const files=[];
for(const [i,s] of specs.entries()){const [id,x,y,sz=500]=s.split(':');const f=`sheets/zz${i}.png`;
 await sharp(`../site/img/${id}.webp`).extract({left:+x,top:+y,width:+sz,height:+sz}).png().toFile(f);files.push(f)}
await sheet(files,out,{bg:bg||'#222',cols:4,cell:370,labels:specs});
