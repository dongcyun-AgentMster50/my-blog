/* ============================================================
   tests/pageturn-8i3.test.mjs — spec 4-13-9 "8i-3"
   원본 보기에서 낭독이 쪽 끝을 넘으면 다음 쪽 첫 문장이 시작 직후 끊기고 처음부터 다시 나왔다(6b 부터).
   `goToPageForSpeech` 의 200 ms 폴링이 `state.desc`(그리기 **앞**에서 선다)를 보고 canvas 를 그리는 사이에 풀려
   낭독이 시작되고, 뒤이은 `notifyPage` → `reload()` 가 그 문장을 다시 시작했다.
   이제 그 쪽 렌더의 **끝 알림**(`renderDone` — 그리기·`notifyPage` 뒤)으로 푼다.

   지키는 것:
     · 원본 보기 쪽 넘김 — 다음 쪽 첫 문장 발화 1번, 끊긴 발화 0(그리기 시간만큼 늦게 시작한다 — 운영자 결정)
     · 리플로우 쪽 넘김 — 폴링 틱을 기다리지 않는다(지연 없음)
     · 상한(PAGE_WAIT_MS)·버려진 렌더·다른 쪽으로 감·리더를 떠남 — 전과 같은 결과
     · 8i-1c — 다시 그리기는 `refreshing` 을 내린 뒤에야 풀린다(`whenCurrentPageReady` 도 같은 알림)
     · 배선(8i-1 Review R3·R4) — 추출기 `page` → 문지기, speaker 상태 → 문지기
     · 8i-3b — 판정식은 reader.js 의 순수 함수(`speechPageReady`·`pageTurnCheck`·`freshWaitCheck`)를 흉내도 그대로 쓴다.
       자리표시자 다음 쪽(아직 추출 안 됨)의 렌더 끝에는 풀리지 않는다 — 풀리면 speaker 가 그 쪽을 건너뛴다(8i-3 Review X2)

   원서 문장은 넣지 않는다. 전부 지어낸 글자다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRenderDone, pageFresh, speechPageReady, pageTurnCheck, freshWaitCheck } from '../js/ui/reader.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { TTS } from '../js/config.js';

/* 고치기 전 판의 폴링 간격(옛 config `PAGE_POLL_MS` — 8i-3b 에서 앱 설정에서 뺐다). PT2·PT4 대조 흉내만 쓴다. */
const LEGACY_POLL_MS = 200;

/* ── 가짜 시계·음성 엔진 (refresh-8i1.test.mjs 와 같은 모양) ── */
function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    now: () => now,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null;
        let key = null;
        for (const [k, j] of jobs) if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        if (!pick) break;
        jobs.delete(key);
        now = pick.at;
        pick.fn();
      }
      now = target;
    }
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, spoken: [], cut: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { }, resume() { },
    cancel() {
      const u = s.current;
      if (u) s.cut.push(u.text);                 // 말하던 것이 끊겼다
      s.speaking = false; s.current = null;
      if (u && u.onerror) u.onerror({ error: 'canceled' });
    },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); }
  };
  return s;
}

const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setTimeout(r, 2)); };
function line(id, text) { return { id: id, text: text, hyphen: 'none' }; }

const PAGES = {
  31: [{ id: 'a0', kind: 'body', lines: [line('31:1', 'Alpha closing sentence here.')] }],
  32: [
    { id: 'b0', kind: 'body', lines: [line('32:1', 'Beta opening sentence here.')] },
    { id: 'b1', kind: 'body', lines: [line('32:2', 'Beta second sentence here.')] }
  ],
  33: [{ id: 'c0', kind: 'body', lines: [line('33:1', 'Gamma only sentence here.')] }],
  40: [{ id: 'd0', kind: 'body', lines: [line('40:1', 'Delta only sentence here.')] }]
};
/* 다음 쪽의 옛 판 / 새 판(8i-1 — 판 바뀜 재추출 중) */
const OLD32 = [{ id: 'o0', kind: 'body', lines: [line('32:1', 'Beta opening sentence here. 4242')] }];

