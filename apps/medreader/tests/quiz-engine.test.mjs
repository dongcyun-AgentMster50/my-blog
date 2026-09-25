/* ============================================================
   tests/quiz-engine.test.mjs — spec 5-4 · 5-5 · 9-2 (9b단계)

   `quiz/engine.js` 는 `db` 도 `document` 도 import 하지 않는다 —
   둘 다 `io` 로 주입받는다. 그래서 여기서 **브라우저 없이** 전부 덮인다.

   픽스처 문장은 전부 **지어낸 것**이다. 원서 문장을 레포에 남기지 않는다.

   ★ `planQuizOrder` 의 테스트는 여기 없다 — 사람이 채운 뒤에 붙는다.
     아래 O-계열은 **호출부의 불변식**(부분집합·빈 값에도 안 깨진다)만 본다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSectionIndex, createSession, gradeQuestion, isGradable,
  isSectionQuizWorthy, isIndexEntryQuizWorthy, toQuestionRecord,
  sectionIndexEntry, sectionPageSpan, pageWindows, padSpan, projectPage,
  fallbackOrder, resolveOrder, wrongIdsOf, latestAttempt
} from '../js/quiz/engine.js';
import { isAnswerStart, isQuestionStart, isOptionStart } from '../js/text/segment.js';

/* ── 픽스처 ─────────────────────────────────────────────── */

/* blocks.js 의 paragraphKind 와 같은 우선순위(4-9). */
function kindOf(t) {
  if (isAnswerStart(t)) return 'answer';
  if (isQuestionStart(t)) return 'question';
  if (isOptionStart(t)) return 'option';
  return 'body';
}

function page(pageNo, texts) {
  return {
    pageNo: pageNo,
    width: 612, height: 792,
    paragraphs: texts.map(function (t, i) {
      return { id: pageNo + ':p' + i, text: t, kind: kindOf(t), bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } };
    })
  };
}

/** 문항 한 벌(문항 + 보기 A~D). 전부 지어낸 문장이다. */
function qBlock(label, stem) {
  return [
    label + ' ' + stem,
    'A. 첫째 선택지 지어낸 문장',
    'B. 둘째 선택지 지어낸 문장',
    'C. 셋째 선택지 지어낸 문장',
    'D. 넷째 선택지 지어낸 문장'
  ];
}

function questionsPage(pageNo, roman, from, count) {
  let texts = [];
  for (let n = from; n < from + count; n++) {
    texts = texts.concat(qBlock(roman + '-' + n + '.', 'Gorbel 지표가 오르는 상황은? (' + n + ')'));
  }
  return page(pageNo, texts);
}

function answersPage(pageNo, roman, from, count, letter) {
  const texts = [];
  for (let n = from; n < from + count; n++) {
    texts.push(roman + '-' + n + '. The answer is ' + (letter || 'B') + '. 지어낸 해설 본문입니다.');
  }
  return page(pageNo, texts);
}

/** engine 이 요구하는 io — 메모리 위의 가짜 스토어. */
function makeIo(pages) {
  const store = new Map();
  const io = {
    index: null,
    store: store,
    pageReads: 0,
    maxBatch: 0,
    eachPage: function (from, to, cb) {
      let n = 0;
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (p.pageNo < from || p.pageNo > to) continue;
        n++;
        io.pageReads++;
        cb(p);
      }
      if (n > io.maxBatch) io.maxBatch = n;
      return Promise.resolve(n);
    },
    putQuestions: function (records) {
      for (let i = 0; i < records.length; i++) store.set(records[i].id, records[i]);
      return Promise.resolve(records.length);
    },
    saveIndex: function (entries) { io.index = entries; return Promise.resolve(); },
    now: function () { return 1700000000000; }
  };
  return io;
}

function q(over) {
  return Object.assign({
    id: 'd:sec-I:q1', docId: 'd', sectionId: 'sec-I', source: 'book',
    status: 'verified', number: 1, stem: '지어낸 문항입니다.',
    options: [{ letter: 'A', text: '가' }, { letter: 'B', text: '나' },
              { letter: 'C', text: '다' }, { letter: 'D', text: '라' }],
    answer: { letters: ['B'] }, explanation: { en: '지어낸 해설' },
    pageNo: 10, paraIds: ['10:p0'], hasFigure: false, createdAt: 0
  }, over || {});
}

