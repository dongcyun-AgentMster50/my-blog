/* ============================================================
   tests/aiquiz-15.test.mjs — 15-1 AI 출제 서비스: 입력 고르기(`text/review.js`) · 파이프라인 `makeQuiz` · 저장(`review/aiquiz.js`) · 다시 추출·삭제
   (spec 17-13 3-1 · 3-2 · 3-3 · 6 · 7 "15-1" 수용 기준 · 8 결정 15-D3·D4·D5·D6·D7)

   A1  ★ `passageFor` — 읽지 않은 쪽 문단 0 · `usedParaIds` 빠짐 · 저장 요약 문단 먼저(paraId·textHash) · 누적 ≤ 6,000자, 문단을 자르지 않음 ·
       제목·문항·보기·답·짧은 문단·참고문헌 빠짐 · `left` 정확
   A2  범위 도우미 — `rangeKey`·`parseRangeKey`·`aiSectionId`(`ai-p40-79`)·`aiRangeOf`·`sectionsInRange`·`readPagesIn`
   A3  ★ `makeQuiz`(가짜 provider) — 1호출 · 같은 입력 다시 → 0호출(`cacheHits`) · `byKind.quiz` +1(빈 행 키 무변) · 429 → 막힘·자동 재시도 0 ·
       capped·no-key → 보내지 않음 · 보내는 것 = paraId·pageNo·text 뿐 · 상한 넘침 → 뒤 문단부터 뺌 / 하나도 안 되면 too-big ·
       문항 0 → EMPTY(캐시 0 · 실패 기억 → [다시 시도]만) · 잘린 응답 → MISSING · 폐기 3/5 → weak, 재호출 0
   A4  ★ 번역·요약·설명 요청 본문 바이트 = HEAD(sha256 고정 — 15-1 이전 판이 낸 값)
   A5  ★ (fake-idb) 저장 — sectionId `ai-p40-79` · id 줄기 해시로 중복 0 · 원서 문항(`sec-III`)과 `docId_sectionId` 조회가 갈림 ·
       verified 를 rejected 로 덮지 않음 · `resetDerived` 뒤 `ai` 남고 `book` 지워짐 · `deleteDocument` 뒤 둘 다 지워짐 · 지운 문서에 쓰지 않음
   A6  ★ `make` 끝까지(fake-idb 쪽·읽은 쪽·저장 요약 + 진짜 파이프라인·가짜 fetch) — 요청 1건·본문에 읽은 쪽 문단만·요약 문단 먼저 · 저장 5 ·
       다시 누름 → 쓴 문단 빼고 다른 입력 · 다 쓰면 no-passage(0호출) · 읽지 않은 범위 → unread(0호출) · 근거 인용을 20 `findQuote` 가 찾음
   A7  계층 — `review/aiquiz.js` import 는 config·db·hash·text/* 만(`ai/`·`ui/`·`plan/` 0) · 파이프라인은 주입
   A8  ★ 15-1R 낮음-2 — 보냈지만 안 쓴 문단은 빼지 않고 뒤로(보낸 횟수 적은 문단 먼저) · 쪽마다 몫(지난 누름의 쪽 뒤로) ·
       `sentParaIds` 저장·세기 · 같은 보낸 목록은 한 번. (A3 에 낮음-3 — 원문 언어만 다름 → 다른 캐시 키)
   지어낸 문단만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

let realFetchCalls = 0;
globalThis.fetch = async () => { realFetchCalls++; throw new Error('호출 금지'); };

const db = await import('../js/db.js');
const R = await import('../js/text/review.js');
const Q = await import('../js/review/aiquiz.js');
const { createPipeline, QUIZ_JOB, QUIZ_KIND } = await import('../js/ai/pipeline.js');
const { createCache } = await import('../js/ai/cache.js');
const { REVIEW, AI, PLAN } = await import('../js/config.js');
const { localDay } = await import('../js/ai/provider.js');
const { findQuote } = await import('../js/text/anchor.js');
const { fromStored } = await import('../js/text/store.js');
const { describePage } = await import('../js/text/screen.js');
const { hashHex, normalizeForHash } = await import('../js/hash.js');
const { memDb, stubFetch, jsonRes, geminiOk, docItems, settingsOf, manualTimers, FAKE_KEY } = await import('./fixtures/ai-stubs-8a.mjs');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const T0 = new Date(2026, 10, 17, 10, 0, 0).getTime();
const DOC = 'D15';

async function reset() {
  for (const s of db.STORE_NAMES) await db.clearStore(s);
}

/* ── 지어낸 쪽 저장본 — 문단마다 한 줄 ─────────────────── */
function stored(docId, pageNo, paras) {
  const lines = [];
  const paragraphs = [];
  paras.forEach((p, k) => {
    const id = pageNo + ':p' + k;
    lines.push({ id: pageNo + ':' + k, text: p.text, paraId: id, role: p.kind === 'heading' ? 'heading' : 'body' });
    paragraphs.push({ id: id, kind: p.kind || 'body', lineIds: [pageNo + ':' + k] });
  });
  return { docId: docId, pageNo: pageNo, algoVersion: 1, lines: lines, paragraphs: paragraphs, regions: [] };
}

const LONG = (s) => s + ' This sentence pads the paragraph so that it is comfortably longer than sixty characters.';
const BOOK = {
  40: [{ kind: 'heading', text: 'Chapter 5. Infections' },
    { text: LONG('Fever was noted in 3 of 10 patients during the first week of illness.') },
    { text: LONG('The rash resolved within two weeks of starting the treatment course.') }],
  41: [{ kind: 'question', text: '5-1. Which of the following is the most likely diagnosis in this patient?' },
    { kind: 'option', text: 'A. Viral exanthem caused by a common seasonal virus in young adults' },
    { text: LONG('The usual starting dose is 7.5 mg/kg given intravenously every 12 hours.') },
    { text: 'Too short to be a source.' }],
  42: [{ text: LONG('UNREAD PAGE paragraph about cultures that must never be sent to the model.') }],
  43: [{ text: LONG('Blood cultures should be drawn before antibiotics whenever this is feasible.') },
    { text: 'Smith J et al. Fever in adults. N Engl J Med. 2024;390:12. [PMID: 12345678]' },
    { text: LONG('Lactate above 4 mmol/L defines a high-risk group that needs close monitoring.') },
    { kind: 'list', text: LONG('• Persistent hypotension despite fluids is a sign of septic shock.') }]
};

