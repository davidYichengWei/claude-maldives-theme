import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import { AT_HOME, embark, planOf } from '../hooks/voyage'
import type { Voyage } from '../hooks/voyage'
import { writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { cpus } from 'os'
import { constructsOf, PROVEN } from './verify/constructs'
const base = (voyage: Voyage, now: number, mood: SceneState['mood']): SceneState => ({ mood, flag: { from: 'none', to: 'none', age: 99 }, voyage, boats: [], isCompacting: false, isLeaping: true, fireworks: undefined, scheme: 'dark', seconds: now / 1000 })
// The same, with the rest of the state drawn at random, so every kind of
// scene (each scheme, boats out and leaving, flags, fireworks, compacting,
// plain) comes up.
const SIGNALS = ['none', 'permission', 'question', 'plan', 'error'] as const
const SCHEMES = ['light', 'dark', undefined] as const
const varied = (voyage: Voyage, now: number, mood: SceneState['mood'], k: number): SceneState => {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T
  const boats = Array.from({ length: Math.floor(rnd() * 7) }, (_, slot) => ({ kind: rnd() < 0.5 ? 'crew' : 'shell', slot, from: rnd() < 0.5 ? 'L' : 'R', pass: rnd() < 0.5 ? 'under' : 'over', born: now - rnd() * 90000, gone: rnd() < 0.2 ? now - rnd() * 3000 : undefined })) as SceneState['boats']
  return { ...base(voyage, now, mood), flag: { from: pick(SIGNALS), to: pick(SIGNALS), age: rnd() * 3, hailed: rnd() * 5 }, boats, isCompacting: rnd() < 0.2, isLeaping: rnd() < 0.4, fireworks: rnd() < 0.2 ? rnd() * 9 : undefined, scheme: SCHEMES[k % 3] }
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
  largest = Math.max(largest, svg.length)
  for (const construct of constructsOf(svg)) if (!PROVEN.has(construct)) bad.push(`${what} uses ${construct}, never seen working in the app (verify/constructs.ts)`)

}
// The scenes are shared out over FUZZ_JOBS processes (default: half the
// CPUs, at most 16). Every process walks the whole trip and draws the same
// random states, so each scene is the same whichever process builds it; a
// process builds and checks only the trips whose number falls to it.
const SHARD = process.env.FUZZ_SHARD
if (SHARD === undefined) {
  const jobs = Math.max(1, Number(process.env.FUZZ_JOBS) || Math.min(16, Math.floor(cpus().length / 2)))
  const runs = Array.from({ length: jobs }, (_, k) => new Promise<{ bad: string[]; slowest: number; largest: number }>((done, fail) => {
    const child = spawn(process.execPath, [process.argv[1] ?? ''], { env: { ...process.env, FUZZ_SHARD: `${k}/${jobs}` }, stdio: ['ignore', 'pipe', 'inherit'] })
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString() })
    child.on('close', code => code === 0 ? done(JSON.parse(out)) : fail(new Error(`fuzz shard ${k} exited ${code}`)))
  }))
  Promise.all(runs).then(parts => {
    const all = parts.flatMap(p => p.bad)
    console.log('bad', all.length, all.slice(0, 8).join('\n'), '| slowest build ms', Math.max(...parts.map(p => p.slowest)), '| largest', Math.max(...parts.map(p => p.largest)))
    const exact = embark({ ...AT_HOME }, 'fetch', 1794672780488, false)
    const t0 = Date.now(); const s = scene(base(exact, 1794672780488 + 400, 'working')); console.log('exact build ms', Date.now() - t0, s.length)
    writeFileSync('exact.svg', s)
  }, (e: Error) => { console.error(e.message); process.exit(1) })
} else {
  const [shard, shards] = SHARD.split('/').map(Number) as [number, number]
// The trip the debug output describes: a fetch at this stamp, from an island day.
let v: Voyage = { ...AT_HOME }
let now = 1794672000000
for (let i = 0; i < 400; i++) {
  now += Math.round(200 + rnd() * rnd() * 400000)
  const phase = v.phase === 'land' ? 'fetch' : 'land'
  v = embark(v, phase, now, rnd() < 0.5)
  const plan = planOf(v)
  for (const dt of [0.02, 0.4, 2, plan.boards - 0.1, plan.lands + 0.1, plan.settled - 0.2, plan.settled + 0.5, plan.gone + 1, 60]) {
    const mood = phase === 'fetch' ? 'working' : 'done'
    const other = varied(v, now + Math.max(0, dt) * 1000, mood, i)
    if (i % shards !== shard) continue
    const t0 = Date.now()
    let svg = ''
    try { svg = scene(base(v, now + Math.max(0, dt) * 1000, mood)) } catch (e) { bad.push(`${i} ${phase} dt ${dt} threw ${(e as Error).stack?.slice(0, 300)}`); continue }
    slowest = Math.max(slowest, Date.now() - t0)
    lint(svg, `${i} ${phase} dt ${dt.toFixed(1)}`)
    lint(scene(other), `${i} ${phase} dt ${dt.toFixed(1)} varied`)
    if (i === 3 && dt === 0.4) writeFileSync('fuzz-sample.svg', svg)
  }
}
process.stdout.write(JSON.stringify({ bad, slowest, largest }))
}
