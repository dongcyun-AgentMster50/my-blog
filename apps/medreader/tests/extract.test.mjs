/* ============================================================
   pdf/extract.js — spec 9-4 재개 모델

   브라우저 없이 도는 부분만 본다. `Extractor` 는 pdf.js·IndexedDB 에
   의존하지만 **어느 쪽을 다음에 뽑을 것인가**는 순수 함수다.
   9-4 의 핵심 주장("재개는 cursor 를 따른다. pagesDone 으로 판단하지 않는다")
   을 여기서 고정한다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeExtraction, planResume, priorityTargets, advanceCursor,
  nextPage, isComplete, addSorted, removeFrom, ALGO_VERSION, STATUS, ROLE_VERSION_BASE
} from '../js/pdf/extract.js';

/** 저장된 쪽 집합을 흉내낸다. */
const setOf = (...ns) => {
  const s = new Set(ns);
  return (n) => s.has(n);
};

test('E1 normalizeExtraction — 없는 값도 안전한 기본값', () => {
  const e = normalizeExtraction(null);
  assert.equal(e.done, false);
  assert.equal(e.pagesDone, 0);
  assert.equal(e.cursor, 1);
  assert.deepEqual(e.failed, []);
  assert.equal(e.algoVersion, 0);
  assert.equal(e.status, STATUS.IDLE);
});

test('E2 normalizeExtraction — failed 는 오름차순·중복 없음', () => {
  const e = normalizeExtraction({ failed: [9, 3, 9, 1, 3], roleDirty: [5, 5, 2] });
  assert.deepEqual(e.failed, [1, 3, 9]);
  assert.deepEqual(e.roleDirty, [2, 5]);
});

test('E3 normalizeExtraction — 망가진 cursor 를 1 미만으로 두지 않는다', () => {
  assert.equal(normalizeExtraction({ cursor: 0 }).cursor, 1);
  assert.equal(normalizeExtraction({ cursor: -5 }).cursor, 1);
  assert.equal(normalizeExtraction({ cursor: 3.7 }).cursor, 3);
  assert.equal(normalizeExtraction({ cursor: NaN }).cursor, 1);
});

test('E4 planResume — algoVersion 이 오르면 cursor ← 1, failed ← [] (9-4)', () => {
  const old = { done: true, pagesDone: 700, cursor: 730, failed: [12, 400], algoVersion: ALGO_VERSION - 1 };
  const p = planResume(old);
  assert.equal(p.reextract, true);
  assert.equal(p.cursor, 1);
  assert.deepEqual(p.failed, []);
  assert.equal(p.done, false);
  assert.equal(p.algoVersion, ALGO_VERSION);
});

test('E5 planResume — 같은 algoVersion 이면 그대로 이어간다', () => {
  const saved = { done: false, pagesDone: 312, cursor: 318, failed: [7], algoVersion: ALGO_VERSION };
  const p = planResume(saved);
  assert.equal(p.reextract, false);
  assert.equal(p.cursor, 318);
  assert.deepEqual(p.failed, [7]);
});

test('E6 priorityTargets — 0: 현재·±1, 1: ±2…±5 (9-4)', () => {
  const t = priorityTargets(10, 100);
  assert.deepEqual(t.filter((x) => x.priority === 0).map((x) => x.pageNo), [10, 11, 9]);
  assert.deepEqual(t.filter((x) => x.priority === 1).map((x) => x.pageNo), [12, 8, 13, 7, 14, 6, 15, 5]);
  assert.equal(t.length, 11);
});

test('E7 priorityTargets — 문서 경계를 넘지 않는다', () => {
  assert.deepEqual(priorityTargets(1, 3).map((x) => x.pageNo), [1, 2, 3]);
  assert.deepEqual(priorityTargets(3, 3).map((x) => x.pageNo), [3, 2, 1]);
  assert.deepEqual(priorityTargets(null, 100), []);
});

test('E8 advanceCursor — 이미 저장된 쪽을 건너뛴다', () => {
  assert.equal(advanceCursor(1, 10, setOf(1, 2, 3), []), 4);
  assert.equal(advanceCursor(1, 10, setOf(), []), 1);
  assert.equal(advanceCursor(5, 10, setOf(5, 6, 7, 8, 9, 10), []), 11);
});

