/* ============================================================
   tests/pipeline-8a-followup.test.mjs — 8a 후속: 운영자 결정 3건 (2026-10-10)

   spec 10-2 `[수정 2026-10-10]` · 7-6 `[수정 2026-10-10]` · 16-D2 의 10-2 항목.
     1. 짧은 원문(20자 미만)은 길이 비율을 보지 않는다 — 숫자 보존 검사는 그대로.
     2. 네트워크 오류(응답 없음)는 failed 가 아니라 blocked — cooldown 이 풀리면 다시 보낸다.
        단 3단계(30→60→120초)를 다 쓰면 그 뒤는 사용자 [다시 시도]로만(무한 반복 없음).
     3. `assertNoKeyInUrl` 거절은 네트워크 오류가 아니다 — 전용 코드 `KEY_IN_URL`, usage 0,
        설정을 고쳐야 풀리는 상태.

   fetch 스텁으로 실제 `ai/provider.js`·gemini 어댑터를 지난다. 실제 키도 네트워크도 없다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline, STATES, SEG, FAIL } from '../js/ai/pipeline.js';
import { createCache, keyFor } from '../js/ai/cache.js';
import { checkTranslation } from '../js/ai/prompts.js';
import { complete, CODES, localDay } from '../js/ai/provider.js';
import { PIPELINE } from '../js/config.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';
import { OUTCOME, errorOutcome, outcomeKey, verifyOutcome } from '../js/ui/settings.js';
import {
  FAKE_KEY, memDb, stubFetch, jsonRes, echoTranslate, settingsOf, manualTimers
} from './fixtures/ai-stubs-8a.mjs';

const T0 = new Date(2026, 9, 10, 14, 0, 0).getTime();
const T = { src: 'en', target: 'ar', kind: 'translate', docId: 'doc1' };
const RA = { src: 'en', target: 'ar', kind: 'readalong', docId: 'doc1' };
const SENTS = ['Fever was noted in 3 of 10 patients.', 'The rash resolved within two weeks.'];

function rig(over) {
  const o = over || {};
  const db = o.db || memDb();
  const timers = manualTimers();
  const clock = { t: o.t || T0 };
  const net = { online: true };
  const cache = createCache({ db: db, now: () => clock.t });
  const fetch = o.fetch || stubFetch(echoTranslate());
  const p = createPipeline({
    fetch: fetch, db: db, cache: cache,
    getKey: () => (o.key === undefined ? FAKE_KEY : o.key),
    getSetting: settingsOf(o.settings),
    now: () => clock.t,
    isOnline: () => net.online,
    setTimer: timers.set, clearTimer: timers.clear,
    listen: false
  });
  const events = [];
  p.onState((e) => events.push(e));
  return { p, db, timers, clock, net, cache, fetch, events };
}

const one = (src, t) => checkTranslation([{ text: src }], { segments: [{ i: 0, t: t }] }).items[0];

/* ══════════════════════════════════════════════════════
   1. 짧은 원문은 길이 비율을 보지 않는다 (10-2)
   ══════════════════════════════════════════════════════ */

test('L1 ★ `ECG.` → 아랍어 풀어쓰기(5배 초과) = ok · `MRI`·`CRP.` 도', () => {
  const ar = 'تخطيط كهربية القلب (ECG).';             // 4자 → 25자, 비율 6 이상
  assert.ok([...ar].length > 4 * PIPELINE.LEN_RATIO_MAX, '시험 전제: 5배를 넘는다');
  assert.deepEqual(one('ECG.', ar), { i: 0, state: 'ok', t: ar });
  assert.equal(one('MRI', 'التصوير بالرنين المغناطيسي (MRI)').state, 'ok');
  assert.equal(one('CRP.', 'البروتين المتفاعل C (CRP).').state, 'ok');
});

test('L2 ★ 20자 이상의 정상 문장은 비율 검사 그대로 — 너무 길어도·너무 짧아도 failed(ratio)', () => {
  const src = 'The rash resolved quickly.';                  // 26자
  assert.ok([...src].length >= PIPELINE.SHORT_SRC_CHARS);
  assert.equal(one(src, 'x').reason, 'ratio');
  assert.equal(one(src, 'y'.repeat(26 * 5 + 1)).reason, 'ratio');
  assert.equal(one(src, '«' + src + '»').state, 'ok');
});