function noRepeat(spoken) {
  for (let i = 1; i < spoken.length; i++) if (spoken[i] === spoken[i - 1]) return false;
  return true;
}

/**
 * 리더 흉내 — 실제 `renderPage`·`goToPageForSpeech`·`whenCurrentPageReady` 와 같은 순서(아래 PT9 가 소스로 묶는다):
 *   go → (라우터, 비동기) state.page = n → renderPage: db.get(비동기) → token 검사 → stale·refreshing·**desc(그리기 앞)**
 *   → paintView(원본: 비동기 canvas — 테스트가 끝낸다 / 리플로우: 동기) → notifyPage = controls `reload()`
 *   → finally: refreshing 내림 → `renderDone.settled({docId, page})`(마지막 렌더만).
 * `[8i-3b]` 판정식(`speechPageReady`·`pageTurnCheck`·`freshWaitCheck`)은 복사본이 아니라 **실제 reader.js 의 것**을 import 해
 *   쓴다 — 판정식을 고치면 이 흉내의 PT3–PT8·PT12–PT13 이 함께 빨개진다. 호출 모양은 PT9 가 소스로 묶는다.
 * `legacyPoll` 이면 고치기 전 판(200 ms 폴링)으로 쪽 넘김을 기다린다 — 이 흉내가 그 버그를 재현하는지 대조용.
 */
