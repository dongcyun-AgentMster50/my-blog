/* ============================================================
   MedReader — 복습 묶음 화면 `#/review/:docId/:range` (spec 17-13 2 · 4 · 6 — 15-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   한 책의 쪽 범위 `[a, b]`(없으면 읽던 장 — `documents.lastPage` 가 든 맨 위 장)를 한 화면에 모은다. 위에서 아래로, 비어 있는 칸은 숨긴다:
     1. 머리 — 장 제목(개요) · "쪽 a–b"(인쇄 라벨) · [범위 바꾸기](`ui/rangepick.js`)
     2. 진도(호출 0) — "읽음 x/y쪽"(13 `@read`) · [여기서 읽기](첫 읽지 않은 쪽)
     3. 요약·개요 — 저장한 요약 n개 → [모아 보기](11-3 의 그 범위) · 저장한 개요가 있으면 접힌 트리 · 없으면 [개요 만들기 (호출 1)]
        (11-3 의 같은 함수 `createOutlineFlow`) · 요약이 없으면 "아직 저장한 요약이 없습니다" 한 줄. (16 개념도 — 아직 없음: 칸·단추를 만들지 않는다)
     4. 원서 문제 📕(호출 0) — `doc.sectionIndex` 중 문항 쪽이 범위와 겹치는 섹션 · 지난 점수 · [풀기]. 원서 문제가 없는 책은 칸이 없다
     5. AI 문제 🤖 — 저장 수 · 지난 점수 · [풀기](`#/quiz/:docId/ai-p{a}-{b}`) · [문제 만들기 5개 (호출 1)] + "읽은 쪽 문단에서 — 약 n자 · 남은 문단 m".
        읽은 쪽이 없으면 단추 흐림 + 한 줄(15-D4). 실패 → 막힘 한 줄, **자동 재시도 0**. 폐기 > 50% → "충분히 만들지 못했습니다"(10-4)
     6. 기억 카드(호출 0) — 이 범위 카드 "복습할 n · 전체 m" → [복습](`#/cards/:docId/:a-b`)
     7. 필기(호출 0) — "필기 n" → [보기](`#/notes/:docId/:a-b` — 20-3)
     8. 고지 한 줄 `review.disclaimer`(정적)
   [원문에서 보기](퀴즈 화면 근거 블록): 그 쪽을 열고, 그려지면 저장본 쪽에서 20 `findQuote` 로 인용을 찾아 그 줄로 — 못 찾으면 쪽 처음.

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출(6절): 화면 열기·범위 바꾸기·[모아 보기]·[풀기]·[복습]·[보기] **0**. [문제 만들기]·[개요 만들기]만 누를 때 **최대 1**(같은 파이프라인 —
     `sumsheet.sumServices()`). 자동 무엇이든 0.
   ★ 묶음 상태는 저장하지 않는다(15-D12) — 매번 스토어에서 모은다. 모든 글자 textContent(AI 글·책 제목·장 이름 포함) — 그 밖 HTML 쓰기 0.
   ★ 1절(순수)은 `tests/review-ui-15.test.mjs` 가 잰다. 2절이 화면.
   ============================================================ */

import { t, applyTranslations, onLangChange, formatNumber, dirOf } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { AI, SRS } from '../config.js';
import { go, readerHash, quizHash, cardsHash, notesHash, summariesHash, reviewHash, libraryHash } from '../router.js';
import { tocOf } from '../search/outline.js';
import { rangeOf, aiSectionId, sectionsInRange, readPagesIn } from '../text/review.js';
import { rangesHas } from '../plan/planner.js';
import { readLogStore } from '../plan/readlog.js';
import { aiQuiz, MAKE } from '../review/aiquiz.js';
import { latestAttempt } from '../quiz/engine.js';
import { cardStore, dayStartOf, dayKeyOf, clampNewPerDay, isNoTrTerm } from '../srs/cards.js';
import { isNew } from '../srs/sm2.js';
import { annotationStore } from '../notes/annotations.js';
import { rowsOf, filterRows } from './notes.js';
import { summaryStore } from '../notes/summaries.js';
import { docLangOf } from '../text/lang.js';
import { domainOf } from '../ai/prompts.js';
import { fromStored } from '../text/store.js';
import { describePage } from '../text/screen.js';
import { findQuote } from '../text/anchor.js';
import { chapterRanges, defaultRange, chapterOfRange, printedRange, createRangePick } from './rangepick.js';
import { createOutlineFlow, inRange, OUTLINE_MIN, presetSummariesRange } from './summaries.js';
import { sumServices, itemNote } from './sumsheet.js';
import { renderTree } from './tree.js';
import { appendBidiText } from './bididom.js';
import { normalizeTranslationLang } from './settings.js';
import { RETRYABLE_REMOTE, TAP_BANNER_NOW, noticeBanner } from './trband.js';
import { onPageRender, revealLine, revealTop } from './reader.js';
import { setEvidenceHandler } from './quiz.js';

