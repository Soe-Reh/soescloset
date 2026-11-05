import {S,G,$,clamp,ss,sss,lerp,hold,vis,money,fitWidth,add,CT,HH} from '../core.js';
const {q,N,last}=S;
const sh=G.map(g=>+g.shoulder_width_ratio||0),known=sh.filter(v=>v>0),iWide=sh.indexOf(Math.max(...known)),iNarrow=sh.indexOf(Math.min(...known));
const ratio=v=>v.toFixed(3).slice(1),cents=v=>money(Math.round(v*100)/100);
// Pieces land cheapest first, so the running mean creeps and then the dearest pieces drag it. Each still counts exactly once.
const prices=G.map(g=>g.price),order=G.map((_,i)=>i).sort((a,b)=>prices[a]-prices[b]),rank=[];order.forEach((i,r)=>rank[i]=r);
const runMean=[];order.reduce((s,i,r)=>(runMean[r]=(s+prices[i])/(r+1),s+prices[i]),0);
const mean=runMean[last],below=prices.filter(p=>p<mean).length,meanSh=known.reduce((a,b)=>a+b,0)/known.length;

const letters=s=>[...s].map(c=>`<i>${c}</i>`).join('');
const word=add(`<div class="big six" id="word" aria-hidden="true"><span class="half">${letters('Ave')}</span><span class="half">${letters('rage')}</span></div>`);
const halves=[...word.children],ls=[...word.querySelectorAll('i')];
// Inside the garment layer, so a piece arriving lies over the mean and a piece leaving uncovers it.
const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=600;c.className='meanC';c.setAttribute('aria-hidden','true');c.style.zIndex=150;$('gs').append(c);return c};
const cvs=[canvas(),canvas()],cxs=cvs.map(c=>c.getContext('2d'));
const ea=add(`<div class="big six" id="ea" aria-hidden="true"><i>${ratio(sh[iWide])}</i></div>`),eb=add(`<div class="big six" id="eb" aria-hidden="true"><i>${ratio(sh[iNarrow])}</i></div>`);
const rules=[0,1,2,3].map(()=>add('<div class="rule"></div>'));
const lab=(g,id)=>add(`<a class="rulelab" id="${id}" href="#/piece/${g.id}" data-piece="${g.id}"><b>${g.brand}</b><br><span class="nm">${g.short}<br></span>$${g.label}</a>`);
const labs=[lab(G[iWide],'l1'),lab(G[iNarrow],'l2')];
// The mean wears its own price where the prints have blurred away.
const mp=document.createElement('div');mp.className='big six';mp.id='mp';mp.setAttribute('aria-hidden','true');mp.innerHTML=`<i>${cents(mean)}</i>`;$('gs').append(mp);
const nMean=add('<p class="note" id="nMean"></p>'),nStat=add('<p class="note" id="nStat"></p>');
const nExt=add(`<p class="note" id="nExt">Widest and narrowest shoulder of the ${N}, as a share of garment height. Same hood line, same hem.</p>`);
const statText=hex=>`<span>${below} of ${N} cost less</span> <span>Mean shoulder ${ratio(meanSh)}</span>${hex?` <span><i style="background:${hex}"></i>${hex}</span>`:''}`;
const holdText=`All ${N} count once.<br>${money(Math.min(...prices))} weighs what ${money(Math.max(...prices))} weighs.`;
nStat.innerHTML=statText();
const sr=document.createElement('p');sr.className='sr';$('mean').append(sr);
const srText=hex=>{sr.textContent=`The pixel mean of all ${N} pieces. Mean price ${cents(mean)}, ${below} of ${N} cost less, mean shoulder ${ratio(meanSh)}${hex?`, mean colour ${hex}`:''}. Widest shoulder ${ratio(sh[iWide])}: ${G[iWide].name}. Narrowest ${ratio(sh[iNarrow])}: ${G[iNarrow].name}.`};srText();

