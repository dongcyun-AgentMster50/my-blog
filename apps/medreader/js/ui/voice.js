/* ============================================================
   MedReader — 음성 명령: 마이크 단추 · 흐름 · 안내 (spec 17-1-2 3·5·8절 · 9b-2)

   ── 이 파일이 하는 일 ───────────────────────────────────
   9b-1 의 두 모듈(`voice/commands.js` 매칭 · `voice/listen.js` 한 번 듣기)을 리더 낭독에 잇는다.
     · 하단 바 마이크 단추(56px, [속도] 뒤) — 탭 한 번 = 한 번 듣기, 듣는 중 다시 탭 = 취소(결정 9b-D1·D2).
     · 흐름(3절): 첫 사용이면 고지 카드 → 읽는 중이면 `speaker.pause()` → **같은 동기 호출 안에서** `listen.start()`(S5)
       → 결과 → 매칭 → 명령 실행 → 확인 줄 2초. 실패 → 상태 줄 + 짧은 음성 한 마디 + 원래 상태로 되돌림(결정 9b-D8).
     · 명령은 speaker **공개 함수**와 [▶] 와 같은 `pressPlay()` 만 부른다 — 8d·8i-3·8m·readalong·9a 는 화면 단추를 눌렀을 때와
       같은 길로 돈다. 번역 켜기·끄기는 설정 화면과 같은 `setReadalongMode`(주입) + `syncReadalong`(주입).
     · 설정 화면의 "음성 명령" 묶음 — 켜기·명령 언어·실패 음성·[말해 보기](실행 없이 듣기만)·[결과 복사]·명령 목록.

   ── 지키는 것 ───────────────────────────────────────────
   · 흐름 함수(`createVoice`)는 **브라우저 전역을 읽지 않는다** — 인식기 생성자·speaker·설정·그리기는 전부 주입
     (tests/voice-ui-9b.test.mjs 가 진짜 `createSpeaker` 로 잰다). 기능 감지·DOM 은 아래 4절(배선 도우미)과 controls 몫.
   · UI 계약(9b-1 Review 9b1R-8 3): 상태는 **이벤트로** 그린다 · `end` 는 그 누름의 끝 · 인식기 이벤트 핸들러 안에서
     `abort()`·`start()` 를 부르지 않는다(듣는 중일 때만 `abort()` — 핸들러 안에서는 이미 듣는 중이 아니다).
   · 손이 이긴다(3절): 듣는 중·안내 중 [▶]·[이전]·[다음]·9a 단추·줄 탭 → `cancel()`(되돌림 없음) 뒤 그 단추는 평소대로.
     읽기가 다른 길로 시작되면(statechange → 읽는 중) 듣기를 스스로 취소한다.
   · 인식된 글자는 **메모리에만**(최근 `VOICE.HISTORY`) — 저장·전송·AI 호출 0(8절).
   · `innerHTML` 0 — 글자는 전부 `textContent`, 아이콘은 `createElementNS`.

   import 방향(3-2): ui 계층 — config · i18n · settings(서비스) · voice/*(순수·서비스). 리더·controls·ui/settings 를 import 하지 않는다
   (ui/settings.js 가 이 파일의 설정 묶음 함수를 부른다 — 반대 방향은 주입).
   ============================================================ */

import { VOICE } from '../config.js';
import { t as tDefault, applyTranslations, getLang } from '../i18n/index.js';
import * as settingsStore from '../settings.js';
import { matchCommand, resolveCmdLang, stepRate, VOICE_COMMANDS, commandById } from '../voice/commands.js';
import { createListener, isInfra, CODES } from '../voice/listen.js';

/** "읽는 중" — speaking·waiting-page(9a `isReading` 과 같은 뜻). */
export function isReading(state) { return state === 'speaking' || state === 'waiting-page'; }

/** 분류 코드 → 상태 줄 키(5절 표 + 9b-1 B4·B5). null = 문구 없음(`aborted` — 우리가 부르지 않은 중단). */
export const ERROR_KEYS = Object.freeze({
  [CODES.PERMISSION]: 'voice.err.permission',
  [CODES.BUSY]: 'voice.err.busy',
  [CODES.SERVICE]: 'voice.err.service',
  [CODES.NETWORK]: 'voice.err.network',
  [CODES.OFFLINE]: 'voice.err.offline',
  [CODES.MIC]: 'voice.err.mic',
  [CODES.LANG]: 'voice.err.lang',
  [CODES.NO_SPEECH]: 'voice.noSpeech',
  [CODES.NO_MATCH]: 'voice.noMatch',
  [CODES.ABORTED]: null,
  [CODES.UNSUPPORTED]: 'voice.unsupported'
});

/** 명령 id → 확인 줄의 이름 키(`explain` 은 꺼진 자리 — "아직 없는 기능"). */
export function commandKey(id) { return 'voice.cmd.' + id; }

/* ════════════════════════════════════════════════════════
   1. 최근 기록 — 메모리만(8절). [말해 보기]·[결과 복사]·`__medreader.voice()` 가 같이 본다.
   ════════════════════════════════════════════════════════ */

const history = [];

/** 기록 하나를 앞에 넣는다(최근 `VOICE.HISTORY` 개). 글자·명령·태그·ms·오류 — 키·원서 문장 없음. */
export function recordHistory(rec) {
  history.unshift(Object.freeze(Object.assign({}, rec)));
  if (history.length > VOICE.HISTORY) history.length = VOICE.HISTORY;
}

/** 사본(새 배열 · 얼린 항목). */
export function historySnapshot() { return history.map((r) => Object.assign({}, r)); }

