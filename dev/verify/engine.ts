// A fake of the engine beneath hooks/register.tsx, for story.ts: it loads the
// plugin's real hooks module and raises the engine's events through it, so a
// scenario runs the plugin's own handlers rather than a copy of them. What it
// answers around a compaction follows the recording in engine-facts.ts (see
// engine-probe.sh). Every engine call the plugin makes must be one this fake
// answers: an unknown one throws, so a new call cannot slip past it unheard.
import { buildSync } from 'esbuild'
import { join } from 'path'

import { fakeContext } from '../../test/engine-context'
import type { FakeContext } from '../../test/engine-context'
import type { Atom } from './engine-shim'

type Hook = ($: unknown, e: Record<string, unknown>, next: (e: Record<string, unknown>) => Promise<unknown>) => unknown
type Entry = { event: string; matcher: Record<string, unknown> | undefined; hook: Hook }
type Element = { type: unknown; props: Record<string, unknown>; children: unknown[] }

// Where the context is compacted, and its window, in tokens.
export const COMPACTS_AT = 100_000
const WINDOW = 200_000

// The plugin's hooks module, bundled once against engine-shim.ts.
let bundled: string | undefined
function moduleCode(): string {
  if (bundled === undefined) {
    const root = join(__dirname, '..', '..')
    const out = buildSync({
      entryPoints: [join(root, 'hooks', 'register.tsx')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      jsxFactory: 'h',
      alias: { 'claude-code': join(root, 'dev', 'verify', 'engine-shim.ts') },
      logLevel: 'warning',
    })
    bundled = out.outputFiles[0]?.text ?? ''
  }
  return bundled
}

export class FakeEngine {
  now: number
  readonly context: FakeContext = fakeContext()
  // Subagents and background shells in flight, as the engine lists them.
  subagents: string[] = []
  shells = 0
  private state = new Map<string, unknown>()
  private store = new Map<string, unknown>()
  private hooks: Entry[] = []
  // Timers die with the module that set them.
  private generation = 0
  private scheme: string | undefined
  private readonly $: unknown

  constructor(now: number, private readonly schedule: (at: number, run: () => Promise<void>) => void) {
    this.now = now
    const state = {
      read: <T>(atom: Atom<T>): T => {
        const key = `${atom.ref.plugin}.${atom.ref.key}`
        return (this.state.has(key) ? this.state.get(key) : atom.initial) as T
      },
      update: <T>(atom: Atom<T>, change: (value: T) => T): T => {
        const next = change(state.read(atom))
        this.state.set(`${atom.ref.plugin}.${atom.ref.key}`, next)
        return next
      },
    }
    const nouns: Record<string, Record<string, unknown>> = {
      state,
      plugin: { name: 'maldives', root: '/nonexistent/maldives' },
      clock: {
        now: async () => this.now,
        after: (ms: number, fn: () => unknown) => {
          const generation = this.generation
          this.schedule(this.now + ms, async () => {
            if (generation === this.generation) {
              await fn()
            }
          })
          return { cancel: () => undefined }
        },
      },
      store: {
        get: async (key: string) => this.store.get(key),
        set: async (key: string, value: unknown) => void this.store.set(key, value),
      },
      theme: {
        set: async (look: { overrideColorScheme?: string }) => {
          this.scheme = look.overrideColorScheme
          return { isDrawn: true }
        },
      },
      session: {
        usage: async (args?: { breakdown?: string }) => {
          const { tokens, totalTokens } = this.context.usage()
          const breakdown = args?.breakdown === undefined ? {} : { breakdown: { autoCompactThreshold: COMPACTS_AT, rawMaxTokens: COMPACTS_AT, totalTokens } }
          return { startedAt: 0, context: { ...(tokens === undefined ? {} : { tokens }), window: WINDOW, ...breakdown }, rateLimits: [] }
        },
      },
      agent: { list: async () => this.subagents.map(id => ({ id, status: 'running' })) },
      // No `.record` file: nothing to read or write.
      fs: { exists: async () => false },
      command: { register: async () => undefined },
      ui: {
        resolve: () => new Proxy({}, { get: (_, name) => String(name) }),
        log: () => undefined,
        status: () => undefined,
        toast: () => undefined,
      },
    }
    this.$ = new Proxy(nouns, {
      get: (target, noun: string) => {
        const methods = target[noun]
        if (methods === undefined) {
          throw new Error(`the fake engine has no $.${noun}: answer it in dev/verify/engine.ts`)
        }
        return noun === 'state' || noun === 'plugin' ? methods : new Proxy(methods, {
          get: (calls, call: string) => {
            if (!(call in calls)) {
              throw new Error(`the fake engine has no $.${noun}.${call}: answer it in dev/verify/engine.ts`)
            }
            return calls[call]
          },
        })
      },
    })
  }

  // Sets an atom of the plugin's before it starts, as a session would have it.
  seed(key: string, value: unknown): void {
    this.state.set(`maldives.${key}`, value)
  }
  read(key: string): unknown {
    return this.state.get(`maldives.${key}`)
  }
  remember(key: string, value: unknown): void {
    this.store.set(key, value)
  }

  // Loads the hooks module afresh, its own variables started over, and starts
  // the session on it: a session's start, or the module reloaded.
  async start(): Promise<void> {
    this.generation += 1
    this.hooks = []
    const loaded: { exports: { register?: (on: unknown) => void } } = { exports: {} }
    const scope = globalThis as unknown as { h: unknown }
    scope.h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): Element => ({ type, props: props ?? {}, children })
    new Function('module', 'exports', 'require', moduleCode())(loaded, loaded.exports, require)
    const register = loaded.exports.register
    if (register === undefined) {
      throw new Error('hooks/register.tsx exports no register')
    }
    register((event: string, matcher: Record<string, unknown> | Hook, hook?: Hook) => {
      this.hooks.push(typeof matcher === 'function' ? { event, matcher: undefined, hook: matcher } : { event, matcher, hook: hook as Hook })
    })
    await this.raise('session.start', { source: 'startup' })
  }

  // Raises `event` through the plugin's hooks; `bottom` answers as the engine
  // itself would beneath them.
  raise(event: string, e: Record<string, unknown>, bottom: (e: Record<string, unknown>) => Promise<unknown> = async given => given): Promise<unknown> {
    const chain = this.hooks.filter(entry => entry.event === event && Object.entries(entry.matcher ?? {}).every(([key, value]) => e[key] === value))
    const at = (i: number) => async (given: Record<string, unknown>): Promise<unknown> => {
      const entry = chain[i]
      return entry === undefined ? bottom(given) : entry.hook(this.$, given, at(i + 1))
    }
    return at(0)(e)
  }

  // The scene the app is handed now.
  async backdrop(): Promise<string | undefined> {
    const drawn = (await this.raise('ui.render', { component: 'Backdrop', surface: 'desktop', props: { plugin: 'maldives', ...(this.scheme === undefined ? {} : { overrideColorScheme: this.scheme }) } }, async () => null)) as Element | null
    const source = drawn?.props.source
    return typeof source === 'string' ? source : undefined
  }
}
