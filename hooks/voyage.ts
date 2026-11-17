// The island the mascot lives on, the lead boat that carries it, and the trips
// between the two: the boat fetches the mascot off the jetty when the agent
// has work and lands it there again when the work is over. Every place here is
// a function of the time since the trip began, so a redraw finds both where
// they were.

import { ROUTES, TURN_PIECES, depthScale, eased, lapAt } from './fleet'
import type { Boat, Curve, Point, Side } from './fleet'

// The palms and the hammock stand around this x. The beach runs from its tip
// on the left out past the right edge of the view.
export const ISLE = 1370
export const BEACH_TIP = 1200

// The jetty off the beach's tip: its deck, from the outer end to the sand.
export const JETTY = { tip: 1128, root: 1246, y: 712 }
// What stands on the beach: a fire, a sun lounger, a bar.
export const FIRE: Point = { x: 1424, y: 741 }
export const LOUNGER: Point = { x: 1474, y: 728 }
export const BAR: Point = { x: 1584, y: 712 }

// Where the mascot's day starts and ends.
export const HOME: Point = { x: ISLE - 40, y: 729 }
// The sand under the hammock, and the hammock.
const GROUND_Y = 724
const HAMMOCK_FOOT: Point = { x: ISLE - 25, y: GROUND_Y }
const HAMMOCK: Point = { x: ISLE - 25, y: 644 }
// Where the jetty meets the sand, where the mascot fishes from it, and where
// it steps on and off the boat.
const ROOT: Point = { x: JETTY.root - 4, y: JETTY.y + 2 }
const FISHING: Point = { x: JETTY.tip + 14, y: JETTY.y }
// Far enough in that the mascot's feet stay on the deck and clear of the
// lantern post at the end.
const BOARD: Point = { x: JETTY.tip + 34, y: JETTY.y }
const BY_FIRE: Point = { x: FIRE.x - 30, y: 735 }
// Where it climbs onto the lounger from, on the sand in front of it, and
// where it lies.
const BY_LOUNGER: Point = { x: LOUNGER.x - 14, y: 744 }
const ON_LOUNGER: Point = { x: LOUNGER.x, y: LOUNGER.y }
const AT_BAR: Point = { x: BAR.x - 48, y: 728 }

// Where the boat lies for the mascot: clear of the jetty's outer end, stern to
// it. The mascot rides DECK astern of the boat's middle.
export const DOCK: Point = { x: 1070, y: 742 }
export const DECK = 28
// Where the mascot stands on deck with the boat lying stern to the jetty,
// and with it lying bow to the jetty.
const STERN: Point = { x: DOCK.x + DECK, y: DOCK.y }
const AFT: Point = { x: DOCK.x - DECK, y: DOCK.y }

// The water villas' boardwalk, as far as its outer end, and its top, where
// the mascot's feet are as it walks it. Its crate of coconuts stands on the
// walk between the last villa and the end. The boat lies off the end, stern to it, for the mascot to fetch a
// coconut; farther out than the jetty, the boat and the mascot are smaller
// there, and so are its deck, its hops and its steps.
export const WALK = { end: 600, y: 563 }
export const CRATE: Point = { x: 530, y: WALK.y }
export const PIER: Point = { x: 643, y: 598 }
// How much smaller things are off the walk than off the jetty.
export const PIER_SCALE = Math.round((depthScale(PIER.y) / depthScale(DOCK.y)) * 1000) / 1000
const PIER_STERN: Point = { x: PIER.x - Math.round(DECK * PIER_SCALE), y: PIER.y }
const PIER_BOARD: Point = { x: WALK.end - 24, y: WALK.y }
// Where the mascot stands at the crate, its left hand over the crate's end.
export const AT_CRATE: Point = { x: CRATE.x + 44, y: WALK.y }
// Where the mascot waits for the seaplane: by the crate, to catch the
// coconuts thrown down from its door and set them in.
export const WAIT: Point = AT_CRATE
const PIER_SPEED = 40 * PIER_SCALE

// The edges the lead boat comes in and goes out by, and the lanes it keeps to
// on its way to each.
const GATE_X: Record<Side, number> = { L: -110, R: 1710 }
const LANE_Y: Record<Side, number> = { L: 770, R: 830 }
// How long the boat takes to come about, and the mascot to hop on or off.
export const TURN_S = 2
const HOP_S = 0.8

const EASE: Curve = [0.42, 0, 0.58, 1]
// Slowing evenly from full speed to a stop.
const COAST: Curve = [1 / 3, 2 / 3, 2 / 3, 1]
// How hard the boat slows when called back under way, in px a second, a
// second: it carries on a way before it comes about.
const COAST_DECEL = 45
// How near the dock a boat called back with the dock astern backs onto it,
// rather than coming about to make for it and again to lie there; and how
// fast it backs, in px a second.
const ASTERN_MAX = 160
const ASTERN_SPEED = 25
const ARRIVE: Curve = [0.3, 0.4, 0.5, 1]
const DEPART: Curve = [0.45, 0, 0.7, 0.75]
// How fast the boat crosses the water to and from the edges, in px a second:
// brisker than its circuit, never in a rush.
const EDGE_SPEED = 60

// The lead boat's circuit. It is joined at its right-hand end heading left,
// just past where the circuit comes about there, so the boat joins it facing
// the way it sails.
const LEAD: Boat = { kind: 'lead', slot: 0, from: 'R', pass: 'under', born: 0, gone: undefined }
const LAP_S = ROUTES.lead[0]?.seconds ?? 100
export const CIRCUIT_START = LAP_S * 0.515
// How a circuit boat faces through its lap, as [share of the lap, scaleX]: it
// comes about at either end. The scene's `of` keyframes say the same.
const TURN = 1 / TURN_PIECES
export const LAP_FACING: readonly [number, number][] = [[0, 0], [TURN, 1], [0.5 - TURN, 1], [0.5, 0], [0.5 + TURN, -1], [1 - TURN, -1], [1, 0]]

// Scatter in [0, 1) that is the same for the same seed: what the mascot does
// is drawn from it, so each trip has a day of its own that every redraw
// agrees on.
export function scatter(seed: number): () => number {
  let state = (Math.floor(seed) % 4294967296) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let v = state
    v = Math.imul(v ^ (v >>> 15), v | 1)
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61)
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296
  }
}

