/* ============================================================
   tests/pipeline-8a.test.mjs — spec 7-6 상태 기계 · 7-1 · 7-5 · 10-2 · 15절 · 16-D2

   fetch 스텁으로 실제 `ai/provider.js`·gemini 어댑터를 그대로 지난다(상태 코드 → 코드 → 상태).
   시계·타이머·온라인 여부·DB 를 주입한다. 실제 키도 네트워크도 없다.

   16-D2 `[N]` 상태 기계: 429 → exhausted + 자동 재시도 0건, 500 → 1회 재시도 후 cooldown,
   401 → no-key, REGION → region(키 설정 유도 없음), 타임아웃 30초 → cooldown,
   같은 키 동시 요청 → Promise 공유(호출 1건).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createPipeline, STATES, SEG, FAIL, STATUS, nextLocalMidnight } from '../js/ai/pipeline.js';
import { createCache, keyFor } from '../js/ai/cache.js';
import { localDay } from '../js/ai/provider.js';
import {
  FAKE_KEY, memDb, stubFetch, jsonRes, geminiOk, docItems, echoTranslate, settingsOf, manualTimers
} from './fixtures/ai-stubs-8a.mjs';

const T0 = new Date(2026, 9, 10, 14, 0, 0).getTime();   // 지역 시각 2026-10-10 14:00

function rig(over) {
  const o = over || {};
  const db = o.db || memDb();
  const timers = manualTimers();
  const clock = { t: o.t || T0 };
  const net = { online: true };
  const cache = createCache({ db: db, now: () => clock.t });
  const fetch = o.fetch || stubFetch(echoTranslate());
  const p = createPipeline({
    fetch: fetch,
    db: db,
    cache: cache,
    getKey: () => (o.key === undefined ? FAKE_KEY : o.key),
    getSetting: settingsOf(o.settings),
    now: () => clock.t,
    isOnline: () => net.online,
    setTimer: timers.set,
    clearTimer: timers.clear,
    ondevice: o.ondevice,
    listen: false
  });
  const events = [];
  p.onState((e) => events.push(e.state));
  return { p, db, timers, clock, net, cache, fetch, events };
}

const SENTS = ['Fever was noted in 3 of 10 patients.', 'The rash resolved within two weeks.'];
const T = { src: 'en', target: 'ar', kind: 'translate', docId: 'doc1' };
const RA = { src: 'en', target: 'ar', kind: 'readalong', docId: 'doc1' };

const err = (status, error, headers) => () => jsonRes(status, { error: error || {} }, headers);

/* ══════════════════════════════════════════════════════
   1. 정상 경로 · 캐시 · 사용량
   ══════════════════════════════════════════════════════ */

test('S1 성공 — 번역이 입력 순서대로 오고 캐시에 provider·model·promptVersion 과 함께 들어간다', async () => {
  const { p, fetch, cache } = rig();
  const r = await p.translate(SENTS, T);
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(r.results.map((x) => x.state), [SEG.READY, SEG.READY]);
  assert.equal(r.results[0].text, '«' + SENTS[0] + '»');
  assert.equal(r.calls, 1);
  assert.equal(p.state(), STATES.READY);
  const k = await keyFor('doc1', SENTS[0], 'ar', 'translate');
  const rec = (await cache.getMany([k])).get(k);
  assert.equal(rec.result, '«' + SENTS[0] + '»');
  assert.equal(rec.provider, 'gemini');
  assert.equal(rec.model, 'gemini-3.5-flash-lite');
  assert.equal(rec.promptVersion, 1);
  // 요청: 키는 헤더로만, 문장은 DOC 안에, 언어는 이름으로.
  const init = fetch.calls[0].init;
  assert.ok(!fetch.calls[0].url.includes(FAKE_KEY));
  assert.equal(init.headers['x-goog-api-key'], FAKE_KEY);
  assert.deepEqual(docItems(init).map((x) => x.text), SENTS);
  assert.match(JSON.parse(init.body).contents[0].parts[0].text, /from English into Arabic/);
});

