/* ============================================================
   MedReader — 음성 선택 (spec 6-3)

   `pickVoice`·`normalizeVoiceLang`·`availability` 는 **순수 함수**다
   (`node --test` 가 고정한다). `loadVoices` 만 `speechSynthesis` 를 만지고,
   그것도 **인자로 받는다** — 테스트에서 스텁을 꽂을 수 있게.

   ★ Android 는 `voice.lang` 이 `en_US` 처럼 언더스코어로 온다(6-3).
     정규화하지 않으면 영어 음성이 하나도 안 잡혀 "음성 없음" 배너가
     멀쩡한 기기에서 뜬다.
   ============================================================ */

import { TTS, TTS_LANG_REGION, READALONG } from '../config.js';
import { LANGS } from '../i18n/index.js';
import { SUPPORTED_SRC } from '../text/lang.js';

/** `en_US` → `en-us`. 비교는 전부 이 형태로만 한다. */
export function normalizeVoiceLang(lang) {
  return String(lang == null ? '' : lang).replace(/_/g, '-').toLowerCase();
}

/** 그 음성이 `lang`(예: 'en') 용인가. `en-GB`·`en_US` 모두 참. */
export function voiceMatches(voice, lang) {
  const v = normalizeVoiceLang(voice && voice.lang);
  const want = normalizeVoiceLang(lang);
  if (!v || !want) return false;
  return v === want || v.indexOf(want + '-') === 0;
}

/**
 * 6-3 우선순위: `preferredURI` 일치 > `localService === true` > 이름에 'Google'
 * > 첫 번째. 없으면 `null`.
 *
 * `localService` 를 'Google' 보다 앞에 두는 이유는 **오프라인**이다(16-J).
 * 네트워크 음성은 비행기 모드에서 조용히 실패한다.
 */
export function pickVoice(lang, voices, preferredURI) {
  const list = Array.isArray(voices) ? voices : [];
  const matched = list.filter(function (v) { return voiceMatches(v, lang); });
  if (!matched.length) return null;

  if (preferredURI) {
    for (let i = 0; i < matched.length; i++) {
      if (matched[i].voiceURI === preferredURI) return matched[i];
    }
  }
  for (let i = 0; i < matched.length; i++) {
    if (matched[i].localService === true) return matched[i];
  }
  for (let i = 0; i < matched.length; i++) {
    if (String(matched[i].name || '').indexOf('Google') >= 0) return matched[i];
  }
  return matched[0];
}

/**
 * 6-3 — 언어별 가용성 `{en, ar, fr, ko}`. 설정 화면과 배너가 읽는다.
 *
 * `[7c]` 원문 언어는 UI 언어와 별개다. UI 언어(`LANGS`)와 지원 원문(`SUPPORTED_SRC`)을
 * 모두 담고, `docLang` 을 주면 그 언어도 담는다 — 배너는 `out[doc.lang]` 을 읽는다
 * (`en` 고정이 아니다).
 */
export function availability(voices, docLang) {
  const out = {};
  const langs = LANGS.concat(SUPPORTED_SRC);
  if (typeof docLang === 'string' && docLang) langs.push(docLang);
  for (let i = 0; i < langs.length; i++) {
    if (Object.prototype.hasOwnProperty.call(out, langs[i])) continue;
    out[langs[i]] = !!pickVoice(langs[i], voices);
  }
  return out;
}

/**
 * `[7c — spec 6-1]` 원문 발화의 `utterance.lang`. 고른 음성이 있으면 그 음성의
 * `voice.lang`(언더스코어를 하이픈으로), 없으면 언어별 기본 지역(`TTS_LANG_REGION`),
 * 그것도 없으면 언어 코드 그대로. 언어가 비면 en.
 */
export function utteranceLang(lang, voice) {
  if (voice && voice.lang) return String(voice.lang).replace(/_/g, '-');
  const l = typeof lang === 'string' && lang ? lang : 'en';
  return Object.prototype.hasOwnProperty.call(TTS_LANG_REGION, l) ? TTS_LANG_REGION[l] : l;
}

/**
 * 6-3 — `getVoices()` 가 비면 `voiceschanged` 를 기다리되 **1.5초**에 포기한다.
 * 이벤트가 영영 안 오는 기기가 있다(6-4 표). 포기해도 `[]` 를 돌려주고 앱은
 * 계속 돈다 — voice 없이 `lang` 만으로도 소리는 난다.
 *
 * @param {SpeechSynthesis} synth  주입한다(테스트 스텁 가능)
 */
export function loadVoices(synth, timeoutMs) {
  const s = synth;
  if (!s || typeof s.getVoices !== 'function') return Promise.resolve([]);

  let first = [];
  try { first = s.getVoices() || []; } catch (e) { first = []; }
  if (first.length) return Promise.resolve(first);

  return new Promise(function (resolve) {
    let done = false;
    const finish = function () {
      if (done) return;
      done = true;
      if (s.removeEventListener) s.removeEventListener('voiceschanged', onChange);
      let v = [];
      try { v = s.getVoices() || []; } catch (e) { v = []; }
      resolve(v);
    };
    function onChange() { finish(); }
    if (s.addEventListener) s.addEventListener('voiceschanged', onChange);
    setTimeout(finish, Number(timeoutMs) || TTS.VOICES_TIMEOUT_MS);
  });
}

