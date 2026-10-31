#!/usr/bin/env bash
# Builds, then runs every test. Stops with an error if anything at all fails.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
npm test

out="$(mktemp -d)"
npx vite preview --port 4199 >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
sleep 2

for name in e2e e2e-drums e2e-guitar e2e-games e2e-rotate e2e-notch e2e-install e2e-fit; do
  echo "== $name"
  if ! node "scripts/$name.mjs" "$out" > "$out/$name.log" 2>&1; then
    grep -E 'FAIL|Error' "$out/$name.log" | head -20 || true
    echo "$name failed. Full log: $out/$name.log"
    exit 1
  fi
done
echo "All checks passed."
