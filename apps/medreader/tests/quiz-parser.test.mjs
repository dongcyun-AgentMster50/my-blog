/* ============================================================
   MedReader — 문항 파서 단위 테스트 (spec 5-2·5-3·5-4, 9a단계)

   픽스처 문장은 전부 **지어낸 것**이다. 원서 문장을 레포에 남기지 않는다.
   파서는 순수 계층이라 브라우저 없이 전수로 덮인다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSections, parseSectionsWithStats,
  makeQuestionId, makeSectionId, isQuizWorthy
} from '../js/quiz/parser.js';
import { isAnswerStart, isQuestionStart, isOptionStart, parseAnswerStart } from '../js/text/segment.js';

/* blocks.js 의 paragraphKind 와 같은 우선순위로 kind 를 흉내낸다(4-9). */
function kindOf(t) {
  if (isAnswerStart(t)) return 'answer';
  if (isQuestionStart(t)) return 'question';
  if (isOptionStart(t)) return 'option';
  return 'body';
}

/** PageLayout 중 파서가 읽는 부분만 만든다 (pageNo, paragraphs[].{id,text,kind}) */
function page(pageNo, texts) {
  return {
    pageNo: pageNo,
    width: 612, height: 792,
    paragraphs: texts.map(function (t, i) {
      return { id: pageNo + ':p' + i, text: t, kind: kindOf(t) };
    })
  };
}

/** 번호 n 짜리 온전한 문항 한 벌(문항 + 보기 A~D) */
function qBlock(label, stem, letters) {
  const ls = letters || ['A', 'B', 'C', 'D'];
  const out = [label + ' ' + stem];
  const words = ['첫째 선택지 지어낸 문장', '둘째 선택지 지어낸 문장',
                 '셋째 선택지 지어낸 문장', '넷째 선택지 지어낸 문장', '다섯째 선택지 지어낸 문장'];
  for (let i = 0; i < ls.length; i++) out.push(ls[i] + '. ' + words[i % words.length]);
  return out;
}

function sec(list, id) { return list.find(function (s) { return s.sectionId === id; }) || null; }
function qOf(section, n) { return section.questions.find(function (q) { return q.number === n; }) || null; }

/* ------------------------------------------------------------------ */

test('P1 ★ 문항 번호 두 형태 — "I-1." 과 "12." 를 모두 받는다 (5-3)', function () {
  const a = parseSections([page(10, [].concat(
    qBlock('I-1.', 'Gorbel 증후군의 첫 치료로 옳은 것은?'),
    qBlock('I-2.', 'Marlet 수치가 올라가는 상황은?')
  ))], { docId: 'd' });
  assert.equal(a.length, 1);
  assert.equal(a[0].sectionId, 'sec-I');
  assert.deepEqual(a[0].questions.map(function (q) { return q.number; }), [1, 2]);

  const b = parseSections([page(10, [].concat(
    qBlock('11.', 'Gorbel 증후군의 첫 치료로 옳은 것은?'),
    qBlock('12.', 'Marlet 수치가 올라가는 상황은?')
  ))], { docId: 'd' });
  assert.equal(b.length, 1);
  assert.equal(b[0].sectionId, 'sec-p10');            // 로마숫자가 없으면 쪽 폴백 (5-2)
  assert.deepEqual(b[0].questions.map(function (q) { return q.number; }), [11, 12]);
});

test('P2 ★ 번호 연속성 — 7 다음 12 는 보류되고, 뒤에서 8 이 나오면 12 가 버려진다 (5-3)', function () {
  const texts = [].concat(
    qBlock('I-7.', 'Trevin 반사가 사라지는 부위는?'),
    qBlock('I-12.', '해설 본문 안에 섞인 가짜 번호 목록이다'),   // 오탐 — 보기까지 갖춘 최악의 경우
    qBlock('I-8.', 'Quilon 수치가 정상인 조건은?')
  );
  const out = parseSectionsWithStats([page(20, texts)], { docId: 'd' });
  const s = out.sections[0];
  assert.deepEqual(s.questions.map(function (q) { return q.number; }), [7, 8]);
  assert.equal(out.diagnostics.rejectedContinuity, 1);
});

test('P2b 8 이 끝내 나오지 않으면 12 는 진짜 건너뜀으로 받아들인다 (건너뜀 실측 있음)', function () {
  const texts = [].concat(
    qBlock('I-7.', 'Trevin 반사가 사라지는 부위는?'),
    qBlock('I-12.', 'Quilon 수치가 정상인 조건은?')
  );
  const out = parseSectionsWithStats([page(20, texts)], { docId: 'd' });
  assert.deepEqual(out.sections[0].questions.map(function (q) { return q.number; }), [7, 12]);
  assert.equal(out.diagnostics.rejectedContinuity, 0);
});

