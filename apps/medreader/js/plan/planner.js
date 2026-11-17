/* ============================================================
   MedReader — 학습 계획 계산 (spec 17-12 3 — 13-1)

   ── 순수 계층이다(3-2) ─────────────────────────────────
   `config` 만 import 한다. 시계·DOM·저장소를 모른다 — 오늘 날짜는 `'YYYY-MM-DD'` 글자로 받고, 일수는 그레고리력
   일련번호(`dayNum` — 1970-01-01 = 0)로 센다(시간대 없음). 숫자는 화면이 다시 계산하지 않도록 여기서 다 낸다(13-2).
   **점수·합격을 예측하지 않는다**(13-D11) — 읽기 분량·시간·호출 수만.

   ── 무엇을 ─────────────────────────────────────────────
   날 세기(`dayNum`·`weekdayOf`·`dayKey`·`studyDays`) · 읽은 쪽 구간(`ranges*`) · 남은 글자(`remainingOf`) ·
   속도(`speedOf` — `reading.log` 실측 또는 기본 추정) · 1만 자당 호출(`callsRateOf`) · 오늘 복습 분(`reviewMinutes`) ·
   계획(`planFor`) · 오늘 읽을 곳(`todayRange`) · 낭독 기록 꼴 다루기(`bucketFor`·`logAdd`·`logTrim`·`cleanLog`).
   ============================================================ */

import { PLAN } from '../config.js';

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const fin = (v) => Number.isFinite(Number(v));
const nonNeg = (v) => (fin(v) ? Math.max(0, Number(v)) : 0);
/** 부동소수 찌꺼기를 지운 올림(100000 × 1.7 ÷ 10000 = 17.000000000000004 를 18 로 올리지 않게). */
const EPS = 1e-9;
const up = (x) => Math.ceil(Math.round(x * 1e6) / 1e6);
/** `[13-2]` 글자 수를 센 쪽이 범위의 이 몫 미만이면 [정확히 세기]를 보인다(17-12 5 2). */
const COUNT_OK = 0.95;

/* ── 날 세기 ───────────────────────────────────────── */

/**
 * `'YYYY-MM-DD'` → 그레고리력 일련번호(1970-01-01 = 0). 꼴이 틀리거나 없는 날(2월 30일)이면 NaN.
 * (H. Hinnant `days_from_civil` — 정수 산술만)
 */
