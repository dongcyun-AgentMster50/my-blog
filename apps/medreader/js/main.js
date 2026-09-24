/* ============================================================
   MedReader — 부팅·배선 (spec 2-1 · 12-1)

   순서: 설정 로드 → i18n 초기화 → 라우터 시작 → 온보딩 여부 판단.

   ★ `file://` 로 열면 동작하지 않는다(20절). ES modules 와 IndexedDB 가
     둘 다 막힌다. index.html 의 머리말과 서재 빈 화면이 같은 말을 한다.

   ★ 전역 노출은 `window.__medreader` 하나뿐이며 키를 담지 않는다(16-K).
   ============================================================ */

import * as db from './db.js';
import * as settings from './settings.js';
import * as i18n from './i18n/index.js';
import { PDFJS_VERSION } from './config.js';
import { startRouter, parseRoute, go, replace, libraryHash, onboardingHash } from './router.js';
import { initOnboarding, showOnboarding, persistState } from './ui/onboarding.js';
import { initLibrary, showLibrary, openFilePicker, relabel } from './ui/library.js';
import { initReader, showReader, leaveReader } from './ui/reader.js';
import { initQuizScreen, showQuiz, leaveQuiz } from './ui/quiz.js';

/* ────────────────────────────────────────────────────────
   14절 배너 — 서비스 계층이 낸 **코드**를 여기서 문장으로 바꾼다(3-2).
   같은 배너를 두 번 쌓지 않는다("같은 메시지는 상태가 바뀌기 전엔
   반복하지 않는다" — 14-2).
   ──────────────────────────────────────────────────────── */
const shownBanners = new Map();   // key → element

function showBanner(detail) {
  const host = document.getElementById('banners');
  if (!host) return;
  const key = detail.key || i18n.errorKey(detail.code);
  const params = detail.params || null;

  if (shownBanners.has(key)) {
    // 문구만 갱신한다(숫자가 바뀔 수 있다).
    const p = shownBanners.get(key).querySelector('.banner-text');
    if (p) p.textContent = i18n.t(key, params);
    return;
  }

  const bar = document.createElement('div');
  bar.className = 'banner';
  bar.setAttribute('data-tone', detail.tone === 'error' ? 'error' : 'warn');
  bar.setAttribute('data-key', key);
  if (params) bar.setAttribute('data-params', JSON.stringify(params));

  const p = document.createElement('p');
  p.className = 'banner-text';
  p.textContent = i18n.t(key, params);
  bar.appendChild(p);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = i18n.t('common.dismiss');
  close.setAttribute('aria-label', i18n.t('common.dismiss'));
  close.addEventListener('click', () => {
    bar.remove();
    shownBanners.delete(key);
  });
  bar.appendChild(close);

  host.appendChild(bar);
  shownBanners.set(key, bar);
}

/** 언어가 바뀌면 이미 떠 있는 배너도 새 언어로 다시 쓴다. */
function relabelBanners() {
  for (const [key, bar] of shownBanners) {
    const raw = bar.getAttribute('data-params');
    let params = null;
    try { params = raw ? JSON.parse(raw) : null; } catch (e) { params = null; }
    const p = bar.querySelector('.banner-text');
    if (p) p.textContent = i18n.t(key, params);
    const btn = bar.querySelector('button');
    if (btn) {
      btn.textContent = i18n.t('common.dismiss');
      btn.setAttribute('aria-label', i18n.t('common.dismiss'));
    }
  }
}

/* ────────────────────────────────────────────────────────
   부팅
   ──────────────────────────────────────────────────────── */

