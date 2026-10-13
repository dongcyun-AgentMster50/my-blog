#!/usr/bin/env node
/* ============================================================
   8i Plan 시제품 — 행 단위 읽기(텍스트 기하만) + 괘선 정답 대조 (2026-10-13)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/proto-rowtable-8i.mjs <pdf> [시작쪽] [끝쪽] [--show] [--no-rules]

   **앱 코드가 아니다.** spec 4-13 초안(행 표)의 규칙을 여기서 흉내 내어 (1) 감지되는 쪽, (2) 행·칸 수,
   (3) 읽기 순서, (4) 쪽 번호 칸 판정을 보고, **pdf.js 연산자 목록의 가로 괘선을 정답**으로 행 나눔을 채점한다
   (괘선은 앱에 넣지 않을 후보 — 여기서는 채점용). 책 고유 x 좌표·글자 크기·낱말을 쓰지 않는다.

   단계 (spec 4-13 과 같은 이름):
     R1 띠      — 폭 > 0.55×W 인 조각이 띠 경계(장 제목 행 등). 머리말·꼬리말·회전 줄 제외.
     R2 열      — 띠 안 조각들이 비워 둔 세로 통로(가로지르는 줄 ≤ 8% 허용, 폭 ≥ 0.8×글자 크기)로 열을 나눈다.
                  통로 하나를 통째로 덮는 조각은 "가로지름"(구획 행).
     R3 판정    — 산문 열 P(평균 ≥ 25자, 줄 ≥ 5) + 그 왼쪽 이름표 열 A(평균 < 25자, 줄 < 0.6×P, 정수만 아님)
                  + 행 동기(A 칸의 80% 가 P 범위 안) + 그 밖에 글 열 없음 + 번호 이름표 가드.
     R4 칸      — 열마다 세로 묶음(이웃 줄 간격 > 1.4×행간; 행간 = min(중앙값, 1.3×글자 크기)).
     R5 행      — 구획(가로지름)은 단단한 경계, P 글이 없는 A 칸은 홀로 선 행, P 칸 하나에서 A 둘이 시작하면
                  A 첫 줄에서 P 칸을 자른다. 닻(A 칸 ↔ 겹치는 P 칸) 사이 칸은 정렬 모형으로:
                  위 정렬(이름표 하나짜리 닻의 70% 이상에서 A 첫 줄 = 첫 P 칸 첫 줄) → 앞 닻으로,
                  아니면 가운데 정렬 → DP(이름표 중심 ≈ 행 P 범위 중심).
     R6 쪽 번호 — 행 표 안에서 A·P 가 아닌 열의 조각이 전부 정수 꼴 → 읽지 않음(ref).
     R7 물려받기 — 행 표로 판정된 띠와 이웃한(가로지르는 줄로만 갈린) 띠는 그 열 경계로 다시 나눠 보아, 조각이 모두
                  A·R·P 영역 안(또는 가로지름)이고 A·P 조각이 있고 R 영역이 정수뿐이며 짧은 이름표 칸이 하나 이상이고
                  가로지름이 띠 줄의 30% 이하이면 같은 표의 행이다(같은 쪽 안, 연쇄). 한 행짜리 띠(30쪽 첫 행 등)를 살린다.
   원서 조각은 40자 이하.
   ============================================================ */

import { loadPdfjs, positional, pageLayout } from './measure-lib.mjs';
import { joinParagraphText } from '../js/text/hyphen.js';
import { isQuestionStart, isOptionStart } from '../js/text/segment.js';

const argv = process.argv;
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: proto-rowtable-8i.mjs <pdf> [시작] [끝] [--show] [--no-rules]'); process.exit(2); }
const SHOW = argv.includes('--show');
const RULES = !argv.includes('--no-rules');
const pdfjs = await loadPdfjs(argv);
const OPS = pdfjs.OPS;
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = Math.max(1, Number(fromArg) || 1), to = Math.min(Number(toArg) || doc.numPages, doc.numPages);

