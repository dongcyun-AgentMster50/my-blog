/* ============================================================
   MedReader — 설정 화면 · AI 탭 (spec 12-7 · 8-2 · 8-3 · 8-4 · 7-8-1 · 13절 · 14-2)

   ── 이 파일이 가장 먼저 해야 하는 일 (19절 7b ①) ─────────
   사용자가 **자기 키로 [검증]·[시험 번역]을 눌러 볼 수 있는 상태**.
   실제 Gemini 호출·CORS·지역 제한(`REGION`)은 지금까지 아무도 확인하지
   못했다(8-3 `[가정]`). 이 두 버튼이 그것을 확인하는 유일한 길이다.
   한국 PC 에서 통과해도 **Nour 기기(시리아)** 에서 막힐 수 있다(16-D0 `[M]`).

   ── 7a 위에 얹는다 — 재구현 금지 ─────────────────────────
   키 저장·마스킹은 `privacy/keys.js`, 호출·검증·모델 목록은 `ai/provider.js`,
   지우기는 `privacy/redact.js`, URL 그물은 `provider.js` 안의 `assertNoKeyInUrl`.
   이 파일은 그 결과 **코드**를 i18n 문구로 바꿀 뿐이다(3-2).

   ── ★ 키가 나가지 않는다 (13절) ───────────────────────────
   - 이 파일은 `console` 을 부르지 않는다(테스트가 grep 으로 고정한다).
   - 화면에 키를 그리는 길은 `keys.readKeyMasked()` 하나뿐이다. 원문
     (`readKeySecret`)은 **호출 인자로만** 쓰고 어디에도 쓰지 않는다.
   - 입력칸에 친 원문은 저장 직후·화면을 떠날 때 지운다.
   - 서버 메시지는 `dev.debug` 일 때만, **실제 키로 지운 뒤** 보인다(8-2).

   ── ★ 버튼 장치 하나 ─────────────────────────────────────
   화면 이동은 전부 `data-nav` 전역 위임(`main.js`)이다. 이 화면 안의 동작
   버튼은 `data-action` 을 **섹션 하나의 위임 리스너**가 받는다. 버튼마다
   `onclick` 을 붙이지 않는다(인계 문서 3차 확인 교훈 2 — 반쪽 캐시).

   ── innerHTML 0건 ───────────────────────────────────────
   AI 응답·사용자 입력·서버 메시지는 전부 `textContent` 로만 들어간다(13절).
   ============================================================ */

import * as settings from '../settings.js';
import * as db from '../db.js';
import * as provider from '../ai/provider.js';
import * as keys from '../privacy/keys.js';
import { redactString } from '../privacy/redact.js';
import { AI, TTS } from '../config.js';
import { t, applyTranslations, formatNumber, onLangChange, BUNDLES, dirOf } from '../i18n/index.js';
import { loadVoices, pickVoice } from '../tts/voices.js';
import { piiWarning } from './notice.js';
import { ltrRuns } from '../text/bidi.js';
import { TEST_PROMPT } from '../ai/prompts.js';
import { parseAIJson } from '../ai/jsonrepair.js';

