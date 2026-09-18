/* ============================================================
   MedReader — 줄 재구성 프로토타입 검증 페이지 (spec 4-11)

   이 파일은 개발 도구다. 알고리즘은 한 줄도 복사하지 않고
   ../js/text/layout.js 와 ../js/config.js 를 그대로 import 한다.
   모든 동적 텍스트는 textContent 로만 넣는다.
   ============================================================ */

import {
  LAYOUT, PDFJS_CDN_PRIMARY, pdfjsMainUrl, pdfjsWorkerUrl, PDF_TEXT_CONTENT_OPTIONS
} from '../js/config.js';
import { buildPageLayout } from '../js/text/layout.js';

const qs = new URLSearchParams(location.search);

const el = {
  file: document.getElementById('fileInput'),
  pageNo: document.getElementById('pageNo'),
  prev: document.getElementById('prevPage'),
  next: document.getElementById('nextPage'),
  exportBtn: document.getElementById('exportItems'),
  importItems: document.getElementById('importItems'),
  statsRun: document.getElementById('statsRun'),
  statsStop: document.getElementById('statsStop'),
  statsBox: document.getElementById('statsBox'),
  statsTable: document.getElementById('statsTable'),
  status: document.getElementById('status'),
  canvas: document.getElementById('canvas'),
  wrap: document.getElementById('pageWrap'),
  layer: document.getElementById('hlLayer'),
  list: document.getElementById('lineList'),
  summary: document.getElementById('summary'),
  pY: document.getElementById('pY'), oY: document.getElementById('oY'),
  pS: document.getElementById('pS'), oS: document.getElementById('oS'),
  pR: document.getElementById('pR'), oR: document.getElementById('oR'),
  pG: document.getElementById('pG'), oG: document.getElementById('oG'),
  reset: document.getElementById('resetParams')
};

const state = {
  lib: null,          // pdf.js 모듈
  doc: null,          // PDFDocumentProxy
  viewport: null,     // 현재 페이지 뷰포트 (PDF 경로에서만)
  scale: 1,
  items: null,        // 현재 페이지의 getTextContent().items
  styles: null,
  info: null,         // { pageNo, width, height }
  layout: null,
  stop: false
};

/* ────────────────────────────────────────────────
   상태 표시
   ──────────────────────────────────────────────── */
function setStatus(text, isError) {
  el.status.textContent = text;
  el.status.classList.toggle('err', !!isError);
}

/* ────────────────────────────────────────────────
   파라미터 슬라이더 (spec 4-11 프로토타입 요구)
   ──────────────────────────────────────────────── */
function currentParams() {
  return Object.assign({}, LAYOUT, {
    Y_TOL_FACTOR: Number(el.pY.value),
    SPACE_GAP_FACTOR: Number(el.pS.value),
    RUN_GAP_FACTOR: Number(el.pR.value),
    GUTTER_MIN_RATIO: Number(el.pG.value)
  });
}

function syncParamOutputs() {
  el.oY.textContent = Number(el.pY.value).toFixed(2);
  el.oS.textContent = Number(el.pS.value).toFixed(2);
  el.oR.textContent = Number(el.pR.value).toFixed(1);
  el.oG.textContent = Number(el.pG.value).toFixed(2);
}

function resetParams() {
  el.pY.value = String(LAYOUT.Y_TOL_FACTOR);
  el.pS.value = String(LAYOUT.SPACE_GAP_FACTOR);
  el.pR.value = String(LAYOUT.RUN_GAP_FACTOR);
  el.pG.value = String(LAYOUT.GUTTER_MIN_RATIO);
  syncParamOutputs();
}

/* ────────────────────────────────────────────────
   pdf.js 로딩 (spec 2-3, ?pdfjs= 로 경로 교체 가능)
   ──────────────────────────────────────────────── */
async function loadPdfjs() {
  if (state.lib) return state.lib;
  const base = qs.get('pdfjs') || PDFJS_CDN_PRIMARY();
  setStatus('pdf.js 로딩 중: ' + pdfjsMainUrl(base));
  const lib = await import(/* @vite-ignore */ pdfjsMainUrl(base));
  lib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl(base);
  state.lib = lib;
  setStatus('pdf.js 준비 완료 (' + pdfjsMainUrl(base) + ')');
  return lib;
}

