/* ============================================================
   MedReader — 추출·저장 프로토타입 (spec 9-2 · 9-4)

   개발 도구다. 알고리즘·저장·추출은 한 줄도 복사하지 않고 ../js/ 를 그대로
   쓴다. 유일한 예외가 `makeStored` 인데, 이것은 **9-2 축소 규칙을 하나씩 꺼
   보기 위한** 측정 장치다. 규칙을 전부 켠 결과가 `toStored` 와 바이트 단위로
   같은지 화면에서 스스로 검사한다(C1). 같지 않으면 측정값을 믿지 않는다.

   모든 동적 텍스트는 textContent 로만 넣는다.
   ============================================================ */

import { EXTRACT } from '../js/config.js';
import { algoVersion } from '../js/text/layout.js';
import { toStored, fromStored, storeVersion, round2 } from '../js/text/store.js';
import { fileIdentityHash } from '../js/hash.js';
import { loadPdfjs, openDocument, currentBase } from '../js/pdf/loader.js';
import { Extractor, STATUS } from '../js/pdf/extract.js';
import * as db from '../js/db.js';

const qs = new URLSearchParams(location.search);

const el = {
  file: document.getElementById('fileInput'),
  start: document.getElementById('startBtn'),
  pause: document.getElementById('pauseBtn'),
  speak: document.getElementById('speakBtn'),
  reimport: document.getElementById('reimportBtn'),
  del: document.getElementById('delBtn'),
  wipe: document.getElementById('wipeBtn'),
  status: document.getElementById('status'),
  fill: document.getElementById('progressFill'),
  docBox: document.getElementById('docBox'),
  storage: document.getElementById('storageBox'),
  peekNo: document.getElementById('peekNo'),
  peekBtn: document.getElementById('peekBtn'),
  peekBox: document.getElementById('peekBox'),
  peekText: document.getElementById('peekText'),
  pageCount: document.getElementById('pageCount'),
  measure: document.getElementById('measureBtn'),
  variantNote: document.getElementById('variantNote'),
  result: document.getElementById('resultTable'),
  effect: document.getElementById('effectTable'),
  scale: document.getElementById('scaleTable'),
  checks: document.getElementById('checks'),
  log: document.getElementById('log')
};

const state = {
  pdfDoc: null,
  doc: null,           // documents 레코드
  ex: null,            // Extractor
  busy: false,
  lastPaint: 0,
  failTimes: new Map() // 강제 실패 주입: pageNo → 남은 실패 횟수
};

/* ────────────────────────────────────────────────
   표시 유틸 — 전부 textContent
   ──────────────────────────────────────────────── */
function setStatus(text, isError) {
  el.status.textContent = text;
  el.status.classList.toggle('err', !!isError);
}

function log(line) {
  el.log.textContent += line + '\n';
  el.log.scrollTop = el.log.scrollHeight;
}

function setProgress(done, total) {
  el.fill.style.width = (total > 0 ? Math.round((done / total) * 100) : 0) + '%';
}

function fmtBytes(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1048576) return (n / 1048576).toFixed(2) + ' MB';
  if (Math.abs(n) >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}
function fmtKB(n) { return (n == null || !Number.isFinite(n)) ? '—' : (n / 1024).toFixed(2); }
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function table(node, head, rows, baseRowIndex) {
  clear(node);
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of head) {
    const th = document.createElement('th');
    th.textContent = h;
    htr.appendChild(th);
  }
  thead.appendChild(htr);
  node.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === baseRowIndex) tr.className = 'base';
    for (const c of r) {
      const td = document.createElement('td');
      td.textContent = String(c);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  node.appendChild(tbody);
}

function kv(node, pairs) {
  clear(node);
  for (const [k, v] of pairs) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = String(v);
    node.appendChild(dt);
    node.appendChild(dd);
  }
}

function check(ok, text) {
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'bad';
  li.textContent = text;
  el.checks.appendChild(li);
}

const enc = new TextEncoder();
function jsonBytes(v) { return enc.encode(JSON.stringify(v)).length; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function uuid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return 'x' + Date.now().toString(16) + Math.random().toString(16).slice(2);
}

/* ============================================================
   A. 가져오기 → 추출 → 재개 (spec 9-4)
   ============================================================ */

