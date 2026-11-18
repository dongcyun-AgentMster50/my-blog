/* ============================================================
   MedReader — 학습 계획 화면 `#/planner` (spec 17-12 5 — 13-2)

   ── UI 계층이다(3-2) ───────────────────────────────────
   숫자는 **전부 `plan/planner.js` 의 `planFor` 결과 그대로**(화면이 계산하지 않는다 — 시험 대상 `examView`).
   이 파일은 읽어서 모으고(`gather`) → 입력을 만들고(`planInputOf`, 순수) → `planFor` → 보일 것(`examView`, 순수) → 그린다.
   **AI 호출 0.** 원격 요청 0([정확히 세기] = 검색 백필 — 기기 안 `pages` 에서). 글자는 textContent 로만(`innerHTML` 0).
   **점수·합격을 예측하지 않는다**(13-D11) — 고지 한 줄. 상한에 가까워도 설정을 바꾸지 않는다(13-D10) — 쓰는 설정 키는
   `planner.exams` 하나뿐이다(정적 시험이 지킨다). 상한을 올리라고 권하지 않는다(13-Q1).

   ── 저장 `settings['planner.exams']` ──────────────────────
   `[{id, name, date, minutesPerDay, weekdays, reserve, targets:[{docId, fileHash, from, to, label}], createdAt, updatedAt}]`(최대 5).
   범위에 `fileHash` 를 함께 둔다 — 9c 가져오기는 설정 값의 `docId` 를 옮기지 않으므로(13-1 남은 2) 화면이 `docId` 로 못 찾으면
   `fileHash` 로 찾는다(`resolveTargets` — 9c 무변, 읽기에서 해결).
   ============================================================ */

import { t, applyTranslations, onLangChange, formatNumber, getLang } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { PLAN, SRS } from '../config.js';
import { go, readerHash, reviewHash } from '../router.js';
import {
  planFor, remainingOf, todayRange, speedOf, callsRateOf, reviewMinutes, bucketFor, dayRead, dayNum
} from '../plan/planner.js';
import { readLogStore, dayKeyOf } from '../plan/readlog.js';
import { tocOf } from '../search/outline.js';
import { chapterRanges, chapterOptionText, printedRange } from './rangepick.js';   // `[15-2 — 15-D11]` 범위 고르기 한 벌
import { prepareDoc } from '../search/engine.js';
import { callsPer10k, usageView, dayShift } from './usage.js';
import { cardStore, dayStartOf, clampNewPerDay } from '../srs/cards.js';

/* ────────────────────────────────────────────────────────
   1. 순수 — 시험 꼴 · 범위 · 입력 · 보일 것 (tests/planner-ui-13.test.mjs)
   ──────────────────────────────────────────────────────── */

export const NAME_MAX = 60;
export const LABEL_MAX = 80;
export const MIN_LO = 10;
export const MIN_HI = 600;
export const MIN_DEFAULT = 60;
export const RESERVE_MAX = 14;
export const ALL_DAYS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const cut = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/** 공부 요일 — 0–6 정수, 겹침 없이 정렬. 배열이 아니면 매일. */
export function normWeekdays(w) {
  if (!Array.isArray(w)) return ALL_DAYS.slice();
  const s = new Set();
  for (const x of w) { const n = Number(x); if (Number.isInteger(n) && n >= 0 && n <= 6) s.add(n); }
  return [...s].sort((a, b) => a - b);
}

/** 범위 하나 — 정수 쪽(1 이상, a ≤ b), 라벨 80자. 꼴이 틀리면 null. */
export function normTarget(x) {
  if (!x || x.docId == null || x.docId === '') return null;
  let a = Math.floor(Number(x.from));
  let b = Math.floor(Number(x.to === undefined ? x.from : x.to));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a > b) { const k = a; a = b; b = k; }
  if (b < 1) return null;
  return { docId: String(x.docId), fileHash: x.fileHash ? String(x.fileHash) : '', from: Math.max(1, a), to: b, label: cut(x.label, LABEL_MAX) };
}

/** 저장된 시험 하나 → 꼴(못 쓰면 null). 없는 칸은 기본값. */
export function normExam(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const date = String(x.date || '');
  if (!DAY_RE.test(date) || !Number.isFinite(dayNum(date))) return null;
  const targets = (Array.isArray(x.targets) ? x.targets : []).map(normTarget).filter(Boolean);
  return {
    id: String(x.id || ''), name: cut(x.name, NAME_MAX), date: date,
    minutesPerDay: clampInt(x.minutesPerDay, MIN_LO, MIN_HI, MIN_DEFAULT),
    weekdays: normWeekdays(x.weekdays), reserve: clampInt(x.reserve, 0, RESERVE_MAX, 0),
    targets: targets, createdAt: Number(x.createdAt) || 0, updatedAt: Number(x.updatedAt) || 0
  };
}

/** 설정 값 → 시험 목록(꼴 틀린 것 버림, 최대 `PLAN.EXAMS_MAX`). */
export function examsOf(v) {
  return (Array.isArray(v) ? v : []).map(normExam).filter((e) => e && e.id).slice(0, PLAN.EXAMS_MAX);
}

