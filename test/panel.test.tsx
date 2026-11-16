import { expect, test } from 'claude-code/testing'

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

test('/maldives panel shows the Control Panel above the prompt, Close hides it', async ($, on) => {
  // Each hook here stands for the engine: what it draws when the mod passes.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()

  expect(await $.command.run({ command: 'maldives', args: 'panel' })).toMatchObject({ text: 'Control Panel is above the prompt.' })
  expect((await ui.find({ type: 'Text', text: 'Control Panel' }))?.text).toBe('Control Panel')
  // The top row alone until a menu is opened.
  expect(await ui.find({ key: 'scheme-dark' })).toBeUndefined()

  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()
  await ui.unmount()
})

test('a menu opens its row below, and pressing it again closes it', async ($, on) => {
  await $.command.run({ command: 'maldives', args: 'panel' })
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
  await $.command.run({ command: 'maldives', args: 'panel' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await ui.press({ key: 'menu-boats' })
  await ui.press({ key: 'crew-more' })
  await ui.press({ key: 'crew-more' })
  expect(await after(ui, 'Dinghies')).toBe('2')
  await ui.press({ key: 'crew-less' })
  await ui.press({ key: 'crew-less' })
  await ui.press({ key: 'crew-less' })
  expect(await after(ui, 'Dinghies')).toBe('0')
  for (let i = 0; i < 7; i++) await ui.press({ key: 'shells-more' })
  expect(await after(ui, 'Fishing boats')).toBe('5')

  await ui.press({ key: 'reset' })
  // The top row alone again, and the boats back to none.
  expect(await ui.find({ key: 'shells-more' })).toBeUndefined()
  await ui.press({ key: 'menu-boats' })
  expect(await after(ui, 'Fishing boats')).toBe('0')
  await ui.unmount()
})

test('the island pastimes are offered only while Claude is idle or done', async ($, on) => {
  let now = 1_000_000
  on('clock.now', () => ({ value: (now += 100) }))
  await $.command.run({ command: 'maldives', args: 'panel' })
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
  await $.command.run({ command: 'maldives', args: 'panel' })
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
  await $.command.run({ command: 'maldives', args: 'panel' })
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
  await $.command.run({ command: 'maldives', args: 'panel' })
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
    // Left in English: Clawd's name and the language's own.
    const english = (await shown()).filter(word => /[A-Za-z]/.test(word.replace(/Clawd|English/g, '')))
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
  await $.command.run({ command: 'maldives', args: 'panel' })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: 'survey' }))?.text).toBe('survey')
  await ui.unmount()
})
