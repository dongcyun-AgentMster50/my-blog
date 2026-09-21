/* ============================================================
   MedReader — 음성 선택 (spec 6-3)

   `pickVoice`·`normalizeVoiceLang`·`availability` 는 **순수 함수**다
   (`node --test` 가 고정한다). `loadVoices` 만 `speechSynthesis` 를 만지고,
   그것도 **인자로 받는다** — 테스트에서 스텁을 꽂을 수 있게.

   ★ Android 는 `voice.lang` 이 `en_US` 처럼 언더스코어로 온다(6-3).
     정규화하지 않으면 영어 음성이 하나도 안 잡혀 "음성 없음" 배너가
     멀쩡한 기기에서 뜬다.
   ============================================================ */

import { TTS } from '../config.js';
import { LANGS } from '../i18n/index.js';

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

/** 6-3 — 언어별 가용성 `{en, ar, fr, ko}`. 설정 화면과 배너가 읽는다. */
export function availability(voices) {
  const out = {};
  for (let i = 0; i < LANGS.length; i++) out[LANGS[i]] = !!pickVoice(LANGS[i], voices);
  // 원서 언어는 UI 언어와 별개다(문서 언어 기본 en).
  out.en = !!pickVoice('en', voices);
  return out;
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
