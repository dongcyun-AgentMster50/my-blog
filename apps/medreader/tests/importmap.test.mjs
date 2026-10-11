/* ============================================================
   tests/importmap.test.mjs — 배포 안전장치 (배포 단위 = index.html 한 장)

   왜 있나: GitHub Pages 는 파일마다 10분 캐시한다. 옛·새 모듈이 섞이면 빈 화면이 되거나,
   더 나쁘게는 섞인 규칙의 재추출이 새 algoVersion 으로 굳는다(review.md PR-6).
   그래서 index.html 의 import map 이 모든 앱 모듈을 **내용 해시 URL** 로 돌린다.

   ★ 이 테스트가 지키는 것 — **표를 갱신하지 않은 커밋은 여기서 걸린다.**
     (a) 표가 `js/` 아래 모든 모듈을 빠짐없이 덮는다(남는 키도 없다)
     (b) 각 해시가 지금 파일 내용과 같다 — 다르면 "stamp-importmap 을 돌려라"
     (c) CSS `<link>` 도 같다
     (d) 진입점이 `src=` 가 아니라 specifier 다(`src` 는 표를 거치지 않는다)
     (e) 모든 모듈 안의 상대 import 가 **표의 키와 같은 절대 URL** 로 풀린다(키 정규화 규칙)
     (f) 부팅 실패 안내 — 정적·기본 숨김·네 언어·고전 스크립트, 그리고 그 스크립트의 동작

   해시는 이 파일이 **따로** 잰다(생성기 함수를 믿지 않는다). 생성기는 멱등성·구간 보존만 본다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { stamp, listModules, listCss, renderRegion, findRegion, BEGIN, END } from '../dev/stamp-importmap.mjs';

const APP = fileURLToPath(new URL('..', import.meta.url));
const HTML = readFileSync(join(APP, 'index.html'), 'utf8');
const RUN = '`node apps/medreader/dev/stamp-importmap.mjs` 를 돌려라 (stamp-importmap)';

/** 독립 계산 — 줄바꿈을 LF 로 맞춘 SHA-256 앞 10자. */
function h10(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 10);
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.js')) out.push(relative(APP, p).split(sep).join('/'));
  }
  return out.sort();
}

const MODULES = walk(join(APP, 'js'));

function importMap(html) {
  const all = html.match(/<script type="importmap">([\s\S]*?)<\/script>/g) || [];
  assert.equal(all.length, 1, 'import map 은 정확히 하나');
  return JSON.parse(all[0].replace(/^<script type="importmap">/, '').replace(/<\/script>$/, ''));
}

const MAP = importMap(HTML).imports;
const DOC = 'https://example.test/apps/medreader/index.html';

/* ── (a)(b) 모듈 표 ───────────────────────────────────── */

