/* ============================================================
   tests/search-ui-8g.test.mjs — 8g-4a 검색 화면·결과·이동 (spec 17-8-12 §4 · §7 S20–S29 의 Node 몫 · §8)

   화면 순수 부분(`js/ui/search.js`)·라우터·`speaker.cue`·`pauseForJump` 판정·엔진 결과 세 통로·바꿔 그리기·앞 세대 무시.
   DOM 은 없다 — 브라우저 확인(S20–S29 `[D]`)은 headless 캡처가 맡는다. 원서 문장은 넣지 않는다(지어낸 글자).

   U1  라우터 — `#/search`·`#/search/:docId`, 검색어는 URL 에 없다(S28)
   U2  결과 묶기 — 제목 → 본문 → 표, 쪽당 한 줄(S21)
   U3  띠 목록·순번·이동(쪽 순서, 끝에서 멈춤)
   U4  화면 글자 = 검색 레코드 text(바이트 같음) · 줄바꿈 하이픈 적중은 구간 둘 · 표 글자 = 레코드 table
   U5  다시 찾기 — 저장 오프셋 → 순번 → 못 찾음(S23 판 어긋남)
   U6  엔진 결과 세 통로(carryover 1) · 앞 세대 무시(2) · 같은 세대 onPartial 바꿔 그리기(3) · 서재 책별 진행(4) · 저장소 찬 동안(5)
   U7  최근 검색 칩 · 글자 체계 안내(17-8-9 가)
   U8  ★ 이름 — search-hit·search-cur 는 낭독 하이라이트(medreader-current)와 다르다(V11)
   U9  ★ 낭독 중 결과로 → 먼저 멈춤(V12) · cue 가 적중 문장 · 인용이면 그 뒤 첫 발화 · 번역 요청 0 의 전제(queue 이벤트 없음)
   U10 배선·계층 소스 — 리더·controls·서재·index.html · SEARCH.ENABLED=false · innerHTML 없음 · i18n 34 키 × 4
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

const ui = await import('../js/ui/search.js');
const { parseRoute, searchHash, readerHash } = await import('../js/router.js');
const { createSpeaker } = await import('../js/tts/speaker.js');
const { pauseSpeakerForJump } = await import('../js/ui/controls.js');
const { SEARCH } = await import('../js/config.js');
const { fromStored } = await import('../js/text/store.js');
const { describePage, flowParasOf } = await import('../js/text/screen.js');
const { joinPieces } = await import('../js/tts/text.js');
const { searchRecordOf, parseQuery, SEARCH_ERR } = await import('../js/text/search.js');
const { algoVersion: ALGO_VERSION } = await import('../js/text/layout.js');
const { derivedHash } = await import('../js/text/store.js');
const { BUNDLES } = await import('../js/i18n/index.js');

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* ══ U1 라우터 ════════════════════════════════════════════ */

test('U1 ★ #/search = 서재 전체 · #/search/:docId = 이 책 · 검색어는 해시에 없다(S28) · 왕복', () => {
  assert.deepEqual(parseRoute('#/search').params, {});
  assert.equal(parseRoute('#/search').name, 'search');
  assert.deepEqual(parseRoute('#/search/abc').params, { docId: 'abc' });
  assert.deepEqual(parseRoute('#/search/doc%20one/').params, { docId: 'doc one' });
  // 꼬리 쿼리는 버린다 — 검색어를 해시로 받는 길이 없다
  assert.deepEqual(parseRoute('#/search/abc?q=metformin').params, { docId: 'abc' });
  assert.equal(searchHash(), '#/search');
  assert.equal(searchHash(''), '#/search');
  assert.equal(searchHash('doc one'), '#/search/doc%20one');
  assert.equal(parseRoute(searchHash('a/b')).params.docId, 'a/b');
  // search.js 는 해시를 searchHash·readerHash·libraryHash 로만 만든다 — 검색어를 URL 에 넣는 코드가 없다
  const src = noComments(read('../js/ui/search.js'));
  assert.ok(!/location\.(hash|href|search)\s*=/.test(src), '해시를 직접 쓴다');
  assert.ok(!/searchHash\([^)]*query/i.test(src) && !/readerHash\([^)]*query/i.test(src));
  assert.ok(!/history\.(push|replace)State/.test(src));
});

/* ══ U2 결과 묶기 ══════════════════════════════════════════ */

const H = (pageNo, at, kind, len) => ({ pageNo, at, len: len || 5, kind });

test('U2 ★ 묶음 순서 제목 → 본문 → 표 · 묶음 안 쪽 순서 · 쪽당 한 줄(적중 수·첫 적중)', () => {
  const hits = [H(9, 40, 'table'), H(3, 70, 'body'), H(3, 10, 'body'), H(7, 0, 'head'), H(1, 5, 'body'), H(9, 2, 'table'), H(2, 0, 'head')];
  const g = ui.groupRows(hits);
  assert.deepEqual(g.map((x) => [x.kind, x.count]), [['head', 2], ['body', 3], ['table', 2]]);
  assert.deepEqual(g[0].rows.map((r) => r.pageNo), [2, 7]);
  assert.deepEqual(g[1].rows.map((r) => [r.pageNo, r.count, r.first.at]), [[1, 1, 5], [3, 2, 10]], '쪽당 한 줄 · 첫 적중 = 가장 앞 오프셋');
  assert.deepEqual(g[2].rows.map((r) => [r.pageNo, r.count, r.first.at]), [[9, 2, 2]]);
  assert.deepEqual(ui.groupRows([]), []);
  assert.deepEqual(ui.groupRows([H(1, 0, 'weird')]), [], '모르는 묶음은 버린다');
  assert.deepEqual(ui.GROUP_ORDER, ['head', 'body', 'table']);
});

