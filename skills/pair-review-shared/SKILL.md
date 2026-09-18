---
name: pair-review-shared
description: pair-review·pair-review-pr 두 스킬의 공통부 — difit 띄우기·검증, 포트, URL 카드, 브라우저, 코멘트 규약, 수집 마커, 창 이상 대응과 스크립트. 직접 호출하지 않는다 — 두 스킬이 이 문서를 가리키고 scripts/를 쓴다.
user-invocable: false
disable-model-invocation: true
license: MIT
compatibility: Claude Code. git, gh, Node ≥ 21 (npx difit)
---

# pair-review 공통 — difit 띄우기 · 검증 · 코멘트 규약 · 수집

`pair-review`(내 브랜치)와 `pair-review-pr`(남의 PR)이 똑같이 하는 부분이다. 각 SKILL.md는 다른
부분만 적고 여기를 가리킨다. 플래그·API는 difit v5.0.8~5.0.12에서 실측한 것이다 — difit 사용법이
갱신되면 upstream `difit` 스킬의 SKILL.md를 먼저 읽고 여기를 맞춘다.

`<scripts>`는 이 문서와 같은 디렉터리의 `scripts/`다. 두 스킬의 SKILL.md는 `${CLAUDE_SKILL_DIR}/../pair-review-shared/scripts`로
온다 — 그 변수는 **각 스킬이 호출될 때 자기 SKILL.md의 폴더로 치환**되고, 이 문서는 스킬로 호출되지 않아 여기서는 치환되지
않는 표기일 뿐이다. 전역(`~/.claude/skills/`)이든 프로젝트(`.claude/skills/`)든 형제 폴더라 같은 경로가 선다. 절대경로를 적지 않는다.

## 차례

명령 · 포트 · 띄우기 + 검증 · 카드 · 브라우저 · 셀프리뷰 — 두 트랙 · 코멘트 규약 · 수집과 처리 마커 · 창이 이상할 때 · 종료

## 명령

`command -v difit`이 있으면 `difit`, 없으면 `npx difit`. ⚠️ difit 자체 리포를 체크아웃한 디렉터리에서
`npx difit`을 치면 로컬 패키지(미빌드)가 잡혀 exit 127이 난다 — `comment get/add`까지 전부 그렇다. 그 리포를
볼 때는 전역 설치 바이너리나 npx 캐시의 바이너리(`ls ~/.npm/_npx/*/node_modules/.bin/difit`)를 절대경로로 쓴다.

## 포트

**레포 이름에서 계산한다** — `bash <scripts>/difit-port.sh` (origin 레포명의 cksum → 5100~5890 사이
10의 배수). 같은 레포는 어느 머신·워크트리에서든 같은 포트라 "지금 보는 창이 어느 레포인지"가 포트로 갈린다.

**외우기 쉬운 번호를 주고 싶은 레포는 배정 파일에 적는다** — `~/.config/pair-review/ports`(또는
`$XDG_CONFIG_HOME/pair-review/ports`)에 `<origin 레포명>=<포트>` 한 줄씩. 스크립트가 해시보다 먼저 읽으므로
에이전트가 기억할 필요가 없다. 배정 포트도 10의 배수로 둔다(아래 폴백·이웃 규칙 때문). `#` 주석·빈 줄 허용,
같은 이름이 여러 줄이면 마지막 줄이 이긴다. 경로는 `DIFIT_PORTS_FILE`로 바꿀 수 있다(테스트용).

- **대상이 하나여도 `--port`를 명시한다** — 생략하면 difit 기본값 4966부터 비는 포트를 잡는데, 다른 세션이
  쥐고 있으면 조용히 4967로 밀려 사용자가 옛 탭을 본다.
- 10의 배수만 쓰는 이유: difit 폴백이 +1이라 이웃 번호가 다른 레포에 배정되면 폴백이 그리로 떨어진다.
  범위를 5100에서 시작하는 이유: 3000·4200·5000(macOS AirPlay)·5173(Vite)·6006·8080처럼 개발 도구가
  선점하는 번호와 안 겹친다 — "51xx만 쓴다"는 뜻이 아니다. 5890까지 전부 후보다.