/** 가까운 날 먼저 — 오늘 이후(오늘 포함) 시험은 날짜 오름차순, 지난 시험은 그 뒤(최근 것 먼저). */
export function sortExams(list, today) {
  const t0 = dayNum(today);
  const up = [];
  const past = [];
  for (const e of Array.isArray(list) ? list : []) (dayNum(e.date) > t0 ? up : past).push(e);
  up.sort((a, b) => dayNum(a.date) - dayNum(b.date) || (a.createdAt - b.createdAt));
  past.sort((a, b) => dayNum(b.date) - dayNum(a.date) || (a.createdAt - b.createdAt));
  return up.concat(past);
}

/** 서재 "오늘" 줄의 시험 — 가장 가까운 것 하나(없으면 null). */
export function nearestExam(list, today) {
  return sortExams(list, today)[0] || null;
}

/**
 * 범위의 책 찾기 — `docId` 가 서재에 있으면 그것, 없으면 같은 `fileHash` 문서(9c 로 다른 기기에서 온 시험 — 13-1 남은 2).
 * @param {Object[]} targets @param {Object[]} docs 서재 문서 레코드
 * @returns {{docId:?string, fileHash:string, from:number, to:number, label:string, missing:boolean, savedId:string}[]}
 */
export function resolveTargets(targets, docs) {
  const byId = new Map();
  const byHash = new Map();
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || d.id == null) continue;
    byId.set(String(d.id), d);
    if (d.fileHash && !byHash.has(String(d.fileHash))) byHash.set(String(d.fileHash), d);
  }
  return (Array.isArray(targets) ? targets : []).map((x) => {
    const own = byId.get(String(x.docId)) || (x.fileHash ? byHash.get(String(x.fileHash)) : null) || null;
    return Object.assign({}, x, { savedId: String(x.docId), docId: own ? String(own.id) : null, missing: !own });
  });
}

/**
 * 장 고르기 목록 — `[15-2 — 15-D11]` `ui/rangepick.js` 로 옮김(같은 함수 — 여기서는 다시 내보내기만).
 * `tocOf` 의 위 두 깊이(쪽 있는 항목). 장 `to` = 다음 항목(같거나 얕은 깊이) 쪽 − 1, 마지막은 문서 끝.
 */
export { chapterRanges };

/**
 * 한 시험의 `planFor` 입력 — 순수(읽어 둔 것만 받는다).
 * @param {Object} exam  `normExam` 꼴
 * @param {{today:string, docs:Object[], pageChars:Object, readRanges:Object, log:Object, srsLog:Object,
 *          counts:{due:number, fresh:number}, rows30:Object[], capSetting:*, mode:string, speakSource:*, rate:*}} ctx
 */
export function planInputOf(exam, ctx) {
  const c = ctx || {};
  const resolved = resolveTargets(exam.targets, c.docs);
  const targets = resolved.filter((x) => !x.missing).map((x) => ({ docId: x.docId, from: x.from, to: x.to }));
  const docStats = {};
  for (const d of Array.isArray(c.docs) ? c.docs : []) if (d && d.readStats) docStats[String(d.id)] = d.readStats;
  const bucket = bucketFor(c.mode, c.speakSource);
  const speed = speedOf(c.log, { today: c.today, bucket: bucket, rate: c.rate });
  const calls = callsRateOf(callsPer10k(c.rows30, { minChars: PLAN.CALLS_MIN_CHARS }), bucket);
  const cnt = c.counts || {};
  const reviewCount = Math.max(0, Math.floor(Number(cnt.due) || 0)) + Math.max(0, Math.floor(Number(cnt.fresh) || 0));
  const reviewMin = reviewMinutes(reviewCount, c.srsLog, c.today);
  const cap = usageView([], { today: c.today, cap: c.capSetting }).today.cap;
  const input = {
    today: c.today, exam: exam.date, weekdays: exam.weekdays, reserve: exam.reserve, minutesPerDay: exam.minutesPerDay,
    reviewMinToday: reviewMin, speed: speed.cpm, callsPer10k: calls.value, cap: cap, textToSpoken: PLAN.TEXT_TO_SPOKEN,
    targets: targets, pageChars: c.pageChars || {}, readRanges: c.readRanges || {}, docStats: docStats
  };
  return { input: input, resolved: resolved, bucket: bucket, speed: speed, calls: calls, reviewCount: reviewCount, reviewMin: reviewMin, cap: cap };
}

/**
 * 결과 카드에 보일 것 — **`plan`(planFor 결과)의 숫자 그대로**. 화면이 계산하지 않는다(13-2 변이 "자체 계산"이 여기서 걸린다).
 * @param {Object} plan  `planFor` 결과
 * @param {Object} pi    `planInputOf` 결과
 * @param {{log:Object, today:string, resolved?:Object[]}} aux
 */
