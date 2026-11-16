/* ============================================================
   tests/search-vocab-8f4.test.mjs — 8f-4 아랍어 검색어 → 단어장 대응 (spec 17-8-9 (나) · 8cf-D13 (가))

   W1  비교 꼴 `vocabKeyOf` — 하라카트·타트윌·타마르부타·알리프 꼴·ى·앞뒤 공백·구두점 · 한 규칙(foldArabic → normalizeTerm)
   W2  `vocabSwap` — 같은 번역 → 그 원어 · 정규화된 검색어도 맞음 · 맞지 않으면 null · 원어 조건(검색 규칙·책 글자 체계·검색어와 다름)
   W3  여러 항목 — 이 책 언어 → 지금 대상 언어 항목 먼저, 그 안에서 `updatedAt` 최근 하나 · `others` = 다른 원어 수 · 입력 불변
   W4  켜지는 조건 `vocabDue` — 이 책 범위 · 끝남 · 0건 · 아랍 문자 · 책 글자 체계와 다름 · 바꾼 모형 아님 · 스캔 안내 아님
   W5  ★ 끝까지(흉내 IndexedDB · 앱 엔진 · 앱 단어장 저장소) — 아랍어 0건 → 단어장 → 원어로 적중 → 리더 강조 경로도 그 원어 위
   W6  ★ 사전이 먼저 — "장" 묶음이 있으면 단어장을 읽지 않는다(결과·안내 8g-7 그대로)
   W7  ★ 일치 없음 → `{none}` → 지금 안내(찾지 못했습니다 + 글자 체계 안내) 그대로 · 라틴·한글 검색어는 단어장을 읽지 않는다
   W8  ★ 호출 0 — 흉내 fetch 로 W5–W7 전 과정 요청 0 · 저장 레코드(cards·documents·searchText)·SEARCH.VERSION 불변
   W9  배선·i18n — 화면이 그리기마다 `kickVocab` · 바꾼 모형은 원어로 `run.doc` · "단어장에서 바꿈" 한 줄은 <bdi> · 키 1개 × 4
   W10 ★ [8f-4b] 바꾼 원어도 0건 → 원래 검색어 모형(`vocabFallback`) = HEAD 판 모형 · 17-8-7 안내(찾지 못함 + 글자 체계 안내·단추)
   W11 ★ [8f-4b] 낡은 결과 거르기(`vocabSettle`) — 그사이 검색어·책이 바뀌면 'drop' · 화면 떠남 'later' · 흐름 흉내
   W12 [8f-4b] 단어장을 보는 동안 미루는 것은 "찾지 못했습니다" 한 줄뿐(글자 체계 안내·[«الفهرس» 로] 는 바로) — 배선

   픽스처는 전부 **지어낸 글**이다(원서 문장 없음).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ★ 호출 0 — 모든 import 보다 먼저 흉내 fetch 를 건다(모듈이 불러도 센다)
const FETCHES = [];
globalThis.fetch = async (url) => { FETCHES.push(String(url)); throw new Error('network blocked in test'); };

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const db = await import('../js/db.js');
const engine = await import('../js/search/engine.js');
const ui = await import('../js/ui/search.js');
const { ALGO_VERSION } = await import('../js/pdf/extract.js');
const { SEARCH } = await import('../js/config.js');
const { fromStored, derivedHash } = await import('../js/text/store.js');
const { describePage, flowParasOf, joinPieces } = await import('../js/text/screen.js');
const { parseQuery, rangesFor } = await import('../js/text/search.js');
const { createVocabStore } = await import('../js/vocab/store.js');
const { BUNDLES } = await import('../js/i18n/index.js');
const { synthToc } = await import('./fixtures/latin-view-8g7.mjs');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 결과 모형(화면 `newModel` + 끝 결과) */
function finalModel(q, hits, extra) {
  const m = ui.newModel('doc', q);
  ui.applyEvent(m, { type: 'final', result: Object.assign({ hits: hits || [], pageCount: 3, pagesCovered: 3 }, extra || {}) });
  return m;
}
const E = (o) => Object.assign({ kind: 'term', srcLang: 'en', targetLang: 'ar', createdAt: 1, updatedAt: 1 }, o);

