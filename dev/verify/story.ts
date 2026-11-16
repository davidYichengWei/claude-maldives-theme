// Plays scenarios: what happens to the agent and when, run through the
// plugin's own rules for its state and for when the backdrop is drawn anew,
// and writes every scene the app would be handed, with the moment it was
// handed over, for film.cjs to render and check.
//
//   node build/story.cjs <scenario.json> <out dir>
//   node build/story.cjs --random <count> <seed> <out dir>
//
// The event handlers below follow hooks/register.tsx; the state rules
// (embark, muster) and the redraw rule (paint) are the plugin's own code.
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { Mood, Need } from '../../types'
import { berthAt, muster } from '../../hooks/fleet'
import type { Boat } from '../../hooks/fleet'
import { FIREWORKS_MS, UNFLAGGED, UNPAINTED, callUp, hoist, paint, signalOf } from '../../hooks/paint'
import type { Call, Flag, Painted } from '../../hooks/paint'
import { VISIT_SECONDS } from '../../hooks/scene'
import type { VisitKind } from '../../hooks/scene'
import { AT_HOME, DRILLS, embark } from '../../hooks/voyage'
import type { Voyage } from '../../hooks/voyage'

export type Scenario = {
  about: string
  // The mood it starts in, and how long the mascot has been home by then.
  start?: { mood?: Mood; home?: number }
  scheme?: 'light' | 'dark'
  // [seconds, what]: see `happen` for what each can be.
  events: [number, string][]
  // The app also asks for the backdrop this often, as it does when the window
  // is shown again; 0 for never.
  askEvery?: number
  frames: { from: number; to: number; every: number }
}

const T0 = 1_800_000_000_000
const LEAP_MS = 5000

type World = {
  mood: Mood
  need: Need
  crew: number
  shells: number
  // The agent's real state, kept by its events; a preview leaves it alone.
  live: { mood: Mood; need: Need; crew: number; shells: number }
  compacting: boolean
  fireworks: number
  voyage: Voyage
  boats: Boat[]
  scheme: 'light' | 'dark' | undefined
  // The module's own variables: they start over when it reloads.
  leapUntil: number
  flag: Flag
  visits: Call[]
  drawn: Painted
}

// `cause` is the event the redraw answered: an `ask` or a `reload` changes
// nothing the scene shows, so the picture must carry on across it unchanged.
type Redraw = { at: number; file: string; size: number; cause: string; voyage: Voyage }

