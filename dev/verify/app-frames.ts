// Turns the drawings the plugin kept from the app (a `.record` file in its
// folder; see hooks/register.tsx) into a story directory film.cjs checks, and
// prints what each drawing was and what it brought that the one before did
// not: the scene the app was really handed, frame by frame.
//
//   node build/app-frames.cjs <frames dir> <out dir>
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { constructsOf, PROVEN } from './constructs'

type Kept = { n: number; at: number; file: string; chars: number; changed: string; scheme: string; mood: string; need: string; voyage: unknown; plane: unknown; pantry: unknown; level: number; liveLevel: number; notes: { at: number; what: string }[] }

const [from, out] = process.argv.slice(2)
if (from === undefined || out === undefined) {
  throw new Error('usage: app-frames.cjs <frames dir> <out dir>')
}
const kept = (JSON.parse(readFileSync(join(from, 'frames.json'), 'utf8')) as Kept[]).sort((a, b) => a.n - b.n)
if (kept.length === 0) {
  throw new Error(`${from}/frames.json holds no drawing`)
}
mkdirSync(join(out, 'sources'), { recursive: true })
const first = kept[0] as Kept
const last = kept[kept.length - 1] as Kept
const clock = (at: number): string => new Date(at).toISOString().slice(11, 23)
let seen = new Set<string>()
const redraws = kept.map((one, i) => {
  const file = `sources/${String(i).padStart(3, '0')}.svg`
  copyFileSync(join(from, one.file), join(out, file))
  const svg = readFileSync(join(from, one.file), 'utf8')
  const constructs = constructsOf(svg)
  const fresh = i === 0 ? [] : [...constructs].filter(c => !seen.has(c))
  const unproven = [...constructs].filter(c => !PROVEN.has(c))
  seen = constructs
  console.log(`#${one.n} ${clock(one.at)} (+${((one.at - first.at) / 1000).toFixed(1)}s) ${one.chars} chars, ${one.scheme}, ${one.mood}${one.mood === 'waiting' ? ` on ${one.need}` : ''}, room ${one.level} (really ${one.liveLevel}), crate ${JSON.stringify(one.pantry)}, plane ${JSON.stringify(one.plane)}: drawn for ${one.changed}`)
  if (fresh.length > 0) console.log(`    new since the drawing before: ${fresh.join(' ')}`)
  if (unproven.length > 0) console.log(`    never seen working in the app: ${unproven.join(' ')}`)
  for (const note of one.notes.slice(-3)) console.log(`    ${clock(note.at)} ${note.what}`)
  return { at: (one.at - first.at) / 1000, file, size: one.chars, cause: one.changed, voyage: one.voyage }
})
const scheme = last.scheme === 'dark' ? 'dark' : 'light'
const to = (last.at - first.at) / 1000 + 20
writeFileSync(join(out, 'story.json'), JSON.stringify({ about: `drawings kept from the app, ${new Date(first.at).toISOString()}`, scheme, frames: { from: 0, to, every: 0.25 }, events: [], redraws }, null, 1))
console.log(`${out}: ${redraws.length} drawings over ${to.toFixed(0)}s`)
