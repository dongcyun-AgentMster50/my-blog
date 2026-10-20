/* ============================================================
   tests/search-toc-8g4b.test.mjs — 8g-4b 목차 탭과 검색 마무리 (spec 17-8-12 §4·§7 S19 · §11 · carryover 12–25)

   T1  S19 순수 — 머리 안내 키(개요 · 폴백 · 쓰레기 개요를 버린 책도 같은 폴백 문구(E5) · 못 읽음 · 빈 목록)
   T2  S19 순수 — 지금 쪽이 든 항목 · 줄 모형(깊이 들여쓰기 · 깊이 3 이상 접기 · p:null 못 누름) · 인쇄 쪽 표시
   T3  목차 모형 — fake-idb 위 `tocOf` → 안내 키·줄(의학책 꼴 개요 · 쓰레기 개요 · 개요 없음 · 못 읽음)
   T4  `[carryover 25 · X1]` pendingDue — 기다리던 이동은 같은 책·같은 쪽·글자 있는 쪽에서만(표)
   T5  `[carryover 13]` 개요 읽기 예약 — 가짜 requestIdleCallback 으로 행동(한가할 때 · 실패 뒤 다시 · 다른 책 · 이미 읽음)
       + `SEARCH.ENABLED=false` 면 `outline.ensure` 가 `off`(pdf 호출 0 — js/ 사본으로)
   T6  `[8g-4a Review ③]` cueSpeakerAt — 시작점을 정하면 진행 칸만 다시 그린다(번역 커서 이벤트 없음)
   T7  배선 — 목차 탭(이 책 범위만 · 항목 → beginJump · 맨 위) · F3 다른 책이면 리더를 정말로 떠남 · ① 좁은 상단바 · 문구 4개

   픽스처 글자는 지어낸 것이다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
const idb = installFakeIdb();

const db = await import('../js/db.js');
const ui = await import('../js/ui/search.js');
const outline = await import('../js/search/outline.js');
const reader = await import('../js/ui/reader.js');
const controls = await import('../js/ui/controls.js');
const i18n = await import('../js/i18n/index.js');
const { SEARCH } = await import('../js/config.js');

const { tocNoteKeys, tocCurrentIndex, tocRows, pageKeyOf, pendingDue } = ui;

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ T1 머리 안내 키 ═════════════════════════════════════════ */

test('T1 ★ S19 안내 키 — 개요는 안내 없음 · 폴백은 늘 search.toc.fallback · 쓰레기 개요를 버린 책도 같은 문구(E5)', () => {
  const items = [{ t: 'Zorvat One', p: 3, d: 1 }];
  assert.deepEqual(tocNoteKeys({ source: 'outline', items, outlineRead: true }), []);
  assert.deepEqual(tocNoteKeys({ source: 'fallback', items, outlineRead: true, outlineIgnored: false }), ['search.toc.fallback']);
  assert.deepEqual(tocNoteKeys({ source: 'fallback', items, outlineRead: true, outlineIgnored: true }), ['search.toc.fallback'],
    '★ 쓰레기 개요를 버린 책 — 키를 늘리지 않는다(E5 (가))');
});

test('T1 ★ S19 안내 키 — 개요를 못 읽음(오프라인 첫 열기) → unavailable + 폴백 문구 · 항목 0 → empty · 문서 없음 → empty', () => {
  const items = [{ t: 'Zorvat One', p: 3, d: 1 }];
  assert.deepEqual(tocNoteKeys({ source: 'fallback', items, outlineRead: false, outlineIgnored: false }), ['search.toc.unavailable', 'search.toc.fallback']);
  assert.deepEqual(tocNoteKeys({ source: 'fallback', items: [], outlineRead: true, outlineIgnored: false }), ['search.toc.empty'], '폴백도 0 → 만들지 못했다(폴백 문구 없음)');
  assert.deepEqual(tocNoteKeys({ source: 'fallback', items: [], outlineRead: false }), ['search.toc.unavailable', 'search.toc.empty']);
  assert.deepEqual(tocNoteKeys(null), ['search.toc.empty']);
});

/* ══ T2 지금 쪽 · 줄 모형 · 쪽 표시 ═══════════════════════════ */

