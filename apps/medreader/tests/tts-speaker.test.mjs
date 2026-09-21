/* ============================================================
   tests/tts-speaker.test.mjs — spec 6-1 전이표 · 6-2 체이닝·워치독 · 6-4

   ★ 이 파일의 존재 이유는 **데스크톱에서 재현되지 않는 것을 검증**하는
     것이다. Android Chrome 의 버그들(onend 유실·cancel 후 speak 씹힘·
     pause 후 재개 불가)은 데스크톱 Chrome 에서 일어나지 않는다. 그래서
     `speechSynthesis` 를 **스텁으로 갈아** 그 상황을 인위로 만든다.

     그중 제일 중요한 것이 **S8 — onend 가 오지 않을 때 워치독이 실제로
     다음 발화로 넘어가는가**다. 그것이 이 단계의 최후 방어선이다.

   시간은 **가짜 타이머**로 감는다(워치독이 26초짜리라 실시간으로는 못 센다).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createSpeaker, CODES } from '../js/tts/speaker.js';
import { watchdogMs } from '../js/tts/text.js';
import { TTS } from '../js/config.js';

/* ── 가짜 시계 ────────────────────────────────────────── */
function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
    clearTimeout: (k) => { jobs.delete(k); },
    /** `ms` 만큼 시간을 감는다. 그 사이에 걸린 일들을 **시각 순서대로** 돌린다. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null;
        let key = null;
        for (const [k, j] of jobs) {
          if (j.at <= target && (pick === null || j.at < pick.at)) { pick = j; key = k; }
        }
        if (!pick) break;
        jobs.delete(key);
        now = pick.at;
        pick.fn();
      }
      now = target;
    },
    pending: () => jobs.size
  };
}

/* ── 가짜 음성 엔진 ───────────────────────────────────── */
function fakeSynth() {
  const s = {
    speaking: false,
    pending: false,
    spoken: [],          // speak() 가 받은 텍스트들
    pauseCalls: 0,       // ★ 6-4 (1) — 0 이어야 한다
    cancelCalls: 0,
    current: null,
    speak(u) { s.speaking = true; s.current = u; s.spoken.push(u.text); },
    pause() { s.pauseCalls++; },
    resume() { s.pauseCalls++; },
    cancel() {
      s.cancelCalls++;
      const u = s.current;
      s.speaking = false;
      s.current = null;
      // 진짜 엔진처럼 취소된 발화에 onerror('canceled') 를 준다.
      if (u && u.onerror) u.onerror({ error: 'canceled' });
    },
    /** 엔진이 발화를 끝냈다. */
    finish() {
      const u = s.current;
      s.speaking = false;
      s.current = null;
      if (u && u.onend) u.onend();
    },
    /** 엔진이 오류를 냈다. */
    fail(code) {
      const u = s.current;
      s.speaking = false;
      s.current = null;
      if (u && u.onerror) u.onerror({ error: code });
    }
  };
  return s;
}

function line(id, text, hyphen) { return { id: id, text: text, hyphen: hyphen || 'none' }; }

/** 기본 두 쪽짜리 문서. 1쪽에 두 문장, 2쪽에 한 문장. */
function makeView(opts) {
  const o = opts || {};
  const pages = o.pages || {
    1: [{ id: 'p1', kind: 'body', lines: [line('1:1', 'First one here.'), line('1:2', 'Second one here.')] }],
    2: [{ id: 'p2', kind: 'body', lines: [line('2:1', 'Third one here.')] }]
  };
  const v = {
    page: 1,
    pageCount: o.pageCount === undefined ? 2 : o.pageCount,
    shown: [],
    done: [],
    gotoOk: o.gotoOk === undefined ? true : o.gotoOk,
    paras() { return pages[v.page] || []; },
    page_() { return { page: v.page, pageCount: v.pageCount }; },
    goToPage(n) {
      if (!v.gotoOk) return Promise.resolve(false);
      v.page = n;
      return Promise.resolve(true);
    },
    show(u) { v.shown.push(u.lineIds.join(',')); return true; },
    markDone(u) { v.done.push(u.lineIds.join(',')); }
  };
  return v;
}

