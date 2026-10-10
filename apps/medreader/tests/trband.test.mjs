/* ============================================================
   tests/trband.test.mjs — spec 16-D3 `[D]` B1~B8 중 node 에서 고정할 수 있는 것 (8b-2 하단 자막 띠)

   ★ 이 파일이 고정하는 것
     1. 띠가 무엇을 그리는가(`bandView`) — 준비됨 · 번역 중 · 이 문장은 번역 없음 · 번역 실패 + [다시 시도]
        · 막힘(사유 한 줄, [다시 시도]는 즉시 풀리는 상태에만).
     2. 경과 비율 스크롤(7-7) — `(경과 − 1s) / 예상` 을 0~1 로 자르기 · 계단(줄 높이 배수).
     3. ★ 세로 예산(7-7 · B1~B3) — **CSS 파일을 읽어 계산한다.** `--tr-band-h` 가 글자 16·22·40px 에서
        110.2·119.92·142.6px, 800×360 에서 79.2px(22dvh). 띠가 켜지면 `--reader-chrome-bottom` 이 정확히
        띠 높이만큼 늘고, 띠 아래변 = 컨트롤 바 윗변, 본문 여백·원본 상자·편안 영역 탐침이 그 토큰을 쓴다.
        (`[10b]` 결함 — "토큰이 실제보다 작아 원본 쪽 아래가 잘렸다" — 의 재발을 막는다.)
     4. bidi 격리 한 벌(`ui/bididom.js`) — 운영자 캡처 꼴 아랍어의 괄호 8개가 `<bdi dir="ltr">`, 화면엔 괄호가 남는다.
     5. 배선 — [다시 시도] → `readalong.retry()`, 모드 줄 → `syncReadalong()`(타이머 없이), 띠 자리 `sync`/`leave`.
     6. 상태 바 문구 키(14-2)가 네 언어에 있다.

   브라우저 수치(B1~B8 실측)는 보고서 `.claude/tasks/medreader-build-8b2-report.md`.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  bandView, scrollRatio, speechMs, stepScroll, noticeBanner, remoteBanner,
  RETRYABLE_REMOTE, BLOCKED_KEYS
} from '../js/ui/trband.js';
import { appendBidiText } from '../js/ui/bididom.js';
import { ltrRuns } from '../js/text/bidi.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import { TTS, READALONG } from '../js/config.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ════════════════════════════════════════════════════════
   1. 띠가 그리는 것
   ════════════════════════════════════════════════════════ */

test('TB1 상태 갈래 — idle · none(표 안내) · ready · pending · none(아직 안 물음) · failed + [다시 시도]', () => {
  assert.deepEqual(bandView(null, { hasSentence: false }),
    { state: 'idle', text: '', noteKey: 'readalong.idle', retry: false, code: null });
  assert.equal(bandView(null, { hasSentence: true, isNotice: true }).state, 'none');
  assert.equal(bandView(null, { hasSentence: true, isNotice: true }).noteKey, 'readalong.none');

  const ready = bandView({ state: 'ready', text: 'نص (C-reactive protein)' }, { hasSentence: true, remote: 'ready' });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.text, 'نص (C-reactive protein)', '화면에는 괄호 속 영어를 그대로(낭독만 뺀다 — trSpeechText)');
  assert.equal(ready.noteKey, null);
  assert.equal(ready.retry, false);

  assert.equal(bandView({ state: 'pending' }, { hasSentence: true, remote: 'inflight' }).noteKey, 'readalong.pending');
  assert.equal(bandView({ state: 'none' }, { hasSentence: true, remote: 'ready' }).state, 'pending');

  const failed = bandView({ state: 'failed', code: 'PARSE' }, { hasSentence: true, remote: 'ready' });
  assert.deepEqual([failed.state, failed.noteKey, failed.retry, failed.code], ['failed', 'readalong.failed', true, 'PARSE']);
});