/* ══════════════════════════════════════════════════════════
   1. 채점 (5-4 · 5-5)
   ══════════════════════════════════════════════════════════ */

test('E1 ★ 채점 — 정답/오답 (5-5 "보기 탭 → 즉시 채점")', function () {
  const item = q();
  const ok = gradeQuestion(item, 'B');
  assert.equal(ok.gradable, true);
  assert.equal(ok.correct, true);
  assert.deepEqual(ok.expected, ['B']);

  const bad = gradeQuestion(item, 'C');
  assert.equal(bad.gradable, true);
  assert.equal(bad.correct, false);

  // 소문자·공백도 같은 글자로 본다(버튼이 보내는 값이 바뀌어도 채점은 같다).
  assert.equal(gradeQuestion(item, ' b ').correct, true);
  // 아무것도 고르지 않으면 맞을 수 없다.
  assert.equal(gradeQuestion(item, '').correct, false);
});

test('E2 ★ 복수 정답 ["B","D"] — 글자 하나는 포함, 배열은 집합 일치', function () {
  const item = q({ answer: { letters: ['B', 'D'] } });

  // 한 번에 하나만 누를 수 있는 화면이 보내는 값 — 정답 중 하나를 짚으면 맞다.
  assert.equal(gradeQuestion(item, 'B').correct, true);
  assert.equal(gradeQuestion(item, 'D').correct, true);
  assert.equal(gradeQuestion(item, 'A').correct, false);
  assert.deepEqual(gradeQuestion(item, 'B').expected, ['B', 'D']);

  // 복수 선택 UI 대비 — 배열이면 **집합이 정확히 같아야** 맞다.
  assert.equal(gradeQuestion(item, ['B', 'D']).correct, true);
  assert.equal(gradeQuestion(item, ['D', 'B']).correct, true, '순서는 상관없다');
  assert.equal(gradeQuestion(item, ['B']).correct, false, '하나만 고르면 집합이 다르다');
  assert.equal(gradeQuestion(item, ['B', 'C']).correct, false);
  assert.equal(gradeQuestion(item, ['B', 'D', 'A']).correct, false);
});

test('E3 ★ unverified 는 채점하지 않는다 (5-4 — 1,233문항 중 79개)', function () {
  const unknown = q({ status: 'unverified', answer: null });
  assert.equal(isGradable(unknown), false);
  const g = gradeQuestion(unknown, 'B');
  assert.equal(g.gradable, false);
  assert.equal(g.correct, null, '맞다고도 틀렸다고도 하지 않는다');
  assert.deepEqual(g.expected, [], '정답 글자를 흘리지 않는다');

  // 정답 문단은 있는데 글자가 비어 있어도 채점하지 않는다.
  assert.equal(isGradable(q({ status: 'unverified', answer: { letters: [] } })), false);
  // status 가 unverified 면 정답 글자가 있어도 채점하지 않는다(중복 번호 등).
  assert.equal(isGradable(q({ status: 'unverified' })), false);
});

test('E4 ★ unverified 는 점수에도 total 에도 들지 않는다 (5-4)', function () {
  const qs = [
    q({ id: 'a', number: 1 }),
    q({ id: 'b', number: 2, status: 'unverified', answer: null }),
    // 5-4 — 번호 중복·정답 글자 범위 밖은 **정답 문단이 있어도** unverified 다.
    q({ id: 'd', number: 4, status: 'unverified', answer: { letters: ['B'] } }),
    q({ id: 'c', number: 3 })
  ];
  // `[수정 2026-09-25]` **채점할 수 없는 문항은 기본으로 내지 않는다.**
  // `[실기기]` 사용자가 퀴즈를 처음 열자 1번이 "정답 미확인"이고 해설도 없었다:
  // "해설이 없다? 그럼 퀴즈 왜 푸냐???" — 답도 해설도 없으면 시험이 아니다.
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: qs, mode: 'all', now: fakeClock() });
  assert.equal(s.total(), 2, '채점 가능한 둘만 낸다');

  s.answer('B'); s.next();      // 정답
  s.answer('C'); s.next();      // 오답

  const r = s.result();
  assert.equal(r.score, 1);
  assert.equal(r.total, 2);
  assert.equal(r.ungraded, 0, '낼 때 걸렀으므로 채점 못 한 것이 남지 않는다');
  assert.deepEqual(r.wrong.map(function (x) { return x.id; }), ['c']);
});

