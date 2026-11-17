// The Maldives lagoon backdrop: one SVG whose layers follow the agent's mood.

import type { Mood, Need } from '../types'
import { DRIFT_TICKS, ENTER_X, HORIZON_Y, SWEEP_TICKS, SWING_PIECES, TURN_PIECES, LEAVE_X, ROAM_S, acrossOf, depthScale, enterSeconds, fixAt, lapAt, lapStart, leaveSeconds, roams, routeOf, sailsBehind, sizeOn, sizesOf, whereabouts } from './fleet'
import type { Boat, Point } from './fleet'
import { AT_CRATE, WAITER_BUSY, WAITER_S, waiterAtEase, BAR, BEACH_TIP, CIRCUIT_START, COCONUTS, CRATE, DOCK, MOOR, PIER_SCALE, PLANE_IN_S, STOCKED, SWAP, WALK, swapSeconds, circuitAt, flightOf, FIRE, HOME, ISLE, JETTY, LAP_FACING, LOUNGER, along, dayOf, facingAt, isByLounger, lifeAt, planOf, RISE_S, scatter, turns } from './voyage'
import type { Day, Doing, Leg, Pantry, Plan, Plane, Voyage } from './voyage'
import { FPS, NAMED, beat, evenly, ft, onClock } from './clock'

const W = 1600
const H = 1000
const HORIZON = 430
const SUN_X = 1130
const SUN_Y = 212

// What the lead boat flies: nothing but its plain pennant, or what the agent
// is held on and needs the person for.
export type Signal = Need | 'error' | 'none'

// The signal flown now, the one it replaced, and the seconds since the change.
// `hailed` is how long ago the boat began calling for the person, when that
// differs from `age`.
export type Flag = { from: Signal; to: Signal; age: number; hailed?: number }

// How long one signal takes to give way to the next.
export const HOIST_S = 1.6
// One beat of the mascot's hailing hops.
const HAIL_S = 2.4
const HOIST = `${HOIST_S}s ease-in-out calc(var(--h,0) * -1s) 1 both`

// Seconds between one leap of a dolphin pod and its next.
const LEAP_EVERY = 52

// Every looping animation takes its phase from the wall clock (--t, seconds),
// so a redraw resumes the motion where it was instead of restarting it. --d
// shifts one element's phase. Every element works out its own --P from the
// --t and --d it has, which keeps each rule short.
const PHASE = 'var(--P)'

// Swims, sweeps and drifts last as long as each element's own --u or --v
// (so their keyframes serve every element), drawn in SWING_PIECES even
// stretches that each step once a tick: --k (or --kv) ticks a stretch. The
// turns at either end of a sweep (`of`, `ob`, `or`) take a TURN_PIECES-th of
// it each, stepped by --kf. A sweep lasts whole SWEEP_TICKS so all three
// come out whole; a drift, whole DRIFT_TICKS.
const SWING = (body: string): string => evenly(body, SWING_PIECES, 'ease-in-out')
const TURN = `${100 / TURN_PIECES}%,${50 - 100 / TURN_PIECES}%`
const TURN_BACK = `${50 + 100 / TURN_PIECES}%,${100 - 100 / TURN_PIECES}%`

// The variables of an element that sweeps over `seconds`, a whole number of
// SWEEP_TICKS.
function sweepOf(seconds: number): string {
  const n = Math.round(seconds * FPS)
  return `--u:${ft(seconds)}s;--k:${n / SWING_PIECES};--kf:${n / TURN_PIECES}`
}

// And of one that drifts over `seconds`, a whole number of DRIFT_TICKS.
function driftOf(seconds: number): string {
  const n = Math.round(seconds * FPS)
  return `--v:${ft(seconds)}s;--kv:${n / SWING_PIECES}`
}

function loop(name: string, seconds: number, timing: string): string {
  return `animation:${name} ${seconds}s ${timing} ${PHASE} infinite`
}

// Deterministic scatter in [0, 1).
function rnd(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return v - Math.floor(v)
}

// Three decimals, for scales.
function f3(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

// Times (a delay, a duration, where in its course a thing is) go through f3,
// never f: two drawings a redraw apart each round on their own, and a tenth
// of a second is a jump wherever anything moves fast.
function f(n: number): string {
  return String(Math.round(n * 10) / 10)
}

// A dolphin's leap follows a parabola: its centre leaves the water at x 0,
// peaks LEAP_HIGH above it and drops back in at LEAP_REACH, with the body
// turned along its path the whole way, so every part of it breaks the surface
// through the same two holes. Under the surface, where it is clipped, the path
// goes on down to LEAP_DEEP, where the dolphin waits out of sight between
// leaps, swimming back under the surface to where it set out from over the
// last LEAP_BACK percent of the round. The leap takes LEAP_SPAN percent of
// LEAP_EVERY from LEAP_FROM; its splashes come when the nose and then the tail
// cross the surface.
const LEAP_REACH = 90
const LEAP_HIGH = 30
const LEAP_DEEP = 36
const LEAP_FROM = 86
const LEAP_SPAN = 6
const LEAP_BACK = 4
// The lead dolphin's size, and its nose and tail along its length, which the
// splashes are timed for.
const LEAP_SIZE = 0.5
const NOSE_X = 56
const TAIL_X = -63

const LEAP_CSS = (() => {
  const c = LEAP_REACH / 2
  const reach = c * Math.sqrt(1 + LEAP_DEEP / LEAP_HIGH)
  const [x0, x1] = [c - reach, c + reach]
  const yAt = (x: number): number => LEAP_HIGH * (((x - c) / c) ** 2 - 1)
  const turnAt = (x: number): number => Math.atan((2 * LEAP_HIGH * (x - c)) / (c * c))
  const pctAt = (x: number): number => LEAP_FROM + (LEAP_SPAN * (x - x0)) / (x1 - x0)
  const n = (v: number): string => String(Math.round(v * 100) / 100)
  const deg = (x: number): string => n((turnAt(x) * 180) / Math.PI)
  // Where a point `along` the body crosses the surface, rising or sinking.
  const crossing = (along: number, rising: boolean): number => {
    const steps = 2000
    let was = 0
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps
      const y = yAt(x) + along * LEAP_SIZE * Math.sin(turnAt(x))
      if (i > 0 && (rising ? was > 0 && y <= 0 : was < 0 && y >= 0)) {
        return pctAt(x)
      }
      was = y
    }
    return rising ? LEAP_FROM : LEAP_FROM + LEAP_SPAN
  }
  const end = LEAP_FROM + LEAP_SPAN
  const turns = Array.from({ length: 9 }, (_, i) => x0 + ((x1 - x0) * i) / 8)
  const spin = turns.map((x, i) => `${i === 0 ? `0%,${LEAP_FROM}` : i === 8 ? `${end}%,${100 - LEAP_BACK}` : n(pctAt(x))}%{transform:rotate(${deg(x)}deg)}`).join('') + `100%{transform:rotate(${deg(x0)}deg)}`
  // One second, in percent of a leap round.
  const s = 100 / LEAP_EVERY
  const splash = (name: string, head: number, tail: number): string => {
    const mid = (head + tail) / 2
    return `@keyframes sp${name}{0%,${n(head)}%{opacity:0;transform:scale(.3,.1)}${n(mid)}%{opacity:.85;transform:scale(1)}${n(tail + 0.7 * s)}%,100%{opacity:0;transform:scale(1.15,1.3)}}` +
      `@keyframes rg${name}{0%,${n(head)}%{opacity:0;transform:scale(.4)}${n(head + 0.25 * s)}%{opacity:.85;transform:scale(.7)}${n(tail + 1.6 * s)}%,100%{opacity:0;transform:scale(2.3)}}` +
      `.sp${name}{transform-box:fill-box;transform-origin:50% 100%;${loop(`sp${name}`, LEAP_EVERY, 'ease-out')}}` +
      `.rg${name}{transform-box:fill-box;transform-origin:center;${loop(`rg${name}`, LEAP_EVERY, 'ease-out')}}`
  }
  return `@keyframes leapX{0%,${LEAP_FROM}%{transform:translateX(${n(x0)}px)}${end}%,${100 - LEAP_BACK}%{transform:translateX(${n(x1)}px)}100%{transform:translateX(${n(x0)}px)}}` +
    `@keyframes leapY{0%,${LEAP_FROM}%{transform:translateY(${LEAP_DEEP}px);animation-timing-function:cubic-bezier(.33,.67,.67,1)}${n(LEAP_FROM + LEAP_SPAN / 2)}%{transform:translateY(${-LEAP_HIGH}px);animation-timing-function:cubic-bezier(.33,0,.67,.33)}${end}%,100%{transform:translateY(${LEAP_DEEP}px)}}` +
    `@keyframes leapR{${spin}}` +
    splash('O', crossing(NOSE_X, true), crossing(TAIL_X, true)) +
    splash('I', crossing(NOSE_X, false), crossing(TAIL_X, false))
})()

