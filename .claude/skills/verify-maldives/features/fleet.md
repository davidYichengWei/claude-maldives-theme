# Fleet

## Sub-features

- One crew boat per running subagent, one shell boat per background shell;
  each enters from an edge, joins a circuit, and leaves by an edge when its
  work ends.
- A boat comes back in by the edge it last left by; wakes show only by the
  edges.

## How to get to it (user POV)

Start subagents or background shells during a turn. `/maldives crew 3`,
`/maldives shells 2` preview.

## Driving it with verify/run.sh

`subagent`, `subagent-done`, `shell`, `shell-done` events; `npm run fleet`
and `npm run sides` for the schedule alone.

## Gotchas

- The probe follows only the lead boat (hull `#7a4f2c`); fleet boats are
  checked for layering, not for jumps.
