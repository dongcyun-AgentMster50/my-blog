/* ============================================================
   MedReader — 키 지우개 (spec 13절)

   ── 순수 계층이다(3-2) ──────────────────────────────────
   `config.js` 만 import 한다. DOM·fetch·저장소를 모른다.

   ── 이 파일의 존재 이유 ─────────────────────────────────
   13절: "모든 `console.*`·에러 토스트·에러 리포트 문자열을 `keyPattern` 들과
   `Bearer \S+` 로 `[KEY]` 치환." `provider.js` 는 예외를 **그대로 던지지 않고**
   여기를 통과시킨 뒤 던진다.

   ── 설계에서 중요한 세 가지 ─────────────────────────────

   1. **문자열만 받지 않는다.** 오류 객체를 통째로 넘겨도 안전해야 한다
      (`redact(err)` 가 `{name, message, stack}` 을 전부 지운 사본을 낸다).
      호출자가 "이건 문자열이었나?"를 고민하는 순간 언젠가 빠뜨린다.

   2. **순환 참조에서 죽지 않는다.** 오류 객체는 `cause` 나 `response` 로
      자기 자신을 되가리키는 일이 흔하다. 여기서 스택이 터지면 그 예외가
      다시 밖으로 나가는데, 그 예외에는 아무도 `redact` 를 걸어 주지 않는다.

   3. **패턴만 믿지 않는다.** `keys` 옵션으로 **실제 키 문자열**을 받아
      그것도 통째로 지운다. 8-4 가 이미 말한 대로 키 형식은 또 바뀔 수 있고,
      그때 패턴은 조용히 빗나간다. 패턴이 빗나가도 이 두 번째 그물에 걸린다.
   ============================================================ */

import { REDACT_PATTERNS, AI } from '../config.js';

/** 치환 문자열. 13절이 정한 값. */
export const REDACTION = '[KEY]';

/** 순환·거대 구조에서 멈추는 지점. 오류 객체가 이보다 깊을 일은 없다. */
const MAX_DEPTH = 8;
/** 배열 한 개에서 훑는 최대 원소 수. 나머지는 개수만 남긴다. */
const MAX_ITEMS = 200;

/** 정규식 메타문자를 막는다 — 키에 `.` 이나 `-` 가 들어 있다(`AQ.Ab…`). */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * 이 호출에서 쓸 정규식들을 **새로** 만든다.
 *
 * ★ 캐시하지 않는다. `g` 플래그가 붙은 정규식은 `lastIndex` 를 들고 다녀서
 *   같은 객체를 재사용하면 두 번째 문자열의 앞부분을 조용히 건너뛴다.
 *   이 함수에서 아끼는 몇 마이크로초보다 "가끔 키가 안 지워진다"가 훨씬 비싸다.
 */
function buildPatterns(extraKeys) {
  const out = [];
  for (let i = 0; i < REDACT_PATTERNS.length; i++) {
    out.push(new RegExp(REDACT_PATTERNS[i], 'g'));
  }
  if (extraKeys) {
    for (let i = 0; i < extraKeys.length; i++) {
      const k = extraKeys[i];
      // 짧은 문자열을 통째로 지우면 본문이 말살된다("a" 를 키라고 넘긴 경우).
      // 키라고 부를 수 있는 최소 길이 아래는 패턴에만 맡긴다.
      if (typeof k === 'string' && k.length >= AI.MASK_MIN_LEN) {
        out.push(new RegExp(escapeRe(k), 'g'));
      }
    }
  }
  return out;
}

/**
 * 문자열 하나를 지운다.
 *
 * 문장 가운데·URL 쿼리·JSON 문자열 안·여러 개가 섞인 경우를 모두 같은
 * 방식으로 처리한다 — 위치를 보지 않고 **나타나는 곳마다** 지우기 때문이다.
 *
 * @param {string} s
 * @param {RegExp[]} pats `buildPatterns()` 가 만든 것
 */
function scrub(s, pats) {
  let out = s;
  for (let i = 0; i < pats.length; i++) {
    out = out.replace(pats[i], REDACTION);
  }
  return out;
}

/**
 * 문자열 전용 입구. `console.*` 직전이나 토스트 직전처럼 이미 문자열인 곳에서 쓴다.
 *
 * @param {*} s 문자열이 아니면 `String(s)` 로 바꾼 뒤 지운다.
 * @param {{keys?: string[]}} [opts] `keys` 는 **실제 키 문자열** 목록(패턴 보완용)
 * @returns {string}
 */
