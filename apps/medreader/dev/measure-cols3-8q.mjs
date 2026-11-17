#!/usr/bin/env node
/* ============================================================
   8q 측정 — 3단 본문 (spec 4-14-2) (2026-11-17)

     node apps/medreader/dev/measure-cols3-8q.mjs <pdf> [시작쪽] [끝쪽]
         --pdfjs <폴더 또는 pdf.mjs>   (또는 MEDREADER_PDFJS — measure-lib 주석)
         [--head-dir <폴더>]  HEAD 사본을 둘/둔 곳. 없으면 `git archive HEAD apps/medreader/js` 를 Node 안에서 풀어 만든다
                              (체크아웃·작업 트리 변경 없음). 기본: OS 임시 폴더/medreader-8q-head-<HEAD 앞 12자>.
                              폴더에 HEAD.txt 가 있고 지금 HEAD 와 같으면 다시 풀지 않는다.
         [--pages a,b,c]      이 쪽들만
         [--json <파일>]      쪽별 결과(숫자·열 번호만 — 원서 글 없음)를 파일로
         [--app]              바뀐 쪽의 낭독 단위(앱 buildUnits) 수·같음까지 비교한다

   재는 것(앱 모듈만 — 코드를 고치지 않는다):
     ① HEAD 사본 `buildPageLayout` 대 지금 코드 — 쪽마다 PageLayout JSON(`algoVersion` 뺌) 바이트 비교. 바뀐 쪽 목록.
     ② 지금 코드의 3단 판정 쪽(columns.count 3) 목록과, 그 쪽의 HEAD 판정(1·2단).
     ③ 표 글자 비율 = 4-8 표 영역 줄 글자 / (문단 글자 + 표 영역 줄 글자) — 3단 쪽 합계·전 쪽 합계, HEAD 대 지금.
     ④ 3단 쪽 읽기 순서 요약 — 줄의 col 값을 읽기 순서로 묶은 것(예 `0×41 1×40 2×39`, span 은 `s`). 글은 내지 않는다.
     ⑤ 시간 — 쪽마다 buildPageLayout 평균(HEAD·지금). 같은 아이템을 넘긴다(사본은 JSON 복제).
   측정은 이웃 쪽을 넘기지 않는다(measure-lib 과 같음). 원서 글은 출력하지 않는다.
   ============================================================ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

import { loadPdfjs, sentenceUnits } from './measure-lib.mjs';
import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';

const argv = process.argv;
const VALUED = new Set(['--pdfjs', '--head-dir', '--pages', '--json']);
const pos = [];
const opts = {};
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (VALUED.has(a)) { opts[a] = argv[i + 1]; i++; continue; }
  if (a.startsWith('--')) { opts[a] = true; continue; }
  pos.push(a);
}
const [file, fromArg, toArg] = pos;
if (!file) {
  console.error('사용: measure-cols3-8q.mjs <pdf> [시작] [끝] --pdfjs <p> [--head-dir d] [--pages a,b] [--json out] [--app]');
  process.exit(2);
}
const APP = !!opts['--app'];
const ONLY = opts['--pages'] ? new Set(String(opts['--pages']).split(',').map(Number)) : null;

/* ── HEAD 사본 ─────────────────────────────────────────── */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const git = (args, enc) => execFileSync('git', args, { cwd: REPO, encoding: enc, maxBuffer: 256 * 1024 * 1024 });
const headSha = String(git(['rev-parse', 'HEAD'], 'utf8')).trim();
const headDir = path.resolve(opts['--head-dir'] || path.join(os.tmpdir(), 'medreader-8q-head-' + headSha.slice(0, 12)));

