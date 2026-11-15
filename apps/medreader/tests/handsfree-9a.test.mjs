/* ============================================================
   tests/handsfree-9a.test.mjs — 9a 이어폰·잠금 화면 버튼 (spec 17-1-1 9절 H1–H10 · 10절)

   가짜 `mediaSession`·`MediaMetadata`·오디오 요소에 **진짜** `createSpeaker`(가짜 synth·가짜 시계 —
   tts-speaker.test.mjs 와 같은 방식)를 붙인다. 브라우저 전역(`navigator`·`document`)은 만지지 않는다(주입만).
   문장은 전부 지어낸 것이다.

   H1  actionFor 표 전수(상태 5 × 액션 5 × hidden 2 · seek 3 은 걸지 않음) · playbackStateOf
   H2  ★ play 핸들러는 동기 — 돌아온 직후 speaking · pressPlay 1번
   H3  ★ nexttrack — 번역 단계에서 다음 문장 원문 · 쪽 끝+읽는 중 → waiting-page(goToPage 1회) · 쪽 끝+멈춤 → 그대로
   H4  ★ hidden 중 액션 → speaker 호출 0 · 무시 카운터
   H5  ★ playbackState·무음 오디오가 statechange 를 따른다 · disarm 정리
   H6  ★ 재동기화 — 문장마다 한 번, 두 번째면 focusFights
   H7  ★ 멈춤 유지 Wake Lock — 액션 멈춤만 · tts.wakeLock=false · 재생/만료/숨김에서 풀기
   H8  silentWav 헤더·길이·무음 바이트
   H9  ★ 메타데이터 — 제목·"쪽 n / m"(4개 언어)·아트워크 · linechange 로는 다시 만들지 않는다
   H10 mediaSession 없음 · tts.mediaKeys=false · SESSION='none'
   P   9-D7 위치 막대 — 기본 'off' 는 setPositionState 0 · 'sentence' 갈래
   W   배선·계층 소스 — controls·reader·settings·i18n·speaker 0줄
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSpeaker } from '../js/tts/speaker.js';
import {
  createHandsfree, actionFor, playbackStateOf, silentWav, positionOf, isReading,
  ACTIONS, UNBOUND, ARTWORK, ALBUM
} from '../js/ui/handsfree.js';
import { HANDSFREE, TTS } from '../js/config.js';
import { DEFAULTS } from '../js/settings.js';
import { BUNDLES } from '../js/i18n/index.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const flush = () => new Promise((r) => setTimeout(r, 0));

/* ── 가짜 시계 · 엔진 (tts-speaker.test.mjs 와 같은 모양) ───────────── */

function fakeTimers() {
  let now = 0;
  let seq = 1;
  const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn: fn, at: now + (Number(ms) || 0) }); return k; },
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
    },
    pending: () => jobs.size
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    pause() { }, resume() { },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    texts() { return s.utt.map((u) => u.text); }
  };
  return s;
}

/** 번역 맵 스텁(speaker-tr.test.mjs 와 같다). */
function fakeTr(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    get: (u) => Object.assign({}, m.get(u.src) || { state: 'none' }),
    onChange: () => () => { }
  };
}

const P1 = ['Alpha is the first one.', 'Bravo comes after it.', 'Charlie ends this page.'];
const P2 = ['Delta opens the next page.'];
function line(id, text) { return { id: id, text: text, hyphen: 'none' }; }

function makeView() {
  const pages = {
    1: [{ id: 'p1', kind: 'body', lines: P1.map((t, i) => line('1:' + i, t)) }],
    2: [{ id: 'p2', kind: 'body', lines: P2.map((t, i) => line('2:' + i, t)) }]
  };
  const v = {
    page: 1, pageCount: 2, gotos: 0,
    paras: () => pages[v.page] || [],
    pageInfo: () => ({ page: v.page, pageCount: v.pageCount }),
    goToPage: (n) => { v.gotos++; v.page = n; return Promise.resolve(true); },
    show: () => true,
    markDone: () => { }
  };
  return v;
}

/* ── 가짜 Media Session · 메타데이터 · 오디오 ─────────────────────── */

function fakeMediaSession() {
  const m = {
    metadata: null, playbackState: 'none', handlers: {}, setCalls: [], positions: [],
    setActionHandler(a, f) { m.setCalls.push([a, typeof f === 'function']); m.handlers[a] = typeof f === 'function' ? f : null; },
    setPositionState(p) { m.positions.push(p); }
  };
  return m;
}

class FakeMeta {
  constructor(o) { Object.assign(this, o); FakeMeta.made++; }
}
FakeMeta.made = 0;

