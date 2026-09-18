/* ============================================================
   MedReader — 역할·문단·표 단위 테스트 (spec 4-11 표의 B1~B7, T1~T2)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout } from '../js/text/layout.js';

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