function build(opts) {
  const o = opts || {};
  const synth = o.synth || fakeSynth();
  const timers = o.timers || fakeTimers();
  const view = o.view || makeView(o.viewOpts);
  const events = [];
  const sp = createSpeaker({
    synth: synth,
    timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => view.paras(),
      page: () => view.page_(),
      goToPage: (n) => view.goToPage(n),
      show: (u) => view.show(u),
      markDone: (u) => view.markDone(u)
    },
    requestWakeLock: o.requestWakeLock || (() => Promise.resolve({ release() { } }))
  });
  for (const type of ['linechange', 'statechange', 'end', 'error']) {
    sp.addEventListener(type, (ev) => events.push({ type: type, detail: ev.detail }));
  }
  return { sp: sp, synth: synth, timers: timers, view: view, events: events };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/* ══ 6-1 전이표 ═══════════════════════════════════════ */

test('S1 idle → play() → speaking. 첫 speak 는 **즉시** 나간다 (6-4 (5) 사용자 제스처)', () => {
  const h = build();
  h.sp.play();
  // 타이머를 감지 않았는데도 이미 말하고 있어야 한다 — 탭 핸들러 안이므로.
  assert.equal(h.synth.spoken.length, 1);
  assert.equal(h.synth.spoken[0], 'First one here.');
  assert.equal(h.sp.getState(), 'speaking');
});

test('S2 ★ onend 체이닝 — 큐를 한 번에 쌓지 않고 항상 발화 1개다 (6-2)', () => {
  const h = build();
  h.sp.play();
  assert.equal(h.synth.spoken.length, 1, '큐를 미리 쌓았다');
  h.synth.finish();
  assert.deepEqual(h.synth.spoken, ['First one here.', 'Second one here.']);
  assert.deepEqual(h.view.done, ['1:1'], '읽은 줄 표시가 빠졌다');
});

test('S3 ★ 6-4 (1) — pause() 는 speechSynthesis.pause() 를 쓰지 않는다. cancel 이다', () => {
  const h = build();
  h.sp.play();
  h.sp.pause();
  assert.equal(h.synth.pauseCalls, 0, 'speechSynthesis.pause() 를 불렀다 — Android 에서 재개 불가');
  assert.ok(h.synth.cancelCalls > 0);
  assert.equal(h.sp.getState(), 'paused');
});

test('S4 ★ 재개는 같은 발화 처음부터 (6-1 · 6-4 (1))', () => {
  const h = build();
  h.sp.play();
  h.synth.finish();                       // 두 번째 발화 중
  assert.equal(h.sp.getIndex(), 1);
  h.sp.pause();
  h.sp.resume();
  h.timers.advance(TTS.CANCEL_DELAY_MS);  // cancel 뒤 60ms
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'Second one here.');
});

test('S5 ★ 6-4 (4) — cancel 직후의 speak 는 60ms 뒤에 나간다', () => {
  const h = build();
  h.sp.play();
  const before = h.synth.spoken.length;
  h.sp.next();
  assert.equal(h.synth.spoken.length, before, 'cancel 직후에 바로 speak 했다 — Android 에서 씹힌다');
  h.timers.advance(TTS.CANCEL_DELAY_MS - 1);
  assert.equal(h.synth.spoken.length, before);
  h.timers.advance(1);
  assert.equal(h.synth.spoken.length, before + 1);
});

test('S6 next()/prev() — paused 면 paused 를 유지하고 하이라이트만 옮긴다 (6-1)', () => {
  const h = build();
  h.sp.play();
  h.sp.pause();
  const spokenBefore = h.synth.spoken.length;
  h.sp.next();
  h.timers.advance(1000);
  assert.equal(h.sp.getState(), 'paused', 'paused 인데 말하기 시작했다');
  assert.equal(h.synth.spoken.length, spokenBefore);
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.view.shown[h.view.shown.length - 1], '1:2', '하이라이트가 안 움직였다');
  h.sp.prev();
  assert.equal(h.sp.getIndex(), 0);
});

