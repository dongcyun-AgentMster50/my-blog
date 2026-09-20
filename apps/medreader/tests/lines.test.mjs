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

/* ────────────────────────────────────────────────────────
   폭 위생 — spec 4-2 `[수정 2026-09-20]`
   pdf.js 가 주는 item.width 의 2.13% 가 페이지 폭을 넘거나 음수다.
   그 값이 그대로 흐르면 splitRuns 의 gap, 거터 히스토그램, lineBBox 가
   모두 오염된다. 위생은 좌표·폭에만 적용하고 str 은 건드리지 않는다.
   ──────────────────────────────────────────────────────── */

test('L12 w 위생 — 페이지 폭 초과·NaN 은 추정 대체, 음수는 0', () => {
  const raw = [
    item('wide', 72, 700, { width: 9337 }),    // 페이지 폭 612 초과
    item('nanw', 200, 700, { width: NaN }),
    item('negw', 300, 700, { width: -50 })
  ];
  const out = normalizeItems(raw, {}, undefined, { width: 612 });
  const items = out.items;
  assert.equal(items.length, 3);
  // 추정치 = str.length × fontSize × 0.5
  assert.equal(items[0].w, 4 * 10 * 0.5);
  assert.equal(items[1].w, 4 * 10 * 0.5);
  assert.equal(items[2].w, 0);
  // 원본 str 은 건드리지 않는다
  assert.deepEqual(items.map(i => i.str), ['wide', 'nanw', 'negw']);
  // 몇 개를 고쳤는지 셀 수 있어야 한다 (7000쪽에서 이 수가 튀면 새 자료가 더 심하다는 신호)
  assert.equal(out.stats.widthFixed, 3);
  assert.equal(out.stats.widthOverflow, 1);
  assert.equal(out.stats.widthNaN, 1);
  assert.equal(out.stats.widthNegative, 1);
});

test('L12b w 위생 — 페이지 폭을 모르면 초과 판정을 하지 않는다 (음수·NaN 만)', () => {
  const out = normalizeItems([
    item('wide', 72, 700, { width: 9337 }),
    item('nanw', 200, 700, { width: NaN })
  ], {});
  assert.equal(out.items[0].w, 9337);          // 판단 근거가 없으면 건드리지 않는다
  assert.equal(out.items[1].w, 4 * 10 * 0.5);  // NaN 은 페이지 폭 없이도 고친다
  assert.equal(out.stats.widthFixed, 1);
});

test('L13 w 위생 — 깨진 폭이 줄 bbox 를 페이지 밖으로 내보내지 않는다', () => {
  const layout = buildPageLayout([
    item('Acetylsalicylic', 72, 700, { width: 9337 }),
    item('acid', 160, 700, { width: 20 }),
    item('Second body line of the page', 72, 688, { width: 180 })
  ], { pageNo: 1, width: 612, height: 792 });

  for (const l of layout.lines) {
    assert.ok(l.bbox.x1 <= 612 + 1, '줄 bbox 가 페이지 오른쪽 밖으로 나갔다: ' + l.bbox.x1);
    assert.ok(l.bbox.x0 >= -1, '줄 bbox 가 페이지 왼쪽 밖으로 나갔다: ' + l.bbox.x0);
  }
  assert.equal(layout.stats.widthFixed, 1);
});

test('L13b w 위생 — 깨진 폭이 run 분할을 무너뜨리지 않는다', () => {
  // 폭 9337 을 그대로 쓰면 gap = 160 - (72 + 9337) 이 거대한 음수가 되어
  // 두 번째 아이템이 언제나 같은 run 에 붙는다. 실제로는 멀리 떨어진
  // 표 셀 경계(gap = 13 > 1.2 × 10)이므로 run 이 둘로 나뉘어야 한다.
  const { items } = normalizeItems([
    item('Acetylsalicylic', 72, 700, { width: 9337 }),
    item('650', 160, 700, { width: 15 })
  ], {}, undefined, { width: 612 });
  const lines = clusterLines(items);
  const runs = splitRuns(lines[0]);
  assert.equal(runs.length, 2);
});
