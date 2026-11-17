/* ============================================================
   tests/planner-13.test.mjs — 13-1 학습 계획 계산 (spec 17-12 3 · 7 "13-1" 수용 기준 — 순수)

   N1  ★ 날 세기 — dayNum/dayKey 왕복·요일(달력 대조) · 윤년 2월 넘김 · 시험일 당일 제외 · 공부 요일 금 빼기 · reserve 2
   N2  ★ 읽은 쪽 구간 — 겹침·붙음 합치기 · 더하기·빼기 · `[[3,5]]`+6 → `[[3,6]]` · 4 빼기 → `[[3,3],[5,6]]` · text/backup unionRanges 와 같음
   N3  ★ 남은 글자 — 같은 책 범위 겹침 합치기 · 글자 없는 쪽은 범위 안 평균 · 하나도 없으면 readStats → 기본 · 읽은 쪽 빼기
   N4  ★ planFor — 예시(17-12 2) 재현 18만 자·370자/분·10일 → 하루 49분·호출 31 · 남은 날 0 → short·needMinPerDay null("—") ·
        past(시험일 오늘·어제) · done · overCap 경계(0.8) · callsPer10k 0(호출 줄 숨김) · 복습 분을 뺀 낭독 몫 · finishDay·slack·tight
   N5  ★ 속도 — 실측 29분 → 추정 · 31분 → 실측 · 잴 때 평균 1.0·지금 1.25 → ×1.25 · 갈래가 다르면 그 갈래의 기본 · 14일 밖은 빼기
   N6  ★ 1만 자당 호출 — `ui/usage.js` `callsPer10k(rows, {minChars: PLAN.CALLS_MIN_CHARS})` 문턱 미만 → 1.7 · 이상 → 실측 · src → 0
   N7  todayRange · reviewMinutes · logAdd·logTrim·cleanLog · bucketFor
   N8  ★ 정적 — plan/planner.js 에 `Date`·`document`·`window` 0 · import 는 config 만
   지어낸 숫자만. 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as P from '../js/plan/planner.js';
import { PLAN } from '../js/config.js';
import { unionRanges } from '../js/text/backup.js';
import { callsPer10k } from '../js/ui/usage.js';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const ALL = [0, 1, 2, 3, 4, 5, 6];

/* ══ N1 날 세기 ═════════════════════════════════════════ */
test('N1 ★ 날 세기 — dayNum·dayKey·요일이 달력과 같음 · 윤년 2월 · 시험일 당일 제외 · 금 빼기 · reserve 2', () => {
  // 달력 대조(시험만 Date 를 쓴다 — UTC 로 시간대 없음)
  for (const k of ['1970-01-01', '2000-02-29', '2024-02-28', '2024-03-01', '2026-11-17', '2027-12-31', '2100-03-01']) {
    const n = P.dayNum(k);
    assert.equal(n, Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 86400000, k);
    assert.equal(P.dayKey(n), k);
    assert.equal(P.weekdayOf(n), new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10))).getUTCDay(), k + ' 요일');
  }
  for (const bad of ['2026-02-29', '2026-13-01', '2026-1-1', '', null, '2026-11-31']) assert.ok(Number.isNaN(P.dayNum(bad)), String(bad));
  // 윤년 2월 넘김: 2028-02-27(일) ~ 2028-03-02 → 27·28·29·1 = 4일(시험일 3월 2일 제외)
  assert.equal(P.studyDays('2028-02-27', '2028-03-02', { weekdays: ALL }), 4);
  assert.equal(P.studyDays('2027-02-27', '2027-03-02', { weekdays: ALL }), 3, '평년은 29일 없음');
  // 시험일 당일 제외 · 오늘 포함
  assert.equal(P.studyDays('2026-11-17', '2026-11-18', {}), 1, '오늘 하루');
  assert.equal(P.studyDays('2026-11-17', '2026-11-17', {}), 0, '시험이 오늘이면 0');
  assert.equal(P.studyDays('2026-11-17', '2026-11-27', {}), 10);
  // 공부 요일 금(5) 빼기 — 2026-11-17(화) ~ 11-27(금, 시험) : 17..26 중 금요일 = 11-20 하나
  assert.equal(P.weekdayOf(P.dayNum('2026-11-20')), 5);
  assert.equal(P.studyDays('2026-11-17', '2026-11-27', { weekdays: [0, 1, 2, 3, 4, 6] }), 9);
  // 5주 넘게(빨리 감기 갈래) — 70일 중 금요일 10번
  assert.equal(P.studyDays('2026-11-17', P.dayKey(P.dayNum('2026-11-17') + 70), { weekdays: [0, 1, 2, 3, 4, 6] }), 60);
  assert.equal(P.studyDays('2026-11-17', '2026-11-27', { weekdays: [] }), 0, '요일 없음');
  // reserve 2 — 끝에서 복습만 할 날을 뺀다 · 0 아래로 안 감
  assert.equal(P.studyDays('2026-11-17', '2026-11-27', { reserve: 2 }), 8);
  assert.equal(P.studyDays('2026-11-17', '2026-11-19', { reserve: 5 }), 0);
});

