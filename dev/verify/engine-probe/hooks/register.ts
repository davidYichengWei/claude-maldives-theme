// Records, into probe-<pid-ish>.jsonl in the session's folder, what the engine
// reports at each step around a compaction: the context size the maldives
// hooks would read inside the compaction's hook, once it has returned, and
// at each measure after it. dev/verify/engine-probe.sh plays the session.
import type { Register } from 'claude-code'

import type { EngineInterface } from 'claude-code'

const lines: string[] = []
let file = ''

async function log($: EngineInterface, what: Record<string, unknown>): Promise<void> {
  const at = await $.clock.now()
  if (file === '') file = `probe-${at}.jsonl`
  const usage = await $.session.usage({ breakdown: 'summary' })
  lines.push(JSON.stringify({ at, ...what, tokens: usage.context.tokens, totalTokens: usage.context.breakdown?.totalTokens, window: usage.context.window, threshold: usage.context.breakdown?.autoCompactThreshold ?? usage.context.breakdown?.rawMaxTokens }))
  await $.fs.write(file, lines.join('\n') + '\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await log($, { event: 'session.start' })
    return next(e)
  })
  on('session.compact', async ($, e, next) => {
    await log($, { event: 'compact.before', trigger: e.trigger })
    const done = await next(e)
    await log($, { event: 'compact.after-next', tokensBefore: 'tokensBefore' in done ? done.tokensBefore : null, tokensAfter: 'tokensAfter' in done ? done.tokensAfter : null })
    $.clock.after(1, async () => log($, { event: 'compact.returned' }))
    return done
  })
  on('session.measure', async ($, e, next) => {
    await log($, { event: 'measure', changed: e.changed, measured: e.context.tokens })
    return next(e)
  })
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await log($, { event: 'turn.start' })
    return next(e)
  })
}