function harness(o) {
  const opt = o || {};
  const view = opt.view || 'original';
  const synth = fakeSynth();
  const timers = fakeTimers();
  const done = createRenderDone(timers);
  const st = { docId: 'doc', page: 31, pageCount: 60, desc: PAGES[31], stale: false, refreshing: 0, token: 0, left: false };
  const paints = [];
  const pageOf = opt.pageOf || ((n) => PAGES[n] || null);
  const staleNext = new Set(opt.staleNext || []);
  let sp = null;

  async function renderPage(refresh) {
    const token = ++st.token;
    const docId = st.docId;
    const pageNo = st.page;
    if (refresh) st.refreshing = token;
    await Promise.resolve();                               // db.get
    if (token !== st.token) return;
    const old = !refresh && staleNext.has(pageNo);
    st.stale = old;
    st.refreshing = refresh ? token : 0;
    const paras = old ? OLD32 : pageOf(pageNo);
    if (!paras) { st.refreshing = 0; st.desc = null; done.settled({ docId: docId, page: pageNo }); return; }
    st.desc = paras;                                       // ★ 그리기 앞에서 선다
    if (view === 'original') await new Promise((res) => paints.push({ page: pageNo, refresh: !!refresh, finish: res }));
    else await Promise.resolve();                          // 리플로우 — 동기 그리기(async 함수의 한 틱)
    try {
      if (token !== st.token) return;
      sp.reload();                                         // notifyPage → controls 첫 구독자
      if (refresh) sp.reshow();
    } finally {
      if (token === st.token && st.refreshing === token) st.refreshing = 0;
      if (token === st.token) done.settled({ docId: docId, page: pageNo });
    }
  }
  function go(n) {                                         // 해시 바뀜 → 라우터 → showReader (비동기)
    Promise.resolve().then(() => { if (st.left) return; st.page = n; renderPage(false); });
  }
  function goToPage(pageNo) {
    const target = pageNo;
    if (st.pageCount > 0 && Number(pageNo) > st.pageCount) return Promise.resolve(false);
    if (speechPageReady(st, target, pageFresh(st))) return Promise.resolve(true);
    if (opt.legacyPoll) {
      return new Promise((resolve) => {
        let fin = false;
        const end = (v) => { if (!fin) { fin = true; resolve(v); } };
        timers.setTimeout(() => end(false), TTS.PAGE_WAIT_MS);
        const poll = () => {
          if (fin) return;
          if (speechPageReady(st, target, pageFresh(st))) { end(true); return; }
          timers.setTimeout(poll, LEGACY_POLL_MS);
        };
        timers.setTimeout(poll, LEGACY_POLL_MS);
        go(target);
      });
    }
    const docId = st.docId;
    const waiting = done.wait((r) => pageTurnCheck(st, pageFresh(st), r, docId, target), TTS.PAGE_WAIT_MS);
    go(target);
    return waiting;
  }
  function whenReady() {
    if (pageFresh(st)) return Promise.resolve(true);
    const docId = st.docId;
    const page = st.page;
    return done.wait(() => freshWaitCheck(st, pageFresh(st), docId, page), TTS.FRESH_WAIT_MS);
  }
  function leave() {                                       // leaveReader — speaker 를 멈추고 상태를 비운 뒤 알린다
    st.left = true;
    sp.stop();
    st.desc = null; st.stale = false; st.refreshing = 0;
    done.settled({ docId: st.docId, page: null });
  }

  const errors = [];
  sp = createSpeaker({
    synth: synth,
    timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => st.desc || [],
      page: () => ({ page: st.page, pageCount: st.pageCount }),
      goToPage: goToPage,
      show: () => true,
      markDone: () => { },
      ready: () => pageFresh(st),
      whenReady: whenReady,
      remapLine: (id) => id,
      highlight: () => true
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  sp.addEventListener('error', (ev) => errors.push((ev.detail || {}).code));
  sp.reload();
  return { sp, synth, timers, done, st, paints, renderPage, goToPage, whenReady, leave, errors, go, view };
}

/** 31쪽 마지막 문장을 다 읽게 해 쪽 끝 → 다음 쪽 요청까지. */
async function readToPageEnd(h) {
  h.sp.play();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.']);
  h.synth.finish();
  await settle();
  if (h.view === 'original') assert.equal(h.sp.getState(), 'waiting-page');
}

/* ══ 대기열 자체 ═══════════════════════════════════════ */

test('PT1 renderDone — 알림마다 판정: true/false 면 풀고, undefined 면 계속 기다린다. 상한 뒤 false, 풀린 뒤 알림은 무시', async () => {
  const t = fakeTimers();
  const d = createRenderDone(t);
  let seen = [];
  const a = d.wait((r) => { seen.push(r.page); return r.page === 3 ? true : undefined; }, 1000);
  const b = d.wait((r) => (r.page === 2 ? false : undefined), 1000);
  const c = d.wait(() => undefined, 1000);
  const e = d.wait(() => { throw new Error('x'); }, 1000);
  assert.equal(d.size(), 4);
  d.settled({ page: 2 });
  assert.equal(await b, false);
  assert.equal(await e, false, '판정이 던지면 거짓으로 푼다');
  assert.equal(d.size(), 2);
  d.settled({ page: 3 });
  assert.equal(await a, true);
  assert.deepEqual(seen, [2, 3]);
  d.settled({ page: 3 });
  assert.deepEqual(seen, [2, 3], '풀린 뒤에도 판정했다');
  t.advance(999);
  assert.equal(d.size(), 1);
  t.advance(1);
  assert.equal(await c, false, '상한');
  assert.equal(d.size(), 0, '상한 뒤 대기열에 남았다');
  d.settled({ page: 9 });                                  // 빈 대기열 — 아무 일 없다
});

/* ══ 쪽 넘김 ═══════════════════════════════════════════ */

test('PT2 대조 — 고치기 전(200 ms 폴링)이면 같은 흉내에서 다음 쪽 첫 문장이 끊기고 처음부터 다시 나온다(원본 보기, 그리기 > 폴링 틱)', async () => {
  const h = harness({ view: 'original', legacyPoll: true });
  await readToPageEnd(h);
  assert.equal(h.paints.length, 1, '32쪽을 그리는 중');
  h.timers.advance(LEGACY_POLL_MS);                       // canvas 가 폴링 틱보다 늦다
  await settle();
  assert.deepEqual(h.synth.spoken.slice(1), ['Beta opening sentence here.'], '폴링이 그리기 도중에 풀렸다(버그 재현)');
  h.paints[0].finish();                                     // canvas 다 그림 → notifyPage → reload → restart
  await settle();
  h.timers.advance(200);
  assert.deepEqual(h.synth.cut, ['Beta opening sentence here.'], '첫 문장이 끊겼다');
  assert.equal(noRepeat(h.synth.spoken), false, '같은 문장이 연달아 나온다');
});

test('PT3 ★ 원본 보기 쪽 넘김 — 그리는 동안(폴링 틱을 넘겨도) 말하지 않고, 그리기·notifyPage 뒤 다음 쪽 첫 문장 1번, 끊긴 발화 0', async () => {
  const h = harness({ view: 'original' });
  await readToPageEnd(h);
  assert.equal(h.paints.length, 1);
  assert.equal(h.st.desc, PAGES[32], 'desc 는 그리기 앞에서 이미 섰다(이 틈이 문제였다)');
  h.timers.advance(LEGACY_POLL_MS * 5);
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '그리기 도중에 다음 쪽을 말하기 시작했다');
  assert.equal(h.sp.getState(), 'waiting-page');
  h.paints[0].finish();
  await settle();
  assert.equal(h.sp.getState(), 'speaking');
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.', 'Beta opening sentence here.']);
  assert.deepEqual(h.synth.cut, [], '시작 직후 끊긴 발화가 있다');
  h.synth.finish();
  await settle();
  assert.deepEqual(h.synth.spoken.slice(-1), ['Beta second sentence here.']);
  assert.ok(noRepeat(h.synth.spoken), JSON.stringify(h.synth.spoken));
  assert.equal(h.done.size(), 0);
});

test('PT4 ★ 리플로우 쪽 넘김 — 지연 없음: 시계를 한 틱도 돌리지 않아도 렌더 끝에서 바로 다음 쪽 첫 문장', async () => {
  const h = harness({ view: 'reflow' });
  const t0 = h.timers.now();
  await readToPageEnd(h);
  assert.equal(h.timers.now(), t0, '가짜 시계가 움직였다');
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.', 'Beta opening sentence here.'], '폴링 틱(200 ms)을 기다렸다');
  assert.equal(h.sp.getState(), 'speaking');
  assert.deepEqual(h.synth.cut, []);
  // 대조 — 폴링 판은 리플로우에서도 틱을 기다렸다
  const L = harness({ view: 'reflow', legacyPoll: true });
  L.sp.play();
  L.synth.finish();
  await settle();
  assert.deepEqual(L.synth.spoken, ['Alpha closing sentence here.'], '대조: 폴링 판은 틱 전에 풀리지 않는다');
  L.timers.advance(LEGACY_POLL_MS);
  await settle();
  assert.deepEqual(L.synth.spoken.slice(1), ['Beta opening sentence here.']);
});

test('PT5 상한 — 그리기가 PAGE_WAIT_MS 안에 끝나지 않으면 전처럼 paused + TTS_PAGE_TIMEOUT, 뒤늦게 끝나도 말하지 않는다', async () => {
  const h = harness({ view: 'original' });
  await readToPageEnd(h);
  h.timers.advance(TTS.PAGE_WAIT_MS - 1);
  await settle();
  assert.equal(h.sp.getState(), 'waiting-page');
  h.timers.advance(1);
  await settle();
  assert.equal(h.sp.getState(), 'paused');
  assert.ok(h.errors.includes('TTS_PAGE_TIMEOUT'), JSON.stringify(h.errors));
  assert.equal(h.done.size(), 0, '상한 뒤 대기열에 남았다');
  h.paints[0].finish();
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '상한 뒤 늦은 그리기가 낭독을 시작했다');
});

