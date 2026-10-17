#!/usr/bin/env node
/* ============================================================
   8i-2 Plan 측정 — 본문 "이름표 | 설명" 2열 표 (spec 4-13-10) (2026-10-17)

     MEDREADER_PDFJS=<폴더> node apps/medreader/dev/measure-rowtable-8i2.mjs <pdf> [시작쪽] [끝쪽]
         [--proto <옵션>]  시제품(dev/proto-rowtable-8i2.mjs)으로도 레이아웃을 만든다. 옵션은 쉼표 목록:
                           hidden=0.2 · grow · split · rowGap=1.1 · head · headFont · cap · figBreak · xsplit · secRole
                           · all(권장안 전부 = headFont 를 뺀 나머지, rowGap 1.1) — 이름은 spec 4-13-10 3절의 R3(f)·R1c/R1d·R5b·R6b·역할·R1b·R2b
         [--show]          표 쪽마다 행 목록(사람 눈 검토 형식: H 열 머리 · § 구획 · A「이름표」→ P「설명 첫 30자」(줄 수))
         [--cand]          (--proto 와 함께) 표마다 이름표 열 줄 후보 목록 — 정답표를 손으로 만들 때 쓴다
         [--key <json>]    정답표(dev/rowtable-8i2-key.json)로 채점 — 이름표 단위 · P 줄 단위
         [--pages a,b]     이 쪽들만
         [--app]           [8i-2 Build] **앱 모듈**(js/text/rowtable.js)을 (나) 설정(REQUIRE_REF:false)으로 돌려
                           ① 시제품(--proto all)과 같은 PageLayout 인가(쪽마다 바이트) ② 8i 참조와 비교해 잡힌 쪽·회귀(바이트)·글자 보존
                           ③ --key 채점을 앱 결과로 한다. 8i 참조 = 시제품 사본을 규칙 전부 끈 채(X8I2 {}·REQUIRE_REF true) —
                           246e392 의 rowtable.js 그대로다(앱 코드를 고친 뒤에도 옛 동작을 재는 자). --proto 를 안 주면 all.

   **앱 코드를 고치지 않는다.** 세 가지 레이아웃을 만든다:
     기준   = 앱 `buildPageLayout` + config `ROWTABLE` 그대로(8i — REQUIRE_REF true)
     (나)   = 앱 `buildPageLayout` + `{ ...ROWTABLE, REQUIRE_REF: false }`(4번째 인자 — 8i Build 가 둔 문). 규칙만 풀었을 때.
     시제품 = `proto-rowtable-8i2.mjs` 의 `buildPageLayout8i2` + `{ ...ROWTABLE, REQUIRE_REF: false, X8I2 }`
   회귀: 기준이 잡은 쪽(CMDT 2026 21–38)과 시제품이 아무 표도 잡지 않은 쪽은 시제품 JSON 이 기준과 바이트 같아야 한다.
   측정은 이웃 쪽을 넘기지 않는다(measure-lib 과 같음). 원서 조각은 40자 이하.
   ============================================================ */

import fs from 'node:fs';
import { loadPdfjs, positional, sentenceUnits } from './measure-lib.mjs';
import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { ROWTABLE, LAYOUT } from '../js/config.js';
import { buildPageLayout8i2 } from './proto-rowtable-8i2.mjs';

const argv = process.argv;
const [file, fromArg, toArg] = positional(argv);
if (!file) { console.error('사용: measure-rowtable-8i2.mjs <pdf> [시작] [끝] [--proto 옵션] [--show] [--cand] [--key json] [--pages a,b]'); process.exit(2); }
const SHOW = argv.includes('--show');
const CAND = argv.includes('--cand');
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const ONLY = opt('--pages') ? new Set(opt('--pages').split(',').map(Number)) : null;
const PROTO = opt('--proto');
const KEYF = opt('--key');
const APP = argv.includes('--app');

