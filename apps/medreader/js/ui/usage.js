/* ============================================================
   MedReader — 사용량 화면 (spec 15절 · 17-7-6 4-7 — 8c-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `#/usage` — 오늘(호출 / 상한 · 종류별 · 프로바이더·모델 · 토큰 · 캐시 적중·기기 내 · 낭독 번역 효율 · 상한까지 남은 쪽) ·
   이번 달(일별 막대 31칸 · 합계 · 절약된 호출 · 적중률) · 캐시(항목 수 · 용량 · [설정에서 비우기]) · AI Studio 링크.

   ── 지키는 것 ──────────────────────────────────────────
   ★ 호출 0(6절) — 기기 안 숫자만 읽는다: `usage` 행 · `aiCache` 훑기(`cache.stats()` — 읽기만) · 마지막으로 연 책의
     `readStats`(8cf-D10). 화면을 열 때 90일 지난 `usage` 행을 지운다(8cf-D12 — 부팅이 아니라).
   ★ 숫자는 전부 순수 `usageView(rows, ctx)` 가 만든다(`tests/usage-8c.test.mjs`). 화면은 그리기만 — 글자는 `textContent`, `innerHTML` 0.
   ★ 상한 셈은 파이프라인과 **한 벌**(`dailyCapOf`·`capUsedOf` — 검증 제외). "1만 자당 호출" 식은 `callsPer10k(rows)` 로
     떼어 export(13 학습 계획이 같은 식을 쓴다 — crossstep "8c-2").
   ★ 무료 티어 한도 숫자는 어디에도 없다(16-J) — AI Studio 링크 한 줄. 서비스가 429 로 거절한 수는 "1분 한도일 수도 있다"는
     문구로 보인다(파이프라인은 429 를 모두 하루 소진으로 읽는다 — 그 판정은 8a 몫, 이 화면은 오해만 줄인다).
   ★ 캐시 [비우기] 장치는 설정 AI 탭 한 곳(8cf-D11) — 여기서는 `#/settings/cache` 로 보낸다.
   ============================================================ */

import { t, applyTranslations, onLangChange, formatNumber, formatBytes, getLang, hasKey } from '../i18n/index.js';
import * as db from '../db.js';
import * as settings from '../settings.js';
import { AI } from '../config.js';
import * as provider from '../ai/provider.js';
import { localDay } from '../ai/provider.js';
import { dailyCapOf, capUsedOf } from '../ai/pipeline.js';
import { createCache } from '../ai/cache.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분
   ──────────────────────────────────────────────────────── */

export const USAGE_HASH = '#/usage';

/** 90일 지난 `usage` 행은 화면을 열 때 지운다(15절 · 8cf-D12). */
export const KEEP_DAYS = 90;

/** "오늘 상한까지 약 n쪽" 은 그 책의 실측 쪽이 이만큼은 있어야 보인다(15절). */
export const MIN_STAT_PAGES = 5;

/** 늘 보이는 종류(0 이어도) — 번역(탭·문장) · 낭독 번역 · 단어 · 요약(11 자리) · `[11-4]` 설명 · `[16-2]` 개념도 · 검증. 그 밖은 0 보다 클 때만. */
export const SHOW_KINDS = Object.freeze(['translate', AI.READALONG_KIND, AI.TERM_KIND, 'summarize', AI.EXPLAIN_KIND, AI.DIAGRAM_KIND, AI.VERIFY_KIND]);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * **"1만 자당 호출"** — 낭독 동반 번역 원격 호출 수 ÷ 그 호출들로 보낸 원문 글자 × 10,000(15절). 날짜 범위는 호출자가
 * 행을 골라 넘긴다(오늘 한 행 · 13 계획의 최근 30일). 글자가 0 이면(또는 `minChars` 미만이면) null. 반올림하지 않는다.
 * @param {Object[]} rows  `usage` 행들
 * @param {{minChars?:number}} [opts]
 * @returns {number|null}
 */
export function callsPer10k(rows, opts) {
  const o = opts || {};
  let calls = 0;
  let chars = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r) continue;
    calls += num(r.byKind && r.byKind[AI.READALONG_KIND]);
    chars += num(r.charsTranslated);
  }
  if (!(chars > 0) || chars < num(o.minChars)) return null;
  return calls / chars * 10000;
}

