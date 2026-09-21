/* ============================================================
   MedReader — i18n 엔진 (spec 11절)

   4개 언어를 **전부 정적 import** 한다(11-1). 언어 전환이 즉시 되고
   오프라인에서도 안전하다. 총 60KB 이내.

   ── 이 모듈이 지키는 계약 ───────────────────────────────
   1. 누락 키는 **현재 언어 → en → 키 문자열 자체** 세 단계로 떨어진다.
      **앱은 절대 죽지 않는다**(11-2). 키가 없어도 화면에 키 이름이 보일 뿐이다.
   2. 문자열 안에 HTML 이 없다. 링크는 `{link}` 자리표시자 + 별도 URL 키다.
   3. 서비스 계층(`db`·`loader`·`Extractor`)은 **코드만** 낸다(3-2).
      그 코드를 i18n 키로 바꾸는 표(`ERROR_KEYS`)가 여기 있다 —
      서비스 계층에 문자열을 되돌려 넣지 않기 위해서다.
   4. DOM 은 `setLang`/`applyTranslations` 안에서만 만진다. 그래서 이 모듈을
      Node 에서 import 해 테스트할 수 있다(`tests/i18n.test.mjs`).
   ============================================================ */

import ar from './ar.js';
import en from './en.js';
import fr from './fr.js';
import ko from './ko.js';

/** 지원 언어. 순서가 온보딩 버튼 순서다(아랍어가 주 사용자 — 11-3). */
export const LANGS = Object.freeze(['ar', 'en', 'fr', 'ko']);

/** 폴백 언어(11-2). */
export const FALLBACK_LANG = 'en';

export const BUNDLES = Object.freeze({ ar: ar, en: en, fr: fr, ko: ko });

export const RTL_LANGS = Object.freeze(['ar']);

/** 11-3 — 아랍어만 RTL. **순수 함수**(테스트가 고정한다). */
export function dirOf(lang) {
  return RTL_LANGS.indexOf(lang) >= 0 ? 'rtl' : 'ltr';
}

/**
 * 11-3 초기 언어 결정. **순수 함수** — `navigator` 를 직접 읽지 않고
 * 인자로 받는다(테스트 가능·의존 방향 준수).
 *
 * `settings.ui.lang` → `navigator.languages` 중 ar/en/fr/ko 로 시작하는 첫 항목
 * → **`ar`**(주 사용자).
 *
 * @param {string|null|undefined} saved  settings.ui.lang
 * @param {string[]} [navLangs]          navigator.languages
 * @returns {'ar'|'en'|'fr'|'ko'}
 */
export function detectLang(saved, navLangs) {
  if (typeof saved === 'string' && LANGS.indexOf(saved) >= 0) return saved;
  const list = Array.isArray(navLangs) ? navLangs : [];
  for (let i = 0; i < list.length; i++) {
    const tag = String(list[i] || '').toLowerCase();
    for (let k = 0; k < LANGS.length; k++) {
      const l = LANGS[k];
      // 'en-GB' 는 'en' 이다. 'ende' 같은 우연한 접두사는 아니다.
      if (tag === l || tag.indexOf(l + '-') === 0) return l;
    }
  }
  return 'ar';
}

/* ────────────────────────────────────────────────────────
   상태 — 모듈 하나가 현재 언어를 들고 있다.
   ──────────────────────────────────────────────────────── */
let current = 'ar';
let debug = false;
const langListeners = new Set();
// 이미 경고한 키. 같은 키로 콘솔을 도배하지 않는다(16-K 콘솔 0건과 충돌 방지).
const warned = new Set();

export function getLang() { return current; }
export function getDir() { return dirOf(current); }

/** `dev.debug` 일 때만 누락 키를 콘솔에 알린다(11-2). */
export function setDebug(on) { debug = !!on; }

/** 언어가 바뀔 때마다 부른다. 해제 함수를 돌려준다. */
export function onLangChange(fn) {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
}

/* ────────────────────────────────────────────────────────
   조회 — 11-2 의 3단계 폴백
   ──────────────────────────────────────────────────────── */

/**
 * 단일 키를 찾는다. **현재 언어 → en → null**.
 * @returns {string|null} 없으면 null (호출자가 키 자체로 떨어뜨린다)
 */
function lookup(key, lang) {
  const primary = BUNDLES[lang];
  if (primary && typeof primary[key] === 'string') return primary[key];
  const fb = BUNDLES[FALLBACK_LANG];
  if (fb && typeof fb[key] === 'string') return fb[key];
  return null;
}

/** `{name}` 치환. 값이 없는 자리표시자는 **그대로 둔다**(지워서 문장을 망치지 않는다). */
function interpolate(tpl, params) {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, name) => {
    const v = params[name];
    return v === undefined || v === null ? m : String(v);
  });
}

/**
 * 11-2 복수형. `key.one` / `key.other` 를 `Intl.PluralRules` 로 고른다.
 * 아랍어의 zero/two/few/many 도 키가 있으면 쓰고, 없으면 `other` 로 떨어진다.
 * 그래서 4개 언어가 같은 키 집합(`one`·`other`)만 갖고도 아랍어가 깨지지 않는다.
 */
function pluralKey(key, n, lang) {
  let cat = 'other';
  try {
    cat = new Intl.PluralRules(lang).select(n);
  } catch (e) {
    // Intl 이 없거나 태그가 이상하면 other 로 간다. 죽지 않는다.
  }
  const exact = lookup(key + '.' + cat, lang);
  if (exact !== null) return exact;
  return lookup(key + '.other', lang);
}