test('S2 ★ 캐시 적중 — 네트워크 0건 · cacheHits++ · 낭독 경로가 받은 것을 탭 경로가 그대로 쓴다', async () => {
  const { p, fetch, db } = rig();
  await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1);
  const r = await p.translate([SENTS[1]], T);          // 다른 경로(탭)·다른 묶음
  assert.equal(fetch.calls.length, 1, '같은 Unit.src → 같은 키 → 호출 0');
  assert.equal(r.results[0].cached, true);
  assert.equal(db.usageRow(localDay(T0)).cacheHits, 1);
});

test('S3 ★ 사용량 — 낭독 호출은 byKind.readalong·charsTranslated(보낸 원문 글자 합), 탭은 글자를 세지 않는다', async () => {
  const { p, db } = rig();
  await p.translate(SENTS, RA);
  const row = db.usageRow(localDay(T0));
  assert.equal(row.calls, 1);
  assert.equal(row.byKind.readalong, 1);
  assert.equal(row.charsTranslated, SENTS[0].length + SENTS[1].length);
  await p.translate(['A different sentence here.'], T);
  const row2 = db.usageRow(localDay(T0));
  assert.equal(row2.calls, 2);
  assert.equal(row2.byKind.translate, 1);
  assert.equal(row2.charsTranslated, SENTS[0].length + SENTS[1].length, '탭 번역은 글자 지표에 넣지 않는다(15절)');
});

test('S4 같은 언어·모르는 언어·빈 입력 → 보내지 않는다', async () => {
  const { p, fetch } = rig();
  assert.equal((await p.translate(SENTS, { src: 'ar', target: 'ar', docId: 'd' })).status, STATUS.SAME_LANG);
  assert.equal((await p.translate(SENTS, { src: 'en', target: 'xx', docId: 'd' })).status, STATUS.UNSUPPORTED_LANG);
  assert.equal((await p.translate([], T)).status, STATUS.EMPTY);
  assert.equal(fetch.calls.length, 0);
});

test('S5 MAX_REQ_CHARS 를 넘으면 문장 경계에서 나눠 여러 호출(순서 보존)', async () => {
  const s = (c) => (c + ' ').repeat(500).trim() + '.';     // 1,000자
  const { p, fetch } = rig({ settings: { 'ai.maxReqChars': 2500 } });
  const r = await p.translate([s('a'), s('b'), s('c'), s('d'), s('e')], T);
  assert.equal(fetch.calls.length, 3);                       // 2 + 2 + 1
  assert.deepEqual(fetch.calls.map((c) => docItems(c.init).length), [2, 2, 1]);
  assert.ok(r.results.every((x) => x.state === SEG.READY));
  assert.equal(r.results[4].text, '«' + s('e') + '»');
});

/* ══════════════════════════════════════════════════════
   2. 상태 기계 (16-D2)
   ══════════════════════════════════════════════════════ */

test('M1 ★ 429 → exhausted, 자동 재시도 0건 · Retry-After · 그동안 요청 0건 · [다시 시도] → ready', async () => {
  const fetch = stubFetch(err(429, { status: 'RESOURCE_EXHAUSTED', message: 'quota' }, { 'Retry-After': '120' }));
  const { p, clock, events } = rig({ fetch });
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1, '자동 재시도 0');
  assert.equal(p.state(), STATES.EXHAUSTED);
  assert.equal(p._base().until, T0 + 120000);
  assert.deepEqual(r.results.map((x) => x.state), [SEG.BLOCKED, SEG.BLOCKED], '내용이 판정받지 않았다 — 보내지 않은 것');
  // 쪽을 몇 번 넘겨도(다시 불러도) 요청 0건, 상태 알림은 한 번.
  for (let i = 0; i < 5; i++) await p.translate(['Another page sentence ' + i + '.'], RA);
  assert.equal(fetch.calls.length, 1);
  assert.equal(events.filter((e) => e === STATES.EXHAUSTED).length, 1);
  // 시간이 지나면 풀린다.
  clock.t += 120000;
  assert.equal(p.state(), STATES.READY);
  // [다시 시도] 는 즉시 ready.
  await p.translate(SENTS, RA);
  assert.equal(p.state(), STATES.EXHAUSTED);
  assert.equal(await p.retry(), STATES.READY);
});