- 같은 레포에서 두 스킬이 동시에 뜰 수 있다 — `pair-review`는 +0(스택 PR은 +1·+2), `pair-review-pr`은 +5.

## 띄우기 + 검증

```bash
npx difit HEAD origin/<base> --merge-base --background --keep-alive --port <포트> \
  --comment "$(cat comments.json)"          # 시드 스레드가 있을 때만
# → {"port":5100,"url":"http://localhost:5100","pid":12345}
```

| 인자 | 이유 |
| --- | --- |
| 타깃 `HEAD` (브랜치명 아님) | difit은 "특정 커밋 비교"로 판정하면 파일 감시를 끈다. `HEAD`면 감시가 켜져 새 커밋이 서버 재시작 없이 반영된다. 시작 배너에 `🔍 File watching disabled`가 뜨면 잘못 준 것 |
| `origin/<base>` (로컬 브랜치명 아님) | 워크트리 세션은 공유 `.git`의 로컬 ref가 낡아 있을 수 있어, 브랜치명을 그대로 주면 남의 커밋이 diff에 섞인다. `git diff`·`git log`도 전부 `origin/<base>` |
| `--merge-base` | base를 merge-base 커밋에 고정한다. 원격 base가 전진했을 때 남의 머지분이 diff에 섞이는 것을 막는다 |
| `--background` | 서버를 띄운 채 JSON 한 줄만 뱉는다. `pid`로 정확히 죽인다. 브라우저를 자동으로 열지 않는다 |
| `--keep-alive` | 브라우저가 끊겨도 서버를 살린다. 없으면 창을 닫는 순간 서버와 **메모리의 코멘트 스레드가 함께 사라진다** |

기동 직후 **서버가 보는 것과 git이 보는 것을 대조하고, 맞을 때만 사용자에게 URL을 준다**:

```bash
curl -s localhost:<port>/api/diff | jq '{base:.baseCommitish, target:.targetCommitish, mode:.requestedBaseMode, files:(.files|length)}'
git rev-parse --short "$(git merge-base origin/<base> HEAD)"
git diff origin/<base>...HEAD --stat | tail -1
```

`base`는 **merge-base 커밋**이어야 한다(`--merge-base`를 줬으므로 `origin/<base>` 끝 커밋과 다를 수 있다 —
원격이 전진했을수록 다르다). `mode`는 `merge-base`, `files`는 `--stat` 마지막 줄의 파일 수와 같아야 한다.

- 출력 JSON의 `port`가 요청값과 다르면(점유돼 +1로 폴백) **그 값을 쓰고 사용자에게 알린다.** 이후
  `comment get/add`의 `--port`도 전부 실제 값이다.
- 같은 대상의 서버가 이미 떠 있으면(`<scripts>/difit-health-check.sh`로 본다) 새로 띄우지 않는다 — 스레드는
  `comment add`로 얹는다.
- 실행 자체가 실패하면 폴백: 사용자에게 difit UI의 "Copy All Prompts" 붙여넣기를 안내한다.
- 검증이 끝나면 「카드」를 주고 「브라우저 — 어떻게 여나」대로 연다. `--keep-alive` 덕에 탭을 닫아도 서버는 산다.

## 카드 — URL은 항상 이 표와 함께 준다

difit 화면에는 `HEAD ↔ sha`뿐이라 창을 여럿 띄우면 어느 레포·브랜치를 어느 base와 비교하는지 화면만
보고는 알 수 없다. 그래서 URL을 맨 URL로 주지 않고 **채팅에 카드를 붙여 대화창이 그 창의 제목 표시줄이
되게 한다.** 대조가 맞은 뒤에 스크립트로 만들고 출력을 **그대로** 붙인다(코드 블록으로 감싸지 않는다 —
마크다운 표라 그대로 렌더된다). 손으로 조립하지 않는다 — 세션마다 형식이 흔들리고 값이 검증과 어긋난다.

```bash
bash <scripts>/difit-banner.sh --port <포트> --base origin/<base> --summary "<한 줄>" --comments comments.json
```

| 🔍 difit | http://localhost:5120 |
| --- | --- |
| 작업 | 면허 등록 화면을 웹뷰 back/X 판정에 맞춘다 |
| 리포 | `socar-inc/accounts-web` |
| 브랜치 | `feat/NEWACC-1549-license` → `origin/develop` |
| 변경 | 12 files · +340 −88 · 3 commits |
| 시드 | 🔴 1 · 🟡 3 · 🟢 2 |

