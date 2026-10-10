/* ============================================================
   MedReader — 러닝 헤드(쪽 머리말) 진단 (Node 전용, spec 4-7)

   쓰임:
     MEDREADER_PDFJS=<pdfjs 폴더> node apps/medreader/dev/probe-running-heads.mjs <pdf> <첫쪽> <끝쪽>
         [--stride k]        중심 쪽 간격(기본 1). 중심마다 앞뒤 2쪽을 같이 읽는다.
         [--base <js 폴더>]  비교 기준 js/ 사본(예: 고치기 전 스냅숏). 주면 전후를 나란히 잰다.
         [--show n]          진단 조각(40자 이하)을 n 개까지 보인다.
         [--json <파일>]     결과 수치를 JSON 으로 저장.
         [--param K=V,K=V]   현재 코드(cur)에만 LAYOUT 일부를 덮어써 돌린다(문턱 훑기용).

   무엇을 재나
   - "진짜 머리말"(정답)은 판정 규칙과 **독립적으로** 정한다: 쪽의 맨 윗줄(같은 높이의 줄 묶음)의
     정규화 문자열(숫자 → #)이 **두 쪽 떨어진 쪽**(같은 면 — 짝수·홀수 쪽 머리말이 다른 책 대응)
     또는 바로 이웃 쪽의 맨 윗줄과 같으면 머리말로 본다. 앱은 앞뒤 1쪽만 이웃으로 받는다.
   - 진짜 머리말 줄마다 4-7 header 조건(상단 영역·길이·글자 크기·반복/대문자/접두)의
     통과/실패를 센다. 그리고 그 줄이 낭독 문단에 남는지(paraId) 센다.
   - 진짜 머리말이 아닌데 header/footer 가 된 줄 = **본문이 빠진 후보**(가장 중요).
   - --base 를 주면 같은 쪽을 두 코드로 돌려 역할 전이·문단 수·kind·2단 쪽 수를 비교한다.

   원서 문장을 길게 출력하지 않는다(조각은 40자 이하). js/ 는 읽기만 한다.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPdfjs, positional } from './measure-lib.mjs';

const argv = process.argv;
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : dflt;
}

const [file, fromArg, toArg] = positional(argv);
if (!file) {
  console.error('쓰임: probe-running-heads.mjs <pdf> <첫쪽> <끝쪽> [--stride k] [--base <js 폴더>] [--show n] [--json 파일]');
  process.exit(2);
}
const stride = Math.max(1, Number(opt('stride', 1)) || 1);
const show = Number(opt('show', 0)) || 0;
const jsonOut = opt('json', null);
const baseDir = opt('base', null);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
async function loadBuild(jsRoot) {
  const u = (p) => pathToFileURL(path.join(jsRoot, p)).href;
  const layout = await import(u('text/layout.js'));
  const store = await import(u('text/store.js'));
  const blocks = await import(u('text/blocks.js'));
  const extract = await import(u('pdf/extract.js'));
  const config = await import(u('config.js'));
  return { LAYOUT: config.LAYOUT, buildPageLayout: layout.buildPageLayout, algoVersion: layout.algoVersion, toStored: store.toStored, normalizeRepeatKey: blocks.normalizeRepeatKey, unrotatedPageSize: extract.unrotatedPageSize };
}
const builds = [{ name: 'cur', B: await loadBuild(path.join(here, '..', 'js')) }];
const paramArg = opt('param', null);
if (paramArg) {
  const over = {};
  for (const kv of paramArg.split(',')) { const [k, v] = kv.split('='); over[k.trim()] = Number(v); }
  builds[0].B.params = Object.assign({}, builds[0].B.LAYOUT, over);
}
if (baseDir) builds.unshift({ name: 'base', B: await loadBuild(path.resolve(baseDir)) });

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file, verbosity: 0 }).promise;
const N = doc.numPages;
const from = Math.max(3, Number(fromArg) || 3);
const to = Math.min(N - 2, Number(toArg) || N - 2);

// 텍스트 내용 캐시(앞뒤 2쪽을 겹쳐 읽으므로)
const tcCache = new Map();
async function textOf(p) {
  if (tcCache.has(p)) return tcCache.get(p);
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const rec = { items: tc.items, styles: tc.styles, view: page.view, vw: vp.width, vh: vp.height };
  page.cleanup();
  tcCache.set(p, rec);
  for (const k of tcCache.keys()) if (k < p - 6) tcCache.delete(k);
  return rec;
}
function layoutOf(B, p, t, neighbors) {
  const s = B.unrotatedPageSize(t.view, t.vw, t.vh);
  return B.buildPageLayout(t.items, { pageNo: p, width: s.width, height: s.height, styles: t.styles, neighborLayouts: neighbors || [] }, B.params || B.LAYOUT);
}

const norm = (s) => String(s || '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
const frag = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
const FLOW = new Set(['body', 'heading', 'figure-caption']);

// 맨 윗줄 묶음(회전 줄 제외, 같은 높이 ±2pt) — 정답 판정 전용. 4-7 규칙과 무관하다.
function topRow(L) {
  const ls = L.lines.filter((l) => l.role !== 'rotated' && String(l.text || '').trim());
  if (!ls.length) return { lines: [], key: '', gapBelow: Infinity };
  const maxB = Math.max(...ls.map((l) => l.baseline));
  const row = ls.filter((l) => maxB - l.baseline <= 2).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const below = ls.filter((l) => maxB - l.baseline > 2).map((l) => l.baseline);
  const gapBelow = below.length ? maxB - Math.max(...below) : Infinity;
  return { lines: row, key: norm(row.map((l) => l.text).join(' ')), gapBelow };
}

function upperRatio(text) {
  const letters = String(text).match(/[A-Za-z]/g);
  if (!letters) return 0;
  return letters.filter((c) => c >= 'A' && c <= 'Z').length / letters.length;
}

function blankAgg() {
  return {
    pages: 0, truthPages: 0, spokenPages: 0, headerPages: 0,
    truthLines: 0, cond: { zone: 0, len: 0, font: 0, evidence: 0, repeat: 0, upper: 0, prefix: 0 },
    fsRatio: [], gapRatio: [], nonTruthTopGap: [],
    falseHeader: 0, falseFooter: 0, falseEx: [], spokenEx: [],
    paras: 0, kinds: {}, twoCol: 0, roles: {}
  };
}

const results = {};
for (const b of builds) results[b.name] = blankAgg();
const transitions = {};      // base 역할 → cur 역할 (줄 id 기준)
const transEx = [];
let paraDiffPages = 0, kindDiffPages = 0, colDiffPages = 0, textDiffPages = 0;

for (let p = from; p <= to; p += stride) {
  const ts = {};
  for (let q = p - 2; q <= p + 2; q++) ts[q] = await textOf(q);
  const perBuild = {};
  for (const { name, B } of builds) {
    const raw = {};
    for (let q = p - 2; q <= p + 2; q++) raw[q] = layoutOf(B, q, ts[q], []);
    // 앱처럼: 이웃은 앞뒤 1쪽의 저장본
    const nbs = [p - 1, p + 1].map((q) => { const r = B.toStored(raw[q]); r.pageNo = q; return r; });
    const L = layoutOf(B, p, ts[p], nbs);
    perBuild[name] = L;

    const A = results[name];
    A.pages++;
    const H = L.height, Fm = L.stats.medianFontSize, Lm = L.stats.medianLeading;
    const tr = topRow(L);
    const others = [p - 2, p - 1, p + 1, p + 2].map((q) => topRow(raw[q]).key);
    const isTruth = !!tr.key && others.includes(tr.key);
    const truthIds = new Set(isTruth ? tr.lines.map((l) => l.id) : []);

    if (isTruth) {
      A.truthPages++;
      let spoken = false, hdr = false;
      for (const l of tr.lines) {
        A.truthLines++;
        const text = l.text || '';
        const zone = H > 0 && l.baseline > H * 0.92;
        const len = text.length <= 80;
        const font = l.fontSize <= 1.1 * Fm;
        const nk = new Set();
        for (const q of [p - 1, p + 1]) for (const nl of raw[q].lines) {
          const nh = raw[q].height;
          if (nl.baseline > nh * 0.92 || nl.baseline < nh * 0.08) nk.add(B.normalizeRepeatKey(nl.text));
        }
        const repeat = nk.has(B.normalizeRepeatKey(text));
        const upper = upperRatio(text) >= 0.6;
        const prefix = /^(SECTION|CHAPTER|PART)\b/i.test(text);
        A.cond.zone += zone; A.cond.len += len; A.cond.font += font;
        A.cond.repeat += repeat; A.cond.upper += upper; A.cond.prefix += prefix;
        A.cond.evidence += (repeat || upper || prefix);
        A.fsRatio.push(+(l.fontSize / Fm).toFixed(2));
        if (l.role === 'header') hdr = true;
        if (FLOW.has(l.role) && l.paraId) {
          spoken = true;
          if (A.spokenEx.length < 400) A.spokenEx.push('p' + p + ' ' + l.role + ' "' + frag(text) + '" fs/Fm=' + (l.fontSize / Fm).toFixed(2) + ' gap/Lm=' + (tr.gapBelow / Lm).toFixed(2) + ' zone=' + +zone + ' upper=' + +upper + ' repeat=' + +repeat);
        }
      }
      A.gapRatio.push(+(tr.gapBelow / Lm).toFixed(2));
      if (spoken) A.spokenPages++;
      if (hdr) A.headerPages++;
    } else if (tr.lines.length && Number.isFinite(tr.gapBelow)) {
      A.nonTruthTopGap.push(+(tr.gapBelow / Lm).toFixed(2));
    }

    // 진짜 머리말이 아닌데 header/footer 가 된 줄
    for (const l of L.lines) {
      A.roles[l.role] = (A.roles[l.role] || 0) + 1;
      if (truthIds.has(l.id)) continue;
      if (l.role === 'header') {
        A.falseHeader++;
        if (A.falseEx.length < 400) A.falseEx.push('p' + p + ' header "' + frag(l.text) + '" fs/Fm=' + (l.fontSize / Fm).toFixed(2));
      }
    }
    A.paras += L.paragraphs.length;
    for (const pa of L.paragraphs) A.kinds[pa.kind] = (A.kinds[pa.kind] || 0) + 1;
    if (L.columns.count >= 2) A.twoCol++;
  }

  if (perBuild.base) {
    const a = perBuild.base, c = perBuild.cur;
    const byId = new Map(c.lines.map((l) => [l.id, l]));
    for (const l of a.lines) {
      const m = byId.get(l.id);
      const k = l.role + ' → ' + (m ? m.role : '(없음)');
      if (!m || m.role !== l.role) {
        transitions[k] = (transitions[k] || 0) + 1;
        if (transEx.length < 400) transEx.push('p' + p + ' ' + k + ' "' + frag(l.text) + '"');
      }
    }
    if (a.paragraphs.length !== c.paragraphs.length) paraDiffPages++;
    const ka = a.paragraphs.map((x) => x.kind).join(','), kc = c.paragraphs.map((x) => x.kind).join(',');
    if (ka !== kc) kindDiffPages++;
    if (a.columns.count !== c.columns.count) colDiffPages++;
    const ta = a.paragraphs.map((x) => x.text).join('\n'), tc2 = c.paragraphs.map((x) => x.text).join('\n');
    if (ta !== tc2) textDiffPages++;
  }
}

function q(arr, f) { if (!arr.length) return '-'; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; }
const summary = {};
for (const { name, B } of builds) {
  const A = results[name];
  summary[name] = {
    algoVersion: B.algoVersion,
    pages: A.pages, truthPages: A.truthPages,
    spokenHeadPages: A.spokenPages, headerRolePages: A.headerPages,
    truthLines: A.truthLines, cond: A.cond,
    fsRatio: { min: q(A.fsRatio, 0), p50: q(A.fsRatio, 0.5), max: q(A.fsRatio, 0.999) },
    truthGapBelowLm: { min: q(A.gapRatio, 0), p05: q(A.gapRatio, 0.05), p50: q(A.gapRatio, 0.5) },
    nonTruthTopGapLm: { p50: q(A.nonTruthTopGap, 0.5), p95: q(A.nonTruthTopGap, 0.95), max: q(A.nonTruthTopGap, 0.999), n: A.nonTruthTopGap.length },
    falseHeader: A.falseHeader,
    paragraphs: A.paras, kinds: A.kinds, twoColPages: A.twoCol, roles: A.roles
  };
}
if (baseDir) summary.diff = { transitions, paraCountDiffPages: paraDiffPages, kindSeqDiffPages: kindDiffPages, columnDiffPages: colDiffPages, paraTextDiffPages: textDiffPages };

console.log(JSON.stringify(summary, null, 1));
if (show) {
  for (const { name } of builds) {
    const ex = results[name].falseEx;
    if (ex.length) { console.log('\n[' + name + '] 정답 밖 header 조각'); for (const e of ex.slice(0, show)) console.log('  ' + e); }
    const sp = results[name].spokenEx;
    if (sp.length) { console.log('\n[' + name + '] 낭독에 남은 머리말 조각'); for (const e of sp.slice(0, show)) console.log('  ' + e); }
  }
  if (transEx.length) { console.log('\n[전이] 조각'); for (const e of transEx.slice(0, show)) console.log('  ' + e); }
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 1));