/** 강제 실패 주입 — 9-4 "한 쪽이 던져도 멈추지 않는다" 를 눈으로 본다. */
function injectFailures(pdfDoc) {
  const spec = qs.get('fail');
  if (!spec) return pdfDoc;
  const times = Math.max(1, Number(qs.get('failtimes')) || 1);
  for (const s of spec.split(',')) {
    const n = Number(s.trim());
    if (Number.isFinite(n) && n >= 1) state.failTimes.set(n, times);
  }
  log('강제 실패 주입: ' + [...state.failTimes.keys()].join(', ') + ' (각 ' + times + '회)');
  const real = pdfDoc.getPage.bind(pdfDoc);
  pdfDoc.getPage = (n) => {
    const left = state.failTimes.get(n) || 0;
    if (left > 0) {
      state.failTimes.set(n, left - 1);
      return Promise.reject(new Error('주입된 실패 (page ' + n + ')'));
    }
    return real(n);
  };
  return pdfDoc;
}

async function ensurePdfjs() {
  const override = qs.get('pdfjs');
  // ?pdfjs= 는 **개발 전용**이다. loader.js 로 옮기지 않는다.
  await loadPdfjs(override ? [override] : undefined);
  log('pdf.js base: ' + currentBase());
}

async function attachDoc(doc, blob) {
  state.doc = doc;
  const buf = await blob.arrayBuffer();
  await ensurePdfjs();
  const pdfDoc = injectFailures(await openDocument(buf));
  state.pdfDoc = pdfDoc;

  if (doc.pageCount !== pdfDoc.numPages) {
    doc.pageCount = pdfDoc.numPages;
    await db.put('documents', doc);
  }

  const ex = new Extractor({ docId: doc.id, pdfDoc: pdfDoc, pageCount: pdfDoc.numPages });
  ex.setCurrentPage(doc.lastPage || 1);
  ex.addEventListener('progress', (e) => paint(e.detail));
  ex.addEventListener('pageerror', (e) => log('실패: ' + e.detail.pageNo + ' — ' + e.detail.message));
  ex.addEventListener('reextract', () => log('algoVersion 이 올랐다 → cursor ← 1, failed ← []'));
  ex.addEventListener('fatal', (e) => {
    setStatus('치명적 실패: ' + e.detail.code + ' (page ' + e.detail.pageNo + ')', true);
    log('fatal: ' + e.detail.code);
  });
  ex.addEventListener('done', () => {
    setStatus('추출 완료 — ' + state.ex.ex.pagesDone + '/' + state.ex.pageCount);
    log('done. 역할 재계산 ' + state.ex.stats.recomputed + '쪽, buildMs ' + state.ex.stats.buildMs);
    refreshStorage();
  });
  ex.addEventListener('stalled', (e) => {
    setStatus('멈춤 — 실패가 남았다: ' + e.detail.failed.join(', '), true);
    refreshStorage();
  });
  state.ex = ex;

  const plan = await ex.prepare();
  log('재개 계획: cursor=' + plan.cursor + ', pagesDone=' + plan.pagesDone +
      ', failed=[' + plan.failed.join(',') + '], algoVersion=' + plan.algoVersion +
      (plan.reextract ? ' (전체 되감김)' : ''));
  el.start.disabled = false;
  el.del.disabled = false;
  el.reimport.disabled = !qs.get('pdf');
  el.speak.disabled = false;
  el.measure.disabled = false;
  setStatus(doc.fileName + ' — ' + pdfDoc.numPages + '쪽. cursor ' + plan.cursor + ' 에서 이어집니다.');
  await refreshStorage();
}

async function importBlob(blob, label) {
  setStatus('파일 해시 계산 중…');
  const t0 = performance.now();
  const fileHash = await fileIdentityHash(blob);
  log('fileHash(' + Math.round(performance.now() - t0) + 'ms): ' + fileHash);

  let doc = await db.findByFileHash(fileHash);
  if (doc) {
    log('같은 fileHash 의 문서가 이미 있다 → 중복 생성 없음 (id ' + doc.id + ')');
    doc.lastOpenedAt = Date.now();
    await db.put('documents', doc);
  } else {
    doc = {
      id: uuid(),
      title: label, fileName: label, size: blob.size,
      pageCount: 0, fileHash: fileHash,
      addedAt: Date.now(), lastOpenedAt: Date.now(),
      lastPage: 1, lastLineId: null, lang: 'en',
      extraction: { done: false, pagesDone: 0, cursor: 1, failed: [], algoVersion: 0 },
      columnsHint: null, sectionIndex: []
    };
    await db.put('documents', doc);
    await db.put('blobs', { docId: doc.id, blob: blob });
    log('새 문서: ' + doc.id);
  }
  await attachDoc(doc, blob);
}