test('IM1 ★ (a) 표가 js/ 아래 모든 모듈을 빠짐없이 덮고, 남는 키가 없다', () => {
  assert.ok(MODULES.length >= 40, '모듈 목록이 이상하게 짧다: ' + MODULES.length);
  const keys = Object.keys(MAP).sort();
  const want = MODULES.map((p) => './' + p).sort();
  const missing = want.filter((k) => keys.indexOf(k) < 0);
  const extra = keys.filter((k) => want.indexOf(k) < 0);
  assert.deepEqual(missing, [], '표에 없는 모듈: ' + missing.join(', ') + ' — ' + RUN);
  assert.deepEqual(extra, [], '없는 파일을 가리키는 키: ' + extra.join(', ') + ' — ' + RUN);
  // 테스트·개발 파일은 앱 모듈이 아니다.
  for (const k of keys) assert.ok(/^\.\/js\//.test(k) && !/\/(tests|dev)\//.test(k), k);
});

test('IM2 ★ (b) 각 해시가 지금 파일 내용과 같다', () => {
  const stale = [];
  for (const p of MODULES) {
    const want = './' + p + '?v=' + h10(join(APP, p));
    if (MAP['./' + p] !== want) stale.push(p + ' (표 ' + MAP['./' + p] + ' ≠ 지금 ' + want + ')');
  }
  assert.deepEqual(stale, [], '해시가 지금 파일과 다르다 — ' + RUN + '\n' + stale.join('\n'));
});

/* ── (c) CSS ──────────────────────────────────────────── */

test('IM3 ★ (c) CSS <link> 가 css/*.css 전부를 지금 해시로 건다 · 해시 없는 스타일시트 0 · 캐스케이드 순서', () => {
  const links = [...HTML.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
  const hrefs = links.map((l) => (l.match(/href="([^"]+)"/) || [])[1]);
  const files = readdirSync(join(APP, 'css')).filter((n) => n.endsWith('.css')).sort();
  for (const n of files) {
    const want = 'css/' + n + '?v=' + h10(join(APP, 'css', n));
    assert.equal(hrefs.filter((h) => h === want).length, 1, want + ' 가 정확히 한 번 있어야 한다 — ' + RUN);
  }
  assert.equal(hrefs.length, files.length, '남는 <link>: ' + hrefs.join(', '));
  for (const h of hrefs) assert.match(h, /\?v=[0-9a-f]{10}$/, '해시 없는 스타일시트: ' + h);
  // 덮어쓰기 순서가 캐스케이드다 — tokens 가 맨 앞, reader 가 screens 뒤.
  const order = hrefs.map((h) => h.replace(/\?.*$/, ''));
  assert.equal(order[0], 'css/tokens.css');
  assert.ok(order.indexOf('css/base.css') < order.indexOf('css/screens.css'));
  assert.ok(order.indexOf('css/screens.css') < order.indexOf('css/reader.css'));
});

/* ── (d) 진입점 ───────────────────────────────────────── */

test('IM4 ★ (d) 진입점은 specifier 다 — <script src> 로 앱 모듈을 부르지 않는다 (소스 검사)', () => {
  const code = HTML.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/<script\b[^>]*\bsrc=/.test(code), 'src= 로 부르는 <script> 가 있다 — src 는 import map 을 거치지 않는다');
  const entries = code.match(/<script type="module">\s*import '\.\/js\/main\.js';\s*<\/script>/g) || [];
  assert.equal(entries.length, 1, '진입점 `<script type="module">import \'./js/main.js\';</script>` 가 정확히 하나');
  const mods = [...code.matchAll(/<script\b[^>]*type="module"[^>]*>/g)];
  assert.equal(mods.length, 1, '모듈 스크립트는 진입점 하나뿐');
  // import map 은 모든 모듈 스크립트보다 앞에 있어야 한다(뒤에 오면 무시된다).
  assert.ok(code.indexOf('<script type="importmap">') < mods[0].index);
  assert.ok(!/<link\b[^>]*modulepreload/.test(code), 'modulepreload 는 표 앞에서 해시 없는 URL 을 받을 수 있다');
});

/* ── (e) 키 정규화 ────────────────────────────────────── */

/** 모듈 소스의 import·export-from·동적 import 문자열 specifier 들(주석 제거 뒤). */
function specifiersOf(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  const out = [];
  const re = /(?:^|[;\s])(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|[;\s])import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(code))) out.push(m[1] || m[2] || m[3]);
  return out;
}