test('TB2 ★ 막힘 — 사유별 한 줄 · [다시 시도]는 즉시 풀리는 상태(exhausted·cooldown·region·model)에만', () => {
  assert.deepEqual([...RETRYABLE_REMOTE].sort(), ['cooldown', 'exhausted', 'model', 'region']);
  for (const code of Object.keys(BLOCKED_KEYS)) {
    const v = bandView({ state: 'blocked', code: code }, { hasSentence: true, remote: code });
    assert.equal(v.state, 'blocked', code);
    assert.equal(v.noteKey, BLOCKED_KEYS[code], code);
    assert.equal(v.retry, RETRYABLE_REMOTE.indexOf(code) >= 0, code + ' 의 [다시 시도]');
  }
  // Gemini 429 는 Retry-After 가 거의 없어 사실상 자정까지 exhausted — [다시 시도]가 반드시 보여야 한다.
  assert.equal(bandView({ state: 'blocked', code: 'exhausted' }, { hasSentence: true }).retry, true);
  // 아직 묻지 않은 문장이라도 원격이 막혀 있으면 "번역 중…"이 아니라 막힘 한 줄(거짓 대기 표시 없음)
  const none = bandView({ state: 'none' }, { hasSentence: true, remote: 'offline' });
  assert.deepEqual([none.state, none.noteKey, none.retry], ['blocked', 'readalong.blocked.offline', false]);
});

/* ════════════════════════════════════════════════════════
   2. 경과 비율 스크롤 (7-7 · B7)
   ════════════════════════════════════════════════════════ */

test('TB3 경과 비율 — 첫 1초는 0, 예상 시간 뒤 1, 그 사이 비례 · 계단은 줄 높이 배수', () => {
  assert.equal(scrollRatio(0, 5000), 0);
  assert.equal(scrollRatio(1000, 5000), 0);
  assert.equal(scrollRatio(3500, 5000), 0.5);
  assert.equal(scrollRatio(6000, 5000), 1);
  assert.equal(scrollRatio(99999, 5000), 1);
  assert.equal(scrollRatio(3000, 0), 0, '예상 시간을 모르면 움직이지 않는다');
  // 원문 14자/초, 번역문 10자/초(가정) · 속도 반영 · 글자는 코드 포인트로 센다
  assert.equal(speechMs('a'.repeat(140), TTS.CHARS_PER_SEC, 1), 10000);
  assert.equal(speechMs('ب'.repeat(100), READALONG.CHARS_PER_SEC_TR, 2), 5000);
  assert.equal(stepScroll(100, 35.64), 71.28);
  assert.equal(stepScroll(35, 35.64), 0);
  assert.equal(stepScroll(-5, 30), 0);
});

/* ════════════════════════════════════════════════════════
   3. ★ 세로 예산 — CSS 를 읽어 계산한다 (B1~B3)
   ════════════════════════════════════════════════════════ */