async function seed(o) {
  const x = o || {};
  await db.put('documents', { id: DOC, title: 'Synthetic', fileHash: 'fh-' + DOC, lastOpenedAt: T0, extraction: { done: true } });
  for (const [p, paras] of Object.entries(BOOK)) await db.put('pages', stored(DOC, Number(p), paras));
  if (x.read !== false) await db.put('progress', { docId: DOC, sectionId: PLAN.READ_SECTION, ranges: x.ranges || [[40, 41], [43, 43]], pages: 3, updatedAt: T0 });
}

/* ── 흉내 Gemini(출제 갈래 — `responseSchema` 에 `questions`) ── */
const OPT = ['First choice', 'Second choice', 'Third choice', 'Fourth choice', 'Fifth choice'];
function quizFrom(items, o) {
  const x = o || {};
  const qs = [];
  for (let i = 0; i < (x.count == null ? 5 : x.count); i++) {
    const it = items[i % items.length];
    const words = it.text.split(' ').slice(Math.floor(i / items.length) * 2);   // `[15-2b]` 다른 자리는 낱말 경계에서(낱말 가운데 인용은 mid-word 폐기)
    const ev = words.slice(0, 8).join(' ');
    const bad = x.bad && x.bad.indexOf(i) >= 0;
    qs.push({
      stem: 'Synthetic question ' + i + ' about ' + it.paraId + '?',
      options: OPT.map((t, k) => ({ letter: 'ABCDE'[k], text: t + ' ' + 'vwxyz'[i % 5] })),   // 보기 글에 숫자 없음(숫자 거름은 Q6)
      answer: 'A',
      evidence: bad ? 'An invented sentence that does not appear anywhere' : ev,
      evidenceParaId: it.paraId,
      explanation: { tr: '합성 해설 ' + 'abcde'[i % 5], src: 'Synthetic explanation.' }
    });
  }
  return { questions: qs, notes: '' };
}
function echoQuiz(state) {
  return (url, init) => {
    const s = state.v || {};
    if (s.status) return jsonRes(s.status, { error: { code: s.status, status: s.status === 429 ? 'RESOURCE_EXHAUSTED' : 'X', message: 'mock' } });
    const body = JSON.parse(init.body);
    assert.ok(body.generationConfig.responseSchema.properties.questions, '출제 갈래는 responseSchema 의 questions');
    const items = docItems(init);
    const text = JSON.stringify(s.empty ? { questions: [], notes: 'no' } : quizFrom(items, s));
    if (s.cut) return jsonRes(200, { candidates: [{ content: { parts: [{ text: text.slice(0, Math.floor(text.length * 0.6)) }] }, finishReason: 'MAX_TOKENS' }], usageMetadata: {} });
    return jsonRes(200, geminiOk(text));
  };
}
function rig(over) {
  const o = over || {};
  const mdb = memDb();
  const timers = manualTimers();
  const cache = createCache({ db: mdb, now: () => T0 });
  const state = { v: o.mock || {} };
  const fetch = stubFetch(o.handler || echoQuiz(state));
  const p = createPipeline({
    fetch: fetch, db: mdb, cache: cache, getKey: () => (o.key === undefined ? FAKE_KEY : o.key),
    getSetting: settingsOf(o.settings), now: () => T0, isOnline: () => true,
    setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  const usage = () => mdb.usageRow(localDay(T0)) || null;
  return { p, fetch, mdb, usage, state };
}

const ITEMS = [
  { paraId: '40:p1', pageNo: 40, text: LONG('Fever was noted in 3 of 10 patients during the first week of illness.') },
  { paraId: '40:p2', pageNo: 40, text: LONG('The rash resolved within two weeks of starting the treatment course.') }
];

/* ══ A1 passageFor ═══════════════════════════════════ */

const PARAS = [];
for (const [p, list] of Object.entries(BOOK)) list.forEach((x, k) => PARAS.push({ paraId: p + ':p' + k, pageNo: Number(p), kind: x.kind || 'body', text: x.text }));

test('A1 ★ passageFor — 읽은 쪽만 · 쓴 문단 빠짐 · 요약 먼저 · ≤ budget 자르지 않음 · 제목·문항·보기·짧은·참고문헌 빠짐 · left', () => {
  const all = R.passageFor({ paras: PARAS, readRanges: [[40, 41], [43, 43]] });
  assert.deepEqual(all.items.map((i) => i.paraId), ['40:p1', '43:p0', '41:p2', '40:p2', '43:p2', '43:p3'],
    '★ 42쪽(읽지 않음) 0 · 제목·문항·보기·짧은 문단·참고문헌 0 · list 는 들어감 · 쪽마다 돌림(15-1R — 40·43·41 → 40·43 → 43)');
  assert.equal(all.fresh, 0);
  assert.equal(all.left, 0);
  assert.equal(all.candidates, 6);
  assert.equal(all.chars, all.items.reduce((n, i) => n + R.charCount(i.text), 0));
  assert.ok(all.chars <= 6000);
  for (const it of all.items) assert.deepEqual(Object.keys(it), ['paraId', 'pageNo', 'text']);
  // 읽은 쪽이 없으면 0
  assert.deepEqual(R.passageFor({ paras: PARAS, readRanges: [] }).items, []);
  assert.deepEqual(R.passageFor({ paras: PARAS }).items, [], '읽은 쪽 구간이 없으면 아무것도 고르지 않는다');
  assert.deepEqual(R.passageFor({ paras: PARAS, readRanges: [[42, 42]] }).items.map((i) => i.paraId), ['42:p0']);
  // 쓴 문단 빠짐
  const used = R.passageFor({ paras: PARAS, readRanges: [[40, 43]], usedParaIds: new Set(['40:p1', '43:p2']) });
  assert.ok(!used.items.some((i) => i.paraId === '40:p1' || i.paraId === '43:p2'));
  assert.equal(R.passageFor({ paras: PARAS, readRanges: [[40, 43]], usedParaIds: ['40:p1'] }).items[0].paraId, '40:p2', '배열도 받는다');
  // 요약 문단 먼저 — paraId 로 · textHash 로
  const s1 = R.passageFor({ paras: PARAS, readRanges: [[40, 41], [43, 43]], summarized: new Set(['43:p2']) });
  assert.equal(s1.items[0].paraId, '43:p2', '★ 저장 요약이 있는 문단 먼저');
  assert.deepEqual(s1.items.slice(1).map((i) => i.paraId), ['40:p1', '43:p0', '41:p2', '40:p2', '43:p3'], '나머지는 쪽에 고르게(돌림)');
  const hashed = PARAS.map((p) => (p.paraId === '41:p2' ? Object.assign({}, p, { textHash: 'fnv:abc:1' }) : p));
  assert.equal(R.passageFor({ paras: hashed, readRanges: [[40, 43]], summarized: ['fnv:abc:1'] }).items[0].paraId, '41:p2', 'textHash 일치');
  // 예산 — 문단을 자르지 않는다 · 넘치면 다음 문단
  const len = (id) => R.charCount(PARAS.find((p) => p.paraId === id).text);
  const budget = len('40:p1') + len('41:p2') + 5;
  const tight = R.passageFor({ paras: PARAS, readRanges: [[40, 41], [43, 43]], budget: budget, summarized: ['41:p2'] });
  assert.deepEqual(tight.items.map((i) => i.paraId), ['41:p2', '40:p1'], '요약 문단 → 40:p1 → (40:p2 넘침 → 건너뜀)…');
  assert.ok(tight.chars <= budget);
  for (const it of tight.items) assert.equal(it.text, PARAS.find((p) => p.paraId === it.paraId).text.replace(/\s+/g, ' ').trim(), '문단 글 그대로(자르지 않음)');
  assert.equal(tight.left, 4, '★ left = 담지 못한 후보 수');
  // 혼자 예산보다 긴 문단은 건너뛰고 짧은 것을 담는다
  const big = { paraId: '40:p9', pageNo: 40, kind: 'body', text: 'x '.repeat(4000).trim() };
  const withBig = R.passageFor({ paras: [big].concat(PARAS), readRanges: [[40, 40]] });
  assert.deepEqual(withBig.items.map((i) => i.paraId), ['40:p1', '40:p2']);
  assert.equal(withBig.left, 1);
  // 기본 예산 = 6,000
  const many = Array.from({ length: 80 }, (_, k) => ({ paraId: '40:q' + k, pageNo: 40, kind: 'body', text: LONG('Paragraph number ' + k + ' says something.') }));
  const m = R.passageFor({ paras: many, readRanges: [[40, 40]] });
  assert.ok(m.chars <= 6000 && m.chars > 5800, '기본 예산 6,000자 가까이 채움');
  assert.equal(m.items.length + m.left, 80);
  // 빈 id·쪽 없음은 후보 아님
  assert.equal(R.passageFor({ paras: [{ paraId: null, pageNo: 40, text: LONG('x') }, { paraId: 'a', text: LONG('y') }], readRanges: [[1, 99]] }).candidates, 0);
});

/* ══ A2 범위 도우미 ════════════════════════════════════ */

test('A2 범위 도우미 — rangeKey·aiSectionId(ai-p40-79)·aiRangeOf·sectionsInRange·readPagesIn', () => {
  assert.equal(R.rangeKey(40, 79), '40-79');
  assert.equal(R.rangeKey(79, 40), '40-79', '뒤집혀도');
  assert.equal(R.rangeKey('x', 3), '');
  assert.deepEqual(R.parseRangeKey('40-79'), [40, 79]);
  assert.equal(R.parseRangeKey('40'), null);
  assert.equal(R.aiSectionId(40, 79), 'ai-p40-79', '★ AI 섹션 id');
  assert.deepEqual(R.aiRangeOf('ai-p40-79'), [40, 79]);
  assert.equal(R.aiRangeOf('sec-III'), null);
  assert.equal(R.aiRangeOf('III'), null);
  assert.ok(!R.aiSectionId(1, 2).startsWith('sec-'), '원서 파서 id 와 겹치지 않는다');
  const idx = [{ sectionId: 'I', startPage: 10, endPage: 30 }, { sectionId: 'II', startPage: 35, endPage: 45 },
    { sectionId: 'III', startPage: 78, endPage: 90 }, { sectionId: 'IV', startPage: 100, endPage: 120 }, { sectionId: 'V', startPage: null },
    { sectionId: 'ai-p40-79', startPage: 40, endPage: 79 }];
  assert.deepEqual(R.sectionsInRange(idx, 40, 79).map((e) => e.sectionId), ['II', 'III']);
  assert.deepEqual(R.sectionsInRange(idx, 31, 34), []);
  assert.equal(R.readPagesIn([[40, 41], [43, 43]], 40, 45), 3);
  assert.equal(R.readPagesIn([], 1, 10), 0);
});

/* ══ A3 makeQuiz ══════════════════════════════════════ */

test('A3 ★ makeQuiz — 1호출 · 같은 입력 0호출 · byKind.quiz · 보내는 것 · 429·capped·no-key', async () => {
  const r = rig();
  const a = await r.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC, domain: 'medical' });
  assert.equal(a.calls, 1);
  assert.equal(r.fetch.calls.length, 1);
  assert.equal(a.results[0].state, 'ready');
  const v = a.results[0].value;
  assert.deepEqual([v.total, v.verified, v.rejected, v.weak], [5, 5, 0, false]);
  assert.deepEqual(a.sent, ['40:p1', '40:p2']);
  assert.deepEqual(a.langs, ['ko', 'en']);
  const body = JSON.parse(r.fetch.calls[0].init.body);
  assert.equal(body.generationConfig.maxOutputTokens, 4700);
  assert.deepEqual(docItems(r.fetch.calls[0].init), ITEMS.map((i) => ({ paraId: i.paraId, pageNo: i.pageNo, text: i.text })), '★ 보내는 것은 문단 id·쪽·글뿐');
  const row = r.usage();
  assert.equal(row.byKind.quiz, 1, '★ byKind.quiz +1');
  assert.equal(row.calls, 1);
  assert.deepEqual(AI.USAGE_KINDS, ['translate', 'summarize', 'quiz', 'grade', 'table', 'verify'], '7a 고정 키 무변');
  // 같은 입력 다시 → 0호출
  const b = await r.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.equal(b.calls, 0);
  assert.equal(r.fetch.calls.length, 1);
  assert.equal(b.results[0].cached, true);
  assert.deepEqual(b.results[0].value, v, '같은 판정');
  assert.equal(r.usage().cacheHits, 1);
  // 다른 필드는 옮겨 담지 않는다 · 다른 문단이면 새 키
  const c = await r.p.makeQuiz([Object.assign({ note: 'MY NOTE', gist: 'GIST' }, ITEMS[0])], { src: 'en', target: 'ko', docId: DOC });
  assert.equal(c.calls, 1);
  assert.ok(!/MY NOTE|GIST/.test(r.fetch.calls[1].init.body));
  assert.equal(r.usage().byKind.quiz, 2);
  // 대상 언어가 다르면 다른 키
  const d = await r.p.makeQuiz(ITEMS, { src: 'en', target: 'ar', docId: DOC });
  assert.equal(d.calls, 1);
  // 같은 언어도 만든다(해설 하나)
  const e = await r.p.makeQuiz(ITEMS, { src: 'en', target: 'en', docId: DOC });
  assert.equal(e.calls, 1);
  assert.deepEqual(e.langs, ['en']);
  assert.deepEqual(Object.keys(e.results[0].value.questions[0].explanation), ['tr']);
  // 15-1R 낮음-3 — 원문 언어만 다름(대상 ko 그대로) → 다른 키(해설 원문 언어가 다르다) · 1호출
  const f = await r.p.makeQuiz(ITEMS, { src: 'fr', target: 'ko', docId: DOC });
  assert.equal(f.calls, 1, '★ 캐시 키에 원문 언어(l=) — 빠지면 en 해설이 fr 자리로 돌아온다');
  assert.deepEqual(f.langs, ['ko', 'fr']);
  // 언어 없음 · 빈 입력 → 0
  assert.equal((await r.p.makeQuiz(ITEMS, { src: 'xx', target: 'ko', docId: DOC })).status, 'unsupported-lang');
  assert.equal((await r.p.makeQuiz([], { src: 'en', target: 'ko', docId: DOC })).status, 'empty');
  assert.equal(r.fetch.calls.length, 5);

  // 429 → 막힘 · 다시 불러도 보내지 않음(자동 재시도 0)
  const t = rig({ mock: { status: 429 } });
  const x = await t.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.equal(x.results[0].state, 'blocked');
  assert.equal(t.p.state(), 'exhausted');
  assert.equal(t.fetch.calls.length, 1);
  const y = await t.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.equal(y.calls, 0);
  assert.equal(y.results[0].state, 'blocked');
  assert.equal(t.fetch.calls.length, 1, '★ 429 뒤 자동 재시도 0');
  // capped
  const cp = rig({ settings: { 'ai.dailyCap': 1 } });
  await cp.mdb.put('usage', { day: localDay(T0), calls: 1, byKind: {} });
  const z = await cp.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual([z.calls, z.results[0].state, z.results[0].code, cp.fetch.calls.length], [0, 'blocked', 'capped', 0]);
  // no-key
  const nk = rig({ key: '' });
  const w = await nk.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual([w.calls, w.results[0].state, w.results[0].code, nk.fetch.calls.length], [0, 'blocked', 'no-key', 0]);
  assert.equal(realFetchCalls, 0);
});