const CODES = provider.CODES;

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/settings-7b.test.mjs` 가 고정한다
   ──────────────────────────────────────────────────────── */

/** 설정 AI 탭의 해시. 입구 세 곳(서재·속도 팝오버·키 없음 안내)이 모두 이것이다. */
export const SETTINGS_AI_HASH = '#/settings/ai';

/** 7-8-1 `readalong.mode`. 순서가 버튼 순서다. */
export const READALONG_MODES = Object.freeze(['off', 'show', 'speak']);
export const DEFAULT_READALONG_MODE = 'speak';

/**
 * 8-4 다섯 갈래 + 화면 전용 두 가지(키 없음·취소).
 * 서비스 계층 코드(`CODES`)와 **같은 것이 아니다** — 화면이 고를 문구의 갈래다.
 */
export const OUTCOME = Object.freeze({
  VALID: 'valid',        // 유효
  INVALID: 'invalid',    // 무효 (AUTH)
  LIMITED: 'limited',    // 한도 (RATE_LIMIT — 키는 유효)
  REGION: 'region',      // 지역 제한 (REGION — 키 문제가 아니다)
  MODEL: 'model',        // 이 모델을 쓸 수 없다 (MODEL_UNAVAILABLE — 키 문제가 아니다) `[신설 2026-10-08]`
  KEY_IN_URL: 'keyInUrl', // 모델 칸에 키가 들어 있어 보내지 않았다 (KEY_IN_URL — 네트워크 탓이 아니다) `[신설 2026-10-10]`
  UNKNOWN: 'unknown',    // 확인 불가 (네트워크·CORS·서버·그 밖)
  NO_KEY: 'noKey',       // 누르기 전에 걸린다 — 키가 없다
  ABORTED: 'aborted'     // 화면을 떠났다 — 아무 것도 보이지 않는다
});

/**
 * 12-7 [시험 번역] 고정 예문 — **지어낸 두 문장**이다. PDF·원서 문장이 아니다.
 * 코드 안 상수로 두는 이유: 사용자 입력이 아니므로 환자 정보가 섞일 수 없고,
 * 매번 같은 글을 보내야 한국 PC 와 Nour 기기의 결과·지연을 견줄 수 있다.
 *
 * `[수정 2026-10-08]` 일상문("Drink a glass of water…")으로는 **의학 번역 품질**을 볼 수
 * 없었다. 질환명·약물명·숫자/단위가 든 일반 설명 두 문장으로 바꿨다. 치료 지시·용량
 * 권고로 읽히는 문장은 피한다(10-1 규칙 3).
 */
export const TEST_SAMPLE = Object.freeze([
  'Rheumatoid arthritis is a chronic autoimmune disease that often causes morning stiffness lasting more than 30 minutes.',
  'Methotrexate and adalimumab are disease-modifying drugs, and blood tests may show a C-reactive protein level above 10 mg/L.'
]);

/** `[신설 2026-10-08]` 번역 언어 선택지(운영자 결정). 순서가 버튼 순서다. 첫 값이 기본. */
export const TRANSLATION_LANGS = Object.freeze(['ar', 'ko']);
export const DEFAULT_TRANSLATION_LANG = 'ar';

/** [시험 번역]은 **언제나 이 두 언어를 나란히** 받는다 — 운영자는 아랍어를 읽지 못한다. */
export const TEST_PAIR_LANGS = Object.freeze(['ar', 'ko']);

/**
 * ★ [시험 번역] 지시문 — `[8a]` **`ai/prompts.js` 로 옮겼다**(10-1 공통 골격 · 10-2 번역과 한 벌).
 * 내용은 한 글자도 바꾸지 않았다(Nour 가 이 지시문의 아랍어 품질을 "좋다"고 확인 — 2026-10-09).
 * 테스트·옛 import 가 이 이름으로 찾으므로 여기서 다시 내보낸다.
 */
export { TEST_PROMPT };

/** `[신설 2026-10-08]` 모르는 번역 언어 값은 기본(`ar`)으로. */
export function normalizeTranslationLang(v) {
  return TRANSLATION_LANGS.indexOf(v) >= 0 ? v : DEFAULT_TRANSLATION_LANG;
}

/**
 * 번역 결과 블록의 `lang`·`dir` — **언어에서 유도한다**(`ar` 을 코드에 박지 않는다).
 * `ar` → `rtl`, `ko` → `ltr`. 판정은 i18n 의 `dirOf` 하나.
 */
export function translationBlockAttrs(lang) {
  const l = String(lang || DEFAULT_TRANSLATION_LANG);
  return { lang: l, dir: dirOf(l) };
}

/** 7-8-1 — 모르는 값은 기본값(`speak`)으로. */
export function normalizeReadalongMode(v) {
  return READALONG_MODES.indexOf(v) >= 0 ? v : DEFAULT_READALONG_MODE;
}

/**
 * 번역 따라가기 한 줄이 보일 값. 설정 AI 탭과 속도 팝오버가 **이 함수 하나**로 읽는다.
 * @param {(key:string)=>*} [get] 기본은 `settings.get`
 */
export function readalongState(get) {
  const g = typeof get === 'function' ? get : settings.get;
  const mode = normalizeReadalongMode(g('readalong.mode'));
  return {
    mode: mode,
    // 9-3 기본 true(사용자 확정). `false` 로 **명시**했을 때만 끈다.
    speakSource: g('readalong.speakSource') !== false,
    // 원문 읽기는 번역문을 소리 내 읽을 때만 뜻이 있다(7-8-1).
    sourceEnabled: mode === 'speak'
  };
}

/** 서비스 계층 오류 코드 → 화면 갈래. */
export function errorOutcome(code) {
  switch (code) {
    case CODES.AUTH: return OUTCOME.INVALID;
    case CODES.RATE_LIMIT: return OUTCOME.LIMITED;
    case CODES.REGION: return OUTCOME.REGION;
    case CODES.MODEL_UNAVAILABLE: return OUTCOME.MODEL;
    case CODES.KEY_IN_URL: return OUTCOME.KEY_IN_URL;
    case CODES.NO_KEY: return OUTCOME.NO_KEY;
    case CODES.ABORTED: return OUTCOME.ABORTED;
    default: return OUTCOME.UNKNOWN;
  }
}

/** `provider.verifyKey()` 결과 → 화면 갈래(8-4 다섯 갈래). */
export function verifyOutcome(r) {
  const x = r || {};
  // 429 는 ok:true 로 온다 — 키는 유효하고 한도에 걸렸을 뿐(8-4). 유효보다 먼저 본다.
  if (x.code === CODES.RATE_LIMIT) return OUTCOME.LIMITED;
  if (x.ok === true) return OUTCOME.VALID;
  // 검증은 모델을 부르지 않는다(목록 `pageSize=1`). 거기서 404 가 나면 모델 탓이 아니다.
  if (x.code === CODES.MODEL_UNAVAILABLE) return OUTCOME.UNKNOWN;
  return errorOutcome(x.code);
}

/**
 * 갈래 → i18n 키. 취소는 `null`(보일 것이 없다).
 * 지역 제한 문구(`settings.ai.verify.region`)에는 **[키 설정]이 없다**(14-2).
 * @param {string} outcome
 * @param {'verify'|'test'} kind
 */
export function outcomeKey(outcome, kind) {
  switch (outcome) {
    case OUTCOME.VALID: return kind === 'test' ? 'settings.ai.test.valid' : 'settings.ai.verify.valid';
    case OUTCOME.INVALID: return 'settings.ai.verify.invalid';
    case OUTCOME.LIMITED: return 'settings.ai.verify.limited';
    case OUTCOME.REGION: return 'settings.ai.verify.region';
    // ★ "키는 저장할 수 있습니다"를 붙이지 않는다 — 키 문제가 아니다.
    case OUTCOME.MODEL: return 'settings.ai.test.modelUnavailable';
    // `[신설 2026-10-10]` "확인 불가·나중에 다시"가 아니다 — 요청을 보내지 않았고 설정을 고쳐야 한다.
    case OUTCOME.KEY_IN_URL: return 'settings.ai.test.keyInModel';
    case OUTCOME.NO_KEY: return 'settings.ai.key.empty';
    case OUTCOME.ABORTED: return null;
    default: return 'settings.ai.verify.unknown';
  }
}

/**
 * 14-2 원격 상태 안내의 모양. 8a/8b 의 상태 바가 이것을 `medreader:banner`
 * 이벤트의 `detail` 로 넘긴다(`main.js` 가 `actions` 를 `data-nav` 버튼으로 그린다).
 *
 * ★ `REGION` 에는 **[키 설정]을 붙이지 않는다** — 키를 다시 넣게 만들면 Nour 는
 *   멀쩡한 키를 영원히 바꾼다. [다시 시도]는 파이프라인(8a)이 붙인다.
 * ★ `NO_KEY` 는 12-2 의 "키 없음 안내" — [키 설정]으로 설정 AI 탭에 딥링크한다.
 *
 * @returns {{key:string, params:Object|null, actions:{key:string, nav:string}[]}|null}
 */
export function stateNotice(code, providerLabel) {
  if (code === CODES.REGION) {
    return { key: 'ai.state.region', params: { provider: String(providerLabel || '') }, actions: [] };
  }
  if (code === CODES.NO_KEY) {
    return { key: 'ai.state.noKey', params: null, actions: [{ key: 'settings.ai.open', nav: SETTINGS_AI_HASH }] };
  }
  return null;
}

/** 결과 줄의 코드 표시. 키는 들어갈 수 없다 — 코드 이름과 숫자뿐이다. */
export function codeLabel(code, status) {
  const c = code ? String(code) : 'OK';
  const s = Number(status);
  return Number.isFinite(s) && s > 0 ? c + ' · HTTP ' + s : c;
}

/** 8-4 — 형식 경고가 필요하면 i18n 키, 아니면 `null`. **저장은 막지 않는다.** */
export function formatWarningKey(providerId, key) {
  const r = provider.checkKeyFormat(providerId, key);
  return r.code === provider.KEY_FORMAT.UNFAMILIAR ? 'settings.ai.key.unfamiliar' : null;
}

/** 일일 상한 입력. 1 이상의 정수만. 아니면 `null`(이전 값으로 되돌린다). */
export function parseDailyCap(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i >= 1 ? i : null;
}

/** 13절·12-2 — 동의 전에는 AI 버튼이 동의 카드로 간다. */
export function needsConsent(consentedAt) {
  return !(typeof consentedAt === 'string' && consentedAt !== '');
}

/**
 * 대상 언어의 **자국어 이름**("العربية"). 온보딩 언어 버튼과 같은 낱말을 쓴다
 * (`onboarding.lang.*` 는 어느 언어 파일에서도 같다). 모르는 코드는
 * `Intl.DisplayNames` 로, 그것도 없으면 코드 그대로.
 */
export function nativeLangName(code) {
  const c = String(code || '');
  const k = 'onboarding.lang.' + c;
  if (BUNDLES.en && typeof BUNDLES.en[k] === 'string') return BUNDLES.en[k];
  try {
    const n = new Intl.DisplayNames([c], { type: 'language' }).of(c);
    if (n) return n;
  } catch (e) { /* 아래로 */ }
  return c;
}

/** 6-3 — 번역문 음성 유무. `pickVoice(target)` 그대로. */
export function voiceStatus(lang, voices) {
  return pickVoice(lang, voices) ? 'yes' : 'no';
}

/**
 * [시험 번역] 요청 — `[수정 2026-10-08]` **한 번의 호출**로 아랍어·한국어를 함께 받는다.
 * `json:true` + 스키마 `{ar, ko}`. 지시문은 `TEST_PROMPT` 한 곳에서만 온다.
 * 대상 언어 인자는 받지 않는다 — 시험은 언제나 `TEST_PAIR_LANGS` 두 언어다.
 */
export function buildTestRequest() {
  const rules = [];
  for (let i = 0; i < TEST_PAIR_LANGS.length; i++) rules.push(TEST_PROMPT.LANG_RULES[TEST_PAIR_LANGS[i]]);
  return {
    system: TEST_PROMPT.COMMON,
    user: TEST_PROMPT.TASK + '\n' + rules.join('\n') + '\n' +
      'Schema: {"ar": string, "ko": string}\n' +
      '<<<DOC\n' + TEST_SAMPLE.join(' ') + '\n>>>',
    json: true,
    schema: TEST_PROMPT.SCHEMA,
    // 두 언어 + 사고(thinking) 토큰이 상한을 나눠 쓰는 모델이 있다 — 넉넉히 둔다(잘리면 JSON 이 깨진다).
    maxOutputTokens: 2048,
    temperature: 0.2
  };
}

/**
 * [시험 번역] 응답 파싱 — `[8a]` 10-6 `parseAIJson` 을 거친다. 7b Review 가 기록한
 * "코드펜스(```json … ```)로 감싼 JSON 이 원문 한 블록으로 보인다"가 이제 두 블록으로 보인다.
 * 실패하면 `ok:false` 이고 화면은 응답 문자열을 **그대로** `textContent` 로 보인다.
 *
 * **잘린 응답은 짝으로 치지 않는다**(복구 단계 `truncated` 를 거친 결과는 버린다). [시험 번역]은
 * 진단 버튼이다 — 잘린 번역을 닫아서 보이면 `MAX_TOKENS` 같은 원인이 가려진다.
 * @returns {{ok:boolean, pair:{ar:string,ko:string}|null, raw:string}}
 */
export function parseTestPair(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  const parsed = parseAIJson(raw, TEST_PROMPT.SCHEMA);
  const j = parsed.ok && parsed.repairs.indexOf('truncated') < 0 ? parsed.value : null;
  if (j && typeof j === 'object' && !Array.isArray(j)) {
    const pair = {};
    let ok = true;
    for (let i = 0; i < TEST_PAIR_LANGS.length; i++) {
      const v = j[TEST_PAIR_LANGS[i]];
      if (typeof v !== 'string' || v.trim() === '') { ok = false; break; }
      pair[TEST_PAIR_LANGS[i]] = v.trim();
    }
    if (ok) return { ok: true, pair: pair, raw: raw };
  }
  return { ok: false, pair: null, raw: raw };
}

/**
 * `[신설 2026-10-08]` 원격 모델 목록을 받은 뒤 — 지금 쓰는 모델(저장값, 없으면 기본)이
 * 목록에 **없으면** 기본 모델(목록에 있으면), 아니면 목록의 첫 모델로 바꾼다.
 * @param {string} saved 저장된 `ai.model`(낡은 값은 이미 '' 로 읽힌다)
 * @param {{id:string}[]} models 원격 목록
 * @param {string} def 기본 모델
 * @returns {{model:string, replaced:boolean}}
 */
export function reconcileModel(saved, models, def) {
  const list = Array.isArray(models) ? models : [];
  const current = String(saved || def || '');
  if (!list.length || list.some((m) => m && m.id === current)) return { model: current, replaced: false };
  const next = list.some((m) => m && m.id === def) ? def : String(list[0].id);
  return { model: next, replaced: true };
}

/**
 * `[Review 7b-fix]` 원격 목록에서 **낡은 모델**(`settings.isRetired('ai.model', …)` — 지금은
 * `gemini-2.5-*`)을 뺀다. 목록에 남겨 두면 골라도 저장값이 "설정 안 됨"으로 읽혀
 * 드롭다운은 2.5 를, 요청은 기본 모델을 쓰는 어긋남이 생겼다(브라우저 스텁으로 재현).
 * @param {{id:string}[]} models
 */
export function usableModels(models, adapter) {
  const list = Array.isArray(models) ? models : [];
  const live = list.filter((m) => !!m && !settings.isRetired('ai.model', m.id));
  // `[수정 2026-10-08 — 운영자 결정 "안정판만, 필요한 몇 개만"]` 계열마다 최신 하나.
  // 어떤 이름이 안정판인지는 어댑터가 안다(프로바이더마다 이름 규칙이 다르다).
  return adapter && typeof adapter.curateModels === 'function'
    ? adapter.curateModels(live, adapter.defaultModel)
    : live;
}

function nowMs() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  } catch (e) { /* 아래로 */ }
  return Date.now();
}

function elapsed(clock, t0) {
  return Math.max(0, Math.round(clock() - t0));
}

/**
 * [검증] 한 번. **던지지 않는다**(`verifyKey` 가 이미 던지지 않는다).
 * @param {{key:string, provider?:string, fetch?:Function, db?:Object, signal?:AbortSignal, clock?:()=>number}} o
 */
export async function runVerify(o) {
  const x = o || {};
  const clock = typeof x.clock === 'function' ? x.clock : nowMs;
  const t0 = clock();
  const r = await provider.verifyKey(x.key, {
    provider: x.provider, fetch: x.fetch, db: x.db, signal: x.signal
  });
  return {
    outcome: verifyOutcome(r),
    ms: elapsed(clock, t0),
    code: r.code || 'OK',
    status: r.status || 0,
    canSave: !!r.canSave,
    maybeBlocked: !!r.maybeBlocked,
    // provider 가 이미 실제 키로 지웠다. 한 번 더 건다(멱등, 마지막 그물).
    message: redactString(r.message || '', { keys: [x.key] })
  };
}

/**
 * [시험 번역] 한 번 — 고정 예문 2문장을 `provider.complete()` 로 **1회** 보낸다.
 * usage 에 `kind:'translate'` 로 남는다(12-7). **던지지 않는다.**
 *
 * `[수정 2026-10-08]` 결과에 아랍어·한국어 짝(`pair`), 모델 이름, 입력·출력 토큰을 싣는다.
 * 모델 이름은 **실제 키로 지운 뒤** 싣는다 — 모델 칸에 키가 들어 있는 경로(T5).
 *
 * @param {{key:string, provider?:string, model?:string,
 *          fetch?:Function, db?:Object, signal?:AbortSignal, clock?:()=>number}} o
 * @returns {Promise<{outcome:string, text:string, pair:{ar:string,ko:string}|null, empty:boolean,
 *                    ms:number, model:string, code:string, status:number,
 *                    usage:{input:number,output:number}|null, finishReason:string|null,
 *                    maybeBlocked:boolean, message:string}>}
 */
export async function runTestTranslation(o) {
  const x = o || {};
  const clock = typeof x.clock === 'function' ? x.clock : nowMs;
  const req = buildTestRequest();
  let def = '';
  try { def = provider.getAdapter(x.provider).defaultModel; } catch (e) { def = ''; }
  const asked = redactString(String(x.model || def), { keys: [x.key] });
  const t0 = clock();
  try {
    const r = await provider.complete(req, {
      key: x.key, provider: x.provider, model: x.model || undefined,
      signal: x.signal, fetch: x.fetch, db: x.db, kind: 'translate'
    });
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    const parsed = parseTestPair(text);
    return {
      outcome: OUTCOME.VALID, text: text, pair: parsed.pair, empty: text === '', ms: elapsed(clock, t0),
      model: redactString(String(r.model || asked), { keys: [x.key] }),
      code: 'OK', status: 0,
      usage: r.usage || null,
      finishReason: typeof r.finishReason === 'string' ? r.finishReason : null,
      maybeBlocked: false, message: ''
    };
  } catch (e) {
    const code = (e && e.code) || CODES.UNKNOWN;
    return {
      outcome: errorOutcome(code), text: '', pair: null, empty: true, ms: elapsed(clock, t0),
      model: asked,
      code: String(code), status: (e && Number(e.status)) || 0,
      usage: null, finishReason: null,
      maybeBlocked: !!(e && e.maybeBlocked),
      message: redactString((e && e.message) || '', { keys: [x.key] })
    };
  }
}

/**
 * [시험 번역] 결과 줄 — 걸린 ms · 모델 · 코드 (+ 응답에 있으면 입력·출력 토큰).
 * `finishReason` 이 `STOP` 이 아니면 코드 옆에 붙인다(잘림 `MAX_TOKENS` 진단용).
 * @param {(key:string, params?:Object)=>string} [tr] i18n `t`
 */
export function testMetaText(r, tr) {
  const x = r || {};
  const tt = typeof tr === 'function' ? tr : t;
  let code = codeLabel(x.code, x.status);
  if (x.finishReason && x.finishReason !== 'STOP') code += ' · ' + x.finishReason;
  const lines = [tt('settings.ai.test.meta', { ms: formatNumber(x.ms || 0), model: String(x.model || ''), code: code })];
  if (x.usage && (Number.isFinite(x.usage.input) || Number.isFinite(x.usage.output))) {
    lines.push(tt('settings.ai.test.tokens', {
      input: formatNumber(Number(x.usage.input) || 0), output: formatNumber(Number(x.usage.output) || 0)
    }));
  }
  return lines.join('\n');
}

/* ────────────────────────────────────────────────────────
   2. 번역 따라가기 한 줄 — 설정 AI 탭과 속도 팝오버의 **같은 그리기 함수**
   (12-3 · 12-7 · 16-D0 `[D]`). 7b 는 **저장만** 한다. 동작은 8b 가 붙인다.
   ──────────────────────────────────────────────────────── */

let rowSeq = 0;

/**
 * `host` 안에 번역 따라가기 줄을 (없으면 만들고) 지금 설정값으로 그린다.
 * 정적 HTML 에는 빈 그릇(`[data-readalong-host]`)만 둔다 — 버튼과 그 동작을
 * **이 함수가 함께** 만들어, 둘 중 하나만 낡는 반쪽 상태가 생기지 않게 한다.
 */
export function renderReadalongRow(host) {
  if (!host || typeof document === 'undefined') return;
  if (host.getAttribute('data-readalong-built') !== '1') buildReadalongRow(host);
  paintReadalongRow(host);
}

function buildReadalongRow(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
  rowSeq += 1;
  const labelId = 'readalongLabel' + rowSeq;

  const head = document.createElement('div');
  head.className = 'typeset-head';
  const label = document.createElement('span');
  label.className = 'readalong-label';
  label.id = labelId;
  label.setAttribute('data-i18n', 'readalong.mode.label');
  head.appendChild(label);
  host.appendChild(head);

  const group = document.createElement('div');
  group.className = 'typeset-choices readalong-modes';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', labelId);
  for (let i = 0; i < READALONG_MODES.length; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-readalong-mode', READALONG_MODES[i]);
    b.setAttribute('data-i18n', 'readalong.mode.' + READALONG_MODES[i]);
    b.setAttribute('aria-pressed', 'false');
    group.appendChild(b);
  }
  host.appendChild(group);

  const sw = document.createElement('button');
  sw.type = 'button';
  sw.className = 'switch readalong-source';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', 'false');
  sw.setAttribute('data-readalong-source', '');
  const swText = document.createElement('span');
  swText.setAttribute('data-i18n', 'readalong.speakSource');
  sw.appendChild(swText);
  host.appendChild(sw);

  host.addEventListener('click', onReadalongClick);
  host.setAttribute('data-readalong-built', '1');
  applyTranslations(host);
}

function paintReadalongRow(host) {
  const s = readalongState();
  const modes = host.querySelectorAll('[data-readalong-mode]');
  for (let i = 0; i < modes.length; i++) {
    modes[i].setAttribute('aria-pressed', modes[i].getAttribute('data-readalong-mode') === s.mode ? 'true' : 'false');
  }
  const sw = host.querySelector('[data-readalong-source]');
  if (sw) {
    sw.setAttribute('aria-checked', s.speakSource ? 'true' : 'false');
    sw.disabled = !s.sourceEnabled;
  }
}

/** 한쪽에서 바꾸면 화면에 있는 모든 줄을 다시 그린다(같은 값 하나). */
function paintAllReadalongRows() {
  if (typeof document === 'undefined') return;
  const hosts = document.querySelectorAll('[data-readalong-built="1"]');
  for (let i = 0; i < hosts.length; i++) paintReadalongRow(hosts[i]);
}

function onReadalongClick(ev) {
  const m = ev.target.closest('[data-readalong-mode]');
  if (m) {
    const mode = normalizeReadalongMode(m.getAttribute('data-readalong-mode'));
    // `settings.set` 은 캐시를 먼저 고친다 — 저장이 늦어도 다시 그리기는 새 값을 본다.
    settings.set('readalong.mode', mode).catch(() => { /* 저장 실패가 화면을 막지 않는다 */ });
    paintAllReadalongRows();
    return;
  }
  const sw = ev.target.closest('[data-readalong-source]');
  if (sw && !sw.disabled) {
    settings.set('readalong.speakSource', !readalongState().speakSource).catch(() => { });
    paintAllReadalongRows();
  }
}

/* ────────────────────────────────────────────────────────
   3. 설정 화면 — DOM 결선
   ──────────────────────────────────────────────────────── */

let root = null;
let els = null;
/** 화면을 떠나면 진행 중인 호출을 끊는다. */
const inflight = new Set();
/** 마지막 결과. 언어를 바꾸면 이것으로 문구를 다시 쓴다. 키는 담지 않는다. */
let lastVerify = null;
let lastTest = null;
let lastVoice = null;      // 'yes' | 'no' | null(확인 중)
/** 검증이 통과한 뒤 받은 원격 모델 목록. `{pid, models}` */
let remoteModels = null;
let busy = false;
/** 키처럼 보이는 저장 모델값을 대신하는 선택지 값. 고르면 아무 것도 저장하지 않는다. */
const REDACTED_MODEL = '__redacted__';

export function initSettingsScreen() {
  if (els) return;
  root = document.querySelector('[data-screen="settings"]');
  if (!root) return;
  const q = (id) => root.querySelector('#' + id);
  els = {
    consentCard: q('aiConsentCard'),
    consentCheck: q('aiConsentCheck'),
    consentHint: q('aiConsentHint'),
    providerSel: q('aiProvider'),
    keyInput: q('aiKey'),
    keyToggle: q('aiKeyToggle'),
    keyPaste: q('aiKeyPaste'),
    keyFormat: q('aiKeyFormat'),
    keyStored: q('aiKeyStored'),
    keyClear: q('aiKeyClear'),
    keyMsg: q('aiKeyMsg'),
    piiHost: q('aiPiiHost'),
    remember: q('aiRemember'),
    rememberWarn: q('aiRememberWarn'),
    verifyBtn: q('aiVerifyBtn'),
    testBtn: q('aiTestBtn'),
    verifyBox: q('aiVerifyResult'),
    verifyText: q('aiVerifyText'),
    verifyHint: q('aiVerifyHint'),
    verifyMeta: q('aiVerifyMeta'),
    testBox: q('aiTestResult'),
    testText: q('aiTestText'),
    testSample: q('aiTestSample'),
    testOutput: q('aiTestOutput'),
    testHint: q('aiTestHint'),
    testMeta: q('aiTestMeta'),
    modelSel: q('aiModel'),
    dailyCap: q('aiDailyCap'),
    onDevice: q('aiOnDevice'),
    cacheSummary: q('aiCacheSummary'),
    readalongHost: q('settingsReadalongRow'),
    target: q('aiTargetLang'),
    voice: q('aiVoiceStatus'),
    howTo: q('aiVoiceHowTo'),
    howToBody: q('aiVoiceHowToBody')
  };
  // 반쪽 캐시(옛 index.html + 새 JS) — 그릇이 없으면 조용히 물러난다. 던지지 않는다.
  if (!els.keyInput || !els.verifyBtn || !els.testBtn) { els = null; return; }

  // 12-7 — 키 입력창 옆 상시 경고(아랍어 우선 + 현재 UI 언어).
  if (els.piiHost && !els.piiHost.querySelector('[data-pii-warning]')) {
    els.piiHost.appendChild(piiWarning());
  }

  root.addEventListener('click', onAction);
  els.providerSel.addEventListener('change', onProviderChange);
  els.modelSel.addEventListener('change', () => {
    const v = String(els.modelSel.value || '');
    if (v === REDACTED_MODEL) return;
    settings.set('ai.model', v).catch(() => { });
    sayModel(null);
  });
  els.remember.addEventListener('change', onRememberChange);
  els.dailyCap.addEventListener('change', onDailyCapChange);
  els.onDevice.addEventListener('change', () => {
    settings.set('ai.useOnDevice', !!els.onDevice.checked).catch(() => { });
  });
  els.keyInput.addEventListener('input', paintFormatWarning);
  els.consentCheck.addEventListener('change', () => { if (els.consentCheck.checked) els.consentHint.hidden = true; });

  onLangChange(() => { if (root && !root.hidden) paintAll(); });
}

/** 라우터가 이 화면을 보일 때마다. `params.tab` 은 지금 `ai` 하나뿐이다. */
export function showSettings(params) {
  if (!els) return;
  void params;
  paintAll();
  refreshVoice();
  paintCache();
}

/**
 * 화면을 떠날 때 — 진행 중인 호출을 끊고, **입력칸에 친 원문 키를 지운다.**
 * 저장하지 않고 떠난 키가 DOM 에 남아 있을 이유가 없다.
 */
export function leaveSettings() {
  for (const c of inflight) {
    try { c.abort(); } catch (e) { /* 이미 끝났다 */ }
  }
  inflight.clear();
  if (!els) return;
  els.keyInput.value = '';
  setKeyVisible(false);
  els.consentHint.hidden = true;
  say('');
}

/* ── 값 ─────────────────────────────────────────────── */

function providerId() {
  const p = settings.get('ai.provider');
  return provider.ADAPTERS[p] ? p : AI.DEFAULT_PROVIDER;
}

function adapterOf(pid) {
  try { return provider.getAdapter(pid); } catch (e) { return null; }
}

function providerLabel() {
  const a = adapterOf(providerId());
  return a ? a.label : providerId();
}

function targetLang() {
  return normalizeTranslationLang(settings.get('ai.translationLang'));
}

function currentModel() {
  const a = adapterOf(providerId());
  return String(settings.get('ai.model') || (a ? a.defaultModel : ''));
}

/** 친 키가 있으면 그것, 없으면 저장된 키. 원문은 **인자로만** 쓴다. */
function currentKey() {
  const typed = els.keyInput.value.trim();
  if (typed) return { key: typed, typed: true };
  const stored = keys.readKeySecret(providerId());
  return { key: stored || '', typed: false };
}

/* ── 그리기 ─────────────────────────────────────────── */

function paintAll() {
  if (!els) return;
  applyTranslations(root);
  paintProviders();
  paintKeyStored();
  paintFormatWarning();
  setKeyVisible(els.keyInput.type === 'text');
  els.keyPaste.hidden = !canPaste();
  els.remember.checked = !!settings.get('privacy.rememberKey');
  els.rememberWarn.hidden = !els.remember.checked;
  paintModels();
  els.dailyCap.value = String(settings.get('ai.dailyCap'));
  els.onDevice.checked = settings.get('ai.useOnDevice') !== false;
  renderReadalongRow(els.readalongHost);
  paintTarget();
  paintVoiceText();
  paintCacheText();
  say(lastSay);
  sayModel(lastModelSay);
  els.testSample.textContent = TEST_SAMPLE.join(' ');
  paintResult('verify');
  paintResult('test');
  paintBusy();
}

function paintProviders() {
  const ids = Object.keys(provider.ADAPTERS);
  if (els.providerSel.options.length !== ids.length) {
    while (els.providerSel.firstChild) els.providerSel.removeChild(els.providerSel.firstChild);
    for (let i = 0; i < ids.length; i++) {
      const o = document.createElement('option');
      o.value = ids[i];
      o.textContent = provider.ADAPTERS[ids[i]].label;
      els.providerSel.appendChild(o);
    }
  }
  els.providerSel.value = providerId();
}

/**
 * "저장된 키: AQ.Ab…6l — 이 탭에만". 마스킹된 값은 `bdi[dir=ltr]` 로 감싼다 —
 * 아랍어 문장 안에서 `AQ.Ab…6l` 의 점·말줄임이 뒤섞이지 않게.
 */
function paintKeyStored() {
  const pid = providerId();
  const at = keys.storedAt(pid);
  const host = els.keyStored;
  while (host.firstChild) host.removeChild(host.firstChild);
  if (at === keys.NONE) {
    host.textContent = t('settings.ai.key.none');
    els.keyClear.hidden = true;
    return;
  }
  els.keyClear.hidden = false;
  const key = at === keys.LOCAL ? 'settings.ai.key.storedLocal' : 'settings.ai.key.storedSession';
  fillWithBdi(host, t(key), 'masked', keys.readKeyMasked(pid), 'ltr', null);
}

/** `{name}` 자리에 `bdi` 를 꽂는다. 문자열 안에 HTML 을 넣지 않는다(11-2). */
function fillWithBdi(host, tpl, name, value, dir, lang) {
  while (host.firstChild) host.removeChild(host.firstChild);
  const mark = '{' + name + '}';
  const parts = String(tpl).split(mark);
  host.appendChild(document.createTextNode(parts[0]));
  if (parts.length > 1) {
    const b = document.createElement('bdi');
    if (dir) b.dir = dir;
    if (lang) b.lang = lang;
    b.textContent = value;
    host.appendChild(b);
    host.appendChild(document.createTextNode(parts.slice(1).join(mark)));
  }
}

/** 8-4 — 입력 중인 키, 없으면 저장된 키의 형식. 낯설면 **경고만**. */
function paintFormatWarning() {
  if (!els) return;
  const k = currentKey().key;
  const warn = k ? formatWarningKey(providerId(), k) : null;
  els.keyFormat.hidden = !warn;
}

function setKeyVisible(on) {
  els.keyInput.type = on ? 'text' : 'password';
  els.keyToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  els.keyToggle.textContent = t(on ? 'settings.ai.key.hide' : 'settings.ai.key.show');
}

function canPaste() {
  return !!(typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function');
}

function paintModels() {
  const pid = providerId();
  const a = adapterOf(pid);
  const sel = els.modelSel;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  if (!a) return;
  const list = remoteModels && remoteModels.pid === pid && remoteModels.models.length
    ? remoteModels.models
    : (a.staticModels || []).map((id) => ({ id: id, label: id }));
  const saved = currentModel();
  let has = false;
  for (let i = 0; i < list.length; i++) {
    const o = document.createElement('option');
    o.value = list[i].id;
    o.textContent = list[i].id === a.defaultModel
      ? t('settings.ai.model.default', { model: list[i].label })
      : list[i].label;
    if (list[i].id === saved) has = true;
    sel.appendChild(o);
  }
  let value = saved;
  if (!has && saved) {
    // 목록에 없는 저장값. **지운 뒤** 보인다 — 누가 모델 칸에 키를 넣어
    // 두었더라도 화면에 원문이 나오지 않게(7a 에서 실제로 있었던 경로).
    // 키처럼 보이면 `value` 속성에도 넣지 않는다(DOM 에 원문 0).
    const shown = redactString(saved, { keys: [keys.readKeySecret(pid) || ''] });
    value = shown === saved ? saved : REDACTED_MODEL;
    const o = document.createElement('option');
    o.value = value;
    o.textContent = shown;
    sel.appendChild(o);
  }
  sel.value = value;
}

/**
 * `[수정 2026-10-08]` "번역 언어"는 **선택**이다(운영자 결정 — spec 9-3 의 "보여 주기만"을 바꾼다).
 * 정적 HTML 에는 빈 그릇(`#aiTargetLang`)만 있고, 버튼은 여기서 한 번 만든다.
 * 버튼 동작은 이 화면의 `data-action` 위임 하나(`target-lang`)가 받는다.
 * 버튼 글자는 각 언어의 **자국어 이름**이고 `lang`·`dir` 도 그 언어에서 유도한다.
 */
