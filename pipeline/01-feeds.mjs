// Fetch public Shopify feeds one store at a time, keep pullover-hoodie candidates.
import fs from 'node:fs';
const stores = process.argv.slice(2).length ? process.argv.slice(2) : 'reigningchamp.com aimeleondore.com stussy.com kith.com fearofgod.com representclo.com colebuxton.com noahny.com sportyandrich.com aloyoga.com awakenyclothing.com museumofpeaceandquiet.com madhappy.com cotopaxi.com freshcleantees.com losangelesapparel.net'.split(' ');
const out = 'feeds'; fs.mkdirSync(out, {recursive:true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const s of stores) {
  const products = [];
  try {
    for (let page = 1; page <= 12; page++) {
      const r = await fetch(`https://${s}/products.json?limit=250&page=${page}`, {headers:{accept:'application/json'}, signal: AbortSignal.timeout(30000)});
      if (!r.ok) { console.log(s, 'page', page, 'HTTP', r.status); break; }
      const j = await r.json();
      if (!j.products?.length) break;
      products.push(...j.products);
      await sleep(800);
    }
  } catch (e) { console.log(s, 'error', e.message); }
  fs.writeFileSync(`${out}/${s}.json`, JSON.stringify(products));
  console.log(s, products.length);
}
