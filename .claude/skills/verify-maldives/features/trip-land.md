# Trip: land

## Sub-features

- The boat comes in to the dock heading as it came; bow first, Clawd walks
  forward along the deck before hopping onto the jetty, so the boat need not
  turn.
- Once Clawd is off the jetty the boat leaves by an edge, with a wake only
  near the edge.
- A rider in the middle of an antic (lean, glance, squat) or a pastime
  (fishing, spyglass, humming) finishes it and then rests. The run it plays
  out is a share of the 210 s loop, kept to four places: rounded to one, a
  hop half a second from its end stopped six seconds early, and the mascot
  dropped its pose at the redraw.

## How to get to it (user POV)

Let a turn finish (`answer`), or stop it (`abort`). `/maldives done` previews.

## Driving it with verify/run.sh

`verify/scenarios/landing.json`. Add `turn` within a second or two of
landing to cut the walk on the deck short. `verify/scenarios/rise-recall.json`
ends a turn while Clawd is still getting down from the hammock or the lounger.

## Gotchas

- Clawd is drawn twice in the markup (behind the boats ashore, in front of
  them on deck); only one copy may be visible at any second.
- A boat entering from the right passes in front of the island and must be
  painted over Clawd.
- A trip that starts while Clawd is part way down from the hammock or the
  lounger carries the getting up on from as far as it had got
  (`risingFrom`); it used to start the new trip standing, a 20 px snap.
- A trip that starts while Clawd is in the air between the jetty and the
  boat (`stageAt` reports the `hop` and how far into it) lets it come down
  where it was going first (`planOf`, a rest-of-hop leg), then goes on from
  there. Called home as it hops aboard, it lands on deck, steadies there
  0.3 s (a standing leg, so it stays drawn in front of the sail) and hops
  back off; on deck but not riding, it walks to the jetty end and hops
  (`ashoreFromDeck`); the boat waits at the dock until it is ashore. It used
  to float down or across from mid-air, behind the sail. `npm run fuzz`
  calls each trip away every 0.05 s and fails any stretch of the mascot's
  course that starts or ends in the air, or goes between deck and jetty,
  without being a hop; `verify/scenarios/mid-hop.json` films each case.
- Every time in the markup (`--t`, `--a`, `--e`, `--b`, `--c`, `--n`, a
  delay) goes out to the millisecond (`f3`), never the tenth (`f`): a
  track's keyframes are placed by its exact span, so a duration rounded to
  a tenth stretched it, and Clawd near the end of a hop was 7 px off from
  where the next drawing put it.