/** 테스트용. */
export function clearHistory() { history.length = 0; }

/** [결과 복사] 글자 — 한 줄에 한 번(최근 것이 위). */
export function historyText(list) {
  const rows = Array.isArray(list) ? list : history;
  return rows.map((r) => {
    const heard = (r.heard || []).map((s) => '«' + s + '»').join(' | ');
    const what = r.error ? 'error=' + r.error : 'cmd=' + (r.id || '-') + (r.altIndex >= 0 ? '@' + r.altIndex : '');
    return [new Date(r.at || 0).toISOString(), r.kind || 'cmd', r.lang || '', r.tag || '', (r.ms | 0) + 'ms', what,
      (r.tried || []).join('>'), heard].join('\t');
  }).join('\n');
}

/** 인식기 결과·오류 → 기록 한 줄. */
function makeRecord(kind, lang, d, m, now) {
  const alts = (d && d.alternatives) || [];
  return {
    at: now, kind: kind, lang: lang,
    tag: (d && d.tag) || '', tried: ((d && d.tried) || []).slice(), ms: (d && d.ms) || 0,
    heard: alts.map((a) => String(a.transcript || '')),
    conf: alts.map((a) => (a.confidence == null ? null : a.confidence)),
    id: m ? m.id : null, enabled: m ? m.enabled : false, altIndex: m ? m.altIndex : -1, how: m ? m.how : null,
    trace: m ? m.trace.map((x) => x.result + (x.ids ? ':' + x.ids.join('/') : '')) : [],
    error: d && d.code ? d.code : null
  };
}

/* ════════════════════════════════════════════════════════
   2. 흐름 — DOM 없이(주입만)
   ════════════════════════════════════════════════════════ */

/**
 * @param {Object} deps
 * @param {Function|null} deps.Recognition   인식기 생성자(없으면 단추 없음 — `supported()` 거짓)
 * @param {Function} [deps.available]        `SpeechRecognition.available`(있으면 리더 진입 때 사다리 미리 확인)
 * @param {Object}   [deps.permissions]      `navigator.permissions`(마이크 상태 — not-allowed 의 두 뜻 가르기, B4)
 * @param {Object}   deps.speaker            `createSpeaker()` — 공개 함수만
 * @param {Function} deps.pressPlay          [▶] 와 같은 함수(동기)
 * @param {Function} [deps.syncReadalong]    유효 번역 모드 다시 계산(controls)
 * @param {Function} [deps.paintRate]        속도 글자 다시 그리기(controls)
 * @param {Function} [deps.setReadalongMode] `ui/settings.js` 의 같은 이름(저장 + lastOn + 줄 다시 그리기)
 * @param {Function} [deps.lastOnMode]       `ui/settings.js` 의 같은 이름
 * @param {Function} deps.getSetting         `(key) => value`
 * @param {Function} [deps.setSetting]       `(key, value) => Promise`
 * @param {Function} [deps.uiLang]           `() => 'ar'|'en'|'fr'|'ko'`
 * @param {Function} [deps.t]                i18n `t`
 * @param {Function} [deps.onLine]           `() => boolean`
 * @param {Object}   [deps.synth]            `speechSynthesis`(음성 한 마디)
 * @param {Function} [deps.makeUtterance]    `(text) => SpeechSynthesisUtterance`
 * @param {Function} [deps.sayVoice]         `(lang) => {tag, voice}` — 8k 해석(`langSpeechOf`)
 * @param {Function} [deps.vibrate]          `(ms) => void`
 * @param {Object}   [deps.timers]           `{setTimeout, clearTimeout}`
 * @param {Function} [deps.now]              ms 시계
 * @param {Object}   [deps.view]             `{paint({visible, listening}), status(msg|null), notice(open, handlers)}`
 * @param {Object}   [deps.listener]         미리 만든 듣기 서비스(테스트) — 없으면 `createListener`
 */