// The lanes under the water take turns. Over each VISIT_ROUND only one
// swimmer at a time crosses, in an uneven order and after uneven gaps, so the
// sea is often empty. Each still swims its own cycle, crossing in the first
// SWIM of it, but a gate keeps it out of sight on all but its chosen
// crossings; the gate only switches while the swimmer is off the view.
// The water the reef's life swims in, by day, and how much of it lies between
// the eye and a swimmer at each depth: deeper, more of its colour comes
// through the water's own, so the deeper a swimmer the hazier it looks.
const WATER = [58, 174, 180]
const veilAt = (y: number): number => Math.round(Math.max(0.25, Math.min(0.5, 0.25 + ((y - 700) / 160) * 0.25)) * 100) / 100
// `#rrggbb` seen through the water as `veil` says.
function underwater(hex: string, veil: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `#${[16, 8, 0].map((shift, i) => Math.round(((n >> shift) & 255) * (1 - veil) + WATER[i]! * veil).toString(16).padStart(2, '0')).join('')}`
}
// The reef's own fish, octopus and stingray, about its crest.
const REEF_VEIL = veilAt(810)
// Every colour of `svg` seen through the water.
const inWater = (svg: string, veil: number): string => svg.replace(/#[0-9a-f]{6}\b/gi, hex => underwater(hex, veil))

const VISIT_ROUND = 1680
const SWIM = 0.4
const VISIT_GAP = { min: 20, span: 90 }
const VISIT_PICK = 70
interface Lane { gate: string; dir: 'R' | 'L'; y: number; cycle: number; phase: number }
const LANES: Record<'manta' | 'shoalA' | 'ray' | 'turtle' | 'shoalB', Lane> = {
  manta: { gate: 'gMa', dir: 'L', y: 712, cycle: 210, phase: 60 },
  shoalA: { gate: 'gSa', dir: 'R', y: 740, cycle: 120, phase: 20 },
  ray: { gate: 'gRa', dir: 'L', y: 786, cycle: 168, phase: 130 },
  turtle: { gate: 'gTu', dir: 'R', y: 812, cycle: 240, phase: 170 },
  shoalB: { gate: 'gSb', dir: 'L', y: 850, cycle: 140, phase: 96 },
}

// Swimmers, gulls and dolphins called up by hand: each comes once, beside the
// ones on their own rounds, which go on as they were. A crosser keeps to its
// kind's lane, a little off it so two do not lie on one another; a dolphin
// call is one leap of a pod of its own. How long each is out for, from the
// moment it was called.
export type VisitKind = 'snappers' | 'bannerfish' | 'turtle' | 'manta' | 'ray' | 'whaleShark' | 'fin' | 'dolphins' | 'gulls'
// `slot` is which of the places beside the lane it keeps, fixed when it is
// called, so one going by never moves the others.
export type Visit = { kind: VisitKind; age: number; slot: number }
const WHALE_CYCLE = 560
const FIN_CYCLE = 270
const GULL_CYCLE = 58
// A called dolphin leaps this many seconds after the call.
const LEAP_LEAD = 0.3
export const VISIT_SECONDS: Readonly<Record<VisitKind, number>> = {
  snappers: LANES.shoalA.cycle * SWIM,
  bannerfish: LANES.shoalB.cycle * SWIM,
  turtle: LANES.turtle.cycle * SWIM,
  manta: LANES.manta.cycle * SWIM,
  ray: LANES.ray.cycle * SWIM,
  whaleShark: WHALE_CYCLE * SWIM,
  fin: FIN_CYCLE * SWIM,
  gulls: GULL_CYCLE,
  dolphins: ((100 - LEAP_FROM) / 100) * LEAP_EVERY,
}

// For each lane, the crossings (counted from the start of the round on its own
// clock) that are in sight.
function visits(): Map<Lane, number[]> {
  const lanes = Object.values(LANES)
  const crossings = lanes.flatMap((lane) => Array.from({ length: VISIT_ROUND / lane.cycle }, (_, j) => {
    // A lane's clock runs --d seconds ahead of the wall clock.
    const start = (((j * lane.cycle - lane.phase) % VISIT_ROUND) + VISIT_ROUND) % VISIT_ROUND
    return { lane, j, start, end: start + lane.cycle * SWIM }
  })).sort((a, b) => a.start - b.start)
  const chosen = new Map(lanes.map((lane) => [lane, [] as number[]]))
  let free = 0
  let first = Infinity
  let last: Lane | undefined
  for (let i = 0; ; i++) {
    const gap = VISIT_GAP.min + rnd(i, 71) * VISIT_GAP.span
    // Of the crossings that come soon enough, the lane seen least goes next.
    const open = crossings.filter((c) => c.start >= free + gap && c.lane !== last)
    const soon = open.filter((c) => c.start <= (open[0]?.start ?? 0) + VISIT_PICK)
    const next = soon.sort((a, b) => (chosen.get(a.lane)?.length ?? 0) - (chosen.get(b.lane)?.length ?? 0) || a.start - b.start)[0]
    if (next === undefined || next.end + VISIT_GAP.min > first + VISIT_ROUND) {
      return chosen
    }
    chosen.get(next.lane)?.push(next.j)
    first = Math.min(first, next.start)
    free = next.end
    last = next.lane
  }
}

// Each lane's gate: in sight from midway through the idle part of the cycle
// before a chosen crossing to midway through the idle part after it.
const LANE_GATES = (() => {
  const pct = (at: number): string => String(Math.round((at / VISIT_ROUND) * 10000) / 100)
  const ease = 2
  let css = ''
  for (const [lane, shown] of visits()) {
    const spans: [number, number][] = []
    for (const j of shown) {
      const from = j * lane.cycle - lane.cycle * (1 - SWIM) / 2
      const to = j * lane.cycle + lane.cycle * (1 + SWIM) / 2
      if (from < 0) {
        spans.push([from + VISIT_ROUND, VISIT_ROUND], [0, to])
      } else {
        spans.push([from, to])
      }
    }
    spans.sort((a, b) => a[0] - b[0])
    const stops: string[] = []
    for (const [from, to] of spans) {
      stops.push(from === 0 ? '0%{opacity:1}' : `${pct(from)}%{opacity:0}${pct(from + ease)}%{opacity:1}`)
      stops.push(to === VISIT_ROUND ? '100%{opacity:1}' : `${pct(to - ease)}%{opacity:1}${pct(to)}%{opacity:0}`)
    }
    if (!stops[0]?.startsWith('0%')) stops.unshift('0%{opacity:0}')
    if (!stops[stops.length - 1]?.startsWith('100%')) stops.push('100%{opacity:0}')
    css += `@keyframes ${lane.gate}{${stops.join('')}}.${lane.gate}{${loop(lane.gate, VISIT_ROUND, 'linear')}}`
  }
  return css
})()

// The scene's own rules. The night block comes last, so that its rules win
// over the day rules of the same weight above it, as they do when a forced
// dark scheme appends them (`styleFor`).
const STYLE = `
*{--P:calc((var(--t) + var(--d,0))*-1s)}
.sky0{stop-color:#1f86d6}.sky1{stop-color:#5fb8ec}.sky2{stop-color:#bfe6f8}.sky3{stop-color:#f2fbff}
.sea0{stop-color:#0f6fae}.sea1{stop-color:#1597c2}.sea2{stop-color:#22bfc8}.sea3{stop-color:#5fdcd2}.sea4{stop-color:#a6f0e2}
.halo0{stop-color:#e9fff9}.halo1{stop-color:#9ff3e4}.halo2{stop-color:#5fdcd2}
.sand0{stop-color:#fffaf0}.sand1{stop-color:#f8eedb}.sand2{stop-color:#f3e8d0}
.roof0{stop-color:#d9b273}.roof1{stop-color:#a87a3f}
.cl0{stop-color:#ffffff}.cl1{stop-color:#e3f1fa}
.sund0{stop-color:#fffbe6}.sund1{stop-color:#ffedb0}.glow0{stop-color:#fff1bf}.col0{stop-color:#fff6d6}
.gcol{fill:none;stroke:#fffadf;stroke-linecap:round}
.far{fill:#3f8f7a}.farsand{fill:#fbf5e4}.fpa{fill:#347f69}.fvb{fill:#7a6650}.frf{fill:#d2b281}
.wall{fill:#b7875a}.wallshade{fill:#946a43}.deck{fill:#8a6440}.post{stroke:#6b4c2f}
.trunk{fill:#9a7650}.bark{fill:#82623f}.ring{stroke:#7d5d3c;fill:none}.sh{fill:#6b5326;opacity:.18}
.fa{fill:#2c8a4f}.fb{fill:#3aa35f}.fc{fill:#24733f}.rib{stroke:#1d5e33}
.bush{fill:#2f8a4f}.bush2{fill:#3fa35e}.leaf{stroke:#2f8a4f;stroke-width:2.2;stroke-linecap:round}.flw{fill:#ff6f91}.flc{fill:#ffe08a}
.grass{fill:none;stroke:#5f9e47;stroke-width:1.5;stroke-linecap:round}.grain{fill:#a88a52}.shoal{fill:#a6f3e4}
@keyframes bglow{0%,100%{opacity:.35}50%{opacity:.95}}.biw{stroke:#1fdcff;opacity:.5}.bil{stroke:#a8fdff;stroke-dasharray:26 34 8 50;animation:lap 9s linear ${PHASE} infinite,bglow 3.7s ease-in-out ${PHASE} infinite}.wake.bwk{stroke:#7ffaff;stroke-width:2.4;opacity:.9}.bip{stroke:#8ffbff;stroke-linecap:round;${loop('bglow', 2.9, 'ease-in-out')}}
.wsb{fill:#33536a}.wsd{fill:#2c4a5f}#wsp{fill:#dbe9f0}.bio{display:none}
.hrl{stroke:#b49a6c}.hrg{fill:#a3acb2}.hrh{fill:#f2f4f5}.hrk{stroke:#eef1f3}.hrw{fill:#76828b}.hmc{fill:#f2c8a0}.hms{stroke:#c97f58}.hml{stroke:#d9512f;stroke-width:1.2;stroke-linecap:round;fill:none}.hmo{fill:#ef6a3c}
.crb{fill:#ec6a43}.crl{stroke:#c4462b;stroke-width:1;stroke-linecap:round;fill:none}
.foam{stroke:#ffffff}.wet{fill:#e3f7ef}
.crest{fill:#ffffff}
.glint{fill:#ffffff}
.gull{stroke:#2a3c46}
.shade{fill:#0a4f66;opacity:.13}
.tsk{fill:#55afa4}.tsh{fill:#4a9778}.tsl{fill:#64b18a}.tsc{stroke:#367d6c}.teye{fill:#265c54}
.mb{fill:#2e909e}.mm{fill:#88dcdc;opacity:.4}
.rbase{fill:#0a6278;opacity:.22}.kl{fill:none;stroke:#fff;opacity:.38}.sg{fill:none;stroke:#35b37e}
.k1{color:#ff8fa3}.k2{color:#ffa35c}.k3{color:#b98ae0}.k4{color:#ffd86b}.k5{color:#4fd0bd}.k6{color:#f2665f}.k7{color:#4f86e8}.k8{color:#93cf62}.rk{color:#3d8c94}
.fin{fill:#33505f}.fwk{opacity:.85;stroke-dasharray:16 3;animation:wflow 1.3s linear infinite}.fcl{opacity:.6}.dol{fill:#3f6f8f}.dolb{fill:#c9dfe9}.dolh{fill:#5b8eab}
.ff{fill:#3f86c2}.ffw{fill:#e6f6ff;opacity:.9}
${inWater('.sna{fill:#e2c550}.snb{fill:#e8e6aa}.snc{stroke:#3f95e5}', veilAt(LANES.shoalA.y))}${inWater('.bna{fill:#e3eee3}.bns{stroke:#e3eee3}.bnb{fill:#ecd657}', veilAt(LANES.shoalB.y))}
.ham{fill:#f6f2e6}
.lit{fill:#4a3624;opacity:.55}
.stars,.moon,.moonglow,.navlamp{opacity:0}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}
@keyframes wv{from{transform:translateX(0)}to{transform:translateX(var(--p))}}
@keyframes swell{0%,100%{transform:translateY(0)}50%{transform:translateY(2.5px)}}
@keyframes shimmer{0%,100%{opacity:.1}50%{opacity:.95}}
@keyframes sparkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes fly{from{transform:translate(-200px,0)}to{transform:translate(${W + 200}px,-60px)}}
@keyframes flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.4)}}
@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes shoot{0%,95%{opacity:0;transform:translate(0,0)}96%{opacity:1}100%{opacity:0;transform:translate(-300px,130px)}}
@keyframes hoistS{from{transform:scale(var(--s0))}to{transform:scale(var(--s1))}}
@keyframes hoistO{from{opacity:var(--o0)}to{opacity:var(--o1)}}
@keyframes hoistF{from{fill:var(--f0)}to{fill:var(--f1)}}
@keyframes hoistL{from{fill:var(--l0)}to{fill:var(--l1)}}
@keyframes hoistG{from{fill:var(--g0)}to{fill:var(--g1)}}
@keyframes flagwave{0%,100%{transform:skewY(-8deg)}50%{transform:skewY(8deg)}}
@keyframes turn{0%{transform:scaleX(-1)}50%{transform:scaleX(0)}100%{transform:scaleX(1)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
@keyframes lap{from{stroke-dashoffset:0}to{stroke-dashoffset:-240}}
@keyframes breathe{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes swimR{0%{transform:translateX(-260px)}40%,100%{transform:translateX(${W + 260}px)}}
@keyframes swimL{0%{transform:translateX(${W + 260}px)}40%,100%{transform:translateX(-260px)}}
@keyframes dipL{0%,16%{transform:translateY(var(--dip))}24%,100%{transform:translateY(0)}}
@keyframes dipR{0%,17%{transform:translateY(0)}24%,100%{transform:translateY(var(--dip))}}
@keyframes wander{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}
@keyframes wig{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}
@keyframes flipA{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(14deg)}}
@keyframes flipB{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-14deg)}}
@keyframes wingflap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.68)}}
${LEAP_CSS}
@keyframes pod{0%,33.2%{opacity:1}33.4%,100%{opacity:0}}
@keyframes ox{${SWING('0%,100%{transform:translateX(calc(var(--r) * -1))}50%{transform:translateX(calc(var(--r) * 1))}')}}
@keyframes oy{${SWING('0%,100%{transform:translateY(calc(var(--q) * 0))}25%{transform:translateY(calc(var(--q) * -1))}75%{transform:translateY(calc(var(--q) * 1))}')}}
@keyframes oy2{${SWING('0%,100%{transform:translateY(calc(var(--q) * -1))}50%{transform:translateY(calc(var(--q) * 1))}')}}
@keyframes oz{${SWING('0%,100%{transform:scale(calc(var(--z0) * 1 + var(--z1) * 0))}50%{transform:scale(calc(var(--z0) * 0 + var(--z1) * 1))}')}}
@keyframes of{0%,100%{transform:scaleX(0)}${TURN}{transform:scaleX(1)}50%{transform:scaleX(0)}${TURN_BACK}{transform:scaleX(-1)}}
@keyframes ob{0%,50%,100%{transform:scaleX(1)}${TURN},${TURN_BACK}{transform:scaleX(0)}}
@keyframes or{0%,50%,100%{transform:translateX(0)}${TURN}{transform:translateX(-20px)}${TURN_BACK}{transform:translateX(20px)}}
@keyframes turnb{0%,100%{transform:scaleX(0)}50%{transform:scaleX(1)}}
@keyframes wfade{0%,60%{transform:scaleX(1);opacity:1}100%{transform:scaleX(.2);opacity:0}}
@keyframes wflow{from{stroke-dashoffset:0}to{stroke-dashoffset:-19}}
@keyframes grass{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes ten{0%,100%{transform:skewX(-6deg)}50%{transform:skewX(6deg)}}
@keyframes eel{0%,100%{transform:translateY(9px)}25%,75%{transform:translateY(0) rotate(-5deg)}50%{transform:rotate(6deg)}}
@keyframes vhide{0%,99.9%{opacity:1}100%{opacity:0}}
@keyframes vshow{0%,99.9%{opacity:0}100%{opacity:1}}
@keyframes mhops{0%,70%{transform:translateY(0)}75%{transform:translateY(-2.6px)}80%{transform:translateY(0)}85%{transform:translateY(-2.6px)}90%,100%{transform:translateY(0)}}
@keyframes mstep{0%,100%{transform:translateY(0)}50%{transform:translateY(-.8px)}}
@keyframes mblink{0%,17%,19%,46%,48%,51%,53%,82%,84%,100%{transform:scaleY(1)}18%,47%,52%,83%{transform:scaleY(.12)}}
@keyframes mwave{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes mbreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.05)}}
@keyframes mzz{0%{opacity:0;transform:translate(0,0)}25%{opacity:1}100%{opacity:0;transform:translate(5px,-9px)}}
@keyframes flick{0%,100%{transform:scale(1,1)}40%{transform:scale(.86,1.2)}70%{transform:scale(1.1,.88)}}
@keyframes blink{0%,60%,100%{opacity:.15}30%{opacity:1}}
@keyframes burst{0%{transform:scale(.05);opacity:1}70%{opacity:1}100%{transform:scale(1);opacity:0}}
@keyframes rise{0%{transform:translateY(420px);opacity:1}100%{transform:translateY(0);opacity:0}}
@keyframes fwr{0%,100%{opacity:0}25%{opacity:.45}}
@keyframes ffX{from{transform:translateX(0)}to{transform:translateX(440px)}}
@keyframes ffY{0%{transform:translateY(22px);animation-timing-function:ease-out}50%{transform:translateY(-46px);animation-timing-function:ease-in}100%{transform:translateY(22px)}}
@keyframes ffR{from{transform:rotate(-30deg)}to{transform:rotate(30deg)}}
@keyframes ffs{0%{opacity:0;transform:scale(.3)}15%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}
.drift{${loop('drift', 220, 'steps(1760)')}}
.drift2{${loop('drift', 340, 'steps(1700)')}}
.wv{animation:wv var(--w) steps(var(--kw)) ${PHASE} infinite}
.swell{${loop('swell', 6, 'ease-in-out')}}
.gcol>*{${loop('shimmer', 3.4, 'ease-in-out')}}
.spark use{transform-box:fill-box;transform-origin:center;${loop('sparkle', 5, 'ease-in-out')}}
.palm{transform-box:view-box;${loop('sway', 7, 'ease-in-out')}}
.gulls{${loop('fly', 58, 'linear')}}
.wing{transform-box:fill-box;transform-origin:center;${loop('flap', 0.9, 'ease-in-out')}}
.star{${loop('twinkle', 4, 'ease-in-out')}}
.shoot{${loop('shoot', 46, 'linear')}}
.bx{animation:ox var(--u) steps(var(--k)) calc(var(--b,0) * -1s) infinite}
.by{animation:oy var(--u) steps(var(--k)) calc(var(--b,0) * -1s) infinite}
.bv{animation:oy2 var(--v) steps(var(--kv)) calc(var(--c,0) * -1s) infinite}
.bz{animation:oz var(--v) steps(var(--kv)) calc(var(--c,0) * -1s) infinite}
.bf{animation:of var(--u) steps(var(--kf)) calc(var(--b,0) * -1s) infinite}
.bw{animation:ob var(--u) steps(var(--kf)) calc(var(--b,0) * -1s) infinite}
.br{animation:or var(--u) steps(var(--kf)) calc(var(--b,0) * -1s) infinite}
.ox{animation:ox var(--u) steps(var(--k)) ${PHASE} infinite}
.oy{animation:oy var(--u) steps(var(--k)) ${PHASE} infinite}
.of{animation:of var(--u) steps(var(--kf)) ${PHASE} infinite}
.sc>g{animation:ox var(--u) steps(var(--k)) ${PHASE} infinite}.sc use{${loop('wander', 9, 'ease-in-out')}}
.way,.cut{animation-duration:var(--e);animation-timing-function:linear;animation-delay:calc(var(--a,0) * -1s);animation-iteration-count:1;animation-fill-mode:both}
.cut{animation-timing-function:step-end}
.turn{animation:turn 1s linear calc(var(--a,0) * -1s) 1 both}
.turnb{animation:turnb 1s linear calc(var(--a,0) * -1s) 1 both}
.hS{transform-box:fill-box;transform-origin:right center;animation:hoistS ${HOIST}}
.hO{animation:hoistO ${HOIST}}
.hF{animation:hoistF ${HOIST}}
.hL{animation:hoistL ${HOIST}}
.hG{animation:hoistG ${HOIST}}
.fwave{transform-box:fill-box;transform-origin:right center;${loop('flagwave', 1.9, 'ease-in-out')}}
.wake{fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;opacity:.6;stroke-dasharray:14 5;animation:wflow .9s linear infinite}
.wk>g{transform-box:fill-box;transform-origin:right center}
.bf .wk>g{opacity:0}
.boat{${loop('bob', 3, 'ease-in-out')}}
.foamline{stroke-dasharray:60 60;${loop('lap', 9, 'linear')}}
.halo{${loop('breathe', 8, 'ease-in-out')}}
.raysA{${loop('spin', 400, 'steps(4000)')}}
.raysB{${loop('spin', 560, 'steps(5600)')};animation-direction:reverse}
${LANE_GATES}
.wander{${loop('wander', 11, 'ease-in-out')}}
.wig{${loop('wig', 1.3, 'ease-in-out')}}
.flipA{${loop('flipA', 2.6, 'ease-in-out')}}
.flipB{${loop('flipB', 2.6, 'ease-in-out')}}
.wingf{${loop('wingflap', 3.2, 'ease-in-out')}}
.lpX{${loop('leapX', LEAP_EVERY, 'linear')}}
.lpY{${loop('leapY', LEAP_EVERY, 'linear')}}
.lpR{${loop('leapR', LEAP_EVERY, 'linear')}}
.pod{${loop('pod', LEAP_EVERY * 3, 'linear')}}
.mstep{${loop('mstep', 0.5, 'ease-in-out')}}
.mblink{transform-box:fill-box;transform-origin:center;${loop('mblink', 11, 'linear')}}
.mwave{${loop('mwave', beat(0.45, 1), 'ease-in-out')}}
.mbreathe{transform-box:fill-box;transform-origin:center bottom;${loop('mbreathe', 3.4, 'ease-in-out')}}
.mzz{opacity:0;${loop('mzz', 3.2, 'ease-out')}}
.flame{transform-box:fill-box;transform-origin:center bottom;${loop('flick', 0.7, 'ease-in-out')}}
.fire{opacity:0}
.mbob{${loop('mstep', 2.2, 'ease-in-out')}}
.grass{${loop('grass', 5, 'ease-in-out')}}
.sway{transform-box:fill-box;transform-origin:50% 100%;${loop('grass', 5, 'ease-in-out')}}
.ten{transform-box:fill-box;transform-origin:50% 100%;${loop('ten', 3, 'ease-in-out')}}
.eel{${loop('eel', 13, 'ease-in-out')}}
.working .gcol>*{${loop('shimmer', 1.7, 'ease-in-out')}}
.working .spark use{${loop('sparkle', 2.4, 'ease-in-out')}}
.beacon{${loop('blink', 1.6, 'ease-in-out')}}
.lamp{${loop('twinkle', 3, 'ease-in-out')}}
.fw{transform-box:fill-box;transform-origin:center;opacity:0;animation:burst 1.8s ease-out 4}
.trail{opacity:0;animation:rise .7s ease-in 4}
.fwr{opacity:0;animation:fwr 1.8s ease-out 4}
.ffX{animation:ffX 3s linear calc(var(--f) * 1s) 1 both}
.ffY{animation:ffY 1.5s linear calc(var(--f) * 1s) 2 both}
.ffR{animation:ffR 1.5s linear calc(var(--f) * 1s) 2 both}
.ffs{fill:none;stroke:#fff;stroke-width:1.6;opacity:0;transform-box:fill-box;transform-origin:center;animation:ffs .9s ease-out calc((var(--f) + .1 + var(--k) * 1.4) * 1s) 1}
@media (prefers-color-scheme: dark){
  .sky0{stop-color:#040d1f}.sky1{stop-color:#0b2242}.sky2{stop-color:#173f63}.sky3{stop-color:#2a5a7a}
  .sea0{stop-color:#06223a}.sea1{stop-color:#0a3550}.sea2{stop-color:#0e4c5e}.sea3{stop-color:#156066}.sea4{stop-color:#1f7470}
  .halo0{stop-color:#3d8f88}.halo1{stop-color:#23706c}.halo2{stop-color:#156066}
  .sand0{stop-color:#b8ab8c}.sand1{stop-color:#a29679}.sand2{stop-color:#988d73}
  .roof0{stop-color:#7a6040}.roof1{stop-color:#4f3b25}
  .cl0{stop-color:#5a7290}.cl1{stop-color:#2c4460}
  .col0{stop-color:#c4d6ff}
  .gcol{stroke:#d6e3ff}.glit{opacity:.55}
  .sun,.sunglow{opacity:0}.moon,.stars,.moonglow,.navlamp{opacity:1}
  .far{fill:#16362f}.farsand{fill:#6b6350}.fpa{fill:#12302a}.fvb{fill:#ffcf7a}.frf{fill:#4a3d2e}
  .wall{fill:#5e4630}.wallshade{fill:#4a3624}.deck{fill:#47341f}
  .trunk{fill:#5a4630}.bark{fill:#4a3926}.sh{fill:#000}
  .fa{fill:#173f2a}.fb{fill:#1e4d33}.fc{fill:#123321}.rib{stroke:#0c2618}
  .bush{fill:#173f2a}.bush2{fill:#1e4d33}.leaf{stroke:#173f2a}.flw{fill:#8a4a5c}.flc{fill:#9c8a5a}
  .grass{stroke:#2d4d2a}.grain{fill:#4f4636}.shoal{fill:#2f7f7a}
  .wsb{fill:#1a3344}.wsd{fill:#142a38}#wsp{fill:#6f8fa0}.bio{display:inline}.glint{fill:#8ff6ff}
  .hrl{stroke:#7a6a4c}.hrg{fill:#6b7378}.hrh{fill:#aab3b9}.hrk{stroke:#a6afb5}.hrw{fill:#4e575e}.hmc{fill:#9a8064}.hms{stroke:#6e4a33}.hml{stroke:#8a3f26}.hmo{fill:#93442f}
  .crb{fill:#93442f}.crl{stroke:#6e3424}
  .foam{stroke:#9fc4cc}.wet{fill:#5f8a84}
  .wvs{opacity:.45}
  .gull{stroke:#9fb7cc}
  .shade{fill:#010d14;opacity:.14}
  .tsk{fill:#1c4945}.tsh{fill:#1e3f31}.tsl{fill:#274c37}.tsc{stroke:#133028}.teye{fill:#0a2423}
  .mb{fill:#113845}.mm{fill:#416c7c;opacity:.4}
  .colm{opacity:.45}
  .rbase{fill:#03202b;opacity:.35}.kl{opacity:.16}.sg{stroke:#1c5a44}
  .k1{color:#7a4f63}.k2{color:#7d5a3c}.k3{color:#5a4a7a}.k4{color:#7d7040}.k5{color:#2a6f69}.k6{color:#70393c}.k7{color:#2c4470}.k8{color:#4b6a37}.rk{color:#1b4248}
  .lf{opacity:.55}.beam{opacity:.35}
  .spl{opacity:.55}.fin{fill:#0c1c26}.fwk{opacity:.45}.fcl{opacity:.35}.dol{fill:#1c3447}.dolb{fill:#5f7f95}.dolh{fill:#2a4a60}
  .ff{fill:#1f4666}.ffw{fill:#8fb2cc}
  .sna{fill:#8f914f}.snb{fill:#93a586}.snc{stroke:#2b74aa}.bna{fill:#90aaa9}.bns{stroke:#90aaa9}.bnb{fill:#959c53}
  .ham{fill:#8f8a7c}
  .lit{fill:#ffcf7a;opacity:.95}
  .fire{opacity:1}
  .reflit{opacity:.5}
  .haze{opacity:.2}
}
`

// The fleet's hulls and every boat's bow-on view are drawn once, in the
// defs, and placed with <use>; a crew boat's sail takes its colour from --s.
const CREW_HULL = `<path d="M-26 0H30Q25 9 17 10H-17Q-23 9 -26 0Z" fill="#f6f1e6"/><path d="M-24.5 3.5H27.5" stroke="var(--s)" stroke-width="2.4"/>
<line x1="-3" y1="0" x2="-3" y2="-57" stroke="#5a3b22" stroke-width="1.8"/>
<path d="M-1 -56Q23 -34 27 -5H-1Z" fill="var(--s)"/><path d="M-1 -33Q12 -30 21 -22L24 -14Q12 -22 -1 -24Z" fill="#fff" opacity=".6"/>`
// A fishing boat's lantern is lit, and glows, only after dark.
const SHELL_HULL = `<g transform="scale(-1 1)"><path d="M-30 0Q-34 -10 -42 -17Q-30 -9 -22 -7H22Q30 -7 40 -15Q35 0 26 8H-22Q-28 6 -30 0Z" fill="#5a4632"/><path d="M-27 -1H31" stroke="#e8dcc0" stroke-width="1.6"/>
<rect x="-12" y="-17" width="20" height="10" rx="2" fill="#e8dcc0"/><line x1="16" y1="-7" x2="16" y2="-32" stroke="#3d2f20" stroke-width="2"/>
<g class="navlamp"><circle class="lamp" cx="16" cy="-36" r="13" fill="#ffd76a" opacity=".35"/></g><circle class="lit" cx="16" cy="-36" r="4.6"/></g>`
// Seen bow on, as it comes about: a short deep hull, the mast upright, and
// the sails edge on.
const LEAD_BOW = `<path d="M-12 0H12Q11 10 0 13Q-11 10 -12 0Z" fill="#7a4f2c"/><path d="M-11.4 3.5H11.4" stroke="#f4e3c1" stroke-width="1.6"/>
<line x1="0" y1="0" x2="0" y2="-88" stroke="#5a3b22" stroke-width="2"/><path d="M-1 -72Q-9 -38 -6 -6H-1Z" fill="#fdfdf8"/><path d="M1 -60Q8 -32 6 -6H1Z" fill="#f2c14e"/>`
const CREW_BOW = `<path d="M-8 0H8Q7 8 0 10Q-7 8 -8 0Z" fill="#f6f1e6"/><path d="M-7.6 3.5H7.6" stroke="var(--s)" stroke-width="2.4"/>
<line x1="0" y1="0" x2="0" y2="-57" stroke="#5a3b22" stroke-width="1.8"/><path d="M1 -56Q8 -30 6 -5H1Z" fill="var(--s)"/>`
const SHELL_BOW = `<path d="M-10 -7H10Q9 4 0 8Q-9 4 -10 -7Z" fill="#5a4632"/><rect x="-7" y="-17" width="14" height="10" rx="2" fill="#e8dcc0"/>
<line x1="0" y1="-17" x2="0" y2="-32" stroke="#3d2f20" stroke-width="2"/><g class="navlamp"><circle class="lamp" cx="0" cy="-36" r="13" fill="#ffd76a" opacity=".35"/></g><circle class="lit" cx="0" cy="-36" r="4.6"/>`
// A palm's crown at full size about the top of its trunk: fronds feathered
// into leaflets that sweep towards each tip, and its coconuts. Every palm
// draws a scaled clone of it.
const CROWN = (() => {
  const fronds: [number, number, string][] = [
    [-150, 30, 'fa'], [-120, -40, 'fb'], [-50, -90, 'fa'], [20, -100, 'fb'], [100, -60, 'fa'], [150, 10, 'fb'], [80, 60, 'fc'], [-90, 70, 'fc'],
  ]
  const leaves = fronds
    .map(([ex, ey, cls]) => {
      const droop = 34
      const mx = ex * 0.5
      const my = ey * 0.5 - droop
      const wd = Math.hypot(ex, ey) * 0.17
      const at = (t: number): { x: number; y: number; nx: number; ny: number } => {
        const dx = 2 * (1 - t) * mx + 2 * t * (ex - mx)
        const dy = 2 * (1 - t) * my + 2 * t * (ey - my)
        const d = Math.hypot(dx, dy) || 1
        return { x: 2 * (1 - t) * t * mx + t * t * ex, y: 2 * (1 - t) * t * my + t * t * ey, nx: -dy / d, ny: dx / d }
      }
      const pt = (t: number, side: number, w: number): string => {
        const p = at(Math.min(1, t))
        const width = wd * Math.sin(Math.PI * Math.min(1, t)) ** 0.6 * w * side
        return `${Math.round(p.x + p.nx * width)} ${Math.round(p.y + p.ny * width)}`
      }
      const steps = Array.from({ length: 12 }, (_, i) => (i + 0.5) / 13)
      const upper = steps.map(t => `L${pt(t, 1, 0.45)}L${pt(t + 0.1, 1, 1.1)}`).join('')
      const lower = [...steps].reverse().map(t => `L${pt(t + 0.1, -1, 0.9)}L${pt(t, -1, 0.4)}`).join('')
      return `<path d="M0 0${upper}L${ex} ${ey}${lower}Z" class="${cls}"/><path d="M0 0Q${f(mx)} ${f(my + droop * 0.15)} ${ex} ${ey}" fill="none" class="rib" stroke-width="1.3"/>`
    })
    .join('')
  return `<g id="crown">${leaves}<circle cx="-6" cy="8" r="7" fill="#6b4c2f"/><circle cx="7" cy="9" r="7" fill="#5c4027"/><circle cx="0" cy="14" r="6" fill="#6b4c2f"/></g>`
})()

// A leafy shrub standing on (0, 0), in flower.
const SHRUB = `<g id="shrub"><ellipse cy="1" rx="31" ry="4" class="sh"/><g class="bush"><circle cx="-18" cy="-10" r="13"/><circle cx="0" cy="-17" r="16"/><circle cx="17" cy="-10" r="12"/><circle cx="8" cy="-4" r="10"/><circle cx="-8" cy="-4" r="10"/></g>
<g class="bush2"><circle cx="-15" cy="-15" r="8"/><circle cx="1" cy="-24" r="9"/><circle cx="15" cy="-14" r="6"/></g><path class="leaf" d="M-29 -9l-5 -2M-24 -20l-4 -4M-9 -32l-1 -5M7 -33l3 -4M23 -19l5 -3M29 -6l5 0"/>
<g class="flw"><circle cx="-12" cy="-9" r="2.6"/><circle cx="9" cy="-22" r="2.4"/><circle cx="19" cy="-6" r="2.2"/><circle cx="-3" cy="-1" r="2"/></g><g class="flc"><circle cx="-12" cy="-9" r=".9"/><circle cx="9" cy="-22" r=".9"/><circle cx="19" cy="-6" r=".8"/><circle cx="-3" cy="-1" r=".7"/></g></g>`

// A tuft of beach grass rooted at (0, 0).
const TUFT = '<path id="tuft" class="grass" d="M0 0q-3 -7 -9 -10M0 0q-1 -9 -3 -15M0 0q1 -8 4 -14M0 0q3 -6 9 -8"/>'

// Each dinghy and fishing boat is a clone of these, its shadow on the water
// drawn with its hull, and its wake apart, for a wake only shows under way.
const BOAT_DEFS = `<g id="cH"><ellipse cx="0" cy="13" rx="27" ry="2.6" fill="#000" opacity=".12"/>${CREW_HULL}</g><g id="sH"><ellipse cx="0" cy="9" rx="36" ry="3" fill="#000" opacity=".14"/>${SHELL_HULL}</g><g id="cW"><path class="wake" d="M-28 7q-12 0 -26 4M-25 11q-9 2 -19 6"/><path class="wake bio bwk" d="M-28 7q-12 0 -26 4M-25 11q-9 2 -19 6"/></g><g id="sW"><path class="wake" d="M-40 4q-16 0 -34 5M-36 9q-12 2 -26 8"/><path class="wake bio bwk" d="M-40 4q-16 0 -34 5M-36 9q-12 2 -26 8"/></g><g id="lB">${LEAD_BOW}</g><g id="cB">${CREW_BOW}</g><g id="sB">${SHELL_BOW}</g>`

// The reef's kinds, each drawn once standing on its origin and painted in
// their clone's colour (`currentColor`, set by its class; a kind with shapes
// to fill says `fill="currentColor"` itself, as the engine refuses a
// `use[href]` rule that would say it for all): staghorn,
// brain, sea fan, table, tube sponge, finger and leather corals, a reef rock,
// an anemone with swaying tentacles, a giant clam, a sea urchin, a starfish,
// seagrass and a clownfish.
const REEF_KINDS = `<path id="qa" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" d="M0 0V-13M0 -11Q-3 -21 -9 -29M0 -11Q4 -20 10 -27M-2 -17Q-9 -18 -13 -24M2 -17Q9 -17 14 -21M0 -5Q6 -8 9 -14M0 -6Q-6 -9 -9 -15M-9 -29l-2 -4M10 -27l1.5 -4M-13 -24l-3 -2M14 -21l3 -2"/>
<g id="qb" fill="currentColor"><path d="M-16 0A16 13 0 0 1 16 0Q0 4 -16 0Z"/><path class="kl" stroke-width="1.1" d="M-12 -2Q-10 -7 -5 -8Q0 -11 6 -7Q10 -6 12 -2M-6 -2Q-4 -5 0 -5Q4 -5 5 -2M-13 -5Q-8 -12 0 -12Q5 -12 8 -9"/></g>
<g id="qc" fill="currentColor"><path opacity=".85" d="M0 0C-17 -4 -17 -30 -4 -34C2 -38 15 -32 15 -18C15 -8 8 -2 0 0Z"/><path class="kl" stroke-width=".9" d="M0 0L-8 -30M0 0L3 -34M0 0L11 -24M0 0L-12 -16M-12 -16Q-2 -19 11 -24M-8 -30Q3 -27 13 -14M-4 -33Q2 -24 14 -20"/></g>
<g id="qd" fill="currentColor"><path d="M-3 0L-4 -9H4L3 0Z"/><ellipse cy="-10" rx="20" ry="4"/><ellipse cy="-16" rx="12" ry="3"/><ellipse cy="-11" rx="16" ry="1.6" fill="#fff" opacity=".22"/><ellipse cy="-17" rx="9" ry="1.2" fill="#fff" opacity=".22"/></g>
<g id="qe" fill="currentColor"><g><rect x="-10" y="-20" width="7" height="21" rx="3.5"/><rect x="-2" y="-27" width="8" height="28" rx="4"/><rect x="7" y="-16" width="6" height="17" rx="3"/></g><g opacity=".3"><ellipse cx="-6.5" cy="-19" rx="2.2" ry="1.1"/><ellipse cx="2" cy="-26" rx="2.6" ry="1.3"/><ellipse cx="10" cy="-15" rx="2" ry="1"/></g></g>
<path id="qf" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none" d="M-9 0V-13M-4 0V-21M1 0V-17M6 0V-25M11 0V-11M-4 -14l-4 -4M6 -16l4 -4"/>
<g id="qj" fill="currentColor"><path d="M-2 0V-8H2V0Z"/><path d="M-14 -8Q-13 -17 0 -17Q13 -17 14 -8Q10 -6 7 -9Q3.5 -6 0 -9Q-3.5 -6 -7 -9Q-10 -6 -14 -8Z"/></g>
<g id="qk" fill="currentColor"><path d="M-15 0Q-16 -9 -7 -11Q1 -16 9 -10Q16 -7 15 0Z"/><path d="M-9 -6Q-4 -10 2 -9" class="kl" stroke-width="1.2"/></g>
<g id="qg" fill="currentColor"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M-8 -8q-5 -6 -4 -12M-5 -8q-3 -8 0 -14M-2 -8q-1 -9 3 -14M1 -8q2 -8 6 -12M4 -8q4 -6 9 -9M7 -8q5 -4 9 -4M-8 -7q-6 -2 -9 -6"/><path stroke="#fff" opacity=".5" stroke-width="2.4" d="M-12 -20v0M0 -22v0M5 -22v0M11 -20v0M16 -12v0"/></g><path d="M-8 0C-9 -5 -7 -9 0 -9S9 -5 8 0Z"/><path d="M-6 -6Q0 -8 6 -6" class="kl"/></g>
<g id="qh" fill="currentColor"><path fill="#c9b994" d="M-10 0Q-11 -5 -7 -6H7Q11 -5 10 0Z"/><path d="M-9 -5Q-6 -11 -2 -8Q0 -12 2 -8Q6 -11 9 -5Q4 -3 0 -4Q-4 -3 -9 -5Z"/><path d="M-6 -6.5h0M-2 -7h0M2 -7h0M6 -6.5h0" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/></g>
<g id="qi" stroke="#1d2433" stroke-linecap="round"><path d="M0 -4l-7 -5M0 -4l-3 -9M0 -4l2 -9M0 -4l7 -6M0 -4l9 -1M0 -4l-9 -1"/><circle cy="-3" r="3.6" fill="#2a3246" stroke="none"/></g>
<path id="qm" fill="currentColor" d="M0 -4.6L1.3 -1.6L4.4 -1.4L2 .6L2.7 3.6L0 2L-2.7 3.6L-2 .6L-4.4 -1.4L-1.3 -1.6Z"/>
<path id="ql" class="sg" stroke-width="2.6" stroke-linecap="round" d="M0 0q-6 -9 2 -22M5 0q8 -7 2 -17M-5 0q-10 -6 -7 -15"/>
<linearGradient id="rg" class="rk" x2="0" y2="1"><stop stop-color="currentColor" stop-opacity=".75"/><stop offset="1" stop-color="currentColor" stop-opacity=".35"/></linearGradient>
${inWater('<g id="qn"><path fill="#ff7a1a" d="M6 0Q1 -4 -5 0Q1 4 6 0ZM-4 0l-4 -3v6Z"/><path stroke="#fff" stroke-width="1.2" d="M2.5 -2.4v4.8M-1.5 -2.4v4.8"/></g>', REEF_VEIL)}`

// Every cloud is a clone of one puff, placed and scaled.
const CLOUD = `<g id="cl" fill="url(#cloud)" filter="url(#soft)" opacity=".92"><ellipse rx="110" ry="24"/><ellipse cx="-48" cy="-14" rx="52" ry="30"/><ellipse cx="22" cy="-26" rx="64" ry="42"/><ellipse cx="86" cy="-8" rx="46" ry="26"/><ellipse cx="-96" cy="-2" rx="34" ry="16"/></g>`

// A flying fish, wings spread.
const FLYER = `<path class="ffw" d="M4 -2Q-4 -18 -16 -20Q-8 -10 -4 -1ZM4 2Q-2 12 -12 14Q-6 7 -4 1Z"/><path class="ff" d="M16 0Q6 -5 -10 -1L-18 -7L-15 0L-18 6L-10 1Q6 5 16 0Z"/>`

// One four-pointed star of radius `r`, for the twinkles on the water.
const SPARK = (r: number): string => `<path id="k${r}" d="M0 ${-r * 2}L${r / 2} 0L0 ${r * 2}L${-r / 2} 0ZM${-r * 2} 0L0 ${r / 2}L${r * 2} 0L0 ${-r / 2}Z"/>`

const DEFS = `<defs><g id="cco"><circle r="5" fill="#86b94a"/><circle cx="-1.7" cy="-1.7" r="1.6" fill="#c2e08a" opacity=".7"/><circle cy="-3" r="1.3" fill="#5a7f2b"/></g><g id="cch"><use href="#cco"/><circle cy="-3" r="1.5" fill="#3d2a17"/></g><g id="dsp" fill="#fff"><path d="M-2 0Q-7 -9 -12 -7M-1 -1Q-3 -11 -7 -13M1 -1Q2 -13 5 -14M3 -1Q8 -10 12 -8M4 0Q10 -4 14 -2" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><circle cx="-14" cy="-4" r=".9"/><circle cx="-9" cy="-15" r="1"/><circle cx="7" cy="-17" r="1.1"/><circle cx="15" cy="-10" r=".9"/></g><g id="drg"><ellipse rx="10" ry="2.4" fill="none" stroke="#fff" stroke-width="1.4"/><ellipse rx="6" ry="1.3" fill="#fff" opacity=".5"/></g>
${REEF_KINDS}${inWater(`<g id="sr"><path class="sna" d="M12 0C9 -5 3 -6.5 -3 -5.5Q-1 -8 -6 -7.5L-7 -4L-10 -2L-16 -6L-14 0L-16 6L-10 2L-7 4C-1 6.5 8 5.5 12 0Z"/><path class="snb" d="M11 1C7 4 0 5 -7 3C0 2.6 6 2 11 1Z"/><path class="snc" fill="none" stroke-width=".9" stroke-linecap="round" d="M9 -2.6Q2 -4.4 -7 -2.4M10 -.8Q1 -1.8 -8 -.4M9 1Q2 1 -7 1.4"/><circle cx="8.2" cy="-1.6" r="1" fill="#1b1f22"/></g>`, veilAt(LANES.shoalA.y))}${inWater(`<g id="ss"><path class="bna" d="M9 1C9 -4 5 -8 0 -8.5L-2 -13Q-3 -9 -5 -7C-8 -4 -9 -1 -9 1C-8 5 -3 7.5 2 7C6 6.5 9 4 9 1Z"/><path class="bnb" d="M-8.6 -1L-14 -4.5V6L-8.4 3ZM-6 -6C-8 -4 -8.8 -2 -9 0L-7 -1Z"/><path fill="#26292b" d="M5 -6.2L7 4.4Q5 6.4 2.6 6.9L.2 -8.4Q3 -8 5 -6.2ZM-3.4 -7.6L-6.6 5.6Q-7.6 5 -8.3 3.8L-6 -6.3Z"/><path class="bns" fill="none" stroke-width=".8" stroke-linecap="round" d="M-1.6 -12Q-6 -18 -15 -19"/><circle cx="6.4" cy="-1.2" r=".9" fill="#1b1f22"/></g>`, veilAt(LANES.shoalB.y))}
${CLOUD}<g id="fy">${FLYER}</g>
<linearGradient id="fwg" gradientUnits="userSpaceOnUse" x1="-10" y1="0" x2="-64" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><pattern id="wsp" width="13" height="11" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.8"/><circle cx="9.5" cy="8.5" r="1.4"/></pattern>
${SPARK(2)}${SPARK(3)}${SPARK(4)}
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky0"/><stop offset=".5" class="sky1"/><stop offset=".85" class="sky2"/><stop offset="1" class="sky3"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sea0"/><stop offset=".18" class="sea1"/><stop offset=".45" class="sea2"/><stop offset=".75" class="sea3"/><stop offset="1" class="sea4"/></linearGradient>
<radialGradient id="halo"><stop offset="0" class="halo0"/><stop offset=".45" class="halo1" stop-opacity=".95"/><stop offset=".8" class="halo2" stop-opacity=".45"/><stop offset="1" class="halo2" stop-opacity="0"/></radialGradient>
<radialGradient id="sand" cx=".5" cy=".4" r=".6"><stop offset="0" class="sand0"/><stop offset=".7" class="sand1"/><stop offset="1" class="sand2"/></radialGradient>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="roof0"/><stop offset="1" class="roof1"/></linearGradient>
<linearGradient id="cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cl0"/><stop offset="1" class="cl1"/></linearGradient>
<radialGradient id="sund"><stop offset="0" class="sund0"/><stop offset=".72" class="sund0"/><stop offset="1" class="sund1"/></radialGradient>
<radialGradient id="bloom"><stop offset="0" class="glow0" stop-opacity=".5"/><stop offset=".08" class="glow0" stop-opacity=".36"/><stop offset=".18" class="glow0" stop-opacity=".2"/><stop offset=".32" class="glow0" stop-opacity=".1"/><stop offset=".5" class="glow0" stop-opacity=".05"/><stop offset=".72" class="glow0" stop-opacity=".02"/><stop offset="1" class="glow0" stop-opacity="0"/></radialGradient>
<radialGradient id="corona"><stop offset="0" stop-color="#fffdf0" stop-opacity=".8"/><stop offset=".3" stop-color="#fffdf0" stop-opacity=".5"/><stop offset=".5" stop-color="#fffdf0" stop-opacity=".18"/><stop offset=".75" stop-color="#fffdf0" stop-opacity=".05"/><stop offset="1" stop-color="#fffdf0" stop-opacity="0"/></radialGradient>
<radialGradient id="ray" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="660"><stop offset="0" stop-color="#fff8dc" stop-opacity="0"/><stop offset=".1" stop-color="#fff8dc" stop-opacity=".3"/><stop offset=".4" stop-color="#fff8dc" stop-opacity=".09"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient>
<radialGradient id="moonglow"><stop offset="0" stop-color="#dfe9ff" stop-opacity=".5"/><stop offset=".3" stop-color="#dfe9ff" stop-opacity=".16"/><stop offset="1" stop-color="#dfe9ff" stop-opacity="0"/></radialGradient>
<linearGradient id="column" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="col0" stop-opacity=".38"/><stop offset=".5" class="col0" stop-opacity=".13"/><stop offset="1" class="col0" stop-opacity="0"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".35"/></linearGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="blur6" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
<clipPath id="surf"><rect x="-300" y="-400" width="1000" height="400"/></clipPath>
<clipPath id="hung"><path clip-rule="evenodd" d="M-2000 -2000H4000V3000H-2000ZM${ISLE - 75} 610Q${ISLE - 24} 668 ${ISLE + 23} 616L${ISLE + 23} 622Q${ISLE - 24} 690 ${ISLE - 75} 616Z"/></clipPath>
${BOAT_DEFS}${CROWN}${SHRUB}${TUFT}
<pattern id="grain" width="19" height="13" patternUnits="userSpaceOnUse"><g class="grain"><circle cx="3" cy="4" r=".7"/><circle cx="12" cy="9" r=".6"/><circle cx="16" cy="2" r=".5"/></g></pattern>
<mask id="crescent"><rect x="-60" y="-60" width="120" height="120" fill="#fff"/><circle cx="21" cy="-12" r="41" fill="#000"/></mask>
</defs>`

// Sun rays: thin wedges fading outward, in the sun's own coordinates.
function rays(count: number, salt: number, width: number): string {
  let d = ''
  for (let k = 0; k < count; k++) {
    const a = ((k + rnd(k, salt) * 0.7) / count) * Math.PI * 2
    const half = ((0.5 + rnd(k, salt + 1) * 1.6) * width * Math.PI) / 180
    const len = 300 + rnd(k, salt + 2) * 340
    d += `M0 0L${Math.round(Math.cos(a - half) * len)} ${Math.round(Math.sin(a - half) * len)}L${Math.round(Math.cos(a + half) * len)} ${Math.round(Math.sin(a + half) * len)}Z`
  }
  return `<path d="${d}" fill="url(#ray)"/>`
}

// The light path on the water: glints packed near the horizon, spreading out
// toward the viewer.
// Each glint is a short dash with round ends. Glints that share a beat of
// the shimmer and a thickness are one path, so the column costs little.
const GLITTER_BEATS = 6
const GLITTER_WIDTHS = [2.2, 3.4, 5]
function glitter(): string {
  const paths = new Map<string, string>()
  for (let i = 0; i < 64; i++) {
    const v = Math.pow(rnd(i, 1), 1.5)
    const y = HORIZON + 5 + v * 400
    const half = 22 + (y - HORIZON) * 0.4
    const x = SUN_X + (rnd(i, 2) + rnd(i, 3) - 1) * half
    const rx = (4 + rnd(i, 4) * 12) * (0.55 + v * 1.5)
    const thick = 2 * (0.9 + v * 2)
    const width = GLITTER_WIDTHS.reduce((a, b) => (Math.abs(b - thick) < Math.abs(a - thick) ? b : a))
    const reach = Math.max(0.5, rx * 2 - width)
    const key = `${Math.floor(rnd(i, 5) * GLITTER_BEATS)} ${width}`
    paths.set(key, `${paths.get(key) ?? ''}M${Math.round(x - reach / 2)} ${Math.round(y)}h${Math.round(reach)}`)
  }
  return [...paths].map(([key, d]) => {
    const [beat = '0', width = '2'] = key.split(' ')
    return `<path stroke-width="${width}" d="${d}" style="--d:${f((Number(beat) * 3.4) / GLITTER_BEATS)}"/>`
  }).join('')
}

// One row of wave crests. A tile holds three uneven crests, a pattern repeats
// it along the row, and the row slides by exactly one tile, so the loop has
// no seam.
function waveRow(i: number, y: number, period: number, amp: number, alpha: number, speed: number): string {
  const starts = [0.04 + rnd(i, 3) * 0.06, 0.38 + rnd(i, 4) * 0.08, 0.68 + rnd(i, 5) * 0.06]
  const sizes = [0.2 + rnd(i, 6) * 0.1, 0.13 + rnd(i, 7) * 0.08, 0.16 + rnd(i, 8) * 0.07]
  const top = Math.ceil(amp) + 1
  let d = ''
  for (let k = 0; k < 3; k++) {
    const w = 2 * Math.round((sizes[k]! * period) / 2)
    const a = amp * (1 - k * 0.18)
    d += `M${Math.round(starts[k]! * period)} ${top}q${w / 2} ${f(-a)} ${w} 0q${-w / 2} ${f(-a * 0.15)} ${-w} 0Z`
  }
  // One tick a step, so the row runs on the scene's clock.
  const sweep = beat(period / speed, 1)
  return `<pattern id="wr${i}" width="${period}" height="${top + 1}" y="${y - top}" patternUnits="userSpaceOnUse"><path class="crest" d="${d}"/></pattern><g class="wv" style="--p:${-period}px;--w:${ft(sweep)}s;--kw:${Math.round(sweep * FPS)};--d:${i * 7}"><rect class="swell" style="--d:${f(i * 1.3)}" opacity="${alpha}" fill="url(#wr${i})" x="${-period}" y="${y - top}" width="${W + 2 * period}" height="${top + 1}"/></g>`
}

function waves(): string {
  const rows: [number, number, number, number, number][] = [
    [22, 150, 2.6, 0.3, 5],
    [44, 180, 3, 0.33, 7],
    [72, 230, 3.6, 0.36, 9],
    [108, 290, 4.4, 0.4, 12],
    [152, 360, 5.4, 0.42, 15],
    [206, 440, 6.6, 0.45, 19],
    [272, 530, 8, 0.45, 24],
    [352, 630, 9.5, 0.42, 30],
    [448, 740, 11, 0.38, 37],
  ]
  return rows.map(([dy, period, amp, alpha, speed], i) => waveRow(i, HORIZON + dy, period, amp, alpha, speed)).join('')
}


function cloud(x: number, y: number, s: number): string {
  return `<use href="#cl" transform="translate(${x} ${y}) scale(${s})"/>`
}

function stars(): string {
  const pts: [number, number][] = [
    [120, 60], [260, 140], [410, 50], [560, 170], [700, 80], [860, 40], [980, 150],
    [1120, 70], [1300, 120], [1460, 60], [1540, 190], [340, 260], [760, 240], [1200, 250],
    [60, 300], [620, 320], [1000, 330], [1400, 300], [480, 110], [900, 250], [1380, 210], [200, 220],
  ]
  // Stars of one size that twinkle on one beat are dots of one path.
  const paths = new Map<string, string>()
  pts.forEach(([x, y], i) => {
    const key = `${i % 3} ${Math.floor(((i * 0.37) % 4) * 2) / 2}`
    paths.set(key, `${paths.get(key) ?? ''}M${x} ${y}h0`)
  })
  const dots = [...paths].map(([key, d]) => {
    const [size = '0', beat = '0'] = key.split(' ')
    return `<path class="star" stroke-width="${f(2 * (1.1 + Number(size) * 0.6))}" d="${d}" style="--d:${beat}"/>`
  }).join('')
  return `<g class="stars" fill="none" stroke="#fff" stroke-linecap="round">${dots}<g transform="translate(760 90)"><path class="shoot" d="M0 0l46 -20" stroke-width="2" opacity="0"/></g></g>`
}

// The atoll along the horizon, in two groups with open sea between them: on
// the left, where the conversation leaves the view clear, a large island of
// tall palms over a rolling canopy shares one lagoon with a sandbank and a
// resort's row of water villas on stilts, lit at night; towards the right a
// middling island with a smaller one beside it and a sandbank before them,
// and one small islet further on. Each stands on a rim of white sand in a
// halo of shallow turquoise water. A sandbank, a palm and the islands are
// drawn once and cloned, the palms before the bush so it hides their feet.
const ATOLL = (() => {
  const y = HORIZON
  const at = (id: string, x: number, m = false, dy = y): string => m ? `<use href="#${id}" transform="translate(${x} ${dy})scale(-1 1)"/>` : `<use href="#${id}" x="${x}" y="${dy}"/>`
  // Six villas in a row, each a step to the right of the last.
  const row = (first: string, each: string): string => `${first}${each}${`m8 0${each}`.repeat(5)}`
  return `<defs><g id="sb"><ellipse cy="3" rx="15" ry="2.5" fill="url(#halo)"/><ellipse cy="1" rx="6" ry="1" class="farsand"/></g>
<path id="mp" class="fpa" d="M-.7 0q0-6 2.2-12h1q-1.6 6-1.8 12zM2-12q-3-3-8 3 4-2 8-3zq3-3 8 3-4-2-8-3zq-2-4-6-3 3 2 6 3zq2-4 6-3-3 2-6 3z"/>
<path id="mc" class="far" d="M-18 1c2-4 5-5 9-4 3-2 7-2 10-1 3-1 6 1 8 2 1 1 3 2 3 3z"/>
<g id="ma">${at('mp', -12, false, 1)}${at('mp', -3, false, -2)}${at('mp', 10, true, 0)}<use href="#sb" transform="scale(2.4 1.3)"/><use href="#mc" transform="scale(1.2 1)"/></g>
<g id="mb">${at('mp', -4, false, 0)}${at('mp', 6, true, 1)}<use href="#sb" transform="scale(1.6 1.2)"/><use href="#mc" transform="scale(.7 .9)"/></g>
<g id="ml">${at('mp', -22, false, 2)}${at('mp', -12, true, -3)}${at('mp', -1, false, -5)}${at('mp', 9, true, -1)}${at('mp', 19, false, 2)}<use href="#sb" transform="scale(5.4 1.5)"/><use href="#mc" transform="translate(-8 0)scale(1.6 1.5)"/><use href="#mc" transform="translate(12 0)scale(-1.4 1.1)"/></g></defs>
${at('sb', 905)}<use href="#ma" transform="translate(975 ${y})scale(1.5)"/>${at('mb', 1040, true)}${at('mb', 1186, true)}
<g transform="translate(-111 -129)scale(1.3)"><ellipse cx="368" cy="${y + 4}" rx="80" ry="4" fill="url(#halo)" opacity=".7"/>${at('sb', 422)}${at('ml', 304)}
<path class="fvb" d="${row(`M343 ${y - 3}`, 'h5v4h-1v-2h-3v2h-1z')}"/><path class="frf" d="M330 ${y - 1}h60v1h-60z${row(`M342 ${y - 3}`, 'l3.5-3 3.5 3z')}"/></g>`
})()

// The reef along the near shallows: two bumpy ridges of rock from edge to
// edge, the far one paler through more water, and along the near one's crest
// coral heads packed side by side, each a clone of one of the kinds above
// sized by its depth with its own colour and facing, so no stretch repeats.
// They grow densest at the sides of the view, which the conversation leaves
// clear. Clams, urchins, starfish and seagrass lie on the sand in front, reef
// fish circle the corals, a clownfish weaves through each anemone, and
// a moray eel now and then looks out from behind a rock.
const REEF = (() => {
  const corals: [string, string[]][] = [
    ['qa', ['k1', 'k6', 'k2', 'k3']], ['qb', ['k2', 'k4', 'k5', 'k1']], ['qc', ['k3', 'k1', 'k6']], ['qd', ['k5', 'k4', 'k2']],
    ['qe', ['k4', 'k3', 'k6']], ['qf', ['k8', 'k5', 'k3']], ['qj', ['k4', 'k8', 'k1']],
  ]
  const small: [string, string[]][] = [['qh', ['k7', 'k3']], ['qi', ['']], ['qm', ['k2', 'k6']], ['qk', ['rk']]]
  const depth = (y: number): number => 0.5 + ((y - 840) / 150) * 0.62
  const side = (x: number): boolean => x < 470 || x > 1130
  // Each piece is a clone at a scale in tenths; clones of one scale next to
  // each other in depth share a scaled group and give only where they stand.
  // Anything else (`svg`) goes between the groups.
  type Piece = { y: number; s: number; svg: string }
  const pieces: Piece[] = []
  // A piece that moves does so in a group of its own around the clone, so
  // the move can be paused and seeked (one inside a clone cannot) and turns
  // about the piece's own base.
  const put = (id: string, cls: string, x: number, y: number, size: number, sway = ''): void => {
    const s = Math.max(0.3, Math.round(size * 10) / 10)
    const clone = `<use href="#${id}"${cls ? ` class="${cls}"` : ''} x="${Math.round(x / s)}" y="${Math.round(y / s)}"/>`
    pieces.push({ y, s, svg: sway ? `<g class="${sway}" style="--d:${f(rnd(x, 547) * 5)}">${clone}</g>` : clone })
  }
  // A ridge's crest, bump by bump; its joins are where corals take root.
  const ridge = (salt: number, top: number, amp: number, step: number): { d: string; joins: Point[] } => {
    let x = -20
    let y = top
    let d = `M-20 1070V${top}`
    const joins: Point[] = []
    for (let i = 0; x < 1620; i++) {
      const w = (side(x) ? step : step * 2.6) * (0.7 + rnd(i, salt) * 0.6)
      const next = Math.round(top + (rnd(i, salt + 1) - 0.5) * amp)
      d += `Q${Math.round(x + w / 2)} ${Math.round(Math.min(y, next) - 4 - rnd(i, salt + 2) * amp * 0.6)} ${Math.round(x + w)} ${next}`
      x += w
      y = next
      joins.push({ x, y })
    }
    return { d: `${d}V1070Z`, joins }
  }
  const far = ridge(571, 866, 12, 46)
  const near = ridge(581, 924, 26, 30)
  let n = 0
  let last = ''
  const grow = (at: Point, dy: number, k: number): void => {
    let [id, colours] = corals[Math.floor(rnd(n, 501) * corals.length)]!
    if (id === last) [id, colours] = corals[(corals.findIndex(c => c[0] === id) + 1) % corals.length]!
    last = id
    const y = at.y + dy
    put(id, colours[Math.floor(rnd(n, 505) * colours.length)]!, at.x + (rnd(n, 503) - 0.5) * 10, y, depth(y) * k * (0.85 + rnd(n, 507) * 0.35))
    n++
  }
  far.joins.forEach((at, i) => { if (side(at.x) ? i % 3 : i % 4 === 0) grow(at, 3, 0.9) })
  near.joins.forEach(at => { grow(at, 4, 1.25); if (side(at.x) && rnd(n, 513) < 0.3) grow({ x: at.x + 14, y: at.y }, 14, 1.1) })
  for (let i = 0; i < 13; i++) {
    const x = rnd(i, 521) < 0.75 ? (i % 2 ? rnd(i, 525) * 470 : 1130 + rnd(i, 525) * 470) : 470 + rnd(i, 525) * 660
    const y = 958 + rnd(i, 527) * 36
    const [id, colours] = small[i % small.length]!
    put(id, colours[i % colours.length]!, x, y, depth(y) * (0.8 + rnd(i, 529) * 0.4))
  }
  for (let i = 0; i < 7; i++) {
    const x = i % 3 ? (i % 2 ? rnd(i, 543) * 470 : 1130 + rnd(i, 543) * 470) : 470 + rnd(i, 543) * 660
    const y = 950 + rnd(i, 545) * 40
    put('ql', '', x, y, depth(y), 'sway')
  }
  const fish = (i: number, href: string, cx: number, cy: number, range: number, rise: number, cls: string, size: number): string =>
    `<g transform="translate(${cx} ${cy})" style="--r:${range}px;--q:${rise}px;${sweepOf(beat(5 + rnd(i, 551) * 7, SWEEP_TICKS))};--d:${f(rnd(i, 553) * 13)}"><g class="ox"><g class="oy"><g class="of"><use href="#${href}"${cls ? ` class="${cls}"` : ''}${size === 1 ? '' : ` transform="scale(${size})"`}/></g></g></g></g>`
  const nearest = (x: number): Point => near.joins.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a))
  // Two anemones on the near crest, each with a clownfish.
  for (const [x, cls] of [[150, 'k1'], [1410, 'k3']] as [number, string][]) {
    const at = nearest(x)
    const y = at.y + 16
    put('qg', cls, at.x, y, 1.35, 'ten')
    pieces.push({ y: y + 0.5, s: 0, svg: fish(at.x, 'qn', Math.round(at.x), y - 20, 12, 4, '', 1.1) })
  }
  const den = nearest(330)
  pieces.push({ y: den.y + 18, s: 0, svg: `<g transform="translate(${Math.round(den.x)} ${den.y + 18})"><g class="eel"><path fill="#8a9a3c" d="M-3 -6Q-6 -16 0 -24Q4 -28 9 -26Q12 -24 10 -21Q6 -21 5 -17Q3 -12 4 -6Z"/><circle cx="6.5" cy="-24.5" r="1" fill="#141a10"/></g><use href="#qk" class="rk" transform="scale(1.5)"/></g>` })
  // In depth order to within a few pixels, and by scale within that, so
  // runs of one scale are long.
  pieces.sort((a, b) => Math.round(a.y / 14) - Math.round(b.y / 14) || a.s - b.s || a.y - b.y)
  const paint = (list: Piece[]): string => {
    let out = ''
    let open = 0
    for (const p of list) {
      if (p.s !== open) out += `${open ? '</g>' : ''}${p.s ? `<g transform="scale(${p.s})">` : ''}`
      open = p.s
      out += p.svg
    }
    return open ? `${out}</g>` : out
  }
  const behind = paint(pieces.filter(p => p.y < 900))
  const before = paint(pieces.filter(p => p.y >= 900))
  // Reef fish: some over the far ridge, some about the near crest.
  // More reef life, left out of a plain scene: butterflyfish, angelfish, a
  // parrotfish and a pufferfish about the corals, schools of blue tangs,
  // humbug damsels and clownfish swimming to and fro along the reef, an
  // octopus on the crest and a stingray on the sand. Each fish of a school
  // keeps the school's route and pace but runs a little ahead of or behind
  // the others and bobs on its own, so the school stretches and closes up as
  // it goes and its fish turn about one after another.
  const troop = (k: number, id: string, x: number, y: number, range: number): string => {
    let fry = ''
    for (let i = 0; i < 5; i++) fry += `<g style="--d:${Math.round(k * 70 + rnd(i, 597 + k) * 40) / 10}"><g class="of"><use href="#${id}" y="${Math.round((rnd(i, 593 + k) - 0.5) * 24)}"/></g></g>`
    return `<g class="sc" transform="translate(${x} ${y})" style="--r:${range}px;${sweepOf(beat(20 + rnd(k, 595) * 8, SWEEP_TICKS))}">${fry}</g>`
  }
  // A creature placed by a transform moves in a group inside it: an animated
  // transform would replace the placing one.
  const lone = (id: string, x: number, y: number, s: number, sway = ''): string =>
    `<g transform="translate(${x} ${y}) scale(${s})">${sway ? `<g class="${sway}"><use href="#${id}"/></g>` : `<use href="#${id}"/>`}</g>`
  const crest = (x: number): Point => nearest(x)
  const octopus = crest(1290)
  const farLife = troop(1, 'qz', 320, 858, 150) + fish(611, 'qo', 1330, 878, 46, 6, '', 1) + fish(612, 'qp', 80, 876, 36, 8, '', 1)
  const nearLife = troop(2, 'qt', 1330, 886, 140) + troop(3, 'qn', 560, 910, 120) + fish(613, 'qr', 430, 905, 60, 6, '', 1.1) + fish(615, 'qp', 1480, 905, 40, 7, '', 1.1) + fish(616, 'qv', 1190, 915, 30, 5, '', 1) +
    lone('qs', Math.round(octopus.x), octopus.y + 12, 1.2, 'ten') + lone('qu', 540, 986, 1.2)
  const lift = (inner: string): string => `<g transform="translate(0 -70)">${inner}</g>`
  return {
    far: lift(`<path class="rk" fill="currentColor" opacity=".3" d="${far.d}"/><g opacity=".8">${behind}</g>`),
    near: lift(`<path fill="url(#rg)" d="${near.d}"/>${before}`),
    farLife: lift(farLife),
    nearLife: lift(nearLife),
  }
})()

