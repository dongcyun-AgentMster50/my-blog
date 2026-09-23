/* ============================================================
   MedReader — 원본 뷰 (spec 4-12 · 12-5 · 2-3 · 16-F)

   ── 이 파일이 하는 일 ───────────────────────────────────
   한 쪽을 canvas 로 그리고, 낭독 중인 줄의 bbox 를 **하나뿐인 오버레이**로
   옮기고, 탭 좌표를 PDF 좌표로 되돌려 줄을 찾는다. 줌은 앱 안 [−][+] 로
   0.8~3.0× (12-5).

   ── ★ 오버레이를 줄마다 만들지 않는다 (4-12) ────────────
   `.hl-line` **한 개**를 `transform: translate()` 로 옮긴다. 줄 수만큼 DOM 을
   만들면 7000쪽에서 죽는다. 문장 모드는 한 발화가 여러 줄에 걸치므로
   **그 줄들의 합집합 상자** 하나로 그린다(줄 사이가 조금 넓어질 뿐,
   DOM 개수는 1 이다).

   ── ★ 회전 줄에는 그리지 않는다 ─────────────────────────
   `role === 'rotated'` 의 bbox 는 가로 상자라 세로로 인쇄된 글과 겹치지
   않는다. `render.overlayable()` 이 걸러 내고 오버레이는 **숨는다**.

   ── ★ pdf.js 가 없어도 앱은 읽힌다 (2-3) ────────────────
   원본 뷰는 pdf.js 를 **요청할 때** 부른다. 두 CDN 이 다 실패하면
   `onUnavailable(code)` 로 알리고 호출자가 리플로우로 되돌린다. 추출이
   끝난 쪽은 pdf.js 없이 계속 읽힌다 — 그게 이 앱의 전제다.

   ── 3-2 ────────────────────────────────────────────────
   UI 계층이다. 문구는 전부 `t()`. 서비스(`pdf/render.js`)는 코드만 낸다.
   ============================================================ */

import * as render from '../pdf/render.js';
import { t, formatNumber } from '../i18n/index.js';

/* ────────────────────────────────────────────────────────
   ★ 사람이 채우는 함수 — 뷰를 바꿀 때 **어느 줄로 착지할 것인가**
   ──────────────────────────────────────────────────────── */

/**
 * 뷰 전환(리플로우 ↔ 원본) 뒤에 화면이 맞출 **기준 줄**을 고른다.
 *
 * 16-C 의 "원본 뷰 ↔ 리플로우 전환 시 같은 줄 위치가 유지된다"가 이 한
 * 함수에 달려 있고, 정답이 하나가 아니다 — 낭독 중이라면 읽던 줄이 맞지만
 * 눈으로 훑는 중이라면 화면 중앙이 맞고, 방금 탭한 줄이 있으면 그쪽일 수도
 * 있다.
 *
 * **순수 함수여야 한다** — `document`·`window` 를 보지 않는다. 호출자가
 * 필요한 사실을 전부 `ctx` 로 모아 준다.
 *
 * @param {Object} ctx
 *   speaking            {boolean}       낭독 중인가
 *   currentLineId       {string|null}   낭독이 지금 읽는 줄
 *   visibleLineIds      {string[]}      화면에 보이는 줄들 (읽기 순서)
 *   viewportCenterLineId{string|null}   화면 세로 중앙에 가장 가까운 줄
 *   lastTappedLineId    {string|null}   사용자가 마지막으로 탭한 줄
 * @returns {string|null} 착지할 줄 id. null 이면 호출자가 페이지 첫 줄로 간다.
 */
export function pickAnchorLine(ctx) {
  const c = ctx || {};
  const visible = Array.isArray(c.visibleLineIds) ? c.visibleLineIds : [];
  const seen = (v) => v && visible.indexOf(v) >= 0;

  // ① 듣는 곳과 보는 곳이 **같으면** 낭독 줄. 그때는 낭독 줄이 곧 보던 자리라
  //    분기할 이유가 없다.
  const current = lineId(c.currentLineId);
  if (c.speaking && seen(current)) return current;

  // ② 다르면 **보고 있던 곳**을 지킨다. 낭독을 틀어놓고 다른 쪽을 눈으로 훑는 것은
  //    실제로 흔한 사용이고, 그때 낭독 줄로 끌고 가면 앱이 사용자가 보던 자리를
  //    빼앗는다. 탭은 스크롤보다 명시적인 의도이므로 화면 중앙보다 앞에 둔다.
  //    단, **지금도 보이는** 탭만 쓴다 — 탭하고 한참 스크롤한 뒤의 탭은 낡은 의도다.
  const tapped = lineId(c.lastTappedLineId);
  if (seen(tapped)) return tapped;

  const center = lineId(c.viewportCenterLineId);
  if (center) return center;

  // ③ 중앙조차 없지만 보이는 줄은 있다면 그 첫 줄. 쪽 맨 위로 튀는 것보다 낫다.
  const first = lineId(visible[0]);
  if (first) return first;

  // ④ 단서가 없다 — 호출자가 쪽 첫 줄로 간다.
  return null;
}

