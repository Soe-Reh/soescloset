// First-load bytes and frame times while wheeling through Walk, at 4x CPU and 2x DPR.
import {createRequire} from 'module';
const {chromium}=createRequire('/opt/homebrew/lib/node_modules/')('playwright');
const b=await chromium.launch(),c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2}),pg=await c.newPage();
let bytes=0;pg.on('response',async r=>{try{bytes+=(await r.body()).length}catch{}});
const cdp=await c.newCDPSession(pg);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await pg.goto('http://127.0.0.1:8790/');await pg.waitForTimeout(3000);const first=bytes;
await pg.goto('http://127.0.0.1:8790/#/walk');await pg.waitForTimeout(2500);await pg.mouse.move(720,450);
const p=pg.evaluate(()=>new Promise(res=>{const d=[];let l=performance.now();const end=l+5000;const t=n=>{d.push(n-l);l=n;n<end?requestAnimationFrame(t):res(d)};requestAnimationFrame(t)}));
for(let i=0;i<30;i++){await pg.mouse.wheel(0,120);await pg.waitForTimeout(90)}
const d=await p,s=[...d].sort((a,b)=>a-b);
console.log('first load KB',Math.round(first/1024),'walk p95',s[Math.floor(s.length*.95)].toFixed(1),'worst',s.at(-1).toFixed(1),'>33ms',d.filter(x=>x>33).length);
await b.close();
