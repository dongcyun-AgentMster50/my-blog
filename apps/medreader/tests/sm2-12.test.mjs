/* ============================================================
   tests/sm2-12.test.mjs — 12-1 SM-2 순수 (spec 17-11 3 · 8 "12-1" 수용 기준)

   - `srs/sm2.js` `next`: 시험 표 S1–S10(규칙으로 다시 계산해 고정 — 주: ease 를 바꾸는 단추는 바꾼 뒤 값으로 곱한다)
     · dueAt = dayStartMs + interval × 하루, again 은 nowMs + 10분
   - `previewLabels` 네 칸 = `next()` 결과(분·일·개월·년 단위 고르기)
   - `isDue`·`isNew`
   - `[12-1b]` N5 단조성 — 같은 상태에서 again ≤ hard ≤ good ≤ easy(두 번째 [쉬움] ≥ 7일)
   - 순수(16-A): 시계·DOM·브라우저 전역 참조 0, import 는 config 만
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { next, previewLabels, isDue, isNew, spanOf, normalizeSm2, startSm2 } from '../js/srs/sm2.js';
import { SRS } from '../js/config.js';

const DAY = 86400000;
const NOW = 1763370000000 + 9 * 3600000;        // 임의의 시각(숫자만 — 순수 시험)
const START = NOW - 9 * 3600000;                 // 그날 0시라고 넘기는 값
const CTX = { nowMs: NOW, dayStartMs: START };
const st = (ease, interval, reps, lapses) => ({ ease: ease, interval: interval, reps: reps, lapses: lapses || 0 });

/** S1–S10 — 설계 표(17-11 3)를 규칙으로 다시 계산한 값. */
const TABLE = [
  ['S1', st(2.5, 0, 0), 'good', { interval: 1, reps: 1, ease: 2.5 }],
  ['S2', st(2.5, 1, 1), 'good', { interval: 6, reps: 2, ease: 2.5 }],
  ['S3', st(2.5, 6, 2), 'good', { interval: 15, reps: 3, ease: 2.5 }],
  ['S4', st(2.5, 6, 2), 'hard', { interval: 7, reps: 3, ease: 2.35 }],
  ['S5', st(2.5, 6, 2), 'easy', { interval: 21, reps: 3, ease: 2.65 }],   // round(6 × 2.65 × 1.3 = 20.67)
  ['S6', st(2.5, 15, 3), 'again', { interval: 0, reps: 0, ease: 2.3 }],
  ['S7', st(1.3, 15, 3), 'again', { interval: 0, reps: 0, ease: 1.3 }],    // 바닥
  ['S8', st(2.5, 300, 6), 'good', { interval: 365, reps: 7, ease: 2.5 }],  // 상한(750 → 365)
  ['S9', st(2.5, 0, 0), 'easy', { interval: 4, reps: 1, ease: 2.65 }],
  ['S10', st(2.5, 0, 0), 'hard', { interval: 1, reps: 1, ease: 2.35 }]
];

for (const [id, s, g, want] of TABLE) {
  test(id + ' ★ next(' + JSON.stringify(s) + ', ' + g + ') → ' + JSON.stringify(want), () => {
    const r = next(s, g, CTX);
    assert.equal(r.sm2.interval, want.interval, 'interval');
    assert.equal(r.sm2.reps, want.reps, 'reps');
    assert.equal(r.sm2.ease.toFixed(2), want.ease.toFixed(2), 'ease(소수 둘째 자리)');
    assert.equal(r.sm2.ease, want.ease, 'ease 는 둘째 자리로 맞춘 수(2.3499… 아님)');
    if (g === 'again') {
      assert.equal(r.dueAt, NOW + 10 * 60 * 1000, 'again → now + 10분');
      assert.equal(r.sm2.lapses, s.lapses + 1, 'lapses + 1');
    } else {
      assert.equal(r.dueAt, START + want.interval * DAY, 'dueAt = 그날 0시 + interval 일');
      assert.equal(r.sm2.lapses, s.lapses, 'lapses 그대로');
    }
    assert.deepEqual(s, st(s.ease, s.interval, s.reps, s.lapses), '넘긴 상태를 고치지 않는다');
  });
}

