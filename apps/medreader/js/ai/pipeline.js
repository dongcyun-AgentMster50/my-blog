/* ============================================================
   MedReader — 번역 파이프라인과 원격 상태 기계 (spec 7-1 · 7-5 · 7-6 · 8-1 · 10-2 · 15절)

   ── 서비스 계층이다(3-1 · 3-2) ──────────────────────────
   `config`·`db`·`settings`·`ai/provider`·`ai/prompts`·`ai/jsonrepair`·`ai/cache`·`ai/tokens`
   (`[11-4]` + 순수 `hash` — 설명 키의 문단 해시) 만 import 한다. **`ui/` 를 import 하지 않고, 문장을 나누지 않는다**(분할은 `tts/text.js`
   의 `Unit.src` 를 받기만 한다 — 7-8-2). 사용자에게 보일 문장을 만들지 않는다 — 상태 이름과
   코드만 낸다. 언어는 값으로만 다룬다(특정 언어 코드를 이 파일에 적지 않는다 — 16-D2 grep).

   ── 순서 (7-1 원칙 1) ───────────────────────────────────
     캐시 → (주입되면) 기기 내 번역 → 원격. 각 단계는 실패하면 조용히 다음으로.

   ── 원격 상태 (7-6) ─────────────────────────────────────
     ready | inflight | cooldown | exhausted | no-key | offline | capped | region | model
     - 429                 → exhausted(until = Retry-After 또는 다음 날 00:00). 자동 재시도 0.
                             `[다듬기 4 — 8c1R · 8c-2]` 본문(`error.details`)이 **분 한도**(`QuotaFailure` `quotaId` 에 `PerMinute`)면
                             cooldown(코드 `RATE_MINUTE`, until = `RetryInfo.retryDelay` · 없으면 Retry-After · 그것도 없으면 60초).
                             ★ 이 cooldown 은 시간이 지나도 **ready 로 돌아가지 않는다**(until 만 0 — "기다림 끝") — 돌아가면 낭독 창이
                             막힌 문장을 저절로 다시 보낸다(자동 재시도). 사용자 [다시 시도](`retry()`)만 푼다.
                             일 한도(`PerDay`)·꼴을 못 읽음 → 지금처럼 exhausted(보수). 판정은 어댑터 `rateLimitInfo`(본문 꼴은 실기기 확인 전).
     - 5xx                 → **즉시 1회만** 다시 보낸 뒤에도 5xx 면 cooldown(30s → 60s → 120s).
     - 네트워크 오류       → cooldown(즉시 재시도 없음). 기기가 오프라인이면 offline.
                             `[수정 2026-10-10 — 운영자 결정]` 응답 없이 실패한 문장은 **blocked**(`NETWORK`) —
                             cooldown 이 풀려 호출자가 다시 부르면 보낸다. 단 cooldown 3단계를 다 쓴 뒤의
                             네트워크 실패는 **failed** — 그 뒤는 사용자 [다시 시도]로만(무한 반복 없음).
     - 타임아웃 30초       → cooldown. `[수정 2026-10-10]` 네트워크 오류와 같다 — blocked(`TIMEOUT`), 단계·상한 공유.
     - 401/403·AUTH·키 없음 → no-key.
     - REGION              → region. 키 문제가 아니다 — 세션 동안 유지, [다시 시도]·프로바이더 변경으로 ready.
     - MODEL_UNAVAILABLE   → **model** `[8a 결정 — spec 7-6 에 없음]`. 시간이 지나도, 키를 다시 넣어도
                             풀리지 않는다. 모델·프로바이더를 바꾸거나 [다시 시도]하면 ready.
     - KEY_IN_URL          → **model**(코드 `KEY_IN_URL`) `[수정 2026-10-10]`. 보내기 전에 막혔다 — 요청 0,
                             usage 0. 네트워크 오류가 아니다. 모델·키·프로바이더를 고치거나 [다시 시도]하면 ready.
     - 일일 상한(`ai.dailyCap`, 검증 호출 제외)에 닿으면 capped. 날이 바뀌거나 상한을 올리면 ready.
     - `navigator.onLine === false` → offline. online 이 오면 이전 상태로.

   ── ★ "보내지 않은 것"과 "보냈다가 실패한 것" (7-6 `[신설 2026-09-28]`) ──
     blocked — 원격 상태가 ready 가 아니어서 **보내지 않았다**(429·키·지역·모델·오프라인으로 거절된
               것 포함 — 내용이 판정받지 않았다). 상태가 ready 로 돌아오면(`'state'` 이벤트) 호출자가
               다시 부르면 **보낸다.** 재시도가 아니라 첫 전송이다.
     failed  — 보냈고 실패했다(5xx 1회 재시도 뒤, cooldown 3단계를 다 쓴 뒤의 네트워크·타임아웃,
               파싱 실패, 밀림, SAFETY, 개수 누락, 응답을 받은 4xx).
               이 파이프라인이 키를 기억해 **다시 보내지 않는다.** `translate(…, {retry:true})`
               (사용자의 [다시 시도])만 다시 보낸다.

   ── 같은 키 동시 요청 (7-6) ──────────────────────────────
   진행 중인 캐시 키의 요청이 또 오면 **진행 중인 Promise 를 공유한다**(호출 1건).
   ============================================================ */

import { PIPELINE, AI, VOCAB, OUTLINE, EXPLAIN, REVIEW, DIAGRAM } from '../config.js';
import * as realProvider from './provider.js';
import { CODES, localDay, bumpUsage } from './provider.js';
import { parseAIJson } from './jsonrepair.js';
import {
  buildTranslateRequest, checkTranslation, TRANSLATE_SCHEMA, PROMPT_VERSION, langName, normalizeDomain,
  buildTermRequest, checkTerms, TERM_SCHEMA, TERM_PROMPT_VERSION,
  buildSummaryRequest, checkSummary, SUMMARY_SCHEMA, SUMMARY_PROMPT_VERSION,
  buildOutlineRequest, checkOutline, OUTLINE_SCHEMA, OUTLINE_PROMPT_VERSION, outlinePayload,
  buildExplainRequest, checkExplain, EXPLAIN_SCHEMA, EXPLAIN_PROMPT_VERSION,
  buildQuizRequest, QUIZ_PARSE_SCHEMA, QUIZ_PROMPT_VERSION,
  buildDiagramRequest, checkDiagramReply, diagramPayload, DIAGRAM_PARSE_SCHEMA, DIAGRAM_PROMPT_VERSION
} from './prompts.js';
// `[15-1 — spec 10-4 · 17-13 3-2]` 출제 응답 자체 검증(순수 — 3-2 표 `ai/prompts,jsonrepair,grounding` 열).
import { groundQuiz } from './grounding.js';
import { keyFor, defaultCache } from './cache.js';
// `[11-4 — 11-D20]` 설명 캐시 키의 `ctx=` 문단 해시 — 요약 저장 `textHash` 와 같은 함수(순수 `hash.js` — `cache.js` 가 이미 쓰는 것).
import { hashHex, normalizeForHash } from '../hash.js';
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
  NETWORK: 'NETWORK',     // 네트워크·CORS(구별 불가 — 8-3). `[수정 2026-10-10]` 3단계 전에는 blocked 의 코드, 다 쓴 뒤에는 failed 의 코드
  SAFETY: 'SAFETY',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN: 'UNKNOWN',
  // `[8f-1]` 단어 요청 검증(`checkTerms` — 그 항목만 실패)
  EMPTY: 'EMPTY',         // 번역이 비었다
  LONG: 'LONG',           // 번역이 200자를 넘는다
  LANG: 'LANG',           // 번역에 대상 언어 글자가 하나도 없다(다른 언어로 답함)
  // `[16-1]` 개념도 검증(`checkDiagram`) — 남은 관계가 2개 미만(캐시 0 · 실패 기억 → [다시 시도]·[다시 그리기]만)
  FEW_RELATIONS: 'FEW_RELATIONS'
});

/** 결과 전체의 상태(원격 상태 말고). `[11-1]` `too-big` — 범위 개요의 입력이 요지만으로도 요청 상한을 넘어 **보내지 않았다**(4-6). */
export const STATUS = Object.freeze({ SAME_LANG: 'same-lang', UNSUPPORTED_LANG: 'unsupported-lang', EMPTY: 'empty', TOO_BIG: 'too-big' });

/** `[11-1 — 17-2-1 4-2]` 요약·범위 개요의 사용량(`usage.byKind`)·캐시 `kind`. 9-2 의 고정 키(`AI.USAGE_KINDS`)다. */
export const SUMMARY_KIND = 'summarize';

/**
 * `[8f-1]` `skipped` 결과의 코드 — **한 번 부름 = 최대 1호출**인 job(단어 요청)에서 첫 묶음에 들지 못해
 * 이번에는 보내지 않은 항목. 호출자가 다시 부르면(사용자가 다시 누르면) 그때 보낸다(17-7-2 · 6절).
 */
export const MORE = 'MORE';

/**
 * `[8c-2 — 15절 · 17-7-6 4-7]` 상한 셈 한 벌 — 파이프라인(`overCap`·80% 경고)과 사용량 화면(`ui/usage.js`)이 같은 규칙을 쓴다.
 * `dailyCapOf` — `ai.dailyCap` 을 정수로, 1 미만·숫자 아님은 1(0 = 무제한 아님). `capUsedOf` — 그날 행의 호출 중 상한에 세는 것(검증 제외).
 * `warnThreshold` — `warnAt` 이 (0, 1) 숫자가 아니면(0·1 이상·문자열) null = 경고 없음. 아니면 `ceil(cap × warnAt)`(부동소수 꼬리 무시).
 */
