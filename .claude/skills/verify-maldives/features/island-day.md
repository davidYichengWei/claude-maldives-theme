# Island day

## Sub-features

- Strolls, fishing at the jetty, napping in the hammock (cut off below the
  cloth), sunning on the lounger (climbs on from the front, passes behind it
  otherwise), sipping at the bar, standing by the fire.
- `/maldives island <fish|nap|sun|sip|fire|tour>` starts a day with that
  pastime first (`tour` runs them all).

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