test('M1b 429 에 Retry-After 가 없으면 다음 날 00:00(기기 로컬)까지', async () => {
  const fetch = stubFetch(err(429, { status: 'RESOURCE_EXHAUSTED' }));
  const { p } = rig({ fetch });
  await p.translate(SENTS, T);
  assert.equal(p._base().until, nextLocalMidnight(T0));
  assert.equal(new Date(p._base().until).getHours(), 0);
  assert.equal(new Date(p._base().until).getDate(), 11);
});

test('M2 ★ 500 → 즉시 1회 재시도 후 cooldown(30s → 60s → 120s) · 그 문장은 failed', async () => {
  const fetch = stubFetch(err(500, { status: 'INTERNAL' }));
  const { p, clock } = rig({ fetch });
  const r = await p.translate(SENTS, T);
  assert.equal(fetch.calls.length, 2, '5xx 는 정확히 1회만 다시 보낸다');
  assert.equal(p.state(), STATES.COOLDOWN);
  assert.equal(p._base().until, T0 + 30000);
  assert.deepEqual(r.results.map((x) => [x.state, x.code]), [[SEG.FAILED, FAIL.SERVER], [SEG.FAILED, FAIL.SERVER]]);
  // cooldown 동안 새 문장은 보내지 않는다.
  await p.translate(['New sentence one.'], T);
  assert.equal(fetch.calls.length, 2);
  // 풀린 뒤 또 실패하면 다음 단계(60s).
  clock.t += 30000;
  await p.translate(['New sentence two.'], T);
  assert.equal(fetch.calls.length, 4);
  assert.equal(p._base().until, clock.t + 60000);
  clock.t += 60000;
  await p.translate(['New sentence three.'], T);
  assert.equal(p._base().until, clock.t + 120000);
  clock.t += 120000;
  await p.translate(['New sentence four.'], T);
  assert.equal(p._base().until, clock.t + 120000, '최대 3단계');
});

test('M2b 500 다음 200 이면 재시도가 성공하고 상태는 ready', async () => {
  const fetch = stubFetch((u, init, n) => (n === 0 ? err(503)() : echoTranslate()(u, init)));
  const { p } = rig({ fetch });
  const r = await p.translate(SENTS, T);
  assert.equal(fetch.calls.length, 2);
  assert.ok(r.results.every((x) => x.state === SEG.READY));
  assert.equal(p.state(), STATES.READY);
});

test('M3 ★ 401·403·무효 키(400 API_KEY_INVALID) → no-key · 키가 없으면 보내지도 않는다 · 키 저장 → ready', async () => {
  for (const make of [
    err(401, { status: 'UNAUTHENTICATED' }),
    err(403, { status: 'PERMISSION_DENIED', message: 'denied' }),
    err(400, { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] })
  ]) {
    const fetch = stubFetch(make);
    const { p } = rig({ fetch });
    const r = await p.translate(SENTS, T);
    assert.equal(fetch.calls.length, 1);
    assert.equal(p.state(), STATES.NO_KEY);
    assert.ok(r.results.every((x) => x.state === SEG.BLOCKED));
  }
  const keyless = rig({ key: '' });
  const r = await keyless.p.translate(SENTS, T);
  assert.equal(keyless.fetch.calls.length, 0);
  assert.equal(keyless.p.state(), STATES.NO_KEY);
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.NO_KEY));

  const fetch = stubFetch(err(401));
  const { p } = rig({ fetch });
  await p.translate(SENTS, T);
  assert.equal(p.configChanged('key'), STATES.READY);
});