/* ══ N2 구간 ═════════════════════════════════════════════ */
test('N2 ★ 읽은 쪽 구간 — 합치기·더하기·빼기 · unionRanges 와 같은 결과', () => {
  assert.deepEqual(P.rangesUnion([[5, 3], [10, 12], [6, 6], [1, 1], [11, 15], 'x', [NaN, 2]]), [[1, 1], [3, 6], [10, 15]]);
  assert.deepEqual(P.rangesAdd([[3, 5]], 6), [[3, 6]]);
  assert.deepEqual(P.rangesRemove([[3, 6]], 4), [[3, 3], [5, 6]]);
  assert.deepEqual(P.rangesRemove([[3, 6]], 1, 9), []);
  assert.deepEqual(P.rangesRemove([[3, 6], [9, 12]], 5, 10), [[3, 4], [11, 12]]);
  assert.equal(P.rangesHas([[3, 6]], 6), true);
  assert.equal(P.rangesHas([[3, 6]], 7), false);
  assert.equal(P.rangesCount([[3, 6], [9, 9]]), 5);
  const sample = [[7, 9], [1, 2], [3, 3], [20, 18], [10, 10], [30, 31]];
  assert.deepEqual(P.rangesUnion(sample), unionRanges(sample, []), '9c 병합과 같은 정규화');
});

/* ══ N3 남은 글자 ═════════════════════════════════════════ */
test('N3 ★ 남은 글자 — 겹침 합치기 · 글자 없는 쪽 평균 · readStats·기본 · 읽은 쪽 빼기', () => {
  const pc = { A: { 1: 1000, 2: 2000, 3: 3000 } };
  // 같은 책 1–3 과 2–4 → 1–4(겹침 한 번만) · 4쪽은 범위 안 센 쪽 평균 2000
  let r = P.remainingOf([{ docId: 'A', from: 1, to: 3 }, { docId: 'A', from: 2, to: 4 }], pc, {});
  assert.deepEqual(r, { total: 8000, read: 0, remaining: 8000, counted: 3, pages: 4, readPages: 0 });
  // 읽은 쪽 2·4 → 남은 1000 + 3000
  r = P.remainingOf([{ docId: 'A', from: 1, to: 4 }], pc, { A: [[2, 2], [4, 4]] });
  assert.deepEqual([r.read, r.remaining, r.readPages], [4000, 4000, 2]);
  // 범위 안 센 쪽이 없으면 readStats.chars/pages, 그것도 없으면 PLAN.DEFAULT_PAGE_CHARS
  r = P.remainingOf([{ docId: 'B', from: 10, to: 11 }], pc, {}, { B: { pages: 4, chars: 10000 } });
  assert.equal(r.total, 5000);
  r = P.remainingOf([{ docId: 'C', from: 1, to: 2 }], new Map(), new Map());
  assert.equal(r.total, 2 * PLAN.DEFAULT_PAGE_CHARS);
  assert.equal(r.counted, 0);
  // Map 도 받는다
  r = P.remainingOf([{ docId: 'A', from: 1, to: 2 }], new Map([['A', new Map([[1, 10], [2, 20]])]]), new Map([['A', [[1, 1]]]]));
  assert.deepEqual([r.total, r.read, r.remaining], [30, 10, 20]);
});