const X = {};
if (APP && !PROTO) Object.assign(X, { hidden: 0.2, grow: true, split: true, rowGap: 1.1, head: true, cap: true, figBreak: true, xsplit: true, secRole: true });
if (PROTO) {
  for (const t of PROTO.split(',')) {
    if (t === 'all') Object.assign(X, { hidden: 0.2, grow: true, split: true, rowGap: 1.1, head: true, cap: true, figBreak: true, xsplit: true, secRole: true });
    else { const [k, v] = t.split('='); X[k] = v == null ? true : Number(v); }
  }
  if (X.rowGap == null) X.rowGap = 1.15;
}
const NA = Object.assign({}, ROWTABLE, { REQUIRE_REF: false });
const PR = Object.assign({}, ROWTABLE, { REQUIRE_REF: false, X8I2: X });
const REF8 = Object.assign({}, ROWTABLE, { REQUIRE_REF: true, X8I2: {} });   // [--app] 8i 참조(시제품 사본, 규칙 끔)
const RUNP = !!(PROTO || APP);

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file }).promise;
const from = Math.max(1, Number(fromArg) || 1), to = Math.min(Number(toArg) || doc.numPages, doc.numPages);
const clip = (t, n = 40) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));
const bookKey = /harrison/i.test(file) ? 'harrison' : /2026/.test(file) ? 'cmdt2026' : 'cmdt2021';
const KEY = KEYF ? (JSON.parse(fs.readFileSync(KEYF, 'utf8'))[bookKey] || {}) : null;

/* 레이아웃 → 표 → 행 → 칸 줄 */
function tablesOf(L) {
  const T = new Map();
  for (const l of L.lines) {
    if (!l.rt) continue;
    if (!T.has(l.rt.t)) T.set(l.rt.t, { rows: new Map(), head: [] });
    const t = T.get(l.rt.t);
    if (l.rt.cell === 'H') { t.head.push(l); continue; }
    if (!t.rows.has(l.rt.row)) t.rows.set(l.rt.row, { A: [], P: [], R: [], S: [], X: [] });
    t.rows.get(l.rt.row)[l.rt.cell].push(l);
  }
  return T;
}
function showTables(tag, p, L, probe) {
  for (const [t, tab] of tablesOf(L)) {
    const ds = probe.tables.filter((d) => d.t === t);
    const al = ds.map((d) => d.align + (d.inherited ? '*' : '') + (d.grown ? '+' : '')).join('/');
    const extra = ds.map((d) => (d.nSplit ? ` 쪼갬${d.nSplit}` : '') + (d.head2 ? ' 머리' : '') + (d.hiddenRatio != null ? ` 숨은열${d.hiddenRatio.toFixed(2)}` : '')).join('');
    console.log(`── [${tag}] ${p}쪽 표${t} [${al}]${extra}`);
    if (tab.head.length) console.log(`   H「${clip(tab.head.map((l) => l.text).join(' | '), 40)}」`);
    for (const [, r] of tab.rows) {
      if (r.S.length) { console.log(`   §「${clip(r.S.map((l) => l.text).join(' '), 40)}」`); continue; }
      if (!r.A.length && !r.P.length) { if (r.X.length) console.log(`   X「${clip(r.X.map((l) => l.text).join(' '), 40)}」`); continue; }
      console.log(`   ${r.A.length ? (r.P.length ? 'A' : '(홀로)') : '-'}「${clip(r.A.map((l) => l.text).join(' / '), 40)}」(${r.A.length}줄) → P「${r.P.length ? clip(r.P[0].text, 30) : ''}」(${r.P.length}줄)`);
    }
  }
}

/* 정답표 채점(시제품·(나) 공통). 정답표: { "<쪽>": { "rows": [[y, "이름표 앞 20자"], …], "head": y|null, "groups": [y…], "aTop": true } }
 *   rows = 행 시작 이름표 첫 줄의 baseline(위 정렬 표). groups = 묶음 제목 줄(홀로 선 행이어야 한다). head = 열 머리 줄.
 *   이름표 채점: 예측 rowhead 문단의 첫 줄 baseline 이 정답 행 시작과 같으면 맞음. 예측 이름표 칸이 정답 행 시작 둘 이상을 품으면 "붙음".
 *   P 줄 채점: 정답 = baseline 이상(±1)인 마지막 행 시작(그 위면 "이름표 없는 행"). 예측 = 그 P 줄의 행 이름표 첫 줄.
 *   열 머리: 정답 head 높이의 줄이 colhead(읽지 않음)면 "접음", 별도 행(첫 행에 붙지 않음)이면 "따로", 첫 행에 붙으면 "붙음". */
