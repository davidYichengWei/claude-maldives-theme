# Trip: land

## Sub-features

- The boat comes in to the dock heading as it came; bow first, Clawd walks
  forward along the deck before hopping onto the jetty, so the boat need not
  turn.
- Once Clawd is off the jetty the boat leaves by an edge, with a wake only
  near the edge.
- A rider in the middle of an antic (lean, glance, squat) finishes it and
  then rests.

## How to get to it (user POV)

Let a turn finish (`answer`), or stop it (`abort`). `/maldives done` previews.

## Driving it with verify/run.sh

`verify/scenarios/landing.json`. Add `turn` within a second or two of
landing to cut the walk on the deck short.

## Gotchas

- Clawd is drawn twice in the markup (behind the boats ashore, in front of
  them on deck); only one copy may be visible at any second.
- A boat entering from the right passes in front of the island and must be
  painted over Clawd.