/* ══ N4 planFor ═════════════════════════════════════════ */
test('N4 ★ planFor — 예시 재현 · short · past · done · overCap 경계 · callsPer10k 0 · 복습 분 빼기 · finishDay', () => {
  // 17-12 2 예시: 한 장 약 18만 자 · both 기본 370자/분 · 10일 · 1만 자당 1.7 → 하루 49분 · 호출 31
  const ex = P.planFor({ today: '2026-11-17', exam: '2026-11-27', weekdays: ALL, reserve: 0, minutesPerDay: 49, reviewMinToday: 0,
    speed: PLAN.DEFAULT_CPM.both, callsPer10k: PLAN.DEFAULT_CALLS_PER_10K, cap: 100, remaining: 180000 });
  assert.equal(ex.days, 10);
  assert.equal(ex.needMinPerDay, 49, '180000 ÷ 370 ÷ 10 = 48.6 → 49');
  assert.equal(ex.calls, 31, '180000 × 1.7 ÷ 10000 = 30.6 → 31');
  assert.equal(Math.round(180000 / PLAN.DEFAULT_CPM.both / 6) / 10, 8.1, '약 8.1시간');
  assert.equal(ex.overCap, false);
  assert.equal(ex.status, 'tight', '시험 전날에 딱 끝남 — 여유 0 < 2');
  assert.equal(ex.needDays, 10, '49분 × 370 = 18,130자/일 → 10일');
  assert.equal(ex.finishDay, '2026-11-26', '시험 전날에 끝');
  assert.equal(ex.slackDays, 0);
  // 부동소수 찌꺼기: 100000 × 1.7 ÷ 10000 = 17 (18 아님)
  assert.equal(P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 60, speed: 370, callsPer10k: 1.7, remaining: 100000 }).calls, 17);
  // 남은 날 0(공부 요일 없음) → short · needMinPerDay null(화면 "—", 무한 아님)
  const sh = P.planFor({ today: '2026-11-17', exam: '2026-11-27', weekdays: [], minutesPerDay: 60, speed: 370, callsPer10k: 1.7, remaining: 5000 });
  assert.equal(sh.days, 0);
  assert.equal(sh.status, 'short');
  assert.equal(sh.needMinPerDay, null);
  // past — 시험일이 오늘·어제
  assert.equal(P.planFor({ today: '2026-11-17', exam: '2026-11-17', minutesPerDay: 60, speed: 370, remaining: 1 }).status, 'past');
  assert.equal(P.planFor({ today: '2026-11-17', exam: '2026-11-16', minutesPerDay: 60, speed: 370, remaining: 1 }).status, 'past');
  // done — 범위 다 읽음
  const dn = P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 60, speed: 370,
    targets: [{ docId: 'A', from: 1, to: 2 }], pageChars: { A: { 1: 100, 2: 100 } }, readRanges: { A: [[1, 2]] } });
  assert.equal(dn.status, 'done');
  assert.equal(dn.progress.readPages, 2);
  // overCap 경계 — 하루 호출 = 상한 × 0.8 이면 아님, 넘으면 그렇다
  const at = (cpm) => P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 100, speed: cpm, callsPer10k: 2, cap: 100, remaining: 1e7 });
  assert.equal(at(4000).overCap, false, '4000 × 100 × 2 ÷ 10000 = 80 = 100 × 0.8');
  assert.equal(at(4000).callsPerDay, 80);
  assert.equal(at(4000.01).overCap, true);
  // callsPer10k 0(번역 끔) → 호출 0 · 줄 숨김 · overCap 없음
  const off = P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 600, speed: 4000, callsPer10k: 0, cap: 1, remaining: 1e6 });
  assert.deepEqual([off.calls, off.callsPerDay, off.overCap, off.showCalls], [0, 0, false, false]);
  // 복습 분을 뺀 낭독 몫(13-D13) — 하루 60분 · 오늘 복습 15분 → 45분 · 하루 글자 = 속도 × 45
  const rv = P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 60, reviewMinToday: 15, speed: 400, callsPer10k: 1.7, cap: 100, remaining: 36000 });
  assert.equal(rv.readMinPerDay, 45);
  assert.equal(rv.dayChars, 18000);
  assert.equal(rv.needDays, 2);
  assert.equal(rv.finishDay, '2026-11-18');
  assert.equal(rv.slackDays, 8);
  assert.equal(rv.callsPerDay, 4, '18000 × 1.7 ÷ 10000 = 3.06 → 4(위로)');
  assert.equal(P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 10, reviewMinToday: 30, speed: 400, remaining: 100 }).readMinPerDay, 0);
  // tight(여유 < 2) · short(모자람) · finishDay 는 공부 요일로 센다
  const tg = P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 10, speed: 100, remaining: 9000 });   // 하루 1000자 → 9일 · 여유 1
  assert.deepEqual([tg.needDays, tg.slackDays, tg.status], [9, 1, 'tight']);
  const ms = P.planFor({ today: '2026-11-17', exam: '2026-11-27', minutesPerDay: 10, speed: 100, remaining: 20000 });
  assert.deepEqual([ms.slackDays, ms.status], [-10, 'short']);
  const fr = P.planFor({ today: '2026-11-17', exam: '2026-12-31', weekdays: [1], minutesPerDay: 10, speed: 100, remaining: 3000 });   // 월요일만 · 3일 필요
  assert.equal(fr.finishDay, '2026-12-07', '11-23 · 11-30 · 12-07');
});