export function createVoice(deps) {
  const d = deps || {};
  const sp = d.speaker;
  const tr = typeof d.t === 'function' ? d.t : tDefault;
  const get = typeof d.getSetting === 'function' ? d.getSetting : function () { return undefined; };
  const set = typeof d.setSetting === 'function' ? d.setSetting : function () { return Promise.resolve(); };
  const uiLang = typeof d.uiLang === 'function' ? d.uiLang : function () { return 'en'; };
  const now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
  // ★ 브라우저 `setTimeout` 은 this 가 window 여야 한다 — 감싸서 부른다(speaker.js 와 같은 함정).
  const timers = d.timers || {
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };
  const view = d.view || { paint: function () { }, status: function () { }, notice: function () { } };

  let mic = null;            // 'granted'|'denied'|'prompt'|null — 리더 진입 때 물어 둔다
  let micAsked = false;
  const preflighted = new Set();

  const listener = d.listener || createListener({
    Recognition: d.Recognition || null,
    available: d.available,
    timers: timers,
    now: now,
    onLine: function () { try { return d.onLine ? d.onLine() !== false : true; } catch (e) { return true; } },
    micState: function () { return mic; },
    loadTag: function () { return String(get('voice.tag') || ''); },
    saveTag: function (tag) { set('voice.tag', tag).catch(function () { }); }
  });

  let flow = null;           // 지금 누름 {was, lang}
  let sayJob = null;         // 실패 안내 한 마디 {was, u, timer}
  let statusTimer = null;
  const saidInfra = new Set();   // 같은 인프라 실패는 두 번째부터 음성 없이(세션 동안 — 5절)
  const stats = { presses: 0, cancels: 0, says: 0, restores: 0, commands: {} };

  function state() { try { return sp ? sp.getState() : 'idle'; } catch (e) { return 'idle'; } }
  function supported() { return listener.isSupported(); }
  function visible() { return supported() && get('voice.enabled') !== false; }
  function busyNow() { return listener.isListening() || !!sayJob; }

  function paint() { try { view.paint({ visible: visible(), listening: listener.isListening() }); } catch (e) { /* 그리기 실패가 흐름을 막지 않는다 */ } }

  /** 상태 줄 — `{text, kind, list}` 또는 null. `hold` ms 뒤 저절로 지운다(0 = 그대로). */
  function status(msg, hold) {
    if (statusTimer !== null) { timers.clearTimeout(statusTimer); statusTimer = null; }
    try { view.status(msg); } catch (e) { /* 그대로 */ }
    if (msg && hold > 0) {
      statusTimer = timers.setTimeout(function () { statusTimer = null; try { view.status(null); } catch (e) { /* 그대로 */ } }, hold);
    }
  }

  /* ── 되돌림 ─────────────────────────────────────── */

  /** 멈춰 있으면 [▶] 와 같은 함수로 읽기를 다시 시작한다(그 문장부터 — 6-1 resume). */
  function resume() { if (!isReading(state()) && sp) d.pressPlay(); }
  function restore(was) { if (isReading(was)) { stats.restores++; resume(); } }

  /** 실패 안내 한 마디 — 끝나면(onend·onerror·상한 SAY_MAX_MS) 되돌린다. 꺼져 있거나 엔진이 없으면 곧장 되돌린다. */
  function say(key, was) {
    if (get('voice.sayErrors') === false || !d.synth || typeof d.makeUtterance !== 'function') { restore(was); return; }
    let u = null;
    try {
      u = d.makeUtterance(tr(key));
      const lang = uiLang();
      const sv = typeof d.sayVoice === 'function' ? (d.sayVoice(lang) || {}) : {};
      if (sv.tag) u.lang = sv.tag;
      if (sv.voice) u.voice = sv.voice;
    } catch (e) { restore(was); return; }
    const job = { was: was, u: u, timer: null };   // ★ u 를 붙들어 둔다 — GC 로 onend 를 잃지 않게(6-4 (2))
    const done = function () {
      if (sayJob !== job) return;
      sayJob = null;
      if (job.timer !== null) { timers.clearTimeout(job.timer); job.timer = null; }
      restore(job.was);
    };
    sayJob = job;
    u.onend = done;
    u.onerror = done;
    job.timer = timers.setTimeout(done, VOICE.SAY_MAX_MS);
    stats.says++;
    try { d.synth.speak(u); } catch (e) { done(); }
  }

  /** 안내 한 마디를 거둔다(되돌림 없이). */
  function stopSay() {
    const j = sayJob;
    if (!j) return;
    sayJob = null;
    if (j.timer !== null) { timers.clearTimeout(j.timer); j.timer = null; }
    try { if (d.synth && d.synth.cancel) d.synth.cancel(); } catch (e) { /* 이미 끝남 */ }
  }

  /* ── 명령 실행 (4절 표의 "뒤 상태") ─────────────────── */

  function confirm(id, heard) {
    status({ text: tr('voice.heard', { text: heard, cmd: tr(commandKey(id)) }), kind: 'confirm' }, VOICE.CONFIRM_MS);
  }

  function exec(id, was, heard) {
    stats.commands[id] = (stats.commands[id] || 0) + 1;
    switch (id) {
      case 'play':
        resume();                                  // 읽던 중이었으면 그 문장부터 · 멈춤이었으면 재생(스캔본 안내 포함)
        break;
      case 'pause':
        break;                                     // 멈춤 유지 — was 와 무관하게 되돌리지 않는다
      case 'next': {
        const i0 = sp.getIndex();
        sp.next();                                 // 멈춘 채 — 하이라이트만(6-1)
        if (isReading(was)) {
          // 쪽 끝 — 멈춘 채로는 넘어가지 않는다(9-D5). 읽던 중이었으면 화면 [다음] 과 같게 다음 쪽으로: 읽기를 잇고 한 번 더.
          if (sp.getIndex() === i0 && i0 >= sp.getTotal() - 1) { resume(); sp.next(); } else resume();
        }
        break;
      }
      case 'prev':
        sp.prev();
        restore(was);
        break;
      case 'again':
        sp.again();                                // 원문부터(번역 단계에서 멈췄어도 — 9b-D10)
        restore(was);
        break;
      case 'trOn':
      case 'trOff': {
        const cur = get('readalong.mode');
        if (id === 'trOff' && cur !== 'off' && d.setReadalongMode) d.setReadalongMode('off');
        if (id === 'trOn' && cur === 'off' && d.setReadalongMode) {
          d.setReadalongMode(typeof d.lastOnMode === 'function' ? d.lastOnMode(get) : 'speak');
        }
        // 유효 모드 다시 계산은 한 번 — 되돌림이면 [▶] 와 같은 함수(pressPlay)가 그 안에서 한다.
        if (isReading(was)) resume();
        else if (d.syncReadalong) d.syncReadalong();
        break;
      }
      case 'slower':
      case 'faster': {
        const r = stepRate(sp.getRate(), id === 'faster' ? 1 : -1);
        if (r.edge) {
          const k = r.edge === 'min' ? 'voice.rate.min' : 'voice.rate.max';
          status({ text: tr(k), kind: 'info' }, VOICE.NOTICE_MS);
          say(k, was);
          return;
        }
        sp.setRate(r.rate);
        if (d.paintRate) { try { d.paintRate(); } catch (e) { /* 그리기 실패가 낭독을 막지 않는다 */ } }
        set('tts.rate', sp.getRate()).catch(function () { });
        restore(was);
        break;
      }
      default:
        return;
    }
    confirm(id, heard);
  }

  /* ── 인식기 이벤트 → 흐름 ─────────────────────────── */

  function onResult(ev) {
    const f = flow;
    flow = null;
    if (!f) return;
    const det = ev.detail || {};
    const m = matchCommand(det.alternatives, f.lang);
    recordHistory(makeRecord('cmd', f.lang, det, m, now()));
    if (!m.id) {
      status({ text: tr('voice.noMatch', { text: m.heard }), kind: 'error', list: true }, VOICE.NOTICE_MS);
      say('voice.noMatch.say', f.was);
      return;
    }
    if (!m.enabled) {                                   // explain — 표에 자리만(9b-D14)
      status({ text: tr('voice.notYet'), kind: 'info' }, VOICE.NOTICE_MS);
      say('voice.notYet', f.was);
      return;
    }
    exec(m.id, f.was, m.heard);
  }

  function onError(ev) {
    const f = flow;
    flow = null;
    const det = ev.detail || {};
    const code = det.code;
    if (code === CODES.UNSUPPORTED) { paint(); return; }
    if (!f) return;
    recordHistory(makeRecord('cmd', f.lang, det, null, now()));
    if (code === CODES.ABORTED) { status(null); restore(f.was); return; }        // 문구 없음 · 되돌림(9b-1 B5 제안)
    if (code === CODES.NO_SPEECH) {                                            // 음성 없음 — 되돌림 소리로 충분(5절)
      status({ text: tr('voice.noSpeech'), kind: 'info' }, VOICE.NOTICE_MS);
      restore(f.was);
      return;
    }
    if (code === CODES.NO_MATCH) {
      status({ text: tr('voice.noMatch', { text: '' }), kind: 'error', list: true }, VOICE.NOTICE_MS);
      say('voice.noMatch.say', f.was);
      return;
    }
    const key = ERROR_KEYS[code] || ERROR_KEYS[CODES.SERVICE];
    const text = tr(key) + (isInfra(code) ? ' ' + tr('voice.earphoneOk') : '');
    status({ text: text, kind: 'error', code: code }, VOICE.NOTICE_MS);
    if (isInfra(code) && saidInfra.has(code)) { restore(f.was); return; }     // 두 번째부터 음성 없이(5절)
    if (isInfra(code)) saidInfra.add(code);
    say('voice.say.fail', f.was);
  }

  listener.addEventListener('result', onResult);
  listener.addEventListener('error', onError);
  listener.addEventListener('cancel', function () { flow = null; status(null); });
  // 사다리 한 칸 — 같은 누름 안에서 다시 듣는다. 소리를 내지 않는다(마이크에 들어간다).
  listener.addEventListener('fallback', function () { status({ text: tr('voice.noMatch.say'), kind: 'info' }, 0); });
  listener.addEventListener('end', paint);

  // 손이 이긴다 — 다른 길(줄 탭·검색·9a)로 읽기가 시작되면 듣기·안내를 거둔다(되돌림 없음).
  if (sp && typeof sp.addEventListener === 'function') {
    sp.addEventListener('statechange', function () { if (busyNow() && isReading(state())) cancel(); });
  }

  /* ── 공개 ─────────────────────────────────────────── */

  /** 듣기 한 번 시작 — 흐름 3절 2·3. **동기**(S5): pause 다음 같은 호출 안에서 start. */
  function begin(carryWas) {
    const st = state();
    const was = carryWas != null ? carryWas : st;
    if (isReading(st)) sp.pause();                     // = cancel() — 꼬리 소리가 마이크에 들어가지 않게(S9)
    const lang = resolveCmdLang(get('voice.cmdLang'), uiLang());
    flow = { was: was, lang: lang };
    listener.start(lang);                              // ★ await 없음
    if (listener.isListening()) {                      // 반환값이 아니라 지금 상태로(낮음-6) — 그 자리에서 끝났으면 이미 그렸다
      status({ text: tr('voice.listening'), kind: 'listening' }, 0);
      if (typeof d.vibrate === 'function') { try { d.vibrate(20); } catch (e) { /* 진동 없음 */ } }
    }
    paint();
  }

  /** 마이크 단추 탭 — **동기**. */
  function press() {
    if (!visible()) return;
    stats.presses++;
    if (listener.isListening()) { cancel(); return; }  // 듣는 중 다시 탭 = 취소(되돌림 없음)
    let carry = null;
    if (sayJob) { carry = sayJob.was; stopSay(); }       // 안내 중 다시 탭 — 그 누름의 되돌림을 이어받는다
    if (!get('voice.noticeAt')) {
      // 첫 사용 고지 카드(8절) — [시작] 탭이 그 제스처 안에서 흐름을 시작한다.
      try {
        view.notice(true, {
          start: function () {
            set('voice.noticeAt', Math.max(1, now())).catch(function () { });   // 0 = 아직 — 시계가 0 이어도 본 것으로
            try { view.notice(false); } catch (e) { /* 그대로 */ }
            begin(carry);
          },
          cancel: function () { try { view.notice(false); } catch (e) { /* 그대로 */ } restore(carry); }
        });
      } catch (e) { /* 카드 없이 — 듣지 않는다 */ }
      return;
    }
    begin(carry);
  }

  /** 사용자 취소 — 다시 탭·9a 단추·화면 단추·hidden·리더 떠남. 되돌림 없음. */
  function cancel() {
    if (!busyNow()) return false;
    stats.cancels++;
    stopSay();
    flow = null;
    if (listener.isListening()) listener.abort();       // 핸들러 밖에서만 이 줄에 닿는다(핸들러 안에서는 듣는 중이 아니다)
    status(null);
    paint();
    return true;
  }

  /** 리더에 들어옴·쪽이 그려짐 — 단추를 다시 그리고, 마이크 상태·언어 사다리를 제스처 밖에서 미리 묻는다. */
  function arm() {
    paint();
    if (!visible()) return;
    if (!micAsked && d.permissions && typeof d.permissions.query === 'function') {
      micAsked = true;
      try {
        Promise.resolve(d.permissions.query({ name: 'microphone' })).then(function (p) {
          if (!p) return;
          mic = p.state || null;
          try { p.onchange = function () { mic = p.state || null; }; } catch (e) { /* 그대로 */ }
        }, function () { mic = null; });
      } catch (e) { mic = null; }
    }
    const lang = resolveCmdLang(get('voice.cmdLang'), uiLang());
    if (!preflighted.has(lang)) {
      preflighted.add(lang);
      try { Promise.resolve(listener.preflight(lang)).catch(function () { }); } catch (e) { /* 그대로 */ }
    }
  }

  /** 리더를 떠남 — 듣기·안내·카드·상태 줄을 거둔다. */
  function leave() {
    cancel();
    try { view.notice(false); } catch (e) { /* 그대로 */ }
    status(null);
  }

  return {
    press: press,
    cancel: cancel,
    arm: arm,
    leave: leave,
    onHidden: function () { cancel(); },
    supported: supported,
    visible: visible,
    /** 듣는 중이거나 실패 안내 뒤 되돌림을 기다리는 중 — 9a 단추·화면 단추가 이것이 참이면 먼저 `cancel()`. */
    isListening: busyNow,
    /** `__medreader.voice()` — 최근 기록(글자·명령·태그·ms)·상태. 키·원서 문장 없음. */
    debug: function () {
      return {
        supported: supported(), enabled: get('voice.enabled') !== false, listening: listener.isListening(),
        saying: !!sayJob, cmdLang: resolveCmdLang(get('voice.cmdLang'), uiLang()), tag: String(get('voice.tag') || ''),
        mic: mic, skipped: listener.skipped(), stats: JSON.parse(JSON.stringify(stats)), history: historySnapshot()
      };
    }
  };
}

