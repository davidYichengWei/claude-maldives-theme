// When the backdrop is drawn anew, and what it shows. Every new source reloads
// the app's frame, which shows as a flicker, so a scene is built only when the
// picture has to change; and a scene drawn while something was under way is
// drawn again once it has been asked for a while later, since a frame loaded
// afresh would play that moment over.

import type { Mood, Need } from '../types'
import { ENTER_S, LEAVE_S, roams } from './fleet'
import type { Boat } from './fleet'
import { HOIST_S, VISIT_SECONDS, bearingOn, boatTag, drawing, roamSpan } from './scene'
import type { Signal, VisitKind, WayPlan } from './scene'
import { PLANE_IN_S, planOf, planeGone, swapSeconds } from './voyage'
import type { Pantry, Plane, Voyage } from './voyage'

// What is on screen: the scene as drawn, the key it was drawn for, and the key
// it comes to rest at once its one-shot animations (a leap, fireworks, a boat
// sailing off, a change of flag) have played out.
// `renew` is when the scene has run past the time it worked out roaming
// boats' order for, and must be drawn again; 0 when none roam.
// `ways` is how the drawing plans each boat's bearing off, for the next one
// to go on from.
// `held` is the scene's content as last drawn (its key) and the tier it was
// drawn in (`drawing`): a drawing of what looks the same (`looksAsDrawn`)
// brings in nothing that tier left out.
export type Held = { key: string; tier: number }
export type Painted = { key: string; rest: string; source: string; built: number; until: number; renew: number; ways: Readonly<Record<string, WayPlan>>; held: Held }
// The parts of a redraw key, in the order `paint` joins them with `|`.
export const KEY_PARTS = ['mood', 'flag', 'trip', 'boats', 'plane', 'scheme', 'pantry', 'leaving', 'fireworks', 'leap', 'hoist', 'visits'] as const
export const UNHELD: Held = { key: '', tier: 0 }

// The one-shots of a key: boats leaving, the fireworks, a leap, a flag going
// up, and the calls out.
const ONE_SHOTS = new Set<string>(['leaving', 'fireworks', 'leap', 'hoist', 'visits'])

// Whether a scene keyed `key` looks as the one drawn for `drawn` did: the
// same but for one-shots that have since finished, as one gone looks like
// the scene without it.
export function looksAsDrawn(key: string, drawn: string): boolean {
  const [now, then] = [key.split('|'), drawn.split('|')]
  if (now.length !== KEY_PARTS.length || then.length !== KEY_PARTS.length) return false
  return KEY_PARTS.every((part, i) => {
    const [a, b] = [now[i] ?? '', then[i] ?? '']
    if (a === b) return true
    if (!ONE_SHOTS.has(part)) return false
    const was = new Set(b.split(','))
    return a === '' || a === '0' || a.split(',').every(item => was.has(item))
  })
}
export const UNPAINTED: Painted = { key: '', rest: '', source: '', built: 0, until: 0, renew: 0, ways: {}, held: UNHELD }

// What the lead boat flies, what it flew before, and when it changed.
// `hailedAt` is when the boat last began calling for the person, so that the
// mascot's hailing hops keep their beat from one signal to the next.
export type Flag = { from: Signal; to: Signal; since: number; hailedAt: number }

export const UNFLAGGED: Flag = { from: 'none', to: 'none', since: 0, hailedAt: 0 }

// The flag once the agent's signal is `signal` at `now`.
export function hoist(flag: Flag, signal: Signal, now: number): Flag {
  if (signal === flag.to) {
    return flag
  }
  return { from: flag.to, to: signal, since: now, hailedAt: flag.to === 'none' ? now : flag.hailedAt }
}

// Everything the backdrop is drawn from, as it stands when it is asked for.
export type Picture = {
  mood: Mood
  need: Need
  // The seaplane called for the compaction under way, or the last one.
  plane: Plane | undefined
  // When the fireworks went up, or 0 when none have.
  firedAt: number
  scheme: 'light' | 'dark' | undefined
  voyage: Voyage
  boats: readonly Boat[]
  leapUntil: number
  flag: Flag
  // Swimmers, gulls and dolphins called up by hand.
  visits: readonly Call[]
  // The coconuts on the boardwalk, as they stood when the trip began.
  pantry: Pantry
}

// A swimmer, gull flock or dolphin leap called up by hand: what, when (clock
// ms), and which place beside its lane it keeps while it is out. At most
// MOST_CALLED of a kind are out at once, so calls cannot crowd the view.
export type Call = { kind: VisitKind; at: number; slot: number }
export const MOST_CALLED = 3

// The calls not yet gone by at `now`.
export function stillOut(calls: readonly Call[], now: number): Call[] {
  return calls.filter(call => now < call.at + VISIT_SECONDS[call.kind] * 1000)
}