- `--summary`는 **이 diff가 하는 일 한 줄** — 방금 읽은 diff에서 에이전트가 사용자의 언어로 쓴다. 티켓 제목을
  베끼지 않는다(티켓은 "무엇을 원했나", 여기는 "무엇이 바뀌나"). 생략하면 브랜치 첫 커밋 제목이 들어간다.
- `--comments`는 시드가 없으면 생략한다 — 시드 줄은 0으로 찍힌다(카드 모양은 항상 같다). 준 파일을 못
  읽으면 0으로 찍지 않고 실패한다 — "시드 없음"과 "경로 잘못 줌"이 같은 카드가 되면 안 된다.
- `--port`에는 출력 JSON의 **실제** 포트를 준다(폴백됐으면 그 값). `pair-review-pr`은 `--pr <n>`을 더해
  PR 번호·제목 줄을 넣는다. 스택 PR처럼 창이 여럿이면 창마다 카드 하나.

## 브라우저 — 어떻게 여나

`bash <scripts>/difit-browser.sh`가 배정 파일 `~/.config/pair-review/browser`(또는 `$XDG_CONFIG_HOME/pair-review/browser`,
`DIFIT_BROWSER_FILE`) 한 줄을 읽는다. 값은 둘뿐이다:

| 값 | 동작 |
| --- | --- |
| `link` | URL만 안내한다. 사용자가 링크를 눌러 자기 기본 브라우저로 연다. 종료는 `kill <pid>`뿐 |
| `agent-browser` | 에이전트가 agent-browser headed 창으로 연다(아래 절차). 종료 때 창도 닫는다 |

파일이 없으면(종료 코드 3) **한 번만** 두 선택지를 묻고 답을 저장한다 — `mkdir -p ~/.config/pair-review &&
echo <값> > ~/.config/pair-review/browser`. 이후 라운드·세션에서는 다시 묻지 않는다(사람·머신에 붙는 선호지
리뷰 건마다 갈리는 결정이 아니다). 값이 이상하면(종료 코드 2) 고치라고 알리고 그 라운드는 `link`로 간다.

