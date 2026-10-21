/* ============================================================
   tests/voice-8k.test.mjs — `[8k]` 낭독 목소리: 휴대폰 설정 따름 + 언어별 고르기 + 억양(O3)
   spec 19-1-1 E1 (가) · 19-1-2 3절(지침 문안 1–6) · 8k 수용 기준 `[N]`

   ★ 이 파일이 막는 것
     · Nour 실기기(Realme, 2026-10-21)의 옛 버그 — 목록이 알파벳 순이라 영어를 en_AU, 프랑스어를 fr_CA 로 읽었다.
       고른 것이 없으면 **voice 없이 그 언어 태그만**(휴대폰 설정 따름)이어야 한다.
     · `resolveSpeech` 다섯 갈래 · 억양 묶음은 목록의 지역에서만 · 밑줄·`#스크립트` 꼬리표 정규화
     · 저장한 음성이 사라지면 조용히 억양 → 휴대폰 설정으로
     · 원문·번역문·표 안내·퀴즈 네 경로가 **같은 함수** — 실제 `createSpeaker` 로 발화의 voice·lang 을 잰다
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  resolveSpeech, parseVoiceLang, accentGroups, normalizeAccent, speechPref, defaultSpeechTag, voiceTag,
  languageVoices, regionName, SPEECH_DEFAULT, pickVoice
} from '../js/tts/voices.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { DEFAULTS } from '../js/settings.js';
import { BUNDLES, LANGS } from '../js/i18n/index.js';

const { applySourceSpeech, applyTrSpeech, applyNoticeSpeech } = await import('../js/ui/controls.js');
const { applyQuizSpeech } = await import('../js/ui/quiz.js');
const { voiceChoiceRows, voicePrefFor, VOICE_SAMPLES } = await import('../js/ui/settings.js');

/* ── 픽스처 — Nour 실기기 목록의 **모양**(92개, 모두 기기 음성, 밑줄·#스크립트, 알파벳 순) ── */

function V(lang, name, extra) {
  return Object.assign({ name: name || ('voice ' + lang), lang: lang, voiceURI: 'urn:' + lang, localService: true, default: false }, extra || {});
}

const NOUR_EN = ['en_AU', 'en_GB', 'en_IN', 'en_NG', 'en_US'];
const NOUR_FR = ['fr_CA', 'fr_FR'];
const NOUR_SCRIPTED = ['bs_BA_#Latn', 'sr_RS_#Cyrl', 'sr_RS_#Latn', 'zh_CN_#Hans', 'zh_HK_#Hans', 'zh_TW_#Hant'];
const FILLER = ['af_ZA', 'am_ET', 'bg_BG', 'bn_BD', 'bn_IN', 'ca_ES', 'cs_CZ', 'cy_GB', 'da_DK', 'de_DE', 'el_GR',
  'es_ES', 'es_US', 'et_EE', 'eu_ES', 'fi_FI', 'fil_PH', 'gl_ES', 'gu_IN', 'he_IL', 'hi_IN', 'hr_HR', 'hu_HU', 'id_ID',
  'is_IS', 'it_IT', 'ja_JP', 'jv_ID', 'km_KH', 'kn_IN', 'lt_LT', 'lv_LV', 'ml_IN', 'mr_IN', 'ms_MY', 'nb_NO', 'ne_NP',
  'nl_BE', 'nl_NL', 'pa_IN', 'pl_PL', 'pt_BR', 'pt_PT', 'ro_RO', 'ru_RU', 'si_LK', 'sk_SK', 'sq_AL', 'su_ID', 'sv_SE',
  'sw_KE', 'ta_IN', 'ta_LK', 'te_IN', 'th_TH', 'tr_TR', 'uk_UA', 'ur_IN', 'ur_PK', 'vi_VN', 'yue_HK', 'zu_ZA',
  'de_AT', 'es_MX', 'ky_KG', 'it_CH', 'lb_LU', 'mk_MK', 'mt_MT', 'nn_NO', 'or_IN', 'ps_AF', 'sl_SI', 'so_SO',
  'tg_TJ', 'ti_ET', 'tk_TM', 'uz_UZ'];

function nourVoices() {
  const langs = NOUR_EN.concat(NOUR_FR, ['ko_KR'], NOUR_SCRIPTED, FILLER).slice(0, 92);
  // 이름은 기기 언어(아랍어)로 온다 — 화면은 이름을 그대로 쓴다.
  return langs.sort().map((l) => V(l, 'صوت ' + l));
}

const NOUR = nourVoices();

/* ══ 0. 픽스처가 실기기 모양인가 ══════════════════════ */