/** 줄 id 위생 — 비어 있거나 문자열이 아닌 값은 단서로 치지 않는다. */
function lineId(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/* ────────────────────────────────────────────────────────
   상태 — 한 번에 한 쪽. 쪽을 넘기면 DOM 을 통째로 버린다(7000쪽).
   ──────────────────────────────────────────────────────── */

let deps = null;
let els = null;

const state = {
  docId: null,
  pageNo: 0,
  /** `fromStored` 로 되살린 PageLayout (bbox 가 여기 있다) */
  layout: null,
  /** 지금 그려진 viewport. 오버레이·탭 판정이 **이것 하나**를 쓴다. */
  viewport: null,
  scale: 1,
  /** 사용자가 줌을 건드렸는가. 안 건드렸으면 쪽마다 화면 폭에 맞춘다(12-5). */
  userZoom: false,
  currentIds: [],
  /** 늦게 끝난 옛 렌더가 새 쪽을 덮어쓰지 않게 한다. */
  token: 0,
  /** pdf.js 를 못 불러왔다. 버튼을 비활성으로 두는 근거(2-3). */
  pdfjsFailed: false,
  /** 16-C `[D]` 훅 — 다음 pdf.js 요청을 일부러 실패시킨다(스모크 6번). */
  failNext: false
};

/**
 * @param {Object} d
 *   getPdfDoc(docId) → Promise<PDFDocumentProxy|null>   (reader 가 library 를 통해 연다)
 *   onLineTap(lineId)                                   줄 탭 → 낭독 이동
 *   onUnavailable(code)                                 pdf.js 실패 — 리플로우로 되돌린다
 */
export function initOriginal(d) {
  deps = d || {};
}

/** 2-3 — 원본 뷰 버튼을 비활성으로 둘 것인가. */
export function originalUnavailable() { return state.pdfjsFailed; }

/** [다시 시도] 후 다시 열어 볼 수 있게 한다. */
export function resetAvailability() { state.pdfjsFailed = false; }

/** 16-C `[D]` — 다음 한 번의 pdf.js 요청을 실패시킨다(`speaker.simulateStall` 과 같은 결의 훅). */
export function simulateLoadFailure() { state.failNext = true; }

export function currentScale() { return state.scale; }

/* ────────────────────────────────────────────────────────
   그리기
   ──────────────────────────────────────────────────────── */

/**
 * 원본 뷰를 `mount` 안에 그린다. 성공하면 true.
 * 실패(= pdf.js 실패·blob 없음·렌더 예외)면 false 를 돌려주고 **아무것도
 * 남기지 않는다** — 호출자가 리플로우로 되돌린다.
 *
 * @param {HTMLElement} mount
 * @param {{docId:string, pageNo:number, layout:Object}} req
 */
export async function showOriginal(mount, req) {
  if (!mount || !req || !req.layout) return false;
  const token = ++state.token;

  state.docId = req.docId;
  state.pageNo = Number(req.pageNo) || 1;
  state.layout = req.layout;
  state.currentIds = [];

  buildDom(mount);
  setStatus('reader.original.loading');

  let pdfDoc = null;
  try {
    if (state.failNext) { state.failNext = false; throw Object.assign(new Error('ERR_PDFJS_LOAD'), { code: 'ERR_PDFJS_LOAD' }); }
    pdfDoc = deps && deps.getPdfDoc ? await deps.getPdfDoc(req.docId) : null;
  } catch (e) {
    if (token !== state.token) return false;
    fail(e);
    return false;
  }
  if (token !== state.token) return false;
  if (!pdfDoc) { fail({ code: 'ERR_PDFJS_LOAD' }); return false; }

  try {
    await paint(pdfDoc, token);
  } catch (e) {
    if (token !== state.token) return false;
    // 렌더 자체가 실패한 것은 **pdf.js 가 없는 것과 다르다.** 버튼을 끄지
    // 않고 이 쪽만 안내한다(다음 쪽은 될 수 있다).
    setStatus('reader.original.failed');
    return false;
  }
  if (token !== state.token) return false;
  setStatus(null);
  return true;
}

function fail(e) {
  state.pdfjsFailed = true;
  state.viewport = null;
  if (deps && deps.onUnavailable) {
    try { deps.onUnavailable((e && e.code) || 'ERR_PDFJS_LOAD'); } catch (x) { /* 구독자 예외 */ }
  }
}

async function paint(pdfDoc, token) {
  const page = await pdfDoc.getPage(state.pageNo);
  let baseWidth = 0;
  try {
    baseWidth = page.getViewport({ scale: 1 }).width;
  } finally {
    try { page.cleanup(); } catch (e) { /* 이미 닫힘 */ }
  }
  if (token !== state.token) return;

  if (!state.userZoom) state.scale = render.fitScale(baseWidth, availableWidth());

  // 12-5 — 렌더 중에는 이전 canvas 를 CSS 로 임시 확대해 깜빡임을 줄인다.
  const prev = Number(els.canvas.getAttribute('data-scale')) || 0;
  if (prev > 0 && prev !== state.scale) {
    els.pageWrap.style.transformOrigin = 'top center';
    els.pageWrap.style.transform = 'scale(' + (state.scale / prev) + ')';
  }

  const out = await render.renderPageInto(pdfDoc, state.pageNo, els.canvas, state.scale, dpr());
  if (token !== state.token) return;

  els.pageWrap.style.transform = '';
  els.canvas.setAttribute('data-scale', String(state.scale));
  els.canvas.setAttribute('aria-label', t('reader.original.canvas', { page: formatNumber(state.pageNo) }));
  els.pageWrap.style.inlineSize = out.cssWidth + 'px';
  els.pageWrap.style.blockSize = out.cssHeight + 'px';
  state.viewport = out.viewport;

  paintZoom();
  moveOverlay();
}

function availableWidth() {
  if (!els || !els.scroller) return 0;
  const w = els.scroller.clientWidth;
  return w > 0 ? w : 0;
}

function dpr() {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

/** 12-5 DOM (4-12 구조 그대로). 한 번 만들고 쪽마다 다시 쓴다. */
function buildDom(mount) {
  if (els && els.root && els.root.parentNode === mount) { return; }
  clear(mount);

  const root = el('div', 'original');

  /* 줌 막대 — 하단은 컨트롤 바·쪽 이동 바·고지 바가 이미 차지했다(12-3).
     그래서 본문 **위**에 붙인다. 375px 에서 버튼 3개가 넘치지 않는다. */
  const bar = el('div', 'original-bar');
  const out = el('span', 'original-zoom-out');
  out.id = 'originalZoomOut';
  const minus = button('original-zoom', 'reader.original.zoomOut');
  minus.setAttribute('data-zoom', '-1');
  const plus = button('original-zoom', 'reader.original.zoomIn');
  plus.setAttribute('data-zoom', '1');
  bar.appendChild(minus);
  bar.appendChild(out);
  bar.appendChild(plus);
  bar.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('button[data-zoom]') : null;
    if (!b) return;
    zoomBy(Number(b.getAttribute('data-zoom')));
  });
  root.appendChild(bar);

  const status = el('p', 'original-status muted');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);

  // 확대 상태에서 수평 스크롤을 허용한다(12-5).
  const scroller = el('div', 'original-scroll');
  const pageWrap = el('div', 'page-wrap');
  const canvas = el('canvas', 'page-canvas');
  // 원서 쪽 그림이다. 대체 텍스트는 리플로우 뷰가 이미 제공한다.
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('reader.original.canvas', { page: formatNumber(state.pageNo) }));
  pageWrap.appendChild(canvas);

  const layer = el('div', 'hl-layer');
  const hl = el('div', 'hl-line');
  hl.hidden = true;
  layer.appendChild(hl);
  pageWrap.appendChild(layer);

  // 4-12 — 탭 좌표를 PDF 좌표로 되돌려 줄을 찾는다.
  pageWrap.addEventListener('pointerup', onPointerUp);

  scroller.appendChild(pageWrap);
  root.appendChild(scroller);
  mount.appendChild(root);

  els = { root: root, bar: bar, zoomOut: out, status: status, scroller: scroller, pageWrap: pageWrap, canvas: canvas, layer: layer, hl: hl };
}

