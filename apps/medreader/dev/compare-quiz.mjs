/* ============================================================
   MedReader — 퀴즈 파서 입력 퇴보 검사 (Node 전용, spec 5-2)

   쓰임:
     MEDREADER_PDFJS=<pdfjs 폴더> node apps/medreader/dev/compare-quiz.mjs <pdf> [--base <js 폴더>] [--pages N]

   레이아웃 코드(4절)를 고친 뒤 **퀴즈 파서가 받는 입력이 바뀌는가**를 잰다.
   쪽마다 앱처럼 앞뒤 1쪽 저장본을 이웃으로 넘겨 레이아웃을 만들고, 파서는 **현재 js/ 의 것
   하나로** 돌린다(레이아웃 차이만 보이게). --base 를 주면 그 js/ 사본의 레이아웃과 나란히 낸다.

   출력: 섹션 수·문항·정답·unverified, 문단 kind 수. 원서 문장은 출력하지 않는다.
   ============================================================ */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPdfjs, positional } from './measure-lib.mjs';
import { parseSectionsWithStats } from '../js/quiz/parser.js';
import { projectPage } from '../js/quiz/engine.js';

const argv = process.argv;
function opt(name, dflt) { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; }
const [file] = positional(argv);
if (!file) { console.error('쓰임: compare-quiz.mjs <pdf> [--base <js 폴더>] [--pages N]'); process.exit(2); }

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
async function loadBuild(jsRoot) {
  const u = (p) => pathToFileURL(path.join(jsRoot, p)).href;
  const layout = await import(u('text/layout.js'));
  const store = await import(u('text/store.js'));
  const extract = await import(u('pdf/extract.js'));
  return { buildPageLayout: layout.buildPageLayout, algoVersion: layout.algoVersion, toStored: store.toStored, unrotatedPageSize: extract.unrotatedPageSize };
}
const builds = [{ name: 'cur', B: await loadBuild(path.join(here, '..', 'js')) }];
const baseDir = opt('base', null);
if (baseDir) builds.unshift({ name: 'base', B: await loadBuild(path.resolve(baseDir)) });

const pdfjs = await loadPdfjs(argv);
const doc = await pdfjs.getDocument({ url: file, verbosity: 0 }).promise;
const N = Math.min(doc.numPages, Number(opt('pages', 0)) || doc.numPages);

const texts = [];
for (let p = 1; p <= N; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  texts[p] = { items: tc.items, styles: tc.styles, view: page.view, vw: vp.width, vh: vp.height };
  page.cleanup();
}

for (const { name, B } of builds) {
  const lay = (p, nbs) => {
    const t = texts[p];
    const s = B.unrotatedPageSize(t.view, t.vw, t.vh);
    return B.buildPageLayout(t.items, { pageNo: p, width: s.width, height: s.height, styles: t.styles, neighborLayouts: nbs || [] });
  };
  const raw = [];
  for (let p = 1; p <= N; p++) { const r = B.toStored(lay(p)); r.pageNo = p; raw[p] = r; }
  const pages = [];
  const kinds = {};
  let headerLines = 0;
  for (let p = 1; p <= N; p++) {
    const nbs = [raw[p - 1], raw[p + 1]].filter(Boolean);
    const L = lay(p, nbs);
    for (const pa of L.paragraphs) kinds[pa.kind] = (kinds[pa.kind] || 0) + 1;
    for (const l of L.lines) if (l.role === 'header') headerLines++;
    pages.push(projectPage(L));
  }
  const { sections } = parseSectionsWithStats(pages, { docId: 'probe' });
  let q = 0, ans = 0, unv = 0, dup = 0, verified = 0;
  for (const s of sections) {
    q += s.stats.questions; ans += s.stats.answered; unv += s.stats.unverified; dup += s.stats.duplicates || 0;
    for (const x of s.questions) if (x.status === 'verified') verified++;
  }
  console.log(JSON.stringify({ build: name, algoVersion: B.algoVersion, pages: N, sections: sections.length, questions: q, answered: ans, verified, unverified: unv, duplicates: dup, headerLines, kinds }));
}
