/* ============================================================
   MedReader — 하단 자막 띠 (spec 7-7 · 7-8 · 6-5 · 14-2 · 16-D3)

   ── 이 파일이 하는 일 ───────────────────────────────────
   낭독 동반 번역(7-8)의 **화면**이다. 서비스(`ai/readalong.js`)와 낭독(`tts/speaker.js`)은
   8b-1 이 만든 그대로 두고, 그 이벤트를 받아 그린다.
     · 지금 문장(`speaker` `linechange` 의 `src`)의 번역을 `readalong.get(src)` 로 읽어 띠에 보인다
     · 상태: 준비됨 · 번역 중… · 이 문장은 번역 없음 · 번역 실패 / 막힘(사유 한 줄) + [다시 시도]
     · 유효 모드(`readalong` `mode`)가 `off` 면 띠를 숨기고 **자리도 비운다**
       (`<html data-tr-band="on">` 을 뗀다 → `--reader-chrome-bottom` 이 138px 로 — tokens.css)
     · 넘치는 번역문은 발화 경과 비율로 띠 안을 스크롤한다(7-7). 띠를 만지면 그 문장 동안 멈춘다
     · 상태 바(14절 배너) 안내 — 사유·원격 상태가 **바뀔 때 한 번**(14-2)

   ── 지키는 것 ──────────────────────────────────────────
   ★ 번역문·AI 응답은 전부 **textContent**(13절). 라틴 구간 격리는 `ui/bididom.js` 의
     `appendBidiText` — 설정 AI 탭의 [시험 번역]과 **같은 함수**(규칙 한 벌).
   ★ `dir`·`lang` 은 `ai.translationLang` 에서 유도한다. `ar` 을 박지 않는다(11-3).
   ★ [다시 시도]는 사용자 동작만 — `readalong.retry()`(7-6). 자동으로 부르지 않는다.
     버튼 동작은 띠 하나의 위임 리스너(`data-tr-action`)가 받는다(`onclick` 0건).
   ★ 띠는 speaker 를 직접 조작하지 않는다. 모드 변경은 controls 의 `syncReadalong()` 이 한다.
   ============================================================ */

import * as settings from '../settings.js';
import { t, applyTranslations, getDir, onLangChange } from '../i18n/index.js';
import { TTS, READALONG, AI } from '../config.js';
import { trSpeechText } from '../tts/text.js';
import * as provider from '../ai/provider.js';
import { normalizeTranslationLang, translationBlockAttrs, stateNotice, nativeLangName, SETTINGS_AI_HASH } from './settings.js';
import { appendBidiText } from './bididom.js';

/* ────────────────────────────────────────────────────────
   1. 순수 부분 — `tests/trband.test.mjs` 가 고정한다
   ──────────────────────────────────────────────────────── */

/** 원격 상태 중 [다시 시도]가 **즉시** 풀 수 있는 것(8a `pipeline.retry()` — 7-6). */
export const RETRYABLE_REMOTE = Object.freeze(['exhausted', 'cooldown', 'region', 'model']);

/** 원격 상태(서비스 이름) → 띠 안의 짧은 한 줄(i18n 키). 긴 안내는 상태 바가 한 번만 한다(7-7). */
export const BLOCKED_KEYS = Object.freeze({
  offline: 'readalong.blocked.offline',
  exhausted: 'readalong.blocked.exhausted',
  capped: 'readalong.blocked.capped',
  cooldown: 'readalong.blocked.cooldown',
  region: 'readalong.blocked.region',
  model: 'readalong.blocked.model',
  'no-key': 'readalong.blocked.noKey'
});

/** 서비스가 "막힘"으로 보는 원격 상태(readalong 의 BLOCKING 과 같은 목록). */
const BLOCKING_REMOTE = Object.freeze(Object.keys(BLOCKED_KEYS));

