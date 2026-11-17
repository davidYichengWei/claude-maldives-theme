// Everything in the scene that moves changes on one shared clock of FPS ticks
// a second. The app draws the backdrop afresh whenever anything in it has
// changed, at about the same cost however little changed, so one animation
// easing smoothly keeps every frame of the display busy; with every change on
// a tick, the frames between ticks are left alone.
//
// `onClock` puts a finished scene on the clock. Each animation the `animation`
// shorthand gives a duration plays keyframes of its own, timed in whole ticks,
// whose moving stretches step once a tick (`steps()`), with any easing drawn
// out as stops along its curve; every delay and every phase variable is
// rounded to a tick. Animations that take their duration from a variable are
// put on the clock where they are written, with `onTicks`.

export const FPS = 60

// `seconds` on the clock.
export function tick(seconds: number): number {
  return Math.round(seconds * FPS) / FPS
}

// A time on the clock as CSS writes it: four decimals keep a tick (a sixtieth
// of a second, which no decimal ends) within a few microseconds.
export function ft(seconds: number): string {
  return trim(Math.round(tick(seconds) * 1e4) / 1e4)
}

function trim(n: number): string {
  const s = String(n === 0 ? 0 : n)
  return s.replace(/^(-?)0\./, '$1.')
}

// How a keyframe's value runs on to the next one's.
type Ease = { kind: 'smooth'; isLinear: boolean; at: (x: number) => number } | { kind: 'steps'; n: number }

export const NAMED: Readonly<Record<string, readonly [number, number, number, number]>> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const at = (a: number, b: number, t: number): number => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t
  return x => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

function easeOf(timing: string): Ease | undefined {
  const t = timing.trim()
  if (t === 'linear') return { kind: 'smooth', isLinear: true, at: x => x }
  if (t === 'step-end' || t === 'step-start') return { kind: 'steps', n: 1 }
  const named = NAMED[t]
  if (named !== undefined) return { kind: 'smooth', isLinear: false, at: bezier(...named) }
  const curve = /^cubic-bezier\(([^)]*)\)$/.exec(t)
  if (curve !== null) {
    const [a, b, c, d] = (curve[1] ?? '').split(',').map(Number)
    return [a, b, c, d].every(v => v !== undefined && Number.isFinite(v)) ? { kind: 'smooth', isLinear: false, at: bezier(a ?? 0, b ?? 0, c ?? 1, d ?? 1) } : undefined
  }
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*(end|jump-end|start|jump-start)\s*)?\)$/.exec(t)
  if (steps !== null) return { kind: 'steps', n: Number(steps[1]) }
  return undefined
}

