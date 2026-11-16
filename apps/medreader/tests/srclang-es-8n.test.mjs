/* ============================================================
   tests/srclang-es-8n.test.mjs — 8n 스페인어 원문 언어 (spec 19-1-3 §5 · F4 · L-D1)

   N1 합성 스페인어 → es(score ≥ 0.5) · N2 ¿¡ 앞에서 끊는다 · N3 ★★ 7c E1 꼴 회귀 — 8n 이전(HEAD) 모듈로 만든
   golden 과 en·fr·ko 의 `guessLang`·`splitSentences` 가 글자 단위로 같다 · N4 ★ 8n 이전 판정 사본과 무작위
   대조(es 가 이기지 않으면 결과가 같다) · N5 경계(en/fr 와 es 가 섞인 글) · N6 서재 [⋯]·문서 필드 · N7 낭독
   (8m 라틴 문장·8o 빈칸·기호 표·지역 태그·8k 억양) · N8 번역 요청·낭독 동반 문 · N9 UI 언어 목록엔 없음.
   `[8n-b]` N11 보통 꼴 스페인어·프랑스어(es 비교에서만 fr 쪽 la 빼기) · N12 es 최소량 경계 · N13 es score 값 ·
   N14 es 견본 문장의 언어 · N2 꼬리 질문 뒤 ¿¡. `[8n-c]` N15 프랑스어 `tu es`·`t'es` 는 es 비교에서 fr 쪽 ·
   N2 겹약어 뒤 ¿¡대문자에서 끊는다(겹약어 규칙 뺌). `[8n-d]` es 묶음에서 `es` 를 뺐다 — 8n-c 의 `tu es` 규칙을
   지우고 N1·N11·N13·N15 를 맞췄다 · N16 프랑스어 `es` 의 다른 꼴(`es-tu`·`n'es`·`n'y es`·`qui es`…)·짧은 스페인어.
   `[8n-e]` N17 대문자 es 기능어는 다음 낱말이 소문자일 때만 — 스페인어 고유명사·저자명이 든 프랑스어·영어는 8n 이전 값,
   `Los pacientes` 꼴 스페인어는 es, 경계(다음 낱말 소문자/대문자/없음/문장 첫머리). 묶음 판정의 200자 채움은
   `atLeast200`(되풀이 — 200–219자 글의 기능어 수가 두 배) 대신 `padTo200`(숫자 — 기능어 수 그대로) — N16 ★ 기대 정정.
   문장은 모두 지어낸 것이다(원서 문장 아님).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  guessLang, functionWordRates, langFromGuess, applyGuess, applyUserLang, shouldGuess,
  unitLang, SUPPORTED_SRC, LOW_SCORE, GUESS
} from '../js/text/lang.js';
import { splitSentences } from '../js/text/segment.js';
import { buildUnits, symbolsFor, blankWordFor } from '../js/tts/text.js';
import { utteranceLang, defaultSpeechTag, resolveSpeech, accentGroups, availability } from '../js/tts/voices.js';
import { TTS_LANG_REGION, SPEECH_BLANK, TTS_SYMBOLS } from '../js/config.js';
import { buildTranslateRequest, langName } from '../js/ai/prompts.js';
import { effectiveMode, REASON } from '../js/ai/readalong.js';
import { BUNDLES } from '../js/i18n/index.js';
import {
  ES, GUESS_CASES, SPLIT_CASES, SPLIT_LANGS, ES_NATURAL, FR_NATURAL, FR_TUES, ES_TU, FR_ES_FORMS, ES_SHORT,
  PROPER_FR, PROPER_EN, ES_CAPS, padTo200
} from './fixtures/srclang-8n-corpus.mjs';

const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/srclang-8n.golden.json', import.meta.url), 'utf8'));

const para = (id, lines) => ({ id: id, kind: 'body', lines: lines });
const ln = (id, text) => ({ id: id, text: text, hyphen: 'none' });

/* ══ N1 판정 ═══════════════════════════════════════════ */

test('N1 ★ 합성 스페인어 4문장 → es, score ≥ 0.5 · 문서 lang 도 es', () => {
  assert.ok(ES.length >= GUESS.MIN_CHARS, '시험 전제: 200자 이상');
  const g = guessLang(ES);
  assert.equal(g.lang, 'es');
  assert.ok(g.score >= LOW_SCORE, 'score ' + g.score);
  assert.equal(g.script, 'latin');
  assert.equal(langFromGuess(g), 'es');
  const r = functionWordRates(ES);
  assert.ok(r.es >= Math.max(r.en, r.fr) * GUESS.WORD_FACTOR, '2배 규칙 충족(la 를 빼지 않아도)');
});

test('N1 es 기능어는 en·fr 묶음과 겹치지 않는다 — la·que·se·y 는 세지 않는다 · `[8n-d]` es 도 세지 않는다(프랑스어 동사 es)', () => {
  const r = functionWordRates('la que se y');
  assert.equal(r.es, 0);
  assert.equal(r.fr, 250);                          // la 하나 / 4낱말
  const r2 = functionWordRates('el los las del por para con una lo');
  assert.equal(r2.es, 1000);
  assert.equal(r2.esWords, 9);
  assert.equal(r2.en, 0);
  assert.equal(r2.fr, 0);
  const r3 = functionWordRates('el los las del por para con una es lo');
  assert.equal(r3.esWords, 9);                      // es 는 빠진다
  assert.equal(r3.es, 900);
  assert.equal(functionWordRates('es ES Es').esWords, 0);
});

test('N1 짧으면(200자 미만) 스페인어도 판단하지 않는다 — en + score 0', () => {
  const g = guessLang('El paciente está bien. ¿Y la fiebre? ¡Ya no!');
  assert.deepEqual(g, { lang: 'en', score: 0, script: 'latin' });
});

test('N1 es 기능어만 있고 en·fr 0 → es, score 1', () => {
  let s = 'el caso de los pacientes con una tos por el día ';
  while (s.length < 260) s += s;
  const g = guessLang(s);
  assert.equal(g.lang, 'es');
  assert.equal(g.score, 1);
});

/* ══ N2 문장 나눔 ═══════════════════════════════════════ */