/* ══ W1 비교 꼴 ═══════════════════════════════════════════ */

test('W1 ★ vocabKeyOf — 하라카트·타트윌·ة→ه·أإآٱ→ا·ى→ي·앞뒤 공백·앞뒤 구두점·NFKC 가 접히고 낱말 안 공백은 하나', () => {
  const k = ui.vocabKeyOf;
  const base = k('الربو');
  assert.equal(base, 'الربو');
  assert.equal(k('الرَّبْو'), base, '하라카트');
  assert.equal(k('الربـــو'), base, '타트윌');
  assert.equal(k('  الربو \t'), base, '앞뒤 공백');
  assert.equal(k('«الربو»،'), base, '앞뒤 구두점');
  assert.equal(k('ذات الرئة'), k('ذات  الرئة'), '안 공백 하나');
  assert.equal(k('رئة'), k('رئه'), 'ة → ه');
  assert.equal(k('أنيميا'), k('انيميا'), 'أ → ا');
  assert.equal(k('إسهال'), k('اسهال'), 'إ → ا');
  assert.equal(k('آلام'), k('الام'), 'آ → ا');
  assert.equal(k('حمى'), k('حمي'), 'ى → ي');
  assert.equal(k('ﺍﻟﺮﺑﻮ'), base, '표현형(NFKC)');
  // 라틴 쪽도 같은 규칙(normalizeTerm — 소문자)
  assert.equal(k(' Asthma. '), 'asthma');
  assert.equal(k(''), '');
  assert.equal(k(null), '');
});

/* ══ W2 vocabSwap ══════════════════════════════════════════ */

const CTX = { docLang: 'en', target: 'ar' };

test('W2 ★ vocabSwap — 번역이 같은 항목의 원어(term) · 표시는 surface · 정규화된 검색어(하라카트·ة·공백)도 맞음 · 없으면 null', () => {
  const list = [E({ id: 'a', term: 'asthma', surface: 'Asthma', translation: 'الربو' }), E({ id: 'b', term: 'anemia', surface: 'anemia', translation: 'فقر الدم' })];
  assert.deepEqual(ui.vocabSwap('الربو', list, CTX), { term: 'asthma', surface: 'Asthma', id: 'a', others: 0 });
  assert.equal(ui.vocabSwap(' الرَّبـو ', list, CTX).term, 'asthma');
  assert.equal(ui.vocabSwap('فَقْر  الدّم', list, CTX).term, 'anemia');
  assert.equal(ui.vocabSwap('السكري', list, CTX), null);
  // 부분 일치는 아니다(같은 것만 — 17-8-9 나)
  assert.equal(ui.vocabSwap('فقر', list, CTX), null);
  assert.equal(ui.vocabSwap('الربو', [], CTX), null);
  assert.equal(ui.vocabSwap('', list, CTX), null);
});

test('W2 원어 조건 — 검색 규칙 밖(1자)·책과 다른 글자 체계(아랍어 원어)·검색어와 같은 원어·kind 가 term 아님 → 후보 아님', () => {
  const q = 'الربو';
  assert.equal(ui.vocabSwap(q, [E({ term: 'x', translation: q })], CTX), null, '1자');
  assert.equal(ui.vocabSwap(q, [E({ term: 'ربو', translation: q })], CTX), null, '아랍어 원어 — 영어 책에서 또 0건');
  assert.equal(ui.vocabSwap(q, [E({ term: 'الربو', translation: q })], CTX), null, '검색어 그대로');
  assert.equal(ui.vocabSwap(q, [Object.assign(E({ term: 'asthma', translation: q }), { kind: 'card' })], CTX), null, '문장 카드');
  assert.equal(ui.vocabSwap(q, [E({ term: '', translation: q })], CTX), null);
});

/* ══ W3 여러 항목 ══════════════════════════════════════════ */

