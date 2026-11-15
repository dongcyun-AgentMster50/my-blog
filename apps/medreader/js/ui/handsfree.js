/* ============================================================
   MedReader — 이어폰·잠금 화면 버튼 (spec 17-1-1 · 9a)

   ── 이 파일이 하는 일 ───────────────────────────────────
   Media Session 으로 이어폰 단추·알림창·잠금 화면의 ⏮⏯⏭ 를 리더 낭독에 잇는다.
     · 액션 → speaker 공개 함수(`play` 는 [▶] 와 **같은 함수** `pressPlay()`, 나머지는 `pause`·`next`·`prev`).
       새 재생 경로를 만들지 않는다 — 8d·8i-3·8m·readalong 은 화면 버튼을 눌렀을 때와 똑같이 돈다(6-2).
     · 알림 메타데이터(책 제목 · "쪽 n / m" · 아이콘)와 `playbackState`.
     · 세션 잡기 — 낭독 중 무음 `<audio loop>`(`HANDSFREE.SESSION = 'audio'`, 결정 9-D1 (나)).
       `speechSynthesis` 만으로는 Chrome 이 버튼을 이 페이지로 보낸다는 문서가 없다(W2).
     · 이어폰·알림으로 멈췄을 때만 화면을 5분 더 켜 둔다(결정 9-D3).

   ── 지키는 것 ───────────────────────────────────────────
   · 판정 기준은 **speaker 상태**다(알림·오디오 요소 상태가 아니다). play/pause 는 토글(결정 9-D4).
   · 핸들러는 **동기**로 `pressPlay()` 까지 간다 — 앞에 `await` 를 두지 않는다(6-4 (5)).
   · 숨김(hidden) 중에는 모든 액션을 무시한다 — 6-4 hidden 규칙은 visible → hidden 때 한 번만 돌므로,
     숨은 동안 재생을 부르면 그대로 읽어 버린다(17-1-1 1절 "빈틈"). 이 파일이 그 길을 처음 여는 곳이라 여기서 막는다.
   · `seekforward`·`seekbackward`·`seekto` 는 걸지 않는다(문장 낭독에 "초"가 없다).
   · 기능 감지(`'mediaSession' in navigator`)는 배선(controls)이 한 번 — 여기는 주입받은 `mediaSession` 이 없으면 전부 no-op.

   import 방향(3-2): config · i18n 만. speaker·브라우저 전역은 주입받는다(테스트가 진짜 `createSpeaker` 를 넣는다).
   ============================================================ */

import { HANDSFREE } from '../config.js';
import { t as tDefault, formatNumber as formatDefault } from '../i18n/index.js';

