#!/usr/bin/env node
/* ============================================================
   8i Build 측정 — 행 표(spec 4-13)를 **앱 모듈로** 잰다 (2026-10-13)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-rowtable-8i.mjs <pdf> [시작쪽] [끝쪽]
         [--rules]            괘선(연산자 목록) 정답으로 행 나눔 채점 — 시제품(proto-rowtable-8i)과 같은 채점
         [--old <layout.js>]  8i 전 코드의 layout.js — 행 표가 **안 잡힌** 쪽의 PageLayout 이 algoVersion 을 빼고
                              바이트 단위로 같은지 본다. 옛 코드 사본 만들기(작업 트리를 건드리지 않는다):
                                git archive <8i 전 커밋> apps/medreader/js | tar -x -C <임시 폴더>
                              → --old <임시 폴더>/apps/medreader/js/text/layout.js
         [--show]             쪽마다 행 목록(이름표 40자 · 내용 첫 30자)
         [--units]            행 표 쪽의 낭독 단위 점검(정수만인 단위·쪽 번호 섞인 이름표·열 머리 낭독)

   시제품은 규칙을 **흉내** 냈다. 이 도구는 앱의 `buildPageLayout`(7b 포함)을 그대로 부르고
   `pageInfo.rowTableProbe` 진단 훅으로 띠 수·물려받음·쪽 번호 칸 수를 받는다(출력에는 들어가지 않는 훅).
   측정은 이웃 쪽을 넘기지 않는다(measure-lib 과 같음 — 옛·새 비교도 같은 조건).
   원서 조각은 40자 이하.
   ============================================================ */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { loadPdfjs, positional, sentenceUnits } from './measure-lib.mjs';
import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { ROWTABLE } from '../js/config.js';

const argv = process.argv;
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: measure-rowtable-8i.mjs <pdf> [시작] [끝] [--rules] [--old <layout.js>] [--show] [--units]'); process.exit(2); }
const RULES = argv.includes('--rules');
const SHOW = argv.includes('--show');
const UNITS = argv.includes('--units');
const oi = argv.indexOf('--old');
const OLD = oi >= 0 ? argv[oi + 1] : null;
const oldMod = OLD ? await import(pathToFileURL(path.resolve(OLD)).href) : null;

const pdfjs = await loadPdfjs(argv);
const OPS = pdfjs.OPS;
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = Math.max(1, Number(fromArg) || 1), to = Math.min(Number(toArg) || doc.numPages, doc.numPages);
const clip = (t, n = 40) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ── 채점용 괘선 (시제품과 같은 코드) ─────────────────────── */
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
const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));

let bands = 0, inherited = 0, rowsAll = 0, refCells = 0, refLines = 0, rowheads = 0, colheads = 0, sections = 0, strays = 0;
let scored = 0, agree = 0, pLines = 0;
let same = 0, diff = 0; const diffPages = []; let itemLost = 0, itemExtra = 0;
let unitsAll = 0, unitIntOnly = 0, rowheadWithRef = 0, colheadSpoken = 0;
const pagesFound = [], badPages = [], rejectWhy = new Map();
let msText = 0, msLayout = 0, msOld = 0, nPages = 0;

