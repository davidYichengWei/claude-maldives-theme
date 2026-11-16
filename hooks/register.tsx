import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, ThemeSetArgs } from 'claude-code'

import type { Mood, Need } from '../types'
import { berthAt, muster } from './fleet'
import type { Boat } from './fleet'
import { makeColors } from './make-colors.js'
import { FIREWORKS_MS, KEY_PARTS, UNFLAGGED, UNPAINTED, hoist, paint, signalOf } from './paint'
import type { Call, Flag } from './paint'
import { MOST_CALLED, callUp, stillOut } from './paint'
import { VISIT_SECONDS } from './scene'
import type { VisitKind } from './scene'
import { AT_HOME, DRILLS, embark, planOf } from './voyage'
import type { Drill, Voyage } from './voyage'

const { theme, problems } = makeColors({
  label: 'Maldives lagoon',
  roles: { accent: '#0e8fa8', danger: '#d0503f', success: '#2f9a63', warning: '#c98a1c', pro: '#6a5fb5' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#9fd6e6',
        'surface-1': '#b0dfeb',
        'surface-2': '#c3e8f0',
        'text-primary': '#06202b',
        'text-secondary': '#163844',
        'text-muted': '#2a4d59',
      },
    },
    git: {
      added: '#155e34',
      removed: '#952a22',
      modified: '#6a4700',
      merged: '#4e3590',
      closed: '#952a22',
      conflicting: '#7a4000',
      draft: '#2a4d59',
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a1c26',
        'surface-1': '#0f2530',
        'surface-2': '#132c39',
        'surface-3': '#173240',
        'text-primary': '#e8f6f7',
        'text-secondary': '#b9d6da',
        'text-muted': '#8fb0b6',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'maldives', glass: { blur: 0, opacity: 0.1 } },
}
// How opaque the app's panels may be over the backdrop, so their text reads
// more easily, from none to most; a tenth unless chosen.
const GLASSES: readonly number[] = [0, 0.1, 0.25, 0.4, 0.6, 0.8]
const GLASS = 0.1

const mood = atom({ plugin: 'maldives', key: 'mood' } as const, 'idle' as Mood)
const need = atom({ plugin: 'maldives', key: 'need' } as const, 'permission' as Need)
const crew = atom({ plugin: 'maldives', key: 'crew' } as const, 0)
const shells = atom({ plugin: 'maldives', key: 'shells' } as const, 0)
// The agent's real state, kept apart from what a preview shows.
const live = atom({ plugin: 'maldives', key: 'live' } as const, { mood: 'idle' as Mood, need: 'permission' as Need, crew: 0, shells: 0 })
const compacting = atom({ plugin: 'maldives', key: 'compacting' } as const, false)
const fireworks = atom({ plugin: 'maldives', key: 'fireworks' } as const, 0)
const leap = atom({ plugin: 'maldives', key: 'leap' } as const, 0)
// The lead boat's trip with the mascot, and the other boats on the water. Each
// keeps the times it turns on, so a redraw, or the mod loading again, finds
// everything where it was.
const voyage = atom({ plugin: 'maldives', key: 'voyage' } as const, AT_HOME as Voyage)
const boats = atom({ plugin: 'maldives', key: 'boats' } as const, [] as Boat[])
// Swimmers, gulls and dolphins called up by hand, while they are out.
const visits = atom({ plugin: 'maldives', key: 'visits' } as const, [] as Call[])
// What can be called, by where it shows, with its button's label.
const WILDLIFE: readonly { where: string; kinds: readonly [VisitKind, string][] }[] = [
  { where: 'Under water', kinds: [['snappers', 'Snappers'], ['bannerfish', 'Bannerfish'], ['turtle', 'Turtle'], ['manta', 'Manta'], ['ray', 'Eagle ray']] },
  { where: 'On the surface', kinds: [['whaleShark', 'Whale shark'], ['fin', 'Shark'], ['dolphins', 'Dolphins']] },
  { where: 'In the sky', kinds: [['gulls', 'Gulls']] },
]
const KINDS = WILDLIFE.flatMap(group => group.kinds.map(([kind]) => kind))

// Flying fish leap in a scene drawn within this long of a prompt being sent.
const LEAP_MS = 5000
let leapUntil = 0

