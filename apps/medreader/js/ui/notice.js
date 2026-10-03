/* ============================================================
   MedReader — 개인정보 경고 컴포넌트 `piiWarning()` (spec 12-7 · 13절)

   "실제 환자 정보를 입력하지 마세요" — **아랍어 우선 + 현재 UI 언어**.
   AI 로 보내는 모든 입력창 옆에 붙인다. Phase 1 에서는 설정의 키 입력창
   옆과 [AI로 표 재구성] 버튼 옆(나중 단계)이다.

   ── 왜 아랍어가 **항상** 먼저인가 ───────────────────────
   주 사용자의 모어다(11-3). UI 를 영어로 바꿔 둔 사람에게도 경고만큼은
   모어로 한 번 보이게 한다. UI 가 아랍어면 한 줄만 나온다(같은 말 두 번 금지).

   ── 계약 ──────────────────────────────────────────────
   - 문구는 i18n 키 `privacy.pii.warning` 하나에서 온다. 여기 문자열 0건.
   - **`textContent` 로만** 넣는다(13절 XSS). 정적 템플릿조차 쓰지 않는다.
   - `piiWarningTexts()` 는 **순수 함수**다 — DOM 없이 테스트된다.
   ============================================================ */

import { BUNDLES, FALLBACK_LANG, dirOf, getLang, onLangChange } from '../i18n/index.js';

export const PII_KEY = 'privacy.pii.warning';

/** 12-7 "아랍어 우선". */
export const PII_PRIMARY_LANG = 'ar';

/**
 * 특정 언어로 키를 찾는다(현재 UI 언어와 무관하게). 없으면 en, 그래도 없으면 키.
 * `t()` 는 **현재 언어**만 보므로 "아랍어 + 현재 언어" 두 줄을 만들 수 없다.
 */
export function textIn(lang, key) {
  const b = BUNDLES[lang];
  if (b && typeof b[key] === 'string') return b[key];
  const fb = BUNDLES[FALLBACK_LANG];
  if (fb && typeof fb[key] === 'string') return fb[key];
  return String(key);
}

/**
 * 보일 줄들. **순수 함수.**
 *
 * @param {string} uiLang 현재 UI 언어
 * @returns {{lang:string, dir:string, text:string}[]} 아랍어가 언제나 첫 줄
 */
export function piiWarningTexts(uiLang) {
  const out = [{ lang: PII_PRIMARY_LANG, dir: dirOf(PII_PRIMARY_LANG), text: textIn(PII_PRIMARY_LANG, PII_KEY) }];
  const ui = typeof uiLang === 'string' && BUNDLES[uiLang] ? uiLang : null;
  if (ui && ui !== PII_PRIMARY_LANG) {
    out.push({ lang: ui, dir: dirOf(ui), text: textIn(ui, PII_KEY) });
  }
  return out;
}

/** 이미 만든 경고 요소를 지금 UI 언어로 다시 채운다. */
export function paintPiiWarning(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  const lines = piiWarningTexts(getLang());
  for (let i = 0; i < lines.length; i++) {
    const p = document.createElement('p');
    p.className = 'pii-line';
    p.lang = lines[i].lang;
    p.dir = lines[i].dir;
    p.textContent = lines[i].text;
    el.appendChild(p);
  }
}

/**
 * 경고 요소를 만든다. 언어가 바뀌면 **스스로** 다시 그린다 — 붙이는 쪽이
 * 다시 그리기를 잊어도 옛 언어 문구가 남지 않는다.
 *
 * 화면 하나에 한 번만 부른다(부를 때마다 언어 리스너가 하나 생긴다).
 *
 * @returns {HTMLElement} `div.pii-warning[role=note]`
 */
export function piiWarning() {
  const el = document.createElement('div');
  el.className = 'pii-warning';
  el.setAttribute('role', 'note');
  el.setAttribute('data-pii-warning', '');
  paintPiiWarning(el);
  onLangChange(() => paintPiiWarning(el));
  return el;
}
