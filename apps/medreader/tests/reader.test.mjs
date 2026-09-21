/* ============================================================
   tests/reader.test.mjs — spec 12-4 · 16-F · 6-5 (4단계)

   ★ 이 파일이 지키는 것은 하나다: **화면에 보이는 글자가 문단 텍스트와
     같은가.** 저장본에는 `paragraphs[].text` 가 없고 `fromStored` 가
     `lineIds` + 4-10 하이픈 규칙으로 조립한다(9-2). 리플로우 뷰는 그
     문단을 **줄 단위 span 으로 다시 쪼개** 그리므로, 쪼갠 조각을 다시
     이어 붙이면 원래 문단 텍스트가 **정확히** 나와야 한다.

     그러지 않으면 "cardio- vascular" 처럼 원서에 없는 글자를 읽게 되고,
     5단계 낭독이 읽는 것과 눈에 보이는 것이 어긋난다.

   `js/ui/reader.js` 는 DOM 을 함수 안에서만 만지므로 Node 에서 import 된다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { clampPage, describePage, flowLineIdsOf, FOLD_ROLES } from '../js/ui/reader.js';
import { toStored, fromStored } from '../js/text/store.js';

/* ── 픽스처 — 원서 문장을 레포에 넣지 않는다. 전부 지어낸 문장이다. ── */

function line(id, text, extra) {
  return Object.assign({
    id: id, text: text,
    bbox: { x0: 0, y0: 0, x1: 100, y1: 10 },
    baseline: 0, fontSize: 10, col: 0,
    role: 'body', hyphenJoin: false, paraId: null, regionId: null, runs: []
  }, extra || {});
}

function layoutOf(lines, paragraphs, regions) {
  return {
    pageNo: 45, width: 612, height: 792, algoVersion: 6,
    lines: lines, paragraphs: paragraphs || [], regions: regions || [],
    columns: { count: 1, gutters: [] }, stats: {}
  };
}

/** 문단 하나를 lineIds 로 만든다(text 는 fromStored 가 조립한다). */
function para(id, lineIds, kind) {
  return { id: id, lineIds: lineIds, kind: kind || 'body',
           bbox: { x0: 0, y0: 0, x1: 100, y1: 10 }, continuesNext: false, continuesPrev: false };
}

