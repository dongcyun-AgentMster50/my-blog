#!/usr/bin/env node
/* ============================================================
   MedReader — 8g-3b Plan 실측: 쓰레기 개요 판정 · heading 폴백 목차 일반 규칙 (spec 17-8-12 §11 · 2026-10-19)

     MEDREADER_PDFJS=<폴더 또는 pdf.mjs> node apps/medreader/dev/measure-toc-8g3b.mjs <pdf> [<pdf> …]
         [--json <파일>]   책마다 결과 수치를 JSON 배열로 저장
         [--first N]       처음 N 항목 표본(기본 15, 제목은 40자에서 자른다 — 사람이 '제목다운가'를 보는 용도)

   책마다 앱 경로 그대로 — `getTextContent(PDF_TEXT_CONTENT_OPTIONS)` → `buildPageLayout`(이웃 = 앞 쪽 최종본 +
   뒤 쪽 예비본) → `toStored` → `fromStored` → `searchRecordOf` — 검색 레코드를 만들고:
   · 개요: 앱 `readOutline` → 파일 이름 꼴 항목 비율, 시제품 판정 `protoJunk`(§11-2). 앱에 `isJunkOutline` 이
     있으면(8g-3b Build 뒤) 그 판정과 맞댄다.
   · 폴백: 앱 `headingToc(recs, {pages})` 와 시제품 `protoToc`(§11-3)의 항목 집합 차(Build 뒤 0 이어야 한다),
     진짜 개요가 있으면 개요 대비(쪽 ±1 · 제목 — `measure-search-8g.mjs` 6절과 같은 일치 규칙),
     앞 30쪽에 'contents' 쪽이 있으면 그 쪽부터 6쪽 글자에 든 항목 수(제목다운 항목의 하한 근사),
     문장꼴 항목 수(끝 부호 . ? ! · 따옴표 · 80자 초과 — 진단용).
   js/ 는 import 만 한다. 출력 제목은 40자 이하로 자른다(원서 문장을 길게 내지 않는다).
   이 파일의 `protoToc`·`protoJunk` 는 spec 17-8-12 §11 규칙의 **기준 정의**다 — 스크래치 시제품
   (`p8g3b/lib.mjs` F2)과 실측 94권에서 항목 집합 차 0 을 확인했다.
   ============================================================ */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { loadPdfjs, positional } from './measure-lib.mjs';
import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { PDF_TEXT_CONTENT_OPTIONS, SEARCH } from '../js/config.js';
import { toStored, fromStored } from '../js/text/store.js';
import * as AS from '../js/text/search.js';
import * as OL from '../js/search/outline.js';

/* ── §11-2 쓰레기 개요(스캐너가 쪽마다 붙인 파일 이름) ─────────────── */
export const JUNK_TITLE_RE = /\.(jpe?g|jpe|jfif|png|bmp|tiff?|gif|webp|pdf)$|^untitled(?:[-_ ]?\d+)?$/i;
export const JUNK_OUTLINE_RATIO = 0.8;
export function junkRatio(outline) {
  const o = Array.isArray(outline) ? outline : [];
  if (!o.length) return 0;
  let n = 0;
  for (const it of o) { const t = String((it && it.t) || '').trim(); if (!t || JUNK_TITLE_RE.test(t)) n++; }
  return n / o.length;
}
export function protoJunk(outline) {
  return Array.isArray(outline) && outline.length > 0 && junkRatio(outline) >= JUNK_OUTLINE_RATIO;
}

