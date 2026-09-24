/* ============================================================
   MedReader — 퀴즈 엔진 (spec 5-4 · 5-5 · 9-2)

   ── 서비스 계층이다(3-1 · 3-2) ──────────────────────────
   `config.js` 와 순수 계층인 `quiz/parser.js` 만 import 한다.
   **`db` 도 `document` 도 여기서 import 하지 않는다** — 둘 다 `io` 로
   주입받는다. 그래서 이 파일은 브라우저 없이 전부 테스트된다.
   UI 문자열도 만들지 않는다(3-2) — 코드·수치·구조만 낸다.

   ── 이 파일이 하는 일 ───────────────────────────────────
   1. 섹션 인덱스 만들기 (`buildSectionIndex`) — 저장된 쪽을 **섹션 단위로
      잘라** 파싱하고 `questions` 레코드와 `documents.sectionIndex` 를 낸다.
   2. 채점 (`gradeQuestion`) — `unverified` 는 **채점하지 않는다**(5-4).
   3. 한 판의 상태 기계 (`createSession`) — 응답·점수·`attempts`·`mistakes`.
   4. 문항 순서 정하기 (`planQuizOrder`) — **사람이 채운다**.

   ── 7000쪽 · 문항 12,000개 ──────────────────────────────
   `PageLayout` 7000개를 동시에 들면 2GB 급이다(9a Build 경고). 그래서
   여기서는 **어떤 경로에서도 PageLayout 전체를 들지 않는다**:
     · 쪽은 `io.eachPage(from, to, cb)` 로 **흘려 받고**, 콜백 안에서
       파서가 읽는 부분(`pageNo` + `paragraphs[{id,text,kind}]`)만 남긴다
       (`projectPage`). 좌표·줄·run 은 그 자리에서 버린다.
     · 1단계에서 섹션의 쪽 범위만 구하고, 2단계에서 **섹션 하나의 범위만**
       모아 파싱한다. `sectionId` 가 로마숫자라 쪽 범위를 잘라도 id 가
       변하지 않는다(5-2).
   ============================================================ */

import { QUIZ } from '../config.js';
import { parseSections, makeQuestionId, isQuizWorthy } from './parser.js';

/* ────────────────────────────────────────────────────────
   0. 작은 도구
   ──────────────────────────────────────────────────────── */

