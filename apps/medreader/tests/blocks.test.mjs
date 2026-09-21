/* ============================================================
   MedReader — 역할·문단·표 단위 테스트 (spec 4-11 표의 B1~B7, T1~T2)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout } from '../js/text/layout.js';
import { parseQuestionNumber, parseAnswerStart } from '../js/text/segment.js';

const W = 612;
const H = 792;

function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 10 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  return {
    str: str,
    dir: 'ltr',
    transform: [fs, 0, 0, fs, x, y],
    width: w,
    height: fs,
    fontName: o.fontName || 'g_d0_f1',
    hasEOL: !!o.hasEOL
  };
}

// 기본 본문 줄 n개 (x=72, 폭 400, 행간 12)
function bodyLines(n, startY = 700, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(item('body line number ' + (i + 1) + ' of the running text', 72, startY - 12 * i, { width: 400, ...opts }));
  }
  return out;
}

function roleOf(layout, needle) {
  const l = layout.lines.find(x => x.text.indexOf(needle) === 0);
  return l ? l.role : null;
}

test('B1 상단 "SECTION I INTRODUCTION" + 하단 "23" → header, pageno. 본문에서 제외', () => {
  const items = [
    item('SECTION I INTRODUCTION TO CLINICAL MEDICINE', 72, 770, { fontSize: 9, width: 220 }),
    ...bodyLines(8),
    item('23', 300, 40, { width: 10 })
  ];
  const layout = buildPageLayout(items, { pageNo: 23, width: W, height: H });
  assert.equal(roleOf(layout, 'SECTION I'), 'header');
  assert.equal(roleOf(layout, '23'), 'pageno');
  for (const p of layout.paragraphs) {
    assert.ok(p.text.indexOf('SECTION I') < 0);
    assert.ok(p.text !== '23');
  }
});

test('B2 이웃 페이지에 같은 러닝 헤드(숫자 치환 동일) → header 확정', () => {
  const head = "Harrison's Self-Assessment and Board Review 45";
  const items = [item(head, 72, 770, { fontSize: 9, width: 220 }), ...bodyLines(8)];

  // 이웃 없이: 대문자 비율도 낮고 SECTION/CHAPTER 도 아니므로 header 가 아니다
  const alone = buildPageLayout(items, { pageNo: 45, width: W, height: H });
  assert.notEqual(roleOf(alone, "Harrison's"), 'header');

  // 이웃 페이지에 숫자만 다른 같은 러닝 헤드가 있으면 header 로 확정된다
  const neighbor = {
    pageNo: 46,
    height: H,
    lines: [{ text: "Harrison's Self-Assessment and Board Review 46", role: 'header', baseline: 770 }],
    paragraphs: []
  };
  const withNb = buildPageLayout(items, { pageNo: 45, width: W, height: H, neighborLayouts: [neighbor] });
  assert.equal(roleOf(withNb, "Harrison's"), 'header');
});

test('B3 행간 1.6×Lm 초과 → 문단 분리', () => {
  const items = [
    ...bodyLines(6),                                   // y 700..640, 행간 12 → Lm = 12
    item('a new paragraph begins after a wide gap', 72, 640 - 20.4, { width: 400 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.paragraphs.length, 2);
});

test('B4 들여쓰기 0.8×Fm + 앞 줄 마침표 → 문단 분리', () => {
  const items = [
    ...bodyLines(5),
    item('the previous paragraph ends right here.', 72, 640, { width: 400 }),
    item('an indented first line of the next one', 81, 628, { width: 390 })   // 들여쓰기 9 > 8
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.paragraphs.length, 2);
});

test('B5 들여쓰기 있지만 앞 줄이 "e.g." 로 끝남 → 분리 안 함', () => {
  const items = [
    ...bodyLines(5),
    item('common analgesic agents include e.g.', 72, 640, { width: 400 }),
    item('aspirin and ibuprofen in this table', 81, 628, { width: 390 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.paragraphs.length, 1);
});

test('B6 "12. Which of the following" → kind=question 문단 시작', () => {
  const items = [
    ...bodyLines(4),
    item('12. Which of the following can help reduce errors', 72, 652, { width: 400 }),
    item('in the delivery of health care to patients', 72, 640, { width: 400 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const q = layout.paragraphs.find(p => p.text.indexOf('12.') === 0);
  assert.ok(q, '문항 문단이 있어야 한다');
  assert.equal(q.kind, 'question');
  assert.ok(q.text.indexOf('in the delivery') > 0, '이어지는 줄이 같은 문단에 있어야 한다');
});

test('B7 "A. Checklists to ensure" → kind=option', () => {
  const items = [
    ...bodyLines(4),
    item('12. Which of the following can help reduce errors', 72, 640, { width: 400 }),
    item('A. Checklists to ensure important steps are done', 72, 628, { width: 300 }),
    item('B. Clinician honor code and peer review', 72, 616, { width: 300 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const a = layout.paragraphs.find(p => p.text.indexOf('A.') === 0);
  const b = layout.paragraphs.find(p => p.text.indexOf('B.') === 0);
  assert.ok(a && b);
  assert.equal(a.kind, 'option');
  assert.equal(b.kind, 'option');
});

test('B8 [Review 추가] "N. The answer is X" 는 question 이 아니라 answer', () => {
  // isQuestionStart 와 isAnswerStart 가 둘 다 맞는 문자열이다. 5-3 파서(2단계)가
  // kind='answer' 로 해설 섹션을 찾으므로 판정 순서가 뒤집히면 해설이 문항이 된다.
  for (const [text, kind] of [
    ['1. The answer is A. This patient has an acute coronary', 'answer'],
    ['2. The answers are A and C for the reasons given below', 'answer'],
    ['12. Which of the following can help reduce errors today', 'question']
  ]) {
    const items = [...bodyLines(5), item(text, 72, 640 - 25, { width: 400 })];
    const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
    const p = layout.paragraphs.find(x => x.text.indexOf(text.slice(0, 8)) === 0);
    assert.ok(p, '문단을 찾지 못했다: ' + text);
    assert.equal(p.kind, kind, text);
  }
});

test('B9 [Review 추가] 러닝 헤드 바로 아래 첫 본문 줄을 heading 으로 오판하지 않는다', () => {
  // heading 의 "위쪽 여백" 기준을 직전 줄(역할 무관)으로 잡으면 머리말과의 간격이
  // 항상 1.5×Lm 을 넘어 컬럼 첫 본문 줄이 heading 이 된다(spec 4-11 P4 위반).
  const items = [
    item('SECTION I INTRODUCTION TO CLINICAL MEDICINE', 72, 770, { fontSize: 9, width: 220 }),
    item('the patient was admitted with chest pain', 72, 700, { width: 190 }),
    ...bodyLines(8, 688),
    item('23', 300, 40, { width: 10 })
  ];
  const layout = buildPageLayout(items, { pageNo: 23, width: W, height: H });
  assert.equal(roleOf(layout, 'the patient was admitted'), 'body');
  assert.equal(layout.paragraphs.length, 1);
});

test('T1 4 run × 4줄 열 정렬 → table region 1개, role=table, 문단에 미포함', () => {
  const xs = [72, 220, 300, 380];
  const ws = [100, 30, 30, 30];
  const rows = [
    ['Acetylsalicylic acid', '650', 'PO', 'q4h'],
    ['Ibuprofen', '400', 'PO', 'q6h'],
    ['Naproxen', '250', 'PO', 'q12h'],
    ['Acetaminophen', '500', 'PO', 'q6h']
  ];
  const items = bodyLines(6);
  for (let r = 0; r < rows.length; r++) {
    const y = 628 - 12 * r;
    for (let c = 0; c < 4; c++) items.push(item(rows[r][c], xs[c], y, { width: ws[c] }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });

  assert.equal(layout.regions.length, 1);
  assert.equal(layout.regions[0].kind, 'table');
  assert.equal(layout.regions[0].lineIds.length, 4);
  const tableLines = layout.lines.filter(l => l.role === 'table');
  assert.equal(tableLines.length, 4);
  for (const p of layout.paragraphs) assert.ok(p.text.indexOf('Ibuprofen') < 0);
  // 표 줄의 run 텍스트는 보존되어야 한다(AI 표 재구성용)
  const first = tableLines[0];
  assert.equal(first.runs.length, 4);
  assert.equal(first.runs[0].text, 'Acetylsalicylic acid');
  assert.equal(first.runs[3].text, 'q4h');
});

test('T2 run 2개짜리 줄 1개만 → 표 아님', () => {
  const items = bodyLines(6);
  items.push(item('Left side cell', 72, 628, { width: 70 }));
  items.push(item('Right side cell', 220, 628, { width: 70 }));
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.regions.length, 0);
  assert.equal(layout.lines.filter(l => l.role === 'table').length, 0);
});

/* ── 1c단계 회귀 (spec 4-9 우선순위 수정, 5-3 문항 번호 형식) ───────────── */

