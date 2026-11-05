// Write site/data.json and research/contact.png from what the pipeline read and measured.
import fs from 'node:fs'; import {sheet} from './lib-sheet.mjs';
const items=JSON.parse(fs.readFileSync('items.json')), m=JSON.parse(fs.readFileSync('measures.json'));
const SIZE=/^(xxs|xs|s|m|l|xl|xxl|\d+|small|medium|large|x-?large|one size)$/i;
const MOUTH=0.3, ON_DARK=1.6;
const crown=q=>q.hood_top_width_ratio>0.7?'flat':q.hood_crown_ratio<0.46?'peaked':'domed'; // measured from the silhouette
const lum=h=>{const [r,g,b]=[1,3,5].map(k=>{const v=parseInt(h.slice(k,k+2),16)/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b};
const contrast=h=>(lum(h)+0.05)/(lum('#0e0e0e')+0.05);
// The store's own product notes, from the saved feed. A line reading "Material: ..." or a bare percentage is the material; style and colour are already fields.
const feeds={},notes=it=>{
  const f=feeds[it.store]??=(()=>{try{const j=JSON.parse(fs.readFileSync(`feeds/${it.store}.json`));return j.products||j}catch{return []}})();
  const html=f.find(p=>p.handle===it.url?.split('/products/')[1]?.split('?')[0])?.body_html||'';
  const lines=html.split(/<table|<!-- split -->/)[0].replace(/<\/(p|div|li)>|<br[^>]*>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').split('\n').map(l=>l.replace(/^\s*•?\s*/,'').replace(/\s+/g,' ').trim()).filter(l=>l&&!/^(Style|Color):/.test(l));
  const isMat=l=>/^Material:/.test(l)||/^\d+% /.test(l);
  return {material:lines.find(isMat)?.replace(/^Material:\s*/,'')||null,details:lines.filter(l=>!isMat(l))};
};
const data=items.map(it=>{const q=m[it.id];return{
  ...notes(it),
  id:it.id, brand:it.brand, name:it.name,
  colorway:it.option&&!SIZE.test(it.option)?it.option:null, // feed option, only when it is a colour
  price:it.price, compare_at_price:it.compare_at_price, currency:it.currency, ...(it.price_note&&{price_note:it.price_note}), ...(it.low_res&&{low_res:true}),
  source_store:it.store, url:it.url, image_source:it.src,
  raw:it.raw.replace('../',''), image:`img/${it.id}.webp`, image_600:`img/${it.id}-600.webp`,
  image_shadow:`img/${it.id}-shadow.webp`,
  dominant_hex:q.dominant_hex, source_hex:q.source_hex, shoulder_width_ratio:q.shoulder_width_ratio, body_length_ratio:q.body_length_ratio, hood_height_ratio:q.hood_height_ratio, sleeve_drop:q.sleeve_drop,
  hood_top_width_ratio:q.hood_top_width_ratio, hood_crown_ratio:q.hood_crown_ratio, hood_mouth_dark:q.hood_mouth_dark,
  hood_crown:crown(q), hood_mouth:q.hood_mouth_dark>=MOUTH?'open':'closed', hood_form:crown(q)+'-'+(q.hood_mouth_dark>=MOUTH?'open':'closed'),
  on_dark:contrast(q.dominant_hex)>=ON_DARK, // false: the silhouette dissolves on #0e0e0e, use a lighter ground or the shadow layer
  fill_ratio:q.fill_ratio,
  canvas:{width:1600,height:1600,hood_top_y:100,hem_y:q.hem_y,bottom_y:q.bottom_y,garment_height:q.garment_height}
}});
// Sequence: closed hoods then open mouths, domed then peaked crowns, so neighbours share a hood rhythm; by hue family inside each.
const hue=h=>{const [r,g,b]=[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255),M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m;if(d<0.08)return 400;let x=M===r?((g-b)/d+6)%6:M===g?(b-r)/d+2:(r-g)/d+4;return x*60};
data.sort((a,b)=>a.hood_mouth.localeCompare(b.hood_mouth)||a.hood_crown.localeCompare(b.hood_crown)||hue(a.dominant_hex)-hue(b.dominant_hex));
fs.writeFileSync('../site/data.json.tmp',JSON.stringify(data,null,2));fs.renameSync('../site/data.json.tmp','../site/data.json');
await sheet(data.map(d=>`../site/${d.image_600}`),'../research/contact.png',{bg:'#f3f1ec',cols:7,cell:500,pad:24,under:data.map(d=>`../site/${d.image_shadow}`)});
console.log(data.length,'items',new Set(data.map(d=>d.brand)).size,'brands');