/**
 * 띠 한 장에 무엇을 그리는가. 순수 함수.
 *
 * @param {{state:string, text?:string, code?:string}|null} rec   `readalong.get(src)` 결과
 * @param {{hasSentence:boolean, isNotice?:boolean, remote?:string}} ctx
 *   `hasSentence` — 지금 발화가 있는가(재생 전이면 false). `isNotice` — 표 안내 등 번역 대상이 아닌 발화.
 *   `remote` — 원격 상태 이름(`readalong.remoteState()`).
 * @returns {{state:'idle'|'none'|'ready'|'pending'|'failed'|'blocked', text:string, noteKey:string|null, retry:boolean, code:string|null}}
 */
export function bandView(rec, ctx) {
  const c = ctx || {};
  if (!c.hasSentence) return { state: 'idle', text: '', noteKey: 'readalong.idle', retry: false, code: null };
  if (c.isNotice) return { state: 'none', text: '', noteKey: 'readalong.none', retry: false, code: null };
  const r = rec || { state: 'none' };
  if (r.state === 'ready') return { state: 'ready', text: String(r.text == null ? '' : r.text), noteKey: null, retry: false, code: null };
  if (r.state === 'failed') return { state: 'failed', text: '', noteKey: 'readalong.failed', retry: true, code: r.code || null };
  const blockedBy = r.state === 'blocked' ? (r.code || c.remote)
    : (r.state === 'none' && BLOCKING_REMOTE.indexOf(c.remote) >= 0 ? c.remote : null);
  if (blockedBy && BLOCKED_KEYS[blockedBy]) {
    return { state: 'blocked', text: '', noteKey: BLOCKED_KEYS[blockedBy], retry: RETRYABLE_REMOTE.indexOf(blockedBy) >= 0, code: blockedBy };
  }
  // pending · 아직 묻지 않았음(none — refill 이 곧 pending 으로 바꾼다) · 그 밖
  return { state: 'pending', text: '', noteKey: 'readalong.pending', retry: false, code: null };
}

/**
 * 7-7 경과 비율 스크롤 — `(경과 − 1s) / 예상 시간` 을 0~1 로 자른다. 순수 함수.
 * @returns {number}
 */
export function scrollRatio(elapsedMs, expectedMs) {
  const e = Number(expectedMs);
  if (!(e > 0)) return 0;
  const r = (Number(elapsedMs) - 1000) / e;
  return r <= 0 ? 0 : r >= 1 ? 1 : r;
}

/** 예상 발화 시간(ms) — 글자 수 ÷ (초당 글자 × 속도). 워치독 여유(+3s)는 넣지 않는다(스크롤용). */
export function speechMs(text, charsPerSec, rate) {
  const n = Array.from(String(text == null ? '' : text)).length;
  const cps = Number(charsPerSec) > 0 ? Number(charsPerSec) : TTS.CHARS_PER_SEC;
  const r = Number(rate) > 0 ? Number(rate) : 1;
  return (n / (cps * r)) * 1000;
}

/**
 * 계단 스크롤(`prefers-reduced-motion`) — 목표 위치를 줄 높이의 배수로 내린다. 순수 함수.
 * @returns {number}
 */
export function stepScroll(target, lineHeight) {
  const lh = Number(lineHeight);
  if (!(lh > 0)) return Math.max(0, Math.floor(Number(target) || 0));
  return Math.max(0, Math.floor((Number(target) || 0) / lh) * lh);
}

/**
 * 서비스의 안내 사유(`readalong` `notice`) → 상태 바 배너 모양. 문구 키만 고른다(3-2).
 * @returns {{key:string, params:Object|null, actions:{key:string, nav:string}[]}|null}
 */
export function noticeBanner(code, lang) {
  switch (code) {
    case 'consent': return { key: 'readalong.consent', params: null, actions: [{ key: 'reader.readalong.settings', nav: SETTINGS_AI_HASH }] };
    case 'unsupported-lang': return { key: 'readalong.unsupportedLang', params: null, actions: [] };
    case 'same-lang': return { key: 'readalong.sameLang', params: null, actions: [] };
    case 'line-mode': return { key: 'readalong.lineMode', params: null, actions: [] };
    case 'no-key': return stateNotice(provider.CODES.NO_KEY, '');
    case 'no-voice': return { key: 'readalong.noVoice', params: { lang: nativeLangName(lang || '') },
      actions: [{ key: 'settings.readalong.voice.howTo', nav: SETTINGS_AI_HASH }] };
    default: return null;
  }
}

