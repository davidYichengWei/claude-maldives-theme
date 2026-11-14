// Renders what story.cjs wrote in headless Chromium, the way the app shows
// it: each scene from the moment it was handed over, its CSS animations paused
// and moved to the second asked for. Checks every frame, and every seam where
// one scene gives way to the next, and writes report.md beside story.json.
//
//   node verify/film.cjs <story dir> [--film] [--crop x,y,w,h]
//
// --film also saves every frame and a contact sheet of them; without it only
// the frames a check flags, and the seams, are saved.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const W = 1600
const H = 1000
// The fills that mark the mascot and the lead boat's hull in the scene.
const CLAY = '#c97b5e'
const HULL = '#7a4f2c'
// How fast anything in the scene may move, in px a second: a hop or a boat
// at full tilt stays under it.
const TOP_SPEED = 260
// The largest source the app accepts.
const LIMIT = 131072

const [dir, ...rest] = process.argv.slice(2)
const isFilm = rest.includes('--film')
const cropAt = rest.indexOf('--crop')
const crop = cropAt >= 0 ? rest[cropAt + 1].split(',').map(Number) : undefined
const story = JSON.parse(fs.readFileSync(path.join(dir, 'story.json'), 'utf8'))
const shots = path.join(dir, 'frames')
fs.mkdirSync(shots, { recursive: true })

// Where each mascot and each boat is in the page as it stands, and in what
// order they are painted. Runs in the page.
function probe({ clay, hull }) {
  const all = [...document.querySelectorAll('svg *')]
  const order = new Map(all.map((el, i) => [el, i]))
  const seen = el => {
    let o = 1
    for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0
      o *= Number(cs.opacity)
    }
    return o
  }
  // A figure turning about is a sliver with no width at the turn's midpoint.
  const onScreen = r => r.width + r.height > 0 && r.right >= 0 && r.left <= 1600 && r.bottom >= 0 && r.top <= 1000
  const box = r => ({ x: r.left, y: r.top, w: r.width, h: r.height })
  // The mascot's clay parts, gathered into one figure per cluster.
  const parts = [...document.querySelectorAll(`path[fill="${clay}"]`)]
    .map(el => ({ el, r: el.getBoundingClientRect(), o: seen(el) }))
    .filter(p => p.o > 0.05 && onScreen(p.r))
  const figures = []
  for (const p of parts) {
    const near = figures.find(f => p.r.left < f.r + 8 && p.r.right > f.l - 8 && p.r.top < f.b + 8 && p.r.bottom > f.t - 8)
    if (near) {
      near.l = Math.min(near.l, p.r.left); near.r = Math.max(near.r, p.r.right)
      near.t = Math.min(near.t, p.r.top); near.b = Math.max(near.b, p.r.bottom)
      near.order = Math.max(near.order, order.get(p.el)); near.o = Math.max(near.o, p.o)
    } else {
      figures.push({ l: p.r.left, r: p.r.right, t: p.r.top, b: p.r.bottom, order: order.get(p.el), o: p.o })
    }
  }
  const clawds = figures.map(f => ({ x: f.l, y: f.t, w: f.r - f.l, h: f.b - f.t, order: f.order, o: f.o }))
  // Each boat's side view: the lead boat's hull is drawn inline, the fleet's
  // are clones of the defs. `water` is where its deck line meets the water,
  // which says how near it is.
  const boats = [...document.querySelectorAll('g.boat')]
    .filter(el => el.querySelector(`path[fill="${hull}"], use[href="#cH"], use[href="#sH"]`) !== null)
    .map(el => {
      const o = seen(el)
      // Only what shows: a glow kept hidden or a wake faded out still has a
      // box, which would make the boat seem wider than it is.
      const shown = [...el.querySelectorAll('path, ellipse, circle, rect, line, polygon, use')].filter(leaf => seen(leaf) > 0.05).map(leaf => leaf.getBoundingClientRect()).filter(q => q.width + q.height > 0)
      const r = shown.length === 0 ? el.getBoundingClientRect() : { left: Math.min(...shown.map(q => q.left)), top: Math.min(...shown.map(q => q.top)), right: Math.max(...shown.map(q => q.right)), bottom: Math.max(...shown.map(q => q.bottom)) }
      r.width = r.right - r.left
      r.height = r.bottom - r.top
      const isLead = el.querySelector(`path[fill="${hull}"]`) !== null
      const last = [...el.querySelectorAll('*')].reduce((m, c) => Math.max(m, order.get(c) ?? 0), order.get(el))
      const kind = isLead ? 'lead' : el.querySelector('use[href="#cH"]') ? 'crew' : 'shell'
      // The lead boat's hull alone, for following it: its glows and wake come
      // and go, and would read as jumps.
      const core = isLead ? box(el.querySelector(`path[fill="${hull}"]`).getBoundingClientRect()) : undefined
      return { ...box(r), o, isLead, kind, water: el.getScreenCTM().f, first: order.get(el), last, isShown: onScreen(r), core }
    })
    .filter(b => b.o > 0.05 && b.isShown)
  // Each fleet boat's hull, wake left out, by name, wherever it is drawn and
  // whether or not this copy of it is the one shown: every copy stands in the
  // same place.
  const fleet = {}
  for (const el of document.querySelectorAll('g[data-b]')) {
    const hull = el.querySelector('use[href="#cH"], use[href="#sH"]')
    const r = hull?.getBoundingClientRect()
    if (r && onScreen(r)) fleet[el.getAttribute('data-b')] ??= box(r)
  }
  return { clawds, boats, fleet }
}