/* ────────────────────────────────────────────────────────
   1. 순수 — 결과 한 줄 · 칸 보이기 · 셈 (tests/review-ui-15.test.mjs)
   ──────────────────────────────────────────────────────── */

/**
 * [문제 만들기] 결과(`aiQuiz.make`) → 한 줄(i18n 키). 자동 재시도는 없다 — `retry` 는 [다시 시도] 단추를 보일지뿐.
 * @returns {{key:string, params?:Object, retry:boolean, banner:?string, ok:boolean}}
 */
export function aiNote(res) {
  const r = res || {};
  const out = (key, o) => Object.assign({ key: key, retry: false, banner: null, ok: false }, o || {});
  if (r.status === MAKE.UNREAD) return out('review.ai.unread');
  if (r.status === MAKE.NO_PASSAGE || r.status === 'empty') return out('review.ai.noPassage');
  if (r.status === MAKE.NO_PIPELINE || r.status === MAKE.BAD_RANGE) return out('review.ai.failed');
  if (r.status === 'too-big') return out('review.ai.tooBig');
  if (r.status === 'unsupported-lang') return out('readalong.unsupportedLang');
  if (r.state === 'ready') {
    if (r.saveError) return out('review.ai.saveFailed', { retry: false });
    if (r.weak) return out('review.ai.weak', { params: { n: Number(r.verified) || 0 }, ok: (Number(r.verified) || 0) > 0 });
    return out('review.ai.made', { params: { n: Number(r.verified) || 0 }, ok: true });
  }
  if (r.state === 'blocked' || r.state === 'skipped') {
    const n = itemNote({ state: r.state, code: r.code, gate: false });
    return out(n ? n.key : 'review.ai.failed', { retry: !!(n && n.retry), banner: TAP_BANNER_NOW.indexOf(r.code) >= 0 ? r.code : null });
  }
  return out('review.ai.failed', { retry: true });
}

/** AI 문제 [풀기] 주소 — 그 범위의 AI 섹션(`ai-p{a}-{b}`). 원서 섹션(`sec-…`)과 섞지 않는다(15-D3). */
export function aiQuizHash(docId, a, b) { return quizHash(docId, aiSectionId(a, b)); }

/** 범위 안 첫 읽지 않은 쪽(다 읽었으면 첫 쪽). */
export function firstUnread(readRanges, a, b) {
  const r = rangeOf(a, b);
  if (!r) return 1;
  for (let p = r[0]; p <= r[1]; p++) if (!rangesHas(readRanges, p)) return p;
  return r[0];
}

/**
 * 필기 수 — 범위 안 **묶음 수**. `[15-2b]` 20-3 필기 화면과 같은 함수로 센다(`rowsOf` → `filterRows` 범위 — 쪽을 넘는 묶음은
 * 대표 레코드 쪽으로, 칠하기·메모만 — 15-2R #5).
 */
export function notesInRange(recs, a, b) {
  const r = rangeOf(a, b);
  if (!r) return 0;
  return filterRows(rowsOf(recs), { range: { from: r[0], to: r[1] } }).length;
}

/**
 * 이 범위 카드 — "복습할 n · 전체 m". 복습할 것 = 오늘 줄의 복습(`due` — 범위로 거름) + 범위 안 새 카드(오늘 새 카드 몫까지 — 12-3 `#/cards/:docId/:a-b`
 * 와 같은 셈). 쪽을 모르는 카드는 범위 밖. 번역 빈 단어 카드는 복습할 것에서 뺀다(`[15-2b]` 15-2R #2 — 12-3 과 같은 판정
 * `isNoTrTerm`, `queue` 의 `due` 는 이미 뺐다). 전체 m 은 12-3 끝 화면 "전체"처럼 모두 센다.
 * @param {{due:Object[]}} q `cardStore.queue` 결과 @param {Object[]} all 그 책 카드 @param {number} room 오늘 남은 새 카드 몫
 */