const TOKENS = read('../css/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const READER = read('../css/reader.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** 선택자가 정확히 `sel` 인 규칙 블록의 본문(첫 번째). */
function ruleBody(css, sel) {
  const re = new RegExp('(^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'm');
  const m = re.exec(css);
  assert.ok(m, '규칙이 없다: ' + sel);
  const open = css.indexOf('{', m.index + m[1].length);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}
function declsOf(body) {
  const out = new Map();
  const re = /([a-z-]+|--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(body)) !== null) out.set(m[1].trim(), m[2].trim());
  return out;
}
const ROOT = declsOf(ruleBody(TOKENS, ':root'));
const ROOT_ON = declsOf(ruleBody(TOKENS, ':root[data-tr-band="on"]'));

/**
 * 아주 작은 CSS 수식 계산기 — calc·min·max·clamp·var·env, px·dvh, 사칙연산. 길이는 px 숫자로.
 * @param {string} src
 * @param {{vh:number, readerFs:number, band:boolean}} ctx
 */
function evalCss(src, ctx, depth = 0) {
  assert.ok(depth < 20, '순환: ' + src);
  const toks = src.match(/--[a-z0-9-]+|[a-z][a-z0-9-]*|\d*\.?\d+(?:px|dvh|vh)?|[()+\-*/,]/gi) || [];
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const look = (name) => {
    if (name === '--reader-fs' && ctx.readerFs != null) return String(ctx.readerFs) + 'px';
    if (ctx.band && ROOT_ON.has(name)) return ROOT_ON.get(name);
    return ROOT.get(name);
  };
  function args() {
    const out = [];
    assert.equal(next(), '(');
    if (peek() === ')') { next(); return out; }
    for (;;) {
      const start = i;
      let lvl = 0;
      while (!(lvl === 0 && (peek() === ',' || peek() === ')'))) { const tk = next(); if (tk === '(') lvl++; if (tk === ')') lvl--; }
      out.push(toks.slice(start, i));
      if (next() === ')') return out;
    }
  }
  const sub = (list) => evalCss(list.join(' '), ctx, depth + 1);
  function factor() {
    const tk = next();
    if (tk === '-') return -factor();
    if (tk === '(') { const v = expr(); assert.equal(next(), ')'); return v; }
    const num = /^(\d*\.?\d+)(px|dvh|vh)?$/i.exec(tk);
    if (num) { const v = Number(num[1]); return num[2] && /vh$/i.test(num[2]) ? v * ctx.vh / 100 : v; }
    const fn = tk.toLowerCase();
    if (fn === 'calc') { const a = args(); return sub(a[0]); }
    if (fn === 'min') return Math.min(...args().map(sub));
    if (fn === 'max') return Math.max(...args().map(sub));
    if (fn === 'clamp') { const [lo, v, hi] = args().map(sub); return Math.min(Math.max(v, lo), hi); }
    if (fn === 'env') { const a = args(); return a[1] ? sub(a[1]) : 0; }
    if (fn === 'var') {
      const a = args();
      const raw = look(a[0][0]);
      if (raw == null) { assert.ok(a[1], '정의되지 않은 변수: ' + a[0][0]); return sub(a[1]); }
      return evalCss(raw, ctx, depth + 1);
    }
    assert.fail('모르는 조각: ' + tk + ' (' + src + ')');
  }
  function term() { let v = factor(); while (peek() === '*' || peek() === '/') { const op = next(); const r = factor(); v = op === '*' ? v * r : v / r; } return v; }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  const v = expr();
  assert.equal(i, toks.length, '다 읽지 못했다: ' + src);
  return v;
}
const tok = (name, ctx) => evalCss('var(' + name + ')', ctx);
const r2 = (v) => Math.round(v * 100) / 100;

test('BUD1 ★ B1 기대값 — 띠 높이 토큰 = 110.2 · 119.92 · 142.6px(세로), 79.2px(800×360 — 22dvh)', () => {
  assert.equal(r2(tok('--tr-band-h', { vh: 800, readerFs: 16 })), 110.2);
  assert.equal(r2(tok('--tr-band-h', { vh: 800, readerFs: 22 })), 119.92);
  assert.equal(r2(tok('--tr-band-h', { vh: 800, readerFs: 40 })), 142.6);
  assert.equal(r2(tok('--tr-band-h', { vh: 740, readerFs: 22 })), 119.92);
  assert.equal(r2(tok('--tr-band-h', { vh: 360, readerFs: 22 })), 79.2);
  assert.equal(r2(tok('--tr-band-h', { vh: 360, readerFs: 40 })), 79.2);
});

test('BUD2 ★ B2 — 띠가 켜지면 --reader-chrome-bottom 이 **정확히 띠 높이만큼** 늘고, 꺼지면 138px 로 돌아온다', () => {
  for (const [vh, fs] of [[800, 16], [800, 22], [800, 40], [360, 22]]) {
    const off = tok('--reader-chrome-bottom', { vh: vh, readerFs: fs, band: false });
    const on = tok('--reader-chrome-bottom', { vh: vh, readerFs: fs, band: true });
    assert.equal(r2(off), 138, '띠가 꺼지면 원래 높이(빈 자리 없음)');
    assert.equal(r2(on - off), r2(tok('--tr-band-h', { vh: vh, readerFs: fs })), `띠 높이가 예산 합산에 빠졌다 (${vh}/${fs})`);
  }
});

test('BUD3 ★ B2 — 띠는 내용이 아니라 토큰 높이(block-size)이고, 아래변 = 컨트롤 바 윗변(겹침 0, 틈 0)', () => {
  const band = declsOf(ruleBody(READER, '.tr-band'));
  const bar = declsOf(ruleBody(READER, '.tts-bar'));
  assert.equal(band.get('block-size'), 'var(--tr-band-h)', '10b 교훈 — 높이는 토큰이 정한다(min-block-size 아님)');
  assert.equal(band.get('box-sizing'), 'border-box');
  assert.equal(band.get('overflow-y'), 'auto', '넘치는 번역은 띠 안에서 스크롤');
  for (const [vh, fs] of [[800, 22], [360, 40]]) {
    const ctx = { vh: vh, readerFs: fs, band: true };
    const bandBottomFromEnd = evalCss(band.get('inset-block-end'), ctx);
    const barTopFromEnd = evalCss(bar.get('inset-block-end'), ctx) + tok('--tts-h', ctx);
    assert.equal(r2(bandBottomFromEnd), r2(barTopFromEnd), '띠 아래변이 컨트롤 바 윗변과 같다');
    // 띠 윗변 = 아래 크롬 전체의 윗변 = 본문 영역의 아래 끝
    assert.equal(r2(bandBottomFromEnd + tok('--tr-band-h', ctx)), r2(tok('--reader-chrome-bottom', ctx)));
  }
});

test('BUD4 ★ B3·B4 — 소비처가 모두 --reader-chrome-bottom 하나를 쓴다(본문 여백 · 원본 상자 · 편안 영역 탐침 · scroll-padding · 팝오버)', () => {
  const reflow = declsOf(ruleBody(READER, '.screen[data-screen="reader"]'));
  const ctx = { vh: 800, readerFs: 22, band: true };
  // 리플로우: body 가 고지 높이만큼 비워 두므로 화면 여백 + 고지 = 아래 크롬 전체
  assert.equal(r2(evalCss(reflow.get('padding-block-end'), ctx) + tok('--notice-total', ctx)), r2(tok('--reader-chrome-bottom', ctx)));
  // 원본 뷰 flex 상자 — canvas 아래변이 띠 윗변을 넘지 않는 근거(B3)
  const orig = declsOf(ruleBody(READER, 'body[data-reader-view="original"] .screen[data-screen="reader"]'));
  assert.equal(r2(evalCss(orig.get('padding-block-end'), ctx)), r2(tok('--reader-chrome-bottom', ctx)));
  // 편안 영역 아래 경계 탐침(reader.js bodyArea)
  const probe = declsOf(ruleBody(READER, '.chrome-probe'));
  assert.equal(r2(evalCss(probe.get('block-size'), ctx)), r2(tok('--reader-chrome-bottom', ctx)));
  // scroll-padding(6-5) — 리더가 보일 때만
  const sp = declsOf(ruleBody(READER, 'html:has(.screen[data-screen="reader"]:not([hidden]))'));
  assert.equal(r2(evalCss(sp.get('scroll-padding-block-end'), ctx)), r2(tok('--reader-chrome-bottom', ctx)));
  assert.equal(sp.get('scroll-padding-block-start'), 'var(--bar-top)');
  // 팝오버 두 개
  for (const sel of ['.typeset-panel', '.tts-rate-panel']) {
    assert.match(declsOf(ruleBody(READER, sel)).get('inset-block-end'), /var\(--reader-chrome-bottom\)/, sel);
  }
  // reader.js 편안 영역이 창 높이가 아니라 본문 영역을 쓴다
  const rj = strip(read('../js/ui/reader.js'));
  const fn = rj.slice(rj.indexOf('function scrollToCurrent'), rj.indexOf('function sentenceExtent'));
  assert.match(fn, /const area = bodyArea\(vh\)/);
  assert.match(fn, /ext\.bottom <= area\.bottom - BODY_EDGE_PX/, '문장 끝이 띠에 가리면 편안 영역 밖');
  assert.ok(!/vh \* TTS\.COMFORT_TOP/.test(fn), '창 높이 비율(옛 판정)이 남아 있다');
});

/* ════════════════════════════════════════════════════════
   4. bidi 격리 한 벌 (B6 · 10-08 결정)
   ════════════════════════════════════════════════════════ */

/** appendBidiText 가 쓰는 만큼만의 가짜 DOM. 조각은 textContent 로만 들어온다. */
function fakeEl() {
  const doc = {
    createElement: (tag) => ({ tagName: tag.toUpperCase(), dir: '', textContent: '', nodeType: 1 }),
    createTextNode: (s) => ({ nodeType: 3, textContent: s })
  };
  const el = {
    ownerDocument: doc, kids: [], _text: null,
    appendChild(n) { this.kids.push(n); return n; },
    set textContent(v) { this._text = String(v); this.kids = []; },
    get textContent() { return this._text !== null && !this.kids.length ? this._text : this.kids.map((k) => k.textContent).join(''); }
  };
  return el;
}

/** 운영자 캡처(2026-10-08) 꼴의 아랍어 — 괄호 묶음 8개. tests/bidi.test.mjs 와 같은 글. */
const AR = 'التهاب المفاصل الروماتويدي (rheumatoid arthritis) هو مرض مناعي ذاتي مزمن (chronic autoimmune disease) ' +
  'غالباً ما يسبب تيبساً صباحياً (morning stiffness) يستمر لأكثر من 30 دقيقة. ميثوتريكسات (methotrexate) ' +
  'واداليموماب (adalimumab) هما دواءان معدلان للمرض (disease-modifying drugs)، وقد تظهر فحوصات الدم (blood tests) ' +
  'مستوى بروتين التفاعل سي (C-reactive protein) أعلى من 10 ملغ/لتر.';

test('BD1 ★ rtl 블록 — 괄호 8개가 각각 <bdi dir="ltr">, 화면 글자는 원문 그대로(괄호 포함)', () => {
  const el = fakeEl();
  appendBidiText(el, AR, 'rtl');
  const bdi = el.kids.filter((k) => k.tagName === 'BDI');
  assert.equal(bdi.length, 8);
  assert.ok(bdi.every((b) => b.dir === 'ltr'));
  assert.ok(bdi.every((b) => b.textContent.startsWith('(') && b.textContent.endsWith(')')), '괄호까지 한 조각');
  assert.equal(el.textContent, AR, '글자를 잃거나 더하지 않는다 — 화면엔 괄호 속 영어가 그대로');
  assert.ok(el.kids.every((k) => k.tagName === 'BDI' || k.nodeType === 3), 'bdi 와 텍스트 노드만');
  assert.equal(bdi.length, ltrRuns(AR).filter((r) => r.ltr).length, 'ltrRuns 판정 그대로');
});

test('BD2 ltr 블록(ko) — 격리 없이 textContent 한 번 · HTML 은 글자로', () => {
  const el = fakeEl();
  appendBidiText(el, '류마티스 관절염(rheumatoid arthritis)', 'ltr');
  assert.equal(el.kids.length, 0);
  assert.equal(el.textContent, '류마티스 관절염(rheumatoid arthritis)');
  const x = fakeEl();
  appendBidiText(x, '<img src=x onerror=alert(1)> نص', 'rtl');
  assert.equal(x.textContent, '<img src=x onerror=alert(1)> نص', '태그가 글자로 남는다');
  assert.ok(x.kids.every((k) => k.tagName !== 'IMG'));
});

test('BD3 ★ 규칙 한 벌 — 설정 [시험 번역]과 자막 띠가 같은 함수(ui/bididom.js)를 쓰고 어디에도 복사본이 없다', () => {
  const s = strip(read('../js/ui/settings.js'));
  const tb = strip(read('../js/ui/trband.js'));
  const bd = strip(read('../js/ui/bididom.js'));
  assert.match(s, /import \{ appendBidiText \} from '\.\/bididom\.js'/);
  assert.match(tb, /import \{ appendBidiText \} from '\.\/bididom\.js'/);
  assert.ok(!/function appendBidiText/.test(s) && !/function appendBidiText/.test(tb), '복사본이 있다');
  assert.ok(!/ltrRuns/.test(s) && !/ltrRuns/.test(tb), '조각 나누기를 따로 부르지 않는다');
  assert.match(s, /appendBidiText\(body, r\.pair\[code\], a\.dir\)/);
  assert.match(tb, /appendBidiText\(tx, v\.text, a\.dir\)/);
  // 공용 함수의 몸 — rtl 일 때만 bdi, 조각마다 textContent, innerHTML 0
  assert.match(bd, /if \(dir !== 'rtl'\) \{ el\.textContent = s; return; \}/);
  assert.match(bd, /createElement\('bdi'\)/);
  assert.match(bd, /iso\.dir = 'ltr'/);
  assert.match(bd, /iso\.textContent = /);
  for (const src of [bd, tb]) assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(src), 'innerHTML 계열 0건(13절)');
  // 번역문 블록 dir·lang 은 대상 언어에서(ar 을 박지 않는다)
  assert.match(tb, /translationBlockAttrs\(targetLang\(\)\)/);
  assert.ok(!/'ar'/.test(tb), "trband.js 에 'ar' 리터럴이 있다");
});

