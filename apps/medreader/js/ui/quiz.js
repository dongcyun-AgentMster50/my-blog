/* ============================================================
   MedReader — 퀴즈 화면 (spec 5-5 · 12-1 · 12-7 · 16-E)

   ── UI 계층이다(3-1) ────────────────────────────────────
   서비스(`quiz/engine.js`)는 코드·수치만 낸다. 문장은 전부 여기서
   `t()` 로 만든다(3-2). 원서 텍스트는 **언제나 `textContent`** 다(13절).

   ── 화면에 한 문항만 올린다 ─────────────────────────────
   문항 12,000개를 DOM 에 올리지 않는다. `#quizMount` 는 매번 비우고
   **지금 문항 하나**만 그린다(5-5 "문항 카드" → [다음]).

   ── 오프라인이 전제다(5-5 · 16-J) ───────────────────────
   pdf.js 가 없어도 퀴즈는 끝까지 돈다. 빠지는 것은 `hasFigure` 문항의
   원본 크롭뿐이고, 그 실패는 조용히 삼킨다.

   ── 라우터와의 결선 ───────────────────────
   `main.js` 의 `onRoute` 가 `case 'quiz'` 에서 `showQuiz(params)` 를 부르고,
   퀴즈를 떠날 때 `leaveQuiz()` 를 부른다 — 다른 모든 화면과 같은 방식이다.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { t, formatNumber, onLangChange } from '../i18n/index.js';
import { QUIZ, TTS } from '../config.js';
import { fromStored } from '../text/store.js';
import { parseRoute, go, quizHash, readerHash, libraryHash } from '../router.js';
import * as engine from '../quiz/engine.js';
import * as render from '../pdf/render.js';
import { createSpeaker } from '../tts/speaker.js';
import { loadVoices, pickVoice } from '../tts/voices.js';
import { openDoc, extractorFor } from './library.js';

/* ────────────────────────────────────────────────────────
   0. 상태
   ──────────────────────────────────────────────────────── */

let els = null;

const state = {
  docId: null,
  sectionId: null,
  doc: null,
  entry: null,
  questions: [],
  session: null,
  attempt: null,
  /** 늦게 끝난 옛 그리기가 새 화면을 덮어쓰지 않게 한다. */
  token: 0,
  /** 크롭 한 장이 늦게 도착해 다음 문항에 붙지 않게 한다. */
  figureToken: 0,
  crops: null
};

/** 섹션 인덱스를 만드는 중인 문서 — 같은 문서에 두 번 돌리지 않는다. */
const building = new Map();
/** 이미 'done' 을 듣고 있는 Extractor. */
const watched = new WeakSet();
/** 5-5 — 제안 칩은 섹션당 한 번, 닫을 수 있다. */
const dismissedChips = new Set();

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}
function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/* ────────────────────────────────────────────────────────
   1. 배선 — 화면이 보이면 그린다
   ──────────────────────────────────────────────────────── */

function ensureEls() {
  if (els) return els;
  if (typeof document === 'undefined') return null;
  const root = document.querySelector('[data-screen="quiz"]');
  if (!root) return null;
  els = {
    root: root,
    title: root.querySelector('#quizTitle'),
    progress: root.querySelector('#quizProgress'),
    mount: root.querySelector('#quizMount')
  };
  if (!els.mount) { els = null; return null; }
  return els;
}

/** 다른 화면들처럼 `main.js` 가 부트 때 한 번 부른다. */
export function initQuizScreen() {
  ensureEls();
}

/* ────────────────────────────────────────────────────────
   2. 화면 열기
   ──────────────────────────────────────────────────────── */

