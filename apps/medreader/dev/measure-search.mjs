#!/usr/bin/env node
/* ============================================================
   MedReader — 검색 설계 측정 (spec 17-8 · Plan 2026-10-12)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-search.mjs <pdf>
         [--json <파일>]        결과 수치를 JSON 으로 저장
         [--outline-only]       개요(북마크)만 재고 끝낸다(빠름)
         [--stride k]           k 쪽마다(기본 1 = 전수). 시간·크기 측정은 전수에서만 의미가 있다

   재는 것 (수치만 낸다 — 원서 문장·제목을 출력하지 않는다):
   1. PDF 개요(outline) — 항목 수·깊이·쪽 대상 해석 성공률·시간, 쪽 라벨 유무
   2. 앱과 같은 레이아웃(buildPageLayout → toStored)으로 쪽마다 "검색 대상 글자"
      (문단 = fromStored 의 조립 텍스트, 표 줄 따로)
   3. heading 문단 — 수·글자 크기 비율·개요 제목과의 일치율(목차 폴백이 쓸 만한가)
   4. 세 방식의 시간·크기 (Node — 브라우저 IndexedDB 는 이 스크립트가 재지 못한다):
      (i)  쪽 레코드를 하나씩 역직렬화(v8.deserialize = 구조화 복제와 같은 직렬화기)해 훑기
           (i-b) 쪽마다 정규화 글자만 든 가벼운 레코드를 훑기
      (ii) 낱말 역색인(낱말 → 쪽 목록) — 만들기 시간·크기·찾기 시간
      (iii) 문서 하나 = 정규화 글자 한 덩어리 + 쪽 시작 오프셋 — gzip 크기·풀기·훑기 시간
   5. 의학 용어 검색의 실제 — 대소문자·하이픈·그리스 문자·악센트·합자·약어의 빈도

   js/ 는 읽기만 한다. 출력은 수치뿐이다.
   ============================================================ */

import fs from 'node:fs';
import v8 from 'node:v8';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { loadPdfjs, positional, pageLayout } from './measure-lib.mjs';
import { toStored, fromStored } from '../js/text/store.js';

const argv = process.argv;
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const [file] = positional(argv);
if (!file) { console.error('사용: measure-search.mjs <pdf> [--json f] [--outline-only] [--stride k]'); process.exit(2); }
const stride = Number(opt('stride', 1)) || 1;
const outlineOnly = argv.includes('--outline-only');

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const N = doc.numPages;
const R = { pages: N };