test('N0 픽스처 — 92개 · en 5 · fr 2 · ko 1 · ar 0 · en_AU 가 영어 중 알파벳 첫째 · 옛 규칙은 en_AU·fr_CA 를 골랐다', () => {
  assert.equal(NOUR.length, 92);
  assert.equal(languageVoices('en', NOUR).length, 5);
  assert.equal(languageVoices('fr', NOUR).length, 2);
  assert.equal(languageVoices('ko', NOUR).length, 1);
  assert.equal(languageVoices('ar', NOUR).length, 0);
  assert.equal(languageVoices('en', NOUR)[0].lang, 'en_AU');
  // Nour 영상의 [앱이 고른 음성] — 옛 규칙의 재현(비교 기준)
  assert.equal(pickVoice('en', NOUR).lang, 'en_AU');
  assert.equal(pickVoice('fr', NOUR).lang, 'fr_CA');
});

/* ══ 1. 기본 = 휴대폰 설정 따름 ════════════════════════ */

test('K1 ★ 고른 것이 없으면 voice 없이 그 언어 태그만 — Nour 목록에서 en·fr·ko·ar 모두', () => {
  const want = { en: 'en-US', fr: 'fr-FR', ko: 'ko-KR', ar: 'ar-SA' };
  for (const [lang, tag] of Object.entries(want)) {
    const r = resolveSpeech(lang, NOUR, { uri: '', accent: '' });
    assert.equal(r.voice, null, lang + ' — voice 를 박지 않는다(옛 버그: en_AU·fr_CA)');
    assert.equal(r.tag, tag, lang);
    assert.equal(r.via, 'phone');
    assert.equal(r.missing, false);
  }
  // pref 를 아예 안 줘도 같다
  assert.equal(resolveSpeech('en', NOUR).voice, null);
});

test('K2 기본 동작은 설정 한 곳(SPEECH_DEFAULT) — 지금 값은 phone·region, 바꾸면 이전 규칙·지역 없는 태그', () => {
  assert.deepEqual({ ...SPEECH_DEFAULT }, { voice: 'phone', tag: 'region' });
  assert.ok(Object.isFrozen(SPEECH_DEFAULT));
  // Nour 결과가 E1 (나)면 여기만 바꾼다 — 그때의 모양
  const pick = resolveSpeech('en', NOUR, {}, { voice: 'pick', tag: 'region' });
  assert.equal(pick.voice.lang, 'en_AU');
  assert.equal(pick.tag, 'en-AU');
  assert.equal(pick.via, 'pick');
  assert.equal(resolveSpeech('en', NOUR, {}, { voice: 'phone', tag: 'bare' }).tag, 'en');
  assert.equal(defaultSpeechTag('ar'), 'ar-SA');
  assert.equal(defaultSpeechTag('ko'), 'ko-KR');
  assert.equal(defaultSpeechTag('de'), 'de', '표에 없는 언어는 코드 그대로');
});

/* ══ 2. 다섯 갈래 ═════════════════════════════════════ */

test('K3 ★ resolveSpeech 다섯 갈래 — uri 있음 · uri 사라짐+accent · accent 만 · 둘 다 없음 · 목록 빔', () => {
  const gb = NOUR.find((v) => v.lang === 'en_GB');
  // ① uri 가 목록에 있다 → 그 음성, 그 음성의 태그
  let r = resolveSpeech('en', NOUR, { uri: gb.voiceURI, accent: 'en-GB' });
  assert.equal(r.voice, gb);
  assert.equal(r.tag, 'en-GB');
  assert.equal(r.via, 'voice');
  assert.equal(r.missing, false);
  // ② uri 가 사라졌고 accent → voice 없이 accent, missing
  r = resolveSpeech('en', NOUR, { uri: 'urn:gone', accent: 'en-GB' });
  assert.deepEqual([r.voice, r.tag, r.via, r.missing], [null, 'en-GB', 'accent', true]);
  // ③ accent 만
  r = resolveSpeech('en', NOUR, { uri: '', accent: 'en-IN' });
  assert.deepEqual([r.voice, r.tag, r.via, r.missing], [null, 'en-IN', 'accent', false]);
  // ④ 둘 다 없음 → 휴대폰 설정 따름
  r = resolveSpeech('en', NOUR, { uri: '', accent: '' });
  assert.deepEqual([r.voice, r.tag, r.via], [null, 'en-US', 'phone']);
  // ⑤ 목록 빔(늦게 옴·아랍어 0개) → uri 는 찾을 수 없다 — accent 또는 휴대폰 설정으로, voice 없이
  r = resolveSpeech('en', [], { uri: gb.voiceURI, accent: 'en-GB' });
  assert.deepEqual([r.voice, r.tag, r.via, r.missing], [null, 'en-GB', 'accent', true]);
  r = resolveSpeech('ar', [], { uri: '', accent: '' });
  assert.deepEqual([r.voice, r.tag, r.via], [null, 'ar-SA', 'phone']);
  r = resolveSpeech('en', null, { uri: 'urn:x', accent: '' });
  assert.deepEqual([r.voice, r.tag, r.via, r.missing], [null, 'en-US', 'phone', true]);
});

