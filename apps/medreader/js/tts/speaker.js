/* ============================================================
   MedReader — 낭독 상태 기계 (spec 6-1 · 6-2 · 6-4)

   ── 서비스 계층이다(3-2) ────────────────────────────────
   이 파일은 **DOM 을 모르고 i18n 도 모른다.** 화면은 `view` 로 주입되고,
   밖으로는 **코드와 이벤트만** 낸다(`TTS_NOT_ALLOWED`, `TTS_LINE_SKIPPED`…).
   문장으로 바꾸는 일은 `ui/controls.js` 의 몫이다.

   ── ★ 6-4 의 대응은 "항상" 적용된다 ─────────────────────
   Android Chrome 의 버그들은 **데스크톱에서 재현되지 않는다.** 그래서
   기능 감지로 분기하지 않는다. 아래 여덟 가지는 조건 없이 늘 돈다:

     1. `speechSynthesis.pause()` 를 **쓰지 않는다.** 일시정지 = `cancel()`
        + 현재 자리 기억, 재개 = 그 발화 처음부터.
     2. 현재 utterance 를 **모듈 스코프 변수**에 붙들어 둔다(GC 로 onend 유실).
     3. **워치독** — `expectedMs × 2` 에 응답이 없으면 cancel 하고 다음으로.
     4. `cancel()` 직후의 `speak()` 는 씹히므로 **60ms 뒤**에 건다.
     5. 첫 `speak()` 는 **탭 핸들러 안에서 동기적으로**(앞에 await 를 두지
        않는다 — Wake Lock 요청도 speak 뒤로 미룬다).
     6. 큐를 한 번에 쌓지 않는다. **항상 utterance 1개**, `onend` 에서 다음.
     7. `onstart` 가 안 와도 하이라이트가 움직이도록 `speak()` 직후
        `linechange` 를 먼저 내고 `onstart` 에서는 중복을 무시한다.
     8. 300자 초과 문장은 `tts/text.js` 가 미리 쪼개 두었다(하이라이트는 유지).

   ── 세대(gen) ───────────────────────────────────────────
   취소한 발화의 `onend`·`onerror`·워치독이 **뒤늦게** 도착해 새 발화를
   덮어쓰는 것이 이 API 에서 가장 흔한 버그다. 모든 콜백이 자기가 태어난
   `gen` 을 들고 있고, `gen` 이 바뀌었으면 조용히 물러난다.
   ============================================================ */

import { TTS } from '../config.js';
import { buildUnits, watchdogMs, clampRate, indexOfLine } from './text.js';

export const STATES = Object.freeze(['idle', 'speaking', 'paused', 'waiting-page', 'error']);

export const CODES = Object.freeze({
  NOT_ALLOWED: 'TTS_NOT_ALLOWED',
  LINE_SKIPPED: 'TTS_LINE_SKIPPED',
  PAGE_TIMEOUT: 'TTS_PAGE_TIMEOUT',
  NO_VOICE: 'TTS_NO_VOICE',
  WAKELOCK_UNAVAILABLE: 'TTS_WAKELOCK_UNAVAILABLE'
});

/** 빈 쪽이 이어질 때 몇 쪽까지 건너뛰며 찾아볼 것인가(무한 루프 방지). */
const MAX_EMPTY_PAGES = 20;

/**
 * @param {Object} deps
 * @param {Object} deps.synth        `speechSynthesis` 같은 것(주입 — 테스트 스텁)
 * @param {Function} deps.makeUtterance  `(text) => utterance`
 * @param {Object} deps.view         화면 어댑터(아래 참조)
 * @param {Function} [deps.requestWakeLock]  `() => Promise<lock|null>`
 * @param {Object} [deps.timers]     `{setTimeout, clearTimeout}`
 *
 * `view` 계약:
 *   paras()            → `[{id, kind, lines:[{id,text,hyphen}]}]` 지금 쪽
 *   page()             → `{page, pageCount}`
 *   goToPage(n)        → `Promise<boolean>` 그 쪽을 그릴 때까지(최대 5초)
 *   show(unit)         → `boolean` 하이라이트. 줄이 지금 쪽에 없으면 false
 *   markDone(unit)     → 읽은 표시
 */