test('W3 ★ 여러 항목 — 이 책 언어·지금 대상 언어 항목 먼저 · 그 안에서 updatedAt 최근 하나 · others = 다른 원어 수 · 입력 불변', () => {
  const q = 'الربو';
  const list = [
    E({ id: 'old', term: 'asthma', surface: 'asthma', translation: q, updatedAt: 10 }),
    E({ id: 'new', term: 'bronchial asthma', surface: 'Bronchial asthma', translation: 'الرَّبو', updatedAt: 30 }),
    E({ id: 'mid', term: 'reactive airway', surface: 'reactive airway', translation: q, updatedAt: 20 }),
    // 대상 언어가 다른 항목 — 더 최근이어도 지금 대상 언어(ar) 항목이 있으면 뒤
    E({ id: 'fr', term: 'wheeze', targetLang: 'fr', translation: q, updatedAt: 99 }),
    // 같은 원어 · 다른 대상 언어 → 원어 수는 하나로 센다
    E({ id: 'fr2', term: 'asthma', targetLang: 'fr', translation: q, updatedAt: 98 })
  ];
  const frozen = JSON.stringify(list);
  const r = ui.vocabSwap(q, list, CTX);
  assert.equal(r.id, 'new');
  assert.equal(r.term, 'bronchial asthma');
  assert.equal(r.surface, 'Bronchial asthma');
  assert.equal(r.others, 3, 'asthma · reactive airway · wheeze');
  assert.equal(JSON.stringify(list), frozen, '입력 불변');
  // 지금 대상 언어 항목이 없으면 전체에서(17-8-9 "없으면 전체")
  assert.equal(ui.vocabSwap(q, list, { docLang: 'en', target: 'ko' }).id, 'fr');
  // updatedAt 같으면 createdAt, 그다음 id
  const tie = [E({ id: 'a', term: 'aa', translation: q, updatedAt: 5, createdAt: 1 }), E({ id: 'b', term: 'bb', translation: q, updatedAt: 5, createdAt: 2 })];
  assert.equal(ui.vocabSwap(q, tie, CTX).id, 'b');
  // 이 책 언어와 다른 원문 언어(fr 원어) 항목은 뒤 — srcLang 빈 항목은 같은 편
  const src = [E({ id: 'fr-src', term: 'asthme', srcLang: 'fr', translation: q, updatedAt: 50 }), E({ id: 'blank', term: 'asthma', srcLang: '', translation: q, updatedAt: 1 })];
  assert.equal(ui.vocabSwap(q, src, CTX).id, 'blank');
});

/* ══ W4 vocabDue ═══════════════════════════════════════════ */

test('W4 ★ vocabDue — 이 책 범위 · 끝남 · 0건 · 아랍 문자 · 책 글자 체계와 다름 · 바꾼 모형 아님 · 검색어 오류·스캔 안내 아님', () => {
  const ok = { docLang: 'en' };
  assert.equal(ui.vocabDue(finalModel('الربو'), ok), true);
  assert.equal(ui.vocabDue(finalModel('الربو', [{ pageNo: 1, at: 0, len: 3, kind: 'body' }]), ok), false, '적중 있음');
  const partial = ui.newModel('doc', 'الربو');
  ui.applyEvent(partial, { type: 'partial', result: { hits: [] } });
  assert.equal(ui.vocabDue(partial, ok), false, '찾는 중');
  const lib = ui.newModel('library', 'الربو');
  ui.applyEvent(lib, { type: 'done', result: { docs: [] } });
  assert.equal(ui.vocabDue(lib, ok), false, '서재 범위');
  assert.equal(ui.vocabDue(finalModel('asthma'), ok), false, '라틴');
  assert.equal(ui.vocabDue(finalModel('천식'), ok), false, '한글');
  assert.equal(ui.vocabDue(finalModel('الربو'), { docLang: 'ar' }), false, '아랍어 책');
  assert.equal(ui.vocabDue(finalModel('ر', [], { error: 'ERR_SEARCH_SHORT' }), ok), false, '검색어 오류');
  assert.equal(ui.vocabDue(finalModel('الربو'), { docLang: 'en', scanReplace: true }), false, '스캔본 글자 없음');
  const via = finalModel('asthma');
  via.via = { from: 'الربو', to: 'asthma', others: 0 };
  assert.equal(ui.vocabDue(via, ok), false, '바꾼 모형');
  const rej = finalModel('الربو');
  rej.error = {};
  assert.equal(ui.vocabDue(rej, ok), false, 'reject');
  assert.equal(ui.vocabDue(null, ok), false);
});