/* ══ N5 속도 ═════════════════════════════════════════════ */
test('N5 ★ 속도 — 29분 → 추정 · 31분 → 실측 · 평균 1.0·지금 1.25 → ×1.25 · 다른 갈래 → 그 갈래 기본 · 14일 밖 빼기', () => {
  const MIN = 60000;
  const lg = (min, chars, rate, day) => ({ v: 1, days: { [day || '2026-11-17']: { both: { ms: min * MIN, chars: chars, rateMs: min * MIN * (rate || 1) } } } });
  let s = P.speedOf(lg(29, 29 * 500), { today: '2026-11-17', bucket: 'both', rate: 1 });
  assert.deepEqual([s.source, s.cpm], ['estimate', 370]);
  s = P.speedOf(lg(31, 31 * 500), { today: '2026-11-17', bucket: 'both', rate: 1 });
  assert.deepEqual([s.source, s.cpm], ['measured', 500]);
  s = P.speedOf(lg(31, 31 * 500, 1.0), { today: '2026-11-17', bucket: 'both', rate: 1.25 });
  assert.equal(s.cpm, 625, '500 × 1.25 ÷ 1.0');
  s = P.speedOf(lg(40, 40 * 600, 1.5), { today: '2026-11-17', bucket: 'both', rate: 1 });
  assert.ok(Math.abs(s.cpm - 400) < 1e-9, '잴 때 1.5 로 600 → 지금 1.0 이면 400');
  s = P.speedOf(lg(31, 31 * 500), { today: '2026-11-17', bucket: 'src', rate: 1.25 });
  assert.deepEqual([s.source, s.cpm], ['estimate', 840 * 1.25], '실측은 both — src 는 그 갈래 기본 × 속도');
  assert.equal(P.speedOf(lg(31, 31 * 500), { today: '2026-11-17', bucket: 'tr', rate: 1 }).cpm, 660);
  // 14일(오늘 포함) 밖은 빼고, 안은 더한다
  assert.equal(P.speedOf(lg(31, 31 * 500, 1, '2026-11-03'), { today: '2026-11-17', bucket: 'both' }).source, 'estimate', '15일 전');
  assert.equal(P.speedOf(lg(31, 31 * 500, 1, '2026-11-04'), { today: '2026-11-17', bucket: 'both' }).source, 'measured', '14일째');
  const two = { v: 1, days: { '2026-11-16': { both: { ms: 16 * MIN, chars: 16 * 500, rateMs: 16 * MIN } }, '2026-11-17': { both: { ms: 16 * MIN, chars: 16 * 500, rateMs: 16 * MIN } } } };
  assert.equal(P.speedOf(two, { today: '2026-11-17', bucket: 'both' }).source, 'measured', '두 날 합 32분');
  assert.equal(P.speedOf(null, { today: '2026-11-17', bucket: 'x' }).cpm, 840, '모르는 갈래 → src');
});

/* ══ N6 1만 자당 호출 ════════════════════════════════════ */
test('N6 ★ 1만 자당 호출 — usage.callsPer10k 문턱(3만 자) 미만 → 1.7 · 이상 → 실측 · src → 0', () => {
  const rows = (calls, chars) => [{ day: '2026-11-16', byKind: { readalong: calls }, charsTranslated: chars }];
  const under = callsPer10k(rows(10, 20000), { minChars: PLAN.CALLS_MIN_CHARS });
  assert.equal(under, null);
  assert.deepEqual(P.callsRateOf(under, 'both'), { value: 1.7, source: 'default' });
  const over = callsPer10k(rows(68, 400000), { minChars: PLAN.CALLS_MIN_CHARS });
  const m = P.callsRateOf(over, 'both');
  assert.equal(m.source, 'measured');
  assert.ok(Math.abs(m.value - 1.7) < 1e-12, '68 ÷ 400000 × 10000');
  assert.deepEqual(P.callsRateOf(callsPer10k(rows(5, 50000), { minChars: PLAN.CALLS_MIN_CHARS }), 'tr'), { value: 1, source: 'measured' });
  assert.deepEqual(P.callsRateOf(0, 'both'), { value: 0, source: 'measured' }, '전부 캐시 적중이면 0 도 실측');
  assert.deepEqual(P.callsRateOf(2.5, 'src'), { value: 0, source: 'off' });
  assert.equal(PLAN.CALLS_MIN_CHARS, 30000);
});

