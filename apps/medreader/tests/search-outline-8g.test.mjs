/* ============================================================
   tests/search-outline-8g.test.mjs — 8g-3 목차·쪽 라벨 (spec 17-8-6 · 17-8-12 §3 · §7 S16·S17 · §8)

   S16  outline.ensure(가짜 pdfDoc): 이름 대상·명시 대상(ref·정수)·대상 없음(p:null)·getDestination/getPageIndex 가
        던짐(p:null, 예외 없음)·범위 밖·깊이(최상위 1, 앞 순서). 라벨이 없거나 전부 String(p) 와 같으면 pageLabels 를
        쓰지 않는다. 두 번째(·동시) 호출은 PDF 를 부르지 않는다(outlineV). getOutline·getPageLabels 가 던지면 저장하지
        않고 다음 호출이 다시 한다. 문서가 없으면 되살리지 않는다. 다른 필드는 그대로(db.patch).
   S16b tocOf — 저장된 개요 / 개요 없음([]) → heading 폴백(저장하지 않음) / 아직 못 읽음 → 폴백 + outlineRead:false
   S17  (보강 — 기본 몫은 search-text-8g) headingToc: 숫자만인 항목은 **같은 쪽** 다음 heading 만 붙인다 ·
        200 상한에서 층 단위로 끊는다 · 10번 반복 제목 빠짐
   배선 리더가 첫 그리기·추출기 배선 뒤 한가할 때 한 번(이미 읽었으면 안 부름, 실패는 조용히) · 계층(3-2) · import map

   픽스처 글자는 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const outline = await import('../js/search/outline.js');
const { headingToc } = await import('../js/text/search.js');
const { SEARCH } = await import('../js/config.js');
const { ensure, tocOf, readOutline, printedLabel, isOutlineCurrent, OUTLINE_V, OUTLINE_ERR } = outline;

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ 가짜 pdf.js 문서 ═══════════════════════════════════════
   ref 는 pdf.js 처럼 {num, gen}. getPageIndex(ref) = num − 100(0부터). calls 에 부른 것을 센다. */
const ref = (pageIdx) => ({ num: 100 + pageIdx, gen: 0 });

function fakePdf(opts) {
  const o = opts || {};
  const calls = { getOutline: 0, getDestination: 0, getPageIndex: 0, getPageLabels: 0 };
  const named = o.named || {};
  return {
    calls,
    numPages: o.numPages || 50,
    async getOutline() {
      calls.getOutline++;
      if (o.outlineThrows) throw new Error('outline 깨짐');
      return o.outline === undefined ? null : o.outline;
    },
    async getDestination(name) {
      calls.getDestination++;
      if (name === 'boom') throw new Error('이름 대상 깨짐');
      return Object.prototype.hasOwnProperty.call(named, name) ? named[name] : null;
    },
    async getPageIndex(r) {
      calls.getPageIndex++;
      if (r && r.num === 999) throw new Error('Invalid pageIndex');
      return r.num - 100;
    },
    async getPageLabels() {
      calls.getPageLabels++;
      if (o.labelsThrows) throw new Error('labels 깨짐');
      return o.labels === undefined ? null : o.labels;
    }
  };
}

const item = (title, dest, items, extra) => Object.assign({ title, dest, items: items || [] }, extra || {});

/** 이름 대상·명시 대상·정수 대상·대상 없음·던짐·범위 밖·깊이 3 이 모두 든 개요. */
const TREE = [
  item('Part One', 'chap-1', [
    item('Zorvat Basics', [ref(4), { name: 'XYZ' }, 0, 700, null], [
      item('Deep Topic', [6, { name: 'Fit' }])              // 정수 대상(쪽 순번) — 깊이 3
    ]),
    item('External Link', null, [], { url: 'https://example.invalid/' })   // 대상 없음
  ]),
  item('Part Two', 'missing-name'),                           // 이름 대상이 없다 → null
  item('Broken Ref', [{ num: 999, gen: 0 }, { name: 'XYZ' }]), // getPageIndex 가 던진다
  item('Broken Name', 'boom'),                                // getDestination 이 던진다
  item('Out Of Range', [ref(80), { name: 'XYZ' }]),           // 50쪽 문서의 81쪽
  item('  Spaced Title  ', 'chap-9')
];
const NAMED = { 'chap-1': [ref(2), { name: 'XYZ' }], 'chap-9': [ref(48), { name: 'Fit' }] };
const EXPECT = [
  { t: 'Part One', p: 3, d: 1 },
  { t: 'Zorvat Basics', p: 5, d: 2 },
  { t: 'Deep Topic', p: 7, d: 3 },
  { t: 'External Link', p: null, d: 2 },
  { t: 'Part Two', p: null, d: 1 },
  { t: 'Broken Ref', p: null, d: 1 },
  { t: 'Broken Name', p: null, d: 1 },
  { t: 'Out Of Range', p: null, d: 1 },
  { t: 'Spaced Title', p: 49, d: 1 }
];