function paintTarget() {
  const host = els.target;
  if (host.getAttribute('data-target-built') !== '1') {
    while (host.firstChild) host.removeChild(host.firstChild);
    const label = document.createElement('span');
    label.className = 'readalong-label';
    label.id = 'aiTargetLangLabel';
    label.setAttribute('data-i18n', 'settings.readalong.target');
    host.appendChild(label);
    const group = document.createElement('span');
    group.className = 'typeset-choices target-langs';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', 'aiTargetLangLabel');
    for (let i = 0; i < TRANSLATION_LANGS.length; i++) {
      const code = TRANSLATION_LANGS[i];
      const a = translationBlockAttrs(code);
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-action', 'target-lang');
      b.setAttribute('data-lang', code);
      b.setAttribute('aria-pressed', 'false');
      b.lang = a.lang;
      b.dir = a.dir;
      b.textContent = nativeLangName(code);
      group.appendChild(b);
    }
    host.appendChild(group);
    host.setAttribute('data-target-built', '1');
  }
  const lbl = host.querySelector('#aiTargetLangLabel');
  if (lbl) lbl.textContent = t('settings.readalong.target');
  const lang = targetLang();
  const bs = host.querySelectorAll('[data-action="target-lang"]');
  for (let i = 0; i < bs.length; i++) {
    bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-lang') === lang ? 'true' : 'false');
  }
}

