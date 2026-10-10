/* ============================================================
   MedReader — 프로바이더 공통 계층 (spec 8-1 · 8-2 · 8-3 · 8-4 · 13절 · 15절)

   ── 서비스 계층이다(3-2) ────────────────────────────────
   `config` · `privacy/redact` · `db` · 어댑터를 import 한다. DOM 을 모르고
   **사용자에게 보여 줄 문장을 만들지 않는다** — 코드만 낸다. 문구는 UI 몫이다.

   ── ★ 이 파일의 계약: 키는 나가지 않는다 ─────────────────
   1. 키는 **헤더로만** 간다. URL 을 만드는 `adapter.endpoint()` 는 키를
      인자로 받지도 않는다.
   2. **밖으로 나가는 모든 오류는 `ProviderError` 다.** 어댑터·`fetch`·
      `JSON.parse` 가 무엇을 던지든 여기서 잡아 `redact` 를 통과시킨 뒤
      다시 감싼다. 원본 예외는 **버린다** — `cause` 로도 달지 않는다.
      (13절: "`provider.js` 는 예외 객체를 그대로 던지지 않고
      `{code, status, message: redact(...)}` 로 감싼다.")
   3. **`console.*` 을 한 번도 부르지 않는다.** `dev.debug` 여도 마찬가지다(13절).
      이 파일에 그 낱말이 나타나면 그 자체가 결함이다.

   ── ★ 왜 `fetch` 를 주입받는가 ──────────────────────────
   `tts/speaker.js` 가 `synth` 를 주입받는 것과 같은 이유다. 실제 키로 실제
   호출을 하지 않고도 상태 코드 분기·취소·키 누출을 **전수 검증**할 수 있다.
   실제 호출 검증은 사용자가 자기 키로 실기기에서 한다.
   ============================================================ */

import { AI } from '../config.js';
import { redact, redactString } from '../privacy/redact.js';
import * as db from '../db.js';
import { gemini } from './adapters/gemini.js';

/** 8-1 — 등록된 어댑터. 7a 는 gemini 하나다(나머지는 8-2 표에 설계만 있다). */
export const ADAPTERS = Object.freeze({ gemini: gemini });

/** 오류 코드. 8-2 의 일곱 가지 + 네트워크/취소/키없음. */
export const CODES = Object.freeze({
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH: 'AUTH',
  /* 8-2 `[신설 2026-09-28]` 지역 제한. **`AUTH` 와 다른 코드다** — 이것을 키 오류로
     안내하면 사용자는 멀쩡한 키를 영원히 다시 넣는다. 판정은 어댑터의
     `errorParser` 가 하고, 이 파일은 그 코드를 **고치지 않고 그대로 흘려보낸다**
     (`complete()` 는 `ProviderError.code`, `verifyKey()` 는 `{code:'REGION', canSave:true}`). */
  REGION: 'REGION',
  /* `[신설 2026-10-08]` 이 모델을 쓸 수 없다(404·`NOT_FOUND` — 지원 종료·오타·이 키에 열리지
     않은 모델). **키 문제가 아니고 "확인 불가"도 아니다** — UI 는 "다른 모델을 고르세요"로
     안내하고 모델 목록을 새로 받는다. 판정은 어댑터, 이 파일은 그대로 흘려보낸다. */
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  SERVER: 'SERVER',
  BAD_REQUEST: 'BAD_REQUEST',
  SAFETY: 'SAFETY',
  UNKNOWN: 'UNKNOWN',
  ABORTED: 'ABORTED',
  NO_KEY: 'NO_KEY',
  NO_PROVIDER: 'NO_PROVIDER',
  /* `[신설 2026-10-10 — 운영자 결정]` `assertNoKeyInUrl` 이 **보내기 전에** 막았다(모델 칸에 키 등).
     네트워크 오류가 아니고 요청이 나가지 않았다 — `usage` 에 아무것도 넣지 않는다.
     설정(모델·키)을 고쳐야 풀린다. */
  KEY_IN_URL: 'KEY_IN_URL'
});