/* ══ W5–W8 끝까지(흉내 IndexedDB) ═════════════════════════ */

let ELID = 0;
function eline(text, para) {
  return {
    id: 'v' + (++ELID), text: text, bbox: [0, 0, 100, 10], baseline: 0, fontSize: 10,
    col: 0, role: 'body', hyphenJoin: false, paraId: para, regionId: null, runs: []
  };
}
function epage(docId, pageNo, paras) {
  const lines = [];
  const ps = [];
  paras.forEach((p, i) => {
    const pid = 'p' + pageNo + '-' + i;
    const ids = (p.lines || [p.text]).map((t) => { const l = eline(t, pid); lines.push(l); return l.id; });
    ps.push({ id: pid, lineIds: ids, kind: 'body', bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false });
  });
  return {
    docId: docId, pageNo: pageNo, width: 600, height: 800, algoVersion: ALGO_VERSION,
    storeVersion: 1, derivedHash: derivedHash(), lines: lines, paragraphs: ps, regions: [],
    columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }, roleVersion: 1
  };
}

const D = 'VOC8F4';
let RECS = null;
let store = null;
let STARTED = false;
async function setup() {
  if (STARTED) return;
  STARTED = true;
  RECS = [
    epage(D, 1, [{ text: 'An invented page about quilar fever and zorvat.' }]),
    epage(D, 2, [{ lines: ['Bronchial asthma is a made-up topic here; bronchial', 'asthma again for the test.'] }]),
    epage(D, 3, [{ text: 'Nothing else. Pulmonary notes only.' }])
  ];
  await db.put('documents', { id: D, title: 'synthetic', fileHash: 'h-' + D, pageCount: 3, lastOpenedAt: 1, lang: 'en' });
  await db.putAll('pages', RECS);
  let clock = 1000;
  store = createVocabStore({ now: () => ++clock });
  await store.save({ surface: 'asthma', srcLang: 'en', targetLang: 'ar', translation: 'الربو', docId: D });
  await store.save({ surface: 'Bronchial asthma', srcLang: 'en', targetLang: 'ar', translation: 'الرَّبو', docId: D });
  await store.save({ surface: 'quilar', srcLang: 'en', targetLang: 'ar', translation: 'الأمراض الصدرية', docId: D });
}

async function all(name) {
  const out = [];
  await db.iterate(name, {}, (v) => { out.push(v); return true; });
  return out;
}
async function snapshot() {
  return JSON.stringify([await all('cards'), await all('documents'), await all('searchText')]);
}

