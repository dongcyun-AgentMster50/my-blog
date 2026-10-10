/* ============================================================
   tests/ondevice-8a.test.mjs — spec 7-4 기기 내 AI 감지와 폴백 (스텁)

   16-D2 `[D]` "온디바이스 Translator 가 있는 Chrome 에서 탭 번역이 네트워크 없이" 는
   **탭 화면이 있는 8c 몫**이다. 8a 는 감지·폴백 로직을 스텁 전역으로 고정한다.
   - 실패는 언제나 `null`(예외가 위로 가지 않는다)
   - `available` 일 때만 번역한다(자동 다운로드 금지)
   - 원문 언어는 인자다('en' 을 박지 않는다)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { detect, translate } from '../js/ai/ondevice.js';

function scopeWith(availability, opts) {
  const o = opts || {};
  const log = { created: [], destroyed: 0, asked: [] };
  const Translator = {
    availability: async (a) => { log.asked.push(a); if (o.availThrows) throw new Error('boom'); return availability; },
    create: async (a) => {
      log.created.push(a);
      if (o.createThrows) throw new Error('no model');
      return {
        translate: async (s) => { if (o.translateThrows) throw new Error('fail'); return o.nonString ? 42 : '[' + a.targetLanguage + '] ' + s; },
        destroy: () => { log.destroyed++; }
      };
    }
  };
  return { scope: { Translator: Translator }, log: log };
}

test('D1 기능 감지 — 없으면 전부 false, 있으면 true (던지지 않는다)', () => {
  assert.deepEqual(detect({}), { translator: false, summarizer: false, detector: false });
  assert.deepEqual(detect({ Translator: { availability() {} }, Summarizer: { availability() {} }, LanguageDetector: {} }),
    { translator: true, summarizer: true, detector: true });
  assert.equal(detect({ Translator: {} }).translator, false, 'availability 함수가 없으면 없는 것');
  const hostile = {};
  Object.defineProperty(hostile, 'Translator', { get() { throw new Error('nope'); } });
  assert.doesNotThrow(() => detect(hostile));
  assert.equal(detect(hostile).translator, false);
});

test('D2 ★ available 이면 순차 번역 · 원문 언어는 인자 그대로 · 끝나면 destroy', async () => {
  const { scope, log } = scopeWith('available');
  const out = await translate(['Fever.', 'Rash.'], 'fr', 'ko', scope);
  assert.deepEqual(out, ['[ko] Fever.', '[ko] Rash.']);
  assert.deepEqual(log.created, [{ sourceLanguage: 'fr', targetLanguage: 'ko' }]);
  assert.equal(log.destroyed, 1);
});

test('D3 ★ downloadable·downloading·unavailable → null (자동 다운로드 금지 — create 를 부르지 않는다)', async () => {
  for (const a of ['downloadable', 'downloading', 'unavailable', 'weird']) {
    const { scope, log } = scopeWith(a);
    assert.equal(await translate(['x'], 'en', 'ar', scope), null, a);
    assert.equal(log.created.length, 0, a);
  }
});

test('D4 ★ 어디서 실패하든 null — 예외가 위로 가지 않는다', async () => {
  for (const opts of [{ availThrows: true }, { createThrows: true }, { translateThrows: true }, { nonString: true }]) {
    const { scope } = scopeWith('available', opts);
    assert.equal(await translate(['x'], 'en', 'ar', scope), null, JSON.stringify(opts));
  }
  assert.equal(await translate(['x'], 'en', 'ar', {}), null, 'Translator 없음');
});

test('D5 입력이 비었거나 언어가 비었거나 같으면 null(감지조차 하지 않는다)', async () => {
  const { scope, log } = scopeWith('available');
  assert.equal(await translate([], 'en', 'ar', scope), null);
  assert.equal(await translate(null, 'en', 'ar', scope), null);
  assert.equal(await translate(['x'], '', 'ar', scope), null);
  assert.equal(await translate(['x'], undefined, 'ar', scope), null, '원문 언어 기본값(en)이 없다');
  assert.equal(await translate(['x'], 'ar', 'ar', scope), null);
  assert.equal(log.asked.length, 0);
});

test('D6 소스 — 원문 언어를 박지 않는다 · console 0 · 화면 문구 없음', () => {
  const src = readFileSync(new URL('../js/ai/ondevice.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/'en'/.test(src));
  assert.ok(!/console\s*\./.test(src));
  assert.ok(!/from '\.\.\/(ui|i18n)\//.test(src));
});
