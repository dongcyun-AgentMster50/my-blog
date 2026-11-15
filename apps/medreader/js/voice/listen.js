/* ============================================================
   MedReader — 음성 인식 서비스: 한 번 듣기 (spec 17-1-2 2·4·5·7절 · 9b-1)

   `SpeechRecognition`(Android Chrome = 서버 인식, S1·S2)을 **주입받은 생성자**로 감싼다. `window` 를 직접 읽지 않는다
   (기능 감지는 배선 — 9b-2 의 `ui/voice.js`·controls 가 `window.SpeechRecognition || window.webkitSpeechRecognition` 을 넘긴다).

   ── 한 번 듣기 ────────────────────────────────────────────
   `start(lang)` 는 **동기**로 `recognition.start()` 까지 간다 — 앞에 `await` 가 없다(S5 사용자 제스처). 단발
   (`continuous=false` · `interimResults=false` · `maxAlternatives=5`). 한 번에 하나 — 듣는 중 `start` 는 무시한다.
   한 누름은 정확히 하나의 끝 이벤트로 끝난다: `result` | `error` | `cancel`(그 뒤 `end`).
     result  {alternatives:[{transcript, confidence}], tag, ms, tried}
     error   {code, raw, tag, ms, tried}   code = 아래 `CODES`
     cancel  {tag, ms, tried}              `abort()` — 사용자가 다시 탭·9a 단추·hidden
     fallback {from, to}                   언어 사다리 한 칸 내려감 — UI 는 "다시 말해 주세요"
     end     {outcome}                     끝 이벤트 다음 한 번

   ── 언어 사다리 (4절 · 9b-D4) ──────────────────────────────
   아랍어 = `ar-SY → ar-JO → ar`, 영어 = `en-US` 하나. 처음 태그가 `language-not-supported` 면 **같은 누름 안에서**
   다음 태그로 다시 시작한다. 바로 `start()` 하지 않고 앞 인식기의 `end`(또는 `RETRY_WAIT_MS` 상한)를 기다린다 —
   앞 인식기가 아직 살아 있으면 Android 가 `RECOGNIZER_BUSY` → `not-allowed` 로 돌려줄 수 있다(S7) `[가정 — 실기기 V-1]`.
   결과가 온 태그는 주입받은 `saveTag(tag)` 로 기억해 다음 누름은 그 태그부터(`loadTag()`). 앱 설정 모듈을 import 하지 않는다.
   `available()`(정적 `SpeechRecognition.available`, 있을 때만)은 `preflight(lang)` 에서 **제스처 밖·비동기**로 —
   `'unavailable'` 인 태그만 건너뛴다. 전부 `'unavailable'` 이면 그 답을 믿지 않고 사다리 전부를 시도한다(9b-1 판단 — 보고서).

   ── 오류 분류 `classify(raw, ctx)` (5절 표 · S7) ────────────
   not-allowed → 'permission' 또는 'busy'(권한 거부만이 아니다 — 인식기 바쁨·요청 과다도 같은 값, S7) ·
   service-not-allowed·bad-grammar·모르는 값·`start()` 예외 → 'service' · network → 'offline'(`onLine()===false`) / 'network' ·
   audio-capture → 'mic' · language-not-supported(사다리 끝) → 'lang' · no-speech·앱 상한·결과 없이 end → 'noSpeech' ·
   no-match·대안 0 → 'noMatch' · aborted(우리가 부르지 않은 것) → 'aborted'.
   **오프라인이어도 막지 않고 시도한다**(9b-D9) — 실패하면 그때 'offline' 으로 분류된다.

   상수는 `config.js` 의 `VOICE` 한 곳이다(`LISTEN_DEFAULTS` = 그 값 — 9b-2 에서 옮김. `MAX_ALTS` 는 매칭과 같은 값).
   인식된 글자는 이벤트로만 넘긴다 — 저장·전송하지 않는다(8절). AI 호출 0.
   import 방향(3-2): 서비스 계층 — `config.js` 만(`VOICE` — 영어 태그 `EN_TAG` 는 config 안에서 `TTS_LANG_REGION.en` 을 가리킨다, W1).

   ── UI 계약(9b-1 Review 9b1R-8 3) ─────────────────────────
   상태는 **이벤트로** 그린다(`start()` 반환값이 아니라). `end` 는 "그 누름의 끝"이다. 이벤트 핸들러 안에서 `abort()`·`start()` 를
   부르지 않는다(`ui/voice.js` 는 지킨다). `fallback` 핸들러 안의 `abort()` 는 아래 가드로 막혀 있다(9b-2 — 낮음-3).
   ============================================================ */

