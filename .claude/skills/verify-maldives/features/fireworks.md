# Fireworks

## Sub-features

- Five bursts over about 9 s with their glow on the water, after a push, a
  PR or an MR.
- A scene drawn again during the show carries on from where the show was.

## How to get to it (user POV)

`git push`, `gh pr create`, or an MR tool call; `/maldives fireworks`.

## Driving it with verify/run.sh

`ship` (or `/maldives fireworks`) during a trip, with `askEvery` so stale
refreshes fall inside the show.

## Gotchas

- The redraw key once held only "celebrating or not", so every refresh
  restarted the show; the seam pixel check on `ask` redraws catches that.
