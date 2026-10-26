/* ============================================================
   tests/inlinetr-8d.test.mjs — 8d 문장 아래 번역(대역) (spec 7-7-1 · 6-5 · 수용 기준 8d `[N]`)

   ★ 이 파일이 고정하는 것
     1. I1 — 블록은 `span.line` 의 **다음 형제**로만 들어간다. 넣기 전후 `paintCharRanges` 가 만드는 Range 의
        시작·끝 노드·오프셋이 같고, 줄 찾기(`span.line[data-flow="1"]`)·줄 span 의 자식 구조가 같다.
     2. I2 — 한 줄에서 두 문장이 끝나면 블록 두 개가 그 줄 다음에 seg 순서로. 300자 분할 문장은 마지막 조각의
        마지막 줄 다음.
     3. `[8m]` 대상 언어와 같은 언어의 단위는 블록이 없다(상태 줄도 없다).
     4. ★ 키 함수 공유 — 문장 아래 표시가 읽는 캐시 키는 readalong refill 이 쓰는 **바로 그 호출**이다. 요청 0.
     5. `ui/inlinetr.js` 는 `ai/pipeline.js` 를 (간접으로도) import 하지 않는다 · `innerHTML` 0 · 번역문은 `appendBidiText`.
     6. 화면 흐름(가짜 DOM) — 쪽 그림(I4 (i)) · 현재가 될 때(I4 (ii)) · 지나간 문장의 늦은 번역은 "눌러서 보기"(I4 (iii)) ·
        현재 블록이 늦게 채워지면 편안 영역 다시 보기 · 지우기(I7) · 띠 자리 속성.
   브라우저 실측(`[D]`)은 보고서 `.claude/tasks/medreader-build-8d-report.md`.
   픽스처 문장은 전부 지어낸 것이다(16-I).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildUnits } from '../js/tts/text.js';
import { paintCharRanges } from '../js/ui/charhl.js';
import { createReadalong } from '../js/ai/readalong.js';
import { noteKeyFor, bandView } from '../js/ui/trband.js';
import * as settings from '../js/settings.js';
import { DEFAULTS } from '../js/settings.js';
import { normalizeReadalongDisplay, READALONG_DISPLAYS, readalongState } from '../js/ui/settings.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ════════════════════════════════════════════════════════
   0. 아주 작은 가짜 DOM — 이 파일이 쓰는 만큼만
   ════════════════════════════════════════════════════════ */