test('K4 ★ 저장 uri 사라짐 — accent 가 없으면 휴대폰 설정 따름으로 내려간다(옛 음성을 붙들지 않는다)', () => {
  const r = resolveSpeech('fr', NOUR, { uri: 'urn:fr_FR_old_engine', accent: '' });
  assert.equal(r.voice, null);
  assert.equal(r.tag, 'fr-FR');
  assert.equal(r.via, 'phone');
  assert.equal(r.missing, true);
});

test('K5 다른 언어의 uri·accent 는 그 언어에 쓰지 않는다(언어가 먼저다)', () => {
  const ko = NOUR.find((v) => v.lang === 'ko_KR');
  let r = resolveSpeech('en', NOUR, { uri: ko.voiceURI, accent: '' });
  assert.equal(r.voice, null, '한국어 음성으로 영어를 읽지 않는다');
  assert.equal(r.missing, true);
  r = resolveSpeech('en', NOUR, { uri: '', accent: 'fr-CA' });
  assert.equal(r.via, 'phone', '다른 언어의 억양은 무시');
  assert.equal(normalizeAccent('fr-CA', 'en'), '');
  assert.equal(normalizeAccent('en_gb', 'en'), 'en-GB');
  assert.equal(normalizeAccent('en', 'en'), '', '지역 없는 값은 억양이 아니다');
  assert.equal(normalizeAccent('zh_HK_#Hans', 'zh'), 'zh-HK', '억양은 지역만');
});

/* ══ 3. 밑줄·꼬리표 정규화 ═════════════════════════════ */

test('K6 ★ parseVoiceLang — 밑줄·#스크립트·사설 꼬리 정규화(BCP 47)', () => {
  const cases = [
    ['en_AU', 'en', '', 'AU', 'en-AU'],
    ['en-us', 'en', '', 'US', 'en-US'],
    ['zh_HK_#Hans', 'zh', 'Hans', 'HK', 'zh-Hans-HK'],
    ['bs_BA_#Latn', 'bs', 'Latn', 'BA', 'bs-Latn-BA'],
    ['sr-Latn-RS', 'sr', 'Latn', 'RS', 'sr-Latn-RS'],
    ['en-us-x-sfg-local', 'en', '', 'US', 'en-US'],
    ['es_419', 'es', '', '419', 'es-419'],
    ['EN', 'en', '', '', 'en'],
    ['ko', 'ko', '', '', 'ko'],
    ['', '', '', '', ''],
    [null, '', '', '', '']
  ];
  for (const [raw, lang, script, region, tag] of cases) {
    assert.deepEqual(parseVoiceLang(raw), { lang, script, region, tag }, String(raw));
  }
  // 목소리를 직접 고르면 그 음성의 태그(스크립트 포함) — 옛 `replace('_','-')` 의 'zh-HK-#Hans' 가 아니다
  assert.equal(voiceTag({ lang: 'zh_HK_#Hans' }), 'zh-Hans-HK');
  const hk = NOUR.find((v) => v.lang === 'zh_HK_#Hans');
  assert.equal(resolveSpeech('zh', NOUR, { uri: hk.voiceURI }).tag, 'zh-Hans-HK');
});

/* ══ 4. 억양 묶음 ═════════════════════════════════════ */

test('K7 ★ 억양 묶음은 목록의 지역에서만 — en_GB 가 없으면 영국 머리 줄도 없다', () => {
  const g = accentGroups('en', NOUR);
  assert.deepEqual(g.map((x) => x.accent), ['en-AU', 'en-GB', 'en-IN', 'en-NG', 'en-US']);
  assert.ok(g.every((x) => x.voices.length === 1));
  const noGB = NOUR.filter((v) => v.lang !== 'en_GB');
  assert.ok(!accentGroups('en', noGB).some((x) => x.region === 'GB'));
  assert.deepEqual(accentGroups('ar', NOUR), [], '아랍어 0개 — 묶음 없음');
});

test('K8 ★ 꼬리표 있는 음성 — 같은 지역의 #Hans·#Hant 는 한 묶음(억양 = 지역), 지역 없는 음성은 고를 수 없는 묶음', () => {
  const list = [V('zh_HK_#Hans', 'A', { voiceURI: 'a' }), V('zh_HK_#Hant', 'B', { voiceURI: 'b' }), V('zh_CN_#Hans', 'C', { voiceURI: 'c' }), V('zh', 'D', { voiceURI: 'd' })];
  const g = accentGroups('zh', list);
  assert.deepEqual(g.map((x) => [x.accent, x.voices.map((v) => v.name).join('')]), [['zh-HK', 'AB'], ['zh-CN', 'C'], ['', 'D']]);
  const sr = accentGroups('sr', NOUR);
  assert.deepEqual(sr.map((x) => x.accent), ['sr-RS']);
  assert.equal(sr[0].voices.length, 2, 'sr_RS_#Cyrl · sr_RS_#Latn — 한 지역');
});