let seq = 0;
async function seedDoc(extra) {
  const id = 'O' + (++seq);
  await db.put('documents', Object.assign({ id, title: 'Book ' + id, fileHash: 'h-' + id, pageCount: 50, lastPage: 7, lang: 'en' }, extra || {}));
  return id;
}
const docOf = (id) => db.get('documents', id);

/* ══ S16 ═══════════════════════════════════════════════════ */

test('S16 ★ ensure — 이름·명시(ref·정수) 대상 해석 · 대상 없음·던짐·범위 밖은 p:null(예외 없음) · 깊이 · 다른 필드 그대로', async () => {
  const id = await seedDoc();
  const pdf = fakePdf({ outline: TREE, named: NAMED });
  const r = await ensure(id, pdf);
  assert.deepEqual(r, { status: 'saved', items: EXPECT.length, labels: false });
  const doc = await docOf(id);
  assert.deepEqual(doc.outline, EXPECT);
  assert.equal(doc.outlineV, OUTLINE_V);
  assert.equal('pageLabels' in doc, false, '라벨이 없으면 쓰지 않는다');
  assert.equal(doc.lastPage, 7, '다른 필드는 그대로(db.patch)');
  assert.equal(doc.title, 'Book ' + id);
  assert.equal(isOutlineCurrent(doc), true);
});

test('S16 ★ 쪽 라벨 — 없음·전부 String(p) 와 같음이면 쓰지 않고, 하나라도 다르면 문자열 배열로', async () => {
  const same = Array.from({ length: 50 }, (_, i) => String(i + 1));
  const a = await seedDoc();
  assert.equal((await ensure(a, fakePdf({ outline: TREE, named: NAMED, labels: same }))).labels, false);
  assert.equal('pageLabels' in (await docOf(a)), false, '★ 전부 같으면 저장하지 않는다');

  const printed = Array.from({ length: 50 }, (_, i) => (i < 3 ? ['i', 'ii', 'iii'][i] : String(i + 1 - 3)));
  const b = await seedDoc();
  const r = await ensure(b, fakePdf({ outline: TREE, named: NAMED, labels: printed }));
  assert.equal(r.labels, true);
  const doc = await docOf(b);
  assert.deepEqual(doc.pageLabels, printed);
  assert.equal(printedLabel(doc.pageLabels, 2), 'ii');
  assert.equal(printedLabel(doc.pageLabels, 49), '46');
  // 숫자가 아닌 라벨 값도 글자로
  const c = await seedDoc();
  const odd = Array.from({ length: 50 }, (_, i) => (i === 0 ? 7 : String(i + 1)));
  await ensure(c, fakePdf({ outline: [], labels: odd }));
  assert.equal((await docOf(c)).pageLabels[0], '7');
});

test('S16 ★ 멱등 — 두 번째 ensure 는 PDF 를 부르지 않는다(outlineV) · 동시 두 호출은 한 번만 읽는다', async () => {
  const id = await seedDoc();
  const p1 = fakePdf({ outline: TREE, named: NAMED });
  const [r1, r2] = await Promise.all([ensure(id, p1), ensure(id, p1)]);
  assert.equal(r1.status, 'saved');
  assert.equal(r2, r1, '같은 작업을 함께 기다린다');
  assert.equal(p1.calls.getOutline, 1);
  const p2 = fakePdf({ outline: [item('Other', 'x')], named: { x: [ref(1)] } });
  const r3 = await ensure(id, p2);
  assert.equal(r3.status, 'cached');
  assert.deepEqual(p2.calls, { getOutline: 0, getDestination: 0, getPageIndex: 0, getPageLabels: 0 }, '★ PDF 를 보지 않는다');
  assert.deepEqual((await docOf(id)).outline, EXPECT, '덮지 않는다');
  // 판이 오르면(규칙 변경) 다시 읽는다
  await db.patch('documents', id, { outlineV: OUTLINE_V - 1 });
  assert.equal((await ensure(id, p2)).status, 'saved');
  assert.deepEqual((await docOf(id)).outline, [{ t: 'Other', p: 2, d: 1 }]);
});

