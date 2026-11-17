// Reads what engine-probe.sh recorded and writes engine-facts.ts.
const fs = require('fs')
const [input, output] = process.argv.slice(2)
const rows = fs.readFileSync(input, 'utf8').trim().split('\n').map(line => JSON.parse(line)).sort((a, b) => a.at - b.at)
const find = (event, after = 0) => rows.find(row => row.event === event && row.at >= after)
const before = find('compact.before')
const inHook = find('compact.after-next')
const returned = find('compact.returned')
const nextTurn = returned && find('turn.start', returned.at)
const measure = returned && find('measure', returned.at)
if (!before || !inHook || !returned || !nextTurn || !measure) throw new Error(`the probe missed a step of the session: ${input}`)
// The same figure as `then`, to within a hundredth.
const still = (value, then) => Math.abs(value - then) <= then * 0.01
const facts = {
  // Inside the compaction's hook, once next(e) has resolved, usage still
  // reports the context as it was before: tokens and the breakdown alike.
  inHook: { tokens: still(inHook.tokens, before.tokens) ? 'before' : 'after', totalTokens: still(inHook.totalTokens, before.totalTokens) ? 'before' : 'after' },
  // Once the hook chain has returned: `tokens` is absent until the next
  // measure, and the breakdown counts the compacted context.
  afterReturn: { tokens: returned.tokens === undefined ? 'absent' : 'present', totalTokens: still(returned.totalTokens, before.totalTokens) ? 'before' : 'after' },
  // `tokensAfter` counts the messages alone: the system prompt and tools
  // that the context also holds are not in it.
  tokensAfterIsWholeContext: Math.abs(inHook.tokensAfter - returned.totalTokens) <= returned.totalTokens * 0.1,
  // The compaction itself brings no session.measure; the next turn does.
  measureBeforeNextTurn: measure.at < nextTurn.at,
}
const recorded = { before: before.tokens, tokensBefore: inHook.tokensBefore, tokensAfter: inHook.tokensAfter, inHook: inHook.tokens, afterReturnTotal: returned.totalTokens, nextMeasure: measure.measured }
fs.writeFileSync(output, `// Written by verify/engine-probe.sh from a real session; do not edit.\n// Recorded: ${JSON.stringify(recorded)}\nexport const ENGINE_FACTS = ${JSON.stringify(facts, null, 2)} as const\n`)
console.log(JSON.stringify({ facts, recorded }))
