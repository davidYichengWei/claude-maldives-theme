#!/usr/bin/env bash
# Plays scenarios through the plugin's own code and checks every frame in
# Chromium. Evidence goes to dev/verify/out/<run>/ and is kept.
#
#   verify/run.sh [--film] <scenario.json>...   named scenarios
#   verify/run.sh --random <count> [seed]       random combinations of events
#
# Exits 2 when any check found a fault, 1 when something could not run.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dev=$(dirname "$here")
cd "$dev"
npx -y esbuild@0.24.0 verify/story.ts --bundle --platform=node --outfile=build/story.cjs --log-level=warning || exit 1
stamp=$(date +%Y%m%d-%H%M%S)
film=()
dirs=()
if [ "${1:-}" = "--random" ]; then
  count=${2:-10}
  seed=${3:-$RANDOM}
  out="verify/out/random-$seed-$stamp"
  node build/story.cjs --random "$count" "$seed" "$out" || exit 1
  for d in "$out"/*/; do dirs+=("${d%/}"); done
else
  [ "${1:-}" = "--film" ] && { film=(--film); shift; }
  [ $# -gt 0 ] || { echo "usage: verify/run.sh [--film] <scenario.json>... | --random <count> [seed]" >&2; exit 1; }
  for scenario in "$@"; do
    name=$(basename "$scenario" .json)
    out="verify/out/$name-$stamp"
    node build/story.cjs "$scenario" "$out" || exit 1
    dirs+=("$out")
  done
fi
faults=0
for d in "${dirs[@]}"; do
  node verify/film.cjs "$d" ${film[@]+"${film[@]}"} 2>&1 | grep -v "Skipping host requirements"
  case ${PIPESTATUS[0]} in
    0) ;;
    2) faults=$((faults + 1)) ;;
    *) echo "film.cjs could not run on $d" >&2; exit 1 ;;
  esac
done
echo
echo "${#dirs[@]} scenarios checked, $faults with faults. Reports: */report.md under:"
printf '  %s\n' "${dirs[@]}"
[ "$faults" -eq 0 ] || exit 2