export async function showQuiz(params) {
  const e = ensureEls();
  if (!e) return;
  const docId = params && params.docId;
  const sectionId = params && params.sectionId;
  if (!docId || !sectionId) { go(libraryHash()); return; }

  const token = ++state.token;
  const same = state.docId === docId && state.sectionId === sectionId && state.session;
  if (same) { repaint(); return; }

  state.docId = docId;
  state.sectionId = sectionId;
  state.doc = null;
  state.entry = null;
  state.questions = [];
  state.session = null;
  state.attempt = null;
  stopSpeaking();
  paintTitle();
  clear(e.mount);
  e.mount.appendChild(noticeCard(t('common.loading')));

  let doc = null;
  try {
    doc = await db.get('documents', docId);
  } catch (err) {
    if (token !== state.token) return;
    clear(e.mount);
    e.mount.appendChild(noticeCard(t('err.dbOpen')));
    return;
  }
  if (token !== state.token) return;
  if (!doc) { go(libraryHash()); return; }
  state.doc = doc;
  state.entry = entryOf(doc, sectionId);
  paintTitle();

  let questions = await loadQuestions(docId, sectionId);
  if (token !== state.token) return;

  if (!questions.length) {
    // 아직 인덱스가 없을 수 있다 — 한 번 만들어 보고 다시 읽는다.
    await ensureSectionIndex(docId, doc);
    if (token !== state.token) return;
    questions = await loadQuestions(docId, sectionId);
    if (token !== state.token) return;
    try {
      const fresh = await db.get('documents', docId);
      if (fresh) { state.doc = fresh; state.entry = entryOf(fresh, sectionId); }
    } catch (err) { /* 제목이 비는 것뿐이다 */ }
  }

  state.questions = questions;
  if (!questions.length) { paintEmpty(); return; }

  const lastAttempt = await loadLastAttempt(docId, sectionId);
  if (token !== state.token) return;
  startSession('all', lastAttempt);
}

function startSession(mode, lastAttempt) {
  state.session = engine.createSession({
    docId: state.docId,
    sectionId: state.sectionId,
    questions: state.questions,
    lastAttempt: lastAttempt || null,
    mode: mode
  });
  state.attempt = null;
  repaint();
}

export function leaveQuiz() {
  stopSpeaking();
  releaseCrops();
  if (els) clear(els.mount);
}

function repaint() {
  if (!els || !state.session) return;
  if (state.session.isFinished()) paintResult();
  else paintQuestion();
}

/* ────────────────────────────────────────────────────────
   3. 읽기 — db 는 여기서만 만진다
   ──────────────────────────────────────────────────────── */

function entryOf(doc, sectionId) {
  const list = (doc && Array.isArray(doc.sectionIndex)) ? doc.sectionIndex : [];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].sectionId === sectionId) return list[i];
  }
  return null;
}

async function loadQuestions(docId, sectionId) {
  const out = [];
  try {
    await db.iterate('questions', {
      index: 'docId_sectionId',
      query: IDBKeyRange.only([docId, sectionId])
    }, (row) => { if (row) out.push(row); });
  } catch (e) {
    return [];
  }
  out.sort((a, b) => num(a.number) - num(b.number));
  return out;
}

async function loadLastAttempt(docId, sectionId) {
  const list = [];
  try {
    await db.iterate('attempts', {
      index: 'docId_sectionId',
      query: IDBKeyRange.only([docId, sectionId])
    }, (row) => { if (row) list.push(row); });
  } catch (e) {
    return null;
  }
  return engine.latestAttempt(list);
}

/**
 * 저장된 쪽을 흘려 준다. **한 트랜잭션에서 커서로** 읽고, 콜백이 끝나면
 * 그 쪽은 버린다 — 7000쪽을 배열로 모으지 않는다(9-2 `pages` 는 쪽당 20KB 급).
 */
function makeIo(docId) {
  return {
    eachPage: function (from, to, cb) {
      return db.iterate('pages', {
        query: IDBKeyRange.bound([docId, from], [docId, to])
      }, (row) => {
        try { cb(fromStored(row)); } catch (e) { /* 깨진 저장본 한 쪽은 건너뛴다 */ }
      });
    },
    putQuestions: function (records) { return db.putAll('questions', records); },
    saveIndex: async function (entries) {
      const doc = await db.get('documents', docId);
      if (!doc) return;
      doc.sectionIndex = entries;
      await db.put('documents', doc);
    }
  };
}

/**
 * 5-4 — 파싱은 **리더 렌더 경로 밖에서** 돈다. 예외는 삼키고 칩을 안
 * 띄우면 그만이다. 같은 문서에 두 번 돌리지 않는다.
 */