/* ── 1. 개요 ─────────────────────────────────────────────── */
{
  const t0 = performance.now();
  const outline = await doc.getOutline();
  const tOutline = performance.now() - t0;
  const flat = [];
  (function walk(items, depth) {
    for (const it of items || []) { flat.push({ it, depth }); walk(it.items, depth + 1); }
  })(outline, 1);

  const t1 = performance.now();
  let ok = 0, named = 0, explicit = 0, urlOnly = 0, none = 0, fail = 0;
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

  const byDepth = {};
  for (const { depth } of flat) byDepth[depth] = (byDepth[depth] || 0) + 1;
  // 문서 순서와 쪽 순서가 맞는가(깊이 우선 순회에서 쪽이 줄어드는 횟수)
  let back = 0, prev = 0;
  for (const p of pagesOf) { if (p == null) continue; if (p < prev) back++; prev = p; }
  const resolvedPages = pagesOf.filter((p) => p != null);
  const distinctPages = new Set(resolvedPages).size;
  // 개요가 덮는 범위 — 개요 항목 사이 쪽 간격(최상위 깊이 기준이 아니라 전체)
  const sorted = [...new Set(resolvedPages)].sort((a, b) => a - b);
  const gaps = []; for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
  gaps.sort((a, b) => a - b);
  let labels = null;
  try { labels = await doc.getPageLabels(); } catch (e) { labels = null; }
  let labelDiffers = 0;
  const labelKinds = { numeric: 0, roman: 0, other: 0 }; const labelOffsets = new Map();
  if (labels) for (let i = 0; i < labels.length; i++) {
    const l = String(labels[i]);
    if (l !== String(i + 1)) labelDiffers++;
    if (/^\d+$/.test(l)) { labelKinds.numeric++; const o = (i + 1) - Number(l); labelOffsets.set(o, (labelOffsets.get(o) || 0) + 1); }
    else if (/^[ivxlcdm]+$/i.test(l)) labelKinds.roman++; else labelKinds.other++;
  }
  const titleLen = flat.map(({ it }) => String(it.title || '').length).sort((a, b) => a - b);

  R.outline = {
    items: flat.length, topLevel: (outline || []).length, maxDepth: Math.max(0, ...flat.map((f) => f.depth)),
    byDepth, resolved: ok, resolvedPct: flat.length ? +(100 * ok / flat.length).toFixed(1) : null,
    named, explicit, urlOnly, noDest: none, failed: fail,
    outOfOrder: back, distinctPages,
    gapMedian: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null, gapP90: gaps.length ? gaps[Math.floor(gaps.length * 0.9)] : null, gapMax: gaps.length ? gaps[gaps.length - 1] : null,
    firstPage: sorted[0] || null, lastPage: sorted[sorted.length - 1] || null,
    titleLenMedian: titleLen.length ? titleLen[Math.floor(titleLen.length / 2)] : null, titleLenMax: titleLen.length ? titleLen[titleLen.length - 1] : null,
    msGetOutline: +tOutline.toFixed(1), msResolveAll: +tResolve.toFixed(1),
    pageLabels: labels ? labels.length : 0, pageLabelsDifferFromIndex: labelDiffers,
    pageLabelKinds: labelKinds,
    // [PDF 쪽 − 인쇄 쪽, 쪽 수] 상위 3
    pageLabelOffsets: [...labelOffsets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  };
  R._outlinePages = pagesOf;
  R._outlineTitles = flat.map(({ it }) => String(it.title || ''));
}

if (outlineOnly) { finish(); process.exit(0); }

/* ── 정규화 (spec 17-8 안 — 길이를 보존하는 1:1 접기) ───────── */
const FOLD = new Map();
function fold1(ch) {
  let f = FOLD.get(ch);
  if (f !== undefined) return f;
  let c = ch.toLowerCase();
  if (c.length !== 1) c = ch;
  const d = c.normalize('NFD');
  if (d.length > 1 && /\p{M}/u.test(d.slice(1)) && /[a-z]/.test(d[0])) c = d[0];   // é → e
  if (/[‐-―−­-]/.test(c)) c = ' ';                                 // 하이픈·대시 → 공백
  else if (/[‘’‛′]/.test(c)) c = "'";
  else if (/[“”‟″]/.test(c)) c = '"';
  FOLD.set(ch, c);
  return c;
}
function foldText(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) out += fold1(s[i]);
  return out;
}