test('P3 ★ 보기가 없는 문항 후보는 취소된다 — 실측 251건이 여기로 걸린다 (5-3)', function () {
  const texts = [
    'I-1. 이것은 해설 본문 안의 번호 목록 첫 항목이다.',
    '이어지는 평범한 본문 문단이다.',
    'I-2. 이것은 해설 본문 안의 번호 목록 둘째 항목이다.',
    '또 이어지는 평범한 본문 문단이다.'
  ];
  const out = parseSectionsWithStats([page(57, texts)], { docId: 'd' });
  assert.deepEqual(out.sections, []);
  assert.equal(out.diagnostics.questionCandidates, 2);
  assert.equal(out.diagnostics.rejectedNoOptions, 2);
  assert.equal(out.diagnostics.acceptedQuestions, 0);
});

test('P3b 보기가 하나(A)뿐이면 최소 2개 규칙에 걸려 취소된다 (5-3)', function () {
  const out = parseSectionsWithStats([page(57, [
    'I-1. 보기가 하나뿐인 가짜 문항이다.',
    'A. 유일한 선택지 지어낸 문장'
  ])], { docId: 'd' });
  assert.deepEqual(out.sections, []);
  assert.equal(out.diagnostics.rejectedNoOptions, 1);
});

test('P4 ★ 보기 글자는 A·B·C… 연속이어야 한다 — 건너뛰면 거기서 끊는다 (5-3)', function () {
  // A, B, D → A·B 만 문항에 붙고 D 는 버려진다
  const skip = parseSections([page(30, qBlock('I-1.', 'Nabel 검사 결과 해석은?', ['A', 'B', 'D']))], { docId: 'd' });
  assert.equal(skip[0].questions.length, 1);
  assert.deepEqual(skip[0].questions[0].options.map(function (o) { return o.letter; }), ['A', 'B']);

  // A, C → 보기 1개로 줄어 문항 자체가 취소된다
  const gap = parseSections([page(30, qBlock('I-1.', 'Nabel 검사 결과 해석은?', ['A', 'C']))], { docId: 'd' });
  assert.deepEqual(gap, []);

  // B 부터 시작하면 A 가 없으므로 보기 구간이 아예 열리지 않는다
  const noA = parseSections([page(30, qBlock('I-1.', 'Nabel 검사 결과 해석은?', ['B', 'C', 'D']))], { docId: 'd' });
  assert.deepEqual(noA, []);
});

test('P5 ★ 정답 단수 "The answer is B." 와 복수 "The answers are B and D." (5-3)', function () {
  const qs = page(40, [].concat(
    qBlock('I-1.', 'Gorbel 증후군의 첫 치료로 옳은 것은?'),
    qBlock('I-2.', 'Marlet 수치가 올라가는 상황은?')
  ));
  const ans = page(41, [
    'I-1. The answer is B. (Chap. 3) 지어낸 해설 첫 문단이다.',
    '지어낸 해설 둘째 문단이다.',
    'I-2. The answers are B and D. (Chap. 4) 복수 정답 해설이다.'
  ]);
  const s = parseSections([qs, ans], { docId: 'd' })[0];
  assert.deepEqual(qOf(s, 1).answer.letters, ['B']);
  assert.equal(qOf(s, 1).status, 'verified');
  assert.deepEqual(qOf(s, 2).answer.letters, ['B', 'D']);
  assert.equal(qOf(s, 2).status, 'verified');
  // 해설은 다음 정답 문단 직전까지 (5-3)
  assert.equal(qOf(s, 1).answer.explanationParaIds.length, 2);
  assert.equal(qOf(s, 2).answer.explanationParaIds.length, 1);
  assert.equal(s.stats.answered, 2);
  assert.equal(s.stats.unverified, 0);
});

test('P6 ★ 정답 글자가 보기 범위 밖이면 unverified (5-4)', function () {
  const qs = page(40, qBlock('I-1.', 'Gorbel 증후군의 첫 치료로 옳은 것은?', ['A', 'B', 'C', 'D']));
  const ans = page(41, ['I-1. The answer is E. (Chap. 3) 보기에 없는 글자를 가리키는 해설이다.']);
  const s = parseSections([qs, ans], { docId: 'd' })[0];
  assert.deepEqual(qOf(s, 1).answer.letters, ['E']);
  assert.equal(qOf(s, 1).status, 'unverified');
  assert.equal(s.stats.answered, 1);
  assert.equal(s.stats.unverified, 1);
});