/* ────────────────────────────────────────────────────────
   `[8b-1]` 음성 목록을 **끝까지** 듣는다 (운영자 실기기 이상, 2026-10-10)

   Galaxy·Chrome 에서 영어·아랍어 언어팩이 있는데 앱이 "영어 음성 없음"·"번역문 음성: 없음",
   한국어만 "있음"으로 판정했다. `loadVoices` 는 **첫 `getVoices()` 가 비어 있지 않으면 그 목록을
   최종으로 쓴다** — Android 가 기본 언어 음성만 먼저 주고 나머지를 `voiceschanged` 로 늦게 주면
   놓친다(가설 — `dev/voices.html` 진단 결과 대기). 어느 쪽이든 맞는 수정:

     · `voiceschanged` 를 **계속** 구독한다. 목록이 바뀔 때마다 구독자에게 알린다 —
       원문 음성·번역문 음성·유효 모드·"음성 없음" 판정을 그때마다 다시 한다.
     · **안정**(`settled`) = 첫 응답(비어 있지 않은 목록, 또는 `VOICES_TIMEOUT_MS` 의 빈 목록) 뒤
       `READALONG.VOICES_SETTLE_MS` 동안 목록이 바뀌지 않았다. 안정 전에는 "목록에 없음"도 말하지 않는다.
     · 안정된 뒤에 음성이 생기면 곧바로 "있음"으로 — 알림을 거두는 것은 구독자 몫이다.
   `[8b-1 — 오케스트레이터 결정 2026-10-10]` 진단(운영자 폰, Galaxy·Chrome 154): 첫 `getVoices()` 0개 →
   9ms 뒤 `voiceschanged` 로 92개가 한꺼번에. 영어 5개·한국어·프랑스어 있음, **아랍어 0개 — 그런데
   voice 없이 `lang = 'ar-SA'` 로 말하게 하자 아랍어가 소리 났다.** 그래서 **목록에 없음 ≠ 말할 수 없음**:
   "음성 없음"은 실제 발화 오류로만 판정한다(speaker 의 `NO_VOICE`·`TR_VOICE_FAILED`). 이 감시자는 음성 객체
   고르기와 설정 화면의 세 갈래 표시(`voiceVerdict`)에만 쓴다.
   음성 객체가 없어도 `utterance.lang` 만으로 발화를 시도하는 길은 그대로다(이 모듈은 판정만 한다).
   ──────────────────────────────────────────────────────── */

function voiceSig(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) out.push(String(list[i] && list[i].voiceURI) + '|' + normalizeVoiceLang(list[i] && list[i].lang));
  return out.sort().join('\n');
}

/**
 * 음성 목록 감시자 하나. 앱은 `sharedVoiceWatch(speechSynthesis)` 로 **한 개를 나눠 쓴다**
 * (리더 컨트롤·설정 화면이 같은 판정을 본다).
 *
 * @param {Object} synth `speechSynthesis` 같은 것 — `getVoices()`, `addEventListener('voiceschanged')`
 * @param {{settleMs?:number, timeoutMs?:number, timers?:{setTimeout:Function, clearTimeout:Function}}} [opts]
 * @returns {{snapshot:()=>{voices:Array, loaded:boolean, settled:boolean}, subscribe:(fn)=>Function, stop:()=>void}}
 */