export function examView(plan, pi, aux) {
  const a = aux || {};
  const pr = plan.progress;
  const live = plan.status !== 'past' && plan.status !== 'done';
  const today = live ? todayRange(pi.input.targets, pi.input.pageChars, pi.input.readRanges, plan.dayChars, pi.input.docStats) : [];
  const perRange = pr ? (pi.resolved || []).map((x) => {
    if (x.missing) return { missing: true, label: x.label, from: x.from, to: x.to, savedId: x.savedId };
    const r = remainingOf([{ docId: x.docId, from: x.from, to: x.to }], pi.input.pageChars, pi.input.readRanges, pi.input.docStats);
    return { missing: false, docId: x.docId, label: x.label, from: x.from, to: x.to, readPages: r.readPages, pages: r.pages };
  }) : [];
  const dr = dayRead(a.log, a.today);
  return {
    status: plan.status,
    days: { n: plan.calendarDays, m: plan.days },
    progress: pr ? { pct: pr.readPct, x: pr.readPages, y: pr.pages, left: plan.remaining, counted: pr.counted, needCount: pr.needCount } : null,
    ranges: perRange,
    need: live ? { n: plan.needMinPerDay } : null,
    finish: live ? { m: pi.input.minutesPerDay, k: pi.input.reviewMinToday, read: plan.readMinPerDay, date: plan.finishDay, slack: plan.slackDays } : null,
    speed: { source: pi.speed.source, cpm: Math.round(pi.speed.cpm), min: Math.round(pi.speed.ms / 60000) },
    calls: live && plan.showCalls ? { c: plan.calls, d: plan.callsPerDay, cap: pi.cap, rate: Math.round(pi.calls.value * 10) / 10, source: pi.calls.source } : null,
    overCap: live && plan.overCap === true,
    today: today,
    todayRead: { x: dr.min, y: plan.readMinPerDay },
    review: { n: pi.reviewCount, min: pi.reviewMin }
  };
}

/** 폼 칸 → 시험(검사). 오류면 `{ok:false, err:i18n 키}`. */
export function examFromForm(f, base, nowMs) {
  const name = cut(f && f.name, NAME_MAX);
  const date = String((f && f.date) || '');
  if (!name) return { ok: false, err: 'planner.err.name' };
  if (!DAY_RE.test(date) || !Number.isFinite(dayNum(date))) return { ok: false, err: 'planner.err.date' };
  const targets = (Array.isArray(f.targets) ? f.targets : []).map(normTarget).filter(Boolean);
  if (!targets.length) return { ok: false, err: 'planner.err.ranges' };
  const weekdays = normWeekdays(f.weekdays);
  const b = base || {};
  const at = Number(nowMs) || 0;
  return {
    ok: true,
    exam: {
      id: b.id || 'ex' + at.toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: name, date: date,
      minutesPerDay: clampInt(f.minutesPerDay, MIN_LO, MIN_HI, MIN_DEFAULT), weekdays: weekdays,
      reserve: clampInt(f.reserve, 0, RESERVE_MAX, 0), targets: targets, createdAt: b.createdAt || at, updatedAt: at
    }
  };
}

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
const S = {
  exams: [], docs: [], views: new Map(),   // id → {plan, pi, view}
  form: null,                              // {base, targets, docId, chapters}
  counting: null,                          // 세는 시험 id
  delId: null, seq: 0, status: ''
};

const iso = (s) => '\u2068' + String(s == null ? '' : s) + '\u2069';
const fmt = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : formatNumber(n));

/** `'YYYY-MM-DD'` → UI 언어 날짜(시간대 없이 — 그 날짜 그대로). */
function fmtDay(key) {
  const n = dayNum(key);
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.DateTimeFormat(getLang(), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(n * 86400000); } catch (e) { return String(key); }
}
/** 요일 이름(UI 언어) — 2026-11-15 는 일요일(0). */
function wdName(w, style) {
  try { return new Intl.DateTimeFormat(getLang(), { weekday: style || 'short', timeZone: 'UTC' }).format((dayNum('2026-11-15') + w) * 86400000); } catch (e) { return String(w); }
}

function todayKey() { return dayKeyOf(Date.now()); }

export function initPlanner() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="planner"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    status: q('#plStatus'), add: q('#plAdd'), max: q('#plMax'), empty: q('#plEmpty'), list: q('#plList'),
    form: q('#plForm'), formTitle: q('#plFormTitle'), name: q('#plName'), date: q('#plDate'), minutes: q('#plMinutes'),
    days: q('#plDays'), reserve: q('#plReserve'), ranges: q('#plRanges'), book: q('#plBook'), mode: q('#plMode'),
    chapterRow: q('#plChapterRow'), chapter: q('#plChapter'), pagesRow: q('#plPagesRow'), from: q('#plFrom'), to: q('#plTo'),
    printed: q('#plPrinted'), noToc: q('#plNoToc'), noBooks: q('#plNoBooks'), addRange: q('#plAddRange'),
    formStatus: q('#plFormStatus'), del: q('#plDelete'), delDialog: q('#plDelDialog'), delTitle: q('#plDelTitle')
  };
  buildDayChips();
  root.addEventListener('click', onClick);
  els.form.addEventListener('submit', (ev) => { ev.preventDefault(); saveForm(); });
  els.book.addEventListener('change', () => { pickBook(els.book.value); });
  els.mode.addEventListener('change', renderRangeMode);
  els.from.addEventListener('input', renderPrinted);
  els.to.addEventListener('input', renderPrinted);
  els.delDialog.addEventListener('click', onDelClick);
  els.delDialog.addEventListener('cancel', (ev) => { ev.preventDefault(); closeDel(); });
  onLangChange(() => { if (!root) return; applyTranslations(root); buildDayChips(); if (!root.hidden) { renderList(); if (S.form) renderForm(); } });
  attachDebugHook();
}

/** 라우터 — `#/planner` 를 열 때마다 다시 읽는다(호출 0). */
export async function showPlanner() {
  if (!root) return;
  applyTranslations(root);
  attachDebugHook();
  await reload();
  attachDebugHook();
}

/** 화면을 떠날 때 — 삭제 확인을 거둔다. 편집 중인 폼은 버린다(저장한 시험은 그대로). */
export function leavePlanner() {
  if (!els) return;
  closeDel();
  S.form = null;
  if (els.form) els.form.hidden = true;
}

