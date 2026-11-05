import fs from 'node:fs';
const res = {};
for (const f of fs.readdirSync('feeds')) {
  const store = f.replace('.json','');
  const prods = JSON.parse(fs.readFileSync('feeds/'+f));
  const seen = new Set();
  const c = prods.filter(p => {
    const t = (p.title+' '+p.product_type+' '+(Array.isArray(p.tags)?p.tags.join(' '):p.tags)).toLowerCase();
    const title = (p.title+' '+p.product_type).toLowerCase();
    if (!/hood/.test(title)) return false;
    if (/zip|snap|button|kid|youth|toddler|baby|infant|jacket|vest|dress|anorak|parka|coat|shirt jacket|hooded tee|bundle|gift|short|pant|\bset\b|boys|girls/.test(title)) return false;
    if (!p.variants?.some(v=>v.available)) return false;
    return p.images?.length;
  });
  res[store] = c.map(p=>({store,id:p.id,handle:p.handle,title:p.title,type:p.product_type,vendor:p.vendor,price:p.variants[0].price,images:p.images.map(i=>i.src)}));
  console.log(store,c.length);
}
fs.writeFileSync('candidates.json',JSON.stringify(res,null,1));