export function dailyCapOf(v) {
  const cap = Math.floor(Number(v));
  return Number.isFinite(cap) && cap >= 1 ? cap : 1;
}
export function capUsedOf(row) {
  if (!row) return 0;
  const verify = (row.byKind && Number(row.byKind[AI.VERIFY_KIND])) || 0;
  return (Number(row.calls) || 0) - verify;
}
export function warnThreshold(cap, warnAt) {
  if (typeof warnAt !== 'number' || !(warnAt > 0) || !(warnAt < 1)) return null;
  return Math.max(1, Math.ceil(dailyCapOf(cap) * warnAt - 1e-9));
}

/**
 * `[다듬기 4]` 분 한도 cooldown 의 코드(원격 상태 `cooldown` 의 `code`). 이 코드의 cooldown 은 until 이 지나도 ready 로 돌아가지 않고
 * until 만 0 이 된다("기다림 끝 — [다시 시도]") — 화면이 띠·상태 바 문구를 고르는 데 쓴다(상태 이름은 그대로 `cooldown`).
 */
export const RATE_MINUTE = 'RATE_MINUTE';
/** 분 한도인데 다시 보낼 때를 못 읽었을 때의 기다림(초). */
export const RATE_MINUTE_DEFAULT_SEC = 60;

/**
 * `[다듬기 4]` 429 응답 본문을 들여다보는 `fetch` 감싸개 — 요청(주소·머리·본문)은 **그대로** 넘기고, 429 면 응답 사본(`clone()`)의 JSON 을
 * `box.json`(Promise)에 둔다. provider 가 원본 본문을 읽는다(사본이라 서로 막지 않는다). `clone` 이 없는 스텁 응답은 들여다보지 않는다
 * (그때 판정은 "못 읽음" → exhausted). 던지지 않는다 — 원래 fetch 의 거부는 그대로 거부.
 * @param {Function} base  원래 fetch
 * @param {{json?:Promise<*>}} box
 */
export function peekingFetch(base, box) {
  return function (url, init) {
    return Promise.resolve(base(url, init)).then((res) => {
      try {
        if (res && Number(res.status) === 429 && typeof res.clone === 'function') {
          box.json = res.clone().json().catch(() => null);
        }
      } catch (e) { /* 들여다보기 실패는 판정만 보수로 */ }
      return res;
    });
  };
}

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

/* ────────────────────────────────────────────────────────
   `[8f-1 — 17-7-6 4-3 · 8cf-D7]` **job** — 요청 만들기·응답 받기만 다르고 상태 기계·`gate`·5xx 1회·429·cooldown·
   no-key·region·상한·사용량·캐시·진행 중 공유·"보냈다가 실패" 기억은 **한 벌**(`runJob`)이다.
   job 의 모양:
     build(chunk, ctx)        → `CompletionRequest`|null      (chunk 항목 = 호출자가 준 항목 + `key`·`resolve`)
     schema                   → `parseAIJson` 미니 검증 스키마
     check(chunk, value, ctx) → {chunkFailed, items:[{state:'ok', value} | {state:'failed', code}]}
     accepts(result)          → 캐시 레코드의 `result` 를 그대로 쓸 수 있는가
     toResult(result)         → 결과 객체에 덧붙일 필드(번역 `{text}` · 그 밖 `{value}` — 문자열이 아닌 결과)
     promptVersion · size(item)(글자 상한 셈) · usageChars(chunk, ctx)(15절 글자 지표)
     ondevice(기기 내 번역을 거치는가) · maxItems(묶음 하나의 항목 상한, 0 = 없음) · maxChunks(한 번 부름의 호출 상한, 0 = 없음)
     tailOf(chunk, value)?    → `[11-1b]` 잘린 응답의 마지막 항목 번호(-1 = 없음) — 있으면 그 항목은 MISSING(요약·개요만 · 번역·단어는 없음)
   11 의 요약·개요·설명은 job 하나씩을 더해 `runJob` 을 부른다.
   ──────────────────────────────────────────────────────── */

function failCodeOf(reason) {
  return reason === 'ratio' ? FAIL.RATIO : reason === 'digits' ? FAIL.DIGITS
    : reason === 'empty' ? FAIL.EMPTY : reason === 'long' ? FAIL.LONG : reason === 'lang' ? FAIL.LANG : FAIL.MISSING;
}

/**
 * 번역 job — `translate()` 가 이것으로 `runJob` 을 부른다. ★ 요청은 일반화 **전과 바이트 단위 같다**
 * (`buildTranslateRequest(chunk, {src, target, domain})` 그대로 — `tests/term-8f.test.mjs` B1 이 HEAD `2570a94` 판이 낸 본문의 sha256 과 대조한다).
 */
export const TRANSLATE_JOB = Object.freeze({
  name: 'translate',
  build: (chunk, ctx) => buildTranslateRequest(chunk, { src: ctx.src, target: ctx.target, domain: ctx.domain }),
  schema: TRANSLATE_SCHEMA,
  check: (chunk, value) => {
    const chk = checkTranslation(chunk, value);
    return {
      chunkFailed: chk.chunkFailed,
      items: chk.items.map((it) => (it.state === 'ok'
        ? { state: 'ok', value: it.t }
        : { state: 'failed', code: failCodeOf(it.reason) }))
    };
  },
  accepts: (v) => typeof v === 'string',
  toResult: (v) => ({ text: v }),
  promptVersion: PROMPT_VERSION,
  size: (it) => charCount(it.text),
  // 15절 — 글자 지표는 낭독 동반 번역 호출만 센다.
  usageChars: (chunk, ctx) => (ctx.kind === AI.READALONG_KIND ? chunk.reduce((n, it) => n + charCount(it.text), 0) : 0),
  ondevice: true,
  maxItems: 0,
  maxChunks: 0
});

/**
 * `[8f-1]` 단어 job(`kind:'term'`, 17-7-2). 기기 내 번역은 쓰지 않는다(뜻·품사가 없다). 묶음 하나 ≤ `VOCAB.BATCH_MAX`(20)
 * 항목·누적 `ai.maxReqChars` 이하, **한 번 부름 = 최대 1호출**(나머지는 `skipped`·`MORE`).
 * 결과는 문자열이 아니다 — `{value:{translation, gloss, pos, lemma}}`.
 */