export function cardsInRange(q, all, room, a, b) {
  const r = rangeOf(a, b);
  if (!r) return { due: 0, total: 0 };
  const inR = (c) => { const p = Number(c && c.pageNo); return p >= r[0] && p <= r[1]; };
  const list = (Array.isArray(all) ? all : []).filter(inR);
  const due = ((q && q.due) || []).filter(inR).length;
  const fresh = list.filter((c) => !c.suspended && isNew(c) && !isNoTrTerm(c)).length;
  return { due: due + Math.min(fresh, Math.max(0, Math.floor(Number(room) || 0))), total: list.length };
}

/**
 * 보일 칸 — 비어 있는 칸은 숨긴다(2절). `m` = 모은 것.
 * @returns {{progress:boolean, sum:boolean, book:boolean, ai:boolean, cards:boolean, notes:boolean}}
 */
export function cellsOf(m) {
  const x = m || {};
  return {
    progress: true,                                    // 읽음 0/y 도 보인다(진도는 늘 뜻이 있다)
    sum: true,                                         // 없으면 "아직 저장한 요약이 없습니다" 한 줄(수용 기준)
    book: Array.isArray(x.sections) && x.sections.length > 0,
    ai: true,                                          // [문제 만들기] 자리
    cards: (Number(x.cards && x.cards.total) || 0) > 0,
    notes: (Number(x.notes) || 0) > 0
  };
}

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = { docId: null, a: 0, b: 0, doc: null, chapters: [], labels: null, m: null, seq: 0, picking: false,
  busy: false, note: null, outFor: '', calls: 0 };
let flow = null;
/** [원문에서 보기] — 그 쪽이 그려지면 인용 줄로(다른 쪽·다른 책이면 버린다). */
let pendingEvidence = null;
let lastEvidence = null;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function btn(cls, text, act) {
  const b = el('button', cls, text);
  b.type = 'button';
  if (act) b.setAttribute('data-rv', act);
  return b;
}
const iso = (s) => '\u2068' + String(s == null ? '' : s) + '\u2069';
function targetNow() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

export function initReview() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="review"]');
  if (!root) return;
  els = { title: root.querySelector('#rvTitle'), body: root.querySelector('#rvBody') };
  flow = createOutlineFlow({
    outline: function (recs, o) { const sv = sumServices(); return sv ? sv.pipeline.outline(recs, o) : Promise.resolve(null); },
    unblock: function () { const sv = sumServices(); return sv && typeof sv.pipeline.retry === 'function' ? sv.pipeline.retry() : null; },
    gate: function () { return settings.get('privacy.consentedAt') ? { ok: true, reason: null } : { ok: false, reason: 'consent' }; },
    saveOutline: function (input) { const sv = sumServices(); return ((sv && sv.store) || summaryStore()).saveOutline(input); },
    onChange: function (v) { if (v && v.banner) { raiseBanner(v.banner); flow.bannerShown(); } if (root && !root.hidden) render(); }
  });
  root.addEventListener('click', onClick);
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden) render(); });
  // 퀴즈 화면 근거 블록의 [원문에서 보기]
  setEvidenceHandler((x) => {
    pendingEvidence = { docId: String(x.docId), page: Number(x.pageNo), quote: String(x.quote || ''), at: Date.now() };
    lastEvidence = null;
    go(readerHash(x.docId, x.pageNo));
  });
  onPageRender((p) => {
    const x = pendingEvidence;
    if (!x || !p) return;
    if (Date.now() - x.at > 60000) { pendingEvidence = null; return; }
    if (String(p.docId) !== x.docId || Number(p.page) !== x.page) return;
    pendingEvidence = null;
    const run = () => { revealEvidence(x).catch(() => { /* 쪽은 열렸다 */ }); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0);
  });
  attachDebugHook();
}

