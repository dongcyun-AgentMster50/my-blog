/* ============================================================
   tests/quiz-nav.test.mjs — 문항 이동 (prev · goTo)

   `[실기기 2026-09-26]` 사용자: "문항을 풀기전에 고를수 있게 해줘.
   문항 1/149 보이거든. 문항을 내가 써서 이동할 수 있게 하거나,
   이전 문제, 다음 문제로 고를수있게 해줘 풀기 전 상태에서라도 말야"

   149문항짜리 섹션을 앞에서부터만 훑어야 한다면 쓸 수 없는 물건이다.
   픽스처 문장은 전부 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession } from '../js/quiz/engine.js';

function q(n, over) {
  return Object.assign({
    id: 'd:sec-I:q' + n, docId: 'd', sectionId: 'sec-I', source: 'book',
    status: 'verified', number: n, stem: n + '번 지어낸 문항입니다.',
    options: [{ letter: 'A', text: '가' }, { letter: 'B', text: '나' },
              { letter: 'C', text: '다' }, { letter: 'D', text: '라' }],
    answer: { letters: ['B'] }, explanation: { en: '지어낸 해설' },
    pageNo: 10, paraIds: ['10:p0'], hasFigure: false, createdAt: 0
  }, over || {});
}

function fakeClock() { let t = 1000; return function () { t += 50; return t; }; }

function session(count) {
  const qs = [];
  for (let i = 1; i <= count; i++) qs.push(q(i));
  return createSession({ docId: 'd', sectionId: 'sec-I', questions: qs, mode: 'all', now: fakeClock() });
}

/* ── 풀기 전에 움직일 수 있는가 ─────────────────────────── */

test('N1 ★ 답을 찍지 않고도 다음 문항으로 넘어간다', () => {
  const s = session(5);
  assert.equal(s.position(), 1);
  assert.equal(s.answered(), false);
  s.next();
  assert.equal(s.position(), 2);
  assert.equal(s.answered(), false, '넘어가도 답한 것으로 치지 않는다');
});

test('N2 ★ 앞 문항으로 되돌아간다', () => {
  const s = session(5);
  s.next(); s.next();
  assert.equal(s.position(), 3);
  s.prev();
  assert.equal(s.position(), 2);
  s.prev();
  assert.equal(s.position(), 1);
});

test('N3 첫 문항에서 prev 는 제자리다 — 밑으로 떨어지지 않는다', () => {
  const s = session(3);
  s.prev(); s.prev();
  assert.equal(s.position(), 1);
  assert.notEqual(s.current(), null);
});

/* ── 번호로 이동 ────────────────────────────────────────── */

test('N4 ★ 번호를 써서 이동한다 — 화면에 보이는 1-based 와 같다', () => {
  const s = session(149);
  const got = s.goTo(87);
  assert.notEqual(got, null);
  assert.equal(s.position(), 87);
  assert.equal(s.current().number, 87, '87번째로 갔으면 87번 문항이다');
});

test('N5 ★ 범위 밖이면 아무 일도 하지 않고 null — 호출자가 입력을 되돌린다', () => {
  const s = session(5);
  s.goTo(3);
  assert.equal(s.goTo(0), null);
  assert.equal(s.goTo(6), null);
  assert.equal(s.goTo(-1), null);
  assert.equal(s.goTo('아무거나'), null);
  assert.equal(s.goTo(null), null);
  assert.equal(s.position(), 3, '실패한 이동이 자리를 흔들지 않는다');
});

test('N6 경계 — 1 과 마지막은 유효하다', () => {
  const s = session(5);
  assert.notEqual(s.goTo(1), null);
  assert.equal(s.position(), 1);
  assert.notEqual(s.goTo(5), null);
  assert.equal(s.position(), 5);
});

/* ── 채점 기록을 흔들지 않는가 ──────────────────────────── */

test('N7 ★ 되돌아가도 첫 응답이 그대로 남는다 — 점수가 되감기지 않는다', () => {
  const s = session(3);
  s.answer('B');                 // 1번 정답
  s.next();
  s.answer('A');                 // 2번 오답
  s.prev();                      // 1번으로 되돌아간다

  assert.equal(s.position(), 1);
  assert.equal(s.answered(), true, '이미 답한 문항이다');
  const again = s.answer('C');   // 다시 눌러도
  assert.equal(again.correct, true, '첫 응답(B, 정답)이 남는다');

  const r = s.result();
  assert.equal(r.score, 1);
  assert.equal(r.total, 2, '건드린 두 문항만 채점됐다');
});

test('N8 넘기기만 한 문항은 채점에 들지 않는다', () => {
  const s = session(4);
  s.answer('B');                 // 1번만 푼다
  s.next(); s.next(); s.next();  // 2·3·4 는 그냥 지나간다
  const r = s.result();
  assert.equal(r.total, 1, '푼 것만 분모다');
  assert.equal(r.score, 1);
  assert.equal(r.answered, 1);
});

test('N9 ★ 결과 화면에서 prev/goTo 로 되돌아올 수 있다 (finished 해제)', () => {
  const s = session(2);
  s.answer('B'); s.next();
  s.answer('B'); s.next();
  assert.equal(s.isFinished(), true);

  s.prev();
  assert.equal(s.isFinished(), false, '되돌아오면 결과 화면이 아니다');
  assert.notEqual(s.current(), null);

  s.next();
  assert.equal(s.isFinished(), true, '다시 끝으로 가면 결과다');
});

test('N10 goTo 도 finished 를 푼다', () => {
  const s = session(3);
  s.next(); s.next(); s.next();
  assert.equal(s.isFinished(), true);
  s.goTo(2);
  assert.equal(s.isFinished(), false);
  assert.equal(s.position(), 2);
});

test('N11 빈 세션에서 이동이 던지지 않는다', () => {
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: [], mode: 'all', now: fakeClock() });
  assert.equal(s.total(), 0);
  assert.doesNotThrow(() => { s.prev(); s.next(); s.goTo(1); });
  assert.equal(s.goTo(1), null);
});
