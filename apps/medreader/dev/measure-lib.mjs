/* ============================================================
   MedReader — 측정 스크립트 공용 도우미 (Node 전용)

   측정 스크립트는 레포에 둔다. 2026-10-10 에 스크래치패드(임시 폴더)에 두었던
   스크립트와 pdf.js 설치본이 정리로 사라졌다 — 결과 수치만 인계 문서에 남아 있었다.

   pdf.js 는 레포에 넣지 않는다(node_modules 금지). 한 번 설치하고 위치를 알려 준다:
     npm install --prefix <아무 폴더> pdfjs-dist@5.4.149
     MEDREADER_PDFJS=<그 폴더> node apps/medreader/dev/<스크립트>.mjs <pdf> …
   (앱과 같은 고정 버전. Node 에서는 legacy 빌드를 쓴다 — 일반 빌드는 DOMMatrix 없이 죽는다.)

   js/ 아래 모듈은 읽기만 한다. 원서 문장을 길게 출력하지 않는다(진단용 40자 이하).
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildPageLayout } from '../js/text/layout.js';
import { unrotatedPageSize } from '../js/pdf/extract.js';
import { buildUnits } from '../js/tts/text.js';

/** `--pdfjs <path>` 또는 `MEDREADER_PDFJS` — 폴더(그 아래 node_modules) 또는 pdf.mjs 경로. */
export async function loadPdfjs(argv) {
  const i = argv.indexOf('--pdfjs');
  const hint = (i >= 0 ? argv[i + 1] : null) || process.env.MEDREADER_PDFJS || '';
  const cands = [];
  if (hint) {
    if (hint.endsWith('.mjs')) cands.push(hint);
    cands.push(path.join(hint, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    cands.push(path.join(hint, 'legacy', 'build', 'pdf.mjs'));
  }
  for (const c of cands) if (fs.existsSync(c)) return import(pathToFileURL(c).href);
  try { return await import('pdfjs-dist/legacy/build/pdf.mjs'); } catch (e) { /* 아래 안내 */ }
  console.error('pdf.js 를 찾지 못했다. 위 주석의 설치 명령을 보고 MEDREADER_PDFJS 를 지정하라.\n시도: ' + cands.join(', '));
  process.exit(3);
}

/** 위치 인자만(옵션과 그 값을 뺀다). */
export function positional(argv) {
  const out = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { i++; continue; }
    out.push(argv[i]);
  }
  return out;
}

/** 한 쪽 → 앱과 같은 레이아웃. 반환: `{ L, tc, size }`. */
export async function pageLayout(doc, p) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const size = unrotatedPageSize(page.view, vp.width, vp.height);
  const L = buildPageLayout(tc.items, { pageNo: p, styles: tc.styles, width: size.width, height: size.height });
  page.cleanup();
  return { L, tc, size };
}

/** 레이아웃 → 앱의 낭독 단위(`buildUnits`, 문장). 리더의 flowParas 와 같은 모양으로 넘긴다. */
export function sentenceUnits(L) {
  const byId = new Map(L.lines.map((l) => [l.id, l]));
  const paras = L.paragraphs.map((pa) => ({
    id: pa.id, kind: pa.kind,
    lines: pa.lineIds.map((id) => byId.get(id)).filter(Boolean)
      .map((l) => ({ id: l.id, text: l.text, hyphen: l.hyphenJoin ? 'hidden' : 'none' }))
  }));
  return buildUnits(paras, 'sentence');
}