/** 8-4 형식 검사 결과. 불일치는 **경고**다. */
export const KEY_FORMAT = Object.freeze({
  OK: 'KEY_FORMAT_OK',
  UNFAMILIAR: 'KEY_FORMAT_UNFAMILIAR',
  EMPTY: 'KEY_EMPTY'
});

/**
 * 밖으로 나가는 유일한 오류 타입.
 *
 * `message` 는 **이미 지워진 문자열**이어야 하지만, 생성자에서 한 번 더
 * `redactString` 을 건다. 멱등이라 두 번 걸어도 결과가 같고, 언젠가 누가
 * 이 생성자를 새 경로에서 부를 때 그 경로가 지우는 것을 잊어도 막힌다.
 * (싸고, 잊었을 때의 대가가 크다.)
 */
export class ProviderError extends Error {
  constructor(info) {
    const i = info || {};
    super(redactString(i.message === undefined || i.message === null ? '' : i.message));
    this.name = 'ProviderError';
    this.code = i.code || CODES.UNKNOWN;
    this.status = Number.isFinite(i.status) ? i.status : 0;
    /** 429 일 때만. 초 단위(8-2: "429 는 `Retry-After` 를 읽어 파이프라인에 넘긴다"). */
    this.retryAfter = Number.isFinite(i.retryAfter) ? i.retryAfter : null;
    /**
     * 8-3 — **CORS 실패와 네트워크 실패는 구별이 안 된다.** 코드로 구분하려
     * 들지 않는다. 둘 다 `UNKNOWN` 이고, 이 깃발만 세워 둔다. 어떤 안내를
     * 보여 줄지는 호출자(UI)가 고른다 — 문구는 여기서 만들지 않는다(3-2).
     */
    this.maybeBlocked = !!i.maybeBlocked;
    /**
     * `[신설 2026-10-10]` **응답을 받지 못했다**(`fetch` 자체가 거부 — 네트워크·CORS, 8-3).
     * 응답을 받은 뒤의 실패(본문 해석 실패 등)는 `maybeBlocked` 여도 이것이 거짓이다.
     * 파이프라인은 이것으로 "보냈다가 실패(failed)"와 "닿지 못함(blocked)"을 가른다(7-6).
     */
    this.noResponse = !!i.noResponse;
  }
  toJSON() {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      retryAfter: this.retryAfter,
      maybeBlocked: this.maybeBlocked,
      noResponse: this.noResponse
    };
  }
}

/* ────────────────────────────────────────────────────────
   어댑터·키
   ──────────────────────────────────────────────────────── */

export function getAdapter(id) {
  const a = ADAPTERS[String(id || AI.DEFAULT_PROVIDER)];
  if (!a) {
    throw new ProviderError({ code: CODES.NO_PROVIDER, status: 0, message: 'unknown provider' });
  }
  return a;
}

/**
 * 8-4 — 형식 검사. **저장을 막지 않는다.** 경고 코드만 돌려준다.
 * "형식이 또 바뀔 수 있다"가 8-4 의 근거이고, 실제로 `AIza…` 에서
 * `AQ.…` 로 한 번 바뀌었다.
 */
export function checkKeyFormat(providerId, key) {
  const raw = typeof key === 'string' ? key.trim() : '';
  if (raw === '') return { ok: false, code: KEY_FORMAT.EMPTY };
  let adapter;
  try {
    adapter = getAdapter(providerId);
  } catch (e) {
    return { ok: true, code: KEY_FORMAT.UNFAMILIAR };
  }
  const p = adapter.keyPattern;
  if (!p || p.test(raw)) return { ok: true, code: KEY_FORMAT.OK };
  return { ok: true, code: KEY_FORMAT.UNFAMILIAR };
}

/* ────────────────────────────────────────────────────────
   15절 `usage` 기록
   ──────────────────────────────────────────────────────── */

