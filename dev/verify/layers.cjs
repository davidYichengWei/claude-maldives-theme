#!/usr/bin/env node
// Layer audit: finds every pair of moving things in the scene that overlap on
// screen and checks that they are painted in the right order, that two things
// at one depth do not run through each other, that a see-through creature
// does not wash its colour into another, and that nothing jumps.
//
//   node verify/layers.cjs sweep <scene.svg> <out-dir> [from] [to] [every]
//     one scene, every animation seeked through [from, to] seconds: the
//     wildlife's long rounds, which a short film never reaches
//   node verify/layers.cjs film <out-dir> <scenario-dir>...
//     the scenes a film handed the app, between and across its redraws
//
// The work is shared out over LAYERS_JOBS browsers (default: half the CPUs,
// at most 8): a sweep by stretches of time, a film run by scenario. Each
// worker needs a browser of its own: pages of one browser render one at a
// time and run no faster than a single page.
//
// Every object is found by markup the scene already has (no markup is added
// for the audit). Its layer is sky, surface or under (seen through the
// water); its depth is the screen height of where it meets the water or the
// ground, lower on screen being nearer. The rules:
//   - a surface thing is painted over any creature under the water;
//   - within one layer, the nearer is painted over the farther;
//   - within one layer, two things whose depths are within SAME_DEPTH px do
//     not overlap at all (they would pass through each other);
//   - under the water, the one painted on top is not see-through where it
//     covers the other (their colours would mix);
//   - nothing moves faster than TOP_SPEED px a second.
// A pair flagged by boxes is confirmed by painting each object alone and
// counting the pixels both cover, so a loose box never makes a fault.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const W = 1600
const H = 1000
const SAME_DEPTH = 12
const TOP_SPEED = 300
const MIN_PIXELS = 25
const SEE_THROUGH = 0.9
const JOBS = Math.max(1, Number(process.env.LAYERS_JOBS) || Math.min(8, Math.floor(require('os').cpus().length / 2)))

// The swimmers' lanes, by the height they cross at.
// Swimmer lanes by depth: name, and whether it shows at the surface (a fin or
// back out of the water) or swims under it.
const LANES = { 458: ['whale shark', 'surface'], 542: ['fin', 'surface'], 712: ['manta', 'under'], 740: ['shoal A', 'under'], 812: ['turtle', 'under'], 850: ['shoal B', 'under'] }