function audioFactory(opts) {
  const o = opts || {};
  const made = [];
  function make(bytes) {
    const ls = {};
    const a = {
      bytes: bytes, paused: true, loop: false, volume: 0.5, preload: 'none',
      src: 'blob:silent', attrs: { src: 'blob:silent' }, plays: 0, pauses: 0, loads: 0,
      addEventListener(t, f) { (ls[t] || (ls[t] = new Set())).add(f); },
      removeEventListener(t, f) { if (ls[t]) ls[t].delete(f); },
      emit(t) { for (const f of [...(ls[t] || [])]) f({ type: t }); },
      play() {
        a.plays++;
        if (o.reject) return Promise.reject(new Error('NotAllowedError'));
        a.paused = false;
        return Promise.resolve();
      },
      pause() { a.pauses++; if (!a.paused) { a.paused = true; a.emit('pause'); } },
      removeAttribute(n) { if (n === 'src') { delete a.attrs.src; a.src = ''; } },
      load() { a.loads++; },
      /** 다른 소리가 포커스를 가져갔다 — 우리가 부르지 않은 pause. */
      foreignPause() { a.paused = true; a.emit('pause'); }
    };
    made.push(a);
    return a;
  }
  return { make: make, made: made };
}

/**
 * 진짜 speaker + handsfree. `calls` 는 handsfree 가 부른 speaker 함수 수(H4).
 * `pressPlay` 는 controls 의 [▶] 본문과 같은 모양(스캔본 갈래·syncReadalong 은 화면 쪽 — 여기서는 동기 play 만).
 */
function harness(o) {
  const opt = o || {};
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = makeView();
  const sp = createSpeaker({
    synth: synth, timers: timers, makeUtterance: (text) => ({ text: text }),
    translation: opt.tr || null,
    view: {
      paras: () => view.paras(), page: () => view.pageInfo(), goToPage: (n) => view.goToPage(n),
      show: () => view.show(), markDone: () => view.markDone()
    },
    requestWakeLock: () => Promise.resolve({ release() { } })
  });
  if (opt.tr) { sp.setDocLang('en-US'); sp.setTrVoice('ar-SA', null); sp.setReadalong({ mode: 'speak', speakSource: true }); }
  const calls = { play: 0, pause: 0, next: 0, prev: 0, press: 0 };
  const spy = Object.assign({}, sp, {
    play: function (x) { calls.play++; return sp.play(x); },
    pause: function () { calls.pause++; return sp.pause(); },
    next: function () { calls.next++; return sp.next(); },
    prev: function () { calls.prev++; return sp.prev(); }
  });
  const pressPlay = () => {
    calls.press++;
    if (sp.getState() === 'speaking') sp.pause();
    else sp.play();
  };
  const ms = opt.noMediaSession ? null : fakeMediaSession();
  const audio = audioFactory(opt.audio);
  const env = { hidden: false, settings: Object.assign({}, opt.settings || {}), holds: [], locks: [], metaCalls: 0, lang: 'en' };
  const t = (k, p) => {
    let s = BUNDLES[env.lang][k];
    if (typeof s !== 'string') return k;
    for (const [n, v] of Object.entries(p || {})) s = s.split('{' + n + '}').join(String(v));
    return s;
  };
  const hf = createHandsfree({
    mediaSession: ms,
    MediaMetadata: opt.noMeta ? null : FakeMeta,
    makeAudio: audio.make,
    isHidden: () => env.hidden,
    speaker: spy,
    pressPlay: pressPlay,
    meta: () => { env.metaCalls++; return { title: 'Zorvat Handbook', page: view.page, pageCount: 1967 }; },
    t: t,
    formatNumber: (n) => String(n),
    holdWakeLock: (n) => {
      env.holds.push(n);
      const lock = { released: 0, release() { lock.released++; } };
      env.locks.push(lock);
      return Promise.resolve(lock);
    },
    getSetting: (k) => (Object.prototype.hasOwnProperty.call(env.settings, k) ? env.settings[k] : DEFAULTS[k]),
    timers: timers,
    config: opt.config
  });
  return { sp, synth, timers, view, ms, audio, env, hf, calls, press: () => calls.press };
}

/* ══ H1 actionFor 표 ════════════════════════════════════ */