/** 9-2 — `usage` 키는 **로컬 날짜** `'YYYY-MM-DD'`. UTC 가 아니다. */
export function localDay(when) {
  const t = when instanceof Date ? when : new Date(when === undefined || when === null ? Date.now() : when);
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

/** 9-2 `usage` 한 행의 빈 모양. */
export function emptyUsageRow(day) {
  const byKind = {};
  for (let i = 0; i < AI.USAGE_KINDS.length; i++) byKind[AI.USAGE_KINDS[i]] = 0;
  return {
    day: day,
    calls: 0,
    byKind: byKind,
    byProvider: {},
    tokensIn: 0,
    tokensOut: 0,
    cacheHits: 0,
    ondeviceHits: 0,
    blocked429: 0,
    errors: 0,
    /* `[8a]` 15절 — 낭독 동반 번역 원격 호출로 **보낸** 원문 글자 수 합(캐시로 끝난 문장은 세지 않는다). */
    charsTranslated: 0
  };
}

/**
 * 읽고-고치고-쓰는 사이에 다른 호출이 끼어들면 셈이 **사라진다**.
 * 번역은 줄 탭마다 나가므로 동시에 두 개가 뜨는 것이 정상이다.
 * 모듈 하나짜리 직렬 큐로 그 창을 없앤다(IndexedDB 트랜잭션보다 단순하고,
 * 이 스토어는 하루 한 행이라 경합이 길지 않다).
 */
let usageChain = Promise.resolve();

/**
 * `usage` 를 증분한다. **실패해도 던지지 않는다** — 사용량 기록이 안 됐다고
 * 번역이 죽으면 안 된다(대시보드는 부차적이고 AI 호출은 그렇지 않다).
 *
 * @param {Object} delta `{calls, kind, provider, tokensIn, tokensOut, errors, blocked429, cacheHits, ondeviceHits, charsTranslated}`
 * @param {{db?: Object, now?: *}} [deps] 테스트가 `db` 를 주입한다
 */
export function bumpUsage(delta, deps) {
  const store = (deps && deps.db) || db;
  const run = async () => {
    try {
      const day = localDay(deps && deps.now);
      const prev = await store.get('usage', day);
      const row = prev ? shallowUsage(prev, day) : emptyUsageRow(day);
      const d = delta || {};

      if (d.calls) row.calls += d.calls;
      if (d.tokensIn) row.tokensIn += d.tokensIn;
      if (d.tokensOut) row.tokensOut += d.tokensOut;
      if (d.errors) row.errors += d.errors;
      if (d.blocked429) row.blocked429 += d.blocked429;
      if (d.cacheHits) row.cacheHits += d.cacheHits;
      if (d.ondeviceHits) row.ondeviceHits += d.ondeviceHits;
      if (d.charsTranslated) row.charsTranslated = (Number(row.charsTranslated) || 0) + d.charsTranslated;

      // 9-2 의 고정 키가 아니면 새로 만들지 않는다(오타가 스토어에 눌러앉는다).
      // `[8a]` `readalong`(15절)은 빈 행에 없고 **처음 쓰일 때** 생긴다(config 의 `READALONG_KIND` 주석).
      if (d.kind && (AI.USAGE_KINDS.indexOf(d.kind) >= 0 || d.kind === AI.READALONG_KIND)) {
        row.byKind[d.kind] = (row.byKind[d.kind] || 0) + (d.calls || 1);
      }
      if (d.provider) {
        row.byProvider[d.provider] = (row.byProvider[d.provider] || 0) + (d.calls || 1);
      }

      await store.put('usage', row);
    } catch (e) {
      /* 기록 실패는 조용히 넘긴다. ★ 여기서 로그를 찍지 않는다 — 이 함수가
         받은 것에 키가 닿을 일은 없지만, "오류를 찍는 습관"이 이 파일에
         생기는 것 자체를 막는다(13절). */
    }
  };
  usageChain = usageChain.then(run, run);
  return usageChain;
}

/** 저장된 행을 그대로 고치지 않는다 — 사본을 만든다. */
function shallowUsage(prev, day) {
  const base = emptyUsageRow(day);
  const row = Object.assign(base, prev, { day: day });
  row.byKind = Object.assign({}, base.byKind, prev.byKind || {});
  row.byProvider = Object.assign({}, prev.byProvider || {});
  return row;
}

/* ────────────────────────────────────────────────────────
   공통 호출
   ──────────────────────────────────────────────────────── */

/**
 * ★ `[신규 2026-09-26]` **보내기 직전 마지막 그물 — URL 에 키가 있으면 보내지 않는다.**
 *
 * 왜 필요한가: 어댑터가 `endpoint()` 에 키를 받지 않는 것만으로는 부족하다.
 * `[실측]` 모델 칸에 키를 붙여 넣으면 그 키가 **URL 경로에 그대로 실렸다** —
 * `AQ.AbTEST…` 같은 키는 모델 이름 허용 목록(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)을
 * **통과한다**(영숫자·점·하이픈뿐이고 64자 미만이니까).
 *
 * 그때 배운 것: **형식을 좁히는 방어는 그 형식을 아는 만큼만 막는다.**
 * 여기서는 형식을 추측하지 않고 "이 URL 에 지금 이 키가 들어 있는가" 하나만 본다.
 * 어떤 경로로 새든(모델 칸·미래의 어댑터·오타) 부류 전체가 걸린다.
 *
 * 걸리면 **보내지 않고 던진다.** 요청이 나가면 URL 은 이미 로그·리퍼러에 남는다.
 */
function assertNoKeyInUrl(url, key) {
  const u = String(url == null ? '' : url);
  // `[Review 7b-fix]` 앞뒤 공백을 떼고 본다. 호출자는 키를 `trim()` 해 헤더에 싣는데
  // 여기에 공백 붙은 원문이 오면 `indexOf` 가 빗나가, 서버가 준 `pageToken` 에 키가
  // 섞였을 때 그대로 나갔다(목록 쪽 넘김 — 스텁으로 재현).
  const k = String(key == null ? '' : key).trim();
  // 너무 짧은 값은 본문과 우연히 겹친다. 키라고 부를 만한 길이만 본다.
  if (k.length < 8) return u;
  if (u.indexOf(k) >= 0 || u.indexOf(encodeURIComponent(k)) >= 0) {
    // `[수정 2026-10-10]` BAD_REQUEST 가 아니라 전용 코드 — 요청이 나가지 않았고 설정 탓이다.
    throw new ProviderError({
      code: CODES.KEY_IN_URL, status: 0,
      message: 'refused: key would travel in the URL'
    });
  }
  return u;
}

function pickFetch(opts) {
  if (opts && typeof opts.fetch === 'function') return opts.fetch;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  return null;
}

/**
 * 무엇이 던져졌든 `ProviderError` 로 바꾼다.
 *
 * ★ 원본 예외를 **버린다.** `cause` 에 달면 그 예외 안의 URL·헤더·본문이
 *   그대로 따라 나온다. 필요한 것은 코드뿐이고, 사람이 읽을 부분은
 *   `redact` 를 통과한 메시지로 충분하다.
 */
function wrap(err, fallbackCode, key, noResponse) {
  if (err instanceof ProviderError) return err;
  const isAbort = !!(err && err.name === 'AbortError');
  // `redact(err)` 는 객체를 받는다 — 오류가 문자열이든 객체든 여기를 지난다.
  const keys = key ? [key] : [];
  const safe = redact(err, { keys: keys });
  const msg = safe && typeof safe === 'object' && typeof safe.message === 'string'
    ? safe.message
    : redactString(safe, { keys: keys });
  return new ProviderError({
    code: isAbort ? CODES.ABORTED : fallbackCode,
    status: 0,
    message: msg,
    // 8-3 — `TypeError: Failed to fetch` 는 CORS 일 수도 네트워크일 수도 있다.
    maybeBlocked: !isAbort && fallbackCode === CODES.UNKNOWN,
    noResponse: !isAbort && !!noResponse
  });
}

/** `Retry-After` 는 초 또는 HTTP-date 로 온다(8-2). 초로 통일한다. */
export function parseRetryAfter(value, nowMs) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return Number(s);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  return Math.max(0, Math.round((t - now) / 1000));
}

