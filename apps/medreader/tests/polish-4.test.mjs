/* ============================================================
   tests/polish-4.test.mjs — 다듬기 4 (동작·안전: 화면 가림 · 확인 없는 지움 · 429 판정 · 캐시 · 백업 입력)

   Q1  CSS — 원본 보기 리더 규칙·요약 시트 링크가 `[hidden]` 을 이기지 않는다(`:not([hidden])`) · screens.css 임시 줄 없음
   Q2  [기본 목록으로 되돌리기] — 사용자 목록(배열)일 때만 페이지 안 확인(같은 `<dialog>` · 확인 단추 문구 바꿈) · confirm() 0 · 4언어 키
   Q3  서재 문서 삭제 — `deleteConfirmParts`(머리 · 지워집니다 · 남습니다)와 `deleteConfirmText` 한 벌 · 페이지 안 `<dialog>`(confirm() 0)
   Q4  429 판정 — 어댑터 `rateLimitInfo`(분·일·모름 · retryDelay) · 파이프라인: 분 → cooldown(RATE_MINUTE, until) · 시간이 지나도
       ready 로 안 돌아감(자동 재시도 0) · [다시 시도]만 · 일·모름·사본 없는 응답 → exhausted · 요청 1건 · 진짜 Response 로도
   Q5  띠·상태 바 — `bandView`·`noteView`·`tapView`·`remoteBanner` 의 분 한도 문구(기다림 중엔 [다시 시도] 없음) · 4언어 키
   Q6  `ui/links.js` `cssId` — `CSS.escape` 가 있으면 그것, 없으면 지금 방식(`"`·`\`)
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

const { createPipeline, STATES, SEG, RATE_MINUTE, RATE_MINUTE_DEFAULT_SEC, nextLocalMidnight, peekingFetch } = await import('../js/ai/pipeline.js');
const { createCache } = await import('../js/ai/cache.js');
const { gemini } = await import('../js/ai/adapters/gemini.js');
const { FAKE_KEY, memDb, stubFetch, jsonRes, geminiOk, echoTranslate, settingsOf, manualTimers } = await import('./fixtures/ai-stubs-8a.mjs');
const TB = await import('../js/ui/trband.js');
const LIB = await import('../js/ui/library.js');
const LK = await import('../js/ui/links.js');
const { BUNDLES, LANGS } = await import('../js/i18n/index.js');

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const cssBare = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '');

/* ══ Q1 CSS ═══════════════════════════════════════════ */