test('U2 결과 조각 — 앞뒤 글자(낱말 경계) · 말줄임은 잘린 쪽에만(문단 처음·끝이면 없음) · 문단을 넘지 않는다', () => {
  const t = 'Short heading\nThe zorvat sign appears when the quellon pressure rises above the baseline seen in volunteers.\nNext para';
  const at = t.indexOf('zorvat');
  const a = ui.snipOf(t, at, 6);
  assert.equal(a.hit, 'zorvat');
  assert.equal(a.before, 'The ');
  assert.equal(a.cutStart, false, '★ 문단 첫머리 — 앞 말줄임 없음');
  assert.equal(a.cutEnd, true);
  assert.ok(!a.after.includes('\n'));
  const h = ui.snipOf(t, 0, 5);
  assert.deepEqual([h.before, h.hit, h.cutStart, h.cutEnd], ['', 'Short', false, false], '짧은 제목 — 말줄임 없음');
  const end = ui.snipOf(t, t.indexOf('volunteers'), 10);
  assert.equal(end.cutEnd, false, '문단 끝까지 — 뒤 말줄임 없음');
  assert.equal(end.cutStart, true);
});

/* ══ U3 띠 ══════════════════════════════════════════════════ */

test('U3 ★ 띠 목록 — 쪽 순서 · 쪽 안은 본문 글자 → 표 · 결과 줄 → 그 줄 첫 적중 · 끝에서 멈춤 · 같은 쪽 순번', () => {
  const hits = [H(5, 30, 'table'), H(5, 80, 'body'), H(2, 3, 'head'), H(5, 10, 'head'), H(8, 1, 'body')];
  const L = ui.bandList(hits);
  assert.deepEqual(L.map((h) => [h.pageNo, h.at, h.table]), [[2, 3, false], [5, 10, false], [5, 80, false], [5, 30, true], [8, 1, false]]);
  assert.equal(ui.bandIndexOfRow(L, { pageNo: 5, kind: 'body', first: { at: 80 } }), 2);
  assert.equal(ui.bandIndexOfRow(L, { pageNo: 5, kind: 'table', first: { at: 30 } }), 3);
  assert.equal(ui.bandIndexOfRow(L, { pageNo: 5, kind: 'body', first: { at: 999 } }), 1, '오프셋이 없으면 그 쪽 본문 글자 첫 적중');
  assert.equal(ui.bandIndexOfRow(L, { pageNo: 4, kind: 'body', first: { at: 0 } }), -1);
  assert.equal(ui.bandStep(0, 5, -1), -1, '처음에서 ‹ 는 없다(돌지 않는다)');
  assert.equal(ui.bandStep(4, 5, 1), -1);
  assert.equal(ui.bandStep(2, 5, 1), 3);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => ui.nthOnPage(L, i)), [0, 0, 1, 0, 0], '표 적중은 표 글자 안에서 센다');
});

/* ══ U4 화면 글자 ════════════════════════════════════════════ */

let ID = 0;
function line(text, o) {
  const p = o || {};
  return {
    id: 'L' + (++ID), text: text, bbox: [0, 0, 100, 10], baseline: 0, fontSize: 10, col: 0, role: p.role || 'body',
    hyphenJoin: !!p.hy, paraId: p.para == null ? null : p.para, regionId: p.region == null ? null : p.region, runs: []
  };
}
/** 저장본 한 쪽 — paras: [[줄 글자…]], o.hy: 하이픈으로 다음 줄과 잇는 줄 글자, o.table: 4-8 표 줄 */
function page(pageNo, paras, o) {
  const opt = o || {};
  const lines = [];
  const ps = [];
  paras.forEach((ts, i) => {
    const pid = 'p' + i;
    const ids = ts.map((t) => { const l = line(t, { para: pid, hy: (opt.hy || []).indexOf(t) >= 0 }); lines.push(l); return l.id; });
    ps.push({ id: pid, lineIds: ids, kind: 'body', bbox: [0, 0, 1, 1], continuesNext: false, continuesPrev: false });
  });
  const regions = [];
  (opt.tables || []).forEach((rows, g) => {
    const ids = rows.map((t) => { const l = line(t, { region: 'r' + g, role: 'table' }); lines.push(l); return l.id; });
    regions.push({ id: 'r' + g, kind: 'table', bbox: [0, 0, 1, 1], lineIds: ids, pageNo: pageNo });
  });
  return {
    docId: 'D', pageNo: pageNo, width: 600, height: 800, algoVersion: ALGO_VERSION, storeVersion: 1, derivedHash: derivedHash(),
    lines: lines, paragraphs: ps, regions: regions, columns: { count: 1, gutters: [] },
    stats: { medianFontSize: 10, medianLeading: 12, bodyLeft: [], warn: null, widthFixed: 0 }, roleVersion: 1
  };
}

