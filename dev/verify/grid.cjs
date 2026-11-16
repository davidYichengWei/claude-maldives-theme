// Whether every animation in a scene changes only on one shared clock of FPS
// ticks a second. The browser draws a frame whenever anything on the page has
// changed, and a frame costs about the same however little changed, so one
// animation off the clock keeps every frame busy; on it, the frames between
// ticks are left alone.
//
//   node verify/grid.cjs [--fps N] [--all] <scene.svg>...
//
// It reads each animation's keyframes and timing as the browser resolved
// them (every <use> swapped for a copy of what it shows, so the copies'
// animations are seen too) and works out when its value can change: at the
// ends of each segment that moves, and at each step of a steps() timing in
// between. A segment eased any other way changes every frame ("smooth"); a
// change off a tick is "off". `--all` lists every fault, not the first few.
process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1'
const { chromium } = require('playwright-core')
const fs = require('fs')

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  if (at < 0) return fallback
  const value = args[at + 1]
  args.splice(at, 2)
  return value
}
const fps = Number(option('--fps', '60'))
// The display's own rate, which a smooth animation keeps busy.
const hz = Number(option('--hz', '120'))
const all = args.includes('--all')
if (all) args.splice(args.indexOf('--all'), 1)

async function check(page, file) {
  const svg = fs.readFileSync(file, 'utf8').replace('<svg ', '<svg width="800" height="500" ')
  await page.setContent(`<html><body style="margin:0;overflow:hidden">${svg}</body></html>`)
  return page.evaluate(([fps, hz]) => {
    const NS = 'http://www.w3.org/2000/svg'
    for (let left = true; left; ) {
      left = false
      for (const use of [...document.querySelectorAll('use')]) {
        const target = document.getElementById((use.getAttribute('href') ?? '').slice(1))
        if (target === null) continue
        const copy = target.cloneNode(true)
        copy.removeAttribute('id')
        const g = document.createElementNS(NS, 'g')
        for (const { name, value } of [...use.attributes]) if (!['href', 'x', 'y'].includes(name)) g.setAttribute(name, value)
        g.appendChild(copy)
        use.replaceWith(g)
        left = true
      }
    }
    const g = 1000 / fps
    // How far a time in ms is from the nearest tick.
    const off = ms => Math.abs(ms - Math.round(ms / g) * g)
    const SLACK = 1.05
    const faults = []
    const costs = {}
    let count = 0
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished') continue
      count++
      const name = a.animationName ?? '?'
      const timing = a.effect.getComputedTiming()
      const duration = Number(timing.duration)
      const delay = Number(timing.delay)
      const frames = a.effect.getKeyframes()
      // Frames a second this animation draws off the clock, at `hz` a second:
      // the ones between ticks while a segment moves smoothly, and one for
      // each change that falls off a tick.
      let cost = 0
      const fault = (kind, detail, frames) => {
        cost += frames
        faults.push({ name, kind, detail })
      }
      const per = 1000 / Math.max(duration, 1)
      if (off(duration) > SLACK) fault('off', `duration ${duration.toFixed(2)}ms`, 0)
      if (off(delay) > SLACK) fault('off', `delay ${delay.toFixed(2)}ms`, 0)
      const valueOf = k => JSON.stringify(Object.entries(k).filter(([p]) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)).sort())
      for (let i = 0; i + 1 < frames.length; i++) {
        const [from, to] = [frames[i], frames[i + 1]]
        const [o0, o1] = [from.computedOffset, to.computedOffset]
        if (o1 <= o0 || valueOf(from) === valueOf(to)) continue
        const span = (o1 - o0) * duration
        const easing = from.easing
        const stepped = easing.match(/^steps\((\d+)(?:,\s*([a-z-]+))?\)$/)
        const n = easing === 'step-end' || easing === 'step-start' ? 1 : stepped === null ? 0 : Number(stepped[1])
        if (n === 0) {
          fault('smooth', `${(o0 * 100).toFixed(2)}%-${(o1 * 100).toFixed(2)}% ${easing}`, (o1 - o0) * (hz - fps))
          continue
        }
        for (const at of [o0 * duration, o1 * duration]) if (off(at + delay) > SLACK) fault('off', `stop at ${at.toFixed(2)}ms`, per)
        if (n > 1 && off(span / n) > SLACK) fault('off', `${(o0 * 100).toFixed(2)}%-${(o1 * 100).toFixed(2)}% ${easing}: a step every ${(span / n).toFixed(2)}ms`, (n - 1) * per)
      }
      if (cost > 0) costs[name] = (costs[name] ?? 0) + cost
    }
    return { count, faults, costs }
  }, [fps, hz])
}

;(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  let bad = 0
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } })
    for (const file of args) {
      const { count, faults, costs } = await check(page, file)
      bad += faults.length
      const names = new Map()
      for (const f of faults) names.set(f.name, [...(names.get(f.name) ?? []), f])
      const total = Object.values(costs).reduce((n, c) => n + c, 0)
      console.log(`${file}: ${count} animations, ${faults.length} faults in ${names.size} names, up to ${total.toFixed(1)} frames/s off the clock`)
      for (const [name, list] of [...names].sort((a, b) => (costs[b[0]] ?? 0) - (costs[a[0]] ?? 0)).slice(0, all ? Infinity : 25)) {
        const kinds = [...new Set(list.map(f => f.kind))].join('+')
        console.log(`  ${name} ${(costs[name] ?? 0).toFixed(2)}/s ×${list.length} ${kinds}: ${list.slice(0, all ? Infinity : 2).map(f => f.detail).join('; ')}`)
      }
    }
  } finally {
    await browser.close()
  }
  console.log(`grid: ${bad} faults`)
  process.exitCode = bad === 0 ? 0 : 1
})().catch(e => {
  console.error(e)
  process.exit(1)
})