test('H1 ★ actionFor 표 전수 — 상태 5 × 액션 5 × hidden 2 · seek 3 은 걸지 않음 · playbackStateOf', () => {
  const STATES = ['idle', 'speaking', 'paused', 'waiting-page', 'error'];
  const expect = {
    // 읽는 중(speaking·waiting-page)
    reading: { play: 'pause', pause: 'pause', nexttrack: 'next', previoustrack: 'prev', stop: 'pause' },
    // 멈춤·idle·error
    still: { play: 'play', pause: 'play', nexttrack: 'next', previoustrack: 'prev', stop: 'none' }
  };
  let n = 0;
  for (const s of STATES) {
    for (const a of ACTIONS) {
      const row = isReading(s) ? expect.reading : expect.still;
      assert.equal(actionFor(s, a, false), row[a], s + ' · ' + a);
      assert.equal(actionFor(s, a, true), 'ignore', s + ' · ' + a + ' · hidden');
      n += 2;
    }
    for (const a of UNBOUND) {
      assert.equal(actionFor(s, a, false), null, a + ' 는 걸지 않는다');
      assert.equal(actionFor(s, a, true), null);
    }
  }
  assert.equal(n, 50);
  assert.deepEqual([...ACTIONS], ['play', 'pause', 'previoustrack', 'nexttrack', 'stop']);
  assert.deepEqual([...UNBOUND], ['seekforward', 'seekbackward', 'seekto']);
  assert.equal(actionFor('speaking', 'skipad', false), null);
  assert.deepEqual(STATES.map(playbackStateOf), ['none', 'playing', 'paused', 'playing', 'paused']);
});

/* ══ H2 동기 ════════════════════════════════════════════ */

test('H2 ★ play 핸들러 — 돌아온 직후(시계를 감기 전) speaking · pressPlay 1번 · speak 1번 · 무음 오디오 play 1번', () => {
  const h = harness();
  assert.equal(h.hf.arm(), true);
  assert.equal(typeof h.ms.handlers.play, 'function');
  h.ms.handlers.play();
  assert.equal(h.sp.getState(), 'speaking', '★ 동기 — await 가 끼면 여기서 idle');
  assert.equal(h.press(), 1);
  assert.equal(h.synth.utt.length, 1, 'speak() 가 핸들러 안에서 나갔다');
  assert.equal(h.audio.made.length, 1);
  assert.equal(h.audio.made[0].plays, 1, '무음 오디오도 같은 호출 안에서');
  // pause 액션도 멈춤 상태에서는 재생(토글 — 9-D4)
  h.ms.handlers.pause();
  assert.equal(h.sp.getState(), 'paused');
  h.ms.handlers.pause();
  assert.equal(h.sp.getState(), 'speaking', 'pause 를 받아도 멈춤이면 재생');
  assert.equal(h.press(), 2);
});

/* ══ H3 nexttrack ════════════════════════════════════════ */

test('H3 ★ nexttrack — 번역 단계(tr) 중이면 그 번역을 건너뛰고 다음 문장 원문(단계 src)', () => {
  const ready = Object.fromEntries(P1.map((s) => [s, { state: 'ready', text: 'ترجمة ' + s.length }]));
  const h = harness({ tr: fakeTr(ready) });
  h.hf.arm();
  h.ms.handlers.play();
  h.synth.finish();                                       // 원문 끝 → 번역문
  assert.equal(h.sp.getPhase(), 'tr');
  assert.equal(h.sp.getIndex(), 0);
  h.ms.handlers.nexttrack();
  assert.equal(h.sp.getIndex(), 1);
  assert.equal(h.sp.getPhase(), 'src');
  assert.equal(h.sp.getState(), 'speaking');
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.synth.current.text, P1[1], '다음 문장 원문');
  // previoustrack — 이전 문장 처음부터
  h.ms.handlers.previoustrack();
  h.timers.advance(TTS.CANCEL_DELAY_MS);
  assert.equal(h.sp.getIndex(), 0);
  assert.equal(h.synth.current.text, P1[0]);
  assert.deepEqual([h.calls.next, h.calls.prev], [1, 1]);
});

test('H3 ★ 쪽 끝 + 읽는 중 → waiting-page(goToPage 1회, 8i-3 길 그대로) · 쪽 끝 + 멈춤 → 인덱스·상태 그대로(9-D5)', async () => {
  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  h.ms.handlers.nexttrack();
  h.ms.handlers.nexttrack();
  assert.equal(h.sp.getIndex(), 2, '쪽 마지막 문장');
  h.ms.handlers.nexttrack();
  assert.equal(h.sp.getState(), 'waiting-page');
  assert.equal(h.view.gotos, 1);
  assert.equal(h.ms.playbackState, 'playing', 'waiting-page 도 읽는 중');
  await flush();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.view.page, 2);
  assert.equal(h.synth.current.text, P2[0], '다음 쪽 첫 문장');
  assert.equal(h.view.gotos, 1, '쪽 넘김은 한 번');

  const g = harness();
  g.hf.arm();
  g.ms.handlers.play();
  g.ms.handlers.nexttrack();
  g.ms.handlers.nexttrack();
  g.ms.handlers.pause();                                   // 읽는 중 → 멈춤
  assert.equal(g.sp.getState(), 'paused');
  g.ms.handlers.nexttrack();
  await flush();
  assert.equal(g.sp.getIndex(), 2);
  assert.equal(g.sp.getState(), 'paused');
  assert.equal(g.view.gotos, 0, '멈춤 중 쪽 끝 ⏭ 는 아무 일 없음');
});

