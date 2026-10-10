/* ============================================================
   tests/ai-layers-8a.test.mjs — 8a 새 파일들의 계층·위생 (3-2 · 13절 · 15절 · 16-K)

   - 새 `ai/*` 는 `console` 을 부르지 않는다(13절 — 7a 와 같은 규칙).
   - 서비스(`pipeline`·`cache`·`ondevice`)는 `i18n`·`ui` 를 모른다 — 코드만 낸다(3-2).
   - 자동 재시도는 5xx 1회뿐 — 재시도 상수가 1 이고, 그 밖의 재시도 장치(setInterval 등)가 없다.
   - 무료 티어 한도 숫자를 적지 않는다(15절) — 상한은 사용자의 `ai.dailyCap` 이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PIPELINE, AI } from '../js/config.js';
import { emptyUsageRow, bumpUsage } from '../js/ai/provider.js';

const NEW = ['ai/prompts.js', 'ai/jsonrepair.js', 'ai/cache.js', 'ai/pipeline.js', 'ai/ondevice.js'];
const src = (rel) => readFileSync(new URL('../js/' + rel, import.meta.url), 'utf8');
const code = (rel) => src(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('L1 새 ai/* 파일은 console 을 부르지 않는다 (주석 제외 코드 기준)', () => {
  for (const rel of NEW) {
    assert.ok(code(rel).length > 300, rel + ' 을 실제로 읽었다');
    assert.ok(!/console\s*\./.test(code(rel)), rel);
  }
});

test('L2 서비스는 i18n·ui 를 import 하지 않는다 — 문구는 UI 몫(3-2)', () => {
  for (const rel of NEW) {
    const imports = src(rel).match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
    for (const im of imports) assert.ok(!/\/(i18n|ui)\//.test(im), rel + ': ' + im);
  }
});

test('L3 ★ 자동 재시도는 5xx 에 대해 1회만 — 상수와 코드', () => {
  assert.equal(PIPELINE.SERVER_RETRIES, 1);
  assert.equal(PIPELINE.TIMEOUT_MS, 30000);
  assert.deepEqual([...PIPELINE.COOLDOWN_STEPS_MS], [30000, 60000, 120000]);
  const c = code('ai/pipeline.js');
  assert.ok(!/setInterval/.test(c), '주기적으로 다시 보내는 장치가 없다');
  // 요청을 다시 보내는 루프는 sendChunk 의 for 하나이고, 그 안에서 되돌아가는 곳은 5xx 한 곳이다.
  const send = c.slice(c.indexOf('async function sendChunk('), c.indexOf('async function accept('));
  assert.ok(send.length > 500);
  assert.equal((send.match(/continue;/g) || []).length, 1, '루프를 다시 도는 곳은 5xx 재시도 한 곳');
  assert.equal((send.match(/provider\.complete\(/g) || []).length, 1);
  assert.match(c, /case CODES\.SERVER:\s*\n\s*if \(attempt < PIPELINE\.SERVER_RETRIES\)/);
});

test('L4 무료 티어 한도 숫자가 없다 — 상한은 ai.dailyCap 에서 온다', () => {
  for (const rel of ['ai/pipeline.js', 'ai/cache.js']) {
    const c = code(rel);
    assert.ok(!/\b(1500|1000|250|15|10)\s*(RPD|RPM|requests)/i.test(c), rel);
    assert.ok(!/free.?tier/i.test(c), rel);
  }
  assert.match(code('ai/pipeline.js'), /getSetting\('ai\.dailyCap'\)/);
});

test('L5 usage 행 — charsTranslated 가 생기고, readalong 은 처음 쓰일 때 byKind 에 생긴다', async () => {
  const row = emptyUsageRow('2026-10-10');
  assert.equal(row.charsTranslated, 0);
  assert.equal(AI.READALONG_KIND, 'readalong');
  const rows = new Map();
  const db = { get: async (s, k) => rows.get(k), put: async (s, v) => { rows.set(v.day, v); } };
  await bumpUsage({ calls: 1, kind: 'readalong', charsTranslated: 5900 }, { db, now: new Date(2026, 9, 10) });
  await bumpUsage({ calls: 1, kind: 'readalong', charsTranslated: 600 }, { db, now: new Date(2026, 9, 10) });
  await bumpUsage({ calls: 1, kind: 'not-a-kind' }, { db, now: new Date(2026, 9, 10) });
  const r = rows.get('2026-10-10');
  assert.equal(r.byKind.readalong, 2);
  assert.equal(r.charsTranslated, 6500);
  assert.equal(r.byKind['not-a-kind'], undefined, '모르는 종류는 여전히 만들지 않는다');
  assert.equal(r.calls, 3);
});
