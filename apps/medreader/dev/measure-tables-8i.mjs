#!/usr/bin/env node
/* ============================================================
   8i Plan 측정 — "여러 열이 같은 높이에 나란히 있는데 표로 안 잡히는 쪽" (2026-10-13)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-tables-8i.mjs <pdf> [시작쪽] [끝쪽]
         [--step N]      N 쪽마다(기본 1 = 전수)
         [--json <파일>] 쪽별 분류를 JSON 으로 저장
         [--show]        분류별 표본 쪽과 짧은 조각(40자 이하)

   앱과 같은 레이아웃(buildPageLayout)을 받아, **그 결과와 독립적으로** 쪽을 세로 띠(band)로 자르고
   띠마다 "빈 세로 통로(channel)"로 열(track)을 센다. 책 고유 x 좌표·글자 크기·낱말을 쓰지 않는다.

     띠      — 폭 > 0.55W 인 run(장 제목·표 머리 같은 가로지르는 줄)이 경계. 상·하단 여백 줄(머리말·꼬리말)은 뺀다.
     통로    — 띠 안 run 이 (거의) 비워 둔 x 구간 — 가로지르는 줄 ≤ 띠 줄 수의 8%, 폭 ≥ 0.8×띠 글자 크기 중앙값.
     열      — 통로 사이. 열마다: 줄 수, run 평균 글자 수, 정수만인 run 비율, 숫자 run 비율, 글자 크기 중앙값.

   띠 분류 (열 ≥ 2, run ≥ 6 인 띠만):
     prose2     열 2개, 둘 다 산문(run 평균 ≥ 25자)이고 줄 수가 비슷(적은 쪽 ≥ 0.5×많은 쪽) — 일반 2단 본문
     rowtable   산문 열 1개 이상 + 그 왼쪽에 "드문 이름표 열"(평균 < 25자, 줄 수 < 0.6×산문 열, 정수만 아님) — 30쪽 꼴(넓은 후보)
                +ref  정수만인 열이 하나 이상 더 있다(쪽 번호 칸 후보)
     grid       열 ≥ 3 이고 숫자 열 ≥ 2, 또는 모든 열이 짧다(run 평균 < 15자) — 숫자 격자·데이터 표
     numcol     열 2개, 한쪽이 정수만 — 목차·색인(이름 | 쪽 번호)
     other      그 밖
   띠마다 "이미 표로 잡힌 줄"(role 'table') 비율도 센다 — 잡힌 표(≥ 50%)는 caught 로 따로 센다.

   증상(현재 앱 출력에서 직접): 정수만인 run 이 글자 run 과 한 줄에 붙은 줄(예: 주제 + 쪽 번호),
   정수만인 줄이 낭독 문단에 든 수(heading/body, 상·하단 여백 밖).

   js/ 는 읽기만 한다. 원서 조각은 40자 이하.
   ============================================================ */

import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { loadPdfjs, positional, pageLayout } from './measure-lib.mjs';

const argv = process.argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: measure-tables-8i.mjs <pdf> [시작] [끝] [--step N] [--json f] [--show]'); process.exit(2); }
const STEP = Math.max(1, Number(opt('--step', 1)) || 1);
const SHOW = argv.includes('--show');
const JSON_OUT = opt('--json', null);

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const N = doc.numPages;
const from = Math.max(1, Number(fromArg) || 1), to = Math.min(Number(toArg) || N, N);

const INT_ONLY = /^\d{1,5}(?:\s*[,–\-]\s*\d{1,5})*$/;          // 1130 · 1130, 1138 · 1130–1132
const NUMERIC = /^[<>≤≥±~]?\s*[-−]?\d[\d.,:/–\-]*\s*(?:%|mg|mcg|µg|g|kg|mL|L|mmol\/L|mg\/dL|IU|U|h|d|y)?$/i;
const SPAN_RATIO = 0.55, CH_FACTOR = 0.8, PROSE = 25, SHORT = 15, CROSS_ALLOW = 0.08;
const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const clip = (t) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > 40 ? s.slice(0, 39) + '…' : s; };