function onPointerUp(ev) {
  if (!state.viewport || !els) return;
  const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
  if (sel && String(sel).length > 0) return;
  const id = lineIdAtClient(ev.clientX, ev.clientY);
  if (!id) return;
  if (deps && deps.onLineTap) { try { deps.onLineTap(id); } catch (e) { /* 구독자 예외 */ } }
}

/** 화면 좌표 → canvas 좌표 → PDF 좌표 → 줄(4-12). 테스트는 `render.lineAtPoint` 가 진다. */
function lineIdAtClient(clientX, clientY) {
  const rect = els.canvas.getBoundingClientRect();
  const pt = render.pdfPoint(state.viewport, clientX - rect.x, clientY - rect.y);
  if (!pt) return null;
  const lines = (state.layout && state.layout.lines) || [];
  // 손가락은 줄보다 굵다. 줄 사이 빈틈을 놓치지 않도록 약간의 여유를 준다.
  const slack = (Number(state.layout && state.layout.stats && state.layout.stats.medianFontSize) || 10) * 0.3;
  const hit = render.lineAtPoint(lines, pt, { slack: slack });
  return hit ? hit.id : null;
}

/* ────────────────────────────────────────────────────────
   오버레이 — `.hl-line` **하나**를 옮긴다(4-12).
   ──────────────────────────────────────────────────────── */