/* ── 2. 쪽마다 레이아웃 → 저장본 → 검색 대상 글자 ─────────── */
const T0 = performance.now();
const pages = [];                // { p, stored(Buffer), slim(Buffer), text, tableText, headings[] }
let paraChars = 0, tableChars = 0, lineChars = 0, storedJson = 0, storedV8 = 0, hyphenHidden = 0;
const headStats = { paras: 0, bigFont: 0, b115: 0, b140: 0, b180: 0, short3: 0, digitsOnly: 0, len60plus: 0 };
for (let p = 1; p <= N; p += stride) {
  const { L } = await pageLayout(doc, p);
  const rec = toStored(L);
  rec.docId = 'bench'; rec.pageNo = p;
  const js = JSON.stringify(rec); storedJson += js.length;
  const buf = v8.serialize(rec); storedV8 += buf.length;
  const F = fromStored(rec);
  const byId = new Map(F.lines.map((l) => [l.id, l]));
  for (const l of F.lines) { lineChars += String(l.text || '').length; if (l.hyphenJoin) hyphenHidden++; }
  const paraTexts = [];
  const heads = [];
  for (const pa of F.paragraphs) {
    paraTexts.push(pa.text);
    if (pa.kind === 'heading') {
      headStats.paras++;
      const l0 = byId.get(pa.lineIds[0]);
      const ratio = l0 && F.stats && F.stats.medianFontSize ? l0.fontSize / F.stats.medianFontSize : 0;
      if (ratio >= 1.15) headStats.bigFont++;
      if (ratio >= 1.15 && ratio < 1.4) headStats.b115++; else if (ratio >= 1.4 && ratio < 1.8) headStats.b140++; else if (ratio >= 1.8) headStats.b180++;
      const t = pa.text.trim();
      if (t.length <= 3) headStats.short3++;
      if (/^[\d\s.,-]+$/.test(t)) headStats.digitsOnly++;
      if (t.length > 60) headStats.len60plus++;
      heads.push({ t, ratio });
    }
  }
  const tableLines = [];
  for (const g of F.regions || []) for (const id of g.lineIds || []) { const l = byId.get(id); if (l) tableLines.push(String(l.text || '')); }
  const text = paraTexts.join('\n');
  const tableText = tableLines.join('\n');
  paraChars += text.length; tableChars += tableText.length;
  const slimRec = { docId: 'bench', pageNo: p, t: foldText(text + (tableText ? '\n' + tableText : '')) };
  pages.push({ p, stored: buf, slim: v8.serialize(slimRec), text, tableText, heads });
}
const tExtract = performance.now() - T0;
R.text = {
  pagesMeasured: pages.length, msExtractAll: Math.round(tExtract),
  paraChars, tableChars, lineChars, tablePct: +(100 * tableChars / Math.max(1, paraChars + tableChars)).toFixed(1),
  hyphenHiddenLines: hyphenHidden,
  storedJsonMB: +(storedJson / 1e6).toFixed(2), storedV8MB: +(storedV8 / 1e6).toFixed(2),
  storedIdbEstMB_x040: +(storedJson * 0.40 / 1e6).toFixed(2)
};
R.headings = headStats;
R.headings.perPage = +(headStats.paras / pages.length).toFixed(2);

/* ── 3. 개요 제목 ↔ heading 일치율 ───────────────────────── */
{
  const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byPage = new Map(pages.map((x) => [x.p, x]));
  let tried = 0, hit = 0, hitBig = 0;
  for (let i = 0; i < R._outlinePages.length; i++) {
    const p = R._outlinePages[i]; if (p == null) continue;
    const t = norm(R._outlineTitles[i]); if (t.length < 4) continue;
    const cands = [byPage.get(p), byPage.get(p + 1)].filter(Boolean);
    if (!cands.length) continue;
    tried++;
    let m = null;
    for (const c of cands) for (const h of c.heads) {
      const hn = norm(h.t);
      if (hn.length >= 4 && (hn === t || (hn.length >= 8 && (t.includes(hn) || hn.includes(t))))) { m = h; break; }
    }
    if (m) { hit++; if (m.ratio >= 1.15) hitBig++; }
  }
  R.outlineVsHeading = { tried, matched: hit, matchedPct: tried ? +(100 * hit / tried).toFixed(1) : null, matchedBigFont: hitBig,
    headingsPerOutlineItem: R.outline.items ? +(headStats.paras / R.outline.items).toFixed(1) : null };

  // heading 을 "제목 검색"으로 쓰면 — 반복되는 일반 소제목 수, 검색어가 든 heading 수(본문 적중 쪽과 비교는 4 의 결과)
  const hf = (s) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[‐-―−-]/g, ' ').replace(/β/g, 'beta').replace(/α/g, 'alpha');
  const freq = new Map(); const all = [];
  for (const x of pages) for (const h of x.heads) { const t = hf(h.t); all.push({ t, ratio: h.ratio }); freq.set(t, (freq.get(t) || 0) + 1); }
  const rep = [...freq.values()].filter((n) => n >= 10);
  R.headingSearch = {
    distinct: freq.size, repeatedTexts_ge10: rep.length, headingsInRepeated_ge10: rep.reduce((a, b) => a + b, 0),
    hits: Object.fromEntries(['metformin', 'heart failure', 'sarcoidosis', 'beta blocker', 'rheumatoid arthritis', 'hypertension', 'diabetes'].map((q) => {
      const qf = hf(q); const m = all.filter((h) => h.t.includes(qf));
      return [q, { headings: m.length, bigFont: m.filter((h) => h.ratio >= 1.15).length }];
    }))
  };
}

