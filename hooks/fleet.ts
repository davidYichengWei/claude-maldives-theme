// The boats on the lagoon: which are out, where each one sails, and how it
// comes in by one edge of the view and goes out by the other.

export type BoatKind = 'lead' | 'crew' | 'shell'
export type Side = 'L' | 'R'

// How a boat rounds the sand island on the right of the view: behind it, on
// the far water, or in front of it, on the near.
export type Pass = 'over' | 'under'

export type Boat = {
  kind: BoatKind
  // Which of its kind's circuits it sails.
  slot: number
  // The edge it comes in by. It goes out by the other.
  from: Side
  // The way round the island it would rather take.
  pass: Pass
  // Clock times in ms: when it set out, and when it was called home.
  born: number
  gone: number | undefined
}

// The water a boat keeps to while its work runs. The lead boat circles a
// flat ellipse. A dinghy or a fishing boat roams a wide stretch: it sweeps
// from side to side across it, coming about at each end, and drifts between
// the far and the near side of it on a longer, unrelated beat, so its course
// does not visibly repeat. A boat whose water reaches out to sea comes in
// from the horizon and goes back out to it; the rest come and go by the
// edges of the view.
export type Route = {
  cx: number
  cy: number
  rx: number
  ry: number
  // One sweep there and back.
  seconds: number
  // One drift out and back; none for an ellipse.
  drift: number | undefined
  // Where in its drift a boat starts, as a share of it.
  driftFrom: number
  // Its size at the middle of its water.
  scale: number
  isFar: boolean
}

// Whatever floats on the sea looks smaller the nearer it is to the horizon.
// The scene is drawn with a gentle perspective (the water villas far out
// stand nearly as large as the island), so a boat shrinks with the square
// root of how far below the horizon it sits rather than in proportion: far
// out it is still plain to see, and only at the horizon itself does it
// dwindle to nothing. NEAR_Y is the depth at which a boat shows at its own
// size.
export const HORIZON_Y = 430
const NEAR_Y = 745
export function depthScale(y: number): number {
  return Math.sqrt(Math.max(0, (y - HORIZON_Y) / (NEAR_Y - HORIZON_Y)))
}

// How big each kind of boat is at NEAR_Y.
const SIZE: Record<BoatKind, number> = { lead: 1.4, crew: 0.65, shell: 0.66 }

function sizeAt(kind: BoatKind, y: number): number {
  return Math.round(SIZE[kind] * depthScale(y) * 1000) / 1000
}

function ellipse(kind: BoatKind, cx: number, cy: number, rx: number, ry: number, seconds: number): Route {
  return { cx, cy, rx, ry, seconds, drift: undefined, driftFrom: 0, scale: sizeAt(kind, cy), isFar: false }
}

// Water from `left` to `right` and from `far` to `near`, swept in `seconds`
// and drifted across in `drift`.
function roam(kind: BoatKind, [left, right]: [number, number], [far, near]: [number, number], seconds: number, drift: number, driftFrom: number): Route {
  const cy = (far + near) / 2
  return { cx: (left + right) / 2, cy, rx: (right - left) / 2, ry: (near - far) / 2, seconds, drift, driftFrom, scale: sizeAt(kind, cy), isFar: far < 600 }
}

// A boat's size where it is on its water. On a roam the scene sizes it on a
// straight line between its sizes at the far and the near side, which is
// within a few hundredths of its size by depth. Off that water, on its way to
// or from the horizon, it is sized by depth alone: the line, carried on past
// the far side, would leave it far too big.
export function sizeOn(boat: Boat, y: number): number {
  const r = routeOf(boat)
  if (r.drift === undefined) {
    return r.scale
  }
  const [top, bottom] = [r.cy - r.ry, r.cy + r.ry]
  if (y < top || y > bottom) {
    return SIZE[boat.kind] * depthScale(y)
  }
  const [far, near] = [sizeAt(boat.kind, top), sizeAt(boat.kind, bottom)]
  return far + ((near - far) * (y - top)) / (2 * r.ry || 1)
}