/**
 * 6-5 — 낭독이 옮겨 간 줄들. 원본 뷰의 하이라이트는 이 한 함수뿐이다.
 * @returns {boolean} 그 줄들이 지금 쪽에 있고 그릴 수 있었는가
 */
export function setCurrentOriginal(lineIds) {
  state.currentIds = (Array.isArray(lineIds) ? lineIds : [lineIds]).filter((x) => x != null).map(String);
  return moveOverlay();
}

export function clearCurrentOriginal() {
  state.currentIds = [];
  if (els && els.hl) els.hl.hidden = true;
}

/** 지금 상태로 오버레이 상자를 다시 계산한다(줌·회전·리사이즈 뒤에도 같은 길). */
function moveOverlay() {
  if (!els || !els.hl) return false;
  const box = unionBox(state.currentIds);
  if (!box || !state.viewport) { els.hl.hidden = true; return false; }

  const r = render.viewportRect(box, state.viewport);
  if (!(r.width > 0 && r.height > 0)) { els.hl.hidden = true; return false; }

  els.hl.hidden = false;
  els.hl.style.inlineSize = r.width + 'px';
  els.hl.style.blockSize = r.height + 'px';
  els.hl.style.transform = 'translate(' + r.left + 'px, ' + r.top + 'px)';
  els.hl.setAttribute('data-line-id', state.currentIds[0] || '');
  return true;
}

/**
 * 문장 모드에서는 한 발화가 여러 줄에 걸친다. 줄마다 상자를 만들지 않고
 * **합집합 하나**로 그린다(4-12 — DOM 은 언제나 1개).
 * 회전 줄은 합집합에서 빠진다.
 */
function unionBox(ids) {
  const lines = (state.layout && state.layout.lines) || [];
  const want = new Set(ids || []);
  if (!want.size) return null;
  const page = state.layout ? { width: state.layout.width, height: state.layout.height } : null;

  let acc = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!want.has(String(l.id))) continue;
    if (!render.overlayable(l)) continue;            // ★ 회전 줄은 그리지 않는다
    const b = render.highlightBox(l, page);
    if (!b) continue;
    acc = acc ? {
      x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0),
      x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1)
    } : b;
  }
  return acc;
}

/** 6-5 자동 스크롤 — 오버레이가 스크롤 상자 밖이면 가운데로 끌어온다. */
export function scrollCurrentIntoView(force) {
  if (!els || !els.hl || els.hl.hidden) return false;
  try {
    els.hl.scrollIntoView({ block: 'center', inline: 'center', behavior: force ? 'auto' : 'smooth' });
  } catch (e) {
    els.hl.scrollIntoView(true);
  }
  return true;
}

/**
 * 뷰 전환의 착지(12-3 "같은 줄을 기준으로 위치를 유지한다"). `pickAnchorLine`
 * 이 고른 줄을 화면 가운데로 끌어온다. 그 줄이 이 쪽에 없으면 false.
 */
export function scrollToLine(lineId) {
  if (!els || !state.viewport || lineId == null) return false;
  const box = unionBox([String(lineId)]);
  if (!box) return false;
  const r = render.viewportRect(box, state.viewport);
  const target = Math.max(0, r.top - (els.scroller.clientHeight || 0) / 2 + r.height / 2);
  try {
    els.scroller.scrollTo({ top: target, behavior: 'auto' });
  } catch (e) {
    els.scroller.scrollTop = target;
  }
  return true;
}

