/* ============================================================
   tests/manifest-8j.test.mjs — `[8j]` 홈 화면 설치 + `[8k-0]` 목소리 진단 페이지
   (spec 19-1-1 3절 8j·8k-0 줄 · 8j 수용 기준 `[N]` · 19-1-2 3절 6 · 2-3)

   ★ 이 파일이 막는 것
     (a) manifest 가 JSON 으로 안 읽히거나 필수 필드가 빠지는 일 — 설치가 "바로가기"로만 된다
     (b) `orientation` 이 들어가는 일 — 8e 가로 읽기를 막는다
     (c) `start_url`·`scope` 가 앱 폴더 밖 — 홈 화면에서 연 앱이 다른 경로가 된다
     (d) manifest 의 아이콘 크기와 PNG 실제 크기(IHDR)가 다른 일 · SVG 와 PNG 의 그림이 다른 일
     (e) maskable 아이콘의 그림이 안전 영역(지름 80% 원) 밖으로 나가는 일
     (f) index.html 링크가 빠지거나, stamp-importmap 구간 안에 들어가 도장에 지워지는 일
     (g) 진단 페이지가 외부 자원·앱 저장소를 만지거나 앱 규칙을 베끼는 일(앱 모듈을 읽기만 한다)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { svgOf, rasterize, pngHeader, colorAt, PNGS, VIEW, PNG_SIG } from '../dev/make-icons.mjs';
import { findRegion } from '../dev/stamp-importmap.mjs';

const APP = fileURLToPath(new URL('..', import.meta.url));
const MANIFEST_TEXT = readFileSync(join(APP, 'manifest.webmanifest'), 'utf8');
const HTML = readFileSync(join(APP, 'index.html'), 'utf8');
const TOKENS = readFileSync(join(APP, 'css', 'tokens.css'), 'utf8');
const VOICES_HTML = readFileSync(join(APP, 'dev', 'voices.html'), 'utf8');
const RUN_ICONS = '`node apps/medreader/dev/make-icons.mjs` 를 돌려라';

/** 배포 주소 꼴(GitHub Pages) — 상대 URL 을 여기서 푼다. */
const MANIFEST_URL = 'https://example.github.io/my-blog/apps/medreader/manifest.webmanifest';
const APP_URL = 'https://example.github.io/my-blog/apps/medreader/';

function manifest() { return JSON.parse(MANIFEST_TEXT); }

/** tokens.css 에서 `sel {` 블록 안의 첫 `--name: #xxxxxx`. sel 이 null 이면 파일의 첫 값(= 라이트 기본 테마 :root). */
function tokenColor(name, sel) {
  let text = TOKENS;
  if (sel) {
    const i = TOKENS.indexOf(sel + ' {');
    assert.ok(i >= 0, 'tokens.css 에 ' + sel + ' 블록이 없다');
    text = TOKENS.slice(i, TOKENS.indexOf('}', i));
  }
  const m = text.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  assert.ok(m, 'tokens.css 에 --' + name + ' 이 없다');
  return m[1].toLowerCase();
}

/** 우리 PNG(필터 0)를 RGBA 로 푼다. */
function decodePng(buf) {
  assert.ok(buf.subarray(0, 8).equals(PNG_SIG), 'PNG 서명');
  let off = 8, w = 0, h = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.equal(data[8], 8); assert.equal(data[9], 6); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, h * (w * 4 + 1));
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    assert.equal(raw[y * (w * 4 + 1)], 0, '줄 필터는 0 이어야 한다(생성기가 그렇게 쓴다)');
    px.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  }
  return { w, h, px };
}

/* ── (a)(b)(c) manifest ─────────────────────────────── */

test('MF1 ★ manifest 가 JSON 으로 읽히고 필수 필드가 spec 8j 줄 그대로다', () => {
  const m = manifest();
  assert.equal(m.name, 'MedReader');
  assert.equal(m.short_name, 'MedReader');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.ok(Array.isArray(m.icons) && m.icons.length > 0, 'icons');
});

