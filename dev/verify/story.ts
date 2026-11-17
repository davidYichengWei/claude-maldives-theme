// Plays scenarios: what happens to the agent and when, raised as the
// engine's events through the plugin's own hooks module (hooks/register.tsx,
// loaded by the fake engine in engine.ts), and writes every scene the app
// would be handed, with the moment it was handed over, for film.cjs to render
// and check.
//
//   node build/story.cjs <scenario.json> <out dir>
//   node build/story.cjs --random <count> <seed> <out dir>
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { Mood } from '../../types'
import { VISIT_SECONDS } from '../../hooks/scene'
import { AT_HOME, COCONUTS } from '../../hooks/voyage'
import type { Voyage } from '../../hooks/voyage'
import { COMPACTS_AT, FakeEngine } from './engine'

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
  // [seconds, what must hold then]: `coconuts 4`, the crate holding four.
  expect?: [number, string][]
  frames: { from: number; to: number; every: number }
}

const T0 = 1_800_000_000_000

// `cause` is the event the redraw answered: an `ask` or a `reload` changes
// nothing the scene shows, so the picture must carry on across it unchanged.
type Redraw = { at: number; file: string; size: number; cause: string; voyage: Voyage; plane: unknown; pantry: unknown; level: unknown }

// What comes next: an event of the scenario's, or a timer the plugin set.
type Due = { at: number; seq: number; what: string | (() => Promise<void>) }

// The context holding room for `coconuts`, in tokens.
const tokensFor = (coconuts: number): number => Math.round(COMPACTS_AT * (1 - Math.max(0, Math.min(COCONUTS, coconuts)) / COCONUTS))