/** 새로고침 후 가장 최근 문서를 되살린다 — 재개 검증의 전제다. */
async function restoreLast() {
  let newest = null;
  await db.iterate('documents', { index: 'lastOpenedAt', direction: 'prev' }, (v) => {
    newest = v;
    return false;
  });
  if (!newest) return false;
  const b = await db.get('blobs', newest.id);
  if (!b || !b.blob) return false;
  log('이전 문서를 되살린다: ' + newest.fileName);
  await attachDoc(newest, b.blob);
  return true;
}

function paint(d) {
  const now = Date.now();
  if (now - state.lastPaint < 200 && d.status === STATUS.RUNNING) return;
  state.lastPaint = now;
  setProgress(d.pagesDone, d.pageCount);
  const wf = d.stats.items > 0 ? (d.stats.widthFixed / d.stats.items * 100).toFixed(2) + '%' : '—';
  kv(el.docBox, [
    ['문서', state.doc ? state.doc.fileName : '—'],
    ['docId', state.doc ? state.doc.id : '—'],
    ['fileHash', state.doc ? state.doc.fileHash : '—'],
    ['status', d.status],
    ['pagesDone / pageCount', d.pagesDone + ' / ' + d.pageCount],
    ['cursor', d.cursor],
    ['failed[]', d.failed.length ? d.failed.join(', ') : '(없음)'],
    ['roleDirty (이웃 대기)', d.roleDirty],
    ['done', String(d.done)],
    ['algoVersion / storeVersion', algoVersion + ' / ' + storeVersion],
    ['stats.widthFixed', d.stats.widthFixed + ' / ' + d.stats.items + ' items (' + wf + ')'],
    ['역할 재계산', d.stats.recomputed + '쪽'],
    ['buildPageLayout 누적', Math.round(d.stats.buildMs) + ' ms / ' + d.stats.pagesBuilt + '쪽']
  ]);
  if (d.status === STATUS.RUNNING) {
    setStatus('추출 중 ' + d.pagesDone + '/' + d.pageCount + ' (cursor ' + d.cursor + ')');
  }
}

async function refreshStorage() {
  const e = await db.estimate();
  const persisted = (navigator.storage && navigator.storage.persisted) ? await navigator.storage.persisted() : false;
  // pages 의 기본 키는 [docId, pageNo] 라 IDBKeyRange.only(docId) 로는 안 잡힌다.
  // docId 인덱스로 **키만** 센다(값을 올리지 않는다).
  const pages = state.doc ? (await db.keysOf('pages', 'docId', IDBKeyRange.only(state.doc.id))).length : 0;
  kv(el.storage, [
    ['quota', fmtBytes(e.quota)],
    ['usage', fmtBytes(e.usage)],
    ['persisted', String(persisted)],
    ['pages 행 수 (이 문서)', pages],
    // usage 에는 원본 PDF Blob 이 함께 들어 있다. 빼고 봐야 쪽당 점유가 나온다.
    ['pages 추정 (usage − blob)', state.doc ? fmtBytes(e.usage - state.doc.size) : '—'],
    ['쪽당 추정', (pages > 0 && state.doc) ? fmtKB((e.usage - state.doc.size) / pages) + ' KB' : '—'],
    ['EXTRACT.ITEMS_CACHE_MAX', EXTRACT.ITEMS_CACHE_MAX]
  ]);
}