test('W5 ★ 끝까지 — «الربو» 0건 → 단어장(가장 최근 «الرَّبو» = Bronchial asthma, 그 밖 1) → 원어로 적중 → 리더 강조도 그 원어 위', async () => {
  await setup();
  const q = 'الربو';
  const r0 = await engine.searchDoc(D, q);
  assert.equal(r0.hits.length, 0);
  const m = finalModel(q, r0.hits, { pageCount: r0.pageCount, pagesCovered: r0.pagesCovered });
  let listed = 0;
  const out = await ui.vocabRedirect(m, {
    docLang: 'en', target: 'ar', chapters: async () => null,
    list: () => { listed++; return store.list(); }
  });
  assert.equal(listed, 1);
  assert.ok(out && out.swap, JSON.stringify(out));
  assert.equal(out.swap.term, 'bronchial asthma');
  assert.equal(out.swap.surface, 'Bronchial asthma');
  assert.equal(out.swap.others, 1);
  // 그 원어로 한 번 더 찾기(화면은 같은 엔진 길 — run.doc)
  const r1 = await engine.searchDoc(D, out.swap.term);
  assert.deepEqual(r1.hits.map((h) => h.pageNo), [2, 2], '줄을 넘은 둘째 적중까지');
  // 리더 강조 경로(`findOn` → `rangesFor`) — 그 원어 글자 위
  const paras = flowParasOf(describePage(fromStored(RECS[1])));
  const j = joinPieces(paras[0].lines);
  const hs = ui.findOn(j.text, parseQuery(out.swap.term));
  assert.equal(hs.length, 2);
  const byId = new Map(RECS[1].lines.map((l) => [l.id, l.text]));
  const rs = rangesFor(j, hs);
  assert.equal(byId.get(rs[0][0].id).slice(rs[0][0].start, rs[0][0].end), 'Bronchial asthma');
  // 바꾼 모형은 다시 단어장을 보지 않는다(끝없이 돌지 않음)
  const nm = finalModel(out.swap.term, r1.hits);
  nm.via = { from: q, to: out.swap.surface, others: out.swap.others };
  assert.equal(await ui.vocabRedirect(nm, { docLang: 'en', target: 'ar', list: () => { listed++; return store.list(); } }), null);
  assert.equal(listed, 1);
});

test('W6 ★ 사전이 먼저 — «الأمراض الصدرية»(8g-7 사전 → 호흡기 장)는 단어장(quilar)이 있어도 읽지 않는다 · 안내는 8g-7 그대로', async () => {
  await setup();
  const q = 'الأمراض الصدرية';
  const ch = ui.chapterGroup(q, synthToc(), { docLang: 'en' });
  assert.ok(ch && ch.rows.length >= 1, '사전이 받는 검색어');
  // 단어장에는 이 번역이 있다 — 사전이 없었다면 quilar 로 바뀌었을 것
  assert.equal(ui.vocabSwap(q, await store.list(), CTX).term, 'quilar');
  const r0 = await engine.searchDoc(D, q);
  const m = finalModel(q, r0.hits);
  let listed = 0;
  const out = await ui.vocabRedirect(m, { docLang: 'en', target: 'ar', chapters: async () => ch, list: () => { listed++; return store.list(); } });
  assert.deepEqual(out, { dict: true });
  assert.equal(listed, 0, '사전이 받으면 단어장을 읽지 않는다');
  // 안내 줄 = 8g-7 그대로("장" 묶음이 있으면 "찾지 못했습니다" 없음 + 글자 체계 안내)
  assert.deepEqual(ui.emptyNotice(true, ui.scriptMismatch(q, 'en')), ['hint']);
});

test('W7 ★ 일치 없음 → {none} → 지금 안내 그대로 · 라틴·한글·짧은 검색어는 단어장을 읽지 않는다(null)', async () => {
  await setup();
  let listed = 0;
  const deps = { docLang: 'en', target: 'ar', chapters: async () => null, list: () => { listed++; return store.list(); } };
  const q = 'السكري';
  const m = finalModel(q, (await engine.searchDoc(D, q)).hits);
  assert.deepEqual(await ui.vocabRedirect(m, deps), { none: true });
  assert.equal(listed, 1);
  assert.deepEqual(ui.emptyNotice(false, ui.scriptMismatch(q, 'en')), ['empty', 'hint'], '17-8-7 빈 결과 그대로');
  for (const lq of ['asthma', 'zorvatosis', 'MI', '천식', 'x']) {
    const mm = finalModel(lq, []);
    assert.equal(await ui.vocabRedirect(mm, deps), null, lq);
  }
  assert.equal(listed, 1, '라틴·한글 검색어 경로는 단어장 읽기 0');
  // 단어장 읽기가 실패해도 지금 안내(던지지 않는다)
  const bad = await ui.vocabRedirect(finalModel(q, []), { docLang: 'en', target: 'ar', list: async () => { throw new Error('idb'); } });
  assert.deepEqual(bad, { none: true });
});