function onTargetLang(btn) {
  const lang = normalizeTranslationLang(btn.getAttribute('data-lang'));
  if (lang === targetLang()) return;
  settings.set('ai.translationLang', lang).catch(() => { });
  paintTarget();
  // "번역문 음성: 있음/없음"은 **선택한 언어**의 음성으로 다시 판정한다.
  refreshVoice();
}

function paintVoiceText() {
  const lang = targetLang();
  const key = lastVoice === 'yes' ? 'settings.readalong.voice.yes'
    : lastVoice === 'no' ? 'settings.readalong.voice.no'
      : 'settings.readalong.voice.checking';
  els.voice.textContent = t(key);
  els.voice.setAttribute('data-voice', lastVoice || 'checking');
  els.howTo.hidden = lastVoice !== 'no';
  if (lastVoice !== 'no') {
    els.howToBody.hidden = true;
    els.howTo.setAttribute('aria-expanded', 'false');
  }
  fillWithBdi(els.howToBody, t('settings.readalong.voice.howToBody'), 'lang', nativeLangName(lang), dirOf(lang), lang);
}

async function refreshVoice() {
  lastVoice = null;
  paintVoiceText();
  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  let voices = [];
  try { voices = synth ? await loadVoices(synth, TTS.VOICES_TIMEOUT_MS) : []; } catch (e) { voices = []; }
  lastVoice = voiceStatus(targetLang(), voices);
  if (els) paintVoiceText();
}