/* ════════════════════════════════════════════════════════
   3. [말해 보기] — 실행 없이 한 번 듣고 보여 준다(6절 (다) · 결정 9b-D12)
   ════════════════════════════════════════════════════════ */

/**
 * 한 번 듣기 결과 → 보일 줄들(순수). 대안 전부 · 맞은 명령 · 몇 번째 대안 · 태그 · ms · 오류.
 * @returns {string[]}
 */
export function tryLines(rec, tr) {
  const t = typeof tr === 'function' ? tr : tDefault;
  if (!rec) return [];
  const out = [];
  if (rec.error) {
    const k = ERROR_KEYS[rec.error];
    out.push(t('voice.try.error', { msg: k ? t(k, { text: '' }) : rec.error, code: rec.error }));
  }
  (rec.heard || []).forEach(function (s, i) { out.push((i + 1) + '. «' + s + '»'); });
  if (!rec.error) {
    out.push(rec.id
      ? t('voice.try.result', { cmd: t(commandKey(rec.id)), n: rec.altIndex + 1, tag: rec.tag || '-', ms: rec.ms | 0 })
      : t('voice.try.nomatch', { tag: rec.tag || '-', ms: rec.ms | 0 }));
  }
  return out;
}

/**
 * [말해 보기] 서비스 — 듣기만, 실행하지 않는다. 설정 화면이 만든다(리더 밖이라 speaker 와 만나지 않는다).
 * @param {Object} deps  `{Recognition, available, getSetting, setSetting, uiLang, onLine, timers, now, listener}`
 * @param {Function} onChange  `({listening, rec})` — 그릴 때
 */