### `agent-browser` 절차

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix difit)"
export AGENT_BROWSER_AUTOSAVE_INTERVAL_MS=0
agent-browser open <url> --headed --restore "$AGENT_BROWSER_SESSION"
```

- **세션은 워크트리별 이름으로** — 기본(무명) 세션은 머신의 모든 에이전트가 공유하는 브라우저 하나라 남의 탭을
  가로챈다. 같은 세션의 모든 명령에 같은 `AGENT_BROWSER_SESSION`이 있어야 한다(export면 된다).
- **`--restore`** 는 difit이 localStorage에 쌓는 "파일 봤음" 체크와 코멘트를 브라우저 재기동 너머로 보존해
  `~/.agent-browser/sessions/<이름>-<이름>.json`에 남긴다 — 서버·탭이 동시에 죽었을 때 코멘트를 되찾는 **세 번째
  저장소**다(실측 — 스레드 23건 손실 없음). 키 끝의 모드(`-merge-base`)가 서버 기동 모드와 같아야 이어진다.
- **`AGENT_BROWSER_AUTOSAVE_INTERVAL_MS=0`은 빼면 안 된다** — agent-browser 자체 변수(기본 30000ms)를 0으로 덮는
  것이다. `--restore`의 30초 주기 자동 저장이 임시 탭을 열었다 닫는데, headed Chrome에 탭이 생기면 macOS가 창을 activate해 포커스를 뺏는다(실측 — origin이 다른 탭이
  둘 이상일 때 즉 스택 PR 탭 셋에서 난다). 0이면 저장 시점은 `close`와 사용자의 창 닫기뿐이다.
- 스택 PR이면 세션 하나에 탭 셋: `open <url①>` → `tab new <url②>` → `tab new <url③>`.
- `--profile`은 쓰지 않는다. `open`이 `Failed to connect`로 죽으면 한 번 재시도한다.
- **창 위치·포커스는 이 절차가 정하지 않는다.** 기본은 주 모니터에 뜨고 포커스를 가져간다. 보조 모니터 배치·포커스
  가드 같은 편의는 각자의 환경(래퍼 등)이 얹는다 — 여기 적지 않는다.

## 셀프리뷰 — 두 트랙

두 스킬의 시드(`pair-review` 1단계 · `pair-review-pr` 2단계 지적)는 여기서 만든다. **diff는 한 번 읽고 두 렌즈로
본다** — 트랙 A는 결함, 트랙 B는 기준 대조. 실측(같은 19파일 diff): 두 트랙이 잡은 것이 하나도 겹치지 않았다 —
A는 문서 속 복구 명령의 스코프 오류를, B는 빠진 테스트를 잡았다. 한 렌즈로는 둘 중 하나가 빠진다.

### 트랙 A — `/code-review`

`/code-review <effort> <range>` — effort 기본 `medium`(확신 높은 것만 — 시드는 적고 맞아야 한다), range는
`origin/<base>...HEAD`(`pair-review`) 또는 PR 번호(`pair-review-pr`). 결과는 findings 목록 — 항목마다 `file`·`line`·
`summary`·`failure_scenario`·`category`. 하네스에 따라 두 모양으로 돈다:

| 하네스 | 동작 | 할 일 |
| --- | --- | --- |
| 터미널 | 백그라운드 포크 — 별도 문맥에서 돌고 findings가 알림으로 온다 | 트랙 B를 먼저 하고 알림을 기다린다 |
| 데스크톱 앱(Agent SDK) | **인라인** — 리뷰 지시문이 이 문맥에 들어오고 이 에이전트가 직접 수행한다 | 그 자리에서 수행. 트랙 B와 같은 판단 주체라 **독립성이 없다** — 아래 반박 패스가 유일한 오탐 필터다 |

신호등은 `category`로 기계 매핑하지 않는다 — 두 findings가 다 `correctness`였는데 문서 결함이라 🟡가 맞았다.
**`failure_scenario`가 머지되면 안 되는 수준이면 🔴, 아니면 🟡.** 본문: `summary` 첫 문장 → `failure_scenario` 문단 →
마지막 줄 `출처: /code-review <effort>`.

### 트랙 B — standards sources

있는 것만, 이 순서로 읽고 그 기준으로 diff를 검토한다:

1. `<repo>/REVIEW.md` — 팀의 리뷰 전용 기준(Claude Code 호스티드 Code Review와 같은 파일)
2. `<repo>/CONTRIBUTING.md`
3. `bash <scripts>/difit-checklist.sh` — 배정 파일 `~/.config/pair-review/checklist`(또는 `$XDG_CONFIG_HOME/pair-review/checklist`,
   `DIFIT_CHECKLIST_FILE`)에 한 줄당 경로 하나. 개인 체크리스트를 여기서 잇는다. 없으면(rc 3) 묻지 않고 건너뛴다 —
   `browser`와 달리 선택 사항이다. 적힌 파일이 없으면(rc 4) 배정 파일을 고치라고 알린다.

하나도 없으면 모델 판단으로 검토한다 — 이 트랙이 비는 것이지 셀프리뷰가 비는 것이 아니다. 팀 룰이 `CLAUDE.md`·
`.claude/rules/`에 있으면 여기서 다시 읽지 않는다 — 세션이 이미 로드했고 트랙 A(`/code-review`)도 그것을 읽는다.

- **스펙 축** — 호출 측이 `--spec <파일|URL>`을 넘겼을 때만(`--spec pr`이면 PR 본문 — `gh pr view [<n>] --json body -q .body`, 번호가 없으면 현재 브랜치의 PR): 스펙이 요구한 것 중 빠진 것 · 요구하지 않은 것(scope creep) ·
  구현이 어긋난 것. 없으면 "스펙 없음"으로 건너뛴다(묻지 않는다). 기준 대조와 스펙 대조는 **합치지 않고 나란히** 보고한다 —
  기준은 다 지켰는데 엉뚱한 것을 만든 diff와, 요구는 다 맞췄는데 컨벤션을 깬 diff는 서로를 가린다.
- **규모** — 변경 파일 20개 이상 또는 +1000줄이면 관점을 나눠 서브에이전트로 병렬 검토한다.
- 본문 마지막 줄 `출처: REVIEW.md 「…」` / `CHECKLIST 「N. …」` — 리뷰어가 기준의 출처를 바로 찾게.

### 반박 → 병합 → 앵커

1. **반박 패스 1회, 두 트랙 전체에** — 항목마다 코드 근거로 반박을 시도하고 반박되면 버린다. 실측: 트랙 B 후보 3건 중 2건이
   여기서 떨어졌다(표기 차이는 모순이 아니었고, 분량 지적은 취향이었다).
2. **병합** — 같은 `file:line`은 하나로. **같은 원인이 여러 파일에 있으면 대표 한 곳에 스레드**, 나머지 위치는 본문에 열거한다
   (실측: 트랙 A 2건이 한 결정의 두 사본이었다).
3. **🟡 상한 5** — 넘으면 상위 5개만 시드하고 나머지는 채팅에 한 줄씩. 🔴는 상한이 없다.
4. **앵커** — findings를 `{path, line, …}` JSONL로 모아 스냅한다:
   ```bash
   node <scripts>/snap-anchor.mjs origin/<base>...HEAD < findings.jsonl > anchored.jsonl   # --max-distance 30
   ```
   유효한 `+` 줄은 유지, 아니면 **가장 가까운** `+` 줄(stderr `moved:`). `far:`(30줄 넘게 멂)·`skip:`(파일에 `+` 줄 없음)은
   시드하지 않고 채팅으로 전한다 — 새 지적이 파일 맨 위로 튀면 "그 줄에 대한 지적"으로 읽힌다(이월용 `carry-comments`의
   폴백과 다른 이유). 삭제된 줄에 대한 지적은 `side: old` + 옛 줄 번호로 그대로 둔다.
5. `anchored.jsonl`을 「코멘트 규약」 페이로드로 바꿔 `comments.json`으로 저장한다.

## 코멘트 규약

스레드 본문은 **신호등**으로 시작한다 — 리뷰어가 빨강부터 훑을 수 있게:

- `🔴` 반드시 고쳐야 한다 — 버그·보안·데이터 손실처럼 머지되면 안 되는 것
- `🟡` 논의·제안 — 판단이 갈리는 것, 더 나은 대안이 있어 보이는 것
- `🟢` 설명 — 조치 불필요. 왜 이렇게 했는지, 무엇을 먼저 보면 되는지

자명한 변경·기계적 치환에는 달지 않는다 — 스레드가 많다고 좋은 리뷰가 아니다.

`--comment`와 `comment add`가 같은 페이로드를 받는다:

```json
[{ "type": "thread", "author": "claude",
   "filePath": "src/lib/auth/route-fetch.ts",
   "position": { "side": "new", "line": 50 },
   "body": "🟡 논의 — …" }]