export function createVoiceWatch(synth, opts) {
  const o = opts || {};
  const settleMs = Number.isFinite(o.settleMs) ? o.settleMs : READALONG.VOICES_SETTLE_MS;
  const timeoutMs = Number.isFinite(o.timeoutMs) ? o.timeoutMs : TTS.VOICES_TIMEOUT_MS;
  const timers = o.timers || {
    setTimeout: function (fn, ms) { return setTimeout(fn, ms); },
    clearTimeout: function (id) { return clearTimeout(id); }
  };
  const s = synth;
  const listeners = new Set();
  let voices = [];
  let loaded = false;
  let settled = false;
  let settleTimer = null;
  let firstTimer = null;
  let stopped = false;

  function read() {
    if (!s || typeof s.getVoices !== 'function') return [];
    try { return (s.getVoices() || []).slice(); } catch (e) { return []; }
  }
  function snapshot() { return { voices: voices.slice(), loaded: loaded, settled: settled }; }
  function notify() {
    const snap = snapshot();
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) { /* 구독자 오류가 감시를 멈추지 않는다 */ } });
  }
  function armSettle() {
    if (settleTimer !== null) timers.clearTimeout(settleTimer);
    settleTimer = timers.setTimeout(function () {
      settleTimer = null;
      if (stopped || settled) return;
      settled = true;
      notify();
    }, settleMs);
  }
  function firstResponse() {
    if (loaded) return;
    loaded = true;
    if (firstTimer !== null) { timers.clearTimeout(firstTimer); firstTimer = null; }
    armSettle();
  }
  function onChange() {
    if (stopped) return;
    const next = read();
    const changed = voiceSig(next) !== voiceSig(voices);
    voices = next;
    if (!loaded) {
      if (!next.length) return;          // 아직 빈 목록 — 첫 응답이 아니다
      firstResponse();
      notify();
      return;
    }
    if (!changed) return;
    if (!settled) armSettle();           // 바뀌는 중 — 안정 시계를 다시 건다
    notify();
  }

  if (!s || typeof s.getVoices !== 'function') {
    loaded = true;
    settled = true;                      // 엔진이 없다 — 기다릴 것이 없다
  } else {
    voices = read();
    if (s.addEventListener) s.addEventListener('voiceschanged', onChange);
    if (voices.length) firstResponse();
    else {
      firstTimer = timers.setTimeout(function () {
        firstTimer = null;
        if (stopped || loaded) return;
        voices = read();
        firstResponse();                 // 이벤트가 영영 안 오는 기기(6-4) — 빈 목록이라도 응답으로 친다
        notify();
      }, timeoutMs);
    }
  }

  return {
    snapshot: snapshot,
    /** 목록·안정 여부가 바뀔 때마다 `fn(snapshot)`. 되돌림 함수를 준다. 등록 즉시 부르지 않는다. */
    subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
    stop: function () {
      stopped = true;
      if (s && s.removeEventListener) s.removeEventListener('voiceschanged', onChange);
      if (settleTimer !== null) { timers.clearTimeout(settleTimer); settleTimer = null; }
      if (firstTimer !== null) { timers.clearTimeout(firstTimer); firstTimer = null; }
      listeners.clear();
    }
  };
}

const sharedWatches = new WeakMap();

/** 같은 `synth` 에는 감시자 **하나**(리더 컨트롤·설정 화면이 같은 판정을 본다). */
export function sharedVoiceWatch(synth) {
  if (!synth || typeof synth !== 'object') return createVoiceWatch(null);
  let w = sharedWatches.get(synth);
  if (!w) { w = createVoiceWatch(synth); sharedWatches.set(synth, w); }
  return w;
}

/**
 * 판정 한 줄(설정 화면 "번역문 음성"). `[8b-1 — 오케스트레이터 결정 2026-10-10]`
 * **"목록에 없음" ≠ "말할 수 없음"** — 운영자 폰(Galaxy·Chrome 154)의 목록에 아랍어 음성이 0개였는데
 * voice 없이 `utterance.lang` 만 주자 아랍어가 실제로 소리 났다. 그래서 목록만으로 "없음"이라 하지 않는다.
 *
 *   'yes'       목록에 있다 — 또는 목록에 없지만 시험 발화가 성공했다(`tested === 'ok'`)
 *   'unlisted'  목록이 안정됐는데 없다 — **들어 보기**(시험 발화)로 확정한다
 *   'no'        시험 발화가 오류로 끝났다(`tested === 'fail'`)
 *   'checking'  아직 목록이 안정되지 않았다
 *
 * @param {string} lang
 * @param {{voices?:Array, loaded?:boolean, settled?:boolean}} snap `createVoiceWatch().snapshot()`
 * @param {'ok'|'fail'|null} [tested] 이 기기에서 그 언어 시험 발화의 결과(기억된 것)
 */
export function voiceVerdict(lang, snap, tested) {
  const sn = snap || {};
  if (pickVoice(lang, sn.voices)) return 'yes';
  if (tested === 'ok') return 'yes';
  if (tested === 'fail') return 'no';
  return sn.settled ? 'unlisted' : 'checking';
}

/**
 * `[8b-1]` 번역문·표 안내 발화의 `utterance.lang`. 고른 음성이 있으면 그 음성의 `voice.lang`,
 * 없으면 `READALONG.TR_LANG_REGION`(진단에서 소리가 난 지역 태그), 그다음 `TTS_LANG_REGION`, 그것도 없으면 언어 코드.
 */
export function speechLang(lang, voice) {
  if (voice && voice.lang) return String(voice.lang).replace(/_/g, '-');
  const l = typeof lang === 'string' && lang ? lang : '';
  if (l && Object.prototype.hasOwnProperty.call(READALONG.TR_LANG_REGION, l)) return READALONG.TR_LANG_REGION[l];
  return utteranceLang(l || undefined, null);
}

/**
 * `[8b-1]` 발화 오류 중 "이 언어를 말할 수 없다"로 볼 것(SpeechSynthesisErrorEvent.error).
 * 그 밖의 오류(`audio-busy`·`network`·`text-too-long` 등)는 그 발화 하나의 문제다.
 */
export const VOICE_ERRORS = Object.freeze(['language-unavailable', 'voice-unavailable', 'synthesis-unavailable']);
