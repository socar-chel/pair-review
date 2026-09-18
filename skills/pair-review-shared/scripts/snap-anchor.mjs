#!/usr/bin/env node
// snap-anchor — 새 지적(트랙 A·B findings)의 {path, line} 을 difit 앵커 규칙(+ 줄만)에 맞춘다.
//
//   node snap-anchor.mjs origin/main...HEAD [--max-distance 30] < findings.jsonl > anchored.jsonl
//
// 입력 JSONL 한 줄: {"path": "...", "line": N, ...나머지 필드는 그대로 통과}
// 출력: line 이 유효한 + 줄로 바뀐 JSONL. stderr 에 사유를 남긴다 —
//   moved: path:old → new     가장 가까운 + 줄로 옮김(앞뒤 중 짧은 쪽)
//   far:   path:old (dist N)  가장 가까운 + 줄이 --max-distance 보다 멀다 → 출력하지 않는다(채팅으로 전한다)
//   skip:  path               새 diff 에 그 파일의 + 줄이 없다 → 출력하지 않는다
//   old:   path:line          side 가 old 인 지적은 손대지 않는다(삭제된 줄은 옛 번호가 앵커다)
// carry-comments 의 reanchor(뒤 첫 + 줄, 없으면 파일 첫 + 줄)를 쓰지 않는 이유는 diff-lines.mjs nearestAdded 참조.
import { addedLinesByFile, gitDiff, nearestAdded } from './diff-lines.mjs'

export function snap(findings, added, { maxDistance = 30 } = {}) {
  const out = []
  for (const f of findings) {
    if (f.side === 'old') { console.error(`old: ${f.path}:${f.line}`); out.push(f); continue }
    const best = nearestAdded(added.get(f.path), f.line)
    if (best === null) { console.error(`skip: ${f.path} — 새 diff 에 이 파일의 + 줄이 없다`); continue }
    if (best.distance > maxDistance) { console.error(`far: ${f.path}:${f.line} (dist ${best.distance}, 가장 가까운 + 줄 ${best.line})`); continue }
    if (best.distance > 0) console.error(`moved: ${f.path}:${f.line} → ${best.line}`)
    out.push({ ...f, line: best.line })
  }
  return out
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2)
  const range = args.find((a) => !a.startsWith('--'))
  const mdIdx = args.indexOf('--max-distance')
  const maxDistance = mdIdx >= 0 ? Number(args[mdIdx + 1]) : 30
  if (!range) { console.error('usage: snap-anchor.mjs <range> [--max-distance N] < findings.jsonl'); process.exit(2) }
  const added = addedLinesByFile(gitDiff([range]))
  const input = await new Promise((resolve) => { let d = ''; process.stdin.on('data', (c) => (d += c)).on('end', () => resolve(d)) })
  const findings = input.trim() ? input.trim().split('\n').map((l) => JSON.parse(l)) : []
  for (const f of snap(findings, added, { maxDistance })) console.log(JSON.stringify(f))
}