/** 기술(記述)에서 **화면에 보일 글자**를 만든다 — DOM 이 하는 일을 그대로 흉내낸다. */
function visibleText(block) {
  let out = '';
  for (let i = 0; i < block.lines.length; i++) {
    const ln = block.lines[i];
    // 'hidden' 은 끝의 '-' 를 span.hy 로 감춰 CSS 가 지운다(12-4).
    out += (ln.hyphen === 'hidden' && ln.text.endsWith('-')) ? ln.text.slice(0, -1) : ln.text;
    const last = i === block.lines.length - 1;
    if (!last && ln.hyphen === 'none') out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/* ────────────────────────────────────────────────────────
   R1 — 쪽 번호 클램프
   ──────────────────────────────────────────────────────── */

test('R1 쪽 번호는 1..pageCount 안으로 접힌다 — 어떤 입력에도 던지지 않는다', () => {
  assert.equal(clampPage(1, 729), 1);
  assert.equal(clampPage(45, 729), 45);
  assert.equal(clampPage(729, 729), 729);
  assert.equal(clampPage(730, 729), 729, '범위 밖은 마지막 쪽으로');
  assert.equal(clampPage(0, 729), 1);
  assert.equal(clampPage(-5, 729), 1);
  assert.equal(clampPage('12', 729), 12, '입력창은 문자열을 준다');
  assert.equal(clampPage('abc', 729), 1);
  assert.equal(clampPage(NaN, 729), 1);
  assert.equal(clampPage(null, 729), 1);
  assert.equal(clampPage(12.7, 729), 12);
  // 쪽수를 아직 모르는 문서(pageCount 0) — 위쪽 한계는 두지 않는다.
  assert.equal(clampPage(7000, 0), 7000);
  assert.equal(clampPage(3, undefined), 3);
});

/* ────────────────────────────────────────────────────────
   R2 ★★ 하이픈 — 보이는 글자 == 문단 텍스트
   ──────────────────────────────────────────────────────── */

test('R2 ★★ 보이는 글자가 fromStored 의 문단 텍스트와 정확히 같다 (9-2 · 4-10)', () => {
  // 세 가지가 한 문단에 다 있다:
  //   cardio- + vascular   → 하이픈을 지우고 붙인다(hidden)
  //   methicillin- + resistant → 하이픈을 살려 붙인다(kept, KEEP_HYPHEN_SUFFIXES)
  //   보통 줄바꿈             → 공백(none)
  const lines = [
    line('45:1', 'The patient had cardio-', { paraId: '45:p0' }),
    line('45:2', 'vascular disease and a methicillin-', { paraId: '45:p0' }),
    line('45:3', 'resistant infection of the wound', { paraId: '45:p0' }),
    line('45:4', 'after the second operation.', { paraId: '45:p0' })
  ];
  const stored = toStored(layoutOf(lines, [para('45:p0', ['45:1', '45:2', '45:3', '45:4'])]));
  const layout = fromStored(stored);
  const desc = describePage(layout);

  const paras = desc.blocks.filter((b) => b.type === 'para');
  assert.equal(paras.length, 1);
  assert.equal(paras[0].lines.length, 4, '★ 줄 경계를 잃지 않는다 — 5단계 하이라이트의 앵커다');

  assert.deepEqual(paras[0].lines.map((l) => l.hyphen), ['hidden', 'kept', 'none', 'none']);

  const expected = layout.paragraphs[0].text;
  assert.equal(visibleText(paras[0]), expected,
    '화면 글자가 문단 텍스트와 다르면 원서에 없는 낱말을 읽게 된다');
  assert.ok(expected.includes('cardiovascular'), '하이픈이 지워져 결합됐다');
  assert.ok(expected.includes('methicillin-resistant'), '하이픈이 살아 있다');
});

test('R2b 줄 span 의 텍스트는 **원본 그대로**다 — 시각만 결합한다 (12-4)', () => {
  const lines = [
    line('7:1', 'The patient needed an oper-', { paraId: '7:p0' }),
    line('7:2', 'ation the same night', { paraId: '7:p0' })
  ];
  const desc = describePage(fromStored(toStored(layoutOf(lines, [para('7:p0', ['7:1', '7:2'])]))));
  const b = desc.blocks[0];
  // span.line 에 들어갈 text 는 하이픈을 그대로 갖고 있다(원본 뷰·번역이 쓴다).
  assert.equal(b.lines[0].text, 'The patient needed an oper-');
  assert.equal(b.lines[0].hyphen, 'hidden');
  assert.equal(visibleText(b), 'The patient needed an operation the same night');
});

/* ────────────────────────────────────────────────────────
   R3 — 블록 분류·읽기 순서
   ──────────────────────────────────────────────────────── */

test('R3 문단 kind 가 그대로 넘어온다 — 문항·보기·정답이 구분돼 보인다 (4-9)', () => {
  const lines = [
    line('9:1', 'SECTION I', { paraId: '9:p0', role: 'heading' }),
    line('9:2', 'I-42. Which statement is correct?', { paraId: '9:p1' }),
    line('9:3', 'A. The first option', { paraId: '9:p2' }),
    line('9:4', 'B. The second option', { paraId: '9:p3' }),
    line('9:5', 'The answer is B.', { paraId: '9:p4' })
  ];
  const paras = [
    para('9:p0', ['9:1'], 'heading'), para('9:p1', ['9:2'], 'question'),
    para('9:p2', ['9:3'], 'option'), para('9:p3', ['9:4'], 'option'),
    para('9:p4', ['9:5'], 'answer')
  ];
  const desc = describePage(fromStored(toStored(layoutOf(lines, paras))));
  assert.deepEqual(desc.blocks.map((b) => b.kind),
    ['heading', 'question', 'option', 'option', 'answer']);
  assert.deepEqual(desc.blocks.map((b) => b.type), ['para', 'para', 'para', 'para', 'para']);
});

test('R4 머리말·꼬리말·쪽번호·회전 줄은 접힌 덩어리로 따로 나간다 (4-7 · 12-4)', () => {
  const lines = [
    line('3:1', 'CHAPTER 2  Infectious Disease', { role: 'header' }),
    line('3:2', 'Body text that should be read.', { paraId: '3:p0' }),
    line('3:3', '42', { role: 'pageno' }),
    line('3:4', 'Copyright notice', { role: 'footer' }),
    line('3:5', 'sideways label', { role: 'rotated' })
  ];
  const desc = describePage(fromStored(toStored(layoutOf(lines, [para('3:p0', ['3:2'])]))));

  const folded = desc.blocks.filter((b) => b.type === 'folded');
  assert.equal(folded.length, 1, '접힌 덩어리는 하나로 모은다');
  assert.equal(folded[0].lines.length, 4);
  assert.deepEqual(folded[0].lines.map((l) => l.role), ['header', 'pageno', 'footer', 'rotated']);
  for (const r of folded[0].lines.map((l) => l.role)) assert.ok(FOLD_ROLES.indexOf(r) >= 0);
  // 본문은 그대로 흐름에 남는다.
  assert.equal(desc.blocks[0].type, 'para');
  assert.equal(desc.blocks[0].lines[0].text, 'Body text that should be read.');
  // 접힌 줄은 낭독 대상이 아니다(5단계가 flow 줄만 돈다).
  assert.deepEqual(flowLineIdsOf(desc), ['3:2']);
});

test('R5 표 region 은 자리표시자 한 개로 접히고 region.id 를 들고 간다 (6단계 인계)', () => {
  const lines = [
    line('5:1', 'Before the table.', { paraId: '5:p0' }),
    line('5:2', 'Drug   Dose   Route', { role: 'table', regionId: '5:r0' }),
    line('5:3', 'A      10mg   PO', { role: 'table', regionId: '5:r0' }),
    line('5:4', 'B      20mg   IV', { role: 'table', regionId: '5:r0' }),
    line('5:5', 'After the table.', { paraId: '5:p1' })
  ];
  const regions = [{ id: '5:r0', kind: 'table', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
                     lineIds: ['5:2', '5:3', '5:4'], pageNo: 5 }];
  const desc = describePage(fromStored(toStored(layoutOf(lines,
    [para('5:p0', ['5:1']), para('5:p1', ['5:5'])], regions))));

  assert.deepEqual(desc.blocks.map((b) => b.type), ['para', 'table', 'para'],
    '표는 읽기 순서의 제자리에 들어간다');
  assert.equal(desc.blocks[1].regionId, '5:r0');
  // 표 줄은 낭독 대상이 아니다.
  assert.deepEqual(flowLineIdsOf(desc), ['5:1', '5:5']);
});

test('R6 문단에 속하지 않은 본문 줄도 잃어버리지 않는다', () => {
  const lines = [line('8:1', 'An orphan line with no paragraph.')];
  const desc = describePage(fromStored(toStored(layoutOf(lines, []))));
  assert.equal(desc.blocks.length, 1);
  assert.equal(desc.blocks[0].type, 'para');
  assert.deepEqual(flowLineIdsOf(desc), ['8:1']);
});

test('R7 깨진 입력에도 던지지 않는다 — 리더가 죽는 것보다 덜 보이는 편이 낫다', () => {
  assert.doesNotThrow(() => describePage(null));
  assert.doesNotThrow(() => describePage({}));
  assert.doesNotThrow(() => describePage({ lines: null, paragraphs: null, regions: null }));
  // lineIds 가 가리키는 줄이 사라진 문단
  const desc = describePage({ pageNo: 1, lines: [], paragraphs: [para('1:p0', ['1:9'])], regions: [] });
  assert.deepEqual(desc.blocks, []);
  assert.deepEqual(flowLineIdsOf(desc), []);
  assert.deepEqual(flowLineIdsOf(null), []);
});

test('R8 읽기 순서가 lines 배열의 순서다 (4-5 가 이미 컬럼 순서로 정렬해 두었다)', () => {
  // 2단 페이지: columns.js 가 왼쪽 컬럼 전체 → 오른쪽 컬럼 전체로 정렬해 준다.
  const lines = [
    line('2:1', 'Left column first line.', { paraId: '2:p0', col: 0 }),
    line('2:2', 'Left column second line.', { paraId: '2:p0', col: 0 }),
    line('2:3', 'Right column first line.', { paraId: '2:p1', col: 1 }),
    line('2:4', 'Right column second line.', { paraId: '2:p1', col: 1 })
  ];
  const desc = describePage(fromStored(toStored(layoutOf(lines,
    [para('2:p0', ['2:1', '2:2']), para('2:p1', ['2:3', '2:4'])]))));
  assert.deepEqual(flowLineIdsOf(desc), ['2:1', '2:2', '2:3', '2:4']);
});
