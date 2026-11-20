import { expect, mock, test } from 'claude-code/testing'

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

const debug = async ($: { command: { run: (i: { command: string; args: string }) => Promise<unknown> } }): Promise<string> =>
  String(((await $.command.run({ command: 'maldives', args: 'debug' })) as { text?: string } | undefined)?.text)

test('/maldives demo plays a day on its own: the panel hides, Clawd works, waits, goes home, and the panel comes back at the end', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('theme.set', () => ({ value: { isDrawn: true } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeDefined()

  expect(await $.command.run({ command: 'maldives', args: 'demo' })).toMatchObject({ text: expect.stringContaining('Demo running') })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeUndefined()

  await clock.advance(2_000)
  expect(await debug($)).toContain('mood idle')
  await clock.advance(48_000)
  expect(await debug($)).toContain('mood working')
  await clock.advance(180_000)
  expect(await debug($)).toContain('mood waiting, need permission')
  await clock.advance(25_000)
  expect(await debug($)).toContain('mood working')
  await clock.advance(75_000)
  expect(await debug($)).toContain('mood idle')

  await clock.advance(130_000)
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeDefined()
  await ui.unmount()
})

test('/maldives demo stop ends the run early and brings the panel back', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('theme.set', () => ({ value: { isDrawn: true } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await $.command.run({ command: 'maldives', args: 'demo' })
  await clock.advance(60_000)
  expect(await debug($)).toContain('mood working')

  expect(await $.command.run({ command: 'maldives', args: 'demo stop' })).toMatchObject({ text: 'Demo stopped.' })
  expect(await ui.find({ type: 'Text', text: 'Control Panel' })).toBeDefined()
  // Nothing more happens: it stays at work, never waiting.
  await clock.advance(200_000)
  expect(await debug($)).toContain('mood working')
  expect(await $.command.run({ command: 'maldives', args: 'demo stop' })).toMatchObject({ text: 'No demo running.' })
  await ui.unmount()
})