// The tool whose permission dialog is up, so its own return clears the wait.
let askedTool = ''

type Scheme = 'light' | 'dark' | 'auto'
const SCHEMES: readonly Scheme[] = ['light', 'dark', 'auto']
// The scheme in force, kept from the store for the control pane to show.
const shownScheme = atom({ plugin: 'maldives', key: 'scheme' } as const, 'auto' as Scheme)
// The control panel above the prompt: whether it is shown, and which of its
// menus is open below its top row (none for the top row alone).
type Menu = 'appearance' | 'boats' | 'claude' | 'wildlife'
const MENUS: readonly { menu: Menu; label: string }[] = [
  { menu: 'appearance', label: 'Appearance' },
  { menu: 'boats', label: 'Boats' },
  { menu: 'claude', label: 'Clawd' },
  { menu: 'wildlife', label: 'Wildlife' },
]
const controls = atom({ plugin: 'maldives', key: 'controls' } as const, false)
// The panels' opacity and the panel's language in force, kept from the store.
const shownGlass = atom({ plugin: 'maldives', key: 'glass' } as const, GLASS)
type Lang = 'en' | 'zh'
const LANGS: readonly [Lang, string][] = [['en', 'English'], ['zh', '中文']]
const shownLang = atom({ plugin: 'maldives', key: 'lang' } as const, 'en' as Lang)
// The panel's words in Chinese, by their English.
const ZH: Readonly<Record<string, string>> = {
  'Control Panel': '控制面板', Appearance: '外观', Boats: '船只', Clawd: 'Clawd', Wildlife: '野生动物', Reset: '重置', Close: '关闭',
  Scheme: '配色', Light: '浅色', Dark: '深色', Auto: '自动', Language: '语言', 'Panel opacity': '面板不透明度',
  Dinghies: '小艇', 'Fishing boats': '渔船',
  State: '状态', Idle: '空闲', Working: '工作中', Error: '出错', Fireworks: '烟花',
  'Waiting on': '等待', Permission: '权限', Question: '提问', Plan: '计划',
  'On the island': '岛上活动', Fishing: '钓鱼', Hammock: '吊床', Lounger: '躺椅', Bar: '吧台', 'Fire pit': '火堆', Tour: '都玩一遍',
  'Under water': '水下', 'On the surface': '水面', 'In the sky': '天空',
  'Flying fish': '飞鱼', Snappers: '笛鲷群', Bannerfish: '马夫鱼群', Turtle: '海龟', Manta: '蝠鲼', 'Eagle ray': '鹞鲼', 'Whale shark': '鲸鲨', Shark: '鲨鱼', Dolphins: '海豚', Gulls: '海鸥',
}
// Each pastime's button, named for where Clawd spends it rather than how
// (a nap, sunbathing), so it reads right by day and by night alike: the
// panel cannot tell which the backdrop shows while it follows the app.
const PASTIME_LABEL: Readonly<Record<Drill, string>> = { fish: 'Fishing', nap: 'Hammock', sun: 'Lounger', sip: 'Bar', fire: 'Fire pit', tour: 'Tour' }
// `english` in the panel's language.
const words = (lang: Lang) => (english: string): string => (lang === 'zh' ? ZH[english] ?? english : english)
const menu = atom({ plugin: 'maldives', key: 'menu' } as const, 'none' as Menu | 'none')

const title = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

async function applyLook($: EngineInterface): Promise<void> {
  const stored = await $.store.get('scheme')
  const scheme = SCHEMES.find(s => s === stored) ?? 'auto'
  await update($, shownScheme, () => scheme)
  const keptGlass = await $.store.get('glass')
  const glass = GLASSES.find(g => g === keptGlass) ?? GLASS
  await update($, shownGlass, () => glass)
  const lit: ThemeSetArgs = { ...LOOK, backdrop: { scene: 'maldives', glass: { blur: 0, opacity: glass } } }
  const look: ThemeSetArgs = scheme === 'auto' ? lit : { ...lit, overrideColorScheme: scheme }
  const set = await $.theme.set(look)
  if (!set.isDrawn) {
    $.ui.log(`theme not drawn yet: ${set.reason}`)
  }
}