test('L3 경계 — 19자는 생략, 20자부터 검사 (`SHORT_SRC_CHARS` 미만만 생략)', () => {
  const s19 = 'abcdefghijklmnopqr.';                          // 19
  const s20 = 'abcdefghijklmnopqrs.';                         // 20
  assert.equal([...s19].length, 19);
  assert.equal([...s20].length, 20);
  const long = 'ج'.repeat(101);                               // 20 × 5 = 100 초과
  assert.equal(one(s19, long).state, 'ok');
  assert.equal(one(s20, long).reason, 'ratio');
  assert.equal(one(s20, 'ج'.repeat(100)).state, 'ok', '정확히 5배는 넘지 않는다');
});

test('L4 ★ 짧아도 숫자를 빼면 failed(digits) · 숫자를 지키면 ok · 빈 번역은 여전히 failed', () => {
  assert.equal(one('Grade 3.', 'الدرجة الثالثة من المرض.').reason, 'digits');
  assert.equal(one('Grade 3.', 'الدرجة ٣ (Grade 3).').state, 'ok');
  assert.equal(one('ECG.', '').state, 'failed');
});

test('L5 짧은 문장 여럿이 한 청크에 있어도 밀림(SHIFT)으로 세지 않는다 · 파이프라인이 캐시한다', async () => {
  const shorts = ['ECG.', 'MRI', 'CRP.', 'Treatment'];
  const expand = (it) => 'ترجمة طويلة جدًا لهذا الاختصار الطبي (' + it.text + ')';
  const fetch = stubFetch(echoTranslate(expand));
  const { p, cache } = rig({ fetch });
  const r = await p.translate(shorts, T);
  assert.ok(r.results.every((x) => x.state === SEG.READY), JSON.stringify(r.results));
  const k = await keyFor('doc1', 'ECG.', 'ar', 'translate');
  assert.equal((await cache.getMany([k])).size, 1);
});

/* ══════════════════════════════════════════════════════
   2. 네트워크 오류 = blocked · 3단계 상한 (7-6)
   ══════════════════════════════════════════════════════ */

const netFail = () => { throw new TypeError('Failed to fetch'); };

test('N1 ★ 응답 없는 실패 → blocked(NETWORK) · cooldown 30s · failed 로 기억하지 않음 · 풀리면 다시 보낸다', async () => {
  let mode = 'down';
  const fetch = stubFetch((u, init) => (mode === 'down' ? netFail() : echoTranslate()(u, init)));
  const { p, clock, timers, events } = rig({ fetch });
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1, '즉시 재시도 없음');
  assert.deepEqual(r.results.map((x) => [x.state, x.code]), [[SEG.BLOCKED, FAIL.NETWORK], [SEG.BLOCKED, FAIL.NETWORK]]);
  assert.equal(p.state(), STATES.COOLDOWN);
  assert.equal(p._base().until, T0 + 30000);
  const k0 = await keyFor('doc1', SENTS[0], 'ar', 'readalong');
  assert.equal(p.isFailed(k0), false, 'blocked 는 "보냈다가 실패" 기록에 들어가지 않는다');
  // cooldown 동안 다시 불러도 보내지 않는다.
  await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1);
  // 풀리면 ready 알림 → 호출자(8b refill)가 다시 부르면 보낸다.
  clock.t += 30000;
  timers.fire();
  assert.equal(events[events.length - 1].state, STATES.READY);
  mode = 'up';
  const again = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 2);
  assert.ok(again.results.every((x) => x.state === SEG.READY));
});

