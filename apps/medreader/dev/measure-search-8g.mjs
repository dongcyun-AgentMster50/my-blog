#!/usr/bin/env node
/* ============================================================
   MedReader — 8g 검색 단계 Plan 실측 (spec 17-8-12 · 2026-10-18)

     MEDREADER_PDFJS=<폴더 또는 pdf.mjs> node apps/medreader/dev/measure-search-8g.mjs <pdf>
         [--json <파일>]   결과 수치를 JSON 으로 저장
         [--from a --to b] 쪽 범위(기본 전권). 크기·시간은 전권에서만 의미가 있다
         [--refind k]      검색어마다 "결과 쪽에서 다시 찾기"(17-8-8 강조 경로)를 확인할 쪽 수 상한(기본 400)
         [--app]           `[8g-2 — S14]` 앱 엔진(`js/search/engine.js` + `js/text/search.js`)과 비교 — 아래 7절.
                           pages 저장본만 흉내 IndexedDB(tests/fixtures/fake-idb.mjs)에 넣고 엔진 백필로 searchText 를
                           만든 뒤, 검색어마다 시제품 규칙과 적중·쪽·묶음을 맞대고 결과 쪽 다시 찾기를 앱 함수로 한다.
                           메모리가 크다 — `node --max-old-space-size=8192` 권장. `<pdf>` 를 맨 앞에 둔다.
         [--toc]           `[8g-3 — S18]` 앱 목차(`js/search/outline.js` + `text/search.js` `headingToc`)와 비교 — 아래 8절.
                           개요: 앱 `readOutline` = 1절 시제품(항목·쪽·깊이·제목), 흉내 IndexedDB 에서 `ensure` 저장·두 번째
                           호출의 PDF 호출 0, 쪽 라벨. 폴백: 앱 `headingToc` = 6절 변형 C(항목 집합 차 0), 개요 대비 재현율,
                           `tocOf`(heading 줄만 읽는 경로)가 같은 목록을 내는가.
                           `[8g-4b 안내 — 8g-3b Review · carryover 18]` 8g-3b 뒤로 앱 `headingToc` 는 §11 규칙(R1–R10)을 쓰므로
                           이 옵션의 `symDiffVsProtoC`(옛 변형 C 와의 차)는 **이제 0 이 아니다**(의도된 차이). S18·S36 판정은
                           `dev/measure-toc-8g3b.mjs`(새 규칙의 기준 정의 — 앱과 차 0)로 본다. 이 옵션은 개요·쪽 라벨 확인용으로 남긴다.

   17-8-1 의 `measure-search.mjs`(2026-10-12)와 다른 점 — **지금 앱 경로를 그대로** 지난다:
   · algoVersion 12(8i 행 표 rowhead·ref·colhead, 8i-2 2열 표)인 `buildPageLayout`, 추출과 같은
     `PDF_TEXT_CONTENT_OPTIONS`, 이웃 저장본(4-7 역할 재계산 — 앞 쪽 최종본 + 뒤 쪽 예비본)을 넘긴다.
   · 검색 글자 = **화면 글자**: `fromStored → describePage → flowParasOf → joinPieces`(리더·낭독과 같은 함수).
     `fromStored` 문단 text 와 바이트 비교도 한다(어느 쪽을 저장할지 — 17-8-12 A).
   · 검색 규칙(17-8-4)의 시제품 — 길이 보존 접기, 변형(그리스 문자), 대문자 약어 대소문자 구분·낱말 전체,
     3자 이하 낱말 전체, 4자 이상 낱말 시작 접두, 구 일치, 책당 1,000개 상한.
   · 결과 쪽에서 다시 찾기(강조 경로): 같은 쪽을 `describePage → joinPieces` 로 다시 만들어 같은 수가 나오는가,
     적중 → 줄 구간(`spans`) → 낭독 단위(`buildUnits` 문장 — 인용 `cite` 여부, ranges 없는 300자 분할 단위).
   · 목차: PDF 개요·쪽 라벨, heading 폴백(17-8-6 규칙)의 크기·개요 대비 재현율·행 표 쪽 섞임.

   출력은 **수치뿐**이다(원서 문장·제목을 내지 않는다). js/ 는 읽기만 한다.
   ============================================================ */

import fs from 'node:fs';
import v8 from 'node:v8';
import { performance } from 'node:perf_hooks';
import { loadPdfjs, positional } from './measure-lib.mjs';
import { buildPageLayout, algoVersion as ALGO } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { PDF_TEXT_CONTENT_OPTIONS, KEEP_HYPHEN_PREFIXES } from '../js/config.js';
import { toStored, fromStored, derivedHash } from '../js/text/store.js';
import { describePage, flowParasOf, FOLD_ROLES } from '../js/ui/reader.js';
import { joinPieces, buildUnits, localRange } from '../js/tts/text.js';

const argv = process.argv;
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const [file] = positional(argv);
if (!file) { console.error('사용: measure-search-8g.mjs <pdf> [--json f] [--from a --to b] [--refind k]'); process.exit(2); }
const REFIND_CAP = Number(opt('refind', 400)) || 400;
const MAX_HITS = 1000;

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const N = doc.numPages;
const FROM = Math.max(1, Number(opt('from', 1)) || 1);
const TO = Math.min(N, Number(opt('to', N)) || N);
const R = { pages: N, range: [FROM, TO], algoVersion: ALGO, derivedHash: derivedHash(), pdfjs: pdfjs.version || null };

