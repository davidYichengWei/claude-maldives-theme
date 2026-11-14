# Day and night

## Sub-features

- The scene follows the frame's colour scheme unless a scheme is forced.

## How to get to it (user POV)

Switch the app's theme, or `/maldives dark|light|auto`.

## Driving it with verify/run.sh

`"scheme": "dark"` in a scenario, or `/maldives dark` as an event (a scheme
change is a state change, so its seam may change the whole picture).

## Gotchas

- Clay and hull fills are the same in both schemes, which the probe relies
  on.