function headerOf(res, name) {
  try {
    if (res && res.headers && typeof res.headers.get === 'function') return res.headers.get(name);
  } catch (e) { /* 스텁이 헤더를 안 줄 수 있다 */ }
  return null;
}

/** 본문이 JSON 이 아니어도 죽지 않는다(502 프록시가 HTML 을 준다). */
async function readJson(res) {
  try {
    if (res && typeof res.json === 'function') return await res.json();
  } catch (e) { /* 아래로 */ }
  return null;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    throw new ProviderError({ code: CODES.ABORTED, status: 0, message: 'aborted' });
  }
}

/** 오류 본문에서 사람이 읽을 조각을 꺼낸다. 없으면 빈 문자열. */
function messageOf(json) {
  if (!json) return '';
  if (json.error && typeof json.error.message === 'string') return json.error.message;
  if (typeof json.message === 'string') return json.message;
  return '';
}

/**
 * 8-1 `complete()`. 어댑터의 함수들을 엮어 한 번 호출한다.
 *
 * @param {{system?:string, user:string, json?:boolean, schema?:object,
 *          maxOutputTokens?:number, temperature?:number}} req
 * @param {{key:string, provider?:string, model?:string, signal?:AbortSignal,
 *          fetch?:Function, kind?:string, db?:Object, now?:*, chars?:number}} opts
 * @returns {Promise<{text:string, usage:{input:number,output:number}|null, finishReason:string|null, model:string, provider:string}>}
 * @throws {ProviderError} **항상** 이 타입이다. 메시지는 이미 지워져 있다.
 */