/* ── 접기·일치 시제품 (17-8-4) ─────────────────────────────── */
const DASH = /[-­‐-―−]/;
const FOLD = new Map();
function fold1(ch) {
  let f = FOLD.get(ch);
  if (f !== undefined) return f;
  let c = ch.toLowerCase();
  if (c.length !== 1) c = ch;                                   // İ 처럼 길이가 바뀌면 그대로
  const d = c.normalize('NFD');
  if (d.length > 1 && /^[a-z]$/.test(d[0]) && /^\p{M}+$/u.test(d.slice(1))) c = d[0];   // é → e
  if (DASH.test(c)) c = ' ';
  else if (/[‘’‛′]/.test(c)) c = "'";
  else if (/[“”‟″]/.test(c)) c = '"';
  FOLD.set(ch, c);
  return c;
}
// '-'(2D)·A–Z·ASCII 밖만 함수로 — 나머지는 그대로(길이 보존)
const FOLD_RE = /[^\x00-\x2C\x2E-\x40\x5B-\x7F]/g;
function foldText(s) { return String(s).replace(FOLD_RE, fold1); }
function isW(c) {
  if (c === undefined) return false;
  const k = c.charCodeAt(0);
  if ((k >= 97 && k <= 122) || (k >= 48 && k <= 57) || (k >= 65 && k <= 90)) return true;
  if (k < 128) return false;
  return /[\p{L}\p{N}]/u.test(c);
}
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', kappa: 'κ' };
const GREEK_BACK = Object.fromEntries(Object.entries(GREEK).map(([a, b]) => [b, a]));
// 줄바꿈에서 하이픈을 살리는 접두(4-10 KEEP_HYPHEN_PREFIXES) 중 3자 이상 — "pseudohypo…" ↔ "pseudo hypo…"
const COMPOUND = [...KEEP_HYPHEN_PREFIXES].filter((x) => x.length >= 3);
function parseQuery(q, compound = true) {
  const s = String(q).replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 60) return null;
  const cs = /^[A-Z0-9]{2,5}$/.test(s) && /[A-Z]/.test(s);
  if (cs) return { cs: true, whole: true, variants: [s] };
  const f = foldText(s).replace(/\s+/g, ' ').trim();
  const whole = f.length <= 3;
  let vs = [''];
  for (const [k, tok] of f.split(' ').entries()) {
    const alts = [tok];
    if (GREEK[tok]) alts.push(GREEK[tok]);
    if (GREEK_BACK[tok]) alts.push(GREEK_BACK[tok]);
    const nx = [];
    for (const v of vs) for (const a of alts) nx.push(k ? v + ' ' + a : a);
    vs = nx.slice(0, 8);
  }
  if (compound && !whole) {
    const more = [];
    for (const v of vs) for (const pf of COMPOUND) {
      if (v.startsWith(pf + ' ') && v.length > pf.length + 3 && v.indexOf(' ', pf.length + 1) < 0) more.push(pf + v.slice(pf.length + 1));
      else if (v.startsWith(pf) && v.length >= pf.length + 3 && v.indexOf(' ') < 0) more.push(pf + ' ' + v.slice(pf.length));
    }
    vs = vs.concat(more);
  }
  return { cs: false, whole, variants: [...new Set(vs)] };
}
/** hay 안의 적중 시작 오프셋(오름차순, 중복 없음). limit 에 닿으면 멈춘다. */
function findIn(hay, pq, limit = Infinity) {
  const out = [];
  for (const v of pq.variants) {
    const n = v.length;
    let i = hay.indexOf(v);
    while (i >= 0) {
      if ((i === 0 || !isW(hay[i - 1])) && (!pq.whole || !isW(hay[i + n]))) out.push(i);
      i = hay.indexOf(v, i + 1);
    }
  }
  if (pq.variants.length > 1) { out.sort((a, b) => a - b); for (let k = out.length - 1; k > 0; k--) if (out[k] === out[k - 1]) out.splice(k, 1); }
  return out.length > limit ? out.slice(0, limit) : out;
}

/* ── 검색 레코드 시제품 (17-8-3 searchRecordOf) — 화면 글자 ─────── */
function searchRecordOf(F, desc) {
  const paras = flowParasOf(desc);
  let text = '';
  const heads = [];
  const rowheads = [];
  const byId = new Map(F.lines.map((l) => [l.id, l]));
  const med = Number(F.stats && F.stats.medianFontSize) || 0;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const j = joinPieces(p.lines);
    if (i) text += '\n';
    const o = text.length;
    text += j.text;
    if (p.kind === 'heading') {
      const l0 = byId.get(p.lines[0] && p.lines[0].id);
      const r = l0 && med ? Math.round((l0.fontSize / med) * 100) / 100 : 0;
      heads.push({ i, o, r });
    } else if (p.kind === 'rowhead') rowheads.push([o, o + j.text.length]);
  }
  const tl = [];
  for (const g of F.regions || []) for (const id of g.lineIds || []) {
    const l = byId.get(id);
    if (l) tl.push(String(l.text || '').replace(/\s+/g, ' ').trim());
  }
  return { rec: { sv: 1, algoVersion: F.algoVersion, text, table: tl.join('\n'), heads }, rowheads, paras };
}

