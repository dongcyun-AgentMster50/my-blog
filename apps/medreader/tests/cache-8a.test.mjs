/* ============================================================
   tests/cache-8a.test.mjs — spec 7-5 캐시 키 · 상한 · 문서 삭제 · 16-D2

   IndexedDB 대신 `tests/fixtures/ai-stubs-8a.mjs` 의 메모리 DB 를 주입한다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createCache, keyFor, cacheKindOf, sizeOf, TRANSLATE_KIND } from '../js/ai/cache.js';
import { cacheKey } from '../js/hash.js';
import { buildUnits, sentencesOf } from '../js/tts/text.js';
import { memDb } from './fixtures/ai-stubs-8a.mjs';

const para = (id, text) => ({ id: id, kind: 'body', lines: [{ id: id + ':1', text: text, hyphen: 'none' }] });

test('K1 ★ 같은 Unit.src 는 탭 경로·낭독 경로에서 같은 키 (kind 는 translate 로 모인다)', async () => {
  const units = buildUnits([para('p1', 'Fever was noted in 3 of 10 cases. It resolved.')], 'sentence');
  const s = sentencesOf(units)[0];
  const tap = await keyFor('doc1', units[0].src, 'ar', 'translate');
  const readalong = await keyFor('doc1', s.src, 'ar', 'readalong');
  assert.equal(tap, readalong);
  assert.equal(cacheKindOf('readalong'), TRANSLATE_KIND);
  assert.equal(cacheKindOf('summarize'), 'summarize');
  // 7-5 의 모양 그대로 — hash.js 의 cacheKey 와 같다.
  assert.equal(tap, await cacheKey('doc1', units[0].src, 'ar', 'translate'));
  assert.match(tap, /^translate\|ar\|doc1\|(s256:[0-9a-f]{64}|fnv:[0-9a-f]{16}:\d+)$/);
  // 공백·NFKC 정규화가 같으면 같은 키
  assert.equal(await keyFor('doc1', '  Fever   was noted ', 'ar', 'translate'), await keyFor('doc1', 'Fever was noted', 'ar', 'translate'));
});

test('K2 키를 가르는 것 — 대상 언어·문서·종류. 가르지 않는 것 — 원문 언어·provider·model·promptVersion', async () => {
  const a = await keyFor('doc1', 'Same sentence.', 'ar', 'translate');
  assert.notEqual(a, await keyFor('doc1', 'Same sentence.', 'ko', 'translate'));
  assert.notEqual(a, await keyFor('doc2', 'Same sentence.', 'ar', 'translate'));
  assert.notEqual(a, await keyFor('doc1', 'Same sentence.', 'ar', 'summarize'));
  // keyFor 에는 provider·model·원문 언어 자리가 아예 없다(7-5).
  assert.equal(keyFor.length, 5);
  const c = createCache({ db: memDb(), now: () => 1000 });
  await c.putMany([{ key: a, docId: 'doc1', kind: 'readalong', targetLang: 'ar', result: 'ترجمة', provider: 'gemini', model: 'm1', promptVersion: 1 }]);
  const got = (await c.getMany([a])).get(a);
  assert.equal(got.result, 'ترجمة');
  assert.equal(got.provider, 'gemini');
  assert.equal(got.model, 'm1');
  assert.equal(got.promptVersion, 1);
  assert.equal(got.kind, 'translate');
  assert.equal(got.createdAt, 1000);
  assert.ok(got.sizeBytes > 0);
  assert.ok(!a.includes('gemini') && !a.includes('m1'));
});

test('K3 getMany — 없는 키는 결과에 없다 · 중복 키는 한 번만 읽는다', async () => {
  const db = memDb();
  let gets = 0;
  const spy = Object.assign({}, db, { get: async (s, k) => { gets++; return db.get(s, k); } });
  const c = createCache({ db: spy });
  await c.putMany([{ key: 'k1', docId: 'd', kind: 'translate', targetLang: 'ar', result: 'x' }]);
  gets = 0;
  const m = await c.getMany(['k1', 'k1', 'k2']);
  assert.deepEqual([...m.keys()], ['k1']);
  assert.equal(gets, 2);
});

test('K4 ★ 상한을 넘으면 createdAt 오래된 순으로 정리한다 (상한의 90% 까지)', async () => {
  const db = memDb();
  let t = 0;
  const one = sizeOf({ key: 'kXX', kind: 'translate', docId: 'd', targetLang: 'ar', result: 'r'.repeat(100), provider: null, model: null, promptVersion: null, repaired: false, createdAt: 10, hits: 0, sizeBytes: 0 });
  const limit = one * 10 + 5;                       // 항목 10개쯤
  const c = createCache({ db: db, now: () => ++t, limitBytes: () => limit });
  for (let i = 0; i < 10; i++) {
    await c.putMany([{ key: 'k' + String(i).padStart(2, '0'), docId: 'd', kind: 'translate', targetLang: 'ar', result: 'r'.repeat(100) }]);
  }
  assert.equal(db.size('aiCache'), 10, '상한 안 — 아무것도 지우지 않는다');
  const r = await c.putMany([{ key: 'k10', docId: 'd', kind: 'translate', targetLang: 'ar', result: 'r'.repeat(100) }]);
  assert.ok(r.evicted >= 1);
  const left = [...db.stores.get('aiCache').keys()].sort();
  // 지워진 것은 가장 오래된 것들이다.
  assert.ok(!left.includes('k00'), '가장 오래된 k00 이 남았다');
  assert.ok(left.includes('k10'), '방금 넣은 것은 남는다');
  for (let i = 0; i < r.evicted; i++) assert.ok(!left.includes('k' + String(i).padStart(2, '0')));
  assert.ok(left.length * one <= Math.floor(limit * 0.9) + one, '90% 까지 줄였다');
});

test('K5 바깥에서 스토어가 줄어도(서재의 문서 삭제) 셈을 다시 맞춘다 — 헛정리하지 않는다', async () => {
  const db = memDb();
  let t = 0;
  let limit = 1e9;
  const c = createCache({ db: db, now: () => ++t, limitBytes: () => limit });
  for (let i = 0; i < 3; i++) await c.putMany([{ key: 'a' + i, docId: 'A', kind: 'translate', targetLang: 'ar', result: 'x'.repeat(300) }]);
  const one = c._total() / 3;
  limit = Math.floor(one * 1.5);      // 옛 셈(4개)으로는 넘고, 실제(1개)로는 안 넘는다
  // db.deleteDocument 처럼 캐시를 거치지 않고 지운다.
  for (const k of [...db.stores.get('aiCache').keys()]) await db.del('aiCache', k);
  const before = c._total();
  assert.ok(before > 0, '캐시는 아직 옛 크기를 안다');
  const r = await c.putMany([{ key: 'b0', docId: 'B', kind: 'translate', targetLang: 'ar', result: 'x'.repeat(300) }]);
  assert.equal(db.size('aiCache'), 1);
  assert.equal(r.evicted, 0, '옛 셈을 믿었으면 방금 넣은 b0 까지 지웠다');
  assert.ok(Math.abs(c._total() - one) < 2, '셈이 실제 크기로 돌아왔다');
});

test('K6 ★ 문서 삭제 시 그 docId 항목만 전부 지운다 (cache.deleteDoc · db.deleteDocument 둘 다)', async () => {
  const db = memDb();
  const c = createCache({ db: db });
  await c.putMany([
    { key: 'x1', docId: 'X', kind: 'translate', targetLang: 'ar', result: '1' },
    { key: 'x2', docId: 'X', kind: 'translate', targetLang: 'ko', result: '2' },
    { key: 'y1', docId: 'Y', kind: 'translate', targetLang: 'ar', result: '3' }
  ]);
  assert.equal(await c.deleteDoc('X'), 2);
  assert.deepEqual([...db.stores.get('aiCache').keys()], ['y1']);
  // 서재의 문서 삭제(`db.deleteDocument`)는 aiCache 를 docId 인덱스로 함께 쓸어 낸다.
  const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
  const cascade = src.slice(src.indexOf('const CASCADE_STORES'), src.indexOf(']);', src.indexOf('const CASCADE_STORES')));
  assert.match(cascade, /'aiCache'/);
  assert.match(src, /store\.indexNames\.contains\('docId'\) \? store\.index\('docId'\)/);
});

test('K7 같은 키를 다시 넣으면 덮어쓰고 크기 셈이 두 번 늘지 않는다 · stats', async () => {
  const db = memDb();
  const c = createCache({ db: db });
  await c.putMany([{ key: 'k', docId: 'd', kind: 'translate', targetLang: 'ar', result: 'a' }]);
  const t1 = c._total();
  await c.putMany([{ key: 'k', docId: 'd', kind: 'translate', targetLang: 'ar', result: 'a' }]);
  assert.equal(c._total(), t1);
  const s = await c.stats();
  assert.equal(s.count, 1);
  assert.equal(s.bytes, t1);
});

test('K8 [Review 8a] 정리 순서는 createdAt 이다 — 넣은 순서·키 순서와 달라도 (인덱스를 빼면 빨강)', async () => {
  const db = memDb();
  const clock = { t: 0 };
  const one = sizeOf({ key: 'kXX', kind: 'translate', docId: 'd', targetLang: 'ar', result: 'r'.repeat(100), provider: null, model: null, promptVersion: null, repaired: false, createdAt: 100, hits: 0, sizeBytes: 0 });
  const c = createCache({ db: db, now: () => clock.t, limitBytes: () => one * 3 + 5 });
  // 넣는 순서: a(가장 새것) → b → c(가장 오래된 것). 메모리 DB 의 삽입 순서와 createdAt 순서가 반대다.
  for (const [k, t] of [['a', 300], ['b', 200], ['c', 100]]) {
    clock.t = t;
    await c.putMany([{ key: k, docId: 'd', kind: 'translate', targetLang: 'ar', result: 'r'.repeat(100) }]);
  }
  clock.t = 400;
  const r = await c.putMany([{ key: 'z', docId: 'd', kind: 'translate', targetLang: 'ar', result: 'r'.repeat(100) }]);
  assert.ok(r.evicted >= 1);
  const left = [...db.stores.get('aiCache').keys()];
  assert.ok(!left.includes('c'), 'createdAt 가 가장 이른 c 가 먼저 지워진다: 남은 것 ' + left.join(','));
  assert.ok(left.includes('a') && left.includes('z'), '가장 새것들은 남는다: ' + left.join(','));
});