test('N2 ★ 3단계를 다 쓰면 failed — blocked·blocked·blocked(30·60·120s) 다음 실패는 failed, 그 뒤 자동 전송 0', async () => {
  const fetch = stubFetch(netFail);
  const { p, clock } = rig({ fetch });
  const seen = [];
  const untils = [];
  for (let round = 0; round < 4; round++) {
    const r = await p.translate(SENTS, RA);
    seen.push(r.results[0].state + '/' + r.results[0].code);
    untils.push(p._base().until - clock.t);
    clock.t = p._base().until;                       // 이번 cooldown 이 풀리는 순간으로
  }
  assert.deepEqual(seen, ['blocked/NETWORK', 'blocked/NETWORK', 'blocked/NETWORK', 'failed/NETWORK']);
  assert.deepEqual(untils, [30000, 60000, 120000, 120000]);
  assert.equal(fetch.calls.length, 4);
  const k0 = await keyFor('doc1', SENTS[0], 'ar', 'readalong');
  assert.equal(p.isFailed(k0), true);
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 4, '3단계를 다 쓴 뒤에는 다시 보내지 않는다');
  assert.ok(r.results.every((x) => x.state === SEG.FAILED && x.code === FAIL.NETWORK));
});

test('N3 ★★ 무한 반복 없음 — 가짜 시계로 6시간, 5초마다 refill + ready 알림마다 refill 해도 요청 수 ≤ 1 + 3단계', async () => {
  const fetch = stubFetch(netFail);
  const { p, clock, timers } = rig({ fetch });
  // 8b 흉내: ready 알림이 오면 blocked 를 다시 보낸다.
  let pending = Promise.resolve();
  p.onState((e) => { if (e.state === STATES.READY) pending = pending.then(() => p.translate(SENTS, RA)); });
  const LIMIT = 1 + PIPELINE.COOLDOWN_STEPS_MS.length;
  const end = T0 + 6 * 3600 * 1000;
  while (clock.t < end) {
    await p.translate(SENTS, RA);
    clock.t += 5000;
    timers.fire();
    await pending;
    assert.ok(fetch.calls.length <= LIMIT, '요청 수가 상한을 넘었다: ' + fetch.calls.length);
  }
  assert.equal(fetch.calls.length, LIMIT);
  assert.equal(p.state(), STATES.READY, '상태는 풀려 있다 — 막는 것은 failed 기억이다');
});

test('N4 사용자 [다시 시도] — retry() + translate({retry:true}) 만 다시 보내고, 단계는 처음부터', async () => {
  let mode = 'down';
  const fetch = stubFetch((u, init) => (mode === 'down' ? netFail() : echoTranslate()(u, init)));
  const { p, clock } = rig({ fetch });
  for (let round = 0; round < 4; round++) {
    await p.translate(SENTS, RA);
    clock.t = p._base().until;
  }
  assert.equal(fetch.calls.length, 4);
  // 아직 끊겨 있는데 사용자가 [다시 시도] → 단계가 처음부터라 다시 blocked(30s).
  await p.retry();
  const r1 = await p.translate(SENTS, Object.assign({ retry: true }, RA));
  assert.equal(fetch.calls.length, 5);
  assert.equal(r1.results[0].state, SEG.BLOCKED);
  assert.equal(p._base().until - clock.t, 30000);
  // 연결이 돌아온 뒤 다시 시도 → ready.
  mode = 'up';
  await p.retry();
  const r2 = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 6);
  assert.ok(r2.results.every((x) => x.state === SEG.READY));
});

test('N5 ★ 응답을 받고 실패한 것은 계속 failed — 4xx(BAD_REQUEST)·분류 못 한 상태·본문 해석 불가', async () => {
  const cases = [
    [() => jsonRes(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid JSON payload received.' } }), FAIL.BAD_REQUEST],
    [() => jsonRes(418, { error: { message: 'teapot' } }), null],
    [() => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('bad json'); } }), null]
  ];
  for (const [make, code] of cases) {
    const fetch = stubFetch(make);
    const { p } = rig({ fetch });
    const r = await p.translate(SENTS, T);
    assert.equal(fetch.calls.length, 1);
    assert.ok(r.results.every((x) => x.state === SEG.FAILED), JSON.stringify(r.results));
    assert.ok(r.results.every((x) => x.code !== FAIL.NETWORK), '응답을 받았다 — 네트워크 오류가 아니다');
    if (code) assert.equal(r.results[0].code, code);
  }
});

