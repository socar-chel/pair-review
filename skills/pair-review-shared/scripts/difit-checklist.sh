#!/usr/bin/env bash
# 셀프리뷰 트랙 B의 개인 standards source — 배정 파일에 적힌 경로를 한 줄씩, 존재하는 것만 출력한다.
#   ~/.config/pair-review/checklist (또는 $XDG_CONFIG_HOME/pair-review/checklist, $DIFIT_CHECKLIST_FILE)
#   한 줄당 파일 경로 하나. `#` 주석·빈 줄 허용, `~`는 $HOME 으로 푼다.
# 종료 코드: 0 출력 있음 · 3 배정 파일 없음(선택 사항이라 묻지 않고 건너뛴다) · 4 적힌 파일이 전부 없음(stderr 에 목록)
set -euo pipefail
file="${DIFIT_CHECKLIST_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/pair-review/checklist}"
[ -f "$file" ] || { echo "unset" >&2; exit 3; }
found=0; missing=()
while IFS= read -r raw || [ -n "$raw" ]; do   # 마지막 줄에 개행이 없어도 읽는다
  line="${raw%%#*}"; line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  [ -n "$line" ] || continue
  path="${line/#\~/$HOME}"
  if [ -f "$path" ]; then echo "$path"; found=$((found+1)); else missing+=("$path"); fi
done < "$file"
for m in "${missing[@]+"${missing[@]}"}"; do echo "missing: $m" >&2; done
[ "$found" -gt 0 ] || exit 4