test('E9 advanceCursor — 실패한 쪽도 건너뛴다 (끝에서 따로 재시도한다)', () => {
  assert.equal(advanceCursor(1, 10, setOf(1, 2), [3, 4]), 5);
  // 실패가 끝까지 이어져도 커서는 pageCount+1 에 멈춘다
  assert.equal(advanceCursor(9, 10, setOf(), [9, 10]), 11);
});

test('E10 ★ 재개는 cursor 를 따른다 — pagesDone 으로 판단하지 않는다 (9-4)', () => {
  // 사용자가 500쪽을 먼저 열어 그 주변만 채워진 상태.
  // pagesDone 은 6 이지만 500쪽 부근은 이미 끝났고, 순차 스캔은 1쪽부터다.
  const stored = setOf(499, 500, 501, 502, 503, 498);
  const st = {
    current: null, pageCount: 729, cursor: 1, failed: [],
    has: stored, inFlight: new Set(), retriedPages: new Set(), roleQueue: []
  };
  assert.deepEqual(nextPage(st), { pageNo: 1, priority: 2 });

  // 커서가 498 까지 왔다면 저장된 구간을 통째로 건너뛴다
  st.cursor = 498;
  assert.deepEqual(nextPage(st), { pageNo: 504, priority: 2 });
});

test('E11 현재 쪽이 항상 먼저다 (priority 0)', () => {
  const st = {
    current: 300, pageCount: 729, cursor: 1, failed: [],
    has: setOf(), inFlight: new Set(), retriedPages: new Set(), roleQueue: []
  };
  assert.deepEqual(nextPage(st), { pageNo: 300, priority: 0 });
  // 300 이 끝나면 301 → 299 → 302 …
  assert.deepEqual(nextPage({ ...st, has: setOf(300) }), { pageNo: 301, priority: 0 });
  assert.deepEqual(nextPage({ ...st, has: setOf(300, 301) }), { pageNo: 299, priority: 0 });
  assert.deepEqual(nextPage({ ...st, has: setOf(300, 301, 299) }), { pageNo: 302, priority: 1 });
});

test('E12 처리 중인 쪽은 두 번 뽑지 않는다', () => {
  const st = {
    current: 10, pageCount: 100, cursor: 1, failed: [],
    has: setOf(), inFlight: new Set([10, 11]), retriedPages: new Set(), roleQueue: []
  };
  assert.deepEqual(nextPage(st), { pageNo: 9, priority: 0 });
});

test('E13 순차 스캔이 끝나면 failed 를 한 번 더 돈다 (9-4)', () => {
  const stored = setOf(...Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => n !== 4 && n !== 7));
  const st = {
    current: null, pageCount: 10, cursor: 1, failed: [4, 7],
    has: stored, inFlight: new Set(), retriedPages: new Set(), roleQueue: []
  };
  assert.deepEqual(nextPage(st), { pageNo: 4, priority: 3 });

  // ★ 실패가 둘이면 **둘 다** 다시 시도해야 한다. 4 만 재시도하고 멈추면
  //   7 은 영구 구멍으로 남는다 (9-4 가 경계한 바로 그 상황).
  assert.deepEqual(nextPage({ ...st, retriedPages: new Set([4]) }), { pageNo: 7, priority: 3 });

  // 목록을 한 바퀴 다 돌았으면 더 뽑지 않는다 — 무한 재시도를 막는다
  assert.equal(nextPage({ ...st, retriedPages: new Set([4, 7]) }), null);
});

test('E14 역할 재계산은 가장 마지막이다 (4-7, 전체 재추출 금지)', () => {
  const all = setOf(...Array.from({ length: 5 }, (_, i) => i + 1));
  const st = {
    current: null, pageCount: 5, cursor: 6, failed: [],
    has: all, inFlight: new Set(), retriedPages: new Set(), roleQueue: [2, 3]
  };
  assert.deepEqual(nextPage(st), { pageNo: 2, priority: 4 });
  assert.equal(nextPage({ ...st, roleQueue: [] }), null);
});