test('M4 ★ REGION → region (no-key 가 아니다 — 키 설정 유도 없음) · 키를 다시 넣어도 안 풀리고 프로바이더를 바꾸면 풀린다', async () => {
  for (const make of [
    err(400, { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' }),
    err(403, { status: 'PERMISSION_DENIED', message: 'User location is not supported for the API use.' })
  ]) {
    const fetch = stubFetch(make);
    const { p, events } = rig({ fetch });
    const r = await p.translate(SENTS, RA);
    assert.equal(fetch.calls.length, 1, '자동 재시도 0');
    assert.equal(p.state(), STATES.REGION);
    assert.notEqual(p.state(), STATES.NO_KEY);
    assert.ok(!events.includes(STATES.NO_KEY), '키 문제로 안내하는 상태를 한 번도 거치지 않는다');
    assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.REGION));
    assert.equal(p.configChanged('key'), STATES.REGION, '키를 다시 넣어도 지역 제한은 그대로');
    assert.equal(p.configChanged('model'), STATES.REGION);
    assert.equal(p.configChanged('provider'), STATES.READY);
  }
});

test('M5 ★ MODEL_UNAVAILABLE(404) → model 상태 [8a 결정] · 시간·키로는 안 풀리고 모델을 바꾸면 풀린다', async () => {
  const fetch = stubFetch(err(404, { status: 'NOT_FOUND', message: 'models/x is not found' }));
  const { p, clock } = rig({ fetch });
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1);
  assert.equal(p.state(), STATES.MODEL);
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.MODEL));
  clock.t += 24 * 3600 * 1000;
  assert.equal(p.state(), STATES.MODEL, '시간이 지나도 그대로');
  await p.translate(['Another one here.'], RA);
  assert.equal(fetch.calls.length, 1, '그동안 요청 0');
  assert.equal(p.configChanged('key'), STATES.MODEL);
  assert.equal(p.configChanged('model'), STATES.READY);
});

test('M6 ★ 타임아웃 30초 → abort · cooldown · failed(TIMEOUT) · 재시도 없음', async () => {
  const fetch = stubFetch((url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const e = new Error('The operation was aborted.');
      e.name = 'AbortError';
      reject(e);
    });
  }));
  const { p, timers } = rig({ fetch });
  const pending = p.translate(SENTS, T);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(p.state(), STATES.INFLIGHT);
  const t30 = timers.pending().filter((t) => t.ms === 30000);
  assert.equal(t30.length, 1, '30초 타이머가 하나 걸려 있다');
  timers.fire(30000);
  const r = await pending;
  assert.equal(fetch.calls.length, 1);
  assert.equal(p.state(), STATES.COOLDOWN);
  assert.deepEqual(r.results.map((x) => x.code), [FAIL.TIMEOUT, FAIL.TIMEOUT]);
});

test('M7 ★ 같은 캐시 키 동시 요청 → 진행 중인 Promise 공유(호출 1건)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const inner = echoTranslate();
  const fetch = stubFetch(async (u, init) => { await gate; return inner(u, init); });
  const { p } = rig({ fetch });
  const a = p.translate(SENTS, RA);                 // 낭독 경로
  const b = p.translate([SENTS[0]], T);             // 탭 경로 — 같은 문장
  const c = p.translate(SENTS, RA);                 // 같은 묶음 한 번 더
  await new Promise((r) => setTimeout(r, 5));
  release();
  const [ra, rb, rc] = await Promise.all([a, b, c]);
  assert.equal(fetch.calls.length, 1, '같은 키는 한 번만 보낸다');
  assert.equal(rb.results[0].text, ra.results[0].text);
  assert.equal(rc.results[1].text, ra.results[1].text);
  // 한 호출 안에서 같은 문장이 두 번 와도 한 번만 보낸다.
  const r2 = rig();
  const dup = await r2.p.translate(['Same here.', 'Same here.'], T);
  assert.equal(docItems(r2.fetch.calls[0].init).length, 1);
  assert.equal(dup.results[1].text, dup.results[0].text);
});

/* ══════════════════════════════════════════════════════
   3. "보내지 않은 것" vs "보냈다가 실패한 것" (7-6)
   ══════════════════════════════════════════════════════ */