test('A3b makeQuiz — 상한 넘침은 뒤 문단부터 뺌 · too-big · 문항 0 → EMPTY(실패 기억) · 잘린 응답 · 폐기 3/5 → weak, 재호출 0', async () => {
  // 글자 상한 — 둘째 문단을 뺀다(자르지 않는다)
  const len = ITEMS[0].text.length;
  const s = rig({ settings: { 'ai.maxReqChars': len + 10 } });
  const a = await s.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual(a.sent, ['40:p1']);
  assert.equal(docItems(s.fetch.calls[0].init).length, 1);
  assert.equal(docItems(s.fetch.calls[0].init)[0].text, ITEMS[0].text, '문단은 통째로');
  // 하나도 안 되면 too-big · 0호출
  const tb = rig({ settings: { 'ai.maxReqChars': 50 } });
  const b = await tb.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual([b.status, b.calls, tb.fetch.calls.length], ['too-big', 0, 0]);
  // 토큰 상한(입력 + 4,700 > 8,000) — 넓은 글자(한글)는 2자/토큰
  const wide = Array.from({ length: 4 }, (_, k) => ({ paraId: '9:p' + k, pageNo: 9, text: '가'.repeat(1400) }));
  const tw = rig();
  const c = await tw.p.makeQuiz(wide, { src: 'ko', target: 'ar', docId: DOC });
  assert.ok(c.sent.length < 4 && c.sent.length >= 1, '토큰 상한 안으로 줄였다');
  assert.equal(tw.fetch.calls.length, 1);
  // 문항 0 → EMPTY · 캐시 0 · 다시 불러도 보내지 않음 · retry 면 보냄
  const em = rig({ mock: { empty: true } });
  const e1 = await em.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual([e1.results[0].state, e1.results[0].code], ['failed', 'EMPTY']);
  assert.equal(em.mdb.size('aiCache'), 0);
  const e2 = await em.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.equal(em.fetch.calls.length, 1, '실패 기억 — [다시 시도] 전에는 보내지 않는다');
  assert.equal(e2.results[0].state, 'failed');
  em.state.v = {};
  const e3 = await em.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC, retry: true });
  assert.equal(em.fetch.calls.length, 2);
  assert.equal(e3.results[0].state, 'ready');
  // 잘린 응답 → MISSING · 캐시 0
  const ct = rig({ mock: { cut: true } });
  const k1 = await ct.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  assert.deepEqual([k1.results[0].state, k1.results[0].code], ['failed', 'MISSING']);
  assert.equal(ct.mdb.size('aiCache'), 0);
  // 폐기 3/5 → weak · 재호출 0(값을 돌려줄 뿐)
  const wk = rig({ mock: { bad: [1, 3, 4] } });
  const k2 = await wk.p.makeQuiz(ITEMS, { src: 'en', target: 'ko', docId: DOC });
  const v = k2.results[0].value;
  assert.deepEqual([v.verified, v.rejected, v.weak], [2, 3, true]);
  assert.equal(wk.fetch.calls.length, 1, '★ 폐기율 > 50% 여도 자동 재호출 0');
  assert.equal(QUIZ_JOB.maxChunks, 1);
  assert.equal(QUIZ_KIND, 'quiz');
});

