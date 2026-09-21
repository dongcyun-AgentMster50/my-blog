/* ============================================================
   MedReader — 해시 라우터 (spec 12-1)

   `hashchange` 로 `<section data-screen>` 의 `hidden` 을 토글한다.
   뒤로가기는 브라우저 히스토리가 처리한다 — Android 뒤로 제스처가
   그대로 동작해야 하므로 히스토리를 가로채지 않는다(12-1).

   `parseRoute` 는 **순수 함수**다. DOM 을 모르고 예외를 던지지 않는다.
   `tests/router.test.mjs` 가 이것을 고정한다.
   ============================================================ */

/** 화면 이름 — `index.html` 의 `data-screen` 값과 1:1 이다. */
export const SCREENS = Object.freeze([
  'onboarding', 'library', 'reader', 'quiz', 'settings', 'usage', 'about'
]);

/** 알 수 없는 해시가 떨어지는 곳(12-1). */
export const DEFAULT_ROUTE = 'library';

/**
 * 해시를 라우트로 바꾼다. **순수 함수** — 어떤 입력에도 던지지 않는다.
 *
 *   `#/library`                      → {name:'library', params:{}}
 *   `#/reader/:docId/:page`          → {name:'reader', params:{docId, page:Number}}
 *   `#/quiz/:docId/:sectionId`       → {name:'quiz',   params:{docId, sectionId}}
 *   `#/settings` `#/usage` `#/about` `#/onboarding`
 *   빈 해시                          → {name:'', params:{}}  ← 호출자가 온보딩 여부로 정한다
 *   그 밖                            → {name:'library', params:{}}
 *
 * @param {string} hash `location.hash` 그대로(선행 `#` 있든 없든)
 * @returns {{name:string, params:Object, raw:string}}
 */
export function parseRoute(hash) {
  const raw = String(hash == null ? '' : hash);
  let s = raw;
  if (s.charAt(0) === '#') s = s.slice(1);
  // 쿼리·프래그먼트 꼬리는 무시한다(`#/library?x=1`).
  const q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);
  if (s.charAt(0) === '/') s = s.slice(1);
  // 끝의 슬래시는 없는 것과 같다.
  while (s.length && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);

  if (s === '') return { name: '', params: {}, raw: raw };

  const parts = s.split('/').map(decodeSegment);
  const head = parts[0];

  switch (head) {
    case 'onboarding':
      return { name: 'onboarding', params: {}, raw: raw };

    case 'library':
      return { name: 'library', params: {}, raw: raw };

    case 'reader': {
      // docId 가 없는 `#/reader` 는 갈 곳이 없다 → 서재.
      if (!parts[1]) return { name: DEFAULT_ROUTE, params: {}, raw: raw };
      const page = toPage(parts[2]);
      return { name: 'reader', params: { docId: parts[1], page: page }, raw: raw };
    }

    case 'quiz': {
      if (!parts[1] || !parts[2]) return { name: DEFAULT_ROUTE, params: {}, raw: raw };
      return { name: 'quiz', params: { docId: parts[1], sectionId: parts[2] }, raw: raw };
    }

    case 'settings':
      // `#/settings/ai` 처럼 탭이 붙을 수 있다(7단계). 지금은 담아만 둔다.
      return { name: 'settings', params: parts[1] ? { tab: parts[1] } : {}, raw: raw };

    case 'usage':
      return { name: 'usage', params: {}, raw: raw };

    case 'about':
      return { name: 'about', params: {}, raw: raw };

    default:
      return { name: DEFAULT_ROUTE, params: {}, raw: raw };
  }
}

/** 잘못 인코딩된 세그먼트에도 던지지 않는다(`%zz`). */
function decodeSegment(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

/** 쪽 번호는 1 이상의 정수다. 없거나 이상하면 1. */
function toPage(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  const i = Math.floor(n);
  return i >= 1 ? i : 1;
}

/* ── 해시 만들기 — 문자열을 흩뿌리지 않는다 ────────────── */
export function libraryHash() { return '#/library'; }
export function onboardingHash() { return '#/onboarding'; }
export function readerHash(docId, page) {
  return '#/reader/' + encodeURIComponent(docId) + '/' + (Number(page) >= 1 ? Math.floor(Number(page)) : 1);
}
export function quizHash(docId, sectionId) {
  return '#/quiz/' + encodeURIComponent(docId) + '/' + encodeURIComponent(sectionId);
}

/* ────────────────────────────────────────────────────────
   DOM 결선 — 여기서만 window/document 를 만진다.
   ──────────────────────────────────────────────────────── */

let handler = null;

/**
 * 라우터를 시작한다.
 *
 * @param {Object} opts
 *   opts.onRoute  {(route) => void}  화면 전환 뒤에 불린다
 *   opts.resolve  {(route) => route} 빈 해시·접근 제한을 여기서 갈아끼운다
 *                                    (온보딩 완료 여부 판단이 여기 들어간다)
 * @returns {() => void} 해제 함수
 */
export function startRouter(opts) {
  const o = opts || {};
  stopRouter();

  handler = () => {
    let route = parseRoute(typeof location !== 'undefined' ? location.hash : '');
    if (typeof o.resolve === 'function') route = o.resolve(route) || route;
    showScreen(route.name);
    if (typeof o.onRoute === 'function') o.onRoute(route);
  };

  window.addEventListener('hashchange', handler);
  handler();   // 최초 1회
  return stopRouter;
}

export function stopRouter() {
  if (handler) {
    window.removeEventListener('hashchange', handler);
    handler = null;
  }
}

/** 해시를 바꿔 이동한다 — 히스토리 항목이 쌓여 뒤로가기가 동작한다. */
export function go(hash) {
  if (location.hash === hash) {
    // 같은 해시면 hashchange 가 오지 않는다. 직접 다시 그린다.
    if (handler) handler();
    return;
  }
  location.hash = hash;
}

/**
 * 히스토리에 **남기지 않고** 바꾼다. 빈 해시를 정식 해시로 정규화할 때만 쓴다 —
 * 그러지 않으면 뒤로가기가 빈 해시와 정식 해시 사이를 오간다.
 */
export function replace(hash) {
  if (typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', hash);
    if (handler) handler();
  } else {
    location.replace(hash);
  }
}

/** `data-screen` 섹션 중 하나만 보이게 한다. */
export function showScreen(name) {
  if (typeof document === 'undefined') return;
  const sections = document.querySelectorAll('[data-screen]');
  for (let i = 0; i < sections.length; i++) {
    const el = sections[i];
    el.hidden = el.getAttribute('data-screen') !== name;
  }
}
