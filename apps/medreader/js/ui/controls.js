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
    rateSteps: root.querySelector('#ttsRateSteps'),
    rateOut: root.querySelector('#ttsRateOut'),
    unitRow: root.querySelector('#ttsUnitRow'),
    repeatRow: root.querySelector('#ttsRepeatRow'),
    repeatOut: root.querySelector('#ttsRepeatOut'),
    countRow: root.querySelector('#ttsCountRow'),
    countChoices: root.querySelector('#ttsCountChoices'),
    spanRow: root.querySelector('#ttsSpanRow'),
    spanChoices: root.querySelector('#ttsSpanChoices'),
    spanOut: root.querySelector('#ttsSpanOut'),
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

  /* ── 속도 (5b) — 계단 버튼. 연속 슬라이더를 걷어냈다 ──
     ★ 화면에 쓰는 일은 **전부 `paintRate()`** 한 곳이다. 어긋남의 원인이
       "바꾼 쪽이 자기 쪽만 다시 그렸다" 였다(보고서 4번 참조). */
  els.rateSteps.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-rate]');
    if (!btn) return;
    speaker.setRate(btn.getAttribute('data-rate'));
    paintRate();
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

  /* ── 반복 (5b) ────────────────────────────────────── */
  els.repeatRow.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-repeat]');
    if (!btn) return;
    speaker.setRepeat(btn.getAttribute('data-repeat'));
    paintRepeat();
  });
  els.countChoices.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-count]');
    if (!btn) return;
    const n = Number(btn.getAttribute('data-count'));
    speaker.setRepeat(speaker.getRepeat().mode, n);
    settings.set('tts.repeat.count', speaker.getRepeat().count).catch(() => { });
    paintRepeat();
  });
  els.spanChoices.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-edge]');
    if (!btn) return;
    speaker.setRepeatEdge(btn.getAttribute('data-edge'));
    paintRepeat();
  });

  /* ── speaker → 화면 ───────────────────────────────── */
  speaker.addEventListener('linechange', (ev) => {
    const d = ev.detail || {};
    paintProgress(d.index, d.total);
  });
  speaker.addEventListener('statechange', () => paintBar());
  speaker.addEventListener('repeatchange', () => { paintRepeat(); paintProgress(lastProgress.index, lastProgress.total); });
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
  // 5b — 옛 연속 슬라이더 시절 값(0.7 같은)은 `snapRate` 가 가장 가까운
  // 계단(0.75)으로 맞춘다. 맞춰진 값을 **되저장하지는 않는다** — 사용자가
  // 속도를 건드리지 않았는데 설정이 바뀌어 있으면 이상하다.
  speaker.setRate(settings.get('tts.rate'));
  speaker.setRepeat('off', settings.get('tts.repeat.count'));

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
  paintRate();

  if (s === 'waiting-page') {
    els.progress.textContent = t('reader.tts.waitingPage');
  }
}

/** 12-3 — 본문을 두 번 읽지 않는다. "줄 12/58" 만 알린다. */
function paintProgress(index, total) {
  if (!els) return;
  lastProgress = { index: Number(index) || 0, total: Number(total) || 0 };
  const rep = repeatText();
  if (!total) { els.progress.textContent = rep; return; }
  const line = t('reader.tts.progress', {
    index: formatNumber(Number(index) + 1),
    total: formatNumber(total)
  });
  // 반복 표시를 **앞에** 둔다 — 375px 에서는 이 칸이 좁아 뒤가 잘린다.
  // 반복 중일 때 잘려도 되는 것은 줄 번호 쪽이다.
  els.progress.textContent = rep ? rep + ' · ' + line : line;
}

/**
 * 5b — 반복 중임을 **컨트롤 바에서** 알 수 있어야 한다("2/3회").
 * 버튼을 늘리지 않고 진행 표시에 붙인다(375px 에서 바가 넘치면 안 된다).
 */
function repeatText() {
  const r = speaker.getRepeat();
  if (r.mode === 'off') return '';
  if (r.count === 0) return t('reader.tts.repeat.statusEndless');
  return t('reader.tts.repeat.status', {
    done: formatNumber(Math.min(r.pass + 1, r.count)),
    total: formatNumber(r.count)
  });
}

/**
 * 계단 값 글자. `0.75` 를 `0.8` 로 뭉개면 안 되고 `1` 은 `1.0` 으로 보여야
 * 한다(단계가 있다는 것이 숫자에서 보이도록).
 */
