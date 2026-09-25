/* ============================================================
   MedReader — 페이지 렌더·영역 크롭 (spec 4-8 폴백 · 4-12 · 12-5)

   ── 서비스 계층이다(3-2) ────────────────────────────────
   `config.js` 와 `pdf/loader.js` 만 import 한다. **DOM 을 만들지 않는다** —
   화면에 붙는 `<canvas>` 는 `ui/original.js` 가 만들어 넘겨주고, 크롭용
   임시 캔버스는 `OffscreenCanvas` 를 쓴다(없으면 호출자가 `makeCanvas` 로
   주입한다). UI 문자열도 만들지 않는다. 실패는 **코드**로 던진다.

   ── 이 파일의 절반은 순수 함수다 ────────────────────────
   canvas·pdf.js 는 Node 에 없다. 그래서 **좌표 계산과 캐시는 전부 순수
   함수로 떼어** `tests/render.test.mjs` 가 `viewport` 스텁으로 검증한다.
   브라우저가 필요한 것은 아래 두 개뿐이다:
     · `renderPageInto(pdfDoc, pageNo, canvas, scale)`
     · `renderRegionImage(pdfDoc, pageNo, pdfRect, opts)`

   ── 좌표 (4-12) ────────────────────────────────────────
   행렬 곱을 손으로 짜지 않는다. `viewport.convertToViewportPoint` /
   `convertToPdfPoint` 가 회전(rotation ≠ 0)까지 처리한다.

   ── 회전 줄 (인계 문서 함정 5) ──────────────────────────
   `role === 'rotated'` 인 줄의 bbox 는 `lineBBox` 가 90° 아이템의 `width` 를
   수평 폭으로 더한 값이라 **설계상 틀린다.** 6a 의 클립이 페이지 안으로
   접어 넣었을 뿐 방향은 여전히 틀리다. `overlayable()` 이 그런 줄을 걸러
   내고, 오버레이도 탭 판정도 그 줄을 건드리지 않는다.
   ============================================================ */

import { ORIGINAL } from '../config.js';
import { loadPdfjs } from './loader.js';

/** 오버레이를 그리지 않는 줄 역할. 좌표를 믿을 수 없다. */
export const NO_OVERLAY_ROLES = Object.freeze(['rotated']);

/* ────────────────────────────────────────────────────────
   1. 줌 — 12-5 는 0.8~3.0 사이로 못 박았다.
   ──────────────────────────────────────────────────────── */

/** 범위 밖·NaN 은 가장 가까운 끝으로. 기본은 1.0 이 아니라 **화면 맞춤**이다. */
export function clampScale(s) {
  const v = Number(s);
  if (!Number.isFinite(v)) return 1;
  return Math.min(ORIGINAL.ZOOM_MAX, Math.max(ORIGINAL.ZOOM_MIN, v));
}

/**
 * `[신규 2026-09-25 — 10b]` **물리적 한계**로만 자른다. UI 정책(12-5 의 0.8)은 보지 않는다.
 *
 * 왜 나뉲는가: `clampScale` 은 **정책**이다("보통 상황에서 0.8 보다 작게 줄일 이유가 없다").
 * 그걸 렌더 계층이 다시 강제하면, 접은 화면처럼 **폭 맞춤이 0.8 보다 작은** 경우
 * UI 가 0.57× 를 넘겨도 canvas 는 0.8× 로 그려져 **줄 표시만 거짓말을 한다.**
 * `[실기기]` 사용자가 접은 화면에서 오른쪽이 잘려 손으로 밀어야 했던 이유의 절반이다.
 *
 * 렌더 계층은 "그릴 수 있는가"만 판단한다. 얼마로 보일지는 UI 몫이다.
 */
export function clampScaleAbs(s) {
  const v = Number(s);
  if (!Number.isFinite(v)) return 1;
  return Math.min(ORIGINAL.ZOOM_MAX, Math.max(ORIGINAL.ZOOM_FLOOR_MIN, v));
}

