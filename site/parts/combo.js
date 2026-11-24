// A searchable pick-one list: a trigger showing the current choice, a popover with a search box and grouped options (a bottom sheet on a phone).
// combo({label, placeholder, groups:[{label, items:[{value, title, sub, meta, thumb, search}]}], onPick(value)}) -> {el, set(value), close()}
// Keys: Enter, Space or ArrowDown on the trigger opens; typing filters; arrows move; Enter picks; Esc closes and gives focus back.
let uid=0;
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const CHEV='<svg class="cb-chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M.5.5l4.5 4.5 4.5-4.5" fill="none" stroke="currentColor"/></svg>';
const CHECK='<svg class="cb-check" viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5.2l3.4 3.3L11 1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const sheet=matchMedia('(max-width:760px)'),fine=matchMedia('(hover:hover) and (pointer:fine)');

export function combo({label,placeholder='Choose',groups,onPick}){
  const id='cb'+(++uid),all=[];let value=null,act=-1,shown=[];
  const el=document.createElement('button');el.type='button';el.className='cb-trig';
  el.setAttribute('aria-haspopup','listbox');el.setAttribute('aria-expanded','false');el.setAttribute('aria-controls',id+'-list');el.setAttribute('aria-label',label);
  const scrim=document.createElement('div');scrim.className='cb-scrim';
  const pop=document.createElement('div');pop.className='cb-pop';pop.tabIndex=-1;
  pop.innerHTML=`<div class="cb-search"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor"/><path d="M11 11l4 4" stroke="currentColor"/></svg><input type="text" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" aria-label="${esc(label)}: search" placeholder="Search brand, name or price" autocomplete="off" spellcheck="false"></div>`+
    `<div class="cb-list" role="listbox" id="${id}-list" aria-label="${esc(label)}">${groups.map((g,k)=>`<div role="group" aria-labelledby="${id}-g${k}"><div class="cb-gl" id="${id}-g${k}" role="presentation">${esc(g.label)}</div>${g.items.map(it=>{const n=all.length;all.push({...it,n,key:(it.search||[it.title,it.sub,it.meta].join(' ')).toLowerCase()});
      return `<div class="cb-opt" role="option" id="${id}-o${n}" aria-selected="false" data-n="${n}">${row(it)}${CHECK}</div>`}).join('')}</div>`).join('')}<p class="cb-none" hidden>No hoodie matches.</p></div>`;
  document.body.append(scrim,pop);
  const input=pop.querySelector('input'),list=pop.querySelector('.cb-list'),opts=[...list.querySelectorAll('.cb-opt')],grps=[...list.children].filter(e=>e.getAttribute('role')==='group'),none=list.querySelector('.cb-none');
  function row(it){return `<span class="cb-th"${it.thumb?` style="background-image:url('${esc(it.thumb)}')"`:''}></span><span class="cb-tx"><b>${esc(it.title)}</b>${it.sub?`<small>${esc(it.sub)}</small>`:''}</span>${it.meta?`<span class="cb-meta">${esc(it.meta)}</span>`:''}`}
  const isOpen=()=>pop.classList.contains('open');

  function set(v){
    value=v;const it=all.find(a=>a.value===v);
    el.innerHTML=(it?`<span class="cb-th" style="background-image:url('${esc(it.thumb)}')"></span><span class="cb-cur">${esc(it.title)}</span>${it.meta?`<span class="cb-meta">${esc(it.meta)}</span>`:''}`:`<span class="cb-cur">${esc(placeholder)}</span>`)+CHEV;
    for(const o of opts)o.setAttribute('aria-selected',all[+o.dataset.n].value===v);
    el.setAttribute('aria-label',it?`${label}. Now: ${[it.title,it.sub,it.meta].filter(Boolean).join(', ')}`:label);
  }
  function filter(){
    const q=input.value.trim().toLowerCase().replace(/^\$/,''),words=q.split(/\s+/).filter(Boolean);
    shown=[];
    for(const o of opts){const ok=words.every(w=>all[+o.dataset.n].key.includes(w));o.hidden=!ok;if(ok)shown.push(o)}
    for(const g of grps)g.hidden=!g.querySelector('.cb-opt:not([hidden])');
    none.hidden=shown.length>0;
    move(shown.length?Math.max(0,shown.findIndex(o=>o.getAttribute('aria-selected')==='true'&&!q)):-1);
  }
  function move(k){
    act=shown.length?Math.max(0,Math.min(shown.length-1,k)):-1;
    for(const o of opts)o.classList.toggle('act',o===shown[act]);
    const o=shown[act];
    if(o){input.setAttribute('aria-activedescendant',o.id);const r=o.offsetTop-list.offsetTop,top=list.scrollTop;if(r<top+28)list.scrollTop=r-28;else if(r+o.offsetHeight>top+list.clientHeight)list.scrollTop=r+o.offsetHeight-list.clientHeight}
    else input.removeAttribute('aria-activedescendant');
  }
  function place(){
    if(sheet.matches){pop.style.cssText='';return}
    const b=el.getBoundingClientRect(),w=Math.min(340,innerWidth-16),up=b.top>innerHeight-b.bottom;
    const room=(up?b.top:innerHeight-b.bottom)-16;
    pop.style.cssText=`left:${Math.max(8,Math.min(b.left,innerWidth-w-8))}px;width:${w}px;${up?`bottom:${innerHeight-b.top+6}px`:`top:${b.bottom+6}px`};--cbh:${Math.max(160,Math.min(440,room))}px`;
    pop.dataset.side=up?'up':'down';
  }
  function open(typed=''){
    if(isOpen())return;
    place();input.value=typed;filter();
    pop.classList.add('open');scrim.classList.add('open');
    el.setAttribute('aria-expanded','true');input.setAttribute('aria-expanded','true');
    // A phone's keyboard would cover the sheet, so a tap opens the list; a keyboard or a mouse goes straight to the search.
    if(fine.matches||typed||!sheet.matches)input.focus({preventScroll:true});else pop.focus({preventScroll:true});
    move(act);
  }
  function close(focus=true){
    if(!isOpen())return;
    pop.classList.remove('open');scrim.classList.remove('open');
    el.setAttribute('aria-expanded','false');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
    if(focus)el.focus({preventScroll:true});
  }
  function pick(o){if(!o)return;const v=all[+o.dataset.n].value;set(v);close();onPick?.(v)}

  el.addEventListener('click',()=>isOpen()?close():open());
  el.addEventListener('keydown',e=>{
    if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();open()}
    else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopPropagation();open(e.key)}
  });
  input.addEventListener('input',filter);
  pop.addEventListener('keydown',e=>{
    const k=e.key;e.stopPropagation(); // the room's own keys (arrows step the row) stay out of the list
    if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();move(act+(k==='ArrowDown'?1:-1))}
    else if(k==='Home'&&e.target!==input||k==='PageUp'){e.preventDefault();move(0)}
    else if(k==='End'&&e.target!==input||k==='PageDown'){e.preventDefault();move(shown.length-1)}
    else if(k==='Enter'){e.preventDefault();pick(shown[act])}
    else if(k==='Escape'){e.preventDefault();close()}
    else if(k==='Tab')close(false);
    else if(e.target!==input&&k.length===1&&!e.ctrlKey&&!e.metaKey){input.focus()}
  });
  list.addEventListener('pointermove',e=>{const o=e.target.closest('.cb-opt');if(o&&o!==shown[act])move(shown.indexOf(o))});
  list.addEventListener('click',e=>pick(e.target.closest('.cb-opt')));
  // The page turns on the wheel; inside the list the wheel scrolls the list.
  pop.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  pop.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
  scrim.addEventListener('click',()=>close(false));
  addEventListener('resize',()=>isOpen()&&place());
  addEventListener('hashchange',()=>close(false));
  set(null);
  return {el,set,close:()=>close(false)};
}
