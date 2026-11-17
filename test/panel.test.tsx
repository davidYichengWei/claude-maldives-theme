import { expect, mock, test } from 'claude-code/testing'

import { fakeContext } from './engine-context'

// What follows a row's heading: a boat count follows its name.
async function after(ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }, heading: string): Promise<string | undefined> {
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)
  return texts[texts.indexOf(heading) + 1]
}

const isLit = async (ui: { find: (q: { key: string }) => Promise<{ props: Record<string, unknown> } | undefined> }, key: string): Promise<boolean> =>
  (await ui.find({ key }))?.props.variant === 'primary'

const BAND = {
  plugin: 'maldives',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 8,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 7 },
    view: {},
  },
} as const

test('the Control Panel is above the prompt from the start, Close hides it and /maldives panel brings it back', async ($, on) => {
  // Each hook here stands for the engine: what it draws when the mod passes.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: 'Control Panel' }))?.text).toBe('Control Panel')
  // The top row alone until a menu is opened.
  expect(await ui.find({ key: 'scheme-dark' })).toBeUndefined()

  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: 'engine' }))?.text).toBe('engine')

  expect(await $.command.run({ command: 'maldives', args: 'panel' })).toMatchObject({ text: 'Control Panel is above the prompt.' })
  expect((await ui.find({ type: 'Text', text: 'Control Panel' }))?.text).toBe('Control Panel')
  await ui.unmount()
})

test('a menu opens its row below, and pressing it again closes it', async ($, on) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await ui.press({ key: 'menu-appearance' })
  for (const scheme of ['light', 'dark', 'auto']) {
    expect(await ui.find({ key: `scheme-${scheme}` })).toBeDefined()
  }
  await ui.press({ key: 'menu-boats' })
  expect(await ui.find({ key: 'scheme-dark' })).toBeUndefined()
  expect(await ui.find({ key: 'crew-more' })).toBeDefined()
  await ui.press({ key: 'menu-boats' })
  expect(await ui.find({ key: 'crew-more' })).toBeUndefined()
  await ui.unmount()
})

test('the boats step within their circuits, and Reset goes back to what Claude is doing', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: (now += 100) }))
  on('clock.after', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await ui.press({ key: 'menu-boats' })
  await ui.press({ key: 'crew-more' })
  await ui.press({ key: 'crew-more' })
  expect(await after(ui, 'Subagents')).toBe('2')
  await ui.press({ key: 'crew-less' })
  await ui.press({ key: 'crew-less' })
  await ui.press({ key: 'crew-less' })
  expect(await after(ui, 'Subagents')).toBe('0')
  for (let i = 0; i < 7; i++) await ui.press({ key: 'shells-more' })
  expect(await after(ui, 'Background jobs')).toBe('5')

  await ui.press({ key: 'reset' })
  // The top row alone again, and the boats back to none.
  expect(await ui.find({ key: 'shells-more' })).toBeUndefined()
  await ui.press({ key: 'menu-boats' })
  expect(await after(ui, 'Background jobs')).toBe('0')
  await ui.unmount()
})

test('the island pastimes are offered only while Claude is idle or done', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: (now += 100) }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await ui.press({ key: 'menu-claude' })
  expect(await isLit(ui, 'mood-idle')).toBe(true)
  expect(await ui.find({ key: 'drill-nap' })).toBeDefined()
  await ui.press({ key: 'mood-working' })
  expect(await isLit(ui, 'mood-working')).toBe(true)
  expect(await ui.find({ key: 'drill-nap' })).toBeUndefined()
  await ui.press({ key: 'need-question' })
  expect(await isLit(ui, 'need-question')).toBe(true)
  expect(await isLit(ui, 'mood-working')).toBe(false)
  expect(await ui.find({ key: 'drill-nap' })).toBeUndefined()
  expect(await ui.find({ key: 'mood-done' })).toBeUndefined()
  // A turn that ended with an answer lands Clawd as idle does.
  await $.command.run({ command: 'maldives', args: 'done' })
  expect(await isLit(ui, 'mood-idle')).toBe(true)
  expect(await isLit(ui, 'drill-nap')).toBe(false)
  await ui.press({ key: 'drill-nap' })
  expect(await isLit(ui, 'drill-nap')).toBe(true)
  expect(await isLit(ui, 'drill-sun')).toBe(false)
  await ui.unmount()
})