// The calls out at `now` with one more of `kind`, in a place none of its kind
// out keeps; undefined when MOST_CALLED of it are already out.
export function callUp(calls: readonly Call[], kind: VisitKind, now: number): Call[] | undefined {
  const out = stillOut(calls, now)
  const taken = new Set(out.filter(call => call.kind === kind).map(call => call.slot))
  const slot = Array.from({ length: MOST_CALLED }, (_, k) => k).find(k => !taken.has(k))
  return slot === undefined ? undefined : [...out, { kind, at: now, slot }]
}

// A scene drawn while something in it was under way is drawn again if it is
// asked for this long after.
export const REFRESH_MS = 3000

// How long the fireworks go on for.
export const FIREWORKS_MS = 9000

export function signalOf(mood: Mood, need: Need): Signal {
  return mood === 'waiting' ? need : mood === 'error' ? 'error' : 'none'
}


// What is on screen once the backdrop is asked for at `now`: `drawn` kept, or
// a scene built afresh.
export function paint(drawn: Painted, picture: Picture, now: number): Painted {
  const { mood, firedAt, scheme, voyage: trip, flag, leapUntil } = picture
  const isCelebrating = firedAt > 0 && now < firedAt + FIREWORKS_MS
  const isLeaping = now < leapUntil
  const isHoisting = now < flag.since + HOIST_S * 1000
  const fleet = picture.boats.filter(boat => boat.gone === undefined || now < boat.gone + LEAVE_S * 1000)
  const out = fleet.filter(boat => boat.gone === undefined).map(boatTag).join()
  const leaving = fleet.filter(boat => boat.gone !== undefined).map(boat => `${boatTag(boat)}>${boat.gone}`).join()
  // A call is drawn while it is out; once it is gone the scene it was drawn in
  // looks like the one without it, as it ran once and was left out of view.
  const visits = stillOut(picture.visits, now)
  const { pantry } = picture
  // The seaplane while it is in view: coming in and moored, and once its
  // cargo swap is set, swapping and leaving.
  const plane = picture.plane !== undefined && now < planeGone(picture.plane) ? picture.plane : undefined
  const steady = `${mood}|${flag.to}|${trip.phase}@${trip.at}|${out}|${plane === undefined ? '' : `${plane.at}>${plane.swap ?? ''}`}|${scheme}|${pantry.stock}@${pantry.filled?.at ?? 0}`
  const key = `${steady}|${leaving}|${isCelebrating ? firedAt : 0}|${isLeaping ? leapUntil : 0}|${isHoisting ? flag.since : 0}|${visits.map(v => `${v.kind}@${v.at}`).join()}`
  // When the last thing under way in this picture is over: the lead boat's
  // trip, a boat's way in or out, a change of flag, a leap.
  const plan = planOf(trip)
  const until = Math.max(
    trip.at + Math.max(plan.settled, plan.gone) * 1000,
    flag.since + HOIST_S * 1000,
    isLeaping ? leapUntil : 0,
    pantry.filled === undefined ? 0 : pantry.filled.at + swapSeconds(pantry.stock - pantry.filled.stock) * 1000,
    plane === undefined ? 0 : plane.swap === undefined ? plane.at + PLANE_IN_S * 1000 : planeGone(plane),
    ...fleet.map(boat => (boat.gone === undefined ? boat.born + ENTER_S * 1000 : boat.gone + LEAVE_S * 1000)),
  )
  const isStale = (drawn.built < drawn.until && now - drawn.built > REFRESH_MS) || (drawn.renew > 0 && now >= drawn.renew)
  // A scene whose one-shots have finished already looks like the state it
  // settles into, and is kept.
  if (key === drawn.rest && !isStale) {
    return { ...drawn, key }
  }
  if (key === drawn.key && !isStale) {
    return drawn
  }
  // Each boat goes on bearing off from where the drawing before left it.
  const bearing = Object.fromEntries(Object.entries(drawn.ways).map(([tag, plan]) => [tag, bearingOn(plan, now / 1000)]))
  const made = drawing({
    mood,
    boats: fleet,
    flag: { from: isHoisting ? flag.from : flag.to, to: flag.to, age: (now - flag.since) / 1000, hailed: (now - flag.hailedAt) / 1000 },
    voyage: trip,
    plane,
    isLeaping,
    fireworks: isCelebrating ? (now - firedAt) / 1000 : undefined,
    scheme,
    bearing,
    visits: visits.map(v => ({ kind: v.kind, age: (now - v.at) / 1000, slot: v.slot })),
    pantry,
    seconds: now / 1000,
  }, looksAsDrawn(key, drawn.held.key) ? drawn.held.tier : 0)
  // Roaming boats, the lead boat out on its stretch among them, are painted in
  // an order worked out for a while ahead; the scene is drawn again a little
  // before that runs out.
  const isRoaming = trip.phase === 'fetch' || fleet.some(boat => boat.gone === undefined && roams(boat))
  return {
    key,
    rest: `${steady}||0|0|0|`,
    built: now,
    until,
    renew: isRoaming ? now + (roamSpan(made.isPlain) - 5) * 1000 : 0,
    source: made.source,
    ways: made.ways,
    held: { key, tier: made.tier },
  }
}
