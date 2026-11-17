// Writes the scene the layer sweep seeks through: the island at home, a
// fishing boat out, seen at a fixed moment so a sweep is reproducible.
//   node build/sweep-scene.cjs <out.svg>
import { writeFileSync } from 'fs'
import { scene } from '../../hooks/scene'
import { AT_HOME } from '../../hooks/voyage'

const SECONDS = 1000
const out = process.argv[2]
if (out === undefined) {
  throw new Error('usage: sweep-scene.cjs <out.svg>')
}
writeFileSync(out, scene({
  mood: 'idle',
  flag: { from: 'none', to: 'none', age: 99 },
  voyage: AT_HOME,
  boats: [{ kind: 'shell', slot: 0, from: 'L', pass: 'under', born: SECONDS * 1000 - 200000, gone: undefined }],
  isLeaping: false,
  fireworks: undefined,
  scheme: undefined,
  seconds: SECONDS,
}))