/**
 * 원격 상태 전이(`readalong` `remote`) → 상태 바 배너(14-2 긴 문구). `ready` 면 null(거둔다).
 * @param {string} state
 * @param {{providerLabel?:string, cap?:number}} [o]
 */
export function remoteBanner(state, o) {
  const x = o || {};
  switch (state) {
    case 'offline': return { key: 'ai.state.offline', params: null, actions: [] };
    case 'exhausted': return { key: 'ai.state.exhausted', params: null, actions: [] };
    case 'capped': return { key: 'ai.state.capped', params: { cap: String(x.cap == null ? '' : x.cap) },
      actions: [{ key: 'reader.readalong.settings', nav: SETTINGS_AI_HASH }] };
    case 'cooldown': return { key: 'ai.state.cooldown', params: null, actions: [] };
    case 'region': return stateNotice(provider.CODES.REGION, x.providerLabel || '');
    case 'model': return { key: 'ai.state.model', params: null, actions: [{ key: 'reader.readalong.settings', nav: SETTINGS_AI_HASH }] };
    case 'no-key': return stateNotice(provider.CODES.NO_KEY, '');
    default: return null;
  }
}

/** 처음 재생을 누를 때까지 미루는 안내(7-8-1 — "키 없음 … 재생을 처음 누를 때"). 읽기만 하는 사람을 막지 않는다. */
const DEFER_UNTIL_PLAY = Object.freeze(['no-key', 'consent']);

/* ────────────────────────────────────────────────────────
   2. 화면
   ──────────────────────────────────────────────────────── */

const SCROLL_TICK_MS = 500;
const TR_CHARS_PER_SEC = READALONG.CHARS_PER_SEC_TR;

let els = null;
let ra = null;
let sp = null;
/** 지금 발화 — `seg` 가 null 이면 표 안내(번역 대상 아님). */
let cur = { src: null, seg: null, page: null };
let offCur = null;
let shownMode = 'off';
let lastPaint = '';
/** 경과 비율 스크롤 — 한 문장(또는 그 번역문 발화) 동안의 상태. */
const roll = { kind: null, origin: 0, expected: 0, held: false, timer: null };
/** 띄운 배너 — 거둘 때 키로 찾는다. */
const banners = { notice: new Map(), remote: null, deferred: new Map() };

/**
 * @param {{readalong:Object, speaker:Object}} deps  controls 가 만든 그 둘(8b-1 계약 8절)
 * @returns {{sync:Function, leave:Function}}
 */
export function initTrBand(deps) {
  const d = deps || {};
  if (els || typeof document === 'undefined') return api();
  const band = document.getElementById('trBand');
  if (!band || !d.readalong || !d.speaker) return api();
  els = {
    band: band,
    text: band.querySelector('#trText'),
    status: band.querySelector('#trStatus'),
    note: band.querySelector('#trNote'),
    retry: band.querySelector('#trRetry')
  };
  ra = d.readalong;
  sp = d.speaker;

  /* ── 위임 리스너 하나 — [다시 시도] ───────────────────── */
  band.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-tr-action]') : null;
    if (!b || !band.contains(b)) return;
    if (b.getAttribute('data-tr-action') === 'retry') onRetry(b);
  });

  /* ── 띠를 만지면 그 문장 동안 자동 스크롤을 멈춘다(7-7) ── */
  const hold = () => { roll.held = true; };
  band.addEventListener('pointerdown', hold, { passive: true });
  band.addEventListener('touchstart', hold, { passive: true });
  band.addEventListener('wheel', hold, { passive: true });

  /* ── speaker → 띠 ─────────────────────────────────── */
  sp.addEventListener('linechange', (ev) => onLine(ev.detail || {}));
  sp.addEventListener('phasechange', (ev) => onPhase(ev.detail || {}));
  sp.addEventListener('statechange', () => onSpeakerState());
  sp.addEventListener('end', () => { stopRoll(); });
  sp.addEventListener('error', (ev) => {
    const code = (ev.detail || {}).code;
    if (code === 'TTS_TR_LAGGING') banner({ key: 'readalong.lagging', params: null, actions: [] });
  });

  /* ── readalong → 띠·상태 바 ───────────────────────── */
  ra.addEventListener('mode', () => sync());
  ra.addEventListener('notice', (ev) => onNotice(ev.detail || {}));
  ra.addEventListener('notice-clear', (ev) => onNoticeClear(ev.detail || {}));
  ra.addEventListener('remote', (ev) => onRemote(ev.detail || {}));

  onLangChange(() => { if (els) { applyTranslations(els.band); lastPaint = ''; paint(); } });
  applyTranslations(band);
  attachDebugHook();
  return api();
}