test('U4 ★ 화면 글자 = 검색 레코드 text(바이트 같음) · 줄바꿈 하이픈으로 갈린 적중은 두 줄 구간 · 문단 사이 적중 좌표', () => {
  const rec = page(4, [
    ['Zorvat appears in the first line', 'and the zorvat second time.'],
    ['Cardio-', 'vascular zorvat outcomes improve.']
  ], { hy: ['Cardio-'], tables: [['Drug  Dose', 'zorvat   10 mg'], ['Other row']] });
  const F = fromStored(rec);
  const desc = describePage(F);
  const st = searchRecordOf(F, desc);
  const idx = ui.screenIndex(flowParasOf(desc), joinPieces);
  assert.equal(idx.text, st.text, '★ 저장 글자 = 화면 글자(17-8-12 U6) — 다시 찾기가 1:1');
  const pq = parseQuery('zorvat');
  const hits = ui.findOn(idx.text, pq);
  assert.equal(hits.length, 3);
  const rs = ui.rangesOnScreen(idx, hits);
  assert.equal(rs.length, 3);
  for (const r of rs) assert.equal(r.length, 1);
  // 두 번째 문단의 적중 — 그 문단 줄 좌표(문단 시작 = base)
  const second = rs[2][0];
  const ln = rec.lines.find((l) => l.id === second.id);
  assert.equal(ln.text.slice(second.start, second.end).toLowerCase(), 'zorvat');

  const pq2 = parseQuery('cardiovascular');
  const h2 = ui.findOn(idx.text, pq2);
  assert.equal(h2.length, 1, '줄바꿈 하이픈으로 갈린 낱말이 화면 글자에서 찾힌다');
  const r2 = ui.rangesOnScreen(idx, h2)[0];
  assert.equal(r2.length, 2, '★ 두 줄에 걸친 구간 둘');

  const ti = ui.tableIndex(F);
  assert.equal(ti.text, st.table, '★ 표 글자 = 레코드 table(같은 식)');
  const th = ui.findOn(ti.text, pq);
  assert.equal(th.length, 1);
  assert.equal(ui.regionAt(ti, th[0].at), 'r0');
  assert.equal(ui.regionAt(ti, ti.text.indexOf('Other')), 'r1');
  assert.equal(ui.regionAt(ti, 99999), null);
});

test('U5 ★ 다시 찾기 — 저장 오프셋이 그대로면 그것 · 어긋나면 같은 순번 · 그것도 없으면 -1(쪽 맨 위 + search.notOnPage)', () => {
  assert.equal(ui.pickHit([3, 40, 90], 40, 0), 1);
  assert.equal(ui.pickHit([3, 41, 90], 40, 1), 1, '판 어긋남 — 순번');
  assert.equal(ui.pickHit([3], 40, 1), -1, '★ 화면에 그만큼 없다 → 못 찾음');
  assert.equal(ui.pickHit([], 0, 0), -1);
  assert.equal(ui.pickHit([5], 7, -1), -1);
});

/* ══ U6 엔진 결과 세 통로 · 세대 ═══════════════════════════════ */

test('U6 ★ 세 통로 — 정상 / ERR_SEARCH_*(적중 0, 검색어 안내) / ERR_DB_*(적중과 함께 저장소 안내) / reject(일반 안내)', () => {
  assert.deepEqual(ui.outcomeOf({ hits: [1] }), { type: 'ok' });
  assert.deepEqual(ui.outcomeOf({ error: SEARCH_ERR.SHORT, hits: [] }), { type: 'query', key: 'search.minChars' });
  assert.deepEqual(ui.outcomeOf({ error: SEARCH_ERR.LONG, hits: [] }), { type: 'query', key: 'search.tooLong' });
  assert.deepEqual(ui.outcomeOf({ error: 'ERR_DB_QUOTA', hits: [1, 2] }), { type: 'db', key: 'err.quota' });
  assert.deepEqual(ui.outcomeOf({ error: 'ERR_DB_OPEN', hits: [] }), { type: 'db', key: 'err.dbOpen' });
  assert.deepEqual(ui.outcomeOf({ error: 'ERR_DB_UPGRADED' }), { type: 'db', key: 'err.dbUpgraded' });
  assert.equal(ui.rejectKey({ code: 'ERR_DB_OPEN' }), 'err.dbOpen');
  assert.equal(ui.rejectKey(new TypeError('x')), 'err.unknown');
  assert.equal(ui.rejectKey(undefined), 'err.unknown');
});

/** 가짜 엔진 — 호출마다 손잡이(deferred)를 남긴다. */
function fakeEngine() {
  const calls = [];
  const mk = (kind) => (a, b, c) => {
    const o = kind === 'doc' ? c : b;
    let res, rej;
    const p = new Promise((r, j) => { res = r; rej = j; });
    calls.push({ kind, args: [a, b], opts: o, resolve: res, reject: rej });
    return p;
  };
  return { calls, searchDoc: mk('doc'), searchLibrary: mk('lib') };
}
const tick = () => new Promise((r) => setImmediate(r));