test('S16 ★ 개요가 없는 PDF — outline [] 를 outlineV 와 함께 저장하고 다음엔 PDF 를 부르지 않는다', async () => {
  const id = await seedDoc();
  assert.equal((await ensure(id, fakePdf({ outline: null }))).status, 'saved');
  const doc = await docOf(id);
  assert.deepEqual(doc.outline, []);
  assert.equal(doc.outlineV, OUTLINE_V);
  const p = fakePdf({ outline: TREE, named: NAMED });
  assert.equal((await ensure(id, p)).status, 'cached');
  assert.equal(p.calls.getOutline, 0);
});

test('S16 ★ 실패는 저장하지 않는다 — getOutline·getPageLabels 가 던지면 ERR_OUTLINE_READ(거절 아님), 다음 호출이 다시 읽는다', async () => {
  const id = await seedDoc();
  const r1 = await ensure(id, fakePdf({ outlineThrows: true }));
  assert.deepEqual(r1, { status: 'error', code: OUTLINE_ERR.READ });
  const r2 = await ensure(id, fakePdf({ outline: TREE, named: NAMED, labelsThrows: true }));
  assert.deepEqual(r2, { status: 'error', code: OUTLINE_ERR.READ });
  let doc = await docOf(id);
  assert.equal('outlineV' in doc, false, '★ 반쯤 읽은 것을 굳히지 않는다');
  assert.equal('outline' in doc, false);
  const r3 = await ensure(id, fakePdf({ outline: TREE, named: NAMED }));
  assert.equal(r3.status, 'saved', '다음 기회에 다시');
  doc = await docOf(id);
  assert.deepEqual(doc.outline, EXPECT);
  // 잘못된 인자도 거절하지 않는다
  assert.deepEqual(await ensure(id, null), { status: 'error', code: OUTLINE_ERR.READ });
  assert.deepEqual(await ensure('', fakePdf({})), { status: 'error', code: OUTLINE_ERR.READ });
});

test('S16 문서가 없으면 되살리지 않는다 · 쪽 수가 다른 pdf 문서는 쓰지 않는다', async () => {
  const p = fakePdf({ outline: TREE, named: NAMED });
  assert.deepEqual(await ensure('NOPE', p), { status: 'missing' });
  assert.equal(await docOf('NOPE'), undefined);
  assert.equal(p.calls.getOutline, 0);
  const id = await seedDoc({ pageCount: 49 });
  const q = fakePdf({ outline: TREE, named: NAMED });
  assert.deepEqual(await ensure(id, q), { status: 'error', code: OUTLINE_ERR.MISMATCH });
  assert.equal(q.calls.getOutline, 0);
  assert.equal('outlineV' in (await docOf(id)), false);
});

test('S16 ensure 가 읽는 사이 문서가 지워지면 되살리지 않는다(missing)', async () => {
  const id = await seedDoc();
  const p = fakePdf({ outline: TREE, named: NAMED });
  const slow = Object.assign({}, p, {
    async getOutline() { await new Promise((r) => setTimeout(r, 20)); return p.getOutline(); }
  });
  const job = ensure(id, slow);
  await new Promise((r) => setTimeout(r, 5));
  await db.deleteDocument(id);
  assert.deepEqual(await job, { status: 'missing' });
  assert.equal(await docOf(id), undefined);
});

test('S16 readOutline — 깊은 트리도 앞 순서 · 항목 상한', async () => {
  let node = item('L1', [0]);
  const root = [node];
  for (let d = 2; d <= 40; d++) { const n = item('L' + d, [d - 1]); node.items = [n]; node = n; }
  const r = await readOutline(fakePdf({ outline: root }));
  assert.equal(r.outline.length, 40);
  assert.deepEqual(r.outline.slice(0, 3), [{ t: 'L1', p: 1, d: 1 }, { t: 'L2', p: 2, d: 2 }, { t: 'L3', p: 3, d: 3 }]);
  assert.equal(r.outline[39].d, 40);
  const many = Array.from({ length: outline.OUTLINE_MAX_ITEMS + 10 }, (_, i) => item('x' + i, null));
  assert.equal((await readOutline(fakePdf({ outline: many }))).outline.length, outline.OUTLINE_MAX_ITEMS);
});