/* ══ N7 그 밖 ═════════════════════════════════════════════ */
test('N7 todayRange · reviewMinutes · logAdd·logTrim·cleanLog · bucketFor', () => {
  const pc = { A: { 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 }, B: { 1: 500, 2: 500 } };
  const tg = [{ docId: 'A', from: 1, to: 5 }, { docId: 'B', from: 1, to: 2 }];
  assert.deepEqual(P.todayRange(tg, pc, { A: [[1, 2]] }, 2500), [{ docId: 'A', from: 3, to: 5 }], '셋째 쪽부터');
  assert.deepEqual(P.todayRange(tg, pc, { A: [[1, 1], [3, 3]] }, 3000), [{ docId: 'A', from: 2, to: 2 }, { docId: 'A', from: 4, to: 5 }]);
  assert.deepEqual(P.todayRange(tg, pc, { A: [[1, 5]] }, 800), [{ docId: 'B', from: 1, to: 2 }]);
  assert.deepEqual(P.todayRange(tg, pc, { A: [[1, 5]], B: [[1, 2]] }, 800), []);
  assert.deepEqual(P.todayRange(tg, pc, {}, 0), []);
  // 복습 — 장당 시간 = 최근 14일 Σms ÷ Σn, 없으면 8초
  assert.equal(P.reviewMinutes(30, {}, '2026-11-17'), 4, '30 × 8초 = 4분');
  assert.equal(P.reviewMinutes(30, { '2026-11-16': { n: 10, ms: 200000, new: 2 } }, '2026-11-17'), 10, '20초 × 30 = 10분');
  assert.equal(P.reviewMinutes(0, {}, '2026-11-17'), 0);
  // 낭독 기록 꼴
  let lg = P.logAdd({}, '2026-11-17', 'both', { ms: 1000, chars: 10, rateMs: 1000 });
  lg = P.logAdd(lg, '2026-11-17', 'both', { ms: 500, chars: 5, rateMs: 750 });
  lg = P.logAdd(lg, '2026-11-17', null, { pages: 2 });
  assert.deepEqual(lg, { v: 1, days: { '2026-11-17': { both: { ms: 1500, chars: 15, rateMs: 1750 }, pages: 2 } } });
  lg = P.logAdd(lg, '2026-09-18', 'src', { ms: 1, chars: 0 });
  lg = P.logAdd(lg, '2026-09-19', 'src', { ms: 1, chars: 0 });
  const tr = P.logTrim(lg, '2026-11-17');
  assert.deepEqual(Object.keys(tr.days).sort(), ['2026-09-19', '2026-11-17'], '오늘 포함 60일');
  assert.deepEqual(P.cleanLog({ days: { bad: {}, '2026-11-17': { zz: { ms: 1 }, src: { ms: '5', chars: -3 } } } }),
    { v: 1, days: { '2026-11-17': { src: { ms: 5, chars: 0, rateMs: 0 } } } });
  assert.deepEqual(P.cleanLog(Object.freeze({})), { v: 1, days: {} });
  assert.deepEqual([P.bucketFor('speak', true), P.bucketFor('speak', false), P.bucketFor('show', false), P.bucketFor('off', true)], ['both', 'tr', 'src', 'src']);
});

/* ══ N8 정적 ═════════════════════════════════════════════ */
test('N8 ★ 정적 — planner 는 순수(Date·document·window 0 · import 는 config 만) · PLAN 상수', () => {
  const s = src('../js/plan/planner.js');
  for (const w of ['Date', 'document', 'window']) assert.ok(!s.includes(w), w + ' 0');
  const imports = [...s.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../config.js']);
  assert.equal(PLAN.CAP_SHARE, 0.8);
  assert.equal(PLAN.MAX_GAP_MS, 120000);
  assert.equal(PLAN.MEASURE_MIN_MS, 30 * 60000);
  assert.deepEqual(PLAN.DEFAULT_CPM, { src: 840, both: 370, tr: 660 });
});