function bandsOf(L, W, H) {
  const lines = L.lines.filter((l) => l.role !== 'rotated' && l.role !== 'header' && l.role !== 'footer' &&
    l.baseline < H * 0.94 && l.baseline > H * 0.06);
  lines.sort((a, b) => b.baseline - a.baseline);
  const bands = [];
  let cur = [];
  for (const l of lines) {
    const runs = l.runs || [];
    if (runs.some((r) => r.x1 - r.x0 > SPAN_RATIO * W)) { if (cur.length) bands.push(cur); cur = []; continue; }
    for (const r of runs) cur.push({ x0: r.x0, x1: r.x1, text: r.text || '', y: l.baseline, fs: l.fontSize, role: l.role, lid: l.id });
  }
  if (cur.length) bands.push(cur);
  return bands;
}

function tracksOf(runs) {
  const fs = median(runs.map((r) => r.fs)) || 8;
  const minX = Math.min(...runs.map((r) => r.x0)), maxX = Math.max(...runs.map((r) => r.x1));
  const n = Math.ceil(maxX - minX) + 1;
  const cover = new Uint16Array(n);
  for (const r of runs) {
    const a = Math.max(0, Math.floor(r.x0 - minX)), b = Math.min(n - 1, Math.ceil(r.x1 - minX));
    for (let i = a; i <= b; i++) cover[i]++;
  }
  // 통로: run 이 거의 없는 x 구간 — 가로지르는 짧은 제목 몇 줄(장 제목 띠 등)은 허용한다(띠 줄 수의 8%까지).
  const nLines = new Set(runs.map((r) => r.lid)).size;
  const allow = Math.floor(CROSS_ALLOW * nLines);
  const channels = [];
  let s = -1;
  for (let i = 0; i <= n; i++) {
    const empty = i < n && cover[i] <= allow;
    if (empty && s < 0) s = i;
    if (!empty && s >= 0) { if (i - s >= CH_FACTOR * fs) channels.push([minX + s, minX + i]); s = -1; }
  }
  const cuts = channels.map((c) => (c[0] + c[1]) / 2);
  const tracks = cuts.concat([Infinity]).map(() => ({ runs: [] }));
  for (const r of runs) {
    const c = (r.x0 + r.x1) / 2;
    let k = 0; while (k < cuts.length && c > cuts[k]) k++;
    tracks[k].runs.push(r);
  }
  for (const t of tracks) {
    const ys = new Set(t.runs.map((r) => Math.round(r.y)));
    t.lines = ys.size;
    t.chars = t.runs.length ? t.runs.reduce((a, r) => a + r.text.trim().length, 0) / t.runs.length : 0;
    t.intOnly = t.runs.length ? t.runs.filter((r) => INT_ONLY.test(r.text.trim())).length / t.runs.length : 0;
    t.numeric = t.runs.length ? t.runs.filter((r) => NUMERIC.test(r.text.trim())).length / t.runs.length : 0;
    t.fs = median(t.runs.map((r) => r.fs));
    t.x0 = Math.min(...t.runs.map((r) => r.x0)); t.x1 = Math.max(...t.runs.map((r) => r.x1));
    // 칸(세로 묶음): 이 열 안에서 이웃 줄 간격이 열 행간 중앙값의 1.6배를 넘으면 끊는다
    const yl = [...ys].sort((a, b) => b - a);
    const d = []; for (let i = 1; i < yl.length; i++) d.push(yl[i - 1] - yl[i]);
    const lead = median(d) || t.fs * 1.2;
    t.cells = []; let top = yl[0], prev = yl[0];
    for (let i = 1; i <= yl.length; i++) {
      if (i === yl.length || prev - yl[i] > 1.6 * lead) { t.cells.push([top, prev]); if (i < yl.length) top = yl[i]; }
      if (i < yl.length) prev = yl[i];
    }
  }
  return { tracks: tracks.filter((t) => t.runs.length), fs };
}

