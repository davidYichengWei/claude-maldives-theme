// When the backdrop is drawn anew, and what it shows. Every new source reloads
// the app's frame, which shows as a flicker, so a scene is built only when the
// picture has to change; and a scene drawn while something was under way is
// drawn again once it has been asked for a while later, since a frame loaded
// afresh would play that moment over.

import type { Mood, Need } from '../types'
import { ENTER_S, LEAVE_S, roams } from './fleet'
import type { Boat } from './fleet'
import { HOIST_S, ROOM, roamSpan, scene } from './scene'
import type { Signal } from './scene'
import { planOf } from './voyage'
import type { Voyage } from './voyage'

// What is on screen: the scene as drawn, the key it was drawn for, and the key
// it comes to rest at once its one-shot animations (a leap, fireworks, a boat
// sailing off, a change of flag) have played out.
// `renew` is when the scene has run past the time it worked out roaming
// boats' order for, and must be drawn again; 0 when none roam.
export type Painted = { key: string; rest: string; source: string; built: number; until: number; renew: number }
export const UNPAINTED: Painted = { key: '', rest: '', source: '', built: 0, until: 0, renew: 0 }

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
  isCompacting: boolean
  // When the fireworks went up, or 0 when none have.
  firedAt: number
  scheme: 'light' | 'dark' | undefined
  voyage: Voyage
  boats: readonly Boat[]
  leapUntil: number
  flag: Flag
}

// A scene drawn while something in it was under way is drawn again if it is
// asked for this long after.
export const REFRESH_MS = 3000

// How long the fireworks go on for.
export const FIREWORKS_MS = 9000

export function signalOf(mood: Mood, need: Need): Signal {
  return mood === 'waiting' ? need : mood === 'error' ? 'error' : 'none'
}

function tagOf(boat: Boat): string {
  return `${boat.kind}${boat.slot}@${boat.born}`
}

// What is on screen once the backdrop is asked for at `now`: `drawn` kept, or
// a scene built afresh.
export function paint(drawn: Painted, picture: Picture, now: number): Painted {
  const { mood, isCompacting, firedAt, scheme, voyage: trip, flag, leapUntil } = picture
  const isCelebrating = firedAt > 0 && now < firedAt + FIREWORKS_MS
  const isLeaping = now < leapUntil
  const isHoisting = now < flag.since + HOIST_S * 1000
  const fleet = picture.boats.filter(boat => boat.gone === undefined || now < boat.gone + LEAVE_S * 1000)
  const out = fleet.filter(boat => boat.gone === undefined).map(tagOf).join()
  const leaving = fleet.filter(boat => boat.gone !== undefined).map(boat => `${tagOf(boat)}>${boat.gone}`).join()
  const steady = `${mood}|${flag.to}|${trip.phase}@${trip.at}|${out}|${isCompacting}|${scheme}`
  const key = `${steady}|${leaving}|${isCelebrating ? firedAt : 0}|${isLeaping ? leapUntil : 0}|${isHoisting ? flag.since : 0}`
  // When the last thing under way in this picture is over: the lead boat's
  // trip, a boat's way in or out, a change of flag, a leap.
  const plan = planOf(trip)
  const until = Math.max(
    trip.at + Math.max(plan.settled, plan.gone) * 1000,
    flag.since + HOIST_S * 1000,
    isLeaping ? leapUntil : 0,
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
  const source = scene({
    mood,
    boats: fleet,
    flag: { from: isHoisting ? flag.from : flag.to, to: flag.to, age: (now - flag.since) / 1000, hailed: (now - flag.hailedAt) / 1000 },
    voyage: trip,
    isCompacting,
    isLeaping,
    fireworks: isCelebrating ? (now - firedAt) / 1000 : undefined,
    scheme,
    seconds: now / 1000,
  })
  // Roaming boats are painted in an order worked out for a while ahead; the
  // scene is drawn again a little before that runs out.
  const isRoaming = fleet.some(boat => boat.gone === undefined && roams(boat))
  return {
    key,
    rest: `${steady}||0|0|0`,
    built: now,
    until,
    renew: isRoaming ? now + (roamSpan(source.length > ROOM) - 5) * 1000 : 0,
    source,
  }
}