// The shapes of the reef's other life and the lagoon's, wanted only where
// they are shown: fish facing right, the octopus, stingray and eagle ray,
// and the fade of the light shafts. Their colours are attributes only, the
// same by night: any class rule colouring these shapes, by day or by night,
// stopped every animation in the desktop app.
const LIFE_KINDS = `<defs>${inWater(`<g id="qo"><path fill="#ffd23f" d="M7 0C5 -6 -3 -7 -6 -2L-9 -4V4L-6 2C-3 7 5 6 7 0Z"/><path stroke="#2a2a2a" stroke-width="1.5" d="M3.5 -4.6V4.4"/><circle cx="5" cy="-.8" r=".7" fill="#2a2a2a"/></g>
<g id="qp"><path fill="#3f72e0" d="M8 0Q4 -5 -2 -4L-5 -12Q-6 -5 -6 -2L-10 -4V4L-6 2Q-6 5 -5 12L-2 4Q4 5 8 0Z"/><path stroke="#ffd23f" stroke-width="1.2" d="M3 -3.6V3.6M-1 -4V4"/></g>
<g id="qr"><path fill="#33c2a6" d="M12 0Q8 -6 -3 -5Q-8 -4 -10 0Q-8 4 -3 5Q8 6 12 0ZM-9 0L-15 -5V5Z"/><path stroke="#ff8fb0" fill="none" stroke-width="1.4" d="M8 -3Q11 0 8 3M-2 -4Q0 0 -2 4"/></g>
<g id="qv"><circle fill="#e9d79a" r="5.5"/><path fill="#e9d79a" d="M-4 0L-9 -3V3Z"/><path fill="#8a7a4a" d="M-2 -3h1v1h-1zM1 -4h1v1h-1zM-3 1h1v1h-1zM2 1h1v1h-1z"/><circle cx="3" cy="-1.5" r=".9" fill="#222"/></g>
<g id="qs"><path stroke="#d9663f" fill="none" stroke-width="2.4" stroke-linecap="round" d="M-4 -5Q-11 -3 -12 2M-2 -4Q-6 1 -4 4M2 -4Q6 1 4 4M4 -5Q11 -3 12 2"/><path fill="#e0703f" d="M-6 -5Q-7 -16 0 -17Q7 -16 6 -5Q0 -2 -6 -5Z"/><circle cx="-2.4" cy="-9" r="1" fill="#1a1a1a"/><circle cx="2.4" cy="-9" r="1" fill="#1a1a1a"/></g>
<g id="qt"><path fill="#2f6fe0" d="M6 0C4 -4 -2 -5 -5 -2V2C-2 5 4 4 6 0Z"/><path fill="#ffd23f" d="M-5 -2L-9 -4V4L-5 2Z"/><path fill="none" stroke="#14213d" d="M3 -2Q-1 -3 -4 0Q-1 1 2 1"/></g>
<g id="qz"><path fill="#f4f6f8" d="M6 0C4 -5 -3 -5 -5 -1L-8 -3V3L-5 1C-3 5 4 5 6 0Z"/><path stroke="#1d1d1d" stroke-width="1.6" d="M3 -3.4V3.4M-1 -4V4M-5 -1.6V1.6"/></g>
<g id="qu" fill="#8e9aa0"><path d="M0 -4Q10 -4 15 0Q9 3 0 3Q-9 3 -15 0Q-10 -4 0 -4Z"/><path stroke="#8e9aa0" fill="none" stroke-width="1.2" d="M-14 0Q-22 1 -28 -1"/></g>
<g id="qw" fill="#45606e"><path d="M10 0Q4 -3 0 -3Q-6 -14 -14 -16Q-9 -8 -8 -2Q-10 0 -8 2Q-9 8 -14 16Q-6 14 0 3Q4 3 10 0Z"/><path stroke="#45606e" fill="none" d="M-8 0H-34"/><path fill="#fff" opacity=".7" d="M-4 -6h1.4v1.4h-1.4zM-6 5h1.4v1.4h-1.4zM-9 -10h1.4v1.4h-1.4zM-3 1h1.4v1.4h-1.4z"/></g>
`, REEF_VEIL)}<linearGradient id="lb" x2="0" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`

// Shafts of light slanting down through the water, over the lagoon and the
// swimmers in it alike, so they are seen in the water rather than on it.
const BEAMS = '<g class="lf"><g class="beam"><path class="halo" fill="url(#lb)" d="M30 560h50l110 250h-60ZM262 560h24l90 230h-34ZM610 560h44l96 220h-54Z"/><path class="halo" style="--d:4" fill="url(#lb)" d="M150 560h30l84 240h-40ZM410 560h56l104 240h-70ZM840 560h28l80 210h-34Z"/></g></g>'

// The open lagoon between the villas and the reef, left out of a plain scene:
// a few small coral heads on the bottom further out, paler for the water over them, and now and then a spotted eagle ray gliding by.
const LAGOON = (() => {
  const corals = ['qa k6', 'qb k4', 'qc k3', 'qf k8', 'qa k1', 'qd k5', 'qb k2', 'qe k6', 'qj k4', 'qc k1']
  const head = (x: number, y: number, s: number, k: number): string => {
    // Its corals share one scale and give only where they stand.
    let out = ''
    for (let i = 0; i < 4; i++) {
      const [id, cls] = corals[(k * 3 + i) % corals.length]!.split(' ')
      out += `<use href="#${id}" class="${cls}" x="${-36 + i * 24 + Math.round((rnd(i, 601 + k) - 0.5) * 9)}" y="${-18 - Math.round(rnd(i, 605 + k) * 12)}"/>`
    }
    return `<g transform="translate(${x} ${y}) scale(${s})" opacity=".72"><use href="#qk" class="rk" transform="scale(2.4 1.8)"/><g transform="scale(.65)">${out}</g></g>`
  }
  return `<g class="lf">${head(250, 738, 0.95, 1)}${head(700, 734, 0.9, 3)}${head(960, 758, 1.15, 4)}${head(70, 776, 1.35, 0)}${head(470, 772, 1.3, 2)}</g>`
})()



// A water villa standing on the boardwalk: its deck is level with the walk,
// a strip of veranda with a rail on the left, and a ladder down into the sea
// at the right. `x` is its middle and `y` the top of the walk.
function bungalow(x: number, y: number, s: number): string {
  let strands = ''
  for (let i = -5; i <= 5; i++) {
    strands += `M0 -80L${i * 12} -32`
  }
  return `<g transform="translate(${x} ${y}) scale(${s})">
<path class="post" stroke-width="4" d="M-67 6v24M-24 6v26M24 6v26M67 6v24"/>
<rect x="-72" width="144" height="7" rx="1.5" class="deck"/>
<path class="post" stroke-width="1.6" fill="none" d="M-72 0v-13h24v13M-60 -13v13"/>
<rect x="-46" y="-38" width="92" height="38" class="wall"/><rect x="18" y="-38" width="28" height="38" class="wallshade"/>
<rect x="-34" y="-29" width="22" height="16" rx="2" class="lit"/><rect x="-4" y="-31" width="16" height="31" rx="2" class="lit"/>
<path d="M-70 -34L0 -84L70 -34Q0 -26 -70 -34Z" fill="url(#roof)"/><path d="${strands}" fill="none" stroke="#8a6234" opacity=".45"/>
<path class="post" stroke-width="2" d="M48 3v38M60 3v38M48 13h12M48 23h12M48 33h12"/>
</g>`
}

// A palm rooted at (x, y), `s` times the crown's size, its top `lean` to the
// side; `flip` mirrors its crown so no two palms look alike.
function palm(x: number, y: number, s: number, lean: number, phase: number, flip = false): string {
  const tx = x + lean * s
  const ty = y - 190 * s
  let rings = ''
  for (let i = 1; i < 9; i++) {
    const t = i / 9
    const rx = x + lean * s * t * t
    const ry = y - 190 * s * t
    rings += `M${f(rx - 7 * s)} ${f(ry)}L${f(rx + 7 * s)} ${f(ry + 3 * s)}`
  }
  const bend = x + lean * s * 0.2
  return `<ellipse cx="${x + 4}" cy="${y + 2}" rx="${f(18 * s)}" ry="3" class="sh"/><g class="palm" style="transform-origin:${x}px ${y}px;--d:${phase}">
<path d="M${f(x - 9 * s)} ${y}Q${f(bend)} ${f(y - 100 * s)} ${f(tx - 5 * s)} ${f(ty)}L${f(tx + 5 * s)} ${f(ty)}Q${f(bend + 14 * s)} ${f(y - 100 * s)} ${f(x + 9 * s)} ${y}Z" class="trunk"/><path d="M${f(x + 3 * s)} ${y}Q${f(bend + 9 * s)} ${f(y - 100 * s)} ${f(tx + 2 * s)} ${f(ty)}L${f(tx + 5 * s)} ${f(ty)}Q${f(bend + 14 * s)} ${f(y - 100 * s)} ${f(x + 9 * s)} ${y}Z" class="bark"/><path d="${rings}" class="ring" stroke-width="${f(1.4 * s)}"/>
<use href="#crown" transform="translate(${f(tx)} ${f(ty)}) scale(${flip ? -s : s} ${s})"/></g>`
}

// Where tufts grow: along the back of the sand, where they stand against the
// water behind, and about the shrubs.
const TUFTS: [number, number, number][] = [
  [1232, 676, 0.8], [1256, 667, 1], [1338, 656, 0.9], [1352, 655, 0.7], [1488, 653, 1], [1503, 652, 0.75], [1626, 651, 0.9], [1306, 705, 0.8], [1476, 702, 0.7],
]

// Where the shark's dorsal fin cuts the water.
const FIN_LANE = HORIZON + 112

// Four-pointed twinkles on the water, clones of three sizes of one star,
// drawn with the waves so that the villas, the island and every boat cover
// them. None lies just behind the dorsal fin's lane: the fin is drawn with
// the swimmers, under the waves, and a twinkle there would show on it.
function sparkles(): string {
  let out = ''
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rnd(i, 11) * W)
    const drawn = HORIZON + 30 + Math.floor(rnd(i, 12) * (H - HORIZON - 60))
    const y = drawn > FIN_LANE - 40 && drawn <= FIN_LANE ? drawn + 44 : drawn
    out += `<g transform="translate(${x} ${y})"><use href="#k${2 + (i % 3)}" style="--d:${f(rnd(i, 13) * 5)}"/></g>`
  }
  return `<g class="spark glint">${out}</g>`
}

// The three kinds of boat, each drawn heading right around the middle of its
// waterline: the main agent's two-sailed lead boat, a subagent's dinghy under one
// bright sail, and a fishing boat with its lamp lit for a background shell.
const FLAG_TINT: Record<Signal, string> = { none: '#1d4f91', permission: '#ff8f1f', question: '#8b6cff', plan: '#ff5fa8', error: '#e5352b' }
const LAMP_TINT: Record<Signal, string> = { ...FLAG_TINT, none: '#ffe9a6' }

// The lead boat carries the mascot while the agent works, and tells the person
// the agent needs them: its pennant, which streams aft in the wind of the
// boat's way, grows into a flag in the signal's colour
// and a patch of that colour spreads on the water under it; by night its
// masthead lamp takes the colour too. One signal gives way to the next over
// HOIST_S. The attributes hold the settled look, and the animations run from
// the look before it.
function leadBoat(flag: Flag, wake = ''): string {
  const { from, to } = flag
  const size = (signal: Signal): number => (signal === 'none' ? 1 : 2.6)
  const shown = (signal: Signal): number => (signal === 'none' ? 0 : 1)
  // The patch on the water keeps the signal's colour while it fades in or out.
  const patch = (signal: Signal, other: Signal): string => FLAG_TINT[signal === 'none' ? other : signal]
  const vars = [
    `--h:${f(Math.min(flag.age, HOIST_S))}`,
    `--f0:${FLAG_TINT[from]};--f1:${FLAG_TINT[to]}`,
    `--l0:${LAMP_TINT[from]};--l1:${LAMP_TINT[to]}`,
    `--g0:${patch(from, to)};--g1:${patch(to, from)}`,
    `--s0:${size(from)};--s1:${size(to)}`,
    `--o0:${shown(from)};--o1:${shown(to)}`,
  ].join(';')
  const glow = [[84, 17, 0.13], [60, 12, 0.16], [38, 8, 0.2]]
    .map(([rx, ry, alpha]) => `<ellipse class="hG" cx="0" cy="10" rx="${rx}" ry="${ry}" fill="${patch(to, from)}" opacity="${alpha}"/>`)
    .join('')
  return `<g style="${vars}"><g class="hO" opacity="${shown(to)}">${glow}</g>
<ellipse cx="0" cy="16" rx="34" ry="3" fill="#000" opacity=".12"/><g class="wk"><g ${wake}><path fill="#fff" opacity=".85" d="M-28 9.5Q-70 10 -112 15Q-70 14 -28 13.5ZM-30 13Q-60 16 -94 23Q-60 17.5 -30 15Z"/><path class="wake bio bwk" d="M-38 8q-16 0 -34 5M-34 13q-12 2 -26 8"/></g><g ${wake}><path fill="#fff" opacity=".9" d="M24 10Q32 4 39 9Q33 12.5 24 12.5Z"/></g></g>
<path d="M-36 0L36 0Q30 12 22 13L-22 13Q-30 12 -36 0Z" fill="#7a4f2c"/><path d="M-34 3.5H34" stroke="#f4e3c1" stroke-width="1.6"/>
<line x1="0" y1="0" x2="0" y2="-88" stroke="#5a3b22" stroke-width="2"/>
<path d="M-2 -72Q-30 -36 -38 -6L-2 -6Z" fill="#fdfdf8"/><path d="M2 -60Q22 -32 30 -6L2 -6Z" fill="#f2c14e"/>
<g class="fwave"><g class="hS" transform="translate(-1 -82) scale(${size(to)}) translate(1 82)"><path class="hF" d="M-1 -87H-16L-12 -82L-16 -77H-1Z" fill="${FLAG_TINT[to]}"/></g></g>
<g class="navlamp"><g class="hO" opacity="${shown(to)}"><g class="beacon"><circle class="hL" cx="0" cy="-91" r="17" fill="${LAMP_TINT[to]}" opacity=".4"/></g></g>
<circle class="hL" cx="0" cy="-91" r="9" fill="${LAMP_TINT[to]}" opacity=".3"/><circle class="hL" cx="0" cy="-91" r="4.4" fill="${LAMP_TINT[to]}"/></g></g>`
}

const CREW_SAILS = ['#ef6f5e', '#2bb8a6', '#8b7bff', '#ff9f43', '#3d9be9']

function crewBoat(sail: string, wake: string): string {
  return `<g class="wk"><g ${wake}><use href="#cW"/></g></g><use href="#cH" style="--s:${sail}"/>`
}

const shellBoat = (wake: string): string => `<g class="wk"><g ${wake}><use href="#sW"/></g></g><use href="#sH"/>`

function sailOf(boat: Boat): string {
  return CREW_SAILS[boat.slot % CREW_SAILS.length] ?? '#ef6f5e'
}

// A boat of `boat`'s kind seen bow on, at the scale of its route; `turning`
// holds the attributes that widen it as the boat comes about.
function bowOf(boat: Boat, scale: number, turning: string): string {
  const view = boat.kind === 'lead' ? '#lB' : boat.kind === 'crew' ? `#cB" style="--s:${sailOf(boat)}` : '#sB'
  const bow = `<g class="boat"><use href="${view}"/></g>`
  return `<g ${turning}>${scale === 1 ? bow : `<g transform="scale(${scale})">${bow}</g>`}</g>`
}

// The mascot at the stern of the lead boat, at the scale of its route. It is
// not turned with the boat: as the boat comes about it keeps facing out and
// the deck swings round under it (`shift` holds the attributes that move it
// from one end of the deck to the other). `captain` holds the attributes that
// time its coming aboard or going ashore, and `figure` is the mascot itself.
function crewOf(figure: string, scale: number, captain: string, shift: string): string {
  return `<g transform="scale(${scale})"><g class="boat"><g ${captain}><g ${shift}><g transform="scale(1.7)">${figure}</g></g></g></g></g>`
}

// A boat of `boat`'s kind. `wake` holds the attributes of its wake: out on a
// circuit the wake is hidden unless they say otherwise.
function hullOf(boat: Boat, flag: Flag, wake = ''): string {
  return boat.kind === 'lead' ? leadBoat(flag, wake) : boat.kind === 'crew' ? crewBoat(sailOf(boat), wake) : shellBoat(wake)
}

// The times across `span` at which a boat's way in or out is keyed. The way
// is sampled densely, then thinned to the fewest keys that keep every sample
// within `tolerance` of the straight runs between them. Each scene keys a way
// alike, so a redraw takes a boat up where the scene before left it, and a
// straight stretch costs two keys however long it is.
const KEY_STEP_S = 0.1
function keyTimes(span: number, valuesAt: (at: number) => readonly number[], tolerance: number): number[] {
  const count = Math.max(1, Math.ceil(span / KEY_STEP_S))
  const times = Array.from({ length: count + 1 }, (_, i) => (i / count) * span)
  const values = times.map(valuesAt)
  const kept = [0, count]
  const thin = (a: number, b: number): void => {
    const [from, to] = [values[a] ?? [], values[b] ?? []]
    let worst = tolerance
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const s = (i - a) / (b - a)
      const off = Math.max(0, ...(values[i] ?? []).map((v, d) => Math.abs(v - ((from[d] ?? 0) + ((to[d] ?? 0) - (from[d] ?? 0)) * s))))
      if (off > worst) {
        worst = off
        at = i
      }
    }
    if (at >= 0) {
      kept.push(at)
      thin(a, at)
      thin(at, b)
    }
  }
  thin(0, count)
  return kept.sort((x, y) => x - y).map(i => times[i] ?? 0)
}