async function reload() {
  const my = ++S.seq;
  S.exams = sortExams(examsOf(settings.get('planner.exams')), todayKey());
  const docs = [];
  try { await db.iterate('documents', {}, (v) => { if (v && v.id != null) docs.push(v); }); } catch (e) { /* 빈 서재로 */ }
  if (my !== S.seq) return;
  S.docs = docs;
  await computeAll(my);
  if (my !== S.seq) return;
  renderList();
  if (S.form) renderForm();
}

/** 계산에 쓸 것을 읽는다(호출 0) — 시험들이 함께 쓰는 것은 한 번. */
async function gather(exams) {
  const today = todayKey();
  const ids = new Set();
  for (const e of exams) for (const x of resolveTargets(e.targets, S.docs)) if (!x.missing) ids.add(x.docId);
  const pageChars = {};
  const readRanges = {};
  for (const id of ids) {
    const m = {};
    try {
      await db.iterate('searchText', { index: 'docId', query: id }, (rec) => {
        if (rec && rec.docId === id && Number.isInteger(rec.pageNo)) m[rec.pageNo] = typeof rec.text === 'string' ? rec.text.length : 0;
      });
    } catch (e) { /* 센 쪽 없음 — 평균·기본으로 */ }
    pageChars[id] = m;
    try { readRanges[id] = await readLogStore.readRanges(id); } catch (e) { readRanges[id] = []; }
  }
  let log = { v: 1, days: {} };
  try { log = await readLogStore.readLog(); } catch (e) { /* 기록 없음 */ }
  let srsLog = {};
  let counts = { due: 0, fresh: 0 };
  try {
    srsLog = await cardStore.readLog();
    if ((await db.count('cards')) > 0) {
      const n = Date.now();
      const ds = dayStartOf(n);
      const q = await cardStore.queue({ nowMs: n, dayStartMs: ds, dayEndMs: ds + SRS.DAY_MS, newPerDay: clampNewPerDay(settings.get('srs.newPerDay')) });
      counts = q.counts;
    }
  } catch (e) { /* 카드 없음 */ }
  const rows30 = [];
  const from = dayShift(today, -(PLAN.CALLS_DAYS - 1)) || today;
  try { await db.iterate('usage', {}, (r) => { if (r && r.day && String(r.day) >= from && String(r.day) <= today) rows30.push(r); }); } catch (e) { /* 사용량 없음 */ }
  return {
    today: today, docs: S.docs, pageChars: pageChars, readRanges: readRanges, log: log, srsLog: srsLog, counts: counts, rows30: rows30,
    capSetting: settings.get('ai.dailyCap'), mode: settings.get('readalong.mode'), speakSource: settings.get('readalong.speakSource'),
    rate: settings.get('tts.rate')
  };
}

async function computeAll(my) {
  const ctx = await gather(S.exams);
  if (my !== undefined && my !== S.seq) return;
  S.ctx = ctx;
  S.views = new Map();
  for (const e of S.exams) {
    const pi = planInputOf(e, ctx);
    const plan = planFor(pi.input);
    S.views.set(e.id, { pi: pi, plan: plan, view: examView(plan, pi, { log: ctx.log, today: ctx.today }) });
  }
}

/* ── 그리기 ─────────────────────────────────────────── */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function btn(cls, key, act, extra) {
  const b = el('button', cls);
  b.type = 'button';
  b.textContent = t(key);
  b.setAttribute('data-pa', act);
  if (extra) for (const k of Object.keys(extra)) b.setAttribute(k, extra[k]);
  return b;
}
function line(cls, text, k, v) {
  const p = el('p', 'pl-line' + (cls ? ' ' + cls : ''), text);
  if (k) p.setAttribute('data-k', k);
  if (v !== undefined) p.setAttribute('data-v', JSON.stringify(v));
  return p;
}
function docTitle(id) {
  const d = S.docs.find((x) => String(x.id) === String(id));
  return d ? (d.title || d.fileName || String(d.id)) : '';
}

function renderList() {
  if (!els) return;
  while (els.list.firstChild) els.list.removeChild(els.list.firstChild);
  const full = S.exams.length >= PLAN.EXAMS_MAX;
  els.add.hidden = !!S.form;
  els.add.disabled = full;
  els.max.hidden = !full || !!S.form;
  els.empty.hidden = S.exams.length > 0 || !!S.form;
  els.list.hidden = !!S.form;
  els.status.textContent = S.status;
  for (const e of S.exams) els.list.appendChild(examCard(e));
}

