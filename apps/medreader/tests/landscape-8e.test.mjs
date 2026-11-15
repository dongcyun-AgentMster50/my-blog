/* ============================================================
   tests/landscape-8e.test.mjs — 8e 가로 화면 읽기 (spec 12-8 · 12-8-1)

   CSS 는 Node 로 그릴 수 없다. 그래서 (1) 토큰은 **파일에서 읽어** 세로 예산을 계산하고,
   (2) 배치 규칙은 소스의 자리·문구로 고정하고, (3) 상태 전이는 순수 함수 표로 고정한다.
   실제 픽셀(본문 높이·한 줄·48px·세로 무변)은 headless Edge 실측 — 보고서 `medreader-build-8e-landscape-report.md`.

   L1  tokens.css compact 블록 — 판정 하나, 아래 크롬 83, 띠 2줄, 숨김이면 --bar-top 0
   L2  본문 높이(12-8 · 12-8-1 수용 기준 숫자) — 토큰으로 계산
   L3  판정은 높이 하나 — `orientation` 0건, 모든 compact 조건이 같은 글자
   L4  `nextChrome` 표 · `chromeMark` · `toggleLabelKey`
   L5  index.html — dock 안에 [≡] · #ttsBar · #readerPager(그 순서), 팝오버는 밖, 전체 화면 줄
   L6  reader.css — 세로는 상자 없음(display: contents)·두 바 제 fixed 그대로, compact 만 한 줄
   L7  reader.css — 상단바 숨김·원본 보기·팝오버 compact 규칙
   L8  9b 좁은 바 재사용 — 판정 상수에 compact 조건, 새 장치 없음
   L9  i18n — 새 키 4개 × 4언어, ko·fr 쪽 이동 문구가 영어가 아니다
   L10 전체 화면 — 순수 함수 · 저장하지 않음 · 사용자 탭 안에서만
   L11 reader.js 배선 — initChrome · 회전이 낳은 스크롤 쉼 되돌리기
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { nextChrome, chromeMark, toggleLabelKey, CHROME_INIT, COMPACT_MEDIA } from '../js/ui/chrome.js';
import { fullscreenKey, canFullscreen } from '../js/ui/typeset.js';
import { VOICE } from '../js/config.js';
import { barTight } from '../js/ui/voice.js';
import ko from '../js/i18n/ko.js';
import en from '../js/i18n/en.js';
import fr from '../js/i18n/fr.js';
import ar from '../js/i18n/ar.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const TOKENS = read('../css/tokens.css');
const READER = read('../css/reader.css');
const HTML = read('../index.html');

/** `@media (...) {` 블록 본문(중첩 중괄호까지). */
function mediaBlock(src, cond, from) {
  const at = src.indexOf('@media ' + cond + ' {', from || 0);
  assert.ok(at >= 0, cond + ' 블록이 없다');
  let i = src.indexOf('{', at) + 1; let depth = 1; const start = i;
  for (; i < src.length && depth; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; }
  return { at, body: src.slice(start, i - 1), end: i };
}
/** 블록 안 규칙 하나(선택자 글자 그대로)의 선언. */
function decls(body, selector) {
  const at = body.indexOf(selector + ' {');
  assert.ok(at >= 0, '규칙이 없다: ' + selector);
  const open = body.indexOf('{', at); const close = body.indexOf('}', open);
  const m = new Map();
  for (const d of body.slice(open + 1, close).split(';')) { const k = d.indexOf(':'); if (k > 0) m.set(d.slice(0, k).trim(), d.slice(k + 1).trim()); }
  return m;
}
/** tokens.css 첫 `:root {}` 의 토큰(주석 뺌). */
function rootTokens() {
  const s = noComments(TOKENS); const at = s.indexOf(':root'); const open = s.indexOf('{', at); const close = s.indexOf('}', open);
  const m = new Map(); const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi; let x;
  while ((x = re.exec(s.slice(open + 1, close))) !== null) m.set(x[1], x[2].trim());
  return m;
}
const pxOf = (v) => { const m = /^(-?[\d.]+)px$/.exec(String(v).trim()); assert.ok(m, 'px 값이 아니다: ' + v); return Number(m[1]); };

