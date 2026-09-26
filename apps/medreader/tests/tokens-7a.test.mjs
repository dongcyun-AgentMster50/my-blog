/* ============================================================
   tests/tokens-7a.test.mjs — spec 8-5 토큰 추정

   8-5: "라틴 문자 위주면 `ceil(chars / 4)`, 아랍어·한글 비율이 30% 이상이면
   `ceil(chars / 2)`."

   ★ 경계(정확히 30%)를 못 박는 것이 이 파일의 요점이다. `0.3` 은 이진
     부동소수에 정확히 담기지 않아서, 나눗셈으로 비교하면 "정확히 30%"인
     입력이 어디서는 참, 어디서는 거짓이 될 수 있다.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateTokens, isWideText, countWide, requestTokens, exceedsRequestBudget } from '../js/ai/tokens.js';
import { AI } from '../js/config.js';

const AR = 'ا';   // 아랍 문자 하나
const KO = '가';  // 한글 음절 하나

test('라틴 문자는 4자당 1토큰 (8-5)', () => {
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcdefgh'), 2);
  // 올림이다 — 5자는 2토큰.
  assert.equal(estimateTokens('abcde'), 2);
});

test('아랍어만 있으면 2자당 1토큰', () => {
  assert.equal(estimateTokens(AR.repeat(10)), 5);
  assert.equal(estimateTokens(AR.repeat(9)), 5, '올림');
});

test('한글만 있으면 2자당 1토큰', () => {
  assert.equal(estimateTokens(KO.repeat(10)), 5);
  assert.equal(estimateTokens('안녕하세요'), 3, '5자 → ceil(5/2)');
});

/* ── ★ 30% 경계 ──────────────────────────────────────── */

test('★ 정확히 30% 는 넓은 쪽이다 (>= 이지 > 가 아니다)', () => {
  const s = AR.repeat(3) + 'abcdefg';          // 3 / 10 = 정확히 30%
  assert.equal(countWide(s).wide, 3);
  assert.equal(countWide(s).total, 10);
  assert.equal(isWideText(s), true, '30% 는 임계 "이상"이다');
  assert.equal(estimateTokens(s), 5, 'ceil(10/2)');
});

test('★ 29.99% 는 라틴 쪽이다', () => {
  const s = AR.repeat(29) + 'a'.repeat(71);    // 29 / 100
  assert.equal(isWideText(s), false);
  assert.equal(estimateTokens(s), 25, 'ceil(100/4)');
});

test('★ 30.0% 가 다른 표본 크기에서도 같은 쪽이다 (부동소수 흔들림 없음)', () => {
  // 3/10, 6/20, 30/100, 300/1000 — 나눗셈으로 비교하면 이 중 하나가
  // 0.30000000000000004 같은 값이 되어 갈라질 수 있다.
  for (const n of [1, 2, 10, 100]) {
    const s = KO.repeat(3 * n) + 'a'.repeat(7 * n);
    assert.equal(isWideText(s), true, (3 * n) + '/' + (10 * n) + ' 가 30% 로 인정되지 않았다');
  }
});

test('31% 는 넓은 쪽', () => {
  const s = AR.repeat(31) + 'a'.repeat(69);
  assert.equal(isWideText(s), true);
  assert.equal(estimateTokens(s), 50);
});

/* ── 문자 판정 ───────────────────────────────────────── */

test('아랍어 표현형(FB50~·FE70~)도 넓은 문자로 센다', () => {
  // PDF 추출본에 표현형 코드포인트가 섞여 나온다.
  assert.equal(countWide('ﺎﻟ').wide, 2);
  assert.equal(countWide('ﭑ').wide, 1);
});

test('한글 자모·호환 자모도 센다', () => {
  assert.equal(countWide('ㄱᄀ').wide, 2);
});

test('라틴·숫자·공백·구두점은 넓은 문자가 아니다', () => {
  const s = 'Hello, world! 123 (see Fig. 2)';
  assert.equal(countWide(s).wide, 0);
  assert.equal(isWideText(s), false);
});

test('섞인 문장을 실제 비율대로 센다', () => {
  const s = 'ACE inhibitor 는 ' + KO.repeat(4);   // 한글 5자(는 + 4)
  const c = countWide(s);
  assert.equal(c.wide, 5);
  assert.equal(c.total, s.length);
});

test('코드포인트로 센다 — 서로게이트 쌍을 2 로 세지 않는다', () => {
  // 이모지는 UTF-16 에서 2 유닛이다. 글자 수로는 1 이어야 비율이 흐트러지지 않는다.
  const c = countWide('😀😀');
  assert.equal(c.total, 2, 'String.length 로 셌다면 4 가 나온다');
  assert.equal(c.wide, 0);
});

/* ── 가장자리 ────────────────────────────────────────── */

test('빈 문자열은 0 토큰이고 넓지 않다', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(isWideText(''), false, '0/0 을 넓다고 하면 안 된다');
});

test('문자열이 아닌 입력에서 죽지 않는다', () => {
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.equal(estimateTokens(123), 0);
});

/* ── 8-5 요청 예산 ───────────────────────────────────── */

test('requestTokens 는 system + user + maxOutputTokens 다', () => {
  const t = requestTokens({ system: 'abcd', user: 'abcd', maxOutputTokens: 100 });
  // 'abcd' + '\n' + 'abcd' = 9자 → ceil(9/4) = 3, + 100
  assert.equal(t, 103);
});

test('MAX_REQ_TOKENS 를 넘는지 판단한다 (분할은 8단계의 일)', () => {
  const small = { user: 'a'.repeat(100), maxOutputTokens: 100 };
  assert.equal(exceedsRequestBudget(small), false);

  const big = { user: 'a'.repeat(4 * AI.MAX_REQ_TOKENS), maxOutputTokens: 100 };
  assert.equal(exceedsRequestBudget(big), true);

  // 상한을 직접 넘길 수도 있다(설정의 `ai.maxReqChars` 에서 온 값 등).
  assert.equal(exceedsRequestBudget(small, 10), true);
});

test('8-5 기본 상한은 8,000 이다', () => {
  assert.equal(AI.MAX_REQ_TOKENS, 8000);
});