async function openBuffer(buf, label) {
  const lib = await loadPdfjs();
  if (state.doc) { try { await state.doc.destroy(); } catch (e) { /* 무시 */ } }
  state.doc = await lib.getDocument({ data: buf }).promise;
  setStatus(label + ' — ' + state.doc.numPages + '쪽');
  el.pageNo.max = String(state.doc.numPages);
  const start = Math.min(Math.max(1, Number(qs.get('page') || el.pageNo.value || 1)), state.doc.numPages);
  el.pageNo.value = String(start);
  await showPage(start);
}

/* ────────────────────────────────────────────────
   페이지 렌더 + 텍스트 추출
   ──────────────────────────────────────────────── */
async function showPage(n) {
  if (!state.doc) return;
  const page = await state.doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const maxW = Math.max(320, Math.min(720, Math.floor(window.innerWidth * 0.46)));
  state.scale = maxW / base.width;
  const viewport = page.getViewport({ scale: state.scale });
  state.viewport = viewport;

  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = Math.floor(viewport.width * dpr);
  el.canvas.height = Math.floor(viewport.height * dpr);
  el.canvas.style.width = viewport.width + 'px';
  el.canvas.style.height = viewport.height + 'px';
  el.wrap.style.width = viewport.width + 'px';
  el.wrap.style.height = viewport.height + 'px';
  const ctx = el.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  await page.render({ canvasContext: ctx, viewport: viewport, transform: [dpr, 0, 0, dpr, 0, 0] }).promise;

  const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
  state.items = tc.items;
  state.styles = tc.styles || {};
  state.info = { pageNo: n, width: base.width, height: base.height };
  page.cleanup();
  recompute();
}

/* items JSON 픽스처로 직접 검증 (PDF 없이) */
function useItemsPayload(payload, label) {
  state.doc = null;
  state.viewport = null;
  state.items = payload.items || [];
  state.styles = payload.styles || {};
  state.info = {
    pageNo: payload.pageNo == null ? 1 : payload.pageNo,
    width: Number(payload.width) || 612,
    height: Number(payload.height) || 792
  };
  el.pageNo.value = String(state.info.pageNo);

  // PDF 가 없으므로 흰 캔버스를 깔고 그 위에 bbox 만 그린다
  const maxW = Math.max(320, Math.min(720, Math.floor(window.innerWidth * 0.46)));
  state.scale = maxW / state.info.width;
  const w = state.info.width * state.scale;
  const h = state.info.height * state.scale;
  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = Math.floor(w * dpr);
  el.canvas.height = Math.floor(h * dpr);
  el.canvas.style.width = w + 'px';
  el.canvas.style.height = h + 'px';
  el.wrap.style.width = w + 'px';
  el.wrap.style.height = h + 'px';
  const ctx = el.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);

  setStatus(label + ' — items ' + state.items.length + '개 (PDF 없이 픽스처 검증)');
  recompute();
}

/* ────────────────────────────────────────────────
   좌표 변환 (spec 4-12)
   PDF 가 있으면 viewport.convertToViewportPoint 를 쓴다.
   픽스처 모드에는 뷰포트가 없으므로 같은 식을 직접 적용한다.
   ──────────────────────────────────────────────── */
function toViewport(x, y) {
  if (state.viewport) return state.viewport.convertToViewportPoint(x, y);
  return [x * state.scale, (state.info.height - y) * state.scale];
}

function boxOf(bbox) {
  const a = toViewport(bbox.x0, bbox.y0);
  const b = toViewport(bbox.x1, bbox.y1);
  return {
    left: Math.min(a[0], b[0]),
    top: Math.min(a[1], b[1]),
    width: Math.abs(b[0] - a[0]),
    height: Math.abs(b[1] - a[1])
  };
}

/* ────────────────────────────────────────────────
   재계산 + 그리기
   ──────────────────────────────────────────────── */
function recompute() {
  if (!state.items) return;
  const t0 = performance.now();
  state.layout = buildPageLayout(state.items, {
    pageNo: state.info.pageNo,
    width: state.info.width,
    height: state.info.height,
    styles: state.styles
  }, currentParams());
  const ms = performance.now() - t0;
  drawOverlay(state.layout);
  renderList(state.layout, ms);
}