/* 저장본 들여다보기 — items 없음 증명 + fromStored 왕복 */
async function peek() {
  if (!state.doc) return;
  const n = Math.max(1, Number(el.peekNo.value) || 1);
  const rec = await db.get('pages', [state.doc.id, n]);
  if (!rec) {
    kv(el.peekBox, [['결과', n + '쪽은 아직 저장되지 않았다']]);
    el.peekText.textContent = '';
    return;
  }
  const roles = {};
  for (const l of rec.lines) roles[l.role] = (roles[l.role] || 0) + 1;
  const runTextLines = rec.lines.filter((l) => l.runs.some((r) => 'text' in r)).length;
  const regionLines = rec.lines.filter((l) => l.regionId != null).length;
  const back = fromStored(rec);

  kv(el.peekBox, [
    ['최상위 키', Object.keys(rec).sort().join(', ')],
    ['lines[0] 키', rec.lines.length ? Object.keys(rec.lines[0]).sort().join(', ') : '—'],
    ['paragraphs[0] 키', rec.paragraphs.length ? Object.keys(rec.paragraphs[0]).sort().join(', ') : '—'],
    ['items 포함?', ('items' in rec) || rec.lines.some((l) => 'items' in l) ? '있음 (계약 위반)' : '없음 ○'],
    ['JSON 바이트', fmtBytes(jsonBytes(rec))],
    ['줄 수', rec.lines.length],
    ['역할 분포', Object.keys(roles).sort().map((k) => k + ' ' + roles[k]).join(', ')],
    ['문단 수', rec.paragraphs.length],
    ['region 수 (표/그림)', rec.regions.length],
    ['runs[].text 가 있는 줄', runTextLines + ' (region 줄 ' + regionLines + ')'],
    ['roleVersion / algoVersion / storeVersion', rec.roleVersion + ' / ' + rec.algoVersion + ' / ' + rec.storeVersion],
    ['neighborsUsed', rec.neighborsUsed ? ('prev=' + rec.neighborsUsed.prev + ' next=' + rec.neighborsUsed.next) : '—'],
    ['textHash', rec.textHash]
  ]);

  // fromStored 왕복 — 저장본에는 문단 text 가 없다. 아래 글자는 조립된 것이다.
  const lines = [];
  for (let i = 0; i < Math.min(5, back.paragraphs.length); i++) {
    const p = back.paragraphs[i];
    lines.push('[' + p.kind + '] ' + p.text.slice(0, 160));
  }
  el.peekText.textContent = lines.join('\n\n');
}

/* ============================================================
   B. 저장본 변형 만들기 — spec 9-2 축소 규칙을 하나씩 껐다 켠다

   opts.paraText   true  = 규칙 1 **끔** (paragraphs[].text 를 저장)
   opts.allRunText true  = 규칙 2 **끔** (표 밖 줄에도 runs[].text 저장)
   opts.round      false = 규칙 3 **끔** (좌표를 반올림하지 않음)
   ============================================================ */
function idNum(v, round) { return round ? round2(v) : Number(v); }

function box(b, round) {
  if (!b) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return {
    x0: idNum(b.x0, round), y0: idNum(b.y0, round),
    x1: idNum(b.x1, round), y1: idNum(b.y1, round)
  };
}

function makeStored(L0, opts) {
  const o = opts || {};
  const round = o.round !== false;
  const L = L0 || {};
  const lines = Array.isArray(L.lines) ? L.lines : [];
  const paragraphs = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  const regions = Array.isArray(L.regions) ? L.regions : [];

  const tableLineIds = new Set();
  for (let i = 0; i < regions.length; i++) {
    const ids = Array.isArray(regions[i].lineIds) ? regions[i].lineIds : [];
    for (let k = 0; k < ids.length; k++) tableLineIds.add(ids[k]);
  }

  const outLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const keepRunText = o.allRunText ? true : (tableLineIds.has(l.id) || !!l.regionId);
    const runs = Array.isArray(l.runs) ? l.runs : [];
    const outRuns = [];
    for (let k = 0; k < runs.length; k++) {
      const r = runs[k];
      const rec = { x0: idNum(r.x0, round), x1: idNum(r.x1, round) };
      if (keepRunText) rec.text = r.text;
      outRuns.push(rec);
    }
    outLines.push({
      id: l.id,
      text: l.text,
      bbox: box(l.bbox, round),
      baseline: idNum(l.baseline, round),
      fontSize: idNum(l.fontSize, round),
      col: l.col,
      role: l.role,
      hyphenJoin: !!l.hyphenJoin,
      paraId: l.paraId == null ? null : l.paraId,
      regionId: l.regionId == null ? null : l.regionId,
      runs: outRuns
    });
  }

  const outParas = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const rec = {
      id: p.id,
      lineIds: Array.isArray(p.lineIds) ? p.lineIds.slice() : [],
      kind: p.kind,
      bbox: box(p.bbox, round),
      continuesNext: !!p.continuesNext,
      continuesPrev: !!p.continuesPrev
    };
    if (o.paraText) rec.text = p.text;
    outParas.push(rec);
  }

  const outRegions = [];
  for (let i = 0; i < regions.length; i++) {
    const g = regions[i];
    outRegions.push({
      id: g.id,
      kind: g.kind,
      bbox: box(g.bbox, round),
      lineIds: Array.isArray(g.lineIds) ? g.lineIds.slice() : [],
      pageNo: g.pageNo
    });
  }

  const cols = L.columns || { count: 1, gutters: [] };
  const st = L.stats || {};
  return {
    pageNo: L.pageNo,
    width: idNum(L.width, round),
    height: idNum(L.height, round),
    algoVersion: L.algoVersion,
    storeVersion: storeVersion,
    lines: outLines,
    paragraphs: outParas,
    regions: outRegions,
    columns: {
      count: cols.count,
      gutters: (Array.isArray(cols.gutters) ? cols.gutters : []).map((g) => idNum(g, round))
    },
    stats: {
      medianFontSize: idNum(st.medianFontSize, round),
      medianLeading: idNum(st.medianLeading, round),
      bodyLeft: (Array.isArray(st.bodyLeft) ? st.bodyLeft : []).map((g) => idNum(g, round)),
      warn: st.warn == null ? null : st.warn,
      widthFixed: Number(st.widthFixed) || 0
    }
  };
}