test('F1 ★ offline → 보내지 않는다(blocked) → online 이면 그 문장은 보낸다(첫 전송)', async () => {
  const { p, fetch, net, events } = rig();
  net.online = false;
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 0);
  assert.equal(p.state(), STATES.OFFLINE);
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.OFFLINE));
  net.online = true;
  p.setOnline(true);
  assert.equal(events[events.length - 1], STATES.READY, 'ready 로 돌아왔다는 알림 — 호출자가 보내지 않은 것을 보낼 신호');
  const again = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 1);
  assert.ok(again.results.every((x) => x.state === SEG.READY));
});

test('F2 ★ 보냈다가 실패한 것은 다시 보내지 않는다 — 상태가 풀린 뒤에도 · [다시 시도](retry:true)만 보낸다', async () => {
  let mode = 'fail';
  const fetch = stubFetch((u, init) => (mode === 'fail' ? err(500)() : echoTranslate()(u, init)));
  const { p, clock } = rig({ fetch });
  await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 2);                      // 1 + 재시도 1
  clock.t += 30000;                                          // cooldown 풀림
  mode = 'ok';
  assert.equal(p.state(), STATES.READY);
  const r = await p.translate(SENTS, RA);
  assert.equal(fetch.calls.length, 2, '실패했던 문장은 자동으로 다시 나가지 않는다');
  assert.ok(r.results.every((x) => x.state === SEG.FAILED && x.code === FAIL.SERVER));
  // 새 문장(새 쪽)은 첫 전송이라 나간다.
  const fresh = await p.translate(['A brand new sentence.'], RA);
  assert.equal(fetch.calls.length, 3);
  assert.equal(fresh.results[0].state, SEG.READY);
  // 사용자 [다시 시도]
  const retried = await p.translate(SENTS, Object.assign({ retry: true }, RA));
  assert.equal(fetch.calls.length, 4);
  assert.ok(retried.results.every((x) => x.state === SEG.READY));
});

test('F3 ★ 일일 상한 — 검증 호출은 빼고 센다 · 닿으면 capped(보내지 않음) · 다음 날·상한 상향이면 풀린다', async () => {
  const db = memDb();
  const day = localDay(T0);
  await db.put('usage', { day: day, calls: 3, byKind: { verify: 1, translate: 2 } });
  const cap = { v: 3 };
  const fetch = stubFetch(echoTranslate());
  const timers = manualTimers();
  const clock = { t: T0 };
  const p = createPipeline({
    fetch, db, cache: createCache({ db, now: () => clock.t }), getKey: () => FAKE_KEY,
    getSetting: (k) => (k === 'ai.dailyCap' ? cap.v : settingsOf()(k)), now: () => clock.t,
    isOnline: () => true, setTimer: timers.set, clearTimer: timers.clear, listen: false
  });
  // 3 - verify 1 = 2 < 3 → 한 번 보낸다
  await p.translate(['First sentence here.'], RA);
  assert.equal(fetch.calls.length, 1);
  // 이제 4 - 1 = 3 ≥ 3 → capped
  const r = await p.translate(['Second sentence here.'], RA);
  assert.equal(fetch.calls.length, 1);
  assert.equal(p.state(), STATES.CAPPED);
  assert.ok(r.results.every((x) => x.state === SEG.BLOCKED && x.code === STATES.CAPPED));
  // 상한을 올리면 풀린다
  cap.v = 10;
  await p.translate(['Second sentence here.'], RA);
  assert.equal(fetch.calls.length, 2);
  assert.equal(p.state(), STATES.READY);
  // 다시 닿게 한 뒤 날이 바뀌면 풀린다
  cap.v = 1;
  await p.translate(['Third sentence here.'], RA);
  assert.equal(p.state(), STATES.CAPPED);
  clock.t = nextLocalMidnight(T0) + 1000;
  assert.equal(p.state(), STATES.READY);
});

/* ══════════════════════════════════════════════════════
   4. 10-2 검증이 파이프라인에서
   ══════════════════════════════════════════════════════ */

const TEN = Array.from({ length: 10 }, (_, k) => 'Patient group ' + 'abcdefghij'[k] + ' improved after treatment.');