function api() { return { sync: sync, leave: leave }; }

/**
 * 유효 모드를 읽어 띠를 보이거나 숨기고 다시 그린다. controls 의 `syncReadalong()` 끝에서 불린다
 * (쪽이 그려질 때·재생 탭·모드 줄·단위 변경) — `mode` 이벤트가 없어도(값이 같아도) 리더에 다시 들어오면 자리를 잡는다.
 */
export function sync() {
  if (!els || !ra) return;
  const m = (ra.mode() || {}).mode || 'off';
  const on = m === 'show' || m === 'speak';
  const reader = els.band.closest('[data-screen="reader"]');
  const visible = on && !(reader && reader.hidden);
  shownMode = on ? m : 'off';
  els.band.hidden = !visible;
  const root = document.documentElement;
  if (visible) root.setAttribute('data-tr-band', 'on');
  else root.removeAttribute('data-tr-band');
  if (!visible) stopRoll();
  // 모드를 낭독 중에 바꿨다 — show 는 원문 발화 시간으로 흐르고, speak 는 번역문 단계(tr)에서만 흐른다.
  else if (m === 'show' && !roll.kind && cur.src && cur.seg !== null && sp && sp.getState() === 'speaking') startRoll('src');
  else if (m === 'speak' && roll.kind === 'src') stopRoll();
  lastPaint = '';
  paint();
  // `main.js` 의 `boot()` 가 전역 디버그 객체를 통째로 새로 만든다 — 쪽마다 다시 붙인다(controls 와 같은 이유).
  attachDebugHook();
}

/** 리더를 떠난다 — 자리를 비운다(다른 화면의 세로 예산을 건드리지 않는다). */
export function leave() {
  if (!els) return;
  stopRoll();
  if (offCur) { try { offCur(); } catch (e) { /* 이미 풀림 */ } offCur = null; }
  cur = { src: null, seg: null, page: null };
  lastPaint = '';
  els.band.hidden = true;
  document.documentElement.removeAttribute('data-tr-band');
}

/* ── 지금 문장 ─────────────────────────────────────────── */

function onLine(d) {
  const src = typeof d.src === 'string' && d.src ? d.src : null;
  const seg = Number.isInteger(d.seg) ? d.seg : null;
  const same = src !== null && src === cur.src && seg === cur.seg;
  cur = { src: src, seg: seg, page: d.page == null ? null : d.page };
  if (!same) {
    if (offCur) { try { offCur(); } catch (e) { /* 이미 풀림 */ } offCur = null; }
    if (src !== null && seg !== null) offCur = ra.onChange(src, () => paint());
    // 새 문장 — 맨 위에서, 손을 뗀 상태로. show 모드는 원문 발화 시간으로 흐른다(7-7).
    roll.held = false;
    resetScroll();
    if (shownMode === 'show') startRoll('src');
    else stopRoll();
    setSpeaking('src');
  }
  paint();
}

function onPhase(d) {
  const ph = d.phase;
  if (ph === 'tr') {
    setSpeaking('tr');
    // speak 모드의 tr 단계 — 번역문 발화 시간으로 흐른다. 원문 동안 내려가 있던 것을 위로 되돌린다.
    roll.held = false;
    resetScroll();
    startRoll('tr');
  } else if (ph === 'src') {
    setSpeaking('src');
  }
}

