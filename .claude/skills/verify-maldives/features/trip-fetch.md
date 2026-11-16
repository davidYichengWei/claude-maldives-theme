# Trip: fetch

## Sub-features

- The boat enters by the edge opposite to the one it last left by, glides to
  the dock, and lies there stern to the jetty.
- Clawd gets down from the hammock or lounger if it was lying there (sitting
  up as it goes), walks out along the jetty, and hops aboard. It waits at
  `BOARD`, far enough in that its feet stay on the deck and its arms clear
  of the lantern post at the end; the hop arcs high enough to clear the
  lantern. Clawd is about 48 px across with its arms out: check a waiting
  spot near an edge with a close crop (`film.cjs --film --crop`), not by
  the centre point.
- The boat sails to its circuit and joins it heading the way the circuit runs.
- Its circuit is a roam like a fleet boat's (`ROUTES.lead`): it sweeps
  across from the near water off the villas (x 260) to the far water right
  of them (x 1050) on a slant (`tilt`), drifting near and far on an
  unrelated beat, and is sized by depth as it goes (`roamed`: `bv`/`bz` for
  the drift, a second pair on the sweep's clock for the slant). Its course
  to and from the dock is sized along the way (`vbs`), each leg running
  from the boat's size at one end to its size at the other, so it meets the
  roam at the size the roam has there.
- On deck the captain's antics run on the wall clock in a 210 s loop
  (`CAPTAIN_S`, `ON_DECK`): it fishes over the side for a minute (`cfi`, a
  float on the water just in front of the hull), looks out through a
  spyglass as it turns slowly from side to side (`csp`, its rest arm hidden
  by `can`), and hums with notes drifting up as it sways (`chu`), with hops,
  waves and leans in the gaps. Hailing, none of them is drawn; a plain
  scene leaves them out.
- A fetch that interrupts a landing: the boat turns from wherever it was;
  Clawd still on the deck walks back aft instead of going ashore.

## How to get to it (user POV)

Send a prompt while Claude is idle. `/maldives working` does the same without
a prompt.

## Driving it with verify/run.sh

`verify/scenarios/fetch.json` (from home, 300 s into the day). For
interruptions, add `answer` then `turn` a few seconds apart, or a `plan` while
a landing is under way. Random mixes find most of these.

## Gotchas

- A boat that comes about runs its width to nothing at the midpoint: the
  probe still counts it.
- Joining the circuit at its own turn point collapses the boat; the circuit
  is entered at 0.54 of a lap for that reason.
