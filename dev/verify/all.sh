#!/usr/bin/env bash
# Every check at once: the type check, fuzz, the layer sweep, a film of every
# named scenario and of 12 random mixes per seed, and the layer audit of those
# films. The scenes are all written first; then nothing waits on anything
# else, so the checks share the machine instead of taking turns.
#
#   verify/all.sh [seed...]      seeds of the random mixes (default 58 31 7)
#
# VERIFY_JOBS films at once (default 3/8 of the CPUs), LAYERS_JOBS browsers
# for the film audit (default 1/4) and for the sweep (half that), FUZZ_JOBS
# fuzz processes (default 1/4). Evidence goes to dev/verify/out/all-<stamp>/.
#
# Exits 0 when clean, 2 when any check found a fault, 1 when one could not run.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dev=$(dirname "$here")
cd "$dev"
seeds=("$@")
[ ${#seeds[@]} -gt 0 ] || seeds=(58 31 7)
cpus=$(node -p 'require("os").cpus().length')
film_jobs=${VERIFY_JOBS:-$(( cpus * 3 / 8 > 1 ? cpus * 3 / 8 : 1 ))}
layer_jobs=${LAYERS_JOBS:-$(( cpus / 4 > 1 ? cpus / 4 : 1 ))}
sweep_jobs=$(( layer_jobs / 2 > 1 ? layer_jobs / 2 : 1 ))
fuzz_jobs=${FUZZ_JOBS:-$(( cpus / 4 > 1 ? cpus / 4 : 1 ))}
out="verify/out/all-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
started=$(date +%s)

esbuild=./node_modules/.bin/esbuild
"$esbuild" verify/story.ts --bundle --platform=node --external:esbuild --outfile=build/story.cjs --log-level=warning || exit 1
"$esbuild" verify/sweep-scene.ts --bundle --platform=node --outfile=build/sweep-scene.cjs --log-level=warning || exit 1
node build/sweep-scene.cjs "$out/sweep.svg" || exit 1
dirs=()
for scenario in verify/scenarios/*.json; do
  name=$(basename "$scenario" .json)
  node build/story.cjs "$scenario" "$out/$name" || exit 1
  dirs+=("$out/$name")
done
for seed in "${seeds[@]}"; do
  node build/story.cjs --random 12 "$seed" "$out/random-$seed" || exit 1
  for d in "$out/random-$seed"/*/; do dirs+=("${d%/}"); done
done

# Each check writes its log and its exit code beside it.
run() {
  local name=$1
  shift
  ( "$@" > "$out/$name.log" 2>&1; echo $? > "$out/$name.code" ) &
}
run tsc npx -y -p typescript@5.6.3 tsc -p .. --noEmit --noUnusedLocals
run fuzz env FUZZ_JOBS="$fuzz_jobs" npm run -s fuzz
run sweep env LAYERS_JOBS="$sweep_jobs" node verify/layers.cjs sweep "$out/sweep.svg" "$out/layers-sweep" 0 1200
run audit env LAYERS_JOBS="$layer_jobs" node verify/layers.cjs film "$out/layers-film" "${dirs[@]}"
printf '%s\n' "${dirs[@]}" | xargs -P "$film_jobs" -I{} sh -c 'node verify/film.cjs "$1" > "$1/film.log" 2>&1; echo $? > "$1/film.code"' _ {}
wait

broken=0
faults=0
code() { cat "$1" 2>/dev/null || echo 1; }
case $(code "$out/tsc.code") in 0) echo "tsc: clean" ;; *) echo "tsc: errors"; head -5 "$out/tsc.log"; faults=$((faults + 1)) ;; esac
fuzzed=$(grep -o 'bad [0-9]*.*' "$out/fuzz.log" | head -1)
case "$fuzzed" in "bad 0"*) echo "fuzz: $fuzzed" ;; "") echo "fuzz: could not run"; broken=1 ;; *) echo "fuzz: $fuzzed"; faults=$((faults + 1)) ;; esac
for audit in sweep audit; do
  line=$(grep -o '[0-9]* faults; report: .*' "$out/$audit.log" | tail -1)
  case "$line" in "") echo "layers $audit: could not run"; tail -3 "$out/$audit.log"; broken=1 ;; "0 faults"*) echo "layers $audit: $line" ;; *) echo "layers $audit: $line"; faults=$((faults + 1)) ;; esac
done
filmed=0
for d in "${dirs[@]}"; do
  case $(code "$d/film.code") in
    0) filmed=$((filmed + 1)) ;;
    2) grep -v "Skipping host requirements" "$d/film.log" | tail -1; faults=$((faults + 1)) ;;
    *) echo "film.cjs could not run on $d"; broken=1 ;;
  esac
done
echo "films: ${#dirs[@]} scenarios, $filmed clean"
grep -h '^- ' "$out/layers-sweep/layers.md" "$out/layers-film/layers.md" 2>/dev/null | cut -c1-220
echo "took $(( $(date +%s) - started ))s; evidence under dev/$out"
[ "$broken" -eq 0 ] || exit 1
[ "$faults" -eq 0 ] || exit 2
