/* ============================================================
   ds-level2 — 모의고사 출제·집계 (순수 함수, DOM 모름)

   buildExam(scope, n, seed): 범위 안 학습 노드를 돌며(라운드 로빈) 노드마다 1문제씩
   무작위로 뽑는다 — 특정 노드 편중을 막는다. 시드 기반 PRNG(mulberry32)라 같은 seed 면
   같은 문제가 나와 "같은 문제로 다시" 가 가능하다. 상자 4(졸업) 문제도 포함한다.
   채점은 제출 시 한 번에(진행 중 즉시 채점 없음). 집계는 노드별 [정답, 출제].
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  /** 결정적 PRNG. Math.random 은 시드를 못 받는다. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function newSeed() { return Math.floor(Math.random() * 2147483647); }

  /** scope(part/chapter/topic id 배열, 비면 전체) → 학습 노드 id 목록(중복 제거, 색인 순) */
  function nodesInScope(scope, curriculum) {
    var ids = (!scope || !scope.length) ? curriculum.roots : scope;
    var set = {};
    ids.forEach(function (id) { curriculum.descendants(id).forEach(function (n) { set[n] = 1; }); });
    return curriculum.learnable.filter(function (id) { return set[id]; });
  }

  /**
   * 반환 { id, at, scope, n, seed, questionIds }
   * questionsOf(nodeId) 는 레지스트리 함수(테스트에서 주입 가능).
   */
  function buildExam(scope, n, seed, curriculum, questionsOf) {
    seed = typeof seed === 'number' ? seed : newSeed();
    var rng = mulberry32(seed);
    var nodes = nodesInScope(scope, curriculum).filter(function (id) { return questionsOf(id).length > 0; });
    var pools = {};
    nodes.forEach(function (id) { pools[id] = E.leitner.shuffle(questionsOf(id).map(function (q) { return q.id; }), rng); });
    var order = E.leitner.shuffle(nodes, rng);
    var out = [];
    var exhausted = 0;
    while (out.length < n && order.length && exhausted < order.length) {
      exhausted = 0;
      for (var i = 0; i < order.length && out.length < n; i++) {
        var pool = pools[order[i]];
        if (pool.length) out.push(pool.shift());
        else exhausted++;
      }
    }
    return {
      id: 'x' + Date.now().toString(36) + seed.toString(36).slice(-3),
      at: new Date().toISOString(),
      scope: scope && scope.length ? scope.slice() : [],
      n: out.length, requested: n, seed: seed,
      questionIds: out
    };
  }

  /**
   * answers: { qid: 사용자 답(mcq index | boolean | string) }.
   * 반환 { score, total, byNode:{node:[정답, 출제]}, items:[{qid, given, correct, answerText}] }
   */
  function grade(exam, answers, questionById) {
    var byNode = {}, items = [], score = 0;
    exam.questionIds.forEach(function (qid) {
      var q = questionById(qid);
      if (!q) return;
      var given = answers ? answers[qid] : undefined;
      var r = (given === undefined || given === null || given === '') ? { correct: false, answerText: E.grader.gradeQuestion(q, null).answerText } : E.grader.gradeQuestion(q, given);
      if (r.correct) score++;
      var b = byNode[q.node] || (byNode[q.node] = [0, 0]);
      b[1]++; if (r.correct) b[0]++;
      items.push({ qid: qid, node: q.node, given: given, correct: r.correct, answerText: r.answerText, answered: given !== undefined && given !== null && given !== '' });
    });
    return { score: score, total: items.length, byNode: byNode, items: items };
  }

  /** 노드별 정답률을 약한 순으로. [{node, correct, total, rate}] */
  function weakestNodes(byNode) {
    return Object.keys(byNode).map(function (id) {
      var b = byNode[id];
      return { node: id, correct: b[0], total: b[1], rate: b[1] ? b[0] / b[1] : 0 };
    }).sort(function (a, b) { return a.rate - b.rate || b.total - a.total || (a.node < b.node ? -1 : 1); });
  }

  /** 텍스트 스파크라인 ▁▂▃▄▅▆▇█. 값은 0~1 비율. */
  function sparkline(rates) {
    var bars = '▁▂▃▄▅▆▇█';
    return rates.map(function (r) {
      var i = Math.max(0, Math.min(7, Math.round(r * 7)));
      return bars[i];
    }).join('');
  }

  /** 제한 시간 = 문제당 60초. 남은 초(0 이하면 종료). */
  function secondsPerQuestion() { return 60; }
  function remaining(startedAt, limitSec, now) {
    now = now || Date.now();
    return Math.max(0, Math.ceil((startedAt + limitSec * 1000 - now) / 1000));
  }
  function fmtClock(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  E.exam = { mulberry32: mulberry32, newSeed: newSeed, nodesInScope: nodesInScope, buildExam: buildExam,
    grade: grade, weakestNodes: weakestNodes, sparkline: sparkline, secondsPerQuestion: secondsPerQuestion,
    remaining: remaining, fmtClock: fmtClock };
})(typeof globalThis !== 'undefined' ? globalThis : window);
