import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import { AT_HOME, embark, planOf, dayOf, stageAt } from '../hooks/voyage'
import { writeFileSync } from 'fs'
const T0 = 5000000
const base: SceneState = { mood: 'idle', flag: { from: 'none', to: 'none', age: 99 }, voyage: AT_HOME, boats: [], isCompacting: false, isLeaping: false, fireworks: undefined, scheme: undefined, seconds: T0 / 1000 }
// A fetch that starts at T0 from an idle island, then a landing 60 s later.
const idle = { ...AT_HOME, at: T0 - 300000 }
const fetch = embark(idle, 'fetch', T0, false)
const fp = planOf(fetch)
const land = embark(fetch, 'land', T0 + 60000, true)
const lp = planOf(land)
console.log('fetch plan', { boards: fp.boards, settled: fp.settled, clawd: fp.clawd.map(l => [l.from.toFixed(1), l.to.toFixed(1), l.stride]) })
console.log('land plan', { lands: lp.lands, gone: lp.gone, settled: lp.settled, clawd: lp.clawd.map(l => [l.from.toFixed(1), l.to.toFixed(1), l.stride]) })
const day = dayOf(land.at)
console.log('day span', day.span, 'steps', day.steps.length, day.steps.map(s => `${s.until}:${s.doing}@${s.x}`).join(' '))
const out: Record<string, SceneState> = {
  f0: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + 0.2 },
  fa: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + 4.5 },
  fb: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + fp.boards - 0.4 },
  lx: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.gone - 9 },
  f1: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + fp.boards - 1.2 },
  f2: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + fp.boards - 0.4 },
  f3: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + fp.boards + 0.2 },
  f4: { ...base, mood: 'working', voyage: fetch, seconds: T0 / 1000 + fp.settled + 20 },
  l0: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.lands - 0.3 },
  l1: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.lands + 0.7 },
  l2: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.lands + 2.5 },
  l3: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.settled + 1.5 },
  l4: { ...base, mood: 'done', voyage: land, seconds: land.at / 1000 + lp.gone - 3 },
}
// One frame for each thing the mascot does in its day.
for (const doing of ['fish', 'nap', 'sun', 'sip', 'walk'] as const) {
  const i = day.steps.findIndex(s => s.doing === doing)
  const step = day.steps[i]
  if (step) out['d-' + doing] = { ...base, voyage: land, seconds: land.at / 1000 + lp.settled + step.until - 2 }
  else console.log('no', doing, 'in this day')
}
out['night'] = { ...out['l3']!, scheme: 'dark' }
for (const [name, state] of Object.entries(out)) writeFileSync(`fr-${name}.svg`, scene(state))
console.log(stageAt(land, land.at + (lp.settled + 30) * 1000))