// Numbers in a value, with their units, and what lies between them.
const NUMBER = /(?<![\w#.-])-?(?:\d+\.?\d*|\.\d+)([a-z%]*)/g

// A value as its numbers, their units, and the rest with the numbers taken
// out.
function shape(v: string): { rest: string; nums: number[]; units: string[] } {
  const nums: number[] = []
  const units: string[] = []
  const rest = v.replace(NUMBER, (m, unit: string) => {
    nums.push(parseFloat(m))
    units.push(unit)
    return '\u0000'
  })
  return { rest, nums, units }
}

function lerp(a: string, b: string, k: number): string | undefined {
  if (k <= 0) return a
  if (k >= 1) return b
  const x = shape(a)
  const y = shape(b)
  if (x.rest !== y.rest || x.nums.length !== y.nums.length || x.nums.length === 0) return undefined
  let i = 0
  let failed = false
  const out = x.rest.replace(/\u0000/g, () => {
    const [n0, n1, u0, u1] = [x.nums[i] ?? 0, y.nums[i] ?? 0, x.units[i] ?? '', y.units[i] ?? '']
    i++
    if (u0 !== u1 && !(u0 === '' && n0 === 0) && !(u1 === '' && n1 === 0)) failed = true
    // Fine enough that the stretches between stops stay even and a place
    // worked out from the same curve agrees: within about a three-hundredth
    // of the way from one value to the other.
    const v = n0 + (n1 - n0) * k
    const unit = 10 ** Math.max(u0 === 'px' || u1 === 'px' || u0 === 'deg' || u1 === 'deg' ? -1 : -3, Math.min(0, Math.floor(Math.log10(Math.abs(n1 - n0) / 300))))
    return trim(Number((Math.round(v / unit) * unit).toFixed(3))) + (u0 || u1)
  })
  return failed ? undefined : out
}

type Key = { at: number; value: string; ease: Ease }

// The keyframes as each property's own keys, or none when some value has no
// key at the start or the end (the element's own value would fill in there).
function tracksOf(body: string, fallback: Ease): Map<string, Key[]> | undefined {
  const frames = new Map<number, { props: Map<string, string>; ease?: Ease }>()
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const offsets: number[] = []
    for (const sel of (m[1] ?? '').split(',').map(s => s.trim())) {
      const pc = /^(-?\d*\.?\d+)%$/.exec(sel)
      const at = sel === 'from' ? 0 : sel === 'to' ? 1 : pc === null ? NaN : Number(pc[1]) / 100
      if (!Number.isFinite(at)) return undefined
      // The browser drops a keyframe past either end.
      if (at >= 0 && at <= 1) offsets.push(at)
    }
    const props = new Map<string, string>()
    let ease: Ease | undefined
    for (const decl of splitTop(m[2] ?? '', ';')) {
      const colon = decl.indexOf(':')
      if (colon < 0) continue
      const prop = decl.slice(0, colon).trim()
      const value = decl.slice(colon + 1).trim()
      if (prop === 'animation-timing-function') {
        ease = easeOf(value)
        if (ease === undefined) return undefined
      } else {
        props.set(prop, value)
      }
    }
    for (const at of offsets) {
      const frame = frames.get(at) ?? { props: new Map<string, string>() }
      for (const [p, v] of props) frame.props.set(p, v)
      if (ease !== undefined) frame.ease = ease
      frames.set(at, frame)
    }
  }
  const tracks = new Map<string, Key[]>()
  for (const at of [...frames.keys()].sort((a, b) => a - b)) {
    const frame = frames.get(at)
    if (frame === undefined) continue
    for (const [prop, value] of frame.props) {
      const keys = tracks.get(prop) ?? []
      keys.push({ at, value, ease: frame.ease ?? fallback })
      tracks.set(prop, keys)
    }
  }
  for (const keys of tracks.values()) {
    // Stepped up to the end, a value with no key there holds to the end.
    const last = keys[keys.length - 1]
    if (last !== undefined && last.at < 1 && last.ease.kind === 'steps') keys.push({ ...last, at: 1 })
    if (keys[0]?.at !== 0 || keys[keys.length - 1]?.at !== 1) return undefined
  }
  return tracks.size === 0 ? undefined : tracks
}

function splitTop(s: string, by: string): string[] {
  const out: string[] = []
  let depth = 0
  let from = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === by && depth === 0) {
      out.push(s.slice(from, i))
      from = i + 1
    }
  }
  out.push(s.slice(from))
  return out.map(x => x.trim()).filter(x => x !== '')
}

// The key a time falls after, on one property's keys.
function keyAt(keys: readonly Key[], x: number): number {
  let i = 0
  while (i + 2 < keys.length && (keys[i + 1]?.at ?? 1) <= x) i++
  return i
}

// A property's value at `x` through the keyframes, or none where its keys
// cannot be blended by number.
function valueAt(keys: readonly Key[], x: number): string | undefined {
  const i = keyAt(keys, x)
  const [a, b] = [keys[i], keys[i + 1]]
  if (a === undefined) return undefined
  if (b === undefined || x <= a.at) return a.value
  const p = Math.min(1, (x - a.at) / (b.at - a.at))
  const k = a.ease.kind === 'steps' ? Math.floor(p * a.ease.n) / a.ease.n : a.ease.at(p)
  return lerp(a.value, b.value, k)
}

// How far a straight stretch may stray from the curve it stands for, by
// unit: as little as the eye sees, and, for a trip, whose place the theme
// works out from the curve too, under a pixel, so the two agree.
const SLACK: Readonly<Record<string, number>> = { px: 3, deg: 4, '': 0.1 }
const TRIP_SLACK: Readonly<Record<string, number>> = { px: 0.75, deg: 1.5, '': 0.04 }