/* ══ H4 숨김 ════════════════════════════════════════════ */

test('H4 ★ hidden 중 play·nexttrack·previoustrack(·pause·stop) → speaker 호출 0 · 무시 카운터', () => {
  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  h.ms.handlers.pause();
  const before = Object.assign({}, h.calls);
  const holds = h.env.holds.length;                       // 보일 때 액션으로 멈춤 — 유지 잠금 1
  const idx = h.sp.getIndex();
  const spoken = h.synth.utt.length;
  h.env.hidden = true;
  h.ms.handlers.play();
  h.ms.handlers.nexttrack();
  h.ms.handlers.previoustrack();
  assert.deepEqual(h.calls, before, 'speaker 를 부르지 않았다');
  assert.equal(h.sp.getState(), 'paused');
  assert.equal(h.sp.getIndex(), idx);
  assert.equal(h.synth.utt.length, spoken, '숨김 중 재생하지 않는다(6-4)');
  assert.equal(h.hf.debug().ignored, 3);
  // 읽는 중에 숨겨진 경우(6-4 핸들러보다 액션이 먼저 와도) — 멈춤·stop 도 무시
  h.env.hidden = false;
  h.ms.handlers.play();
  h.env.hidden = true;
  const b2 = Object.assign({}, h.calls);
  h.ms.handlers.pause();
  h.ms.handlers.stop();
  assert.deepEqual(h.calls, b2);
  assert.equal(h.hf.debug().ignored, 5);
  assert.equal(holds, 1);
  assert.equal(h.env.holds.length, holds, '숨김 중에는 멈춤 유지 잠금을 새로 잡지 않는다');
});

/* ══ H5 상태 · 오디오 · disarm ═══════════════════════════════ */

test('H5 ★ playbackState·무음 오디오가 statechange 를 따른다 · 화면 버튼 경로도 같다 · disarm 정리', async () => {
  const h = harness();
  h.hf.arm();
  assert.equal(h.ms.playbackState, 'none', 'idle');
  assert.equal(h.audio.made.length, 0, '리더에 들어왔을 뿐 — 첫 소리는 [▶] 뒤');
  h.sp.play();                                             // 화면 [▶] 와 같은 speaker 경로
  const a = h.audio.made[0];
  assert.equal(h.ms.playbackState, 'playing');
  assert.equal(a.plays, 1);
  assert.equal(a.loop, true);
  assert.equal(a.volume, 1);
  assert.equal(a.preload, 'auto');
  assert.equal(a.bytes.length, 80044);
  h.sp.next(); h.sp.next(); h.sp.next();                   // 쪽 끝 → waiting-page → speaking
  assert.equal(h.sp.getState(), 'waiting-page');
  await flush();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(a.plays, 1, '읽는 동안 다시 부르지 않는다');
  h.sp.pause();
  assert.equal(h.ms.playbackState, 'paused');
  assert.equal(a.paused, true);
  assert.ok(a.pauses >= 1);
  h.sp.play();
  assert.equal(a.plays, 2);
  assert.equal(h.audio.made.length, 1, '오디오 요소는 하나');

  h.sp.stop();                                             // leaveControls 순서 — stop 뒤 disarm
  h.hf.disarm();
  for (const act of ACTIONS) assert.equal(h.ms.handlers[act], null, act + ' 핸들러 null');
  assert.equal(h.ms.metadata, null);
  assert.equal(h.ms.playbackState, 'none');
  assert.equal(a.attrs.src, undefined, 'src 없음 → 알림이 사라진다');
  assert.equal(a.loads, 1);
  assert.equal(a.paused, true);
  assert.equal(h.hf.debug().armed, false);
  // 떠난 뒤 speaker 상태가 바뀌어도(다른 리더 진입 전) 아무것도 하지 않는다
  h.sp.play();
  assert.equal(h.ms.playbackState, 'none');
  assert.equal(h.audio.made.length, 1);
  // 다시 들어오면 새 오디오로
  h.sp.stop();
  h.hf.arm();
  h.sp.play();
  assert.equal(h.audio.made.length, 2);
  assert.equal(h.ms.playbackState, 'playing');
});

test('H5 오디오 play() 거부 — 조용히 센다 · 낭독은 그대로', async () => {
  const h = harness({ audio: { reject: true } });
  h.hf.arm();
  h.ms.handlers.play();
  await flush();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.hf.debug().audioRejects, 1);
});

/* ══ H6 재동기화 ═════════════════════════════════════════ */