test('U6 ★ 같은 세대 onPartial 두 번 → 바꿔 그림(덧붙이지 않음) · 끝 결과로 바뀜 (carryover 3)', async () => {
  const eng = fakeEngine();
  const m = ui.newModel('doc', 'zorvat');
  const evs = [];
  const run = ui.createSearchRun({ searchDoc: eng.searchDoc, searchLibrary: eng.searchLibrary, draw: (ev) => { evs.push(ev.type); ui.applyEvent(m, ev); } });
  const done = run.doc('D', 'zorvat');
  const c = eng.calls[0];
  c.opts.onPartial({ docId: 'D', hits: [H(1, 0, 'body'), H(2, 0, 'body')], partial: true, preparing: { done: 0, total: 9 } });
  c.opts.onPartial({ docId: 'D', hits: [H(1, 0, 'body'), H(2, 0, 'body'), H(3, 0, 'body')], partial: true, preparing: { done: 0, total: 9 } });
  assert.equal(m.result.hits.length, 3, '★ 두 번째 부분 결과가 첫 번째를 **바꾼다**(2 + 3 = 5 가 아니다)');
  assert.equal(m.partial, true);
  c.resolve({ docId: 'D', hits: [H(1, 0, 'body'), H(2, 0, 'body'), H(3, 0, 'body'), H(4, 0, 'body')], pagesCovered: 4, pageCount: 4 });
  await done;
  assert.equal(m.result.hits.length, 4);
  assert.equal(m.final, true);
  assert.equal(m.partial, false);
  assert.deepEqual(evs, ['partial', 'partial', 'final']);
  // 진행(onProgress)도 지금 세대만
  c.opts.onProgress({ docId: 'D', done: 5, total: 9 });
  assert.deepEqual(m.progress.get('D'), { done: 5, total: 9 });
});

test('U6 ★ 앞 세대 검색 — 그 결과·onPartial·진행·**reject** 모두 버린다 (carryover 2 — 채우기를 기다리다 취소된 검색은 reject 로 끝난다)', async () => {
  const eng = fakeEngine();
  const evs = [];
  const run = ui.createSearchRun({ searchDoc: eng.searchDoc, searchLibrary: eng.searchLibrary, draw: (ev) => evs.push(ev) });
  const first = run.doc('D', 'zor');
  const second = run.doc('D', 'zorvat');
  const [a, b] = eng.calls;
  a.opts.onPartial({ hits: [H(1, 0, 'body')] });
  a.opts.onProgress({ docId: 'D', done: 1, total: 2 });
  a.reject(Object.assign(new Error('closed'), { code: 'ERR_DB_OPEN' }));
  await first;
  assert.equal(evs.length, 0, '★ 앞 세대의 것은 하나도 그리지 않는다');
  b.resolve({ docId: 'D', hits: [], pagesCovered: 1, pageCount: 1 });
  await second;
  assert.deepEqual(evs.map((e) => e.type), ['final']);
  // 지금 세대의 reject 는 일반 안내로
  const third = run.doc('D', 'zorvatx');
  eng.calls[2].reject(Object.assign(new Error('x'), { code: 'ERR_DB_OPEN' }));
  await third;
  assert.equal(evs[1].type, 'reject');
  assert.equal(ui.rejectKey(evs[1].error), 'err.dbOpen');
  // cancelled 결과도 그리지 않는다 · cancel() 뒤의 결과도
  const fourth = run.doc('D', 'qq');
  run.cancel();
  eng.calls[3].resolve({ docId: 'D', hits: [H(1, 0, 'body')] });
  await fourth;
  const fifth = run.doc('D', 'qqq');
  eng.calls[4].resolve({ docId: 'D', hits: [], cancelled: true });
  await fifth;
  assert.equal(evs.length, 2);
  // 엔진이 동기로 던져도 reject 통로로
  const run2 = ui.createSearchRun({ searchDoc: () => { throw new Error('sync'); }, searchLibrary: () => { throw new Error('sync'); }, draw: (ev) => evs.push(ev) });
  await run2.doc('D', 'abc');
  await run2.library('abc');
  assert.deepEqual(evs.slice(2).map((e) => e.type), ['reject', 'reject']);
});