/** 거는 액션 — 이것만 알림에 단추가 생긴다(W3). */
export const ACTIONS = Object.freeze(['play', 'pause', 'previoustrack', 'nexttrack', 'stop']);
/** 걸지 않는 액션(4절) — 걸면 알림에 ±10초·진행 막대 단추가 생긴다. */
export const UNBOUND = Object.freeze(['seekforward', 'seekbackward', 'seekto']);
/** 알림 그림 — 8j PNG. 상대 경로는 브라우저가 문서 기준으로 푼다. */
export const ARTWORK = Object.freeze([
  Object.freeze({ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
  Object.freeze({ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' })
]);
/** 알림의 앨범 칸 — 번역하지 않는 이름. */
export const ALBUM = 'MedReader';

/** "읽는 중" — speaking·waiting-page(쪽 넘김 대기도 낭독의 일부다). */
export function isReading(state) { return state === 'speaking' || state === 'waiting-page'; }

/**
 * 4절 표를 함수 하나로. **순수.**
 * @param {string} state   speaker 상태 `'idle'|'speaking'|'paused'|'waiting-page'|'error'`
 * @param {string} action  Media Session 액션 이름
 * @param {boolean} hidden 문서가 숨겨져 있는가
 * @returns {'ignore'|'play'|'pause'|'next'|'prev'|'none'|null}  null = 걸지 않는 액션
 *   'play' = `pressPlay()`([▶] 와 같은 함수) · 'pause' = `speaker.pause()` · 'next'·'prev' = `speaker.next()`·`prev()`
 *   'none' = 아무 일 없음 · 'ignore' = 숨김 중이라 무시(센다)
 */
export function actionFor(state, action, hidden) {
  if (ACTIONS.indexOf(action) < 0) return null;
  if (hidden) return 'ignore';
  const reading = isReading(state);
  if (action === 'play' || action === 'pause') return reading ? 'pause' : 'play';   // 토글(9-D4)
  if (action === 'nexttrack') return 'next';         // 멈춤 중 쪽 끝이면 speaker 가 아무 일도 하지 않는다(9-D5)
  if (action === 'previoustrack') return 'prev';
  if (action === 'stop') return reading ? 'pause' : 'none';   // stop() 은 "리더 떠남"용 — 쓰지 않는다
  return null;
}

/** speaker 상태 → `navigator.mediaSession.playbackState`. **순수.** */
export function playbackStateOf(state) {
  if (isReading(state)) return 'playing';
  if (state === 'paused' || state === 'error') return 'paused';
  return 'none';
}

/**
 * 무음 PCM WAV(8비트·모노). 8비트 PCM 의 0 은 바이트 128. **순수.**
 * `silentWav(10, 8000)` = 44 + 80,000 = 80,044 바이트.
 * @param {number} seconds
 * @param {number} rate     샘플률(Hz)
 * @param {number} [level]  모든 샘플의 값(기본 128 — 완전 무음)
 * @returns {Uint8Array}
 */
export function silentWav(seconds, rate, level) {
  const sr = Math.max(1, Math.round(Number(rate) || 8000));
  const n = Math.max(0, Math.round((Number(seconds) || 0) * sr));
  const lv = level == null ? 128 : (Math.round(Number(level)) & 0xff);
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);          // PCM
  v.setUint16(22, 1, true);          // 모노
  v.setUint32(24, sr, true);         // 샘플률
  v.setUint32(28, sr, true);         // 초당 바이트 = 샘플률 × 1채널 × 1바이트
  v.setUint16(32, 1, true);          // 블록 정렬
  v.setUint16(34, 8, true);          // 비트 수
  str(36, 'data'); v.setUint32(40, n, true);
  b.fill(lv, 44);
  return b;
}

/**
 * 9-D7 위치 막대 — **한 곳**. `mode` 가 'sentence' 일 때만 값을 낸다(기본 'off' = 부르지 않음). **순수.**
 * @returns {?{duration:number, position:number, playbackRate:number}}  null = 부르지 않는다
 */
export function positionOf(mode, index, total) {
  if (mode !== 'sentence') return null;
  const n = Number(total) || 0;
  if (n <= 0) return null;                        // W4 — duration 은 양수
  const i = Math.min(Math.max(0, Number(index) || 0), n);
  return { duration: n, position: i, playbackRate: 1 };
}

/**
 * @param {Object} deps
 * @param {Object} [deps.mediaSession]   `navigator.mediaSession`(없으면 전부 no-op)
 * @param {Function} [deps.MediaMetadata]  생성자(없으면 메타데이터만 생략)
 * @param {Function} [deps.makeAudio]   `(wavBytes) => HTMLAudioElement` — 세션 잡기용(SESSION 'audio')
 * @param {Function} [deps.isHidden]    `() => boolean`
 * @param {Object} deps.speaker          `createSpeaker()` 의 반환(공개 함수만 쓴다)
 * @param {Function} deps.pressPlay      [▶] 와 같은 함수 — **동기**
 * @param {Function} [deps.meta]         `() => {title, page, pageCount}`
 * @param {Function} [deps.t]            i18n `t`(기본 import)
 * @param {Function} [deps.formatNumber] i18n `formatNumber`(기본 import)
 * @param {Function} [deps.holdWakeLock] `(ms) => Promise<lock|null>` — 멈춤 유지용 Wake Lock(자기 sentinel)
 * @param {Function} [deps.getSetting]   `(key) => value` — `tts.mediaKeys`·`tts.wakeLock`
 * @param {Object} [deps.timers]         `{setTimeout, clearTimeout}`
 * @param {Object} [deps.config]         `HANDSFREE` 덮어쓰기(테스트 — SESSION 'none' 갈래 등)
 */
export function createHandsfree(deps) {
  const d = deps || {};
  const ms = d.mediaSession || null;
  const Meta = typeof d.MediaMetadata === 'function' ? d.MediaMetadata : null;
  const sp = d.speaker || null;
  const tr = typeof d.t === 'function' ? d.t : tDefault;
  const fmt = typeof d.formatNumber === 'function' ? d.formatNumber : formatDefault;
  const cfg = Object.assign({}, HANDSFREE, d.config || {});
  const getSetting = typeof d.getSetting === 'function' ? d.getSetting : function () { return undefined; };
  // ★ 브라우저 `setTimeout` 은 this 가 window 여야 한다 — 감싸서 부른다(speaker.js 와 같은 함정).
  const timers = d.timers || {
    setTimeout: function (fn, n) { return setTimeout(fn, n); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };

  let armed = false;
  let audio = null;
  let selfPauses = 0;            // 우리가 부른 audio.pause() 중 아직 `pause` 이벤트가 안 온 수
  let fightKey = null;           // 재동기화를 한 번 해 본 문장(쪽:인덱스)
  let lastMetaKey = null;        // 같은 메타데이터를 다시 만들지 않는다(잠금 화면 깜박임)
  let hold = null;               // 멈춤 유지 {timer, lock}
  const stats = { actions: {}, ignored: 0, resyncs: 0, focusFights: 0, audioRejects: 0, holds: 0, metaBuilds: 0 };

  function isHidden() { try { return !!(d.isHidden && d.isHidden()); } catch (e) { return false; } }
  function state() { try { return sp ? sp.getState() : 'idle'; } catch (e) { return 'idle'; } }
  function metaNow() {
    let m = null;
    try { m = typeof d.meta === 'function' ? d.meta() : null; } catch (e) { m = null; }
    return m || {};
  }

  /* ── 액션 ─────────────────────────────────────────── */

  const handlers = {};
  ACTIONS.forEach(function (a) { handlers[a] = function () { handle(a); }; });

  /** ★ 동기 — `pressPlay()` 앞에 await 없음(6-4 (5) · H2). */
  function handle(action) {
    stats.actions[action] = (stats.actions[action] || 0) + 1;
    if (!armed || !sp) return;
    const what = actionFor(state(), action, isHidden());
    if (what === 'ignore') { stats.ignored++; return; }
    if (what === 'play') { d.pressPlay(); return; }        // 유지 잠금은 statechange(읽는 중)에서 푼다
    if (what === 'pause') { sp.pause(); if (state() === 'paused') startHold(); return; }
    if (what === 'next') { sp.next(); return; }
    if (what === 'prev') { sp.prev(); return; }
  }

  function setHandlers(on) {
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      try { ms.setActionHandler(a, on ? handlers[a] : null); } catch (e) { /* 그 액션을 모르는 브라우저 */ }
    }
  }

  /* ── 상태 · 무음 오디오 ──────────────────────────────── */

  function setPlayback(v) { try { ms.playbackState = v; } catch (e) { /* 읽기 전용 구현 */ } }

  function ensureAudio() {
    if (audio || cfg.SESSION !== 'audio' || typeof d.makeAudio !== 'function') return audio;
    let a = null;
    try { a = d.makeAudio(silentWav(cfg.SILENT_SECONDS, cfg.SILENT_RATE, cfg.SILENT_LEVEL)); } catch (e) { a = null; }
    if (!a) return null;
    try { a.loop = true; a.volume = 1; a.preload = 'auto'; } catch (e) { /* 그대로 */ }
    a.addEventListener('pause', onAudioPause);
    audio = a;
    selfPauses = 0;
    return audio;
  }

  /** 거부되면 조용히 센다 — 낭독을 막지 않는다. */
  function playAudio() {
    if (!audio) return;
    let p = null;
    try { p = audio.play(); } catch (e) { stats.audioRejects++; return; }
    if (p && typeof p.catch === 'function') p.catch(function () { stats.audioRejects++; });
  }

  function pauseAudio() {
    if (!audio) return;
    if (!audio.paused) selfPauses++;               // 이미 멈춘 요소는 pause 이벤트를 내지 않는다
    try { audio.pause(); } catch (e) { /* 그대로 */ }
  }

  /** 리더를 떠남 — `src` 를 없애야 알림이 사라진다(`[출처]` C). */
  function dropAudio() {
    const a = audio;
    if (!a) return;
    audio = null;
    try { a.removeEventListener('pause', onAudioPause); } catch (e) { /* 그대로 */ }
    try { a.pause(); } catch (e) { /* 그대로 */ }
    try { if (typeof a.removeAttribute === 'function') a.removeAttribute('src'); else a.src = ''; } catch (e) { /* 그대로 */ }
    try { if (typeof a.load === 'function') a.load(); } catch (e) { /* 그대로 */ }
    selfPauses = 0;
  }

  /** 재동기화(5절) — 우리가 부르지 않은 `pause` 가 읽는 중에 오면 한 번 다시. 같은 문장에서 두 번째면 포기하고 센다. */
  function onAudioPause() {
    if (selfPauses > 0) { selfPauses--; return; }
    if (!armed || !audio || !isReading(state())) return;
    const key = sentenceKey();
    if (fightKey === key) { stats.focusFights++; return; }
    fightKey = key;
    stats.resyncs++;
    playAudio();
  }

  function sentenceKey() {
    let i = -1;
    try { i = sp.getIndex(); } catch (e) { i = -1; }
    return String(metaNow().page) + ':' + i;
  }

  /** speaker `statechange` — `setState` 가 `play()` 안에서 동기로 내므로 [▶] 탭 제스처 안에서 `audio.play()` 가 나간다. */
  function onState() {
    if (!armed) return;
    const s = state();
    setPlayback(playbackStateOf(s));
    if (isReading(s)) {
      endHold();
      if (cfg.SESSION === 'audio' && ensureAudio() && audio.paused) playAudio();
    } else {
      pauseAudio();
      fightKey = null;
    }
    syncPosition();
  }

  /* ── 9-D7 위치 막대 — 한 곳 ───────────────────────────── */

  function syncPosition() {
    if (!armed || cfg.POSITION !== 'sentence' || typeof ms.setPositionState !== 'function') return;
    let i = 0;
    let n = 0;
    try { i = sp.getIndex(); n = sp.getTotal(); } catch (e) { return; }
    const p = positionOf(cfg.POSITION, i, n);
    try { ms.setPositionState(p); } catch (e) { /* 값 거부 — 막대 없이 */ }
  }

  /* ── 멈춤 유지 Wake Lock(9-D3) — 자기 sentinel. speaker 의 wakeLock 과 섞지 않는다 ── */

  function releaseLock(lock) {
    if (lock && typeof lock.release === 'function') { try { lock.release(); } catch (e) { /* 이미 풀림 */ } }
  }

  function startHold() {
    endHold();
    if (getSetting('tts.wakeLock') === false) return;
    if (isHidden()) return;                         // 숨김 중에는 거부된다(→ 배너) — 잡지 않는다
    if (typeof d.holdWakeLock !== 'function') return;
    const h = { timer: null, lock: null };
    hold = h;
    stats.holds++;
    h.timer = timers.setTimeout(function () { if (hold === h) endHold(); }, cfg.PAUSE_HOLD_MS);
    let p = null;
    try { p = d.holdWakeLock(cfg.PAUSE_HOLD_MS); } catch (e) { p = null; }
    Promise.resolve(p).then(function (lock) {
      if (hold === h) h.lock = lock || null;
      else releaseLock(lock);                       // 그 사이 재생·떠남·숨김 — 늦게 온 잠금은 곧장 푼다
    }, function () { /* 거부 — 화면 시간 제한을 따른다 */ });
  }

  function endHold() {
    const h = hold;
    if (!h) return;
    hold = null;
    if (h.timer != null) timers.clearTimeout(h.timer);
    releaseLock(h.lock);
  }

  /* ── 메타데이터 — 쪽이 그려질 때·UI 언어가 바뀔 때만(문장마다 아님) ── */

  function refreshMeta() {
    if (!armed || !ms) return;
    const m = metaNow();
    const page = Number(m.page) || 0;
    const count = Number(m.pageCount) || 0;
    const title = String(m.title || '');
    const artist = tr('handsfree.pageOf', { page: fmt(page), count: count > 0 ? fmt(count) : '…' });
    const key = title + '\u0000' + artist;
    if (key === lastMetaKey) return;
    lastMetaKey = key;
    if (!Meta) return;
    try {
      ms.metadata = new Meta({
        title: title,
        artist: artist,
        album: ALBUM,
        artwork: ARTWORK.map(function (a) { return { src: a.src, sizes: a.sizes, type: a.type }; })
      });
      stats.metaBuilds++;
    } catch (e) { /* 메타데이터 없이 — 단추는 그대로 */ }
  }

  /* ── 켜기 · 끄기 ─────────────────────────────────── */

  /** 리더에 들어옴(쪽이 그려질 때마다 불러도 된다 — 처음 한 번만 건다). @returns {boolean} 걸려 있는가 */
  function arm() {
    if (!ms || !sp) return false;
    if (getSetting('tts.mediaKeys') === false) { if (armed) disarm(); return false; }
    if (!armed) {
      armed = true;
      lastMetaKey = null;
      fightKey = null;
      setHandlers(true);
      setPlayback(playbackStateOf(state()));        // 오디오는 건드리지 않는다 — 첫 소리는 [▶] 제스처 안에서
    }
    refreshMeta();
    return true;
  }

  /** 리더를 떠남 — 핸들러 null · metadata null · 'none' · 오디오 정리 · 유지 잠금 풀기. */
  function disarm() {
    endHold();
    dropAudio();
    fightKey = null;
    lastMetaKey = null;
    if (!armed) return;
    armed = false;
    if (!ms) return;
    setHandlers(false);
    try { ms.metadata = null; } catch (e) { /* 그대로 */ }
    setPlayback('none');
    if (cfg.POSITION === 'sentence' && typeof ms.setPositionState === 'function') {
      try { ms.setPositionState(null); } catch (e) { /* 그대로 */ }
    }
  }

  /** 문서가 숨겨졌다 — 유지 잠금을 푼다(브라우저도 푼다 — 우리 기록을 맞춘다). 낭독 멈춤은 6-4 핸들러가 한다. */
  function onHidden() { endHold(); }

  if (sp && ms) {
    sp.addEventListener('statechange', onState);
    if (cfg.POSITION === 'sentence') {
      sp.addEventListener('queue', syncPosition);
      sp.addEventListener('linechange', syncPosition);
    }
  }

  return {
    arm: arm,
    disarm: disarm,
    refreshMeta: refreshMeta,
    onHidden: onHidden,
    /** `__medreader.tts.handsfree()` — 키·원문·제목 없음. */
    debug: function () {
      return {
        supported: !!ms,
        armed: armed,
        session: cfg.SESSION,
        position: cfg.POSITION,
        mediaKeys: getSetting('tts.mediaKeys') !== false,
        state: state(),
        playbackState: ms ? ms.playbackState : null,
        audio: audio ? (audio.paused ? 'paused' : 'playing') : 'none',
        holding: !!hold,
        actions: Object.assign({}, stats.actions),
        ignored: stats.ignored,
        resyncs: stats.resyncs,
        focusFights: stats.focusFights,
        audioRejects: stats.audioRejects,
        holds: stats.holds,
        metaBuilds: stats.metaBuilds
      };
    }
  };
}
