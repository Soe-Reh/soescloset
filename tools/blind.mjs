#!/usr/bin/env node
// Blind critic harness. Films any site the same way, then pairs frames side by side with neutral Left/Right labels.
//   node tools/blind.mjs film <url> <dir>
//   node tools/blind.mjs pair <leftDir> <rightDir> <outDir>
// The caller decides which site goes left; nothing written to outDir names either site.
import { createRequire } from 'node:module'
import { mkdirSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
const { chromium } = createRequire('/opt/homebrew/lib/node_modules/')('playwright')

const wait = (p, ms) => p.waitForTimeout(ms)

async function film(url, dir) {
  mkdirSync(dir, { recursive: true })
  const b = await chromium.launch()
  const shot = (p, name) => p.screenshot({ path: `${dir}/${name}.png` })
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const p = await c.newPage()
  await p.goto(url, { waitUntil: 'commit', timeout: 60000 })
  await wait(p, 600); await shot(p, '01-load-0.6s')
  await wait(p, 1900); await shot(p, '02-load-2.5s')
  await wait(p, 3500); await shot(p, '03-settled')
  await p.mouse.move(720, 450)
  // Six frames during one wheel gesture show the motion itself, not only where it lands.
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 170); await shot(p, `04-scroll-motion-${i}`) }
  await wait(p, 1400); await shot(p, '05-scrolled-settled')
  await p.mouse.wheel(0, 900); await wait(p, 1400); await shot(p, '06-scrolled-further')
  await p.mouse.move(520, 480, { steps: 12 }); await wait(p, 180); await shot(p, '07-hover-start')
  await wait(p, 700); await shot(p, '08-hover-settled')
  await p.mouse.click(520, 480); await wait(p, 180); await shot(p, '09-click-motion')
  await wait(p, 1500); await shot(p, '10-click-settled')
  await c.close()
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const q = await m.newPage()
  await q.goto(url, { waitUntil: 'commit', timeout: 60000 })
  await wait(q, 6000); await shot(q, '11-phone-settled')
  await q.evaluate(() => window.scrollBy(0, 700)); await wait(q, 1400); await shot(q, '12-phone-scrolled')
  await b.close()
}

async function pair(left, right, out) {
  mkdirSync(out, { recursive: true })
  const b = await chromium.launch()
  const p = await (await b.newContext({ viewport: { width: 1800, height: 700 } })).newPage()
  const url = f => 'file://' + resolve(f)
  for (const f of readdirSync(left).filter(n => n.endsWith('.png') && existsSync(`${right}/${n}`))) {
    await p.goto('about:blank')
    await p.setContent(`<body style="margin:0;background:#777;display:flex;gap:8px;padding:34px 8px 8px;font:600 18px Arial;color:#fff;width:max-content">
      <figure style="margin:0"><figcaption style="position:absolute;top:8px">LEFT</figcaption><img style="height:640px;display:block" src="data:image/png;base64,${(await import('node:fs')).readFileSync(`${left}/${f}`).toString('base64')}"></figure>
      <figure style="margin:0"><figcaption style="position:absolute;top:8px">RIGHT</figcaption><img style="height:640px;display:block" src="data:image/png;base64,${(await import('node:fs')).readFileSync(`${right}/${f}`).toString('base64')}"></figure></body>`)
    await p.locator('body').screenshot({ path: `${out}/${f}` })
  }
  await b.close()
}

const [cmd, ...a] = process.argv.slice(2)
if (cmd === 'film' && a.length === 2) await film(a[0], a[1])
else if (cmd === 'pair' && a.length === 3) {
  await pair(...a)
  const n = readdirSync(a[2]).filter(f => statSync(`${a[2]}/${f}`).size > 1000).length
  if (!n) throw new Error('pair produced no images')
  console.log(`${n} pairs -> ${a[2]}`)
} else { console.error('usage: film <url> <dir> | pair <leftDir> <rightDir> <outDir>'); process.exit(2) }