test('P6b ★ "The answer is F." 는 정답 문단으로 **인식되고**, 보기 범위 밖이라 unverified', function () {
  // `[수정 2026-09-24]` 이 테스트는 원래 옛 동작(F 가 정답 정규식에 걸리지도
  // 않는 것)을 고정하고 있었다. spec 5-4 는 F 를 콕 집어 "보기 범위 밖 →
  // unverified" 의 예로 드는데, 그러려면 **먼저 정답으로 파싱돼야** 한다.
  // 인식조차 안 되면 그 문단은 question 후보로 새고 해설이 앞 문항에 흡수된다.
  // `[실측]` 729쪽에 실제로 3건 있었다. segment 의 ANSWER_RE 를 [A-J] 로 넓혔다.
  const qs = page(40, qBlock('I-1.', 'Gorbel 증후군의 첫 치료로 옳은 것은?'));
  const ans = page(41, ['I-1. The answer is F. (Chap. 3) A~E 밖 글자를 쓴 해설이다.']);
  const s = parseSections([qs, ans], { docId: 'd' })[0];

  const q = qOf(s, 1);
  assert.notEqual(q.answer, null, 'F 가 정답 문단으로 인식돼야 한다 — 인식조차 못 하면 해설이 샌다');
  assert.deepEqual(q.answer.letters, ['F']);
  assert.equal(q.status, 'unverified', '보기(A~E) 범위 밖이므로 채점하지 않는다');
  assert.ok(q.answer.explanation, '해설은 이 문항에 붙어 있어야 한다 — 앞 문항으로 새면 안 된다');
});

test('P6c segment: 정답 글자 인식은 [A-J], 그 밖은 정답이 아니다', function () {
  assert.equal(isAnswerStart('I-1. The answer is F.'), true);
  assert.equal(isAnswerStart('I-1. The answer is J.'), true);
  assert.equal(isAnswerStart('I-1. The answer is Z.'), false, 'Z 까지 받으면 산문을 정답으로 오인한다');
  assert.deepEqual(parseAnswerStart('I-1. The answers are A and F.').letters, ['A', 'F']);
});

test('P7 ★ 중복 문항 번호는 조용히 덮어쓰지 않고 둘 다 unverified (5-4, 실측 27건)', function () {
  const qs = page(40, [].concat(
    qBlock('I-1.', '먼저 나온 1번 문항이다.'),
    qBlock('I-2.', '사이에 낀 2번 문항이다.'),
    qBlock('I-1.', '나중에 또 나온 1번 문항이다.')
  ));
  const ans = page(41, [
    'I-1. The answer is A. (Chap. 3) 1번 해설이다.',
    'I-2. The answer is C. (Chap. 4) 2번 해설이다.'
  ]);
  const s = parseSections([qs, ans], { docId: 'd' })[0];
  const ones = s.questions.filter(function (q) { return q.number === 1; });
  assert.equal(ones.length, 2, '둘 다 남아 있어야 한다 — 덮어쓰지 않는다');
  assert.equal(ones[0].status, 'unverified');
  assert.equal(ones[1].status, 'unverified');
  assert.notEqual(ones[0].stem, ones[1].stem);
  assert.equal(qOf(s, 2).status, 'verified');
  assert.equal(s.stats.duplicates, 2);
});

test('P7b 중복 정답 번호도 덮어쓰지 않는다 — 해당 문항은 unverified (5-4)', function () {
  const qs = page(40, qBlock('I-1.', '한 문항에 해설이 두 벌 달린 경우다.'));
  const ans = page(41, [
    'I-1. The answer is A. (Chap. 3) 먼저 나온 해설이다.',
    'I-1. The answer is C. (Chap. 9) 나중에 또 나온 해설이다.'
  ]);
  const out = parseSectionsWithStats([qs, ans], { docId: 'd' });
  const s = out.sections[0];
  assert.deepEqual(qOf(s, 1).answer.letters, ['A'], '먼저 나온 것이 남는다');
  assert.equal(qOf(s, 1).status, 'unverified');
  assert.equal(out.diagnostics.duplicateAnswerNumbers, 1);
});

