/* ══════════════════════════════════════════════════════════════════════
   text/bidi.js — 오른쪽→왼쪽 문장 안의 라틴 문자 구간 나누기 (순수 계층)

   `[신설 2026-10-08 — 운영자 결정]` 아랍어 번역문은 의학 용어 뒤에 영어 원어를
   괄호로 단다(10-2). 그 괄호 구간을 그냥 두면 브라우저의 양방향 알고리즘이
   줄바꿈 지점에서 방향을 잘못 추측해 **"(C-" / "reactive protein)" 처럼 갈라지고
   괄호가 뒤집혀 보였다**(2026-10-08 운영자 실키 확인 캡처).

   이 모듈은 텍스트를 **조각**으로만 나눈다. 화면 쪽이 `ltr` 조각을
   `<bdi dir="ltr">` 로 감싸 방향을 격리한다(각 조각은 textContent — 13절).
   8b 의 하단 자막 띠도 이 함수를 그대로 쓴다.

   계약: `ltrRuns(t).map(r => r.text).join('') === t` — 글자를 잃거나 더하지 않는다.
   브라우저 API 를 모른다(16-A — text/* 순수성 검사가 grep 으로 지킨다).
   ══════════════════════════════════════════════════════════════════════ */

/**
 * 격리할 구간:
 *  1. **라틴 문자가 든 괄호 묶음** — `(rheumatoid arthritis)`, `(C-reactive protein)`.
 *     괄호까지 한 조각이어야 괄호가 뒤집히지 않는다.
 *  2. 괄호 밖의 **라틴 문자 연속** — 낱말 사이의 공백·붙임표·점·빗금·아포스트로피는
 *     라틴 낱말 사이에 있을 때만 이어 붙인다(`C-reactive`, `mg/L`).
 * 숫자만 있는 구간(`30`, `10`)은 격리하지 않는다 — 숫자는 주변 방향을 따라도 바르게 놓인다.
 * `\p{Script=Latin}` — 프랑스어 등 악센트가 있는 라틴 문자도 같은 대우.
 */
const LTR_SPAN = /\([^()]*\p{Script=Latin}[^()]*\)|\p{Script=Latin}[\p{Script=Latin}0-9]*(?:[ \-./'’][\p{Script=Latin}0-9]+)*/gu;

/**
 * @param {string} text
 * @returns {{text:string, ltr:boolean}[]} 읽기 순서(원문 순서) 그대로의 조각들
 */
export function ltrRuns(text) {
  const s = typeof text === 'string' ? text : '';
  const out = [];
  let last = 0;
  LTR_SPAN.lastIndex = 0;
  let m;
  while ((m = LTR_SPAN.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), ltr: false });
    out.push({ text: m[0], ltr: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), ltr: false });
  return out;
}
