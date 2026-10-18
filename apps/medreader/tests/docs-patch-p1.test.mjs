/* ============================================================
   tests/docs-patch-p1.test.mjs — 공개 전 묶음 P1 ① documents 갱신 경합

   review.md 7c8-5 의 재현을 **그대로** 테스트로 옮겼다:
   `documents` 를 범위에 둔 **읽기 전용** 트랜잭션의 `oncomplete` 를 늦춘다
   (`fixtures/fake-idb.mjs` 의 `delayReadonlyComplete`). 그러면 `db.get()` 이 늦게
   끝나고, 그사이 다른 곳이 같은 레코드의 **다른 필드**를 쓴다. 통째 쓰기(get → put)는
   옛 레코드로 그것을 되돌린다 — 고치기 전 빨강.

   다섯 곳(+7c 원문 언어)이 각각 **자기 필드만** 쓰는지 본다. 방법은 하나다:
   레코드의 모든 필드에 표지를 박고, 그 곳이 쓰는 동안 끼어든 쓰기가 **그 곳 몫이
   아닌 필드 전부**를 바꾼다. 끝나면 남의 필드는 끼어든 값, 자기 필드는 자기 값이어야 한다.

   | 곳 | 자기 필드 |
   |---|---|
   | `Extractor._saveMeta` | `extraction` |
   | `reader.writeLastPage`(saveLastPage) | `lastPage`·`lastLineId` |
   | `quiz.saveSectionIndex`(색인 저장) | `sectionIndex` |
   | `quiz.markSectionIndexDone` | `sectionIndexDone`·`sectionIndexVersion` |
   | `library.touchOnOpen`(openDoc) | `pageCount`·`lastOpenedAt` |
   | `library.touchDuplicate`(가져오기 중복) | `pageCount`(비었을 때만)·`lastOpenedAt` |
   | 7c `updateDocLang` | `lang`·`langSource`·`langGuess` |
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const { Extractor } = await import('../js/pdf/extract.js');
const { writeLastPage } = await import('../js/ui/reader.js');
const { saveSectionIndex, markSectionIndexDone } = await import('../js/ui/quiz.js');
const { touchOnOpen, touchDuplicate } = await import('../js/ui/library.js');

const DELAY = 150;          // 7c8-5 는 3초였다. 원리는 같고 테스트가 빨라야 한다.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 모든 필드에 표지를 박은 문서. */
function seedDoc(id) {
  return {
    id: id,
    title: 'T', fileName: 'f.pdf', size: 1, fileHash: 'h-' + id,
    pageCount: 0, addedAt: 1, lastOpenedAt: 1,
    lastPage: 1, lastLineId: 'p1-l0',
    lang: 'fr', langSource: 'user', langGuess: null,
    readStats: { pages: 0, chars: 0 },
    extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 },
    sectionIndex: [], sectionIndexDone: false, sectionIndexVersion: 0
  };
}

const ALL = Object.keys(seedDoc('x'));

/** 끼어드는 쓰기가 남의 필드에 넣는 값. 필드마다 다르고 원래 값과도 다르다. */
function intruderValue(f) { return { intruder: f }; }

/** 날것의 readwrite 트랜잭션 하나 — 시험 대상 도우미를 쓰지 않는다. */
function rawPatch(id, fields) {
  return db.withTx('documents', 'readwrite', (tx, s) => new Promise((resolve, reject) => {
    const r = s.documents.get(id);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const cur = r.result;
      for (const f of fields) cur[f] = intruderValue(f);
      const w = s.documents.put(cur);
      w.onsuccess = () => resolve();
      w.onerror = () => reject(w.error);
    };
  }));
}

async function fresh(id) {
  idb.delayReadonlyComplete('documents', 0);
  await db.put('documents', seedDoc(id));
}

/**
 * ★ 재현 각본. `run()` 이 시작되고 `gapMs` 뒤에 남의 필드를 전부 바꾸는 쓰기가 끼어든다.
 * `run()` 은 지연된 읽기 트랜잭션을 만나면 그 쓰기보다 **늦게** 끝난다.
 */
async function scenario(id, own, run) {
  await fresh(id);
  idb.delayReadonlyComplete('documents', DELAY);
  const p = run();
  await sleep(30);
  const others = ALL.filter((f) => f !== 'id' && own.indexOf(f) < 0);
  await rawPatch(id, others);
  await p;
  idb.delayReadonlyComplete('documents', 0);
  const rec = idb.peek('medreader', 'documents', id);
  for (const f of others) {
    assert.deepEqual(rec[f], intruderValue(f), '남의 필드 ' + f + ' 를 옛 값으로 덮었다');
  }
  return rec;
}

/* ── 흉내 자체 ──────────────────────────────────────── */