export function ensureSectionIndex(docId, doc, opts) {
  const o = opts || {};
  if (!docId) return Promise.resolve(null);
  const inflight = building.get(docId);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const d = doc || await db.get('documents', docId);
      if (!d) return null;
      const ex = d.extraction || {};
      const hasIndex = Array.isArray(d.sectionIndex) && d.sectionIndex.length > 0;
      // 추출이 끝나기 전에도 의미가 있다(5-4: 부분 상태에서는 unverified,
      // 나중 재파싱이 verified 로 승격한다). 다만 **다 만든 인덱스가 이미
      // 있는데 추출이 아직이면** 다시 돌리지 않는다 — 'done' 이 부른다.
      if (hasIndex && !o.force && !ex.done) return d.sectionIndex;
      if (hasIndex && !o.force && ex.done && d.sectionIndexDone) return d.sectionIndex;
      const out = await engine.buildSectionIndex(makeIo(docId), {
        docId: docId,
        pageCount: num(d.pageCount)
      });
      if (ex.done) {
        try {
          const fresh = await db.get('documents', docId);
          if (fresh) { fresh.sectionIndexDone = true; await db.put('documents', fresh); }
        } catch (e) { /* 표시 실패는 다음에 다시 만들 뿐이다 */ }
      }
      return out.sections;
    } catch (e) {
      return null;                       // 5-4 — 파서가 실패해도 리더는 산다
    } finally {
      building.delete(docId);
    }
  })();
  building.set(docId, p);
  return p;
}

/* ────────────────────────────────────────────────────────
   4. 그리기 — 문항 카드 (5-5)
   ──────────────────────────────────────────────────────── */

function paintTitle() {
  if (!els) return;
  const entry = state.entry;
  const label = (entry && entry.title) ||
    t('quiz.section.fallback', { id: shortSectionId(state.sectionId) });
  els.title.textContent = label;
  paintProgress();
}

function shortSectionId(id) {
  const s = String(id == null ? '' : id);
  return s.indexOf('sec-') === 0 ? s.slice(4) : s;
}

function paintProgress() {
  if (!els || !els.progress) return;
  const s = state.session;
  if (!s || s.isFinished() || !s.total()) { els.progress.textContent = ''; return; }
  els.progress.textContent = t('quiz.progress', {
    index: formatNumber(s.position()), total: formatNumber(s.total())
  });
}

function noticeCard(text) {
  const card = el('div', 'card');
  const p = el('p');
  p.textContent = text;
  card.appendChild(p);
  return card;
}

function paintEmpty() {
  if (!els) return;
  clear(els.mount);
  const box = el('div', 'placeholder');
  const h = el('h2');
  h.textContent = t('quiz.empty.title');
  const p = el('p');
  p.textContent = t('quiz.empty.body');
  box.appendChild(h);
  box.appendChild(p);
  const row = el('div', 'row quiz-actions');
  row.appendChild(button('quiz.result.backToReader', 'primary', () => backToReader()));
  box.appendChild(row);
  els.mount.appendChild(box);
  paintProgress();
}

function button(key, cls, onClick) {
  const b = el('button', cls || '');
  b.type = 'button';
  b.setAttribute('data-i18n', key);
  b.textContent = t(key);
  b.addEventListener('click', onClick);
  return b;
}

function paintQuestion() {
  const s = state.session;
  const q = s && s.current();
  if (!q) { paintResult(); return; }
  const token = ++state.figureToken;

  clear(els.mount);
  paintProgress();

  const card = el('article', 'quiz-card');
  card.setAttribute('data-question-id', String(q.id));

  /* 머리 — 번호 + 배지. 배지는 **둘 중 하나만** 보인다(16-E). */
  const head = el('div', 'quiz-head');
  const no = el('span', 'quiz-number');
  no.textContent = t('quiz.question.number', { number: formatNumber(num(q.number)) });
  head.appendChild(no);

  const gradable = engine.isGradable(q);
  const badge = el('span', gradable ? 'quiz-badge' : 'quiz-badge quiz-badge-unverified');
  badge.textContent = gradable ? ('📕 ' + t('quiz.badge.verified')) : t('quiz.badge.unverified');
  head.appendChild(badge);
  card.appendChild(head);

  /* 본문 — 원서 텍스트는 LTR·en 이다(11-3). */
  const stem = el('p', 'quiz-stem');
  stem.setAttribute('dir', 'ltr');
  stem.setAttribute('lang', 'en');
  stem.textContent = String(q.stem || '');
  card.appendChild(stem);

  /* 5-3 — 그림 문항은 원본 크롭을 함께 보인다. pdf.js 가 없으면 조용히 빠진다. */
  if (q.hasFigure) {
    const fig = el('figure', 'quiz-figure');
    fig.hidden = true;
    card.appendChild(fig);
    fillFigure(fig, q, token);
  }

  /* 보기 — 48px 이상, 375px 에서 넘치지 않게 세로로 쌓는다(16-G). */
  const list = el('div', 'quiz-options');
  const opts = Array.isArray(q.options) ? q.options : [];
  for (let i = 0; i < opts.length; i++) {
    list.appendChild(optionButton(q, opts[i]));
  }
  card.appendChild(list);

  const feedback = el('div', 'quiz-feedback');
  feedback.id = 'quizFeedback';
  card.appendChild(feedback);

  els.mount.appendChild(card);

  // 이미 답한 문항(언어 전환·되돌아오기)이면 결과를 다시 그린다.
  const prev = s.resultOf(q.id);
  if (prev) paintFeedback(q, prev);
}

