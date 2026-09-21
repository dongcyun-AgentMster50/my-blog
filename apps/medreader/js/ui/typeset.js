/* ============================================================
   MedReader — `Aa` 팝오버: 글자·행간·자간·서체·테마 (spec 12-3 · 16-F)

   UI 계층이다. `settings.get/set` 만 쓰고 **새 키를 지어내지 않는다**(9-3).
   쓰는 키: `reader.fontSize` · `reader.lineHeight` · `reader.letterSpacing`
           · `reader.font` · `ui.theme`.

   ── 이 파일이 지키는 두 가지 ───────────────────────────
   1. **즉시 반영.** 값이 바뀌면 `:root` 의 CSS 변수 네 개만 다시 쓴다.
      본문 요소를 순회하지 않는다 — 7000쪽 중 한 쪽만 DOM 에 있어도
      순회는 낭비이고, 앞으로 쪽이 커져도 비용이 늘지 않아야 한다.
   2. **테마는 `:root[data-theme]` 하나로.** `tokens.css` 가 light·dark·
      sepia·contrast 를 정의하고, `system` 은 속성을 지워 OS 를 따른다.

   `typesetVars`·`normalizeTheme`·`clampNumber` 는 **순수 함수**다
   (`tests/typeset.test.mjs` 가 고정한다). DOM 은 `apply*` 안에서만 만진다.
   ============================================================ */

import * as settings from '../settings.js';

/** 9-3 `reader.font` 의 값 → CSS 폰트 스택(tokens.css 의 변수). */
export const FONT_STACKS = Object.freeze({
  system: 'var(--font-body-sans)',
  sans: 'var(--font-body-sans)',
  serif: 'var(--font-body-serif)'
});

/** `ui.theme` 가 가질 수 있는 값. `system` 은 `data-theme` 를 지운다는 뜻이다. */
export const THEMES = Object.freeze(['system', 'light', 'dark', 'sepia', 'contrast']);

/** 12-3 의 범위 그대로. 슬라이더의 min·max·step 이 여기서 나온다. */
export const LIMITS = Object.freeze({
  fontSize: Object.freeze({ min: 16, max: 40, step: 1 }),
  lineHeight: Object.freeze({ min: 1.3, max: 2.2, step: 0.1 }),
  letterSpacing: Object.freeze({ min: 0, max: 0.1, step: 0.01 })
});

/** 범위 안으로 접는다. 숫자가 아니면 기본값으로 떨어진다 — 던지지 않는다. */
export function clampNumber(v, lim, fallback) {
  // `null`·`''`·`true` 는 `Number()` 가 0·1 로 바꿔 버린다 — 그러면 "값이 없다"가
  // 조용히 "최솟값"이 된다. 숫자와 숫자 문자열만 값으로 본다.
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < lim.min) return lim.min;
  if (n > lim.max) return lim.max;
  return n;
}

/** 모르는 테마 값은 `system` 이다(저장본이 오래됐거나 손상된 경우). */
export function normalizeTheme(theme) {
  return THEMES.indexOf(String(theme)) >= 0 ? String(theme) : 'system';
}

/**
 * 설정값 → CSS 변수 표. **순수 함수.**
 *
 * @param {Object} values { fontSize, lineHeight, letterSpacing, font }
 * @returns {Object} CSS 변수명 → 값 (전부 문자열)
 */
export function typesetVars(values) {
  const v = values || {};
  const fs = clampNumber(v.fontSize, LIMITS.fontSize, 22);
  const lh = clampNumber(v.lineHeight, LIMITS.lineHeight, 1.7);
  const ls = clampNumber(v.letterSpacing, LIMITS.letterSpacing, 0);
  const font = FONT_STACKS[String(v.font)] || FONT_STACKS.system;
  return {
    '--reader-fs': fs + 'px',
    // 단위 없는 행간 — 자식 요소가 자기 글자 크기를 기준으로 계산한다.
    '--reader-lh': String(Math.round(lh * 100) / 100),
    '--reader-ls': (Math.round(ls * 1000) / 1000) + 'em',
    '--reader-font': font
  };
}

/** 현재 설정값을 9-3 키에서 읽는다. */
export function currentValues() {
  return {
    fontSize: settings.get('reader.fontSize'),
    lineHeight: settings.get('reader.lineHeight'),
    letterSpacing: settings.get('reader.letterSpacing'),
    font: settings.get('reader.font'),
    theme: settings.get('ui.theme')
  };
}

/* ────────────────────────────────────────────────────────
   DOM — 여기서만 document 를 만진다.
   ──────────────────────────────────────────────────────── */

/** `:root[data-theme]` 를 세운다. `system` 이면 속성을 지워 OS 를 따른다. */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const th = normalizeTheme(theme);
  if (th === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', th);
}

/** CSS 변수 네 개를 `:root` 에 쓴다. 이것만으로 본문이 즉시 다시 조판된다. */
export function applyTypeset(values) {
  if (typeof document === 'undefined') return;
  const vals = values || currentValues();
  const vars = typesetVars(vals);
  const root = document.documentElement;
  for (const name of Object.keys(vars)) root.style.setProperty(name, vars[name]);
  applyTheme(vals.theme);
}

