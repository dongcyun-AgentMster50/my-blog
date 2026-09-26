/* ============================================================
   MedReader — 토큰 근사 (spec 8-5)

   ── 순수 계층이다(3-2) ──────────────────────────────────
   `config.js` 만 import 한다.

   8-5: "라틴 문자 위주면 `ceil(chars / 4)`, 아랍어·한글 비율이 30% 이상이면
   `ceil(chars / 2)`."

   이것은 **요청 전 분할 판단용 근사**다. 응답에 실제 `usage` 가 오면 그것을
   기록하고 추정치는 버린다(8-5). 그러므로 여기서 정확도를 더 짜낼 이유가 없다.
   ============================================================ */

import { AI } from '../config.js';

/**
 * 아랍 문자인가. 기본 블록 + 보충 + 표현형(FB50~, FE70~)까지 본다.
 * 표현형까지 세는 이유: PDF 추출본에 표현형 코드포인트가 섞여 나온다.
 */
function isArabic(cp) {
  return (cp >= 0x0600 && cp <= 0x06FF) ||
         (cp >= 0x0750 && cp <= 0x077F) ||
         (cp >= 0x08A0 && cp <= 0x08FF) ||
         (cp >= 0xFB50 && cp <= 0xFDFF) ||
         (cp >= 0xFE70 && cp <= 0xFEFF);
}

/** 한글인가. 음절 + 자모 + 호환 자모 + 확장. */
function isHangul(cp) {
  return (cp >= 0xAC00 && cp <= 0xD7A3) ||
         (cp >= 0x1100 && cp <= 0x11FF) ||
         (cp >= 0x3130 && cp <= 0x318F) ||
         (cp >= 0xA960 && cp <= 0xA97F) ||
         (cp >= 0xD7B0 && cp <= 0xD7FF);
}

/**
 * 아랍어·한글 글자 수와 전체 글자 수.
 *
 * 코드포인트 단위로 센다(`for...of`). `String.length` 는 UTF-16 코드유닛이라
 * 서로게이트 쌍을 2 로 세는데, 그러면 이모지가 섞인 문자열의 비율이 흐트러진다.
 *
 * @returns {{wide: number, total: number}}
 */
export function countWide(text) {
  const s = typeof text === 'string' ? text : '';
  let wide = 0;
  let total = 0;
  for (const ch of s) {
    total++;
    const cp = ch.codePointAt(0);
    if (isArabic(cp) || isHangul(cp)) wide++;
  }
  return { wide: wide, total: total };
}

/**
 * 넓은 문자 비율이 임계(30%) **이상**인가.
 *
 * ★ `wide / total >= 0.3` 으로 쓰지 않는다. `0.3` 은 이진 부동소수에 정확히
 *   담기지 않아서 "정확히 30%" 인 입력(3/10, 6/20, 30/100)이 어디서는 참,
 *   어디서는 거짓이 될 수 있다. 정수 곱으로 비교하면 경계가 못 박힌다.
 */
export function isWideText(text) {
  const c = countWide(text);
  if (c.total === 0) return false;
  return c.wide * AI.WIDE_RATIO_DEN >= c.total * AI.WIDE_RATIO_NUM;
}

/**
 * 8-5 토큰 근사.
 *
 * @param {string} text
 * @returns {number} 0 이상의 정수
 */
export function estimateTokens(text) {
  const c = countWide(text);
  if (c.total === 0) return 0;
  const wide = c.wide * AI.WIDE_RATIO_DEN >= c.total * AI.WIDE_RATIO_NUM;
  const per = wide ? AI.TOKEN_CHARS_WIDE : AI.TOKEN_CHARS_LATIN;
  return Math.ceil(c.total / per);
}

/**
 * 8-5 "요청 전 `input + maxOutputTokens` 가 `MAX_REQ_TOKENS` 를 넘으면 분할한다."
 *
 * **분할은 여기서 하지 않는다** — 그것은 파이프라인(8단계)의 일이다. 여기서는
 * 넘는지만 답한다.
 *
 * @param {{system?: string, user?: string, maxOutputTokens?: number}} req
 * @param {number} [limit] 기본 `AI.MAX_REQ_TOKENS`
 */
export function requestTokens(req) {
  const r = req || {};
  return estimateTokens(String(r.system || '') + '\n' + String(r.user || '')) +
         (Number(r.maxOutputTokens) || 0);
}

export function exceedsRequestBudget(req, limit) {
  const max = Number.isFinite(limit) ? limit : AI.MAX_REQ_TOKENS;
  return requestTokens(req) > max;
}