function optionButton(q, opt) {
  const b = el('button', 'quiz-option');
  b.type = 'button';
  b.setAttribute('data-letter', String(opt.letter || ''));
  const letter = el('span', 'quiz-letter');
  letter.textContent = String(opt.letter || '');
  const text = el('span', 'quiz-option-text');
  text.setAttribute('dir', 'ltr');
  text.setAttribute('lang', 'en');
  text.textContent = String(opt.text || '');
  b.appendChild(letter);
  b.appendChild(text);
  b.addEventListener('click', () => onPick(q, String(opt.letter || '')));
  return b;
}

/** 5-5 — 보기 탭 → **즉시 채점**. 두 번째 탭은 무시된다. */
function onPick(q, letter) {
  const s = state.session;
  if (!s || s.answered()) return;
  const result = s.answer(letter);
  paintFeedback(q, result, letter);
}

function paintFeedback(q, result, letter) {
  const card = els.mount.querySelector('.quiz-card');
  if (!card) return;
  const chosen = letter || (result && result.chosen && result.chosen[0]) || '';
  const expected = (result && result.expected) || [];

  const buttons = card.querySelectorAll('.quiz-option');
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const l = b.getAttribute('data-letter');
    b.disabled = true;
    if (result.gradable && expected.indexOf(l) >= 0) b.setAttribute('data-state', 'correct');
    if (l === chosen) {
      b.setAttribute('aria-pressed', 'true');
      if (!result.gradable) b.setAttribute('data-state', 'picked');
      else if (!result.correct) b.setAttribute('data-state', 'wrong');
    }
  }

  const box = card.querySelector('#quizFeedback');
  if (!box) return;
  clear(box);

  if (!result.gradable) {
    // 5-4 — 채점하지 않는다. 원문을 보라고 안내하고 그 쪽으로 보낸다.
    const p = el('p', 'quiz-verdict quiz-verdict-unknown');
    p.textContent = t('quiz.unverified.help');
    box.appendChild(p);
    const row = el('div', 'row quiz-actions');
    const jump = el('button', '');
    jump.type = 'button';
    jump.textContent = t('quiz.unverified.goToPage', { page: formatNumber(num(q.pageNo) || 1) });
    jump.addEventListener('click', () => go(readerHash(state.docId, num(q.pageNo) || 1)));
    row.appendChild(jump);
    box.appendChild(row);
  } else {
    const p = el('p', result.correct ? 'quiz-verdict quiz-verdict-correct' : 'quiz-verdict quiz-verdict-wrong');
    p.textContent = result.correct ? t('quiz.answer.correct') : t('quiz.answer.wrong');
    box.appendChild(p);
    const ans = el('p', 'quiz-expected');
    ans.textContent = t('quiz.answer.expected', { letters: expected.join(', ') });
    box.appendChild(ans);
  }

  const explanation = q.explanation && q.explanation.en ? String(q.explanation.en) : '';
  box.appendChild(explanationBlock(explanation));

  const row = el('div', 'row quiz-actions');
  const last = state.session.position() >= state.session.total();
  row.appendChild(button(last ? 'quiz.finish' : 'quiz.next', 'primary', () => {
    stopSpeaking();
    state.session.next();
    repaint();
  }));
  box.appendChild(row);
}

function explanationBlock(text) {
  const det = el('details', 'quiz-explanation');
  det.open = true;                     // 5-5 — 채점 직후 **펼친다**
  const sum = el('summary');
  sum.textContent = t('quiz.explanation.title');
  det.appendChild(sum);
  if (!text) {
    const p = el('p', 'muted');
    p.textContent = t('quiz.explanation.none');
    det.appendChild(p);
    return det;
  }
  const p = el('p', 'quiz-explanation-text');
  p.setAttribute('dir', 'ltr');
  p.setAttribute('lang', 'en');
  p.textContent = text;
  det.appendChild(p);

  const row = el('div', 'row quiz-actions');
  const speak = button('quiz.explanation.speak', '', () => toggleSpeak(text, speak));
  row.appendChild(speak);
  det.appendChild(row);
  return det;
}

