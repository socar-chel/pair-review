#!/usr/bin/env bash
# difit 창을 어떻게 여나 — 배정 파일 한 줄. 없으면 종료 코드 3(스킬이 한 번 묻고 저장한다).
#   ~/.config/pair-review/browser (또는 $XDG_CONFIG_HOME/pair-review/browser, $DIFIT_BROWSER_FILE)
#   값: link | agent-browser
set -euo pipefail
file="${DIFIT_BROWSER_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/pair-review/browser}"
[ -f "$file" ] || { echo "unset" ; exit 3; }
value="$(grep -v '^[[:space:]]*#' "$file" | grep -v '^[[:space:]]*$' | tail -1 | tr -d '[:space:]')"
case "$value" in
  link|agent-browser) echo "$value" ;;
  *) echo "invalid: $value" >&2; exit 2 ;;
esac