function str(v) { return String(v == null ? '' : v); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/** 9-2 `attempts.id`·`mistakes.id` 는 uuid 다. 주입이 없으면 여기서 만든다. */
export function makeId(prefix) {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c && typeof c.randomUUID === 'function') return str(prefix) + c.randomUUID();
  // randomUUID 가 없는 오래된 엔진(과 테스트)용. 충돌해도 스토어 키일 뿐이다.
  return str(prefix) + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * 파서가 읽는 부분만 남긴다. 7000쪽에서 이 투영이 메모리를 가른다 —
 * 저장본 한 쪽은 20KB 급이지만 문단 텍스트는 4KB 남짓이다(9-2 표).
 * **순수 함수.**
 */
export function projectPage(layout) {
  const L = layout || {};
  const src = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  const paragraphs = [];
  for (let i = 0; i < src.length; i++) {
    const p = src[i];
    if (!p) continue;
    paragraphs.push({ id: str(p.id), text: str(p.text), kind: str(p.kind) });
  }
  return { pageNo: num(L.pageNo), paragraphs: paragraphs };
}

/* ────────────────────────────────────────────────────────
   1. 섹션 인덱스 (5-4 · 9-2)
   ──────────────────────────────────────────────────────── */

/** 5-4 제안 칩 조건. 임계는 `config.QUIZ` 한 곳에만 있다. */
export function isSectionQuizWorthy(section) {
  return isQuizWorthy(section, QUIZ.MIN_QUESTIONS, QUIZ.MIN_VERIFIED_RATIO);
}

/**
 * 같은 판정을 `documents.sectionIndex` 한 줄에 대해서도 한다 —
 * 리더의 제안 칩은 파싱 결과가 아니라 저장된 인덱스를 보고 뜬다(5-4).
 */
export function isIndexEntryQuizWorthy(entry) {
  if (!entry) return false;
  const q = num(entry.questions);
  return isSectionQuizWorthy({
    stats: { questions: q, unverified: q - num(entry.verified) }
  });
}

/** 한 섹션이 실제로 걸쳐 있는 쪽 범위. 문항 쪽과 해설 쪽이 멀 수 있다(5-2). */
export function sectionPageSpan(section) {
  let lo = Infinity;
  let hi = -Infinity;
  const qs = (section && section.questions) || [];
  for (let i = 0; i < qs.length; i++) {
    const n = num(qs[i].pageNo);
    if (!n) continue;
    if (n < lo) lo = n;
    if (n > hi) hi = n;
  }
  if (section && section.answers && typeof section.answers.forEach === 'function') {
    section.answers.forEach(function (a) {
      const n = num(a && a.pageNo);
      if (!n) return;
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    });
  }
  if (lo === Infinity) {
    const s = num(section && section.startPage);
    return { startPage: s, endPage: s };
  }
  return { startPage: lo, endPage: hi };
}

/** 9-2 `documents.sectionIndex[]` 한 줄. UI 문자열이 아니라 수치다. */
export function sectionIndexEntry(section, span) {
  const st = (section && section.stats) || {};
  const q = num(st.questions);
  const sp = span || sectionPageSpan(section);
  return {
    sectionId: str(section && section.sectionId),
    title: (section && section.title) || null,
    startPage: num(sp.startPage),
    endPage: num(sp.endPage),
    questions: q,
    verified: q - num(st.unverified)
  };
}

/** 9-2 `questions` 레코드. `source: 'book'`(5-4). id 는 결정적이다. */
export function toQuestionRecord(docId, sectionId, q, now) {
  const a = q && q.answer;
  return {
    id: (q && q.id) || makeQuestionId(docId, sectionId, q && q.number),
    docId: str(docId),
    sectionId: str(sectionId),
    source: 'book',
    status: (q && q.status === 'verified') ? 'verified' : 'unverified',
    number: num(q && q.number),
    stem: str(q && q.stem),
    options: ((q && q.options) || []).map(function (o) {
      return { letter: str(o.letter), text: str(o.text), paraId: str(o.paraId) };
    }),
    answer: a ? { letters: (a.letters || []).slice() } : null,
    explanation: (a && a.explanation) ? { en: str(a.explanation) } : null,
    pageNo: num(q && q.pageNo),
    paraIds: ((q && q.stemParaIds) || []).slice(),
    hasFigure: !!(q && q.hasFigure),
    createdAt: num(now) || 0
  };
}

/** 쪽 범위를 창으로 자른다. **순수 함수** — 1단계 훑기가 이것을 쓴다. */
export function pageWindows(pageCount, windowSize) {
  const total = Math.max(0, Math.floor(num(pageCount)));
  const size = Math.max(1, Math.floor(num(windowSize)) || QUIZ.SCAN_WINDOW_PAGES);
  const out = [];
  for (let from = 1; from <= total; from += size) {
    out.push({ from: from, to: Math.min(total, from + size - 1) });
  }
  return out;
}

/** 섹션 범위에 여유를 준다 — 창 경계에서 잘린 이어짐 문단을 되찾는다. */
export function padSpan(span, pageCount, pad) {
  const p = pad == null ? QUIZ.SPAN_PAD_PAGES : Math.max(0, Math.floor(num(pad)));
  const total = Math.max(1, Math.floor(num(pageCount)));
  return {
    startPage: Math.max(1, num(span.startPage) - p),
    endPage: Math.min(total, num(span.endPage) + p)
  };
}

/**
 * 저장된 쪽을 읽어 섹션 인덱스를 만든다. **두 번 훑는다.**
 *
 *   1단계 — 창(기본 32쪽) 단위로 파싱해 **섹션의 쪽 범위만** 모은다.
 *            문항 내용은 여기서 버린다.
 *   2단계 — 섹션 하나씩, 그 섹션의 쪽 범위만 모아 다시 파싱하고
 *            `questions` 레코드를 쓴다. 문항 쪽과 해설 쪽이 200쪽 떨어져
 *            있어도 **한 섹션 안에서는 같이 읽히므로** 매칭이 된다(5-2).
 *
 * 예외는 밖으로 새지 않는다(5-4) — 리더는 이 함수의 실패를 몰라야 한다.
 *
 * @param {Object} io
 *   eachPage(from, to, cb)  {Function} 저장된 쪽을 흘려 준다. cb 에 넘기는 값은
 *                                     `projectPage` 가 받을 수 있는 형태면 된다.
 *   putQuestions(records)   {Function} `questions` 스토어에 한 트랜잭션으로 쓴다.
 *   saveIndex(entries)      {Function} `documents.sectionIndex` 를 갈아 끼운다.
 *   now()                   {Function} 선택 — 기본 `Date.now`
 * @param {Object} opts docId, pageCount, scanWindow, maxSections, onProgress
 * @returns {Promise<Object>} { sections:[entry], diagnostics }
 */
export async function buildSectionIndex(io, opts) {
  const o = opts || {};
  const docId = str(o.docId);
  const pageCount = Math.max(0, Math.floor(num(o.pageCount)));
  const now = (io && typeof io.now === 'function') ? io.now : function () { return Date.now(); };
  const maxSections = Math.max(1, Math.floor(num(o.maxSections)) || QUIZ.SECTION_INDEX_MAX);
  const diagnostics = {
    pagesScanned: 0, pagesParsed: 0, sectionsFound: 0, sectionsSkipped: 0,
    questions: 0, verified: 0, maxPagesInMemory: 0, errors: []
  };
  if (!io || typeof io.eachPage !== 'function' || !docId || pageCount <= 0) {
    return { sections: [], diagnostics: diagnostics };
  }

  /* ── 1단계 — 섹션의 쪽 범위만 ──────────────────────── */
  const spans = new Map();      // sectionId → {startPage, endPage, weight}
  const windows = pageWindows(pageCount, o.scanWindow || QUIZ.SCAN_WINDOW_PAGES);
  for (let w = 0; w < windows.length; w++) {
    let bucket = [];
    try {
      await io.eachPage(windows[w].from, windows[w].to, function (layout) {
        bucket.push(projectPage(layout));
        diagnostics.pagesScanned++;
      });
      if (bucket.length > diagnostics.maxPagesInMemory) diagnostics.maxPagesInMemory = bucket.length;
      const found = parseSections(bucket, { docId: docId });
      for (let i = 0; i < found.length; i++) {
        const sec = found[i];
        if (!sec.sectionId || sec.sectionId === 'sec-none') continue;
        const sp = sectionPageSpan(sec);
        const prev = spans.get(sec.sectionId);
        const weight = num(sec.stats && sec.stats.questions) + (sec.answers ? sec.answers.size : 0);
        if (prev) {
          prev.startPage = Math.min(prev.startPage, sp.startPage);
          prev.endPage = Math.max(prev.endPage, sp.endPage);
          prev.weight += weight;
          if (!prev.title && sec.title) prev.title = sec.title;
        } else {
          spans.set(sec.sectionId, {
            sectionId: sec.sectionId, title: sec.title || null,
            startPage: sp.startPage, endPage: sp.endPage, weight: weight
          });
        }
      }
    } catch (e) {
      diagnostics.errors.push(String((e && e.message) || e));
    }
    bucket = null;              // 창 하나가 끝나면 즉시 버린다
  }
  diagnostics.sectionsFound = spans.size;

  /* 병적인 입력(쪽마다 새 섹션)에서 2단계가 폭주하지 않게 한다.
     문항+정답이 많은 섹션부터 상한까지만 본다. 실측 14섹션에서는 걸리지 않는다. */
  let list = Array.from(spans.values());
  if (list.length > maxSections) {
    list.sort(function (a, b) { return b.weight - a.weight; });
    diagnostics.sectionsSkipped = list.length - maxSections;
    list = list.slice(0, maxSections);
  }
  list.sort(function (a, b) { return a.startPage - b.startPage; });

  /* ── 2단계 — 섹션 하나씩 ───────────────────────────── */
  const entries = [];
  for (let i = 0; i < list.length; i++) {
    const want = list[i];
    let pages = [];
    try {
      const span = padSpan(want, pageCount, o.spanPad);
      await io.eachPage(span.startPage, span.endPage, function (layout) {
        pages.push(projectPage(layout));
        diagnostics.pagesParsed++;
      });
      if (pages.length > diagnostics.maxPagesInMemory) diagnostics.maxPagesInMemory = pages.length;
      const found = parseSections(pages, { docId: docId });
      let sec = null;
      for (let k = 0; k < found.length; k++) {
        if (found[k].sectionId === want.sectionId) { sec = found[k]; break; }
      }
      if (sec && sec.questions.length) {
        const stamp = now();
        const records = [];
        for (let k = 0; k < sec.questions.length; k++) {
          records.push(toQuestionRecord(docId, sec.sectionId, sec.questions[k], stamp));
        }
        // 재파싱은 같은 (docId, sectionId, number) 를 덮어쓴다(5-4).
        if (typeof io.putQuestions === 'function') await io.putQuestions(records);
        const entry = sectionIndexEntry(sec, sectionPageSpan(sec));
        if (!entry.title && want.title) entry.title = want.title;
        entries.push(entry);
        diagnostics.questions += entry.questions;
        diagnostics.verified += entry.verified;
      }
    } catch (e) {
      diagnostics.errors.push(String((e && e.message) || e));
    }
    pages = null;               // 섹션 하나가 끝나면 즉시 버린다
    if (typeof o.onProgress === 'function') {
      try { o.onProgress({ done: i + 1, total: list.length }); } catch (e) { /* 구독자 예외 */ }
    }
  }

  if (typeof io.saveIndex === 'function') {
    try { await io.saveIndex(entries); } catch (e) { diagnostics.errors.push(String((e && e.message) || e)); }
  }
  return { sections: entries, diagnostics: diagnostics };
}

/* ────────────────────────────────────────────────────────
   2. 채점 (5-4 · 5-5)
   ──────────────────────────────────────────────────────── */

/**
 * 채점할 수 있는 문항인가. **`unverified` 는 채점하지 않는다**(5-4).
 * `[실측]` 1,233문항 중 79개가 여기 해당한다 — 드문 경우가 아니다.
 */
export function isGradable(question) {
  if (!question) return false;
  if (question.status !== 'verified') return false;
  const a = question.answer;
  return !!(a && Array.isArray(a.letters) && a.letters.length > 0);
}

function letterSet(v) {
  const out = new Set();
  const list = Array.isArray(v) ? v : [v];
  for (let i = 0; i < list.length; i++) {
    const s = str(list[i]).trim().toUpperCase();
    if (s) out.add(s.charAt(0));
  }
  return out;
}

/**
 * 한 문항을 채점한다. **순수 함수.**
 *
 * 복수 정답(`['B','D']`)의 판정 — spec 이 정하지 않아 여기서 정한다:
 *   · `chosen` 이 **글자 하나**(지금 UI 가 보내는 것)면 **포함**으로 본다.
 *     보기 하나만 누를 수 있는 화면에서 "둘 다 골라야 한다"는 요구는
 *     채울 수 없는 조건이고, 정답 하나를 짚은 사람을 틀렸다고 할 수 없다.
 *     문항 수를 미리 알려 주는 것(= 정답 개수 노출)도 피한다.
 *   · `chosen` 이 **배열**이면 **집합이 정확히 같아야** 맞는다(복수 선택 UI 대비).
 *
 * @returns {{gradable:boolean, correct:boolean|null, expected:string[], chosen:string[]}}
 */
export function gradeQuestion(question, chosen) {
  const picked = letterSet(chosen);
  const pickedList = Array.from(picked);
  if (!isGradable(question)) {
    return { gradable: false, correct: null, expected: [], chosen: pickedList };
  }
  const expected = letterSet(question.answer.letters);
  const expectedList = Array.from(expected);
  if (!picked.size) return { gradable: true, correct: false, expected: expectedList, chosen: pickedList };

  let correct;
  if (Array.isArray(chosen)) {
    // 집합 동일
    correct = picked.size === expected.size;
    if (correct) {
      picked.forEach(function (l) { if (!expected.has(l)) correct = false; });
    }
  } else {
    correct = expected.has(pickedList[0]);
  }
  return { gradable: true, correct: !!correct, expected: expectedList, chosen: pickedList };
}

/* ────────────────────────────────────────────────────────
   3. 문항 순서 — ★ 사람이 채운다
   ──────────────────────────────────────────────────────── */

/**
 * 이 퀴즈 세션에서 낼 문항을 고르고 순서를 정한다.
 *
 * @param {Object} ctx
 *   questions    {Array}   이 섹션의 문항 (파서 순서 = 원서 번호 순)
 *   lastAttempt  {Object|null} 같은 섹션의 가장 최근 attempt
 *                             { items:[{questionId, chosen, correct}], at, score, total }
 *   mode         {'all'|'wrong-only'}  'wrong-only' 는 결과 화면의 [오답만 다시]
 *   unverified   {number}  questions 안의 unverified 개수 (채점 불가 문항)
 * @returns {Array} 낼 문항 배열. ctx.questions 의 부분집합이어야 하고,
 *                  빈 배열이면 호출자가 "풀 문항이 없다"고 처리한다.
 */
export function planQuizOrder(ctx) {
  const all = (ctx && Array.isArray(ctx.questions)) ? ctx.questions : [];
  if (!all.length) return [];

  // ── [오답만 다시] — 직전에 **틀린 것으로 채점된** 문항만.
  //    채점되지 않은 unverified 문항은 틀린 적이 없으므로 자연히 빠진다.
  if (ctx.mode === 'wrong-only') {
    const wrong = wrongIdsOf(ctx.lastAttempt);
    if (!wrong.size) return [];
    return all.filter(function (q) { return wrong.has(str(q && q.id)); });
  }

  // ── 이어 풀기.
  //
  // 섞지 않는다. 이 책은 섹션 안에서 문항이 **주제별로 묶여** 있고 해설이
  // 장(`Chap. N`)을 참조한다 — 순서를 흩으면 원서와 나란히 보는 사용법이 깨진다.
  //
  // 그리고 `[실측]` sec-III 는 **273문항**이다. 한자리에 다 풀 양이 아니므로
  // **중간에 나갔다 돌아오면 이어서** 푸는 것이 기본이어야 한다.
  // 직전 시도가 끝까지 갔으면 새 회차로 보고 섹션 전체를 다시 낸다.
  const touched = attemptedIdsOf(ctx.lastAttempt);
  if (!touched.size) return all.slice();

  const rest = all.filter(function (q) { return !touched.has(str(q && q.id)); });

  // 남은 것이 없다 = 직전 시도가 완료됐다 → 처음부터 새 회차.
  return rest.length ? rest : all.slice();
}

/** attempt 가 **손댄** 문항 id 들(채점 여부와 무관 — unverified 도 푼 것이다). */
export function attemptedIdsOf(attempt) {
  const out = new Set();
  const items = (attempt && Array.isArray(attempt.items)) ? attempt.items : [];
  for (let i = 0; i < items.length; i++) {
    if (items[i]) out.add(str(items[i].questionId));
  }
  return out;
}

/**
 * `planQuizOrder` 가 아직 비어 있거나 쓸 수 없는 값을 낼 때의 폴백.
 * **원서 번호 순 그대로** 낸다 — 지금은 그게 맞는 동작이다.
 * `wrong-only` 는 직전 attempt 의 오답만, 역시 원서 순서로 남긴다.
 */
export function fallbackOrder(ctx) {
  const all = (ctx && Array.isArray(ctx.questions)) ? ctx.questions : [];
  if (!ctx || ctx.mode !== 'wrong-only') return all.slice();
  const wrong = wrongIdsOf(ctx.lastAttempt);
  if (!wrong.size) return [];
  return all.filter(function (q) { return wrong.has(str(q && q.id)); });
}

/** attempt 안에서 **틀린 것으로 채점된** 문항 id 들. 채점 안 된 것은 오답이 아니다. */
export function wrongIdsOf(attempt) {
  const out = new Set();
  const items = (attempt && Array.isArray(attempt.items)) ? attempt.items : [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] && items[i].correct === false) out.add(str(items[i].questionId));
  }
  return out;
}