import { VOICE } from '../config.js';

/** `config.js` 의 `VOICE`(spec 17-1-2 7절 `config.js` 행 + 9b-1 의 `RETRY_WAIT_MS`). `createListener({opts})` 로 덮어쓸 수 있다(테스트). */
export const LISTEN_DEFAULTS = VOICE;

/** 분류된 오류 코드 — UI 가 i18n 키로 바꾼다(보고서 표). */
export const CODES = Object.freeze({
  UNSUPPORTED: 'unsupported',   // 생성자 없음 — UI 는 단추를 그리지 않는다
  PERMISSION: 'permission',
  BUSY: 'busy',
  SERVICE: 'service',
  NETWORK: 'network',
  OFFLINE: 'offline',
  MIC: 'mic',
  LANG: 'lang',
  NO_SPEECH: 'noSpeech',
  NO_MATCH: 'noMatch',
  ABORTED: 'aborted'
});

/** 인프라 실패 — "이어폰 버튼과 화면 버튼은 그대로 됩니다" 문구 + 반복 안내 금지(5절)의 대상. */
const INFRA = new Set([CODES.PERMISSION, CODES.BUSY, CODES.SERVICE, CODES.NETWORK, CODES.OFFLINE, CODES.MIC, CODES.LANG]);
export function isInfra(code) { return INFRA.has(code); }

/**
 * 웹 오류 값 → 분류. **순수.**
 * @param {string} raw  `SpeechRecognitionErrorEvent.error`(또는 'timeout'·'start-threw'·'end-without-result'·'no-alternatives')
 * @param {Object} [ctx]
 * @param {boolean} [ctx.onLine]   `navigator.onLine` — false 일 때만 'offline'(true·모름 = 'network')
 * @param {string}  [ctx.mic]      'granted'|'denied'|'prompt'|null — `navigator.permissions` 의 마이크 상태(UI 가 미리 물어 둔 값)
 * @param {boolean} [ctx.started]  이번 시도에서 `onstart`/`onaudiostart` 가 왔나 — 듣기 시작한 뒤의 not-allowed 는 권한이 아니다
 * @param {boolean} [ctx.everOk]   이 듣기 서비스에서 결과를 한 번이라도 받았나 — 권한은 이미 있었다
 */
export function classify(raw, ctx) {
  const c = ctx || {};
  switch (raw) {
    case 'not-allowed':
      if (c.mic === 'denied') return CODES.PERMISSION;
      if (c.mic === 'granted' || c.started || c.everOk) return CODES.BUSY;
      return CODES.PERMISSION;
    case 'service-not-allowed':
    case 'bad-grammar':
    case 'phrases-not-supported':
    case 'start-threw':
      return CODES.SERVICE;
    case 'network':
      return c.onLine === false ? CODES.OFFLINE : CODES.NETWORK;
    case 'audio-capture':
      return CODES.MIC;
    case 'language-not-supported':
      return CODES.LANG;
    case 'no-speech':
    case 'timeout':
    case 'end-without-result':
      return CODES.NO_SPEECH;
    case 'no-match':
    case 'no-alternatives':
      return CODES.NO_MATCH;
    case 'aborted':
      return CODES.ABORTED;
    default:
      return CODES.SERVICE;
  }
}