test('S7 setRate — 즉시 적용된다 (같은 줄을 cancel 후 다시)', () => {
  const h = build();
  h.sp.play();
  h.sp.setRate(1.5);
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.sp.getRate(), 1.5);
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'First one here.');
});

/* ══ 6-2 워치독 — 이 단계의 최후 방어선 ═══════════════ */

test('S8 ★★ onend 가 오지 않으면 워치독이 다음 발화로 넘긴다 (16-C [D])', () => {
  const h = build();
  h.sp.simulateStall();          // 다음 발화의 onend·onerror 를 끊는다
  h.sp.play();
  assert.equal(h.synth.spoken.length, 1);

  const limit = watchdogMs('First one here.', 1);
  h.timers.advance(limit - 10);
  assert.equal(h.synth.spoken.length, 1, '아직 넘어가면 안 된다');

  h.timers.advance(10 + TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.spoken.length, 2, '워치독이 돌지 않았다 — 낭독이 영원히 멈춘다');
  assert.equal(h.synth.spoken[1], 'Second one here.');
  assert.equal(h.sp.getState(), 'speaking');
});

test('S9 워치독은 정상 발화를 가로채지 않는다 (onend 가 오면 해제된다)', () => {
  const h = build();
  h.sp.play();
  h.synth.finish();              // 정상 종료 → 워치독 해제
  const spoken = h.synth.spoken.length;
  h.timers.advance(10 * 60 * 1000);
  assert.equal(h.synth.spoken.length, spoken, '해제됐어야 할 워치독이 다시 말했다');
});

test('S10 ★ 취소된 발화의 늦은 onend 가 새 발화를 죽이지 않는다 (세대 검사)', () => {
  const h = build();
  h.sp.play();
  const stale = h.synth.current;
  h.sp.next();
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  const spoken = h.synth.spoken.length;
  if (stale.onend) stale.onend();          // 뒤늦게 도착한 옛 onend
  assert.equal(h.synth.spoken.length, spoken, '늦은 onend 가 큐를 한 칸 더 밀었다');
  assert.equal(h.sp.getIndex(), 1);
});

/* ══ 6-2 오류 처리 ════════════════════════════════════ */

test('S11 interrupted·canceled 는 무시한다 (우리가 취소한 것이다)', () => {
  const h = build();
  h.sp.play();
  h.synth.fail('interrupted');
  h.timers.advance(1000);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.events.filter((e) => e.type === 'error').length, 0);
});

test('S12 not-allowed → error 상태 + TTS_NOT_ALLOWED (제스처 없이 시작)', () => {
  const h = build();
  h.sp.play();
  h.synth.fail('not-allowed');
  assert.equal(h.sp.getState(), 'error');
  const err = h.events.filter((e) => e.type === 'error');
  assert.equal(err[err.length - 1].detail.code, CODES.NOT_ALLOWED);
});

test('S13 그 밖의 오류는 1회 재시도 후 다음 줄로 + TTS_LINE_SKIPPED', () => {
  const h = build();
  h.sp.play();

  h.synth.fail('synthesis-failed');
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'First one here.', '재시도하지 않았다');
  assert.equal(h.sp.getIndex(), 0);

  h.synth.fail('synthesis-failed');
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  const err = h.events.filter((e) => e.type === 'error');
  assert.equal(err[err.length - 1].detail.code, CODES.LINE_SKIPPED);
  assert.equal(h.sp.getIndex(), 1);
});

/* ══ 6-1 쪽 넘김 ══════════════════════════════════════ */

test('S14 ★ 쪽 끝에서 다음 쪽으로 이어진다', async () => {
  const h = build();
  h.sp.play();
  h.synth.finish();                       // → 두 번째 발화
  h.synth.finish();                       // → 쪽 끝
  assert.equal(h.sp.getState(), 'waiting-page');
  await tick();
  assert.equal(h.view.page, 2);
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.synth.spoken[h.synth.spoken.length - 1], 'Third one here.');
});

test('S15 마지막 쪽 끝 → end 이벤트, idle', async () => {
  const h = build({ viewOpts: { pageCount: 1 } });
  h.sp.play();
  h.synth.finish();
  h.synth.finish();
  await tick();
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.events.filter((e) => e.type === 'end').length, 1);
});