test('U6 ★ 서재 범위 — 책마다 결과(바꿔 씀) · 책별 백필 진행(docId) · 끝 · ERR_DB_* 는 그 책 결과에 적중과 함께 (carryover 4·5)', async () => {
  const eng = fakeEngine();
  const m = ui.newModel('library', 'zorvat');
  const run = ui.createSearchRun({ searchDoc: eng.searchDoc, searchLibrary: eng.searchLibrary, draw: (ev) => ui.applyEvent(m, ev) });
  const p = run.library('zorvat');
  const c = eng.calls[0];
  assert.equal(c.kind, 'lib');
  c.opts.onProgress({ docId: 'A', done: 50, total: 200 });
  c.opts.onProgress({ docId: 'B', done: 0, total: 80 });
  c.opts.onProgress({ docId: 'A', done: 100, total: 200 });
  assert.deepEqual([...m.progress.entries()], [['A', { done: 100, total: 200 }], ['B', { done: 0, total: 80 }]], '★ 책별 진행 — 안 연 책도 백필한다');
  c.opts.onPartial({ docId: 'A', hits: [H(1, 0, 'body')], pagesCovered: 200, pageCount: 200 });
  c.opts.onPartial({ docId: 'B', hits: [H(3, 0, 'body'), H(4, 0, 'table')], pagesCovered: 50, pageCount: 80, error: 'ERR_DB_QUOTA' });
  c.opts.onPartial({ docId: 'B', hits: [H(3, 0, 'body')], pagesCovered: 50, pageCount: 80, error: 'ERR_DB_QUOTA' });
  assert.equal(m.docs.get('B').hits.length, 1, '같은 책은 바꿔 쓴다');
  assert.equal(ui.outcomeOf(m.docs.get('B')).type, 'db', '★ 저장소가 찬 동안 — 결과(적중)와 저장소 안내 한 줄이 함께');
  c.resolve({ query: 'zorvat', docs: [m.docs.get('A'), m.docs.get('B')] });
  await p;
  assert.equal(m.final, true);
  assert.equal(m.docs.size, 2);
  // 검색어 오류(서재 범위) — 결과 묶음 없이 안내
  const m2 = ui.newModel('library', 'z');
  ui.applyEvent(m2, { type: 'done', result: { query: 'z', docs: [], error: SEARCH_ERR.SHORT } });
  assert.equal(m2.queryError, SEARCH_ERR.SHORT);
});

/* ══ U7 최근 검색 · 글자 체계 ═══════════════════════════════════ */

test('U7 최근 검색 — 맨 앞 · 대소문자만 다른 같은 말은 하나 · 최대 5 · 1자는 넣지 않음 · 입력 불변', () => {
  const base = ['MI', 'heart failure', 'sarcoidosis'];
  const snap = base.slice();
  assert.deepEqual(ui.recentWith(base, '  Heart   Failure ', 5), ['Heart Failure', 'MI', 'sarcoidosis']);
  assert.deepEqual(base, snap);
  assert.deepEqual(ui.recentWith(['a1', 'a2', 'a3', 'a4', 'a5'], 'a6', SEARCH.RECENT_MAX), ['a6', 'a1', 'a2', 'a3', 'a4']);
  assert.deepEqual(ui.recentWith(base, 'x', 5), base);
  assert.deepEqual(ui.recentWith(null, 'beta', 5), ['beta']);
  assert.equal(SEARCH.RECENT_MAX, 5);
});

test('U7 ★ 글자 체계 안내(17-8-9 가) — 아랍 문자 검색어 · 영어 원서 → 안내 / β 섞인 영어 · 같은 체계 → 없음', () => {
  assert.equal(ui.scriptMismatch('ساركويد', 'en'), true);
  assert.equal(ui.scriptMismatch('β-blocker', 'en'), false);
  assert.equal(ui.scriptMismatch('β', 'en'), false, '그리스 문자만은 셈하지 않는다');
  assert.equal(ui.scriptMismatch('metformin', 'en'), false);
  assert.equal(ui.scriptMismatch('fièvre', 'fr'), false);
  assert.equal(ui.scriptMismatch('당뇨', 'en'), true);
  assert.equal(ui.scriptMismatch('당뇨', 'ko'), false);
  assert.equal(ui.scriptMismatch('diabetes', 'ko'), true);
  assert.equal(ui.scriptMismatch('ساركويد MI', 'en'), false, '책 글자 체계가 하나라도 있으면 안내하지 않는다');
  assert.equal(ui.scriptMismatch('ساركويد', 'und'), false, '모르는 언어는 안내하지 않는다');
});

/* ══ U8 레지스트리 이름(V11) ═══════════════════════════════════ */

