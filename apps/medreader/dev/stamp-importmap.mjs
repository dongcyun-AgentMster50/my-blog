#!/usr/bin/env node
/* ============================================================
   MedReader — import map · CSS 판 번호 찍기 (배포 안전장치)

     node apps/medreader/dev/stamp-importmap.mjs          ← 매 커밋 전에 한 번
     node apps/medreader/dev/stamp-importmap.mjs --check  ← 고치지 않고 어긋났는지만 (어긋나면 종료 코드 1)

   ── 왜 ────────────────────────────────────────────────
   GitHub Pages 는 파일마다 `Cache-Control: max-age=600` 을 준다. 배포 직후에는
   새 index.html · 옛 모듈 · 새 모듈이 한 화면에 섞일 수 있다(review.md PR-6:
   빈 화면, 원본 뷰만 빔, **섞인 규칙의 재추출이 새 algoVersion 으로 굳음**).

   그래서 `index.html` 의 import map 이 **모든 앱 모듈**을 내용 해시가 붙은 URL 로
   돌린다 — `"./js/db.js": "./js/db.js?v=1a2b3c4d5e"`. 모듈 안의 상대 import
   (`'../db.js'`)는 절대 URL 로 풀린 뒤 이 표의 키(역시 절대 URL 로 정규화됨)에
   걸리므로 **모든 모듈 요청이 해시 URL** 이 된다. index.html 한 장이 배포 단위다.
   CSS `<link>` 도 같은 해시를 붙인다(옛 CSS + 새 JS 혼합도 막는다).

   바뀌지 않은 파일은 해시도 같아 브라우저 캐시를 그대로 쓴다.

   ── 이 스크립트가 하는 일 ──────────────────────────────
   `js/` 아래 모든 `.js` · `css/*.css` 의 SHA-256 앞 10자를 재서 index.html 의
   `<!-- stamp-importmap:begin -->` ~ `<!-- stamp-importmap:end -->` 구간**만**
   다시 쓴다. 구간 밖은 한 글자도 건드리지 않는다.
   · 해시는 줄바꿈을 LF 로 맞춘 내용으로 잰다 — 저장소는 LF 로 저장하고
     (`.gitattributes eol=lf`) Pages 는 저장소 내용을 그대로 내보낸다. CRLF 로
     체크아웃된 기계에서 돌려도 같은 해시가 나와야 테스트가 기계마다 갈리지 않는다.
   · CSS 순서는 **지금 구간에 적힌 순서**를 지킨다(덮어쓰기 순서가 곧 캐스케이드다).
     새 CSS 파일은 끝에 붙고, 사라진 파일은 빠진다.
   · `tests/` · `dev/` 는 앱 모듈이 아니므로 표에 넣지 않는다(`js/` 아래만 본다).

   `tests/importmap.test.mjs` 가 이 표가 지금 파일과 맞는지 따로 잰다 —
   이것을 돌리지 않은 커밋은 테스트에서 걸린다.
   ============================================================ */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BEGIN = '<!-- stamp-importmap:begin';
export const END = '<!-- stamp-importmap:end -->';
export const HASH_LEN = 10;

/** 앱 폴더(`apps/medreader`) — 이 파일의 한 단계 위. */
export const APP_DIR = fileURLToPath(new URL('..', import.meta.url));

/** 줄바꿈을 LF 로 맞춘 내용의 SHA-256 앞 10자. */
export function hashOf(buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex').slice(0, HASH_LEN);
}