// How far keys may stray from a boat's way, in px: further in a plain scene,
// which must stay small.
function toleranceFor(isPlain: boolean): number {
  return isPlain ? 3.5 : 1
}

// How clearly a boat shows through the haze over the horizon at height `y`.
function clearAt(y: number): number {
  return Math.max(0, Math.min(1, (y - HORIZON_Y - 4) / 36))
}

// Keyframes that carry a group through `stops`, each `p` of the way through.
function keyframes(name: string, stops: readonly { p: number; x: number; y: number }[]): string {
  return `@keyframes ${name}{${stops.map(s => `${f(s.p * 100)}%{transform:translate(${Math.round(s.x)}px,${Math.round(s.y)}px)}`).join('')}}`
}

// A cubic-bezier timing function for `curve`, by its CSS name when it has one.
function timing(curve: readonly number[]): string {
  const name = Object.keys(NAMED).find(key => NAMED[key]?.every((v, i) => v === curve[i]) === true && curve.length === 4)
  return name ?? `cubic-bezier(${curve.join()})`
}

// Keyframes that carry a group sideways from `a` to `b` on `curve`.
function glide(name: string, a: number, b: number, curve: readonly number[]): string {
  return `@keyframes ${name}{0%{transform:translateX(${Math.round(a)}px);animation-timing-function:${timing(curve)}}100%{transform:translateX(${Math.round(b)}px)}}`
}

// Keyframes that size a boat to how far off it is at each step, relative to
// the size it was drawn at, and, for a boat out on the open sea, let it come
// up out of the haze at the horizon and sink back into it. None when the
// boat keeps one depth.
function sizing(name: string, stops: readonly { p: number; k: number; y: number }[]): string {
  const fading = stops.some(s => clearAt(s.y) < 1)
  if (!fading && stops.every(s => Math.abs(s.k - 1) < 0.02)) {
    return ''
  }
  const seen = (y: number): string => (fading ? `;opacity:${f(clearAt(y))}` : '')
  return `@keyframes ${name}{${stops.map(s => `${f(s.p * 100)}%{transform:scale(${Math.round(s.k * 1000) / 1000})${seen(s.y)}}`).join('')}}`
}

// A boat's size and haze as its key values: a hundredth of its size is about
// half a pixel on a dinghy, and a fortieth of its haze about as plain.
function sizeKeys(k: number, y: number): number[] {
  return [k * 60, clearAt(y) * 40]
}

// One boat at `seconds` on the clock, and the keyframes of its own it needs.
// Its motion is a function of its age, so a redraw finds it where it was. Out
// on its circuit it rounds the ellipse and comes about at each end; while it
// is on its way in, what separates that way from the circuit is added on top
// and runs down to nothing. Called home, it turns from where it was and
// follows its way out.
function vessel(boat: Boat, seconds: number, flag: Flag, tolerance: number): { svg: string; css: string } {
  const route = routeOf(boat)
  const hull = `<g class="boat">${hullOf(boat, flag)}</g>`
  const bob = `--d:${f(boat.slot * 0.7)}`
  const name = `${boat.kind}${boat.slot}`
  if (boat.gone !== undefined) {
    const gone = boat.gone
    const span = leaveSeconds(boat)
    // Sideways it glides on one curve; up and down it follows its lane.
    const from = fixAt(boat, (gone - boat.born) / 1000)
    const straight = route.isFar
    const placeAt = (t: number): Point => whereabouts(boat, gone + t * 1000)
    const times = keyTimes(span, t => { const p = placeAt(t); return [straight ? p.x : 0, p.y, ...sizeKeys(depthScale(p.y) / depthScale(from.y), p.y)] }, tolerance)
    const way = times.map(t => ({ p: t / span, ...placeAt(t) }))
    const end = placeAt(span)
    const heading = boat.from === 'L' ? 1 : -1
    const a = f3(seconds - gone / 1000)
    // It comes about from however far round its circuit had turned it: the
    // turn is joined where its side view is as wide, and faces as, it was.
    const lap = ((((gone - boat.born) / 1000 + lapStart(boat)) / route.seconds) % 1 + 1) % 1
    const facing = facingAt(LAP_FACING, lap) * heading
    const into = `style="--a:${f3(seconds - gone / 1000 + (facing + 1) / 2)}"`
    const turned = facing > 0.999 ? hull : `<g class="turn" ${into}>${hull}</g>${bowOf(boat, 1, `class="turnb" ${into}`)}`
    // Out to sea it heads for the horizon on a straight line that the eye
    // foreshortens, so its sideways travel keeps step with its lane's.
    const sized = sizing(`${name}os`, way.map(w => ({ p: w.p, k: depthScale(w.y) / depthScale(from.y), y: w.y })))
    // The groups inside the outermost take its timing, which they inherit.
    const shrink = sized === '' ? turned : `<g class="way" style="animation-name:${name}os">${turned}</g>`
    return {
      css: glide(`${name}ox`, from.x, straight ? from.x : end.x, LEAVE_X) + keyframes(`${name}out`, way.map(w => ({ p: w.p, x: straight ? w.x - from.x : 0, y: w.y }))) + sized,
      svg: `<g class="way" transform="translate(${f(from.x)} 0)" style="animation-name:${name}ox;--e:${span}s;--a:${a}"><g class="way" transform="translate(0 ${f(from.y)})" style="animation-name:${name}out;${bob}">
<g transform="scale(${f3(heading * sizeOn(boat, from))} ${f3(sizeOn(boat, from))})">${shrink}</g></g></g>`,
    }
  }
  const age = seconds - boat.born / 1000
  const span = enterSeconds(boat)
  // On its way in from the edge its wake trails it, and dies away as it
  // settles onto its circuit.
  // On its way in, every group inside the outermost takes that one's timing,
  // which it inherits.
  const fading = age < span ? 'class="way" style="animation-name:wfade"' : ''
  const isComing = age < span
  // What separates its way in from the circuit: sideways, the run from the
  // edge to where it joins, glided on one curve, and the circuit's own drift
  // over that time (or, out at sea, its whole sideways way); up and down, its
  // lane's; and how much nearer or further off than its circuit it is.
  const join = lapAt(boat, span)
  const apartAt = (at: number): { x: number; y: number; k: number; seen: number } => {
    const fix = fixAt(boat, at)
    const round = lapAt(boat, at)
    return { x: (route.isFar ? fix.x : join.x) - round.x, y: fix.y - round.y, k: depthScale(fix.y) / depthScale(round.y), seen: fix.y }
  }
  const times = isComing ? keyTimes(span, at => { const a = apartAt(at); return [a.x, a.y, ...sizeKeys(a.k, a.seen)] }, tolerance) : []
  const apart = times.map(at => ({ p: at / span, ...apartAt(at) }))
  const sized = sizing(`${name}is`, apart.map(a => ({ p: a.p, k: a.k, y: a.seen })))
  // A roaming boat drifts near and far on its own beat, sized as it goes.
  const roaming = route.drift !== undefined
  const size = roaming ? 1 : route.scale
  const boat0 = `<g class="bf">${size === 1 ? '' : `<g transform="scale(${size})">`}<g class="boat">${hullOf(boat, flag, fading)}</g>${size === 1 ? '' : '</g>'}</g>${bowOf(boat, size, 'class="bw"')}`
  const grown = sized === '' ? boat0 : `<g class="way" style="animation-name:${name}is">${boat0}</g>`
  const drift = roaming ? `;${driftOf(route.drift ?? DRIFT_TICKS / FPS)};--c:${f3(age + lapStart(boat) + route.driftFrom * (route.drift ?? 0))};--z0:${sizesOf(boat)[0]};--z1:${sizesOf(boat)[1]}` : ''
  const lap = `<g style="${sweepOf(route.seconds)};--b:${f3(age + lapStart(boat))};--r:${route.rx}px;--q:${route.ry}px;${bob}${drift}" transform="translate(${route.cx} ${route.cy})">
<g class="bx">${roaming ? roamed(boat, f3(age + lapStart(boat)), grown) : `<g class="by">${grown}</g>`}</g></g>`
  if (!isComing) {
    return { svg: lap, css: '' }
  }
  const edge = fixAt(boat, 0)
  const a = `--e:${span}s;--a:${f3(age)}`
  return {
    css: (route.isFar ? '' : glide(`${name}ix`, edge.x - join.x, 0, ENTER_X)) + keyframes(`${name}in`, apart) + sized,
    svg: route.isFar
      ? `<g class="way" style="animation-name:${name}in;${a}">${lap}</g>`
      : `<g class="way" style="animation-name:${name}ix;${a}"><g class="way" style="animation-name:${name}in">${lap}</g></g>`,
  }
}

// What carries a boat about its roam inside its sweep (`bx`): its drift near
// and far (`bv`), and its size with it (`bz`), on the clock its outermost
// group sets. On a slanting stretch the sweep also carries it out and back
// with its size, on the sweep's own clock (`sweep`): the moves come before
// the sizes, which would otherwise shrink them.
function roamed(boat: Boat, sweep: string, inner: string): string {
  const r = routeOf(boat)
  if (r.tilt === 0) {
    return `<g class="bv"><g class="bz">${inner}</g></g>`
  }
  const [left, right] = acrossOf(boat)
  const [far, near] = sizesOf(boat)
  return `<g class="bv"><g class="bv" style="${driftOf(r.seconds)};--c:${sweep};--q:${-r.tilt}px;--z0:${left};--z1:${right}"><g class="bz"><g class="bz" style="${driftOf(r.drift ?? DRIFT_TICKS / FPS)};--c:${f3(Number(sweep) + r.driftFrom * (r.drift ?? 0))};--z0:${far};--z1:${near}">${inner}</g></g></g></g>`
}

// What tells a boat apart from every other that is or was out.
export function boatTag(boat: Boat): string {
  return `${boat.kind}${boat.slot}@${boat.born}`
}

// Where a boat is at a second on the clock, and half its width there; none
// while it is not on the water.
type Spot = (at: number) => { x: number; y: number; half: number } | undefined

const HALF: Record<Boat['kind'], number> = { lead: 70, crew: 34, shell: 40 }

function spotOf(boat: Boat): Spot {
  return at => {
    if (at * 1000 < boat.born || (boat.gone !== undefined && at * 1000 > boat.gone + leaveSeconds(boat) * 1000)) {
      return undefined
    }
    const p = whereabouts(boat, at * 1000)
    return { x: p.x, y: p.y, half: HALF[boat.kind] * depthScale(p.y) }
  }
}

// Boats give way rather than sail through each other: where two would pass
// at one depth, the one that set out later (a dinghy or fishing boat always,
// before the lead boat) bears off a little nearer or further than its course,
// away from the other, and comes back once they are clear. Whether two meet
// is worked out on their courses alone, on a grid of the clock, so every
// redraw finds the same meetings and a boat already giving way goes on doing
// so; a boat that comes out later never moves one that is out already. A
// boat is checked against the others as they sail once they have given way
// themselves, so bearing off from one never takes it into another.
// What a scene plans for a boat's bearing off: the meetings it foresees,
// and, faded out over WAY_CATCH seconds from `at`, what it had to make up to
// go on from where the drawing before it left the boat. A boat's course can
// change between drawings (the lead boat heads home, a boat is called back),
// and so can the meetings foreseen; the boat then eases over to the new plan
// rather than jumping to it.
export type WayPlan = { meetings: readonly { start: number; end: number; side: number }[]; carry: number; at: number }

// How far a boat bears off at second `at` on the clock, nearer positive.
export function bearingOn(plan: WayPlan, at: number): number {
  const smooth = (p: number): number => (p <= 0 ? 0 : p >= 1 ? 1 : p * p * (3 - 2 * p))
  const sum = plan.meetings.reduce((total, m) => total + m.side * smooth(Math.min((at - m.start + WAY_RAMP) / WAY_RAMP, (m.end + WAY_RAMP - at) / WAY_RAMP)), 0)
  return Math.max(-WAY_WIDE, Math.min(WAY_WIDE, sum)) * WAY_PX + plan.carry * (1 - smooth((at - plan.at) / WAY_CATCH))
}

// `css` is the keyframes that carry the bearing over the `span` seconds
// from `seconds`, unnamed; `was` how far the boat bore off at `seconds` in
// the drawing before.
const WAY_GAP = 16
const WAY_PX = 20
const WAY_RAMP = 3
const WAY_STEP = 0.25
const WAY_CATCH = 1.2
// How much further than WAY_PX a boat caught between two bears off.
const WAY_WIDE = 1.8

function giveWay(boat: Boat, others: readonly Spot[], seconds: number, span: number, was: number): { plan: WayPlan; css: string } {
  const self = spotOf(boat)
  const from = Math.floor((seconds - WAY_RAMP - 2) / WAY_STEP)
  const to = Math.ceil((seconds + span + WAY_RAMP + 2) / WAY_STEP)
  // Each meeting: when it starts and ends, and which way to bear off.
  const meetings: { start: number; end: number; side: number }[] = []
  for (const other of others) {
    let open: { start: number; end: number; lean: number } | undefined
    for (let k = from; k <= to; k++) {
      const at = k * WAY_STEP
      const a = self(at)
      const b = other(at)
      const meets = a !== undefined && b !== undefined && Math.abs(a.y - b.y) < WAY_GAP && Math.abs(a.x - b.x) < a.half + b.half
      if (meets) {
        open = open === undefined ? { start: at, end: at, lean: a.y - b.y } : { ...open, end: at, lean: open.lean + a.y - b.y }
      }
      if ((!meets || k === to) && open !== undefined) {
        meetings.push({ start: open.start, end: open.end, side: open.lean > 0 ? 1 : -1 })
        open = undefined
      }
    }
  }
  // Each meeting in turn bears off to the side, and as far, that with the
  // ones before it settled meets the fewest others; away from the one it
  // meets, and the shorter way, when they do as well. A boat caught between
  // two may have to bear off further to clear both.
  const meetsAnyAt = (at: number, by: number): boolean => {
    const a = self(at)
    return a !== undefined && others.some(other => {
      const b = other(at)
      return b !== undefined && Math.abs(a.y + by - b.y) < WAY_GAP && Math.abs(a.x - b.x) < a.half + b.half
    })
  }
  const settled: { start: number; end: number; side: number }[] = []
  for (const meeting of [...meetings].sort((a, b) => a.start - b.start)) {
    const clashes = (side: number): number => {
      const trial = { meetings: [...settled, { ...meeting, side }], carry: 0, at: seconds }
      let count = 0
      for (let k = Math.ceil((meeting.start - WAY_RAMP) / WAY_STEP); k * WAY_STEP <= meeting.end + WAY_RAMP; k++) {
        if (meetsAnyAt(k * WAY_STEP, bearingOn(trial, k * WAY_STEP))) count++
      }
      return count
    }
    const away = meeting.side
    const sides = [away, -away, away * WAY_WIDE, -away * WAY_WIDE]
    const counts = sides.map(clashes)
    settled.push({ ...meeting, side: sides[counts.indexOf(Math.min(...counts))] ?? away })
  }
  const planned = { meetings: settled, carry: 0, at: seconds }
  const plan = { ...planned, carry: was - bearingOn(planned, seconds) }
  const off = (at: number): number => bearingOn(plan, at)
  if (Math.abs(plan.carry) < 0.05 && !meetings.some(m => m.end + WAY_RAMP > seconds && m.start - WAY_RAMP < seconds + span)) {
    return { plan, css: '' }
  }
  const times = keyTimes(span, at => [off(seconds + at)], 0.5)
  return { plan, css: `@keyframes {${times.map(at => `${f((at / span) * 100)}%{transform:translateY(${f(off(seconds + at))}px)}`).join('')}}` }
}

// The boats on the water, each painted on the far side of the island or the
// near side. Every circuit keeps clear of the island, so a boat is on the far
// side only while it rounds the island behind it on its way in or out, level
// with it; for that trip it is drawn twice, a copy on each side, each shown in
// its turn.
function fleets(boats: readonly Boat[], seconds: number, flag: Flag, isPlain: boolean, lead: Spot | undefined, bearing: Readonly<Record<string, number>>): { css: string; far: Part[]; near: Part[]; ways: Record<string, WayPlan> } {
  const far: Part[] = []
  const near: Part[] = []
  const ways: Record<string, WayPlan> = {}
  let css = ''
  const roam = roamSpan(isPlain)
  // Each boat gives way in the order they set out, to the lead boat and to
  // those out before it as they sail.
  const giving = new Map<Boat, { plan: WayPlan; css: string }>()
  const sailing: Spot[] = lead === undefined ? [] : [lead]
  for (const boat of [...boats].sort((a, b) => a.born - b.born || boatTag(a).localeCompare(boatTag(b)))) {
    const way = giveWay(boat, sailing, seconds, roam + 5, bearing[boatTag(boat)] ?? 0)
    giving.set(boat, way)
    const raw = spotOf(boat)
    sailing.push(at => {
      const spot = raw(at)
      return spot === undefined ? undefined : { ...spot, y: spot.y + bearingOn(way.plan, at) }
    })
  }
  boats.forEach((boat, index) => {
    const way = giving.get(boat) ?? { plan: { meetings: [], carry: 0, at: seconds }, css: '' }
    ways[boatTag(boat)] = way.plan
    const off = (at: number): number => bearingOn(way.plan, at)
    const track = `${boat.kind}${boat.slot}dg`
    const drawn = vessel(boat, seconds, flag, toleranceFor(isPlain))
    const svg = way.css === '' ? drawn.svg : `<g ${once(track, roam + 5, 0)}>${drawn.svg}</g>`
    const one = { css: drawn.css + way.css.replace('@keyframes ', `@keyframes ${track}`), svg: `<g id="v${index}" data-b="${boat.kind}${boat.slot}">${svg}</g>`, copy: `<use href="#v${index}"/>` }
    const depth = depthIn(boat, seconds, AHEAD_S, roam) + off(seconds + AHEAD_S)
    const motion = { depthIn: (later: number): number => depthIn(boat, seconds, later, roam) + off(seconds + later), xIn: (later: number): number => whereabouts(boat, (seconds + later) * 1000).x, moving: movingFor(boat, seconds, roam), ...FLEET_REACH }
    css += one.css
    if (!sailsBehind(boat)) {
      near.push({ svg: one.svg, copy: one.copy, depth, ...motion })
      return
    }
    const isLeaving = boat.gone !== undefined
    const start = (isLeaving ? (boat.gone ?? 0) : boat.born) / 1000
    const span = isLeaving ? leaveSeconds(boat) : enterSeconds(boat)
    const age = seconds - start
    if (age >= span) {
      near.push({ svg: one.svg, copy: one.copy, depth, ...motion })
      return
    }
    // The second, from `start`, the boat comes level with the island or
    // leaves it astern.
    const isLevel = (at: number): boolean => whereabouts(boat, (start + at) * 1000).x > ISLAND_EDGE
    let turn = span
    for (let at = 0; at <= span; at += 0.1) {
      if (isLevel(at) !== isLevel(0)) {
        turn = at
        break
      }
    }
    const behind: Span[] = isLevel(0) ? [[0, turn]] : [[turn, span]]
    const name = `${boat.kind}${boat.slot}`
    const endsBehind = isLeaving && isLevel(span)
    css += `${shownIn(`${name}f`, behind, span, endsBehind ? 1 : 0)}${shownIn(`${name}n`, outside(behind, span), span, endsBehind ? 0 : 1)}`
    const shown = { far: stepped(`${name}f`, span, age), near: stepped(`${name}n`, span, age) }
    far.push({ svg: `<g ${shown.far}>${one.svg}</g>`, copy: `<g ${shown.far}>${one.copy}</g>`, depth, ...motion })
    near.push({ svg: `<g ${shown.near}>${one.copy}</g>`, copy: `<g ${shown.near}>${one.copy}</g>`, depth, ...motion })
  })
  const byDepth = (a: Part, b: Part): number => a.depth - b.depth
  const behind = stack(far.sort(byDepth), 'zf')
  return { css: css + behind.css, far: behind.parts, near, ways }
}

// Boats painted far to near for as long as the scene lasts. Boats on their
// circuits keep one order; boats on their way in or out take their places
// among them, and among each other, by how near they are. That arrangement
// only matters between boats close enough to overlap, so the time is cut
// where two such boats change places in depth, or come close together, and
// each moving boat is drawn once for each stretch in which its place differs
// from the one before, shown only then.
// Two boats close enough that one may hide part of the other: less than
// their hulls' widths apart across the view, and less than a sail's height
// apart in depth. A dinghy or fishing boat reaches about as far as one at
// its largest; the lead boat is bigger.
const FLEET_REACH = { wide: 90, tall: 70 }
const LEAD_REACH = { wide: 130, tall: 130 }
function isClose(a: Part, b: Part, later: number): boolean {
  return Math.abs(a.xIn(later) - b.xIn(later)) < (a.wide + b.wide) / 2 && Math.abs(a.depthIn(later) - b.depthIn(later)) < Math.max(a.tall, b.tall)
}
function stack(parts: readonly Part[], prefix: string): { parts: Part[]; css: string } {
  const still = parts.filter(part => part.moving <= 0)
  const movers = parts.filter(part => part.moving > 0)
  const horizon = Math.max(0, ...movers.map(part => part.moving))
  const placesAt = (later: number): [number, number][] => {
    const slots = movers.map(part => still.filter(other => other.depth < part.depthIn(later)).length)
    return movers.map((part, m) => [slots[m] ?? 0, movers.filter((other, k) => k !== m && slots[k] === slots[m] && (other.depthIn(later) < part.depthIn(later) || (other.depthIn(later) === part.depthIn(later) && k < m))).length])
  }
  // Each moving boat against every other boat: whether it is the nearer, and
  // whether the two are close.
  const pairsAt = (later: number): string =>
    movers
      .map((part, m) =>
        parts
          .filter(other => other !== part)
          .map(other => (isClose(part, other, later) ? (part.depthIn(later) > other.depthIn(later) ? 'n' : 'f') : '-'))
          .join('') + m,
      )
      .join()
  const cuts = [0]
  let last = pairsAt(0)
  for (let later = 0.1; later <= horizon + 0.05; later += 0.1) {
    const now = pairsAt(later)
    // A cut is needed where a close pair changes places, or a pair comes
    // close; two boats drawing apart need none.
    const isChanged = [...now].some((mark, k) => mark !== '-' && mark !== last[k])
    if (isChanged) {
      cuts.push(later)
    }
    last = now
  }
  // A stretch is cut wherever a pair comes close or a close pair trades
  // places, so every pair that is close at any time in a stretch is close,
  // and in that order, at its start: the order there holds for it all.
  const stretches = cuts.map((from, j) => {
    const to = cuts[j + 1] ?? horizon
    return { from, to, places: placesAt(from) }
  })
  const buckets: { rank: number; from: number; part: Part }[][] = still.map(() => [])
  buckets.push([])
  let css = ''
  movers.forEach((part, m) => {
    // Its own stretches: runs of stretches over which its place holds.
    const runs: { from: number; to: number; place: [number, number] }[] = []
    for (const stretch of stretches) {
      const place = stretch.places[m] ?? [0, 0]
      const run = runs[runs.length - 1]
      if (run !== undefined && run.place[0] === place[0] && run.place[1] === place[1]) {
        run.to = stretch.to
      } else {
        runs.push({ from: stretch.from, to: stretch.to, place })
      }
    }
    runs.forEach((run, j) => {
      const isLast = j === runs.length - 1
      let placed = part
      if (runs.length > 1) {
        const name = `${prefix}${m}t${j}`
        // Every gate in this stack shares one timing, set by its class.
        const gate = `class="cut ${prefix}" style="animation-name:${name}"`
        css += shownIn(name, [[run.from, isLast ? horizon : run.to]], horizon, isLast ? 1 : 0)
        placed = { ...part, svg: `<g ${gate}>${j === 0 ? part.svg : part.copy}</g>`, copy: `<g ${gate}>${part.copy}</g>` }
      }
      buckets[run.place[0]]?.push({ rank: run.place[1], from: run.from, part: placed })
    })
  })
  if (css !== '') {
    css += `.${prefix}{--e:${f3(Math.max(0.1, horizon))}s;--a:0}`
  }
  const out: Part[] = []
  buckets.forEach((bucket, k) => {
    out.push(...bucket.sort((a, b) => a.rank - b.rank || a.from - b.from).map(entry => entry.part))
    const here = still[k]
    if (here !== undefined) {
      out.push(here)
    }
  })
  return { parts: out, css }
}

// Where the island begins, for a boat passing behind it: the jetty's tip,
// less half a boat.
const ISLAND_EDGE = JETTY.tip - 40

// A boat drawn with how near it sails, so that boats can be painted far to
// near: `depth` now, `depthIn` some seconds from now, and for how many more
// seconds that changes.
//
// A boat that must be painted in more than one place is drawn in full once,
// under an id, and placed again with <use>: `copy` places it again.
type Part = { svg: string; copy: string; depth: number; depthIn: (later: number) => number; xIn: (later: number) => number; moving: number; wide: number; tall: number }

// How near the viewer a boat sails, as the height of its waterline. Out on
// its circuit it keeps to a narrow band, and that band's middle stands for it;
// on its way in or out it crosses others, and where it will be a moment from
// now stands for it until the scene is drawn again.
const AHEAD_S = 1.5

function depthIn(boat: Boat, seconds: number, later: number, roam: number): number {
  return movingFor(boat, seconds, roam) > later ? whereabouts(boat, (seconds + later) * 1000).y : routeOf(boat).cy
}

// For how many more seconds a boat's depth keeps changing in this scene: on
// its way in or out, or for as long as the scene works out a roaming boat's
// place.
function movingFor(boat: Boat, seconds: number, roam: number): number {
  if (boat.gone !== undefined) {
    return boat.gone / 1000 + leaveSeconds(boat) - seconds
  }
  const coming = Math.max(0, boat.born / 1000 + enterSeconds(boat) - seconds)
  return roams(boat) ? Math.max(coming, roam) : coming
}

// How far ahead a scene works out roaming boats' order: less far in a plain
// scene, which must stay small, and is drawn again sooner.
export function roamSpan(isPlain: boolean): number {
  return isPlain ? PLAIN_ROAM_S : ROAM_S
}
const PLAIN_ROAM_S = 20

// The seaplane, side on and facing right with its waterline at the origin: a
// float under it, a high wing, a cabin door that slides back towards the tail
// (`door` its attributes), and a propeller turning on its nose.
function seaplaneArt(door: string): string {
  return `<path fill="#5a646d" d="M-44 0H38Q48 0 53 -7H-48Q-50 -2 -44 0Z"/><path fill="none" stroke="#5a646d" stroke-width="2" d="M-30 -6L-24 -20M28 -6L24 -19"/>
<path fill="#1b9fb3" d="M-40 -38L-52 -60H-60L-56 -40Z"/><path fill="#f3f6f7" d="M60 -27C60 -33 55 -36 46 -36H-20L-52 -40H-58L-54 -30L-26 -20H46C55 -19 60 -22 60 -27Z"/>
<path fill="#1b9fb3" d="M58 -25L-26 -24L-50 -33L-48 -30L-26 -21L57 -22Z"/><path fill="#2c5a75" d="M46 -35L56 -31L55 -28L44 -29ZM30 -33h5v4h-5zM21 -33h5v4h-5zM12 -33h5v4h-5z"/>
<path fill="#22313b" d="M-16 -34h14v14h-14z"/><g ${door}><path fill="#e8eef0" stroke="#b9c6cc" stroke-width=".8" d="M-16 -34h14v14h-14z"/></g>
<rect x="-6" y="-41" width="40" height="4.5" rx="2.2" fill="#dfe7ea"/><path fill="none" stroke="#5a646d" stroke-width="1.6" d="M2 -21L8 -37"/>
<ellipse cx="62" cy="-27" rx="2" ry="13" fill="#3b4248" opacity=".18"/><g class="spr"><path d="M62 -40V-14" stroke="#3b4248" stroke-width="2.2" stroke-linecap="round"/></g><circle cx="61" cy="-27" r="2.4" fill="#3b4248"/>`
}

// The seaplane on the water, under its float: the line where it sits in the
// water, and while it moves, foam peeling back from its bow and a wake
// streaming out behind; and the spray it throws up where it meets the water
// and where it leaves it.
const PLANE_WATERLINE = '<ellipse cx="4" cy=".6" rx="54" ry="2.2" fill="#fff" opacity=".45"/>'
const PLANE_WAKE = '<g class="spk"><path fill="#fff" opacity=".55" d="M-44 -.5C-70 -1 -100 1 -132 4C-100 3.5 -70 3 -44 2.5Z"/></g><path fill="#fff" opacity=".8" d="M44 -1Q52 -6 58 -2Q53 1 44 1.6Z"/>'

// The seaplane at `seconds` on the clock, while it is in view: flying in on
// a shallow descent, levelling off and onto the water flat, and taxiing to
// lie behind the end of the boardwalk; once it hands over its cargo, its door
// sliding open and shut; then turning about, gathering speed across the
// water and climbing away nose up.
// `isPlain` leaves out the spray, for a scene short of room.
function seaplane(plane: Plane | undefined, seconds: number, isPlain: boolean): { svg: string; css: string } {
  if (plane === undefined) {
    return { svg: '', css: '' }
  }
  const t = seconds - plane.at / 1000
  const { legs, gone, touch, lift, pitch } = flightOf(plane)
  if (t >= gone) {
    return { svg: '', css: '' }
  }
  const span = Number.isFinite(gone) ? gone : PLANE_IN_S + 1
  const turning = turns(legs, -1)
  const side = facingAt(turning, t)
  // On the water from touching down until it lifts off; moving on it while
  // it slows to its mooring and while it gathers speed again.
  const afloat: Span = [touch, Math.min(lift, span)]
  const moving: Span[] = [[touch, PLANE_IN_S - 1.5], ...(Number.isFinite(lift) ? [[lift - TAKE_OFF_RUN, lift] as Span] : [])]
  const fade = (from: number, to: number): string => `${pct(from, span)}{opacity:0}${pct(Math.min(to, from + 0.6), span)},${pct(Math.max(from, to - 0.6), span)}{opacity:1}${pct(to, span)}{opacity:0}`
  const raised = (at: number): string => `transform:rotate(${f(-(pitch.reduce((deg, [when, d]) => (when <= at ? d : deg), 0)))}deg)`
  let css = `${track('spp', legs, span)}${facing('spf', turning, span, s => `scaleX(${f(s)})`)}@keyframes spr{0%,100%{transform:scaleY(1)}50%{transform:scaleY(-1)}}.spr{${loop('spr', 0.2, 'linear')};transform-origin:62px -27px}`
  css += `@keyframes spt{0%{transform:rotate(0deg)}${pitch.map(([at, deg]) => `${pct(at, span)}{transform:rotate(${f(-deg)}deg)}`).join('')}100%{${raised(span)}}}`
  css += `${shownIn('spa', [afloat], span, Number.isFinite(lift) ? 0 : 1)}@keyframes spw{0%{opacity:0}${moving.map(([a, b]) => fade(a, b)).join('')}100%{opacity:0}}@keyframes spk{0%,100%{transform:scaleX(.92)}50%{transform:scaleX(1.06)}}.spk{${loop('spk', 0.5, 'ease-in-out')}}`
  // The spray thrown up as it touches down and as it lifts off.
  const bursts = isPlain ? [] : [touch, ...(Number.isFinite(lift) ? [lift] : [])]
  css += bursts.map((at, i) => `@keyframes sps${i}{0%,${pct(at, span)}{opacity:0;transform:scale(.3,.1)}${pct(at + 0.2, span)}{opacity:.9;transform:scale(1)}${pct(at + 1, span)},100%{opacity:0;transform:scale(1.3,1.4)}}`).join('')
  const sprays = bursts.map((_, i) => `<g transform="translate(${i === 0 ? 10 : -30} 1) scale(1.3 .9)"><g ${once(`sps${i}`, span, t)} opacity="0"><use href="#dsp"/></g></g>`).join('')
  let door = ''
  if (plane.swap !== undefined) {
    const at = (plane.swap - plane.at) / 1000
    const shuts = at + SWAP.first + (plane.cargo ?? 0) * SWAP.each
    css += `@keyframes spd{0%,${pct(at, span)}{transform:translateX(0)}${pct(at + SWAP.opened, span)},${pct(shuts, span)}{transform:translateX(-13px)}${pct(shuts + SWAP.shut, span)},100%{transform:translateX(0)}}`
    door = once('spd', span, t)
  }
  const isAfloat = t >= afloat[0] && t < afloat[1]
  const water = `<g ${stepped('spa', span, t)}${isAfloat ? '' : ' opacity="0"'}>${PLANE_WATERLINE}</g><g ${once('spw', span, t)} opacity="0">${PLANE_WAKE}</g>${sprays}`
  // Pitched about the step of its float, under the wing.
  const body = `<g transform="translate(-8 0)"><g ${once('spt', span, t)}><g transform="translate(8 0)">${seaplaneArt(door)}</g></g></g>`
  return { css, svg: tracked('spp', span, t, along(legs, t), `<g ${once('spf', span, t)} transform="scale(${f(side)} 1)">${water}${body}</g>`) }
}
// How long it gathers speed across the water before it lifts off.
const TAKE_OFF_RUN = 7

