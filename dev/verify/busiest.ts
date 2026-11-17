// Writes the longest scenes the theme can draw: every boat out, every
// visitor called up three times, a leap, fireworks and the seaplane swapping its cargo at once,
// by day and by night, on the lead boat's circuit and on its way in.
//   node build/busiest.cjs <out dir>
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { VISIT_SECONDS, drawing } from '../../hooks/scene'
import type { SceneState, VisitKind } from '../../hooks/scene'
import { ROUTES } from '../../hooks/fleet'
import { AT_HOME, embark } from '../../hooks/voyage'

const out = process.argv[2]
if (out === undefined) throw new Error('usage: busiest.cjs <out dir>')
mkdirSync(out, { recursive: true })
const NOW = 1_800_000_000_000
const fetch = embark({ ...AT_HOME, at: NOW - 400_000 }, 'fetch', NOW - 2000, false)
const land = embark({ ...fetch, at: NOW - 60_000 }, 'land', NOW - 2000, true)
const boats: SceneState['boats'] = [
  ...ROUTES.crew.map((_, slot) => ({ kind: 'crew' as const, slot, from: 'L' as const, pass: 'under' as const, born: NOW - 3000, gone: undefined })),
  ...ROUTES.shell.map((_, slot) => ({ kind: 'shell' as const, slot, from: 'R' as const, pass: 'over' as const, born: NOW - 40_000, gone: NOW - 2000 })),
]
const visits = (Object.keys(VISIT_SECONDS) as VisitKind[]).flatMap(kind => [0, 1, 2].map(slot => ({ kind, slot, age: VISIT_SECONDS[kind] * (0.2 + slot * 0.25) })))
for (const [name, voyage, mood] of [['fetch', fetch, 'working'], ['land', land, 'done']] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    const state: SceneState = { mood, flag: { from: 'question', to: 'error', age: 1, hailed: 2 }, voyage, boats, plane: { at: NOW - 30000, done: NOW - 5000, swap: NOW - 2000 }, isLeaping: true, fireworks: 2, scheme, seconds: NOW / 1000, visits }
    for (const [what, s] of [['', state], ['-alone', { ...state, visits: [] }]] as const) {
      const d = drawing(s)
      writeFileSync(join(out, `busiest-${name}-${scheme}${what}.svg`), d.source)
      console.log(name, scheme, what, d.source.length, d.isPlain ? 'plain' : 'full')
    }
  }
}
