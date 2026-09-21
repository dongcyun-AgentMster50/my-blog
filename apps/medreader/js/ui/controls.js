/* ============================================================
   MedReader — 하단 컨트롤 바와 낭독 배선 (spec 12-3 · 6-3 · 6-4 · 6-5)

   ── 이 파일이 하는 일 ───────────────────────────────────
   `tts/speaker.js` 는 **코드와 이벤트만** 낸다(3-2). 그것을 화면·문장·설정에
   잇는 곳이 여기다.
     · 버튼과 속도 팝오버(12-3)
     · `speaker` 이벤트 → `reader` 하이라이트·자동 스크롤(6-5)
     · 음성 목록·"영어 음성 없음" 배너(6-3)
     · `visibilitychange` · Wake Lock(6-4)

   ── 기능 감지와 버그 대응을 섞지 않는다 ─────────────────
   **기능 감지로 분기하는 것**: Wake Lock 유무, 음성 팩 유무, `speechSynthesis`
   자체의 유무. 없으면 안내한다.
   **버그 대응**: `speaker.js` 안에 있고 **분기 없이 늘** 돈다. 데스크톱에서
   재현되지 않는다고 빼면 실기기에서만 깨지는 코드가 된다(6-4).
   ============================================================ */

import * as settings from '../settings.js';
import { t, applyTranslations, formatNumber, onLangChange } from '../i18n/index.js';
import { TTS } from '../config.js';
import { createSpeaker, CODES } from '../tts/speaker.js';
import { loadVoices, pickVoice, availability } from '../tts/voices.js';
import {
  flowParas, currentPage, goToPageForSpeech, showSpoken, markDone,
  onLineTap, onPageRender
} from './reader.js';

let els = null;
let speaker = null;
let voices = [];
/** 마지막 진행 값 — 언어를 바꾸면 이 문장도 다시 만들어야 한다(16-H). */
let lastProgress = { index: 0, total: 0 };
/** 6-3 — 배너는 **세션당 1회**다. 닫고 나면 이 세션에서는 다시 뜨지 않는다. */
const noticedOnce = new Set();

/* ────────────────────────────────────────────────────────
   1. 배선
   ──────────────────────────────────────────────────────── */