/* ────────────────────────────────────────────────────────
   5. 결과 (5-5)
   ──────────────────────────────────────────────────────── */

function paintResult() {
  if (!els) return;
  const s = state.session;
  const r = s.result();
  clear(els.mount);
  paintProgress();

  const card = el('article', 'quiz-card quiz-result');
  const h = el('h2');
  h.textContent = t('quiz.result.title');
  card.appendChild(h);

  const score = el('p', 'quiz-score');
  score.textContent = t('quiz.result.score', {
    score: formatNumber(r.score), total: formatNumber(r.total)
  });
  card.appendChild(score);

  if (r.ungraded > 0) {
    const p = el('p', 'muted');
    p.textContent = t('quiz.result.ungraded', { n: r.ungraded });
    card.appendChild(p);
  }

  if (r.wrong.length) {
    const h3 = el('h3');
    h3.textContent = t('quiz.result.wrong.title');
    card.appendChild(h3);
    const ul = el('ul', 'quiz-wrong');
    for (let i = 0; i < r.wrong.length; i++) {
      const q = r.wrong[i];
      const li = el('li');
      const b = el('button', 'link');
      b.type = 'button';
      b.textContent = t('quiz.question.number', { number: formatNumber(num(q.number)) });
      b.addEventListener('click', () => go(readerHash(state.docId, num(q.pageNo) || 1)));
      li.appendChild(b);
      ul.appendChild(li);
    }
    card.appendChild(ul);
  } else if (r.total > 0) {
    const p = el('p');
    p.textContent = t('quiz.result.allCorrect');
    card.appendChild(p);
  }

  const row = el('div', 'row quiz-actions');
  if (r.wrong.length) {
    row.appendChild(button('quiz.result.retryWrong', 'primary', () => retryWrong()));
  }
  row.appendChild(button('quiz.result.backToReader', '', () => backToReader()));
  card.appendChild(row);
  els.mount.appendChild(card);

  saveAttempt().catch(() => { /* 저장 실패가 결과 화면을 막지 않는다 */ });
}

/** 9-2 — 결과는 `attempts` 에, 오답은 `mistakes` 에(5-5 는 저장까지만). */
async function saveAttempt() {
  const s = state.session;
  if (!s || state.attempt) return;
  const attempt = s.toAttempt();
  if (!attempt.items.length) return;          // 아무것도 풀지 않았으면 남기지 않는다
  state.attempt = attempt;
  await db.put('attempts', attempt);
  const misses = s.toMistakes(attempt);
  if (misses.length) await db.putAll('mistakes', misses);
}

function retryWrong() {
  const last = state.attempt || state.session.toAttempt();
  stopSpeaking();
  startSession('wrong-only', last);
}

function backToReader() {
  const page = (state.entry && num(state.entry.startPage)) || 1;
  go(readerHash(state.docId, page || 1));
}

/* ────────────────────────────────────────────────────────
   6. 그림 크롭 (5-3 · 4-8) — pdf.js 가 없으면 조용히 빠진다
   ──────────────────────────────────────────────────────── */

function cropCache() {
  if (!state.crops) {
    state.crops = render.createLru(QUIZ.CROP_CACHE_MAX, (key, val) => {
      if (val && val.url) { try { URL.revokeObjectURL(val.url); } catch (e) { /* 이미 해제 */ } }
    });
  }
  return state.crops;
}

function releaseCrops() {
  if (state.crops) state.crops.clear();
}

async function fillFigure(fig, q, token) {
  try {
    const img = await cropFor(q);
    if (!img || token !== state.figureToken || !fig.isConnected) return;
    const box = el('div', 'quiz-figure-box');
    const im = el('img', 'quiz-crop');
    im.src = img.url;
    im.alt = t('quiz.figure.alt');
    im.decoding = 'async';
    box.appendChild(im);
    fig.appendChild(box);
    fig.hidden = false;
  } catch (e) {
    // 오프라인(2-3) — 크롭만 빠지고 퀴즈는 계속 돈다.
  }
}