test('E4b ★ 섹션이 통째로 채점 불가면 그래도 낸다 — 그때는 점수가 0/0 이다', function () {
  // 걸러서 아무것도 안 남으면 빈 퀴즈를 주는 대신 원래대로 낸다(`pool = all` 폴백).
  // 그 경우에도 5-4 의 "채점하지 않는다"는 그대로 지켜져야 한다.
  const qs = [
    q({ id: 'a', number: 1, status: 'unverified', answer: null }),
    q({ id: 'b', number: 2, status: 'unverified', answer: { letters: ['B'] } })
  ];
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: qs, mode: 'all', now: fakeClock() });
  assert.equal(s.total(), 2, '빈 퀴즈를 주지는 않는다');

  s.answer('A'); s.next();
  s.answer('B'); s.next();      // 글자가 맞아도 세지 않는다

  const r = s.result();
  assert.equal(r.score, 0);
  assert.equal(r.total, 0, '채점된 것이 없으니 분모도 0 이다');
  assert.equal(r.ungraded, 2);
  assert.equal(r.answered, 2);
  assert.deepEqual(r.wrong, [], '채점 안 된 문항은 오답 목록에도 없다');
});

/* ══════════════════════════════════════════════════════════
   2. attempts · mistakes (9-2)
   ══════════════════════════════════════════════════════════ */

function fakeClock() {
  let t = 1000;
  return function () { t += 50; return t; };
}

test('E5 ★ attempts 레코드가 9-2 스키마 모양이다', function () {
  const qs = [q({ id: 'a', number: 1 }), q({ id: 'b', number: 2 })];
  let n = 0;
  const s = createSession({
    docId: 'doc7', sectionId: 'sec-III', questions: qs, mode: 'all',
    now: fakeClock(), newId: function () { return 'id' + (++n); }
  });
  s.answer('B'); s.next();
  s.answer('A'); s.next();

  const a = s.toAttempt();
  assert.equal(typeof a.id, 'string');
  assert.equal(a.docId, 'doc7');
  assert.equal(a.sectionId, 'sec-III');
  assert.equal(a.type, 'quiz');
  assert.equal(a.score, 1);
  assert.equal(a.total, 2);
  assert.ok(Number.isFinite(a.at));
  assert.ok(Number.isFinite(a.durationMs) && a.durationMs >= 0);
  assert.equal(a.items.length, 2);
  for (const it of a.items) {
    assert.deepEqual(Object.keys(it).sort(), ['chosen', 'correct', 'ms', 'questionId']);
    assert.ok(Number.isFinite(it.ms) && it.ms >= 0);
  }
  assert.deepEqual(a.items[0], { questionId: 'a', chosen: 'B', correct: true, ms: a.items[0].ms });
  assert.equal(a.items[1].correct, false);
});

test('E6 ★ 오답이 mistakes 에 기록된다 (5-5 — 저장까지만)', function () {
  const qs = [
    q({ id: 'a', number: 1 }),
    q({ id: 'b', number: 2 }),
    q({ id: 'c', number: 3, status: 'unverified', answer: null })
  ];
  let n = 0;
  const s = createSession({
    docId: 'doc7', sectionId: 'sec-III', questions: qs, mode: 'all',
    now: fakeClock(), newId: function () { return 'id' + (++n); }
  });
  s.answer('A'); s.next();      // 오답
  s.answer('B'); s.next();      // 정답
  s.answer('A'); s.next();      // 채점 불가

  const attempt = s.toAttempt();
  const misses = s.toMistakes(attempt);
  assert.equal(misses.length, 1, '오답 하나만 — 채점 안 된 문항은 오답이 아니다');
  const m = misses[0];
  assert.equal(m.questionId, 'a');
  assert.equal(m.attemptId, attempt.id);
  assert.equal(m.docId, 'doc7');
  assert.equal(m.chosen, 'A');
  assert.equal(m.at, attempt.at);
  assert.equal(m.resolvedAt, null);
  assert.equal(m.note, '');
  assert.equal(typeof m.id, 'string');
});