/* ══ A4 번역·요약·설명 바이트 ═══════════════════════════ */

test('A4 ★ 번역·요약·설명 요청 본문 바이트 = HEAD(15-1 이전 판의 sha256)', async () => {
  const bodies = [];
  const fresh = () => {
    const mdb = memDb();
    const t = manualTimers();
    const fetch = stubFetch((url, init) => { bodies.push(init.body); return jsonRes(400, { error: { code: 400, message: 'x' } }); });
    return createPipeline({ fetch, db: mdb, cache: createCache({ db: mdb, now: () => 1 }), getKey: () => FAKE_KEY,
      getSetting: settingsOf({ 'ai.dailyCap': 1000 }), now: () => 1, isOnline: () => true, setTimer: t.set, clearTimer: t.clear, listen: false });
  };
  const L = { src: 'en', target: 'ko', domain: 'medical' };
  await fresh().translate([{ text: 'Fever was noted in 3 of 10 patients.' }, { text: 'The rash resolved >>> within two weeks.' }], Object.assign({ docId: 'D15', kind: 'translate' }, L));
  await fresh().summarize(['Fever was noted in 3 of 10 patients during the first week. The rash resolved within two weeks of treatment.'], Object.assign({ docId: 'D15' }, L));
  await fresh().explain({ sentence: 'Fever was noted in 3 of 10 patients.', context: 'Fever was noted in 3 of 10 patients. The rash resolved within two weeks.' }, Object.assign({ docId: 'D15' }, L));
  assert.deepEqual(bodies.map((b) => createHash('sha256').update(b).digest('hex')), [
    '827ada1f0344847ff233c9f93694ce4528603b667b3690aced740e775cb1969c',
    '4a1faf3af0263f5c31803588fa2f5d78fa6403d8997fa02334fddfeb39dd51bd',
    '85619f4566c4bb295a54c83391cc59a60578c1c94b9bd98327888b76e3a7fe6b'
  ]);
});

