#!/usr/bin/env node
/* ============================================================
   MedReader — PDF 특성 측정 도구 (spec 2-4)

   새 PDF 를 받으면 **추측하기 전에 먼저 잰다.** 출력은 사람이 읽는 요약과
   `BOOK_PROFILE` 초안이다.

     node apps/medreader/dev/profile.mjs <pdf> [옵션]
       --pages N       앞에서 N쪽만 (기본: 전체)
       --stride N      N쪽마다 하나씩 (빠른 훑기)
       --json <path>   BOOK_PROFILE 초안을 JS 모듈로 저장
       --samples       진단용 짧은 예시 문자열 포함 (기본 off, 40자 이하)
       --pdfjs <path>  pdfjs-dist 위치 (환경변수 MEDREADER_PDFJS 도 가능)
       --quiet         진행 표시 끄기

   이 파일은 **Node 전용**이며 앱 본체는 import 하지 않는다.
   js/ 아래 모듈은 읽기만 한다(수정 금지). 집계는 profile-lib.mjs 의 순수 함수다.
   원서 문장을 출력하지 않는다 — 패턴·빈도·수치만 낸다.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildPageLayout, algoVersion } from '../js/text/layout.js';
import { LAYOUT, PDF_TEXT_CONTENT_OPTIONS } from '../js/config.js';
import { createAcc, addPage, finalize, formatReport, renderBookProfile, slimLayout, jsonBytes } from './profile-lib.mjs';

/* ────────────────────────────────────────────────────────
   인자 파싱
   ──────────────────────────────────────────────────────── */

const USAGE = [
  '사용법: node apps/medreader/dev/profile.mjs <pdf 경로> [옵션]',
  '',
  '  --pages N       앞에서 N쪽만 측정 (기본: 전체)',
  '  --stride N      N쪽마다 하나씩 측정 (기본: 1)',
  '  --json <path>   BOOK_PROFILE 초안을 JS 모듈로 저장',
  '  --samples       진단용 예시 문자열 포함 (40자 이하로 자른다)',
  '  --pdfjs <path>  pdfjs-dist 설치 위치 (환경변수 MEDREADER_PDFJS 도 가능)',
  '  --quiet         진행 표시 끄기',
  ''
].join('\n');

function parseArgs(argv) {
  const out = { pdf: null, pages: null, stride: 1, json: null, samples: false, pdfjs: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    else if (a === '--samples') out.samples = true;
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--pages') out.pages = Number(argv[++i]);
    else if (a === '--stride') out.stride = Number(argv[++i]);
    else if (a === '--json') out.json = argv[++i];
    else if (a === '--pdfjs') out.pdfjs = argv[++i];
    else if (a.startsWith('--')) return { error: '알 수 없는 옵션: ' + a };
    else if (out.pdf == null) out.pdf = a;
    else return { error: '인자가 너무 많다: ' + a };
  }
  if (!out.pdf) return { error: 'PDF 경로가 없다.' };
  if (out.pages != null && !(Number.isFinite(out.pages) && out.pages > 0)) return { error: '--pages 는 1 이상의 수여야 한다.' };
  if (!(Number.isFinite(out.stride) && out.stride >= 1)) return { error: '--stride 는 1 이상의 수여야 한다.' };
  out.stride = Math.floor(out.stride);
  return out;
}