/** git archive 의 tar(ustar + pax)를 Node 로 푼다 — 외부 tar 에 기대지 않는다. `strip` 앞머리를 떼고 dest 아래에. */
function untar(buf, dest, strip) {
  let off = 0, pax = null, n = 0;
  const str = (h, a, b) => { const s = h.subarray(a, b); const z = s.indexOf(0); return s.subarray(0, z < 0 ? s.length : z).toString('utf8'); };
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    let name = str(h, 0, 100);
    const size = parseInt(str(h, 124, 136).trim() || '0', 8);
    const type = String.fromCharCode(h[156]);
    const prefix = str(h, 345, 500);
    if (prefix) name = prefix + '/' + name;
    off += 512;
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if (type === 'g') continue;
    if (type === 'x') { const m = data.toString('utf8').match(/\d+ path=([^\n]*)\n/); pax = m ? m[1] : null; continue; }
    if (pax) { name = pax; pax = null; }
    if (type !== '0' && type !== '\0') continue;
    if (!name.startsWith(strip)) continue;
    const out = path.join(dest, name.slice(strip.length));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
    n++;
  }
  return n;
}

let stamp = null;
try { stamp = fs.readFileSync(path.join(headDir, 'HEAD.txt'), 'utf8').trim(); } catch (e) { /* 없음 */ }
if (stamp !== headSha) {
  const tar = git(['archive', '--format=tar', 'HEAD', 'apps/medreader/js'], 'buffer');
  fs.mkdirSync(headDir, { recursive: true });
  const n = untar(tar, headDir, 'apps/medreader/');
  fs.writeFileSync(path.join(headDir, 'HEAD.txt'), headSha + '\n');
  console.log(`HEAD 사본: ${headSha.slice(0, 12)} → ${headDir} (파일 ${n})`);
}
const HEADMOD = await import(pathToFileURL(path.join(headDir, 'js', 'text', 'layout.js')).href);
const headLayout = HEADMOD.buildPageLayout;

/* ── 쪽마다 ─────────────────────────────────────────────── */
const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file, verbosity: 0 }).promise;
const N = doc.numPages;
const from = Math.max(1, Number(fromArg) || 1);
const to = Math.min(Number(toArg) || N, N);

const noAlgo = (L) => JSON.stringify(Object.assign({}, L, { algoVersion: 0 }));
function chars(L) {
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  let flow = 0, table = 0;
  for (const pa of L.paragraphs) flow += (pa.text || '').length;
  for (const g of L.regions) for (const id of g.lineIds) { const l = byId.get(id); if (l) table += (l.text || '').length; }
  return { flow, table };
}
function orderSummary(L) {
  const out = [];
  for (const l of L.lines) {
    if (l.role === 'rotated') continue;
    const c = l.col === 'span' ? 's' : String(l.col);
    if (out.length && out[out.length - 1][0] === c) out[out.length - 1][1]++;
    else out.push([c, 1]);
  }
  return out.map(([c, n]) => c + '×' + n).join(' ');
}

const changed = [];
const tri = [];
const per = [];
const tot = { pages: 0, tOld: 0, tNew: 0, oldFlow: 0, oldTable: 0, newFlow: 0, newTable: 0,
  triOldFlow: 0, triOldTable: 0, triNewFlow: 0, triNewTable: 0, unitsSame: 0, unitsDiff: 0 };