/* 배열 튜플 변형 — 키 이름 중복을 없애면 얼마나 주는가 (spec 9-2 "다음 수단") */
const ROLES = ['body', 'heading', 'header', 'footer', 'pageno', 'table', 'rotated', 'figure-caption'];
const KINDS = ['body', 'heading', 'question', 'option', 'answer', 'table', 'list'];
const REGION_KINDS = ['table', 'figure'];

function tupleize(s) {
  const lines = [];
  for (const l of s.lines) {
    const runXs = [];
    let runTexts = null;
    for (const r of l.runs) {
      runXs.push(r.x0, r.x1);
      if (r.text !== undefined) {
        if (!runTexts) runTexts = [];
        runTexts.push(r.text);
      }
    }
    lines.push([
      l.id, l.text,
      l.bbox.x0, l.bbox.y0, l.bbox.x1, l.bbox.y1,
      l.baseline, l.fontSize, l.col,
      ROLES.indexOf(l.role),
      l.hyphenJoin ? 1 : 0,
      l.paraId, l.regionId,
      runXs, runTexts
    ]);
  }
  const paras = [];
  for (const p of s.paragraphs) {
    paras.push([
      p.id, p.lineIds, KINDS.indexOf(p.kind),
      p.bbox.x0, p.bbox.y0, p.bbox.x1, p.bbox.y1,
      (p.continuesNext ? 1 : 0) | (p.continuesPrev ? 2 : 0)
    ]);
  }
  const regs = [];
  for (const g of s.regions) {
    regs.push([g.id, REGION_KINDS.indexOf(g.kind), g.bbox.x0, g.bbox.y0, g.bbox.x1, g.bbox.y1, g.lineIds, g.pageNo]);
  }
  return {
    pageNo: s.pageNo, width: s.width, height: s.height,
    algoVersion: s.algoVersion, storeVersion: s.storeVersion,
    L: lines, P: paras, R: regs,
    columns: [s.columns.count, s.columns.gutters],
    stats: [s.stats.medianFontSize, s.stats.medianLeading, s.stats.bodyLeft, s.stats.warn, s.stats.widthFixed]
  };
}

const VARIANTS = [
  { id: 'v0', label: 'v0 저장본 (규칙 1·2·3 전부 적용 — 현재 toStored)', make: (L) => toStored(L) },
  { id: 'v1', label: 'v1 규칙 1 끔 (+ paragraphs[].text)', make: (L) => makeStored(L, { paraText: true }) },
  { id: 'v2', label: 'v2 규칙 2 끔 (+ 표 밖 runs[].text)', make: (L) => makeStored(L, { allRunText: true }) },
  { id: 'v3', label: 'v3 규칙 3 끔 (좌표 반올림 없음)', make: (L) => makeStored(L, { round: false }) },
  { id: 'v4', label: 'v4 배열 튜플 (v0 + 키 이름 제거)', make: (L) => tupleize(toStored(L)) },
  { id: 'v5', label: 'v5 축소 전 (규칙 1·2·3 전부 끔)', make: (L) => makeStored(L, { paraText: true, allRunText: true, round: false }) },
  // 대조군 — v0 와 **같은 내용**을 맨 마지막에 한 번 더 쓴다. 증가분 측정이
  // 순서(DB 가 커지면서 압축률·컴팩션이 달라지는 것)에 흔들리는지 본다.
  { id: 'v6', label: 'v6 대조군 (v0 을 맨 뒤에서 다시)', make: (L) => toStored(L) }
];