test('S16 printedLabel — 라벨이 없거나 같거나 범위 밖이면 null', () => {
  assert.equal(printedLabel(null, 3), null);
  assert.equal(printedLabel(['1', '2', '3'], 3), null);
  assert.equal(printedLabel(['i', '1', 'x'], 1), 'i');
  assert.equal(printedLabel(['i', '1'], 3), null);
  assert.equal(printedLabel(['i', '1'], 0), null);
  assert.equal(printedLabel(['', '1'], 1), null);
});

/* ══ S16b tocOf — 저장된 개요 / 폴백(그때마다) ══════════════ */

/** 검색 레코드(쪽마다) — heads 오프셋은 text 안. */
function st(docId, pageNo, lines) {
  const parts = [];
  const heads = [];
  for (const [t, r] of lines) {
    const o = parts.length ? parts.join('\n').length + 1 : 0;
    if (r) heads.push({ i: parts.length, o, r });
    parts.push(t);
  }
  return { docId, pageNo, sk: 'x', algoVersion: 12, text: parts.join('\n'), table: '', heads };
}

test('S16b ★ tocOf — 개요가 있으면 그것, 개요가 [] 면 searchText heads 폴백(저장하지 않음), 못 읽었으면 outlineRead:false', async () => {
  const a = await seedDoc();
  await ensure(a, fakePdf({ outline: TREE, named: NAMED, labels: Array.from({ length: 50 }, (_, i) => 'p' + i) }));
  const ta = await tocOf(a);
  assert.equal(ta.source, 'outline');
  assert.deepEqual(ta.items, EXPECT);
  assert.equal(ta.pageLabels[0], 'p0');
  assert.equal(ta.outlineRead, true);

  const b = await seedDoc();
  const recs = [];
  for (let p = 1; p <= 12; p++) {
    const lines = [];
    if (p === 2 || p === 9) lines.push([String(p === 2 ? 1 : 2), 2.5], ['Zorvat Chapter ' + p, 1.5]);
    lines.push(['Treatment', 2.5], ['body words ' + p, 0]);
    recs.push(st(b, p, lines));
  }
  recs.push(st('OTHER', 3, [['Other Book Title', 3.0]]));
  await db.putAll('searchText', recs);

  const before = await tocOf(b);
  assert.equal(before.source, 'fallback');
  assert.equal(before.outlineRead, false, '★ 아직 PDF 개요를 못 읽었다(오프라인 첫 열기)');
  assert.deepEqual(before.items.map((e) => [e.t, e.p, e.d]), [
    ['1 Zorvat Chapter 2', 2, 1], ['Zorvat Chapter 2', 2, 1], ['2 Zorvat Chapter 9', 9, 1], ['Zorvat Chapter 9', 9, 1]
  ], '반복 제목(Treatment ×12) 빠짐 · 숫자만 → 같은 쪽 다음 heading · 다른 책 레코드 없음');

  await ensure(b, fakePdf({ outline: null }));
  const after = await tocOf(b);
  assert.equal(after.source, 'fallback');
  assert.equal(after.outlineRead, true, '개요가 없는 PDF 로 읽었다');
  assert.equal('fallback' in (await docOf(b)), false);
  assert.deepEqual(Object.keys(await docOf(b)).filter((k) => /toc|fallback/i.test(k)), [], '★ 폴백을 저장하지 않는다');
  // 추출이 진행되면(새 쪽) 폴백이 따라 는다 — 저장했다면 굳었을 것
  await db.put('searchText', st(b, 11, [['3', 2.5], ['Zorvat Chapter 11', 1.5]]));
  assert.equal((await tocOf(b)).items.some((e) => e.t === '3 Zorvat Chapter 11'), true);

  assert.equal(await tocOf('NOPE'), null);
  // [텍스트 다시 추출](resetDerived)은 개요·라벨을 지우지 않는다(U3)
  await db.resetDerived(a);
  assert.equal((await tocOf(a)).source, 'outline');
});

/* ══ S17 보강 — headingToc ═══════════════════════════════════ */

test('S17 ★ headingToc — 숫자만인 항목은 **같은 쪽** 바로 다음 heading 만 붙인다(쪽 끝이면 뺀다 — 8g-3b R9)', () => {
  const recs = [
    st('D', 1, [['4', 3.0]]),                                    // 쪽 끝 — 다음 heading 은 2쪽
    st('D', 2, [['Zorvat Next Page', 1.5], ['5', 3.0], ['Zorvat Same Page', 1.5]])
  ];
  const toc = headingToc(recs);
  // `[8g-3b — 17-8-12 §11-1 U11 정정]` 쪽 끝 숫자 '4' 는 붙일 heading 이 같은 쪽에 없어 빠진다(R9 — 의도된 변경)
  assert.deepEqual(toc.map((e) => [e.t, e.p]), [
    ['Zorvat Next Page', 2], ['5 Zorvat Same Page', 2], ['Zorvat Same Page', 2]
  ]);
});