/* ────────────────────────────────────────────────────────
   팝오버 배선
   ──────────────────────────────────────────────────────── */

let els = null;
let openState = false;

/**
 * `Aa` 버튼과 패널을 잇는다. `index.html` 의 정적 마크업을 쓴다 —
 * 문구는 전부 `data-i18n` 이므로 여기서 문자열을 만들지 않는다.
 */
export function initTypeset() {
  if (typeof document === 'undefined') return;
  els = {
    btn: document.getElementById('typesetBtn'),
    panel: document.getElementById('typesetPanel'),
    fontSize: document.getElementById('tsFontSize'),
    lineHeight: document.getElementById('tsLineHeight'),
    letterSpacing: document.getElementById('tsLetterSpacing'),
    fontRow: document.getElementById('tsFontRow'),
    themeRow: document.getElementById('tsThemeRow'),
    close: document.getElementById('tsClose'),
    out: {
      fontSize: document.getElementById('tsFontSizeOut'),
      lineHeight: document.getElementById('tsLineHeightOut'),
      letterSpacing: document.getElementById('tsLetterSpacingOut')
    }
  };
  if (!els.btn || !els.panel) { els = null; return; }

  // 슬라이더의 범위를 한 곳(LIMITS)에서 세운다.
  setRange(els.fontSize, LIMITS.fontSize);
  setRange(els.lineHeight, LIMITS.lineHeight);
  setRange(els.letterSpacing, LIMITS.letterSpacing);

  els.btn.addEventListener('click', () => setOpen(!openState));
  if (els.close) els.close.addEventListener('click', () => setOpen(false));

  bindRange(els.fontSize, 'reader.fontSize', LIMITS.fontSize);
  bindRange(els.lineHeight, 'reader.lineHeight', LIMITS.lineHeight);
  bindRange(els.letterSpacing, 'reader.letterSpacing', LIMITS.letterSpacing);

  if (els.fontRow) els.fontRow.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-font]');
    if (b) store('reader.font', b.getAttribute('data-font'));
  });
  if (els.themeRow) els.themeRow.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-theme-value]');
    if (b) store('ui.theme', normalizeTheme(b.getAttribute('data-theme-value')));
  });

  // Esc 로 닫는다(16-G — 팝오버가 본문을 가두지 않는다).
  els.panel.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { setOpen(false); els.btn.focus(); }
  });

  syncControls();
  applyTypeset();
}

/** 화면이 리더를 떠날 때 팝오버를 닫는다. */
export function closeTypeset() { if (els) setOpen(false); }

/** 현재 설정값을 컨트롤에 반영한다(언어 전환·부팅·외부 변경 뒤). */
export function syncControls() {
  if (!els) return;
  const v = currentValues();
  setVal(els.fontSize, clampNumber(v.fontSize, LIMITS.fontSize, 22));
  setVal(els.lineHeight, clampNumber(v.lineHeight, LIMITS.lineHeight, 1.7));
  setVal(els.letterSpacing, clampNumber(v.letterSpacing, LIMITS.letterSpacing, 0));
  paintOutputs(v);
  press(els.fontRow, 'data-font', String(v.font));
  press(els.themeRow, 'data-theme-value', normalizeTheme(v.theme));
}

function setOpen(on) {
  openState = !!on;
  els.panel.hidden = !openState;
  els.btn.setAttribute('aria-expanded', openState ? 'true' : 'false');
  if (openState) {
    syncControls();
    if (els.fontSize) els.fontSize.focus();
  }
}

function setRange(input, lim) {
  if (!input) return;
  input.min = String(lim.min);
  input.max = String(lim.max);
  input.step = String(lim.step);
}

function setVal(input, v) { if (input) input.value = String(v); }

function bindRange(input, key, lim) {
  if (!input) return;
  // 'input' 은 드래그 중에도 온다 — 12-3 의 "즉시 적용".
  input.addEventListener('input', () => store(key, clampNumber(input.value, lim, settings.get(key))));
}

/**
 * 설정을 바꾸고 **바로** 화면에 반영한다.
 * `settings.set` 은 await 하기 전에 메모리 캐시를 갱신하므로, 저장이 늦어도
 * 바로 다음 줄의 `applyTypeset()` 이 새 값을 본다.
 */
function store(key, value) {
  const p = settings.set(key, value);
  applyTypeset();
  syncControls();
  if (p && typeof p.catch === 'function') {
    p.catch((e) => {
      document.dispatchEvent(new CustomEvent('medreader:banner', {
        detail: { code: (e && e.code) || 'ERR_UNKNOWN', tone: 'error' }
      }));
    });
  }
}

/** 숫자 표시는 언어를 타지 않는 값이므로 그대로 쓴다(자간은 em). */
function paintOutputs(v) {
  if (!els.out) return;
  const vars = typesetVars(v);
  if (els.out.fontSize) els.out.fontSize.textContent = vars['--reader-fs'];
  if (els.out.lineHeight) els.out.lineHeight.textContent = vars['--reader-lh'];
  if (els.out.letterSpacing) els.out.letterSpacing.textContent = vars['--reader-ls'];
}

function press(row, attr, value) {
  if (!row) return;
  const btns = row.querySelectorAll('button[' + attr + ']');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute(attr) === value ? 'true' : 'false');
  }
}