```

- `filePath`는 **저장소 기준 상대경로** (`GET /api/diff`의 `files[].path`와 같은 형식). 어긋나면 400이
  아니라 매칭 실패로 **조용히 엉뚱한 자리에** 붙는다.
- `position.side`는 `old`|`new` 필수 — 삭제된 줄을 가리킬 때만 `old`. `position.line`은 양의 정수 또는
  `{start, end}`.
- **`position.line`은 반드시 `+`로 추가된 줄이어야 한다.** ① `1`은 수정 파일의 diff에 없어 스레드가
  화면에 안 뜬다 ② hunk 헤더(`@@ -18,6 +18,38 @@`)의 new 측 시작 줄은 컨텍스트 줄이라 difit이 안 바뀐
  코드를 수십 줄 펼친다. 앵커는 눈으로 세지 않는다:
  ```bash
  node <scripts>/first-added-line.mjs origin/<base>...HEAD      # 파일별 {path, line, sample} JSONL
  ```
  헬퍼는 `git diff`를 직접 부르며 `core.quotePath`(한글 경로 인용)·`diff.noprefix`·색·외부 diff 도구를 끈
  채 읽는다 — 사용자 git 설정에 따라 파일이 조용히 빠지는 일을 막는다.
- **파일 상단에 총평을 달지 않는다.** 첫 줄에 붙은 코멘트는 "그 줄에 대한 지적"으로 읽힌다.
- 코멘트 본문은 사용자의 언어로 쓴다. `body`가 공백이면 400. 필드 이름이 틀리면
  `Invalid comment import field: <이름>`.
- **토큰·비밀번호·API 키 등 자격증명은 body에 옮겨 적지 않는다** — 명령줄 인자로도 남는다.
- `type: "reply"`는 매칭 스레드가 없으면 에러가 아니라 `success: true`에 `warnings: ["Skipped reply import
  for <path>:new:<line> …"]`로 온다 — `add` 응답의 `count`와 `warnings`를 반드시 본다.
- CLI를 못 쓰면 `POST /api/comment-imports`가 같은 일을 한다. `POST /api/comments`와 혼동하지 말 것 —
  그쪽은 스레드 목록을 통째로 교체한다. 같은 코멘트를 다시 보내면 difit이 건너뛴다(멱등).

## 수집과 처리 마커

```bash
npx difit comment get --port <port> --format json > threads.json
node <scripts>/pending-threads.mjs < threads.json      # {id, filePath, line, question, history} JSONL
```

**"마지막 메시지가 내 것이 아닌 스레드"가 곧 미처리분**이다 — 별도 상태 파일도, thread ID 추적도
필요 없다(ID는 이월하면 새로 발급돼 라운드를 못 넘긴다). `comment resolve`는 **스레드를 지우는** 명령이라
기본적으로 쓰지 않는다.

`comment get`이 0건인데 사용자가 "달았다"고 하면 서버가 아니라 **탭이 옛 diff를 보고 있던 것**을 의심한다 —
그동안 단 코멘트는 탭의 localStorage 옛 키(`difit-storage-v1/<repo-hash>/<base7>-<target7>-<mode>`)에만 있고
서버에는 안 온다. 에이전트가 agent-browser로 연 탭이면 `eval`로 그 키를 읽고, 사용자가 직접 연 탭이면 읽을
수 없으니 "탭을 새로고침한 뒤 코멘트가 남아 있는지 봐 달라"고 부탁하고 `comment get`을 다시 한다.
"코멘트 0건" 판정은 이 확인을 거친 뒤에만 내린다.

옛 세션은 사라지지 않고 옛 키에 남는다. 되찾으려면 `/api/diff`가 보고한 **7자 축약형** 그대로
`GET /api/comments-json?base=<base7>&target=<옛 target7>&baseMode=merge-base`로 조회한다 — `baseMode`를
빼거나 8자로 주면 키가 어긋나 0건이다(v5.0.12 실측). 키 끝의 모드는 `--merge-base` 유무로 갈리므로
**루프 내내 한 모드를 유지한다.**

## 창이 이상할 때

깜빡임·리로드·포커스 보고가 오면 추측 전에 `<scripts>/difit-health-check.sh <port…>` — 프로세스와
포트별 `/api/diff`(서버가 붙든 base·target·파일 수)를 한 번에 본다. difit은 특정 커밋 비교에서
자체 리로드가 없으므로 반복 리로드는 difit 밖(다른 도구의 reload, 창 재기동)에서 찾는다.

## 종료

죽이기 전에 `comment get`으로 마지막 사본을 남긴다. 그다음 `kill <pid>`.

`agent-browser`로 열었으면 창도 닫는다 — headed 창은 유휴 자동 종료가 없어 안 닫으면 쌓인다. 사용자가 눈으로
확인할 것이 남았으면 "확인 후 닫아 달라"고 말하고 넘긴다. 에이전트가 닫을 때:

1. `agent-browser --session "$AGENT_BROWSER_SESSION" close` — **창이 살아 있을 때만.** 창이 이미 사라진 세션에
   부르면 데몬이 응답을 못 받아 무한 대기한다. 그때는 `kill $(cat ~/.agent-browser/<세션>.pid)`.
2. 생존 확인으로 그 세션에 다른 명령(`get cdp-url` 등)을 보내지 않는다 — 조회조차 브라우저를 되살린다.
   프로세스로만 본다: `pgrep -f agent-browser-chrome`.
3. `close`는 현재 세션만 닫는다. 스택으로 여러 세션을 띄웠으면 세션별로.
