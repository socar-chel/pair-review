#!/usr/bin/env bash
# bash scripts/difit-browser.test.sh
set -u
cd "$(dirname "$0")"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail=0
check() { [ "$2" = "$3" ] && echo "ok   $1" || { echo "FAIL $1: got [$2] want [$3]"; fail=1; }; }

out="$(DIFIT_BROWSER_FILE="$tmp/none" bash difit-browser.sh 2>/dev/null)"; rc=$?
check "미설정 → unset · rc 3" "$out/$rc" "unset/3"
printf '# 주석\n\nagent-browser\n' > "$tmp/a"
check "agent-browser" "$(DIFIT_BROWSER_FILE="$tmp/a" bash difit-browser.sh)" "agent-browser"
printf 'link  \n' > "$tmp/l"
check "link (공백 제거)" "$(DIFIT_BROWSER_FILE="$tmp/l" bash difit-browser.sh)" "link"
printf 'chrome\n' > "$tmp/x"
DIFIT_BROWSER_FILE="$tmp/x" bash difit-browser.sh >/dev/null 2>&1; rc=$?
check "알 수 없는 값 → rc 2" "$rc" "2"
exit $fail