/**
 * 이번 누름에 시도할 태그 순서. **순수.**
 * @param {'ar'|'en'} lang
 * @param {string} remembered   기억한 아랍어 태그('' = 없음). 사다리 안에 있으면 그 칸부터
 * @param {Set<string>|string[]} [skip]  `preflight` 가 'unavailable' 로 본 태그
 */
export function tagsFor(lang, remembered, skip, opts) {
  const o = opts || LISTEN_DEFAULTS;
  if (lang !== 'ar') return [o.EN_TAG];
  const ladder = o.AR_TAGS.slice();
  const at = ladder.indexOf(remembered);
  const from = at > 0 ? ladder.slice(at) : ladder;
  const sk = skip instanceof Set ? skip : new Set(skip || []);
  const usable = from.filter((t) => !sk.has(t));
  return usable.length ? usable : from;   // 전부 'unavailable' 이면 그 답을 믿지 않는다
}

/** 결과 이벤트 → 대안 배열 `[{transcript, confidence}]`(최대 `max`). 마지막 최종 결과를 쓴다. */
export function alternativesOf(ev, max) {
  const results = ev && ev.results;
  if (!results || !results.length) return [];
  let r = null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] && results[i].isFinal !== false) { r = results[i]; break; }
  }
  if (!r) r = results[results.length - 1];
  const out = [];
  const n = Math.min(r ? r.length || 0 : 0, max);
  for (let k = 0; k < n; k++) {
    const a = r[k];
    const tr = a && a.transcript != null ? String(a.transcript).trim() : '';
    if (!tr) continue;
    const cf = a && Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : null;
    out.push({ transcript: tr, confidence: cf });
  }
  return out;
}

/**
 * @param {Object} deps
 * @param {Function|null} deps.Recognition  `SpeechRecognition` 생성자(주입). 없으면 `isSupported()` 거짓, `start` = `unsupported`
 * @param {Object}   [deps.timers]     `{setTimeout, clearTimeout}`
 * @param {Function|null} [deps.available]  `({langs}) => Promise<'available'|'downloadable'|'unavailable'|…>`.
 *                                     생략하면 `Recognition.available` 이 함수일 때 그것(정적 메서드로 부른다)
 * @param {Function} [deps.onLine]     `() => boolean` — network 오류 분류에만
 * @param {Function} [deps.micState]   `() => 'granted'|'denied'|'prompt'|null` — not-allowed 분류에만(UI 가 미리 물어 둔 값)
 * @param {Function} [deps.loadTag]    `() => string` 기억한 아랍어 태그(설정 `voice.tag`)
 * @param {Function} [deps.saveTag]    `(tag) => void` 결과가 온 아랍어 태그를 기억
 * @param {Function} [deps.now]        `() => number` ms 시계
 * @param {Object}   [deps.opts]       `LISTEN_DEFAULTS` 덮어쓰기
 */