test('P8 ★ 해설이 아직 없으면 unverified, 뒤에 해설을 붙여 재파싱하면 verified 로 승격 (5-4)', function () {
  const qs = page(40, [].concat(
    qBlock('I-1.', 'Gorbel 증후군의 첫 치료로 옳은 것은?'),
    qBlock('I-2.', 'Marlet 수치가 올라가는 상황은?')
  ));
  const before = parseSections([qs], { docId: 'd' })[0];
  assert.equal(before.stats.questions, 2);
  assert.equal(before.stats.answered, 0);
  assert.equal(before.stats.unverified, 2);
  assert.equal(before.questions[0].status, 'unverified');
  assert.equal(isQuizWorthy(before), false);

  const ans = page(120, [
    'I-1. The answer is B. (Chap. 3) 나중에 추출된 해설이다.',
    'I-2. The answer is D. (Chap. 4) 나중에 추출된 또 다른 해설이다.'
  ]);
  const after = parseSections([qs, ans], { docId: 'd' })[0];
  assert.equal(after.stats.answered, 2);
  assert.equal(after.stats.unverified, 0);
  assert.equal(after.questions[0].status, 'verified');
  // 승격돼도 문항 id 는 그대로다 (5-4 — attempts 가 이 id 를 참조한다)
  assert.deepEqual(after.questions.map(function (q) { return q.id; }),
                   before.questions.map(function (q) { return q.id; }));
});

test('P9 ★ 로마숫자가 바뀌면 새 섹션 (5-3)', function () {
  const p = page(50, [].concat(
    qBlock('I-1.', '첫 섹션의 1번이다.'),
    qBlock('I-2.', '첫 섹션의 2번이다.'),
    qBlock('II-1.', '둘째 섹션의 1번이다.')
  ));
  const out = parseSections([p], { docId: 'd' });
  assert.deepEqual(out.map(function (s) { return s.sectionId; }), ['sec-I', 'sec-II']);
  assert.equal(sec(out, 'sec-I').questions.length, 2);
  assert.equal(sec(out, 'sec-II').questions.length, 1);
});

test('P9b ★ 로마숫자가 없을 때 번호가 1로 되돌아가면 새 섹션 (5-3, 실측 57쪽/61쪽 표본)', function () {
  const out = parseSections([
    page(57, [].concat(qBlock('1.', '57쪽 첫 항목이다.'), qBlock('2.', '57쪽 둘째 항목이다.'))),
    page(61, [].concat(qBlock('1.', '61쪽 첫 항목이다.'), qBlock('2.', '61쪽 둘째 항목이다.')))
  ], { docId: 'd' });
  assert.deepEqual(out.map(function (s) { return s.sectionId; }), ['sec-p57', 'sec-p61']);
  assert.equal(out[0].questions.length, 2);
  assert.equal(out[1].questions.length, 2);
});

test('P9c 로마숫자 섹션은 문항 쪽과 해설 쪽이 멀어도 한 섹션이다 (5-2 수정 근거)', function () {
  const out = parseSections([
    page(258, qBlock('III-42.', '문항은 258쪽에 있다.')),
    page(462, ['III-42. The answer is C. (Chap. 11) 해설은 462쪽에 있다.'])
  ], { docId: 'd' });
  assert.equal(out.length, 1);
  assert.equal(out[0].sectionId, 'sec-III');
  assert.equal(out[0].questions[0].status, 'verified');
});

test('P10 ★ sectionId 와 문항 id 가 결정적이다 — 같은 입력에 같은 id (5-4)', function () {
  const pages = [
    page(50, [].concat(qBlock('I-1.', '첫 문항이다.'), qBlock('I-2.', '둘째 문항이다.'))),
    page(51, ['I-1. The answer is A. (Chap. 1) 해설이다.'])
  ];
  const a = parseSections(pages, { docId: 'doc-7' });
  const b = parseSections(pages, { docId: 'doc-7' });
  const ids = function (r) { return r.map(function (s) { return s.questions.map(function (q) { return q.id; }); }); };
  assert.deepEqual(ids(a), ids(b));
  assert.deepEqual(ids(a), [['doc-7:sec-I:q1', 'doc-7:sec-I:q2']]);
  assert.equal(makeQuestionId('doc-7', 'sec-I', 1), 'doc-7:sec-I:q1');
  assert.equal(makeSectionId('III', 99), 'sec-III');
  assert.equal(makeSectionId(null, 99), 'sec-p99');
  // docId 만 달라도 섹션 id 는 그대로, 문항 id 만 갈린다
  const c = parseSections(pages, { docId: 'doc-8' });
  assert.equal(c[0].sectionId, 'sec-I');
  assert.equal(c[0].questions[0].id, 'doc-8:sec-I:q1');
});