test('K9 지역 이름은 Intl.DisplayNames(UI 언어), 모르면 코드 그대로', () => {
  if (typeof Intl.DisplayNames === 'function') {
    assert.equal(regionName('GB', 'en'), 'United Kingdom');
    assert.ok(regionName('GB', 'ar').length > 0);
  }
  assert.equal(regionName('', 'en'), '');
  assert.equal(regionName('ZZ9', 'en'), 'ZZ9');
});

/* ══ 5. 설정 키 ═══════════════════════════════════════ */

test('K10 설정 — tts.voice.* 그대로 · 새 tts.accent.{en,ar,fr,ko} 기본 \'\' · speechPref 가 둘을 읽는다', () => {
  for (const l of ['en', 'ar', 'fr', 'ko']) {
    assert.equal(DEFAULTS['tts.voice.' + l], '');
    assert.equal(DEFAULTS['tts.accent.' + l], '');
  }
  const get = (k) => ({ 'tts.voice.en': 'urn:x', 'tts.accent.en': 'en-GB' })[k] ?? DEFAULTS[k];
  assert.deepEqual(speechPref(get, 'en'), { uri: 'urn:x', accent: 'en-GB' });
  assert.deepEqual(speechPref(get, 'en-GB'), { uri: 'urn:x', accent: 'en-GB' }, '태그를 줘도 언어 키');
  assert.deepEqual(speechPref(get, 'fr'), { uri: '', accent: '' });
  assert.deepEqual(speechPref(() => null, 'ko'), { uri: '', accent: '' }, '모양이 이상하면 빈 값');
});

/* ══ 6. 네 경로 — 실제 speaker ════════════════════════ */

function fakeTimers() {
  let now = 0; let seq = 1; const jobs = new Map();
  return {
    setTimeout: (fn, ms) => { const k = seq++; jobs.set(k, { fn, at: now + (Number(ms) || 0) }); return k; },
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
    }
  };
}

function fakeSynth() {
  const s = {
    speaking: false, pending: false, utt: [], current: null,
    speak(u) { s.speaking = true; s.current = u; s.utt.push(u); },
    cancel() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: 'canceled' }); },
    finish() { const u = s.current; s.speaking = false; s.current = null; if (u && u.onend) u.onend(); },
    fail(code) { const u = s.current; s.speaking = false; s.current = null; if (u && u.onerror) u.onerror({ error: code }); }
  };
  return s;
}

const SRC = 'The patient presented with fever.';
const NOTICE = 'This page has a table.';
const TRX = 'ترجمة قصيرة';

function rig(paras) {
  const synth = fakeSynth();
  const timers = fakeTimers();
  const view = {
    paras: () => paras,
    page: () => ({ page: 1, pageCount: 1 }),
    goToPage: () => Promise.resolve(false),
    show: () => true,
    markDone: () => {}
  };
  const translation = {
    get: (u) => (u.src === SRC ? { state: 'ready', text: TRX } : { state: 'none' }),
    onChange: () => () => {}
  };
  const sp = createSpeaker({
    synth, timers, view, translation, makeUtterance: (text) => ({ text }), requestWakeLock: () => Promise.resolve(null)
  });
  return { sp, synth, timers };
}

const READER_PARAS = [
  { id: 'p1', kind: 'body', lines: [{ id: '1:0', text: SRC, hyphen: 'none' }] },
  { id: 'tablenotice:r0', kind: 'table-notice', lines: [{ id: 'tablenotice:r0', text: NOTICE, hyphen: 'none' }] }
];

/** 리더: 원문 en · 번역문 ar · 표 안내 UI 언어(uiLang). 발화 [원문, 번역문, 표 안내]의 {voice, lang}. */
function readerRun(list, get, uiLang, target) {
  const h = rig(READER_PARAS);
  applySourceSpeech(h.sp, 'en', list, get);
  applyTrSpeech(h.sp, target || 'ar', list, get);
  applyNoticeSpeech(h.sp, uiLang || 'en', list, get);
  h.sp.setReadalong({ mode: 'speak', speakSource: true });
  h.sp.play();
  h.synth.finish();   // 원문 → 번역문
  h.synth.finish();   // 번역문 → 표 안내
  return h.synth.utt.map((u) => ({ text: u.text, voice: u.voice, lang: u.lang }));
}

function quizRun(list, get) {
  const h = rig([{ id: 'quiz-explanation', kind: 'body', lines: [{ id: 'q:0', text: SRC, hyphen: 'none' }] }]);
  applyQuizSpeech(h.sp, list, get);
  h.sp.play();
  return h.synth.utt.map((u) => ({ text: u.text, voice: u.voice, lang: u.lang }));
}

