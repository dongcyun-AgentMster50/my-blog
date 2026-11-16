/* ============================================================
   tests/needpdf-9c3.test.mjs — 9c-3 "PDF 필요" (spec 17-4-1 6 · 결정 9c-D9 · "9c-3 수용 기준")

   백업에서 온 문서는 `blobs` 가 없다(17-4-1 2). 그 문서를
   N1  고른 파일이 그 문서의 PDF 인가 — `identityFor` 와 같은 판단(해시 그대로 · 쪽수 변형 키 · 쪽수 · 쪽수 모름 0)
   N2  ★ 서재 [가져오기] 재사용 경로 — 원본이 없으면 그 자리에서 넣는다(한 트랜잭션 · 이미 있으면 그대로 · 문서가 없으면 넣지 않음)
   N3  ★ 카드 [PDF 가져오기] — 원본을 넣고 자기 필드만(`lastOpenedAt`, 모르던 쪽수) · 진도·원문 언어 그대로 · 지워진 문서는 되살리지 않음
   N4  hasPdf — 키 개수만(Blob 을 올리지 않음)
   N5  배선(소스) — 재사용 두 갈래 모두 ensureBlob · 리더·검색·퀴즈 입구가 hasPdf → goNeedPdf · 카드에 [계속] 없음 · innerHTML 0 · i18n 4언어
   지어낸 글자·지어낸 Blob 만. 실제 PDF·호출 없음(화면 동작은 headless — 보고서).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const L = await import('../js/ui/library.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const H = 's256:p:5000:aaaabbbbccccdddd';
const T0 = new Date(2026, 10, 17, 9, 0, 0).getTime();

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}

function docRec(over) {
  return Object.assign({
    id: 'doc1', title: 'Syn', fileName: 'syn.pdf', size: 5000, pageCount: 5, fileHash: H, addedAt: T0, lastOpenedAt: T0,
    lastPage: 3, lastLineId: '3:1', lang: 'fr', langSource: 'user', langGuess: null,
    extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 }
  }, over || {});
}

/* ══ N1 ═══════════════════════════════════════════════════ */
test('N1 고른 파일이 그 문서의 PDF 인가 — 해시·쪽수(identityFor 와 같은 판단)', () => {
  assert.equal(L.needPdfMatch(docRec(), H, 5), true, '같은 해시·같은 쪽수');
  assert.equal(L.needPdfMatch(docRec(), H, 6), false, '같은 해시·다른 쪽수(표본 해시 충돌) — 다른 파일');
  assert.equal(L.needPdfMatch(docRec(), 's256:p:5000:zzzz', 5), false, '다른 해시');
  assert.equal(L.needPdfMatch(docRec({ pageCount: 0 }), H, 9), true, '쪽수를 모르는 레코드(0)는 채워 쓴다(adopt)');
  // 변형 키 문서(기기에서 같은 해시를 다른 PDF 가 먼저 차지했다) — 그 쪽수의 PDF 만
  const v = docRec({ fileHash: L.variantIdentity(H, 7), pageCount: 7 });
  assert.equal(L.needPdfMatch(v, H, 7), true);
  assert.equal(L.needPdfMatch(v, H, 5), false);
  assert.equal(L.needPdfMatch(docRec({ fileHash: L.variantIdentity(H, 7), pageCount: 0 }), H, 8), false, '변형 키의 쪽수와 다르면 아니다');
  // pdf.js 를 열기 전 거르기
  assert.equal(L.hashMayMatch(H, H), true);
  assert.equal(L.hashMayMatch(H + ':n12', H), true);
  assert.equal(L.hashMayMatch(H + ':n12x', H), false);
  assert.equal(L.hashMayMatch(H + 'x', H), false);
  assert.equal(L.hashMayMatch('', H), false);
  assert.equal(L.hashMayMatch(H, ''), false);
  assert.equal(L.needPdfMatch(null, H, 5), false);
});