// Sea life, each drawn facing right around its own origin.
const TURTLE = `<ellipse class="shade" cx="-4" cy="12" rx="44" ry="24"/>
<g class="tsk"><path class="flipA" style="transform-origin:16px -16px" d="M20 -15C30 -26 38 -42 34 -58C24 -50 12 -36 6 -20Z"/><path class="flipB" style="transform-origin:16px 16px" d="M20 15C30 26 38 42 34 58C24 50 12 36 6 20Z"/>
<path d="M-26 -14C-36 -20 -46 -22 -52 -16C-46 -10 -36 -8 -28 -8ZM-26 14C-36 20 -46 22 -52 16C-46 10 -36 8 -28 8ZM-34 -2L-46 0L-34 2ZM26 -7C34 -9 44 -8 48 0C44 8 34 9 26 7Z"/></g>
<circle class="teye" cx="42" cy="-3.8" r="1.4"/><circle class="teye" cx="42" cy="3.8" r="1.4"/>
<path class="tsh" d="M30 0C30 -16 14 -24 -4 -24C-22 -24 -34 -12 -36 0C-34 12 -22 24 -4 24C14 24 30 16 30 0Z"/>
<path class="tsl" d="M21 0C21 -10 10 -16 -3 -16C-16 -16 -25 -8 -27 0C-25 8 -16 16 -3 16C10 16 21 10 21 0Z"/>
<path class="tsc" fill="none" stroke-width="1.3" stroke-linejoin="round" opacity=".7" d="M20 0L8 -8L-8 -8L-18 0L-8 8L8 8ZM8 -8L12 -22M-8 -8L-14 -22M8 8L12 22M-8 8L-14 22M20 0H30M-18 0H-36M0 -8V8"/>`

// Seen from above, nose to the right: swept wings, and a broad head whose two
// short lobes flank the mouth.
const MANTA_BODY = 'M47 -10C44 -15 38 -16 32 -18C18 -26 4 -46 -12 -80C-12 -58 -20 -34 -36 -12C-40 -6 -40 6 -36 12C-20 34 -12 58 -12 80C4 46 18 26 32 18C38 16 44 15 47 10C45 8 42 8 40 7Q35 0 40 -7C42 -8 45 -8 47 -10Z'

const MANTA = `<path class="shade" transform="translate(-5 12) scale(.96)" d="${MANTA_BODY}"/>
<path class="mb" d="M-37 -1.5L-96 0L-37 1.5Z"/><g class="wingf"><path class="mb" d="${MANTA_BODY}"/><path class="mm" d="M22 -10C14 -21 4 -27 -8 -28C-2 -18 8 -11 22 -7ZM22 10C14 21 4 27 -8 28C-2 18 8 11 22 7Z"/></g>`

// A shark's fin cutting the surface: foam where it meets the water, a ripple
// off its leading edge, and a wake that opens behind it in two arms, the far
// one flatter, fading as it trails and flowing away from the fin.
const FIN = `<path class="fin" d="M13 0Q5 -19 -9 -26Q-7 -11 -13 0Z"/><g fill="none" stroke-linecap="round"><g class="fwk"><path d="M-12 0Q-36 0 -64 -4" stroke="url(#fwg)" stroke-width="1.4"/><path d="M-10 2Q-30 5 -60 13" stroke="url(#fwg)" stroke-width="1.6"/></g><g class="fcl"><path d="M-16 0.5Q0 -2.5 16 0.5" stroke="#fff" stroke-width="2.2"/><path d="M16 0Q23 0 27 3" stroke="#fff" stroke-width="1.3"/></g></g>`

const DOLPHIN = `<path class="dol" d="M56 2Q52 -1 46 -2C44 -8 38 -12 30 -13C12 -16 -16 -14 -36 -6L-50 -2C-54 -6 -58 -11 -63 -13Q-60 -6 -57 0Q-60 6 -63 13C-58 11 -54 6 -50 2C-30 8 0 14 28 8Q40 6 48 5Q54 5 56 2ZM5 -13C6 -24 -2 -32 -12 -34C-8 -26 -8 -20 -11 -12ZM22 7C18 14 12 18 6 19C10 14 12 10 14 7Z"/><path class="dolb" d="M48 4C30 10 0 13 -30 6C-6 9 20 7 46 1Z"/><path class="dolh" d="M28 -11C10 -14 -14 -12 -32 -5C-14 -9 10 -11 28 -11Z"/><path fill="none" stroke="#24465a" stroke-linecap="round" d="M55 2.6Q49 3.4 44 1.4"/><circle cx="38" cy="-4" r="1.5" fill="#13232e"/>`

function school(cls: string, count: number, salt: number, href: string): string {
  let out = ''
  for (let i = 0; i < count; i++) {
    const x = rnd(i, salt) * 200 - 100
    const y = rnd(i, salt + 1) * 80 - 40
    const s = 1.1 + rnd(i, salt + 2) * 0.7
    out += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})"><use href="#${href}" class="wig" style="--d:${f(rnd(i, salt + 3) * 1.3)}"/></g>`
  }
  return `<g class="${cls}">${out}</g>`
}

// Crosses the whole view once per cycle, then stays out of sight for the rest
// of it, so the sea is mostly empty and each visitor is an event. The sand
// island fills the right of the lanes at `y`, so a swimmer that would run into
// it is given a `dip`: that much lower on the island's side of the view.
function swimmer(dir: 'R' | 'L', y: number, seconds: number, phase: number, squash: number, body: string, dip = 0): string {
  const flip = dir === 'L' ? ' scale(-1 1)' : ''
  const inner = `<g class="wander"><g transform="scale(1 ${squash})${flip}">${body}</g></g>`
  const path = dip === 0 ? inner : `<g style="--dip:${dip}px;animation:dip${dir} ${seconds}s ease-in-out ${PHASE} infinite">${inner}</g>`
  return `<g class="sw${dir}" style="animation:swim${dir} ${seconds}s linear ${PHASE} infinite;--d:${phase}"><g transform="translate(0 ${y})">${path}</g></g>`
}

// An animation that runs once from `age` seconds in, held at its ends.
function onceFrom(name: string, timing: string, cycle: number, age: number): string {
  return `animation:${name} ${cycle}s ${timing} ${f3(-age)}s 1 both`
}

// One crossing of a called swimmer, its body cloned from its kind's own.
function crossing(dir: 'R' | 'L', y: number, cycle: number, squash: number, body: string, dip: number, age: number): string {
  const flip = dir === 'L' ? ' scale(-1 1)' : ''
  const inner = `<g class="wander"><g transform="scale(1 ${squash})${flip}"><use href="#${body}"/></g></g>`
  const path = dip === 0 ? inner : `<g style="--dip:${dip}px;${onceFrom(`dip${dir}`, 'ease-in-out', cycle, age)}">${inner}</g>`
  return `<g class="sw${dir}" style="${onceFrom(`swim${dir}`, 'linear', cycle, age)}"><g transform="translate(0 ${f(y)})">${path}</g></g>`
}

// How far off its lane a called one in slot k keeps: each slot a step
// further the same way, so calls made together still read as several. Under
// the water that is up, away from the bottom; at the surface it is nearer.
function offLane(k: number, step: number): number {
  return step * (k + 1)
}

// Something drawn at a depth (its lane's y): nearer, lower on the view, is
// painted later.
type Layer = [number, string]
function byDepth(layers: readonly Layer[]): string {
  return [...layers].sort((a, b) => a[0] - b[0]).map(([, markup]) => markup).join('')
}

// The called ones of `kind` on a lane at `y`, each drawn by `one(age, y)` at
// its own place beside the lane.
function called(visits: readonly Visit[], kind: VisitKind, y: number, step: number, one: (age: number, y: number) => string): Layer[] {
  return visits.filter(v => v.kind === kind).map(v => {
    const at = y + offLane(v.slot, step)
    return [at, one(v.age, at)]
  })
}

// A called leap of a pod of two, at one of a few spots clear of the pods on
// their rounds, its clock set so the leap starts LEAP_LEAD after the call.
const CALLED_PODS: readonly [number, number, number][] = [[820, HORIZON + 58, 1.15], [520, HORIZON + 84, 1.35], [1060, HORIZON + 52, 1.05]]
function calledPod(spot: number, age: number, seconds: number): string {
  const [x, y, s] = CALLED_PODS[spot % CALLED_PODS.length] ?? [820, HORIZON + 58, 1.15]
  const phase = f3((LEAP_FROM / 100) * LEAP_EVERY - LEAP_LEAD + age - Number(f3(seconds % 100000)))
  const behind = f3(Number(phase) - 0.7)
  return `<g transform="translate(${x} ${y}) scale(${s})">
<g clip-path="url(#surf)">${leaper(0, LEAP_SIZE, Number(phase), ONCE)}${leaper(-44, 0.42, Number(behind), ONCE)}</g>
${splashes(0, LEAP_SIZE, Number(phase), ONCE)}${splashes(-44, 0.42, Number(behind), ONCE)}</g>`
}

// The pods on their rounds and the called ones, each at its depth.
function pods(visits: readonly Visit[], seconds: number): Layer[] {
  const rounds: Layer[] = [[HORIZON + 46, pod(640, HORIZON + 46, 1, 0, 0)], [HORIZON + 68, pod(960, HORIZON + 68, 1.25, 20, 1)], [HORIZON + 96, pod(700, HORIZON + 96, 1.5, 37, 2)]]
  const called = visits.filter(v => v.kind === 'dolphins').map((v): Layer => [CALLED_PODS[v.slot % CALLED_PODS.length]?.[1] ?? 0, calledPod(v.slot, v.age, seconds)])
  return [...rounds, ...called]
}

function visitor(lane: Lane, squash: number, body: string, dip = 0): string {
  return `<g class="${lane.gate}" style="--d:${lane.phase}">${swimmer(lane.dir, lane.y, lane.cycle, lane.phase, squash, body, dip)}</g>`
}

// `ONCE` on a called leap's animated parts: one leap, held under the water
// after it, where a drawing kept on after the call is over leaves it.
const ONCE = ' style="animation-iteration-count:1;animation-fill-mode:both"'

function leaper(x: number, s: number, phase: number, once = ''): string {
  return `<g transform="translate(${x} 0)" style="--d:${phase}"><g class="lpX"${once}><g class="lpY"${once}><g class="lpR"${once}><use href="#dl" transform="scale(${s})"/></g></g></g></g>`
}

// Two dolphins leaping together at one spot. A leap comes round every
// LEAP_EVERY seconds, and each pod is in sight for only one round in three, a
// different one from the others, so where and when the next leap comes varies.
// A dolphin's splashes, where it leaves the water and where it goes back in:
// spray thrown up and a ring of foam spreading out.
function splashes(x: number, s: number, phase: number, once = ''): string {
  const at = (hole: number, when: 'O' | 'I'): string => `<g transform="translate(${hole} 0) scale(${f3(s / LEAP_SIZE)})"><g class="rg${when}"${once}><use href="#drg"/></g><g class="sp${when}"${once}><use href="#dsp"/></g></g>`
  return `<g class="spl" style="--d:${phase}">${at(x, 'O')}${at(x + LEAP_REACH, 'I')}</g>`
}

function pod(x: number, y: number, s: number, phase: number, turn: number): string {
  // The round in sight starts a little into it, after the last splash has faded.
  const sight = phase - LEAP_EVERY * 0.1 + LEAP_EVERY * turn
  return `<g class="pod" style="--d:${f(sight)}"><g transform="translate(${x} ${y}) scale(${s})" style="--d:${phase}">
<g clip-path="url(#surf)">${leaper(0, LEAP_SIZE, phase)}${leaper(-44, 0.42, phase - 0.7)}</g>
${splashes(0, LEAP_SIZE, phase)}${splashes(-44, 0.42, phase - 0.7)}</g></g>`
}

// The reef and the open lagoon lie on the bottom, under every swimmer, which
// all pass over them. A swimmer is drawn opaque in colours already mixed with
// the water around it, so it hides what it passes over instead of letting it
// show through as a group opacity would.
// Each kind's body has an id, which a called one of the kind clones.
function seaLife(hasLife: boolean, visits: readonly Visit[], seconds: number): string {
  // A lane's swimmer on its rounds, then its called ones.
  const lane = (kind: VisitKind, one: Lane, squash: number, body: string, id: string, dip = 0, step = -34): Layer[] => [
    [one.y, visitor(one, squash, body, dip)],
    ...called(visits, kind, one.y, step, (age, y) => crossing(one.dir, y, one.cycle, squash, id, dip, age)),
  ]
  const surface: Layer[] = [
    [HORIZON + 28, swimmer('R', HORIZON + 28, WHALE_CYCLE, 300, 1, `<g id="bWs" transform="scale(.37)">${WHALE_SHARK}</g>`)],
    ...called(visits, 'whaleShark', HORIZON + 28, 12, (age, y) => crossing('R', y, WHALE_CYCLE, 1, 'bWs', 0, age)),
    ...pods(visits, seconds),
    [FIN_LANE, swimmer('L', FIN_LANE, FIN_CYCLE, 150, 1, `<g id="bFn">${FIN}</g>`)],
    ...called(visits, 'fin', FIN_LANE, 16, (age, y) => crossing('L', y, FIN_CYCLE, 1, 'bFn', 0, age)),
  ]
  const under: Layer[] = [
    ...lane('manta', LANES.manta, 0.7, `<g id="bMa" transform="scale(0.9)">${MANTA}</g>`, 'bMa', 128, -30),
    ...lane('snappers', LANES.shoalA, 0.85, `<g id="bSa">${school('shA', 9, 21, 'sr')}</g>`, 'bSa', 66),
    ...(hasLife ? lane('ray', LANES.ray, 0.5, '<g id="bRa" class="wingf"><use href="#qw"/></g>', 'bRa') : []),
    ...lane('turtle', LANES.turtle, 0.7, `<g id="bTu" transform="scale(1.2)">${TURTLE}</g>`, 'bTu'),
    ...lane('bannerfish', LANES.shoalB, 0.85, `<g id="bSb">${school('fishB', 7, 31, 'ss')}</g>`, 'bSb'),
  ]
  return `<g><defs><g id="dl">${DOLPHIN}</g></defs>
${byDepth(surface)}
${hasLife ? LIFE_KINDS + LAGOON : ''}${REEF.far}${hasLife ? REEF.farLife : ''}${REEF.near}${hasLife ? REEF.nearLife : ''}
${byDepth(under)}${hasLife ? BEAMS : ''}
</g>`
}

function star5(cx: number, cy: number, r: number): string {
  let d = ''
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2
    const rr = k % 2 === 0 ? r : r * 0.42
    d += `${k === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr * 0.7)}`
  }
  return `<path d="${d}Z" fill="#f08a4b"/>`
}

// Claude's mascot, drawn on a grid of square cells with its feet on the origin:
// a block of a body, two stub arms, four legs, and a face.
const CLAY = '#c97b5e'
const INK = '#1f1614'
const M_BODY = 'M-7.5 -13h15v10h-15z'
const M_ARM_L = 'M-9.5 -9h2v2h-2z'
const M_ARM_R = 'M7.5 -9h2v2h-2z'
const M_ARM_UP = 'M7.5 -12.5h2v2h-2z'
const M_LEGS_A = 'M-6.5 -3h1v3h-1zM2.5 -3h1v3h-1z'
const M_LEGS_B = 'M-3.5 -3h1v3h-1zM5.5 -3h1v3h-1z'
const M_BLUSH = '<path d="M-6.5 -7h2v1h-2zM4.5 -7h2v1h-2z" fill="#e29a8f"/>'
const M_SHUT = `<path d="M-5.2 -9h2.4v.7h-2.4zM2.8 -9h2.4v.7h-2.4z" fill="${INK}"/>`

function clay(d: string): string {
  return `<path d="${d}" fill="${CLAY}"/>`
}

function inked(d: string): string {
  return `<path d="${d}" fill="${INK}"/>`
}

function drawn(d: string): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".9"/>`
}

// The looks its face takes besides looking straight ahead: smiling eyes, a
// wink, a glance to the right and to the left, a glance up, and wide eyes.
const M_LOOKS = [
  drawn('M-5.1 -8.3L-4 -9.9L-2.9 -8.3M2.9 -8.3L4 -9.9L5.1 -8.3'),
  `${inked('M-4.5 -10h1v2h-1z')}${drawn('M4.7 -10.4L3.3 -9L4.7 -7.6')}`,
  inked('M-3.5 -10h1v2h-1zM4.5 -10h1v2h-1z'),
  inked('M-5.5 -10h1v2h-1zM2.5 -10h1v2h-1z'),
  inked('M-4.5 -11.2h1v2h-1zM3.5 -11.2h1v2h-1z'),
  inked('M-4.9 -10.6h1.8v2.8h-1.8zM3.1 -10.6h1.8v2.8h-1.8z'),
]
const GLANCE_RIGHT = 2
const GLANCE_LEFT = 3

// Its face, awake: every look is there, and the trip's own keyframes show one
// at a time.
const M_FACE = `${M_BLUSH}<g class="fk0"><g class="mblink">${inked('M-4.5 -10h1v2h-1zM3.5 -10h1v2h-1z')}</g></g>${M_LOOKS.map((look, i) => `<g class="fk${i + 1}" opacity="0">${look}</g>`).join('')}`

const M_STEPPING = `<g class="mstep">${clay(M_LEGS_A)}</g><g class="mstep" style="--d:.25">${clay(M_LEGS_B)}</g>`

// What it fishes with: a rod over its left shoulder and a float on the water
// `y` below its feet, beyond the jetty or off the boat's side, shown by class
// `cls`.
function rodOf(cls: string, y: number): string {
  return `<g class="${cls}" opacity="0"><path d="M-8.5 -7.5L-21 -19" stroke="#7a5a3a" stroke-width=".7" fill="none"/><path d="M-21 -19L-25 ${f(y - 0.6)}" stroke="#fff" stroke-width=".25" opacity=".8" fill="none"/>
<ellipse cx="-25" cy="${f(y + 0.8)}" rx="3.4" ry=".9" fill="none" stroke="#fff" stroke-width=".3" opacity=".6"/><g class="mbob"><circle cx="-25" cy="${y}" r="1.1" fill="#ef4f3f"/><path d="M-26.1 ${y}a1.1 1.1 0 0 0 2.2 0z" fill="#fff"/></g></g>`
}
const M_ROD = rodOf('lrod', 4.2)
// What it looks out through on deck, held to its right eye with its arm up,
// and the notes that drift up from it as it hums.
const M_SPYGLASS = `${clay(M_ARM_UP)}<path d="M4.4 -10.4H10L16.4 -11.3V-6.9L10 -7.8H4.4Z" fill="#d6aa4c"/><path d="M10 -10.4V-7.8M14 -10.8V-7.3" stroke="#8c6a2c" stroke-width=".5"/>`
const M_NOTES = `<g fill="#e2574c" stroke="#e2574c">${[[0, 0], [-3, 1.6]].map(([x, d]) => `<g class="mzz" style="--d:${d}"><circle cx="${10 + (x ?? 0)}" cy="-15" r="1.1"/><path d="M${11 + (x ?? 0)} -15v-4.6q1.8.4 2.2 2.4" fill="none" stroke-width=".6"/></g>`).join('')}</g>`
// A coconut in one of the mascot's hands, `x` across from its middle: the
// same as one in the crate, scaled to the mascot by the boardwalk, so it looks
// the same in its hand as it did in the crate.
const nutAt = (x: number): string => `<use href="#cco" transform="translate(${x} -8.4) scale(.57)"/>`
// What it wears on the lounger, and what it holds at the bar.
// The mascot seen from the side, facing left, as it lies on the lounger:
// thinner than it is wide, one arm on its near side, two legs, and its
// sunglasses' near lens and arm.
const M_SIDE = `${clay('M-4 -13h8v10h-8zM-3 -3h1v3h-1zM2 -3h1v3h-1z')}<path d="M-1 -9h2v2h-2z" fill="#a9654b"/><path d="M-3.5 -7h2v1h-2z" fill="#e29a8f"/>${inked('M-4.3 -10.5h3.4v2.7h-3.4zM-.9 -10h3v.6h-3z')}`
const M_DRINK = `<g class="lsip" opacity="0">${nutAt(10.6)}<path d="M11 -11v-2.4l-2 -1.2" stroke="#fff" stroke-width=".5" fill="none" stroke-linejoin="round"/></g>`
// Its face asleep, and what drifts up from it then. The face lies down with
// the rest of it; the letters stay upright.
// A coconut in the mascot's left hand, a straw in it, which `lift` raises to
// drink from: shown while `held` holds it (no attributes for always), and not
// at all when there is none.
const M_HELD = `<g>${nutAt(-10.6)}<path d="M-10.8 -11v-2.6l1.8 -1.1" stroke="#fff" stroke-width=".5" fill="none" stroke-linejoin="round"/></g>`
function heldIn(held: string | undefined, lift?: string): string {
  return held === undefined ? '' : `<g ${held}>${lift === undefined ? M_HELD : `<g ${lift}>${M_HELD}</g>`}</g>`
}
const M_ASLEEP = `<g class="lnap" opacity="0">${M_BLUSH}${M_SHUT}</g>`
const M_SNORE = `<g class="lnap" opacity="0">${[0, 1.6].map(d => `<path class="mzz" style="--d:${d}" d="M9 -19h2.6l-2.6 2.6h2.6" fill="none" stroke="#fff" stroke-width=".7"/>`).join('')}</g>`
// How it lies in the hammock: on its side, head to the right, sunk into the
// cloth.
const M_LYING = 'translate(-6.5px,-8px) rotate(90deg)'
// How it lies on the lounger, seen from the side: on its back along the
// cushion, feet to the left and head raised on the backrest.
const M_RECLINE = 'translate(-12.6px,-3.7px) rotate(74deg)'

// A stretch of a run, in seconds from its start.
type Span = readonly [number, number]

function pct(part: number, whole: number): string {
  return `${Math.round((Math.max(0, Math.min(part, whole)) / Math.max(0.1, whole)) * 10000) / 100}%`
}

function joined(spans: readonly Span[]): [number, number][] {
  const out: [number, number][] = []
  for (const [from, to] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last !== undefined && from <= last[1] + 0.01) {
      last[1] = Math.max(last[1], to)
    } else {
      out.push([from, to])
    }
  }
  return out
}

// What a `whole`-second run has left outside `spans`.
function outside(spans: readonly Span[], whole: number): Span[] {
  const out: Span[] = []
  let at = 0
  for (const [from, to] of joined(spans)) {
    if (from > at) {
      out.push([at, from])
    }
    at = Math.max(at, to)
  }
  return at < whole ? [...out, [at, whole]] : out
}

// Keyframes, stepped from one to the next, that show a part only during
// `spans` of a `whole`-second run. `after` is how a run played once leaves it.
function shownIn(name: string, spans: readonly Span[], whole: number, after?: 0 | 1): string {
  const runs = joined(spans)
  const stops: [string, string][] = [['0%', `opacity:${runs[0] !== undefined && runs[0][0] <= 0 ? 1 : 0}`]]
  for (const [from, to] of runs) {
    if (from > 0) stops.push([pct(from, whole), 'opacity:1'])
    if (to < whole) stops.push([pct(to, whole), 'opacity:0'])
  }
  if (after !== undefined) stops.push(['100%', `opacity:${after}`])
  return `@keyframes ${name}{${grouped(stops)}}`
}

// Keyframe stops ([offset, declarations]) written with every offset that
// declares the same in one rule; where an offset comes twice, the later
// holds, as it would written out in turn.
function grouped(stops: readonly (readonly [string, string])[]): string {
  const at = new Map<string, string>()
  for (const [offset, says] of stops) {
    at.delete(offset)
    at.set(offset, says)
  }
  const by = new Map<string, string[]>()
  for (const [offset, says] of at) {
    by.set(says, [...(by.get(says) ?? []), offset])
  }
  return [...by].map(([says, offsets]) => `${offsets.join()}{${says}}`).join('')
}

// The CSS that takes its face through its looks: mostly straight ahead, with
// a glance, a smile or a wink between. The rhythm is drawn from `rand`, so no
// two trips share one.
function faceCss(rand: () => number): string {
  const looks: Span[][] = M_LOOKS.map(() => [])
  const calm: Span[] = []
  let t = 0
  const hold = (into: Span[] | undefined, seconds: number): void => {
    const until = Math.round((t + seconds) * 10) / 10
    into?.push([t, until])
    t = until
  }
  while (t < 64) {
    hold(calm, 2.5 + rand() * 6)
    if (rand() < 0.22) {
      // A look round: one way, then the other.
      const first = rand() < 0.5 ? GLANCE_RIGHT : GLANCE_LEFT
      hold(looks[first], 0.8 + rand())
      hold(looks[first === GLANCE_RIGHT ? GLANCE_LEFT : GLANCE_RIGHT], 0.8 + rand())
    } else {
      hold(looks[Math.floor(rand() * M_LOOKS.length)], 1 + rand() * 2.2)
    }
  }
  const rule = (i: number, spans: readonly Span[]): string => `${shownIn(`fk${i}`, spans, t)}.fk${i}{animation:fk${i} ${f3(t)}s step-end ${PHASE} infinite}`
  return rule(0, calm) + looks.map((spans, i) => rule(i + 1, spans)).join('')
}

// The CSS of the small things it does while it stands about: a hop or two, a
// wave, a lean to one side, a twirl, a bob. Each falls somewhere in `spans` of
// a `whole`-second run, drawn from `rand`; `greets` opens the first span with
// a wave and two hops, and `pause` is the longest it stands still between
// two of them. Class `name` moves the figure, `name`w shows its waving arm and
// `name`n the arm at rest.
function anticsCss(
  name: string,
  clock: (timing: string) => string,
  spans: readonly Span[],
  whole: number,
  rand: () => number,
  greets: boolean,
  pause: number,
  acts: Span[] = [],
  pastimes: readonly Pastime[] = [],
): string {
  const still = [0, whole]
  const waves: Span[] = []
  const poses: [string, string][] = []
  const pose = (at: number, transform: string): void => {
    poses.push([pct(at, whole), `transform:${transform}`])
  }
  for (const { span, sway } of pastimes) {
    still.push(...span)
    acts.push(span)
    sway.forEach(([at, transform]) => pose(at, transform))
  }
  const armUp = pastimes.filter(p => p.armUp).map(p => p.span)
  const hopAt = (at: number): number => {
    still.push(at, at + 0.44)
    pose(at + 0.22, 'translateY(-3px)')
    return 0.44
  }
  // Each with the longest it can take, so that one is started only where it
  // fits.
  const kinds: readonly { needs: number; run: (at: number) => number }[] = [
    { needs: 0.5, run: hopAt },
    { needs: 0.9, run: at => hopAt(at) + hopAt(at + 0.44) },
    {
      needs: 3.6,
      run: at => {
        const seconds = 2 + rand() * 1.6
        waves.push([at, at + seconds])
        return seconds
      },
    },
    {
      needs: 3.2,
      run: at => {
        const lean = `rotate(${rand() < 0.5 ? -7 : 7}deg)`
        const seconds = 1.6 + rand() * 1.6
        still.push(at, at + seconds)
        pose(at + 0.4, lean)
        pose(at + seconds - 0.4, lean)
        return seconds
      },
    },
    {
      needs: 0.9,
      run: at => {
        still.push(at, at + 0.9)
        pose(at + 0.45, 'scaleX(-1)')
        return 0.9
      },
    },
    {
      needs: 0.6,
      run: at => {
        still.push(at, at + 0.3, at + 0.6)
        pose(at + 0.15, 'scaleY(.84)')
        pose(at + 0.45, 'scaleY(.84)')
        return 0.6
      },
    },
  ]
  spans.forEach(([from, to], i) => {
    let at = from + 0.4 + rand() * 2.5
    if (greets && i === 0) {
      waves.push([from + 0.3, from + 3.4])
      hopAt(from + 0.6)
      hopAt(from + 1.5)
      at = from + 4.5 + rand() * 2
    }
    while (at + 0.6 < to) {
      const act = kinds[Math.floor(rand() * kinds.length)]
      if (act !== undefined && at + act.needs < to) {
        const from = at
        at += act.run(at)
        acts.push([from, at])
      }
      at += 2 + rand() * (pause - 2)
    }
  })
  const rest = still.map((at): [string, string] => [pct(at, whole), 'transform:none'])
  return `@keyframes ${name}{${grouped([...rest, ...poses])}}.${name}{animation:${name} ${clock('ease-in-out')}}
