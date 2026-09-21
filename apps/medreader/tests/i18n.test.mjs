/* ============================================================
   tests/i18n.test.mjs — spec 11-2 가 Review 항목으로 지정한 테스트

   ★ 핵심은 I1 이다: **4개 언어의 키 집합이 정확히 같은가.**
     키가 한쪽에만 있으면 그 언어 사용자는 영어를 보거나(폴백) 키 문자열을
     본다. 번역이 늦는 것과 키가 빠지는 것은 다른 문제이고, 후자만 버그다.

   i18n/index.js 는 DOM 을 함수 안에서만 만지므로 Node 에서 import 된다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LANGS, BUNDLES, FALLBACK_LANG, dirOf, detectLang,
  t, setLang, getLang, hasKey, errorKey, ERROR_KEYS, formatBytes
} from '../js/i18n/index.js';

test('I1 ★ 4개 언어의 키 집합이 정확히 같다 (11-2 · 16-H)', () => {
  const base = Object.keys(BUNDLES[FALLBACK_LANG]).sort();
  assert.ok(base.length > 40, '키가 너무 적다 — 정본이 비었는가');

  for (const lang of LANGS) {
    const keys = Object.keys(BUNDLES[lang]).sort();
    const missing = base.filter((k) => keys.indexOf(k) < 0);
    const extra = keys.filter((k) => base.indexOf(k) < 0);
    assert.deepEqual(missing, [], lang + ' 에 없는 키: ' + missing.join(', '));
    assert.deepEqual(extra, [], lang + ' 에만 있는 키: ' + extra.join(', '));
  }
});

test('I2 모든 값이 문자열이고 비어 있지 않다', () => {
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(BUNDLES[lang])) {
      assert.equal(typeof v, 'string', lang + '.' + k + ' 가 문자열이 아니다');
      assert.ok(v.length > 0, lang + '.' + k + ' 가 비었다');
    }
  }
});

test('I3 ★ 문자열 안에 HTML 이 없다 (11-2)', () => {
  // 링크는 {link} 자리표시자 + 별도 URL 키로 나눈다.
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(BUNDLES[lang])) {
      assert.ok(!/<[a-zA-Z/!]/.test(v), lang + '.' + k + ' 에 태그가 들어 있다: ' + v);
      assert.ok(!/&[a-z]+;/.test(v), lang + '.' + k + ' 에 HTML 엔티티가 있다: ' + v);
    }
  }
});

test('I4 {자리표시자} 집합이 언어마다 같다', () => {
  const ph = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
  const base = BUNDLES[FALLBACK_LANG];
  for (const lang of LANGS) {
    for (const k of Object.keys(base)) {
      // 아랍어의 'library.card.pages.one' 처럼 단수형에서 {n} 을 빼는 것은
      // 정상이다("صفحة واحدة"). 단수형 키만 예외로 둔다.
      if (k.endsWith('.one')) continue;
      assert.equal(ph(BUNDLES[lang][k]), ph(base[k]),
        lang + '.' + k + ' 의 자리표시자가 en 과 다르다');
    }
  }
});

test('I5 ★ 누락 키 폴백 3단계 — 현재 언어 → en → 키 자체 (11-2)', () => {
  // 1단계: 현재 언어에 있다
  setLang('ar');
  assert.equal(t('nav.library'), BUNDLES.ar['nav.library']);

  // 2단계: 현재 언어에 없고 en 에 있다 — 임시로 ar 에서 하나를 뺀다
  const key = 'nav.library';
  const saved = BUNDLES.ar[key];
  delete BUNDLES.ar[key];
  assert.equal(t(key), BUNDLES.en[key], 'en 으로 떨어져야 한다');
  BUNDLES.ar[key] = saved;

  // 3단계: 어디에도 없다 → 키 문자열 자체. **던지지 않는다.**
  assert.equal(t('this.key.does.not.exist'), 'this.key.does.not.exist');
  assert.doesNotThrow(() => t(null));
  assert.doesNotThrow(() => t(undefined));
  assert.doesNotThrow(() => t(''));
});

test('I6 {name} 치환 — 값이 없으면 자리표시자를 그대로 둔다', () => {
  setLang('en');
  assert.equal(t('onboarding.progress', { step: 2, total: 3 }), 'Step 2 of 3');
  // 값을 안 주면 문장을 망가뜨리지 않고 그대로 둔다
  assert.equal(t('onboarding.progress', {}), 'Step {step} of {total}');
});

test('I7 복수형 — Intl.PluralRules 로 one/other 를 고른다 (11-2)', () => {
  setLang('en');
  assert.equal(t('library.card.pages', { n: 1 }), '1 page');
  assert.equal(t('library.card.pages', { n: 7000 }), '7000 pages');

  // 아랍어는 zero/two/few/many 범주가 더 있지만 키가 one/other 뿐이다.
  // 없는 범주는 other 로 떨어진다 — 그래서 키 집합이 같아도 깨지지 않는다.
  setLang('ar');
  assert.doesNotThrow(() => t('library.card.pages', { n: 0 }));
  assert.doesNotThrow(() => t('library.card.pages', { n: 2 }));
  assert.doesNotThrow(() => t('library.card.pages', { n: 11 }));
  assert.ok(t('library.card.pages', { n: 7000 }).includes('7000'));
  assert.equal(t('library.card.pages', { n: 1 }), BUNDLES.ar['library.card.pages.one']);
});

test('I8 11-3 초기 언어 — 저장값 → navigator.languages → ar', () => {
  assert.equal(detectLang('ko', ['en-US']), 'ko', '저장값이 가장 세다');
  assert.equal(detectLang(null, ['fr-CA', 'en']), 'fr');
  assert.equal(detectLang(null, ['en-GB']), 'en');
  assert.equal(detectLang(null, ['ar-SY', 'en']), 'ar');
  // 지원하지 않는 언어뿐이면 ar (주 사용자)
  assert.equal(detectLang(null, ['de-DE', 'ja']), 'ar');
  assert.equal(detectLang(null, []), 'ar');
  assert.equal(detectLang(null, undefined), 'ar');
  // 'ende' 는 'en' 이 아니다
  assert.equal(detectLang(null, ['ende']), 'ar');
  // 저장값이 지원 밖이면 무시한다
  assert.equal(detectLang('de', ['fr']), 'fr');
});

test('I9 11-3 dir — 아랍어만 rtl', () => {
  assert.equal(dirOf('ar'), 'rtl');
  assert.equal(dirOf('en'), 'ltr');
  assert.equal(dirOf('fr'), 'ltr');
  assert.equal(dirOf('ko'), 'ltr');
  assert.equal(dirOf('zz'), 'ltr');
});

test('I10 setLang 은 지원 밖 값을 폴백으로 바꾼다 — 앱은 죽지 않는다', () => {
  assert.equal(setLang('zz'), FALLBACK_LANG);
  assert.equal(getLang(), FALLBACK_LANG);
  assert.equal(setLang('ko'), 'ko');
  assert.equal(getLang(), 'ko');
});

test('I11 ★ 14절 오류 코드 → i18n 키 (3-2: 서비스는 코드만 낸다)', () => {
  // loader.js·db.js 가 실제로 내는 코드다. 표에서 빠지면 err.unknown 이 뜬다.
  assert.equal(errorKey('ERR_PDFJS_LOAD'), 'err.pdfEngine');
  assert.equal(errorKey('ERR_PDFJS_OFFLINE'), 'err.pdfOffline');
  assert.equal(errorKey('ERR_DB_QUOTA'), 'err.quota');
  assert.equal(errorKey('ERR_DB_BLOCKED'), 'err.dbBlocked');
  assert.equal(errorKey('ERR_DB_OPEN'), 'err.dbOpen');
  assert.equal(errorKey('ERR_SOMETHING_NEW'), 'err.unknown');
  assert.equal(errorKey(undefined), 'err.unknown');

  // 표의 모든 키가 실제로 번역돼 있어야 한다(4개 언어 전부).
  for (const key of Object.values(ERROR_KEYS)) {
    for (const lang of LANGS) {
      assert.ok(typeof BUNDLES[lang][key] === 'string', lang + ' 에 ' + key + ' 가 없다');
    }
  }
  assert.ok(hasKey('err.unknown'));
});

test('I12 formatBytes 는 어떤 입력에도 던지지 않는다', () => {
  setLang('en');
  assert.equal(formatBytes(null), '—');
  assert.equal(formatBytes(undefined), '—');
  assert.equal(formatBytes(NaN), '—');
  assert.equal(formatBytes(0), '0 B');
  assert.ok(formatBytes(22.7 * 1024 * 1024).endsWith('MB'));
  assert.ok(formatBytes(64 * 1024 * 1024).includes('64'));
});

test('I13 fr·ko 는 아직 번역 전이다 — 키만 있으면 된다 (19절 3번)', () => {
  // 이 테스트는 "번역이 안 됐다"를 실패로 삼지 않는다. 그건 10단계 몫이다.
  // 다만 **키가 빠지는 것**은 I1 이 막는다. 여기서는 언어 이름만 확인한다 —
  // 자국어 표기는 어느 파일에서도 같아야 한다(12-2).
  for (const lang of LANGS) {
    assert.equal(BUNDLES[lang]['onboarding.lang.ar'], 'العربية');
    assert.equal(BUNDLES[lang]['onboarding.lang.en'], 'English');
    assert.equal(BUNDLES[lang]['onboarding.lang.fr'], 'Français');
    assert.equal(BUNDLES[lang]['onboarding.lang.ko'], '한국어');
  }
});

test('I14 ar 은 실제로 번역돼 있다 (en 값의 복사가 아니다)', () => {
  // 언어 이름·URL·{size} 처럼 번역할 것이 없는 키는 제외한다.
  const skip = new Set([
    'app.name', 'onboarding.lang.ar', 'onboarding.lang.en',
    'onboarding.lang.fr', 'onboarding.lang.ko',
    'about.openSource.url'
  ]);
  let same = 0;
  for (const k of Object.keys(BUNDLES.en)) {
    if (skip.has(k)) continue;
    if (BUNDLES.ar[k] === BUNDLES.en[k]) same++;
  }
  assert.equal(same, 0, 'ar 에 영어가 그대로 남은 키가 ' + same + '개 있다');
});
