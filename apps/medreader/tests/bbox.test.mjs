/* ============================================================
   MedReader — 줄 bbox 의 공백 제외와 페이지 클립 (spec 4-6 `[수정 2026-09-23 — 6a]`)

   실행: node --test "apps/medreader/tests/*.test.mjs"
   외부 의존성 없음. 픽스처는 pdf.js items 형태를 그대로 흉내 낸다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { lineBBox } from '../js/text/lines.js';
import { buildPageLayout } from '../js/text/layout.js';
import { groupParagraphs } from '../js/text/blocks.js';
import { LAYOUT } from '../js/config.js';

const W = 612, H = 792;

/* lineBBox 가 직접 먹는 모양의 아이템. ascent/descent 는 normalizeItems 의 기본값과 같다. */
function it0(str, x, y, w, o = {}) {
  return {
    str: str, x: x, y: y, w: w, h: o.fontSize || 10,
    fontSize: o.fontSize == null ? 10 : o.fontSize,
    fontName: 'g_d0_f1',
    ascent: o.ascent == null ? LAYOUT.DEFAULT_ASCENT : o.ascent,
    descent: o.descent == null ? LAYOUT.DEFAULT_DESCENT : o.descent,
    rotated: false, hasEOL: false, sup: !!o.sup, idx: o.idx || 0
  };
}

function lineOfItems(items) { return { items: items }; }

/* pdf.js getTextContent().items 한 개 (lines.test.mjs 와 같은 모양) */
function item(str, x, y, o = {}) {
  const fs = o.fontSize == null ? 10 : o.fontSize;
  const w = o.width == null ? str.length * fs * 0.5 : o.width;
  return {
    str: str, dir: 'ltr',
    transform: [fs, 0, 0, fs, x, y],
    width: w, height: fs,
    fontName: o.fontName || 'g_d0_f1',
    hasEOL: !!o.hasEOL
  };
}

/* ────────────────────────────────────────────────
   ① 공백 아이템을 x 범위에서 뺀다 (extendRun 과 같은 규칙)
   ──────────────────────────────────────────────── */

test('B1 폭을 가진 공백 아이템이 x1 을 밀지 않는다 (목차 점선 자리)', () => {
  // 실측: 이런 공백 아이템의 폭 중앙값이 192pt, 최대 473pt 였다.
  const bb = lineBBox(lineOfItems([
    it0('Chapter', 72, 700, 40, { idx: 0 }),
    it0('   ', 112, 700, 400, { idx: 1 }),   // 폭 400pt 짜리 공백
    it0('37', 512, 700, 10, { idx: 2 })
  ]));
  assert.equal(bb.x0, 72);
  assert.equal(bb.x1, 522, 'x1 이 공백 아이템 때문에 밀렸다');
});

test('B2 공백만 있는 줄의 x0/x1 은 0,0 으로 뭉개지지 않는다', () => {
  const bb = lineBBox(lineOfItems([
    it0('  ', 100, 500, 50, { idx: 0 }),
    it0(' ', 300, 500, 80, { idx: 1 })
  ]));
  assert.equal(bb.x0, 100, '공백만 있는 줄의 위치가 사라졌다');
  assert.equal(bb.x1, 300);
  // y 는 여전히 살아 있다
  assert.equal(bb.y0, 500 - 2);
  assert.equal(bb.y1, 500 + 8);
});

test('B3 공백 아이템도 y 범위에는 여전히 기여한다', () => {
  // 20pt 공백 아이템이 10pt 본문 줄에 끼어 있다 → 줄 높이는 공백 쪽이 지배한다
  const bb = lineBBox(lineOfItems([
    it0('text', 72, 700, 20, { idx: 0, fontSize: 10 }),
    it0('   ', 92, 700, 300, { idx: 1, fontSize: 20 })
  ]));
  assert.equal(bb.x1, 92, 'x 는 공백을 빼야 한다');
  assert.equal(bb.y1, 700 + 0.8 * 20, 'y1 이 공백 아이템(20pt)을 무시했다');
  assert.equal(bb.y0, 700 - 0.2 * 20, 'y0 이 공백 아이템(20pt)을 무시했다');
});