// How many even stretches draw `at` (the values from 0 to 1 of a stretch of
// `ticks` ticks) within SLACK: the fewest that do, or a few more that share
// the ticks out evenly.
function piecesFor(ticks: number, at: (x: number) => string[] | undefined, slack: Readonly<Record<string, number>>): number {
  const most = Math.max(1, Math.min(ticks, 24))
  const fits = (n: number): boolean => {
    const ends = Array.from({ length: n + 1 }, (_, j) => at(j / n))
    if (ends.some(e => e === undefined)) return false
    for (let j = 0; j < n; j++) {
      for (const q of [0.25, 0.5, 0.75]) {
        const real = at((j + q) / n)
        if (real === undefined) return false
        for (let i = 0; i < real.length; i++) {
          const [r, a, b] = [shape(real[i] ?? ''), shape(ends[j]?.[i] ?? ''), shape(ends[j + 1]?.[i] ?? '')]
          for (let m = 0; m < r.nums.length; m++) {
            const line = (a.nums[m] ?? 0) + ((b.nums[m] ?? 0) - (a.nums[m] ?? 0)) * q
            if (Math.abs((r.nums[m] ?? 0) - line) > (slack[r.units[m] ?? ''] ?? 0.5)) return false
          }
        }
      }
    }
    return true
  }
  let n = 1
  while (n < most && !fits(n)) n++
  for (let even = n; even <= Math.min(most, n + 2); even++) if (ticks % even === 0) return even
  return n
}

// The divisor of `n` nearest `want`, so steps of a whole number of ticks fill
// a stretch.
function divisorNear(n: number, want: number): number {
  let best = 1
  for (let d = 1; d <= n; d++) {
    if (n % d === 0 && Math.abs(Math.log(d / want)) < Math.abs(Math.log(best / want))) best = d
  }
  return best
}

// `seconds` rounded to a whole number of beats of `ticks` ticks each, never
// none: what an animation whose stops fall every `1/ticks` of its duration
// must last for each of them to fall on a tick.
export function beat(seconds: number, ticks: number): number {
  return (Math.max(1, Math.round((seconds * FPS) / ticks)) * ticks) / FPS
}

// Keyframes `body`, eased with `timing`, drawn as `pieces` even straight
// stretches: a duration held in a variable gives every element its own, so
// the stretches cannot be laid out in ticks, but stepping each stretch with
// `steps(var(--k))`, k its ticks, keeps them on the clock. Every stop of
// `body` must fall at a whole piece.
export function evenly(body: string, pieces: number, timing: string): string {
  const fallback = easeOf(timing)
  const tracks = fallback === undefined ? undefined : tracksOf(body, fallback)
  if (tracks === undefined) throw new Error(`unreadable keyframes ${body}`)
  for (const keys of tracks.values()) {
    for (const k of keys) if (Math.abs(k.at * pieces - Math.round(k.at * pieces)) > 1e-9) throw new Error(`a stop off the pieces in ${body}`)
  }
  const groups = new Map<string, string[]>()
  for (let j = 0; j <= pieces; j++) {
    const decl = [...tracks].map(([prop, keys]) => `${prop}:${valueAt(keys, j / pieces) ?? ''}`).join(';')
    groups.set(decl, [...(groups.get(decl) ?? []), `${trim(Math.round((j / pieces) * 1e6) / 1e4)}%`])
  }
  return [...groups].map(([decl, ats]) => `${ats.join(',')}{${decl}}`).join('')
}

export type OnClock = { body: string; timing: string; ticks: number }