const getFrom = (o) => (k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : DEFAULTS[k]);

test('K11 ★ 기본(고른 것 없음) — 원문·번역문·표 안내·퀴즈 네 발화 모두 utt.voice 없음, utt.lang 은 언어 태그', () => {
  const get = getFrom({});
  const r = readerRun(NOUR, get, 'ko');
  assert.deepEqual(r.map((u) => u.text), [SRC, TRX, NOTICE]);
  assert.deepEqual(r.map((u) => u.voice), [undefined, undefined, undefined], 'voice 를 박지 않는다');
  assert.deepEqual(r.map((u) => u.lang), ['en-US', 'ar-SA', 'ko-KR']);
  const q = quizRun(NOUR, get);
  assert.equal(q[0].voice, undefined);
  assert.equal(q[0].lang, 'en-US');
});

test('K11b ★ 번역 대상이 목록에 있는 언어(ko)여도 기본은 voice 없이 — 번역문 경로도 휴대폰 설정 따름', () => {
  const r = readerRun(NOUR, getFrom({}), 'en', 'ko');
  assert.equal(r[1].text, TRX);
  assert.equal(r[1].voice, undefined, '목록의 ko_KR 을 박지 않는다');
  assert.equal(r[1].lang, 'ko-KR');
  const ko = NOUR.find((v) => v.lang === 'ko_KR');
  const g = readerRun(NOUR, getFrom({ 'tts.voice.ko': ko.voiceURI }), 'en', 'ko');
  assert.equal(g[1].voice, ko, '고르면 그 음성');
});

test('K12 ★ 목소리를 고르면 네 경로가 그 음성 · 억양만이면 voice 없이 그 태그 · 아랍어는 목록 0개라 억양 태그만', () => {
  const gb = NOUR.find((v) => v.lang === 'en_GB');
  const get = getFrom({ 'tts.voice.en': gb.voiceURI, 'tts.accent.en': 'en-GB', 'tts.accent.ar': 'ar-EG' });
  const r = readerRun(NOUR, get, 'en');
  assert.equal(r[0].voice, gb, '원문');
  assert.equal(r[0].lang, 'en-GB');
  assert.equal(r[1].voice, undefined, '번역문(ar) — 목록 0개');
  assert.equal(r[1].lang, 'ar-EG', '번역문 — 억양만');
  assert.equal(r[2].voice, gb, '표 안내(UI 영어)');
  assert.equal(r[2].lang, 'en-GB');
  const q = quizRun(NOUR, get);
  assert.equal(q[0].voice, gb, '퀴즈');
  assert.equal(q[0].lang, 'en-GB');
  // 억양만
  const acc = getFrom({ 'tts.accent.en': 'en-IN' });
  const a = readerRun(NOUR, acc, 'en');
  assert.deepEqual([a[0].voice, a[0].lang, a[2].voice, a[2].lang], [undefined, 'en-IN', undefined, 'en-IN']);
  assert.deepEqual([quizRun(NOUR, acc)[0].voice, quizRun(NOUR, acc)[0].lang], [undefined, 'en-IN']);
});

test('K13 ★ "휴대폰 설정 따름"으로 돌아오면 같은 speaker 에서 voice 가 지워진다(setVoice(…, null))', () => {
  const gb = NOUR.find((v) => v.lang === 'en_GB');
  const h = rig([{ id: 'p1', kind: 'body', lines: [{ id: '1:0', text: SRC, hyphen: 'none' }] }]);
  applySourceSpeech(h.sp, 'en', NOUR, getFrom({ 'tts.voice.en': gb.voiceURI }));
  applySourceSpeech(h.sp, 'en', NOUR, getFrom({}));
  h.sp.play();
  assert.equal(h.synth.utt[0].voice, undefined);
  assert.equal(h.synth.utt[0].lang, 'en-US');
  const q = rig([{ id: 'q', kind: 'body', lines: [{ id: 'q:0', text: SRC, hyphen: 'none' }] }]);
  applyQuizSpeech(q.sp, NOUR, getFrom({ 'tts.voice.en': gb.voiceURI }));
  applyQuizSpeech(q.sp, NOUR, getFrom({}));
  q.sp.play();
  assert.equal(q.synth.utt[0].voice, undefined, '퀴즈도');
});

