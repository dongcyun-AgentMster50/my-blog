/* ============================================================
   tests/quiz-order.test.mjs — planQuizOrder: 어떤 문항을 어떤 순서로 낼까

   정책(사용자 위임, 2026-09-24):
     "원서 순서를 지키고, 중간에 나갔으면 이어서 푼다."

   섞지 않는 이유 둘 —
     · 이 책은 섹션 안에서 문항이 주제별로 묶여 있고 해설이 장을 참조한다.
       순서를 흩으면 원서와 나란히 보는 사용법이 깨진다.
     · `[실측]` sec-III 는 273문항이다. 한자리에 다 풀 양이 아니다.

   순수 함수다 — db·DOM 을 보지 않으므로 Node 에서 그대로 돈다.
   픽스처 문장은 전부 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { planQuizOrder, attemptedIdsOf, wrongIdsOf } from '../js/quiz/engine.js';

/** 번호 n 짜리 문항. status 기본은 verified. */
function q(n, status) {
  return {
    id: 'doc:sec-I:q' + n,
    number: n,
    status: status || 'verified',
    stem: n + '번 문항의 지어낸 본문이다.',
    options: [{ letter: 'A', text: '첫째' }, { letter: 'B', text: '둘째' }]
  };
}

const ids = (list) => list.map(function (x) { return x.number; });

/** attempt 한 벌. items 는 [number, correct] 쌍으로 준다. */
function attempt(pairs) {
  return {
    at: 1,
    items: pairs.map(function (p) {
      return { questionId: 'doc:sec-I:q' + p[0], chosen: 'A', correct: p[1] };
    })
  };
}

/* ── 이어 풀기 ──────────────────────────────────────────── */

test('O1 직전 기록이 없으면 섹션 전체를 원서 번호 순으로 낸다', () => {
  const all = [q(1), q(2), q(3), q(4)];
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: null, mode: 'all' })), [1, 2, 3, 4]);
});

test('O2 ★ 중간에 나갔으면 **안 푼 것부터** 이어서 낸다', () => {
  // 273문항짜리 섹션을 한자리에 다 풀 수는 없다. 이어 풀기가 기본이어야 한다.
  const all = [q(1), q(2), q(3), q(4), q(5)];
  const last = attempt([[1, true], [2, false]]);
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: last, mode: 'all' })), [3, 4, 5]);
});

test('O3 직전 시도가 끝까지 갔으면 새 회차 — 섹션 전체를 다시 낸다', () => {
  const all = [q(1), q(2), q(3)];
  const last = attempt([[1, true], [2, false], [3, true]]);
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: last, mode: 'all' })), [1, 2, 3]);
});

test('O4 채점되지 않은 unverified 문항도 "푼 것"으로 쳐서 다시 내지 않는다', () => {
  // 채점만 안 될 뿐 사용자는 읽고 답을 골랐다. 이어 풀기에서 또 나오면 성가시다.
  const all = [q(1), q(2, 'unverified'), q(3)];
  const last = { at: 1, items: [
    { questionId: 'doc:sec-I:q1', chosen: 'A', correct: true },
    { questionId: 'doc:sec-I:q2', chosen: 'A', correct: null }   // 채점 안 됨
  ] };
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: last, mode: 'all' })), [3]);
});

test('O5 ★ 순서를 섞지 않는다 — 언제나 원서 번호 순 그대로', () => {
  const all = [q(1), q(2), q(3), q(4), q(5), q(6), q(7), q(8)];
  const out = planQuizOrder({ questions: all, lastAttempt: null, mode: 'all' });
  assert.deepEqual(ids(out), [1, 2, 3, 4, 5, 6, 7, 8]);
  // 이어 풀기에서도 남은 것들의 상대 순서가 유지된다
  const resumed = planQuizOrder({
    questions: all, mode: 'all', lastAttempt: attempt([[1, true], [2, true], [3, false]])
  });
  assert.deepEqual(ids(resumed), [4, 5, 6, 7, 8]);
});

