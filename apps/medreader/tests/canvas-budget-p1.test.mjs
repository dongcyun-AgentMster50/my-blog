/* ============================================================
   tests/canvas-budget-p1.test.mjs — 공개 전 묶음 P1 ② 원본 캔버스 해상도 (spec 12-5 `[수정 2026-10-12]`)

   옛 규칙 `canvasRatio = min(dpr, 2)` 는 **작게 볼 때도** 해상도를 2 로 깎았다. 폰(dpr ≈ 3)에서
   2배로 그린 뒤 1.5배 늘려 9pt 표의 가는 글자가 사라졌다(Nour 캡처 — CMDT 2026 31쪽, 원본 66%).
   새 규칙은 캔버스 픽셀 수 예산이다:
     ratio = max(1, min(dpr, √(MAX_CANVAS_PIXELS / (cssW × cssH)), MAX_CANVAS_SIDE / cssW, MAX_CANVAS_SIDE / cssH))

   `renderPageInto` 를 가짜 pdf.js 쪽·가짜 canvas 로 **그대로** 돌려 실제로 잡히는 canvas 크기를 잰다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { canvasRatio, renderPageInto, cropScale, cropRenderScale, renderRegionImage } from '../js/pdf/render.js';
import { ORIGINAL } from '../js/config.js';

/* CMDT 2026 쪽 크기(spec 12-5 수치). */
const CMDT = { w: 517, h: 720 };

function fakeDoc(size) {
  const calls = { viewports: [] };
  const page = {
    getViewport: ({ scale }) => {
      calls.viewports.push(scale);
      return { width: size.w * scale, height: size.h * scale, scale: scale };
    },
    render: () => ({ promise: Promise.resolve() }),
    cleanup: () => {}
  };
  return { calls, getPage: async () => page };
}

function fakeCanvas() {
  const c = {
    width: 0, height: 0, style: {},
    transform: null,
    getContext: () => ({
      setTransform: (a) => { c.transform = a; },
      fillRect: () => {}, drawImage: () => {}, fillStyle: ''
    })
  };
  return c;
}

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' ' + a + ' ≈ ' + b);

test('CB1 ★ 수용 — Nour 조건(CMDT 31쪽 66%, dpr 3): canvas 실제 픽셀 / CSS 픽셀 = 3', async () => {
  const cv = fakeCanvas();
  const out = await renderPageInto(fakeDoc(CMDT), 31, cv, 0.66, 3);
  assert.equal(out.cssWidth, 341);
  assert.equal(out.cssHeight, 475);
  near(cv.width / parseFloat(cv.style.inlineSize), 3, 0.01, '폭 비율');
  near(cv.height / parseFloat(cv.style.blockSize), 3, 0.01, '높이 비율');
  assert.equal(cv.transform, 3, 'setTransform 도 같은 배수');
});

test('CB2 ★ 수용 — 3.0× 확대에서는 예산 안으로 떨어진다 (옛 규칙 2 보다 오히려 작다)', async () => {
  const cv = fakeCanvas();
  const out = await renderPageInto(fakeDoc(CMDT), 31, cv, 3.0, 3);
  assert.equal(out.cssWidth, 1551);
  assert.equal(out.cssHeight, 2160);
  assert.ok(cv.width * cv.height <= ORIGINAL.MAX_CANVAS_PIXELS, '픽셀 수 ' + cv.width * cv.height);
  assert.ok(cv.width <= ORIGINAL.MAX_CANVAS_SIDE && cv.height <= ORIGINAL.MAX_CANVAS_SIDE, '한 변');
  near(cv.width / 1551, 1.58, 0.01, '예산 배수');
  assert.ok(cv.width * cv.height < 1551 * 2160 * 4, '옛 규칙(배수 2, 13.4MP)보다 작다');
});

test('CB3 spec 12-5 수치 — 66%·폭 맞춤·1.5× 는 기기 밀도 그대로, 3.0× 만 깎인다', () => {
  assert.equal(canvasRatio(3, 341, 475), 3);
  assert.equal(canvasRatio(2.625, 341, 475), 2.625);
  assert.equal(canvasRatio(3, 360, 501), 3, '폭 맞춤 360px');
  assert.equal(canvasRatio(3, 776, 1080), 3, '1.5× — 7.5MP 로 예산 안');
  near(canvasRatio(3, 1551, 2160), 1.5824, 0.001, '3.0×');
});

