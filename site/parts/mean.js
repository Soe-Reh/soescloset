import {S,G,clamp,ss,sss,lerp,vis,money,add,hex,css,mixc,CT,HH} from '../core.js';
const {q,N,last}=S;
// The story, one mover stop each: outlines, the blended shape, its price, the nearest and furthest piece, then three findings.
const prices=G.map(g=>g.price),sorted=[...prices].sort((a,b)=>a-b),lo=sorted[0],hi=sorted[N-1];
const mean=prices.reduce((a,b)=>a+b,0)/N,median=N%2?sorted[N>>1]:(sorted[N/2-1]+sorted[N/2])/2;
const rank=[];G.map((_,i)=>i).sort((a,b)=>prices[a]-prices[b]||a-b).forEach((i,r)=>rank[i]=r);
const fabric=g=>(g.material||'').toLowerCase(),dear=G[prices.indexOf(hi)];
const twins=G.filter(g=>fabric(g)===fabric(dear)),twin=twins.reduce((a,b)=>b.price<a.price?b:a,dear);
const usd=n=>money(Math.round(n));
// Same log scale and ends as the Wall: price is the only data colour.
const tone=p=>css(mixc(hex('#b3b3ae'),hex('#111111'),hi>lo?Math.log(p/lo)/Math.log(hi/lo):1));

const thumb=(g,k)=>`<a class="athumb" href="#/piece/${g.id}" data-piece="${g.id}" aria-label="${k}: ${g.brand} ${g.short}, ${money(g.price)}"><img src="${g.image_600}" alt="" decoding="async"><small>${k}</small>${g.brand}<br>${money(g.price)}</a>`;
const FINDS=[
  [hi/lo,v=>v.toFixed(1)+'<small>x</small>',`The gap between the cheapest (${money(lo)}) and the dearest (${money(hi)}).`],
  [twin.price,usd,`Buys the same ${fabric(dear)} as the ${money(hi)} ${dear.brand}. ${twins.length} of the ${N} are ${fabric(dear)}.`],
  [median,usd,`The typical price, the median: half the set costs less, half costs more.`],
];
const STEPS=[
  `Here are all ${N} hoodies, traced and stacked on top of each other.`,
  `Blend them and you get the <b>average premium hoodie</b>: the shape at least half of them share.`,
  `It would cost <b>${usd(mean)}</b>, yet most of the set costs less: a few expensive pieces pull the average up.<span class="adots" aria-hidden="true"></span>`,
  '', // filled from average.json below
  `<span class="afinds">${FINDS.map(f=>`<span class="afind"><b class="six">${f[1](f[0])}</b><span>${f[2]}</span></span>`).join('')}</span>`,
];
const LABELS=['Every outline stacked','The average shape',`It would cost ${usd(mean)}`,'Closest and furthest','Three findings'];
const K=STEPS.length;

// The figure stands in a garment's own frame (the images are traced on the same 1600 canvas), so a landing piece covers its own outline exactly.
const fig=document.createElement('div');fig.id='afig';fig.setAttribute('aria-hidden','true');
fig.innerHTML='<img alt="" decoding="async"><img alt="" decoding="async">';document.getElementById('gs').append(fig);
const [olImg,meanImg]=fig.children;
const priceEl=add(`<div class="big six" id="aprice" aria-hidden="true"><i>${usd(mean)}</i></div>`);
const text=add(`<div id="atext">${STEPS.map(s=>`<p class="astep">${s}</p>`).join('')}</div>`);
const steps=[...text.children],nums=[...text.querySelectorAll('.afind b')],dots=text.querySelector('.adots');let links=[];
// Prebuilt by tools/build-average.mjs (a pixel distance to the mean). Not awaited at the top: rooms.js routes as soon as it loads, and must find this room.
fetch('average.json').then(r=>r.json()).then(a=>{
  const near=G.find(g=>g.id===a.closest),far=G.find(g=>g.id===a.furthest);if(!near||!far)throw new Error('unknown piece');
  steps[3].innerHTML=`Closest to the average: <b>${near.brand}</b>, ${money(near.price)}. Furthest from it: <b>${far.brand}</b>, ${money(far.price)}.<span class="athumbs">${thumb(near,'Closest')}${thumb(far,'Furthest')}</span>`;
  links=[...steps[3].querySelectorAll('a')];S.wake();
}).catch(e=>{console.error('average.json',e);steps[3].textContent='Some pieces sit close to the average shape, others far from it.'});

// A dot per piece on a plain price line, stacked where they crowd: the pile on the left is "most of the set costs less".
const ticks=[...G].sort((a,b)=>a.price-b.price);
dots.innerHTML=ticks.map(g=>`<i style="background:${tone(g.price)}"></i>`).join('')+`<em style="left:${(mean-lo)/(hi-lo)*100}%">Average ${usd(mean)}</em><small>${money(lo)}</small><small>${money(hi)}</small>`;
const dotEls=[...dots.querySelectorAll('i')];

let F={x:0,y:0,c:1},introT0=-1,countT0=-1,s=0,busy=false;
const FLY=520,FADE=260,GAP=90,INTRO=(N-1)*GAP+FLY+FADE;