// Runs in the page: every object now on screen, with its layer, depth, the
// place it is painted in, how see-through it is and the boxes of its parts.
function census() {
  const LANES = window.LANES || {}
  const all = [...document.querySelectorAll('svg *')]
  const order = new Map(all.map((el, i) => [el, i]))
  const opacityOf = el => {
    let o = 1
    for (let n = el; n && n.nodeType === 1 && n.tagName !== 'svg'; n = n.parentNode) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0
      o *= Number(cs.opacity)
    }
    return o
  }
  const SHAPES = 'path, ellipse, circle, rect, line, polygon, use'
  // The shapes an object paints, the object itself included when it is one
  // (a `<use>` clone has no children of its own).
  const leavesOf = root => [root, ...root.querySelectorAll(SHAPES)].filter(l => l.matches(SHAPES))
    .filter(l => !l.closest('.wake, .shade, .sh, .foam, defs') && !/\b(wake|bwk|glow|shade|sh|foam)\b/.test(l.getAttribute('class') || ''))
    .map(l => ({ o: opacityOf(l), r: l.getBoundingClientRect() }))
    .filter(p => p.o > 0.05 && p.r.width * p.r.height > 1)
    .map(p => ({ o: p.o, b: [p.r.left, p.r.top, p.r.right, p.r.bottom].map(v => Math.round(v * 10) / 10) }))
  const out = []
  const add = (name, layer, root, depth, extra = {}) => {
    if (!root) return
    const parts = leavesOf(root)
    if (parts.length === 0) return
    const box = [Math.min(...parts.map(p => p.b[0])), Math.min(...parts.map(p => p.b[1])), Math.max(...parts.map(p => p.b[2])), Math.max(...parts.map(p => p.b[3]))]
    out.push({ name, layer, depth: Math.round(depth * 10) / 10, order: order.get(root), last: Math.max(order.get(root), ...[...root.querySelectorAll('*')].map(c => order.get(c) ?? 0)), opacity: Math.max(...parts.map(p => p.o)), parts: parts.map(p => p.b), box, ...extra })
  }
  const yOf = el => el.getScreenCTM().f
  // Under the water.
  for (const g of document.querySelectorAll('g.swR, g.swL')) {
    const lane = Number(/translate\(0 ([\d.]+)\)/.exec(g.firstElementChild.getAttribute('transform'))?.[1])
    const [name, layer] = LANES[lane] ?? [`swimmer ${lane}`, 'under']
    add(name, layer, g, lane)
  }
  document.querySelectorAll('use[href="#pup"]').forEach((u, i) => add(`pup ${i + 1}`, 'surface', u, yOf(u)))
  document.querySelectorAll('.fsh0, .fsh1').forEach((g, i) => add(`villa shoal ${i + 1}`, 'under', g, g.getBoundingClientRect().bottom))
  document.querySelectorAll('.lpX').forEach((g, i) => add(`dolphin ${i + 1}`, 'under', g, g.getBoundingClientRect().bottom))
  // On the surface and ashore.
  // A boat is one object: its `v<n>` wrapper holds the hull, the copy shown
  // while it turns about and, aboard the lead boat, the mascot riding it.
  for (const root of document.querySelectorAll('svg g[id^="v"]')) {
    const hull = root.querySelector('g.boat')
    if (!hull) continue
    add(`${root.querySelector('use[href="#cH"]') ? 'dinghy' : root.querySelector('use[href="#sH"]') ? 'fishing boat' : 'lead boat'} ${root.getAttribute('data-b') ?? ''}`.trim(), 'surface', root, yOf(hull))
  }
  const clay = [...document.querySelectorAll('path[fill="#c97b5e"]')].filter(p => opacityOf(p) > 0.05 && !p.closest('g[id^="v"]'))
  if (clay.length) {
    const root = clay[0].closest('.lpos, g[clip-path], g') || clay[0]
    add('clawd', 'surface', root, Math.max(...clay.map(p => p.getBoundingClientRect().bottom)) + 8)
  }
  add('crab', 'surface', document.querySelector('.crx'), document.querySelector('.crx') ? yOf(document.querySelector('.crx')) : 0)
  add('hermit crab', 'surface', document.querySelector('.hmx'), document.querySelector('.hmx') ? yOf(document.querySelector('.hmx')) : 0)
  for (const [copy, sel] of [['near', '.hzn'], ['far', '.hzb']]) {
    const root = document.querySelector(sel)
    if (!root || opacityOf(root) < 0.05) continue
    const flying = opacityOf(root.querySelector('.hpa')) > 0.05
    add(`heron (${copy} copy)`, flying && copy === 'near' ? 'sky' : 'surface', root, yOf(root.closest('.hpf')), { flying })
  }
  // Fixed things the movers pass: palms by their roots, the villas' pier.
  document.querySelectorAll('g.palm').forEach((g, i) => add(`palm ${i + 1}`, 'surface', g, Number(/(\d+(?:\.\d+)?)px\s*;?$/.exec(g.style.transformOrigin)?.[1] ?? g.getBoundingClientRect().bottom)))
  return out
}

const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const touching = (A, B) => overlaps(A.box, B.box) && A.parts.some(p => B.parts.some(q => overlaps(p, q)))

// What is wrong between two objects that overlap, or null.
function judge(A, B) {
  const [top, under] = A.order > B.order ? [A, B] : [B, A]
  if (A.layer === 'sky' || B.layer === 'sky') return null
  // The mascot hops between the jetty and the lead boat in an arc, so its
  // height on screen is not its depth; the film's own checks hold the two.
  if ([A.name, B.name].includes('clawd') && [A.name, B.name].some(n => n.startsWith('lead boat'))) return null
  if (top.layer === 'under' && under.layer === 'surface') return { kind: 'order', text: `${top.name} (under the water) painted over ${under.name} (on the surface)` }
  if (top.layer !== under.layer) return null
  const gap = top.depth - under.depth
  if (Math.abs(gap) < SAME_DEPTH && !(/^palm/.test(top.name) && /^palm/.test(under.name))) return { kind: 'through', text: `${A.name} and ${B.name} at one depth (${A.depth}, ${B.depth}) run through each other` }
  if (gap < 0) return { kind: 'order', text: `${top.name} (depth ${top.depth}) painted over ${under.name} (nearer, depth ${under.depth})` }
  if (top.layer === 'under' && top.opacity < SEE_THROUGH) return { kind: 'mix', text: `${top.name} is see-through (${top.opacity.toFixed(2)}) over ${under.name}: their colours mix` }
  return null
}