${shownIn(`${name}w`, waves, whole)}.${name}w{animation:${name}w ${clock('step-end')}}${shownIn(`${name}n`, outside([...waves, ...armUp], whole), whole)}.${name}n{animation:${name}n ${clock('step-end')}}${pastimes.map(p => `${shownIn(p.cls, [p.span], whole)}.${p.cls}{animation:${p.cls} ${clock('step-end')}}`).join('')}`
}

// Something the mascot does for a while, `span` of its run, showing the part
// of class `cls` and leaning as `sway` says ([second, transform]); `armUp`
// when that part raises its right arm.
type Pastime = { cls: string; span: Span; sway: readonly (readonly [number, string])[]; armUp: boolean }

// The mascot as it rides the lead boat, doing what the trip's own keyframes
// have it do; it has its rod, spyglass and tune for those of its pastimes on
// deck that `busy` names. Hailing the person, it puts them by and waves and
// hops without a pause, in a beat that starts as the hailing does; once that
// stops, a hop under way comes down rather than vanishing. `isStill` has it
// just stand, out of the antics, though it still hails.
function rider(flag: Flag, busy: readonly string[], isStill = false): string {
  const isHailing = flag.to !== 'none'
  const hailed = flag.hailed ?? flag.age
  let hop = ''
  if (isHailing) {
    hop = `style="animation:mhops ${HAIL_S}s ease-in-out ${f3(-hailed)}s infinite"`
  } else if (flag.from !== 'none') {
    const into = Math.max(0, hailed - flag.age) % HAIL_S
    if (into > HAIL_S * 0.7) {
      hop = `style="animation:mhops ${HAIL_S}s ease-in-out ${f3(-(into + flag.age))}s 1 both"`
    }
  }
  const arm = isHailing
    ? `<g class="mwave">${clay(M_ARM_UP)}</g>`
    : isStill
      ? clay(M_ARM_R)
      : `<g class="can">${clay(M_ARM_R)}</g><g class="caw" opacity="0"><g class="mwave">${clay(M_ARM_UP)}</g></g>`
  const has = (cls: string): boolean => !isHailing && !isStill && busy.includes(cls)
  const part = (cls: string, inner: string): string => (has(cls) ? `<g class="${cls}" opacity="0">${inner}</g>` : '')
  return `<g${isStill ? '' : ' class="ca"'}><g ${hop}>${has('cfi') ? rodOf('cfi', 9.6) : ''}${clay(M_BODY + M_ARM_L + M_LEGS_A + M_LEGS_B)}${arm}${M_FACE}${part('csp', M_SPYGLASS)}${part('chu', M_NOTES)}</g></g>`
}

// The mascot on its way to or from the boat, at the scale it has on the sand.
// `gait` and `rest` hold the attributes that show its stepping legs on the
// stretches it walks and its legs at rest on the others.
// `lie` holds the attributes that turn it upright from lying down, where it
// sets out from the hammock or the lounger.
// Getting off the lounger it starts side on: `turn` then holds the attributes
// of its front and its side as it turns to face the front.
function walker(gait: string, rest: string, lie = '', turn?: { front: string; side: string }, held?: string, scale = 2.4, lift?: string): string {
  const figure = `${clay(M_BODY + M_ARM_L + M_ARM_R)}<g ${rest}>${clay(M_LEGS_A + M_LEGS_B)}</g><g ${gait} opacity="0">${M_STEPPING}</g>${M_FACE}${heldIn(held, lift)}`
  const body = turn === undefined ? figure : `<g ${turn.front} transform="scale(0 1)">${figure}</g><g ${turn.side}>${M_SIDE}</g>`
  return `<g transform="scale(${scale})"><g ${lie}>${body}</g></g>`
}

// The mascot living its day on the island: one figure whose stepping legs,
// rod, shades, drink and sleeping face each show for their part of that day,
// and which lies on its side while it naps.
function islander(): string {
  return `<g transform="scale(2.4)"><g class="la"><g class="llie"><g class="lfr">${M_ROD}${clay(M_BODY + M_ARM_L)}<g class="lan">${clay(M_ARM_R)}</g><g class="law" opacity="0"><g class="mwave">${clay(M_ARM_UP)}</g></g>
<g class="lrest">${clay(M_LEGS_A + M_LEGS_B)}</g><g class="lgait" opacity="0">${M_STEPPING}</g>
<g class="lawake">${M_FACE}</g>${M_ASLEEP}${M_DRINK}</g><g class="lsd" transform="scale(0 1)">${M_SIDE}</g></g>${M_SNORE}</g></g>`
}

// The CSS of the mascot's day: where it is, which of its parts show while it
// does each thing, and what it gets up to while it stands about.
function dayCss(day: Day, rand: () => number, greets: boolean, isPlain: boolean): string {
  const { steps, span } = day
  const clock = (timing: string): string => `${f(span)}s ${timing} calc(var(--n,0) * -1s) infinite`
  const during = (test: (doing: Doing) => boolean): Span[] => {
    const spans: Span[] = []
    let from = 0
    for (const step of steps) {
      if (test(step.doing)) {
        spans.push([from, step.until])
      }
      from = step.until
    }
    return spans
  }
  const part = (name: string, test: (doing: Doing) => boolean): string => `${shownIn(name, during(test), span)}.${name}{animation:${name} ${clock('step-end')}}`
  const place = steps.map(step => `${pct(step.until, span)}{transform:translate(${step.x}px,${step.y}px)}`).join('')
  const idle = during(doing => doing === 'stand').filter(([from, to]) => to - from >= 3)
  // It turns onto its side as it climbs into the hammock or onto the lounger,
  // and upright again as it climbs out.
  // Onto the lounger it first turns side on, then lies back; off it, it sits
  // up and then turns to face the front again.
  const poses: Record<string, number[]> = { none: [0, span], [M_LYING]: [], [M_RECLINE]: [] }
  const facing: { front: [number, number][]; side: [number, number][] } = { front: [], side: [] }
  steps.forEach((step, i) => {
    const pose = step.doing === 'nap' ? M_LYING : step.doing === 'sun' ? M_RECLINE : undefined
    const a = steps[i - 2]?.until ?? 0
    const b = steps[i - 1]?.until ?? 0
    const d = steps[i + 1]?.until ?? span
    if (pose === M_RECLINE) {
      const on = b - a
      const off = d - step.until
      poses.none?.push(a + 0.4 * on, step.until + 0.6 * off)
      facing.front.push([a, 1], [a + 0.2 * on, 0], [step.until + 0.8 * off, 0], [d, 1])
      facing.side.push([a + 0.2 * on, 0], [a + 0.4 * on, 1], [step.until + 0.6 * off, 1], [step.until + 0.8 * off, 0])
    } else if (pose !== undefined) {
      poses.none?.push(a, d)
    }
    if (pose !== undefined) {
      poses[pose]?.push(b, step.until)
    }
  })
  // Turned as it was drawn (`rest`) before its first turn and after its last.
  const turned = (name: string, stops: [number, number][], rest: number): string =>
    stops.length === 0 ? '' : `@keyframes ${name}{0%,100%{transform:scaleX(${rest})}${stops.map(([at, x]) => `${pct(at, span)}{transform:scaleX(${x})}`).join('')}}.${name}{animation:${name} ${clock('ease-in-out')}}`
  const stops = (times: readonly number[]): string => [...new Set(times.map(at => pct(at, span)))].join()
  const held = Object.entries(poses).filter(([, times]) => times.length > 0)
  const lies = held.length < 2 ? '' : `@keyframes llie{${held.map(([pose, times]) => `${stops(times)}{transform:${pose}}`).join('')}}.llie{animation:llie ${clock('ease-in-out')}}`
  // It stands in front of the lounger as it climbs on from the front, and
  // behind it everywhere else.
  const before: Span[] = []
  steps.reduce<Point>((last, step, i) => {
    if (isByLounger(step) || isByLounger(last)) {
      before.push([steps[i - 1]?.until ?? 0, step.until])
    }
    return step
  }, HOME)
  const front = `${shownIn('lfront', outside(before, span), span)}.lfront{animation:lfront ${clock('step-end')}}`
  return `${front}@keyframes lpos{0%{transform:translate(${HOME.x}px,${HOME.y}px)}${place}}.lpos{animation:lpos ${clock('linear')}}
${part('lgait', doing => doing === 'walk')}${part('lrest', doing => doing !== 'walk')}${part('lrod', doing => doing === 'fish')}${part('lnap', doing => doing === 'nap')}${part('lawake', doing => doing !== 'nap')}${part('lsip', doing => doing === 'sip')}
${lies}${turned('lfr', facing.front, 1)}${turned('lsd', facing.side, 0)}${isPlain ? '' : anticsCss('la', clock, idle, span, rand, greets, 7)}`
}

// The attributes of a group that plays keyframes `name` once over `span`
// seconds, `t` seconds in, and then stays as the keyframes left it: `once`
// runs smoothly from one keyframe to the next, `stepped` jumps. Their classes
// set each animation property by name: in the `animation` shorthand a leading
// `none` reads as the fill mode, and the group would spring back at the end.
function once(name: string, span: number, t: number): string {
  return `class="way" style="animation-name:${name};--e:${f3(Math.max(0.1, span))}s;--a:${f3(t)}"`
}

function stepped(name: string, span: number, t: number): string {
  return `class="cut" style="animation-name:${name};--e:${f3(Math.max(0.1, span))}s;--a:${f3(t)}"`
}

// Keyframes that carry a group along `legs` over `span` seconds:
// `${name}x` moves it sideways and `${name}y` up and down, for two nested
// groups. A straight stretch is two keyframes paced by its own curve, and so
// is the sideways travel of a stretch that glides; the rest is a string of
// short straight steps.
function track(name: string, legs: readonly Leg[], span: number): string {
  type Stop = { at: number; v: number; ease: string }
  const across: Stop[] = []
  const down: Stop[] = []
  for (const leg of legs) {
    const sideways = leg.curve ?? leg.glide
    if (sideways !== undefined) {
      across.push({ at: leg.from, v: leg.at(0).x, ease: timing(sideways) }, { at: leg.to, v: leg.at(1).x, ease: '' })
    }
    if (leg.curve !== undefined) {
      down.push({ at: leg.from, v: leg.at(0).y, ease: timing(leg.curve) }, { at: leg.to, v: leg.at(1).y, ease: '' })
    }
    if (sideways === undefined || leg.curve === undefined) {
      const parts = Math.max(6, Math.min(14, Math.round((leg.to - leg.from) / 0.4)))
      for (let i = 0; i <= parts; i++) {
        const at = leg.from + (i / parts) * (leg.to - leg.from)
        const p = leg.at(i / parts)
        if (sideways === undefined) {
          across.push({ at, v: p.x, ease: '' })
        }
        down.push({ at, v: p.y, ease: '' })
      }
    }
  }
  const frames = (axis: 'X' | 'Y', stops: readonly Stop[]): string => {
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (first === undefined || last === undefined) {
      return ''
    }
    const all = [{ ...first, at: 0, ease: '' }, ...stops, { ...last, at: span }]
    let out = ''
    // The value of the last stop written.
    let said: number | undefined
    all.forEach((stop, i) => {
      const next = all[i + 1]
      const v = Math.round(stop.v)
      // Where one stretch ends as the next begins, the next one's pace holds;
      // and a stop in the middle of a stay where it is says nothing new.
      const isStay = next !== undefined && said === v && Math.round(next.v) === v
      if ((next === undefined || pct(next.at, span) !== pct(stop.at, span)) && !isStay) {
        out += `${pct(stop.at, span)}{transform:translate${axis}(${v}px)${stop.ease === '' ? '' : `;animation-timing-function:${stop.ease}`}}`
        said = v
      }
    })
    return `@keyframes ${name}${axis.toLowerCase()}{${out}}`
  }
  return frames('X', across) + frames('Y', down)
}

// Keyframes that size the lead boat along `legs` over `span` seconds, as a
// share of `base`, the size it is drawn at: each leg runs from the boat's
// size at one end to its size at the other, paced as the boat moves. None
// when it keeps its size.
function sizeTrack(name: string, legs: readonly Leg[], span: number, base: number): string {
  const share = (p: Point): number => Math.round((sizeOn(LEAD_BOAT, p) / base) * 1000) / 1000
  const stops = legs.flatMap(leg => [
    { at: leg.from, k: share(leg.at(0)), ease: leg.curve === undefined ? '' : `;animation-timing-function:${timing(leg.curve)}` },
    { at: leg.to, k: share(leg.at(1)), ease: '' },
  ])
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (first === undefined || last === undefined || stops.every(s => Math.abs(s.k - 1) < 0.01)) {
    return ''
  }
  const all = [{ ...first, at: 0, ease: '' }, ...stops, { ...last, at: span }]
  // Where one leg ends as the next begins, the next one's pace holds.
  const frames = all.filter((s, i) => pct(all[i + 1]?.at ?? -1, span) !== pct(s.at, span)).map(s => `${pct(s.at, span)}{transform:scale(${s.k})${s.ease}}`)
  return `@keyframes ${name}{${frames.join('')}}`
}

// The attributes of the two nested groups that carry something along a
// track `name` laid over `span` seconds, `t` seconds in, from `now`.
function tracked(name: string, span: number, t: number, now: Point, inner: string): string {
  return `<g ${once(`${name}x`, span, t)} transform="translate(${f(now.x)} 0)"><g ${once(`${name}y`, span, t)} transform="translate(0 ${f(now.y)})">${inner}</g></g>`
}

// Keyframes that draw a boat's wake out as it gathers way along `legs` and
// in again as it slows: none below WAKE_FROM px a second across the view,
// growing with its speed to the full wake at WAKE_FULL. The wake trails off
// its stern across the view, so only its way across counts: making out into
// the lagoon or back in, it raises little.
const WAKE_FROM = 15
const WAKE_FULL = 90
function wakeOf(name: string, legs: readonly Leg[], span: number): string {
  let frames = ''
  let last = ''
  for (const leg of legs) {
    const seconds = Math.max(0.001, leg.to - leg.from)
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const a = leg.at(Math.max(0, p - 0.02))
      const b = leg.at(Math.min(1, p + 0.02))
      const speed = Math.abs(b.x - a.x) / ((Math.min(1, p + 0.02) - Math.max(0, p - 0.02)) * seconds)
      const way = Math.max(0, Math.min(1, (speed - WAKE_FROM) / (WAKE_FULL - WAKE_FROM)))
      const at = pct(leg.from + p * seconds, span)
      if (at !== last) {
        frames += `${at}{transform:scaleX(${f(0.15 + 0.85 * way)});opacity:${f(way)}}`
        last = at
      }
    }
  }
  return frames === '' ? '' : `@keyframes ${name}{${frames}}`
}

// Keyframes that turn a boat about wherever its course changes heading.
// Keyframes that follow the boat's facing through `points` ([seconds,
// scaleX]) as `as` turns each facing into a transform. The midpoint of each
// turn, where it is seen bow on, is kept as a keyframe of its own.
function facing(name: string, points: readonly [number, number][], span: number, as: (side: number) => string): string {
  const all: [number, number][] = []
  points.forEach(([at, side], i) => {
    const last = points[i - 1]
    if (last !== undefined && last[1] * side < 0) {
      all.push([last[0] + ((at - last[0]) * last[1]) / (last[1] - side), 0])
    }
    all.push([at, side])
  })
  const frames = all.map(([at, side]) => `${pct(at, span)}{transform:${as(side)}}`).join('')
  return `@keyframes ${name}{${frames}100%{transform:${as(all[all.length - 1]?.[1] ?? 1)}}}`
}

// How long the captain's antics run before they come round again, and what it
// settles to for a while among them: fishing over the side, looking out
// through a spyglass as it turns slowly from side to side, and humming to
// itself as it sways to the tune.
const CAPTAIN_S = 210
const lean = (from: number, to: number, beat: number, deg: number): [number, string][] =>
  Array.from({ length: Math.floor((to - from - 1) / beat) }, (_, i) => [from + 1 + i * beat, `rotate(${i % 2 === 0 ? deg : -deg}deg)`])
const ON_DECK: readonly Pastime[] = [
  { cls: 'cfi', span: [8, 68], sway: [], armUp: false },
  { cls: 'csp', span: [100, 122], sway: lean(100, 122, 9.5, 3), armUp: true },
  { cls: 'chu', span: [150, 180], sway: lean(150, 180, 4.8, 5), armUp: false },
]
const LEAD_BOAT: Boat = { kind: 'lead', slot: 0, from: 'R', pass: 'under', born: 0, gone: undefined }
// What the mascot gets up to by the crate while it waits for the seaplane, on
// the wall clock like its antics on deck: a look through its spyglass towards
// where the plane comes in, and a tune it sways to.
const ON_PIER: readonly Pastime[] = [
  { cls: 'qsp', span: WAITER_BUSY.spyglass, sway: lean(...WAITER_BUSY.spyglass, 3.5, 3), armUp: true },
  { cls: 'qhu', span: WAITER_BUSY.tune, sway: lean(...WAITER_BUSY.tune, 1.2, 5), armUp: false },
]

// The mascot waiting by the crate, put through the antics named `WAITER`
// (with its `n` and `w` arms).
const WAITER = 'pq'
function waiter(): string {
  return `<g class="${WAITER}">${clay(M_BODY + M_ARM_L + M_LEGS_A + M_LEGS_B)}<g class="${WAITER}n">${clay(M_ARM_R)}</g><g class="${WAITER}w" opacity="0"><g class="mwave">${clay(M_ARM_UP)}</g></g>${M_FACE}<g class="qsp" opacity="0">${M_SPYGLASS}</g><g class="qhu" opacity="0">${M_NOTES}</g></g>`
}


// How long a trip by the boardwalk is timed over, for the parts of it on and
// about the walk to share their keyframes.
function errandSpan(plan: Plan): number {
  const back = plan.errand?.back ?? 0
  return Math.max(plan.settled, plan.gone, Number.isFinite(back) ? back : 0) + 1
}

// The coconut in the mascot's hand `t` seconds into a trip by the boardwalk,
// as the attributes that show it from each one it takes from the crate until
// it tosses the shell into the sea (undefined while it holds none for the rest of
// the trip), and the keyframes they play.
function holding(plan: Plan, t: number): { attrs: string | undefined; css: string } {
  const errand = plan.errand
  if (errand === undefined || errand.takes.length === 0) {
    return { attrs: undefined, css: '' }
  }
  const span = errandSpan(plan)
  const spans = errand.takes.map((at, k): Span => [at, errand.tosses[k] ?? span])
  const last = spans[spans.length - 1]
  if (last === undefined || t >= last[1]) {
    return { attrs: undefined, css: '' }
  }
  const isNow = spans.some(([from, to]) => t >= from && t < to)
  return { attrs: `${stepped('vhd', span, t)}${isNow ? '' : ' opacity="0"'}`, css: shownIn('vhd', spans, span, 0) }
}

// The mascot off the boat on the boardwalk, if the trip takes it there: on
// its feet from hopping off to hopping aboard again, smaller there than on the
// island, with the coconut in its hand as `hand` says and lifting it to drink
// while it finishes one at the crate. It is drawn behind the boats on the
// walk (`back`), and over them as it hops between the walk and the deck
// (`front`, a copy). `deck` holds the attributes that hide it on deck meanwhile.
// The trip began at `began` (clock ms); the seaplane it waits for, if any,
// starts on its cargo `swap` seconds into it.
function onWalk(plan: Plan, began: number, t: number, hand: { attrs: string | undefined }, swap: number | undefined, isPlain: boolean): { back: string; front: string; css: string; deck: string } {
  const errand = plan.errand
  if (errand === undefined || t >= errand.back) {
    return { back: '', front: '', css: '', deck: '' }
  }
  const span = errandSpan(plan)
  const isOff = t >= errand.off
  const strides = errand.walk.filter(leg => leg.stride).map((leg): Span => [leg.from, leg.to])
  const ashore: Span[] = [[errand.off, errand.back]]
  // Waiting for the seaplane, it stays on the walk.
  const stays: 0 | 1 = Number.isFinite(errand.back) ? 0 : 1
  const rest = 'transform:translate(0px,0px)'
  const sips = errand.sips.length === 0 ? '' : `@keyframes vqd{${grouped([['0%', rest], ...errand.sips.flatMap(([a, b]): [string, string][] => [[pct(a, span), rest], [pct(a + 0.4, span), 'transform:translate(3.2px,-2.6px)'], [pct(b - 0.4, span), 'transform:translate(3.2px,-2.6px)'], [pct(b, span), rest]]), ['100%', rest]])}}`
  const walking = walker(stepped('vqg', span, t), stepped('vqs', span, t), '', undefined, hand.attrs, 2.4 * PIER_SCALE, errand.sips.length === 0 ? undefined : once('vqd', span, t))
  // Waiting for the seaplane, from the first moment it is at ease by the
  // crate until the plane starts on its cargo (`swap`, when known, itself a
  // moment at ease), it passes the time.
  const reached = stays === 1 ? (waiterAtEase(began + (errand.walk[errand.walk.length - 1]?.to ?? 0) * 1000) - began) / 1000 : 0
  const isPassing = stays === 1 && !isPlain && (swap === undefined || swap > reached)
  const until = swap ?? Infinity
  const whole = Math.max(span, Number.isFinite(until) ? until + 1 : 0)
  const isIdle = t >= reached && t < until
  const passing = isPassing
    ? `${shownIn('vqz', outside([[reached, Math.min(until, whole)]], whole), whole, swap === undefined ? 0 : 1)}${shownIn('vqa', [[reached, Math.min(until, whole)]], whole, swap === undefined ? 1 : 0)}${anticsCss(WAITER, timing => `${WAITER_S}s ${timing} ${PHASE} infinite`, [], WAITER_S, scatter(WAITER_S), false, 6, [], ON_PIER)}`
    : ''
  const figure = isPassing
    ? `<g ${stepped('vqz', whole, t)}${isIdle ? ' opacity="0"' : ''}>${walking}</g><g ${stepped('vqa', whole, t)}${isIdle ? '' : ' opacity="0"'}><g transform="scale(${2.4 * PIER_SCALE})">${waiter()}</g></g>`
    : walking
  const hops = errand.walk.filter(leg => leg.hop !== undefined).map((leg): Span => [leg.from, leg.to])
  const isHopping = hops.some(([from, to]) => t >= from && t < to)
  return {
    back: `<g ${stepped('vqw', span, t)}${isOff ? '' : ' opacity="0"'}><g ${stepped('vqb', span, t)}${isHopping ? ' opacity="0"' : ''}><g id="qwt">${tracked('vqp', span, t, along(errand.walk, t), figure)}</g></g></g>`,
    front: `<g ${stepped('vqf', span, t)}${isHopping ? '' : ' opacity="0"'}><use href="#qwt"/></g>`,
    css: `${track('vqp', errand.walk, span)}${shownIn('vqg', strides, span, 0)}${shownIn('vqs', outside(strides, span), span, 1)}${shownIn('vqw', ashore, span, stays)}${shownIn('vqk', outside(ashore, span), span, stays === 1 ? 0 : 1)}${shownIn('vqf', hops, span, 0)}${shownIn('vqb', outside(hops, span), span, 1)}${sips}${passing}`,
    deck: `${stepped('vqk', span, t)}${isOff ? ' opacity="0"' : ''}`,
  }
}

// Where the crate's coconuts sit, from left to right.
const CRATE_SLOTS: readonly Point[] = Array.from({ length: COCONUTS }, (_, i) => ({ x: CRATE.x - 24 + i * 12, y: WALK.y - 15 }))
// The mascot's left hand as it stands at the crate.
const HAND_AT_CRATE: Point = { x: AT_CRATE.x - 10.6 * 2.4 * PIER_SCALE, y: AT_CRATE.y - 8.4 * 2.4 * PIER_SCALE }
// Where a shell tossed from the walk drops into the sea, in front of it.
const SPLASH: Point = { x: AT_CRATE.x - 30, y: 604 }
// Where the coconuts the seaplane brings are thrown from: its open door.
const DOOR: Point = { x: MOOR.x + 9, y: MOOR.y - 27 }

// A fresh coconut, green, and an empty shell, brown with its hole showing.
const coconut = (at: Point): string => `<use href="#cco" x="${f(at.x)}" y="${f(at.y)}"/>`
const husk = (at: Point): string => `<use href="#cch" x="${f(at.x)}" y="${f(at.y)}"/>`

// The crate's top, with a dark hollow for each coconut a full crate holds, so
// the empty places show how many are gone; drawn behind the coconuts. And its
// front, drawn over their bottoms.
const CRATE_TOP = `<g transform="translate(${CRATE.x} ${WALK.y})"><rect x="-31" y="-14.5" width="62" height="3.5" rx="1.2" class="deck"/><path fill="#3a2716" d="${CRATE_SLOTS.map(slot => `M${slot.x - CRATE.x - 4} -14h8v1.8h-8z`).join('')}"/></g>`
const CRATE_BOX = `<g transform="translate(${CRATE.x} ${WALK.y})"><rect x="-31" y="-11.5" width="62" height="11.5" rx="1.5" class="wall"/><path class="post" stroke-width="1.2" d="M-31 -5.7h62M-15.5 -11.5v11.5M15.5 -11.5v11.5"/></g>`

// The keyframes that carry `name` from `a` to `b` (offsets from where it is
// drawn) over `[start, end)` of `span`, in an arc rising `lift` above the
// higher end: x at an even pace, y up and then down.
function arc(name: string, a: Point, b: Point, start: number, end: number, span: number, lift: number): string {
  const top = Math.min(a.y, b.y) - lift
  const from = start > 0 ? `0%,${pct(start, span)}` : '0%'
  const to = end < span ? `${pct(end, span)},100%` : '100%'
  return `@keyframes ${name}x{${from}{transform:translateX(${f(a.x)}px)}${to}{transform:translateX(${f(b.x)}px)}}@keyframes ${name}y{${from}{transform:translateY(${f(a.y)}px);animation-timing-function:ease-out}${pct((start + end) / 2, span)}{transform:translateY(${f(top)}px);animation-timing-function:ease-in}${to}{transform:translateY(${f(b.y)}px)}}`
}

// The crate of coconuts on the boardwalk, as the pantry stands; on a trip by
// the walk, each coconut the mascot takes rises from the crate into its hand,
// and each shell it tosses arcs from its hand into the sea with a splash;
// and, the seaplane handing over its cargo, each coconut thrown down from
// the door into the mascot's hand and set in the crate.
function larder(after: Pantry, voyage: Voyage, seconds: number): { svg: string; css: string } {
  const filled = after.filled
  if (filled !== undefined && seconds - filled.at / 1000 < swapSeconds(after.stock - filled.stock)) {
    return handedOver(after, filled, seconds)
  }
  const plan = planOf(voyage)
  const t = seconds - voyage.at / 1000
  // Out by the boardwalk, the coconuts as they stood as it set out, with what
  // the mascot does to them on its way; otherwise as they stand.
  const isOut = voyage.errand !== undefined && plan.errand !== undefined && t < plan.errand.back
  const errand = isOut ? plan.errand : undefined
  const pantry: Pantry = isOut && voyage.errand !== undefined ? voyage.errand.from : after
  const span = errandSpan(plan)
  let css = ''
  const parts: string[] = [CRATE_TOP]
  const takes = errand?.takes ?? []
  const tosses = errand?.tosses ?? []
  // In the crate, the rightmost first to go.
  CRATE_SLOTS.slice(0, pantry.stock).forEach((slot, i) => {
    const k = pantry.stock - 1 - i
    const at = takes[k]
    if (at === undefined || t >= at) {
      if (at === undefined) parts.push(coconut(slot))
      return
    }
    const name = `vkt${k}`
    const dx = HAND_AT_CRATE.x - slot.x
    const dy = HAND_AT_CRATE.y - slot.y
    css += `@keyframes ${name}{0%,${pct(at - TAKE_S, span)}{transform:translate(0,0)}${pct(at, span)},100%{transform:translate(${f(dx)}px,${f(dy)}px)}}${shownIn(`${name}v`, [[0, at]], span, 0)}`
    parts.push(`<g ${stepped(`${name}v`, span, t)}><g ${once(name, span, t)}>${coconut(slot)}</g></g>`)
  })
  parts.push(CRATE_BOX)
  // Each shell drunk, tossed from the mascot's hand into the sea, where it
  // throws up spray and a ring of foam: every toss plays the same keyframes,
  // from its own moment.
  const splashing = tosses.filter(at => t < at + TOSS_S + SPLASH_S)
  if (splashing.length > 0) {
    css += TOSSED
  }
  for (const at of splashing) {
    const age = t - at
    const lands = age - TOSS_S
    parts.push(`<g ${stepped('vksv', TOSS_S, age)}${age >= 0 && age < TOSS_S ? '' : ' opacity="0"'}><g ${once('vksx', TOSS_S, age)}><g ${once('vksy', TOSS_S, age)}>${husk(SPLASH)}</g></g></g>`)
    parts.push(`<g transform="translate(${SPLASH.x} ${SPLASH.y}) scale(.6)"><g ${once('vksr', SPLASH_S, lands)} opacity="0"><use href="#drg"/></g><g ${once('vkss', SPLASH_S, lands)} opacity="0"><use href="#dsp"/></g></g>`)
  }
  return { svg: `<g>${parts.join('')}</g>`, css }
}

// The seaplane handing over its cargo `seconds` on the clock: each coconut
// it brings thrown down from its door into the mascot's hand, held a moment
// and set in the next empty place in the crate.
function handedOver(after: Pantry, filled: { at: number; stock: number }, seconds: number): { svg: string; css: string } {
  const age = seconds - filled.at / 1000
  const span = swapSeconds(after.stock - filled.stock)
  let css = after.stock > filled.stock ? THROWN : ''
  const parts: string[] = [CRATE_TOP, ...CRATE_SLOTS.slice(0, filled.stock).map(coconut)]
  CRATE_SLOTS.slice(filled.stock, after.stock).forEach((slot, k) => {
    const thrown = SWAP.first + k * SWAP.each
    const set = thrown + SWAP.toss + SWAP.held
    // Thrown in an arc into the hand, held, then lowered into its place.
    css += `@keyframes vkd${k}{0%,${pct(set, span)}{transform:translate(0,0)}${pct(set + SWAP.place, span)},100%{transform:translate(${f(slot.x - HAND_AT_CRATE.x)}px,${f(slot.y - HAND_AT_CRATE.y)}px)}}`
    parts.push(`<g ${stepped('vkdv', SWAP.toss, age - thrown)}${age >= thrown ? '' : ' opacity="0"'}><g ${once(`vkd${k}`, span, age)}><g ${once('vkdx', SWAP.toss, age - thrown)}><g ${once('vkdy', SWAP.toss, age - thrown)}>${coconut(HAND_AT_CRATE)}</g></g></g></g>`)
  })
  parts.push(CRATE_BOX)
  return { svg: `<g>${parts.join('')}</g>`, css }
}
// How long a coconut takes to rise from the crate into the mascot's hand, a
// shell to arc from its hand into the sea, and its splash to die away.
const TAKE_S = 0.45
const TOSS_S = 0.7
const SPLASH_S = 1.2
// The keyframes every tossed shell plays from its own moment: its arc from
// the hand into the sea, then the spray and the ring of foam where it lands.
const TOSSED = `${arc('vks', { x: HAND_AT_CRATE.x - SPLASH.x, y: HAND_AT_CRATE.y - SPLASH.y }, { x: 0, y: 0 }, 0, TOSS_S, TOSS_S, 12)}${shownIn('vksv', [[0.05, TOSS_S]], TOSS_S, 0)}@keyframes vkss{0%{opacity:0;transform:scale(.3,.1)}12%{opacity:.9;transform:scale(1)}60%,100%{opacity:0;transform:scale(1.15,1.3)}}@keyframes vksr{0%{opacity:0;transform:scale(.4)}17%{opacity:.8;transform:scale(.7)}100%{opacity:0;transform:scale(2)}}`
// And every coconut the seaplane throws: its arc from the door into the
// mascot's hand, and in sight from then on.
const THROWN = `${arc('vkd', { x: DOOR.x - HAND_AT_CRATE.x, y: DOOR.y - HAND_AT_CRATE.y }, { x: 0, y: 0 }, 0, SWAP.toss, SWAP.toss, 8)}${shownIn('vkdv', [[0.05, SWAP.toss]], SWAP.toss, 1)}`

// The lead boat and the mascot at `seconds` on the clock. On a fetch the boat
// comes in to the jetty, the mascot walks out along it and hops aboard, and
// the boat carries it to its circuit; on a landing the boat makes for the
// jetty, the mascot hops off and walks home to its day, and the boat goes out
// by an edge. `early` is the mascot drawn under the hammock and behind the
// boats, `late` the mascot drawn over the boats while it is on deck or
// hopping between deck and jetty. `isPlain` leaves out the antics, for a
// scene short of room.
function trip(voyage: Voyage, seconds: number, flag: Flag, isPlain: boolean, plane?: Plane): { boat: string; depth: (later: number) => number; x: (later: number) => number; sails: number; early: string; late: string; walk: string; css: string } {
  const t = seconds - voyage.at / 1000
  const plan = planOf(voyage)
  // The coconut in the mascot's hand by the crate, and the mascot off the
  // boat on the boardwalk.
  const hand = holding(plan, t)
  // The seaplane starting on its cargo, for the mascot waiting for it.
  const swap = plane?.swap === undefined ? undefined : (plane.swap - voyage.at) / 1000
  const walk = onWalk(plan, voyage.at, t, hand, swap, isPlain)
  const rand = scatter(voyage.at)
  const faces = faceCss(rand)
  const route = routeOf(LEAD_BOAT)
  const hull = (wake?: string, scale = route.scale): string => `<g transform="scale(${scale})"><g class="boat">${leadBoat(flag, wake)}</g></g>`
  // The boat on a course of its own, turning about as the course does.
  const turning = turns(plan.boat, voyage.facing)
  // How near the boat sails `later` seconds from now, for painting it among
  // the fleet: along its course, then on its circuit.
  // Sent to wait for the seaplane, it lies off the boardwalk for good.
  const isWaiting = voyage.wait === true
  const isCoursing = (at: number): boolean => plan.boat.length > 0 && (isWaiting || at < (voyage.phase === 'fetch' ? plan.settled : plan.gone))
  const depth = (later: number): number =>
    isCoursing(t + later) ? along(plan.boat, t + later).y : voyage.phase === 'fetch' ? circuitAt(t + later - plan.settled).y : route.cy
  // And where across the view it is: along its course, round its circuit,
  // moored, or gone.
  const x = (later: number): number =>
    isCoursing(t + later) ? along(plan.boat, t + later).x : voyage.phase === 'fetch' ? circuitAt(t + later - plan.settled).x : t + later < plan.gone ? DOCK.x : -9999
  const sails = Math.max(0, (voyage.phase === 'fetch' || isWaiting ? plan.settled : plan.gone) - t)
  // What it gets up to on deck runs on the wall clock and is the same from
  // one trip to the next, so it carries on unbroken as one trip gives way to
  // another. Brought home, it rests on deck: an antic or pastime it was in
  // the middle of as the trip began plays out, and no other starts.
  const acts: Span[] = []
  const antics = isPlain ? '' : anticsCss('ca', timing => `${CAPTAIN_S}s ${timing} ${PHASE} infinite`, outside(ON_DECK.map(p => p.span), CAPTAIN_S), CAPTAIN_S, scatter(CAPTAIN_S), false, 11, acts, ON_DECK)
  const inLoop = (wall: number): number => (wall % 100000) % CAPTAIN_S
  const began = inLoop(voyage.at / 1000)
  const act = acts.find(([from, to]) => began > from && began < to)
  const isCalming = act !== undefined && inLoop(seconds) >= began && inLoop(seconds) < act[1]
  const pastime = ON_DECK.find(p => act !== undefined && p.span[0] === act[0])?.cls
  // The mascot on deck, with what it needs for its pastimes: all of them on
  // the way out, only the one it is finishing on the way home. A fetch draws
  // the boat twice, on its course and on its circuit: just aboard, the mascot
  // stands while the boat sets out, and takes up its antics only once the
  // boat is out on its circuit.
  const busy = isPlain ? [] : voyage.phase === 'fetch' ? ON_DECK.map(p => p.cls) : isCalming && pastime !== undefined ? [pastime] : []
  const figure = rider(flag, busy)
  const riding = voyage.phase === 'fetch' ? rider(flag, [], true) : rider(flag, busy)
  // Off the boat on the boardwalk it is not on deck.
  const aboard = walk.deck === '' ? riding : `<g ${walk.deck}>${riding}</g>`
  const under = (span: number, captain: string | undefined): { svg: string; css: string } => {
    const now = along(plan.boat, t)
    const side = facingAt(turning, t)
    const bow = bowOf(LEAD_BOAT, route.scale, `${once('vbb', span, t)} transform="scale(${f(1 - Math.abs(side))} 1)"`)
    const crew = captain === undefined ? '' : crewOf(aboard, route.scale, captain, `${once('vbr', span, t)} transform="translate(${f(-20 * side)} 0)"`)
    const sizes = sizeTrack('vbs', plan.boat, span, route.scale)
    const boat = `<g ${once('vbf', span, t)} transform="scale(${f(side)} 1)">${hull(once('vbw', span, t))}</g>${bow}${crew}`
    return {
      css: `${track('vbp', plan.boat, span)}${sizes}${facing('vbf', turning, span, s => `scaleX(${f(s)})`)}${facing('vbb', turning, span, s => `scaleX(${f(1 - Math.abs(s))})`)}${facing('vbr', turning, span, s => `translateX(${f(-20 * s)}px)`)}${wakeOf('vbw', plan.boat, span)}`,
      svg: tracked('vbp', span, t, now, sizes === '' ? boat : `<g ${once('vbs', span, t)}>${boat}</g>`),
    }
  }
  // The mascot on foot along its course, its legs stepping only where it
  // walks. It is drawn twice: behind the boats while it is ashore, and in
  // front of them while it is on deck or hopping between deck and jetty.
  const onFoot = (span: number): { back: string; front: string; css: string } => {
    const now = along(plan.clawd, t)
    const strides = plan.clawd.filter(leg => leg.stride).map((leg): Span => [leg.from, leg.to])
    // A hop counts whole, though the trip began part way through it.
    const isOnDeck = (leg: Leg): boolean => (leg.hop === undefined ? [leg.at(0), leg.at(1)] : [leg.hop.a, leg.hop.b]).some(p => p.y >= DOCK.y - 2 && p.x < JETTY.tip)
    const deck = plan.clawd.filter(isOnDeck).map((leg): Span => [leg.from, leg.to])
    const last = plan.clawd[plan.clawd.length - 1]
    const ends: 0 | 1 = last !== undefined && isOnDeck(last) ? 1 : 0
    const isAtDeck = t >= span ? ends === 1 : deck.some(([from, to]) => t >= from && t < to)
    // Woken in the hammock or on the lounger, it sits up as it gets down, and
    // what of it hangs below the hammock's cloth stays cut away. Called back
    // part way down, it carries on from there: its getting up is timed as a
    // whole that began `shift` seconds before this trip.
    const rising = voyage.rise
    const lying = rising?.bed
    const getsUp = rising === undefined ? undefined : plan.clawd[0]
    const shift = rising === undefined ? 0 : rising.u * RISE_S
    const whole = span + shift
    // When it began getting up, on that whole's clock.
    const upFrom = getsUp === undefined ? 0 : getsUp.from
    const pose = lying === 'hammock' ? M_LYING : M_RECLINE
    const lie = getsUp === undefined ? '' : once('vlie', whole, t + shift)
    const upAt = lying === 'lounger' ? upFrom + 0.6 * RISE_S : upFrom + RISE_S
    const sitsUp = getsUp === undefined ? '' : `@keyframes vlie{0%,${pct(upFrom, whole)}{transform:${pose};animation-timing-function:ease-in-out}${pct(upAt, whole)},100%{transform:none}}`
    const turnAt = upFrom + 0.8 * RISE_S
    const turnsFront = getsUp !== undefined && lying === 'lounger'
    const turnsCss = !turnsFront ? '' : `@keyframes vfr{0%,${pct(turnAt, whole)}{transform:scaleX(0)}${pct(upFrom + RISE_S, whole)},100%{transform:scaleX(1)}}@keyframes vsd{0%,${pct(upAt, whole)}{transform:scaleX(1)}${pct(turnAt, whole)},100%{transform:scaleX(0)}}`
    const turn = turnsFront ? { front: once('vfr', whole, t + shift), side: once('vsd', whole, t + shift) } : undefined
    const walking = tracked('vcp', span, t, now, walker(stepped('vgo', span, t), stepped('vst', span, t), lie, turn))
    const figure = lying === 'hammock' ? `<g clip-path="url(#hung)">${walking}</g>` : walking
    return {
      css: `${track('vcp', plan.clawd, span)}${sitsUp}${turnsCss}${shownIn('vgo', strides, span, 0)}${shownIn('vst', outside(strides, span), span, 1)}${shownIn('vdk', deck, span, ends)}${shownIn('vsh', outside(deck, span), span, ends === 1 ? 0 : 1)}`,
      back: `<g ${stepped('vsh', span, t)}${isAtDeck ? ' opacity="0"' : ''}>${figure}</g>`,
      front: `<g ${stepped('vdk', span, t)}${isAtDeck ? '' : ' opacity="0"'}>${figure}</g>`,
    }
  }
  if (voyage.phase === 'fetch' || isWaiting) {
    // Out on its stretch it roams like a fleet boat, sized by the roam.
    const sweep = f3(t - plan.settled + CIRCUIT_START)
    const [far, near] = sizesOf(LEAD_BOAT)
    const circuit = `<g style="${sweepOf(route.seconds)};--b:${sweep};--r:${route.rx}px;--q:${route.ry}px;${driftOf(route.drift ?? DRIFT_TICKS / FPS)};--c:${f3(Number(sweep) + route.driftFrom * (route.drift ?? 0))};--z0:${far};--z1:${near};--d:0" transform="translate(${route.cx} ${route.cy})">