S.part('mean',{segs:[['meanIn',.9],['avg',K]], // meanIn keeps its name and length: hood.js times its exit against it
  rooms:{average:{
    stops:()=>Array.from({length:K},(_,k)=>S.at.avg[0]+k+.5),
    pitch:()=>Math.max(S.w*.14,90),
    start:0,
    piece:()=>null,
    label:k=>LABELS[k],
    box:()=>({x:F.x-F.c*.36,y:F.y,w:F.c*.72,h:F.c*HH}),
    pick:()=>-1,
  }},
  measure(){
    const {w,h,pt}=S;
    if(pt){
      // The traced stack runs to .9 of the canvas, past the average's hem, so the text starts below the lowest outline.
      const c=Math.min(w*1.3,h*.5/HH,(w-32)/.7);F={x:w/2,y:78,c};const t=F.y-c*CT+c*.93+8;
      Object.assign(text.style,{left:'16px',width:w-32+'px',top:t+'px',height:Math.max(120,h-t-76)+'px'});
    }else{
      const top=Math.max(76,h*.1),c=Math.min((h-top-124)/HH,(h-top-56)/.88),x=Math.max(w*.28,c*.36+24),L=x+c*.36+40;F={x,y:top,c};
      Object.assign(text.style,{left:L+'px',width:Math.min(580,w-L-48)+'px',top:top+'px',height:c*HH+'px'});
    }
    Object.assign(fig.style,{width:F.c+'px',height:F.c+'px',transform:`translate3d(${F.x-F.c/2}px,${F.y-F.c*CT}px,0)`});
    priceEl.style.fontSize=F.c*HH*.3+'px';priceEl.style.transform=`translate(${F.x-priceEl.offsetWidth/2}px,${F.y+F.c*HH*.32}px)`;
    // Dots pile up where their 12px discs would overlap.
    const W=dots.offsetWidth||text.offsetWidth,tops=[];
    dotEls.forEach((d,n)=>{const x=(ticks[n].price-lo)/(hi-lo)*(W-12);let k=0;while(tops[k]!==undefined&&x-tops[k]<13)k++;tops[k]=x;d.style.transform=`translate(${x}px,${-k*13}px)`});
  },
  pre(){
    const here=S.room==='average';
    s=clamp(q.avg*K-.5,0,K-1);
    if(!here){introT0=-1;countT0=-1}
    else{
      if(introT0<0&&q.meanIn>=1&&s<.5)introT0=S.now;
      if(s<3)countT0=-1;else if(countT0<0&&s>3.5)countT0=S.now;
    }
    if(q.meanIn>0&&!olImg.src){olImg.src='img/average-outline.webp';meanImg.src='img/average-mean.webp'}
    if(q.meanIn>0)S.stack=['a',i=>200+rank[i]];
  },
  pose(i,P){
    if(q.meanIn<=0)return P;
    const t=introT0<0?-1:S.now-introT0-rank[i]*GAP;
    if(t<0){ // the hood row falls with its rooms (same curve as hood.js), and a piece not yet sent stays hidden
      const e=sss(clamp(q.meanIn*2.4));
      return {...P,y:P.y+e*S.h,o:introT0<0&&e<1?P.o:0};
    }
    // In from either side at the figure's size, onto the figure, then it fades and leaves its outline behind.
    const k=sss(clamp(t/FLY)),side=S.pt&&rank[i]%2?1:-1; // on a laptop all come from the left, so none crosses the caption on the right
    return {x:F.x+side*(S.w/2+F.c*.42)*(1-k),y:F.y,c:F.c,o:(1-clamp((t-FLY)/FADE))*(1-clamp(s*2)),l:0,r:1};
  },
  draw(){
    const on=hold_(q.meanIn>=1?1:0);
    const it=introT0<0?(S.room==='average'?0:INTRO):S.now-introT0;
    let landed=0;for(let r=0;r<N;r++)landed+=clamp((it-r*GAP-FLY)/FADE);
    busy=S.room==='average'&&(it<INTRO||countT0>=0&&S.now-countT0<(K-1)*160+1000);
    vis(fig,on);
    // a visible child shows through a hidden parent, so each image carries the room's own fade
    vis(olImg,on*(.35+.65*landed/N)*(1-ss(clamp(s)))); // the stack is drawn from the first frame and darkens as each piece lands on it, so step 1 never reads empty
    vis(meanImg,on*ss(clamp(s))*(1-.75*ss(clamp(s-3))));
    const pr=sss(clamp((s-1.4)*2.5))*(1-ss(clamp((s-2.5)*2)));
    vis(priceEl,on*(pr>0?1:0));if(pr>0)priceEl.firstChild.style.transform=`translate3d(0,${(1-pr)*104}%,0)`;
    vis(text,on);
    steps.forEach((el,k)=>{
      const o=on*clamp(1-Math.abs(s-k)*2.2),y=(k-s)*28;vis(el,o);
      if(o>0&&el._y!==y){el._y=y;el.style.transform=y?`translate3d(0,${y.toFixed(1)}px,0)`:'none'}
    });
    links.forEach(a=>a.style.pointerEvents=on*clamp(1-Math.abs(s-3)*2.2)>.5?'auto':'none');
    const ct=S.room!=='average'?1e9:countT0<0?0:S.now-countT0;
    nums.forEach((el,k)=>{const [v,f]=FINDS[k],e=1-(1-clamp((ct-k*160)/1000))**3,txt=f(k?v*e:1+(v-1)*e);if(el._t!==txt){el._t=txt;el.innerHTML=txt}});
  },
  busy:()=>busy,
  hover:()=>-1,
});
// Gone once Price takes over the stage.
function hold_(o){return o*(1-clamp(q.priceIn*6))}