function drawOverlay(layout) {
  el.layer.textContent = '';
  for (const line of layout.lines) {
    const b = boxOf(line.bbox);
    const d = document.createElement('div');
    d.className = 'hl role-' + line.role;
    d.style.left = b.left + 'px';
    d.style.top = b.top + 'px';
    d.style.width = Math.max(1, b.width) + 'px';
    d.style.height = Math.max(1, b.height) + 'px';
    d.title = line.id + ' ' + line.role;
    el.layer.appendChild(d);

    // 위첨자로 합류한 아이템 표시
    for (const it of line.items) {
      if (!it.sup) continue;
      const sb = boxOf({
        x0: it.x, x1: it.x + it.w,
        y0: it.y + it.descent * it.fontSize,
        y1: it.y + it.ascent * it.fontSize
      });
      const s = document.createElement('div');
      s.className = 'hlSup';
      s.style.left = sb.left + 'px';
      s.style.top = sb.top + 'px';
      s.style.width = Math.max(2, sb.width) + 'px';
      s.style.height = Math.max(2, sb.height) + 'px';
      el.layer.appendChild(s);
    }
  }
  for (const gx of layout.columns.gutters) {
    const p = toViewport(gx, 0);
    const g = document.createElement('div');
    g.className = 'hlGutter';
    g.style.left = p[0] + 'px';
    el.layer.appendChild(g);
  }
}

function renderList(layout, ms) {
  const warn = layout.stats.warn ? ' / 경고: ' + layout.stats.warn : '';
  el.summary.textContent =
    'p' + layout.pageNo + ' · 줄 ' + layout.lines.length +
    ' · 컬럼 ' + layout.columns.count +
    ' · 문단 ' + layout.paragraphs.length +
    ' · 표 ' + layout.regions.length +
    ' · Fm ' + layout.stats.medianFontSize.toFixed(1) +
    ' · Lm ' + layout.stats.medianLeading.toFixed(1) +
    ' · ' + ms.toFixed(1) + 'ms' + warn;

  // hasEOL 힌트가 실제로 있는 문서에서만 불일치를 표시한다
  let hasHints = false;
  for (const l of layout.lines) for (const it of l.items) if (it.hasEOL) { hasHints = true; break; }

  el.list.textContent = '';
  let prevPara = null;
  layout.lines.forEach((line, i) => {
    const li = document.createElement('li');
    li.className = 'role-' + line.role;
    if (line.paraId && line.paraId !== prevPara) li.classList.add('paraStart');
    prevPara = line.paraId;

    if (hasHints) {
      const last = line.items[line.items.length - 1];
      let mismatch = !!last && last.hasEOL === false;
      for (let k = 0; k < line.items.length - 1; k++) if (line.items[k].hasEOL) mismatch = true;
      if (mismatch) li.classList.add('eolMismatch');
    }

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = '#' + i + ' col=' + line.col + ' ' + line.role +
      ' fs=' + line.fontSize.toFixed(1) + ' runs=' + line.runs.length;
    li.appendChild(meta);

    const txt = document.createElement('span');
    txt.className = 'txt';
    if (line.hyphenJoin) {
      // 다음 줄과 하이픈으로 결합되는 마지막 낱말을 굵게
      const m = line.text.match(/(\S+)$/);
      if (m) {
        txt.appendChild(document.createTextNode(line.text.slice(0, m.index)));
        const b = document.createElement('span');
        b.className = 'hy';
        b.textContent = m[1];
        txt.appendChild(b);
      } else {
        txt.textContent = line.text;
      }
    } else {
      txt.textContent = line.text;
    }
    li.appendChild(txt);
    el.list.appendChild(li);
  });
}

/* ────────────────────────────────────────────────
   items JSON 내보내기 / 불러오기
   ──────────────────────────────────────────────── */