// The ends of a roam's sizes, far side first.
export function sizesOf(boat: Boat): [number, number] {
  const r = routeOf(boat)
  return [sizeAt(boat.kind, r.cy - r.ry), sizeAt(boat.kind, r.cy + r.ry)]
}

// The water of each kind's boats. Behind the water villas, left of x 640, a
// boat would sail through the pier, so the water there starts nearer; by the
// island, right of x 1090, only the water in front of the island is open.
// The sweeps and drifts take lengths with no common beat.
export const ROUTES: Record<BoatKind, readonly Route[]> = {
  lead: [ellipse('lead', 690, 745, 150, 8, 100), ellipse('lead', 680, 760, 140, 7, 92)],
  crew: [
    roam('crew', [170, 610], [660, 860], 86, 137, 0.1),
    roam('crew', [670, 1050], [545, 800], 94, 151, 0),
    roam('crew', [740, 1480], [800, 880], 118, 97, 0.6),
    roam('crew', [660, 1060], [560, 720], 82, 129, 0.35),
    roam('crew', [300, 990], [700, 880], 106, 163, 0.8),
  ],
  shell: [
    roam('shell', [1150, 1520], [805, 882], 98, 121, 0.3),
    roam('shell', [670, 1050], [560, 760], 102, 143, 0.55),
    roam('shell', [140, 620], [690, 880], 114, 131, 0.9),
    roam('shell', [700, 1050], [545, 680], 90, 117, 0.15),
    roam('shell', [560, 1300], [820, 885], 124, 109, 0.45),
  ],
}

// Where a far circuit's boat comes up over the horizon, and goes down below
// it again: a little off to one side of its circuit.
function horizonOf(boat: Boat, side: Side): Point {
  const r = routeOf(boat)
  return { x: r.cx + (side === 'L' ? -60 : 60), y: HORIZON_Y + 6 }
}

// A straight course on the water is a straight line on the screen. Paced
// evenly on the water, a boat would leave its circuit in a rush and spend the
// rest of its way a speck crawling at the horizon; paced on the screen, slow
// at the horizon and slow at the circuit, it is seen to come up out of the
// distance and to sink back into it.
function along(a: Point, b: Point, p: number): Point {
  const s = eased(HORIZON_EASE, p)
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s }
}
const HORIZON_EASE: Curve = [0.5, 0, 0.4, 1]
const HORIZON_S = 16

const KINDS: readonly BoatKind[] = ['lead', 'crew', 'shell']

// The longest a boat takes to come in, and to go out. One with less water to
// cover takes less, down to SHORTEST_S.
export const ENTER_S = 18
export const LEAVE_S = 18
const SHORTEST_S = 5

// How the sideways travel is paced, as CSS cubic-bezier points: steady at
// the edge of the view and gentle near the circuit.
export type Curve = readonly [number, number, number, number]
export const ENTER_X: Curve = [0.3, 0.45, 0.45, 1]
export const LEAVE_X: Curve = [0.45, 0, 0.7, 0.75]
const EASE_IN_OUT: Curve = [0.42, 0, 0.58, 1]

const VIEW_W = 1600
const OFF = 90

// The lanes the edges are crossed on. On the left a boat keeps low enough to
// clear the villas' pier. On the right it holds the lane behind the island or
// the one in front of it from ROUND_X outward, where the island begins.
const LEFT_CLEAR_X = 640
const ROUND_X = 1110
const ISLAND_Y = 700
const LEFT_LANE: Record<BoatKind, number> = { lead: 737, crew: 650, shell: 650 }
const OVER_LANE: Record<BoatKind, number> = { lead: 612, crew: 606, shell: 606 }
const UNDER_LANE: Record<BoatKind, number> = { lead: 886, crew: 818, shell: 812 }

// A lane is taken only if the boat can reach it on a gentle slant: this much
// run for each unit of rise.
const SLANT = 2