/**
 * 낭독 번역 효율 한 줄의 숫자 — "낭독 번역 {calls}회 · {chars}자 → 호출당 평균 {perCall}자 · 1만 자당 {per10k}회".
 * `calls = 0`(또는 글자 0)이면 `perCall`·`per10k` 가 null(화면은 "—"). `per10k` 는 소수 1자리.
 */
export function readalongStats(rows) {
  let calls = 0;
  let chars = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r) continue;
    calls += num(r.byKind && r.byKind[AI.READALONG_KIND]);
    chars += num(r.charsTranslated);
  }
  const ok = calls > 0 && chars > 0;
  const p = ok ? callsPer10k(rows) : null;
  return { calls: calls, chars: chars, perCall: ok ? Math.round(chars / calls) : null, per10k: p === null ? null : Math.round(p * 10) / 10 };
}

/**
 * "오늘 상한까지 약 n쪽" — `floor(남은 호출 × 호출당 평균 글자 ÷ 그 책의 쪽당 글자)`(15절). **쪽당 글자는 그 책의 실측**
 * (`readStats.chars / readStats.pages`) — 책마다 다르다. 쪽이 `MIN_STAT_PAGES` 미만·평균 없음이면 null(숨김).
 * @returns {{n:number, perPage:number}|null}
 */
export function pagesLeft(left, perCall, readStats) {
  const rs = readStats || {};
  const pages = num(rs.pages);
  const chars = num(rs.chars);
  if (!(perCall > 0) || pages < MIN_STAT_PAGES || !(chars > 0)) return null;
  const perPage = chars / pages;
  return { n: Math.max(0, Math.floor(Math.max(0, num(left)) * perCall / perPage)), perPage: Math.round(perPage) };
}

/** `'YYYY-MM-DD'` 에서 `delta` 일(로컬 달력). 못 읽으면 null. */
export function dayShift(day, delta) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!m) return null;
  return localDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + num(delta)));
}

/** 90일 지난 행의 키 — `day < today − keep`. 날짜 꼴이 아닌 키는 건드리지 않는다. */
export function staleDays(days, today, keep) {
  const cut = dayShift(today, -(keep == null ? KEEP_DAYS : num(keep)));
  if (!cut) return [];
  return (Array.isArray(days) ? days : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)) && String(d) < cut);
}

/**
 * `[8c-2b]` 화면을 열 때의 지우기 — `KEEP_DAYS`(90일) 지난 행을 `del(day)` 로 지우고 남는 행을 돌려준다(8cf-D12).
 * 지우기 실패는 화면을 막지 않는다(그 행은 화면에서만 빼고 다음에 다시). `load()` 가 이것만 부른다 — 시험이 경계를 본다(8c2R #5).
 * @param {Object[]} rows  `usage` 행들
 * @param {string} today   `'YYYY-MM-DD'`
 * @param {(day:string)=>Promise<*>} del
 * @returns {Promise<{keep:Object[], cleaned:number}>}
 */
export async function pruneUsage(rows, today, del) {
  const list = Array.isArray(rows) ? rows : [];
  const stale = staleDays(list.map((r) => r && r.day), today, KEEP_DAYS);
  let cleaned = 0;
  for (const d of stale) {
    try { await del(d); cleaned++; } catch (e) { /* 다음에 다시 */ }
  }
  return { keep: list.filter((r) => stale.indexOf(r && r.day) < 0), cleaned: cleaned };
}

/**
 * 이번 달 막대 31칸 — 그달에 없는 날(30일·2월)은 `out`, 높이 `h` = 그날 호출 / 그달 최대(최대 0 이면 0). 순수 함수.
 * @returns {{cells:{d:number, day:string|null, calls:number, h:number, out:boolean, today:boolean, future:boolean}[], max:number}}
 */