export function redactString(s, opts) {
  const pats = buildPatterns(opts && opts.keys);
  let str;
  try {
    str = typeof s === 'string' ? s : String(s);
  } catch (e) {
    // `String(x)` 조차 던지는 값이 있다(toString 을 던지게 만든 객체, 심볼).
    return '[unprintable]';
  }
  return scrub(str, pats);
}

/**
 * 무엇이든 받아 **키가 지워진 사본**을 돌려준다.
 *
 * - 문자열 → 지워진 문자열
 * - `Error` → `{name, message, stack}` (셋 다 지움. `cause` 는 한 단계만 따라간다)
 * - 배열·평범한 객체 → 같은 모양의 사본 (**키 이름도 지운다**)
 * - 그 밖(숫자·불리언·null) → 그대로
 * - 순환 참조 → `'[Circular]'`
 *
 * @param {*} value
 * @param {{keys?: string[]}} [opts]
 */
export function redact(value, opts) {
  const pats = buildPatterns(opts && opts.keys);
  // `Set` 이 아니라 배열을 쓴다 — 깊이가 8 이하라 선형 탐색이 더 싸고,
  // "지금 내려온 경로"만 보므로 형제 노드가 같은 객체여도 `[Circular]` 이 아니다.
  return walk(value, pats, 0, []);
}

function walk(v, pats, depth, path) {
  if (v === null || v === undefined) return v;

  const t = typeof v;
  if (t === 'string') return scrub(v, pats);
  if (t === 'number' || t === 'boolean') return v;
  if (t === 'bigint') return String(v);
  if (t === 'symbol') return scrub(String(v.description || ''), pats);
  if (t === 'function') return '[Function]';

  // 여기부터 객체. 먼저 순환을 본다.
  for (let i = 0; i < path.length; i++) {
    if (path[i] === v) return '[Circular]';
  }
  if (depth >= MAX_DEPTH) return '[Depth]';

  const next = path.concat([v]);

  if (v instanceof Error) {
    const out = {
      name: scrub(safeStr(v.name), pats),
      message: scrub(safeStr(v.message), pats),
      // 스택에는 URL 이 그대로 박힌다. 키를 쿼리에 넣지 않는 것이 1차 방어이고,
      // 여기가 2차다.
      stack: scrub(safeStr(v.stack), pats)
    };
    // `cause` 는 fetch 계열이 자주 채운다. 깊이 제한 안에서만 따라간다.
    if (v.cause !== undefined) out.cause = walk(v.cause, pats, depth + 1, next);
    // 우리 `ProviderError` 처럼 코드를 달고 다니는 오류를 잃지 않는다.
    if (v.code !== undefined) out.code = walk(v.code, pats, depth + 1, next);
    if (v.status !== undefined) out.status = walk(v.status, pats, depth + 1, next);
    return out;
  }

  if (Array.isArray(v)) {
    const n = Math.min(v.length, MAX_ITEMS);
    const out = [];
    for (let i = 0; i < n; i++) out.push(walk(v[i], pats, depth + 1, next));
    if (v.length > n) out.push('[+' + (v.length - n) + ']');
    return out;
  }

  if (v instanceof Map) {
    const out = {};
    let i = 0;
    for (const [k, val] of v) {
      if (i++ >= MAX_ITEMS) break;
      out[scrub(safeStr(k), pats)] = walk(val, pats, depth + 1, next);
    }
    return out;
  }

  if (v instanceof Set) {
    const out = [];
    let i = 0;
    for (const val of v) {
      if (i++ >= MAX_ITEMS) break;
      out.push(walk(val, pats, depth + 1, next));
    }
    return out;
  }

  // Headers·Response 처럼 우리가 모르는 호스트 객체는 열지 않는다.
  // 열어 봐야 getter 가 던지거나 키가 들어 있을 뿐이다.
  if (!isPlainish(v)) return '[Object]';

  const out = {};
  let i = 0;
  let keys;
  try {
    keys = Object.keys(v);
  } catch (e) {
    return '[Object]';
  }
  for (let j = 0; j < keys.length; j++) {
    if (i++ >= MAX_ITEMS) break;
    const k = keys[j];
    let val;
    try {
      val = v[k];   // getter 가 던질 수 있다.
    } catch (e) {
      val = '[Throws]';
    }
    // **키 이름도 지운다** — 키를 키로 쓴 맵(`{ 'AIza…': 1 }`)이 있을 수 있다.
    out[scrub(k, pats)] = walk(val, pats, depth + 1, next);
  }
  return out;
}

function safeStr(x) {
  try {
    return x === undefined || x === null ? '' : String(x);
  } catch (e) {
    return '';
  }
}

/** 평범한 객체인가(프로토타입이 `Object.prototype` 이거나 없음). */
function isPlainish(v) {
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}