function examCard(e) {
  const box = el('article', 'card pl-exam');
  box.setAttribute('data-exam-id', e.id);
  const v = (S.views.get(e.id) || {}).view;
  const plan = (S.views.get(e.id) || {}).plan;
  box.setAttribute('data-status', plan ? plan.status : '');
  const h = el('h2', 'pl-name', e.name);
  h.setAttribute('dir', 'auto');
  box.appendChild(h);
  box.appendChild(line('pl-date', t('planner.examOn', { date: fmtDay(e.date) })));
  if (!v) return box;

  // 1. 날
  box.appendChild(line('pl-days', t('planner.days', { n: fmt(v.days.n), m: fmt(v.days.m) }), 'days', [v.days.n, v.days.m]));
  // 상태
  const st = { past: 'planner.status.past', done: 'planner.status.done', tight: 'planner.status.tight', short: 'planner.status.short', ok: 'planner.status.ok' }[v.status];
  if (st) box.appendChild(line('pl-st pl-st-' + v.status, t(st), 'status', v.status));

  // 2. 진도
  if (v.progress) {
    const sec = el('div', 'pl-sec pl-progress');
    sec.appendChild(meter(v.progress.pct));
    sec.appendChild(line('', t('planner.progress', { pct: fmt(v.progress.pct), x: fmt(v.progress.x), y: fmt(v.progress.y), n: fmt(v.progress.left) }), 'progress',
      [v.progress.pct, v.progress.x, v.progress.y, v.progress.left]));
    for (const r of v.ranges) sec.appendChild(rangeRow(r));
    sec.appendChild(line('pl-counted muted', t('planner.counted', { n: fmt(v.progress.counted), m: fmt(v.progress.y) }), 'counted', [v.progress.counted, v.progress.y]));
    if (S.counting === e.id) sec.appendChild(line('pl-counting muted', S.countText || t('planner.counting', { done: fmt(0), total: '—' }), 'counting'));
    else if (v.progress.needCount) sec.appendChild(btn('', 'planner.count', 'count', { 'data-id': e.id }));
    box.appendChild(sec);
  }

  // 3. 하루 필요 · 4. 호출
  if (v.need) {
    const sec = el('div', 'pl-sec pl-need');
    if (v.need.n == null) sec.appendChild(line('', t('planner.need.none'), 'need', null));
    else sec.appendChild(line('pl-big', t('planner.need', { n: fmt(v.need.n) }), 'need', v.need.n));
    const f = v.finish;
    if (f.read <= 0) sec.appendChild(line('', t('planner.finish.reviewOnly', { m: fmt(f.m), k: fmt(f.k) }), 'finish', [f.m, f.k, f.read]));
    else if (f.date) {
      const key = f.slack < 0 ? 'planner.finish.short' : 'planner.finish.slack';
      sec.appendChild(line('', t(key, { m: fmt(f.m), k: fmt(f.k), date: fmtDay(f.date), s: fmt(Math.abs(f.slack)) }), 'finish', [f.m, f.k, f.date, f.slack]));
    }
    sec.appendChild(line('muted', v.speed.source === 'measured'
      ? t('planner.speed.measured', { n: fmt(v.speed.min), cpm: fmt(v.speed.cpm) })
      : t('planner.speed.estimate', { cpm: fmt(v.speed.cpm) }), 'speed', [v.speed.source, v.speed.cpm]));
    if (v.calls) {
      sec.appendChild(line('', t('planner.calls', { c: fmt(v.calls.c), d: fmt(v.calls.d), cap: fmt(v.calls.cap) }), 'calls', [v.calls.c, v.calls.d, v.calls.cap]));
      sec.appendChild(line('muted', t(v.calls.source === 'measured' ? 'planner.calls.measured' : 'planner.calls.default', { r: fmt(v.calls.rate) }), 'rate', [v.calls.rate, v.calls.source]));
    }
    if (v.overCap) sec.appendChild(line('warn-note', t('planner.overCap'), 'overCap', true));
    box.appendChild(sec);
  }

  // 5. 오늘
  if (v.need) {
    const sec = el('div', 'pl-sec pl-today');
    for (const r of v.today) {
      const row = el('div', 'pl-row');
      row.appendChild(line('', t('planner.today.where', { book: iso(docTitle(r.docId)), a: fmt(r.from), b: fmt(r.to) }), 'where', [r.docId, r.from, r.to]));
      row.appendChild(btn('', 'planner.today.go', 'go', { 'data-doc': r.docId, 'data-page': String(r.from) }));
      sec.appendChild(row);
    }
    sec.appendChild(line('', t('planner.today.read', { x: fmt(v.todayRead.x), y: fmt(v.todayRead.y) }), 'todayRead', [v.todayRead.x, v.todayRead.y]));
    if (v.review.n > 0) {
      const row = el('div', 'pl-row');
      row.appendChild(line('', t('planner.today.review', { n: fmt(v.review.n), m: fmt(v.review.min) }), 'review', [v.review.n, v.review.min]));
      const b = btn('', 'planner.today.reviewGo', 'cards');
      b.setAttribute('data-nav', '#/cards');
      row.appendChild(b);
      sec.appendChild(row);
    }
    box.appendChild(sec);
  }

  // 6. 읽은 쪽 고치기(접힘)
  const live = (v.ranges || []).filter((r) => !r.missing);
  if (live.length) box.appendChild(fixBox(e, live));

  const row = el('div', 'pl-row pl-actions');
  row.appendChild(btn('', 'planner.edit', 'edit', { 'data-id': e.id }));
  box.appendChild(row);
  return box;
}

function meter(pct) {
  const m = el('div', 'usage-meter pl-meter');
  m.setAttribute('role', 'meter');
  m.setAttribute('aria-valuemin', '0');
  m.setAttribute('aria-valuemax', '100');
  m.setAttribute('aria-valuenow', String(pct));
  m.setAttribute('aria-label', t('planner.progress.label'));
  const f = el('span', 'usage-meter-fill');
  m.style.setProperty('--usage-ratio', String(Math.max(0, Math.min(100, Number(pct) || 0)) / 100));
  m.appendChild(f);
  return m;
}