class FNode {
  constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; }
  appendChild(n) { return this.insertBefore(n, null); }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    if (ref && i < 0) throw new Error('ref 가 자식이 아니다');
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i < 0) throw new Error('자식이 아니다'); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  get isConnected() { let x = this; while (x.parentNode) x = x.parentNode; return x === this.ownerDocument.documentElement; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; if (v !== '' && v != null) this.appendChild(this.ownerDocument.createTextNode(String(v))); }
}
class FText extends FNode {
  constructor(doc, s) { super(doc); this.nodeType = 3; this.data = String(s); }
  get length() { return this.data.length; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
}
class FElement extends FNode {
  constructor(doc, tag) { super(doc); this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.attrs = new Map(); this.listeners = {}; this.disabled = false; this.type = ''; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() {
    const el = this;
    const list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c) => list().indexOf(c) >= 0,
      add: (c) => { if (list().indexOf(c) < 0) el.className = list().concat(c).join(' '); },
      remove: (c) => { el.className = list().filter((x) => x !== c).join(' '); }
    };
  }
  set dir(v) { this.setAttribute('dir', v); }
  get dir() { return this.getAttribute('dir') || ''; }
  set lang(v) { this.setAttribute('lang', v); }
  get lang() { return this.getAttribute('lang') || ''; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  addEventListener(t, fn) { (this.listeners[t] || (this.listeners[t] = [])).push(fn); }
  click() { const ev = { target: this, type: 'click' }; for (let x = this; x; x = x.parentNode) for (const fn of (x.listeners && x.listeners.click) || []) fn(ev); }
  matches(sel) { return matchSel(this, sel); }
  closest(sel) { for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (matchSel(x, sel)) return x; return null; }
  querySelectorAll(sel) { const out = []; walk(this, (n) => { if (n !== this && n.nodeType === 1 && matchSel(n, sel)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function walk(n, fn) { fn(n); for (const c of n.childNodes) walk(c, fn); }
function parseCompound(s) {
  const m = { tag: null, classes: [], attrs: [] };
  const re = /^([a-z][a-z0-9]*)|\.([a-z0-9_-]+)|\[([a-z0-9_-]+)(?:="([^"]*)")?\]/gi;
  let x;
  while ((x = re.exec(s)) !== null) {
    if (x[1]) m.tag = x[1].toUpperCase();
    else if (x[2]) m.classes.push(x[2]);
    else m.attrs.push([x[3], x[4]]);
  }
  return m;
}
function matchOne(el, c) {
  if (!el || el.nodeType !== 1) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  for (const k of c.classes) if (!el.classList.contains(k)) return false;
  for (const [k, v] of c.attrs) { if (!el.hasAttribute(k)) return false; if (v !== undefined && el.getAttribute(k) !== v) return false; }
  return true;
}
function matchSel(el, sel) {
  const parts = sel.trim().split(/\s+/).map(parseCompound);
  if (!matchOne(el, parts[parts.length - 1])) return false;
  let x = el.parentNode;
  for (let i = parts.length - 2; i >= 0; i--) {
    while (x && !matchOne(x, parts[i])) x = x.parentNode;
    if (!x) return false;
    x = x.parentNode;
  }
  return true;
}
function makeDoc() {
  const doc = { listeners: {} };
  doc.createElement = (t) => new FElement(doc, t);
  doc.createTextNode = (s) => new FText(doc, s);
  doc.documentElement = new FElement(doc, 'html');
  doc.body = doc.documentElement.appendChild(new FElement(doc, 'body'));
  doc.addEventListener = (t, fn) => { (doc.listeners[t] || (doc.listeners[t] = [])).push(fn); };
  doc.dispatchEvent = (ev) => { for (const fn of doc.listeners[ev.type] || []) fn(ev); return true; };
  doc.createRange = () => ({ setStart(n, o) { this.startContainer = n; this.startOffset = o; }, setEnd(n, o) { this.endContainer = n; this.endOffset = o; } });
  return doc;
}

/** 리더 `paraEl`·`lineEl` 과 같은 모양(줄 사이 공백은 앞 줄 span 안 — reader.js). */
function renderPara(doc, para) {
  const p = doc.createElement('p');
  p.className = 'para';
  p.setAttribute('data-para-id', para.id);
  para.lines.forEach((ln, i) => {
    const s = doc.createElement('span');
    s.className = 'line';
    s.setAttribute('data-line-id', ln.id);
    s.setAttribute('data-flow', '1');
    s.textContent = ln.text;
    if (i < para.lines.length - 1) s.appendChild(doc.createTextNode(' '));
    p.appendChild(s);
  });
  return p;
}
function renderPage(doc, pageNo, paras) {
  const art = doc.createElement('article');
  art.className = 'reflow';
  const sec = doc.createElement('section');
  sec.className = 'page';
  sec.setAttribute('data-page', String(pageNo));
  art.appendChild(sec);
  for (const pa of paras) sec.appendChild(renderPara(doc, pa));
  return art;
}
const lineFinder = (root) => (id) => root.querySelectorAll('span.line[data-flow="1"]').filter((n) => n.getAttribute('data-line-id') === String(id))[0] || null;

function withHighlights(fn) {
  const saved = { CSS: globalThis.CSS, Highlight: globalThis.Highlight, document: globalThis.document };
  const reg = new Map();
  globalThis.CSS = { highlights: { set: (k, v) => reg.set(k, v), get: (k) => reg.get(k), delete: (k) => reg.delete(k) } };
  globalThis.Highlight = class { constructor(...r) { this.ranges = r; } };
  try { return fn(reg); } finally { Object.assign(globalThis, saved); if (saved.CSS === undefined) delete globalThis.CSS; if (saved.Highlight === undefined) delete globalThis.Highlight; if (saved.document === undefined) delete globalThis.document; }
}

const ln = (id, text) => ({ id: id, text: text, hyphen: 'none' });
const PARA = { id: 'p1', kind: 'body', lines: [
  ln('9:1', 'The fever began on Monday. It rose at'),
  ln('9:2', 'night and fell by noon. Rest helps. Fluids'),
  ln('9:3', 'are given when needed.')
] };

/* ════════════════════════════════════════════════════════
   1. I2 앵커 · I1 삽입 계약
   ════════════════════════════════════════════════════════ */

const IT = await import('../js/ui/inlinetr.js');

test('D1 ★ I2 — 한 줄에서 두 문장이 끝나면 그 줄이 둘의 앵커 · 블록 두 개가 그 줄 다음에 seg 순서로', () => {
  const units = buildUnits([PARA], 'sentence');
  assert.deepEqual(units.map((u) => u.seg), [0, 1, 2, 3]);
  const a = IT.anchorsOf(units);
  assert.deepEqual(a, [{ seg: 0, anchor: '9:1' }, { seg: 1, anchor: '9:2' }, { seg: 2, anchor: '9:2' }, { seg: 3, anchor: '9:3' }]);

  const doc = makeDoc();
  const art = renderPage(doc, 9, [PARA]);
  const find = lineFinder(art);
  // 일부러 거꾸로 넣는다 — 그래도 seg 순서로 쌓여야 한다.
  for (const it of [a[2], a[1]]) {
    const b = IT.makeBlock(doc, it.seg, 'ar');
    IT.renderReady(b, 'ترجمة ' + it.seg, 'ar');
    assert.equal(IT.placeBlock(find(it.anchor), b), true);
  }
  const p = art.querySelector('p.para');
  const order = p.childNodes.map((n) => (n.classList.contains('line') ? 'L' + n.getAttribute('data-line-id') : 'B' + n.getAttribute('data-ra-seg')));
  assert.deepEqual(order, ['L9:1', 'L9:2', 'B1', 'B2', 'L9:3']);
});

test('D1b 행 표 이름표의 쪽 번호(span.rt-ref — 줄 아님)는 줄에 붙어 있고 블록은 그 뒤에', () => {
  const doc = makeDoc();
  const art = renderPage(doc, 25, [{ id: 'r', kind: 'rowhead', lines: [ln('25:1', 'Kidney injury, acute')] }]);
  const p = art.querySelector('p.para');
  const ref = doc.createElement('span');
  ref.className = 'rt-ref';
  ref.textContent = '912';
  p.appendChild(ref);
  const b = IT.makeBlock(doc, 0, 'ar');
  IT.placeBlock(lineFinder(art)('25:1'), b);
  assert.deepEqual(p.childNodes.map((n) => n.className), ['line', 'rt-ref', 'ra-tr']);
});

test('D2 I2 — 300자 분할 문장(ranges 없음)은 마지막 조각의 lineIds 마지막 줄 다음 · 표 안내는 앵커가 아니다', () => {
  const w = 'alpha beta gamma delta epsilon zeta eta theta iota kappa';
  const lines = [];
  for (let i = 0; i < 8; i++) lines.push(ln('4:' + (i + 1), w + (i === 7 ? ' stops here. Next one' : '')));
  lines.push(ln('4:9', 'is short.'));
  const units = buildUnits([{ id: 'p', kind: 'body', lines: lines }], 'sentence');
  const long = units.filter((u) => u.seg === 0);
  assert.ok(long.length >= 2, '300자 분할이 일어나야 한다');
  assert.ok(long.every((u) => !u.ranges), '분할 조각에는 ranges 가 없다(6-5)');
  const a = IT.anchorsOf(units);
  assert.deepEqual(a[0], { seg: 0, anchor: long[long.length - 1].lineIds[long[long.length - 1].lineIds.length - 1] });
  assert.equal(a[0].anchor, '4:8');
  assert.deepEqual(a[1], { seg: 1, anchor: '4:9' });
  // 표 안내(seg 없음 · tablenotice: 줄)·인용(seg 없음)은 빠진다
  const extra = units.concat([{ kind: 'table-notice', seg: null, lineIds: ['tablenotice:r1'] }, { seg: null, cite: true, lineIds: ['4:9'] }]);
  assert.deepEqual(IT.anchorsOf(extra), a);
});

test('D3 ★ I1 — 블록을 넣어도 paintCharRanges 의 Range(노드·오프셋)·줄 찾기·줄 span 자식이 같다', () => {
  const units = buildUnits([PARA], 'sentence');
  const doc = makeDoc();
  const art = renderPage(doc, 9, [PARA]);
  doc.documentElement.appendChild(art);
  const find = lineFinder(art);
  const snapshot = () => withHighlights((reg) => {
    globalThis.document = doc;
    const out = [];
    for (const u of units) {
      assert.equal(paintCharRanges('t', u.ranges, find), true);
      out.push(reg.get('t').ranges.map((r) => [r.startContainer, r.startOffset, r.endContainer, r.endOffset]));
    }
    return out;
  });
  const lines = art.querySelectorAll('span.line[data-flow="1"]');
  const kidsBefore = lines.map((s) => s.childNodes.slice());
  const before = snapshot();
  const idsBefore = lines.map((s) => s.getAttribute('data-line-id'));

  for (const it of IT.anchorsOf(units)) {
    const b = IT.makeBlock(doc, it.seg, 'ar');
    IT.renderReady(b, 'ترجمة (C-reactive protein) ' + it.seg, 'ar');
    IT.placeBlock(find(it.anchor), b);
  }
  const blocks = art.querySelectorAll('.ra-tr');
  assert.equal(blocks.length, 4);
  const after = snapshot();
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i].length, before[i].length);
    for (let j = 0; j < before[i].length; j++) {
      assert.equal(after[i][j][0], before[i][j][0], '시작 노드가 같은 텍스트 노드');
      assert.equal(after[i][j][1], before[i][j][1]);
      assert.equal(after[i][j][2], before[i][j][2], '끝 노드가 같은 텍스트 노드');
      assert.equal(after[i][j][3], before[i][j][3]);
    }
  }
  // 줄 찾기 불변 · 줄 span 의 자식(첫 텍스트 노드·이음 공백)이 그대로 · 블록은 줄이 아니다
  const lines2 = art.querySelectorAll('span.line[data-flow="1"]');
  assert.deepEqual(lines2.map((s) => s.getAttribute('data-line-id')), idsBefore);
  lines2.forEach((s, i) => { assert.equal(s.childNodes.length, kidsBefore[i].length); s.childNodes.forEach((c, k) => assert.equal(c, kidsBefore[i][k])); });
  for (const b of blocks) {
    assert.equal(b.parentNode.tagName, 'P', '블록의 부모는 p.para');
    assert.ok(b.parentNode.classList.contains('para'));
    assert.equal(b.closest('span.line'), null, '줄 span 안에 있지 않다');
    assert.equal(b.tagName, 'SPAN');
    assert.equal(b.classList.contains('line'), false);
    assert.equal(b.hasAttribute('data-line-id') || b.hasAttribute('data-flow'), false);
    assert.equal(b.querySelector('[data-line-id]'), null);
    // 블록 안을 눌러도 줄 탭(closest)이 잡히지 않는다
    assert.equal(b.firstChild.closest('span.line[data-flow="1"]'), null);
    // 아랍어 — 괄호 속 영어가 bdi 한 묶음(appendBidiText)
    assert.equal(b.getAttribute('dir'), 'rtl');
    assert.equal(b.getAttribute('lang'), 'ar');
    const bdi = b.querySelectorAll('bdi');
    assert.ok(bdi.some((x) => x.textContent.indexOf('C-reactive protein') >= 0), 'C-reactive protein 이 bdi 하나에');
  }
});

test('D4 inlineOn — inline · show/speak · 리플로우일 때만(원본 뷰·band·off 는 띠)', () => {
  assert.equal(IT.inlineOn('inline', 'speak', true), true);
  assert.equal(IT.inlineOn('inline', 'show', true), true);
  assert.equal(IT.inlineOn('inline', 'speak', false), false, '원본 뷰는 늘 띠');
  assert.equal(IT.inlineOn('band', 'speak', true), false);
  assert.equal(IT.inlineOn('inline', 'off', true), false);
  assert.equal(IT.inlineOn('weird', 'speak', true), false, '모르는 값 = 기본 band');
});

test('D5 상태 줄 — "번역 중…"·"번역 실패 [다시 시도]"·"눌러서 보기" 가 모두 한 줄(.ra-line 하나) · 문구 규칙은 띠와 한 벌(noteKeyFor)', () => {
  const doc = makeDoc();
  const b = IT.makeBlock(doc, 3, 'ar');
  IT.renderNote(b, noteKeyFor({ state: 'pending' }, { hasSentence: true, remote: 'inflight' }));
  assert.equal(b.getAttribute('data-state'), 'pending');
  assert.equal(b.children.length, 1);
  assert.equal(b.children[0].className, 'ra-line');
  IT.renderNote(b, noteKeyFor({ state: 'failed', code: 'PARSE' }, { hasSentence: true, remote: 'ready' }));
  assert.equal(b.children.length, 1);
  assert.ok(b.querySelector('button.ra-retry[data-ra-action="retry"]'));
  IT.renderArrived(b);
  assert.equal(b.getAttribute('data-state'), 'arrived');
  assert.equal(b.children.length, 1);
  assert.ok(b.querySelector('.ra-line button.ra-show[data-ra-action="show"]'));
  // noteKeyFor 는 bandView 와 같은 갈래(블록·띠 문구 한 벌)
  for (const [rec, ctx] of [[{ state: 'pending' }, { hasSentence: true }], [{ state: 'failed' }, { hasSentence: true }],
    [{ state: 'blocked', code: 'offline' }, { hasSentence: true }], [{ state: 'none' }, { hasSentence: true, remote: 'capped' }]]) {
    const v = bandView(rec, ctx);
    assert.deepEqual(noteKeyFor(rec, ctx), { state: v.state, noteKey: v.noteKey, retry: v.retry });
  }
  // CSS — 세 상태 줄 높이가 --tap 하나 · 블록은 overflow-anchor none · 줄을 쪼개지 않는 display:block
  const css = read('../css/reader.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf('}', i)); };
  assert.match(rule('.reflow .ra-tr .ra-line'), /block-size:\s*var\(--tap\)/);
  assert.match(rule('.reflow .ra-tr .ra-line'), /white-space:\s*nowrap/);
  assert.match(rule('.reflow .ra-tr'), /overflow-anchor:\s*none/);
  assert.match(rule('.reflow .ra-tr'), /display:\s*block/);
  assert.match(rule('.reflow .ra-tr'), /unicode-bidi:\s*plaintext/);
  assert.match(rule('.reflow .ra-tr'), /font-size:\s*var\(--tr-fs\)/);
});

/* ════════════════════════════════════════════════════════
   2. 서비스 — `[8m]` 같은 언어 · 키 함수 공유 · 호출 0
   ════════════════════════════════════════════════════════ */

function fakePipeline() {
  const calls = [];
  let st = 'ready';
  return {
    calls: calls,
    translate: async (items) => { calls.push(items.map((x) => x.text)); return { results: items.map((x, i) => ({ state: 'ready', text: 'T' + i })) }; },
    state: () => st,
    onState: () => () => { },
    retry: async () => st
  };
}

const MIX = [
  { id: 'a', kind: 'body', lines: [ln('5:1', 'The heart pumps blood. Rest is good.')] },
  { id: 'b', kind: 'body', lines: [ln('5:2', '심장은 피를 보내고 쉬는 것이 좋다고 한다.')] },
  { id: 'c', kind: 'body', lines: [ln('5:3', 'Drink water often.')] }
];

test('D6 ★ `[8m]` 대상 언어와 같은 언어의 단위 — translatable 거짓 · 앵커 없음 · readyNow/cachedFor 에도 없음', async () => {
  const units = buildUnits(MIX, 'sentence', { lang: 'en', scriptSwitch: true });
  const ko = units.filter((u) => u.lang === 'ko');
  assert.equal(ko.length, 1, '한글 단위 하나(8m 판별)');
  const mem = new Map();
  const ra = createReadalong({ pipeline: fakePipeline(), cache: { getMany: async () => mem }, keyFor: async (d, s, t, k) => [d, s, t, k].join('|'), getSetting: () => undefined, saveReadStats: async () => { } });
  ra.setDoc({ docId: 'D', lang: 'en', target: 'ko', pageCount: 9 });
  assert.equal(ra.translatable(ko[0]), false);
  assert.ok(units.filter((u) => u.lang !== 'ko').every((u) => ra.translatable(u)));
  assert.equal(ra.translatable({ seg: null, src: 'x' }), false, '표 안내·인용(seg 없음)');
  const a = IT.anchorsOf(units, (u) => ra.translatable(u));
  assert.ok(a.every((x) => x.seg !== ko[0].seg));
  assert.equal(a.length, units.length - 1);
  // 캐시에 모든 문장이 있어도 같은 언어 단위는 돌려주지 않는다
  for (const u of units) mem.set(['D', u.src, 'ko', 'readalong'].join('|'), { result: 'X' });
  const hits = await ra.cachedFor(units);
  assert.equal(hits.has(ko[0].seg), false);
  assert.equal(hits.size, units.length - 1);
  // 대상이 ar 이면 한국어 단위도 번역 대상(문서 언어와도 대상과도 다른 언어 — src 항목)
  ra.setDoc({ docId: 'D', lang: 'en', target: 'ar', pageCount: 9 });
  assert.equal(ra.translatable(ko[0]), true);
});

test('D7 ★ 키 함수 공유 — cachedFor 가 부른 keyFor 인자 = refill(dropCached) 이 같은 문장에 부른 인자 · 요청 0 · 메모리 불변', async () => {
  const units = buildUnits([PARA], 'sentence');
  const keyCalls = [];
  const keyFor = async (d, s, t, k) => { keyCalls.push([d, s, t, k]); return 'K:' + s; };
  const pl = fakePipeline();
  const store = new Map();
  const ra = createReadalong({ pipeline: pl, cache: { getMany: async (keys) => { const m = new Map(); for (const k of keys) if (store.has(k)) m.set(k, store.get(k)); return m; } },
    keyFor: keyFor, getSetting: () => undefined, saveReadStats: async () => { }, loadParas: async () => null });
  ra.setDoc({ docId: 'DOC', lang: 'en', target: 'ar', pageCount: 9 });
  ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', unit: 'sentence', hasKey: true });
  // refill 경로 — 재생 중 쪽 큐
  ra.setActive(true);
  await ra.onQueue(9, units, 0);
  await ra.idle();
  for (let i = 0; i < 20 && ra.stats().inflight; i++) await new Promise((r) => setTimeout(r, 5));
  await ra.idle();
  const refillKeys = keyCalls.splice(0);
  assert.ok(refillKeys.length >= units.length - 0, 'refill 이 문장마다 키를 만들었다');
  const callsAfterRefill = pl.calls.length;
  ra.setActive(false);

  // 새 서비스(같은 키 함수) — 캐시만 있는 상태에서 cachedFor
  const pl2 = fakePipeline();
  for (const s of new Set(units.map((u) => u.src))) store.set('K:' + s, { result: 'ترجمة' });
  const ra2 = createReadalong({ pipeline: pl2, cache: { getMany: async (keys) => { const m = new Map(); for (const k of keys) if (store.has(k)) m.set(k, store.get(k)); return m; } },
    keyFor: keyFor, getSetting: () => undefined, saveReadStats: async () => { } });
  ra2.setDoc({ docId: 'DOC', lang: 'en', target: 'ar', pageCount: 9 });
  ra2.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', unit: 'sentence', hasKey: true });
  const hits = await ra2.cachedFor(units);
  const viewKeys = keyCalls.splice(0);
  assert.equal(hits.size, 4);
  const asSet = (l) => new Set(l.map((x) => JSON.stringify(x)));
  assert.deepEqual(asSet(viewKeys), asSet(refillKeys.filter((x) => units.some((u) => u.src === x[1]))), '같은 문장 → 같은 keyFor 인자(docId·src·target·kind)');
  assert.ok(viewKeys.every((x) => x[0] === 'DOC' && x[2] === 'ar' && x[3] === 'readalong'));
  // 호출 0 — 파이프라인을 부르지 않고 요청 기록·메모리도 그대로
  assert.equal(pl2.calls.length, 0);
  assert.equal(ra2.stats().calls, 0);
  for (const u of units) assert.equal(ra2.get(u.src).state, 'none', 'cachedFor 는 메모리를 바꾸지 않는다');
  assert.equal(pl.calls.length, callsAfterRefill);
  // readyNow 는 메모리만(동기) — 첫 서비스에는 refill 이 받은 번역이 있다
  const now = ra.readyNow(units);
  assert.equal(now.size, 4);
  assert.equal(ra2.readyNow(units).size, 0);
  // 소스 — 키는 cacheKeyOf 한 곳에서
  const src = strip(read('../js/ai/readalong.js'));
  assert.equal((src.match(/keyFor\(doc\.id, s\.src, doc\.target, 'readalong'\)/g) || []).length, 1, 'keyFor 를 부르는 곳이 하나');
  assert.match(src.slice(src.indexOf('async function dropCached')), /need\.map\(cacheKeyOf\)/);
  assert.match(src.slice(src.indexOf('async function cachedFor')), /need\.map\(cacheKeyOf\)/);
});

/* ════════════════════════════════════════════════════════
   3. 소스 — pipeline import 없음 · innerHTML 0 · 배선
   ════════════════════════════════════════════════════════ */

function importClosure(entry) {
  const root = path.dirname(fileURLToPath(new URL('../js/ui/x', import.meta.url)));
  const seen = new Set();
  const stack = [path.resolve(root, entry)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const s = strip(readFileSync(f, 'utf8'));
    for (const m of s.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(?\s*['"](\.[^'"]+)['"]/g)) stack.push(path.resolve(path.dirname(f), m[1] || m[2]));
  }
  return [...seen].map((f) => f.replace(/\\/g, '/'));
}

test('D8 ★ grep — inlinetr 는 pipeline 을 (간접으로도) import 하지 않는다 · 캐시·키 함수도 직접 모른다 · innerHTML 0', () => {
  const src = strip(read('../js/ui/inlinetr.js'));
  assert.doesNotMatch(src, /pipeline/i);
  assert.doesNotMatch(src, /ai\/cache\.js|keyFor|cacheKey/);
  assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(src, /from '\.\/reader\.js'|from '\.\.\/ai\//, '리더·서비스 모듈을 import 하지 않는다(주입)');
  const clo = importClosure('./inlinetr.js');
  assert.ok(clo.some((f) => /\/ui\/inlinetr\.js$/.test(f)));
  assert.equal(clo.filter((f) => /\/ai\/(pipeline|readalong|cache)\.js$/.test(f)).length, 0, clo.join('\n'));
  assert.match(src, /import \{ appendBidiText \} from '\.\/bididom\.js'/);
  assert.match(src, /import \{ noteKeyFor \} from '\.\/trband\.js'/);
  assert.match(src, /appendBidiText\(tx, text, a\.dir\)/);
  // 요청 없는 서비스 메서드만 쓴다
  const used = new Set((src.match(/\bra\.([a-zA-Z]+)\(/g) || []).map((x) => x.slice(3, -1)));
  assert.deepEqual([...used].sort(), ['addEventListener', 'cachedFor', 'get', 'mode', 'onChange', 'readyNow', 'remoteState', 'retry', 'translatable'].sort());
  // retry 는 사용자 단추에서만
  const retryAt = src.indexOf('ra.retry()');
  assert.ok(retryAt > src.indexOf("act === 'retry'"), '[다시 시도] 단추 안에서만');
});

test('D9 배선 — controls 는 showSpoken **앞에서** willShow · syncReadalong 끝에 sync · leave · 표시 방식 줄 클릭도 sync', () => {
  const c = strip(read('../js/ui/controls.js'));
  assert.match(c, /show: function \(u\) \{ lastShown = u \|\| null; if \(inlinetr\) inlinetr\.willShow\(u\); return showSpoken\(u\); \}/);
  const sr = c.slice(c.indexOf('function syncReadalong'));
  assert.ok(sr.indexOf('inlinetr.sync()') > sr.indexOf('readalong.setDoc('), '문서·대상 언어를 맞춘 뒤');
  assert.ok(sr.indexOf('inlinetr.sync()') > sr.indexOf('readalong.setContext('), '유효 모드를 맞춘 뒤');
  assert.match(c, /if \(inlinetr\) inlinetr\.leave\(\);/);
  assert.match(c, /\[data-readalong-display\]/);
  assert.doesNotMatch(c, /setTimeout\([^)]*inlinetr/);
  // 리더 — sentenceExtent 한 줄(현재 블록) · 블록을 만드는 코드는 리더에 없다
  const r = strip(read('../js/ui/reader.js'));
  const se = r.slice(r.indexOf('function sentenceExtent'), r.indexOf('const BODY_EDGE_PX'));
  assert.match(se, /\.ra-tr\[data-ra-current\]/);
  assert.equal((r.match(/ra-tr/g) || []).length, 1, '리더에는 sentenceExtent 의 한 줄뿐');
  // 띠 자리 — 토큰 하나(띠 높이 0)와 띠 감추기
  const tok = read('../css/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(tok, /:root\[data-tr-inline="on"\]\s*\{\s*--tr-band-h:\s*0px;\s*\}/);
  const rc = read('../css/reader.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(rc, /:root\[data-tr-inline="on"\] \.tr-band \{ display: none; \}/);
});

test('D10 설정 — readalong.display 기본 band · 모르는 값 band · 줄은 같은 그리기 함수 · 네 언어 문구', () => {
  assert.equal(DEFAULTS['readalong.display'], 'band');
  assert.deepEqual([...READALONG_DISPLAYS], ['band', 'inline']);
  assert.equal(normalizeReadalongDisplay('inline'), 'inline');
  assert.equal(normalizeReadalongDisplay('x'), 'band');
  assert.equal(readalongState((k) => (k === 'readalong.display' ? 'inline' : undefined)).display, 'inline');
  const ui = strip(read('../js/ui/settings.js'));
  const build = ui.slice(ui.indexOf('function buildReadalongRow'), ui.indexOf('function paintReadalongRow'));
  assert.match(build, /data-readalong-display/);
  assert.ok(build.indexOf('data-readalong-display') > build.indexOf('data-readalong-source'), '"번역 따라가기" 줄(원문 읽기 스위치) 아래');
  assert.match(ui, /medreader:readalong-display/);
  for (const l of LANGS) {
    for (const k of ['readalong.display.label', 'readalong.display.band', 'readalong.display.inline', 'readalong.inline.arrived']) {
      assert.equal(typeof BUNDLES[l][k], 'string', l + ' ' + k);
      assert.ok(BUNDLES[l][k].length > 0);
    }
  }
});

/* ════════════════════════════════════════════════════════
   4. 화면 흐름 — 가짜 DOM · 가짜 speaker · 실제 readalong(가짜 파이프라인)
   ════════════════════════════════════════════════════════ */

function makeBus() {
  const t = new EventTarget();
  return { addEventListener: t.addEventListener.bind(t), emit: (type, detail) => t.dispatchEvent(new CustomEvent(type, { detail: detail })) };
}

test('D11 ★ 화면 흐름 — 쪽 그림(I4 i) · 현재가 될 때(ii) · 지나간 문장의 늦은 번역은 "눌러서 보기"(iii) · 지우기(I7)', async () => {
  const doc = makeDoc();
  const saved = globalThis.document;
  globalThis.document = doc;
  try {
    settings._setCacheForTest(new Map([['readalong.display', 'inline'], ['ai.translationLang', 'ar']]));
    const M = await import('../js/ui/inlinetr.js?flow=1');
    const mount = doc.documentElement.appendChild(doc.createElement('div'));
    const PAGE = [PARA, { id: 'p2', kind: 'body', lines: [ln('9:4', 'A later line ends.'), ln('9:5', 'Then the last one.')] }];
    let art = renderPage(doc, 9, PAGE);
    mount.appendChild(art);
    const units = buildUnits(PAGE, 'sentence');
    // 실제 readalong — 파이프라인은 손으로 푼다
    const pend = [];
    const pl = { translate: (items) => new Promise((res) => pend.push({ items, res })), state: () => 'ready', onState: () => () => { }, retry: async () => 'ready' };
    const store = new Map();
    const ra = createReadalong({ pipeline: pl, cache: { getMany: async (keys) => { const m = new Map(); for (const k of keys) if (store.has(k)) m.set(k, store.get(k)); return m; } },
      keyFor: async (d, s) => 'K:' + s, getSetting: () => undefined, saveReadStats: async () => { }, loadParas: async () => null, headChars: 0 });
    ra.setDoc({ docId: 'DOC', lang: 'en', target: 'ar', pageCount: 9 });
    ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ar', unit: 'sentence', hasKey: true });
    // 캐시에 seg 1 만 있다(전에 읽은 것)
    store.set('K:' + units.find((u) => u.seg === 1).src, { result: 'ترجمة واحد' });
    const sp = makeBus();
    let rechecks = 0;
    const view = M.initInlineTr({ readalong: ra, speaker: sp, mount: mount, lineElement: lineFinder(mount), recheck: () => { rechecks++; } });
    const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

    // ① 쪽 그림 — 큐를 받고 sync(controls 의 syncReadalong 끝) → 캐시에 있는 seg 1 블록 하나
    sp.emit('queue', { page: 9, units: units, index: 0, seg: 0 });
    view.sync();
    assert.equal(doc.documentElement.getAttribute('data-tr-inline'), 'on', '띠 자리 — inline 이면 data-tr-inline');
    await flush();
    let blocks = mount.querySelectorAll('.ra-tr');
    assert.deepEqual(blocks.map((b) => [b.getAttribute('data-ra-seg'), b.getAttribute('data-state')]), [['1', 'ready']]);
    assert.equal(pend.length, 0, '쪽 그림은 요청하지 않는다');
    // 같은 DOM 에 sync 를 또 불러도 다시 그리지 않는다(블록 수 그대로)
    view.sync(); await flush();
    assert.equal(mount.querySelectorAll('.ra-tr').length, 1);

    // ② 낭독 — seg 0 이 현재가 된다. 아직 번역 없음 → 그 문장 끝 줄 다음에 "번역 중…" 한 줄
    ra.setActive(true);
    await ra.onQueue(9, units, 0);
    const u0 = units.find((u) => u.seg === 0);
    view.willShow(u0);
    let b0 = mount.querySelector('.ra-tr[data-ra-seg="0"]');
    assert.ok(b0, '현재 문장 블록');
    assert.ok(b0.hasAttribute('data-ra-current'));
    assert.equal(b0.getAttribute('data-state'), 'pending');
    assert.equal(lineFinder(mount)('9:1').nextSibling, b0, '9:1(문장 0 이 끝나는 줄) 다음');
    await flush();
    assert.ok(pend.length >= 1, 'refill 이 보냈다(서비스의 일 — 화면이 아니라)');

    // ③ seg 0 번역이 오기 전에 seg 1·2 로 넘어간다. seg 1 은 블록이 이미 있다(ready).
    view.willShow(units.find((u) => u.seg === 1));
    assert.equal(b0.hasAttribute('data-ra-current'), false);
    assert.equal(b0.getAttribute('data-state'), 'pending', 'I5 — 지나간 문장의 상태 줄을 바로 지우지 않는다');
    const u2 = units.find((u) => u.seg === 2);
    view.willShow(u2);
    const b2 = mount.querySelector('.ra-tr[data-ra-seg="2"]');
    assert.ok(b2.hasAttribute('data-ra-current'));
    // 6-5 — 번역문을 소리 내는 동안(speak 의 tr 단계)은 지금 블록에 data-speaking="tr"
    sp.emit('phasechange', { phase: 'tr' });
    assert.equal(b2.getAttribute('data-speaking'), 'tr');
    sp.emit('phasechange', { phase: 'src' });
    assert.equal(b2.hasAttribute('data-speaking'), false);

    // ④ 응답 도착 — seg 0(지나감)은 펼치지 않고 "눌러서 보기", seg 2(현재)는 그 자리에서 채움 + 편안 영역 다시 보기
    const first = pend.shift();
    first.res({ results: first.items.map((x, i) => ({ state: 'ready', text: 'ترجمة ' + i + ' (Monday)' })) });
    await flush();
    assert.equal(b0.getAttribute('data-state'), 'arrived', 'I4 (iii) — 지나간 문장은 같은 높이 한 줄');
    assert.ok(b0.querySelector('button.ra-show'));
    assert.equal(b0.querySelector('.ra-text'), null, '번역문을 바로 펼치지 않는다');
    if (first.items.some((x) => x.text === u2.src)) {
      assert.equal(b2.getAttribute('data-state'), 'ready');
      assert.ok(rechecks >= 1, '현재 블록이 커지면 6-5 다시 보기');
    }
    // 사용자가 누르면 펼친다
    b0.querySelector('button.ra-show').click();
    assert.equal(b0.getAttribute('data-state'), 'ready');
    assert.ok(b0.querySelector('.ra-text'));
    assert.equal(pend.length >= 0, true);

    // ⑤ 앞으로 읽을 문장(seg 3·4)의 번역이 먼저 와 있어도 현재가 될 때까지 넣지 않는다(I4 (ii))
    while (pend.length) { const p = pend.shift(); p.res({ results: p.items.map(() => ({ state: 'ready', text: 'ترجمة' })) }); await flush(); }
    assert.equal(mount.querySelector('.ra-tr[data-ra-seg="3"]'), null);
    view.willShow(units.find((u) => u.seg === 3));
    assert.equal(mount.querySelector('.ra-tr[data-ra-seg="3"]').getAttribute('data-state'), 'ready');

    // ⑥ 다시 그린 쪽(새 DOM) — 메모리에 있는 것 전부를 동기로(I4 (i)) · 상태 줄은 사라진다
    mount.removeChild(art);
    art = renderPage(doc, 9, PAGE);
    mount.appendChild(art);
    sp.emit('queue', { page: 9, units: units.slice(), index: 3, seg: 3 });
    view.sync();
    const syncCount = mount.querySelectorAll('.ra-tr').length;
    assert.ok(syncCount >= 4, '메모리 적중은 동기로 넣는다: ' + syncCount);
    assert.equal(pend.length, 0);

    // ⑦ I7 — band 로 바꾸면 전부 지우고 띠 자리를 돌려준다 · 다시 inline 이면 다시 그린다
    settings._setCacheForTest(new Map([['readalong.display', 'band'], ['ai.translationLang', 'ar']]));
    doc.dispatchEvent({ type: 'medreader:readalong-display' });
    assert.equal(mount.querySelectorAll('.ra-tr').length, 0);
    assert.equal(doc.documentElement.hasAttribute('data-tr-inline'), false);
    settings._setCacheForTest(new Map([['readalong.display', 'inline'], ['ai.translationLang', 'ar']]));
    view.sync();
    assert.ok(mount.querySelectorAll('.ra-tr').length >= 4);
    // 대상 언어가 바뀌면 지운다(readalong 도 메모리를 비운다)
    settings._setCacheForTest(new Map([['readalong.display', 'inline'], ['ai.translationLang', 'ko']]));
    ra.setDoc({ docId: 'DOC', lang: 'en', target: 'ko', pageCount: 9 });
    view.sync(); await flush();
    assert.equal(mount.querySelectorAll('.ra-tr[lang="ar"]').length, 0, '옛 대상 언어 블록이 남지 않는다');
    // 유효 모드 off → 지운다
    ra.setContext({ mode: 'off' });
    view.sync();
    assert.equal(mount.querySelectorAll('.ra-tr').length, 0);
    assert.equal(doc.documentElement.hasAttribute('data-tr-inline'), false);
    // 원본 뷰(article.reflow 없음) → 띠
    ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ko', unit: 'sentence', hasKey: true });
    mount.removeChild(art);
    view.sync();
    assert.equal(doc.documentElement.hasAttribute('data-tr-inline'), false, '원본 뷰는 늘 띠');
    view.leave();
    ra.dispose();
  } finally {
    globalThis.document = saved;
    if (saved === undefined) delete globalThis.document;
    settings._setCacheForTest(new Map());
  }
});

test('D12 ★ `[8m]` 화면 — 대상 언어와 같은 단위가 현재가 되어도 블록·상태 줄이 없다 · 현재 표시가 걷힌다', async () => {
  const doc = makeDoc();
  const saved = globalThis.document;
  globalThis.document = doc;
  try {
    settings._setCacheForTest(new Map([['readalong.display', 'inline'], ['ai.translationLang', 'ko']]));
    const M = await import('../js/ui/inlinetr.js?mix=1');
    const mount = doc.documentElement.appendChild(doc.createElement('div'));
    const art = renderPage(doc, 5, MIX);
    mount.appendChild(art);
    const units = buildUnits(MIX, 'sentence', { lang: 'en', scriptSwitch: true });
    const store = new Map();
    for (const u of units) store.set('K:' + u.src, { result: '번역' });
    const pl = { translate: async () => ({ results: [] }), state: () => 'ready', onState: () => () => { }, retry: async () => 'ready' };
    const ra = createReadalong({ pipeline: pl, cache: { getMany: async (keys) => { const m = new Map(); for (const k of keys) if (store.has(k)) m.set(k, store.get(k)); return m; } },
      keyFor: async (d, s) => 'K:' + s, getSetting: () => undefined, saveReadStats: async () => { } });
    ra.setDoc({ docId: 'DOC', lang: 'en', target: 'ko', pageCount: 9 });
    ra.setContext({ mode: 'show', consented: true, srcLang: 'en', supportedSrc: ['en'], targetLang: 'ko', unit: 'sentence', hasKey: true });
    const sp = makeBus();
    const view = M.initInlineTr({ readalong: ra, speaker: sp, mount: mount, lineElement: lineFinder(mount) });
    sp.emit('queue', { page: 5, units: units, index: 0, seg: 0 });
    view.sync();
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    const koU = units.find((u) => u.lang === 'ko');
    const segs = mount.querySelectorAll('.ra-tr').map((b) => Number(b.getAttribute('data-ra-seg')));
    assert.equal(segs.indexOf(koU.seg), -1, '캐시에 있어도 한국어 단위 블록 없음');
    assert.equal(segs.length, units.length - 1);
    view.willShow(units[0]);
    assert.ok(mount.querySelector('.ra-tr[data-ra-current]'));
    view.willShow(koU);
    assert.equal(mount.querySelector('.ra-tr[data-ra-current]'), null, '같은 언어 단위는 현재 블록이 없다');
    assert.equal(mount.querySelector('.ra-tr[data-ra-seg="' + koU.seg + '"]'), null, '상태 줄("번역 중…")도 없다');
    view.leave();
    ra.dispose();
  } finally {
    globalThis.document = saved;
    if (saved === undefined) delete globalThis.document;
    settings._setCacheForTest(new Map());
  }
});