const INT_ONLY = /^\d{1,5}(?:\s*[,–\-]\s*\d{1,5})*$/;
const SPAN = 0.55, CH = 0.8, CROSS = 0.08, PROSE = 25, CELL_GAP = 1.4, INH_CROSS = 0.3;
const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const clip = (t, n = 40) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ── 채점용 괘선: 연산자 목록 → 가로 선분(사용자 공간) ─────────────── */
function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
async function hRules(page) {
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; const out = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const f = ol.fnArray[i], a = ol.argsArray[i];
    if (f === OPS.save) stack.push(ctm);
    else if (f === OPS.restore) ctm = stack.pop() || ctm;
    else if (f === OPS.transform) ctm = mul(ctm, a);
    else if (f === OPS.paintFormXObjectBegin) { stack.push(ctm); if (a && a[0]) ctm = mul(ctm, a[0]); }
    else if (f === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (f === OPS.constructPath) {
      const mm = a && a[2]; if (!mm || a[0] === OPS.endPath) continue;
      const p0 = apply(ctm, mm[0], mm[1]), p1 = apply(ctm, mm[2], mm[3]);
      const x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]), y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]);
      if (x1 - x0 > 15 && y1 - y0 < 1.5) out.push({ x0, x1, y: (y0 + y1) / 2 });
    }
  }
  return out;
}