function rangeRow(r) {
  const row = el('div', 'pl-range');
  const name = (r.label ? r.label + ' · ' : '') + t('planner.range.pages', { a: fmt(r.from), b: fmt(r.to) });
  const p = el('p', 'pl-range-name', r.missing ? name + ' — ' + t('planner.range.missing') : name);
  p.setAttribute('dir', 'auto');
  row.appendChild(p);
  if (!r.missing) {
    const pct = r.pages > 0 ? Math.floor(r.readPages / r.pages * 100) : 0;
    const m = meter(pct);
    m.classList.add('pl-meter-sm');
    row.appendChild(m);
    row.appendChild(line('pl-range-n muted', t('planner.range.read', { x: fmt(r.readPages), y: fmt(r.pages) }), 'range', [r.readPages, r.pages]));
    // `[15-2 — 15-D9]` 복습 묶음 입구 — 이 범위 그대로(호출 0)
    row.appendChild(btn('pl-review', 'planner.review', 'review', { 'data-nav': reviewHash(r.docId, { from: r.from, to: r.to }) }));
  }
  return row;
}

function fixBox(e, ranges) {
  const d = el('details', 'pl-fix');
  const s = el('summary', '', t('planner.fix.title'));
  d.appendChild(s);
  const ids = [...new Set(ranges.map((r) => r.docId))];
  const wrap = el('div', 'pl-fix-grid');
  const sel = el('select', 'pl-input pl-fix-book');
  sel.setAttribute('aria-label', t('planner.form.book'));
  for (const id of ids) { const o = el('option', '', docTitle(id)); o.value = id; sel.appendChild(o); }
  sel.hidden = ids.length < 2;
  wrap.appendChild(sel);
  const r0 = ranges[0];
  const mk = (cls, key, v) => {
    const lab = el('label', 'pl-label');
    const sp = el('span', '', t(key));
    const inp = el('input', 'pl-input ' + cls);
    inp.type = 'number'; inp.min = '1'; inp.step = '1'; inp.inputMode = 'numeric'; inp.value = String(v);
    lab.appendChild(sp); lab.appendChild(inp);
    return lab;
  };
  wrap.appendChild(mk('pl-fix-from', 'planner.form.from', r0.from));
  wrap.appendChild(mk('pl-fix-to', 'planner.form.to', r0.from));
  d.appendChild(wrap);
  const row = el('div', 'pl-row');
  row.appendChild(btn('', 'planner.fix.read', 'mark', { 'data-id': e.id, 'data-on': '1' }));
  row.appendChild(btn('', 'planner.fix.unread', 'mark', { 'data-id': e.id, 'data-on': '0' }));
  d.appendChild(row);
  d.appendChild(el('p', 'muted pl-fix-note', t('planner.fix.note')));
  return d;
}

/* ── 폼 ─────────────────────────────────────────────── */

function buildDayChips() {
  if (!els || !els.days) return;
  const on = new Set(S.form ? S.form.weekdays : ALL_DAYS);
  while (els.days.firstChild) els.days.removeChild(els.days.firstChild);
  for (const w of ALL_DAYS) {
    const b = el('button', 'pl-chip', wdName(w, 'short'));
    b.type = 'button';
    b.setAttribute('data-pa', 'wd');
    b.setAttribute('data-wd', String(w));
    b.setAttribute('aria-pressed', on.has(w) ? 'true' : 'false');
    b.setAttribute('aria-label', wdName(w, 'long'));
    els.days.appendChild(b);
  }
}

function openForm(exam) {
  const e = exam || null;
  S.form = {
    base: e, weekdays: e ? e.weekdays.slice() : ALL_DAYS.slice(),
    targets: e ? e.targets.map((x) => Object.assign({}, x)) : [], docId: null, chapters: []
  };
  els.name.value = e ? e.name : '';
  els.date.value = e ? e.date : '';
  els.date.min = todayKey();
  els.minutes.value = String(e ? e.minutesPerDay : MIN_DEFAULT);
  els.reserve.value = String(e ? e.reserve : 0);
  els.formStatus.textContent = '';
  buildDayChips();
  renderForm();
  renderList();
  const first = S.docs.length ? S.docs[0].id : null;
  pickBook(S.form.targets.length ? (resolveTargets([S.form.targets[S.form.targets.length - 1]], S.docs)[0].docId || first) : first);
  try { els.name.focus(); } catch (err) { /* 초점 실패 무시 */ }
}

function closeForm() {
  S.form = null;
  els.form.hidden = true;
  renderList();
}

function renderForm() {
  const f = S.form;
  els.form.hidden = !f;
  if (!f) return;
  els.formTitle.textContent = t(f.base ? 'planner.form.edit' : 'planner.form.new');
  els.del.hidden = !f.base;
  // 범위 목록
  while (els.ranges.firstChild) els.ranges.removeChild(els.ranges.firstChild);
  const res = resolveTargets(f.targets, S.docs);
  res.forEach((x, i) => {
    const li = el('li', 'pl-range-item');
    const name = (S.docs.length > 1 || x.missing ? (x.missing ? t('planner.range.missing') : docTitle(x.docId)) + ' · ' : '') +
      (x.label ? x.label + ' · ' : '') + t('planner.range.pages', { a: fmt(x.from), b: fmt(x.to) });
    const p = el('span', 'pl-range-text', name);
    p.setAttribute('dir', 'auto');
    li.appendChild(p);
    const rm = btn('pl-range-rm', 'planner.range.remove', 'rm-range', { 'data-i': String(i) });
    rm.setAttribute('aria-label', t('planner.range.remove') + ' — ' + name);
    li.appendChild(rm);
    els.ranges.appendChild(li);
  });
  // 책
  const cur = els.book.value;
  while (els.book.firstChild) els.book.removeChild(els.book.firstChild);
  for (const d of S.docs) { const o = el('option', '', d.title || d.fileName || String(d.id)); o.value = String(d.id); els.book.appendChild(o); }
  els.noBooks.hidden = S.docs.length > 0;
  els.book.disabled = !S.docs.length;
  els.addRange.disabled = !S.docs.length;
  if (f.docId) els.book.value = f.docId; else if (cur) els.book.value = cur;
  renderRangeMode();
}

