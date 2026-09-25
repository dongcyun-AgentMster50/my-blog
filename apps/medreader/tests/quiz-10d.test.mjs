/* ============================================================
   MedReader — 10d: 놓치고 있는 정답 문단 되찾기 (spec 5-3·5-4)

   ① 고아 라벨 — 번호("I-1.")와 본문("The answer is A. …")이 다른 문단으로 갈라진 정답
   ② 묶음 정답 — 한 문단이 여러 문항을 답한다("I-1 and I-2. The answers are A and C…")

   **틀린 정답을 붙이느니 unverified 로 두는 편이 낫다.** 사용자가 그걸 믿고 외운다.
   그래서 이 파일의 절반은 "짝짓지 않는다"를 확인하는 테스트다.

   픽스처 문장은 전부 **지어낸 것**이다. 원서 문장을 레포에 남기지 않는다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSections, parseSectionsWithStats } from '../js/quiz/parser.js';
import {
  isAnswerStart, isQuestionStart, isOptionStart, parseAnswerStart,
  parseAnswerLabel, parseHeadlessAnswer, parseGroupAnswer
} from '../js/text/segment.js';

/* blocks.js 의 paragraphKind 와 같은 우선순위로 kind 를 흉내낸다(4-9). */
function kindOf(t) {
  if (isAnswerStart(t)) return 'answer';
  if (isQuestionStart(t)) return 'question';
  if (isOptionStart(t)) return 'option';
  return 'body';
}

/** 항목은 문자열이거나 {t, kind} — heading 을 끼워 넣을 때 쓴다. */
function page(pageNo, items) {
  return {
    pageNo: pageNo, width: 612, height: 792,
    paragraphs: items.map(function (it, i) {
      const t = (it && typeof it === 'object') ? it.t : it;
      const k = (it && typeof it === 'object' && it.kind) ? it.kind : kindOf(t);
      return { id: pageNo + ':p' + i, text: t, kind: k };
    })
  };
}

/** 번호 n 짜리 온전한 문항 한 벌(문항 + 보기 A~D) */
function qBlock(label, stem) {
  return [
    label + ' ' + stem,
    'A. 첫째 선택지 지어낸 문장', 'B. 둘째 선택지 지어낸 문장',
    'C. 셋째 선택지 지어낸 문장', 'D. 넷째 선택지 지어낸 문장'
  ];
}

/** I-1 … I-n 문항 n 개가 든 문제 쪽 */
function questionPage(pageNo, n) {
  let out = [];
  for (let i = 1; i <= n; i++) out = out.concat(qBlock('I-' + i + '.', '지어낸 문항 ' + i + ' 의 물음이다?'));
  return page(pageNo, out);
}

function secOf(list, id) { return list.find(function (s) { return s.sectionId === id; }) || null; }
function qOf(section, n) { return section.questions.find(function (q) { return q.number === n; }) || null; }
function statuses(section, ns) {
  return ns.map(function (n) { const q = qOf(section, n); return q ? q.status : 'MISSING'; });
}
function lettersOf(section, n) {
  const q = qOf(section, n);
  return (q && q.answer) ? q.answer.letters.join('') : null;
}

const HEAD = [
  'The answer is C. 지어낸 해설 하나.',
  'The answer is A. 지어낸 해설 둘.',
  'The answer is D. 지어낸 해설 셋.',
  'The answer is B. 지어낸 해설 넷.'
];

/* ================= ① 고아 라벨 ================= */

test('D1 ★ 라벨 4개 + 번호 없는 정답 4개 → 순서대로 짝지어진다', function () {
  const r = parseSections([
    questionPage(10, 4),
    page(40, ['I-1.', 'I-2.', 'I-3.', 'I-4.'].concat(HEAD))
  ], { docId: 'd' });
  const s = secOf(r, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2, 3, 4]), ['verified', 'verified', 'verified', 'verified']);
  // 순서대로다 — 뒤섞이지 않았다
  assert.deepEqual([1, 2, 3, 4].map(function (n) { return lettersOf(s, n); }), ['C', 'A', 'D', 'B']);
  // 해설은 각자의 문단이다
  assert.match(qOf(s, 1).answer.explanation, /해설 하나/);
  assert.match(qOf(s, 4).answer.explanation, /해설 넷/);
});