function seekAll(page, ms) {
  return page.evaluate(t => {
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = t
    }
  }, ms)
}

const centre = c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 })
const gap = (a, b) => Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y)
const f1 = n => Math.round(n * 10) / 10

// What a frame breaks on its own: the mascot shown once, and painted behind a
// boat it stands behind.
function frameFaults(p) {
  const faults = []
  if (p.clawds.length !== 1) faults.push(`clawd shown ${p.clawds.length} times`)
  for (const c of p.clawds) {
    const bottom = c.y + c.h
    // Standing on the jetty or the island, clear of any deck.
    const isAshore = bottom >= 708 && bottom <= 750 && c.x + c.w / 2 >= 1120
    if (!isAshore) continue
    for (const b of p.boats) {
      // Only its hull, from a little above the waterline down, can stand in
      // front of the mascot; its sails rise behind whatever it is beside.
      const top = Math.max(b.y, b.water - 8)
      const overlaps = c.x < b.x + b.w && c.x + c.w > b.x && c.y < b.y + b.h && c.y + c.h > top
      if (overlaps && b.y + b.h > bottom + 6 && c.order > b.last) {
        faults.push(`clawd ashore painted over a ${b.isLead ? 'lead ' : ''}boat in front of it`)
      }
    }
  }
  // Boats that overlap: the nearer one must be painted over the farther.
  for (const a of p.boats) {
    for (const b of p.boats) {
      const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      // Boats within a few px of one depth may be painted either way.
      const isNearer = a.water > b.water + 6
      if (isNearer && a.w > 0.5 && b.w > 0.5 && across > 0.25 * Math.min(a.w, b.w) && down > 0.25 * Math.min(a.h, b.h) && a.last < b.first) {
        faults.push(`${a.kind} boat at y=${f1(a.water)} painted under a farther ${b.kind} boat at y=${f1(b.water)}`)
      }
    }
  }
  return faults
}