const MOODS: readonly Mood[] = ['idle', 'working', 'waiting', 'done', 'error']
// As many boats of a kind as there are circuits for them.
const MOST_BOATS = 5
const NEEDS: readonly Need[] = ['permission', 'question', 'plan']

// The lead boat fetches the mascot off the island when the agent has work, and
// lands it again when the work is over. It stays out while the agent needs the
// person: held on them, or stopped by a failure they have not seen, which
// stays up until their next prompt.
async function setMood($: EngineInterface, next: Mood): Promise<void> {
  const phase = next === 'idle' || next === 'done' ? 'land' : 'fetch'
  const now = await $.clock.now()
  if ((await read($, voyage)).phase !== phase) {
    await update($, voyage, last => embark(last, phase, now, next === 'done'))
  }
  await update($, mood, () => next)
}

// When a boat left waiting for a free circuit is next looked at again.
let berth = 0

// Brings the boats on the water in line with the subagents and background
// shells in flight. A boat that finds every circuit still taken by one sailing
// off is sent out once that one is clear.
async function recount($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  const wanted = { lead: 0, crew: await read($, crew), shell: await read($, shells) }
  await update($, boats, fleet => [...muster(fleet, wanted, now)])
  const when = berthAt(await read($, boats), wanted)
  if (when !== undefined && when !== berth) {
    berth = when
    $.clock.after(Math.max(1, when - now + 1), async () => {
      if (berth === when) {
        berth = 0
        await recount($)
      }
    })
  }
}

async function waitOn($: EngineInterface, kind: Need): Promise<void> {
  await update($, need, () => kind)
  await setMood($, 'waiting')
}

// The agent's own events: each sets its real state and shows it, so a real
// change ends any preview of what it changes.
async function feel($: EngineInterface, next: Mood): Promise<void> {
  await update($, live, state => ({ ...state, mood: next }))
  await setMood($, next)
}

async function hold($: EngineInterface, kind: Need): Promise<void> {
  await update($, live, state => ({ ...state, mood: 'waiting' as Mood, need: kind }))
  await waitOn($, kind)
}

async function count($: EngineInterface, kind: 'crew' | 'shells', change: (real: number) => number): Promise<void> {
  const real = change((await read($, live))[kind])
  await update($, live, state => ({ ...state, [kind]: real }))
  if (kind === 'crew') await update($, crew, () => real)
  else await update($, shells, () => real)
  await recount($)
}

// Ends every preview: the backdrop goes back to what the agent is doing, its
// running subagents counted afresh from the engine's own list.
async function reset($: EngineInterface): Promise<{ mood: Mood; crew: number; shells: number }> {
  const agents = await $.agent.list()
  const running = agents.filter(agent => agent.teammateId === undefined && (agent.status === 'pending' || agent.status === 'running' || agent.status === 'waiting')).length
  const real = { ...(await read($, live)), crew: running }
  await update($, live, () => real)
  await update($, need, () => real.need)
  await setMood($, real.mood)
  await update($, crew, () => real.crew)
  await update($, shells, () => real.shells)
  await recount($)
  return real
}

function needOf(tool: string): Need {
  return tool === 'AskUserQuestion' ? 'question' : tool === 'ExitPlanMode' ? 'plan' : 'permission'
}

// What `/maldives` and the controls do, each returning what it did.
async function forceScheme($: EngineInterface, scheme: Scheme): Promise<string> {
  await $.store.set('scheme', scheme)
  await applyLook($)
  return scheme === 'auto' ? 'Following the app appearance again.' : `Forced ${scheme} mode.`
}

async function setGlass($: EngineInterface, glass: number): Promise<void> {
  await $.store.set('glass', glass)
  await applyLook($)
}

async function setLang($: EngineInterface, lang: Lang): Promise<void> {
  await $.store.set('lang', lang)
  await update($, shownLang, () => lang)
}

async function sendOut($: EngineInterface, kind: 'crew' | 'shells', wanted: number): Promise<string> {
  const total = Math.max(0, Math.min(MOST_BOATS, wanted))
  if (kind === 'crew') await update($, crew, () => total)
  else await update($, shells, () => total)
  await recount($)
  return kind === 'crew' ? `Dinghies out: ${total}` : `Fishing boats out: ${total}`
}