test('Wildlife calls up at most three of a kind at once, more once they have gone by', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: now }))
  on('clock.after', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const isDim = async (key: string): Promise<boolean> => (await ui.find({ key }))?.props.dimColor === true

  await ui.press({ key: 'menu-wildlife' })
  for (const key of ['call-snappers', 'call-bannerfish', 'call-turtle', 'call-manta', 'call-ray', 'call-whaleShark', 'call-fin', 'call-dolphins', 'call-gulls']) {
    expect(await isDim(key)).toBe(false)
  }
  // A press lights the button and counts what is out, so it shows at once.
  await ui.press({ key: 'call-turtle' })
  expect(await isLit(ui, 'call-turtle')).toBe(true)
  expect((await ui.find({ key: 'call-turtle' }))?.props.label).toBe('Turtle ×1')
  await ui.press({ key: 'call-turtle' })
  expect(await isDim('call-turtle')).toBe(false)
  await ui.press({ key: 'call-turtle' })
  expect((await ui.find({ key: 'call-turtle' }))?.props.label).toBe('Turtle ×3')
  expect(await isDim('call-turtle')).toBe(true)
  expect(await isLit(ui, 'call-manta')).toBe(false)
  // The others are their own count.
  expect(await isDim('call-manta')).toBe(false)
  expect(await $.command.run({ command: 'maldives', args: 'visit turtle' })).toMatchObject({ text: expect.stringContaining('Already 3 turtle') })

  // An hour on, every turtle has crossed and the button is lit again.
  now += 3_600_000
  await ui.press({ key: 'menu-wildlife' })
  await ui.press({ key: 'menu-wildlife' })
  expect(await isDim('call-turtle')).toBe(false)
  expect(await isLit(ui, 'call-turtle')).toBe(false)
  expect((await ui.find({ key: 'call-turtle' }))?.props.label).toBe('Turtle')
  expect(await $.command.run({ command: 'maldives', args: 'visit turtle' })).toMatchObject({ text: 'Called up: turtle' })
  expect(await $.command.run({ command: 'maldives', args: 'visit heron' })).toMatchObject({ text: expect.stringContaining('Usage: /maldives visit') })
  await ui.unmount()
})

test('the flying fish leap on a press, once at a time, and the button goes out as they land', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: now }))
  on('clock.after', () => ({ value: undefined }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'menu-wildlife' })
  expect(await isLit(ui, 'call-flyingFish')).toBe(false)
  await ui.press({ key: 'call-flyingFish' })
  expect(await isLit(ui, 'call-flyingFish')).toBe(true)
  // A second press while they are in the air starts nothing: still lit at
  // 4.9 s from the first, out at 5 s.
  now += 3000
  await ui.press({ key: 'call-flyingFish' })
  now += 1900
  await ui.press({ key: 'menu-wildlife' })
  await ui.press({ key: 'menu-wildlife' })
  expect(await isLit(ui, 'call-flyingFish')).toBe(true)
  now += 200
  await ui.press({ key: 'menu-wildlife' })
  await ui.press({ key: 'menu-wildlife' })
  expect(await isLit(ui, 'call-flyingFish')).toBe(false)
  await ui.press({ key: 'call-flyingFish' })
  expect(await isLit(ui, 'call-flyingFish')).toBe(true)
  await ui.unmount()
})