test('W8 ★ 호출 0 · 저장 불변 — W5–W7 전 과정 fetch 0 · cards·documents·searchText 그대로 · SEARCH.VERSION 1', async () => {
  await setup();
  const before = await snapshot();
  const deps = { docLang: 'en', target: 'ar', chapters: async () => null, list: () => store.list() };
  for (const q of ['الربو', 'الرَّبو', 'السكري', 'فقر الدم', 'asthma']) {
    const r0 = await engine.searchDoc(D, q);
    const out = await ui.vocabRedirect(finalModel(q, r0.hits), deps);
    if (out && out.swap) await engine.searchDoc(D, out.swap.term);
  }
  assert.equal(await snapshot(), before);
  assert.equal(SEARCH.VERSION, 1);
  assert.deepEqual(FETCHES, [], '요청 0');
});

/* ══ W9 배선·i18n ═════════════════════════════════════════ */

test('W9 배선 — 그리기마다 kickVocab(한 모형 한 번) · 사전(settledChapters) 다음 단어장 · 원어로 새 모형 + run.doc · 네트워크·AI import 없음', () => {
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /function paintModel\(\) \{\s*if \(!els\) return;\s*kickVocab\(\);/);
  assert.match(s, /if \(!m \|\| m\.vocab \|\| !docId \|\| !run\) return;/);
  assert.match(s, /chapters: \(\) => settledChapters\(m, docId\)/);
  assert.match(s, /list: \(\) => vocabStore\.list\(\)/);
  assert.match(s, /const nm = newModel\('doc', out\.swap\.term\);[\s\S]{0,200}S\.model = nm;[\s\S]{0,80}paintModel\(\);\s*run\.doc\(docId, out\.swap\.term\);/);
  assert.match(s, /if \(m\.via\) lines\.push\(\{ node: vocabFromNode\(m\.via, docLang\(S\.docId\)\) \}\);/);
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(s), 'search.js 에 네트워크 없음');
  assert.ok(!/from '\.\.\/ai\/(pipeline|provider|readalong)\.js'/.test(s), 'AI 파이프라인 import 없음');
  assert.match(s, /import \{ vocabStore \} from '\.\.\/vocab\/store\.js';/);
  // "단어장에서 바꿈" 줄 — 검색어 <bdi dir=auto> · 원어 dir=ltr lang=문서 언어(isolatedParts)
  assert.match(s, /isolatedParts\('search\.vocabFrom', \{\s*q: \{ text: via\.from, dir: 'auto' \},\s*to: \{ text: via\.to, dir: 'ltr', lang: lang \}/);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(s));
  // 장 찾기 목차는 다 읽은 뒤 — loadChapToc 의 읽기 약속
  assert.match(s, /my\.wait = tocOf\(docId\)\.then\(/);
});

test('W9 i18n — search.vocabFrom 한 키 × 4 언어 · 자리표시자 {q}·{to} · ar 은 영어 복사 아님 · ar·fr `[검토 — Nour·운영자]`', () => {
  for (const l of ['ar', 'en', 'fr', 'ko']) {
    const v = BUNDLES[l]['search.vocabFrom'];
    assert.ok(v, l);
    assert.deepEqual((v.match(/\{\w+\}/g) || []).sort(), ['{q}', '{to}'], l);
  }
  assert.notEqual(BUNDLES.ar['search.vocabFrom'], BUNDLES.en['search.vocabFrom']);
  assert.match(BUNDLES.ko['search.vocabFrom'], /^단어장에서 바꿈/);
  for (const f of ['ar', 'fr']) assert.match(read('../js/i18n/' + f + '.js'), /'search\.vocabFrom':[^\n]*\[검토 — Nour·운영자\]/, f);
  assert.match(read('../index.html'), /"\.\/js\/vocab\/store\.js": "\.\/js\/vocab\/store\.js\?v=[0-9a-f]{10}"/);
});

/* ══ W10–W12 8f-4b ════════════════════════════════════════ */

test('W10 ★ [N] 바꾼 원어도 0건 → 원래 검색어 모형으로 되돌림 = HEAD 판 모형 · 17-8-7 안내(찾지 못함 + 글자 체계 안내·[«الفهرس» 로])', async () => {
  await setup();
  const q = 'الدوخة';
  // 단어장에는 있으나 이 책에 없는 원어(다른 책에서 저장한 낱말 — 단어장은 책을 가리지 않는다)
  await store.save({ surface: 'nosuchword', srcLang: 'en', targetLang: 'ar', translation: q, docId: 'OTHER' });
  const r0 = await engine.searchDoc(D, q);
  assert.equal(r0.hits.length, 0);
  const extra = { pageCount: r0.pageCount, pagesCovered: r0.pagesCovered };
  const m = finalModel(q, r0.hits, extra);
  // HEAD 판이 그리는 모형(단어장 대응 없음) — 같은 검색어 · 같은 끝 결과
  const headModel = JSON.stringify(finalModel(q, r0.hits, extra));
  const out = await ui.vocabRedirect(m, { docLang: 'en', target: 'ar', chapters: async () => null, list: () => store.list() });
  assert.equal(out.swap.term, 'nosuchword');
  // 화면 길 흉내: kickVocab 이 만드는 바꾼 모형 → run.doc 의 끝 결과(0건)
  m.vocab = 'swapped';
  const nm = ui.newModel('doc', out.swap.term);
  nm.via = { from: m.query, to: out.swap.surface, others: out.swap.others };
  nm.orig = m;
  const r1 = await engine.searchDoc(D, out.swap.term);
  assert.equal(r1.hits.length, 0);
  ui.applyEvent(nm, { type: 'partial', result: Object.assign({}, r1, { hits: [] }) });
  assert.equal(ui.vocabFallback(nm), null, '찾는 중에는 되돌리지 않는다');
  ui.applyEvent(nm, { type: 'final', result: r1 });
  const back = ui.vocabFallback(nm);
  assert.equal(back, m, '원래 검색어 모형');
  assert.equal(back.via, undefined, '바꿈 줄 없음');
  const { vocab, ...rest } = back;
  assert.equal(JSON.stringify(rest), headModel, 'HEAD 판 모형과 같음(검색어·끝 결과·진행)');
  // 그 모형의 안내 = 17-8-7 그대로(찾지 못했습니다 + 글자 체계 안내 + [«الفهرس» 로])
  assert.deepEqual(ui.emptyNotice(false, ui.scriptMismatch(back.query, 'en')), ['empty', 'hint']);
  // 다시 단어장을 보지 않는다(한 모형 한 번 — m.vocab)
  assert.ok(back.vocab);
  // 바꿈이 성공하면 그대로(되돌리지 않음) · 바꾼 모형이 아니면 null · 바꾼 검색 실패(reject)도 원래 안내로
  const ok = ui.newModel('doc', 'bronchial asthma');
  ok.via = { from: 'الربو', to: 'Bronchial asthma', others: 0 };
  ok.orig = finalModel('الربو', []);
  ui.applyEvent(ok, { type: 'final', result: await engine.searchDoc(D, 'bronchial asthma') });
  assert.equal(ok.result.hits.length, 2);
  assert.equal(ui.vocabFallback(ok), null, '바꿈 성공은 그대로');
  assert.equal(ui.vocabFallback(finalModel('الدوخة', [])), null, '바꾼 모형 아님');
  assert.equal(ui.vocabFallback(null), null);
  const rej = ui.newModel('doc', 'nosuchword');
  rej.via = nm.via;
  rej.orig = m;
  ui.applyEvent(rej, { type: 'reject', error: {} });
  assert.equal(ui.vocabFallback(rej), m, '바꾼 검색 실패');
  // 배선 — 검색 끝 이벤트마다, 그리기 전에 되돌린다 · 바꾼 모형이 원래 모형을 쥔다
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /function onRunEvent\(ev\) \{[\s\S]*?const back = vocabFallback\(S\.model\);\s*if \(back\) S\.model = back;[\s\S]*?paintModel\(\);\s*\}/);
  assert.match(s, /nm\.via = \{ from: m\.query, to: out\.swap\.surface, others: out\.swap\.others \};\s*nm\.orig = m;/);
});