test('U8 ★ 검색 강조 이름 search-hit·search-cur — 낭독 하이라이트(medreader-current)와 서로 다르다 · CSS·칠하기가 그 이름을 쓴다 (V11)', () => {
  assert.equal(ui.HL_HIT, 'search-hit');
  assert.equal(ui.HL_CUR, 'search-cur');
  const rd = read('../js/ui/reader.js');
  const m = rd.match(/const HL_NAME = '([^']+)';/);
  assert.ok(m, '리더의 낭독 하이라이트 이름');
  assert.equal(new Set([m[1], ui.HL_HIT, ui.HL_CUR]).size, 3, '★ 레지스트리 이름 셋이 다르다 — 서로 지우지 않는다');
  const src = noComments(read('../js/ui/search.js'));
  assert.match(src, /charhl\.paintCharRanges\(HL_HIT, /);
  assert.match(src, /charhl\.paintCharRanges\(HL_CUR, /);
  assert.ok(!/paintCharRanges\(\s*'medreader-current'/.test(src));
  const css = read('../css/reader.css');
  assert.match(css, /::highlight\(search-hit\)/);
  assert.match(css, /::highlight\(search-cur\)/);
  // 리더의 쪽 그리기는 자기 이름만 지운다(검색 강조는 검색이 다시 칠한다)
  assert.match(rd, /function clearCharHighlight\(\) \{ charhl\.clearCharRanges\(HL_NAME\); \}/);
});

/* ══ U9 낭독 — pauseForJump · cue (V12) ═══════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1; const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null; let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key); now = pick.at; pick.fn();
      }
      now = target;
    }
  };
}
function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}
const ln = (id, text, hy) => ({ id, text, hyphen: hy || 'none' });
const S1 = 'Alpha opens the page.';
const S2 = 'Bravo has the zorvat word.';
const S3 = 'Charlie closes.';
const CITE = '[PMID: 31234567]';
function rig(pages, o) {
  const opt = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  let pg = 1;
  let turnWait = null;
  const view = {
    paras: () => pages[pg] || [],
    page: () => ({ page: pg, pageCount: Object.keys(pages).length }),
    goToPage: (n) => {
      if (opt.holdTurn) return new Promise((r) => { turnWait = () => { pg = n; r(true); }; });
      if (!pages[n]) return Promise.resolve(false); pg = n; return Promise.resolve(true);
    },
    show: () => true, highlight: (u) => { view.lit.push(u.src); return true; }, lit: [], markDone: () => { },
    lineOrder: () => (pages[pg] || []).flatMap((p) => p.lines.map((l) => l.id))
  };
  const sp = createSpeaker({
    synth, timers, makeUtterance: (text) => ({ text }), view, translation: null,
    requestWakeLock: () => Promise.resolve(null), readCitations: () => false
  });
  const queues = [];
  const states = [];
  sp.addEventListener('queue', (ev) => queues.push(ev.detail));
  sp.addEventListener('statechange', () => states.push(sp.getState()));
  sp.setDocLang('en-US');
  return { sp, synth, timers, view, queues, states, setPage: (n) => { pg = n; }, release: () => turnWait && turnWait() };
}
const PAGES = {
  1: [{ id: 'a', kind: 'body', lines: [ln('1:0', S1 + ' ' + S2.slice(0, 9)), ln('1:1', S2.slice(10) + ' ' + S3)] }],
  2: [{ id: 'b', kind: 'body', lines: [ln('2:0', 'Delta starts next page.')] }]
};

test('U9 ★ 낭독 중 결과로 → 먼저 멈춘다(pauseSpeakerForJump) · 쪽 넘김 대기 중에도 · 멈춘 뒤 늦게 풀린 쪽 넘김은 재생하지 않는다', async () => {
  const h = rig(PAGES);
  h.sp.play();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(pauseSpeakerForJump(h.sp), true, '★ 이 호출이 멈췄다 → search.paused 한 번');
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(pauseSpeakerForJump(h.sp), false, '이미 멈춤 — 안내 없음');
  assert.equal(pauseSpeakerForJump(null), false);
  // 쪽 넘김 대기(waiting-page)
  const w = rig(PAGES, { holdTurn: true });
  w.sp.play();
  w.synth.finish(); w.synth.finish(); w.synth.finish();
  await tick();
  assert.equal(w.sp.getState(), 'waiting-page');
  assert.equal(pauseSpeakerForJump(w.sp), true);
  assert.equal(w.sp.getState(), 'paused');
  const n = w.synth.utt.length;
  w.release();
  await tick(); await tick();
  assert.equal(w.sp.getState(), 'paused', '★ 세대가 올라 늦게 풀린 쪽 넘김이 스스로 물러난다');
  assert.equal(w.synth.utt.length, n, '발화 없음');
});

test('U9 ★ beginJump — pauseForJump 를 **이동보다 먼저**(V12: 빼면 스텁 speaker 가 speaking 으로 남는다) · 같은 쪽이면 이동 없음 · 띠 ‹ › 는 바꿔 쓰기', () => {
  const h = rig(PAGES);
  h.sp.play();
  const log = [];
  const env = (scr) => ({
    pauseForJump: () => { log.push('pause:' + h.sp.getState()); return pauseSpeakerForJump(h.sp); },
    screen: () => scr, clear: () => log.push('clear'), go: (x) => log.push('go ' + x), replace: (x) => log.push('replace ' + x)
  });
  const r = ui.beginJump(env({ visible: false, ready: true, docId: 'D', page: 1 }), { docId: 'D', pageNo: 7 }, false);
  assert.deepEqual(r, { paused: true, same: false });
  assert.equal(h.sp.getState(), 'paused', '★ 결과로 가기 전에 멈췄다');
  assert.deepEqual(log, ['pause:speaking', 'clear', 'go ' + readerHash('D', 7)], '★ 멈춤 → 지우기 → 이동 순서');
  log.length = 0;
  const same = ui.beginJump(env({ visible: true, ready: true, docId: 'D', page: 7 }), { docId: 'D', pageNo: 7 }, true);
  assert.deepEqual(same, { paused: false, same: true });
  assert.deepEqual(log, ['pause:paused'], '같은 쪽 — 이동 없음(렌더 없이 search-cur 만 옮긴다)');
  log.length = 0;
  ui.beginJump(env({ visible: true, ready: true, docId: 'D', page: 3 }), { docId: 'D', pageNo: 7 }, true);
  assert.deepEqual(log, ['pause:paused', 'clear', 'replace ' + readerHash('D', 7)], '띠 ‹ › — 히스토리를 쌓지 않는다(뒤로 한 번 = 결과 목록)');
});

test('U9 ★ cue — 적중 글자가 든 문장이 다음 [▶] 의 시작점 · 멈춘 채 · 다시 칠함 · queue 이벤트 없음(번역 요청 0) · 낭독 중이면 아무것도 안 함', () => {
  const h = rig(PAGES);
  h.sp.play();
  assert.equal(h.sp.getIndex(), 0);
  h.sp.pause();
  const q0 = h.queues.length;
  const st0 = h.states.length;
  // S2 의 "zorvat" — 줄 1:1 안 오프셋(두 번째 줄에 걸친 문장)
  const at = PAGES[1][0].lines[1].text.indexOf('zorvat');
  assert.equal(h.sp.cue('1:1', at), true);
  assert.equal(h.sp.getIndex(), 1, '★ 그 글자가 든 문장(Bravo …)');
  assert.equal(h.sp.getState(), 'paused', '멈춘 채');
  assert.equal(h.queues.length, q0, '★ queue 이벤트 없음 — 낭독 동반 번역이 움직이지 않는다');
  assert.equal(h.states.length, st0, '상태 이벤트 없음');
  assert.equal(h.view.lit[h.view.lit.length - 1], S2, '멈춘 자리 다시 칠함(view.highlight — 스크롤 없음)');
  h.sp.play();
  assert.equal(h.synth.texts().slice(-1)[0], S2, '★ [▶] 가 적중 문장부터');
  // 같은 줄의 앞 문장 글자 → 앞 문장
  h.sp.pause();
  assert.equal(h.sp.cue('1:0', 2), true);
  assert.equal(h.sp.getIndex(), 0);
  // ★ 한 줄에 두 문장 — 그 줄의 **뒤** 문장 글자면 뒤 문장(줄만 보면 앞 문장이 걸린다 — ranges 로 가른다)
  assert.equal(h.sp.cue('1:1', PAGES[1][0].lines[1].text.indexOf('Charlie')), true);
  assert.equal(h.sp.getIndex(), 2);
  // 낭독 중이면 거절
  h.sp.play();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.sp.cue('1:1', 0), false);
  // 처음 상태(idle)에서도 시작점을 둔다(큐를 지금 쪽으로 만든다) — 칠하지는 않는다
  const i = rig(PAGES);
  const lit = i.view.lit.length;
  assert.equal(i.sp.cue('1:1', at), true);
  assert.equal(i.sp.getState(), 'idle');
  assert.equal(i.view.lit.length, lit);
  i.sp.play();
  assert.equal(i.synth.texts()[0], S2);
});

test('U9 ★ cue — 인용 줄 적중(인용 거름) → 화면 순서로 그 뒤 첫 발화 · 그 뒤가 없으면 [▶] 가 다음 쪽부터', async () => {
  const pages = {
    1: [
      { id: 'a', kind: 'body', lines: [ln('1:0', S1)] },
      { id: 'c', kind: 'body', lines: [ln('1:1', CITE)] },
      { id: 'b', kind: 'body', lines: [ln('1:2', S3)] }
    ],
    2: [{ id: 'd', kind: 'body', lines: [ln('2:0', 'Delta starts next page.')] }]
  };
  const h = rig(pages);
  assert.equal(h.sp.cue('1:1', 3), true);
  h.sp.play();
  assert.equal(h.synth.texts()[0], S3, '★ 인용 뒤 첫 발화');
  const end = {
    1: [{ id: 'a', kind: 'body', lines: [ln('1:0', S1)] }, { id: 'c', kind: 'body', lines: [ln('1:1', CITE)] }],
    2: pages[2]
  };
  const e = rig(end);
  assert.equal(e.sp.cue('1:1', 0), true);
  e.sp.play();
  await tick(); await tick();
  assert.deepEqual(e.synth.texts(), ['Delta starts next page.'], '★ 쪽 끝 인용 — 다음 쪽부터(지금까지의 쪽 끝 경로)');
  // 다른 쪽 큐로 바뀌면(reload — 찾지 못함) 그 "쪽 끝 뒤" 표시는 버린다
  const f = rig(end);
  f.sp.cue('1:1', 0);
  f.setPage(2);
  f.sp.reload();
  f.sp.play();
  assert.deepEqual(f.synth.texts(), ['Delta starts next page.']);
  f.sp.stop();
  f.setPage(1);
  f.sp.play();
  assert.equal(f.synth.texts().slice(-1)[0], S1, 'stop 뒤에는 처음부터');
});

/* ══ U10 배선 · 계층 · 되돌림 · i18n ══════════════════════════════ */

test('U10 ★ 리더 배선 — initSearch 는 initControls 뒤(onPageRender 구독 순서) · 검색 화면으로는 숨기기만 · 숨은 채 쪽 넘김 · 다시 붙이면 onPageRepaint', () => {
  const src = noComments(read('../js/ui/reader.js'));
  const init = src.slice(src.indexOf('export function initReader('), src.indexOf('function onDocLang('));
  assert.ok(init.indexOf('initControls();') > 0 && init.indexOf('initControls();') < init.indexOf('initSearch();'), '★ controls 의 speaker.reload 구독 뒤에 검색이 구독한다');
  const lv = src.slice(src.indexOf('export function leaveReader('), src.indexOf('async function renderPage('));
  assert.ok(lv.indexOf('if (searchOverReader())') >= 0 && lv.indexOf('if (searchOverReader())') < lv.indexOf('leaveControls();'), '검색 화면으로 갈 때 낭독을 멈추지 않는다');
  assert.match(lv, /for \(const fn of leaveListeners\)/);
  const go = src.slice(src.indexOf('export function goToPageForSpeech('), src.indexOf('function turnHidden('));
  assert.match(go, /if \(state\.soft\) turnHidden\(target\);\s*else go\(readerHash\(state\.docId, target\)\);/);
  const rl = src.slice(src.indexOf('function relabelReader('), src.indexOf('function el(tag'));
  assert.match(rl, /notifyRepaint\('relabel'\)/);
  assert.match(src, /notifyRepaint\('reshown'\)/);
  const sh = src.slice(src.indexOf('export function showSpoken('), src.indexOf('function scrollToCurrent('));
  assert.match(sh, /!els\.root\.hidden\) scrollToCurrent\(false\)/, '숨은 리더는 창(검색 화면)을 굴리지 않는다');
  // controls — 검색이 쓰는 셋
  const c = noComments(read('../js/ui/controls.js'));
  assert.match(c, /export function pauseForJump\(\) \{ return pauseSpeakerForJump\(speaker\); \}/);
  assert.match(c, /export function cueAt\(lineId, start\)/);
  assert.match(c, /return speaker\.cue\(lineId, start\);/);
});

test('U10 ★ 되돌림(§9) SEARCH.ENABLED=false — [🔍]·[검색]·띠는 처음부터 숨김이고 스위치가 켜야 보인다 · 라우트는 서재로', () => {
  const html = read('../index.html');
  assert.match(html, /<button type="button" class="search-open" id="readerSearchBtn"[^>]*\bhidden\b/);
  assert.match(html, /<button type="button" id="librarySearchBtn"[^>]*data-nav="#\/search" hidden>/);
  assert.match(html, /<div class="search-band" id="searchBand"[^>]*hidden>/);
  assert.match(html, /<section class="screen search-screen" data-screen="search" hidden>/);
  const s = noComments(read('../js/ui/search.js'));
  assert.match(s, /if \(openBtn\) openBtn\.hidden = !SEARCH\.ENABLED;/);
  assert.match(s, /if \(!SEARCH\.ENABLED\) \{[^}]*els\.band\.hidden = true;[^}]*watchRoute\(\);\s*return;/);
  assert.match(s, /if \(!SEARCH\.ENABLED\) \{ replace\(libraryHash\(\)\); return; \}/);
  const lib = noComments(read('../js/ui/library.js'));
  assert.match(lib, /if \(searchBtn\) searchBtn\.hidden = !SEARCH\.ENABLED;/);
  assert.equal(SEARCH.ENABLED, true);
});