test('H6 ★ 재동기화 — 읽는 중 우리가 부르지 않은 pause → play 1회, 같은 문장 두 번째 → 다시 부르지 않고 focusFights +1', () => {
  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  const a = h.audio.made[0];
  assert.equal(a.plays, 1);
  a.foreignPause();
  assert.equal(a.plays, 2, '한 번 다시');
  assert.deepEqual([h.hf.debug().resyncs, h.hf.debug().focusFights], [1, 0]);
  a.foreignPause();
  assert.equal(a.plays, 2, '★ 같은 문장 두 번째 — 다시 부르지 않는다');
  assert.equal(h.hf.debug().focusFights, 1);
  // 다음 문장이면 다시 한 번 기회
  h.synth.finish();
  assert.equal(h.sp.getIndex(), 1);
  a.foreignPause();
  assert.equal(a.plays, 3);
  // 우리가 부른 pause(액션 멈춤)는 다툼이 아니다
  h.ms.handlers.pause();
  assert.deepEqual([h.hf.debug().resyncs, h.hf.debug().focusFights], [2, 1]);
  // 멈춘 동안 온 pause 는 무시(읽는 중이 아니다)
  a.paused = false;
  a.foreignPause();
  assert.equal(a.plays, 3);
});

/* ══ H7 멈춤 유지 ═════════════════════════════════════════ */

test('H7 ★ 액션으로 멈춤 → holdWakeLock(300000) 1회 · 5분 뒤 풀림 · 화면 [⏸] 로 멈춤 → 0회', async () => {
  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  h.ms.handlers.pause();
  assert.deepEqual(h.env.holds, [HANDSFREE.PAUSE_HOLD_MS]);
  assert.equal(HANDSFREE.PAUSE_HOLD_MS, 300000);
  await flush();
  assert.equal(h.hf.debug().holding, true);
  h.timers.advance(HANDSFREE.PAUSE_HOLD_MS - 1);
  assert.equal(h.env.locks[0].released, 0);
  h.timers.advance(1);
  assert.equal(h.env.locks[0].released, 1, '5분 지나면 푼다');
  assert.equal(h.hf.debug().holding, false);

  const g = harness();
  g.hf.arm();
  g.ms.handlers.play();
  g.sp.pause();                                            // 화면 [⏸] — controls 의 pressPlay → speaker.pause()
  assert.equal(g.env.holds.length, 0, '화면을 보고 있다 — 쥐지 않는다');
  g.ms.handlers.play();
  g.ms.handlers.stop();                                    // stop 액션도 액션 멈춤
  assert.equal(g.sp.getState(), 'paused');
  assert.equal(g.env.holds.length, 1);
});

test('H7 ★ tts.wakeLock=false → 0회 · 5분 안에 재생 → 유지 타이머 취소 · 숨김 → 풀기 · 떠남 → 풀기', async () => {
  const off = harness({ settings: { 'tts.wakeLock': false } });
  off.hf.arm();
  off.ms.handlers.play();
  off.ms.handlers.pause();
  assert.equal(off.env.holds.length, 0);

  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  h.ms.handlers.pause();
  await flush();
  h.timers.advance(60000);                                 // 1분 뒤 이어폰으로 재생
  h.ms.handlers.play();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.env.locks[0].released, 1, '재생 — 유지 잠금을 푼다(speaker 가 자기 잠금을 잡는다)');
  assert.equal(h.hf.debug().holding, false);
  h.synth.finish(); h.synth.finish();
  h.timers.advance(HANDSFREE.PAUSE_HOLD_MS);
  assert.equal(h.env.locks[0].released, 1, '★ 타이머가 취소됐다 — 두 번 풀지 않는다');

  const v = harness();
  v.hf.arm();
  v.ms.handlers.play();
  v.ms.handlers.pause();
  await flush();
  v.hf.onHidden();
  assert.equal(v.env.locks[0].released, 1, '숨겨지면 푼다');

  const l = harness();
  l.hf.arm();
  l.ms.handlers.play();
  l.ms.handlers.pause();
  l.hf.disarm();                                           // 잠금이 오기 전에 떠남
  await flush();
  assert.equal(l.env.locks[0].released, 1, '늦게 온 잠금도 곧장 푼다');
});

/* ══ H8 silentWav ═════════════════════════════════════════ */