// Keyframes `body` played over `seconds` with `timing` (`isOnce`: played
// once, not looped; `isTrip`: a trip's, drawn closer to its curve), put on
// the clock: the keyframes it plays now, the timing
// to play them with, and the duration in ticks. None when they cannot be
// read.
export function onTicks(body: string, seconds: number, timing: string, isOnce = false, isTrip = false): OnClock | undefined {
  const fallback = easeOf(timing)
  if (fallback === undefined) return undefined
  const tracks = tracksOf(body, fallback)
  if (tracks === undefined) return undefined
  // A looping duration off the clock would drift from what the rest of the
  // theme works out from it, by its error every round: it stays as written.
  // One played once only ends a little early or late.
  const T = Math.round(seconds * FPS)
  if (T < 1 || (!isOnce && Math.abs(seconds * FPS - T) > 1e-6)) return undefined
  const offsets = [...new Set([...tracks.values()].flatMap(keys => keys.map(k => k.at)))].sort((a, b) => a - b)
  const props = [...tracks.keys()]
  // Where each stretch starts, in ticks, its values from there on, and how
  // many steps it takes to the next (none while nothing changes).
  const points = new Map<number, { values: string[]; steps?: number }>()
  const valuesAt = (x: number): string[] | undefined => {
    const out: string[] = []
    for (const prop of props) {
      const v = valueAt(tracks.get(prop) ?? [], x)
      if (v === undefined) return undefined
      out.push(v)
    }
    return out
  }
  // A run with many eased stretches (a creature's day) goes straight from
  // stop to stop: drawing out every easing would take more stops than the
  // scene has room for, where a loop's few are worth them.
  const eased = offsets.slice(1).filter((b, s) => props.some(prop => {
    const keys = tracks.get(prop) ?? []
    const k = keys[keyAt(keys, offsets[s] ?? 0)]
    return k !== undefined && k.ease.kind === 'smooth' && !k.ease.isLinear && valueAt(keys, offsets[s] ?? 0) !== valueAt(keys, b)
  })).length
  const isRun = eased > 6
  for (let s = 0; s + 1 < offsets.length; s++) {
    const [a, b] = [offsets[s] ?? 0, offsets[s + 1] ?? 1]
    const [ta, tb] = [Math.round(a * T), Math.round(b * T)]
    const start = valuesAt(a)
    if (start === undefined) return undefined
    if (tb <= ta) {
      // Too short for a tick: it jumps, at the tick where the next begins.
      points.set(ta, { values: start })
      continue
    }
    // What each property does over this stretch.
    let smooth = false
    let curved = false
    let stepsWant = 0
    for (const prop of props) {
      const keys = tracks.get(prop) ?? []
      const i = keyAt(keys, a)
      const [k0, k1] = [keys[i], keys[i + 1]]
      if (k0 === undefined || k1 === undefined || k0.value === k1.value) continue
      if (k0.ease.kind === 'steps') stepsWant = Math.max(stepsWant, k0.ease.n)
      else {
        smooth = true
        if (!k0.ease.isLinear) curved = true
      }
    }
    const span = tb - ta
    if (!smooth && stepsWant === 0) {
      points.set(ta, { values: start })
      continue
    }
    if (!smooth) {
      // Discrete steps keep about their own rate, in whole ticks.
      const k = divisorNear(span, Math.min(stepsWant * (span / ((b - a) * T)), span))
      points.set(ta, { values: start, steps: k })
      continue
    }
    let pieces = curved && !isRun ? piecesFor(span, x => valuesAt(a + (b - a) * x), isTrip ? TRIP_SLACK : SLACK) : 1
    const cuts: { at: number; values: string[] }[] = []
    for (let j = 0; j < pieces; j++) {
      const v = valuesAt(a + ((b - a) * j) / pieces)
      if (v === undefined) {
        // A value that cannot be blended by number runs straight instead.
        pieces = 1
        cuts.length = 0
        cuts.push({ at: ta, values: start })
        break
      }
      cuts.push({ at: ta + Math.round((span * j) / pieces), values: v })
    }
    cuts.forEach((cut, j) => {
      const next = cuts[j + 1]?.at ?? tb
      if (next > cut.at) points.set(cut.at, { values: cut.values, steps: next - cut.at })
    })
  }
  const end = valuesAt(1)
  if (end === undefined) return undefined
  points.set(T, { values: end })
  // The commonest step count is the timing; the others are written on the
  // keyframe that starts their stretch.
  const counts = new Map<number, number>()
  for (const p of points.values()) if (p.steps !== undefined) counts.set(p.steps, (counts.get(p.steps) ?? 0) + 1)
  const common = [...counts].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0]?.[0] ?? 1
  const groups = new Map<string, string[]>()
  for (const [at, p] of [...points].sort((x, y) => x[0] - y[0])) {
    const decl = props.map((prop, i) => `${prop}:${p.values[i]}`).join(';') + (p.steps === undefined || p.steps === common ? '' : `;animation-timing-function:steps(${p.steps})`)
    groups.set(decl, [...(groups.get(decl) ?? []), pctOf(at, T)])
  }
  return { body: [...groups].map(([decl, ats]) => `${ats.join(',')}{${decl}}`).join(''), timing: `steps(${common})`, ticks: T }
}