/** Harrison 꼴 — 깊이 2(최상위 17 + 아래 20 꼴을 줄인 것), 쪽 오름차순 */
const HARR = [
  { t: 'Zorvat Part 1', p: 1, d: 1 },
  { t: 'Zorvat Ch 1', p: 3, d: 2 },
  { t: 'Zorvat Ch 2', p: 20, d: 2 },
  { t: 'Zorvat Part 2', p: 40, d: 1 },
  { t: 'Zorvat Ch 3', p: 41, d: 2 },
  { t: 'Zorvat Unresolved', p: null, d: 2 }
];

test('T2 ★ 지금 쪽이 든 항목 — 쪽 ≤ 지금 쪽 중 가장 큰 쪽 · 같은 쪽이면 뒤(더 깊은 항목) · p:null 은 셈하지 않음 · 없으면 -1', () => {
  assert.equal(tocCurrentIndex(HARR, 25), 2);
  assert.equal(tocCurrentIndex(HARR, 40), 3);
  assert.equal(tocCurrentIndex(HARR, 2), 0);
  assert.equal(tocCurrentIndex(HARR, 999), 4, 'p:null 항목은 고르지 않는다');
  assert.equal(tocCurrentIndex([{ t: 'A', p: 5, d: 1 }, { t: 'B', p: 5, d: 2 }], 5), 1, '같은 쪽 — 뒤 항목');
  assert.equal(tocCurrentIndex(HARR, 0), -1);
  assert.equal(tocCurrentIndex(HARR, null), -1);
  assert.equal(tocCurrentIndex([], 5), -1);
  // 개요 순서가 쪽 순서가 아니어도 쪽이 가장 큰 것
  assert.equal(tocCurrentIndex([{ t: 'A', p: 30, d: 1 }, { t: 'B', p: 10, d: 1 }], 50), 0);
});

test('T2 ★ S19 줄 모형 — Harrison 깊이 2 들여쓰기 · p:null 은 disabled · 지금 항목 하나 · 입력을 바꾸지 않음', () => {
  const snap = JSON.stringify(HARR);
  const rows = tocRows(HARR, 25);
  assert.deepEqual(rows.map((r) => r.indent), [0, 1, 1, 0, 1, 1], '★ 깊이 1 → 0 · 깊이 2 → 1');
  assert.deepEqual(rows.map((r) => r.disabled), [false, false, false, false, false, true], '★ p:null 은 누를 수 없다');
  assert.equal(rows[5].p, null);
  assert.deepEqual(rows.filter((r) => r.current).map((r) => r.i), [2]);
  assert.ok(rows.every((r) => !r.hidden), '깊이 2 까지는 접지 않는다');
  assert.equal(JSON.stringify(HARR), snap);
});

test('T2 ★ 깊이 3 이상은 접는다 — 지금 항목이 든 가지만 펼침 · 사용자가 고른 펼침이 이긴다 · 들여쓰기는 2 칸까지', () => {
  const items = [
    { t: 'P1', p: 1, d: 1 },
    { t: 'C1', p: 2, d: 2 },
    { t: 'S1', p: 3, d: 3 },
    { t: 'SS1', p: 4, d: 4 },
    { t: 'C2', p: 10, d: 2 },
    { t: 'S2', p: 11, d: 3 },
    { t: 'P2', p: 20, d: 1 },
    { t: 'Orphan', p: 21, d: 3 }      // 깊이 2 조상 없이 깊이 3 — 접기 단위가 없으니 보인다
  ];
  const r1 = tocRows(items, 4);      // 지금 SS1 — C1 가지만 펼침
  assert.deepEqual(r1.map((r) => r.indent), [0, 1, 2, 2, 1, 2, 0, 2]);
  assert.deepEqual(r1.map((r) => r.fold), [-1, -1, 1, 1, -1, 4, -1, -1]);
  assert.deepEqual(r1.map((r) => r.hidden), [false, false, false, false, false, true, false, false]);
  assert.equal(r1[1].kids, 2);
  assert.equal(r1[1].open, true);
  assert.equal(r1[4].kids, 1);
  assert.equal(r1[4].open, false);
  // 사용자가 C1 을 접고 C2 를 폈다
  const r2 = tocRows(items, 4, new Map([[1, false], [4, true]]));
  assert.deepEqual(r2.map((r) => r.hidden), [false, false, true, true, false, false, false, false]);
  assert.equal(r2[3].current, true, '접혀 있어도 지금 항목 표시는 남는다');
  // 지금 쪽을 모르면 모두 접힘
  assert.deepEqual(tocRows(items, null).map((r) => r.hidden), [false, false, true, true, false, true, false, false]);
});