<g class="bx">${roamed(LEAD_BOAT, sweep, `<g class="bf">${hull(undefined, 1)}</g>${bowOf(LEAD_BOAT, 1, 'class="bw"')}${crewOf(figure, 1, '', 'class="br"')}`)}</g></g>`
    if (t >= plan.settled && !isWaiting) {
      return { boat: circuit, depth, x, sails: 0, early: '', late: '', walk: '', css: faces + antics }
    }
    const isAboard = voyage.aboard || t >= plan.boards
    const course = under(plan.settled, isAboard ? '' : `${stepped('vshow', plan.boards, t)} opacity="0"`)
    // Back aboard from the boardwalk, it has no way of its own on foot.
    const foot = isAboard || plan.clawd.length === 0 ? { back: '', front: '', css: '' } : onFoot(plan.boards)
    return {
      depth,
      x,
      sails,
      boat: isWaiting ? course.svg : `<g ${stepped('vhide', plan.settled, t)}>${course.svg}</g><g ${stepped('vshow', plan.settled, t)} opacity="0">${circuit}</g>`,
      early: isAboard ? '' : `<g ${stepped('vhide', plan.boards, t)}>${foot.back}</g>`,
      walk: walk.back,
      late: (isAboard ? '' : `<g ${stepped('vhide', plan.boards, t)}>${foot.front}</g>`) + walk.front,
      css: faces + antics + course.css + foot.css + hand.css + walk.css,
    }
  }
  const day = dayOf(voyage.at, voyage.drill)
  // Aboard as the trip began, or once back from the boardwalk.
  const isRiding = (voyage.aboard || plan.errand !== undefined) && t < plan.lands
  const course = plan.boat.length > 0 && t < plan.gone ? under(plan.gone, isRiding ? stepped('vhide', plan.lands, t) : undefined) : { svg: '', css: '' }
  const isHome = t >= plan.settled
  const at = lifeAt(day, Math.max(0, t - plan.settled))
  // Its day starts as it gets home: until then the day's clock has not begun.
  // What of it would hang below the hammock's cloth is cut away.
  const life = `<g style="--n:${f(isHome ? (t - plan.settled) % day.span : t - plan.settled)}"><g clip-path="url(#hung)"><g class="lpos" transform="translate(${f(at.x)} ${f(at.y)})">${islander()}</g></g><g class="lfront">${LOUNGER_FRONT}</g></g>`
  const now = inLoop(seconds)
  const calms = act === undefined || !isCalming ? '' : ['ca', 'caw', 'can', ...(pastime === undefined ? [] : [pastime])]
    .map(part => `.${part}{animation:${part} ${CAPTAIN_S}s ${part === 'ca' ? 'ease-in-out' : 'step-end'} ${f3(-now)}s ${Math.round((act[1] / CAPTAIN_S) * 10000) / 10000} forwards}`)
    .join('')
  const css = faces + dayCss(day, rand, voyage.greet, isPlain) + course.css + (isRiding && calms !== '' ? antics + calms : '') + hand.css + walk.css
  if (isHome) {
    return { boat: course.svg, depth, x, sails, early: life, late: '', walk: walk.back, css }
  }
  const foot = onFoot(plan.settled)
  const ashore = (figure: string): string => `<g ${stepped('vhide', plan.settled, t)}>${isRiding ? `<g ${stepped('vshow', plan.lands, t)} opacity="0">${figure}</g>` : figure}</g>`
  return {
    depth,
    x,
    sails,
    boat: course.svg,
    early: `<g ${stepped('vshow', plan.settled, t)} opacity="0">${life}</g>${ashore(foot.back)}`,
    walk: walk.back,
    late: ashore(foot.front) + walk.front,
    css: css + foot.css,
  }
}

// A little crab on the wet sand at the front of the beach. It scuttles
// sideways from one spot to the next, rests a while, and now and then waves
// its claws. Its wanderings are one long, irregular round that takes its phase
// from the wall clock, so it is always somewhere on the sand and a redraw
// finds it where it was.
const CRAB_HOME = { x: 1522, y: 747 }
const CRAB = (() => {
  const [lo, hi] = [1480, 1566]
  const pace = 16
  type Stretch = { from: number; to: number; x: number; walks: boolean; waves: boolean }
  const stretches: Stretch[] = []
  let t = 0
  let x = CRAB_HOME.x
  for (let i = 0; i < 9; i++) {
    const rest = 3 + rnd(i, 401) * 10
    stretches.push({ from: t, to: t + rest, x, walks: false, waves: rnd(i, 409) < 0.45 })
    t += rest
    let next = i === 8 ? CRAB_HOME.x : lo + rnd(i, 403) * (hi - lo)
    if (i < 8 && Math.abs(next - x) < 16) {
      next = x + (x < (lo + hi) / 2 ? 1 : -1) * (16 + rnd(i, 407) * 30)
    }
    const walk = Math.abs(next - x) / pace + 0.3
    stretches.push({ from: t, to: t + walk, x: next, walks: true, waves: false })
    t += walk
    x = next
  }
  const whole = Math.round(t * 10) / 10
  const at = (sec: number): string => f((sec / whole) * 100)
  // Sideways, eased into and out of each scuttle: the round's easing applies
  // between each pair of keys, and a rest holds still between its two.
  let across = ''
  let gait = ''
  let still = ''
  let claws = `0%{transform:rotate(0)}`
  let before = CRAB_HOME.x
  for (const run of stretches) {
    if (run.walks) {
      across += `${at(run.from)}%{transform:translateX(${Math.round(before - CRAB_HOME.x)}px)}${at(run.to)}%{transform:translateX(${Math.round(run.x - CRAB_HOME.x)}px)}`
      gait += `${at(run.from)}%{opacity:1}${at(run.to)}%{opacity:0}`
      still += `${at(run.from)}%{opacity:0}${at(run.to)}%{opacity:1}`
    } else if (run.waves && run.to - run.from > 3) {
      const mid = run.from + (run.to - run.from) * 0.4
      claws += `${at(mid)}%{transform:rotate(0)}${at(mid + 0.35)}%{transform:rotate(-38deg)}${at(mid + 0.7)}%{transform:rotate(-24deg)}${at(mid + 1)}%{transform:rotate(-38deg)}${at(mid + 1.4)}%{transform:rotate(0)}`
    }
    before = run.x
  }
  const css = `@keyframes crx{0%{transform:translateX(0)}${across}100%{transform:translateX(0)}}@keyframes crg{0%{opacity:0}${gait}}@keyframes crs{0%{opacity:1}${still}}@keyframes crc{${claws}100%{transform:rotate(0)}}
@keyframes crk{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
.crx{${loop('crx', whole, 'ease-in-out')}}.crc{${loop('crc', whole, 'ease-in-out')}}.crg{${loop('crg', whole, 'step-end')}}.crs{${loop('crs', whole, 'step-end')}}.crk{${loop('crk', 0.3, 'linear')}}`
  // Drawn like the hermit crab: a small, flat-topped shell seen from the
  // front, dot eyes on thin stalks, three thin legs a side and two small claws.
  const side = '<path class="crl" d="M-4.5 -2.6l-2.6 -1.2l-1.6 3.4M-4.8 -1.9l-3.4 .2l-.8 2.3M-3.8 -1.4l-1.8 1.3v1.6"/>'
  const legs = `${side}<g transform="scale(-1 1)">${side}</g>`
  const claw = '<g transform="translate(-4.6 -3.6)"><g class="crc"><path class="crl" d="M0 0q-1.6 -.6 -2.3 -2.2"/><path class="crb" d="M-2 -1.9c-1.9 .2 -3 -1.2 -2.6 -2.8c.3 -1.2 1.5 -1.8 2.4 -1.3l-1.1 1.5l1.9 -.7c.6 1.1 .3 2.9 -.6 3.3z"/></g></g>'
  const face = '<path class="crl" stroke-width=".9" d="M-1.8 -5.4l-.6 -3M1.8 -5.4l.6 -3"/><circle cx="-2.5" cy="-8.8" r="1" fill="#1b1f22"/><circle cx="2.5" cy="-8.8" r="1" fill="#1b1f22"/><path class="crb" d="M-6 -2.8C-6 -6.6 6 -6.6 6 -2.8C6 -1.9 5.2 -1.4 4.2 -1.4H-4.2C-5.2 -1.4 -6 -1.9 -6 -2.8Z"/>'
  const svg = `<g transform="translate(${CRAB_HOME.x} ${CRAB_HOME.y})"><g class="crx"><ellipse cy=".8" rx="7.5" ry="1.4" class="sh"/>
<g class="crs">${legs}</g><g class="crg"><g transform="translate(0 -2.5)"><g class="crk"><g transform="translate(0 2.5)">${side}</g></g><g class="crk" style="--d:.15"><g transform="translate(0 2.5)"><g transform="scale(-1 1)">${side}</g></g></g></g></g>
${face}
${claw}<g transform="scale(-1 1)">${claw}</g></g></g>`
  return { svg, css }
})()

// A grey heron lives on two stretches of shore: the shallows just off the
// front of the beach, and the back of the sand behind the palms. On each it
// wades up and down with stepping legs, turns about, looks around, and
// reaches down to drink or to stab at the water (in the shallows a ring
// spreads from its beak). Twice a round it flies from one to the other: it
// climbs away over the lagoon to the water villas, circles above them a few
// times, larger on the near side of each circle, flies back over the island
// and drops down onto the other shore. Taking off it crouches, rises with its
// legs hanging and tucks them back; coming in it swings its legs forward and
// settles. It is drawn twice: in flight and in the shallows among the near
// things, in front of Clawd and the crab ashore, and on the back of the sand
// among the far things, behind the palms; each copy is shown only where it
// belongs. Its shallows, off the beach's far end, lie clear of the boats'
// lanes and of where Clawd stands. The round takes its phase from the wall
// clock.
const HERON = (() => {
  const round = 300
  const at = (sec: number): string => String(Math.round((sec / round) * 1e4) / 100)
  type Stop = [number, string, string?]
  // One property's keyframes: at each second a value, and the timing from
  // there to the next stop when it is not the round's own. All the stops
  // that hold one value with one timing share a rule.
  const keys = (name: string, prop: string, stops: Stop[]): string => {
    const rules = new Map<string, string[]>()
    for (const [t, v, timing] of stops) {
      const body = `${prop}:${v}${timing === undefined ? '' : `;animation-timing-function:${timing}`}`
      rules.set(body, [...(rules.get(body) ?? []), `${at(t)}%`])
    }
    return `@keyframes ${name}{${[...rules].map(([body, ats]) => `${ats.join(',')}{${body}}`).join('')}}`
  }
  const glide = 'ease-in-out'
  const size = (y: number): number => Math.round((900 * depthScale(y)) / depthScale(774)) / 1000
  type Spot = { x: number; y: number }
  const front: Spot = { x: 1490, y: 786 }
  const back: Spot = { x: 1450, y: 656 }
  const X = (x: number): string => (x === front.x ? 'translateX(0)' : `translateX(${f(x - front.x)}px)`)
  const Y = (y: number, k = size(y)): string => `translateY(${f(y - front.y)}px) scale(${k})`

  // A stride: each foot is planted for `stance` of it, sliding back under the
  // body as far as the body moves, then lifts, folds back at the heel and
  // reaches forward again. A leg is hip, heel and foot; the heel bends
  // backwards. Each stepping leg turns its upper part about the hip and its
  // lower part about the heel, to angles worked out for each key, and keys
  // through the stance are close enough that the planted foot holds still.
  // Walks start on a stride's beat, where the legs stand as the still pose
  // has them.
  const stride = 1.2
  const stance = 0.6
  const reach = 10
  type Joint = [number, number]
  type Pose = [Joint, Joint, Joint]
  const pose = (u: number, y: number): Pose => {
    const [hx, hy, a, b] = [1, -30, 14.5, 16]
    const [dx, dy] = [u, y - hy]
    const d = Math.min(Math.hypot(dx, dy), a + b - 0.01)
    const turn = Math.atan2(dy, dx) - Math.acos((a * a + d * d - b * b) / (2 * a * d))
    return [[hx, hy], [hx + a * Math.cos(turn), hy + a * Math.sin(turn)], [hx + u, y]]
  }
  const planted = (k: number): Pose => pose(reach * (k / stance - 0.5), 0)
  const gait: [number, Pose, string?][] = [...[0, 0.25, 0.5].map((k): [number, Pose] => [k, planted(k)]), [stance, planted(stance), glide], [0.78, pose(1, -8), glide], [0.9, pose(-6.5, -3), glide], [1, planted(0)]]
  const path = (p: Pose): string => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`
  const angle = ([x0, y0]: Joint, [x1, y1]: Joint): number => (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
  const bend = (name: string, turn: (p: Pose) => number): string => `@keyframes ${name}{${gait.map(([k, p, timing]) => `${f(k * 100)}%{transform:rotate(${f(turn(p))}deg)${timing === undefined ? '' : `;animation-timing-function:${timing}`}}`).join('')}}`
  const walk = (cycles: number, y: number): number => (cycles * reach * size(y)) / stance

  const xs: Stop[] = [[0, X(front.x)]]
  const ys: Stop[] = [[0, Y(front.y)]]
  const faces: Stop[] = [[0, 'scaleX(-1)']]
  let facing = -1
  const face = (from: number, to: number, way: number): void => {
    faces.push([from, `scaleX(${facing})`], [to, `scaleX(${way})`])
    facing = way
  }
  const walks: [number, number][] = []
  // Its wades on a shore: when each starts and how many strides it takes,
  // to the left when negative. It turns about just before a wade the other
  // way.
  const wade = (home: Spot, plan: [number, number][]): void => {
    let x = home.x
    for (const [start, cycles] of plan) {
      const way = cycles < 0 ? 1 : -1
      if (way !== facing) face(start - 0.3, start, way)
      const end = start + Math.abs(cycles) * stride
      const to = x + Math.sign(cycles) * walk(Math.abs(cycles), home.y)
      xs.push([start, X(x)], [end, X(to)])
      walks.push([start, end])
      x = to
    }
  }
  // A flight from one shore to the other: up to the right end of a circle
  // over the villas, round it, and from its left end back over the lagoon to
  // hang above the other shore and drop onto it, turning about at each end of
  // the circle. It flies straight from key to key: the clock draws a run of
  // so many eased stretches straight anyway, and a drawing kept as written
  // (lean or plain) must show the heron in the same place at a redraw.
  const sky = { x: 260, y: 392, rx: 150, ry: 28, k: 0.62 }
  const lap = 8
  const laps = 3
  const [climb, cruise, drop] = [14, 16, 2.4]
  // How long before hanging over the back of the sand the heron passes in
  // behind the island's palms, and how long after leaving it it is clear of
  // them again.
  const [FAR_IN, FAR_OUT] = [7, 6]
  const flights: [number, number][] = []
  const fly = (start: number, from: Spot, to: Spot): number => {
    const top = start + climb
    xs.push([start, X(from.x)], [top, X(sky.x + sky.rx)])
    ys.push([start, Y(from.y)])
    for (let n = 0; n < laps; n++) {
      const lapStart = top + n * lap
      if (n > 0) {
        xs.push([lapStart, X(sky.x + sky.rx)])
        face(lapStart - 0.3, lapStart + 0.3, 1)
      }
      xs.push([lapStart + lap / 2, X(sky.x - sky.rx)])
      face(lapStart + lap / 2 - 0.3, lapStart + lap / 2 + 0.3, -1)
      ys.push([lapStart + lap / 4, Y(sky.y - sky.ry, sky.k * 0.92)], [lapStart + (lap * 3) / 4, Y(sky.y + sky.ry, sky.k * 1.08)])
    }
    const over = top + (laps - 1) * lap + (lap * 3) / 4 + cruise
    const end = over + drop
    xs.push([over, X(to.x)])
    ys.push([over, Y(to.y - 80, size(to.y))], [end, Y(to.y)])
    flights.push([start, end])
    return end
  }
  const leave = 96
  wade(front, [[9.6, -3], [21.6, 5], [39.6, 1], [50.4, -4], [70.8, -2], [78, 4], [90, -1]])
  const landed = fly(leave, front, back)
  wade(back, [[154.8, 3], [166.8, 2], [180, -6], [194.4, -2], [205.2, 4], [220.8, 2], [234, -3]])
  const away = 245.6
  fly(away, back, front)
  xs.push([round, X(front.x)])
  ys.push([round, Y(front.y)])
  faces.push([round, 'scaleX(-1)'])

  // Shown in one pose or the other: standing outside the flights, flying in
  // them, its legs stepping only while it wades. One copy is shown at a time:
  // the far one from coming in over the island to the back of the sand until
  // it has left the island again, the near one otherwise. Each hand-over
  // falls where the heron is out over open water, with nothing drawn between
  // the copies near it.
  const swap = (name: string, spans: [number, number][], shown: 0 | 1): string => keys(name, 'opacity', [[0, `${shown}`], ...spans.flatMap(([a, b]): Stop[] => [[a, `${1 - shown}`], [b, `${shown}`]])])
  const behind: [number, number][] = [[landed - drop - FAR_IN, away + FAR_OUT]]
  // Leaning in from the hips and reaching down with the neck to strike or to
  // drink, the head lifted to look about, a crouch before each take-off, a
  // settle after each landing.
  const rot = (deg: number): string => (deg === 0 ? 'rotate(0)' : `rotate(${deg}deg)`)
  const stabs = [16.2, 44.1, 66, 86.1]
  const sips = [161.4, 190.5, 214.2, 227.1]
  const looks: [number, number, number][] = [[3, 7.2, 12], [31.5, 36, 12], [59.1, 63.9, -10], [172.2, 177, -10], [199.2, 203.1, 12]]
  const body: Stop[] = [[0, rot(-12)], [0.9, rot(0)], [round, rot(-12)]]
  const neck: Stop[] = [[0, rot(0)], [round, rot(0)]]
  for (const t of [...stabs, ...sips]) {
    body.push([t - 0.3, rot(0)], [t, rot(-34)], [t + 0.6, rot(-34)], [t + 1.8, rot(0)])
    neck.push([t - 0.3, rot(0)], [t, rot(-70)], [t + 0.6, rot(-70)], [t + 1.8, rot(0)])
  }
  for (const [a, b, deg] of looks) neck.push([a, rot(0)], [a + 0.9, rot(deg)], [b - 0.9, rot(deg)], [b, rot(0)])
  for (const t of [leave, away]) body.push([t - 0.6, rot(0)], [t, rot(-18)])
  body.push([landed, rot(-12)], [landed + 0.9, rot(0)])
  // In flight: legs hanging at take-off and tucked back, swung forward to
  // land; the body pitched up as it climbs away and as it comes in.
  const legs: Stop[] = [[0, rot(80)]]
  const pitch: Stop[] = [[0, rot(0)]]
  for (const [a, b] of flights) {
    legs.push([a, rot(80), glide], [a + 1.8, rot(0)], [b - 1.8, rot(0), glide], [b, rot(105)])
    pitch.push([a, rot(16), glide], [a + 2.1, rot(0)], [b - 1.5, rot(0), glide], [b, rot(22)])
  }
  const rings = stabs.flatMap((t): Stop[] => [[t, 'scale(.2);opacity:0'], [t + 0.3, 'scale(.3);opacity:.9'], [t + 2.1, 'scale(1.4);opacity:0']])
  const css = `${keys('hpx', 'transform', xs)}${keys('hpy', 'transform', ys)}${keys('hpf', 'transform', faces)}
${swap('hpo', flights, 1)}${swap('hpa', flights, 0)}${swap('hpg', walks, 0)}${swap('hpq', walks, 1)}${swap('hzn', behind, 1)}${swap('hzb', behind, 0)}
${keys('hrb', 'transform', body)}${keys('hrn', 'transform', neck)}${keys('hfg', 'transform', legs)}${keys('hfp', 'transform', pitch)}
${keys('hrr', 'transform', [[0, 'scale(.2);opacity:0'], ...rings, [round, 'scale(1.4);opacity:0']])}
@keyframes hfl{0%,100%{transform:scaleY(1)}50%{transform:scaleY(-.55)}}${bend('hlt', ([hip, heel]) => angle(hip, heel) - 90)}${bend('hls', ([hip, heel, foot]) => angle(heel, foot) - angle(hip, heel))}
${['hpx', 'hpy', 'hpf', 'hfg', 'hfp'].map(name => `.${name}{${loop(name, round, 'linear')}}`).join('')}${['hpo', 'hpa', 'hpg', 'hpq', 'hzn', 'hzb'].map(name => `.${name}{${loop(name, round, 'step-end')}}`).join('')}${['hrb', 'hrn', 'hrr'].map(name => `.${name}{${loop(name, round, 'ease-in-out')}}`).join('')}
.hrb{transform-origin:3px -30px}.hrn{transform-origin:-5px -46px}.hfg{transform-origin:14px 0}.hfl{transform-origin:0 -2px;${loop('hfl', 0.7, 'ease-in-out')}}.hlt{${loop('hlt', stride, 'linear')};transform-origin:1px -30px}.hls{${loop('hls', stride, 'linear')};transform-origin:1px -15.5px}`
  const head = `<path d="M-5 -46C-11 -52 -3 -58 -7 -64" fill="none" class="hrk" stroke-width="5" stroke-linecap="round"/><path d="M-8.5 -53l-1 2M-7.5 -49l-1 2" stroke="#3a4148" stroke-width="1" stroke-linecap="round"/><circle cx="-7" cy="-65" r="3.6" class="hrh"/><path d="M-6 -67Q0 -67.5 7 -63.5" fill="none" stroke="#23282d" stroke-width="1.2" stroke-linecap="round"/><path d="M-10 -66L-23 -64.3L-10 -63.2Z" fill="#e9a43c"/><circle cx="-8.4" cy="-65.6" r=".9" fill="#1b1f22"/>`
  const torso = `<path d="M-8 -44C-9 -52 0 -54 10 -48C18 -43 23 -34 21 -28C13 -27 2 -30 -4 -36C-7 -39 -8 -41 -8 -44Z" class="hrg"/><path d="M-2 -46C7 -49 16 -43 21 -30C14 -31 5 -36 -2 -46Z" class="hrw"/><path d="M14 -36C18 -33 21 -30 22 -27L15 -30Z" fill="#30383e"/>`
  const leg = (d: string, extra = ''): string => `<path d="${d}" fill="none" class="hrl" stroke-width="1.6" stroke-linecap="round"${extra}/>`
  const step = (thigh: string, shin: string, delay = ''): string => `<g class="hlt"${delay}>${thigh}<g class="hls">${shin}</g></g>`
  // The still legs stand where the stepping ones are on a stride's beat: the
  // first foot just planted ahead, the second most of the way back.
  const ahead = planted(0)
  const second = planted(0.5)
  // The heron, from its parts: the near copy draws them, the far copy clones
  // them; every moving part is a group of its own, so both copies move as
  // one.
  const stand = (still: string, thigh: string, shin: string, body: string, face: string): string => `<g class="hpq">${still}</g><g class="hpg">${step(thigh, shin)}<g transform="translate(4 0)">${step(thigh, shin, ` style="--d:${stride / 2}"`)}</g></g><g class="hrb">${body}<g class="hrn">${face}</g></g>`
  const standing = `<g class="hpo"><ellipse cy="-1" rx="13" ry="2.4" class="foam" fill="none" stroke-width="1.4" opacity=".6"/><g transform="translate(-33 -4)"><ellipse rx="9" ry="2.2" class="foam hrr" fill="none" stroke-width="1.6"/></g>
${stand(`<g id="hQ">${leg(path(ahead))}<g transform="translate(4 0)">${leg(path(second))}</g></g>`, leg('M1 -30V-15.5', ' id="hU"'), leg('M1 -15.5V.5', ' id="hV"'), `<g id="hT">${torso}</g>`, `<g id="hH">${head}</g>`)}</g>`
  const far = stand('<use href="#hQ"/>', '<use href="#hU"/>', '<use href="#hV"/>', '<use href="#hT"/>', '<use href="#hH"/>')
  // In flight, facing left: neck drawn in, legs from the hip, one wing beating.
  const soar = (legs: string, body: string, wing: string): string => `<g class="hpa" opacity="0"><g transform="translate(0 -32)"><g class="hfp"><g class="hfg">${legs}</g>${body}<g class="hfl">${wing}</g></g></g></g>`
  const flying = soar(leg('M14 0L36 3M14 1L36 5', ' id="hL"'), `<g id="hB"><path d="M-12 -2C-10 -8 2 -9 14 -4C17 -2 17 2 14 3C2 5 -8 4 -12 -2Z" class="hrg"/><path d="M-9 -3C-14 -2 -17 -4 -16 -8" fill="none" class="hrk" stroke-width="6" stroke-linecap="round"/><circle cx="-16.5" cy="-9" r="3.4" class="hrh"/><path d="M-19.5 -10L-32 -8.4L-19.5 -7.2Z" fill="#e9a43c"/><circle cx="-17.6" cy="-9.6" r=".8" fill="#1b1f22"/><path d="M-15.5 -11.4Q-9 -12.2 -4 -9.5" fill="none" stroke="#23282d" stroke-width="1.1" stroke-linecap="round"/></g>`, '<g id="hW"><path d="M-8 -2C-12 -14 -6 -28 8 -36C14 -26 16 -12 13 -2Z" class="hrw"/><path d="M-7 -14C-5 -24 0 -32 8 -36C9 -30 7 -22 4 -16Z" fill="#2f363c"/></g>')
  const place = (inner: string): string => `<g transform="translate(${front.x} ${front.y})"><g class="hpx"><g class="hpy"><g class="hpf">${inner}</g></g></g></g>`
  return { svg: place(`<g class="hzn">${standing}${flying}</g>`), back: place(`<g class="hzb" opacity="0"><g class="hpo">${far}</g>${soar('<use href="#hL"/>', '<use href="#hB"/>', '<use href="#hW"/>')}</g>`), css }
})()

