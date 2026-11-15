import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import { ROUTES } from '../hooks/fleet'
import type { Boat, BoatKind } from '../hooks/fleet'
import { AT_HOME, embark } from '../hooks/voyage'
const NOW = 1234500
const b = (kind: BoatKind, slot: number, ageS: number, goneAgoS?: number): Boat => ({ kind, slot, from: 'L', pass: 'under', born: NOW - ageS * 1000, gone: goneAgoS === undefined ? undefined : NOW - goneAgoS * 1000 })
const base: SceneState = { mood: 'idle', flag: { from: 'none', to: 'none', age: 99 }, voyage: AT_HOME, boats: [], isCompacting: false, isLeaping: false, fireworks: undefined, scheme: undefined, seconds: NOW / 1000 }
const fetch = embark({ ...AT_HOME, at: NOW - 400000 }, 'fetch', NOW - 2000, false)
const land = embark({ ...fetch, at: NOW - 60000 }, 'land', NOW - 2000, true)
// Every circuit taken, the dinghies on their way in and the fishing boats on
// their way out.
const many = [...ROUTES.crew.map((_, i) => b('crew', i, 3)), ...ROUTES.shell.map((_, i) => b('shell', i, 40, 2))]
// A value used before it was declared, or a sum gone wrong, shows up in the
// markup as text rather than as an error.
const len = (s: Partial<SceneState>): number => {
  const source = scene({ ...base, ...s })
  const broken = source.match(/.{0,40}(undefined|NaN).{0,40}/s)
  if (broken !== null) {
    throw new Error(`scene markup holds "${broken[1]}": ${broken[0]}`)
  }
  return source.length
}
console.log('idle', len({}), 'fetch', len({ voyage: fetch, mood: 'working' }), 'land', len({ voyage: land, mood: 'done' }))
console.log('busiest fetch', len({ voyage: fetch, mood: 'working', boats: many, isLeaping: true, fireworks: 2, isCompacting: true }), 'busiest land', len({ voyage: land, mood: 'done', boats: many, isLeaping: true, fireworks: 2, isCompacting: true }))