function rateText(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return '1.0';
  return Math.round(n * 100) % 10 === 0 ? n.toFixed(1) : n.toFixed(2);
}

function toggleRatePanel(force) {
  if (!els) return;
  const open = force === undefined ? els.ratePanel.hidden : !!force;
  els.ratePanel.hidden = !open;
  els.rate.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) paintRatePanel();
}

function paintRatePanel() {
  if (!els) return;
  // ★ `applyTranslations` 가 먼저다. 그것은 `data-i18n` 만 덮어쓰므로,
  //   매개변수가 들어간 글자(속도·횟수·구간)는 그 뒤에 우리가 쓴다.
  applyTranslations(els.ratePanel);
  paintRate();
  paintUnit();
  paintRepeat();
}

/**
 * ★ 5b — **속도 글자를 만드는 유일한 곳.** 컨트롤 바 버튼과 팝업 숫자와
 * 계단 버튼의 눌림 상태를 `speaker.getRate()` 한 값에서 함께 그린다.
 * (어긋남의 원인은 4번 보고 항목에.)
 */
function paintRate() {
  if (!els) return;
  const r = speaker.getRate();
  const label = t('reader.tts.rate.value', { rate: rateText(r) });
  els.rate.textContent = label;
  els.rateOut.textContent = label;

  // 계단 버튼은 `TTS.RATE_STEPS` 를 읽어 한 번만 만든다.
  if (!els.rateSteps.firstChild) {
    for (let i = 0; i < TTS.RATE_STEPS.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-rate', String(TTS.RATE_STEPS[i]));
      els.rateSteps.appendChild(b);
    }
  }
  const btns = els.rateSteps.querySelectorAll('button[data-rate]');
  for (let i = 0; i < btns.length; i++) {
    const v = Number(btns[i].getAttribute('data-rate'));
    btns[i].textContent = t('reader.tts.rate.value', { rate: rateText(v) });
    btns[i].setAttribute('aria-pressed', v === r ? 'true' : 'false');
  }
}

function paintUnit() {
  if (!els) return;
  const u = speaker.getUnit();
  const btns = els.unitRow.querySelectorAll('button[data-unit]');
  for (let i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-unit') === u ? 'true' : 'false');
  }
}

/** 반복 — 팝업 안의 세 줄과 컨트롤 바의 표시를 **한 값에서** 그린다. */
function paintRepeat() {
  if (!els) return;
  const rep = speaker.getRepeat();

  const modes = els.repeatRow.querySelectorAll('button[data-repeat]');
  for (let i = 0; i < modes.length; i++) {
    modes[i].setAttribute('aria-pressed', modes[i].getAttribute('data-repeat') === rep.mode ? 'true' : 'false');
  }

  if (!els.countChoices.firstChild) {
    for (let i = 0; i < TTS.REPEAT_COUNTS.length; i++) {
      const n = TTS.REPEAT_COUNTS[i];
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-count', String(n));
      // 0 = 무한. `data-i18n` 을 주면 `applyTranslations` 가 언어 전환 때
      // 알아서 다시 쓴다(`data-i18n-n` 이 {n} 을 채운다).
      b.setAttribute('data-i18n', n === 0 ? 'reader.tts.repeat.endless' : 'reader.tts.repeat.times');
      if (n !== 0) b.setAttribute('data-i18n-n', String(n));
      els.countChoices.appendChild(b);
    }
    applyTranslations(els.countChoices);
  }
  const counts = els.countChoices.querySelectorAll('button[data-count]');
  for (let i = 0; i < counts.length; i++) {
    counts[i].setAttribute('aria-pressed',
      Number(counts[i].getAttribute('data-count')) === rep.count ? 'true' : 'false');
  }

  els.countRow.hidden = rep.mode === 'off';
  els.spanRow.hidden = rep.mode !== 'range';
  els.repeatOut.textContent = repeatText();
  els.spanOut.textContent = rep.mode === 'range'
    ? t('reader.tts.repeat.span', { from: formatNumber(rep.from + 1), to: formatNumber(rep.to + 1) })
    : '';

  // 팝업을 닫아도 반복 중임이 보여야 한다(바 버튼에 표시가 붙는다).
  els.bar.setAttribute('data-repeat', rep.mode);
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