/** 인용 줄 찾기 — 저장본 쪽(리더가 그린 것과 같은 줄 id)에서 20 `findQuote`. 못 찾으면 쪽 처음. */
async function revealEvidence(x) {
  let shown = false;
  let how = null;
  try {
    const row = await db.get('pages', [x.docId, x.page]);
    const hit = row && x.quote ? findQuote(describePage(fromStored(row)), { exact: x.quote }) : null;
    if (hit && Array.isArray(hit.ranges) && hit.ranges.length) {
      const r0 = hit.ranges[0];
      how = hit.how;
      shown = revealLine(String(r0.id), { start: r0.start, end: r0.end }) !== false;
    }
  } catch (e) { shown = false; }
  if (!shown) { try { revealTop(); } catch (e) { /* 쪽은 열렸다 */ } }
  lastEvidence = { found: shown, how: how };
}

/** 라우터 — `#/review/:docId` · `#/review/:docId/:a-b`. 열 때마다 다시 모은다(호출 0). */
export async function showReview(params) {
  if (!root) return;
  const docId = params && params.docId != null && params.docId !== '' ? String(params.docId) : null;
  if (!docId) { go(libraryHash()); return; }
  const my = ++S.seq;
  applyTranslations(root);
  attachDebugHook();
  let doc = null;
  try { doc = await db.get('documents', docId); } catch (e) { doc = null; }
  if (my !== S.seq) return;
  if (!doc) { go(libraryHash()); return; }
  let toc = null;
  try { toc = await tocOf(docId); } catch (e) { toc = null; }
  if (my !== S.seq) return;
  const chapters = chapterRanges(toc, doc.pageCount);
  let r = params.range ? rangeOf(params.range.from, params.range.to) : null;
  if (r && Number(doc.pageCount) > 0) r = [Math.min(r[0], Number(doc.pageCount)), Math.min(r[1], Number(doc.pageCount))];
  if (!r) r = defaultRange(chapters, Number(doc.lastPage) || 1, doc.pageCount);
  const changed = S.docId !== docId || S.a !== r[0] || S.b !== r[1];
  if (changed) {
    S.note = null; S.note0 = null; S.picking = false; flow.reset();
    while (els.body.firstChild) els.body.removeChild(els.body.firstChild);
    els.body.appendChild(el('p', 'muted', t('common.loading')));
  }
  Object.assign(S, { docId: docId, a: r[0], b: r[1], doc: doc, chapters: chapters, labels: toc && Array.isArray(toc.pageLabels) ? toc.pageLabels : null });
  await gather(my);
  if (my !== S.seq) return;
  render();
  attachDebugHook();
}

/** 화면을 떠날 때 — 범위 고르기 칸을 닫는다(만든 문항·개요는 저장소에 있다). */
export function leaveReview() {
  if (!els) return;
  S.picking = false;
}

