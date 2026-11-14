import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import { ROUTES, whereabouts, enterSeconds, leaveSeconds, passAt, fixAt, sailsBehind } from '../hooks/fleet'
import type { Boat, BoatKind, Side, Pass } from '../hooks/fleet'
import { writeFileSync } from 'fs'
const NOW = 1234500
const b = (kind: BoatKind, slot: number, ageS: number, goneAgoS?: number, from: Side = 'L', pass: Pass = 'under'): Boat => ({ kind, slot, from, pass, born: NOW - ageS * 1000, gone: goneAgoS === undefined ? undefined : NOW - goneAgoS * 1000 })
import { AT_HOME, embark } from '../hooks/voyage'
const base: SceneState = { mood: 'idle', flag: { from: 'none', to: 'none', age: 99 }, voyage: { ...AT_HOME, at: NOW - 3000000 }, boats: [], isCompacting: false, isLeaping: false, isCelebrating: false, scheme: undefined, seconds: NOW / 1000 }
const out = embark({ ...AT_HOME, at: NOW - 900000 }, 'fetch', NOW - 70000, false)
const back = embark(out, 'land', NOW - 4000, true)
const all: Boat[] = [...[0, 1, 2, 3, 4].map(i => b('crew', i, 30 + i * 9)), ...[0, 1, 2, 3, 4].map(i => b('shell', i, 25 + i * 13))]
const states: Record<string, Partial<SceneState>> = {
  idle: {},
  working: { voyage: out, mood: 'working', boats: [b('crew', 0, 30), b('crew', 1, 3), b('shell', 0, 50), b('shell', 1, 4)], isCompacting: true },
  permission: { voyage: out, mood: 'waiting', flag: { from: 'none', to: 'permission', age: 99 } },
  question: { voyage: out, mood: 'waiting', flag: { from: 'none', to: 'question', age: 99 } },
  plan: { voyage: out, mood: 'waiting', flag: { from: 'none', to: 'plan', age: 99 } },
  error: { voyage: out, mood: 'error', flag: { from: 'none', to: 'error', age: 99 } },
  done: { voyage: back, mood: 'done', boats: [b('shell', 0, 33), b('crew', 0, 50, 5, 'L', 'under'), b('crew', 2, 50, 6.5, 'L', 'over'), b('crew', 3, 4, undefined, 'R', 'over')] },
  fireworks: { voyage: out, mood: 'working', boats: all, isCompacting: true, isLeaping: true, isCelebrating: true },
  fleet: { voyage: out, mood: 'working', boats: [all[0]!, all[1]!, all[2]!, all[5]!, all[6]!, all[7]!] },
}
let max = 0
for (const [name, patch] of Object.entries(states)) { const s = scene({ ...base, ...patch }); max = Math.max(max, s.length); writeFileSync(name + '.svg', s) }
// Worst case for size: everything entering or leaving at once, mid-trip.
const moving = [...[0, 1, 2, 3, 4].map(i => b('crew', i, 3)), ...[0, 1, 2, 3, 4].map(i => b('shell', i, 40, 2))]
const extras = { boats: moving, isLeaping: true, isCelebrating: true, isCompacting: true }
const busyOut = scene({ ...base, ...extras, voyage: embark({ ...AT_HOME, at: NOW - 900000 }, 'fetch', NOW - 2000, false), mood: 'working' })
const busyBack = scene({ ...base, ...extras, voyage: embark(out, 'land', NOW - 2000, true), mood: 'done' })
console.log('max len', max, 'busiest fetch', busyOut.length, 'busiest land', busyBack.length, 'plain?', !busyOut.includes('@keyframes ca{'), !busyBack.includes('@keyframes la{'))

const SIZE: Record<BoatKind, [number, number]> = { lead: [78, 76], crew: [58, 60], shell: [86, 52] }
const hits = new Set<string>()
let trails = ''
const blocked = (x: number, y: number): boolean => {
  if (x < 610 && y < 600) return true
  if (x > 1120 && x < 1250 && y > 696 && y < 734) return true
  if (x >= 1370) return Math.abs(y - 700) < 64
  const u = (x - 1370) / 200, v = (y - 700) / 64
  return u * u + v * v < 1
}
const test = (boat: Boat, what: string, x: number, y: number): void => {
  const [w, h] = SIZE[boat.kind]; const scale = ROUTES[boat.kind][boat.slot]!.scale
  for (const px of [x - (w * scale) / 2, x - (w * scale) / 4, x, x + (w * scale) / 4, x + (w * scale) / 2]) for (const py of [y - h * scale, y - (h * scale) / 2, y + 6])
    if (px > -40 && px < 1640 && blocked(px, py)) { hits.add(`${boat.kind}${boat.slot} from ${boat.from} pref ${boat.pass} ${what}`); return }
}
let steepest = 0
const walk = (boat: Boat, t0: number, t1: number, what: string, colour: string, dash: boolean): void => {
  let d = ''; let prev: { x: number; y: number } | undefined
  for (let t = t0; t <= t1 + 1e-6; t += 0.2) {
    const p = whereabouts(boat, t * 1000); test(boat, what, p.x, p.y)
    if (prev && Math.abs(p.x - prev.x) > 2) steepest = Math.max(steepest, Math.abs(p.y - prev.y) / Math.abs(p.x - prev.x))
    prev = p; d += `${d ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  trails += `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${dash ? 1 : 2}"${dash ? ' stroke-dasharray="5 4"' : ''} opacity=".85"/>`
}
const tally: Record<string, number> = {}
for (const kind of ['crew', 'shell'] as BoatKind[]) ROUTES[kind].forEach((route, slot) => {
  for (const from of ['L', 'R'] as Side[]) for (const pass of ['over', 'under'] as Pass[]) {
    const boat: Boat = { kind, slot, from, pass, born: 0, gone: undefined }
    const colour = pass === 'over' ? '#ff0' : '#f0f'
    walk(boat, 0, enterSeconds(boat) + route.seconds, 'in/lap', colour, false)
    for (let g = 0.4; g <= enterSeconds(boat) + route.seconds; g += route.seconds / 11) {
      const leaving = { ...boat, gone: g * 1000 }
      const took = from === 'L' ? passAt(leaving, fixAt(leaving, g)) : 'left'
      tally[`${kind} out ${took}${took !== 'left' && took !== pass ? ' (forced)' : ''}`] = (tally[`${kind} out ${took}${took !== 'left' && took !== pass ? ' (forced)' : ''}`] ?? 0) + 1
      walk(leaving, g, g + leaveSeconds(leaving), `out(g=${g.toFixed(0)})`, colour, true)
      void sailsBehind(leaving)
    }
  }
})
console.log(hits.size ? 'HITS:\n' + [...hits].join('\n') : 'no collisions', '| steepest slope', steepest.toFixed(2))
console.log(tally)
writeFileSync('route.svg', scene({ ...base, boats: all }).replace('</svg>', `<g>${trails}<rect x="277" y="0" width="1046" height="1000" fill="none" stroke="#f00" stroke-width="2"/></g></svg>`))
