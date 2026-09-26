/* ============================================================
   MedReader — API 키 저장소 (spec 13절 · 9-3)

   ── 계층 ────────────────────────────────────────────────
   `privacy/*` 는 `config.js` 만 import 한다(3-2). 저장소는 **주입**되거나
   `globalThis` 에서 찾는다. DOM 을 모르고 문구도 모른다.

   ── 13절이 정한 것 ──────────────────────────────────────
   - 기본 `sessionStorage['medreader.key.{provider}']` (탭 닫으면 소멸)
   - `privacy.rememberKey` 가 ON 일 때만 `localStorage`
   - 별도 암호화는 하지 않는다. 저장소를 읽을 수 있는 공격자는 어차피 키를
     쓸 수 있고, 클라이언트 난독화는 안전감만 준다. 대신 **어디 저장됐는지
     사용자가 알게** 한다(`storedAt()`).
   - 표시는 `AQ.Ab…6l` 마스킹
   - **`settings` 스토어에 넣지 않는다**(9-3 명시)

   ── ★ 이름 규칙 ─────────────────────────────────────────
   원문을 돌려주는 함수는 **하나뿐이고 이름에 `Secret` 이 들어간다**
   (`readKeySecret`). 화면에 쓰는 것은 `readKeyMasked` 다. 실수로 마스킹된
   값 대신 원문을 그리는 일이 없도록, 이름이 비슷해지는 것을 금지한다.

   ── ★ 저장소가 막힌 환경 ────────────────────────────────
   프라이빗 모드·쿠키 차단·iframe 샌드박스에서는 `sessionStorage` 에 **접근만
   해도** 던진다(`getItem` 이 아니라 프로퍼티 접근에서). 모든 접근이
   try/catch 안에 있고, 실패는 "없음"으로 취급한다. 여기서 던지면 설정
   화면이 통째로 죽는다.
   ============================================================ */

import { AI } from '../config.js';

/** 저장 위치 이름. `storedAt()` 이 이 중 하나를 돌려준다. */
export const SESSION = 'session';
export const LOCAL = 'local';
export const NONE = 'none';

/** 저장 실패 사유(문구가 아니라 코드다 — 3-2). */
export const CODES = Object.freeze({
  BLOCKED: 'KEY_STORAGE_BLOCKED',
  EMPTY: 'KEY_EMPTY'
});

/** 9-3 `medreader.key.{provider}`. */
export function storageKeyName(provider) {
  return AI.KEY_STORAGE_PREFIX + String(provider || '');
}

/* ────────────────────────────────────────────────────────
   저장소 얻기 — 주입 우선, 없으면 globalThis
   ──────────────────────────────────────────────────────── */

/**
 * @param {{stores?: {session?: Object, local?: Object}}} [opts]
 * @returns {{session: Object|null, local: Object|null}}
 */
function resolve(opts) {
  const s = opts && opts.stores;
  return {
    session: s && 'session' in s ? s.session : pick('sessionStorage'),
    local: s && 'local' in s ? s.local : pick('localStorage')
  };
}

function pick(name) {
  try {
    const g = globalThis[name];
    // 존재만으로는 모자라다 — 막힌 환경에서는 여기서 던진다.
    return g && typeof g.getItem === 'function' ? g : null;
  } catch (e) {
    return null;
  }
}

function readFrom(store, name) {
  if (!store) return null;
  try {
    const v = store.getItem(name);
    return typeof v === 'string' && v !== '' ? v : null;
  } catch (e) {
    return null;
  }
}

function writeTo(store, name, value) {
  if (!store) return false;
  try {
    store.setItem(name, value);
    return true;
  } catch (e) {
    // 용량 초과(QuotaExceededError)도 여기로 온다.
    return false;
  }
}

function removeFrom(store, name) {
  if (!store) return false;
  try {
    store.removeItem(name);
    return true;
  } catch (e) {
    return false;
  }
}

/* ────────────────────────────────────────────────────────
   읽기
   ──────────────────────────────────────────────────────── */

/**
 * ★ **원문 키**를 돌려준다. 화면에 그리지 말 것 — `readKeyMasked` 를 쓴다.
 *
 * `sessionStorage` 를 먼저 본다. 둘 다 값이 있는 상태는 정상이 아니지만
 * (아래 `saveKey` 가 늘 한쪽을 지운다) 다른 탭이 방금 "기억"을 끈 경우를
 * 생각하면 **이 탭의 세션 값이 더 최신**이다.
 *
 * @returns {string|null}
 */
export function readKeySecret(provider, opts) {
  const st = resolve(opts);
  const name = storageKeyName(provider);
  return readFrom(st.session, name) || readFrom(st.local, name);
}