test('PT6 버려진 렌더 — 같은 쪽을 다시 그리기 시작해 앞 렌더가 버려지면 그 끝은 풀지 않고, 마지막 렌더 끝에 한 번', async () => {
  const h = harness({ view: 'original' });
  await readToPageEnd(h);
  h.renderPage(false);                                       // 뷰 갱신 등으로 32쪽 렌더가 하나 더 — 앞 렌더는 버려진다
  await settle();
  assert.equal(h.paints.length, 2);
  h.paints[0].finish();                                      // 버려진 렌더의 canvas 끝
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '버려진 렌더 끝에서 풀렸다');
  h.paints[1].finish();
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.', 'Beta opening sentence here.']);
  assert.deepEqual(h.synth.cut, []);
});

test('PT7 다른 쪽으로 감 · 리더를 떠남 — 그 렌더의 끝은 풀지 않는다 → 전처럼 상한 뒤 false(paused)', async () => {
  const h = harness({ view: 'original' });
  await readToPageEnd(h);
  h.st.page = 40;                                            // 사용자가 40쪽으로
  h.renderPage(false);
  await settle();
  h.paints[1].finish();
  h.paints[0].finish();
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '다른 쪽 렌더 끝에 풀렸다');
  h.timers.advance(TTS.PAGE_WAIT_MS);
  await settle();
  assert.equal(h.sp.getState(), 'paused');

  // 떠남 — 기다리던 쪽 넘김은 desc 가 없어 풀리지 않는다(speaker 는 이미 멈춤)
  const g = harness({ view: 'original' });
  const p = g.goToPage(32);
  g.leave();
  await settle();
  let v = null;
  p.then((x) => { v = x; });
  await settle();
  assert.equal(v, null, '떠난 알림에 쪽 넘김이 풀렸다');
  g.timers.advance(TTS.PAGE_WAIT_MS);
  await settle();
  assert.equal(v, false);
  assert.equal(g.done.size(), 0);
});