test('H8 silentWav(10, 8000) — 80,044 바이트 · RIFF/WAVE/fmt /data · 8 kHz · 8비트 · 모노 · 데이터 전부 128', () => {
  const b = silentWav(10, 8000);
  assert.equal(b.length, 80044);
  const s = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  assert.equal(s(0, 4), 'RIFF');
  assert.equal(s(8, 4), 'WAVE');
  assert.equal(s(12, 4), 'fmt ');
  assert.equal(s(36, 4), 'data');
  const v = new DataView(b.buffer);
  assert.equal(v.getUint32(4, true), 80036);
  assert.equal(v.getUint32(16, true), 16);
  assert.equal(v.getUint16(20, true), 1, 'PCM');
  assert.equal(v.getUint16(22, true), 1, '모노');
  assert.equal(v.getUint32(24, true), 8000);
  assert.equal(v.getUint32(28, true), 8000);
  assert.equal(v.getUint16(32, true), 1);
  assert.equal(v.getUint16(34, true), 8);
  assert.equal(v.getUint32(40, true), 80000);
  let bad = 0;
  for (let i = 44; i < b.length; i++) if (b[i] !== 128) bad++;
  assert.equal(bad, 0);
  // 진폭 상수 하나로 바뀐다 · config 기본값
  assert.ok(silentWav(1, 8000, 127).slice(44).every((x) => x === 127));
  assert.deepEqual(
    [HANDSFREE.SESSION, HANDSFREE.SILENT_SECONDS, HANDSFREE.SILENT_RATE, HANDSFREE.SILENT_LEVEL, HANDSFREE.POSITION],
    ['audio', 10, 8000, 128, 'off']);
  assert.ok(Object.isFrozen(HANDSFREE));
});

/* ══ H9 메타데이터 ═══════════════════════════════════════ */

test('H9 ★ 메타데이터 — 제목 · "쪽 n / m" · MedReader · 아트워크 2개 · linechange 로는 다시 만들지 않는다', async () => {
  const h = harness();
  const m0 = FakeMeta.made;
  h.hf.arm();
  const md = h.ms.metadata;
  assert.ok(md instanceof FakeMeta);
  assert.equal(md.title, 'Zorvat Handbook');
  assert.equal(md.artist, 'Page 1 / 1967');
  assert.equal(md.album, ALBUM);
  assert.equal(ALBUM, 'MedReader');
  assert.deepEqual(md.artwork, [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]);
  assert.equal(ARTWORK.length, 2);
  assert.equal(FakeMeta.made, m0 + 1);

  h.ms.handlers.play();
  const calls = h.env.metaCalls;
  h.synth.finish();
  h.synth.finish();                                        // linechange 두 번(문장 0 → 1 → 2)
  assert.equal(h.sp.getIndex(), 2);
  assert.equal(h.ms.metadata, md, '★ 문장마다 알림을 다시 그리지 않는다');
  assert.equal(FakeMeta.made, m0 + 1);
  assert.equal(h.env.metaCalls, calls, '★ linechange 는 메타데이터를 읽지도 않는다');

  h.hf.arm();                                              // 같은 쪽이 다시 그려짐 — 같은 값이면 만들지 않는다
  assert.equal(FakeMeta.made, m0 + 1);
  h.synth.finish();                                        // 쪽 끝 → 다음 쪽
  await flush();
  h.hf.arm();                                              // controls: onPageRender → arm()
  assert.equal(h.ms.metadata.artist, 'Page 2 / 1967');
  assert.equal(FakeMeta.made, m0 + 2);

  h.env.lang = 'ar';                                       // UI 언어 바뀜 → refreshMeta
  h.hf.refreshMeta();
  assert.equal(h.ms.metadata.artist, 'صفحة 2 / 1967');
  h.env.lang = 'ko';
  h.hf.refreshMeta();
  assert.equal(h.ms.metadata.artist, '쪽 2 / 1967');
  assert.equal(FakeMeta.made, m0 + 4);
});

