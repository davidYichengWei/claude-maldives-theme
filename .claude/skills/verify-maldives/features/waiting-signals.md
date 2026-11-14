# Waiting signals

## Sub-features

- The lead boat hoists a flag and lights a lamp in the colour of what it
  needs (permission, question, plan) or of an error, over 1.6 s.
- Clawd waves and hops while the boat hails; the hop beat starts with the
  hailing and carries on across a change of signal; a hop under way when the
  hailing stops comes down.

## How to get to it (user POV)

A tool needing approval, AskUserQuestion, ExitPlanMode, or a failed turn.
`/maldives permission|question|plan|error` preview them.

## Driving it with verify/run.sh

`turn`, then `permission`, `resolve`, `question`, `fail` a few seconds apart,
with `askEvery` so stale refreshes land mid-hoist.

## Gotchas

- Seams at a signal change used to drop Clawd mid-hop (6 to 7 px); the seam
  jump check catches it.