test('PT8 8i-1 — 다음 쪽이 옛 판이면 평소 렌더 끝(stale)에 풀리지 않고, 새 판 다시 그리기가 refreshing 을 내린 뒤 1번', async () => {
  const h = harness({ view: 'original', staleNext: [32] });
  await readToPageEnd(h);
  h.paints[0].finish();                                      // 옛 판 32쪽 다 그림
  await settle();
  assert.equal(h.st.stale, true);
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '옛 판에서 풀렸다');
  h.renderPage(true);                                        // 문지기 → 새 판 다시 그리기
  await settle();
  assert.equal(h.st.stale, false);
  assert.ok(h.st.refreshing > 0);
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '다시 그리는 도중에 풀렸다');
  h.paints[1].finish();
  await settle();
  assert.equal(h.st.refreshing, 0);
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.', 'Beta opening sentence here.']);
  assert.deepEqual(h.synth.cut, []);
  assert.ok(h.synth.spoken.every((t) => !/4242/.test(t)), '옛 읽기가 나왔다');
});

test('PT8b whenCurrentPageReady 도 알림으로 — 다시 그리기 끝에 true, 다른 쪽 렌더 끝에 false, 떠나면 그때 상태로(전과 같음)', async () => {
  const h = harness({ view: 'original' });
  h.st.stale = true;
  const a = h.whenReady();
  h.renderPage(true);
  await settle();
  let va = null;
  a.then((x) => { va = x; });
  await settle();
  assert.equal(va, null, '다시 그리는 도중에 풀렸다');
  h.paints[0].finish();
  await settle();
  assert.equal(va, true);

  const g = harness({ view: 'original' });
  g.st.stale = true;
  const b = g.whenReady();
  g.st.page = 33;
  g.renderPage(false);
  await settle();
  g.paints[0].finish();
  assert.equal(await b, false, '다른 쪽으로 갔는데 false 가 아니다');

  const k = harness({ view: 'original' });
  k.st.stale = true;
  const c = k.whenReady();
  k.leave();
  assert.equal(await c, true, '떠난 순간 지금 쪽(같은 쪽·옛 판 아님) — 폴링 판과 같은 값');
});

/* ══ 8i-3b 판정식 — 실제 reader.js 의 순수 함수 ═════════ */