/* ────────────────────────────────────────────────
   ② 페이지 사각형 클립 — 선택 인자
   ──────────────────────────────────────────────── */

test('B4 pageRect 없이 부르면 클립하지 않는다 (기존 호출자 호환)', () => {
  const line = lineOfItems([it0('edge', 584, 700, 56, { idx: 0 })]);
  const bb = lineBBox(line);
  assert.equal(bb.x1, 640, '인자를 주지 않았는데 클립했다');
  assert.ok(bb.x1 > W);
  // pageRect 의 width/height 가 0 이면 그 축은 클립하지 않는다(0 으로 뭉개지 않는다)
  const zero = lineBBox(line, { width: 0, height: 0 });
  assert.equal(zero.x1, 640);
  assert.equal(zero.y1, 708);
});

test('B5 오른쪽·왼쪽·위·아래로 넘치는 줄이 페이지 안으로 잘린다', () => {
  const rect = { width: W, height: H };

  // 오른쪽 — 실측 두 번째 무리(x≈584, 초과 중앙값 22pt)
  const right = lineBBox(lineOfItems([it0('margin', 584, 400, 56, { idx: 0 })]), rect);
  assert.equal(right.x0, 584);
  assert.equal(right.x1, W);

  // 왼쪽 — x0 < 0 (실측 10줄)
  const left = lineBBox(lineOfItems([it0('bleed', -30, 400, 80, { idx: 0 })]), rect);
  assert.equal(left.x0, 0);
  assert.equal(left.x1, 50);

  // 위 — top = y + 0.8*fs 가 H 를 넘는다
  const top = lineBBox(lineOfItems([it0('head', 72, 790, 40, { idx: 0 })]), rect);
  assert.equal(top.y1, H);
  assert.equal(top.y0, 788);

  // 아래 — bottom = y − 0.2*fs 가 0 밑으로 내려간다
  const bottom = lineBBox(lineOfItems([it0('foot', 72, 1, 40, { idx: 0 })]), rect);
  assert.equal(bottom.y0, 0);
  assert.equal(bottom.y1, 9);
});

/* ────────────────────────────────────────────────
   ⑥ 클립이 중간 계산을 오염시키지 않는다 — 6a 의 핵심
   ──────────────────────────────────────────────── */

/**
 * 오른쪽 끝이 페이지를 넘는 줄(x1 = 640)이 섞인 1단 페이지.
 *
 * 4-9 의 "짧은 마지막 줄" 규칙은 `prev.bbox.x1 < colLeft + 0.70 * colWidth` 이고
 * `colWidth = max(bbox.x1) − colLeft` 다. 클립 전이면 640 − 72 = 568 → 임계 469.6,
 * 클립 후면 612 − 72 = 540 → 임계 450. x1 = 460 으로 끝나는 마침표 줄이 그 사이에
 * 있으므로 **클립을 문단 분할보다 먼저 걸면 문단 경계가 실제로 달라진다.**
 */
function overflowPageItems() {
  return [
    item('Alpha beta gamma delta epsilon zeta eta', 72, 600, { width: 488 }),
    item('Overflow line printed past the crop box.', 72, 588, { width: 568 }),  // x1 = 640 > 612
    item('Short closing line of the paragraph.', 72, 576, { width: 388 }),      // x1 = 460
    item('Theta iota kappa lambda mu nu xi omicron', 72, 564, { width: 500 }),
    item('Pi rho sigma tau upsilon phi chi psi omega', 72, 552, { width: 505 }),
    item('Aleph bet gimel dalet he vav zayin het tet', 72, 540, { width: 498 })
  ];
}

