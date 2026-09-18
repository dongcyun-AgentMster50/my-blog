/* ============================================================
   MedReader — 줄 재구성 단위 테스트 (spec 4-11 표의 L1~L11)

   실행: node --test apps/medreader/tests/
   외부 의존성 없음. 픽스처는 pdf.js items 형태를 그대로 흉내 낸다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeItems, clusterLines, splitRuns, joinText, lineBBox
} from '../js/text/lines.js';
import { buildPageLayout } from '../js/text/layout.js';

/* pdf.js getTextContent().items 한 개를 만든다.
   transform = [a,b,c,d,e,f], 회전이 없으면 a=d=fontSize, b=c=0, e=x, f=baseline */
function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 10 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  const r = o.rot || 0;
  const cos = Math.cos(r), sin = Math.sin(r);
  return {
    str: str,
    dir: 'ltr',
    transform: [cos * fs, sin * fs, -sin * fs, cos * fs, x, y],
    width: w,
    height: fs,
    fontName: o.fontName || 'g_d0_f1',
    hasEOL: !!o.hasEOL
  };
}

function lineOf(rawItems) {
  const { items } = normalizeItems(rawItems, {});
  const lines = clusterLines(items);
  for (const l of lines) splitRuns(l);
  return lines;
}

test('L1 같은 baseline(±0.5pt)의 아이템 5개 → 줄 1개, X 순서대로 결합', () => {
  // 입력 순서를 일부러 뒤섞어 X 정렬이 동작하는지 함께 본다
  const lines = lineOf([
    item('one', 123, 699.6, { width: 16 }),
    item('Choose', 72, 700, { width: 30 }),
    item('response', 165, 700, { width: 40 }),
    item('the', 105, 700.4, { width: 15 }),
    item('best', 142, 700, { width: 20 })
  ]);
  assert.equal(lines.length, 1);
  assert.equal(joinText(lines[0]), 'Choose the one best response');
});

test('L2 baseline 차 = 0.3×fontSize 인 두 아이템 → 같은 줄', () => {
  const lines = lineOf([
    item('alpha', 72, 700, { width: 25 }),
    item('beta', 100, 697, { width: 20 })   // dy = 3 <= tol 3.5
  ]);
  assert.equal(lines.length, 1);
});

test('L3 baseline 차 = 0.5×fontSize 인 두 본문 아이템 → 다른 줄', () => {
  const lines = lineOf([
    item('alpha', 72, 700, { width: 25 }),
    item('beta', 72, 695, { width: 20 })    // dy = 5 > tol 3.5
  ]);
  assert.equal(lines.length, 2);
});

test('L4 본문 10pt + 6pt 위첨자(baseline +4) → 같은 줄, bbox y1 불변', () => {
  const lines = lineOf([
    item('CO', 72, 700, { width: 12 }),
    item('2', 84, 704, { fontSize: 6, width: 3 })
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].items.length, 2);
  const bb = lineBBox(lines[0]);
  // 본문 아이템만으로 계산한 y1 = 700 + 0.8*10 = 708.
  // 위첨자를 포함했다면 704 + 0.8*6 = 708.8 이 되어 커진다.
  assert.equal(bb.y1, 708);
  assert.equal(joinText(lines[0]), 'CO2');
});

test('L5 20pt 제목 두 줄, 행간 22pt → 두 줄 (Y 허용 상한 6pt)', () => {
  const lines = lineOf([
    item('Principles of Internal', 72, 700, { fontSize: 20, width: 200 }),
    item('Medicine', 72, 678, { fontSize: 20, width: 100 })
  ]);
  assert.equal(lines.length, 2);
});

test('L5b [Review 추가] 40pt 제목 두 줄, 행간 13pt → 두 줄 (Y 허용 상한 6pt가 실제로 작동)', () => {
  // L5(20pt·행간 22pt)는 0.35×20 = 7pt 로도 갈라지므로 상한 6pt 를 검증하지 못한다.
  // 40pt 에서 0.35×40 = 14pt > 13pt 행간이므로, 상한이 없으면 두 줄이 하나로 합쳐진다.
  const lines = lineOf([
    item('Principles of Internal', 72, 700, { fontSize: 40, width: 400 }),
    item('Medicine Nineteenth', 72, 687, { fontSize: 40, width: 380 })
  ]);
  assert.equal(lines.length, 2);
});

test('L6 "poses the least" / "cardiovascular risk" → 줄 2개, 문단은 공백으로 이어짐', () => {
  const layout = buildPageLayout([
    item('poses the least', 72, 700, { width: 70 }),
    item('cardiovascular risk', 72, 688, { width: 90 })
  ], { pageNo: 1, width: 612, height: 792 });
  const body = layout.lines.filter(l => l.role !== 'rotated');
  assert.equal(body.length, 2);
  assert.equal(layout.paragraphs.length, 1);
  assert.equal(layout.paragraphs[0].text, 'poses the least cardiovascular risk');
  assert.ok(!layout.paragraphs[0].text.includes('leastcardiovascular'));
});

test('L7 한 줄 안 gap = 0.1×fontSize → 공백 없음', () => {
  const lines = lineOf([
    item('Clin', 72, 700, { width: 20 }),
    item('ical', 93, 700, { width: 18 })     // gap = 1 < 1.5
  ]);
  assert.equal(joinText(lines[0]), 'Clinical');
});

test('L8 한 줄 안 gap = 0.3×fontSize → 공백 삽입', () => {
  const lines = lineOf([
    item('Clin', 72, 700, { width: 20 }),
    item('ical', 95, 700, { width: 18 })     // gap = 3 > 1.5
  ]);
  assert.equal(joinText(lines[0]), 'Clin ical');
});

test('L9 pdf.js식 공백 아이템이 있어도 공백은 하나만', () => {
  const lines = lineOf([
    item('poses', 72, 700, { width: 25 }),
    item(' ', 97, 700, { width: 3 }),
    item('the', 102, 700, { width: 15 })
  ]);
  assert.equal(joinText(lines[0]), 'poses the');
});

test('L10 동일 문자열이 gap = −0.9×fontSize 로 겹치면 하나만 남는다', () => {
  const lines = lineOf([
    item('bold', 72, 700, { width: 20 }),
    item('bold', 83, 700, { width: 20 })     // gap = -9 = -0.9 × 10
  ]);
  assert.equal(joinText(lines[0]), 'bold');
});

test('L11 회전 아이템(transform b≠0) → role rotated, 본문·문단에서 제외', () => {
  const layout = buildPageLayout([
    item('Body text of the page continues here', 72, 700, { width: 200 }),
    item('Second body line of the page', 72, 688, { width: 180 }),
    item('Y axis label', 40, 400, { rot: Math.PI / 2, width: 60 })
  ], { pageNo: 1, width: 612, height: 792 });

  const rot = layout.lines.filter(l => l.role === 'rotated');
  assert.equal(rot.length, 1);
  assert.equal(rot[0].text, 'Y axis label');
  for (const p of layout.paragraphs) assert.ok(!p.text.includes('Y axis label'));
  for (const l of layout.lines) {
    if (l.role !== 'rotated') assert.ok(!l.text.includes('Y axis label'));
  }
});