test('PT12 ★ 쪽 넘김 판정식 표 — 자리표시자(desc 없음)·다른 문서·다른 쪽·옛 판·다시 그리는 중이면 안 풀림, 정상이면 풀림', () => {
  const ok = { docId: 'doc', page: 32, desc: PAGES[32], stale: false, refreshing: 0 };
  const r = { docId: 'doc', page: 32 };
  const check = (st, rr) => pageTurnCheck(st, pageFresh(st), rr || r, 'doc', 32);
  const ready = (st) => speechPageReady(st, 32, pageFresh(st));
  const rows = [
    ['정상', ok, undefined, true, true],
    ['자리표시자 쪽(desc 없음)', { ...ok, desc: null }, undefined, undefined, false],
    ['다른 문서의 렌더 끝', ok, { docId: 'other', page: 32 }, undefined, true],
    ['다른 쪽의 렌더 끝', ok, { docId: 'doc', page: 33 }, undefined, true],
    ['리더가 다른 쪽에 있음', { ...ok, page: 33 }, undefined, undefined, false],
    ['옛 판(stale)', { ...ok, stale: true }, undefined, undefined, false],
    ['다시 그리는 중(refreshing)', { ...ok, refreshing: 7 }, undefined, undefined, false],
    ['떠난 알림(page null)', { ...ok, desc: null }, { docId: 'doc', page: null }, undefined, false]
  ];
  for (const [name, st, rr, want, wantReady] of rows) {
    assert.equal(check(st, rr), want, name);
    assert.equal(ready(st), wantReady, name + ' (바로 풀기)');
  }
  // 판정은 true 아니면 undefined 뿐 — 쪽 넘김 대기는 판정으로 거짓을 내지 않는다(상한 뒤에만 false)
  assert.equal(pageTurnCheck(ok, false, r, 'doc', 32), undefined, 'fresh 거짓인데 풀렸다');
  assert.equal(speechPageReady(ok, 32, false), false);
  assert.equal(speechPageReady(ok, '32', true), false, '쪽 번호는 같은 값·같은 꼴이어야 한다(===)');
});

test('PT12b 새 판 대기 판정식 표 — 다른 문서·다른 쪽이면 false, 최신이면 true, 옛 판·다시 그리는 중이면 계속 기다림', () => {
  const st = { docId: 'doc', page: 32, desc: PAGES[32], stale: false, refreshing: 0 };
  const check = (s) => freshWaitCheck(s, pageFresh(s), 'doc', 32);
  assert.equal(check(st), true);
  assert.equal(check({ ...st, desc: null }), true, '자리표시자 쪽은 새 판 대기를 막지 않는다(전과 같음)');
  assert.equal(check({ ...st, stale: true }), undefined);
  assert.equal(check({ ...st, refreshing: 3 }), undefined);
  assert.equal(check({ ...st, docId: 'other' }), false);
  assert.equal(check({ ...st, page: 33 }), false);
  assert.equal(check({ ...st, page: 33, stale: true }), false, '떠났으면 옛 판이어도 false');
});

test('PT13 ★ 다음 쪽이 자리표시자(아직 추출 안 됨)면 그 렌더 끝에 풀리지 않고 상한까지 기다린다 — 건너뛰지 않는다', async () => {
  let extracted = false;
  const h = harness({ view: 'original', pageOf: (n) => (n === 32 && !extracted ? null : PAGES[n] || null) });
  await readToPageEnd(h);
  assert.equal(h.st.page, 32);
  assert.equal(h.st.desc, null, '32쪽은 자리표시자');
  assert.equal(h.paints.length, 0, '자리표시자는 그리지 않는다');
  assert.equal(h.done.size(), 1, '자리표시자 렌더 끝에 대기가 풀렸다');
  h.timers.advance(TTS.PAGE_WAIT_MS - 1);
  await settle();
  assert.equal(h.sp.getState(), 'waiting-page');
  assert.equal(h.st.page, 32, '다음 쪽을 건너뛰었다');
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '자리표시자에서 풀려 다음 쪽을 건너뛰었다');
  h.timers.advance(1);
  await settle();
  assert.equal(h.sp.getState(), 'paused');
  assert.ok(h.errors.includes('TTS_PAGE_TIMEOUT'), JSON.stringify(h.errors));
  assert.equal(h.st.page, 32);
  assert.equal(h.done.size(), 0);
});