// How many pixels the two objects both cover, each painted alone.
async function shared(page, A, B) {
  const mask = async obj => {
    await page.evaluate(({ order }) => {
      const all = [...document.querySelectorAll('svg *')]
      const root = all[order]
      const keep = new Set([root, ...root.querySelectorAll('*')])
      for (const el of all) el.style.visibility = keep.has(el) ? 'visible' : 'hidden'
      for (let n = root.parentNode; n && n.tagName !== 'svg'; n = n.parentNode) n.style.visibility = 'hidden'
    }, obj)
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } })
    await page.evaluate(() => { for (const el of document.querySelectorAll('svg *')) el.style.visibility = '' })
    return png
  }
  const [a, b] = [await mask(A), await mask(B)]
  return page.evaluate(async ([a, b]) => {
    const load = async src => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data }
    const [pa, pb] = [await load(a), await load(b)]
    let n = 0
    for (let i = 3; i < pa.length; i += 4) if (pa[i] > 40 && pb[i] > 40) n++
    return n
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`])
}

async function audit(page, frames, outDir, label) {
  // frames: [{ t, objects, seek, load }] in time order within one scene or across.
  const faults = new Map()
  // A pair whose boxes meet but whose pixels did not is not tried again for
  // a few seconds.
  const clear = new Map()
  let previous = null
  for (const frame of frames) {
    await frame.load()
    await frame.seek()
    const objects = await page.evaluate(census)
    // A stretch starts with the frame before it, only to measure jumps from.
    if (frame.warm) { previous = { t: frame.t, objects }; continue }
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const [A, B] = [objects[i], objects[j]]
        if (!touching(A, B)) continue
        const verdict = judge(A, B)
        if (!verdict) continue
        const key = `${verdict.kind}|${[A.name, B.name].sort().join('|')}`
        const seen = faults.get(key)
        if (seen && seen.count >= 1 && seen.confirmed) { seen.count++; seen.last = frame.t; continue }
        if (clear.has(key) && frame.t - clear.get(key) < 5 && frame.t >= clear.get(key)) continue
        const pixels = await shared(page, A, B)
        await frame.seek()
        if (pixels < MIN_PIXELS) { clear.set(key, frame.t); continue }
        const at = [Math.max(0, Math.min(A.box[0], B.box[0]) - 20), Math.max(0, Math.min(A.box[1], B.box[1]) - 20)]
        const size = [Math.min(W - at[0], Math.max(A.box[2], B.box[2]) - at[0] + 20), Math.min(H - at[1], Math.max(A.box[3], B.box[3]) - at[1] + 20)]
        const shot = path.join(outDir, `${label}-${verdict.kind}-${faults.size}-${Math.round(frame.t * 10)}.png`)
        if (!seen) await page.screenshot({ path: shot, clip: { x: at[0], y: at[1], width: Math.max(10, size[0]), height: Math.max(10, size[1]) } })
        faults.set(key, seen ? { ...seen, count: seen.count + 1, last: frame.t, confirmed: true } : { key, kind: verdict.kind, text: verdict.text, first: frame.t, last: frame.t, count: 1, pixels, shot, confirmed: true })
      }
    }
    if (previous && frame.t > previous.t) {
      const dt = frame.t - previous.t
      for (const o of objects) {
        const p = previous.objects.find(q => q.name === o.name)
        const inView = q => q.box[2] > 0 && q.box[0] < W && q.box[3] > 0 && q.box[1] < H
        if (!p || !inView(o) || !inView(p)) continue
        const [cx, cy, px, py] = [(o.box[0] + o.box[2]) / 2, (o.box[1] + o.box[3]) / 2, (p.box[0] + p.box[2]) / 2, (p.box[1] + p.box[3]) / 2]
        const moved = Math.hypot(cx - px, cy - py)
        if (moved > TOP_SPEED * dt + 12 && !/^(palm|clawd)/.test(o.name)) {
          const key = `jump|${o.name}`
          const seen = faults.get(key)
          faults.set(key, seen ? { ...seen, count: seen.count + 1, last: frame.t } : { key, kind: 'jump', text: `${o.name} jumped ${moved.toFixed(0)}px in ${dt}s${frame.seam ? ' across a redraw' : ''}`, first: frame.t, last: frame.t, count: 1 })
        }
      }
    }
    previous = { t: frame.t, objects }
  }
  return [...faults.values()]
}

// The same fault found in several stretches of one sweep, as one.
function merge(found) {
  const byKey = new Map()
  for (const f of found) {
    const seen = byKey.get(f.key)
    byKey.set(f.key, seen ? { ...seen, count: seen.count + f.count, first: Math.min(seen.first, f.first), last: Math.max(seen.last, f.last), ...(seen.shot ? {} : { shot: f.shot, pixels: f.pixels }) } : f)
  }
  return [...byKey.values()]
}

async function main() {
  const [mode, ...args] = process.argv.slice(2)
  const browsers = []
  const newPage = async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
    browsers.push(browser)
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage()
    page.on('pageerror', e => console.error(e))
    const setScene = async file => {
      await page.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(file, 'utf8').replace('<svg ', `<svg width="${W}" height="${H}" `)}</body></html>`)
      await page.evaluate(lanes => { window.LANES = lanes }, LANES)
    }
    const seekTo = s => page.evaluate(ms => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms } }, s * 1000)
    return { page, setScene, seekTo }
  }
  // Runs `work` on each item over JOBS browsers at once, in no set order.
  const pool = async (items, work) => {
    const queue = [...items.keys()]
    const results = []
    await Promise.all(Array.from({ length: Math.min(JOBS, items.length) }, async () => {
      const tab = await newPage()
      while (queue.length) { const k = queue.shift(); results[k] = await work(tab, items[k], k) }
    }))
    return results
  }
  let faults = []
  let outDir
  if (mode === 'sweep') {
    const [file, out, from = 0, to = 600, every = 0.5] = args
    outDir = out
    fs.mkdirSync(outDir, { recursive: true })
    const times = []
    for (let t = Number(from); t <= Number(to) + 1e-9; t += Number(every)) times.push(+t.toFixed(2))
    // Stretches of about a minute, more of them than pages so they even out.
    const per = Math.max(2, Math.ceil(times.length / (JOBS * 4)))
    const stretches = []
    for (let k = 0; k < times.length; k += per) stretches.push(times.slice(Math.max(0, k - 1), k + per).map((t, n) => ({ t, warm: k > 0 && n === 0 })))
    const found = await pool(stretches, async ({ page, setScene, seekTo }, stretch, k) => {
      await setScene(file)
      return audit(page, stretch.map(s => ({ ...s, load: async () => {}, seek: () => seekTo(s.t) })), outDir, `sweep${k}`)
    })
    faults = merge(found.flat())
  } else if (mode === 'film') {
    const [out, ...dirs] = args
    outDir = out
    fs.mkdirSync(outDir, { recursive: true })
    const found = await pool(dirs, async ({ page, setScene, seekTo }, dir) => {
      const story = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8'))
      const frames = []
      let loaded = -1
      for (let i = 0; i < story.redraws.length; i++) {
        const r = story.redraws[i]
        const until = i + 1 < story.redraws.length ? story.redraws[i + 1].at : story.frames.to
        const load = async () => { if (loaded !== i) { await setScene(path.join(dir, r.file)); loaded = i } }
        for (let t = r.at; t < until; t += 0.5) frames.push({ t: +t.toFixed(2), seam: t === r.at && i > 0, load, seek: () => seekTo(t - r.at) })
      }
      const name = `${path.basename(path.dirname(dir))}-${path.basename(dir)}`
      return (await audit(page, frames, outDir, name)).map(f => ({ ...f, text: `${path.basename(path.dirname(dir))}/${path.basename(dir)}: ${f.text}` }))
    })
    faults = found.flat()
  } else {
    console.error('usage: layers.cjs sweep <scene.svg> <out-dir> [from] [to] [every] | film <out-dir> <scenario-dir>...')
    process.exit(1)
  }
  await Promise.all(browsers.map(b => b.close()))
  faults.sort((a, b) => a.kind.localeCompare(b.kind) || b.count - a.count)
  const lines = faults.map(f => `- [${f.kind}] ${f.text} (seen ${f.count} times, ${f.first}s-${f.last}s${f.pixels ? `, ${f.pixels} px shared` : ''})${f.shot ? ` ${path.basename(f.shot)}` : ''}`)
  fs.writeFileSync(path.join(outDir, 'layers.md'), `# Layer audit\n\n${lines.join('\n') || 'No faults.'}\n`)
  fs.writeFileSync(path.join(outDir, 'layers.json'), JSON.stringify(faults, null, 1))
  console.log(lines.join('\n') || 'No faults.')
  console.log(`${faults.length} faults; report: ${path.join(outDir, 'layers.md')}`)
  process.exit(faults.length ? 2 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
