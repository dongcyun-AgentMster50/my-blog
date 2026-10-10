/* ============================================================
   MedReader — 번역 파이프라인과 원격 상태 기계 (spec 7-1 · 7-5 · 7-6 · 8-1 · 10-2 · 15절)

   ── 서비스 계층이다(3-1 · 3-2) ──────────────────────────
   `config`·`db`·`settings`·`ai/provider`·`ai/prompts`·`ai/jsonrepair`·`ai/cache`·`ai/tokens`
   만 import 한다. **`ui/` 를 import 하지 않고, 문장을 나누지 않는다**(분할은 `tts/text.js`
   의 `Unit.src` 를 받기만 한다 — 7-8-2). 사용자에게 보일 문장을 만들지 않는다 — 상태 이름과
   코드만 낸다. 언어는 값으로만 다룬다(특정 언어 코드를 이 파일에 적지 않는다 — 16-D2 grep).

   ── 순서 (7-1 원칙 1) ───────────────────────────────────
     캐시 → (주입되면) 기기 내 번역 → 원격. 각 단계는 실패하면 조용히 다음으로.

   ── 원격 상태 (7-6) ─────────────────────────────────────
     ready | inflight | cooldown | exhausted | no-key | offline | capped | region | model
     - 429                 → exhausted(until = Retry-After 또는 다음 날 00:00). 자동 재시도 0.
     - 5xx                 → **즉시 1회만** 다시 보낸 뒤에도 5xx 면 cooldown(30s → 60s → 120s).
     - 네트워크 오류       → cooldown(재시도 없음). 기기가 오프라인이면 offline.
     - 타임아웃 30초       → cooldown.
     - 401/403·AUTH·키 없음 → no-key.
     - REGION              → region. 키 문제가 아니다 — 세션 동안 유지, [다시 시도]·프로바이더 변경으로 ready.
     - MODEL_UNAVAILABLE   → **model** `[8a 결정 — spec 7-6 에 없음]`. 시간이 지나도, 키를 다시 넣어도
                             풀리지 않는다. 모델·프로바이더를 바꾸거나 [다시 시도]하면 ready.
     - 일일 상한(`ai.dailyCap`, 검증 호출 제외)에 닿으면 capped. 날이 바뀌거나 상한을 올리면 ready.
     - `navigator.onLine === false` → offline. online 이 오면 이전 상태로.

   ── ★ "보내지 않은 것"과 "보냈다가 실패한 것" (7-6 `[신설 2026-09-28]`) ──
     blocked — 원격 상태가 ready 가 아니어서 **보내지 않았다**(429·키·지역·모델·오프라인으로 거절된
               것 포함 — 내용이 판정받지 않았다). 상태가 ready 로 돌아오면(`'state'` 이벤트) 호출자가
               다시 부르면 **보낸다.** 재시도가 아니라 첫 전송이다.
     failed  — 보냈고 실패했다(5xx 1회 재시도 뒤, 타임아웃, 네트워크, 파싱 실패, 밀림, SAFETY, 개수 누락).
               이 파이프라인이 키를 기억해 **다시 보내지 않는다.** `translate(…, {retry:true})`
               (사용자의 [다시 시도])만 다시 보낸다.

   ── 같은 키 동시 요청 (7-6) ──────────────────────────────
   진행 중인 캐시 키의 요청이 또 오면 **진행 중인 Promise 를 공유한다**(호출 1건).
   ============================================================ */

import { PIPELINE, AI } from '../config.js';
import * as realProvider from './provider.js';
import { CODES, localDay, bumpUsage } from './provider.js';
import { parseAIJson } from './jsonrepair.js';
import {
  buildTranslateRequest, checkTranslation, TRANSLATE_SCHEMA, PROMPT_VERSION, langName
} from './prompts.js';
import { keyFor, defaultCache } from './cache.js';
import { exceedsRequestBudget } from './tokens.js';
import * as realDb from '../db.js';
import * as realSettings from '../settings.js';