// A hermit crab ambles along the back of the sand among the palms, facing
// the way it goes, rests between ambles, and now and then pulls itself into
// its shell for a while before it peeks out again. Its round is fixed and takes
// its phase from the wall clock, like the crab's.
const HERMIT_HOME = { x: 1462, y: 667 }
const HERMIT = (() => {
  const [lo, hi] = [1404, 1532]
  const pace = 7
  let t = 0
  let x = HERMIT_HOME.x
  let facing = 1
  let moves = '0%{transform:translateX(0)}'
  let faces = '0%{transform:scaleX(1)}'
  let gait = '0%{opacity:0}'
  let still = '0%{opacity:1}'
  let hides = '0%{transform:scale(1)}'
  const stops: { from: number; to: number; x: number; walk: boolean; hide: boolean }[] = []
  for (let i = 0; i < 5; i++) {
    const rest = 4 + rnd(i, 421) * 9
    stops.push({ from: t, to: t + rest, x, walk: false, hide: rnd(i, 427) < 0.5 && rest > 7 })
    t += rest
    let next = i === 4 ? HERMIT_HOME.x : lo + rnd(i, 423) * (hi - lo)
    if (i < 4 && Math.abs(next - x) < 20) next = x + (x < (lo + hi) / 2 ? 1 : -1) * (20 + rnd(i, 425) * 40)
    const walk = Math.abs(next - x) / pace
    stops.push({ from: t, to: t + walk, x: next, walk: true, hide: false })
    t += walk
    x = next
  }
  const whole = Math.round(t * 10) / 10
  const at = (sec: number): string => f((sec / whole) * 100)
  let before = HERMIT_HOME.x
  for (const stop of stops) {
    if (stop.walk) {
      const heading = stop.x >= before ? 1 : -1
      if (heading !== facing) {
        faces += `${at(stop.from)}%{transform:scaleX(${heading})}`
        facing = heading
      }
      moves += `${at(stop.from)}%{transform:translateX(${Math.round(before - HERMIT_HOME.x)}px)}${at(stop.to)}%{transform:translateX(${Math.round(stop.x - HERMIT_HOME.x)}px)}`
      gait += `${at(stop.from)}%{opacity:1}${at(stop.to)}%{opacity:0}`
      still += `${at(stop.from)}%{opacity:0}${at(stop.to)}%{opacity:1}`
    } else if (stop.hide) {
      const into = stop.from + 1
      const out = stop.to - 1.5
      hides += `${at(into)}%{transform:scale(1)}${at(into + 0.3)}%{transform:scale(0)}${at(out)}%{transform:scale(0)}${at(out + 0.6)}%{transform:scale(.6)}${at(out + 1.1)}%{transform:scale(.6)}${at(out + 1.4)}%{transform:scale(1)}`
    }
    before = stop.x
  }
  // Its legs step only while it walks; the shell rocks a little as they do.
  const css = `@keyframes hmx{${moves}100%{transform:translateX(0)}}@keyframes hmf{${faces}}@keyframes hmg{${gait}}@keyframes hmq{${still}}@keyframes hmh{${hides}100%{transform:scale(1)}}@keyframes hmk{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(12deg)}}
.hmx{${loop('hmx', whole, 'ease-in-out')}}.hmh{transform-origin:5px -6px;${loop('hmh', whole, 'ease-in-out')}}${['hmf', 'hmg', 'hmq'].map(name => `.${name}{${loop(name, whole, 'step-end')}}`).join('')}.hmk{transform-origin:4px -4px;${loop('hmk', beat(0.45, 1), 'linear')}}`
  const legs = '<path class="hml" d="M3 -2l4 1.5l1.5 2.5M4 -4l5 0l2 2.5M6 -6l5 -1.5l2.5 2"/>'
  const out = `<g class="hmh"><g class="hmq">${legs}</g><g class="hmg"><g class="hmk">${legs}</g></g><path class="hml" stroke-width="1" d="M8 -10l.5 -4.5M10 -9.5l1.5 -4"/><circle cx="8.5" cy="-15" r="1.3" fill="#1b1f22"/><circle cx="11.6" cy="-14" r="1.3" fill="#1b1f22"/><path d="M5 -9C8 -10 11 -9 11 -7C11 -5 8 -4 5 -5ZM8.5 -8C12 -12.5 18.5 -11.5 19 -7C16.5 -7.6 14.5 -6.6 14 -4.6C12.5 -3 9 -4.4 8.5 -8Z" class="hmo"/></g>`
  // A turban shell, its whorls rising to a point behind.
  const shell = '<path d="M-10 0C-12 -6 -9 -11 -4 -14C-1 -18 2 -19 3 -17C6 -14 7 -8 6 0ZM-1 -18.5L1 -21L3 -17.5Z" class="hmc"/><path d="M-9.5 -3Q-2 -6 6 -3.5M-8 -8Q-2 -10.5 6.3 -8.5M-5 -12.5Q0 -14 4.5 -13" fill="none" class="hms" stroke-width="1.1" stroke-linecap="round"/>'
  const svg = `<g transform="translate(${HERMIT_HOME.x} ${HERMIT_HOME.y}) scale(.85)"><g class="hmx"><g class="hmf"><ellipse cy=".8" rx="11" ry="1.8" class="sh"/>${out}${shell}</g></g></g>`
  return { svg, css }
})()

// A whale shark feeding at the surface far out, where the deep water hides
// all of it below the waterline: the broad spotted top of its back, its tall
// dorsal fin, the tip of its tail far behind, and the ripples it pushes. It
// passes through only once in a long while.
const WHALE_BACK = 'M-78 1C-40 -6 40 -9 88 -4C96 -3 100 -1 101 1Z'
const WHALE_SHARK = `<path d="${WHALE_BACK}" class="wsb"/><path d="${WHALE_BACK}" fill="url(#wsp)"/><path d="M26 -3Q18 -27 -1 -37Q4 -19 -6 -4ZM-112 1Q-118 -15 -131 -27Q-128 -12 -124 1Z" class="wsd"/>`

// Specks of glowing plankton in the shallows round the island after dark,
// in three sets that brighten and fade out of step.
const PLANKTON = (() => {
  const sets = ['', '', '']
  for (let i = 0; i < 36; i++) {
    const x = 1185 + rnd(i, 431) * 420
    const y = 754 + rnd(i, 433) * 30 - Math.max(0, 1260 - x) * 0.55
    sets[i % 3] += `M${Math.round(x)} ${Math.round(y)}h0`
  }
  return sets.map((d, k) => `<path class="bip" stroke-width="${2 + k * 0.6}" d="${d}" style="--d:${k}"/>`).join('')
})()

// The beach: a long spit of sand from its tip on the left out past the right
// edge of the view. `grow` widens the outline, for the wet sand and the foam
// round it.
function beach(grow: number): string {
  const tip = BEACH_TIP - grow
  const k = Math.round(grow * 0.75)
  return `M${tip} 698C${tip} ${668 - k} 1280 ${648 - k} ${ISLE} ${648 - k}C1470 ${648 - k} 1560 ${642 - k} 1700 ${644 - k}V${752 + k}C1560 ${752 + k} 1470 ${746 + k} ${ISLE} ${746 + k}C1280 ${746 + k} ${tip} ${728 + k} ${tip} 698Z`
}

// The jetty off the beach's tip, with a mooring post and a lantern at its
// outer end.
const JETTY_ART = `<g class="post" stroke-width="3">${[8, 44, 80].map(dx => `<line x1="${JETTY.tip + dx}" y1="${JETTY.y}" x2="${JETTY.tip + dx}" y2="${JETTY.y + 20}"/>`).join('')}<line x1="${JETTY.tip + 2}" y1="${JETTY.y - 15}" x2="${JETTY.tip + 2}" y2="${JETTY.y + 18}" stroke-width="4"/></g>
<rect x="${JETTY.tip}" y="${JETTY.y - 3}" width="${JETTY.root - JETTY.tip}" height="6" rx="1" class="deck"/>
<path class="post" stroke-width="1" opacity=".5" d="${[22, 44, 66, 88].map(dx => `M${JETTY.tip + dx} ${JETTY.y - 3}v6`).join('')}"/>
<circle cx="${JETTY.tip + 2}" cy="${JETTY.y - 19}" r="3.6" fill="#5a3b22"/><circle class="lit" cx="${JETTY.tip + 2}" cy="${JETTY.y - 19}" r="3"/>`

// A sun lounger and the pole of the parasol over it. The scene draws it
// twice: behind the mascot, and again in front of it while it walks behind.
const lounger = (top: number): string => `<line class="post" stroke-width="2.5" x1="${LOUNGER.x + 16}" y1="${LOUNGER.y - top}" x2="${LOUNGER.x + 16}" y2="${LOUNGER.y + 4}"/>
<path class="post" stroke-width="2" d="M${LOUNGER.x - 32} ${LOUNGER.y}v8M${LOUNGER.x - 2} ${LOUNGER.y - 3}v11"/>
<path d="M${LOUNGER.x - 38} ${LOUNGER.y + 1}L${LOUNGER.x} ${LOUNGER.y - 3}L${LOUNGER.x + 12} ${LOUNGER.y - 14}" fill="none" stroke="#ef6f5e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`

// The lounger under a thatched parasol.
const LOUNGER_ART = `${lounger(50)}
<path d="M${LOUNGER.x - 26} ${LOUNGER.y - 44}Q${LOUNGER.x + 16} ${LOUNGER.y - 86} ${LOUNGER.x + 58} ${LOUNGER.y - 44}Q${LOUNGER.x + 16} ${LOUNGER.y - 54} ${LOUNGER.x - 26} ${LOUNGER.y - 44}Z" fill="url(#roof)"/>`
const LOUNGER_FRONT = lounger(40)

// A thatched bar at the edge of the view, its lamp lit after dark; on its
// counter, in a scene with room for them, coconuts served with straws, one
// under a paper umbrella, the same as those in the crate.
const BAR_DRINKS = '<use href="#cco" transform="translate(-27 -25) scale(1.2)"/><use href="#cco" transform="translate(-13 -25) scale(1.2)"/><path d="M-26 -30v-5l2 -1.5M-12 -30v-4" stroke="#fff" stroke-width=".8" fill="none"/><path d="M-12 -34l-4.5 2.4h9z" fill="#ef6a5a"/>'
const barArt = (hasLife: boolean): string => `<g transform="translate(${BAR.x} ${BAR.y})"><g class="post" stroke-width="4"><line x1="-32" y1="-52" x2="-32" y2="14"/><line x1="32" y1="-52" x2="32" y2="14"/></g>
<rect x="-40" y="-14" width="80" height="28" class="wall"/><path d="M-40 -4H40M-40 5H40" stroke="#000" opacity=".1"/><rect x="-44" y="-19" width="88" height="6" rx="1" class="deck"/>
${hasLife ? BAR_DRINKS : ''}<rect x="6" y="-29" width="4" height="10" fill="#2bb8a6"/>
<path d="M-56 -48L0 -86L56 -48Q0 -40 -56 -48Z" fill="url(#roof)"/><circle class="lit" cx="0" cy="-36" r="4"/></g>`

// Logs on the sand, alight after dark.
const FIRE_ART = `<g transform="translate(${FIRE.x} ${FIRE.y})"><path d="M-10 2L10 -2M-10 -2L10 2" stroke="#6b4c2f" stroke-width="3.2" stroke-linecap="round"/>
<g class="fire"><circle cy="-8" r="34" fill="#ff9f43" opacity=".12"/><circle cy="-8" r="19" fill="#ff9f43" opacity=".16"/>
<path class="flame" d="M0 -18Q8 -8 5 -2Q0 2 -5 -2Q-8 -8 0 -18Z" fill="#ff8f1f"/><path class="flame" style="--d:.3" d="M0 -10Q4 -5 2.5 -1.5Q0 .5 -2.5 -1.5Q-4 -5 0 -10Z" fill="#ffe08a"/></g></g>`


// A shoal of flying fish: each skips twice across the water, once, as the
// scene is drawn.
function flyingFish(): string {
  const shoal: [number, number, number, number][] = [
    [300, 640, 0.9, 0], [420, 705, 1.15, 0.3], [560, 618, 0.8, 0.55], [600, 750, 1.25, 0.85], [700, 660, 0.95, 1.15], [640, 590, 0.7, 1.45],
  ]
  return shoal
    .map(([x, y, s, d]) => {
      // `--f` is when the fish leaps, `--k` which of its splashes a ring is.
      const rings = [14, 220, 426].map((cx, k) => `<ellipse class="ffs" cx="${cx}" rx="14" ry="3.5" style="--k:${k}"/>`).join('')
      return `<g transform="translate(${x} ${y}) scale(${s})" style="--f:${d}"><g clip-path="url(#surf)"><g class="ffX"><g class="ffY"><g class="ffR"><use href="#fy"/></g></g></g></g>${rings}</g>`
    })
    .join('')
}

const BURSTS = [
  { x: 300, y: 170, c: '#ffd166', d: 0 },
  { x: 1150, y: 120, c: '#ef476f', d: 0.45 },
  { x: 720, y: 90, c: '#06d6a0', d: 0.9 },
  { x: 1450, y: 230, c: '#a78bfa', d: 1.3 },
  { x: 520, y: 260, c: '#ffffff', d: 1.6 },
]

// Each burst's glow on the water, drawn with the sea so the shore covers it,
// `age` seconds into the show.
function fireworkGlow(age: number): string {
  return BURSTS.map(
    ({ x, y, c, d }) =>
      `<ellipse class="fwr" cx="${x}" cy="${f(HORIZON + 30 + (HORIZON - y) * 0.4)}" rx="120" ry="13" fill="${c}" filter="url(#blur6)" style="animation-delay:${f(d + 0.6 - age)}s"/>`,
  ).join('')
}

// The bursts in the sky, `age` seconds into the show: a scene drawn again
// while they go on carries on from where the last one was.
// Every burst is the same spray of spokes, drawn once and cloned in each
// burst's colour.
const SPOKES = (() => {
  let lines = ''
  let tips = ''
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2
    const [x2, y2] = [f(Math.cos(a) * 110), f(Math.sin(a) * 110)]
    lines += `M${f(Math.cos(a) * 30)} ${f(Math.sin(a) * 30)}L${x2} ${y2}`
    tips += `<circle cx="${x2}" cy="${y2}" r="4"/>`
  }
  return `<defs><g id="fwk"><path d="${lines}"/>${tips}</g></defs>`
})()

function fireworks(age: number): string {
  return SPOKES + BURSTS
    .map(({ x, y, c, d }) => `<g transform="translate(${x} ${y})">
<line class="trail" x1="0" y1="0" x2="0" y2="40" stroke="${c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${f(d - age)}s"/>
<g class="fw" stroke="${c}" fill="${c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${f(d + 0.6 - age)}s"><use href="#fwk"/></g></g>`)
    .join('')
}

const NIGHT_OPEN = '@media (prefers-color-scheme: dark){'

// The night block of STYLE: where it starts and ends, and its rules one by one.
const NIGHT = (() => {
  const start = STYLE.indexOf(NIGHT_OPEN)
  let depth = 0
  let end = start
  for (; end < STYLE.length; end++) {
    if (STYLE[end] === '{') depth++
    else if (STYLE[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const rules = (STYLE.slice(start + NIGHT_OPEN.length, end).match(/[^{}]+\{[^{}]*\}/g) ?? []).map(rule => rule.trim())
  return { start, end, rules }
})()

// Pins the scene to day or night when the theme forces a scheme; otherwise the
// frame's own prefers-color-scheme decides.
function styleFor(scheme: 'light' | 'dark' | undefined): string {
  if (scheme === undefined) return STYLE
  const withoutMedia = STYLE.slice(0, NIGHT.start) + STYLE.slice(NIGHT.end + 1)
  return scheme === 'dark' ? withoutMedia + NIGHT.rules.join('') : withoutMedia
}

// Everything the scene shows of the agent: the boats out on the water for the
// work still running, and the lead boat's flag for what it needs from the
// person.
export type SceneState = {
  mood: Mood
  // One boat per piece of work in flight: the main agent's turn, each
  // subagent's, each background shell. A boat called home is still here while
  // it sails off.
  boats: readonly Boat[]
  // What the lead boat flies for the person's attention.
  flag: Flag
  // The lead boat's trip with the mascot: out to its circuit while the agent
  // works, back to the island when the work is over.
  voyage: Voyage
  // The seaplane called for a compaction, while it is in view.
  plane?: Plane
  // A prompt was just sent: the flying fish leap.
  isLeaping: boolean
  // How many seconds the fireworks have been going, while they are.
  fireworks: number | undefined
  scheme: 'light' | 'dark' | undefined
  // How far each boat (by `boatTag`) bore off its course in the drawing
  // before, at `seconds`; none for a first drawing.
  bearing?: Readonly<Record<string, number>>
  // Swimmers, gulls and dolphins called up by hand, with how many seconds
  // ago each was called; none when left out.
  visits?: readonly Visit[]
  // The coconuts on the boardwalk, as they stand when the trip began; a full
  // crate when left out.
  pantry?: Pantry
  // The wall clock the looping animations take their phase from.
  seconds: number
}

// The scene as it goes out, shorter: path data without the spaces and
// leading zeros it can do without, and no line breaks between elements.
function compact(svg: string): string {
  return svg
    .replace(/ d="([^"]*)"/g, (_, d: string) => ` d="${d
      .replace(/(?<=[\d.]) (?=-)/g, '')
      .replace(/(?<![\d.])0\.(?=\d)/g, '.')
      .replace(/(?<=[A-Za-z]) | (?=[A-Za-z])/g, '')
      .replace(/(\.\d+) (?=\.)/g, '$1')}"`)
    .replace(/>\n+</g, '><')
}

// The longest scene drawn in full. The app refuses an Svg source over 131072
// characters, and the scene is the source exactly as it goes out, so a full
// scene may come within a few characters of that.
export const ROOM = 131000

// The scene as an SVG, on the clock (./clock.ts). One that comes out too
// long for a surface is drawn again plainly: the boats' ways in fewer
// straight stretches, the mascot without its antics. Still too long, the
// trips under way (boats coming and going, the mascot's way to and from its
// boat), which take a step for every stretch on the clock, run smoothly off
// it instead, for the little while they last. Only one still too long, with
// every boat, fireworks, the seaplane and a leap at once, also leaves out the
// reef's extra life, and runs entirely off the clock; and, with the mascot by
// the boardwalk besides, as a last resort the swimmers and gulls called up by
// hand.
export function scene(state: SceneState): string {
  return drawing(state).source
}

// The ways a scene is drawn, richest first: whether plainly, with the reef's
// extra life, how much of it on the clock, and with the calls made by hand.
const TIERS = [[false, true, 'all', true], [true, true, 'all', true], [true, true, 'lean', true], [true, false, 'all', true], [true, false, 'lean', true], [true, false, 'none', true], [true, false, 'all', false], [true, false, 'lean', false], [true, false, 'none', false]] as const

// The scene, whether it had to be drawn plainly, which of the TIERS it is
// drawn in, and how it plans each boat's bearing off, for the next drawing
// to go on from. It is drawn in the richest tier that fits, but not with the
// reef's extra life or the calls made by hand where the tier `richest` had
// none: a scene drawn again with nothing changed would bring them in all at
// once. Drawn plainly or not, on the clock or not, it looks the same.
export function drawing(state: SceneState, richest = 0): { source: string; isPlain: boolean; isLean: boolean; tier: number; ways: Record<string, WayPlan> } {
  let last = { source: '', isPlain: true, isLean: true, tier: TIERS.length - 1, ways: {} as Record<string, WayPlan> }
  const drafts = new Map<string, ReturnType<typeof draw>>()
  const [, hadLife, , hadCalls] = TIERS[Math.min(Math.max(0, richest), TIERS.length - 1)] ?? TIERS[0]
  const from = TIERS.findIndex(([, hasLife, , isCalled]) => (hadLife || !hasLife) && (hadCalls || !isCalled))
  for (let tier = from; tier < TIERS.length; tier++) {
    const [isPlain, hasLife, clock, isCalled] = TIERS[tier] ?? TIERS[0]
    const kind = `${isPlain} ${hasLife} ${isCalled}`
    const drawn = drafts.get(kind) ?? draw(isCalled ? state : { ...state, visits: [] }, isPlain, hasLife)
    drafts.set(kind, drawn)
    last = { ...drawn, isLean: clock !== 'all', tier, source: compact(clock === 'none' ? drawn.source : onClock(drawn.source, clock === 'lean')) }
    if (last.source.length <= ROOM) return last
  }
  return last
}

// The scene in full with its animations as written, before they are put on
// the clock.
export function written(state: SceneState): string {
  return draw(state, false, true).source
}

function draw(state: SceneState, isPlain: boolean, hasLife: boolean): { source: string; isPlain: boolean; ways: Record<string, WayPlan> } {
  const { mood, fireworks: show, isLeaping, scheme, seconds } = state
  const visits = state.visits ?? []
  const pantry = state.pantry ?? STOCKED
  const pair = trip(state.voyage, seconds, state.flag, isPlain, state.plane)
  const store = larder(pantry, state.voyage, seconds)
  const flight = seaplane(state.plane, seconds, isPlain)
  const leadSpot: Spot | undefined = pair.boat === '' ? undefined : at => {
    const y = pair.depth(at - seconds)
    return { x: pair.x(at - seconds), y, half: HALF.lead * depthScale(y) }
  }
  const boats = fleets(state.boats, seconds, state.flag, isPlain, leadSpot, state.bearing ?? {})
  // The near boats and the lead boat among them, painted far to near.
  const lead: Part[] =
    pair.boat === ''
      ? []
      : [{ svg: `<g id="v99">${pair.boat}</g>`, copy: '<use href="#v99"/>', depth: pair.depth(AHEAD_S), depthIn: pair.depth, xIn: pair.x, moving: Math.max(pair.sails, state.voyage.phase === 'fetch' ? roamSpan(isPlain) : 0, ...boats.near.map(part => part.moving)), ...LEAD_REACH }]
  // The mascot out on the boardwalk stands among them at the boardwalk's
  // depth; hopping down to the deck it is drawn over them all.
  const walker: Part[] = pair.walk === '' ? [] : [{ svg: pair.walk, copy: pair.walk, depth: WALK.y, depthIn: () => WALK.y, xIn: () => AT_CRATE.x, moving: 0, wide: 60, tall: 70 }]
  const around = stack([...boats.near, ...lead, ...walker].sort((a, b) => a.depth - b.depth), 'zn')

  // The boardwalk and the water villas on it, level with each other.
  const pier = `<path class="post" stroke-width="7" stroke-linecap="round" d="M-20 566H600"/><path class="post" stroke-width="3" d="${[10, 170, 340, 500, 580].map(px => `M${px} 566v26`).join('')}"/>
${bungalow(90, 563, 0.95)}${bungalow(255, 563, 1)}${bungalow(420, 563, 0.95)}`
  const isle = ISLE

  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>${styleFor(scheme)}${CRAB.css}${HERON.css}${HERMIT.css}${boats.css}${pair.css}${store.css}${flight.css}${around.css}</style>
${DEFS}
<g class="${mood}" style="--t:${f3(seconds % 100000)}">
<rect width="${W}" height="${HORIZON + 2}" fill="url(#sky)"/>
${stars()}
<g>
<g class="sunglow"><circle cx="${SUN_X}" cy="${SUN_Y}" r="520" fill="url(#bloom)"/>
<ellipse cx="${SUN_X}" cy="${HORIZON}" rx="640" ry="84" fill="url(#bloom)" opacity=".4"/>
<g class="halo"><g opacity=".45" transform="translate(${SUN_X} ${SUN_Y})"><g class="raysA">${rays(22, 41, 1)}<g opacity=".4">${rays(7, 53, 5)}</g></g><g class="raysB" opacity=".7">${rays(14, 47, 1)}</g></g></g>
<circle cx="${SUN_X}" cy="${SUN_Y}" r="150" fill="url(#corona)"/></g>
<circle class="sun" cx="${SUN_X}" cy="${SUN_Y}" r="46" fill="url(#sund)"/>
</g>
<circle class="moonglow" cx="${SUN_X}" cy="${SUN_Y - 12}" r="260" fill="url(#moonglow)"/>
<g class="moon" transform="translate(${SUN_X} ${SUN_Y - 12})"><circle r="46" fill="#f4f1e4" mask="url(#crescent)"/></g>
<g><g class="drift">${cloud(220, 150, 1)}${cloud(900, 110, 0.8)}${cloud(1500, 180, 1.1)}${cloud(220 + W, 150, 1)}${cloud(900 + W, 110, 0.8)}${cloud(1500 + W, 180, 1.1)}</g>
<g class="drift2">${cloud(600, 270, 0.55)}${cloud(1150, 330, 0.45)}${cloud(600 + W, 270, 0.55)}${cloud(1150 + W, 330, 0.45)}</g>
<rect y="${HORIZON - 60}" width="${W}" height="62" fill="url(#haze)" class="haze"/></g>
<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#sea)"/>
<g><rect y="${HORIZON}" width="${W}" height="1.6" fill="#fff" opacity=".3"/>
<ellipse class="sunglow" cx="${SUN_X}" cy="${HORIZON}" rx="430" ry="44" fill="url(#bloom)" opacity=".35"/>
${ATOLL}
<g class="glit"><path d="M${SUN_X - 24} ${HORIZON}L${SUN_X + 24} ${HORIZON}L${SUN_X + 190} ${HORIZON + 430}L${SUN_X - 190} ${HORIZON + 430}Z" class="colm" fill="url(#column)" filter="url(#blur6)"/>
<g class="gcol">${glitter()}</g></g>${show === undefined ? '' : fireworkGlow(show)}</g>
${seaLife(hasLife, visits, seconds)}
<g><g class="wvs">${waves()}</g>${sparkles()}</g>
<ellipse class="halo" cx="260" cy="570" rx="380" ry="70" fill="url(#halo)" opacity=".85"/>
<g opacity=".18" class="reflit" filter="url(#soft)" transform="translate(0 1184) scale(1 -1)"><use href="#pier"/></g>
${flight.svg}
<g id="pier">${pier}</g>
${store.svg}
<ellipse class="halo" cx="${isle + 90}" cy="705" rx="540" ry="135" fill="url(#halo)"/>
<g>${boats.far.map(part => part.svg).join('')}</g>
<path d="${beach(44)}" class="shoal" opacity=".75" filter="url(#blur6)"/>
<path d="${beach(26)}" fill="none" class="foam foamline" stroke-width="2" opacity=".4" style="--d:4"/>
<path d="${beach(13)}" fill="none" class="foam foamline" stroke-width="3" opacity=".75"/>
<g class="bio" fill="none"><path d="${beach(15)}" class="biw" stroke-width="12" filter="url(#blur6)"/><path d="${beach(13)}" class="bil" stroke-width="3"/>${PLANKTON}</g>
<path d="${beach(9)}" class="wet" filter="url(#blur6)"/><path d="${beach(0)}" fill="url(#sand)"/><path d="${beach(0)}" fill="url(#grain)" opacity=".5"/>
${JETTY_ART}
${TUFTS.map(([x, y, k]) => `<use href="#tuft" transform="translate(${x} ${y}) scale(${k})"/>`).join('')}
${star5(isle - 18, 743, 7)}${star5(isle + 178, 745, 6)}
${HERON.back}
${HERMIT.svg}
${palm(isle + 192, 682, 0.8, 44, 4.1)}${palm(isle - 70, 686, 0.95, -30, 0)}${palm(isle + 20, 690, 1.15, 26, 2.2, true)}
<use href="#shrub" transform="translate(${isle - 89} 703)"/><use href="#shrub" transform="translate(${isle + 80} 700) scale(-.82 .82)"/>
<path d="M${isle + 77} 708q-10 -28 0 -58q10 30 0 58z" fill="#ff9f43"/><path d="M${isle + 77} 706v-54" stroke="#fff" stroke-width="1.6"/>
${barArt(hasLife)}${LOUNGER_ART}
${pair.early}
<g><path class="ham" d="M${isle - 75} 610Q${isle - 24} 668 ${isle + 23} 616Q${isle - 24} 642 ${isle - 75} 610Z"/><path d="M${isle - 75} 610Q${isle - 24} 657 ${isle + 23} 616" fill="none" stroke="#ef6f5e" stroke-width="2.2"/></g>
${FIRE_ART}
${CRAB.svg}
${HERON.svg}
<g>${around.parts.map(part => part.svg).join('')}${pair.late}</g>
<g>
<g class="gulls"><g id="gl"><g transform="translate(0 200)"><path class="gull wing" d="M0 0 q10 -10 20 0 q10 -10 20 0" fill="none" stroke-width="3"/></g>
<g transform="translate(70 230)"><path class="gull wing" d="M0 0 q8 -8 16 0 q8 -8 16 0" fill="none" stroke-width="2.5" style="--d:.3"/></g>
<g transform="translate(-40 250)"><path class="gull wing" d="M0 0 q6 -6 12 0 q6 -6 12 0" fill="none" stroke-width="2" style="--d:.55"/></g></g></g>
${byDepth(called(visits, 'gulls', 0, 30, (age, off) => `<g style="animation:fly ${GULL_CYCLE}s linear ${f3(-age)}s 1 both"><g transform="translate(0 ${off})"><use href="#gl"/></g></g>`))}
${isLeaping ? flyingFish() : ''}
${show === undefined ? '' : fireworks(show)}</g>
</g></svg>`
  return { source, isPlain, ways: boats.ways }
}