export async function complete(req, opts) {
  const o = opts || {};
  const adapter = getAdapter(o.provider);
  const key = typeof o.key === 'string' ? o.key : '';
  const model = o.model || adapter.defaultModel;
  const signal = o.signal || null;

  if (key === '') {
    throw new ProviderError({ code: CODES.NO_KEY, status: 0, message: 'no key' });
  }
  const doFetch = pickFetch(o);
  if (!doFetch) {
    throw new ProviderError({ code: CODES.UNKNOWN, status: 0, message: 'no fetch', maybeBlocked: true });
  }

  throwIfAborted(signal);

  /* `[수정 2026-10-10]` URL 검사를 **사용량 기록보다 먼저** 한다. 거절(`KEY_IN_URL`)이면 요청이
     나가지 않았으므로 `calls`·`errors` 어느 것도 세지 않는다. */
  let url;
  try {
    url = assertNoKeyInUrl(adapter.endpoint(model), key);
  } catch (e) {
    throw wrap(e, CODES.UNKNOWN, key);          // ProviderError(KEY_IN_URL) 는 그대로 지나간다
  }

  /* 15절 — "호출이 **시작될 때** `calls++`(응답 실패도 비용이 발생했을 수
     있음)". 끝에서 await 하므로 네트워크 지연에 IndexedDB 쓰기가 끼어들지
     않으면서도, 호출자가 `await complete()` 한 뒤에는 기록이 끝나 있다. */
  /* `[8a]` 7-8-3 — `charsTranslated` 도 호출이 **시작될 때** 함께 센다(`o.chars` — 파이프라인이 준다). */
  const started = bumpUsage(
    { calls: 1, kind: o.kind, provider: adapter.id, charsTranslated: Number(o.chars) > 0 ? Number(o.chars) : 0 },
    { db: o.db, now: o.now }
  );

  let res;
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: adapter.headers(key),
      body: JSON.stringify(adapter.bodyBuilder(req, model)),
      signal: signal || undefined
    });
  } catch (e) {
    await bumpUsage({ errors: 1 }, { db: o.db, now: o.now });
    await started;
    // `[수정 2026-10-10]` fetch 가 거부됐다 = 응답을 받지 못했다(`noResponse`).
    throw wrap(e, CODES.UNKNOWN, key, true);
  }

  // 스텁이든 실물이든, 취소가 `fetch` 거부로 오지 않는 경우가 있다.
  try {
    throwIfAborted(signal);
  } catch (e) {
    await started;
    throw e;
  }

  const status = Number(res && res.status) || 0;
  const ok = !!(res && (res.ok === true || (res.ok === undefined && status >= 200 && status < 300)));
  const json = await readJson(res);

  if (!ok) {
    let code = CODES.UNKNOWN;
    try {
      code = adapter.errorParser(status, json) || CODES.UNKNOWN;
    } catch (e) { /* 어댑터가 던져도 UNKNOWN 으로 간다 */ }

    const retryAfter = code === CODES.RATE_LIMIT
      ? parseRetryAfter(headerOf(res, 'Retry-After'), o.nowMs)
      : null;

    await bumpUsage(
      { errors: 1, blocked429: code === CODES.RATE_LIMIT ? 1 : 0 },
      { db: o.db, now: o.now }
    );
    await started;

    /* ★ 서버 메시지를 그대로 쓰지 않는다. Google 은 400 응답에 요청을 되비추어
       주는 일이 있고, 프록시는 요청 헤더를 통째로 에코하기도 한다.
       `redact` 에 **실제 키**를 함께 넘긴다 — 패턴이 빗나가도 걸리도록. */
    throw new ProviderError({
      code: code,
      status: status,
      retryAfter: retryAfter,
      message: redactString(messageOf(json), { keys: [key] })
    });
  }

  let parsed;
  try {
    parsed = adapter.responseParser(json);
  } catch (e) {
    await bumpUsage({ errors: 1 }, { db: o.db, now: o.now });
    await started;
    throw wrap(e, CODES.UNKNOWN, key);
  }

  /* 8-2 — 안전 필터 차단은 `SAFETY` 코드. 200 으로 온다(본문만 비어 있다). */
  if (parsed.finishReason === 'SAFETY' || parsed.blockReason) {
    await bumpUsage({ errors: 1 }, { db: o.db, now: o.now });
    await started;
    throw new ProviderError({
      code: CODES.SAFETY,
      status: status,
      message: redactString(String(parsed.blockReason || parsed.finishReason || ''), { keys: [key] })
    });
  }

  /* 8-5 — 실제 `usage` 가 오면 그것을 기록하고 추정치는 버린다. */
  if (parsed.usage) {
    await bumpUsage(
      { tokensIn: parsed.usage.input, tokensOut: parsed.usage.output },
      { db: o.db, now: o.now }
    );
  }
  await started;

  return {
    text: parsed.text,
    usage: parsed.usage,
    finishReason: parsed.finishReason,
    model: model,
    provider: adapter.id
  };
}

