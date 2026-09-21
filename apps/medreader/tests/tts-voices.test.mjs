/* ============================================================
   tests/tts-voices.test.mjs — spec 6-3 · 6-4

   ★ 이 파일이 막는 것: **`en_US` 언더스코어 때문에 멀쩡한 기기에서
     "영어 음성 없음" 배너가 뜨는 일.** Android 가 그 형태로 준다(6-3).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeVoiceLang, voiceMatches, pickVoice, availability, loadVoices
} from '../js/tts/voices.js';

function v(name, lang, extra) {
  return Object.assign({ name: name, lang: lang, voiceURI: name, localService: false }, extra || {});
}

test('V1 ★ Android 의 en_US 를 en 으로 알아본다 (6-3)', () => {
  assert.equal(normalizeVoiceLang('en_US'), 'en-us');
  assert.ok(voiceMatches(v('A', 'en_US'), 'en'));
  assert.ok(voiceMatches(v('B', 'en-GB'), 'en'));
  assert.ok(voiceMatches(v('C', 'EN'), 'en'));
});

test('V2 비슷해 보이는 태그에 속지 않는다', () => {
  assert.equal(voiceMatches(v('X', 'enx-ZZ'), 'en'), false);
  assert.equal(voiceMatches(v('X', ''), 'en'), false);
  assert.equal(voiceMatches(null, 'en'), false);
});

test('V3 ★ 우선순위 — preferredURI > localService > Google > 첫 번째 (6-3)', () => {
  const list = [
    v('First', 'en-US'),
    v('Google US English', 'en-US'),
    v('Local One', 'en_US', { localService: true }),
    v('Chosen', 'en-GB', { voiceURI: 'urn:chosen' })
  ];
  assert.equal(pickVoice('en', list, 'urn:chosen').name, 'Chosen');
  assert.equal(pickVoice('en', list).name, 'Local One');
  assert.equal(pickVoice('en', list.filter((x) => !x.localService)).name, 'Google US English');
  assert.equal(pickVoice('en', [v('Only', 'en-US')]).name, 'Only');
});

test('V4 없으면 null — 배너의 근거가 된다', () => {
  assert.equal(pickVoice('en', [v('Arabe', 'ar-SA')]), null);
  assert.equal(pickVoice('en', []), null);
  assert.equal(pickVoice('en', null), null);
});

test('V5 preferredURI 가 다른 언어를 가리키면 무시된다 (언어가 먼저다)', () => {
  const list = [v('Ar', 'ar-SA', { voiceURI: 'urn:ar' }), v('En', 'en-US')];
  assert.equal(pickVoice('en', list, 'urn:ar').name, 'En');
});

test('V6 언어별 가용성 {en, ar, fr, ko}', () => {
  const have = availability([v('En', 'en_US'), v('Ko', 'ko-KR')]);
  assert.equal(have.en, true);
  assert.equal(have.ko, true);
  assert.equal(have.ar, false);
  assert.equal(have.fr, false);
});

test('V7 ★ getVoices() 가 비면 voiceschanged 를 기다린다 (6-4)', async () => {
  let listener = null;
  let ready = false;
  const synth = {
    getVoices: () => (ready ? [v('Late', 'en-US')] : []),
    addEventListener: (type, fn) => { if (type === 'voiceschanged') listener = fn; },
    removeEventListener: () => { listener = null; }
  };
  const p = loadVoices(synth, 1000);
  setTimeout(() => { ready = true; listener(); }, 10);
  const got = await p;
  assert.equal(got.length, 1);
  assert.equal(got[0].name, 'Late');
});

test('V8 ★ 이벤트가 영영 안 와도 타임아웃으로 끝난다 — 앱이 멈추지 않는다', async () => {
  const synth = {
    getVoices: () => [],
    addEventListener: () => { },
    removeEventListener: () => { }
  };
  const got = await loadVoices(synth, 20);
  assert.deepEqual(got, []);
});

test('V9 speechSynthesis 가 아예 없으면 빈 배열 (죽지 않는다)', async () => {
  assert.deepEqual(await loadVoices(null), []);
  assert.deepEqual(await loadVoices({}), []);
});

test('V10 getVoices() 가 던져도 죽지 않는다', async () => {
  const synth = { getVoices: () => { throw new Error('boom'); }, addEventListener: () => { } };
  assert.deepEqual(await loadVoices(synth, 10), []);
});