/* ══ N2 ═══════════════════════════════════════════════════ */
test('N2 ★ 재사용 경로 — 원본이 없으면 넣고, 있으면 그대로, 문서가 없으면 넣지 않는다(한 트랜잭션)', async () => {
  await reset();
  await db.put('documents', docRec());
  const pdf = new Blob([new Uint8Array(64)], { type: 'application/pdf' });
  assert.equal(await L.ensureBlob('doc1', pdf), true, '없던 원본을 넣는다');
  assert.equal((await db.get('blobs', 'doc1')).blob.size, 64);
  const other = new Blob([new Uint8Array(8)]);
  assert.equal(await L.ensureBlob('doc1', other), false, '이미 있으면 그대로');
  assert.equal((await db.get('blobs', 'doc1')).blob.size, 64, '기존 원본을 바꾸지 않는다');
  assert.equal(await L.ensureBlob('gone', pdf), false, '문서가 없다');
  assert.equal(await db.get('blobs', 'gone'), undefined, '문서 없는 원본을 남기지 않는다');
  // 두 번 함께 불러도 하나(같은 트랜잭션 안에서 세고 쓴다)
  await reset();
  await db.put('documents', docRec());
  const both = await Promise.all([L.ensureBlob('doc1', pdf), L.ensureBlob('doc1', other)]);
  assert.deepEqual(both, [true, false]);
  assert.equal(Number(await db.count('blobs')), 1);
  assert.equal((await db.get('documents', 'doc1')).lastPage, 3, '문서는 건드리지 않는다');
});

/* ══ N3 ═══════════════════════════════════════════════════ */
test('N3 ★ 카드 [PDF 가져오기] — 원본 + 자기 필드만 · 진도·원문 언어 그대로 · 지워진 문서는 되살리지 않음', async () => {
  await reset();
  await db.put('documents', docRec({ pageCount: 0 }));
  const pdf = new Blob([new Uint8Array(32)], { type: 'application/pdf' });
  const rec = await L.attachBlobFor('doc1', pdf, 5, undefined, T0 + 1000);
  assert.equal(rec.lastOpenedAt, T0 + 1000);
  assert.equal(rec.pageCount, 5, '몰랐던 쪽수를 채운다');
  const back = await db.get('documents', 'doc1');
  assert.deepEqual([back.lastPage, back.lastLineId, back.lang, back.langSource], [3, '3:1', 'fr', 'user'], '진도·원문 언어 그대로');
  assert.equal((await db.get('blobs', 'doc1')).blob.size, 32);
  // 쪽수를 알던 문서는 쪽수를 바꾸지 않는다
  await reset();
  await db.put('documents', docRec());
  assert.equal((await L.attachBlobFor('doc1', pdf, 5, undefined, T0 + 5)).pageCount, 5);
  // 지워졌으면 아무것도 쓰지 않는다
  assert.equal(await L.attachBlobFor('nope', pdf, 5), null);
  assert.equal(await db.get('documents', 'nope'), undefined);
  assert.equal(await db.get('blobs', 'nope'), undefined);
});

/* ══ N4 ═══════════════════════════════════════════════════ */
test('N4 hasPdf — 원본 키가 있으면 true · 없으면 false', async () => {
  await reset();
  await db.put('documents', docRec());
  assert.equal(await L.hasPdf('doc1'), false);
  await db.put('blobs', { docId: 'doc1', blob: new Blob([new Uint8Array(4)]) });
  assert.equal(await L.hasPdf('doc1'), true);
  assert.equal(await L.hasPdf('other'), false);
  // 못 읽으면 막지 않는다(true)
  assert.equal(await L.hasPdf('x', { count: () => Promise.reject(new Error('boom')) }), true);
});