test('N1 next — S1 dueAt 은 내일 0시 · 모르는 단추 null · 상태 없음 = 처음 값 · 틀린 칸 다듬기', () => {
  assert.equal(next(null, 'good', CTX).dueAt, START + DAY, '새 카드 good → 내일 0시');
  assert.equal(next(st(2.5, 0, 0), 'meh', CTX), null);
  assert.deepEqual(next(undefined, 'good', CTX).sm2, { ease: 2.5, interval: 1, reps: 1, lapses: 0 });
  assert.deepEqual(normalizeSm2({ ease: 'x', interval: -3, reps: 2.7, lapses: null }), { ease: 2.5, interval: 0, reps: 2, lapses: 0 });
  assert.deepEqual(normalizeSm2({ ease: 0.9 }), { ease: 1.3, interval: 0, reps: 0, lapses: 0 }, 'ease 바닥');
  assert.deepEqual(startSm2(), { ease: 2.5, interval: 0, reps: 0, lapses: 0 });
  // hard 는 ease 를 곱하지 않는다(×1.2) · good 은 바뀐(그대로인) ease 로
  assert.equal(next(st(2.0, 10, 4), 'hard', CTX).sm2.interval, 12);
  assert.equal(next(st(2.0, 10, 4), 'good', CTX).sm2.interval, 20);
  // reps 1 의 hard·easy — 공식 갈래(max(interval+1, …)) · `[12-1b]` easy 는 SECOND_GOOD_DAYS+1(7) 아래로 가지 않는다
  assert.equal(next(st(2.5, 1, 1), 'hard', CTX).sm2.interval, 2);
  assert.equal(next(st(2.5, 1, 1), 'easy', CTX).sm2.interval, 7, 'max(7, max(2, round(1 × 2.65 × 1.3 = 3.4))) — 좋음 6 보다 길게');
  assert.equal(next(st(2.35, 1, 1), 'easy', CTX).sm2.interval, 7, '처음 [어려움] 뒤 두 번째 [쉬움]');
  assert.equal(next(st(2.65, 4, 1), 'easy', CTX).sm2.interval, 15, '처음 [쉬움](4일) 뒤 — 공식 값 round(4 × 2.8 × 1.3 = 14.56) 이 7 보다 크면 그대로');
  assert.equal(next(st(2.5, 1, 1), 'easy', CTX).dueAt, START + 7 * DAY);
  // again 뒤 다시 good 은 reps 0 갈래(1일)
  const a = next(st(2.5, 15, 3), 'again', CTX);
  assert.equal(next(a.sm2, 'good', CTX).sm2.interval, 1);
  // 연달아 again 해도 ease 는 1.3 아래로 가지 않는다
  let s = st(2.5, 0, 0);
  for (let i = 0; i < 10; i++) s = next(s, 'again', CTX).sm2;
  assert.equal(s.ease, 1.3);
  assert.equal(s.lapses, 10);
});

test('N2 ★ previewLabels — 네 칸이 next() 결과와 같다 · 단위 고르기(분·일·개월·년)', () => {
  for (const s of [st(2.5, 0, 0), st(2.5, 1, 1), st(2.5, 6, 2), st(2.5, 15, 3), st(2.5, 300, 6), st(1.3, 40, 5)]) {
    const L = previewLabels(s, CTX);
    assert.deepEqual(L.map((x) => x.grade), ['again', 'hard', 'good', 'easy']);
    for (const x of L) {
      const r = next(s, x.grade, CTX);
      assert.equal(x.dueAt, r.dueAt, x.grade + ' dueAt = next()');
      const want = x.grade === 'again' ? spanOf(r.dueAt - NOW) : spanOf(r.sm2.interval * DAY);
      assert.deepEqual({ n: x.n, unit: x.unit }, want, x.grade);
    }
  }
  // 새 카드: 10분 · 1일 · 1일 · 4일
  assert.deepEqual(previewLabels(st(2.5, 0, 0), CTX).map((x) => x.n + x.unit), ['10min', '1day', '1day', '4day']);
  // S3 꼴: 10분 · 7일 · 15일 · 21일
  assert.deepEqual(previewLabels(st(2.5, 6, 2), CTX).map((x) => x.n + x.unit), ['10min', '7day', '15day', '21day']);
  // 15일 → good 38일(1개월) · easy 52일(2개월)
  assert.deepEqual(previewLabels(st(2.5, 15, 3), CTX).map((x) => x.n + x.unit), ['10min', '18day', '1month', '2month']);
  // 상한 → 1년
  assert.deepEqual(previewLabels(st(2.5, 300, 6), CTX).slice(2).map((x) => x.n + x.unit), ['1year', '1year']);
  assert.deepEqual(spanOf(90 * 60000), { n: 2, unit: 'hour' });
  assert.deepEqual(spanOf(29 * DAY), { n: 29, unit: 'day' });
  assert.deepEqual(spanOf(30 * DAY), { n: 1, unit: 'month' });
  assert.deepEqual(spanOf(400 * DAY), { n: 1.1, unit: 'year' });
});

/* `[12-1b — 12-1R #1]` 단조성: 같은 상태에서 again ≤ hard ≤ good ≤ easy(간격 — again 은 0) · 다음 복습 시각도 같은 순서(hard·good·easy). */
function assertMonotone(s, where) {
  const r = {};
  for (const g of SRS.GRADES) r[g] = next(s, g, CTX);
  const iv = SRS.GRADES.map((g) => r[g].sm2.interval);
  assert.ok(iv[0] <= iv[1] && iv[1] <= iv[2] && iv[2] <= iv[3], where + ' ' + JSON.stringify(s) + ' → ' + iv.join(' · '));
  assert.ok(r.hard.dueAt <= r.good.dueAt && r.good.dueAt <= r.easy.dueAt, where + ' dueAt');
}