export const TERM_JOB = Object.freeze({
  name: AI.TERM_KIND,
  build: (chunk, ctx) => buildTermRequest(chunk, { src: ctx.src, target: ctx.target, domain: ctx.domain }),
  schema: TERM_SCHEMA,
  check: (chunk, value, ctx) => {
    const chk = checkTerms(chunk, value, ctx.target);
    return {
      chunkFailed: false,
      items: chk.items.map((it) => (it.state === 'ok'
        ? { state: 'ok', value: it.value }
        : { state: 'failed', code: failCodeOf(it.reason) }))
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && typeof v.translation === 'string' && v.translation.trim() !== '',
  toResult: (v) => ({ value: Object.assign({}, v) }),
  promptVersion: TERM_PROMPT_VERSION,
  size: (it) => charCount(it.term) + charCount(it.context),
  usageChars: () => 0,
  ondevice: false,
  maxItems: VOCAB.BATCH_MAX,
  maxChunks: 1
});

/** 깊은 사본(요약·개요 값은 배열이 겹친다 — 호출자가 고쳐도 캐시·다른 결과가 바뀌지 않게). */
function deepCopy(v) {
  return JSON.parse(JSON.stringify(v));
}

/**
 * `[11-1b — 11-1R #1]` 응답이 잘렸는가 — provider 가 올려 보낸 `finishReason: 'MAX_TOKENS'`(gemini 어댑터가 그대로 넘김)
 * 또는 `jsonrepair` 가 잘린 꼬리를 닫았다(`repairs` 에 `truncated`). `job.tailOf` 가 있는 job(요약·개요)만 묻는다.
 */
function cutShort(r, parsed) {
  return !!(r && r.finishReason === 'MAX_TOKENS') || (Array.isArray(parsed.repairs) && parsed.repairs.indexOf('truncated') >= 0);
}

/**
 * `[11-1b]` 잘린 응답 **원문**을 훑는다(문자열 안 괄호·이스케이프는 세지 않는다). `{items:[{…}]}` 꼴에서 깊이 3 의 `{` 가 항목 객체다.
 * @returns {{depth:number, open:boolean, openI:(number|undefined)}} `depth` = 끝에서 닫히지 않은 괄호 수(0 = 루트까지 닫힘) ·
 *   `open` = 열린 채 끝난 항목이 있다 · `openI` = 그 항목의 `i`(값이 끝난 것만 — `"i":12` 가 `"i":1` 로 잘린 것은 읽지 않는다),
 *   `i` 가 아예 없으면 -1(정수 `i` 가 없는 항목은 `checkSummary` 를 지나지 못한다 — 살아남을 수 없다), `i` 값이 잘렸으면 undefined(모름)
 *   (항목 안의 요점·용어 객체에는 `"i"` 키가 없다 · 글 안의 따옴표는 `\"` 라 `"i"` 로 읽히지 않는다)
 */
function scanCut(text) {
  const s = String(text == null ? '' : text);
  let depth = 0;
  let inStr = false;
  let esc = false;
  let start = -1;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') { depth++; if (ch === '{' && depth === 3) start = k; }
    else if (ch === '}' || ch === ']') { if (ch === '}' && depth === 3) start = -1; depth--; }
  }
  if (start < 0) return { depth: depth, open: false, openI: undefined };
  const rest = s.slice(start);
  const m = /"i"\s*:\s*(\d+)\s*[,}]/.exec(rest);
  if (m) return { depth: depth, open: true, openI: Number(m[1]) };
  return { depth: depth, open: true, openI: /"i"\s*:\s*\d+\s*$/.test(rest) ? undefined : -1 };
}

/**
 * `[11-1 — 17-2-1 4-1 · 4-2 · 11-D9]` 문단 요약 job(`kind:'summarize'`). 상태 기계는 번역과 **한 벌**(`runJob`).
 * 묶음 자르기는 번역과 같은 `chunksOf` — 누적 `ai.maxReqChars` 이하 · 요청(입력 + `maxOutputTokens` = 문단 × 700 + 200) ≤ 8,000 토큰.
 * 한 번 부름의 호출 상한은 없다([이 쪽 전체 요약]이 1–2호출 — 누르기 전에 `planSummary` 로 센다). 기기 내 경로 없음(11-D6).
 * 결과는 문자열이 아니다 — `{value:{gist, gistSrc?, points, terms}}`.
 */
export const SUMMARY_JOB = Object.freeze({
  name: SUMMARY_KIND,
  build: (chunk, ctx) => buildSummaryRequest(chunk, { src: ctx.src, target: ctx.target, domain: ctx.domain }),
  schema: SUMMARY_SCHEMA,
  check: (chunk, value, ctx) => {
    const chk = checkSummary(chunk, value, { withSrc: ctx.src !== ctx.target });
    return {
      chunkFailed: false,
      items: chk.items.map((it) => (it.state === 'ok'
        ? { state: 'ok', value: it.value }
        : { state: 'failed', code: failCodeOf(it.reason) }))
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && typeof v.gist === 'string' && v.gist.trim() !== '' &&
    Array.isArray(v.points) && Array.isArray(v.terms),
  toResult: (v) => ({ value: deepCopy(v) }),
  /**
   * `[11-1b — 11-1R #1]` 잘린 응답(`cutShort`)에서 **반쪽으로 살아난 마지막 항목**의 묶음 번호(없으면 -1) — `accept` 가 그 문단을
   * `failed(MISSING)` 로(캐시 0 · 실패 기억 → [다시 시도]). `jsonrepair` 가 요점·용어 경계에서 끊긴 문단을 온전한 항목처럼
   * 살리기 때문이다(요점 1개·용어 일부로 ready 되던 것).
   *   - 원문(`scanCut`)에서 마지막 항목이 닫혔으면(`notes` 안에서 잘림 등) 반쪽이 없다 → -1. 열린 항목에 `i` 가 없으면(`…},{"i` 처럼
   *     항목을 열자마자 잘림) 그 항목은 살아남지 못한다 → -1.
   *   - 열린 항목의 `i` 를 읽었는데 응답 값의 마지막 항목이 그 `i` 가 아니면 — 열린 항목은 `slice` 로 잘려 나갔고 남은 마지막은
   *     온전하다 → -1(요지 안에서 잘린 꼴 — 앞 문단을 버리지 않는다).
   *   - 그 밖(열린 항목이 값에 살아남음 · `i` 값이 잘려 모름 — 모르면 안전 쪽)은 값의 마지막 항목. 단 그 `i` 의 **첫** 항목일 때만
   *     (같은 `i` 두 번이면 `checkSummary` 가 앞의 것을 쓴다).
   */
  tailOf: (chunk, value, text) => {
    const cut = scanCut(text);
    if (!cut.open || cut.openI === -1) return -1;
    const arr = value && Array.isArray(value.items) ? value.items : [];
    const s = arr[arr.length - 1];
    if (!s || !Number.isInteger(s.i) || s.i < 0 || s.i >= chunk.length) return -1;
    if (cut.openI !== undefined && s.i !== cut.openI) return -1;
    return arr.findIndex((x) => x && x.i === s.i) === arr.length - 1 ? s.i : -1;
  },
  promptVersion: SUMMARY_PROMPT_VERSION,
  size: (it) => charCount(it.text),
  usageChars: () => 0,
  ondevice: false,
  maxItems: 0,
  maxChunks: 0
});

/**
 * `[11-1 — 17-2-1 4-6 · 11-D19]` 범위 개요 job. 항목은 늘 하나(저장한 요약 묶음), **한 번 부름 = 최대 1호출**.
 * 입력이 넘치면 `outline()` 이 보내기 전에 거른다(요지만 → 그래도 넘치면 `too-big`, 호출 0). 결과 `{value:{title, points}}`.
 */
export const OUTLINE_JOB = Object.freeze({
  name: OUTLINE.KEY_EXTRA,
  build: (chunk, ctx) => {
    const it = chunk[0] || {};
    return buildOutlineRequest(it.summaries, { target: ctx.target, domain: ctx.domain, label: it.label, points: it.points !== false });
  },
  schema: OUTLINE_SCHEMA,
  check: (chunk, value) => {
    const chk = checkOutline(chunk[0] && chunk[0].plain, value);
    return {
      chunkFailed: false,
      items: chk.items.map((it) => (it.state === 'ok'
        ? { state: 'ok', value: it.value }
        : { state: 'failed', code: failCodeOf(it.reason) }))
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && typeof v.title === 'string' && v.title.trim() !== '' &&
    Array.isArray(v.points) && v.points.length > 0,
  toResult: (v) => ({ value: deepCopy(v) }),
  /**
   * `[11-1b — 11-1R #1]` 항목은 늘 하나 — 잘린 응답이면 그 개요가 반쪽이다(`failed(MISSING)` · 캐시 0).
   * 원문이 루트까지 닫혔으면(`MAX_TOKENS` 라도 JSON 이 끝났다) 온전하다 → -1.
   */
  tailOf: (chunk, value, text) => (scanCut(text).depth <= 0 ? -1 : 0),
  promptVersion: OUTLINE_PROMPT_VERSION,
  size: (it) => it.size,
  usageChars: () => 0,
  ondevice: false,
  maxItems: 1,
  maxChunks: 1
});

/**
 * `[11-4 — 17-2-1 4-7 · 11-D9 · 11-D15]` 문장 설명 job(`kind:'explain'`). 항목은 늘 하나(`{sentence, context}` — context = 그 문단 글,
 * 맥락 창 1,500자는 `buildExplainRequest` 가 자른다), **한 번 부름 = 최대 1호출**. 상태 기계는 번역과 한 벌(`runJob`). 기기 내 없음.
 * 결과 `{value:{t, terms}}`.
 */
export const EXPLAIN_JOB = Object.freeze({
  name: AI.EXPLAIN_KIND,
  build: (chunk, ctx) => buildExplainRequest(chunk[0], { src: ctx.src, target: ctx.target, domain: ctx.domain }),
  schema: EXPLAIN_SCHEMA,
  check: (chunk, value) => {
    const chk = checkExplain(chunk[0], value);
    return {
      chunkFailed: false,
      items: chk.items.map((it) => (it.state === 'ok'
        ? { state: 'ok', value: it.value }
        : { state: 'failed', code: failCodeOf(it.reason) }))
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && typeof v.t === 'string' && v.t.trim() !== '' && Array.isArray(v.terms),
  toResult: (v) => ({ value: deepCopy(v) }),
  /**
   * `[11-4]` 11-1b `tailOf` 꼴을 개요처럼 따른다 — 항목이 하나라, 잘린 응답(`MAX_TOKENS`·`truncated`)의 JSON 이 루트까지 닫히지
   * 않았으면 그 설명은 반쪽일 수 있다(`t` 안에서 끊겨 `jsonrepair` 가 닫음) → `failed(MISSING)`(캐시 0 · [다시 시도]).
   * 600 토큰은 3문장·400자의 몇 배라, 넘쳤다는 것은 지시를 벗어난 긴 출력이다 — 반쪽을 보이지 않는다.
   */
  tailOf: (chunk, value, text) => (scanCut(text).depth <= 0 ? -1 : 0),
  promptVersion: EXPLAIN_PROMPT_VERSION,
  size: (it) => charCount(it.sentence) + charCount(it.context),
  usageChars: () => 0,
  ondevice: false,
  maxItems: 1,
  maxChunks: 1
});

/** `[15-1 — spec 17-13 3-2]` 출제의 사용량(`usage.byKind`)·캐시 `kind` — 9-2 고정 키(`AI.USAGE_KINDS` 의 `'quiz'` — 7a 빈 행 무변). */
export const QUIZ_KIND = 'quiz';

/**
 * `[15-1 — spec 10-4 · 17-13 3-2 · 15-D5]` 출제 job(`kind:'quiz'`). 항목은 늘 하나(`{items:[{paraId, pageNo, text}], n, size}` — 고른 문단 묶음),
 * **한 번 부름 = 최대 1호출**. 상태 기계·`gate`·5xx 1회·429·cooldown·상한·사용량·캐시·진행 중 공유·실패 기억은 번역과 한 벌(`runJob`).
 * 검증은 `groundQuiz`(10-4 자체 검증 1–5 + 숫자 거름) — 문항마다 verified/rejected 를 **값에 담아** 캐시한다(같은 입력이면 0회에
 * 같은 판정). 문항이 하나도 없으면 `failed(EMPTY)`(캐시 0 · 실패 기억 → [다시 시도]). 결과 `{value:{questions, total, verified, rejected, weak, fixed}}`.
 */
export const QUIZ_JOB = Object.freeze({
  name: QUIZ_KIND,
  build: (chunk, ctx) => {
    const it = chunk[0] || {};
    return buildQuizRequest(it.items, { src: ctx.src, target: ctx.target, domain: ctx.domain, n: it.n });
  },
  schema: QUIZ_PARSE_SCHEMA,
  check: (chunk, value, ctx) => {
    const it = chunk[0] || {};
    const g = groundQuiz(it.items, value, { withSrc: ctx.src !== ctx.target, n: it.n });
    return {
      chunkFailed: false,
      items: [g.total > 0 ? { state: 'ok', value: g } : { state: 'failed', code: FAIL.EMPTY }]
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && Array.isArray(v.questions) && v.questions.length > 0,
  toResult: (v) => ({ value: deepCopy(v) }),
  /** `[11-4]` 개요·설명과 같은 꼴 — 잘린 응답(JSON 이 루트까지 닫히지 않음)이면 마지막 문항이 반쪽일 수 있다 → `failed(MISSING)`(캐시 0 · [다시 시도]). */
  tailOf: (chunk, value, text) => (scanCut(text).depth <= 0 ? -1 : 0),
  promptVersion: QUIZ_PROMPT_VERSION,
  size: (it) => it.size,
  usageChars: () => 0,
  ondevice: false,
  maxItems: 1,
  maxChunks: 1
});

/**
 * `[16-1 — spec 17-14 2 · 16-D2 · 16-D3]` 그림 개념도 job(`kind:'diagram'`). 항목은 늘 하나(`diagramPayload` — 저장한 개요의 경로 꼬리표 줄 +
 * `src`), **한 번 부름 = 최대 1호출**. 상태 기계·`gate`·5xx 1회·429·cooldown·상한·사용량·캐시·진행 중 공유·실패 기억은 번역과 한 벌(`runJob`).
 * 검증은 `checkDiagramReply`(경로·관계 목록·숫자 거름·상한 12·16) — 남은 관계 < 2 → `failed(FEW_RELATIONS)`(캐시 0).
 * 결과 `{value:{title, nodes, edges}}`(배치는 저장하지 않는다 — 화면 폭·RTL 이 바뀌면 다시 계산, 호출 0).
 */
export const DIAGRAM_JOB = Object.freeze({
  name: AI.DIAGRAM_KIND,
  build: (chunk, ctx) => buildDiagramRequest(chunk[0], { target: ctx.target, src: (chunk[0] || {}).src, domain: ctx.domain }),
  schema: DIAGRAM_PARSE_SCHEMA,
  check: (chunk, value) => {
    const it = chunk[0] || {};
    const chk = checkDiagramReply(it, value, { withSrc: !!it.src && it.src !== it.target });
    return {
      chunkFailed: false,
      items: [chk.state === 'ok' ? { state: 'ok', value: chk.value } : { state: 'failed', code: FAIL.FEW_RELATIONS }]
    };
  },
  accepts: (v) => !!v && typeof v === 'object' && Array.isArray(v.nodes) && Array.isArray(v.edges) && v.edges.length >= DIAGRAM.MIN_EDGES,
  toResult: (v) => ({ value: deepCopy(v) }),
  /** 개요·설명·출제와 같은 꼴 — 잘린 응답(JSON 이 루트까지 닫히지 않음)이면 반쪽 그림 → `failed(MISSING)`(캐시 0 · [다시 시도]). */
  tailOf: (chunk, value, text) => (scanCut(text).depth <= 0 ? -1 : 0),
  promptVersion: DIAGRAM_PROMPT_VERSION,
  size: (it) => it.size,
  usageChars: () => 0,
  ondevice: false,
  maxItems: 1,
  maxChunks: 1
});

/**
 * `[11-4 — 11-D20]` 설명 캐시 키 —`keyFor(docId, 문장, target, 'explain', 'ctx=' + 문단 해시 앞 12자)`. 문단 해시는 요약 저장
 * `textHash` 와 같은 `hashHex(normalizeForHash(문단 글))` 의 `s256:`·`fnv:` 머리를 뗀 16진 앞 `EXPLAIN.CTX_HASH_CHARS` 자.
 * 같은 문장·같은 문단이면 같은 키(0회), 같은 문장이라도 문단이 다르면 다른 키("See Table 1" 같은 반복 문장).
 * `domain`·판본은 키에 없다(7-5).
 */
export async function explainKey(docId, sentence, para, target) {
  const h = await hashHex(normalizeForHash(String(para == null ? '' : para)));
  const hex = h.replace(/^[a-z0-9]+:/, '');
  return keyFor(String(docId == null ? '' : docId), String(sentence == null ? '' : sentence), String(target == null ? '' : target),
    AI.EXPLAIN_KIND, 'ctx=' + hex.slice(0, EXPLAIN.CTX_HASH_CHARS));
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
      // `[다듬기 4]` 분 한도 cooldown 은 기다림만 끝난다(until 0) — 상태는 그대로, 사용자 [다시 시도]만 ready 로(자동 재시도 0).
      base = base.name === STATES.COOLDOWN && base.code === RATE_MINUTE
        ? { name: STATES.COOLDOWN, until: 0, code: RATE_MINUTE, day: null }
        : { name: STATES.READY, until: 0, code: null, day: null };
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

  /**
   * `[다듬기 4 — 8c1R · 8c-2]` 429 → 분 한도면 cooldown(`RATE_MINUTE`), 아니면(일 한도·못 읽음) exhausted. 어느 쪽이든 그 묶음은 blocked.
   * 본문은 `peekingFetch` 가 둔 사본(`box.json`), 해석은 어댑터 `rateLimitInfo`(없으면 못 읽음). **다시 보내지 않는다.**
   * @returns {Promise<string>} 막힌 문장의 사유(상태 이름)
   */
  async function enterRateLimited(err, box) {
    let info = null;
    try {
      const json = box && box.json ? await box.json : null;
      const id = getSetting('ai.provider') || undefined;
      const adapter = json && typeof provider.getAdapter === 'function' ? provider.getAdapter(id) : null;
      info = adapter && typeof adapter.rateLimitInfo === 'function' ? adapter.rateLimitInfo(json) : null;
    } catch (e) { info = null; }
    if (info && info.scope === 'minute') {
      const fromHeader = Number.isFinite(err && err.retryAfter) && err.retryAfter > 0 ? err.retryAfter : 0;
      const sec = Number(info.retrySec) > 0 ? Number(info.retrySec) : (fromHeader || RATE_MINUTE_DEFAULT_SEC);
      setBase(STATES.COOLDOWN, now() + sec * 1000, RATE_MINUTE);
      return STATES.COOLDOWN;
    }
    enterExhausted(err && err.retryAfter);
    return STATES.EXHAUSTED;
  }

  /** 15절 — 오늘 쓴 호출(검증 제외)이 사용자의 상한에 닿았는가. 못 읽으면 막지 않는다. */
  async function overCap() {
    const cap = dailyCapOf(getSetting('ai.dailyCap'));      // 0 = 무제한 아님 → 최소 1(15절)
    let row = null;
    try { row = await db.get('usage', localDay(now())); } catch (e) { row = null; }
    if (!row) return false;
    return capUsedOf(row) >= cap;
  }

  /**
   * `[8c-2 — 17-7-6 4-7 · 8cf-D9]` **80% 경고** — 호출을 보낸 뒤(`ctx.calls++` 다음) `overCap` 과 같은 행·같은 셈으로
   * `(calls − verify) ≥ ceil(cap × warnAt)` 이고 그 행에 `capWarned` 가 없으면 구독자에게 **한 번** 알리고 그 행에 표시한다
   * (새로고침해도 하루 한 번 — 날이 바뀌면 새 행). 낭독·탭·단어 요청이 다 이 한 곳을 지난다. 구독자가 없으면 읽지도 쓰지도 않는다.
   * ★ 요청·오류 판정·상태 전이와 무관하다(보낸 뒤에 사용량 행만 본다). 던지지 않는다.
   */
  const warnListeners = new Set();
  let warnedDay = null;                 // 같은 파이프라인 안 동시 두 호출이 둘 다 알리지 않게(확인과 표시 사이 await 없음)
  async function checkWarn() {
    if (!warnListeners.size) return;
    // `[8c-2b]` 시계는 한 번만 읽는다 — 행 읽기·표시 쓰기 사이에 자정이 지나도 표시는 읽은 그날 행에(8c2R #1).
    const t = now();
    const day = localDay(t);
    const cap = dailyCapOf(getSetting('ai.dailyCap'));
    const warnAt = getSetting('ai.warnAt');
    const at = warnThreshold(cap, warnAt);
    if (at === null || warnedDay === day) return;
    let row = null;
    try { row = await db.get('usage', day); } catch (e) { row = null; }
    if (!row || warnedDay === day) return;
    if (row.capWarned === true) { warnedDay = day; return; }
    const used = capUsedOf(row);
    if (used < at) return;
    warnedDay = day;
    const ev = { used: used, cap: cap, warnAt: warnAt, day: day };
    // 듣는 쪽 오류가 파이프라인을 멈추지 않는다 — 비동기 구독자의 거절도 여기서 삼킨다(기다리지 않음, 8c2R #3).
    warnListeners.forEach((fn) => { try { Promise.resolve(fn(ev)).catch(() => {}); } catch (e) { /* 동기 예외 */ } });
    await bumpUsage({ capWarned: true }, { db: db, now: t });
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

  /**
   * 문장 경계에서 누적 글자 상한·토큰 상한 이하로 자른다. 상한보다 긴 한 문장은 혼자 간다.
   * `[8f-1]` job 의 `size`·`build` 로 센다(번역은 `charCount(text)`·`buildTranslateRequest` — 그대로).
   * `job.maxItems` 가 있으면 묶음 하나의 항목 수도 그 이하(단어 20).
   */
  function chunksOf(items, ctx, job) {
    const max = maxChars();
    const out = [];
    let cur = [];
    let sum = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const len = job.size(it);
      const next = cur.concat([it]);
      const tooMany = cur.length > 0 && ((job.maxItems > 0 && cur.length >= job.maxItems) || sum + len > max ||
        exceedsRequestBudget(job.build(next, ctx) || {}));
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
  async function sendChunk(chunk, ctx, job) {
    const req = job.build(chunk, ctx);
    const chars = job.usageChars(chunk, ctx);
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
      // `[다듬기 4]` 429 본문 사본 자리(이 시도 하나 몫 — 동시 요청끼리 섞이지 않는다). 요청 바이트는 그대로(감싸개는 넘기기만).
      const peek = {};
      try {
        const model = String(getSetting('ai.model') || '').trim();
        const baseFetch = typeof d.fetch === 'function' ? d.fetch
          : (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
        r = await provider.complete(req, {
          key: String(getKey() || '').trim(),
          provider: getSetting('ai.provider') || undefined,
          model: model || undefined,
          signal: ac ? ac.signal : undefined,
          fetch: baseFetch ? peekingFetch(baseFetch, peek) : undefined,
          db: db,
          now: now(),
          kind: ctx.kind,
          // 15절 — 글자 지표는 낭독 동반 번역 호출만 센다(job 의 `usageChars` — 번역 job 이 그 판정을 한다).
          chars: chars
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
        return accept(chunk, r, ctx, job);
      }

      // `[수정 2026-10-10 — 오케스트레이터 결정]` 타임아웃도 응답을 못 받은 것 — 네트워크 오류와 같은 규칙·같은 상한.
      if (timedOut) return noResponseFail(FAIL.TIMEOUT);
      const code = (err && err.code) || CODES.UNKNOWN;
      switch (code) {
        case CODES.SERVER:
          if (attempt < PIPELINE.SERVER_RETRIES) { notify(); continue; }   // ★ 즉시 1회만
          enterCooldown(CODES.SERVER);
          return all(SEG.FAILED, FAIL.SERVER);
        case CODES.RATE_LIMIT:
          // `[다듬기 4]` 분 한도 → cooldown(RATE_MINUTE) · 일 한도·못 읽음 → exhausted. 자동 재시도 0.
          return all(SEG.BLOCKED, await enterRateLimited(err, peek));
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
        case CODES.KEY_IN_URL: {
          // `[수정 2026-10-10]` 보내기 전에 막혔다(모델 칸에 키). 요청 0 — provider 가 usage 도 세지 않았다.
          // 네트워크 오류가 아니므로 cooldown 이 아니라, 설정을 고쳐야 풀리는 model 상태(코드로 구별).
          setBase(STATES.MODEL, 0, CODES.KEY_IN_URL);
          const outs = all(SEG.BLOCKED, STATES.MODEL);
          outs.notSent = true;
          return outs;
        }
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
        default: {
          if (!isOnline()) { offline = true; notify(); return all(SEG.BLOCKED, STATES.OFFLINE); }
          // `[수정 2026-10-10 — 운영자 결정]` 응답 없이 실패(fetch 거부 — 네트워크·CORS 구별 불가)는 blocked.
          if (err && err.noResponse) return noResponseFail(FAIL.NETWORK);
          // 응답을 받고 실패한 것(분류 못 한 4xx·본문 해석 실패 등)은 계속 failed.
          enterCooldown(code);
          return all(SEG.FAILED, FAIL.UNKNOWN);
        }
      }
    }

    /**
     * `[수정 2026-10-10]` **응답을 못 받은 실패**(네트워크·타임아웃) 한 벌. 내용이 판정받지 않았다 →
     * blocked(사유 `NETWORK`|`TIMEOUT`). cooldown 이 풀리면 호출자의 다음 refill 이 다시 보낸다.
     * ★ 3단계(30→60→120초)를 이미 다 썼으면 failed — 그 뒤는 사용자 [다시 시도]로만.
     *   단계(`cooldownLevel`)는 **두 사유가 함께 쓴다** — 번갈아 나도 상한(1 + 3단계)을 넘지 않는다.
     *   성공하면 0, [다시 시도]면 0 으로 돌아간다.
     */
    function noResponseFail(reason) {
      const stepsLeft = cooldownLevel < PIPELINE.COOLDOWN_STEPS_MS.length;
      enterCooldown(reason);
      return all(stepsLeft ? SEG.BLOCKED : SEG.FAILED, reason);
    }
  }

  /** 2xx 응답 → 10-6 파싱 → job 의 검증(번역 10-2 · 단어 17-7-2) → 캐시. */
  async function accept(chunk, r, ctx, job) {
    const parsed = parseAIJson(r && r.text, job.schema);
    if (!parsed.ok) {
      await bumpUsage({ errors: 1 }, { db: db, now: now() });
      return chunk.map(() => ({ state: SEG.FAILED, code: FAIL.PARSE }));
    }
    const chk = job.check(chunk, parsed.value, ctx);
    if (chk.chunkFailed) {
      await bumpUsage({ errors: 1 }, { db: db, now: now() });
      return chunk.map(() => ({ state: SEG.FAILED, code: FAIL.SHIFT }));
    }
    // `[11-1b — 11-1R #1]` 잘린 응답의 마지막 항목은 반쪽일 수 있다 — `tailOf` 가 있는 job(요약·개요)만 그 항목을 MISSING 으로.
    // 번역·단어 job 은 `tailOf` 가 없어 -1(이 갈래를 지나지 않는다 — 요청·결과 바이트 그대로).
    const tail = typeof job.tailOf === 'function' && cutShort(r, parsed) ? job.tailOf(chunk, parsed.value, r && r.text) : -1;
    const out = [];
    const entries = [];
    for (let i = 0; i < chunk.length; i++) {
      const it = i === tail ? { state: 'failed', code: FAIL.MISSING } : chk.items[i];
      if (it.state === 'ok') {
        out.push(Object.assign({ state: SEG.READY }, job.toResult(it.value)));
        entries.push({
          key: chunk[i].key, docId: ctx.docId, kind: ctx.kind, targetLang: ctx.target, result: it.value,
          provider: r.provider, model: r.model, promptVersion: job.promptVersion, repaired: !!parsed.repaired,
          domain: ctx.domain              // `[다듬기 2 — 8pR-9 ①]` 진단용 — 캐시 **값**에만(키 불변 · 7-5)
        });
      } else {
        out.push({ state: SEG.FAILED, code: it.code });
      }
    }
    if (entries.length) {
      try { await cache.putMany(entries); } catch (e) { /* 캐시 실패는 번역을 버리지 않는다 */ }
    }
    return out;
  }

  /* ── 보내기 묶음 ───────────────────────────────────── */

  /** 새로 보낼 항목들(키가 겹치지 않음)을 기기 내 → 원격 순으로 처리한다. 키 → 결과. */
  async function sendAll(items, ctx, job) {
    const result = new Map();

    // `[8m]` 문서 언어와 다른 언어의 항목(`src`)은 기기 내 번역(언어 쌍 하나)에 넣지 않는다 — 원격으로만.
    // `[8f-1]` 기기 내 번역은 번역 job 만(`job.ondevice`) — 단어 요청은 뜻·품사가 필요하다.
    const odItems = job.ondevice ? items.filter((it) => !it.src) : [];
    if (ondevice && ctx.useOnDevice && odItems.length) {
      let out = null;
      try { out = await ondevice(odItems.map((it) => it.text), ctx.src, ctx.target); } catch (e) { out = null; }
      if (Array.isArray(out) && out.length === odItems.length && out.every((x) => typeof x === 'string' && x.trim())) {
        const entries = [];
        for (let i = 0; i < odItems.length; i++) {
          result.set(odItems[i].key, { state: SEG.READY, text: out[i].trim(), ondevice: true });
          entries.push({
            key: odItems[i].key, docId: ctx.docId, kind: ctx.kind, targetLang: ctx.target, result: out[i].trim(),
            provider: 'ondevice', model: null, promptVersion: job.promptVersion,
            domain: ctx.domain            // `[다듬기 2]` 진단용 — 값에만(기기 내 번역은 문체를 쓰지 않지만 그때 문서 문체를 남긴다)
          });
        }
        try { await cache.putMany(entries); } catch (e) { /* 무시 */ }
        await bumpUsage({ ondeviceHits: 1 }, { db: db, now: now() });
        if (odItems.length === items.length) return result;
        items = items.filter((it) => !result.has(it.key));
      }
    }

    const chunks = chunksOf(items, ctx, job);
    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      let outs;
      if (job.maxChunks > 0 && c >= job.maxChunks) {
        // `[8f-1]` 한 번 부름 = 최대 `maxChunks` 호출(단어 1) — 나머지는 이번에 보내지 않는다(다시 부르면 보낸다).
        outs = chunk.map(() => ({ state: SEG.SKIPPED, code: MORE }));
      } else {
        const g = await gate();
        if (g !== STATES.READY) {
          outs = chunk.map(() => ({ state: SEG.BLOCKED, code: g }));   // 보내지 않은 것
        } else {
          outs = await sendChunk(chunk, ctx, job);
          if (!outs.notSent) { ctx.calls++; await checkWarn(); }   // KEY_IN_URL — 보내기 전에 막혔다(호출 0) · `[8c-2]` 80% 경고
        }
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
   *          retry?:boolean, signal?:AbortSignal, domain?:string}} opts
   *   `retry` — 사용자의 [다시 시도]. 이 문장들의 "보냈다가 실패" 기록을 지우고 다시 보낸다.
   *   `[8p]` `domain` — 문서의 번역 문체. 지시문에만 들어간다(**캐시 키에는 넣지 않는다** — L-D9 (가), 7-5).
   *   진행 중인 같은 키의 요청은 그대로 공유한다(떠 있는 요청은 옛 문체 그대로 — 다음 요청부터).
   * @returns {Promise<{status:string, calls:number,
   *           results:{state:'ready'|'failed'|'blocked'|'skipped', text?:string, code?:string, cached?:boolean}[]}>}
   *   결과는 입력 순서와 같다. **던지지 않는다.**
   */
  async function translate(segments, opts) {
    const o = opts || {};
    const list = (Array.isArray(segments) ? segments : []).map((s) => ({
      text: textOf(s), frag: s && (s.frag === 'head' || s.frag === 'tail') ? s.frag : null,
      // `[8m — spec 19-1-2 2-4]` 항목의 원문 언어 — 문서 언어(`opts.src`)와 다르고 지시문에 이름이 있을 때만
      src: s && typeof s.src === 'string' && s.src && langName(s.src) ? s.src : null
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
    // `[8m]` 항목 `src` 는 문서 언어와 다를 때만 요청에 실린다(일반화 전 `fresh.push` 의 판정 그대로).
    const items = list.map((s) => ({ text: s.text, frag: s.frag, src: s.src && s.src !== src ? s.src : null }));
    return runJob(TRANSLATE_JOB, items, keys, {
      src: src, target: target, kind: kind, docId: docId, signal: o.signal, retry: o.retry, domain: o.domain
    });
  }

  /**
   * `[8f-1 — 17-7-6 4-3 · 8cf-D7]` **job 하나를 상태 기계 한 벌로 돌린다.** 번역(`translate`)·단어(`translateTerms`)가
   * 이 함수 하나를 탄다 — 11 의 요약·개요·설명도 job 을 더해 이것을 부른다. **던지지 않는다.**
   *
   * 순서: 캐시(`force` 면 건너뜀) → "보냈다가 실패" 기억(`retry`·`force` 면 지움) → 진행 중 공유 → 기기 내(job 이 허락할 때) →
   * 원격(`gate` → `sendChunk` → `accept`). 결과는 입력 순서, 준비된 것은 `{state:'ready', …job.toResult(값)}`
   * (번역 `text` · 그 밖 `value` — **문자열이 아닌 결과**도 그대로).
   *
   * @param {Object} job       위 job 모양(`TRANSLATE_JOB`·`TERM_JOB` 또는 호출자의 것)
   * @param {Object[]} list    job 의 항목(`build`·`size` 가 읽는다)
   * @param {string[]} keys    항목마다 캐시 키(7-5 — 호출자가 만든다)
   * @param {{src:string, target:string, kind:string, docId:string, domain?:string,
   *          signal?:AbortSignal, retry?:boolean, force?:boolean}} o
   *   `kind` — 사용량(`usage.byKind`)과 캐시 값의 종류. `force` — 캐시 읽기를 건너뛰고 새로 받아 덮어쓴다(7-5 "다시 생성").
   * @returns {Promise<{status:string, calls:number, results:Object[]}>}
   */
  async function runJob(job, list, keys, opts) {
    // `[11-1 — crossstep 8f1R]` 넷째 인자 없이 불러도 TypeError 가 나지 않게(기본 `{}`).
    const o = opts || {};
    const results = new Array(list.length).fill(null);   // ★ 구멍 배열이면 every() 가 빈칸을 건너뛴다

    // 1. 캐시
    if (!o.force) {
      let hits = new Map();
      try { hits = await cache.getMany(keys); } catch (e) { hits = new Map(); }
      for (let i = 0; i < list.length; i++) {
        const rec = hits.get(keys[i]);
        if (rec && job.accepts(rec.result)) results[i] = Object.assign({ state: SEG.READY }, job.toResult(rec.result), { cached: true });
      }
      if (results.every((r) => r)) {
        await bumpUsage({ cacheHits: 1 }, { db: db, now: now() });   // 호출 하나를 아꼈다
        return { status: current(), calls: 0, results: results };
      }
    }

    // 2. 보냈다가 실패한 것은 사용자 [다시 시도] 전에는 다시 보내지 않는다. (`force` 도 사용자가 부른 것이다.)
    if (o.retry || o.force) for (let i = 0; i < list.length; i++) failedKeys.delete(keys[i]);

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
      fresh.push(Object.assign({ key: k }, list[i], { resolve: resolve }));
    }

    const ctx = {
      src: o.src, target: o.target, kind: o.kind, docId: o.docId, signal: o.signal || null, calls: 0,
      domain: normalizeDomain(o.domain),
      useOnDevice: !!job.ondevice && getSetting('ai.useOnDevice') !== false
    };
    if (fresh.length) {
      let sent = new Map();
      try {
        sent = await sendAll(fresh, ctx, job);
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

  /**
   * `[8f-1 — 17-7-2 3 · 17-7-6 4-3]` 단어 요청 `translateTerms(items, {src, target, docId, domain, force, retry, signal})`.
   * 사용자가 [AI 로 번역]·[이 문맥으로 다시 번역]·[번역 안 된 것 모두 번역]을 누를 때만 부른다(17절 머리 — 호출 0 먼저).
   *
   * - 상태 기계·`gate`·5xx 1회·429·cooldown·no-key·capped·사용량(`byKind.term`)은 번역과 **같은 한 벌**(`runJob`).
   * - **키** `keyFor(docId, context, target, 'term', 'w=' + term)` — 문맥은 해시, 낱말은 `extra` 로 그대로.
   *   17-7-2 의 `term + '\n' + context` 는 `normalizeForHash` 가 `'\n'` 을 공백으로 접어 경계가 사라진다(8f-1 정정).
   * - 한 번 부름 = **최대 1호출**(≤ 20개·누적 `ai.maxReqChars`) — 넘친 항목은 `skipped`·`MORE`.
   * - 낱말의 원문 언어가 대상 언어와 같으면 그 항목만 `skipped`·`same-lang`, 낱말이 비면 `skipped`·`empty`.
   * - ★ 보내는 것은 항목의 `term`(·`surface`)·`context`·`src` 뿐 — 항목에 사용자 번역·메모가 있어도 옮겨 담지 않는다(13절).
   *
   * @param {{term:string, surface?:string, context:string, src?:string}[]} items `term` = `normalizeTerm` 결과(호출자)
   * @returns {Promise<{status:string, calls:number,
   *           results:{state:string, value?:{translation:string, gloss:string, pos:string, lemma:string}, code?:string, cached?:boolean}[]}>}
   */
  async function translateTerms(items, opts) {
    const o = opts || {};
    const src = typeof o.src === 'string' ? o.src.trim() : '';
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    const list = (Array.isArray(items) ? items : []).map((it) => {
      const x = it || {};
      return {
        term: String(x.term == null ? '' : x.term).trim(),
        surface: typeof x.surface === 'string' && x.surface.trim() ? x.surface.trim() : null,
        context: String(x.context == null ? '' : x.context),
        src: typeof x.src === 'string' && x.src && langName(x.src) ? x.src : null
      };
    });
    const results = list.map(() => null);
    const skip = (status) => ({ state: SEG.SKIPPED, code: status });
    if (!list.length) return { status: STATUS.EMPTY, calls: 0, results: [] };
    if (!langName(src) || !langName(target)) return { status: STATUS.UNSUPPORTED_LANG, calls: 0, results: list.map(() => skip(STATUS.UNSUPPORTED_LANG)) };

    const docId = String(o.docId == null ? '' : o.docId);
    const send = [];
    const at = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (!it.term) { results[i] = skip(STATUS.EMPTY); continue; }
      if ((it.src || src) === target) { results[i] = skip(STATUS.SAME_LANG); continue; }   // 7-1 원칙 5
      send.push({ term: it.term, surface: it.surface, context: it.context, src: it.src && it.src !== src ? it.src : null });
      at.push(i);
    }
    if (!send.length) {
      const same = results.every((r) => r.code === STATUS.SAME_LANG);
      return { status: same ? STATUS.SAME_LANG : STATUS.EMPTY, calls: 0, results: results };
    }
    const keys = await Promise.all(send.map((s) => keyFor(docId, s.context, target, AI.TERM_KIND, 'w=' + s.term)));
    const out = await runJob(TERM_JOB, send, keys, {
      src: src, target: target, kind: AI.TERM_KIND, docId: docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
    for (let k = 0; k < at.length; k++) results[at[k]] = out.results[k];
    return { status: out.status, calls: out.calls, results: results };
  }

  /* ── `[11-1 — spec 17-2-1 4-2]` 문단 요약 · 범위 개요 ── */

  /**
   * 요약 요청 준비 — 언어·키·보낼 항목. 언어 = **대상 언어 + 문서 원문 언어**(같으면 하나 — 11-D4, `ai.summaryLangs` 는 읽지 않는다).
   * ★ 같은 언어도 요약한다(번역의 `same-lang` 건너뛰기를 쓰지 않는다). 언어 이름이 없으면 `unsupported-lang`.
   * 키 `keyFor(docId, 문단 글, target, 'summarize', 'l=' + langs.join('+'))` — `domain`·판본은 키에 없다(7-5).
   */
  async function summaryPrep(paras, o) {
    const src = typeof o.src === 'string' ? o.src.trim() : '';
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    // ★ 항목에서 문단 글(`text`)만 읽는다 — 저장 요약의 메모·책 제목·쪽은 항목에 있어도 옮겨 담지 않는다(4-2 "보내는 것").
    const list = (Array.isArray(paras) ? paras : []).map((p) => ({ text: textOf(p).trim() }));
    const skip = (status) => ({ state: SEG.SKIPPED, code: status });
    if (!list.length) return { done: { status: STATUS.EMPTY, calls: 0, results: [] } };
    if (!langName(src) || !langName(target)) {
      return { done: { status: STATUS.UNSUPPORTED_LANG, calls: 0, results: list.map(() => skip(STATUS.UNSUPPORTED_LANG)) } };
    }
    const langs = src === target ? [target] : [target, src];
    const docId = String(o.docId == null ? '' : o.docId);
    const results = list.map((it) => (it.text ? null : skip(STATUS.EMPTY)));
    const send = [];
    const at = [];
    for (let i = 0; i < list.length; i++) if (!results[i]) { send.push(list[i]); at.push(i); }
    if (!send.length) return { done: { status: STATUS.EMPTY, calls: 0, results: results } };
    const keys = await Promise.all(send.map((s) => keyFor(docId, s.text, target, SUMMARY_KIND, 'l=' + langs.join('+'))));
    return { src: src, target: target, docId: docId, langs: langs, results: results, send: send, at: at, keys: keys };
  }

  /**
   * `pipeline.summarize(paras, {src, target, docId, domain, force, retry, signal})` → `{status, calls, results[], langs}`
   * (입력 순서, **던지지 않는다**). 결과 `{state:'ready', value:{gist, gistSrc?, points, terms}, cached?}` · `failed`(`DIGITS`·
   * `EMPTY`·`MISSING`·`PARSE`…) · `blocked`(보내지 않음) · `skipped`(빈 글·언어 없음).
   * 상태 기계·`gate`(오프라인·상한·키)·5xx 1회·429·cooldown·진행 중 공유·실패 기억·사용량(`byKind.summarize`)은 번역과 한 벌.
   * `force` = [다시 요약] — 캐시 읽기를 건너뛰고 덮어쓴다. `retry` = [다시 시도].
   * @param {({text:string}|string)[]} paras `paraTextsOf` 의 문단 글
   */
  async function summarize(paras, opts) {
    const o = opts || {};
    const prep = await summaryPrep(paras, o);
    if (prep.done) return prep.done;
    const out = await runJob(SUMMARY_JOB, prep.send, prep.keys, {
      src: prep.src, target: prep.target, kind: SUMMARY_KIND, docId: prep.docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
    const results = prep.results.slice();
    for (let k = 0; k < prep.at.length; k++) results[prep.at[k]] = out.results[k];
    return { status: out.status, calls: out.calls, results: results, langs: prep.langs.slice() };
  }

  /**
   * [이 쪽 전체 요약 (문단 n · 호출 k)] 의 k — **보내지 않고** 센다. `summarize` 가 실제로 쓰는 것과 같은 키·같은 캐시 읽기·
   * 같은 자르기(`chunksOf` + `SUMMARY_JOB`)로. 캐시에 있는 문단, 진행 중인 문단, "보냈다가 실패"로 기억된 문단(`retry`·`force` 가 아니면)은
   * 세지 않는다. 원격 상태가 막혀 있으면 실제 호출은 0 일 수 있다(k 는 ready 일 때의 수).
   * @returns {Promise<{calls:number, fresh:number, cached:number}>}
   */
  async function planSummary(paras, opts) {
    const o = opts || {};
    const prep = await summaryPrep(paras, o);
    if (prep.done) return { calls: 0, fresh: 0, cached: 0 };
    let hits = new Map();
    if (!o.force) { try { hits = await cache.getMany(prep.keys); } catch (e) { hits = new Map(); } }
    const seen = new Set();
    const fresh = [];
    let cached = 0;
    for (let i = 0; i < prep.send.length; i++) {
      const k = prep.keys[i];
      if (seen.has(k)) continue;
      seen.add(k);
      const rec = hits.get(k);
      if (rec && SUMMARY_JOB.accepts(rec.result)) { cached++; continue; }
      if (failedKeys.has(k) && !o.retry && !o.force) continue;
      if (inflight.has(k)) continue;
      fresh.push(Object.assign({ key: k }, prep.send[i]));
    }
    const ctx = { src: prep.src, target: prep.target, domain: normalizeDomain(o.domain) };
    return { calls: fresh.length ? chunksOf(fresh, ctx, SUMMARY_JOB).length : 0, fresh: fresh.length, cached: cached };
  }

  /**
   * `[11-1 — 17-2-1 4-6 · 11-D19]` 범위 개요 `pipeline.outline(summaries, {target, docId, domain, label, force, retry, signal})`.
   * 입력 = **저장한 요약**(요지 + 요점, 대상 언어 — 원문을 다시 보내지 않는다). 넘치면(`ai.maxReqChars` 또는 요청 토큰 상한)
   * 요점을 빼고 요지만 → 그래도 넘치면 **보내지 않고** `{status:'too-big', calls:0, n, chars}`. 한 번 누름 = 최대 1호출.
   * 키 `keyFor(docId, 입력 글, target, 'summarize', 'outline')` — 같은 범위·같은 요약이면 0회. 사용량 `byKind.summarize`.
   * @returns {Promise<{status:string, calls:number, results:Object[], input?:'points'|'gist', n?:number, chars?:number}>} 던지지 않는다
   */
  async function outline(summaries, opts) {
    const o = opts || {};
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    const list = (Array.isArray(summaries) ? summaries : []).filter((r) => r && typeof r.gist === 'string' && r.gist.trim());
    const skip = (status, extra) => Object.assign({ status: status, calls: 0, results: [{ state: SEG.SKIPPED, code: status }] }, extra || {});
    if (!list.length) return skip(STATUS.EMPTY);
    if (!langName(target)) return skip(STATUS.UNSUPPORTED_LANG);
    const ctx = { src: target, target: target, domain: normalizeDomain(o.domain) };
    let pick = null;
    let last = null;
    for (const withPoints of [true, false]) {
      const input = outlinePayload(list, { points: withPoints });
      const item = { text: input.text, plain: input.plain, size: input.size, summaries: list, label: o.label, points: withPoints };
      last = item;
      const req = OUTLINE_JOB.build([item], ctx);
      if (req && item.size <= maxChars() && !exceedsRequestBudget(req)) { pick = item; break; }
    }
    if (!pick) return skip(STATUS.TOO_BIG, { n: list.length, chars: last ? last.size : 0 });
    const docId = String(o.docId == null ? '' : o.docId);
    const key = await keyFor(docId, pick.text, target, SUMMARY_KIND, OUTLINE.KEY_EXTRA);
    const out = await runJob(OUTLINE_JOB, [pick], [key], {
      src: target, target: target, kind: SUMMARY_KIND, docId: docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
    return Object.assign(out, { input: pick.points ? 'points' : 'gist', n: list.length });
  }

  /**
   * `[11-4 — spec 17-2-1 4-7 · 11-D15 · 11-D20]` 문장 설명 `pipeline.explain({sentence, context}, {src, target, docId, domain, force, retry, signal})`.
   * `sentence` = 대상 문장(`Unit.src`), `context` = 그 문단 글(`paraTextsOf` — 없으면 문장만). **같은 언어도 설명한다**(쉬운 말 풀이 — 4-7).
   * 언어 이름이 없으면 `unsupported-lang`, 문장이 비면 `empty`(호출 0). 키 = `explainKey`(같은 문장·같은 문단이면 0회).
   * 상태 기계·`gate`·5xx 1회·429·cooldown·진행 중 공유·실패 기억·사용량(`byKind.explain`)·상한은 번역과 한 벌.
   * ★ 보내는 것은 문장과 그 문단 글뿐(항목의 다른 필드는 옮겨 담지 않는다).
   * @returns {Promise<{status:string, calls:number, results:[{state:string, value?:{t:string, terms:Array}, code?:string, cached?:boolean}]}>}
   *   던지지 않는다
   */
  async function explain(item, opts) {
    const o = opts || {};
    const x = item || {};
    const src = typeof o.src === 'string' ? o.src.trim() : '';
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    const sentence = String(x.sentence == null ? '' : x.sentence).trim();
    const context = String(x.context == null ? '' : x.context).trim() || sentence;
    const skip = (status) => ({ status: status, calls: 0, results: [{ state: SEG.SKIPPED, code: status }] });
    if (!sentence) return skip(STATUS.EMPTY);
    if (!langName(src) || !langName(target)) return skip(STATUS.UNSUPPORTED_LANG);
    const docId = String(o.docId == null ? '' : o.docId);
    const key = await explainKey(docId, sentence, context, target);
    return runJob(EXPLAIN_JOB, [{ sentence: sentence, context: context }], [key], {
      src: src, target: target, kind: AI.EXPLAIN_KIND, docId: docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
  }

  /**
   * `[15-1 — spec 17-13 3-2 · 6 · 15-D5]` AI 출제 `pipeline.makeQuiz(items, {src, target, docId, domain, n, force, retry, signal})`.
   * **사용자가 [문제 만들기]를 누를 때만** 부른다(자동 0). `items` = `passageFor` 의 고른 문단 `[{paraId, pageNo, text}]` —
   * ★ 보내는 것은 그 셋뿐(교과서 문단 글). 같은 언어도 만든다(해설 하나). 언어 이름이 없으면 `unsupported-lang`, 문단이 없으면 `empty`(호출 0).
   * 요청이 글자 상한(`ai.maxReqChars`)·토큰 상한(`AI.MAX_REQ_TOKENS`)을 넘으면 **뒤 문단부터 뺀다**(문단은 자르지 않는다) — 하나만 남아도
   * 넘치면 `too-big`(호출 0). 키 `keyFor(docId, 보내는 문단 JSON, target, 'quiz', 'n=5|l=' + 언어)` — 같은 입력이면 0회(실패 뒤 [다시 시도]),
   * 새로 누르면 `usedParaIds` 때문에 다른 입력. `domain`·판본은 키에 없다(7-5). 상태 기계·사용량(`byKind.quiz`)은 번역과 한 벌.
   * @returns {Promise<{status:string, calls:number, results:[{state:string, value?:Object, code?:string, cached?:boolean}],
   *           sent:string[], langs:string[], n:number, provider:string, model:string}>} `sent` = 실제로 실은 문단 id. 던지지 않는다
   */
  async function makeQuiz(items, opts) {
    const o = opts || {};
    const src = typeof o.src === 'string' ? o.src.trim() : '';
    const target = typeof o.target === 'string' ? o.target.trim() : '';
    const n = Number.isInteger(o.n) && o.n > 0 && o.n <= REVIEW.QUIZ_N ? o.n : REVIEW.QUIZ_N;
    // ★ 항목에서 문단 id·쪽·글만 읽는다 — 다른 필드(요약·메모·책 제목)는 옮겨 담지 않는다.
    const list = (Array.isArray(items) ? items : []).map((it) => {
      const x = it || {};
      const pg = Number(x.pageNo);
      return { paraId: String(x.paraId == null ? '' : x.paraId), pageNo: Number.isFinite(pg) ? pg : null, text: textOf(x).trim() };
    }).filter((x) => x.text);
    const providerName = String(getSetting('ai.provider') || AI.DEFAULT_PROVIDER);
    const modelName = String(getSetting('ai.model') || '').trim() || (AI.DEFAULT_MODEL[providerName] || '');
    const meta = (extra) => Object.assign({ sent: [], langs: [], n: n, provider: providerName, model: modelName }, extra || {});
    const skip = (status, extra) => Object.assign({ status: status, calls: 0, results: [{ state: SEG.SKIPPED, code: status }] }, meta(extra));
    if (!list.length) return skip(STATUS.EMPTY);
    if (!langName(src) || !langName(target)) return skip(STATUS.UNSUPPORTED_LANG);
    const langs = src === target ? [target] : [target, src];
    const ctx = { src: src, target: target, domain: normalizeDomain(o.domain) };
    let use = list;
    let item = null;
    for (;;) {
      const size = use.reduce((a, x) => a + charCount(x.text), 0);
      const cand = { items: use, n: n, size: size };
      const req = QUIZ_JOB.build([cand], ctx);
      if (req && size <= maxChars() && !exceedsRequestBudget(req)) { item = cand; break; }
      if (use.length <= 1) return skip(STATUS.TOO_BIG, { langs: langs, chars: size });
      use = use.slice(0, -1);
    }
    const docId = String(o.docId == null ? '' : o.docId);
    const key = await keyFor(docId, JSON.stringify(use), target, QUIZ_KIND, 'n=' + n + '|l=' + langs.join('+'));
    const out = await runJob(QUIZ_JOB, [item], [key], {
      src: src, target: target, kind: QUIZ_KIND, docId: docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
    return Object.assign(out, meta({ sent: use.map((x) => x.paraId), langs: langs, key: key }));
  }

  /**
   * `[16-1 — spec 17-14 2 · 6 · 16-D2]` 그림 개념도 `pipeline.diagram(outline, {target, src, docId, domain, force, retry, signal})`.
   * **사용자가 [개념도 그리기]를 누를 때만** 부른다(자동 0). 입력 = **저장한 개요**(11c 레코드의 `points` 만 — 원문을 다시 보내지 않는다,
   * 범위 이름·개요 제목도 보내지 않는다). `target` 을 주지 않으면 개요의 `target`. 원어 칸은 `src`(문서 원문 언어)가 대상과 다를 때만.
   * DOC 가 `DIAGRAM.INPUT_MAX`(4,000자)·`ai.maxReqChars`·요청 토큰 상한을 넘으면 3단을 빼고 2단까지 → 그래도 넘으면 **보내지 않고**
   * `too-big`(호출 0). 개요에 요점이 없으면 `empty`, 언어 이름이 없으면 `unsupported-lang`(호출 0).
   * 키 `keyFor(docId, DOC 글, target, 'diagram', 'l=' + 언어)` — 같은 개요·같은 깊이·같은 언어면 0회. `domain`·판본은 키에 없다(7-5).
   * 사용량 `byKind.diagram`.
   * @returns {Promise<{status:string, calls:number, results:[{state:string, value?:{title:string, nodes:Array, edges:Array}, code?:string,
   *           cached?:boolean}], depth:number, chars:number, basis:string, target:string, provider:string, model:string, promptVersion:number}>}
   *   `depth` = 보낸 깊이(3 · 2 — 0 = 보내지 않음), `basis` = 개요의 `cacheKey`(16-2 "개요가 바뀌었습니다"의 재료). 던지지 않는다
   */
  async function diagram(outline, opts) {
    const o = opts || {};
    const rec = outline && typeof outline === 'object' ? outline : {};
    const target = typeof o.target === 'string' && o.target.trim() ? o.target.trim() : (typeof rec.target === 'string' ? rec.target.trim() : '');
    const srcIn = typeof o.src === 'string' ? o.src.trim() : '';
    const src = srcIn && langName(srcIn) && srcIn !== target ? srcIn : '';
    const providerName = String(getSetting('ai.provider') || AI.DEFAULT_PROVIDER);
    const modelName = String(getSetting('ai.model') || '').trim() || (AI.DEFAULT_MODEL[providerName] || '');
    const meta = (extra) => Object.assign({
      depth: 0, chars: 0, basis: typeof rec.cacheKey === 'string' ? rec.cacheKey : '', target: target,
      provider: providerName, model: modelName, promptVersion: DIAGRAM_PROMPT_VERSION
    }, extra || {});
    const skip = (status, extra) => Object.assign({ status: status, calls: 0, results: [{ state: SEG.SKIPPED, code: status }] }, meta(extra));
    // ★ `points` 만 넘긴다 — 레코드의 다른 필드(범위 이름·책 제목·개요 제목·메모)는 `diagramPayload` 에 닿지 않는다.
    const only = { points: Array.isArray(rec.points) ? rec.points : [] };
    if (!diagramPayload(only).lines.length) return skip(STATUS.EMPTY);
    if (!langName(target)) return skip(STATUS.UNSUPPORTED_LANG);
    const ctx = { src: target, target: target, domain: normalizeDomain(o.domain) };
    let pick = null;
    let last = null;
    for (const depth of [3, 2]) {
      const input = diagramPayload(only, { depth: depth });
      const item = Object.assign(input, { src: src, target: target });
      last = item;
      const req = DIAGRAM_JOB.build([item], ctx);
      if (req && item.size <= DIAGRAM.INPUT_MAX && item.size <= maxChars() && !exceedsRequestBudget(req)) { pick = item; break; }
    }
    if (!pick) return skip(STATUS.TOO_BIG, { chars: last ? last.size : 0 });
    const docId = String(o.docId == null ? '' : o.docId);
    // 원어 칸을 받는지(원문 언어)가 다르면 다른 값이다 — 요약·출제처럼 `l=` 로 가른다(15-1R 낮음-3 과 같은 까닭).
    const key = await keyFor(docId, pick.text, target, AI.DIAGRAM_KIND, 'l=' + (src ? target + '+' + src : target));
    const out = await runJob(DIAGRAM_JOB, [pick], [key], {
      src: target, target: target, kind: AI.DIAGRAM_KIND, docId: docId, signal: o.signal,
      retry: !!o.retry, force: !!o.force, domain: o.domain
    });
    return Object.assign(out, meta({ depth: pick.depth, chars: pick.size, key: key }));
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
   * `[수정 2026-10-10]` `KEY_IN_URL` 로 든 model 상태는 키 저장으로도 풀린다(키·모델 어느 쪽을 고쳐도).
   */
  function configChanged(what) {
    const w = String(what || '');
    const hasKey = !!String(getKey() || '').trim();
    const keyInUrl = base.name === STATES.MODEL && base.code === CODES.KEY_IN_URL;
    if (base.name === STATES.NO_KEY && hasKey && (w === 'key' || w === 'provider')) setBase(STATES.READY, 0, null);
    else if (base.name === STATES.MODEL && (w === 'model' || w === 'provider' || (keyInUrl && w === 'key'))) setBase(STATES.READY, 0, null);
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
    /** `[8f-1]` 단어 요청(17-7-2) — 번역과 같은 상태 기계. */
    translateTerms: translateTerms,
    /** `[8f-1]` job 하나를 돌린다(11 이 요약·개요·설명 job 을 얹는다). `(job, items, keys, opts)` — `opts` 는 빼도 된다(11-1). */
    runJob: runJob,
    /** `[11-1]` 문단 요약(17-2-1 4-2) — 번역과 같은 상태 기계. */
    summarize: summarize,
    /** `[11-1]` [이 쪽 전체 요약]의 호출 수 k — 보내지 않고 센다. */
    planSummary: planSummary,
    /** `[11-1]` 범위 개요(11c — 4-6) — 저장한 요약에서만, 최대 1호출. */
    outline: outline,
    /** `[11-4]` 문장 설명(11a — 17-2-1 4-7) — 번역과 같은 상태 기계, 최대 1호출. */
    explain: explain,
    /** `[15-1]` AI 출제(10-4 · 17-13 3-2) — 번역과 같은 상태 기계, 최대 1호출(5문항). */
    makeQuiz: makeQuiz,
    /** `[16-1]` 그림 개념도(17-14 — 저장한 개요에서만) — 번역과 같은 상태 기계, 최대 1호출. */
    diagram: diagram,
    retry: retry,
    configChanged: configChanged,
    setOnline: setOnline,
    /** 지금 원격 상태 이름. */
    state: current,
    /** 상태가 바뀔 때마다 `{state, prev, until, code}`. 되돌림 함수를 준다. */
    onState: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    /** `[8c-2]` 80% 경고 — 그날 한 번 `{used, cap, warnAt, day}`. 되돌림 함수를 준다. */
    onWarn: (fn) => { warnListeners.add(fn); return () => warnListeners.delete(fn); },
    /** 이 키가 "보냈다가 실패"로 기억돼 있는가(테스트·8b 조회). */
    isFailed: (key) => failedKeys.has(key),
    _base: () => Object.assign({}, base)
  };
}