/* ══ A5 저장 ══════════════════════════════════════════ */

function grounded(n, o) {
  const x = o || {};
  return {
    questions: Array.from({ length: n }, (_, i) => ({
      status: x.status || 'verified', reason: x.status === 'rejected' ? 'evidence' : undefined,
      stem: (x.stem || 'Stem ') + i + '?', options: OPT.map((t, k) => ({ letter: 'ABCDE'[k], text: t })), answer: { letters: ['A'] },
      explanation: { tr: '해설', src: 'Explanation' }, evidence: 'quote ' + i,
      grounding: x.status === 'rejected' ? [] : [{ quote: 'quote ' + i, pageNo: 40, paraId: '40:p' + i }], pageNo: 40, paraIds: ['40:p' + i]
    })),
    total: n, verified: n, rejected: 0, weak: false
  };
}

test('A5 ★ 저장 — ai-p40-79 · 줄기 해시 id 중복 0 · 원서와 갈림 · resetDerived 뒤 ai 남음 · deleteDocument 뒤 다 지움', async () => {
  await reset();
  await seed();
  const svc = Q.createAiQuiz({ db: db, now: () => T0 });
  await db.put('questions', { id: DOC + ':sec-III:q1', docId: DOC, sectionId: 'sec-III', source: 'book', status: 'verified', number: 1, stem: 'Book stem', options: [], answer: { letters: ['B'] } });
  const meta = { src: 'en', target: 'ko', domain: 'medical', provider: 'gemini', model: 'm' };
  const s1 = await svc.save(DOC, 40, 79, grounded(5), meta);
  assert.deepEqual([s1.wrote, s1.verified, s1.rejected], [5, 5, 0]);
  const recs = await svc.list(DOC, 40, 79);
  assert.equal(recs.length, 5);
  for (const r of recs) {
    assert.equal(r.sectionId, 'ai-p40-79', '★ sectionId');
    assert.match(r.id, /^D15:ai-p40-79:ai[0-9a-f]{8}$/, 'id = docId:sectionId:ai + 줄기 해시 8');
    assert.equal(r.source, 'ai');
    assert.equal(r.hasFigure, false);
    assert.equal(r.promptVersion, REVIEW.PROMPT_VERSION);
    assert.deepEqual(r.langs, { tr: 'ko', src: 'en' });
    assert.deepEqual(Object.keys(r.explanation), ['tr', 'src']);
    assert.equal(r.createdAt, T0);
  }
  assert.deepEqual(recs.map((r) => r.number), [1, 2, 3, 4, 5], '만든 순서');
  const h = (await hashHex(normalizeForHash('Stem 0?'))).replace(/^[a-z0-9]+:/, '').slice(0, 8);
  assert.equal(recs[0].id, 'D15:ai-p40-79:ai' + h);
  // 같은 응답 다시 → 중복 0 · 번호·시각 그대로
  const svc2 = Q.createAiQuiz({ db: db, now: () => T0 + 1000 });
  await svc2.save(DOC, 40, 79, grounded(5), meta);
  const again = await svc2.list(DOC, 40, 79);
  assert.equal(again.length, 5, '★ 중복 0');
  assert.deepEqual(again.map((r) => [r.number, r.createdAt]), recs.map((r) => [r.number, T0]));
  // verified 를 rejected 로 덮지 않음 · 새 rejected 는 저장(출제 목록엔 없음)
  const rej = await svc2.save(DOC, 40, 79, { questions: grounded(1, { status: 'rejected' }).questions.concat(grounded(1, { status: 'rejected', stem: 'Other ' }).questions) }, meta);
  assert.deepEqual([rej.wrote, rej.rejected], [1, 1]);
  assert.equal((await svc2.list(DOC, 40, 79)).length, 5, 'rejected 는 출제하지 않는다');
  const all = await svc2.list(DOC, 40, 79, { all: true });
  assert.equal(all.length, 6);
  assert.equal(all.find((r) => r.status === 'rejected').reason, 'evidence');
  assert.equal(all.find((r) => r.status === 'rejected').number, 6);
  // 원서 문항과 docId_sectionId 조회가 갈린다
  const bySec = async (sid) => { const out = []; await db.iterate('questions', { index: 'docId_sectionId', query: IDBKeyRange.only([DOC, sid]) }, (q) => { out.push(q.source); }); return out; };
  assert.deepEqual(await bySec('sec-III'), ['book']);
  assert.ok((await bySec('ai-p40-79')).every((s) => s === 'ai'));
  assert.equal(await svc2.countForDoc(DOC), 6);
  // usedParaIds — verified·rejected 의 문단
  assert.deepEqual(Array.from(await svc2.usedParaIds(DOC, 40, 79)).sort(), ['40:p0', '40:p1', '40:p2', '40:p3', '40:p4']);
  // 다시 추출 — ai 남고 book·pages 지워짐
  assert.equal(db.keepsOnReset({ source: 'ai' }, 'questions'), true);
  assert.equal(db.keepsOnReset({ source: 'book' }, 'questions'), false);
  assert.equal(db.keepsOnReset({ source: 'ai' }, 'pages'), false);
  const rs = await db.resetDerived(DOC);
  assert.equal(rs.reset, true);
  assert.equal(rs.counts.questions, 1, '원서 문항만 지웠다');
  assert.deepEqual(await bySec('sec-III'), []);
  assert.equal((await svc2.list(DOC, 40, 79, { all: true })).length, 6, '★ AI 문항은 남는다(15-D6)');
  assert.equal(await db.count('pages'), 0);
  // 문서 삭제 — 함께 지운다(15-D7)
  await db.deleteDocument(DOC);
  assert.equal((await svc2.list(DOC, 40, 79, { all: true })).length, 0, '★ 문서 삭제는 AI 문항도 지운다');
  // 지운 문서에 쓰지 않는다
  assert.equal(await svc2.save(DOC, 40, 79, grounded(2), meta), null);
  assert.equal(await db.count('questions'), 0);
});

