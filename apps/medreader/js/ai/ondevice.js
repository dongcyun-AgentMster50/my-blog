/* ============================================================
   MedReader — 기기 내 AI 기능 감지와 번역 (spec 7-4)

   ── 서비스 계층이다(3-1) ────────────────────────────────
   브라우저 전역(`Translator`·`Summarizer`·`LanguageDetector`)을 **존재 검사 후** 쓴다.
   DOM 을 모르고 문구를 만들지 않는다. 전역 객체는 주입할 수 있다 — 테스트가 스텁을 끼운다.

   ── ★ 실패는 `null` 이다 ────────────────────────────────
   7-4: "모든 온디바이스 호출은 try/catch 로 감싸고 실패 시 null 반환 → 원격으로.
   예외가 UI 까지 올라가지 않는다." 이 파일의 어떤 공개 함수도 던지지 않는다.

   ── 자동 다운로드 금지 ──────────────────────────────────
   `availability` 가 `'downloadable'`·`'downloading'` 이면 `null`(데이터 요금). 모델 준비는
   설정 화면의 사용자 제스처 안에서만 시작한다(8c 이후 — 이 파일은 `available` 일 때만 번역한다).

   ── 원문 언어는 인자다 ───────────────────────────────────
   `translate(sentences, src, dst)` — 원문 언어를 박지 않는다(9-2 `documents.lang`).
   둘 중 하나라도 비었거나 같으면 `null`.
   ============================================================ */

function scopeOf(scope) {
  return scope && typeof scope === 'object' ? scope : globalThis;
}

/** 7-4 기능 감지. 던지지 않는다. */
export function detect(scope) {
  const g = scopeOf(scope);
  let t = false;
  let s = false;
  let l = false;
  try { t = !!g.Translator && typeof g.Translator.availability === 'function'; } catch (e) { t = false; }
  try { s = !!g.Summarizer && typeof g.Summarizer.availability === 'function'; } catch (e) { s = false; }
  try { l = !!g.LanguageDetector; } catch (e) { l = false; }
  return { translator: t, summarizer: s, detector: l };
}

/** 언어 코드처럼 생긴 값인가(`en`·`ar`·`pt-BR`). */
function isLang(v) {
  return typeof v === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(v.trim());
}

/**
 * 7-4 `translate(sentences, src, dst)`.
 *
 * @param {string[]} sentences
 * @param {string} src 원문 언어(문서 속성 — 박지 않는다)
 * @param {string} dst 대상 언어
 * @param {Object} [scope] 전역 객체(테스트 주입). 없으면 `globalThis`.
 * @returns {Promise<string[]|null>} 입력과 같은 길이의 번역 배열, 또는 `null`(→ 원격으로)
 */
export async function translate(sentences, src, dst, scope) {
  const list = Array.isArray(sentences) ? sentences : null;
  if (!list || !list.length) return null;
  if (!isLang(src) || !isLang(dst) || src.trim() === dst.trim()) return null;
  const g = scopeOf(scope);
  if (!detect(g).translator) return null;

  let t = null;
  try {
    const opts = { sourceLanguage: src.trim(), targetLanguage: dst.trim() };
    const a = await g.Translator.availability(opts);
    if (a !== 'available') return null;          // unavailable · downloadable · downloading → 원격
    t = await g.Translator.create(opts);
    if (!t || typeof t.translate !== 'function') return null;
    const out = [];
    for (let i = 0; i < list.length; i++) {      // 배열 API 가 없다 — 순차
      const r = await t.translate(String(list[i] == null ? '' : list[i]));
      if (typeof r !== 'string') return null;
      out.push(r);
    }
    return out;
  } catch (e) {
    return null;
  } finally {
    try { if (t && typeof t.destroy === 'function') t.destroy(); } catch (e) { /* 무시 */ }
  }
}