export function createTry(deps, onChange) {
  const d = deps || {};
  const get = typeof d.getSetting === 'function' ? d.getSetting : function () { return undefined; };
  const set = typeof d.setSetting === 'function' ? d.setSetting : function () { return Promise.resolve(); };
  const now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
  const listener = d.listener || createListener({
    Recognition: d.Recognition || null, available: d.available, timers: d.timers, now: now,
    onLine: function () { try { return d.onLine ? d.onLine() !== false : true; } catch (e) { return true; } },
    loadTag: function () { return String(get('voice.tag') || ''); },
    saveTag: function (tag) { set('voice.tag', tag).catch(function () { }); }
  });
  let lang = 'en';
  let last = null;
  const emit = function () { try { onChange({ listening: listener.isListening(), rec: last }); } catch (e) { /* 그대로 */ } };
  listener.addEventListener('result', function (ev) {
    const det = ev.detail || {};
    last = makeRecord('try', lang, det, matchCommand(det.alternatives, lang), now());
    recordHistory(last);
  });
  listener.addEventListener('error', function (ev) {
    const det = ev.detail || {};
    last = makeRecord('try', lang, det, null, now());
    recordHistory(last);
  });
  listener.addEventListener('end', emit);
  return {
    supported: function () { return listener.isSupported(); },
    isListening: function () { return listener.isListening(); },
    /** 탭 — **동기**. 듣는 중이면 취소. */
    press: function () {
      if (listener.isListening()) { listener.abort(); return; }
      lang = resolveCmdLang(get('voice.cmdLang'), typeof d.uiLang === 'function' ? d.uiLang() : 'en');
      listener.start(lang);
      emit();
    },
    cancel: function () { if (listener.isListening()) listener.abort(); }
  };
}