test('T2 ★ S19 쪽 표시 — 인쇄 쪽 라벨이 다르면 "p. {인쇄} (PDF {쪽})" · 같거나 없으면 "p. {쪽}" (CMDT 2026 꼴)', () => {
  const labels = Array.from({ length: 300 }, (_, k) => (k < 38 ? 'x' + (k + 1) : String(k + 1 - 38)));
  assert.deepEqual(pageKeyOf(labels, 260), { key: 'search.pageLabeled', page: 260, label: '222' });
  assert.deepEqual(pageKeyOf(labels, 5), { key: 'search.pageLabeled', page: 5, label: 'x5' });
  assert.deepEqual(pageKeyOf(null, 260), { key: 'search.page', page: 260 });
  assert.deepEqual(pageKeyOf(['1', '2', '3'], 2), { key: 'search.page', page: 2 }, '라벨 = 쪽 번호면 하나만');
  const prev = i18n.getLang();
  try {
    i18n.setLang('en');
    const k = pageKeyOf(labels, 260);
    assert.equal(i18n.t(k.key, { label: k.label, page: i18n.formatNumber(k.page) }), 'p. 222 (PDF 260)');
  } finally { i18n.setLang(prev); }
});

/* ══ T3 목차 모형 (fake-idb 위 tocOf) ══════════════════════════ */

let seq = 0;
async function seedDoc(extra) {
  const id = 'T' + (++seq);
  await db.put('documents', Object.assign({ id, title: 'Book ' + id, fileHash: 'h-' + id, pageCount: 60, lastPage: 1, lang: 'en' }, extra || {}));
  return id;
}
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

test('T3 ★ 목차 모형 — 의학책 꼴 개요(인쇄 라벨) · 쓰레기 개요(파일 이름 0 줄 + 폴백 문구) · 개요 없음 · 못 읽음', async () => {
  const labels = Array.from({ length: 60 }, (_, k) => String(k + 1 + 100));
  const med = await seedDoc({ outlineV: outline.OUTLINE_V, outline: [{ t: 'Zorvat Chapter A', p: 5, d: 1 }, { t: 'Zorvat Chapter B', p: 30, d: 1 }], pageLabels: labels });
  const a = await outline.tocOf(med);
  assert.deepEqual(tocNoteKeys(a), []);
  const ra = tocRows(a.items, 31);
  assert.deepEqual(ra.map((r) => [r.t, r.p, r.current]), [['Zorvat Chapter A', 5, false], ['Zorvat Chapter B', 30, true]]);
  assert.equal(pageKeyOf(a.pageLabels, 30).label, '130');

  const junk = await seedDoc({ outlineV: outline.OUTLINE_V, outline: Array.from({ length: 10 }, (_, k) => ({ t: 'SAVE' + String(k).padStart(3, '0') + '.JPG', p: k + 1, d: 1 })) });
  await db.putAll('searchText', [st(junk, 2, [['Zorvat Present Simple', 1.6]]), st(junk, 7, [['Zorvat Past Simple', 1.6]])]);
  const j = await outline.tocOf(junk);
  assert.equal(j.outlineIgnored, true);
  assert.deepEqual(tocNoteKeys(j), ['search.toc.fallback'], '★ 쓰레기 개요 책 — 폴백 + 같은 머리 문구');
  const rj = tocRows(j.items, 7);
  assert.deepEqual(rj.map((r) => r.t), ['Zorvat Present Simple', 'Zorvat Past Simple']);
  assert.equal(rj.some((r) => /\.jpe?g$/i.test(r.t)), false, '★ 파일 이름 0 줄');
  assert.equal(rj[1].current, true);

  const none = await seedDoc({ outlineV: outline.OUTLINE_V, outline: [] });
  await db.put('searchText', st(none, 3, [['Zorvat Lone Title', 1.6]]));
  assert.deepEqual(tocNoteKeys(await outline.tocOf(none)), ['search.toc.fallback']);

  const unread = await seedDoc();
  await db.put('searchText', st(unread, 4, [['Zorvat Offline Title', 1.6]]));
  assert.deepEqual(tocNoteKeys(await outline.tocOf(unread)), ['search.toc.unavailable', 'search.toc.fallback'], 'pdf.js 를 못 받아 개요를 아직 못 읽음');

  const empty = await seedDoc({ outlineV: outline.OUTLINE_V, outline: [] });
  assert.deepEqual(tocNoteKeys(await outline.tocOf(empty)), ['search.toc.empty']);
});