const score = { labels: 0, labOk: 0, stuck: 0, pLines: 0, pOk: 0, heads: 0, headFold: 0, headSep: 0, headStuck: 0, groups: 0, groupAlone: 0, extraRows: 0, missedPages: 0, exclOk: 0, falseInc: 0 };
function grade(p, L) {
  const k = KEY && KEY[String(p)];
  if (!k) return null;
  if (k.exclude) { if (tablesOf(L).size) score.falseInc++; else score.exclOk++; return null; }
  const rowsK = k.rows.map((r) => r[0]);
  const near = (a, b) => Math.abs(a - b) <= 1;
  const tabs = tablesOf(L);
  if (!tabs.size) { score.missedPages++; score.labels += rowsK.length; return { stuck: [], miss: ['표 없음'], wrongP: 0 }; }
  const aFirst = [];      // 예측 행: { y, ys(이름표 줄 baseline 전부), hasP }
  const pRow = new Map(); // P 줄 baseline → 예측 행 이름표 첫 줄 y(없으면 null)
  const headYs = new Set();
  for (const [, tab] of tabs) {
    for (const h of tab.head) headYs.add(Math.round(h.baseline * 10) / 10);
    for (const [, r] of tab.rows) {
      if (r.S.length) continue;
      const ay = r.A.length ? r.A[0].baseline : null;
      if (r.A.length) aFirst.push({ y: ay, ys: r.A.map((l) => l.baseline), hasP: !!r.P.length });
      for (const l of r.P) pRow.set(Math.round(l.baseline * 10) / 10, ay);
    }
  }
  const out = { stuck: [], miss: [], wrongP: 0 };
  for (const y of rowsK) {
    score.labels++;
    const hit = aFirst.find((a) => near(a.y, y) && a.hasP);
    if (hit) {
      const inside = rowsK.filter((z) => z !== y && hit.ys.some((v) => near(v, z)));
      if (inside.length) { score.stuck++; out.stuck.push(y); } else score.labOk++;
    } else out.miss.push(y);
  }
  for (const a of aFirst) if (a.hasP && !rowsK.some((y) => near(a.y, y))) { score.extraRows++; }
  // P 줄
  const truthRow = (y) => { let best = null; for (const r of rowsK) if (r >= y - 1) best = r; return best; };
  for (const [y, ay] of pRow) {
    if (k.head != null && near(y, k.head)) continue;
    if ((k.groups || []).some((g) => near(g, y))) continue;
    score.pLines++;
    const t = truthRow(y);
    if ((t == null && ay == null) || (t != null && ay != null && near(t, ay))) score.pOk++; else out.wrongP++;
  }
  if (k.head != null) {
    score.heads++;
    if ([...headYs].some((v) => near(v, k.head))) score.headFold++;
    else {
      const stuck = aFirst.some((a) => a.ys.some((v) => near(v, k.head)) && a.ys.length > 1 && !near(a.ys[a.ys.length - 1], k.head)) || [...pRow].some(([y, ay]) => near(y, k.head) && ay != null && !near(ay, k.head));
      if (stuck) score.headStuck++; else score.headSep++;
    }
  }
  for (const g of k.groups || []) {
    score.groups++;
    if (aFirst.some((a) => near(a.y, g) && a.ys.length === 1 && !a.hasP)) score.groupAlone++;
  }
  return out;
}

