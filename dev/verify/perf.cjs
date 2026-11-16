// What a scene costs to keep running: the CPU time all of Chromium's
// processes spend while the scene plays live (nothing paused), for a while
// after it has settled, and what is animating in it.
//
//   node verify/perf.cjs [--seconds N] [--rounds R] [--size WxH] [--flatten]
//     [--pause re] [--keep re] [--only n] [--step re:hz] [--tick hz]
//     [--align hz] [--smooth re] <scene.svg>...
//
// Each scene plays in a browser of its own, R rounds (default 3) of N seconds
// (default 8) after 2 s to settle; it prints the median CPU in cores (1.00 is
// one core kept busy), the spread, the frames drawn a second, and the running
// animations by name, most first. `--pause re` pauses the animations whose
// name matches `re` first, to see what they cost by their absence; the other
// options below change the scene's timing to see what a change would save.
//
// Headless Chromium rasterizes on the CPU, where the app does it on the GPU,
// so the numbers rank what costs most; they are not the app's own.
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
const seconds = Number(option('--seconds', '8'))
const rounds = Number(option('--rounds', '3'))
const pause = option('--pause', undefined)
// `--keep re` pauses every animation but those whose name matches `re`, and
// `--only n` keeps just the first n of those.
const keep = option('--keep', undefined)
const only = Number(option('--only', '1000000'))
// `--flatten` swaps every <use> for a plain copy of what it shows, so the
// animations inside the copies are the document's, to pause or count.
const flatten = args.includes('--flatten')
// `--step re:hz` makes the animations whose name matches `re` change only
// `hz` times a second, as a steps() timing would.
const step = option('--step', undefined)
// `--tick hz` pauses every animation and moves them all on together `hz`
// times a second: what the scene costs when all its changes share frames.
const tick = Number(option('--tick', '0'))
// `--align hz` keeps every animation running but snaps its duration and delay
// to a 1/hz grid and steps it once a tick: what steps() timing on one shared
// grid would cost, left to the browser's own frame loop.
const align = Number(option('--align', '0'))
// `--smooth re` leaves the animations whose name matches `re` out of --align.
const smooth = option('--smooth', '^$')
if (flatten) args.splice(args.indexOf('--flatten'), 1)
// `--size WxH` draws the scene at that size instead.
const [W, H] = option('--size', '1600x1000').split('x').map(Number)
const TICK = 100