/* ══ N5 배선(소스) ════════════════════════════════════════ */
test('N5 배선 — 재사용 두 갈래 ensureBlob · 리더·검색·퀴즈 입구 · 카드에 [계속] 없음 · innerHTML 0 · i18n 4언어', () => {
  const lib = src('../js/ui/library.js');
  // 서재 [가져오기] — `touchDuplicate` 뒤 두 갈래(같은 해시 · 변형 키) 모두 원본을 확인한다
  const imp = lib.slice(lib.indexOf('async function importFile('), lib.indexOf('function newDocument('));
  assert.equal((imp.match(/await touchDuplicate\(/g) || []).length, 2);
  assert.equal((imp.match(/await ensureBlob\(doc\.id, file\)/g) || []).length, 2, '재사용 두 갈래 모두 원본 확인');
  // "PDF 필요" 카드 — [PDF 가져오기]·[삭제]·[⋯], [계속] 없음
  const card = lib.slice(lib.indexOf('function needPdfCard('), lib.indexOf('function paintNeedMsg('));
  assert.ok(card.includes("'need-pdf'"));
  assert.ok(!card.includes("'continue'"), '[계속] 없음');
  assert.ok(card.includes("'library.needPdf'") && card.includes("'library.needPdf.import'") && card.includes("'library.needPdf.hint'"));
  assert.ok(!/innerHTML/.test(lib));
  // 맞지 않으면 문서를 건드리지 않는다 — 판정(needPdfMatch) 앞에는 쓰기가 없다
  const att = lib.slice(lib.indexOf('async function attachNeedPdf('), lib.indexOf('/* ──', lib.indexOf('async function attachNeedPdf(')));
  assert.ok(att.indexOf('needPdfMatch(') > 0 && att.indexOf('needPdfMatch(') < att.indexOf('attachBlobFor('));
  assert.ok(att.indexOf('hashMayMatch(') > 0 && att.indexOf('hashMayMatch(') < att.indexOf('openDocument('), '해시가 다르면 pdf.js 를 열지 않는다');
  // 리더·검색·퀴즈 — 원본이 없으면 서재 그 카드로
  for (const f of ['../js/ui/reader.js', '../js/ui/search.js', '../js/ui/quiz.js']) {
    const s = src(f);
    assert.match(s, /import \{[^}]*hasPdf, goNeedPdf[^}]*\} from '\.\/library\.js'/, f);
    assert.match(s, /!\(await hasPdf\(docId\)\)\) \{[^\n]*goNeedPdf\(docId, \{ fromHash: from \}\)/, f + ' 입구');
  }
  assert.match(src('../js/ui/search.js'), /hasPdf\(id\)\.then\(\(ok\) => \(ok \? openDoc\(id\) : goNeedPdf\(id, \{ push: true \}\)\)\)/, '검색 [이어서 준비]');
  // `[9c-3b — 9c3R #3]` 주소로 온 것은 히스토리를 바꿔 쓴다(뒤로 가기가 같은 곳으로 다시 튕기지 않게)
  const gnp = lib.slice(lib.indexOf('export function goNeedPdf('), lib.indexOf('async function attachNeedPdf('));
  assert.match(gnp, /else replace\(libraryHash\(\)\);/, 'goNeedPdf — push 아니면 replace');
  // `[9c-3b — 9c3R #2]` 리더·퀴즈 입구는 들어온 주소를 첫 await 앞에서 잡는다(기다리는 사이 다른 화면으로 가면 끌지 않게)
  for (const [f, head] of [['../js/ui/reader.js', 'export async function showReader('], ['../js/ui/quiz.js', 'export async function showQuiz(']]) {
    const body = src(f).slice(src(f).indexOf(head));
    const at = body.indexOf('const from = location.hash;');
    assert.ok(at > 0 && at < body.indexOf('await '), f + ' — from 이 첫 await 앞');
  }
  // i18n — 4언어
  for (const k of ['library.needPdf', 'library.needPdf.hint', 'library.needPdf.import', 'library.needPdf.wrong', 'library.needPdf.opened', 'backup.import.quota']) {
    for (const lang of LANGS) assert.equal(typeof BUNDLES[lang][k], 'string', lang + ' ' + k);
  }
  assert.match(BUNDLES.ko['library.needPdf.wrong'], /\{button\}/);
  // db.js 는 고치지 않는다
  assert.equal(db.DB_VERSION, 3);
});