test('K14 ★ 저장 음성이 사라짐 — 네 경로가 조용히 억양 → 휴대폰 설정으로(오류·배너 없이 소리)', () => {
  const gone = getFrom({ 'tts.voice.en': 'urn:old-device', 'tts.accent.en': 'en-GB' });
  const r = readerRun(NOUR, gone, 'en');
  assert.deepEqual([r[0].voice, r[0].lang, r[2].voice, r[2].lang], [undefined, 'en-GB', undefined, 'en-GB']);
  assert.deepEqual([quizRun(NOUR, gone)[0].voice, quizRun(NOUR, gone)[0].lang], [undefined, 'en-GB']);
  const bare = getFrom({ 'tts.voice.en': 'urn:old-device' });
  const b = readerRun(NOUR, bare, 'en');
  assert.deepEqual([b[0].voice, b[0].lang], [undefined, 'en-US']);
});

test('K15 번역문 — 실패로 꺼진 tr 은 목록에 그 언어 음성이 생기면 다시 허락(옛 "음성이 생겼다"와 같은 조건)', () => {
  const h = rig(READER_PARAS);
  h.sp.setDocLang('en-US');
  applyTrSpeech(h.sp, 'ar', [], getFrom({}));
  h.sp.setReadalong({ mode: 'speak', speakSource: true });
  h.sp.play();
  h.synth.finish();                 // 원문 끝 → 번역문
  h.synth.fail('language-unavailable');
  h.timers.advance(1000);
  if (h.synth.current && h.synth.current.text === TRX) h.synth.fail('language-unavailable');
  assert.equal(h.sp.isTrDisabled(), true, '실제 발화 오류로 꺼짐');
  applyTrSpeech(h.sp, 'ar', NOUR, getFrom({}));
  assert.equal(h.sp.isTrDisabled(), true, '목록에 아랍어 0개 — 그대로');
  applyTrSpeech(h.sp, 'ar', NOUR.concat([V('ar_EG', 'ar')]), getFrom({}));
  assert.equal(h.sp.isTrDisabled(), false, '아랍어 음성이 생겼다 — 다시 허락(voice 는 여전히 휴대폰 설정)');
});

/* ══ 7. 네 경로가 같은 함수 — 소스 ═════════════════════ */

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const read = (p) => strip(readFileSync(new URL(p, import.meta.url), 'utf8'));

