// QA: draw measured lines over each cutout
import fs from 'node:fs'; import sharp from 'sharp'; import {sheet} from './lib-sheet.mjs';
const items=JSON.parse(fs.readFileSync('items.json')), m=JSON.parse(fs.readFileSync('measures.json')); const files=[];
for(const it of items){const q=m[it.id].qa.lines;
 const line=(y,c)=>`<line x1="0" x2="1600" y1="${y}" y2="${y}" stroke="${c}" stroke-width="6"/>`;
 const svg=`<svg width="1600" height="1600">${line(q.neck,'#f0f')}${line(q.shoulder,'#0af')}${line(q.hem,'#0a0')}${line(q.cuff,'#f60')}<line x1="${q.l}" x2="${q.r}" y1="${q.shoulder+14}" y2="${q.shoulder+14}" stroke="#000" stroke-width="10"/></svg>`;
 const f=`sheets/ov-${it.id}.png`; await sharp(`../site/img/${it.id}-600.webp`).resize(1600,1600).composite([{input:Buffer.from(svg)}]).png().toFile(f); files.push(f)}
await sheet(files,'sheets/overlay.png',{cols:6,cell:245,labels:items.map(i=>i.id)});
