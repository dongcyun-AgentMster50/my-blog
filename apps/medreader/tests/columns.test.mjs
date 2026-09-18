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

test('C5 [Review 추가] 거터에 폭 있는 공백 아이템이 끼어 있어도 2단으로 잡힌다', () => {
  // spec 4-2 는 공백만 있는 아이템을 버리지 않는다. 그 공백이 거터 한가운데에
  // 놓이면 "직전 아이템"과의 간격이 두 조각으로 쪼개져 run 분할 임계를 넘지
  // 못한다 → 좌·우 컬럼이 한 줄로 병합(spec 4-11 P2 위반). splitRuns 가 간격을
  // "직전 비공백 아이템" 기준으로 재는지 고정한다.
  const items = [];
  for (let i = 0; i < 20; i++) {
    const y = 700 - 12 * i;
    items.push(item('left body line number ' + (i + 1), 72, y, { width: 200 }));
    items.push(item('   ', 280, y, { width: 50 }));          // 거터를 채우는 공백 아이템
    items.push(item('right body line number ' + (i + 1), 340, y, { width: 200 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 2);
  const t = textsOf(layout);
  assert.equal(t.length, 40);
  for (const s of t) assert.ok(!/left .* right /.test(s), '좌·우 컬럼이 한 줄로 병합되면 안 된다: ' + s);
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

/* ────────────────────────────────────────────────────────────
   1b단계 회귀 — 실제 원서에서 P2(컬럼 병합)가 전면 실패한 원인 두 가지.
   합성 픽스처의 거터는 spec 예시대로 0.5W 로 넓게 만들어져 있어서 두 결함을
   모두 놓쳤다. 아래 세 케이스는 실측 조판(본문 10pt, 거터 15pt, 좌·우
   baseline 어긋남)을 그대로 옮긴 것이다.

   C6 = 분모 결함만 분리 (거터 25pt → RUN_GAP 2.0 에서도 run 은 쪼개진다)
   C8 = RUN_GAP 결함만 분리 (모든 줄이 같은 baseline → 분모는 영향 없음)
   ──────────────────────────────────────────────────────────── */

test('C6 좌·우 baseline 이 어긋난 2단 문항 페이지(한쪽 컬럼에만 있는 줄이 과반) → count=2', () => {
  // 실측(p343): 본문 54줄 중 거터를 가로지르는 줄은 18줄뿐이고 그 18줄이 전부
  // 거터에서 끊긴다. 분모가 body.length 면 18/54 = 0.33 < 0.55 로 1단이 되고
  // 좌·우 컬럼이 한 줄로 병합된다(spec 4-11 P2 위반).
  // 여기서는 좌 72~281 / 우 306~515, 거터 25pt — RUN_GAP 2.0 에서도 쪼개지므로
  // 이 케이스가 잡아내는 것은 오직 "거터 비율의 분모"다.
  const items = [];
  for (let i = 0; i < 20; i++) {                      // 가로지르는 줄 20개
    const y = 700 - 14 * i;
    items.push(item('left aligned body line ' + (i + 1), 72, y, { width: 209 }));
    items.push(item('right aligned body line ' + (i + 1), 306, y, { width: 209 }));
  }
  for (let i = 0; i < 30; i++) {                      // 한쪽 컬럼에만 있는 줄 30개 (과반)
    const y = 693 - 14 * i;
    if (i % 2 === 0) items.push(item('left only body line ' + (i + 1), 72, y, { width: 209 }));
    else items.push(item('right only body line ' + (i + 1), 306, y, { width: 209 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 2, '가로지르는 20줄이 전부 거터에서 끊기는데 1단으로 보면 안 된다');
  for (const s of textsOf(layout)) {
    assert.ok(!/left .*right /.test(s), '좌·우 컬럼이 한 줄로 병합되면 안 된다: ' + s);
  }
});

test('C7 전폭 본문 1단 페이지(해설 구간) → count=1 (분모를 고쳐도 오탐하지 않는다)', () => {
  // 실측(p42): 본문 47줄이 모두 전폭이고 그중 15줄이 우연히 페이지 중앙 근처에서
  // 끊긴다 → 비율 0.33. 분모를 "가로지르는 줄"로 바꿔도 이 페이지는 모든 줄이
  // 가로지르므로 비율이 거의 변하지 않는다(0.32 → 0.33). 임계 0.55 가 하는 일이
  // 이것이다 — 임계를 0.30 대로 낮추면 이 케이스가 깨진다.
  const items = [];
  for (let i = 0; i < 30; i++) {                      // 끊김 없는 전폭 줄
    items.push(item('full width explanation line ' + (i + 1), 72, 700 - 12 * i, { width: 468 }));
  }
  for (let i = 0; i < 15; i++) {                      // 중앙 근처에서 우연히 끊기는 줄
    const y = 340 - 12 * i;
    items.push(item('explanation fragment ' + (i + 1), 72, y, { width: 208 }));
    items.push(item('continues after a gap ' + (i + 1), 300, y, { width: 240 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 1);
});

test('C8 거터 폭이 1.5em 인 2단 페이지 → count=2 (RUN_GAP_FACTOR 회귀 방지)', () => {
  // 실측: 이 책의 거터는 왼쪽 컬럼이 x=306 에서 끝나고 오른쪽이 x=321 에서
  // 시작해 15pt = 1.5em(본문 10pt)이다. RUN_GAP_FACTOR 2.0 이면 임계가 20pt 라
  // 거터가 run 경계로 인식되지 않고, 히스토그램에 넣을 간격 자체가 생기지 않는다.
  const items = [];
  for (let i = 0; i < 20; i++) {
    const y = 700 - 12 * i;
    items.push(item('left column question text ' + (i + 1), 72, y, { width: 234 }));   // 72~306
    items.push(item('right column question text ' + (i + 1), 321, y, { width: 219 })); // 321~540
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 2, '거터 15pt(1.5em)가 run 경계로 인식되어야 한다');
  const t = textsOf(layout);
  assert.equal(t.length, 40);
  for (let i = 0; i < 20; i++) assert.equal(t[i], 'left column question text ' + (i + 1));
  for (let i = 0; i < 20; i++) assert.equal(t[20 + i], 'right column question text ' + (i + 1));
});

test('C9 거터를 가로지르는 줄이 3개뿐이면 그 3개가 다 끊겨도 count=1 (분모 하한)', () => {
  // 분모를 "가로지르는 줄 수"로 바꾸면 분모가 아주 작아질 수 있다. 3/3 = 1.00 은
  // 비율로는 완벽하지만 표본이 아니다. GUTTER_MIN_CROSSING(=8) 이 이것을 막는다.
  const items = [];
  for (let i = 0; i < 3; i++) {
    const y = 700 - 14 * i;
    items.push(item('left aligned body line ' + (i + 1), 72, y, { width: 209 }));
    items.push(item('right aligned body line ' + (i + 1), 306, y, { width: 209 }));
  }
  for (let i = 0; i < 30; i++) {
    const y = 693 - 14 * i;
    if (i % 2 === 0) items.push(item('left only body line ' + (i + 1), 72, y, { width: 209 }));
    else items.push(item('right only body line ' + (i + 1), 306, y, { width: 209 }));
  }
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.columns.count, 1);
});