test('K16 ★ 원문·번역문·표 안내·퀴즈(+ 설정 시험·들어 보기)가 resolveSpeech 하나 — 화면 코드에 pickVoice 0', () => {
  const c = read('../js/ui/controls.js');
  const q = read('../js/ui/quiz.js');
  const s = read('../js/ui/settings.js');
  for (const [name, src] of [['controls', c], ['quiz', q], ['settings', s]]) {
    assert.ok(!/pickVoice/.test(src), name + ' 가 옛 pickVoice 를 쓴다');
    assert.ok(!/utteranceLang\(|speechLang\(/.test(src), name + ' 가 옛 태그 함수를 쓴다');
  }
  for (const fn of ['applySourceSpeech', 'applyTrSpeech', 'applyNoticeSpeech']) {
    const body = c.match(new RegExp('export function ' + fn + '\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}'));
    assert.ok(body, fn);
    assert.match(body[1], /resolveSpeech\(lang, list, speechPref\(get, lang\)\)/, fn);
  }
  for (const [sync, fn] of [['syncSourceVoice', 'applySourceSpeech'], ['syncTrVoice', 'applyTrSpeech'], ['syncNoticeVoice', 'applyNoticeSpeech']]) {
    const body = c.match(new RegExp('function ' + sync + '\\(\\)\\s*\\{([\\s\\S]*?)\\n\\}'));
    assert.ok(body && body[1].indexOf(fn + '(speaker') >= 0, sync + ' → ' + fn);
  }
  const qa = q.match(/export function applyQuizSpeech\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(qa && /resolveSpeech\(QUIZ_SPEECH_LANG, list, speechPref\(get, QUIZ_SPEECH_LANG\)\)/.test(qa[1]));
  // `[다듬기 1]` 첫 누름은 목록을 동기로 읽는다 — 동작은 tests/polish-1.test.mjs P1·P2 가 잰다.
  assert.ok(/applyQuizSpeech\(sp, quizVoicesNow\(quizVoices, window\.speechSynthesis\), settings\.get\)/.test(q), '퀴즈는 누를 때마다 다시 고른다');
  // 설정 화면 — 번역문 [들어 보기]·목소리 [들어 보기] 도 같은 함수
  const test1 = s.match(/function runVoiceTest\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(test1, /resolveSpeech\(lang, voices, speechPref\(settings\.get, lang\)\)/);
  const test2 = s.match(/function runVoiceListen\(btn\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(test2, /resolveSpeech\(lang, voices, pref\)/);
  // 설정을 바꾸면 리더가 다시 고른다
  assert.match(s, /dispatchEvent\(new CustomEvent\('medreader:voicepref'/);
  assert.match(c, /addEventListener\('medreader:voicepref', onVoicePref\)/);
  // 번역 언어를 바꿔도 번역문 음성·태그를 다시 고른다(headless 에서 찾은 옛 결함 — 대상 언어가 바뀌어도 옛 태그로 읽음)
  // `[다듬기 1]` 알림은 chooseTargetLang 안으로 옮겼다 — 동작은 tests/polish-1.test.mjs P3 가 잰다.
  const tl = s.match(/function onTargetLang\(btn\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(tl, /if \(!chooseTargetLang\(btn\.getAttribute\('data-lang'\)\)\) return;/);
  const ct = s.match(/export function chooseTargetLang\(raw, target\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(ct, /dispatchEvent\(new CustomEvent\('medreader:voicepref'/);
  // 사라진 음성 — 이미 체크된 "휴대폰 설정 따름"을 다시 눌러도 저장값을 지운다(change 가 안 온다 → click 도 듣는다)
  assert.match(s, /addEventListener\('click', onVoicePick\)/);
  const vp = s.match(/function onVoicePick\(ev\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(vp, /if \(now\.uri === pref\.uri && now\.accent === pref\.accent\) return;/);
});

/* ══ 8. 설정 화면 — 순수 부분 ══════════════════════════ */

test('K17 ★ 선택지 줄 — 휴대폰 설정 따름(기본, 체크) → 억양 머리 줄 → 목소리 이름 그대로 · 성별 표시 없음', () => {
  const m = voiceChoiceRows('en', NOUR, { uri: '', accent: '' }, { settled: true, uiLang: 'en' });
  assert.equal(m.rows[0].kind, 'phone');
  assert.equal(m.rows[0].checked, true);
  assert.deepEqual(m.rows.slice(1).map((r) => r.kind + ':' + r.level),
    ['accent:1', 'voice:2', 'accent:1', 'voice:2', 'accent:1', 'voice:2', 'accent:1', 'voice:2', 'accent:1', 'voice:2']);
  const acc = m.rows.filter((r) => r.kind === 'accent');
  assert.deepEqual(acc.map((r) => r.value), ['en-AU', 'en-GB', 'en-IN', 'en-NG', 'en-US']);
  assert.ok(acc.every((r) => r.label === 'settings.tts.voice.accent' && r.params.region));
  const vs = m.rows.filter((r) => r.kind === 'voice');
  assert.deepEqual(vs.map((r) => r.label), languageVoices('en', NOUR).map((v) => v.name), '이름 그대로');
  assert.ok(vs.every((r) => r.meta === 'settings.tts.voice.local'));
  assert.ok(m.rows.filter((r) => r.checked).length === 1, '체크는 하나');
  const all = JSON.stringify(m.rows);
  assert.ok(!/female|male|gender|성별|여성|남성/i.test(all), '성별을 추정해 표시하지 않는다');
  assert.equal(m.missing, false);
  assert.equal(m.empty, false);
});

test('K18 선택지 — 고른 목소리·억양에 체크, 아랍어(0개)는 휴대폰 설정 하나 + 빈 목록 안내', () => {
  const gb = NOUR.find((v) => v.lang === 'en_GB');
  let m = voiceChoiceRows('en', NOUR, { uri: gb.voiceURI, accent: 'en-GB' }, { settled: true });
  assert.deepEqual(m.rows.filter((r) => r.checked).map((r) => r.kind + ':' + r.value), ['voice:' + gb.voiceURI]);
  m = voiceChoiceRows('en', NOUR, { uri: '', accent: 'en-NG' }, { settled: true });
  assert.deepEqual(m.rows.filter((r) => r.checked).map((r) => r.kind + ':' + r.value), ['accent:en-NG']);
  m = voiceChoiceRows('ar', NOUR, { uri: '', accent: '' }, { settled: true });
  assert.deepEqual(m.rows.map((r) => r.kind), ['phone']);
  assert.equal(m.empty, true);
});

test('K19 ★ 사라진 음성 — 목록이 안정된 뒤에만 "사라짐", 체크는 실제로 읽는 쪽(억양/휴대폰 설정)', () => {
  let m = voiceChoiceRows('en', NOUR, { uri: 'urn:gone', accent: 'en-GB' }, { settled: false });
  assert.equal(m.missing, false, '목록이 늦게 오는 중 — 사라짐이라 하지 않는다');
  m = voiceChoiceRows('en', NOUR, { uri: 'urn:gone', accent: 'en-GB' }, { settled: true });
  assert.equal(m.missing, true);
  assert.deepEqual(m.rows.filter((r) => r.checked).map((r) => r.kind + ':' + r.value), ['accent:en-GB']);
  m = voiceChoiceRows('en', NOUR, { uri: 'urn:gone', accent: '' }, { settled: true });
  assert.equal(m.missing, true);
  assert.deepEqual(m.rows.filter((r) => r.checked).map((r) => r.kind), ['phone']);
  // 저장한 억양이 이 기기 목록에 없다 — 그 태그로 읽고 있으므로 "목록에 없음" 줄로 보인다(체크)
  m = voiceChoiceRows('en', NOUR.filter((v) => v.lang !== 'en_GB'), { uri: '', accent: 'en-GB' }, { settled: true });
  const un = m.rows.filter((r) => r.unlisted);
  assert.equal(un.length, 1);
  assert.deepEqual([un[0].kind, un[0].value, un[0].checked, un[0].label], ['accent', 'en-GB', true, 'settings.tts.voice.unlistedAccent']);
});

test('K20 저장값 — 목소리 = uri + 그 음성의 억양 · 억양만 = uri \'\' · 휴대폰 설정 = 둘 다 \'\'', () => {
  const gb = NOUR.find((v) => v.lang === 'en_GB');
  assert.deepEqual(voicePrefFor('voice', gb.voiceURI, NOUR, 'en'), { uri: gb.voiceURI, accent: 'en-GB' });
  assert.deepEqual(voicePrefFor('accent', 'en-IN', NOUR, 'en'), { uri: '', accent: 'en-IN' });
  assert.deepEqual(voicePrefFor('phone', '', NOUR, 'en'), { uri: '', accent: '' });
  assert.deepEqual(voicePrefFor('voice', 'urn:ko_KR', NOUR, 'ko'), { uri: 'urn:ko_KR', accent: 'ko-KR' });
  assert.deepEqual(voicePrefFor('accent', 'fr-CA', NOUR, 'en'), { uri: '', accent: '' }, '다른 언어 억양은 저장하지 않는다');
  for (const l of ['en', 'fr', 'ko', 'ar']) assert.ok(VOICE_SAMPLES[l], '[들어 보기] 문장 ' + l);
});

test('K21 i18n — 새 키가 네 언어에 있고, 억양 문구에 {region}, 안내 한 줄은 휴대폰 설정을 가리킨다', () => {
  const keys = ['settings.tts.voice.title', 'settings.tts.voice.phone', 'settings.tts.voice.accent', 'settings.tts.voice.accentShort',
    'settings.tts.voice.unlistedAccent', 'settings.tts.voice.noRegion', 'settings.tts.voice.local', 'settings.tts.voice.remote',
    'settings.tts.voice.none', 'settings.tts.voice.missing', 'settings.tts.voice.missingBadge', 'settings.tts.voice.checking',
    'settings.tts.voiceHint'];
  for (const l of LANGS) {
    for (const k of keys) assert.ok(typeof BUNDLES[l][k] === 'string' && BUNDLES[l][k].length > 0, l + ' ' + k);
    assert.match(BUNDLES[l]['settings.tts.voice.accent'], /\{region\}/);
    assert.match(BUNDLES[l]['settings.tts.voice.missing'], /\{fallback\}/);
    assert.match(BUNDLES[l]['settings.tts.voice.none'], /\{lang\}/);
  }
  assert.match(BUNDLES.ko['settings.tts.voiceHint'], /휴대폰 설정 > 텍스트 음성 변환/);
});

test('K22 index.html — 설정 화면에 목소리 카드(그릇·안내 한 줄), 문구는 data-i18n', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const card = html.match(/<div class="card settings-card" id="settingsVoices">([\s\S]*?)<\/div>\s*<\/section>/);
  assert.ok(card, '#settingsVoices 카드');
  assert.match(card[1], /id="ttsVoiceLangs"/);
  assert.match(card[1], /data-i18n="settings\.tts\.voiceHint"/);
  assert.match(card[1], /data-i18n="settings\.tts\.voice\.title"/);
});

/* ══ 9. 8k-0 진단 페이지 ══════════════════════════════ */

test('K23 dev/voices.html — [앱이 고른 음성] = resolveSpeech · [이전 규칙] = pickVoice · 억양 묶음(accentGroups)', () => {
  const html = readFileSync(new URL('../dev/voices.html', import.meta.url), 'utf8');
  for (const k of ['ar', 'en', 'fr', 'ko']) {
    assert.ok(html.indexOf('data-say="old" data-lang="' + k + '"') >= 0, '[이전 규칙 ' + k + ']');
    assert.ok(html.indexOf('data-accents="' + k + '"') >= 0, '억양 묶음 자리 ' + k);
  }
  const app = html.match(/function appChoice\(k, list\)\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(app, /app\.resolveSpeech\(k, list,/);
  assert.ok(!/pickVoice/.test(app), '[앱이 고른 음성] 은 새 규칙');
  const old = html.match(/function oldChoice\(k, list\)\s*\{([\s\S]*?)\n  \}/)[1];
  assert.match(old, /app\.pickVoice\(k, list, ''\)/);
  assert.match(html, /app\.accentGroups\(k, list\)/);
  assert.match(html, /<th>억양 묶음<\/th>/);
});
