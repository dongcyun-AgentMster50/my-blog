/* ============================================================
   tests/srclang-7c.test.mjs — spec 16-C 새 두 항목 · 16-D1 · 6-1 · 6-3 (7c)

   ★ 핵심 계약: **영어 분할 결과는 한 글자도 바뀌지 않는다.**
     `splitSentences(text)` 와 `splitSentences(text, {lang:'en'})` 가 같아야 하고,
     둘 다 7c **이전 구현**(아래 `legacySplit` — 그대로 옮겨 둔 사본)과 같아야 한다.
     인자 없는 호출끼리만 비교하면 두 쪽이 함께 바뀌어도 초록이다 — 그래서 사본과 대조한다.

   문장은 전부 직접 지었다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { splitSentences, endsSentence } from '../js/text/segment.js';
import { buildUnits, normalizeSpeech, symbolsFor, sentencesOf } from '../js/tts/text.js';
import { availability, utteranceLang, pickVoice } from '../js/tts/voices.js';
import { createSpeaker } from '../js/tts/speaker.js';
import { TTS_SYMBOLS, TTS_LANG_REGION } from '../js/config.js';

/* 7c 이전의 `splitSentences` — 글자 그대로의 사본. 바꾸지 마라. */
function legacySplit(text) {
  const t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    let j = i + 1;
    while (j < t.length && '"”\')]'.indexOf(t[j]) >= 0) j++;
    if (j >= t.length) break;
    if (t[j] !== ' ') continue;
    const head = t.slice(start, j);
    if (!endsSentence(head)) continue;
    const next = t[j + 1];
    if (!next) break;
    if (!/[A-Z0-9(\[«"“']/.test(next)) continue;
    out.push(head.trim());
    start = j + 1;
  }
  const tail = t.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/* 영어 분할의 까다로운 자리를 모은 지어낸 문장들 — 약어·머리글자·인용·괄호·숫자·
   소문자 이음·말줄임·악센트 대문자·한글이 마침표 뒤에 오는 경우까지. */
const CORPUS = [
  'Fever was noted in 3 of 10 cases. It resolved.',
  'Use e.g. the second form. Then stop.',
  'Dr. Kim saw the patient at 9 a.m. today. The rash was gone.',
  'The dose was 2.5 mg. (See Table 4.) Repeat in 6 h.',
  'He said "stop." Then he left! Why? Nobody knows…  Later it rained.',
  'J. R. Smith et al. described it. The cohort was small.',
  'Values were high. éarly morning samples differed. Évitez is French, not English.',
  'The test was positive. 환자는 좋아졌다. Another line.',
  'Ends with abbreviation vs. Continues here. Fig. 3 shows it.',
  'Lower case after period. and it continues. «Quoted» start. [Bracket] start.',
  'I-42. An 18-year-old man. A. Primary option. The answer is C.',
  '   lots   of\n spaces.   Next\tsentence here.  ',
  '',
  'No terminal punctuation at all'
];

test('E1 ★★ 영어 분할 불변 — 인자 없음 · {lang:"en"} · 7c 이전 사본이 전부 같다 (16-C)', () => {
  for (const s of CORPUS) {
    const old = legacySplit(s);
    assert.deepEqual(splitSentences(s), old, 'no-arg: ' + s);
    assert.deepEqual(splitSentences(s, { lang: 'en' }), old, 'en: ' + s);
    assert.deepEqual(splitSentences(s, {}), old, '{}: ' + s);
    assert.deepEqual(splitSentences(s, { lang: 'xx' }), old, '모르는 언어는 en 규칙: ' + s);
    assert.deepEqual(splitSentences(s, { lang: 'toString' }), old, '프로토타입 이름에 속지 않는다: ' + s);
  }
});

test('E2 ★ buildUnits — 언어 인자 없음 = {lang:"en"} (기호 치환 포함, 문장·줄 모드 모두)', () => {
  const paras = [
    { id: 'p1', kind: 'body', lines: [
      { id: '1:1', text: 'CRP was ≥ 10 mg/L in 12% of cases. Dr. Lee', hyphen: 'none' },
      { id: '1:2', text: 'noted a cardio-', hyphen: 'hidden' },
      { id: '1:3', text: 'vascular risk → high. Évitez nothing.', hyphen: 'none' }
    ] },
    { id: 'tablenotice:3:r0', kind: 'table-notice', lines: [{ id: 'n1', text: 'Table skipped.', hyphen: 'none' }] }
  ];
  for (const unit of ['sentence', 'line']) {
    assert.deepEqual(buildUnits(paras, unit, { lang: 'en' }), buildUnits(paras, unit), unit);
    assert.deepEqual(buildUnits(paras, unit, {}), buildUnits(paras, unit), unit);
  }
  assert.equal(normalizeSpeech('≥ 4'), 'greater than or equal to 4');
  assert.equal(symbolsFor(undefined), TTS_SYMBOLS.en);
  assert.equal(symbolsFor('en'), TTS_SYMBOLS.en);
});

test('E3 `[가정]` fr — 악센트 대문자로 시작하는 다음 문장에서 자른다 (en 은 자르지 않는다)', () => {
  const s = 'La fièvre a cédé. Évitez les anti-inflammatoires. Ça suffit.';
  assert.deepEqual(splitSentences(s, { lang: 'fr' }),
    ['La fièvre a cédé.', 'Évitez les anti-inflammatoires.', 'Ça suffit.']);
  assert.deepEqual(splitSentences(s), ['La fièvre a cédé. Évitez les anti-inflammatoires. Ça suffit.']);
  // 소문자 이음은 fr 에서도 자르지 않는다.
  assert.deepEqual(splitSentences('Voir p. ex. la suite. puis rien.', { lang: 'fr' }).length, 1);
});

test('E4 `[가정]` ko — 마침표 뒤 한글에서 자른다', () => {
  const s = '환자는 열이 있었다. 항생제를 시작하였다. CRP 는 정상이었다.';
  assert.deepEqual(splitSentences(s, { lang: 'ko' }),
    ['환자는 열이 있었다.', '항생제를 시작하였다.', 'CRP 는 정상이었다.']);
  assert.equal(splitSentences(s).length, 2, 'en 규칙은 한글 앞에서 자르지 않는다(지금 동작 그대로)');
});

test('E5 ★ 기호 표는 원문 언어별 — fr·ko·und 는 비어 있어 영어 낱말을 끼우지 않는다 (6-1)', () => {
  const paras = [{ id: 'p', kind: 'body', lines: [{ id: 'a', text: 'CRP ≥ 10 et 12 % des cas.', hyphen: 'none' }] }];
  const en = buildUnits(paras, 'sentence');
  const fr = buildUnits(paras, 'sentence', { lang: 'fr' });
  assert.match(en[0].text, /greater than or equal to/);
  assert.equal(fr[0].text, 'CRP ≥ 10 et 12 % des cas.');
  assert.deepEqual(symbolsFor('fr'), {});
  assert.deepEqual(symbolsFor('ko'), {});
  assert.deepEqual(symbolsFor('und'), {});
  assert.deepEqual(symbolsFor('constructor'), {});
  // 번역 입력(src)은 언어와 무관하게 치환 이전 원문이다(7-8-2).
  assert.equal(fr[0].src, en[0].src);
});

test('E6 분할 한 벌 — fr 큐도 sentencesOf 가 다시 나누지 않는다 (seg 하나에 문장 하나)', () => {
  const paras = [{ id: 'p', kind: 'body', lines: [{ id: 'a', text: 'Il a de la fièvre. Évitez le froid. Reposez-vous.', hyphen: 'none' }] }];
  const units = buildUnits(paras, 'sentence', { lang: 'fr' });
  const s = sentencesOf(units);
  assert.deepEqual(s.map((x) => x.src), ['Il a de la fièvre.', 'Évitez le froid.', 'Reposez-vous.']);
});

/* ── 6-3 음성 ─────────────────────────────────────────────── */

const VOICES = [
  { lang: 'en_US', name: 'English US', localService: true, voiceURI: 'en1' },
  { lang: 'fr-CA', name: 'Google français', localService: false, voiceURI: 'fr1' },
  { lang: 'fr_FR', name: 'Français', localService: true, voiceURI: 'fr2' }
];

test('V1 ★ utteranceLang — 고른 음성의 lang(하이픈), 없으면 언어별 기본 지역', () => {
  assert.equal(utteranceLang('fr', pickVoice('fr', VOICES)), 'fr-FR');
  assert.equal(utteranceLang('ko', null), TTS_LANG_REGION.ko);
  assert.equal(utteranceLang('fr', null), 'fr-FR');
  assert.equal(utteranceLang(undefined, null), TTS_LANG_REGION.en);
  assert.equal(utteranceLang('und', null), 'und');
});

test('V2 ★ availability — out[doc.lang] 을 담는다 (en 고정이 아니다)', () => {
  const a = availability(VOICES, 'fr');
  assert.equal(a.en, true);
  assert.equal(a.fr, true);
  assert.equal(a.ko, false);
  assert.equal(a.ar, false);
  const b = availability([], 'und');
  assert.equal(b.und, false);
  assert.deepEqual(Object.keys(availability(VOICES)).sort(), ['ar', 'en', 'fr', 'ko']);
});

/* ── 6-1 낭독기 — 언어 **전달**만 ───────────────────────────── */

function speakerWith(paras) {
  const spoken = [];
  const synth = {
    speaking: false, pending: false,
    speak(u) { spoken.push(u); },
    cancel() { }
  };
  const timers = { setTimeout: () => 0, clearTimeout: () => { } };
  const sp = createSpeaker({
    synth: synth, timers: timers,
    makeUtterance: (text) => ({ text: text }),
    view: {
      paras: () => paras,
      page: () => ({ page: 1, pageCount: 1 }),
      goToPage: () => Promise.resolve(false),
      show: () => true,
      markDone: () => { }
    },
    requestWakeLock: () => Promise.resolve(null)
  });
  return { sp, spoken };
}

const FR_PARAS = [{ id: 'p', kind: 'body', lines: [{ id: 'l1', text: 'Il a de la fièvre. Évitez le froid.', hyphen: 'none' }] }];

test('P1 ★ setDocLang("fr-FR") → utterance.lang = fr-FR, 큐는 fr 규칙으로 나뉜다 (16-C)', () => {
  const { sp, spoken } = speakerWith(FR_PARAS);
  const v = { lang: 'fr-FR', name: 'fr' };
  sp.setVoice('fr', v);
  sp.setDocLang('fr-FR');
  sp.play();
  assert.equal(sp.getTotal(), 2, 'fr 규칙 — 두 문장');
  assert.equal(spoken[0].lang, 'fr-FR');
  assert.equal(spoken[0].voice, v);
  assert.equal(sp.getDocLang(), 'fr-FR');
});

test('P2 ★ 기본(en) 은 지금과 같다 — en-US, 영어 규칙(악센트 대문자에서 자르지 않음)', () => {
  const { sp, spoken } = speakerWith(FR_PARAS);
  sp.play();
  assert.equal(sp.getTotal(), 1);
  assert.equal(spoken[0].lang, TTS_LANG_REGION.en);
});

test('P3 ★ 열린 문서의 언어를 바꾸면 reload 가 새 언어로 큐를 다시 만든다 (새로고침 없이)', () => {
  const { sp } = speakerWith(FR_PARAS);
  sp.play();
  assert.equal(sp.getTotal(), 1);
  sp.setDocLang('fr-FR');
  sp.reload();
  assert.equal(sp.getTotal(), 2);
  sp.setDocLang('en_US');               // 안드로이드식 표기도 en 으로 읽는다
  sp.reload();
  assert.equal(sp.getTotal(), 1);
});
