/* ============================================================
   MedReader — Gemini 어댑터 (spec 8-2 표의 gemini 행)

   ── 어댑터는 함수 몇 개로 된 **선언 객체**다(8-2) ────────
   상태가 없고, `fetch` 를 부르지 않는다. 부르는 것은 `provider.js` 다.
   그래서 이 파일은 네트워크 없이 전수 테스트된다.

   ── ★ 키는 헤더로만 간다 ────────────────────────────────
   Gemini 는 `?key=` 쿼리도 받는다. **쓰지 않는다.** URL 은 브라우저 히스토리·
   `Referer`·프록시 로그·예외 스택에 남는다. 8-2 표가 `x-goog-api-key` 를
   명시했고 13절이 "요청 URL 에 키를 넣지 않는다(헤더만)"를 규칙으로 못 박았다.
   `endpoint()` 와 `verifyEndpoint()` 는 **키를 인자로 받지도 않는다** —
   받지 않으면 넣을 수 없다.
   ============================================================ */

import { AI, AI_KEY_PATTERNS } from '../../config.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** URL 경로에 실릴 수 있는 모델 이름의 모양. 이보다 넓힐 이유가 없다. */
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** 모델 목록 한 쪽의 크기. 한 번에 다 오도록 넉넉히(다음 쪽이 있으면 따라간다). */
const MODELS_PAGE_SIZE = 1000;

/**
 * `[수정 2026-10-08 — 운영자 결정 "안정판만"]` **허용 목록**: `gemini-<버전>-flash-lite|flash|pro` 꼴만 남긴다.
 * 처음엔 번역에 맞지 않는 계열을 빼는 **제외 목록**이었는데, 실제 목록에는 `Nano Banana`(이미지)·
 * `Robotics-ER`·`Omni`·`gemma-*`·`*-latest` 별칭·`*-preview` 처럼 이름을 미리 알 수 없는 것이 섞여
 * 그대로 통과했다(2026-10-08 실키 확인 캡처). 형식을 맞히는 쪽만 통과시키면 새 계열이 생겨도 새지 않는다.
 * `-preview`·`-latest`·날짜 접미는 이 꼴에 맞지 않으므로 저절로 빠진다.
 */
const STABLE_MODEL = /^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)$/;

/** `'3.5'` → `[3, 5]`. 비교용. */
function versionOf(id) {
  const m = STABLE_MODEL.exec(id);
  if (!m) return null;
  const p = m[1].split('.');
  return { family: m[2], major: Number(p[0]) || 0, minor: Number(p[1] || 0) || 0 };
}

/** 계열 표시 순서 — 가벼운 것부터(번역 기본은 flash-lite). */
const FAMILY_ORDER = Object.freeze(['flash-lite', 'flash', 'pro']);