/* ────────────────────────────────────────────────────────
   8-4 키 검증
   ──────────────────────────────────────────────────────── */

/**
 * 8-4 — **가장 싼 요청 1회**(gemini: `GET /v1beta/models?pageSize=1`, 토큰 0).
 *
 * 다섯 갈래(8-4 `[수정 2026-09-28]`):
 *   200            → `{ok:true}`
 *   401/403        → `{ok:false, code:'AUTH'}`            키가 틀렸다
 *   429            → `{ok:true,  code:'RATE_LIMIT', limited:true}`
 *                    **키는 유효하다.** 한도에 걸렸을 뿐이므로 ok 로 친다(8-4).
 *   지역 제한      → `{ok:false, code:'REGION', canSave:true}`
 *                    키는 판정 불가 — "키 문제가 아닙니다". 저장은 막지 않는다
 *                    (키는 멀쩡할 수 있고 다른 경로에서 쓸 수 있다).
 *   네트워크 실패  → `{ok:false, code:'UNKNOWN', maybeBlocked:true}`
 *                    "확인 불가, 나중에 다시" — **저장은 허용**(`canSave:true`).
 *
 * 실패 갈래에는 `message` 가 붙는다 — 서버 메시지를 **실제 키로 지운 것**이다.
 * 8-2: 지역 제한 문구는 `[가정]` 이라 실물 응답으로 확정해야 하고, 그 근거를
 * `dev.debug` 일 때 화면에 보이기 위한 것이다(문구 선택은 UI 몫).
 *
 * ★ 8-3: CORS 차단과 네트워크 오류는 브라우저가 구별해 주지 않는다. 구별하려
 *   들지 않는다. `maybeBlocked` 만 세우고 문구 선택은 호출자에게 맡긴다.
 *
 * ★ 이 함수는 **던지지 않는다.** 검증은 설정 화면의 한 버튼이고, 거기서
 *   예외가 튀면 화면이 멈춘다. 모든 갈래가 객체로 돌아온다.
 *
 * @returns {{ok:boolean, code:string|null, status:number, canSave:boolean,
 *            limited?:boolean, maybeBlocked?:boolean, retryAfter?:number|null}}
 */
