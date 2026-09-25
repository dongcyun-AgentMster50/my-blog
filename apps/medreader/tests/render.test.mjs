/* ============================================================
   tests/render.test.mjs — spec 4-12 · 4-8 · 12-5 (6b 단계)

   canvas·pdf.js 는 Node 에 없다. 그래서 **순수하게 떼어낼 수 있는 것만**
   여기서 검증한다:
     · bbox → 오버레이 사각형 (줌 0.8 · 1.5 · 3.0 에서 각각)
     · 탭 좌표 → 줄 찾기 (역변환 후 bbox 포함 판정, 경계·겹침·빈 페이지)
     · 크롭 영역 (여백 6pt 포함), LRU 20 축출 순서
     · `role === 'rotated'` 줄은 오버레이 대상에서 빠진다

   `viewport` 는 스텁이다. pdf.js 의 `convertToViewportPoint` 는 PDF 좌표
   (원점 좌하단)를 CSS 픽셀(원점 좌상단)로 옮기므로 **y 가 뒤집힌다** —
   스텁도 그렇게 만든다. 회전 페이지 스텁도 하나 둔다(90°).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampScale, fitScale, zoomStep, canvasRatio,
  viewportRect, pdfPoint, padBox, clipBox, highlightBox,
  overlayable, overlayLines, lineAtPoint,
  cropBox, cropScale, createLru, cropKey, NO_OVERLAY_ROLES
} from '../js/pdf/render.js';
import { ORIGINAL } from '../js/config.js';

const PAGE = { width: 612, height: 792 };

/** rotation 0 의 pdf.js viewport 와 같은 식. */
function viewport(scale, page = PAGE) {
  return {
    scale: scale,
    width: page.width * scale,
    height: page.height * scale,
    convertToViewportPoint(x, y) { return [x * scale, (page.height - y) * scale]; },
    convertToPdfPoint(vx, vy) { return [vx / scale, page.height - vy / scale]; }
  };
}

/** rotation 90 — x 와 y 가 바뀐다. 손으로 행렬을 짜면 여기서 틀린다(4-12). */
function rotatedViewport(scale, page = PAGE) {
  return {
    scale: scale,
    width: page.height * scale,
    height: page.width * scale,
    convertToViewportPoint(x, y) { return [y * scale, x * scale]; },
    convertToPdfPoint(vx, vy) { return [vy / scale, vx / scale]; }
  };
}

function line(id, box, extra) {
  return Object.assign({ id: id, bbox: box, fontSize: 10, role: 'body', text: 'x' }, extra || {});
}

/* ────────────────────────────────────────────────────────
   R1~R3 줌 (12-5)
   ──────────────────────────────────────────────────────── */

test('R1 12-5 줌은 0.8~3.0 밖으로 나가지 않는다', () => {
  assert.equal(clampScale(0.1), ORIGINAL.ZOOM_MIN);
  assert.equal(clampScale(9), ORIGINAL.ZOOM_MAX);
  assert.equal(clampScale(1.5), 1.5);
  assert.equal(clampScale('아무거나'), 1);
});

test('R2 [−][+] 는 끝에 닿으면 그 자리에 머문다', () => {
  assert.equal(zoomStep(ORIGINAL.ZOOM_MAX, 1), ORIGINAL.ZOOM_MAX);
  assert.equal(zoomStep(ORIGINAL.ZOOM_MIN, -1), ORIGINAL.ZOOM_MIN);
  assert.ok(zoomStep(1, 1) > 1);
  assert.ok(zoomStep(1, -1) < 1);
});

test('R3 화면 폭 맞춤 scale, dpr 상한', () => {
  // 612pt 쪽을 360px 화면에 → 0.588 이지만 12-5 하한이 0.8 이다.
  // `[수정 2026-09-25 — 10b]` 이 테스트는 원래 "12-5 하한 0.8" 을 고정했다.
  // 그러나 `fitScale` 은 **진짜 폭 맞춤 배율**을 말해야 한다 — 0.8 에서 멈출지
  // 말지는 UI(`ui/original.js` 의 `zoomFloor`)가 정한다. 렌더 계층이 정책까지
  // 강제하니, 접은 화면에서 UI 가 0.57× 를 넘겨도 canvas 는 0.8× 로 그려져
  // 줌 표시만 거짓말을 했다(`[실기기]` 오른쪽이 잘려 손으로 밀어야 했던 이유).
  assert.ok(Math.abs(fitScale(612, 360) - 360 / 612) < 1e-9,
    'fitScale 은 진짜 폭 맞춤 배율을 돌려줘야 한다');
  // 물리적 바닥(ZOOM_FLOOR_MIN) 아래로는 안 내려간다.
  assert.equal(fitScale(612, 1), ORIGINAL.ZOOM_FLOOR_MIN);
  assert.equal(fitScale(612, 612), 1);
  assert.equal(fitScale(0, 360), 1);
  assert.equal(canvasRatio(3), ORIGINAL.DPR_MAX);
  assert.equal(canvasRatio(1), 1);
});