/** 어디에 저장돼 있는가. 설정 화면이 사용자에게 보여 줄 값(13절). */
export function storedAt(provider, opts) {
  const st = resolve(opts);
  const name = storageKeyName(provider);
  if (readFrom(st.session, name)) return SESSION;
  if (readFrom(st.local, name)) return LOCAL;
  return NONE;
}

/** 키가 있는가. 원문을 꺼내지 않고 묻는 방법. */
export function hasKey(provider, opts) {
  return storedAt(provider, opts) !== NONE;
}

/** 화면용. 원문은 절대 나가지 않는다. 없으면 `''`. */
export function readKeyMasked(provider, opts) {
  const raw = readKeySecret(provider, opts);
  return raw ? maskKey(raw) : '';
}

/* ────────────────────────────────────────────────────────
   마스킹 — 13절 `AQ.Ab…6l`
   ──────────────────────────────────────────────────────── */

/**
 * 앞 5자 + `…` + 뒤 2자.
 *
 * 짧은 값은 **통째로 가린다**. 8자짜리에 5+2 를 적용하면 한 글자만 가려져
 * 마스킹이 아니라 전시가 된다.
 */
export function maskKey(key) {
  const s = typeof key === 'string' ? key : '';
  if (s === '') return '';
  if (s.length < AI.MASK_MIN_LEN) return AI.MASK_ELLIPSIS;
  const head = s.slice(0, AI.MASK_HEAD);
  const tail = s.slice(s.length - AI.MASK_TAIL);
  return head + AI.MASK_ELLIPSIS + tail;
}

/* ────────────────────────────────────────────────────────
   쓰기
   ──────────────────────────────────────────────────────── */

/**
 * 키를 저장한다.
 *
 * ★ **저장 위치를 바꾸면 이전 위치를 반드시 비운다.** "이 기기에 기억"을
 *   끄면 `localStorage` 에서 사라져야 한다 — 끈 줄 알았는데 디스크에 남아
 *   있는 것이 이 파일에서 가장 위험한 버그다. 그래서 쓰기는 늘
 *   **[대상에 쓰기] → [반대쪽 지우기]** 두 단계다.
 *
 * @param {string} provider
 * @param {string} key 원문
 * @param {{remember?: boolean, stores?: Object}} [opts] `remember` = `privacy.rememberKey`
 * @returns {{ok: boolean, at: string, code?: string}}
 */
export function saveKey(provider, key, opts) {
  const raw = typeof key === 'string' ? key.trim() : '';
  if (raw === '') return { ok: false, at: NONE, code: CODES.EMPTY };

  const st = resolve(opts);
  const name = storageKeyName(provider);
  const remember = !!(opts && opts.remember);
  const target = remember ? st.local : st.session;
  const other = remember ? st.session : st.local;

  const wrote = writeTo(target, name, raw);
  // 대상 쓰기가 실패해도 반대쪽은 지운다. 실패했는데 옛 키가 남아 있으면
  // 사용자는 새 키를 넣었다고 믿고 앱은 옛 키를 쓴다.
  removeFrom(other, name);

  if (!wrote) return { ok: false, at: NONE, code: CODES.BLOCKED };
  return { ok: true, at: remember ? LOCAL : SESSION };
}

/**
 * "이 기기에 기억"을 켜거나 끈다. **이미 저장된 키를 옮긴다.**
 *
 * `saveKey` 를 다시 부르는 것과 같지만, 호출자가 원문을 다시 들고 있을
 * 필요가 없다 — 설정 화면(7b)은 마스킹된 값만 보여 주므로 원문이 없다.
 *
 * @returns {{ok: boolean, at: string, moved: boolean, code?: string}}
 */
export function setRemember(provider, remember, opts) {
  const raw = readKeySecret(provider, opts);
  if (raw === null) {
    // 옮길 키가 없다. 그래도 양쪽을 정리해 둔다(빈 문자열 찌꺼기 제거).
    clearKey(provider, opts);
    return { ok: true, at: NONE, moved: false };
  }
  const before = storedAt(provider, opts);
  const r = saveKey(provider, raw, { remember: !!remember, stores: opts && opts.stores });
  return { ok: r.ok, at: r.at, moved: r.ok && r.at !== before, code: r.code };
}

/** 양쪽 저장소에서 모두 지운다. 한쪽이 막혀 있어도 던지지 않는다. */
export function clearKey(provider, opts) {
  const st = resolve(opts);
  const name = storageKeyName(provider);
  const a = removeFrom(st.session, name);
  const b = removeFrom(st.local, name);
  return { ok: a || b || (!st.session && !st.local) };
}
