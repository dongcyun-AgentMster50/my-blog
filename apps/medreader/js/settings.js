/* ============================================================
   MedReader — settings 스토어 래퍼 (spec 9-3)

   서비스 계층이다. `db.js` 와 `config.js` 만 안다. DOM 을 모른다.

   `settings` 스토어는 `{key, value}` 한 행에 한 키다(9-2). 앱 시작 때
   한 번에 읽어 메모리 맵에 들고, 쓰기는 **즉시 저장**한다.

   ── 이 단계에서 실제로 쓰는 키는 셋뿐이다 ─────────────
   `ui.lang`, `privacy.consentedAt`, `onboarding.done`.
   나머지는 **기본값만 정의**한다(화면은 4~9단계가 만든다). 기본값을
   지금 전부 적어 두는 이유는, 나중 단계가 키 이름을 새로 지어내지
   않고 9-3 의 목록을 그대로 쓰게 하기 위해서다.

   ★ API 키는 여기 저장하지 않는다(13절 — sessionStorage/localStorage).
   ============================================================ */

import * as db from './db.js';

const STORE = 'settings';

/**
 * spec 9-3 의 키 목록 그대로. 순서도 9-3 을 따른다.
 * 값은 **기본값**이며, 저장된 값이 없을 때 `get()` 이 돌려준다.
 */
export const DEFAULTS = Object.freeze({
  /* 표시 */
  'ui.lang': null,              // null = 아직 고르지 않음 → i18n.detectLang 이 정한다(11-3)
  'ui.theme': 'system',

  /* 리더 (4단계) */
  'reader.view': 'reflow',
  'reader.fontSize': 22,        // 12-3 기본 22px — B1 학습자·눈 피로
  'reader.lineHeight': 1.7,
  'reader.letterSpacing': 0,
  'reader.font': 'system',
  'reader.showDone': true,
  'reader.autoScroll': true,

  /* 낭독 (5단계) */
  'tts.rate': 1.0,
  // spec 6-1 [수정 2026-09-21] 기본은 **문장**이다. 초판은 'line' 이었는데,
  // 실기기에서 실제 원서를 읽어 본 사용자 판단으로 뒤집혔다 — 2단 조판이라
  // 원본 줄이 8~10단어로 짧아 줄 단위로 읽으면 다시 거꾸로 읽게 된다.
  'tts.unit': 'sentence',
  'tts.voice.en': '',
  'tts.voice.ar': '',
  'tts.voice.fr': '',
  'tts.voice.ko': '',
  'tts.autoSummarize': false,   // 9-3 — 기본 false. 자동 호출 금지(18절)
  'tts.wakeLock': true,

  /* AI (7·8단계) */
  'ai.provider': 'gemini',
  'ai.model': '',
  'ai.translationLang': 'ar',
  'ai.summaryLangs': ['ar', 'en'],
  'ai.useOnDevice': true,
  'ai.dailyCap': 100,
  'ai.warnAt': 0.8,
  'ai.cacheLimitMB': 50,
  'ai.maxReqChars': 6000,
  'ai.proxyUrl': '',

  /* 프라이버시 (13절) */
  'privacy.consentedAt': null,  // ISO 문자열. 12-2 동의 시 기록된다.
  'privacy.piiCheck': true,
  'privacy.rememberKey': false,

  /* 그 밖 */
  'onboarding.done': false,
  'dev.debug': false
});

export const KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * 저장된 값 맵에서 한 키를 읽는다. **순수 함수** — 테스트가 이것을 고정한다.
 * 저장값이 없거나(`undefined`) 맵에 키가 없으면 기본값으로 떨어진다.
 *
 * `null` 은 **유효한 저장값**이다(`ui.lang: null` 은 "아직 안 골랐다"를 뜻하고
 * `privacy.consentedAt: null` 도 마찬가지다). 그래서 `undefined` 만 비어 있음으로 본다.
 *
 * @param {Object|Map} map 저장된 값들
 * @param {string} key
 */
export function readValue(map, key) {
  const has = map instanceof Map ? map.has(key) : (map && Object.prototype.hasOwnProperty.call(map, key));
  if (has) {
    const v = map instanceof Map ? map.get(key) : map[key];
    if (v !== undefined) return v;
  }
  return defaultFor(key);
}

/** 기본값. 모르는 키는 `undefined`(9-3 밖의 키를 조용히 만들어 내지 않는다). */
export function defaultFor(key) {
  const v = DEFAULTS[key];
  // 배열·객체 기본값은 사본을 준다 — 호출자가 고쳐도 DEFAULTS 가 상하지 않는다.
  return Array.isArray(v) ? v.slice() : v;
}

/* ────────────────────────────────────────────────────────
   메모리 캐시 + IndexedDB
   ──────────────────────────────────────────────────────── */
let cache = null;   // Map<key, value> — load() 전에는 null

/** 저장된 전부를 한 번에 읽는다. 앱 시작에 한 번 부른다. */
export async function load() {
  const m = new Map();
  await db.iterate(STORE, {}, (row) => {
    if (row && typeof row.key === 'string') m.set(row.key, row.value);
  });
  cache = m;
  return m;
}

/** 캐시가 없으면 기본값으로만 답한다 — `load()` 전에 불려도 죽지 않는다. */
export function get(key) {
  return readValue(cache || new Map(), key);
}

/** 여러 키를 한 번에. */
export function getAll(keys) {
  const out = {};
  const list = keys || KEYS;
  for (let i = 0; i < list.length; i++) out[list[i]] = get(list[i]);
  return out;
}

/**
 * 즉시 저장한다. 캐시를 먼저 갱신하므로 저장이 늦어도 화면은 바로 따라온다.
 * @returns {Promise<void>}
 */
export async function set(key, value) {
  if (!cache) cache = new Map();
  cache.set(key, value);
  await db.put(STORE, { key: key, value: value });
}

/** 저장값을 지우고 기본값으로 되돌린다. */
export async function reset(key) {
  if (cache) cache.delete(key);
  await db.del(STORE, key);
}

/** 테스트·개발용 — 캐시를 주입한다(DB 를 건드리지 않는다). */
export function _setCacheForTest(map) {
  cache = map instanceof Map ? map : new Map(Object.entries(map || {}));
}