test('CB4 하한 1 · 이상한 dpr 은 1 · 크기를 모르면 dpr 그대로', () => {
  assert.equal(canvasRatio(0, 341, 475), 1);
  assert.equal(canvasRatio(NaN, 341, 475), 1);
  assert.equal(canvasRatio(-2, 341, 475), 1);
  assert.equal(canvasRatio(3, 20000, 20000), 1, '예산이 1 아래를 요구해도 1 아래로 내려가지 않는다');
  assert.equal(canvasRatio(1, 341, 475), 1, 'dpr 1 기기는 1');
  assert.equal(canvasRatio(3), 3);
  assert.equal(canvasRatio(3, 0, 475), 3);
});

test('CB5 한 변 상한 — 아주 길쭉한 쪽은 면적이 아니라 한 변에서 깎인다', () => {
  // 300×4000 CSS px: 면적 예산은 √(8.39M/1.2M)=2.64, 한 변 4096/4000=1.02
  near(canvasRatio(3, 300, 4000), 4096 / 4000, 1e-9);
});

test('CB6 숫자는 config 한 곳 — DPR_MAX 는 없다', () => {
  assert.equal(ORIGINAL.DPR_MAX, undefined, '고정 상한을 두 곳에 두지 않는다');
  assert.equal(ORIGINAL.MAX_CANVAS_PIXELS, 8388608);
  assert.equal(ORIGINAL.MAX_CANVAS_SIDE, 4096);
});

/* ── 표 크롭(4-8) ─────────────────────────────────────── */

test('CB7 ★ 표 크롭 — 해상도 규칙은 그대로(dpr 3 → 3), 보통 쪽은 예산 안이라 3 그대로 그린다', () => {
  assert.equal(cropScale(3), 3);
  assert.equal(cropRenderScale(3, CMDT.w, CMDT.h), 3, 'CMDT 쪽 전체 1551×2160 = 3.35MP');
  assert.equal(cropRenderScale(3, 612, 792), 3, 'Letter 쪽 4.36MP');
  // spec 12-5: "크롭 실제 픽셀 ≥ 보이는 CSS 폭 × dpr" — 480pt 폭 표를 리플로우 폭 360px 에 맞춰 보인다.
  const tablePt = 480;
  const shownCss = 360;
  assert.ok(tablePt * cropRenderScale(cropScale(3), CMDT.w, CMDT.h) >= shownCss * 3,
    '크롭 픽셀 ' + tablePt * 3 + ' ≥ ' + shownCss * 3);
});

test('CB8 표 크롭 — 큰 쪽(A3)은 전체 쪽 캔버스가 원본 뷰와 같은 예산을 넘지 않는다', () => {
  const s = cropRenderScale(3, 842, 1191);
  const px = Math.round(842 * s) * Math.round(1191 * s);
  assert.ok(s < 3);
  assert.ok(px <= ORIGINAL.MAX_CANVAS_PIXELS * 1.001, '픽셀 ' + px);
  assert.equal(cropRenderScale(0.5, 842, 1191), 0.5, '1 보다 작게 달라는 호출은 그대로');
});

test('CB9 renderRegionImage 가 그 배율로 그린다 (가짜 쪽)', async () => {
  const doc = fakeDoc({ w: 842, h: 1191 });
  const made = [];
  const makeCanvas = (w, h) => {
    const c = fakeCanvas(); c.width = w; c.height = h; made.push(c);
    c.toBlob = (cb) => cb({ size: 1 });
    return c;
  };
  const out = await renderRegionImage(doc, 1, { x0: 100, y0: 100, x1: 300, y1: 300 }, { dpr: 3, makeCanvas });
  assert.ok(out);
  const full = made[0];
  assert.ok(full.width * full.height <= ORIGINAL.MAX_CANVAS_PIXELS * 1.001, '전체 쪽 캔버스 ' + full.width + '×' + full.height);
});