function classify(tracks) {
  const n = tracks.length;
  if (n < 2) return 'one';
  const prose = tracks.filter((t) => t.chars >= PROSE && t.intOnly < 0.5);
  const ints = tracks.filter((t) => t.intOnly >= 0.8);
  const nums = tracks.filter((t) => t.numeric >= 0.5);
  const maxLines = Math.max(...tracks.map((t) => t.lines));
  if (n === 2 && prose.length === 2 && Math.min(tracks[0].lines, tracks[1].lines) >= 0.5 * maxLines) return 'prose2';
  if (prose.length >= 1) {
    const pi = tracks.indexOf(prose[prose.length - 1]);
    const labels = tracks.slice(0, pi).filter((t) => t.intOnly < 0.8 && t.chars < PROSE && t.lines < 0.6 * prose[prose.length - 1].lines && t.lines >= 1);
    if (labels.length) return ints.length ? 'rowtable+ref' : 'rowtable';
  }
  if (n === 2 && ints.length === 1) return 'numcol';
  if ((n >= 3 && nums.length >= 2) || tracks.every((t) => t.chars < SHORT)) return 'grid';
  return 'other';
}

const CATS = ['prose2', 'rowtable', 'rowtable+ref', 'grid', 'numcol', 'other'];
const pageCat = {};            // 쪽 → 그 쪽 띠들의 분류(가장 "표다운" 것 우선)
const count = Object.fromEntries(CATS.map((c) => [c, { pages: 0, caughtPages: 0, bands: 0, lines: 0 }]));
const RANK = { 'rowtable+ref': 6, rowtable: 5, grid: 4, numcol: 3, other: 2, prose2: 1, one: 0 };
const samples = Object.fromEntries(CATS.map((c) => [c, []]));
const sym = { mergedNum: 0, mergedNumPages: new Set(), numPara: 0, numParaPages: new Set(), samples: [] };
let pagesSeen = 0, linesTable = 0, regions = 0, colCount2 = 0;
const perPage = [];
const allBands = [];
const t0 = performance.now();

for (let p = from; p <= to; p += STEP) {
  let L, size;
  try { ({ L, size } = await pageLayout(doc, p)); } catch (e) { continue; }
  pagesSeen++;
  const W = size.width, H = size.height;
  regions += L.regions.length;
  if (L.columns.count === 2) colCount2++;
  linesTable += L.lines.filter((l) => l.role === 'table').length;

  // 증상 — 현재 출력에서
  for (const l of L.lines) {
    if (l.role === 'header' || l.role === 'footer' || l.role === 'rotated' || l.role === 'table') continue;
    const runs = l.runs || [];
    const ints = runs.filter((r) => INT_ONLY.test((r.text || '').trim()));
    const words = runs.filter((r) => /\p{L}{2}/u.test(r.text || ''));
    if (ints.length && words.length) {
      sym.mergedNum++; sym.mergedNumPages.add(p);
      if (sym.samples.length < 12) sym.samples.push(`${p}: ${clip(runs.map((r) => r.text).join(' | '))}`);
    }
    if ((l.role === 'body' || l.role === 'heading') && l.paraId && INT_ONLY.test((l.text || '').trim()) &&
        l.baseline < H * 0.9 && l.baseline > H * 0.1) { sym.numPara++; sym.numParaPages.add(p); }
  }

  // 띠·열
  let best = 'one', bestInfo = null;
  for (const band of bandsOf(L, W, H)) {
    if (band.length < 6) continue;
    const { tracks } = tracksOf(band);
    const cat = classify(tracks);
    if (cat === 'one') continue;
    const tableLines = new Set(band.filter((r) => r.role === 'table').map((r) => r.lid)).size;
    const allLines = new Set(band.map((r) => r.lid)).size;
    const caught = tableLines >= 0.5 * allLines;
    allBands.push({ p, cols: L.columns.count, cat, tableLines, allLines, tracks: tracks.map((t) => ({ x0: Math.round(t.x0), x1: Math.round(t.x1), lines: t.lines, chars: Math.round(t.chars), int: +t.intOnly.toFixed(2), num: +t.numeric.toFixed(2), fs: t.fs, cells: t.cells })) });
    count[cat].bands++; count[cat].lines += allLines;
    const info = { cat, caught, tracks: tracks.map((t) => ({ x: [Math.round(t.x0), Math.round(t.x1)], lines: t.lines, chars: Math.round(t.chars), int: +t.intOnly.toFixed(2), num: +t.numeric.toFixed(2), fs: t.fs })) };
    if (RANK[cat] > RANK[best]) { best = cat; bestInfo = info; }
  }
  if (best !== 'one') {
    count[best].pages++;
    if (bestInfo.caught) count[best].caughtPages++;
    pageCat[p] = best;
    perPage.push({ p, cols: L.columns.count, ...bestInfo });
    if (samples[best].length < 400) samples[best].push(p);
  }
  if (p % 250 === 0) process.stderr.write(`  …${p}/${to} ${Math.round((performance.now() - t0) / 1000)}s\n`);
}

