/* ============================================================
   tests/review-ui-15.test.mjs — 15-2 복습 묶음 화면 `#/review` · 퀴즈 AI 갈래 · 범위 고르기 부품 옮김 · 입구 셋
   (spec 17-13 2 · 4 · 5 표 15-2 행 · 6 · 7 "15-2" 수용 기준 · 8 결정 15-D2·D3·D9·D11·D12 — fake-idb · 순수 · 정적)

   V1  라우트 `#/review/:docId` · `#/review/:docId/:a-b` · `reviewHash` 왕복 · docId 없음 → 서재 · `#/cards/:docId/:a-b` · SCREENS · 섹션 하나 · main 배선
   V2  ★ 범위 고르기 옮김(15-D11, 동작 무변) — planner·summaries 가 rangepick 의 **같은 함수**를 다시 내보냄 · 13-2 정정 ④ 장 끝 규칙 고정 ·
       11-3 맨 위 깊이 규칙 고정 · 정의는 rangepick 한 곳 · 기본 범위(읽던 장) · 쪽 정규화 · 인쇄 라벨
   V3  ★ AI 갈래 — [풀기] 주소 `ai-p{a}-{b}`(원서 sectionId 아님) · [문제 만들기] 결과 한 줄(읽지 않음·다 씀·막힘·실패·폐기 > 50%·만듦) — 자동 재시도 0
   V4  칸 보이기 — 원서 문제 없는 책 → 📕 칸 없음 · 카드·필기 0 → 칸 없음 · 요약 0 → 칸은 있고 "아직 저장한 요약이 없습니다"
   V5  셈 — 첫 읽지 않은 쪽 · 필기(묶음 수 · 범위 안 — 20-3 `rowsOf`→`filterRows` 와 같은 수, 쪽을 넘는 묶음) · 카드(범위 안 복습할 것 + 새 카드 몫 · 전체 ·
       번역 빈 단어 카드 빠짐)
   V5b ★ 15-2R #2 — 실제 cardStore(fake-idb)에서 묶음 "복습할 n" = 12-3 범위 화면(`createReviewFlow` pages) 줄 수 · `isNoTrTerm` 한 벌 · queue 무변
   V6  ★ 퀴즈 화면 갈래(정적) — rejected 안 읽음 · 🤖 배지 · 근거 블록(AI 만 · 원문 언어 lang/dir) · 해설 tr + src · `ai-…` 제목 · 뒤로가기 = 묶음 ·
       원서 📕 줄 그대로 · innerHTML 0(review·rangepick·quiz)
   V7  서재 — [⋯] "복습 묶음" · 삭제 확인 "AI 문제 n개도 지워집니다"(n > 0 · 남는 것 줄과 따로) · 셈은 aiQuiz.countForDoc
   V8  ★ 12-3 범위 칸 — `createReviewFlow` 가 쪽 범위 안 카드만 · 새 카드 몫은 범위 안에서 다시 채움 · 범위 없으면 그대로
   V9  입구 셋 같은 범위 · 계층(review.js 는 파이프라인을 import 하지 않음 — sumServices 주입) · 호출은 누를 때만 · i18n 4언어 · CSS
   지어낸 글자만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.sessionStorage = globalThis.sessionStorage || memStorage();
globalThis.localStorage = globalThis.localStorage || memStorage();

const R = await import('../js/router.js');
const RP = await import('../js/ui/rangepick.js');
const PL = await import('../js/ui/planner.js');
const SU = await import('../js/ui/summaries.js');
const RV = await import('../js/ui/review.js');
const CU = await import('../js/ui/cards.js');
const NU = await import('../js/ui/notes.js');
const SC = await import('../js/srs/cards.js');
const db = await import('../js/db.js');
const LIB = await import('../js/ui/library.js');
const { MAKE } = await import('../js/review/aiquiz.js');
const { OUTLINE_V } = await import('../js/search/outline.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }

/* ══ V1 라우트 ══════════════════════════════════════════ */