test('DP0 흉내가 공짜로 통과시키지 않는다 — 끝난 트랜잭션에 요청을 걸면 던진다', async () => {
  await fresh('d0');
  let late = null;
  await db.withTx('documents', 'readwrite', (tx, s) => { late = s.documents; });
  assert.throws(() => late.get('d0'), /TransactionInactiveError/);
});

test('DP1 ★ 7c8-5 재현 — get→put 두 트랜잭션은 끼어든 사용자 선택을 덮는다 (도우미가 없으면 이렇게 된다)', async () => {
  // 고치기 전 코드의 꼴을 그대로 적었다. 이 단언은 "재현 장치가 실제로 경합을 만든다"를 고정한다 —
  // 장치가 헛돌면 아래 DP2~ 의 초록이 아무 뜻도 없다.
  await fresh('d1');
  idb.delayReadonlyComplete('documents', DELAY);
  const old = (async () => {
    const doc = await db.get('documents', 'd1');
    doc.lastPage = 5;
    await db.put('documents', doc);
  })();
  await sleep(30);
  await rawPatch('d1', ['lang']);
  await old;
  idb.delayReadonlyComplete('documents', 0);
  const rec = idb.peek('medreader', 'documents', 'd1');
  assert.equal(rec.lastPage, 5);
  assert.equal(rec.lang, 'fr', '옛 통째 쓰기는 끼어든 언어를 되돌린다(재현)');
});

/* ── 도우미 ─────────────────────────────────────────── */

test('DP2 ★ db.patch — 지연이 있어도 자기 필드만 쓰고 남의 필드를 지킨다', async () => {
  const rec = await scenario('d2', ['lastPage'], () => db.patch('documents', 'd2', { lastPage: 9 }));
  assert.equal(rec.lastPage, 9);
});

test('DP3 db.patch — 함수는 트랜잭션 안의 현재 레코드를 받는다 · null 이면 쓰지 않는다 · 없는 문서는 되살리지 않는다', async () => {
  await fresh('d3');
  let seen = null;
  const a = await db.patch('documents', 'd3', (cur) => { seen = cur.lang; return null; });
  assert.equal(seen, 'fr');
  assert.equal(a.wrote, false);
  assert.equal(a.rec.id, 'd3');
  const b = await db.patch('documents', 'd3', {});
  assert.equal(b.wrote, false, '빈 객체는 쓰지 않는다');
  const c = await db.patch('documents', 'nope', { lastPage: 3 });
  assert.deepEqual(c, { wrote: false, rec: null });
  assert.equal(idb.peek('medreader', 'documents', 'nope'), undefined, '지워진 문서를 되살리지 않는다');
  const d = await db.patch('documents', 'd3', (cur) => ({ lastPage: cur.lastPage + 1 }));
  assert.equal(d.wrote, true);
  assert.equal(d.rec.lastPage, 2);
  assert.equal(d.rec.lang, 'fr', '돌려준 레코드는 합친 전체다');
});

test('DP4 db.patch — 함수가 던지면 트랜잭션을 되돌리고 던진다', async () => {
  await fresh('d4');
  await assert.rejects(db.patch('documents', 'd4', () => { throw new Error('boom'); }), /boom/);
  assert.equal(idb.peek('medreader', 'documents', 'd4').lastPage, 1);
});

/* ── 다섯 곳 ────────────────────────────────────────── */

test('DP5 ★ extract._saveMeta — extraction 만 쓴다', async () => {
  const ex = new Extractor({ docId: 'e1', pdfDoc: null, pageCount: 10 });
  ex.ex = { done: false, pagesDone: 4, cursor: 5, failed: [3], roleDirty: [], status: 'running' };
  const rec = await scenario('e1', ['extraction'], () => ex._saveMeta(true));
  assert.equal(rec.extraction.cursor, 5);
  assert.deepEqual(rec.extraction.failed, [3]);
  assert.equal(rec.extraction.pagesDone, 4);
  // E28 이 소스로 보던 키 집합을 실제로 쓰인 레코드에서 다시 본다(9-2·9-4).
  for (const k of ['done', 'pagesDone', 'cursor', 'failed', 'algoVersion', 'derivedHash', 'roleDirty', 'status']) {
    assert.ok(k in rec.extraction, 'extraction.' + k + ' 가 없다');
  }
});

test('DP6 ★ reader.saveLastPage(writeLastPage) — lastPage·lastLineId 만 쓴다, 같으면 쓰지 않는다', async () => {
  const rec = await scenario('r1', ['lastPage', 'lastLineId'], () => writeLastPage('r1', 7, 'p7-l3'));
  assert.equal(rec.lastPage, 7);
  assert.equal(rec.lastLineId, 'p7-l3');
  const again = await writeLastPage('r1', 7, 'p7-l3');
  assert.equal(again.wrote, false, '같은 위치면 쓰지 않는다');
});