test('E7 같은 문항을 두 번 눌러도 첫 응답만 남는다 (즉시 채점 뒤 보기는 잠긴다)', function () {
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: [q({ id: 'a' })], now: fakeClock() });
  assert.equal(s.answered(), false);
  const first = s.answer('A');
  assert.equal(first.correct, false);
  const again = s.answer('B');
  assert.equal(again.correct, false, '두 번째 탭으로 정답을 고칠 수 없다');
  assert.equal(s.answered(), true);
  const a = s.toAttempt();
  assert.equal(a.items.length, 1);
});

test('E8 마지막 문항 뒤에 끝난다 — 빈 섹션은 처음부터 끝이다', function () {
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: [q({ id: 'a' })], now: fakeClock() });
  assert.equal(s.isFinished(), false);
  s.answer('B');
  s.next();
  assert.equal(s.isFinished(), true);
  assert.equal(s.result().score, 1);

  const empty = createSession({ docId: 'd', sectionId: 'sec-I', questions: [], now: fakeClock() });
  assert.equal(empty.isFinished(), true);
  assert.equal(empty.total(), 0);
  assert.equal(empty.current(), null);
  assert.equal(empty.toAttempt().items.length, 0);
});

/* ══════════════════════════════════════════════════════════
   3. isQuizWorthy 경계 (5-4)
   ══════════════════════════════════════════════════════════ */

function sectionOf(questions, unverified) {
  return { stats: { questions: questions, unverified: unverified } };
}

test('E9 ★ 제안 칩 경계 — 정확히 5문항, 정확히 0.6 에서 뜬다 (5-4)', function () {
  // 문항 수 경계: 5 는 뜨고 4 는 안 뜬다.
  assert.equal(isSectionQuizWorthy(sectionOf(5, 0)), true, '5문항 전부 verified 는 뜬다');
  assert.equal(isSectionQuizWorthy(sectionOf(4, 0)), false, '4문항은 안 뜬다');

  // 비율 경계: 5문항 중 verified 3 = 0.6 → 뜬다. verified 2 = 0.4 → 안 뜬다.
  assert.equal(isSectionQuizWorthy(sectionOf(5, 2)), true, '0.6 은 포함이다');
  assert.equal(isSectionQuizWorthy(sectionOf(5, 3)), false, '0.4 는 아니다');

  // 0.6 바로 아래 — 10문항 중 5 = 0.5.
  assert.equal(isSectionQuizWorthy(sectionOf(10, 5)), false);
  assert.equal(isSectionQuizWorthy(sectionOf(10, 4)), true, '0.6 정확히');

  assert.equal(isSectionQuizWorthy(null), false);
  assert.equal(isSectionQuizWorthy({}), false);
  assert.equal(isSectionQuizWorthy(sectionOf(0, 0)), false, '0 나눗셈으로 죽지 않는다');
});

test('E10 ★ 같은 경계가 documents.sectionIndex 한 줄에도 그대로 적용된다', function () {
  assert.equal(isIndexEntryQuizWorthy({ questions: 5, verified: 5 }), true);
  assert.equal(isIndexEntryQuizWorthy({ questions: 4, verified: 4 }), false);
  assert.equal(isIndexEntryQuizWorthy({ questions: 5, verified: 3 }), true, '0.6');
  assert.equal(isIndexEntryQuizWorthy({ questions: 5, verified: 2 }), false, '0.4');
  assert.equal(isIndexEntryQuizWorthy({ questions: 10, verified: 6 }), true);
  assert.equal(isIndexEntryQuizWorthy({ questions: 10, verified: 5 }), false);
  assert.equal(isIndexEntryQuizWorthy(null), false);
});

/* ══════════════════════════════════════════════════════════
   4. 섹션 인덱스 — 저장·재파싱·승격 (5-4 · 9-2)
   ══════════════════════════════════════════════════════════ */

