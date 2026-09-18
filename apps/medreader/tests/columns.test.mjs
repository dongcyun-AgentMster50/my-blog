/* ============================================================
   MedReader — 다단 컬럼·읽기 순서 단위 테스트 (spec 4-11 표의 C1~C4)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPageLayout } from '../js/text/layout.js';

const W = 612;   // US Letter 포인트
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

// 좌 컬럼 72~272, 우 컬럼 340~540 → 거터 중심 306 = 0.5W
function twoColumnItems(rows) {
  const items = [];
  for (let i = 0; i < rows; i++) {
    const y = 700 - 12 * i;
    items.push(item('left body line number ' + (i + 1), 72, y, { width: 200 }));
    items.push(item('right body line number ' + (i + 1), 340, y, { width: 200 }));
  }
  return items;
}

function textsOf(layout) {
  return layout.lines.filter(l => l.role !== 'rotated').map(l => l.text);
}

test('C1 2단 합성 페이지(좌 20줄·우 20줄, 거터 0.5W) → count=2, 좌 20줄 → 우 20줄', () => {
  const layout = buildPageLayout(twoColumnItems(20), { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 2);
  assert.equal(Math.round(layout.columns.gutters[0]), 306);

  const t = textsOf(layout);
  assert.equal(t.length, 40);
  for (let i = 0; i < 20; i++) assert.equal(t[i], 'left body line number ' + (i + 1));
  for (let i = 0; i < 20; i++) assert.equal(t[20 + i], 'right body line number ' + (i + 1));
});

test('C2 C1 + 중앙에 폭 0.8W 제목 1줄 → 제목 위 좌·우 → 제목 → 제목 아래 좌·우', () => {
  const items = twoColumnItems(20);
  // 9번째 행(y=604)과 10번째 행(y=592) 사이에 폭 490pt(0.8W) 제목
  items.push(item('A WIDE SPANNING HEADING ACROSS THE PAGE', 61, 598, { fontSize: 14, width: 490 }));
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 2);

  const t = textsOf(layout);
  assert.equal(t.length, 41);
  // 제목 위: 좌 9줄 → 우 9줄
  for (let i = 0; i < 9; i++) assert.equal(t[i], 'left body line number ' + (i + 1));
  for (let i = 0; i < 9; i++) assert.equal(t[9 + i], 'right body line number ' + (i + 1));
  // 제목
  assert.equal(t[18], 'A WIDE SPANNING HEADING ACROSS THE PAGE');
  // 제목 아래: 좌 11줄 → 우 11줄
  for (let i = 0; i < 11; i++) assert.equal(t[19 + i], 'left body line number ' + (i + 10));
  for (let i = 0; i < 11; i++) assert.equal(t[30 + i], 'right body line number ' + (i + 10));
});

test('C3 1단 페이지 + 4열 표 6줄 → count=1 (표를 2단으로 오판하지 않는다)', () => {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push(item('single column body line that runs wide ' + (i + 1), 72, 700 - 12 * i, { width: 400 }));
  }
  const rows = [
    ['Acetylsalicylic acid', '650', 'PO', 'q4h'],
    ['Ibuprofen', '400', 'PO', 'q6h'],
    ['Naproxen', '250', 'PO', 'q12h'],
    ['Acetaminophen', '500', 'PO', 'q6h'],
    ['Celecoxib', '200', 'PO', 'q12h'],
    ['Ketorolac', '10', 'PO', 'q6h']
  ];
  const xs = [72, 220, 300, 380];
  const ws = [100, 30, 30, 30];
  for (let r = 0; r < rows.length; r++) {
    const y = 540 - 12 * r;
    for (let c = 0; c < 4; c++) items.push(item(rows[r][c], xs[c], y, { width: ws[c] }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 1);
});

test('C4 줄 7개뿐인 페이지 → count=1 (정보 부족)', () => {
  const items = [];
  for (let i = 0; i < 7; i++) {
    const y = 700 - 12 * i;
    items.push(item('left body line number ' + (i + 1), 72, y, { width: 200 }));
    items.push(item('right body line number ' + (i + 1), 340, y, { width: 200 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 1);
});