/** 칸마다 모은다 — 읽기만(호출 0). 하나가 실패해도 그 칸만 빈다. */
async function gather(my) {
  const docId = S.docId;
  const a = S.a;
  const b = S.b;
  const target = targetNow();
  const m = { readPages: 0, pages: b - a + 1, first: a, sums: 0, outline: null, sections: [], ai: { n: 0, last: null, readPages: 0, chars: 0, left: 0, fresh: 0 },
    cards: { due: 0, total: 0 }, notes: 0, sumRecs: [] };
  let read = [];
  try { read = await readLogStore.readRanges(docId); } catch (e) { read = []; }
  m.readPages = readPagesIn(read, a, b);
  m.first = firstUnread(read, a, b);
  try {
    const store = summaryStore();
    const sums = await store.list({ kind: 'summary', docId: docId });
    m.sumRecs = inRange(sums, docId, { from: a, to: b }, target);
    m.sums = m.sumRecs.length;
    const outs = await store.list({ kind: 'outline', docId: docId });
    m.outline = outs.filter((o) => o && o.target === target && o.range && Number(o.range.from) === a && Number(o.range.to) === b)
      .sort((x, y) => (Number(y.updatedAt || y.createdAt) || 0) - (Number(x.updatedAt || x.createdAt) || 0))[0] || null;
  } catch (e) { /* 요약 칸 비움 */ }
  const lastOf = async (sid) => {
    const list = [];
    try { await db.iterate('attempts', { index: 'docId_sectionId', query: IDBKeyRange.only([docId, sid]) }, (row) => { if (row) list.push(row); }); } catch (e) { return null; }
    const l = latestAttempt(list);
    return l && Number.isFinite(Number(l.total)) && Number(l.total) > 0 ? { s: Number(l.score) || 0, t: Number(l.total) } : null;
  };
  const secs = sectionsInRange(S.doc && S.doc.sectionIndex, a, b);
  for (const e of secs) m.sections.push({ sectionId: e.sectionId, title: e.title || '', n: Number(e.verified) || Number(e.questions) || 0, last: await lastOf(e.sectionId) });
  try {
    m.ai.n = (await aiQuiz.list(docId, a, b)).length;
    m.ai.last = await lastOf(aiSectionId(a, b));
    const pv = await aiQuiz.passage(docId, a, b, { budget: settings.get('ai.maxReqChars') });
    // "남은 문단 m" = 아직 문항이 되지 않은 읽은 문단(후보 — 보냈지만 안 쓴 것 포함, 15-1R) · `fresh` = 그중 한 번도 안 보낸 것(측정용)
    Object.assign(m.ai, { readPages: pv.readPages, chars: pv.chars, left: Number(pv.candidates) || 0, fresh: Number(pv.fresh) || 0, items: pv.items.length });
  } catch (e) { /* AI 칸 셈만 비움 */ }
  try {
    const now = Date.now();
    const ds = dayStartOf(now);
    const npd = clampNewPerDay(settings.get('srs.newPerDay'));
    const q = await cardStore.queue({ nowMs: now, dayStartMs: ds, dayEndMs: ds + SRS.DAY_MS, newPerDay: npd, docId: docId });
    const all = await cardStore.list({ docId: docId });
    let room = npd;
    try { const lg = await cardStore.readLog(); const td = lg && lg[dayKeyOf(ds)]; room = Math.max(0, npd - Math.max(0, Number(td && td.new) || 0)); } catch (e) { /* 몫 그대로 */ }
    m.cards = cardsInRange(q, all, room, a, b);
  } catch (e) { /* 카드 칸 숨김 */ }
  try { m.notes = notesInRange(await annotationStore().list({ docId: docId }), a, b); } catch (e) { m.notes = 0; }
  if (my === S.seq) S.m = m;
}

/* ── 그리기 ─────────────────────────────────────────── */

function rangeText() {
  const pr = printedRange(S.labels, S.a, S.b);
  return pr ? t('planner.range.printed', { a: pr.a, b: pr.b }) + ' · ' + t('planner.range.pages', { a: formatNumber(S.a), b: formatNumber(S.b) })
    : t('planner.range.pages', { a: formatNumber(S.a), b: formatNumber(S.b) });
}

function section(cls, head) {
  const s = el('section', 'card rv-cell ' + cls);
  if (head) s.appendChild(el('h2', 'rv-h', head));
  return s;
}
function row(cls) { return el('div', 'rv-row' + (cls ? ' ' + cls : '')); }
function lastText(l) { return l ? t('review.last', { s: formatNumber(l.s), t: formatNumber(l.t) }) : ''; }