/* ════════════════════════════════════════════════════════
   4. 배선 도우미 — DOM (controls·ui/settings 가 부른다)
   ════════════════════════════════════════════════════════ */

/** 기능 감지(6-4 표) — 표준 이름 또는 접두사. 창을 받아서 본다(이 파일이 전역을 직접 읽지 않게). */
export function recognitionOf(win) {
  if (!win) return null;
  const R = win.SpeechRecognition || win.webkitSpeechRecognition || null;
  return typeof R === 'function' ? R : null;
}

/**
 * 좁은 바인가(결정 9b-D3 — 375px 이하에서 마이크까지 들어가면 진행 표시를 시각적으로만 숨긴다). **순수.**
 * @param {boolean} micVisible   마이크 단추가 보이는가(안 보이면 9b 전 바 그대로)
 * @param {boolean} mediaMatches `VOICE.BAR_TIGHT_MEDIA` 가 맞는가
 */
export function barTight(micVisible, mediaMatches) { return !!micVisible && !!mediaMatches; }

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 마이크 그림(방향 아이콘이 아니다 — 16-H 무관). */
function micIcon(doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const body = doc.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '9'); body.setAttribute('y', '3'); body.setAttribute('width', '6'); body.setAttribute('height', '11');
  body.setAttribute('rx', '3'); body.setAttribute('fill', 'currentColor');
  const arc = doc.createElementNS(SVG_NS, 'path');
  arc.setAttribute('d', 'M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6');
  arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', 'currentColor'); arc.setAttribute('stroke-width', '2');
  arc.setAttribute('stroke-linecap', 'round');
  svg.appendChild(body);
  svg.appendChild(arc);
  return svg;
}

/**
 * 리더 하단 바에 마이크 단추·상태 줄·고지 카드를 만든다(정적 HTML 에 그릇을 두지 않는다 — 기능 감지가 참일 때만 보인다).
 * @param {Object} o  `{root, bar, after}` — after = [속도] 단추(그 뒤에 넣는다 — 논리 순서 끝, 아랍어에서는 저절로 왼쪽 끝)
 * @returns {{view, button}|null}
 */
export function mountVoice(o) {
  const root = o && o.root;
  const bar = o && o.bar;
  if (!root || !bar || typeof document === 'undefined') return null;
  const doc = document;

  let btn = bar.querySelector('#ttsMic');
  if (!btn) {
    btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'ttsMic';
    btn.className = 'tts-btn tts-mic';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('data-i18n-aria', 'voice.btn');
    btn.hidden = true;
    btn.appendChild(micIcon(doc));
    const after = o.after && o.after.parentNode === bar ? o.after : null;
    bar.insertBefore(btn, after ? after.nextSibling : null);
  }

  // 상태 줄 — 바 위에 뜨는 한 줄(aria-live). [명령 보기] 는 설정 음성 묶음으로(`data-nav` 전역 위임).
  let box = root.querySelector('#voiceStatus');
  if (!box) {
    box = doc.createElement('div');
    box.id = 'voiceStatus';
    box.className = 'voice-status';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.hidden = true;
    const text = doc.createElement('span');
    text.className = 'voice-status-text';
    const link = doc.createElement('button');
    link.type = 'button';
    link.className = 'link voice-status-list';
    link.setAttribute('data-nav', '#/settings/voice');
    link.setAttribute('data-i18n', 'voice.noMatch.list');
    link.hidden = true;
    box.appendChild(text);
    box.appendChild(link);
    root.appendChild(box);
  }

  // 첫 사용 고지 카드(8절) — 마이크를 처음 누를 때 한 번.
  let card = root.querySelector('#voiceNotice');
  if (!card) {
    card = doc.createElement('div');
    card.id = 'voiceNotice';
    card.className = 'voice-notice';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'voiceNoticeTitle');
    card.hidden = true;
    const h = doc.createElement('h2');
    h.id = 'voiceNoticeTitle';
    h.setAttribute('data-i18n', 'voice.notice.title');
    const p1 = doc.createElement('p');
    p1.setAttribute('data-i18n', 'voice.notice.body');
    const p2 = doc.createElement('p');
    p2.className = 'muted';
    p2.setAttribute('data-i18n', 'voice.notice.once');
    const row = doc.createElement('div');
    row.className = 'row voice-notice-actions';
    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.setAttribute('data-voice-notice', 'cancel');
    cancel.setAttribute('data-i18n', 'common.cancel');
    const start = doc.createElement('button');
    start.type = 'button';
    start.className = 'primary';
    start.setAttribute('data-voice-notice', 'start');
    start.setAttribute('data-i18n', 'voice.notice.start');
    row.appendChild(cancel);
    row.appendChild(start);
    card.appendChild(h);
    card.appendChild(p1);
    card.appendChild(p2);
    card.appendChild(row);
    root.appendChild(card);
  }
  applyTranslations(bar);
  applyTranslations(box);
  applyTranslations(card);

  let noticeHandlers = null;
  card.addEventListener('click', function (ev) {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-voice-notice]') : null;
    if (!b || !noticeHandlers) return;
    const h = noticeHandlers;
    if (b.getAttribute('data-voice-notice') === 'start') h.start();   // ★ 탭 제스처 안에서 곧장 듣기 시작
    else h.cancel();
  });

  // 좁은 바(결정 9b-D3) — 미디어 조건은 `VOICE.BAR_TIGHT_MEDIA` 한 곳, 켜고 끄는 곳은 `barTight()` 한 곳.
  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(VOICE.BAR_TIGHT_MEDIA) : null;
  let micOn = false;
  function syncTight() { bar.setAttribute('data-bar-tight', barTight(micOn, !!(mq && mq.matches)) ? 'on' : 'off'); }
  if (mq) {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncTight);
    else if (typeof mq.addListener === 'function') mq.addListener(syncTight);
  }

  const view = {
    paint: function (s) {
      btn.hidden = !s.visible;
      micOn = !!s.visible;
      syncTight();
      bar.setAttribute('data-voice', s.visible ? 'on' : 'off');
      btn.setAttribute('aria-pressed', s.listening ? 'true' : 'false');
      btn.setAttribute('data-listening', s.listening ? 'true' : 'false');
    },
    status: function (msg) {
      const text = box.querySelector('.voice-status-text');
      const link = box.querySelector('.voice-status-list');
      if (!msg) { box.hidden = true; text.textContent = ''; link.hidden = true; box.removeAttribute('data-kind'); return; }
      text.textContent = msg.text || '';
      link.hidden = !msg.list;
      box.setAttribute('data-kind', msg.kind || 'info');
      box.hidden = false;
    },
    notice: function (open, handlers) {
      noticeHandlers = open ? handlers || null : null;
      card.hidden = !open;
      if (open) {
        applyTranslations(card);
        const s = card.querySelector('[data-voice-notice="start"]');
        if (s && typeof s.focus === 'function') { try { s.focus({ preventScroll: true }); } catch (e) { /* 그대로 */ } }
        card.scrollTop = 0;   // 제목·본문부터 보인다(가로 화면에서 카드 안 스크롤이 생겨도)
      }
    }
  };
  return { view: view, button: btn };
}