const t0 = performance.now();
for (let p = from; p <= to; p++) {
  if (ONLY && !ONLY.has(p)) continue;
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const size = unrotatedPageSize(page.view, vp.width, vp.height);
  const copy = JSON.parse(JSON.stringify(tc.items));
  const info = () => ({ pageNo: p, styles: tc.styles, width: size.width, height: size.height });
  // 차례를 번갈아(JIT 치우침 줄이기)
  let LO, LN, a, b;
  if (p % 2) {
    a = performance.now(); LO = headLayout(copy, info()); b = performance.now(); tot.tOld += b - a;
    a = performance.now(); LN = buildPageLayout(tc.items, info()); b = performance.now(); tot.tNew += b - a;
  } else {
    a = performance.now(); LN = buildPageLayout(tc.items, info()); b = performance.now(); tot.tNew += b - a;
    a = performance.now(); LO = headLayout(copy, info()); b = performance.now(); tot.tOld += b - a;
  }
  page.cleanup();
  tot.pages++;
  const same = noAlgo(LO) === noAlgo(LN);
  const co = chars(LO), cn = chars(LN);
  tot.oldFlow += co.flow; tot.oldTable += co.table; tot.newFlow += cn.flow; tot.newTable += cn.table;
  const rec = { p, same, oldCols: LO.columns.count, newCols: LN.columns.count, oldWarn: LO.stats.warn, newWarn: LN.stats.warn,
    old: co, now: cn };
  if (!same) {
    changed.push(p);
    if (APP) {
      const uo = sentenceUnits(LO).map((u) => u.text), un = sentenceUnits(LN).map((u) => u.text);
      const eq = JSON.stringify(uo) === JSON.stringify(un);
      rec.units = { old: uo.length, now: un.length, same: eq };
      if (eq) tot.unitsSame++; else tot.unitsDiff++;
    }
  }
  if (LN.columns.count === 3) {
    tri.push(p);
    tot.triOldFlow += co.flow; tot.triOldTable += co.table; tot.triNewFlow += cn.flow; tot.triNewTable += cn.table;
    rec.gutters = LN.columns.gutters.map((g) => +(g / size.width).toFixed(3));
    rec.order = orderSummary(LN);
    rec.lines = LN.lines.filter((l) => l.role !== 'rotated').length;
  }
  per.push(rec);
}
const sec = (performance.now() - t0) / 1000;

const pct = (t, f) => (t + f > 0 ? (100 * t / (t + f)).toFixed(1) + '%' : '—');
const short = (a) => (a.length > 60 ? a.slice(0, 60).join(',') + ` …(+${a.length - 60})` : a.join(','));
console.log(`${path.basename(file)}  쪽 ${from}–${to} (${tot.pages}쪽, ${sec.toFixed(1)}초)  HEAD ${headSha.slice(0, 12)}`);
console.log(`  ① HEAD 대 지금 PageLayout(algoVersion 뺌) 바뀐 쪽: ${changed.length}${changed.length ? ' — ' + short(changed) : ''}`);
const notTri = changed.filter((p) => !tri.includes(p));
console.log(`     그중 3단 판정이 아닌 쪽: ${notTri.length}${notTri.length ? ' — ' + short(notTri) : ''}`);
const fromCols = { 1: 0, 2: 0 };
for (const r of per) if (r.newCols === 3) fromCols[r.oldCols] = (fromCols[r.oldCols] || 0) + 1;
console.log(`  ② 3단 판정 쪽: ${tri.length}${tri.length ? ' — ' + short(tri) : ''}  (HEAD 에서 1단 ${fromCols[1]} · 2단 ${fromCols[2]})`);
console.log(`  ③ 표 글자 비율 — 3단 쪽: HEAD ${pct(tot.triOldTable, tot.triOldFlow)} (${tot.triOldTable}/${tot.triOldTable + tot.triOldFlow}) → 지금 ${pct(tot.triNewTable, tot.triNewFlow)} (${tot.triNewTable}/${tot.triNewTable + tot.triNewFlow})`);
console.log(`     전 쪽: HEAD ${pct(tot.oldTable, tot.oldFlow)} → 지금 ${pct(tot.newTable, tot.newFlow)}`);
if (APP) console.log(`  · 바뀐 쪽 낭독 단위: 같음 ${tot.unitsSame} · 다름 ${tot.unitsDiff}`);
console.log(`  ⑤ buildPageLayout 평균: HEAD ${(tot.tOld / Math.max(1, tot.pages)).toFixed(3)} ms · 지금 ${(tot.tNew / Math.max(1, tot.pages)).toFixed(3)} ms (차 ${((tot.tNew - tot.tOld) / Math.max(1, tot.pages)).toFixed(3)} ms/쪽)`);
if (opts['--json']) {
  fs.writeFileSync(opts['--json'], JSON.stringify({ file: path.basename(file), head: headSha, from, to, sec: +sec.toFixed(1),
    changed, tri, totals: tot, pages: per.filter((r) => !r.same || r.newCols === 3) }, null, 1));
  console.log(`  json → ${opts['--json']}`);
}
