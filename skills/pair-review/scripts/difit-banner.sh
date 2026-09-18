#!/usr/bin/env bash
# difit URL을 건넬 때 채팅에 같이 붙이는 카드 — 화면에는 "HEAD ↔ sha"뿐이라 어느 레포·브랜치·base인지
# 창만 보고는 알 수 없다. 이 출력이 세션 대화창에서 그 창의 제목 표시줄 역할을 한다.
# 출력은 마크다운 표다 — 채팅에 그대로 붙인다(코드 블록으로 감싸지 않는다).
# 사용: difit-banner.sh --port <p> --base origin/<base> --summary "<한 줄>" [--comments comments.json] [--pr <n>]
#   --summary   이 diff가 하는 일 한 줄 — 에이전트가 diff를 읽고 쓴다. 없으면 브랜치 첫 커밋 제목
#   --comments  시드 스레드 페이로드 — 🔴🟡🟢 개수를 센다. 없으면 전부 0 (카드 모양은 항상 같다)
#   --pr        pair-review-pr용. gh로 제목을 받고, 못 받으면 번호만 적는다
# /api/diff 대조(COMMON 「띄우기 + 검증」)를 통과한 뒤에 부른다 — 이 스크립트는 git만 보고 서버는 안 본다.
set -u
port="" base="" comments="" pr="" summary=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) port=$2; shift 2 ;;
    --base) base=$2; shift 2 ;;
    --comments) comments=$2; shift 2 ;;
    --pr) pr=$2; shift 2 ;;
    --summary) summary=$2; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ -n "$port" ] && [ -n "$base" ] || { echo "usage: difit-banner.sh --port <p> --base origin/<base> [--comments f] [--pr n]" >&2; exit 2; }

# 레포: origin의 owner/name. 워크트리 이름은 안 적는다 — 브랜치에서 파생된 이름이라 브랜치 줄과 겹친다.
repo=$(git remote get-url origin 2>/dev/null | sed -E 's#/*$##; s#\.git$##; s#^.*[:/]([^/]+/[^/]+)$#\1#')
[ -n "$repo" ] || repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")

# 브랜치: detached면(워크트리를 origin/<branch>로 받은 경우) HEAD를 가리키는 원격 브랜치를 대신 적는다.
branch=$(git branch --show-current 2>/dev/null)
[ -n "$branch" ] || branch=$(git branch -r --points-at HEAD --format='%(refname:short)' 2>/dev/null | grep -v -- '->' | grep -vx "$base" | head -1)
[ -n "$branch" ] || branch="detached @ $(git rev-parse --short HEAD 2>/dev/null)"

# 변경: shortstat은 변경이 없으면 아무것도 안 찍는다 — 그때는 0으로.
stat=$(git diff "$base...HEAD" --shortstat 2>/dev/null)
files=$(printf '%s' "$stat" | grep -oE '[0-9]+ files? changed' | awk '{print $1}'); files=${files:-0}
add=$(printf '%s' "$stat" | grep -oE '[0-9]+ insertion' | awk '{print $1}'); add=${add:-0}
del=$(printf '%s' "$stat" | grep -oE '[0-9]+ deletion' | awk '{print $1}'); del=${del:-0}
commits=$(git rev-list --count "$base..HEAD" 2>/dev/null || echo 0)
[ -n "$summary" ] || summary=$(git log "$base..HEAD" --reverse --format=%s 2>/dev/null | head -1)

echo "| 🔍 difit | http://localhost:$port |"
echo "| --- | --- |"
echo "| 작업 | ${summary:-—} |"
echo "| 리포 | \`$repo\` |"
if [ -n "$pr" ]; then
  title=$(gh pr view "$pr" --json title -q .title 2>/dev/null)
  echo "| PR | #$pr${title:+ $title} |"
fi
echo "| 브랜치 | \`$branch\` → \`$base\` |"
echo "| 변경 | $files files · +$add −$del · $commits commits |"
if [ -n "$comments" ] && [ -r "$comments" ]; then
  python3 - "$comments" <<'PY'
import json, sys
threads = json.load(open(sys.argv[1]))
n = {"🔴": 0, "🟡": 0, "🟢": 0}
for t in threads:
    if t.get("type", "thread") != "thread":
        continue
    for k in n:
        if t.get("body", "").lstrip().startswith(k):
            n[k] += 1
print("| 시드 | " + " · ".join(f"{k} {v}" for k, v in n.items()) + " |")
PY
else
  echo "| 시드 | 🔴 0 · 🟡 0 · 🟢 0 |"
fi
