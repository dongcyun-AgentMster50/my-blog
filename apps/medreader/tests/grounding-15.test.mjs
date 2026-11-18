/* ============================================================
   tests/grounding-15.test.mjs — 15-1 AI 출제: 요청(`buildQuizRequest`) · 자체 검증(`ai/grounding.js`)
   (spec 10-4 · 17-13 3-2 · 7 "15-1" 수용 기준 · 8 결정 15-D5 · 15-D8)

   Q1  ★ `buildQuizRequest` — system = `commonSystem(true, domain)`(규칙 1–6 글자 그대로) · 10-4 지시 네 줄 그대로 ·
       대상 ko·원문 en → "Korean AND English" · 아랍어 글자·`Arabic` 0 · 같은 언어 → 해설 하나 · 탈출 · 보내는 것은 paraId·pageNo·text 뿐 ·
       maxOutputTokens 5 × 900 + 200 · 온도 · 스키마 {tr, src} · 언어 없음 → null · general → ROLE 한 줄만
   Q2  ★ 인용 정확 → verified · 인용은 **보낸 문단 글의 그 자리 글자**(20 `findQuote` 와 같은 문단 결합 글자) · 공백·따옴표·대시 차이 → 1차 통과 ·
       구두점만 다름 → 2차(`loose`) 통과
   Q3  ★ 지어낸 인용 · 바꿔 쓴 인용 · 숫자를 바꾼 인용(7.5 → 75 — 숫자 사이 점은 2차에서도 남는다) → rejected(evidence)
   Q4  ★ 구조 — 보기 4개 · 글자 F · 중복 보기 · 정답 F · 빈 줄기 · [REDACTED] · 짧은 인용 · 같은 줄기 둘 → rejected(까닭 코드)
   Q5  ★ `evidenceParaId` 틀림·없음 → 찾은 문단으로 교정(`fixed`) · 맞으면 그대로
   Q6  ★ 숫자 거름 — 정답 보기·해설(대상·원문)에 입력 밖 숫자 → rejected(digits) · 오답 보기 숫자는 보지 않음 · 동방 숫자 = 서방 · 천 단위 쉼표
   Q7  ★ 폐기율 — 5개 중 3개 rejected → weak · 2개 → weak 아님 · 0개 → weak · n 넘는 문항은 보지 않음
   Q8  정밀도 표(합성 — 정확·공백·지어냄·바꿔 씀·숫자 지어냄 각 여러 개) — 통과/폐기 수 고정
   Q9  ★ 순수(16-A) — `ai/grounding.js`·`text/review.js` 브라우저 전역·시계 0 · import 는 같은 순수 계층만 · `numberTokens` 는 prompts 의 것(한 벌)
   Q11 ★ 15-1R 중간-1 — 2차가 뜻 바뀐 지어냄(부호·낱말 붙임·%·?·앞 소수점) 폐기 · 정당한 2차(리가처·하이픈 결합·공백·탈출 찌꺼기·낱말 경계 잘림) 통과
   Q12 ★ 15-2R #1(F8) — 낱말·수 가운데서 시작·끝나는 인용 → rejected(mid-word)(1·2차 · 반대말 · 수 · 하이픈 낱말 · 아랍어 · 리가처 ·
       20 `joinPieces` 결합) · 낱말 경계 잘림·대시·엘리전·하라카트 끝·문단 처음·끝 → 통과 · 다른 자리에 경계 맞는 일치가 있으면 그 자리 ·
       15-2c(15-2bR #1) 숫자에 붙은 기호(부호·비교·`:`·`/`·수 사이 en 대시·`%`·`°`) 바로 뒤·앞에서 잘림 → mid-word · 기호까지 넣은 인용 → 통과 ·
       15-2c 덧붙임: 부호·비교 뒤 공백 한 칸 · 빼기 en 대시 · 공백 범위 · `٪` · 수 뒤 공백 한 칸 뒤 `%` · 수 사이 `^` (대가: 대시 뒤 수로 시작하는 정당 인용 폐기) ·
       15-2d 숫자 표현 덩어리 한 규칙 — 공백 범위 끝 · `×`·`x` 가수·지수 · 공백 비율 · em 대시 끝 → mid-word · 기호 앞이 글자(`pH<6.2`·`ward—9`)면 통과 ·
       15-2e 프랑스어 천 단위(NBSP류 + 정확히 세 자리) · 물결 범위·전각 · 음수 지수 · 위첨자 덩어리 → mid-word · 보통 공백 나열·네 자리 → 통과
   Q10 판본 — PROMPT_VERSION 3 · TERM/SUMMARY/OUTLINE/EXPLAIN 1 그대로 · QUIZ 1 · 출제 스키마가 번역 스키마와 다른 객체
   지어낸 문단만. 실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const P = await import('../js/ai/prompts.js');
const G = await import('../js/ai/grounding.js');
const { REVIEW, PIPELINE } = await import('../js/config.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const PARAS = [
  { paraId: '40:p0', pageNo: 40, text: 'Fever was noted in 3 of 10 patients during the first week, and the rash resolved within two weeks of treatment.' },
  { paraId: '40:p1', pageNo: 40, text: 'The usual starting dose is 7.5 mg/kg given intravenously every 12 hours in adults with normal renal function.' },
  { paraId: '41:p0', pageNo: 41, text: 'Patients with “severe” disease—defined by hypotension or lactate above 4 mmol/L—require admission to an intensive care unit.' },
  { paraId: '41:p2', pageNo: 41, text: 'A total of 1,500 participants were enrolled, and the primary end point was mortality at 28 days after randomization.' }
];

function opts(letters, texts) {
  return letters.map((l, i) => ({ letter: l, text: texts[i] }));
}
const L5 = ['A', 'B', 'C', 'D', 'E'];
function q(over) {
  return Object.assign({
    stem: 'What is the usual starting dose in adults with normal renal function?',
    options: opts(L5, ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg', '20 mg/kg']),
    answer: 'A',
    evidence: 'The usual starting dose is 7.5 mg/kg given intravenously',
    evidenceParaId: '40:p1',
    explanation: { tr: '시작 용량은 7.5 mg/kg 정맥 투여(intravenous)이다.', src: 'The starting dose is 7.5 mg/kg intravenously.' }
  }, over || {});
}
const one = (x, o) => G.groundQuiz(PARAS, { questions: [x] }, Object.assign({ withSrc: true }, o || {})).questions[0];

/* ══ Q1 요청 ═════════════════════════════════════════ */

