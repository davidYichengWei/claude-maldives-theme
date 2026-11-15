# Wildlife

## Sub-features

- A whale shark feeds at the surface far out (y 458, just under the
  horizon), crossing left to right about once every nine minutes. The far
  water is too deep to see into, so only what breaks the surface shows: the
  top of its spotted back, the dorsal fin and the tail tip, with ripples.
  It keeps to its own lane, well behind the dorsal-fin shark (y 542).
- The swimmers are drawn in depth order, farthest first: whale shark,
  dolphins, fin, manta, shoal A, turtle, shoal B. A new swimmer goes in by
  its lane, or the layer audit flags it painted over a nearer one.
- Two baby blacktip reef sharks circle the water villas at the surface, seen
  from the side like the boats (the camera is low on the island looking out):
  dorsal fin and tail tip above the water, the body a water-tinted shade
  under it. Clones of `#pup`; the tail beats by narrowing (`pkt`, inside the
  clone, so it runs but cannot be seeked). They go round on the boats'
  looping course classes (`bx`, `by`, `bf`, phased with
  `--b:calc(var(--t) - lag)`), and `ps` shrinks them on the far side in step
  with `by`: behind the villas on the far side, in front of their pier on
  the near; the second trails by 1.6 s, a little nearer. Two shoals sit on
  the near side of their round, drawn before the sharks; `sharkAt` mirrors
  `ox`/`oy` to find when the sharks reach each. The fish dart off (`--x`,
  `--y` per fish, on a wrapper group) just before, then turn round (`fhK` on
  the clone) and drift back head first once both passed, and turn again.
  Each shoal's loop starts a second before its shark arrives, so its
  keyframes never wrap.
- A grey heron, in a 300 s round, keeps to two shores: the shallows just
  off the beach's far (right) end (front, about 0-96 s) and the back of the
  sand behind the palms (about 150-246 s). On each it wades up and down
  with stepping legs, turns about, looks around and reaches down to stab or
  drink (a ring spreads from its beak in the shallows only). Between them
  it climbs away to the water villas, circles three times in the sky above
  them (bigger on the near side, turning edge-on at each end), flies back
  over the lagoon, hangs above the other shore and drops onto it. Taking
  off it crouches and rises with its legs hanging (`hfg`, `hfp`); coming
  in it swings its legs forward and settles.
- The heron's legs step for real: through a 1.2 s stride each leg turns
  its upper part about the hip (`hlt`) and its lower part about the heel
  (`hls`), angles solved for each key, its foot planted for the first 60%
  and sliding back exactly as fast as the body moves, then lifting with
  the heel folded back. Only `transform` is animated: a `d:path(...)`
  stride froze every animation in the desktop app. Walks start on a stride's beat (multiples of 1.2 s in the round),
  where the stepping legs match the still ones, so nothing jumps.
- A hermit crab with a turban shell ambles along the back of the sand among
  the palms, faces the way it walks, rests, and sometimes pulls into its
  shell and peeks out.
- After dark (the `.bio` parts show only in the dark scheme) the shore
  glows cyan, plankton specks twinkle in the shallows in three sets, the
  boats' wakes glow, and the twinkles on the water turn cyan.

## How to get to it (user POV)

Always on; the glow needs the app in dark appearance or `/maldives dark`.

## Driving it with verify/run.sh

Any scenario films them; `"scheme": "dark"` for the glow. They run on the
wall clock, so which part of a round a short scenario sees depends on its
start time. For a still at a chosen moment, build a scene at that `seconds`
and seek every animation in Chromium.

## Gotchas

- Every one of them is in every scene, plain ones included, so a redraw
  never adds or drops one.
- A `<use>` with `x`/`y` that is scaled by a CSS animation scales about the
  canvas origin, not about itself: the water's twinkles once flew across
  the sky that way. Put such a clone inside a translated group.
- The heron is drawn twice. The near copy (`hzn`) comes after Clawd, the
  fire and the crab and before the boats; the far copy (`hzb`) comes before
  the hermit crab and the palms, which hide it. The far copy is shown from
  141 s to 251.6 s: coming in over the island, on the back of the sand, and
  climbing away until it is clear of the palms. Each hand-over falls where
  the heron is over open water and nothing drawn between the copies is
  near it; check it by rendering that moment with only one copy and then
  only the other (the area round the heron must not differ; the pups'
  tails cannot be paused and differ everywhere). Moving the heron's flight
  moves these moments (`FAR_IN`, `FAR_OUT`).
- The far copy clones the near one's still parts with `<use>` (`#hT`,
  `#hH`, `#hQ`, `#hU`, `#hV`, and in flight `#hL`, `#hB`, `#hW`) inside its
  own animated groups, so the film can seek every moving part: animations
  inside a `<use>` clone are not in `document.getAnimations()`. Only one
  copy and one pose is shown at any moment; check that over the whole
  round.
- The shallows were chosen from measured boat and Clawd boxes over the
  random films: right next to Clawd's spots the heron hid Clawd, farther
  out the boats ran through it. Re-measure before moving it.
- Two `class` attributes on one element: HTML keeps the first and drops the
  second without a word. The heron's stepping legs once never stepped that
  way. Still frames do not show a missing animation; sample the element
  over time (CTM, computed `d`) or check `getAnimations()` on it.
- The busiest scene is within about 1.5 KB of the app's limit. Clouds,
  flying fish, firework spokes, twinkles, stars and the sun's glitter are
  shared clones or merged paths to make room; plain scenes key boats to
  3.5 px.
- A const used in `DEFS` must be declared above it: bundled, the scene
  builds with `undefined` in its markup instead of failing. `npm run size`
  now throws on `undefined` or `NaN` in a scene.
- Long wall-clock rounds share one timing rule and set only
  `animation-name` per element (heron, crab, hermit crab). The heron's
  keyframes put every stop that holds one value in one rule
  (`10%,40%,77%{...}`), and its times sit on a 0.3 s grid so percentages
  stay short.