export function createSpeaker(deps) {
  const d = deps || {};
  const synth = d.synth;
  const makeUtterance = d.makeUtterance;
  const view = d.view;
  // ★ 브라우저에서 `setTimeout` 은 `this` 가 window 여야 한다. 객체에 그대로
  // 담아 `timers.setTimeout(...)` 으로 부르면 `Illegal invocation` 으로 죽는다
  // (테스트는 가짜 타이머를 주입하므로 이 함정을 잡지 못한다 — 실측으로 나왔다).
  const timers = d.timers || {
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };
  const bus = new EventTarget();

  /* ── 상태 ─────────────────────────────────────────── */
  let state = 'idle';
  let units = [];
  let index = 0;
  let rate = 1;
  let unit = TTS.UNIT_DEFAULT;
  let docLang = 'en-US';
  const voiceFor = {};           // lang → voice 객체
  let gen = 0;                   // 세대 — 늦게 오는 콜백을 무시한다
  let current = null;            // ★ 6-4 (2) GC 방지: 지금 발화를 붙들어 둔다
  let watchdog = null;
  let deferred = null;           // cancel 후 60ms 대기 타이머
  let retriedAt = -1;            // 재시도한 발화 번호(6-2 "1회 재시도")
  let lastLineId = null;         // 6-4 (7) onstart 중복 emit 방지
  let wakeLock = null;
  let stallOnce = false;         // 16-C 테스트 훅

  /* ── 작은 도구 ────────────────────────────────────── */
  function emit(type, detail) {
    bus.dispatchEvent(new CustomEvent(type, { detail: detail }));
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    emit('statechange', { state: state });
  }

  function busy() {
    try { return !!(synth && (synth.speaking || synth.pending)); } catch (e) { return false; }
  }

  /** 취소는 **항상 세대를 올린다** — 늦게 오는 onend 가 다음 발화를 죽이지 못하게. */
  function cancelSynth() {
    gen++;
    clearWatchdog();
    clearDeferred();
    current = null;
    try { if (synth && synth.cancel) synth.cancel(); } catch (e) { /* 이미 죽은 엔진 */ }
  }

  function clearWatchdog() {
    if (watchdog !== null) { timers.clearTimeout(watchdog); watchdog = null; }
  }

  function clearDeferred() {
    if (deferred !== null) { timers.clearTimeout(deferred); deferred = null; }
  }

  /* ── 6-2 발화 ─────────────────────────────────────── */

  /**
   * 6-4 (4) — `cancel()` 직후의 `speak()` 는 씹힌다. 그래서 무언가가 울리고
   * 있었으면 60ms 뒤에 건다. **아무것도 안 울리고 있으면 즉시 건다** —
   * 그래야 첫 재생이 탭 핸들러 안에서 동기적으로 나간다(6-4 (5)).
   */
  function restart(i) {
    const wasBusy = busy();
    cancelSynth();
    if (!wasBusy) { speakAt(i); return; }
    const myGen = gen;
    deferred = timers.setTimeout(function () {
      deferred = null;
      if (myGen !== gen) return;
      speakAt(i);
    }, TTS.CANCEL_DELAY_MS);
  }

  function speakAt(i) {
    if (i >= units.length) { advancePage(0); return; }
    if (i < 0) i = 0;
    index = i;

    const u = units[i];
    const myGen = gen;

    // 6-4 (7) — onstart 가 안 오는 환경이 있다. 하이라이트를 먼저 옮긴다.
    show(u);

    const utt = makeUtterance(u.text);
    utt.lang = docLang;
    const v = voiceFor[langKey(docLang)];
    if (v) utt.voice = v;
    utt.rate = rate;
    utt.pitch = 1;

    if (!stallOnce) {
      utt.onstart = function () {
        if (myGen !== gen) return;
        // 같은 줄이면 중복 emit 하지 않는다(6-2).
        if (lastLineId === firstLineId(u)) return;
        show(u);
      };
      utt.onend = function () {
        if (myGen !== gen) return;
        clearWatchdog();
        if (state !== 'speaking') return;
        if (view && view.markDone) { try { view.markDone(u); } catch (e) { /* 화면이 사라졌다 */ } }
        retriedAt = -1;
        speakAt(index + 1);
      };
      utt.onerror = function (ev) { onUtterError(ev, myGen, u); };
    }
    stallOnce = false;

    current = utt;               // ★ 6-4 (2) — 이 줄을 지우면 onend 가 사라진다
    try {
      synth.speak(utt);
    } catch (e) {
      setState('error');
      emit('error', { code: CODES.NOT_ALLOWED });
      return;
    }

    // 6-2 워치독 — 이 단계의 최후 방어선.
    watchdog = timers.setTimeout(function () {
      if (myGen !== gen) return;
      watchdog = null;
      if (state !== 'speaking') return;
      const at = index;
      cancelSynth();
      setState('speaking');
      const nextGen = gen;
      deferred = timers.setTimeout(function () {
        deferred = null;
        if (nextGen !== gen) return;
        speakAt(at + 1);
      }, TTS.CANCEL_DELAY_MS);
    }, watchdogMs(u.text, rate));
  }

  function onUtterError(ev, myGen, u) {
    if (myGen !== gen) return;
    clearWatchdog();
    const code = String((ev && ev.error) || '');

    // 우리가 취소한 것이다 — 조용히 물러난다(6-2).
    if (code === 'interrupted' || code === 'canceled') return;

    if (code === 'not-allowed') {
      setState('error');
      emit('error', { code: CODES.NOT_ALLOWED });
      return;
    }

    if (retriedAt !== index) {
      retriedAt = index;
      const at = index;
      cancelSynth();
      setState('speaking');
      const nextGen = gen;
      deferred = timers.setTimeout(function () {
        deferred = null;
        if (nextGen !== gen) return;
        speakAt(at);
      }, TTS.CANCEL_DELAY_MS);
      return;
    }

    emit('error', { code: CODES.LINE_SKIPPED, lineId: firstLineId(u) });
    retriedAt = -1;
    speakAt(index + 1);
  }

  function show(u) {
    if (!u) return false;
    lastLineId = firstLineId(u);
    let ok = false;
    if (view && view.show) { try { ok = !!view.show(u); } catch (e) { ok = false; } }
    emit('linechange', {
      lineId: firstLineId(u), lineIds: u.lineIds.slice(),
      paraId: u.paraId, index: index, total: units.length, onPage: ok
    });
    return ok;
  }

  function firstLineId(u) { return u && u.lineIds.length ? u.lineIds[0] : null; }

  function langKey(l) { return String(l || 'en').slice(0, 2).toLowerCase(); }

  /* ── 6-1 쪽 넘김 ──────────────────────────────────── */

  /** 쪽 끝. 다음 쪽을 요청하고 **최대 5초** 기다린다. 그동안 `'waiting-page'`. */
  async function advancePage(depth) {
    const hop = Number(depth) || 0;
    const p = (view && view.page && view.page()) || null;
    if (!p || (p.pageCount > 0 && p.page >= p.pageCount)) { finish(); return; }
    if (hop >= MAX_EMPTY_PAGES) { finish(); return; }

    setState('waiting-page');
    const myGen = gen;

    let ok = false;
    try { ok = await view.goToPage(p.page + 1); } catch (e) { ok = false; }
    if (myGen !== gen) return;                 // 그 사이 사용자가 멈췄다

    if (!ok) {
      setState('paused');
      emit('error', { code: CODES.PAGE_TIMEOUT });
      return;
    }

    units = buildUnits(view.paras(), unit);
    index = 0;
    if (!units.length) { advancePage(hop + 1); return; }   // 표뿐인 쪽 — 계속 넘긴다
    setState('speaking');
    speakAt(0);
  }

  function finish() {
    cancelSynth();
    releaseWakeLock();
    setState('idle');
    emit('end', { });
  }

  /* ── Wake Lock (6-4) — 기능 감지는 여기서만 한다 ──── */

  async function requestWakeLock() {
    if (!d.requestWakeLock) { emit('error', { code: CODES.WAKELOCK_UNAVAILABLE }); return; }
    try {
      const lock = await d.requestWakeLock();
      if (!lock) { emit('error', { code: CODES.WAKELOCK_UNAVAILABLE }); return; }
      wakeLock = lock;
    } catch (e) {
      emit('error', { code: CODES.WAKELOCK_UNAVAILABLE });
    }
  }

  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock && typeof lock.release === 'function') { try { lock.release(); } catch (e) { /* 이미 풀림 */ } }
  }

  /* ── 6-1 전이표 ───────────────────────────────────── */

  /**
   * `idle`/`paused` → `speaking`. **`await` 를 앞에 두지 않는다**(6-4 (5)) —
   * 탭 핸들러에서 곧장 불리면 `synth.speak()` 가 그 이벤트 안에서 나간다.
   */
  function play(fromLineId) {
    if (!units.length || fromLineId != null || state === 'idle') {
      units = buildUnits((view && view.paras && view.paras()) || [], unit);
    }
    if (!units.length) { finish(); return; }

    let i = index;
    if (fromLineId != null) {
      const found = indexOfLine(units, fromLineId);
      if (found >= 0) i = found;
    }
    if (i < 0 || i >= units.length) i = 0;

    setState('speaking');
    restart(i);
    // Wake Lock 은 speak 뒤에 — 앞에 두면 첫 재생이 제스처를 잃는다.
    requestWakeLock();
  }

  /** 6-4 (1) — `speechSynthesis.pause()` 를 쓰지 않는다. */
  function pause() {
    if (state !== 'speaking' && state !== 'waiting-page') return;
    cancelSynth();
    releaseWakeLock();
    setState('paused');
  }

  function resume() {
    if (state === 'speaking') return;
    play();
  }

  function stop() {
    cancelSynth();
    releaseWakeLock();
    index = 0;
    units = [];
    lastLineId = null;
    retriedAt = -1;
    setState('idle');
  }

  /** 6-1 — `paused` 였다면 paused 를 유지하고 하이라이트만 옮긴다. */
  function step(delta) {
    if (!units.length) return;
    const target = index + delta;
    if (target >= units.length) {
      if (state === 'speaking') { cancelSynth(); setState('speaking'); advancePage(0); }
      return;
    }
    const i = Math.max(0, target);
    index = i;
    if (state === 'speaking') restart(i);
    else show(units[i]);
  }

  function setRate(r) {
    const next = clampRate(r);
    if (next === rate) return;
    rate = next;
    emit('statechange', { state: state, rate: rate });
    if (state === 'speaking') restart(index);   // 6-1 — 즉시 적용
  }

  function setUnit(u) {
    const next = u === 'line' ? 'line' : 'sentence';
    if (next === unit) return;
    const anchor = units.length ? firstLineId(units[index]) : null;
    unit = next;
    units = buildUnits((view && view.paras && view.paras()) || [], unit);
    const found = anchor == null ? -1 : indexOfLine(units, anchor);
    index = found >= 0 ? found : 0;
    emit('statechange', { state: state, unit: unit });
    if (state === 'speaking') restart(index);
    else if (units.length) show(units[index]);
  }

  function setVoice(lang, voice) { voiceFor[langKey(lang)] = voice || null; }
  function setDocLang(l) { docLang = String(l || 'en-US'); }

  /** 쪽이 새로 그려졌다 — 큐를 그 쪽 것으로 갈아 끼운다(사용자가 쪽을 넘긴 경우). */
  function reload(fromLineId) {
    units = buildUnits((view && view.paras && view.paras()) || [], unit);
    const found = fromLineId == null ? -1 : indexOfLine(units, fromLineId);
    index = found >= 0 ? found : 0;
    if (state === 'speaking') restart(index);
  }

  return {
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),

    play: play,
    pause: pause,
    resume: resume,
    stop: stop,
    next: function () { step(1); },
    prev: function () { step(-1); },
    setRate: setRate,
    setUnit: setUnit,
    setVoice: setVoice,
    setDocLang: setDocLang,
    reload: reload,
    requestWakeLock: requestWakeLock,
    releaseWakeLock: releaseWakeLock,

    getState: function () { return state; },
    getRate: function () { return rate; },
    getUnit: function () { return unit; },
    getIndex: function () { return index; },
    getTotal: function () { return units.length; },
    getCurrent: function () { return units[index] || null; },

    /**
     * 16-C 의 `[D]` 항목 — **다음 한 발화의 onend·onerror 를 오지 않게 한다.**
     * 워치독이 실제로 도는지 보는 유일한 방법이다. `window.__medreader.tts` 로
     * 노출된다(키를 담지 않는다 — 16-K).
     */
    simulateStall: function () { stallOnce = true; }
  };
}