export async function verifyKey(key, opts) {
  const o = opts || {};
  let adapter;
  try {
    adapter = getAdapter(o.provider);
  } catch (e) {
    return { ok: false, code: CODES.NO_PROVIDER, status: 0, canSave: false };
  }

  const raw = typeof key === 'string' ? key.trim() : '';
  if (raw === '') return { ok: false, code: CODES.NO_KEY, status: 0, canSave: false };

  const doFetch = pickFetch(o);
  if (!doFetch) {
    return { ok: false, code: CODES.UNKNOWN, status: 0, canSave: true, maybeBlocked: true };
  }

  if (o.signal && o.signal.aborted) {
    return { ok: false, code: CODES.ABORTED, status: 0, canSave: true };
  }

  /* `[수정 2026-10-10]` URL 검사를 사용량 기록보다 먼저 — 거절이면 요청이 나가지 않았다(기록 0). */
  let url;
  try {
    url = assertNoKeyInUrl(adapter.verifyEndpoint(), key);
  } catch (e) {
    return { ok: false, code: CODES.KEY_IN_URL, status: 0, canSave: true };
  }

  /* 8-4 — "검증 호출도 `usage` 에 `kind:'verify'` 로 기록한다(대시보드 투명성)."
     15절이 상한 계산에서 검증을 제외하지만, 그것은 **상한 쪽 판단**이고
     기록은 남긴다. */
  const started = bumpUsage(
    { calls: 1, kind: AI.VERIFY_KIND, provider: adapter.id },
    { db: o.db, now: o.now }
  );

  let res;
  try {
    res = await doFetch(url, {
      method: adapter.verifyMethod || 'GET',
      headers: adapter.headers(raw),
      signal: o.signal || undefined
    });
  } catch (e) {
    await bumpUsage({ errors: 1 }, { db: o.db, now: o.now });
    await started;
    const aborted = !!(e && e.name === 'AbortError');
    return aborted
      ? { ok: false, code: CODES.ABORTED, status: 0, canSave: true }
      // 8-3 — CORS 인지 네트워크인지 알 수 없다. 저장은 허용한다(8-4).
      : { ok: false, code: CODES.UNKNOWN, status: 0, canSave: true, maybeBlocked: true };
  }

  const status = Number(res && res.status) || 0;
  const ok = !!(res && (res.ok === true || (res.ok === undefined && status >= 200 && status < 300)));

  if (ok) {
    await started;
    return { ok: true, code: null, status: status, canSave: true };
  }

  const json = await readJson(res);
  let code = CODES.UNKNOWN;
  try {
    code = adapter.errorParser(status, json) || CODES.UNKNOWN;
  } catch (e) { /* UNKNOWN 유지 */ }

  if (code === CODES.RATE_LIMIT) {
    // 8-4 — 429 는 **ok** 다. 키는 유효하고 한도에 걸렸을 뿐이다.
    await bumpUsage({ blocked429: 1 }, { db: o.db, now: o.now });
    await started;
    return {
      ok: true,
      code: CODES.RATE_LIMIT,
      status: status,
      canSave: true,
      limited: true,
      retryAfter: parseRetryAfter(headerOf(res, 'Retry-After'), o.nowMs)
    };
  }

  await bumpUsage({ errors: 1 }, { db: o.db, now: o.now });
  await started;

  // ★ 서버 메시지는 **실제 키로** 지운 뒤에만 내보낸다(13절 — 되비춤 대비).
  const message = redactString(messageOf(json), { keys: [raw, key] });

  if (code === CODES.AUTH) {
    // 유일하게 "저장하면 안 된다"가 분명한 갈래.
    return { ok: false, code: CODES.AUTH, status: status, canSave: false, message: message };
  }

  if (code === CODES.REGION) {
    // 8-4 — 키는 판정 불가. **저장을 막지 않는다**(`AUTH` 와 반대).
    return { ok: false, code: CODES.REGION, status: status, canSave: true, message: message };
  }

  // 500·400 등 — 키 문제라고 단정할 수 없다. 저장은 막지 않는다(8-4 의 태도).
  return { ok: false, code: code, status: status, canSave: true, message: message };
}