test('E11 ★ 섹션 인덱스 — questions 레코드와 documents.sectionIndex 를 낸다', async function () {
  const pages = [questionsPage(10, 'I', 1, 6), answersPage(11, 'I', 1, 6)];
  const io = makeIo(pages);
  const out = await buildSectionIndex(io, { docId: 'doc1', pageCount: 11 });

  assert.equal(out.sections.length, 1);
  const entry = out.sections[0];
  assert.equal(entry.sectionId, 'sec-I');
  assert.equal(entry.questions, 6);
  assert.equal(entry.verified, 6);
  assert.equal(entry.startPage, 10);
  assert.equal(entry.endPage, 11);
  assert.deepEqual(io.index, out.sections, 'documents.sectionIndex 에 그대로 들어간다');

  assert.equal(io.store.size, 6);
  const rec = io.store.get('doc1:sec-I:q1');
  assert.ok(rec, 'id 는 {docId}:{sectionId}:q{n} 로 결정적이다 (5-4)');
  assert.equal(rec.source, 'book');
  assert.equal(rec.docId, 'doc1');
  assert.equal(rec.sectionId, 'sec-I');
  assert.equal(rec.status, 'verified');
  assert.deepEqual(rec.answer.letters, ['B']);
  assert.equal(rec.options.length, 4);
  assert.ok(rec.explanation && typeof rec.explanation.en === 'string');
  assert.equal(rec.pageNo, 10);
});

test('E12 ★ 재파싱은 같은 (docId, sectionId, number) 를 덮어쓴다 — 늘어나지 않는다', async function () {
  const pages = [questionsPage(10, 'I', 1, 6), answersPage(11, 'I', 1, 6)];
  const io = makeIo(pages);
  await buildSectionIndex(io, { docId: 'doc1', pageCount: 11 });
  const ids = Array.from(io.store.keys()).sort();
  assert.equal(io.store.size, 6);

  await buildSectionIndex(io, { docId: 'doc1', pageCount: 11 });
  assert.equal(io.store.size, 6, '두 번 돌려도 6개다');
  assert.deepEqual(Array.from(io.store.keys()).sort(), ids, 'id 집합이 같다');
});

test('E13 ★ unverified → verified 승격이 재파싱으로 일어난다 (5-4)', async function () {
  // 1) 해설 쪽이 아직 추출되지 않았다 — 정답을 못 찾으니 전부 unverified.
  const partial = [questionsPage(10, 'I', 1, 6)];
  const io = makeIo(partial);
  const first = await buildSectionIndex(io, { docId: 'doc1', pageCount: 10 });
  assert.equal(first.sections[0].questions, 6);
  assert.equal(first.sections[0].verified, 0, '해설이 없으면 전부 unverified');
  assert.equal(io.store.get('doc1:sec-I:q3').status, 'unverified');
  assert.equal(io.store.get('doc1:sec-I:q3').answer, null);

  // 2) 해설 쪽이 추출됐다 — 같은 id 가 verified 로 승격된다.
  partial.push(answersPage(11, 'I', 1, 6));
  const second = await buildSectionIndex(io, { docId: 'doc1', pageCount: 11 });
  assert.equal(second.sections[0].verified, 6);
  const rec = io.store.get('doc1:sec-I:q3');
  assert.equal(rec.status, 'verified');
  assert.deepEqual(rec.answer.letters, ['B']);
  assert.equal(io.store.size, 6, '승격이지 추가가 아니다');
});

test('E14 ★ 문항 쪽과 해설 쪽이 멀리 떨어져 있어도 한 섹션으로 매칭된다 (5-2)', async function () {
  // 문항은 10쪽, 해설은 300쪽. 창(32쪽) 을 여럿 건넌다.
  const pages = [questionsPage(10, 'I', 1, 6), answersPage(300, 'I', 1, 6)];
  const io = makeIo(pages);
  const out = await buildSectionIndex(io, { docId: 'doc1', pageCount: 400 });
  assert.equal(out.sections.length, 1);
  assert.equal(out.sections[0].verified, 6, '멀리 있는 해설도 같은 섹션 범위 안이다');
  assert.equal(out.sections[0].startPage, 10);
  assert.equal(out.sections[0].endPage, 300);
});

test('E15 섹션이 여럿이면 각각 따로 인덱싱된다 — id 는 로마숫자다 (5-2)', async function () {
  const pages = [
    questionsPage(10, 'I', 1, 6), answersPage(11, 'I', 1, 6),
    questionsPage(40, 'II', 1, 5), answersPage(41, 'II', 1, 5, 'C')
  ];
  const io = makeIo(pages);
  const out = await buildSectionIndex(io, { docId: 'doc1', pageCount: 41 });
  const ids = out.sections.map(function (s) { return s.sectionId; }).sort();
  assert.deepEqual(ids, ['sec-I', 'sec-II']);
  assert.ok(io.store.get('doc1:sec-II:q1'));
  assert.deepEqual(io.store.get('doc1:sec-II:q1').answer.letters, ['C']);
});