/**
 * 12-5 — "페이지 폭을 화면 폭에 맞춘 scale 을 기본으로".
 * @param {number} pageWidthPt `viewport(scale:1).width` (PDF 포인트)
 * @param {number} availablePx 쓸 수 있는 CSS 픽셀 폭
 */
export function fitScale(pageWidthPt, availablePx) {
  const w = Number(pageWidthPt);
  const avail = Number(availablePx);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(avail) || avail <= 0) return 1;
  // 10b — **진짜 폭 맞춤 배율**을 돌려준다(접은 화면에서 0.57 같은 값). 0.8 에서 멈출지
  // 말지는 호출자(`ui/original.js` 의 `zoomFloor`)가 정한다.
  return clampScaleAbs(avail / w);
}

/** [−][+] 한 번. 끝에 닿으면 그 자리에 머문다. */
export function zoomStep(scale, dir) {
  const cur = clampScale(scale);
  const f = ORIGINAL.ZOOM_FACTOR;
  return clampScale(Number(dir) >= 0 ? cur * f : cur / f);
}

/** canvas 뒷면 해상도 배수. dpr 을 그대로 쓰면 3× 줌에서 한 변이 5000px 을 넘는다. */
export function canvasRatio(dpr) {
  const v = Number(dpr);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(ORIGINAL.DPR_MAX, v);
}

/* ────────────────────────────────────────────────────────
   2. 좌표 변환 (4-12) — viewport 만 있으면 순수하다.
   ──────────────────────────────────────────────────────── */

function finiteBox(b) {
  return !!b && Number.isFinite(b.x0) && Number.isFinite(b.y0) &&
         Number.isFinite(b.x1) && Number.isFinite(b.y1);
}

/**
 * PDF 사각형 → 뷰포트(CSS px, 원점 좌상단) 사각형.
 * 4-12 의 식 그대로다. 두 점을 각각 변환한 뒤 min/abs 로 상자를 만든다 —
 * 회전 페이지에서는 x0 이 오른쪽으로 갈 수도 있기 때문이다.
 *
 * @param {{x0,y0,x1,y1}} box PDF 좌표
 * @param {Object} viewport `page.getViewport({scale})`
 * @returns {{left:number, top:number, width:number, height:number}}
 */