/* ── R1–R6 ─────────────────────────────────────────────────── */
function pieces(L, H) {
  const out = [];
  for (const l of L.lines) {
    if (l.role === 'rotated' || l.role === 'header' || l.role === 'footer') continue;
    if (l.baseline > H * 0.94 || l.baseline < H * 0.06) continue;
    for (const r of l.runs || []) out.push({ x0: r.x0, x1: r.x1, y: l.baseline, fs: l.fontSize, text: r.text || '', lid: l.id, role: l.role });
  }
  return out.sort((a, b) => b.y - a.y || a.x0 - b.x0);
}
function bands(ps, W) {
  const out = []; let cur = [], spans = [];
  for (const p of ps) {
    if (p.x1 - p.x0 > SPAN * W) { if (cur.length) out.push({ ps: cur }); cur = []; spans.push(p); continue; }
    cur.push(p);
  }
  if (cur.length) out.push({ ps: cur });
  return out;
}
function tracks(ps, forced = null) {
  const fs = median(ps.map((p) => p.fs)) || 8;
  const minX = Math.min(...ps.map((p) => p.x0)), maxX = Math.max(...ps.map((p) => p.x1));
  const n = Math.ceil(maxX - minX) + 1, cover = new Uint16Array(n);
  for (const p of ps) for (let i = Math.max(0, Math.floor(p.x0 - minX)); i <= Math.min(n - 1, Math.ceil(p.x1 - minX)); i++) cover[i]++;
  const allow = Math.floor(CROSS * new Set(ps.map((p) => p.lid)).size);
  const cuts = forced ? forced.map((c) => c.slice()) : []; let s = -1;
  for (let i = 0; i <= (forced ? -1 : n); i++) {
    const e = i < n && cover[i] <= allow;
    if (e && s < 0) s = i;
    if (!e && s >= 0) { if (i - s >= CH * fs) cuts.push([minX + s, minX + i]); s = -1; }
  }
  const T = cuts.concat([[Infinity, Infinity]]).map((c, k) => ({ k, lo: k ? cuts[k - 1][1] : -Infinity, hi: c[0], ps: [], cross: [] }));
  for (const p of ps) {
    // 통로 하나를 통째로 덮는 조각 = 가로지르는 조각(장 제목 행 등) — 시작 열에 표시. 그 밖은 중심이 든 열.
    if (cuts.some((c) => p.x0 < c[0] && p.x1 > c[1])) { T.find((t) => p.x0 < t.hi).cross.push(p); continue; }
    const c = (p.x0 + p.x1) / 2;
    T.find((t) => c < t.hi).ps.push(p);
  }
  for (const t of T) {
    const ys = [...new Set(t.ps.map((p) => Math.round(p.y * 10) / 10))].sort((a, b) => b - a);
    t.lines = ys.length;
    t.chars = t.ps.length ? t.ps.reduce((a, p) => a + p.text.trim().length, 0) / t.ps.length : 0;
    t.intOnly = t.ps.length ? t.ps.filter((p) => INT_ONLY.test(p.text.trim())).length / t.ps.length : 0;
    t.fs = median(t.ps.map((p) => p.fs)) || fs;
    const d = []; for (let i = 1; i < ys.length; i++) d.push(ys[i - 1] - ys[i]);
    t.lead = Math.min(median(d) || 1.2 * t.fs, 1.3 * t.fs);
    t.cells = [];
    for (const y of ys) {
      const c = t.cells[t.cells.length - 1];
      const row = t.ps.filter((p) => Math.round(p.y * 10) / 10 === y).sort((a, b) => a.x0 - b.x0);
      if (c && c.bot - y <= CELL_GAP * t.lead) { c.bot = y; c.rows.push(row); } else t.cells.push({ top: y, bot: y, rows: [row] });
    }
    for (const c of t.cells) { c.yTop = c.top + 0.8 * t.fs; c.yBot = c.bot - 0.25 * t.fs; }
  }
  return T.filter((t) => t.ps.length || t.cross.length);
}
function detect(T) {
  const P = T.filter((t) => t.chars >= PROSE && t.intOnly < 0.5 && t.lines >= 5).pop();
  if (!P) return null;
  const A = T.filter((t) => t.k < P.k && t.intOnly < 0.8 && t.chars < PROSE && t.lines >= 1 && t.lines < 0.6 * P.lines);
  if (!A.length) return null;
  const a = A[0];
  const pTop = P.cells[0].yTop, pBot = P.cells[P.cells.length - 1].yBot;
  const sync = a.cells.filter((c) => c.yBot <= pTop + 2 && c.yTop >= pBot - 2).length / a.cells.length;
  if (sync < 0.8) return null;
  // R3'' 번호 이름표 가드(4-8 라벨 가드와 같은 원칙): 이름표 칸의 첫 조각이 번호·글머리 라벨뿐이면 행 표가 아니다(문항·정답 번호 걸이)
  const labelOnly = (t) => { t = String(t).trim(); return !!t && !/\s/.test(t) && (isQuestionStart(t + ' x') || isOptionStart(t + ' x')); };
  if (a.cells.filter((c) => labelOnly(c.rows[0][0].text)).length >= 0.5 * a.cells.length) { rejectLabel.push(currentPage); return null; }
  const R = T.filter((t) => t !== a && t !== P && t.intOnly >= 0.999);   // R6 — 칸 수는 묻지 않는다(행 표 구조 안에서만 판정하므로)
  const other = T.filter((t) => t !== a && t !== P && !R.includes(t) && t.ps.length > 1);
  // R3' 열 수 제한: 이름표 | (쪽 번호) | 산문 — 그 밖에 글이 있는 열이 있으면 일반 다열 표다(이번 범위 밖)
  if (other.length) { rejectMulti.push(currentPage); return null; }
  return { A: a, P, R, other, sync };
}
function rowsOf(det) {
  const { A, P } = det;
  // 가로지르는 조각(장 제목 행 등)은 단단한 경계 — 그 위아래를 따로 푼다
  const secs = A.cross.concat(P.cross).map((p) => p.y).sort((x, y) => y - x);
  const bounds = [Infinity, ...secs, -Infinity];
  const parts = [];
  for (let i = 1; i < bounds.length; i++) {
    const hi = bounds[i - 1], lo = bounds[i];
    const sec = i > 1 ? A.cross.concat(P.cross).filter((p) => p.y === hi) : [];
    const pc = P.cells.filter((c) => c.top < hi && c.top > lo), ac = A.cells.filter((c) => c.top < hi && c.top > lo);
    parts.push({ sec, r: solve(ac, pc) });
  }
  // 정렬 모형은 표(띠) 단위로 한 번 고른다 — 닻이 하나뿐인 조각에서는 모형 비용이 믿을 만하지 않다
  // 정렬 모형은 표(띠) 단위로 한 번: 이름표 하나짜리 닻의 70% 이상이 첫 P 칸과 첫 줄 높이가 같으면 위 정렬
  const al = parts.reduce((a, x) => a + x.r.aligned, 0), an = parts.reduce((a, x) => a + x.r.anchors, 0);
  const useTop = an > 0 && al >= 0.7 * an;
  const rows = [];
  for (const x of parts) {
    if (x.sec.length) rows.push({ section: true, a: [], p: [], text: x.sec.map((p) => p.text).join(' ') });
    rows.push(...(useTop ? x.r.top.rows : x.r.mid.rows));
  }
  const models = [useTop ? 'T' : 'M'];
  return { rows: rows.filter((r) => r.section || r.a.length || r.p.length), align: models.join('') };
}