test('N2 ★ es — ¿·¡ 로 시작하는 문장에서 끊는다 (종결 부호는 ?·! 그대로)', () => {
  assert.deepEqual(splitSentences('Lo más importante es descansar. ¿Cuánto tiempo durará? ¡Lo sabremos pronto! Bien.', { lang: 'es' }),
    ['Lo más importante es descansar.', '¿Cuánto tiempo durará?', '¡Lo sabremos pronto!', 'Bien.']);
  // 악센트 대문자(Á·É)도 fr 처럼 문장 시작
  assert.deepEqual(splitSentences('Ya llegó. Él no sabe. Ángela tampoco.', { lang: 'es' }),
    ['Ya llegó.', 'Él no sabe.', 'Ángela tampoco.']);
  // 여는 부호는 문장 **안** 글자 — 그 앞의 쉼표·소문자 이음에서는 끊지 않는다
  assert.deepEqual(splitSentences('Dijo, ¿vienes? y se fue. después nada.', { lang: 'es' }),
    ['Dijo, ¿vienes? y se fue. después nada.']);
  // 같은 글을 en 규칙으로 나누면 ¿ 앞에서 끊지 않는다(8n 이전 그대로)
  assert.deepEqual(splitSentences('Bien. ¿Qué tal?', { lang: 'en' }), ['Bien. ¿Qué tal?']);
  assert.deepEqual(splitSentences('Bien. ¿Qué tal?', { lang: 'es' }), ['Bien.', '¿Qué tal?']);
});

test('N2 ★ es `[8n-b]` — 꼬리 질문(¿ 뒤 소문자)에서는 끊지 않는다 · 짧은 낱말 끝 문장은 그대로 끊는다', () => {
  assert.deepEqual(splitSentences('Es grave… ¿o no? Creo que sí.', { lang: 'es' }), ['Es grave… ¿o no?', 'Creo que sí.']);
  assert.deepEqual(splitSentences('Bien. ¡qué raro! Fin.', { lang: 'es' }), ['Bien. ¡qué raro!', 'Fin.']);
  // 겹약어 뒤라도 소문자로 이어지는 꼬리 질문은 끊지 않는다(규칙은 뒤 글자만 본다)
  assert.deepEqual(splitSentences('Hay dudas, p. ej. ¿cuándo empezar? Nadie sabe.', { lang: 'es' }),
    ['Hay dudas, p. ej. ¿cuándo empezar?', 'Nadie sabe.']);
  // 짧은 낱말(tos·así) 끝 문장은 8n 그대로 ¿ 앞에서 끊는다
  assert.deepEqual(splitSentences('Tiene tos. ¿Desde cuándo? Hoy.', { lang: 'es' }), ['Tiene tos.', '¿Desde cuándo?', 'Hoy.']);
  assert.deepEqual(splitSentences('Es así. ¡Qué bien! No sé.', { lang: 'es' }), ['Es así.', '¡Qué bien!', 'No sé.']);
  // en·fr·ko 규칙은 ¿¡ 를 문장 시작으로 보지 않는다 — 이 규칙과 무관(8n 이전 그대로)
  assert.deepEqual(splitSentences('Tiene tos. ¿Desde cuándo? Hoy.', { lang: 'fr' }), ['Tiene tos. ¿Desde cuándo?', 'Hoy.']);
});

test('N2 ★ es `[8n-c]` — 겹약어(`i. v.`·`a. m.`·`p. ej.`) 뒤 ¿¡대문자에서 끊는다(8n-b 의 겹약어 규칙을 뺐다) · 보통 대문자 낱말 뒤와 같다', () => {
  // 문장 끝 의학·시각 약어 — 약어 마침표가 문장 마침표를 겸한다
  assert.deepEqual(splitSentences('Se administró 1 g i. v. ¿Y si hay alergia? Cambie.', { lang: 'es' }),
    ['Se administró 1 g i. v.', '¿Y si hay alergia?', 'Cambie.']);
  assert.deepEqual(splitSentences('Se pautó heparina s. c. ¡Vigile las plaquetas! Bien.', { lang: 'es' }),
    ['Se pautó heparina s. c.', '¡Vigile las plaquetas!', 'Bien.']);
  assert.deepEqual(splitSentences('La cita es a las 9 a. m. ¿Llegarás? Avísame.', { lang: 'es' }),
    ['La cita es a las 9 a. m.', '¿Llegarás?', 'Avísame.']);
  assert.deepEqual(splitSentences('Sale a las 6 p.m. ¡Qué tarde! Ya.', { lang: 'es' }), ['Sale a las 6 p.m.', '¡Qué tarde!', 'Ya.']);
  // 문장 중간 `p. ej.` 도 끊긴다 — 글자만으로는 위와 가를 수 없다(spec 19-1-3 §5 정정 8n-c 의 한계). 보통 대문자 낱말 뒤와 같은 자리
  assert.deepEqual(splitSentences('Hay dudas, p. ej. ¿Cuándo empezar? Nadie sabe.', { lang: 'es' }),
    ['Hay dudas, p. ej.', '¿Cuándo empezar?', 'Nadie sabe.']);
  assert.deepEqual(splitSentences('Hay dudas, p.ej. ¡Qué lío! Bien.', { lang: 'es' }), ['Hay dudas, p.ej.', '¡Qué lío!', 'Bien.']);
  assert.deepEqual(splitSentences('Use uno, p. ej. Paracetamol es seguro. Fin.', { lang: 'es' }),
    ['Use uno, p. ej.', 'Paracetamol es seguro.', 'Fin.']);
  // 8n-b Review 변이 M4 꼴 — 긴 낱말 끝 글자 + 짧은 소문자 낱말 뒤도 끊는다
  assert.deepEqual(splitSentences('Le tomó la mano. sí. ¿Y ahora? Nada.', { lang: 'es' }), ['Le tomó la mano. sí.', '¿Y ahora?', 'Nada.']);
});

test('N2 낭독 단위(buildUnits) — es 문서의 ¿¡ 문장이 따로 선다 · 기호 표 없음(엔진에 맡김)', () => {
  const units = buildUnits([para('p', [ln('1', 'Tiene fiebre ≥ 38 °C. ¿Desde cuándo? ¡Hoy!')])], 'sentence', { lang: 'es' });
  assert.deepEqual(units.map((u) => u.src), ['Tiene fiebre ≥ 38 °C.', '¿Desde cuándo?', '¡Hoy!']);
  assert.equal(units[0].text, 'Tiene fiebre ≥ 38 °C.', '영어 기호 낱말을 끼우지 않는다');
  assert.deepEqual(symbolsFor('es'), {});
  assert.ok(!Object.prototype.hasOwnProperty.call(TTS_SYMBOLS, 'es'), 'es 기호 표는 두지 않는다');
});

