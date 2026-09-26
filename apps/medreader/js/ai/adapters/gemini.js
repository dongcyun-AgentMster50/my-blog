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
   * `'RATE_LIMIT' | 'AUTH' | 'SERVER' | 'BAD_REQUEST' | 'SAFETY' | 'UNKNOWN'`
   *
   * 상태 코드를 먼저 보고, 애매할 때만 본문의 `error.status` 를 본다.
   * (Google API 는 400 에 `FAILED_PRECONDITION`·`INVALID_ARGUMENT` 등을 섞어 준다.)
   */
  errorParser(status, json) {
    const s = Number(status) || 0;
    const gs = json && json.error && typeof json.error.status === 'string' ? json.error.status : '';

    if (s === 429 || gs === 'RESOURCE_EXHAUSTED') return 'RATE_LIMIT';
    if (s === 401 || s === 403 || gs === 'UNAUTHENTICATED' || gs === 'PERMISSION_DENIED') return 'AUTH';
    if (s >= 500) return 'SERVER';
    if (s === 400 || s === 404 || gs === 'INVALID_ARGUMENT' || gs === 'NOT_FOUND') return 'BAD_REQUEST';
    return 'UNKNOWN';
  },

  /**
   * 8-4 모델 목록. `GET /v1beta/models` 응답에서 생성 가능한 것만 추린다.
   * 이름은 `models/gemini-…` 로 오므로 접두사를 뗀다.
   */
  modelsParser(json) {
    const arr = json && Array.isArray(json.models) ? json.models : [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      if (!m || typeof m.name !== 'string') continue;
      const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : null;
      if (methods && methods.indexOf('generateContent') < 0) continue;
      const id = m.name.indexOf('models/') === 0 ? m.name.slice(7) : m.name;
      out.push({ id: id, label: typeof m.displayName === 'string' && m.displayName ? m.displayName : id });
    }
    return out;
  }
});

export default gemini;
