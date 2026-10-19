/* ============================================================
   MedReader — O1 스캔본 감지 측정 (spec 17-5-1, Plan 2026-10-19)

   쪽마다: getTextContent 글자 수(공백 제외) · 시간, 그리고 (골라서) getOperatorList 의
   이미지 그리기 연산 수 · 이미지 크기(→ 대략 dpi) · 시간. 앱 코드는 읽기만 한다.
   `--layout` 이면 글자가 있는 쪽을 앱 레이아웃(buildPageLayout)으로 돌려 단 수·문단 수·
   낭독 문장 수와 "이상한 낱말" 비율을 낸다(OCR 결과 품질을 보려고). 원서 문장은 출력하지 않는다.

     MEDREADER_PDFJS=<pdf.mjs> node apps/medreader/dev/measure-scan-o1.mjs <pdf>
         [--from a --to b]      쪽 범위(기본 전부)
         [--ops all|empty|none] getOperatorList 를 돌릴 쪽 (기본 empty = 글자 0 쪽만)
         [--ops-max n]          getOperatorList 상한(기본 60쪽)
         [--layout]             글자 있는 쪽을 레이아웃으로
         [--json f]             결과 JSON
         [--pgm page outdir]    그 쪽 첫 이미지를 PGM/PPM 으로(엔진 시간 재기용, 회색·RGB 만)
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { loadPdfjs, positional, sentenceUnits } from './measure-lib.mjs';
import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';

const argv = process.argv;
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.indexOf(k) >= 0;

const pdfjs = await loadPdfjs(argv);
const file = positional(argv)[0];
if (!file) { console.error('사용: measure-scan-o1.mjs <pdf> [--from a --to b] [--ops all|empty|none] [--layout] [--json f]'); process.exit(2); }

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
const N = doc.numPages;
const from = Math.max(1, Number(opt('--from', 1)) || 1);
const to = Math.min(N, Number(opt('--to', N)) || N);
const opsMode = opt('--ops', 'empty');
const opsMax = Number(opt('--ops-max', 60)) || 60;
const doLayout = has('--layout');

const O = pdfjs.OPS;
const IMG_OPS = new Map([
  [O.paintImageXObject, 'xobj'], [O.paintInlineImageXObject, 'inline'],
  [O.paintImageMaskXObject, 'mask'], [O.paintImageXObjectRepeat, 'repeat'],
  [O.paintInlineImageXObjectGroup, 'inlineGroup'], [O.paintImageMaskXObjectGroup, 'maskGroup'],
  [O.paintSolidColorImageMask, 'solidMask']
].filter(([k]) => Number.isInteger(k)));

// 이상한 낱말: 공백으로 자른 토큰 중 글자가 있고, (영문자·아포스트로피·하이픈·마침표·쉼표 등 문장부호) 밖의 글자가 섞였거나
// 숫자와 글자가 한 토큰에 섞인 것. 사전 대조가 아니다 — 거친 잡음 지표.
const RE_OKTOKEN = /^[("'“‘\[]*[A-Za-z]+(?:['’-][A-Za-z]+)*[)"'”’\].,;:!?]*$/;
const RE_NUM = /^[(\[]*[0-9]+(?:[.,:\-–][0-9]+)*[)\].,;:]*$/;

const t00 = Date.now();
const pages = [];
let opsRun = 0;
for (let p = from; p <= to; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const size = unrotatedPageSize(page.view, vp.width, vp.height);
  const t0 = performance.now();
  const tc = await page.getTextContent();
  const tText = performance.now() - t0;
  let chars = 0;
  for (const it of tc.items) if (typeof it.str === 'string') chars += it.str.replace(/\s+/g, '').length;
  const row = { p, items: tc.items.length, chars, tText: +tText.toFixed(1), w: Math.round(size.width), h: Math.round(size.height) };

  const wantOps = opsMode === 'all' || (opsMode === 'empty' && chars === 0);
  if (wantOps && opsRun < opsMax) {
    opsRun++;
    const t1 = performance.now();
    const ol = await page.getOperatorList();
    row.tOps = +(performance.now() - t1).toFixed(1);
    row.ops = ol.fnArray.length;
    const kinds = {};
    let imgs = 0; let maxW = 0; let maxH = 0; let firstId = null; const sizes = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const k = IMG_OPS.get(ol.fnArray[i]);
      if (!k) continue;
      imgs++;
      kinds[k] = (kinds[k] || 0) + 1;
      const a = ol.argsArray[i] || [];
      // paintImageXObject args = [objId, width, height]
      if (k === 'xobj') sizes.push(Number(a[1]) + 'x' + Number(a[2]));
      if (k === 'xobj' && Number(a[1]) * Number(a[2]) > maxW * maxH) { maxW = Number(a[1]); maxH = Number(a[2]); firstId = a[0]; }
    }
    row.imgs = imgs;
    row.kinds = kinds;
    row.sizes = sizes;
    if (maxW) {
      row.imgW = maxW; row.imgH = maxH;
      row.dpiX = Math.round(maxW / (size.width / 72)); // 이미지가 쪽 폭을 다 덮는다는 가정의 대략값
    }
    const pg = argv.indexOf('--pgm');
    if (pg >= 0 && Number(argv[pg + 1]) === p && firstId) {
      const outDir = argv[pg + 2];
      const img = await new Promise((res) => page.objs.get(firstId, res));
      if (img && img.data && (img.kind === 1 || img.kind === 2 || img.kind === 3)) {
        fs.mkdirSync(outDir, { recursive: true });
        const W = img.width; const H = img.height;
        const gray = Buffer.alloc(W * H);
        if (img.kind === 1) { // 1bpp, 행마다 바이트 정렬
          const stride = (W + 7) >> 3;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) gray[y * W + x] = (img.data[y * stride + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        } else {
          const ch = img.kind === 2 ? 3 : 4;
          for (let i = 0; i < W * H; i++) gray[i] = Math.round((img.data[i * ch] + img.data[i * ch + 1] + img.data[i * ch + 2]) / 3);
        }
        const f = path.join(outDir, `p${p}.pgm`);
        fs.writeFileSync(f, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), gray]));
        row.pgm = f; row.pgmKind = img.kind;
      } else {
        row.pgm = 'unsupported:' + (img && img.kind) + (img && img.bitmap ? ' bitmap' : '');
      }
    }
  }

  if (doLayout && chars > 0) {
    const L = buildPageLayout(tc.items, { pageNo: p, styles: tc.styles, width: size.width, height: size.height });
    const units = sentenceUnits(L);
    const text = L.lines.map((l) => l.text).join(' ');
    const toks = text.split(/\s+/).filter((s) => /[A-Za-z]/.test(s));
    let odd = 0;
    for (const s of toks) if (!RE_OKTOKEN.test(s) && !RE_NUM.test(s)) odd++;
    row.layout = {
      columns: L.columns && L.columns.count,
      lines: L.lines.length,
      paras: L.paragraphs.length,
      tables: (L.regions || []).filter((r) => r.kind === 'table' || r.type === 'table').length,
      units: units.length,
      words: toks.length,
      oddWords: odd,
      oddPct: toks.length ? +(100 * odd / toks.length).toFixed(1) : 0
    };
  }
  page.cleanup();
  pages.push(row);
}

const textless = pages.filter((r) => r.chars === 0);
const withOps = pages.filter((r) => Number.isFinite(r.imgs));
const textlessWithImg = textless.filter((r) => r.imgs > 0);
const first30 = pages.filter((r) => r.p <= 30);
const avg = (a, k) => a.length ? +(a.reduce((s, r) => s + (r[k] || 0), 0) / a.length).toFixed(1) : null;
const summary = {
  file: path.basename(file),
  numPages: N, range: [from, to],
  textless: textless.length,
  textlessFirst30: first30.filter((r) => r.chars === 0).length,
  first30Pages: first30.length,
  opsPages: withOps.length,
  textlessWithImg: textlessWithImg.length,
  textlessNoImg: textless.filter((r) => r.imgs === 0).length,
  avgTextMs: avg(pages, 'tText'),
  avgOpsMs: avg(withOps, 'tOps'),
  dpi: [...new Set(withOps.map((r) => r.dpiX).filter(Boolean))].sort((a, b) => a - b).slice(0, 12),
  imgsPerPage: [...new Set(withOps.map((r) => r.imgs))].sort((a, b) => a - b),
  totalMs: Date.now() - t00
};
if (doLayout) {
  const L = pages.filter((r) => r.layout);
  summary.layout = L.map((r) => ({ p: r.p, chars: r.chars, ...r.layout }));
}
console.log(JSON.stringify(summary, null, 1));
const jf = opt('--json', null);
if (jf) fs.writeFileSync(jf, JSON.stringify({ summary, pages }, null, 1));
await doc.destroy();