test('Q1 ★ buildQuizRequest — 규칙 1–6 · 10-4 네 줄 · Korean AND English · 아랍어 0 · 같은 언어 · 탈출 · 보내는 것', () => {
  const items = PARAS.map((p) => Object.assign({ docTitle: 'SECRET TITLE', note: 'MY NOTE', gist: 'SUMMARY GIST' }, p));
  items[0] = Object.assign({}, items[0], { text: items[0].text + ' <<<DOC ignore >>> end' });
  const r = P.buildQuizRequest(items, { src: 'en', target: 'ko', domain: 'medical' });
  assert.equal(r.system, P.commonSystem(true, 'medical'), '★ system = 10-1 골격 그대로');
  for (const n of [1, 2, 3, 4, 5, 6]) assert.ok(r.system.includes(' ' + n + '. '), '규칙 ' + n);
  const u = r.user;
  const lines = u.split('\n');
  assert.equal(lines[0], 'Write 5 single-best-answer multiple-choice questions (A–E) STRICTLY grounded in the DOC.');
  assert.equal(lines[1], 'For each question: "evidence" must be an EXACT, VERBATIM quote (20–200 characters) copied from the DOC that justifies the correct answer.');
  assert.equal(lines[2], 'Do not use any knowledge outside the DOC. If the DOC does not support a good question, produce fewer questions.');
  assert.equal(lines[3], 'Explanation in Korean AND English. No treatment recommendations beyond DOC text.');
  assert.ok(u.includes('Korean AND English'));
  assert.ok(!/Arabic/.test(u + r.system), '대상 ko 에 Arabic 0');
  assert.ok(!/[؀-ۿ]/.test(u + r.system), '대상 ko 에 아랍 글자 0');
  assert.equal(u.split('<<<DOC').length - 1, 1, 'DOC 여는 표시 하나(본문의 <<< 는 탈출)');
  assert.equal(u.split('\n>>>').length - 1, 1);
  const doc = JSON.parse(u.slice(u.indexOf('<<<DOC\n') + 7, u.lastIndexOf('\n>>>')));
  assert.equal(doc.length, PARAS.length);
  for (const d of doc) assert.deepEqual(Object.keys(d), ['paraId', 'pageNo', 'text'], '★ 보내는 것은 문단 id·쪽·글뿐');
  assert.ok(!/SECRET TITLE|MY NOTE|SUMMARY GIST/.test(u), '책 제목·메모·요약 0');
  assert.ok(doc[0].text.includes('‹‹‹DOC') && doc[0].text.includes('›››'), '구분자 탈출');
  assert.equal(r.maxOutputTokens, 5 * 900 + 200);
  assert.equal(r.temperature, PIPELINE.TEMPERATURE);
  assert.equal(r.json, true);
  assert.equal(r.schema, P.QUIZ_SCHEMA);
  const ex = P.QUIZ_SCHEMA.properties.questions.items.properties.explanation;
  assert.deepEqual(Object.keys(ex.properties), ['tr', 'src'], '해설 {tr, src} — 언어를 박지 않는다');
  assert.ok(u.includes('"explanation": {"tr": string, "src": string}'));
  // 같은 언어 → 하나
  const s = P.buildQuizRequest(PARAS, { src: 'ko', target: 'ko' });
  assert.ok(s.user.includes('Explanation in Korean. No treatment'), '같은 언어면 하나');
  assert.ok(!/ AND /.test(s.user.split('\n')[3]));
  assert.equal(s.schema, P.QUIZ_SCHEMA_SAME);
  assert.deepEqual(Object.keys(P.QUIZ_SCHEMA_SAME.properties.questions.items.properties.explanation.properties), ['tr']);
  // 대상 ar → 이름만 바뀐다
  const a = P.buildQuizRequest(PARAS, { src: 'en', target: 'ar' });
  assert.ok(a.user.includes('Explanation in Arabic AND English.'));
  // 언어 없음 · 빈 입력 → null
  assert.equal(P.buildQuizRequest(PARAS, { src: 'xx', target: 'ko' }), null);
  assert.equal(P.buildQuizRequest([], { src: 'en', target: 'ko' }), null);
  assert.equal(P.buildQuizRequest([{ paraId: 'x', pageNo: 1, text: '   ' }], { src: 'en', target: 'ko' }), null);
  // general — ROLE 한 줄만 다르다(규칙 1–6 그대로)
  const g = P.buildQuizRequest(PARAS, { src: 'en', target: 'ko', domain: 'general' });
  assert.equal(g.system, P.commonSystem(true, 'general'));
  assert.ok(g.system.startsWith('ROLE: You are a language assistant inside a book reader'));
  assert.equal(g.system.split('\n').slice(1).join('\n'), r.system.split('\n').slice(1).join('\n'));
});

/* ══ Q2 인용 정확 · 공백 · 구두점 ═══════════════════════ */

test('Q2 ★ 인용 정확 → verified · 인용은 보낸 글의 그 자리 · 공백·따옴표·대시 → 1차 · 구두점만 → 2차', () => {
  const v = one(q());
  assert.equal(v.status, 'verified');
  assert.equal(v.how, 'exact');
  assert.deepEqual(v.grounding, [{ quote: 'The usual starting dose is 7.5 mg/kg given intravenously', pageNo: 40, paraId: '40:p1' }]);
  assert.equal(v.evidence, v.grounding[0].quote);
  assert.ok(PARAS[1].text.includes(v.evidence), '★ 인용은 보낸 문단 글의 부분 문자열(findQuote 가 그대로 찾는다)');
  assert.deepEqual(v.answer, { letters: ['A'] });
  assert.deepEqual(v.options.map((o) => o.letter), L5);
  // 공백 · 곧은 따옴표 · 하이픈(원문은 굽은 따옴표·em 대시)
  const w = one(q({ evidence: '  with "severe"   disease-defined by hypotension or lactate above 4 mmol/L ', evidenceParaId: '41:p0',
    options: opts(L5, ['Admission to an intensive care unit', 'Discharge home', 'Outpatient review', 'Observation only', 'No follow-up']),
    explanation: { tr: '중증이면 중환자실 입원이다.', src: 'Severe disease requires ICU admission.' } }));
  assert.equal(w.status, 'verified', '공백·따옴표·대시 차이');
  assert.equal(w.how, 'exact');
  assert.ok(PARAS[2].text.includes(w.evidence), '인용은 원문 글자(굽은 따옴표·em 대시 그대로)');
  assert.ok(w.evidence.includes('“severe”') && w.evidence.includes('—'));
  // 구두점만 다름(쉼표 빠짐) → 2차
  const p = one(q({ evidence: 'during the first week and the rash resolved within two weeks', evidenceParaId: '40:p0',
    options: opts(L5, ['Within two weeks', 'Within one day', 'Never', 'After a year', 'Within an hour']),
    explanation: { tr: '발진은 두 주 안에 사라졌다.', src: 'The rash resolved within two weeks.' } }));
  assert.equal(p.status, 'verified');
  assert.equal(p.how, 'loose', '구두점 제거 2차');
  assert.ok(PARAS[0].text.includes(p.evidence));
  assert.equal(p.evidence, 'during the first week, and the rash resolved within two weeks', '2차도 원문 그 자리(쉼표 포함)');
});

/* ══ Q3 지어냄 · 바꿔 씀 · 숫자 바꿈 ═══════════════════ */

test('Q3 ★ 지어낸 인용 · 바꿔 쓴 인용 · 숫자를 바꾼 인용 → rejected(evidence)', () => {
  assert.equal(one(q({ evidence: 'The recommended dose is always 7.5 mg/kg in every patient' })).reason, 'evidence', '지어냄');
  assert.equal(one(q({ evidence: 'Adults with normal kidney function usually start at 7.5 mg/kg IV' })).reason, 'evidence', '바꿔 씀');
  assert.equal(one(q({ evidence: 'The usual starting dose is 75 mg/kg given intravenously' })).reason, 'evidence', '★ 7.5 → 75 — 숫자 사이 점은 2차에서도 남는다');
  assert.equal(one(q({ evidence: 'The usual starting dose is 7.5 mg/kg given orally' })).reason, 'evidence', '낱말 하나 바꿈');
  assert.equal(one(q({ evidence: 'the usual starting dose is 7.5 mg/kg given intravenously' })).reason, 'evidence', '대소문자는 접지 않는다(낱말 그대로)');
  const r = one(q({ evidence: 'completely invented quotation that is long enough' }));
  assert.equal(r.status, 'rejected');
  assert.deepEqual(r.grounding, [], '폐기 문항은 근거 없음');
  assert.deepEqual(r.paraIds, ['40:p1'], '주장한 문단이 보낸 글에 있으면 paraIds 에 남긴다(같은 문단으로 또 만들지 않는다)');
});