/* ══ T4 pendingDue (X1) ═════════════════════════════════════ */

test('T4 ★ X1 pendingDue — 같은 책·같은 쪽·글자 있는 쪽에서만 처리 (숨은 리더가 넘긴 다른 쪽에 칠하지 않는다)', () => {
  const P = { kind: 'hit', docId: 'D', pageNo: 61 };
  const scr = (o) => Object.assign({ docId: 'D', page: 61, ready: true, visible: true }, o);
  assert.equal(pendingDue(P, scr()), true);
  assert.equal(pendingDue(P, scr({ page: 62 })), false, '★ F1 — 숨은 리더가 62쪽으로 넘어간 화면');
  assert.equal(pendingDue(P, scr({ docId: 'E' })), false, '다른 책');
  assert.equal(pendingDue(P, scr({ ready: false })), false, '자리표시자 — 그 쪽이 준비되면 그때');
  assert.equal(pendingDue(P, scr({ visible: false })), true, '숨김 여부는 보지 않는다(이동 뒤 리더가 그린 쪽)');
  assert.equal(pendingDue(null, scr()), false);
  assert.equal(pendingDue(P, null), false);
  assert.equal(pendingDue({ kind: 'top', docId: 'D', pageNo: '61' }, scr()), false, '쪽 번호는 수로 같아야(문자열 아님)');
});

/* ══ T5 개요 읽기 예약 (carryover 13) ═════════════════════════ */