/* ────────────────────────────────────────────────────────
   R4~R7 bbox → 오버레이 사각형 (4-12)
   ──────────────────────────────────────────────────────── */

test('R4 ★ 줌 0.8 · 1.5 · 3.0 에서 오버레이 사각형이 각각 맞는다 (16-F)', () => {
  const box = { x0: 72, y0: 700, x1: 300, y1: 712 };
  for (const s of [0.8, 1.5, 3.0]) {
    const r = viewportRect(box, viewport(s));
    assert.equal(r.left, 72 * s, 'left @' + s);
    // 위쪽(y1=712)이 뷰포트에서는 top 이다 — y 가 뒤집힌다.
    assert.equal(r.top, (792 - 712) * s, 'top @' + s);
    // 부동소수 찌꺼기(9.600000000000009 vs …001)까지 고정하지는 않는다.
    assert.ok(Math.abs(r.width - (300 - 72) * s) < 1e-6, 'width @' + s);
    assert.ok(Math.abs(r.height - (712 - 700) * s) < 1e-6, 'height @' + s);
  }
});

test('R5 ★ 회전 페이지에서도 상자가 뒤집히지 않는다 (min/abs 로 만든다)', () => {
  const box = { x0: 72, y0: 700, x1: 300, y1: 712 };
  const r = viewportRect(box, rotatedViewport(1));
  assert.ok(r.width > 0 && r.height > 0, '넓이·높이가 음수가 되면 안 된다');
  assert.equal(r.left, 700);
  assert.equal(r.top, 72);
});

test('R6 4-6 하이라이트 상자는 0.15 × fontSize 만큼 넓다 — 페이지 밖으로는 안 나간다', () => {
  const l = line('1:1', { x0: 72, y0: 700, x1: 300, y1: 712 }, { fontSize: 10 });
  const b = highlightBox(l, PAGE);
  assert.equal(b.x0, 72 - 1.5);
  assert.equal(b.x1, 300 + 1.5);
  assert.equal(b.y0, 700 - 1.5);
  assert.equal(b.y1, 712 + 1.5);

  // 가장자리 줄 — 6a 의 클립과 같은 규칙으로 페이지 안에 머문다.
  const edge = line('1:2', { x0: 0, y0: 0, x1: 612, y1: 10 }, { fontSize: 10 });
  const e = highlightBox(edge, PAGE);
  assert.equal(e.x0, 0);
  assert.equal(e.x1, 612);
  assert.equal(e.y0, 0);
});

test('R7 못 쓸 bbox 는 상자를 만들지 않는다 (0,0,0,0)', () => {
  assert.deepEqual(viewportRect(null, viewport(1)), { left: 0, top: 0, width: 0, height: 0 });
  assert.deepEqual(viewportRect({ x0: NaN, y0: 0, x1: 1, y1: 1 }, viewport(1)), { left: 0, top: 0, width: 0, height: 0 });
  assert.equal(highlightBox({ bbox: null }, PAGE), null);
});

/* ────────────────────────────────────────────────────────
   R8~R10 ★ 회전 줄은 오버레이에서 빠진다
   ──────────────────────────────────────────────────────── */

test('R8 ★ role === "rotated" 줄은 오버레이 대상이 아니다 (인계 함정 5)', () => {
  assert.equal(NO_OVERLAY_ROLES.indexOf('rotated') >= 0, true);
  const rot = line('1:9', { x0: 10, y0: 10, x1: 400, y1: 22 }, { role: 'rotated' });
  assert.equal(overlayable(rot), false);
  const body = line('1:1', { x0: 10, y0: 10, x1: 400, y1: 22 });
  assert.equal(overlayable(body), true);

  const kept = overlayLines([body, rot]);
  assert.deepEqual(kept.map((l) => l.id), ['1:1']);
});

test('R9 클립으로 납작해진 줄(bboxDegenerate)도 그리지 않는다', () => {
  assert.equal(overlayable(line('1:3', { x0: 100, y0: 10, x1: 100, y1: 22 })), false);
  assert.equal(overlayable(line('1:4', { x0: 100, y0: 10, x1: 200, y1: 10 })), false);
});