/* ── 1. 개요·쪽 라벨 ───────────────────────────────────────── */
{
  const t0 = performance.now();
  const outline = await doc.getOutline();
  const tOutline = performance.now() - t0;
  const flat = [];
  (function walk(items, depth) { for (const it of items || []) { flat.push({ it, depth }); walk(it.items, depth + 1); } })(outline, 1);
  const t1 = performance.now();
  let ok = 0, fail = 0, named = 0, explicit = 0, urlOnly = 0, none = 0;
  const pagesOf = [];
  for (const { it } of flat) {
    let dest = it.dest;
    if (!dest) { if (it.url || it.unsafeUrl) urlOnly++; else none++; pagesOf.push(null); continue; }
    try {
      if (typeof dest === 'string') { named++; dest = await doc.getDestination(dest); } else explicit++;
      if (!Array.isArray(dest) || dest[0] == null) { fail++; pagesOf.push(null); continue; }
      const ref = dest[0];
      const idx = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
      if (Number.isInteger(idx) && idx >= 0 && idx < N) { ok++; pagesOf.push(idx + 1); } else { fail++; pagesOf.push(null); }
    } catch (e) { fail++; pagesOf.push(null); }
  }
  const tResolve = performance.now() - t1;
  let back = 0, prev = 0;
  for (const p of pagesOf) { if (p == null) continue; if (p < prev) back++; prev = p; }
  const byDepth = {}; for (const { depth } of flat) byDepth[depth] = (byDepth[depth] || 0) + 1;
  let labels = null;
  try { labels = await doc.getPageLabels(); } catch (e) { labels = null; }
  const offs = new Map(); let roman = 0, other = 0, numeric = 0;
  if (labels) for (let i = 0; i < labels.length; i++) {
    const l = String(labels[i]);
    if (/^\d+$/.test(l)) { numeric++; const o = (i + 1) - Number(l); offs.set(o, (offs.get(o) || 0) + 1); }
    else if (/^[ivxlcdm]+$/i.test(l)) roman++; else other++;
  }
  let outlineLabelDiff = 0;
  if (labels) for (const p of pagesOf) if (p != null && String(labels[p - 1]) !== String(p)) outlineLabelDiff++;
  const labelsJsonBytes = labels ? JSON.stringify(labels).length : 0;
  const outlineJsonBytes = JSON.stringify(flat.map(({ it, depth }, k) => ({ t: String(it.title || ''), p: pagesOf[k], d: depth }))).length;
  R.outline = {
    items: flat.length, topLevel: (outline || []).length, maxDepth: Math.max(0, ...flat.map((f) => f.depth)), byDepth,
    resolved: ok, failed: fail, named, explicit, urlOnly, noDest: none, outOfOrder: back,
    msGetOutline: +tOutline.toFixed(1), msResolveAll: +tResolve.toFixed(1),
    pageLabels: labels ? labels.length : 0, labelNumeric: numeric, labelRoman: roman, labelOther: other,
    labelOffsetsTop3: [...offs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    outlineItemsWhoseLabelDiffers: outlineLabelDiff,
    outlineJsonBytes, labelsJsonBytes
  };
  R._outlinePages = pagesOf;
  R._outlineTitles = flat.map(({ it }) => String(it.title || ''));
}

/* ── 2. 쪽마다 — 앱 경로(이웃 포함) → 저장본 → 검색 레코드 ─────── */
async function itemsOf(p) {
  const page = await doc.getPage(p);
  try {
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
    const items = tc.items.filter((it) => it && typeof it.str === 'string');
    const size = unrotatedPageSize(page.view, vp.width, vp.height);
    return { items, styles: tc.styles || {}, width: size.width, height: size.height };
  } finally { page.cleanup(); }
}
let msLayout = 0;
function build(p, src, neighbors) {
  const t = performance.now();
  const L = buildPageLayout(src.items, { pageNo: p, width: src.width, height: src.height, styles: src.styles, neighborLayouts: neighbors });
  const rec = toStored(L);
  msLayout += performance.now() - t;
  rec.docId = 'bench'; rec.pageNo = p;
  return rec;
}

const T0 = performance.now();
const pages = [];   // { p, pagesBuf, stBuf, rowheads:[[a,b]], hasRt }
let pagesV8 = 0, pagesJson = 0, stV8 = 0, stJson = 0, stTwoByte = 0;
let msRecordOf = 0, msFromStored = 0;
let textChars = 0, tableChars = 0, foldedChars = 0, refChars = 0, refShownChars = 0, colheadChars = 0, nullParaLines = 0, nullParaChars = 0;
let paraCmp = 0, paraDiff = 0, paraDiffChars = 0;
let headCount = 0, rowheadCount = 0, rtPages = 0, headOnRtPages = 0;
const allHeads = [];   // { p, t, r }
let prevFinal = null;
let next = await itemsOf(FROM);
for (let p = FROM; p <= TO; p++) {
  const cur = next;
  next = p < TO ? await itemsOf(p + 1) : null;
  const prelimNext = next ? build(p + 1, next, []) : null;
  const rec = build(p, cur, [prevFinal, prelimNext].filter(Boolean));
  prevFinal = rec;

  const pagesBuf = v8.serialize(rec);
  pagesV8 += pagesBuf.length; pagesJson += JSON.stringify(rec).length;

  let t = performance.now();
  const F = fromStored(rec);
  msFromStored += performance.now() - t;
  t = performance.now();
  const desc = describePage(F);
  const S = searchRecordOf(F, desc);
  msRecordOf += performance.now() - t;
  const st = Object.assign({ docId: 'bench', pageNo: p }, S.rec);
  const stBuf = v8.serialize(st);
  stV8 += stBuf.length; stJson += JSON.stringify(st).length;
  if (/[^\x00-\xFF]/.test(st.text) || /[^\x00-\xFF]/.test(st.table)) stTwoByte++;
  textChars += st.text.length; tableChars += st.table.length;

  // 저장 글자 후보 비교 — fromStored 문단 text 대 화면 글자(joinPieces)
  const fpById = new Map(F.paragraphs.map((x) => [x.id, x]));
  for (const pa of S.paras) {
    if (pa.id == null) { nullParaLines += pa.lines.length; nullParaChars += joinPieces(pa.lines).text.length; continue; }
    const fp = fpById.get(pa.id); if (!fp) continue;
    paraCmp++;
    const a = joinPieces(pa.lines).text;
    if (a !== fp.text) { paraDiff++; paraDiffChars += Math.abs(a.length - fp.text.length); }
  }
  // 검색에서 빠지는 글자
  const shownRef = new Set();
  for (const pa of F.paragraphs) if (pa.kind === 'rowhead' && Array.isArray(pa.refLineIds)) for (const id of pa.refLineIds) shownRef.add(id);
  let hasRt = false;
  for (const l of F.lines) {
    const n = String(l.text || '').trim().length;
    if (l.rt) hasRt = true;
    if (l.role === 'ref') { refChars += n; if (shownRef.has(l.id)) refShownChars += n; }
    else if (l.role === 'colhead') colheadChars += n;
    else if (FOLD_ROLES.includes(l.role)) foldedChars += n;
  }
  if (hasRt) rtPages++;
  for (const h of st.heads) {
    headCount++;
    const e = st.text.indexOf('\n', h.o);
    const tx = st.text.slice(h.o, e < 0 ? st.text.length : e);
    allHeads.push({ p, t: tx, r: h.r, rt: hasRt });
    if (hasRt) headOnRtPages++;
  }
  rowheadCount += S.rowheads.length;
  pages.push({ p, pagesBuf, stBuf, rowheads: S.rowheads, hasRt });
  if (p % 500 === 0) process.stderr.write(`  ${p}/${TO}\n`);
}
const msAll = performance.now() - T0;
R.text = {
  pagesMeasured: pages.length, msAll: Math.round(msAll), msLayoutAndToStored: Math.round(msLayout),
  textChars, tableChars, tablePct: +(100 * tableChars / Math.max(1, textChars + tableChars)).toFixed(1),
  excluded: { foldedRoles: foldedChars, colhead: colheadChars, ref: refChars, refShownAsRtRef: refShownChars },
  unparagraphedFlowLines: nullParaLines, unparagraphedFlowChars: nullParaChars,
  parasCompared: paraCmp, parasJoinPiecesNeFromStored: paraDiff, parasDiffCharsAbs: paraDiffChars,
  headings: headCount, rowheads: rowheadCount, rowtablePages: rtPages, headingsOnRowtablePages: headOnRtPages
};
R.storage = {
  pagesV8MB: +(pagesV8 / 1e6).toFixed(2), pagesJsonMB: +(pagesJson / 1e6).toFixed(2),
  searchTextV8MB: +(stV8 / 1e6).toFixed(2), searchTextJsonMB: +(stJson / 1e6).toFixed(2),
  ratioV8: +(stV8 / Math.max(1, pagesV8)).toFixed(3),
  searchTextBytesPerPage: Math.round(stV8 / Math.max(1, pages.length)),
  pagesWithTwoByteText: stTwoByte
};
R.time = {
  searchRecordOfMsTotal: Math.round(msRecordOf), searchRecordOfMsPerPage: +(msRecordOf / Math.max(1, pages.length)).toFixed(3),
  fromStoredMsTotal: Math.round(msFromStored)
};

/* ── 3. 백필·캐시 채우기 시간 ──────────────────────────────── */
{
  // 백필 = pages 레코드 역직렬화 → fromStored → describePage → searchRecordOf → 직렬화(쓰기 직전까지)
  let t = performance.now();
  let n = 0;
  for (const x of pages) {
    const rec = v8.deserialize(x.pagesBuf);
    const F = fromStored(rec);
    const S = searchRecordOf(F, describePage(F));
    n += v8.serialize(Object.assign({ docId: 'bench', pageNo: x.p }, S.rec)).length;
  }
  R.time.backfillMs = Math.round(performance.now() - t);
  // 캐시 채우기 = searchText 레코드 역직렬화 → 원문 보관 + 접기
  t = performance.now();
  const orig = new Array(pages.length), folded = new Array(pages.length), tab = new Array(pages.length), tabF = new Array(pages.length), heads = new Array(pages.length);
  for (let i = 0; i < pages.length; i++) {
    const r = v8.deserialize(pages[i].stBuf);
    orig[i] = r.text; folded[i] = foldText(r.text); tab[i] = r.table; tabF[i] = foldText(r.table); heads[i] = r.heads;
  }
  R.time.cacheFillMs = Math.round(performance.now() - t);
  let deser = performance.now();
  for (let i = 0; i < pages.length; i++) v8.deserialize(pages[i].stBuf);
  R.time.cacheDeserializeOnlyMs = Math.round(performance.now() - deser);
  let mem = 0; let twoB = 0;
  for (let i = 0; i < pages.length; i++) for (const s of [orig[i], folded[i], tab[i], tabF[i]]) { const two = /[^\x00-\xFF]/.test(s); if (two) twoB++; mem += s.length * (two ? 2 : 1); }
  R.memory = { cacheOrigPlusFoldedMB: +(mem / 1e6).toFixed(1), twoByteStrings: twoB };
  globalThis.__cache = { orig, folded, tab, tabF, heads };
}

/* ── 4. 검색어 — 시간·적중 ─────────────────────────────────── */
const QUERIES = [
  ['common', 'patients'], ['common', 'treatment'], ['common', 'the'],
  ['rare', 'sarcoidosis'], ['rare', 'pheochromocytoma'], ['rowhead', 'pseudohypoparathyroidism'],
  ['multi', 'heart failure'], ['multi', 'rheumatoid arthritis'], ['multi', 'acute kidney injury'],
  ['hyphen', 'beta-blocker'], ['hyphen', 'beta blocker'], ['hyphen', 'β-blocker'], ['hyphen', 'non-Hodgkin'], ['hyphen', 'IL-6'],
  ['abbr', 'MI'], ['abbr', 'CKD'], ['abbr', 'HbA1c'], ['abbr', 'ACE'], ['short', 'mi'],
  ['prefix', 'metform'], ['prefix', 'warfarin'], ['arabic', 'ساركويد'],
  ['compound', 'preeclampsia'], ['compound', 'pre-eclampsia'], ['compound', 'nonsteroidal'], ['compound', 'hypoparathyroidism']
];
const C = globalThis.__cache;
function searchDoc(pq, limit) {
  let total = 0; const res = [];
  for (let i = 0; i < pages.length && total < limit; i++) {
    const hay = pq.cs ? C.orig[i] : C.folded[i];
    const hits = findIn(hay, pq, limit - total);
    const th = findIn(pq.cs ? C.tab[i] : C.tabF[i], pq, Math.max(0, limit - total - hits.length));
    if (hits.length || th.length) { res.push({ i, hits, th }); total += hits.length + th.length; }
  }
  return { res, total, truncated: total >= limit };
}
// 같은 글자가 책에서 10번 이상인 제목(일반 소제목 "Treatment" 등) — 제목 묶음에서 뺄지 잰다
const HKEY = (s) => foldText(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const HFREQ = new Map();
for (const h of allHeads) { const k = HKEY(h.t); HFREQ.set(k, (HFREQ.get(k) || 0) + 1); }
function classify(i, at) {
  const hs = C.heads[i];
  for (const h of hs) {
    const e = C.orig[i].indexOf('\n', h.o); const end = e < 0 ? C.orig[i].length : e;
    if (at >= h.o && at < end) return (HFREQ.get(HKEY(C.orig[i].slice(h.o, end))) || 0) >= 10 ? 'headGeneric' : 'head';
  }
  for (const [a, b] of pages[i].rowheads) if (at >= a && at < b) return 'rowhead';
  return 'body';
}
R.queries = [];
for (const [cat, q] of QUERIES) {
  const pq = parseQuery(q);
  if (!pq) { R.queries.push({ cat, q, invalid: true }); continue; }
  let best = Infinity, out = null;
  for (let r = 0; r < 3; r++) { const t = performance.now(); out = searchDoc(pq, MAX_HITS); best = Math.min(best, performance.now() - t); }
  let bestAll = Infinity, all = null;
  for (let r = 0; r < 2; r++) { const t = performance.now(); all = searchDoc(pq, Infinity); bestAll = Math.min(bestAll, performance.now() - t); }
  const pq0 = parseQuery(q, false);
  const noCompound = pq0 && pq0.variants.length !== pq.variants.length ? searchDoc(pq0, Infinity).total : null;
  const kinds = { head: 0, headGeneric: 0, body: 0, rowhead: 0, table: 0 };
  const hp = { head: new Set(), body: new Set(), table: new Set() };
  for (const r of all.res) {
    for (const at of r.hits) { const k = classify(r.i, at); kinds[k]++; (k === 'head' ? hp.head : hp.body).add(r.i); }
    if (r.th.length) { kinds.table += r.th.length; hp.table.add(r.i); }
  }
  // 결과 조각 30줄(앞뒤 40자, 낱말 경계로 넓힘)
  const ts = performance.now(); let sn = 0;
  for (const r of out.res.slice(0, 30)) {
    const s = C.orig[r.i]; const at = r.hits.length ? r.hits[0] : 0;
    let a = Math.max(0, at - 40), b = Math.min(s.length, at + 40 + 20);
    while (a > 0 && isW(s[a - 1])) a--; while (b < s.length && isW(s[b])) b++;
    sn += s.slice(a, b).length;
  }
  const msSnip = performance.now() - ts;
  R.queries.push({
    cat, q: /[^\x00-\x7F]/.test(q) && cat === 'arabic' ? '(아랍 문자)' : q, rule: pq.cs ? 'case+word' : (pq.whole ? 'word' : 'prefix'), variants: pq.variants.length,
    hitsWithoutCompoundVariant: noCompound,
    msLimited: +best.toFixed(1), msFull: +bestAll.toFixed(1), hitsTotal: all.total, pagesTotal: all.res.length,
    limitedHits: out.total, truncated: out.truncated,
    kinds, pagesHead: hp.head.size, pagesBody: hp.body.size, pagesTable: hp.table.size, msSnippets30: +msSnip.toFixed(2)
  });
}

/* ── 5. 결과 쪽에서 다시 찾기(17-8-8 강조 경로)·낭독 시작점 ──────── */
{
  const agg = { pages: 0, pageCountMismatch: 0, hits: 0, crossLine: 0, emptyRange: 0, unitFound: 0, unitCite: 0, unitNoRanges: 0, unitMissing: 0, msPerPage: 0 };
  let ms = 0;
  for (const [cat, q] of QUERIES) {
    const pq = parseQuery(q); if (!pq) continue;
    const all = searchDoc(pq, Infinity);
    for (const r of all.res.slice(0, REFIND_CAP)) {
      if (!r.hits.length) continue;
      const t = performance.now();
      const rec = v8.deserialize(pages[r.i].pagesBuf);
      const F = fromStored(rec);
      const paras = flowParasOf(describePage(F));
      let n = 0;
      const units = buildUnits(paras, 'sentence', { lang: 'en' });
      for (const pa of paras) {
        const j = joinPieces(pa.lines);
        const hay = pq.cs ? j.text : foldText(j.text);
        const hs = findIn(hay, pq);
        n += hs.length;
        for (const at of hs) {
          const len = pq.cs ? pq.variants[0].length : pq.variants.find((v) => hay.startsWith(v, at)).length;
          const touched = j.spans.filter((sp) => sp.start < at + len && sp.end > at);
          if (touched.length > 1) agg.crossLine++;
          const rg = touched.map((sp) => localRange(sp, at, at + len));
          if (!rg.length || rg.some((x) => x.end <= x.start)) agg.emptyRange++;
          // 낭독 단위 — 적중 첫 글자가 든 단위
          const first = rg[0];
          let u = null, noRanges = false;
          if (first) for (const un of units) {
            if (un.paraId !== (pa.id == null ? null : String(pa.id))) continue;
            if (!un.ranges) { if (un.lineIds.includes(first.id)) { u = u || un; noRanges = true; } continue; }
            if (un.ranges.some((x) => x.id === first.id && first.start >= x.start && first.start < x.end)) { u = un; noRanges = false; break; }
          }
          if (!u) agg.unitMissing++; else { agg.unitFound++; if (u.cite) agg.unitCite++; if (noRanges) agg.unitNoRanges++; }
        }
      }
      ms += performance.now() - t;
      agg.pages++; agg.hits += n;
      if (n !== r.hits.length) agg.pageCountMismatch++;
    }
  }
  agg.msPerPage = +(ms / Math.max(1, agg.pages)).toFixed(2);
  R.refind = agg;
}

/* ── 6. 목차 폴백(17-8-6) — 개요가 없다고 치고 heading 으로 ─────── */
{
  const key = (s) => foldText(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const freq = new Map();
  for (const h of allHeads) { const k = key(h.t); freq.set(k, (freq.get(k) || 0) + 1); }
  const cand = allHeads.filter((h) => key(h.t) && freq.get(key(h.t)) < 10);
  const tiers = [...new Set(cand.map((h) => h.r))].sort((a, b) => b - a);
  let take = [], minR = null;
  for (const r of tiers) {
    const nx = cand.filter((h) => h.r >= r);
    if (nx.length > 200) break;
    take = nx; minR = r;
  }
  const digitsOnly = take.filter((h) => /^[\d\s.,–-]+$/.test(h.t)).length;
  const short = take.filter((h) => key(h.t).length <= 3).length;
  const onRt = take.filter((h) => h.rt).length;
  // 개요 대비 — 개요 항목 쪽(±1)에 폴백 항목이 있는가 / 제목이 맞는가
  const norm = (s) => key(s);
  let tried = 0, posHit = 0, titleHit = 0;
  for (let k = 0; k < R._outlinePages.length; k++) {
    const P = R._outlinePages[k]; if (P == null || P < FROM || P > TO) continue;
    tried++;
    const near = take.filter((h) => h.p >= P && h.p <= P + 1);
    if (near.length) posHit++;
    const tt = norm(R._outlineTitles[k]);
    if (near.some((h) => { const hn = norm(h.t); return hn && (hn === tt || (hn.length >= 8 && (tt.includes(hn) || hn.includes(tt)))); })) titleHit++;
  }
  // 변형 B — 숫자만·3자 이하(장 번호 글자)를 먼저 뺀 뒤 같은 층 규칙
  const candB = cand.filter((h) => !/^[\d\s.,–-]+$/.test(h.t) && key(h.t).length > 3);
  const tiersB = [...new Set(candB.map((h) => h.r))].sort((a, b) => b - a);
  let takeB = [], minRB = null;
  for (const r of tiersB) { const nx = candB.filter((h) => h.r >= r); if (nx.length > 200) break; takeB = nx; minRB = r; }
  let posB = 0, titleB = 0;
  for (let k = 0; k < R._outlinePages.length; k++) {
    const P = R._outlinePages[k]; if (P == null || P < FROM || P > TO) continue;
    const near = takeB.filter((h) => h.p >= P && h.p <= P + 1);
    if (near.length) posB++;
    const tt = norm(R._outlineTitles[k]);
    if (near.some((h) => { const hn = norm(h.t); return hn && (hn === tt || (hn.length >= 8 && (tt.includes(hn) || hn.includes(tt)))); })) titleB++;
  }
  const lenB = takeB.map((h) => h.t.length).sort((a, b) => a - b);
  R.tocFallbackB = { entries: takeB.length, minRatio: minRB, outlinePagesWithEntry: posB, outlineTitleMatched: titleB,
    onRowtablePages: takeB.filter((h) => h.rt).length, titleLenMedian: lenB.length ? lenB[lenB.length >> 1] : null, titleLenMax: lenB.length ? lenB[lenB.length - 1] : null,
    entriesOnOutlinePages: takeB.filter((h) => R._outlinePages.some((P) => P != null && h.p >= P && h.p <= P + 1)).length };
  // 변형 C — A 의 층 규칙 그대로 고르되, 숫자만인 항목(장 번호 글자)은 같은 쪽 바로 다음 heading 을 제목으로 붙인다
  const takeC = take.map((h) => {
    if (!/^[\d\s.,–-]+$/.test(h.t)) return h;
    const k = allHeads.indexOf(h);
    const nx = allHeads[k + 1];
    return nx && nx.p === h.p ? Object.assign({}, h, { t: h.t + ' ' + nx.t, merged: true }) : h;
  });
  let posC = 0, titleC = 0;
  for (let k = 0; k < R._outlinePages.length; k++) {
    const P = R._outlinePages[k]; if (P == null || P < FROM || P > TO) continue;
    const near = takeC.filter((h) => h.p >= P && h.p <= P + 1);
    if (near.length) posC++;
    const tt = norm(R._outlineTitles[k]);
    if (near.some((h) => { const hn = norm(h.t.replace(/^[\d\s.,–-]+/, '')); return hn && (hn === tt || (hn.length >= 8 && (tt.includes(hn) || hn.includes(tt)))); })) titleC++;
  }
  R.tocFallbackC = { entries: takeC.length, merged: takeC.filter((h) => h.merged).length, stillDigitsOnly: takeC.filter((h) => /^[\d\s.,–-]+$/.test(h.t)).length,
    outlinePagesWithEntry: posC, outlineTitleMatched: titleC };
  R._takeC = takeC;   // `[8g-3]` 8절 --toc 가 앱 headingToc 와 맞댄다
  const onOutlinePage = take.filter((h) => R._outlinePages.some((P) => P != null && h.p >= P && h.p <= P + 1)).length;
  // 전체 heading 의 글자 크기 층
  const tierHist = {};
  for (const h of allHeads) { const b = h.r >= 1.8 ? '>=1.8' : h.r >= 1.4 ? '1.4-1.8' : h.r >= 1.15 ? '1.15-1.4' : '<1.15'; tierHist[b] = (tierHist[b] || 0) + 1; }
  R.tocFallback = {
    headings: allHeads.length, repeatedTextsGe10: [...freq.values()].filter((n) => n >= 10).length,
    headingsInRepeated: allHeads.length - cand.length, tierHist,
    entries: take.length, minRatio: minR, tiersAvailable: tiers.length,
    digitsOnly, shortLe3: short, onRowtablePages: onRt,
    outlineTried: tried, outlinePagesWithEntry: posHit, outlineTitleMatched: titleHit,
    entriesOnOutlinePages: onOutlinePage
  };
}

/* ── 7. --app: 앱 엔진과 비교 (spec 17-8-12 S14 · 8g-2) ──────────────
   시제품(위 2–5절)은 그대로 두고, 같은 저장본에서 **앱 코드**가 내는 것을 맞댄다.
   · 레코드: 엔진 백필(`engine.backfill`)이 만든 searchText 의 text·table·heads = 시제품 레코드
   · 검색어마다(QUERIES): 상한(1,000)·끝까지 두 번, 적중 집합 `쪽:오프셋:묶음` 의 대칭 차 = 0
     (시제품 묶음 head·headGeneric·rowhead·body·table → 앱 head·body·body·body·table), 검색어 변형·규칙 같음
   · 결과 쪽 다시 찾기(17-8-8): 앱 결과 쪽(쪽 순서 앞 --refind 쪽, 본문 적중이 있는 쪽)을 `pages` 저장본에서
     앱 함수(`describePage → flowParasOf → joinPieces → foldText → findIn`)로 다시 찾아 수가 같은가 · `rangesFor` 빈 구간 0
   · 서재 범위(캐시 없음 — 읽고 버림)도 같은 적중
   · 시간: 백필·캐시 채우기는 흉내 IndexedDB 를 지나므로 참고값, 검색 1회(캐시 위)는 순수 계산 */
if (argv.includes('--app')) {
  const { installFakeIdb } = await import('../tests/fixtures/fake-idb.mjs');
  const idb = installFakeIdb();
  const adb = await import('../js/db.js');
  const engine = await import('../js/search/engine.js');
  const AS = await import('../js/text/search.js');
  const SC = await import('../js/text/screen.js');
  const D = 'bench';
  const A = {};
  const ms = (t) => +(performance.now() - t).toFixed(1);

  await adb.put('documents', { id: D, title: 'bench', fileHash: 'bench', pageCount: N, lastOpenedAt: 1 });
  for (let i = 0; i < pages.length; i += 250) {
    await adb.putAll('pages', pages.slice(i, i + 250).map((x) => v8.deserialize(x.pagesBuf)));
    idb.log.length = 0;
  }
  let t = performance.now();
  A.backfill = await engine.backfill(D);
  A.backfill.msFakeIdb = ms(t);
  idb.log.length = 0;
  const stByPage = new Map(idb.dump('medreader', 'searchText').map((s) => [s.pageNo, s]));
  let recDiff = 0, recMissing = 0, skBad = 0;
  for (const x of pages) {
    const proto = v8.deserialize(x.stBuf);
    const app = stByPage.get(x.p);
    if (!app) { recMissing++; continue; }
    if (app.sk !== AS.SEARCH_KEY || app.docId !== D) skBad++;
    if (app.text !== proto.text || app.table !== proto.table || JSON.stringify(app.heads) !== JSON.stringify(proto.heads)) recDiff++;
  }
  stByPage.clear();
  A.records = { pages: pages.length, missing: recMissing, diffTextTableHeads: recDiff, keyOrSkBad: skBad };

  t = performance.now();
  const prep = await engine.prepareDoc(D);
  A.cacheFill = { msFakeIdb: ms(t), pagesCovered: prep.pagesCovered };
  idb.log.length = 0;

  const pIndex = new Map(pages.map((x, i) => [x.p, i]));
  const protoKind = (i, at) => (classify(i, at) === 'head' ? 'head' : 'body');
  const protoKeys = (res) => {
    const out = [];
    for (const r of res.res) {
      for (const at of r.hits) out.push(pages[r.i].p + ':' + at + ':' + protoKind(r.i, at));
      for (const at of r.th) out.push(pages[r.i].p + ':' + at + ':table');
    }
    return out;
  };
  const appKeys = (r) => r.hits.map((h) => h.pageNo + ':' + h.at + ':' + h.kind);
  const symDiff = (a, b) => {
    const m = new Map();
    for (const k of a) m.set(k, (m.get(k) || 0) + 1);
    for (const k of b) m.set(k, (m.get(k) || 0) - 1);
    let d = 0;
    for (const v of m.values()) d += Math.abs(v);
    return d;
  };
  const count = (keys, kind) => keys.filter((k) => k.endsWith(':' + kind)).length;
  const pageSet = (keys) => new Set(keys.map((k) => k.slice(0, k.indexOf(':')))).size;

  A.queries = [];
  const agg = { diffLimited: 0, diffFull: 0, diffPages: 0, diffGroups: 0, ruleDiff: 0, truncatedDiff: 0, orderBad: 0, libraryDiff: 0 };
  const rf = { pages: 0, pageCountMismatch: 0, hits: 0, crossLine: 0, emptyRange: 0, ms: 0 };
  for (const [cat, q] of QUERIES) {
    const pq = parseQuery(q);
    const apq = AS.parseQuery(q);
    if (!pq) { A.queries.push({ cat, invalid: true, appError: apq.error || null }); if (!apq.error) agg.ruleDiff++; continue; }
    const sameRule = !apq.error && apq.cs === pq.cs && apq.whole === pq.whole && JSON.stringify(apq.variants) === JSON.stringify(pq.variants);
    if (!sameRule) agg.ruleDiff++;
    const lim = protoKeys(searchDoc(pq, MAX_HITS));
    const fullProto = searchDoc(pq, Infinity);
    const full = protoKeys(fullProto);
    let bestL = Infinity, bestF = Infinity, a1 = null, aF = null;
    for (let r = 0; r < 3; r++) { const t1 = performance.now(); a1 = await engine.searchDoc(D, q); bestL = Math.min(bestL, performance.now() - t1); }
    for (let r = 0; r < 2; r++) { const t1 = performance.now(); aF = await engine.searchDoc(D, q, { maxHits: Infinity }); bestF = Math.min(bestF, performance.now() - t1); }
    const kL = appKeys(a1), kF = appKeys(aF);
    const dL = symDiff(lim, kL), dF = symDiff(full, kF);
    const dP = Math.abs(pageSet(full) - pageSet(kF));
    let dG = 0;
    for (const kind of ['head', 'body', 'table']) dG += Math.abs(count(full, kind) - count(kF, kind));
    const truncProto = fullProto.total > MAX_HITS;
    if (a1.truncated !== truncProto) agg.truncatedDiff++;
    for (let i = 1; i < a1.hits.length; i++) {
      const x = a1.hits[i - 1], y = a1.hits[i];
      const kx = engine.KIND_ORDER[x.kind], ky = engine.KIND_ORDER[y.kind];
      if (!(kx < ky || (kx === ky && (x.pageNo < y.pageNo || (x.pageNo === y.pageNo && x.at < y.at))))) { agg.orderBad++; break; }
    }
    agg.diffLimited += dL; agg.diffFull += dF; agg.diffPages += dP; agg.diffGroups += dG;

    // 결과 쪽 다시 찾기 — 앱 함수로(17-8-8 강조 경로)
    const byPage = new Map();
    for (const h of aF.hits) { if (!byPage.has(h.pageNo)) byPage.set(h.pageNo, 0); if (h.kind !== 'table') byPage.set(h.pageNo, byPage.get(h.pageNo) + 1); }
    const plist = [...byPage.keys()].sort((a, b) => a - b).slice(0, REFIND_CAP);
    for (const p of plist) {
      const nText = byPage.get(p);
      if (!nText) continue;
      const t2 = performance.now();
      const F = fromStored(v8.deserialize(pages[pIndex.get(p)].pagesBuf));
      let n = 0;
      for (const pa of SC.flowParasOf(SC.describePage(F))) {
        const j = SC.joinPieces(pa.lines);
        const hay = apq.cs ? j.text : AS.foldText(j.text);
        const hs = AS.findIn(hay, apq);
        n += hs.length;
        const rs = AS.rangesFor(j, hs.map((at) => ({ at, len: AS.hitLength(hay, apq, at) })));
        for (const r of rs) { if (r.length > 1) rf.crossLine++; if (!r.length || r.some((x) => x.end <= x.start)) rf.emptyRange++; }
      }
      rf.ms += performance.now() - t2;
      rf.pages++; rf.hits += n;
      if (n !== nText) rf.pageCountMismatch++;
    }
    A.queries.push({
      cat, q: /[^\x00-\x7F]/.test(q) && cat === 'arabic' ? '(아랍 문자)' : q, sameRule,
      protoLimited: lim.length, appLimited: kL.length, protoFull: full.length, appFull: kF.length,
      diffLimited: dL, diffFull: dF, diffPages: dP, diffGroups: dG,
      groupsFull: { head: count(kF, 'head'), body: count(kF, 'body'), table: count(kF, 'table') }, pagesFull: pageSet(kF),
      truncated: a1.truncated, msLimited: +bestL.toFixed(1), msFull: +bestF.toFixed(1)
    });
  }
  rf.msPerPage = +(rf.ms / Math.max(1, rf.pages)).toFixed(2);
  delete rf.ms;
  A.refind = rf;

  // 서재 범위(캐시 없음 — 읽고 접고 찾고 버림)
  const LQ = ['sarcoidosis', 'heart failure', 'MI', 'patients'];
  A.library = [];
  for (const q of LQ) {
    const d1 = await engine.searchDoc(D, q);
    engine.invalidate(D);
    idb.log.length = 0;
    const t3 = performance.now();
    const L = await engine.searchLibrary(q);
    const msL = ms(t3);
    const d2 = L.docs.find((x) => x.docId === D);
    const diff = d2 ? symDiff(appKeys(d1), appKeys(d2)) : -1;
    if (diff !== 0) agg.libraryDiff++;
    A.library.push({ q, msFakeIdb: msL, hits: d2 ? d2.hits.length : null, diffVsDoc: diff });
    await engine.prepareDoc(D);
  }
  // 첫 검색(캐시 없음 → 채우기 → 검색) · 다음 검색
  engine.invalidate(D);
  idb.log.length = 0;
  t = performance.now();
  await engine.searchDoc(D, 'sarcoidosis');
  A.firstSearchMsFakeIdb = ms(t);
  t = performance.now();
  await engine.searchDoc(D, 'sarcoidosis');
  A.nextSearchMs = ms(t);
  A.agg = agg;
  R.app = A;
}

/* ── 8. --toc: 앱 목차와 비교 (spec 17-8-12 S18 · 8g-3) ──────────────
   · 개요: 앱 `readOutline(doc)` 의 항목 = 1절 시제품(쪽·깊이·제목 — 제목은 앱이 앞뒤 공백을 다듬으므로 다듬어 비교)
   · `ensure` 를 흉내 IndexedDB 로 — 저장 상태·항목·라벨 저장 여부, 두 번째 호출의 PDF 호출 수(0 이어야)
   · 쪽 라벨: 저장된 라벨 수 · 개요 항목 중 인쇄 라벨이 PDF 쪽과 다른 것 · 숫자 라벨의 PDF−라벨 차 상위
   · 폴백: 앱 `headingToc(검색 레코드)` = 6절 변형 C(항목 `쪽|제목` 집합 차 0), 개요 대비 쪽·제목 재현율(6절과 같은 일치 규칙),
     행 표 쪽 항목, 남은 숫자만 항목, 같은 쪽에 붙인 제목이 따로 또 나오는 겹침 수
   · `tocOf`(개요 [] 문서 — heading 줄만 남겨 읽는 경로)의 목록 = `headingToc` 목록 */
if (argv.includes('--toc')) {
  if (!globalThis.indexedDB) { const { installFakeIdb } = await import('../tests/fixtures/fake-idb.mjs'); installFakeIdb(); }
  const adb = await import('../js/db.js');
  const OL = await import('../js/search/outline.js');
  const AS = await import('../js/text/search.js');
  const T = {};
  const msOf = (t) => +(performance.now() - t).toFixed(1);
  // 개요 — 앱 readOutline 대 1절
  let t = performance.now();
  const got = await OL.readOutline(doc);
  T.readOutlineMs = msOf(t);
  const protoP = R._outlinePages, protoT = R._outlineTitles;
  let pDiff = 0, tDiff = 0;
  for (let k = 0; k < Math.max(protoP.length, got.outline.length); k++) {
    const a = got.outline[k];
    if (!a || a.p !== (protoP[k] == null ? null : protoP[k])) pDiff++;
    if (!a || a.t !== String(protoT[k] || '').trim()) tDiff++;
  }
  const depthHist = {};
  for (const x of got.outline) depthHist[x.d] = (depthHist[x.d] || 0) + 1;
  T.outline = {
    items: got.outline.length, protoItems: protoP.length, resolved: got.outline.filter((x) => x.p != null).length,
    pageDiffVsProto: pDiff, titleDiffVsProto: tDiff, depthHist, depthMatchesProto: JSON.stringify(depthHist) === JSON.stringify(R.outline.byDepth),
    outOfOrder: got.outline.reduce((s, x, i, a) => s + (i && x.p != null && a[i - 1].p != null && x.p < a[i - 1].p ? 1 : 0), 0)
  };
  // 쪽 라벨
  const L = got.pageLabels;
  const offs = new Map();
  if (L) for (let i = 0; i < L.length; i++) if (/^\d+$/.test(L[i])) { const o = (i + 1) - Number(L[i]); offs.set(o, (offs.get(o) || 0) + 1); }
  T.labels = {
    stored: !!L, count: L ? L.length : 0,
    outlineItemsWithPrintedLabel: L ? got.outline.filter((x) => x.p != null && OL.printedLabel(L, x.p) != null).length : 0,
    pdfMinusLabelTop3: [...offs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  };
  // ensure — 흉내 IndexedDB
  const TD = 'toc-bench';
  await adb.put('documents', { id: TD, title: 'toc', fileHash: 'toc', pageCount: N, lastOpenedAt: 1 });
  const calls = { n: 0 };
  const counted = new Proxy(doc, { get(o, k) { const v = o[k]; if (typeof v !== 'function') return v; return (...a) => { calls.n++; return v.apply(o, a); }; } });
  t = performance.now();
  const e1 = await OL.ensure(TD, counted);
  T.ensure = { first: e1, firstMs: msOf(t), pdfCallsFirst: calls.n };
  calls.n = 0;
  const e2 = await OL.ensure(TD, counted);
  const saved = await adb.get('documents', TD);
  T.ensure.second = e2.status;
  T.ensure.pdfCallsSecond = calls.n;
  T.ensure.storedEqualsRead = JSON.stringify(saved.outline) === JSON.stringify(got.outline) && JSON.stringify(saved.pageLabels || null) === JSON.stringify(L);
  T.ensure.storedJsonBytes = { outline: JSON.stringify(saved.outline).length, pageLabels: saved.pageLabels ? JSON.stringify(saved.pageLabels).length : 0 };
  // 폴백 — 앱 headingToc 대 6절 변형 C
  const recs = pages.map((x) => Object.assign(v8.deserialize(x.stBuf), { pageNo: x.p }));
  t = performance.now();
  const toc = AS.headingToc(recs);
  T.headingTocMs = msOf(t);
  const keyOfEntry = (h) => h.p + '|' + h.t;
  const protoC = R._takeC;
  const cnt = new Map();
  for (const h of protoC) cnt.set(keyOfEntry(h), (cnt.get(keyOfEntry(h)) || 0) + 1);
  for (const h of toc) cnt.set(keyOfEntry(h), (cnt.get(keyOfEntry(h)) || 0) - 1);
  let symDiff = 0; for (const v of cnt.values()) symDiff += Math.abs(v);
  const key = (s) => foldText(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let tried = 0, pos = 0, title = 0;
  for (let k = 0; k < protoP.length; k++) {
    const P = protoP[k]; if (P == null || P < FROM || P > TO) continue;
    tried++;
    const near = toc.filter((h) => h.p >= P && h.p <= P + 1);
    if (near.length) pos++;
    const tt = key(protoT[k]);
    if (near.some((h) => { const hn = key(h.t.replace(/^[\d\s.,–-]+/, '')); return hn && (hn === tt || (hn.length >= 8 && (tt.includes(hn) || hn.includes(tt)))); })) title++;
  }
  const rtPagesSet = new Set(pages.filter((x) => x.hasRt).map((x) => x.p));
  const DIG = /^[\d\s.,–-]+$/;
  const tset = new Set(toc.map(keyOfEntry));
  let dup = 0;
  for (const h of toc) { const m = /^[\d\s.,–-]+\s(.+)$/.exec(h.t); if (m && tset.has(h.p + '|' + m[1])) dup++; }
  T.fallback = {
    // `[8g-4b 안내]` 옛 변형 C 와의 차 — 8g-3b 뒤로는 0 이 아니다(의도). S18 은 measure-toc-8g3b.mjs 로.
    note: 'symDiffVsProtoC 는 8g-3b 전 규칙(변형 C)과의 차 — S18·S36 은 dev/measure-toc-8g3b.mjs 로',
    entries: toc.length, protoCEntries: protoC.length, symDiffVsProtoC: symDiff,
    outlineTried: tried, outlinePagesWithEntry: pos, outlineTitleMatched: title,
    onRowtablePages: toc.filter((h) => rtPagesSet.has(h.p)).length, stillDigitsOnly: toc.filter((h) => DIG.test(h.t)).length,
    mergedAlsoListedSeparately: dup, minRatio: toc.length ? Math.min(...toc.map((h) => h.r)) : null
  };
  // tocOf — 개요가 [] 인 문서로(폴백 경로) · heading 줄만 남겨 읽은 목록이 같은가
  const FD = 'toc-fallback';
  await adb.put('documents', { id: FD, title: 'fb', fileHash: 'fb', pageCount: N, lastOpenedAt: 1, outline: [], outlineV: OL.OUTLINE_V });
  for (let i = 0; i < recs.length; i += 250) await adb.putAll('searchText', recs.slice(i, i + 250).map((r) => Object.assign({}, r, { docId: FD })));
  t = performance.now();
  const tf = await OL.tocOf(FD);
  T.tocOfFallback = {
    msFakeIdb: msOf(t), source: tf.source, outlineRead: tf.outlineRead, entries: tf.items.length,
    sameAsHeadingToc: JSON.stringify(tf.items.map((h) => [h.t, h.p])) === JSON.stringify(toc.map((h) => [h.t, h.p]))
  };
  recs.length = 0;
  R.toc = T;
}

delete R._outlinePages; delete R._outlineTitles; delete R._takeC;
const s = JSON.stringify(R, null, 1);
const j = opt('json', null);
if (j) fs.writeFileSync(j, s);
console.log(s);