// The true running mean, one ImageData per landed piece. Sums are premultiplied, so a pixel's alpha is the share of pieces covering it and the black word shows through in exact proportion. A stack of opacities cannot do this: its result depends on order wherever a garment is transparent.
const R=[],SZ=600;
(async()=>{
  const t=document.createElement('canvas');t.width=t.height=SZ;const c=t.getContext('2d',{willReadFrequently:true});
  const sum=new Float32Array(SZ*SZ*4),load=src=>new Promise((ok,no)=>{const m=new Image();m.onload=()=>ok(m);m.onerror=no;m.src=src});
  let cr=0,cg=0,cb=0,ca=0;
  for(let r=0;r<N;r++){
    const g=G[order[r]],[a,b]=await Promise.all([load(g.image_shadow),load(g.image_600)]);
    c.clearRect(0,0,SZ,SZ);c.drawImage(a,0,0,SZ,SZ);c.drawImage(b,0,0,SZ,SZ);
    const d=c.getImageData(0,0,SZ,SZ).data,o=new ImageData(SZ,SZ),e=o.data;
    for(let p=0;p<d.length;p+=4){
      const A=d[p+3]/255;
      if(A>0){sum[p]+=d[p]*A;sum[p+1]+=d[p+1]*A;sum[p+2]+=d[p+2]*A;sum[p+3]+=A}
      if(A>.98){cr+=d[p];cg+=d[p+1];cb+=d[p+2];ca++}
      const s=sum[p+3];if(s>0){e[p]=sum[p]/s;e[p+1]=sum[p+1]/s;e[p+2]=sum[p+2]/s;e[p+3]=255*s/(r+1)}
    }
    R[r]=o;
    await new Promise(k=>setTimeout(k)); // one piece per task, so scrolling never waits on the sum
  }
  const hex='#'+[cr,cg,cb].map(v=>Math.round(v/ca).toString(16).padStart(2,'0')).join('');
  nStat.innerHTML=statText(hex);srText(hex);
})().catch(e=>console.error('mean',e)); // a piece failed: the row and the word stay, and no mean is claimed from fewer pieces

// Shoulder half-width in canvas px, from the ratio and the garment height in data.json.
const half=i=>sh[i]*G[i].canvas.garment_height/2;
let M={},E={},SL=[];
// One clock over both segments. meanIn is short because the hood part times its room curtain against it; the pieces come in once that has dropped.
const RUN=2.6,START=.14,flow=()=>clamp(((q.meanIn*.9+q.meanRun*RUN)/(.9+RUN)-START)/(1-START));
const flight=r=>clamp((flow()-.82*r/Math.max(1,last))/.18);

// One stop per piece as it stamps the mean, then the whole mean, then the two extremes.
const stopAt=v=>v<N?S.at.meanIn[0]+((.1+.82*v/Math.max(1,last))*(1-START)+START)*(.9+RUN):v===N?S.at.mean[0]+.5:S.at.ext[0]+S.at.ext[1]*.92;