function play(scenario: Scenario, out: string): void {
  mkdirSync(join(out, 'sources'), { recursive: true })
  const world: World = {
    mood: scenario.start?.mood ?? 'idle',
    need: 'permission',
    crew: 0,
    shells: 0,
    live: { mood: scenario.start?.mood ?? 'idle', need: 'permission', crew: 0, shells: 0 },
    compacting: false,
    fireworks: 0,
    voyage: { ...AT_HOME, at: T0 - (scenario.start?.home ?? 600) * 1000 },
    boats: [],
    scheme: scenario.scheme,
    leapUntil: 0,
    flag: UNFLAGGED,
    visits: [],
    drawn: UNPAINTED,
  }
  const redraws: Redraw[] = []
  const log: string[] = []
  const queue: [number, string][] = [...scenario.events]
  if ((scenario.askEvery ?? 0) > 0) {
    for (let t = scenario.askEvery ?? 0; t <= scenario.frames.to; t += scenario.askEvery ?? 1) {
      queue.push([t, 'ask'])
    }
  }
  queue.push([scenario.frames.from, 'ask'])
  const at = (seconds: number): number => T0 + Math.round(seconds * 1000)

  const setMood = (next: Mood, now: number): void => {
    const phase = next === 'idle' || next === 'done' ? 'land' : 'fetch'
    if (world.voyage.phase !== phase) {
      world.voyage = embark(world.voyage, phase, now, next === 'done')
    }
    world.mood = next
  }
  // The agent's own events set its real state and show it.
  const feel = (next: Mood, now: number): void => {
    world.live = { ...world.live, mood: next }
    setMood(next, now)
  }
  const count = (kind: 'crew' | 'shells', change: (real: number) => number, now: number): void => {
    const real = change(world.live[kind])
    world.live = { ...world.live, [kind]: real }
    world[kind] = real
    recount(now)
  }
  const recount = (now: number): void => {
    const wanted = { lead: 0, crew: world.crew, shell: world.shells }
    world.boats = [...muster(world.boats, wanted, now)]
    const when = berthAt(world.boats, wanted)
    if (when !== undefined) {
      queue.push([(when + 1 - T0) / 1000, 'berth'])
    }
  }
  const celebrate = (seconds: number): void => {
    world.fireworks = at(seconds)
    queue.push([seconds + FIREWORKS_MS / 1000, `fireworks-out ${world.fireworks}`])
  }
  const ask = (now: number, seconds: number, cause: string): void => {
    world.flag = hoist(world.flag, signalOf(world.mood, world.need), now)
    const before = world.drawn
    world.drawn = paint(
      world.drawn,
      {
        mood: world.mood,
        need: world.need,
        isCompacting: world.compacting,
        firedAt: world.fireworks,
        scheme: world.scheme,
        voyage: world.voyage,
        boats: world.boats,
        leapUntil: world.leapUntil,
        flag: world.flag,
        visits: world.visits,
      },
      now,
    )
    if (world.drawn !== before && world.drawn.built === now && world.drawn.source !== before.source) {
      const file = `sources/${String(redraws.length).padStart(3, '0')}.svg`
      writeFileSync(join(out, file), world.drawn.source)
      redraws.push({ at: seconds, file, size: world.drawn.source.length, cause, voyage: world.voyage })
    }
  }

  // One thing happening, as the plugin's hooks take it.
  const happen = (seconds: number, what: string): void => {
    const now = at(seconds)
    const [word = '', arg] = what.split(/\s+/)
    if (word === 'turn') {
      feel('working', now)
    } else if (word === 'answer' || word === 'abort' || word === 'fail') {
      feel(word === 'answer' ? 'done' : word === 'abort' ? 'idle' : 'error', now)
    } else if (word === 'prompt') {
      world.leapUntil = now + LEAP_MS
    } else if (word === 'permission' || word === 'question' || word === 'plan') {
      world.live = { ...world.live, mood: 'waiting', need: word }
      world.need = word
      setMood('waiting', now)
    } else if (word === 'resolve') {
      if (world.live.mood === 'waiting') {
        feel('working', now)
      }
    } else if (word === 'subagent' || word === 'subagent-done') {
      count('crew', n => Math.max(0, n + (word === 'subagent' ? 1 : -1)), now)
    } else if (word === 'shell' || word === 'shell-done') {
      count('shells', n => Math.max(0, n + (word === 'shell' ? 1 : -1)), now)
    } else if (word === 'compact' || word === 'compacted') {
      world.compacting = word === 'compact'
    } else if (word === 'ship') {
      celebrate(seconds)
    } else if (word === 'berth') {
      recount(now)
    } else if (word === 'fireworks-out') {
      if (world.fireworks === Number(arg)) {
        world.fireworks = 0
      }
    } else if (word === 'reload') {
      world.leapUntil = 0
      world.flag = UNFLAGGED
      world.drawn = UNPAINTED
    } else if (word === '/maldives') {
      command(what.replace(/^\/maldives\s*/, ''), seconds, now)
    } else if (word !== 'ask') {
      throw new Error(`unknown event "${what}" at ${seconds}s`)
    }
    log.push(`${seconds}s ${what}`)
    ask(now, seconds, what)
  }

  // The /maldives command, as register.tsx answers it.
  const command = (args: string, seconds: number, now: number): void => {
    const [word = '', amount] = args.split(/\s+/)
    const count = amount !== undefined && /^[0-5]$/.test(amount) ? Number(amount) : undefined
    if (word === 'reset') {
      world.need = world.live.need
      setMood(world.live.mood, now)
      world.crew = world.live.crew
      world.shells = world.live.shells
      recount(now)
    } else if (word === 'fireworks') {
      celebrate(seconds)
    } else if (word === 'island') {
      const drill = DRILLS.find(one => one === amount)
      if (drill !== undefined && world.mood !== 'working' && world.mood !== 'waiting') {
        world.voyage = { ...embark(world.voyage, 'land', now, false), drill }
      }
    } else if (word === 'visit') {
      const kind = (Object.keys(VISIT_SECONDS) as VisitKind[]).find(one => one === amount)
      if (kind === undefined) {
        throw new Error(`unknown kind "${amount}" at ${seconds}s`)
      }
      world.visits = callUp(world.visits, kind, now) ?? world.visits
    } else if (word === 'shells' || word === 'crew') {
      const next = count ?? ((word === 'shells' ? world.shells : world.crew) + 1) % 4
      world[word === 'shells' ? 'shells' : 'crew'] = next
      recount(now)
    } else if (word === 'light' || word === 'dark' || word === 'auto') {
      world.scheme = word === 'auto' ? undefined : word
    } else if (word === 'permission' || word === 'question' || word === 'plan') {
      world.need = word
      setMood('waiting', now)
    } else if (['idle', 'working', 'waiting', 'done', 'error'].includes(word)) {
      setMood(word as Mood, now)
    } else {
      throw new Error(`unknown command "/maldives ${args}" at ${seconds}s`)
    }
  }

  // Events come in time order; fireworks going out are queued as they start.
  for (;;) {
    queue.sort((a, b) => a[0] - b[0])
    const next = queue.shift()
    if (next === undefined || next[0] > scenario.frames.to) {
      break
    }
    happen(next[0], next[1])
  }
  writeFileSync(join(out, 'story.json'), JSON.stringify({ about: scenario.about, scheme: scenario.scheme ?? 'light', frames: scenario.frames, events: log, redraws }, null, 1))
  console.log(`${out}: ${redraws.length} redraws, largest ${Math.max(...redraws.map(r => r.size))} chars`)
}