/* ── L1 ───────────────────────────────────────────── */
const COMPACT = mediaBlock(noComments(TOKENS), '(max-height: 520px)');

test('L1 tokens.css compact 블록 — 쪽 이동 0 · 틈 0 · 띠 2줄 · 숨김이면 --bar-top 0 (8e-D1 · D2 · D6)', () => {
  const root = decls(COMPACT.body, ':root');
  assert.equal(root.get('--pager-h'), '0px');
  assert.equal(root.get('--tts-gap'), '0px');
  assert.equal(root.get('--tr-lines'), '2');
  const hidden = decls(COMPACT.body, ':root[data-chrome="hidden"]');
  assert.equal(hidden.get('--bar-top'), '0px');
  assert.equal([...COMPACT.body.matchAll(/--[a-z-]+\s*:/g)].length, 4, 'compact 블록은 토큰 넷만 바꾼다(식은 그대로 토큰을 읽는다)');
  // 아래 크롬 = 고지 + 쪽 이동(0) + 틈(0) + 낭독 = 83
  const t = rootTokens();
  assert.equal(t.get('--reader-chrome-bottom'), 'calc(var(--notice-total) + var(--pager-h) + var(--tts-gap) + var(--tts-h))', '식은 한 벌');
  const chrome = pxOf(t.get('--notice-h')) + pxOf(root.get('--pager-h')) + pxOf(root.get('--tts-gap')) + pxOf(t.get('--tts-h'));
  assert.equal(chrome, 83);
  // 세로(블록 밖)는 그대로 138 · 49
  assert.equal(pxOf(t.get('--notice-h')) + pxOf(t.get('--pager-h')) + pxOf(t.get('--tts-gap')) + pxOf(t.get('--tts-h')), 138);
  assert.equal(pxOf(t.get('--bar-top')), 49);
});

/* ── L2 ───────────────────────────────────────────── */
/** compact 본문 높이 = vh − barTop − 83 − 띠(2줄 = min(2 × trFs × 1.8 + 13, 22dvh)). 글자 22px → trFs 19.8. */
function bodyH(vh, { band, hidden }) {
  const trFs = Math.min(24, Math.max(18, 22 * 0.9));
  const bandH = band ? Math.min(2 * trFs * 1.8 + 2 * 6 + 1, 0.22 * vh) : 0;
  return vh - (hidden ? 0 : 49) - 83 - bandH;
}
test('L2 본문 높이 — 12-8 · 12-8-1 수용 기준을 토큰 식이 맞춘다', () => {
  assert.ok(bodyH(360, { hidden: true }) >= 270, '800×360 숨김');
  assert.ok(bodyH(360, { hidden: false }) >= 220, '800×360 보임');
  assert.ok(bodyH(360, { band: true, hidden: true }) >= 190, '800×360 띠 켬 숨김');
  assert.ok(bodyH(360, { band: true, hidden: false }) >= 140, '800×360 띠 켬 보임');
  assert.ok(bodyH(412, { hidden: true }) >= 320, '915×412 숨김');
  assert.ok(bodyH(412, { band: true, hidden: true }) >= 240, '915×412 · 960×412 띠 켬 숨김(2줄이라 맞는다)');
  // 3줄이었다면 412 높이에서 미달(12-8-1 달라진 점 1)
  const three = 412 - 83 - Math.min(3 * 19.8 * 1.8 + 13, 0.22 * 412);
  assert.ok(three < 240, '3줄이면 238.4 — 2줄이 기준을 맞추는 6px');
  assert.equal(Math.round(bodyH(412, { hidden: true })), 329);
  assert.equal(Math.round(bodyH(412, { band: true, hidden: true }) * 10) / 10, 244.7);
});