function walk(dir, ext, out) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** `js/**\/*.js` → [{path:'js/db.js', hash}] (경로는 `/` 구분, 정렬). */
export function listModules(appDir = APP_DIR) {
  return walk(join(appDir, 'js'), '.js', []).map((p) => ({
    path: relative(appDir, p).split(sep).join('/'),
    hash: hashOf(readFileSync(p))
  })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** `css/*.css` (한 단계) → [{path:'css/base.css', hash}] (이름순 — 순서는 `stamp` 가 정한다). */
export function listCss(appDir = APP_DIR) {
  const dir = join(appDir, 'css');
  return readdirSync(dir).filter((n) => n.endsWith('.css')).sort().map((n) => ({
    path: 'css/' + n,
    hash: hashOf(readFileSync(join(dir, n)))
  }));
}

/** 구간 안의 CSS `<link>` 가 적힌 순서(쿼리 뗀 경로). */
export function cssOrderIn(region) {
  const out = [];
  const re = /<link\s+rel="stylesheet"\s+href="([^"?]+)(?:\?[^"]*)?"\s*>/g;
  let m;
  while ((m = re.exec(region))) out.push(m[1]);
  return out;
}

/** html 에서 표지 구간을 찾는다. 없거나 둘 이상이면 던진다. */
export function findRegion(html) {
  const b = html.indexOf(BEGIN);
  const e = html.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error('index.html 에 ' + BEGIN + ' … ' + END + ' 구간이 없다');
  if (html.indexOf(BEGIN, b + 1) >= 0 || html.indexOf(END, e + 1) >= 0) throw new Error('표지 구간이 둘 이상이다');
  const lineStart = html.lastIndexOf('\n', b) + 1;
  return { start: lineStart, end: e + END.length, indent: html.slice(lineStart, b), body: html.slice(b, e + END.length) };
}

/**
 * 구간 글자를 만든다. 순수 함수 — 테스트가 "지금 index.html 이 이 함수의 결과와 같다"를 본다.
 * @param {Array<{path,hash}>} modules
 * @param {Array<{path,hash}>} css     이미 원하는 순서
 * @param {string} indent
 * @param {string} eol     줄바꿈 — 파일이 쓰던 것(`stamp` 가 구간에서 읽는다). 기본 LF
 */
export function renderRegion(modules, css, indent = '', eol = '\n') {
  const L = [];
  L.push(BEGIN + ' — dev/stamp-importmap.mjs 가 다시 쓰는 구간. 손으로 고치지 않는다. -->');
  for (const c of css) L.push('<link rel="stylesheet" href="' + c.path + '?v=' + c.hash + '">');
  L.push('<script type="importmap">');
  L.push('{');
  L.push('  "imports": {');
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    L.push('    "./' + m.path + '": "./' + m.path + '?v=' + m.hash + '"' + (i < modules.length - 1 ? ',' : ''));
  }
  L.push('  }');
  L.push('}');
  L.push('</script>');
  L.push(END);
  return L.map((l) => indent + l).join(eol);
}

/**
 * index.html 전체를 받아 구간만 갈아 끼운 새 글자를 돌려준다.
 * @returns {{html:string, changed:boolean, cssOrder:string[]}}
 */
export function stamp(html, modules, cssFiles) {
  const r = findRegion(html);
  const byPath = new Map(cssFiles.map((c) => [c.path, c]));
  const order = [];
  for (const p of cssOrderIn(r.body)) if (byPath.has(p) && order.indexOf(p) < 0) order.push(p);
  for (const c of cssFiles) if (order.indexOf(c.path) < 0) order.push(c.path);
  // `[Review]` 파일의 줄바꿈을 따른다. CRLF 파일에 LF 구간을 박으면 줄바꿈이 섞이고, 해시가 같아도
  // `--check`·IM6 이 "다르다"로 빨갛게 된다(CRLF 로 저장한 index.html 로 실측). 판정은 구간 바로 앞 줄끝.
  const eol = html.slice(0, r.start).endsWith('\r\n') ? '\r\n' : '\n';
  const region = renderRegion(modules, order.map((p) => byPath.get(p)), r.indent, eol);
  const next = html.slice(0, r.start) + region + html.slice(r.end);
  return { html: next, changed: next !== html, cssOrder: order };
}

/* ── 명령줄 ────────────────────────────────────────── */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const check = process.argv.includes('--check');
  const file = join(APP_DIR, 'index.html');
  const html = readFileSync(file, 'utf8');
  const modules = listModules();
  const css = listCss();
  const out = stamp(html, modules, css);
  if (!out.changed) {
    console.log('stamp-importmap: 그대로다 (모듈 ' + modules.length + '개 · CSS ' + css.length + '개)');
  } else if (check) {
    console.error('stamp-importmap: index.html 의 표가 지금 파일과 다르다 — `node apps/medreader/dev/stamp-importmap.mjs` 를 돌려라');
    process.exit(1);
  } else {
    writeFileSync(file, out.html, 'utf8');
    console.log('stamp-importmap: index.html 을 다시 썼다 (모듈 ' + modules.length + '개 · CSS ' + css.length + '개 · CSS 순서 ' + out.cssOrder.join(' → ') + ')');
  }
}