export function monthBars(rows, today) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(today || ''));
  const byDay = new Map();
  for (const r of Array.isArray(rows) ? rows : []) if (r && r.day) byDay.set(String(r.day), r);
  const cells = [];
  let max = 0;
  const y = m ? Number(m[1]) : 0;
  const mo = m ? Number(m[2]) : 0;
  const len = m ? new Date(y, mo, 0).getDate() : 0;
  for (let d = 1; d <= 31; d++) {
    const day = d <= len ? m[1] + '-' + m[2] + '-' + (d < 10 ? '0' + d : String(d)) : null;
    const calls = day && byDay.has(day) ? num(byDay.get(day).calls) : 0;
    if (calls > max) max = calls;
    cells.push({ d: d, day: day, calls: calls, h: 0, out: !day, today: day === today, future: !!day && day > today });
  }
  for (const c of cells) c.h = max > 0 ? c.calls / max : 0;
  return { cells: cells, max: max };
}

/**
 * **사용량 화면의 숫자 전부** — 순수 함수(DOM·DB·설정을 모른다).
 * @param {Object[]} rows  `usage` 행 전부(또는 적어도 이번 달 + 오늘)
 * @param {{today:string, cap:*, model?:string, providerLabel?:(id:string)=>string,
 *          doc?:{title:string, readStats?:{pages:number, chars:number}}|null,
 *          cache?:{count:number, bytes:number, byKind?:Object}|null}} ctx
 */
export function usageView(rows, ctx) {
  const c = ctx || {};
  const list = Array.isArray(rows) ? rows.filter((r) => r && r.day) : [];
  const today = String(c.today || '');
  const row = list.find((r) => r.day === today) || null;
  const byKind = (row && row.byKind) || {};
  const cap = dailyCapOf(c.cap);
  const used = capUsedOf(row);
  const verify = num(byKind[AI.VERIFY_KIND]);
  const left = Math.max(0, cap - used);

  const kinds = SHOW_KINDS.map((k) => ({ kind: k, n: num(byKind[k]) }));
  for (const k of Object.keys(byKind)) if (SHOW_KINDS.indexOf(k) < 0 && num(byKind[k]) > 0) kinds.push({ kind: k, n: num(byKind[k]) });
  const label = typeof c.providerLabel === 'function' ? c.providerLabel : (id) => id;
  const providers = Object.keys((row && row.byProvider) || {}).map((id) => ({ id: id, label: label(id), n: num(row.byProvider[id]) }))
    .filter((p) => p.n > 0).sort((a, b) => b.n - a.n || (a.id < b.id ? -1 : 1));

  const ra = readalongStats(row ? [row] : []);
  const doc = c.doc || null;
  const pl = doc ? pagesLeft(left, ra.perCall, doc.readStats) : null;

  const month = monthBars(list, today);
  const mm = today.slice(0, 7);
  let total = 0;
  let saved = 0;
  for (const r of list) {
    if (String(r.day).slice(0, 7) !== mm || !mm) continue;
    total += num(r.calls);
    saved += num(r.cacheHits) + num(r.ondeviceHits);
  }

  const cs = c.cache || null;
  return {
    today: {
      day: today, calls: num(row && row.calls), used: used, verify: verify, cap: cap, left: left,
      ratio: Math.min(1, Math.max(0, used / cap)), kinds: kinds, providers: providers, model: String(c.model || ''),
      tokensIn: num(row && row.tokensIn), tokensOut: num(row && row.tokensOut),
      cacheHits: num(row && row.cacheHits), ondeviceHits: num(row && row.ondeviceHits),
      blocked429: num(row && row.blocked429), errors: num(row && row.errors), capWarned: !!(row && row.capWarned === true)
    },
    ra: ra,
    pages: pl ? { n: pl.n, perPage: pl.perPage, title: String((doc && doc.title) || '') } : null,
    month: { cells: month.cells, max: month.max, total: total, saved: saved, hitRate: total + saved > 0 ? saved / (total + saved) : null },
    cache: cs ? { count: num(cs.count), bytes: num(cs.bytes), byKind: Object.assign({}, cs.byKind || {}) } : null
  };
}

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
let seq = 0;
let last = null;        // { view, cleaned, error }