/* ══ A6 make 끝까지 ═══════════════════════════════════ */

test('A6 ★ make — 1건 · 읽은 쪽 문단만 · 요약 먼저 · 저장 5 · 다시 → 다른 입력 · no-passage · unread · findQuote', async () => {
  await reset();
  await seed();
  // 43쪽 둘째 본문 문단에 저장 요약(11) — 해시는 다른 글(paraId 로 맞는다)
  await db.put('annotations', { id: 'ann:s1', kind: 'summary', docId: DOC, pageNo: 43, anchor: { pageNo: 43, paraId: '43:p2', textHash: 'fnv:0:0' }, target: 'ko' });
  const svc = Q.createAiQuiz({ db: db, now: () => T0 });
  const r = rig();
  const base = { docId: DOC, a: 40, b: 43, pipeline: r.p, src: 'en', target: 'ko', domain: 'medical' };
  const pv = await svc.passage(DOC, 40, 43);
  assert.deepEqual([pv.readPages, pv.pages, pv.sectionId, pv.left], [3, 4, 'ai-p40-43', 0]);
  const m1 = await svc.make(base);
  assert.equal(m1.calls, 1);
  assert.equal(r.fetch.calls.length, 1, '★ 요청 1건');
  const sent = docItems(r.fetch.calls[0].init);
  assert.deepEqual(sent.map((i) => i.paraId), ['43:p2', '40:p1', '43:p0', '41:p2', '40:p2', '43:p3'], '★ 요약 문단 먼저 → 쪽에 고르게');
  assert.ok(sent.every((i) => [40, 41, 43].includes(i.pageNo)), '★ 읽은 쪽 문단만');
  assert.ok(!r.fetch.calls[0].init.body.includes('UNREAD PAGE'), '★ 읽지 않은 쪽 글 0');
  assert.ok(!/PMID|Chapter 5|most likely diagnosis/.test(r.fetch.calls[0].init.body), '참고문헌·제목·문항 0');
  assert.deepEqual([m1.total, m1.verified, m1.rejected, m1.weak], [5, 5, 0, false]);
  assert.deepEqual([m1.saved.wrote, m1.saved.verified], [5, 5], '★ 저장 5');
  const recs = await svc.list(DOC, 40, 43);
  assert.equal(recs.length, 5);
  assert.equal(recs[0].provider, 'gemini');
  assert.equal(recs[0].model, AI.DEFAULT_MODEL.gemini);
  assert.equal(recs[0].domain, 'medical');
  // 근거 인용 → 20 findQuote 가 그 쪽에서 찾는다
  for (const q of recs) {
    const row = await db.get('pages', [DOC, q.pageNo]);
    const hit = findQuote(describePage(fromStored(row)), { exact: q.evidence });
    assert.ok(hit && hit.how === 'page', '★ 근거 인용을 인용 찾기로 다시 찾는다: ' + q.id);
    assert.equal(q.grounding[0].paraId, q.paraIds[0]);
  }
  // 다시 누름 → 쓴 문단 빼고 다른 입력(1호출)
  const m2 = await svc.make(base);
  assert.equal(m2.calls, 1);
  const sent2 = docItems(r.fetch.calls[1].init).map((i) => i.paraId);
  assert.deepEqual(sent2, ['43:p3'], '쓴 문단 다섯을 뺐다');
  assert.equal((await svc.list(DOC, 40, 43)).length, 10, '새 다섯(같은 문단의 다른 자리) 더해짐');
  // 다 쓰면 no-passage · 0호출
  const m3 = await svc.make(base);
  assert.deepEqual([m3.status, m3.calls, r.fetch.calls.length], ['no-passage', 0, 2]);
  // 읽지 않은 범위 → unread · 0호출
  const m4 = await svc.make(Object.assign({}, base, { a: 42, b: 42 }));
  assert.deepEqual([m4.status, m4.calls, m4.readPages, r.fetch.calls.length], ['unread', 0, 0, 2]);
  // 파이프라인 없음 · 범위 틀림
  assert.equal((await svc.make({ docId: DOC, a: 40, b: 43 })).status, 'no-pipeline');
  assert.equal((await svc.make(Object.assign({}, base, { a: 'x' }))).status, 'bad-range');
  // 예산 — 단추 아래 "약 n자 · 남은 문단 m"
  const svc3 = Q.createAiQuiz({ db: db, now: () => T0, readRanges: async () => [[40, 41]] });
  await db.clearStore('questions');
  const pv3 = await svc3.passage(DOC, 40, 43, { budget: 200 });
  assert.equal(pv3.items.length, 1);
  assert.equal(pv3.left, 2);
  assert.equal(pv3.readPages, 2, '주입한 읽은 쪽(13-1 readLog.readRanges 자리)');
  // textHash 로 요약 맞추기(paraId 가 바뀐 재추출 뒤)
  const para41 = (await svc.loadParas(DOC, 41, 41)).find((p) => p.paraId === '41:p2');
  const th = await hashHex(normalizeForHash(para41.text));
  await db.put('annotations', { id: 'ann:s2', kind: 'summary', docId: DOC, pageNo: 41, anchor: { pageNo: 41, paraId: 'OLD:p9', textHash: th }, target: 'ko' });
  const pv4 = await svc.passage(DOC, 40, 43);
  assert.deepEqual(pv4.items.slice(0, 2).map((i) => i.paraId), ['41:p2', '43:p2'], '해시로 맞은 요약 문단도 먼저(쪽 순)');
  assert.equal(realFetchCalls, 0);
});