// Deterministic scatter in [0, 1).
function chance(seed: number): number {
  const v = Math.sin(seed * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

// The edge the last boat on each circuit went out by, so the next one on it
// comes back in by that edge. It starts over when the module reloads.
const wentOut = new Map<string, Side>()

// Brings the fleet in line with how many boats of each kind should be out.
// A boat no longer wanted is called home and stays in the fleet while it sails
// off; a new one takes a circuit no other boat of its kind is on. While every
// circuit still has a boat on it or sailing off it, the new one waits:
// `berthAt` says when a circuit comes free. A boat comes
// in by the edge the last one on its circuit went out by; with none before it,
// most come in from the left, some from the right. Each has its own way round
// the island.
export function muster(fleet: readonly Boat[], wanted: Record<BoatKind, number>, now: number): readonly Boat[] {
  let next = fleet.filter(boat => boat.gone === undefined || now < boat.gone + LEAVE_S * 1000)
  for (const kind of KINDS) {
    const routes = ROUTES[kind].length
    const want = Math.max(0, Math.min(wanted[kind], routes))
    const out = next.filter(boat => boat.kind === kind && boat.gone === undefined)
    const recalled = out.slice(0, Math.max(0, out.length - want))
    for (const boat of recalled) {
      wentOut.set(`${kind}${boat.slot}`, boat.from === 'L' ? 'R' : 'L')
    }
    next = next.map(boat => (recalled.includes(boat) ? { ...boat, gone: now } : boat))
    for (let count = out.length; count < want; count++) {
      const taken = next.filter(boat => boat.kind === kind).map(boat => boat.slot)
      // A dinghy or fishing boat takes any free circuit, near or far, so even
      // a lone one is as likely to head out to sea as to keep inshore.
      const free = [...Array(routes).keys()].filter(i => !taken.includes(i))
      const pick = kind === 'lead' ? 0 : Math.floor(chance((now % 1000003) / 1000 + count * 5.27 + KINDS.indexOf(kind) * 2.39) * free.length)
      const slot = free[pick]
      if (slot === undefined) {
        break
      }
      const seed = (now % 1000003) / 1000 + slot * 7.13 + KINDS.indexOf(kind) * 3.71
      const from: Side = wentOut.get(`${kind}${slot}`) ?? (chance(seed) < 0.3 ? 'R' : 'L')
      const pass: Pass = chance(seed + 1.9) < 0.5 ? 'over' : 'under'
      next = [...next, { kind, slot, from, pass, born: now, gone: undefined }]
    }
  }
  return next
}

// When `muster` will next find a circuit free for a boat it had to leave
// waiting: once the first boat still sailing off a circuit of that kind is
// clear of the fleet. Undefined when no boat is waiting.
export function berthAt(fleet: readonly Boat[], wanted: Record<BoatKind, number>): number | undefined {
  const times = KINDS.flatMap(kind => {
    const want = Math.min(wanted[kind], ROUTES[kind].length)
    const out = fleet.filter(boat => boat.kind === kind && boat.gone === undefined).length
    return out < want ? fleet.filter(boat => boat.kind === kind && boat.gone !== undefined).map(boat => (boat.gone ?? 0) + LEAVE_S * 1000) : []
  })
  return times.length === 0 ? undefined : Math.min(...times)
}

// The progress a CSS cubic-bezier timing gives at time fraction `p`.
export function eased([x1, y1, x2, y2]: Curve, p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  const at = (a: number, b: number, u: number): number => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (at(x1, x2, mid) < p) lo = mid
    else hi = mid
  }
  return at(y1, y2, (lo + hi) / 2)
}

export function routeOf(boat: Boat): Route {
  const routes = ROUTES[boat.kind]
  const route = routes[boat.slot % routes.length]
  if (route === undefined) {
    throw new Error(`no route for a ${boat.kind} boat`)
  }
  return route
}

export type Point = { x: number; y: number }
export type Fix = Point & { heading: 1 | -1 }

// How far into its lap a boat starts: at the end of the circuit nearest the
// edge it came in by, heading away from it.
export function lapStart(boat: Boat): number {
  return boat.from === 'L' ? 0 : routeOf(boat).seconds / 2
}

// A boat's place on its circuit `age` seconds after it set out. The circuit
// mirrors the scene's `ox`, `oy` and `of` keyframes.
export function lapAt(boat: Boat, age: number): Fix {
  const route = routeOf(boat)
  const lap = (((age + lapStart(boat)) / route.seconds) % 1 + 1) % 1
  const ease = (p: number): number => eased(EASE_IN_OUT, p)
  const dx = lap < 0.5 ? -1 + 2 * ease(lap / 0.5) : 1 - 2 * ease((lap - 0.5) / 0.5)
  if (route.drift !== undefined) {
    // Its drift mirrors the scene's `oy2`: from the far side to the near and
    // back, eased at each.
    const d = ((((age + lapStart(boat)) / route.drift + route.driftFrom) % 1) + 1) % 1
    const dy = d < 0.5 ? -1 + 2 * ease(d / 0.5) : 1 - 2 * ease((d - 0.5) / 0.5)
    return { x: route.cx + route.rx * dx, y: route.cy + route.ry * dy, heading: lap < 0.5 ? 1 : -1 }
  }
  const dy = lap < 0.25 ? -ease(lap / 0.25) : lap < 0.75 ? -1 + 2 * ease((lap - 0.25) / 0.5) : 1 - ease((lap - 0.75) / 0.25)
  return { x: route.cx + route.rx * dx, y: route.cy + route.ry * dy, heading: lap < 0.5 ? 1 : -1 }
}

// Where a boat bound for the right edge may start to change lane: not before
// it is clear of the pier.
function clearOfPier(boat: Boat, at: Point): Point {
  return at.x < LEFT_CLEAR_X - 60 ? { x: LEFT_CLEAR_X, y: Math.max(at.y, LEFT_LANE[boat.kind]) } : at
}

// The way round the island a boat takes between `at` and the right edge: the
// one it would rather, unless only the other can be reached on a gentle slant.
// A fishing boat works the near water and always keeps to it.
export function passAt(boat: Boat, at: Point): Pass {
  const start = clearOfPier(boat, at)
  const reaches = (lane: number): boolean => ROUND_X - start.x >= SLANT * Math.abs(lane - start.y)
  const over = boat.kind !== 'shell' && reaches(OVER_LANE[boat.kind])
  const under = start.y >= UNDER_LANE[boat.kind] || reaches(UNDER_LANE[boat.kind])
  if (over !== under) {
    return over ? 'over' : 'under'
  }
  if (over) {
    return boat.pass
  }
  // Too near the island for either slant: it keeps to the side it is on.
  return boat.kind !== 'shell' && start.y < ISLAND_Y ? 'over' : 'under'
}

// The course between `at`, a place out on the water, and the edge on `side`:
// its points from left to right, each lane held level between two of them.
function courseTo(boat: Boat, at: Point, side: Side): Point[] {
  if (side === 'L') {
    const lane = Math.max(at.y, LEFT_LANE[boat.kind])
    const gate = { x: -OFF, y: lane }
    if (at.x <= LEFT_CLEAR_X + 60) {
      return [gate, at]
    }
    // Out by the island, the lane it is on is held until the island is behind.
    return at.x > ROUND_X ? [gate, { x: LEFT_CLEAR_X, y: lane }, { x: ROUND_X, y: at.y }, at] : [gate, { x: LEFT_CLEAR_X, y: lane }, at]
  }
  const start = clearOfPier(boat, at)
  const lane = passAt(boat, at) === 'over' ? OVER_LANE[boat.kind] : Math.max(start.y, UNDER_LANE[boat.kind])
  const gate = { x: VIEW_W + OFF, y: lane }
  const lead = start === at ? [at] : [at, start]
  const turn = Math.max(ROUND_X, start.x + SLANT * Math.abs(lane - start.y))
  return lane === start.y ? [...lead, gate] : [...lead, { x: turn, y: lane }, gate]
}

// The height of a course at `x`: an eased slant from each point to the next.
function heightAt(course: readonly Point[], x: number): number {
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1]
    const b = course[i]
    if (a !== undefined && b !== undefined && x <= b.x) {
      const s = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)))
      return a.y + (b.y - a.y) * s * s * (3 - 2 * s)
    }
  }
  return course[course.length - 1]?.y ?? 0
}