test('P11 ★ 그림 참조 감지 hasFigure — stem 과 보기 양쪽을 본다 (5-3)', function () {
  const out = parseSections([page(60, [].concat(
    qBlock('I-1.', 'The radiograph shown below is most consistent with which finding?'),
    qBlock('I-2.', '그림을 전혀 언급하지 않는 문항이다.'),
    ['I-3. 보기 쪽에 그림 참조가 있는 문항이다.',
     'A. The ECG pattern described earlier',
     'B. 평범한 선택지 지어낸 문장']
  ))], { docId: 'd' });
  const s = out[0];
  assert.equal(qOf(s, 1).hasFigure, true);
  assert.equal(qOf(s, 2).hasFigure, false);
  assert.equal(qOf(s, 3).hasFigure, true);
});

test('P12 ★ 문단이 페이지에 걸쳐 있어도 stem·보기·해설이 이어진다 (5-2·5-3)', function () {
  const p1 = page(70, [
    'Choose the one best response to each question.',
    'I-5. 이 문항의 앞부분은 70쪽에서 시작한다.',
    '문항 본문의 뒷부분이 같은 쪽 아래에 이어진다.'
  ]);
  const p2 = page(71, [
    'A. 첫 선택지 지어낸 문장',
    'B. 둘째 선택지의 앞부분이다',
    '둘째 선택지의 뒷부분이 다음 문단으로 넘어왔다',
    'C. 셋째 선택지 지어낸 문장',
    'D. 넷째 선택지 지어낸 문장'
  ]);
  const p3 = page(140, [
    'I-5. The answer is C. (Chap. 8) 해설의 앞부분이다.',
    '해설의 뒷부분이 다음 문단으로 이어진다.'
  ]);
  const s = parseSections([p1, p2, p3], { docId: 'd' })[0];
  const q = qOf(s, 5);
  assert.equal(q.pageNo, 70);
  assert.equal(q.stemParaIds.length, 2);
  assert.match(q.stem, /앞부분은 70쪽에서 시작한다\. 문항 본문의 뒷부분/);
  assert.deepEqual(q.options.map(function (o) { return o.letter; }), ['A', 'B', 'C', 'D']);
  assert.match(q.options[1].text, /앞부분이다 둘째 선택지의 뒷부분/);
  assert.equal(q.status, 'verified');
  assert.equal(q.answer.explanationParaIds.length, 2);
  assert.match(q.answer.explanation, /해설의 뒷부분/);
});

test('P13 ★ 파서가 던져도 호출자에게 예외가 새지 않는다 — stats.error 로만 남는다 (5-4)', function () {
  const p = page(80, qBlock('I-1.', '정상적인 문항이다.'));
  p.paragraphs.push({
    id: '80:p99', kind: 'body',
    get text() { throw new Error('문단 읽기 실패'); }
  });
  let out = null;
  assert.doesNotThrow(function () { out = parseSections([p], { docId: 'd' }); });
  assert.equal(out.length, 1);
  assert.equal(out[0].questions.length, 1, '나머지 문단은 그대로 파싱된다');
  assert.match(out[0].stats.error, /문단 읽기 실패/);
});

test('P13b 쓰레기 입력에도 던지지 않는다', function () {
  assert.doesNotThrow(function () {
    assert.deepEqual(parseSections(null), []);
    assert.deepEqual(parseSections(undefined, {}), []);
    assert.deepEqual(parseSections([]), []);
    assert.deepEqual(parseSections([null, {}, { pageNo: 3 }, { pageNo: 4, paragraphs: 'x' }]), []);
    assert.deepEqual(parseSections([{ pageNo: 1, paragraphs: [null, {}, { text: 5 }] }]), []);
  });
});

test('P14 섹션 제목은 앞선 SECTION 헤더에서 가져온다 (5-2)', function () {
  const out = parseSections([page(90, [].concat(
    ['SECTION I 지어낸 섹션 제목', 'Choose the one best response to each question.'],
    qBlock('I-1.', '첫 문항이다.')
  ))], { docId: 'd' });
  assert.equal(out[0].title, 'SECTION I 지어낸 섹션 제목');
});

test('P15 퀴즈 제안 임계 — verified/questions ≥ 0.6 이고 questions ≥ 5 (5-4)', function () {
  assert.equal(isQuizWorthy({ stats: { questions: 10, unverified: 3 } }), true);   // 0.7
  assert.equal(isQuizWorthy({ stats: { questions: 10, unverified: 5 } }), false);  // 0.5
  assert.equal(isQuizWorthy({ stats: { questions: 4, unverified: 0 } }), false);   // 문항 수 미달
  assert.equal(isQuizWorthy(null), false);
});