/**
 * 설정 화면 "음성 명령" 묶음 — 정적 HTML 에 그릇을 두지 않는다(반쪽 캐시 대비). 낭독 목소리 카드 뒤에 카드 하나.
 * @param {Element} screen  설정 화면 `<section>`
 * @param {Object} deps  `{Recognition, available, onLine}` — 기능 감지는 부르는 쪽(창을 읽는 곳)
 * @returns {{paint, show(tab), leave}|null}
 */
export function buildVoiceSettings(screen, deps) {
  if (!screen || typeof document === 'undefined') return null;
  const d = deps || {};
  const doc = document;
  let card = screen.querySelector('#settingsVoice');
  if (card) return card.__voice || null;

  card = doc.createElement('div');
  card.className = 'card settings-card voice-card';
  card.id = 'settingsVoice';
  const h = doc.createElement('h2');
  h.setAttribute('data-i18n', 'voice.set.title');
  card.appendChild(h);

  const unsup = doc.createElement('p');
  unsup.className = 'muted';
  unsup.setAttribute('data-i18n', 'voice.unsupported');
  unsup.hidden = !!d.Recognition;
  card.appendChild(unsup);

  function checkRow(id, key) {
    const row = doc.createElement('div');
    row.className = 'consent-row';
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    const label = doc.createElement('label');
    label.setAttribute('for', id);
    label.setAttribute('data-i18n', key);
    row.appendChild(box);
    row.appendChild(label);
    card.appendChild(row);
    return box;
  }
  const enabled = checkRow('voiceEnabled', 'voice.set.enabled');

  const langRow = doc.createElement('div');
  langRow.className = 'typeset-row';
  const head = doc.createElement('div');
  head.className = 'typeset-head';
  const lab = doc.createElement('span');
  lab.className = 'readalong-label';
  lab.id = 'voiceCmdLangLabel';
  lab.setAttribute('data-i18n', 'voice.set.cmdLang');
  head.appendChild(lab);
  langRow.appendChild(head);
  const group = doc.createElement('div');
  group.className = 'typeset-choices';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', 'voiceCmdLangLabel');
  [['auto', 'voice.set.cmdLang.auto'], ['ar', 'onboarding.lang.ar'], ['en', 'onboarding.lang.en']].forEach(function (x) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.setAttribute('data-voice-cmdlang', x[0]);
    b.setAttribute('data-i18n', x[1]);
    b.setAttribute('aria-pressed', 'false');
    group.appendChild(b);
  });
  langRow.appendChild(group);
  card.appendChild(langRow);

  const sayErr = checkRow('voiceSayErrors', 'voice.set.sayErrors');

  const n1 = doc.createElement('p');
  n1.className = 'muted';
  n1.setAttribute('data-i18n', 'voice.notice.body');
  const n2 = doc.createElement('p');
  n2.className = 'muted';
  n2.setAttribute('data-i18n', 'voice.notice.once');
  card.appendChild(n1);
  card.appendChild(n2);

  const acts = doc.createElement('div');
  acts.className = 'row';
  const tryBtn = doc.createElement('button');
  tryBtn.type = 'button';
  tryBtn.className = 'primary';
  tryBtn.id = 'voiceTry';
  tryBtn.setAttribute('aria-pressed', 'false');
  tryBtn.setAttribute('data-voice-act', 'try');
  tryBtn.setAttribute('data-i18n', 'voice.set.try');
  const copyBtn = doc.createElement('button');
  copyBtn.type = 'button';
  copyBtn.id = 'voiceCopy';
  copyBtn.setAttribute('data-voice-act', 'copy');
  copyBtn.setAttribute('data-i18n', 'voice.set.copy');
  acts.appendChild(tryBtn);
  acts.appendChild(copyBtn);
  card.appendChild(acts);
  const tryHint = doc.createElement('p');
  tryHint.className = 'muted';
  tryHint.setAttribute('data-i18n', 'voice.set.tryHint');
  card.appendChild(tryHint);
  const out = doc.createElement('div');
  out.className = 'voice-try-out';
  out.id = 'voiceTryOut';
  out.setAttribute('role', 'status');
  out.setAttribute('aria-live', 'polite');
  card.appendChild(out);
  const copyOut = doc.createElement('textarea');
  copyOut.className = 'voice-copy-out';
  copyOut.id = 'voiceCopyOut';
  copyOut.readOnly = true;
  copyOut.hidden = true;
  copyOut.setAttribute('dir', 'auto');
  copyOut.setAttribute('data-i18n-aria', 'voice.set.copy');
  card.appendChild(copyOut);

  const list = doc.createElement('details');
  list.className = 'voice-list';
  list.id = 'voiceList';
  const sum = doc.createElement('summary');
  sum.setAttribute('data-i18n', 'voice.set.list');
  const ul = doc.createElement('ul');
  list.appendChild(sum);
  list.appendChild(ul);
  card.appendChild(list);

  const after = screen.querySelector('#settingsVoices');
  if (after && after.parentNode === screen) screen.insertBefore(card, after.nextSibling);
  else screen.appendChild(card);

  const uiLang = function () { return getLang(); };
  const tester = createTry({
    Recognition: d.Recognition || null, available: d.available, onLine: d.onLine,
    getSetting: settingsStore.get, setSetting: settingsStore.set, uiLang: uiLang
  }, function () { paintTry(); });
  let shown = null;    // 이번에 보인 기록(다른 화면 기록이 섞여도 마지막 [말해 보기] 결과)

  function paintTry() {
    tryBtn.setAttribute('aria-pressed', tester.isListening() ? 'true' : 'false');
    while (out.firstChild) out.removeChild(out.firstChild);
    const snap = historySnapshot();
    const rec = snap.find(function (r) { return r.kind === 'try'; }) || null;
    shown = rec;
    const lines = tester.isListening() ? [tDefault('voice.listening')] : rec ? tryLines(rec) : [tDefault('voice.set.none')];
    lines.forEach(function (s) {
      const p = doc.createElement('p');
      p.setAttribute('dir', 'auto');
      p.textContent = s;
      out.appendChild(p);
    });
  }

  function paintList() {
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    const lang = resolveCmdLang(settingsStore.get('voice.cmdLang'), uiLang());
    VOICE_COMMANDS.forEach(function (c) {
      if (!c.enabled) return;
      const li = doc.createElement('li');
      const name = doc.createElement('strong');
      name.textContent = tDefault(commandKey(c.id));
      const words = doc.createElement('span');
      const src = lang === 'ar' ? c.ar.filter(function (w) { return !/[ً-ْ]/.test(w); }) : c.en;
      words.textContent = ' — ' + src.slice(0, 5).map(function (w) { return '«' + w + '»'; }).join(' ');
      words.setAttribute('dir', 'auto');
      words.setAttribute('lang', lang);
      li.appendChild(name);
      li.appendChild(words);
      ul.appendChild(li);
    });
  }

  function paint() {
    applyTranslations(card);
    unsup.hidden = !!d.Recognition;
    enabled.checked = settingsStore.get('voice.enabled') !== false;
    enabled.disabled = !d.Recognition;
    sayErr.checked = settingsStore.get('voice.sayErrors') !== false;
    const cl = settingsStore.get('voice.cmdLang');
    const cur = cl === 'ar' || cl === 'en' ? cl : 'auto';
    group.querySelectorAll('[data-voice-cmdlang]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-voice-cmdlang') === cur ? 'true' : 'false');
      b.disabled = !d.Recognition;
    });
    tryBtn.disabled = !d.Recognition;
    paintTry();
    paintList();
  }

  enabled.addEventListener('change', function () { settingsStore.set('voice.enabled', !!enabled.checked).catch(function () { }); });
  sayErr.addEventListener('change', function () { settingsStore.set('voice.sayErrors', !!sayErr.checked).catch(function () { }); });
  group.addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-voice-cmdlang]');
    if (!b || b.disabled) return;
    settingsStore.set('voice.cmdLang', b.getAttribute('data-voice-cmdlang')).catch(function () { });
    paint();
  });
  tryBtn.addEventListener('click', function () { tester.press(); });     // ★ 동기 — 탭 제스처 안에서 start
  copyBtn.addEventListener('click', function () {
    const text = historyText();
    const fallback = function () {
      copyOut.value = text;
      copyOut.hidden = false;
      try { copyOut.focus(); copyOut.select(); } catch (e) { /* 그대로 */ }
    };
    const clip = typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard : null;
    if (!clip || !text) { fallback(); return; }
    clip.writeText(text).then(function () {
      copyOut.hidden = true;
      const p = doc.createElement('p');
      p.className = 'muted';
      p.textContent = tDefault('voice.set.copied');
      out.appendChild(p);
    }, fallback);
  });

  const api = {
    paint: paint,
    /** `#/settings/voice` — [명령 보기]에서 왔으면 이 카드로 굴리고 목록을 연다. */
    show: function (tab) {
      paint();
      if (tab === 'voice') {
        list.open = true;
        try { card.scrollIntoView({ block: 'start' }); } catch (e) { /* 그대로 */ }
      }
    },
    leave: function () { tester.cancel(); copyOut.hidden = true; copyOut.value = ''; },
    lastShown: function () { return shown; }
  };
  card.__voice = api;
  paint();
  return api;
}
