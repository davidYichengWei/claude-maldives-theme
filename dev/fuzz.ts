import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import { AT_HOME, embark, planOf } from '../hooks/voyage'
import type { Voyage } from '../hooks/voyage'
import { writeFileSync } from 'fs'
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
// The trip the debug output describes: a fetch at this stamp, from an island day.
let v: Voyage = { ...AT_HOME }
let now = 1794672000000
for (let i = 0; i < 400; i++) {
  now += Math.round(200 + rnd() * rnd() * 400000)
  const phase = v.phase === 'land' ? 'fetch' : 'land'
  v = embark(v, phase, now, rnd() < 0.5)
  const plan = planOf(v)
  for (const dt of [0.02, 0.4, 2, plan.boards - 0.1, plan.lands + 0.1, plan.settled - 0.2, plan.settled + 0.5, plan.gone + 1, 60]) {
    const t0 = Date.now()
    let svg = ''
    try { svg = scene(base(v, now + Math.max(0, dt) * 1000, phase === 'fetch' ? 'working' : 'done')) } catch (e) { bad.push(`${i} ${phase} dt ${dt} threw ${(e as Error).stack?.slice(0, 300)}`); continue }
    slowest = Math.max(slowest, Date.now() - t0)
    lint(svg, `${i} ${phase} dt ${dt.toFixed(1)}`)
    lint(scene(varied(v, now + Math.max(0, dt) * 1000, phase === 'fetch' ? 'working' : 'done', i)), `${i} ${phase} dt ${dt.toFixed(1)} varied`)
    if (i === 3 && dt === 0.4) writeFileSync('fuzz-sample.svg', svg)
  }
}
console.log('bad', bad.length, bad.slice(0, 8).join('\n'), '| slowest build ms', slowest, '| largest', largest)
const exact = embark({ ...AT_HOME }, 'fetch', 1794672780488, false)
const t0 = Date.now(); const s = scene(base(exact, 1794672780488 + 400, 'working')); console.log('exact build ms', Date.now() - t0, s.length)
writeFileSync('exact.svg', s)
