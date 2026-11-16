/* ============================================================
   tests/wordsheet-8f.test.mjs — 8f-2 단어 시트 (spec 17-7-6 3 · 4-2 · 4-3 "찾는 순서" · 4-5 · 6 · 7 · 8 "8f-2")

   - 순수 `pickSurface`(하이픈 결합·여러 줄·구두점) · `lookupWord`(★ 호출 0 먼저 — 단어장 → 문장 번역) · `sheetButtons` · `sheetEsc`
   - 흐름 `createSheetFlow` — 가짜 저장소/실제 저장소(fake-idb)·가짜/실제 파이프라인(흉내 Gemini):
     ★ 시트를 여는 것만으로는 요청 0 · [AI 로 번역] 1호출(같은 낱말·문맥 다시 → 0) · 실패 뒤 다시 누름 = retry
     · 문지기(키 없음·동의)·capped·offline → 요청 0 + 상태 한 줄 · 고친 항목의 [이 문맥으로 다시 번역]은 먼저 묻는다
     · 저장 origin(sentence·ai·user)·contextTr 사본 · 보내는 것은 낱말과 문장뿐(13절)
   - 서재 삭제 확인 "남습니다" 줄 — 한 함수(`deleteKeepLines`) · 배선
   - 선택 줄 [단어 번역] 켜기(`showAction` + `refresh`) · 스냅숏 `multi` · controls 배선 · Esc 층(시트가 가장 위)
   - 마크업·CSS·i18n 4언어·`innerHTML` 0·import 방향
   실제 키·실제 호출 없음.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { installFakeIdb } from './fixtures/fake-idb.mjs';
installFakeIdb();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.sessionStorage = globalThis.sessionStorage || memStorage();
globalThis.localStorage = globalThis.localStorage || memStorage();

const db = await import('../js/db.js');
const { createVocabStore } = await import('../js/vocab/store.js');
const W = await import('../js/ui/wordsheet.js');
const { pickSurface, lookupWord, sheetButtons, sheetEsc, createSheetFlow, WS_ACTIONS } = W;
const { SEL_ACTIONS, showAction, selBarModel } = await import('../js/ui/selbar.js');
const { deleteKeepLines, deleteKeepCounts, deleteConfirmText } = await import('../js/ui/library.js');
const { GATE_KEYS, BLOCKED_KEYS } = await import('../js/ui/trband.js');
const { createPipeline, STATES } = await import('../js/ai/pipeline.js');
const { createCache } = await import('../js/ai/cache.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');
const { FAKE_KEY, memDb, stubFetch, jsonRes, geminiOk, settingsOf, manualTimers } = await import('./fixtures/ai-stubs-8a.mjs');

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
/** 주석을 걷은 소스(정규식 배선 검사용). */
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }

const T0 = new Date(2026, 10, 16, 10, 0, 0).getTime();
const CTX = 'Patients with rheumatoid arthritis have morning stiffness.';
const AR = 'يعاني المرضى المصابون من التهاب المفاصل الروماتويدي (rheumatoid arthritis) من تيبس صباحي.';
const UNIT = { seg: 3, src: CTX, lang: 'en', paraId: 'p1' };

/** 시트 질의 하나 — 화면이 `openSnap` 에서 만드는 꼴. */
function Q(over) {
  return Object.assign({ surface: 'arthritis', srcLang: 'en', docLang: 'en', targetLang: 'ar', context: CTX, unit: UNIT,
    docId: 'docA', docTitle: 'Book A', pageNo: 40, lineId: '40:5', domain: 'medical' }, over || {});
}

/** 가짜 저장소 — 부른 기록을 남긴다. */
function fakeStore(entry) {
  const log = { find: 0, save: [], update: [] };
  let cur = entry || null;
  return {
    log,
    async findTerm() { log.find++; return cur; },
    async save(e) { log.save.push(e); cur = Object.assign({ id: 'vt:x', kind: 'term' }, e); return { entry: cur, created: true }; },
    async update(id, patch, o) { log.update.push({ id, patch, o }); cur = Object.assign({}, cur, patch, o && o.user ? { edited: true } : {}); return cur; }
  };
}

/** 가짜 파이프라인 단어 요청 — 결과를 차례로 돌려준다. */
function fakeTerms(results) {
  const calls = [];
  const queue = (results || []).slice();
  const fn = async (items, opts) => {
    calls.push({ items, opts });
    const r = queue.length ? queue.shift() : { state: 'ready', value: { translation: 'ترجمة', gloss: 'شرح', pos: 'noun', lemma: 'arthritis' } };
    return { status: 'ready', calls: r.state === 'ready' && !r.cached ? 1 : 0, results: [r] };
  };
  fn.calls = calls;
  return fn;
}

function spyTr(value) {
  const f = async () => { f.n++; return value; };
  f.n = 0;
  return f;
}