test('E16 ★ 파서가 아무것도 못 찾아도·io 가 던져도 던지지 않는다 (5-4)', async function () {
  const io = makeIo([page(1, ['지어낸 본문 한 줄입니다.', '또 다른 본문입니다.'])]);
  const out = await buildSectionIndex(io, { docId: 'doc1', pageCount: 1 });
  assert.deepEqual(out.sections, []);
  assert.deepEqual(io.index, []);

  const broken = {
    eachPage: function () { throw new Error('저장소가 깨졌다'); },
    putQuestions: function () { return Promise.resolve(); },
    saveIndex: function () { return Promise.resolve(); }
  };
  const out2 = await buildSectionIndex(broken, { docId: 'doc1', pageCount: 10 });
  assert.deepEqual(out2.sections, []);
  assert.ok(out2.diagnostics.errors.length > 0, '삼키되 진단에는 남긴다');

  // io 자체가 없어도 죽지 않는다.
  const out3 = await buildSectionIndex(null, { docId: 'doc1', pageCount: 10 });
  assert.deepEqual(out3.sections, []);
});

test('E17 ★ 7000쪽 — 한 번에 드는 쪽 수가 창 크기와 섹션 범위로 묶인다', async function () {
  // 쪽 400개 중 한 섹션만 있다. 1단계는 창(32쪽) 단위, 2단계는 섹션 범위다.
  const pages = [];
  for (let p = 1; p <= 400; p++) pages.push(page(p, ['지어낸 본문 ' + p]));
  pages[9] = questionsPage(10, 'I', 1, 6);
  pages[19] = answersPage(20, 'I', 1, 6);
  const io = makeIo(pages);
  const out = await buildSectionIndex(io, { docId: 'doc1', pageCount: 400 });

  assert.equal(out.sections.length, 1);
  assert.ok(out.diagnostics.maxPagesInMemory <= 32,
    '한 번에 든 쪽 수 ' + out.diagnostics.maxPagesInMemory + ' — 창 32쪽을 넘지 않는다');
  assert.equal(out.diagnostics.pagesScanned, 400, '1단계는 전수 훑기다');
  assert.ok(out.diagnostics.pagesParsed <= 13,
    '2단계는 섹션 범위(10~20 + 여유)만 읽는다: ' + out.diagnostics.pagesParsed);
});

test('E18 projectPage 는 파서가 읽는 것만 남긴다 (7000쪽 메모리)', function () {
  const p = projectPage({
    pageNo: 5, width: 612, height: 792,
    lines: [{ id: '5:0', text: 'x', bbox: {}, runs: [{ x0: 1 }] }],
    paragraphs: [{ id: '5:p0', text: '지어낸 문단', kind: 'body', bbox: {}, lineIds: ['5:0'] }],
    regions: [{ id: '5:r0' }]
  });
  assert.deepEqual(Object.keys(p).sort(), ['pageNo', 'paragraphs']);
  assert.deepEqual(Object.keys(p.paragraphs[0]).sort(), ['id', 'kind', 'text']);
  assert.equal(projectPage(null).paragraphs.length, 0, '빈 입력에도 던지지 않는다');
});

test('E19 창 나누기·범위 여유는 쪽 경계를 넘지 않는다', function () {
  assert.deepEqual(pageWindows(5, 2), [{ from: 1, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 5 }]);
  assert.deepEqual(pageWindows(0, 2), []);
  assert.deepEqual(padSpan({ startPage: 1, endPage: 10 }, 10, 3), { startPage: 1, endPage: 10 });
  assert.deepEqual(padSpan({ startPage: 5, endPage: 6 }, 100, 2), { startPage: 3, endPage: 8 });
});

test('E20 sectionPageSpan 은 해설 쪽까지 포함한다', function () {
  const answers = new Map();
  answers.set(1, { pageNo: 300 });
  const span = sectionPageSpan({
    startPage: 10, questions: [{ pageNo: 10 }, { pageNo: 12 }], answers: answers
  });
  assert.deepEqual(span, { startPage: 10, endPage: 300 });

  const entry = sectionIndexEntry({
    sectionId: 'sec-I', title: null, startPage: 10,
    questions: [], answers: new Map(), stats: { questions: 7, unverified: 2 }
  }, span);
  assert.equal(entry.questions, 7);
  assert.equal(entry.verified, 5);
});