test('R10 ★ 회전 줄은 탭 판정에서도 빠진다 — 엉뚱한 줄로 낭독이 뛰지 않는다', () => {
  const rot = line('1:9', { x0: 0, y0: 0, x1: 612, y1: 792 }, { role: 'rotated' });
  const body = line('1:1', { x0: 72, y0: 700, x1: 300, y1: 712 });
  const hit = lineAtPoint([rot, body], { x: 100, y: 705 });
  assert.equal(hit.id, '1:1');
  // 회전 줄만 있는 쪽에서는 아무 줄도 안 잡힌다.
  assert.equal(lineAtPoint([rot], { x: 5, y: 5 }), null);
});

/* ────────────────────────────────────────────────────────
   R11~R14 탭 좌표 → 줄 (4-12)
   ──────────────────────────────────────────────────────── */

test('R11 ★ 탭 좌표를 역변환해 그 줄을 찾는다 (줌 0.8 · 1.5 · 3.0)', () => {
  const lines = [
    line('1:1', { x0: 72, y0: 700, x1: 300, y1: 712 }),
    line('1:2', { x0: 72, y0: 680, x1: 300, y1: 692 })
  ];
  for (const s of [0.8, 1.5, 3.0]) {
    const vp = viewport(s);
    // 둘째 줄 한가운데를 눌렀다.
    const mid = vp.convertToViewportPoint(180, 686);
    const pt = pdfPoint(vp, mid[0], mid[1]);
    const hit = lineAtPoint(lines, pt);
    assert.equal(hit && hit.id, '1:2', '@' + s);
  }
});

test('R12 경계 — bbox 모서리는 그 줄 안이다. 사이 빈틈은 slack 으로만 잡힌다', () => {
  const lines = [line('1:1', { x0: 72, y0: 700, x1: 300, y1: 712 })];
  assert.equal(lineAtPoint(lines, { x: 72, y: 700 }).id, '1:1');
  assert.equal(lineAtPoint(lines, { x: 300, y: 712 }).id, '1:1');
  assert.equal(lineAtPoint(lines, { x: 71, y: 706 }), null);
  assert.equal(lineAtPoint(lines, { x: 71, y: 706 }, { slack: 3 }).id, '1:1');
});

test('R13 겹치는 줄이 여럿이면 **면적이 작은 쪽**을 고른다 (표 캡션·큰 제목)', () => {
  const big = line('1:big', { x0: 0, y0: 600, x1: 612, y1: 792 });
  const small = line('1:small', { x0: 72, y0: 700, x1: 300, y1: 712 });
  assert.equal(lineAtPoint([big, small], { x: 100, y: 706 }).id, '1:small');
  assert.equal(lineAtPoint([small, big], { x: 100, y: 706 }).id, '1:small');
  // 작은 줄 밖을 누르면 큰 줄이다.
  assert.equal(lineAtPoint([big, small], { x: 500, y: 706 }).id, '1:big');
});

test('R14 빈 쪽·엉뚱한 좌표 — null 이고 던지지 않는다', () => {
  assert.equal(lineAtPoint([], { x: 1, y: 1 }), null);
  assert.equal(lineAtPoint(null, { x: 1, y: 1 }), null);
  assert.equal(lineAtPoint([line('1:1', { x0: 0, y0: 0, x1: 10, y1: 10 })], null), null);
  assert.equal(lineAtPoint([line('1:1', { x0: 0, y0: 0, x1: 10, y1: 10 })], { x: NaN, y: 0 }), null);
  assert.equal(pdfPoint(null, 1, 1), null);
});

/* ────────────────────────────────────────────────────────
   R15~R18 표 크롭 (4-8)
   ──────────────────────────────────────────────────────── */

test('R15 ★ 크롭 영역은 region bbox + 여백 6pt 다 (4-8)', () => {
  const box = { x0: 100, y0: 300, x1: 500, y1: 500 };
  const c = cropBox(box, PAGE);
  assert.equal(c.x0, 100 - ORIGINAL.CROP_PAD_PT);
  assert.equal(c.y0, 300 - ORIGINAL.CROP_PAD_PT);
  assert.equal(c.x1, 500 + ORIGINAL.CROP_PAD_PT);
  assert.equal(c.y1, 500 + ORIGINAL.CROP_PAD_PT);
  assert.equal(ORIGINAL.CROP_PAD_PT, 6, '4-8 이 못 박은 여백은 6pt 다');

  // 여백을 준 결과가 페이지를 넘으면 접는다 — 표가 잘리는 대신 여백만 준다.
  const edge = cropBox({ x0: 0, y0: 0, x1: 612, y1: 100 }, PAGE);
  assert.deepEqual(edge, { x0: 0, y0: 0, x1: 612, y1: 106 });
});