/** 캐시 줄 — 센 값을 들고 있다가 언어가 바뀌면 그 값으로 다시 쓴다. */
let lastCacheCount = null;   // number | 'error' | null(아직)

async function paintCache() {
  if (!els) return;
  try {
    lastCacheCount = Number(await db.count('aiCache')) || 0;
  } catch (e) {
    lastCacheCount = 'error';
  }
  paintCacheText();
}

function paintCacheText() {
  if (!els || lastCacheCount === null) return;
  if (lastCacheCount === 'error') {
    els.cacheSummary.textContent = t('settings.ai.cache.unknown');
    return;
  }
  const limit = Number(settings.get('ai.cacheLimitMB')) || 0;
  els.cacheSummary.textContent = t('settings.ai.cache.summary', {
    n: formatNumber(lastCacheCount), limit: formatNumber(limit)
  });
}

/**
 * 결과 상자 하나를 그린다. 갈래·시간·코드는 **결과 객체에서** 다시 만든다 —
 * 언어를 바꾸면 같은 결과가 새 언어로 다시 쓰인다.
 */
function paintResult(kind) {
  const r = kind === 'verify' ? lastVerify : lastTest;
  const box = kind === 'verify' ? els.verifyBox : els.testBox;
  const text = kind === 'verify' ? els.verifyText : els.testText;
  const hint = kind === 'verify' ? els.verifyHint : els.testHint;
  const meta = kind === 'verify' ? els.verifyMeta : els.testMeta;
  const out = kind === 'test' ? els.testOutput : null;

  if (!r) { box.hidden = true; return; }
  box.hidden = false;

  if (r.running) {
    box.setAttribute('data-outcome', 'running');
    text.textContent = t(kind === 'verify' ? 'settings.ai.verify.running' : 'settings.ai.test.running');
    hint.hidden = true;
    meta.textContent = '';
    if (out) { out.hidden = true; out.textContent = ''; }
    return;
  }

  box.setAttribute('data-outcome', r.outcome);
  const key = outcomeKey(r.outcome, kind);
  let msg = key ? t(key, { provider: providerLabel() }) : '';
  if (kind === 'test' && r.outcome === OUTCOME.VALID && r.empty) msg = t('settings.ai.test.empty');
  text.textContent = msg;

  const lines = [];
  if (r.outcome === OUTCOME.UNKNOWN && r.maybeBlocked) lines.push(t('settings.ai.verify.maybeBlocked'));
  // 8-2 — 판정 근거(서버 메시지)는 `dev.debug` 일 때만. 이미 실제 키로 지워져 있다.
  if (settings.get('dev.debug') && r.message) lines.push(r.message);
  hint.textContent = lines.join('\n');
  hint.hidden = lines.length === 0;

  if (r.outcome === OUTCOME.NO_KEY) meta.textContent = '';
  else if (kind === 'test') meta.textContent = testMetaText(r);
  else meta.textContent = t('settings.ai.result.meta', { ms: formatNumber(r.ms), code: codeLabel(r.code, r.status) });

  if (out) paintTestOutput(out, r);
}