// 실측 대상 서적은 문항 번호를 "I-42." 처럼 섹션 로마숫자 + 번호로 쓴다.
// 아래 영어 문장은 형식만 흉내 낸 것이고 원서 문장이 아니다.

test('B10 "I-42. An 18-year-old …"(로마숫자 접두 문항) → kind=question', () => {
  const stem = 'I-42. An 18-year-old student reports three weeks of dry cough';
  const items = [
    ...bodyLines(5),
    item(stem, 72, 652 - 25, { width: 400 }),
    item('and intermittent fevers with no recent travel history', 72, 615, { width: 400 }),
    item('A. Obtain a chest radiograph before any treatment', 72, 603, { width: 300 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const q = layout.paragraphs.find(p => p.text.indexOf('I-42.') === 0);
  assert.ok(q, '문항 문단이 있어야 한다');
  assert.equal(q.kind, 'question');
});

test('B11 "IV-62. The answer is C. (Chap. 42)" → kind=answer', () => {
  const text = 'IV-62. The answer is C. (Chap. 42)';
  const items = [
    ...bodyLines(5),
    item(text, 72, 652 - 25, { width: 300 }),
    item('and the remaining choices do not explain the findings', 72, 615, { width: 400 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const a = layout.paragraphs.find(p => p.text.indexOf('IV-62.') === 0);
  assert.ok(a, '정답 문단이 있어야 한다');
  assert.equal(a.kind, 'answer');
});

test('B12 "A. Primary"(짧고 마침표 없어 heading 규칙에 걸리는 보기) → kind=option', () => {
  const items = [
    ...bodyLines(5),
    item('A. Primary', 72, 652 - 25, { width: 60 }),          // 위 여백 25 > 1.5×Lm(18)
    item('B. Secondary to an underlying systemic disorder', 72, 615, { width: 300 }),
    item('C. Unrelated to the exposure described above', 72, 603, { width: 300 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const a = layout.paragraphs.find(p => p.text === 'A. Primary');
  assert.ok(a, '"A. Primary" 문단이 있어야 한다');
  assert.equal(a.kind, 'option');
});

test('B13 "SECTION I INTRODUCTION TO CLINICAL MEDICINE"(진짜 제목) → kind=heading', () => {
  // 우선순위 변경의 오탐 가드: 문항·보기 패턴이 없는 제목은 그대로 heading 이어야 한다.
  const items = [
    ...bodyLines(5),
    item('SECTION I INTRODUCTION TO CLINICAL MEDICINE', 72, 627, { fontSize: 13, width: 300 }),
    ...bodyLines(4, 610)
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const h = layout.paragraphs.find(p => p.text.indexOf('SECTION I') === 0);
  assert.ok(h, '제목 문단이 있어야 한다');
  assert.equal(h.kind, 'heading');
});

test('B14 "12. Which of the following"(로마숫자 없는 기존 형태) → kind=question 유지', () => {
  const items = [
    ...bodyLines(4),
    item('12. Which finding best explains the laboratory results', 72, 652, { width: 400 }),
    item('observed in this previously healthy adult patient', 72, 640, { width: 400 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  const q = layout.paragraphs.find(p => p.text.indexOf('12.') === 0);
  assert.ok(q, '문항 문단이 있어야 한다');
  assert.equal(q.kind, 'question');
});

test('B15 parseQuestionNumber — 섹션과 번호를 나눠 돌려준다 (spec 5-3, 5절 파서용)', () => {
  assert.deepEqual(parseQuestionNumber('IV-62. A previously healthy woman is seen in clinic'),
    { section: 'IV', number: 62 });
  assert.deepEqual(parseQuestionNumber('12. Which laboratory value best supports the diagnosis'),
    { section: null, number: 12 });
  assert.equal(parseQuestionNumber('Hello.'), null);
  assert.equal(parseQuestionNumber(null), null);
  // 정답 문단도 문항 정규식의 부분집합이므로 번호는 읽힌다(kind 는 answer 가 우선).
  assert.deepEqual(parseQuestionNumber('IV-62. The answer is C. (Chap. 42)'),
    { section: 'IV', number: 62 });
});

test('B16 parseAnswerStart — 섹션·번호·정답 글자들 (spec 5-3)', () => {
  assert.deepEqual(parseAnswerStart('IV-62. The answer is C. (Chap. 42)'),
    { section: 'IV', number: 62, letters: ['C'] });
  assert.deepEqual(parseAnswerStart('7. The answers are B and D. (Chap. 9)'),
    { section: null, number: 7, letters: ['B', 'D'] });
  assert.equal(parseAnswerStart('12. Which of the following is most likely'), null);
});

/* ── 1d단계 회귀 (spec 4-7 짧은 줄 규칙의 문항·보기·정답 가드) ───────────── */

// 4-7 의 짧은 줄 규칙은 "짧다 + 종결 부호 없다 + 위 여백이 크다"는 약한 신호 셋뿐이다.
// 문항 stem 첫 줄과 보기가 정확히 그 모양이라 heading 으로 새고, 4-9 의 newParagraph 가
// prev.role === 'heading' 으로 다음 줄을 떼어내 stem 이 두 문단으로 쪼개졌다.
// 아래 영어 문장은 형식만 흉내 낸 것이고 원서 문장이 아니다.

test('B17 문항 stem 첫 줄(짧고·마침표 없고·위 여백 큼) → role=body, 다음 줄이 같은 문단', () => {
  const stem = 'I-88. A 52-year-old presents with';   // 33자, 종결 부호 없음
  const items = [
    ...bodyLines(5),                                   // y 700..652, Lm = 12
    item(stem, 72, 627, { width: 300 }),               // 위 여백 25 > 1.5×Lm(18)
    item('sudden shortness of breath after a long flight', 72, 615, { width: 400 }),
    item('A. Obtain a ventilation perfusion scan right away', 72, 603, { width: 300 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'I-88.'), 'body', '문항 stem 은 heading 이 아니다');
  const q = layout.paragraphs.find(p => p.text.indexOf('I-88.') === 0);
  assert.ok(q, '문항 문단이 있어야 한다');
  assert.equal(q.kind, 'question');
  assert.ok(q.lineIds.length >= 2, 'stem 다음 줄이 같은 문단에 남아야 한다 (줄 ' + q.lineIds.length + '개)');
  assert.ok(q.text.indexOf('sudden shortness') > 0, '문단 text 에 다음 줄이 이어져야 한다');
});

test('B18 보기 첫 줄 "A. Primary"(짧고 마침표 없음) → role=body, kind=option', () => {
  const items = [
    ...bodyLines(5),
    item('A. Primary', 72, 627, { width: 60 }),        // 위 여백 25 > 1.5×Lm(18)
    item('B. Secondary to an underlying systemic disorder', 72, 615, { width: 300 }),
    item('C. Unrelated to the exposure described above', 72, 603, { width: 300 })
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'A. Primary'), 'body', '보기 줄은 heading 이 아니다');
  const a = layout.paragraphs.find(p => p.text === 'A. Primary');
  assert.ok(a, '"A. Primary" 문단이 있어야 한다');
  assert.equal(a.kind, 'option');
});

test('B19 큰 폰트 제목은 문항 번호처럼 생겨도 heading 유지 (bigger 경로 불변)', () => {
  // 가드는 약한 신호 경로에만 건다. fontSize >= 1.15×Fm 는 그대로 heading 이다.
  const title = 'I-5. Disorders of the Cardiovascular System';
  const items = [
    ...bodyLines(5),
    item(title, 72, 627, { fontSize: 13, width: 300 }),   // 13 >= 1.15 × 10
    ...bodyLines(4, 610)
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'I-5.'), 'heading');
});

test('B20 번호·글머리 패턴 없는 짧은 제목은 여전히 heading', () => {
  // 가드가 일반 제목을 망가뜨리지 않는다.
  const items = [
    ...bodyLines(5),
    item('Clinical Manifestations', 72, 627, { width: 120 }),   // 위 여백 25 > 18
    ...bodyLines(4, 615)
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'Clinical Manifestations'), 'heading');
  const h = layout.paragraphs.find(p => p.text === 'Clinical Manifestations');
  assert.ok(h, '제목 문단이 있어야 한다');
  assert.equal(h.kind, 'heading');
});

/* ── Review 추가: 4-9 kind 우선순위에 이빨 주기 ─────────────────────────────
   1d 의 role 가드가 들어온 뒤로는 문항·보기 줄이 더 이상 role 'heading' 이
   아니어서, B12·B13 은 paragraphKind 의 순서를 1c 이전(heading 이 맨 앞)으로
   되돌려도 그대로 통과한다(Review 가 의도적 파손으로 확인). 순서 규칙이
   아직 실제로 발동하는 자리는 **bigger 경로로 role='heading' 이 된 줄**뿐이다.
   B21·B22 가 그 자리를 고정한다.                                        */

test('B21 큰 폰트 + 문항 번호 형태 → role=heading 이어도 kind=question (4-9 우선순위)', () => {
  const items = [
    ...bodyLines(5),
    item('I-5. Disorders of the Cardiovascular System', 72, 627, { fontSize: 13, width: 300 }),
    ...bodyLines(4, 610)
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'I-5.'), 'heading', 'bigger 경로는 그대로 heading');
  const p = layout.paragraphs.find(x => x.text.indexOf('I-5.') === 0);
  assert.ok(p, '문단이 있어야 한다');
  assert.equal(p.kind, 'question', 'heading 보다 question 이 먼저다');
});

test('B22 큰 폰트 + 보기 형태 → role=heading 이어도 kind=option (4-9 우선순위)', () => {
  const items = [
    ...bodyLines(5),
    item('A. Disorders of the Respiratory System', 72, 627, { fontSize: 13, width: 300 }),
    ...bodyLines(4, 610)
  ];
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(roleOf(layout, 'A. Disorders'), 'heading', 'bigger 경로는 그대로 heading');
  const p = layout.paragraphs.find(x => x.text.indexOf('A. Disorders') === 0);
  assert.ok(p, '문단이 있어야 한다');
  assert.equal(p.kind, 'option', 'heading 보다 option 이 먼저다');
});

/* ── 1e단계 회귀 (spec 4-8 [신규 2026-09-19] 라벨 가드) ─────────────────────
   보기 라벨("A.") 뒤의 행잡이 들여쓰기가 run 을 둘로 쪼개면 보기 목록이
   표 감지의 최소 조건(runs >= 2, alignedColumns >= 2, block.length >= 3)을
   전부 아슬아슬하게 충족한다. 그러면 보기 줄이 role='table' 이 되어 문단에서
   **사라지고**(파서가 복원할 수 없다) 한 문항의 보기가 찢어진다.
   아래 영어 문장은 형식만 흉내 낸 것이고 원서 문장이 아니다.                */

test('T3 보기 4줄(라벨 run + 행잡이 들여쓰기, 같은 x 정렬) → 표가 아니다', () => {
  const opts = [
    'Increased renal sodium excretion overnight',
    'Reduced hepatic clearance of the drug',
    'Delayed gastric emptying after the meal',
    'Enhanced pulmonary gas exchange at rest'
  ];
  const items = bodyLines(6);                       // y 700..640, Fm=10, Lm=12
  for (let i = 0; i < opts.length; i++) {
    const y = 620 - 12 * i;
    // 라벨 run: x 72..80. 본문 run: x 93 → 간격 13 > 1.2×10 이라 run 이 쪼개진다.
    items.push(item('ABCD'[i] + '.', 72, y, { width: 8 }));
    items.push(item(opts[i], 93, y, { width: 200 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });

  // 조건이 실제로 최소치로 충족되는 상황인지부터 확인한다(가드가 없으면 표가 된다).
  const optLine = layout.lines.find(l => l.text.indexOf('A.') === 0);
  assert.ok(optLine, '보기 줄이 있어야 한다');
  assert.equal(optLine.runs.length, 2, '행잡이 들여쓰기로 run 이 둘이어야 테스트가 의미 있다');

  assert.equal(layout.regions.length, 0, '보기 목록은 표가 아니다');
  for (const l of layout.lines) assert.notEqual(l.role, 'table');
  // 보기 줄은 문단에 남아 있어야 한다(파서가 볼 수 있어야 한다).
  const kinds = layout.paragraphs.filter(p => /^[A-D]\./.test(p.text)).map(p => p.kind);
  assert.equal(kinds.length, 4, '보기 4개가 모두 문단으로 남아야 한다');
  for (const k of kinds) assert.equal(k, 'option');
});

test('T4 첫 run 이 실제 셀 텍스트인 4 run × 4줄 → 여전히 표로 감지', () => {
  // 가드가 진짜 표를 죽이지 않는다는 고정. 첫 run 이 라벨이 아니다.
  const xs = [72, 220, 300, 380];
  const ws = [100, 30, 30, 30];
  const rows = [
    ['Loxifenamide sodium', '250', 'PO', 'q8h'],
    ['Torvasetin calcium', '125', 'IV', 'q12h'],
    ['Belmuridine sulfate', '500', 'PO', 'q6h'],
    ['Cavertrone acetate', '750', 'IM', 'q24h']
  ];
  const items = bodyLines(6);
  for (let r = 0; r < rows.length; r++) {
    // 첫 행을 y=628 에 둔다: 640 과의 간격 12 가 1.5×Lm 미만이라 4-7 의 짧은 줄
    // heading 규칙에 걸리지 않는다(T1 과 같은 배치).
    const y = 628 - 12 * r;
    for (let c = 0; c < 4; c++) items.push(item(rows[r][c], xs[c], y, { width: ws[c] }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });

  assert.equal(layout.regions.length, 1);
  assert.equal(layout.regions[0].kind, 'table');
  assert.equal(layout.lines.filter(l => l.role === 'table').length, 4);
  for (const p of layout.paragraphs) assert.ok(p.text.indexOf('Torvasetin') < 0);
});

test('T5 첫 열이 라벨 전용 run 인 표 → 표로 잡지 않되 줄은 문단에 남는다', () => {
  /* spec 4-8 의 가드 문구("첫 run 의 텍스트가 라벨 자체로만 이루어진 줄")를
     문자 그대로 따르면 이 줄들은 후보에서 빠진다. 셀이 3개 더 있어도 마찬가지다.
     이 자리는 가드의 **비용**이다. 비용을 이 모양으로 받는 이유:
       · 표로 오탐하면 줄이 문단에서 사라져 5절 파서가 복원할 수 없다.
       · 표로 못 잡으면 줄은 문단에 남고(아래 assert), 원본 뷰로도 볼 수 있다.
     즉 두 오류의 손해가 대칭이 아니다. [실측] 729쪽에서 이 비용의 실제 크기는
     0이었다 — TABLE 캡션이 있는 150쪽의 표 감지 수가 101 → 101 로 불변이다. */
  const labels = ['A', 'B', 'C', 'D'];
  const cells = [
    ['Elevated', 'Low', 'Normal'],
    ['Reduced', 'High', 'Normal'],
    ['Normal', 'Low', 'Elevated'],
    ['Reduced', 'Low', 'Reduced']
  ];
  const items = bodyLines(6);
  for (let r = 0; r < labels.length; r++) {
    const y = 620 - 12 * r;
    items.push(item(labels[r] + '.', 72, y, { width: 8 }));
    items.push(item(cells[r][0], 93, y, { width: 50 }));
    items.push(item(cells[r][1], 250, y, { width: 40 }));
    items.push(item(cells[r][2], 380, y, { width: 40 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });

  assert.equal(layout.regions.length, 0, '라벨 전용 첫 run 은 후보에서 빠진다');
  const kept = layout.paragraphs.filter(p => /^[A-D]\./.test(p.text));
  assert.equal(kept.length, 4, '줄이 문단에 남아 파서가 복원할 수 있어야 한다');
  for (const p of kept) assert.equal(p.kind, 'option');
});