/**
 * 호출부. `planQuizOrder` 가 던지거나, 배열이 아니거나, 빈 배열이어도
 * **깨지지 않는다** — 그때는 폴백을 쓴다. 반환값은 언제나 `ctx.questions`
 * 의 부분집합이다(사람이 다른 것을 섞어 넣어도 걸러낸다).
 */
export function resolveOrder(ctx) {
  const all = (ctx && Array.isArray(ctx.questions)) ? ctx.questions : [];
  let picked = null;
  try { picked = planQuizOrder(ctx); } catch (e) { picked = null; }
  if (!Array.isArray(picked) || picked.length === 0) return fallbackOrder(ctx);
  const known = new Set();
  for (let i = 0; i < all.length; i++) known.add(str(all[i] && all[i].id));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < picked.length; i++) {
    const id = str(picked[i] && picked[i].id);
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(picked[i]);
  }
  return out.length ? out : fallbackOrder(ctx);
}

/* ────────────────────────────────────────────────────────
   4. 한 판 (5-5)
   ──────────────────────────────────────────────────────── */

/**
 * 퀴즈 한 판의 상태 기계. **DOM 도 db 도 모른다** — 화면은 `ui/quiz.js` 가
 * 그리고, 저장은 호출자가 `toAttempt()`·`toMistakes()` 결과를 넣는다.
 *
 * @param {Object} ctx docId, sectionId, questions, lastAttempt, mode,
 *                     now()(선택), newId()(선택)
 */