/* ── §11-3 heading 폴백 일반 규칙 ─────────────────────────────── */
export const P = { MIN_R: 0.9, WEAK_R: 1.15, MAX_LEN: 80, REPEAT_MIN: 3 };
const DIGITS_ONLY = /^[\d\s.,–-]+$/;
const ELLIPSIS_END = /(\.\.|…)\s*[.!?]?["”’']?$/u;
const SENT_END = /(\p{L}+)([.!?])["”’']?$/u;
const MULTI = /\p{Ll}{2,}[.!?]["”’']?\s+["“‘]?\p{Lu}/u;
const DIALOG_START = /^(["“”„«»‘’'‹›]|[—–]\s)/u;
const DIALOG_END = /["“”»’'‹›]$/u;
const OCR_SYMBOL = /[{}®£¢§©_~^=<>\\@¤°]/;
const count = (s, re) => (String(s).match(re) || []).length;

/** 이 heading 을 폴백 후보에서 빼는 까닭(없으면 null). 순서는 집계용일 뿐 결과에 영향 없다. */
export function dropReason(h) {
  const raw = String(h.t);
  const t = raw.trim();
  if (h.r < P.MIN_R) return 'small';                                     // ① 본문보다 뚜렷이 작은 글자
  if (!DIGITS_ONLY.test(raw)) {
    const L = count(raw, /\p{L}/gu);
    if (L < 3 || L / Math.max(1, raw.replace(/\s/g, '').length) < 0.5) return 'noise';   // ④ 글자 거의 없음
  }
  if (!ELLIPSIS_END.test(t)) {                                           // ② 문장 끝(말줄임 끝은 제목일 수 있다)
    const m = SENT_END.exec(t);
    if (m && !(m[2] === '.' && m[1].length <= 3)) return 'sentence';     //    'etc.' 같은 짧은 낱말 + 마침표는 아님
  }
  if (MULTI.test(t)) return 'multi';                                     // ② 한 문단에 두 문장
  if (OCR_SYMBOL.test(raw)) return 'symbol';                             // ④ OCR 잡음 기호
  if (t.length > P.MAX_LEN) return 'long';                               // ② 긴 줄
  if (DIALOG_START.test(t) || DIALOG_END.test(t)) return 'dialog';       // ④ 대화 따옴표·대화 줄표
  const cased = count(raw, /[\p{Lu}\p{Ll}]/gu);
  // ⑤ 본문보다 뚜렷이 크지 않은 제목은, 대소문자가 있는 글이면 '대문자 4자 이상·90% 이상'일 때만(소설의 장 제목 꼴)
  if (h.r < P.WEAK_R && cased >= 1 && !DIGITS_ONLY.test(raw) && !(cased >= 4 && count(raw, /\p{Lu}/gu) / cased >= 0.9)) return 'weak';
  return null;
}

/** 시제품 폴백 — 앱 `headingToc`(U11 변형 C) 뼈대 + §11-3 규칙. `pages` = 문서 쪽 수(짧은 책 반복 문턱). */
export function protoToc(recs, pages) {
  const max = SEARCH.TOC_FALLBACK_MAX;
  const rep = Number.isFinite(pages) && pages > 0
    ? Math.min(SEARCH.REPEAT_HEADING, Math.max(P.REPEAT_MIN, Math.ceil(pages / 2))) : SEARCH.REPEAT_HEADING;
  const all = [];
  for (const rec of (recs || []).slice().sort((a, b) => a.pageNo - b.pageNo)) for (const h of AS.headsOf(rec)) all.push(h);
  const freq = new Map();
  for (const h of all) { const k = AS.headKey(h.t); if (k) freq.set(k, (freq.get(k) || 0) + 1); }
  const why = {};
  const cand = all.filter((h) => {
    const k = AS.headKey(h.t);
    if (!k || freq.get(k) >= rep) return false;
    const w = dropReason(h);
    if (w) { why[w] = (why[w] || 0) + 1; return false; }
    return true;
  });
  const tiers = [...new Set(cand.map((h) => h.r))].sort((a, b) => b - a);
  let take = [];
  for (const r of tiers) { const nx = cand.filter((h) => h.r >= r); if (nx.length > max) break; take = nx; }
  const pos = new Map(all.map((h, k) => [h, k]));
  const out = take.map((h) => {
    let t = h.t;
    if (DIGITS_ONLY.test(t)) { const nx = all[pos.get(h) + 1]; if (nx && nx.p === h.p) t = t + ' ' + nx.t; }
    return { t, p: h.p, r: h.r };
  }).filter((h) => !DIGITS_ONLY.test(h.t));                              // 붙일 것 없는 숫자만 항목은 뺀다
  out.why = why;
  return out;
}

/* ── 지표 ───────────────────────────────────────────────────── */
const cut = (s, n = 40) => { const x = String(s).replace(/\s+/g, ' '); return x.length > n ? x.slice(0, n) + '…' : x; };
export function vsOutline(toc, outline) {
  let tried = 0, pos = 0, title = 0;
  for (const it of outline) {
    const P0 = it.p; if (P0 == null) continue;
    tried++;
    const near = toc.filter((h) => h.p >= P0 && h.p <= P0 + 1);
    if (near.length) pos++;
    const tt = AS.headKey(it.t);
    if (near.some((h) => { const hn = AS.headKey(h.t.replace(/^[\d\s.,–-]+/, '')); return hn && (hn === tt || (hn.length >= 8 && (tt.includes(hn) || hn.includes(tt)))); })) title++;
  }
  return { tried, pos, title };
}
function inContents(toc, C) {
  if (!C) return null;
  let n = 0, hit = 0;
  for (const h of toc) {
    if (h.p >= C.from && h.p <= C.to) continue;
    n++;
    const toks = AS.headKey(h.t).split(' ').filter(Boolean);
    for (let s = 0; s <= 2; s++) {                                       // OCR 이 붙인 앞 잡음 낱말 0–2개를 떼어 본다
      const k = toks.slice(s).join(' ');
      if (k.length < (s ? 8 : 6)) break;
      if (C.key.includes(' ' + k + ' ')) { hit++; break; }
    }
  }
  return { n, hit };
}
const sentenceLike = (h) => /[.?!…,;]["”’'»)\]]*$/u.test(h.t.trim()) || /^["“”„«»‘’'‹›—–]/u.test(h.t.trim()) || h.t.trim().length > 80;

/* ── 실행 ───────────────────────────────────────────────────── */
async function measureBook(pdfjs, file, firstN) {
  const t0 = performance.now();
  const doc = await pdfjs.getDocument({ url: file, verbosity: 0 }).promise;
  const N = doc.numPages;
  const got = await OL.readOutline(doc);
  const itemsOf = async (p) => {
    const page = await doc.getPage(p);
    try {
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
      const size = unrotatedPageSize(page.view, vp.width, vp.height);
      return { items: tc.items.filter((it) => it && typeof it.str === 'string'), styles: tc.styles || {}, width: size.width, height: size.height };
    } finally { page.cleanup(); }
  };
  const build = (p, s, nb) => toStored(buildPageLayout(s.items, { pageNo: p, width: s.width, height: s.height, styles: s.styles, neighborLayouts: nb }));
  const recs = [];
  const front = [];
  let prev = null, next = await itemsOf(1);
  for (let p = 1; p <= N; p++) {
    const cur = next;
    next = p < N ? await itemsOf(p + 1) : null;
    const pre = next ? build(p + 1, next, []) : null;
    const rec = build(p, cur, [prev, pre].filter(Boolean));
    prev = rec;
    const S = AS.searchRecordOf(fromStored(rec));
    if (p <= 30) front.push([p, S.text]);
    // tocOf 와 같은 꼴로 heading 줄만 남긴다
    const hs = AS.headsOf(Object.assign({ pageNo: p }, S));
    let o = 0; const heads = []; const parts = [];
    for (const h of hs) { heads.push({ i: h.i, o, r: h.r }); parts.push(h.t); o += h.t.length + 1; }
    if (heads.length) recs.push({ pageNo: p, text: parts.join('\n'), heads });
  }
  await doc.destroy();
  const R = { file: file.split(/[\\/]/).pop(), pages: N, extractMs: Math.round(performance.now() - t0), heads: recs.reduce((a, r) => a + r.heads.length, 0) };
  R.outline = { items: got.outline.length, junkRatio: +junkRatio(got.outline).toFixed(3), protoJunk: protoJunk(got.outline) };
  if (typeof OL.isJunkOutline === 'function') R.outline.appJunk = OL.isJunkOutline(got.outline);
  const realOutline = got.outline.length && !R.outline.protoJunk ? got.outline : null;
  const c0 = front.find(([, t]) => /\bcontents\b/i.test(t));
  const C = c0 ? { from: c0[0], to: c0[0] + 5, key: ' ' + AS.headKey(front.filter(([p]) => p >= c0[0] && p <= c0[0] + 5).map(([, t]) => t).join(' ')) + ' ' } : null;
  let t = performance.now();
  const app = AS.headingToc(recs, { pages: N });
  const appMs = performance.now() - t;
  t = performance.now();
  const proto = protoToc(recs, N);
  const protoMs = performance.now() - t;
  const key = (h) => h.p + '|' + h.t;
  const cnt = new Map();
  for (const h of proto) cnt.set(key(h), (cnt.get(key(h)) || 0) + 1);
  for (const h of app) cnt.set(key(h), (cnt.get(key(h)) || 0) - 1);
  let symDiff = 0; for (const v of cnt.values()) symDiff += Math.abs(v);
  const side = (toc, ms) => {
    const s = { entries: toc.length, ms: +ms.toFixed(1), sentenceLike: toc.filter(sentenceLike).length };
    if (realOutline) Object.assign(s, { vsOutline: vsOutline(toc, realOutline) });
    const ic = inContents(toc, C); if (ic) s.inContents = ic;
    return s;
  };
  R.app = side(app, appMs);
  R.proto = Object.assign(side(proto, protoMs), { dropped: proto.why });
  R.symDiffAppVsProto = symDiff;
  R.firstProto = proto.slice(0, firstN).map((h) => [h.p, h.r, cut(h.t)]);
  return R;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv;
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
  const files = positional(argv);
  if (!files.length) { console.error('사용: node apps/medreader/dev/measure-toc-8g3b.mjs <pdf> [<pdf> …] [--json 파일] [--first N]'); process.exit(2); }
  const pdfjs = await loadPdfjs(argv);
  const firstN = Number(opt('first', 15)) || 15;
  const all = [];
  for (const f of files) {
    const R = await measureBook(pdfjs, f, firstN);
    all.push(R);
    console.log(JSON.stringify(R));
  }
  const j = opt('json', null);
  if (j) fs.writeFileSync(j, JSON.stringify(all, null, 1));
}
