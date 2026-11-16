// Writes the scenes perf.cjs measures: an idle day ashore, the same by night,
// and a working day with the lead boat on its circuit and boats out.
//   node build/perf-scenes.cjs <out dir>
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { scene } from '../../hooks/scene'
import type { SceneState } from '../../hooks/scene'
import { AT_HOME, embark } from '../../hooks/voyage'

const out = process.argv[2]
if (out === undefined) {
  throw new Error('usage: perf-scenes.cjs <out dir>')
}
mkdirSync(out, { recursive: true })
const NOW = 1_800_000_000_000
const home = { ...AT_HOME, at: NOW - 600_000 }
const base: SceneState = {
  mood: 'idle',
  flag: { from: 'none', to: 'none', age: 99 },
  voyage: home,
  boats: [],
  isCompacting: false,
  isLeaping: false,
  fireworks: undefined,
  scheme: 'light',
  seconds: NOW / 1000,
}
const fleet: SceneState['boats'] = [
  { kind: 'crew', slot: 0, from: 'L', pass: 'under', born: NOW - 200_000, gone: undefined },
  { kind: 'crew', slot: 1, from: 'R', pass: 'over', born: NOW - 150_000, gone: undefined },
  { kind: 'shell', slot: 0, from: 'L', pass: 'under', born: NOW - 120_000, gone: undefined },
  { kind: 'shell', slot: 1, from: 'R', pass: 'over', born: NOW - 90_000, gone: undefined },
]
const scenes: Record<string, SceneState> = {
  'idle-day': base,
  'idle-night': { ...base, scheme: 'dark' },
  'working-day': { ...base, mood: 'working', voyage: embark(home, 'fetch', NOW - 120_000, false), boats: fleet },
}
for (const [name, state] of Object.entries(scenes)) {
  writeFileSync(join(out, `${name}.svg`), scene(state))
}