test('V1 길이 비율 밖인 한 항목만 failed — 나머지는 캐시 · 그 항목은 다시 보내지 않는다', async () => {
  const fetch = stubFetch(echoTranslate((it) => (it.i === 4 ? 'x' : '«' + it.text + '»')));
  const { p, cache } = rig({ fetch });
  const r = await p.translate(TEN, T);
  assert.equal(r.results.filter((x) => x.state === SEG.READY).length, 9);
  assert.deepEqual([r.results[4].state, r.results[4].code], [SEG.FAILED, FAIL.RATIO]);
  const k4 = await keyFor('doc1', TEN[4], 'ar', 'translate');
  assert.equal((await cache.getMany([k4])).size, 0, '실패 항목은 캐시하지 않는다');
  assert.equal(p.isFailed(k4), true);
});

test('V2 ★ 청크의 20% 초과가 밀림 검사에 걸리면 청크 전체 실패(SHIFT) · 캐시 0 · errors++', async () => {
  const fetch = stubFetch(echoTranslate((it) => (it.i < 3 ? 'x' : '«' + it.text + '»')));
  const { p, cache, db } = rig({ fetch });
  const r = await p.translate(TEN, T);
  assert.ok(r.results.every((x) => x.state === SEG.FAILED && x.code === FAIL.SHIFT));
  const keys = await Promise.all(TEN.map((s) => keyFor('doc1', s, 'ar', 'translate')));
  assert.equal((await cache.getMany(keys)).size, 0);
  assert.ok(db.usageRow(localDay(T0)).errors >= 1);
});

test('V3 개수 누락 → 있는 것만 채택(캐시), 누락분 MISSING · 숫자 소실 DIGITS · 동방 숫자는 통과', async () => {
  const fetch = stubFetch(echoTranslate((it) => {
    if (it.i === 1) return undefined;                                   // 누락
    if (it.i === 0) return 'كانت الحمى لدى ٣ من ١٠ مرضى.';              // 동방 숫자
    return '«' + it.text + '»';
  }));
  const { p } = rig({ fetch });
  const r = await p.translate([SENTS[0], SENTS[1], 'Dose was 40 mg daily for adults.'], T);
  assert.deepEqual(r.results.map((x) => x.state), [SEG.READY, SEG.FAILED, SEG.READY]);
  assert.equal(r.results[1].code, FAIL.MISSING);

  const lost = stubFetch(echoTranslate((it) => (it.i === 0 ? 'كانت الحمى لدى بعض المرضى هنا.' : '«' + it.text + '»')));
  const r2 = await rig({ fetch: lost }).p.translate([SENTS[0], SENTS[1], 'Plain words only here.', 'More plain words here.', 'Still more plain words.', 'Last plain words.'], T);
  assert.deepEqual([r2.results[0].state, r2.results[0].code], [SEG.FAILED, FAIL.DIGITS]);
  assert.ok(r2.results.slice(1).every((x) => x.state === SEG.READY));
});

test('V4 ★ 코드펜스로 감싼 응답도 받는다(10-6) · 해석 불가면 PARSE · 캐시 없음', async () => {
  const fenced = stubFetch((u, init) => {
    const items = docItems(init);
    const body = JSON.stringify({ segments: items.map((it) => ({ i: it.i, t: '«' + it.text + '»' })) });
    return jsonRes(200, geminiOk('```json\n' + body + '\n```'));
  });
  const r = await rig({ fetch: fenced }).p.translate(SENTS, T);
  assert.ok(r.results.every((x) => x.state === SEG.READY));

  const garbage = stubFetch(() => jsonRes(200, geminiOk('I cannot help with that.')));
  const g = rig({ fetch: garbage });
  const r2 = await g.p.translate(SENTS, T);
  assert.ok(r2.results.every((x) => x.state === SEG.FAILED && x.code === FAIL.PARSE));
  assert.equal(g.p.state(), STATES.READY, '파싱 실패는 원격 상태를 바꾸지 않는다');
});

test('V5 SAFETY 차단 → failed(SAFETY), 상태는 ready', async () => {
  const fetch = stubFetch(() => jsonRes(200, { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }));
  const { p } = rig({ fetch });
  const r = await p.translate(SENTS, T);
  assert.ok(r.results.every((x) => x.code === FAIL.SAFETY));
  assert.equal(p.state(), STATES.READY);
});

