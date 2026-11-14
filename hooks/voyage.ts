// The island the mascot lives on, the lead boat that carries it, and the trips
// between the two: the boat fetches the mascot off the jetty when the agent
// has work and lands it there again when the work is over. Every place here is
// a function of the time since the trip began, so a redraw finds both where
// they were.

import { ROUTES, eased, lapAt } from './fleet'
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
const BOARD: Point = { x: JETTY.tip + 6, y: JETTY.y }
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

// The edges the lead boat comes in and goes out by, and the lanes it keeps to
// on its way to each.
const GATE_X: Record<Side, number> = { L: -110, R: 1710 }
const LANE_Y: Record<Side, number> = { L: 770, R: 830 }
// How long the boat takes to come about, and the mascot to hop on or off.
export const TURN_S = 1.1
const HOP_S = 0.8

const EASE: Curve = [0.42, 0, 0.58, 1]
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
export const CIRCUIT_START = LAP_S * 0.54
// How a circuit boat faces through its lap, as [share of the lap, scaleX]: it
// comes about at either end. The scene's `of` keyframes say the same.
const LAP_FACING: readonly [number, number][] = [[0, 0], [0.04, 1], [0.46, 1], [0.5, 0], [0.54, -1], [0.96, -1], [1, 0]]

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

// What the mascot lies in at `at`, if anything: on its side in the hammock or
// back on the lounger.
export function lyingIn(at: Point): 'hammock' | 'lounger' | undefined {
  if (gap(at, HAMMOCK) < 3) {
    return 'hammock'
  }
  return gap(at, ON_LOUNGER) < 3 ? 'lounger' : undefined
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

// Where the mascot is `seconds` into `day`.
export function lifeAt(day: Day, seconds: number): Point {
  const s = ((seconds % day.span) + day.span) % day.span
  let from: Point = HOME
  let since = 0
  for (const step of day.steps) {
    if (s < step.until) {
      const e = eased(EASE, (s - since) / Math.max(0.001, step.until - since))
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
}

export const AT_HOME: Voyage = { phase: 'land', at: 0, boat: null, clawd: HOME, aboard: false, greet: false }

// One stretch of a trip, in seconds since it began. A straight stretch is
// paced by `curve`; one with no curve bends, at an even pace, unless `glide`
// paces its sideways travel, which then runs from end to end on that curve.
// `stride` marks the stretches the mascot covers on its legs.
export type Leg = { from: number; to: number; at: (p: number) => Point; heading: 1 | -1; stride: boolean; curve: Curve | undefined; glide?: Curve }

function straight(from: number, to: number, a: Point, b: Point, curve: Curve, stride: boolean): Leg {
  const at = (p: number): Point => {
    const e = eased(curve, p)
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
  }
  return { from, to, at, heading: b.x >= a.x ? 1 : -1, stride, curve }
}

// The boat lying at the dock, by default stern to the jetty.
function moored(from: number, to: number, heading: 1 | -1 = -1): Leg {
  return { from, to, at: () => DOCK, heading, stride: false, curve: EASE }
}

// A hop from `a` to `b`, rising between them.
function hop(from: number, a: Point, b: Point): Leg {
  const at = (p: number): Point => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p - 150 * p * (1 - p) })
  return { from, to: from + HOP_S, at, heading: 1, stride: false, curve: undefined }
}

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
function footpath(from: Point, to: Point, start: number, speed: number): Leg[] {
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
  if (at.y < 700) {
    move({ x: at.x, y: GROUND_Y }, 0.6, false)
  } else if (gap(at, ON_LOUNGER) < 3) {
    move(BY_LOUNGER, 0.6, false)
  } else if (at.x < ROOT.x - 2 && Math.abs(at.y - JETTY.y) > 3) {
    // Caught between the jetty and the boat: back onto the jetty.
    move({ x: Math.max(at.x, BOARD.x), y: JETTY.y }, 0.3, false)
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
}

export function planOf(voyage: Voyage): Plan {
  const from = voyage.boat
  if (voyage.phase === 'fetch') {
    if (voyage.aboard) {
      // Still on deck: the boat just makes for its circuit.
      const start = from ?? DOCK
      const span = within(gap(start, JOIN) / 90, 2, 8)
      return { boat: [straight(0, span, start, JOIN, EASE, false)], clawd: [], boards: 0, lands: 0, gone: 0, settled: span }
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
    const side = otherSide(voyage.exit ?? 'R')
    const docks = from === null ? laneSeconds(DOCK, side) : within(gap(from, DOCK) / 70, 1.5, 10)
    const comes = from === null ? arriving(docks, DOCK, side) : straight(0, docks, from, DOCK, ARRIVE, false)
    const clawd = footpath(voyage.clawd, BOARD, 0.4, 60)
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
  if (from === null || !voyage.aboard) {
    // Nobody to land: the mascot walks home, and a boat still out goes its way.
    const clawd = footpath(voyage.clawd, HOME, 0, 40)
    const boat = from === null ? [] : [leaving(0, from, voyage.exit ?? 'R')]
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
export function stageAt(voyage: Voyage, now: number): { boat: Point | null; clawd: Point; aboard: boolean; facing: number | undefined } {
  const t = (now - voyage.at) / 1000
  const plan = planOf(voyage)
  const course = (): number => facingAt(turns(plan.boat, voyage.facing), t)
  if (voyage.phase === 'fetch') {
    const isOnCircuit = t >= plan.settled
    const boat = isOnCircuit ? circuitAt(t - plan.settled) : along(plan.boat, t)
    const aboard = voyage.aboard || t >= plan.boards
    return { boat, aboard, clawd: aboard ? boat : along(plan.clawd, t), facing: isOnCircuit ? circuitFacing(t - plan.settled) : course() }
  }
  const boat = plan.boat.length > 0 && t < plan.gone ? along(plan.boat, t) : null
  const aboard = voyage.aboard && boat !== null && t < plan.lands
  const clawd = t >= plan.settled ? lifeAt(dayOf(voyage.at, voyage.drill), t - plan.settled) : along(plan.clawd, t)
  return { boat, aboard, clawd, facing: boat === null ? undefined : course() }
}

// The trip that starts at `now` from wherever the last one had got to.
export function embark(last: Voyage, phase: Voyage['phase'], now: number, greet: boolean): Voyage {
  const exit = last.exit ?? 'R'
  return { phase, at: now, greet, ...stageAt(last, now), exit: phase === 'fetch' ? otherSide(exit) : exit }
}