export function initControls() {
  if (els) return;
  const root = document.querySelector('[data-screen="reader"]');
  if (!root) return;

  els = {
    root: root,
    bar: root.querySelector('#ttsBar'),
    play: root.querySelector('#ttsPlay'),
    glyph: root.querySelector('#ttsGlyph'),
    prev: root.querySelector('#ttsPrev'),
    next: root.querySelector('#ttsNext'),
    rate: root.querySelector('#ttsRate'),
    ratePanel: root.querySelector('#ttsRatePanel'),
    rateInput: root.querySelector('#ttsRateInput'),
    rateOut: root.querySelector('#ttsRateOut'),
    unitRow: root.querySelector('#ttsUnitRow'),
    rateClose: root.querySelector('#ttsRateClose'),
    progress: root.querySelector('#ttsProgress')
  };
  if (!els.bar) { els = null; return; }

  speaker = createSpeaker({
    synth: (typeof window !== 'undefined' && window.speechSynthesis) || null,
    makeUtterance: makeUtterance,
    view: {
      paras: flowParas,
      page: function () { const p = currentPage(); return { page: p.page, pageCount: p.pageCount }; },
      goToPage: goToPageForSpeech,
      show: function (u) { return showSpoken(u); },
      markDone: function (u) {
        const ids = u.lineIds || [];
        for (let i = 0; i < ids.length; i++) markDone(ids[i], true);
      }
    },
    requestWakeLock: requestWakeLock
  });

  /* ── 버튼 ──────────────────────────────────────────
     ★ 6-4 (5) — 재생은 **핸들러 안에서 동기적으로** `speak()` 까지 간다.
     `play()` 앞에 `await` 를 두면 안드로이드에서 소리가 나지 않는다. */
  els.play.addEventListener('click', () => {
    const s = speaker.getState();
    if (s === 'speaking') speaker.pause();
    else speaker.play();
  });
  els.prev.addEventListener('click', () => speaker.prev());
  els.next.addEventListener('click', () => speaker.next());

  els.rate.addEventListener('click', () => toggleRatePanel());
  els.rateClose.addEventListener('click', () => toggleRatePanel(false));
  els.rateInput.addEventListener('input', () => {
    speaker.setRate(els.rateInput.value);
    settings.set('tts.rate', speaker.getRate()).catch(() => { /* 저장 실패가 낭독을 막지 않는다 */ });
  });
  els.unitRow.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-unit]');
    if (!btn) return;
    const u = btn.getAttribute('data-unit');
    speaker.setUnit(u);
    settings.set('tts.unit', speaker.getUnit()).catch(() => { });
    paintRatePanel();
  });

  /* ── speaker → 화면 ───────────────────────────────── */
  speaker.addEventListener('linechange', (ev) => {
    const d = ev.detail || {};
    paintProgress(d.index, d.total);
  });
  speaker.addEventListener('statechange', () => paintBar());
  speaker.addEventListener('end', () => { paintBar(); paintProgress(0, 0); });
  speaker.addEventListener('error', (ev) => onSpeakerError((ev.detail || {}).code));

  /* ── 6-5 줄 탭 — 낭독 중이면 그 줄부터. 아니면 아무 것도 하지 않는다
     (인라인 번역은 7단계다). ──────────────────────── */
  onLineTap((lineId) => {
    const s = speaker.getState();
    if (s !== 'speaking' && s !== 'paused') return;
    speaker.play(lineId);
  });

  /* 쪽이 새로 그려지면 큐를 그 쪽 것으로 갈아 끼운다. */
  onPageRender(() => { speaker.reload(); attachDebugHook(); });

  /* ── 6-4 백그라운드 ────────────────────────────────
     hidden 이면 일시정지로 **상태를 분명히 하고**, 다시 보일 때
     **자동 재개하지 않는다**. 어디까지 들었는지 사용자가 확인하게. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (speaker.getState() === 'speaking') speaker.pause();
    } else if (speaker.getState() === 'speaking') {
      speaker.requestWakeLock();          // 화면이 꺼졌다 돌아오면 다시 잡는다
    }
  });

  onLangChange(() => { paintBar(); paintRatePanel(); paintProgress(lastProgress.index, lastProgress.total); });

  attachDebugHook();

  restoreSettings();
  paintBar();
  paintRatePanel();
}

/**
 * 16-C `[D]` — DevTools 에서 워치독을 시험하는 훅. 키를 담지 않는다(16-K).
 *
 * ★ `main.js` 의 `boot()` 는 `initReader()`(→ `initControls()`) **뒤에**
 *   `window.__medreader = {…}` 를 통째로 새로 만든다. 그래서 한 번만 붙이면
 *   지워진다. 쪽이 그려질 때마다 다시 붙여 둔다(idempotent).
 */
function attachDebugHook() {
  if (typeof window === 'undefined' || !speaker) return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.tts && g.tts.__mine) return;
  g.tts = {
    __mine: true,
    simulateStall: function () { speaker.simulateStall(); },
    state: function () { return speaker.getState(); },
    index: function () { return { index: speaker.getIndex(), total: speaker.getTotal() }; },
    current: function () { return speaker.getCurrent(); },
    voices: function () { return voices.map((v) => ({ lang: v.lang, name: v.name, local: v.localService })); }
  };
}

/** 리더를 떠날 때 — 소리를 멈춘다. 서재에서 낭독이 계속되면 안 된다. */
export function leaveControls() {
  if (!speaker) return;
  speaker.stop();
  toggleRatePanel(false);
}

/* ────────────────────────────────────────────────────────
   2. 설정과 음성 (9-3 · 6-3)
   ──────────────────────────────────────────────────────── */

async function restoreSettings() {
  speaker.setRate(settings.get('tts.rate'));

  // 6-1 — 기본 단위는 문장이다. settings.js 의 DEFAULTS 가 그렇게 말하므로
  // 여기서는 그냥 읽는다(사용자가 고른 값이 있으면 그것이 온다).
  speaker.setUnit(settings.get('tts.unit'));

  paintRatePanel();
  await refreshVoices();
}

