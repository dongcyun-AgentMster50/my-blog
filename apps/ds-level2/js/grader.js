/* ============================================================
   ds-level2 — 채점 (순수 함수, DOM 모름)

   필기: type 만 본다(kind 는 통계용). short 는 normalize 후 answer/accept 와 비교.
   실습: answer.type 별 규칙(spec 6-3). 숫자는 양쪽을 decimals 자리로 반올림해 비교하고
   부동소수 오차 대비로 |a-b| < 10^-(d+3) 도 허용. 파싱 불가 입력은 오답이 아니라 'invalid'
   (시도 횟수를 올리지 않고 재입력을 요청한다).
   ============================================================ */
(function (root) {
  'use strict';
  var E = root.__DS2 || (root.__DS2 = {});

  var CIRCLED = ['①', '②', '③', '④', '⑤'];

  /** spec 3-3 정규화: trim → 소문자 → 내부 공백 제거 → 따옴표·백틱 제거 → 끝 "()" 제거 → 전각 → 반각 */
  function normalize(s) {
    s = String(s == null ? '' : s).trim().toLowerCase();
    s = s.replace(/\s+/g, '');
    s = s.replace(/['"`]/g, '');
    s = s.replace(/（/g, '(').replace(/）/g, ')').replace(/，/g, ',').replace(/．/g, '.');
    while (/\(\)$/.test(s)) s = s.slice(0, -2);
    return s;
  }

  /**
   * 필기 문제 채점. input: mcq → 보기 인덱스(number), ox → boolean, short → string
   * 반환 { correct, answerText }  answerText = 사람이 읽는 정답 표기("②", "O", "transform")
   */
  function gradeQuestion(q, input) {
    var correct = false, answerText = '';
    if (q.type === 'mcq') {
      correct = Number(input) === q.answer;
      answerText = CIRCLED[q.answer] || String(q.answer + 1);
    } else if (q.type === 'ox') {
      var v = (input === true || input === 'true' || input === 'o' || input === 'O');
      var answered = input === true || input === false || input === 'true' || input === 'false' || input === 'o' || input === 'x' || input === 'O' || input === 'X';
      correct = answered && v === q.answer;
      answerText = q.answer ? 'O' : 'X';
    } else {
      var n = normalize(input);
      var pool = [q.answer].concat(Array.isArray(q.accept) ? q.accept : []);
      correct = n.length > 0 && pool.some(function (a) { return normalize(a) === n; });
      answerText = String(q.answer);
    }
    return { correct: correct, answerText: answerText };
  }

  function roundTo(x, d) {
    var f = Math.pow(10, d);
    return Math.round(x * f) / f;
  }
  /** 쉼표·공백·% 를 제거해 숫자로. 실패하면 NaN. */
  function parseNumber(input) {
    var s = String(input == null ? '' : input).trim().replace(/[,\s%]/g, '').replace(/，/g, '');
    if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }

  /**
   * 실습 채점. answer = practice.answer, input = 사용자 문자열
   * 반환 { status: 'correct'|'wrong'|'invalid', shown, expected, message }
   *   shown    = 입력을 비교에 쓴 형태("5231.50") — 자릿수 실수를 스스로 잡게 되돌려 보여준다
   *   expected = 정답 표기(포기 시에만 UI 가 쓴다)
   */
  function gradePractice(answer, input) {
    var a = answer || {};
    if (a.type === 'number' || a.type === 'int') {
      var x = parseNumber(input);
      if (!isFinite(x)) return { status: 'invalid', message: '숫자로 읽을 수 없습니다. 예: 5231.47' };
      if (a.type === 'int') {
        var ok = x === Math.floor(x) && x === a.value;
        return { status: ok ? 'correct' : 'wrong', shown: String(x), expected: String(a.value) };
      }
      var d = typeof a.decimals === 'number' ? a.decimals : 2;
      var ra = roundTo(x, d), rb = roundTo(a.value, d);
      var okN = Math.abs(ra - rb) < Math.pow(10, -(d + 3));
      return { status: okN ? 'correct' : 'wrong', shown: ra.toFixed(d), expected: rb.toFixed(d) };
    }
    if (a.type === 'string') {
      var n = normalize(input);
      if (!n) return { status: 'invalid', message: '값을 입력하세요.' };
      var pool = [a.value].concat(Array.isArray(a.accept) ? a.accept : []);
      var okS = pool.some(function (v) { return normalize(v) === n; });
      return { status: okS ? 'correct' : 'wrong', shown: String(input).trim(), expected: String(a.value) };
    }
    return { status: 'invalid', message: '채점 규칙을 알 수 없는 과제입니다.' };
  }

  /** 정답 표기(포기 시 노출용). number 는 decimals 자리로. */
  function expectedText(answer) {
    var a = answer || {};
    if (a.type === 'number') return roundTo(a.value, typeof a.decimals === 'number' ? a.decimals : 2).toFixed(typeof a.decimals === 'number' ? a.decimals : 2);
    return String(a.value);
  }

  E.grader = { CIRCLED: CIRCLED, normalize: normalize, gradeQuestion: gradeQuestion, roundTo: roundTo,
    parseNumber: parseNumber, gradePractice: gradePractice, expectedText: expectedText };
})(typeof globalThis !== 'undefined' ? globalThis : window);