/* ── 실제 파이프라인 + 흉내 Gemini(단어 요청) ── */
function docOf(init) {
  const user = JSON.parse(init.body).contents[0].parts[0].text;
  return JSON.parse(user.slice(user.indexOf('<<<DOC\n') + 7, user.lastIndexOf('\n>>>')));
}
function echoTerms(tweak) {
  return (url, init) => {
    const items = docOf(init);
    const out = items.map((it) => (tweak ? tweak(it) : { i: it.i, term: it.term, lemma: it.term, pos: 'noun', translation: 'التهاب المفاصل', gloss: 'شرح قصير' }));
    return jsonRes(200, geminiOk(JSON.stringify({ items: out.filter(Boolean), notes: '' })));
  };
}
function rig(over) {
  const o = over || {};
  const mdb = memDb();
  const clock = { t: T0 };
  const net = { online: true };
  const timers = manualTimers();
  const fetch = o.fetch || stubFetch(echoTerms());
  const p = createPipeline({
    fetch: fetch, db: mdb, cache: createCache({ db: mdb, now: () => clock.t }),
    getKey: () => (o.key === undefined ? FAKE_KEY : o.key),
    getSetting: settingsOf(o.settings), now: () => clock.t, isOnline: () => net.online,
    setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  return { p, fetch, net, mdb };
}

let clockMs = T0;
const store = createVocabStore({ now: () => clockMs });

/* ══ 1. 순수 — 원어 꼴 · 찾는 순서 · 단추 · Esc ══════════════════ */

test('W1 pickSurface — 하이픈 결합(줄 끝 cardio- → 다음 줄 / 다음 줄 vascular → 앞 줄) · 여러 줄 선택 · 구두점·숨은 글자', () => {
  assert.equal(pickSurface({ lineText: 'The cardio', start: 5, end: 7, nextHead: 'vascular system' }), 'cardiovascular', '★ 줄 끝 조각을 골라도 결합된 꼴');
  assert.equal(pickSurface({ lineText: 'vascular disease is', start: 0, end: 3, prevTail: 'cardio' }), 'cardiovascular', '★ 다음 줄 조각을 골라도 결합된 꼴');
  assert.equal(pickSurface({ lineText: 'vascular disease is', start: 9, end: 12, prevTail: 'cardio' }), 'disease', '줄 첫머리가 아니면 잇지 않는다');
  assert.equal(pickSurface({ lineText: 'a word here', start: 3, end: 4, nextHead: null }), 'word');
  assert.equal(pickSurface({ lineText: 'see (arthritis), now', start: 7, end: 9 }), 'arthritis', '앞뒤 괄호·쉼표 걷음');
  assert.equal(pickSurface({ lineText: 'with Rheumatoid', start: 8, end: 15, multi: true, selText: 'umatoid\narthritis.' }), 'Rheumatoid arthritis', '★ 여러 줄 — 시작 낱말 앞쪽을 넓히고 줄바꿈은 공백 하나');
  assert.equal(pickSurface({ lineText: 'x', start: 0, end: 1, multi: true, selText: '­cardio​vascular ' }), 'cardiovascular', '숨은 하이픈·폭 없는 공백 제거');
  const seg = () => [{ index: 0, segment: 'The', isWordLike: true }, { index: 3, segment: ' ', isWordLike: false }, { index: 4, segment: 'heart', isWordLike: true }];
  assert.equal(pickSurface({ lineText: 'The heart', start: 5, end: 6, segFn: seg }), 'heart', '세그멘터 경계');
  assert.equal(pickSurface({}), '');
});

test('W2 ★ lookupWord — 호출 0 먼저: 단어장 → 문장 번역(메모리·캐시) → 없음. 단어장에 있으면 문장 번역을 보지도 않는다', async () => {
  const s1 = fakeStore({ id: 'vt:1', term: 'arthritis', translation: 'التهاب المفاصل' });
  const tr1 = spyTr(AR);
  const a = await lookupWord({ term: 'arthritis', surface: 'arthritis', targetLang: 'ar', unit: UNIT }, { store: s1, sentenceTr: tr1 });
  assert.equal(a.path, 'saved');
  assert.equal(tr1.n, 0, '★ 저장된 낱말이면 문장 번역도 읽지 않는다');
  const s2 = fakeStore(null);
  const b = await lookupWord({ term: 'arthritis', surface: 'arthritis', targetLang: 'ar', unit: UNIT }, { store: s2, sentenceTr: spyTr(AR) });
  assert.equal(b.path, 'sentence');
  assert.equal(b.hit.candidate, 'من التهاب المفاصل الروماتويدي', '후보(8f-1 findInSentenceTr 그대로 — 앞 낱말이 섞일 수 있다 · 시트가 칸에서 고친다)');
  assert.equal(b.sentenceTr, AR);
  assert.equal(s2.log.find, 1);
  const c = await lookupWord({ term: 'fever', surface: 'fever', targetLang: 'ar', unit: UNIT }, { store: fakeStore(null), sentenceTr: spyTr(AR) });
  assert.deepEqual([c.path, c.sentenceTr, c.hit], ['none', AR, null], '괄호에 없으면 none(문장 번역은 같이 보인다)');
  const d = await lookupWord({ term: 'fever', surface: 'fever', targetLang: 'ar', unit: null }, { store: fakeStore(null), sentenceTr: spyTr(null) });
  assert.deepEqual([d.path, d.sentenceTr], ['none', null]);
  const e = await lookupWord({ term: 'x', targetLang: 'ar' }, { store: { findTerm: async () => { throw new Error('idb'); } }, sentenceTr: async () => { throw new Error('c'); } });
  assert.equal(e.path, 'none', '읽기 실패는 던지지 않는다');
});

test('W3 sheetButtons · sheetEsc — 길마다 단추 · 질문 중·너무 김·같은 언어는 없음 · Esc 는 보일 때만', () => {
  assert.deepEqual(sheetButtons({ open: true, path: 'none' }), ['save', 'ai', 'saveBare']);
  assert.deepEqual(sheetButtons({ open: true, path: 'sentence' }), ['save', 'ai', 'saveBare']);
  assert.deepEqual(sheetButtons({ open: true, path: 'ai' }), ['save', 'ai', 'saveBare']);
  assert.deepEqual(sheetButtons({ open: true, path: 'saved', q: { context: 'A' }, entry: { context: 'A' } }), ['save', 'retranslate']);
  assert.deepEqual(sheetButtons({ open: true, path: 'saved', q: { context: 'B' }, entry: { context: 'A' } }), ['save', 'retranslate', 'useContext'], '문맥이 다르면 [문맥을 이 문장으로 바꾸기]');
  assert.deepEqual(sheetButtons({ open: true, path: 'saved', ask: true, q: {}, entry: {} }), []);
  assert.deepEqual(sheetButtons({ open: true, path: null }), [], '찾는 중');
  assert.deepEqual(sheetButtons({ open: true, path: 'none', tooLong: true }), []);
  assert.deepEqual(sheetButtons({ open: true, path: 'none', sameLang: true }), []);
  assert.deepEqual(sheetButtons({ open: false, path: 'none' }), []);
  for (const id of ['save', 'ai', 'saveBare', 'retranslate', 'useContext']) assert.ok(WS_ACTIONS.includes(id));
  assert.equal(sheetEsc({ open: true, shown: true }), true);
  assert.equal(sheetEsc({ open: true, shown: false }), false, '숨은 리더(검색 화면) — 검색의 Esc 를 막지 않는다');
  assert.equal(sheetEsc({ open: true, prevented: true }), false);
  assert.equal(sheetEsc({ open: true, composing: true }), false, '입력기 조합 중');
  assert.equal(sheetEsc({ open: false }), false);
});

/* ══ 2. 흐름 — 여는 것은 호출 0 ═══════════════════════════════ */

test('W4 ★ 여는 것만으로는 요청 0 — 단어장·문장 번역·없음 세 길 모두 translateTerms 0회 · 후보를 칸에 미리 채움 · 안내 한 줄 길', async () => {
  for (const [entry, tr, path, note] of [
    [{ id: 'vt:1', term: 'arthritis', translation: 'التهاب', context: CTX }, AR, 'saved', 'vs.found.saved'],
    [null, AR, 'sentence', 'vs.found.sentence'],
    [null, null, 'none', 'vs.found.none']
  ]) {
    const tt = fakeTerms();
    const f = createSheetFlow({ store: fakeStore(entry), translateTerms: tt, sentenceTr: spyTr(tr), gate: () => ({ ok: true }) });
    const v = await f.open(Q());
    assert.equal(tt.calls.length, 0, '★ ' + path + ' — 시트를 열어도 요청 0');
    assert.equal(v.path, path);
    assert.equal(v.note.key, note);
    assert.equal(v.busy, false);
    if (path === 'sentence') {
      assert.equal(v.draft.translation, 'من التهاب المفاصل الروماتويدي', '후보가 번역 칸에');
      assert.deepEqual(v.hit.at, [AR.indexOf('من التهاب'), AR.indexOf(')') + 1], '밑줄 = 후보 시작 ~ 괄호 끝');
      assert.equal(v.contextTr, AR);
    }
    if (path === 'saved') assert.deepEqual(v.buttons, ['save', 'retranslate']);
    else assert.deepEqual(v.buttons, ['save', 'ai', 'saveBare']);
  }
});

test('W5 저장 — 문장 번역 후보 그대로 → origin sentence·contextTr 사본·edited false / 고쳐서 → edited true / 번역 없이 → origin user·번역 빈 채 (실제 저장소·fake-idb)', async () => {
  const f = createSheetFlow({ store: store, translateTerms: fakeTerms(), sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  await f.open(Q({ surface: 'Arthritis' }));
  const v = await f.save(null);
  assert.equal(v.path, 'saved');
  assert.equal(v.note.key, 'vs.saved');
  const rec = await store.findTerm('arthritis', 'ar');
  assert.equal(rec.kind, 'term');
  assert.equal(rec.origin, 'sentence');
  assert.equal(rec.translation, 'من التهاب المفاصل الروماتويدي');
  assert.equal(rec.contextTr, AR, '★ 문장 번역 사본');
  assert.equal(rec.context, CTX);
  assert.equal(rec.surface, 'Arthritis');
  assert.equal(rec.docId, 'docA'); assert.equal(rec.pageNo, 40); assert.equal(rec.lineId, '40:5');
  assert.equal(rec.edited, false);
  // 다시 열면 저장된 것 — 새 항목 0
  const f2 = createSheetFlow({ store: store, translateTerms: fakeTerms(), sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  const v2 = await f2.open(Q({ surface: 'arthritis' }));
  assert.equal(v2.path, 'saved');
  assert.equal(v2.entry.id, rec.id);
  assert.equal((await store.list({ docId: 'docA' })).filter((e) => e.term === 'arthritis').length, 1, '새 항목 0');
  // 후보를 고쳐 저장 → edited
  const f3 = createSheetFlow({ store: store, translateTerms: fakeTerms(), sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  await f3.open(Q({ surface: 'rheumatoid arthritis' }));
  await f3.save('التهاب المفاصل الروماتويدي');
  const r3 = await store.findTerm('rheumatoid arthritis', 'ar');
  assert.equal(r3.origin, 'sentence'); assert.equal(r3.edited, true); assert.equal(r3.translation, 'التهاب المفاصل الروماتويدي');
  // 번역 없이 저장
  const f4 = createSheetFlow({ store: store, translateTerms: fakeTerms(), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f4.open(Q({ surface: 'stiffness' }));
  await f4.save('무시되는 글', { bare: true });
  const r4 = await store.findTerm('stiffness', 'ar');
  assert.equal(r4.translation, ''); assert.equal(r4.origin, 'user'); assert.equal(r4.edited, false);
});

/* ══ 3. [AI 로 번역] — 실제 파이프라인 + 흉내 Gemini ═══════════ */

test('W6 ★ [AI 로 번역] 정확히 1호출 → 번역·뜻·품사 · 저장 origin ai · 같은 낱말 + 같은 문맥 다시 → 0호출(캐시) · 보내는 것은 낱말과 문장뿐', async () => {
  const { p, fetch } = rig();
  const s = fakeStore(null);
  const f = createSheetFlow({ store: s, translateTerms: (i, o) => p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f.open(Q({ surface: 'Stiffness' }));
  assert.equal(fetch.calls.length, 0);
  const v = await f.ai();
  assert.equal(fetch.calls.length, 1, '★ 정확히 1');
  assert.equal(v.path, 'ai');
  assert.equal(v.note.key, 'vs.found.ai');
  assert.deepEqual(v.draft, { translation: 'التهاب المفاصل', gloss: 'شرح قصير', pos: 'noun', lemma: 'Stiffness' }, '흉내 응답은 요청 term(본문 꼴)을 기본형으로 돌려준다');
  const doc = docOf(fetch.calls[0].init);
  assert.deepEqual(doc, [{ i: 0, term: 'Stiffness', context: CTX }], '낱말(본문 꼴)·문장뿐');
  await f.save('MY_TYPED_FIX');
  assert.equal(s.log.save[0].origin, 'ai');
  assert.equal(s.log.save[0].edited, true, 'AI 답을 고쳐 저장');
  assert.equal(s.log.save[0].gloss, 'شرح قصير');
  // 같은 낱말 + 같은 문맥 — 새 시트(저장 안 된 상태)에서 다시 → 캐시 0호출
  const f2 = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f2.open(Q({ surface: 'stiffness' }));
  const v2 = await f2.ai();
  assert.equal(fetch.calls.length, 1, '★ 같은 낱말·같은 문맥 → 0호출');
  assert.equal(v2.draft.translation, 'التهاب المفاصل');
  // 다른 문맥 → 1호출
  const f3 = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f3.open(Q({ surface: 'stiffness', context: 'Joint stiffness improves with activity.' }));
  await f3.ai();
  assert.equal(fetch.calls.length, 2);
  // 사용자 글(고친 번역·메모)은 본문에 없다
  for (const c of fetch.calls) assert.ok(!/MY_TYPED_FIX/.test(c.init.body));
});

test('W7 ★ 실패한 단어를 다시 누르면 다시 보낸다(늘 retry:true — 8f1R-8 #5) · 빈 번역 → vs.failed', async () => {
  let n = 0;
  const { p, fetch } = rig({ fetch: stubFetch(echoTerms((it) => { n++; return { i: it.i, term: it.term, translation: n === 1 ? '' : 'ترجمة', gloss: '' }; })) });
  const f = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f.open(Q({ surface: 'nodule' }));
  const v1 = await f.ai();
  assert.equal(fetch.calls.length, 1);
  assert.equal(v1.note.key, 'vs.failed');
  assert.deepEqual(v1.buttons, ['save', 'ai', 'saveBare'], '실패해도 다시 누를 수 있다');
  const v2 = await f.ai();
  assert.equal(fetch.calls.length, 2, '★ 다시 누름 → 다시 보냄(retry 없으면 실패 기억이 0호출로 막는다)');
  assert.equal(v2.draft.translation, 'ترجمة');
  const tt = fakeTerms();
  const g = createSheetFlow({ store: fakeStore(null), translateTerms: tt, sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await g.open(Q());
  await g.ai();
  assert.equal(tt.calls[0].opts.retry, true);
  assert.equal(tt.calls[0].opts.force, false);
  assert.deepEqual(tt.calls[0].opts, { src: 'en', target: 'ar', docId: 'docA', domain: 'medical', retry: true, force: false });
  assert.deepEqual(tt.calls[0].items, [{ term: 'arthritis', surface: 'arthritis', context: CTX, src: 'en' }]);
});

test('W8 ★ 막힘 — 키 없음·동의 없음(문지기) → 요청 0 + 띠와 같은 한 줄 + 배너 사유 / capped·offline(원격) → 요청 0 + 상태 한 줄', async () => {
  for (const reason of ['no-key', 'consent', 'unsupported-lang']) {
    const tt = fakeTerms();
    const f = createSheetFlow({ store: fakeStore(null), translateTerms: tt, sentenceTr: spyTr(null), gate: () => ({ ok: false, reason }) });
    await f.open(Q());
    const v = await f.ai();
    assert.equal(tt.calls.length, 0, reason);
    assert.equal(v.note.key, GATE_KEYS[reason]);
    assert.equal(v.banner, reason);
  }
  // 문서 단위 same-lang 은 시트가 쓰지 않는다(낱말 언어는 open 이 본다)
  const tt = fakeTerms();
  const f = createSheetFlow({ store: fakeStore(null), translateTerms: tt, sentenceTr: spyTr(null), gate: () => ({ ok: false, reason: 'same-lang' }) });
  await f.open(Q());
  await f.ai();
  assert.equal(tt.calls.length, 1);
  // capped
  const a = rig({ settings: { 'ai.dailyCap': 1 } });
  await a.p.translateTerms([{ term: 'x', context: 'X y.' }], { src: 'en', target: 'ar', docId: 'd' });
  assert.equal(a.fetch.calls.length, 1);
  const fa = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => a.p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await fa.open(Q({ surface: 'edema' }));
  const va = await fa.ai();
  assert.equal(a.fetch.calls.length, 1, '★ capped → 요청 0');
  assert.equal(va.note.key, BLOCKED_KEYS.capped);
  // offline
  const b = rig();
  b.net.online = false;
  const fb = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => b.p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await fb.open(Q({ surface: 'edema' }));
  const vb = await fb.ai();
  assert.equal(b.fetch.calls.length, 0, '★ offline → 요청 0');
  assert.equal(vb.note.key, BLOCKED_KEYS.offline);
  // 키 없음(파이프라인이 막음 — 문지기가 통과시켰어도)
  const c = rig({ key: '' });
  const fc = createSheetFlow({ store: fakeStore(null), translateTerms: (i, o) => c.p.translateTerms(i, o), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await fc.open(Q({ surface: 'edema' }));
  const vc = await fc.ai();
  assert.equal(c.fetch.calls.length, 0);
  assert.equal(vc.note.key, BLOCKED_KEYS[STATES.NO_KEY]);
});

test('W9 ★ 고친 항목의 [이 문맥으로 다시 번역] → 먼저 묻는다(요청 0) · 그대로 두기 → 0 · 바꾸기 → force 1호출·항목 갱신 / 안 고친 항목은 바로', async () => {
  const edited = { id: 'vt:e', kind: 'term', term: 'arthritis', translation: 'MY_FIXED', edited: true, context: CTX, note: 'MY_NOTE' };
  const s = fakeStore(edited);
  const tt = fakeTerms();
  const f = createSheetFlow({ store: s, translateTerms: tt, sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  await f.open(Q());
  const a = await f.retranslate();
  assert.equal(a.ask, true);
  assert.equal(a.note.key, 'vs.overwriteAsk');
  assert.deepEqual(a.buttons, [], '질문 중엔 질문 단추만');
  assert.equal(tt.calls.length, 0, '★ 묻기 전에는 요청 0');
  const b = f.cancelAsk();
  assert.equal(b.ask, false);
  assert.equal(tt.calls.length, 0);
  await f.retranslate();
  const c = await f.confirmAsk();
  assert.equal(tt.calls.length, 1);
  assert.equal(tt.calls[0].opts.force, true, '★ 캐시를 건너뛰고 새로(7-5 다시 생성)');
  assert.equal(c.note.key, 'vs.found.ai');
  assert.equal(s.log.update.length, 1);
  assert.equal(s.log.update[0].patch.translation, 'ترجمة');
  assert.equal(s.log.update[0].patch.origin, 'ai');
  assert.equal(s.log.update[0].patch.contextTr, AR, '이 문장 번역(호출 0)');
  assert.deepEqual(s.log.update[0].o, { user: false }, '사용자 수정이 아니다');
  assert.deepEqual(tt.calls[0].items, [{ term: 'arthritis', surface: 'arthritis', context: CTX, src: 'en' }], '고친 번역·메모는 항목에 없다(13절)');
  // 안 고친 항목은 묻지 않는다
  const t2 = fakeTerms();
  const f2 = createSheetFlow({ store: fakeStore(Object.assign({}, edited, { edited: false })), translateTerms: t2, sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  await f2.open(Q());
  const d = await f2.retranslate();
  assert.equal(t2.calls.length, 1);
  assert.equal(d.ask, false);
});

test('W10 단어장 낱말 — [저장] 은 고친 번역만 update(user) → edited · [문맥을 이 문장으로 바꾸기] 호출 0·edited 안 세움', async () => {
  clockMs = T0 + 1000;
  const f = createSheetFlow({ store: store, translateTerms: fakeTerms(), sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
  await f.open(Q({ surface: 'Arthritis' }));
  clockMs = T0 + 2000;
  const v = await f.save('ترجمتي');
  assert.equal(v.note.key, 'vs.saved');
  const r = await store.findTerm('arthritis', 'ar');
  assert.equal(r.translation, 'ترجمتي');
  assert.equal(r.edited, true, '★ 사용자 수정');
  assert.equal(r.updatedAt, T0 + 2000);
  // 다른 문장에서 연 같은 낱말 → [문맥을 이 문장으로 바꾸기]
  const tt = fakeTerms();
  const OTHER = 'Septic arthritis needs drainage.';
  const g = createSheetFlow({ store: store, translateTerms: tt, sentenceTr: spyTr('ترجمة جملة أخرى'), gate: () => ({ ok: true }) });
  const o = await g.open(Q({ surface: 'arthritis', context: OTHER, lineId: '41:2', pageNo: 41 }));
  assert.deepEqual(o.buttons, ['save', 'retranslate', 'useContext']);
  const u = await g.useContext();
  assert.equal(tt.calls.length, 0, '호출 0');
  assert.equal(u.note.key, 'vs.saved');
  const r2 = await store.findTerm('arthritis', 'ar');
  assert.equal(r2.context, OTHER); assert.equal(r2.contextTr, 'ترجمة جملة أخرى'); assert.equal(r2.pageNo, 41); assert.equal(r2.lineId, '41:2');
  assert.equal(r2.translation, 'ترجمتي', '번역은 그대로');
});

test('W11 너무 김·빈 낱말·같은 언어 → 상태 한 줄만(단추 0) · AI·저장 눌러도 0', async () => {
  for (const [q, key] of [
    [Q({ surface: 'one two three four five six seven' }), 'vs.tooLong'],
    [Q({ surface: 'x'.repeat(61) }), 'vs.tooLong'],
    [Q({ surface: '()…' }), 'vs.tooLong'],
    [Q({ srcLang: 'ar' }), 'vs.sameLang']
  ]) {
    const tt = fakeTerms();
    const s = fakeStore(null);
    const f = createSheetFlow({ store: s, translateTerms: tt, sentenceTr: spyTr(AR), gate: () => ({ ok: true }) });
    const v = await f.open(q);
    assert.equal(v.note.key, key);
    assert.deepEqual(v.buttons, []);
    await f.ai(); await f.save('x'); await f.save(null, { bare: true });
    assert.equal(tt.calls.length + s.log.save.length + s.log.find, 0, key + ' — 찾기·요청·저장 0');
  }
  const ok = createSheetFlow({ store: fakeStore(null), translateTerms: fakeTerms(), sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  assert.equal((await ok.open(Q({ surface: 'a b c d e f' }))).tooLong, false, '6낱말은 된다');
});

test('W12 닫기 — 늦게 온 결과를 버린다(다른 낱말 시트를 덮지 않음)', async () => {
  let release;
  const slow = async () => { await new Promise((r) => { release = r; }); return { status: 'ready', calls: 1, results: [{ state: 'ready', value: { translation: 'LATE', gloss: '', pos: '', lemma: '' } }] }; };
  const f = createSheetFlow({ store: fakeStore(null), translateTerms: slow, sentenceTr: spyTr(null), gate: () => ({ ok: true }) });
  await f.open(Q());
  const p = f.ai();
  await new Promise((r) => setImmediate(r));
  await f.open(Q({ surface: 'fever' }));
  release();
  await p;
  assert.notEqual(f.view().draft.translation, 'LATE');
  assert.equal(f.view().q.surface, 'fever');
  f.close();
  assert.equal(f.view().open, false);
});

/* ══ 4. 서재 삭제 확인 — "남습니다" 한 함수 ═══════════════════ */

test('W13 ★ deleteKeepLines — 단어장 n>0 이면 한 줄(0 이면 없음) · deleteKeepCounts(읽기만) · 확인 문장 · 배선 · 지운 뒤 term 남음(fake-idb)', async () => {
  assert.deepEqual(deleteKeepLines({ vocab: 3 }), [{ key: 'library.card.deleteConfirmVocab', params: { n: 3 } }]);
  assert.deepEqual(deleteKeepLines({ vocab: 0 }), []);
  assert.deepEqual(deleteKeepLines({}), []);
  assert.deepEqual(deleteKeepLines(null), []);
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => 2 } }), { vocab: 2 });
  assert.deepEqual(await deleteKeepCounts('d', { vocab: { countByDoc: async () => { throw new Error('x'); } } }), { vocab: 0 }, '못 읽어도 확인은 뜬다');
  const tr = (k, p) => k + (p ? JSON.stringify(p) : '');
  assert.equal(deleteConfirmText('T', deleteKeepLines({ vocab: 2 }), tr), 'library.card.deleteConfirm{"title":"T"}\nlibrary.card.deleteConfirmVocab{"n":"2"}');
  assert.equal(deleteConfirmText('T', [], tr), 'library.card.deleteConfirm{"title":"T"}');
  const lib = strip(src('../js/ui/library.js'));
  assert.match(lib, /if \(!confirm\(deleteConfirmText\(name, deleteKeepLines\(await deleteKeepCounts\(docId\)\)\)\)\) return;/, '★ 삭제 확인이 한 함수를 거친다');
  assert.equal((lib.match(/confirm\(/g) || []).length, 1, '확인 대화는 한 곳');
  // 실제 저장소 — 단어장 2 + 문장 카드 1 → 문서 삭제 → term 2 남음
  await store.save({ surface: 'gout', srcLang: 'en', targetLang: 'ar', docId: 'docDel' });
  await store.save({ surface: 'tophus', srcLang: 'en', targetLang: 'ar', docId: 'docDel' });
  await db.put('cards', { id: 'sc1', kind: 'sentence', docId: 'docDel' });
  assert.deepEqual(await deleteKeepCounts('docDel'), { vocab: 2 });
  await db.deleteDocument('docDel');
  assert.equal((await store.list({ docId: 'docDel' })).length, 2, '단어장은 남는다');
  assert.equal(await db.get('cards', 'sc1'), undefined, '문장 카드는 지워진다');
});

/* ══ 5. 선택 줄 · controls 배선 · Esc 층 ═════════════════════ */

test('W14 선택 줄 [단어 번역] 켜기 — 기본 목록은 그대로(hidden) · showAction 사본 · 스냅숏 multi · controls 가 시트가 있을 때만 refresh', () => {
  assert.equal(SEL_ACTIONS[0].hidden, true, '기본 목록은 8c-1 그대로');
  const on = showAction(SEL_ACTIONS, 'word');
  // `[18]` `lookup`([찾아보기])은 `hidden` 이 아니라 `when:'links'` — 보이기는 selBarModel 의 ctx(`{q}` 링크 수)가 정한다.
  // `[11-2 — 11-D3]` [요약]이 더해졌다(`[⋯]` 안) — 목록이 다섯 칸.
  assert.deepEqual(on.map((a) => [a.id, !!a.hidden]), [['word', false], ['sentence', false], ['summary', false], ['readFrom', false], ['lookup', false]]);
  assert.equal(SEL_ACTIONS[0].hidden, true, '원본을 바꾸지 않는다');
  assert.ok(Object.isFrozen(on) && Object.isFrozen(on[0]));
  assert.deepEqual(selBarModel(on, { text: 'arthritis' }).map((m) => [m.id, m.hidden, m.disabled]), [['word', false, false], ['sentence', false, false], ['summary', false, false], ['readFrom', false, false], ['lookup', true, false]]);
  assert.equal(selBarModel(on, { text: 'a b c d e f g' })[0].disabled, true, '6낱말 넘으면 흐림(8c-1 그대로)');
  const sb = strip(src('../js/ui/selbar.js'));
  assert.match(sb, /multi: endLine !== line \};/, '스냅숏 — 선택이 다음 줄까지 걸쳤나');
  const c = strip(src('../js/ui/controls.js'));
  assert.match(c, /if \(wordsheet && selbar\) selbar\.refresh\(showAction\(SEL_ACTIONS, 'word'\)\);/, '★ 시트가 준비됐을 때만 켠다');
  assert.match(c, /\} else if \(id === 'word'\) \{\s*if \(wordsheet\) wordsheet\.open\(snap\);\s*\}/);
  assert.match(c, /if \(wordsheet\) wordsheet\.close\(false\);/, '리더를 떠나면 거둔다');
  assert.match(c, /units: function \(\) \{ syncReadalong\(\); return speaker\.sentenceUnits\(\); \}/, '탭 번역과 같은 문장 단위(분할 한 벌)');
  assert.match(c, /focusBack: function \(lineId\) \{ focusLine\(lineId, false\); \}/);
  assert.ok(c.indexOf('trband = initTrBand(') < c.indexOf('wordsheet = initWordSheet('), 'Esc 리스너 순서 — 띠가 먼저 등록(시트를 위층으로 보고 물러남)');
});

test('W15 ★ Esc 층 — 시트가 가장 위: 붙잡기 단계 리스너가 시트만 닫고 퍼지지 않음 · 띠는 role=dialog 를 위층으로 셈 · Tab 가둠 · 닫으면 포커스 되돌림', () => {
  const w = strip(src('../js/ui/wordsheet.js'));
  assert.match(w, /document\.addEventListener\('keydown', onKey, true\);/);
  const k = w.slice(w.indexOf('function onKey('), w.indexOf('function trapTab('));
  assert.match(k, /if \(!sheetEsc\(\{ open: true, shown: shown\(\), prevented: ev\.defaultPrevented, composing: !!ev\.isComposing \}\)\) return;\s*ev\.preventDefault\(\);\s*ev\.stopPropagation\(\);\s*closeSheet\(true\);/);
  assert.match(k, /if \(ev\.key === 'Tab' && els\.sheet\.contains\(ev\.target\)\) trapTab\(ev\);/);
  const sh = w.slice(w.indexOf('function shown('), w.indexOf('function onKey('));
  assert.match(sh, /const reader = els\.sheet\.closest\('\[data-screen="reader"\]'\);\s*if \(reader && reader\.hidden\) return false;/);
  const cl = w.slice(w.indexOf('function closeSheet('), w.indexOf('function shown('));
  assert.match(cl, /if \(back && line != null && typeof deps\.focusBack === 'function'\)/);
  const tb = strip(src('../js/ui/trband.js'));
  assert.match(tb, /dialog\[open\], \[role="dialog"\]:not\(\[hidden\]\)/, '띠는 보이는 role=dialog 가 있으면 Esc 를 넘긴다');
  const html = src('../index.html');
  assert.match(html, /<div class="word-sheet" id="wordSheet" role="dialog" aria-modal="false" aria-labelledby="wsTerm" hidden>/);
  // 처음 포커스는 원어 머리(자판이 저절로 뜨지 않게)
  assert.match(html, /<p class="ws-term" id="wsTerm" tabindex="-1" dir="ltr"><\/p>/);
  assert.match(w, /els\.term\.focus\(\{ preventScroll: true \}\)/);
});

/* ══ 6. 마크업 · CSS · i18n · 위생 ═══════════════════════════ */

test('W16 마크업·CSS — 단추 data-ws-action · 단어장 링크 숨김(8f-3) · 팝오버와 같은 높이 식 · 48px · 시트가 열리면 선택 줄 숨김 · 번역 칸 dir=대상 언어', () => {
  const html = src('../index.html');
  const sheet = html.slice(html.indexOf('id="wordSheet"'), html.indexOf('</div>\n\n    <!-- `[8e'));
  for (const id of WS_ACTIONS.concat(['askYes', 'askNo', 'close'])) assert.ok(sheet.includes('data-ws-action="' + id + '"'), id);
  assert.match(sheet, /<a class="ws-vocab" id="wsVocab" href="#\/vocab" data-i18n="vs\.vocabLink" hidden><\/a>/, '마크업만 — 8f-3 이 켠다');
  assert.match(sheet, /<input type="text" class="ws-input" id="wsTr"/);
  assert.ok(!/onclick|style=/.test(sheet));
  assert.match(html, /"\.\/js\/ui\/wordsheet\.js": "\.\/js\/ui\/wordsheet\.js\?v=[0-9a-f]{10}"/, 'import map 도장');
  const css = src('../css/reader.css');
  const ws = css.slice(css.indexOf('.word-sheet {'), css.indexOf('.word-sheet > .ws-close'));
  assert.match(ws, /inset-block-end: calc\(var\(--reader-chrome-bottom\) \+ var\(--sp-2\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(ws, /max-block-size: max\(calc\(var\(--tap\) \* 3\), calc\(100dvh - var\(--banners-h, 0px\) - var\(--bar-top\) - var\(--reader-chrome-bottom\) - var\(--sp-6\)\)\);/);
  assert.match(ws, /z-index: 36;/);
  assert.match(ws, /overflow-y: auto;/);
  assert.match(ws, /:root\[data-word-sheet="on"\] \.sel-bar,\s*:root\[data-word-sheet="on"\] \.back-to-line \{ display: none; \}/);
  assert.match(ws, /\.word-sheet \.ws-btn \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(ws, /\.word-sheet \.ws-input \{[\s\S]*?min-block-size: var\(--tap\);/);
  assert.match(css, /\.word-sheet > \.ws-close \{\s*position: sticky;/);
  assert.ok(!/\b(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/.test(ws), '논리 속성만(16-H)');
  const w = strip(src('../js/ui/wordsheet.js'));
  assert.match(w, /setLangDir\(els\.input, target\);/, '번역 칸 dir/lang = 대상 언어(ar → rtl)');
  assert.match(w, /mark\.className = 'vs-hit';/, '찾은 부분 밑줄 — 세 조각');
});

test('W17 i18n 4언어 같은 키(vs.* · 삭제 확인 줄) · 문구 키가 실제로 있다 · innerHTML 0 · import 방향 · 흐름은 DOM 을 모른다', () => {
  const keys = ['vs.translation', 'vs.gloss', 'vs.context', 'vs.found.saved', 'vs.found.sentence', 'vs.found.ai', 'vs.found.none',
    'vs.save', 'vs.ai', 'vs.saveBare', 'vs.retranslate', 'vs.useContext', 'vs.overwriteAsk', 'vs.overwriteYes', 'vs.overwriteNo',
    'vs.hint', 'vs.vocabLink', 'vs.sameLang', 'vs.tooLong', 'vs.saved', 'vs.failed', 'vs.saveFailed', 'library.card.deleteConfirmVocab'];
  for (const l of LANGS) for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
  for (const l of LANGS) assert.match(BUNDLES[l]['library.card.deleteConfirmVocab'], /\{n\}/);
  // 흐름이 내는 문구 키가 모두 번들에 있다
  const w = src('../js/ui/wordsheet.js');
  for (const m of w.matchAll(/key: '([a-zA-Z.]+)'/g)) assert.ok(BUNDLES.en[m[1]], '키 ' + m[1]);
  const ws = strip(w);
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(ws), 'innerHTML 0');
  assert.ok(!/onclick/.test(ws));
  assert.ok(!/from '\.\.\/tts\//.test(ws) && !/from '\.\/(controls|reader)\.js'/.test(ws), 'speaker·controls·reader 를 import 하지 않는다(주입)');
  assert.ok(!/\bfetch\(/.test(ws) && !/buildTermRequest|TERM_SCHEMA/.test(ws), '요청 꼴을 직접 만들지 않는다(pipeline.translateTerms 하나)');
  const flow = ws.slice(ws.indexOf('export function createSheetFlow('), ws.indexOf('let els = null;'));
  assert.ok(!/\b(document|window)\b/.test(flow), '흐름은 DOM 을 모른다');
  const pure = ws.slice(0, ws.indexOf('export function createSheetFlow('));
  assert.ok(!/\b(document|window)\b|Intl\.Segmenter/.test(pure.slice(pure.indexOf('export const WS_ACTIONS'))), '순수 부분');
});
