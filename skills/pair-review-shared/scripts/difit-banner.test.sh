#!/usr/bin/env bash
# difit-banner.sh — 레포·워크트리·브랜치·변경량·시드 개수·PR 줄을 임시 git 레포로 검증한다.
# 실행: bash skills/pair-review-shared/scripts/difit-banner.test.sh
set -u
SC="$(cd "$(dirname "$0")" && pwd)/difit-banner.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0
ok()   { echo "  ✅ $1"; pass=$((pass+1)); }
bad()  { echo "  ❌ $1 — 기대 $2 · 실제 $3"; fail=$((fail+1)); }
check(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2" "$3"; }
line(){ printf '%s\n' "$1" | grep -F "| $2 |" ; }   # 표에서 라벨 행 하나

# origin(bare) ← 클론. base=develop, feat 브랜치에 커밋 2개.
git init -q --bare "$T/origin.git"
git clone -q "$T/origin.git" "$T/w" 2>/dev/null
cd "$T/w"
git config user.email t@t; git config user.name t
git checkout -q -b develop
printf 'a\nb\nc\n' > f.txt; git add f.txt; git commit -qm base
git push -q origin develop
git checkout -q -b feat/x
printf 'a\nB\nc\nd\n' > f.txt; echo new > g.txt; git add .; git commit -qm one
printf 'a\nB\nd\n' > f.txt; git add .; git commit -qm two
git push -q origin feat/x
# 클론 origin URL은 로컬 경로라 owner/name이 안 나온다 — 실제 형태로 바꾼다
git remote set-url origin git@github.com:socar-inc/accounts-web.git

out=$(bash "$SC" --port 5120 --base origin/develop --summary "포트 배정 파일 지원")
echo "== 기본 =="
check "헤더에 URL"        "| 🔍 difit | http://localhost:5120 |" "$(printf '%s\n' "$out" | head -1)"
check "작업 요약"         "| 작업 | 포트 배정 파일 지원 |" "$(line "$out" 작업)"
check "요약 없으면 첫 커밋 제목" "| 작업 | one |" "$(line "$(bash "$SC" --port 5120 --base origin/develop)" 작업)"
check "리포 owner/name"   "| 리포 | \`socar-inc/accounts-web\` |" "$(line "$out" 리포)"
check "브랜치 → base"     "| 브랜치 | \`feat/x\` → \`origin/develop\` |" "$(line "$out" 브랜치)"
check "변경량"            "| 변경 | 2 files · +3 −2 · 2 commits |" "$(line "$out" 변경)"
check "시드 없으면 전부 0" "| 시드 | 🔴 0 · 🟡 0 · 🟢 0 |" "$(line "$out" 시드)"
check "PR 줄 없음"        "" "$(line "$out" PR)"

echo "== 시드 =="
cat > "$T/c.json" <<'J'
[{"type":"thread","body":"🔴 버그"},{"type":"thread","body":"🟡 논의"},{"type":"thread","body":" 🟡 들여쓴 논의"},
 {"type":"thread","body":"🟢 설명"},{"type":"reply","body":"🔴 답글은 안 센다"},{"type":"thread","body":"신호등 없음"}]
J
check "🔴🟡🟢 개수(답글·무표시 제외)" "| 시드 | 🔴 1 · 🟡 2 · 🟢 1 |" "$(line "$(bash "$SC" --port 5120 --base origin/develop --comments "$T/c.json")" 시드)"

echo "== PR (가짜 gh) =="
mkdir -p "$T/bin"; printf '#!/bin/sh\necho "feat | 제목입니다"\n' > "$T/bin/gh"; chmod +x "$T/bin/gh"
check "gh 제목 포함(| 이스케이프)" "| PR | #42 feat \\| 제목입니다 |" "$(line "$(PATH="$T/bin:$PATH" bash "$SC" --port 5125 --base origin/develop --pr 42)" PR)"
check "요약의 | 이스케이프" "| 작업 | a \\| b |" "$(line "$(bash "$SC" --port 5120 --base origin/develop --summary "a | b")" 작업)"
check "gh 없으면 번호만"  "| PR | #42 |" "$(line "$(PATH=/usr/bin:/bin bash "$SC" --port 5125 --base origin/develop --pr 42)" PR)"

echo "== 워크트리 · 변경 없음 · detached =="
git worktree add -q "$T/w-wt" -b feat/y origin/develop 2>/dev/null
check "워크트리 줄 없음(리포만)" "| 리포 | \`socar-inc/accounts-web\` |" "$(cd "$T/w-wt" && line "$(bash "$SC" --port 5121 --base origin/develop)" 리포)"
check "변경 없음은 0"      "| 변경 | 0 files · +0 −0 · 0 commits |" "$(cd "$T/w-wt" && line "$(bash "$SC" --port 5121 --base origin/develop)" 변경)"
check "커밋 없으면 요약 —"  "| 작업 | — |" "$(cd "$T/w-wt" && line "$(bash "$SC" --port 5121 --base origin/develop)" 작업)"
git worktree add -q --detach "$T/w-pr" origin/feat/x 2>/dev/null
check "detached → 원격 브랜치명" "| 브랜치 | \`origin/feat/x\` → \`origin/develop\` |" "$(cd "$T/w-pr" && line "$(bash "$SC" --port 5122 --base origin/develop)" 브랜치)"
git -C "$T/w-pr" checkout -q --detach HEAD~1
check "detached · 원격 없음 → sha" "| 브랜치 | \`detached @ $(git rev-parse --short HEAD~1)\` → \`origin/develop\` |" "$(cd "$T/w-pr" && line "$(bash "$SC" --port 5122 --base origin/develop)" 브랜치)"

echo "== 인자 =="
bash "$SC" --port 1 >/dev/null 2>&1; check "base 없으면 exit 2" "2" "$?"
bash "$SC" --port 1 --base origin/nope >/dev/null 2>&1; check "base ref가 없으면 exit 2" "2" "$?"
bash "$SC" --port 1 --base origin/develop --comments "$T/missing.json" >/dev/null 2>&1; check "comments 파일이 없으면 exit 2(0으로 안 찍음)" "2" "$?"

echo; echo "통과 $pass · 실패 $fail"; [ "$fail" -eq 0 ]
