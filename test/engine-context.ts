import { ENGINE_FACTS } from '../dev/verify/engine-facts'

// How the engine reports the context's size around a compaction, as recorded
// from a real session by dev/verify/engine-probe.sh: the hooks of a fake
// engine answer `session.usage` from this, so a plugin reads what it would.
export type ContextFigures = { tokens?: number; totalTokens: number }

export type FakeContext = {
  // What `$.session.usage()` reports now: `tokens`, and the breakdown's total.
  usage: () => ContextFigures
  // A turn measured the context at `tokens`.
  measured: (tokens: number) => void
  // The engine compacts the conversation, the context left holding `after`
  // tokens all told, `messages` of them the conversation itself; what the
  // compaction's `tokensAfter` says.
  compacting: (after: number, messages: number) => number
  // Every compaction hook has returned.
  returned: () => void
}

export function fakeContext(start = 0): FakeContext {
  let reported = start
  let real = start
  let phase: 'measured' | 'inHook' | 'afterReturn' = 'measured'
  const pick = (which: 'before' | 'after'): number => (which === 'before' ? reported : real)
  return {
    usage: () => {
      if (phase === 'inHook') {
        return { tokens: pick(ENGINE_FACTS.inHook.tokens), totalTokens: pick(ENGINE_FACTS.inHook.totalTokens) }
      }
      if (phase === 'afterReturn') {
        const tokens = ENGINE_FACTS.afterReturn.tokens === 'absent' ? undefined : real
        return { ...(tokens === undefined ? {} : { tokens }), totalTokens: pick(ENGINE_FACTS.afterReturn.totalTokens) }
      }
      return { tokens: real, totalTokens: real }
    },
    measured: tokens => {
      reported = tokens
      real = tokens
      phase = 'measured'
    },
    compacting: (after, messages) => {
      real = after
      phase = 'inHook'
      return ENGINE_FACTS.tokensAfterIsWholeContext ? after : messages
    },
    returned: () => {
      if (phase === 'inHook') {
        phase = 'afterReturn'
      }
    },
  }
}