// Tick `at` of `T` as a keyframe offset, as short as keeps it within a
// fraction of a millisecond of the tick: well inside the frame it falls in,
// unless that frame happens to start that close to it.
function pctOf(at: number, T: number): string {
  const p = (at / T) * 100
  const msPerPct = (T / FPS) * 10
  // A stop of a long run, rare, may stray further than one of a short loop.
  const slack = T < 20 * FPS ? 0.25 : 1
  for (let d = 0; d < 7; d++) {
    const r = Math.round(p * 10 ** d) / 10 ** d
    if (Math.abs(r - p) * msPerPct <= slack) return `${trim(r)}%`
  }
  return `${trim(Math.round(p * 1e7) / 1e7)}%`
}

// The variables that hold a time in seconds: the wall clock and each
// element's own phase or offset.
const TIME_VARS = /(--(?:t|d|a|b|c|n|h|f|e)):(-?\d*\.?\d+)(?=[;"}\s]|s[;"}\s])/g
const DELAY = /animation-delay:(-?\d*\.?\d+)s/g
const TIME = /^(-?\d*\.?\d+)(m?s)$/
const TIMING = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\(.*\)|steps\(.*\))$/

// One animation of a shorthand, read: its words, and which of them are its
// keyframes, duration, delay and timing.
type Item = { tokens: string[]; name?: number; duration?: number; delay?: number; timing?: number }

function itemOf(text: string, isKeyframes: (name: string) => boolean): Item {
  const tokens = splitTop(text, ' ')
  const item: Item = { tokens }
  tokens.forEach((t, i) => {
    if (TIME.test(t)) {
      if (item.duration === undefined) item.duration = i
      else if (item.delay === undefined) item.delay = i
    } else if (TIMING.test(t)) item.timing = i
    else if (item.name === undefined && isKeyframes(t)) item.name = i
  })
  return item
}

const secondsOf = (t: string): number => parseFloat(t) / (t.endsWith('ms') ? 1000 : 1)