/**
 * `[수정 2026-10-08]` [시험 번역] 결과 — 아랍어·한국어 **두 블록**.
 * 블록마다 `lang`·`dir` 을 그 언어에서 유도한다(`translationBlockAttrs`).
 * JSON 파싱에 실패했으면 응답 문자열을 **그대로** 한 블록으로(`dir=auto`).
 * ★ AI 응답은 **textContent** 로만(13절).
 */
/**
 * `[신설 2026-10-08 — 운영자 결정]` 번역문을 넣는다. 오른쪽→왼쪽 블록이면 라틴 문자 구간
 * (영어 원어 괄호 등)을 `<bdi dir="ltr">` 로 격리한다 — 그냥 넣으면 줄바꿈 지점에서
 * "(C-" / "reactive protein)" 처럼 갈라지고 괄호가 뒤집혔다(실키 확인 캡처).
 * 조각마다 **textContent** 다(13절 — AI 응답을 HTML 로 해석하지 않는다).
 * 8b 자막 띠도 같은 규칙(`text/bidi.js` 의 `ltrRuns`)을 쓴다.
 */
function appendBidiText(el, text, dir) {
  const s = String(text == null ? '' : text);
  if (dir !== 'rtl') { el.textContent = s; return; }
  const doc = el.ownerDocument;
  const runs = ltrRuns(s);
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].ltr) {
      const iso = doc.createElement('bdi');
      iso.dir = 'ltr';
      iso.textContent = runs[i].text;
      el.appendChild(iso);
    } else {
      el.appendChild(doc.createTextNode(runs[i].text));
    }
  }
}

