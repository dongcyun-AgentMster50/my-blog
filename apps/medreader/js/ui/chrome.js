/* ============================================================
   MedReader — 낮은 화면(compact)의 상단바 숨김 [≡] (spec 12-8-1 (3) · 결정 8e-D4)

   가로로 돌린 휴대폰(높이 ≤ 520px)에서는 본문이 두세 줄밖에 남지 않는다. 그래서 compact 에서는
   리더 상단바(뒤로·제목·⧉·퀴즈·Aa·🔍)를 **기본으로 숨기고**, 합친 아래 바 맨 앞의 `[≡]` 하나로
   보이고 숨긴다(48×48 — 손이 위로 가지 않게 아래 바에 둔다).

   ── 이 파일이 지키는 것 ─────────────────────────────────
   1. **장치 하나.** 낭독 시작·스크롤 방향으로 숨기거나 보이지 않는다 — 6-5 의 800ms 사용자 스크롤
      판정과 섞이지 않는다. 원본 보기·리플로우가 같은 단추·같은 표식이다.
   2. **표식은 `<html data-chrome="hidden|shown">` 하나**(body 가 아니다 — 토큰이 `:root` 에 있고
      `scroll-padding` 이 루트에 있으며 `bodyArea()` 가 `documentElement` 에서 `--bar-top` 을 읽는다).
      compact 이고 리더 화면이 보일 때만 건다. 그 밖에는 뗀다(검색·서재·설정 화면에 새지 않는다).
      CSS(tokens.css · reader.css)는 같은 `max-height: 520px` 안에서만 이 표식을 읽는다.
   3. **세션 메모리 하나.** 저장하지 않는다(설정 키 0). 한 번 [≡] 로 열어 두면 회전·쪽 넘김·검색 다녀오기
      동안 그대로다. 새로 연 앱은 늘 숨김에서 시작한다.

   `nextChrome`·`chromeMark` 는 **순수 함수**다(`tests/landscape-8e.test.mjs` 가 표로 고정한다).
   DOM 은 `initChrome` 안에서만 만진다.
   ============================================================ */

import { t, onLangChange } from '../i18n/index.js';

/** compact 판정 — tokens.css · reader.css 의 `@media` 와 같은 조건(8e-D1). 방향(orientation)으로 가르지 않는다. */
export const COMPACT_MEDIA = '(max-height: 520px)';

/** 처음 상태 — compact 아님, 리더 아님, 상단바 숨김(= 열어 둔 적 없음). */
export const CHROME_INIT = Object.freeze({ compact: false, reader: false, shown: false });

/**
 * 상태 전이. **순수 함수**(입력을 바꾸지 않는다).
 *   enter  — 낮은 화면이 됐다(리더 열기·회전)        → compact 참
 *   leave  — 낮은 화면이 아니다(세로로 돌림·펼침)      → compact 거짓(기억 `shown` 은 그대로)
 *   route  — 리더 화면이 보인다/숨었다 `{reader}`      → reader 갱신(기억은 그대로)
 *   toggle — [≡] 를 눌렀다                            → compact·리더일 때만 shown 뒤집기
 * @param {{compact:boolean, reader:boolean, shown:boolean}} state
 * @param {{type:string, reader?:boolean}} ev
 */
export function nextChrome(state, ev) {
  const s = Object.assign({}, CHROME_INIT, state || {});
  const type = ev && ev.type;
  if (type === 'enter') return Object.assign(s, { compact: true });
  if (type === 'leave') return Object.assign(s, { compact: false });
  if (type === 'route') return Object.assign(s, { reader: !!(ev && ev.reader) });
  if (type === 'toggle') return s.compact && s.reader ? Object.assign(s, { shown: !s.shown }) : s;
  return s;
}

/**
 * `<html data-chrome>` 값. compact 이고 리더가 보일 때만 `'hidden'`·`'shown'`, 그 밖에는 `null`(속성을 뗀다).
 * @returns {'hidden'|'shown'|null}
 */
export function chromeMark(state) {
  const s = state || CHROME_INIT;
  if (!s.compact || !s.reader) return null;
  return s.shown ? 'shown' : 'hidden';
}

/** [≡] 의 이름 키 — 지금 숨김이면 "메뉴 열기", 보이면 "메뉴 닫기"(aria-expanded 와 함께). */
export function toggleLabelKey(state) {
  return chromeMark(state) === 'shown' ? 'reader.chrome.close' : 'reader.chrome.open';
}

/* ────────────────────────────────────────────────────────
   DOM — 여기서만 document 를 만진다.
   ──────────────────────────────────────────────────────── */

let st = CHROME_INIT;
let els = null;

function paint() {
  if (!els) return;
  const root = document.documentElement;
  const mark = chromeMark(st);
  if (mark) root.setAttribute('data-chrome', mark);
  else root.removeAttribute('data-chrome');
  const key = toggleLabelKey(st);
  els.btn.setAttribute('aria-expanded', mark === 'shown' ? 'true' : 'false');
  // `data-i18n-aria` 도 함께 바꿔 둔다 — 언어를 바꾸면 applyTranslations 가 지금 상태의 이름을 다시 쓴다.
  els.btn.setAttribute('data-i18n-aria', key);
  els.btn.setAttribute('aria-label', t(key));
}

function dispatch(ev) {
  st = nextChrome(st, ev);
  paint();
}

/**
 * 리더 `initReader` 가 한 번 부른다. 리더 화면·[≡] 가 없으면 아무 것도 하지 않는다.
 * @param {{onCompactChange?: (compact:boolean) => void}} [opts]  회전으로 compact 가 켜지거나 꺼진 **뒤** 한 번 —
 *   리더가 낭독 중인 문장을 편안 영역에 다시 들이는 자리(배치가 바뀌어 문장이 영역 밖에 남지 않게). [≡] 토글에는 부르지 않는다
 *   (토글은 본문을 움직이지 않는다 — 수용 기준).
 */
export function initChrome(opts) {
  if (typeof document === 'undefined' || els) return;
  const screen = document.querySelector('.screen[data-screen="reader"]');
  const btn = document.getElementById('chromeToggle');
  if (!screen || !btn) return;
  els = { screen: screen, btn: btn };
  const onCompactChange = opts && typeof opts.onCompactChange === 'function' ? opts.onCompactChange : null;

  const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_MEDIA) : null;
  const syncMedia = () => {
    dispatch({ type: mq && mq.matches ? 'enter' : 'leave' });
    if (onCompactChange) { try { onCompactChange(st.compact); } catch (e) { /* 구독자 예외가 표식을 막지 않는다 */ } }
  };
  if (mq) {
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', syncMedia);
    else if (typeof mq.addListener === 'function') mq.addListener(syncMedia);
  }

  // 리더 화면이 보이는가 — 라우터가 `hidden` 을 토글한다(main.js 는 범위 밖이라 스스로 본다).
  const syncRoute = () => dispatch({ type: 'route', reader: !screen.hidden });
  if (typeof MutationObserver === 'function') {
    new MutationObserver(syncRoute).observe(screen, { attributes: true, attributeFilter: ['hidden'] });
  }

  btn.addEventListener('click', () => dispatch({ type: 'toggle' }));
  onLangChange(() => paint());

  st = nextChrome(nextChrome(st, { type: mq && mq.matches ? 'enter' : 'leave' }), { type: 'route', reader: !screen.hidden });
  paint();
}

/** 시험·진단용 — 지금 상태 사본. */
export function chromeState() { return Object.assign({}, st); }