test('E15 isComplete — failed 가 비고 cursor > pageCount (9-4)', () => {
  const all = setOf(...Array.from({ length: 5 }, (_, i) => i + 1));
  assert.equal(isComplete({ cursor: 6, pageCount: 5, has: all, failed: [] }), true);
  assert.equal(isComplete({ cursor: 6, pageCount: 5, has: all, failed: [3] }), false);
  assert.equal(isComplete({ cursor: 3, pageCount: 5, has: setOf(1, 2), failed: [] }), false);
});

test('E16 ★ 전체 흐름 시뮬레이션 — 중간에 끊고 다시 시작해도 구멍이 없다', () => {
  const PAGES = 40;
  const stored = new Set();
  const has = (n) => stored.has(n);
  let ex = normalizeExtraction({ algoVersion: ALGO_VERSION });
  let current = 20;          // 사용자가 20쪽을 열어 두었다
  const failAt = new Set([13, 27]);
  const retriedPages = new Set();
  let steps = 0;

  const runFor = (n) => {
    for (let i = 0; i < n; i++) {
      const t = nextPage({
        current, pageCount: PAGES, cursor: ex.cursor, failed: ex.failed,
        has, inFlight: new Set(), retriedPages, roleQueue: []
      });
      if (!t) return false;
      steps++;
      if (t.priority === 3) retriedPages.add(t.pageNo);
      if (failAt.has(t.pageNo)) {
        failAt.delete(t.pageNo);                 // 두 번째 시도에서는 성공한다
        ex.failed = addSorted(ex.failed, t.pageNo);
      } else {
        stored.add(t.pageNo);
        ex.pagesDone++;
        ex.failed = removeFrom(ex.failed, t.pageNo);
      }
      ex.cursor = advanceCursor(ex.cursor, PAGES, has, ex.failed);
    }
    return true;
  };

  runFor(15);                                     // 중간까지 돌리고
  const saved = JSON.parse(JSON.stringify({ ...ex, status: STATUS.PAUSED }));
  assert.ok(saved.cursor > 1, '커서가 진행했다');

  // ── 여기서 새로고침 ── 저장된 extraction 만으로 이어간다
  ex = planResume(saved);
  assert.equal(ex.reextract, false);
  current = null;
  while (runFor(200)) { /* 끝까지 */ }

  for (let p = 1; p <= PAGES; p++) assert.ok(stored.has(p), p + '쪽에 구멍이 있다');
  assert.deepEqual(ex.failed, []);
  assert.equal(ex.cursor, PAGES + 1);
  assert.equal(isComplete({ cursor: ex.cursor, pageCount: PAGES, has, failed: ex.failed }), true);
  assert.ok(steps <= PAGES + 4, '쪽마다 한 번 + 실패 재시도 2회 안쪽 (' + steps + ')');
});

test('E17 addSorted / removeFrom 은 원본을 바꾸지 않는다', () => {
  const a = [3, 1];
  const b = addSorted(a, 2);
  assert.deepEqual(a, [3, 1]);
  assert.deepEqual(b, [1, 2, 3]);
  assert.deepEqual(addSorted(b, 2), [1, 2, 3], '중복은 넣지 않는다');
  assert.deepEqual(removeFrom(b, 2), [1, 3]);
  assert.deepEqual(b, [1, 2, 3]);
});

test('E18 상수 — roleVersion 시작값과 ALGO_VERSION 은 정수다', () => {
  assert.equal(ROLE_VERSION_BASE, 1);
  assert.ok(Number.isInteger(ALGO_VERSION) && ALGO_VERSION >= 6, 'algoVersion ' + ALGO_VERSION);
});