function exportItems() {
  if (!state.items) { setStatus('내보낼 items 가 없습니다.', true); return; }
  const payload = {
    source: 'medreader/proto-lines',
    pageNo: state.info.pageNo,
    width: state.info.width,
    height: state.info.height,
    styles: state.styles,
    items: state.items.map(it => ({
      str: it.str, dir: it.dir, transform: it.transform,
      width: it.width, height: it.height, fontName: it.fontName, hasEOL: !!it.hasEOL
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'items-p' + state.info.pageNo + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus('items JSON 을 내려받았습니다: ' + a.download);
}

/* ────────────────────────────────────────────────
   전체 문서 통계 모드 (spec 4-11)
   ──────────────────────────────────────────────── */
async function runStats() {
  if (!state.doc) { setStatus('통계 모드는 PDF 를 연 뒤에 쓸 수 있습니다.', true); return; }
  state.stop = false;
  el.statsStop.disabled = false;
  el.statsRun.disabled = true;
  el.statsBox.hidden = false;
  const rows = [];
  const params = currentParams();
  const total = state.doc.numPages;

  for (let n = 1; n <= total; n++) {
    if (state.stop) break;
    const page = await state.doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
    const layout = buildPageLayout(tc.items, {
      pageNo: n, width: vp.width, height: vp.height, styles: tc.styles || {}
    }, params);
    page.cleanup();
    let meta = 0;
    for (const l of layout.lines) if (l.role === 'header' || l.role === 'footer' || l.role === 'pageno') meta++;
    rows.push({
      page: n,
      lines: layout.lines.length,
      cols: layout.columns.count,
      tables: layout.regions.length,
      meta: meta,
      warn: layout.stats.warn || ''
    });
    if (n % 5 === 0) {
      setStatus('통계 수집 ' + n + ' / ' + total);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  drawStats(rows);
  setStatus('통계 완료: ' + rows.length + '쪽');
  el.statsStop.disabled = true;
  el.statsRun.disabled = false;
}

function drawStats(rows) {
  el.statsTable.textContent = '';
  const head = document.createElement('tr');
  for (const h of ['쪽', '줄', '컬럼', '표', '헤더/푸터', '경고']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  }
  el.statsTable.appendChild(head);

  rows.forEach((r, i) => {
    const prev = rows[i - 1], next = rows[i + 1];
    const colOdd = (prev && next && r.cols !== prev.cols && r.cols !== next.cols);
    const tr = document.createElement('tr');
    if (r.lines === 0 || colOdd || r.warn) tr.className = 'outlier';
    for (const v of [r.page, r.lines, r.cols, r.tables, r.meta, r.warn]) {
      const td = document.createElement('td');
      td.textContent = String(v);
      tr.appendChild(td);
    }
    el.statsTable.appendChild(tr);
  });
}

/* ────────────────────────────────────────────────
   이벤트
   ──────────────────────────────────────────────── */
el.file.addEventListener('change', async () => {
  const f = el.file.files && el.file.files[0];
  if (!f) return;
  try {
    const buf = await f.arrayBuffer();
    await openBuffer(buf, f.name);
  } catch (err) {
    setStatus('PDF 열기 실패: ' + (err && err.message ? err.message : String(err)), true);
  }
});

el.importItems.addEventListener('change', async () => {
  const f = el.importItems.files && el.importItems.files[0];
  if (!f) return;
  try {
    useItemsPayload(JSON.parse(await f.text()), f.name);
  } catch (err) {
    setStatus('items JSON 불러오기 실패: ' + (err && err.message ? err.message : String(err)), true);
  }
});

el.pageNo.addEventListener('change', () => {
  const n = Number(el.pageNo.value);
  if (state.doc && n >= 1 && n <= state.doc.numPages) showPage(n);
});
el.prev.addEventListener('click', () => {
  const n = Number(el.pageNo.value) - 1;
  if (state.doc && n >= 1) { el.pageNo.value = String(n); showPage(n); }
});
el.next.addEventListener('click', () => {
  const n = Number(el.pageNo.value) + 1;
  if (state.doc && n <= state.doc.numPages) { el.pageNo.value = String(n); showPage(n); }
});

el.exportBtn.addEventListener('click', exportItems);
el.statsRun.addEventListener('click', runStats);
el.statsStop.addEventListener('click', () => { state.stop = true; });
el.reset.addEventListener('click', () => { resetParams(); recompute(); });

for (const input of [el.pY, el.pS, el.pR, el.pG]) {
  input.addEventListener('input', () => { syncParamOutputs(); recompute(); });
}

/* ────────────────────────────────────────────────
   부팅 — 쿼리 파라미터 자동 진입점
   ──────────────────────────────────────────────── */
resetParams();

(async function boot() {
  const itemsUrl = qs.get('items');
  const pdfUrl = qs.get('pdf');
  try {
    if (itemsUrl) {
      setStatus('items JSON 내려받는 중: ' + itemsUrl);
      const res = await fetch(itemsUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      useItemsPayload(await res.json(), itemsUrl);
      return;
    }
    if (pdfUrl) {
      setStatus('PDF 내려받는 중: ' + pdfUrl);
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await openBuffer(await res.arrayBuffer(), pdfUrl);
    }
  } catch (err) {
    setStatus('자동 열기 실패: ' + (err && err.message ? err.message : String(err)), true);
  }
})();

// 콘솔 디버그용 (개발 페이지 한정)
window.__proto = state;