export function viewportRect(box, viewport) {
  if (!finiteBox(box) || !viewport || typeof viewport.convertToViewportPoint !== 'function') {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const a = viewport.convertToViewportPoint(box.x0, box.y0);
  const b = viewport.convertToViewportPoint(box.x1, box.y1);
  return {
    left: Math.min(a[0], b[0]),
    top: Math.min(a[1], b[1]),
    width: Math.abs(b[0] - a[0]),
    height: Math.abs(b[1] - a[1])
  };
}

/** 뷰포트 좌표 → PDF 좌표. 줄 탭 판정이 이걸로 되돌린다(4-12). */
export function pdfPoint(viewport, vx, vy) {
  if (!viewport || typeof viewport.convertToPdfPoint !== 'function') return null;
  const p = viewport.convertToPdfPoint(Number(vx) || 0, Number(vy) || 0);
  return { x: p[0], y: p[1] };
}

/** 사방으로 `pad` 만큼 넓힌 상자. */
export function padBox(box, pad) {
  const p = Number(pad) || 0;
  return { x0: box.x0 - p, y0: box.y0 - p, x1: box.x1 + p, y1: box.y1 + p };
}

/** 페이지 사각형 안으로 접는다(6a 가 줄 bbox 에 한 것과 같은 규칙). */
export function clipBox(box, width, height) {
  const W = Number(width) || 0;
  const H = Number(height) || 0;
  const cl = (v, hi) => Math.min(hi, Math.max(0, v));
  return { x0: cl(box.x0, W), y0: cl(box.y0, H), x1: cl(box.x1, W), y1: cl(box.y1, H) };
}

/**
 * 4-6 — 하이라이트 상자는 줄 bbox + `0.15 × fontSize`(사방).
 * 순수 계층은 원값만 주므로 이 여백은 UI 가 더한다. 페이지 밖으로는 안 나간다.
 *
 * @param {Object} line 저장본의 줄 `{bbox, fontSize, role}`
 * @param {Object} page `{width, height}` — 없으면 클립하지 않는다
 */
export function highlightBox(line, page) {
  const b = line && line.bbox;
  if (!finiteBox(b)) return null;
  const pad = (Number(line.fontSize) || 0) * ORIGINAL.HL_PAD_FACTOR;
  const grown = padBox(b, pad);
  if (!page || !Number(page.width) || !Number(page.height)) return grown;
  return clipBox(grown, page.width, page.height);
}

/**
 * 오버레이를 그려도 되는 줄인가.
 *   · `role === 'rotated'` — bbox 가 가로 상자라 세로로 인쇄된 글과 겹치지
 *     않는다. **엉뚱한 자리에 그리는 것보다 숨기는 쪽이 낫다.**
 *   · 넓이나 높이가 0 인 줄 — 6a 의 클립으로 납작해진 줄(`bboxDegenerate`).
 */
export function overlayable(line) {
  if (!line || NO_OVERLAY_ROLES.indexOf(line.role) >= 0) return false;
  const b = line.bbox;
  if (!finiteBox(b)) return false;
  return (b.x1 - b.x0) > 0 && (b.y1 - b.y0) > 0;
}

/** 오버레이 대상 줄만. 회전 줄·납작한 줄은 빠진다. */
export function overlayLines(lines) {
  const list = Array.isArray(lines) ? lines : [];
  const out = [];
  for (let i = 0; i < list.length; i++) if (overlayable(list[i])) out.push(list[i]);
  return out;
}

/* ────────────────────────────────────────────────────────
   2-b. 글자 구간 → x (4-12 `[수정 2026-09-25 — 10a]`)

   문장이 줄 중간에서 시작하면 줄 통째 상자는 **앞 문장 꼬리까지** 덮는다.
   그래서 첫 줄·마지막 줄은 가로로 잘라야 하는데, 우리는 글자폭을 모른다.
   가진 것은 `runs[].x0/x1`(4-4 가 큰 X 간격으로 나눈 조각)뿐이다.

   그래서 **글자를 run 에 배정하고 run 안에서는 글자 수 비례로 보간**한다.
   근사치다 — 비례 글꼴에서 'i' 와 'W' 는 폭이 다르다. 그래도 줄 전체를
   칠하는 것보다 훨씬 맞고, run 경계에서는 **정확**하다(경계가 앵커다).

   run 텍스트는 표 줄에만 저장된다(`text/store.js` 규칙 2). 본문 줄은
   `{x0,x1}` 뿐이라 폭 비례로 나눈다.
   ──────────────────────────────────────────────────────── */

/**
 * 줄의 각 run 이 **줄 텍스트의 어느 글자 구간**인가.
 *
 * @param {Object} line 저장본의 줄 `{text, runs:[{x0,x1,text?}], bbox}`
 * @returns {Array<{x0:number,x1:number,c0:number,c1:number}>} 읽기 순서. 못 만들면 `[]`.
 */
export function runCharSpans(line) {
  const text = String((line && line.text) || '');
  const len = text.length;

  const runs = [];
  const src = (line && Array.isArray(line.runs)) ? line.runs : [];
  for (let i = 0; i < src.length; i++) {
    const r = src[i];
    if (!r || !Number.isFinite(r.x0) || !Number.isFinite(r.x1) || r.x1 <= r.x0) continue;
    runs.push(r);
  }

  // run 이 하나도 쓸 만하지 않으면 줄 bbox 를 run 하나로 친다.
  if (!runs.length) {
    const b = line && line.bbox;
    if (!finiteBox(b) || b.x1 <= b.x0 || len === 0) return [];
    return [{ x0: b.x0, x1: b.x1, c0: 0, c1: len }];
  }

  // ① run 텍스트가 전부 있으면 줄 텍스트 안에서 찾아 **정확히** 맞춘다(표 줄).
  let allText = true;
  for (let i = 0; i < runs.length; i++) {
    if (typeof runs[i].text !== 'string' || runs[i].text.length === 0) { allText = false; break; }
  }
  if (allText) {
    const exact = [];
    let cursor = 0;
    let ok = true;
    for (let i = 0; i < runs.length; i++) {
      const at = text.indexOf(runs[i].text, cursor);
      if (at < 0) { ok = false; break; }
      const c1 = at + runs[i].text.length;
      exact.push({ x0: runs[i].x0, x1: runs[i].x1, c0: at, c1: c1 });
      cursor = c1;
    }
    if (ok && exact.length) return exact;
  }

  // ② 없으면 run 폭에 비례해 글자를 나눈다. run 사이 공백 글자는 앞 run 에 얹힌다.
  let total = 0;
  for (let i = 0; i < runs.length; i++) total += runs[i].x1 - runs[i].x0;
  if (!(total > 0) || len === 0) return [];

  const out = [];
  let acc = 0;
  let c = 0;
  for (let i = 0; i < runs.length; i++) {
    acc += runs[i].x1 - runs[i].x0;
    const last = i === runs.length - 1;
    const c1 = last ? len : Math.max(c, Math.min(len, Math.round((len * acc) / total)));
    out.push({ x0: runs[i].x0, x1: runs[i].x1, c0: c, c1: c1 });
    c = c1;
  }
  return out;
}

/**
 * 줄 텍스트의 `[start, end)` 글자 구간이 차지하는 **PDF x 구간**.
 *
 * 범위 밖 오프셋은 줄 길이로 접는다. 구간이 비거나(끝 ≤ 시작) run 사이
 * 공백에만 걸리면 `null` — 호출자가 줄 통째 상자로 돌아간다.
 *
 * @returns {{x0:number, x1:number}|null}
 */
export function charRangeX(line, start, end) {
  const spans = runCharSpans(line);
  if (!spans.length) return null;

  // 범위 밖 오프셋을 여기서 접지 **않는다** — 아래 run 별 교집합이 이미 접는다.
  // 한 번 더 접으면 그 줄이 죽은 코드가 되고, 그러면 어떤 테스트도 이 경계를
  // 지키지 못한다(변이로 확인했다).
  const num = (v) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : null;
  };
  const s = num(start);
  const e = num(end);
  if (s === null || e === null || e <= s) return null;

  let x0 = Infinity;
  let x1 = -Infinity;
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    const from = Math.max(s, sp.c0);
    const to = Math.min(e, sp.c1);
    if (to <= from) continue;
    const n = sp.c1 - sp.c0;
    const w = sp.x1 - sp.x0;
    const a = n > 0 ? sp.x0 + ((from - sp.c0) / n) * w : sp.x0;
    const b = n > 0 ? sp.x0 + ((to - sp.c0) / n) * w : sp.x1;
    if (a < x0) x0 = a;
    if (b > x1) x1 = b;
  }
  if (!(x1 > x0)) return null;
  return { x0: x0, x1: x1 };
}