function render() {
  if (!els || !S.m) return;
  const m = S.m;
  const doc = S.doc;
  els.title.textContent = t('review.titleDoc', { title: iso(doc ? (doc.title || doc.fileName || doc.id) : '') });
  const body = els.body;
  while (body.firstChild) body.removeChild(body.firstChild);
  const cells = cellsOf(m);

  // 1. 머리
  const head = section('rv-head', null);
  const ch = chapterOfRange(S.chapters, S.a, S.b);
  if (ch) { const h = el('h2', 'rv-chapter'); h.setAttribute('dir', 'auto'); h.textContent = ch.title; head.appendChild(h); }
  const rr = row();
  const rp = el('p', 'rv-range', rangeText());
  rp.setAttribute('data-k', 'range');
  rp.setAttribute('data-v', JSON.stringify([S.a, S.b]));
  rr.appendChild(rp);
  const chg = btn('', t('review.range.change'), 'pick');
  chg.setAttribute('aria-expanded', S.picking ? 'true' : 'false');
  rr.appendChild(chg);
  head.appendChild(rr);
  const pickHost = el('div', 'rv-pick');
  pickHost.hidden = !S.picking;
  head.appendChild(pickHost);
  if (S.picking) {
    createRangePick(pickHost, { chapters: S.chapters, labels: S.labels, pageCount: doc && doc.pageCount, value: [S.a, S.b],
      onPick: (v) => { S.picking = false; go(reviewHash(S.docId, { from: v[0], to: v[1] })); },
      onCancel: () => { S.picking = false; render(); } });
  }
  body.appendChild(head);

  // 2. 진도
  if (cells.progress) {
    const s = section('rv-progress', null);
    const r2 = row();
    const p = el('p', 'rv-line', t('review.progress', { x: formatNumber(m.readPages), y: formatNumber(m.pages) }));
    p.setAttribute('data-k', 'progress');
    p.setAttribute('data-v', JSON.stringify([m.readPages, m.pages]));
    r2.appendChild(p);
    const go1 = btn('', t('review.readHere'), null);
    go1.setAttribute('data-nav', readerHash(S.docId, m.first));
    r2.appendChild(go1);
    s.appendChild(r2);
    body.appendChild(s);
  }

  // 3. 요약·개요
  if (cells.sum) body.appendChild(sumCell(m));

  // 4. 원서 문제 📕
  if (cells.book) {
    const s = section('rv-book', '📕 ' + t('review.book.title'));
    for (const e of m.sections) {
      const r4 = row('rv-sec');
      r4.setAttribute('data-section-id', e.sectionId);
      const txt = [t('review.book.row', { section: e.title || e.sectionId, n: formatNumber(e.n) })];
      if (e.last) txt.push(lastText(e.last));
      const p = el('p', 'rv-line', txt.join(' · '));
      p.setAttribute('dir', 'auto');
      r4.appendChild(p);
      const b = btn('', t('review.solve'), null);
      b.setAttribute('data-nav', quizHash(S.docId, e.sectionId));
      r4.appendChild(b);
      s.appendChild(r4);
    }
    body.appendChild(s);
  }

  // 5. AI 문제 🤖
  if (cells.ai) body.appendChild(aiCell(m));

  // 6. 기억 카드
  if (cells.cards) {
    const s = section('rv-cards', t('review.cards.title'));
    const r6 = row();
    const p = el('p', 'rv-line', t('review.cards.n', { n: formatNumber(m.cards.due), m: formatNumber(m.cards.total) }));
    p.setAttribute('data-k', 'cards');
    p.setAttribute('data-v', JSON.stringify([m.cards.due, m.cards.total]));
    r6.appendChild(p);
    const b = btn('', t('review.cards.go'), null);
    b.setAttribute('data-nav', cardsHash(S.docId, { from: S.a, to: S.b }));
    r6.appendChild(b);
    s.appendChild(r6);
    body.appendChild(s);
  }

  // 7. 필기
  if (cells.notes) {
    const s = section('rv-notes', t('review.notes.title'));
    const r7 = row();
    const p = el('p', 'rv-line', t('review.notes.n', { n: formatNumber(m.notes) }));
    p.setAttribute('data-k', 'notes');
    p.setAttribute('data-v', String(m.notes));
    r7.appendChild(p);
    const b = btn('', t('review.notes.go'), null);
    b.setAttribute('data-nav', notesHash(S.docId, { from: S.a, to: S.b }));
    r7.appendChild(b);
    s.appendChild(r7);
    body.appendChild(s);
  }
  // 8. 고지 — index.html 정적 한 줄(`review.disclaimer`)
  attachDebugHook();
}

