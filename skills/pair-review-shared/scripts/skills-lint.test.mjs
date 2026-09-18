// 세 스킬의 frontmatter 가 규격(agentskills.io)·Claude Code 권장을 지키는지 — 손으로 확인하던 것을 고정한다.
//   node --test skills/pair-review-shared/scripts/skills-lint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dirs = readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, 'SKILL.md')));

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, 'frontmatter 블록(---)이 있어야 한다');
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line);   // 최상위 키만 — metadata 같은 중첩은 값이 비어 있다
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

test('스킬 디렉터리 셋이 있다', () => {
  assert.deepEqual(dirs.sort(), ['pair-review', 'pair-review-pr', 'pair-review-shared']);
});

for (const d of dirs) {
  test(`${d}: name 은 디렉터리명, description 은 1~1024자, 둘 다 XML 태그 없음`, () => {
    const fm = frontmatter(readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8'));
    assert.equal(fm.name, d);
    assert.match(fm.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(fm.name.length <= 64);
    assert.ok(fm.description && fm.description.length >= 1 && fm.description.length <= 1024, `description ${fm.description?.length}자`);
    assert.doesNotMatch(fm.description, /<[a-z]/i);
  });
}

test('pair-review-shared 는 호출되지 않는 파일 컨테이너 — 두 플래그가 있어야 한다', () => {
  const fm = frontmatter(readFileSync(join(skillsDir, 'pair-review-shared', 'SKILL.md'), 'utf8'));
  assert.equal(fm['user-invocable'], 'false');
  assert.equal(fm['disable-model-invocation'], 'true');
});

test('두 스킬은 $ARGUMENTS 를 쓰므로 argument-hint 가 있어야 한다', () => {
  for (const d of ['pair-review', 'pair-review-pr']) {
    const text = readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8');
    assert.ok(text.includes('$ARGUMENTS'), `${d}: $ARGUMENTS`);
    assert.ok(frontmatter(text)['argument-hint'], `${d}: argument-hint`);
  }
});

test('두 스킬이 shared 를 ${CLAUDE_SKILL_DIR} 기준 상대경로로 가리킨다 — 절대경로·옛 경로 없음', () => {
  for (const d of ['pair-review', 'pair-review-pr']) {
    const text = readFileSync(join(skillsDir, d, 'SKILL.md'), 'utf8');
    assert.ok(text.includes('${CLAUDE_SKILL_DIR}/../pair-review-shared/scripts'), `${d}: 상대경로`);
    assert.doesNotMatch(text, /~\/\.claude\/skills\/pair-review\/scripts|COMMON\.md/, `${d}: 옛 경로`);
  }
});