/** 7-6 원격 상태. `model` 은 8a 가 더했다(위 머리말). */
export const STATES = Object.freeze({
  READY: 'ready',
  INFLIGHT: 'inflight',
  COOLDOWN: 'cooldown',
  EXHAUSTED: 'exhausted',
  NO_KEY: 'no-key',
  OFFLINE: 'offline',
  CAPPED: 'capped',
  REGION: 'region',
  MODEL: 'model'
});

/** 문장 하나의 결과 상태. */
export const SEG = Object.freeze({ READY: 'ready', FAILED: 'failed', BLOCKED: 'blocked', SKIPPED: 'skipped' });

/** `failed` 의 까닭(코드). 문구는 UI 가 고른다. */
export const FAIL = Object.freeze({
  PARSE: 'PARSE',         // 응답을 해석하지 못했다(10-6)
  SHIFT: 'SHIFT',         // 밀림 검사가 청크의 20% 를 넘었다 — 청크 전체 실패(10-2)
  RATIO: 'RATIO',         // 길이 비율 [0.2, 5] 밖(10-2)
  DIGITS: 'DIGITS',       // 원문 숫자가 번역에 하나도 없다(10-2)
  MISSING: 'MISSING',     // 응답에 그 번호가 없다(10-2 개수 누락)
  SERVER: 'SERVER',       // 5xx — 1회 다시 보낸 뒤에도
  TIMEOUT: 'TIMEOUT',     // 30초
  NETWORK: 'NETWORK',     // 네트워크·CORS(구별 불가 — 8-3)
  SAFETY: 'SAFETY',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN: 'UNKNOWN'
});

/** 결과 전체의 상태(원격 상태 말고). */
export const STATUS = Object.freeze({ SAME_LANG: 'same-lang', UNSUPPORTED_LANG: 'unsupported-lang', EMPTY: 'empty' });