for (let p = from; p <= to; p++) {
  let page;
  try { page = await doc.getPage(p); } catch (e) { continue; }
  const vp = page.getViewport({ scale: 1 });
  let t0 = performance.now();
  const tc = await page.getTextContent();
  msText += performance.now() - t0;
  const size = unrotatedPageSize(page.view, vp.width, vp.height);
  let probe = null;
  t0 = performance.now();
  const L = buildPageLayout(tc.items, { pageNo: p, styles: tc.styles, width: size.width, height: size.height, rowTableProbe: (r) => { probe = r; } });
  msLayout += performance.now() - t0;
  nPages++;
  for (const w of (probe && probe.reject) || []) rejectWhy.set(w, (rejectWhy.get(w) || 0) + 1);
  const found = !!(probe && probe.tables.length);
  if (oldMod && !found) {
    t0 = performance.now();
    const O = oldMod.buildPageLayout(tc.items, { pageNo: p, styles: tc.styles, width: size.width, height: size.height });
    msOld += performance.now() - t0;
    if (noAlgo(O) === noAlgo(L)) same++; else { diff++; diffPages.push(p); }
  }
  if (!found) { page.cleanup(); continue; }

  // 행 표 쪽: 글자를 잃거나 겹쳐 쓰지 않았나 — 옛 레이아웃과 아이템(idx:str) 다중 집합 비교
  if (oldMod) {
    const O = oldMod.buildPageLayout(tc.items, { pageNo: p, styles: tc.styles, width: size.width, height: size.height });
    const bag = (X) => { const m = new Map(); for (const l of X.lines) for (const it of l.items) { const k = it.idx + ':' + it.str; m.set(k, (m.get(k) || 0) + 1); } return m; };
    const bn = bag(L), bo = bag(O);
    for (const [k, v] of bo) if ((bn.get(k) || 0) < v) itemLost += v - (bn.get(k) || 0);
    for (const [k, v] of bn) if ((bo.get(k) || 0) < v) itemExtra += v - (bo.get(k) || 0);
  }

  pagesFound.push(p);
  for (const d of probe.tables) { bands++; if (d.inherited) inherited++; rowsAll += d.rows; refCells += d.refCells; if (d.colhead) colheads++; }
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  refLines += L.lines.filter((l) => l.role === 'ref').length;
  sections += new Set(L.lines.filter((l) => l.rt && l.rt.cell === 'S').map((l) => l.rt.t + ':' + l.rt.row)).size;
  strays += L.lines.filter((l) => l.rt && l.rt.cell === 'X').length;
  const heads = L.paragraphs.filter((q) => q.kind === 'rowhead');
  rowheads += heads.length;
  // 이름표에 쪽 번호가 섞였나(쪽 번호 줄 글자가 이름표 문단 안의 낱말로 나오는가)
  for (const h of heads) {
    const toks = new Set(h.text.split(/\s+/));
    for (const id of h.refLineIds || []) { const r = byId.get(id); if (r && r.text.split(/[\s,–-]+/).some((x) => x && toks.has(x))) rowheadWithRef++; }
  }
  if (UNITS) {
    const us = sentenceUnits(L);
    const offFlow = new Set(L.lines.filter((l) => l.role === 'colhead' || l.role === 'ref').map((l) => l.id));
    for (const u of us) {
      unitsAll++;
      if (ROWTABLE.INT_ONLY.test(String(u.text).trim())) unitIntOnly++;
      if ((u.lineIds || []).some((id) => offFlow.has(id))) colheadSpoken++;   // 열 머리·쪽 번호 줄이 낭독 단위에 든 수
    }
  }
  if (RULES) {
    const rules = await hRules(page);
    const tabs = new Map();
    for (const l of L.lines) if (l.rt && (l.rt.cell === 'A' || l.rt.cell === 'P')) {
      if (!tabs.has(l.rt.t)) tabs.set(l.rt.t, { A: null, P: [] });
      const T = tabs.get(l.rt.t);
      if (l.rt.cell === 'A' && !T.A) T.A = l;
      if (l.rt.cell === 'P') T.P.push(l);
    }
    for (const [, T] of tabs) {
      if (!T.A || !T.P.length) continue;
      const ax = (T.A.runs[0].x0 + T.A.runs[0].x1) / 2;
      const ys = rules.filter((r) => r.x0 <= ax && r.x1 >= ax).map((r) => r.y).sort((a, b) => b - a);
      if (ys.length < 4) continue;
      const ruleRow = (y) => ys.filter((v) => v > y).length;
      const lab = T.P.map((l) => [l.rt.row, ruleRow(l.baseline)]);
      const maj = (key, val) => { const m = new Map(); for (const x of lab) { const k = x[key]; if (!m.has(k)) m.set(k, new Map()); const mm = m.get(k); mm.set(x[val], (mm.get(x[val]) || 0) + 1); } const out = new Map(); for (const [k, mm] of m) out.set(k, [...mm].sort((u, v) => v[1] - u[1])[0][0]); return out; };
      const t2r = maj(0, 1), r2t = maj(1, 0);
      const ok = lab.filter((x) => t2r.get(x[0]) === x[1] && r2t.get(x[1]) === x[0]).length;
      scored++; agree += ok; pLines += lab.length;
      if (ok < lab.length) badPages.push(p);
      if (SHOW) console.log(`  ${p}쪽 괘선 대조(표 ${T.A.rt.t}): P 줄 ${lab.length} 중 일대일 ${ok}`);
    }
  }
  if (SHOW) {
    console.log(`── ${p}쪽: 띠 ${probe.tables.length}(물려받음 ${probe.tables.filter((d) => d.inherited).length}) · 이름표 문단 ${heads.length} · 쪽 번호 줄 ${L.lines.filter((l) => l.role === 'ref').length} · 열 머리 ${L.lines.filter((l) => l.role === 'colhead').length}줄`);
    for (const pa of L.paragraphs) {
      const f = byId.get(pa.lineIds[0]);
      if (!f || !f.rt) continue;
      if (pa.kind === 'rowhead') console.log(`   A「${clip(pa.text, 40)}」 [${(pa.refLineIds || []).map((id) => byId.get(id).text).join(' · ')}]`);
      else if (f.rt.cell === 'S') console.log(`   §「${clip(pa.text, 40)}」`);
      else if (f.rt.cell === 'A') console.log(`   (홀로)「${clip(pa.text, 40)}」`);
    }
  }
  page.cleanup();
}

