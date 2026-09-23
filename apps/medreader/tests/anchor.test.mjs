/* ============================================================
   6b — pickAnchorLine: 뷰를 바꿀 때 어느 줄로 착지하는가

   정책(사용자 결정, 2026-09-23):
     "듣는 곳과 보는 곳이 같으면 낭독 줄, 다르면 보고 있던 곳."

   순수 함수다 — document·window 를 보지 않으므로 Node 에서 그대로 돈다.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAnchorLine } from '../js/ui/original.js';

/** ctx 를 짓는다. 지정하지 않은 조각은 "단서 없음"이다. */
function ctx(o) {
  return Object.assign({
    speaking: false,
    currentLineId: null,
    visibleLineIds: [],
    viewportCenterLineId: null,
    lastTappedLineId: null
  }, o || {});
}

/* ── ① 듣는 곳 == 보는 곳 ───────────────────────────────── */

test('A1 낭독 중이고 낭독 줄이 화면에 보이면 그 줄로 착지한다', () => {
  const got = pickAnchorLine(ctx({
    speaking: true,
    currentLineId: '3:12',
    visibleLineIds: ['3:10', '3:11', '3:12', '3:13'],
    viewportCenterLineId: '3:11'
  }));
  assert.equal(got, '3:12');
});

test('A2 낭독 줄이 중앙이 아니어도, 보이기만 하면 중앙을 이긴다', () => {
  const got = pickAnchorLine(ctx({
    speaking: true,
    currentLineId: '3:13',
    visibleLineIds: ['3:10', '3:11', '3:12', '3:13'],
    viewportCenterLineId: '3:11',
    lastTappedLineId: '3:10'
  }));
  assert.equal(got, '3:13');
});

/* ── ② 듣는 곳 != 보는 곳 → 보고 있던 곳을 지킨다 ──────── */

test('A3 ★ 낭독 중이지만 낭독 줄이 화면 밖이면 낭독 줄로 끌고 가지 않는다', () => {
  // 낭독을 틀어놓고 다른 쪽을 훑는 상황. 이 테스트가 정책의 핵심이다.
  const got = pickAnchorLine(ctx({
    speaking: true,
    currentLineId: '3:2',                       // 위로 한참 올라간 줄
    visibleLineIds: ['3:40', '3:41', '3:42'],
    viewportCenterLineId: '3:41'
  }));
  assert.equal(got, '3:41');
  assert.notEqual(got, '3:2');
});

test('A4 탭한 줄이 지금도 보이면 화면 중앙을 이긴다 — 탭이 더 명시적인 의도다', () => {
  const got = pickAnchorLine(ctx({
    visibleLineIds: ['3:40', '3:41', '3:42'],
    viewportCenterLineId: '3:41',
    lastTappedLineId: '3:42'
  }));
  assert.equal(got, '3:42');
});

test('A5 탭한 줄이 화면 밖이면 낡은 의도로 보고 버린다', () => {
  const got = pickAnchorLine(ctx({
    visibleLineIds: ['3:40', '3:41', '3:42'],
    viewportCenterLineId: '3:41',
    lastTappedLineId: '1:5'                     // 탭하고 한참 스크롤했다
  }));
  assert.equal(got, '3:41');
});

test('A6 낭독 중이 아니면 낭독 줄이 보여도 쓰지 않는다', () => {
  // speaking=false 는 "지금 읽고 있지 않다"는 뜻이다. 그때 기준은 눈이다.
  const got = pickAnchorLine(ctx({
    speaking: false,
    currentLineId: '3:40',
    visibleLineIds: ['3:40', '3:41', '3:42'],
    viewportCenterLineId: '3:41'
  }));
  assert.equal(got, '3:41');
});

/* ── ③④ 단서가 얇아질 때 ───────────────────────────────── */

test('A7 중앙이 없으면 보이는 첫 줄 — 쪽 맨 위로 튀는 것보다 낫다', () => {
  const got = pickAnchorLine(ctx({ visibleLineIds: ['7:3', '7:4'] }));
  assert.equal(got, '7:3');
});

test('A8 단서가 하나도 없으면 null — 호출자가 쪽 첫 줄로 간다', () => {
  assert.equal(pickAnchorLine(ctx({})), null);
});

/* ── 위생: 순수함과 잘못된 입력 ─────────────────────────── */

test('A9 ctx 가 없거나 조각이 깨져도 던지지 않는다', () => {
  assert.equal(pickAnchorLine(undefined), null);
  assert.equal(pickAnchorLine(null), null);
  assert.equal(pickAnchorLine({}), null);
  assert.equal(pickAnchorLine({ visibleLineIds: 'not an array' }), null);
  assert.equal(pickAnchorLine({ visibleLineIds: null, viewportCenterLineId: '2:1' }), '2:1');
});

test('A10 빈 문자열·공백은 단서로 치지 않는다', () => {
  const got = pickAnchorLine(ctx({
    speaking: true,
    currentLineId: '   ',
    visibleLineIds: ['3:40'],
    lastTappedLineId: '',
    viewportCenterLineId: '3:40'
  }));
  assert.equal(got, '3:40');
});

test('A11 ctx 를 고치지 않는다(순수)', () => {
  const c = ctx({
    speaking: true,
    currentLineId: '3:12',
    visibleLineIds: ['3:11', '3:12'],
    viewportCenterLineId: '3:11',
    lastTappedLineId: '3:11'
  });
  const snapshot = JSON.stringify(c);
  pickAnchorLine(c);
  assert.equal(JSON.stringify(c), snapshot);
});

test('A12 같은 입력에 같은 답(결정적)', () => {
  const c = ctx({ speaking: true, currentLineId: '5:1', visibleLineIds: ['5:1'] });
  assert.equal(pickAnchorLine(c), pickAnchorLine(c));
});
