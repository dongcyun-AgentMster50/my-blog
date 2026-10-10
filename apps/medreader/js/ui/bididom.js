/* ============================================================
   MedReader — 번역문 넣기: 오른쪽→왼쪽 블록 안의 라틴 문자 격리 (화면 공용)

   `[8b-2]` `ui/settings.js` 에 있던 `appendBidiText` 를 **그대로** 옮겼다.
   [시험 번역] 블록(설정 AI 탭)과 하단 자막 띠(`ui/trband.js`)가 **이 함수 하나**를 쓴다 —
   규칙이 두 벌이 되면 한쪽만 고쳐져 어긋난다(인계 문서 10-08 결정).

   왜 `text/*` 가 아니라 여기인가: 조각 나누기(`text/bidi.js` 의 `ltrRuns`)는 순수 계층이고
   DOM 을 모른다(16-A). 조각을 요소로 만드는 일은 화면 계층의 몫이다.

   ★ 조각마다 **textContent** 다(13절 — AI 응답을 HTML 로 해석하지 않는다).
   ============================================================ */

import { ltrRuns } from '../text/bidi.js';

/**
 * `[신설 2026-10-08 — 운영자 결정]` 번역문을 넣는다. 오른쪽→왼쪽 블록이면 라틴 문자 구간
 * (영어 원어 괄호 등)을 `<bdi dir="ltr">` 로 격리한다 — 그냥 넣으면 줄바꿈 지점에서
 * "(C-" / "reactive protein)" 처럼 갈라지고 괄호가 뒤집혔다(실키 확인 캡처).
 * 왼쪽→오른쪽 블록(`ko` 등)은 격리할 것이 없다 — 통째로 textContent.
 *
 * 호출하는 쪽이 `el` 을 먼저 비운다(이 함수는 덧붙이기만 한다).
 *
 * @param {Element} el
 * @param {string} text
 * @param {'rtl'|'ltr'|string} dir  블록 방향 — `dirOf(언어)` 에서 유도한 값
 */
export function appendBidiText(el, text, dir) {
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