// 칸 겹침(세로)
const ov = (c, d) => Math.min(c.yTop, d.yTop) - Math.max(c.yBot, d.yBot);
const ctr = (top, bot) => (top + bot) / 2;
function solve(ac, pc) {
  const empty = (r) => ({ mid: { rows: r }, top: { rows: r }, aligned: 0, anchors: 0 });
  if (!pc.length) return empty(ac.map((c) => ({ a: [c], p: [] })));
  if (!ac.length) return empty([{ a: [], p: pc }]);
  // 0. 옆에 P 글이 전혀 없는 이름표 칸 = 홀로 선 행(구획 제목·각주) — 닻이 아니다
  const alone = ac.filter((c) => !pc.some((d) => ov(c, d) > 0));
  if (alone.length && alone.length < ac.length) {
    const sub = solve(ac.filter((c) => !alone.includes(c)), pc);
    const ins = (rows) => { const out = rows.slice(); for (const c of alone) { let k = out.findIndex((r) => r.p.length ? r.p[0].top < c.top : r.a.length && r.a[0].top < c.top); if (k < 0) k = out.length; out.splice(k, 0, { a: [c], p: [], alone: true }); } return out; };
    return { ...sub, mid: { rows: ins(sub.mid.rows) }, top: { rows: ins(sub.top.rows) } };
  }
  // 1. P 칸 하나 안에서 이름표 둘 이상이 **시작**하면, 틈 없이 붙은 행들이다 → 이름표 첫 줄 높이에서 P 칸을 자른다
  const fsOf = (c) => c.rows[0][0].fs || 8;
  const cells = [];
  for (const d of pc) {
    const starts = ac.filter((c) => c.top <= d.top + 0.3 * fsOf(c) && c.top >= d.bot - 0.3 * fsOf(c)).sort((x, y) => y.top - x.top);
    if (starts.length < 2) { cells.push(d); continue; }
    let cur = [];
    const flush = () => { if (cur.length) cells.push({ rows: cur, top: cur[0][0].y, bot: cur[cur.length - 1][0].y, yTop: cur[0][0].y + 0.8 * cur[0][0].fs, yBot: cur[cur.length - 1][0].y - 0.25 * cur[0][0].fs }); cur = []; };
    for (const row of d.rows) {
      if (cur.length && starts.some((c) => c !== starts[0] && Math.abs(row[0].y - c.top) <= 0.3 * fsOf(c) || (c !== starts[0] && row[0].y < c.top && cur[cur.length - 1][0].y > c.top))) flush();
      cur.push(row);
    }
    flush();
  }
  // 2. 닻: 이름표 칸마다 겹치는 P 칸 범위(없으면 가장 가까운 P 칸). 겹치는 닻은 합친다
  let blocks = ac.map((c) => {
    const hit = cells.map((d, k) => [k, ov(c, d)]).filter((x) => x[1] > 0).map((x) => x[0]);
    let f, l;
    if (hit.length) { f = Math.min(...hit); l = Math.max(...hit); }
    else { let best = 0, bd = Infinity; cells.forEach((d, k) => { const dist = Math.min(Math.abs(d.yBot - c.yTop), Math.abs(c.yBot - d.yTop)); if (dist < bd) { bd = dist; best = k; } }); f = l = best; }
    return { a: [c], f, l };
  }).sort((x, y) => x.f - y.f || y.a[0].top - x.a[0].top);
  const merged = [];
  for (const b of blocks) { const m = merged[merged.length - 1]; if (m && b.f <= m.l) { m.a.push(...b.a); m.l = Math.max(m.l, b.l); } else merged.push({ ...b, a: b.a.slice() }); }
  blocks = merged;
  // 정렬 증거: 이름표 하나짜리 닻에서 이름표 첫 줄 = 첫 P 칸 첫 줄(±0.3×글자 크기)
  let aligned = 0, anchors = 0;
  for (const b of blocks) if (b.a.length === 1) { anchors++; if (Math.abs(b.a[0].top - cells[b.f].top) <= 0.3 * fsOf(b.a[0])) aligned++; }
  const aTop = (b) => b.a[0].yTop, aBot = (b) => b.a[b.a.length - 1].yBot;
  const n = blocks.length;
  // 3a. 가운데 정렬 — DP: 닻 사이 칸 묶음을 어디서 나눌지(이름표 중심 ≈ 행 P 범위 중심)
  const segLen = []; for (let i = 0; i < n - 1; i++) segLen.push(blocks[i + 1].f - blocks[i].l - 1);
  const costMid = (i, sPrev, sNext) => {
    const top = i === 0 ? cells[0].yTop : cells[blocks[i].f - (segLen[i - 1] - sPrev)].yTop;
    const bot = i === n - 1 ? cells[cells.length - 1].yBot : cells[blocks[i].l + sNext].yBot;
    return Math.abs(ctr(aTop(blocks[i]), aBot(blocks[i])) - ctr(top, bot));
  };
  let dp = new Map([[0, { c: 0, path: [] }]]);
  for (let i = 0; i < n; i++) {
    const nd = new Map(); const kNext = i < n - 1 ? segLen[i] : 0;
    for (let sn = 0; sn <= kNext; sn++) {
      let best = null;
      for (const [sp, v] of dp) { const c = v.c + costMid(i, sp, i < n - 1 ? sn : 0); if (!best || c < best.c) best = { c, path: v.path.concat([sn]) }; }
      nd.set(sn, best);
    }
    dp = nd;
  }
  const mid = [...dp.values()].sort((x, y) => x.c - y.c)[0];
  const midRows = []; let start = 0;
  blocks.forEach((b, i) => { const end = i < n - 1 ? b.l + mid.path[i] + 1 : cells.length; midRows.push({ a: b.a, p: cells.slice(start, end) }); start = end; });
  // 3b. 위 정렬 — 닻 사이 칸은 앞 닻으로, 맨 앞 칸들은 이름표 없는 행(앞 쪽에서 이어진 행)
  const topRows = [];
  if (blocks[0].f > 0) topRows.push({ a: [], p: cells.slice(0, blocks[0].f) });
  blocks.forEach((b, i) => topRows.push({ a: b.a, p: cells.slice(b.f, i < n - 1 ? blocks[i + 1].f : cells.length) }));
  return { mid: { rows: midRows }, top: { rows: topRows }, aligned, anchors };
}
const cellText = (c) => joinParagraphText(c.rows.map((r) => r.map((p) => p.text).join(' '))).text;