/* ══ A8 15-1R 낮음-2 — 보냈지만 안 쓴 문단은 뒤로 · 쪽에 고르게 ═══ */

test('A8 ★ 15-1R — 보낸 횟수 적은 문단 먼저(빼지 않음) · 읽은 쪽에 고르게 · sentParaIds 저장·세기 · 같은 목록 한 번', async () => {
  // 순수 — 40쪽 × 쪽마다 4문단(지어낸 글), 한 번에 약 10문단
  const many = [];
  for (let p = 1; p <= 40; p++) for (let k = 0; k < 4; k++) many.push({ paraId: p + ':p' + k, pageNo: p, kind: 'body', text: LONG('Page ' + String(p).padStart(2, '0') + ' paragraph ' + k + ' text.') });
  const per = R.charCount(many[0].text);
  const budget = per * 10 + 5;
  const one = R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget });
  const pages1 = one.items.map((i) => i.pageNo);
  assert.equal(one.items.length, 10);
  assert.equal(new Set(pages1).size, 10, '쪽마다 몫 — 한 쪽에서 둘 이상 담지 않는다(첫 돌림)');
  assert.ok(Math.max.apply(null, pages1) >= 30 && Math.min.apply(null, pages1) === 1, '★ 앞 쪽만 아니라 범위 전체(1…≥30)');
  assert.equal(one.fresh, 150);
  // 보낸 10문단 중 2개만 쓰임 → 나머지 8개는 빠지지 않고 뒤로
  const sent = new Map(one.items.map((i) => [i.paraId, 1]));
  const used = one.items.slice(0, 2).map((i) => i.paraId);
  const two = R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget, usedParaIds: used, sent: sent });
  assert.ok(two.items.every((i) => !sent.has(i.paraId)), '★ 아직 안 보낸 문단 먼저 — 보낸 것 되풀이 0');
  assert.equal(two.candidates, 160 - 2, '보냈지만 안 쓴 8문단은 후보에 남는다(빼지 않음)');
  const pages2 = two.items.map((i) => i.pageNo);
  assert.ok(pages2.every((p) => pages1.indexOf(p) < 0), '★ 쪽마다 몫 — 지난 누름이 고른 쪽은 이번엔 뒤로(겹침 0)');
  const sent3 = new Map(sent);
  for (const i of two.items) sent3.set(i.paraId, 1);
  const three = R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget, usedParaIds: used, sent: sent3 });
  assert.equal(new Set(pages1.concat(pages2, three.items.map((i) => i.pageNo))).size, 30, '3번 누름 = 서로 다른 30쪽');
  // 모두 한 번씩 보낸 뒤에야 보낸 문단이 다시 돈다
  const allSent = new Map(many.map((p) => [p.paraId, 1]));
  allSent.set('5:p0', 2);
  const late = R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget, sent: allSent });
  assert.equal(late.items.length, 10);
  assert.ok(!late.items.some((i) => i.paraId === '5:p0'), '두 번 보낸 문단은 한 번 보낸 문단 뒤');
  assert.equal(late.fresh, 0);
  // 객체 꼴도 받는다
  assert.equal(R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget }).items[0].paraId, '1:p0');
  // 같은 쪽 안(쪽 몫이 같음)에서도 보낸 횟수 적은 문단 먼저 — 읽기 순서로는 p0 이 앞
  const same = [{ paraId: 'x:p0', pageNo: 7, kind: 'body', text: LONG('Alpha') }, { paraId: 'x:p1', pageNo: 7, kind: 'body', text: LONG('Bravo') }];
  const pick = R.passageFor({ paras: same, readRanges: [[7, 7]], budget: R.charCount(same[0].text) + 1, sent: { 'x:p0': 1 } });
  assert.deepEqual(pick.items.map((i) => i.paraId), ['x:p1'], '★ 보낸 문단은 뒤로(빼지 않음 — 후보 2)');
  assert.equal(pick.candidates, 2);
  const obj = R.passageFor({ paras: many, readRanges: [[1, 40]], budget: budget, sent: { '1:p0': 1 } });
  assert.ok(obj.items.every((i) => i.pageNo !== 1), '객체 꼴 — 보낸 문단이 있는 쪽은 이번 돌림 뒤로');

  // 서비스 — sentParaIds 저장 · 세기 · 같은 목록(캐시 다시) 한 번
  await reset();
  await seed();
  const svc = Q.createAiQuiz({ db: db, now: () => T0 });
  const r = rig({ mock: { count: 1 } });                  // 문항 1개 — 보낸 6문단 중 1문단만 쓰인다
  const base = { docId: DOC, a: 40, b: 43, pipeline: r.p, src: 'en', target: 'ko', domain: 'medical' };
  const m1 = await svc.make(base);
  assert.equal(m1.calls, 1);
  const s1 = docItems(r.fetch.calls[0].init).map((i) => i.paraId);
  const recs = await svc.list(DOC, 40, 43, { all: true });
  assert.deepEqual(recs[0].sentParaIds, s1, '★ 이 누름에 보낸 문단을 문항 레코드에(DB 3 · 새 스토어 0)');
  const h1 = await svc.history(DOC, 40, 43);
  assert.deepEqual(Array.from(h1.used), [s1[0]]);
  assert.deepEqual(s1.map((p) => h1.sent.get(p)), s1.map(() => 1));
  const pv = await svc.passage(DOC, 40, 43);
  assert.equal(pv.candidates, 5, '보냈지만 안 쓴 5문단 — 빠지지 않는다');
  assert.equal(pv.fresh, 0);
  // 같은 결과 다시 저장(캐시 0호출과 같은 꼴) → 세기 그대로
  const v = (await r.p.makeQuiz(docItems(r.fetch.calls[0].init), { src: 'en', target: 'ko', docId: DOC })).results[0].value;
  await svc.save(DOC, 40, 43, v, { src: 'en', target: 'ko', sent: s1 });
  assert.equal(r.fetch.calls.length, 1, '캐시');
  const h2 = await svc.history(DOC, 40, 43);
  assert.equal(h2.sent.get(s1[1]), 1, '★ 같은 보낸 목록은 한 번으로 센다');
  // 다시 누름 → 남은 5문단(1번 보냄) 보냄 · 세기 2
  const m2 = await svc.make(base);
  assert.equal(m2.calls, 1);
  const s2 = docItems(r.fetch.calls[1].init).map((i) => i.paraId);
  assert.deepEqual(s2.slice().sort(), s1.slice(1).sort(), '보냈지만 안 쓴 문단이 다시 후보(되풀이는 모두 한 번씩 보낸 뒤)');
  const h3 = await svc.history(DOC, 40, 43);
  assert.equal(h3.sent.get(s2[1]), 2);
  assert.equal(realFetchCalls, 0);
});