test('V1 라우트 — #/review/:docId(/:a-b) · reviewHash 왕복 · docId 없음 → 서재 · #/cards/:docId/:a-b · SCREENS · 섹션 · main', () => {
  assert.deepEqual(R.parseRoute('#/review/docA').params, { docId: 'docA' });
  assert.equal(R.parseRoute('#/review/docA').name, 'review');
  assert.deepEqual(R.parseRoute('#/review/doc%20A/79-40').params, { docId: 'doc A', range: { from: 40, to: 79 } }, '거꾸로 → 바로잡음');
  assert.deepEqual(R.parseRoute('#/review/docA/x-1').params, { docId: 'docA' }, '이상한 범위 → 읽던 장(화면이 고름)');
  assert.equal(R.parseRoute('#/review').name, 'library', 'docId 없으면 갈 곳이 없다');
  assert.equal(R.reviewHash('docA', { from: 79, to: 40 }), '#/review/docA/40-79');
  assert.equal(R.reviewHash('doc A'), '#/review/doc%20A');
  assert.equal(R.reviewHash(''), '#/library');
  for (const h of [R.reviewHash('d/1'), R.reviewHash('d', { from: 2, to: 5 })]) {
    const r = R.parseRoute(h);
    assert.equal(R.reviewHash(r.params.docId, r.params.range), h, '왕복');
  }
  // 12-3 범위 칸
  assert.deepEqual(R.parseRoute('#/cards/docA/3-5').params, { docId: 'docA', range: { from: 3, to: 5 } });
  assert.deepEqual(R.parseRoute('#/cards/docA').params, { docId: 'docA' }, '범위 없는 라우트 그대로');
  assert.deepEqual(R.parseRoute('#/cards').params, {});
  assert.equal(R.cardsHash('docA', { from: 5, to: 3 }), '#/cards/docA/3-5');
  assert.equal(R.cardsHash('docA'), '#/cards/docA', '12-3 옛 꼴 그대로');
  assert.ok(R.SCREENS.includes('review'));
  const html = read('../index.html');
  assert.equal((html.match(/data-screen="review"/g) || []).length, 1);
  assert.match(html, /<section class="screen review-screen" data-screen="review" hidden>/);
  assert.match(html, /id="rvBody"/);
  assert.match(html, /data-i18n="review\.disclaimer"/, '고지 한 줄(칸 8)');
  const main = read('../js/main.js');
  assert.ok(main.includes("import { initReview, showReview, leaveReview } from './ui/review.js';"));
  assert.ok(/initReview\(\);/.test(main) && /case 'review': showReview\(route\.params\); break;/.test(main) && /if \(route\.name !== 'review'\) leaveReview\(\);/.test(main));
});

/* ══ V2 범위 고르기 옮김 ═════════════════════════════════ */

