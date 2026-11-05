// Resolve selection against the raw feed; download the full-res original; write pipeline/items.json
import fs from 'node:fs'; import sharp from 'sharp';
const sel = JSON.parse(fs.readFileSync('selection.json'));
fs.mkdirSync('../assets/raw',{recursive:true});
// these stores put a season or merch category in `vendor`, so name the brand from the store itself
const BRAND={"stussy.com":"Stüssy","madhappy.com":"Madhappy","representclo.com":"Represent"};
const items=[]; const metaCache={};
const fetchRaw = async (src, out) => {
  if (fs.existsSync(out)) return;
  const r = await fetch(src); if(!r.ok) throw new Error(src+' '+r.status);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  await new Promise(r=>setTimeout(r,300));
};
for (const s of sel) {
  // photos the user saved by hand: no feed and no network, the original is copied from the inbox as is
  if (s.local) {
    const d = s.local, out = `../assets/raw/${s.slug}.${d.file.split('.').pop().toLowerCase()}`;
    if (!fs.existsSync(out)) fs.copyFileSync('../'+d.file, out);
    const m = await sharp(out).metadata();
    items.push({id:s.slug,store:s.store,brand:d.brand,name:d.name,price:d.price,compare_at_price:null,currency:d.currency,feed_variant_keys:[],option:d.option,url:d.url,src:d.file,raw:out,w:m.width,h:m.height,img_variant_ids:0,type:d.type,tags:[],price_note:d.price_note});
    continue;
  }
  // stores without a products.json feed: fields frozen in selection.json, read by hand from the store's own page
  if (s.direct) {
    const d = s.direct, out = `../assets/raw/${s.slug}.${new URL(d.src).pathname.split('.').pop().toLowerCase()}`;
    await fetchRaw(d.src, out);
    const m = await sharp(out).metadata();
    items.push({id:s.slug,store:s.store,brand:d.brand,name:d.name,price:d.price,compare_at_price:null,currency:d.currency,feed_variant_keys:[],option:d.option,url:d.url,src:d.src,raw:out,w:m.width,h:m.height,img_variant_ids:0,type:d.type,tags:[],...(d.price_note&&{price_note:d.price_note})});
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(`feeds/${s.store}.json`)).find(p=>p.handle===s.handle);
  if(!raw) throw new Error(`${s.handle} no longer in ${s.store} feed`);
  const image = raw.images.find(i=>i.src===s.src); if(!image) throw new Error(`${s.slug}: image gone from feed`);
  // price: the variant tied to this image if the feed says so, else the first available variant
  const v = raw.variants.find(v=>image.variant_ids?.includes(v.id)) ?? raw.variants.find(v=>v.available) ?? raw.variants[0];
  metaCache[s.store] ??= await fetch(`https://${s.store}/meta.json`).then(r=>r.json()).catch(()=>({}));
  const ext = new URL(image.src).pathname.split('.').pop().toLowerCase();
  const out = `../assets/raw/${s.slug}.${ext}`;
  await fetchRaw(image.src, out);
  const m = await sharp(out).metadata();
  // a sale in the feed never becomes the price: the set compares list prices
  const onSale = Number(v.compare_at_price) > Number(v.price);
  items.push({id:s.slug,store:s.store,brand:BRAND[s.store]??raw.vendor,name:raw.title,price:onSale?v.compare_at_price:v.price,compare_at_price:onSale?null:v.compare_at_price??null,currency:metaCache[s.store].currency??null,feed_variant_keys:Object.keys(v).filter(k=>/curr/i.test(k)),option:s.option??v.option1,url:`https://${s.store}/products/${raw.handle}`,src:image.src,raw:out,w:m.width,h:m.height,img_variant_ids:image.variant_ids?.length||0,type:raw.product_type,tags:(Array.isArray(raw.tags)?raw.tags:String(raw.tags).split(',')).filter(t=>/zip|pullover|kid|youth/i.test(t))});
}
for(const i of items) if(i.h<1000) i.low_res=true; // too soft for huge scale or macro crops; never upscaled with AI
fs.writeFileSync('items.json.tmp',JSON.stringify(items,null,1));fs.renameSync('items.json.tmp','items.json');
for(const i of items) console.log(i.id.padEnd(28),i.brand.padEnd(26),i.name.slice(0,40).padEnd(40),i.price,i.currency,i.option,i.w+'x'+i.h,i.img_variant_ids,i.tags.join(','));