function ranges(list) {
  const out = []; let a = null, b = null;
  for (const p of list) { if (a == null) { a = b = p; continue; } if (p <= b + STEP) { b = p; continue; } out.push(a === b ? `${a}` : `${a}–${b}`); a = b = p; }
  if (a != null) out.push(a === b ? `${a}` : `${a}–${b}`);
  return out;
}

const sec = Math.round((performance.now() - t0) / 1000);
console.log(`\n== ${file.split(/[\\/]/).pop()} · ${from}–${to}쪽 step ${STEP} · 본 쪽 ${pagesSeen} · ${sec}s`);
console.log(`현재 앱: 표 region ${regions} · role table 줄 ${linesTable} · 2단 판정 쪽 ${colCount2}`);
console.log(`분류(쪽 단위 — 그 쪽에서 가장 표다운 띠) — pages / 그중 이미 표로 잡힘(caught) / 띠 수 / 줄 수`);
for (const c of CATS) console.log(`  ${c.padEnd(13)} ${String(count[c].pages).padStart(5)}  caught ${String(count[c].caughtPages).padStart(4)}  bands ${String(count[c].bands).padStart(5)}  lines ${count[c].lines}`);
console.log(`증상: 정수만인 run + 글자 run 이 한 줄 ${sym.mergedNum}줄 / ${sym.mergedNumPages.size}쪽 · 정수만인 줄이 낭독 문단에 ${sym.numPara}줄 / ${sym.numParaPages.size}쪽`);
for (const c of ['rowtable', 'rowtable+ref', 'numcol']) console.log(`  ${c} 쪽: ${ranges(samples[c]).slice(0, 40).join(', ')}${samples[c].length > 0 && ranges(samples[c]).length > 40 ? ' …' : ''}`);
console.log(`  grid(미검출만) 쪽 수: ${perPage.filter((x) => x.cat === 'grid' && !x.caught).length}`);
if (SHOW) {
  console.log('증상 표본:'); for (const s of sym.samples) console.log('   ' + s);
  for (const c of CATS) {
    const ex = perPage.filter((x) => x.cat === c).slice(0, 4);
    for (const e of ex) console.log(`  [${c}] ${e.p}쪽 cols=${e.cols} caught=${e.caught} ` + e.tracks.map((t) => `{x${t.x[0]}-${t.x[1]} L${t.lines} c${t.chars} i${t.int} n${t.num} f${t.fs}}`).join(' '));
  }
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ file: file.split(/[\\/]/).pop(), from, to, step: STEP, count, perPage, allBands, symptom: { mergedNum: sym.mergedNum, mergedNumPages: [...sym.mergedNumPages], numPara: sym.numPara, numParaPages: [...sym.numParaPages] } }));