const SHORTHAND = /((?:^|[{;"\s])animation:)([^;}"]*)/g

// How far keyframes `body`, played with `timing`, stray once put on the
// clock as `done`: the most any length in them is off, in px, half way
// through any tick. A drawing on the clock and one with them as written (a
// lean or plain drawing) take turns as the scene is redrawn, so a stray
// shows as a jump at the redraw.
export function strayOf(body: string, timing: string, done: OnClock): number {
  const [written, ticked] = [easeOf(timing), easeOf(done.timing)]
  const a = written === undefined ? undefined : tracksOf(body, written)
  const b = ticked === undefined ? undefined : tracksOf(done.body, ticked)
  if (a === undefined || b === undefined) return 0
  let most = 0
  for (const [prop, keys] of a) {
    const other = b.get(prop) ?? []
    for (let i = 0; i < done.ticks; i++) {
      const x = (i + 0.5) / done.ticks
      const [u, v] = [shape(valueAt(keys, x) ?? ''), shape(valueAt(other, x) ?? '')]
      u.nums.forEach((n, m) => {
        if (u.units[m] === 'px') most = Math.max(most, Math.abs(n - (v.nums[m] ?? n)))
      })
    }
  }
  return most
}

// Where `straysOf` collects each looping animation's stray while it puts a
// scene on the clock.
let strays: { name: string; px: number }[] | undefined

// The stray of every looping animation a scene, as written, has once put on
// the clock (`strayOf`).
export function straysOf(source: string): { name: string; px: number }[] {
  strays = []
  try {
    onClock(source)
    return strays
  } finally {
    strays = undefined
  }
}

// A finished scene, every animation in it on the clock; when `isLean`, but
// for the trips (`way` and `cut` groups) and the runs whose stretches would
// mostly each need a timing of their own (a creature's day): they keep their
// keyframes and timing as written.
export function onClock(source: string, isLean = false): string {
  const open = source.indexOf('<style>')
  const close = source.indexOf('</style>')
  if (open < 0 || close < open) return source
  let css = source.slice(open + 7, close)
  let markup = source.slice(0, open + 7) + '\u0001' + source.slice(close)
  const blocks = new Map<string, string>()
  for (const [name, , body] of keyframesIn(css)) blocks.set(name, body)
  const isKeyframes = (name: string): boolean => blocks.has(name)
  // Each block put on the clock once for each way it is played (a duration,
  // a timing, looped or once); and the blocks also played as written.
  const clocked = new Map<string, Map<string, OnClock | undefined>>()
  const kept = new Set<string>()
  const keyOf = (seconds: number, timing: string, isOnce: boolean): string => `${seconds} ${timing} ${isOnce}`
  const clock = (name: string, seconds: number, timing: string, isOnce: boolean, isTrip = false): OnClock | undefined => {
    const byKey = clocked.get(name) ?? new Map<string, OnClock | undefined>()
    clocked.set(name, byKey)
    const key = keyOf(seconds, timing, isOnce)
    if (!byKey.has(key)) {
      const done = onTicks(blocks.get(name) ?? '', seconds, timing, isOnce, isTrip)
      if (strays !== undefined && done !== undefined && !isOnce) strays.push({ name, px: strayOf(blocks.get(name) ?? '', timing, done) })
      // Lean, a run whose stretches mostly each need a timing of their own
      // stays as written.
      const own = (done?.body.match(/animation-timing-function/g) ?? []).length
      byKey.set(key, isLean && own > 4 ? undefined : done)
    }
    const done = byKey.get(key)
    if (done === undefined) kept.add(name)
    return done
  }
  // The shorthands, item by item.
  type Use = { name: string; seconds: number; timing: string; isOnce: boolean }
  const used = (item: Item): Use | undefined => {
    const name = item.name === undefined ? undefined : item.tokens[item.name]
    if (name === undefined) return undefined
    const duration = item.duration === undefined ? undefined : item.tokens[item.duration]
    if (duration === undefined) {
      kept.add(name)
      return undefined
    }
    const timing = item.timing === undefined ? 'ease' : (item.tokens[item.timing] ?? 'ease')
    return { name, seconds: secondsOf(duration), timing, isOnce: !item.tokens.includes('infinite') }
  }
  const styles = [...markup.matchAll(/\sstyle="([^"]*)"/g)].map(m => m[1] ?? '')
  for (const list of [...css.matchAll(SHORTHAND), ...styles.flatMap(st => [...st.matchAll(SHORTHAND)])].map(m => m[2] ?? '')) {
    for (const item of splitTop(list, ',').map(text => itemOf(text, isKeyframes))) {
      const use = used(item)
      if (use !== undefined) clock(use.name, use.seconds, use.timing, use.isOnce)
    }
  }
  // The groups that play a block once over a duration they inherit (--e),
  // their timing set by class: `way` runs smoothly, `cut` jumps.
  const durations = new Map<string, number>()
  for (const m of css.matchAll(/\.([\w-]+)\{[^{}]*?--e:(-?\d*\.?\d+)s/g)) durations.set(m[1] ?? '', Number(m[2]))
  const runs: { from: number; to: number; tag: string; name: string; seconds: number; timing: string }[] = []
  const stack: (number | undefined)[] = []
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g)) {
    if (m[1] === '/') {
      stack.pop()
      continue
    }
    const attrs = m[3] ?? ''
    const style = /\sstyle="([^"]*)"/.exec(attrs)?.[1] ?? ''
    const classes = (/\sclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/)
    const own = /--e:(-?\d*\.?\d+)s/.exec(style)?.[1]
    const byClass = classes.map(c => durations.get(c)).find(e => e !== undefined)
    const e = own !== undefined ? Number(own) : (byClass ?? stack[stack.length - 1])
    if (m[4] !== '/') stack.push(e)
    const name = /animation-name:([\w-]+)/.exec(style)?.[1]
    const isCut = classes.includes('cut')
    if (isLean || name === undefined || e === undefined || !blocks.has(name) || (!isCut && !classes.includes('way'))) continue
    runs.push({ from: m.index ?? 0, to: (m.index ?? 0) + m[0].length, tag: m[0], name, seconds: e, timing: isCut ? 'step-end' : 'linear' })
    clock(name, e, isCut ? 'step-end' : 'linear', true, true)
  }
  const handled = new Set(runs.map(r => r.from))
  for (const m of markup.matchAll(/<[a-zA-Z](?:[^>"]|"[^"]*")*>/g)) {
    const name = /animation-name:([\w-]+)/.exec(m[0])?.[1]
    if (name !== undefined && !handled.has(m.index ?? 0)) kept.add(name)
  }
  for (const m of css.matchAll(/animation-name:\s*([\w-]+)/g)) kept.add(m[1] ?? '')
  // What each clocked copy is called: the block's own name when the block
  // itself is no longer played. Copies that come out alike (one easing over
  // durations whose stretches split alike) share one name.
  const names = new Map<string, string>()
  const bodies = new Map<string, Map<string, string>>()
  for (const [name, byKey] of clocked) {
    const mine = new Map<string, string>()
    bodies.set(name, mine)
    for (const [key, done] of byKey) {
      if (done === undefined) continue
      let own = mine.get(done.body)
      if (own === undefined) {
        own = !kept.has(name) && mine.size === 0 ? name : `${name}-${mine.size + 1}`
        mine.set(done.body, own)
      }
      names.set(`${name} ${key}`, own)
    }
  }
  const rewrite = (list: string): string =>
    splitTop(list, ',')
      .map(text => {
        const item = itemOf(text, isKeyframes)
        const tokens = [...item.tokens]
        if (item.delay !== undefined) tokens[item.delay] = `${ft(secondsOf(tokens[item.delay] ?? '0s'))}s`
        const use = used(item)
        if (use === undefined || item.name === undefined || item.duration === undefined) return tokens.join(' ')
        const key = keyOf(use.seconds, use.timing, use.isOnce)
        const done = clocked.get(use.name)?.get(key)
        const own = names.get(`${use.name} ${key}`)
        if (done === undefined || own === undefined) return tokens.join(' ')
        tokens[item.name] = own
        tokens[item.duration] = `${ft(done.ticks / FPS)}s`
        if (item.timing === undefined) tokens.push(done.timing)
        else tokens[item.timing] = done.timing
        return tokens.join(' ')
      })
      .join(',')
  css = css.replace(SHORTHAND, (_, head: string, list: string) => head + rewrite(list))
  // The groups that inherit their duration: renamed, and stepped as their
  // keyframes need where their class does not already.
  const out: string[] = []
  let at = 0
  for (const run of runs) {
    const key = keyOf(run.seconds, run.timing, true)
    const done = clocked.get(run.name)?.get(key)
    const own = names.get(`${run.name} ${key}`)
    if (done === undefined || own === undefined) continue
    // A cut's class already jumps.
    const timing = run.timing === 'step-end' && done.timing === 'steps(1)' ? '' : `;animation-timing-function:${done.timing}`
    out.push(markup.slice(at, run.from), run.tag.replace(`animation-name:${run.name}`, `animation-name:${own}${timing}`))
    at = run.to
  }
  out.push(markup.slice(at))
  markup = out.join('').replace(/\sstyle="([^"]*)"/g, (_, style: string) => ` style="${style.replace(SHORTHAND, (__, head: string, list: string) => head + rewrite(list))}"`)
  // The blocks again, with their clocked copies in their place.
  const pieces: string[] = []
  let last = 0
  for (const [name, from, , to] of keyframesIn(css)) {
    const mine = bodies.get(name)
    if (mine === undefined) continue
    pieces.push(css.slice(last, from))
    if (kept.has(name)) pieces.push(css.slice(from, to))
    for (const [body, own] of mine) pieces.push(`@keyframes ${own}{${body}}`)
    last = to
  }
  pieces.push(css.slice(last))
  css = pieces.join('')
  const snap = (_: string, name: string, value: string): string => `${name}:${ft(Number(value))}`
  const delay = (_: string, value: string): string => `animation-delay:${ft(Number(value))}s`
  markup = markup.replace(TIME_VARS, snap).replace(DELAY, delay)
  css = css.replace(TIME_VARS, snap).replace(DELAY, delay)
  return markup.replace('\u0001', css)
}

// Each keyframes block in `css`: its name, where it starts, its body, and
// where it ends.
function keyframesIn(css: string): [string, number, string, number][] {
  const out: [string, number, string, number][] = []
  for (const m of css.matchAll(/@keyframes\s*([\w-]+)\s*\{/g)) {
    let depth = 1
    let i = (m.index ?? 0) + m[0].length
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
    }
    out.push([m[1] ?? '', m.index ?? 0, css.slice((m.index ?? 0) + m[0].length, i - 1), i])
  }
  return out
}