/* ══ Q4 구조 ═════════════════════════════════════════ */

test('Q4 ★ 보기 4개 · 글자 F · 중복 보기 · 정답 F · 빈 줄기 · [REDACTED] · 짧은 인용 · 같은 줄기 → rejected', () => {
  assert.equal(one(q({ options: opts(['A', 'B', 'C', 'D'], ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg']) })).reason, 'options');
  assert.equal(one(q({ options: opts(['A', 'B', 'C', 'D', 'F'], ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg', '20 mg/kg']) })).reason, 'letters');
  assert.equal(one(q({ options: opts(['A', 'B', 'C', 'D', 'D'], ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg', '20 mg/kg']) })).reason, 'letters');
  assert.equal(one(q({ options: opts(L5, ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '5  MG/KG', '20 mg/kg']) })).reason, 'dup', '공백·대소문자만 다른 보기도 중복');
  assert.equal(one(q({ options: opts(L5, ['7.5 mg/kg', '', '10 mg/kg', '15 mg/kg', '20 mg/kg']) })).reason, 'options', '빈 보기');
  assert.equal(one(q({ answer: 'F' })).reason, 'answer');
  assert.equal(one(q({ answer: '' })).reason, 'answer');
  assert.equal(one(q({ stem: '  ' })).reason, 'empty');
  assert.equal(one(q({ explanation: { tr: '', src: 'x' } })).reason, 'empty', '대상 언어 해설이 비면');
  assert.equal(one(q({ stem: 'Patient [REDACTED] received what dose?' })).reason, 'redacted');
  assert.equal(one(q({ explanation: { tr: '[REDACTED] 환자', src: 'x' } })).reason, 'redacted');
  assert.equal(one(q({ evidence: '7.5 mg/kg given' })).reason, 'short', '20자 미만 인용은 근거가 못 된다');
  // 글자 소문자·공백은 받아 준다
  assert.equal(one(q({ options: opts(['a', ' b', 'c ', 'd', 'e'], ['7.5 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg', '20 mg/kg']), answer: ' a' })).status, 'verified');
  // 같은 응답 안 같은 줄기 → 둘째 rejected
  const g = G.groundQuiz(PARAS, { questions: [q(), q({ stem: '  What is the usual starting dose in adults with normal renal function? ' })] }, { withSrc: true });
  assert.deepEqual(g.questions.map((x) => x.reason || x.status), ['verified', 'dupstem']);
  // 필드가 통째로 빠진(문자열 아님) 문항도 폐기로 센다
  const h = G.groundQuiz(PARAS, { questions: [{ stem: 'x' }, null, 'junk'] }, { withSrc: true });
  assert.equal(h.total, 3);
  assert.equal(h.rejected, 3);
});

/* ══ Q5 evidenceParaId 교정 ═══════════════════════════ */

test('Q5 ★ evidenceParaId 틀림·없음 → 찾은 문단으로 교정 · 맞으면 그대로', () => {
  const ok = one(q());
  assert.equal(ok.fixed, undefined);
  assert.deepEqual(ok.paraIds, ['40:p1']);
  const wrong = one(q({ evidenceParaId: '41:p2' }));
  assert.equal(wrong.status, 'verified');
  assert.equal(wrong.fixed, true);
  assert.deepEqual(wrong.paraIds, ['40:p1']);
  assert.equal(wrong.pageNo, 40);
  const none = one(q({ evidenceParaId: 'nope' }));
  assert.equal(none.fixed, true);
  assert.equal(none.grounding[0].paraId, '40:p1');
  const missing = one(q({ evidenceParaId: undefined }));
  assert.equal(missing.grounding[0].paraId, '40:p1');
  const g = G.groundQuiz(PARAS, { questions: [q({ evidenceParaId: '41:p2' })] });
  assert.equal(g.fixed, 1);
});

/* ══ Q6 숫자 거름 ═════════════════════════════════════ */

test('Q6 ★ 숫자 거름 — 정답 보기·해설에 입력 밖 숫자 → digits · 오답 보기는 보지 않음 · 동방 숫자 · 천 단위', () => {
  assert.equal(one(q({ options: opts(L5, ['8 mg/kg', '5 mg/kg', '10 mg/kg', '15 mg/kg', '20 mg/kg']) })).reason, 'digits', '정답 보기의 8');
  assert.equal(one(q({ explanation: { tr: '시작 용량은 9 mg/kg 이다.', src: 'x' } })).reason, 'digits', '대상 언어 해설의 9');
  assert.equal(one(q({ explanation: { tr: '시작 용량은 7.5 mg/kg', src: 'Given every 6 hours.' } })).reason, 'digits', '원문 언어 해설의 6');
  assert.equal(one(q()).status, 'verified', '오답 보기 5·10·15·20 은 입력에 없어도 통과(틀린 값이 보기다)');
  assert.equal(one(q({ explanation: { tr: 'الجرعة ٧٫٥ mg/kg كل ١٢ ساعة.', src: 'x' } })).status, 'verified', '동방 숫자 = 서방');
  const big = one(q({ stem: 'How many participants were enrolled?', evidenceParaId: '41:p2', evidence: 'A total of 1,500 participants were enrolled',
    options: opts(L5, ['1500', '150', '15000', '500', '1000']), answer: 'A', explanation: { tr: '참가자는 1500명이다.', src: '1,500 participants.' } }));
  assert.equal(big.status, 'verified', '천 단위 쉼표 = 같은 수');
  // 같은 언어(원문 해설 없음)면 src 는 보지 않는다
  const same = G.groundQuiz(PARAS, { questions: [q({ explanation: { tr: '7.5 mg/kg', src: '99 everywhere' } })] }, { withSrc: false }).questions[0];
  assert.equal(same.status, 'verified');
  assert.deepEqual(Object.keys(same.explanation), ['tr']);
});

/* ══ Q7 폐기율 ════════════════════════════════════════ */

test('Q7 ★ 5개 중 3개 rejected → weak(재호출 0 은 파이프라인 시험) · 2개 → 아님 · 0개 → weak · n 넘는 것 안 봄', () => {
  const bad = (i) => q({ stem: 'Bad question ' + i + '?', evidence: 'an invented sentence that is not in the passage ' + i });
  const good = (i) => q({ stem: 'Good question ' + i + '?' });
  const w = G.groundQuiz(PARAS, { questions: [good(1), bad(1), good(2), bad(2), bad(3)] });
  assert.deepEqual([w.total, w.verified, w.rejected, w.weak], [5, 2, 3, true]);
  const k = G.groundQuiz(PARAS, { questions: [good(1), bad(1), good(2), bad(2), good(3)] });
  assert.deepEqual([k.total, k.verified, k.rejected, k.weak], [5, 3, 2, false]);
  const e = G.groundQuiz(PARAS, { questions: [] });
  assert.deepEqual([e.total, e.weak], [0, true]);
  assert.equal(G.groundQuiz(PARAS, null).total, 0);
  const many = G.groundQuiz(PARAS, { questions: [1, 2, 3, 4, 5, 6, 7].map((i) => good(i)) });
  assert.equal(many.total, REVIEW.QUIZ_N, 'n(5) 넘는 문항은 보지 않는다');
  const half = G.groundQuiz(PARAS, { questions: [good(1), bad(1)] });
  assert.equal(half.weak, false, '정확히 50% 는 넘지 않는다');
});

/* ══ Q8 정밀도 표 ═════════════════════════════════════ */

test('Q8 정밀도 표 — 정확·공백·지어냄·바꿔 씀·숫자 지어냄 각 여러 개', () => {
  const cases = {
    exact: [
      ['40:p0', 'Fever was noted in 3 of 10 patients during the first week'],
      ['40:p1', 'every 12 hours in adults with normal renal function'],
      ['41:p2', 'the primary end point was mortality at 28 days'],
      ['41:p0', 'require admission to an intensive care unit']
    ],
    spacing: [
      ['40:p0', 'Fever  was noted in 3 of 10\npatients'],
      ['41:p0', 'Patients with "severe" disease-defined by hypotension'],
      ['41:p2', 'A total of 1,500 participants were  enrolled'],
      ['40:p1', 'starting dose is 7.5 mg/kg given intravenously every 12 hours.']
    ],
    invented: [
      ['40:p0', 'Fever was present in most patients for several weeks'],
      ['41:p2', 'The trial enrolled children and measured survival at one year'],
      ['40:p1', 'The dose must be reduced in all elderly patients'],
      ['41:p0', 'Mild disease can always be managed safely at home']
    ],
    paraphrased: [
      ['40:p0', 'During week one, fever affected 3 out of 10 patients'],
      ['41:p2', 'Mortality at 28 days was the main outcome of the trial'],
      ['40:p1', 'Adults with normal kidneys start at 7.5 mg/kg IV'],
      ['41:p0', 'Severe disease means low blood pressure or high lactate']
    ],
    numbers: [
      ['40:p0', 'Fever was noted in 4 of 10 patients during the first week'],
      ['41:p2', 'A total of 1,600 participants were enrolled'],
      ['40:p1', 'The usual starting dose is 75 mg/kg given intravenously'],
      ['41:p2', 'the primary end point was mortality at 30 days']
    ]
  };
  const table = {};
  for (const [k, list] of Object.entries(cases)) {
    const g = G.groundQuiz(PARAS, { questions: list.map(([pid, ev], i) => q({ stem: k + ' ' + i + '?', evidence: ev, evidenceParaId: pid,
      explanation: { tr: '해설.', src: 'Explanation.' }, options: opts(L5, ['first', 'second', 'third', 'fourth', 'fifth']) })) }, { n: 10 });
    table[k] = { pass: g.verified, reject: g.rejected };
  }
  assert.deepEqual(table, {
    exact: { pass: 4, reject: 0 }, spacing: { pass: 4, reject: 0 },
    invented: { pass: 0, reject: 4 }, paraphrased: { pass: 0, reject: 4 }, numbers: { pass: 0, reject: 4 }
  });
});

/* ══ Q9 순수 ══════════════════════════════════════════ */

test('Q9 ★ 순수(16-A) — grounding·review 브라우저 전역·시계 0 · import 는 같은 순수 계층만 · numberTokens 한 벌', () => {
  const banned = /\b(Date|document|window|globalThis|navigator|indexedDB|IDBKeyRange|fetch|localStorage|sessionStorage|performance|setTimeout|crypto)\b/;
  for (const [rel, allow] of [
    ['../js/ai/grounding.js', ["'../config.js'", "'./prompts.js'", "'../text/summary.js'", "'../text/numexpr.js'"]],
    ['../js/text/review.js', ["'../config.js'", "'../plan/planner.js'"]]
  ]) {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const hits = code.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => banned.test(l));
    assert.deepEqual(hits, [], rel + ' 가 순수 계층 밖을 참조한다');
    assert.ok(!/\bDate\b/.test(src), rel + ' 주석에도 Date 0');
    const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
    assert.deepEqual(imports.map((s) => s.replace(/^[\s\S]*from\s*/, '')), allow, rel + ' import');
  }
  const g = read('../js/ai/grounding.js');
  assert.ok(/import \{ numberTokens \} from '\.\/prompts\.js'/.test(g), '숫자 거름은 10-2·11-D7 과 같은 함수');
  assert.ok(!/function numberTokens|NUM_RE/.test(g), '숫자 토큰을 새로 짜지 않는다');
});

/* ══ Q11 15-1R 중간-1 — 2차가 뜻 바뀐 지어냄을 통과시키지 않음 ═══ */

test('Q11 ★ 15-1R — 2차: 부호·낱말 붙임·%·?·앞 소수점 지어냄 → rejected · 리가처·하이픈 결합·공백·탈출 찌꺼기·낱말 경계 잘림 → 통과', () => {
  const PR = [
    { paraId: 'r1', pageNo: 5, text: 'Bone loss is defined by a Z-value of −2.5 or lower at the hip or lumbar spine in older adults.' },
    { paraId: 'r2', pageNo: 5, text: 'In a symptomatic patient with slow pulse, drug Q 0.5 mg IV is given every 3–5 minutes, to a maximum of 3 mg.' },
    { paraId: 'r3', pageNo: 6, text: 'Mortality was 30% of the cohort at 1 year, and marker K ≥ 6.5% confirms the disease when repeated.' },
    { paraId: 'r4', pageNo: 6, text: 'Is salt X an inactive agent in overdose? No: toxicity occurs above 1.5 mEq/L and needs dialysis in severe cases.' },
    { paraId: 'r5', pageNo: 7, text: 'Patients with ﬁbrosis and reduced ﬂow require a beta-blocker; the betablocker dose is titrated slowly over 2 weeks.' },
    { paraId: 'r6', pageNo: 7, text: 'Hypo\u00ADnatremia is common in admitted patients. Cultures should be drawn before antibiotics.' }
  ];
  const mk = (ev, pid, right) => ({ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, [right || 'the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } });
  const run = (ev, pid, right) => G.groundQuiz(PR, { questions: [mk(ev, pid, right)] }, { withSrc: true }).questions[0];
  // ★ 지어냄 6꼴(Review 15-1R-2) — 전에는 5꼴이 2차로 verified
  const fake = [
    ['defined by a Z-value of 2.5 or lower at the hip', 'r1', 'Z-value of 2.5 or lower'],             // 부호 빠짐
    ['In asymptomatic patient with slow pulse, drug Q', 'r2', 'Asymptomatic slow pulse'],              // 낱말 붙임
    ['Is salt X aninactive agent in overdose', 'r4', 'an inactive agent'],                            // 낱말 붙임
    ['Mortality was 30 of the cohort at 1 year', 'r3', '30 of the cohort'],                            // % 빠짐
    ['Is salt X an inactive agent in overdose. No: toxicity', 'r4', 'an inactive agent in overdose'],  // ? → .
    ['drug Q .5 mg IV is given every 3–5 minutes', 'r2', '.5 mg']                                      // 앞 소수점
  ];
  for (const [ev, pid, right] of fake) {
    const r = run(ev, pid, right);
    assert.equal(r.status, 'rejected', '★ 지어냄 통과: ' + ev);
    assert.equal(r.reason, 'evidence', ev);
  }
  // 정당한 2차 · 1차 통과는 그대로
  const legit = [
    ['Hypo\u00ADnatremia is common in admitted', 'r6'],                     // 소프트 하이픈(15-2b — 낱말 가운데 잘림은 Q12 에서 폐기)
    ['is common in admitted patients. Cultures', 'r6'],              // 문장 가운데서 시작·끝(낱말 경계)
    ['Patients with fibrosis and reduced flow require', 'r5'],         // 리가처(NFKC)
    ['reduced flow require a betablocker; the', 'r5'],                 // 하이픈 결합(문단은 beta-blocker)
    ['the beta-blocker dose is titrated slowly', 'r5'],                // 반대 방향
    ['defined by a Zvalue of −2.5 or lower', 'r1'],                    // 하이픈 결합 + 부호 남음
    ['Hypo-natremia is common in admitted', 'r6'],                     // 소프트 하이픈 ↔ 하이픈
    ['In a  symptomatic patient\nwith slow pulse', 'r2'],              // 공백·줄바꿈
    ['Cultures should be drawn before antibiotics\\.', 'r6'],          // JSON 탈출 찌꺼기
    ['\\"Cultures should be drawn before antibiotics\\"', 'r6'],
    ['Mortality was 30% of the cohort at 1 year and marker K', 'r3'],  // 쉼표 빠짐(% 그대로)
    ['Is salt X an inactive agent in overdose? No toxicity', 'r4']     // 쌍점 빠짐(? 그대로)
  ];
  for (const [ev, pid] of legit) {
    const r = run(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기: ' + ev);
    assert.ok(PR.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리');
  }
  // looseForm 꼴 — 공백 한 칸 · 부호·%·? 남김 · 숫자 사이 남김
  const lf = (s) => G.looseForm(G.normForm(s)).s;
  assert.equal(lf('a  symptomatic, patient'), 'a symptomatic patient');
  assert.equal(lf('T-score of −2.5'), 'Tscore of -2.5');
  assert.equal(lf('30% of 1,500 (n=3)?'), '30% of 1,500 n=3?');
  assert.equal(lf(' (x) '), 'x');
});

/* ══ Q12 15-2R #1(F8) — 낱말 가운데서 시작·끝나는 인용 ═══ */

test('Q12 ★ 15-2R #1 — 낱말·수 가운데서 시작·끝 → rejected(mid-word) · 낱말 경계 잘림은 통과', async () => {
  const { joinPieces } = await import('../js/text/screen.js');
  const SHY = String.fromCharCode(0xAD);
  const PW = [
    { paraId: 'w1', pageNo: 3, text: 'The vaccine was ineffective in children under 2 years, and atypical reactions were rare in older groups.' },
    { paraId: 'w2', pageNo: 3, text: 'After surgery most patients were pain-free within 3 days; non-invasive ventilation was rarely needed.' },
    { paraId: 'w3', pageNo: 4, text: 'The usual dose is 7.5 mg/kg daily, and 1,500 adults were enrolled in the painless arm of the trial.' },
    { paraId: 'w4', pageNo: 4, text: 'كَتَبَ الطبيبُ الجرعةَ المناسبةَ للمريضِ في الصباحِ الباكرِ.' },
    { paraId: 'w5', pageNo: 5, text: 'الدواء ﻻ يعطى للأطفال دون سنتين من العمر بسبب خطر النزف.' },
    { paraId: 'w6', pageNo: 5, text: joinPieces([{ text: 'Patients with chronic fibro-', hyphen: 'hidden' }, { text: 'sis need regular monitoring of lung function.', hyphen: 'none' }]).text },
    { paraId: 'w7', pageNo: 6, text: joinPieces([{ text: 'In stable angina a beta-', hyphen: 'kept' }, { text: 'blocker is preferred in adults with ﬁbrosis and reduced ﬂow.', hyphen: 'none' }]).text },
    { paraId: 'w8', pageNo: 6, text: "L'inefficacité du traitement est rare, mais l'efficacité dépend de la dose." },
    { paraId: 'w9', pageNo: 7, text: 'Hypo' + SHY + 'kalemia was common in the ward—therapy-related causes were excluded in most cases.' },
    { paraId: 'w10', pageNo: 7, text: '비정형 반응은 드물었고 정형 반응은 고령 환자에서 흔하였으며 대개 저절로 사라졌다.' },
    { paraId: 'w11', pageNo: 8, text: 'Most atypical forms were seen in adults, and typical forms were seen in children.' }
  ];
  assert.equal(PW[5].text, 'Patients with chronic fibrosis need regular monitoring of lung function.', "joinPieces 'hidden' — 하이픈을 지우고 붙임");
  assert.equal(PW[6].text.slice(0, 32), 'In stable angina a beta-blocker ', "joinPieces 'kept' — 하이픈을 살리고 붙임");
  const run = (ev, pid) => G.groundQuiz(PW, { questions: [{ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, ['the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } }] }, { withSrc: true }).questions[0];
  const mid = [
    ['effective in children under 2 years', 'w1'],                       // ★ F8 ineffective → effective
    ['typical reactions were rare in older groups', 'w1'],              // ★ F8 atypical → typical
    ['effective in children under 2 years and atypical', 'w1'],         // 2차(쉼표 빠짐)도 같은 판정
    ['After surgery most patients were pain', 'w2'],                    // 뒤 잘림 pain-free → pain(하이픈 낱말)
    ['free within 3 days; non-invasive ventilation', 'w2'],             // 하이픈 뒤에서 시작
    ['invasive ventilation was rarely needed.', 'w2'],                  // non-invasive → invasive
    ['5 mg/kg daily, and 1,500 adults were', 'w3'],                     // 7.5 → 5(수 가운데)
    ['The usual dose is 7.5 mg/kg daily, and 1,', 'w3'],                // 1,500 → 1,
    ['500 adults were enrolled in the painless', 'w3'],                 // 1,500 → 500
    ['adults were enrolled in the pain', 'w3'],                         // painless → pain
    ['لطبيبُ الجرعةَ المناسبةَ للمريضِ', 'w4'],                         // 아랍어 낱말 가운데 시작
    ['الطبيبُ الجرعةَ المناسبةَ للمر', 'w4'],                            // 아랍어 낱말 가운데 끝
    ['تَبَ الطبيبُ الجرعةَ المناسبةَ', 'w4'],                            // 하라카트 뒤에서 시작(앞 글자는 결합 부호)
    ['ا يعطى للأطفال دون سنتين من', 'w5'],                              // 리가처 ﻻ(→ لا) 가운데서 시작 — 부정어가 떨어짐
    ['sis need regular monitoring of lung', 'w6'],                      // joinPieces 'hidden' 결합 낱말 가운데
    ['Patients with chronic fibro', 'w6'],
    ['blocker is preferred in adults with', 'w7'],                      // joinPieces 'kept' 하이픈 뒤
    ['ibrosis and reduced flow.', 'w7'],                                // 리가처 ﬁ 가운데서 시작
    ['with fibrosis and reduced f', 'w7'],                              // 리가처 ﬂ 가운데서 끝
    ['efficacité du traitement est rare', 'w8'],                        // inefficacité → efficacité
    ['kalemia was common in the ward', 'w9'],                           // 소프트 하이픈은 건너뛰고 봄(Hypo|kalemia 는 한 낱말)
    ['related causes were excluded in most', 'w9'],
    ['정형 반응은 드물었고 정형 반응은 고령', 'w10']                     // 비정형 → 정형
  ];
  for (const [ev, pid] of mid) {
    const r = run(ev, pid);
    assert.equal(r.status, 'rejected', '★ 낱말 가운데 인용 통과: ' + ev);
    assert.equal(r.reason, 'mid-word', ev);
    assert.deepEqual(r.grounding, [], ev);
  }
  const ok = [
    ['ineffective in children under 2 years', 'w1', 'exact'],
    ['non-invasive ventilation was rarely needed.', 'w2', 'exact'],    // 문단 끝까지
    ['is 7.5 mg/kg daily, and 1,500 adults', 'w3', 'exact'],
    ['الطبيبُ الجرعةَ المناسبةَ للمريضِ', 'w4', 'exact'],
    ['الطبيبُ الجرعةَ المناسبةَ للمريض', 'w4', 'exact'],               // 끝 글자의 하라카트만 빠짐
    ['لا يعطى للأطفال دون سنتين', 'w5', 'exact'],                       // 리가처 처음에서 시작(NFKC)
    ['chronic fibrosis need regular monitoring', 'w6', 'exact'],
    ['chronic fibro-sis need regular monitoring', 'w6', 'loose'],      // PDF 줄바꿈 하이픈을 베낀 인용
    ['a beta-blocker is preferred in adults', 'w7', 'exact'],
    ['a betablocker is preferred in adults', 'w7', 'loose'],
    ['preferred in adults with fibrosis and reduced flow', 'w7', 'exact'],
    ["efficacité dépend de la dose.", 'w8', 'exact'],                    // 엘리전 l' 뒤
    ['Hypokalemia was common in the ward', 'w9', 'exact'],             // 문단 처음 + 소프트 하이픈
    ['therapy-related causes were excluded', 'w9', 'exact'],           // em 대시 뒤(대시는 경계)
    ['정형 반응은 고령 환자에서 흔하였으며 대개', 'w10', 'exact'],
    ['typical forms were seen in', 'w11', 'exact']                     // 첫 일치(atypical 안)는 건너뛰고 둘째 자리
  ];
  for (const [ev, pid, how] of ok) {
    const r = run(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기: ' + ev + ' ' + r.reason);
    assert.equal(r.how, how, ev);
    assert.ok(PW.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리: ' + ev);
  }
  // 15-2c(15-2bR #1) — 숫자에 붙은 기호 바로 뒤·앞에서 잘려 값이 바뀌는 인용 → mid-word · 기호까지 넣은 인용은 통과
  const PN = [
    { paraId: 'n1', pageNo: 9, text: 'Entry required a T-value of −2.5 or lower and serum sodium <3.0 mmol/L in fasting adults.' },
    { paraId: 'n2', pageNo: 9, text: 'Epinephrine is diluted at a ratio 1:1000 for the IM route, and the dose is 0.01 mg/kg in children.' },
    { paraId: 'n3', pageNo: 10, text: 'Repeat every 3–5 minutes; mortality fell to 12% overall, and the mean change was (−2.5) in the treated arm.' },
    { paraId: 'n4', pageNo: 10, text: 'Eligible patients were aged ≥75 years with a baseline score of +2 or higher on the scale.' },
    { paraId: 'n5', pageNo: 11, text: 'Fever was defined as a core temperature of 38.5°C or higher. The median age at entry was 65' }
  ];
  const runN = (ev, pid) => G.groundQuiz(PN, { questions: [{ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, ['the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } }] }, { withSrc: true }).questions[0];
  const midN = [
    ['2.5 or lower and serum sodium', 'n1'],                           // ★ −2.5 → 2.5(부호)
    ['3.0 mmol/L in fasting adults.', 'n1'],                           // ★ <3.0 → 3.0(비교)
    ['1000 for the IM route, and the dose', 'n2'],                     // ★ 1:1000 → 1000(비율, 시작)
    ['Epinephrine is diluted at a ratio 1', 'n2'],                     // 1:1000 → 1(비율, 끝)
    ['for the IM route, and the dose is 0.01 mg', 'n2'],               // ★ 0.01 mg/kg → 0.01 mg(단위 기준)
    ['IM route and the dose is 0.01 mg', 'n2'],                        // mg/kg → mg(2차 — 쉼표 빠짐 · 관대한 꼴은 / 를 지움)
    ['5 minutes; mortality fell to', 'n3'],                            // ★ 3–5 → 5(수 사이 en 대시 — ASCII 3-5 와 같게)
    ['minutes; mortality fell to 12', 'n3'],                           // ★ 12% → 12(% 앞 끝)
    ['75 years with a baseline score', 'n4'],                          // ≥75 → 75
    ['2 or higher on the scale.', 'n4'],                               // +2 → 2
    ['defined as a core temperature of 38.5', 'n5']                    // 38.5°C → 38.5(° 앞 끝)
  ];
  for (const [ev, pid] of midN) {
    const r = runN(ev, pid);
    assert.equal(r.status, 'rejected', '★ 붙은 기호에서 잘린 인용 통과: ' + ev);
    assert.equal(r.reason, 'mid-word', ev);
    assert.deepEqual(r.grounding, [], ev);
  }
  const okN = [
    ['a T-value of −2.5 or lower and serum sodium', 'n1', 'exact'],   // 부호까지
    ['<3.0 mmol/L in fasting adults.', 'n1', 'exact'],                 // <3.0 mg 전체(비교 기호부터)
    ['diluted at a ratio 1:1000 for the IM route', 'n2', 'exact'],     // ratio 1:1000 전체
    ['the dose is 0.01 mg/kg in children.', 'n2', 'exact'],           // 단위 전체
    ['Repeat every 3–5 minutes; mortality fell to 12% overall', 'n3', 'exact'],
    ['(−2.5) in the treated arm.', 'n3', 'exact'],                 // (−2.5) 전체
    ['and the mean change was (−2.5)', 'n3', 'exact'],              // 괄호 뒤 끝
    ['aged ≥75 years with a baseline score of +2 or higher', 'n4', 'exact'],
    ['a core temperature of 38.5°C or higher.', 'n5', 'exact'],
    ['or higher. The median age at entry was 65', 'n5', 'exact'],      // 문단이 수로 끝남
    ['Fever was defined as a core temperature of 38.5°C', 'n5', 'exact']
  ];
  for (const [ev, pid, how] of okN) {
    const r = runN(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기: ' + ev + ' ' + r.reason);
    assert.equal(r.how, how, ev);
    assert.ok(PN.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리: ' + ev);
  }
  // 문장이 수로 끝남(마침표 앞) — 다른 문단에 넣어 본다
  const PE = [{ paraId: 'e1', pageNo: 1, text: 'The median age at entry was 65. Follow-up lasted 28 days in all centres.' }];
  const e = G.groundQuiz(PE, { questions: [{ stem: 'S?', answer: 'A', evidence: 'The median age at entry was 65', evidenceParaId: 'e1',
    options: opts(L5, ['a', 'b', 'c', 'd', 'e']), explanation: { tr: '해설.' } }] }, { withSrc: false }).questions[0];
  assert.deepEqual([e.status, e.how], ['verified', 'exact']);
  // 15-2c 덧붙임 — 부호·비교 뒤 공백 한 칸 · 빼기로 쓴 en 대시 · 공백 범위 · ٪ · 수 뒤 공백 한 칸 뒤 % · 수 사이 ^
  const PS = [
    { paraId: 's1', pageNo: 12, text: 'Treat when calcium is < 2.1 mmol/L or the score is ≥ 12 points in older adults.' },
    { paraId: 's2', pageNo: 12, text: 'The mean shift was –1.8 units, and doses of 4 – 8 mg were used in most wards.' },
    { paraId: 's3', pageNo: 13, text: 'انخفضت المضاعفات إلى ٢٥٪ بعد العلاج المبكر.' },
    { paraId: 's4', pageNo: 13, text: 'Across all sites the relapse rate was 18 % after the first year.' },
    { paraId: 's5', pageNo: 14, text: 'White cells rose above 11 x 10^9/L in a third of the enrolled children.' },
    { paraId: 's6', pageNo: 14, text: 'Several were withdrawn — 7 children left the study before week four.' }
  ];
  const runS = (ev, pid) => G.groundQuiz(PS, { questions: [{ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, ['the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } }] }, { withSrc: true }).questions[0];
  const AS = PS[2].text;
  const midS = [
    ['2.1 mmol/L or the score is', 's1'],                              // ★ < 2.1 → 2.1(공백 한 칸 뒤 비교)
    ['12 points in older adults.', 's1'],                              // ★ ≥ 12 → 12
    ['1.8 units, and doses of 4', 's2'],                               // ★ –1.8 → 1.8(빼기로 쓴 en 대시)
    ['8 mg were used in most wards.', 's2'],                           // ★ 4 – 8 → 8(공백 범위)
    [AS.slice(0, AS.indexOf('٪')), 's3'],                         // ★ ٢٥٪ → ٢٥(٪ 앞 끝)
    ['Across all sites the relapse rate was 18', 's4'],                // ★ 18 % → 18(공백 한 칸 뒤 %)
    ['White cells rose above 11 x 10', 's5'],                          // ★ 10^9 → 10
    ['9/L in a third of the enrolled children.', 's5'],                // ★ 10^9 → 9
    ['7 children left the study before week four.', 's6']              // 대가 — 문장 가운데 대시 뒤 수로 시작하는 정당 인용도 폐기
  ];
  for (const [ev, pid] of midS) {
    const r = runS(ev, pid);
    assert.equal(r.status, 'rejected', '★ 붙은 기호(덧붙임)에서 잘린 인용 통과: ' + ev);
    assert.equal(r.reason, 'mid-word', ev);
  }
  const okS = [
    ['calcium is < 2.1 mmol/L or the score is ≥ 12 points', 's1'],    // 기호까지
    ['< 2.1 mmol/L or the score is ≥ 12 points', 's1'],               // 비교 기호부터
    ['The mean shift was –1.8 units', 's2'],                         // 부호까지
    ['–1.8 units, and doses of 4 – 8 mg were used', 's2'],        // 부호부터 · 범위 전체
    [AS.slice(0, AS.indexOf('بعد') - 1), 's3'],              // ٪ 까지
    ['Across all sites the relapse rate was 18 % after', 's4'],        // 공백 % 까지
    ['White cells rose above 11 x 10^9/L in a third', 's5'],           // ^ 까지
    ['Several were withdrawn — 7 children left', 's6'],              // 대시 앞에서 시작
    ['in a third of the enrolled children.', 's5']                     // 낱말 뒤 경계
  ];
  for (const [ev, pid] of okS) {
    const r = runS(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기(덧붙임): ' + ev + ' ' + r.reason);
    assert.equal(r.how, 'exact', ev);
    assert.ok(PS.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리: ' + ev);
  }
  // 15-2d(15-2cR #1–#4) — 숫자 표현 덩어리 한 규칙: 시작·끝 대칭 · 공백 범위 끝 · × 가수·지수 · 공백 비율 · 기호 앞 글자면 붙이지 않음
  const PD = [
    { paraId: 'd1', pageNo: 15, text: 'Give the infusion again 15 – 30 minutes later, then taper over 2 - 4 weeks in stable adults.' },
    { paraId: 'd2', pageNo: 15, text: 'Lymphocytes dropped below 0.8 × 10^9/L in most, and blasts stayed under 4 x 10^9/L in the rest of the cohort.' },
    { paraId: 'd3', pageNo: 16, text: 'Rinse with the 1 : 200 solution twice, and repeat after 3—5 days if the wound is still wet.' },
    { paraId: 'd4', pageNo: 16, text: 'A urine pH<6.2 favoured stones, and the ward—9 cases were reviewed by the renal team.' }
  ];
  const runD = (ev, pid) => G.groundQuiz(PD, { questions: [{ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, ['the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } }] }, { withSrc: true }).questions[0];
  const midD = [
    ['Give the infusion again 15', 'd1'],                              // ★ 15 – 30 → …15(공백 범위 끝 — 15-2cR #1)
    ['Give the infusion again 15 –', 'd1'],                        // 대시까지 끝
    ['minutes later, then taper over 2', 'd1'],                        // ★ 2 - 4 → …2(ASCII 공백 범위 끝)
    ['10^9/L in most, and blasts stayed under', 'd2'],                 // ★ 0.8 × 10^9 → 10^9…(× 앞 가수 뺌 — 15-2cR #2)
    ['Lymphocytes dropped below 0.8', 'd2'],                           // ★ × 10^9 뺀 끝 …0.8(15-2cR #3)
    ['10^9/L in the rest of the cohort.', 'd2'],                       // ASCII x 가수 뺌
    ['200 solution twice, and repeat after', 'd3'],                    // 1 : 200 → 200(공백 비율)
    ['solution twice, and repeat after 3', 'd3']                       // ★ 3—5 → …3(수 사이 em 대시 끝 — 15-2cR Y4)
  ];
  for (const [ev, pid] of midD) {
    const r = runD(ev, pid);
    assert.equal(r.status, 'rejected', '★ 숫자 덩어리 안에서 잘린 인용 통과: ' + ev);
    assert.equal(r.reason, 'mid-word', ev);
  }
  const okD = [
    ['Give the infusion again 15 – 30 minutes later', 'd1'],        // 범위 전체
    ['then taper over 2 - 4 weeks in stable adults.', 'd1'],
    ['Lymphocytes dropped below 0.8 × 10^9/L in most', 'd2'],       // × 덩어리 전체
    ['blasts stayed under 4 x 10^9/L in the rest', 'd2'],
    ['Rinse with the 1 : 200 solution twice', 'd3'],                   // 공백 비율 전체
    ['repeat after 3—5 days if the wound is still wet.', 'd3'],
    ['6.2 favoured stones, and the ward', 'd4'],                       // ★ 기호 앞이 글자(pH<) — 부호로 붙이지 않음(15-2cR Y3)
    ['9 cases were reviewed by the renal team.', 'd4']                 // ward—9 — 글자 바로 뒤 대시는 부호가 아님
  ];
  for (const [ev, pid] of okD) {
    const r = runD(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기(15-2d): ' + ev + ' ' + r.reason);
    assert.equal(r.how, 'exact', ev);
    assert.ok(PD.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리: ' + ev);
  }
  // 15-2e(15-2dR #1–#4) — 원문 언어 공통 표기: 프랑스어 천 단위(NBSP류 + 세 자리) · 물결 범위 · 전각 숫자 · 음수 지수 · 위첨자 덩어리
  const NB = String.fromCharCode(0xA0), NNB = String.fromCharCode(0x202F), THIN = String.fromCharCode(0x2009);
  const PE2 = [
    { paraId: 'f1', pageNo: 17, text: 'Les plaquettes sont a 230' + NNB + '000/mm3 chez les adultes, puis 4' + NB + '500 doses et 7' + THIN + '250 tests.' },
    { paraId: 'f2', pageNo: 17, text: 'Les groupes recevaient 5 100 et 200 mg, et le lot 7' + NB + '2345 a ete retire du marche en mars.' },
    { paraId: 'k1', pageNo: 18, text: '중등도 폐렴의 성인 환자에게 항생제를 4~6일 동안 투여한다. 검사실 정상 범위는 136～146 mEq/L 이며 이보다 낮으면 저나트륨혈증이다.' },
    { paraId: 'w1', pageNo: 18, text: 'Give ３～５ tablets daily for the first week only in frail adults.' },
    { paraId: 'x1', pageNo: 19, text: 'The rate constant was 3 × 10⁻⁸ per second and 2 × 10^-5 per minute in vitro.' },
    { paraId: 'x2', pageNo: 19, text: 'Colonies grew from 10³–10⁴ per plate in the first culture series.' },
    // `[다듬기 5 — 15-2eR W2·W4]` 물결 대시 〜(U+301C)·`^+` 지수 — 지우면 살아남던 변이를 잡는 꼴
    { paraId: 'k2', pageNo: 20, text: '편두통이 있는 성인 환자의 두통 발작은 보통 3〜4시간 지속되며 대개 저절로 가라앉는다.' },
    { paraId: 'x3', pageNo: 20, text: 'In the treated group the colony counts reached 10^+3 per plate after the second day of culture.' }
  ];
  const runE = (ev, pid) => G.groundQuiz(PE2, { questions: [{ stem: 'Synthetic ' + ev.slice(0, 12) + '?', answer: 'A', evidence: ev, evidenceParaId: pid,
    options: opts(L5, ['the right choice', 'other b', 'other c', 'other d', 'other e']), explanation: { tr: '해설.', src: 'Explanation.' } }] }, { withSrc: true }).questions[0];
  const midE = [
    ['Les plaquettes sont a 230', 'f1'],                                    // ★ 230 000 → …230(좁은 NBSP 천 단위 끝)
    ['000/mm3 chez les adultes, puis', 'f1'],                              // ★ 230 000 → 000…(시작)
    ['500 doses et 7' + THIN + '250 tests.', 'f1'],                        // ★ 4 500 → 500…(NBSP)
    ['adultes, puis 4' + NB + '500 doses et 7', 'f1'],                     // 7 250 → …7(얇은 공백 천 단위 끝)
    ['중등도 폐렴의 성인 환자에게 항생제를 4', 'k1'],                       // ★ 4~6일 → …4(물결 범위 끝)
    ['동안 투여한다. 검사실 정상 범위는 136', 'k1'],                        // ★ 136～146 → …136(전각 물결 끝)
    ['146 mEq/L 이며 이보다 낮으면 저나트륨혈증이다.', 'k1'],               // ★ 136～146 → 146…(전각 물결 시작)
    ['5 tablets daily for the first week', 'w1'],                          // 전각 숫자 ３～５ → 5…
    ['The rate constant was 3 × 10', 'x1'],                            // ★ 10⁻⁸ → …10(위첨자 빼기 지수 끝)
    ['⁻⁸ per second and 2 × 10^-5', 'x1'],                   // ★ ⁻⁸…(지수 가운데 시작)
    ['per second and 2 × 10', 'x1'],                                   // ★ 10^-5 → …10(캐럿 빼기 끝)
    ['-5 per minute in vitro.', 'x1'],                                     // ★ 10^-5 → -5…(캐럿 뒤 시작)
    ['Colonies grew from 10³', 'x2'],                                  // ★ 10³–10⁴ → …10³(위첨자 덩어리 — 15-2dR Z3)
    ['편두통이 있는 성인 환자의 두통 발작은 보통 3', 'k2'],                  // ★ 3〜4시간 → …3(물결 대시 끝 — W2)
    ['4시간 지속되며 대개 저절로 가라앉는다.', 'k2'],                        // 3〜4 → 4…(물결 대시 뒤 시작)
    ['the colony counts reached 10', 'x3'],                                // ★ 10^+3 → …10(`^+` 지수 끝 — W4)
    ['3 per plate after the second day of culture.', 'x3']                 // 10^+3 → 3…(지수 가운데 시작)
  ];
  for (const [ev, pid] of midE) {
    const r = runE(ev, pid);
    assert.equal(r.status, 'rejected', '★ 15-2e 덩어리 안에서 잘린 인용 통과: ' + ev);
    assert.equal(r.reason, 'mid-word', ev);
  }
  const okE = [
    ['sont a 230' + NNB + '000/mm3 chez les adultes', 'f1'],                // 덩어리 전체
    ['puis 4' + NB + '500 doses et 7' + THIN + '250 tests.', 'f1'],
    ['100 et 200 mg, et le lot 7', 'f2'],                                  // ★ 보통 공백 + 세 자리는 잇지 않음(나열 `5 100`)
    ['2345 a ete retire du marche en mars.', 'f2'],                        // ★ NBSP + 네 자리는 잇지 않음(정확히 세 자리)
    ['성인 환자에게 항생제를 4~6일 동안 투여한다.', 'k1'],                  // 물결 범위 전체
    ['검사실 정상 범위는 136～146 mEq/L 이며', 'k1'],
    ['Give 3~5 tablets daily for the first', 'w1'],                        // 전각 숫자·물결(NFKC) 전체
    ['The rate constant was', 'x1'],                                       // 덩어리 바로 앞에서 끝
    ['3 × 10⁻⁸ per second and', 'x1'],                       // 지수 덩어리 전체
    ['per second and 2 × 10^-5 per minute', 'x1'],
    ['per minute in vitro.', 'x1'],                                        // 덩어리 바로 뒤에서 시작
    ['Colonies grew from 10³–10⁴ per plate', 'x2'],
    ['성인 환자의 두통 발작은 보통 3〜4시간 지속되며', 'k2'],                           // 물결 대시 덩어리 전체
    ['the colony counts reached 10^+3 per plate', 'x3']                    // `^+` 지수 덩어리 전체
  ];
  for (const [ev, pid] of okE) {
    const r = runE(ev, pid);
    assert.equal(r.status, 'verified', '정당한 인용 폐기(15-2e): ' + ev + ' ' + r.reason);
    assert.ok(PE2.find((p) => p.paraId === pid).text.includes(r.evidence), '저장 인용은 원문 그 자리: ' + ev);
  }
  // 주장한 문단에는 낱말 가운데 자리만 있고 다른 문단에 경계 맞는 자리가 있으면 그 문단(교정)
  const PX = [{ paraId: 'x1', pageNo: 1, text: 'Most atypical reactions were rare in older groups.' }, { paraId: 'x2', pageNo: 2, text: 'Only typical reactions were rare in older groups.' }];
  const x = G.groundQuiz(PX, { questions: [{ stem: 'S?', answer: 'A', evidence: 'typical reactions were rare in older', evidenceParaId: 'x1',
    options: opts(L5, ['a', 'b', 'c', 'd', 'e']), explanation: { tr: '해설.' } }] }, { withSrc: false }).questions[0];
  assert.deepEqual([x.status, x.paraIds, x.fixed], ['verified', ['x2'], true]);
  assert.equal(G.REASON.MID_WORD, 'mid-word');
});

/* ══ Q10 판본 ═════════════════════════════════════════ */

test('Q10 판본 — 기존 판본 그대로 · QUIZ 1 · 출제 스키마는 따로', () => {
  assert.equal(P.PROMPT_VERSION, 3);
  assert.equal(P.TERM_PROMPT_VERSION, 1);
  assert.equal(P.SUMMARY_PROMPT_VERSION, 1);
  assert.equal(P.OUTLINE_PROMPT_VERSION, 1);
  assert.equal(P.EXPLAIN_PROMPT_VERSION, 1);
  assert.equal(P.QUIZ_PROMPT_VERSION, 1);
  assert.equal(REVIEW.PROMPT_VERSION, 1);
  assert.notEqual(P.QUIZ_SCHEMA, P.TRANSLATE_SCHEMA);
  assert.deepEqual(P.QUIZ_PARSE_SCHEMA.required, ['questions']);
  assert.equal(P.QUIZ_PARSE_SCHEMA.properties.questions.items.required, undefined, '해석 스키마는 문항 필수 없음 — 빠진 문항도 폐기로 센다');
  assert.deepEqual(P.QUIZ_SCHEMA.properties.questions.items.required, ['stem', 'options', 'answer', 'evidence', 'evidenceParaId', 'explanation']);
});
