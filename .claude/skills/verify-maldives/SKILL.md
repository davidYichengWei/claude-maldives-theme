---
name: verify-maldives
description: Verify a change to the maldives backdrop plugin (hooks/*.ts, register.tsx) by playing timed agent events through the plugin's own code and checking every frame in headless Chromium for layering, jumps, pops, flicker across redraws and scene size. Use after any change to the scene, the voyage or fleet planning, the redraw logic or the slash command, before saying it works, and to hunt rare combination bugs with random runs.
---

# verify-maldives

The plugin draws one SVG per state and the app reloads the frame on every new
source, so most bugs live in time: a boat that flips at a seam between two
scenes, Clawd painted over a boat in front of it, a pose that snaps when a new
trip starts, fireworks that restart on a refresh. A still preview cannot show
them. This skill plays a list of timed events through the plugin's real
`paint()` / `scene()` / `embark()` code, writes each scene the app would get,
then renders them in Chromium with every CSS animation paused and seeked, and
checks the frames and the seams between scenes.

All commands run from `dev/` in this repository.

## Launch

Nothing to launch: Chromium is started per run by `verify/film.cjs`.

First time on a machine (or after `doctor` says Chromium does not launch):

```bash
npm run setup-chromium
```

It runs `npm install`, downloads Playwright's Chromium, and on an old glibc
(2.17) points it at a newer glibc (`GLIBC_DIR`, Homebrew's by default) and
unpacks missing system libraries privately. It installs nothing system-wide
and is safe to rerun. Downloads go direct, not through the session proxy.

## Doctor

```bash
verify/doctor.sh
```

Read-only. Checks node, dev dependencies, that Chromium launches and renders,
that the plugin type-checks, the busiest scene's size against the plain-redraw
valve (127000) and the app limit (131072), and whether the hot-reloading copy
under `~/.claude/dev-mods/*/maldives` matches the repo. Each FAIL line says
what to run.

## Drive

Named scenarios (`verify/scenarios/*.json`) for a feature, random event mixes
for combinations:

```bash
verify/run.sh verify/scenarios/landing.json        # one feature
verify/run.sh --film verify/scenarios/fetch.json   # also save every frame + sheet.png
verify/run.sh --random 12 7                        # 12 random mixes, seed 7 (reproducible)
```

Scenarios are filmed several at once, each in its own Chromium (8 by
default, `VERIFY_JOBS=n` to change). A named run takes about 1.5 minutes
and a random seed of 12 about 50 seconds, so a regression of every named
scenario and seeds 58, 31 and 7 takes about 3 minutes.

A scenario is JSON:

```json
{ "about": "what it shows",
  "start": { "mood": "working", "home": 600 },
  "scheme": "light",
  "events": [[0, "turn"], [30, "answer"]],
  "askEvery": 7,
  "frames": { "from": 28, "to": 60, "every": 0.25 } }
```

Events, at seconds from the start: `turn` `answer` `abort` `fail` `prompt`
`permission` `question` `plan` `resolve` `subagent` `subagent-done` `shell`
`shell-done` `compact` `compacted` `ship` `reload` `ask`, and any
`/maldives …` command (`island nap`, `crew 2`, `dark`, …). `ask` is the app
asking for the backdrop with nothing new; `askEvery` adds one every N seconds,
which is what drives the 3-second stale refresh. `reload` forgets what was
drawn, as a plugin reload does.

To reproduce one random case on its own, copy its directory, narrow
`frames` in `story.json`, and rerun `node verify/film.cjs <dir> --film --crop x,y,w,h`.
Pick the scenario's feature file under `features/` for what to drive.

## Evidence

Each run writes `dev/verify/out/<name>-<stamp>/` (kept, git-ignored):

- `report.md` / `report.json`: faults with the second and the frame image,
  notes (accepted behaviour, see below), and the event list.
- `film.log` / `film.code`: what `film.cjs` printed and its exit code.
- `sources/NNN.svg`: every scene handed to the app; `story.json` says when,
  why (`cause`) and the voyage it was drawn from.
- `frames/`: flagged frames, and `seamNNN-before/after.png` for each flagged
  seam; with `--film`, every frame and `sheet.png`.

`run.sh` exits 0 when clean, 2 when any check found a fault, 1 when something
could not run. Read the images of every fault before calling it a bug or a
false alarm.

What the checks catch:

| Check | Catches |
| --- | --- |
| clawd shown once | Clawd missing or drawn twice (both walker and rider, say) |
| ashore behind a boat | Clawd on the island painted over a boat passing in front |
| boat under a farther boat | a nearer boat (lower on screen) painted beneath a farther one it overlaps (each measured by the parts of it that show: a hidden glow or a faded wake does not count) |
| clawd jumped / height changed (frames) | teleports and pose snaps inside one scene |
| lead boat jumped / width changed / appeared mid-water | boat flips and pops (followed by its hull alone) |
| `<kind><slot>` boat jumped / changed width | a fleet boat that skips, in a scene or across a seam |
| seam: any jump or shape change | discontinuity where one scene replaces the next |
| seam: picture changed on `ask`/`reload` | a refresh that restarts or drops a one-shot (fireworks, leap) |
| size | a scene over the app's limit |

What they miss: the app's own reload flicker and its crop of the backdrop; a
narrow or mobile viewport; taste (a move that is smooth but ugly); arm and
face changes too small to move Clawd's box; the `register.tsx` glue itself,
which `verify/story.ts` mirrors line for line rather than runs (the plugin
test kit has no `$.theme`). After changing an event handler in `register.tsx`,
change `verify/story.ts` the same way.

Notes, not faults: when a new trip calls Clawd away from its island day, a
glance, lean or squat it was in the middle of ends at once. That is accepted
and listed under notes.

Within a scene the shape check holds only Clawd's height to a pace, because a
turn about runs its width down to nothing in a fraction of a second.

## Cleanup

Nothing runs after `run.sh` returns. Evidence stays in `dev/verify/out/`;
delete old runs by hand when they pile up. To see a fix in the app, sync the
repo into the hot-reloading copy:

```bash
live=$(ls -d ~/.claude/dev-mods/*/maldives | head -1)
rsync -a ../hooks/ "$live/hooks/" && rsync -a ../types/ "$live/types/"
```

The app reloads the mod when the session's turn ends.

## Helpers

- `npm run fuzz`: every pastime and trip interruption at many instants, for
  scene build errors and timing; `bad 0` is clean.
- `npm run size`: scene sizes for the quiet and the busiest states.
- `npm run fleet`, `npm run sides`: boat scheduling and which edge each boat
  enters and leaves by.
- `npm run states` / `npm run frames`: still PNG previews (resvg), for a look
  at one state; they cannot show anything that moves.
- `features/`: one file per feature, with how a person reaches it and how to
  drive it here.