function paintTestOutput(out, r) {
  while (out.firstChild) out.removeChild(out.firstChild);
  out.removeAttribute('lang');
  out.removeAttribute('dir');
  const show = r.outcome === OUTCOME.VALID && !!r.text;
  out.hidden = !show;
  if (!show) return;

  if (r.pair) {
    for (let i = 0; i < TEST_PAIR_LANGS.length; i++) {
      const code = TEST_PAIR_LANGS[i];
      const a = translationBlockAttrs(code);
      const block = document.createElement('span');
      block.className = 'ai-tr-block';
      block.setAttribute('data-tr-lang', code);
      const name = document.createElement('span');
      name.className = 'ai-tr-lang';
      name.lang = a.lang;
      name.dir = a.dir;
      name.textContent = nativeLangName(code);
      const body = document.createElement('span');
      body.className = 'ai-tr-text';
      body.lang = a.lang;
      body.dir = a.dir;
      appendBidiText(body, r.pair[code], a.dir);
      block.appendChild(name);
      block.appendChild(body);
      out.appendChild(block);
    }
    return;
  }

  const raw = document.createElement('span');
  raw.className = 'ai-tr-block ai-tr-raw';
  raw.dir = 'auto';
  raw.textContent = r.text;
  out.appendChild(raw);
}

function paintBusy() {
  els.verifyBtn.disabled = busy;
  els.testBtn.disabled = busy;
  els.verifyBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  els.testBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
}

/** 키 줄 아래 한 줄 알림. 키(i18n)를 들고 있다가 언어가 바뀌면 다시 쓴다. */
let lastSay = '';

function say(key) {
  lastSay = key || '';
  if (els && els.keyMsg) els.keyMsg.textContent = lastSay ? t(lastSay) : '';
}

/** 모델 칸 아래 한 줄 경고. 언어가 바뀌면 이것으로 다시 쓴다. */
let lastModelSay = null;

/**
 * `[신설 2026-10-08]` 모델 칸 아래 한 줄 경고("저장된 모델을 쓸 수 없어 … 로 바꿨습니다").
 * 그릇은 정적 HTML 에 없다 — 처음 필요할 때 모델 칸 바로 뒤에 만든다.
 * 모델 이름은 서버 목록·기본값에서 온 것이고 `textContent` 로만 들어간다.
 * @param {{key:string, params:Object}|null} m
 */
function sayModel(m) {
  lastModelSay = m || null;
  if (!els || !els.modelSel) return;
  let p = root.querySelector('#aiModelMsg');
  if (!p && !lastModelSay) return;
  if (!p) {
    p = document.createElement('p');
    p.id = 'aiModelMsg';
    p.className = 'warn-note';
    p.setAttribute('role', 'status');
    els.modelSel.parentNode.insertBefore(p, els.modelSel.nextSibling);
  }
  p.hidden = !lastModelSay;
  p.textContent = lastModelSay ? t(lastModelSay.key, lastModelSay.params) : '';
}

/**
 * 원격 모델 목록을 받아 드롭다운을 바꾸고, 지금 모델이 목록에 없으면 바꾼다(경고 한 줄).
 * [검증] 통과 뒤, 그리고 [시험 번역]이 `MODEL_UNAVAILABLE` 일 때 부른다. 던지지 않는다.
 */
async function refreshModels(key, pid) {
  let m = null;
  try { m = await provider.listModels(key, { provider: pid }); } catch (e) { m = null; }
  if (!m || !m.fromRemote || !els) return;
  const a = adapterOf(pid);
  const usable = usableModels(m.models, a);
  if (!usable.length) return;
  remoteModels = { pid: pid, models: usable };
  const def = a ? a.defaultModel : '';
  const r = reconcileModel(settings.get('ai.model'), usable, def);
  if (r.replaced) {
    // 기본 모델이면 '' 로 저장한다 — "설정 안 됨 = 기본"이 다음 기본값 변경도 따라간다.
    settings.set('ai.model', r.model === def ? '' : r.model).catch(() => { });
    sayModel({ key: 'settings.ai.model.replaced', params: { model: r.model } });
  }
  paintModels();
}

/* ── 동작 — `data-action` 위임 하나 ───────────────────── */