test('N5 ★ 단조성 — again ≤ hard ≤ good ≤ easy · reps 0·1·2·n × ease 여러 값 · 무작위 걸음 수천 상태 · reps 1 은 간격 1·4 로만 닿는다', () => {
  // 처음 [좋음]·[어려움] 뒤 두 번째(12-1R R1d — 고치기 전 good 6 · easy 3)
  assert.deepEqual(previewLabels(st(2.5, 1, 1), CTX).map((x) => x.n + x.unit), ['10min', '2day', '6day', '7day']);
  assert.deepEqual(previewLabels(st(2.35, 1, 1), CTX).map((x) => x.n + x.unit), ['10min', '2day', '6day', '7day']);
  const eases = [1.3, 1.31, 1.45, 1.7, 2.0, 2.2, 2.35, 2.5, 2.65, 2.8, 3.1, 3.5, 4.2];
  let n = 0;
  for (const e of eases) {
    for (let i = 0; i <= 5; i++) { assertMonotone(st(e, i, 0), 'reps0'); assertMonotone(st(e, i, 1), 'reps1'); n += 2; }
    for (const reps of [2, 3, 4, 7, 15, 40]) {
      for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 21, 38, 60, 100, 200, 280, 300, 364, 365, 400]) { assertMonotone(st(e, i, reps, 2), 'reps' + reps); n++; }
    }
  }
  // 무작위 걸음(씨앗 고정 — 같은 결과): 처음 상태에서 단추를 무작위로 눌러 닿는 상태마다
  let seed = 0x12b1;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const seenReps = new Set();
  for (let w = 0; w < 300; w++) {
    let s = startSm2();
    const len = 1 + Math.floor(rnd() * 30);
    for (let k = 0; k < len; k++) {
      assertMonotone(s, 'walk' + w + '/' + k);
      n++;
      seenReps.add(Math.min(s.reps, 3));
      if (s.reps === 1) assert.ok(s.interval === 1 || s.interval === 4, 'reps 1 은 처음 간격(1·4)으로만 닿는다: ' + JSON.stringify(s));
      s = next(s, SRS.GRADES[Math.floor(rnd() * 4)], CTX).sm2;
    }
  }
  assert.ok(n >= 3000, '상태 ' + n + '개');
  assert.deepEqual([...seenReps].sort(), [0, 1, 2, 3], '걸음이 reps 0·1·2·n 을 모두 지난다');
});

test('N3 isDue·isNew — 오늘 끝 앞이면 due · 멈춤은 아님 · 숫자가 아니면 오늘(잃지 않게) · 새 카드 = 복습 기록 없음 + reps 0', () => {
  const end = START + DAY;
  assert.equal(isDue({ dueAt: end - 1 }, end), true);
  assert.equal(isDue({ dueAt: end }, end), false, '내일 0시 = 내일');
  assert.equal(isDue({ dueAt: end - 1, suspended: true }, end), false);
  assert.equal(isDue({ dueAt: '2026-01-01T00:00:00Z' }, end), true, '문자열은 호출자가 숫자로 바꿔 넘긴다 — 순수 쪽은 "모름" = 오늘');
  assert.equal(isDue({}, end), true);
  assert.equal(isDue(null, end), false);
  assert.equal(isNew({ sm2: { reps: 0 }, reviewedAt: null }), true);
  assert.equal(isNew({}), true, '8f 옛 항목(sm2 없음)도 새 카드');
  assert.equal(isNew({ sm2: { reps: 0 }, reviewedAt: NOW }), false, 'again 뒤 reps 0 이어도 매긴 카드');
  assert.equal(isNew({ sm2: { reps: 2 }, reviewedAt: null }), false);
});

test('N4 ★ 순수(16-A) — 시계·DOM·브라우저 전역 0 · import 는 config 만 · 상수는 config SRS', () => {
  const src = readFileSync(new URL('../js/srs/sm2.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const banned = /\b(Date|document|window|globalThis|navigator|indexedDB|fetch|localStorage|sessionStorage|performance|setTimeout)\b/;
  const hits = code.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => banned.test(l));
  assert.deepEqual(hits, [], 'sm2.js 가 순수 계층 밖을 참조한다');
  assert.ok(!/\bDate\b/.test(src), '주석에도 Date 를 쓰지 않는다(16-A grep 은 원문 그대로)');
  const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
  assert.deepEqual(imports.map((s) => s.replace(/^[\s\S]*from\s*/, '')), ["'../config.js'"]);
  assert.equal(SRS.AGAIN_MS, 600000);
  assert.equal(SRS.MAX_INTERVAL_DAYS, 365);
  assert.equal(SRS.EASE_MIN, 1.3);
  assert.deepEqual(SRS.GRADES, ['again', 'hard', 'good', 'easy']);
});