export function createSession(ctx) {
  const c = ctx || {};
  const now = typeof c.now === 'function' ? c.now : function () { return Date.now(); };
  const newId = typeof c.newId === 'function' ? c.newId : function () { return makeId(''); };
  const all = Array.isArray(c.questions) ? c.questions : [];
  const mode = c.mode === 'wrong-only' ? 'wrong-only' : 'all';
  const unverified = all.filter(function (q) { return !isGradable(q); }).length;

  const queue = resolveOrder({
    questions: all, lastAttempt: c.lastAttempt || null,
    mode: mode, unverified: unverified
  });

  const items = [];             // 9-2 attempts.items[]
  const byId = new Map();       // questionId → item (한 문항에 한 줄)
  const startedAt = now();
  let i = 0;
  let shownAt = startedAt;
  let finished = queue.length === 0;

  function current() { return i < queue.length ? queue[i] : null; }

  return {
    mode: mode,
    startedAt: startedAt,
    total: function () { return queue.length; },
    index: function () { return Math.min(i, Math.max(0, queue.length - 1)); },
    position: function () { return queue.length ? Math.min(i + 1, queue.length) : 0; },
    questions: function () { return queue.slice(); },
    current: current,
    isFinished: function () { return finished; },
    /** 지금 문항에 이미 답했는가(다시 눌러도 첫 응답이 남는다). */
    answered: function () {
      const q = current();
      return !!(q && byId.has(str(q.id)));
    },

    /** 보기 하나를 누른 순간 — **즉시 채점**(5-5). 같은 문항의 두 번째 탭은 무시한다. */
    answer: function (chosen) {
      const q = current();
      if (!q) return null;
      const key = str(q.id);
      if (byId.has(key)) return byId.get(key).result;
      const g = gradeQuestion(q, chosen);
      const item = {
        questionId: key,
        chosen: Array.isArray(chosen) ? chosen.slice() : str(chosen),
        correct: g.gradable ? g.correct : null,   // 채점 불가는 null (5-4)
        ms: Math.max(0, now() - shownAt)
      };
      items.push(item);
      byId.set(key, { item: item, result: g });
      return g;
    },

    /** 채점 결과를 다시 본다(화면을 다시 그릴 때). */
    resultOf: function (questionId) {
      const hit = byId.get(str(questionId));
      return hit ? hit.result : null;
    },

    next: function () {
      if (i < queue.length) i++;
      shownAt = now();
      if (i >= queue.length) finished = true;
      return current();
    },

    /** 5-5 종료 화면 — 점수·오답 목록. `unverified` 는 어느 쪽에도 안 든다. */
    result: function () {
      let score = 0;
      let graded = 0;
      const wrong = [];
      const qById = new Map();
      for (let k = 0; k < queue.length; k++) qById.set(str(queue[k].id), queue[k]);
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        if (it.correct === null) continue;         // 채점하지 않은 문항
        graded++;
        if (it.correct) score++;
        else {
          const q = qById.get(it.questionId);
          if (q) wrong.push(q);
        }
      }
      return {
        score: score,
        total: graded,                              // 채점된 것만 분모다(5-4)
        answered: items.length,
        ungraded: items.length - graded,
        questions: queue.length,
        wrong: wrong
      };
    },

    /** 9-2 `attempts` 레코드. `type: 'quiz'`. */
    toAttempt: function () {
      const at = now();
      const r = this.result();
      return {
        id: newId(),
        docId: str(c.docId),
        sectionId: str(c.sectionId),
        type: 'quiz',
        items: items.map(function (it) {
          return { questionId: it.questionId, chosen: it.chosen, correct: it.correct, ms: it.ms };
        }),
        score: r.score,
        total: r.total,
        at: at,
        durationMs: Math.max(0, at - startedAt)
      };
    },

    /** 9-2 `mistakes` — 오답만. 채점되지 않은 문항은 오답이 아니다(5-4). */
    toMistakes: function (attempt) {
      const out = [];
      const list = (attempt && attempt.items) || [];
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        if (!it || it.correct !== false) continue;
        out.push({
          id: newId(),
          questionId: it.questionId,
          attemptId: str(attempt && attempt.id),
          docId: str(c.docId),
          chosen: it.chosen,
          at: num(attempt && attempt.at) || now(),
          resolvedAt: null,
          note: ''
        });
      }
      return out;
    }
  };
}

/** `attempts` 중 이 섹션의 가장 최근 것. 배열을 받아 고르기만 한다(순수). */
export function latestAttempt(attempts) {
  const list = Array.isArray(attempts) ? attempts : [];
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a || a.type !== 'quiz') continue;
    if (!best || num(a.at) > num(best.at)) best = a;
  }
  return best;
}