async function goAshore($: EngineInterface, drill: Drill): Promise<string> {
  const current = await read($, mood)
  if (current === 'working' || current === 'waiting') {
    return 'Clawd is out on the boat while Claude works. Try again once the turn is over.'
  }
  const now = await $.clock.now()
  await update($, voyage, last => ({ ...embark(last, 'land', now, false), drill }))
  return drill === 'tour' ? 'Clawd heads home, then takes a short turn at each pastime.' : `Clawd heads home, then goes straight to: ${drill}`
}

async function preview($: EngineInterface, state: Mood | Need): Promise<string> {
  const kind = NEEDS.find(n => n === state)
  if (kind !== undefined) {
    await waitOn($, kind)
    return `Backdrop state: waiting on ${kind}`
  }
  await setMood($, state as Mood)
  return `Backdrop state: ${state}`
}

async function call($: EngineInterface, kind: VisitKind): Promise<string> {
  const now = await $.clock.now()
  const calls = callUp(await read($, visits), kind, now)
  if (calls === undefined) {
    return `Already ${MOST_CALLED} ${kind} out; one more once one has gone by.`
  }
  await update($, visits, () => calls)
  // Gone by: dropped, so the button counts it no more.
  $.clock.after(VISIT_SECONDS[kind] * 1000 + 500, async () => {
    const later = await $.clock.now()
    await update($, visits, list => stillOut(list, later))
  })
  return `Called up: ${kind}`
}

// The flying fish leap, as they do when a prompt is sent. One leap at a time:
// a press while they are in the air would draw them anew from their start.
async function leapNow($: EngineInterface): Promise<string> {
  const now = await $.clock.now()
  if (now < leapUntil) {
    return 'The flying fish are still in the air.'
  }
  leapUntil = now + LEAP_MS
  await update($, leap, n => n + 1)
  // Back in the water: the panel's button goes out.
  $.clock.after(LEAP_MS + 100, async () => {
    await update($, leap, n => n + 1)
  })
  return 'Flying fish leaping.'
}

async function goLive($: EngineInterface): Promise<string> {
  const real = await reset($)
  const what = real.mood === 'waiting' ? `waiting on ${await read($, need)}` : real.mood
  return `Back to what Claude is doing: ${what}, ${real.crew} dinghies, ${real.shells} fishing boats.`
}

async function celebrate($: EngineInterface): Promise<void> {
  const firedAt = await $.clock.now()
  await update($, fireworks, () => firedAt)
  $.ui.toast('Shipped 🎆')
  $.clock.after(FIREWORKS_MS, async () => {
    await update($, fireworks, at => (at === firedAt ? 0 : at))
  })
}

// What the lead boat flies, what it flew before, and when it changed.
let flag: Flag = UNFLAGGED

