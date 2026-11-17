/* ============================================================
   MedReader — SM-2 복습 간격 (spec 17-11 3 — 12-1)

   ── 순수 계층이다(3-2 · 16-A) ───────────────────────────
   `config` 만 import 한다. 시계·DOM·브라우저 전역을 읽지 않는다 — 지금 시각(`nowMs`)과 그날 0시(`dayStartMs`)는
   **인자로** 받는다. 문자열 시각(8f 옛 값)을 숫자로 바꾸는 일도 호출자(`srs/cards.js` `dueMsOf`) 몫 — 여기는 숫자만 본다.

   ── 규칙 (Anki 식 4단추 SM-2 변형 — 12-D4) ──────────────
     again: reps←0, lapses+1, ease←max(1.3, ease−0.20), interval←0, dueAt ← nowMs + 10분
     hard : ease←max(1.3, ease−0.15); interval ← reps==0 ? 1 : max(interval+1, round(interval×1.2)); reps+1
     good : interval ← reps==0 ? 1 : reps==1 ? 6 : max(interval+1, round(interval×ease)); reps+1
     easy : ease←ease+0.15; interval ← reps==0 ? 4 : max(interval+1, round(interval×ease×1.3)); reps+1
            `[12-1b]` reps==1 이면 그 값과 SECOND_GOOD_DAYS+1(7) 중 큰 값 — 두 번째 [쉬움]이 [좋음](6일)보다 짧지 않게
     interval ← min(interval, 365) · interval > 0 이면 dueAt ← dayStartMs + interval × 하루(그날 0시 — "그날 복습할 것")
   ease 를 바꾸는 단추는 **바꾼 뒤** 값으로 곱한다. ease 는 소수 둘째 자리로 맞춘다(뺄셈이 쌓여 2.3499… 가 되지 않게).
   ============================================================ */

import { SRS } from '../config.js';

function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function round2(x) { return Math.round(x * 100) / 100; }

/** 상태 `{ease, interval, reps, lapses}` 를 다듬는다 — 없거나 틀린 칸은 처음 값. 넘긴 객체를 고치지 않는다. */
export function normalizeSm2(sm2) {
  const s = sm2 && typeof sm2 === 'object' ? sm2 : {};
  const S = SRS.START;
  return {
    ease: Math.max(SRS.EASE_MIN, round2(num(s.ease, S.ease))),
    interval: Math.max(0, Math.round(num(s.interval, S.interval))),
    reps: Math.max(0, Math.floor(num(s.reps, S.reps))),
    lapses: Math.max(0, Math.floor(num(s.lapses, S.lapses)))
  };
}

/** 처음 상태 사본. */
export function startSm2() {
  return Object.assign({}, SRS.START);
}

/**
 * 한 번 매긴 뒤의 상태와 다음 복습 시각.
 * @param {Object} sm2 지금 상태(없으면 처음 값)
 * @param {'again'|'hard'|'good'|'easy'} grade
 * @param {{nowMs:number, dayStartMs:number}} ctx
 * @returns {{sm2:{ease:number, interval:number, reps:number, lapses:number}, dueAt:number}|null} 모르는 단추면 null
 */
export function next(sm2, grade, ctx) {
  if (SRS.GRADES.indexOf(grade) < 0) return null;
  const c = ctx || {};
  const nowMs = num(c.nowMs, 0);
  const dayStartMs = num(c.dayStartMs, nowMs);
  const s = normalizeSm2(sm2);
  const ease = Math.max(SRS.EASE_MIN, round2(s.ease + SRS.EASE_DELTA[grade]));
  if (grade === 'again') {
    return { sm2: { ease: ease, interval: 0, reps: 0, lapses: s.lapses + 1 }, dueAt: nowMs + SRS.AGAIN_MS };
  }
  let interval;
  if (s.reps === 0) interval = SRS.FIRST_DAYS[grade];
  else if (grade === 'good' && s.reps === 1) interval = SRS.SECOND_GOOD_DAYS;
  else {
    const f = grade === 'hard' ? SRS.HARD_FACTOR : grade === 'good' ? ease : ease * SRS.EASY_BONUS;
    interval = Math.max(s.interval + 1, Math.round(s.interval * f));
    if (grade === 'easy' && s.reps === 1) interval = Math.max(SRS.SECOND_GOOD_DAYS + 1, interval);
  }
  interval = Math.min(interval, SRS.MAX_INTERVAL_DAYS);
  return { sm2: { ease: ease, interval: interval, reps: s.reps + 1, lapses: s.lapses }, dueAt: dayStartMs + interval * SRS.DAY_MS };
}

/**
 * 오늘 복습할 것인가 — 멈춘 카드가 아니고 다음 복습 시각이 오늘 끝(`dayEndMs`, 다음 날 0시) 앞.
 * `card.dueAt` 은 **숫자 ms** 여야 한다(호출자가 바꿔 넘김 — 12-D10). 숫자가 아니면 "언제인지 모름" → 잃지 않게 오늘 복습.
 */
export function isDue(card, dayEndMs) {
  if (!card || card.suspended) return false;
  const d = typeof card.dueAt === 'number' ? card.dueAt : NaN;
  return !Number.isFinite(d) || d < num(dayEndMs, 0);
}

/** 아직 한 번도 매기지 않은 카드인가(새 카드 — 하루 상한을 받는다). */
export function isNew(card) {
  return !!card && !card.reviewedAt && (num(card.sm2 && card.sm2.reps, 0) | 0) === 0;
}

/**
 * 간격을 화면 단위로 — 분 · 시간 · 일 · 개월(30일) · 년(365일, 소수 한 자리). 문구는 화면이 만든다(i18n).
 * @param {number} ms
 * @returns {{n:number, unit:'min'|'hour'|'day'|'month'|'year'}}
 */
export function spanOf(ms) {
  const m = Math.max(0, num(ms, 0));
  const D = SRS.DAY_MS;
  if (m < 3600000) return { n: Math.max(1, Math.round(m / 60000)), unit: 'min' };
  if (m < D) return { n: Math.round(m / 3600000), unit: 'hour' };
  const days = Math.round(m / D);
  if (days < 30) return { n: days, unit: 'day' };
  if (days < 365) return { n: Math.round(days / 30), unit: 'month' };
  return { n: Math.round((days / 365) * 10) / 10, unit: 'year' };
}

/**
 * 네 단추 아래 "10분 · 1일 · 3일 · 1개월" — `next()` 를 네 번 돌린 결과. "다시"는 지금부터, 나머지는 간격(일).
 * @returns {{grade:string, n:number, unit:string, dueAt:number}[]}
 */
export function previewLabels(sm2, ctx) {
  const c = ctx || {};
  const nowMs = num(c.nowMs, 0);
  return SRS.GRADES.map((g) => {
    const r = next(sm2, g, c);
    const span = g === 'again' ? spanOf(r.dueAt - nowMs) : spanOf(r.sm2.interval * SRS.DAY_MS);
    return { grade: g, n: span.n, unit: span.unit, dueAt: r.dueAt };
  });
}