function gap(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function within(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

// The mascot's day on the island, round and round: what it is doing until
// each second, and where that leaves it.
export type Doing = 'stand' | 'walk' | 'fish' | 'leap' | 'nap' | 'sun' | 'sip'
export type Step = { until: number; x: number; y: number; doing: Doing }
export type Day = { steps: readonly Step[]; span: number }

// About how long a day runs before it comes round again.
const DAY_S = 460

export type Pastime = 'fish' | 'nap' | 'sun' | 'sip' | 'fire'
export const PASTIMES: readonly Pastime[] = ['fish', 'nap', 'sun', 'sip', 'fire']

// A day asked for by hand: one pastime right away, or a short turn at each
// of them, before the day runs on as usual.
export type Drill = Pastime | 'tour'
const TOUR: readonly Pastime[] = ['fish', 'fire', 'sun', 'sip', 'nap']
export const DRILLS: readonly Drill[] = [...PASTIMES, 'tour']

// A day drawn from `seed`: strolls along the sand between longer pastimes,
// never the same pastime twice running. It fishes off the jetty, lies under
// the parasol, stands at the bar and by the fire, and once it has been idle a
// while it climbs into the hammock for a nap. A `drill` goes first.
function buildDay(seed: number, drill: Drill | undefined): Day {
  const rand = scatter(seed)
  const between = (low: number, high: number): number => low + (high - low) * rand()
  // On a tour each pastime lasts only a few seconds.
  let isBrief = drill === 'tour'
  const spell = (low: number, high: number): number => (isBrief ? between(8, 11) : between(low, high))
  const steps: Step[] = []
  let at: Point = HOME
  let t = 0
  const hold = (doing: Doing, seconds: number, to: Point = at): void => {
    t = Math.round((t + seconds) * 10) / 10
    at = { x: Math.round(to.x), y: Math.round(to.y) }
    steps.push({ until: t, x: at.x, y: at.y, doing })
  }
  const go = (to: Point): void => {
    // On and off the jetty by where it meets the sand.
    if (at.x < ROOT.x - 2 !== to.x < ROOT.x - 2) {
      hold('walk', gap(at, ROOT) / between(13, 20), ROOT)
    }
    if (gap(at, to) > 2) {
      hold('walk', gap(at, to) / between(13, 20), to)
    }
  }
  const pastimes: Record<Pastime, () => void> = {
    fish: () => {
      go(FISHING)
      hold('stand', between(1, 2))
      hold('fish', spell(35, 75))
      hold('stand', between(1, 3))
    },
    nap: () => {
      go(HAMMOCK_FOOT)
      hold('stand', between(1, 2.5))
      hold('leap', 1.2, HAMMOCK)
      hold('nap', spell(80, 140))
      hold('leap', 1.2, HAMMOCK_FOOT)
      hold('stand', between(5, 8))
    },
    sun: () => {
      go(BY_LOUNGER)
      hold('stand', between(1, 2.5))
      hold('leap', 1, ON_LOUNGER)
      hold('sun', spell(30, 65))
      hold('leap', 1, BY_LOUNGER)
      hold('stand', between(2, 4))
    },
    sip: () => {
      go(AT_BAR)
      hold('sip', spell(14, 30))
    },
    fire: () => {
      go(BY_FIRE)
      hold('stand', spell(9, 18))
    },
  }
  hold('stand', drill === undefined ? between(6, 9) : 1)
  let last: Pastime | undefined
  let hasNapped = false
  for (const one of drill === undefined ? [] : drill === 'tour' ? TOUR : [drill]) {
    pastimes[one]()
    last = one
    hasNapped = hasNapped || one === 'nap'
  }
  isBrief = false
  while (t < DAY_S) {
    for (let strolls = 1 + Math.floor(rand() * 2.4); strolls > 0; strolls--) {
      go(strollTo(between(JETTY.root + 16, BAR.x - 20), between(726, 731)))
      hold('stand', between(4, 10))
    }
    const open = PASTIMES.filter(one => one !== last && (one !== 'nap' || t > 90))
    const next: Pastime = !hasNapped && t > 200 ? 'nap' : (open[Math.floor(rand() * open.length)] ?? 'fire')
    pastimes[next]()
    last = next
    hasNapped = hasNapped || next === 'nap'
  }
  go(HOME)
  hold('stand', 4)
  return { steps, span: t }
}

// How long the mascot takes to get down from the hammock or off the lounger.
export const RISE_S = 0.6

// The mascot in the hammock or on the lounger, or part way in or out: `u` is
// the share of its getting down already behind it, 0 while it lies there.
// Part way in, it is as far down as it would be on its way out from there.
export type Rise = { bed: 'hammock' | 'lounger'; u: number }

// How far the mascot `seconds` into `day` is out of the hammock or off the
// lounger, if it is in one or climbing in or out: told by what it is doing
// then, as a stroll may pass right by the lounger.
function riseIn(day: Day, seconds: number): Rise | undefined {
  const s = ((seconds % day.span) + day.span) % day.span
  const i = day.steps.findIndex(step => s < step.until)
  const step = day.steps[i]
  if (step === undefined) {
    return undefined
  }
  const bedOf = (doing: Doing | undefined): Rise['bed'] | undefined => (doing === 'nap' ? 'hammock' : doing === 'sun' ? 'lounger' : undefined)
  const lying = bedOf(step.doing)
  if (lying !== undefined) {
    return { bed: lying, u: 0 }
  }
  if (step.doing !== 'leap') {
    return undefined
  }
  const since = day.steps[i - 1]?.until ?? 0
  const p = Math.min(1, Math.max(0, (s - since) / Math.max(0.001, step.until - since)))
  const off = bedOf(day.steps[i - 1]?.doing)
  if (off !== undefined) {
    return { bed: off, u: p }
  }
  const on = bedOf(day.steps[i + 1]?.doing)
  return on === undefined ? undefined : { bed: on, u: 1 - p }
}

// Whether `at` is on the lounger or on the sand in front of it, where the
// mascot stands before the lounger rather than behind it.
export function isByLounger(at: Point): boolean {
  return gap(at, BY_LOUNGER) < 3 || gap(at, ON_LOUNGER) < 3
}

// A spot on the sand to stroll to, never on the lounger itself.
function strollTo(x: number, y: number): Point {
  const isOnLounger = x > LOUNGER.x - 58 && x < LOUNGER.x + 30
  return { x: isOnLounger ? LOUNGER.x - 58 : x, y }
}

let built: { seed: number; drill: Drill | undefined; day: Day } | undefined

export function dayOf(seed: number, drill?: Drill): Day {
  if (built === undefined || built.seed !== seed || built.drill !== drill) {
    built = { seed, drill, day: buildDay(seed, drill) }
  }
  return built.day
}

// Where the mascot is `seconds` into `day`. It goes from place to place at
// an even pace, as the scene's `lpos` keyframes carry it: easing every walk
// of a day would take more stops than the scene has room for on its clock.
export function lifeAt(day: Day, seconds: number): Point {
  const s = ((seconds % day.span) + day.span) % day.span
  let from: Point = HOME
  let since = 0
  for (const step of day.steps) {
    if (s < step.until) {
      const e = Math.min(1, (s - since) / Math.max(0.001, step.until - since))
      return { x: from.x + (step.x - from.x) * e, y: from.y + (step.y - from.y) * e }
    }
    from = step
    since = step.until
  }
  return HOME
}

// A trip, from the moment it began: `fetch` takes the mascot off the island to
// the boat's circuit, `land` brings it back and sends the boat away. `boat`
// and `clawd` are where the two were at that moment, the boat nowhere if it
// was out of view, and `aboard` whether the mascot was on the boat. `greet`
// marks a landing after a finished turn, `drill` a day asked for by hand,
// `exit` the edge the boat goes out by after a landing (on a fetch it comes
// in by the edge it last went out by), and `facing` how the boat faced as the
// trip began, as the scaleX it was drawn with.
export type Voyage = {
  phase: 'fetch' | 'land'
  at: number
  boat: Point | null
  clawd: Point
  aboard: boolean
  greet: boolean
  drill?: Drill
  exit?: Side
  facing?: number
  // The trip began with the mascot in the air, `p` of the way through a hop
  // from `a` to `b`: it comes down at `b` before anything else.
  hop?: Hop
  // The trip began with the boat under way: it carries on to `to`, slowing to
  // a stop over `seconds`, before it sets out on this trip.
  coast?: Coast
  // The trip began with the mascot aboard and owed coconuts: the boat goes by
  // the end of the boardwalk first, where the mascot takes `take` from the
  // crate, drinking each there and tossing the shell into the sea. `from` is
  // how the coconuts stood as it set out.
  errand?: Errand
  // The trip began with the mascot in the hammock or on the lounger, or part
  // way in or out: it gets down from there first.
  rise?: Rise
  // The trip began with the seaplane called: the boat makes for the end of
  // the boardwalk (picking the mascot up first when it is ashore), and the
  // mascot waits on the walk until the plane has been unloaded.
  wait?: boolean
}

export type Hop = { a: Point; b: Point; p: number }
export type Coast = { to: Point; seconds: number }
export type Errand = { take: number; from: Stock }

export const AT_HOME: Voyage = { phase: 'land', at: 0, boat: null, clawd: HOME, aboard: false, greet: false }

// One stretch of a trip, in seconds since it began. A straight stretch is
// paced by `curve`; one with no curve bends, at an even pace, unless `glide`
// paces its sideways travel, which then runs from end to end on that curve.
// `stride` marks the stretches the mascot covers on its legs.
// `hop` marks a hop: the whole of it, and how far into it the stretch starts.
export type Leg = { from: number; to: number; at: (p: number) => Point; heading: 1 | -1; stride: boolean; curve: Curve | undefined; glide?: Curve; hop?: { a: Point; b: Point; p0: number } }

function straight(from: number, to: number, a: Point, b: Point, curve: Curve, stride: boolean): Leg {
  const at = (p: number): Point => {
    const e = eased(curve, p)
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
  }
  return { from, to, at, heading: b.x >= a.x ? 1 : -1, stride, curve }
}

// The boat lying still at `at`, heading `heading`.
function still(from: number, to: number, at: Point, heading: 1 | -1): Leg {
  return { from, to, at: () => at, heading, stride: false, curve: EASE }
}

// The boat lying at the dock, by default stern to the jetty.
function moored(from: number, to: number, heading: 1 | -1 = -1): Leg {
  return still(from, to, DOCK, heading)
}

// Where a hop from `a` to `b` is, `p` of the way through: rising between them,
// less high farther out.
function inHop(a: Point, b: Point, p: number): Point {
  const rise = 190 * Math.min(1, depthScale(Math.max(a.y, b.y)) / depthScale(DOCK.y))
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - rise * p * (1 - p) }
}

// A hop from `a` to `b`, or the rest of one already `p0` of the way through.
function hop(from: number, a: Point, b: Point, p0 = 0): Leg {
  const at = (p: number): Point => inHop(a, b, p0 + (1 - p0) * p)
  return { from, to: from + HOP_S * (1 - p0), at, heading: 1, stride: false, curve: undefined, hop: { a, b, p0 } }
}

// The hop the mascot is in the air in at `t` along `legs`, if any.
function hopAt(legs: readonly Leg[], t: number): Hop | undefined {
  const leg = legs.find(one => t < one.to)
  if (leg?.hop === undefined || t < leg.from) {
    return undefined
  }
  const { a, b, p0 } = leg.hop
  const p = p0 + (1 - p0) * ((t - leg.from) / (leg.to - leg.from))
  // Still on the ground where a hop starts; a hop taken over from a trip
  // called away mid-air is off it from its first instant.
  return p > 0 ? { a, b, p } : undefined
}

const isDeck = (at: Point): boolean => Math.abs(at.y - DOCK.y) < 2 && Math.abs(at.x - DOCK.x) <= DECK + 1
// On the deck of the boat lying off the boardwalk; on the walk itself.
export const isPierDeck = (at: Point): boolean => Math.abs(at.y - PIER.y) < 2 && Math.abs(at.x - PIER.x) <= DECK * PIER_SCALE + 1
export const isOnWalk = (at: Point): boolean => Math.abs(at.y - WALK.y) < 2 && at.x <= WALK.end && at.x > CRATE.x - 53

// The lane between `a` and the edge on `side`, `u` of the way from `a`: it
// eases down onto the lane as it draws away from `a`, so on the right it
// passes in front of the island.
function lane(a: Point, side: Side, u: number): Point {
  const y = Math.max(a.y, LANE_Y[side])
  const x = a.x + (GATE_X[side] - a.x) * u
  const s = within(Math.abs(x - a.x) / 260, 0, 1)
  return { x, y: a.y + (y - a.y) * s * s * (3 - 2 * s) }
}

function laneSeconds(a: Point, side: Side): number {
  return within(Math.abs(GATE_X[side] - a.x) / EDGE_SPEED, 6, 20)
}

// The boat's way out from `a` by the edge on `side`.
function leaving(from: number, a: Point, side: Side): Leg {
  const at = (p: number): Point => lane(a, side, eased(DEPART, p))
  return { from, to: from + laneSeconds(a, side), at, heading: side === 'R' ? 1 : -1, stride: false, curve: undefined, glide: DEPART }
}

// The boat's way in by the edge on `side` to `b`, over `span` seconds.
function arriving(span: number, b: Point, side: Side): Leg {
  if (side === 'L') {
    return straight(0, span, { x: GATE_X.L, y: LANE_Y.L }, b, ARRIVE, false)
  }
  const at = (p: number): Point => lane(b, side, 1 - eased(ARRIVE, p))
  return { from: 0, to: span, at, heading: -1, stride: false, curve: undefined, glide: ARRIVE }
}

export function otherSide(side: Side): Side {
  return side === 'L' ? 'R' : 'L'
}

function endOf(legs: readonly Leg[], otherwise: number): number {
  return legs[legs.length - 1]?.to ?? otherwise
}

// The mascot's way on foot from `from` to `to`, starting at `start`. Up in
// the hammock or on the lounger, it gets down to the sand first; and it steps on and off the jetty
// by where that meets the sand.
function footpath(from: Point, to: Point, start: number, speed: number, rising?: Rise): Leg[] {
  const legs: Leg[] = []
  let at = from
  let t = start
  const move = (next: Point, seconds: number, stride: boolean): void => {
    legs.push(straight(t, t + seconds, at, next, EASE, stride))
    at = next
    t += seconds
  }
  const walk = (next: Point): void => {
    if (gap(at, next) > 1) {
      move(next, Math.max(0.5, gap(at, next) / speed), true)
    }
  }
  // Getting down from the hammock or off the lounger, it carries on from as
  // far as it had got.
  if (rising !== undefined) {
    move(rising.bed === 'hammock' ? { x: at.x, y: GROUND_Y } : BY_LOUNGER, Math.max(0.05, RISE_S * (1 - rising.u)), false)
  } else if (at.y < 700) {
    move({ x: at.x, y: GROUND_Y }, RISE_S, false)
  }
  if (at.x < ROOT.x - 2 !== to.x < ROOT.x - 2) {
    walk(ROOT)
  }
  walk(to)
  if (legs.length === 0) {
    move(to, 0.1, false)
  }
  return legs
}

// A trip laid out in seconds since it began.
export type Plan = {
  // The boat's course until `settled` (a fetch) or `gone` (a landing); empty
  // when no boat is under way.
  boat: Leg[]
  // The mascot's course while it is on its own feet and not yet living its day.
  clawd: Leg[]
  // A fetch: the second the mascot is aboard from.
  boards: number
  // A landing: the second it leaves the deck, and the second the boat is out
  // of view.
  lands: number
  gone: number
  // From here on the trip is over: the boat is on its circuit, or the mascot
  // is living its day.
  settled: number
  // A trip by the boardwalk: the mascot's course off the boat and back (`walk`),
  // from the second it hops off (`off`) to the second it is aboard again
  // (`back`); the seconds a coconut from the crate reaches its hand (`takes`),
  // while it drinks it there (`sips`), and when the shell leaves its hand for
  // the sea (`tosses`).
  errand?: ErrandPlan
}

export type ErrandPlan = { walk: Leg[]; off: number; back: number; tosses: number[]; takes: number[]; sips: [number, number][] }

// `settle` holds the boat where it is for that many seconds before it sets out
// (the mascot, on foot, goes its way meanwhile).
export function planOf(voyage: Voyage, settle = 0): Plan {
  const from = voyage.boat
  const coast = voyage.coast
  if (coast !== undefined && from !== null) {
    // Called back under way. Where the new course carries on much the same
    // way, the boat sets out on it at the speed it has; elsewhere it carries
    // on along its course as it slows to a stop, and sets out from there.
    const rest = planOf({ ...voyage, coast: undefined })
    const [first, ...others] = rest.boat
    const reach = gap(from, coast.to)
    if (first !== undefined && first.curve !== undefined && first.from === 0) {
      const ahead = first.at(1)
      const span = gap(from, ahead)
      const cos = span < 1 ? 0 : ((coast.to.x - from.x) * (ahead.x - from.x) + (coast.to.y - from.y) * (ahead.y - from.y)) / (reach * span)
      if (cos > 0.7) {
        const speed = (2 * reach) / coast.seconds
        const rise = Math.min(1, (speed * first.to) / (3 * span))
        return { ...rest, boat: [straight(0, first.to, from, ahead, [1 / 3, rise, first.curve[2], first.curve[3]], false), ...others] }
      }
    }
    const glide: Leg = { ...straight(0, coast.seconds, from, coast.to, COAST, false), heading: lyingOf(voyage) }
    const stopped: Voyage = { ...voyage, coast: undefined, boat: coast.to, ...(voyage.aboard ? { clawd: coast.to } : {}) }
    // The trip from where it stops, the boat setting out `sets` seconds in.
    const from_ = (sets: number): Plan => (voyage.aboard ? delayed(planOf(stopped), sets, [], []) : planOf(stopped, sets))
    // Setting out the other way, it comes most of the way about where it
    // stopped before it gets under way.
    const heading = from_(glide.to).boat[0]?.heading ?? glide.heading
    const turns = heading !== glide.heading
    const sets = glide.to + (turns ? TURN_S * 0.6 : 0)
    const after = from_(sets)
    return { ...after, boat: [glide, ...(turns ? [still(glide.to, sets, coast.to, heading)] : []), ...after.boat] }
  }
  const jump = voyage.hop
  if (jump !== undefined) {
    // Begun in the air between the jetty and the boat lying at the dock: it
    // comes down first, and goes on from where it comes down.
    const down = hop(0, jump.a, jump.b, jump.p)
    // Between the boardwalk and the boat lying off it: aboard, or on the walk,
    // it goes on from there as from any other.
    if (isPierDeck(jump.a) || isPierDeck(jump.b)) {
      const isOnBoard = isPierDeck(jump.b)
      const rest = planOf({ ...voyage, hop: undefined, coast: undefined, boat: PIER, clawd: isOnBoard ? PIER : jump.b, aboard: isOnBoard, facing: 1 })
      const plan = delayed(rest, down.to, [still(0, down.to, PIER, 1)], [])
      const errand = plan.errand
      // In the air on its way back aboard, or onto the walk: its course on
      // and about the walk starts with the rest of the hop.
      return isOnBoard
        ? { ...plan, errand: { walk: [down], off: 0, back: down.to, tosses: [], takes: [], sips: [] } }
        : { ...plan, errand: { walk: [down, ...(errand?.walk ?? [])], off: 0, back: errand?.back ?? down.to, tosses: [], takes: [], sips: [] } }
    }
    const isOnBoard = isDeck(jump.b)
    if (voyage.phase === 'land' && isOnBoard) {
      return ashoreFromDeck(voyage, down)
    }
    const rest = planOf({ ...voyage, hop: undefined, boat: DOCK, clawd: jump.b, aboard: isOnBoard })
    return delayed(rest, down.to, [moored(0, down.to, lyingOf(voyage))], [down])
  }
  if (voyage.wait) {
    return toWait(voyage, settle)
  }
  if (!voyage.aboard && isOnWalk(voyage.clawd)) {
    return offTheWalk(voyage)
  }
  if (voyage.errand !== undefined && voyage.aboard && from !== null) {
    return byTheWalk(voyage, from, voyage.errand)
  }
  if (voyage.phase === 'fetch') {
    if (voyage.aboard) {
      // Still on deck: the boat just makes for its circuit. Come from its
      // left, it comes about there to join it heading left.
      const start = from ?? DOCK
      const span = within(gap(start, JOIN) / 90, 2, 8)
      const goes = straight(0, span, start, JOIN, EASE, false)
      const about = goes.heading === 1 ? [still(span, span + TURN_S, JOIN, -1)] : []
      return { boat: [goes, ...about], clawd: [], boards: 0, lands: 0, gone: 0, settled: endOf(about, span) }
    }
    if (from !== null && gap(from, DOCK) < 1 && Math.abs(voyage.clawd.y - DOCK.y) < 2 && Math.abs(voyage.clawd.x - DOCK.x) <= DECK + 1) {
      // Called back while still walking the deck to go ashore: it turns and
      // walks back aft, and the boat sets out with it.
      const heading = (voyage.facing ?? 1) < 0 ? -1 : 1
      const seat = { x: DOCK.x - DECK * heading, y: DOCK.y }
      const boards = 0.2 + Math.max(0.4, gap(voyage.clawd, seat) / 40)
      const leaves = boards + 0.4
      const settled = leaves + within(gap(DOCK, JOIN) / 70, 3, 6)
      return {
        boat: [moored(0, leaves, heading), straight(leaves, settled, DOCK, JOIN, EASE, false)],
        clawd: [straight(0.2, boards, voyage.clawd, seat, EASE, true)],
        boards,
        lands: 0,
        gone: 0,
        settled,
      }
    }
    // The boat comes in, by the edge it last went out by when it was out of
    // view, and lies stern to the jetty while the mascot walks out to the
    // jetty's end and hops aboard.
    // In sight already, it sets out from a stop; with the dock just astern,
    // it backs onto it.
    const side = otherSide(voyage.exit ?? 'R')
    const isAstern = from !== null && (DOCK.x - from.x) * lyingOf(voyage) < 0 && gap(from, DOCK) < ASTERN_MAX
    const docks = from === null ? laneSeconds(DOCK, side) : settle + within(gap(from, DOCK) / (isAstern ? ASTERN_SPEED : 50), 2.5, 10)
    const comes = from === null ? arriving(docks, DOCK, side) : { ...straight(settle, docks, from, DOCK, EASE, false), ...(isAstern ? { heading: lyingOf(voyage) } : {}) }
    // Part way out of the hammock or off the lounger, it carries on getting
    // down at once, as the scene times its getting up from the trip's start.
    const clawd = footpath(voyage.clawd, BOARD, voyage.rise === undefined || voyage.rise.u === 0 ? 0.4 : 0, 60, voyage.rise)
    const ready = Math.max(docks + (comes.heading === -1 ? 0.1 : TURN_S + 0.1), endOf(clawd, 0) + 0.3)
    clawd.push(hop(ready, BOARD, STERN))
    const boards = ready + HOP_S
    const leaves = boards + 0.4
    const settled = leaves + within(gap(DOCK, JOIN) / 70, 3, 6)
    return {
      boat: [comes, moored(docks, leaves), straight(leaves, settled, DOCK, JOIN, EASE, false)],
      clawd,
      boards,
      lands: 0,
      gone: 0,
      settled,
    }
  }
  if (from !== null && gap(from, DOCK) < 1 && !voyage.aboard && isDeck(voyage.clawd)) {
    // On deck but not riding, the boat lying at the dock: off it.
    return ashoreFromDeck(voyage, undefined)
  }
  if (from === null || !voyage.aboard) {
    // Nobody to land: the mascot walks home, and a boat still out goes its way.
    const clawd = footpath(voyage.clawd, HOME, 0, 40, voyage.rise)
    const boat = from === null ? [] : [leaving(settle, from, voyage.exit ?? 'R')]
    return { boat, clawd, boards: 0, lands: 0, gone: endOf(boat, 0), settled: endOf(clawd, 0) }
  }
  // The boat makes for the dock and lies there heading as it came, the
  // mascot hops onto the jetty and walks home, and once it is off the jetty
  // the boat goes out. Bow to the jetty, the mascot first walks forward along
  // the deck to where it hops from.
  const docks = within(gap(from, DOCK) / 70, 0.8, 10)
  const heading = from.x <= DOCK.x ? 1 : -1
  const lands = docks + 0.3
  const forward = heading === 1 ? [straight(lands, lands + (2 * DECK) / 40, AFT, STERN, EASE, true)] : []
  const hops = endOf(forward, lands)
  const clawd = [...forward, hop(hops, STERN, BOARD), ...footpath(BOARD, HOME, hops + HOP_S + 0.3, 45)]
  const ashore = clawd.find(leg => leg.at(1).x >= ROOT.x - 1)?.to ?? endOf(clawd, lands)
  const leaves = ashore + 0.2
  return {
    boat: [straight(0, docks, from, DOCK, EASE, false), moored(docks, leaves, heading), leaving(leaves, DOCK, voyage.exit ?? 'R')],
    clawd,
    boards: 0,
    lands,
    gone: leaves + laneSeconds(DOCK, voyage.exit ?? 'R'),
    settled: endOf(clawd, lands),
  }
}

// `rest` begun `by` seconds into a trip, after the boat's `boat` and the
// mascot's `clawd`.
function delayed(rest: Plan, by: number, boat: Leg[], clawd: Leg[]): Plan {
  const later = (leg: Leg): Leg => ({ ...leg, from: leg.from + by, to: leg.to + by })
  const shift = (times: readonly number[]): number[] => times.map(at => at + by)
  const errand = rest.errand
  return {
    boat: [...boat, ...rest.boat.map(later)],
    clawd: [...clawd, ...rest.clawd.map(later)],
    boards: rest.boards + by,
    lands: rest.lands + by,
    gone: rest.gone + by,
    settled: rest.settled + by,
    ...(errand === undefined
      ? {}
      : { errand: { walk: errand.walk.map(later), off: errand.off + by, back: errand.back + by, tosses: shift(errand.tosses), takes: shift(errand.takes), sips: errand.sips.map(([a, b]) => [a + by, b + by]) } }),
  }
}

// The boat with the mascot aboard by the end of the boardwalk on its way: it
// lies there stern to the walk, the mascot hops up, walks to the crate,
// takes each coconut owed it, drinks it there and tosses the shell into the
// sea, walks back empty-handed and hops aboard, and the trip goes on from
// there.
function byTheWalk(voyage: Voyage, from: Point, errand: Errand): Plan {
  // Lying there already, back for more, it goes straight back up.
  const isThere = gap(from, PIER) < 1
  const sails = isThere ? 0.4 : within(gap(from, PIER) / 50, 3, 14)
  const comes = isThere ? still(0, sails, PIER, 1) : straight(0, sails, from, PIER, EASE, false)
  const off = sails + (comes.heading === 1 ? 0.2 : TURN_S + 0.2)
  const walk: Leg[] = []
  const tosses: number[] = []
  const takes: number[] = []
  const sips: [number, number][] = []
  let t = off
  let at = PIER_STERN
  const move = (next: Point, seconds: number, stride: boolean): void => {
    walk.push(straight(t, t + seconds, at, next, EASE, stride))
    at = next
    t += seconds
  }
  walk.push(hop(t, PIER_STERN, PIER_BOARD))
  at = PIER_BOARD
  t += HOP_S
  move(PIER_BOARD, 0.3, false)
  move(AT_CRATE, gap(PIER_BOARD, AT_CRATE) / PIER_SPEED, true)
  move(AT_CRATE, 0.3, false)
  for (let k = 0; k < errand.take; k++) {
    takes.push(t + 0.5)
    move(AT_CRATE, 0.9, false)
    sips.push([t, t + SIP_S])
    move(AT_CRATE, SIP_S, false)
    tosses.push(t + 0.2)
    move(AT_CRATE, 0.9, false)
  }
  move(PIER_BOARD, gap(AT_CRATE, PIER_BOARD) / PIER_SPEED, true)
  move(PIER_BOARD, 0.3, false)
  walk.push(hop(t, PIER_BOARD, PIER_STERN))
  const back = t + HOP_S
  const sets = back + 0.4
  const rest = planOf({ ...voyage, errand: undefined, coast: undefined, hop: undefined, boat: PIER, clawd: PIER, aboard: true, facing: 1 })
  const plan = delayed(rest, sets, [comes, still(sails, sets, PIER, 1)], [])
  return { ...plan, errand: { walk, off, back, tosses, takes, sips } }
}

// Sent to wait for the seaplane: aboard, the boat makes for the end of the
// boardwalk and lies there stern to it, and the mascot hops up and walks to
// the walk's end; already on the walk, it just walks there; ashore, the boat
// picks it up at the jetty first. From `settled` on it stands there, for as
// long as the trip lasts: it is not aboard again (`back` never comes).
function toWait(voyage: Voyage, settle: number): Plan {
  const from = voyage.boat
  if (!voyage.aboard && isOnWalk(voyage.clawd)) {
    const walk = footOnWalk(voyage.clawd, WAIT, 0.2)
    const waits = endOf(walk, 0)
    return { boat: [still(0, waits, PIER, 1)], clawd: [], boards: 0, lands: 0, gone: 0, settled: waits, errand: { walk, off: 0, back: Infinity, tosses: [], takes: [], sips: [] } }
  }
  if (voyage.aboard && from !== null) {
    const isThere = gap(from, PIER) < 1
    const sails = isThere ? 0.4 : within(gap(from, PIER) / 50, 3, 14)
    const comes = isThere ? still(0, sails, PIER, 1) : straight(0, sails, from, PIER, EASE, false)
    const off = sails + (comes.heading === 1 ? 0.2 : TURN_S + 0.2)
    const walk = [hop(off, PIER_STERN, PIER_BOARD), still(off + HOP_S, off + HOP_S + 0.3, PIER_BOARD, 1)]
    walk.push(...footOnWalk(PIER_BOARD, WAIT, endOf(walk, 0)))
    const waits = endOf(walk, 0)
    return { boat: [comes, still(sails, waits, PIER, 1)], clawd: [], boards: 0, lands: 0, gone: 0, settled: waits, errand: { walk, off, back: Infinity, tosses: [], takes: [], sips: [] } }
  }
  // Ashore: fetched off the island as for work, and the boat sets out from
  // the dock for the walk instead of its circuit.
  const pickup = planOf({ ...voyage, phase: 'fetch', wait: undefined }, settle)
  const sets = pickup.boards + 0.4
  const lying = pickup.boat.filter(leg => leg.to <= sets + 1e-6)
  const rest = toWait({ ...voyage, boat: DOCK, clawd: DOCK, aboard: true, facing: lying[lying.length - 1]?.heading ?? -1, hop: undefined, coast: undefined }, 0)
  return { ...delayed(rest, sets, lying, pickup.clawd), boards: pickup.boards }
}

// Called away while on the boardwalk: the mascot walks back to the boat lying
// off its end and hops aboard, and the trip goes on from there.
function offTheWalk(voyage: Voyage): Plan {
  const walk = footOnWalk(voyage.clawd, PIER_BOARD, 0.2)
  const hops = endOf(walk, 0.2) + 0.2
  walk.push(hop(hops, PIER_BOARD, PIER_STERN))
  const back = hops + HOP_S
  const sets = back + 0.4
  const rest = planOf({ ...voyage, errand: undefined, coast: undefined, hop: undefined, boat: PIER, clawd: PIER, aboard: true, facing: 1 })
  const plan = delayed(rest, sets, [still(0, sets, PIER, 1)], [])
  // Out to work, it is aboard as it lands on deck.
  return { ...plan, boards: voyage.phase === 'fetch' ? back : plan.boards, errand: { walk, off: 0, back, tosses: [], takes: [], sips: [] } }
}

function footOnWalk(from: Point, to: Point, start: number): Leg[] {
  return gap(from, to) > 1 ? [straight(start, start + Math.max(0.4, gap(from, to) / PIER_SPEED), from, to, EASE, true)] : []
}

// How the boat under way at `t` along `legs` would carry on, slowing to a
// stop: on along its stretch, and no further than where that ends. None
// while it lies still.
function coastAt(legs: readonly Leg[], t: number): Coast | undefined {
  const leg = legs.find(one => t >= one.from && t < one.to)
  if (leg === undefined) {
    return undefined
  }
  const span = leg.to - leg.from
  const p = (t - leg.from) / span
  const dp = Math.min(0.005, 1 - p)
  const a = leg.at(p)
  const speed = gap(a, leg.at(p + dp)) / (dp * span)
  const want = speed ** 2 / (2 * COAST_DECEL)
  let q = p
  let to = a
  let reach = 0
  while (q < 1 && reach < want) {
    q = Math.min(1, q + 0.01)
    const next = leg.at(q)
    reach += gap(to, next)
    to = next
  }
  if (speed < 6 || reach < 2) {
    return undefined
  }
  return { to, seconds: (2 * reach) / speed }
}

// Which way the boat lies, as it was facing when the trip began.
function lyingOf(voyage: Voyage): 1 | -1 {
  return (voyage.facing ?? -1) < 0 ? -1 : 1
}

// Brought home while on the deck of the boat lying at the dock (or coming
// down onto it, `down`): it goes along the deck to the jetty end, hops onto
// the jetty and walks home, and once it is off the jetty the boat goes out.
function ashoreFromDeck(voyage: Voyage, down: Leg | undefined): Plan {
  // Come down on deck, it finds its feet there a moment before it hops off.
  const start = down === undefined ? voyage.clawd : STERN
  const steadied = down === undefined ? [] : [down, straight(down.to, down.to + 0.3, STERN, STERN, EASE, false)]
  const lands = endOf(steadied, 0)
  const aft = gap(start, STERN) > 1 ? [straight(lands, lands + gap(start, STERN) / 40, start, STERN, EASE, true)] : []
  const hops = endOf(aft, lands)
  const clawd = [...steadied, ...aft, hop(hops, STERN, BOARD), ...footpath(BOARD, HOME, hops + HOP_S + 0.3, 45)]
  const ashore = clawd.find(leg => leg.at(1).x >= ROOT.x - 1)?.to ?? endOf(clawd, lands)
  const leaves = ashore + 0.2
  const exit = voyage.exit ?? 'R'
  return {
    boat: [moored(0, leaves, lyingOf(voyage)), leaving(leaves, DOCK, exit)],
    clawd,
    boards: 0,
    lands: 0,
    gone: leaves + laneSeconds(DOCK, exit),
    settled: endOf(clawd, 0),
  }
}

export function along(legs: readonly Leg[], t: number): Point {
  const last = legs[legs.length - 1]
  if (last === undefined) {
    return HOME
  }
  const leg = legs.find(one => t < one.to) ?? last
  return leg.at(within((t - leg.from) / Math.max(0.001, leg.to - leg.from), 0, 1))
}

// How the boat faces along `legs`, as [seconds, scaleX] to pass through in
// turn, evenly between: it comes about wherever its heading changes, from
// however it faced as the trip began (`start`, part way round when it was
// coming about then).
export function turns(legs: readonly Leg[], start: number | undefined): [number, number][] {
  let facing = start ?? legs[0]?.heading ?? 1
  const out: [number, number][] = [[0, facing]]
  for (const leg of legs) {
    if (leg.heading !== facing) {
      const from = Math.max(leg.from, out[out.length - 1]?.[0] ?? 0)
      out.push([from, facing], [from + (TURN_S * Math.abs(leg.heading - facing)) / 2, leg.heading])
      facing = leg.heading
    }
  }
  return out
}

function between(points: readonly (readonly [number, number])[], at: number): number {
  let last = points[0]
  for (const point of points) {
    if (at <= point[0]) {
      return last === undefined || point[0] === last[0] ? point[1] : last[1] + ((point[1] - last[1]) * (at - last[0])) / (point[0] - last[0])
    }
    last = point
  }
  return last?.[1] ?? 1
}

export function facingAt(points: readonly [number, number][], t: number): number {
  return between(points, t)
}

// Where the lead boat is on its circuit, and how it faces, `seconds` after a
// fetch settled.
export function circuitAt(seconds: number): Point {
  return lapAt(LEAD, seconds + CIRCUIT_START - LAP_S / 2)
}

function circuitFacing(seconds: number): number {
  return between(LAP_FACING, ((((seconds + CIRCUIT_START) / LAP_S) % 1) + 1) % 1)
}

const JOIN: Point = circuitAt(0)

// Where the two are at clock time `now` (ms), for the next trip to start from.
export function stageAt(voyage: Voyage, now: number): Stage {
  const t = (now - voyage.at) / 1000
  const plan = planOf(voyage)
  const course = (): number => facingAt(turns(plan.boat, voyage.facing), t)
  // Off the boat on the boardwalk, or hopping between the two.
  const errand = plan.errand
  // Off the boat once its hop up has begun (from the start, for a trip begun
  // off it), and until it is aboard again.
  const isOnWalk = errand !== undefined && (t > errand.off || (errand.off <= 0 && t >= errand.off)) && t < errand.back
  const walking = (boat: Point | null, facing: number | undefined): Stage => ({ boat, aboard: false, clawd: along(errand?.walk ?? [], t), facing, hop: hopAt(errand?.walk ?? [], t), coast: undefined, rise: undefined })
  if (voyage.phase === 'fetch' || voyage.wait === true) {
    const isOnCircuit = voyage.wait !== true && t >= plan.settled
    const boat = isOnCircuit ? circuitAt(t - plan.settled) : along(plan.boat, t)
    if (isOnWalk) {
      return walking(boat, course())
    }
    const aboard = voyage.aboard || t >= plan.boards || (errand !== undefined && t >= errand.back)
    return { boat, aboard, clawd: aboard ? boat : along(plan.clawd, t), facing: isOnCircuit ? circuitFacing(t - plan.settled) : course(), hop: aboard ? undefined : hopAt(plan.clawd, t), coast: isOnCircuit ? circuitCoast(t - plan.settled) : coastAt(plan.boat, t), rise: aboard ? undefined : riseAt(voyage, plan, t) }
  }
  const boat = plan.boat.length > 0 && t < plan.gone ? along(plan.boat, t) : null
  if (isOnWalk) {
    return walking(boat, course())
  }
  const aboard = (voyage.aboard || (errand !== undefined && t >= errand.back)) && boat !== null && t < plan.lands
  const clawd = t >= plan.settled ? lifeAt(dayOf(voyage.at, voyage.drill), t - plan.settled) : along(plan.clawd, t)
  return { boat, aboard, clawd, facing: boat === null ? undefined : course(), hop: aboard || t >= plan.settled ? undefined : hopAt(plan.clawd, t), coast: boat === null ? undefined : coastAt(plan.boat, t), rise: aboard ? undefined : riseAt(voyage, plan, t) }
}

type Stage = { boat: Point | null; clawd: Point; aboard: boolean; facing: number | undefined; hop: Hop | undefined; coast: Coast | undefined; rise: Rise | undefined }

// How far the mascot ashore `t` seconds into `voyage` is out of the hammock or
// off the lounger: by its day once it lives it; and while it still gets down
// at the trip's start, by how much of that first stretch's time has passed,
// as the scene times its getting up.
function riseAt(voyage: Voyage, plan: Plan, t: number): Rise | undefined {
  if (voyage.phase === 'land' && t >= plan.settled) {
    return riseIn(dayOf(voyage.at, voyage.drill), t - plan.settled)
  }
  const rise = voyage.rise
  const leg = plan.clawd[0]
  if (rise === undefined || voyage.aboard || leg === undefined || t >= leg.to) {
    return undefined
  }
  const p = Math.min(1, Math.max(0, (t - leg.from) / Math.max(0.001, leg.to - leg.from)))
  return { bed: rise.bed, u: rise.u + (1 - rise.u) * p }
}

// How the boat out on its circuit `seconds` in would carry on, slowing to a
// stop: along the circuit's next few seconds.
function circuitCoast(seconds: number): Coast | undefined {
  const AHEAD_S = 6
  const leg: Leg = { from: 0, to: AHEAD_S, at: p => circuitAt(seconds + p * AHEAD_S), heading: 1, stride: false, curve: undefined }
  return coastAt([leg], 0)
}

// The trip that starts at `now` from wherever the last one had got to. Only a
// trip the other way lets the boat carry on before it comes about.
export function embark(last: Voyage, phase: Voyage['phase'], now: number, greet: boolean): Voyage {
  const exit = last.exit ?? 'R'
  const stage = stageAt(last, now)
  return { phase, at: now, greet, ...stage, coast: phase === last.phase ? undefined : stage.coast, exit: phase === 'fetch' ? otherSide(exit) : exit }
}

// The seaplane that brings coconuts while the context is compacted. Called
// at `at` (clock ms), it flies in over the island, lands and taxis to lie
// behind the end of the boardwalk. `done` is when the compaction finished;
// `swap` when it hands over its cargo, once it is moored and the mascot waits
// by the crate: `cargo` coconuts thrown down from its door one at a time,
// each set in the crate by the mascot. Then it turns, taxis out and takes
// off.
export type Plane = { at: number; done?: number; swap?: number; cargo?: number }
// Where it lies, at the waterline under its middle, facing left.
export const MOOR: Point = { x: 560, y: 521 }
// How long it takes to come in and moor, and the moments of handing over its
// cargo: its door open, the first coconut thrown, one more every `each`
// seconds, each taking `toss` to reach the mascot's hand, held there `held`
// and set in the crate over `place`; and the door shut over `shut` once the
// last is thrown.
export const PLANE_IN_S = 20
export const SWAP = { opened: 0.4, first: 0.8, each: 1.8, toss: 0.8, held: 0.35, place: 0.45, shut: 0.5 }
// How long handing over `cargo` coconuts takes, the door shut after.
export function swapSeconds(cargo: number): number {
  return SWAP.first + cargo * SWAP.each + SWAP.shut + 0.3
}
// Done, it swaps its cargo then even without the mascot, should the mascot
// not be waiting by then.
const UNLOAD_ANYWAY_MS = 60_000
// The plane's course, in seconds since it was called: in from the right
// edge on a long shallow descent, levelling off as it nears the water, onto
// it flat and slowing to its mooring; once it has handed over its cargo,
// about, off across the lagoon gathering speed, and up at an angle out by
// the right edge. `gone` is when it is out of view (Infinity while it is
// still to leave); `touch` and `lift` when its float meets and leaves the
// water; `pitch`, how far its nose is raised (degrees) at moments along the
// way, level between.
export type Flight = { legs: Leg[]; gone: number; touch: number; lift: number; pitch: [number, number][] }
const APPROACH_S = 8.5
const TOUCH_S = APPROACH_S + 2.6
const TAKE_OFF_S = 7
const CLIMB_S = 6
export function flightOf(plane: Plane): Flight {
  const even: Curve = [0, 0, 1, 1]
  // Its last few seconds in the air drawn as short straight stretches, each
  // a little flatter, so it levels off just above the water.
  const path: [number, Point][] = [[0, { x: 1760, y: 400 }], [APPROACH_S, { x: 1060, y: 505 }], [APPROACH_S + 0.9, { x: 985, y: 514 }], [APPROACH_S + 1.8, { x: 915, y: 519.5 }], [TOUCH_S, { x: 858, y: MOOR.y }]]
  const legs: Leg[] = path.slice(1).map(([to, at], i) => {
    const [from, last] = path[i] ?? [0, at]
    return straight(from, to, last, at, even, false)
  })
  legs.push(straight(TOUCH_S, PLANE_IN_S, { x: 858, y: MOOR.y }, MOOR, ARRIVE, false))
  // Nose raised a little as it levels off, and level again once down.
  const pitch: [number, number][] = [[APPROACH_S, 0], [APPROACH_S + 0.8, 3], [TOUCH_S, 3], [TOUCH_S + 0.5, 0]]
  if (plane.swap === undefined) {
    return { legs, gone: Infinity, touch: TOUCH_S, lift: Infinity, pitch }
  }
  const leaves = Math.max(PLANE_IN_S, (plane.swap - plane.at) / 1000 + swapSeconds(plane.cargo ?? 0))
  const runs = leaves + TURN_S
  const lift = runs + TAKE_OFF_S
  const lifts: Point = { x: 1000, y: MOOR.y }
  legs.push(
    still(PLANE_IN_S, leaves, MOOR, -1),
    still(leaves, runs, MOOR, 1),
    // Gathering speed across the water, its nose coming up near the end, and
    // off it climbing at an angle.
    straight(runs, lift, MOOR, lifts, DEPART, false),
    straight(lift, lift + CLIMB_S, lifts, { x: 1760, y: MOOR.y - Math.round(760 * Math.tan(CLIMB_DEG * Math.PI / 180)) }, even, false),
  )
  pitch.push([lift - 1.2, 0], [lift, 7], [lift + 0.6, CLIMB_DEG])
  return { legs, gone: lift + CLIMB_S, touch: TOUCH_S, lift, pitch }
}
const CLIMB_DEG = 10

// The plane called at `now` as a compaction starts: one still waiting off the
// walk stays for this one too.
export function planeCalled(plane: Plane | undefined, now: number): Plane {
  return plane !== undefined && plane.swap === undefined ? { at: plane.at } : { at: now }
}

// Whether the mascot is to wait for the plane at `now`: it is coming, waiting,
// or swapping its cargo.
export function isAwaited(plane: Plane | undefined, now: number): boolean {
  return plane !== undefined && (plane.swap === undefined || now < plane.swap + swapSeconds(plane.cargo ?? 0) * 1000)
}

// When the plane is out of view again (clock ms), Infinity while it is to stay.
export function planeGone(plane: Plane): number {
  return plane.at + flightOf(plane).gone * 1000
}

// Once the compaction is done, when the plane hands over its cargo: as soon
// as it is moored and the mascot waits by the crate. It brings as many
// coconuts as fill the crate to `level`.
// What the mascot does by the crate while it waits for the seaplane, on the
// wall clock (seconds, as the scene keeps it): over each run of WAITER_S it
// looks through its spyglass and hums a tune for the spans WAITER_BUSY gives,
// and stands at ease between. WAITER_S divides the scene's wrap of its clock.
export const WAITER_S = 25
export const WAITER_BUSY: { spyglass: readonly [number, number]; tune: readonly [number, number] } = { spyglass: [2, 10], tune: [13, 21] }

// The first moment at or after `ms` (clock ms) when the mascot waiting by the
// crate is at ease, so that it takes up or leaves off passing the time there
// without dropping a spyglass or a tune half way.
export function waiterAtEase(ms: number): number {
  const into = (ms / 1000) % WAITER_S
  const busy = [WAITER_BUSY.spyglass, WAITER_BUSY.tune].find(([from, to]) => into > from && into < to)
  return busy === undefined ? ms : ms + Math.ceil((busy[1] - into) * 1000)
}

function unloaded(plane: Plane | undefined, voyage: Voyage, pantry: Pantry, level: number, now: number): { plane: Plane | undefined; pantry: Pantry; retry?: number } {
  if (plane === undefined || plane.done === undefined) {
    return { plane, pantry }
  }
  if (plane.swap !== undefined) {
    const over = plane.swap + swapSeconds(plane.cargo ?? 0) * 1000
    return { plane, pantry, ...(now < over ? { retry: over } : {}) }
  }
  const anyway = plane.done + UNLOAD_ANYWAY_MS
  const ready = voyage.wait === true ? voyage.at + Math.ceil(planOf(voyage).settled * 1000) : now >= anyway ? now : undefined
  if (ready === undefined) {
    return { plane, pantry, retry: anyway }
  }
  // Once it has stood waiting a while, the plane starts on its cargo when the
  // mascot is at ease.
  const due = Math.max(now, plane.done, plane.at + PLANE_IN_S * 1000, ready)
  const swap = voyage.wait === true && due > ready ? waiterAtEase(due) : due
  const stock = Math.max(pantry.stock, Math.min(COCONUTS, level))
  const cargo = stock - pantry.stock
  return {
    plane: { ...plane, swap, cargo },
    pantry: { stock, filled: { at: swap, stock: pantry.stock } },
    retry: swap + swapSeconds(cargo) * 1000,
  }
}

// Coconuts come only by the seaplane: with more room than the crate holds
// and no plane on its way, one is called, its cargo ready, as soon as the
// last one has flown out of view.
function resupplied(plane: Plane | undefined, pantry: Pantry, level: number, now: number): { plane: Plane | undefined; retry?: number } {
  if (level <= pantry.stock || isAwaited(plane, now)) {
    return { plane }
  }
  const gone = plane === undefined ? 0 : planeGone(plane)
  return now < gone ? { plane, retry: gone } : { plane: { at: now, done: now } }
}

// Everything a change at `now` sets going: the trip for `phase`, the
// coconuts, and the seaplane and its cargo swap. While the plane is awaited
// the mascot fetches no coconuts: it waits for the plane. `retry` is when to
// look again (clock ms).
export function steerAll(last: Voyage, pantry: Pantry, plane: Plane | undefined, phase: Voyage['phase'], greet: boolean, level: number, now: number): { voyage: Voyage; pantry: Pantry; plane: Plane | undefined; retry?: number } {
  const called = resupplied(plane, pantry, level, now)
  const next = steer(last, pantry, phase, greet, level, now, isAwaited(called.plane, now))
  const swap = unloaded(called.plane, next.voyage, next.pantry, level, now)
  const retry = Math.min(called.retry ?? Infinity, next.retry ?? Infinity, swap.retry ?? Infinity)
  return { voyage: next.voyage, pantry: swap.pantry, plane: swap.plane, ...(retry === Infinity ? {} : { retry }) }
}

// The coconuts on the boardwalk, which stand for the room left in the agent's
// context: a full crate is COCONUTS, and each fifth of the room used up is one
// the mascot fetches and drinks by the crate. `stock` is how many are in the
// crate.
export const COCONUTS = 5
export type Stock = { stock: number }
// How long the mascot drinks each coconut by the crate.
const SIP_S = 2.6
// The pantry as it will stand once the trip under way is done by the
// boardwalk. A crate the seaplane has brought more for keeps when, and how
// many it held before, in `filled`, for the handing over to be drawn by.
export type Pantry = Stock & { filled?: { at: number; stock: number } }
export const STOCKED: Pantry = { stock: COCONUTS }
// The most coconuts the mascot drinks on one trip by the boardwalk.
const MOST_TAKEN = 3

// How many coconuts stand for `tokens` used of a context compacted at
// `limit`: one for each fifth of the room left, or part of one.
export function levelOf(tokens: number, limit: number): number {
  const room = 1 - tokens / Math.max(1, limit)
  return Math.max(0, Math.min(COCONUTS, Math.ceil(room * COCONUTS - 1e-6)))
}

// The coconuts at `now`, `voyage` under way: on its trip by the boardwalk,
// as they stood when it set out less what the mascot has taken from the
// crate by then; otherwise `pantry` itself.
export function pantryAt(pantry: Pantry, voyage: Voyage, now: number): Pantry {
  const errand = voyage.errand
  const run = planOf(voyage).errand
  const t = (now - voyage.at) / 1000
  if (errand === undefined || run === undefined || t >= run.back) {
    return pantry
  }
  const taken = run.takes.filter(at => at <= t).length
  return { stock: errand.from.stock - taken }
}

// When the mascot, by the boardwalk at `now` on its way to the crate and
// back, is aboard again (clock ms). `isOff` asks only while it is off the
// boat, on the walk or hopping. It is a little past the landing itself: a
// drawing places its moments only to within a few ms, and one drawn the
// moment it lands would still show the last of its hop.
export function errandUntil(voyage: Voyage, now: number, isOff = false): number | undefined {
  const errand = planOf(voyage).errand
  const t = (now - voyage.at) / 1000
  return errand !== undefined && t < errand.back && (!isOff || t >= errand.off) ? voyage.at + Math.ceil(errand.back * 1000) + LANDED_MS : undefined
}

// How long after a landing the mascot counts as aboard again, in ms.
const LANDED_MS = 100

// The trip for `phase` at `now` (the one under way while it already is), sent
// by the boardwalk on its way when the crate holds more coconuts than `level`
// and the mascot rides the boat; and the pantry for it. `retry` is when to
// look again (clock ms): the mascot is off the boat on the walk, which it
// finishes first, or is owed coconuts and not yet aboard.
export function steer(last: Voyage, pantry: Pantry, phase: Voyage['phase'], greet: boolean, level: number, now: number, wait = false): { voyage: Voyage; pantry: Pantry; retry?: number } {
  // Waiting for the plane, it stays put whatever the agent does.
  if (wait && last.wait === true) {
    return { voyage: last, pantry }
  }
  const back = last.wait === true ? undefined : errandUntil(last, now, true)
  if (back !== undefined) {
    return { voyage: last, pantry, retry: back }
  }
  // A trip called away on its way to the walk leaves the crate as it was.
  const kept = pantryAt(pantry, last, now)
  if (wait) {
    const stage = stageAt(last, now)
    return { voyage: { ...embark(last, phase, now, greet), exit: last.exit ?? 'R', coast: stage.coast, wait: true }, pantry: kept }
  }
  const trip = last.phase === phase && last.wait !== true ? last : embark(last, phase, now, greet)
  const standing = trip === last ? pantry : kept
  const owed = kept.stock - level
  const plan = planOf(trip)
  const t = (now - trip.at) / 1000
  const out = errandUntil(trip, now)
  if (owed <= 0 || out !== undefined) {
    return { voyage: trip, pantry: standing, ...(owed > 0 && out !== undefined ? { retry: out } : {}) }
  }
  const stage = stageAt(trip, now)
  if (!stage.aboard || stage.boat === null || stage.hop !== undefined) {
    // Not yet aboard on its way out: it goes for coconuts once it is.
    const boards = phase === 'fetch' && !trip.aboard && t < plan.boards ? trip.at + Math.ceil(plan.boards * 1000) + 100 : undefined
    return { voyage: trip, pantry: standing, ...(boards === undefined ? {} : { retry: boards }) }
  }
  // At most MOST_TAKEN at a time; more owed, it goes back up for them once it
  // is aboard again.
  const take = Math.min(owed, kept.stock, MOST_TAKEN)
  const errand: Errand = { take, from: { stock: kept.stock } }
  const after: Pantry = { stock: kept.stock - take }
  return { voyage: { ...trip, at: now, boat: stage.boat, clawd: stage.boat, aboard: true, facing: stage.facing, hop: undefined, coast: stage.coast, rise: undefined, errand }, pantry: after }
}