/**
 * PDF 좌표의 한 점이 어느 줄 안인가(4-12 — 줄 ≤ 100 이라 선형 탐색).
 *
 * 겹치는 줄이 여럿이면 **면적이 가장 작은 줄**을 고른다. 표 캡션이 표
 * 영역과 겹치거나 큰 제목 상자가 본문 줄을 덮는 경우가 있고, 사용자가
 * 노린 것은 더 작은(=더 구체적인) 쪽이다. 같은 면적이면 앞선 줄(읽기 순서).
 *
 * @returns {Object|null} 줄 객체. 아무 줄에도 안 닿으면 null.
 */
export function lineAtPoint(lines, pt, opts) {
  if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null;
  const slack = Number(opts && opts.slack) || 0;
  const list = Array.isArray(lines) ? lines : [];
  let best = null;
  let bestArea = Infinity;
  for (let i = 0; i < list.length; i++) {
    const l = list[i];
    if (!overlayable(l)) continue;
    const b = l.bbox;
    if (pt.x < b.x0 - slack || pt.x > b.x1 + slack) continue;
    if (pt.y < b.y0 - slack || pt.y > b.y1 + slack) continue;
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (area < bestArea) { best = l; bestArea = area; }
  }
  return best;
}

/**
 * 4-8 폴백 — 표 크롭 영역. region bbox 에 **여백 6pt** 를 더하고 페이지
 * 사각형으로 접는다. 여백이 없으면 표의 테두리 선과 가장자리 글자가 잘린다.
 */