export function dayNum(key) {
  const m = DAY_RE.exec(String(key == null ? '' : key));
  if (!m) return NaN;
  let y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return NaN;
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInMonth(y, m) { return m === 2 ? (isLeap(y) ? 29 : 28) : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

/** 일련번호 → `'YYYY-MM-DD'`(`dayNum` 의 역 — `civil_from_days`). */
export function dayKey(n) {
  const z = Math.floor(Number(n)) + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const z2 = (v) => (v < 10 ? '0' : '') + v;
  return y + '-' + z2(m) + '-' + z2(d);
}

/** 일련번호 → 요일 0(일)…6(토). 1970-01-01 은 목요일(4). */
export function weekdayOf(n) {
  return (((Math.floor(Number(n)) + 4) % 7) + 7) % 7;
}

/** 공부 요일 목록 → 0–6 집합(빈 값·꼴 틀림이면 매일). 빈 배열은 "요일 없음"(0 일). */
function weekdaySet(w) {
  if (!Array.isArray(w)) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const s = new Set();
  for (const x of w) { const n = Number(x); if (Number.isInteger(n) && n >= 0 && n <= 6) s.add(n); }
  return s;
}

/**
 * 오늘(포함) ≤ d < 시험일(제외) 중 공부 요일 수 − reserve(복습만 할 날, 끝에서 뺀다), 0 이상(13-D8).
 * @param {string} today @param {string} exam
 * @param {{weekdays?:number[], reserve?:number}} [o]
 */
export function studyDays(today, exam, o) {
  const a = dayNum(today);
  const b = dayNum(exam);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  const ws = weekdaySet(o && o.weekdays);
  let n = 0;
  if (ws.size === 7) n = b - a;
  else if (ws.size) {
    const weeks = Math.floor((b - a) / 7);
    n = weeks * ws.size;
    for (let d = a + weeks * 7; d < b; d++) if (ws.has(weekdayOf(d))) n++;
  }
  return Math.max(0, n - Math.floor(nonNeg(o && o.reserve)));
}

/** 오늘부터 공부 요일로 k 번째 날의 일련번호(k ≥ 1). 공부 요일이 없으면 NaN. */
function nthStudyDay(start, k, ws) {
  if (!ws.size || !(k >= 1)) return NaN;
  const weeks = Math.floor((k - 1) / ws.size);
  let left = k - weeks * ws.size;
  let d = start + weeks * 7;
  for (;; d++) {
    if (ws.has(weekdayOf(d)) && --left === 0) return d;
  }
}

/* ── 읽은 쪽 구간 `[[a,b]…]` ───────────────────────────── */

/** 정규화 — 정수, a ≤ b, 정렬, 겹치거나 붙은 구간은 하나로. 꼴이 틀린 항목은 버린다. */
export function rangesUnion(ranges) {
  const all = [];
  for (const r of Array.isArray(ranges) ? ranges : []) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const a = Math.floor(Number(r[0]));
    const b = Math.floor(Number(r[1]));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    all.push(a <= b ? [a, b] : [b, a]);
  }
  all.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out = [];
  for (const r of all) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** 쪽 p 가 구간 안인가. */
export function rangesHas(ranges, p) {
  const n = Math.floor(Number(p));
  for (const r of rangesUnion(ranges)) if (n >= r[0] && n <= r[1]) return true;
  return false;
}

/** 쪽 a–b 를 더한다(새 배열). */
export function rangesAdd(ranges, a, b) {
  return rangesUnion([].concat(Array.isArray(ranges) ? ranges : [], [[a, b === undefined ? a : b]]));
}

/** 쪽 a–b 를 뺀다(새 배열). */
export function rangesRemove(ranges, a, b) {
  let lo = Math.floor(Number(a));
  let hi = Math.floor(Number(b === undefined ? a : b));
  const cur = rangesUnion(ranges);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return cur;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  const out = [];
  for (const r of cur) {
    if (r[1] < lo || r[0] > hi) { out.push(r); continue; }
    if (r[0] < lo) out.push([r[0], lo - 1]);
    if (r[1] > hi) out.push([hi + 1, r[1]]);
  }
  return out;
}

/** 구간들의 쪽 수. */
export function rangesCount(ranges) {
  let n = 0;
  for (const r of rangesUnion(ranges)) n += r[1] - r[0] + 1;
  return n;
}

/* ── 남은 글자 ─────────────────────────────────────── */

function lookup(m, k) {
  if (!m) return undefined;
  if (m instanceof Map) return m.get(k);
  return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : undefined;
}

/** 시험 범위 → 문서별 합친 구간(같은 책 겹침은 합친다 — 등장 순서 그대로). */
function docRanges(targets) {
  const order = [];
  const by = new Map();
  for (const t of Array.isArray(targets) ? targets : []) {
    if (!t || t.docId == null) continue;
    const id = String(t.docId);
    if (!by.has(id)) { by.set(id, []); order.push(id); }
    by.get(id).push([t.from, t.to === undefined ? t.from : t.to]);
  }
  return order.map((id) => ({ docId: id, ranges: rangesUnion(by.get(id)).filter((r) => r[1] >= 1).map((r) => [Math.max(1, r[0]), r[1]]) }));
}

/** 한 문서의 쪽 글자 함수 — 센 쪽은 그 값, 아니면 범위 안 센 쪽 평균 → `readStats.chars/pages` → `PLAN.DEFAULT_PAGE_CHARS`. */
function pageCharsFn(docId, ranges, pageChars, docStats) {
  const known = lookup(pageChars, docId);
  const get = (p) => { const v = lookup(known, p); if (v === undefined) return undefined; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : undefined; };
  let sum = 0;
  let counted = 0;
  for (const r of ranges) for (let p = r[0]; p <= r[1]; p++) { const v = get(p); if (v !== undefined) { sum += v; counted++; } }
  let avg;
  if (counted) avg = sum / counted;
  else {
    const st = lookup(docStats, docId);
    const sp = st && Number(st.pages);
    const sc = st && Number(st.chars);
    avg = sp > 0 && sc >= 0 && Number.isFinite(sc) ? sc / sp : PLAN.DEFAULT_PAGE_CHARS;
  }
  return { at: (p) => { const v = get(p); return v === undefined ? avg : v; }, counted: counted };
}

/**
 * 범위의 전체·읽은·남은 글자(13-D5). 쪽 글자 없는 쪽은 범위 안 센 쪽의 평균으로(없으면 readStats → 기본).
 * @param {{docId:string, from:number, to:number}[]} targets
 * @param {Object|Map} pageChars  docId → (쪽 번호 → 글자 수)
 * @param {Object|Map} readRanges docId → `[[a,b]…]`
 * @param {Object|Map} [docStats] docId → `{pages, chars}`(문서 레코드의 `readStats`)
 * @returns {{total:number, read:number, remaining:number, counted:number, pages:number, readPages:number}}
 */
export function remainingOf(targets, pageChars, readRanges, docStats) {
  let total = 0;
  let read = 0;
  let counted = 0;
  let pages = 0;
  let readPages = 0;
  for (const dr of docRanges(targets)) {
    const f = pageCharsFn(dr.docId, dr.ranges, pageChars, docStats);
    const rr = rangesUnion(lookup(readRanges, dr.docId));
    counted += f.counted;
    for (const r of dr.ranges) {
      for (let p = r[0]; p <= r[1]; p++) {
        const c = f.at(p);
        total += c;
        pages++;
        if (rangesHas(rr, p)) { read += c; readPages++; }
      }
    }
  }
  total = Math.round(total);
  read = Math.round(read);
  return { total: total, read: read, remaining: Math.max(0, total - read), counted: counted, pages: pages, readPages: readPages };
}

/**
 * 오늘 읽을 곳 — 범위 순서대로 다음 읽지 않은 쪽부터 `dayChars` 가 찰 때까지(13-D12). 이어진 쪽끼리 묶는다.
 * @returns {{docId:string, from:number, to:number}[]}
 */
export function todayRange(targets, pageChars, readRanges, dayChars, docStats) {
  const want = nonNeg(dayChars);
  const out = [];
  if (!(want > 0)) return out;
  let got = 0;
  for (const dr of docRanges(targets)) {
    const f = pageCharsFn(dr.docId, dr.ranges, pageChars, docStats);
    const rr = rangesUnion(lookup(readRanges, dr.docId));
    for (const r of dr.ranges) {
      for (let p = r[0]; p <= r[1]; p++) {
        if (rangesHas(rr, p)) continue;
        const last = out[out.length - 1];
        if (last && last.docId === dr.docId && last.to === p - 1) last.to = p;
        else out.push({ docId: dr.docId, from: p, to: p });
        got += f.at(p);
        if (got >= want) return out;
      }
    }
  }
  return out;
}

/* ── 낭독 기록 `reading.log` 꼴 ─────────────────────────── */

/** 유효 모드·원문 읽기 → 갈래(17-12 2). speak 가 아니면(끔·show·줄 단위로 쉼) `src`. */
export function bucketFor(mode, speakSource) {
  if (mode !== 'speak') return 'src';
  return speakSource === false ? 'tr' : 'both';
}

/** 저장된 값 → `{v, days}` 꼴(모르는 갈래·꼴 틀린 날은 버린다). 원본을 고치지 않는다. */
export function cleanLog(log) {
  const days = {};
  const src = log && typeof log === 'object' && !Array.isArray(log) && log.days && typeof log.days === 'object' && !Array.isArray(log.days) ? log.days : {};
  for (const k of Object.keys(src)) {
    if (!Number.isFinite(dayNum(k))) continue;
    const d = src[k];
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
    const o = {};
    for (const b of PLAN.BUCKETS) {
      const x = d[b];
      if (x && typeof x === 'object') o[b] = { ms: nonNeg(x.ms), chars: nonNeg(x.chars), rateMs: nonNeg(x.rateMs) };
    }
    if (fin(d.pages)) o.pages = nonNeg(d.pages);
    days[k] = o;
  }
  return { v: PLAN.LOG_V, days: days };
}

/** 하루 한 갈래에 더한다(새 객체). `add` = `{ms, chars, rateMs, pages}`(없는 칸은 0). */
export function logAdd(log, day, bucket, add) {
  const out = cleanLog(log);
  if (!Number.isFinite(dayNum(day))) return out;
  const a = add || {};
  const d = Object.assign({}, out.days[day] || {});
  if (PLAN.BUCKETS.indexOf(bucket) >= 0 && (nonNeg(a.ms) || nonNeg(a.chars))) {
    const b = d[bucket] || { ms: 0, chars: 0, rateMs: 0 };
    d[bucket] = { ms: b.ms + nonNeg(a.ms), chars: b.chars + nonNeg(a.chars), rateMs: b.rateMs + nonNeg(a.rateMs) };
  }
  if (nonNeg(a.pages)) d.pages = nonNeg(d.pages) + nonNeg(a.pages);
  out.days[day] = d;
  return out;
}

/** 오늘 포함 `keep`(기본 `PLAN.LOG_DAYS`) 날보다 오래된 날·오늘보다 뒤 날짜는 그대로 두고 오래된 날만 뺀다(새 객체). */
export function logTrim(log, today, keep) {
  const out = cleanLog(log);
  const t = dayNum(today);
  if (!Number.isFinite(t)) return out;
  const cut = t - (Number.isInteger(keep) && keep > 0 ? keep : PLAN.LOG_DAYS) + 1;
  for (const k of Object.keys(out.days)) if (dayNum(k) < cut) delete out.days[k];
  return out;
}

/** `[13-2]` 그날 낭독 — 갈래 합 ms · 분(반올림) · 끝까지 읽은 쪽 수(계획 화면 "오늘 낭독 x분"). */
export function dayRead(log, day) {
  const d = cleanLog(log).days[String(day)] || {};
  let ms = 0;
  for (const b of PLAN.BUCKETS) if (d[b]) ms += d[b].ms;
  return { ms: ms, min: Math.round(ms / 60000), pages: nonNeg(d.pages) };
}

/* ── 속도 · 호출 · 복습 ─────────────────────────────────── */

/**
 * 낭독 속도(원문 글자/분, 13-D2). 최근 `PLAN.SPEED_DAYS` 날(오늘 포함) 그 갈래의 합이 `PLAN.MEASURE_MIN_MS` 이상이면 실측
 * `Σ글자 ÷ Σ분` 을 지금 속도와 잴 때 평균 속도(`rateMs ÷ ms`)의 비로 고친다. 아니면 기본 추정 `DEFAULT_CPM[갈래] × rate`.
 * @param {Object} log `reading.log`
 * @param {{today:string, bucket:'src'|'both'|'tr', rate?:number}} o
 * @returns {{cpm:number, source:'measured'|'estimate', ms:number}}
 */
export function speedOf(log, o) {
  const x = o || {};
  const bucket = PLAN.BUCKETS.indexOf(x.bucket) >= 0 ? x.bucket : 'src';
  const rate = Number(x.rate) > 0 ? Number(x.rate) : 1;
  const t = dayNum(x.today);
  let ms = 0;
  let chars = 0;
  let rateMs = 0;
  if (Number.isFinite(t)) {
    const days = cleanLog(log).days;
    for (const k of Object.keys(days)) {
      const n = dayNum(k);
      if (n > t || n <= t - PLAN.SPEED_DAYS) continue;
      const b = days[k][bucket];
      if (!b) continue;
      ms += b.ms; chars += b.chars; rateMs += b.rateMs;
    }
  }
  if (ms >= PLAN.MEASURE_MIN_MS && chars > 0) {
    const avgRate = rateMs > 0 ? rateMs / ms : 1;
    return { cpm: chars / (ms / 60000) * (rate / avgRate), source: 'measured', ms: ms };
  }
  return { cpm: PLAN.DEFAULT_CPM[bucket] * rate, source: 'estimate', ms: ms };
}

/**
 * 1만 자당 호출(13-D6). `measured` = `ui/usage.js` `callsPer10k(최근 30일 행, {minChars: PLAN.CALLS_MIN_CHARS})`
 * (문턱 미만이면 null). `src` 갈래(번역 끔·show)는 0 — 호출 줄을 숨긴다.
 * @returns {{value:number, source:'measured'|'default'|'off'}}
 */
export function callsRateOf(measured, bucket) {
  if (bucket === 'src') return { value: 0, source: 'off' };
  if (measured !== null && measured !== undefined && measured !== '' && Number.isFinite(Number(measured)) && Number(measured) >= 0) {
    return { value: Number(measured), source: 'measured' };
  }
  return { value: PLAN.DEFAULT_CALLS_PER_10K, source: 'default' };
}

/** 오늘 복습 예상 분 — 장 수 × 장당 시간(`srs.log` 최근 14일 `Σms ÷ Σn`, 없으면 `PLAN.REVIEW_SEC_DEFAULT`). 올림. */
export function reviewMinutes(count, srsLog, today) {
  const c = Math.floor(nonNeg(count));
  if (!c) return 0;
  const t = dayNum(today);
  let ms = 0;
  let n = 0;
  const lg = srsLog && typeof srsLog === 'object' && !Array.isArray(srsLog) ? srsLog : {};
  if (Number.isFinite(t)) {
    for (const k of Object.keys(lg)) {
      const d = dayNum(k);
      if (!(d <= t && d > t - PLAN.SPEED_DAYS) || !lg[k]) continue;
      ms += nonNeg(lg[k].ms); n += nonNeg(lg[k].n);
    }
  }
  const per = n > 0 && ms > 0 ? ms / n : PLAN.REVIEW_SEC_DEFAULT * 1000;
  return up(c * per / 60000);
}

/* ── 계획 ──────────────────────────────────────────── */

/**
 * 한 시험의 계획(17-12 3). 숫자는 화면에 보일 값 그대로(분·호출은 올림 — 위로 잡는다).
 * @param {{today:string, exam:string, weekdays?:number[], reserve?:number, minutesPerDay:number, reviewMinToday?:number,
 *          speed:number, callsPer10k?:number, cap?:number, remaining?:number,
 *          targets?:Object[], pageChars?:Object, readRanges?:Object, docStats?:Object}} input
 * @returns {{status:'past'|'done'|'ok'|'tight'|'short', days:number, remaining:number, needMinPerDay:?number, readMinPerDay:number,
 *            dayChars:number, needDays:?number, finishDay:?string, slackDays:?number, calls:number, callsPerDay:number,
 *            overCap:boolean, showCalls:boolean, progress:?Object}}
 */
export function planFor(input) {
  const i = input || {};
  const t = dayNum(i.today);
  const e = dayNum(i.exam);
  let progress = null;
  let remaining;
  if (Array.isArray(i.targets)) {
    progress = remainingOf(i.targets, i.pageChars, i.readRanges, i.docStats);
    // `[13-2]` 화면이 그대로 보일 몫 — 읽은 비율(정수 %) · 글자 수를 센 쪽이 범위의 95% 미만인가([정확히 세기])
    progress.readPct = progress.total > 0 ? Math.floor(progress.read / progress.total * 100) : (progress.pages > 0 ? 0 : 100);
    progress.needCount = progress.pages > 0 && progress.counted < progress.pages * COUNT_OK;
    remaining = progress.remaining;
  } else remaining = Math.round(nonNeg(i.remaining));
  // `[13-2 — spec 17-12 2]` 남은 글자는 검색 글자, 속도는 낭독 글자 — `textToSpoken`(낭독 ÷ 검색, 기본 1)으로 속도를 검색 글자/분으로 바꾼다.
  // 호출은 낭독(번역 입력) 글자로 센다. 1 이면 전과 같다.
  const k = Number(i.textToSpoken) > 0 && Number.isFinite(Number(i.textToSpoken)) ? Number(i.textToSpoken) : 1;
  const speed = nonNeg(i.speed) / k;
  const c10k = nonNeg(i.callsPer10k);
  const readMinPerDay = Math.max(0, nonNeg(i.minutesPerDay) - nonNeg(i.reviewMinToday));   // 13-D13
  const dayChars = speed * readMinPerDay;
  const base = {
    status: 'ok', days: 0, calendarDays: Number.isFinite(t) && Number.isFinite(e) ? e - t : null,
    remaining: remaining, needMinPerDay: null, readMinPerDay: readMinPerDay, dayChars: Math.round(dayChars),
    needDays: null, finishDay: null, slackDays: null, calls: 0, callsPerDay: 0, overCap: false, showCalls: c10k > 0, progress: progress
  };
  if (!Number.isFinite(t) || !Number.isFinite(e) || e <= t) return Object.assign(base, { status: 'past' });
  const days = studyDays(i.today, i.exam, { weekdays: i.weekdays, reserve: i.reserve });
  base.days = days;
  if (remaining <= 0) return Object.assign(base, { status: 'done', remaining: 0 });
  base.needMinPerDay = days > 0 && speed > 0 ? up(remaining / speed / days) : null;
  base.calls = up(remaining * k * c10k / 10000);
  const perDay = dayChars * k * c10k / 10000;
  base.callsPerDay = up(perDay);
  const cap = Number(i.cap);
  base.overCap = c10k > 0 && Number.isFinite(cap) && cap > 0 && perDay > cap * PLAN.CAP_SHARE + EPS;
  if (dayChars > 0) {
    const need = up(remaining / dayChars);
    base.needDays = need;
    const fd = nthStudyDay(t, need, weekdaySet(i.weekdays));
    base.finishDay = Number.isFinite(fd) ? dayKey(fd) : null;
    base.slackDays = days - need;
  }
  if (days <= 0 || base.slackDays === null || base.slackDays < 0) base.status = 'short';
  else if (base.slackDays < PLAN.TIGHT_SLACK_DAYS) base.status = 'tight';
  return base;
}