// What two frames `dt` seconds apart break between them: a jump, a change of
// shape too sudden to be a turn, a boat appearing mid-water.
function stepFaults(a, b, dt) {
  const faults = []
  if (a.clawds.length === 1 && b.clawds.length === 1) {
    const [p, q] = [a.clawds[0], b.clawds[0]]
    const moved = gap(p, q)
    if (moved > TOP_SPEED * dt + 6) faults.push(`clawd jumped ${f1(moved)}px`)
    // Across a seam nothing may change shape. Within a scene the mascot turns
    // about in a fraction of a second, its width running down to nothing and
    // back, so only its height, which a turn leaves alone, is held to a pace.
    const reshaped = Math.abs(p.w - q.w) + Math.abs(p.h - q.h)
    const grew = Math.abs(p.h - q.h)
    if (dt === 0 ? reshaped > 8 : grew > 60 * dt + 6) faults.push(`clawd changed shape by ${f1(dt === 0 ? reshaped : grew)}px at once`)
  }
  for (const name of Object.keys(a.fleet ?? {})) {
    const [p, q] = [a.fleet[name], b.fleet?.[name]]
    if (q === undefined) continue
    const moved = gap(p, q)
    if (moved > TOP_SPEED * dt + 6) faults.push(`${name} boat jumped ${f1(moved)}px`)
    const narrowed = Math.abs(p.w - q.w)
    if (narrowed > 600 * dt + 8) faults.push(`${name} boat changed width by ${f1(narrowed)}px at once`)
  }
  const leads = [a, b].map(p => p.boats.filter(x => x.isLead))
  if (leads[0].length === 1 && leads[1].length === 1) {
    const [p, q] = [leads[0][0].core, leads[1][0].core]
    const moved = gap(p, q)
    if (moved > TOP_SPEED * dt + 6) faults.push(`lead boat jumped ${f1(moved)}px`)
    // A boat comes about in under a second, its side view narrowing to
    // nothing as its bow-on view (drawn apart, so not measured here) widens:
    // within a scene only a change faster than that is a fault, and across a
    // seam any change is.
    const narrowed = Math.abs(p.w - q.w)
    if (narrowed > 600 * dt + 8) faults.push(`lead boat changed width by ${f1(narrowed)}px at once`)
  } else if (leads[0].length !== leads[1].length) {
    const one = (leads[0][0] ?? leads[1][0])
    const cx = one.x + one.w / 2
    if (cx > 80 && cx < W - 80) faults.push(`lead boat ${leads[0].length ? 'vanished' : 'appeared'} mid-water at x=${f1(cx)}`)
  }
  return faults
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  const context = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: story.scheme === 'dark' ? 'dark' : 'light' })
  const page = await context.newPage()
  const diffPage = await context.newPage()
  let loaded = -1
  const show = async i => {
    if (loaded === i) return
    const svg = fs.readFileSync(path.join(dir, story.redraws[i].file), 'utf8').replace('<svg ', `<svg width="${W}" height="${H}" `)
    await page.setContent(`<html><body style="margin:0;overflow:hidden">${svg}</body></html>`)
    // A boat drawn more than once is drawn by <use> copies. The animations
    // inside a copy's shadow tree are not the document's, so they cannot be
    // seeked, and nothing in a copy can be measured: each copy of a boat is
    // swapped for a plain clone of it, which draws the same.
    await page.evaluate(() => {
      for (const use of [...document.querySelectorAll('use')]) {
        const id = (use.getAttribute('href') ?? '').slice(1)
        if (!/^v\d+$/.test(id)) continue
        const clone = document.getElementById(id).cloneNode(true)
        clone.removeAttribute('id')
        use.replaceWith(clone)
      }
    })
    loaded = i
  }
  const at = async (i, seconds) => {
    await show(i)
    await seekAll(page, Math.max(0, seconds - story.redraws[i].at) * 1000)
    return page.evaluate(probe, { clay: CLAY, hull: HULL })
  }
  const shoot = file => page.screenshot({ path: path.join(shots, file), clip: crop ? { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } : undefined })
  // The share of pixels that differ clearly between two shots.
  const differ = async (a, b) => diffPage.evaluate(async ([a, b]) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src })
    const [x, y] = await Promise.all([load(a), load(b)])
    const pixels = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data }
    const [p, q] = [pixels(x), pixels(y)]
    let n = 0
    for (let k = 0; k < p.length; k += 4) if (Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 40) n++
    return n / (p.length / 4)
  }, [a, b].map(buf => `data:image/png;base64,${buf.toString('base64')}`))

  const found = []
  const sizes = story.redraws.map(r => r.size)
  story.redraws.forEach((r, i) => { if (r.size > LIMIT) found.push({ t: r.at, kind: 'size', what: `scene ${i} is ${r.size} chars, over the app's ${LIMIT}` }) })

  // Frames, in order, each from the scene on screen at that second.
  const { from, to, every } = story.frames
  let last
  let shown = 0
  for (let t = from; t <= to + 1e-9; t = Math.round((t + every) * 1000) / 1000) {
    let i = -1
    story.redraws.forEach((r, k) => { if (r.at <= t) i = k })
    if (i < 0) continue
    const p = await at(i, t)
    const faults = [...frameFaults(p), ...(last && last.i === i ? stepFaults(last.p, p, t - last.t) : [])]
    const name = `t${t.toFixed(2).padStart(7, '0')}.png`
    if (isFilm || faults.length > 0) await shoot(name)
    for (const what of faults) found.push({ t, kind: 'frame', what, image: `frames/${name}`, scene: i })
    last = { t, i, p }
    shown++
  }

  // Seams: the last moment of one scene against the first of the next.
  const seams = []
  for (let i = 1; i < story.redraws.length; i++) {
    const t = story.redraws[i].at
    if (t < from || t > to) continue
    const before = await at(i - 1, t)
    const beforeShot = await page.screenshot()
    const after = await at(i, t)
    const afterShot = await page.screenshot()
    const changed = await differ(beforeShot, afterShot)
    const faults = stepFaults(before, after, 0)
    // Called away from its day on the island, the mascot drops a glance, a
    // lean or a squat it was in the middle of: accepted, and noted rather than
    // failed. Anything more than its pose is still a fault.
    const ashore = c => c.y + c.h >= 708 && c.y + c.h <= 750 && c.x + c.w / 2 >= 1120
    const isDropped = what => /^clawd changed shape/.test(what) && before.clawds.length === 1 && ashore(before.clawds[0]) && !['ask', 'reload'].includes(story.redraws[i].cause)
    // A redraw that answered nothing new must leave the picture as it was; one
    // that answered a change of state may change it.
    const isSteady = ['ask', 'reload'].includes(story.redraws[i].cause)
    if (isSteady && changed > 0.004) faults.push(`${f1(changed * 100)}% of the picture changed on a redraw that changed nothing`)
    seams.push({ t, scene: i, cause: story.redraws[i].cause, changed })
    if (faults.length > 0) {
      const base = `seam${String(i).padStart(3, '0')}`
      fs.writeFileSync(path.join(shots, `${base}-before.png`), beforeShot)
      fs.writeFileSync(path.join(shots, `${base}-after.png`), afterShot)
      for (const what of faults) found.push({ t, kind: isDropped(what) ? 'note' : 'seam', what, image: `frames/${base}-before.png | frames/${base}-after.png`, scene: i })
    }
  }

  if (isFilm) {
    const every = fs.readdirSync(shots).filter(n => /^t\d/.test(n)).sort()
    // A long film is sampled evenly: one page cannot hold every frame.
    const files = every.filter((_, i) => i % Math.ceil(every.length / 72) === 0)
    const cells = files.map(n => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(shots, n)).toString('base64')}"><figcaption>${n.slice(1, -4).replace(/^0+(?=\d)/, '')}s</figcaption></figure>`).join('')
    const sheet = await context.newPage()
    await sheet.setViewportSize({ width: 1600, height: 900 })
    await sheet.setContent(`<html><body style="margin:0;font:12px sans-serif;background:#fff"><style>body{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px}figure{margin:0}img{width:100%;display:block}figcaption{text-align:center}</style>${cells}</body></html>`)
    await sheet.waitForLoadState('load')
    await sheet.screenshot({ path: path.join(dir, 'sheet.png'), fullPage: true })
  }
  await browser.close()

  const notes = found.filter(x => x.kind === 'note')
  const faults = found.filter(x => x.kind !== 'note')
  const report = { about: story.about, frames: shown, scenes: story.redraws.length, largest: Math.max(...sizes), seams, faults, notes }
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1))
  const lines = [
    `# ${story.about}`,
    '',
    `${shown} frames from ${story.redraws.length} scenes (largest ${Math.max(...sizes)} chars), ${seams.length} seams checked.`,
    '',
    faults.length === 0 ? 'No faults found.' : `${faults.length} faults:`,
    '',
    ...faults.map(x => `- ${f1(x.t)}s ${x.kind}: ${x.what}${x.image ? ` (${x.image})` : ''}`),
    '',
    ...(notes.length === 0 ? [] : ['Accepted, noted only: the mascot dropping a pose as a new trip took it from the island.', '', ...notes.map(x => `- ${f1(x.t)}s: ${x.what} (${x.image})`), '']),
    '## Events',
    '',
    ...story.events.map(e => `- ${e}`),
  ]
  fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n') + '\n')
  console.log(`${dir}: ${shown} frames, ${seams.length} seams, ${faults.length} faults${notes.length ? `, ${notes.length} notes` : ''}`)
  process.exitCode = faults.length > 0 ? 2 : 0
})().catch(error => { console.error(error); process.exit(1) })