/**
 * 번역 문자열을 얻는다.
 *
 * @param {string} key      `reader.controls.play` 같은 점 표기 키
 * @param {Object} [params] `{n: 3}` — `{n}` 치환. `n` 이 숫자면 복수형도 고른다.
 * @returns {string} 절대 예외를 던지지 않는다. 최후에는 키 문자열 자체.
 */
export function t(key, params) {
  const k = String(key == null ? '' : key);
  const lang = current;

  let str = lookup(k, lang);

  // 복수형: 키 자체가 없고 params.n 이 숫자면 key.one/key.other 를 본다.
  if (str === null && params && typeof params.n === 'number') {
    str = pluralKey(k, params.n, lang);
  }

  if (str === null) {
    // 3단계: 키 문자열 자체. 앱은 죽지 않는다(11-2).
    if (debug && !warned.has(k)) {
      warned.add(k);
      console.warn('[i18n] missing key: ' + k);
    }
    return k;
  }
  return interpolate(str, params);
}

/** 키가 (어느 단계로든) 존재하는가. 테스트·진단용. */
export function hasKey(key, lang) {
  return lookup(String(key), lang || current) !== null;
}

/* ────────────────────────────────────────────────────────
   14절 — 서비스 계층의 **코드**를 i18n 키로 (3-2)
   `loader.js` 는 `ERR_PDFJS_LOAD` 를, `db.js` 는 `ERR_DB_QUOTA` 를 낸다.
   그 문자열화는 UI 의 일이고, 표는 한 곳에만 있어야 한다.
   ──────────────────────────────────────────────────────── */
export const ERROR_KEYS = Object.freeze({
  ERR_PDFJS_LOAD: 'err.pdfEngine',
  ERR_PDFJS_OFFLINE: 'err.pdfOffline',
  ERR_DB_QUOTA: 'err.quota',
  ERR_DB_BLOCKED: 'err.dbBlocked',
  ERR_DB_OPEN: 'err.dbOpen'
});

/** 오류 코드 → i18n 키. 모르는 코드는 `err.unknown` 으로 떨어진다. */
export function errorKey(code) {
  const k = ERROR_KEYS[String(code)];
  return k || 'err.unknown';
}

/* ────────────────────────────────────────────────────────
   DOM 적용 — 여기서만 document 를 만진다.
   ──────────────────────────────────────────────────────── */

/**
 * `[data-i18n]` 의 `textContent` 와 `[data-i18n-aria]` 의 `aria-label` 을 갱신한다(11-3).
 * `data-i18n-n` 이 있으면 그 숫자로 복수형·`{n}` 치환을 한다.
 * `data-i18n-attr="placeholder"` 처럼 다른 속성도 지정할 수 있다.
 */
export function applyTranslations(root) {
  if (typeof document === 'undefined') return;
  const scope = root || document;

  const nodes = scope.querySelectorAll('[data-i18n]');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const params = paramsOf(el);
    const text = t(el.getAttribute('data-i18n'), params);
    const attr = el.getAttribute('data-i18n-attr');
    // 문자열 안에 HTML 이 없으므로 textContent 로만 넣는다(13절 XSS).
    if (attr) el.setAttribute(attr, text);
    else el.textContent = text;
  }

  const arias = scope.querySelectorAll('[data-i18n-aria]');
  for (let i = 0; i < arias.length; i++) {
    const el = arias[i];
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'), paramsOf(el)));
  }
}

/** `data-i18n-n="3"` → `{n: 3}`. 그 외 매개변수는 JS 에서 직접 `t()` 를 부른다. */
function paramsOf(el) {
  const n = el.getAttribute('data-i18n-n');
  if (n === null) return undefined;
  const v = Number(n);
  return Number.isFinite(v) ? { n: v } : undefined;
}

/**
 * 11-3 — 언어를 바꾸고 문서 전체를 다시 그린다.
 * `documentElement.lang` 과 `dir` 을 세우고 모든 `[data-i18n]` 을 갱신한다.
 * 새로고침 없이 즉시 반영된다(16-H).
 *
 * @param {string} lang
 * @returns {string} 실제로 적용된 언어(지원하지 않는 값이면 폴백)
 */
export function setLang(lang) {
  const next = LANGS.indexOf(lang) >= 0 ? lang : FALLBACK_LANG;
  current = next;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = next;
    document.documentElement.dir = dirOf(next);
  }
  applyTranslations();
  for (const fn of langListeners) {
    try { fn(next); } catch (e) { /* 리스너 예외가 언어 전환을 막지 않는다 */ }
  }
  return next;
}

/* ────────────────────────────────────────────────────────
   숫자·바이트·날짜 포맷 — 언어를 따른다.
   아랍어 숫자는 브라우저 기본(서양 숫자)을 쓴다. 의학 수치와 쪽 번호가
   원서와 같은 글자로 보여야 대조가 쉽다.
   ──────────────────────────────────────────────────────── */
export function formatNumber(n) {
  try { return new Intl.NumberFormat(current).format(n); } catch (e) { return String(n); }
}

export function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  const digits = u === 0 ? 0 : (v < 10 ? 1 : 0);
  try {
    return new Intl.NumberFormat(current, {
      minimumFractionDigits: digits, maximumFractionDigits: digits
    }).format(v) + ' ' + units[u];
  } catch (e) {
    return v.toFixed(digits) + ' ' + units[u];
  }
}