/** 방향 고립(FSI … PDI) — 책 제목 같은 남의 글자가 문장 안에서 숫자·구두점 순서를 흔들지 않게. */
const iso = (s) => '⁨' + String(s == null ? '' : s) + '⁩';

export function initUsage() {
  if (typeof document === 'undefined' || els) return;
  root = document.querySelector('[data-screen="usage"]');
  if (!root) return;
  const q = (s) => root.querySelector(s);
  els = {
    status: q('#usageStatus'), calls: q('#usageCalls'), meter: q('#usageMeter'), fill: q('#usageMeterFill'), left: q('#usageLeft'),
    kinds: q('#usageKinds'), provider: q('#usageProvider'), tokens: q('#usageTokens'), saved: q('#usageSaved'), ra: q('#usageRa'),
    pages: q('#usagePages'), r429: q('#usage429'), bars: q('#usageBars'), monthSum: q('#usageMonthSum'), cacheSum: q('#usageCacheSum')
  };
  onLangChange(() => { if (!root) return; applyTranslations(root); if (!root.hidden && last) render(); });
  attachDebugHook();
}

/** 라우터 — `#/usage` 를 열 때마다 다시 읽는다(호출 0). */
export async function showUsage() {
  if (!root) return;
  applyTranslations(root);
  attachDebugHook();          // main.js 가 부팅 끝에 `window.__medreader` 를 새로 만든다 — 화면에 들어올 때 다시 단다
  await load();
}

async function load() {
  const my = ++seq;
  const today = localDay(Date.now());
  const rows = [];
  let error = false;
  try {
    await db.iterate('usage', {}, (v) => { if (v && v.day) rows.push(v); });
  } catch (e) { error = true; }
  // 90일 지난 행 — 화면을 열 때 지운다(8cf-D12). 지우기 실패는 화면을 막지 않는다.
  const { keep, cleaned } = await pruneUsage(rows, today, (d) => db.del('usage', d));
  let doc = null;
  try {
    await db.iterate('documents', { index: 'lastOpenedAt', direction: 'prev' }, (v) => { doc = v || null; return false; });
  } catch (e) { doc = null; }
  let cache = null;
  try { cache = await createCache().stats(); } catch (e) { cache = null; }
  if (my !== seq) return;
  const pid = providerId();
  const view = usageView(keep, {
    today: today, cap: settings.get('ai.dailyCap'), model: modelOf(pid), providerLabel: labelOf,
    doc: doc ? { title: doc.title, readStats: doc.readStats } : null, cache: cache
  });
  last = { view: view, cleaned: cleaned, error: error, cacheError: !cache };
  attachDebugHook();          // `#/usage` 로 바로 부팅하면 위 읽기 동안 main.js 가 `window.__medreader` 를 새로 만든다 — 다시 단다
  render();
}

function providerId() {
  const p = settings.get('ai.provider');
  return typeof p === 'string' && p ? p : AI.DEFAULT_PROVIDER;
}
function labelOf(id) {
  try { const a = provider.getAdapter(id); return a && a.label ? a.label : id; } catch (e) { return id; }
}
function modelOf(pid) {
  const m = String(settings.get('ai.model') || '').trim();
  if (m) return m;
  try { const a = provider.getAdapter(pid); return (a && a.defaultModel) || ''; } catch (e) { return ''; }
}