/* [--app] 쪽마다: 8i 참조(시제품 사본·규칙 끔) 대 앱((나) 설정 = LB) · 앱 config 그대로(LA). */
const AP = { appVsProto: [], base8: [], fresh: [], regress: [], copyDiff: [], cfgVs8: [], lost: 0, extra: 0, ua: 0, up: 0, freshU: 0, goneU: 0, rowheads: 0, colheadLines: 0, intOnly: 0, hA: 0, hP: 0, regA: 0, regP: 0, f8: false };
function appPage(p, tc, info, LA, LB, pb) {
  let p8 = null;
  const L8 = buildPageLayout8i2(tc.items, info((r) => { p8 = r; }), LAYOUT, REF8);
  const f8 = !!p8.tables.length, fb = !!pb.tables.length;
  AP.f8 = f8;
  if (f8) AP.base8.push(p);
  if (fb && !f8) AP.fresh.push(p);
  if (noAlgo(LA) !== noAlgo(L8)) AP.cfgVs8.push(p);
  if (f8 && noAlgo(LB) !== noAlgo(L8)) AP.regress.push(p);
  if (!fb && noAlgo(LB) !== noAlgo(L8)) AP.copyDiff.push(p);
  if (!(fb && !f8)) return;
  const bag = (X) => { const m = new Map(); for (const l of X.lines) for (const it of l.items) { const k = it.idx + ':' + it.str; m.set(k, (m.get(k) || 0) + 1); } return m; };
  const ba = bag(L8), bp = bag(LB);
  for (const [k, v] of ba) if ((bp.get(k) || 0) < v) AP.lost += v - (bp.get(k) || 0);
  for (const [k, v] of bp) if ((ba.get(k) || 0) < v) AP.extra += v - (ba.get(k) || 0);
  const ua = sentenceUnits(L8).map((u) => String(u.text).trim()), up = sentenceUnits(LB).map((u) => String(u.text).trim());
  const sa = new Set(ua), sp = new Set(up);
  AP.ua += ua.length; AP.up += up.length;
  AP.freshU += up.filter((t) => !sa.has(t)).length; AP.goneU += ua.filter((t) => !sp.has(t)).length;
  AP.intOnly += up.filter((t) => /^\d{1,5}$/.test(t)).length;
  AP.rowheads += LB.paragraphs.filter((q) => q.kind === 'rowhead').length;
  AP.colheadLines += LB.lines.filter((l) => l.role === 'colhead').length;
  AP.hA += L8.paragraphs.filter((q) => q.kind === 'heading').length; AP.hP += LB.paragraphs.filter((q) => q.kind === 'heading').length;
  AP.regA += (L8.regions || []).length; AP.regP += (LB.regions || []).length;
}