test('D2 ★★ 개수가 다르면(4 대 3) 아무것도 짝짓지 않는다 — 가장 중요한 안전장치', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 4),
    page(40, ['I-1.', 'I-2.', 'I-3.', 'I-4.'].concat(HEAD.slice(0, 3)))
  ], { docId: 'd' });
  const s = secOf(r.sections, 'sec-I');
  // 넷 중 셋만 붙이면 어느 하나가 어긋난다 → 하나도 붙이지 않는다
  assert.deepEqual(statuses(s, [1, 2, 3, 4]),
    ['unverified', 'unverified', 'unverified', 'unverified']);
  assert.equal(r.diagnostics.orphanPaired, 0);
  assert.equal(r.diagnostics.orphanRejectedCount, 1);
});

test('D3 ★ 라벨 번호가 연속이 아니면(1,2,4) 짝짓지 않는다 (5-3 번호 연속성)', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 4),
    page(40, ['I-1.', 'I-2.', 'I-4.'].concat(HEAD.slice(0, 3)))
  ], { docId: 'd' });
  const s = secOf(r.sections, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2, 4]), ['unverified', 'unverified', 'unverified']);
  assert.equal(r.diagnostics.orphanPaired, 0);
  assert.equal(r.diagnostics.orphanRejectedGap, 1);
});

test('D4 ★ 사이에 heading 이 끼어도 짝지어진다 ("ANSWERS" 가 실제로 낀다)', function () {
  const r = parseSections([
    questionPage(10, 4),
    page(40, [
      'I-1.', 'I-2.',
      { t: 'ANSWERS', kind: 'heading' },      // 라벨 사이
      'I-3.', 'I-4.',
      { t: '해설', kind: 'heading' }           // 라벨과 정답 사이
    ].concat(HEAD))
  ], { docId: 'd' });
  const s = secOf(r, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2, 3, 4]), ['verified', 'verified', 'verified', 'verified']);
  assert.deepEqual([1, 2, 3, 4].map(function (n) { return lettersOf(s, n); }), ['C', 'A', 'D', 'B']);
});

test('D5 ★ 쪽을 넘어가면 짝짓지 않는다 — 근거가 약하다', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 4),
    page(40, ['I-1.', 'I-2.', 'I-3.', 'I-4.']),
    page(41, HEAD)
  ], { docId: 'd' });
  const s = secOf(r.sections, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2, 3, 4]),
    ['unverified', 'unverified', 'unverified', 'unverified']);
  assert.equal(r.diagnostics.orphanPaired, 0);
});

test('D6 라벨 사이에 본문이 끼면 한 덩어리로 보지 않는다 (실측 62쪽 그림 쪽)', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 4),
    page(40, [
      'I-1.',
      '그림 설명으로 끼어든 지어낸 본문 한 줄이다.',   // body — heading 이 아니다
      'I-2.'
    ].concat(HEAD.slice(0, 2)))
  ], { docId: 'd' });
  const s = secOf(r.sections, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2]), ['unverified', 'unverified']);
  assert.equal(r.diagnostics.orphanRejectedBroken, 1);
  assert.equal(r.diagnostics.orphanPaired, 0);
});

test('D7 라벨만 있고 번호 없는 정답이 없으면 그냥 번호 목록이다 — 아무 일도 없다', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 4),
    page(40, ['I-1.', 'I-2.', 'I-3.', '지어낸 본문 한 줄.'])
  ], { docId: 'd' });
  assert.equal(r.diagnostics.orphanPaired, 0);
  assert.equal(r.diagnostics.orphanRejectedCount, 0);
});

/* ================= ② 묶음 정답 ================= */

test('D8 ★ 묶음 정답 2문항·3문항이 펼쳐지고 해설을 공유한다', function () {
  const r = parseSections([
    questionPage(10, 5),
    page(40, [
      'I-1 and I-2. The answers are C and A, respectively. 지어낸 묶음 해설 하나다.',
      '앞 해설이 다음 문단으로 이어진 지어낸 문장이다.',
      'I-3, I-4, and I-5. The answers are D, B, and C, respectively. 지어낸 묶음 해설 둘이다.'
    ])
  ], { docId: 'd' });
  const s = secOf(r, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2, 3, 4, 5]),
    ['verified', 'verified', 'verified', 'verified', 'verified']);
  assert.deepEqual([1, 2, 3, 4, 5].map(function (n) { return lettersOf(s, n); }),
    ['C', 'A', 'D', 'B', 'C']);
  // 해설은 묶인 문항 전부가 공유한다(원문이 그렇다) — 이어진 문단까지 포함한다
  assert.equal(qOf(s, 1).answer.explanation, qOf(s, 2).answer.explanation);
  assert.match(qOf(s, 1).answer.explanation, /이어진 지어낸 문장/);
  assert.equal(qOf(s, 3).answer.explanation, qOf(s, 5).answer.explanation);
  assert.doesNotMatch(qOf(s, 3).answer.explanation, /묶음 해설 하나/);
});