// A scenario of random events: the combinations nobody thinks to try.
function randomScenario(seed: number): Scenario {
  let s = seed >>> 0
  const rand = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T
  const vocabulary = ['turn', 'turn', 'answer', 'answer', 'abort', 'fail', 'prompt', 'permission', 'question', 'plan', 'resolve', 'resolve', 'subagent', 'subagent-done', 'shell', 'shell-done', 'compact', 'compacted', 'ship', 'ask', 'ask', 'reload', '/maldives island tour', '/maldives island nap', '/maldives island sun', '/maldives dark', '/maldives light', '/maldives crew 2', '/maldives shells 1', '/maldives crew 4', '/maldives reset', ...Object.keys(VISIT_SECONDS).map(kind => `/maldives visit ${kind}`)]
  const events: [number, string][] = []
  let t = 1 + rand() * 4
  while (t < 85) {
    events.push([Math.round(t * 10) / 10, pick(vocabulary)])
    // Mostly a while apart, sometimes in a quick burst.
    t += rand() < 0.3 ? 0.2 + rand() * 1.5 : 2 + rand() * 14
  }
  return { about: `random combination, seed ${seed}`, start: { mood: rand() < 0.7 ? 'idle' : 'working', home: 30 + rand() * 600 }, events, askEvery: 7, frames: { from: 0, to: 100, every: 0.25 } }
}

const argv = process.argv.slice(2)
if (argv[0] === '--random') {
  const [count = '10', seed = '1', out = 'out/random'] = argv.slice(1)
  for (let i = 0; i < Number(count); i++) {
    const scenario = randomScenario(Number(seed) * 1000 + i)
    const dir = join(out, String(i).padStart(2, '0'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario, null, 1))
    play(scenario, dir)
  }
} else {
  const [file, out] = argv
  if (file === undefined || out === undefined) {
    throw new Error('usage: story.cjs <scenario.json> <out dir> | --random <count> <seed> <out dir>')
  }
  play(JSON.parse(readFileSync(file, 'utf8')) as Scenario, out)
}