test('S16 다음 쪽이 5초 안에 준비되지 않으면 paused + TTS_PAGE_TIMEOUT', async () => {
  const h = build({ viewOpts: { gotoOk: false } });
  h.sp.play();
  h.synth.finish();
  h.synth.finish();
  await tick();
  assert.equal(h.sp.getState(), 'paused');
  const err = h.events.filter((e) => e.type === 'error');
  assert.equal(err[err.length - 1].detail.code, CODES.PAGE_TIMEOUT);
});

test('S17 쪽을 기다리는 중에 stop() 하면 새 쪽이 와도 말하지 않는다 (세대 검사)', async () => {
  let resolveGo = null;
  const view = makeView();
  view.goToPage = () => new Promise((r) => { resolveGo = r; });
  const h = build({ view: view });
  h.sp.play();
  h.synth.finish();
  h.synth.finish();
  assert.equal(h.sp.getState(), 'waiting-page');
  h.sp.stop();
  view.page = 2;
  resolveGo(true);
  await tick();
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.synth.spoken.length, 2, '멈췄는데 새 쪽을 읽기 시작했다');
});

/* ══ 6-5 · 6-1 그 밖 ══════════════════════════════════ */

test('S18 ★ 6-4 (7) — speak 직후 linechange 가 먼저 나간다 (onstart 가 안 와도)', () => {
  const h = build();
  h.sp.play();
  const lc = h.events.filter((e) => e.type === 'linechange');
  assert.equal(lc.length, 1);
  assert.equal(lc[0].detail.lineId, '1:1');
  assert.deepEqual(lc[0].detail.lineIds, ['1:1']);
  // onstart 가 뒤늦게 와도 같은 줄이면 중복 emit 하지 않는다
  if (h.synth.current.onstart) h.synth.current.onstart();
  assert.equal(h.events.filter((e) => e.type === 'linechange').length, 1);
});

test('S19 play(lineId) — 그 줄이 든 발화부터 (6-5 줄 탭)', () => {
  const h = build();
  h.sp.play('1:2');
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.synth.spoken[0], 'Second one here.');
});

test('S20 setUnit — 줄 모드로 바꿔도 지금 줄을 놓치지 않는다', () => {
  const h = build();
  h.sp.play();
  h.sp.setUnit('line');
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.sp.getUnit(), 'line');
  assert.ok(h.sp.getCurrent().lineIds.indexOf('1:1') >= 0);
});

test('S21 stop() — idle 로 돌아가고 큐를 버린다', () => {
  const h = build();
  h.sp.play();
  h.sp.stop();
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.sp.getTotal(), 0);
});

test('S22 낭독할 것이 없으면 조용히 end (빈 쪽에서 멈춘 것처럼 보이지 않게)', () => {
  const h = build({ viewOpts: { pages: { 1: [] }, pageCount: 1 } });
  h.sp.play();
  assert.equal(h.sp.getState(), 'idle');
  assert.equal(h.events.filter((e) => e.type === 'end').length, 1);
});

test('S23 Wake Lock 을 못 얻으면 코드만 낸다 — 낭독은 계속된다 (6-4)', async () => {
  const h = build({ requestWakeLock: () => Promise.resolve(null) });
  h.sp.play();
  assert.equal(h.sp.getState(), 'speaking');
  await tick();
  const err = h.events.filter((e) => e.type === 'error');
  assert.equal(err[err.length - 1].detail.code, CODES.WAKELOCK_UNAVAILABLE);
  assert.equal(h.sp.getState(), 'speaking', 'Wake Lock 실패가 낭독을 멈췄다');
});

test('S24 ★ 서비스 계층은 UI 문자열을 만들지 않는다 (3-2) — 이벤트에 코드만 있다', () => {
  const h = build({ requestWakeLock: () => Promise.reject(new Error('no')) });
  h.sp.play();
  h.synth.fail('not-allowed');
  for (const e of h.events) {
    if (e.type !== 'error') continue;
    assert.match(e.detail.code, /^TTS_[A-Z_]+$/, '코드가 아닌 것이 섞였다: ' + e.detail.code);
  }
});
