#!/usr/bin/env bash
# Plays scenarios through the plugin's own code and checks every frame in
# Chromium. Evidence goes to dev/verify/out/<run>/ and is kept.
#
#   verify/run.sh [--film] <scenario.json>...   named scenarios
#   verify/run.sh --random <count> [seed]       random combinations of events
#   verify/run.sh --app <frames dir>            the drawings kept from the app
#                                               (a `.record` file in the plugin's
#                                               folder names that directory)
#
# VERIFY_JOBS sets how many scenarios are filmed at once (8 by default).
#
# Exits 2 when any check found a fault, 1 when something could not run.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dev=$(dirname "$here")
cd "$dev"
npx -y esbuild@0.24.0 verify/story.ts --bundle --platform=node --external:esbuild --outfile=build/story.cjs --log-level=warning || exit 1
stamp=$(date +%Y%m%d-%H%M%S)
film=()
dirs=()
if [ "${1:-}" = "--app" ]; then
  [ -n "${2:-}" ] || { echo "usage: verify/run.sh --app <frames dir>" >&2; exit 1; }
  npx -y esbuild@0.24.0 verify/app-frames.ts --bundle --platform=node --outfile=build/app-frames.cjs --log-level=warning || exit 1
  out="verify/out/app-$stamp"
  node build/app-frames.cjs "$2" "$out" || exit 1
  film=(--film)
  dirs+=("$out")
elif [ "${1:-}" = "--random" ]; then
  count=${2:-10}
  seed=${3:-$RANDOM}
  out="verify/out/random-$seed-$stamp"
  node build/story.cjs --random "$count" "$seed" "$out" || exit 1
  for d in "$out"/*/; do dirs+=("${d%/}"); done
else
  [ "${1:-}" = "--film" ] && { film=(--film); shift; }
  [ $# -gt 0 ] || { echo "usage: verify/run.sh [--film] <scenario.json>... | --random <count> [seed] | --app <frames dir>" >&2; exit 1; }
  for scenario in "$@"; do
    name=$(basename "$scenario" .json)
    out="verify/out/$name-$stamp"
    node build/story.cjs "$scenario" "$out" || exit 1
    dirs+=("$out")
  done
fi
# Each scenario is filmed in its own Chromium, several at once. A film's
# output is kept in its directory and printed in order once all are done.
jobs_max=${VERIFY_JOBS:-8}
for d in "${dirs[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$jobs_max" ]; do sleep 0.2; done
  ( node verify/film.cjs "$d" ${film[@]+"${film[@]}"} > "$d/film.log" 2>&1; echo $? > "$d/film.code" ) &
done
wait
faults=0
broken=0
for d in "${dirs[@]}"; do
  grep -v "Skipping host requirements" "$d/film.log"
  case $(cat "$d/film.code" 2>/dev/null) in
    0) ;;
    2) faults=$((faults + 1)) ;;
    *) echo "film.cjs could not run on $d" >&2; broken=1 ;;
  esac
done
[ "$broken" -eq 0 ] || exit 1
echo
echo "${#dirs[@]} scenarios checked, $faults with faults. Reports: */report.md under:"
printf '  %s\n' "${dirs[@]}"
[ "$faults" -eq 0 ] || exit 2