const pages = { base: [], naive: [], proto: [] };
const regress = [], copyDiff = [], naiveOnly = [];
let msA = 0, msP = 0, nPg = 0;
const U = { regA: 0, regP: 0, tabLinesA: 0, tabLinesP: 0, regPages: [], a: 0, p: 0, fresh: 0, gone: 0, rowheads: 0, colheadLines: 0, lost: 0, extra: 0, intOnly: 0 };
for (let p = from; p <= to; p++) {
  if (ONLY && !ONLY.has(p)) continue;
  let page;
  try { page = await doc.getPage(p); } catch (e) { continue; }
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const size = unrotatedPageSize(page.view, vp.width, vp.height);
  const info = (probe) => ({ pageNo: p, styles: tc.styles, width: size.width, height: size.height, rowTableProbe: probe });
  let pa = null, pb = null, pp = null;
  let t0 = performance.now();
  const LA = buildPageLayout(tc.items, info((r) => { pa = r; }));
  msA += performance.now() - t0; nPg++;
  const LB = buildPageLayout(tc.items, info((r) => { pb = r; }), LAYOUT, NA);
  const fa = !!pa.tables.length, fb = !!pb.tables.length;
  if (fa) pages.base.push(p);
  if (fb && !fa) pages.naive.push(p);
  let LP = null, fp = false;
  if (APP) appPage(p, tc, info, LA, LB, pb);
  if (RUNP) {
    t0 = performance.now();
    LP = buildPageLayout8i2(tc.items, info((r) => { pp = r; }), LAYOUT, PR);
    msP += performance.now() - t0;
    fp = !!pp.tables.length;
    if (fp && !fa) pages.proto.push(p);
    if (fa && noAlgo(LP) !== noAlgo(LA)) regress.push(p);
    if (!fp && noAlgo(LP) !== noAlgo(LA)) copyDiff.push(p);
    if (fb && !fa && !fp) naiveOnly.push(p);
  }
  if (APP && LP && noAlgo(LP) !== noAlgo(LB)) AP.appVsProto.push(p);
  if (PROTO && fp && !fa) {
    // 글자 보존(아이템 다중 집합) · 낭독 단위 변화(번역 캐시 새 키 = 기준에 없던 단위 글)
    const bag = (X) => { const m = new Map(); for (const l of X.lines) for (const it of l.items) { const k = it.idx + ':' + it.str; m.set(k, (m.get(k) || 0) + 1); } return m; };
    const ba = bag(LA), bp = bag(LP);
    for (const [k, v] of ba) if ((bp.get(k) || 0) < v) U.lost += v - (bp.get(k) || 0);
    for (const [k, v] of bp) if ((ba.get(k) || 0) < v) U.extra += v - (ba.get(k) || 0);
    const ua = sentenceUnits(LA).map((u) => String(u.text).trim()), up = sentenceUnits(LP).map((u) => String(u.text).trim());
    const sa = new Set(ua), sp = new Set(up);
    U.a += ua.length; U.p += up.length;
    U.fresh += up.filter((t) => !sa.has(t)).length; U.gone += ua.filter((t) => !sp.has(t)).length;
    U.intOnly += up.filter((t) => /^\d{1,5}$/.test(t)).length;
    U.rowheads += LP.paragraphs.filter((q) => q.kind === 'rowhead').length;
    U.colheadLines += LP.lines.filter((l) => l.role === 'colhead').length;
    // 4-8 표 영역(격자 표시·낭독 대신 "표" 안내)이 있던 쪽 — 7b 가 먼저 가져가면 영역이 줄거나 사라진다
    const ra = (LA.regions || []).length, rp = (LP.regions || []).length;
    U.regA += ra; U.regP += rp;
    U.hA = (U.hA || 0) + LA.paragraphs.filter((q) => q.kind === 'heading').length; U.hP = (U.hP || 0) + LP.paragraphs.filter((q) => q.kind === 'heading').length;
    U.tabLinesA += LA.lines.filter((l) => l.role === 'table').length; U.tabLinesP += LP.lines.filter((l) => l.role === 'table').length;
    if (ra !== rp) U.regPages.push(p + '(' + ra + '→' + rp + ')');
  }
  if (SHOW && fb && !fa && !RUNP) showTables('(나)', p, LB, pb);
  if (SHOW && APP && fb && !AP.f8) showTables('앱', p, LB, pb);
  else if (SHOW && fp && !fa) showTables('시제품', p, LP, pp);
  if (CAND && fp && !fa) {
    // 이름표 열 후보 줄: 시제품이 만든 A 줄(쪼개기 전 원래 줄 단위) — baseline · x0 · 글 · 같은 높이 P 줄 유무 · 위 P 간격
    const pl = LP.lines.filter((l) => l.rt && l.rt.cell === 'P').map((l) => l.baseline).sort((a, b) => b - a);
    for (const l of LP.lines.filter((l) => l.rt && (l.rt.cell === 'A' || l.rt.cell === 'H' || l.rt.cell === 'S' || l.rt.cell === 'X'))) {
      const k = pl.findIndex((y) => Math.abs(y - l.baseline) <= 2.4);
      const gap = k > 0 ? (pl[k - 1] - pl[k]).toFixed(1) : '-';
      console.log(`   후보 ${p} ${l.rt.cell} y=${l.baseline.toFixed(1)} x0=${l.bbox.x0.toFixed(0)} P${k >= 0 ? '있음 위간격 ' + gap : '없음'}「${clip(l.text, 30)}」`);
    }
  }
  if (KEY && APP) { const g = grade(p, LB); if (g && (g.stuck.length || g.miss.length || g.wrongP)) console.log(`   채점 ${p}쪽: 붙음 ${g.stuck.join(',')} · 못 맞춤 ${g.miss.join(',')} · P 줄 어긋남 ${g.wrongP}`); }
  else if (KEY && PROTO) { const g = grade(p, LP); if (g && (g.stuck.length || g.miss.length || g.wrongP)) console.log(`   채점 ${p}쪽: 붙음 ${g.stuck.join(',')} · 못 맞춤 ${g.miss.join(',')} · P 줄 어긋남 ${g.wrongP}`); }
  else if (KEY) grade(p, LB);
  page.cleanup();
}