test('Q1 ★ CSS — 원본 보기 리더 규칙·요약 시트 링크의 display 가 [hidden] 을 이기지 않는다 · screens.css 임시 줄 없음', () => {
  const r = cssBare('../css/reader.css');
  // 원본 보기에서 리더를 flex 로 만드는 규칙 — 두 선택자 모두 `:not([hidden])`
  assert.match(r, /body:has\(\.original\) \.screen\[data-screen="reader"\]:not\(\[hidden\]\),\s*body\[data-reader-view="original"\] \.screen\[data-screen="reader"\]:not\(\[hidden\]\) \{\s*display: flex;/);
  // display 를 거는 `.screen[data-screen="reader"]` 규칙은 모두 `:not([hidden])` 를 단다(숨은 리더가 다른 화면을 가리지 않게)
  const rules = r.split('}').map((x) => x.split('{')).filter((x) => x.length === 2);
  for (const [sel, body] of rules) {
    if (!/display:\s*(?!none)/.test(body)) continue;
    for (const one of sel.split(',')) {
      const s = one.trim();
      if (/\.screen\[data-screen="reader"\]$/.test(s)) assert.fail('숨은 리더를 보이게 하는 규칙: ' + s);
    }
  }
  assert.match(r, /\.sum-sheet \.sum-link:not\(\[hidden\]\) \{\s*display: flex;/);
  assert.ok(!/\.sum-sheet \.sum-link \{/.test(r), '옛 규칙 없음');
  assert.ok(!/\.sum-sheet \.sum-link\[hidden\]/.test(cssBare('../css/screens.css')), 'screens.css 임시 줄 없음(reader.css 에서 바로 고침)');
});

/* ══ Q2 되돌리기 확인 ═════════════════════════════════ */

test('Q2 ★ [기본 목록으로 되돌리기] — 배열일 때만 페이지 안 확인 · 확인 단추 문구 · confirm() 0 · 4언어 키({n})', () => {
  const s = strip(read('../js/ui/links.js'));
  const fn = s.slice(s.indexOf('async function resetDefaults()'), s.indexOf('function focusAct('));
  assert.match(fn, /const stored = settings\.get\(LINKS_KEY\);\s*if \(Array\.isArray\(stored\)\) \{/);
  assert.match(fn, /await confirmIn\(t\('links\.reset\.confirm', \{ n: formatNumber\(stored\.length\) \}\), 'links\.reset'\)/);
  assert.ok(fn.indexOf('confirmIn(') < fn.indexOf('settings.set(LINKS_KEY, null)'), '확인 **뒤에** 지운다');
  assert.match(fn, /if \(!ok\) \{ focusAct\('reset'\); return; \}/, '취소 — 지우지 않고 [되돌리기]로 초점');
  assert.match(s, /function confirmIn\(title, okKey\) \{[\s\S]*?okBtn\.setAttribute\('data-i18n', okKey \|\| 'links\.delete'\);\s*applyTranslations\(dlg\);/, '삭제 확인은 그대로 [삭제]');
  assert.doesNotMatch(s, /\bconfirm\s*\(/);
  for (const l of LANGS) assert.match(BUNDLES[l]['links.reset.confirm'], /\{n\}/, l);
});

/* ══ Q3 서재 삭제 확인 ════════════════════════════════ */

test('Q3 ★ 서재 삭제 — 조각(머리·지워집니다·남습니다)과 한 줄 글이 한 벌 · 페이지 안 <dialog> · confirm() 0', () => {
  const tr = (k, p) => k + (p ? JSON.stringify(p) : '');
  const lines = LIB.deleteKeepLines({ vocab: 2, cards: 1, summaries: 3, notes: 4, ai: 5 });
  const p = LIB.deleteConfirmParts('Book', lines, tr);
  assert.equal(p.head, 'library.card.deleteConfirm{"title":"Book"}');
  assert.deepEqual(p.gone, ['library.card.deleteConfirmAi{"n":"5"}'], '지워지는 것 — 따로 줄');
  assert.ok(p.keeps.startsWith('library.card.deleteKeeps') && !p.keeps.includes('deleteConfirmAi'));
  assert.ok(['Vocab', 'Cards', 'Summaries', 'Notes'].every((k) => p.keeps.includes('deleteConfirm' + k)), '남는 것 넷 모두 한 줄');
  assert.equal(LIB.deleteConfirmText('Book', lines, tr), [p.head].concat(p.gone, [p.keeps]).join('\n'));
  const none = LIB.deleteConfirmParts('Book', [], tr);
  assert.deepEqual(none.gone, []);
  assert.equal(none.keeps, '');
  const s = strip(read('../js/ui/library.js'));
  assert.doesNotMatch(s, /\bconfirm\(/);
  const ask = s.slice(s.indexOf('function askDelete('), s.indexOf('function el('));
  assert.ok(ask.length > 200, 'askDelete 본문');
  assert.match(ask, /dlg\.showModal\(\)/);
  assert.match(ask, /const onCancel = \(ev\) => \{ ev\.preventDefault\(\); finish\(false\); \};/, 'Esc = 취소');
  assert.match(ask, /const cancel = dlg\.querySelector\('button\[data-dialog="cancel"\]'\);\s*if \(cancel\) cancel\.focus\(\);/, '첫 초점 [취소]');
  assert.match(s, /gone\.textContent = p\.gone\.join\('\\n'\);/);
  assert.match(s, /keeps\.textContent = p\.keeps;/);
  assert.match(s, /focusAfterDelete\(\);/, '지운 뒤 초점이 body 로 떨어지지 않게');
  assert.doesNotMatch(s, /innerHTML/);
});

/* ══ Q4 429 판정 ══════════════════════════════════════ */

const QF = (ids) => ({ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: ids.map((id) => ({ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: id })) });
const RI = (d) => ({ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: d });
const E429 = (details) => ({ error: { code: 429, message: 'quota (mock)', status: 'RESOURCE_EXHAUSTED', details: details } });
const MIN = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';
const DAY = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier';

test('Q4a 어댑터 rateLimitInfo — 분·일·모름 · 일이 하나라도 있으면 day · retryDelay 초(올림·범위)', () => {
  assert.deepEqual(gemini.rateLimitInfo(E429([QF([MIN]), RI('41s')])), { scope: 'minute', retrySec: 41 });
  assert.deepEqual(gemini.rateLimitInfo(E429([QF(['GenerateContentInputTokensPerModelPerMinute-FreeTier']), RI('7.2s')])), { scope: 'minute', retrySec: 8 });
  assert.deepEqual(gemini.rateLimitInfo(E429([QF([DAY])])), { scope: 'day', retrySec: null });
  assert.deepEqual(gemini.rateLimitInfo(E429([QF([MIN, DAY]), RI('30s')])), { scope: 'day', retrySec: 30 }, '보수 — 일 한도가 이긴다');
  assert.deepEqual(gemini.rateLimitInfo(E429([])), { scope: null, retrySec: null });
  assert.deepEqual(gemini.rateLimitInfo({ error: { code: 429, message: 'x' } }), { scope: null, retrySec: null });
  assert.deepEqual(gemini.rateLimitInfo(null), { scope: null, retrySec: null });
  assert.deepEqual(gemini.rateLimitInfo(E429([QF(['SomethingPerHour']), RI('soon')])), { scope: null, retrySec: null });
  assert.equal(gemini.rateLimitInfo(E429([QF([MIN]), RI('99999s')])).retrySec, null, '1시간 넘는 값은 믿지 않는다');
  assert.equal(gemini.rateLimitInfo(E429([{ '@type': 'type.googleapis.com/google.rpc.Help', violations: [{ quotaId: MIN }] }])).scope, null, '다른 @type 의 violations 는 보지 않는다');
});

const T0 = new Date(2026, 10, 18, 14, 0, 0).getTime();
const SENTS = ['Fever was noted in 3 of 10 patients.', 'The rash resolved within two weeks.'];
const T = { src: 'en', target: 'ar', kind: 'readalong', docId: 'doc1' };

/** 응답 사본(`clone`)이 있는 429 — 실물 Response 와 같은 꼴(스텁 jsonRes 는 사본이 없다 → 판정 "못 읽음"). */
function res429(body, headers) { const r = jsonRes(429, body, headers); r.clone = () => jsonRes(429, body, headers); return r; }

function rig(handler) {
  const db = memDb();
  const timers = manualTimers();
  const clock = { t: T0 };
  const fetch = stubFetch(handler);
  const p = createPipeline({
    fetch: fetch, db: db, cache: createCache({ db: db, now: () => clock.t }), getKey: () => FAKE_KEY, getSetting: settingsOf(),
    now: () => clock.t, isOnline: () => true, setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  const events = [];
  p.onState((e) => events.push(e));
  return { p, fetch, clock, timers, events };
}

test('Q4b ★ 분 한도 → cooldown(RATE_MINUTE · retryDelay) · 시간이 지나도 ready 로 안 감(자동 재시도 0) · [다시 시도]만 · 요청 1건', async () => {
  let n = 0;
  const echo = echoTranslate();
  const { p, fetch, clock, events } = rig((url, init, i) => (n++ === 0 ? res429(E429([QF([MIN]), RI('41s')])) : echo(url, init, i)));
  const r = await p.translate(SENTS, T);
  assert.deepEqual(r.results.map((x) => [x.state, x.code]), [[SEG.BLOCKED, STATES.COOLDOWN], [SEG.BLOCKED, STATES.COOLDOWN]]);
  assert.equal(p.state(), STATES.COOLDOWN);
  const ev = events.find((e) => e.state === STATES.COOLDOWN);
  assert.equal(ev.code, RATE_MINUTE);
  assert.equal(ev.until, T0 + 41000);
  assert.equal(fetch.calls.length, 1);
  // 기다림 끝 — 상태는 그대로(ready 로 돌아가면 낭독 창이 막힌 문장을 저절로 다시 보낸다)
  clock.t = T0 + 42000;
  assert.equal(p.state(), STATES.COOLDOWN, '★ 시간이 지나도 ready 아님');
  const again = await p.translate(SENTS, T);
  assert.ok(again.results.every((x) => x.state === SEG.BLOCKED), '보내지 않는다');
  assert.equal(fetch.calls.length, 1, '★ 자동 재시도 0');
  assert.equal(events.filter((e) => e.state === STATES.READY && e.prev === STATES.COOLDOWN).length, 0);
  // 사용자 [다시 시도]
  assert.equal(await p.retry(), STATES.READY);
  const ok = await p.translate(SENTS, T);
  assert.ok(ok.results.every((x) => x.state === SEG.READY));
  assert.equal(fetch.calls.length, 2);
});

test('Q4c 분 한도 기다림 — retryDelay 없으면 Retry-After, 그것도 없으면 60초 · 기다리는 중 [다시 시도]도 푼다', async () => {
  const a = rig(() => res429(E429([QF([MIN])]), { 'Retry-After': '5' }));
  await a.p.translate(SENTS, T);
  assert.equal(a.events.find((e) => e.state === STATES.COOLDOWN).until, T0 + 5000);
  const b = rig(() => res429(E429([QF([MIN])])));
  await b.p.translate(SENTS, T);
  assert.equal(b.events.find((e) => e.state === STATES.COOLDOWN).until, T0 + RATE_MINUTE_DEFAULT_SEC * 1000);
  assert.equal(RATE_MINUTE_DEFAULT_SEC, 60);
  assert.equal(await b.p.retry(), STATES.READY, '사용자 동작은 언제든');
});

test('Q4d ★ 일 한도·못 읽음·사본 없는 응답 → exhausted(보수 — 지금과 같음)', async () => {
  for (const [name, mk] of [
    ['day', () => res429(E429([QF([DAY]), RI('20s')]))],
    ['both', () => res429(E429([QF([MIN, DAY]), RI('20s')]))],
    ['unknown', () => res429(E429([]))],
    ['no-clone', () => jsonRes(429, E429([QF([MIN]), RI('20s')]))]
  ]) {
    const { p, fetch, events } = rig(mk);
    const r = await p.translate(SENTS, T);
    assert.equal(p.state(), STATES.EXHAUSTED, name);
    assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.EXHAUSTED), name);
    assert.equal(events.find((e) => e.state === STATES.EXHAUSTED).until, nextLocalMidnight(T0), name + ' — Retry-After 없으면 자정');
    assert.equal(fetch.calls.length, 1, name);
  }
});

test('Q4e 진짜 Response(429 본문 사본 `clone()`) — 판정 · 성공 응답은 들여다보지 않고 그대로', async () => {
  const body = JSON.stringify(E429([QF([MIN]), RI('12s')]));
  const { p, events } = rig(() => new Response(body, { status: 429, headers: { 'content-type': 'application/json' } }));
  await p.translate(SENTS, T);
  const ev = events.find((e) => e.state === STATES.COOLDOWN);
  assert.equal(ev.code, RATE_MINUTE);
  assert.equal(ev.until, T0 + 12000);
  // 성공 응답은 들여다보지 않는다(본문 그대로)
  const ok = rig(() => new Response(JSON.stringify(geminiOk(JSON.stringify({ segments: [{ i: 0, t: 'ترجمة 3 10' }, { i: 1, t: 'ترجمة أخرى للجملة' }] }))), { status: 200 }));
  await ok.p.translate(SENTS, T);
  assert.equal(ok.p.state(), STATES.READY);
  assert.equal(ok.fetch.calls.length, 1);
});

/* ══ Q5 띠·상태 바 문구 ═══════════════════════════════ */

test('Q5 ★ 분 한도 문구 — 기다리는 중 [다시 시도] 없음 · 끝나면 있음 · 다른 cooldown 은 그대로 · 상태 바 {s} · 4언어', () => {
  const rec = { state: 'blocked', code: 'cooldown' };
  const ctx = (rate) => ({ hasSentence: true, remote: 'cooldown', rate: rate });
  assert.deepEqual([TB.bandView(rec, ctx('wait')).noteKey, TB.bandView(rec, ctx('wait')).retry], ['readalong.blocked.rateWait', false]);
  assert.deepEqual([TB.bandView(rec, ctx('ready')).noteKey, TB.bandView(rec, ctx('ready')).retry], ['readalong.blocked.rateReady', true]);
  assert.deepEqual([TB.bandView(rec, ctx(null)).noteKey, TB.bandView(rec, ctx(null)).retry], ['readalong.blocked.cooldown', true], '응답 없음 cooldown 그대로');
  assert.equal(TB.bandView({ state: 'blocked', code: 'exhausted' }, ctx('wait')).noteKey, 'readalong.blocked.exhausted', 'cooldown 아닌 막힘은 상관없음');
  assert.equal(TB.bandView({ state: 'none' }, ctx('wait')).noteKey, 'readalong.blocked.rateWait', '아직 안 물은 문장도 원격 상태로');
  assert.equal(TB.noteView(rec, { remote: 'cooldown', rate: 'wait' }).retry, false);
  assert.equal(TB.tapView([rec], { remote: 'cooldown', rate: 'ready' }).noteKey, 'readalong.blocked.rateReady');
  assert.deepEqual(TB.remoteBanner('cooldown', { rate: 'wait', waitSec: '41' }), { key: 'ai.state.rateWait', params: { s: '41' }, actions: [] });
  assert.equal(TB.remoteBanner('cooldown', { rate: 'ready' }).key, 'ai.state.rateReady');
  assert.equal(TB.remoteBanner('cooldown', {}).key, 'ai.state.cooldown');
  // 모듈 기록 — 원격 이벤트에서
  TB.noteRemoteRate({ state: 'cooldown', code: TB.RATE_CODE, until: 5000 });
  assert.equal(TB.rateView(4000), 'wait');
  assert.equal(TB.rateView(5000), 'ready');
  TB.noteRemoteRate({ state: 'ready' });
  assert.equal(TB.rateView(4000), 'ready', '풀린 뒤 — 지나간 막힘 줄은 "기다림 끝" 그대로(응답 없음으로 바뀌지 않게)');
  TB.noteRemoteRate({ state: 'cooldown', code: 'NETWORK', until: 9000 });
  assert.equal(TB.rateView(4000), null, '다른 cooldown 은 분 한도 아님');
  TB.noteRemoteRate({ state: 'ready' });
  assert.equal(TB.rateView(), null, '분 한도가 없었으면 ready 뒤에도 없음');
  TB.noteRemoteRate({ state: 'cooldown', code: TB.RATE_CODE, until: 5000 });
  TB.noteRemoteRate({ state: 'exhausted', code: 'RATE_LIMIT' });
  assert.equal(TB.rateView(), null, '다른 막힘이 오면 지움');
  assert.equal(TB.RATE_CODE, RATE_MINUTE, '화면 상수 = 파이프라인 상수');
  for (const l of LANGS) {
    for (const k of ['readalong.blocked.rateWait', 'readalong.blocked.rateReady', 'ai.state.rateWait', 'ai.state.rateReady']) assert.ok(BUNDLES[l][k], l + '.' + k);
    assert.match(BUNDLES[l]['ai.state.rateWait'], /\{s\}/, l);
  }
});

/* ══ Q6 cssId ═════════════════════════════════════════ */

test('Q6 cssId — CSS.escape 가 있으면 그것(줄바꿈까지) · 없으면 따옴표·역슬래시만', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'CSS');
  const old = globalThis.CSS;
  try {
    delete globalThis.CSS;
    assert.equal(LK.cssId('a"b\\c'), 'a\\"b\\\\c');
    globalThis.CSS = { escape: (s) => 'ESC(' + s + ')' };
    assert.equal(LK.cssId('x\ny'), 'ESC(x\ny)');
  } finally {
    if (had) globalThis.CSS = old; else delete globalThis.CSS;
  }
});

/* ══ 다듬기 4b (P4R 중간-1 · 낮음-2 · 낮음-3) ═════════════════ */

test('Q7 ★ [4b 낮음-3] fillDeleteDialog — 지워집니다 줄은 있으면 보이고 없으면 숨김 · 남습니다도 · 연속 삭제에 앞 줄이 남지 않음', () => {
  const tr = (k, p) => k + (p ? JSON.stringify(p) : '');
  const n = { title: {}, gone: { hidden: true }, keeps: { hidden: true } };
  LIB.fillDeleteDialog(n, LIB.deleteConfirmParts('A', LIB.deleteKeepLines({ vocab: 2, ai: 3 }), tr));
  assert.equal(n.title.textContent, 'library.card.deleteConfirm{"title":"A"}');
  assert.equal(n.gone.hidden, false, '★ AI 문제가 있으면 "지워집니다" 줄이 보인다');
  assert.equal(n.gone.textContent, 'library.card.deleteConfirmAi{"n":"3"}');
  assert.equal(n.keeps.hidden, false);
  assert.ok(n.keeps.textContent.includes('deleteConfirmVocab'));
  // 다음 문서(AI 0 · 남는 것 0) — 앞 문서 줄이 남지 않는다
  LIB.fillDeleteDialog(n, LIB.deleteConfirmParts('B', LIB.deleteKeepLines({}), tr));
  assert.equal(n.gone.hidden, true);
  assert.equal(n.gone.textContent, '');
  assert.equal(n.keeps.hidden, true);
  assert.equal(n.keeps.textContent, '');
  assert.match(strip(read('../js/ui/library.js')), /fillDeleteDialog\(\{ title: dlg\.querySelector\('#docDelTitle'\), gone: dlg\.querySelector\('#docDelGone'\), keeps: dlg\.querySelector\('#docDelKeeps'\) \}, p\);/, 'askDelete 가 이 함수로 채운다');
});

test('Q8 ★ [4b 낮음-2] peekingFetch — 원본 응답 본문은 그대로(provider 몫) · 사본만 읽음 · 429 지역 문구는 REGION', async () => {
  const body = JSON.stringify(E429([QF([MIN]), RI('9s')]));
  const box = {};
  const res = await peekingFetch(async () => new Response(body, { status: 429 }), box)('u', {});
  assert.equal(res.bodyUsed, false, '★ 원본 본문을 먹지 않는다');
  assert.equal((await box.json).error.details[1].retryDelay, '9s', '사본으로 읽음');
  assert.equal((await res.json()).error.code, 429, 'provider 가 원본을 그대로 읽는다');
  // 200 은 들여다보지 않는다
  const box2 = {};
  const ok = await peekingFetch(async () => new Response('{}', { status: 200 }), box2)('u', {});
  assert.equal(box2.json, undefined);
  assert.equal(ok.bodyUsed, false);
  // 같은 인자 그대로 넘김
  let seen = null;
  const init = { method: 'POST', body: 'x' };
  await peekingFetch(async (u, i) => { seen = [u, i]; return new Response('{}', { status: 200 }); }, {})('url-1', init);
  assert.equal(seen[0], 'url-1');
  assert.equal(seen[1], init, '같은 init 객체');
  // 429 + 지역 문구 → REGION(provider 가 원본 본문의 메시지를 읽어야 가능 — HEAD 와 같음)
  const regionBody = JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'User location is not supported for the API use.', details: [QF([MIN])] } });
  const { p, events } = rig(() => new Response(regionBody, { status: 429 }));
  const r = await p.translate(SENTS, T);
  assert.equal(p.state(), STATES.REGION);
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.REGION));
  assert.ok(!events.some((e) => e.state === STATES.COOLDOWN), '분 한도로 읽지 않는다');
});