// 로컬 날짜 YYYY-MM-DD (toISOString 은 UTC 라 하루가 밀린다)
function localDate(d = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

function fail(msg, code = 1) {
  process.stderr.write('\n[오류] ' + msg + '\n');
  process.exit(code);
}

/* ────────────────────────────────────────────────────────
   pdf.js 찾기 — 레포에 node_modules 를 만들지 않는다.
   경로는 하드코딩하지 않고 인자·환경변수·기본 해석 순서로 찾는다.
   ──────────────────────────────────────────────────────── */

const PDFJS_HELP = [
  'pdfjs-dist(legacy 빌드)를 찾지 못했다. 레포 안에 설치하지 마라 — 레포에는',
  'node_modules·package.json 을 두지 않는다(spec 2-4, Build 지침).',
  '',
  '작업용 임시 폴더에 설치하고 그 위치를 알려주면 된다:',
  '',
  '  mkdir -p /tmp/medreader-tools && cd /tmp/medreader-tools',
  '  npm install pdfjs-dist@5.4.149',
  '  node <repo>/apps/medreader/dev/profile.mjs <pdf> --pdfjs /tmp/medreader-tools',
  '',
  '또는 환경변수로:',
  '  MEDREADER_PDFJS=/tmp/medreader-tools node .../profile.mjs <pdf>',
  '',
  '--pdfjs 에는 다음 중 아무 것이나 줄 수 있다:',
  '  · pdf.mjs 파일 경로',
  '  · pdfjs-dist 패키지 폴더',
  '  · node_modules 를 품은 폴더'
].join('\n');

function pdfjsCandidates(hint) {
  const out = [];
  if (hint) {
    const h = path.resolve(hint);
    out.push(h);
    out.push(path.join(h, 'legacy', 'build', 'pdf.mjs'));
    out.push(path.join(h, 'build', 'pdf.mjs'));
    out.push(path.join(h, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    out.push(path.join(h, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
  }
  return out;
}

async function loadPdfjs(hint) {
  const tried = [];
  for (const c of pdfjsCandidates(hint)) {
    tried.push(c);
    if (!c.endsWith('.mjs') && !c.endsWith('.js')) continue;
    if (!fs.existsSync(c)) continue;
    return { mod: await import(pathToFileURL(c).href), from: c };
  }
  // 마지막 시도: 일반 해석(전역 설치·NODE_PATH·상위 node_modules)
  try {
    return { mod: await import('pdfjs-dist/legacy/build/pdf.mjs'), from: 'pdfjs-dist/legacy/build/pdf.mjs (module resolution)' };
  } catch (e) {
    const detail = tried.length ? '\n\n시도한 경로:\n  ' + tried.join('\n  ') : '';
    fail(PDFJS_HELP + detail, 3);
  }
}

/* ────────────────────────────────────────────────────────
   본체
   ──────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(USAGE); return; }
  if (args.error) { process.stderr.write('\n[오류] ' + args.error + '\n\n' + USAGE); process.exit(2); }

  const pdfPath = path.resolve(args.pdf);
  if (!fs.existsSync(pdfPath)) fail('PDF 파일이 없다: ' + pdfPath, 2);
  const st = fs.statSync(pdfPath);
  if (!st.isFile()) fail('파일이 아니다: ' + pdfPath, 2);
  if (st.size === 0) fail('빈 파일이다: ' + pdfPath, 2);

  const hint = args.pdfjs || process.env.MEDREADER_PDFJS || null;
  const loaded = await loadPdfjs(hint);
  const pdfjs = loaded.mod;

  const progress = (msg) => { if (!args.quiet) process.stderr.write(msg); };
  progress('pdf.js  : ' + loaded.from + '\n');
  progress('PDF     : ' + pdfPath + ' (' + (st.size / 1048576).toFixed(1) + 'MB)\n');

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(fs.readFileSync(pdfPath)),
      verbosity: 0,
      isEvalSupported: false
    }).promise;
  } catch (e) {
    fail('PDF 를 열 수 없다 (손상되었거나 PDF 가 아니다): ' + (e && e.message ? e.message : String(e)), 4);
  }

  const total = doc.numPages;
  const lastPage = args.pages ? Math.min(total, Math.floor(args.pages)) : total;
  const plan = [];
  for (let n = 1; n <= lastPage; n += args.stride) plan.push(n);

  const acc = createAcc({ docPages: total, params: LAYOUT, pages: args.pages, stride: args.stride, samples: args.samples });

  let interrupted = false;
  const onSig = () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    progress('\n[중단 요청] 지금까지의 집계를 출력한다…\n');
  };
  process.on('SIGINT', onSig);
  process.on('SIGTERM', onSig);

  const t0 = Date.now();
  let prevSlim = null;
  const failedPages = [];

  for (let i = 0; i < plan.length && !interrupted; i++) {
    const n = plan[i];
    try {
      const page = await doc.getPage(n);
      try {
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent(PDF_TEXT_CONTENT_OPTIONS);
        const neighbor = (prevSlim && prevSlim.pageNo === n - 1) ? [prevSlim] : [];
        const t = Date.now();
        const layout = buildPageLayout(tc.items, {
          pageNo: n, width: vp.width, height: vp.height,
          styles: tc.styles || {}, neighborLayouts: neighbor
        });
        const ms = Date.now() - t;
        const slim = slimLayout(layout);
        addPage(acc, layout, {
          itemCount: tc.items.length,
          ms: ms,
          bytes: jsonBytes(slim),
          itemBytes: jsonBytes(layout),
          bytesLines: jsonBytes(slim.lines),
          bytesParagraphs: jsonBytes(slim.paragraphs),
          bytesRegions: jsonBytes(slim.regions)
        });
        prevSlim = args.stride === 1 ? slim : null;
      } finally {
        page.cleanup();                       // 7000쪽에서 메모리가 터지지 않게 반드시 호출
      }
    } catch (e) {
      failedPages.push(n);
      if (failedPages.length <= 5) progress('\n[쪽 실패] p' + n + ': ' + (e && e.message ? e.message : String(e)) + '\n');
    }

    if (!args.quiet && (i % 25 === 0 || i === plan.length - 1)) {
      const done = i + 1;
      const el = (Date.now() - t0) / 1000;
      const eta = done > 0 ? (el / done) * (plan.length - done) : 0;
      const line = '  측정 ' + done + '/' + plan.length + ' 쪽  (' + el.toFixed(0) + 's 경과, 남은 ' + eta.toFixed(0) + 's)';
      if (process.stderr.isTTY) process.stderr.write('\r' + line + '   ');
      else process.stderr.write(line + '\n');
    }
  }
  if (!args.quiet && process.stderr.isTTY) process.stderr.write('\n');

  try { await doc.destroy(); } catch (e) { /* 무시 */ }

  const summary = finalize(acc);
  const meta = {
    file: path.basename(pdfPath),
    algoVersion: algoVersion,
    interrupted: interrupted,
    now: localDate()
  };

  process.stdout.write(formatReport(summary, meta) + '\n');
  if (failedPages.length) {
    process.stdout.write('  [쪽 실패] ' + failedPages.length + '쪽: ' +
      JSON.stringify(failedPages.slice(0, 20)) + (failedPages.length > 20 ? ' …' : '') + '\n\n');
  }
  process.stdout.write('  총 소요 ' + ((Date.now() - t0) / 1000).toFixed(1) + '초 (PDF 파싱 포함)\n');

  if (args.json) {
    const outPath = path.resolve(args.json);
    const src = renderBookProfile(summary, meta);
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, src, 'utf8');
      process.stdout.write('  BOOK_PROFILE 초안 → ' + outPath + '\n');
    } catch (e) {
      fail('--json 저장 실패: ' + (e && e.message ? e.message : String(e)), 5);
    }
  }

  process.exit(interrupted ? 130 : 0);
}

main().catch(function (e) {
  fail((e && e.stack) ? e.stack : String(e), 1);
});