async function cropFor(q) {
  const pageNo = num(q.pageNo);
  if (!pageNo) return null;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const scale = render.cropScale(dpr);
  const key = render.cropKey(state.docId, pageNo, String(q.id), scale);
  const hit = cropCache().get(key);
  if (hit) return hit;

  const rec = await db.get('pages', [state.docId, pageNo]);
  if (!rec) return null;
  const layout = fromStored(rec);
  const wanted = new Set();
  const ids = (q.paraIds || []).concat((q.options || []).map((o) => o.paraId));
  for (let i = 0; i < ids.length; i++) if (ids[i]) wanted.add(String(ids[i]));
  const box = unionBox(layout.paragraphs, wanted);
  if (!box) return null;
  // 그림은 보통 문항 아래에 온다 — 아래쪽(PDF 좌표에서 y0 방향)으로 더 담는다.
  box.y0 -= QUIZ.CROP_EXTRA_PT;
  const rect = render.cropBox(box, { width: layout.width, height: layout.height });
  if (!rect) return null;

  const pdfDoc = await pdfDocFor(state.docId);
  if (!pdfDoc) return null;
  const out = await render.renderRegionImage(pdfDoc, pageNo, rect, {
    scale: scale,
    makeCanvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  });
  if (!out || !out.blob) return null;
  const img = { url: URL.createObjectURL(out.blob), width: out.width, height: out.height };
  cropCache().set(key, img);
  return img;
}

function unionBox(paragraphs, wanted) {
  let box = null;
  const list = paragraphs || [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p || !p.bbox || !wanted.has(String(p.id))) continue;
    const b = p.bbox;
    if (!box) box = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
    else {
      box.x0 = Math.min(box.x0, b.x0);
      box.y0 = Math.min(box.y0, b.y0);
      box.x1 = Math.max(box.x1, b.x1);
      box.y1 = Math.max(box.y1, b.y1);
    }
  }
  return box;
}

/** 크롭이 쓰는 PDFDocumentProxy. pdf.js 로드 실패는 호출자가 삼킨다. */
async function pdfDocFor(docId) {
  const ex = extractorFor(docId) || await openDoc(docId);
  return (ex && ex.pdfDoc) || null;
}

/* ────────────────────────────────────────────────────────
   7. 해설 낭독 (5-5)
   ★ 리더의 `speaker`(ui/controls.js)를 건드리지 않는다. 퀴즈 전용 인스턴스를
     따로 두므로 리더의 낭독 큐·현재 줄이 이 낭독 때문에 바뀌지 않는다.
   ──────────────────────────────────────────────────────── */

let speaker = null;
let speakParas = [];
let speakBtn = null;

function ensureSpeaker() {
  if (speaker) return speaker;
  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  if (!synth) return null;
  speaker = createSpeaker({
    synth: synth,
    makeUtterance: (text) => new window.SpeechSynthesisUtterance(text),
    view: {
      paras: () => speakParas,
      page: () => ({ page: 1, pageCount: 1 }),
      goToPage: () => Promise.resolve(false),
      show: () => true,
      markDone: () => { }
    }
  });
  speaker.addEventListener('end', () => paintSpeakButton(false));
  speaker.addEventListener('error', () => paintSpeakButton(false));
  speaker.setRate(settings.get('tts.rate'));
  speaker.setUnit(settings.get('tts.unit') === 'line' ? 'line' : 'sentence');
  loadVoices(synth, TTS.VOICES_TIMEOUT_MS).then((list) => {
    const v = pickVoice('en', list, settings.get('tts.voice.en'));
    if (v && speaker) {
      speaker.setVoice('en', v);
      speaker.setDocLang(String(v.lang || 'en-US').replace(/_/g, '-'));
    }
  }).catch(() => { /* 음성 목록 실패는 낭독만 못 할 뿐이다 */ });
  return speaker;
}

function toggleSpeak(text, btn) {
  const sp = ensureSpeaker();
  if (!sp) return;
  speakBtn = btn;
  if (sp.getState() === 'speaking') { sp.stop(); paintSpeakButton(false); return; }
  speakParas = [{
    id: 'quiz-explanation',
    kind: 'body',
    lines: String(text).split('\n').map((line, i) => ({
      id: 'quiz-exp-' + i, text: line, hyphen: 'none'
    })).filter((l) => l.text.trim().length > 0)
  }];
  sp.stop();
  sp.play();
  paintSpeakButton(true);
}