function docIdOf(i) { return '00000000-0000-4000-8000-00000000000' + i; }

const FAKE_TEXT_HASH = 's256:' + '0'.repeat(64);
function wrap(rec, docId, pageNo) {
  rec.docId = docId;
  rec.pageNo = pageNo;
  rec.textHash = FAKE_TEXT_HASH;
  rec.extractedAt = 1758400000000;
  rec.roleVersion = 1;
  return rec;
}

/** LevelDB 쓰기·컴팩션이 늦게 반영된다. 같은 값이 두 번 나올 때까지 기다린다. */
async function stableUsage(maxMs = 4000) {
  let prev = -1;
  const t0 = Date.now();
  for (;;) {
    const e = await db.estimate();
    if (e.usage === prev) return e;
    prev = e.usage;
    if (Date.now() - t0 > maxMs) return e;
    await sleep(250);
  }
}

async function runMeasurement() {
  if (state.busy || !state.pdfDoc) return;
  state.busy = true;
  el.measure.disabled = true;
  clear(el.checks);
  const { buildPageLayout } = await import('../js/text/layout.js');
  const { PDF_TEXT_CONTENT_OPTIONS } = await import('../js/config.js');

  try {
    if (state.ex && state.ex.running) state.ex.pause();
    const want = Math.max(10, Number(el.pageCount.value) || 250);
    const stride = Math.max(1, Number(qs.get('stride')) || 1);
    const pageNos = [];
    for (let p = 1; p <= state.pdfDoc.numPages && pageNos.length < want; p += stride) pageNos.push(p);
    const n = pageNos.length;

    // 측정은 **빈 DB** 에서 시작해야 증가분이 그대로 점유량이다.
    await db.deleteDatabase();
    await db.openDb();

    setStatus('측정 — 추출 중 0/' + n);
    const layouts = [];
    let lineCount = 0, paraCount = 0, regionCount = 0, widthFixed = 0, itemCount = 0;
    const t0 = performance.now();
    for (let pi = 0; pi < n; pi++) {
      const page = await state.pdfDoc.getPage(pageNos[pi]);
      try {
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
        itemCount += tc.items.length;
        const layout = buildPageLayout(tc.items, {
          pageNo: pageNos[pi], width: vp.width, height: vp.height, styles: tc.styles || {}
        });
        for (const l of layout.lines) l.items = null;
        layouts.push(layout);
        lineCount += layout.lines.length;
        paraCount += layout.paragraphs.length;
        regionCount += layout.regions.length;
        widthFixed += Number(layout.stats && layout.stats.widthFixed) || 0;
      } finally {
        page.cleanup();
      }
      if (pi % 10 === 9 || pi === n - 1) {
        setStatus('측정 — 추출 중 ' + (pi + 1) + '/' + n);
        setProgress(pi + 1, n);
        await sleep(0);
      }
    }
    const extractMs = performance.now() - t0;
    log('측정용 추출 ' + n + '쪽: ' + Math.round(extractMs) + 'ms (' + (extractMs / n).toFixed(1) + 'ms/쪽)');
    log('stats.widthFixed 합계: ' + widthFixed + ' (' + (widthFixed / Math.max(1, itemCount) * 100).toFixed(2) + '% of items)');

    let same = true;
    for (let i = 0; i < layouts.length; i += 37) {
      if (JSON.stringify(makeStored(layouts[i], {})) !== JSON.stringify(toStored(layouts[i]))) { same = false; break; }
    }
    check(same, 'C1 측정 장치 makeStored(규칙 전부 켬) === toStored (표본 ' + Math.ceil(layouts.length / 37) + '쪽)');

    const results = [];
    let before = await stableUsage();
    const usage0 = before.usage;
    log('시작 usage: ' + before.usage + ' B, quota: ' + before.quota + ' B');

    for (let vi = 0; vi < VARIANTS.length; vi++) {
      const V = VARIANTS[vi];
      const docId = docIdOf(vi);
      let json = 0;
      const recs = [];
      for (let i = 0; i < layouts.length; i++) {
        const rec = wrap(V.make(layouts[i]), docId, layouts[i].pageNo);
        json += jsonBytes(rec);
        recs.push(rec);
      }
      const tp = performance.now();
      for (let i = 0; i < recs.length; i += 50) await db.putAll('pages', recs.slice(i, i + 50));
      const putMs = performance.now() - tp;
      recs.length = 0;
      const after = await stableUsage();
      const delta = after.usage - before.usage;
      results.push({ id: V.id, label: V.label, delta, json, perPage: delta / n, perPageJson: json / n, putMs });
      log(V.id + ': idb Δ ' + delta + ' B (' + (delta / n).toFixed(0) + ' B/쪽), json ' + (json / n).toFixed(0) + ' B/쪽');
      before = after;
      setProgress(vi + 1, VARIANTS.length);
      await sleep(0);
    }
    const end = await stableUsage();
    const v0 = results[0];
    const byId = {};
    for (const r of results) byId[r.id] = r;

    el.variantNote.textContent =
      n + '쪽 (' + pageNos[0] + '–' + pageNos[n - 1] + '쪽, stride ' + stride + '), 줄 ' + lineCount +
      ', 문단 ' + paraCount + ', region ' + regionCount +
      '. Δ 는 estimate().usage 증가분이다(증가만 측정 — 삭제 반영 지연을 피한다).';

    table(el.result, ['변형', 'IndexedDB Δ', 'B/쪽', 'KB/쪽', 'JSON B/쪽', 'IDB÷JSON', '저장 ms'],
      results.map((r) => [r.label, fmtBytes(r.delta), Math.round(r.perPage), fmtKB(r.perPage),
        Math.round(r.perPageJson), (r.perPage / r.perPageJson).toFixed(3), Math.round(r.putMs)]), 0);

    const eff = [
      ['규칙 1 — paragraphs[].text 제거', byId.v1.perPage - v0.perPage, byId.v1.perPageJson - v0.perPageJson],
      ['규칙 2 — 표 밖 runs[].text 제거', byId.v2.perPage - v0.perPage, byId.v2.perPageJson - v0.perPageJson],
      ['규칙 3 — 좌표 2자리 반올림', byId.v3.perPage - v0.perPage, byId.v3.perPageJson - v0.perPageJson],
      ['(참고) 배열 튜플로 바꾸면', v0.perPage - byId.v4.perPage, v0.perPageJson - byId.v4.perPageJson],
      ['규칙 1·2·3 합계 (v5 − v0)', byId.v5.perPage - v0.perPage, byId.v5.perPageJson - v0.perPageJson]
    ];
    table(el.effect, ['항목', '절약 B/쪽 (IndexedDB)', '절약 %', '절약 B/쪽 (JSON)'],
      eff.map((e) => [e[0], Math.round(e[1]),
        (e[1] / (v0.perPage + Math.max(0, e[1])) * 100).toFixed(1) + '%', Math.round(e[2])]), null);

    table(el.scale, ['변형', '729쪽', '7000쪽', 'quota 대비'],
      results.map((r) => [r.id, fmtBytes(r.perPage * 729), fmtBytes(r.perPage * 7000),
        end.quota ? (r.perPage * 7000 / end.quota * 100).toFixed(1) + '%' : '—']), 0);

    kv(el.storage, [
      ['quota', fmtBytes(end.quota) + ' (' + end.quota + ' B)'],
      ['usage (측정 후)', fmtBytes(end.usage)],
      ['usage (측정 전)', fmtBytes(usage0)],
      ['측정 쪽 수', n],
      ['7000쪽 환산 (v0)', fmtBytes(v0.perPage * 7000)]
    ]);

    check(v0.perPage * 7000 <= 100 * 1048576, 'C5 7000쪽 환산 (v0) ' + fmtBytes(v0.perPage * 7000) + ' ≤ 100MB');
    const drift = Math.abs(byId.v6.perPage - v0.perPage) / v0.perPage;
    check(drift < 0.05, 'C6 대조군 v6 − v0 편차 ' + (drift * 100).toFixed(1) + '% (<5%) — 순서에 흔들리지 않는다. v0 ' +
      Math.round(v0.perPage) + ' B/쪽, v6 ' + Math.round(byId.v6.perPage) + ' B/쪽');

    setStatus('측정 완료 — v0 ' + fmtKB(v0.perPage) + ' KB/쪽, 7000쪽 환산 ' + fmtBytes(v0.perPage * 7000) +
      '. 측정은 DB 를 비웠으므로 문서를 다시 가져와야 한다.');
    state.doc = null;
    state.ex = null;
    el.start.disabled = true;
    el.del.disabled = true;
  } catch (e) {
    setStatus('측정 실패: ' + (e && e.message ? e.message : String(e)), true);
    log('오류: ' + (e && e.stack ? e.stack : String(e)));
  } finally {
    state.busy = false;
    el.measure.disabled = !state.pdfDoc;
  }
}