/* ── L3 ───────────────────────────────────────────── */
test('L3 판정은 높이 하나 — orientation 0건(css · manifest · chrome.js), compact 조건은 모두 같은 글자', () => {
  const cssDir = new URL('../css/', import.meta.url);
  for (const f of readdirSync(cssDir)) {
    if (!f.endsWith('.css')) continue;
    assert.ok(!/orientation/.test(noComments(readFileSync(new URL(f, cssDir), 'utf8'))), f + ' 에 orientation');
  }
  assert.ok(!/orientation/.test(read('../manifest.webmanifest')), 'manifest 에 orientation(방향 고정) 0');
  assert.ok(!/orientation/.test(noComments(read('../js/ui/chrome.js'))));
  assert.equal(COMPACT_MEDIA, '(max-height: 520px)');
  const conds = [...noComments(READER).matchAll(/@media ([^{]*max-height[^{]*)\{/g)].map((m) => m[1].trim());
  // 9b 가로 고지 카드(500px)는 9b 규칙 그대로 — 그 밖의 높이 조건은 전부 520
  for (const c of conds) assert.ok(c === '(max-height: 520px)' || c === '(max-height: 520px) and (max-width: 759px)' || c === '(max-height: 500px)', '모르는 높이 조건: ' + c);
  assert.ok(conds.includes('(max-height: 520px)') && conds.includes('(max-height: 520px) and (max-width: 759px)'));
  assert.equal([...noComments(TOKENS).matchAll(/@media \(max-height/g)].length, 1, 'tokens.css 의 compact 블록은 하나');
});

/* ── L4 ───────────────────────────────────────────── */
test('L4 nextChrome 표 — 기본 숨김 · [≡] 토글 · 세로·다른 화면에서는 표식 없음 · 기억은 회전·화면 이동을 넘는다', () => {
  let s = CHROME_INIT;
  assert.equal(chromeMark(s), null, '처음 — compact 아님');
  s = nextChrome(s, { type: 'route', reader: true });
  assert.equal(chromeMark(s), null, '세로 리더 — 표식 없음');
  s = nextChrome(s, { type: 'toggle' });
  assert.equal(s.shown, false, '세로에서 토글은 아무 일도 하지 않는다');
  s = nextChrome(s, { type: 'enter' });
  assert.equal(chromeMark(s), 'hidden', 'compact 에 들어오면 기본 숨김');
  assert.equal(toggleLabelKey(s), 'reader.chrome.open');
  s = nextChrome(s, { type: 'toggle' });
  assert.equal(chromeMark(s), 'shown');
  assert.equal(toggleLabelKey(s), 'reader.chrome.close');
  s = nextChrome(s, { type: 'leave' });
  assert.equal(chromeMark(s), null, '세로로 돌리면 표식을 뗀다');
  s = nextChrome(s, { type: 'enter' });
  assert.equal(chromeMark(s), 'shown', '회전 동안 기억(세션 메모리)');
  s = nextChrome(s, { type: 'route', reader: false });
  assert.equal(chromeMark(s), null, '검색·서재 화면에는 새지 않는다');
  s = nextChrome(s, { type: 'toggle' });
  assert.equal(s.shown, true, '리더가 아닐 때 토글은 무시');
  s = nextChrome(s, { type: 'route', reader: true });
  assert.equal(chromeMark(s), 'shown', '돌아오면 그대로');
  s = nextChrome(s, { type: 'toggle' });
  assert.equal(chromeMark(s), 'hidden');
  // 순수 — 입력을 바꾸지 않는다, 모르는 사건은 그대로
  const frozen = Object.freeze({ compact: true, reader: true, shown: false });
  assert.deepEqual(nextChrome(frozen, { type: 'toggle' }), { compact: true, reader: true, shown: true });
  assert.deepEqual(nextChrome(frozen, { type: 'scroll' }), frozen);
  assert.deepEqual(nextChrome(undefined, null), { compact: false, reader: false, shown: false });
});

test('L4b 장치 하나 — chrome.js 는 스크롤·낭독 상태를 보지 않고 저장소를 쓰지 않는다', () => {
  const src = noComments(read('../js/ui/chrome.js'));
  assert.ok(!/addEventListener\(\s*'scroll'/.test(src), '스크롤 방향으로 숨기지 않는다(8e-D4)');
  assert.ok(!/settings|localStorage|sessionStorage|indexedDB/.test(src), '세션 메모리만 — 설정 키 0');
  assert.ok(!/body\.setAttribute|body\.dataset/.test(src), '표식은 html 에(12-8-1 달라진 점 7)');
  assert.match(src, /root\.setAttribute\('data-chrome', mark\)/);
  assert.match(src, /root\.removeAttribute\('data-chrome'\)/);
});

/* ── L5 ───────────────────────────────────────────── */
test('L5 index.html — dock 안에 [≡] · 낭독 바 · 쪽 이동 바(논리 순서), 속도 팝오버는 dock 밖', () => {
  const dock = HTML.indexOf('<div class="reader-dock" id="readerDock">');
  assert.ok(dock > 0);
  const tog = HTML.indexOf('id="chromeToggle"'); const bar = HTML.indexOf('id="ttsBar"'); const pager = HTML.indexOf('id="readerPager"');
  const navEnd = HTML.indexOf('</nav>', pager); const dockEnd = HTML.indexOf('</div>', navEnd);
  assert.ok(dock < tog && tog < bar && bar < pager && pager < navEnd, '[≡] → 낭독 → 쪽 이동');
  assert.ok(/^<\/nav>\s*<\/div>/.test(HTML.slice(navEnd, dockEnd + 6)), 'dock 은 쪽 이동 바 바로 뒤에서 닫힌다');
  const rate = HTML.indexOf('id="ttsRatePanel"');
  assert.ok(rate > dockEnd, '속도 팝오버는 dock 밖(고정 상자 안에 넣지 않는다)');
  assert.ok(HTML.indexOf('id="trBand"') < dock, '띠는 dock 밖 그대로');
  const t = HTML.slice(tog - 80, HTML.indexOf('</button>', tog));
  assert.match(t, /type="button"/);
  assert.match(t, /aria-expanded="false"/);
  assert.match(t, /data-i18n-aria="reader\.chrome\.open"/);
  assert.match(t, /<span aria-hidden="true">≡<\/span>/);
  // 전체 화면 줄 — Aa 팝오버 [닫기] 바로 앞, 기본 숨김(API 를 확인한 뒤 연다)
  const fsRow = HTML.indexOf('id="tsFullscreenRow"'); const tsClose = HTML.indexOf('id="tsClose"');
  assert.ok(fsRow > HTML.indexOf('id="typesetPanel"') && fsRow < tsClose);
  assert.match(HTML.slice(fsRow, fsRow + 80), /hidden/);
  assert.match(HTML.slice(fsRow, tsClose), /id="tsFullscreen" aria-pressed="false" data-i18n="reader\.fullscreen\.on"/);
});

/* ── L6 ───────────────────────────────────────────── */
const R = noComments(READER);
const RC = mediaBlock(R, '(max-height: 520px)');
test('L6 세로·폴드 펼침은 상자를 만들지 않는다 — 두 바는 제 fixed 규칙 그대로(픽셀 무변의 근거)', () => {
  const outside = R.slice(0, RC.at);
  assert.match(outside, /\.reader-dock \{ display: contents; \}/);
  assert.match(outside, /\.chrome-toggle \{ display: none; \}/);
  const pager = decls(outside, '.pager');
  assert.equal(pager.get('position'), 'fixed');
  assert.equal(pager.get('inset-block-end'), 'calc(var(--notice-total) + env(safe-area-inset-bottom, 0px))');
  const bar = decls(outside, '.tts-bar');
  assert.equal(bar.get('position'), 'fixed');
  assert.equal(bar.get('inset-block-end'), 'calc(var(--notice-total) + var(--pager-h) + var(--tts-gap) + env(safe-area-inset-bottom, 0px))');
  assert.equal(bar.get('flex-wrap'), 'nowrap');
});

test('L6b compact — dock 한 줄(높이 --tts-h), 두 바는 흐름 항목, [≡] 48×48, 쪽 무리는 끝 쪽', () => {
  const dock = decls(RC.body, '.reader-dock');
  assert.equal(dock.get('display'), 'flex');
  assert.equal(dock.get('flex-direction'), 'row');
  assert.equal(dock.get('position'), 'fixed');
  assert.equal(dock.get('min-block-size'), 'var(--tts-h)');
  assert.equal(dock.get('box-sizing'), 'border-box');
  assert.equal(dock.get('padding-block'), 'var(--bar-pad)');
  assert.equal(dock.get('inset-block-end'), 'calc(var(--notice-total) + env(safe-area-inset-bottom, 0px))');
  const kids = decls(RC.body, '.reader-dock > .tts-bar,\n  .reader-dock > .pager');
  assert.equal(kids.get('position'), 'relative');
  assert.equal(kids.get('inset'), 'auto');
  assert.equal(kids.get('flex-wrap'), 'nowrap');
  assert.match(RC.body, /\n {2}\.reader-dock > \.pager \{ flex: 0 0 auto; margin-inline-start: auto; \}/, '쪽 무리는 끝 쪽(오른손 — 아랍어는 저절로 왼쪽)');
  const tog = decls(RC.body, '.reader-dock > .chrome-toggle');
  assert.equal(tog.get('min-inline-size'), 'var(--tap)');
  assert.equal(tog.get('min-block-size'), 'var(--tap)');
  // 760 미만 — 간격 4 · 입력칸 4em · /총 시각 숨김(단추는 줄이지 않는다)
  const narrow = mediaBlock(R, '(max-height: 520px) and (max-width: 759px)');
  assert.equal(decls(narrow.body, '.reader-dock .page-input').get('inline-size'), '4em');
  assert.equal(decls(narrow.body, '.reader-dock .page-total').get('clip-path'), 'inset(50%)');
  assert.ok(!/min-(inline|block)-size/.test(narrow.body), '단추 48 은 줄이지 않는다');
});

/* ── L7 ───────────────────────────────────────────── */
test('L7 상단바 — 리플로우는 fixed 겹침 + 위 여백 49 고정, 숨김은 visibility(Tab 에서 빠진다)', () => {
  const sel = 'body:not([data-reader-view="original"]):not(:has(.original)) .screen[data-screen="reader"]';
  assert.equal(decls(RC.body, sel).get('padding-block-start'), 'calc(var(--tap) + 1px)');
  const top = decls(RC.body, sel + ' > .topbar');
  assert.equal(top.get('position'), 'fixed');
  assert.equal(top.get('inset-block-start'), '0');
  const hid = decls(RC.body, ':root[data-chrome="hidden"] ' + sel + ' > .topbar');
  assert.equal(hid.get('visibility'), 'hidden');
  assert.equal(hid.get('transform'), 'translateY(-100%)');
});

test('L7b 원본 보기 숨김 — 상단바·줌 막대·추출 진행 띠가 함께 숨고 위 여백 0(같은 표식 하나, 8e-D5)', () => {
  for (const what of ['.screen[data-screen="reader"] > .topbar', '.original-bar', '.reader-progress']) {
    for (const b of ['body:has(.original)', 'body[data-reader-view="original"]']) {
      assert.ok(RC.body.includes(':root[data-chrome="hidden"] ' + b + ' ' + what), b + ' ' + what);
    }
  }
  assert.match(RC.body, /:root\[data-chrome="hidden"\] body\[data-reader-view="original"\] \.original \{ padding-block-start: 0; \}/);
  assert.ok(!/calc\(100dvh/.test(RC.body.slice(RC.body.indexOf('.original-bar'), RC.body.indexOf('.typeset-panel,'))), '원본 높이를 calc 로 더하지 않는다(10b — flex 가 준다)');
});

test('L7c 팝오버 compact — 2단 · 폭 880 · 위 경계에서 --bar-top 을 빼지 않는다 · 하한 48×3 · [닫기] 두 칸', () => {
  const p = decls(RC.body, '.typeset-panel,\n  .tts-rate-panel');
  assert.equal(p.get('max-inline-size'), '880px');
  assert.equal(p.get('display'), 'grid');
  assert.equal(p.get('grid-template-columns'), '1fr 1fr');
  assert.equal(p.get('align-items'), 'start', '긴 칸 옆 짧은 줄이 늘어나지 않는다(설정 줄 3개 이상 보이게)');
  assert.ok(!/--bar-top/.test(p.get('max-block-size')), '상단바를 덮어도 된다');
  assert.match(p.get('max-block-size'), /^max\(calc\(var\(--tap\) \* 3\), calc\(100dvh - var\(--banners-h, 0px\) - var\(--reader-chrome-bottom\) - var\(--sp-6\)\)\)$/);
  assert.equal(decls(RC.body, '.typeset-panel > .primary,\n  .tts-rate-panel > .tts-rate-foot').get('grid-column'), '1 / -1');
});

/* ── L8 ───────────────────────────────────────────── */
test('L8 9b 좁은 바 재사용 — 판정 상수에 compact 조건만 더했다(새 클래스·속성 없음)', () => {
  assert.equal(VOICE.BAR_TIGHT_MEDIA, '(max-width: 400px), (max-height: 520px)');
  assert.ok(VOICE.BAR_TIGHT_MEDIA.includes(COMPACT_MEDIA), 'compact 판정과 같은 글자');
  assert.equal(barTight(true, true), true);
  assert.equal(barTight(false, true), false, '마이크가 없으면 진행 표시는 남는다(9b 그대로)');
  assert.ok(!/data-progress|progress-hidden/.test(R + HTML), '진행 표시 숨김용 새 장치를 만들지 않았다');
  assert.ok(!/\.tts-progress/.test(RC.body), 'compact 블록은 진행 표시를 따로 숨기지 않는다 — data-bar-tight 하나');
});

/* ── L9 ───────────────────────────────────────────── */
test('L9 i18n — 새 키 4개 × 4언어, ko·fr 쪽 이동 문구가 영어가 아니다(8e-D10), ar·en 쪽 문구는 그대로', () => {
  const NEW = ['reader.chrome.open', 'reader.chrome.close', 'reader.fullscreen.on', 'reader.fullscreen.off'];
  for (const [name, b] of [['ko', ko], ['en', en], ['fr', fr], ['ar', ar]]) {
    for (const k of NEW) assert.ok(typeof b[k] === 'string' && b[k].trim().length > 0, name + ' ' + k);
    assert.notEqual(b['reader.chrome.open'], b['reader.chrome.close']);
    assert.notEqual(b['reader.fullscreen.on'], b['reader.fullscreen.off']);
  }
  for (const [name, b] of [['ko', ko], ['fr', fr]]) {
    assert.notEqual(b['reader.page.prev'], 'Previous', name);
    assert.notEqual(b['reader.page.next'], 'Next', name);
    assert.notEqual(b['reader.page.of'], 'of {total}', name);
    assert.ok(b['reader.page.of'].includes('{total}'));
    assert.notEqual(b['reader.page.prev'], b['reader.tts.prev'], name + ' — 낭독 [이전] 과 같은 줄에서 구별된다');
    assert.notEqual(b['reader.page.next'], b['reader.tts.next'], name);
  }
  assert.equal(en['reader.page.prev'], 'Previous');
  assert.equal(ar['reader.page.prev'], 'السابقة');
  // ar·fr 새 문구는 원어민 검토 표식과 함께
  for (const f of ['../js/i18n/ar.js', '../js/i18n/fr.js']) {
    const s = read(f); const at = s.indexOf("'reader.chrome.open'");
    assert.match(s.slice(s.lastIndexOf('/*', at), at), /\[검토 — Nour·운영자\]/);
  }
});

/* ── L10 ──────────────────────────────────────────── */
test('L10 전체 화면 — 글자 키 · API 감지 · 저장 안 함 · 사용자 탭 안에서만 · 방향 잠금 없음', () => {
  assert.equal(fullscreenKey(false), 'reader.fullscreen.on');
  assert.equal(fullscreenKey(true), 'reader.fullscreen.off');
  assert.equal(canFullscreen(null), false);
  assert.equal(canFullscreen({ fullscreenEnabled: false, documentElement: { requestFullscreen() {} } }), false);
  assert.equal(canFullscreen({ fullscreenEnabled: true, documentElement: {} }), false);
  assert.equal(canFullscreen({ fullscreenEnabled: true, documentElement: { requestFullscreen() {} } }), true);
  const src = noComments(read('../js/ui/typeset.js'));
  const fs = src.slice(src.indexOf('function initFullscreen'));
  assert.ok(!/settings\.|store\(|localStorage/.test(fs), '저장하지 않는다(다음 실행에 저절로 들어가지 않는다)');
  assert.ok(!/orientation/.test(fs), 'screen.orientation.lock 을 쓰지 않는다');
  // requestFullscreen 은 단추 click 리스너 안에서만 불린다
  const calls = [...fs.matchAll(/requestFullscreen\(/g)].map((m) => m.index);
  const click = fs.indexOf("addEventListener('click'"); const clickEnd = fs.indexOf('});', click);
  assert.equal(calls.length, 1);
  assert.ok(calls[0] > click && calls[0] < clickEnd);
  assert.match(fs, /requestFullscreen\(\{ navigationUI: 'hide' \}\)/);
  assert.match(fs, /addEventListener\('fullscreenchange'/);
});

/* ── L11 ──────────────────────────────────────────── */
test('L11 reader.js 배선 — initChrome 한 번, 회전(compact 바뀜)에만 편안 영역 다시 맞춤, 회전이 낳은 스크롤 쉼은 되돌린다', () => {
  const src = read('../js/ui/reader.js');
  assert.match(src, /import \{ initChrome \} from '\.\/chrome\.js';/);
  assert.equal([...src.matchAll(/initChrome\(/g)].length, 1);
  const at = src.indexOf('initChrome({');
  const body = src.slice(at, src.indexOf('} });', at));
  assert.match(body, /onCompactChange:/);
  assert.match(body, /Date\.now\(\) - \(state\.scrollPausedAt \|\| 0\) < 100/);
  assert.match(body, /!state\.scrollPaused && settings\.get\('reader\.autoScroll'\) !== false/);
  assert.match(body, /scrollToCurrent\(false\)/, '강제 스크롤이 아니다 — 이미 편안 영역이면 그대로');
  const any = src.slice(src.indexOf('function onAnyScroll'), src.indexOf('function onAnyScroll') + 700);
  assert.match(any, /state\.scrollPaused = true;\n\s*state\.scrollPausedAt = Date\.now\(\);/);
  // [≡] 토글에는 콜백을 부르지 않는다(토글은 본문을 움직이지 않는다)
  const ch = noComments(read('../js/ui/chrome.js'));
  const clickLine = ch.slice(ch.indexOf("btn.addEventListener('click'"), ch.indexOf("btn.addEventListener('click'") + 80);
  assert.ok(!/onCompactChange/.test(clickLine));
});