/** 다음 날 로컬 00:00(ms). 7-6 — 429 에 `Retry-After` 가 없을 때. */
export function nextLocalMidnight(nowMs) {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

function textOf(seg) {
  if (typeof seg === 'string') return seg;
  return String((seg && seg.text) == null ? '' : seg.text);
}

function charCount(s) {
  let n = 0;
  for (const ch of String(s)) { if (ch) n++; }
  return n;
}

/**
 * 파이프라인 하나. 앱은 UI 가 키·설정을 주입해 하나 만든다. 테스트는 `fetch`·`db`·시계·타이머를 주입한다.
 *
 * @param {Object} [deps]
 * @param {{complete:Function}} [deps.provider]  8-1 `complete()` 를 가진 것(기본: `ai/provider.js`)
 * @param {Object} [deps.cache]                  `getMany`·`putMany`(기본: `defaultCache()`)
 * @param {()=>string} [deps.getKey]             지금 프로바이더의 키 원문(기본: 없음 → `no-key`)
 * @param {(k:string)=>*} [deps.getSetting]       설정 읽기(기본: `settings.get`)
 * @param {Object} [deps.db]                     `usage` 읽기·쓰기(기본: `db.js`)
 * @param {Function} [deps.fetch]                `complete()` 에 넘긴다
 * @param {()=>number} [deps.now]
 * @param {()=>boolean} [deps.isOnline]          기본: `navigator.onLine !== false`
 * @param {Function} [deps.setTimer]  [deps.clearTimer]
 * @param {(sentences:string[], src:string, dst:string)=>Promise<string[]|null>} [deps.ondevice]
 *        기기 내 번역(`ai/ondevice.js` 의 `translate`). 주입될 때만 쓴다.
 */
export function createPipeline(deps) {
  const d = deps || {};
  const provider = d.provider || realProvider;
  const getSetting = typeof d.getSetting === 'function' ? d.getSetting : realSettings.get;
  const cache = d.cache || defaultCache(() => {
    const mb = Number(getSetting('ai.cacheLimitMB'));
    return (Number.isFinite(mb) && mb > 0 ? mb : PIPELINE.CACHE_LIMIT_MB) * 1024 * 1024;
  });
  const getKey = typeof d.getKey === 'function' ? d.getKey : () => '';
  const db = d.db || realDb;
  const now = typeof d.now === 'function' ? d.now : () => Date.now();
  const isOnline = typeof d.isOnline === 'function'
    ? d.isOnline
    : () => !(globalThis.navigator && globalThis.navigator.onLine === false);
  const setTimer = typeof d.setTimer === 'function' ? d.setTimer : (fn, ms) => setTimeout(fn, ms);
  const clearTimer = typeof d.clearTimer === 'function' ? d.clearTimer : (h) => clearTimeout(h);
  const ondevice = typeof d.ondevice === 'function' ? d.ondevice : null;

  /* ── 상태 ─────────────────────────────────────────── */
  let base = { name: STATES.READY, until: 0, code: null, day: null };
  let offline = false;
  let inflightCount = 0;
  let cooldownLevel = 0;
  let expiryTimer = null;
  let lastEmitted = STATES.READY;
  const listeners = new Set();

  /** 진행 중인 캐시 키 → 그 키의 결과 Promise(7-6 공유). */
  const inflight = new Map();
  /** 보냈다가 실패한 키 → 까닭. 사용자 [다시 시도] 전에는 다시 보내지 않는다. */
  const failedKeys = new Map();

  function setBase(name, until, code) {
    base = { name: name, until: until || 0, code: code || null, day: name === STATES.CAPPED ? localDay(now()) : null };
    if (expiryTimer !== null) { clearTimer(expiryTimer); expiryTimer = null; }
    if (until && until > now()) {
      expiryTimer = setTimer(() => { expiryTimer = null; notify(); }, until - now());
    }
    notify();
  }

  /** 시간이 지나 풀린 상태를 풀어 둔다(타이머가 늦거나 없어도 맞게 — 읽을 때마다 본다). */
  function refresh() {
    if ((base.name === STATES.COOLDOWN || base.name === STATES.EXHAUSTED) && base.until && now() >= base.until) {
      base = { name: STATES.READY, until: 0, code: null, day: null };
    }
    if (base.name === STATES.CAPPED && base.day !== localDay(now())) {
      base = { name: STATES.READY, until: 0, code: null, day: null };
    }
  }

  function current() {
    refresh();
    if (offline) return STATES.OFFLINE;
    if (base.name !== STATES.READY) return base.name;
    return inflightCount > 0 ? STATES.INFLIGHT : STATES.READY;
  }

  /** 상태 이름이 **바뀔 때만** 알린다(14-2 — 같은 안내를 되풀이하지 않는다). */
  function notify() {
    const name = current();
    if (name === lastEmitted) return;
    const prev = lastEmitted;
    lastEmitted = name;
    const ev = { state: name, prev: prev, until: base.until || 0, code: base.code };
    listeners.forEach((fn) => { try { fn(ev); } catch (e) { /* 듣는 쪽의 오류가 파이프라인을 멈추지 않는다 */ } });
  }

  function enterCooldown(code) {
    const steps = PIPELINE.COOLDOWN_STEPS_MS;
    const ms = steps[Math.min(cooldownLevel, steps.length - 1)];
    cooldownLevel = Math.min(cooldownLevel + 1, steps.length);
    setBase(STATES.COOLDOWN, now() + ms, code);
  }

  function enterExhausted(retryAfterSec) {
    const until = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? now() + retryAfterSec * 1000
      : nextLocalMidnight(now());
    setBase(STATES.EXHAUSTED, until, CODES.RATE_LIMIT);
  }

  /** 15절 — 오늘 쓴 호출(검증 제외)이 사용자의 상한에 닿았는가. 못 읽으면 막지 않는다. */
  async function overCap() {
    let cap = Math.floor(Number(getSetting('ai.dailyCap')));
    if (!Number.isFinite(cap) || cap < 1) cap = 1;      // 0 = 무제한 아님 → 최소 1(15절)
    let row = null;
    try { row = await db.get('usage', localDay(now())); } catch (e) { row = null; }
    if (!row) return false;
    const verify = (row.byKind && Number(row.byKind[AI.VERIFY_KIND])) || 0;
    return (Number(row.calls) || 0) - verify >= cap;
  }

  /**
   * 보내도 되는가. 아니면 그 상태 이름. (전이도 여기서 일어난다 — 오프라인 감지·키 없음·상한.)
   * @returns {Promise<string>} `'ready'` 또는 막는 상태
   */
  async function gate() {
    const on = isOnline();
    if (!on && !offline) { offline = true; notify(); }
    if (on && offline) { offline = false; notify(); }
    if (offline) return STATES.OFFLINE;
    refresh();
    if (base.name === STATES.CAPPED || base.name === STATES.READY) {
      const capped = await overCap();
      if (capped && base.name !== STATES.CAPPED) setBase(STATES.CAPPED, 0, 'CAP');
      else if (!capped && base.name === STATES.CAPPED) setBase(STATES.READY, 0, null);
    }
    if (base.name === STATES.READY && !String(getKey() || '').trim()) setBase(STATES.NO_KEY, 0, CODES.NO_KEY);
    refresh();
    return base.name;
  }

  /* ── 요청 나누기 (7-1 원칙 3 · 8-5) ─────────────────── */

  function maxChars() {
    const v = Math.floor(Number(getSetting('ai.maxReqChars')));
    return Number.isFinite(v) && v > 0 ? v : PIPELINE.MAX_REQ_CHARS;
  }

  /** 문장 경계에서 누적 글자 상한·토큰 상한 이하로 자른다. 상한보다 긴 한 문장은 혼자 간다. */
  function chunksOf(items, langs) {
    const max = maxChars();
    const out = [];
    let cur = [];
    let sum = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const len = charCount(it.text);
      const next = cur.concat([it]);
      const tooMany = cur.length > 0 && (sum + len > max ||
        exceedsRequestBudget(buildTranslateRequest(next, langs) || {}));
      if (tooMany) { out.push(cur); cur = [it]; sum = len; continue; }
      cur = next;
      sum += len;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  /* ── 원격 호출 한 건 ───────────────────────────────── */

  /**
   * 청크 하나를 보낸다. 5xx 만 즉시 1회 다시 보낸다(7-6 의 유일한 예외).
   * @returns {Promise<{state:string, text?:string, code?:string}[]>} 청크 순서대로
   */
  async function sendChunk(chunk, ctx) {
    const req = buildTranslateRequest(chunk, { src: ctx.src, target: ctx.target });
    const chars = chunk.reduce((n, it) => n + charCount(it.text), 0);
    const all = (state, code) => chunk.map(() => ({ state: state, code: code }));

    for (let attempt = 0; ; attempt++) {
      const ac = typeof AbortController === 'function' ? new AbortController() : null;
      let timedOut = false;
      const timer = setTimer(() => { timedOut = true; if (ac) ac.abort(); }, PIPELINE.TIMEOUT_MS);
      const onOuter = () => { if (ac) ac.abort(); };
      if (ctx.signal && typeof ctx.signal.addEventListener === 'function') ctx.signal.addEventListener('abort', onOuter);

      inflightCount++;
      notify();
      let r = null;
      let err = null;
      try {
        const model = String(getSetting('ai.model') || '').trim();
        r = await provider.complete(req, {
          key: String(getKey() || '').trim(),
          provider: getSetting('ai.provider') || undefined,
          model: model || undefined,
          signal: ac ? ac.signal : undefined,
          fetch: d.fetch,
          db: db,
          now: now(),
          kind: ctx.kind,
          // 15절 — 글자 지표는 낭독 동반 번역 호출만 센다.
          chars: ctx.kind === AI.READALONG_KIND ? chars : 0
        });
      } catch (e) {
        err = e;
      } finally {
        clearTimer(timer);
        if (ctx.signal && typeof ctx.signal.removeEventListener === 'function') ctx.signal.removeEventListener('abort', onOuter);
        inflightCount--;
      }

      if (!err) {
        cooldownLevel = 0;
        notify();
        return accept(chunk, r, ctx);
      }

      if (timedOut) { enterCooldown('TIMEOUT'); return all(SEG.FAILED, FAIL.TIMEOUT); }
      const code = (err && err.code) || CODES.UNKNOWN;
      switch (code) {
        case CODES.SERVER:
          if (attempt < PIPELINE.SERVER_RETRIES) { notify(); continue; }   // ★ 즉시 1회만
          enterCooldown(CODES.SERVER);
          return all(SEG.FAILED, FAIL.SERVER);
        case CODES.RATE_LIMIT:
          enterExhausted(err.retryAfter);
          return all(SEG.BLOCKED, STATES.EXHAUSTED);
        case CODES.AUTH:
        case CODES.NO_KEY:
          setBase(STATES.NO_KEY, 0, code);
          return all(SEG.BLOCKED, STATES.NO_KEY);
        case CODES.REGION:
          setBase(STATES.REGION, 0, code);
          return all(SEG.BLOCKED, STATES.REGION);
        case CODES.MODEL_UNAVAILABLE:
          setBase(STATES.MODEL, 0, code);
          return all(SEG.BLOCKED, STATES.MODEL);
        case CODES.ABORTED:
          // 화면을 떠났다(호출자의 signal). 비용은 이미 났을 수 있어 usage 에는 남았다(provider).
          // 내용이 판정받지 않았으므로 failed 가 아니다.
          notify();
          return all(SEG.BLOCKED, 'ABORTED');
        case CODES.SAFETY:
          notify();
          return all(SEG.FAILED, FAIL.SAFETY);
        case CODES.BAD_REQUEST:
          notify();
          return all(SEG.FAILED, FAIL.BAD_REQUEST);
        default:
          if (!isOnline()) { offline = true; notify(); return all(SEG.BLOCKED, STATES.OFFLINE); }
          enterCooldown(code);
          return all(SEG.FAILED, code === CODES.UNKNOWN ? FAIL.NETWORK : FAIL.UNKNOWN);
      }
    }
  }

  /** 2xx 응답 → 10-6 파싱 → 10-2 검증 → 캐시. */
  async function accept(chunk, r, ctx) {
    const parsed = parseAIJson(r && r.text, TRANSLATE_SCHEMA);
    if (!parsed.ok) {
      await bumpUsage({ errors: 1 }, { db: db, now: now() });
      return chunk.map(() => ({ state: SEG.FAILED, code: FAIL.PARSE }));
    }
    const chk = checkTranslation(chunk, parsed.value);
    if (chk.chunkFailed) {
      await bumpUsage({ errors: 1 }, { db: db, now: now() });
      return chunk.map(() => ({ state: SEG.FAILED, code: FAIL.SHIFT }));
    }
    const out = [];
    const entries = [];
    for (let i = 0; i < chunk.length; i++) {
      const it = chk.items[i];
      if (it.state === 'ok') {
        out.push({ state: SEG.READY, text: it.t });
        entries.push({
          key: chunk[i].key, docId: ctx.docId, kind: ctx.kind, targetLang: ctx.target, result: it.t,
          provider: r.provider, model: r.model, promptVersion: PROMPT_VERSION, repaired: !!parsed.repaired
        });
      } else {
        const code = it.reason === 'ratio' ? FAIL.RATIO : it.reason === 'digits' ? FAIL.DIGITS : FAIL.MISSING;
        out.push({ state: SEG.FAILED, code: code });
      }
    }
    if (entries.length) {
      try { await cache.putMany(entries); } catch (e) { /* 캐시 실패는 번역을 버리지 않는다 */ }
    }
    return out;
  }

  /* ── 보내기 묶음 ───────────────────────────────────── */

  /** 새로 보낼 항목들(키가 겹치지 않음)을 기기 내 → 원격 순으로 처리한다. 키 → 결과. */
  async function sendAll(items, ctx) {
    const result = new Map();

    if (ondevice && ctx.useOnDevice) {
      let out = null;
      try { out = await ondevice(items.map((it) => it.text), ctx.src, ctx.target); } catch (e) { out = null; }
      if (Array.isArray(out) && out.length === items.length && out.every((x) => typeof x === 'string' && x.trim())) {
        const entries = [];
        for (let i = 0; i < items.length; i++) {
          result.set(items[i].key, { state: SEG.READY, text: out[i].trim(), ondevice: true });
          entries.push({
            key: items[i].key, docId: ctx.docId, kind: ctx.kind, targetLang: ctx.target, result: out[i].trim(),
            provider: 'ondevice', model: null, promptVersion: PROMPT_VERSION
          });
        }
        try { await cache.putMany(entries); } catch (e) { /* 무시 */ }
        await bumpUsage({ ondeviceHits: 1 }, { db: db, now: now() });
        return result;
      }
    }

    const chunks = chunksOf(items, { src: ctx.src, target: ctx.target });
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      const g = await gate();
      let outs;
      if (g !== STATES.READY) {
        outs = chunk.map(() => ({ state: SEG.BLOCKED, code: g }));   // 보내지 않은 것
      } else {
        outs = await sendChunk(chunk, ctx);
        ctx.calls++;
      }
      for (let i = 0; i < chunk.length; i++) {
        result.set(chunk[i].key, outs[i]);
        if (outs[i].state === SEG.FAILED) failedKeys.set(chunk[i].key, outs[i].code);
      }
    }
    return result;
  }

  /**
   * 8-1 편의 함수 `translate(segments, {src, target, kind, docId})`.
   *
   * @param {({text:string, frag?:string}|string)[]} segments `text` = `Unit.src`(7-8-2)
   * @param {{src:string, target:string, kind?:'translate'|'readalong', docId:string,
   *          retry?:boolean, signal?:AbortSignal}} opts
   *   `retry` — 사용자의 [다시 시도]. 이 문장들의 "보냈다가 실패" 기록을 지우고 다시 보낸다.
   * @returns {Promise<{status:string, calls:number,
   *           results:{state:'ready'|'failed'|'blocked'|'skipped', text?:string, code?:string, cached?:boolean}[]}>}
   *   결과는 입력 순서와 같다. **던지지 않는다.**
   */
  async function translate(segments, opts) {
    const o = opts || {};
    const list = (Array.isArray(segments) ? segments : []).map((s) => ({
      text: textOf(s), frag: s && (s.frag === 'head' || s.frag === 'tail') ? s.frag : null
    }));
    const kind = o.kind === AI.READALONG_KIND ? AI.READALONG_KIND : 'translate';
    const src = typeof o.src === 'string' ? o.src.trim() : '';
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    const skipAll = (status) => ({ status: status, calls: 0, results: list.map(() => ({ state: SEG.SKIPPED, code: status })) });

    if (!list.length) return skipAll(STATUS.EMPTY);
    if (src && src === target) return skipAll(STATUS.SAME_LANG);              // 7-1 원칙 5
    if (!langName(src) || !langName(target)) return skipAll(STATUS.UNSUPPORTED_LANG);   // 10-1

    const docId = String(o.docId == null ? '' : o.docId);
    const keys = await Promise.all(list.map((s) => keyFor(docId, s.text, target, kind)));
    const results = new Array(list.length).fill(null);   // ★ 구멍 배열이면 every() 가 빈칸을 건너뛴다

    // 1. 캐시
    let hits = new Map();
    try { hits = await cache.getMany(keys); } catch (e) { hits = new Map(); }
    for (let i = 0; i < list.length; i++) {
      const rec = hits.get(keys[i]);
      if (rec && typeof rec.result === 'string') results[i] = { state: SEG.READY, text: rec.result, cached: true };
    }
    if (results.every((r) => r)) {
      await bumpUsage({ cacheHits: 1 }, { db: db, now: now() });   // 호출 하나를 아꼈다
      return { status: current(), calls: 0, results: results };
    }

    // 2. 보냈다가 실패한 것은 사용자 [다시 시도] 전에는 다시 보내지 않는다.
    if (o.retry) for (let i = 0; i < list.length; i++) failedKeys.delete(keys[i]);

    // 3. 진행 중 공유 · 새로 보낼 것 — ★ 확인과 등록 사이에 await 가 없다(그래야 공유가 성립한다).
    const waits = new Map();       // 키 → Promise<결과>
    const fresh = [];
    for (let i = 0; i < list.length; i++) {
      if (results[i]) continue;
      const k = keys[i];
      if (waits.has(k)) continue;
      if (failedKeys.has(k)) { waits.set(k, Promise.resolve({ state: SEG.FAILED, code: failedKeys.get(k) })); continue; }
      if (inflight.has(k)) { waits.set(k, inflight.get(k)); continue; }
      let resolve;
      const p = new Promise((res) => { resolve = res; });
      inflight.set(k, p);
      waits.set(k, p);
      fresh.push({ key: k, text: list[i].text, frag: list[i].frag, resolve: resolve });
    }

    const ctx = {
      src: src, target: target, kind: kind, docId: docId, signal: o.signal || null, calls: 0,
      useOnDevice: getSetting('ai.useOnDevice') !== false
    };
    if (fresh.length) {
      let sent = new Map();
      try {
        sent = await sendAll(fresh, ctx);
      } catch (e) {
        sent = new Map();
      } finally {
        for (let i = 0; i < fresh.length; i++) {
          const f = fresh[i];
          f.resolve(sent.get(f.key) || { state: SEG.FAILED, code: FAIL.UNKNOWN });
          inflight.delete(f.key);
        }
        notify();
      }
    }

    for (let i = 0; i < list.length; i++) {
      if (results[i]) continue;
      const r = await waits.get(keys[i]);
      results[i] = Object.assign({}, r);
    }
    return { status: current(), calls: ctx.calls, results: results };
  }

  /* ── 사용자·환경이 상태를 바꾸는 길 ───────────────── */

  /**
   * 사용자의 [다시 시도](14-2 · 7-6). exhausted·cooldown·region·model 을 즉시 ready 로.
   * capped 는 상한을 다시 본다(상한을 올렸으면 풀린다). no-key 는 키가 있으면 풀린다.
   * 실패했던 문장은 `translate(…, {retry:true})` 로 따로 다시 보낸다.
   */
  async function retry() {
    if (base.name === STATES.EXHAUSTED || base.name === STATES.COOLDOWN ||
        base.name === STATES.REGION || base.name === STATES.MODEL) {
      cooldownLevel = 0;
      setBase(STATES.READY, 0, null);
    } else if (base.name === STATES.NO_KEY && String(getKey() || '').trim()) {
      setBase(STATES.READY, 0, null);
    }
    await gate();
    notify();
    return current();
  }

  /**
   * 설정이 바뀌었다. `'key'` — 키 저장(no-key 해제), `'model'` — 모델 변경(model 해제),
   * `'provider'` — 프로바이더 변경(region·model·no-key 해제).
   */
  function configChanged(what) {
    const w = String(what || '');
    const hasKey = !!String(getKey() || '').trim();
    if (base.name === STATES.NO_KEY && hasKey && (w === 'key' || w === 'provider')) setBase(STATES.READY, 0, null);
    else if (base.name === STATES.MODEL && (w === 'model' || w === 'provider')) setBase(STATES.READY, 0, null);
    else if (base.name === STATES.REGION && w === 'provider') setBase(STATES.READY, 0, null);
    notify();
    return current();
  }

  /** `online`·`offline` 이벤트. online 이면 이전 상태로 돌아간다(시간이 지난 것은 풀린 채로). */
  function setOnline(on) {
    offline = !on;
    notify();
    return current();
  }

  /* 7-6 — `online` 이벤트로 이전 상태 복귀. 브라우저에서만 붙는다(`deps.listen === false` 면 안 붙인다). */
  if (d.listen !== false && typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('online', () => setOnline(true));
    globalThis.addEventListener('offline', () => setOnline(false));
  }

  return {
    translate: translate,
    retry: retry,
    configChanged: configChanged,
    setOnline: setOnline,
    /** 지금 원격 상태 이름. */
    state: current,
    /** 상태가 바뀔 때마다 `{state, prev, until, code}`. 되돌림 함수를 준다. */
    onState: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    /** 이 키가 "보냈다가 실패"로 기억돼 있는가(테스트·8b 조회). */
    isFailed: (key) => failedKeys.has(key),
    _base: () => Object.assign({}, base)
  };
}
