# Wildlife

## Sub-features

- A whale shark feeds at the surface far out (y 458, just under the
  horizon), crossing left to right about once every nine minutes. The far
  water is too deep to see into, so only what breaks the surface shows: the
  top of its spotted back, the dorsal fin and the tail tip, with ripples.
  It keeps to its own lane, well behind the dorsal-fin shark (y 542).
- The reef runs the whole width of the near shallows, lifted 70 px so the
  prompt box does not hide its crest: two bumpy ridges, the far one paler,
  with coral heads packed along the near crest (densest at the sides of the
  view, which the conversation leaves clear), clams, urchins, starfish and
  seagrass on the sand, reef fish circling, a clownfish at each anemone and
  a moray eel that looks out from behind a rock. Each kind (`REEF_KINDS`) is
  drawn once in the defs in `currentColor`; clones take their colour from
  their class and their size from their depth, and clones of one scale
  share a `scale()` group and give only `x`/`y`.
- More reef life (`REEF.farLife`, `REEF.nearLife`): butterflyfish,
  angelfish, a parrotfish and a pufferfish circling; three schools that swim
  to and fro along the reef and turn about at each end (humbug damsels over
  the far ridge on the left, blue tangs and clownfish over the near one),
  five fish each, every fish on the school's route but a little ahead of or
  behind the others and bobbing on its own, so the school stretches, closes
  up and turns about fish by fish; an octopus on the crest and a resting stingray. Every
  reef fish swims by the `.ox`/`.oy`/`.of` rules: without them the fish
  stand still, which no still and no layer check notices, so check them
  over time (`document.getAnimations()` or frames a few seconds apart). The open
  lagoon (`LAGOON`) has slanting light shafts, five small coral heads on
  the bottom further out and an eagle ray gliding by (lane 786).
- The lagoon and the reef (both ridges and their life) lie on the bottom,
  under every swimmer: the manta (712), shoal A (740), the eagle ray (786),
  the turtle (812) and shoal B (850) all pass over them. `seaLife(hasLife)`
  puts them in.
- Nothing that moves over the reef may let it show through: a swimmer is
  drawn opaque in colours already mixed with the water around it (the
  turtle's, the manta's and the shoals' classes), never with a group
  opacity, which made fish crossing coral look like see-through ghosts. The
  bright parts of the reef's life and the eagle ray keep their colour
  attributes by night too. (Darkening them for the night froze every
  animation in the app twice: an `feColorMatrix` filter, then class rules
  filling these shapes, which sit under uses that `use[href^="#q"]` fills;
  see `dev/verify/constructs.ts`.) Check a change here with a crop where a
  swimmer crosses coral: the coral must stop at the swimmer's outline.
- `drawing()` tries three tiers against `ROOM` (131000, just under the
  app's 131072): full; plain (shorter boat plans, no mascot antics), which
  looks the same; and, only if plain is still too long, plain without the
  reef's extra life, the lagoon, their shapes (`LIFE_KINDS`) and the eagle
  ray, about 6.3 KB. A busy fleet goes plain often, so plain must not drop
  anything visible, or the life blinks out and back on each redraw (the seam
  check flags it as a change on a redraw that changed nothing). Only every
  boat out with fireworks, a whirlpool and a leap at once needs the third
  tier (`npm run size`: busiest land 133009 plain, 126498 without the life).
  `npm run fuzz` fails any scene past 131072 and prints the largest.
- A reef piece that moves (seagrass, anemones) sways in a group of its own
  around its clone, never inside the shape in the defs: an animation inside
  a clone cannot be paused or seeked, and its motion broke the film's
  reload check (more than 0.4% of the picture changed). A `transform`
  animation on the `<use>` itself would turn about the scaled group's origin,
  since `fill-box` leaves out its `x`/`y`; the wrapper group's box does not.
- The reef's shapes have ids of their own prefix (`q`), and only
  `use[href^="#q"]` takes `currentColor` as its fill. A shape once took the
  cloud's id (`cl`), and every cloud in the sky became seagrass.
- The swimmers are drawn in depth order, farthest first: whale shark,
  dolphins, fin, manta, shoal A, turtle, shoal B. A new swimmer goes in by
  its lane, or the layer audit flags it painted over a nearer one.
- The five underwater lanes (`LANES`: manta, shoal A, eagle ray, turtle,
  shoal B) take turns: `visits()` picks, over a 1680 s `VISIT_ROUND`, which
  of each lane's crossings are in sight, one at a time, after a seeded
  20-110 s gap, the lane seen least first. A gate class per lane (`gMa`,
  `gSa`, `gRa`, `gTu`, `gSb`) fades opacity only midway through the idle part
  of the lane's cycle, while the swimmer is off the view. A lane's `cycle`
  must divide `VISIT_ROUND`. Expect about 9 visits a round, never two at
  once, and the lower sea empty about 70% of the time; check with a sampled
  simulation over the round (gate opacity x on-view x), not a still.
- Every creature is drawn with the detail of the reef fish (eye, fins,
  markings), never as a flat silhouette: shoal A is bluestriped snappers
  (`#sr`), shoal B bannerfish (`#ss`), each part coloured by a class with a night version. The dolphin is one
  shape (`#dl`, defined where the sea life is drawn) that every leaper
  clones: it is drawn six times, so inlining it cost over 2 KB.
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
  only the other (the area round the heron must not differ). Moving the heron's flight
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