/* ── 5. 의학 용어의 실제 — 빈도만 ─────────────────────────── */
{
  const all = pages.map((x) => x.text + '\n' + x.tableText).join('\n');
  const cnt = (re) => (all.match(re) || []).length;
  const greek = {}; for (const ch of 'αβγδεκλμσωΑΒΓΔ') { const n = all.split(ch).length - 1; if (n) greek[ch] = n; }
  let diacriticWords = 0; const diaSet = new Set();
  for (const w of all.match(/[\p{L}]+/gu) || []) { if (/\p{M}/u.test(w.normalize('NFD')) && /[A-Za-z]/.test(w)) { diacriticWords++; diaSet.add(w.toLowerCase()); } }
  let nonLatin1AfterFold = 0; const nl = {};
  const folded = foldText(all);
  for (let i = 0; i < folded.length; i++) { const c = folded.charCodeAt(i); if (c > 0xFF) { nonLatin1AfterFold++; const k = folded[i]; nl[k] = (nl[k] || 0) + 1; } }
  const topNonLatin1 = Object.entries(nl).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => ['U+' + k.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'), v]);
  R.terms = {
    totalChars: all.length,
    'beta-blocker(하이픈)': cnt(/\bbeta-blockers?\b/gi), 'beta blocker(공백)': cnt(/\bbeta blockers?\b/gi), 'betablocker(붙음)': cnt(/\bbetablockers?\b/gi),
    'β-blocker': cnt(/β-blockers?/gi), 'β blocker': cnt(/β blockers?/gi),
    'β 전체': greek['β'] || 0, 'beta 낱말': cnt(/\bbeta\b/gi), greek,
    ligatures: cnt(/[ﬀ-ﬆ]/g), softHyphen: cnt(/­/g), nbsp: cnt(/ /g),
    diacriticWords, diacriticDistinct: diaSet.size,
    enDash: cnt(/–/g), emDash: cnt(/—/g), hyphenMinus: cnt(/-/g), minusSign: cnt(/−/g),
    curlyApos: cnt(/[‘’]/g),
    nonLatin1AfterFold, topNonLatin1,
    // 약어 — 대소문자 구분 / 무시, 낱말 경계 / 접두
    abbr: Object.fromEntries(['MI', 'HF', 'RA', 'SLE', 'ACE', 'CKD', 'TB'].map((a) => [a, {
      exactCase: cnt(new RegExp('\\b' + a + '\\b', 'g')),
      wordIgnoreCase: cnt(new RegExp('\\b' + a + '\\b', 'gi')),
      prefixIgnoreCase: cnt(new RegExp('\\b' + a, 'gi'))
    }])),
    plural: { 'blocker 낱말': cnt(/\bblocker\b/gi), 'blockers 낱말': cnt(/\bblockers\b/gi), 'blocker 접두': cnt(/\bblocker/gi) }
  };
}

/* ── 4. 세 방식 ───────────────────────────────────────────── */
const QUERIES = ['metformin', 'heart failure', 'sarcoidosis', 'beta blocker', 'rheumatoid arthritis', 'warfarin', 'lupus', 'hypertension', 'the'];
function countAll(hay, needle) { let n = 0, i = hay.indexOf(needle); while (i >= 0) { n++; i = hay.indexOf(needle, i + needle.length); } return n; }
function timeIt(fn, reps = 3) { let best = Infinity, out; for (let r = 0; r < reps; r++) { const t = performance.now(); out = fn(); best = Math.min(best, performance.now() - t); } return { ms: +best.toFixed(1), out }; }
const qn = QUERIES.map(foldText);

// (i) 쪽 레코드 전체를 역직렬화 → 문단 조립(fromStored) → 접기 → 찾기
R.scanFullRecords = {};
{
  const r = timeIt(() => {
    let hits = 0, hitPages = 0;
    for (const x of pages) {
      const rec = v8.deserialize(x.stored);
      const F = fromStored(rec);
      const t = foldText(F.paragraphs.map((p) => p.text).join('\n'));
      const n = countAll(t, qn[0]); hits += n; if (n) hitPages++;
    }
    return { hits, hitPages };
  }, 2);
  const d = timeIt(() => { let s = 0; for (const x of pages) s += v8.deserialize(x.stored).lines.length; return s; }, 2);
  R.scanFullRecords = { query: QUERIES[0], ms: r.ms, msDeserializeOnly: d.ms, hits: r.out.hits, hitPages: r.out.hitPages };
}
// (i-b) 가벼운 레코드 {t: 접은 글자}
{
  const sz = pages.reduce((a, x) => a + x.slim.length, 0);
  const r = timeIt(() => {
    const res = [];
    for (let qi = 0; qi < qn.length; qi++) {
      let hits = 0, hitPages = 0;
      for (const x of pages) { const t = v8.deserialize(x.slim).t; const n = countAll(t, qn[qi]); hits += n; if (n) hitPages++; }
      res.push({ q: QUERIES[qi], hits, hitPages });
    }
    return res;
  }, 2);
  const one = timeIt(() => { let h = 0; for (const x of pages) h += countAll(v8.deserialize(x.slim).t, qn[0]); return h; }, 3);
  R.scanSlimRecords = { v8MB: +(sz / 1e6).toFixed(2), msPerQuery: one.ms, perQuery: r.out };
}
// (iii) 문서 = 한 덩어리
{
  const starts = new Int32Array(pages.length);
  let blob = '';
  for (let i = 0; i < pages.length; i++) { starts[i] = blob.length; blob += v8.deserialize(pages[i].slim).t + '\f'; }
  let twoByte = false; for (let i = 0; i < blob.length; i++) if (blob.charCodeAt(i) > 0xFF) { twoByte = true; break; }
  const raw = Buffer.from(blob, 'utf8');
  const gz = timeIt(() => zlib.gzipSync(raw, { level: 6 }), 1);
  const gz1 = zlib.gzipSync(raw, { level: 1 });
  const gunz = timeIt(() => zlib.gunzipSync(gz.out).toString('utf8'), 3);
  // 원문(접지 않은) 덩어리 — 결과 조각을 원래 글자로 보이려면 필요하다
  let orig = ''; for (const x of pages) orig += x.text + (x.tableText ? '\n' + x.tableText : '') + '\f';
  const origGz = zlib.gzipSync(Buffer.from(orig, 'utf8'), { level: 6 });
  const pageOf = (off) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= off) lo = m; else hi = m - 1; } return pages[lo].p; };
  const per = [];
  for (let qi = 0; qi < qn.length; qi++) {
    const r = timeIt(() => {
      let n = 0, i = blob.indexOf(qn[qi]); const hp = new Set();
      while (i >= 0) { n++; hp.add(pageOf(i)); i = blob.indexOf(qn[qi], i + qn[qi].length); }
      return { hits: n, hitPages: hp.size };
    }, 3);
    per.push({ q: QUERIES[qi], ms: r.ms, hits: r.out.hits, hitPages: r.out.hitPages });
  }
  // 낱말 경계 정규식(약어·짧은 검색어용)
  const re = timeIt(() => (blob.match(/\bmi\b/g) || []).length, 3);
  // 접두 일치(낱말 시작) 정규식
  const pre = timeIt(() => (blob.match(/\bmetform/g) || []).length, 3);
  // 결과 조각 200개 만들기(앞뒤 40자)
  const snip = timeIt(() => { const out = []; let i = blob.indexOf(qn[3]); while (i >= 0 && out.length < 200) { out.push(orig.slice(Math.max(0, i - 40), i + qn[3].length + 40)); i = blob.indexOf(qn[3], i + 1); } return out.length; }, 3);
  R.blob = {
    chars: blob.length, twoByteString: twoByte, memMB: +((twoByte ? 2 : 1) * blob.length / 1e6).toFixed(1),
    utf8MB: +(raw.length / 1e6).toFixed(2), gzipMB: +(gz.out.length / 1e6).toFixed(2), gzip1MB: +(gz1.length / 1e6).toFixed(2), msGzip: gz.ms, msGunzip: gunz.ms,
    origGzipMB: +(origGz.length / 1e6).toFixed(2), origSameLength: orig.length === blob.length,
    perQuery: per, msWordRegexMI: re.ms, wordRegexMIHits: re.out, msPrefixRegex: pre.ms, prefixHits: pre.out, msSnippets200: snip.ms
  };
}
// (ii) 낱말 역색인
{
  const b = timeIt(() => {
    const idx = new Map();
    for (const x of pages) {
      const t = v8.deserialize(x.slim).t;
      const seen = new Set();
      for (const w of t.match(/[\p{L}\p{N}]+/gu) || []) { if (seen.has(w)) continue; seen.add(w); let a = idx.get(w); if (!a) idx.set(w, a = []); a.push(x.p); }
    }
    return idx;
  }, 1);
  const idx = b.out;
  let postings = 0; for (const a of idx.values()) postings += a.length;
  const obj = Object.fromEntries(idx);
  const json = JSON.stringify(obj);
  // 쪽 번호를 차분 + 가변 길이로 담은 꼴(현실적인 최소)
  const terms = [...idx.keys()].sort();
  const enc = []; for (const t of terms) { const a = idx.get(t); let prev = 0; for (const p of a) { let d = p - prev; prev = p; while (d >= 128) { enc.push((d & 127) | 128); d >>= 7; } enc.push(d); } }
  const termBytes = Buffer.byteLength(terms.join('\n'), 'utf8');
  const gzJson = zlib.gzipSync(Buffer.from(json, 'utf8'));
  // 찾기: 정확한 낱말 / 접두(정렬된 낱말 목록에서 이분 탐색)
  const look = timeIt(() => { const a = idx.get('metformin'); return a ? a.length : 0; }, 5);
  const prefix = timeIt(() => {
    let lo = 0, hi = terms.length; const pfx = 'metform'; while (lo < hi) { const m = (lo + hi) >> 1; if (terms[m] < pfx) lo = m + 1; else hi = m; }
    const hp = new Set(); for (let i = lo; i < terms.length && terms[i].startsWith(pfx); i++) for (const p of idx.get(terms[i])) hp.add(p); return hp.size;
  }, 5);
  // 구(여러 낱말): 후보 쪽 = 교집합 → 실제 구가 있는 쪽 수와 비교(나머지는 쪽을 읽어 확인해야 한다)
  const phrase = (q) => {
    const ws = foldText(q).match(/[\p{L}\p{N}]+/gu); let cand = null;
    for (const w of ws) { const s = new Set(idx.get(w) || []); cand = cand ? new Set([...cand].filter((p) => s.has(p))) : s; }
    return cand ? cand.size : 0;
  };
  R.invIndex = {
    msBuild: b.ms, terms: idx.size, postings, jsonMB: +(json.length / 1e6).toFixed(2), jsonGzipMB: +(gzJson.length / 1e6).toFixed(2),
    compactMB: +((termBytes + enc.length) / 1e6).toFixed(2),
    msExactLookup: look.ms, msPrefixLookup: prefix.ms, prefixPages: prefix.out,
    phraseCandidates: { 'heart failure': phrase('heart failure'), 'rheumatoid arthritis': phrase('rheumatoid arthritis'), 'beta blocker': phrase('beta blocker') },
    termsSeenOnce: [...idx.values()].filter((a) => a.length === 1).length
  };
}

finish();

function finish() {
  delete R._outlinePages; delete R._outlineTitles;
  const s = JSON.stringify(R, null, 1);
  const j = opt('json', null);
  if (j) fs.writeFileSync(j, s);
  console.log(s);
}