test('MF2 ★ orientation 이 없다 — 8e 가로 읽기를 막지 않는다 · 서비스 워커도 없다([P2])', () => {
  const m = manifest();
  assert.ok(!Object.prototype.hasOwnProperty.call(m, 'orientation'), 'manifest 에 orientation 이 있다 — 방향을 고정하면 8e 가 막힌다');
  assert.ok(!/"orientation"/.test(MANIFEST_TEXT));
  assert.ok(!Object.prototype.hasOwnProperty.call(m, 'serviceworker'));
  // 앱 코드에 서비스 워커 등록이 없다(manifest 만 — 8j 는 JS 0줄).
  const hits = [];
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.js') && /serviceWorker\s*\.\s*register/.test(readFileSync(p, 'utf8'))) hits.push(p);
    }
  })(join(APP, 'js'));
  assert.deepEqual(hits, []);
  assert.ok(!/serviceWorker\s*\.\s*register/.test(HTML));
});

test('MF3 ★ start_url·scope 가 앱 폴더 안 — 서재(IndexedDB)는 같은 출처라 그대로다', () => {
  const m = manifest();
  const start = new URL(m.start_url, MANIFEST_URL).href;
  const scope = new URL(m.scope, MANIFEST_URL).href;
  assert.equal(start, APP_URL, 'start_url 은 앱 폴더(= index.html 이 나오는 곳)');
  assert.equal(scope, APP_URL, 'scope 는 앱 폴더');
  assert.ok(start.indexOf(scope) === 0, 'start_url 이 scope 안');
  assert.equal(new URL(start).origin, new URL(MANIFEST_URL).origin, '같은 출처 — IndexedDB 는 출처마다 하나다');
  // 상대 경로만 — 절대 경로(`/…`)·외부 주소는 배포 경로(/my-blog/)가 바뀌면 깨진다.
  for (const k of ['start_url', 'scope']) assert.ok(!/^(\/|[a-z]+:)/i.test(m[k]), k + ' 는 상대 경로');
});

test('MF4 색은 tokens.css 기본(라이트) 테마 — 바탕 = --c-bg, 테마 = 상단 바 --c-surface', () => {
  const m = manifest();
  assert.equal(m.background_color.toLowerCase(), tokenColor('c-bg'));
  assert.equal(m.theme_color.toLowerCase(), tokenColor('c-surface'));
});

/* ── (d)(e) 아이콘 ─────────────────────────────────── */

test('MF5 ★ 아이콘 — 파일이 있고, PNG 의 IHDR 크기가 manifest sizes 와 같다 · SVG 1 + PNG 192·512 (any·maskable)', () => {
  const m = manifest();
  const seen = new Set();
  for (const ic of m.icons) {
    assert.ok(!/^(\/|[a-z]+:)/i.test(ic.src), '아이콘은 상대 경로: ' + ic.src);
    const f = join(APP, ic.src);
    assert.ok(existsSync(f), '아이콘 파일이 없다: ' + ic.src + ' — ' + RUN_ICONS);
    const purposes = String(ic.purpose || 'any').split(/\s+/);
    if (ic.type === 'image/svg+xml') {
      assert.equal(ic.sizes, 'any');
      assert.ok(/\.svg$/.test(ic.src));
      assert.ok(/^<svg\b/.test(readFileSync(f, 'utf8')));
      for (const p of purposes) seen.add('svg:' + p);
      continue;
    }
    assert.equal(ic.type, 'image/png', ic.src);
    const mm = /^(\d+)x(\d+)$/.exec(ic.sizes);
    assert.ok(mm, 'sizes 꼴: ' + ic.sizes);
    const hd = pngHeader(readFileSync(f));
    assert.equal(hd.width + 'x' + hd.height, ic.sizes, ic.src + ' 의 실제 크기(IHDR)가 manifest sizes 와 다르다');
    for (const p of purposes) seen.add(ic.sizes + ':' + p);
  }
  for (const want of ['svg:any', '192x192:any', '512x512:any', '192x192:maskable', '512x512:maskable']) {
    assert.ok(seen.has(want), '빠진 아이콘: ' + want);
  }
});