/* ════════════════════════════════════════════════════════
   5. 배선
   ════════════════════════════════════════════════════════ */

test('WB1 ★ [다시 시도] → readalong.retry() — 띠 하나의 위임(data-tr-action), onclick 0, 자동 호출 0', () => {
  const tb = strip(read('../js/ui/trband.js'));
  const html = read('../index.html');
  assert.match(html, /<button type="button" class="tr-retry" id="trRetry" data-tr-action="retry"/);
  assert.match(tb, /if \(b\.getAttribute\('data-tr-action'\) === 'retry'\) onRetry\(b\);/);
  const fn = tb.slice(tb.indexOf('function onRetry'), tb.indexOf('function expectedFor'));
  assert.match(fn, /\.then\(\(\) => ra\.retry\(\)\)/, 'onRetry 가 readalong.retry() 를 부른다');
  assert.equal((tb.match(/\.retry\(\)/g) || []).length, 1, 'retry() 는 버튼 경로 한 곳에서만');
  assert.ok(!/onclick/.test(tb));
  // 띠 자리 — #ttsBar 바로 앞, region, aria-live 없음(7-7), 기본 숨김
  const at = html.indexOf('id="trBand"');
  assert.ok(at > 0 && at < html.indexOf('id="ttsBar"'));
  const tag = html.slice(html.lastIndexOf('<div', at), html.indexOf('>', at) + 1);
  assert.match(tag, /role="region"/);
  assert.match(tag, /data-i18n-aria="readalong\.band"/);
  assert.match(tag, /\shidden>/);
  assert.ok(!/aria-live/.test(tag));
});