function onSpeakerState() {
  const s = sp.getState();
  if (s === 'speaking') {
    flushDeferred();
    // 재개는 그 발화를 처음부터 다시 읽는다(6-4) — 경과 시계도 다시 건다.
    if (roll.kind) { roll.origin = Date.now(); armTimer(); }
    // 멈춰 있던 **같은 문장**에서 재생을 시작했다(linechange 가 새 문장이 아니다) — show 모드는 원문 발화로 흐른다.
    else if (shownMode === 'show' && cur.src && cur.seg !== null) { roll.held = false; startRoll('src'); }
  } else {
    disarmTimer();
  }
}

function setSpeaking(ph) {
  if (els) els.band.setAttribute('data-speaking', ph === 'tr' ? 'tr' : 'src');
}

/* ── 그리기 ────────────────────────────────────────────── */

function targetLang() { return normalizeTranslationLang(settings.get('ai.translationLang')); }

function paint() {
  if (!els || !ra) return;
  const rec = cur.src ? ra.get(cur.src) : null;
  const v = bandView(rec, {
    hasSentence: cur.src !== null || cur.seg !== null || cur.page !== null,
    isNotice: cur.src === null || cur.seg === null,
    remote: safeRemote()
  });
  const a = translationBlockAttrs(targetLang());
  const sig = [v.state, v.text, v.noteKey, v.retry, a.lang, a.dir].join('\u0001');
  els.band.setAttribute('data-state', v.state);
  if (sig === lastPaint) return;
  lastPaint = sig;

  // 번역문 블록 — dir·lang 은 대상 언어에서(11-3). 조각마다 textContent(13절).
  const tx = els.text;
  while (tx.firstChild) tx.removeChild(tx.firstChild);
  tx.lang = a.lang;
  tx.dir = a.dir;
  if (v.text) appendBidiText(tx, v.text, a.dir);
  tx.hidden = !v.text;

  // 상태 한 줄 — UI 언어·UI 방향.
  els.note.dir = getDir();
  els.note.textContent = v.noteKey ? t(v.noteKey) : '';
  els.retry.hidden = !v.retry;
  els.retry.disabled = false;
  els.status.hidden = !v.noteKey && !v.retry;
  if (v.text && roll.kind) tick();          // 늦게 도착한 번역문도 지금 경과에 맞춘다
}

function safeRemote() {
  try { return ra.remoteState(); } catch (e) { return null; }
}

/* ── [다시 시도] (7-6 · 14-2) ──────────────────────────── */

function onRetry(btn) {
  if (!ra || btn.disabled) return;
  btn.disabled = true;                 // 두 번 눌러 두 번 보내지 않게 — 결과가 오면 다시 그린다
  Promise.resolve()
    .then(() => ra.retry())
    .catch(() => null)
    .then(() => { lastPaint = ''; paint(); });
}

/* ── 경과 비율 스크롤 (7-7 · B7) ──────────────────────── */

function expectedFor(kind) {
  const rate = (sp && typeof sp.getRate === 'function') ? sp.getRate() : 1;
  if (kind === 'tr') {
    const rec = cur.src ? ra.get(cur.src) : null;
    const text = rec && rec.state === 'ready' ? trSpeechText(rec.text) : '';
    return speechMs(text, TR_CHARS_PER_SEC, rate);
  }
  return speechMs(cur.src || '', TTS.CHARS_PER_SEC, rate);
}

function startRoll(kind) {
  roll.kind = kind;
  roll.origin = Date.now();
  roll.expected = expectedFor(kind);
  if (sp && sp.getState() === 'speaking') armTimer();
}

function stopRoll() {
  roll.kind = null;
  disarmTimer();
}

function armTimer() {
  disarmTimer();
  if (typeof window === 'undefined') return;
  roll.timer = window.setInterval(tick, SCROLL_TICK_MS);
}

function disarmTimer() {
  if (roll.timer !== null && typeof window !== 'undefined') window.clearInterval(roll.timer);
  roll.timer = null;
}