function gateOf(course: readonly Point[], side: Side): Point {
  const gate = side === 'L' ? course[0] : course[course.length - 1]
  if (gate === undefined) {
    throw new Error('a course has no points')
  }
  return gate
}

function paced(distance: number, speed: number, longest: number): number {
  return Math.round(Math.max(SHORTEST_S, Math.min(longest, Math.abs(distance) / speed)) * 10) / 10
}

// How long a boat's way in takes. It joins its circuit where that has got to
// by then.
export function enterSeconds(boat: Boat): number {
  if (routeOf(boat).isFar) {
    return HORIZON_S
  }
  const edge = boat.from === 'L' ? -OFF : VIEW_W + OFF
  return paced(edge - lapAt(boat, ENTER_S).x, 45, ENTER_S)
}

// A boat's place `age` seconds after it set out, while it has not been called
// home: on its way in, then round its circuit.
export function fixAt(boat: Boat, age: number): Fix {
  const lap = lapAt(boat, age)
  const seconds = enterSeconds(boat)
  if (age >= seconds) {
    return lap
  }
  const join = lapAt(boat, seconds)
  if (routeOf(boat).isFar) {
    return { ...along(horizonOf(boat, boat.from), join, age / seconds), heading: lap.heading }
  }
  const course = courseTo(boat, join, boat.from)
  const gate = gateOf(course, boat.from)
  const x = gate.x + (join.x - gate.x) * eased(ENTER_X, age / seconds)
  return { x, y: heightAt(course, x), heading: lap.heading }
}