const name = file.split(/[\\/]/).pop();
console.log(`\n== ${name} ${from}–${to} (앱 모듈 · 7b ENABLED=${ROWTABLE.ENABLED})`);
console.log(`   행 표 쪽 ${pagesFound.length}: ${pagesFound.join(',')}`);
console.log(`   띠 ${bands}(R7 물려받음 ${inherited}) · 행(구획·홀로·그 밖 포함) ${rowsAll} · 이름표 문단(rowhead) ${rowheads} · 구획 행 ${sections} · 그 밖 조각 줄 ${strays}`);
console.log(`   쪽 번호 칸 ${refCells} · 쪽 번호 줄(ref) ${refLines} · 열 머리 잡은 띠 ${colheads}`);
console.log(`   판정에서 빠진 띠(이유별): ${[...rejectWhy].map(([k, v]) => k + ' ' + v).join(' · ') || '-'}`);
if (RULES) console.log(`   괘선 대조: 채점 표 ${scored} · P 줄 ${pLines} 중 행 일치 ${agree} (${pLines ? (100 * agree / pLines).toFixed(1) : '-'}%) · 어긋난 쪽 ${[...new Set(badPages)].join(',')}`);
if (UNITS) console.log(`   낭독 단위(행 표 쪽) ${unitsAll}: 정수만인 단위 ${unitIntOnly} · 열 머리·쪽 번호 줄이 든 단위 ${colheadSpoken} · 쪽 번호가 섞인 이름표 ${rowheadWithRef}`);
if (oldMod) console.log(`   행 표 없는 쪽 옛·새 비교(algoVersion 제외 JSON): 같음 ${same} · 다름 ${diff}${diff ? ' — ' + diffPages.slice(0, 40).join(',') : ''}`);
if (oldMod) console.log(`   행 표 쪽 글자 보존(옛 레이아웃 대비 아이템): 잃음 ${itemLost} · 늘어남 ${itemExtra}`);
console.log(`   시간(데스크톱 Node): getTextContent ${(msText / 1000).toFixed(1)}s + 레이아웃 ${(msLayout / 1000).toFixed(1)}s = ${((msText + msLayout) / 1000).toFixed(1)}s / ${nPages}쪽 · 레이아웃 ${(msLayout / Math.max(1, nPages)).toFixed(2)} ms/쪽${oldMod ? ` (옛 레이아웃 ${(msOld / Math.max(1, same + diff)).toFixed(2)} ms/쪽)` : ''}`);