/* ══ A7 계층 ══════════════════════════════════════════ */

test('A7 계층 — review/aiquiz.js 는 config·db·hash·text/* 만 · 파이프라인 주입 · makeQuiz 는 자동 호출 0', () => {
  const src = read('../js/review/aiquiz.js');
  const imports = (src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || []).map((s) => s.replace(/^[\s\S]*from\s*/, ''));
  assert.deepEqual(imports, ["'../db.js'", "'../config.js'", "'../hash.js'", "'../text/store.js'", "'../text/screen.js'", "'../text/review.js'"]);
  assert.ok(!/from '\.\.\/(ai|ui|plan|tts|pdf)\//.test(src));
  assert.ok(/x\.pipeline\.makeQuiz\(/.test(src), '파이프라인은 주입받아 부른다');
  // 파이프라인 안에서 makeQuiz 를 부르는 곳은 없다(사용자가 누를 때 화면이 부른다 — 자동 0)
  const pl = read('../js/ai/pipeline.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.equal((pl.match(/makeQuiz\(/g) || []).length, 1, '정의 하나뿐 — 파이프라인 스스로 부르지 않는다');
  // 다시 추출 예외는 db 한 곳
  const d = read('../js/db.js');
  assert.ok(/if \(keepsOnReset\(c\.value, name\)\) \{ c\.continue\(\); return; \}/.test(d));
});
