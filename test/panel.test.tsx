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