test('PT13b 자리표시자 렌더 끝에는 안 풀림 → 추출 뒤 그 쪽 렌더 끝(그리기·notifyPage 뒤)에 풀려 그 쪽 첫 문장 1번', async () => {
  let extracted = false;
  const h = harness({ view: 'original', pageOf: (n) => (n === 32 && !extracted ? null : PAGES[n] || null) });
  await readToPageEnd(h);
  h.timers.advance(TTS.PAGE_WAIT_MS / 2);
  await settle();
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.']);
  extracted = true;                                          // 추출기가 32쪽을 저장 → renderPage
  h.renderPage(false);
  await settle();
  assert.equal(h.paints.length, 1);
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.'], '그리기 도중에 풀렸다');
  h.paints[0].finish();
  await settle();
  assert.equal(h.sp.getState(), 'speaking');
  assert.deepEqual(h.synth.spoken, ['Alpha closing sentence here.', 'Beta opening sentence here.']);
  assert.deepEqual(h.synth.cut, []);
  assert.equal(h.done.size(), 0);
});

test('PT14 TTS.PAGE_POLL_MS 는 앱 설정에서 빠졌다(쪽 넘김은 폴링하지 않는다 — 대조 흉내는 지역 상수)', () => {
  assert.equal(TTS.PAGE_POLL_MS, undefined);
  assert.equal(typeof TTS.PAGE_WAIT_MS, 'number');
  assert.equal(LEGACY_POLL_MS, 200);
});

/* ══ 실제 소스가 흉내와 같은 순서인가 ════════════════ */

const READER = readFileSync(new URL('../js/ui/reader.js', import.meta.url), 'utf8');
const CONTROLS = readFileSync(new URL('../js/ui/controls.js', import.meta.url), 'utf8');

function exportedFn(src, name) {
  const i = src.indexOf('export function ' + name + '(');
  assert.ok(i >= 0, name);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, name);
  return src.slice(i, j);
}

test('PT9 ★ 리더 소스 — 쪽 넘김·새 판 대기는 폴링 없이 renderDone.wait, renderPage 는 notifyPage·refreshing 내림 뒤 마지막 렌더만 알린다', () => {
  const go = exportedFn(READER, 'goToPageForSpeech');
  assert.ok(!/setInterval|setTimeout|PAGE_POLL_MS/.test(go), '쪽 넘김이 아직 폴링한다');
  assert.ok(go.indexOf('renderDone.wait(') > 0, '쪽 넘김이 렌더 끝 알림을 기다리지 않는다');
  assert.ok(go.indexOf('TTS.PAGE_WAIT_MS') > go.indexOf('renderDone.wait('), '상한이 없다');
  assert.ok(go.indexOf('renderDone.wait(') < go.indexOf('go(readerHash('), '알림 대기를 쪽 이동보다 먼저 걸어야 한다');
  // `[8i-3b]` 판정식은 흉내와 **같은** 순수 함수 — 바로 풀기·렌더 끝 판정 모두(PT12·PT13 이 그 함수를 직접 잰다)
  assert.ok(go.includes('if (speechPageReady(state, target, pageFresh(state))) return Promise.resolve(true);'), '바로 풀기가 speechPageReady 가 아니다');
  assert.ok(go.includes('renderDone.wait((r) => pageTurnCheck(state, pageFresh(state), r, docId, target), TTS.PAGE_WAIT_MS);'), '렌더 끝 판정이 pageTurnCheck 가 아니다');
  assert.ok(go.indexOf('const docId = state.docId;') < go.indexOf('renderDone.wait('), '기다리기 시작한 문서를 잡지 않는다');
  assert.match(exportedFn(READER, 'pageTurnCheck'), /if \(r\.docId !== docId \|\| r\.page !== target\) return undefined;/);

  const wr = exportedFn(READER, 'whenCurrentPageReady');
  assert.ok(!/setInterval|setTimeout|PAGE_POLL_MS/.test(wr), '새 판 대기가 아직 폴링한다');
  assert.ok(wr.indexOf('renderDone.wait(') > 0);
  assert.ok(wr.includes('return renderDone.wait(() => freshWaitCheck(state, pageFresh(state), docId, page), ms);'), '새 판 대기 판정이 freshWaitCheck 가 아니다');
  assert.match(exportedFn(READER, 'freshWaitCheck'), /st\.docId !== docId \|\| st\.page !== page\) return false/);

  const a = READER.indexOf('async function renderPage(');
  const b = READER.indexOf('function catchUpStale(', a);
  const body = READER.slice(a, b);
  const at = (s) => { const i = body.indexOf(s); assert.ok(i >= 0, '없다: ' + s); return i; };
  const settle = 'if (token === state.renderToken) renderDone.settled({ docId: docId, page: pageNo });';
  assert.ok(at('state.desc = desc;') < at('await paintView(token);'));
  assert.ok(at('await paintView(token);') < at('notifyPage(cap ? { refreshed: true } : null);'));
  assert.ok(at('notifyPage(cap ? { refreshed: true } : null);') < at('} finally {'));
  assert.ok(at('state.refreshing === token) state.refreshing = 0;') < at(settle), '알림이 refreshing 내림보다 앞이다');
  assert.ok(at('} finally {') < at(settle));
  assert.equal(body.split('renderDone.settled(').length - 1, 4, 'db 오류·저장본 없음·깨짐·끝 — 네 곳');
  // 버려진 렌더 갈래(token 검사 return)에는 알림이 없다
  const drop = body.indexOf('if (token !== state.renderToken) return;');
  assert.ok(drop > 0);
  assert.ok(!/renderDone/.test(body.slice(drop, body.indexOf('\n', drop))));

  // `[8g-4b — 8g-4a Review F3]` 정말 떠나는 몸통은 `leaveReaderNow`(숨은 리더에서 다른 책으로 갈 때도 같은 길)
  assert.ok(exportedFn(READER, 'leaveReader').includes('leaveReaderNow();'));
  const lvi = READER.indexOf('function leaveReaderNow(');
  assert.ok(lvi > 0);
  const lv = READER.slice(lvi, READER.indexOf('\n}\n', lvi));
  assert.ok(lv.indexOf('state.refreshing = 0;') < lv.indexOf('renderDone.settled('), '떠날 때 상태를 비운 뒤 알려야 한다');
});

