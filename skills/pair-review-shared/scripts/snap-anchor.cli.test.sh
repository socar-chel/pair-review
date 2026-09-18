#!/usr/bin/env bash
# 실행: bash skills/pair-review-shared/scripts/snap-anchor.cli.test.sh — 옵션 순서에 흔들리지 않는지 (실제 git 리포에서)
set -u
SC="$(cd "$(dirname "$0")" && pwd)/snap-anchor.mjs"
cd "$(git rev-parse --show-toplevel)"
range="$(git rev-parse --short HEAD~1)...HEAD"
a="$(printf '{"path":"x","line":1}\n' | node "$SC" "$range" --max-distance 30 2>/dev/null; echo "rc=$?")"
b="$(printf '{"path":"x","line":1}\n' | node "$SC" --max-distance 30 "$range" 2>/dev/null; echo "rc=$?")"
if [ "$a" = "$b" ] && [ "${a##*rc=}" = 0 ]; then echo "  ✅ 옵션이 앞이든 뒤든 같다 (rc 0)"; else echo "  ❌ 옵션 순서에 따라 다르다"; echo "     range 먼저: $a"; echo "     옵션 먼저:  $b"; exit 1; fi