test('R16 여백을 뺀 크롭 영역은 원본보다 작다 — 여백이 사라지면 이 테스트가 빨개진다', () => {
  const box = { x0: 100, y0: 300, x1: 500, y1: 500 };
  const withPad = cropBox(box, PAGE);
  const noPad = cropBox(box, PAGE, 0);
  assert.equal(noPad.x0, 100);
  assert.ok((withPad.x1 - withPad.x0) > (noPad.x1 - noPad.x0),
    '여백이 있는 크롭이 더 넓어야 한다(표 테두리가 잘리지 않게)');
  assert.equal((withPad.x1 - withPad.x0) - (noPad.x1 - noPad.x0), 2 * ORIGINAL.CROP_PAD_PT);
});

test('R17 크롭 배율은 2 × dpr, 상한 3 (4-8)', () => {
  assert.equal(cropScale(1), 2);
  assert.equal(cropScale(1.5), 3);
  assert.equal(cropScale(3), 3);
  assert.equal(cropScale(undefined), 2);
});

test('R18 넓이가 0 인 region 은 크롭하지 않는다 (null)', () => {
  assert.equal(cropBox({ x0: 10, y0: 10, x1: 10, y1: 20 }, PAGE, 0), null);
  assert.equal(cropBox(null, PAGE), null);
});

/* ────────────────────────────────────────────────────────
   R19~R22 LRU 20 (4-8 — IndexedDB 에 저장하지 않는다)
   ──────────────────────────────────────────────────────── */

test('R19 ★ 4-8 의 캐시 상한은 20 이다', () => {
  assert.equal(ORIGINAL.CROP_CACHE_MAX, 20);
});

test('R20 ★ 21번째를 넣으면 가장 오래 안 쓴 것이 나간다 (축출 순서)', () => {
  const gone = [];
  const lru = createLru(ORIGINAL.CROP_CACHE_MAX, (k) => gone.push(k));
  for (let i = 0; i < ORIGINAL.CROP_CACHE_MAX; i++) lru.set('k' + i, i);
  assert.equal(lru.size, 20);
  assert.deepEqual(gone, []);

  lru.set('k20', 20);
  assert.deepEqual(gone, ['k0'], '가장 먼저 들어온 것이 나간다');
  assert.equal(lru.size, 20);
  assert.equal(lru.has('k0'), false);
  assert.equal(lru.has('k20'), true);
});

test('R21 ★ get 은 "최근 사용"으로 친다 — 방금 본 표가 먼저 쫓겨나지 않는다', () => {
  const gone = [];
  const lru = createLru(3, (k) => gone.push(k));
  lru.set('a', 1); lru.set('b', 2); lru.set('c', 3);
  assert.equal(lru.get('a'), 1);       // a 를 다시 썼다
  lru.set('d', 4);
  assert.deepEqual(gone, ['b'], 'a 가 아니라 b 가 나가야 한다');
  assert.deepEqual(lru.keys(), ['c', 'a', 'd']);
});

test('R22 축출 때 정리 콜백이 온다 (objectURL 회수 자리) — 콜백이 던져도 캐시는 산다', () => {
  const seen = [];
  const lru = createLru(1, (k, v) => { seen.push([k, v]); throw new Error('정리 실패'); });
  lru.set('a', { url: 'blob:a' });
  lru.set('b', { url: 'blob:b' });
  assert.deepEqual(seen, [['a', { url: 'blob:a' }]]);
  assert.equal(lru.has('b'), true);
});

test('R23 캐시 키는 문서·쪽·region·배율을 모두 가른다', () => {
  assert.notEqual(cropKey('d1', 45, 'r0', 2), cropKey('d1', 45, 'r0', 3));
  assert.notEqual(cropKey('d1', 45, 'r0', 2), cropKey('d1', 46, 'r0', 2));
  assert.notEqual(cropKey('d1', 45, 'r0', 2), cropKey('d2', 45, 'r0', 2));
  assert.equal(cropKey('d1', 45, 'r0', 2), cropKey('d1', 45, 'r0', 2));
});

/* ────────────────────────────────────────────────────────
   R24 작은 도구들
   ──────────────────────────────────────────────────────── */

test('R24 padBox·clipBox', () => {
  assert.deepEqual(padBox({ x0: 10, y0: 10, x1: 20, y1: 20 }, 5), { x0: 5, y0: 5, x1: 25, y1: 25 });
  assert.deepEqual(clipBox({ x0: -5, y0: -5, x1: 700, y1: 900 }, 612, 792),
    { x0: 0, y0: 0, x1: 612, y1: 792 });
});
