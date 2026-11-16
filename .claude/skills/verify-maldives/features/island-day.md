# Island day

## Sub-features

- Strolls, fishing at the jetty, napping in the hammock (cut off below the
  cloth), sunning on the lounger (climbs on from the front, passes behind it
  otherwise; on it, it turns side on and lies back as a side-view figure,
  and sits up and turns to the front again to get off), sipping at the bar, standing by the fire.
- `/maldives island <fish|nap|sun|sip|fire|tour>` starts a day with that
  pastime first (`tour` runs them all).
- A small crab, drawn like the hermit crab (flat shell, dot eyes on stalks,
  about 20 px across), wanders the wet sand in front of the lounger and the
  bar all the time, its shadow going with it: sideways scuttles between spots, rests, an occasional claw wave. Its
  round is one fixed irregular schedule (about 90 s) phased from the wall
  clock, so a redraw finds it where it was. It is drawn after Clawd and the
  boats, being nearer than either can be where it walks.

## How to get to it (user POV)

Leave Claude idle after a turn; or type `/maldives island nap` while idle.

## Driving it with verify/run.sh

Events `[t, "/maldives island nap"]` etc. after an `answer`; frames over the
pastime (they last 14 to 140 s). Follow with `turn` to check getting up.

## Gotchas

- The island command is refused while Claude works or waits; story.ts
  mirrors that.
- Called away mid-glance, Clawd's pose ends at once; film.cjs lists it as a
  note, not a fault.
- The island art is painted far to near: palms sorted by where they root,
  then the shrubs that stand in front of their trunks. The palm crown, the
  shrub and the grass tuft are each drawn once in the defs and cloned; the
  crab's colours stay off the mascot's clay fill, which the probe tracks.
- The layer audit holds the crab's order and jumps, not how its legs move; look at a filmed strip
  (`--film --crop 1430,690,200,60`).