test('H9 i18n — handsfree.pageOf · settings.tts.mediaKeys · mediaKeysHint 4개 언어 · fr·ko 는 영어 그대로가 아니다', () => {
  for (const lang of ['ar', 'en', 'fr', 'ko']) {
    const b = BUNDLES[lang];
    for (const k of ['handsfree.pageOf', 'settings.tts.mediaKeys', 'settings.tts.mediaKeysHint']) {
      assert.equal(typeof b[k], 'string', lang + '.' + k);
      assert.ok(b[k].trim().length > 0);
    }
    assert.match(b['handsfree.pageOf'], /\{page\}/);
    assert.match(b['handsfree.pageOf'], /\{count\}/);
  }
  for (const lang of ['fr', 'ko', 'ar']) {
    for (const k of ['settings.tts.mediaKeys', 'settings.tts.mediaKeysHint']) {
      assert.notEqual(BUNDLES[lang][k], BUNDLES.en[k], lang + '.' + k + ' 가 영어 그대로다');
    }
  }
  assert.match(BUNDLES.ar['settings.tts.mediaKeysHint'], /[؀-ۿ]/);
  assert.match(BUNDLES.ko['settings.tts.mediaKeysHint'], /[가-힣]/);
  // 잠금 화면에 책 제목이 보인다는 설명(13절 — 고지 대신 설정 줄 설명)
  assert.match(BUNDLES.en['settings.tts.mediaKeysHint'], /title/i);
  assert.match(BUNDLES.ko['settings.tts.mediaKeysHint'], /제목/);
  assert.match(BUNDLES.fr['settings.tts.mediaKeysHint'], /titre/);
  assert.match(BUNDLES.ar['settings.tts.mediaKeysHint'], /عنوان/);
  // 아랍어·프랑스어 [검토] 표시
  for (const f of ['../js/i18n/ar.js', '../js/i18n/fr.js']) {
    const src = read(f);
    const at = src.indexOf("'settings.tts.mediaKeys'");
    assert.ok(at > 0);
    assert.match(src.slice(Math.max(0, at - 200), at), /\[9a[^\n]*\[검토 — Nour·운영자\]/);
  }
});

/* ══ H10 꺼짐 갈래 ═══════════════════════════════════════ */

test('H10 ★ mediaSession 없음 · tts.mediaKeys=false → 예외 0 · 핸들러·오디오 0', () => {
  const n = harness({ noMediaSession: true });
  assert.equal(n.hf.arm(), false);
  n.sp.play();
  n.sp.pause();
  n.hf.refreshMeta();
  n.hf.onHidden();
  n.hf.disarm();
  assert.equal(n.audio.made.length, 0);
  assert.equal(n.hf.debug().supported, false);

  const off = harness({ settings: { 'tts.mediaKeys': false } });
  assert.equal(off.hf.arm(), false);
  assert.deepEqual(off.ms.setCalls, []);
  assert.equal(off.ms.metadata, null);
  off.sp.play();
  assert.equal(off.audio.made.length, 0);
  assert.equal(off.ms.playbackState, 'none');
  assert.equal(DEFAULTS['tts.mediaKeys'], true, '기본 켬(9-D8)');

  // 걸린 뒤 설정을 끄고 리더에 다시 들어오면(쪽 그리기 → arm) 거둔다
  const tog = harness();
  tog.hf.arm();
  tog.sp.play();
  tog.env.settings['tts.mediaKeys'] = false;
  assert.equal(tog.hf.arm(), false);
  for (const act of ACTIONS) assert.equal(tog.ms.handlers[act], null);
  assert.equal(tog.audio.made[0].attrs.src, undefined);
});

test("H10 ★ SESSION='none' → 핸들러는 건다 · 오디오 0 · MediaMetadata 없음 → 메타데이터만 생략 · seek 은 걸지 않는다", () => {
  const h = harness({ config: { SESSION: 'none' } });
  assert.equal(h.hf.arm(), true);
  assert.deepEqual(Object.keys(h.ms.handlers).sort(), [...ACTIONS].sort());
  for (const a of UNBOUND) assert.ok(!(a in h.ms.handlers), a);
  h.ms.handlers.play();
  assert.equal(h.sp.getState(), 'speaking');
  assert.equal(h.ms.playbackState, 'playing');
  assert.equal(h.audio.made.length, 0, '오디오 없음');
  assert.equal(h.hf.debug().session, 'none');

  const nm = harness({ noMeta: true });
  assert.equal(nm.hf.arm(), true);
  assert.equal(nm.ms.metadata, null);
  nm.ms.handlers.play();
  assert.equal(nm.sp.getState(), 'speaking');
});

/* ══ P 위치 막대(9-D7) ══════════════════════════════════════ */

test("P 9-D7 — 기본 'off' 는 setPositionState 를 부르지 않는다 · 'sentence' 는 쪽 문장 진행 · positionOf", async () => {
  const h = harness();
  h.hf.arm();
  h.ms.handlers.play();
  h.synth.finish();
  h.ms.handlers.pause();
  h.hf.disarm();
  assert.deepEqual(h.ms.positions, [], '기본 — 위치 막대를 건드리지 않는다');

  const s = harness({ config: { POSITION: 'sentence' } });
  s.hf.arm();
  s.ms.handlers.play();
  s.synth.finish();
  const last = s.ms.positions[s.ms.positions.length - 1];
  assert.deepEqual(last, { duration: 3, position: 1, playbackRate: 1 });
  s.hf.disarm();
  assert.equal(s.ms.positions[s.ms.positions.length - 1], null);

  assert.equal(positionOf('off', 1, 3), null);
  assert.equal(positionOf('sentence', 0, 0), null, 'duration 은 양수(W4)');
  assert.deepEqual(positionOf('sentence', 9, 3), { duration: 3, position: 3, playbackRate: 1 }, 'position ≤ duration');
});

/* ══ W 배선·계층 소스 ═══════════════════════════════════════ */

test('W1 ★ controls — [▶] 와 이어폰이 같은 pressPlay · 배선 · 떠날 때 disarm · 디버그 훅 · 6-4 hidden 핸들러 그대로', () => {
  const c = noComments(read('../js/ui/controls.js'));
  assert.match(c, /import \{ createHandsfree \} from '\.\/handsfree\.js';/);
  assert.match(c, /els\.play\.addEventListener\('click', pressPlay\);/);
  assert.equal((c.match(/createHandsfree\(/g) || []).length, 1);
  assert.match(c, /pressPlay: pressPlay,/);
  assert.match(c, /speaker: speaker,/);
  assert.match(c, /'mediaSession' in navigator/);
  assert.match(c, /onPageRender\(\(\) => \{ handsfree\.arm\(\); \}\);/);
  assert.match(c, /onLangChange\(\(\) => \{ handsfree\.refreshMeta\(\); \}\);/);
  assert.match(c, /if \(document\.visibilityState === 'hidden'\) handsfree\.onHidden\(\);/);
  const pp = c.slice(c.indexOf('function pressPlay()'), c.indexOf('function noReadNotice()'));
  assert.ok(!/await|\.then\(/.test(pp), 'pressPlay 는 동기');
  assert.match(pp, /else \{ syncReadalong\(\); speaker\.play\(\); \}/);
  const leave = c.slice(c.indexOf('export function leaveControls'), c.indexOf('function restoreSettings'));
  assert.ok(leave.indexOf('handsfree.disarm()') > leave.indexOf('speaker.stop()'), '멈춘 뒤 거둔다');
  assert.match(c, /handsfree: function \(\) \{ return handsfree \? handsfree\.debug\(\) : null; \}/);
  // 6-4 hidden 핸들러 — 0줄 변경(17-1-1 8절)
  assert.match(c, /document\.addEventListener\('visibilitychange', \(\) => \{\s*if \(document\.visibilityState === 'hidden'\) \{\s*if \(speaker\.getState\(\) === 'speaking'\) speaker\.pause\(\);\s*\} else if \(speaker\.getState\(\) === 'speaking'\) \{\s*speaker\.requestWakeLock\(\);\s*\}\s*\}\);/);
  // 무음 오디오는 blob 하나 — 외부 파일·요청 없음
  assert.match(c, /new Blob\(\[bytes\], \{ type: 'audio\/wav' \}\)/);
});

test('W2 ★ handsfree.js 계층 — config·i18n 만 import · 브라우저 전역 없음 · await 없음 · seek 은 걸지 않음 · speaker.js 0줄', () => {
  const src = read('../js/ui/handsfree.js');
  const code = noComments(src);
  const imports = [...code.matchAll(/^import [^;]* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['../config.js', '../i18n/index.js']);
  assert.ok(!/\b(navigator|document|window|localStorage)\b/.test(code), '전역은 주입받는다');
  assert.ok(!/\bawait\b|async function/.test(code), '★ 핸들러는 동기');
  assert.ok(!/setActionHandler\('seek/.test(code));
  const sp = noComments(read('../js/tts/speaker.js'));
  assert.ok(!/mediaSession|MediaMetadata|handsfree/.test(sp), 'speaker 는 9a 를 모른다');
  // reader — docTitle 하나(리더 머리와 같은 값)
  const r = noComments(read('../js/ui/reader.js'));
  assert.match(r, /export function docTitle\(\) \{ return \(state\.doc && \(state\.doc\.title \|\| state\.doc\.fileName\)\) \|\| ''; \}/);
});

test('W3 설정 — tts.mediaKeys 기본 켬 · 낭독 목소리 카드 한 줄(정적 HTML 무변 — JS 가 만든다) · 리더에 들어올 때 읽는다', () => {
  assert.equal(DEFAULTS['tts.mediaKeys'], true);
  const ui = noComments(read('../js/ui/settings.js'));
  assert.match(ui, /function buildMediaKeysRow\(card\)/);
  assert.match(ui, /buildMediaKeysRow\(root\.querySelector\('#settingsVoices'\)\)/);
  assert.match(ui, /settings\.set\('tts\.mediaKeys', !!els\.mediaKeys\.checked\)/);
  assert.match(ui, /els\.mediaKeys\.checked = settings\.get\('tts\.mediaKeys'\) !== false/);
  assert.match(ui, /'settings\.tts\.mediaKeysHint'/);
  const html = read('../index.html');
  assert.ok(!/ttsMediaKeys/.test(html), '정적 HTML 에 그릇을 두지 않는다');
  assert.match(html, /"\.\/js\/ui\/handsfree\.js": "\.\/js\/ui\/handsfree\.js\?v=[0-9a-f]{10}"/);
  // 아이콘(알림 그림) 파일이 있다
  for (const a of ARTWORK) assert.ok(readFileSync(new URL('../' + a.src, import.meta.url)).length > 0, a.src);
});
