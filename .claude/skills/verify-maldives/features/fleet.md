# Fleet

## Sub-features

- One crew boat per running subagent, one shell boat per background shell.
  Each roams a wide stretch of water while its work runs: it sweeps from
  side to side, coming about at each end, and drifts between the far and
  the near side on a longer, unrelated beat. A new boat takes a free stretch
  at random. Boats whose stretch reaches out to sea come up over the horizon
  and sink back below it when called home; the rest come and go by the
  edges.
- Every boat is sized by how far below the horizon it floats (the square
  root of it, to suit the scene's gentle perspective), on its stretch and on
  its way in and out alike.
- A boat comes back in by the edge it last left by; wakes show only by the
  edges.
- Boats, the lead boat among them, are painted far to near; one rounding
  the island behind it is drawn on the island's far side only while it is
  level with the island.
- Coming about, a boat's side view narrows to nothing as a bow-on view
  widens in its place; the lead boat's rider is not turned with it but
  slides across the deck, still facing out.

## How to get to it (user POV)

Start subagents or background shells during a turn. `/maldives crew 3`,
`/maldives shells 2` preview.

## Driving it with verify/run.sh

`verify/scenarios/fleet-churn.json` (boats set out and are called home over
one another), `verify/scenarios/far-sea.json` (every boat out, roaming
across several redraws, then all called home), or `subagent`, `subagent-done`, `shell`, `shell-done`
events; `npm run fleet` and `npm run sides` for the schedule alone.

## Gotchas

- Each fleet boat is marked `data-b="<kind><slot>"`; the probe follows its
  hull clone (`#cH` / `#sH`, wake left out) for jumps and width changes.
- A boat drawn more than once is drawn by `<use href="#vN">` copies.
  Animations in a copy's shadow tree are not in `document.getAnimations()`,
  so `film.cjs` swaps every such copy for a plain clone before seeking;
  without that the copies sit at their scene-start places in every frame.
- A boat called home mid-turn on its circuit joins its way-out turn at the
  width and facing it had; a full turn from either side snapped its width
  at the redraw.
- Roaming boats keep changing places in depth, so a scene works out their
  order for 45 s ahead (20 s in a plain scene) and `paint` draws it again
  5 s before that runs out (`renew`). Only boats close enough to overlap
  (90 px across, 70 px in depth; 130 and 110 for the lead boat) trade
  places; the rest keep their order, which keeps the scene small.
- A way in or out is keyed at times picked by thinning dense samples to a
  1 px tolerance (2.5 px in a plain scene), so two scenes key it alike and a
  redraw takes a boat up where the last left it. Fixed even legs differed
  by up to 8 px between a busy scene and a quiet one on a steep slant.
- Fleet hulls and all bow-on views are `<use>` clones of the defs, which
  the probe cannot see into; the lead boat's side view is drawn inline so
  it can be measured.
- The boats are painted in one order for as long as a scene lasts; a boat
  under way is placed by where it will be 1.5 s on, and the scene is drawn
  again every few seconds while it is, so two boats crossing in depth can
  briefly be the wrong way round.