// Where a boat called home sets off from, by which edge it goes, and how long
// it takes.
function leaving(boat: Boat, gone: number): { from: Fix; side: Side; course: Point[]; seconds: number } {
  const from = fixAt(boat, (gone - boat.born) / 1000)
  const side: Side = boat.from === 'L' ? 'R' : 'L'
  const course = courseTo(boat, from, side)
  return { from, side, course, seconds: paced(gateOf(course, side).x - from.x, 50, LEAVE_S) }
}

export function leaveSeconds(boat: Boat): number {
  if (routeOf(boat).isFar) {
    return HORIZON_S
  }
  return boat.gone === undefined ? LEAVE_S : leaving(boat, boat.gone).seconds
}

// Whether a boat comes and goes by the horizon.
export function isFarOut(boat: Boat): boolean {
  return routeOf(boat).isFar
}

// How far ahead a scene works out the order of roaming boats in depth. It is
// drawn again once that time is up.
export const ROAM_S = 45

// Whether a boat roams, and so keeps changing places in depth with others.
export function roams(boat: Boat): boolean {
  return routeOf(boat).drift !== undefined
}

// A boat's place at clock time `now` (ms), called home or not.
export function whereabouts(boat: Boat, now: number): Fix {
  if (boat.gone === undefined) {
    return fixAt(boat, (now - boat.born) / 1000)
  }
  if (routeOf(boat).isFar) {
    const from = fixAt(boat, (boat.gone - boat.born) / 1000)
    const side: Side = boat.from === 'L' ? 'R' : 'L'
    return { ...along(from, horizonOf(boat, side), (now - boat.gone) / 1000 / HORIZON_S), heading: side === 'L' ? -1 : 1 }
  }
  const { from, side, course, seconds } = leaving(boat, boat.gone)
  const x = from.x + (gateOf(course, side).x - from.x) * eased(LEAVE_X, (now - boat.gone) / 1000 / seconds)
  return { x, y: heightAt(course, x), heading: side === 'L' ? -1 : 1 }
}

// Whether a boat rounds the island behind it, on its way in or on its way out,
// and so is drawn behind the island.
export function sailsBehind(boat: Boat): boolean {
  if (boat.kind === 'shell' || routeOf(boat).isFar) {
    return false
  }
  if (boat.from === 'R') {
    return passAt(boat, lapAt(boat, enterSeconds(boat))) === 'over'
  }
  return boat.gone !== undefined && passAt(boat, fixAt(boat, (boat.gone - boat.born) / 1000)) === 'over'
}