export const gemini = Object.freeze({
  id: 'gemini',
  label: 'Google Gemini',

  /* 8-4 — 길이 하한만. 불일치는 경고일 뿐 저장을 막지 않는다. */
  keyPattern: AI_KEY_PATTERNS.gemini,

  defaultModel: AI.DEFAULT_MODEL.gemini,
  staticModels: AI.STATIC_MODELS.gemini,

  /**
   * 생성 엔드포인트. **키를 받지 않는다.**
   *
   * ★ 모델 이름은 설정에서 사용자가 바꾸는 문자열이고, 그래서 **URL 로 들어가는
   *   유일한 가변 값**이다. `encodeURIComponent` 만으로는 모자라다 — 그것은
   *   `?` 를 `%3F` 로 바꿔 쿼리가 **생기는 것**만 막을 뿐, 이상한 값이 URL
   *   경로에 그대로 실려 로그·`Referer` 에 남는 것은 막지 못한다. 누가
   *   실수로 키를 모델 칸에 붙여 넣으면 그 키가 URL 에 찍힌다.
   *
   *   그래서 **허용 문자 목록**으로 거른다. 모델 이름은 실제로
   *   `gemini-2.5-flash-lite` 처럼 영숫자·점·붙임표·밑줄뿐이다. 거기서
   *   벗어나면 기본 모델로 돌아간다 — 낯선 모델 이름을 못 쓰는 것이
   *   키가 URL 에 실리는 것보다 낫다(13절).
   */
  endpoint(model) {
    const raw = String(model === undefined || model === null ? '' : model);
    const safe = SAFE_MODEL.test(raw) ? raw : AI.DEFAULT_MODEL.gemini;
    return BASE + '/models/' + encodeURIComponent(safe) + ':generateContent';
  },

  /* 8-4 "가장 싼 요청 — `GET /v1beta/models?pageSize=1`. 토큰 소비 0." */
  verifyEndpoint() {
    return BASE + '/models?pageSize=1';
  },
  verifyMethod: 'GET',

  /**
   * `[신설 2026-10-08]` 모델 **목록** 전용 엔드포인트. **키를 받지 않는다.**
   *
   * 7b 는 `listModels` 가 `verifyEndpoint()`(`pageSize=1`)를 재사용해 모델이 **1개만**
   * 왔다. 검증은 가장 싼 요청이어야 하므로 `pageSize=1` 을 그대로 두고, 목록은 따로 간다.
   * 다음 쪽이 있으면 `pageToken` 을 붙인다 — 서버가 준 값이라 `encodeURIComponent`
   * 하고, 키가 섞였는지는 `provider.js` 의 `assertNoKeyInUrl` 이 다시 본다.
   */
  modelsEndpoint(pageToken) {
    const tok = typeof pageToken === 'string' && pageToken !== ''
      ? '&pageToken=' + encodeURIComponent(pageToken)
      : '';
    return BASE + '/models?pageSize=' + MODELS_PAGE_SIZE + tok;
  },
  modelsMethod: 'GET',

  /** 8-2 인증 헤더. 이 객체는 **로그에 찍히면 안 된다**. */
  headers(key) {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': String(key || '')
    };
  },

  /**
   * 8-2 — `systemInstruction` · `contents[{role:'user',parts:[{text}]}]` ·
   * `generationConfig.responseMimeType = 'application/json'` (+ `responseSchema`).
   *
   * 프롬프트 내용은 모른다(8-1: "프로바이더는 프롬프트 내용을 모른다").
   */
  bodyBuilder(req, model) {
    const r = req || {};
    const gen = {};
    if (r.json !== false) gen.responseMimeType = 'application/json';
    if (r.schema) gen.responseSchema = r.schema;
    if (Number.isFinite(r.maxOutputTokens)) gen.maxOutputTokens = r.maxOutputTokens;
    if (Number.isFinite(r.temperature)) gen.temperature = r.temperature;

    const body = {
      contents: [{ role: 'user', parts: [{ text: String(r.user || '') }] }],
      generationConfig: gen
    };
    if (r.system) body.systemInstruction = { parts: [{ text: String(r.system) }] };
    // `model` 은 URL 에 있다. 본문에 다시 넣지 않는다(8-2 표).
    return body;
  },

  /**
   * 8-2 — `usageMetadata.promptTokenCount` / `candidatesTokenCount`.
   *
   * `finishReason` 을 **그대로 올려 보낸다.** `'SAFETY'` 를 `SAFETY` 코드로
   * 바꾸는 판단은 `provider.js` 가 한다 — 어댑터는 오류를 던지지 않는다.
   *
   * @returns {{text: string, usage: {input:number, output:number}|null, finishReason: string|null, blockReason: string|null}}
   */
  responseParser(json) {
    const j = json || {};
    const cand = Array.isArray(j.candidates) && j.candidates.length ? j.candidates[0] : null;

    let text = '';
    if (cand && cand.content && Array.isArray(cand.content.parts)) {
      const parts = cand.content.parts;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] && typeof parts[i].text === 'string') text += parts[i].text;
      }
    }

    const um = j.usageMetadata;
    const usage = um && (Number.isFinite(um.promptTokenCount) || Number.isFinite(um.candidatesTokenCount))
      ? { input: Number(um.promptTokenCount) || 0, output: Number(um.candidatesTokenCount) || 0 }
      : null;

    return {
      text: text,
      usage: usage,
      finishReason: cand && typeof cand.finishReason === 'string' ? cand.finishReason : null,
      // 프롬프트 자체가 막히면 candidates 가 아예 없고 여기만 채워진다.
      blockReason: j.promptFeedback && typeof j.promptFeedback.blockReason === 'string'
        ? j.promptFeedback.blockReason
        : null
    };
  },

  /**
   * 8-2 — 상태 코드(+ 본문)를 코드로 바꾼다.
   * `'REGION' | 'AUTH' | 'MODEL_UNAVAILABLE' | 'RATE_LIMIT' | 'SERVER' | 'BAD_REQUEST' | 'UNKNOWN'`
   *
   * 상태 코드를 먼저 보고, 애매할 때만 본문의 `error.status` 를 본다.
   * (Google API 는 400 에 `FAILED_PRECONDITION`·`INVALID_ARGUMENT` 등을 섞어 준다.)
   */
  errorParser(status, json) {
    const s = Number(status) || 0;
    const gs = json && json.error && typeof json.error.status === 'string' ? json.error.status : '';
    const msg = json && json.error && typeof json.error.message === 'string' ? json.error.message : '';

    // 8-2 `[신설 2026-09-28]` 지역 제한 — AUTH·BAD_REQUEST 보다 **먼저** 본다.
    // 이것을 AUTH 로 안내하면 사용자는 멀쩡한 키를 영원히 다시 넣는다(시리아의 Nour).
    // 쓸 수 있는 재료: s(HTTP 상태), gs(`error.status` 예: 'FAILED_PRECONDITION'), msg(`error.message`).
    // 알려진 형태 `[가정]`: 400 + FAILED_PRECONDITION, 403 + "User location is not supported ..."
    // 사용자 결정(방법 B): 문구는 느슨하게 찾는다 — 놓치면 Nour 가 키 오류로 오해해 갇힌다.
    // 실제 거절 원문을 Nour 기기에서 받으면 이 판정을 그 원문에 맞춰 다시 본다.
    const m = msg.toLowerCase();
    if (m.indexOf('location') >= 0 && m.indexOf('not supported') >= 0) return 'REGION';
    if (s === 400 && gs === 'FAILED_PRECONDITION') return 'REGION';

    // 7b Review R1 — 무효 키. Gemini 는 틀린 키에 **400** `INVALID_ARGUMENT` +
    // `details[].reason:'API_KEY_INVALID'` + "API key not valid…" 를 준다(`[가정]`, 실물 확인 전).
    // 아래 BAD_REQUEST 로 떨어지면 "확인 불가 · 저장 가능"이 되어 **틀린 키가 저장된다.**
    // REGION 판정 **뒤**에 둔다 — 지역 문구가 섞인 응답은 여전히 REGION 이다.
    const details = json && json.error && Array.isArray(json.error.details) ? json.error.details : [];
    for (let i = 0; i < details.length; i++) {
      if (details[i] && details[i].reason === 'API_KEY_INVALID') return 'AUTH';
    }
    if (m.indexOf('api key not valid') >= 0) return 'AUTH';

    // `[신설 2026-10-08]` 모델을 쓸 수 없다 — 지원 종료·이름 오타·이 키에 열리지 않은 모델.
    // 실키 확인(2026-10-05)에서 `gemini-2.5-flash-lite` 가 새 키에 **404** 였고, 이것이
    // BAD_REQUEST("확인 불가 · 키는 저장할 수 있습니다")로 안내됐다. 키 문제가 아니다.
    // REGION·R1 AUTH **아래**, 나머지 판정 **위**(지역·무효 키 표지가 섞이면 그쪽이 먼저다).
    if (s === 404 || gs === 'NOT_FOUND') return 'MODEL_UNAVAILABLE';

    if (s === 429 || gs === 'RESOURCE_EXHAUSTED') return 'RATE_LIMIT';
    if (s === 401 || s === 403 || gs === 'UNAUTHENTICATED' || gs === 'PERMISSION_DENIED') return 'AUTH';
    if (s >= 500) return 'SERVER';
    if (s === 400 || gs === 'INVALID_ARGUMENT') return 'BAD_REQUEST';
    return 'UNKNOWN';
  },

  /**
   * 8-4 모델 목록 **한 쪽**. `GET /v1beta/models` 응답에서 번역에 쓸 수 있는 것만 추린다.
   * 이름은 `models/gemini-…` 로 오므로 접두사를 뗀다.
   *
   * `[수정 2026-10-08]`
   * - `supportedGenerationMethods` 에 `generateContent` 가 **있는 것만**(없거나 빠졌으면 뺀다).
   * - **안정판 꼴(`STABLE_MODEL`)만** 남긴다(`[수정 2026-10-08]` 제외 목록 → 허용 목록).
   *   계열마다 최신 하나로 줄이는 일은 **여러 쪽을 합친 뒤** `curateModels` 가 한다.
   * - 기본 모델을 맨 앞에(여러 쪽을 합친 뒤 `provider.listModels` 가 한 번 더 정렬한다).
   * - `nextPageToken` 을 함께 돌려준다 — 다음 쪽을 부를지는 `provider.js` 가 정한다.
   *
   * @returns {{id:string,label:string}[] & {nextPageToken?: string}}
   */
  modelsParser(json) {
    const arr = json && Array.isArray(json.models) ? json.models : [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      if (!m || typeof m.name !== 'string') continue;
      const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      if (methods.indexOf('generateContent') < 0) continue;
      const id = m.name.indexOf('models/') === 0 ? m.name.slice(7) : m.name;
      if (!SAFE_MODEL.test(id) || !STABLE_MODEL.test(id)) continue;
      out.push({ id: id, label: typeof m.displayName === 'string' && m.displayName ? m.displayName : id });
    }
    const def = AI.DEFAULT_MODEL.gemini;
    out.sort((a, b) => (a.id === def ? -1 : b.id === def ? 1 : 0));
    const next = json && typeof json.nextPageToken === 'string' ? json.nextPageToken : '';
    if (next) out.nextPageToken = next;
    return out;
  },

  /**
   * `[신설 2026-10-08 — 운영자 결정 "필요한 몇 개만, 예전 모델은 필요 없다"]`
   * 합친 목록에서 **계열(flash-lite·flash·pro)마다 가장 높은 버전 하나**만 남긴다.
   * 기본 모델은 더 새 버전이 있어도 남긴다(사용자가 고른 기준점). 순서: 기본 → flash-lite → flash → pro.
   * 쪽마다 하면 "가장 높은 버전"을 잘못 고르므로 쪽을 다 합친 뒤에 부른다.
   * @param {{id:string,label:string}[]} models
   * @param {string} def 기본 모델 id
   */
  curateModels(models, def) {
    const list = Array.isArray(models) ? models : [];
    const best = {};
    let defEntry = null;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const v = m && versionOf(m.id);
      if (!v) continue;
      if (m.id === def) defEntry = m;
      const cur = best[v.family];
      if (!cur || v.major > cur.v.major || (v.major === cur.v.major && v.minor > cur.v.minor)) {
        best[v.family] = { m: m, v: v };
      }
    }
    const out = defEntry ? [defEntry] : [];
    for (let f = 0; f < FAMILY_ORDER.length; f++) {
      const b = best[FAMILY_ORDER[f]];
      if (b && b.m.id !== def) out.push(b.m);
    }
    return out;
  }
});

export default gemini;
