/* ============================================================
   tests/settings.test.mjs — spec 9-3

   `readValue` / `defaultFor` 는 순수 함수다. IndexedDB 없이 검증된다.
   (`settings.js` 는 `db.js` 를 import 하지만 `db.js` 의 최상위에는
   `indexedDB` 접근이 없으므로 Node 에서 import 자체는 안전하다.)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULTS, KEYS, readValue, defaultFor } from '../js/settings.js';

test('S-1 ★ 9-3 의 키가 전부 있다', () => {
  // spec 9-3 목록 그대로. 하나라도 빠지면 나중 단계가 키 이름을 지어낸다.
  const required = [
    'ui.lang', 'ui.theme',
    'reader.view', 'reader.fontSize', 'reader.lineHeight', 'reader.letterSpacing',
    'reader.font', 'reader.showDone', 'reader.autoScroll',
    'tts.rate', 'tts.unit', 'tts.voice.en', 'tts.voice.ar', 'tts.voice.fr', 'tts.voice.ko',
    'tts.autoSummarize', 'tts.wakeLock',
    'ai.provider', 'ai.model', 'ai.translationLang', 'ai.summaryLangs', 'ai.useOnDevice',
    'ai.dailyCap', 'ai.warnAt', 'ai.cacheLimitMB', 'ai.maxReqChars', 'ai.proxyUrl',
    'privacy.consentedAt', 'privacy.piiCheck', 'privacy.rememberKey',
    'onboarding.done', 'dev.debug'
  ];
  for (const k of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(DEFAULTS, k), '9-3 의 키가 없다: ' + k);
  }
  assert.deepEqual(KEYS.slice().sort(), Object.keys(DEFAULTS).sort());
});

test('S-2 ★ API 키는 settings 에 없다 (13절)', () => {
  for (const k of KEYS) {
    assert.ok(!/key$/i.test(k) || k === 'privacy.rememberKey',
      'API 키로 보이는 설정 키가 있다: ' + k);
  }
  assert.ok(!Object.prototype.hasOwnProperty.call(DEFAULTS, 'ai.apiKey'));
});

test('S-3 기본값 폴백 — 저장값이 없으면 기본값', () => {
  const empty = new Map();
  assert.equal(readValue(empty, 'ui.theme'), 'system');
  assert.equal(readValue(empty, 'reader.fontSize'), 22);
  assert.equal(readValue(empty, 'onboarding.done'), false);
  assert.equal(readValue(empty, 'tts.autoSummarize'), false);
  assert.equal(readValue(empty, 'ai.dailyCap'), 100);
  // 평범한 객체로도 읽힌다
  assert.equal(readValue({}, 'ui.theme'), 'system');
});

test('S-4 저장값이 있으면 그것이 이긴다 — false·0·빈 문자열도', () => {
  const m = new Map([
    ['ui.theme', 'dark'],
    ['reader.showDone', false],   // falsy 지만 저장된 값이다
    ['reader.letterSpacing', 0],
    ['ai.model', ''],
    ['ai.dailyCap', 3]
  ]);
  assert.equal(readValue(m, 'ui.theme'), 'dark');
  assert.equal(readValue(m, 'reader.showDone'), false);
  assert.equal(readValue(m, 'reader.letterSpacing'), 0);
  assert.equal(readValue(m, 'ai.model'), '');
  assert.equal(readValue(m, 'ai.dailyCap'), 3);
});

test('S-5 ★ null 은 유효한 저장값이다 (undefined 만 비어 있음)', () => {
  // ui.lang 의 null 은 "아직 고르지 않았다"이고 기본값도 null 이다.
  // privacy.consentedAt 의 null 도 마찬가지 의미를 갖는다.
  const m = new Map([['privacy.consentedAt', null]]);
  assert.equal(readValue(m, 'privacy.consentedAt'), null);
  const u = new Map([['ui.theme', undefined]]);
  assert.equal(readValue(u, 'ui.theme'), 'system', 'undefined 는 기본값으로 떨어진다');
});

test('S-6 9-3 밖의 키는 undefined — 조용히 만들어 내지 않는다', () => {
  assert.equal(readValue(new Map(), 'not.a.real.key'), undefined);
  assert.equal(defaultFor('not.a.real.key'), undefined);
});

test('S-7 배열 기본값은 사본이다 — 호출자가 고쳐도 DEFAULTS 가 상하지 않는다', () => {
  const a = defaultFor('ai.summaryLangs');
  assert.deepEqual(a, ['ar', 'en']);
  a.push('fr');
  assert.deepEqual(defaultFor('ai.summaryLangs'), ['ar', 'en']);
});

test('S-8 DEFAULTS 는 얼어 있다', () => {
  assert.ok(Object.isFrozen(DEFAULTS));
  assert.ok(Object.isFrozen(KEYS));
});

test('S-9 이 단계가 실제로 쓰는 세 키의 기본값', () => {
  // 3단계가 읽고 쓰는 것은 이 셋뿐이다.
  assert.equal(defaultFor('ui.lang'), null, 'null 이어야 i18n.detectLang 이 판단한다');
  assert.equal(defaultFor('privacy.consentedAt'), null);
  assert.equal(defaultFor('onboarding.done'), false);
});