async function boot() {
  document.addEventListener('medreader:banner', (ev) => showBanner(ev.detail || {}));

  // db.js 의 blocked / versionchange 는 **코드가 아니라 이벤트**로 온다.
  db.onDbEvent((e) => {
    if (e.type === 'blocked') showBanner({ code: db.ERR.BLOCKED, tone: 'error' });
  });

  /* 1. 설정 — 실패해도 앱은 뜬다(기본값으로 돈다). */
  try {
    await settings.load();
  } catch (e) {
    showBanner({ code: (e && e.code) || db.ERR.OPEN, tone: 'error' });
  }

  /* 2. i18n — 11-3 의 3단계 감지 */
  i18n.setDebug(!!settings.get('dev.debug'));
  const lang = i18n.detectLang(
    settings.get('ui.lang'),
    (typeof navigator !== 'undefined' && navigator.languages) ? navigator.languages : []
  );
  i18n.setLang(lang);
  i18n.onLangChange(() => {
    relabelBanners();
    relabel();
    fillAbout();
  });

  /* 3. 테마 — 4단계가 Aa 팝오버로 바꾼다. 지금은 저장값만 반영한다. */
  applyTheme(settings.get('ui.theme'));

  fillAbout();

  /* 4. 화면 배선 */
  initLibrary();
  initOnboarding({ onImport: openFilePicker });
  initReader();
  initQuizScreen();

  // 정적 이동 버튼 — 해시만 바꾼다(뒤로가기가 그대로 동작한다).
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-nav]');
    if (btn) go(btn.getAttribute('data-nav'));
  });

  /* 5. 라우터 */
  startRouter({ resolve: resolveRoute, onRoute: onRoute });

  window.__medreader = {
    // 16-K — 디버그용 전역 하나. 키는 담지 않는다.
    version: { pdfjs: PDFJS_VERSION, db: db.DB_VERSION },
    i18n: i18n,
    settings: settings,
    db: db,
    parseRoute: parseRoute,
    persistState: persistState
  };
}

/**
 * 12-1 — 빈 해시는 온보딩 완료 여부로 갈린다. 알 수 없는 해시는 서재다
 * (`parseRoute` 가 이미 서재로 떨어뜨린다).
 *
 * 온보딩을 마치지 않았으면 **어디로 가려 했든** 온보딩으로 보낸다 —
 * 16-I 가 "동의 전에는 AI 기능이 동의로 연결된다"를 요구하고, 동의 없이
 * 리더로 딥링크되는 구멍을 여기서 막는다.
 */
function resolveRoute(route) {
  const done = !!settings.get('onboarding.done');

  if (route.name === '') {
    const target = done ? libraryHash() : onboardingHash();
    // 히스토리에 남기지 않는다 — 뒤로가기가 빈 해시와 오가면 안 된다.
    replace(target);
    return parseRoute(target);
  }

  if (!done && route.name !== 'onboarding' && route.name !== 'about') {
    replace(onboardingHash());
    return parseRoute(onboardingHash());
  }

  return route;
}

function onRoute(route) {
  // 리더를 떠나면 그 쪽 DOM 을 버린다(7000쪽 메모리 — 4단계).
  if (route.name !== 'reader') leaveReader();
  // 퀴즈도 같다 — 문항 카드와 크롭 이미지를 들고 있다(9b).
  if (route.name !== 'quiz') leaveQuiz();

  switch (route.name) {
    case 'onboarding':
      showOnboarding();
      break;
    case 'library':
      showLibrary();
      break;
    case 'reader':
      // 4단계 — 리플로우 뷰. `ui/reader.js` 가 한 쪽을 그린다(12-4).
      showReader(route.params);
      break;
    case 'quiz':
      // 9b — 한 번에 문항 하나. `ui/quiz.js` 가 그린다(5-5).
      showQuiz(route.params);
      break;
    default:
      break;
  }
}

/** 11-2 — 문자열 안에 HTML 을 넣지 않는다. `{link}` 자리에 앵커를 꽂는다. */
function fillAbout() {
  const host = document.getElementById('aboutOpenSource');
  if (!host) return;
  while (host.firstChild) host.removeChild(host.firstChild);

  const tpl = i18n.t('about.openSource');
  const url = i18n.t('about.openSource.url');
  const parts = tpl.split('{link}');

  host.appendChild(document.createTextNode(parts[0]));
  if (parts.length > 1) {
    const a = document.createElement('a');
    a.href = url;
    a.textContent = 'pdf.js';
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    host.appendChild(a);
    host.appendChild(document.createTextNode(parts.slice(1).join('{link}')));
  }

  const v = document.getElementById('aboutVersion');
  if (v) v.textContent = i18n.t('about.version', { version: PDFJS_VERSION });
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme && theme !== 'system') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

boot().catch((e) => {
  // 부팅이 통째로 실패해도 화면에 무언가는 남긴다. 콘솔에만 죽지 않는다.
  showBanner({ code: (e && e.code) || 'ERR_UNKNOWN', tone: 'error' });
  console.error('[medreader] boot failed', e);
});