/** 4-8 — 리플로우의 [원본으로 보기]가 이 뷰의 표 자리로 끌고 온다(12-5). */
export function scrollToRegion(regionId) {
  const regions = (state.layout && state.layout.regions) || [];
  for (let i = 0; i < regions.length; i++) {
    if (String(regions[i].id) !== String(regionId)) continue;
    if (!state.viewport || !els) return false;
    const r = render.viewportRect(regions[i].bbox, state.viewport);
    try {
      els.scroller.scrollTo({ top: Math.max(0, r.top - 24), behavior: 'auto' });
    } catch (e) {
      els.scroller.scrollTop = Math.max(0, r.top - 24);
    }
    return true;
  }
  return false;
}

/* ────────────────────────────────────────────────────────
   줌 (12-5) — 다시 렌더하고 오버레이를 같은 viewport 로 다시 계산한다.
   ──────────────────────────────────────────────────────── */

export async function zoomBy(dir) {
  const next = render.zoomStep(state.scale, dir);
  if (next === state.scale) { paintZoom(); return; }
  state.scale = next;
  state.userZoom = true;
  await rerender();
}

/** 화면 회전·리사이즈(12-3) — 사용자가 줌을 건드리지 않았으면 폭에 다시 맞춘다. */
export async function refitOriginal() {
  if (!els || !state.layout) return;
  if (state.userZoom) { moveOverlay(); return; }
  await rerender();
}

async function rerender() {
  if (!state.layout || !deps || !deps.getPdfDoc) return;
  const token = ++state.token;
  let pdfDoc = null;
  try {
    pdfDoc = await deps.getPdfDoc(state.docId);
  } catch (e) {
    if (token === state.token) fail(e);
    return;
  }
  if (!pdfDoc || token !== state.token) return;
  try {
    await paint(pdfDoc, token);
  } catch (e) {
    if (token === state.token) setStatus('reader.original.failed');
  }
}

function paintZoom() {
  if (!els) return;
  els.zoomOut.textContent = t('reader.original.zoom', {
    percent: formatNumber(Math.round(state.scale * 100))
  });
  const btns = els.bar.querySelectorAll('button[data-zoom]');
  for (let i = 0; i < btns.length; i++) {
    const dir = Number(btns[i].getAttribute('data-zoom'));
    const next = render.zoomStep(state.scale, dir);
    btns[i].disabled = next === state.scale;
  }
}

/* ────────────────────────────────────────────────────────
   작은 것들
   ──────────────────────────────────────────────────────── */

/** 언어 전환 — 이 뷰의 동적 문구를 다시 쓴다(16-H, 새로고침 없이). */
export function relabelOriginal() {
  if (!els) return;
  paintZoom();
  els.canvas.setAttribute('aria-label', t('reader.original.canvas', { page: formatNumber(state.pageNo) }));
  const key = els.status.getAttribute('data-i18n');
  if (key) els.status.textContent = t(key);
}

export function leaveOriginal() {
  state.currentIds = [];
  state.viewport = null;
  state.layout = null;
  els = null;
}

/**
 * 뷰 전환의 기준 줄을 고르기 위해 **원본 뷰가 아는 사실**을 모은다
 * (`pickAnchorLine` 의 `ctx` 조각). 순수 함수가 아니어도 되는 부분은 여기다.
 */
export function visibleLineIds() {
  if (!els || !state.viewport || !state.layout) return { visible: [], center: null };
  const rect = els.scroller.getBoundingClientRect();
  const canvasRect = els.canvas.getBoundingClientRect();
  const midY = rect.y + rect.height / 2;

  const lines = state.layout.lines || [];
  const visible = [];
  let center = null;
  let bestDist = Infinity;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!render.overlayable(l)) continue;
    const r = render.viewportRect(l.bbox, state.viewport);
    const top = canvasRect.y + r.top;
    const bottom = top + r.height;
    if (bottom < rect.y || top > rect.y + rect.height) continue;
    visible.push(String(l.id));
    const d = Math.abs((top + bottom) / 2 - midY);
    if (d < bestDist) { bestDist = d; center = String(l.id); }
  }
  return { visible: visible, center: center };
}

function setStatus(key) {
  if (!els) return;
  if (!key) {
    els.status.hidden = true;
    els.status.removeAttribute('data-i18n');
    els.status.textContent = '';
    return;
  }
  els.status.hidden = false;
  els.status.setAttribute('data-i18n', key);
  els.status.textContent = t(key);
}

function button(cls, key) {
  const b = el('button', cls);
  b.type = 'button';
  b.setAttribute('data-i18n', key);
  b.setAttribute('data-i18n-aria', key);
  b.textContent = t(key);
  return b;
}

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
