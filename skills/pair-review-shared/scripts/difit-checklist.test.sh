#!/usr/bin/env bash
# 실행: bash skills/pair-review-shared/scripts/difit-checklist.test.sh
set -u
SC="$(cd "$(dirname "$0")" && pwd)/difit-checklist.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
check() { local name="$1" want="$2" got="$3"; if [ "$want" = "$got" ]; then echo "  ✅ $name"; pass=$((pass+1)); else echo "  ❌ $name"; echo "     want: $want"; echo "     got:  $got"; fail=$((fail+1)); fi; }

echo "== 배정 파일 없음 → rc 3"
DIFIT_CHECKLIST_FILE="$T/none" bash "$SC" >/dev/null 2>&1; check "rc" 3 $?

echo "== 경로 둘 중 하나만 존재 → 존재하는 것만, rc 0, missing 은 stderr"
touch "$T/a.md"; printf '# 개인 체크리스트\n%s\n\n%s   \n' "$T/a.md" "$T/gone.md" > "$T/cl"
out="$(DIFIT_CHECKLIST_FILE="$T/cl" bash "$SC" 2>"$T/err")"; rc=$?
check "rc" 0 $rc; check "stdout" "$T/a.md" "$out"; check "stderr" "missing: $T/gone.md" "$(cat "$T/err")"

echo "== 마지막 줄에 개행이 없어도 읽는다"
printf '%s' "$T/a.md" > "$T/cl3"; out="$(DIFIT_CHECKLIST_FILE="$T/cl3" bash "$SC" 2>/dev/null)"; check "개행 없음" "$T/a.md" "$out"

echo "== 전부 없음 → rc 4"
printf '%s\n' "$T/gone.md" > "$T/cl2"; DIFIT_CHECKLIST_FILE="$T/cl2" bash "$SC" >/dev/null 2>&1; check "rc" 4 $?

echo "== ~ 확장"
HOME="$T" ; mkdir -p "$T/.config/pair-review"; touch "$T/mine.md"; printf '~/mine.md\n' > "$T/.config/pair-review/checklist"
out="$(XDG_CONFIG_HOME= bash "$SC" 2>/dev/null)"; check "~ → \$HOME" "$T/mine.md" "$out"

echo; echo "통과 $pass · 실패 $fail"; [ "$fail" -eq 0 ]