function resetScroll() {
  if (els) els.band.scrollTop = 0;
}

function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

function tick() {
  if (!els || !roll.kind || roll.held || els.band.hidden) return;
  if (roll.kind === 'tr' && !(roll.expected > 0)) roll.expected = expectedFor('tr');
  const max = els.band.scrollHeight - els.band.clientHeight;
  if (max <= 0) return;
  const target = max * scrollRatio(Date.now() - roll.origin, roll.expected);
  if (reducedMotion()) {
    const lh = parseFloat(getComputedStyle(els.text).lineHeight) || 0;
    const step = Math.min(max, stepScroll(target, lh));
    if (Math.abs(els.band.scrollTop - step) >= 1) els.band.scrollTop = step;
    return;
  }
  if (Math.abs(els.band.scrollTop - target) < 1) return;
  try { els.band.scrollTo({ top: target, behavior: 'smooth' }); } catch (e) { els.band.scrollTop = target; }
}

/* ── 상태 바 (14절 배너) — 바뀔 때 한 번 ──────────────── */

function banner(b) {
  if (!b || !b.key) return;
  document.dispatchEvent(new CustomEvent('medreader:banner', {
    detail: { key: b.key, tone: 'warn', params: b.params || null, actions: b.actions || [] }
  }));
}

/** 띄운 배너를 거둔다 — 배너 자신의 닫기 단추를 누른다(`main.js` 의 기록까지 지워진다. 장치를 두 벌로 만들지 않는다). */
function withdraw(key) {
  if (!key || typeof document === 'undefined') return;
  const bar = document.querySelector('#banners .banner[data-key="' + key + '"]');
  const close = bar ? bar.querySelector('button.banner-close') : null;
  if (close) close.click();
}

function onNotice(d) {
  const b = noticeBanner(d.code, d.lang);
  if (!b) return;
  if (DEFER_UNTIL_PLAY.indexOf(d.code) >= 0 && !(sp && sp.getState() === 'speaking')) {
    banners.deferred.set(d.code, b);
    return;
  }
  banners.notice.set(d.code, b.key);
  banner(b);
}

function flushDeferred() {
  if (!banners.deferred.size) return;
  const list = Array.from(banners.deferred.entries());
  banners.deferred.clear();
  for (const [code, b] of list) { banners.notice.set(code, b.key); banner(b); }
}

function onNoticeClear(d) {
  banners.deferred.delete(d.code);
  const key = banners.notice.get(d.code);
  banners.notice.delete(d.code);
  if (key) withdraw(key);
}

function onRemote(d) {
  const state = d.state;
  const prevKey = banners.remote;
  if (state === 'ready') {
    banners.remote = null;
    if (prevKey) withdraw(prevKey);
    lastPaint = ''; paint();
    return;
  }
  const b = remoteBanner(state, { providerLabel: providerLabel(), cap: settings.get('ai.dailyCap') });
  if (!b) return;
  if (prevKey && prevKey !== b.key) withdraw(prevKey);
  banners.remote = b.key;
  banner(b);
  lastPaint = ''; paint();
}

function providerLabel() {
  const p = settings.get('ai.provider');
  const id = typeof p === 'string' && p ? p : AI.DEFAULT_PROVIDER;
  try { const a = provider.getAdapter(id); return a && a.label ? a.label : id; } catch (e) { return id; }
}

/* ── 16-D3 `[D]` 측정 훅 — 원문 문장·번역문·키를 담지 않는다(16-K) ── */
function attachDebugHook() {
  if (typeof window === 'undefined') return;
  const g = window.__medreader || (window.__medreader = {});
  if (g.trband && g.trband.__mine) return;
  g.trband = {
    __mine: true,
    state: function () {
      if (!els) return null;
      return {
        hidden: els.band.hidden, state: els.band.getAttribute('data-state'), speaking: els.band.getAttribute('data-speaking'),
        mode: shownMode, roll: roll.kind, held: roll.held, expected: Math.round(roll.expected),
        scrollTop: els.band.scrollTop, scrollMax: els.band.scrollHeight - els.band.clientHeight
      };
    }
  };
}