test('PT10 ★ 배선(8i-1 Review R3) — 추출기 page 이벤트가 문지기 saved 로 간다(자리표시자 갈래 뒤)', () => {
  const a = READER.indexOf('async function wireExtractor(');
  const b = READER.indexOf('\nfunction unwire(', a);
  assert.ok(a > 0 && b > a);
  const body = READER.slice(a, b);
  const i = body.indexOf('const onPage = (e) => {');
  assert.ok(i > 0, 'onPage 가 없다');
  const j = body.indexOf('\n    };', i);
  const onPage = body.slice(i, j);
  assert.match(onPage, /refreshGate\.saved\(docId, Number\(e\.detail\.pageNo\)\);/, 'page 이벤트가 문지기에 가지 않는다');
  assert.ok(onPage.indexOf('renderPage(); return;') < onPage.indexOf('refreshGate.saved('));
  assert.match(body, /ex\.addEventListener\('page', onPage\);/, 'page 리스너를 붙이지 않는다');
  assert.match(body, /catchUpStale\(\);/);
});

test('PT11 ★ 배선(8i-1 Review R4) — speaker 상태 변화가 문지기 speech 로 간다(controls → setSpeechState → refreshGate.speech)', () => {
  const i = CONTROLS.indexOf("speaker.addEventListener('statechange', () => {");
  assert.ok(i > 0, 'statechange 구독이 없다');
  const j = CONTROLS.indexOf('\n  });', i);
  const sub = CONTROLS.slice(i, j);
  assert.match(sub, /setSpeechState\(speaker\.getState\(\)\);/, 'speaker 상태가 문지기에 가지 않는다');
  assert.match(CONTROLS, /import \{[^}]*\bsetSpeechState\b[^}]*\} from '\.\/reader\.js'/);
  assert.match(exportedFn(READER, 'setSpeechState'), /refreshGate\.speech\(st\)/);
  // 쪽 넘김·새 판 대기도 리더의 것을 쓴다
  assert.match(CONTROLS, /goToPage: goToPageForSpeech,/);
  assert.match(CONTROLS, /whenReady: function \(\) \{ return whenCurrentPageReady\(\); \}/);
});