test('DP7 ★ quiz 색인 저장 — sectionIndex 만 쓴다', async () => {
  const idx = [{ sectionId: 's1', title: 'A', startPage: 1, endPage: 3, questions: 2, verified: true }];
  const rec = await scenario('q1', ['sectionIndex'], () => saveSectionIndex('q1', idx));
  assert.deepEqual(rec.sectionIndex, idx);
});

test('DP8 ★ quiz 색인 완료 표시 — sectionIndexDone·sectionIndexVersion 만 쓴다', async () => {
  const rec = await scenario('q2', ['sectionIndexDone', 'sectionIndexVersion'], () => markSectionIndexDone('q2', 7));
  assert.equal(rec.sectionIndexDone, true);
  assert.equal(rec.sectionIndexVersion, 7);
});

test('DP9 ★ library.openDoc(touchOnOpen) — pageCount·lastOpenedAt 만 쓴다', async () => {
  const rec = await scenario('l1', ['pageCount', 'lastOpenedAt'], () => touchOnOpen('l1', 729, 5000));
  assert.equal(rec.pageCount, 729);
  assert.equal(rec.lastOpenedAt, 5000);
});

test('DP10 ★ library 가져오기 중복 경로(touchDuplicate) — pageCount(비었을 때)·lastOpenedAt 만 쓴다', async () => {
  // `found` 는 findByFileHash 가 미리 읽어 둔 레코드 자리다 — 그사이 바뀐 것을 모른다.
  const rec = await scenario('l2', ['pageCount', 'lastOpenedAt'], () => touchDuplicate(seedDoc('l2'), 312, 6000));
  assert.equal(rec.lastOpenedAt, 6000);
  assert.equal(rec.pageCount, 312, '처음 열어 본 레코드(쪽수 0)면 쪽수를 채운다');
  await fresh('l3');
  await db.patch('documents', 'l3', { pageCount: 100 });
  const kept = await touchDuplicate(idb.peek('medreader', 'documents', 'l3'), 312, 7000);
  assert.equal(kept.pageCount, 100, '이미 쪽수가 있으면 건드리지 않는다');
  const noPc = await touchDuplicate(idb.peek('medreader', 'documents', 'l3'), null, 8000);
  assert.equal(noPc.pageCount, 100);
  assert.equal(noPc.lastOpenedAt, 8000);
});

test('DP11 library.openDoc 은 그사이 지워진 문서를 되살리지 않는다', async () => {
  const r = await touchOnOpen('gone', 10, 1);
  assert.equal(r.rec, null);
  assert.equal(idb.peek('medreader', 'documents', 'gone'), undefined);
});

/* ── 배선 — 다섯 곳에 통째 쓰기가 남지 않았다 ───────── */

function codeOf(rel) {
  return readFileSync(new URL('../js/' + rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('DP12 ★ 배선 — 다섯 곳과 7c 원문 언어가 같은 도우미를 쓴다 · documents 통째 쓰기는 새 문서 만들기 한 곳뿐', () => {
  const extract = codeOf('pdf/extract.js');
  const reader = codeOf('ui/reader.js');
  const quiz = codeOf('ui/quiz.js');
  const library = codeOf('ui/library.js');
  for (const [name, code] of [['extract', extract], ['reader', reader], ['quiz', quiz]]) {
    assert.equal(/put\(\s*'documents'/.test(code), false, name + ' 에 documents 통째 쓰기가 남았다');
  }
  assert.match(extract, /_saveMeta[\s\S]*?db\.patch\(\s*'documents'/);
  assert.match(reader, /async function saveLastPage[\s\S]*?writeLastPage\(/);
  assert.match(quiz, /saveIndex:\s*function \(entries\) \{ return saveSectionIndex\(/);
  assert.match(quiz, /await markSectionIndexDone\(docId, parserVersion\)/);
  assert.match(library, /export async function openDoc[\s\S]*?touchOnOpen\(docId, pdfDoc\.numPages\)/);
  assert.match(library, /function updateDocLang[\s\S]*?db\.patch\(\s*'documents'/);
  // library 의 통째 쓰기: 새 문서 만들기 1 + touchDuplicate 의 "그사이 사라짐" 되살리기 1.
  const puts = library.match(/put\(\s*'documents'/g) || [];
  assert.equal(puts.length, 2, 'library.js documents put 은 새 문서·사라진 중복 되살리기 두 곳뿐');
  assert.equal(/withTx\(\s*'documents'/.test(library), false, 'updateDocLang 의 손짜기 트랜잭션은 도우미로 바뀌었다');
});

test('DP13 DB_VERSION 은 P1 이 바꾸지 않았다 — 이후 올림은 8g-1(3, searchText)뿐', () => {
  // P1 은 스키마를 건드리지 않았다(2). [2026-10-18] 8g-1 이 3 으로 올렸다(spec 17-8-12 U1) — 내리지 않는다.
  assert.equal(db.DB_VERSION, 3);
});
