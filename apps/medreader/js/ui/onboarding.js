/* ============================================================
   MedReader — 온보딩 (spec 12-2) — 3화면

   1. 언어 4개 버튼(각 언어 자국어 표기, 큰 터치 타깃)
   2. 고지 카드 2개(교육 목적 / 프라이버시) + "이해했습니다" → `privacy.consentedAt`
   3. [PDF 가져오기] + "키는 나중에" 문구

   ★ 마지막에 `db.requestPersist()` 를 반드시 부른다(16-B · 9-2).
     7000쪽 64MB 가 쿼터 압박에 날아가면 전체 재추출이다. Review 가
     "준비만 돼 있고 아무도 부르지 않는다"고 신고한 자리가 바로 여기다.

   UI 계층이다. 문자열은 전부 `t()` 를 거친다.
   ============================================================ */

import * as db from '../db.js';
import * as settings from '../settings.js';
import { t, setLang, applyTranslations, onLangChange, LANGS } from '../i18n/index.js';
import { go, libraryHash } from '../router.js';

const TOTAL_STEPS = 3;

let root = null;
let step = 1;
let onImport = null;      // 3화면의 [PDF 가져오기] — library.js 의 가져오기를 부른다

/**
 * @param {Object} opts
 *   opts.onImport {() => void} 파일 선택을 여는 함수(서재가 준다)
 */
export function initOnboarding(opts) {
  const o = opts || {};
  onImport = typeof o.onImport === 'function' ? o.onImport : null;
  root = document.querySelector('[data-screen="onboarding"]');
  if (!root) return;

  // "Step 1 of 3" 은 매개변수가 있어 `data-i18n` 만으로는 갱신되지 않는다.
  // 언어가 바뀌면 다시 쓴다(16-H: 새로고침 없이 즉시 반영).
  onLangChange(() => { if (root && !root.hidden) paintProgress(); });

  /* 1화면 — 언어 */
  const grid = root.querySelector('#langGrid');
  grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-lang]');
    if (!btn) return;
    const lang = btn.getAttribute('data-lang');
    if (LANGS.indexOf(lang) < 0) return;
    // 즉시 반영한다 — 사용자가 고른 언어로 다음 화면의 고지를 읽어야 한다(16-H).
    setLang(lang);
    markLang(lang);
    settings.set('ui.lang', lang).catch(reportSettingsFailure);
  });
  root.querySelector('#langNext').addEventListener('click', () => goStep(2));

  /* 2화면 — 동의 */
  const check = root.querySelector('#consentCheck');
  const hint = root.querySelector('#consentHint');
  check.addEventListener('change', () => { if (check.checked) hint.hidden = true; });
  root.querySelector('#consentBack').addEventListener('click', () => goStep(1));
  root.querySelector('#consentNext').addEventListener('click', async () => {
    if (!check.checked) {
      // 차단이 아니라 안내다. 체크 없이는 넘어가지 않는다(12-2).
      hint.hidden = false;
      check.focus();
      return;
    }
    // 9-3 — ISO 문자열로 기록한다. 16-I 가 "다시 뜨지 않는다"를 요구한다.
    await settings.set('privacy.consentedAt', new Date().toISOString()).catch(reportSettingsFailure);
    goStep(3);
  });

  /* 3화면 — 가져오기 */
  root.querySelector('#onboardImport').addEventListener('click', async () => {
    await finish();
    if (onImport) onImport();
  });
  root.querySelector('#onboardLater').addEventListener('click', async () => {
    await finish();
    go(libraryHash());
  });
}

/** 온보딩 화면이 라우터에 의해 보일 때마다 불린다. */
export function showOnboarding() {
  if (!root) return;
  markLang(settings.get('ui.lang'));
  // 이미 동의했으면 언어만 다시 고르는 것이므로 체크를 켜 둔다.
  const consented = settings.get('privacy.consentedAt');
  if (consented) root.querySelector('#consentCheck').checked = true;
  goStep(1);
}

function goStep(n) {
  step = Math.min(TOTAL_STEPS, Math.max(1, n));
  const steps = root.querySelectorAll('.onboard-step');
  for (let i = 0; i < steps.length; i++) {
    steps[i].hidden = Number(steps[i].getAttribute('data-step')) !== step;
  }
  paintProgress();
  // 화면이 바뀌면 처음부터 읽히게 한다(스크린 리더).
  const h = root.querySelector('.onboard-step:not([hidden]) h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
}

function paintProgress() {
  const p = root && root.querySelector('#onboardProgress');
  if (p) p.textContent = t('onboarding.progress', { step: step, total: TOTAL_STEPS });
}

function markLang(lang) {
  const btns = root.querySelectorAll('#langGrid button[data-lang]');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-lang') === lang));
  }
}

/**
 * 온보딩 종료. **여기가 `requestPersist()` 를 부르는 유일한 자리다**(16-B).
 *
 * 사용자 제스처(버튼 클릭) 바로 뒤에 불러야 한다 — 브라우저가 권한 프롬프트를
 * 제스처와 묶어 판단하기 때문이다. 그래서 두 버튼 핸들러 양쪽에서 부른다.
 *
 * 실패해도 온보딩을 막지 않는다. 저장소 보호는 있으면 좋은 것이지 전제가 아니다.
 */
async function finish() {
  await settings.set('onboarding.done', true).catch(reportSettingsFailure);
  try {
    const r = await db.requestPersist();
    // 결과는 로그가 아니라 상태로 남긴다 — 서재 하단의 저장 공간 줄이 읽는다.
    lastPersist = r;
  } catch (e) {
    lastPersist = { supported: false, persisted: false, error: true };
  }
  applyTranslations();
}

let lastPersist = null;

/** `navigator.storage.persist()` 의 마지막 결과. 서재의 저장 공간 줄이 읽는다. */
export function persistState() { return lastPersist; }

/**
 * 설정 저장이 실패해도 온보딩을 멈추지 않는다. 쿼터·차단은 배너로 알린다 —
 * 서비스 계층은 코드만 내므로(3-2) 여기서 코드를 배너로 넘긴다.
 */
function reportSettingsFailure(err) {
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { code: (err && err.code) || 'ERR_DB_OPEN', tone: 'error' }
  }));
}