test('S17 ★ headingToc — 200 상한은 층 단위로 끊는다(넘기 직전 층까지) · 10번 반복 제목은 어느 층이든 빠진다', () => {
  const recs = [];
  for (let p = 1; p <= 300; p++) {
    const lines = [];
    if (p <= 150) lines.push(['Zorvat Big ' + p, 2.0]);          // 150개 층 2.0
    lines.push(['Zorvat Mid ' + p, 1.5]);                        // 300개 층 1.5 → 합 450 > 200 이라 빠짐
    if (p <= 10) lines.push(['Generic Head', 3.0]);              // 정확히 10번 — 빠진다
    if (p <= 9) lines.push(['Nine Times', 2.5]);                 // 9번 — 남는다
    recs.push(st('D', p, lines));
  }
  const toc = headingToc(recs);
  assert.ok(toc.length <= SEARCH.TOC_FALLBACK_MAX);
  assert.equal(toc.length, 159);
  assert.equal(toc.some((e) => e.t === 'Generic Head'), false, '★ REPEAT_HEADING(10) 번이면 빠진다');
  assert.equal(toc.filter((e) => e.t === 'Nine Times').length, 9);
  assert.equal(toc.some((e) => /Mid/.test(e.t)), false);
});

/* ══ 배선 · 계층 ══════════════════════════════════════════════ */

test('배선 ★ 리더 — 추출기 배선(첫 그리기 뒤) 끝에 scheduleOutline · 이미 읽은 책은 부르지 않음 · 한가할 때 · 실패는 조용히', () => {
  const src = noComments(read('../js/ui/reader.js'));
  assert.match(src, /import \{ ensure as ensureOutline, isOutlineCurrent \} from '\.\.\/search\/outline\.js';/);
  const show = src.slice(src.indexOf('export async function showReader('), src.indexOf('export function leaveReader('));
  assert.ok(show.indexOf('await renderPage()') >= 0 && show.indexOf('await renderPage()') < show.indexOf('wireExtractor(docId)'), '첫 그리기 뒤 배선');
  const wire = src.slice(src.indexOf('async function wireExtractor('), src.indexOf('function unwire('));
  assert.ok(wire.indexOf('catchUpStale();') >= 0 && wire.indexOf('catchUpStale();') < wire.indexOf('scheduleOutline(docId, ex);'));
  const sch = src.slice(src.indexOf('function scheduleOutline('), src.indexOf('function unwire('));
  assert.match(sch, /if \(isOutlineCurrent\(state\.doc\) \|\| outlineQueued === docId\) return;/);
  assert.match(sch, /requestIdleCallback\(run, \{ timeout: \d+ \}\)/);
  assert.match(sch, /if \(state\.docId !== docId \|\| !ex\.pdfDoc\) return;/);
  assert.match(sch, /ensureOutline\(docId, ex\.pdfDoc\)\.catch\(\(\) => \{\s*\}\)/);
  // 다른 곳에서 부르지 않는다(최소 배선)
  assert.equal((src.match(/ensureOutline\(/g) || []).length, 1);
  assert.equal((src.match(/scheduleOutline\(/g) || []).length, 2);
});

test('계층(3-2) — search/outline.js 는 DOM·window 를 모르고 config·db·text/* 만 import · import map 표에 있다', () => {
  const src = noComments(read('../js/search/outline.js'));
  assert.doesNotMatch(src, /\b(document|window|localStorage|sessionStorage|fetch|navigator|location|requestIdleCallback|setTimeout)\b/);
  const imports = src.match(/^\s*import[^;]*from\s*['"][^'"]+['"]/gm) || [];
  assert.ok(imports.length >= 3);
  for (const im of imports) assert.match(im, /from\s*['"](\.\.\/config\.js|\.\.\/db\.js|\.\.\/text\/[a-z]+\.js)['"]/, im);
  const html = read('../index.html');
  assert.match(html, /"\.\/js\/search\/outline\.js": "\.\/js\/search\/outline\.js\?v=[0-9a-f]{10}"/);
});

test('정리 — 흉내 DB 에 이 파일 밖 스토어 쓰기 없음', () => {
  const touched = new Set(idb.log.filter((x) => x.op === 'put').map((x) => x.store));
  for (const s of touched) assert.ok(['documents', 'searchText'].includes(s), s);
});
