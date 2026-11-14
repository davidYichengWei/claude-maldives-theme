#!/usr/bin/env bash
# Gets Playwright's Chromium running on this machine, for dev/verify. Safe to
# run again: it starts each time from Chromium as downloaded.
#
# Where the system glibc is new enough, downloading Chromium is all it takes.
# On an older system (glibc 2.17, as on CentOS 7 and tlinux 2) it points
# Chromium at a newer glibc in GLIBC_DIR, unpacks the system libraries it
# lacks into COMPAT_DIR without installing them, and stubs the CUPS printing
# calls the old libcups is missing (headless rendering never prints).
#
#   GLIBC_DIR   a glibc of 2.28 or later, with lib/ld-linux-x86-64.so.2
#               (default: Homebrew's, /home/linuxbrew/.linuxbrew/Cellar/glibc/*)
#   COMPAT_DIR  where the unpacked libraries go
#               (default: ~/.local/share/chromium-compat)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dev=$(dirname "$here")
direct=(env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY)

cd "$dev"
"${direct[@]}" npm install --no-audit --no-fund --loglevel=error
"${direct[@]}" npx playwright-core install chromium 2>&1 | grep -v "Host system is missing\|^ *at \|^\s*$\|║\|╔\|╚" || true
chrome=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
[ -x "$chrome" ] || { echo "Chromium was not downloaded: $chrome" >&2; exit 1; }
dir=$(dirname "$chrome")

# Start from Chromium as downloaded.
[ -f "$dir/chrome.orig" ] && cp "$dir/chrome.orig" "$chrome"
[ -f "$dir/chrome_crashpad_handler.orig" ] && cp "$dir/chrome_crashpad_handler.orig" "$dir/chrome_crashpad_handler"
if node "$here/launch-check.cjs" >/dev/null 2>&1; then
  echo "Chromium runs as downloaded: $chrome"
  exit 0
fi

glibc_dir=${GLIBC_DIR:-$(ls -d /home/linuxbrew/.linuxbrew/Cellar/glibc/* 2>/dev/null | sort -V | tail -1)}
loader="$glibc_dir/lib/ld-linux-x86-64.so.2"
[ -x "$loader" ] || { echo "Chromium does not run, and no newer glibc was found. Set GLIBC_DIR to one (2.28 or later)." >&2; exit 1; }
compat=${COMPAT_DIR:-$HOME/.local/share/chromium-compat}
mkdir -p "$compat/rpms"

# The system libraries Chromium links that this system lacks.
missing=()
for lib in $(readelf -d "$chrome" | sed -n 's/.*NEEDED.*\[\(.*\)\]/\1/p'); do
  [ -e "/usr/lib64/$lib" ] || [ -e "$glibc_dir/lib/$lib" ] || [ -e "$dir/$lib" ] || [ -e "$compat/usr/lib64/$lib" ] || missing+=("$lib")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Unpacking libraries the system lacks: ${missing[*]}"
  packages=()
  for lib in "${missing[@]}"; do
    pkg=$("${direct[@]}" yum -q provides "*/lib64/$lib" 2>/dev/null | awk '/x86_64/ {print $1; exit}')
    [ -n "$pkg" ] || { echo "No package provides $lib" >&2; exit 1; }
    packages+=("$pkg")
  done
  (cd "$compat/rpms" && "${direct[@]}" yumdownloader -q --destdir . "${packages[@]}")
  (cd "$compat" && for rpm in rpms/*.rpm; do rpm2cpio "$rpm" | cpio -idm --quiet; done)
fi

# Stand-ins for the CUPS calls the system libcups lacks.
cups=$(ls /usr/lib64/libcups.so.2 2>/dev/null || true)
: > "$compat/cups-shim.c"
if [ -n "$cups" ]; then
  comm -23 <(nm -D --undefined-only "$chrome" | awk '{print $2}' | sed 's/@.*//' | grep -E '^(cups|ipp|http)' | sort -u) \
           <(nm -D --defined-only "$cups" | awk '{print $3}' | sed 's/@.*//' | sort -u) |
    while read -r name; do echo "void *$name(void) { return 0; }" >> "$compat/cups-shim.c"; done
fi
gcc -shared -fPIC -O2 -o "$compat/libcups-shim.so" "$compat/cups-shim.c"

if ! command -v patchelf >/dev/null && [ ! -x "$HOME/.local/bin/patchelf" ]; then
  "${direct[@]}" python3 -m pip install -q --user patchelf
fi
patchelf=$(command -v patchelf || echo "$HOME/.local/bin/patchelf")

cp -n "$chrome" "$dir/chrome.orig"
cp -n "$dir/chrome_crashpad_handler" "$dir/chrome_crashpad_handler.orig"
# DT_RPATH, not RUNPATH, so the libraries' own dependencies are found too.
rpath="$glibc_dir/lib:$compat/usr/lib64:$compat:/usr/lib64:\$ORIGIN"
for bin in "$chrome" "$dir/chrome_crashpad_handler"; do
  "$patchelf" --set-interpreter "$loader" "$bin"
  "$patchelf" --remove-rpath "$bin"
  "$patchelf" --force-rpath --set-rpath "$rpath" "$bin"
done
"$patchelf" --add-needed libcups-shim.so "$chrome"
# A system library with a RUNPATH of its own ignores Chromium's: load what it
# needs up front.
"$patchelf" --add-needed libelf.so.1 "$chrome"

if node "$here/launch-check.cjs"; then
  echo "Chromium runs on $glibc_dir: $chrome"
else
  echo "Chromium still does not run; see the error above." >&2
  exit 1
fi