function stopSpeaking() {
  if (speaker) { try { speaker.stop(); } catch (e) { /* 이미 멈춤 */ } }
  paintSpeakButton(false);
}

function paintSpeakButton(on) {
  if (!speakBtn || !speakBtn.isConnected) { speakBtn = null; return; }
  const key = on ? 'quiz.explanation.stop' : 'quiz.explanation.speak';
  speakBtn.setAttribute('data-i18n', key);
  speakBtn.textContent = t(key);
}

/* ────────────────────────────────────────────────────────
   8. 리더의 제안 칩 (5-4 · 5-5)
   `ui/reader.js` 가 쪽을 그릴 때마다 부른다. **리더 렌더 경로를 붙잡지
   않는다** — 인덱스 만들기는 백그라운드로 던지고 곧바로 돌아온다.
   ──────────────────────────────────────────────────────── */

export function updateReaderChip(host, ctx) {
  if (!host) return;
  const docId = ctx && ctx.docId;
  if (!docId) { host.hidden = true; return; }

  const ex = ctx.extractor || extractorFor(docId);
  if (ex && !watched.has(ex)) {
    watched.add(ex);
    // 추출이 끝나면 다시 파싱한다 — unverified 가 verified 로 승격된다(5-4).
    ex.addEventListener('done', () => {
      ensureSectionIndex(docId, null, { force: true }).then(() => {
        db.get('documents', docId).then((doc) => {
          if (doc) paintChip(host, doc, ctx.page, docId);
        }).catch(() => { /* 칩만 안 뜬다 */ });
      }).catch(() => { /* 같은 이유 */ });
    });
  }

  const doc = ctx.doc || null;
  paintChip(host, doc, ctx.page, docId);

  // 인덱스가 아직 없으면 지금 만들어 둔다(비동기 — 리더는 기다리지 않는다).
  const hasIndex = doc && Array.isArray(doc.sectionIndex) && doc.sectionIndex.length > 0;
  const done = !!(doc && doc.extraction && doc.extraction.done);
  if (!hasIndex || (done && !doc.sectionIndexDone)) {
    ensureSectionIndex(docId, doc).then((entries) => {
      if (!entries) return;
      db.get('documents', docId).then((fresh) => {
        if (fresh) paintChip(host, fresh, ctx.page, docId);
      }).catch(() => { });
    }).catch(() => { });
  }
}

function paintChip(host, doc, page, docId) {
  const entry = chipEntry(doc, page);
  if (!entry || dismissedChips.has(docId + '|' + entry.sectionId)) {
    host.hidden = true;
    clear(host);
    return;
  }
  if (host.getAttribute('data-section-id') === entry.sectionId && !host.hidden) return;

  clear(host);
  host.setAttribute('data-section-id', entry.sectionId);
  const open = el('button', 'quiz-chip-open');
  open.type = 'button';
  open.textContent = t('quiz.chip.open');
  open.addEventListener('click', () => go(quizHash(docId, entry.sectionId)));
  const meta = el('span', 'quiz-chip-meta');
  meta.textContent = t('quiz.chip.meta', { n: num(entry.questions) });
  const close = el('button', 'quiz-chip-dismiss');
  close.type = 'button';
  close.textContent = t('quiz.chip.dismiss');
  close.setAttribute('aria-label', t('quiz.chip.dismiss'));
  close.addEventListener('click', () => {
    dismissedChips.add(docId + '|' + entry.sectionId);
    host.hidden = true;
    clear(host);
  });
  host.appendChild(open);
  host.appendChild(meta);
  host.appendChild(close);
  host.hidden = false;
}

/** 지금 쪽이 든 섹션 중 **자격이 있는 것**(5-4). 없으면 null. */
export function chipEntry(doc, page) {
  const list = (doc && Array.isArray(doc.sectionIndex)) ? doc.sectionIndex : [];
  const p = num(page);
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || p < num(e.startPage) || p > num(e.endPage)) continue;
    if (!engine.isIndexEntryQuizWorthy(e)) continue;
    if (!best || (num(e.endPage) - num(e.startPage)) < (num(best.endPage) - num(best.startPage))) best = e;
  }
  return best;
}

/* 언어 전환 시 자리표시자 텍스트도 다시 쓴다(16-H). */
if (typeof document !== 'undefined') {
  onLangChange(() => {
    if (els && els.root && !els.root.hidden) { paintTitle(); repaint(); }
  });
}