test('D9 ★★ 번호 개수 ≠ 정답 글자 개수면 펼치지 않는다', function () {
  const r = parseSectionsWithStats([
    questionPage(10, 2),
    page(40, ['I-1 and I-2. The answers are B, C, and D, respectively. 지어낸 해설이다.'])
  ], { docId: 'd' });
  const s = secOf(r.sections, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2]), ['unverified', 'unverified']);
  assert.equal(r.diagnostics.groupAnswerParas, 0);
  assert.equal(parseGroupAnswer('I-1 and I-2. The answers are B, C, and D, respectively.'), null);
});

test('D10 로마숫자가 섞이면 펼치지 않는다 — 어느 섹션인지 단정할 수 없다', function () {
  assert.equal(parseGroupAnswer('I-1 and 2. The answers are A and B, respectively.'), null);
  assert.equal(parseGroupAnswer('1 and I-2. The answers are A and B.'), null);
  // 둘 다 로마숫자가 없으면 받는다(로마숫자 없는 책)
  const g = parseGroupAnswer('1 and 2. The answers are A and B.');
  assert.deepEqual(g.members, [
    { section: null, number: 1, letters: ['A'] },
    { section: null, number: 2, letters: ['B'] }
  ]);
});

test('D11 쉼표로만 이은 묶음도 펼친다 (실측 5문항짜리가 1건 있다)', function () {
  const g = parseGroupAnswer('III-64, III-65, III-66. The answers are C, B, and D, respectively. 지어낸 해설.');
  assert.deepEqual(g.members.map(function (m) { return m.number + m.letters[0]; }), ['64C', '65B', '66D']);
  // 번호가 하나뿐이면 묶음이 아니다 — 기존 정답 경로가 처리한다
  assert.equal(parseGroupAnswer('III-64. The answers are C and B.'), null);
});

/* ================= 기존 동작 불변 ================= */

test('D12 ★ ANSWER_RE 는 그대로다 — paragraphs[].kind 가 바뀌지 않는다(algoVersion 불변)', function () {
  assert.equal(isAnswerStart('I-36. The answer is C. 지어낸 해설.'), true);
  assert.deepEqual(parseAnswerStart('I-36. The answers are B and D. 지어낸 해설.'),
    { section: 'I', number: 36, letters: ['B', 'D'] });
  // 묶음·고아 형태는 여전히 answer/question/option 중 어느 것도 아니다 → kind 는 body 그대로
  const shapes = [
    'I-36 and I-37. The answers are C and B, respectively. 지어낸 해설.',
    'The answer is A. 지어낸 해설.',
    'I-1.'
  ];
  for (let i = 0; i < shapes.length; i++) {
    assert.equal(isAnswerStart(shapes[i]), false, shapes[i]);
    assert.equal(isQuestionStart(shapes[i]), false, shapes[i]);
    assert.equal(isOptionStart(shapes[i]), false, shapes[i]);
    assert.equal(kindOf(shapes[i]), 'body', shapes[i]);
  }
});

test('D13 되찾은 정답도 보기 범위 밖이면 unverified 다 (5-4)', function () {
  const r = parseSections([
    questionPage(10, 2),                       // 보기는 A~D 뿐이다
    page(40, ['I-1.', 'I-2.', 'The answer is F. 지어낸 해설.', 'The answer is A. 지어낸 해설.'])
  ], { docId: 'd' });
  const s = secOf(r, 'sec-I');
  assert.deepEqual(statuses(s, [1, 2]), ['unverified', 'verified']);   // F 는 보기에 없다
  assert.equal(lettersOf(s, 1), 'F');                                   // 붙이긴 했으나 채점하지 않는다
});

test('D14 새 헬퍼의 경계 — 라벨·번호 없는 정답', function () {
  assert.deepEqual(parseAnswerLabel('I-12.'), { section: 'I', number: 12 });
  assert.deepEqual(parseAnswerLabel('  7. '), { section: null, number: 7 });
  assert.equal(parseAnswerLabel('7. 뒤에 본문이 있다'), null);
  assert.deepEqual(parseHeadlessAnswer('The answers are A, C, and B, respectively. 해설.').letters,
    ['A', 'C', 'B']);
  assert.equal(parseHeadlessAnswer('The answer is at the bedside.'), null);
  assert.equal(parseHeadlessAnswer('I-3. The answer is A.'), null);     // 번호가 있으면 이 경로가 아니다
});