test('V2 ★ 범위 고르기 옮김(동작 무변) — 같은 함수 · 13-2 장 끝 규칙 · 11-3 맨 위 깊이 · 정의는 한 곳 · 기본 범위 · 인쇄 라벨', () => {
  assert.equal(PL.chapterRanges, RP.chapterRanges, '★ 13-2 가 rangepick 의 함수를 그대로 다시 내보냄');
  assert.equal(SU.chaptersOf, RP.chaptersOf, '★ 11-3 도 같음');
  assert.equal(SU.chapterAt, RP.chapterAt);
  // 13-2 정정 ④ — 위 두 깊이 · 장 끝 = 같거나 얕은 깊이의 다음 항목 − 1 · 셋째 깊이 빠짐
  const toc = { items: [{ t: 'Ch1', p: 1, d: 1 }, { t: 'Sec 1.1', p: 2, d: 2 }, { t: 'Sec 1.1.1', p: 3, d: 3 }, { t: 'Ch2', p: 4, d: 1 }] };
  assert.deepEqual(RP.chapterRanges(toc, 9), [
    { title: 'Ch1', from: 1, to: 3, d: 0 }, { title: 'Sec 1.1', from: 2, to: 3, d: 1 }, { title: 'Ch2', from: 4, to: 9, d: 0 }]);
  assert.deepEqual(RP.chapterRanges(null, 9), []);
  assert.deepEqual(RP.chapterRanges({ items: [{ t: 'A', p: 5, d: 2 }, { t: 'B', p: 3, d: 2 }] }, 0), [
    { title: 'A', from: 5, to: 5, d: 0 }, { title: 'B', from: 3, to: 3, d: 0 }], '쪽이 뒤로 가면 폴백 · 문서 끝 0');
  // 11-3 — 개요 맨 위 깊이만 · 같은 쪽 시작은 앞 것 · 쓰레기 개요 0
  const doc = { outlineV: OUTLINE_V, pageCount: 30, outline: [{ t: 'One', p: 2, d: 1 }, { t: 'One.1', p: 3, d: 2 }, { t: 'Dup', p: 2, d: 1 }, { t: 'Two', p: 10, d: 1 }] };
  assert.deepEqual(RP.chaptersOf(doc), [{ title: 'One', from: 2, to: 9 }, { title: 'Two', from: 10, to: 30 }]);
  assert.deepEqual(RP.chaptersOf(Object.assign({}, doc, { outlineV: -1 })), []);
  assert.equal(RP.chapterAt(RP.chaptersOf(doc), 12), 1);
  assert.equal(RP.chapterAt(RP.chaptersOf(doc), 1), -1);
  // 정의는 rangepick 한 곳(옮김)
  assert.ok(!/function chapterRanges\s*\(/.test(read('../js/ui/planner.js')), 'planner 에 정의 0');
  assert.ok(!/function chaptersOf\s*\(|function chapterAt\s*\(/.test(read('../js/ui/summaries.js')), 'summaries 에 정의 0');
  assert.ok(/import \{ chapterRanges, chapterOptionText, printedRange \} from '\.\/rangepick\.js';/.test(read('../js/ui/planner.js')));
  assert.ok(/import \{ chaptersOf, chapterAt \} from '\.\/rangepick\.js';/.test(read('../js/ui/summaries.js')));
  // 기본 범위 — 읽던 쪽이 든 맨 위 장 · 없으면 가장 좁은 것 · 목차 없으면 그 쪽 하나
  const ch = RP.chapterRanges(toc, 9);
  assert.deepEqual(RP.defaultRange(ch, 2, 9), [1, 3], '깊이 0 장');
  assert.deepEqual(RP.defaultRange(ch, 7, 9), [4, 9]);
  assert.deepEqual(RP.defaultRange([], 7, 9), [7, 7]);
  assert.deepEqual(RP.defaultRange([], 70, 9), [9, 9], '문서 끝 안');
  assert.deepEqual(RP.defaultRange([{ title: 's', from: 2, to: 3, d: 1 }], 3, 9), [2, 3]);
  assert.deepEqual(RP.chapterOfRange(ch, 2, 3).title, 'Sec 1.1');
  assert.equal(RP.chapterOfRange(ch, 2, 4), null);
  // 쪽 정규화
  assert.deepEqual(RP.normPages(5, 3, 9), [3, 5]);
  assert.deepEqual(RP.normPages('4', '', 9), [4, 4]);
  assert.equal(RP.normPages(0, 3, 9), null);
  assert.equal(RP.normPages(3, 12, 9), null, '문서 끝 넘음');
  assert.equal(RP.normPages('x', 3, 9), null);
  // 인쇄 라벨(8g pageLabels)
  assert.deepEqual(RP.printedRange(['i', 'ii', '1', '2'], 2, 4), { a: 'ii', b: '2' });
  assert.equal(RP.printedRange(['1', '2', '3'], 1, 3), null, '라벨 = PDF 쪽이면 없음');
  assert.equal(RP.printedRange(null, 1, 3), null);
});

/* ══ V3 AI 갈래 ═════════════════════════════════════════ */

test('V3 ★ AI [풀기] = ai-p{a}-{b} · [문제 만들기] 결과 한 줄 — 읽지 않음·다 씀·막힘·실패·폐기 > 50%·만듦 · 자동 재시도 0', () => {
  assert.equal(RV.aiQuizHash('docA', 40, 79), '#/quiz/docA/ai-p40-79', '★ 원서 sectionId(sec-…)가 아니다');
  assert.equal(RV.aiQuizHash('docA', 79, 40), '#/quiz/docA/ai-p40-79');
  assert.equal(R.parseRoute(RV.aiQuizHash('d', 3, 5)).params.sectionId, 'ai-p3-5');
  const n = RV.aiNote;
  assert.equal(n({ status: MAKE.UNREAD }).key, 'review.ai.unread');
  assert.equal(n({ status: MAKE.NO_PASSAGE }).key, 'review.ai.noPassage');
  assert.equal(n({ status: 'too-big' }).key, 'review.ai.tooBig');
  assert.deepEqual(n({ state: 'ready', verified: 5, weak: false }), { key: 'review.ai.made', params: { n: 5 }, retry: false, banner: null, ok: true });
  const w = n({ state: 'ready', verified: 1, weak: true });
  assert.equal(w.key, 'review.ai.weak', '★ 폐기 > 50% — 설계 문구');
  assert.equal(w.retry, false, '자동 재호출 0 · [다시 시도]도 없음(같은 입력은 캐시)');
  const ex = n({ state: 'blocked', code: 'exhausted' });
  assert.equal(ex.key, 'readalong.blocked.exhausted', '429 → 막힘 한 줄');
  assert.equal(ex.retry, true, '[다시 시도] 단추(누를 때만)');
  assert.equal(n({ state: 'blocked', code: 'no-key' }).banner, 'no-key', '키 없음 → 상태 바 안내');
  assert.equal(n({ state: 'failed' }).key, 'review.ai.failed');
  assert.equal(n({ state: 'failed' }).retry, true);
  assert.equal(n(null).key, 'review.ai.failed');
  assert.equal(n({ state: 'ready', saveError: 'Error', verified: 5 }).key, 'review.ai.saveFailed');
  // 호출은 누를 때만 — make 를 부르는 곳은 makeAi 하나, makeAi 는 클릭에서만
  const src = strip(read('../js/ui/review.js'));
  assert.equal((src.match(/aiQuiz\.make\(/g) || []).length, 1);
  assert.deepEqual((src.match(/makeAi\(/g) || []).length, 3, '정의 1 + [문제 만들기]·[다시 시도] 클릭 2');
  assert.ok(/if \(act === 'make'\) \{ await makeAi\(false\); return; \}/.test(src) && /if \(act === 'retry'\) \{ await makeAi\(true\); return; \}/.test(src));
  assert.ok(!/setTimeout\([^)]*makeAi|setInterval/.test(src), '자동·주기 호출 0');
});

/* ══ V4 칸 보이기 ═════════════════════════════════════════ */

test('V4 칸 보이기 — 원서 문제 없는 책 📕 없음 · 카드·필기 0 없음 · 요약 칸은 늘(없으면 한 줄)', () => {
  const none = RV.cellsOf({ sections: [], cards: { due: 0, total: 0 }, notes: 0, sums: 0 });
  assert.deepEqual(none, { progress: true, sum: true, book: false, ai: true, cards: false, notes: false });
  const full = RV.cellsOf({ sections: [{ sectionId: 'sec-III' }], cards: { due: 2, total: 5 }, notes: 3, sums: 4 });
  assert.deepEqual(full, { progress: true, sum: true, book: true, ai: true, cards: true, notes: true });
  assert.ok(Object.values(RV.cellsOf({ cards: { total: 1 } })).filter(Boolean).length >= 3, '칸 셋 이상(진도·요약·AI)');
  assert.equal(BUNDLES.ko['review.sum.none'], '아직 저장한 요약이 없습니다');
});

/* ══ V5 셈 ═════════════════════════════════════════════ */

test('V5 셈 — 첫 읽지 않은 쪽 · 필기 묶음 수(범위 안) · 카드(범위 안 복습 + 새 카드 몫 · 전체)', () => {
  assert.equal(RV.firstUnread([[3, 4]], 3, 8), 5);
  assert.equal(RV.firstUnread([[3, 8]], 3, 8), 3, '다 읽었으면 첫 쪽');
  assert.equal(RV.firstUnread([], 3, 8), 3);
  const H = 'highlight';
  const notes = [{ id: 'a', group: 'g1', pageNo: 4, kind: H }, { id: 'b', group: 'g1', pageNo: 5, kind: H }, { id: 'c', pageNo: 6, kind: 'note' }, { id: 'd', pageNo: 9, kind: H },
    { id: 'e', pageNo: 2, kind: H }, { id: 'g2', group: 'g2', pageNo: 8, kind: H }, { id: 'h', group: 'g2', pageNo: 9, kind: H }];   // g2 = 쪽을 넘는 묶음(대표 8쪽 + 조각 9쪽)
  assert.equal(RV.notesInRange(notes, 3, 8), 3, '같은 group = 하나 · 범위 밖 0 · 쪽을 넘는 묶음은 대표 쪽');
  assert.equal(RV.notesInRange(notes, 9, 15), 1, '★ 15-2R #5 — 조각만 범위에 든 묶음(g2)은 세지 않음(20-3 범위 줄과 같음)');
  assert.equal(RV.notesInRange(notes, 16, 20), 0);
  for (const [a, b] of [[3, 8], [9, 15], [16, 20], [1, 30], [4, 4]]) {
    assert.equal(RV.notesInRange(notes, a, b), NU.filterRows(NU.rowsOf(notes), { range: { from: a, to: b } }).length, '★ 20-3 rowsOf → filterRows 와 같은 수 ' + a + '-' + b);
  }
  assert.ok(/return filterRows\(rowsOf\(recs\), \{ range: \{ from: r\[0\], to: r\[1\] \} \}\)\.length;/.test(read('../js/ui/review.js')), '20-3 의 같은 함수(한 벌)');
  const cards = [
    { id: 1, pageNo: 4, sm2: { reps: 2 } }, { id: 2, pageNo: 5 }, { id: 3, pageNo: 6 }, { id: 4, pageNo: 6, suspended: true }, { id: 5, pageNo: 12 }, { id: 6 },
    { id: 7, kind: 'term', pageNo: 5, translation: '' }, { id: 8, kind: 'term', pageNo: 7, translation: '  ' }, { id: 9, kind: 'term', pageNo: 7, translation: 'apoptose' }];
  const q = { due: [cards[0], cards[4]] };
  const c = RV.cardsInRange(q, cards, 1, 3, 8);
  assert.equal(c.total, 7, '범위 안 카드 일곱(멈춘 것·번역 빈 단어 포함 · 쪽 모르는 것 빠짐)');
  assert.equal(c.due, 2, '복습할 1(범위 안) + 새 카드 몫 1');
  assert.equal(RV.cardsInRange(q, cards, 20, 3, 8).due, 4, '★ 15-2R #2 — 몫이 넉넉하면 범위 안 새 카드 다(2·3·9) — 번역 빈 단어 카드(7·8)는 빠짐');
});

test('V5b ★ 15-2R #2 — 묶음 "복습할 n" = 12-3 범위 화면 줄 수(번역 빈 단어 빠짐) · 판정 isNoTrTerm 한 벌 · queue 무변', async () => {
  const T = new Date(2026, 10, 17, 9, 0, 0).getTime();
  const card = (id, o) => Object.assign({ id: id, kind: 'sentence', front: 'Sentence ' + id + ' here.', back: 'جملة', explain: '', srcLang: 'en', targetLang: 'ar',
    docId: 'D5', docTitle: 'Book', pageNo: 4, lineId: null, paraId: null, origin: null, domain: '', note: '', createdAt: T - 1000, updatedAt: T - 1000,
    reviewedAt: null, introducedAt: null, sm2: { ease: 2.5, interval: 0, reps: 0, lapses: 0 }, dueAt: T - 1000, suspended: false }, o || {});
  const term = (id, tr, o) => card(id, Object.assign({ kind: 'term', term: id, surface: id, translation: tr }, o || {}));
  const rev = (dueAt) => ({ reviewedAt: T - 3 * 864e5, introducedAt: T - 9 * 864e5, sm2: { ease: 2.5, interval: 3, reps: 2, lapses: 0 }, dueAt: dueAt });
  const recs = [
    card('s1', Object.assign({ pageNo: 3, createdAt: T - 900 }, rev(T - 5000))),        // 복습할 것
    card('s2', { pageNo: 4, createdAt: T - 800 }),
    term('t1', '', { pageNo: 4, createdAt: T - 700 }),                                  // ★ 번역 빈 단어(새 카드) — 빠짐
    term('t2', '   ', { pageNo: 5, createdAt: T - 600 }),                               // 공백만 — 빠짐
    term('t3', 'apoptose', { pageNo: 5, createdAt: T - 500 }),
    term('t4', '', Object.assign({ pageNo: 6, createdAt: T - 400 }, rev(T - 4000))),     // 번역 빈 단어(복습) — queue 가 뺌
    card('s3', { pageNo: 6, createdAt: T - 300, suspended: true }),
    card('s4', { pageNo: 9, createdAt: T - 200 }),
    term('t5', '', { pageNo: 9, createdAt: T - 100 })
  ];
  for (const r of recs) await db.put('cards', r);
  const store = SC.createCardStore({ now: () => T });
  const rows = [];
  for (const [npd, a, b] of [[20, 3, 8], [1, 3, 8], [2, 4, 5], [20, 1, 20], [0, 3, 8], [20, 9, 9]]) {
    const q = await store.queue({ nowMs: T, docId: 'D5', newPerDay: npd });
    const all = await store.list({ docId: 'D5' });
    const c = RV.cardsInRange(q, all, npd, a, b);                                         // 하루 기록 없음 → 오늘 남은 몫 = npd
    const f = CU.createReviewFlow({ store: store, now: () => T, newPerDay: () => npd });
    await f.start({ docId: 'D5', pages: [a, b] });
    assert.equal(c.due, f.line().length, '★ 묶음 "복습할" = 12-3 #/cards/D5/' + a + '-' + b + ' 줄 수(하루 새 카드 ' + npd + ')');
    rows.push(c.due);
  }
  assert.deepEqual(rows, [3, 2, 2, 4, 1, 1], '숫자 고정(고치기 전 묶음은 5·2·2·7·1·2)');
  assert.equal((await store.list({ docId: 'D5' })).filter((x) => Number(x.pageNo) >= 3 && Number(x.pageNo) <= 8).length,
    RV.cardsInRange({ due: [] }, recs, 0, 3, 8).total, '전체 m 은 그대로 모두(12-3 끝 화면 "전체"와 같음)');
  // 판정 한 벌 — srs/cards.js 의 순수 export · queue 와 묶음이 같은 함수를 쓴다 · queue 동작 무변(noTr 수)
  assert.deepEqual([null, { kind: 'term' }, { kind: 'term', translation: '' }, { kind: 'term', translation: ' \n' }, { kind: 'term', translation: 'x' },
    { kind: 'sentence', translation: '' }, { kind: 'sentence' }, { kind: 'term', translation: 0 }].map(SC.isNoTrTerm), [false, true, true, true, false, false, false, false]);
  const q20 = await store.queue({ nowMs: T, docId: 'D5', newPerDay: 20 });
  assert.deepEqual([q20.counts.noTr, q20.due.map((x) => x.id), q20.fresh.map((x) => x.id)], [4, ['s1'], ['s2', 't3', 's4']], 'queue 무변');
  const cs = strip(read('../js/srs/cards.js'));
  assert.ok(/if \(isNoTrTerm\(c\)\) \{ noTr\+\+; continue; \}/.test(cs), 'queue 가 같은 판정');
  const rv = strip(read('../js/ui/review.js'));
  assert.ok(/isNew\(c\) && !isNoTrTerm\(c\)/.test(rv), '묶음이 같은 판정');
  assert.ok(!/kind === 'term'/.test(rv), '묶음에 규칙 사본 0');
});

/* ══ V6 퀴즈 화면 갈래(정적) ═══════════════════════════════ */

test('V6 ★ 퀴즈 갈래 — rejected 안 읽음 · 🤖 · 근거 블록(AI 만) · 해설 tr+src · ai 제목 · 뒤로 = 묶음 · 📕 그대로 · innerHTML 0', () => {
  const q = read('../js/ui/quiz.js');
  const s = strip(q);
  assert.ok(/\(row\) => \{ if \(row && row\.status !== 'rejected'\) out\.push\(row\); \}/.test(s), '★ loadQuestions 거름 한 줄');
  assert.ok(s.includes("badge.textContent = ai ? ('🤖 ' + t('quiz.badge.ai')) : gradable ? ('📕 ' + t('quiz.badge.verified')) : t('quiz.badge.unverified');"), '📕 갈래 글 그대로 + 🤖');
  assert.ok(/quiz-badge quiz-badge-ai/.test(s));
  assert.ok(/if \(ai\) card\.appendChild\(evidenceBlock\(q\)\);/.test(s), '★ 근거 블록 — AI 만, 늘 보임');
  assert.ok(/function evidenceBlock\(q\)[\s\S]*?bq\.setAttribute\('lang', a\.lang\);[\s\S]*?bq\.setAttribute\('dir', a\.dir\);[\s\S]*?bq\.textContent = quote;/.test(s), '인용 lang·dir = 원문 언어 · 글자 그대로');
  assert.ok(/quiz\.ai\.gotoSource/.test(s) && /evidenceHandler\(x\)/.test(s), '[원문에서 보기] → 묶음 화면 처리기(findQuote)');
  assert.ok(/if \(isAi\(q\)\) box\.appendChild\(aiExplanationBlock\(q\)\);/.test(s));
  assert.ok(/const explanation = q\.explanation && q\.explanation\.en \? String\(q\.explanation\.en\) : '';/.test(s), '원서 해설은 en 그대로');
  assert.ok(/String\(ex\.tr \|\| ''\)/.test(s) && /String\(ex\.src \|\| ''\)/.test(s));
  assert.ok(/t\('quiz\.ai\.title'/.test(s), 'ai-… 제목');
  assert.ok(/t\(isAi\(q\) \? 'quiz\.ai\.expected' : 'quiz\.answer\.expected'/.test(s), 'AI 정답 줄은 "책의 정답"이 아니다');
  assert.ok(/if \(ar\) \{ els\.back\.setAttribute\('data-nav', reviewHash\(docId, \{ from: ar\[0\], to: ar\[1\] \}\)\); return; \}/.test(s), '뒤로가기 = 묶음');
  assert.ok(/if \(!questions\.length && !aiRangeOf\(sectionId\)\)/.test(s), 'AI 섹션은 원서 색인을 만들지 않는다');
  // 원서 문항은 en·ltr 그대로(srcAttrs 기본)
  assert.ok(/const l = lg \? String\(lg\.src \|\| lg\.tr \|\| 'en'\) : 'en';/.test(s));
  for (const f of ['../js/ui/review.js', '../js/ui/rangepick.js', '../js/ui/quiz.js']) {
    assert.ok(!strip(read(f)).includes('innerHTML'), f + ' innerHTML 0');
    assert.ok(!/insertAdjacentHTML|outerHTML|document\.write/.test(strip(read(f))), f);
  }
});

/* ══ V7 서재 ═══════════════════════════════════════════ */

test('V7 서재 — [⋯] "복습 묶음" · 삭제 확인 "AI 문제 n개도 지워집니다"(따로 한 줄) · 셈은 countForDoc', async () => {
  const lines = LIB.deleteKeepLines({ vocab: 2, ai: 3 });
  assert.deepEqual(lines, [{ key: 'library.card.deleteConfirmVocab', params: { n: 2 } }, { key: 'library.card.deleteConfirmAi', params: { n: 3 }, gone: true }]);
  assert.deepEqual(LIB.deleteKeepLines({ vocab: 2, ai: 0 }), [{ key: 'library.card.deleteConfirmVocab', params: { n: 2 } }], 'n = 0 이면 줄 없음');
  const tr = (k, p) => k + (p ? JSON.stringify(p) : '');
  const txt = LIB.deleteConfirmText('Book', lines, tr).split('\n');
  assert.equal(txt.length, 3);
  assert.equal(txt[1], 'library.card.deleteConfirmAi{"n":"3"}', '★ 머리 다음 따로 한 줄');
  assert.ok(txt[2].startsWith('library.card.deleteKeeps') && !txt[2].includes('deleteConfirmAi'), '남는 것 줄에 섞지 않음');
  const c = await LIB.deleteKeepCounts('docX', {
    vocab: { countByDoc: async () => 0 }, cards: { keptCount: async () => 0 }, summaries: { count: async () => 0 }, notes: { count: async () => 0 },
    ai: { countForDoc: async (id) => (id === 'docX' ? 4 : 0) } });
  assert.deepEqual(c, { vocab: 0, ai: 4 });
  const bad = await LIB.deleteKeepCounts('docX', { vocab: { countByDoc: async () => 0 }, cards: { keptCount: async () => 0 },
    summaries: { count: async () => 0 }, notes: { count: async () => 0 }, ai: { countForDoc: async () => { throw new Error('x'); } } });
  assert.deepEqual(bad, { vocab: 0 }, '못 읽으면 0(확인을 막지 않는다)');
  const lib = read('../js/ui/library.js');
  assert.ok(/el\('button', 'doc-review', t\('library\.card\.review'\)\)/.test(lib) && /go\(reviewHash\(docId\)\);/.test(lib));
  assert.ok(/import \{ aiQuiz \} from '\.\.\/review\/aiquiz\.js';/.test(lib));
  assert.ok(/if \(!\(await askDelete\(name, deleteKeepLines\(await deleteKeepCounts\(docId\)\)\)\)\) \{ focusCardAction\(docId, 'delete'\); return; \}/.test(lib), '`[다듬기 4]` 페이지 안 대화 · 한 함수');
});

/* ══ V8 12-3 범위 칸 ═════════════════════════════════════ */

test('V8 ★ 12-3 범위 칸 — 범위 안 카드만 · 새 카드 몫은 범위 안에서 · 범위 없으면 그대로', async () => {
  const T = new Date(2026, 10, 17, 9, 0, 0).getTime();
  const mk = (id, pageNo, isNew, dueAt) => ({ id: id, kind: 'sentence', docId: 'D', pageNo: pageNo, front: 'f' + id, back: 'b',
    createdAt: T - 1000 * (100 - Number(id.slice(1))), sm2: isNew ? null : { reps: 2, interval: 1, ef: 2.5 }, dueAt: dueAt, introducedAt: isNew ? null : T - 9e7 });
  const cards = [mk('c1', 2, true), mk('c2', 9, true), mk('c3', 10, true), mk('c4', 11, false, T - 1000), mk('c5', 20, false, T - 2000), mk('c6', 12, true)];
  const store = {
    list: async () => cards.slice(),
    readLog: async () => ({}),
    queue: async (o) => {
      const due = cards.filter((c) => c.sm2 && c.dueAt <= o.dayEndMs).sort((a, b) => a.dueAt - b.dueAt);
      const fresh = cards.filter((c) => !c.sm2).slice(0, o.newPerDay);
      return { due: due, fresh: fresh, counts: { due: due.length, fresh: fresh.length, noBack: 0, noTr: 0 } };
    },
    review: async () => null, fillBack: async () => null
  };
  const f = CU.createReviewFlow({ store: store, now: () => T, newPerDay: () => 2 });
  await f.start({ docId: 'D', pages: [9, 12] });
  assert.deepEqual(f.line(), ['c4', 'c2', 'c3'], '★ 범위(9–12) 복습 c4 + 새 카드 몫 2 를 범위 안에서(c2·c3 — 책 전체 몫이면 c1·c2)');
  await f.start({ docId: 'D' });
  assert.deepEqual(f.line(), ['c5', 'c4', 'c1', 'c2'], '범위 없으면 queue 그대로');
  await f.start({ docId: 'D', pages: [30, 40] });
  assert.equal(f.view().state, 'empty', '범위 안 카드 0 → 빈 화면');
  const src = read('../js/ui/cards.js');
  assert.ok(/const pages = docId && params\.range \? \[Number\(params\.range\.from\), Number\(params\.range\.to\)\] : null;/.test(src));
});

/* ══ V9 입구 · 계층 · i18n · CSS ═══════════════════════════ */

test('V9 입구 셋 같은 범위 · 계층 · i18n 4언어 · CSS 48px·논리 속성', () => {
  // 입구: 서재 [⋯](읽던 장) · 11-3 [이 범위 복습](지금 고른 범위) · 13-2 범위 줄 [복습](그 범위)
  const su = read('../js/ui/summaries.js');
  assert.ok(/if \(a === 'review'\) \{ if \(S\.docId\) \{ const r = currentRange\(\); go\(reviewHash\(S\.docId, \{ from: r\.from, to: r\.to \}\)\); \} return; \}/.test(su));
  assert.match(read('../index.html'), /<button type="button" id="sumsReview" data-sa="review" data-i18n="summaries\.review"><\/button>/);
  assert.ok(/btn\('pl-review', 'planner\.review', 'review', \{ 'data-nav': reviewHash\(r\.docId, \{ from: r\.from, to: r\.to \}\) \}\)/.test(read('../js/ui/planner.js')));
  assert.ok(/export function presetSummariesRange\(docId, from, to\)/.test(su), '[모아 보기] → 11-3 의 그 범위');
  // 계층 — 묶음 화면은 파이프라인을 import 하지 않는다(sumServices 주입 · aiQuiz.make 에 넘김)
  const rv = read('../js/ui/review.js');
  assert.ok(!/from '\.\.\/ai\/pipeline\.js'/.test(rv));
  assert.ok(/pipeline: sv\.pipeline/.test(rv));
  assert.ok(!/makeQuiz\(/.test(strip(rv)), '파이프라인 makeQuiz 를 직접 부르지 않는다');
  // 16 개념도 — `[16-2]` 칸은 `ui/diagram.js` 의 조각 하나(`diagramControl`)뿐 · 묶음 화면이 파이프라인 `diagram(` 을 직접 부르지 않는다
  const rvCode = strip(rv).replace(/\/\/.*$/gm, '');
  assert.ok(/import \{ diagramControl \} from '\.\/diagram\.js'/.test(rv));
  assert.ok(!/\.diagram\(/.test(rvCode), '개념도 요청은 시트(ui/diagram.js)의 [개념도 그리기]·[다시 그리기]만');
  assert.equal((rvCode.match(/diagramControl\(/g) || []).length, 1, '개요 칸 한 곳');
  // i18n — 쓰는 키 4언어 · ar/fr 검토 표시
  const used = new Set();
  for (const f of ['../js/ui/review.js', '../js/ui/rangepick.js', '../js/ui/quiz.js']) for (const m of read(f).matchAll(/'((?:review|quiz\.ai|quiz\.badge\.ai|planner\.(?:form|range|err)|summaries\.review|library\.card\.(?:review|deleteConfirmAi))[a-zA-Z.]*)'/g)) used.add(m[1]);
  for (const k of ['library.card.review', 'library.card.deleteConfirmAi', 'summaries.review', 'planner.review', 'review.disclaimer', 'review.title']) used.add(k);
  assert.ok(used.size >= 40, String(used.size));
  for (const lang of LANGS) for (const k of used) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k], lang + ' ' + k);
  for (const f of ['../js/i18n/ar.js', '../js/i18n/fr.js']) assert.ok(/15-2 — spec 17-13[^\n]*\[검토 — Nour·운영자\]/.test(read(f)), f + ' 검토 표시');
  assert.equal(BUNDLES.ko['review.ai.weak'], '이 구간에서 믿을 만한 문항을 충분히 만들지 못했습니다.', '10-4 설계 문구');
  // CSS
  const css = read('../css/screens.css');
  assert.ok(/\.rv-row > button \{[^}]*min-block-size: var\(--tap\)/.test(css), '48px');
  const block = css.slice(css.indexOf('`[15-2 — spec 17-13 2 · 4]`'));
  assert.ok(block.length > 200);
  assert.ok(!/\b(margin|padding)-(left|right)\b|\b(left|right):|text-align:\s*(left|right)/.test(block), '논리 속성만(RTL 거울)');
  assert.ok(/\.quiz-badge-ai \{ background: var\(--c-notice-bg\)/.test(block), '🤖 다른 색 토큰');
});