export function createListener(deps) {
  const d = deps || {};
  const Recognition = typeof d.Recognition === 'function' ? d.Recognition : null;
  const o = Object.assign({}, LISTEN_DEFAULTS, d.opts || {});
  // ★ 브라우저에서 `setTimeout` 은 `this` 가 window 여야 한다(speaker.js 와 같은 함정).
  const timers = d.timers || {
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };
  const now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
  const onLine = typeof d.onLine === 'function' ? d.onLine : function () { return true; };
  const micState = typeof d.micState === 'function' ? d.micState : function () { return null; };
  const loadTag = typeof d.loadTag === 'function' ? d.loadTag : function () { return ''; };
  const saveTag = typeof d.saveTag === 'function' ? d.saveTag : function () { };
  let available = null;
  if (typeof d.available === 'function') available = d.available;
  else if (d.available === undefined && Recognition && typeof Recognition.available === 'function') {
    available = function (opts) { return Recognition.available(opts); };   // 정적 메서드 — this 를 지킨다
  }
  const bus = new EventTarget();

  let press = null;          // 지금 누름 {lang, tags, i, t0, tried, rec, gen, timer, retryTimer, started}
  let gen = 0;               // 시도 세대 — 늦게 오는 콜백 무시
  let everOk = false;
  const skip = new Set();    // preflight 가 'unavailable' 로 본 태그(세션 동안)

  function emit(type, detail) { bus.dispatchEvent(new CustomEvent(type, { detail: detail })); }

  function clearTimers(p) {
    if (p.timer !== null) { timers.clearTimeout(p.timer); p.timer = null; }
    if (p.retryTimer !== null) { timers.clearTimeout(p.retryTimer); p.retryTimer = null; }
  }

  function detach(rec) {
    if (!rec) return;
    rec.onstart = rec.onaudiostart = rec.onresult = rec.onnomatch = rec.onerror = rec.onend = null;
  }

  /** 누름을 끝낸다 — 끝 이벤트 하나 + end. */
  function finish(type, detail) {
    const p = press;
    if (!p) return;
    press = null;
    gen++;
    clearTimers(p);
    detach(p.rec);
    const base = { tag: p.tags[p.i], ms: Math.max(0, now() - p.t0), tried: p.tried.slice() };
    emit(type, Object.assign(base, detail || {}));
    emit('end', { outcome: type });
  }

  function fail(raw, started) {
    const code = classify(raw, { onLine: onLine(), mic: micState(), started: !!started, everOk: everOk });
    finish('error', { code: code, raw: raw });
  }

  function quietAbort(rec) {
    try { if (rec && typeof rec.abort === 'function') rec.abort(); } catch (_) { /* 이미 끝남 */ }
  }

  /** 지금 칸의 태그로 인식기 하나를 만들어 시작한다. **동기.** */
  function attempt() {
    const p = press;
    const my = ++gen;
    const tag = p.tags[p.i];
    p.tried.push(tag);
    p.started = false;
    p.endedEarly = false;
    let rec;
    try {
      rec = new Recognition();
      rec.lang = tag;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = o.MAX_ALTS;
    } catch (_) {
      fail('start-threw', false);
      return;
    }
    p.rec = rec;
    const live = () => my === gen && press === p;

    rec.onstart = function () { if (live()) p.started = true; };
    rec.onaudiostart = function () { if (live()) p.started = true; };
    rec.onresult = function (ev) {
      if (!live()) return;
      const alts = alternativesOf(ev, o.MAX_ALTS);
      if (!alts.length) { fail('no-alternatives', true); return; }
      everOk = true;
      // `[9b-2 — 9b1R-7 낮음-4]` 기억 읽기·쓰기 둘 다 try 안 — 던지는 저장소여도 결과를 버리지 않는다.
      try {
        if (p.lang === 'ar' && tag !== loadTag()) saveTag(tag);
      } catch (_) { /* 저장 실패는 듣기를 막지 않는다 */ }
      finish('result', { alternatives: alts });
    };
    rec.onnomatch = function () { if (live()) fail('no-match', true); };
    rec.onerror = function (ev) {
      if (!live()) return;
      const raw = ev && ev.error ? String(ev.error) : '';
      if (raw === 'language-not-supported' && p.i + 1 < p.tags.length) {
        // 사다리 한 칸 아래 — 앞 인식기의 end(또는 상한)를 기다린다.
        const from = tag;
        p.waiting = true;
        clearTimers(p);
        const next = function () {
          if (!live() || !p.waiting) return;
          p.waiting = false;
          if (p.retryTimer !== null) { timers.clearTimeout(p.retryTimer); p.retryTimer = null; }
          detach(rec);
          quietAbort(rec);
          p.i++;
          emit('fallback', { from: from, to: p.tags[p.i] });
          if (press !== p) return;   // `[9b-2 — 9b1R-7 낮음-3]` fallback 핸들러가 abort() 했다 — 새 시도를 만들지 않는다
          attempt();
        };
        p.next = next;
        p.retryTimer = timers.setTimeout(next, o.RETRY_WAIT_MS);
        return;
      }
      if (raw === 'language-not-supported' && p.lang === 'ar' && p.remembered) {
        // 기억한 태그부터 끝까지 안 됐다 — 기억을 지워 다음 누름은 사다리 맨 위부터.
        try { saveTag(''); } catch (_) { /* 무시 */ }
      }
      fail(raw, p.started);
    };
    rec.onend = function () {
      if (!live()) return;
      if (p.waiting) { p.next(); return; }
      fail('end-without-result', p.started);
    };

    // 앱 상한(5절 "말 없음") — 시도마다 다시 잰다(언어 불가는 듣기 전에 온다).
    p.timer = timers.setTimeout(function () {
      if (!live()) return;
      detach(rec);
      quietAbort(rec);
      fail('timeout', p.started);
    }, o.LISTEN_MAX_MS);

    try {
      rec.start();
    } catch (_) {
      detach(rec);
      fail('start-threw', false);
    }
  }

  return {
    addEventListener: (t, f, opt) => bus.addEventListener(t, f, opt),
    removeEventListener: (t, f, opt) => bus.removeEventListener(t, f, opt),

    /** 인식기 생성자가 있나. */
    isSupported() { return !!Recognition; },

    /** 듣는 중인가(사다리 대기 포함). */
    isListening() { return press !== null; },

    /**
     * 한 번 듣기. **동기** — 이 호출 안에서 `recognition.start()` 까지 간다.
     * @param {'ar'|'en'} lang  명령 언어(`resolveCmdLang` 의 결과)
     * @returns {boolean} 시작했으면 true. 듣는 중이면 무시(false). 생성자 없음 → `error{code:'unsupported'}` + false
     */
    start(lang) {
      if (press) return false;
      const lg = lang === 'ar' ? 'ar' : 'en';
      if (!Recognition) {
        emit('error', { code: CODES.UNSUPPORTED, raw: 'no-constructor', tag: '', ms: 0, tried: [] });
        emit('end', { outcome: 'error' });
        return false;
      }
      let remembered = '';
      try { remembered = String(loadTag() || ''); } catch (_) { remembered = ''; }
      press = {
        lang: lg, tags: tagsFor(lg, remembered, skip, o), i: 0, t0: now(), tried: [],
        remembered: lg === 'ar' && o.AR_TAGS.indexOf(remembered) > 0 ? remembered : '',
        rec: null, timer: null, retryTimer: null, started: false, waiting: false, next: null
      };
      attempt();
      return press !== null;   // 생성·start() 가 그 자리에서 던졌으면 이미 error 로 끝났다
    },

    /** 듣기 취소(사용자 — 다시 탭·9a 단추·hidden). 듣는 중이 아니면 false. */
    abort() {
      const p = press;
      if (!p) return false;
      const rec = p.rec;
      finish('cancel', {});
      quietAbort(rec);
      return true;
    },

    /**
     * 리더 진입 때(제스처 밖) 사다리를 미리 내려간다 — `available()` 이 있을 때만. 'unavailable' 인 태그만 건너뛴다.
     * @returns {Promise<string|null>}  이 언어로 처음 시도할 태그(모르면 null)
     */
    async preflight(lang) {
      if (!Recognition || !available) return null;
      const lg = lang === 'ar' ? 'ar' : 'en';
      let remembered = '';
      try { remembered = String(loadTag() || ''); } catch (_) { remembered = ''; }
      const ladder = lg === 'ar' ? tagsFor('ar', remembered, [], o) : [o.EN_TAG];
      for (const tag of ladder) {
        let st;
        try { st = await available({ langs: [tag] }); } catch (_) { return null; }
        if (st !== 'unavailable') return tag;
        skip.add(tag);
      }
      return null;
    },

    /** 테스트·디버그 — preflight 가 건너뛰기로 한 태그. */
    skipped() { return Array.from(skip); }
  };
}
