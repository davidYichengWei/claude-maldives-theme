#!/usr/bin/env bash
# Plays a short real session through the engine with the probe mod loaded
# (a turn, /compact, a turn, in one process) and writes verify/engine-facts.ts: what the
# fake engine in verify/engine.ts and test/panel.test.tsx must do around a
# compaction. Costs three small model calls. Run from dev/ after an engine
# update, or when the theme reads something new from the engine.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/engine-probe.XXXXXX")
cd "$work"
say() { printf '{"type":"user","message":{"role":"user","content":"%s"}}\n' "$1"; }
{ say 'Reply with the word ok and nothing else.'; say '/compact'; say 'Reply with the word ok and nothing else.'; } |
  timeout 400 claude -p --input-format stream-json --output-format stream-json --verbose --plugin-dir "$here/engine-probe" --model haiku >session.jsonl 2>session.err ||
  { cat session.err >&2; exit 1; }
if grep -q 'did not load' session.err; then cat session.err >&2; exit 1; fi
node "$here/engine-facts.cjs" "$work"/probe-*.jsonl "$here/engine-facts.ts"
rm -rf "${work:?}"