function sumCell(m) {
  const s = section('rv-sum', t('review.sum.title'));
  const v = flow.view();
  const r3 = row();
  if (!m.sums) {
    const p = el('p', 'rv-line muted', t('review.sum.none'));
    p.setAttribute('data-k', 'sums');
    p.setAttribute('data-v', '0');
    r3.appendChild(p);
  } else {
    const p = el('p', 'rv-line', t('review.sum.n', { n: formatNumber(m.sums) }));
    p.setAttribute('data-k', 'sums');
    p.setAttribute('data-v', String(m.sums));
    r3.appendChild(p);
    r3.appendChild(btn('', t('review.sum.open'), 'sums'));
  }
  s.appendChild(r3);
  const target = targetNow();
  const showTree = (title, points, lang, open) => {
    const det = el('details', 'rv-outline');
    det.open = !!open;
    const sum = el('summary', 'rv-outline-title');
    sum.setAttribute('lang', lang);
    sum.setAttribute('dir', dirOf(lang));
    appendBidiText(sum, String(title || ''), dirOf(lang));
    det.appendChild(sum);
    const tree = renderTree(points, { dir: dirOf(lang), lang: lang, open: true });
    if (tree) det.appendChild(tree);
    s.appendChild(det);
    return det;
  };
  if (m.outline) {
    showTree(m.outline.title, m.outline.points, String(m.outline.target || target), false);
  } else if (v.state === 'ready' && v.value && S.outFor === S.docId + ':' + S.a + '-' + S.b) {
    showTree(v.value.title, v.value.points, (v.req && v.req.target) || target, true);
    const r = row();
    const sv = btn('primary', t(v.saved ? 'sum.saved' : 'sum.save'), 'outline-save');
    if (v.saved || v.busy) sv.setAttribute('aria-disabled', 'true');
    r.appendChild(sv);
    s.appendChild(r);
  } else if (m.sums >= OUTLINE_MIN && sumServices()) {
    const r = row();
    const mk = btn('', t('review.outline.make'), 'outline');
    if (v.state === 'pending') mk.setAttribute('aria-disabled', 'true');
    r.appendChild(mk);
    if (v.note && v.note.retry) r.appendChild(btn('', t('readalong.retry'), 'outline-retry'));
    s.appendChild(r);
  }
  if (v.note && S.outFor === S.docId + ':' + S.a + '-' + S.b) {
    const n = el('p', 'rv-status', t(v.note.key, v.note.params ? { n: formatNumber(v.note.params.n), m: formatNumber(v.note.params.m) } : undefined));
    n.setAttribute('role', 'status');
    s.appendChild(n);
  }
  // (16 개념도 — 아직 없다: `[개념도 (호출 1)]`·작은 그림 자리는 16 이 더한다)
  return s;
}

function aiCell(m) {
  const s = section('rv-ai', '🤖 ' + t('review.ai.title'));
  const a = m.ai;
  const r5 = row();
  const txt = [t('review.ai.count', { n: formatNumber(a.n) })];
  if (a.last) txt.push(lastText(a.last));
  const p = el('p', 'rv-line', txt.join(' · '));
  p.setAttribute('data-k', 'ai');
  p.setAttribute('data-v', String(a.n));
  r5.appendChild(p);
  if (a.n > 0) {
    const b = btn('', t('review.solve'), null);
    b.classList.add('rv-ai-solve');
    b.setAttribute('data-nav', aiQuizHash(S.docId, S.a, S.b));
    r5.appendChild(b);
  }
  s.appendChild(r5);
  const r = row('rv-make');
  const mk = btn('primary', t('review.ai.make'), 'make');
  const unread = !a.readPages;
  if (unread || S.busy) { mk.disabled = true; mk.setAttribute('aria-disabled', 'true'); }
  r.appendChild(mk);
  if (S.note && S.note.retry && !S.busy) r.appendChild(btn('', t('readalong.retry'), 'retry'));
  s.appendChild(r);
  const info = el('p', 'rv-line muted', unread ? t('review.ai.unread') : t('review.ai.input', { n: formatNumber(a.chars), m: formatNumber(a.left) }));
  info.setAttribute('data-k', 'aiInput');
  info.setAttribute('data-v', JSON.stringify(unread ? ['unread'] : [a.chars, a.left]));
  s.appendChild(info);
  const st = S.busy ? { key: 'review.ai.pending' } : S.note;
  if (st) {
    const n = el('p', 'rv-status', t(st.key, st.params ? { n: formatNumber(st.params.n) } : undefined));
    n.setAttribute('role', 'status');
    n.setAttribute('data-k', 'aiNote');
    n.setAttribute('data-v', st.key);
    s.appendChild(n);
  }
  return s;
}

/* ── 동작 ───────────────────────────────────────────── */