function onAction(ev) {
  const btn = ev.target.closest('[data-action]');
  if (!btn || !root.contains(btn) || btn.disabled) return;
  switch (btn.getAttribute('data-action')) {
    case 'key-toggle': setKeyVisible(els.keyInput.type !== 'text'); break;
    case 'key-paste': pasteKey(); break;
    case 'key-save': saveTyped(true); break;
    case 'key-clear': clearStoredKey(); break;
    case 'verify': onVerify(); break;
    case 'test': onTest(); break;
    case 'consent-agree': onConsentAgree(); break;
    case 'cache-clear': onCacheClear(); break;
    case 'target-lang': onTargetLang(btn); break;
    case 'voice-howto': {
      const open = els.howToBody.hidden;
      els.howToBody.hidden = !open;
      els.howTo.setAttribute('aria-expanded', open ? 'true' : 'false');
      break;
    }
    default: break;
  }
}

async function pasteKey() {
  try {
    const s = await navigator.clipboard.readText();
    if (typeof s === 'string' && s.trim()) {
      els.keyInput.value = s.trim();
      paintFormatWarning();
    }
  } catch (e) {
    // 권한 거부 — 길게 눌러 붙여넣을 수 있도록 입력칸으로 보낸다.
  }
  els.keyInput.focus();
}

/**
 * 입력칸의 키를 저장한다. **저장 뒤 입력칸을 비운다** — 원문이 DOM 에 남지 않게.
 * 형식이 낯설어도 저장한다(8-4 — 경고만).
 * @param {boolean} announce 저장 결과를 문구로 알릴지
 * @returns {boolean} 저장했는가
 */
function saveTyped(announce) {
  const raw = els.keyInput.value.trim();
  if (!raw) { if (announce) say('settings.ai.key.empty'); return false; }
  const pid = providerId();
  const r = keys.saveKey(pid, raw, { remember: !!settings.get('privacy.rememberKey') });
  if (!r.ok) {
    say(r.code === keys.CODES.EMPTY ? 'settings.ai.key.empty' : 'settings.ai.key.blocked');
    return false;
  }
  els.keyInput.value = '';
  setKeyVisible(false);
  if (remoteModels && remoteModels.pid === pid) remoteModels = null;   // 다른 키의 목록일 수 있다
  paintKeyStored();
  paintFormatWarning();
  paintModels();
  if (announce) say('settings.ai.key.saved');
  return true;
}

function clearStoredKey() {
  const pid = providerId();
  keys.clearKey(pid);
  remoteModels = null;
  sayModel(null);
  paintKeyStored();
  paintFormatWarning();
  paintModels();
  say('settings.ai.key.removed');
}

function onProviderChange() {
  const v = els.providerSel.value;
  if (!provider.ADAPTERS[v]) return;
  settings.set('ai.provider', v).catch(() => { });
  remoteModels = null;
  paintAll();
}

function onRememberChange() {
  const on = !!els.remember.checked;
  settings.set('privacy.rememberKey', on).catch(() => { });
  // 13절 — **이미 저장된 키를 옮긴다.** 끄면 localStorage 에서 사라져야 한다.
  keys.setRemember(providerId(), on);
  els.rememberWarn.hidden = !on;
  paintKeyStored();
}

function onDailyCapChange() {
  const n = parseDailyCap(els.dailyCap.value);
  if (n === null) {
    els.dailyCap.value = String(settings.get('ai.dailyCap'));
    return;
  }
  els.dailyCap.value = String(n);
  settings.set('ai.dailyCap', n).catch(() => { });
}

/**
 * 13절 · 12-2 — 동의 전이면 AI 호출 대신 **동의 카드로 연결**한다.
 * @returns {boolean} 지금 호출해도 되는가
 */
function requireConsent() {
  if (!needsConsent(settings.get('privacy.consentedAt'))) return true;
  els.consentCard.hidden = false;
  const h = els.consentCard.querySelector('h2');
  if (h) {
    h.setAttribute('tabindex', '-1');
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }
  try { els.consentCard.scrollIntoView({ block: 'start' }); } catch (e) { /* 옛 브라우저 */ }
  return false;
}

async function onConsentAgree() {
  if (!els.consentCheck.checked) {
    els.consentHint.hidden = false;
    els.consentCheck.focus();
    return;
  }
  await settings.set('privacy.consentedAt', new Date().toISOString()).catch(() => { });
  els.consentHint.hidden = true;
  els.consentCard.hidden = true;
  try { els.verifyBtn.focus(); } catch (e) { /* 무시 */ }
}

function newAbort() {
  const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if (c) inflight.add(c);
  return c;
}

function done(c) { if (c) inflight.delete(c); }

async function onVerify() {
  if (busy || !requireConsent()) return;
  const pid = providerId();
  const k = currentKey();
  if (!k.key) { lastVerify = { outcome: OUTCOME.NO_KEY, ms: 0, code: CODES.NO_KEY, status: 0 }; paintResult('verify'); return; }

  busy = true; paintBusy();
  lastVerify = { running: true }; paintResult('verify');
  const c = newAbort();
  const r = await runVerify({ key: k.key, provider: pid, signal: c ? c.signal : undefined });
  done(c);
  busy = false;
  if (!els) return;
  paintBusy();
  if (r.outcome === OUTCOME.ABORTED) { lastVerify = null; paintResult('verify'); return; }

  // 8-4 — `canSave` 가 거짓인 것은 AUTH 뿐이다. 지역 제한·확인 불가는 저장한다.
  if (k.typed && r.canSave) saveTyped(false);
  lastVerify = r;
  paintResult('verify');

  // 검증이 통과했으면 모델 목록을 원격으로 받는다(실패하면 정적 목록 그대로 — 8-4).
  // 지금 모델이 목록에 없으면 기본 모델로 바꾸고 한 줄 알린다(`refreshModels`).
  if (r.outcome === OUTCOME.VALID || r.outcome === OUTCOME.LIMITED) {
    await refreshModels(k.key, pid);
  }
}

async function onTest() {
  if (busy || !requireConsent()) return;
  const pid = providerId();
  const k = currentKey();
  if (!k.key) { lastTest = { outcome: OUTCOME.NO_KEY, ms: 0, code: CODES.NO_KEY, status: 0 }; paintResult('test'); return; }

  busy = true; paintBusy();
  lastTest = { running: true }; paintResult('test');
  const c = newAbort();
  const r = await runTestTranslation({
    key: k.key, provider: pid, model: currentModel(),
    signal: c ? c.signal : undefined
  });
  done(c);
  busy = false;
  if (!els) return;
  paintBusy();
  if (r.outcome === OUTCOME.ABORTED) { lastTest = null; paintResult('test'); return; }

  if (k.typed && r.outcome !== OUTCOME.INVALID) saveTyped(false);
  lastTest = r;
  paintResult('test');

  // `[신설 2026-10-08]` 이 모델을 쓸 수 없다 — 모델 목록을 새로 받아 드롭다운을 고친다.
  if (r.outcome === OUTCOME.MODEL) await refreshModels(k.key, pid);
}

async function onCacheClear() {
  let ok = true;
  try { ok = window.confirm(t('settings.ai.cache.confirm')); } catch (e) { ok = false; }
  if (!ok) return;
  try {
    await db.clearStore('aiCache');
    say('settings.ai.cache.cleared');
  } catch (e) {
    say('settings.ai.cache.unknown');
  }
  paintCache();
}