const name = file.split(/[\\/]/).pop();
console.log(`\n== ${name} ${from}–${to}`);
console.log(`   기준(config ROWTABLE 그대로 — REQUIRE_REF ${ROWTABLE.REQUIRE_REF}) 행 표 쪽 ${pages.base.length}: ${pages.base.join(',')}`);
console.log(`   (나) ${APP ? '= 앱 모듈 REQUIRE_REF:false —' : '규칙만 풀면'} 새로 잡히는 쪽(config 기준 대비) ${pages.naive.length}: ${pages.naive.join(',')}`);
if (PROTO) {
  console.log(`   시제품(${PROTO}) 새로 잡는 쪽 ${pages.proto.length}: ${pages.proto.join(',')}`);
  console.log(`   (나)에서 잡혔으나 시제품이 뺀 쪽 ${naiveOnly.length}: ${naiveOnly.join(',')}`);
  console.log(`   새로 잡은 쪽: 글자(아이템) 잃음 ${U.lost} · 늘어남 ${U.extra} · 낭독 단위 기준 ${U.a} → 시제품 ${U.p} · 새 글 단위(번역 새 키) ${U.fresh} · 사라진 단위 ${U.gone} · 이름표 문단 ${U.rowheads} · 열 머리 줄(안 읽음) ${U.colheadLines} · 정수만 단위 ${U.intOnly}`);
  console.log(`   4-8 표 영역(새로 잡은 쪽): ${U.regA} → ${U.regP} · table 역할 줄 ${U.tabLinesA} → ${U.tabLinesP} · 바뀐 쪽 ${U.regPages.join(' ')} · heading 문단 ${U.hA || 0} → ${U.hP || 0}`);
  console.log(`   레이아웃 시간(데스크톱 Node): 기준 ${(msA / nPg).toFixed(2)} ms/쪽 · 시제품 ${(msP / nPg).toFixed(2)} ms/쪽 (${nPg}쪽)`);
  console.log(`   회귀: 기준 쪽에서 시제품 JSON 다름 ${regress.length}${regress.length ? ' — ' + regress.join(',') : ''} · 표 없는 쪽 시제품≠기준 ${copyDiff.length}${copyDiff.length ? ' — ' + copyDiff.slice(0, 30).join(',') : ''}`);
}
if (APP) {
  console.log(`   [--app] 앱(REQUIRE_REF:false) ≠ 시제품(all) 쪽 ${AP.appVsProto.length}${AP.appVsProto.length ? ' — ' + AP.appVsProto.slice(0, 40).join(',') : ''}`);
  console.log(`   [--app] 8i 참조가 잡은 쪽 ${AP.base8.length}: ${AP.base8.join(',')}`);
  console.log(`   [--app] 앱이 새로 잡는 쪽 ${AP.fresh.length}: ${AP.fresh.join(',')}`);
  console.log(`   [--app] 회귀: 8i 참조가 잡은 쪽에서 앱 JSON 다름 ${AP.regress.length}${AP.regress.length ? ' — ' + AP.regress.join(',') : ''} · 앱이 표를 안 잡은 쪽에서 다름 ${AP.copyDiff.length}${AP.copyDiff.length ? ' — ' + AP.copyDiff.slice(0, 30).join(',') : ''}`);
  console.log(`   [--app] 앱 config 그대로(REQUIRE_REF ${ROWTABLE.REQUIRE_REF}) ≠ 8i 참조 쪽 ${AP.cfgVs8.length}${AP.cfgVs8.length ? ' — ' + AP.cfgVs8.slice(0, 40).join(',') : ''}`);
  console.log(`   [--app] 새로 잡은 쪽(앱 대 8i 참조): 글자(아이템) 잃음 ${AP.lost} · 늘어남 ${AP.extra} · 낭독 단위 ${AP.ua} → ${AP.up} · 새 글 단위 ${AP.freshU} · 사라진 단위 ${AP.goneU} · 이름표 문단 ${AP.rowheads} · 열 머리 줄 ${AP.colheadLines} · 정수만 단위 ${AP.intOnly} · heading 문단 ${AP.hA} → ${AP.hP} · 4-8 영역 ${AP.regA} → ${AP.regP}`);
}
if (KEY) {
  const s = score;
  console.log(`   채점(${APP ? '앱' : PROTO ? '시제품' : '(나)'}) 정답 쪽 ${Object.keys(KEY).length} · 못 잡은 정답 쪽 ${s.missedPages}`);
  console.log(`     이름표(행 시작) ${s.labels} 중 맞음 ${s.labOk} (${(100 * s.labOk / Math.max(1, s.labels)).toFixed(1)}%) · 붙음 ${s.stuck} · 정답에 없는 행 ${s.extraRows}`);
  console.log(`     P 줄 ${s.pLines} 중 행 일치 ${s.pOk} (${(100 * s.pOk / Math.max(1, s.pLines)).toFixed(1)}%)`);
  console.log(`     2열 표가 아닌 정답 쪽(다열): 안 잡음 ${s.exclOk} · 잘못 잡음 ${s.falseInc}`);
  console.log(`     열 머리 ${s.heads}: 접음 ${s.headFold} · 따로 행 ${s.headSep} · 첫 행에 붙음 ${s.headStuck} — 묶음 제목 ${s.groups} 중 홀로 선 행 ${s.groupAlone}`);
}