test('N6 성공하면 단계가 처음으로 — 실패·성공·실패면 다시 blocked(30s)', async () => {
  let n = 0;
  const fetch = stubFetch((u, init) => (n++ === 1 ? echoTranslate()(u, init) : netFail()));
  const { p, clock } = rig({ fetch });
  await p.translate(['First sentence of the page.'], RA);
  clock.t = p._base().until;
  await p.translate(['Second sentence of the page.'], RA);
  assert.equal(p.state(), STATES.READY);
  const r = await p.translate(['Third sentence of the page.'], RA);
  assert.equal(r.results[0].state, SEG.BLOCKED);
  assert.equal(p._base().until - clock.t, 30000);
});

/* ══════════════════════════════════════════════════════
   3. KEY_IN_URL — 네트워크 오류가 아니다 · usage 0 (7-6 · 15절)
   ══════════════════════════════════════════════════════ */

test('K1 ★ 모델 칸에 키 → 요청 0 · usage 행 없음(calls·errors 0) · cooldown 아님 · 설정 상태(model, 코드 KEY_IN_URL)', async () => {
  const { p, fetch, db, events } = rig({ settings: { 'ai.model': FAKE_KEY } });
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 0);
  assert.equal(r.calls, 0, '보내지 않았다');
  const row = db.usageRow(localDay(T0));
  assert.ok(!row || (row.calls === 0 && row.errors === 0), 'usage 에 들어갔다: ' + JSON.stringify(row));
  assert.equal(p.state(), STATES.MODEL);
  assert.notEqual(p.state(), STATES.COOLDOWN);
  assert.equal(p._base().code, CODES.KEY_IN_URL);
  assert.equal(events[events.length - 1].code, CODES.KEY_IN_URL, 'UI 가 문구를 고를 코드가 알림에 실린다');
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.MODEL));
  const k0 = await keyFor('doc1', SENTS[0], 'ar', 'readalong');
  assert.equal(p.isFailed(k0), false);
  assert.ok(!JSON.stringify(r).includes(FAKE_KEY));
  assert.ok(!JSON.stringify(events).includes(FAKE_KEY));
});

test('K2 시간으로는 안 풀리고, 모델·키·프로바이더를 고치거나 [다시 시도]하면 ready', async () => {
  for (const fix of ['model', 'key', 'provider', 'retry']) {
    const { p, clock, fetch } = rig({ settings: { 'ai.model': FAKE_KEY } });
    await p.translate(SENTS, RA);
    clock.t += 3 * 86400000;
    assert.equal(p.state(), STATES.MODEL, '사흘이 지나도 그대로');
    await p.translate(['Another sentence here.'], RA);
    assert.equal(fetch.calls.length, 0);
    const s = fix === 'retry' ? await p.retry() : p.configChanged(fix);
    assert.equal(s, STATES.READY, fix);
  }
});

test('K3 provider.complete — KEY_IN_URL 로 던지고 usage 에 아무것도 쓰지 않는다', async () => {
  const db = memDb();
  const f = stubFetch(() => jsonRes(200, {}));
  await assert.rejects(
    () => complete({ user: 'hi' }, { key: FAKE_KEY, model: FAKE_KEY, fetch: f, db: db, now: T0, kind: 'translate', chars: 10 }),
    (e) => e.code === CODES.KEY_IN_URL && e.noResponse === false && !String(e.message).includes(FAKE_KEY)
  );
  assert.equal(f.calls.length, 0);
  assert.equal(db.usageRow(localDay(T0)), undefined, 'usage 행이 생겼다');
});

test('K4 설정 화면 — KEY_IN_URL 은 "확인 불가"가 아니라 전용 문구 · 네 언어 모두 있다', () => {
  assert.equal(errorOutcome(CODES.KEY_IN_URL), OUTCOME.KEY_IN_URL);
  assert.equal(verifyOutcome({ ok: false, code: CODES.KEY_IN_URL, canSave: true }), OUTCOME.KEY_IN_URL);
  const k = outcomeKey(OUTCOME.KEY_IN_URL, 'test');
  assert.equal(k, 'settings.ai.test.keyInModel');
  for (const l of LANGS) {
    const s = BUNDLES[l] && BUNDLES[l][k];
    assert.equal(typeof s, 'string', l);
    assert.ok(s.trim().length > 0, l);
  }
});