S.part('mean',{segs:[['meanIn',.9],['meanRun',RUN],['mean',1],['ext',1.8]],
  rooms:{average:{
    stops:()=>Array.from({length:N+2},(_,v)=>stopAt(v)),
    pitch:()=>Math.max(S.w*.14,90),
    start:N, // lands on the finished mean: the room's point, with the build one drag back
    piece:v=>v<N?order[v]:null,
    label:v=>v===N?`All ${N} averaged, ${cents(mean)}`:`Widest and narrowest shoulder of the ${N}`,
    box:()=>({x:S.w*.25,y:60,w:S.w*.5,h:S.h-120}),
    pick(){const i=S.hit();return i>=0?i:-1},
  }},
  measure(){
    const {w,h,pt}=S;
    // Below the mean, the pieces stand in price order, cheapest first: what went in stays on the page.
    const rows=pt?2:1,cols=Math.ceil(N/rows),pitch=(w-(pt?24:40))/cols,sc=pitch*1.46,rowH=sc*HH+(pt?6:0),rowTop=h-(pt?128:96)-rows*rowH;
    SL=G.map((_,i)=>{const r=rank[i],row=Math.floor(r/cols),inRow=row?N-cols:cols;return {x:w/2+(r%cols-(inRow-1)/2)*pitch,y:rowTop+row*rowH,c:sc}});
    const top=pt?44:h*.075;
    // Full bleed across the width, capped in height so the row keeps clean paper; tracking takes up the slack.
    word.style.letterSpacing='0';fitWidth(word,w*.985);
    const m=document.createElement('canvas').getContext('2d');m.font='100px Six';const cap=m.measureText('H').actualBoundingBoxAscent/100||.82;
    const max=(rowTop-(pt?16:34)-top)/cap;
    if(parseFloat(word.style.fontSize)>max){word.style.fontSize=max+'px';word.style.letterSpacing=(w*.985-word.scrollWidth)/6+'px'}
    word.style.transform=`translate(${w*.0075}px,${top}px)`;
    const wordH=parseFloat(word.style.fontSize)*cap;
    // The hood overlaps the word; the hem clears the row. Phone: the width sets the size, and the word sits above the shoulders.
    const c=pt?w*1.4:(rowTop-10-top)/HH,y=pt?Math.max(top+wordH*.5,(rowTop-8)-c*HH):top;
    M={x:w/2,y,c};
    for(const cv of cvs){cv.style.width=cv.style.height=c+'px';cv.style.transform=`translate3d(${M.x-c/2}px,${M.y-c*CT}px,0)`}
    mp.style.fontSize=c*HH*.2+'px';mp.style.transform=`translate(${M.x-mp.offsetWidth/2}px,${M.y+c*HH*.43}px)`;
    rules.forEach(r=>{r.style.top='46px';r.style.height=h-46-(pt?72:0)+'px'});
    // Shoulders meet at a seam so the gap between the two is the width itself. Phone: one above the other on one axis.
    if(pt){
      const c=Math.min(w*1.1,(h-52-96)/(2*HH)),gap=c*HH;
      E={[iWide]:{x:w/2,y:50,c},[iNarrow]:{x:w/2,y:50+gap,c}};
      ea.style.fontSize=eb.style.fontSize=h*.12+'px';
      ea.style.top=labs[0].style.top=56+'px';eb.style.top=labs[1].style.top=56+gap+'px';
    }else{
      const c=h*.74/HH,aw=half(iWide)*c/1600,an=half(iNarrow)*c/1600,seam=w/2+(aw-an)/2;
      E={[iWide]:{x:seam-aw,y:h*.075,c},[iNarrow]:{x:seam+an,y:h*.075,c}};
      // Numerals fill the paper left of the widest shoulder, ending on its rule.
      const fs=fitWidth(ea,seam-2*aw-20-14);eb.style.fontSize=fs+'px';ea.style.top=eb.style.top=h*.075+'px';
      labs.forEach(l=>l.style.top=h*.075+fs*.92+8+'px');
    }
  },
  pre(){if(q.ext>0)S.stack=['e',i=>i===iNarrow?400:i===iWide?399:100-i];else if(q.meanIn>0)S.stack=['m',i=>200+rank[i]]},
  pose(i,P){
    if(q.meanIn<=0)return P;
    const r=rank[i],f=flight(r),{w,h}=S;
    if(f<=0){ // the hood row falls with its rooms (same curve as hood.js) and uncovers the word
      const e=sss(clamp(q.meanIn*2.4));
      return {...P,y:P.y+e*h,o:e>=1?0:P.o};
    }
    // In from either side on the shared rails, one full look covering the mean, then it shrinks away to its place in the row and leaves its share behind.
    const s=SL[i],side=r%2?-1:1,go=sss(clamp(f/.42)),off=sss(clamp((f-.5)/.5));
    let T={x:f<.5?M.x+side*(w/2+M.c*.42)*(1-go):lerp(M.x,s.x,off),y:lerp(M.y,s.y,off),c:M.c*(s.c/M.c)**off,o:1,l:0,r:1};
    if(q.ext>0){
      if(i!==iWide&&i!==iNarrow){ // the row sinks from the middle out
        const e=sss(clamp((q.ext-Math.abs(r-last/2)*.006)/.1));
        return {...T,y:T.y+e*(h-s.y+8),o:e>=1?0:1};
      }
      const rise=sss(clamp(q.ext/.18)),part=sss(clamp((q.ext-.26)/.4)),e=E[i];
      // Two pieces rise into one mean: the double exposure, then they part.
      T={x:lerp(lerp(s.x,M.x,rise),e.x,part),y:lerp(lerp(s.y,M.y,rise),e.y,part),c:s.c*(M.c/s.c)**rise*(e.c/M.c)**part,o:i===iNarrow?lerp(lerp(1,.5,rise),1,clamp(part*3)):1,l:0,r:1};
    }
    return T;
  },
  draw(){
    const {w,h}=S;
    // the word rises letter by letter from its own baseline, centre first
    const split=sss(clamp((q.ext-.26)/.4)),wo=q.meanIn>.1&&split<1?1:0;vis(word,wo);
    if(wo){
      ls.forEach((l,n)=>{const v=sss(clamp((q.meanIn-.12-Math.abs(n-3)*.05)/.42)),y=(1-v)*116;if(l._y!==y){l._y=y;l.style.transform=y?`translate3d(0,${y}%,0)`:'none'}});
      const d=split*Math.max(w,h);halves[0].style.transform=`translate3d(${-d}px,0,0)`;halves[1].style.transform=`translate3d(${d}px,0,0)`;
    }
    // Two canvases crossfade the last mean into the next while the piece on top still hides the change.
    let k=-1;for(let r=0;r<N;r++)if(flight(r)>.3&&R[r])k=r;
    const mix=k<0?0:clamp((flight(k)-.3)/.2),co=k<0?0:1-ss(clamp((q.ext-.1)/.14)),put=(n,r)=>{if(cvs[n]._k!==r){cvs[n]._k=r;r<0?cxs[n].clearRect(0,0,SZ,SZ):cxs[n].putImageData(R[r],0,0)}};
    put(1,k);put(0,k-1);vis(cvs[1],mix*co);vis(cvs[0],(1-mix)*co);
    // ledger: what just landed and what the mean is now, to the cent
    let a=-1;for(let r=0;r<N;r++)if(flight(r)>=.5)a=r;
    const done=flow()>=.995,kk=done?-2:a;
    if(nMean._k!==kk){nMean._k=kk;if(done)nMean.innerHTML=holdText;else if(a>=0){const g=G[order[a]];nMean.innerHTML=`${a+1} of ${N}, ${g.brand} ${money(g.price)}<br>Mean so far ${cents(runMean[a])}`}}
    vis(nMean,hold(a>=0?1:0,q.ext*6));
    vis(nStat,hold((flow()-.96)*25,q.ext*6));
    const pr=sss(clamp((flow()-.97)*33))*(1-ss(clamp(q.ext/.08)));vis(mp,pr>0?1:0);if(pr>0)mp.firstChild.style.transform=`translate3d(0,${(1-pr)*104}%,0)`;
    const ex=hold((q.ext-.6)*4,q.priceIn*4);
    vis(nExt,ex);
    labs.forEach(l=>{vis(l,ex);l.style.pointerEvents=ex>.5?'auto':'none'});
    for(const el of [ea,eb]){vis(el,ex);if(ex>0)el.firstChild.style.transform=`translate3d(0,${(1-sss(clamp((q.ext-.6)*3.2)))*100}%,0)`}
    // Rules read the live pose, so they stay on the shoulder through the idle drift.
    rules.forEach((el,n)=>{
      vis(el,ex);if(ex<=0)return;
      const i=n<2?iWide:iNarrow,P=S.live[i],x=P.x+(n%2?1:-1)*half(i)*P.c/1600;
      el.style.transform=`translate3d(${x.toFixed(1)}px,0,0) scaleY(${ss(ex).toFixed(4)})`;
    });
  },
  // Only the row is small enough to name a piece at a time.
  hover(){return flow()>=.995&&q.ext<=0&&!S.reduced?S.hit():-1},
});