test('WB2 ★ controls — 띠 생성 한 줄 · syncReadalong 끝에 sync · 떠날 때 leave · 모드 줄은 팝오버 버블 단계에서 동기 syncReadalong(타이머 없음)', () => {
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /import \{ initTrBand \} from '\.\/trband\.js'/);
  assert.match(c, /trband = initTrBand\(\{ readalong: readalong, speaker: speaker \}\)/);
  const sync = c.slice(c.indexOf('function syncReadalong'), c.indexOf('function requestWakeLock'));
  assert.match(sync, /speaker\.setReadalong\(\{ mode: em\.mode, speakSource: st\.speakSource \}\);\s*if \(trband\) trband\.sync\(\);/);
  const leave = c.slice(c.indexOf('export function leaveControls'), c.indexOf('function restoreSettings'));
  assert.match(leave, /if \(trband\) trband\.leave\(\);/);
  assert.match(c, /els\.ratePanel\.addEventListener\('click', \(ev\) => \{[\s\S]{0,200}\[data-readalong-mode\], \[data-readalong-source\][\s\S]{0,120}syncReadalong\(\);/);
  assert.ok(!/setTimeout\(syncReadalong/.test(c), '한 박자 뒤(타이머) 대신 DOM 전파 순서로');
  // 띠는 speaker 를 조작하지 않는다(8b-1 계약)
  const tb = strip(read('../js/ui/trband.js'));
  assert.ok(!/sp\.(play|pause|stop|next|prev|setReadalong|setRate)\(/.test(tb));
});

test('WB3 띠 자리 — html[data-tr-band="on"] 을 sync 가 걸고 leave 가 뗀다(다른 화면 예산을 건드리지 않음)', () => {
  const tb = strip(read('../js/ui/trband.js'));
  const sync = tb.slice(tb.indexOf('export function sync'), tb.indexOf('export function leave'));
  assert.match(sync, /if \(visible\) root\.setAttribute\('data-tr-band', 'on'\);\s*else root\.removeAttribute\('data-tr-band'\);/);
  assert.match(sync, /els\.band\.hidden = !visible;/);
  const leave = tb.slice(tb.indexOf('export function leave'), tb.indexOf('function onLine'));
  assert.match(leave, /document\.documentElement\.removeAttribute\('data-tr-band'\)/);
});

/* ════════════════════════════════════════════════════════
   6. 상태 바 (14-2) — 문구 키
   ════════════════════════════════════════════════════════ */

test('NB1 ★ 안내·원격 상태 → 배너 키 — 네 언어에 있고, 지역 제한엔 [키 설정]이 없다', () => {
  const codes = ['consent', 'unsupported-lang', 'same-lang', 'line-mode', 'no-key', 'no-voice'];
  const states = ['offline', 'exhausted', 'capped', 'cooldown', 'region', 'model', 'no-key'];
  const keys = new Set();
  for (const c of codes) { const b = noticeBanner(c, 'ar'); assert.ok(b && b.key, c); keys.add(b.key); (b.actions || []).forEach((a) => keys.add(a.key)); }
  for (const s of states) { const b = remoteBanner(s, { providerLabel: 'Google Gemini', cap: 100 }); assert.ok(b && b.key, s); keys.add(b.key); (b.actions || []).forEach((a) => keys.add(a.key)); }
  for (const k of Object.values(BLOCKED_KEYS)) keys.add(k);
  for (const k of ['readalong.band', 'readalong.idle', 'readalong.pending', 'readalong.failed', 'readalong.none', 'readalong.retry', 'readalong.lagging']) keys.add(k);
  for (const lang of LANGS) {
    for (const k of keys) assert.ok(typeof BUNDLES[lang][k] === 'string' && BUNDLES[lang][k].length > 0, lang + ' ' + k);
  }
  assert.equal(remoteBanner('ready'), null, '회복이면 거둔다');
  assert.deepEqual(remoteBanner('region', { providerLabel: 'Google Gemini' }).actions, [], '지역 제한에 [키 설정]을 붙이지 않는다(14-2)');
  assert.equal(remoteBanner('region', { providerLabel: 'Google Gemini' }).params.provider, 'Google Gemini');
  assert.equal(remoteBanner('capped', { cap: 300 }).params.cap, '300');
  assert.equal(noticeBanner('no-voice', 'ar').params.lang, 'العربية', '자국어 이름');
  assert.equal(noticeBanner('off'), null, '사용자가 끈 것은 안내하지 않는다');
});
