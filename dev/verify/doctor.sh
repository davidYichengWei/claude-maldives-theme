#!/usr/bin/env bash
# Says whether this machine can verify the plugin, and what to do where it
# cannot. Reads and builds only: it installs and changes nothing.
#
#   verify/doctor.sh
#
# Exits 1 when a check the verification needs fails.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dev=$(dirname "$here")
repo=$(dirname "$dev")
cd "$dev"
bad=0
ok() { printf '  ok    %s\n' "$1"; }
no() { printf '  FAIL  %s\n        -> %s\n' "$1" "$2"; bad=1; }
note() { printf '  note  %s\n' "$1"; }

echo "repo $repo at $(git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo '?')$(git -C "$repo" diff --quiet 2>/dev/null || echo ' (uncommitted changes)')"

major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$major" -ge 18 ]; then ok "node $(node --version)"; else no "node 18 or later (found: $(node --version 2>/dev/null || echo none))" "install a newer node"; fi

missing=$(node -e 'for (const m of ["playwright-core", "esbuild", "@resvg/resvg-js"]) { try { require.resolve(m) } catch { console.log(m) } }' 2>/dev/null)
if [ -z "$missing" ]; then ok "dev dependencies installed"; else no "dev dependencies missing: $(echo $missing)" "npm run setup-chromium (or npm install in dev/)"; fi

if out=$(node "$here/launch-check.cjs" 2>&1 | grep -v "Skipping host"); then ok "$out"; else no "Chromium does not launch: $(echo "$out" | head -1)" "npm run setup-chromium"; fi

if out=$(npx -y -p typescript@5.6.3 tsc -p "$repo" --noEmit 2>&1); then ok "plugin type-checks"; else no "plugin does not type-check: $(echo "$out" | head -1)" "fix the type errors (npx -p typescript@5.6.3 tsc -p .)"; fi

if out=$(npm run -s size 2>&1); then
  busiest=$(echo "$out" | sed -n 's/.*busiest fetch \([0-9]*\) busiest land \([0-9]*\).*/\1 \2/p')
  top=$(echo "$busiest" | tr ' ' '\n' | sort -n | tail -1)
  if [ -n "$top" ] && [ "$top" -le 127000 ]; then ok "busiest scene $top chars (plain redraw above 127000, app limit 131072)"; else no "busiest scene ${top:-?} chars is over 127000: it is drawn plainly" "trim the scene, or accept the plain redraw"; fi
else
  no "scene does not build: $(echo "$out" | head -1)" "npm run size, and fix what it reports"
fi

live=$(ls -d ~/.claude/dev-mods/*/maldives 2>/dev/null | head -1)
if [ -n "$live" ]; then
  if diff -rq "$repo/hooks" "$live/hooks" >/dev/null 2>&1 && diff -rq "$repo/types" "$live/types" >/dev/null 2>&1; then
    note "hot-reloading copy $live matches the repo"
  else
    note "hot-reloading copy $live differs from the repo (rsync hooks/ and types/ to see this code in the app)"
  fi
fi

[ "$bad" -eq 0 ] && echo "ready: verify/run.sh <scenario.json>... or verify/run.sh --random <count> [seed]"
exit "$bad"