/* ══ N3 ★★ 7c E1 꼴 회귀 — 8n 이전 결과와 글자 단위로 같다 ═══════════════ */

test('N3 ★★ guessLang — 말뭉치 전부 8n 이전(HEAD) 결과와 같다 (lang·score·script)', () => {
  assert.equal(Object.keys(GOLDEN.guess).length, GUESS_CASES.length, 'golden 과 말뭉치 수');
  for (const [name, text] of GUESS_CASES) {
    assert.deepEqual(guessLang(text), GOLDEN.guess[name], name);
  }
});

test('N3 ★★ splitSentences — en·fr·ko 규칙의 결과가 8n 이전(HEAD)과 한 글자도 같다', () => {
  for (const l of SPLIT_LANGS) {
    assert.equal(GOLDEN.split[l].length, SPLIT_CASES.length);
    SPLIT_CASES.forEach((s, i) => {
      assert.deepEqual(splitSentences(s, { lang: l }), GOLDEN.split[l][i], l + ' #' + i);
    });
  }
  // 인자 없음 = en 그대로
  SPLIT_CASES.forEach((s, i) => assert.deepEqual(splitSentences(s), GOLDEN.split.en[i], 'no-arg #' + i));
});

/* ══ N4 ★ 8n 이전 판정 사본과 무작위 대조 ══════════════════ */

/* 8n 이전 `guessLang` 의 라틴 갈래 — 글자 그대로의 사본(기능어 묶음 en·fr 포함). 바꾸지 마라. */
const LEGACY_FW = {
  en: new Set(['the', 'and', 'of', 'to', 'is', 'in', 'with', 'for']),
  fr: new Set(['le', 'la', 'les', 'des', 'est', 'et', 'une', 'du', 'pour', 'dans'])
};
function legacyLatin(t) {
  const words = t.toLowerCase().match(/\p{L}+/gu) || [];
  let en = 0;
  let fr = 0;
  for (const w of words) { if (LEGACY_FW.en.has(w)) en++; if (LEGACY_FW.fr.has(w)) fr++; }
  const n = words.length;
  const re = n ? (en * 1000) / n : 0;
  const rf = n ? (fr * 1000) / n : 0;
  const big = Math.max(re, rf);
  const small = Math.min(re, rf);
  if (big === 0) return { lang: 'en', score: 0 };
  const score = Math.round((1 - small / big) * 1000) / 1000;
  if (big >= small * 2) return { lang: rf > re ? 'fr' : 'en', score: score };
  return { lang: 'en', score: score };
}