/* ────────────────────────────────────────────────
   이벤트
   ──────────────────────────────────────────────── */
el.file.addEventListener('change', async () => {
  const f = el.file.files && el.file.files[0];
  if (!f) return;
  try { await importBlob(f, f.name); } catch (e) {
    setStatus('가져오기 실패: ' + (e && e.message ? e.message : String(e)), true);
    log('오류: ' + (e && e.stack ? e.stack : String(e)));
  }
});

el.start.addEventListener('click', async () => {
  if (!state.ex) return;
  el.pause.disabled = false;
  await state.ex.start();
});

el.pause.addEventListener('click', () => {
  if (!state.ex) return;
  state.ex.pause();
  el.pause.disabled = true;
  setStatus('일시정지 — cursor ' + state.ex.ex.cursor + ' 에 저장됨. 새로고침해도 여기서 이어진다.');
});

el.speak.addEventListener('click', () => {
  if (!state.ex) return;
  const on = !state.ex.speaking;
  state.ex.setSpeaking(on);
  el.speak.textContent = on ? '낭독 중 (초당 1쪽)' : '낭독 중 가정';
});

el.del.addEventListener('click', async () => {
  if (!state.doc) return;
  if (state.ex) state.ex.stop();
  const counts = await db.deleteDocument(state.doc.id);
  log('삭제: ' + JSON.stringify(counts));
  state.doc = null;
  state.ex = null;
  el.start.disabled = true;
  el.pause.disabled = true;
  el.del.disabled = true;
  setStatus('문서를 지웠습니다.');
  await refreshStorage();
});