function fakeIdle() {
  const q = [];
  const g = globalThis;
  const had = Object.prototype.hasOwnProperty.call(g, 'requestIdleCallback');
  const old = g.requestIdleCallback;
  g.requestIdleCallback = (fn, opts) => { q.push({ fn, opts }); return q.length; };
  return {
    q,
    fire() { const xs = q.splice(0); for (const x of xs) x.fn({ didTimeout: false, timeRemaining: () => 10 }); },
    restore() { if (had) g.requestIdleCallback = old; else delete g.requestIdleCallback; }
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('T5 ★ 개요 예약 — 한가할 때(가짜 requestIdleCallback, 상한 5초)에만 읽는다 · 그 전엔 읽기 0 (R9 변이)', async () => {
  const idle = fakeIdle();
  try {
    let cur = 'D';
    const calls = [];
    const s = reader.createOutlineScheduler({ isCurrent: () => false, docId: () => cur, ensure: async (id, pdf) => { calls.push([id, pdf.tag]); return { status: 'saved' }; }, idle: reader.outlineIdle });
    assert.equal(s.schedule('D', { pdfDoc: { tag: 'pdfD' } }), true);
    await tick();
    assert.equal(calls.length, 0, '★ 즉시 부르지 않는다');
    assert.equal(idle.q.length, 1);
    assert.deepEqual(idle.q[0].opts, { timeout: 5000 });
    assert.equal(s.schedule('D', { pdfDoc: { tag: 'pdfD' } }), false, '같은 책이 이미 예약됨 — 겹쳐 예약하지 않는다');
    idle.fire();
    await tick();
    assert.deepEqual(calls, [['D', 'pdfD']]);
    assert.equal(s.queued(), null, '돈 뒤에는 표시를 푼다');
  } finally { idle.restore(); }
});

test('T5 ★ 개요 예약 — 실패한 책은 같은 세션의 다음 그리기에서 다시 시도(R8 변이) · 다른 책으로 갔으면 안 읽음 · 이미 읽은 책은 예약 0', async () => {
  const idle = fakeIdle();
  try {
    let cur = 'D';
    let current = false;
    const calls = [];
    const s = reader.createOutlineScheduler({
      isCurrent: () => current, docId: () => cur,
      ensure: async (id) => { calls.push(id); throw new Error('worker gone'); },
      idle: reader.outlineIdle
    });
    s.schedule('D', { pdfDoc: {} });
    idle.fire();
    await tick();
    assert.deepEqual(calls, ['D'], '실패는 조용히(던지지 않는다)');
    assert.equal(s.schedule('D', { pdfDoc: {} }), true, '★ 실패 뒤 다음 그리기에서 다시 예약된다');
    idle.fire();
    await tick();
    assert.deepEqual(calls, ['D', 'D']);

    // 예약해 두고 다른 책으로 감 → 한가할 때 읽지 않는다
    s.schedule('D', { pdfDoc: {} });
    cur = 'E';
    idle.fire();
    await tick();
    assert.deepEqual(calls, ['D', 'D'], '★ 다른 책이면 안 읽는다');
    assert.equal(s.queued(), null);
    // pdf 문서가 아직 없으면 안 읽는다
    s.schedule('E', { pdfDoc: null });
    idle.fire();
    await tick();
    assert.deepEqual(calls, ['D', 'D']);
    // 이미 읽은 책 — 예약 0
    current = true;
    assert.equal(s.schedule('E', { pdfDoc: {} }), false);
    assert.equal(idle.q.length, 0);
    // 예약 자체가 던지면 표시를 푼다(다음에 다시)
    current = false;
    const bad = reader.createOutlineScheduler({ isCurrent: () => false, docId: () => 'Z', ensure: async () => ({}), idle: () => { throw new Error('no idle'); } });
    assert.equal(bad.schedule('Z', { pdfDoc: {} }), true);
    assert.equal(bad.queued(), null);
  } finally { idle.restore(); }
});

test('T5 ★ requestIdleCallback 이 없으면 1.5초 뒤(setTimeout)', async (t) => {
  const g = globalThis;
  const had = Object.prototype.hasOwnProperty.call(g, 'requestIdleCallback');
  const old = g.requestIdleCallback;
  delete g.requestIdleCallback;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let n = 0;
    reader.outlineIdle(() => { n++; });
    t.mock.timers.tick(1499);
    assert.equal(n, 0);
    t.mock.timers.tick(1);
    assert.equal(n, 1);
  } finally {
    t.mock.timers.reset();
    if (had) g.requestIdleCallback = old;
  }
});

test('T5 ★ SEARCH.ENABLED=false — outline.ensure 는 off 이고 pdf 를 부르지 않는다 (8g-3 Review R4 변이 · js/ 사본)', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'mr-outline-off-'));
  try {
    cpSync(fileURLToPath(new URL('../js/', import.meta.url)), join(tmp, 'js'), { recursive: true });
    const cfgPath = join(tmp, 'js', 'config.js');
    const cfg = readFileSync(cfgPath, 'utf8');
    const re = /(export const SEARCH = Object\.freeze\(\{[\s\S]*?)ENABLED: true,/;
    assert.match(cfg, re, '전제: SEARCH 블록의 ENABLED: true');
    writeFileSync(cfgPath, cfg.replace(re, '$1ENABLED: false,'));
    const off = await import(pathToFileURL(join(tmp, 'js', 'search', 'outline.js')).href);
    const id = await seedDoc();
    let pdfCalls = 0;
    const spy = new Proxy({ numPages: 60 }, { get(o, k) { if (k === 'numPages') return 60; if (k === 'then') return undefined; return () => { pdfCalls++; return Promise.resolve(null); }; } });
    const mark = idb.log.length;
    assert.deepEqual(await off.ensure(id, spy), { status: 'off' });
    assert.equal(pdfCalls, 0, '★ pdf 호출 0');
    assert.equal(idb.log.length, mark, 'DB 호출 0');
    assert.equal(SEARCH.ENABLED, true, '앱은 켜져 있다');
    // 켜진 앱은 같은 문서를 읽는다(대조)
    const on = await outline.ensure(id, { numPages: 60, async getOutline() { pdfCalls++; return []; }, async getPageLabels() { return null; } });
    assert.equal(on.status, 'saved');
    assert.equal(pdfCalls, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

/* ══ T6 cue 뒤 진행 칸 (8g-4a Review ③) ═══════════════════════ */

function fakeSpeaker(ok) {
  const log = [];
  return {
    log,
    cue(id, start) { log.push(['cue', id, start]); if (ok) { this.idx = 7; } return ok; },
    idx: 2,
    getIndex() { return this.idx; },
    getTotal() { return 30; },
    addEventListener() { log.push(['listen']); }
  };
}

test('T6 ★ ③ cueSpeakerAt — 시작점을 정하면 진행 칸을 새 자리로(7/30) · 못 정하면 그리지 않음 · speaker 없으면 false', () => {
  const sp = fakeSpeaker(true);
  const painted = [];
  assert.equal(controls.cueSpeakerAt(sp, 'L5', 3, (i, n) => painted.push([i, n])), true);
  assert.deepEqual(sp.log, [['cue', 'L5', 3]]);
  assert.deepEqual(painted, [[7, 30]], '★ 이동 뒤 값으로 — [▶] 전에도 맞다');
  const no = fakeSpeaker(false);
  assert.equal(controls.cueSpeakerAt(no, 'L5', 3, (i, n) => painted.push([i, n])), false);
  assert.equal(painted.length, 1, '못 정하면 그대로');
  assert.equal(controls.cueSpeakerAt(null, 'L5', 3, () => painted.push(1)), false);
  assert.equal(controls.cueSpeakerAt({}, 'L5', 3, () => painted.push(1)), false);
});

test('T6 ★ ③ 배선 — cueAt 은 cueSpeakerAt(speaker, …, paintProgress) 만 · linechange(번역 커서)를 내지 않는다', () => {
  const src = noComments(read('../js/ui/controls.js'));
  const ca = src.slice(src.indexOf('export function cueAt('), src.indexOf('export function cueSpeakerAt('));
  assert.match(ca, /return cueSpeakerAt\(speaker, lineId, start, paintProgress\);/);
  const body = src.slice(src.indexOf('export function cueSpeakerAt('), src.indexOf('export function speechState('));
  assert.doesNotMatch(body, /readalong|dispatchEvent|emit\(/, '번역 커서·이벤트를 건드리지 않는다');
});

/* ══ T7 배선 ══════════════════════════════════════════════════ */

test('T7 ★ 목차 탭 배선 — 이 책 범위에서만 · 항목은 beginJump(JUMP_ENV) 로 · 도착하면 맨 위 + 첫 줄 cue · 폴백 전 prepareDoc', () => {
  const s = noComments(read('../js/ui/search.js'));
  const ta = s.slice(s.indexOf('function tocAllowed('), s.indexOf('function paintTabs('));
  assert.match(ta, /S\.scope === 'doc' && !!S\.docId/, '★ 서재 범위엔 목차 탭 없음');
  const tj = s.slice(s.indexOf('function tocJump('), s.indexOf('function relabel('));
  assert.match(tj, /S\.pending = \{ kind: 'top', docId: S\.docId, pageNo: p, paused: false \};/);
  assert.match(tj, /beginJump\(JUMP_ENV, \{ docId: S\.docId, pageNo: p \}, false\)/, '★ 낭독 중이면 멈춤 → 숨은 리더에 이동 표시 → 쌓는 이동');
  const rp = s.slice(s.indexOf('function onReaderPage('), s.indexOf('function locate('));
  assert.match(rp, /if \(pend\.kind === 'top'\) \{ doTop\(scr, pend\); return; \}/);
  const dt = s.slice(s.indexOf('function doTop('), s.indexOf('function cueHere('));
  assert.match(dt, /revealTop\(\);/);
  assert.match(dt, /cueHere\(String\(first\), 0\)/);
  const lt = s.slice(s.indexOf('async function loadToc('), s.indexOf('function tocKey('));
  assert.ok(lt.indexOf("data.source === 'fallback'") >= 0 && lt.indexOf("data.source === 'fallback'") < lt.indexOf('engine.prepareDoc(docId'), '★ 폴백이면 백필(prepareDoc)을 기다린 뒤 다시 만든다(carryover 12)');
  const re = s.slice(s.indexOf('function tocRowEl('), s.indexOf('function scrollTocToCurrent('));
  assert.match(re, /b\.disabled = true;/, 'p:null 은 못 누름');
  assert.match(re, /tt\.setAttribute\('dir', 'ltr'\);\s*tt\.setAttribute\('lang', lang\);/, '원서 글자 — dir=ltr lang=문서 언어(S22)');
  assert.match(re, /tt\.textContent = r\.t;/, '제목은 textContent(13절)');
  assert.doesNotMatch(s, /innerHTML|insertAdjacentHTML|outerHTML/);
});

test('T7 ★ F3 — 숨은 리더에서 다른 책으로 가면 리더를 정말로 떠난다(leaveReaderNow — 낭독 멈춤·번역 띠 정리) · 같은 책은 그대로', () => {
  const src = noComments(read('../js/ui/reader.js'));
  const sr = src.slice(src.indexOf('export async function showReader('), src.indexOf('export function softReturnPlan('));
  assert.match(sr, /if \(state\.soft && state\.docId !== docId\) leaveReaderNow\(\);\s*state\.soft = false;/);
  assert.ok(sr.indexOf("if (plan === 'reshow')") < sr.indexOf('leaveReaderNow()'), '판정 뒤(같은 책 reshow·follow 는 그대로)');
  const lv = src.slice(src.indexOf('export function leaveReader('), src.indexOf('function leaveReaderNow('));
  assert.match(lv, /return;\s*\}\s*leaveReaderNow\(\);\s*\}/, 'leaveReader 의 "정말 떠남"도 같은 함수');
  const now = src.slice(src.indexOf('function leaveReaderNow('), src.indexOf('async function renderPage('));
  for (const re of [/leaveControls\(\);/, /original\.leaveOriginal\(\);/, /refreshGate\.left\(\);/, /for \(const fn of leaveListeners\)/]) assert.match(now, re);
  const ctl = noComments(read('../js/ui/controls.js'));
  const lc = ctl.slice(ctl.indexOf('export function leaveControls('), ctl.indexOf('export function leaveControls(') + 300);
  assert.match(lc, /trband\.leave\(\)/, '빈 번역 띠를 거두는 길');
});

test('T7 ★ F2 hintedAnchor — 검색이 칠해 둔 적중 줄이 이 쪽 흐름 줄이고 **보이면** 뷰 전환 기준 줄 · 아니면 평소 규칙(null)', () => {
  const flow = ['168:1', '168:31', '168:65'];
  assert.equal(reader.hintedAnchor('168:65', ['168:1', '168:31', '168:65'], flow), '168:65', '★ 원본 보기는 쪽 전체가 보인다 — 가운데(31)가 아니라 적중(65)');
  assert.equal(reader.hintedAnchor('168:65', ['168:1', '168:31'], flow), null, '굴려서 안 보이면 사용자가 보던 자리를 지킨다');
  assert.equal(reader.hintedAnchor('169:2', ['169:2'], flow), null, '이 쪽 흐름 줄이 아님');
  assert.equal(reader.hintedAnchor(null, flow, flow), null);
  assert.equal(reader.hintedAnchor(65, ['65'], ['65']), '65', '수 id 도 문자열로');
  const src = noComments(read('../js/ui/reader.js'));
  const ra = src.slice(src.indexOf('function resolveAnchor('), src.indexOf('function landOn('));
  assert.ok(ra.indexOf('hintedAnchor(') >= 0 && ra.indexOf('hintedAnchor(') < ra.indexOf('pickAnchorLine(ctx)'), '★ 힌트를 평소 규칙보다 먼저');
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /setViewAnchorHint\(\(\) => \{/);
  const cp = s.slice(s.indexOf('function clearPaint('), s.indexOf('function clearPaint(') + 120);
  assert.match(cp, /S\.curLine = null;/, '강조를 지우면(▶ 포함) 힌트도 없다');
});

test('T7 ★ F2 shouldRecue — 같은 쪽을 다른 뷰로 다시 그렸고 시작점이 아직 검색 것이면 다시 cue · 새 판 다시 그리기는 그대로 · ▶ 뒤엔 안 함', () => {
  const lj = { docId: 'D', pageNo: 217, i: 3 };
  const scr = (view) => ({ docId: 'D', page: 217, view });
  const prev = (view, page) => ({ docId: 'D', page: page || 217, view });
  assert.equal(ui.shouldRecue(null, scr('reflow'), lj, prev('original'), true), true, '★ 원본 → 리플로우(멈춘 채)');
  assert.equal(ui.shouldRecue(null, scr('original'), lj, prev('reflow'), true), true, '리플로우 → 원본');
  assert.equal(ui.shouldRecue(null, scr('reflow'), lj, prev('original'), false), false, '▶ 뒤(시작점이 낭독 것) — 끌고 오지 않는다');
  assert.equal(ui.shouldRecue(null, scr('reflow'), lj, prev('reflow'), true), false, '같은 뷰(언어 바꿈·다시 보이기)');
  assert.equal(ui.shouldRecue(null, scr('reflow'), lj, prev('original', 216), true), false, '다른 쪽에서 옴');
  assert.equal(ui.shouldRecue(null, scr('reflow'), lj, null, true), false);
  assert.equal(ui.shouldRecue({ refreshed: true }, scr('reflow'), lj, prev('reflow'), false), true, '새 판 다시 그리기(8g-4a 그대로)');
  assert.equal(ui.shouldRecue({ refreshed: true }, scr('reflow'), { docId: 'D', pageNo: 9 }, prev('reflow'), true), false, '마지막 적중이 다른 쪽');
  assert.equal(ui.shouldRecue({ refreshed: true }, scr('reflow'), null, null, true), false);
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /onSpeechChange\(\(st\) => \{ if \(st === 'speaking'\) \{ clearPaint\(\); S\.cueOwned = false; \} \}\);/);
  assert.match(s, /if \(\(st === 'paused' \|\| st === 'idle'\) && cueAt\(lineId, start\)\) S\.cueOwned = true;/);
  assert.match(s, /repaint\(scr, shouldRecue\(info, scr, S\.lastJump, prev, S\.cueOwned\)\);/);
});

test('T7 ★ ① 좁은 폰 상단바 — 퀴즈 버튼이 보이면 ≤ 400px 에서 [⧉] 는 글리프(48 그대로) · 다른 버튼 규칙은 그대로', () => {
  const css = read('../css/reader.css');
  const m = css.match(/@media \(max-width: 400px\) \{([\s\S]*?)\n\}/);
  assert.ok(m, '미디어 규칙');
  assert.match(m[1], /\.topbar:has\(\.quiz-btn:not\(\[hidden\]\)\) \.view-toggle \{\s*font-size: 0;/);
  assert.match(m[1], /\.view-toggle::before \{\s*content: '⧉';/);
  assert.doesNotMatch(m[1], /min-inline-size|min-block-size/, '48×48 규칙을 건드리지 않는다');
});

test('T7 ★ 목차 문구 4개(spec 4-6) × 네 언어 · ar 은 en 복사가 아님 · E5 한 문구', () => {
  const keys = ['search.toc.fallback', 'search.toc.unavailable', 'search.toc.empty', 'search.toc.here'];
  for (const lang of i18n.LANGS) for (const k of keys) assert.ok(i18n.hasKey(k, lang), lang + ' ' + k);
  for (const k of keys) assert.notEqual(i18n.BUNDLES.ar[k], i18n.BUNDLES.en[k], k);
  assert.equal(i18n.BUNDLES.ko['search.toc.fallback'], 'PDF 에 쓸 만한 목차가 없어 큰 제목으로 만든 목록입니다 — 빠지거나 틀린 항목이 있을 수 있습니다');
  const html = read('../index.html');
  assert.match(html, /id="searchTabToc"[^>]*aria-controls="searchToc"/);
  assert.match(html, /id="searchToc" role="tabpanel"/);
});

test('정리 — 흉내 DB 에 이 파일 밖 스토어 쓰기 없음', () => {
  const touched = new Set(idb.log.filter((x) => x.op === 'put').map((x) => x.store));
  for (const s of touched) assert.ok(['documents', 'searchText'].includes(s), s);
});