test('IM5 ★ (e) 모든 상대 import 가 표의 키와 같은 절대 URL 로 풀린다 — 해시 URL 안에서 풀려도 같다', () => {
  // 표의 키는 문서 URL 기준으로 절대 URL 이 된다(import map 의 키 정규화).
  const keyUrls = new Map(Object.keys(MAP).map((k) => [new URL(k, DOC).href, k]));
  let n = 0;
  const bad = [];
  for (const p of MODULES) {
    const src = readFileSync(join(APP, p), 'utf8');
    // 모듈은 **해시 URL** 로 받혀 있다. 그 안의 상대 import 도 쿼리를 떼고 같은 키에 걸려야 한다.
    const moduleUrl = new URL(MAP['./' + p], DOC).href;
    assert.match(moduleUrl, /\?v=[0-9a-f]{10}$/);
    for (const s of specifiersOf(src)) {
      n++;
      if (!/^\.\.?\//.test(s)) { bad.push(p + ': 상대 경로가 아닌 import ' + s); continue; }
      if (/[?#]/.test(s)) { bad.push(p + ': 쿼리·해시가 붙은 import 는 표를 비켜 간다 ' + s); continue; }
      const abs = new URL(s, moduleUrl).href;
      if (!keyUrls.has(abs)) bad.push(p + ': ' + s + ' → ' + abs + ' 가 표에 없다');
    }
  }
  assert.ok(n > 100, 'import 를 거의 못 찾았다(정규식 고장?): ' + n);
  assert.deepEqual(bad, []);
  // 진입점 specifier 도 같은 규칙.
  assert.ok(keyUrls.has(new URL('./js/main.js', DOC).href));
});

test('IM5b 동적 import 는 문자열이 아니면 pdf.js CDN 뿐이다 (앱 모듈을 동적 import 하면 IM5 가 문자열로 잡는다)', () => {
  const dyn = [];
  for (const p of MODULES) {
    const code = readFileSync(join(APP, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    // 주석은 위에서 걷었다(`/* @vite-ignore */`). 문자열이 아닌 첫 낱말만 모은다.
    for (const m of code.matchAll(/\bimport\s*\(\s*([A-Za-z_$][\w.$]*)/g)) dyn.push(p + ': ' + m[1]);
    // `[Review]` 문자열 하나가 아닌 식(템플릿 문자열·이어 붙이기)도 표를 비켜 간다 — IM5 의 정규식은
    // `import('…')` 꼴만 보므로 여기서 잡는다.
    for (const m of code.matchAll(/\bimport\s*\(\s*(`|['"][^'"]*['"]\s*[^\s)])/g)) dyn.push(p + ': 식 ' + m[0]);
  }
  assert.deepEqual(dyn, ['js/pdf/loader.js: pdfjsMainUrl']);
});

/* ── 생성기 ───────────────────────────────────────────── */

test('IM6 생성기는 멱등이다 — 지금 index.html 을 다시 찍어도 한 글자도 안 바뀐다', () => {
  const out = stamp(HTML, listModules(APP), listCss(APP));
  assert.equal(out.changed, false, RUN);
});

test('IM7 생성기는 표지 구간만 다시 쓴다 · CSS 순서 보존 · 새 CSS 는 끝에 · 사라진 CSS 는 빠진다', () => {
  const html = 'HEAD\n  ' + BEGIN + ' -->\n  <link rel="stylesheet" href="css/b.css?v=old">\n  <link rel="stylesheet" href="css/gone.css">\n  <link rel="stylesheet" href="css/a.css">\n  ' + END + '\nTAIL <script type="importmap">{}</script>';
  const out = stamp(html,
    [{ path: 'js/x.js', hash: '1111111111' }, { path: 'js/y/z.js', hash: '2222222222' }],
    [{ path: 'css/a.css', hash: 'aaaaaaaaaa' }, { path: 'css/b.css', hash: 'bbbbbbbbbb' }, { path: 'css/c.css', hash: 'cccccccccc' }]);
  assert.ok(out.html.startsWith('HEAD\n'));
  assert.ok(out.html.endsWith('\nTAIL <script type="importmap">{}</script>'), '구간 밖은 그대로');
  assert.deepEqual(out.cssOrder, ['css/b.css', 'css/a.css', 'css/c.css']);
  const r = findRegion(out.html);
  assert.equal(r.indent, '  ');
  assert.match(r.body, /"\.\/js\/y\/z\.js": "\.\/js\/y\/z\.js\?v=2222222222"/);
  assert.ok(!/gone\.css/.test(r.body));
  // 만든 표는 JSON 으로 읽힌다.
  const json = r.body.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(Object.keys(JSON.parse(json).imports), ['./js/x.js', './js/y/z.js']);
  assert.throws(() => stamp('no markers', [], []), /구간이 없다/);
  assert.equal(typeof renderRegion, 'function');
});

test('IM7b [Review] 생성기는 파일의 줄바꿈을 따른다 — CRLF 파일에 LF 구간을 섞지 않고, 두 번째부터는 그대로다', () => {
  const mods = listModules(APP), css = listCss(APP);
  const crlf = HTML.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const out = stamp(crlf, mods, css);
  assert.equal((out.html.match(/(^|[^\r])\n/g) || []).length, 0, '홀로 선 LF 가 생겼다');
  assert.equal(stamp(out.html, mods, css).changed, false, '두 번째 찍기가 또 바꾼다');
  // 해시가 맞는 CRLF 파일은 처음부터 "그대로"다(--check 가 줄바꿈만으로 빨갛지 않다).
  assert.equal(out.changed, false);
  // LF 파일은 LF 그대로
  assert.equal((stamp(HTML, mods, css).html.match(/\r/g) || []).length, (HTML.match(/\r/g) || []).length);
});

/* ── (f) 부팅 실패 안내 ───────────────────────────────── */

test('IM8 ★ 부팅 실패 안내는 정적이다 — 기본 숨김 · 네 언어(아랍어 먼저, 각자 dir) · 48px 버튼 · 고전 스크립트가 진입점보다 앞', () => {
  const at = HTML.indexOf('id="bootFail"');
  assert.ok(at > 0);
  const tag = HTML.slice(HTML.lastIndexOf('<div', at), HTML.indexOf('>', at) + 1);
  assert.match(tag, /\shidden>/, '기본 숨김');
  const box = HTML.slice(at, HTML.indexOf('</button>', at));
  const langs = [...box.matchAll(/<p lang="(\w+)" dir="(\w+)">/g)].map((m) => m[1] + ':' + m[2]);
  assert.deepEqual(langs, ['ar:rtl', 'en:ltr', 'fr:ltr', 'ko:ltr']);
  assert.match(box, /앱을 불러오지 못했습니다\. 잠시 뒤 다시 열어 주세요\./);
  assert.match(box, /<button type="button" id="bootFailReload">/);
  // 모양은 외부 CSS 에 기대지 않는다(인라인 <style>) — 버튼 48px.
  const style = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
  assert.match(style, /\.boot-fail-box button \{[^}]*min-block-size: 48px/);
  // 감시 스크립트는 고전 스크립트(type 없음)이고 진입 모듈보다 앞에 있다.
  const guard = guardSource();
  assert.ok(HTML.indexOf(guard) < HTML.indexOf('<script type="module">import \'./js/main.js\';'));
  assert.ok(!/\bimport\b\s*[('"{*]/.test(guard), '감시 스크립트가 모듈 시스템에 기댄다');
  assert.match(guard, /var BOOT_TIMEOUT_MS = \d+;/);
  assert.match(guard, /location\.reload\(\)/);
});

test('IM9 ★ main.js 가 부팅 완료를 boot() 의 마지막에 세우고, 실패하면 실패를 알린다', () => {
  const main = readFileSync(join(APP, 'js/main.js'), 'utf8');
  const boot = main.slice(main.indexOf('async function boot()'), main.indexOf('function markBoot'));
  const lastStmt = boot.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('\n').filter((l) => l.trim()).slice(-2).join('\n');
  assert.match(lastStmt, /markBoot\('ok'\);\s*\}$/, 'boot() 의 마지막 문장이어야 한다');
  // `[Review]` "마지막 줄"만으로는 늦게 세우는 것을 못 막는다 — 그 앞에 무거운 일을 기다리면(예: 책 열기·
  // pdf.js) 느린 폰에서 20초 감시가 멀쩡한 부팅에 안내를 띄운다. 라우터를 켠 뒤에는 아무것도 기다리지 않는다.
  const afterRouter = boot.slice(boot.indexOf('startRouter(')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(boot.indexOf('startRouter(') > 0, 'boot() 가 라우터를 켜지 않는다');
  assert.doesNotMatch(afterRouter, /\bawait\b|\.then\s*\(|setTimeout\s*\(/, '라우터를 켠 뒤 부팅 완료 표시 전에 기다리는 일이 있다');
  assert.match(main, /setAttribute\('data-boot', state\)/);
  assert.match(main, /'medreader:booted' : 'medreader:bootfailed'/);
  const tail = main.slice(main.indexOf('boot().catch'));
  assert.match(tail, /markBoot\('failed'\)/);
});

function guardSource() {
  const m = HTML.match(/<script>([\s\S]*?BOOT_TIMEOUT_MS[\s\S]*?)<\/script>/);
  assert.ok(m, '감시 스크립트를 찾지 못했다');
  return m[1];
}

/** 감시 스크립트를 작은 가짜 DOM 에서 돌린다. */
function runGuard() {
  const attrs = new Map();
  const listeners = { window: [], document: {} };
  const timers = [];
  const box = { hidden: true };
  let reloads = 0;
  const ctx = {
    location: { href: 'https://h.test/apps/medreader/index.html#/library', reload: () => { reloads++; } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    window: { addEventListener: (type, fn, cap) => listeners.window.push({ type, fn, cap }) },
    document: {
      documentElement: {
        getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
        setAttribute: (k, v) => attrs.set(k, String(v)),
        removeAttribute: (k) => attrs.delete(k)
      },
      getElementById: (id) => (id === 'bootFail' ? box : id === 'bootFailReload' ? reloadBtn : null),
      addEventListener: (type, fn) => { (listeners.document[type] = listeners.document[type] || []).push(fn); }
    }
  };
  const reloadBtn = { addEventListener: (t, fn) => { if (t === 'click') reloadBtn.click = fn; } };
  ctx.window.window = ctx.window;
  vm.runInNewContext(guardSource(), ctx);
  const win = listeners.window.filter((l) => l.type === 'error');
  return {
    box, attrs, timers, reloads: () => reloads, reloadBtn,
    errorListener: win,
    fireError: (ev) => win.forEach((l) => l.fn(ev)),
    fireDoc: (type) => (listeners.document[type] || []).forEach((fn) => fn({})),
    boot: () => { attrs.set('data-boot', 'ok'); (listeners.document['medreader:booted'] || []).forEach((fn) => fn({})); }
  };
}

test('IM10 ★ 감시 동작 — 모듈 404·연결 오류·부팅 실패는 즉시 열고, 정상 부팅은 절대 열지 않는다', () => {
  // 오류 리스너는 캡처 단계여야 한다(스크립트 요소의 error 는 버블하지 않는다).
  let g = runGuard();
  assert.equal(g.errorListener.length, 1);
  assert.equal(g.errorListener[0].cap, true);
  assert.equal(g.timers.length, 1);
  assert.ok(g.timers[0].ms >= 10000 && g.timers[0].ms <= 30000, '제한 시간 ' + g.timers[0].ms);

  // ① 모듈을 못 받았다 — <script> 요소의 error
  g.fireError({ target: { nodeName: 'SCRIPT' } });
  assert.equal(g.box.hidden, false);
  assert.equal(g.attrs.get('data-boot-fail'), 'load');
  g.reloadBtn.click();
  assert.equal(g.reloads(), 1, '[다시 불러오기] → location.reload()');

  // ② 연결 오류 — window 의 ErrorEvent, 파일이 이 앱 폴더
  g = runGuard();
  g.fireError({ target: g, filename: 'https://h.test/apps/medreader/js/ai/provider.js?v=48d1929564', message: 'SyntaxError' });
  assert.equal(g.box.hidden, false);
  // ③ 부팅이 던졌다
  g = runGuard();
  g.fireDoc('medreader:bootfailed');
  assert.equal(g.box.hidden, false);

  // 다른 출처의 오류(확장 프로그램·CDN)·그림 오류로는 열지 않는다
  g = runGuard();
  g.fireError({ target: {}, filename: 'chrome-extension://abc/x.js' });
  g.fireError({ target: { nodeName: 'SCRIPT', src: 'chrome-extension://abc/inject.js' } });   // [Review] 남이 넣은 <script>
  g.fireError({ target: { nodeName: 'SCRIPT', src: 'https://cdn.example/x.js' } });
  g.fireError({ target: { nodeName: 'IMG' } });
  g.fireError({ target: {}, filename: '' });
  assert.equal(g.box.hidden, true);

  // ★ 정상 부팅 — 완료 표시 뒤에는 오류가 와도, 시간이 지나도 열리지 않는다(깜빡임 0)
  g = runGuard();
  g.boot();
  g.fireError({ target: { nodeName: 'SCRIPT' } });
  g.fireError({ target: {}, filename: 'https://h.test/apps/medreader/js/ui/reader.js?v=1' });
  g.timers[0].fn();
  assert.equal(g.box.hidden, true);
  assert.equal(g.attrs.has('data-boot-fail'), false);
});

test('IM11 ★ 늦게라도 부팅이 끝나면 안내를 거둔다 — 부팅이 던진 것(③)만 남는다', () => {
  let g = runGuard();
  g.timers[0].fn();
  assert.equal(g.box.hidden, false);
  assert.equal(g.attrs.get('data-boot-fail'), 'timeout');
  g.boot();
  assert.equal(g.box.hidden, true, '느린 망에서 늦게 뜬 부팅 — 안내를 거둔다');

  // `[Review 수정]` 진입 그래프가 정말 못 떴다면 부팅 완료는 설 수 없다. 완료가 섰다면 그 오류는
  // 부팅을 막지 않은 것(이 앱 파일의 처리기 예외 등)이다 — 멀쩡한 앱을 덮어 두지 않는다.
  g = runGuard();
  g.fireError({ target: { nodeName: 'SCRIPT', src: '' } });
  assert.equal(g.attrs.get('data-boot-fail'), 'load');
  g.boot();
  assert.equal(g.box.hidden, true);
  assert.equal(g.attrs.has('data-boot-fail'), false);

  g = runGuard();
  g.fireError({ target: g, filename: 'https://h.test/apps/medreader/js/ui/library.js?v=1', message: 'TypeError' });
  g.boot();
  assert.equal(g.box.hidden, true);

  // ③ 은 부팅 완료와 함께 올 수 없지만, 와도 닫지 않는다(boot().catch 가 이미 실패를 선언했다).
  g = runGuard();
  g.fireDoc('medreader:bootfailed');
  g.boot();
  assert.equal(g.box.hidden, false);
});