test('E19 ★ 실패한 쪽은 우선순위 창에서도 건너뛴다 — 무한 재시도 금지', () => {
  // 현재 쪽 1, 창은 1…6. 5쪽이 계속 던진다.
  // failed 를 보지 않으면 nextPage 가 5쪽만 영원히 돌려주고 순차 스캔이 굶는다
  // (729쪽 실기기 검증에서 같은 쪽을 99번 다시 잡았다).
  const st = {
    current: 1, pageCount: 729, cursor: 1, failed: [5],
    has: setOf(1, 2, 3, 4), inFlight: new Set(), retriedPages: new Set(), roleQueue: []
  };
  const t = nextPage(st);
  assert.notEqual(t.pageNo, 5, '실패한 쪽을 우선순위 창에서 다시 잡으면 안 된다');
  assert.deepEqual(t, { pageNo: 6, priority: 1 });

  // 창을 다 채우면 순차 스캔으로 넘어가고, 5쪽은 커서도 건너뛴다
  const st2 = { ...st, has: setOf(1, 2, 3, 4, 6) };
  assert.deepEqual(nextPage(st2), { pageNo: 7, priority: 2 });

  // 그리고 5쪽은 **끝에서 한 번** 다시 시도된다
  const done = setOf(...Array.from({ length: 729 }, (_, i) => i + 1).filter((n) => n !== 5));
  const st3 = { ...st, has: done, cursor: 730 };
  assert.deepEqual(nextPage(st3), { pageNo: 5, priority: 3 });
});

/* ────────────────────────────────────────────────────────
   Review 2 회귀 — 재개 모델의 구멍 3건
   E16·E19 와 같은 종류의 결함이 세 자리 더 있었다. 브라우저에서 실측하고
   여기에 고정한다(Extractor 내부 상태가 필요한 부분은 review.md 에 기록).
   ──────────────────────────────────────────────────────── */

test('E20 ★ isComplete 는 cursor 를 믿지 않는다 — 1쪽부터 실제로 훑는다', () => {
  // cursor 가 pageCount 를 넘었지만 저장된 쪽이 하나도 없다.
  // cursor 부터 훑으면 "다 끝났다"가 되고, 5절 파서가 빈 문서 위를 돈다.
  // (실측: cursor 99999 인 20쪽 문서에서 pages 행 0개인데 done = true)
  assert.equal(isComplete({ cursor: 99999, pageCount: 20, has: setOf(), failed: [] }), false);
  // 앞쪽에 구멍 하나만 있어도 완료가 아니다
  const most = setOf(...Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => n !== 7));
  assert.equal(isComplete({ cursor: 21, pageCount: 20, has: most, failed: [] }), false);
  // 정상 완료는 그대로 true
  const all = setOf(...Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(isComplete({ cursor: 21, pageCount: 20, has: all, failed: [] }), true);
});

test('E21 ★ failed 에 "이미 저장된 쪽"이 들어가면 영원히 빠지지 않는다 — 넣지 마라', () => {
  // nextPage 의 재시도 경로는 !has(f) 로 거른다. 저장돼 있으면 재시도되지 않고,
  // 재시도되지 않으면 성공으로 지워질 기회도 없다 → done 이 끝내 서지 않는다.
  // 그래서 **넣지 않는 것**이 계약이다(Extractor._tick 이 stored 를 먼저 본다).
  const all = setOf(...Array.from({ length: 10 }, (_, i) => i + 1));
  const st = {
    current: null, pageCount: 10, cursor: 11, failed: [4],
    has: all, inFlight: new Set(), retriedPages: new Set(), roleQueue: []
  };
  assert.equal(nextPage(st), null, '저장된 쪽은 재시도 대상이 아니다');
  assert.equal(isComplete({ cursor: 11, pageCount: 10, has: all, failed: [4] }), false,
    '그런데 failed 가 비지 않아 done 도 서지 않는다 — 빠져나갈 길이 없는 상태다');
});

test('E22 실패가 셋 이상 흩어져 있어도 전부 한 번씩 재시도된다', () => {
  const stored = setOf(...Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => ![3, 14, 21, 29].includes(n)));
  const base = {
    current: null, pageCount: 30, cursor: 31, failed: [3, 14, 21, 29],
    has: stored, inFlight: new Set(), roleQueue: []
  };
  const seen = [];
  const tried = new Set();
  for (let i = 0; i < 10; i++) {
    const t = nextPage({ ...base, retriedPages: tried });
    if (!t) break;
    seen.push(t.pageNo);
    tried.add(t.pageNo);
  }
  assert.deepEqual(seen, [3, 14, 21, 29], '네 쪽 전부 한 번씩, 그 뒤로는 멈춘다');
});