test('U10 ★ 13절 — search.js 는 innerHTML·console 을 쓰지 않는다 · 조각은 textContent + <mark> · 원서 조각 dir=ltr lang=문서 언어 · 검색어 되풀이는 <bdi>', () => {
  const s = noComments(read('../js/ui/search.js'));
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(s));
  assert.ok(!/\bconsole\s*\./.test(s));
  assert.match(s, /createElement\('mark'\)/);
  assert.match(s, /mk\.textContent = sn\.hit;/);
  assert.match(s, /sn\.setAttribute\('dir', 'ltr'\);/);
  assert.match(s, /sn\.setAttribute\('lang', docLang\(docId\)\);/);
  assert.match(s, /createElement\('bdi'\)/);
  // 3-2 — 엔진은 문구를 모르고, 화면은 엔진·outline·text/* 를 쓴다(pdf/ 는 쓰지 않는다)
  assert.ok(!/from '\.\.\/pdf\//.test(s));
});

test('U10 ★ i18n — 검색 키 34개가 네 언어에 같고(ar 먼저, 영어 복사 아님) · 자리표시자 같음 · 목차 탭 키(search.toc.*)는 8g-4b', () => {
  const keys = (l) => Object.keys(BUNDLES[l]).filter((k) => k.startsWith('search.')).sort();
  const en = keys('en');
  assert.equal(en.length, 34);
  for (const l of ['ar', 'fr', 'ko']) assert.deepEqual(keys(l), en, l);
  for (const k of en) assert.notEqual(BUNDLES.ar[k], BUNDLES.en[k], k);
  assert.ok(!en.some((k) => k.startsWith('search.toc.')));
  const ph = (v) => (v.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of en) for (const l of ['ar', 'fr', 'ko']) assert.equal(ph(BUNDLES[l][k]), ph(BUNDLES.en[k]), l + ' ' + k);
  assert.match(BUNDLES.ko['search.empty'], /\{q\}/);
  for (const k of ['common.reload', 'err.dbUpgraded']) for (const l of ['ar', 'en', 'fr', 'ko']) assert.ok(BUNDLES[l][k], l + ' ' + k);
});

test('U10 import map 표에 ui/search.js 가 있다', () => {
  assert.match(read('../index.html'), /"\.\/js\/ui\/search\.js": "\.\/js\/ui\/search\.js\?v=[0-9a-f]{10}"/);
});