const bad = []; const rejectMulti = []; const rejectLabel = []; const rejectInherit = []; let currentPage = 0;
let inheritedBands = 0, inheritedRows = 0; const inheritedPages = new Set();
let found = 0, rowsN = 0, scored = 0, agree = 0, pLines = 0, refCells = 0, refNonInt = 0;
const pagesFound = [];
for (let p = from; p <= to; p++) {
  let L, size;
  try { ({ L, size } = await pageLayout(doc, p)); } catch (e) { continue; }
  const W = size.width, H = size.height;
  let rules = null; currentPage = p;
  // 1차: 띠마다 판정
  const BS = bands(pieces(L, H), W).map((b) => {
    if (b.ps.length < 6) return { b, det: null };
    const T = tracks(b.ps);
    return { b, T, det: T.length >= 2 ? detect(T) : null };
  });
  // 2차 R7 물려받기: 행 표로 판정된 띠와 **이웃한**(사이에 가로지르는 줄만 있는) 띠가 그 열 경계에 들어맞으면 같은 표의 행이다.
  //   들어맞음 = 경계를 그대로 써서 나눴을 때 (a) 모든 조각이 A·R·P 영역 안이거나 통로를 통째로 덮는 가로지름이고
  //   (b) A 조각 ≥ 1 과 P 조각 ≥ 1 이 있고 (c) R 영역 조각은 전부 정수 꼴이다. 같은 쪽 안에서만, 연쇄로(새로 물려받은 띠도 다음 이웃에 물려준다).
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < BS.length; i++) {
      if (BS[i].det) continue;
      for (const j of [i - 1, i + 1]) {
        const par = BS[j]; if (!par || !par.det) continue;
        const T0 = par.T, d0 = par.det;
        const cuts = []; for (let k = 0; k < T0.length - 1; k++) cuts.push([T0[k].hi, T0[k + 1].lo]);
        const T = tracks(BS[i].b.ps, cuts);
        const A = T[d0.A.k], P = T[d0.P.k], R = d0.R.map((r) => T[r.k]);
        const others = T.filter((t) => t !== A && t !== P && !R.includes(t) && t.ps.length);
        if (!A || !P || !A.ps.length || !P.ps.length || others.length) continue;
        if (R.some((r) => r.ps.some((q) => !INT_ONLY.test(q.text.trim())))) continue;
        // (d) 짧은 이름표 칸이 하나 이상, (e) 가로지름은 띠 줄 수의 30% 이하 — 표 아래 2단 산문이 통로를 덮는 줄로 들어오는 것을 막는다
        // 옆에 P 가 있는 이름표 칸 중 **짧은 칸**(줄 평균 < 25자)이 하나 이상 — 진짜 이름표가 있다는 증거.
        // (평균으로 보면 표 끝 각주 "∗See chapter…" 한 줄이 31쪽 Obesity 행을 떨어뜨린다)
        const shortLabel = A.cells.some((c) => P.cells.some((d) => ov(c, d) > 0) &&
          c.rows.reduce((x, r) => x + r.map((q) => q.text).join(' ').trim().length, 0) / c.rows.length < PROSE);
        if (!shortLabel) continue;
        const nCross = T.reduce((a, t) => a + t.cross.length, 0), nLines = new Set(BS[i].b.ps.map((q) => q.lid)).size;
        if (nCross > INH_CROSS * nLines) { rejectInherit.push(currentPage); continue; }
        BS[i] = { b: BS[i].b, T, det: { A, P, R, other: [], sync: 1 }, inherited: true };
        inheritedBands++; inheritedRows += A.cells.filter((c) => P.cells.some((d) => ov(c, d) > 0)).length; inheritedPages.add(currentPage); changed = true; break;
      }
    }
  }
  for (const { b, T, det, inherited } of BS) {
    if (!det) continue;
    const { rows, align } = rowsOf(det);
    found++; rowsN += rows.length; pagesFound.push(p);
    for (const R of det.R) { refCells += R.cells.length; }
    // 채점: A 열을 가로지르는 가로 괘선 = 행 경계(정답). P 줄마다 텍스트 행 번호 ↔ 괘선 행 번호의 쌍이 일대일인가
    if (RULES) {
      if (!rules) { const page = await doc.getPage(p); rules = await hRules(page); page.cleanup(); }
      const ax = (det.A.ps[0].x0 + det.A.ps[0].x1) / 2;
      const ys = rules.filter((r) => r.x0 <= ax && r.x1 >= ax).map((r) => r.y).sort((a, b) => b - a);
      if (ys.length >= 4) {            // 괘선 행 ≥ 3 인 표만 채점(위아래 괘선뿐인 표는 정답이 없다)
        const ruleRow = (y) => ys.filter((v) => v > y).length;
        const lab = [];
        rows.forEach((r, ri) => r.p.forEach((c) => c.rows.forEach((row) => lab.push([ri, ruleRow(row[0].y)]))));
        const maj = (key, val) => { const m = new Map(); for (const x of lab) { const k = x[key]; if (!m.has(k)) m.set(k, new Map()); const mm = m.get(k); mm.set(x[val], (mm.get(x[val]) || 0) + 1); } const out = new Map(); for (const [k, mm] of m) out.set(k, [...mm].sort((u, v) => v[1] - u[1])[0][0]); return out; };
        const t2r = maj(0, 1), r2t = maj(1, 0);
        const n = lab.length, ok = lab.filter((x) => t2r.get(x[0]) === x[1] && r2t.get(x[1]) === x[0]).length;
        if (ok < n) bad.push(p);
        scored++; agree += ok; pLines += n;
        if (SHOW) console.log(`  ${p}쪽 괘선 대조: P 줄 ${n} 중 일대일 ${ok} · 텍스트 행 ${rows.length} · 괘선 행 ${ys.length - 1}`);
      }
    }
    if (SHOW) {
      console.log(`── ${p}쪽 행표${inherited ? '(물려받음)' : ''}: 열 ${T.length} (A x${Math.round(det.A.ps[0].x0)} · R ${det.R.length} · P x${Math.round(det.P.ps[0].x0)}) 정렬=${align} 행 ${rows.length} sync ${det.sync.toFixed(2)}`);
      for (const r of rows.slice(0, 12)) {
        const at = r.section ? '§ ' + r.text : r.a.map(cellText).join(' / ');
        console.log(`   A「${clip(at, 40)}」 → P ${r.p.length}칸「${clip(r.p.length ? cellText(r.p[0]) : '', 30)}」`);
      }
    }
  }
}
console.log(`\n== ${file.split(/[\\/]/).pop()} ${from}–${to}: 행표 띠 ${found} (쪽 ${new Set(pagesFound).size}) · 행 ${rowsN} · 쪽 번호 칸 ${refCells}`);
console.log(`   쪽: ${[...new Set(pagesFound)].join(',')}`);
console.log(`   R7 가로지름이 많아 물려받지 못한 띠의 쪽: ${[...new Set(rejectInherit)].join(',')}`);
console.log(`   R7 물려받은 띠 ${inheritedBands} · 그 띠에서 옆에 내용이 있는 이름표 칸(행) ${inheritedRows} · 쪽 ${[...inheritedPages].join(",")}`);
console.log(`   번호 이름표로 빠진 띠의 쪽: ${[...new Set(rejectLabel)].join(',')}`);
console.log(`   다열(이름표·쪽 번호·산문 밖의 열이 있음)로 빠진 띠의 쪽 ${[...new Set(rejectMulti)].length}: ${[...new Set(rejectMulti)].slice(0, 60).join(',')}`);
if (RULES) console.log(`   괘선 대조: 채점 띠 ${scored} · P 줄 ${pLines} 중 행 일치 ${agree} (${pLines ? (100 * agree / pLines).toFixed(1) : '-'}%) · 어긋난 띠의 쪽 ${[...new Set(bad)].join(',')}`);
