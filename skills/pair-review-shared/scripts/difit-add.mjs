#!/usr/bin/env node
// difit-add — comment-imports 페이로드를 "지금 HEAD 의 diff 세션"에 올리고, 실제로 붙었는지 다시 읽어 확인한다.
//
//   node difit-add.mjs --port 5100 new.json [--target <rev>]      # --target 기본 HEAD
//
// 왜 `npx difit comment add` 대신인가 — 그 명령은 서버가 *지금 보고 있는* diff 세션에 넣는다. 커밋 직후에는
// 파일 감시가 새 커밋을 잡기 전이라 서버가 몇 초 동안 옛 target 을 쥐고 있고, 그 사이에 넣은 스레드는 옛 세션에
// 붙는다. `add` 는 성공을 돌려주지만 탭을 새로고침하면 새 세션이 비어 있다(실측). 여기서는 세션 키
// (base·target·baseMode)를 쿼리로 명시해 새 커밋의 세션에 직접 넣는다 — 서버가 언제 넘어가든 상관없다.
//
// 키 규칙: base·baseMode 는 /api/diff 가 보고한 값(--merge-base 면 커밋을 쌓아도 base 는 그대로다), target 은
// git rev-parse <rev> 의 앞 7자 — difit 이 세션 키에 쓰는 축약과 같다(`--short` 는 7자보다 길 수 있어 쓰지 않는다).
// 서버 target 이 커밋 해시가 아니면(--pr 모드의 stdin 등) 커밋과 무관한 세션이라 서버 값을 그대로 쓴다.
//
// 넣은 뒤 같은 키로 /api/comments-json 을 읽어 스레드마다 filePath·position·본문이 있는지 본다.
// 출력: 요약 JSON 한 줄. 종료코드 0 전부 붙음 · 1 빠진 것 또는 warnings 있음 · 2 사용법 · 3 서버 오류.
// 의존성 없음(순수 node, 내장 fetch).

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const COMMIT7 = /^[0-9a-f]{7}$/

function positionKey(p = {}) {
  const l = typeof p.line === 'number' ? `${p.line}` : `${p.line?.start}-${p.line?.end}`
  return `${p.side ?? 'new'}:${l}`
}

function attached(threads, imp) {
  const t = threads.find((x) => x.filePath === imp.filePath && positionKey(x.position) === positionKey(imp.position))
  if (!t) return false
  return (t.messages ?? []).some((m) => (m.body ?? '').trim() === (imp.body ?? '').trim())
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json()
}

// target7: 넣을 세션의 target(커밋 앞 7자). 서버 target 이 커밋이 아니면 무시하고 서버 값을 쓴다.
export async function addComments({ port, imports, target7 }) {
  const origin = `http://localhost:${port}`
  const diff = await getJson(`${origin}/api/diff`)
  const serverTarget = diff.targetCommitish
  const target = COMMIT7.test(serverTarget ?? '') && target7 ? target7 : serverTarget
  const query = new URLSearchParams({ base: diff.baseCommitish, target })
  if (diff.requestedBaseMode) query.set('baseMode', diff.requestedBaseMode)

  const res = await fetch(`${origin}/api/comment-imports?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imports),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`comment-imports → HTTP ${res.status} ${err.error ?? ''}`.trim())
  }
  const result = await res.json()
  const session = await getJson(`${origin}/api/comments-json?${query}`)
  const missing = imports
    .filter((imp) => !attached(session.threads ?? [], imp))
    .map((imp) => `${imp.filePath}:${positionKey(imp.position)}`)
  return {
    selection: Object.fromEntries(query),
    serverTarget,
    count: result.count ?? imports.length,
    warnings: result.warnings ?? [],
    missing,
  }
}

function parseArgs(argv) {
  const opts = { target: 'HEAD' }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opts.port = argv[++i]
    else if (argv[i] === '--target') opts.target = argv[++i]
    else rest.push(argv[i])
  }
  opts.file = rest[0]
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.port || !opts.file) {
    console.error('사용: difit-add.mjs --port <port> <payload.json> [--target <rev>]')
    process.exit(2)
  }
  const imports = JSON.parse(readFileSync(opts.file, 'utf8'))
  const target7 = execFileSync('git', ['rev-parse', opts.target], { encoding: 'utf8' }).trim().slice(0, 7)
  let out
  try {
    out = await addComments({ port: opts.port, imports, target7 })
  } catch (e) {
    console.error(`difit-add: ${e.message}`)
    process.exit(3)
  }
  console.log(JSON.stringify(out))
  if (out.serverTarget !== out.selection.target) {
    console.error(`note: 서버는 아직 ${out.serverTarget} 를 보고 있다 — ${out.selection.target} 세션에 직접 넣었고, 서버가 넘어가면 탭 새로고침 때 보인다`)
  }
  for (const w of out.warnings) console.error(`warning: ${w}`)
  for (const m of out.missing) console.error(`missing: ${m}`)
  process.exit(out.missing.length || out.warnings.length ? 1 : 0)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main()
