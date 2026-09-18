import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snap } from './snap-anchor.mjs';
import { addedLinesByFile, nearestAdded } from './diff-lines.mjs';

const diff = [
  '--- a/a.md',
  '+++ b/a.md',
  '@@ -18,6 +18,38 @@',
  ' ctx1',
  '+added 19',
  ' ctx2',
  ' ctx3',
  '+added 22',
  '+added 23',
  '--- a/b.md',
  '+++ b/b.md',
  '@@ -1,2 +1,3 @@',
  ' keep',
  '+added 2',
].join('\n');
const added = addedLinesByFile(diff);

test('nearestAdded — 유효 줄은 거리 0, 앞뒤 중 가까운 쪽, 같으면 뒤', () => {
  assert.deepEqual(nearestAdded(added.get('a.md'), 22), { line: 22, distance: 0 });
  assert.deepEqual(nearestAdded(added.get('a.md'), 20), { line: 19, distance: 1 });   // 19(1) vs 22(2)
  assert.deepEqual(nearestAdded(added.get('a.md'), 21), { line: 22, distance: 1 });   // 19(2) vs 22(1)
  assert.deepEqual(nearestAdded(added.get('a.md'), 20.5), { line: 22, distance: 1.5 }); // 동거리 → 뒤
  assert.deepEqual(nearestAdded(added.get('a.md'), 200), { line: 23, distance: 177 }); // 첫 줄로 폴백하지 않는다
  assert.equal(nearestAdded(undefined, 1), null);
});

test('snap — 유지·이동·far 탈락·파일 없음 탈락·old 통과, 나머지 필드 보존', () => {
  const errs = []; const orig = console.error; console.error = (m) => errs.push(m);
  try {
    const out = snap([
      { path: 'a.md', line: 22, summary: 'keep' },
      { path: 'a.md', line: 20, summary: 'move' },
      { path: 'a.md', line: 200, summary: 'far' },
      { path: 'zzz.md', line: 1, summary: 'skip' },
      { path: 'a.md', line: 5, side: 'old', summary: 'old' },
    ], added, { maxDistance: 30 });
    assert.deepEqual(out.map((f) => [f.path, f.line, f.summary, f.side]), [
      ['a.md', 22, 'keep', undefined], ['a.md', 19, 'move', undefined], ['a.md', 5, 'old', 'old'],
    ]);
  } finally { console.error = orig; }
  assert.equal(errs.filter((e) => e.startsWith('moved:')).length, 1);
  assert.equal(errs.filter((e) => e.startsWith('far:')).length, 1);
  assert.equal(errs.filter((e) => e.startsWith('skip:')).length, 1);
  assert.equal(errs.filter((e) => e.startsWith('old:')).length, 1);
});