async function pickBook(id) {
  const f = S.form;
  if (!f) return;
  f.docId = id == null ? null : String(id);
  f.chapters = [];
  if (els.book.value !== f.docId && f.docId) els.book.value = f.docId;
  const doc = S.docs.find((d) => String(d.id) === f.docId);
  f.labels = null;
  if (doc) {
    try {
      const toc = await tocOf(doc.id);
      if (S.form !== f || f.docId !== String(doc.id)) return;
      f.chapters = chapterRanges(toc, doc.pageCount);
      f.labels = toc && Array.isArray(toc.pageLabels) ? toc.pageLabels : null;
    } catch (e) { f.chapters = []; }
    els.from.max = els.to.max = String(Number(doc.pageCount) || '');
  }
  while (els.chapter.firstChild) els.chapter.removeChild(els.chapter.firstChild);
  f.chapters.forEach((c, i) => {
    const o = el('option', '', chapterOptionText(c));
    o.value = String(i);
    els.chapter.appendChild(o);
  });
  els.mode.value = f.chapters.length ? 'chapter' : 'pages';
  renderRangeMode();
}

function renderRangeMode() {
  const f = S.form;
  if (!f) return;
  const hasCh = f.chapters && f.chapters.length > 0;
  els.mode.querySelector('option[value="chapter"]').disabled = !hasCh;
  if (!hasCh) els.mode.value = 'pages';
  const ch = els.mode.value === 'chapter';
  els.chapterRow.hidden = !ch;
  els.pagesRow.hidden = ch;
  els.noToc.hidden = hasCh || !f.docId;
  renderPrinted();
}

function renderPrinted() {
  const f = S.form;
  if (!f) return;
  const pr = printedRange(f.labels, Math.floor(Number(els.from.value)), Math.floor(Number(els.to.value)));
  els.printed.textContent = pr ? t('planner.range.printed', { a: pr.a, b: pr.b }) : '';
}

function addRange() {
  const f = S.form;
  if (!f || !f.docId) return;
  const doc = S.docs.find((d) => String(d.id) === f.docId);
  let r = null;
  if (els.mode.value === 'chapter') {
    const c = f.chapters[Number(els.chapter.value)];
    if (c) r = { docId: f.docId, fileHash: doc && doc.fileHash, from: c.from, to: c.to, label: c.title };
  } else {
    const pc = doc && Number(doc.pageCount) > 0 ? Number(doc.pageCount) : Infinity;
    const a = Math.floor(Number(els.from.value));
    const b = Math.floor(Number(els.to.value || els.from.value));
    if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= 1 && a <= pc && b <= pc) r = { docId: f.docId, fileHash: doc && doc.fileHash, from: a, to: b, label: '' };
    else { els.formStatus.textContent = t('planner.err.pages'); return; }
  }
  const n = normTarget(r);
  if (!n) return;
  f.targets.push(n);
  els.formStatus.textContent = '';
  renderForm();
}

async function saveForm() {
  const f = S.form;
  if (!f) return;
  const r = examFromForm({
    name: els.name.value, date: els.date.value, minutesPerDay: els.minutes.value, reserve: els.reserve.value,
    weekdays: f.weekdays, targets: f.targets
  }, f.base, Date.now());
  if (!r.ok) { els.formStatus.textContent = t(r.err); return; }
  const list = examsOf(settings.get('planner.exams')).filter((x) => x.id !== r.exam.id);
  if (!f.base && list.length >= PLAN.EXAMS_MAX) { els.formStatus.textContent = t('planner.max'); return; }
  list.push(r.exam);
  try { await settings.set('planner.exams', list); } catch (e) { els.formStatus.textContent = t('planner.err.save'); return; }
  S.form = null;
  els.form.hidden = true;
  S.status = t('planner.saved');
  await reload();
}

async function deleteExam(id) {
  const list = examsOf(settings.get('planner.exams')).filter((x) => x.id !== id);
  try { await settings.set('planner.exams', list); } catch (e) { els.formStatus.textContent = t('planner.err.save'); return; }
  S.form = null;
  els.form.hidden = true;
  S.status = t('planner.deleted');
  await reload();
}

function openDel(id) {
  S.delId = id;
  const e = S.exams.find((x) => x.id === id);
  els.delTitle.textContent = t('planner.delete.title', { name: iso(e ? e.name : '') });
  try { els.delDialog.showModal(); } catch (err) { els.delDialog.setAttribute('open', ''); }
  const c = els.delDialog.querySelector('[data-dialog="cancel"]');
  if (c) try { c.focus(); } catch (err) { /* 무시 */ }
}
function closeDel() {
  S.delId = null;
  if (els && els.delDialog && els.delDialog.open) { try { els.delDialog.close(); } catch (e) { els.delDialog.removeAttribute('open'); } }
}
function onDelClick(ev) {
  const b = ev.target.closest('[data-dialog]');
  if (!b) return;
  const id = S.delId;
  closeDel();
  if (b.getAttribute('data-dialog') === 'ok' && id) deleteExam(id);
}