// What is on screen.
let drawn = UNPAINTED
// How often the backdrop was asked for and how often it was drawn anew, for
// `/maldives debug`.
let tally = { asks: 0, builds: 0 }
// The latest asks for the backdrop: when, whether the scene was drawn anew,
// and how old the scene handed back was. A frame the app reloads with an old
// scene starts every loop where it stood when that scene was drawn.
// The latest asks for the backdrop and agent events, for the debug listing.
let recent: { at: number; what: string }[] = []
async function note($: EngineInterface, what: string): Promise<void> {
  recent = [...recent, { at: await $.clock.now(), what }].slice(-24)
}
// What made a new drawing, by the parts of the redraw key that changed.
function changedIn(before: string, after: string): string {
  const [was, is] = [before.split('|'), after.split('|')]
  const parts = KEY_PARTS.filter((_, i) => was[i] !== is[i])
  return parts.length > 0 ? parts.join(', ') : 'refresh'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await applyLook($)
    const keptLang = await $.store.get('lang')
    await update($, shownLang, () => LANGS.find(([one]) => one === keptLang)?.[0] ?? 'en')
    $.ui.status(undefined)
    await $.command.register({
      name: 'maldives',
      description:
        'Show or hide the Control Panel above the prompt with panel, call up a swimmer, gulls or a dolphin leap with visit <kind>, preview a state (idle | working | permission | question | plan | done | error | crew [0-5] | shells [0-5] | fireworks), go back to what Claude is really doing with reset, set the mascot to a pastime on the island (island fish | nap | sun | sip | fire | tour), force light | dark | auto, or print what the backdrop is showing with debug',
    })
    return next(e)
  })

  on('command.run', { command: 'maldives' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'panel') {
      const isShown = await update($, controls, shown => !shown)
      return { text: isShown ? 'Control Panel is above the prompt.' : 'Control Panel hidden.' }
    }
    if (arg === 'debug') {
      const now = await $.clock.now()
      const trip = await read($, voyage)
      const plan = planOf(trip)
      const place = (at: { x: number; y: number } | null): string => (at === null ? 'none' : `${Math.round(at.x)},${Math.round(at.y)}`)
      const lines = [
        `mood ${await read($, mood)}, need ${await read($, need)}, boats ${(await read($, boats)).length}`,
        `voyage ${trip.phase}, ${((now - trip.at) / 1000).toFixed(1)}s old, aboard ${trip.aboard}, boat ${place(trip.boat)}, clawd ${place(trip.clawd)}`,
        `plan: boards ${plan.boards.toFixed(1)}, lands ${plan.lands.toFixed(1)}, settled ${plan.settled.toFixed(1)}, gone ${plan.gone.toFixed(1)}`,
        `asked ${tally.asks} times, drawn ${tally.builds} times, last ${((now - drawn.built) / 1000).toFixed(1)}s ago, ${drawn.source.length} chars`,
        `key ${drawn.key}`,
        ...recent.map(a => `${((now - a.at) / 1000).toFixed(2)}s ago: ${a.what}`),
      ]
      return { text: lines.join('\n') }
    }
    if (arg === 'reset') {
      return { text: await goLive($) }
    }
    if (arg === 'fireworks') {
      await celebrate($)
      return { text: 'Fireworks over the lagoon.' }
    }
    // `crew` and `shells` take a count, or step to the next one without it;
    // `island` takes a pastime.
    const [word, amount] = arg.split(/\s+/)
    const asked = amount !== undefined && /^[0-5]$/.test(amount) ? Number(amount) : undefined
    if (word === 'island') {
      const drill = DRILLS.find(one => one === amount)
      if (drill === undefined) {
        return { text: `Usage: /maldives island ${DRILLS.join(' | ')}` }
      }
      return { text: await goAshore($, drill) }
    }
    if (word === 'visit') {
      const kind = KINDS.find(one => one === amount)
      return { text: kind === undefined ? `Usage: /maldives visit ${KINDS.join(' | ')}` : await call($, kind) }
    }
    if (word === 'shells' || word === 'crew') {
      const out = word === 'crew' ? await read($, crew) : await read($, shells)
      return { text: await sendOut($, word, asked ?? (out + 1) % 4) }
    }
    const scheme = SCHEMES.find(s => s === arg)
    if (scheme !== undefined) {
      return { text: await forceScheme($, scheme) }
    }
    const pick = [...MOODS, ...NEEDS].find(m => m === arg)
    if (pick === undefined) {
      return { text: `Usage: /maldives ${['panel', ...MOODS, ...NEEDS, 'reset', 'crew [0-5]', 'shells [0-5]', 'fireworks', `island ${DRILLS.join('|')}`, `visit ${KINDS.join('|')}`, ...SCHEMES].join(' | ')}` }
    }
    return { text: await preview($, pick) }
  })

  // The control panel: a top row of menus, Reset and Close, and under it the
  // open menu's buttons. Claude's menu offers the island's pastimes only while
  // Claude is idle or done, when the mascot is ashore to take them up.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, controls))) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const open = await read($, menu)
    const w = words(await read($, shownLang))
    // What a button does shows on the backdrop and in which button is lit, so
    // the words an action returns for `/maldives` are not shown here.
    const act = (run: () => Promise<unknown>) => async (): Promise<void> => {
      await run()
    }
    const pick = (key: string, label: string, isOn: boolean, run: () => Promise<unknown>) => (
      <Button key={key} label={label} variant={isOn ? 'primary' : 'secondary'} onPress={act(run)} />
    )
    // Close is tinted the lagoon's coral, apart from the controls.
    const CLOSE_TINT = '#ff9a8b'
    // Every row starts with a heading of one width, so the buttons below the
    // menus start where the menus do.
    const HEADING = 15
    const line = (heading: string, buttons: RenderChildren[], isBold = false) => (
      <Box flexDirection="row" gap={1} rowGap={2} flexWrap="wrap" alignItems="center">
        <Box width={HEADING}>
          <Text bold={isBold} dimColor={!isBold}>{w(heading)}</Text>
        </Box>
        {buttons}
      </Box>
    )
    const rows: RenderChildren[] = []
    if (open === 'wildlife') {
      // A kind with any out is lit and counts them, so a press shows at once;
      // with as many out as it may have it is dim until one has gone by.
      const now = await $.clock.now()
      const out = stillOut(await read($, visits), now)
      await read($, leap)
      const isLeaping = now < leapUntil
      for (const group of WILDLIFE) {
        rows.push(
          line(
            group.where,
            group.kinds.map(([kind, label]) => {
              const n = out.filter(v => v.kind === kind).length
              return <Button key={`call-${kind}`} label={n === 0 ? w(label) : `${w(label)} ×${n}`} variant={n > 0 ? 'primary' : 'secondary'} dimColor={n >= MOST_CALLED} onPress={act(() => call($, kind))} />
            }).concat(group.where === 'On the surface' ? [pick('call-flyingFish', w('Flying fish'), isLeaping, () => leapNow($))] : []),
          ),
        )
      }
    } else if (open === 'appearance') {
      const scheme = await read($, shownScheme)
      const glass = await read($, shownGlass)
      const lang = await read($, shownLang)
      rows.push(
        line('Scheme', SCHEMES.map(one => pick(`scheme-${one}`, w(title(one)), one === scheme, () => forceScheme($, one)))),
        line('Language', LANGS.map(([one, name]) => pick(`lang-${one}`, name, one === lang, () => setLang($, one)))),
        line('Panel opacity', GLASSES.map(one => pick(`glass-${Math.round(one * 100)}`, `${Math.round(one * 100)}%`, one === glass, () => setGlass($, one)))),
      )
    } else if (open === 'boats') {
      const counts = { crew: await read($, crew), shells: await read($, shells) }
      const stepper = (heading: string, which: 'crew' | 'shells') =>
        line(heading, [
          <Button key={`${which}-less`} label="−" onPress={act(() => sendOut($, which, counts[which] - 1))} />,
          <Text>{String(counts[which])}</Text>,
          <Button key={`${which}-more`} label="+" onPress={act(() => sendOut($, which, counts[which] + 1))} />,
        ])
      rows.push(stepper('Dinghies', 'crew'), stepper('Fishing boats', 'shells'))
    } else if (open === 'claude') {
      const current = await read($, mood)
      const kind = await read($, need)
      rows.push(
        line('State', [
          // Done differs from idle only in the wave Clawd gives as it lands, so
          // one button stands for both.
          ...(['idle', 'working', 'error'] as const).map(m => pick(`mood-${m}`, w(title(m)), m === current || (m === 'idle' && current === 'done'), () => preview($, m))),
          pick('fireworks', w('Fireworks'), false, () => celebrate($)),
        ]),
        line('Waiting on', NEEDS.map(n => pick(`need-${n}`, w(title(n)), current === 'waiting' && n === kind, () => preview($, n)))),
      )
      if (current === 'idle' || current === 'done') {
        const doing = (await read($, voyage)).drill
        rows.push(line('On the island', DRILLS.map(d => pick(`drill-${d}`, w(PASTIME_LABEL[d]), d === doing, () => goAshore($, d)))))
      }
    }
    return (
      <Box flexDirection="column" gap={2}>
        {line(
          'Control Panel',
          [
            ...MENUS.map(one => (
              <Button key={`menu-${one.menu}`} label={w(one.label)} variant={one.menu === open ? 'primary' : 'secondary'} onPress={() => update($, menu, was => (was === one.menu ? 'none' : one.menu))} />
            )),
            // Reset puts the panel back to its top row as well.
            <Button key="reset" label={w('Reset')} onPress={act(async () => {
              await goLive($)
              await update($, menu, () => 'none')
            })} />,
            <Box flexGrow={1} />,
            <Button key="close" label={w('Close')} role="dismiss" onPress={() => update($, controls, () => false)}>
              <Text color={CLOSE_TINT}>{w('Close')}</Text>
            </Button>,
          ],
          true,
        )}
        {rows}
      </Box>
    )
  })

  // Sending a prompt sets the fish leaping. An idle session redraws as its turn
  // starts; a prompt typed over a running turn changes no mood, so it asks for
  // the redraw itself.
  on('prompt.submit', async ($, e, next) => {
    await note($, `prompt sent${e.isMeta === true ? ' (meta)' : ''}`)
    if (e.isMeta !== true) {
      leapUntil = (await $.clock.now()) + LEAP_MS
      const current = await read($, mood)
      if (current === 'working' || current === 'waiting') {
        await update($, leap, n => n + 1)
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await note($, e.agentId === undefined ? 'turn started' : 'subagent turn started')
    if (e.agentId === undefined) {
      await feel($, 'working')
    } else {
      await count($, 'crew', n => n + 1)
    }
    return next(e)
  })

  // A subagent started in the background outlives the main turn, so the main
  // turn's end leaves the count alone.
  on('turn.complete', async ($, e, next) => {
    await note($, `${e.agentId === undefined ? 'turn' : 'subagent turn'} ended (${e.reason})`)
    if (e.agentId !== undefined) {
      await count($, 'crew', n => Math.max(0, n - 1))
    } else {
      await feel($, e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error')
    }
    return next(e)
  })

  // The engine's own count of the work still in flight as the main turn ends:
  // the counts kept from single events are corrected to it.
  on('classic.Stop', async ($, e, next) => {
    const tasks = e.background_tasks
    if (tasks !== undefined) {
      const inFlight = (type: string): number => tasks.filter(task => task.type === type).length
      await count($, 'shells', () => inFlight('shell'))
      await count($, 'crew', () => inFlight('subagent'))
    }
    return next(e)
  })

  // A permission dialog put to the person means the agent waits on them. The
  // engine's own ask verdict does not: the mode may settle it with nobody asked.
  on('classic.PermissionRequest', async ($, e, next) => {
    askedTool = e.tool_name
    await hold($, needOf(e.tool_name))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    if (e.trigger === 'precompute') {
      return next(e)
    }
    await update($, compacting, () => true)
    try {
      return await next(e)
    } finally {
      await update($, compacting, () => false)
    }
  })

  on('tool.call', async ($, e, next) => {
    const isMain = e.agentId === undefined
    if (isMain && (e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode')) {
      await hold($, needOf(e.tool))
    }
    const ran = await next(e)
    if ((isMain || e.tool === askedTool) && (await read($, live)).mood === 'waiting') {
      askedTool = ''
      await feel($, 'working')
    }
    const isOk = ran.deny === undefined && ran.isError !== true
    if (isOk && e.tool === 'Bash' && e.run_in_background === true) {
      await count($, 'shells', n => n + 1)
    }
    // Work shipped: a push, or a pull or merge request opened.
    const isShipped =
      /create_(merge|pull)_request$/.test(e.tool) ||
      (e.tool === 'Bash' && /\bgit\s+push\b|\bgh\s+pr\s+create\b/.test(e.command))
    if (isOk && isShipped) {
      await celebrate($)
    }
    return ran
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const current = await read($, mood)
    const kind = await read($, need)
    await read($, leap)
    const now = await $.clock.now()
    flag = hoist(flag, signalOf(current, kind), now)
    const before = drawn.built
    const keyBefore = drawn.key
    drawn = paint(
      drawn,
      {
        mood: current,
        need: kind,
        isCompacting: await read($, compacting),
        firedAt: await read($, fireworks),
        scheme: e.props.overrideColorScheme,
        voyage: await read($, voyage),
        boats: await read($, boats),
        leapUntil,
        flag,
        visits: await read($, visits),
      },
      now,
    )
    tally = { asks: tally.asks + 1, builds: tally.builds + (drawn.built !== before ? 1 : 0) }
    await note($, drawn.built !== before ? `asked, drawn anew (${changedIn(keyBefore, drawn.key)})` : `asked, kept the drawing from ${((now - drawn.built) / 1000).toFixed(1)}s before`)
    return (
      <Svg
        source={drawn.source}
        alt={`A Maldives lagoon: ${current === 'waiting' ? `waiting on ${kind}` : current}`}
        isInteractive
      />
    )
  })
}