test('E21 toQuestionRecord 는 9-2 의 필드만 낸다', function () {
  const rec = toQuestionRecord('d', 'sec-I', {
    number: 3, stem: '지어낸 문항', options: [{ letter: 'A', text: '가', paraId: '1:p1' }],
    pageNo: 12, stemParaIds: ['1:p0'], hasFigure: true,
    answer: { letters: ['C'], explanation: '지어낸 해설' }, status: 'verified'
  }, 55);
  assert.deepEqual(Object.keys(rec).sort(), [
    'answer', 'createdAt', 'docId', 'explanation', 'hasFigure', 'id',
    'number', 'options', 'pageNo', 'paraIds', 'sectionId', 'source', 'status', 'stem'
  ]);
  assert.equal(rec.id, 'd:sec-I:q3');
  assert.equal(rec.hasFigure, true);
  assert.equal(rec.createdAt, 55);
});

/* ══════════════════════════════════════════════════════════
   5. 순서 정하기의 **호출부** 불변식
   (planQuizOrder 자체의 테스트는 사람이 채운 뒤에 붙는다)
   ══════════════════════════════════════════════════════════ */

test('O1 fallbackOrder — all 은 원서 번호 순 그대로', function () {
  const qs = [q({ id: 'a', number: 1 }), q({ id: 'b', number: 2 })];
  assert.deepEqual(fallbackOrder({ questions: qs, mode: 'all' }).map(function (x) { return x.id; }), ['a', 'b']);
  assert.deepEqual(fallbackOrder({ questions: [], mode: 'all' }), []);
  assert.deepEqual(fallbackOrder(null), []);
});

test('O2 fallbackOrder — wrong-only 는 직전 attempt 의 **오답만**', function () {
  const qs = [q({ id: 'a', number: 1 }), q({ id: 'b', number: 2 }), q({ id: 'c', number: 3 })];
  const attempt = {
    items: [
      { questionId: 'a', correct: true },
      { questionId: 'b', correct: false },
      { questionId: 'c', correct: null }      // 채점 안 됨 — 오답이 아니다
    ]
  };
  const out = fallbackOrder({ questions: qs, mode: 'wrong-only', lastAttempt: attempt });
  assert.deepEqual(out.map(function (x) { return x.id; }), ['b']);
  assert.deepEqual(wrongIdsOf(attempt), new Set(['b']));
  assert.deepEqual(fallbackOrder({ questions: qs, mode: 'wrong-only', lastAttempt: null }), []);
});

test('O3 ★ 호출부 불변식 — 무엇이 오든 ctx.questions 의 부분집합이고 중복이 없다', function () {
  const qs = [q({ id: 'a', number: 1 }), q({ id: 'b', number: 2 }), q({ id: 'c', number: 3 })];
  const out = resolveOrder({ questions: qs, mode: 'all', lastAttempt: null, unverified: 0 });
  const ids = out.map(function (x) { return x.id; });
  assert.ok(out.length > 0, '풀 문항이 있으면 비어 나오지 않는다');
  assert.equal(new Set(ids).size, ids.length, '같은 문항이 두 번 나오지 않는다');
  for (const id of ids) assert.ok(['a', 'b', 'c'].indexOf(id) >= 0, '없는 문항을 만들어 내지 않는다');
});

test('O4 ★ 세션은 문항이 없을 때도 깨지지 않는다', function () {
  const s = createSession({ docId: 'd', sectionId: 'sec-I', questions: [], mode: 'wrong-only', now: fakeClock() });
  assert.equal(s.total(), 0);
  assert.equal(s.isFinished(), true);
  assert.equal(s.current(), null);
  assert.equal(s.answer('A'), null, '없는 문항에 답해도 던지지 않는다');
  assert.deepEqual(s.result().wrong, []);
});

test('O5 latestAttempt 는 가장 최근 quiz attempt 하나를 고른다', function () {
  const a = { type: 'quiz', at: 100, id: 'a' };
  const b = { type: 'quiz', at: 300, id: 'b' };
  const c = { type: 'section-review', at: 900, id: 'c' };
  assert.equal(latestAttempt([a, b, c]).id, 'b');
  assert.equal(latestAttempt([]), null);
  assert.equal(latestAttempt(null), null);
});
