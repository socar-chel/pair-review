import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addComments } from './difit-add.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// difit 서버 흉내 — 세션은 쿼리(base·target·baseMode)가 키이고, 쿼리가 없으면 "지금 보는" diff 의 키를 쓴다.
function fakeDifit({ target = 'aaaaaaa', baseMode = 'merge-base', dropImports = false, warnings = [] } = {}) {
  const sessions = new Map();
  const imports = [];
  const current = { base: '1111111', target, baseMode };
  const keyOf = (q) => {
    const has = ['base', 'target', 'baseMode'].some((k) => q.has(k));
    const s = has ? { base: q.get('base'), target: q.get('target'), baseMode: q.get('baseMode') } : current;
    return `${s.base}|${s.target}|${s.baseMode ?? ''}`;
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    if (url.pathname === '/api/diff') {
      return send({ baseCommitish: current.base, targetCommitish: current.target, requestedBaseMode: current.baseMode, files: [] });
    }
    if (url.pathname === '/api/comment-imports') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const items = JSON.parse(body);
        const key = keyOf(url.searchParams);
        imports.push({ key, query: Object.fromEntries(url.searchParams), items });
        if (!dropImports) {
          const threads = sessions.get(key) ?? [];
          for (const i of items) threads.push({ filePath: i.filePath, position: i.position, messages: [{ body: i.body }] });
          sessions.set(key, threads);
        }
        send({ success: true, count: items.length, warnings });
      });
      return;
    }
    if (url.pathname === '/api/comments-json') {
      return send({ version: 1, threads: sessions.get(keyOf(url.searchParams)) ?? [] });
    }
    res.statusCode = 404; res.end();
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port, imports, sessions, current })));
}

const thread = { type: 'thread', author: 'claude', filePath: 'a.md', position: { side: 'new', line: 12 }, body: '🟡 논의 — 본문' };

// 커밋 직후 서버가 아직 옛 target 을 보고 있는 상황 — 그대로 넣으면 옛 세션에 붙는다(실측 결함).
test('서버가 옛 target 을 보고 있어도 새 커밋의 세션에 넣는다', async () => {
  const d = await fakeDifit({ target: 'aaaaaaa' });
  try {
    const out = await addComments({ port: d.port, imports: [thread], target7: 'bbbbbbb' });
    assert.deepEqual(d.imports[0].query, { base: '1111111', target: 'bbbbbbb', baseMode: 'merge-base' });
    assert.equal(out.serverTarget, 'aaaaaaa');
    assert.deepEqual(out.missing, []);
    assert.equal(d.sessions.has('1111111|aaaaaaa|merge-base'), false);
    // 서버가 새 커밋으로 넘어가면 쿼리 없는 조회(=탭 새로고침)가 그 스레드를 본다
    d.current.target = 'bbbbbbb';
    assert.equal(d.sessions.get('1111111|bbbbbbb|merge-base').length, 1);
  } finally { d.server.close(); }
});

// add 가 성공을 돌려줘도 세션에 없을 수 있다 — 다시 읽어서만 안다.
test('넣은 뒤 다시 읽어 빠진 스레드를 missing 으로 알린다', async () => {
  const d = await fakeDifit({ dropImports: true });
  try {
    const out = await addComments({ port: d.port, imports: [thread], target7: 'aaaaaaa' });
    assert.deepEqual(out.missing, ['a.md:new:12']);
  } finally { d.server.close(); }
});

test('서버 warnings 를 그대로 돌려준다(매칭 스레드 없는 reply 등)', async () => {
  const d = await fakeDifit({ warnings: ['Skipped reply import for a.md:new:12'] });
  try {
    const out = await addComments({ port: d.port, imports: [thread], target7: 'aaaaaaa' });
    assert.deepEqual(out.warnings, ['Skipped reply import for a.md:new:12']);
  } finally { d.server.close(); }
});

// --pr 모드는 target 이 커밋이 아니다(stdin) — HEAD 로 바꿔 끼우면 아무도 안 보는 세션에 넣게 된다.
test('서버 target 이 커밋 해시가 아니면 서버 값을 그대로 쓴다', async () => {
  const d = await fakeDifit({ target: 'stdin' });
  try {
    const out = await addComments({ port: d.port, imports: [thread], target7: 'bbbbbbb' });
    assert.equal(d.imports[0].query.target, 'stdin');
    assert.deepEqual(out.missing, []);
  } finally { d.server.close(); }
});

test('baseMode 가 없으면 쿼리에 붙이지 않는다', async () => {
  const d = await fakeDifit({ baseMode: null });
  try {
    await addComments({ port: d.port, imports: [thread], target7: 'aaaaaaa' });
    assert.equal('baseMode' in d.imports[0].query, false);
  } finally { d.server.close(); }
});

// CLI: --target 을 git 으로 풀어 앞 7자를 쓴다(--short 는 7자보다 길 수 있다), 다 붙으면 rc 0.
test('CLI — --target 을 rev-parse 앞 7자로 풀고 rc 0', async () => {
  const d = await fakeDifit({ target: 'aaaaaaa' });
  try {
    const file = join(mkdtempSync(join(tmpdir(), 'difit-add-')), 'p.json');
    writeFileSync(file, JSON.stringify([thread]));
    const want = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: here, encoding: 'utf8' }).trim().slice(0, 7);
    const rc = await new Promise((resolve) => {
      spawn(process.execPath, [join(here, 'difit-add.mjs'), file, '--port', String(d.port), '--target', 'HEAD'], { cwd: here, stdio: 'ignore' })
        .on('exit', resolve);
    });
    assert.equal(rc, 0);
    assert.equal(d.imports[0].query.target, want);
  } finally { d.server.close(); }
});