/* ── [오답만 다시] ──────────────────────────────────────── */

test('O6 wrong-only 는 틀린 것으로 채점된 문항만, 원서 순서로', () => {
  const all = [q(1), q(2), q(3), q(4)];
  const last = attempt([[1, true], [2, false], [3, true], [4, false]]);
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: last, mode: 'wrong-only' })), [2, 4]);
});

test('O7 ★ unverified 는 틀린 적이 없으므로 wrong-only 에 끼지 않는다', () => {
  const all = [q(1), q(2, 'unverified'), q(3)];
  const last = { at: 1, items: [
    { questionId: 'doc:sec-I:q1', chosen: 'A', correct: false },
    { questionId: 'doc:sec-I:q2', chosen: 'A', correct: null },   // 채점 안 됨 ≠ 오답
    { questionId: 'doc:sec-I:q3', chosen: 'A', correct: true }
  ] };
  assert.deepEqual(ids(planQuizOrder({ questions: all, lastAttempt: last, mode: 'wrong-only' })), [1]);
});

test('O8 오답이 없으면 wrong-only 는 빈 배열 — 호출자가 "풀 문항 없음"으로 처리한다', () => {
  const all = [q(1), q(2)];
  assert.deepEqual(planQuizOrder({ questions: all, lastAttempt: attempt([[1, true], [2, true]]), mode: 'wrong-only' }), []);
  assert.deepEqual(planQuizOrder({ questions: all, lastAttempt: null, mode: 'wrong-only' }), []);
});

/* ── 불변식·위생 ────────────────────────────────────────── */

test('O9 결과는 언제나 questions 의 부분집합이고 중복이 없다', () => {
  const all = [q(1), q(2), q(3), q(4)];
  const cases = [
    { questions: all, lastAttempt: null, mode: 'all' },
    { questions: all, lastAttempt: attempt([[1, true]]), mode: 'all' },
    { questions: all, lastAttempt: attempt([[1, false], [2, false]]), mode: 'wrong-only' }
  ];
  for (const c of cases) {
    const out = planQuizOrder(c);
    const seen = new Set();
    for (const x of out) {
      assert.ok(all.indexOf(x) >= 0, '원본에 없는 문항이 나왔다');
      assert.ok(!seen.has(x.id), '같은 문항이 두 번 나왔다');
      seen.add(x.id);
    }
  }
});

test('O10 ctx 가 없거나 깨져도 던지지 않는다', () => {
  assert.deepEqual(planQuizOrder(undefined), []);
  assert.deepEqual(planQuizOrder(null), []);
  assert.deepEqual(planQuizOrder({}), []);
  assert.deepEqual(planQuizOrder({ questions: 'not an array' }), []);
  assert.deepEqual(planQuizOrder({ questions: [], mode: 'all' }), []);
  // lastAttempt 가 깨져도 전체를 낸다
  assert.equal(planQuizOrder({ questions: [q(1)], lastAttempt: { items: 'nope' }, mode: 'all' }).length, 1);
});

test('O11 ctx 를 고치지 않는다(순수)', () => {
  const ctx = { questions: [q(1), q(2)], lastAttempt: attempt([[1, true]]), mode: 'all' };
  const snapshot = JSON.stringify(ctx);
  planQuizOrder(ctx);
  assert.equal(JSON.stringify(ctx), snapshot);
});

/* ── 보조 함수 ──────────────────────────────────────────── */

test('O12 attemptedIdsOf 는 채점 여부와 무관하게 손댄 것을 센다', () => {
  const a = { items: [
    { questionId: 'x', correct: true }, { questionId: 'y', correct: false }, { questionId: 'z', correct: null }
  ] };
  assert.deepEqual([...attemptedIdsOf(a)].sort(), ['x', 'y', 'z']);
  assert.deepEqual([...wrongIdsOf(a)], ['y'], 'wrongIdsOf 는 correct === false 만');
  assert.deepEqual([...attemptedIdsOf(null)], []);
});