/* ══════════════════════════════════════════════════════
   2b. 타임아웃도 응답 없음 — 네트워크 오류와 같은 규칙·같은 상한
       (`[수정 2026-10-10 — 오케스트레이터 결정]`)
   ══════════════════════════════════════════════════════ */

/** 모드별 fetch: `'hang'` 은 abort 될 때까지 매달린다(타임아웃), `'down'` 은 즉시 거부, `'up'` 은 성공. */
function modalFetch(modeOf) {
  const f = stubFetch((u, init, n) => {
    const m = modeOf(n);
    f.lastMode = m;
    if (m === 'down') return netFail();
    if (m === 'up') return echoTranslate()(u, init);
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const e = new Error('The operation was aborted.');
        e.name = 'AbortError';
        reject(e);
      });
    });
  });
  return f;
}

/** translate 한 번을 끝까지 몬다 — 요청이 매달렸으면 30초 타이머를 발화한다. */
async function drive(p, timers, fetch, sents) {
  let done = false;
  const pr = p.translate(sents, RA).then((r) => { done = true; return r; });
  const before = fetch.calls.length;
  for (let i = 0; i < 500 && !done && fetch.calls.length === before; i++) await new Promise((r) => setImmediate(r));
  if (!done && fetch.calls.length > before && fetch.lastMode === 'hang') {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
    timers.fire(PIPELINE.TIMEOUT_MS);
  }
  return pr;
}

test('T1 ★ 타임아웃 → blocked(TIMEOUT) · cooldown 30s · failed 로 기억하지 않음 · 풀리면 다시 보낸다', async () => {
  let mode = 'hang';
  const fetch = modalFetch(() => mode);
  const { p, clock, timers } = rig({ fetch });
  const r = await drive(p, timers, fetch, SENTS);
  assert.equal(fetch.calls.length, 1, '즉시 재시도 없음');
  assert.deepEqual(r.results.map((x) => [x.state, x.code]), [[SEG.BLOCKED, FAIL.TIMEOUT], [SEG.BLOCKED, FAIL.TIMEOUT]]);
  assert.equal(p.state(), STATES.COOLDOWN);
  assert.equal(p._base().until, T0 + 30000);
  const k0 = await keyFor('doc1', SENTS[0], 'ar', 'readalong');
  assert.equal(p.isFailed(k0), false);
  clock.t += 30000;
  mode = 'up';
  const again = await drive(p, timers, fetch, SENTS);
  assert.equal(fetch.calls.length, 2);
  assert.ok(again.results.every((x) => x.state === SEG.READY));
});

test('T2 ★★ 타임아웃·네트워크 오류가 번갈아 나도 단계·상한을 함께 쓴다 — 가짜 시계 6시간, 자동 전송 ≤ 1 + 3단계', async () => {
  const fetch = modalFetch((n) => (n % 2 === 0 ? 'hang' : 'down'));
  const { p, clock, timers } = rig({ fetch });
  const LIMIT = 1 + PIPELINE.COOLDOWN_STEPS_MS.length;
  const seen = [];
  const end = T0 + 6 * 3600 * 1000;
  while (clock.t < end) {
    const before = fetch.calls.length;
    const r = await drive(p, timers, fetch, SENTS);
    if (fetch.calls.length > before) seen.push(r.results[0].state + '/' + r.results[0].code);
    clock.t += 5000;
    timers.fire();
    assert.ok(fetch.calls.length <= LIMIT, '요청 수가 상한을 넘었다: ' + fetch.calls.length);
  }
  assert.equal(fetch.calls.length, LIMIT);
  assert.deepEqual(seen, ['blocked/TIMEOUT', 'blocked/NETWORK', 'blocked/TIMEOUT', 'failed/NETWORK']);
  const k0 = await keyFor('doc1', SENTS[0], 'ar', 'readalong');
  assert.equal(p.isFailed(k0), true, '상한 뒤에는 사용자 [다시 시도]로만');
});