test('W11 ★ 낡은 결과 거르기 vocabSettle — 그사이 검색어·책이 바뀌면 drop · 화면 떠남 later · 사전/없음/바꿈 · 흐름 흉내', async () => {
  const m = finalModel('الربو', []);
  const SW = { swap: { term: 'asthma', surface: 'asthma', id: 'a', others: 0 } };
  const st = { model: m, docId: 'D1', shown: true };
  assert.equal(ui.vocabSettle(st, m, 'D1', SW), 'swap');
  assert.equal(ui.vocabSettle(st, m, 'D1', { dict: true }), 'dict');
  assert.equal(ui.vocabSettle(st, m, 'D1', { none: true }), 'none');
  assert.equal(ui.vocabSettle(st, m, 'D1', null), 'none');
  assert.equal(ui.vocabSettle({ model: finalModel('pulmonary', []), docId: 'D1', shown: true }, m, 'D1', SW), 'drop', '검색어가 바뀜');
  assert.equal(ui.vocabSettle({ model: m, docId: 'D2', shown: true }, m, 'D1', SW), 'drop', '책이 바뀜');
  assert.equal(ui.vocabSettle({ model: null, docId: 'D1', shown: true }, m, 'D1', SW), 'drop', '검색어 지움');
  assert.equal(ui.vocabSettle({ model: m, docId: 'D1', shown: false }, m, 'D1', SW), 'later', '화면 떠남');
  assert.equal(ui.vocabSettle({ model: finalModel('lung', []), docId: 'D1', shown: false }, m, 'D1', SW), 'drop', '낡은 것이 먼저');
  // 흐름 흉내 — 단어장 읽기가 끝나기 전에 다른 검색어를 제출하면 늦게 온 응답은 버린다(G1·G2·G4·G5)
  await setup();
  let open = null;
  const gateList = () => new Promise((res) => { open = res; });
  const screen = { model: m, docId: D, shown: true };
  const p = ui.vocabRedirect(m, { docLang: 'en', target: 'ar', chapters: async () => null, list: gateList }).then((out) => ui.vocabSettle(screen, m, D, out));
  while (!open) await new Promise((r) => setTimeout(r, 1));
  screen.model = finalModel('pulmonary', []);            // 그사이 새 검색
  open(await store.list());
  assert.equal(await p, 'drop');
  // 같은 흐름에서 상태가 그대로면 바꾼다
  open = null;
  const screen2 = { model: m, docId: D, shown: true };
  const p2 = ui.vocabRedirect(m, { docLang: 'en', target: 'ar', chapters: async () => null, list: gateList }).then((out) => ui.vocabSettle(screen2, m, D, out));
  while (!open) await new Promise((r) => setTimeout(r, 1));
  open(await store.list());
  assert.equal(await p2, 'swap');
  // 배선 — kickVocab 이 응답을 vocabSettle 로 거르고 drop 이면 아무것도 하지 않는다
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /vocabRedirect\(m, deps\)\.then\(\(out\) => \{\s*const how = vocabSettle\(S, m, docId, out\);\s*if \(how === 'drop'\) return;/);
});

test('W12 [8f-4b] 단어장을 보는 동안 미루는 것은 "찾지 못했습니다" 한 줄뿐 — 글자 체계 안내·[«الفهرس» 로] 는 바로(배선)', () => {
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /\} else if \(m\.final && !r\.hits\.length\) \{\s*for \(const k of emptyNotice\(!!currentChapters\(\), scriptMismatch\(m\.query, docLang\(S\.docId\)\)\)\) \{\s*if \(k === 'empty' && m\.vocab === 'looking'\) continue;/);
  assert.ok(!/m\.vocab !== 'looking'/.test(s), '안내 전체를 미루지 않는다');
});