/* ══════════════════════════════════════════════════════
   5. 기기 내 번역 · 알림 · 던지지 않음
   ══════════════════════════════════════════════════════ */

test('O1 기기 내 번역이 주입되면 먼저 쓴다(네트워크 0 · ondeviceHits) · null 이면 원격으로', async () => {
  const seen = [];
  const od = async (s, src, dst) => { seen.push([src, dst]); return s.map((x) => 'OD:' + x); };
  const a = rig({ ondevice: od });
  const r = await a.p.translate(SENTS, { src: 'fr', target: 'ko', docId: 'd' });
  assert.equal(a.fetch.calls.length, 0);
  assert.equal(r.results[0].text, 'OD:' + SENTS[0]);
  assert.deepEqual(seen, [['fr', 'ko']], '원문 언어는 인자로 넘어간다');
  assert.equal(a.db.usageRow(localDay(T0)).ondeviceHits, 1);

  const b = rig({ ondevice: async () => null });
  await b.p.translate(SENTS, T);
  assert.equal(b.fetch.calls.length, 1);
  const c = rig({ ondevice: od, settings: { 'ai.useOnDevice': false } });
  await c.p.translate(SENTS, T);
  assert.equal(c.fetch.calls.length, 1, '설정에서 끄면 쓰지 않는다');
});

test('O2 상태 알림은 바뀔 때만 · 듣는 쪽이 던져도 파이프라인은 계속', async () => {
  const fetch = stubFetch(err(429, { status: 'RESOURCE_EXHAUSTED' }));
  const { p, events } = rig({ fetch });
  p.onState(() => { throw new Error('listener boom'); });
  await p.translate(SENTS, T);
  await p.translate(['x y z'], T);
  assert.deepEqual(events, [STATES.INFLIGHT, STATES.EXHAUSTED]);
});

test('O3 어떤 응답에도 translate 는 던지지 않는다 · 결과에 키가 없다', async () => {
  const bodies = [
    () => { throw new TypeError('Failed to fetch'); },
    () => jsonRes(502, null),
    () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('bad json'); } }),
    () => jsonRes(200, geminiOk('{"segments": "nope"}'))
  ];
  for (const b of bodies) {
    const { p } = rig({ fetch: stubFetch(b) });
    const r = await p.translate(SENTS, T);
    assert.equal(r.results.length, 2);
    assert.ok(!JSON.stringify(r).includes(FAKE_KEY));
  }
  // 네트워크 오류(온라인) → cooldown, failed(NETWORK) — 재시도 없음
  const net = rig({ fetch: stubFetch(() => { throw new TypeError('Failed to fetch'); }) });
  const r = await net.p.translate(SENTS, T);
  assert.equal(net.fetch.calls.length, 1);
  assert.equal(net.p.state(), STATES.COOLDOWN);
  assert.equal(r.results[0].code, FAIL.NETWORK);
});

test('M8 [Review 8a] 숨은 재시도 없음 — 429·500·타임아웃 뒤 걸린 타이머를 전부 발화해도 요청이 늘지 않는다', async () => {
  for (const [make, expectCalls] of [
    [err(429, { status: 'RESOURCE_EXHAUSTED' }, { 'Retry-After': '60' }), 1],
    [err(429, { status: 'RESOURCE_EXHAUSTED' }), 1],
    [err(500, { status: 'INTERNAL' }), 2]
  ]) {
    const fetch = stubFetch(make);
    const { p, timers, clock } = rig({ fetch });
    await p.translate(SENTS, RA);
    assert.equal(fetch.calls.length, expectCalls);
    clock.t += 2 * 86400000;            // 만료 시각을 넘긴 뒤
    timers.fire();                      // 걸려 있던 타이머(만료 알림)를 전부 발화
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fetch.calls.length, expectCalls, '타이머가 스스로 요청을 보냈다');
    assert.equal(p.state(), STATES.READY, '만료 뒤 상태만 ready 로 돌아온다');
  }
});
