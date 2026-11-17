import { drawing, scene, written, VISIT_SECONDS } from '../hooks/scene'
import { straysOf } from '../hooks/clock'
import type { SceneState, Visit, VisitKind } from '../hooks/scene'
import { AT_HOME, DECK, DOCK, JETTY, STOCKED, WAIT, swapSeconds, embark, isOnWalk, isPierDeck, planOf, planeCalled, stageAt, steer, steerAll } from '../hooks/voyage'
import type { Leg, Pantry, Plane, Voyage } from '../hooks/voyage'
import type { Point } from '../hooks/fleet'
import { writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { cpus } from 'os'
import { constructsOf, PROVEN } from './verify/constructs'
const base = (voyage: Voyage, now: number, mood: SceneState['mood'], pantry: Pantry = STOCKED, plane?: Plane): SceneState => ({ mood, flag: { from: 'none', to: 'none', age: 99 }, voyage, boats: [], plane, isLeaping: true, fireworks: undefined, scheme: 'dark', seconds: now / 1000, pantry })
// The same, with the rest of the state drawn at random, so every kind of
// scene (each scheme, boats out and leaving, flags, fireworks, the seaplane,
// plain) comes up, with calls out: often none, sometimes a few, and now and
// then the most of every kind at once, the longest a scene can be.
const SIGNALS = ['none', 'permission', 'question', 'plan', 'error'] as const
const SCHEMES = ['light', 'dark', undefined] as const
const varied = (voyage: Voyage, now: number, mood: SceneState['mood'], k: number, pantry: Pantry = STOCKED, plane?: Plane): SceneState => {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T
  const boats = Array.from({ length: Math.floor(rnd() * 7) }, (_, slot) => ({ kind: rnd() < 0.5 ? 'crew' : 'shell', slot, from: rnd() < 0.5 ? 'L' : 'R', pass: rnd() < 0.5 ? 'under' : 'over', born: now - rnd() * 90000, gone: rnd() < 0.2 ? now - rnd() * 3000 : undefined })) as SceneState['boats']
  const KINDS = Object.keys(VISIT_SECONDS) as VisitKind[]
  const crowd = rnd()
  const visits: Visit[] = crowd < 0.4 ? [] : KINDS.flatMap(kind => Array.from({ length: crowd > 0.85 ? 3 : Math.floor(rnd() * 4) }, (_, slot) => ({ kind, age: rnd() * VISIT_SECONDS[kind], slot })))
  // The seaplane now and then where the trip has none: coming in, moored, or
  // swapping its cargo (the crate going with it) and leaving.
  const swapAt = now - rnd() * 30000
  const flown: { plane?: Plane; pantry: Pantry } = plane !== undefined || rnd() >= 0.2 ? { plane, pantry } : rnd() < 0.5 ? { plane: { at: now - rnd() * 40000 }, pantry } : (() => { const stock = Math.floor(rnd() * 3); return { plane: { at: swapAt - 25000, done: swapAt - 3000, swap: swapAt, cargo: 5 - stock }, pantry: { ...pantry, stock: 5, filled: { at: swapAt, stock } } } })()
  return { ...base(voyage, now, mood, flown.pantry, flown.plane), visits, flag: { from: pick(SIGNALS), to: pick(SIGNALS), age: rnd() * 3, hailed: rnd() * 5 }, boats, isLeaping: rnd() < 0.4, fireworks: rnd() < 0.2 ? rnd() * 9 : undefined, scheme: SCHEMES[k % 3] }
}
// What the mascot stands on at `p`: the deck of the boat at the dock or off
// the boardwalk, the jetty, the boardwalk, the island, or nothing (in the air
// over the water).
const footing = (p: Point): string =>
  (Math.abs(p.y - DOCK.y) < 2 && Math.abs(p.x - DOCK.x) <= DECK + 1) || isPierDeck(p) ? 'deck' : isOnWalk(p) ? 'walk' : p.x >= JETTY.root - 6 ? 'island' : p.x >= JETTY.tip - 1 && Math.abs(p.y - JETTY.y) <= 3 ? 'jetty' : 'air'
// The mascot gets anywhere off its feet only by a hop: a stretch of any other
// kind that starts or ends in the air, or goes between the deck and the jetty
// or the boardwalk, is a fault.
const legFaults = (legs: readonly Leg[], what: string): void => {
  for (const leg of legs) {
    if (leg.hop !== undefined) continue
    const [a, b] = [footing(leg.at(0)), footing(leg.at(1))]
    if (a === 'air' || b === 'air' || (a !== b && [a, b].every(one => one === 'deck' || one === 'jetty' || one === 'walk'))) {
      bad.push(`${what}: the mascot goes from the ${a} to the ${b} without a hop`)
      return
    }
  }
}
// Whatever moment a trip gives way to the next, the same holds. A trip
// called in the middle of a hop once floated it down or across instead.
const footFaults = (last: Voyage, phase: Voyage['phase'], at: number, what: string): void => {
  const plan = planOf(embark(last, phase, at, false))
  legFaults([...plan.clawd, ...(plan.errand?.walk ?? [])], process.env.FUZZ_DUMP === undefined ? what : `${what} ${JSON.stringify(last)}`)
}
let r = 12345
const rnd = (): number => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648 }
const bad: string[] = []
let slowest = 0
let largest = 0
const lint = (svg: string, what: string): void => {
  const css = svg.slice(svg.indexOf('<style>') + 7, svg.indexOf('</style>'))
  let depth = 0
  for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) break } }
  if (depth !== 0) bad.push(what + ' braces ' + depth)
  for (const word of ['NaN', 'undefined', 'Infinity', 'null', '[object']) if (svg.includes(word)) bad.push(what + ' has ' + word + ' …' + svg.slice(Math.max(0, svg.indexOf(word) - 80), svg.indexOf(word) + 30))
  // The engine refuses a backdrop longer than this; `ROOM` keeps a margin.
  if (svg.length > 131072) bad.push(`${what} is ${svg.length} long, past the engine's limit`)
  if (svg.length > largest && process.env.FUZZ_LARGEST !== undefined) writeFileSync(`${process.env.FUZZ_LARGEST}-${process.pid}.svg`, `<!-- ${what} -->\n${svg}`)
  largest = Math.max(largest, svg.length)
  for (const construct of constructsOf(svg)) if (!PROVEN.has(construct)) bad.push(`${what} uses ${construct}, never seen working in the app (verify/constructs.ts)`)

}
// What in a scene animates off its clock (hooks/clock.ts): a shorthand or a
// keyframe that eases smoothly, or a trip group the clock gave no steps. A
// scene drawn lean leaves its trips and runs off the clock on purpose.
let lean = 0
let drawnCount = 0
const clockLint = (drawn: { source: string; isLean: boolean }, what: string): void => {
  drawnCount++
  if (drawn.isLean) {
    lean++
    return
  }
  const svg = drawn.source
  const off = (timing: string): boolean => !/steps\(|step-end|step-start/.test(timing)
  for (const m of svg.matchAll(/animation:([^;}"]*)/g)) {
    for (const item of (m[1] ?? '').split(/,(?![^(]*\))/)) if (off(item)) bad.push(`${what} animates off the clock: ${item.trim()}`)
  }
  for (const block of svg.match(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g) ?? []) {
    for (const m of block.matchAll(/animation-timing-function:([^;}]*)/g)) if (off(m[1] ?? '')) bad.push(`${what} keyframes off the clock: ${block.slice(0, 60)}… ${m[1]}`)
  }
  for (const m of svg.matchAll(/<[^>]*\sclass="way[^"]*"[^>]*>/g)) {
    if (/animation-name:/.test(m[0]) && !/animation-timing-function:steps/.test(m[0])) bad.push(`${what} trip off the clock: ${m[0].slice(0, 120)}`)
  }

}
// The scenes are shared out over FUZZ_JOBS processes (default: half the
// CPUs, at most 16). Every process walks the whole trip and draws the same
// random states, so each scene is the same whichever process builds it; a
// process builds and checks only the trips whose number falls to it.
const SHARD = process.env.FUZZ_SHARD
if (SHARD === undefined) {
  const jobs = Math.max(1, Number(process.env.FUZZ_JOBS) || Math.min(16, Math.floor(cpus().length / 2)))
  const runs = Array.from({ length: jobs }, (_, k) => new Promise<{ bad: string[]; slowest: number; largest: number; lean: number; drawn: number }>((done, fail) => {
    const child = spawn(process.execPath, [process.argv[1] ?? ''], { env: { ...process.env, FUZZ_SHARD: `${k}/${jobs}` }, stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
    child.on('close', code => code === 0 ? done(JSON.parse(out)) : fail(new Error(`fuzz shard ${k} exited ${code}`)))
  }))
  Promise.all(runs).then(parts => {
    const all = parts.flatMap(p => p.bad)
    console.log('bad', all.length, all.slice(0, Number(process.env.FUZZ_SHOW) || 8).join('\n'), '| slowest build ms', Math.max(...parts.map(p => p.slowest)), '| largest', Math.max(...parts.map(p => p.largest)), '| drawn lean', parts.reduce((n, p) => n + p.lean, 0), 'of', parts.reduce((n, p) => n + p.drawn, 0))
    const exact = embark({ ...AT_HOME }, 'fetch', 1794672780488, false)
    const t0 = Date.now(); const s = scene(base(exact, 1794672780488 + 400, 'working')); console.log('exact build ms', Date.now() - t0, s.length)
    writeFileSync('exact.svg', s)
  }, (e: Error) => { console.error(e.message); process.exit(1) })
} else {
  const [shard, shards] = SHARD.split('/').map(Number) as [number, number]
// Every looping animation, put on the clock, stays within STRAY_PX of how
// it was written, in every kind of scene: drawings on the clock and drawings
// with it as written take turns, and a stray shows as a jump at the redraw.
const STRAY_PX = 8
if (shard === 0) {
  const at = 1794672000000
  for (const [k, mood] of (['idle', 'working', 'done'] as const).entries()) {
    const visits: Visit[] = (Object.keys(VISIT_SECONDS) as VisitKind[]).map(kind => ({ kind, age: 0, slot: 0 }))
    const plane: Plane | undefined = k === 1 ? { at: at - 10000 } : undefined
    for (const [name, px] of new Map(straysOf(written({ ...base({ ...AT_HOME }, at + k * 977000, mood, STOCKED, plane), visits })).map(s => [s.name, s.px]))) {
      if (px > STRAY_PX) bad.push(`${name} strays ${px.toFixed(1)}px from its keyframes once on the clock`)
    }
  }
}
// The trip the debug output describes: a fetch at this stamp, from an island day.
let v: Voyage = { ...AT_HOME }
let now = 1794672000000
// The coconuts as they stand before each trip, and the seaplane of the trip.
let pantry: Pantry = STOCKED
let plane: Plane | undefined
for (let i = 0; i < 400; i++) {
  now += Math.round(200 + rnd() * rnd() * 400000)
  const phase = v.phase === 'land' ? 'fetch' : 'land'
  v = embark(v, phase, now, rnd() < 0.5)
  // Half the trips are sent by the boardwalk a while in, owed a coconut or
  // two; a crate down to its last is filled again.
  if (rnd() < 0.5) {
    const later = now + Math.round(rnd() * rnd() * 30000)
    const sent = steer(v, pantry.stock <= 1 ? STOCKED : pantry, phase, false, Math.max(0, pantry.stock - 1 - Math.floor(rnd() * 2)), later)
    if (sent.voyage !== v) {
      v = sent.voyage
      now = later
    }
    pantry = sent.pantry
  }
  // A quarter of the trips have the seaplane called a while in, the mascot
  // sent to wait for it; in most the compaction is over a while later, and
  // in some the mascot has left the walk again.
  plane = undefined
  if (rnd() < 0.25) {
    const calledAt = now + Math.round(rnd() * rnd() * 30000)
    const waiting = steerAll(v, pantry, planeCalled(undefined, calledAt), phase, false, pantry.stock, calledAt)
    ;[v, pantry, plane, now] = [waiting.voyage, waiting.pantry, waiting.plane, calledAt]
    if (rnd() < 0.7 && plane !== undefined) {
      const doneAt = calledAt + Math.round(rnd() * 60000)
      const level = 5 - Math.floor(rnd() * 2)
      const swapped = steerAll(v, pantry, { ...plane, done: doneAt }, phase, false, level, doneAt)
      ;[v, pantry, plane, now] = [swapped.voyage, swapped.pantry, swapped.plane, swapped.voyage === v ? now : doneAt]
      const swap = plane?.swap
      if (swap !== undefined) {
        const stage = stageAt(v, swap)
        if (stage.aboard || Math.abs(stage.clawd.x - WAIT.x) > 1 || Math.abs(stage.clawd.y - WAIT.y) > 1) bad.push(`${i} ${phase}: the cargo is swapped with the mascot not waiting on the walk (${JSON.stringify(stage)})`)
        if (rnd() < 0.4) {
          const end = swap + swapSeconds(plane?.cargo ?? 0) * 1000
          const off = steerAll(v, pantry, plane, phase, false, level, end)
          ;[v, pantry, now] = [off.voyage, off.pantry, end]
          if (off.voyage.wait === true) bad.push(`${i} ${phase}: still waiting once the plane is unloaded`)
        }
      }
    }
  }
  const plan = planOf(v)
  if (i % shards === shard) {
    legFaults([...plan.clawd, ...(plan.errand?.walk ?? [])], `${i} ${phase}`)
    for (let dt = 0; dt < Math.min(plan.settled + 1, 45); dt += 0.05) footFaults(v, phase === 'fetch' ? 'land' : 'fetch', now + dt * 1000, `${i} ${phase} called away at ${dt.toFixed(2)}s`)
  }
  const errand = plan.errand
  const byWalk = errand === undefined ? [] : [errand.off - 0.1, errand.off + 0.4, ...errand.takes.map(at => at - 0.2), ...errand.tosses.map(at => at + 0.3), errand.back - 0.3, errand.back + 0.2]
  // The scene draws the crate from how it stood as the trip set out.
  const before = v.errand === undefined ? pantry : { ...v.errand.from }
  // About the plane: as it lands and moors, and through its cargo swap and
  // take-off.
  const swapS = plane?.swap === undefined ? undefined : (plane.swap - now) / 1000
  const byPlane = plane === undefined ? [] : [(plane.at - now) / 1000 + 10, (plane.at - now) / 1000 + 19, ...(swapS === undefined ? [] : [0.2, 0.9, 2.5, 3.7, 4.3, 5, 6.5, 10, 14, 19].map(s => swapS + s))]
  // Waiting for the plane, the mascot is never back aboard: no moment for that.
  for (const dt of [0.02, 0.4, 2, plan.boards - 0.1, plan.lands + 0.1, plan.settled - 0.2, plan.settled + 0.5, plan.gone + 1, 60, ...byWalk, ...byPlane].filter(Number.isFinite)) {
    const mood = phase === 'fetch' ? 'working' : 'done'
    const other = varied(v, now + Math.max(0, dt) * 1000, mood, i, pantry, plane)
    if (i % shards !== shard) continue
    const t0 = Date.now()
    let svg = ''
    let drawn: ReturnType<typeof drawing>
    try { drawn = drawing(base(v, now + Math.max(0, dt) * 1000, mood, pantry, plane)) } catch (e) { bad.push(`${i} ${phase} dt ${dt} threw ${(e as Error).stack?.slice(0, 300)}`); continue }
    if (before.stock < 0) bad.push(`${i} ${phase}: the crate stood at ${JSON.stringify(before)}`)
    svg = drawn.source
    slowest = Math.max(slowest, Date.now() - t0)
    lint(svg, `${i} ${phase} dt ${dt.toFixed(1)}`)
    clockLint(drawn, `${i} ${phase} dt ${dt.toFixed(1)}`)
    const busy = drawing(other)
    if (process.env.FUZZ_DUMP !== undefined && busy.source.length > 131072) writeFileSync(`build/long-${i}-${dt.toFixed(1)}.json`, JSON.stringify(other))
    lint(busy.source, `${i} ${phase} dt ${dt.toFixed(1)} varied`)
    clockLint(busy, `${i} ${phase} dt ${dt.toFixed(1)} varied`)
    if (i === 3 && dt === 0.4) writeFileSync('fuzz-sample.svg', svg)
  }
}
process.stdout.write(JSON.stringify({ bad, slowest, largest, lean, drawn: drawnCount }))
}