function prng(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('N4 ★ 무작위 라틴 글 3,000개 — es 가 이기지 않으면 8n 이전과 같고, 이기면 2배 규칙을 충족한다', () => {
  const VOCAB = [
    'the', 'and', 'of', 'to', 'is', 'in', 'with', 'for',
    'le', 'la', 'les', 'des', 'est', 'et', 'une', 'du', 'pour', 'dans',
    'el', 'los', 'las', 'del', 'por', 'para', 'con', 'una', 'es', 'lo',
    'que', 'se', 'y', 'patient', 'fièvre', 'tos', 'cough', 'malade', 'casa', 'dose', 'mg', 'Él', 'Über'
  ];
  const rnd = prng(8);
  let esWins = 0;
  let same = 0;
  for (let k = 0; k < 3000; k++) {
    const n = 40 + Math.floor(rnd() * 80);
    const words = [];
    for (let i = 0; i < n; i++) words.push(VOCAB[Math.floor(rnd() * VOCAB.length)]);
    const t = words.join(' ');
    if (t.length < GUESS.MIN_CHARS) continue;
    const g = guessLang(t);
    if (g.lang === 'es') {
      esWins++;
      const r = functionWordRates(t);
      // `[8n-b]` es 갈래의 fr 은 la 를 뺀 것 · es 기능어 최소량
      assert.ok(r.esWords >= GUESS.ES_MIN_WORDS && r.es >= Math.max(r.en, r.frForEs) * GUESS.WORD_FACTOR, t.slice(0, 40));
      assert.ok(g.score >= LOW_SCORE);
    } else {
      const old = legacyLatin(t);
      assert.equal(g.lang, old.lang, t.slice(0, 40));
      assert.equal(g.score, old.score, t.slice(0, 40));
      same++;
    }
  }
  assert.ok(esWins > 0 && same > 0, '두 갈래가 모두 나왔다: es ' + esWins + ' · 같음 ' + same);
});

/* ══ N5 경계 — 변이 "3자 동시 최댓값" 을 잡는다 ═════════════════ */

test('N5 ★ es 낱말이 섞인 프랑스어(fr 3 · en 1 · es 2) → fr — es 는 en/fr 두 갈래 비교에 끼지 않는다', () => {
  let s = 'le malade et la fièvre the cough con el ';
  while (s.length < 260) s += s;
  const r = functionWordRates(s);
  assert.ok(r.fr >= r.en * 2 && r.es > r.fr / 2 && r.es < r.fr * 2, '시험 전제');
  assert.deepEqual(guessLang(s), { lang: 'fr', score: 0.667, script: 'latin' });
});

test('N5 ★ es 낱말이 섞인 영어(en 4 · es 3 · fr 0) → en, score 1(1 − fr/en) — es 는 score 에도 끼지 않는다', () => {
  let s = 'the patient and the cough with fever con el lo malade ';
  while (s.length < 260) s += s;
  assert.deepEqual(guessLang(s), { lang: 'en', score: 1, script: 'latin' });
});

test('N5 es 가 최다여도 2배 미만이면 es 가 아니다(es 5 · en 3) → en/fr 규칙 그대로', () => {
  let s = 'con el lo para por the and of tos ';
  while (s.length < 260) s += s;
  const g = guessLang(s);
  assert.equal(g.lang, 'en');
  // 경계: es = 2 × en 이면 es
  let b = 'con el lo para the and tos ';
  while (b.length < 260) b += b;
  const rb = functionWordRates(b);
  assert.equal(rb.es, rb.en * 2, '시험 전제: 정확히 2배');
  assert.equal(guessLang(b).lang, 'es');
});

/* ══ N6 서재 [⋯]·문서 필드 ═══════════════════════════════ */

test('N6 ★ SUPPORTED_SRC 끝에 es — 앞 셋 순서 불변 · 모든 원문 언어에 자국어 이름(서재 카드·[⋯]·음성 없음 배너)', () => {
  assert.deepEqual(SUPPORTED_SRC.slice(0, 3), ['en', 'fr', 'ko']);
  assert.equal(SUPPORTED_SRC[SUPPORTED_SRC.length - 1], 'es');
  for (const ui of Object.keys(BUNDLES)) {
    for (const code of SUPPORTED_SRC) {
      assert.equal(typeof BUNDLES[ui]['onboarding.lang.' + code], 'string', ui + ' onboarding.lang.' + code);
    }
    assert.equal(BUNDLES[ui]['onboarding.lang.es'], 'Español', ui);
  }
});

test('N6 ★ [⋯] 에서 es 를 고를 수 있다 · 추정 es 는 문서 lang es · 옛 문서(langGuess 있음)는 다시 추정하지 않는다', () => {
  const u = applyUserLang({ id: 'd', lang: 'fr', langSource: 'auto', langGuess: { lang: 'fr', score: 1, script: 'latin' } }, 'es');
  assert.equal(u.changed, true);
  assert.equal(u.rec.lang, 'es');
  assert.equal(u.rec.langSource, 'user');
  const a = applyGuess({ id: 'n', lang: 'en', langSource: 'default' }, guessLang(ES));
  assert.equal(a.rec.lang, 'es');
  assert.equal(a.rec.langSource, 'auto');
  assert.equal(a.rec.langGuess.lang, 'es');
  // 8n 이전에 fr 로 추정된 스페인어 문서 — 다시 돌지 않는다(서재 불변, 사용자가 [⋯] 로 고친다)
  assert.equal(shouldGuess({ id: 'old', lang: 'fr', langSource: 'auto', langGuess: { lang: 'fr', score: 1, script: 'latin' } }), false);
});

/* ══ N7 낭독 ═══════════════════════════════════════════ */

test('N7 ★ 8m — es 문서의 라틴 문장은 예외 없음(문서 목소리) · 한글 문장은 ko · ko 문서 속 스페인어는 en(8m 규칙 그대로)', () => {
  assert.deepEqual(unitLang('El paciente llegó con fiebre.', 'es'), { lang: null, short: false, mixed: false });
  assert.deepEqual(unitLang('환자는 열이 있었다.', 'es'), { lang: 'ko', short: false, mixed: false });
  assert.deepEqual(unitLang('El paciente llegó con fiebre.', 'ko'), { lang: 'en', short: false, mixed: false });
  assert.deepEqual(unitLang('The patient had fever.', 'en'), { lang: null, short: false, mixed: false });
  assert.deepEqual(unitLang('Le patient avait de la fièvre.', 'fr'), { lang: null, short: false, mixed: false });
  // 문장 전환을 켠 큐: es 문서의 스페인어 단위에 lang 속성이 없다
  // (es 분할은 한글 앞에서 끊지 않는다 — 8m 의 en 분할 한계와 같다. 한국어 문장은 따로 선 문단으로)
  const units = buildUnits([para('p', [ln('1', 'Tiene fiebre. ¿Desde cuándo?')]), para('q', [ln('2', '환자는 좋아졌다.')])],
    'sentence', { lang: 'es', scriptSwitch: true });
  assert.deepEqual(units.map((x) => x.lang || null), [null, null, 'ko']);
});

test('N7 ★ 8o 빈칸 — es 낱말 espacio · 지역 태그 es-ES(8k 억양이 덮는다)', () => {
  assert.equal(SPEECH_BLANK.es, 'espacio');
  assert.equal(blankWordFor('es'), 'espacio');
  const u = buildUnits([para('p', [ln('1', 'Él ------- la casa.')])], 'sentence', { lang: 'es' });
  assert.equal(u[0].text, 'Él espacio la casa.');
  assert.equal(u[0].src, 'Él ------- la casa.', 'src 는 원문 그대로(캐시 키 불변)');
  assert.equal(TTS_LANG_REGION.es, 'es-ES');
  assert.equal(utteranceLang('es'), 'es-ES');
  assert.equal(utteranceLang('es', { lang: 'es_MX' }), 'es-MX');
  assert.equal(defaultSpeechTag('es'), 'es-ES');
  const voices = [
    { lang: 'es-ES', name: 'Español (España)', voiceURI: 'es1', localService: true },
    { lang: 'es_MX', name: 'Español (México)', voiceURI: 'es2', localService: true },
    { lang: 'es-US', name: 'Google español de Estados Unidos', voiceURI: 'es3', localService: false },
    { lang: 'en-US', name: 'English', voiceURI: 'en1', localService: true }
  ];
  assert.deepEqual(accentGroups('es', voices).map((g) => g.accent), ['es-ES', 'es-MX', 'es-US']);
  assert.deepEqual(resolveSpeech('es', voices, { accent: 'es-MX' }), { voice: null, tag: 'es-MX', via: 'accent', missing: false });
  assert.deepEqual(resolveSpeech('es', voices, {}), { voice: null, tag: 'es-ES', via: 'phone', missing: false });
  assert.equal(availability(voices, 'es').es, true);
});

/* ══ N8 번역 ═══════════════════════════════════════════ */

test('N8 ★ 낭독 동반 번역 문이 es 에 열린다 · 번역 요청의 원문 언어 이름은 Spanish', () => {
  const ctx = { mode: 'speak', consented: true, supportedSrc: SUPPORTED_SRC, targetLang: 'ar', unit: 'sentence', hasKey: true };
  assert.notEqual(effectiveMode(Object.assign({}, ctx, { srcLang: 'es' })).reason, REASON.UNSUPPORTED_LANG);
  assert.equal(effectiveMode(Object.assign({}, ctx, { srcLang: 'es', targetLang: 'es' })).reason, REASON.SAME_LANG);
  assert.equal(langName('es'), 'Spanish');
  const req = buildTranslateRequest([{ text: '¿Desde cuándo?' }], { src: 'es', target: 'ar' });
  assert.ok(req && /Translate each segment from Spanish into Arabic\./.test(req.user));
});

/* ══ N9 UI 언어 목록에는 넣지 않는다 ═══════════════════════════ */

test('N9 ★ UI 언어는 그대로 넷 — 번들 키·온보딩 버튼에 es 없음', () => {
  assert.deepEqual(Object.keys(BUNDLES).sort(), ['ar', 'en', 'fr', 'ko']);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const grid = html.slice(html.indexOf('id="langGrid"'), html.indexOf('</div>', html.indexOf('id="langGrid"')));
  const langs = [...grid.matchAll(/data-lang="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(langs, ['ar', 'en', 'fr', 'ko']);
});

/* ══ N10 설정 > 낭독 목소리 — es 묶음 (8n 마무리, spec 19-1-3 §5 정정 ③) ══════════ */

test('N10 ★ 설정 > 낭독 목소리 — es 묶음이 끝에 · 견본 문장 · 기본값 tts.voice.es·tts.accent.es = \'\' · es-MX 억양 저장', async () => {
  const { VOICE_LANGS, VOICE_SAMPLES, voiceChoiceRows, voicePrefFor } = await import('../js/ui/settings.js');
  const { DEFAULTS } = await import('../js/settings.js');
  assert.deepEqual(VOICE_LANGS.slice(0, 4), ['en', 'fr', 'ko', 'ar'], '앞 넷 순서 불변');
  assert.equal(VOICE_LANGS[VOICE_LANGS.length - 1], 'es');
  for (const code of SUPPORTED_SRC) assert.ok(VOICE_LANGS.includes(code), '원문 언어마다 목소리 묶음: ' + code);
  for (const code of VOICE_LANGS) {
    assert.equal(typeof VOICE_SAMPLES[code], 'string', '[들어 보기] 문장 ' + code);
    assert.equal(DEFAULTS['tts.voice.' + code], '', 'tts.voice.' + code);
    assert.equal(DEFAULTS['tts.accent.' + code], '', 'tts.accent.' + code);
  }
  const voices = [
    { lang: 'es-ES', name: 'Español (España)', voiceURI: 'es1', localService: true },
    { lang: 'es_MX', name: 'Español (México)', voiceURI: 'es2', localService: true }
  ];
  const m = voiceChoiceRows('es', voices, { uri: '', accent: '' }, { settled: true, uiLang: 'ko' });
  assert.deepEqual(m.rows.filter((r) => r.kind === 'accent').map((r) => r.value), ['es-ES', 'es-MX']);
  assert.equal(m.rows[0].kind, 'phone');
  assert.equal(m.rows[0].checked, true);
  assert.deepEqual(voicePrefFor('accent', 'es-MX', voices, 'es'), { uri: '', accent: 'es-MX' });
  assert.deepEqual(voicePrefFor('voice', 'es2', voices, 'es'), { uri: 'es2', accent: 'es-MX' });
});

/* ══ N11 `[8n-b]` 보통 꼴 스페인어 — fr 쪽 `la` 를 es 비교에서만 빼고 센다 (8n Review 높음-1) ══════ */

/* `[8n-d]` es 묶음에서 `es` 를 뺀 대가 — `es` 밖의 es 기능어가 하나뿐인 짧은 스페인어는 es 가 아니라 8n 이전 값이다.
 * ES_NATURAL 에서는 `r-shortfem`(los 하나) 하나. spec 19-1-3 §5 정정 8n-d 의 한계.
 * `[8n-e]` `z-casa`(205자)·`z-migrana`(216자)를 더했다 — 8n-d 는 `atLeast200` 이 두 번 이어 붙여 es 기능어 1 → 2 가 된 값을
 * 굳혔었다(8n-d 재검증 낮음-2). 글 그대로(`padTo200`)는 es 기능어 하나 → 8n 이전 값(fr). */
const ES_LIGHT = new Set(['r-shortfem', 'z-gripe', 'z-ciudad', 'z-casa', 'z-migrana']);

test('N11 ★★ 보통 꼴 스페인어 10문단(la 많음 · es 기능어 둘뿐인 것 포함) → es, score ≥ 0.5 · `[8n-d]` es 기능어 하나뿐인 r-shortfem 은 8n 이전 값 · 이으면 es', () => {
  assert.ok(ES_NATURAL.length >= 10);
  for (const [name, s] of ES_NATURAL) {
    const t = padTo200(s);
    const g = guessLang(t);
    if (ES_LIGHT.has(name)) {
      assert.equal(functionWordRates(t).esWords, GUESS.ES_MIN_WORDS - 1, '시험 전제: ' + name);
      assert.deepEqual(g, Object.assign({ script: 'latin' }, legacyLatin(t)), name);
      continue;
    }
    assert.equal(g.lang, 'es', name + ' ' + JSON.stringify(g));
    assert.ok(g.score >= LOW_SCORE, name + ' score ' + g.score);
    // 8n 이전 규칙(la 를 fr 로 셈)으로는 이 묶음 대부분이 fr 이었다 — 고침이 실제로 일하는지
  }
  assert.equal(ES_NATURAL.filter(([n]) => ES_LIGHT.has(n)).length, 1, 'ES_NATURAL 에서 대가는 하나');
  const frBefore = ES_NATURAL.filter(([, s]) => legacyLatin(padTo200(s)).lang === 'fr').length;
  assert.ok(frBefore >= 8, '8n 이전 규칙으로 fr 이던 문단 수 ' + frBefore);
  assert.equal(guessLang(ES_NATURAL.map((x) => x[1]).join(' ')).lang, 'es');
});

test('N11 ★★ 보통 꼴 프랑스어 7문단 + 기존 fr 픽스처 → fr 그대로 · 결과가 8n 이전 규칙과 같다', () => {
  const cases = FR_NATURAL.concat([['fixture-fr', GUESS_CASES.find((c) => c[0] === 'fr')[1]]]);
  for (const [name, s] of cases) {
    const t = padTo200(s);
    const g = guessLang(t);
    assert.equal(g.lang, 'fr', name);
    const old = legacyLatin(t);
    assert.equal(g.score, old.score, name);
    assert.equal(old.lang, 'fr', name);
  }
});

test('N11 ★ frForEs — es 갈래 비교용 fr 은 la 만 뺀다(le·les 는 센다) · en·fr 두 갈래의 fr 은 la 를 센다', () => {
  const r = functionWordRates('la la le les con el tos fiebre');
  assert.equal(r.fr, 500);                           // la la le les / 8
  assert.equal(r.frForEs, 250);                      // le les / 8
  assert.equal(r.esWords, 2);
  // la 만 많은 스페인어 꼴(fr 0 · la 9 · es 2) → es · 같은 글에 le 둘을 더하면 2배 미달 → 8n 이전 규칙(fr)
  let a = 'la la la la la la la la la con el ';
  for (let i = 0; i < 30; i++) a += 'paciente ';
  assert.deepEqual(guessLang(a), { lang: 'es', score: 1, script: 'latin' });
  let b = 'la la la la la la la la la le le con el lo ';
  for (let i = 0; i < 30; i++) b += 'paciente ';
  assert.deepEqual(legacyLatin(b), { lang: 'fr', score: 1 });
  assert.deepEqual(guessLang(b), { lang: 'fr', score: 1, script: 'latin' });
});

/* ══ N12 `[8n-b]` es 최소량 — en·fr 0 + es 낱말 하나로 es 가 되지 않는다 (8n Review 낮음-2 · 변이 d) ══ */

test('N12 ★ es 최소량 경계 — es 기능어 1낱말 → en·0(8n 이전과 같음) · 2낱말 → es·1', () => {
  assert.equal(GUESS.ES_MIN_WORDS, 2);
  const pad = (k) => { const w = []; for (let i = 0; i < k; i++) w.push('con'); for (let i = 0; i < 40; i++) w.push('patient'); return w.join(' '); };
  const one = pad(GUESS.ES_MIN_WORDS - 1);
  const two = pad(GUESS.ES_MIN_WORDS);
  assert.ok(one.length >= GUESS.MIN_CHARS && two.length >= GUESS.MIN_CHARS, '시험 전제: 200자 이상');
  assert.deepEqual(guessLang(one), { lang: 'en', score: 0, script: 'latin' });
  assert.deepEqual(guessLang(one), Object.assign({ script: 'latin' }, legacyLatin(one)));
  assert.deepEqual(guessLang(two), { lang: 'es', score: 1, script: 'latin' });
});

test('N12 ★ 포르투갈어 꼴·약어 표(LOS·DEL 한 번) → en·0 (8n 이전과 같음)', () => {
  const pt = 'O paciente chegou ao hospital com febre alta e tosse persistente há uma semana. Os médicos revisaram as radiografias do tórax e encontraram uma lesão no pulmão direito. Durante a noite iniciou-se o tratamento com antibióticos para controlar a infecção. O mais importante é descansar e beber muita água.';
  const table = 'HbA1c 7.2% LDL 3.1 mmol/L HDL 1.0 mmol/L TG 2.3 mmol/L BMI 31 kg/m2 SBP 148 mm Hg DBP 92 mm Hg eGFR 64 mL/min LOS 4 days ALT 42 U/L AST 38 U/L CRP 12 mg/L WBC 11.2 Hb 128 g/L PLT 250 Na 138 K 4.1 Cl 101 HCO3 24 BUN 18 Cr 1.1 mg/dL';
  for (const s of [pt, table, table.replace('LOS', 'DEL')]) {
    assert.ok(s.length >= GUESS.MIN_CHARS);
    assert.equal(functionWordRates(s).esWords, 1, '시험 전제: es 기능어 하나');
    assert.deepEqual(guessLang(s), { lang: 'en', score: 0, script: 'latin' });
  }
});

/* ══ N13 `[8n-b]` es score 식 값 고정 — `1 − max(en, fr−la) / es` (8n Review 변이 c) ══════════════ */

test('N13 ★ es score 값 — en 1 · es 3 → 0.667 · le 1 · la 3 · es 4 → 0.75 · en 2 · es 5 → 0.6 · `[8n-d]` 낱말 es 는 셈 밖', () => {
  const mk = (head) => { let s = head; for (let i = 0; i < 40; i++) s += ' paciente'; return s; };
  assert.deepEqual(guessLang(mk('the con el lo')), { lang: 'es', score: 0.667, script: 'latin' });
  assert.deepEqual(guessLang(mk('le la la la con el lo para')), { lang: 'es', score: 0.75, script: 'latin' });
  assert.deepEqual(guessLang(mk('the and con el lo para por')), { lang: 'es', score: 0.6, script: 'latin' });
  // `[8n-d]` 낱말 `es` 를 더해도 값이 같다(8n-c 판이면 es 5 → 0.8) · es 둘을 es 셋으로 늘려도 en 1 · es 2 → 0.5(8n-c 판 0.8)
  assert.deepEqual(guessLang(mk('the con el lo es es')), { lang: 'es', score: 0.667, script: 'latin' });
  assert.deepEqual(guessLang(mk('the con el es es es')), { lang: 'es', score: 0.5, script: 'latin' });
});

/* ══ N14 `[8n-b]` 설정 [들어 보기] es 견본이 스페인어인가 (8n Review 변이 f) ═════════════════════ */

test('N14 ★ VOICE_SAMPLES.es — 스페인어 글자(á é í ó ú ñ ¿ ¡ 중 하나)가 있고 라틴 문자 · 다른 언어 견본과 다르다', async () => {
  const { VOICE_SAMPLES } = await import('../js/ui/settings.js');
  const s = VOICE_SAMPLES.es;
  assert.match(s, /[áéíóúñ¿¡]/i, s);
  assert.ok(!/[\p{Script=Hangul}\p{Script=Arabic}]/u.test(s), s);
  for (const code of ['en', 'fr', 'ko', 'ar']) assert.notEqual(s, VOICE_SAMPLES[code], code);
  // 영어·프랑스어 견본의 낱말이 섞이지 않았다(영어 문장으로 바꾸면 빨강)
  const words = s.toLowerCase().match(/\p{L}+/gu) || [];
  const r = functionWordRates(s);
  assert.equal(r.en, 0, '영어 기능어 없음');
  assert.ok(words.length >= 3);
});

/* ══ N15 `[8n-c]` 프랑스어 2인칭 `tu es`·`t'es` — es 가 되지 않는다 (8n-b Review 중간-1) ══════════════
 * `[8n-d]` 8n-c 는 `tu es`·`t'es` 의 es 를 es 갈래에서 fr 쪽에 세는 규칙이었다. 8n-d 는 es 묶음에서 `es` 를 빼
 * 규칙을 지웠다 — 프랑스어 묶음의 기대(fr · 8n 이전 값)는 그대로다. */

test('N15 ★★ `tu es`·`t\'es` 꼴 짧은 프랑스어 11문단 → 각각 fr · 값이 8n 이전 규칙과 같다 · 이어도 fr', () => {
  assert.ok(FR_TUES.length >= 9);
  for (const [name, s] of FR_TUES) {
    const t = padTo200(s);
    const g = guessLang(t);
    const old = legacyLatin(t);
    assert.equal(old.lang, 'fr', '시험 전제(8n 이전 fr): ' + name);
    assert.deepEqual(g, { lang: 'fr', score: old.score, script: 'latin' }, name);
    assert.equal(functionWordRates(t).esWords, 0, name + ' — tu es 의 es 는 es 가 아니다');
  }
  assert.equal(guessLang(FR_TUES.map((x) => x[1]).join(' ')).lang, 'fr');
});

test('N15 ★★ 스페인어 묶음은 그대로 es — ES_NATURAL 10 · `t es`(수식 변수)·소유 `tu`·`¿Tú eres?` 2 · 말뭉치 ES · `[8n-d]` r-shortfem 은 8n 이전 값', () => {
  for (const [name, s] of ES_NATURAL.concat(ES_TU, [['ES', ES]])) {
    const t = padTo200(s);
    const g = guessLang(t);
    if (ES_LIGHT.has(name)) { assert.deepEqual(g, Object.assign({ script: 'latin' }, legacyLatin(t)), name); continue; }
    assert.equal(g.lang, 'es', name + ' ' + JSON.stringify(g));
    assert.ok(g.score >= LOW_SCORE, name);
  }
});

test('N15 ★ functionWordRates `[8n-d]` — es 는 어느 꼴이든 es 기능어가 아니고 frForEs 에도 더해지지 않는다 · fr(두 갈래용)·en 그대로', () => {
  const r = functionWordRates('Tu es T’es t\'es t es tues es');
  assert.equal(r.words, 10);
  assert.equal(r.esWords, 0);                      // 8n-c 판: 2(`t es` · 끝 es)
  assert.equal(r.es, 0);
  assert.equal(r.frForEs, 0);                      // 8n-c 판: 300(tu es · T’es · t'es)
  assert.equal(r.fr, 0);
  assert.equal(r.en, 0);
  // 사이 글자와 무관 — 줄바꿈·쉼표·다른 낱말·도치·생략 모두 0
  for (const s of ['tu\n  es', 'tu, es', 'tu casa es', 'es-tu', 'n\'es', 'tu n’y es', 'toi qui es', 'espíritu es']) {
    assert.equal(functionWordRates(s).esWords, 0, s);
  }
  // es 밖 낱말은 그대로 센다 — `tu espalda`·`con el` 꼴 스페인어
  assert.equal(functionWordRates('tu espalda es con el').esWords, 2);
  // 경계: tu es 넷 + la 여럿인 짧은 반말(8n-b 판 es·0.75 이던 꼴) — fr 기능어 0 이어도 es 가 이기지 않는다
  let s = 'Tu es là ? Tu es prête ? Tu es la seule. Tu es attendue à la salle, la porte au fond. ';
  while (s.length < 220) s += s;
  assert.deepEqual(guessLang(s), Object.assign({ script: 'latin' }, legacyLatin(s)));
  assert.equal(guessLang(s).lang, 'fr');
});

/* ══ N16 `[8n-d]` 프랑스어 `es` 의 다른 꼴 · 짧은 스페인어 — es 묶음에서 `es` 를 뺀 득과 대가 (8n-c Review 중간-1) ══ */

test('N16 ★★ 프랑스어 `es-tu`·`n\'es`·`tu en/y es`·`n\'y es`·`qui es`·`t\'en es`·`l\'es` 17문단 → 하나도 es 가 아니다 · 값이 8n 이전 규칙과 같다 · 이어도 fr', () => {
  assert.ok(FR_ES_FORMS.length >= 17);
  for (const [name, s] of FR_ES_FORMS) {
    const t = padTo200(s);
    assert.match(t, /(?<!\p{L})es(?!\p{L})/iu, '시험 전제: 낱말 es 가 있다 ' + name);
    const g = guessLang(t);
    assert.notEqual(g.lang, 'es', name);
    assert.deepEqual(g, Object.assign({ script: 'latin' }, legacyLatin(t)), name);
    assert.equal(functionWordRates(t).esWords, 0, name);
  }
  // 8n-c Review 다섯(8n-c 판에서 넷이 es, 이으면 es·0.55)은 각각·이어서 fr
  for (const [name, s] of FR_ES_FORMS.slice(0, 5)) assert.equal(guessLang(padTo200(s)).lang, 'fr', name);
  assert.deepEqual(guessLang(FR_ES_FORMS.slice(0, 5).map((x) => x[1]).join('\n\n')), { lang: 'fr', score: 1, script: 'latin' });
  assert.equal(guessLang(FR_ES_FORMS.map((x) => x[1]).join(' ')).lang, 'fr');
});

test('N16 ★ 짧은 스페인어 12문단 → 8 es · 대가: es 밖 es 기능어가 하나뿐인 z-gripe·z-ciudad·`[8n-e]` z-casa·z-migrana 는 8n 이전 값(fr) · 이으면 es', () => {
  let light = 0;
  for (const [name, s] of ES_SHORT) {
    const t = padTo200(s);
    const g = guessLang(t);
    if (ES_LIGHT.has(name)) {
      light++;
      assert.equal(functionWordRates(t).esWords, GUESS.ES_MIN_WORDS - 1, '시험 전제: ' + name);
      assert.deepEqual(g, Object.assign({ script: 'latin' }, legacyLatin(t)), name);
      continue;
    }
    assert.equal(g.lang, 'es', name + ' ' + JSON.stringify(g));
    assert.ok(g.score >= LOW_SCORE, name);
  }
  assert.equal(light, 4);                          // 8n-d 는 2 — 되풀이 채움이 z-casa·z-migrana 를 부풀렸다
  assert.equal(guessLang(ES_SHORT.map((x) => x[1]).join(' ')).lang, 'es');
  // `[8n-e]` 채움은 200자 이상 글에 손대지 않고(200–219자 포함), 짧은 글은 숫자로 채워 기능어 셈이 글 그대로다
  for (const [name, s] of ES_SHORT.concat(FR_ES_FORMS)) {
    assert.equal(padTo200(s), s, name);
    const x = s.slice(0, 150);
    assert.ok(padTo200(x).length >= GUESS.MIN_CHARS, name);
    assert.deepEqual(functionWordRates(padTo200(x)), functionWordRates(x), name);
  }
});

/* ══ N17 `[8n-e]` 대문자 es 기능어는 다음 낱말이 소문자일 때만 (8n-d 재검증 중간-1 — 권고 P3) ═════════════
 * `Los Angeles`·`Del Rio C`·`Con A`·`El Niño` 처럼 대문자 es 기능어 + 대문자 낱말은 스페인어 고유명사·저자명 —
 * 짧은 프랑스어 일정표·참고문헌이 es 로 가던 뿌리. `Los pacientes`·문장 첫머리 `El paciente` 는 센다. */

test('N17 ★★ 스페인어 고유명사·저자명이 든 프랑스어 9 · 영어 11 → 하나도 es 가 아니다 · 값이 8n 이전 규칙과 같다 · 이어도 그대로', () => {
  for (const [want, set] of [['fr', PROPER_FR], ['en', PROPER_EN]]) {
    for (const [name, s] of set) {
      const t = padTo200(s);
      const g = guessLang(t);
      assert.equal(g.lang, want, name + ' ' + JSON.stringify(g));
      assert.deepEqual(g, Object.assign({ script: 'latin' }, legacyLatin(t)), name);
    }
    assert.deepEqual(guessLang(set.map((x) => x[1]).join(' ')), { lang: want, score: 1, script: 'latin' });
  }
  // 8n-d 판에서 es 이던 일곱 — 대문자 es 기능어가 셋 이상 있는데(전제) 세는 것은 하나 이하
  const caps = (s) => (s.match(/\p{L}+/gu) || []).filter((w) => /^\p{Lu}/u.test(w) && ['el', 'los', 'las', 'del', 'por', 'para', 'con', 'una', 'lo'].includes(w.toLowerCase())).length;
  const was = ['f-itineraire', 'f-biblio', 'e-refs-delrio', 'e-refs-conA', 'ref-hisp2', 'ref-hisp3', 'ref-hisp6'];
  for (const [name, s] of PROPER_FR.concat(PROPER_EN).filter(([n]) => was.includes(n))) {
    assert.ok(caps(s) >= 3, '시험 전제: ' + name);
    assert.ok(functionWordRates(s).esWords < GUESS.ES_MIN_WORDS, name);
  }
});

test('N17 ★★ 문장 첫머리 대문자 es 기능어에 기대는 스페인어 5 → es · 고유명사(`Los Ángeles`·`El Niño`)가 섞여도 es', () => {
  const lowerEs = (s) => (s.match(/\p{L}+/gu) || []).filter((w) => ['el', 'los', 'las', 'del', 'por', 'para', 'con', 'una', 'lo'].includes(w)).length;
  for (const [name, s] of ES_CAPS) {
    const g = guessLang(padTo200(s));
    assert.equal(g.lang, 'es', name + ' ' + JSON.stringify(g));
    assert.ok(g.score >= LOW_SCORE, name);
  }
  // 앞 셋은 소문자 es 기능어가 하나 이하 — 대문자 꼴을 세지 않으면 es 를 잃는다(시험 전제)
  for (const [name, s] of ES_CAPS.slice(0, 3)) assert.ok(lowerEs(s) < GUESS.ES_MIN_WORDS, '시험 전제: ' + name);
  assert.deepEqual(guessLang(ES_CAPS.map((x) => x[1]).join(' ')), { lang: 'es', score: 1, script: 'latin' });
});

test('N17 ★ 경계 — 다음 낱말 소문자(셈) · 대문자(안 셈) · 없음(안 셈) · 문장 첫머리(셈) · 모두 대문자·소문자(그대로 셈)', () => {
  const w = (s) => functionWordRates(s).esWords;
  // 다음 낱말 소문자 → 셈
  assert.equal(w('Los pacientes'), 1);
  assert.equal(w('Los ángeles'), 1);
  assert.equal(w('Los «pacientes»'), 1);              // 문장부호는 건너뜀
  assert.equal(w('Con 20 mg'), 1);                     // 숫자도 건너뜀 — 다음 낱말은 mg
  // 다음 낱말 대문자 → 안 셈
  assert.equal(w('Los Angeles'), 0);
  assert.equal(w('Los Ángeles'), 0);
  assert.equal(w('Del Rio C'), 0);
  assert.equal(w('Con A'), 0);
  assert.equal(w('El Niño'), 0);
  assert.equal(w('Los 3 Reyes'), 0);
  assert.equal(w('Los 환자'), 0);                      // 대소문자 없는 글자 — 소문자로 시작하지 않는다
  // 다음 낱말 없음(글 끝) → 안 셈
  assert.equal(w('Los'), 0);
  assert.equal(w('paciente Del'), 0);
  assert.equal(w('Llegó tarde. Lo'), 0);
  // 문장 첫머리 → 다음 낱말이 소문자면 셈
  assert.equal(w('El paciente llegó.'), 1);
  assert.equal(w('Ayer vino. El paciente llegó. ¿Lo sabes?'), 2);
  // 모두 대문자·소문자는 다음 낱말과 무관하게 그대로 센다
  assert.equal(w('LOS DEL'), 2);
  assert.equal(w('LOS'), 1);
  assert.equal(w('los Angeles'), 1);
  assert.equal(w('con'), 1);
  // en·fr 셈은 글자꼴과 무관(두 갈래 비교 불변) — es 셈만 다르다
  const a = functionWordRates('Los Angeles The And Le Et La Del Rio');
  const b = functionWordRates('los angeles the and le et la del rio');
  assert.deepEqual([a.words, a.en, a.fr, a.frForEs], [b.words, b.en, b.fr, b.frForEs]);
  assert.deepEqual([a.esWords, b.esWords], [0, 2]);
});

test('N17 ★ guessLang 경계 — 대문자 es 기능어 + 대문자 낱말은 en·0(8n 이전과 같음) · 소문자 낱말이면 es·1 · 글 끝은 안 셈', () => {
  const mk = (head, tail) => { let s = head; for (let i = 0; i < 40; i++) s += ' paciente'; return s + (tail || ''); };
  for (const s of [mk('Los Angeles Del Rio'), mk('Los Angeles Del grupo'), mk('con', ' Los'), mk('Con A', ' Del')]) {
    assert.deepEqual(guessLang(s), { lang: 'en', score: 0, script: 'latin' }, s.slice(0, 24));
    assert.deepEqual(guessLang(s), Object.assign({ script: 'latin' }, legacyLatin(s)));
  }
  assert.deepEqual(guessLang(mk('Los pacientes Del grupo')), { lang: 'es', score: 1, script: 'latin' });
  assert.deepEqual(guessLang(mk('con', ' Los pacientes')), { lang: 'es', score: 1, script: 'latin' });
  assert.deepEqual(guessLang(mk('LOS DEL')), { lang: 'es', score: 1, script: 'latin' });
});