async function refreshVoices() {
  const synth = (typeof window !== 'undefined' && window.speechSynthesis) || null;
  if (!synth) { notice('reader.tts.unsupported'); return; }

  voices = await loadVoices(synth, TTS.VOICES_TIMEOUT_MS);
  const have = availability(voices);

  // 원서 언어는 en 고정이다(문서 언어 설정은 뒤 단계).
  const v = pickVoice('en', voices, settings.get('tts.voice.en'));
  if (v) speaker.setVoice('en', v);
  speaker.setDocLang(v && v.lang ? String(v.lang).replace(/_/g, '-') : 'en-US');

  // 6-3 — 영어 음성이 없으면 설치 안내. 세션당 1회, 닫을 수 있다.
  if (!have.en) notice('reader.tts.noVoice');
}

/** 6-4 Wake Lock — 여기만이 기능 감지로 분기하는 곳이다. */
function requestWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) return Promise.resolve(null);
  if (settings.get('tts.wakeLock') === false) return Promise.resolve(null);
  return navigator.wakeLock.request('screen');
}

function makeUtterance(text) {
  return new window.SpeechSynthesisUtterance(text);
}

/* ────────────────────────────────────────────────────────
   3. 그리기 — 문구는 전부 i18n 이다(11절). 하드코딩 0건.
   ──────────────────────────────────────────────────────── */

function paintBar() {
  if (!els) return;
  const s = speaker.getState();
  const speaking = s === 'speaking';
  els.play.setAttribute('aria-pressed', speaking ? 'true' : 'false');
  els.play.setAttribute('aria-label', t(speaking ? 'reader.tts.pause' : 'reader.tts.play'));
  els.glyph.textContent = speaking ? '⏸' : '▶';
  els.bar.setAttribute('data-state', s);
  els.rate.textContent = t('reader.tts.rate.value', { rate: rateText(speaker.getRate()) });

  if (s === 'waiting-page') {
    els.progress.textContent = t('reader.tts.waitingPage');
  }
}

/** 12-3 — 본문을 두 번 읽지 않는다. "줄 12/58" 만 알린다. */
function paintProgress(index, total) {
  if (!els) return;
  lastProgress = { index: Number(index) || 0, total: Number(total) || 0 };
  if (!total) { els.progress.textContent = ''; return; }
  els.progress.textContent = t('reader.tts.progress', {
    index: formatNumber(Number(index) + 1),
    total: formatNumber(total)
  });
}

/** "1×" 가 아니라 "1.0×" 로 보여야 0.1 단계임이 보인다. */
function rateText(r) { return (Math.round(Number(r) * 10) / 10).toFixed(1); }

function toggleRatePanel(force) {
  if (!els) return;
  const open = force === undefined ? els.ratePanel.hidden : !!force;
  els.ratePanel.hidden = !open;
  els.rate.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) paintRatePanel();
}

function paintRatePanel() {
  if (!els) return;
  const r = speaker.getRate();
  els.rateInput.value = String(r);
  els.rateOut.textContent = t('reader.tts.rate.value', { rate: rateText(r) });
  els.rate.textContent = t('reader.tts.rate.value', { rate: rateText(r) });
  const u = speaker.getUnit();
  const btns = els.unitRow.querySelectorAll('button[data-unit]');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-unit') === u ? 'true' : 'false');
  }
  applyTranslations(els.ratePanel);
}

/* ────────────────────────────────────────────────────────
   4. 코드 → 문장 (3-2) — `speaker` 는 코드만 냈다.
   ──────────────────────────────────────────────────────── */

const CODE_KEYS = Object.freeze({
  [CODES.NOT_ALLOWED]: 'reader.tts.notAllowed',
  [CODES.LINE_SKIPPED]: 'reader.tts.lineSkipped',
  [CODES.PAGE_TIMEOUT]: 'reader.tts.pageTimeout',
  [CODES.NO_VOICE]: 'reader.tts.noVoice',
  [CODES.WAKELOCK_UNAVAILABLE]: 'reader.tts.wakeLock'
});

function onSpeakerError(code) {
  const key = CODE_KEYS[code];
  if (!key) return;
  // 건너뛴 줄 하나로 배너를 띄우지 않는다 — 시끄럽고, 워치독이 이미 이었다.
  if (code === CODES.LINE_SKIPPED) return;
  notice(key, code === CODES.NOT_ALLOWED ? 'error' : 'warn');
}

/** 세션당 1회. 닫기는 배너 자신이 갖고 있다(`main.js`). */
function notice(key, tone) {
  if (noticedOnce.has(key)) return;
  noticedOnce.add(key);
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: key, tone: tone || 'warn' }
  }));
}