test('MF6 ★ SVG 와 PNG 가 같은 도안이다 — 파일 = dev/make-icons.mjs 의 결과(SVG 글자 · PNG 픽셀)', () => {
  const svg = readFileSync(join(APP, 'icons', 'icon.svg'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(svg, svgOf(), 'icon.svg 가 도안과 다르다 — ' + RUN_ICONS);
  for (const p of PNGS) {
    const got = decodePng(readFileSync(join(APP, 'icons', p.file)));
    assert.equal(got.w, p.size);
    assert.equal(got.h, p.size);
    const want = rasterize(p.size, p.maskable);
    assert.ok(Buffer.from(got.px).equals(Buffer.from(want)), p.file + ' 픽셀이 도안과 다르다 — ' + RUN_ICONS);
  }
  // manifest 가 가리키는 PNG 가 생성기가 만드는 것과 같은 목록이다.
  const listed = manifest().icons.filter((i) => i.type === 'image/png').map((i) => i.src).sort();
  assert.deepEqual(listed, PNGS.map((p) => 'icons/' + p.file).sort());
  for (const p of PNGS) {
    const ic = manifest().icons.find((i) => i.src === 'icons/' + p.file);
    assert.equal(ic.purpose, p.maskable ? 'maskable' : 'any', p.file);
  }
});

test('MF7 ★ maskable — 바탕이 칸 끝까지 차 있고, 그림(바탕이 아닌 것)은 전부 안전 영역(반지름 40%) 안', () => {
  const bg = colorAt(1, 1, true);
  assert.ok(bg, '모서리가 투명하면 안 된다(OS 가 모양을 자른다)');
  for (const [x, y] of [[0.5, 0.5], [VIEW - 0.5, 0.5], [0.5, VIEW - 0.5], [VIEW - 0.5, VIEW - 0.5]]) assert.equal(colorAt(x, y, true), bg);
  const c = VIEW / 2, R = 0.4 * VIEW;
  let content = 0, maxD = 0;
  for (let y = 0.5; y < VIEW; y += 1) {
    for (let x = 0.5; x < VIEW; x += 1) {
      if (colorAt(x, y, true) === bg) continue;
      content++;
      const d = Math.hypot(x - c, y - c);
      if (d > maxD) maxD = d;
    }
  }
  assert.ok(content > 1000, '그림이 있어야 한다');
  assert.ok(maxD <= R, '그림이 안전 영역 밖까지 나간다: ' + maxD.toFixed(1) + ' > ' + R);
  // 512 PNG 의 네 모서리 픽셀도 불투명
  const png = decodePng(readFileSync(join(APP, 'icons', 'icon-maskable-512.png')));
  for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) assert.equal(png.px[(y * 512 + x) * 4 + 3], 255);
});

/* ── (f) index.html ─────────────────────────────────── */

test('MF8 ★ index.html — manifest 링크 1개, stamp-importmap 구간 밖, 아이콘·theme-color 링크가 있는 파일을 가리킨다', () => {
  const links = HTML.match(/<link\b[^>]*rel="manifest"[^>]*>/g) || [];
  assert.equal(links.length, 1, 'manifest 링크는 정확히 하나');
  assert.ok(/href="manifest\.webmanifest"/.test(links[0]), links[0]);
  const head = HTML.slice(0, HTML.indexOf('</head>'));
  assert.ok(head.indexOf(links[0]) >= 0, 'manifest 링크는 <head> 안');
  const region = findRegion(HTML).body;
  for (const s of ['manifest', 'theme-color', 'rel="icon"', 'apple-touch-icon']) {
    assert.ok(region.indexOf(s) < 0, s + ' 가 stamp-importmap 구간 안에 있다 — 도장이 지운다');
  }
  const icons = [...head.matchAll(/<link\b[^>]*rel="(icon|apple-touch-icon)"[^>]*>/g)].map((m) => m[0]);
  assert.ok(icons.some((l) => /rel="icon"/.test(l)), 'favicon 링크');
  assert.ok(icons.some((l) => /rel="apple-touch-icon"/.test(l)), 'apple-touch-icon 링크');
  for (const l of icons.concat(links)) {
    const href = (l.match(/href="([^"]+)"/) || [])[1];
    assert.ok(href && !/^(\/|[a-z]+:)/i.test(href), '외부·절대 주소 금지: ' + l);
    assert.ok(existsSync(join(APP, href)), '없는 파일을 가리킨다: ' + href);
  }
  const metas = head.match(/<meta\b[^>]*name="theme-color"[^>]*>/g) || [];
  assert.ok(metas.length >= 1, 'theme-color meta');
  const light = metas.find((x) => /prefers-color-scheme: light/.test(x)) || metas.find((x) => !/media=/.test(x));
  assert.ok(light && light.indexOf(tokenColor('c-surface')) >= 0, '라이트 theme-color = --c-surface');
  const dark = metas.find((x) => /prefers-color-scheme: dark/.test(x));
  if (dark) assert.ok(dark.indexOf(tokenColor('c-surface', ':root[data-theme="dark"]')) >= 0, '다크 theme-color = 다크 --c-surface');
});

/* ── (g) 8k-0 진단 페이지 ──────────────────────────── */

test('MF9 ★ dev/voices.html — 언어마다 [앱이 고른 음성]·[voice 없이 xx]·[voice 없이 xx-YY], 영어 en-US·en-GB, 이어 말하기, 복사', () => {
  const tags = { ar: ['ar', 'ar-SA'], en: ['en', 'en-US', 'en-GB'], fr: ['fr', 'fr-FR'], ko: ['ko', 'ko-KR'] };
  for (const k of Object.keys(tags)) {
    assert.ok(VOICES_HTML.indexOf('data-say="app" data-lang="' + k + '"') >= 0, '[앱이 고른 음성 ' + k + ']');
    for (const t of tags[k]) assert.ok(VOICES_HTML.indexOf('data-say="tag" data-lang="' + k + '" data-tag="' + t + '"') >= 0, '[voice 없이 ' + t + ']');
  }
  assert.ok(/data-chain="en-ko-en"/.test(VOICES_HTML), '[en → ko → en 이어 말하기]');
  assert.ok(/onend[\s\S]*step\(i \+ 1\)/.test(VOICES_HTML), '이어 말하기는 앞 발화의 onend 에서 다음을 speak 한다(앱과 같은 꼴)');
  assert.ok(/id="copy"/.test(VOICES_HTML), '[결과 복사]');
  for (const f of ['name', 'lang', 'localService', 'default']) assert.ok(VOICES_HTML.indexOf('<th>' + f + '</th>') >= 0, '음성 표의 ' + f + ' 칸');
});

test('MF10 ★ dev/voices.html — 앱 규칙을 베끼지 않고 앱 모듈을 읽기만 한다 · 외부 자원 0 · 앱 저장소를 만지지 않는다', () => {
  const imports = [...VOICES_HTML.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['../js/tts/voices.js'], '동적 import 는 앱의 voices.js 하나');
  assert.ok(/app\.pickVoice\(/.test(VOICES_HTML), '[앱이 고른 음성] 은 앱의 pickVoice 를 부른다');
  const voicesSrc = readFileSync(join(APP, 'js', 'tts', 'voices.js'), 'utf8');
  for (const name of ['pickVoice', 'utteranceLang', 'speechLang']) {
    assert.ok(new RegExp('export function ' + name + '\\b').test(voicesSrc), 'voices.js 에 ' + name + ' 이 없다 — 진단 페이지가 깨진다');
  }
  // 외부 자원·네트워크·저장소 0
  assert.ok(!/<script\b[^>]*\bsrc=/.test(VOICES_HTML), '<script src> 없음');
  const vlinks = VOICES_HTML.match(/<link\b[^>]*>/g) || [];
  assert.deepEqual(vlinks, ['<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">'], '<link> 는 앱 아이콘(루트 favicon.ico 404 막기) 하나뿐');
  assert.ok(!/(src|href)=["']?(https?:)?\/\//i.test(VOICES_HTML), '외부 주소 없음');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'indexedDB', 'localStorage', 'sessionStorage', 'sendBeacon', 'WebSocket']) {
    assert.ok(VOICES_HTML.indexOf(bad) < 0, bad + ' 를 쓰면 안 된다');
  }
});
