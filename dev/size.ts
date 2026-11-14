import { scene } from '../hooks/scene'
import type { SceneState } from '../hooks/scene'
import type { Boat, BoatKind } from '../hooks/fleet'
import { AT_HOME, embark } from '../hooks/voyage'
const NOW = 1234500
const b = (kind: BoatKind, slot: number, ageS: number, goneAgoS?: number): Boat => ({ kind, slot, from: 'L', pass: 'under', born: NOW - ageS * 1000, gone: goneAgoS === undefined ? undefined : NOW - goneAgoS * 1000 })
const base: SceneState = { mood: 'idle', flag: { from: 'none', to: 'none', age: 99 }, voyage: AT_HOME, boats: [], isCompacting: false, isLeaping: false, isCelebrating: false, scheme: undefined, seconds: NOW / 1000 }
const fetch = embark({ ...AT_HOME, at: NOW - 400000 }, 'fetch', NOW - 2000, false)
const land = embark({ ...fetch, at: NOW - 60000 }, 'land', NOW - 2000, true)
const many = [...[0, 1, 2, 3, 4].map(i => b('crew', i, 3)), ...[0, 1, 2, 3, 4].map(i => b('shell', i, 40, 2))]
const len = (s: Partial<SceneState>): number => scene({ ...base, ...s }).length
console.log('idle', len({}), 'fetch', len({ voyage: fetch, mood: 'working' }), 'land', len({ voyage: land, mood: 'done' }))
console.log('busiest fetch', len({ voyage: fetch, mood: 'working', boats: many, isLeaping: true, isCelebrating: true, isCompacting: true }), 'busiest land', len({ voyage: land, mood: 'done', boats: many, isLeaping: true, isCelebrating: true, isCompacting: true }))