function fmt1(n) {
  try { return new Intl.NumberFormat(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n); } catch (e) { return n.toFixed(1); }
}
function pct(r) {
  try { return new Intl.NumberFormat(getLang(), { style: 'percent', maximumFractionDigits: 0 }).format(r); } catch (e) { return Math.round(r * 100) + '%'; }
}
function kindLabel(k) {
  const key = 'usage.kind.' + k;
  return hasKey(key) ? t(key) : String(k);
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function render() {
  if (!els || !last) return;
  const v = last.view;
  const d = v.today;
  const N = formatNumber;

  els.status.textContent = last.error ? t('usage.error') : (last.cleaned > 0 ? t('usage.cleaned', { n: N(last.cleaned) }) : '');

  // 16-J — 오늘 호출 수는 실제 요청 수 그대로(검증 포함), 상한 줄은 검증을 뺀 셈(15절 · 파이프라인과 같은 `capUsedOf`).
  els.calls.textContent = t('usage.calls', { calls: N(d.calls) });
  const capLine = t('usage.left', { used: N(d.used), cap: N(d.cap), n: N(d.left) });
  els.meter.setAttribute('aria-valuemax', String(d.cap));
  els.meter.setAttribute('aria-valuenow', String(Math.min(Math.max(d.used, 0), d.cap)));
  els.meter.setAttribute('aria-label', capLine);
  els.meter.setAttribute('data-full', d.used >= d.cap ? '1' : '0');
  els.fill.style.setProperty('--usage-ratio', String(d.ratio));
  els.left.textContent = capLine + (d.verify > 0 ? ' · ' + t('usage.verifyNote', { n: N(d.verify) }) : '');

  clear(els.kinds);
  for (const k of d.kinds) {
    const li = document.createElement('li');
    li.className = 'usage-kind';
    li.setAttribute('data-kind', k.kind);
    const a = document.createElement('span');
    a.className = 'usage-kind-name';
    a.textContent = kindLabel(k.kind);
    const b = document.createElement('span');
    b.className = 'usage-kind-n';
    b.textContent = N(k.n);
    li.appendChild(a);
    li.appendChild(b);
    els.kinds.appendChild(li);
  }

  const provs = d.providers.length ? d.providers.map((p) => iso(p.label) + ' ' + N(p.n)).join(' · ') : iso(labelOf(providerId()));
  els.provider.textContent = t('usage.provider', { provider: provs, model: iso(d.model || '—') });
  els.tokens.textContent = t('usage.tokens', { in: N(d.tokensIn), out: N(d.tokensOut) });
  els.saved.textContent = t('usage.saved', { cache: N(d.cacheHits), ondevice: N(d.ondeviceHits) });

  els.ra.textContent = v.ra.perCall === null
    ? t('usage.ra.none', { calls: N(v.ra.calls) })
    : t('usage.ra', { calls: N(v.ra.calls), chars: N(v.ra.chars), avg: N(v.ra.perCall), per10k: fmt1(v.ra.per10k) });

  els.pages.hidden = !v.pages;
  els.pages.textContent = v.pages ? t('usage.pagesLeft', { n: N(v.pages.n), title: iso(v.pages.title), perPage: N(v.pages.perPage) }) : '';

  els.r429.hidden = !(d.blocked429 > 0);
  els.r429.textContent = d.blocked429 > 0 ? t('usage.blocked429', { n: N(d.blocked429) }) : '';

  clear(els.bars);
  els.bars.setAttribute('aria-label', t('usage.month.bars', { max: N(v.month.max) }));
  for (const c of v.month.cells) {
    const s = document.createElement('span');
    s.className = 'usage-bar';
    if (c.out) s.classList.add('is-out');
    if (c.today) s.classList.add('is-today');
    if (c.future) s.classList.add('is-future');
    s.style.setProperty('--h', String(c.h));
    s.setAttribute('aria-hidden', 'true');
    if (!c.out) s.title = t('usage.month.day', { d: N(c.d), n: N(c.calls) });
    els.bars.appendChild(s);
  }
  els.monthSum.textContent = t('usage.month.sum', {
    calls: N(v.month.total), saved: N(v.month.saved), rate: v.month.hitRate === null ? '—' : pct(v.month.hitRate)
  });

  els.cacheSum.textContent = v.cache
    ? t('usage.cache.sum', { n: N(v.cache.count), size: formatBytes(v.cache.bytes), tr: N(num(v.cache.byKind.translate)), term: N(num(v.cache.byKind[AI.TERM_KIND])) })
    : t('settings.ai.cache.unknown');
}

/* ── `[D]` 측정 훅 — 숫자만(책 제목·키 없음) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.usage && g.usage.__mine) return;
  g.usage = {
    __mine: true,
    view: function () {
      if (!last) return null;
      const v = JSON.parse(JSON.stringify(last.view));
      if (v.pages) v.pages.title = v.pages.title ? '#' + v.pages.title.length : '';
      return { view: v, cleaned: last.cleaned, error: last.error };
    },
    reload: function () { return load(); }
  };
}