async function play(scenario: Scenario, out: string): Promise<void> {
  mkdirSync(join(out, 'sources'), { recursive: true })
  const queue: Due[] = []
  let seq = 0
  const due = (at: number, what: Due['what']): void => {
    queue.push({ at, seq: seq++, what })
  }
  const engine = new FakeEngine(T0, (at, run) => due((at - T0) / 1000, run))
  const mood = scenario.start?.mood ?? 'idle'
  engine.seed('mood', mood)
  engine.seed('live', { mood, need: 'permission', crew: 0, shells: 0 })
  engine.seed('voyage', { ...AT_HOME, at: T0 - (scenario.start?.home ?? 600) * 1000 })
  if (scenario.scheme !== undefined) {
    engine.remember('scheme', scenario.scheme)
  }
  for (const [at, what] of scenario.events) {
    due(at, what)
  }
  for (const [at, what] of scenario.expect ?? []) {
    if (at > scenario.frames.to) {
      throw new Error(`"${what}" at ${at}s comes after the scenario ends at ${scenario.frames.to}s`)
    }
    due(at, `expect ${what}`)
  }
  if ((scenario.askEvery ?? 0) > 0) {
    for (let t = scenario.askEvery ?? 0; t <= scenario.frames.to; t += scenario.askEvery ?? 1) {
      due(t, 'ask')
    }
  }
  due(scenario.frames.from, 'ask')

  const redraws: Redraw[] = []
  const log: string[] = []
  const failed: string[] = []
  let shown = ''
  const ask = async (seconds: number, cause: string): Promise<void> => {
    const source = await engine.backdrop()
    if (source !== undefined && source !== shown) {
      shown = source
      const file = `sources/${String(redraws.length).padStart(3, '0')}.svg`
      writeFileSync(join(out, file), source)
      redraws.push({ at: seconds, file, size: source.length, cause, voyage: engine.read('voyage') as Voyage, plane: engine.read('plane'), pantry: engine.read('pantry'), level: engine.read('level') })
    }
  }

  // Tool calls held open (a dialog up, a question asked) and a compaction
  // under way: each ends when the engine answers it.
  const held: { settle: (result: Record<string, unknown>) => void; done: Promise<unknown> }[] = []
  let compaction: { settle: (result: Record<string, unknown>) => void; done: Promise<unknown> } | undefined
  const open = (event: string, e: Record<string, unknown>): { settle: (result: Record<string, unknown>) => void; done: Promise<unknown> } => {
    let settle: (result: Record<string, unknown>) => void = () => undefined
    const answer = new Promise<Record<string, unknown>>(resolve => {
      settle = resolve
    })
    return { settle, done: engine.raise(event, e, async () => answer) }
  }
  const tool = (e: Record<string, unknown>): Promise<unknown> => engine.raise('tool.call', { agentId: undefined, ...e }, async () => ({}))
  const settleHeld = async (result: Record<string, unknown>): Promise<void> => {
    const calls = held.splice(0)
    calls.forEach(call => call.settle(result))
    await Promise.all(calls.map(call => call.done))
  }
  const turnEnds = async (reason: string): Promise<void> => {
    await settleHeld({ isError: true })
    await engine.raise('turn.complete', { agentId: undefined, reason })
    const tasks = [...engine.subagents.map(() => ({ type: 'subagent' })), ...Array.from({ length: engine.shells }, () => ({ type: 'shell' }))]
    await engine.raise('classic.Stop', { background_tasks: tasks })
  }
  const measure = async (tokens: number): Promise<void> => {
    engine.context.measured(tokens)
    await engine.raise('session.measure', { changed: ['context'], context: { tokens, window: 200_000 } })
  }

  // One thing happening, raised as the engine raises it.
  const happen = async (what: string): Promise<void> => {
    const [word = '', arg] = what.split(/\s+/)
    if (word === 'turn') {
      await engine.raise('turn.start', { agentId: undefined })
    } else if (word === 'answer' || word === 'abort' || word === 'fail') {
      await turnEnds(word === 'answer' ? 'answer' : word === 'abort' ? 'aborted' : 'error')
    } else if (word === 'prompt') {
      await engine.raise('prompt.submit', { text: 'go on', isMeta: false })
    } else if (word === 'permission') {
      // The tool call waits on the dialog the engine puts to the person.
      held.push(open('tool.call', { agentId: undefined, tool: 'Bash', command: 'make' }))
      await engine.raise('classic.PermissionRequest', { tool_name: 'Bash' })
    } else if (word === 'question' || word === 'plan') {
      held.push(open('tool.call', { agentId: undefined, tool: word === 'question' ? 'AskUserQuestion' : 'ExitPlanMode' }))
    } else if (word === 'resolve') {
      await settleHeld({})
    } else if (word === 'subagent') {
      const id = `sub-${seq}`
      engine.subagents.push(id)
      await engine.raise('turn.start', { agentId: id })
    } else if (word === 'subagent-done') {
      const id = engine.subagents.shift()
      if (id !== undefined) {
        await engine.raise('turn.complete', { agentId: id, reason: 'answer' })
      }
    } else if (word === 'shell') {
      engine.shells += 1
      await tool({ tool: 'Bash', command: 'sleep 600', run_in_background: true })
    } else if (word === 'shell-done') {
      // The engine says so as the main turn next ends.
      engine.shells = Math.max(0, engine.shells - 1)
    } else if (word === 'ship') {
      await tool({ tool: 'Bash', command: 'git push' })
    } else if (word === 'compact') {
      // One compaction at a time.
      if (compaction === undefined) {
        compaction = open('session.compact', { trigger: 'manual', messages: [] })
      }
    } else if (word === 'compacted') {
      // `compacted 4`: the context compacted to room for four coconuts; bare,
      // to as much room as it had.
      const after = arg === undefined ? engine.context.usage().totalTokens : tokensFor(Number(arg))
      if (compaction !== undefined) {
        const tokensBefore = engine.context.usage().totalTokens
        const tokensAfter = engine.context.compacting(after, Math.round(after / 3))
        compaction.settle({ messages: [], tokensBefore, tokensAfter })
        await compaction.done
        compaction = undefined
        engine.context.returned()
      } else if (arg !== undefined) {
        await measure(after)
      }
    } else if (word === 'room') {
      // `room 3`: a turn measured the context with room for three coconuts.
      await measure(tokensFor(Number(arg)))
    } else if (word === 'reload') {
      await engine.start()
    } else if (word === '/maldives') {
      const answer = (await engine.raise('command.run', { command: 'maldives', args: what.replace(/^\/maldives\s*/, '') }, async () => ({ text: '' }))) as { text?: string } | undefined
      if (answer?.text?.startsWith('Usage') === true) {
        throw new Error(`"${what}" is no /maldives command: ${answer.text}`)
      }
    } else if (word === 'expect') {
      const [, kind, value] = what.split(/\s+/)
      const crate = (engine.read('pantry') as { stock: number } | undefined)?.stock ?? COCONUTS
      if (kind !== 'coconuts') {
        throw new Error(`unknown expectation "${what}"`)
      }
      if (crate !== Number(value)) {
        failed.push(`${(engine.now - T0) / 1000}s: the crate holds ${crate} coconuts, not ${value}`)
      }
    } else if (word !== 'ask') {
      throw new Error(`unknown event "${what}"`)
    }
  }

  // Lets every hook already under way run as far as it can before the app
  // asks for the backdrop: a held call (a compaction, a dialog) goes on past
  // its own `next` while the event that opened it has returned.
  const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))
  await engine.start()
  // Events and timers come in time order, each in the order it was set.
  for (;;) {
    queue.sort((a, b) => a.at - b.at || a.seq - b.seq)
    const next = queue.shift()
    if (next === undefined || next.at > scenario.frames.to) {
      break
    }
    engine.now = T0 + Math.round(next.at * 1000)
    if (typeof next.what === 'string') {
      await happen(next.what)
      await settled()
      log.push(`${next.at}s ${next.what}`)
      await ask(next.at, next.what)
    } else {
      await next.what()
      await settled()
      await ask(next.at, 'timer')
    }
  }
  writeFileSync(join(out, 'story.json'), JSON.stringify({ about: scenario.about, scheme: scenario.scheme ?? 'light', frames: scenario.frames, events: log, redraws }, null, 1))
  console.log(`${out}: ${redraws.length} redraws, largest ${Math.max(...redraws.map(r => r.size))} chars`)
  if (failed.length > 0) {
    throw new Error(`${out}: ${scenario.about}\n${failed.join('\n')}`)
  }
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
  const vocabulary = ['turn', 'turn', 'answer', 'answer', 'abort', 'fail', 'prompt', 'permission', 'question', 'plan', 'resolve', 'resolve', 'subagent', 'subagent-done', 'shell', 'shell-done', 'compact', 'compacted', 'compacted 4', 'room 4', 'room 3', 'room 2', 'room 0', 'ship', 'ask', 'ask', 'reload', '/maldives island tour', '/maldives island nap', '/maldives island sun', '/maldives dark', '/maldives light', '/maldives crew 2', '/maldives shells 1', '/maldives crew 4', '/maldives drink', '/maldives resupply', '/maldives reset', ...Object.keys(VISIT_SECONDS).map(kind => `/maldives visit ${kind}`)]
  const events: [number, string][] = []
  let t = 1 + rand() * 4
  while (t < 85) {
    events.push([Math.round(t * 10) / 10, pick(vocabulary)])
    // Mostly a while apart, sometimes in a quick burst.
    t += rand() < 0.3 ? 0.2 + rand() * 1.5 : 2 + rand() * 14
  }
  return { about: `random combination, seed ${seed}`, start: { mood: rand() < 0.7 ? 'idle' : 'working', home: 30 + rand() * 600 }, events, askEvery: 7, frames: { from: 0, to: 100, every: 0.25 } }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv[0] === '--random') {
    const [count = '10', seed = '1', out = 'out/random'] = argv.slice(1)
    for (let i = 0; i < Number(count); i++) {
      const scenario = randomScenario(Number(seed) * 1000 + i)
      const dir = join(out, String(i).padStart(2, '0'))
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario, null, 1))
      await play(scenario, dir)
    }
  } else {
    const [file, out] = argv
    if (file === undefined || out === undefined) {
      throw new Error('usage: story.cjs <scenario.json> <out dir> | --random <count> <seed> <out dir>')
    }
    await play(JSON.parse(readFileSync(file, 'utf8')) as Scenario, out)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