el.wipe.addEventListener('click', async () => {
  if (state.ex) state.ex.stop();
  await db.deleteDatabase();
  state.doc = null;
  state.ex = null;
  el.start.disabled = true;
  el.pause.disabled = true;
  el.del.disabled = true;
  setStatus('DB 를 비웠습니다.');
  await refreshStorage();
});

/* 16-B — 같은 파일을 다시 가져오면 중복 생성 없이 기존 문서가 열린다 */
el.reimport.addEventListener('click', async () => {
  const url = qs.get('pdf');
  if (!url) return;
  const before = (await db.keysOf('documents')).length;
  const res = await fetch(url);
  await importBlob(await res.blob(), url.split('/').pop() || url);
  const after = (await db.keysOf('documents')).length;
  log('documents 행 수: ' + before + ' → ' + after + (before === after ? ' (중복 생성 없음 ○)' : ' (중복 생성됨 ×)'));
  check(before === after, 'C7 같은 파일 재가져오기 — documents 행 수 ' + before + ' → ' + after + ' (fileHash unique)');
});

el.peekBtn.addEventListener('click', () => { peek(); });
el.measure.addEventListener('click', () => { runMeasurement(); });
db.onDbEvent((ev) => { log('db 이벤트: ' + ev.type); });

/* ?pdf= 로 바로 열기 / 이전 문서 되살리기 */
(async function boot() {
  if (qs.get('pages')) el.pageCount.value = String(Number(qs.get('pages')) || 250);
  try {
    await db.openDb();
    await refreshStorage();
    const restored = await restoreLast();
    if (!restored) {
      const url = qs.get('pdf');
      if (url) {
        setStatus('PDF 내려받는 중: ' + url);
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await importBlob(await res.blob(), url.split('/').pop() || url);
      }
    }
    const auto = qs.get('auto');
    if (auto === 'measure') runMeasurement();
    else if (auto && state.ex) { el.pause.disabled = false; state.ex.start(); }
  } catch (e) {
    setStatus('시작 실패: ' + (e && e.message ? e.message : String(e)), true);
    log('오류: ' + (e && e.stack ? e.stack : String(e)));
  }
}());