/* ── 동작 ───────────────────────────────────────────── */

async function onClick(ev) {
  const b = ev.target.closest('[data-pa]');
  if (!b || !root.contains(b)) return;
  const act = b.getAttribute('data-pa');
  if (act === 'add') { S.status = ''; openForm(null); return; }
  if (act === 'cancel') { closeForm(); return; }
  if (act === 'delete') { if (S.form && S.form.base) openDel(S.form.base.id); return; }
  if (act === 'add-range') { addRange(); return; }
  if (act === 'rm-range') { if (S.form) { S.form.targets.splice(Number(b.getAttribute('data-i')), 1); renderForm(); } return; }
  if (act === 'wd') {
    if (!S.form) return;
    const w = Number(b.getAttribute('data-wd'));
    const set = new Set(S.form.weekdays);
    if (set.has(w)) set.delete(w); else set.add(w);
    S.form.weekdays = [...set].sort((x, y) => x - y);
    b.setAttribute('aria-pressed', set.has(w) ? 'true' : 'false');
    return;
  }
  if (act === 'edit') { const e = S.exams.find((x) => x.id === b.getAttribute('data-id')); if (e) { S.status = ''; openForm(e); } return; }
  if (act === 'go') { go(readerHash(b.getAttribute('data-doc'), Number(b.getAttribute('data-page')))); return; }
  if (act === 'mark') { await markFromCard(b); return; }
  if (act === 'count') { await countExam(b.getAttribute('data-id')); return; }
  // 'review' — `data-nav` 전역 위임이 연다(여기서 할 일 없음)
}

async function markFromCard(b) {
  const card = b.closest('[data-exam-id]');
  if (!card) return;
  const sel = card.querySelector('.pl-fix-book');
  const id = sel ? sel.value : null;
  const a = Math.floor(Number(card.querySelector('.pl-fix-from').value));
  const z = Math.floor(Number(card.querySelector('.pl-fix-to').value || card.querySelector('.pl-fix-from').value));
  if (!id || !(a >= 1) || !(z >= 1)) { S.status = t('planner.err.pages'); renderList(); return; }
  const on = b.getAttribute('data-on') === '1';
  try { await readLogStore.markRead(id, a, z, on); } catch (e) { S.status = t('planner.err.save'); renderList(); return; }
  S.status = t(on ? 'planner.fix.doneRead' : 'planner.fix.doneUnread', { a: fmt(Math.min(a, z)), b: fmt(Math.max(a, z)) });
  const keep = card.getAttribute('data-exam-id');
  await reload();
  const again = els.list.querySelector('[data-exam-id="' + cssId(keep) + '"] .pl-fix');
  if (again) again.open = true;
}

/** [정확히 세기] — 그 시험 책들의 검색 백필(기기 안 `pages` 에서 — 원격 0). 추출된 쪽만 센다. */
async function countExam(id) {
  const e = S.exams.find((x) => x.id === id);
  if (!e || S.counting) return;
  S.counting = id;
  S.countText = t('planner.counting', { done: fmt(0), total: '—' });
  renderList();
  const ids = [...new Set(resolveTargets(e.targets, S.docs).filter((x) => !x.missing).map((x) => x.docId))];
  for (const docId of ids) {
    try {
      await prepareDoc(docId, { onProgress: (p) => {
        S.countText = t('planner.counting', { done: fmt(p.done), total: fmt(p.total) });
        const n = els.list.querySelector('[data-exam-id="' + cssId(id) + '"] .pl-counting');
        if (n) n.textContent = S.countText;
      } });
    } catch (err) { /* 있는 쪽으로 */ }
  }
  S.counting = null;
  S.countText = '';
  await reload();
}

function cssId(s) { return String(s).replace(/["\\]/g, '\\$&'); }

/* ── 서재 "오늘" 줄의 시험 줄(ui/library.js 가 부른다 — 호출 0) ── */

/**
 * 서재 "오늘" 줄에 보일 시험 — 가까운 것 하나. 숫자는 `planFor`(날 수)에서.
 * @returns {{exam:Object, days:?number, past:boolean}|null}
 */
export function libraryExamLine(examsSetting, today) {
  const e = nearestExam(examsOf(examsSetting), today);
  if (!e) return null;
  const p = planFor({ today: today, exam: e.date, remaining: 1 });
  return { exam: e, days: p.calendarDays, past: p.status === 'past' };
}

/* ── 진단 ───────────────────────────────────────────── */

function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  g.planner = {
    state: function () {
      const out = [];
      for (const e of S.exams) {
        const x = S.views.get(e.id);
        out.push({ id: e.id, status: x ? x.plan.status : null, plan: x ? Object.assign({}, x.plan, { progress: x.plan.progress }) : null,
          input: x ? Object.assign({}, x.pi.input, { pageChars: undefined }) : null, today: x ? x.view.today : null,
          todayRead: x ? x.view.todayRead : null, speed: x ? x.pi.speed : null, calls: x ? x.pi.calls : null });
      }
      return { exams: out, form: !!S.form, counting: S.counting, status: S.status };
    },
    /** 같은 입력으로 다시 계산 — headless 가 화면 숫자와 맞대 본다(입력은 화면이 쓴 것 그대로). */
    recompute: function (id) { const x = S.views.get(id); return x ? planFor(x.pi.input) : null; },
    reload: function () { return reload(); }
  };
}