// CPU seconds so far of every process below this one: the browser and its
// renderer, GPU and utility processes.
function cpuBelow(root) {
  const parent = new Map()
  const used = new Map()
  for (const pid of fs.readdirSync('/proc').filter(n => /^\d+$/.test(n))) {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      parent.set(Number(pid), Number(fields[1]))
      used.set(Number(pid), (Number(fields[11]) + Number(fields[12])) / TICK)
    } catch {
      // Gone between listing and reading.
    }
  }
  const below = pid => {
    for (let p = parent.get(pid); p !== undefined && p > 1; p = parent.get(p)) if (p === root) return true
    return false
  }
  let total = 0
  for (const [pid, cpu] of used) if (below(pid)) total += cpu
  return total
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function measure(file) {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] })
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } })
    const svg = fs.readFileSync(file, 'utf8').replace('<svg ', `<svg width="${W}" height="${H}" `)
    await page.setContent(`<html><body style="margin:0;overflow:hidden">${svg}</body></html>`)
    if (flatten) {
      await page.evaluate(() => {
        const NS = 'http://www.w3.org/2000/svg'
        for (let left = true; left; ) {
          left = false
          for (const use of [...document.querySelectorAll('use')]) {
            const id = (use.getAttribute('href') ?? '').slice(1)
            const target = document.getElementById(id)
            if (target === null) continue
            const copy = target.cloneNode(true)
            copy.removeAttribute('id')
            const g = document.createElementNS(NS, 'g')
            for (const { name, value } of [...use.attributes]) if (!['href', 'x', 'y'].includes(name)) g.setAttribute(name, value)
            const x = use.getAttribute('x') ?? '0'
            const y = use.getAttribute('y') ?? '0'
            g.setAttribute('transform', `${use.getAttribute('transform') ?? ''} translate(${x} ${y})`)
            if (id.startsWith('q')) g.setAttribute('fill', 'currentColor')
            g.appendChild(copy)
            use.replaceWith(g)
            left = true
          }
        }
      })
    }
    if (step !== undefined) {
      await page.evaluate(([re, hz]) => {
        for (const a of document.getAnimations()) {
          if (!new RegExp(re).test(a.animationName ?? '')) continue
          const ms = Number(a.effect.getTiming().duration)
          if (ms > 0) a.effect.updateTiming({ easing: `steps(${Math.max(1, Math.round((ms / 1000) * hz))})` })
        }
      }, [step.slice(0, step.lastIndexOf(':')), Number(step.slice(step.lastIndexOf(':') + 1))])
    }
    if (align > 0) {
      // Every animation on one grid: duration and delay snapped to whole
      // ticks, and the iteration stepped once a tick.
      const starts = await page.evaluate(([hz, smooth]) => {
        const g = 1000 / hz
        const starts = new Set()
        for (const a of document.getAnimations()) {
          if (new RegExp(smooth).test(a.animationName ?? '')) continue
          const t = a.effect.getTiming()
          const ms = Number(t.duration)
          if (!(ms > 0)) continue
          const n = Math.max(1, Math.round(ms / g))
          a.effect.updateTiming({ duration: n * g, delay: Math.round(Number(t.delay) / g) * g, easing: `steps(${n})` })
          starts.add(Math.round(Number(a.startTime) * 1000) / 1000)
        }
        // Copies made by --flatten start a frame or more late: put every
        // animation on one start so the grid is one grid.
        const t0 = Math.min(...document.getAnimations().map(a => Number(a.startTime)))
        for (const a of document.getAnimations()) a.startTime = t0
        return [...starts]
      }, [align, smooth])
      console.log(`  start times: ${starts.slice(0, 5).join(' ')}${starts.length > 5 ? ` (+${starts.length - 5})` : ''}`)
    }
    if (pause !== undefined) {
      await page.evaluate(re => {
        for (const a of document.getAnimations()) if (new RegExp(re).test(a.animationName ?? '')) a.pause()
      }, pause)
    }
    if (keep !== undefined) {
      await page.evaluate(([re, n]) => {
        let kept = 0
        for (const a of document.getAnimations()) {
          if (new RegExp(re).test(a.animationName ?? '') && kept < n) kept++
          else a.pause()
        }
      }, [keep, only])
    }
    if (tick > 0) {
      await page.evaluate(hz => {
        const all = document.getAnimations()
        const base = all.map(a => Number(a.currentTime))
        for (const a of all) a.pause()
        const t0 = performance.now()
        setInterval(() => {
          const t = performance.now() - t0
          all.forEach((a, i) => {
            a.currentTime = base[i] + t
          })
        }, 1000 / hz)
      }, tick)
    }
    await page.waitForTimeout(2000)
    const census = await page.evaluate(() => {
      const byName = {}
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running') continue
        const name = a.animationName ?? '?'
        byName[name] = (byName[name] ?? 0) + 1
      }
      return { elements: document.querySelectorAll('*').length, byName }
    })
    const cores = []
    const fps = []
    for (let r = 0; r < rounds; r++) {
      const c0 = cpuBelow(process.pid)
      const t0 = Date.now()
      await page.waitForTimeout(seconds * 1000)
      const c1 = cpuBelow(process.pid)
      cores.push((c1 - c0) / ((Date.now() - t0) / 1000))
    }
    // Frames a second, counted after the CPU rounds: counting drives frames.
    fps.push(await page.evaluate(() => new Promise(done => {
      let frames = 0
      const t0 = performance.now()
      const count = () => {
        frames++
        if (performance.now() - t0 < 1000) requestAnimationFrame(count)
        else done(frames)
      }
      requestAnimationFrame(count)
    })))
    return { size: fs.statSync(file).size, cores, fps: median(fps), census }
  } finally {
    await browser.close()
  }
}

;(async () => {
  for (const file of args) {
    const { size, cores, fps, census } = await measure(file)
    const running = Object.entries(census.byName).sort((a, b) => b[1] - a[1])
    const total = running.reduce((n, [, k]) => n + k, 0)
    console.log(`${file}: ${size} bytes, ${census.elements} elements, ${total} running animations`)
    console.log(`  cpu ${median(cores).toFixed(2)} cores (${cores.map(c => c.toFixed(2)).join(' ')}), ${fps.toFixed(0)} frames/s`)
    console.log(`  ${running.slice(0, 40).map(([n, k]) => `${n}:${k}`).join(' ')}`)
  }
})().catch(e => {
  console.error(e)
  process.exit(1)
})