test('the panel speaks Chinese once chosen, every menu of it, and English again', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  // The store across sessions, as the engine keeps it.
  const kept = new Map<string, unknown>()
  on('store.set', ($, e) => {
    kept.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.get', ($, e) => ({ value: kept.get(e.key) }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // Every word shown: the Texts and the Buttons' labels.
  const shown = async (): Promise<string[]> => [
    ...(await ui.findAll({ type: 'Text' })).map(t => t.text),
    ...(await ui.findAll({ type: 'Button' })).map(b => String(b.props.label ?? '')),
  ]
  await ui.press({ key: 'menu-appearance' })
  await ui.press({ key: 'lang-zh' })
  expect(await isLit(ui, 'lang-zh')).toBe(true)
  expect(await ui.find({ type: 'Text', text: '控制面板' })).toBeDefined()
  for (const menu of ['appearance', 'boats', 'claude', 'wildlife']) {
    if (menu !== 'appearance') await ui.press({ key: `menu-${menu}` })
    // Left in English: Clawd's name, the language's own, and Claude's own terms.
    const english = (await shown()).filter(word => /[A-Za-z]/.test(word.replace(/Clawd|Claude|Subagent|English|push\/PR/g, '')))
    expect({ menu, english }).toEqual({ menu, english: [] })
  }
  await ui.press({ key: 'menu-appearance' })
  expect(kept.get('lang')).toBe('zh')
  await ui.press({ key: 'lang-en' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeDefined()
  await ui.unmount()
})

test('a survey keeps the band', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>survey</Text>
  })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: 'survey' }))?.text).toBe('survey')
  await ui.unmount()
})

test('the crate stands for the room left in the context: a fifth used sends Clawd for a coconut, a compaction brings a seaplane with a full crate as soon as it is done, and the counts after it take coconuts out only as the context fills again', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  // A context compacted at 100k tokens, as /context works it out, reported
  // around a compaction as the engine reports it.
  const context = fakeContext()
  on('session.usage', ($, e) => {
    const { tokens, totalTokens } = context.usage()
    return { value: { startedAt: 0, context: { ...(tokens === undefined ? {} : { tokens }), window: 200_000, ...(e.breakdown === undefined ? {} : { breakdown: { autoCompactThreshold: 100_000, totalTokens } }) }, rateLimits: [] } as never }
  })
  const summary = [{ role: 'user' as const, text: 'The conversation so far, in short.', toolUses: [] }]
  // The conversation comes down to 15k tokens; with the system prompt and
  // tools the context holds 35k.
  on('session.compact', () => ({ messages: summary, tokensAfter: context.compacting(35_000, 15_000) }))
  on('session.measure', () => ({ changed: ['context'] }))
  const measure = async (used: number): Promise<void> => {
    context.measured(used)
    await $.session.measure({ context: { tokens: used, window: 200_000 }, rateLimits: [], changed: ['context'] })
  }
  const debug = async (): Promise<string> => String((await $.command.run({ command: 'maldives', args: 'debug' }))?.text)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'menu-claude' })
  expect(await after(ui, 'Context left')).toBe('5/5')

  // Out at work, Clawd aboard on the boat's circuit.
  await $.command.run({ command: 'maldives', args: 'working' })
  await clock.advance(60_000)
  await measure(25_000)
  expect(await after(ui, 'Context left')).toBe('4/5')
  expect(await debug()).toContain('by the boardwalk')
  // Back aboard a minute on: the crate holds four, its shell in the sea.
  await clock.advance(60_000)
  expect(await debug()).toContain('coconuts: {"stock":4}')
  // Another fifth used: a second coconut.
  await measure(45_000)
  expect(await after(ui, 'Context left')).toBe('3/5')
  await clock.advance(60_000)
  expect(await debug()).toContain('coconuts: {"stock":3}')
  // A preview from the panel: a third coconut.
  await ui.press({ key: 'coconuts-drink' })
  expect(await after(ui, 'Context left')).toBe('2/5')
  await clock.advance(60_000)

  // Compacted: the seaplane comes, throws down three coconuts once Clawd waits
  // for it on the boardwalk, and leaves, with no count of the context yet.
  await $.session.compact({ trigger: 'manual', messages: summary })
  context.returned()
  await clock.advance(120_000)
  expect(await after(ui, 'Context left')).toBe('5/5')
  const told = await debug()
  expect(told).toMatch(/coconuts: \{"stock":5,"filled":\{"at":\d+,"stock":2\}\}/)
  expect(told).toContain('cargo swapped')
  expect(told).not.toContain('waiting for the seaplane')
  // The next request counts 35k, room for four: the crate starts from there
  // and stays full.
  await measure(35_000)
  await clock.advance(60_000)
  expect(await after(ui, 'Context left')).toBe('5/5')
  // Until a fifth more is used.
  await measure(45_000)
  expect(await after(ui, 'Context left')).toBe('3/5')
  await ui.unmount()
})