async function onClick(ev) {
  const b = ev.target && ev.target.closest ? ev.target.closest('[data-rv]') : null;
  if (!b || !root.contains(b) || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
  const act = b.getAttribute('data-rv');
  if (act === 'pick') { S.picking = !S.picking; render(); return; }
  if (act === 'sums') { presetSummariesRange(S.docId, S.a, S.b); go(summariesHash(S.docId)); return; }
  if (act === 'make') { await makeAi(false); return; }
  if (act === 'retry') { await makeAi(true); return; }
  if (act === 'outline') { await makeOutline(); return; }
  if (act === 'outline-retry') { S.outFor = S.docId + ':' + S.a + '-' + S.b; await flow.retry(); return; }
  if (act === 'outline-save') {
    const v = await flow.save();
    if (v && v.saved) { const my = ++S.seq; await gather(my); if (my === S.seq) render(); }
  }
}

/** [문제 만들기 5개] — 사용자가 누를 때만. 최대 1호출(파이프라인 `makeQuiz`). 실패해도 다시 보내지 않는다(자동 재시도 0). */
async function makeAi(retry) {
  if (S.busy) return;
  const sv = sumServices();
  if (!settings.get('privacy.consentedAt')) { S.note = aiNote({ state: 'blocked', code: 'consent' }); raiseBanner('consent'); render(); return; }
  if (!sv) { S.note = aiNote({ status: MAKE.NO_PIPELINE }); render(); return; }
  const docId = S.docId;
  const a = S.a;
  const b = S.b;
  S.busy = true;
  S.note = null;
  render();
  let res = null;
  try {
    // 막힌 원격 상태에서 [다시 시도] — 사용자 동작이라 상태를 먼저 푼다(번역 [다시 시도]와 같은 규칙)
    if (retry && S.note0 && RETRYABLE_REMOTE.indexOf(S.note0) >= 0 && typeof sv.pipeline.retry === 'function') await sv.pipeline.retry();
    res = await aiQuiz.make({ docId: docId, a: a, b: b, pipeline: sv.pipeline, src: docLangOf(S.doc), target: targetNow(), domain: domainOf(S.doc),
      retry: !!retry, budget: settings.get('ai.maxReqChars') });
  } catch (e) { res = null; }
  S.busy = false;
  if (S.docId !== docId || S.a !== a || S.b !== b) return;      // 그사이 범위를 바꿨다 — 결과는 저장소에 있다
  S.calls += (res && Number(res.calls)) || 0;
  S.note = aiNote(res);
  S.note0 = res && res.code ? String(res.code) : null;
  if (S.note.banner) raiseBanner(S.note.banner);
  const my = ++S.seq;
  await gather(my);
  if (my === S.seq) render();
}

async function makeOutline() {
  const doc = S.doc;
  const target = targetNow();
  const recs = (S.m && S.m.sumRecs) || [];
  const ch = chapterOfRange(S.chapters, S.a, S.b);
  const p = settings.get('ai.provider');
  S.outFor = S.docId + ':' + S.a + '-' + S.b;
  await flow.make({ recs: recs, ctx: {
    docId: S.docId, docTitle: doc ? (doc.title || doc.fileName || '') : '', fileHash: (doc && doc.fileHash) || '',
    target: target, domain: domainOf(doc), provider: typeof p === 'string' && p ? p : AI.DEFAULT_PROVIDER,
    model: String(settings.get('ai.model') || ''), range: { from: S.a, to: S.b, label: ch ? ch.title : '' }
  } });
}

function raiseBanner(code) {
  const b = noticeBanner(code, '');
  if (!b) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', { detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] } }));
}

/* ── 측정 훅(글자 없음) ─────────────────────────────── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.reviewScreen = {
    state: function () {
      if (!els) return null;
      const m = S.m || {};
      return {
        docId: S.docId, range: [S.a, S.b], cells: Array.from(els.body.querySelectorAll('.rv-cell')).map((c) => c.className.replace(/^card rv-cell /, '')),
        readPages: m.readPages, pages: m.pages, sums: m.sums, outline: !!m.outline, sections: (m.sections || []).length,
        ai: m.ai ? { n: m.ai.n, readPages: m.ai.readPages, chars: m.ai.chars, left: m.ai.left, fresh: m.ai.fresh } : null, cards: m.cards, notes: m.notes,
        busy: S.busy, note: S.note ? S.note.key : null, calls: S.calls, picking: S.picking,
        makeDisabled: !!(els.body.querySelector('[data-rv="make"]') || {}).disabled, outline_flow: flow ? flow.view().state : null
      };
    },
    lastEvidence: function () { return lastEvidence ? Object.assign({}, lastEvidence) : null; }
  };
}