// publicLine 사본에서 bbox 만 다시 계산한다(클립 여부를 바꿔 끼운다)
function relayout(lines, rect) {
  const copy = JSON.parse(JSON.stringify(lines));
  for (const l of copy) l.bbox = rect ? lineBBox(l, rect) : lineBBox(l);
  return copy;
}

test('B6 ★ 클립이 문단 판정을 바꾸지 않는다 — 문단 분할은 클립 전 bbox 를 쓴다', () => {
  const layout = buildPageLayout(overflowPageItems(), { pageNo: 1, width: W, height: H });
  const info = { pageNo: 1, width: W, height: H };

  // 페이지가 의도대로 만들어졌는지 먼저 확인한다(픽스처가 헛돌면 테스트도 헛돈다)
  const over = layout.lines.filter(function (l) { return l.text.indexOf('Overflow') === 0; });
  assert.equal(over.length, 1);
  assert.equal(over[0].bbox.x1, W, '넘치는 줄이 클립되지 않았다 — 픽스처가 무의미하다');
  assert.equal(layout.columns.count, 1);

  const asClipped = groupParagraphs(relayout(layout.lines, { width: W, height: H }), info, LAYOUT);
  const asUnclipped = groupParagraphs(relayout(layout.lines, null), info, LAYOUT);

  // 감도 확인: 이 페이지에서 클립 전/후는 실제로 다른 문단 경계를 낳는다
  assert.notDeepEqual(
    asClipped.map(function (p) { return p.lineIds; }),
    asUnclipped.map(function (p) { return p.lineIds; }),
    '픽스처가 클립에 둔감하다 — 이 테스트는 아무것도 지키지 못한다'
  );

  // 본 검사: 파이프라인이 내놓은 문단은 **클립 전** bbox 로 나눈 것과 같아야 한다
  assert.deepEqual(
    layout.paragraphs.map(function (p) { return p.lineIds; }),
    asUnclipped.map(function (p) { return p.lineIds; }),
    '클립이 문단 분할보다 먼저 걸렸다'
  );
});

test('B7 ★ 클립은 컬럼 좌변(stats.bodyLeft)·읽기 순서·줄 수도 바꾸지 않는다', () => {
  const layout = buildPageLayout(overflowPageItems(), { pageNo: 1, width: W, height: H });
  assert.deepEqual(layout.stats.bodyLeft, [72]);
  assert.deepEqual(
    layout.lines.map(function (l) { return l.id; }),
    ['1:0', '1:1', '1:2', '1:3', '1:4', '1:5']
  );
  // 줄 수는 클립 전후로 변하지 않는다(클립이 파이프라인에 새면 줄이 사라지거나 합쳐진다)
  assert.equal(layout.lines.length, 6);
});

/* ────────────────────────────────────────────────
   클립이 결함을 가리지 않게 — stats.bboxDegenerate
   ──────────────────────────────────────────────── */

test('B8 bboxDegenerate 가 페이지 밖에 통째로 있는 줄을 센다', () => {
  const items = overflowPageItems();
  // 페이지 오른쪽 **밖**에만 있는 줄 (x0 = 700 > 612)
  items.push(item('ghost', 700, 528, { width: 20 }));
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });

  const ghost = layout.lines.filter(function (l) { return l.text === 'ghost'; });
  assert.equal(ghost.length, 1, '페이지 밖 줄을 버렸다 — 드러내되 버리지는 않는다');
  assert.equal(ghost[0].bbox.x0, W);
  assert.equal(ghost[0].bbox.x1, W);
  assert.equal(layout.stats.bboxDegenerate, 1);
});

test('B9 정상 페이지의 bboxDegenerate 는 0 이다 (공백만 있는 줄도 세지 않는다)', () => {
  const items = overflowPageItems();
  // 폭을 가진 공백 아이템만 있는 줄 — 원래부터 폭 0 이지 페이지 밖 신호가 아니다
  items.push(item('   ', 100, 528, { width: 300 }));
  const layout = buildPageLayout(items, { pageNo: 1, width: W, height: H });
  assert.equal(layout.stats.bboxDegenerate, 0);
});