export function cropBox(box, page, padPt) {
  if (!finiteBox(box)) return null;
  const pad = padPt === undefined || padPt === null ? ORIGINAL.CROP_PAD_PT : Number(padPt);
  const grown = padBox(box, pad);
  const W = Number(page && page.width) || 0;
  const H = Number(page && page.height) || 0;
  const out = (W > 0 && H > 0) ? clipBox(grown, W, H) : grown;
  if (out.x1 - out.x0 <= 0 || out.y1 - out.y0 <= 0) return null;
  return out;
}

/** 4-8 — `scale = 2 × devicePixelRatio`, 상한 3. */
export function cropScale(dpr) {
  const v = Number(dpr);
  const base = (!Number.isFinite(v) || v <= 0) ? 1 : v;
  return Math.min(ORIGINAL.CROP_SCALE_MAX, ORIGINAL.CROP_SCALE_FACTOR * base);
}

/* ────────────────────────────────────────────────────────
   3. LRU 캐시 — 4-8: "메모리 캐시(LRU 20개)만. IndexedDB 에는 저장하지
   않는다"(25MB 문서에서 용량이 두 배가 된다).
   ──────────────────────────────────────────────────────── */

/**
 * 가장 오래 **쓰이지 않은** 것부터 버린다. `get` 도 최근 사용으로 친다.
 * 버릴 때 `onEvict(key, value)` 를 부른다 — blob URL 을 돌려주는 자리다.
 *
 * @param {number} max 최대 개수
 * @param {Function} [onEvict]
 */
export function createLru(max, onEvict) {
  const limit = Math.max(1, Math.floor(Number(max)) || 1);
  const map = new Map();          // Map 은 삽입 순서를 지킨다 = LRU 순서

  function evictIfNeeded() {
    while (map.size > limit) {
      const oldest = map.keys().next().value;
      const v = map.get(oldest);
      map.delete(oldest);
      if (onEvict) { try { onEvict(oldest, v); } catch (e) { /* 정리 실패가 렌더를 막지 않는다 */ } }
    }
  }

  return {
    get limit() { return limit; },
    get size() { return map.size; },
    has(k) { return map.has(k); },
    keys() { return Array.from(map.keys()); },
    get(k) {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);              // 최근 사용으로 올린다
      return v;
    },
    set(k, v) {
      if (map.has(k)) map.delete(k);
      map.set(k, v);
      evictIfNeeded();
      return v;
    },
    delete(k) {
      if (!map.has(k)) return false;
      const v = map.get(k);
      map.delete(k);
      if (onEvict) { try { onEvict(k, v); } catch (e) { /* 같은 이유 */ } }
      return true;
    },
    clear() {
      const ks = Array.from(map.keys());
      for (let i = 0; i < ks.length; i++) this.delete(ks[i]);
    }
  };
}

/** 크롭 캐시 키 — 같은 표라도 배율이 다르면 다른 그림이다. */
export function cropKey(docId, pageNo, regionId, scale) {
  return String(docId) + '|' + String(pageNo) + '|' + String(regionId) + '|' + String(Math.round(Number(scale) * 100) / 100);
}

/* ────────────────────────────────────────────────────────
   4. 브라우저가 필요한 부분 — 여기부터는 Node 에서 돌지 않는다.
   ──────────────────────────────────────────────────────── */

/** 2-3 — pdf.js 는 **원본 뷰를 요청할 때** 동적 로드된다. 실패는 코드로 올라간다. */
export function ensurePdfjs() {
  return loadPdfjs();
}

