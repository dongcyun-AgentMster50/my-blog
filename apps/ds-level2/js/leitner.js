/* ============================================================
   ds-level2 — 라이트너(Leitner) 4상자 + 노드 상태 계산 (순수 함수, DOM 모름)

   상자 0 = 미시도, 1·2·3 = 1일·3일·7일 뒤 복습, 4 = 졸업(복습 큐 제외, 모의고사엔 포함).
   정답 → min(box+1, 4), 오답 → 1. 처음 맞히면 2에서 시작(아는 것을 내일 또 묻지 않는다),
   처음 틀리면 1. 노드 상태는 저장하지 않고 진도에서 매번 계산한다 — 규칙이 바뀌어도
   저장된 값과 어긋나지 않게 하기 위해서다(spec 5-1).
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  var INTERVAL = { 1: 1, 2: 3, 3: 7 }; // 상자 → 일
  var DONE_RATE = 0.8;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /** 로컬 자정 기준 YYYY-MM-DD. due 는 "그날이 되면" 복습이므로 UTC 가 아니라 사용자 날짜를 쓴다. */
  function dayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addDays(dayString, n) {
    var p = dayString.split('-').map(Number);
    return dayStr(new Date(p[0], p[1] - 1, p[2] + n));
  }

  function nextBox(prevBox, correct) {
    prevBox = prevBox || 0;
    if (prevBox === 0) return correct ? 2 : 1;
    return correct ? Math.min(prevBox + 1, 4) : 1;
  }
  function dueFor(box, dayString) {
    return INTERVAL[box] ? addDays(dayString, INTERVAL[box]) : null;
  }

  /** 문제 기록 하나를 갱신한 새 객체를 돌려준다(입력은 바꾸지 않는다). */
  function applyResult(rec, correct, now) {
    now = now || new Date();
    rec = rec || {};
    var box = nextBox(rec.box, correct);
    return {
      box: box,
      due: dueFor(box, dayStr(now)),
      last: !!correct,
      correct: (rec.correct || 0) + (correct ? 1 : 0),
      wrong: (rec.wrong || 0) + (correct ? 0 : 1),
      at: now.toISOString()
    };
  }

  function isDue(rec, today) {
    if (!rec || !rec.due) return false;
    if (!(rec.box >= 1 && rec.box <= 3)) return false;
    return rec.due <= (today || dayStr());
  }

  /** 오늘 복습 대상 문제 id. due 오래된 것부터. */
  function dueIds(quizProgress, today) {
    today = today || dayStr();
    var q = quizProgress || {};
    return Object.keys(q)
      .filter(function (id) { return isDue(q[id], today); })
      .sort(function (a, b) {
        var x = q[a].due, y = q[b].due;
        return x < y ? -1 : x > y ? 1 : (a < b ? -1 : 1);
      });
  }

  /** 마지막 시도가 오답인 문제 id (오답 노트). 틀린 횟수 많은 순. */
  function wrongIds(quizProgress) {
    var q = quizProgress || {};
    return Object.keys(q).filter(function (id) { return q[id].last === false; })
      .sort(function (a, b) { return (q[b].wrong || 0) - (q[a].wrong || 0) || (a < b ? -1 : 1); });
  }

  /**
   * 노드 상태. questions = DS2.questionsOf(node.id), practices = DS2.practicesOf(node.id)
   * - empty    : 콘텐츠가 아직 없음 ("준비 중")
   * - none     : 카드 열람 없음 AND 시도 0
   * - learning : 활동은 있으나 완료 조건 미충족
   * - done     : (check 노드는 카드 조건 제외) 카드 열람 AND 전 문제 1회 이상 시도 AND 최근 시도 정답률 ≥ 80%
   */
  function nodeStatus(node, questions, practices, progress, hasCard) {
    var quiz = (progress && progress.quiz) || {};
    var total = questions.length;
    var attempted = 0, lastCorrect = 0;
    questions.forEach(function (q) {
      var r = quiz[q.id];
      if (r) { attempted++; if (r.last) lastCorrect++; }
    });
    var cardRead = !!(progress && progress.cards && progress.cards[node.id]);
    var needCard = node.type !== 'check';
    var solved = 0;
    practices.forEach(function (p) {
      var r = progress && progress.practice && progress.practice[p.id];
      if (r && r.solved) solved++;
    });
    var status;
    if (!total && !practices.length && !hasCard) status = 'empty';
    else if (!cardRead && attempted === 0) status = 'none';
    else if ((!needCard || cardRead) && total > 0 && attempted === total && lastCorrect / total >= DONE_RATE) status = 'done';
    else status = 'learning';
    return {
      status: status, attempted: attempted, total: total, lastCorrect: lastCorrect,
      rate: attempted ? lastCorrect / attempted : 0, cardRead: cardRead, needCard: needCard,
      practiceSolved: solved, practiceTotal: practices.length
    };
  }

  /** 챕터·파트의 자식 완료 비율. statuses = 학습 노드 id → nodeStatus 결과 */
  function groupStatus(nodeIds, statuses) {
    var done = 0, total = 0, active = false;
    nodeIds.forEach(function (id) {
      var s = statuses[id];
      if (!s || s.status === 'empty') return;
      total++;
      if (s.status === 'done') done++;
      if (s.status === 'learning') active = true;
    });
    return { done: done, total: total, active: active };
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /** 세션 출제 순서: 미시도 → 오답 → 나머지. 그룹 안에서만 셔플(순서 암기 방지). */
  function orderForSession(questions, quizProgress, rng) {
    var untried = [], wrong = [], rest = [];
    questions.forEach(function (q) {
      var r = quizProgress && quizProgress[q.id];
      if (!r) untried.push(q);
      else if (r.last === false) wrong.push(q);
      else rest.push(q);
    });
    return shuffle(untried, rng).concat(shuffle(wrong, rng), shuffle(rest, rng));
  }

  E.leitner = {
    INTERVAL: INTERVAL, DONE_RATE: DONE_RATE,
    dayStr: dayStr, addDays: addDays, nextBox: nextBox, dueFor: dueFor,
    applyResult: applyResult, isDue: isDue, dueIds: dueIds, wrongIds: wrongIds,
    nodeStatus: nodeStatus, groupStatus: groupStatus, orderForSession: orderForSession, shuffle: shuffle
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