test('Q9 ★ [4b 중간-1] 화면을 떠나면 열린 확인 대화를 취소로 닫는다 — cancelDialog · 서재(hashchange) · 링크 · 메모 시트', () => {
  // cancelDialog — cancel 이벤트(Esc 와 같은 길)로 기다리던 물음을 false 로 끝내고, 듣는 이가 없으면 그냥 닫는다
  class FakeDlg extends EventTarget { constructor() { super(); this.open = true; this.closed = 0; } close() { this.open = false; this.closed++; } hasAttribute() { return this.open; } removeAttribute() { this.open = false; } }
  const a = new FakeDlg();
  let answered = null;
  a.addEventListener('cancel', (ev) => { assert.equal(ev.cancelable, true); ev.preventDefault(); answered = false; a.close(); });
  assert.equal(LIB.cancelDialog(a), true);
  assert.equal(answered, false, '★ 물음은 "아니오"로 끝난다(지우지 않음)');
  assert.equal(a.open, false);
  assert.equal(a.closed, 1, '두 번 닫지 않는다');
  const b = new FakeDlg();
  assert.equal(LIB.cancelDialog(b), true);
  assert.equal(b.open, false, '듣는 이가 없어도 닫힌다');
  const c = new FakeDlg(); c.open = false;
  assert.equal(LIB.cancelDialog(c), false, '닫힌 것은 그대로');
  assert.equal(LIB.cancelDialog(null), false);
  const lib = strip(read('../js/ui/library.js'));
  assert.match(lib, /window\.addEventListener\('hashchange', \(\) => \{ if \(parseRoute\(location\.hash\)\.name !== 'library'\) cancelLibraryDialogs\(\); \}\);/);
  assert.match(lib, /function cancelLibraryDialogs\(\) \{\s*cancelDialog\(document\.getElementById\(DEL_DIALOG_ID\)\);\s*cancelDialog\(document\.getElementById\('reextractDialog'\)\);/);
  // 링크 — close() 만 하면 기다리던 confirmIn 의 리스너가 남아 다음 대화의 [확인]이 옛 대상까지 실행했다
  const lk = strip(read('../js/ui/links.js'));
  const leave = lk.slice(lk.indexOf('export function leaveLinksSettings()'), lk.indexOf('function paintList('));
  assert.match(leave, /ed\.dlg\.dispatchEvent\(new Event\('cancel', \{ cancelable: true \}\)\)/);
  // 리더 — 메모 있는 필기 지우기 확인
  assert.match(strip(read('../js/ui/notesheet.js')), /onReaderLeave\(\(\) => \{ closeDel\(\); close\(false\);/);
});

/* ══ 다듬기 4c (P4bR 중간-1) — 링크 확인 대화: 설정 화면 안에서 옮겨도 취소 ═══════════ */

/** 아주 작은 가짜 DOM — links.js 가 쓰는 것만(태그·#id·.class·[attr="v"]·후손 선택자, 리스너, dialog). */
function miniDoc() {
  const doc = { activeElement: null };
  class N {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.nodeType = 1; this.childNodes = []; this.parentNode = null; this.attrs = new Map(); this.ls = {}; this._t = ''; this.hidden = false; this.disabled = false; this.type = ''; this.value = ''; this.style = {}; this.ownerDocument = doc; }
    get firstChild() { return this.childNodes[0] || null; }
    get children() { return this.childNodes; }
    appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
    removeChild(n) { this.childNodes.splice(this.childNodes.indexOf(n), 1); n.parentNode = null; return n; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    removeAttribute(k) { this.attrs.delete(k); }
    get id() { return this.getAttribute('id') || ''; }
    set id(v) { this.setAttribute('id', v); }
    get className() { return this.getAttribute('class') || ''; }
    set className(v) { this.setAttribute('class', v); }
    get classList() { const el = this; const l = () => el.className.split(/\s+/).filter(Boolean); return { add: (c) => { if (l().indexOf(c) < 0) el.className = l().concat(c).join(' '); }, contains: (c) => l().indexOf(c) >= 0 }; }
    get textContent() { return this._t + this.childNodes.map((c) => c.textContent).join(''); }
    set textContent(v) { this.childNodes = []; this._t = v == null ? '' : String(v); }
    set dir(v) { this.setAttribute('dir', v); }
    set tabIndex(v) { this.setAttribute('tabindex', v); }
    addEventListener(t, fn) { (this.ls[t] || (this.ls[t] = [])).push(fn); }
    removeEventListener(t, fn) { const a = this.ls[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
    dispatchEvent(ev) { for (const fn of (this.ls[ev.type] || []).slice()) fn(ev); return true; }
    focus() { doc.activeElement = this; }
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    matches(sel) { return match(this, sel); }
    closest(sel) { for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (match(x, sel)) return x; return null; }
    querySelectorAll(sel) { const out = []; const w = (n) => { for (const c of n.childNodes) { if (match(c, sel)) out.push(c); w(c); } }; w(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  const one = (el, s) => {
    const re = /^([a-z][a-z0-9]*)|#([A-Za-z0-9_-]+)|\.([A-Za-z0-9_-]+)|\[([a-z0-9_-]+)(?:="([^"]*)")?\]/gi;
    let x;
    while ((x = re.exec(s)) !== null) {
      if (x[1] && el.tagName !== x[1].toUpperCase()) return false;
      if (x[2] && el.getAttribute('id') !== x[2]) return false;
      if (x[3] && !el.classList.contains(x[3])) return false;
      if (x[4] && (!el.hasAttribute(x[4]) || (x[5] !== undefined && el.getAttribute(x[4]) !== x[5]))) return false;
    }
    return true;
  };
  function match(el, sel) {
    if (!el || el.nodeType !== 1) return false;
    if (sel.indexOf(',') >= 0) return sel.split(',').some((s) => match(el, s.trim()));
    const parts = sel.trim().split(/\s+/);
    if (!one(el, parts[parts.length - 1])) return false;
    let x = el.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) { while (x && !(x.nodeType === 1 && one(x, parts[i]))) x = x.parentNode; if (!x) return false; x = x.parentNode; }
    return true;
  }
  doc.createElement = (t) => new N(t);
  doc.body = new N('body');
  doc.documentElement = doc.body;
  doc.getElementById = (id) => doc.body.querySelector('#' + id);
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  const mk = (tag, id, parent, attrs) => { const e = new N(tag); if (id) e.setAttribute('id', id); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); parent.appendChild(e); return e; };
  const card = mk('div', 'settingsLinks', doc.body);
  mk('h2', null, card);
  mk('ul', 'linksEditList', card);
  mk('p', 'linksEditEmpty', card);
  const form = mk('div', 'linksForm', card); form.hidden = true;
  mk('input', 'linksName', form); mk('input', 'linksUrl', form); mk('p', 'linksErr', form);
  const sug = mk('div', 'linksSuggest', card); sug.hidden = true;
  mk('div', 'linksSuggestList', sug);
  const acts = mk('div', null, card, { class: 'row links-actions' });
  for (const a of ['add', 'suggest', 'reset']) mk('button', null, acts, { 'data-la': a });
  mk('p', 'linksMsg', card);
  const dlg = mk('dialog', 'linksDelDialog', card);
  mk('h2', 'linksDelTitle', dlg);
  mk('button', null, dlg, { 'data-dialog': 'cancel' });
  mk('button', null, dlg, { 'data-dialog': 'ok' });
  return { doc, card, dlg };
}

test('Q10 ★ [4c] 링크 A 삭제 대화 → 설정 안 이동(라우터가 showLinksSettings 를 다시 부름) → 대화 취소 · 돌아와 B 확인 → B 만 지워짐', async () => {
  const S = await import('../js/settings.js');
  const savedDoc = globalThis.document;
  const { doc, card, dlg } = miniDoc();
  globalThis.document = doc;
  const tick = () => new Promise((r) => setTimeout(r, 15));
  try {
    S._setCacheForTest({ 'links.medical': [{ id: 'la', name: 'Site A', url: 'https://example.org/' }, { id: 'lb', name: 'Site B', url: 'https://example.net/' }, { id: 'lc', name: 'Site C', url: 'https://example.com/' }] });
    LK.initLinksSettings();
    LK.showLinksSettings('links');
    const press = (target) => { for (const fn of (card.ls.click || []).slice()) fn({ target: target, stopPropagation() {} }); };
    const rowBtn = (id) => card.querySelector('.links-row[data-id="' + id + '"] button[data-la="delete"]');
    assert.ok(rowBtn('la'), '목록이 그려졌다');
    press(rowBtn('la'));
    await tick();
    assert.equal(dlg.open, true, 'A 삭제 확인이 열렸다');
    // 설정 화면 안 뒤로가기(`#/settings/links` → `#/settings`) — 같은 화면이라 leave 없이 showSettings → showLinksSettings
    LK.showLinksSettings(undefined);
    await tick();
    assert.equal(dlg.open, false, '★ 열린 대화는 취소로 닫힌다');
    assert.deepEqual(S.get('links.medical').map((l) => l.id), ['la', 'lb', 'lc'], '취소 — 아무것도 안 지움');
    LK.showLinksSettings('links');
    press(rowBtn('lb'));
    await tick();
    assert.equal(dlg.open, true);
    const ok = dlg.querySelector('button[data-dialog="ok"]');
    for (const fn of (dlg.ls.click || []).slice()) fn({ target: ok, stopPropagation() {} });
    for (let i = 0; i < 5; i++) await tick();
    assert.deepEqual(S.get('links.medical').map((l) => l.id), ['la', 'lc'], '★ B 만 지워짐(A 는 옛 리스너로 지워지지 않는다)');
    assert.equal((dlg.ls.click || []).length, 0, '물음이 끝나면 대화 리스너가 남지 않는다');
  } finally {
    globalThis.document = savedDoc;
  }
});