test('Use 20% sends Clawd off the island to drink a coconut by the crate, Compact brings the seaplane with a full crate, and Reset goes back to the room the context has', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('agent.list', () => ({ value: [] }))
  const debug = async (): Promise<string> => String((await $.command.run({ command: 'maldives', args: 'debug' }))?.text)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'menu-claude' })
  expect(await after(ui, 'Context left')).toBe('5/5')
  // Idle at home on the island: the boat fetches Clawd, it drinks one by the
  // crate and the shell goes into the sea.
  await ui.press({ key: 'coconuts-drink' })
  expect(await after(ui, 'Context left')).toBe('4/5')
  await clock.advance(60_000)
  expect(await debug()).toContain('coconuts: {"stock":4}')
  for (let i = 0; i < 6; i++) {
    await ui.press({ key: 'coconuts-drink' })
    await clock.advance(60_000)
  }
  expect(await after(ui, 'Context left')).toBe('0/5')
  expect(await debug()).toContain('coconuts: {"stock":0}')
  // Only the seaplane brings more.
  expect(await $.command.run({ command: 'maldives', args: 'drink' })).toMatchObject({ text: 'The crate is empty: only the seaplane brings more.' })
  await ui.press({ key: 'coconuts-resupply' })
  expect(await after(ui, 'Context left')).toBe('5/5')
  await clock.advance(120_000)
  const told = await debug()
  expect(told).toContain('coconuts: {"stock":5,')
  expect(told).toContain('cargo swapped')
  await ui.press({ key: 'reset' })
  await ui.press({ key: 'menu-claude' })
  expect(await after(ui, 'Context left')).toBe('5/5')
  await ui.unmount()
})

test('a .record file in the plugin folder keeps each new drawing of the backdrop, and what drew it, in the directory it names', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const written = new Map<string, string>()
  on('fs.exists', ($, e) => ({ value: e.path.endsWith('/.record') }))
  on('fs.read', () => ({ value: '/frames\n' }))
  on('fs.write', ($, e) => {
    written.set(e.path, e.text)
    return { value: undefined }
  })
  mock.store(on)
  on('theme.set', () => ({ value: { isDrawn: true } }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', ($, e) => e)
  on('ui.status', () => ({ value: undefined }))
  // The module looks for the file as the session starts.
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true } as never)
  const backdrop = { plugin: 'maldives', component: 'Backdrop', surface: 'desktop', props: { plugin: 'maldives' } } as never
  const ui = await $.ui.mount(backdrop)
  await ui.unmount()
  const svg = written.get('/frames/frame-01.svg') ?? ''
  expect(svg.startsWith('<svg')).toBe(true)
  const frames = JSON.parse(written.get('/frames/frames.json') ?? '[]') as { file: string; chars: number; mood: string }[]
  expect(frames.map(one => one.file)).toEqual(['frame-01.svg'])
  expect(frames[0]?.chars).toBe(svg.length)
  expect(frames[0]?.mood).toBe('idle')
})

// Every kind of scene the backdrop draws, handed to the engine as the app is
// handed it: the engine checks the source itself (what it may embed, how
// long it may be) and draws nothing of a scene it refuses.
test('the engine takes the backdrop in every state it shows', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('theme.set', () => ({ value: { isDrawn: true } }))
  on('agent.list', () => ({ value: [] }))
  const kinds = ['snappers', 'bannerfish', 'turtle', 'manta', 'ray', 'whaleShark', 'fin', 'dolphins', 'gulls']
  const states = [[], ['working'], ['permission'], ['fireworks'], ['resupply'], ['done', 'island tour'], ['dark', 'working'], ['crew 4', 'shells 3'], kinds.map(kind => `visit ${kind}`)]
  for (const commands of states) {
    for (const args of commands) {
      await $.command.run({ command: 'maldives', args })
    }
    await clock.advance(9_000)
    const ui = await $.ui.mount({ plugin: 'maldives', component: 'Backdrop', surface: 'desktop', props: { plugin: 'maldives' } } as never)
    await ui.unmount()
    await $.command.run({ command: 'maldives', args: 'reset' })
    await $.command.run({ command: 'maldives', args: 'auto' })
  }
})