/** 모델 목록을 따라갈 최대 쪽 수. 서버가 `nextPageToken` 을 끝없이 주어도 멈춘다. */
const MAX_MODEL_PAGES = 10;

/**
 * 8-4 모델 목록. 실패하면 `staticModels` 로 떨어진다. **던지지 않는다.**
 *
 * `[수정 2026-10-08]` 7b 는 `verifyEndpoint()`(`pageSize=1`)를 재사용해 **모델이 1개만**
 * 왔다. 이제 어댑터의 목록 전용 `modelsEndpoint(pageToken)` 을 쓰고, `nextPageToken`
 * 이 있으면 따라간다(최대 `MAX_MODEL_PAGES` 쪽). 검증(`verifyKey`)은 그대로 `pageSize=1`.
 * 쪽마다 `assertNoKeyInUrl` 을 건다 — `pageToken` 은 서버가 준 값이다.
 * 합친 목록은 중복을 빼고 **기본 모델을 맨 앞에** 둔다.
 *
 * @returns {Promise<{models: {id:string,label:string}[], fromRemote: boolean}>}
 */
export async function listModels(key, opts) {
  const o = opts || {};
  let adapter;
  try {
    adapter = getAdapter(o.provider);
  } catch (e) {
    return { models: [], fromRemote: false };
  }
  const fallback = () => ({
    models: (adapter.staticModels || []).map((id) => ({ id: id, label: id })),
    fromRemote: false
  });

  const raw = typeof key === 'string' ? key.trim() : '';
  const doFetch = pickFetch(o);
  if (raw === '' || !doFetch || typeof adapter.modelsParser !== 'function' ||
      typeof adapter.modelsEndpoint !== 'function') return fallback();

  try {
    const seen = new Set();
    const models = [];
    let token = '';
    for (let page = 0; page < MAX_MODEL_PAGES; page++) {
      const res = await doFetch(assertNoKeyInUrl(adapter.modelsEndpoint(token), key), {
        method: adapter.modelsMethod || 'GET',
        headers: adapter.headers(raw),
        signal: o.signal || undefined
      });
      const ok = !!(res && (res.ok === true || (res.ok === undefined && res.status >= 200 && res.status < 300)));
      if (!ok) {
        // 첫 쪽부터 실패하면 정적 목록. 중간 쪽이 실패하면 받은 데까지 쓴다.
        if (models.length === 0) return fallback();
        break;
      }
      const json = await readJson(res);
      const part = adapter.modelsParser(json) || [];
      for (let i = 0; i < part.length; i++) {
        if (!part[i] || seen.has(part[i].id)) continue;
        seen.add(part[i].id);
        models.push(part[i]);
      }
      const next = part.nextPageToken || (json && typeof json.nextPageToken === 'string' ? json.nextPageToken : '');
      if (!next || next === token) break;
      token = next;
    }
    if (!models.length) return fallback();
    const def = adapter.defaultModel;
    models.sort((a, b) => (a.id === def ? -1 : b.id === def ? 1 : 0));
    return { models: models, fromRemote: true };
  } catch (e) {
    return fallback();
  }
}