/**
 * 한 쪽을 이미 만들어 둔 `<canvas>` 에 그린다. **canvas 를 만들지 않는다** —
 * DOM 은 UI 의 것이다(3-2).
 *
 * @param {Object} pdfDoc PDFDocumentProxy
 * @param {number} pageNo 1부터
 * @param {HTMLCanvasElement} canvas
 * @param {number} scale 0.8~3.0
 * @param {number} [dpr] devicePixelRatio
 * @returns {Promise<{viewport:Object, cssWidth:number, cssHeight:number}>}
 */
export async function renderPageInto(pdfDoc, pageNo, canvas, scale, dpr) {
  const page = await pdfDoc.getPage(pageNo);
  try {
    // 10b — UI 가 정한 배율을 그대로 그린다. 여기서 정책 하한을 다시 강제하면 표시가 거짓말을 한다.
    const s = clampScaleAbs(scale);
    const ratio = canvasRatio(dpr);
    const viewport = page.getViewport({ scale: s });
    const cssW = Math.max(1, Math.floor(viewport.width));
    const cssH = Math.max(1, Math.floor(viewport.height));

    canvas.width = Math.max(1, Math.floor(cssW * ratio));
    canvas.height = Math.max(1, Math.floor(cssH * ratio));
    canvas.style.inlineSize = cssW + 'px';
    canvas.style.blockSize = cssH + 'px';

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return { viewport: viewport, cssWidth: cssW, cssHeight: cssH };
  } finally {
    // 2-3 메모리 — 쪽 처리 후 정리한다. 7000쪽에서 이게 없으면 쌓인다.
    try { page.cleanup(); } catch (e) { /* 이미 닫힌 문서 */ }
  }
}

function makeOffscreen(w, h, makeCanvas) {
  if (typeof makeCanvas === 'function') return makeCanvas(w, h);
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  return null;
}

async function canvasToBlob(cv) {
  if (typeof cv.convertToBlob === 'function') return cv.convertToBlob({ type: 'image/png' });
  if (typeof cv.toBlob === 'function') {
    return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
  }
  return null;
}

/**
 * 4-8 폴백 1 — 한 쪽을 크롭 배율로 렌더한 뒤 `pdfRect`(+여백은 호출자가
 * `cropBox` 로 이미 더했다) 부분만 잘라 Blob 으로 돌려준다.
 *
 * **IndexedDB 에 저장하지 않는다.** 호출자가 메모리 LRU 20개만 들고 있는다.
 *
 * @returns {Promise<{blob:Blob, width:number, height:number}|null>}
 */
export async function renderRegionImage(pdfDoc, pageNo, pdfRect, opts) {
  const o = opts || {};
  const page = await pdfDoc.getPage(pageNo);
  try {
    const scale = Number(o.scale) || cropScale(o.dpr);
    const viewport = page.getViewport({ scale: scale });
    const rect = viewportRect(pdfRect, viewport);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));

    // 쪽 전체를 한 번 그린 뒤 잘라낸다. pdf.js 의 `transform` 으로 바로
    // 영역만 그릴 수도 있지만, 그 경로는 회전 페이지에서 부호를 손으로
    // 맞춰야 한다 — 4-12 의 "행렬을 손으로 짜지 마라"와 같은 이유로 피한다.
    const full = makeOffscreen(Math.max(1, Math.round(viewport.width)), Math.max(1, Math.round(viewport.height)), o.makeCanvas);
    if (!full) return null;
    const fctx = full.getContext('2d', { alpha: false });
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, full.width, full.height);
    await page.render({ canvasContext: fctx, viewport: viewport }).promise;

    const cut = makeOffscreen(w, h, o.makeCanvas);
    if (!cut) return null;
    const cctx = cut.getContext('2d', { alpha: false });
    cctx.drawImage(full, Math.round(rect.left), Math.round(rect.top), w, h, 0, 0, w, h);

    const blob = await canvasToBlob(cut);
    if (!blob) return null;
    return { blob: blob, width: w, height: h, scale: scale };
  } finally {
    try { page.cleanup(); } catch (e) { /* 같은 이유 */ }
  }
}
